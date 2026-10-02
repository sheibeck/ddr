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
  heroSpFor,
  campHealFor,
  dotHpFor,
  DOT_HP_BASE,
  startingRationsFor,
  tierSpreadFor,
  scaleHazard,
  abilityCadenceFor,
  isBreather,
  BREATHER_EVERY,
} from "../../engine/difficulty.js";
import { FLEE_THIEF_BONUS } from "../../content/flee.js";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// ─── USER RULING D: the remove list is GONE — no floor-range name survives ──

test("USER RULING D/G, RULES-16/17/18 (Phase 75.3): DIALS is frozen and its key set is exactly the global model's 30 dials (DOT_HP_FRACTION retired, USER RULING G, cycle 3 — DOT_HP_BASE is a flat canon table, not a DIALS key; FOE_COUNT_DEPTH added, Plan 01; FOE_ELITE added, Plan 03; CONTROL_AT_DEPTH added, Plan 04)", () => {
  assert.equal(Object.isFrozen(DIALS), true);
  const keys = Object.keys(DIALS).sort();
  assert.deepStrictEqual(keys, [
    "ABILITY_THREAT",
    "CAMP_HEAL_FRACTION",
    "CLASS_MITIGATION",
    "CONTROL_AT_DEPTH",
    "DARK_BLOBS",
    "DARK_BLOB_CAP",
    "DARK_RADIUS",
    "DARK_RADIUS_CAP",
    "DOT_MIX",
    "ENCOUNTER_DOTS",
    "FLEE_NEED_MOD",
    "FOE_ACCURACY",
    "FOE_COUNT_DEPTH",
    "FOE_COUNT_SKEW",
    "FOE_ELITE",
    "FOE_HIT_SCALE",
    "FOE_HP_SCALE",
    "FOE_LEVEL",
    "FOOD_CLOCK",
    "HAZARD_SCALE",
    "HERO_HP_SCALE",
    "HERO_SP_SCALE",
    "LOOT_SCALE",
    "PARLEY_NEED_MOD",
    "ROUND_DAMAGE_CEILING",
    "SELL_FRACTION",
    "STARTING_GOLD",
    "STARTING_POTION_BONUS",
    "STORE_TIER",
    "TIER_SPREAD",
    "WANDER_RATE",
  ].sort());
});

// The identity column — literal, EVERY DIALS key at its pre-fit value (what
// every dial WAS before the Phase 54-07 fit shipped, USER RULING G cycle 3).
const IDENTITY_COLUMN = {
  FOE_LEVEL: { base: 0.6, perDepth: 0.2 },
  TIER_SPREAD: 1,
  // RULES-17 (Phase 75.3): the identity knee — perDepthAfter === perDepth
  // (both 0) means scaleField's knee branch never fires (identity/no-op
  // case), so this reproduces canon at every depth exactly like before this
  // dial carried a knee.
  FOE_HIT_SCALE: { base: 1, perDepth: 0, kneeDepth: 12, perDepthAfter: 0 },
  FOE_HP_SCALE: { base: 1, perDepth: 0, kneeDepth: 12, perDepthAfter: 0 },
  FOE_COUNT_SKEW: 0,
  FOE_COUNT_DEPTH: { soloOnlyOnOneFrom: 0, atLeastTwoFrom: 0, atLeastThreeFrom: 0 },
  // RULES-17 (Phase 75.3): identity switches elites off entirely (maxRank 0).
  FOE_ELITE: { maxRank: 0, hpPerRank: 0, hitPerRank: 0 },
  // RULES-18 (Phase 75.3, Plan 04): identity — no resist face, no hold cap,
  // at any depth.
  CONTROL_AT_DEPTH: { kneeDepth: 12, resistPerDepth: 0, resistCap: 0, holdRounds: 0 },
  ROUND_DAMAGE_CEILING: 0,
  ABILITY_THREAT: { base: 1, perDepth: 0 },
  HERO_HP_SCALE: 1,
  HERO_SP_SCALE: 1,
  CAMP_HEAL_FRACTION: 0.17,
  FOOD_CLOCK: 1,
  ENCOUNTER_DOTS: { base: 9, perDepth: 1 },
  HAZARD_SCALE: { base: 1, perDepth: 0 },
  DARK_BLOBS: { base: -0.4, perDepth: 0.7 },
  DARK_BLOB_CAP: 3,
  DARK_RADIUS: { base: 3, perDepth: 1 },
  DARK_RADIUS_CAP: 7,
  STORE_TIER: { base: 0, perDepth: 0.3 },
  LOOT_SCALE: 1,
  // Phase 92 plan 03 (ECON-12): identity = a store pays half everywhere.
  SELL_FRACTION: { shallow: 0.5, deep: 0.5, shallowTo: 4, deepFrom: 7 },
  FOE_ACCURACY: 0,
  DOT_MIX: { fight: 1, harm: 1, loot: 1, help: 1 },
  WANDER_RATE: 1,
  FLEE_NEED_MOD: 0,
  PARLEY_NEED_MOD: 0,
  STARTING_GOLD: 50,
  STARTING_POTION_BONUS: 0,
  CLASS_MITIGATION: {
    Fighter: { hpMul: 1, armorMul: 1, killSpeed: 1 },
    Thief: { evasion: 0, fleeBonus: FLEE_THIEF_BONUS, trapAvoid: 0, killSpeed: 1 },
    "Magic User": { spellPower: 1 },
  },
};

