// test/persistence/achievements-persistence.test.js
//
// Phase 99 (TRACK-02, TRACK-04), plan 99-03: the lifetime achievements record
// (ddr.achievements.v1) across storage, relaunch and the app's background
// flush. Everything runs through the real engine adapter, the real storage.js
// and the real engine:
//
//   - a missing, corrupt or older-shape stored record loads at boot as zeros
//   - an unlock is saved in the same write as the counters that earned it
//   - a relaunch keeps the unlock with its original date and never re-fires it
//   - a mid-run relaunch keeps the current-run progress (Teetotaler earnable)
//   - a run resumed from before the record existed cannot earn Naked Ambition
//     or Teetotaler
//   - the native Preferences path stores the record apart from the run save
//   - flushOnBackground (what the app runs on pause) drains the record write,
//     including a lazy load that started from a dispatch
//
// The FIRST test runs before any boot()/loadAchievements() call in this
// process (node --test gives each file its own process), so it covers the
// lazy path under the background flush.

import test from "node:test";
import assert from "node:assert/strict";

import * as storage from "../../src/browser/storage.js";
import { flush as flushStorage } from "../../src/browser/storage.js";
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
import { flushOnBackground } from "../../src/browser/nativeChrome.js";
import { ACHIEVEMENTS_KEY, emptyRecord, parseRecord } from "../../src/browser/achievementRecord.js";
import { filledSlotCount, runTagOf } from "../../src/browser/achievementTracker.js";
import { installFakeCapacitor, installFakeLocalStorage, makeFakePreferences } from "./harness/fakePreferences.js";

const SAVE_KEY = "ddr.delve.v1";

async function withLocalStorage(fn) {
  const { store, restore } = installFakeLocalStorage();
  try {
    return await fn(store);
  } finally {
    setAchievementListener(null);
    restore();
  }
}

async function drain() {
  await waitForPending();
  await flushStorage();
}

function stored(store) {
  return parseRecord(store.get(ACHIEVEMENTS_KEY) ?? null);
}

