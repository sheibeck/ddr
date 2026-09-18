// test/unit/spell-level-overrides.test.js
//
// Phase 23 Plan 01, Task 3 — proves the spell-level override table
// (content/spell-level-overrides.js) touches EXACTLY the two intended
// (sub, spell) pairs and nothing else, and locks castableAttackSpells /
// ATTACK_SPELL_KINDS's semantics.
//
// FLAGGED PLANNER ASSUMPTION (IDENT-03, spec-less probe unresolved): the
// canCast diff-walk test below is the load-bearing proof that this phase's
// only behavior change is (Summoner, Summon) at level 1 and (Illusionist,
// Phantom Host) at levels 1-2 — every other (sub, spell, level) triple stays
// byte-identical to the pre-Phase-23 predicate.

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
} from "../../engine/derived.js";

/** Minimal state fixture — canCast/castableAttackSpells read only
 * state.c.{sub,level,grimoire}. */
function stateFor(sub, level, grimoire, extra = {}) {
  return { c: { sub, level, grimoire, spellsUsed: 0, ...extra } };
}

const ALL_NAMES = SPELLS.map((sp) => sp.n);

// --- 1. Table shape ----------------------------------------------------

test("SPELL_LEVEL_OVERRIDES has exactly the Summoner and Illusionist rows, each mapping a real spell name to the integer 1", () => {
  const keys = Object.keys(SPELL_LEVEL_OVERRIDES).sort();
  assert.deepStrictEqual(keys, ["Illusionist", "Summoner"]);
  for (const sub of keys) {
    for (const [spellName, level] of Object.entries(SPELL_LEVEL_OVERRIDES[sub])) {
      assert.ok(
        SPELLS.some((sp) => sp.n === spellName),
        `${sub}'s override key "${spellName}" must be a real SPELLS[].n`,
      );
      assert.equal(Number.isInteger(level), true);
      assert.equal(level, 1);
    }
  }
  assert.deepStrictEqual(SPELL_LEVEL_OVERRIDES.Summoner, { Summon: 1 });
  assert.deepStrictEqual(SPELL_LEVEL_OVERRIDES.Illusionist, { "Phantom Host": 1 });
});

// --- 2. spellLevelFor ----------------------------------------------------

test("spellLevelFor: the two override cells return 1, every other cell falls back to sp.lvl", () => {
  const summon = SPELLS.find((sp) => sp.n === "Summon");
  const phantomHost = SPELLS.find((sp) => sp.n === "Phantom Host");

  assert.equal(spellLevelFor("Summoner", summon), 1);
  assert.equal(spellLevelFor("Illusionist", phantomHost), 1);

  for (const sub of ["Wizard", "Cleric", "Apprentice"]) {
    for (const sp of SPELLS) {
      assert.equal(spellLevelFor(sub, sp), sp.lvl, `${sub}/${sp.n} must fall back to sp.lvl`);
    }
  }

  // A Summoner and an Illusionist are unaffected for every OTHER spell.
  for (const sp of SPELLS) {
    if (sp.n !== "Summon") assert.equal(spellLevelFor("Summoner", sp), sp.lvl);
    if (sp.n !== "Phantom Host") assert.equal(spellLevelFor("Illusionist", sp), sp.lvl);
  }
});

// --- 3. canCast diff walk (FLAGGED PLANNER ASSUMPTION, IDENT-03) --------

/** oldCanCast(state, sp) — the pre-Phase-23 predicate, reproduced verbatim
 * (grimoire membership, bare `sp.lvl > c.level`, schoolGate), for the diff
 * walk below to compare against the new spellLevelFor-routed canCast. */
function oldCanCast(state, sp) {
  const c = state.c;
  if (!c.grimoire || !c.grimoire.includes(sp.n)) return false;
  if (sp.lvl > c.level) return false;
  return c.level >= schoolGate(c.sub, sp.s);
}

test("canCast diff walk: the override changes EXACTLY three (sub, spell, level) cells", () => {
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
  assert.deepStrictEqual(diffs, [
    ["Summoner", "Summon", 1],
    ["Illusionist", "Phantom Host", 1],
    ["Illusionist", "Phantom Host", 2],
  ]);
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

test("castableAttackSpells: Summoner L1 with Stun/Summon returns [] (offense gate 3), even though canCast(Summon) is true", () => {
  const state = stateFor("Summoner", 1, ["Stun", "Summon"]);
  assert.deepStrictEqual(castableAttackSpells(state), []);
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

test("ATTACK_SPELL_KINDS is exactly {status, thrown, stun, weaken}", () => {
  assert.deepStrictEqual([...ATTACK_SPELL_KINDS].sort(), ["status", "stun", "thrown", "weaken"]);
});

// Phase 40 (SPELL-01): Ice's kind changed offense/thrown -> offense/dot (a
// real per-round DOT, Plan 02) — `dot` was never in ATTACK_SPELL_KINDS
// (Acid, the table's other dot-kind spell, was never an attack kind either),
// so Ice moves from the true-list to the false-list here. This is a content
// reshape, not an ATTACK_SPELL_KINDS definition change.
test("isAttackSpell: true for Doze/Freeze/Stun/Weaken/Fireball/Lightning/Mangle, false for the rest (Ice is dot-kind, not an attack kind)", () => {
  const trueNames = ["Doze", "Freeze", "Stun", "Weaken", "Fireball", "Lightning", "Mangle"];
  const falseNames = ["Heal", "Shield", "Summon", "Phantom Host", "Acid", "Ice", "Fireballs", "Earthquake", "Death"];
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
