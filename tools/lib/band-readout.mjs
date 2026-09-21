// tools/lib/band-readout.mjs
//
// BAND-01 readout — the four user bands (Filter 1-4 / Wall 5-8 / Breakaway
// 9-15 / Endgame 16-20). Pure over an array of playRun-shaped results;
// TUNING PROXY ONLY (see tools/lib/tuning-bot.mjs's own header — this module
// inherits the same caveat: not a pass/fail gate, not a substitute for human
// playtest). Imports `percentile` from ./tuning-bot.mjs and changes NOTHING
// about how a run is played — this is a report addition only, added in
// Phase 54 (BAND-01) so reach >=16 and per-band death causes are measurable
// without touching the frozen tools/lib/tuning-bot.mjs bot policy.

import { percentile } from "./tuning-bot.mjs";

/** FOUR_BANDS — the user's four recorded bands (2026-09-20 todo), inclusive depth ranges. */
export const FOUR_BANDS = [
  { name: "Filter", min: 1, max: 4 },
  { name: "Wall", min: 5, max: 8 },
  { name: "Breakaway", min: 9, max: 15 },
  { name: "Endgame", min: 16, max: 20 },
];

/** BAND_REACH_FLOORS — the reach-table floor thresholds this readout adds (BAND-01's reach >=16 lever plus the band boundaries). */
export const BAND_REACH_FLOORS = [5, 8, 9, 10, 13, 16, 20];

function bandForDepth(depth) {
  for (const b of FOUR_BANDS) {
    if (depth >= b.min && depth <= b.max) return b.name;
  }
  return null; // beyond Endgame (depth > 20) or below Filter (never happens; depth >= 1)
}

/**
 * bandReadout(results, opts) — pure over the COMPLETED runs only
 * (results.filter(r => !r.stuck), same rule as tuning-bot.mjs's own
 * reachTable). Never returns NaN — an empty/all-stuck set yields zeros and
 * empty lists.
 */
export function bandReadout(results, _opts) {
  const completed = results.filter((r) => !r.stuck);
  const n = completed.length;

  // histogram: ascending depth keys, only depths with >= 1 death
  const counts = new Map();
  for (const r of completed) {
    counts.set(r.deathDepth, (counts.get(r.deathDepth) || 0) + 1);
  }
  const histogram = {};
  for (const depth of [...counts.keys()].sort((a, b) => a - b)) {
    histogram[String(depth)] = counts.get(depth);
  }

  const meanDeathDepth = n ? Math.round((completed.reduce((s, r) => s + r.deathDepth, 0) / n) * 100) / 100 : 0;

  const floorsGainedSorted = completed.map((r) => r.floorsGained).sort((a, b) => a - b);
  const floorsGained = {
    p50: n ? percentile(floorsGainedSorted, 0.5) : 0,
    mean: n ? Math.round((floorsGainedSorted.reduce((s, v) => s + v, 0) / n) * 100) / 100 : 0,
  };

  const encountersSurvivedMean = n
    ? Math.round((completed.reduce((s, r) => s + (r.encountersSurvived || 0), 0) / n) * 100) / 100
    : 0;

  const reach = {};
  for (const floor of BAND_REACH_FLOORS) {
    const count = completed.filter((r) => r.deathDepth >= floor).length;
    reach[String(floor)] = n ? Math.round((count / n) * 1000) / 10 : 0;
  }

  const bandShareCounts = { Filter: 0, Wall: 0, Breakaway: 0, Endgame: 0, beyond: 0 };
  const causesByBand = { Filter: new Map(), Wall: new Map(), Breakaway: new Map(), Endgame: new Map() };
  for (const r of completed) {
    const band = bandForDepth(r.deathDepth);
    if (band) {
      bandShareCounts[band] += 1;
      const m = causesByBand[band];
      const cause = String(r.cause);
      m.set(cause, (m.get(cause) || 0) + 1);
    } else if (r.deathDepth > 20) {
      bandShareCounts.beyond += 1;
    }
  }
  const bandShare = {};
  for (const key of Object.keys(bandShareCounts)) {
    bandShare[key] = n ? Math.round((bandShareCounts[key] / n) * 1000) / 10 : 0;
  }

  const topCausesByBand = {};
  for (const bandName of Object.keys(causesByBand)) {
    const entries = [...causesByBand[bandName].entries()].map(([cause, count]) => ({ cause, count }));
    entries.sort((a, b) => (b.count - a.count) || (a.cause < b.cause ? -1 : a.cause > b.cause ? 1 : 0));
    topCausesByBand[bandName] = entries.slice(0, 5);
  }

  return {
    completed: n,
    histogram,
    meanDeathDepth,
    floorsGained,
    encountersSurvivedMean,
    reach,
    bandShare,
    topCausesByBand,
  };
}

