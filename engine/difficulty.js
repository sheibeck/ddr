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
// cadence). The identity band for every combat field is depth <
// COMBAT_SCALE_FROM_DEPTH (D-19 — proven by test/determinism/foe-abilities.test.js's
// tier 2/4/5 seeds and every depth-1 parity fixture, all well inside the
// band regardless of where COMBAT_SCALE_FROM_DEPTH sits); the dial VALUES
// are set by the Phase 21 retune (identity-from-6) and Phase 27's v1.2
// retune (identity-from-16, TUNE-06) and recorded in
// docs/DIFFICULTY-RETUNE.md. This module still consumes no rng and reads no
// DOM.
//
// DELIBERATE RULES CHANGE (Phase 27, 2026-09-15, TUNE-06) — early-floor
// levers and non-combat knobs: 27-CONTEXT.md's widened Lever 3, landed at
// its PARITY-CLEAN values only (the ladder cap the user set 2026-09-15,
// third round). Why: the planner's calibration showed dials + the Dante
// demotion alone cannot move the bot median off 3 — floors 2-4 kill 66-85%
// of runs (canon tier-2/3 foes, traps, wall-falls, starvation in the dark).
// Floors 1-2 stay canon BY CONSTRUCTION (never by convention): dots are
// restructured behind `DENSITY_CANON_THROUGH_DEPTH` (2), darkness holds its
// canon growth through `DARK_HOLD_THROUGH_DEPTH` (3, so floor 2 keeps its
// one canon blob), foe grace never dips below `FOE_GRACE_AT_1` (exactly 1.0)
// at floor 1, and the hazard ramp never starts before `HAZARD_FROM_DEPTH`
// (2). `FOE_GRACE_AT_1` dropping below 1.0, `HAZARD_FROM_DEPTH` dropping
// below 2, and a "darkness from floor 4" form are escalation-only rungs
// (27-03), each requiring its own declared parity divergence record (see
// test/parity/FIXTURE-INVENTORY.md's "Phase 27 early-floor divergences"
// section for the pre-enumerated records). The deep combat dials
// (COMBAT_SCALE_FROM_DEPTH, FOE_*_MAX, ABILITY_THREAT_*) are NOT moved by
// this plan. Values recorded in docs/DIFFICULTY-RETUNE.md's "## v1.2 retune
// (Phase 27)" section (Iteration 0).

/** Every BREATHER_EVERY-th floor after floor 1 is a lighter "breather" floor. */
export const BREATHER_EVERY = 5;

/** ENCOUNTER_DOT_BASE — matches the prototype's original literal "9". */
export const ENCOUNTER_DOT_BASE = 9;
/** ENCOUNTER_DOT_CAP — Phase 27 (TUNE-06): 24 -> 15 (27-02) -> 13 (27-03
 * iteration 3) — DELIBERATE RULES CHANGE (2026-09-15): the forced-20 band
 * (docs/DIFFICULTY-RETUNE.md's v1.2 section) still missed after iteration
 * 2 pushed COMBAT_SCALE_FROM_DEPTH through depth 20 (2.87 encounters
 * survived / 0.76 floors gained, targets 3.0-5.0 / 1.0-2.0) — fewer
 * encounter-triggering dots per floor from depth 3 on gives every depth a
 * better chance to gain a floor within the bot's action budget. Floors 1-2
 * are canon by construction and never reach this cap. */
export const ENCOUNTER_DOT_CAP = 13;
/** ENCOUNTER_DOT_SOFT_K — the soft-cap curve's "bend" depth; see softCap(). */
export const ENCOUNTER_DOT_SOFT_K = 12;
/** DENSITY_CANON_THROUGH_DEPTH — Phase 27 (TUNE-06): floors 1..this value
 * reproduce the prototype's exact `9+depth` dot formula BY CONSTRUCTION (the
 * soft-cap term's `over` argument is clamped to 0 through this depth), the
 * same structural-identity technique COMBAT_SCALE_FROM_DEPTH already uses
 * for the combat dials below. Floors beyond this depth ease toward
 * ENCOUNTER_DOT_CAP instead of growing unbounded. */
export const DENSITY_CANON_THROUGH_DEPTH = 2;

