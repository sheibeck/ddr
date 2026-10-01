// test/unit/spell-level-overrides.test.js
//
// Phase 23 Plan 01, Task 3 — proves the spell-level override table
// (content/spell-level-overrides.js) touches EXACTLY the intended (sub, spell)
// pair and nothing else, and locks castableAttackSpells / ATTACK_SPELL_KINDS's
// semantics.
//
// Phase 90 plan 06 (SPELL-12, user 2026-09-30): the table is now exactly
// { Summoner: { Summon: 1 } } (the named exception; Phantom Host is removed),
// and canCast also re-checks the sub-class's school (SPELL-10). The canCast
// diff-walk below is the load-bearing proof that, against the pre-Phase-23
// predicate plus that school check, the ONLY behaviour change is (Summoner,
// Summon) at level 1.

import test from "node:test";
import assert from "node:assert/strict";

import { SPELLS, CLASSES, SPELL_LEVEL_OVERRIDES } from "../../content/index.js";
import {
  spellLevelFor,
  canCast,
  castableAttackSpells,
  isAttackSpell,
  ATTACK_SPELL_KINDS,
  schoolGate,
  schoolAllowed,
  schoolClosed,
  spellClosed,
  canLearn,
} from "../../engine/derived.js";

/** Minimal state fixture — canCast/castableAttackSpells read only
 * state.c.{sub,level,grimoire}. */
function stateFor(sub, level, grimoire, extra = {}) {
  return { c: { sub, level, grimoire, spellsUsed: 0, ...extra } };
}

const ALL_NAMES = SPELLS.map((sp) => sp.n);

// --- 1. Table shape ----------------------------------------------------

// Phase 90 plan 06 (SPELL-12, user 2026-09-30): the Summoner casts the level-2
// Summon from level 1 as a NAMED exception (Phase 40 had retired the row for
// Lesser Summon, which is now removed with Phantom Host).
test("SPELL_LEVEL_OVERRIDES has exactly the Summoner row, mapping the real spell name Summon to the integer 1", () => {
  const keys = Object.keys(SPELL_LEVEL_OVERRIDES);
  assert.deepStrictEqual(keys, ["Summoner"]);
  for (const [spellName, level] of Object.entries(SPELL_LEVEL_OVERRIDES.Summoner)) {
    assert.ok(
      SPELLS.some((sp) => sp.n === spellName),
      `Summoner's override key "${spellName}" must be a real SPELLS[].n`,
    );
    assert.equal(Number.isInteger(level), true);
    assert.equal(level, 1);
  }
  assert.deepStrictEqual(SPELL_LEVEL_OVERRIDES.Summoner, { Summon: 1 });
});

// --- 2. spellLevelFor ----------------------------------------------------

test("spellLevelFor: the one override cell returns 1, every other cell (including every other sub-class's Summon) falls back to sp.lvl", () => {
  const summon = SPELLS.find((sp) => sp.n === "Summon");

  // Phase 90 plan 06: the Summoner casts Summon from level 1 (the named exception).
  assert.equal(spellLevelFor("Summoner", summon), 1);

  for (const sub of ["Wizard", "Cleric", "Apprentice", "Illusionist"]) {
    for (const sp of SPELLS) {
      assert.equal(spellLevelFor(sub, sp), sp.lvl, `${sub}/${sp.n} must fall back to sp.lvl`);
    }
  }

  // The Summoner is unaffected for every OTHER spell.
  for (const sp of SPELLS) {
    if (sp.n !== "Summon") assert.equal(spellLevelFor("Summoner", sp), sp.lvl);
  }
});

// --- 3. canCast diff walk (FLAGGED PLANNER ASSUMPTION, IDENT-03) --------

/** oldCanCast(state, sp) — the pre-Phase-23 predicate, reproduced verbatim
 * (grimoire membership, bare `sp.lvl > c.level`, schoolGate), PLUS Phase 90
 * plan 06's school check (a school the sub-class can never learn is never
 * castable), for the diff walk below to compare against the new
 * spellLevelFor-routed canCast. */
function oldCanCast(state, sp) {
  const c = state.c;
  if (!c.grimoire || !c.grimoire.includes(sp.n)) return false;
  if (spellClosed(c.sub, sp)) return false; // Phase 91.1 plan 03 (V20 B): the named exceptions (the Cleric's Strength)
  if (sp.lvl > c.level) return false;
  return c.level >= schoolGate(c.sub, sp.s);
}

// Phase 90 plan 06: the Summoner/Summon cell at level 1 is the one divergence.
test("canCast diff walk: the override changes EXACTLY the one Summoner (sub, spell, level) cell", () => {
  const subs = [...CLASSES["Magic User"].subs, "Knight", "Pickpocket"];
  const diffs = [];
  for (const sub of subs) {
    for (let level = 1; level <= 5; level++) {
      const state = stateFor(sub, level, ALL_NAMES);
      for (const sp of SPELLS) {
        const oldResult = oldCanCast(state, sp);
        const newResult = canCast(state, sp);
        if (oldResult !== newResult) diffs.push([sub, sp.n, level]);
      }
    }
  }
  assert.deepStrictEqual(diffs, [["Summoner", "Summon", 1]]);
});

