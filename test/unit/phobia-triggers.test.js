// test/unit/phobia-triggers.test.js
//
// Phase 41 (TERR-04/05) — the region-model phobia triggers: engine/
// phobias.js's checkTerrainPhobias/checkDeathPhobia/noteHeightsAttempt/
// resetFloorPhobiaRegions, wired into engine/movement.js's move()/teleport()/
// descend(). Task 1 covers the five triggers' fresh-entry/re-arm mechanics
// through movement/teleport/descend, using copies of test/unit/movement.
// test.js's own helpers (fakeRng/wallGrid/open/fixedFighter/fixedState) so
// this file stays independently readable. Task 2 (engine/combat.js#fight's
// fourth OR-condition, the fearArmed chip, in-combat Death) appends its own
// tests below Task 1's, in the same file.

import test from "node:test";
import assert from "node:assert/strict";

import { GW, GH } from "../../engine/maze.js";
import { move, teleport, descend } from "../../engine/movement.js";
import { makeRng } from "../../engine/rng.js";
import { fight, foeTurn, endCombat, playerStrike } from "../../engine/combat.js";
import { AFRAID_ROUNDS } from "../../engine/derived.js";
import { noteHeightsAttempt } from "../../engine/phobias.js";

/** fakeRng(seq) — verbatim copy of test/unit/movement.test.js's helper:
 * `.d()` pops the next value off `seq` regardless of requested side count;
 * `.pick(arr)` returns `arr[0]` unless a picker is supplied (and never
 * consumes `seq`); throws if the sequence underflows — a zero-rng proof for
 * every test that passes `fakeRng([])`. */
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

/** A minimal, fully-walled 21x21 grid (matches engine/maze.js's GW/GH) with
 * a hole punched wherever a test needs an open cell. */
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

// --- Bodies of water -------------------------------------------------------

test("water: fresh entry fires once, arms fearArmed, sets phobiaState true; a second step inside stays silent", () => {
  const state = fixedState({ c: { phobia: "Bodies of water", phobiaType: null } });
  open(state.floor.g, 5, 4, { water: true });
  open(state.floor.g, 5, 3, { water: true });
  const e1 = move(state, "N", fakeRng([]), []);
  assert.equal(e1.filter((e) => e.type === "phobiaTriggered").length, 1);
  assert.deepEqual(e1.find((e) => e.type === "phobiaTriggered"), { type: "phobiaTriggered", phobia: "Bodies of water", trigger: "water" });
  assert.deepEqual(state.c.fearArmed, { phobia: "Bodies of water", trigger: "water" });
  assert.equal(state.c.phobiaState["Bodies of water"], true);

  const e2 = move(state, "N", fakeRng([]), []);
  assert.ok(!e2.some((e) => e.type === "phobiaTriggered"), "water -> water stays silent");
});

test("water: leaving the pool sets the region false but leaves fearArmed set; re-entering fires again", () => {
  const state = fixedState({ c: { phobia: "Bodies of water", phobiaType: null } });
  open(state.floor.g, 5, 4, { water: true });
  open(state.floor.g, 5, 3, { water: true });
  open(state.floor.g, 5, 2); // dry
  move(state, "N", fakeRng([]), []); // (5,5)->(5,4) water: fires
  move(state, "N", fakeRng([]), []); // (5,4)->(5,3) water: silent
  move(state, "N", fakeRng([]), []); // (5,3)->(5,2) dry: region false, fearArmed untouched
  assert.equal(state.c.phobiaState["Bodies of water"], false);
  assert.deepEqual(state.c.fearArmed, { phobia: "Bodies of water", trigger: "water" }, "fearArmed survives leaving the region — only fight() consumes it");

  const e = move(state, "S", fakeRng([]), []); // (5,2)->(5,3) water again: fires again
  assert.ok(e.some((ev) => ev.type === "phobiaTriggered" && ev.trigger === "water"));
});

// --- Darkness ----------------------------------------------------------------

