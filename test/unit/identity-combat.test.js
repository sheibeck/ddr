// Direct unit coverage for Phase 24's combat-side sub-class identity pass
// (IDENT-05/IDENT-06/IDENT-07): the Knight's big-foe initiative bad, the
// Court Mage's talk-first bad + widened boredom kill + Humans parley good,
// the Ninja's and Master of Arms' no-parley bads, the Master of Arms' denied
// clean withdrawal, the Guard's -1 to be hit good, the Cloaker's real bad,
// and the Bard's party-play low-wit targeting.
//
// Mirrors test/unit/combat.test.js's fakeRng/fixedFighter/fixedFloor/
// fixedState/fixedFoe/fixedCombat helpers verbatim (local copies, per the
// plan — this file does not import them) so this suite reads standalone.

import test from "node:test";
import assert from "node:assert/strict";

import {
  rollInitiative,
  knightFacesBigFoe,
  startCombat,
  flee,
  pickFoeTarget,
  canParley,
  parley,
} from "../../engine/combat.js";
import { foeToHitVs } from "../../engine/derived.js";
import { startEffect } from "../../engine/effects.js";

/** fakeRng(seq) — `.d()` pops the next value off `seq` regardless of the
 * requested side count; `.pick(arr)` returns `arr[0]` unless a picker is
 * supplied. Throws if the sequence underflows, which doubles as a "no more
 * rng draws expected" assertion (ports test/unit/combat.test.js's helper
 * verbatim). */
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

/** looseRng(seq, fallback) — like fakeRng, but returns `fallback` forever
 * once `seq` is exhausted instead of throwing. Used only for the boredom
 * measurement below, where the exact PRECEDING draws (foe count, level
 * downgrade, initiative, the d12 boredom check itself) are pinned, but the
 * downstream killFoe/foeTurn draws that follow are real content-driven
 * arithmetic this test does not need to hand-verify — `fallback` is chosen
 * to be a safe universal "miss"/"low roll" value for every remaining draw. */
function looseRng(seq, fallback = 8) {
  let i = 0;
  return {
    d(_sides) {
      return i < seq.length ? seq[i++] : fallback;
    },
    pick: (arr) => arr[0],
    shuffle: (a) => a,
  };
}

function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
    maxWP: 55, wp: 55, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 1, rations: 6, gold: 50, scrolls: 0,
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
    c: fixedFighter(cOverrides),
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

// --- Knight: never wins initiative vs a live maxWP >= 20 foe ---------------

test("rollInitiative: a Knight never wins vs a live maxWP >= 20 foe, unless foreseen", () => {
  const state = fixedState({ c: { sub: "Knight" } });
  state.combat = fixedCombat([fixedFoe({ wp: 20, maxWP: 20 })]);
  // mine=20 >= theirs=1 would otherwise be "you" — the Knight clause overrides it.
  assert.equal(rollInitiative(state, fakeRng([20, 1])), "foe");

  const state2 = fixedState({ c: { sub: "Knight" } });
  state2.combat = fixedCombat([fixedFoe({ wp: 19, maxWP: 19 })]);
  assert.equal(rollInitiative(state2, fakeRng([20, 1])), "you", "a foe at maxWP 19 does not trigger");

  const state3 = fixedState({ c: { sub: "Knight" } });
  state3.combat = fixedCombat([fixedFoe({ wp: 20, maxWP: 20, alive: false })]);
  assert.equal(rollInitiative(state3, fakeRng([20, 1])), "you", "a dead big foe does not trigger");

  const state4 = fixedState({ c: { sub: "Knight", foresight: true } });
  state4.combat = fixedCombat([fixedFoe({ wp: 20, maxWP: 20 })]);
  assert.equal(rollInitiative(state4, fakeRng([1, 20])), "you", "a foreseen Knight still goes first");
  assert.equal(state4.c.foresight, false, "foresight is consumed by the roll");

  // Every call above consumed exactly two draws — a third throws.
  const rng = fakeRng([20, 1]);
  const state5 = fixedState({ c: { sub: "Knight" } });
  state5.combat = fixedCombat([fixedFoe({ wp: 20, maxWP: 20 })]);
  rollInitiative(state5, rng);
  assert.throws(() => rng.d(20), /sequence exhausted/, "exactly two draws consumed");
});

