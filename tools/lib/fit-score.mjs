// tools/lib/fit-score.mjs
//
// Phase 54 (BAND-02, 2026-09-21, USER RULING D) — 54-06/54-07's TUNING FIT:
// the pure scoring library tools/fit-difficulty.mjs's evaluator/search CLI
// consumes. PURE — no engine import, no rng, no file I/O, no console output.
// Every function here is a deterministic function of its (plain-object)
// arguments, so this file is directly unit-testable (test/unit/
// fit-score.test.js) without spinning up the bot or the worker-thread
// machinery at all.
//
// `scoreSurvival` reads its `survival` argument's OWN `SL`/`pL` fields
// (already computed by tools/lib/band-readout.mjs#survivalReadout) and
// scores them against this module's OWN engine-free copy of the Phase 79.2
// target (EARLY_TARGET_S, floors 1-12 — user ruling 2026-09-27: floor L is
// USER RULING C's floor 2L, so the fair bot's p50 death depth lands at 3-4),
// so a "never reached" floor can still be scored (S_L = 0) against its
// target. This is the ONLY reason this file holds a copy of that data rather
// than importing band-readout.mjs#TARGET_SURVIVAL (which would pull the
// whole engine in through tools/lib/tuning-bot.mjs);
// test/unit/early-floor-targets.test.js proves the two copies agree.
//
// TUNING FIT — not a gate; the fair bot's solo run is the objective; the
// class smoke is run by 54-04 (BEFORE) and 54-07 (AFTER) only.

/**
 * EARLY_TARGET_S — the Phase 79.2 per-floor cumulative survival target
 * (`S_L`, floors 1-12; index 0 is floor 1). User ruling 2026-09-27: the
 * fair bot's fresh p50 death depth is 3-4 at 1,000 seeds. The rule: floor
 * L's target is USER RULING C's target at floor 2L (Ruling C at twice the
 * pace — every S_L is one of the user's own ruled digits). Supersedes USER
 * RULING D's fair-bot 5-7 for floors 1-12. Floors 13+ carry no survival
 * target: TAIL_TARGETS (tools/lib/tail-score.mjs) governs the tail. The
 * engine-free copy of tools/lib/band-readout.mjs#TARGET_SURVIVAL's S_L
 * column (test/unit/early-floor-targets.test.js ties them).
 */
export const EARLY_TARGET_S = [95.1, 79.7, 58.4, 38.7, 24.3, 15.1, 9.5, 6.2, 4.2, 3.0, 2.2, 1.7];

/**
 * P50_DEATH_BAND — user ruling 2026-09-27 ("Lower the bot target"): the fair
 * bot's p50 death depth (survivalReadout's `p50Death`, nearest-rank over
 * completed runs) must land inside [3, 4], inclusive, for a PASS verdict.
 */
export const P50_DEATH_BAND = [3, 4];

/**
 * FILTER_SHAPE — Phase 79.2's "the Filter is variance-driven, not a flat
 * wall" gate. Anchored on the user's Phase 54 words "that curve is not a
 * curve, that's a wall", said of an 81 -> 55 drop in per-floor survival:
 *   - a WALL is a single-floor cliff: p_(L-1) - p_L above `maxDrop` (20
 *     points) on any floor in `floors` (1-5), with p_0 = 100;
 *   - a FLAT Filter is p_1 - p_4 (`riseFloors`) under `minRise` (10 points):
 *     the per-floor death rate must climb through the Filter.
 * The Phase 79.2 target itself passes with room (largest drop 11.3 on floor
 * 2, rise 28.8).
 */
export const FILTER_SHAPE = { floors: [1, 5], maxDrop: 20, riseFloors: [1, 4], minRise: 10 };

/** REACH20_BAND — the pass band on the % of runs reaching floor 20 (a rate, tail-only, never part of the score/verdict). */
export const REACH20_BAND = [3.0, 5.0];

function targetSFor(L) {
  return L >= 1 && L <= EARLY_TARGET_S.length ? EARLY_TARGET_S[L - 1] : null;
}

function round1(x) {
  return Math.round(x * 10) / 10;
}

