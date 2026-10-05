// test/unit/achievement-engine-facts.test.js
//
// Phase 99 (TRACK-01) -- the two additive engine facts the achievements need,
// and the proof that nothing else moved.
//
//   * foeKilled.group -- the BESTIARY family key of the foe that died (the
//     foe's own `type`). The six Body Count tracks count kills per family; the
//     event carries only a name, and an elite's name is titled ("Dread Ogre"),
//     so a name lookup would be fragile.
//   * afflictionCaught.wp / afflictionTick.wp -- the hero's HP right after that
//     hit, for Terminal Condition ("exactly 1 HP after a Disease or Poison
//     hit"). The state after the whole action is wrong whenever something else
//     in the same action also moves HP.
//
// Both fields are event-only: they never land in GameState, so the parity
// comparables (which take GameState) need no carve-out. The last test walks
// the serialized run to prove it. The draw-count pins below were MEASURED AT
// THE BASE COMMIT (c0535a54) before any engine edit and must still pass after
// it: the fields read `f.type` and `c.wp`, values already held, and draw no
// dice.

import test from "node:test";
import assert from "node:assert/strict";

import { makeRng } from "../../engine/rng.js";
import { newRun } from "../../engine/state.js";
import { serializeRun } from "../../engine/saveState.js";
import { killFoe } from "../../engine/combat.js";
import { catchAffliction } from "../../engine/encounters.js";
import { move } from "../../engine/movement.js";
import { buildReinforcement } from "../../engine/foeAbilities.js";
import { GW, GH } from "../../engine/maze.js";
import { BESTIARY, ENC_TYPES } from "../../content/bestiary.js";
import { setIdentityDials } from "./harness/identityDials.js";

setIdentityDials();

// --- helpers (copied from water-cost.test.js / encounters.test.js) -----------

/** fakeRng(seq) -- `.d()` pops the next value off `seq`; throws on underflow. */
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

/** countingRng(seed) -- a real seeded rng whose every draw is counted. */
function countingRng(seed) {
  const inner = makeRng(seed);
  const counts = { d: 0, pick: 0, shuffle: 0, next: 0 };
  const rng = {
    d: (n) => { counts.d++; return inner.d(n); },
    pick: (a) => { counts.pick++; return inner.pick(a); },
    shuffle: (a) => { counts.shuffle++; return inner.shuffle(a); },
    next: () => { counts.next++; return inner.next(); },
    getState: () => inner.getState(),
    setState: (s) => inner.setState(s),
  };
  return { rng, counts, total: () => counts.d + counts.pick + counts.shuffle + counts.next };
}

function wallGrid() {
  const g = [];
  for (let y = 0; y < GH; y++) {
    g.push([]);
    for (let x = 0; x < GW; x++) g[y].push({ wall: true, seen: false, feat: null });
  }
  return g;
}

function open(g, x, y, extra = {}) {
  g[y][x] = { wall: false, seen: false, feat: null, ...extra };
}

function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
    maxWP: 55, wp: 55, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 1, rations: 6, gold: 50, scrolls: 0,
    affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    darkFor: 0,
    ...overrides,
  };
}

function fixedState(overrides = {}) {
  const { c: cOverrides, floor: floorOverrides, ...rest } = overrides;
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedFighter(cOverrides),
    floor: { g: wallGrid(), px: 5, py: 5, depth: 1, ...floorOverrides },
    day: 1, steps: 0, combat: null, store: null, beats: null,
    dead: false, deathNote: "", epitaph: "",
    ...rest,
  };
}

/** A 1-HP foe literal of `type` (the E9 recipe's shape in engineAdapter.test.js). */
function foeOf(type, overrides = {}) {
  const row = BESTIARY[type][0][0];
  return {
    name: row.n, type, lvl: 1, size: row.sz, intel: row.i,
    wp: 1, maxWP: 1, alive: true, asleep: 0, sp: row.sp || {}, lives: 1,
    ...overrides,
  };
}

