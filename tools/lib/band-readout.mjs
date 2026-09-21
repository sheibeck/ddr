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

/** HAZARD_CAUSES — death-cause strings classified as hazard (falls/traps/leaps). */
export const HAZARD_CAUSES = ["fell off a wall", "undone by a trap", "came up short on a leap"];

/** STARVATION_CAUSES — death-cause strings classified as starvation/exhaustion (never chased with a difficulty.js dial). */
export const STARVATION_CAUSES = ["starved in the dark", "spent by the dungeon itself"];

/** SURVIVAL_PASS — the Ruling C pass bands: floors 1-10 |dS| <= 8, floors 11-19 |dS| <= 3, reach-20 in [3.0, 5.0]%; floors 21+ informational. */
export const SURVIVAL_PASS = { shallowFloors: [1, 10], shallowTolerance: 8, deepFloors: [11, 19], deepTolerance: 3, reach20Band: [3.0, 5.0] };

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

    let hazard = 0;
    let starvation = 0;
    let combat = 0;
    for (const r of deathsArr) {
      const cause = String(r.cause);
      if (HAZARD_CAUSES.includes(cause)) hazard++;
      else if (STARVATION_CAUSES.includes(cause)) starvation++;
      else combat++;
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

    let pass;
    if (L === 20) {
      pass = reach20 >= SURVIVAL_PASS.reach20Band[0] && reach20 <= SURVIVAL_PASS.reach20Band[1];
    } else if (L >= 21) {
      pass = null;
    } else if (deltaSraw === null) {
      pass = null;
    } else if (L >= SURVIVAL_PASS.shallowFloors[0] && L <= SURVIVAL_PASS.shallowFloors[1]) {
      pass = Math.abs(deltaSraw) <= SURVIVAL_PASS.shallowTolerance;
    } else if (L >= SURVIVAL_PASS.deepFloors[0] && L <= SURVIVAL_PASS.deepFloors[1]) {
      pass = Math.abs(deltaSraw) <= SURVIVAL_PASS.deepTolerance;
    } else {
      pass = null;
    }

    floors.push({
      floor: L,
      reached,
      deaths,
      hazard,
      starvation,
      combat,
      pL: pLraw === null ? null : round1(pLraw),
      SL: SLraw === null ? null : round1(SLraw),
      targetP,
      targetS,
      deltaS: deltaSraw === null ? null : round1(deltaSraw),
      pass,
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
 * survivalVerdict(r) — `{ missing: [{ floor, deltaS }], reach20: { value, band, pass } }`.
 * `missing` covers floors 1-19 whose `pass === false` (floor 20's band is a
 * rate, not a delta, so it is reported only via `reach20`; floors 21+ are
 * informational and never appear in `missing`).
 */
export function survivalVerdict(r) {
  const missing = [];
  for (const f of r.floors) {
    if (f.floor >= 1 && f.floor <= 19 && f.pass === false) {
      missing.push({ floor: f.floor, deltaS: f.deltaS });
    }
  }
  const floor20 = r.floors.find((f) => f.floor === 20);
  const reach20Pass =
    floor20 && typeof floor20.pass === "boolean"
      ? floor20.pass
      : r.reach20 >= SURVIVAL_PASS.reach20Band[0] && r.reach20 <= SURVIVAL_PASS.reach20Band[1];
  return {
    missing,
    reach20: { value: r.reach20, band: SURVIVAL_PASS.reach20Band, pass: reach20Pass },
  };
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
    "Per-floor survival (USER RULING C target — p_L = 1 - deaths_L / reached_L; S_L = product of p_k from the start depth; stuck runs count as reached, never as deaths):",
  );
  for (const f of r.floors) {
    lines.push(
      `  L=${f.floor}  reached=${f.reached}  deaths=${f.deaths} (hazard ${f.hazard} / starvation ${f.starvation} / combat ${f.combat})  p_L=${fmtPct(f.pL)}  S_L=${fmtPct(f.SL)}  target p_L=${fmtPct(f.targetP)}  target S_L=${fmtPct(f.targetS)}  dS=${fmtSigned(f.deltaS)}  ${fmtVerdictLabel(f.pass)}`,
    );
  }
  const verdict = survivalVerdict(r);
  lines.push(
    `  reach-20: ${r.reach20.toFixed(1)}% (band 3.0-5.0%) ${verdict.reach20.pass ? "PASS" : "MISS"}`,
  );
  let verdictMsg;
  if (verdict.missing.length === 0) {
    verdictMsg = "all floors 1-19 inside the pass band";
  } else {
    verdictMsg = `floors outside the pass band: ${verdict.missing.map((m) => `${m.floor} (dS ${fmtSigned(m.deltaS)})`).join(", ")}`;
  }
  verdictMsg += `; reach-20 ${verdict.reach20.pass ? "PASS" : "MISS"}`;
  lines.push(`  verdict: ${verdictMsg}`);
  return lines;
}
