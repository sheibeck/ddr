// test/unit/grimoire-legality.test.js
//
// Phase 75 (RULES-03, Plan 05, user 2026-09-25): the Summoner's offense
// school gate is removed (content/mu-chart.js), and every grant path for
// the six sub-classes that still carry a school gate (Warlock, Sorcerer,
// Court Mage, Illusionist, Cleric, Apprentice) is grant-time legal — a
// book is never HANDED a spell whose school is still closed at the level
// it is granted. This file covers `grantableAt` (engine/character.js) and
// all four grant paths it feeds: rollGrimoire's low/high walks, checkLevel's
// Sorcerer gain and Apprentice reveal, and engine/encounters.js#findGrimoire.
//
// A book may still hold a higher-LEVEL spell, as canon does — the
// cast-time level lock stays entirely inside engine/derived.js#canCast; this
// file never asserts a spell's own printed level against the hero's level.

import test from "node:test";
import assert from "node:assert/strict";

import { makeRng } from "../../engine/rng.js";
import { rollGrimoire, grantableAt, checkLevel } from "../../engine/character.js";
import { findGrimoire } from "../../engine/encounters.js";
import { canLearn, schoolGate, canCast } from "../../engine/derived.js";
import { newRun } from "../../engine/engine.js";
import { SPELLS, CLASSES, THRESHOLDS } from "../../content/index.js";

const byName = (n) => SPELLS.find((sp) => sp.n === n);
const MU_SUBS = CLASSES["Magic User"].subs;
const GATED_SUBS = ["Warlock", "Sorcerer", "Court Mage", "Illusionist", "Cleric", "Apprentice"];

// countingRng, copied verbatim from test/unit/chargen-rng-pin.test.js /
// test/unit/day-one-damage.test.js — counts every draw-producing call;
// getState/setState pass through unmetered.
function countingRng(inner) {
  let draws = 0;
  const wrapped = {
    d(n) {
      draws++;
      return inner.d(n);
    },
    pick(a) {
      draws++;
      return inner.pick(a);
    },
    shuffle(a) {
      draws += Math.max(0, a.length - 1);
      return inner.shuffle(a);
    },
    get draws() {
      return draws;
    },
  };
  if (typeof inner.next === "function") {
    wrapped.next = () => {
      draws++;
      return inner.next();
    };
  }
  if (typeof inner.getState === "function") wrapped.getState = inner.getState;
  if (typeof inner.setState === "function") wrapped.setState = inner.setState;
  return wrapped;
}

// fakeRng, copied verbatim from test/unit/identity-contract.test.js: `.d()`
// pops the next scripted value (throws on underflow — doubles as a "no more
// draws expected" assertion); `.shuffle` is always the identity (array order
// preserved), so a scripted sequence fully determines every downstream
// decision.
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

/** Minimal Magic User character state for checkLevel/findGrimoire tests —
 * only the fields those functions actually read/mutate. */
function fixedMuState(overrides = {}) {
  return {
    c: {
      cls: "Magic User", sub: "Sorcerer", race: "Human", level: 1, sp: 0,
      maxWP: 55, wp: 55, grimoire: [],
      ...overrides,
    },
  };
}

// --- 1. the Summoner's offense gate is gone ---------------------------------

test("RULES-03: schoolGate('Summoner', 'offense') is 1, and a level-1 Summoner holding Freeze passes canCast", () => {
  assert.equal(schoolGate("Summoner", "offense"), 1);
  const state = newRun(1, [], { force: { sub: "Summoner" } });
  state.c.grimoire = ["Freeze"];
  assert.equal(canCast(state, byName("Freeze")), true);
});

// --- 2. grantableAt's exact boundary ----------------------------------------

test("grantableAt(sub, sp, level) is true exactly when canLearn(sub, sp) and schoolGate(sub, sp.s) <= level", () => {
  const mapTheFloor = byName("Map the Floor"); // divination
  const shield = byName("Shield"); // protection
  const heal = byName("Heal"); // healing
  const mirrorSelf = byName("Mirror Self"); // illusion

  // Cleric: divination gated at 3.
  assert.equal(grantableAt("Cleric", mapTheFloor, 2), false, "Cleric divination gate is 3");
  assert.equal(grantableAt("Cleric", mapTheFloor, 3), true, "gate equal to level is open");

  // Warlock: protection gated at 4, healing gated at 3.
  assert.equal(grantableAt("Warlock", shield, 3), false, "Warlock protection gate is 4");
  assert.equal(grantableAt("Warlock", shield, 4), true, "gate equal to level is open");
  assert.equal(grantableAt("Warlock", heal, 2), false, "Warlock healing gate is 3");
  assert.equal(grantableAt("Warlock", heal, 3), true, "gate equal to level is open");

  // canLearn === false (the school is closed forever for this sub) stays
  // false at any level, however high.
  assert.equal(canLearn("Cleric", mirrorSelf), false, "Cleric's illusion school is null — never learnable");
  assert.equal(grantableAt("Cleric", mirrorSelf, 99), false, "a school the sub can never learn is never grantable, at any level");
});