test("knightFacesBigFoe: true only for a Knight with a live maxWP >= 20 foe", () => {
  const knightBig = fixedState({ c: { sub: "Knight" } });
  knightBig.combat = fixedCombat([fixedFoe({ wp: 20, maxWP: 20 })]);
  assert.equal(knightFacesBigFoe(knightBig), true);

  const knightSmall = fixedState({ c: { sub: "Knight" } });
  knightSmall.combat = fixedCombat([fixedFoe({ wp: 19, maxWP: 19 })]);
  assert.equal(knightFacesBigFoe(knightSmall), false);

  const knightDead = fixedState({ c: { sub: "Knight" } });
  knightDead.combat = fixedCombat([fixedFoe({ wp: 20, maxWP: 20, alive: false })]);
  assert.equal(knightFacesBigFoe(knightDead), false);

  const notKnight = fixedState({ c: { sub: "Soldier" } });
  notKnight.combat = fixedCombat([fixedFoe({ wp: 25, maxWP: 25 })]);
  assert.equal(knightFacesBigFoe(notKnight), false, "the sub gate wins even against a 25-maxWP foe");
});

// --- Court Mage: foes act first in round one only ---------------------------

test("rollInitiative: a Court Mage's foes act first in round one only, unless foreseen", () => {
  const state = fixedState({ c: { sub: "Court Mage" } });
  state.combat = fixedCombat([fixedFoe()], { round: 1 });
  assert.equal(rollInitiative(state, fakeRng([20, 1])), "foe");

  const state2 = fixedState({ c: { sub: "Court Mage" } });
  state2.combat = fixedCombat([fixedFoe()], { round: 2 });
  assert.equal(rollInitiative(state2, fakeRng([20, 1])), "you", "round 2+ rolls normally");

  const state3 = fixedState({ c: { sub: "Court Mage", foresight: true } });
  state3.combat = fixedCombat([fixedFoe()], { round: 1 });
  assert.equal(rollInitiative(state3, fakeRng([1, 20])), "you", "a foreseen Court Mage still goes first");
});

test("rollInitiative: a Fridgian Court Mage still only goes last once (adjacency probe)", () => {
  const state = fixedState({ c: { sub: "Court Mage", race: "Fridgian" } });
  state.combat = fixedCombat([fixedFoe()], { round: 1 });
  // Fridgian's `slow` flag alone already forces never-first; the Court Mage
  // clause is additive, not double-applied — the character just goes last
  // exactly once, same as any single never-first case.
  assert.equal(rollInitiative(state, fakeRng([20, 1])), "foe");
});

// --- Court Mage boredom: exactly 1-in-6 (d12 <= 2), same single draw -------

test("startCombat: a Court Mage's boredom kill fires on d12 in {1,2} and nothing else", () => {
  // Draw order up to the boredom check (see engine/combat.js#startCombat):
  // d4 (foe count, <=2 so only one draw), d4 (level downgrade — either
  // value clamps to lvl 1 here), d12 (the boredom check itself — CMB-01,
  // Phase 31: initiative moved out of startCombat into the separate `fight`
  // action, which now runs strictly AFTER this encounter-step removal loop,
  // so no initiative placeholders sit between the roster draws and the
  // d12 here anymore). Everything after that point (killFoe's own dice, or
  // a surviving foe's foeTurn swing) is real content-driven arithmetic
  // covered by looseRng's fallback, not hand-verified here — this test's
  // claim is only about the d12 draw.
  const fires = fixedState({ c: { sub: "Court Mage" } });
  const eventsFires = startCombat(fires, false, "Beasts", looseRng([1, 2, 2]), []);
  assert.ok(eventsFires.some((e) => e.type === "foeBored"), "d12 <= 2 fires the boredom kill");
  assert.ok(eventsFires.some((e) => e.type === "encounterCleared"), "the lone foe dies of boredom");

  const noFire = fixedState({ c: { sub: "Court Mage" } });
  const eventsNoFire = startCombat(noFire, false, "Beasts", looseRng([1, 2, 3]), []);
  assert.equal(eventsNoFire.some((e) => e.type === "foeBored"), false, "d12 === 3 never fires");
});