/**
 * formatBandReadout(r) — the text block tools/tune-difficulty.mjs prints
 * after printSharedReadout and before the final "Outcome:" line. Wording is
 * kept STABLE (the ledger transcribes this verbatim, same discipline as
 * tuning-bot.mjs's printSharedReadout).
 */
export function formatBandReadout(r) {
  const lines = [];
  lines.push(
    "Four-band readout (BAND-01 — Filter 1-4 / Wall 5-8 / Breakaway 9-15 / Endgame 16-20; completed runs only):",
  );

  const histEntries = Object.entries(r.histogram);
  const histStr = histEntries.length ? histEntries.map(([d, c]) => `${d}:${c}`).join("  ") : "(none)";
  lines.push(`  death-depth histogram: ${histStr}`);

  lines.push(
    `  mean death depth=${r.meanDeathDepth.toFixed(2)}  floors gained p50=${r.floorsGained.p50} mean=${r.floorsGained.mean.toFixed(2)}  encounters survived mean=${r.encountersSurvivedMean.toFixed(2)}`,
  );

  const reachStr = BAND_REACH_FLOORS.map((f) => `>=${f} ${r.reach[String(f)].toFixed(1)}%`).join("  ");
  lines.push(`  reach: ${reachStr}`);

  lines.push(
    `  band share of deaths: Filter 1-4 ${r.bandShare.Filter.toFixed(1)}% | Wall 5-8 ${r.bandShare.Wall.toFixed(1)}% | Breakaway 9-15 ${r.bandShare.Breakaway.toFixed(1)}% | Endgame 16-20 ${r.bandShare.Endgame.toFixed(1)}% | beyond 20 ${r.bandShare.beyond.toFixed(1)}%`,
  );

  for (const bandName of ["Filter", "Wall", "Breakaway", "Endgame"]) {
    const entries = r.topCausesByBand[bandName];
    const causeStr = entries.length ? entries.map(({ cause, count }) => `${cause} ${count}`).join(", ") : "(none)";
    lines.push(`  top causes — ${bandName}: ${causeStr}`);
  }

  return lines;
}

// Phase 54 (USER RULING C): the per-floor survival block — the tuning target
// is the 25-row p_L / S_L curve in TARGET_SURVIVAL below; report-only, bot
// policy (tools/lib/tuning-bot.mjs) untouched.

/**
 * TARGET_SURVIVAL — the user's per-floor survival curve (2026-09-21,
 * verbatim from 54-CONTEXT.md's `## USER RULING C`). `pL` = individual
 * floor survival chance given the floor was reached; `SL` = cumulative
 * chance a run reaches the END of that floor, from floor 1. Floor 20 carries
 * `reach20Band` — the pass band on the % of runs REACHING floor 20 (not a
 * tolerance on SL itself, since that number is a rate, not a delta target).
 */
export const TARGET_SURVIVAL = [
  { floor: 1, pL: 98.8, SL: 98.8, note: "High early survival" },
  { floor: 2, pL: 96.3, SL: 95.1, note: "" },
  { floor: 3, pL: 93.1, SL: 88.6, note: "Degradation accelerates" },
  { floor: 4, pL: 89.9, SL: 79.7, note: "" },
  { floor: 5, pL: 86.9, SL: 69.2, note: "" },
  { floor: 6, pL: 84.3, SL: 58.4, note: "The 50/50 flip occurs here" },
  { floor: 7, pL: 82.2, SL: 48.0, note: "" },
  { floor: 8, pL: 80.6, SL: 38.7, note: "Maximum bottleneck pressure" },
  { floor: 9, pL: 79.5, SL: 30.8, note: "Lowest individual survival" },
  { floor: 10, pL: 78.9, SL: 24.3, note: "Less than 1 in 4 remain" },
  { floor: 11, pL: 78.7, SL: 19.1, note: "Curve stabilizes" },
  { floor: 12, pL: 78.8, SL: 15.1, note: "" },
  { floor: 13, pL: 79.1, SL: 11.9, note: "" },
  { floor: 14, pL: 79.6, SL: 9.5, note: "Single-digit survival begins" },
  { floor: 15, pL: 80.2, SL: 7.6, note: "" },
  { floor: 16, pL: 81.0, SL: 6.2, note: "" },
  { floor: 17, pL: 81.8, SL: 5.0, note: "" },
  { floor: 18, pL: 82.7, SL: 4.2, note: "" },
  { floor: 19, pL: 83.6, SL: 3.5, note: "" },
  { floor: 20, pL: 84.5, SL: 3.0, note: "🦄 The Unicorn Milestone", reach20Band: [3.0, 5.0] },
  { floor: 21, pL: 85.4, SL: 2.5, note: "The infinite crawl begins" },
  { floor: 22, pL: 86.4, SL: 2.2, note: "" },
  { floor: 23, pL: 87.2, SL: 1.9, note: "Less than 2% survival" },
  { floor: 24, pL: 88.1, SL: 1.7, note: "" },
  { floor: 25, pL: 88.9, SL: 1.5, note: "" },
];