test("darkness: entering a .dark tile fires once; c.darkFor keeps the region active on a subsequent LIT tile", () => {
  const state = fixedState({ c: { phobia: "Darkness", phobiaType: null, darkFor: 5 } });
  open(state.floor.g, 5, 4); // a plain, lit cell — darkFor alone keeps inDark() true
  const e = move(state, "N", fakeRng([]), []);
  assert.ok(e.some((ev) => ev.type === "phobiaTriggered" && ev.trigger === "dark"));
  assert.equal(state.c.phobiaState["Darkness"], true);
});

test("darkness: Night Vision does NOT suppress the trigger", () => {
  const state = fixedState({ c: { phobia: "Darkness", phobiaType: null, skills: { "Night Vision": 1 } } });
  open(state.floor.g, 5, 4, { dark: true });
  const e = move(state, "N", fakeRng([]), []);
  assert.ok(e.some((ev) => ev.type === "phobiaTriggered" && ev.trigger === "dark"), "Night Vision waives the reveal/to-hit penalties, never the phobia trigger itself");
});

// --- Being trapped -------------------------------------------------------------

test("trapped: a dead-end entry fires trappedPanic THEN phobiaTriggered (deadEnd), in that order", () => {
  const state = fixedState({ c: { phobia: "Being trapped", phobiaType: null } });
  open(state.floor.g, 5, 5); // start tile
  open(state.floor.g, 5, 6); // second neighbor, so (5,5) is never itself a dead end
  open(state.floor.g, 5, 4); // a genuine dead end
  const e = move(state, "N", fakeRng([]), []);
  const iPanic = e.findIndex((ev) => ev.type === "trappedPanic");
  const iTrigger = e.findIndex((ev) => ev.type === "phobiaTriggered");
  assert.ok(iPanic !== -1 && iTrigger !== -1 && iPanic < iTrigger, "trappedPanic must precede phobiaTriggered");
  assert.equal(e[iTrigger].trigger, "deadEnd");
  assert.equal(state.c.phobiaState["Being trapped"], true);
});

test("trapped: re-entering the SAME dead end after leaving does not re-fire trappedPanic (tile debounce) but DOES re-fire phobiaTriggered (region re-entry)", () => {
  const state = fixedState({ c: { phobia: "Being trapped", phobiaType: null } });
  open(state.floor.g, 5, 5);
  open(state.floor.g, 5, 6);
  open(state.floor.g, 5, 4);
  move(state, "N", fakeRng([]), []); // first entry: panics + triggers
  move(state, "S", fakeRng([]), []); // leaves — region clears
  const e = move(state, "N", fakeRng([]), []); // second entry
  assert.ok(!e.some((ev) => ev.type === "trappedPanic"), "the tile marker suppresses a second panic");
  assert.ok(e.some((ev) => ev.type === "phobiaTriggered" && ev.trigger === "deadEnd"), "the region model re-fires on a fresh entry");
});

// --- Heights -------------------------------------------------------------------

test("heights: a climb attempt fires phobiaTriggered BEFORE heightsFear and before any roll result", () => {
  const state = fixedState({ c: { phobia: "Heights", phobiaType: null } });
  open(state.floor.g, 5, 4, { feat: "climb" });
  // feet=10*(1+d(2)=1)=20; rung1: r=d(10)=6+hPenalty(2)=8>7(rope success) -> fail;
  // fall check g=0: d(20)=15(>2, hurt rolls); fall damage d6=4.
  const e = move(state, "N", fakeRng([1, 6, 15, 4]), []);
  const iTrigger = e.findIndex((ev) => ev.type === "phobiaTriggered");
  const iFear = e.findIndex((ev) => ev.type === "heightsFear");
  const iRoll = e.findIndex((ev) => ev.type === "fellClimbing" || ev.type === "climbedOver");
  assert.ok(iTrigger !== -1 && iFear !== -1 && iRoll !== -1);
  assert.ok(iTrigger < iFear && iFear < iRoll, "phobiaTriggered must precede heightsFear, which must precede the roll outcome");
  assert.equal(e[iTrigger].trigger, "heights");
});

