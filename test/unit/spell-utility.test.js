// test/unit/spell-utility.test.js
//
// Phase 40 Plan 03 (SPELL-02/SPELL-07) — utility spell visibility + the
// scroll scribing fix, written FIRST (RED) per the plan's own TDD
// instruction. Copies test/unit/magic.test.js's/combat.test.js's fakeRng/
// fixedState/fixedFoe/fixedCombat helpers verbatim (same discipline).
//
// SPELL-02 (Task 1, this section): Mirror Self, Sense Presence,
// Regeneration, and an armed Sense Danger each get a `conditionsOf` chip
// (mirror/senses/regen/foresight, fixed order after ward, before flight);
// Sense Presence's "never surprised" gets a real initiative-side effect
// (waives every forced foe-first rule while `c.senses` is up) and endCombat
// narrates the expiry of a still-running mirror/senses/regen when the fight
// ends.
//
// SPELL-07 (Task 2): appended below by Task 2's own TDD pass.

import test from "node:test";
import assert from "node:assert/strict";

import { conditionsOf } from "../../engine/derived.js";
import { rollInitiative, fight, endCombat } from "../../engine/combat.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { TOAST_FOR } from "../../src/browser/toasts.js";
import { RAIL_FAMILY } from "../../src/browser/rail.js";

function fixedChar(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
    maxWP: 55, wp: 55, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 1, rations: 6, gold: 50, scrolls: 1,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    darkFor: 0, flightLeft: 0, flightCooldown: 0,
    ...overrides,
  };
}

function fixedFloor(overrides = {}) {
  const g = [];
  for (let y = 0; y < 3; y++) {
    g.push([]);
    for (let x = 0; x < 3; x++) g[y].push({ wall: false, dark: false, seen: true, feat: null });
  }
  return { g, px: 1, py: 1, depth: 1, ...overrides };
}

function fixedState(overrides = {}) {
  const { c: cOverrides, floor: floorOverrides, ...rest } = overrides;
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedChar(cOverrides),
    floor: fixedFloor(floorOverrides),
    day: 1, steps: 0, combat: null, store: null, beats: null,
    dead: false, won: false, deathNote: "", epitaph: "",
    ...rest,
  };
}

function fixedFoe(overrides = {}) {
  return {
    name: "Target", type: "Beasts", lvl: 1, size: "S", intel: 1,
    wp: 10, maxWP: 10, alive: true, asleep: 0, sp: {}, lives: 1,
    ...overrides,
  };
}

function fixedCombat(foes, overrides = {}) {
  return { foes, type: foes[0]?.type || "Beasts", round: 1, target: 0, spellOpen: false, tracked: false, ...overrides };
}

// ============================================================================
// SPELL-02: conditionsOf chips — mirror / senses / regen / foresight
// ============================================================================

test("conditionsOf: mirror surfaces {remaining} when c.mirror > 0, absent at 0", () => {
  assert.deepStrictEqual(conditionsOf({ c: fixedChar({ mirror: 4 }) }), [
    { key: "mirror", polarity: "good", remaining: 4 },
  ]);
  assert.deepStrictEqual(conditionsOf({ c: fixedChar({ mirror: 0 }) }), []);
});

test("conditionsOf: senses is a flat boolean chip (no remaining) when c.senses is truthy, absent at 0/undefined", () => {
  assert.deepStrictEqual(conditionsOf({ c: fixedChar({ senses: 1 }) }), [{ key: "senses", polarity: "good" }]);
  assert.deepStrictEqual(conditionsOf({ c: fixedChar({ senses: 0 }) }), []);
  assert.deepStrictEqual(conditionsOf({ c: fixedChar() }), []); // senses key absent entirely
});

test("conditionsOf: regen is a flat boolean chip when c.regen is true, absent when false", () => {
  assert.deepStrictEqual(conditionsOf({ c: fixedChar({ regen: true }) }), [{ key: "regen", polarity: "good" }]);
  assert.deepStrictEqual(conditionsOf({ c: fixedChar({ regen: false }) }), []);
});

test("conditionsOf: foresight is a flat boolean chip when c.foresight is true (an ARMED Sense Danger), absent when false", () => {
  assert.deepStrictEqual(conditionsOf({ c: fixedChar({ foresight: true }) }), [{ key: "foresight", polarity: "good" }]);
  assert.deepStrictEqual(conditionsOf({ c: fixedChar({ foresight: false }) }), []);
});

test("conditionsOf: fixed order — ward, mirror, senses, regen, foresight, then flight", () => {
  const c = fixedChar({
    ward: { pool: 50, rounds: 5, name: "Shield" },
    mirror: 4,
    senses: 1,
    regen: true,
    foresight: true,
    items: [{ n: "Bracelet of Flight" }],
  });
  const conds = conditionsOf({ c });
  assert.deepStrictEqual(
    conds.map((x) => x.key),
    ["ward", "mirror", "senses", "regen", "foresight", "flight"],
  );
});

