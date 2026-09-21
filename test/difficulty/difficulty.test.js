// test/difficulty/difficulty.test.js
//
// Phase 54 (BAND-02, 2026-09-21, USER RULING D) — the GLOBAL DIFFICULTY
// MODEL rewrite: every floor-range knot/band constant is retired in favor of
// ONE frozen `DIALS` object (every key ONE number or `{ base, perDepth }`),
// evaluated by `difficultyCurve(depth)` and applied through the pure helpers
// this file pins. History (the five-rung floor-range knot ladder, commits
// b0facb6..1cb56c6) lives in docs/DIFFICULTY-RETUNE.md's ledger, not here.
//
// Every literal below is pasted from `node -e` output against the landed
// engine/difficulty.js — never hand-computed.

import test from "node:test";
import assert from "node:assert/strict";
import {
  DIALS,
  setDialsForTuning,
  difficultyCurve,
  foeLevelFor,
  FOE_COUNT_TABLE,
  foeCountFor,
  foeWpFor,
  foeHitFor,
  roundDamageCapFor,
  heroMeanMaxWpFor,
  heroMaxWpFor,
  heroRegenFor,
  heroSpFor,
  campHealFor,
  dotHpFor,
  startingRationsFor,
  tierSpreadFor,
  scaleHazard,
  abilityCadenceFor,
  isBreather,
  BREATHER_EVERY,
} from "../../engine/difficulty.js";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// ─── USER RULING D: the remove list is GONE — no floor-range name survives ──

test("USER RULING D: DIALS is frozen and its key set is exactly the global model's 27 dials", () => {
  assert.equal(Object.isFrozen(DIALS), true);
  const keys = Object.keys(DIALS).sort();
  assert.deepStrictEqual(keys, [
    "ABILITY_THREAT",
    "CAMP_HEAL_FRACTION",
    "CLASS_MITIGATION",
    "DARK_BLOBS",
    "DARK_BLOB_CAP",
    "DARK_RADIUS",
    "DARK_RADIUS_CAP",
    "DOT_HP_FRACTION",
    "DOT_MIX",
    "ENCOUNTER_DOTS",
    "FLEE_NEED_MOD",
    "FOE_ACCURACY",
    "FOE_COUNT_SKEW",
    "FOE_HIT_SCALE",
    "FOE_HP_SCALE",
    "FOE_LEVEL",
    "FOOD_CLOCK",
    "HAZARD_SCALE",
    "HERO_HP_SCALE",
    "HERO_REGEN_PER_FLOOR",
    "HERO_SP_SCALE",
    "LOOT_SCALE",
    "PARLEY_NEED_MOD",
    "ROUND_DAMAGE_CEILING",
    "STARTING_GOLD",
    "STARTING_POTION_BONUS",
    "STORE_TIER",
    "TIER_SPREAD",
    "WANDER_RATE",
  ].sort());
});

test("USER RULING D: the module's export key set contains no floor-range name (no FROM/TO/THROUGH_DEPTH, no _AT_START/END/N, no SOFT_K, GRACE, KNOT, CANON)", async () => {
  const m = await import("../../engine/difficulty.js");
  const bad = Object.keys(m).filter((k) => /_(FROM|TO|THROUGH)_DEPTH$|_AT_(START|END|[0-9]+)$|SOFT_K$|GRACE|KNOT|CANON/.test(k));
  assert.deepStrictEqual(bad, []);
});

test("USER RULING D: MAZE_SIZE is absent from DIALS and mazeSize absent from the curve (cut from Phase 54)", () => {
  assert.equal("MAZE_SIZE" in DIALS, false);
  assert.equal("mazeSize" in difficultyCurve(1), false);
});

// ─── the identity column ────────────────────────────────────────────────────

test("identity column: difficultyCurve(1) reads canon exactly", () => {
  assert.deepStrictEqual(difficultyCurve(1), {
    depth: 1,
    breather: false,
    dots: 10,
    darkBlobs: 0,
    darkRadius: 4,
    waterPools: 1,
    storeTier: 0,
    foeLevel: 1,
    foeHitScale: 1,
    foeHpScale: 1,
    hazardScale: 1,
    abilityThreat: 1,
  });
});