/**
 * DOT_CAUSES — USER RULING D (54-CONTEXT.md, 2026-09-21): death-cause
 * strings classified as a -HP DOT the dungeon itself inflicts — traps,
 * falls, leaps, AND the maze's own table-four -HP dot cause (below; NOT
 * starvation — starvation is the `starve` cause alone, see
 * STARVATION_CAUSES below).
 */
export const DOT_CAUSES = ["undone by a trap", "fell off a wall", "came up short on a leap", "spent by the dungeon itself"];

/** STARVATION_CAUSES — USER RULING D: the `starve` cause ALONE ("starved in the dark"). */
export const STARVATION_CAUSES = ["starved in the dark"];

/** COMBAT_CAUSE_PREFIX — every combat death's cause string starts with this (content/epitaphs.js's CAUSE_TEXT.combat, `{foe}` filled). */
export const COMBAT_CAUSE_PREFIX = "cut down by a";

/**
 * SURVIVAL_PASS — USER RULING D's plan-approval cut #3 (54-CONTEXT.md,
 * 2026-09-21): the fit objective and pass/fail cover floors 1-12 only
 * (shallow |dS| <= 8 on 1-10, deep |dS| <= 3 on 11-12); floors 13-20 are the
 * measured TAIL (`tailFloors`, dS only — never PASS/MISS, never in the
 * verdict); reach-20 is reported against the same [3.0, 5.0]% band but is
 * ALSO tail (never part of the verdict this plan computes); floors 21+ stay
 * informational.
 */
export const SURVIVAL_PASS = { shallowFloors: [1, 10], shallowTolerance: 8, deepFloors: [11, 12], deepTolerance: 3, tailFloors: [13, 20], reach20Band: [3.0, 5.0] };

function round1(x) {
  return Math.round(x * 10) / 10;
}

function targetFor(floor) {
  return TARGET_SURVIVAL.find((t) => t.floor === floor) || null;
}

/**
 * survivalReadout(results, opts) — over ALL results (stuck runs count as
 * reached at every floor <= their current depth, never as deaths). Returns
 * `{ startDepth, runs, stuck, reach20, floors: [...] }`. Internally chains
 * S_L from UNROUNDED p_L fractions (only the returned/printed values are
 * rounded to 1 decimal) so the cumulative product does not compound
 * rounding error across floors.
 */