/** DARK_BLOB_CAP — Phase 27 (TUNE-06): 6 -> 3 — fewer dark-zone seed blobs
 * at the eased depths (see DARK_HOLD_THROUGH_DEPTH below). */
export const DARK_BLOB_CAP = 3;
/** DARK_RADIUS_BASE — matches the prototype's original literal "3". */
export const DARK_RADIUS_BASE = 3;
/** DARK_RADIUS_CAP — Phase 27 (TUNE-06): 9 -> 7 — a smaller per-blob reveal
 * radius ceiling at the eased depths. */
export const DARK_RADIUS_CAP = 7;
/** DARK_HOLD_THROUGH_DEPTH — Phase 27 (TUNE-06): darkness HOLDS at its
 * floor-2 canon blob count (1) through this depth, then resumes canon growth
 * (`d - DARK_HOLD_THROUGH_DEPTH + 1`, capped at DARK_BLOB_CAP) from the next
 * floor on. At the identity value (2) this reduces exactly to the canon
 * `min(max(0, d-1), cap)` formula for every depth — a STRUCTURAL identity,
 * not a coincidence at this one value; the landed value (3) is what actually
 * eases floors 4+ while keeping floor 2's single canon blob untouched. */
export const DARK_HOLD_THROUGH_DEPTH = 3;

// --- Phase 21/27 (TUNE-01/06, D-01/D-19): combat-scaling knobs -------------
// Identity band: depth < COMBAT_SCALE_FROM_DEPTH (see difficultyCurve's
// `over` computation below) — grace band floors 2..FOE_GRACE_CANON_FROM_DEPTH-1,
// identity through COMBAT_SCALE_FROM_DEPTH - 1 by construction ("over").
//
// DELIBERATE RULES CHANGE (Phase 27, 2026-09-15, TUNE-06) — combat dials:
// this block replaces the Phase 21 wording. Set by the v1.2 retune against
// the forced-20 band in docs/DIFFICULTY-RETUNE.md's "## v1.2 retune (Phase
// 27)" section (iteration log below): the Phase 26 handoff measured a
// level-5 hero forced to depth 20 surviving only ~1.3 encounters / 0.14
// floors gained against Phase 21's identity-from-6 dials — "instant death
// on any combat" per the user's v1.1 verdict. `COMBAT_SCALE_FROM_DEPTH` may
// only ever move UP from its Phase 21 value (6), never below it; every
// deep MAX stays >= its BASE; the curve stays monotone non-decreasing past
// depth 20 by construction (no dial-back, no forced death — user rule).
// Every constant stays identity for depth < COMBAT_SCALE_FROM_DEPTH by
// construction (`over = max(0, depth - (COMBAT_SCALE_FROM_DEPTH - 1))` is 0
// through that depth) — proven structurally, not by convention, so the
// depth <= 5 fixtures and the D-15/FID-02 pins never see a different
// number regardless of where COMBAT_SCALE_FROM_DEPTH sits. A future
// "tune-again" follow-up may edit ONLY these constants (the three MAX
// values, their *_SOFT_K siblings, and COMBAT_SCALE_FROM_DEPTH itself) plus
// append a ledger addendum — it must not touch the wiring in
// startCombat/foeAbilities.js, which 21-02 already proved correct against
// identity values.

/** COMBAT_SCALE_FROM_DEPTH — the first floor on which the combat knobs may
 * leave identity (D-19); `over = max(0, depth - (COMBAT_SCALE_FROM_DEPTH - 1))`
 * is the soft cap's argument. DELIBERATE RULES CHANGE (Phase 27, TUNE-06) —
 * combat dials: 6 -> 16 (iteration 1) -> 21 (iteration 2) against the
 * forced-20 band in docs/DIFFICULTY-RETUNE.md's v1.2 section — the Phase 26
 * handoff measured a level-5 hero forced to depth 20 surviving only ~1.3
 * encounters / 0.14 floors gained at Phase 21 identity-from-6; iteration 1's
 * identity-from-16 raised that to 2.85 encounters / 0.78 floors, still
 * short of the 3.0-5.0 / >=1.0 band, so iteration 2 pushes identity through
 * depth 20 entirely (COMBAT_SCALE_FROM_DEPTH = 21) — depth 20 is now fully
 * canon combat, the calibrated ceiling of what these dials alone can give
 * that depth (see the iteration log's "what to turn next" for the
 * non-combat levers that still apply beyond this ceiling). May only ever
 * move UP from here (never below 6); a future "tune-again" follow-up may
 * move it again. */
