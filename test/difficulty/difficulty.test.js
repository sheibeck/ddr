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

import test from "node:test";
import assert from "node:assert/strict";
import {
  difficultyCurve,
  isBreather,
  BREATHER_EVERY,
  ENCOUNTER_DOT_BASE,
  ENCOUNTER_DOT_CAP,
  ENCOUNTER_DOT_SOFT_K,
  DARK_BLOB_CAP,
  DARK_RADIUS_BASE,
  DARK_RADIUS_CAP,
} from "../../engine/difficulty.js";

test("named constants match the research starting-point defaults", () => {
  assert.equal(BREATHER_EVERY, 5);
  assert.equal(ENCOUNTER_DOT_BASE, 9);
  assert.equal(ENCOUNTER_DOT_CAP, 24);
  assert.equal(ENCOUNTER_DOT_SOFT_K, 12);
  assert.equal(DARK_BLOB_CAP, 6);
  assert.equal(DARK_RADIUS_BASE, 3);
  assert.equal(DARK_RADIUS_CAP, 9);
});

test("difficultyCurve never exceeds its documented caps at any sampled depth (1..10000)", () => {
  for (const depth of [1, 5, 6, 10, 20, 50, 100, 200, 1000, 10000]) {
    const dc = difficultyCurve(depth);
    assert.ok(dc.dots <= ENCOUNTER_DOT_CAP, `depth ${depth}: dots ${dc.dots} exceeds cap ${ENCOUNTER_DOT_CAP}`);
    assert.ok(dc.darkBlobs <= DARK_BLOB_CAP, `depth ${depth}: darkBlobs ${dc.darkBlobs} exceeds cap ${DARK_BLOB_CAP}`);
    assert.ok(dc.darkRadius <= DARK_RADIUS_CAP, `depth ${depth}: darkRadius ${dc.darkRadius} exceeds cap ${DARK_RADIUS_CAP}`);
  }
});

// PARITY-PRESERVATION GUARD (load-bearing): the bounded curve must reproduce
// the prototype's original 9+depth / depth-1 / 3+depth formulas EXACTLY
// across the already-tuned floors 1-5. This is what keeps Plan 02's
// floors-1-5 parity/round-trip/determinism suites green once genFloor is
// rewired to consume difficultyCurve(). If this test ever needs to change,
// that is an INTENTIONAL, deliberate retune signal — not a silent regression
// to wave through.
test("PARITY GUARD: depths 1-5 reproduce the prototype's exact 9+depth/depth-1/3+depth formula", () => {
  for (let depth = 1; depth <= 5; depth++) {
    const dc = difficultyCurve(depth);
    assert.equal(dc.dots, 9 + depth, `depth ${depth}: dots must equal 9+depth`);
    assert.equal(dc.darkBlobs, depth - 1, `depth ${depth}: darkBlobs must equal depth-1`);
    assert.equal(dc.darkRadius, 3 + depth, `depth ${depth}: darkRadius must equal 3+depth`);
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
  for (const depth of [0, -3, 1.5]) {
    const dc = difficultyCurve(depth);
    for (const [key, val] of Object.entries(dc)) {
      if (key === "breather") continue; // boolean field, not numeric
      assert.ok(Number.isFinite(val), `depth input ${depth}: field "${key}" is not finite (got ${val})`);
    }
  }
});

test("difficultyCurve consumes no rng (pure function of depth only — signature check)", () => {
  assert.equal(difficultyCurve.length, 1, "difficultyCurve must take exactly one argument (depth)");
});