export function survivalReadout(results, opts = {}) {
  const start = opts.startDepth ?? 1;
  const runs = results.length;
  const stuck = results.filter((r) => !!r.stuck).length;
  const maxFloor = runs ? results.reduce((m, r) => Math.max(m, r.deathDepth), -Infinity) : start - 1;
  const reach20Count = results.filter((r) => r.deathDepth >= 20).length;
  const reach20 = runs ? round1((100 * reach20Count) / runs) : 0;

  const floors = [];
  let chain = 1; // running unrounded fraction (1.0 = 100%)
  let chainBroken = false;

  for (let L = start; L <= maxFloor; L++) {
    const reached = results.filter((r) => r.deathDepth >= L).length;
    const deathsArr = results.filter((r) => r.dead && !r.stuck && r.deathDepth === L);
    const deaths = deathsArr.length;

    // USER RULING D: the three-class death split (combat / dot / starvation)
    // plus `other` (every cause matching none of the three — teleport,
    // backfire, summon, quake, potion, insanity, poison, entombed — printed
    // but never chased).
    let combat = 0;
    let dot = 0;
    let starvation = 0;
    let other = 0;
    for (const r of deathsArr) {
      const cause = String(r.cause);
      if (DOT_CAUSES.includes(cause)) dot++;
      else if (STARVATION_CAUSES.includes(cause)) starvation++;
      else if (cause.startsWith(COMBAT_CAUSE_PREFIX)) combat++;
      else other++;
    }

    const pLraw = reached ? 100 * (1 - deaths / reached) : null;
    if (pLraw === null) chainBroken = true;
    let SLraw = null;
    if (!chainBroken) {
      chain = chain * (pLraw / 100);
      SLraw = chain * 100;
    }

    const target = targetFor(L);
    const targetP = target ? target.pL : null;
    const targetS = target ? target.SL : null;
    const deltaSraw = SLraw !== null && targetS !== null ? SLraw - targetS : null;

    // USER RULING D (plan-approval cut #3): the verdict covers floors 1-12
    // only — floors 13-20 (SURVIVAL_PASS.tailFloors) and 21+ are NEVER
    // PASS/MISS, only `tail`/`info` with dS reported.
    let pass;
    if (L >= SURVIVAL_PASS.tailFloors[0]) {
      pass = null; // tail (13-20) or beyond (21+) — dS reported, never a verdict
    } else if (deltaSraw === null) {
      pass = null;
    } else if (L >= SURVIVAL_PASS.shallowFloors[0] && L <= SURVIVAL_PASS.shallowFloors[1]) {
      pass = Math.abs(deltaSraw) <= SURVIVAL_PASS.shallowTolerance;
    } else if (L >= SURVIVAL_PASS.deepFloors[0] && L <= SURVIVAL_PASS.deepFloors[1]) {
      pass = Math.abs(deltaSraw) <= SURVIVAL_PASS.deepTolerance;
    } else {
      pass = null;
    }
    const tail = L >= SURVIVAL_PASS.tailFloors[0] && L <= SURVIVAL_PASS.tailFloors[1];

    floors.push({
      floor: L,
      reached,
      deaths,
      combat,
      dot,
      starvation,
      other,
      pL: pLraw === null ? null : round1(pLraw),
      SL: SLraw === null ? null : round1(SLraw),
      targetP,
      targetS,
      deltaS: deltaSraw === null ? null : round1(deltaSraw),
      pass,
      tail,
    });
  }

  return { startDepth: start, runs, stuck, reach20, floors };
}

/**
 * survivalFromHistogram(histogram, runs, startDepth) — rebuilds a synthetic
 * 0-stuck results array from a `{ depth: count }` death-depth histogram
 * (cause "unknown" — the split-by-cause fields are unavailable from a
 * histogram alone) and returns survivalReadout over it. Used to retrofit a
 * per-floor table from an already-committed transcript's histogram line
 * (e.g. rung 2's). `runs` is accepted for API symmetry/record-keeping; the
 * synthetic set's own length (the histogram's count sum) is what actually
 * drives the readout — when the histogram excludes stuck runs (e.g. a
 * `--party` transcript), the result is correctly labelled "approximate"
 * by the caller, not silently corrected here.
 */
export function survivalFromHistogram(histogram, runs, startDepth = 1) {
  void runs;
  const results = [];
  for (const depthStr of Object.keys(histogram)) {
    const depth = Number(depthStr);
    const count = histogram[depthStr];
    for (let i = 0; i < count; i++) {
      results.push({ deathDepth: depth, dead: true, stuck: false, cause: "unknown" });
    }
  }
  return survivalReadout(results, { startDepth });
}

/**
 * survivalVerdict(r) — USER RULING D (plan-approval cut #3, 54-CONTEXT.md,
 * 2026-09-21): `{ missing: [{ floor, deltaS }] }`. `missing` covers ONLY
 * floors 1-12 whose `pass === false` (shallow 1-10 ±8, deep 11-12 ±3) —
 * floors 13-20 are the measured TAIL (dS reported, never PASS/MISS, never in
 * this verdict) and reach-20 is ALSO tail-only, reported separately by
 * formatSurvivalReadout's own reach-20 line, never folded into this verdict.
 */
