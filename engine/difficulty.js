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
//
// Phase 54 (BAND-01/BAND-02, 2026-09-21) — the four-band curve: the user's
// stated shape (Filter 1-4 / Wall 5-8 / Breakaway 9-15 / Endgame 16-20,
// average run ends floor 5-7) reshapes floors 5-15 with a new
// `bandFoePowerFor`/`bandAbilityThreatFor` piecewise curve plus a Wall
// hazard band, while floors 1-4 keep Phase 27's ramps above (untouched by
// this module edit) and floor 16+ stays identity BY CONSTRUCTION (the same
// `>=` guard technique `graceFor`/`hazardScale` already use) so the
// `--start-depth 20` slice remains the deep-lethality yardstick. See the
// "Phase 54 (BAND-02): the four-band curve on floors 5-15" block below.
// This plan (54-01) lands the scaffold at IDENTITY values ONLY — the curve
// is byte-identical to Phase 53's at every depth; Plan 02's rungs move only
// the numbers. Recorded in docs/DIFFICULTY-RETUNE.md's
// "### v1.7 · Phase 54 — four-band retune & roster decision" section.
//
// DELIBERATE RULES CHANGE (Phase 54, BAND-02, 2026-09-21) — USER RULING C:
// mid-ladder, the user replaced the four bands' NUMERIC targets with a
// per-floor survival CURVE (docs/DIFFICULTY-RETUNE.md's `#### Target — the
// per-floor survival curve`) and ruled "rules fidelity is relaxed for
// survival rates" — dials may leave canon at ANY depth >= 2 by whatever
// amount a bot readout justifies (floor 1 stays parity-exact by rule, not
// by a structural ceiling). The band-piecewise curve above is replaced by a
// per-floor KNOT table: every existing constant name is kept and becomes a
// knot depth (FOE_GRACE_AT_2/3/4, WALL_/BREAKAWAY_/ENDGAME_FOE_POWER_AT_
// START/END, matching hazard and ability-threat knots), interpolated by
// `bandLerp` between adjacent knots, fitted rung-by-rung by a deterministic
// formula from the previous rung's per-floor survival readout (see the
// ladder's fit rule, quoted in the ledger). `ENDGAME_CANON_FROM_DEPTH`'s
// "identity by construction, never re-pinned" guarantee and
// `COMBAT_SCALE_FROM_DEPTH`'s "may only ever move up" note (both above) are
// SUPERSEDED by this ruling — 16+ is now a dialable knot pair
// (`ENDGAME_FOE_POWER_AT_START/END`), renamed `ENDGAME_CANON_FROM_DEPTH` ->
// `ENDGAME_FROM_DEPTH` with a new `ENDGAME_TO_DEPTH`. Floor 1
// (`FOE_GRACE_AT_1`, the hazard literal, floor-1 dots/dark) remains the
// ONE never-moved invariant this phase. `graceFor`/`bandFoePowerFor`/
// `bandAbilityThreatFor` are replaced by `knotFoePowerFor`/`knotHazardFor`/
// `knotAbilityThreatFor` below. History (the retired
// `FOE_GRACE_CANON_FROM_DEPTH`/`HAZARD_FLAT_THROUGH_DEPTH`/
// `HAZARD_CANON_FROM_DEPTH` constants and every superseded band value) is
// kept in docs/DIFFICULTY-RETUNE.md's change table, not in this file.

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

// --- Phase 41 (TERR-01): water pool knobs -----------------------------------
// Mirrors the darkBlobs/darkRadius depth-curve pattern above (Decision 2,
// Option A). Consumes NO rng and touches NO DOM — like every other knob in
// this module, difficultyCurve's `waterPools` field is a pure lookup on
// `depth`, so calling it never perturbs the seeded main-rng cursor. The
// actual pool PLACEMENT (engine/maze.js#placeWater) draws exclusively from a
// derived stream (`derivedRng(rng.getState(), "terrain", depth)`), per the
// 2026-09-17 greenfield ruling — no run flag, water for every run. Water is
// always passable (never blocks a path), so no pool count/size here can ever
// make a floor unsolvable — the only design axis is "detour vs. slog".