export const COMBAT_SCALE_FROM_DEPTH = 21;
/** FOE_CAP_BASE — the canon `c.level <= 2 ? 2 : 3` ceiling's level->=3 value. */
export const FOE_CAP_BASE = 3;
/** FOE_CAP_MAX — DELIBERATE RULES CHANGE (Phase 27, TUNE-06): 5 -> 4
 * (iteration 1) — paired with COMBAT_SCALE_FROM_DEPTH's move, a smaller
 * ceiling on foes-per-encounter growth so the forced-20 band isn't also
 * facing more bodies at once. At depth 20: foeCap 3 (exact identity — see
 * COMBAT_SCALE_FROM_DEPTH's iteration-2 move); at depth 35: 4; at depth 50:
 * 4 (via FOE_CAP_SOFT_K 20, unchanged). Identity (3) through
 * depth < COMBAT_SCALE_FROM_DEPTH. */
export const FOE_CAP_MAX = 4;
export const FOE_CAP_SOFT_K = 20;
/** FOE_POWER_BASE — the multiplier applied to a foe's starting wp/maxWP,
 * used from COMBAT_SCALE_FROM_DEPTH onward (below that depth, Phase 27's
 * `graceFor(d)` supplies the multiplier instead — see FOE_GRACE_* below). */
export const FOE_POWER_BASE = 1.0;
/** FOE_POWER_MAX — DELIBERATE RULES CHANGE (Phase 27, TUNE-06): 1.6 -> 1.3
 * (iteration 1) -> 1.15 (iteration 4) — depth 20 was fully identity by
 * iteration 2 (COMBAT_SCALE_FROM_DEPTH = 21) but the forced-20 band's
 * floors-gained row still missed after iteration 3 (mean 0.83, p50 0;
 * target mean 1.0-2.0, p50 >= 1) — a level-5 hero surviving depth 20 dies
 * again almost immediately in the still-ramping 21+ band, so this iteration
 * flattens that ramp: at depth 20: exact identity; at depth 35: ≈ +5.3%
 * hit points and flat melee damage; at depth 50: ≈ +8.6%; never above
 * +15%. Identity (1.0) through depth < COMBAT_SCALE_FROM_DEPTH. */
export const FOE_POWER_MAX = 1.15;
/** FOE_POWER_SOFT_K — iteration 2 (D-11, Phase 21): raised 25->35 per the
 * "median < 8 / p90 < 25" guidance (slower ramp, tried before lowering a
 * MAX). Unchanged by Phase 27 — the same K paired with the smaller MAX
 * above gives depth 20 a gentler start than Phase 21's identity-from-6. */
export const FOE_POWER_SOFT_K = 35;
/** ABILITY_THREAT_BASE — the cadence scalar for caster kits (every/uses). */
export const ABILITY_THREAT_BASE = 1.0;
/** ABILITY_THREAT_MAX — DELIBERATE RULES CHANGE (Phase 27, TUNE-06): 2.0 ->
 * 1.5 (iteration 1) -> 1.3 (iteration 4), same rationale as FOE_POWER_MAX
 * above — at depth 20: exact identity; at depth 35: ≈ +11.8% cadence; at
 * depth 50: ≈ +19%; never above +30%. Identity (1.0) through
 * depth < COMBAT_SCALE_FROM_DEPTH. */
export const ABILITY_THREAT_MAX = 1.3;
/** ABILITY_THREAT_SOFT_K — iteration 2 (D-11, Phase 21): raised 20->30, same
 * rationale as FOE_POWER_SOFT_K above. Unchanged by Phase 27. */
export const ABILITY_THREAT_SOFT_K = 30;
/** FOE_LVL_BIAS — reserved (D-01): 0 unless the retune needs it. */
export const FOE_LVL_BIAS = 0;

// --- Phase 27 (TUNE-06): foe-grace + hazard-ramp knobs ---------------------
// Both are draw-free difficulty.js fields, exactly like the Phase 21 combat
// dials above; both stay structurally at identity outside their own bands.