export function survivalVerdict(r) {
  const missing = [];
  for (const f of r.floors) {
    if (f.floor >= 1 && f.floor <= SURVIVAL_PASS.deepFloors[1] && f.pass === false) {
      missing.push({ floor: f.floor, deltaS: f.deltaS });
    }
  }
  return { missing };
}

function fmtPct(x) {
  return x === null || x === undefined ? "n/a" : `${x.toFixed(1)}%`;
}

function fmtSigned(x) {
  if (x === null || x === undefined) return "n/a";
  const s = x.toFixed(1);
  return x >= 0 ? `+${s}` : s;
}

function fmtVerdictLabel(pass) {
  return pass === true ? "PASS" : pass === false ? "MISS" : "info";
}

/**
 * formatSurvivalReadout(r) — the text block printed after formatBandReadout
 * and before "Outcome:" in tune-difficulty.mjs's printReport. Wording is
 * kept STABLE (the ledger transcribes this verbatim).
 */
export function formatSurvivalReadout(r) {
  const lines = [];
  lines.push(
    "Per-floor survival (USER RULING C target — p_L = 1 - deaths_L / reached_L; S_L = product of p_k from the start depth; stuck runs count as reached, never as deaths; deaths split combat/dot/starvation-exhaustion/other):",
  );
  for (const f of r.floors) {
    const label = f.tail ? "tail" : fmtVerdictLabel(f.pass);
    lines.push(
      `  L=${f.floor}  reached=${f.reached}  deaths=${f.deaths} (combat ${f.combat} / dot ${f.dot} / starvation-exhaustion ${f.starvation} / other ${f.other})  p_L=${fmtPct(f.pL)}  S_L=${fmtPct(f.SL)}  target p_L=${fmtPct(f.targetP)}  target S_L=${fmtPct(f.targetS)}  dS=${fmtSigned(f.deltaS)}  ${label}`,
    );
  }
  // USER RULING D (plan-approval cut #3): reach-20 is reported but NEVER
  // part of the verdict — floors 13-20 are the tail.
  lines.push(`  reach-20: ${r.reach20.toFixed(1)}% (band 3.0-5.0%, reported — tail)`);
  const verdict = survivalVerdict(r);
  let verdictMsg;
  if (verdict.missing.length === 0) {
    verdictMsg = `all floors 1-${SURVIVAL_PASS.deepFloors[1]} inside the pass band`;
  } else {
    verdictMsg = `floors outside the pass band: ${verdict.missing.map((m) => `${m.floor} (dS ${fmtSigned(m.deltaS)})`).join(", ")}`;
  }
  lines.push(`  verdict: ${verdictMsg}`);
  return lines;
}

// --- Pace + Class identity (USER RULING D, 54-CONTEXT.md, 2026-09-21) -----

/**
 * interpolatedMedian(values) — a sorted numeric array's median: the middle
 * value on an odd length, the MEAN of the two middle values on an even
 * length (never a simple "pick the lower of the two middle" percentile
 * read). `null` on an empty array. `values` is NOT re-sorted here — callers
 * pass an already-sorted array (matches every other percentile helper in
 * this codebase, e.g. tuning-bot.mjs#percentile).
 */
export function interpolatedMedian(values) {
  const n = values.length;
  if (n === 0) return null;
  const mid = Math.floor(n / 2);
  if (n % 2 === 1) return values[mid];
  return (values[mid - 1] + values[mid]) / 2;
}

/**
 * paceReadout(results) — USER RULING D: `{ floors: [{ floor, n, meanLevel,
 * meanGold, meanAr, meanWeaponCost, meanMaxWP, meanPotions, afraidTriggers,
 * diedAfraid }] }`, aggregated from every result's own `floorSnapshots`
 * (tools/lib/tuning-bot.mjs#playRun) — one row per floor with n >= 1. Every
 * mean is rounded to 2dp; `afraidTriggers`/`diedAfraid` are plain summed
 * counts (not means). STUCK runs are INCLUDED — a stuck run still reached
 * every floor its own floorSnapshots row records.
 */
