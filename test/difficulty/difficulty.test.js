// test/difficulty/difficulty.test.js
//
// Property tests for engine/difficulty.js's difficultyCurve(depth) — the
// bounded, asymptotic soft-cap curve that replaces the prototype's unbounded
// `9+depth` / `depth-1` / `3+depth` floor-generation knobs (RUN-03).
//
// Written FIRST (RED) per this task's tdd="true" contract: engine/difficulty.js
// does not exist yet when this file is first run. No consumer wires this
// module yet (that's Plan 02) — these tests exercise difficultyCurve() as a
// pure function of `depth` alone, in isolation.
//
// Phase 27 (2026-09-15, TUNE-06): the PARITY GUARD below was split into a
// floors-1-2 canon loop (fixture-exposed: every combat/magic/chargen/
// economy/encounters fixture is floor 1; the movement fixture's seed 256
// descends to floor 2) and a floors-3-5 Phase 27 pins loop (the retune's
// deliberate early-floor easing — an intentional signal, not a regression).

import test from "node:test";
import assert from "node:assert/strict";
import {
  difficultyCurve,
  isBreather,
  BREATHER_EVERY,
  ENCOUNTER_DOT_BASE,
  ENCOUNTER_DOT_CAP,
  ENCOUNTER_DOT_SOFT_K,
  DENSITY_CANON_THROUGH_DEPTH,
  DARK_BLOB_CAP,
  DARK_RADIUS_BASE,
  DARK_RADIUS_CAP,
  DARK_HOLD_THROUGH_DEPTH,
  HAZARD_SCALE_AT_START,
} from "../../engine/difficulty.js";

test("named constants match the research starting-point defaults", () => {
  assert.equal(BREATHER_EVERY, 5);
  assert.equal(ENCOUNTER_DOT_BASE, 9);
  // Phase 27 (2026-09-15, TUNE-06): was 24 -> 15 (27-02) -> 13 (27-03
  // iteration 3, against the forced-20 band).
  assert.equal(ENCOUNTER_DOT_CAP, 13);
  assert.equal(ENCOUNTER_DOT_SOFT_K, 12);
  assert.equal(DENSITY_CANON_THROUGH_DEPTH, 2);
  // Phase 27 (2026-09-15, TUNE-06): was 6 — fewer dark-zone seed blobs at
  // the eased depths.
  assert.equal(DARK_BLOB_CAP, 3);
  assert.equal(DARK_RADIUS_BASE, 3);
  // Phase 27 (2026-09-15, TUNE-06): was 9 — a smaller per-blob reveal
  // radius ceiling at the eased depths.
  assert.equal(DARK_RADIUS_CAP, 7);
  assert.equal(DARK_HOLD_THROUGH_DEPTH, 3);
});

test("difficultyCurve never exceeds its documented caps at any sampled depth (1..10000)", () => {
  for (const depth of [1, 5, 6, 10, 20, 50, 100, 200, 1000, 10000]) {
    const dc = difficultyCurve(depth);
    assert.ok(dc.dots <= ENCOUNTER_DOT_CAP, `depth ${depth}: dots ${dc.dots} exceeds cap ${ENCOUNTER_DOT_CAP}`);
    assert.ok(dc.darkBlobs <= DARK_BLOB_CAP, `depth ${depth}: darkBlobs ${dc.darkBlobs} exceeds cap ${DARK_BLOB_CAP}`);
    assert.ok(dc.darkRadius <= DARK_RADIUS_CAP, `depth ${depth}: darkRadius ${dc.darkRadius} exceeds cap ${DARK_RADIUS_CAP}`);
  }
});

// PARITY GUARD: depths 1-2 (load-bearing, fixture-exposed) -----------------
// The bounded curve must reproduce the prototype's original 9+depth /
// depth-1 / 3+depth formulas EXACTLY at floors 1-2 — every combat/magic/
// chargen/economy/encounters fixture is floor 1, and the movement fixture's
// seed 256 descends to floor 2. If this test ever needs to change, that is
// an INTENTIONAL, deliberate retune signal touching a fixture-exposed floor
// — not a silent regression to wave through.
test("PARITY GUARD: depths 1-2 reproduce the prototype's exact 9+depth/depth-1/3+depth formula (fixture-exposed)", () => {
  for (let depth = 1; depth <= 2; depth++) {
    const dc = difficultyCurve(depth);
    assert.equal(dc.dots, 9 + depth, `depth ${depth}: dots must equal 9+depth`);
    assert.equal(dc.darkBlobs, depth - 1, `depth ${depth}: darkBlobs must equal depth-1`);
    assert.equal(dc.darkRadius, 3 + depth, `depth ${depth}: darkRadius must equal 3+depth`);
  }
});

