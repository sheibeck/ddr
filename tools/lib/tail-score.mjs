// tools/lib/tail-score.mjs
//
// Phase 75.3 (75.3-02-PLAN.md Task 2, RULES-17/RULES-18) — the pure, PURE
// (no engine import, no rng, no file I/O, no console output) scoring library
// tools/fit-difficulty.mjs's `--objective=tail` evaluator consumes, in the
// same spirit as tools/lib/fit-score.mjs's own PURE header — directly
// unit-testable (test/unit/tail-score.test.js) with hand-built synthetic
// summaries, no bot/worker-thread machinery involved.
//
// WHY THIS FILE EXISTS: fit-score.mjs's scoreSurvival objective is floors
// 1-12 only (Phase 54's own fitted target). RULES-17 ("balance our 12-20
// levels and dial those up") and RULES-18 (a control-rotation Sorcerer no
// longer outlasting other builds) both live PAST floor 12 — the deep floors
// that objective never scores. TAIL_TARGETS below carries the USER'S OWN
// ruled numbers verbatim (75.3-CONTEXT.md "Design rulings after planning",
// 2026-09-25 — the user's words: "Living past floor 20 should be exceedingly
// rare. 20 is the unicorn run. Player getting to depth 30 should basically
// never happen"). MUST NOT be softened or reinterpreted in code (RULES-17
// prohibition) — any later change to these numbers goes back to the user.
//
// USER RULING (2026-09-26): the bot balance runs themselves happen ONCE, at
// the milestone end (Phase 79.1) — this module and fit-difficulty.mjs's
// `--objective=tail` are the TOOLS that sweep will use; this plan proves them
// with synthetic summaries and, at most, a tiny smoke run.
//
// TAIL_SLICES pairs each control-rotation slice (rot20/rot30/rot40) with the
// fair-bot slice from the SAME start depth (deep20/deep30/deep40) — "the
// rotation never outlasts the fair bot" (75.3-CONTEXT.md) is read as the
// rotation slice's median/p90 floors-gained staying at or under its pair's.
// troll20 (a Troll Summoner) is reportOnly — informational, never scored.

/** medianOf(values) — the interpolated median (mean of the two middle values
 * on an even length), a local dependency-free copy of the SAME arithmetic
 * fit-score.mjs's own local `medianOf` uses (that module documents why it
 * never imports a shared copy — this file follows the same discipline: no
 * import from fit-score.mjs, no engine, nothing but plain arithmetic). */