// CURVE_PINS — depths 2..25, 35, 50, pasted verbatim from `node -e` against
// the landed identity-column engine.
const CURVE_PINS = {
  2: { depth: 2, breather: false, dots: 11, darkBlobs: 1, darkRadius: 5, waterPools: 1, storeTier: 1, foeLevel: 1, foeHitScale: 1, foeHpScale: 1, hazardScale: 1, abilityThreat: 1 },
  3: { depth: 3, breather: false, dots: 12, darkBlobs: 2, darkRadius: 6, waterPools: 1, storeTier: 1, foeLevel: 1, foeHitScale: 1, foeHpScale: 1, hazardScale: 1, abilityThreat: 1 },
  4: { depth: 4, breather: false, dots: 13, darkBlobs: 2, darkRadius: 7, waterPools: 1, storeTier: 1, foeLevel: 1, foeHitScale: 1, foeHpScale: 1, hazardScale: 1, abilityThreat: 1 },
  5: { depth: 5, breather: false, dots: 14, darkBlobs: 3, darkRadius: 7, waterPools: 2, storeTier: 2, foeLevel: 2, foeHitScale: 1, foeHpScale: 1, hazardScale: 1, abilityThreat: 1 },
  6: { depth: 6, breather: true, dots: 9, darkBlobs: 0, darkRadius: 7, waterPools: 1, storeTier: 2, foeLevel: 2, foeHitScale: 1, foeHpScale: 1, hazardScale: 1, abilityThreat: 1 },
  7: { depth: 7, breather: false, dots: 16, darkBlobs: 3, darkRadius: 7, waterPools: 2, storeTier: 2, foeLevel: 2, foeHitScale: 1, foeHpScale: 1, hazardScale: 1, abilityThreat: 1 },
  8: { depth: 8, breather: false, dots: 17, darkBlobs: 3, darkRadius: 7, waterPools: 2, storeTier: 2, foeLevel: 2, foeHitScale: 1, foeHpScale: 1, hazardScale: 1, abilityThreat: 1 },
  9: { depth: 9, breather: false, dots: 18, darkBlobs: 3, darkRadius: 7, waterPools: 3, storeTier: 3, foeLevel: 2, foeHitScale: 1, foeHpScale: 1, hazardScale: 1, abilityThreat: 1 },
  10: { depth: 10, breather: false, dots: 19, darkBlobs: 3, darkRadius: 7, waterPools: 3, storeTier: 3, foeLevel: 3, foeHitScale: 1, foeHpScale: 1, hazardScale: 1, abilityThreat: 1 },
  11: { depth: 11, breather: true, dots: 9, darkBlobs: 0, darkRadius: 7, waterPools: 1, storeTier: 3, foeLevel: 3, foeHitScale: 1, foeHpScale: 1, hazardScale: 1, abilityThreat: 1 },
  12: { depth: 12, breather: false, dots: 21, darkBlobs: 3, darkRadius: 7, waterPools: 3, storeTier: 3, foeLevel: 3, foeHitScale: 1, foeHpScale: 1, hazardScale: 1, abilityThreat: 1 },
  13: { depth: 13, breather: false, dots: 22, darkBlobs: 3, darkRadius: 7, waterPools: 3, storeTier: 3, foeLevel: 3, foeHitScale: 1, foeHpScale: 1, hazardScale: 1, abilityThreat: 1 },
  14: { depth: 14, breather: false, dots: 23, darkBlobs: 3, darkRadius: 7, waterPools: 3, storeTier: 3, foeLevel: 3, foeHitScale: 1, foeHpScale: 1, hazardScale: 1, abilityThreat: 1 },
  15: { depth: 15, breather: false, dots: 24, darkBlobs: 3, darkRadius: 7, waterPools: 3, storeTier: 3, foeLevel: 4, foeHitScale: 1, foeHpScale: 1, hazardScale: 1, abilityThreat: 1 },
  16: { depth: 16, breather: true, dots: 9, darkBlobs: 0, darkRadius: 7, waterPools: 1, storeTier: 3, foeLevel: 4, foeHitScale: 1, foeHpScale: 1, hazardScale: 1, abilityThreat: 1 },
  17: { depth: 17, breather: false, dots: 26, darkBlobs: 3, darkRadius: 7, waterPools: 3, storeTier: 3, foeLevel: 4, foeHitScale: 1, foeHpScale: 1, hazardScale: 1, abilityThreat: 1 },
  18: { depth: 18, breather: false, dots: 27, darkBlobs: 3, darkRadius: 7, waterPools: 3, storeTier: 3, foeLevel: 4, foeHitScale: 1, foeHpScale: 1, hazardScale: 1, abilityThreat: 1 },
  19: { depth: 19, breather: false, dots: 28, darkBlobs: 3, darkRadius: 7, waterPools: 3, storeTier: 3, foeLevel: 4, foeHitScale: 1, foeHpScale: 1, hazardScale: 1, abilityThreat: 1 },
  20: { depth: 20, breather: false, dots: 29, darkBlobs: 3, darkRadius: 7, waterPools: 3, storeTier: 3, foeLevel: 5, foeHitScale: 1, foeHpScale: 1, hazardScale: 1, abilityThreat: 1 },
  21: { depth: 21, breather: true, dots: 9, darkBlobs: 0, darkRadius: 7, waterPools: 1, storeTier: 3, foeLevel: 5, foeHitScale: 1, foeHpScale: 1, hazardScale: 1, abilityThreat: 1 },
  22: { depth: 22, breather: false, dots: 31, darkBlobs: 3, darkRadius: 7, waterPools: 3, storeTier: 3, foeLevel: 5, foeHitScale: 1, foeHpScale: 1, hazardScale: 1, abilityThreat: 1 },
  23: { depth: 23, breather: false, dots: 32, darkBlobs: 3, darkRadius: 7, waterPools: 3, storeTier: 3, foeLevel: 5, foeHitScale: 1, foeHpScale: 1, hazardScale: 1, abilityThreat: 1 },
  24: { depth: 24, breather: false, dots: 33, darkBlobs: 3, darkRadius: 7, waterPools: 3, storeTier: 3, foeLevel: 5, foeHitScale: 1, foeHpScale: 1, hazardScale: 1, abilityThreat: 1 },
  25: { depth: 25, breather: false, dots: 34, darkBlobs: 3, darkRadius: 7, waterPools: 3, storeTier: 3, foeLevel: 5, foeHitScale: 1, foeHpScale: 1, hazardScale: 1, abilityThreat: 1 },
  35: { depth: 35, breather: false, dots: 44, darkBlobs: 3, darkRadius: 7, waterPools: 3, storeTier: 3, foeLevel: 5, foeHitScale: 1, foeHpScale: 1, hazardScale: 1, abilityThreat: 1 },
  50: { depth: 50, breather: false, dots: 59, darkBlobs: 3, darkRadius: 7, waterPools: 3, storeTier: 3, foeLevel: 5, foeHitScale: 1, foeHpScale: 1, hazardScale: 1, abilityThreat: 1 },
};

