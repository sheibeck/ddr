// test/unit/foe-ability-carveouts.test.js
//
// D-14 (FID-04): every new Phase 19 serialized field — `c.foeEffect`,
// `combat.pendingFoes`, and per-foe `abilities`/`cd`/`uses` — must be
// carved out of ALL THREE parity `*Comparable()` functions
// (test/parity/harness/comparables.js), never just one. These tests prove
// the strippers are wired into all three, that they strip EXACTLY the
// named fields (never over-stripping — a T-19-07 regression), and that a
// state carrying none of the new fields is returned structurally identical
// to today's (pre-Phase-19) output.

import test from "node:test";
import assert from "node:assert/strict";

import {
  movementComparable,
  combatComparable,
  economyComparable,
  stripFoeAbilityState,
} from "../parity/harness/comparables.js";
import { newRun } from "../../engine/engine.js";

test("D-14: all three comparables strip c.foeEffect", () => {
  const base = newRun(3);
  const withEffect = structuredClone(base);
  withEffect.c.foeEffect = { kind: "dazed", rounds: 2 };

  for (const cmp of [movementComparable, combatComparable, economyComparable]) {
    const clean = cmp(base);
    const dirty = cmp(withEffect);
    assert.deepStrictEqual(dirty, clean, `${cmp.name} must strip c.foeEffect down to parity`);
    assert.equal(Object.hasOwn(dirty.c, "foeEffect"), false, `${cmp.name} must not leak the foeEffect key`);
  }
});

test("D-14: all three comparables strip combat.pendingFoes and per-foe abilities/cd/uses", () => {
  const vampireFoe = {
    name: "Vampire", type: "Walking Dead", lvl: 5, size: "H", intel: 12,
    wp: 71, maxWP: 71, alive: true, asleep: 0, sp: { atk: 2 }, lives: 1,
  };
  const cleanCombat = { foes: [{ ...vampireFoe }], type: "Walking Dead", round: 1, target: 0, spellOpen: false, tracked: false };
  const dirtyCombat = {
    foes: [{ ...vampireFoe, abilities: ["vampireDrain"], cd: { vampireSummon: 3 }, uses: {} }],
    pendingFoes: [{ by: "Vampire", foe: { name: "Skeleton" } }],
    type: "Walking Dead", round: 1, target: 0, spellOpen: false, tracked: false,
  };

  const base = newRun(4);
  const clean = structuredClone(base);
  clean.combat = cleanCombat;
  const dirty = structuredClone(base);
  dirty.combat = dirtyCombat;

  for (const cmp of [movementComparable, combatComparable, economyComparable]) {
    const cleanResult = cmp(clean);
    const dirtyResult = cmp(dirty);
    assert.deepStrictEqual(dirtyResult, cleanResult, `${cmp.name} must strip pendingFoes/abilities/cd/uses down to parity`);
    if (dirtyResult.combat && Array.isArray(dirtyResult.combat.foes)) {
      assert.equal(Object.hasOwn(dirtyResult.combat, "pendingFoes"), false);
      for (const f of dirtyResult.combat.foes) {
        assert.equal(Object.hasOwn(f, "abilities"), false);
        assert.equal(Object.hasOwn(f, "cd"), false);
        assert.equal(Object.hasOwn(f, "uses"), false);
      }
    }
  }
});

test("D-14: a state without any new field is returned structurally identical to the pre-Phase-19 output", () => {
  const base = newRun(7);
  assert.deepStrictEqual(combatComparable(base), combatComparable(structuredClone(base)));
  assert.deepStrictEqual(movementComparable(base), movementComparable(structuredClone(base)));
  assert.deepStrictEqual(economyComparable(base), economyComparable(structuredClone(base)));

  assert.equal(stripFoeAbilityState(null), null);
  const noFoes = { foes: "x" };
  assert.equal(stripFoeAbilityState(noFoes), noFoes);
});

test("stripFoeAbilityState: does not mutate its input", () => {
  const combat = {
    foes: [{ name: "Vampire", abilities: ["vampireDrain"], cd: { x: 1 }, uses: {} }],
    pendingFoes: [{ foo: "bar" }],
    round: 1,
  };
  const before = structuredClone(combat);
  stripFoeAbilityState(combat);
  assert.deepStrictEqual(combat, before, "stripFoeAbilityState must not mutate its argument");
});