// DELIBERATE RULES CHANGE (Phase 54, 2026-09-21, USER RULING D, one-and-done):
// a failed climb/leap no longer leaves the hero on the near side to retry —
// the feature is consumed and the hero crosses either way (see
// engine/movement.js's climb/gorge block). A genuine retry of the SAME tile
// via move() is therefore now UNREACHABLE (the tile's feat is gone after
// exactly one roll, pass or fail) — the debounce this test used to prove
// through move() is tested directly against noteHeightsAttempt itself below,
// which still owns the underlying "same key is silent" contract (defensive,
// and reachable via the hazardChoice pending/declined pause, which can call
// it once for a tile before any roll has run).
test("heights: noteHeightsAttempt is silent on a second call with the SAME tile key (the debounce contract, unreachable via move() post-one-and-done)", () => {
  const state = fixedState({ c: { phobia: "Heights", phobiaType: null } });
  const e1 = [];
  noteHeightsAttempt(state, 5, 4, e1);
  assert.ok(e1.some((ev) => ev.type === "phobiaTriggered" && ev.trigger === "heights"), "the first attempt at a fresh tile fires");
  const e2 = [];
  noteHeightsAttempt(state, 5, 4, e2);
  assert.ok(!e2.some((ev) => ev.type === "phobiaTriggered"), "a second call with the SAME key is silent");
});

// One-and-done means a climb tile is consumed after exactly one roll — a
// "step away and back" scenario against the SAME tile can no longer happen
// through move() either (the feature is gone). This test's real-world
// equivalent is two DIFFERENT climb tiles: the phobia must fire again at a
// fresh tile even though the first tile already armed the fear this run.
test("heights: a SECOND, different climb tile fires phobiaTriggered again (a fresh tile is never debounced by an earlier one)", () => {
  const state = fixedState({ c: { phobia: "Heights", phobiaType: null } });
  open(state.floor.g, 5, 5);
  open(state.floor.g, 5, 4, { feat: "climb" });
  open(state.floor.g, 6, 5, { feat: "climb" });
  const e1 = move(state, "N", fakeRng([1, 6, 15, 4]), []); // fails, crosses to (5,4) (one and done)
  assert.ok(e1.some((ev) => ev.type === "phobiaTriggered" && ev.trigger === "heights"), "the first tile fires");
  move(state, "S", fakeRng([]), []); // back to (5,5)
  const e2 = move(state, "E", fakeRng([1, 5, 5]), []); // a DIFFERENT climb tile (6,5): succeeds
  assert.ok(e2.some((ev) => ev.type === "phobiaTriggered" && ev.trigger === "heights"), "a fresh, different tile fires again");
});

test("heights: the hazardChoice pause (a carried rope) does NOT fire noteHeightsAttempt — the second (declined) move does", () => {
  const state = fixedState({ c: { phobia: "Heights", phobiaType: null, items: [{ kind: "tool", tool: "rope", n: "Rope" }] } });
  open(state.floor.g, 5, 4, { feat: "gorge" });
  const e1 = move(state, "N", fakeRng([]), []); // stashes pendingHazard, zero draws
  assert.ok(e1.some((ev) => ev.type === "hazardChoice"));
  assert.ok(!e1.some((ev) => ev.type === "phobiaTriggered"), "the pause itself must not fire the trigger");
  assert.equal("phobiaState" in state.c, false);

  // LEAP_TABLE[0]: Fighter needs <=10; r = d(10)=6 <= 10 -> clear.
  const e2 = move(state, "N", fakeRng([1, 6]), []); // declines the tool, rolls instead
  assert.ok(e2.some((ev) => ev.type === "phobiaTriggered" && ev.trigger === "heights"), "the declined (second) CLIMB IT/LEAP IT move fires it");
  assert.deepEqual(state.c.fearArmed, { phobia: "Heights", trigger: "heights" });
});

test("heights: the flyOver (Bracelet of Flight) branch never calls noteHeightsAttempt", () => {
  // 260918-w4n (use-activated-only): flyOver only runs while a fly-kind
  // record is LIVE — a bagged/ready Bracelet no longer flies unconditionally.
  const flying = fixedState({
    c: {
      phobia: "Heights", phobiaType: null,
      items: [{ n: "Bracelet of Flight", eff: { fly: 1 } }],
      timers: { "item:Bracelet of Flight": { cadence: "squares", left: 20, cd: 50, phase: "effect" } },
    },
  });
  open(flying.floor.g, 5, 4, { feat: "climb" });
  const e1 = move(flying, "N", fakeRng([]), []);
  assert.ok(e1.some((ev) => ev.type === "flownOver"));
  assert.ok(!e1.some((ev) => ev.type === "phobiaTriggered"));
  assert.equal("phobiaState" in flying.c, false);
});

