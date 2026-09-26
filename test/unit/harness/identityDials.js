// test/unit/harness/identityDials.js
//
// Phase 54-07 (BAND-02, 2026-09-21, USER RULING G cycle 3) — DIALS itself
// now SHIPS at the FITTED values (the winning candidate of fit/best.json),
// not identity. Every pre-existing unit test across this suite that pins a
// canon/identity numeric outcome for an engine mechanic (a chest's gold, a
// trap's damage, a camp heal, a kill's XP split, a foe's hit/HP, ...) was
// written BEFORE Phase 54 existed, testing mechanics that are orthogonal to
// the difficulty-curve fit. Rather than re-derive and re-pin every one of
// those pre-existing numbers against the fitted dials (which would make
// those tests about THIS PHASE's fit rather than about the mechanic they
// actually exercise), this module gives every such test file ONE explicit,
// shared, engine-free way to run its existing (unchanged) assertions under
// an EXPLICIT identity override — exactly the discipline
// test/difficulty/difficulty.test.js already established for its own
// "identity column" tests, factored out so every other test file can reuse
// the SAME literal (never a second, drifting copy).
//
// `setDialsForTuning`'s own `restore()` always resets `live` to (fitted)
// `DIALS`, never to a previous override — so any test that combines a
// file-level `setDialsForTuning(IDENTITY_DIALS)` default with its OWN
// further nested override must use `withIdentity` (below) instead of the
// raw `restore()` return value, or its "restore" would jump to the FITTED
// dials, not back to this file's identity default, and pollute every test
// that runs after it in the same file.

import { FLEE_THIEF_BONUS } from "../../../content/flee.js";
import { setDialsForTuning } from "../../../engine/difficulty.js";

/** IDENTITY_DIALS — every DIALS key at its pre-Phase-54-07-fit identity value (mirrors test/difficulty/difficulty.test.js's own IDENTITY_COLUMN — kept as an independent literal per that file's own header rationale, both must independently equal engine/difficulty.js's identity column). */
export const IDENTITY_DIALS = {
  FOE_LEVEL: { base: 0.6, perDepth: 0.2 },
  TIER_SPREAD: 1,
  FOE_HIT_SCALE: { base: 1, perDepth: 0 },
  FOE_HP_SCALE: { base: 1, perDepth: 0 },
  FOE_COUNT_SKEW: 0,
  FOE_COUNT_DEPTH: { soloOnlyOnOneFrom: 0, atLeastTwoFrom: 0, atLeastThreeFrom: 0 },
  ROUND_DAMAGE_CEILING: 0,
  ABILITY_THREAT: { base: 1, perDepth: 0 },
  HERO_HP_SCALE: 1,
  HERO_REGEN_PER_FLOOR: 0,
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
 * setIdentityDials() — applies IDENTITY_DIALS as this file's default `live`
 * override. Call once, at module load (after imports, before any test),
 * with NO restore — node:test runs each test FILE in its own process, so
 * there is nothing to leak into another file.
 */
export function setIdentityDials() {
  setDialsForTuning(IDENTITY_DIALS);
}

/**
 * withIdentity(overrides, fn) — runs `fn` under IDENTITY_DIALS merged with
 * `overrides` (e.g. one dial forced to a specific non-identity value to
 * exercise its release), then resets `live` back to IDENTITY_DIALS
 * (NEVER to (fitted) DIALS — this is why callers must use this helper
 * rather than the raw `setDialsForTuning(...)` + its own returned
 * `restore()`, whose semantics are "reset to DIALS").
 */
export function withIdentity(overrides, fn) {
  setDialsForTuning({ ...IDENTITY_DIALS, ...overrides });
  try {
    return fn();
  } finally {
    setDialsForTuning(IDENTITY_DIALS);
  }
}
