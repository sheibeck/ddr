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
// `scoreSurvival` reads its `survival` argument's OWN `targetS`/`pL` fields
// (already computed by tools/lib/band-readout.mjs#survivalReadout against
// TARGET_SURVIVAL) for floors that WERE reached; for a floor beyond the
// run's own reach (never in `survival.floors` at all), this module carries
// its OWN small local copy of the Ruling C target S_L curve (floors 1-25,
// transcribed verbatim from 54-CONTEXT.md's `## USER RULING C` table) so a
// "never reached" floor can still be scored (S_L = 0) against its target —
// this is the ONLY reason this file holds a copy of that data rather than
// importing it from band-readout.mjs (which would pull the whole engine in
// through tools/lib/tuning-bot.mjs).
//
// TUNING FIT — not a gate; the fair bot's solo run is the objective; the
// class smoke is run by 54-04 (BEFORE) and 54-07 (AFTER) only.

/**
 * TARGET_S_1_25 — USER RULING C's per-floor cumulative survival target
 * (`S_L`, floors 1-25), transcribed verbatim from 54-CONTEXT.md. Index 0 is
 * floor 1. Only floors 1-12 ever enter `scoreSurvival`'s score/verdict;
 * floors 13-20 are the tail (dS only, informational); 21-25 are informational
 * only, never surfaced by this file's own exports (evalRow reports 1-20).
 */
const TARGET_S_1_25 = [
  98.8, 95.1, 88.6, 79.7, 69.2, 58.4, 48.0, 38.7, 30.8, 24.3, 19.1, 15.1, 11.9, 9.5, 7.6, 6.2, 5.0, 4.2, 3.5, 3.0, 2.5, 2.2, 1.9, 1.7, 1.5,
];

/** REACH20_BAND — the pass band on the % of runs reaching floor 20 (a rate, tail-only, never part of the score/verdict). */
export const REACH20_BAND = [3.0, 5.0];

function targetSFor(L) {
  return L >= 1 && L <= TARGET_S_1_25.length ? TARGET_S_1_25[L - 1] : null;
}

/**
 * scoreSurvival(survival) — the fit's objective. `survival` is
 * tools/lib/band-readout.mjs#survivalReadout's own return shape (`{
 * startDepth, runs, stuck, reach20, floors: [{ floor, pL, SL, ... }] }`).
 * Returns `{ score, terms, tail, reach20, verdict, misses }`:
 *   - `score` = Σ_{L=1..10} ((S_L - T_L)/8)^2 + Σ_{L=11..12} ((S_L - T_L)/3)^2
 *     (floors 1-12 ONLY; a floor never reached by this run counts S_L = 0)
 *   - `terms` = one row per floor 1-12: { floor, SL, target, tolerance, term }
 *   - `tail` = one row per floor 13-20 (informational, dS only, never scored)
 *   - `reach20` = the run's own reach-20 rate (informational, never scored)
 *   - `verdict` = "PASS" when every floor 1-12 is within its tolerance band,
 *     else "MISS"
 *   - `misses` = the floors (1-12) outside their tolerance band
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
    tail.push({ floor: L, SL, target, dS: Math.round((SL - target) * 10) / 10 });
  }
  return {
    score: Math.round(score * 1e6) / 1e6,
    terms,
    tail,
    reach20: survival?.reach20 ?? 0,
    verdict: misses.length === 0 ? "PASS" : "MISS",
    misses,
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
 *   1. |p50 - pooledP50| <= 1.0 floor
 *   2. |reach5 - pooledReach5| <= 12 points
 *   3. Fighter.dmgTakenPerFight >= Thief.dmgTakenPerFight
 *   4. Thief.roundsPerFight <= Fighter.roundsPerFight
 *
 * Returns `{ ok, reasons, pooledP50, pooledReach5, rows }`.
 */