export function paceReadout(results) {
  const byFloor = new Map();
  for (const r of results) {
    const snaps = Array.isArray(r.floorSnapshots) ? r.floorSnapshots : [];
    for (const snap of snaps) {
      let agg = byFloor.get(snap.depth);
      if (!agg) {
        agg = {
          floor: snap.depth,
          n: 0,
          sumLevel: 0,
          sumGold: 0,
          sumAr: 0,
          sumWeaponCost: 0,
          sumMaxWP: 0,
          sumPotions: 0,
          afraidTriggers: 0,
          diedAfraid: 0,
        };
        byFloor.set(snap.depth, agg);
      }
      agg.n++;
      agg.sumLevel += snap.level || 0;
      agg.sumGold += snap.gold || 0;
      agg.sumAr += snap.ar || 0;
      agg.sumWeaponCost += snap.weaponCost || 0;
      agg.sumMaxWP += snap.maxWP || 0;
      agg.sumPotions += snap.potions || 0;
      agg.afraidTriggers += snap.afraidTriggers || 0;
      if (snap.diedAfraid) agg.diedAfraid++;
    }
  }
  const round2 = (sum, n) => Math.round((sum / n) * 100) / 100;
  const floors = [...byFloor.keys()]
    .sort((a, b) => a - b)
    .map((depth) => {
      const agg = byFloor.get(depth);
      return {
        floor: depth,
        n: agg.n,
        meanLevel: round2(agg.sumLevel, agg.n),
        meanGold: round2(agg.sumGold, agg.n),
        meanAr: round2(agg.sumAr, agg.n),
        meanWeaponCost: round2(agg.sumWeaponCost, agg.n),
        meanMaxWP: round2(agg.sumMaxWP, agg.n),
        meanPotions: round2(agg.sumPotions, agg.n),
        afraidTriggers: agg.afraidTriggers,
        diedAfraid: agg.diedAfraid,
      };
    });
  return { floors };
}

/**
 * formatPaceReadout(r) — the text block tune-difficulty.mjs prints after the
 * per-floor survival block and before the Class identity block.
 */
export function formatPaceReadout(r) {
  const lines = [];
  lines.push(
    "Pace (per floor reached — mean hero level / gold / AR / weapon cost / maxWP / potions; afraid triggers, died afraid):",
  );
  for (const f of r.floors) {
    lines.push(
      `  L=${f.floor}  n=${f.n}  level=${f.meanLevel.toFixed(2)}  gold=${f.meanGold.toFixed(2)}  ar=${f.meanAr.toFixed(2)}  weapon=${f.meanWeaponCost.toFixed(2)}  maxWP=${f.meanMaxWP.toFixed(2)}  potions=${f.meanPotions.toFixed(2)}  afraid=${f.afraidTriggers}  diedAfraid=${f.diedAfraid}`,
    );
  }
  return lines;
}

/** CLASS_POOLS — the three class-identity readout rows, in this exact order. */
export const CLASS_POOLS = ["Fighter", "Thief", "Magic User"];

/**
 * classIdentityReadout(results) — USER RULING D: one row per CLASS POOL
 * (Fighter/Thief/Magic User, `CLASS_POOLS` order — pooled over EVERY race
 * and sub-class; race/sub cells are never this readout's own rows, only a
 * recorded spread elsewhere, see tools/lib/class-matrix.mjs#classSpread).
 * `{ cls, n, p50, reach5, reach10, reach20, dmgTakenPerFight, roundsPerFight,
 * foeMissRate, castsDefensive, castsOffensive, potionsPerRun, backstabsPerRun,
 * fleesPerRun }`. `n` is every run of that class pool (stuck included);
 * `p50`/`reach*` are computed over COMPLETED (non-stuck) runs only, the same
 * discipline reachTable/summarizeRows use elsewhere. A result with no `cls`
 * field (an older synthetic row) is simply excluded from every pool.
 */