/** A run whose combat holds `foes`, in a fight of `fightType`. */
function fightState(foes, fightType = foes[0].type) {
  const state = newRun(1234);
  state.combat = { foes, type: fightType, round: 1, target: 0, spellOpen: false, tracked: false };
  return state;
}

/** Deep-walk `root`; fail if any nested object is one of the three events. */
function assertNoEventInside(root, label) {
  const BANNED = new Set(["foeKilled", "afflictionCaught", "afflictionTick"]);
  const seen = new Set();
  const walk = (node, path) => {
    if (!node || typeof node !== "object" || seen.has(node)) return;
    seen.add(node);
    if (!Array.isArray(node) && BANNED.has(node.type)) {
      assert.fail(`${label}: a ${node.type} object is stored in GameState at ${path}`);
    }
    for (const k of Object.keys(node)) walk(node[k], `${path}.${k}`);
  };
  walk(root, "state");
}

// --- draw-count pins (measured at BASE c0535a54, before the engine edit) -----

const POISON_PER_1 = { kind: "Poison", per: 1, loss: { n: 1, sides: 6, bonus: 0 }, left: 5 };

test("pin: killFoe over one foe of each of the six families draws the base number of dice", () => {
  const { rng, counts, total } = countingRng(7);
  let cursor;
  for (const type of ENC_TYPES) {
    const foe = foeOf(type);
    const state = fightState([foe]);
    killFoe(state, foe, rng, []);
    cursor = rng.getState();
  }
  assert.deepStrictEqual(counts, DRAW_PINS.killFoe.counts, "per-method draw counts");
  assert.equal(total(), DRAW_PINS.killFoe.total);
  assert.equal(cursor, DRAW_PINS.killFoe.cursor, "the rng cursor ends where base ends");
});

test("pin: catchAffliction (seed 11, 40-HP hero) draws the base number of dice", () => {
  const { rng, counts, total } = countingRng(11);
  const state = fixedState({ c: { wp: 40 } });
  catchAffliction(state, rng, []);
  assert.deepStrictEqual(counts, DRAW_PINS.catchAffliction.counts);
  assert.equal(total(), DRAW_PINS.catchAffliction.total);
  assert.equal(rng.getState(), DRAW_PINS.catchAffliction.cursor);
});

test("pin: one affliction-ticking water step (seed 5) draws the base number of dice", () => {
  const { rng, counts, total } = countingRng(5);
  const state = fixedState({ c: { affliction: { ...POISON_PER_1 }, wp: 55 } });
  open(state.floor.g, 5, 4, { water: true });
  move(state, "N", rng, []);
  assert.deepStrictEqual(counts, DRAW_PINS.waterTick.counts);
  assert.equal(total(), DRAW_PINS.waterTick.total);
  assert.equal(rng.getState(), DRAW_PINS.waterTick.cursor);
});

// --- foeKilled.group ---------------------------------------------------------

for (const type of ["Beasts", "Demons", "Humans", "Lair Beasts", "Magical", "Walking Dead"]) {
  test(`foeKilled.group: a ${type} foe reports group "${type}"`, () => {
    const foe = foeOf(type);
    const state = fightState([foe]);
    const events = killFoe(state, foe, makeRng(7), []);
    const killed = events.filter((e) => e.type === "foeKilled");
    assert.equal(killed.length, 1);
    assert.equal(killed[0].group, type);
    assert.equal(killed[0].name, foe.name, "existing keys are untouched");
    assert.ok(Number.isInteger(killed[0].spGained));
    assertNoEventInside(serializeRun(state), type);
  });
}

test("foeKilled.group: every foe family in ENC_TYPES is covered by a BESTIARY key", () => {
  assert.deepStrictEqual([...ENC_TYPES].sort(), Object.keys(BESTIARY).sort());
  assert.equal(ENC_TYPES.length, 6);
});