test("conditionsOf: none of the four utility chips flash for a bare/fully-inert character", () => {
  assert.deepStrictEqual(conditionsOf({ c: fixedChar() }), []);
});

test("conditionsOf: is a PURE read — no mutation, no rng — with all four utility fields live", () => {
  const c = fixedChar({ mirror: 3, senses: 1, regen: true, foresight: true });
  const before = JSON.stringify(c);
  const conds = conditionsOf({ c }); // no rng object passed at all — a draw would throw here
  assert.equal(JSON.stringify(c), before, "conditionsOf must not mutate the character");
  assert.equal(conds.length, 4);
});

// ============================================================================
// SPELL-02: rollInitiative — Sense Presence waives every forced foe-first rule
// ============================================================================

test("rollInitiative: a Samurai with c.senses up rolls normally — the higher d20 wins, forced foe-first is waived", () => {
  const state = fixedState({ c: { sub: "Samurai", senses: 1 } });
  state.combat = fixedCombat([]);
  assert.equal(rollInitiative(state, fakeRng([10, 1])), "you", "mine(10) >= theirs(1) — a normal win, no longer forced foe");

  const state2 = fixedState({ c: { sub: "Samurai", senses: 1 } });
  state2.combat = fixedCombat([]);
  assert.equal(rollInitiative(state2, fakeRng([1, 10])), "foe", "mine(1) < theirs(10) — still a fair loss, not a forced one");
});

test("rollInitiative: a Samurai with c.senses = 0 (or absent) is still forced foe — the existing pin is unaffected", () => {
  const state = fixedState({ c: { sub: "Samurai", senses: 0 } });
  state.combat = fixedCombat([]);
  assert.equal(rollInitiative(state, fakeRng([10, 1])), "foe", "the two d20s are still drawn even though the result is forced");

  const state2 = fixedState({ c: { sub: "Samurai" } }); // senses key entirely absent
  state2.combat = fixedCombat([]);
  assert.equal(rollInitiative(state2, fakeRng([19, 1])), "foe");
});

test("rollInitiative: c.senses waives Fridgian slow, Knight-vs-big-foe, and Court Mage round 1 identically", () => {
  const fridgian = fixedState({ c: { race: "Fridgian", senses: 1 } });
  fridgian.combat = fixedCombat([]);
  assert.equal(rollInitiative(fridgian, fakeRng([15, 3])), "you");

  const knight = fixedState({ c: { sub: "Knight", senses: 1 } });
  knight.combat = fixedCombat([fixedFoe({ maxWP: 30 })]); // a big foe would normally force "foe"
  assert.equal(rollInitiative(knight, fakeRng([15, 3])), "you");

  const courtMage = fixedState({ c: { sub: "Court Mage", senses: 1 } });
  courtMage.combat = fixedCombat([], { round: 1 });
  assert.equal(rollInitiative(courtMage, fakeRng([15, 3])), "you");
});

test("rollInitiative: a foreseen character still always goes first, senses or not", () => {
  const state = fixedState({ c: { sub: "Samurai", foresight: true, senses: 0 } });
  state.combat = fixedCombat([]);
  assert.equal(rollInitiative(state, fakeRng([1, 10])), "you");
  assert.equal(state.c.foresight, false, "foresight is still consumed by the roll");
});

// ============================================================================
// SPELL-02: fight()'s combatJoined.senses — additive, only when senses
// decided the win
// ============================================================================

test("fight: combatJoined carries senses:true only when c.senses is up AND first === \"you\"", () => {
  const state = fixedState({ c: { senses: 1 } });
  state.combat = fixedCombat([fixedFoe({ type: "Beasts" })], { pending: true });
  const events = fight(state, fakeRng([15, 10]), []); // mine(15) >= theirs(10) -> "you"
  const joined = events.find((e) => e.type === "combatJoined");
  assert.deepStrictEqual(joined, { type: "combatJoined", first: "you", senses: true });
});

test("fight: combatJoined stays the plain byte-identical shape when c.senses is 0", () => {
  const state = fixedState({ c: { senses: 0 } });
  state.combat = fixedCombat([fixedFoe({ type: "Beasts" })], { pending: true });
  const events = fight(state, fakeRng([15, 10]), []);
  const joined = events.find((e) => e.type === "combatJoined");
  assert.deepStrictEqual(joined, { type: "combatJoined", first: "you" });
  assert.ok(!("senses" in joined));
});