test("startCombat: encounterStarted carries knightBigFoe/courtMageTalksFirst, additive to the existing flags", () => {
  const knight = fixedState({ c: { sub: "Knight" } });
  const knightEvents = startCombat(knight, false, "Beasts", looseRng([1, 2, 20, 1, 3]), []);
  const knightStarted = knightEvents.find((e) => e.type === "encounterStarted");
  // A level-1 Bat/Rat (Beasts roster row 0) has maxWP 1 -- not a big foe, and
  // also below the pre-existing "beneath the notice of small things" (< 5)
  // Knight flee, so it survives to be read here.
  assert.equal(knightStarted.knightBigFoe, false);
  assert.equal(knightStarted.courtMageTalksFirst, false);
  assert.equal(knightStarted.samuraiNeverFirst, false, "additive — the existing flags are untouched");

  const courtMage = fixedState({ c: { sub: "Court Mage" } });
  const cmEvents = startCombat(courtMage, false, "Beasts", looseRng([1, 2, 20, 1, 3]), []);
  const cmStarted = cmEvents.find((e) => e.type === "encounterStarted");
  assert.equal(cmStarted.knightBigFoe, false);
  assert.equal(cmStarted.courtMageTalksFirst, true);
});

// --- Guard: -1 to be hit, stacking with Sidestep, floored/overridden -------
// Phase 38 (ABIL-02): Agility (a standing passive) is retired outright;
// Sidestep (a c.timers-driven active with the same -2 shape Agility never
// had — Agility was -1) is its replacement. The Guard's own -1 still stacks
// additively with Sidestep's -2.

test("foeToHitVs: a Guard needs one better, stacking with Sidestep, never beating a hard override", () => {
  assert.equal(foeToHitVs(fixedState({ c: { sub: "Guard" } })), 4);
  const guardSidestep = fixedState({ c: { sub: "Guard" } });
  startEffect(guardSidestep.c, "ability:sidestep", { rounds: 2, cd: 4 });
  assert.equal(foeToHitVs(guardSidestep), 2, "Guard -1 stacks with Sidestep's -2");
  assert.equal(foeToHitVs(fixedState({ c: { sub: "Guard", mirror: 1 } })), 1, "Mirror Self still wins");
  assert.equal(foeToHitVs(fixedState({ c: { sub: "Soldier" } })), 5, "a non-Guard is unaffected");
});

// --- Cloaker: free vanish only before the first landed blow ----------------

test("flee: a Cloaker vanishes free while unseen (!opened2), zero vanishDenied", () => {
  const unseen = fixedState({ c: { cls: "Thief", sub: "Cloaker" } });
  unseen.combat = fixedCombat([fixedFoe()]);
  const eventsUnseen = flee(unseen, fakeRng([]), []);
  assert.ok(eventsUnseen.some((e) => e.type === "fled" && e.reason === "cloaker"));
  assert.equal(eventsUnseen.some((e) => e.type === "fleeRolled"), false);
  assert.equal(eventsUnseen.some((e) => e.type === "vanishDenied"), false);
});

test("flee: a Cloaker who has already struck (opened2) is denied the free vanish and escapes on the ordinary roll", () => {
  const seenEscape = fixedState({ c: { cls: "Thief", sub: "Cloaker" } });
  seenEscape.combat = fixedCombat([fixedFoe()], { opened2: true });
  const eventsEscape = flee(seenEscape, fakeRng([20]), []);
  assert.deepEqual(
    eventsEscape.map((e) => e.type),
    ["vanishDenied", "fleeRolled", "fled", "combatEnded"],
  );
});

test("flee: a Cloaker who has already struck (opened2) can also fail the ordinary roll", () => {
  const seenFail = fixedState({ c: { cls: "Thief", sub: "Cloaker" } });
  seenFail.combat = fixedCombat([fixedFoe({ asleep: 5 })], { opened2: true });
  const eventsFail = flee(seenFail, fakeRng([1]), []);
  assert.deepEqual(
    eventsFail.map((e) => e.type),
    ["vanishDenied", "fleeRolled", "fleeFailed", "foeSlept"],
  );
});

// --- Master of Arms: no clean tracked round-1 withdrawal --------------------

test("flee: a Master of Arms gets no clean tracked round-1 withdrawal — narrated, then the ordinary roll", () => {
  const moa = fixedState({ c: { sub: "Master of Arms" } });
  moa.combat = fixedCombat([fixedFoe({ asleep: 5 })], { tracked: true, round: 1 });
  const moaEvents = flee(moa, fakeRng([1]), []);
  assert.ok(moaEvents.some((e) => e.type === "withdrawalDenied" && e.reason === "masterOfArms"));
  assert.ok(moaEvents.some((e) => e.type === "fleeRolled"));
  assert.equal(moaEvents.some((e) => e.type === "fled" && e.reason === "tracked"), false);
});