test("heights: the ether branch never calls noteHeightsAttempt", () => {
  const ethereal = fixedState({
    c: { phobia: "Heights", phobiaType: null, timers: { "item:Cloak of Ether": { cadence: "squares", left: 5, cd: 80, phase: "effect" } } },
  });
  open(ethereal.floor.g, 5, 4, { feat: "gorge" });
  const e2 = move(ethereal, "N", fakeRng([]), []);
  assert.ok(e2.some((ev) => ev.type === "phasedThrough"));
  assert.ok(!e2.some((ev) => ev.type === "phobiaTriggered"));
  assert.equal("phobiaState" in ethereal.c, false);
});

test("heights: the tool (opts.tool) branch never calls noteHeightsAttempt", () => {
  const toolUser = fixedState({ c: { phobia: "Heights", phobiaType: null, items: [{ kind: "tool", tool: "rope", n: "Rope" }] } });
  open(toolUser.floor.g, 5, 4, { feat: "gorge" });
  const e3 = move(toolUser, "N", fakeRng([]), [], Date.now, { tool: "rope" });
  assert.ok(e3.some((ev) => ev.type === "toolUsed"));
  assert.ok(!e3.some((ev) => ev.type === "phobiaTriggered"));
  assert.equal("phobiaState" in toolUser.c, false);
});

// --- Teleport --------------------------------------------------------------

test("teleport: landing on water / a dark cell / a dead end each fire the matching trigger once", () => {
  const water = fixedState({ c: { phobia: "Bodies of water", phobiaType: null } });
  open(water.floor.g, 5, 2, { water: true });
  const ew = teleport(water, fakeRng([1, 1, 3]), []); // dir N (d8=1 twice), dist 3 -> lands exactly on (5,2)
  assert.ok(ew.some((ev) => ev.type === "phobiaTriggered" && ev.trigger === "water"));

  const dark = fixedState({ c: { phobia: "Darkness", phobiaType: null } });
  open(dark.floor.g, 5, 2, { dark: true });
  const ed = teleport(dark, fakeRng([1, 1, 3]), []);
  assert.ok(ed.some((ev) => ev.type === "phobiaTriggered" && ev.trigger === "dark"));

  const trapped = fixedState({ c: { phobia: "Being trapped", phobiaType: null } });
  open(trapped.floor.g, 5, 2); // a lone open cell surrounded by walls is itself a dead end
  const et = teleport(trapped, fakeRng([1, 1, 3]), []);
  assert.ok(et.some((ev) => ev.type === "phobiaTriggered" && ev.trigger === "deadEnd"));
});

// --- Descend -----------------------------------------------------------------

test("descend: the four floor-bound phobia region keys clear; Death and fearArmed survive", () => {
  const state = fixedState({
    c: {
      phobiaState: { "Bodies of water": true, Darkness: true, Heights: "3,4", "Being trapped": true, Death: true },
      fearArmed: { phobia: "Death", trigger: "nearDeath" },
    },
  });
  descend(state, makeRng(12345), []);
  assert.deepEqual(state.c.phobiaState, { Death: true });
  assert.deepEqual(state.c.fearArmed, { phobia: "Death", trigger: "nearDeath" });
});

// --- Death (out of combat) --------------------------------------------------

test("Death: hp at/below 25% of maxWP fires nearDeath once on the next step; recovering above 50% re-arms it", () => {
  const state = fixedState({ c: { phobia: "Death", phobiaType: null, wp: 10, maxWP: 55 } }); // 18% <= 25%
  open(state.floor.g, 5, 4);
  open(state.floor.g, 5, 3);
  const e1 = move(state, "N", fakeRng([]), []);
  assert.ok(e1.some((ev) => ev.type === "phobiaTriggered" && ev.trigger === "nearDeath"));
  assert.equal(state.c.phobiaState.Death, true);
  assert.deepEqual(state.c.fearArmed, { phobia: "Death", trigger: "nearDeath" });

  const e2 = move(state, "N", fakeRng([]), []); // still at 10/55 — stays silent (was already true)
  assert.ok(!e2.some((ev) => ev.type === "phobiaTriggered"));

  state.c.wp = 30; // 54.5% > 50% re-arm line
  move(state, "S", fakeRng([]), []);
  assert.equal(state.c.phobiaState.Death, false);
});