export function classIdentityReadout(results) {
  return CLASS_POOLS.map((cls) => {
    const clsResults = results.filter((r) => r.cls === cls);
    const n = clsResults.length;
    const completed = clsResults.filter((r) => !r.stuck);
    const deathDepths = completed.map((r) => r.deathDepth).sort((a, b) => a - b);
    const p50 = interpolatedMedian(deathDepths);
    const reachPct = (floor) =>
      completed.length ? Math.round((completed.filter((r) => r.deathDepth >= floor).length / completed.length) * 1000) / 10 : 0;

    let fights = 0;
    let rounds = 0;
    let dmgTaken = 0;
    let foeSwings = 0;
    let foeMisses = 0;
    let castsDefensive = 0;
    let castsOffensive = 0;
    let potionsUsed = 0;
    let backstabs = 0;
    let flees = 0;
    for (const r of clsResults) {
      const id = r.identity || {};
      fights += id.fights || 0;
      rounds += id.rounds || 0;
      dmgTaken += id.dmgTaken || 0;
      foeSwings += id.foeSwings || 0;
      foeMisses += id.foeMisses || 0;
      castsDefensive += id.castsDefensive || 0;
      castsOffensive += id.castsOffensive || 0;
      potionsUsed += id.potionsUsed || 0;
      backstabs += id.backstabs || 0;
      flees += id.flees || 0;
    }
    const round2 = (x) => Math.round(x * 100) / 100;

    return {
      cls,
      n,
      p50,
      reach5: reachPct(5),
      reach10: reachPct(10),
      reach20: reachPct(20),
      dmgTakenPerFight: fights ? round2(dmgTaken / fights) : null,
      roundsPerFight: fights ? round2(rounds / fights) : null,
      foeMissRate: foeSwings ? round2((foeMisses / foeSwings) * 100) : null,
      castsDefensive,
      castsOffensive,
      potionsPerRun: n ? round2(potionsUsed / n) : 0,
      backstabsPerRun: n ? round2(backstabs / n) : 0,
      fleesPerRun: n ? round2(flees / n) : 0,
    };
  });
}

/**
 * formatClassIdentityReadout(r) — the text block tune-difficulty.mjs prints
 * after the Pace block and before "Outcome:". `r` is `classIdentityReadout`'s
 * own array. Header names the class-pool-only discipline explicitly — the
 * SAME line every acceptance grep for "class pools only" targets.
 */
export function formatClassIdentityReadout(r) {
  const lines = [];
  lines.push(
    "Class identity (class pools only — Fighter = ABSORB, Thief = AVOID, Magic User = CHOOSE; race/sub cells are not targets):",
  );
  for (const row of r) {
    lines.push(
      `  ${row.cls}  n=${row.n}  p50=${row.p50 === null ? "n/a" : row.p50}  reach5=${row.reach5.toFixed(1)}%  reach10=${row.reach10.toFixed(1)}%  reach20=${row.reach20.toFixed(1)}%  dmgTaken/fight=${row.dmgTakenPerFight === null ? "n/a" : row.dmgTakenPerFight.toFixed(2)}  rounds/fight=${row.roundsPerFight === null ? "n/a" : row.roundsPerFight.toFixed(2)}  foeMiss=${row.foeMissRate === null ? "n/a" : row.foeMissRate.toFixed(1) + "%"}  casts(def/off)=${row.castsDefensive}/${row.castsOffensive}  potions/run=${row.potionsPerRun.toFixed(2)}  backstabs/run=${row.backstabsPerRun.toFixed(2)}  flees/run=${row.fleesPerRun.toFixed(2)}`,
    );
  }
  return lines;
}

/**
 * classSpreadReadout(smokeCells) — USER RULING D: per class pool, the min/
 * max `p50Depth` cell (named "sub/race") and the `reach5` range, over an
 * array of tools/lib/class-matrix.mjs cell objects (`{ cls, sub, race,
 * p50Depth, reach5, ... }`, e.g. a tune-classes `report.cells` array) — a
 * RECORDED spread, never a target (mirrors class-matrix.mjs#classSpread,
 * which computes the identical shape straight from cellRows; this variant
 * is for a caller that only has the already-summarized `cells` array, e.g.
 * a loaded class-pass JSON file).
 */
export function classSpreadReadout(smokeCells) {
  return CLASS_POOLS.map((cls) => {
    let p50Min = null;
    let p50Max = null;
    let reach5Min = null;
    let reach5Max = null;
    for (const cell of smokeCells) {
      if (cell.cls !== cls) continue;
      const label = `${cell.sub}/${cell.race}`;
      if (cell.p50Depth !== null && cell.p50Depth !== undefined) {
        if (p50Min === null || cell.p50Depth < p50Min.value) p50Min = { value: cell.p50Depth, cell: label };
        if (p50Max === null || cell.p50Depth > p50Max.value) p50Max = { value: cell.p50Depth, cell: label };
      }
      if (cell.reach5 !== null && cell.reach5 !== undefined) {
        if (reach5Min === null || cell.reach5 < reach5Min.value) reach5Min = { value: cell.reach5, cell: label };
        if (reach5Max === null || cell.reach5 > reach5Max.value) reach5Max = { value: cell.reach5, cell: label };
      }
    }
    return { cls, p50Min, p50Max, reach5Min, reach5Max };
  });
}