test("fight: combatJoined carries no senses key when senses is up but the foe still wins the roll", () => {
  const state = fixedState({ c: { senses: 1 } });
  state.combat = fixedCombat([fixedFoe({ type: "Beasts" })], { pending: true });
  // mine(1) < theirs(10) -> "foe"; foeTurn then runs (one swing at need>=1 miss, roll=20).
  const events = fight(state, fakeRng([1, 10, 20]), []);
  const joined = events.find((e) => e.type === "combatJoined");
  assert.deepStrictEqual(joined, { type: "combatJoined", first: "foe" });
});

// ============================================================================
// SPELL-02: endCombat — regenFaded / sensesFaded / mirrorFaded expiry
// narration for a still-running effect
// ============================================================================

test("endCombat: a still-regenerating character narrates regenFaded and only regenFaded", () => {
  const state = fixedState({ c: { regen: true } });
  state.combat = fixedCombat([]);
  const events = endCombat(state, []);
  assert.ok(events.some((e) => e.type === "regenFaded"));
  assert.equal(events.some((e) => e.type === "sensesFaded"), false);
  assert.equal(events.some((e) => e.type === "mirrorFaded"), false);
  assert.equal(state.c.regen, false);
});

test("endCombat: a still-sensing character narrates sensesFaded and only sensesFaded", () => {
  const state = fixedState({ c: { senses: 1 } });
  state.combat = fixedCombat([]);
  const events = endCombat(state, []);
  assert.ok(events.some((e) => e.type === "sensesFaded"));
  assert.equal(events.some((e) => e.type === "regenFaded"), false);
  assert.equal(events.some((e) => e.type === "mirrorFaded"), false);
  assert.equal(state.c.senses, 0);
});

test("endCombat: a still-running mirror narrates mirrorFaded when the fight ends", () => {
  const state = fixedState({ c: { mirror: 3 } });
  state.combat = fixedCombat([]);
  const events = endCombat(state, []);
  assert.ok(events.some((e) => e.type === "mirrorFaded"));
  assert.equal(events.some((e) => e.type === "regenFaded"), false);
  assert.equal(events.some((e) => e.type === "sensesFaded"), false);
  assert.equal(state.c.mirror, 0);
});

test("endCombat: a bare character (all zero/false) pushes NONE of the three expiry events — existing pins hold", () => {
  const state = fixedState();
  state.combat = fixedCombat([]);
  const events = endCombat(state, []);
  assert.equal(events.some((e) => ["regenFaded", "sensesFaded", "mirrorFaded"].includes(e.type)), false);
  assert.ok(events.some((e) => e.type === "combatEnded"));
  assert.equal(state.c.senses, 0, "the prototype's own side effect — added even to a character that never had it");
});

test("endCombat: all three live at once — narrates in order regenFaded, sensesFaded, mirrorFaded, before combatEnded", () => {
  const state = fixedState({ c: { regen: true, senses: 1, mirror: 5 } });
  state.combat = fixedCombat([]);
  const events = endCombat(state, []);
  const types = events.map((e) => e.type);
  assert.deepStrictEqual(types, ["regenFaded", "sensesFaded", "mirrorFaded", "combatEnded"]);
});

// ============================================================================
// SPELL-02: narration coverage (EVENT_NARRATION / TOAST_FOR / RAIL_FAMILY)
// ============================================================================

test("narration: sensesFaded / regenFaded render non-empty text in all three tables", () => {
  assert.ok(EVENT_NARRATION.sensesFaded({ type: "sensesFaded" }).length > 0);
  assert.ok(EVENT_NARRATION.regenFaded({ type: "regenFaded" }).length > 0);
  assert.ok(TOAST_FOR.sensesFaded({ type: "sensesFaded" }).text.length > 0);
  assert.ok(TOAST_FOR.regenFaded({ type: "regenFaded" }).text.length > 0);
  assert.ok(RAIL_FAMILY.sensesFaded && RAIL_FAMILY.sensesFaded.title.length > 0);
  assert.ok(RAIL_FAMILY.regenFaded && RAIL_FAMILY.regenFaded.title.length > 0);
});

test("narration: combatJoined{senses:true} names Sense Presence's payoff; a plain win keeps the old wording", () => {
  const withSenses = EVENT_NARRATION.combatJoined({ type: "combatJoined", first: "you", senses: true });
  const plain = EVENT_NARRATION.combatJoined({ type: "combatJoined", first: "you" });
  assert.ok(withSenses.includes("Nothing gets the jump on you"));
  assert.ok(!plain.includes("Nothing gets the jump on you"));
  const toastWithSenses = TOAST_FOR.combatJoined({ type: "combatJoined", first: "you", senses: true });
  assert.ok(toastWithSenses.text.includes("Nothing gets the jump on you"));
});

/** fakeRng(seq) — verbatim copy of test/unit/combat.test.js's helper: `.d()`
 * pops the next value off `seq` regardless of requested sides; throws if the
 * sequence underflows (doubles as a "no more draws expected" assertion). */
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