// Phase 27 deliberate easing (TUNE-06): depths 3-5 are pinned to the retune
// values — this IS the intentional retune signal the comment above refers
// to; no fixture reaches these depths.
test("Phase 27 deliberate easing (TUNE-06): depths 3-5 are pinned to the retune values", () => {
  // 27-03 iteration 3 (ENCOUNTER_DOT_CAP 15 -> 13, against the forced-20
  // band): depths 4-5's dots drop by one (12 -> 11) — re-measured live.
  const PINS = {
    3: { dots: 11, darkBlobs: 1, darkRadius: 6 },
    4: { dots: 11, darkBlobs: 2, darkRadius: 7 },
    5: { dots: 11, darkBlobs: 3, darkRadius: 7 },
  };
  for (const [depth, expected] of Object.entries(PINS)) {
    const dc = difficultyCurve(Number(depth));
    assert.equal(dc.dots, expected.dots, `depth ${depth}: dots`);
    assert.equal(dc.darkBlobs, expected.darkBlobs, `depth ${depth}: darkBlobs`);
    assert.equal(dc.darkRadius, expected.darkRadius, `depth ${depth}: darkRadius`);
  }
});

test("hazardScale is exactly 1 at depths 1, 5, 6, 20 and never below HAZARD_SCALE_AT_START", () => {
  for (const depth of [1, 5, 6, 20]) {
    assert.equal(Object.is(difficultyCurve(depth).hazardScale, 1), true, `depth ${depth}: hazardScale must be exactly 1`);
  }
  for (let depth = 1; depth <= 200; depth++) {
    assert.ok(
      difficultyCurve(depth).hazardScale >= HAZARD_SCALE_AT_START,
      `depth ${depth}: hazardScale ${difficultyCurve(depth).hazardScale} below HAZARD_SCALE_AT_START`,
    );
  }
});

test("isBreather is true exactly for depths 6, 11, 16, 21 (BREATHER_EVERY cadence)", () => {
  const expectedTrue = [6, 11, 16, 21];
  const expectedFalse = [1, 2, 3, 4, 5, 7, 10];
  for (const depth of expectedTrue) assert.equal(isBreather(depth), true, `depth ${depth} should be a breather`);
  for (const depth of expectedFalse) assert.equal(isBreather(depth), false, `depth ${depth} should NOT be a breather`);
});

test("breather floors zero darkBlobs and floor the dot count to the baseline", () => {
  for (const depth of [6, 11, 16, 21]) {
    const dc = difficultyCurve(depth);
    assert.equal(dc.breather, true, `depth ${depth}: dc.breather should be true`);
    assert.equal(dc.darkBlobs, 0, `depth ${depth}: breather floor must have zero dark blobs`);
    assert.equal(dc.dots, ENCOUNTER_DOT_BASE, `depth ${depth}: breather floor must floor dots to baseline`);
  }
});

test("dots, darkBlobs, darkRadius are non-decreasing across non-breather depths, up to their caps", () => {
  let prevDots = -Infinity;
  let prevBlobs = -Infinity;
  let prevRadius = -Infinity;
  for (let depth = 1; depth <= 200; depth++) {
    if (isBreather(depth)) continue; // breather floors intentionally dip by design
    const dc = difficultyCurve(depth);
    assert.ok(dc.dots >= prevDots, `depth ${depth}: dots regressed (${dc.dots} < ${prevDots})`);
    assert.ok(dc.darkBlobs >= prevBlobs, `depth ${depth}: darkBlobs regressed (${dc.darkBlobs} < ${prevBlobs})`);
    assert.ok(dc.darkRadius >= prevRadius, `depth ${depth}: darkRadius regressed (${dc.darkRadius} < ${prevRadius})`);
    prevDots = dc.dots;
    prevBlobs = dc.darkBlobs;
    prevRadius = dc.darkRadius;
  }
});

test("difficultyCurve tolerates a non-integer or non-positive depth without NaN/Infinity output", () => {
  // IN-01: NaN/Infinity/-Infinity added alongside the original [0, -3, 1.5]
  // cases -- safeDepth()'s own doc comment specifically calls out NaN/
  // +-Infinity as the motivating threat ("Handles NaN/+-Infinity too"), but
  // the test previously never exercised difficultyCurve() with them
  // directly. Math.floor(NaN)/Math.floor(+-Infinity) are all non-finite, so
  // Number.isFinite short-circuits every one of them to the depth-1 floor.
  for (const depth of [0, -3, 1.5, NaN, Infinity, -Infinity]) {
    const dc = difficultyCurve(depth);
    for (const [key, val] of Object.entries(dc)) {
      if (key === "breather") continue; // boolean field, not numeric
      assert.ok(Number.isFinite(val), `depth input ${depth}: field "${key}" is not finite (got ${val})`);
    }
  }
});

test("IN-01: isBreather also tolerates NaN/Infinity/-Infinity without throwing or returning non-boolean", () => {
  for (const depth of [NaN, Infinity, -Infinity]) {
    assert.equal(typeof isBreather(depth), "boolean", `isBreather(${depth}) must return a boolean`);
  }
});

test("difficultyCurve consumes no rng (pure function of depth only — signature check)", () => {
  assert.equal(difficultyCurve.length, 1, "difficultyCurve must take exactly one argument (depth)");
});