/** FOE_GRACE_AT_1 — floor 1's foePower multiplier. MUST stay exactly 1.0
 * (canon, last-resort-only if ever lowered — 27-03 escalation, with a
 * declared parity divergence record, see FIXTURE-INVENTORY.md). Every
 * fixture-exposed fight is on floor 1, so this constant is the single
 * structural guarantee that Dante's demotion is (today) this phase's only
 * parity divergence. */
export const FOE_GRACE_AT_1 = 1.0;
/** FOE_GRACE_AT_2 — DELIBERATE RULES CHANGE (Phase 27, 2026-09-15, TUNE-06):
 * floor 2's foePower multiplier (below identity — foes hit/hold less hard at
 * floors 2-4). Rises linearly to exactly 1.0 at FOE_GRACE_CANON_FROM_DEPTH.
 * Ladder rung 1, notch 2 (27-03 iteration 2): 0.75 -> 0.5 — the pooled smoke
 * median was still 3 (< the target band's 4) after iteration 1; this notch
 * is parity-clean (every fixture fights on floor 1 only; FOE_GRACE_AT_1
 * stays exactly 1.0). A third notch (-> 0.35) is the ladder cap's ceiling
 * for this rung — see docs/DIFFICULTY-RETUNE.md's iteration log. */
export const FOE_GRACE_AT_2 = 0.5;
/** FOE_GRACE_CANON_FROM_DEPTH — the first depth whose foePower returns to
 * exactly 1.0 (the literal, not merely a float that rounds to it — see
 * graceFor()'s `>=` guard below, the same structural-identity technique
 * COMBAT_SCALE_FROM_DEPTH uses). */
export const FOE_GRACE_CANON_FROM_DEPTH = 5;

/** HAZARD_FROM_DEPTH — Phase 27 (TUNE-06): the first depth whose hazardScale
 * may leave identity (1.0). MUST stay >= 2 (floor 1 canon — a from-floor-1
 * ramp is a 27-03 escalation with a declared parity divergence record). */
export const HAZARD_FROM_DEPTH = 2;
/** HAZARD_SCALE_AT_START — Phase 27 (TUNE-06): the hazardScale value at
 * HAZARD_FROM_DEPTH, held flat through HAZARD_FLAT_THROUGH_DEPTH, then
 * eased linearly to exactly 1.0 by HAZARD_CANON_FROM_DEPTH. */
export const HAZARD_SCALE_AT_START = 0.5;
/** HAZARD_FLAT_THROUGH_DEPTH — the last depth still at HAZARD_SCALE_AT_START
 * before the linear ease back to canon begins. */
export const HAZARD_FLAT_THROUGH_DEPTH = 3;
/** HAZARD_CANON_FROM_DEPTH — the first depth whose hazardScale returns to
 * exactly 1.0 (the literal — see the `>=` guard in difficultyCurve below). */
export const HAZARD_CANON_FROM_DEPTH = 5;

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
 * graceFor(d) — Phase 27 (TUNE-06): the foe-grace multiplier for depths
 * below COMBAT_SCALE_FROM_DEPTH. Floor 1 is always exactly FOE_GRACE_AT_1
 * (canon, 1.0). Depths FOE_GRACE_CANON_FROM_DEPTH and beyond are always
 * exactly 1.0 via the `>=` guard (a literal, not a float that merely rounds
 * to it — the same structural-identity technique COMBAT_SCALE_FROM_DEPTH
 * uses for the deep combat dials). Depths 2..FOE_GRACE_CANON_FROM_DEPTH-1
 * interpolate linearly from FOE_GRACE_AT_2 to 1.0. Not exported — internal
 * helper only, consumed by difficultyCurve()'s `foePower` field below.
 */
function graceFor(d) {
  if (d === 1) return FOE_GRACE_AT_1;
  if (d >= FOE_GRACE_CANON_FROM_DEPTH) return 1;
  return FOE_GRACE_AT_2 + (1 - FOE_GRACE_AT_2) * (d - 2) / (FOE_GRACE_CANON_FROM_DEPTH - 2);
}