test("foeKilled.group: a Demons reinforcement killed in a Beasts fight reports Demons, not Beasts", () => {
  const beast = foeOf("Beasts", { wp: 50, maxWP: 50 });
  const reinforcement = { ...buildReinforcement("Demons", 1, makeRng(3)), wp: 1, maxWP: 1 };
  assert.equal(reinforcement.type, "Demons");
  const state = fightState([beast, reinforcement], "Beasts");
  const events = killFoe(state, reinforcement, makeRng(7), []);
  const killed = events.filter((e) => e.type === "foeKilled");
  assert.equal(killed.length, 1);
  assert.equal(killed[0].group, "Demons");
  assert.equal(state.combat.type, "Beasts", "the fight keeps its own family");
});

test("foeKilled.group: a Petrify kill (spoils false) carries the foe's group", () => {
  const foe = foeOf("Magical");
  const state = fightState([foe]);
  const events = killFoe(state, foe, makeRng(7), [], { spoils: false });
  const killed = events.filter((e) => e.type === "foeKilled");
  assert.equal(killed.length, 1);
  assert.equal(killed[0].group, "Magical");
});

test("foeKilled.group: a kill-twice foe's first death is foeRevived (no foeKilled), its second carries the group", () => {
  const foe = foeOf("Walking Dead", { lives: 2 });
  const state = fightState([foe]);
  const first = killFoe(state, foe, makeRng(7), []);
  assert.ok(first.some((e) => e.type === "foeRevived"));
  assert.ok(!first.some((e) => e.type === "foeKilled"), "no foeKilled on the first death");
  foe.wp = 1;
  const second = killFoe(state, foe, makeRng(8), []);
  const killed = second.filter((e) => e.type === "foeKilled");
  assert.equal(killed.length, 1);
  assert.equal(killed[0].group, "Walking Dead");
});

test("foeKilled.group: two kills in one action emit two foeKilled events, each with its own group", () => {
  const a = foeOf("Beasts");
  const b = foeOf("Demons");
  const state = fightState([a, b], "Beasts");
  const rng = makeRng(7);
  const events = [];
  killFoe(state, a, rng, events);
  killFoe(state, b, rng, events);
  const killed = events.filter((e) => e.type === "foeKilled");
  assert.deepStrictEqual(killed.map((e) => e.group), ["Beasts", "Demons"]);
});

test("foeKilled.group: foeKilled keeps its position -- spGained then spoils, group is just an extra key", () => {
  const foe = foeOf("Humans");
  const state = fightState([foe]);
  const events = killFoe(state, foe, makeRng(7), []);
  const idx = events.findIndex((e) => e.type === "foeKilled");
  assert.equal(idx, 0, "foeKilled is still the first event killFoe pushes");
  assert.deepStrictEqual(Object.keys(events[idx]), ["type", "name", "spGained", "group"]);
});

// --- afflictionCaught.wp -----------------------------------------------------

test("afflictionCaught.wp: the first hit on a 40-HP hero leaves 33, equal to state.c.wp", () => {
  const state = fixedState({ c: { wp: 40 } });
  const events = catchAffliction(state, fakeRng([1, 10, 3, 4]), []);
  const caught = events.filter((e) => e.type === "afflictionCaught");
  assert.equal(caught.length, 1);
  assert.equal(caught[0].first, 7);
  assert.equal(caught[0].wp, 33);
  assert.equal(caught[0].wp, state.c.wp);
  assert.equal(caught[0].kind, "Poison");
  assertNoEventInside(serializeRun(state), "afflictionCaught");
});

test("afflictionCaught.wp: a hit clamped to leave the hero on 1 HP reports exactly 1", () => {
  const state = fixedState({ c: { wp: 5 } });
  const events = catchAffliction(state, fakeRng([1, 10, 6, 6]), []);
  const caught = events.find((e) => e.type === "afflictionCaught");
  assert.equal(caught.first, 4, "2d6 = 12 clamped to wp - 1");
  assert.equal(caught.wp, 1);
  assert.equal(state.c.wp, 1);
});