test("canCast school check (SPELL-10): a spell of a school the sub-class can never learn is never castable at any level, even held in the book", () => {
  for (const sub of CLASSES["Magic User"].subs) {
    for (let level = 1; level <= 5; level++) {
      const state = stateFor(sub, level, ALL_NAMES);
      for (const sp of SPELLS) {
        if (canLearn(sub, sp)) continue; // Phase 91.1 plan 03 (V20 B): the Cleric's named Strength exception is learnable
        assert.equal(canCast(state, sp), false, `${sub}/${sp.n}/L${level}: school ${sp.s} is closed to it`);
      }
    }
  }
});

test("canCast diff walk: with an EMPTY grimoire, canCast is false for every (sub, spell, level), including the two override cells", () => {
  const subs = [...CLASSES["Magic User"].subs, "Knight", "Pickpocket"];
  for (const sub of subs) {
    for (let level = 1; level <= 5; level++) {
      const state = stateFor(sub, level, []);
      for (const sp of SPELLS) {
        assert.equal(
          canCast(state, sp),
          false,
          `${sub}/${sp.n}/L${level}: canCast must be false with an empty grimoire — the override never bypasses grimoire membership`,
        );
      }
    }
  }
});

// --- 4. castableAttackSpells semantics -----------------------------------

test("castableAttackSpells: Wizard L1 with Heal/Freeze/Doze returns Doze,Freeze in SPELLS order", () => {
  const state = stateFor("Wizard", 1, ["Heal", "Freeze", "Doze"]);
  const names = castableAttackSpells(state).map((sp) => sp.n);
  assert.deepStrictEqual(names, ["Doze", "Freeze"]);
});

test("castableAttackSpells: Wizard L1 with only utility spells returns []", () => {
  const state = stateFor("Wizard", 1, ["Heal", "Shield", "Map the Floor"]);
  assert.deepStrictEqual(castableAttackSpells(state), []);
});

// Phase 90 plan 06 (SPELL-12): Summon is castable at level 1 for the Summoner
// (the named exception); it is not an attack kind, so it never lists here.
//
// RULES-03 (Phase 75, user 2026-09-25): the Summoner's offense SCHOOL gate is
// retired (content/mu-chart.js) — Stun (offense, gate 1 now) IS castable at
// level 1, so castableAttackSpells returns [Stun], not [].
test("castableAttackSpells: Summoner L1 with Stun/Summon returns [Stun] (RULES-03: the offense gate is removed); canCast(Summon) is true (the SPELL-12 exception) but a summon is no attack kind", () => {
  const state = stateFor("Summoner", 1, ["Stun", "Summon"]);
  const names = castableAttackSpells(state).map((sp) => sp.n);
  assert.deepStrictEqual(names, ["Stun"]);
  const summon = SPELLS.find((sp) => sp.n === "Summon");
  assert.equal(canCast(state, summon), true);
});

test("castableAttackSpells: Wizard L4 with Lightning returns [Lightning] (thrown at any level counts)", () => {
  const state = stateFor("Wizard", 4, ["Lightning"]);
  const names = castableAttackSpells(state).map((sp) => sp.n);
  assert.deepStrictEqual(names, ["Lightning"]);
});

test("castableAttackSpells: Wizard L4 with Fireballs returns [] (volley is deliberately not an attack kind)", () => {
  const state = stateFor("Wizard", 4, ["Fireballs"]);
  assert.deepStrictEqual(castableAttackSpells(state), []);
});

test("castableAttackSpells: ignores charges — Wizard L1 with Freeze and spellsUsed=99 still returns [Freeze]", () => {
  const state = stateFor("Wizard", 1, ["Freeze"], { spellsUsed: 99 });
  const names = castableAttackSpells(state).map((sp) => sp.n);
  assert.deepStrictEqual(names, ["Freeze"]);
});

// --- 5. ATTACK_SPELL_KINDS / isAttackSpell --------------------------------

// Phase 90 plan 05 (SPELL-12): Ice's kind is "blast" (the area freeze) and joins the set.
test("ATTACK_SPELL_KINDS is exactly {status, thrown, stun, weaken, blast}", () => {
  assert.deepStrictEqual([...ATTACK_SPELL_KINDS].sort(), ["blast", "status", "stun", "thrown", "weaken"]);
});

// Phase 40 (SPELL-01): Ice's kind changed offense/thrown -> offense/dot (a
// real per-round DOT, Plan 02), so it moved from the true-list to the
// false-list here. Phase 90 plan 05 (SPELL-12): Ice is the area freeze now,
// kind "blast", which joins ATTACK_SPELL_KINDS, so it moves back to the true-list.
test("isAttackSpell: true for Doze/Freeze/Stun/Weaken/Ice/Fireball/Lightning/Mangle, false for the rest (Ice is the blast kind, an attack kind again)", () => {
  const trueNames = ["Doze", "Freeze", "Stun", "Weaken", "Ice", "Fireball", "Lightning", "Mangle"];
  const falseNames = ["Heal", "Shield", "Summon", "Acid", "Fireballs", "Earthquake", "Death"];
  for (const n of trueNames) {
    const sp = SPELLS.find((s) => s.n === n);
    assert.ok(sp, `${n} must exist in SPELLS`);
    assert.equal(isAttackSpell(sp), true, `${n} must be an attack spell`);
  }
  for (const n of falseNames) {
    const sp = SPELLS.find((s) => s.n === n);
    assert.ok(sp, `${n} must exist in SPELLS`);
    assert.equal(isAttackSpell(sp), false, `${n} must NOT be an attack spell`);
  }
});