/**
 * withIdentity(overrides, fn) — Phase 54-07 (USER RULING G cycle 3): DIALS
 * itself now SHIPS at the fitted values, not identity, so every "identity
 * column" test below runs `fn` under an EXPLICIT `setDialsForTuning`
 * override (IDENTITY_COLUMN merged with `overrides`, e.g. a single dial
 * forced to a non-identity value) rather than relying on DIALS defaulting
 * to identity. `restore()` always resets `live` all the way back to
 * (fitted) `DIALS` — never to a previous override — so nested overrides are
 * expressed as ONE merged object, never as nested `setDialsForTuning` calls.
 */
function withIdentity(overrides, fn) {
  const restore = setDialsForTuning({ ...IDENTITY_COLUMN, ...overrides });
  try {
    fn();
  } finally {
    restore();
  }
}

// Phase 79.2's early-floor lock file (user ruling 2026-09-27, locked by
// RF-79.2-02-3 on 2026-09-28): the live phase directory first, then the
// v2.1 milestone archive, the same fallback shape as the lookups below, so
// archiving the milestone never turns these pins red.
function readEarlyLock() {
  const lockRel = ["79.2-early-floor-difficulty-retune-floors-1-12-harder-fair-bot-p5", "fit", "early-lock.json"];
  const planning = path.join(__dirname, "..", "..", ".planning");
  const lockPath = [
    path.join(planning, "phases", ...lockRel),
    path.join(planning, "milestones", "v2.1-phases", ...lockRel),
  ].find((p) => fs.existsSync(p));
  assert.ok(lockPath, "79.2's fit/early-lock.json not found in .planning/phases/ or .planning/milestones/v2.1-phases/");
  return JSON.parse(fs.readFileSync(lockPath, "utf8"));
}

test("Phase 79.2 (user ruling 2026-09-27): every leaf of the early-floor sweep's confirmed early-lock.json equals DIALS", () => {
  // The lock is c2 #18 (fit/early-log-c2.jsonl), confirmed at 1,000 seeds
  // (fit/confirm-1000-c3n1.jsonl) and on the 79.1 tail
  // (fit/tail-confirm-c3n1.jsonl), and locked on the user's ruling
  // RF-79.2-02-3 ("Lock the best result as-is.", fit/early-lock-ruling.json).
  const lock = readEarlyLock();
  let leaves = 0;
  for (const [key, value] of Object.entries(lock)) {
    assert.ok(key in DIALS, `early-lock.json names ${key}, which is not a DIALS key`);
    if (value && typeof value === "object") {
      for (const [leaf, leafValue] of Object.entries(value)) {
        assert.equal(DIALS[key][leaf], leafValue, `DIALS.${key}.${leaf}`);
        leaves++;
      }
    } else {
      assert.equal(DIALS[key], value, `DIALS.${key}`);
      leaves++;
    }
  }
  assert.equal(leaves, 16, "early-lock.json carries the 9 SEARCH_PLAN coordinates plus the knees, tail slopes and held perDepths of the same seven dials (16 leaves)");
});