/**
 * difficultyCurve(depth) — the single source of truth downstream floor
 * generation (Plan 02's genFloor rewiring) will consume. Pure function of
 * `depth` only: no RNG parameter, no RNG consumed, no side effects, no
 * module-level mutable state. Returns:
 *   - depth: the clamped, effective integer depth used to compute this curve
 *   - breather: whether this is a BREATHER_EVERY breather floor
 *   - dots: encounter-dot count — canon (`9+depth`) by construction through
 *     DENSITY_CANON_THROUGH_DEPTH (Phase 27), then an asymptotic soft-cap
 *     toward ENCOUNTER_DOT_CAP; floored to ENCOUNTER_DOT_BASE on a breather
 *     floor
 *   - darkBlobs: dark-zone blob count — canon growth through
 *     DARK_HOLD_THROUGH_DEPTH (Phase 27), then held at its floor-2 canon
 *     count before resuming canon growth (capped at DARK_BLOB_CAP); zeroed
 *     on a breather floor
 *   - darkRadius: per-blob BFS reveal radius — hard-capped at DARK_RADIUS_CAP
 *     (not forced to zero on a breather floor: darkBlobs already being zero
 *     means no blob is ever seeded to apply this radius to)
 *   - foeCap: soft-capped max foes per encounter (Phase 21, D-01/D-19) —
 *     identity (FOE_CAP_BASE) through depth < COMBAT_SCALE_FROM_DEPTH;
 *     combat knobs do NOT dip on breather floors (a breather is lighter in
 *     density/darkness, not in the power of what you meet)
 *   - foeBonus: `foeCap - FOE_CAP_BASE` (D-17) — added AFTER the canon count
 *     roll, before the foeCap clamp, so startCombat's d4/d4 draw shape never
 *     changes; 0 through depth < COMBAT_SCALE_FROM_DEPTH
 *   - foeLvlBias: reserved (D-01) — always FOE_LVL_BIAS (0) unless a future
 *     retune needs it
 *   - foePower: below COMBAT_SCALE_FROM_DEPTH, Phase 27's `graceFor(d)` (foe
 *     grace at floors 2-4, exactly 1.0 at floor 1 and from
 *     FOE_GRACE_CANON_FROM_DEPTH on); from COMBAT_SCALE_FROM_DEPTH on, the
 *     Phase 21 soft-capped multiplier (D-02) applied to a foe's starting
 *     wp/maxWP and its flat melee damage bonus
 *   - hazardScale: Phase 27 (TUNE-06) — the trap/wall-fall damage multiplier
 *     consumed post-draw by engine/movement.js and engine/encounters.js;
 *     exactly 1.0 below HAZARD_FROM_DEPTH and from HAZARD_CANON_FROM_DEPTH
 *     on, HAZARD_SCALE_AT_START flat through HAZARD_FLAT_THROUGH_DEPTH, then
 *     eased linearly back to 1.0
 *   - abilityThreat: soft-capped cadence scalar (Phase 21, D-03) for caster
 *     kits (every/uses) — identity (1.0) through depth < COMBAT_SCALE_FROM_DEPTH
 */