export function classConstraints(classIdentity) {
  const rows = {};
  for (const row of classIdentity || []) rows[row.cls] = row;
  const reasons = [];
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
    if (pooledP50 !== null && row.p50 !== null && Math.abs(row.p50 - pooledP50) > 1.0) {
      ok = false;
      reasons.push(`${cls} p50 ${row.p50} vs pooled ${pooledP50} (|delta| > 1.0)`);
    }
    if (pooledReach5 !== null && row.reach5 !== null && Math.abs(row.reach5 - pooledReach5) > 12) {
      ok = false;
      reasons.push(`${cls} reach5 ${row.reach5} vs pooled ${pooledReach5} (|delta| > 12)`);
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

  return { ok, reasons, pooledP50, pooledReach5, rows };
}

/**
 * SEARCH_PLAN — the CORE 10 coordinates ONLY (USER CUT, 2026-09-21, plan
 * approval), in the user's own order. `applyStep` refuses any key outside
 * this list. Every `{ path, step, lo, hi }` is transcribed verbatim from
 * 54-06-PLAN.md's dial table's `Search bounds (step)` / `Search order`
 * columns.
 */
export const SEARCH_PLAN = [
  { path: ["FOE_LEVEL", "perDepth"], step: 0.03, lo: 0.12, hi: 0.3 },
  { path: ["FOE_LEVEL", "base"], step: 0.15, lo: 0.3, hi: 1.0 },
  { path: ["HERO_SP_SCALE"], step: 0.05, lo: 0.15, hi: 0.6 },
  { path: ["FOE_HIT_SCALE", "base"], step: 0.08, lo: 0.4, hi: 1.0 },
  { path: ["FOE_HIT_SCALE", "perDepth"], step: 0.01, lo: 0, hi: 0.05 },
  { path: ["FOE_HP_SCALE", "base"], step: 0.1, lo: 0.5, hi: 1.2 },
  { path: ["HERO_HP_SCALE"], step: 0.15, lo: 1.0, hi: 1.8 },
  { path: ["HERO_REGEN_PER_FLOOR"], step: 0.1, lo: 0, hi: 0.5 },
  { path: ["HAZARD_SCALE", "base"], step: 0.1, lo: 0.3, hi: 1.0 },
  { path: ["ENCOUNTER_DOTS", "base"], step: 1, lo: 5, hi: 10 },
];

/**
 * HELD_DIALS — every OTHER dial (every DIALS key not in SEARCH_PLAN), its
 * held --start value, and the release note the miss table reads (recorded,
 * never taken this plan). The maze-grid-size dial is deliberately absent —
 * cut from Phase 54 entirely (no dial, no grid change; see 54-06-PLAN.md's
 * "USER CUT" paragraph).
 */
export const HELD_DIALS = [
  { path: ["TIER_SPREAD"], start: 1, releaseIf: "available, canon" },
  { path: ["FOE_HP_SCALE", "perDepth"], start: 0.015, releaseIf: "held (available)" },
  { path: ["FOE_COUNT_SKEW"], start: 1, releaseIf: "held (available); 0..4 if released" },
  { path: ["ROUND_DAMAGE_CEILING"], start: 0.5, releaseIf: "held (available); [0.3, 1.0] if released" },
  { path: ["ABILITY_THREAT", "base"], start: 1.0, releaseIf: "held (available); base [0.6, 1.2] if released" },
  { path: ["ABILITY_THREAT", "perDepth"], start: 0, releaseIf: "held (available)" },
  { path: ["CAMP_HEAL_FRACTION"], start: 0.2, releaseIf: "held (available); [0.15, 0.5] if released" },
  { path: ["DOT_HP_FRACTION", "small"], start: 0.24, releaseIf: "held (available)" },
  { path: ["DOT_HP_FRACTION", "mid"], start: 0.36, releaseIf: "held (available)" },
  { path: ["DOT_HP_FRACTION", "large"], start: 0.6, releaseIf: "held (available)" },
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
  { path: ["CLASS_MITIGATION"], start: "identity rows", releaseIf: "manual knob only (max two notches per phase)" },
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
 * REJECTED candidate rule from this plan's own truths.
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
      dS: Math.round((SL - target) * 10) / 10,
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
 * (never any other prefix — the dry-run/search CLI's own guarantee).
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
  let line = `#${row.n} score=${scoreStr} verdict=${row.verdict} pass=${row.pass} S5=${S(5)} S8=${S(8)} S10=${S(10)} S12=${S(12)} tail S15=${S(15)} S20=${S(20)} reach20=${row.reach20.toFixed(1)} classes F/T/M p50=${classesStr} ok=${row.constraints.ok}`;
  if (row.reason) line += ` reason=${row.reason}`;
  return line;
}
