// test/unit/control-at-depth.test.js
//
// Phase 75.3, Plan 04 (RULES-18) — "Control spells at depth": from floor 13
// (the knee), a foe increasingly SHAKES OFF Freeze, Stone, Doze/Sleep,
// Weaken and Stupid on a derived-stream, roll-high d20, and an "indefinite"
// control (a Freeze/Stone kill, Stupidity, Blind, the Walnut Staff's weaken,
// the Birch/Cedar staves' 99-round sleep, the Lullaby's 24) holds the foe for
// a few rounds instead — see this plan's own PLAN.md "control audit" table
// for the full id list (C1-C19, X1-X7). This file covers audit ids C2, C3,
// C9, C13, C15 (every combat.js control site) plus the shared dial helpers
// (engine/difficulty.js), the resist check (engine/derived.js) and the
// narration/chip surfaces (src/browser/eventNarration.js, narrationLines.js,
// foeConditions.js) — 75.3-05 covers the hero's own spells and items. Task 1
// (below) proves the dial helpers and the resist check in isolation; Task 2
// grows this file with the held mechanics and every combat.js control site;
// Task 3 adds narration/chip coverage.
//
// Runs under the SHIPPED (fitted) DIALS, not identity — CONTROL_AT_DEPTH's
// own behaviour numbers in this plan's <behavior> block (floor 20 -> 8
// faces, floor 13 -> hold 3, ...) are the FITTED start values, not the
// identity ({0,0,0}) ones test/unit/harness/identityDials.js carries.
//
// Determinism idiom: every forced resist/hold outcome in this file is found
// by searching state.acts (0..5000, bounded) against the REAL
// engine/derived.js#controlResistCheck — never a mocked derivedRng — mirroring
// test/unit/scroll-read.test.js#forceOutcome and 75.1-01's own precedent.

import test from "node:test";
import assert from "node:assert/strict";

import { controlResistRoll, controlResistCheck } from "../../engine/derived.js";
import {
  DIALS,
  setDialsForTuning,
  controlResistFacesFor,
  controlHoldRoundsFor,
  controlCapRounds,
} from "../../engine/difficulty.js";

/** fakeRng(seq) — `.d()` pops the next value off `seq`; throws on underflow.
 * `getState` is a FIXED stub (default 0) — deliberately NOT a real cursor —
 * so a test can pick any known cursor value for controlResistCheck's derived
 * stream independent of how many `.d()` calls the surrounding code makes. */
