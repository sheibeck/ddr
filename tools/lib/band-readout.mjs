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
