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
  HAZARD_SCALE_AT_3,
  HAZARD_SCALE_AT_4,
  WALL_FROM_DEPTH,
  WALL_TO_DEPTH,
  WALL_FOE_POWER_AT_START,
  WALL_FOE_POWER_AT_END,
  BREAKAWAY_FROM_DEPTH,
  BREAKAWAY_TO_DEPTH,
  BREAKAWAY_FOE_POWER_AT_START,
  BREAKAWAY_FOE_POWER_AT_END,
  ENDGAME_FROM_DEPTH,
  ENDGAME_TO_DEPTH,
  ENDGAME_FOE_POWER_AT_START,
  ENDGAME_FOE_POWER_AT_END,
  WALL_HAZARD_SCALE,
  BREAKAWAY_HAZARD_SCALE,
  ENDGAME_HAZARD_SCALE,
  WALL_ABILITY_THREAT_AT_START,
  WALL_ABILITY_THREAT_AT_END,
  BREAKAWAY_ABILITY_THREAT_AT_START,
  BREAKAWAY_ABILITY_THREAT_AT_END,
  ENDGAME_ABILITY_THREAT_AT_START,
  ENDGAME_ABILITY_THREAT_AT_END,
  COMBAT_SCALE_FROM_DEPTH,
  FOE_GRACE_AT_1,
  FOE_GRACE_AT_2,
  FOE_GRACE_AT_3,
  FOE_GRACE_AT_4,
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
  // Phase 54 rung 5 (USER RULING C, secondary group): 13 -> 12 — the Filter
  // band's foePower and hazard knots were both <= 0.5 and still missing by
  // > 8 points after rungs 3+4's two fits.
  assert.equal(ENCOUNTER_DOT_CAP, 12);
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