test("USER RULING D (Phase 54-07 fit, USER RULING G cycle 3), RULES-16 (Phase 75.3), Phase 79.2 (user ruling 2026-09-27): DIALS deepStrictEqual the merge of the identity column, the Phase 54 fit/best.json, the Phase 75.3 dial overlay and the Phase 79.2 early-lock.json overlay (the shipped values are the evaluated ones, no rounding, no hand-tidying)", () => {
  // The fit artifact lives in Phase 54's directory, which /gsd-complete-milestone
  // MOVES into .planning/milestones/v1.7-phases/ when the milestone is archived.
  // Try the live location first, then the archive, so archiving a milestone never
  // turns this pin red (it did, once — v1.8's archive of v1.7 broke this test).
  const fitRel = ["54-four-band-retune-and-roster-decision", "fit", "best.json"];
  const planning = path.join(__dirname, "..", "..", ".planning");
  const bestPath = [
    path.join(planning, "phases", ...fitRel),
    path.join(planning, "milestones", "v1.7-phases", ...fitRel),
  ].find((p) => fs.existsSync(p));
  assert.ok(bestPath, "fit/best.json not found in .planning/phases/ or .planning/milestones/v1.7-phases/");
  const best = JSON.parse(fs.readFileSync(bestPath, "utf8"));

  // Phase 75.3's own dial overlay — same fallback shape (live path, then a
  // future milestone archive) as the Phase 54 lookup above.
  const overlayRel = ["75.3-deep-floor-encounter-scaling", "fit", "best.json"];
  const overlayPath = [
    path.join(planning, "phases", ...overlayRel),
    path.join(planning, "milestones", "v2.1-phases", ...overlayRel),
  ].find((p) => fs.existsSync(p));
  assert.ok(overlayPath, "75.3's fit/best.json not found in .planning/phases/ or .planning/milestones/v2.1-phases/");
  const overlay = JSON.parse(fs.readFileSync(overlayPath, "utf8"));

  // User ruling 2026-09-27 (quick fix 79-02c): the stairs heal nothing, so
  // HERO_REGEN_PER_FLOOR left DIALS. Phase 54's fit artifact is history and
  // still records the fitted 0.25; the merge drops that one retired key by
  // name (any other unknown key still fails the key-set pin below).
  const { HERO_REGEN_PER_FLOOR: retiredRegen, ...bestLive } = best;
  assert.equal(retiredRegen, 0.25, "the Phase 54 fit artifact still records the retired regen");
  // Phase 79.2 early-floor lock (user ruling 2026-09-27): the last layer.
  // Its seven keys are whole dial objects (every leaf, knees included), so
  // the shallow merge replaces the Phase 54 / 75.3 values for exactly those
  // dials.
  const earlyLock = readEarlyLock();
  const layered = { ...IDENTITY_COLUMN, ...bestLive, ...overlay, ...earlyLock };
  // Quick 260928-nrf (user ruling 2026-09-28, "Thief flee +5 -> +3"):
  // CLASS_MITIGATION.Thief.fleeBonus is a mirror seeded from
  // content/flee.js#FLEE_THIEF_BONUS (engine/difficulty.js; no engine code
  // reads it), and Phase 54's fit artifact recorded the canon 5. The ruling
  // moves the mirror with the content value; every other leaf stays the
  // artifacts'.
  const merged = {
    ...layered,
    CLASS_MITIGATION: { ...layered.CLASS_MITIGATION, Thief: { ...layered.CLASS_MITIGATION.Thief, fleeBonus: FLEE_THIEF_BONUS } },
  };
  assert.equal(bestLive.CLASS_MITIGATION.Thief.fleeBonus, 5, "the Phase 54 fit artifact still records the canon +5");
  assert.deepStrictEqual(Object.keys(DIALS).sort(), Object.keys(merged).sort(), "DIALS and the identity+best.json+overlay+early-lock merge must cover the exact same key set");
  assert.deepStrictEqual(DIALS, merged);
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

test("identity column: difficultyCurve(1) reads canon exactly (under an explicit identity override — DIALS itself ships fitted, USER RULING G cycle 3)", () => {
  withIdentity({}, () => {
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
});

// The FITTED floor-1 curve — USER RULING D (54-CONTEXT.md): under the
// global model, floor 1 is NOT guaranteed parity-exact the way the retired
// floor-range knot ladder kept it ("the engine gate becomes 'everything
// that moves is declared', not 'nothing moves'"). `foeLevel` still maps to
// 1 (its clamp(1,5) floor), but `FOE_HIT_SCALE`/`FOE_HP_SCALE`/
// `HAZARD_SCALE`'s fitted `perDepth` != 0 means their structural `=== 1`
// fast path never engages at ANY depth, including 1 — dots/darkBlobs/
// darkRadius/storeTier/abilityThreat DO still land on their held-identity
// values (no coordinate touched them). Pasted verbatim from `node -e`
// against the landed (fitted) engine; this is the "before" this plan's
// parity re-measurement (Task 1, Part 5) declares as moved.
// Phase 79.2 early-floor lock (user ruling 2026-09-27): FOE_HIT_SCALE
// { 0.6, 0.01 } -> { 0.84, 0.02 } moves foeHitScale 0.61 -> 0.86, and
// FOE_HP_SCALE.base 0.9 -> 1.2 moves foeHpScale 0.915 -> 1.2149999999999999
// (1.2 + 0.015, the raw IEEE-754 sum, pasted verbatim from `node -e`).
// FOE_LEVEL.base 0.9 -> 1.0 leaves floor 1 at level 1 (round(1.29) = 1);
// dots and hazardScale are unmoved (ENCOUNTER_DOTS and HAZARD_SCALE were
// not changed by the lock).
test("USER RULING G (cycle 3), Phase 79.2 early-floor lock (user ruling 2026-09-27): difficultyCurve(1) — the locked curve at floor 1 (foeLevel still 1; foeHitScale/foeHpScale/hazardScale move off identity — declared per USER RULING D)", () => {
  assert.deepStrictEqual(difficultyCurve(1), {
    depth: 1,
    breather: false,
    dots: 7,
    darkBlobs: 0,
    darkRadius: 4,
    waterPools: 1,
    storeTier: 0,
    foeLevel: 1,
    foeHitScale: 0.86,
    foeHpScale: 1.2149999999999999,
    hazardScale: 0.62,
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

test("identity column: difficultyCurve(depth) for depths 2..25/35/50 deepStrictEqual to the pasted node -e capture (under an explicit identity override)", () => {
  withIdentity({}, () => {
    for (const [depth, expected] of Object.entries(CURVE_PINS)) {
      assert.deepStrictEqual(difficultyCurve(Number(depth)), expected, `depth ${depth}`);
    }
  });
});

// FITTED_CURVE_PINS — depths 2..25/35/50, pasted verbatim from `node -e`
// against the landed engine. `foeHitScale`/`foeHpScale`/`hazardScale` are
// rounded to 6dp (a `round(x*1e6)/1e6` pass on the raw `node -e` output) to
// strip IEEE-754 representation noise (e.g. raw `0.9450000000000001`)
// without losing any precision the dials themselves carry (every
// fitted/held value here has <= 3 decimal digits).
//
// Phase 79.2 early-floor lock (user ruling 2026-09-27): EVERY row is
// re-captured, because the searched dials are global (base + perDepth x d
// from floor 1), not only past floor 12:
// - FOE_HIT_SCALE { base 0.6, perDepth 0.01 } -> { 0.84, 0.02 }: foeHitScale
//   is 0.84 + 0.02*d at every depth. perDepthAfter stays 0.02, now EQUAL to
//   perDepth, so this dial's knee is its own identity (no bend at 12);
// - FOE_HP_SCALE.base 0.9 -> 1.2: foeHpScale is 1.2 + 0.015*d through 12,
//   then the unchanged perDepthAfter 0.03 past the knee (1.38 + 0.03*(d-12));
// - FOE_LEVEL.base 0.9 -> 1.0: foeLevel moves at depth 2 only (1 -> 2).
// dots, darkBlobs, darkRadius, waterPools, storeTier, hazardScale and
// abilityThreat are unmoved (the lock did not change their dials).
const FITTED_CURVE_PINS = {
  2: { depth: 2, breather: false, dots: 8, darkBlobs: 1, darkRadius: 5, waterPools: 1, storeTier: 1, foeLevel: 2, foeHitScale: 0.88, foeHpScale: 1.23, hazardScale: 0.64, abilityThreat: 1 },
  3: { depth: 3, breather: false, dots: 8, darkBlobs: 2, darkRadius: 6, waterPools: 1, storeTier: 1, foeLevel: 2, foeHitScale: 0.9, foeHpScale: 1.245, hazardScale: 0.66, abilityThreat: 1 },
  4: { depth: 4, breather: false, dots: 8, darkBlobs: 2, darkRadius: 7, waterPools: 1, storeTier: 1, foeLevel: 2, foeHitScale: 0.92, foeHpScale: 1.26, hazardScale: 0.68, abilityThreat: 1 },
  5: { depth: 5, breather: false, dots: 9, darkBlobs: 3, darkRadius: 7, waterPools: 2, storeTier: 2, foeLevel: 2, foeHitScale: 0.94, foeHpScale: 1.275, hazardScale: 0.7, abilityThreat: 1 },
  6: { depth: 6, breather: true, dots: 7, darkBlobs: 0, darkRadius: 7, waterPools: 1, storeTier: 2, foeLevel: 3, foeHitScale: 0.96, foeHpScale: 1.29, hazardScale: 0.72, abilityThreat: 1 },
  7: { depth: 7, breather: false, dots: 9, darkBlobs: 3, darkRadius: 7, waterPools: 2, storeTier: 2, foeLevel: 3, foeHitScale: 0.98, foeHpScale: 1.305, hazardScale: 0.74, abilityThreat: 1 },
  8: { depth: 8, breather: false, dots: 9, darkBlobs: 3, darkRadius: 7, waterPools: 2, storeTier: 2, foeLevel: 3, foeHitScale: 1, foeHpScale: 1.32, hazardScale: 0.76, abilityThreat: 1 },
  9: { depth: 9, breather: false, dots: 10, darkBlobs: 3, darkRadius: 7, waterPools: 3, storeTier: 3, foeLevel: 4, foeHitScale: 1.02, foeHpScale: 1.335, hazardScale: 0.78, abilityThreat: 1 },
  10: { depth: 10, breather: false, dots: 10, darkBlobs: 3, darkRadius: 7, waterPools: 3, storeTier: 3, foeLevel: 4, foeHitScale: 1.04, foeHpScale: 1.35, hazardScale: 0.8, abilityThreat: 1 },
  11: { depth: 11, breather: true, dots: 7, darkBlobs: 0, darkRadius: 7, waterPools: 1, storeTier: 3, foeLevel: 4, foeHitScale: 1.06, foeHpScale: 1.365, hazardScale: 0.82, abilityThreat: 1 },
  12: { depth: 12, breather: false, dots: 11, darkBlobs: 3, darkRadius: 7, waterPools: 3, storeTier: 3, foeLevel: 4, foeHitScale: 1.08, foeHpScale: 1.38, hazardScale: 0.84, abilityThreat: 1 },
  13: { depth: 13, breather: false, dots: 11, darkBlobs: 3, darkRadius: 7, waterPools: 3, storeTier: 3, foeLevel: 5, foeHitScale: 1.1, foeHpScale: 1.41, hazardScale: 0.86, abilityThreat: 1 },
  14: { depth: 14, breather: false, dots: 11, darkBlobs: 3, darkRadius: 7, waterPools: 3, storeTier: 3, foeLevel: 5, foeHitScale: 1.12, foeHpScale: 1.44, hazardScale: 0.88, abilityThreat: 1 },
  15: { depth: 15, breather: false, dots: 12, darkBlobs: 3, darkRadius: 7, waterPools: 3, storeTier: 3, foeLevel: 5, foeHitScale: 1.14, foeHpScale: 1.47, hazardScale: 0.9, abilityThreat: 1 },
  16: { depth: 16, breather: true, dots: 7, darkBlobs: 0, darkRadius: 7, waterPools: 1, storeTier: 3, foeLevel: 5, foeHitScale: 1.16, foeHpScale: 1.5, hazardScale: 0.92, abilityThreat: 1 },
  17: { depth: 17, breather: false, dots: 12, darkBlobs: 3, darkRadius: 7, waterPools: 3, storeTier: 3, foeLevel: 5, foeHitScale: 1.18, foeHpScale: 1.53, hazardScale: 0.94, abilityThreat: 1 },
  18: { depth: 18, breather: false, dots: 12, darkBlobs: 3, darkRadius: 7, waterPools: 3, storeTier: 3, foeLevel: 5, foeHitScale: 1.2, foeHpScale: 1.56, hazardScale: 0.96, abilityThreat: 1 },
  19: { depth: 19, breather: false, dots: 13, darkBlobs: 3, darkRadius: 7, waterPools: 3, storeTier: 3, foeLevel: 5, foeHitScale: 1.22, foeHpScale: 1.59, hazardScale: 0.98, abilityThreat: 1 },
  20: { depth: 20, breather: false, dots: 13, darkBlobs: 3, darkRadius: 7, waterPools: 3, storeTier: 3, foeLevel: 5, foeHitScale: 1.24, foeHpScale: 1.62, hazardScale: 1, abilityThreat: 1 },
  21: { depth: 21, breather: true, dots: 7, darkBlobs: 0, darkRadius: 7, waterPools: 1, storeTier: 3, foeLevel: 5, foeHitScale: 1.26, foeHpScale: 1.65, hazardScale: 1.02, abilityThreat: 1 },
  22: { depth: 22, breather: false, dots: 14, darkBlobs: 3, darkRadius: 7, waterPools: 3, storeTier: 3, foeLevel: 5, foeHitScale: 1.28, foeHpScale: 1.68, hazardScale: 1.04, abilityThreat: 1 },
  23: { depth: 23, breather: false, dots: 14, darkBlobs: 3, darkRadius: 7, waterPools: 3, storeTier: 3, foeLevel: 5, foeHitScale: 1.3, foeHpScale: 1.71, hazardScale: 1.06, abilityThreat: 1 },
  24: { depth: 24, breather: false, dots: 14, darkBlobs: 3, darkRadius: 7, waterPools: 3, storeTier: 3, foeLevel: 5, foeHitScale: 1.32, foeHpScale: 1.74, hazardScale: 1.08, abilityThreat: 1 },
  25: { depth: 25, breather: false, dots: 15, darkBlobs: 3, darkRadius: 7, waterPools: 3, storeTier: 3, foeLevel: 5, foeHitScale: 1.34, foeHpScale: 1.77, hazardScale: 1.1, abilityThreat: 1 },
  35: { depth: 35, breather: false, dots: 18, darkBlobs: 3, darkRadius: 7, waterPools: 3, storeTier: 3, foeLevel: 5, foeHitScale: 1.54, foeHpScale: 2.07, hazardScale: 1.3, abilityThreat: 1 },
  50: { depth: 50, breather: false, dots: 22, darkBlobs: 3, darkRadius: 7, waterPools: 3, storeTier: 3, foeLevel: 5, foeHitScale: 1.84, foeHpScale: 2.52, hazardScale: 1.6, abilityThreat: 1 },
};

function roundedCurve(curve) {
  const r = (x) => Math.round(x * 1e6) / 1e6;
  return { ...curve, foeHitScale: r(curve.foeHitScale), foeHpScale: r(curve.foeHpScale), hazardScale: r(curve.hazardScale), abilityThreat: r(curve.abilityThreat) };
}

test("USER RULING G (cycle 3), Phase 79.2 early-floor lock (user ruling 2026-09-27): difficultyCurve(depth) for depths 2..25/35/50 deepStrictEqual to the pasted node -e capture of the locked engine (float fields rounded to 6dp)", () => {
  for (const [depth, expected] of Object.entries(FITTED_CURVE_PINS)) {
    assert.deepStrictEqual(roundedCurve(difficultyCurve(Number(depth))), expected, `depth ${depth}`);
  }
});

test("foeLevelFor map 1..25 (identity, under an explicit identity override) === '1111222223333344444555555'", () => {
  withIdentity({}, () => {
    const map = Array.from({ length: 25 }, (_, i) => foeLevelFor(i + 1)).join("");
    assert.equal(map, "1111222223333344444555555");
  });
});

// Phase 79.2 early-floor lock (user ruling 2026-09-27): FOE_LEVEL.base
// 0.9 -> 1.0 moves the map from '1122233344445555555555555' (the Phase 54
// fit) to the `node -e` capture below: only floor 2 gains a level
// (round(1.58) = 2, was round(1.48) = 1); floor 1 stays level 1.
test("USER RULING G (cycle 3), Phase 79.2 early-floor lock (user ruling 2026-09-27): foeLevelFor map 1..25 === '1222233344445555555555555' (FOE_LEVEL locked at { base: 1.0, perDepth: 0.29 })", () => {
  const map = Array.from({ length: 25 }, (_, i) => foeLevelFor(i + 1)).join("");
  assert.equal(map, "1222233344445555555555555");
});

test("dots(d) (identity, under an explicit identity override) === 9 + d for d in 1..5 (ENCOUNTER_DOTS identity, no cap) and 9 on every breather floor", () => {
  withIdentity({}, () => {
    for (let d = 1; d <= 5; d++) assert.equal(difficultyCurve(d).dots, 9 + d, `depth ${d}`);
    for (const d of [6, 11, 16, 21]) assert.equal(difficultyCurve(d).dots, 9, `breather depth ${d}`);
  });
});

test("USER RULING G (cycle 3, fitted DIALS): dots(d) === round(7 + 0.3*d) for d in 1..5 (ENCOUNTER_DOTS fitted to { base: 7, perDepth: 0.3 }) and 7 on every breather floor", () => {
  for (let d = 1; d <= 5; d++) assert.equal(difficultyCurve(d).dots, Math.round(7 + 0.3 * d), `depth ${d}`);
  for (const d of [6, 11, 16, 21]) assert.equal(difficultyCurve(d).dots, 7, `breather depth ${d}`);
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

test("heroMeanMaxWpFor(1..5) (identity, under an explicit identity override) === [41.67, 46.17, 50.00, 54.50, 60.00] (2dp, HERO_HP_SCALE identity)", () => {
  withIdentity({}, () => {
    const rounded = [1, 2, 3, 4, 5].map((l) => heroMeanMaxWpFor(l).toFixed(2));
    assert.deepStrictEqual(rounded, ["41.67", "46.17", "50.00", "54.50", "60.00"]);
  });
});

// Phase 79.2 early-floor lock (user ruling 2026-09-27): HERO_HP_SCALE
// 1.25 -> 1.4 moves heroMeanMaxWpFor from [52.08, 57.71, 62.50, 68.13,
// 75.00] to the `node -e` capture below.
test("USER RULING G (cycle 3), Phase 79.2 early-floor lock (user ruling 2026-09-27): heroMeanMaxWpFor(1..5) === [58.33, 64.63, 70.00, 76.30, 84.00] (2dp, HERO_HP_SCALE locked at 1.4 — 2dp rounding of the scaled mean, not the identity mean scaled after)", () => {
  const rounded = [1, 2, 3, 4, 5].map((l) => heroMeanMaxWpFor(l).toFixed(2));
  assert.deepStrictEqual(rounded, ["58.33", "64.63", "70.00", "76.30", "84.00"]);
});

test("roundDamageCapFor: Infinity at the ROUND_DAMAGE_CEILING-off identity value (under an explicit identity override); round(0.5 * 41.67) = 21 at level 1 under a 0.5 override (restored after)", () => {
  withIdentity({}, () => {
    assert.equal(roundDamageCapFor(1), Infinity);
  });
  const restore = setDialsForTuning({ ...IDENTITY_COLUMN, ROUND_DAMAGE_CEILING: 0.5 });
  assert.equal(roundDamageCapFor(1), 21);
  restore();
});

// Phase 79.2 early-floor lock (user ruling 2026-09-27): HERO_HP_SCALE
// 1.25 -> 1.4 moves the level-appropriate mean max HP the ceiling reads, so
// the caps move 26 -> 29 (level 1) and 31 -> 35 (level 3), `node -e`.
test("USER RULING G (cycle 3), Phase 79.2 early-floor lock (user ruling 2026-09-27): roundDamageCapFor is ALREADY on (held at its start value 0.5, not identity 0) — round(0.5 * 58.33) = 29 at level 1, round(0.5 * 70.00) = 35 at level 3", () => {
  assert.equal(roundDamageCapFor(1), 29);
  assert.equal(roundDamageCapFor(3), 35);
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

test("every helper's identity fast path returns its input by identity (under an explicit identity override)", () => {
  withIdentity({}, () => {
    const curve = difficultyCurve(1);
    assert.equal(Object.is(foeWpFor(42, curve), 42), true);
    assert.equal(Object.is(foeHitFor(17, curve), 17), true);
    assert.equal(Object.is(heroMaxWpFor(55, "Fighter"), 55), true);
    assert.equal(Object.is(heroMaxWpFor(30, "Magic User"), 30), true);
    assert.equal(Object.is(heroSpFor(123), 123), true);
    assert.equal(Object.is(startingRationsFor(6), 6), true);
    assert.equal(Object.is(scaleHazard(9, curve), 9), true);
  });
});

// Phase 79.2 early-floor lock (user ruling 2026-09-27): FOE_HP_SCALE.base
// 0.9 -> 1.2 (floor-1 scale 0.915 -> 1.215), FOE_HIT_SCALE { 0.6, 0.01 } ->
// { 0.84, 0.02 } (0.61 -> 0.86), HERO_HP_SCALE 1.25 -> 1.4 and HERO_SP_SCALE
// 0.28 -> 0.23 move the four first lines; `node -e` against the locked
// engine gives 51 / 15 / 77 / 28, which these expressions reproduce.
test("USER RULING G (cycle 3), Phase 79.2 early-floor lock (user ruling 2026-09-27): every helper reflects the SHIPPED (non-identity) dial values, never the identity fast path, by default", () => {
  const curve = difficultyCurve(1);
  assert.equal(foeWpFor(42, curve), Math.max(1, Math.round(42 * 1.215)), "FOE_HP_SCALE locked (1.2 base) moves foeWpFor off identity");
  assert.equal(foeHitFor(17, curve), Math.max(1, Math.round(17 * 0.86)), "FOE_HIT_SCALE locked (0.84 base, 0.02 perDepth) moves foeHitFor off identity");
  assert.equal(heroMaxWpFor(55, "Fighter"), Math.max(1, Math.round(55 * 1.4)), "HERO_HP_SCALE locked (1.4) moves heroMaxWpFor off identity");
  assert.equal(heroSpFor(123), Math.round(123 * 0.23), "HERO_SP_SCALE locked (0.23) moves heroSpFor off identity");
  assert.equal(startingRationsFor(6), Math.max(1, Math.round(6 * 1.5)), "FOOD_CLOCK held at 1.5 moves startingRationsFor off identity");
  assert.equal(scaleHazard(9, curve), Math.max(1, Math.round(9 * 0.62)), "HAZARD_SCALE fitted (0.6 base) moves scaleHazard off identity");
});

test("campHealFor keeps the SAME d10 draw re-centered around CAMP_HEAL_FRACTION (identity, mean-matched, under an explicit identity override)", () => {
  withIdentity({}, () => {
    // round(0.17 * 40) + d10 - 5, min 1
    assert.equal(campHealFor(40, 1), Math.max(1, Math.round(0.17 * 40) + 1 - 5));
    assert.equal(campHealFor(40, 10), Math.max(1, Math.round(0.17 * 40) + 10 - 5));
  });
});

test("USER RULING G (cycle 3): campHealFor at the SHIPPED (held) CAMP_HEAL_FRACTION 0.2 — round(0.2 * 40) + d10 - 5, min 1", () => {
  assert.equal(campHealFor(40, 1), Math.max(1, Math.round(0.2 * 40) + 1 - 5));
  assert.equal(campHealFor(40, 10), Math.max(1, Math.round(0.2 * 40) + 10 - 5));
});

test("USER RULING G (cycle 3): dotHpFor reads DOT_HP_BASE's flat canon value (10/15/25), scaled ONCE by HERO_HP_SCALE — never by the hero's own maxWP (no compounding)", () => {
  assert.deepStrictEqual(DOT_HP_BASE, { small: 10, mid: 15, large: 25 });
  // Identity (an explicit HERO_HP_SCALE:1 override — DIALS itself ships
  // HERO_HP_SCALE locked at 1.4 by Phase 79.2): the flat canon numbers exactly, structural fast path.
  withIdentity({ HERO_HP_SCALE: 1 }, () => {
    assert.equal(dotHpFor("small"), 10);
    assert.equal(dotHpFor("mid"), 15);
    assert.equal(dotHpFor("large"), 25);
    assert.equal(Object.is(dotHpFor("small"), 10), true, "identity returns the literal, not a rounded copy");
  });

  // The SHIPPED default (no override needed). Phase 79.2 early-floor lock
  // (user ruling 2026-09-27): HERO_HP_SCALE 1.25 -> 1.4 moves the dots
  // 13/19/31 -> 14/21/35 (`node -e` against the locked engine).
  assert.equal(dotHpFor("small"), Math.max(1, Math.round(10 * 1.4)));
  assert.equal(dotHpFor("mid"), Math.max(1, Math.round(15 * 1.4)));
  assert.equal(dotHpFor("large"), Math.max(1, Math.round(25 * 1.4)));

  // The compounding bug this fix retires: dotHpFor no longer takes a maxWP
  // argument at all, so a dot's size can never depend on (and feed back
  // into) the hero's own CURRENT maxWP.
  assert.equal(dotHpFor.length, 1, "dotHpFor(kind) — no maxWP parameter");
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