// --- 3. every must-have grant is legal for its own sub at level 1 ----------

test("every must-have grant is from a school whose gate for its own sub-class is 1 (a must-have is never itself illegal)", () => {
  const mustHaves = [
    ["Cleric", ["Heal", "Major Heal"]],
    ["Illusionist", ["Mirror Self", "Phantom Host"]],
    ["Summoner", ["Summon", "Lesser Summon"]],
    ["Sorcerer", ["Freeze", "Fireball"]],
  ];
  for (const [sub, names] of mustHaves) {
    for (const n of names) {
      const sp = byName(n);
      assert.equal(schoolGate(sub, sp.s), 1, `${sub}'s must-have grant ${n} (school ${sp.s}) must have a gate of 1`);
      assert.equal(grantableAt(sub, sp, 1), true, `${sub}'s must-have grant ${n} must be grantable at level 1`);
    }
  }
});

// --- 4. rollGrimoire: every gated sub-class's day-one book is legal --------

test("every gated sub-class's chargen grimoire holds no spell whose school gate for that sub is above 1, over 200 seeds each", () => {
  for (const sub of GATED_SUBS) {
    for (let seed = 1; seed <= 200; seed++) {
      const rng = makeRng(seed);
      const book = rollGrimoire(rng, sub, 1);
      for (const n of book) {
        const sp = byName(n);
        assert.ok(sp, `${sub} seed ${seed}: unknown spell name "${n}" in book`);
        assert.ok(
          schoolGate(sub, sp.s) <= 1,
          `${sub} seed ${seed}: book holds "${n}" (school ${sp.s}, gate ${schoolGate(sub, sp.s)}) above level 1`,
        );
      }
    }
  }
});

// --- 5. the zero-draw guarantee: non-Summoner subs are byte-unchanged ------

// Pinned at the plan base (test/unit/chargen-rng-pin.test.js /
// test/unit/day-one-damage.test.js — Summoner alone moves 31 -> 36; every
// other sub is unchanged because this plan's filter only SKIPS a spell while
// walking an already-shuffled list, never re-rolls or re-shuffles).
const ROLL_GRIMOIRE_DRAW_COUNTS_NON_SUMMONER = {
  Wizard: 39, Warlock: 33, Sorcerer: 35,
  Cleric: 34, Illusionist: 34, "Court Mage": 34, Apprentice: 38,
};

test("rollGrimoire's main-rng draw count is UNCHANGED for every non-Summoner sub, over seeds 1..50 (RULES-03 adds zero draws)", () => {
  for (const [sub, expected] of Object.entries(ROLL_GRIMOIRE_DRAW_COUNTS_NON_SUMMONER)) {
    for (let i = 0; i < 50; i++) {
      const seed = i * 7919 + 1;
      const rng = makeRng(seed);
      const counting = countingRng(rng);
      rollGrimoire(counting, sub);
      assert.equal(
        counting.draws,
        expected,
        `${sub} seed ${seed}: rollGrimoire draw count moved — the RULES-03 grant filter must add zero draws`,
      );
    }
  }
});

// --- 6. findGrimoire: a level-2 Cleric never learns divination; level 3 can ---

test("findGrimoire draws the same rng (one shuffle + one d4) regardless of grant-time legality; a level-2 Cleric never learns a divination spell, over 200 seeds", () => {
  const learnableForCleric = SPELLS.filter((sp) => canLearn("Cleric", sp));
  const expectedDraws = Math.max(0, learnableForCleric.length - 1) + 1; // shuffle + one d4

  for (let seed = 1; seed <= 200; seed++) {
    const rng = makeRng(seed);
    const counting = countingRng(rng);
    const state = fixedMuState({ sub: "Cleric", level: 2, grimoire: [] });
    const events = findGrimoire(state, counting, []);
    assert.equal(counting.draws, expectedDraws, `seed ${seed}: findGrimoire draw count changed`);
    for (const n of events[0].spells) {
      const sp = byName(n);
      assert.ok(schoolGate("Cleric", sp.s) <= 2, `seed ${seed}: learned "${n}" (school ${sp.s}) whose gate exceeds level 2`);
    }
  }
});

test("findGrimoire: a level-3 Cleric CAN learn a divination spell (the gate is now open), at least once over 200 seeds", () => {
  let sawDivination = false;
  for (let seed = 1; seed <= 200; seed++) {
    const rng = makeRng(seed);
    const state = fixedMuState({ sub: "Cleric", level: 3, grimoire: [] });
    const events = findGrimoire(state, rng, []);
    if (events[0].spells.some((n) => byName(n).s === "divination")) sawDivination = true;
  }
  assert.ok(sawDivination, "a level-3 Cleric must be able to learn a divination spell at least once over 200 seeds");
});