// --- Non-terrain (combat-type) phobia: no key creation ---------------------

test("a combat-type-phobic character never gains c.phobiaState/c.fearArmed while walking water/dark/dead-end/climbing", () => {
  const state = fixedState({ c: { phobia: "Fire", phobiaType: "Demons" } });
  open(state.floor.g, 5, 4, { water: true });
  open(state.floor.g, 5, 3, { dark: true });
  open(state.floor.g, 5, 2, { feat: "climb" });
  move(state, "N", fakeRng([]), []); // onto water
  assert.equal("phobiaState" in state.c, false);
  assert.equal("fearArmed" in state.c, false);
  move(state, "N", fakeRng([]), []); // onto dark
  assert.equal("phobiaState" in state.c, false);
  const e = move(state, "N", fakeRng([1, 5, 5]), []); // a successful climb attempt
  assert.equal("phobiaState" in state.c, false);
  assert.equal("fearArmed" in state.c, false);
  assert.ok(!e.some((ev) => ev.type === "phobiaTriggered"));
});

// ============================================================================
// Task 2 — engine/combat.js#fight's fourth OR-condition, the consume-at-fight
// rule, in-combat Death crossing. Mirrors test/unit/afraid.test.js's own
// fakeRng/countingRng/fixedFoe/fixedCombat discipline.
// ============================================================================

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

test("fight(): an armed terrain fear (not type/darkness/near-death matched) opens the fight Afraid via the fourth OR-condition; fearArmed is consumed", () => {
  const state = fixedState({
    c: { phobia: "Bodies of water", phobiaType: null, fearArmed: { phobia: "Bodies of water", trigger: "water" } },
  });
  state.combat = fixedCombat([fixedFoe()], { pending: true });
  const events = fight(state, fakeRng([20, 1]), []); // initiative x2, "you" wins, no foeTurn draws
  assert.equal(state.combat.afraid, AFRAID_ROUNDS);
  assert.deepStrictEqual(events.find((e) => e.type === "phobiaAfraid"), { type: "phobiaAfraid", rounds: AFRAID_ROUNDS, trigger: "water" });
  assert.equal("fearArmed" in state.c, false, "the arm is consumed by fight()");
});

test("fight(): control — a plain type-matched trigger's phobiaAfraid shape is unchanged (no trigger key) when not armed", () => {
  const state = fixedState({ c: { phobia: "Bats and rats", phobiaType: "Beasts" } });
  state.combat = fixedCombat([fixedFoe({ type: "Beasts" })], { pending: true, type: "Beasts" });
  const events = fight(state, fakeRng([20, 1]), []);
  assert.deepStrictEqual(events.find((e) => e.type === "phobiaAfraid"), { type: "phobiaAfraid", rounds: AFRAID_ROUNDS });
});

test("fight(): nearDeathPanic (the existing at-fight-start Death check) still fires independently, with no trigger key", () => {
  const state = fixedState({ c: { phobia: "Death", phobiaType: null, wp: 10, maxWP: 55 } }); // 18% <= 25%
  state.combat = fixedCombat([fixedFoe()], { pending: true });
  const events = fight(state, fakeRng([20, 1]), []);
  assert.deepStrictEqual(events.find((e) => e.type === "phobiaAfraid"), { type: "phobiaAfraid", rounds: AFRAID_ROUNDS });
  assert.equal("fearArmed" in state.c, false);
});