function fakeRng(seq, { getState = () => 0 } = {}) {
  let i = 0;
  return {
    d(_sides) {
      if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick: (arr) => arr[0],
    shuffle: (a) => a,
    getState,
  };
}

// ---------------------------------------------------------------------------
// Task 1: CONTROL_AT_DEPTH, controlResistFacesFor/controlHoldRoundsFor/
// controlCapRounds, controlResistRoll, controlResistCheck.
// ---------------------------------------------------------------------------

test("CONTROL_AT_DEPTH ships at { kneeDepth: 12, resistPerDepth: 1, resistCap: 15, holdRounds: 3 }", () => {
  assert.deepEqual(DIALS.CONTROL_AT_DEPTH, { kneeDepth: 12, resistPerDepth: 1, resistCap: 15, holdRounds: 3 });
});

test("controlResistFacesFor: boundary and precision at the shipped dials", () => {
  assert.equal(controlResistFacesFor(1), 0);
  assert.equal(controlResistFacesFor(11), 0);
  assert.equal(controlResistFacesFor(12), 0);
  assert.equal(controlResistFacesFor(13), 1);
  assert.equal(controlResistFacesFor(20), 8);
  assert.equal(controlResistFacesFor(27), 15);
  assert.equal(controlResistFacesFor(40), 15);
  assert.equal(controlResistFacesFor(13.9), 1, "safeDepth floors a non-integer depth");
  assert.equal(controlResistFacesFor(NaN), 0, "safeDepth reads NaN as depth 1");
});

test("controlResistFacesFor: resistPerDepth 0.5 rounds half up; resistCap never exceeds 19", () => {
  const restore = setDialsForTuning({ CONTROL_AT_DEPTH: { kneeDepth: 12, resistPerDepth: 0.5, resistCap: 15, holdRounds: 3 } });
  try {
    assert.equal(controlResistFacesFor(13), 1);
    assert.equal(controlResistFacesFor(14), 1);
    assert.equal(controlResistFacesFor(15), 2);
  } finally {
    restore();
  }
  const restore2 = setDialsForTuning({ CONTROL_AT_DEPTH: { kneeDepth: 12, resistPerDepth: 1, resistCap: 25, holdRounds: 3 } });
  try {
    assert.equal(controlResistFacesFor(60), 19, "a d20's own top face always wins for the controller");
  } finally {
    restore2();
  }
});

test("controlHoldRoundsFor / controlCapRounds: 0 at or below the knee, holdRounds past it", () => {
  assert.equal(controlHoldRoundsFor(12), 0);
  assert.equal(controlHoldRoundsFor(13), 3);
  assert.equal(controlCapRounds(13, 99), 3);
  assert.equal(controlCapRounds(13, 2), 2, "a short rolled duration under the cap is never raised");
  assert.equal(controlCapRounds(12, 99), 99, "no cap at or below the knee");
});

test("identity: resistPerDepth/resistCap/holdRounds all 0 means no resist face and no hold cap at any depth", () => {
  const restore = setDialsForTuning({ CONTROL_AT_DEPTH: { kneeDepth: 12, resistPerDepth: 0, resistCap: 0, holdRounds: 0 } });
  try {
    for (const d of [1, 12, 13, 20, 42]) {
      assert.equal(controlResistFacesFor(d), 0, `depth ${d} faces`);
      assert.equal(controlHoldRoundsFor(d), 0, `depth ${d} hold`);
      assert.equal(controlCapRounds(d, 99), 99, `depth ${d} cap`);
    }
  } finally {
    restore();
  }
});

test("controlResistRoll: resists exactly on rolls 13-20 of a scripted d20 (roll-high, faces 8); 0 faces never draws", () => {
  // rollCheck mirrors raw draw r -> roll = 21 - r; resisted = roll >= atLeast (13).
  // roll 13..20 <=> raw draw 8..1.
  for (let raw = 1; raw <= 8; raw++) {
    const rng = fakeRng([raw]);
    const result = controlResistRoll(rng, 8);
    assert.equal(result.resisted, true, `raw draw ${raw} (roll ${21 - raw}) must resist`);
  }
  for (let raw = 9; raw <= 20; raw++) {
    const rng = fakeRng([raw]);
    const result = controlResistRoll(rng, 8);
    assert.equal(result.resisted, false, `raw draw ${raw} (roll ${21 - raw}) must not resist`);
  }
  const zero = controlResistRoll(fakeRng([]), 0);
  assert.deepEqual(zero, { rolled: false, resisted: false, roll: undefined });
});

test("controlResistCheck: floor 12 draws nothing (a spy on the main rng sees zero calls); floor 20 leaves the main cursor untouched", () => {
  let calls = 0;
  const spy = { d(sides) { calls++; return 1; }, getState: () => 999 };
  const before = controlResistCheck({ floor: { depth: 12 }, acts: 0, combat: { round: 1 } }, spy, "test", 0);
  assert.equal(calls, 0, "no draw at all at or below the knee");
  assert.deepEqual(before, { rolled: false, resisted: false, roll: undefined, faces: 0 });

  const cursorSpy = { getState: () => 12345 };
  const result = controlResistCheck({ floor: { depth: 20 }, acts: 3, combat: { round: 1 } }, cursorSpy, "test", 0);
  assert.equal(result.rolled, true);
  assert.equal(cursorSpy.getState(), 12345, "the main cursor is unchanged by the derived-stream draw");
});

test("controlResistCheck: the same (state, purpose, idx) gives the same result twice; a different idx can differ", () => {
  const probe = { getState: () => 0 };
  const a = controlResistCheck({ floor: { depth: 20 }, acts: 5, combat: { round: 1 } }, probe, "freeze:Freeze", 0);
  const b = controlResistCheck({ floor: { depth: 20 }, acts: 5, combat: { round: 1 } }, probe, "freeze:Freeze", 0);
  assert.deepEqual(a, b);
  const results = new Set();
  for (let idx = 0; idx < 12; idx++) {
    results.add(JSON.stringify(controlResistCheck({ floor: { depth: 20 }, acts: 5, combat: { round: 1 } }, probe, "freeze:Freeze", idx)));
  }
  assert.ok(results.size > 1, "at least one idx must produce a different result");
});
