// test/unit/parley-carveout.test.js
//
// Phase 20 (PARLEY-01..04, CONTEXT D-13/D-18): the parley carve-out
// (`stripParleyDivergence`, test/parity/harness/comparables.js) must strip
// EXACTLY four fields — c.sp, c.gold, combat.parleyTried,
// combat.parleyInsulted — must be a no-op-shaped identity when none of
// those fields are present, and must NOT be folded into the shared
// comparables (combatComparable must still expose c.sp/c.gold for every
// other scenario). Mirrors test/unit/foe-ability-carveouts.test.js's
// exact-field / no-over-strip test style.

import test from "node:test";
import assert from "node:assert/strict";

import { stripParleyDivergence, combatComparable } from "../parity/harness/comparables.js";
import { newRun } from "../../engine/engine.js";

test("D-13: stripParleyDivergence removes exactly c.sp, c.gold, combat.parleyTried, combat.parleyInsulted", () => {
  const state = newRun(303);
  state.combat = {
    foes: [],
    type: "Humans",
    round: 1,
    target: 0,
    spellOpen: false,
    tracked: false,
    parleyTried: true,
    parleyInsulted: true,
  };
  const before = structuredClone(state);

  const result = stripParleyDivergence(state);

  // c: lacks sp/gold, keeps every other key of the input c.
  assert.equal(Object.hasOwn(result.c, "sp"), false);
  assert.equal(Object.hasOwn(result.c, "gold"), false);
  const expectedCKeys = Object.keys(before.c).filter((k) => k !== "sp" && k !== "gold");
  assert.deepStrictEqual(Object.keys(result.c).sort(), expectedCKeys.sort());
  for (const k of expectedCKeys) {
    assert.deepStrictEqual(result.c[k], before.c[k], `c.${k} must be unchanged`);
  }

  // combat: lacks both flags, deep-equals the input combat minus those two keys.
  assert.equal(Object.hasOwn(result.combat, "parleyTried"), false);
  assert.equal(Object.hasOwn(result.combat, "parleyInsulted"), false);
  const { parleyTried, parleyInsulted, ...expectedCombat } = before.combat;
  assert.deepStrictEqual(result.combat, expectedCombat);

  // the input object is not mutated.
  assert.deepStrictEqual(state, before, "stripParleyDivergence must not mutate its argument");
});

test("D-13 no-op shape: a state with combat null and no flags comes back identical minus sp/gold", () => {
  const state = newRun(3);
  assert.equal(state.combat, null);
  const before = structuredClone(state);

  const result = stripParleyDivergence(state);

  const { sp, gold, ...cWithoutSpGold } = before.c;
  assert.deepStrictEqual(result, { ...before, c: cWithoutSpGold });
  assert.equal(result.combat, null, "the stripper never fabricates a combat object");
});

test("D-13 scoping: combatComparable still exposes c.sp and c.gold (the strip is scenario-scoped, never global)", () => {
  const state = newRun(303);
  const result = combatComparable(state);
  assert.ok(Object.hasOwn(result.c, "sp"));
  assert.ok(Object.hasOwn(result.c, "gold"));
  assert.equal(result.c.sp, state.c.sp);
  assert.equal(result.c.gold, state.c.gold);
});

test("D-13 defensive flags: flags absent in, flags absent out; flags present in, flags absent out", () => {
  const withoutFlags = newRun(3);
  withoutFlags.combat = { foes: [], type: "Beasts", round: 1, target: 0, spellOpen: false, tracked: false };
  const resultWithout = stripParleyDivergence(withoutFlags);
  assert.equal(Object.hasOwn(resultWithout.combat, "parleyTried"), false);
  assert.equal(Object.hasOwn(resultWithout.combat, "parleyInsulted"), false);

  const withFlags = newRun(3);
  withFlags.combat = {
    foes: [],
    type: "Beasts",
    round: 1,
    target: 0,
    spellOpen: false,
    tracked: false,
    parleyTried: true,
    parleyInsulted: true,
  };
  const resultWith = stripParleyDivergence(withFlags);
  assert.equal(Object.hasOwn(resultWith.combat, "parleyTried"), false);
  assert.equal(Object.hasOwn(resultWith.combat, "parleyInsulted"), false);
});
