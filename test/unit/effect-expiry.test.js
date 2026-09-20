// test/unit/effect-expiry.test.js
//
// CMB-05 (Phase 31, Plan 02) — the Acuteness headline fix, superseded by
// Phase 39 (GEAR-02): c.acute is RETIRED — Acuteness is now a rounds-cadence
// `c.timers["item:Acuteness"]` record, ticked ONLY in foeTurn's tail (never
// per exploration step — a deliberate accepted behavior change, see
// docs/GEAR-BALANCE.md) and cleared unconditionally (silently, no event) at
// endCombat by clearRoundTimers, mirroring ward/mirror/regen/senses. Also
// pins the foeTurn tail's tick order (ward -> mirror -> foeEffect -> afraid
// -> the c.timers rounds tick LAST) and that every OTHER timed effect's
// existing tick/clear behavior is untouched by this plan.

import test from "node:test";
import assert from "node:assert/strict";

import { foeTurn, endCombat } from "../../engine/combat.js";
import { move, newDay } from "../../engine/movement.js";
import { GW, GH } from "../../engine/maze.js";
import { makeRng } from "../../engine/rng.js";

/** fakeRng(seq) — verbatim copy of the established unit-test helper. */
function fakeRng(seq, { pick = (arr) => arr[0] } = {}) {
  let i = 0;
  return {
    d(_sides) {
      if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick,
    shuffle: (a) => a,
  };
}

function countingRng(inner) {
  let draws = 0;
  return {
    d(sides) {
      draws++;
      return inner.d(sides);
    },
    pick(...args) {
      draws++;
      return inner.pick(...args);
    },
    shuffle: (...args) => inner.shuffle(...args),
    get draws() {
      return draws;
    },
  };
}

function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
    maxWP: 55, wp: 55, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 0, rations: 6, gold: 50, scrolls: 0,
    affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    darkFor: 0,
    ...overrides,
  };
}

function wallGrid() {
  const g = [];
  for (let y = 0; y < GH; y++) {
    g.push([]);
    for (let x = 0; x < GW; x++) g[y].push({ wall: true, dark: false, seen: false, feat: null });
  }
  return g;
}
function open(g, x, y, extra = {}) {
  g[y][x] = { wall: false, dark: false, seen: false, feat: null, ...extra };
}

function fixedState(overrides = {}) {
  const { c: cOverrides, floor: floorOverrides, ...rest } = overrides;
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedFighter(cOverrides),
    floor: { g: wallGrid(), px: 5, py: 5, depth: 1, ...floorOverrides },
    day: 1, steps: 0, combat: null, store: null, beats: null,
    dead: false, deathNote: "", epitaph: "",
    party: [], pendingJoiner: null, pendingFind: null,
    ...rest,
  };
}

function fixedFoe(overrides = {}) {
  return { name: "Target", type: "Humans", lvl: 1, size: "S", intel: 1, wp: 100, maxWP: 100, alive: true, asleep: 0, sp: {}, lives: 1, ...overrides };
}
function fixedCombat(foes, overrides = {}) {
  return { foes, type: foes[0]?.type || "Humans", round: 1, target: 0, spellOpen: false, tracked: false, ...overrides };
}

// --- foeTurn: once per round (Phase 39, GEAR-02: c.timers rounds-cadence) --

test("Acuteness 2 -> foeTurn -> 1, no itemEffectFaded", () => {
  const state = fixedState({ c: { timers: { "item:Acuteness": { cadence: "rounds", left: 2, phase: "effect" } } } });
  state.combat = fixedCombat([fixedFoe()]);
  const rng = countingRng(fakeRng([20])); // the foe's own swing misses (roll 20 vs need 5)
  const events = foeTurn(state, rng, []);
  assert.equal(state.c.timers["item:Acuteness"].left, 1);
  assert.equal(events.some((e) => e.type === "itemEffectFaded"), false);
  assert.equal(rng.draws, 1, "only the foe's swing — the timers tick is pure arithmetic");
});

test("Acuteness 1 -> foeTurn -> 0, exactly one itemEffectFaded", () => {
  const state = fixedState({ c: { timers: { "item:Acuteness": { cadence: "rounds", left: 1, phase: "effect" } } } });
  state.combat = fixedCombat([fixedFoe()]);
  const events = foeTurn(state, fakeRng([20]), []);
  assert.equal("item:Acuteness" in state.c.timers, false, "the record is deleted (no cd on a potion)");
  const faded = events.filter((e) => e.type === "itemEffectFaded");
  assert.equal(faded.length, 1);
  assert.deepStrictEqual(faded[0], { type: "itemEffectFaded", item: "Acuteness", kind: "acute" });
});