/** WATER_POOL_MIN — the pool count on floor 1 and on every breather floor
 * (a breather is lighter in density/darkness, and water follows the same
 * "lighter" convention rather than the combat-knob convention of staying
 * flat through a breather). */
export const WATER_POOL_MIN = 1;
/** WATER_POOL_CAP — the pool count ceiling water eases toward by depth
 * (reached at depth 9 and held from there on, per WATER_POOL_GROWTH_EVERY). */
export const WATER_POOL_CAP = 3;
/** WATER_POOL_GROWTH_EVERY — pool count rises by one every this-many depths
 * past floor 1 (depths 1-4 -> 1, 6-8 -> 2, 9+ -> 3, capped at
 * WATER_POOL_CAP; breather floors always report WATER_POOL_MIN instead). */
export const WATER_POOL_GROWTH_EVERY = 4;
/** WATER_POOL_SIZE_MIN — a single pool's minimum cell count (inclusive). */
export const WATER_POOL_SIZE_MIN = 3;
/** WATER_POOL_SIZE_MAX — a single pool's maximum cell count (inclusive); the
 * per-pool target size is drawn uniformly from
 * [WATER_POOL_SIZE_MIN, WATER_POOL_SIZE_MAX] on the derived terrain stream. */
export const WATER_POOL_SIZE_MAX = 8;

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
 * for this rung — see docs/DIFFICULTY-RETUNE.md's iteration log.
 *
 * DELIBERATE RULES CHANGE (Phase 54, BAND-02, 2026-09-21) — ladder rung 2
 * (USER RULING A, a Filter rung): 0.5 -> 0.4 — rung 1's own readout
 * (docs/DIFFICULTY-RETUNE.md's `#### Rung 1`) left the solo median pinned
 * at 4 (reach >=5 exactly 33.0%, unmoved) because a 5-15-only dial cannot
 * reach back into floors 1-4 (the structural bound); this is the first
 * Filter-rung notch, one step above the 0.35 ceiling floor-1 parity holds
 * (FOE_GRACE_AT_1 stays exactly 1.0; every fixture-exposed fight is still
 * floor 1 only). Floors 2-4 foePower becomes 0.4 / 0.6 / 0.8 (graceFor);
 * the Wall's own floor (WALL_FOE_POWER_AT_START 0.85) still clears
 * graceFor(4) = 0.8, so the Wall-steps-UP invariant holds unchanged this
 * rung. Readout recorded under docs/DIFFICULTY-RETUNE.md `#### Rung 2`. */
export const FOE_GRACE_AT_2 = 0.4;
/** FOE_GRACE_AT_3 — NEW knot (Phase 54, USER RULING C, rung 3a): floor 3's
 * foePower knot. Landed at rung-2's own interpolated value (0.6 — the
 * value `graceFor(3)` already computed from FOE_GRACE_AT_2/
 * FOE_GRACE_CANON_FROM_DEPTH) so the knot restructure is byte-identical;
 * fitted per rung thereafter, cited in docs/DIFFICULTY-RETUNE.md's
 * `#### Rung N`. */
export const FOE_GRACE_AT_3 = 0.6;
/** FOE_GRACE_AT_4 — NEW knot (Phase 54, USER RULING C, rung 3a): floor 4's
 * foePower knot. Landed at rung-2's own interpolated value (0.8), fitted
 * per rung thereafter. */
export const FOE_GRACE_AT_4 = 0.8;

/** HAZARD_FROM_DEPTH — Phase 27 (TUNE-06): the first depth whose hazardScale
 * may leave identity (1.0). MUST stay >= 2 (floor 1 canon — a from-floor-1
 * ramp is a 27-03 escalation with a declared parity divergence record). */
export const HAZARD_FROM_DEPTH = 2;
/** HAZARD_SCALE_AT_START — Phase 27 (TUNE-06): the hazardScale value at
 * HAZARD_FROM_DEPTH (floor 2's hazard knot). */
export const HAZARD_SCALE_AT_START = 0.5;
/** HAZARD_SCALE_AT_3 — NEW knot (Phase 54, USER RULING C, rung 3a): floor
 * 3's hazard knot. Landed at rung-2's own flat-through value (0.5),
 * fitted per rung thereafter (moves with the band's foePower fit whenever
 * hazard deaths are >= 15% of that band's deaths). */
export const HAZARD_SCALE_AT_3 = 0.5;
/** HAZARD_SCALE_AT_4 — NEW knot (Phase 54, USER RULING C, rung 3a): floor
 * 4's hazard knot. Landed at rung-2's own interpolated value (0.75),
 * fitted per rung thereafter. */
export const HAZARD_SCALE_AT_4 = 0.75;

// --- Phase 54 (BAND-02): the four-band curve on floors 5-15 ---------------
// DELIBERATE RULES CHANGE (Phase 54, BAND-02, 2026-09-21): the user's
// four-band shape (2026-09-20 todo) — Filter 1-4 / Wall 5-8 / Breakaway
// 9-15 / Endgame 16-20, average run ends floor 5-7 — with floors 1-4
// keeping Phase 27's existing ramps above (graceFor/hazardScale are NOT
// touched by this block), floors 5-15 allowed sub-identity in combat via a
// new piecewise foePower/abilityThreat curve, and 16+ identity BY
// CONSTRUCTION (the same `>=` guard technique graceFor/hazardScale already
// use for their own bands) so the `--start-depth 20` slice is the
// deep-lethality yardstick every rung is diffed against. This plan (54-01)
// lands every constant below at an IDENTITY value — difficultyCurve is
// byte-identical to Phase 53's (commit 78572c5) at every depth 1..50; Plan
// 02's ladder rungs move ONLY these numbers, each citing the bot readout
// that motivated the move. `COMBAT_SCALE_FROM_DEPTH` stays 21 this rung
// (SUPERSEDED note: Phase 27's "may only ever move up" no longer applies —
// USER RULING C permits moving it if a future rung's readout justifies it).

/** WALL_FROM_DEPTH — the first depth of the Wall band (5-8); MUST equal the
 * floor-4 knot's depth + 1 — the grace band hands straight to the Wall, no
 * gap and no overlap (the retired FOE_GRACE_CANON_FROM_DEPTH used to pin
 * this; now a structural knot-depth invariant instead). */
export const WALL_FROM_DEPTH = 5;
/** WALL_TO_DEPTH — the last depth of the Wall band (5-8). */
export const WALL_TO_DEPTH = 8;
/** WALL_FOE_POWER_AT_START — foePower at WALL_FROM_DEPTH. The Wall steps UP
 * from the floor-4 grace value and may land below 1.0 on a rung — never
 * below `graceFor(WALL_FROM_DEPTH - 1)`.
 * Phase 54 ladder rung 1 (2026-09-21, BAND-02): 1.0 -> 0.85 — the
 * prescribed starting notch (54-CONTEXT Area 1 / constraint 11); motivated
 * by the BEFORE readout (78572c5): solo death-depth 1/4/6/9, reach >=5
 * 33.0 % / >=10 0.0 %, canon identity at 5 is the cliff the surviving third
 * dies on; readout recorded under docs/DIFFICULTY-RETUNE.md `#### Rung 1`.
 * Curve 4..16 (foePower): 0.8333 (4, grace) / 0.85 (5) / 0.8833 (6) / 0.9167
 * (7) / 0.95 (8) / 0.95 (9) / 1 (16, literal). */
export const WALL_FOE_POWER_AT_START = 0.85;
/** WALL_FOE_POWER_AT_END — foePower at WALL_TO_DEPTH.
 * Phase 54 ladder rung 1 (2026-09-21, BAND-02): 1.0 -> 0.95 — see
 * WALL_FOE_POWER_AT_START's JSDoc for the readout that motivated this rung. */
export const WALL_FOE_POWER_AT_END = 0.95;
/** BREAKAWAY_FROM_DEPTH — the first depth of the Breakaway band (9-15). */
export const BREAKAWAY_FROM_DEPTH = 9;
/** BREAKAWAY_TO_DEPTH — the last depth of the Breakaway band (9-15). */
export const BREAKAWAY_TO_DEPTH = 15;
/** BREAKAWAY_FOE_POWER_AT_START — foePower at BREAKAWAY_FROM_DEPTH.
 * Phase 54 ladder rung 1 (2026-09-21, BAND-02): 1.0 -> 0.95 — see
 * WALL_FOE_POWER_AT_START's JSDoc for the readout that motivated this rung. */
export const BREAKAWAY_FOE_POWER_AT_START = 0.95;
/** BREAKAWAY_FOE_POWER_AT_END — foePower at BREAKAWAY_TO_DEPTH (the
 * Breakaway eases back to identity by 15; 16 is the literal by the guard;
 * unchanged this rung). */
export const BREAKAWAY_FOE_POWER_AT_END = 1.0;
/** ENDGAME_FROM_DEPTH — Phase 54 (USER RULING C, rung 3a): RENAMED from
 * `ENDGAME_CANON_FROM_DEPTH` (Phase 53's "identity by construction, never
 * re-pinned" guarantee on 16+ is SUPERSEDED by USER RULING C — floors 16-20
 * are now a dialable knot pair, `ENDGAME_FOE_POWER_AT_START/END` below).
 * The first depth of the Endgame band (16). */
export const ENDGAME_FROM_DEPTH = 16;
/** ENDGAME_TO_DEPTH — NEW (Phase 54, USER RULING C, rung 3a): the last
 * depth of the Endgame band (20) — MUST equal COMBAT_SCALE_FROM_DEPTH - 1
 * so the 21+ ramp (below) is continuous with this knot pair's END value at
 * the boundary (softCapFloat's over-0 exactness). */
export const ENDGAME_TO_DEPTH = 20;
/** ENDGAME_FOE_POWER_AT_START — NEW knot (Phase 54, USER RULING C, rung
 * 3a): foePower at ENDGAME_FROM_DEPTH (16). Landed at the Phase 53 identity
 * value (1.0 — the byte-identity proof for the knot restructure), fitted
 * per rung thereafter from the `--start-depth=20` slice's p_20 (fewer than
 * 10 natural runs reach floor 16 until the ladder softens floors 5-15). */
export const ENDGAME_FOE_POWER_AT_START = 1.0;
/** ENDGAME_FOE_POWER_AT_END — NEW knot (Phase 54, USER RULING C, rung 3a):
 * foePower at ENDGAME_TO_DEPTH (20) — this value also scales the
 * COMBAT_SCALE_FROM_DEPTH+ ramp (see knotFoePowerFor below): the Phase 21
 * soft-cap curve is RELATIVE to this floor-20 value now, not an absolute
 * 1.0. Landed at 1.0 (identity — the byte-identity proof), fitted per rung
 * thereafter. */
export const ENDGAME_FOE_POWER_AT_END = 1.0;
/** WALL_HAZARD_SCALE — the trap/wall-fall damage multiplier on
 * WALL_FROM_DEPTH..WALL_TO_DEPTH (scaffold: identity, 1.0 — the literal
 * `1` for scaleHazard's `=== 1` fast path); a rung-2+ dial. */
export const WALL_HAZARD_SCALE = 1.0;
/** BREAKAWAY_HAZARD_SCALE — NEW knot (Phase 54, USER RULING C, rung 3a):
 * the hazard multiplier flat across BREAKAWAY_FROM_DEPTH..BREAKAWAY_TO_DEPTH
 * (9-15). Landed at the Phase 53 identity value (1.0 — the byte-identity
 * proof), fitted per rung thereafter. */
export const BREAKAWAY_HAZARD_SCALE = 1.0;
/** ENDGAME_HAZARD_SCALE — NEW knot (Phase 54, USER RULING C, rung 3a): the
 * hazard multiplier flat across every depth >= ENDGAME_FROM_DEPTH (16),
 * including 21+ (hazard has no separate deep ramp). Landed at the Phase 53
 * identity value (1.0), fitted per rung thereafter. */
export const ENDGAME_HAZARD_SCALE = 1.0;
/** WALL_ABILITY_THREAT_AT_START — abilityThreat at WALL_FROM_DEPTH
 * (scaffold: identity; the caster-cadence band, a rung-2+ dial). */
export const WALL_ABILITY_THREAT_AT_START = 1.0;
/** WALL_ABILITY_THREAT_AT_END — abilityThreat at WALL_TO_DEPTH (scaffold: identity). */
export const WALL_ABILITY_THREAT_AT_END = 1.0;
/** BREAKAWAY_ABILITY_THREAT_AT_START — abilityThreat at BREAKAWAY_FROM_DEPTH (scaffold: identity). */
export const BREAKAWAY_ABILITY_THREAT_AT_START = 1.0;
/** BREAKAWAY_ABILITY_THREAT_AT_END — abilityThreat at BREAKAWAY_TO_DEPTH (scaffold: identity). */
export const BREAKAWAY_ABILITY_THREAT_AT_END = 1.0;
/** ENDGAME_ABILITY_THREAT_AT_START — NEW knot (Phase 54, USER RULING C,
 * rung 3a): abilityThreat at ENDGAME_FROM_DEPTH (16). Landed at the Phase
 * 53 identity value (1.0), fitted per rung when kit-bearing foes are >= 25%
 * of the Endgame band's deaths. */
export const ENDGAME_ABILITY_THREAT_AT_START = 1.0;
/** ENDGAME_ABILITY_THREAT_AT_END — NEW knot (Phase 54, USER RULING C, rung
 * 3a): abilityThreat at ENDGAME_TO_DEPTH (20) — also scales the
 * COMBAT_SCALE_FROM_DEPTH+ ability ramp, RELATIVE to this floor-20 value.
 * Landed at 1.0 (identity), fitted per rung thereafter. */
export const ENDGAME_ABILITY_THREAT_AT_END = 1.0;

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
 * bandLerp(a, b, t) — Phase 54 (BAND-02): the endpoint-exact linear
 * interpolation the knot table uses between adjacent knots. Identity by
 * construction whenever `a === b` (returns `a` for ANY `t`, never drifting
 * via floating-point arithmetic — the same discipline COMBAT_SCALE_FROM_DEPTH's
 * `over` guard uses). Exact at t = 0 and t = 1 (a knot depth returns its own
 * constant exactly, never a float that merely rounds to it). Not exported —
 * internal helper only.
 */
function bandLerp(a, b, t) {
  return a === b ? a : (1 - t) * a + t * b;
}

/**
 * knotFoePowerFor(d) — Phase 54 (USER RULING C): the per-floor foePower
 * knot table, replacing Phase 27's `graceFor` and Phase 54 (BAND-02)'s
 * `bandFoePowerFor`. Floor 1 is always exactly FOE_GRACE_AT_1 (the ONE
 * never-moved invariant this phase — never a knot). Depths 2..
 * ENDGAME_TO_DEPTH (20) interpolate via bandLerp between the nearest
 * bracketing knot pair (a knot depth returns its own constant exactly).
 * From COMBAT_SCALE_FROM_DEPTH (21) on, the Phase 21 soft-cap ramp applies
 * RELATIVE to the floor-20 value (ENDGAME_FOE_POWER_AT_END) — continuous at
 * the boundary because `over` is exactly 0 at d === ENDGAME_TO_DEPTH ===
 * COMBAT_SCALE_FROM_DEPTH - 1 (softCapFloat's over-0 exactness guarantee).
 * Not exported — internal helper only, consumed by difficultyCurve()'s
 * `foePower` field below.
 */
function knotFoePowerFor(d) {
  if (d === 1) return FOE_GRACE_AT_1;
  if (d > ENDGAME_TO_DEPTH) {
    const over = Math.max(0, d - (COMBAT_SCALE_FROM_DEPTH - 1));
    return ENDGAME_FOE_POWER_AT_END * softCapFloat(FOE_POWER_BASE, FOE_POWER_MAX, over, FOE_POWER_SOFT_K);
  }
  const knots = [
    [2, FOE_GRACE_AT_2],
    [3, FOE_GRACE_AT_3],
    [4, FOE_GRACE_AT_4],
    [WALL_FROM_DEPTH, WALL_FOE_POWER_AT_START],
    [WALL_TO_DEPTH, WALL_FOE_POWER_AT_END],
    [BREAKAWAY_FROM_DEPTH, BREAKAWAY_FOE_POWER_AT_START],
    [BREAKAWAY_TO_DEPTH, BREAKAWAY_FOE_POWER_AT_END],
    [ENDGAME_FROM_DEPTH, ENDGAME_FOE_POWER_AT_START],
    [ENDGAME_TO_DEPTH, ENDGAME_FOE_POWER_AT_END],
  ];
  for (let i = 0; i < knots.length - 1; i++) {
    const [dA, vA] = knots[i];
    const [dB, vB] = knots[i + 1];
    if (d >= dA && d <= dB) {
      const t = (d - dA) / (dB - dA);
      return bandLerp(vA, vB, t);
    }
  }
  return knots[knots.length - 1][1]; // unreachable given the d <= ENDGAME_TO_DEPTH guard above
}

/**
 * knotHazardFor(d) — Phase 54 (USER RULING C): the per-floor hazardScale
 * knot table. Literal 1 below HAZARD_FROM_DEPTH (floor 1, never moves);
 * floors 2/3/4 are their own knots (HAZARD_SCALE_AT_START/AT_3/AT_4); the
 * Wall/Breakaway/Endgame bands are each flat at their own knot
 * (WALL_HAZARD_SCALE / BREAKAWAY_HAZARD_SCALE / ENDGAME_HAZARD_SCALE) — the
 * Endgame knot covers every depth >= ENDGAME_FROM_DEPTH, including 21+
 * (hazard has no separate deep ramp, unlike foePower/abilityThreat). Not
 * exported — internal helper only, consumed by difficultyCurve()'s
 * `hazardScale` field below.
 */
function knotHazardFor(d) {
  if (d < HAZARD_FROM_DEPTH) return 1;
  if (d === 2) return HAZARD_SCALE_AT_START;
  if (d === 3) return HAZARD_SCALE_AT_3;
  if (d === 4) return HAZARD_SCALE_AT_4;
  if (d <= WALL_TO_DEPTH) return WALL_HAZARD_SCALE;
  if (d <= BREAKAWAY_TO_DEPTH) return BREAKAWAY_HAZARD_SCALE;
  return ENDGAME_HAZARD_SCALE;
}

/**
 * knotAbilityThreatFor(d) — Phase 54 (USER RULING C): the abilityThreat
 * cadence-scalar knot table, replacing Phase 54 (BAND-02)'s
 * `bandAbilityThreatFor`. Literal 1 on floors 1-4 (Phase 27's grace band
 * owns foePower there, not caster cadence); the Wall/Breakaway/Endgame
 * bands each lerp between their own AT_START/AT_END knot pair. From
 * COMBAT_SCALE_FROM_DEPTH on, the Phase 21 soft-cap ramp applies RELATIVE
 * to the floor-20 value (ENDGAME_ABILITY_THREAT_AT_END), same continuity
 * argument as knotFoePowerFor. Not exported — internal helper only,
 * consumed by difficultyCurve()'s `abilityThreat` field below.
 */
function knotAbilityThreatFor(d) {
  if (d <= 4) return 1;
  if (d > ENDGAME_TO_DEPTH) {
    const over = Math.max(0, d - (COMBAT_SCALE_FROM_DEPTH - 1));
    return ENDGAME_ABILITY_THREAT_AT_END * softCapFloat(ABILITY_THREAT_BASE, ABILITY_THREAT_MAX, over, ABILITY_THREAT_SOFT_K);
  }
  if (d <= WALL_TO_DEPTH) {
    const t = (d - WALL_FROM_DEPTH) / (WALL_TO_DEPTH - WALL_FROM_DEPTH);
    return bandLerp(WALL_ABILITY_THREAT_AT_START, WALL_ABILITY_THREAT_AT_END, t);
  }
  if (d <= BREAKAWAY_TO_DEPTH) {
    const t = (d - BREAKAWAY_FROM_DEPTH) / (BREAKAWAY_TO_DEPTH - BREAKAWAY_FROM_DEPTH);
    return bandLerp(BREAKAWAY_ABILITY_THREAT_AT_START, BREAKAWAY_ABILITY_THREAT_AT_END, t);
  }
  const t = (d - ENDGAME_FROM_DEPTH) / (ENDGAME_TO_DEPTH - ENDGAME_FROM_DEPTH);
  return bandLerp(ENDGAME_ABILITY_THREAT_AT_START, ENDGAME_ABILITY_THREAT_AT_END, t);
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
 *   - foePower: Phase 54 (USER RULING C) `knotFoePowerFor(d)` — the
 *     per-floor knot table (floor 1 always exactly FOE_GRACE_AT_1; floors
 *     2..20 interpolated between adjacent knots; 21+ the Phase 21 soft-cap
 *     ramp, RELATIVE to the floor-20 knot value)
 *   - hazardScale: Phase 54 (USER RULING C) `knotHazardFor(d)` — the
 *     per-floor hazard knot table (literal 1 below HAZARD_FROM_DEPTH; floors
 *     2/3/4 their own knots; the Wall/Breakaway/Endgame bands each flat at
 *     their own knot, the Endgame knot covering every depth >=
 *     ENDGAME_FROM_DEPTH including 21+ — hazard has no separate deep ramp)
 *   - abilityThreat: Phase 54 (USER RULING C) `knotAbilityThreatFor(d)` —
 *     literal 1 on floors 1-4; the Wall/Breakaway/Endgame bands each lerp
 *     between their own knot pair; 21+ the Phase 21 soft-cap cadence ramp
 *     (D-03), RELATIVE to the floor-20 knot value
 *   - waterPools: Phase 41 (TERR-01) — the multi-square water pool count for
 *     this floor (see the water-pool-knobs block above); consumes NO rng,
 *     zeroed to WATER_POOL_MIN (never 0) on a breather floor
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

  // Phase 54 (USER RULING C): hazardScale is the per-floor knot table —
  // see knotHazardFor's JSDoc above.
  const hazardScale = knotHazardFor(d);

  // Phase 41 (TERR-01): pool count rises by one every WATER_POOL_GROWTH_EVERY
  // depths past floor 1, capped at WATER_POOL_CAP; a breather floor always
  // reports WATER_POOL_MIN instead (the "lighter floor" convention). Zero
  // rng consumed — a pure lookup on `d`/`breather`, exactly like darkBlobs.
  const waterPools = breather
    ? WATER_POOL_MIN
    : Math.min(WATER_POOL_MIN + Math.floor((d - 1) / WATER_POOL_GROWTH_EVERY), WATER_POOL_CAP);

  return {
    depth: d,
    breather,
    dots,
    darkBlobs,
    darkRadius: Math.min(DARK_RADIUS_BASE + d, DARK_RADIUS_CAP),
    foeCap,
    foeBonus: foeCap - FOE_CAP_BASE,
    foeLvlBias: FOE_LVL_BIAS,
    foePower: knotFoePowerFor(d),
    hazardScale,
    abilityThreat: knotAbilityThreatFor(d),
    waterPools,
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