/**
 * filterShape(survival) — the FILTER_SHAPE gate over survival.floors' own
 * `pL` values (floors 1-5, p_0 = 100). Returns `{ ok, maxDrop, maxDropFloor,
 * rise, reasons }` (maxDrop and rise rounded to 1 dp; null when unmeasured).
 * A missing or null p_L fails with "floor L unmeasured".
 */
export function filterShape(survival) {
  const byL = new Map((survival?.floors || []).map((f) => [f.floor, f]));
  const [lo, hi] = FILTER_SHAPE.floors;
  const reasons = [];
  let ok = true;
  let maxDrop = null;
  let maxDropFloor = null;
  const pOf = (L) => {
    const f = byL.get(L);
    return f && typeof f.pL === "number" ? f.pL : null;
  };
  let prev = 100;
  for (let L = lo; L <= hi; L++) {
    const p = pOf(L);
    if (p === null) {
      ok = false;
      reasons.push(`floor ${L} unmeasured`);
      prev = null;
      continue;
    }
    if (prev !== null) {
      const drop = round1(prev - p);
      if (maxDrop === null || drop > maxDrop) {
        maxDrop = drop;
        maxDropFloor = L;
      }
      if (drop > FILTER_SHAPE.maxDrop) {
        ok = false;
        reasons.push(`floor ${L} drops ${drop} points (> ${FILTER_SHAPE.maxDrop}): a wall`);
      }
    }
    prev = p;
  }
  const [r1, r2] = FILTER_SHAPE.riseFloors;
  const p1 = pOf(r1);
  const p4 = pOf(r2);
  const rise = p1 !== null && p4 !== null ? round1(p1 - p4) : null;
  if (rise !== null && rise < FILTER_SHAPE.minRise) {
    ok = false;
    reasons.push(`floors ${r1}-${r2} rise ${rise} points (< ${FILTER_SHAPE.minRise}): flat`);
  }
  return { ok, maxDrop, maxDropFloor, rise, reasons };
}

/**
 * scoreSurvival(survival) — the fit's objective. `survival` is
 * tools/lib/band-readout.mjs#survivalReadout's own return shape (`{
 * startDepth, runs, stuck, reach20, floors: [{ floor, pL, SL, ... }] }`).
 * Returns `{ score, terms, tail, reach20, verdict, misses, p50Death,
 * p50InBand, shape }` (Phase 79.2 targets, user ruling 2026-09-27):
 *   - `score` = Σ_{L=1..10} ((S_L - T_L)/8)^2 + Σ_{L=11..12} ((S_L - T_L)/3)^2
 *     (floors 1-12 ONLY; a floor never reached by this run counts S_L = 0)
 *   - `terms` = one row per floor 1-12: { floor, SL, target, tolerance, term }
 *   - `tail` = one row per floor 13-20 (informational, never scored; `target`
 *     and `dS` are null — floors 13+ carry no survival target since Phase
 *     79.2, TAIL_TARGETS governs the tail)
 *   - `reach20` = the run's own reach-20 rate (informational, never scored)
 *   - `verdict` = "PASS" only when every floor 1-12 is within its tolerance
 *     band AND `p50InBand` AND `shape.ok`, else "MISS"
 *   - `misses` = the floors (1-12) outside their tolerance band
 *   - `p50Death` = survival.p50Death (or null); `p50InBand` = a number
 *     inside P50_DEATH_BAND (inclusive); `shape` = filterShape(survival)
 */
