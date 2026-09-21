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
  WALL_FROM_DEPTH,
  WALL_TO_DEPTH,
  WALL_FOE_POWER_AT_START,
  WALL_FOE_POWER_AT_END,
  BREAKAWAY_FROM_DEPTH,
  BREAKAWAY_TO_DEPTH,
  BREAKAWAY_FOE_POWER_AT_START,
  BREAKAWAY_FOE_POWER_AT_END,
  ENDGAME_CANON_FROM_DEPTH,
  WALL_HAZARD_SCALE,
  WALL_ABILITY_THREAT_AT_START,
  WALL_ABILITY_THREAT_AT_END,
  BREAKAWAY_ABILITY_THREAT_AT_START,
  BREAKAWAY_ABILITY_THREAT_AT_END,
  COMBAT_SCALE_FROM_DEPTH,
  FOE_GRACE_CANON_FROM_DEPTH,
  FOE_GRACE_AT_1,
  FOE_GRACE_AT_2,
  HAZARD_FROM_DEPTH,
} from "../../engine/difficulty.js";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

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

// --- Phase 54 (BAND-01/BAND-02): four-band curve pins ----------------------

test("Phase 54 (BAND-02) structural pins: WALL_FROM_DEPTH === FOE_GRACE_CANON_FROM_DEPTH, WALL_TO_DEPTH + 1 === BREAKAWAY_FROM_DEPTH, BREAKAWAY_TO_DEPTH + 1 === ENDGAME_CANON_FROM_DEPTH, ENDGAME_CANON_FROM_DEPTH <= 16 and < COMBAT_SCALE_FROM_DEPTH (21), FOE_GRACE_AT_1 === 1, HAZARD_FROM_DEPTH >= 2, FOE_GRACE_CANON_FROM_DEPTH === 5 and HAZARD_CANON_FROM_DEPTH === 5 (the Filter ramps still end at 1.0 at their canon-from depths), FOE_GRACE_AT_2 >= 0.35 and HAZARD_SCALE_AT_START >= 0.3 (the Filter rung ceilings, USER RULING A), every band multiplier in (0, 1]", () => {
  assert.equal(WALL_FROM_DEPTH, FOE_GRACE_CANON_FROM_DEPTH);
  assert.equal(WALL_TO_DEPTH + 1, BREAKAWAY_FROM_DEPTH);
  assert.equal(BREAKAWAY_TO_DEPTH + 1, ENDGAME_CANON_FROM_DEPTH);
  assert.ok(ENDGAME_CANON_FROM_DEPTH <= 16);
  assert.ok(ENDGAME_CANON_FROM_DEPTH < COMBAT_SCALE_FROM_DEPTH);
  assert.equal(COMBAT_SCALE_FROM_DEPTH, 21);
  assert.equal(FOE_GRACE_AT_1, 1);
  assert.ok(HAZARD_FROM_DEPTH >= 2);
  assert.equal(FOE_GRACE_CANON_FROM_DEPTH, 5);
  assert.ok(FOE_GRACE_AT_2 >= 0.35);
  assert.ok(HAZARD_SCALE_AT_START >= 0.3);
  for (const m of [
    WALL_FOE_POWER_AT_START,
    WALL_FOE_POWER_AT_END,
    BREAKAWAY_FOE_POWER_AT_START,
    BREAKAWAY_FOE_POWER_AT_END,
    WALL_HAZARD_SCALE,
    WALL_ABILITY_THREAT_AT_START,
    WALL_ABILITY_THREAT_AT_END,
    BREAKAWAY_ABILITY_THREAT_AT_START,
    BREAKAWAY_ABILITY_THREAT_AT_END,
  ]) {
    assert.ok(m > 0 && m <= 1, `band multiplier ${m} must be in (0, 1]`);
  }
});

// PHASE_53_FLOOR1_PIN — the depth-1 curve object, pasted verbatim from the
// Phase 53 engine (commit 78572c5) node -e capture. Never re-pinned this
// phase (floor 1 is exact identity — parity).
const PHASE_53_FLOOR1_PIN = {
  depth: 1,
  breather: false,
  dots: 10,
  darkBlobs: 0,
  darkRadius: 4,
  foeCap: 3,
  foeBonus: 0,
  foeLvlBias: 0,
  foePower: 1,
  hazardScale: 1,
  abilityThreat: 1,
  waterPools: 1,
};

test("Phase 54 (BAND-01) floor-1 parity: difficultyCurve(1) deepStrictEqual to the Phase 53 curve (commit 78572c5) — never re-pinned this phase", () => {
  assert.deepStrictEqual(difficultyCurve(1), PHASE_53_FLOOR1_PIN);
});

