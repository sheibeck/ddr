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
// The constants below are the 03-RESEARCH.md starting-point defaults, not a
// locked design decision — they are exactly the knobs the deferred human
// playtest (03-CONTEXT.md, criterion 3: "needs human play to floor 30-50+")
// will retune.
//
// No consumer wires this module yet — that is Plan 02's job (rewiring
// genFloor to consume difficultyCurve() in place of its inline formulas).
// This plan (03-01) lands only the module, its guards, and property tests.

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
 * isBreather(depth) — every BREATHER_EVERY-th floor after floor 1 is a
 * breather (depths 6, 11, 16, 21, ...). Pure, no RNG.
 */
export function isBreather(depth) {
  const d = safeDepth(depth);
  return d > 1 && (d - 1) % BREATHER_EVERY === 0;
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
 */
export function difficultyCurve(depth) {
  const d = safeDepth(depth);
  const breather = isBreather(d);
  return {
    depth: d,
    breather,
    dots: breather ? ENCOUNTER_DOT_BASE : softCap(ENCOUNTER_DOT_BASE, ENCOUNTER_DOT_CAP, d, ENCOUNTER_DOT_SOFT_K),
    darkBlobs: breather ? 0 : Math.min(Math.max(0, d - 1), DARK_BLOB_CAP),
    darkRadius: Math.min(DARK_RADIUS_BASE + d, DARK_RADIUS_CAP),
  };
}