// --- 7. checkLevel: the Sorcerer's level-up gain never adds a healing spell ---

test("checkLevel: the Sorcerer's level-up gain (RULES-03) skips a gated healing spell while walking the shuffled list, consuming the SAME shuffle+d8 draws as before (fakeRng proves zero extra draws)", () => {
  const state = fixedMuState({ sub: "Sorcerer", level: 1, sp: THRESHOLDS[1], grimoire: ["Freeze", "Fireball"] });
  // fakeRng's shuffle is the identity — `fresh` stays in SPELLS array order.
  // seq[0]: the level-up gain d8 (amount irrelevant here); seq[1]: the
  // mishap d8, scripted != 1 so rng.pick(nonFire) never fires. fakeRng
  // throws on any draw past index 1 — proving the grant-time walk itself
  // makes NO rng call of its own.
  const events = checkLevel(state, fakeRng([5, 2]), []);
  assert.equal(state.c.level, 2);
  assert.ok(events.some((e) => e.type === "leveled"));
  // Heal (healing, Sorcerer gate 4) is skipped at level 2; Shield
  // (protection) and Strength (offense) — both ungated for Sorcerer — are
  // the first two SPELLS-array-order entries that ARE grantable.
  assert.deepStrictEqual(state.c.grimoire, ["Freeze", "Fireball", "Shield", "Strength"]);
  assert.ok(!state.c.grimoire.some((n) => byName(n).s === "healing"), "no healing spell was granted at level 2 (gate 4)");
});

test("checkLevel: the Sorcerer's level-up gain never adds a healing spell over 200 seeds at level 2 or 3", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const state = fixedMuState({ sub: "Sorcerer", level: 1, sp: THRESHOLDS[2], grimoire: ["Freeze", "Fireball"] });
    checkLevel(state, makeRng(seed), []);
    assert.ok(state.c.level >= 3, `seed ${seed}: expected the level-up loop to reach level 3`);
    const healingSpells = state.c.grimoire.filter((n) => byName(n).s === "healing");
    assert.deepStrictEqual(healingSpells, [], `seed ${seed}: gained a healing spell despite the Sorcerer's gate of 4`);
  }
});

// --- 8. checkLevel: the Apprentice's level-3 reveal drops a gated spell ----

test("checkLevel: an Apprentice's level-3 reveal (RULES-03) drops a book spell whose school is gated above the NEW sub's gate at the NEW level; a spell whose gate equals the level stays", () => {
  const state = fixedMuState({
    sub: "Apprentice", level: 2, sp: THRESHOLDS[2],
    grimoire: ["Shield", "Heal", "Strength"],
  });
  // seq[0]: the level-up gain d8; seq[1]: the reveal's `rng.d(8) - 1` sub
  // pick — 2 selects CLASSES["Magic User"].subs[1] === "Warlock" (never
  // "Apprentice", so the do-while reroll never fires and no third draw is
  // consumed — fakeRng's 2-length sequence proves it).
  const events = checkLevel(state, fakeRng([5, 2]), []);
  assert.equal(state.c.level, 3);
  assert.equal(state.c.sub, "Warlock");
  // Shield (protection, Warlock gate 4 > 3) is dropped; Heal (healing,
  // Warlock gate 3, EQUAL to the new level — the boundary is open) and
  // Strength (offense, ungated for Warlock) both stay.
  assert.deepStrictEqual([...state.c.grimoire].sort(), ["Heal", "Strength"]);
});

test("checkLevel: an Apprentice revealed at level 3 into a gated sub keeps no spell from a school gated above 3, over 200 seeds", () => {
  // Force every SPELLS-eligible spell into the Apprentice's book before the
  // reveal (canLearn("Apprentice", sp) allows every school — its own chart
  // row has no null school), so every seed's reveal has maximal exposure.
  const fullBook = SPELLS.filter((sp) => canLearn("Apprentice", sp)).map((sp) => sp.n);
  for (let seed = 1; seed <= 200; seed++) {
    const state = fixedMuState({ sub: "Apprentice", level: 2, sp: THRESHOLDS[2], grimoire: [...fullBook] });
    checkLevel(state, makeRng(seed), []);
    assert.notEqual(state.c.sub, "Apprentice", `seed ${seed}: expected the reveal to pick a real sub-class`);
    for (const n of state.c.grimoire) {
      const sp = byName(n);
      assert.ok(
        schoolGate(state.c.sub, sp.s) <= state.c.level,
        `seed ${seed}: revealed sub ${state.c.sub} at level ${state.c.level} kept "${n}" (school ${sp.s}, gate ${schoolGate(state.c.sub, sp.s)})`,
      );
    }
  }
});