test("flee: every other Fighter's tracked round-1 clean exit stays byte-identical", () => {
  const soldier = fixedState(); // default sub: "Soldier"
  soldier.combat = fixedCombat([fixedFoe()], { tracked: true, round: 1 });
  const soldierEvents = flee(soldier, fakeRng([]), []);
  assert.ok(soldierEvents.some((e) => e.type === "fled" && e.reason === "tracked"));
  assert.equal(soldierEvents.some((e) => e.type === "fleeRolled"), false);
  assert.equal(soldierEvents.some((e) => e.type === "withdrawalDenied"), false);
});

// --- Bard: dumb foes in a party come for the Bard -------------------------

function fixedAlly(overrides = {}) {
  return { partyIdx: 0, name: "Ada", lvl: 1, sub: "Fighter", wp: 20, maxWP: 20, ...overrides };
}

test("pickFoeTarget: an intel<=3 foe always targets a Bard hero when a live party stands by", () => {
  const bardState = { c: fixedFighter({ sub: "Bard" }), combat: { foes: [], allies: [fixedAlly()] } };
  const dumbFoe = fixedFoe({ intel: 1 });

  const rng = fakeRng([2]);
  assert.equal(pickFoeTarget(bardState, rng, dumbFoe), null, "the dumb foe swings at the Bard, not Ada");
  assert.throws(() => rng.d(2), /sequence exhausted/, "the draw was still consumed");

  const smartFoe = fixedFoe({ intel: 4 });
  assert.equal(pickFoeTarget(bardState, fakeRng([2]), smartFoe).name, "Ada", "intel 4 is not too stupid");

  const soldierState = { c: fixedFighter({ sub: "Soldier" }), combat: { foes: [], allies: [fixedAlly()] } };
  assert.equal(pickFoeTarget(soldierState, fakeRng([2]), dumbFoe).name, "Ada", "only a Bard triggers the clause");

  assert.equal(pickFoeTarget(bardState, fakeRng([2])).name, "Ada", "no foe argument -> today's behaviour");
});

// --- canParley / parley: Ninja + Master of Arms bads, Court Mage good -----

// Phase 38 (ABIL-02): the Language skill is retired outright (dropped from
// this plant); the sub gate this test proves fires BEFORE fluency is even
// read, so it holds regardless.
test("canParley: a Ninja and a Master of Arms are refused for every encounter type", () => {
  const types = ["Beasts", "Demons", "Humans", "Lair Beasts", "Magical", "Walking Dead"];
  for (const sub of ["Ninja", "Master of Arms"]) {
    for (const type of types) {
      const state = fixedState({ c: { sub } });
      state.combat = fixedCombat([fixedFoe({ type })], { type });
      assert.equal(canParley(state), false, `${sub} vs ${type}`);
    }
  }
});

test("canParley: a Court Mage can parley Humans at fluency 0, but not Beasts or Walking Dead", () => {
  const mk = (type) => {
    const state = fixedState({ c: { sub: "Court Mage" } });
    state.combat = fixedCombat([fixedFoe({ type })], { type });
    return state;
  };
  assert.equal(canParley(mk("Humans")), true);
  assert.equal(canParley(mk("Beasts")), false);
  assert.equal(canParley(mk("Walking Dead")), false, "canon, unconditional, for everyone");
});

test("parley: a Ninja's direct parley narrates a refusal, spends no attempt, draws no rng", () => {
  const state = fixedState({ c: { sub: "Ninja" } });
  state.combat = fixedCombat([fixedFoe({ type: "Humans" })], { type: "Humans" });
  const events = parley(state, fakeRng([]), []);
  assert.deepEqual(events, [{ type: "parleyRefused", reason: "ninja" }]);
  assert.equal(state.combat.parleyTried, undefined, "a refusal never spends the one attempt");
});

test("parley: a Master of Arms' direct parley narrates a refusal, spends no attempt, draws no rng", () => {
  const state = fixedState({ c: { sub: "Master of Arms" } });
  state.combat = fixedCombat([fixedFoe({ type: "Humans" })], { type: "Humans" });
  const events = parley(state, fakeRng([]), []);
  assert.deepEqual(events, [{ type: "parleyRefused", reason: "masterOfArms" }]);
  assert.equal(state.combat.parleyTried, undefined, "a refusal never spends the one attempt");
});
