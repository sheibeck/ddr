// test/unit/achievements-adapter.test.js
//
// Phase 99 (TRACK-02..05), plan 99-03: the engine adapter's achievement hooks
// run against the REAL engine (applyAction through dispatch()), not synthetic
// events: the lazy load, Tourist at startNewRun, a real kill by group, a real
// floor-1 death, an abandon, a real ailment hit that leaves the hero on 1 HP,
// dev runs, and the one listener.
//
// The FIRST test runs before any loadAchievements()/boot() call in this
// process (node --test gives each file its own process), so it exercises the
// lazy path where `achievementRecord` is still null and a dispatch must never
// overwrite what is on disk.

import test from "node:test";
import assert from "node:assert/strict";

import {
  boot,
  initRun,
  dispatch,
  startNewRun,
  getState,
  loadAchievements,
  getAchievementRecord,
  setAchievementListener,
  waitForPending,
} from "../../src/browser/engineAdapter.js";
import { flush as flushStorage } from "../../src/browser/storage.js";
import { ACHIEVEMENTS_KEY, emptyRecord, parseRecord } from "../../src/browser/achievementRecord.js";
import { runTagOf } from "../../src/browser/achievementTracker.js";

const SAVE_KEY = "ddr.delve.v1";

async function withFakeLocalStorage(fn) {
  const store = new Map();
  const previous = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  try {
    return await fn(globalThis.localStorage, store);
  } finally {
    setAchievementListener(null);
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
}

function recorder() {
  const calls = [];
  return { fn: (payload) => calls.push(payload), calls };
}

async function drain() {
  await waitForPending();
  await flushStorage();
}

function storedRecord(store) {
  return parseRecord(store.get(ACHIEVEMENTS_KEY) ?? null);
}

function progressOf(calls, id) {
  return calls.flatMap((p) => p.progress).filter((x) => x.id === id);
}

function unlockedIds(calls) {
  return calls.flatMap((p) => p.unlocks.map((u) => u.id));
}

// A plain melee Fighter (the E9 recipe in engineAdapter.test.js): a Wizard
// refuses to melee while a charge remains and would return before the foe turn.
function makeFighter(state, wp = 9999) {
  state.c.cls = "Fighter";
  state.c.sub = "Soldier";
  state.c.race = "Human";
  state.c.wp = wp;
  state.c.maxWP = Math.max(wp, 55);
  state.c.invis = 0;
  state.c.mirror = 0;
  state.c.armor = "Nothing";
  state.c.ar = 0;
  state.c.armorWP = 0;
  state.c.armorMax = 0;
}

function foeLiteral(type, wp) {
  return { name: "Test Foe", type, lvl: 3, size: "L", intel: 1, wp, maxWP: wp, alive: true, asleep: 0, sp: {}, lives: 1 };
}

function setFight(state, foes) {
  state.combat = { foes, type: foes[0].type, round: 1, target: 0, spellOpen: false, tracked: false };
}

function firstOpenPlainDir(state) {
  const f = state.floor;
  const DIRV = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
  for (const [d, [dx, dy]] of Object.entries(DIRV)) {
    const cell = f.g[f.py + dy] && f.g[f.py + dy][f.px + dx];
    if (cell && !cell.wall && !cell.feat) return d;
  }
  return null;
}

// --- lazy path (FIRST test: fresh module state, record never loaded) --------

test("a dispatch before the record loaded folds into the STORED record, never over it (the lazy path)", async () => {
  await withFakeLocalStorage(async (_ls, store) => {
    const seeded = { ...emptyRecord(), counters: { ...emptyRecord().counters, deaths: 3 }, unlocked: { depth_t1: 111 } };
    store.set(ACHIEVEMENTS_KEY, JSON.stringify(seeded));
    assert.equal(getAchievementRecord(), null, "nothing loaded yet");

    initRun(4242);
    getState().floor.depth = 10;
    dispatch({ type: "bogus" });
    assert.equal(getAchievementRecord(), null, "the fold is queued behind the load");

    await drain();
    const stored = storedRecord(store);
    assert.equal(stored.counters.deaths, 3, "the stored counter survived");
    assert.equal(stored.unlocked.depth_t1, 111, "the stored unlock kept its date");
    assert.equal(stored.bests.depth, 10);
    assert.ok(Number.isFinite(stored.unlocked.depth_t2), "depth_t2 unlocked by the queued action");
    assert.deepStrictEqual(getAchievementRecord(), stored, "memory matches disk");
  });
});

// --- boot -------------------------------------------------------------------

test("boot() with nothing stored loads an all-zero record and the pre-title fallback run records nothing", async () => {
  await withFakeLocalStorage(async () => {
    await boot(4242);
    assert.deepStrictEqual(getAchievementRecord(), emptyRecord());
    assert.deepStrictEqual(getAchievementRecord().subClassesDelved, []);
  });
});

// --- startNewRun: Tourist ---------------------------------------------------

test("startNewRun records the sub-class, tags the run, saves apart from the run save, and tells the listener", async () => {
  await withFakeLocalStorage(async (_ls, store) => {
    await boot(1);
    const r = recorder();
    setAchievementListener(r.fn);
    const state = await startNewRun(7001);
    const rec = getAchievementRecord();
    assert.deepStrictEqual([...rec.subClassesDelved], [state.c.sub]);
    assert.equal(rec.run.tag, runTagOf(getState()));
    assert.equal(rec.run.seen, true);

    await drain();
    assert.deepStrictEqual(storedRecord(store), rec, "the stored record parses to the same record");
    const rawRecord = JSON.parse(store.get(ACHIEVEMENTS_KEY));
    assert.ok(!("floor" in rawRecord) && !("c" in rawRecord), "no run-save keys in the record");
    const rawSave = JSON.parse(store.get(SAVE_KEY));
    assert.ok(!("unlocked" in rawSave), "no record keys in the run save");

    assert.equal(r.calls.length, 1);
    assert.ok(Object.isFrozen(r.calls[0]) && Object.isFrozen(r.calls[0].progress));
    assert.deepStrictEqual(progressOf(r.calls, "tourist"), [{ id: "tourist", value: 1, steps: 24 }]);
  });
});

// --- a real kill, by group --------------------------------------------------

test("a real kill through attack counts under the foe's group and reaches the listener", async () => {
  await withFakeLocalStorage(async (_ls, store) => {
    await boot(1);
    await startNewRun(7002);
    const r = recorder();
    setAchievementListener(r.fn);
    const state = getState();
    makeFighter(state);
    setFight(state, [foeLiteral("Demons", 1)]);

    let killed = false;
    for (let i = 0; i < 500 && !killed; i++) {
      const { events } = dispatch({ type: "attack" });
      killed = events.some((e) => e.type === "foeKilled");
      if (killed) assert.equal(events.find((e) => e.type === "foeKilled").group, "Demons", "the real engine reports the group");
    }
    assert.ok(killed, "a foeKilled event appeared");
    assert.equal(getAchievementRecord().kills.Demons, 1);
    assert.equal(getAchievementRecord().kills.Beasts, 0);
    const prog = progressOf(r.calls, "kills_demons_t1");
    assert.equal(prog.length, 1);
    assert.equal(prog[0].value, 1);
    await drain();
    assert.equal(storedRecord(store).kills.Demons, 1);
  });
});

// --- a real ailment hit, by wp ---------------------------------------------

test("a real poison tick that leaves the hero on 1 HP sets the Terminal Condition flag (the real wp field)", async () => {
  await withFakeLocalStorage(async () => {
    await boot(1);
    await startNewRun(7003);
    const state = getState();
    makeFighter(state, 2);
    state.c.affliction = { kind: "Poison", per: 1, loss: { n: 1, sides: 6, bonus: 0 }, left: 5 };
    const f = state.floor;
    f.g[f.py - 1][f.px] = { wall: false, seen: false, feat: null, water: true };

    const { events } = dispatch({ type: "move", dir: "N" });
    const tick = events.find((e) => e.type === "afflictionTick");
    assert.ok(tick, "the real engine emitted an afflictionTick");
    assert.equal(tick.wp, 1, "the real engine reports the post-hit HP");
    assert.equal(getAchievementRecord().flags.poisonLeftOnOneHp, true);
    assert.equal(getAchievementRecord().flags.diseaseLeftOnOneHp, false);
  });
});

// --- deaths and abandons ----------------------------------------------------

test("a floor-1 combat death counts once, unlocks Special Snowflake, and the listener hears it in one call", async () => {
  await withFakeLocalStorage(async () => {
    await boot(1);
    await startNewRun(7004);
    const r = recorder();
    setAchievementListener(r.fn);
    const state = getState();
    makeFighter(state, 1); // any landed foe blow is lethal
    setFight(state, [foeLiteral("Beasts", 999999)]);

    let died = false;
    let dyingCalls = [];
    for (let i = 0; i < 500 && !died; i++) {
      const heard = r.calls.length;
      const { state: after, events } = dispatch({ type: "attack" });
      if (after.dead) {
        died = events.some((e) => e.type === "died" && e.cause === "combat");
        dyingCalls = r.calls.slice(heard);
      }
    }
    assert.ok(died, "a foe landed a lethal blow");
    const rec = getAchievementRecord();
    assert.equal(rec.counters.deaths, 1);
    assert.ok(Number.isFinite(rec.unlocked.special_snowflake), "unlocked with a numeric date");
    assert.equal(dyingCalls.length, 1, "one listener call for the dying action");
    assert.deepStrictEqual(unlockedIds(dyingCalls), ["special_snowflake"]);
    assert.equal(progressOf(dyingCalls, "frequent_flier_t1")[0].value, 1);
    assert.deepStrictEqual(unlockedIds(r.calls), ["special_snowflake"], "and no other unlock all run");
  });
});

test("an abandon is not a death, earns nothing, and the run still counted for Tourist", async () => {
  await withFakeLocalStorage(async () => {
    await boot(1);
    const r = recorder();
    setAchievementListener(r.fn);
    const state = await startNewRun(7005);
    const sub = state.c.sub;
    const { events } = dispatch({ type: "abandon" });
    assert.ok(events.some((e) => e.type === "died" && e.cause === "abandon"));
    const rec = getAchievementRecord();
    assert.equal(rec.counters.deaths, 0);
    assert.deepStrictEqual(unlockedIds(r.calls), []);
    assert.deepStrictEqual(progressOf(r.calls, "frequent_flier_t1"), [], "no Frequent Flier step");
    assert.ok(rec.subClassesDelved.includes(sub));
  });
});

// --- dev runs ---------------------------------------------------------------

test("a dev start-at-depth run earns nothing: same record object, no write, no listener call", async () => {
  await withFakeLocalStorage(async (_ls, store) => {
    await boot(1);
    await drain();
    const before = getAchievementRecord();
    const r = recorder();
    setAchievementListener(r.fn);

    const state = await startNewRun(7006, { startDepth: 6 });
    assert.equal(state.dev, true, "the run is a dev run");
    assert.equal(getAchievementRecord(), before);
    const dir = firstOpenPlainDir(state);
    if (dir) dispatch({ type: "move", dir });
    dispatch({ type: "bogus" });
    dispatch({ type: "abandon" });
    await drain();

    assert.equal(getAchievementRecord(), before, "the very same object throughout");
    assert.equal(r.calls.length, 0);
    assert.equal(store.has(ACHIEVEMENTS_KEY), false, "nothing written under ddr.achievements.v1");
  });
});

// --- the listener -----------------------------------------------------------

// An unlock-earning action without a fight: depth 5 in place, then a no-op action.
function earnDepthT1() {
  getState().floor.depth = 5;
  return dispatch({ type: "bogus" });
}

test("a throwing listener changes nothing: dispatch returns normally and the record is updated and stored", async () => {
  await withFakeLocalStorage(async (_ls, store) => {
    await boot(1);
    await startNewRun(7007);
    let calls = 0;
    setAchievementListener(() => {
      calls += 1;
      throw new Error("listener bug");
    });
    const result = earnDepthT1();
    assert.ok(result && result.state, "dispatch returned its normal result");
    assert.equal(calls, 1);
    assert.ok(Number.isFinite(getAchievementRecord().unlocked.depth_t1));
    await drain();
    assert.ok(Number.isFinite(storedRecord(store).unlocked.depth_t1));
  });
});

test("a rejecting listener is swallowed the same way", async () => {
  await withFakeLocalStorage(async (_ls, store) => {
    await boot(1);
    await startNewRun(7008);
    let calls = 0;
    setAchievementListener(() => {
      calls += 1;
      return Promise.reject(new Error("async listener bug"));
    });
    const result = earnDepthT1();
    assert.ok(result && result.state);
    assert.equal(calls, 1);
    await drain();
    assert.ok(Number.isFinite(storedRecord(store).unlocked.depth_t1));
  });
});

test("setAchievementListener(null) stops calls, and with no listener the record still updates and saves", async () => {
  await withFakeLocalStorage(async (_ls, store) => {
    await boot(1);
    await startNewRun(7009);
    const r = recorder();
    setAchievementListener(r.fn);
    getState().floor.depth = 3;
    dispatch({ type: "bogus" });
    const heard = r.calls.length;
    assert.ok(heard >= 1, "depth progress reached the listener");

    setAchievementListener(null);
    earnDepthT1();
    assert.equal(r.calls.length, heard, "no further calls after unregistering");
    assert.ok(Number.isFinite(getAchievementRecord().unlocked.depth_t1), "the record still updated");
    await drain();
    assert.ok(Number.isFinite(storedRecord(store).unlocked.depth_t1), "and was still saved");
  });
});

test("a later listener replaces an earlier one, and a non-function unregisters", async () => {
  await withFakeLocalStorage(async () => {
    await boot(1);
    await startNewRun(7010);
    const a = recorder();
    const b = recorder();
    setAchievementListener(a.fn);
    setAchievementListener(b.fn);
    earnDepthT1();
    assert.equal(a.calls.length, 0);
    assert.ok(b.calls.length >= 1);
    setAchievementListener("not a function");
    const seen = b.calls.length;
    getState().floor.depth = 10;
    dispatch({ type: "bogus" });
    assert.equal(b.calls.length, seen);
  });
});

test("loadAchievements returns the same in-flight promise and resolves to a v1 record", async () => {
  await withFakeLocalStorage(async () => {
    const p1 = loadAchievements();
    const p2 = loadAchievements();
    assert.equal(p1, p2, "a load in flight is returned, not restarted");
    const rec = await p1;
    assert.ok(rec && rec.v === 1);
  });
});