test("hazardScale is exactly 1 at depth 1 (floor-1 parity) and equals the knot table elsewhere; never below 0.25", () => {
  assert.equal(Object.is(difficultyCurve(1).hazardScale, 1), true, "depth 1: hazardScale must be exactly 1");
  for (let depth = 1; depth <= 200; depth++) {
    assert.ok(
      difficultyCurve(depth).hazardScale >= 0.25,
      `depth ${depth}: hazardScale ${difficultyCurve(depth).hazardScale} below the knot clamp floor 0.25`,
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

test("Phase 54 (USER RULING C) knot pins: knot depths strictly increasing 2 < 3 < 4 < 5 < 8 < 9 < 15 < 16 < 20 < COMBAT_SCALE_FROM_DEPTH, FOE_GRACE_AT_1 === 1, HAZARD_FROM_DEPTH >= 2, every foePower knot in [0.25, 1.5], every hazard knot in [0.25, 1.0], every ability knot in [0.5, 1.0]", () => {
  const knotDepths = [2, 3, 4, WALL_FROM_DEPTH, WALL_TO_DEPTH, BREAKAWAY_FROM_DEPTH, BREAKAWAY_TO_DEPTH, ENDGAME_FROM_DEPTH, ENDGAME_TO_DEPTH];
  for (let i = 0; i < knotDepths.length - 1; i++) {
    assert.ok(knotDepths[i] < knotDepths[i + 1], `knot depths must strictly increase at index ${i}`);
  }
  assert.ok(knotDepths[knotDepths.length - 1] < COMBAT_SCALE_FROM_DEPTH);
  assert.equal(FOE_GRACE_AT_1, 1);
  assert.ok(HAZARD_FROM_DEPTH >= 2);
  for (const m of [
    FOE_GRACE_AT_2,
    FOE_GRACE_AT_3,
    FOE_GRACE_AT_4,
    WALL_FOE_POWER_AT_START,
    WALL_FOE_POWER_AT_END,
    BREAKAWAY_FOE_POWER_AT_START,
    BREAKAWAY_FOE_POWER_AT_END,
    ENDGAME_FOE_POWER_AT_START,
    ENDGAME_FOE_POWER_AT_END,
  ]) {
    assert.ok(m >= 0.25 && m <= 1.5, `foePower knot ${m} must be in [0.25, 1.5]`);
  }
  for (const m of [HAZARD_SCALE_AT_START, HAZARD_SCALE_AT_3, HAZARD_SCALE_AT_4, WALL_HAZARD_SCALE, BREAKAWAY_HAZARD_SCALE, ENDGAME_HAZARD_SCALE]) {
    assert.ok(m >= 0.25 && m <= 1.0, `hazard knot ${m} must be in [0.25, 1.0]`);
  }
  for (const m of [
    WALL_ABILITY_THREAT_AT_START,
    WALL_ABILITY_THREAT_AT_END,
    BREAKAWAY_ABILITY_THREAT_AT_START,
    BREAKAWAY_ABILITY_THREAT_AT_END,
    ENDGAME_ABILITY_THREAT_AT_START,
    ENDGAME_ABILITY_THREAT_AT_END,
  ]) {
    assert.ok(m >= 0.5 && m <= 1.0, `ability knot ${m} must be in [0.5, 1.0]`);
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

// CURVE_PINS — Phase 54 (USER RULING C, rung 3a): depths 2..25, 35, 50,
// MERGED from the retired FILTER_PINS (2-4) / BAND_PINS (5-15) /
// PHASE_53_ENDGAME_PINS (16-25/35/50) into ONE re-pinnable literal — every
// value here is landed at the rung-2 curve (byte-identity proof, see the
// ladder's commit history), measured live via `node -e` against
// engine/difficulty.js, NEVER hand-computed. Re-pinned per rung from then
// on, never loosened.
const CURVE_PINS = {
  2: { depth: 2, breather: false, dots: 11, darkBlobs: 1, darkRadius: 5, foeCap: 3, foeBonus: 0, foeLvlBias: 0, foePower: 0.32, hazardScale: 0.46, abilityThreat: 1, waterPools: 1 },
  3: { depth: 3, breather: false, dots: 11, darkBlobs: 1, darkRadius: 6, foeCap: 3, foeBonus: 0, foeLvlBias: 0, foePower: 0.44, hazardScale: 0.44, abilityThreat: 1, waterPools: 1 },
  4: { depth: 4, breather: false, dots: 11, darkBlobs: 2, darkRadius: 7, foeCap: 3, foeBonus: 0, foeLvlBias: 0, foePower: 0.31, hazardScale: 0.49, abilityThreat: 1, waterPools: 1 },
  5: { depth: 5, breather: false, dots: 11, darkBlobs: 3, darkRadius: 7, foeCap: 3, foeBonus: 0, foeLvlBias: 0, foePower: 0.25, hazardScale: 0.6, abilityThreat: 1, waterPools: 2 },
  6: { depth: 6, breather: true, dots: 9, darkBlobs: 0, darkRadius: 7, foeCap: 3, foeBonus: 0, foeLvlBias: 0, foePower: 0.2566666666666667, hazardScale: 0.6, abilityThreat: 1, waterPools: 1 },
  7: { depth: 7, breather: false, dots: 11, darkBlobs: 3, darkRadius: 7, foeCap: 3, foeBonus: 0, foeLvlBias: 0, foePower: 0.2633333333333333, hazardScale: 0.6, abilityThreat: 1, waterPools: 2 },
  8: { depth: 8, breather: false, dots: 11, darkBlobs: 3, darkRadius: 7, foeCap: 3, foeBonus: 0, foeLvlBias: 0, foePower: 0.27, hazardScale: 0.6, abilityThreat: 1, waterPools: 2 },
  9: { depth: 9, breather: false, dots: 11, darkBlobs: 3, darkRadius: 7, foeCap: 3, foeBonus: 0, foeLvlBias: 0, foePower: 0.27, hazardScale: 1, abilityThreat: 1, waterPools: 3 },
  10: { depth: 10, breather: false, dots: 11, darkBlobs: 3, darkRadius: 7, foeCap: 3, foeBonus: 0, foeLvlBias: 0, foePower: 0.2733333333333334, hazardScale: 1, abilityThreat: 1, waterPools: 3 },
  11: { depth: 11, breather: true, dots: 9, darkBlobs: 0, darkRadius: 7, foeCap: 3, foeBonus: 0, foeLvlBias: 0, foePower: 0.27666666666666667, hazardScale: 1, abilityThreat: 1, waterPools: 1 },
  12: { depth: 12, breather: false, dots: 12, darkBlobs: 3, darkRadius: 7, foeCap: 3, foeBonus: 0, foeLvlBias: 0, foePower: 0.28, hazardScale: 1, abilityThreat: 1, waterPools: 3 },
  13: { depth: 13, breather: false, dots: 12, darkBlobs: 3, darkRadius: 7, foeCap: 3, foeBonus: 0, foeLvlBias: 0, foePower: 0.2833333333333333, hazardScale: 1, abilityThreat: 1, waterPools: 3 },
  14: { depth: 14, breather: false, dots: 12, darkBlobs: 3, darkRadius: 7, foeCap: 3, foeBonus: 0, foeLvlBias: 0, foePower: 0.2866666666666667, hazardScale: 1, abilityThreat: 1, waterPools: 3 },
  15: { depth: 15, breather: false, dots: 12, darkBlobs: 3, darkRadius: 7, foeCap: 3, foeBonus: 0, foeLvlBias: 0, foePower: 0.29, hazardScale: 1, abilityThreat: 1, waterPools: 3 },
  16: { depth: 16, breather: true, dots: 9, darkBlobs: 0, darkRadius: 7, foeCap: 3, foeBonus: 0, foeLvlBias: 0, foePower: 0.41, hazardScale: 1, abilityThreat: 1, waterPools: 1 },
  17: { depth: 17, breather: false, dots: 12, darkBlobs: 3, darkRadius: 7, foeCap: 3, foeBonus: 0, foeLvlBias: 0, foePower: 0.4, hazardScale: 1, abilityThreat: 1, waterPools: 3 },
  18: { depth: 18, breather: false, dots: 12, darkBlobs: 3, darkRadius: 7, foeCap: 3, foeBonus: 0, foeLvlBias: 0, foePower: 0.39, hazardScale: 1, abilityThreat: 1, waterPools: 3 },
  19: { depth: 19, breather: false, dots: 12, darkBlobs: 3, darkRadius: 7, foeCap: 3, foeBonus: 0, foeLvlBias: 0, foePower: 0.37999999999999995, hazardScale: 1, abilityThreat: 1, waterPools: 3 },
  20: { depth: 20, breather: false, dots: 12, darkBlobs: 3, darkRadius: 7, foeCap: 3, foeBonus: 0, foeLvlBias: 0, foePower: 0.37, hazardScale: 1, abilityThreat: 1, waterPools: 3 },
  21: { depth: 21, breather: true, dots: 9, darkBlobs: 0, darkRadius: 7, foeCap: 3, foeBonus: 0, foeLvlBias: 0, foePower: 0.3715632754356696, hazardScale: 1, abilityThreat: 1.0098351698553982, waterPools: 1 },
  22: { depth: 22, breather: false, dots: 12, darkBlobs: 3, darkRadius: 7, foeCap: 3, foeBonus: 0, foeLvlBias: 0, foePower: 0.3730825178967847, hazardScale: 1, abilityThreat: 1.0193479044905147, waterPools: 3 },
  23: { depth: 23, breather: false, dots: 12, darkBlobs: 3, darkRadius: 7, foeCap: 3, foeBonus: 0, foeLvlBias: 0, foePower: 0.3745589676656425, hazardScale: 1, abilityThreat: 1.0285487745892121, waterPools: 3 },
  24: { depth: 24, breather: false, dots: 12, darkBlobs: 3, darkRadius: 7, foeCap: 3, foeBonus: 0, foeLvlBias: 0, foePower: 0.3759938300893533, hazardScale: 1, abilityThreat: 1.0374480042871157, waterPools: 3 },
  25: { depth: 25, breather: false, dots: 12, darkBlobs: 3, darkRadius: 7, foeCap: 3, foeBonus: 0, foeLvlBias: 0, foePower: 0.3773882765638649, hazardScale: 1, abilityThreat: 1.0460554825328159, waterPools: 3 },
  35: { depth: 35, breather: false, dots: 12, darkBlobs: 3, darkRadius: 7, foeCap: 4, foeBonus: 1, foeLvlBias: 0, foePower: 0.3893451323070264, hazardScale: 1, abilityThreat: 1.11804080208621, waterPools: 3 },
  50: { depth: 50, breather: false, dots: 12, darkBlobs: 3, darkRadius: 7, foeCap: 4, foeBonus: 1, foeLvlBias: 0, foePower: 0.40194730706492926, hazardScale: 1, abilityThreat: 1.1896361676485674, waterPools: 3 },
};

test("Phase 54 (USER RULING C) curve pins 2..25/35/50: difficultyCurve deepStrictEqual to the landed rung values — re-pinned per rung from node -e, never hand-typed, never loosened", () => {
  for (const [depth, expected] of Object.entries(CURVE_PINS)) {
    assert.deepStrictEqual(difficultyCurve(Number(depth)), expected, `depth ${depth}`);
  }
});

// Retired under USER RULING C (2026-09-21): "Phase 54 (BAND-01) Endgame
// identity — the --start-depth 20 yardstick" and "Phase 54 (BAND-02) the
// Wall steps UP … never steps DOWN across 5..20" — 16+ is now dialable
// (ENDGAME_FOE_POWER_AT_START/END) and the target p_L is U-shaped (foePower
// may legitimately dip then rise); CURVE_PINS above still catches any
// unintended drift on every sampled depth.

test("Phase 54 (BAND-02) difficultyCurve stays draw-free: arity 1 and engine/difficulty.js's code (comments stripped) never names an rng", () => {
  const src = fs.readFileSync(path.join(__dirname, "../../engine/difficulty.js"), "utf8");
  const stripped = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.equal(/\brng\b/.test(stripped), false, "engine/difficulty.js must never name an rng identifier");
  assert.equal(difficultyCurve.length, 1);
});