export function scoreSurvival(survival) {
  const floorsByL = new Map((survival?.floors || []).map((f) => [f.floor, f]));
  let score = 0;
  const terms = [];
  const misses = [];
  for (let L = 1; L <= 12; L++) {
    const f = floorsByL.get(L);
    const SL = f && typeof f.SL === "number" ? f.SL : 0;
    const target = targetSFor(L);
    const tolerance = L <= 10 ? 8 : 3;
    const term = ((SL - target) / tolerance) ** 2;
    score += term;
    const pass = Math.abs(SL - target) <= tolerance;
    if (!pass) misses.push(L);
    terms.push({ floor: L, SL, target, tolerance, term: Math.round(term * 1e6) / 1e6 });
  }
  const tail = [];
  for (let L = 13; L <= 20; L++) {
    const f = floorsByL.get(L);
    const SL = f && typeof f.SL === "number" ? f.SL : 0;
    const target = targetSFor(L);
    tail.push({ floor: L, SL, target, dS: target === null ? null : round1(SL - target) });
  }
  const p50Death = typeof survival?.p50Death === "number" ? survival.p50Death : null;
  const p50InBand = p50Death !== null && p50Death >= P50_DEATH_BAND[0] && p50Death <= P50_DEATH_BAND[1];
  const shape = filterShape(survival);
  return {
    score: Math.round(score * 1e6) / 1e6,
    terms,
    tail,
    reach20: survival?.reach20 ?? 0,
    verdict: misses.length === 0 && p50InBand && shape.ok ? "PASS" : "MISS",
    misses,
    p50Death,
    p50InBand,
    shape,
  };
}

/**
 * medianOf(values) — the interpolated median of a (possibly unsorted)
 * numeric array, `null`-filtered first. Ports
 * tools/lib/band-readout.mjs#interpolatedMedian's exact arithmetic (middle
 * value on an odd length, the mean of the two middle values on an even
 * length) as a local, dependency-free copy — this module never imports
 * band-readout.mjs (see the module header).
 */