test("identity column: difficultyCurve(depth) for depths 2..25/35/50 deepStrictEqual to the pasted node -e capture", () => {
  for (const [depth, expected] of Object.entries(CURVE_PINS)) {
    assert.deepStrictEqual(difficultyCurve(Number(depth)), expected, `depth ${depth}`);
  }
});

test("foeLevelFor map 1..25 === '1111222223333344444555555' (identity: no identity exists — the starting map)", () => {
  const map = Array.from({ length: 25 }, (_, i) => foeLevelFor(i + 1)).join("");
  assert.equal(map, "1111222223333344444555555");
});

test("dots(d) === 9 + d for d in 1..5 (ENCOUNTER_DOTS identity, no cap) and 9 on every breather floor", () => {
  for (let d = 1; d <= 5; d++) assert.equal(difficultyCurve(d).dots, 9 + d, `depth ${d}`);
  for (const d of [6, 11, 16, 21]) assert.equal(difficultyCurve(d).dots, 9, `breather depth ${d}`);
});

test("storeTier map 1..12 === '011122223333' (reproduces today's BAG_FLOORS ladder exactly)", () => {
  const map = Array.from({ length: 12 }, (_, i) => difficultyCurve(i + 1).storeTier).join("");
  assert.equal(map, "011122223333");
});

