// test/unit/board-death-paths.test.js
//
// Phase 81 Plan 01 (BOARD-15 debug session): every death path — combat, trap,
// starvation, abandon, a resumed save and a relaunch after death — driven
// through the REAL src/browser/engineAdapter.js dispatch() choke point (never
// engine/death.js#die() directly), each seeding a depth-9 run first and then
// recording a depth-10 run, asserting the depth-10 run ranks above the
// depth-9 run on ME DEEPEST (and every other RANKED_BOARDS board it strictly
// beats), persists byte-identically to ddr.bests.v1, and agrees with the
// graveyard stone's hash.
//
// This file writes no production code. Every confirmed defect this session
// finds is pinned here as a `todo` test naming its R-id (see 81-DEBUG.md's
// "## R-15" section for the full hypothesis table); a hypothesis this file
// cannot cheaply reproduce is instead cited by file:line in that same
// section. Every test below currently passes — no R-15 local-recording
// defect was reproduced at the engine/adapter layer (see 81-DEBUG.md).
//
// Harness copied from test/unit/bests-adapter.test.js (withFakeLocalStorage)
// and test/unit/engineAdapter.test.js (the E9 forced-combat-death loop,
// firstOpenPlainDir). Board lists come ONLY from engine/records.js's
// RANKED_BOARDS — never a hard-coded board id — per the parallel-wave notice
// (81-02 removes the retired LEANEST board id from that same export in this
// wave; this file must read whatever RANKED_BOARDS holds after every wave).

import test from "node:test";
import assert from "node:assert/strict";

import {
  boot,
  getState,
  dispatch,
  startNewRun,
  loadBests,
  loadGraveyard,
  getBests,
  getGraveyard,
  waitForPending,
} from "../../src/browser/engineAdapter.js";
import { flush as flushStorage } from "../../src/browser/storage.js";
import { serializeRun } from "../../engine/saveState.js";
import { RANKED_BOARDS, compareRuns, runHash, emptyBests, updateBests } from "../../engine/records.js";

const SAVE_KEY = "ddr.delve.v1";
const BESTS_KEY = "ddr.bests.v1";