function medianOf(values) {
  const sorted = values.filter((v) => v !== null && v !== undefined).sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return null;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** CLASS_POOL_MIN_N — a class pool below this run count is unconstrained (too few runs for a meaningful comparison). */
export const CLASS_POOL_MIN_N = 20;

/** CLASS_P50_TOLERANCE — USER RULING G "Adjustment 2" (2026-09-21, cycle 3): loosened from 1.0 to 2.0 floors. */
export const CLASS_P50_TOLERANCE = 2.0;

/** CLASS_REACH5_TOLERANCE — USER RULING G "Adjustment 2" (2026-09-21, cycle 3): loosened from 12 to 20 points. */
export const CLASS_REACH5_TOLERANCE = 20;

/**
 * CLASS_CONSTRAINT_EXEMPT — the class pools whose p50/reach5 breach of the
 * pooled values is REPORTED but never rejects a candidate. USER RULING
 * 2026-09-28 (Phase 79.2-02, on the START row's Magic User reach5 49.3 vs
 * pooled 83.5): "This is fine for now. Magic users require much more
 * tactical play." The pooled values are unchanged (the median of every
 * eligible class, the Magic User included); Fighter and Thief are still held
 * to them; the identity rules (3-4) never involved the Magic User.
 */
export const CLASS_CONSTRAINT_EXEMPT = Object.freeze(["Magic User"]);

/**
 * classConstraints(classIdentity) — the class-pool fairness + identity
 * constraint gate. `classIdentity` is tools/lib/band-readout.mjs
 * #classIdentityReadout's own return shape (an array of exactly the three
 * CLASS_POOLS rows). DESIGN NOTE (this plan's own discretion — the pooled
 * comparison point): "pooled" is the MEDIAN of the three class pools' own
 * p50/reach5 values (`medianOf`, the same interpolated-median arithmetic
 * every other percentile in this codebase uses) — the plan's dial table
 * never specifies a full raw-run pool the constraint could read (this
 * function receives only the three-row summary), so median-of-medians is
 * the smallest, most self-consistent definition available from that input
 * alone; documented in 54-06-SUMMARY.md's Deviations.
 *
 * Four rules, each skipped (not failed) for any class pool with n <
 * CLASS_POOL_MIN_N runs (that pool's row gets a `"<cls> n<20 —
 * unconstrained"` reason, `ok` stays true unless another eligible rule
 * fails):
 *   1. |p50 - pooledP50| <= 2.0 floors
 *   2. |reach5 - pooledReach5| <= 20 points
 *   3. Fighter.dmgTakenPerFight >= Thief.dmgTakenPerFight
 *   4. Thief.roundsPerFight <= Fighter.roundsPerFight
 *
 * USER RULING G "Adjustment 2" (2026-09-21, mid-54-07, cycle 3): rules 1-2
 * loosened from 1.0 floor / 12 points — the user ruled class pools are not
 * meant to be equal; a 1-floor tolerance on an INTEGER median vetoed ~60%
 * of cycle-2's candidates (a 1-floor median swing is common noise at 200
 * seeds/class, not a real fairness violation).
 *
 * USER RULING 2026-09-28 (Phase 79.2-02): a class in CLASS_CONSTRAINT_EXEMPT
 * (the Magic User) never fails rules 1-2. Its breach is still measured and
 * listed in `exempt` (the same reason text + " — exempt"), never in
 * `reasons`, so it neither sets `ok` false nor counts as a rejection.
 *
 * Returns `{ ok, reasons, exempt, pooledP50, pooledReach5, rows }`.
 */
export function classConstraints(classIdentity) {
  const rows = {};
  for (const row of classIdentity || []) rows[row.cls] = row;
  const reasons = [];
  const exempt = [];
  let ok = true;

  const eligible = (cls) => !!(rows[cls] && rows[cls].n >= CLASS_POOL_MIN_N);
  for (const cls of Object.keys(rows)) {
    if (!eligible(cls)) reasons.push(`${cls} n<20 — unconstrained`);
  }

  const eligibleClasses = Object.keys(rows).filter(eligible);
  const pooledP50 = medianOf(eligibleClasses.map((cls) => rows[cls].p50));
  const pooledReach5 = medianOf(eligibleClasses.map((cls) => rows[cls].reach5));

  for (const cls of eligibleClasses) {
    const row = rows[cls];
    const isExempt = CLASS_CONSTRAINT_EXEMPT.includes(cls);
    const breach = (text) => {
      if (isExempt) {
        exempt.push(`${text} — exempt`);
      } else {
        ok = false;
        reasons.push(text);
      }
    };
    if (pooledP50 !== null && row.p50 !== null && Math.abs(row.p50 - pooledP50) > CLASS_P50_TOLERANCE) {
      breach(`${cls} p50 ${row.p50} vs pooled ${pooledP50} (|delta| > ${CLASS_P50_TOLERANCE})`);
    }
    if (pooledReach5 !== null && row.reach5 !== null && Math.abs(row.reach5 - pooledReach5) > CLASS_REACH5_TOLERANCE) {
      breach(`${cls} reach5 ${row.reach5} vs pooled ${pooledReach5} (|delta| > ${CLASS_REACH5_TOLERANCE})`);
    }
  }

  if (eligible("Fighter") && eligible("Thief")) {
    const f = rows.Fighter;
    const t = rows.Thief;
    if (f.dmgTakenPerFight !== null && t.dmgTakenPerFight !== null && f.dmgTakenPerFight < t.dmgTakenPerFight) {
      ok = false;
      reasons.push(`Fighter dmgTakenPerFight ${f.dmgTakenPerFight} < Thief's ${t.dmgTakenPerFight}`);
    }
    if (f.roundsPerFight !== null && t.roundsPerFight !== null && t.roundsPerFight > f.roundsPerFight) {
      ok = false;
      reasons.push(`Thief roundsPerFight ${t.roundsPerFight} > Fighter's ${f.roundsPerFight}`);
    }
  }

  return { ok, reasons, exempt, pooledP50, pooledReach5, rows };
}

/**
 * SEARCH_PLAN — the CORE coordinates, 10 then 9 (USER CUT, 2026-09-21, plan
 * approval). Coordinates transcribed verbatim from 54-06-PLAN.md's dial
 * table's `Search bounds (step)` / `Search order` columns. `applyStep`
 * refuses any key outside this list.
 *
 * History: USER RULING F "Adjustment 1"/"Adjustment 1b" (2026-09-21, mid-
 * 54-07, cycle 2) temporarily promoted `CLASS_MITIGATION["Magic User"].
 * spellPower` into this list as an 11th (then 1st) coordinate, after 27
 * cycle-1 evaluations showed 22 of 25 rejections were the class-fairness
 * guardrail on the Magic User. USER RULING G "Adjustment 2" (2026-09-21,
 * cycle 3) DROPS it again: across cycle 2's 200-seed evaluations the
 * coordinate proved a structural no-op — the per-floor survival metric
 * never registered a change from moving spellPower alone (it scales
 * offensive spell DAMAGE, which this objective's S_L curve does not read
 * directly) — while the real fairness fix (loosening the tolerance itself,
 * see classConstraints above) was the one that actually mattered. The
 * coordinate returns to HELD_DIALS below at its identity value (1).
 *
 * User ruling 2026-09-27 (quick fix 79-02c): the stairs heal nothing, so
 * the `HERO_REGEN_PER_FLOOR` coordinate is gone with its dial. The core is
 * now 9. A dial set (a --start file, an old fit log) that still names it
 * fails loudly: engine/difficulty.js#setDialsForTuning throws on an
 * unknown dial.
 *
 * Phase 79.2 (user ruling 2026-09-27; the coordinate order is the planner's
 * call under 79.2-CONTEXT.md's discretion): the SAME 9 coordinates with the
 * SAME Phase 54 steps and bounds, re-ordered for the early-floor retune.
 * The foe-side base levers come first, because they act from floor 1 and
 * weigh relatively most on the early floors (FOE_HIT_SCALE.base, then
 * FOE_LEVEL.base). Hazards come next, for the Filter's bad-drop variance
 * (HAZARD_SCALE.base). Then foe HP and encounter density, then the two hero
 * dials, which carry the largest parity re-declaration. The two depth slopes
 * (FOE_HIT_SCALE.perDepth, FOE_LEVEL.perDepth) go last, because they steepen
 * the tail most and the tail already sits at its ruled limits.
 *
 * RF-79.2-02-2 (Phase 79.2-02, the orchestrator's search-parameter call,
 * 2026-09-28): cycle 2 froze floors 1-4 once the walk reached coordinates
 * 6-9, and c2 #18 at 1,000 seeds missed floors 3-6 (+8.2/+14.4/+11.0/+8.5)
 * with p50 5. So the four floor-1-6 base levers now go first (FOE_HP_SCALE,
 * ENCOUNTER_DOTS, HAZARD_SCALE, FOE_HIT_SCALE), then FOE_LEVEL.base and the
 * two hero dials, with the slopes last. Two upper bounds are widened, since
 * both were pinned: FOE_HP_SCALE.base 1.2 -> 1.5 and FOE_LEVEL.base 1.0 ->
 * 1.2. FOE_LEVEL.base is quantized (foeLevelFor rounds base + perDepth x d):
 * at perDepth 0.29 the step 1.0 -> 1.15 lifts floors 5 and 12 by one level,
 * and the clamp at 1.2 then lifts floor 8; floor 1 stays level 1 below
 * base 1.21 (at perDepth 0.3, base 1.2 makes floor 1 level 2). Every other
 * step and bound is unchanged.
 */
export const SEARCH_PLAN = [
  { path: ["FOE_HP_SCALE", "base"], step: 0.1, lo: 0.5, hi: 1.5 },
  { path: ["ENCOUNTER_DOTS", "base"], step: 1, lo: 5, hi: 10 },
  { path: ["HAZARD_SCALE", "base"], step: 0.1, lo: 0.3, hi: 1.0 },
  { path: ["FOE_HIT_SCALE", "base"], step: 0.08, lo: 0.4, hi: 1.0 },
  { path: ["FOE_LEVEL", "base"], step: 0.15, lo: 0.3, hi: 1.2 },
  { path: ["HERO_HP_SCALE"], step: 0.15, lo: 1.0, hi: 1.8 },
  { path: ["HERO_SP_SCALE"], step: 0.05, lo: 0.15, hi: 0.6 },
  { path: ["FOE_HIT_SCALE", "perDepth"], step: 0.01, lo: 0, hi: 0.05 },
  { path: ["FOE_LEVEL", "perDepth"], step: 0.03, lo: 0.12, hi: 0.3 },
];

/**
 * HELD_DIALS — every OTHER dial (every DIALS key not in SEARCH_PLAN), its
 * held --start value, and the release note the miss table reads (recorded,
 * never taken this plan). The maze-grid-size dial is deliberately absent —
 * cut from Phase 54 entirely (no dial, no grid change; see 54-06-PLAN.md's
 * "USER CUT" paragraph). `DOT_HP_FRACTION` is likewise absent — USER RULING
 * G (2026-09-21, cycle 3) retired it from DIALS entirely (engine/
 * difficulty.js's `DOT_HP_BASE` is a flat canon table, not a dial). USER
 * RULING G "Adjustment 2" returns `CLASS_MITIGATION["Magic User"].
 * spellPower` to this list (SEARCH_PLAN's own JSDoc above records why it
 * was dropped again) — held at its identity value (1); `Fighter`/`Thief`'s
 * rows remain the manual-notch-only knob (at most two notches per phase,
 * per 54-06/54-07's plan approval) — not a coordinate-search dial, not
 * individually held.
 */
export const HELD_DIALS = [
  { path: ["CLASS_MITIGATION", "Magic User", "spellPower"], start: 1.0, releaseIf: "held (available); [1.0, 2.0] if released — USER RULING G: proved a structural no-op at step 0.15 across 200 seeds in cycle 2" },
  { path: ["TIER_SPREAD"], start: 1, releaseIf: "available, canon" },
  { path: ["FOE_HP_SCALE", "perDepth"], start: 0.015, releaseIf: "held (available)" },
  { path: ["FOE_COUNT_SKEW"], start: 1, releaseIf: "held (available); 0..4 if released" },
  { path: ["FOE_COUNT_DEPTH", "soloOnlyOnOneFrom"], start: 5, releaseIf: "user-ruled (RULES-16); fitting deferred" },
  { path: ["FOE_COUNT_DEPTH", "atLeastTwoFrom"], start: 10, releaseIf: "user-ruled (RULES-16); fitting deferred" },
  { path: ["FOE_COUNT_DEPTH", "atLeastThreeFrom"], start: 20, releaseIf: "user-ruled (RULES-16); fitting deferred" },
  // RULES-17 (Phase 75.3, Plan 03): the knee join is a user ruling
  // (2026-09-25 — floor 13 is the first harder floor, the Phase 54 fit
  // boundary), never a fit coordinate; the two tail slopes and the elite HP
  // bonus are start values 75.3-06's checkpointed tail sweep will search.
  { path: ["FOE_HIT_SCALE", "kneeDepth"], start: 12, releaseIf: "user-ruled (2026-09-25); never searched" },
  { path: ["FOE_HIT_SCALE", "perDepthAfter"], start: 0.02, releaseIf: "searched by 75.3-06's tail sweep" },
  { path: ["FOE_HP_SCALE", "kneeDepth"], start: 12, releaseIf: "user-ruled (2026-09-25); never searched" },
  { path: ["FOE_HP_SCALE", "perDepthAfter"], start: 0.03, releaseIf: "searched by 75.3-06's tail sweep" },
  { path: ["FOE_ELITE", "maxRank"], start: 10, releaseIf: "held (available); start value, not fitted" },
  { path: ["FOE_ELITE", "hpPerRank"], start: 0.1, releaseIf: "searched by 75.3-06's tail sweep" },
  { path: ["FOE_ELITE", "hitPerRank"], start: 0.05, releaseIf: "held (available); start value, not fitted" },
  // RULES-18 (Phase 75.3, Plan 04): the SAME knee-shaped precedent as
  // FOE_HIT_SCALE/FOE_HP_SCALE above — kneeDepth/holdRounds are user rulings
  // (2026-09-25), never fit coordinates; resistPerDepth is a start value
  // 75.3-06's checkpointed tail sweep will search; resistCap is held.
  { path: ["CONTROL_AT_DEPTH", "kneeDepth"], start: 12, releaseIf: "user-ruled (2026-09-25); never searched" },
  { path: ["CONTROL_AT_DEPTH", "resistPerDepth"], start: 1, releaseIf: "searched by 75.3-06's tail sweep" },
  { path: ["CONTROL_AT_DEPTH", "resistCap"], start: 15, releaseIf: "held (available); start value, not fitted" },
  { path: ["CONTROL_AT_DEPTH", "holdRounds"], start: 3, releaseIf: "user-ruled (2026-09-25); never searched" },
  { path: ["ROUND_DAMAGE_CEILING"], start: 0.5, releaseIf: "held (available); [0.3, 1.0] if released" },
  { path: ["ABILITY_THREAT", "base"], start: 1.0, releaseIf: "held (available); base [0.6, 1.2] if released" },
  { path: ["ABILITY_THREAT", "perDepth"], start: 0, releaseIf: "held (available)" },
  { path: ["CAMP_HEAL_FRACTION"], start: 0.2, releaseIf: "held (available); [0.15, 0.5] if released" },
  { path: ["FOOD_CLOCK"], start: 1.5, releaseIf: "held (available); [1.0, 1.6] if released" },
  { path: ["HAZARD_SCALE", "perDepth"], start: 0.02, releaseIf: "held (available)" },
  { path: ["DARK_BLOBS", "base"], start: -0.4, releaseIf: "held (available)" },
  { path: ["DARK_BLOBS", "perDepth"], start: 0.7, releaseIf: "held (available); [0.3, 1.0] if released" },
  { path: ["DARK_BLOB_CAP"], start: 3, releaseIf: "held (available)" },
  { path: ["DARK_RADIUS", "base"], start: 3, releaseIf: "held (available)" },
  { path: ["DARK_RADIUS", "perDepth"], start: 1, releaseIf: "held (available)" },
  { path: ["DARK_RADIUS_CAP"], start: 7, releaseIf: "held (available)" },
  { path: ["STORE_TIER", "base"], start: 0, releaseIf: "held (available)" },
  { path: ["STORE_TIER", "perDepth"], start: 0.3, releaseIf: "held (available); perDepth [0.15, 0.6] if released" },
  { path: ["LOOT_SCALE"], start: 0.8, releaseIf: "held (available); [0.4, 1.5] if released" },
  // Phase 92 plan 03 (ECON-12): the store's sell fraction; an economy dial the
  // difficulty fit never searches (plan 92-03's own fit sets it).
  { path: ["SELL_FRACTION", "shallow"], start: 0.5, releaseIf: "held (available)" },
  { path: ["SELL_FRACTION", "deep"], start: 0.5, releaseIf: "held (available)" },
  { path: ["SELL_FRACTION", "shallowTo"], start: 4, releaseIf: "held (available)" },
  { path: ["SELL_FRACTION", "deepFrom"], start: 7, releaseIf: "held (available)" },
  { path: ["DOT_MIX", "fight"], start: 1.0, releaseIf: "held (available); [0.6, 1.2] if released" },
  { path: ["DOT_MIX", "harm"], start: 1.0, releaseIf: "available, canon" },
  { path: ["DOT_MIX", "loot"], start: 1.0, releaseIf: "available, canon" },
  { path: ["DOT_MIX", "help"], start: 1.0, releaseIf: "available, canon" },
  { path: ["WANDER_RATE"], start: 1, releaseIf: "held (available); {0, 1, 2} if released" },
  { path: ["FOE_ACCURACY"], start: 0, releaseIf: "held (available); -3..+3 if released" },
  { path: ["FLEE_NEED_MOD"], start: 0, releaseIf: "available, canon" },
  { path: ["PARLEY_NEED_MOD"], start: 0, releaseIf: "available, canon" },
  { path: ["STARTING_GOLD"], start: 50, releaseIf: "available, canon" },
  { path: ["STARTING_POTION_BONUS"], start: 0, releaseIf: "available, canon" },
];

/**
 * applyStep(dials, coord, dir, stepScale) — a NEW deep-cloned dial set with
 * `coord`'s coordinate moved by `dir * coord.step * stepScale`, clamped to
 * `[coord.lo, coord.hi]`, rounded to 4dp. Returns `null` when the move would
 * not actually change the value (already at a bound, or a zero-effect step)
 * — the caller treats `null` as "nothing to probe here".
 */
export function applyStep(dials, coord, dir, stepScale = 1) {
  const { path, step, lo, hi } = coord;
  let current = dials;
  for (const key of path) current = current[key];
  const delta = dir * step * stepScale;
  let next = current + delta;
  next = Math.min(hi, Math.max(lo, next));
  next = Number(next.toFixed(4));
  if (next === current) return null;
  const clone = JSON.parse(JSON.stringify(dials));
  let target = clone;
  for (let i = 0; i < path.length - 1; i++) target = target[path[i]];
  target[path[path.length - 1]] = next;
  return clone;
}

/**
 * evalRow(n, dials, result) — the JSONL record for one evaluation. `result`
 * bundles the pieces tools/fit-difficulty.mjs's worker-aggregation already
 * computed: `{ survival, scored (scoreSurvival's own return), classIdentity,
 * constraints (classConstraints' own return), pace (paceReadout's own
 * return), elapsedMs, walkPass }`. A constraint-rejected candidate
 * (`constraints.ok === false`) is scored `Infinity` with its `verdict`
 * forced to "MISS" and a `reason` field joining `constraints.reasons` — the
 * REJECTED candidate rule from this plan's own truths. Phase 79.2: floors
 * with no target (13-20) carry `dS: null`; the row carries `p50Death`,
 * `p50InBand` and `shape` from `scored`.
 */
export function evalRow(n, dials, result) {
  const { survival, scored, classIdentity, constraints, pace, elapsedMs, walkPass = 1 } = result;
  const floorsByL = new Map((survival?.floors || []).map((f) => [f.floor, f]));
  const floors = [];
  for (let L = 1; L <= 20; L++) {
    const f = floorsByL.get(L);
    const SL = f && typeof f.SL === "number" ? f.SL : 0;
    const target = targetSFor(L);
    floors.push({
      L,
      pL: f && typeof f.pL === "number" ? f.pL : null,
      SL,
      dS: target === null ? null : round1(SL - target),
      tail: L >= 13,
    });
  }
  const rejected = !constraints.ok;
  const score = rejected ? Infinity : scored.score;
  const verdict = rejected ? "MISS" : scored.verdict;
  return {
    n,
    pass: walkPass,
    dials,
    score,
    verdict,
    misses: scored.misses,
    p50Death: scored.p50Death ?? null,
    p50InBand: scored.p50InBand ?? false,
    shape: scored.shape ?? null,
    reach20: survival?.reach20 ?? 0,
    floors,
    classes: classIdentity,
    constraints,
    pace: (pace?.floors || []).map((f) => ({ L: f.floor, level: f.meanLevel, gold: f.meanGold, maxWP: f.meanMaxWP })),
    elapsedMs,
    ...(rejected ? { reason: constraints.reasons.join("; ") } : {}),
  };
}

/**
 * formatEvalLine(row) — one STDOUT line per evaluation. Begins `#n score=`
 * (never any other prefix — the dry-run/search CLI's own guarantee). Phase
 * 79.2: carries `deathP50=`, `shape=` and the early floors S1-S4.
 */
export function formatEvalLine(row) {
  const S = (L) => {
    const f = row.floors.find((x) => x.L === L);
    return f && typeof f.SL === "number" ? f.SL.toFixed(1) : "n/a";
  };
  const scoreStr = row.score === Infinity ? "+Infinity" : row.score.toFixed(4);
  const p50For = (cls) => {
    const row2 = row.classes.find((c) => c.cls === cls);
    return row2 && row2.p50 !== null && row2.p50 !== undefined ? row2.p50 : "n/a";
  };
  const classesStr = `${p50For("Fighter")}/${p50For("Thief")}/${p50For("Magic User")}`;
  const deathStr = typeof row.p50Death === "number" ? row.p50Death : "n/a";
  const shapeStr = row.shape && row.shape.ok ? "ok" : "MISS";
  let line = `#${row.n} score=${scoreStr} verdict=${row.verdict} pass=${row.pass} deathP50=${deathStr} shape=${shapeStr} S1=${S(1)} S2=${S(2)} S3=${S(3)} S4=${S(4)} S6=${S(6)} S8=${S(8)} S12=${S(12)} tail S15=${S(15)} S20=${S(20)} reach20=${row.reach20.toFixed(1)} classes F/T/M p50=${classesStr} ok=${row.constraints.ok}`;
  // USER RULING 2026-09-28: an exempt class's breach is reported, not scored.
  if (row.constraints.exempt && row.constraints.exempt.length) line += ` exempt=${row.constraints.exempt.join("; ")}`;
  if (row.reason) line += ` reason=${row.reason}`;
  return line;
}