function unlockedIds(calls) {
  return calls.flatMap((p) => p.unlocks.map((u) => u.id));
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

// The E9 recipe (engineAdapter.test.js): a floor-1 combat death.
function dieOnFloorOne() {
  const state = getState();
  state.c.cls = "Fighter";
  state.c.sub = "Soldier";
  state.c.race = "Human";
  state.c.wp = 1; // any landed foe blow is lethal
  state.c.maxWP = 55;
  state.c.invis = 0;
  state.c.mirror = 0;
  state.c.armor = "Nothing";
  state.c.ar = 0;
  state.c.armorWP = 0;
  state.c.armorMax = 0;
  state.combat = {
    foes: [{ name: "Ogre", type: "Beasts", lvl: 3, size: "L", intel: 1, wp: 999999, maxWP: 999999, alive: true, asleep: 0, sp: {}, lives: 1 }],
    type: "Beasts", round: 1, target: 0, spellOpen: false, tracked: false,
  };
  for (let i = 0; i < 500; i++) {
    const { state: after, events } = dispatch({ type: "attack" });
    if (after.dead) {
      assert.ok(events.some((e) => e.type === "died" && e.cause === "combat"));
      return;
    }
  }
  assert.fail("the hero never died");
}

// --- lazy load under the background flush (FIRST test) -----------------------

test("flushOnBackground drains a lazy load: a dispatch before any load still lands in the stored record", async () => {
  await withLocalStorage(async (store) => {
    store.set(ACHIEVEMENTS_KEY, JSON.stringify({ ...emptyRecord(), counters: { ...emptyRecord().counters, deaths: 4 } }));
    initRun(5151);
    getState().floor.depth = 5;
    dispatch({ type: "bogus" });
    assert.equal(getAchievementRecord(), null, "the record has not loaded yet");

    await flushOnBackground(storage, waitForPending);
    const rec = stored(store);
    assert.equal(rec.counters.deaths, 4, "the stored counter survived the lazy load");
    assert.ok(Number.isFinite(rec.unlocked.depth_t1), "the queued action's unlock is on disk");
  });
});

// --- tolerant boot -----------------------------------------------------------

test("boot() loads zeros from an absent, corrupt, non-object, version-0 or newer-version record", async () => {
  const cases = [
    ["absent", null],
    ["not json", "not json"],
    ["an array", "[]"],
    ["version 0", '{"v":0}'],
    ["a newer version", '{"v":2,"counters":{"deaths":5}}'],
  ];
  for (const [label, value] of cases) {
    await withLocalStorage(async (store) => {
      if (value !== null) store.set(ACHIEVEMENTS_KEY, value);
      await assert.doesNotReject(boot(1), label);
      assert.deepStrictEqual(getAchievementRecord(), emptyRecord(), label);
    });
  }
});

test("a v1 record with one bad field keeps its valid fields and its unlocks", async () => {
  await withLocalStorage(async (store) => {
    const base = emptyRecord();
    store.set(ACHIEVEMENTS_KEY, JSON.stringify({ ...base, counters: { ...base.counters, deaths: "x", joinersAccepted: 2 }, unlocked: { depth_t1: 222 } }));
    await boot(1);
    const rec = getAchievementRecord();
    assert.equal(rec.counters.deaths, 0, "the bad field zeroed");
    assert.equal(rec.counters.joinersAccepted, 2, "its neighbours kept");
    assert.equal(rec.unlocked.depth_t1, 222);
  });
});

// --- same-write unlock and relaunch -----------------------------------------

test("an unlock is saved in the same write as the counters that earned it, and a relaunch keeps it without re-firing", async () => {
  await withLocalStorage(async (store) => {
    const writes = [];
    const raw = globalThis.localStorage.setItem;
    globalThis.localStorage.setItem = (k, v) => {
      writes.push([k, v]);
      raw(k, v);
    };
    await boot(1);
    await startNewRun(7101);
    dieOnFloorOne();
    await drain();

    const recordWrites = writes.filter(([k]) => k === ACHIEVEMENTS_KEY).map(([, v]) => JSON.parse(v));
    assert.ok(recordWrites.length >= 1, "the record was written");
    const first = recordWrites.find((r) => r.unlocked && r.unlocked.special_snowflake !== undefined);
    assert.ok(first, "a stored value holds the unlock");
    assert.equal(first.counters.deaths, 1, "the first value holding the unlock also holds the death that earned it");
    const date = first.unlocked.special_snowflake;
    assert.ok(Number.isFinite(date));

    // Relaunch: re-read the record from storage.
    const reloaded = await loadAchievements();
    assert.equal(reloaded.unlocked.special_snowflake, date, "same date after the reload");
    assert.equal(reloaded.counters.deaths, 1);

    // A second floor-1 death in a new run counts, never re-fires, never moves the date.
    const heard = [];
    setAchievementListener((p) => heard.push(p));
    await startNewRun(7102);
    dieOnFloorOne();
    await drain();
    assert.equal(getAchievementRecord().counters.deaths, 2);
    assert.ok(!unlockedIds(heard).includes("special_snowflake"), "the listener never hears it twice");
    assert.equal(getAchievementRecord().unlocked.special_snowflake, date, "the date is unchanged");
    assert.equal(stored(store).unlocked.special_snowflake, date);
  });
});

// --- mid-run relaunch --------------------------------------------------------

test("a mid-run relaunch keeps the run progress: Teetotaler is still earnable, Naked Ambition is not (gear was worn)", async () => {
  await withLocalStorage(async () => {
    await boot(1);
    const state = await startNewRun(7201);
    assert.ok(filledSlotCount(state.c) > 0, "precondition: the roll wears chargen gear at the first step");
    const dir = firstOpenPlainDir(state);
    assert.ok(dir, "an open plain neighbour exists");
    dispatch({ type: "move", dir });
    assert.equal(getState().dead, false);
    await drain();

    // Relaunch: boot() rehydrates the run save and re-reads the record.
    await boot(1);
    const resumed = getState();
    assert.equal(resumed.seed, 7201, "the same run resumed");
    const rec = getAchievementRecord();
    assert.equal(rec.run.tag, runTagOf(resumed));
    assert.equal(rec.run.stepped, true);
    assert.equal(rec.run.seen, true);

    resumed.floor.depth = 5;
    dispatch({ type: "bogus" });
    const after = getAchievementRecord();
    assert.ok(Number.isFinite(after.unlocked.teetotaler), "Teetotaler unlocks on the resumed run");
    assert.equal(after.unlocked.naked_ambition, undefined, "Naked Ambition does not");
  });
});

// --- the pre-2.5 run ---------------------------------------------------------

test("a run resumed from a save made before the record existed counts from now but earns neither Naked Ambition nor Teetotaler", async () => {
  await withLocalStorage(async (store) => {
    await boot(1);
    await startNewRun(7301);
    await drain();
    store.delete(ACHIEVEMENTS_KEY); // the save predates the record

    await boot(1);
    assert.deepStrictEqual(getAchievementRecord(), emptyRecord());
    assert.equal(getState().seed, 7301, "the save resumed");
    getState().floor.depth = 5;
    dispatch({ type: "bogus" });
    const rec = getAchievementRecord();
    assert.ok(Number.isFinite(rec.unlocked.depth_t1), "everything else counts from the moment it is seen");
    assert.equal(rec.unlocked.teetotaler, undefined);
    assert.equal(rec.unlocked.naked_ambition, undefined);
    assert.equal(rec.run.seen, false);
  });
});

// --- the native Preferences path --------------------------------------------

test("on a native platform the record lives in Preferences under its own key, apart from the run save", async () => {
  const preferences = makeFakePreferences();
  const restoreCap = installFakeCapacitor({ isNative: true, preferences });
  const { restore: restoreLs } = installFakeLocalStorage();
  try {
    await boot(1);
    const state = await startNewRun(7401);
    await drain();

    assert.ok(preferences._raw.has(ACHIEVEMENTS_KEY), "the record is in Preferences");
    assert.ok(preferences._raw.has(SAVE_KEY), "the run save is its own key");
    const rec = parseRecord(preferences._raw.get(ACHIEVEMENTS_KEY));
    assert.deepStrictEqual([...rec.subClassesDelved], [state.c.sub]);
    const rawRecord = JSON.parse(preferences._raw.get(ACHIEVEMENTS_KEY));
    const rawSave = JSON.parse(preferences._raw.get(SAVE_KEY));
    assert.ok(!("floor" in rawRecord) && !("c" in rawRecord), "the record has no run-save keys");
    assert.ok(!("unlocked" in rawSave), "the run save has no record keys");
  } finally {
    setAchievementListener(null);
    restoreLs();
    restoreCap();
  }
});

// --- the background flush ----------------------------------------------------

test("flushOnBackground resolves with the unlock on disk after an unlock-earning dispatch", async () => {
  await withLocalStorage(async (store) => {
    await boot(1);
    await startNewRun(7501);
    getState().floor.depth = 5;
    dispatch({ type: "bogus" });
    await flushOnBackground(storage, waitForPending);
    assert.ok(Number.isFinite(stored(store).unlocked.depth_t1), "the unlock is stored");
  });
});