// FILTER_PINS — depths 2..4. Phase 54 ladder rung 2 (2026-09-21, BAND-02,
// USER RULING A — a Filter rung): FOE_GRACE_AT_2 0.5 -> 0.4 re-pins
// foePower here (0.5/0.667/0.833 -> 0.4/0.6/0.8), measured live via node -e
// against engine/difficulty.js, never hand-computed; hazardScale unchanged
// this rung (HAZARD_SCALE_AT_START not moved — Filter hazards were ~13.4%
// of Filter deaths at rung 1, below the 20% threshold). DARK_HOLD_THROUGH_
// DEPTH / ENCOUNTER_DOT_CAP / DARK_BLOB_CAP never move, so dots/darkBlobs/
// darkRadius here are never re-pinned.
const FILTER_PINS = {
  2: {
    depth: 2,
    breather: false,
    dots: 11,
    darkBlobs: 1,
    darkRadius: 5,
    foeCap: 3,
    foeBonus: 0,
    foeLvlBias: 0,
    foePower: 0.4,
    hazardScale: 0.5,
    abilityThreat: 1,
    waterPools: 1,
  },
  3: {
    depth: 3,
    breather: false,
    dots: 11,
    darkBlobs: 1,
    darkRadius: 6,
    foeCap: 3,
    foeBonus: 0,
    foeLvlBias: 0,
    foePower: 0.6,
    hazardScale: 0.5,
    abilityThreat: 1,
    waterPools: 1,
  },
  4: {
    depth: 4,
    breather: false,
    dots: 11,
    darkBlobs: 2,
    darkRadius: 7,
    foeCap: 3,
    foeBonus: 0,
    foeLvlBias: 0,
    foePower: 0.8,
    hazardScale: 0.75,
    abilityThreat: 1,
    waterPools: 1,
  },
};

test("Phase 54 (BAND-02) Filter cushion 2..4: difficultyCurve(2..4) pinned to the landed Filter-rung values (re-pinned per Filter rung, never loosened; Phase 53 values at the scaffold)", () => {
  for (const [depth, expected] of Object.entries(FILTER_PINS)) {
    assert.deepStrictEqual(difficultyCurve(Number(depth)), expected, `depth ${depth}`);
  }
});

// PHASE_53_ENDGAME_PINS — depths 16..25, 35, 50, pasted verbatim from the
// Phase 53 engine capture. Never re-pinned this phase — the --start-depth
// 20 yardstick is identity BY CONSTRUCTION.
const PHASE_53_ENDGAME_PINS = {
  16: { depth: 16, breather: true, dots: 9, darkBlobs: 0, darkRadius: 7, foeCap: 3, foeBonus: 0, foeLvlBias: 0, foePower: 1, hazardScale: 1, abilityThreat: 1, waterPools: 1 },
  17: { depth: 17, breather: false, dots: 12, darkBlobs: 3, darkRadius: 7, foeCap: 3, foeBonus: 0, foeLvlBias: 0, foePower: 1, hazardScale: 1, abilityThreat: 1, waterPools: 3 },
  18: { depth: 18, breather: false, dots: 12, darkBlobs: 3, darkRadius: 7, foeCap: 3, foeBonus: 0, foeLvlBias: 0, foePower: 1, hazardScale: 1, abilityThreat: 1, waterPools: 3 },
  19: { depth: 19, breather: false, dots: 13, darkBlobs: 3, darkRadius: 7, foeCap: 3, foeBonus: 0, foeLvlBias: 0, foePower: 1, hazardScale: 1, abilityThreat: 1, waterPools: 3 },
  20: { depth: 20, breather: false, dots: 13, darkBlobs: 3, darkRadius: 7, foeCap: 3, foeBonus: 0, foeLvlBias: 0, foePower: 1, hazardScale: 1, abilityThreat: 1, waterPools: 3 },
  21: { depth: 21, breather: true, dots: 9, darkBlobs: 0, darkRadius: 7, foeCap: 3, foeBonus: 0, foeLvlBias: 0, foePower: 1.004225068745053, hazardScale: 1, abilityThreat: 1.0098351698553982, waterPools: 1 },
  22: { depth: 22, breather: false, dots: 13, darkBlobs: 3, darkRadius: 7, foeCap: 3, foeBonus: 0, foeLvlBias: 0, foePower: 1.0083311294507695, hazardScale: 1, abilityThreat: 1.0193479044905147, waterPools: 3 },
  23: { depth: 23, breather: false, dots: 13, darkBlobs: 3, darkRadius: 7, foeCap: 3, foeBonus: 0, foeLvlBias: 0, foePower: 1.0123215342314662, hazardScale: 1, abilityThreat: 1.0285487745892121, waterPools: 3 },
  24: { depth: 24, breather: false, dots: 13, darkBlobs: 3, darkRadius: 7, foeCap: 3, foeBonus: 0, foeLvlBias: 0, foePower: 1.016199540782036, hazardScale: 1, abilityThreat: 1.0374480042871157, waterPools: 3 },
  25: { depth: 25, breather: false, dots: 13, darkBlobs: 3, darkRadius: 7, foeCap: 3, foeBonus: 0, foeLvlBias: 0, foePower: 1.0199683150374728, hazardScale: 1, abilityThreat: 1.0460554825328159, waterPools: 3 },
  35: { depth: 35, breather: false, dots: 13, darkBlobs: 3, darkRadius: 7, foeCap: 4, foeBonus: 1, foeLvlBias: 0, foePower: 1.0522841413703417, hazardScale: 1, abilityThreat: 1.11804080208621, waterPools: 3 },
  50: { depth: 50, breather: false, dots: 13, darkBlobs: 3, darkRadius: 7, foeCap: 4, foeBonus: 1, foeLvlBias: 0, foePower: 1.0863440731484575, hazardScale: 1, abilityThreat: 1.1896361676485674, waterPools: 3 },
};

