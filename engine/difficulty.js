// engine/difficulty.js
//
// The single source of difficulty truth for endless descent (RUN-03). A pure
// difficultyCurve(depth) that bounds the two floor-generation knobs that
// today grow linearly and unboundedly with depth in engine/maze.js's
// genFloor: encounter-dot count (`nDots = 9 + depth`) and darkness coverage
// (`blobs = depth - 1`, per-blob BFS radius `3 + depth`).
//
// This module consumes NO rng and touches NO DOM — it is a pure function of
// `depth` alone, so calling it can never perturb the seeded RNG cursor that
// genFloor and every parity/round-trip/determinism test depend on (see
// 03-RESEARCH.md's architecture diagram: difficultyCurve sits BEFORE genFloor
// in the call chain but consumes none of its rng stream).
//
// Since Phase 21 (TUNE-01, D-01), this module also owns the COMBAT-scaling
// knobs consumed by engine/combat.js#startCombat (foe count / level bias /
// hit points / flat melee bonus) and engine/foeAbilities.js (caster
// cadence). The identity band for every combat field is depth <= 5 (D-19 —
// proven by test/determinism/foe-abilities.test.js's tier 2/4/5 seeds and
// every depth-1 parity fixture); the dial VALUES are set by the Phase 21
// retune and recorded in docs/DIFFICULTY-RETUNE.md. This module still
// consumes no rng and reads no DOM.

/** Every BREATHER_EVERY-th floor after floor 1 is a lighter "breather" floor. */
export const BREATHER_EVERY = 5;

/** ENCOUNTER_DOT_BASE — matches the prototype's original literal "9". */
export const ENCOUNTER_DOT_BASE = 9;
/** ENCOUNTER_DOT_CAP — soft ceiling: ~11% of a 21x21 floor's ~220 open cells. */
export const ENCOUNTER_DOT_CAP = 24;
/** ENCOUNTER_DOT_SOFT_K — the soft-cap curve's "bend" depth; see softCap(). */
export const ENCOUNTER_DOT_SOFT_K = 12;

/** DARK_BLOB_CAP — never more than this many dark-zone seed blobs per floor. */
export const DARK_BLOB_CAP = 6;
/** DARK_RADIUS_BASE — matches the prototype's original literal "3". */
export const DARK_RADIUS_BASE = 3;
/** DARK_RADIUS_CAP — never darkens more than this BFS radius per blob. */
export const DARK_RADIUS_CAP = 9;

// --- Phase 21 (TUNE-01, D-01/D-19): combat-scaling knobs -------------------
// Identity band: depth <= 5 (see difficultyCurve's `over` computation below).
// Every MAX below equals its BASE in this plan (21-02) — the retune (21-04)
// is the only thing allowed to move a MAX; this plan's own diff is provably
// inert at EVERY depth until that happens.

/** COMBAT_SCALE_FROM_DEPTH — the first floor on which the combat knobs may
 * leave identity (D-19); `over = max(0, depth - (COMBAT_SCALE_FROM_DEPTH - 1))`
 * is the soft cap's argument, so depths 1..5 always compute `over === 0`. */
export const COMBAT_SCALE_FROM_DEPTH = 6;
/** FOE_CAP_BASE — the canon `c.level <= 2 ? 2 : 3` ceiling's level->=3 value. */
export const FOE_CAP_BASE = 3;
/** FOE_CAP_MAX — 21-02 IDENTITY (equals FOE_CAP_BASE); 21-04 sets the D-02 target (~5). */
export const FOE_CAP_MAX = 3;
export const FOE_CAP_SOFT_K = 20;
/** FOE_POWER_BASE — the multiplier applied to a foe's starting wp/maxWP. */
export const FOE_POWER_BASE = 1.0;
/** FOE_POWER_MAX — 21-02 IDENTITY (equals FOE_POWER_BASE); 21-04 sets the D-02 target (~1.6). */
export const FOE_POWER_MAX = 1.0;
export const FOE_POWER_SOFT_K = 25;
/** ABILITY_THREAT_BASE — the cadence scalar for caster kits (every/uses). */
export const ABILITY_THREAT_BASE = 1.0;
/** ABILITY_THREAT_MAX — 21-02 IDENTITY (equals ABILITY_THREAT_BASE); 21-04 sets the D-03 target (~2). */
export const ABILITY_THREAT_MAX = 1.0;
export const ABILITY_THREAT_SOFT_K = 20;
/** FOE_LVL_BIAS — reserved (D-01): 0 unless the retune needs it. */
export const FOE_LVL_BIAS = 0;