test("fight(): Hardiness draws exactly one extra d2 for an armed trigger; a 1 shrugs off Afraid but still consumes fearArmed", () => {
  const shrugged = fixedState({
    c: { phobia: "Bodies of water", phobiaType: null, skills: { Hardiness: 1 }, fearArmed: { phobia: "Bodies of water", trigger: "water" } },
  });
  shrugged.combat = fixedCombat([fixedFoe()], { pending: true });
  const rng = countingRng(fakeRng([20, 1, 1])); // initiative x2 + Hardiness d2=1 (shrug)
  const events = fight(shrugged, rng, []);
  assert.equal(rng.draws, 3);
  assert.ok(!events.some((e) => e.type === "phobiaAfraid"));
  assert.equal(shrugged.combat.afraid, undefined);
  assert.equal("fearArmed" in shrugged.c, false, "the arm is spent even when Hardiness shrugs it off");

  const notShrugged = fixedState({
    c: { phobia: "Bodies of water", phobiaType: null, skills: { Hardiness: 1 }, fearArmed: { phobia: "Bodies of water", trigger: "water" } },
  });
  notShrugged.combat = fixedCombat([fixedFoe()], { pending: true });
  const events2 = fight(notShrugged, fakeRng([20, 1, 2]), []); // d2=2 -> not a shrug
  assert.equal(notShrugged.combat.afraid, AFRAID_ROUNDS);
  assert.ok(events2.some((e) => e.type === "phobiaAfraid" && e.trigger === "water"));
  assert.equal("fearArmed" in notShrugged.c, false);
});

test("fight(): a stale arm (fearArmed.phobia !== c.phobia, e.g. after a newPhobia reroll) is ignored but still consumed", () => {
  const state = fixedState({
    c: { phobia: "Fire", phobiaType: "Demons", fearArmed: { phobia: "Bodies of water", trigger: "water" } },
  });
  state.combat = fixedCombat([fixedFoe({ type: "Beasts" })], { pending: true, type: "Beasts" });
  const events = fight(state, fakeRng([20, 1]), []);
  assert.ok(!events.some((e) => e.type === "phobiaAfraid"));
  assert.equal("fearArmed" in state.c, false);
});

test("Death: a foeTurn-tail hp crossing (already at/below 25%) fires nearDeath mid-fight; the arm survives endCombat; the NEXT fight opens Afraid with trigger nearDeath; healing above 50% clears the region", () => {
  const state = fixedState({ c: { phobia: "Death", phobiaType: null, wp: 13, maxWP: 55 } }); // 23.6% <= 25%
  state.combat = fixedCombat([{ ...fixedFoe(), alive: false }]); // a fully no-op foe roster: zero draws to reach the tail
  const events = foeTurn(state, fakeRng([]), []);
  assert.ok(events.some((e) => e.type === "phobiaTriggered" && e.trigger === "nearDeath"));
  assert.equal(state.c.phobiaState.Death, true);
  assert.deepEqual(state.c.fearArmed, { phobia: "Death", trigger: "nearDeath" });

  endCombat(state, []);
  assert.deepEqual(state.c.fearArmed, { phobia: "Death", trigger: "nearDeath" }, "the arm survives endCombat — only fight() consumes it");

  state.combat = fixedCombat([fixedFoe()], { pending: true });
  const fightEvents = fight(state, fakeRng([20, 1]), []);
  assert.deepStrictEqual(fightEvents.find((e) => e.type === "phobiaAfraid"), { type: "phobiaAfraid", rounds: AFRAID_ROUNDS, trigger: "nearDeath" });
  assert.equal("fearArmed" in state.c, false);

  state.c.wp = 30; // 54.5% > 50% re-arm line
  state.combat = fixedCombat([{ ...fixedFoe(), alive: false }]);
  foeTurn(state, fakeRng([]), []);
  assert.equal(state.c.phobiaState.Death, false);
});

test("never a lost action: fear armed via a terrain trigger still allows a normal strike once the fight opens Afraid", () => {
  const state = fixedState({
    c: { phobia: "Bodies of water", phobiaType: null, fearArmed: { phobia: "Bodies of water", trigger: "water" } },
  });
  state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })], { pending: true });
  fight(state, fakeRng([20, 1]), []);
  assert.equal(state.combat.afraid, AFRAID_ROUNDS);
  const events = playerStrike(state, fakeRng([5, 2, 20, 15, 10]), []);
  assert.ok(events.some((e) => e.type === "struck" || e.type === "strikeMissed"));
  assert.equal(events.some((e) => e.type === "strikeRefused"), false);
});