async function withFakeLocalStorage(fn) {
  const store = new Map();
  const previous = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  try {
    return await fn(globalThis.localStorage);
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
}

const DIRV = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
const OPPOSITE = { N: "S", S: "N", E: "W", W: "E" };

/** firstOpenPlainDir(state) — a direction into a non-wall, feature-free neighbor. */
function firstOpenPlainDir(state) {
  const f = state.floor;
  for (const [d, [dx, dy]] of Object.entries(DIRV)) {
    const nx = f.px + dx;
    const ny = f.py + dy;
    const cell = f.g[ny] && f.g[ny][nx];
    if (cell && !cell.wall && !cell.feat) return d;
  }
  return null;
}

/**
 * seedDepth9(seed) — the shared depth-9 seed every path test starts from
 * (an abandon death, per the plan's action text). Returns the depth-9 run's
 * hash, then flushes so the next run's own writes never race it.
 */
async function seedDepth9(seed) {
  await startNewRun(seed);
  getState().floor.depth = 9;
  dispatch({ type: "abandon" });
  const hash = getBests().last;
  await waitForPending();
  await flushStorage();
  return hash;
}

/**
 * assertDepth10RanksAboveDepth9(store, depth9Hash) — the shared assertion
 * block every path test ends on (H-15's core claim): DEEPEST #0/#1 order,
 * every RANKED_BOARDS board the depth-10 run strictly beats, the stored
 * ddr.bests.v1 deep-equaling the in-memory record, and the graveyard's
 * newest stone agreeing with the DEEPEST #0 hash.
 */
function assertDepth10RanksAboveDepth9(store, depth9Hash) {
  const bests = getBests();
  const depth10Hash = bests.last;
  assert.notEqual(depth10Hash, depth9Hash, "the depth-10 death produced a different run than the seeded depth-9 one");
  assert.ok(bests.runs[depth10Hash], "the depth-10 run is held in the record");
  assert.equal(bests.boards.deep[0], depth10Hash, "the depth-10 run is #1 on DEEPEST");
  assert.equal(bests.boards.deep[1], depth9Hash, "the seeded depth-9 run sits right behind it");

  const depth10 = bests.runs[depth10Hash];
  const depth9 = bests.runs[depth9Hash];
  for (const board of RANKED_BOARDS) {
    if (compareRuns(board, depth10, depth9) < 0) {
      const list = bests.boards[board];
      assert.ok(
        list.includes(depth10Hash) && (!list.includes(depth9Hash) || list.indexOf(depth10Hash) < list.indexOf(depth9Hash)),
        `the depth-10 run should rank above the depth-9 run on ${board}`,
      );
    }
  }

  const stored = JSON.parse(store.getItem(BESTS_KEY));
  assert.deepStrictEqual(stored, bests, "ddr.bests.v1 deep-equals the in-memory record");

  const grave = getGraveyard();
  assert.ok(grave && grave.graves.length > 0, "the graveyard holds at least this death's stone");
  assert.equal(grave.graves[0].hash, bests.boards.deep[0], "the graveyard's newest stone agrees with DEEPEST #0");
}

// --- path 1: combat ---------------------------------------------------------

/**
 * forceCombatDeath() — mirrors test/unit/engineAdapter.test.js's E9 pattern:
 * a plain melee Fighter at wp 1 against an effectively unkillable foe, so the
 * loop only exits once the seeded rng lands a lethal foe blow through the
 * real foe-turn hero-damage branch (engine/combat.js#applyFoeDamageToPlayer).
 */
function forceCombatDeath() {
  const state = getState();
  state.c.cls = "Fighter";
  state.c.sub = "Soldier";
  state.c.race = "Human";
  state.c.wp = 1;
  state.c.maxWP = 55;
  state.c.invis = 0;
  state.c.mirror = 0;
  state.c.armor = "Nothing";
  state.c.ar = 0;
  state.c.armorWP = 0;
  state.c.armorMax = 0;
  state.combat = {
    foes: [
      { name: "Ogre", type: "Beasts", lvl: 3, size: "L", intel: 1, wp: 999999, maxWP: 999999, alive: true, asleep: 0, sp: {}, lives: 1 },
    ],
    type: "Beasts",
    round: 1,
    target: 0,
    spellOpen: false,
    tracked: false,
  };
  for (let i = 0; i < 500 && !getState().dead; i++) {
    dispatch({ type: "attack" });
  }
  return getState().dead;
}

test("BOARD-15 combat death path: a depth-10 death through the real foe-turn damage branch ranks above the seeded depth-9 run", async () => {
  await withFakeLocalStorage(async (store) => {
    await loadBests();
    await loadGraveyard();
    const depth9Hash = await seedDepth9(910100);

    await startNewRun(910101);
    getState().floor.depth = 10;
    const died = forceCombatDeath();
    assert.ok(died, "the seeded rng eventually lands a lethal foe blow via applyFoeDamageToPlayer");
    assert.ok(getState().dead && getGraveyard().graves[0].cause === "combat", "the recorded death cause is combat");

    await waitForPending();
    await flushStorage();
    assertDepth10RanksAboveDepth9(store, depth9Hash);
  });
});

// --- path 2: trap ------------------------------------------------------------

/**
 * forceTrapDeath() — arms a "trap" feature on the neighbor cell in an open
 * plain direction, steps onto it at wp 1 (springTrap's own dodge check is
 * the only thing that can avoid lethal damage — see engine/encounters.js),
 * and on a dodge steps back and re-arms rather than looping in place (the
 * feature is consumed by the mere act of stepping onto it, dodge or not).
 * "Soldier" avoids the Acrobat dodge bonus and the Pilfer auto-disarm branch
 * that would otherwise make this loop non-terminating. state.steps resets to
 * 0 every attempt so a long loop never accidentally crosses the 100-step
 * newDay() boundary and confounds this path with a starvation/rest tick.
 */
function forceTrapDeath() {
  const state = getState();
  state.c.sub = "Soldier";
  const dir = firstOpenPlainDir(state);
  if (!dir) return { died: false, skip: true };
  const back = OPPOSITE[dir];
  for (let i = 0; i < 400 && !getState().dead; i++) {
    const s = getState();
    s.steps = 0;
    s.c.wp = 1;
    const f = s.floor;
    const [dx, dy] = DIRV[dir];
    f.g[f.py + dy][f.px + dx].feat = "trap";
    dispatch({ type: "move", dir });
    if (getState().dead) break;
    dispatch({ type: "move", dir: back });
  }
  return { died: getState().dead, skip: false };
}

test("BOARD-15 trap death path: a depth-10 death through the real springTrap branch ranks above the seeded depth-9 run", async () => {
  await withFakeLocalStorage(async (store) => {
    await loadBests();
    await loadGraveyard();
    const depth9Hash = await seedDepth9(910200);

    await startNewRun(910201);
    getState().floor.depth = 10;
    const { died, skip } = forceTrapDeath();
    if (skip) return; // no open, feature-free neighbor on this seed's floor 1 — maze layout, not a bug
    assert.ok(died, "the seeded rng eventually fails the trap dodge and takes lethal damage");
    assert.equal(getGraveyard().graves[0].cause, "trap", "the recorded death cause is trap");

    await waitForPending();
    await flushStorage();
    assertDepth10RanksAboveDepth9(store, depth9Hash);
  });
});

// --- path 3: starvation ------------------------------------------------------

test("BOARD-15 starvation death path: a depth-10 death through the real newDay() upkeep tick ranks above the seeded depth-9 run", async () => {
  await withFakeLocalStorage(async (store) => {
    await loadBests();
    await loadGraveyard();
    const depth9Hash = await seedDepth9(910300);

    await startNewRun(910301);
    getState().floor.depth = 10;
    const dir = firstOpenPlainDir(getState());
    assert.ok(dir, "seed 910301's floor 1 has at least one open, feature-free neighbor from the start tile");
    getState().c.rations = 0;
    getState().c.wp = 1;
    getState().steps = 99; // the 100th step below trips newDay()
    const { events } = dispatch({ type: "move", dir });
    assert.ok(getState().dead, "the character starved out via the day-tick upkeep");
    assert.ok(events.some((e) => e.type === "died" && e.cause === "starve"));

    await waitForPending();
    await flushStorage();
    assertDepth10RanksAboveDepth9(store, depth9Hash);
  });
});

// --- path 4: abandon ----------------------------------------------------------

test("BOARD-15 abandon death path: a depth-10 voluntary abandon ranks above the seeded depth-9 run", async () => {
  await withFakeLocalStorage(async (store) => {
    await loadBests();
    await loadGraveyard();
    const depth9Hash = await seedDepth9(910400);

    await startNewRun(910401);
    getState().floor.depth = 10;
    dispatch({ type: "abandon" });
    assert.ok(getState().dead, "abandon killed the run");

    await waitForPending();
    await flushStorage();
    assertDepth10RanksAboveDepth9(store, depth9Hash);
  });
});

// --- path 5: a resumed save ---------------------------------------------------

test("BOARD-15 resumed-save death path: writing a live depth-10 run to ddr.delve.v1, boot()'s rehydrate path, then abandon, ranks above the seeded depth-9 run", async () => {
  await withFakeLocalStorage(async (store) => {
    await loadBests();
    await loadGraveyard();
    const depth9Hash = await seedDepth9(910500);

    await startNewRun(910501);
    getState().floor.depth = 10;
    store.setItem(SAVE_KEY, JSON.stringify(serializeRun(getState())));

    await boot(910502); // the rehydrate path: SAVE_KEY already holds a live depth-10 run
    assert.equal(getState().floor.depth, 10, "boot() rehydrated the depth-10 save rather than starting fresh");
    assert.equal(getState().dead, false, "the rehydrated run is not yet dead");
    dispatch({ type: "abandon" });
    assert.ok(getState().dead, "abandon on the resumed run killed it");

    await waitForPending();
    await flushStorage();
    assertDepth10RanksAboveDepth9(store, depth9Hash);
  });
});

// --- path 6: a relaunch after death -------------------------------------------

test("BOARD-15 relaunch-after-death path: dying at depth 10, draining the writes, then boot() again still ranks it above the seeded depth-9 run", async () => {
  await withFakeLocalStorage(async (store) => {
    await loadBests();
    await loadGraveyard();
    const depth9Hash = await seedDepth9(910600);

    await startNewRun(910601);
    getState().floor.depth = 10;
    dispatch({ type: "abandon" });
    assert.ok(getState().dead, "the depth-10 run died before the relaunch");

    await waitForPending();
    await flushStorage();

    await boot(910602); // the relaunch: a fresh module-level load from storage, mid-process
    assertDepth10RanksAboveDepth9(store, depth9Hash);
  });
});

// --- extra pin 1: replaying an identical hash is a no-op ---------------------

test("BOARD-15 extra pin (H-15d): replaying updateBests with the identical run summary hash leaves exactly one entry", () => {
  const summary = {
    name: "Echo", race: "Human", sub: "Soldier", cls: "Fighter",
    level: 3, sp: 40, floor: 6, day: 4, steps: 300, gold: 100, kills: 5,
    cause: "combat", note: "died", epitaph: "Rest.", when: 111,
    season: 1, seed: 999, acts: 10,
  };
  summary.hash = runHash(summary);

  const once = updateBests(emptyBests(), summary).record;
  const replayed = updateBests(once, summary);
  assert.deepStrictEqual(replayed.record, once, "replaying the identical hash changes nothing");
  assert.deepStrictEqual(replayed.newBests, [], "a replayed identical run announces no new bests");
  assert.equal(Object.keys(once.runs).length, 1, "only one entry is held for the one distinct hash");
});

// --- extra pin 2: the exact device sequence, end to end -----------------------

test("BOARD-15 extra pin (device sequence): depth 9 then depth 10 by abandon, then a relaunch via boot(), matches the device report's own ordering", async () => {
  await withFakeLocalStorage(async (store) => {
    await loadBests();
    await loadGraveyard();

    await startNewRun(910700);
    getState().floor.depth = 9;
    dispatch({ type: "abandon" });
    const depth9Hash = getBests().last;
    await waitForPending();
    await flushStorage();

    await startNewRun(910701);
    getState().floor.depth = 10;
    dispatch({ type: "abandon" });
    await waitForPending();
    await flushStorage();

    await boot(910702); // relaunch: exactly the device's "closed the app, came back" step

    const bests = getBests();
    const graves = getGraveyard().graves;
    assert.equal(bests.boards.deep[0], bests.last, "the freshly relaunched record's DEEPEST #1 is the depth-10 run");
    assert.equal(graves[0].hash, bests.boards.deep[0], "the Graveyard's newest stone is the SAME run DEEPEST #1 points to");
    assert.notEqual(bests.boards.deep[0], depth9Hash, "the depth-9 run was displaced from #1");
  });
});