test("darkBlobs map 1..12 (breather floors zeroed): floors 1/2/4/5+ read as canon, floor 3 reads 2 where the retired hold read 1", () => {
  const map = Array.from({ length: 12 }, (_, i) => difficultyCurve(i + 1).darkBlobs).join("");
  assert.equal(map, "012230333303"); // breathers at depth 6, 11 (0-indexed 5, 10) zeroed
  assert.equal(difficultyCurve(3).darkBlobs, 2, "floor 3 reads 2 (was 1 under the retired hold)");
});

// ─── the count roll (canon draw shape, no level-keyed cap) ─────────────────

test("FOE_COUNT_TABLE: every row is non-decreasing left-to-right; row 0 is canon (P(1,2,3) = .500/.375/.125)", () => {
  for (const row of FOE_COUNT_TABLE) {
    for (let i = 0; i < row.length - 1; i++) assert.ok(row[i] <= row[i + 1], `row ${JSON.stringify(row)} must be non-decreasing`);
  }
  assert.deepStrictEqual(FOE_COUNT_TABLE[0], [2, 2, 2, 3]);
});

test("foeCountFor: the second draw fires ONLY when the first roll is > 2 (canon short-circuit)", () => {
  let drawn = 0;
  const drawSecond = () => {
    drawn++;
    return 4;
  };
  assert.equal(foeCountFor(1, drawSecond), 1);
  assert.equal(drawn, 0, "firstRoll <= 2 must never call drawSecond");
  assert.equal(foeCountFor(3, drawSecond), 3);
  assert.equal(drawn, 1, "firstRoll > 2 must call drawSecond exactly once");
});

test("tierSpreadFor() reads live.TIER_SPREAD (identity 1)", () => {
  assert.equal(tierSpreadFor(), 1);
});

// ─── hero-side helpers ──────────────────────────────────────────────────────

test("heroMeanMaxWpFor(1..5) === [41.67, 46.17, 50.00, 54.50, 60.00] (2dp, HERO_HP_SCALE identity)", () => {
  const rounded = [1, 2, 3, 4, 5].map((l) => heroMeanMaxWpFor(l).toFixed(2));
  assert.deepStrictEqual(rounded, ["41.67", "46.17", "50.00", "54.50", "60.00"]);
});

test("roundDamageCapFor: Infinity at the identity ceiling (0, off); round(0.5 * 41.67) = 21 at level 1 under a 0.5 override (restored after)", () => {
  assert.equal(roundDamageCapFor(1), Infinity);
  const restore = setDialsForTuning({ ROUND_DAMAGE_CEILING: 0.5 });
  assert.equal(roundDamageCapFor(1), 21);
  restore();
  assert.equal(roundDamageCapFor(1), Infinity, "restore() must put live back to DIALS");
});

test("setDialsForTuning throws on an unknown dial key and restore() returns live to DIALS", () => {
  assert.throws(() => setDialsForTuning({ NOT_A_DIAL: 1 }), /unknown dial/);
  const before = difficultyCurve(1);
  const restore = setDialsForTuning({ HAZARD_SCALE: { base: 0.5, perDepth: 0 } });
  assert.notEqual(difficultyCurve(1).hazardScale, before.hazardScale);
  restore();
  assert.deepStrictEqual(difficultyCurve(1), before);
});

// ─── identity fast paths (structural, not rounding accidents) ──────────────