export function difficultyCurve(depth) {
  const d = safeDepth(depth);
  const breather = isBreatherOfSafeDepth(d); // IN-02: d is already sanitized — skip isBreather's redundant re-clamp
  const over = Math.max(0, d - (COMBAT_SCALE_FROM_DEPTH - 1));
  const foeCap = Math.round(softCapFloat(FOE_CAP_BASE, FOE_CAP_MAX, over, FOE_CAP_SOFT_K));

  // Phase 27 (TUNE-06): dots stay canon (9+depth) through
  // DENSITY_CANON_THROUGH_DEPTH by construction (dOver clamped to 0), then
  // ease toward ENCOUNTER_DOT_CAP. shallowDots + a soft-cap term is
  // exactly the canon formula when `over === 0`.
  const shallowDots = ENCOUNTER_DOT_BASE + Math.min(d, DENSITY_CANON_THROUGH_DEPTH);
  const dOver = Math.max(0, d - DENSITY_CANON_THROUGH_DEPTH);
  const dots = breather
    ? ENCOUNTER_DOT_BASE
    : shallowDots + Math.round(softCapFloat(0, ENCOUNTER_DOT_CAP - (ENCOUNTER_DOT_BASE + DENSITY_CANON_THROUGH_DEPTH), dOver, ENCOUNTER_DOT_SOFT_K));

  // Phase 27 (TUNE-06): darkBlobs holds at its floor-2 canon count (1)
  // through DARK_HOLD_THROUGH_DEPTH, then resumes canon growth. At the
  // identity value (DARK_HOLD_THROUGH_DEPTH === 2) this is a STRUCTURAL
  // identity with the canon `min(max(0,d-1),cap)` formula for every depth.
  const darkBlobs = breather
    ? 0
    : d <= DARK_HOLD_THROUGH_DEPTH
      ? Math.min(Math.max(0, d - 1), 1)
      : Math.min(d - DARK_HOLD_THROUGH_DEPTH + 1, DARK_BLOB_CAP);

  // Phase 27 (TUNE-06): hazardScale — literal 1 outside
  // [HAZARD_FROM_DEPTH, HAZARD_CANON_FROM_DEPTH), flat at
  // HAZARD_SCALE_AT_START through HAZARD_FLAT_THROUGH_DEPTH, then linear
  // back to exactly 1.0.
  const hazardScale =
    d < HAZARD_FROM_DEPTH || d >= HAZARD_CANON_FROM_DEPTH
      ? 1
      : d <= HAZARD_FLAT_THROUGH_DEPTH
        ? HAZARD_SCALE_AT_START
        : HAZARD_SCALE_AT_START + (1 - HAZARD_SCALE_AT_START) * (d - HAZARD_FLAT_THROUGH_DEPTH) / (HAZARD_CANON_FROM_DEPTH - HAZARD_FLAT_THROUGH_DEPTH);

  return {
    depth: d,
    breather,
    dots,
    darkBlobs,
    darkRadius: Math.min(DARK_RADIUS_BASE + d, DARK_RADIUS_CAP),
    foeCap,
    foeBonus: foeCap - FOE_CAP_BASE,
    foeLvlBias: FOE_LVL_BIAS,
    foePower: d < COMBAT_SCALE_FROM_DEPTH ? graceFor(d) : softCapFloat(FOE_POWER_BASE, FOE_POWER_MAX, over, FOE_POWER_SOFT_K),
    hazardScale,
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
 * (never rounds away from `baseWp` when `foePower` is exactly 1). Phase 27
 * (TUNE-06): `Math.max(1, ...)` on the non-identity path so a graced
 * low-wp foe (foePower < 1) never rounds down to 0 hit points.
 */
export function foeWpFor(baseWp, curve) {
  return curve.foePower === 1 ? baseWp : Math.max(1, Math.round(baseWp * curve.foePower));
}

/**
 * foeDmgBonusFor(lvl, curve) — Claude's Discretion (resolved): the flat
 * bonus scales the `lvl * lvl` base term of every foe melee swing, never the
 * `sp.dmg` dice — so no draw shape changes and damageFoe stays the one
 * foe-wp decrement seam. 0 (never a `dmgBonus` key) when `foePower === 1`.
 * Phase 27 (TUNE-06): a graced floor (foePower < 1) legitimately returns a
 * NEGATIVE bonus — engine/combat.js's startCombat copies it whenever it is
 * `!== 0` (not merely `> 0`), so a grace floor's foes hit softer too. The
 * `|| 0` normalizes a `-0` rounding result (e.g. lvl 1 at a mild grace) to
 * plain `0`, since `-0` is a footgun for any future strict-equality/JSON
 * consumer even though `-0 !== 0` is already `false` for the copy gate above.
 */
export function foeDmgBonusFor(lvl, curve) {
  return curve.foePower === 1 ? 0 : Math.round((curve.foePower - 1) * lvl * lvl) || 0;
}

/**
 * scaleHazard(amount, curve) — Phase 27 (TUNE-06): post-draw trap/wall-fall
 * damage scaling. The strict `=== 1` fast path makes identity structural
 * (byte-identical `amount` back) outside the hazard-ramp band; `amount <= 0`
 * is also passed through unscaled (nothing to floor). On the scaled path,
 * `Math.max(1, Math.round(...))` guarantees a positive incoming hazard never
 * scales down to 0 damage. Zero rng draws either way — pure arithmetic on an
 * already-rolled number, consumed by engine/movement.js's fall `hurt` and
 * engine/encounters.js's springTrap `dmg`.
 */
export function scaleHazard(amount, curve) {
  return curve.hazardScale === 1 || amount <= 0 ? amount : Math.max(1, Math.round(amount * curve.hazardScale));
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