test("afflictionCaught.wp: a phobia row emits no afflictionCaught", () => {
  const state = fixedState({ c: { wp: 40 } });
  const events = catchAffliction(state, fakeRng([5, 3]), []);
  assert.ok(!events.some((e) => e.type === "afflictionCaught"));
});

// --- afflictionTick.wp -------------------------------------------------------

test("afflictionTick.wp: a per:1 Poison on a water step ticks twice, each tick with its own post-hit HP", () => {
  const state = fixedState({ c: { affliction: { ...POISON_PER_1 }, wp: 55 } });
  open(state.floor.g, 5, 4, { water: true });
  const events = move(state, "N", fakeRng([3, 4]), []);
  const ticks = events.filter((e) => e.type === "afflictionTick");
  assert.equal(ticks.length, 2);
  assert.deepStrictEqual(ticks.map((e) => e.loss), [3, 4]);
  assert.deepStrictEqual(ticks.map((e) => e.wp), [52, 48]);
  assert.equal(ticks[1].wp, state.c.wp);
  assertNoEventInside(serializeRun(state), "afflictionTick");
});

test("afflictionTick.wp: a tick clamped to leave the hero on 1 HP reports exactly 1", () => {
  const state = fixedState({ c: { affliction: { ...POISON_PER_1 }, wp: 3 } });
  open(state.floor.g, 5, 4, { water: true });
  const events = move(state, "N", fakeRng([6, 5]), []);
  const ticks = events.filter((e) => e.type === "afflictionTick");
  assert.equal(ticks.length, 1);
  assert.equal(ticks[0].loss, 2, "rolled 6 clamped to wp - 1");
  assert.equal(ticks[0].wp, 1);
  assert.equal(state.c.wp, 1);
});

test("afflictionTick.wp: a tick that would take 0 HP still emits afflictionPassed and no afflictionTick", () => {
  const state = fixedState({ c: { affliction: { ...POISON_PER_1 }, wp: 1 } });
  open(state.floor.g, 5, 4, { water: true });
  const events = move(state, "N", fakeRng([5]), []);
  assert.equal(events.filter((e) => e.type === "afflictionTick").length, 0);
  assert.equal(events.filter((e) => e.type === "afflictionPassed").length, 1);
});

test("afflictionTick.wp: the event order of a ticking step is unchanged (moved, waded, then the tick)", () => {
  const state = fixedState({ c: { affliction: { ...POISON_PER_1 }, wp: 55 } });
  open(state.floor.g, 5, 4, { water: true });
  const events = move(state, "N", fakeRng([3, 4]), []);
  const order = events.map((e) => e.type);
  assert.ok(order.indexOf("moved") < order.indexOf("afflictionTick"));
  assert.deepStrictEqual(Object.keys(events.find((e) => e.type === "afflictionTick")), ["type", "kind", "loss", "wp"]);
});

// --- the three events never live inside GameState -----------------------------

test("no foeKilled, afflictionCaught or afflictionTick object is stored anywhere in GameState (comparables need no carve-out)", () => {
  const foe = foeOf("Beasts");
  const state = fightState([foe]);
  const events = [];
  killFoe(state, foe, makeRng(7), events);
  state.c.wp = 40;
  catchAffliction(state, fakeRng([1, 10, 3, 4]), events);
  assert.ok(events.some((e) => e.type === "foeKilled"));
  assert.ok(events.some((e) => e.type === "afflictionCaught"));
  assertNoEventInside(serializeRun(state), "combined");
  assertNoEventInside(JSON.parse(JSON.stringify(serializeRun(state))), "combined JSON round-trip");
});

// --- pinned numbers (measured at BASE c0535a54) ------------------------------

const DRAW_PINS = {
  killFoe: { counts: { d: 20, pick: 0, shuffle: 0, next: 0 }, total: 20, cursor: -2023389397 },
  catchAffliction: { counts: { d: 2, pick: 0, shuffle: 0, next: 0 }, total: 2, cursor: -631835659 },
  waterTick: { counts: { d: 2, pick: 0, shuffle: 0, next: 0 }, total: 2, cursor: -631835665 },
};