test("every helper's identity fast path returns its input by identity", () => {
  const curve = difficultyCurve(1);
  assert.equal(Object.is(foeWpFor(42, curve), 42), true);
  assert.equal(Object.is(foeHitFor(17, curve), 17), true);
  assert.equal(Object.is(heroMaxWpFor(55, "Fighter"), 55), true);
  assert.equal(Object.is(heroMaxWpFor(30, "Magic User"), 30), true);
  assert.equal(Object.is(heroSpFor(123), 123), true);
  assert.equal(Object.is(startingRationsFor(6), 6), true);
  assert.equal(Object.is(scaleHazard(9, curve), 9), true);
  assert.equal(heroRegenFor(100), 0, "HERO_REGEN_PER_FLOOR identity (0) never heals");
});

test("campHealFor keeps the SAME d10 draw re-centered around CAMP_HEAL_FRACTION (identity, mean-matched)", () => {
  // round(0.17 * 40) + d10 - 5, min 1
  assert.equal(campHealFor(40, 1), Math.max(1, Math.round(0.17 * 40) + 1 - 5));
  assert.equal(campHealFor(40, 10), Math.max(1, Math.round(0.17 * 40) + 10 - 5));
});

test("dotHpFor: small/mid/large fractions of maxWP, min 1", () => {
  assert.equal(dotHpFor("small", 40), Math.max(1, Math.round(0.24 * 40)));
  assert.equal(dotHpFor("mid", 40), Math.max(1, Math.round(0.36 * 40)));
  assert.equal(dotHpFor("large", 40), Math.max(1, Math.round(0.6 * 40)));
});

// ─── kept helpers (unchanged behavior, still draw-free) ─────────────────────

test("isBreather is true exactly for depths 6, 11, 16, 21 (BREATHER_EVERY cadence)", () => {
  assert.equal(BREATHER_EVERY, 5);
  for (const depth of [6, 11, 16, 21]) assert.equal(isBreather(depth), true, `depth ${depth} should be a breather`);
  for (const depth of [1, 2, 3, 4, 5, 7, 10]) assert.equal(isBreather(depth), false, `depth ${depth} should NOT be a breather`);
});

test("abilityCadenceFor is identity at abilityThreat 1", () => {
  const curve = difficultyCurve(1);
  assert.deepStrictEqual(abilityCadenceFor({ every: 4 }, curve), { every: 4, uses: undefined });
  assert.deepStrictEqual(abilityCadenceFor({ uses: 2 }, curve), { every: undefined, uses: 2 });
});

test("difficultyCurve tolerates a non-integer or non-positive depth without NaN/Infinity output", () => {
  for (const depth of [0, -3, 1.5, NaN, Infinity, -Infinity]) {
    const dc = difficultyCurve(depth);
    for (const [key, val] of Object.entries(dc)) {
      if (key === "breather") continue;
      assert.ok(Number.isFinite(val), `depth input ${depth}: field "${key}" is not finite (got ${val})`);
    }
  }
});

test("IN-01: isBreather also tolerates NaN/Infinity/-Infinity without throwing or returning non-boolean", () => {
  for (const depth of [NaN, Infinity, -Infinity]) {
    assert.equal(typeof isBreather(depth), "boolean", `isBreather(${depth}) must return a boolean`);
  }
});

test("difficultyCurve stays draw-free: arity 1 and engine/difficulty.js's code (comments stripped) never names an rng", () => {
  const src = fs.readFileSync(path.join(__dirname, "../../engine/difficulty.js"), "utf8");
  const stripped = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.equal(/\brng\b/.test(stripped), false, "engine/difficulty.js must never name an rng identifier");
  assert.equal(difficultyCurve.length, 1);
});

test("setDialsForTuning is HARNESS-ONLY — absent from src/, mazeworld.html and every other engine module", () => {
  const repoRoot = path.join(__dirname, "../..");
  const check = (p) => {
    const src = fs.readFileSync(path.join(repoRoot, p), "utf8");
    assert.equal(src.includes("setDialsForTuning"), false, `${p} must never reference setDialsForTuning`);
  };
  check("mazeworld.html");
  for (const f of fs.readdirSync(path.join(repoRoot, "src/browser"))) {
    if (f.endsWith(".js")) check(`src/browser/${f}`);
  }
  for (const f of fs.readdirSync(path.join(repoRoot, "engine"))) {
    if (f.endsWith(".js") && f !== "difficulty.js") check(`engine/${f}`);
  }
});