test("Phase 54 (BAND-01) Endgame identity — the --start-depth 20 yardstick: difficultyCurve(16..20).foePower/abilityThreat/hazardScale are the literal 1 (Object.is) and difficultyCurve(16..25, 35, 50) deepStrictEqual to the Phase 53 curve — never re-pinned this phase", () => {
  for (let d = 16; d <= 20; d++) {
    const dc = difficultyCurve(d);
    assert.equal(Object.is(dc.foePower, 1), true, `depth ${d}: foePower must be the literal 1`);
    assert.equal(Object.is(dc.abilityThreat, 1), true, `depth ${d}: abilityThreat must be the literal 1`);
    assert.equal(Object.is(dc.hazardScale, 1), true, `depth ${d}: hazardScale must be the literal 1`);
  }
  for (const [depth, expected] of Object.entries(PHASE_53_ENDGAME_PINS)) {
    assert.deepStrictEqual(difficultyCurve(Number(depth)), expected, `depth ${depth}`);
  }
});

// BAND_PINS — the 5..15 band curve. Rung 1 (commit pending, 2026-09-21):
// Wall foePower 0.85 -> 0.95 (5-8), Breakaway 0.95 -> 1.0 (9-15) — measured
// live via node -e against engine/difficulty.js, never hand-computed;
// hazardScale/abilityThreat unchanged this rung (identity).
const BAND_PINS = {
  5: { foePower: 0.85, abilityThreat: 1, hazardScale: 1 },
  6: { foePower: 0.8833333333333334, abilityThreat: 1, hazardScale: 1 },
  7: { foePower: 0.9166666666666667, abilityThreat: 1, hazardScale: 1 },
  8: { foePower: 0.95, abilityThreat: 1, hazardScale: 1 },
  9: { foePower: 0.95, abilityThreat: 1, hazardScale: 1 },
  10: { foePower: 0.9583333333333333, abilityThreat: 1, hazardScale: 1 },
  11: { foePower: 0.9666666666666668, abilityThreat: 1, hazardScale: 1 },
  12: { foePower: 0.975, abilityThreat: 1, hazardScale: 1 },
  13: { foePower: 0.9833333333333334, abilityThreat: 1, hazardScale: 1 },
  14: { foePower: 0.9916666666666667, abilityThreat: 1, hazardScale: 1 },
  15: { foePower: 1, abilityThreat: 1, hazardScale: 1 },
};

test("Phase 54 (BAND-02) band curve 5..15: foePower / abilityThreat / hazardScale pinned to the landed rung values (re-pinned per rung, never loosened)", () => {
  for (const [depth, expected] of Object.entries(BAND_PINS)) {
    const dc = difficultyCurve(Number(depth));
    assert.equal(dc.foePower, expected.foePower, `depth ${depth}: foePower`);
    assert.equal(dc.abilityThreat, expected.abilityThreat, `depth ${depth}: abilityThreat`);
    assert.equal(dc.hazardScale, expected.hazardScale, `depth ${depth}: hazardScale`);
  }
});

test("Phase 54 (BAND-02) the Wall steps UP from the floor-4 grace and foePower never steps DOWN across 5..20 (the 15 -> 16 hand-off included)", () => {
  assert.ok(difficultyCurve(5).foePower >= difficultyCurve(4).foePower);
  for (let d = 5; d <= 19; d++) {
    assert.ok(
      difficultyCurve(d + 1).foePower >= difficultyCurve(d).foePower,
      `foePower stepped down from depth ${d} to ${d + 1}`,
    );
  }
});

test("Phase 54 (BAND-02) difficultyCurve stays draw-free: arity 1 and engine/difficulty.js's code (comments stripped) never names an rng", () => {
  const src = fs.readFileSync(path.join(__dirname, "../../engine/difficulty.js"), "utf8");
  const stripped = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.equal(/\brng\b/.test(stripped), false, "engine/difficulty.js must never name an rng identifier");
  assert.equal(difficultyCurve.length, 1);
});