/**
 * safeDepth(depth) — clamps an arbitrary input to a positive integer BEFORE
 * any arithmetic runs, so a corrupted/non-integer/non-positive save-derived
 * floor.depth (Security Domain V5; threat T-03-01) can never poison this
 * module's output with NaN/Infinity, which could later corrupt a serialized
 * floor. Handles NaN/±Infinity too (Math.floor of either is non-finite, so
 * Number.isFinite short-circuits to the depth-1 floor rather than letting
 * Math.max(1, NaN) silently propagate NaN through). Not exported — internal
 * guard only.
 */
function safeDepth(depth) {
  const d = Math.floor(depth);
  return Number.isFinite(d) ? Math.max(1, d) : 1;
}

/**
 * softCap(base, cap, depth, k) — an asymptotic ("diminishing returns") curve:
 * value(depth) approaches `cap` as depth grows but never reaches it. Chosen
 * over a hard clamp (`Math.min(base + depth, cap)`) because a hard clamp has
 * a visible "kink" where the curve suddenly flatlines; this stays smooth and
 * still tracks the original linear formula closely for depth << k (verified:
 * this formula reproduces the prototype's exact 9+depth for depths 1-5 — see
 * the PARITY GUARD test in test/difficulty/difficulty.test.js). Not exported
 * — internal helper only.
 */
function softCap(base, cap, depth, k) {
  return Math.round(base + (cap - base) * (1 - Math.exp(-depth / k)));
}

/**
 * softCapFloat(base, cap, over, k) — the NON-rounding sibling of softCap, for
 * fractional multipliers (RESEARCH A4): softCap's Math.round would flatten a
 * smooth 1.0->1.6 curve into whole steps, which is wrong for foePower/
 * abilityThreat. Exactness argument: at `over === 0`, `Math.exp(-0) === 1`
 * so the product is exactly 0 and the result is exactly `base` — no
 * floating-point drift — which is what makes the depth<=5 identity band a
 * STRUCTURAL guarantee rather than a rounding accident. With `cap === base`
 * (this plan's own constants) the result is `base` at every depth. Not
 * exported — internal helper only.
 */
function softCapFloat(base, cap, over, k) {
  return base + (cap - base) * (1 - Math.exp(-over / k));
}

/**
 * isBreatherOfSafeDepth(d) — the breather-cadence check itself, assuming `d`
 * has ALREADY been through safeDepth() (IN-02: avoids the redundant second
 * safeDepth() call difficultyCurve() used to trigger by calling the public
 * isBreather(depth), which re-clamps an input that was already clamped one
 * line above it — harmless since safeDepth is idempotent, but pointless
 * work). Not exported — internal helper only; callers with an unsanitized
 * depth must use the public isBreather(depth) below instead.
 */
function isBreatherOfSafeDepth(d) {
  return d > 1 && (d - 1) % BREATHER_EVERY === 0;
}

/**
 * isBreather(depth) — every BREATHER_EVERY-th floor after floor 1 is a
 * breather (depths 6, 11, 16, 21, ...). Pure, no RNG. Public entry point:
 * sanitizes `depth` itself, so it's safe to call directly with an untrusted
 * value (tests and any future external caller both rely on this).
 */
export function isBreather(depth) {
  return isBreatherOfSafeDepth(safeDepth(depth));
}

/**
 * difficultyCurve(depth) — the single source of truth downstream floor
 * generation (Plan 02's genFloor rewiring) will consume. Pure function of
 * `depth` only: no RNG parameter, no RNG consumed, no side effects, no
 * module-level mutable state. Returns:
 *   - depth: the clamped, effective integer depth used to compute this curve
 *   - breather: whether this is a BREATHER_EVERY breather floor
 *   - dots: encounter-dot count — an asymptotic soft-cap toward
 *     ENCOUNTER_DOT_CAP, or floored to ENCOUNTER_DOT_BASE on a breather floor
 *   - darkBlobs: dark-zone blob count — hard-capped at DARK_BLOB_CAP, zeroed
 *     on a breather floor
 *   - darkRadius: per-blob BFS reveal radius — hard-capped at DARK_RADIUS_CAP
 *     (not forced to zero on a breather floor: darkBlobs already being zero
 *     means no blob is ever seeded to apply this radius to)
 *   - foeCap: soft-capped max foes per encounter (Phase 21, D-01/D-19) —
 *     identity (FOE_CAP_BASE) through depth <= 5; combat knobs do NOT dip on
 *     breather floors (a breather is lighter in density/darkness, not in the
 *     power of what you meet)
 *   - foeBonus: `foeCap - FOE_CAP_BASE` (D-17) — added AFTER the canon count
 *     roll, before the foeCap clamp, so startCombat's d4/d4 draw shape never
 *     changes; 0 at depth <= 5
 *   - foeLvlBias: reserved (D-01) — always FOE_LVL_BIAS (0) unless a future
 *     retune needs it
 *   - foePower: soft-capped multiplier (Phase 21, D-02) applied to a foe's
 *     starting wp/maxWP and its flat melee damage bonus — identity (1.0)
 *     through depth <= 5
 *   - abilityThreat: soft-capped cadence scalar (Phase 21, D-03) for caster
 *     kits (every/uses) — identity (1.0) through depth <= 5
 */