test("no c.timers key at all -> foeTurn -> no event; a character who never had it never gains it", () => {
  const state = fixedState({ c: {} }); // no `timers` key at all
  state.combat = fixedCombat([fixedFoe()]);
  const events = foeTurn(state, fakeRng([20]), []);
  assert.equal(events.some((e) => e.type === "itemEffectFaded"), false);
  assert.equal("timers" in state.c, false, "foeTurn never adds the key to a character that lacked it");
});

// --- endCombat: unconditional, SILENT clear (no event) ----------------------

test("endCombat with a live Acuteness record clears it silently (no itemEffectFaded)", () => {
  const state = fixedState({ c: { timers: { "item:Acuteness": { cadence: "rounds", left: 5, phase: "effect" } } } });
  state.combat = fixedCombat([fixedFoe()]);
  const events = endCombat(state, []);
  assert.equal("item:Acuteness" in state.c.timers, false);
  assert.equal(events.some((e) => e.type === "itemEffectFaded"), false, "clearRoundTimers narrates nothing");
});

test("endCombat with no c.timers key emits no event", () => {
  const state = fixedState({ c: {} });
  state.combat = fixedCombat([fixedFoe()]);
  const events = endCombat(state, []);
  assert.equal(events.some((e) => e.type === "itemEffectFaded"), false);
});

// --- move(): Phase 39 (GEAR-02) — Acuteness (rounds cadence) is UNTOUCHED
// --- by the exploration-step squares tick; it ticks ONLY in foeTurn --------

test("move() one step: a rounds-cadence Acuteness record is untouched (no squares tick reaches it)", () => {
  const state = fixedState({ c: { timers: { "item:Acuteness": { cadence: "rounds", left: 3, phase: "effect" } } } });
  open(state.floor.g, 5, 5);
  open(state.floor.g, 5, 4);
  const events = move(state, "N", fakeRng([]), []);
  assert.equal(state.c.timers["item:Acuteness"].left, 3, "rounds-cadence records never tick on a step");
  assert.equal(events.some((e) => e.type === "itemEffectFaded"), false);
});

// --- the foeTurn tail's tick order: ward -> mirror -> foeEffect -> afraid
// --- -> the shared c.timers rounds tick LAST (Phase 39, GEAR-02) ----------

test("foeTurn tail order: ward, mirror, foeEffect, afraid, then the c.timers rounds tick", () => {
  const state = fixedState({
    c: {
      ward: { pool: 1, rounds: 1, name: "X" },
      mirror: 1,
      foeEffect: { kind: "weakened", rounds: 1 },
      timers: { "item:Acuteness": { cadence: "rounds", left: 1, phase: "effect" } },
    },
  });
  state.combat = fixedCombat([fixedFoe()], { afraid: 1 });
  const events = foeTurn(state, fakeRng([20]), []); // the foe misses
  const types = events.map((e) => e.type);
  assert.deepStrictEqual(types, ["foeMissed", "wardFaded", "mirrorFaded", "foeEffectFaded", "fearPassed", "itemEffectFaded"]);
});

// --- every OTHER timed effect keeps its existing tick/clear behavior -------

test("ward/mirror/regen/senses still clear at endCombat, untouched by the acute addition", () => {
  const state = fixedState({ c: { ward: { pool: 10, rounds: 3, name: "Shield" }, mirror: 4, regen: true, senses: 1 } });
  state.combat = fixedCombat([fixedFoe()]);
  endCombat(state, []);
  assert.equal(state.c.ward, null);
  assert.equal(state.c.mirror, 0);
  assert.equal(state.c.regen, false);
  assert.equal(state.c.senses, 0);
});

test("Phase 39 (GEAR-02): a live squares-cadence item effect (haste) still ticks per step", () => {
  const state = fixedState({ c: { timers: { "item:Cloak of Speed": { cadence: "squares", left: 5, cd: 50, phase: "effect" } } } });
  open(state.floor.g, 5, 5);
  open(state.floor.g, 5, 4);
  move(state, "N", fakeRng([]), []);
  assert.equal(state.c.timers["item:Cloak of Speed"].left, 4);
});

test("might still clears only at newDay, unaffected by the acute addition", () => {
  const state = fixedState({ c: { might: 8, rations: 6 } });
  // newDay draws several rng values (rest heal, wandering-monster check, …)
  // whose exact count is not this test's concern — a real seeded rng avoids
  // hand-tracing them; only the might-clear behavior is under test.
  newDay(state, false, makeRng(1), []);
  assert.equal(state.c.might, 0);
});