function medianOf(values) {
  const sorted = values.filter((v) => v !== null && v !== undefined).sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return null;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** nearestRankP90(values) — nearest-rank p90, the same arithmetic
 * tools/lib/tuning-bot.mjs#percentile uses (`sorted[floor(0.9 * n)]`). */
function nearestRankP90(values) {
  const sorted = values.filter((v) => v !== null && v !== undefined).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const idx = Math.min(sorted.length - 1, Math.floor(0.9 * sorted.length));
  return sorted[idx];
}

/**
 * TAIL_SLICES — every slice `tools/fit-difficulty.mjs --objective=tail`
 * plays, frozen. `fresh` is the 1,000-seed floor-1 start (gated by
 * `--fresh`, see that file's header); `deep12`/`deep20`/`deep30`/`deep40` are
 * 200-seed fair-bot deep-start slices; `rot20`/`rot30`/`rot40` are 40-seed
 * control-rotation Human Sorcerer slices, each `pairedWith` the fair slice
 * from the same start depth; `troll20` is a 40-seed Troll Summoner slice,
 * `reportOnly` (never scored). Every slice's own `startDepth`/`seeds`/
 * `force`/`controlRotation` passes straight through to `playRun`'s opts,
 * exactly as `tools/tune-classes.mjs`/`tools/tune-difficulty.mjs` already do.
 */
export const TAIL_SLICES = Object.freeze([
  Object.freeze({ id: "fresh", startDepth: 1, seeds: 1000, stage: "fresh" }),
  Object.freeze({ id: "deep12", startDepth: 12, seeds: 200 }),
  Object.freeze({ id: "deep20", startDepth: 20, seeds: 200 }),
  Object.freeze({ id: "deep30", startDepth: 30, seeds: 200 }),
  Object.freeze({ id: "deep40", startDepth: 40, seeds: 200 }),
  Object.freeze({
    id: "rot20",
    startDepth: 20,
    seeds: 40,
    force: Object.freeze({ cls: "Magic User", sub: "Sorcerer", race: "Human" }),
    controlRotation: true,
    pairedWith: "deep20",
  }),
  Object.freeze({
    id: "rot30",
    startDepth: 30,
    seeds: 40,
    force: Object.freeze({ cls: "Magic User", sub: "Sorcerer", race: "Human" }),
    controlRotation: true,
    pairedWith: "deep30",
  }),
  Object.freeze({
    id: "rot40",
    startDepth: 40,
    seeds: 40,
    force: Object.freeze({ cls: "Magic User", sub: "Sorcerer", race: "Human" }),
    controlRotation: true,
    pairedWith: "deep40",
  }),
  Object.freeze({
    id: "troll20",
    startDepth: 20,
    seeds: 40,
    force: Object.freeze({ cls: "Magic User", sub: "Summoner", race: "Troll" }),
    reportOnly: true,
  }),
]);

/**
 * TAIL_TARGETS — the user's ruling of 2026-09-25, transcribed verbatim
 * (75.3-CONTEXT.md "Design rulings after planning" — "Living past floor 20
 * should be exceedingly rare. 20 is the unicorn run. Player getting to depth
 * 30 should basically never happen"). RULES-17 prohibition: MUST NOT be
 * softened or reinterpreted here — any change to these numbers is a question
 * for the user, never a code-only fix.
 */
export const TAIL_TARGETS = Object.freeze({
  fresh: Object.freeze({ reach20Max: 1.0, reach21Below: 0.5, reachCount30Max: 1 }),
  deep12: Object.freeze({ reach20Max: 5 }),
  deep20: Object.freeze({ p50GainedMax: 2, reach30Max: 1 }),
  deep30: Object.freeze({ p50GainedMax: 0, p90GainedMax: 1 }),
  rotation: Object.freeze({ p50Slack: 0, p90Slack: 0 }),
  guard: Object.freeze({ freshP50Death: Object.freeze([5, 7]) }),
});

/**
 * summarizeSlice(rows) — one TAIL_SLICE's `playRun`-shaped rows reduced to
 * `{ n, stuck, p50Gained, p90Gained, meanGained, p50Death, reach20, reach21,
 * reach30, reachCount30 }`. `p50Gained`/`p90Gained`/`meanGained` and
 * `p50Death` are computed over NON-stuck rows only (a stuck run's
 * floorsGained/deathDepth is a mid-run action-cap reading, not a real
 * result — the same discipline tools/lib/tuning-bot.mjs#reachTable uses).
 * `reach20`/`reach21`/`reach30` (one decimal, % of ALL rows) and
 * `reachCount30` (a raw count over ALL rows) are read over every row,
 * stuck included — a stuck run at floor 30 already proves the depth was
 * reached, whether or not it later dies there. Returns `null` for an empty
 * or missing `rows`.
 */
export function summarizeSlice(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const n = rows.length;
  const stuck = rows.filter((r) => r.stuck).length;
  const nonStuck = rows.filter((r) => !r.stuck);
  const gained = nonStuck.map((r) => r.floorsGained);
  const deaths = nonStuck.map((r) => r.deathDepth);
  const meanGained = gained.length ? Math.round((gained.reduce((s, v) => s + v, 0) / gained.length) * 100) / 100 : null;
  const reachPct = (floor) => Math.round((rows.filter((r) => r.deathDepth >= floor).length / n) * 1000) / 10;
  const reachCount = (floor) => rows.filter((r) => r.deathDepth >= floor).length;
  return {
    n,
    stuck,
    p50Gained: medianOf(gained),
    p90Gained: nearestRankP90(gained),
    meanGained,
    p50Death: medianOf(deaths),
    reach20: reachPct(20),
    reach21: reachPct(21),
    reach30: reachPct(30),
    reachCount30: reachCount(30),
  };
}

// A missed target's term: 1 (a guaranteed-positive base, so an exact-boundary
// "below" miss with delta 0 is still a positive term) plus the miss's own
// size (so a bigger overshoot always scores worse than a small one).
function missTerm(delta) {
  return 1 + Math.max(0, delta);
}

// Lexicographic separation: ANY slice-tier miss must outscore EVERY possible
// combination of fresh-tier terms (bounded, in practice, well under three
// digits) — see scoreTail's own header below.
const SLICE_LEX_FACTOR = 1_000_000;

/**
 * scoreTail(summaries, targets = TAIL_TARGETS) — the tail objective.
 * `summaries` is a plain object keyed by TAIL_SLICE id, each value either a
 * `summarizeSlice` result or `undefined`/`null` (unmeasured — scored as a
 * miss, never throws). Lexicographic: the SLICE targets (deep12/deep20/
 * deep30) are checked first — ANY slice miss (including an unmeasured slice)
 * outscores every candidate that meets every slice target, however bad that
 * candidate's fresh terms are (`SLICE_LEX_FACTOR`). The FRESH-start targets
 * (reach20/reach21/reachCount30) are checked only once every slice target is
 * met; a slice-clean candidate with NO fresh summary at all (`--fresh=gate`
 * not yet run) is verdict "MISS" with the single miss "fresh unmeasured" —
 * score stays low (no fresh terms to add) so a search keeps improving toward
 * it, but it is never mistaken for a proven PASS.
 *
 * The ROTATION constraint (rot20's median floors gained above deep20's, or
 * rot30's p90 above deep30's — "the rotation never outlasts the fair bot",
 * 75.3-CONTEXT.md) is computed here too and returned as its own
 * `constraints: { ok, reasons }` — mirroring fit-score.mjs#classConstraints'
 * shape — but does NOT itself force `score`/`verdict`; `tailEvalRow` (below)
 * applies the REJECTED-candidate override (`evalRow`'s own rule), exactly as
 * tools/fit-difficulty.mjs's non-tail path does with `classConstraints`.
 * rot40/troll20 are reported only (via the caller's own `summaries`) — never
 * read by this function at all (deep40 carries no TAIL_TARGETS entry).
 *
 * A fresh `p50Death` outside `targets.guard.freshP50Death` (the [5, 7]
 * average-run-ends band, reported as a guard) sets `guard` to a note string
 * — this NEVER changes `score` or `verdict`.
 *
 * Returns `{ score, verdict, misses, guard, freshMeasured, constraints }`.
 */
export function scoreTail(summaries, targets = TAIL_TARGETS) {
  const s = summaries || {};
  const misses = [];
  let sliceScore = 0;
  let freshScore = 0;

  const sliceMiss = (label, value, cmp) => {
    misses.push(`${label} ${value} ${cmp.desc}`);
    sliceScore += missTerm(cmp.delta);
  };
  const freshMiss = (label, value, cmp) => {
    misses.push(`${label} ${value} ${cmp.desc}`);
    freshScore += missTerm(cmp.delta);
  };
  // maxStyle: pass when value <= max (equality passes).
  const maxStyle = (value, max) => (value > max ? { desc: `> ${max}`, delta: value - max } : null);
  // belowStyle: pass only when value is STRICTLY under `below` (equality misses).
  const belowStyle = (value, below) => (value >= below ? { desc: `>= ${below}`, delta: value - below } : null);

  // --- slice targets (checked FIRST — see this function's own header) ------
  const deep12 = s.deep12;
  if (deep12) {
    const miss = maxStyle(deep12.reach20, targets.deep12.reach20Max);
    if (miss) sliceMiss("deep12.reach20", deep12.reach20, miss);
  } else {
    misses.push("deep12 unmeasured");
    sliceScore += missTerm(0);
  }

  const deep20 = s.deep20;
  if (deep20) {
    const p50miss = maxStyle(deep20.p50Gained, targets.deep20.p50GainedMax);
    if (p50miss) sliceMiss("deep20.p50Gained", deep20.p50Gained, p50miss);
    const reachMiss = maxStyle(deep20.reach30, targets.deep20.reach30Max);
    if (reachMiss) sliceMiss("deep20.reach30", deep20.reach30, reachMiss);
  } else {
    misses.push("deep20 unmeasured");
    sliceScore += missTerm(0);
  }

  const deep30 = s.deep30;
  if (deep30) {
    const p50miss = maxStyle(deep30.p50Gained, targets.deep30.p50GainedMax);
    if (p50miss) sliceMiss("deep30.p50Gained", deep30.p50Gained, p50miss);
    const p90miss = maxStyle(deep30.p90Gained, targets.deep30.p90GainedMax);
    if (p90miss) sliceMiss("deep30.p90Gained", deep30.p90Gained, p90miss);
  } else {
    misses.push("deep30 unmeasured");
    sliceScore += missTerm(0);
  }

  // --- the rotation constraint (own object, never folds into score/verdict here) ---
  const constraintReasons = [];
  const rot20 = s.rot20;
  if (rot20 && deep20 && rot20.p50Gained > deep20.p50Gained) {
    constraintReasons.push(`rot20 p50Gained ${rot20.p50Gained} above deep20's ${deep20.p50Gained}`);
  }
  const rot30 = s.rot30;
  if (rot30 && deep30 && rot30.p90Gained > deep30.p90Gained) {
    constraintReasons.push(`rot30 p90Gained ${rot30.p90Gained} above deep30's ${deep30.p90Gained}`);
  }
  const constraints = { ok: constraintReasons.length === 0, reasons: constraintReasons };

  // --- fresh-start targets (checked only after the slice tier above) -------
  const fresh = s.fresh;
  const freshMeasured = !!fresh;
  let guard = null;
  if (fresh) {
    const reach20miss = maxStyle(fresh.reach20, targets.fresh.reach20Max);
    if (reach20miss) freshMiss("fresh.reach20", fresh.reach20, reach20miss);
    const reach21miss = belowStyle(fresh.reach21, targets.fresh.reach21Below);
    if (reach21miss) freshMiss("fresh.reach21", fresh.reach21, reach21miss);
    const countMiss = maxStyle(fresh.reachCount30, targets.fresh.reachCount30Max);
    if (countMiss) freshMiss("fresh.reachCount30", fresh.reachCount30, countMiss);
    const [lo, hi] = targets.guard.freshP50Death;
    if (typeof fresh.p50Death === "number" && (fresh.p50Death < lo || fresh.p50Death > hi)) {
      guard = `fresh p50Death ${fresh.p50Death} outside [${lo}, ${hi}]`;
    }
  } else {
    misses.push("fresh unmeasured");
  }

  const score = Math.round((sliceScore * SLICE_LEX_FACTOR + freshScore) * 1e4) / 1e4;
  const verdict = sliceScore === 0 && freshMeasured && freshScore === 0 ? "PASS" : "MISS";

  return { score, verdict, misses, guard, freshMeasured, constraints };
}

/**
 * TAIL_SEARCH_PLAN — exactly four coordinates, in this order (this plan's
 * own truths — "a fourth search coordinate" past fit-score.mjs's core 10;
 * see 75.3-CONTEXT.md "Why a fourth search coordinate"). These paths do NOT
 * exist in engine/difficulty.js's DIALS until Phase 75.3-03/75.3-04 lands —
 * nothing in this module ever resolves them against DIALS (that check is
 * 75.3-06's own, once the dials are real).
 */
export const TAIL_SEARCH_PLAN = [
  { path: ["FOE_HP_SCALE", "perDepthAfter"], step: 0.015, lo: 0.015, hi: 0.15 },
  { path: ["FOE_HIT_SCALE", "perDepthAfter"], step: 0.01, lo: 0.01, hi: 0.08 },
  { path: ["FOE_ELITE", "hpPerRank"], step: 0.05, lo: 0.05, hi: 0.4 },
  { path: ["CONTROL_AT_DEPTH", "resistPerDepth"], step: 0.25, lo: 0.5, hi: 2 },
];

/**
 * tailEvalRow(n, dials, result) — the JSONL record for one tail evaluation.
 * `result` bundles `{ summaries, elapsedMs, walkPass }` (`walkPass` defaults
 * to 1, mirroring fit-score.mjs#evalRow). Applies the SAME REJECTED-candidate
 * rule `evalRow` uses: `constraints.ok === false` forces `score: Infinity`,
 * `verdict: "MISS"`, and a `reason` joining `constraints.reasons`.
 */
export function tailEvalRow(n, dials, result) {
  const { summaries, elapsedMs, walkPass = 1 } = result;
  const scored = scoreTail(summaries);
  const rejected = !scored.constraints.ok;
  const score = rejected ? Infinity : scored.score;
  const verdict = rejected ? "MISS" : scored.verdict;
  return {
    n,
    pass: walkPass,
    dials,
    score,
    verdict,
    misses: scored.misses,
    summaries,
    freshMeasured: scored.freshMeasured,
    guard: scored.guard,
    constraints: scored.constraints,
    elapsedMs,
    ...(rejected ? { reason: scored.constraints.reasons.join("; ") } : {}),
  };
}

/**
 * formatTailEvalLine(row) — one STDOUT line per tail evaluation. Begins
 * `#<n> score=` (never any other prefix — the fit CLI's own guarantee, same
 * as fit-score.mjs#formatEvalLine).
 */
export function formatTailEvalLine(row) {
  const scoreStr = row.score === Infinity ? "+Infinity" : row.score.toFixed(4);
  const fresh = row.summaries?.fresh;
  const freshStr = fresh ? `reach20=${fresh.reach20} reach21=${fresh.reach21} reachCount30=${fresh.reachCount30}` : "unmeasured";
  const d12 = row.summaries?.deep12;
  const d20 = row.summaries?.deep20;
  const d30 = row.summaries?.deep30;
  const rot20 = row.summaries?.rot20;
  const rot30 = row.summaries?.rot30;
  const rot40 = row.summaries?.rot40;
  const na = (v) => (v === undefined || v === null ? "n/a" : v);
  let line = `#${row.n} score=${scoreStr} verdict=${row.verdict}`;
  line += ` fresh[${freshStr}]`;
  line += ` deep12.reach20=${na(d12 && d12.reach20)}`;
  line += ` deep20[p50=${na(d20 && d20.p50Gained)} reach30=${na(d20 && d20.reach30)}]`;
  line += ` deep30[p50=${na(d30 && d30.p50Gained)} p90=${na(d30 && d30.p90Gained)}]`;
  line += ` rot.p50[20/30/40]=${na(rot20 && rot20.p50Gained)}/${na(rot30 && rot30.p50Gained)}/${na(rot40 && rot40.p50Gained)}`;
  line += ` guard=${row.guard || "none"} ok=${row.constraints.ok}`;
  if (row.reason) line += ` reason=${row.reason}`;
  return line;
}