export function difficultyCurve(depth) {
  const d = safeDepth(depth);
  const breather = isBreatherOfSafeDepth(d); // IN-02: d is already sanitized — skip isBreather's redundant re-clamp
  const over = Math.max(0, d - (COMBAT_SCALE_FROM_DEPTH - 1));
  const foeCap = Math.round(softCapFloat(FOE_CAP_BASE, FOE_CAP_MAX, over, FOE_CAP_SOFT_K));
  return {
    depth: d,
    breather,
    dots: breather ? ENCOUNTER_DOT_BASE : softCap(ENCOUNTER_DOT_BASE, ENCOUNTER_DOT_CAP, d, ENCOUNTER_DOT_SOFT_K),
    darkBlobs: breather ? 0 : Math.min(Math.max(0, d - 1), DARK_BLOB_CAP),
    darkRadius: Math.min(DARK_RADIUS_BASE + d, DARK_RADIUS_CAP),
    foeCap,
    foeBonus: foeCap - FOE_CAP_BASE,
    foeLvlBias: FOE_LVL_BIAS,
    foePower: softCapFloat(FOE_POWER_BASE, FOE_POWER_MAX, over, FOE_POWER_SOFT_K),
    abilityThreat: softCapFloat(ABILITY_THREAT_BASE, ABILITY_THREAT_MAX, over, ABILITY_THREAT_SOFT_K),
  };
}

// --- Phase 21 (TUNE-01): pure application helpers --------------------------
// No rng; the curve object is the only input besides plain numbers/
// descriptors — this keeps every consumer's arithmetic testable with a
// synthetic curve, independent of the real difficultyCurve() constants.

/**
 * foeCountFor(canonCount, curve) — D-17: applies the curve's zero-new-draw
 * `foeBonus` AFTER the canon count roll (already capped by the level-1
 * `cap = 2` rule), clamped at `foeCap`. `canonCount` is the prototype's own
 * `Math.min(cap, d4-ternary)` result — the d4/d4 draw shape never changes.
 */
export function foeCountFor(canonCount, curve) {
  return Math.min(curve.foeCap, canonCount + curve.foeBonus);
}

/**
 * foeWpFor(baseWp, curve) — D-02: copy-time wp/maxWP scaling. The strict
 * `=== 1` fast path makes identity structural even for a non-integer wp
 * (never rounds away from `baseWp` when `foePower` is exactly 1).
 */
export function foeWpFor(baseWp, curve) {
  return curve.foePower === 1 ? baseWp : Math.round(baseWp * curve.foePower);
}

/**
 * foeDmgBonusFor(lvl, curve) — Claude's Discretion (resolved): the flat
 * bonus scales the `lvl * lvl` base term of every foe melee swing, never the
 * `sp.dmg` dice — so no draw shape changes and damageFoe stays the one
 * foe-wp decrement seam. 0 (never a `dmgBonus` key) when `foePower === 1`.
 */
export function foeDmgBonusFor(lvl, curve) {
  return curve.foePower === 1 ? 0 : Math.round((curve.foePower - 1) * lvl * lvl);
}

/**
 * abilityCadenceFor(a, curve) — D-03/D-18: scales a kit descriptor's
 * `every`/`uses` by the curve's `abilityThreat`. The kits in
 * content/foe-abilities.js are unchanged data; at `abilityThreat === 1` both
 * fields are the descriptor's own numbers (`undefined` stays `undefined`).
 */
export function abilityCadenceFor(a, curve) {
  const t = curve.abilityThreat;
  return {
    every: a.every === undefined ? undefined : Math.max(1, Math.round(a.every / t)),
    uses: a.uses === undefined ? undefined : Math.max(1, Math.round(a.uses * t)),
  };
}
