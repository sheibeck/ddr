#!/usr/bin/env node
// tools/class-pass-diff.mjs
//
// Dev-only, zero-dependency Node ESM script — NOT shipped (see
// tools/build-www.mjs's copy list, which never references this file), NOT a
// node:test file (it makes no assertions, so `node --test` never picks it
// up). THIS IS A TUNING PROXY, NOT A PASS/FAIL GATE, and NOT a substitute
// for a human playtest — same discipline as tools/tune-classes.mjs and
// tools/lib/class-matrix.mjs, whose output this script diffs.
//
// PURPOSE (26-CONTEXT.md, PLAY-02): reads a BEFORE/AFTER pair of
// tools/lib/class-matrix.mjs JSON reports (natural start-depth-1 matrix +
// depth-20 slice), computes the fun-band verdicts and renders the Markdown
// the class-pass ledger (docs/CLASS-PASS.md) pastes verbatim, so numbers
// are never retyped by hand. Never plays a run, never imports the engine or
// content, never spawns a process — it only reads JSON already produced by
// tools/tune-classes.mjs and reasons over it.
//
// MU BASIS (Claude's Discretion, 26-CONTEXT.md): mu is RUN-WEIGHTED —
// sum(meanDepth_i x completed_i) / sum(completed_i) over the cells with
// completed > 0 — i.e. the mean death depth over every completed AFTER
// natural-start run, not the unweighted mean of the 143 per-cell means.
// With zero stuck runs and an equal seed count per cell (the BEFORE/AFTER
// capture discipline) it numerically coincides with the mean over cells,
// because every cell then carries the same weight.
//
// FUN BANDS (relative to the AFTER natural matrix's mu, CLOSED interval):
//   too weak   : meanDepth <  0.75 * mu
//   fine       : 0.75 * mu <= meanDepth <= 1.35 * mu   (both edges are FINE)
//   too strong : meanDepth >  1.35 * mu
// CANNOT ACT (a hard gate, checked independently of the band): a row whose
// stuck > 0, OR whose completed === 0, OR whose meanKills < 0.5 (exactly
// 0.5 is NOT cannot-act — strictly below is). A cannot-act row's band is
// always reported as "cannot act", never a weak/fine/strong band.
//
// ORDERING: every table in this script is ordered through
// tools/lib/class-matrix.mjs's rankCells — the ONE comparator (meanDepth
// desc, p50Depth desc, reach5 desc, then a string tiebreak asc). Rollup
// rows (byClass/bySub/byRace, natural and depth-20) are ranked by mapping
// their `key` to `sub` and an empty string to `race` before calling
// rankCells, so the identical comparator applies without re-deriving it.
//
// BYTE-STABILITY: no Math.random, no Date.now/new Date, no timestamps, no
// environment-dependent text anywhere in this script or its output — the
// same inputs always produce byte-identical stdout and --out-verdicts
// bytes (test/unit/class-pass-diff.test.js's determinism test runs the CLI
// twice and diffs the bytes).
//
// verdicts.json SCHEMA ("class-pass-verdicts/1"):
//   {
//     schema: "class-pass-verdicts/1",
//     meta: { before, after, beforeDeep, afterDeep: { commit, seeds,
//       startDepth, cells, bot }, parity: { natural, deep: { ok,
//       mismatches } }, mu: { basis: "runs", before, after },
//       bands: { tooWeakBelow, tooStrongAbove, cannotActKillsBelow,
//       edges: { low, high } }, runs: { natural, deep: { n, stuck,
//       completed } }, pooledReach: { before, after } },
//     cannotAct: [ { key, meanKills, stuck, completed, topCauses } ],
//     classes: [ { key, rank, before, after, delta } ]  (3 rows, no band —
//       classes are the top grouping, not a judged row),
//     subs: [ { key, cls, rank, before, after, delta, band, verdict,
//       reason, lever } ]  (24 rows),
//     races: [ same shape minus cls ]  (6 rows),
//     cells: { inBand, outOfBand: [ { key, cls, sub, race, rank, band,
//       before, after, delta } ] },
//     deep: { byClass, bySub, byRace: [ { key, rank, before, after,
//       delta: { floorsGained, encountersSurvived } } ] }  — NEVER a band
//       or verdict on a deep row,
//     rollups: { natural: { byClass, bySub, byRace }, deep: { byClass,
//       bySub, byRace } }  — the raw AFTER-only ranked rollup rows, used by
//       the Handoff section's roll-up tables.
//   }
// The script NEVER invents verdict/reason/lever text — those three fields
// are always emitted null unless --verdicts supplies a prior verdicts.json
// to copy them from, by key, via mergeEditorial.
//
// CLI:
//   node tools/class-pass-diff.mjs [options]
//     --before PATH        BEFORE natural JSON (default docs/class-pass/before.json)
//     --after PATH          AFTER natural JSON (default docs/class-pass/after.json)
//     --before-deep PATH   BEFORE depth-20 JSON (default docs/class-pass/before-depth20.json)
//     --after-deep PATH     AFTER depth-20 JSON (default docs/class-pass/after-depth20.json)
//     --verdicts PATH       an existing verdicts.json whose verdict/reason/lever
//                            fields are merged onto the freshly-built rows by key
//     --out-verdicts PATH   write the verdicts JSON atomically (tmp then rename)
//     --section X            after | outliers | handoff | all (default all)
//     --json                 print the verdicts object (2-space JSON) instead of Markdown
//     --gate                 load only --after; print cannot-act cells; exit 3 if
//                             any exist, else 0 (exit 2 on bad flags / unreadable input)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rankCells } from "./lib/class-matrix.mjs";

// --- constants ---------------------------------------------------------

export const BAND_LOW = 0.75;
export const BAND_HIGH = 1.35;
export const CANNOT_ACT_KILLS = 0.5;
export const BAND_ORDER = ["cannot act", "too weak", "too strong"];

/** the meta fields a BEFORE/AFTER pair must share — `commit` is deliberately excluded. */
const PARITY_FIELDS = ["seeds", "seedList", "workers", "maxActions", "startDepth", "exploreBudget", "cells", "bot"];

// --- pure helpers (exported) --------------------------------------------

/** cellKey(cell) -> "cls/sub/race". */
export function cellKey(cell) {
  return `${cell.cls}/${cell.sub}/${cell.race}`;
}

/**
 * muOverRuns(report) -> the run-weighted mean death depth over every cell
 * with completed > 0: sum(meanDepth_i * completed_i) / sum(completed_i).
 * Full precision (rounding is a render-time concern only). `null` when no
 * cell in the report has a single completed run.
 */
export function muOverRuns(report) {
  let weighted = 0;
  let totalCompleted = 0;
  for (const cell of report.cells) {
    if (cell.completed > 0 && cell.meanDepth !== null && cell.meanDepth !== undefined) {
      weighted += cell.meanDepth * cell.completed;
      totalCompleted += cell.completed;
    }
  }
  return totalCompleted === 0 ? null : weighted / totalCompleted;
}

/**
 * bandFor(meanDepth, mu) -> null when meanDepth is null/undefined,
 * "too weak" strictly below 0.75mu, "too strong" strictly above 1.35mu,
 * else "fine" — the interval is CLOSED, so exactly 0.75mu or 1.35mu is fine.
 */
export function bandFor(meanDepth, mu) {
  if (meanDepth === null || meanDepth === undefined) return null;
  if (meanDepth < BAND_LOW * mu) return "too weak";
  if (meanDepth > BAND_HIGH * mu) return "too strong";
  return "fine";
}

/**
 * isCannotAct(row) -> true when stuck > 0, OR completed === 0, OR
 * meanKills is a number strictly below CANNOT_ACT_KILLS (0.5 exactly is
 * NOT cannot-act).
 */
export function isCannotAct(row) {
  if (row.stuck > 0) return true;
  if (row.completed === 0) return true;
  if (typeof row.meanKills === "number" && row.meanKills < CANNOT_ACT_KILLS) return true;
  return false;
}

/** rowBand(row, mu) -> "cannot act" when isCannotAct(row), else bandFor(row.meanDepth, mu). Works on cells and rollup rows alike. */
export function rowBand(row, mu) {
  return isCannotAct(row) ? "cannot act" : bandFor(row.meanDepth, mu);
}

/** metaParity(a, b) -> { ok, mismatches } over PARITY_FIELDS (strict equality; commit excluded). */
export function metaParity(a, b) {
  const mismatches = [];
  for (const field of PARITY_FIELDS) {
    if (a[field] !== b[field]) mismatches.push(field);
  }
  return { ok: mismatches.length === 0, mismatches };
}

/**
 * rankRollupRows(rows) -> a ranked copy of rollup rows via rankCells,
 * mapping key -> sub and race -> "" so the identical class-matrix.mjs
 * comparator (meanDepth desc, p50Depth desc, reach5 desc, sub asc, race
 * asc) applies; each row gains `rank`, and the helper sub/race fields are
 * dropped from the result.
 */
export function rankRollupRows(rows) {
  const mapped = rows.map((r) => ({ ...r, sub: r.key, race: "" }));
  const ranked = rankCells(mapped);
  return ranked.map((r) => {
    const { sub, race, ...rest } = r;
    return rest;
  });
}

/**
 * pooledReach(report) -> { runs, reach5, reach10, reach20: null, maxP90 }.
 * reach5/reach10 are pooled over every completed run in the report (sum of
 * reach_k/100 * completed, divided by total completed, back to a percent,
 * one decimal). `runs` is the total completed runs the pooling is over.
 * `maxP90` is the largest non-null p90Depth across cells. reach20 is null
 * because the harness JSON only carries reach5/reach10 per cell — the
 * renderer explains this and points at the depth-20 slice instead.
 */
export function pooledReach(report) {
  let weighted5 = 0;
  let weighted10 = 0;
  let totalCompleted = 0;
  let maxP90 = null;
  for (const cell of report.cells) {
    if (cell.completed > 0) {
      totalCompleted += cell.completed;
      if (cell.reach5 !== null && cell.reach5 !== undefined) weighted5 += (cell.reach5 / 100) * cell.completed;
      if (cell.reach10 !== null && cell.reach10 !== undefined) weighted10 += (cell.reach10 / 100) * cell.completed;
    }
    if (cell.p90Depth !== null && cell.p90Depth !== undefined) {
      if (maxP90 === null || cell.p90Depth > maxP90) maxP90 = cell.p90Depth;
    }
  }
  return {
    runs: totalCompleted,
    reach5: totalCompleted === 0 ? null : Math.round((weighted5 / totalCompleted) * 1000) / 10,
    reach10: totalCompleted === 0 ? null : Math.round((weighted10 / totalCompleted) * 1000) / 10,
    reach20: null,
    maxP90,
  };
}

/** cannotActCells(report) -> cells satisfying isCannotAct, in rankCells order. */
export function cannotActCells(report) {
  const ranked = rankCells(report.cells);
  return ranked.filter(isCannotAct).map((c) => ({
    key: cellKey(c),
    meanKills: c.meanKills,
    stuck: c.stuck,
    completed: c.completed,
    topCauses: c.topCauses,
  }));
}

// --- internal formatting/rounding helpers (not exported) ---------------

function round2(v) {
  return v === null || v === undefined ? null : Math.round(v * 100) / 100;
}

function round4(v) {
  return v === null || v === undefined ? null : Math.round(v * 10000) / 10000;
}

/** fmt(v, digits) — "n/a" for null/undefined, else a fixed-decimal string (mirrors class-matrix.mjs's fmt). */
function fmt(v, digits = 2) {
  return v === null || v === undefined ? "n/a" : Number(v).toFixed(digits);
}

/** pct(v) — "n/a" for null/undefined, else one-decimal percent text (no trailing %, tables label the column). */
function pct(v) {
  return v === null || v === undefined ? "n/a" : Number(v).toFixed(1);
}

/** signedFmt(v, digits) — "n/a" for null, else a fixed-decimal string with an explicit leading "+" for >= 0. */
function signedFmt(v, digits = 2) {
  if (v === null || v === undefined) return "n/a";
  const n = Number(v);
  const s = n.toFixed(digits);
  return n >= 0 ? `+${s}` : s;
}

/** causesStr(topCauses) — compact "cause(count),cause(count)" text, "-" when empty (mirrors class-matrix.mjs). */
function causesStr(topCauses) {
  return topCauses && topCauses.length ? topCauses.map((c) => `${c.cause}(${c.count})`).join(",") : "-";
}

function mdRow(cells) {
  return `| ${cells.join(" | ")} |`;
}

function mdTable(headers, rows) {
  const lines = [mdRow(headers), mdRow(headers.map(() => "---"))];
  for (const r of rows) lines.push(mdRow(r));
  return lines.join("\n");
}

/** rowMetrics(row) — the compact depth-metric slice shared by subs/races/classes before/after fields; null when row is null/undefined. */
function rowMetrics(row) {
  if (!row) return null;
  return {
    meanDepth: row.meanDepth,
    p50Depth: row.p50Depth,
    reach5: row.reach5,
    reach10: row.reach10,
    meanKills: row.meanKills,
  };
}

/** deepRowMetrics(row) — the depth-20 metric slice for the deep roll-ups; null when row is null/undefined. */
function deepRowMetrics(row) {
  if (!row) return null;
  return {
    meanFloorsGained: row.meanFloorsGained,
    p50FloorsGained: row.p50FloorsGained,
    meanEncountersSurvived: row.meanEncountersSurvived,
    meanKills: row.meanKills,
  };
}

/** subToCls(afterReport) — sub -> owning class, from the AFTER cells (every cell sharing a sub shares a class). */
function subToCls(afterReport) {
  const map = new Map();
  for (const c of afterReport.cells) {
    if (!map.has(c.sub)) map.set(c.sub, c.cls);
  }
  return map;
}

function metaOf(report) {
  return {
    commit: report.meta.commit,
    seeds: report.meta.seeds,
    startDepth: report.meta.startDepth,
    cells: report.meta.cells,
    bot: report.meta.bot,
  };
}

function runsSummary(report) {
  let n = 0;
  let stuck = 0;
  let completed = 0;
  for (const c of report.cells) {
    n += c.n;
    stuck += c.stuck;
    completed += c.completed;
  }
  return { n, stuck, completed };
}

/** buildClassRows(beforeRows, afterRows) — the 3 by-class BEFORE/AFTER rows (no band/verdict — class is the top grouping). */
function buildClassRows(beforeRows, afterRows) {
  const ranked = rankRollupRows(afterRows);
  const beforeByKey = new Map(beforeRows.map((r) => [r.key, r]));
  return ranked.map((r) => {
    const b = beforeByKey.get(r.key) || null;
    const delta = b && b.meanDepth !== null && b.meanDepth !== undefined && r.meanDepth !== null && r.meanDepth !== undefined
      ? round2(r.meanDepth - b.meanDepth)
      : null;
    return { key: r.key, rank: r.rank, before: rowMetrics(b), after: rowMetrics(r), delta };
  });
}

/** buildEditorialRows(beforeRows, afterRows, mu, kind, clsMap) — the 24 sub or 6 race rows, verdict/reason/lever always null here. */
function buildEditorialRows(beforeRows, afterRows, mu, kind, clsMap) {
  const ranked = rankRollupRows(afterRows);
  const beforeByKey = new Map(beforeRows.map((r) => [r.key, r]));
  return ranked.map((r) => {
    const b = beforeByKey.get(r.key) || null;
    const delta = b && b.meanDepth !== null && b.meanDepth !== undefined && r.meanDepth !== null && r.meanDepth !== undefined
      ? round2(r.meanDepth - b.meanDepth)
      : null;
    const out = { key: r.key };
    if (kind === "sub") out.cls = clsMap.get(r.key) ?? null;
    out.rank = r.rank;
    out.before = rowMetrics(b);
    out.after = rowMetrics(r);
    out.delta = delta;
    out.band = rowBand(r, mu);
    out.verdict = null;
    out.reason = null;
    out.lever = null;
    return out;
  });
}

/** buildCellAppendix(before, after, mu) — the out-of-band cell appendix, ordered by BAND_ORDER then AFTER rank. */
function buildCellAppendix(before, after, mu) {
  const rankedAfter = rankCells(after.cells);
  const beforeByKey = new Map(before.cells.map((c) => [cellKey(c), c]));
  const outOfBand = [];
  for (const c of rankedAfter) {
    const band = rowBand(c, mu);
    if (band === "fine") continue;
    const b = beforeByKey.get(cellKey(c)) || null;
    const delta = b && b.meanDepth !== null && b.meanDepth !== undefined && c.meanDepth !== null && c.meanDepth !== undefined
      ? round2(c.meanDepth - b.meanDepth)
      : null;
    outOfBand.push({
      key: cellKey(c),
      cls: c.cls,
      sub: c.sub,
      race: c.race,
      rank: c.rank,
      band,
      before: b ? { meanDepth: b.meanDepth, meanKills: b.meanKills } : null,
      after: { meanDepth: c.meanDepth, meanKills: c.meanKills, stuck: c.stuck, completed: c.completed, reach5: c.reach5, topCauses: c.topCauses },
      delta,
    });
  }
  outOfBand.sort((a, b) => {
    const ai = BAND_ORDER.indexOf(a.band);
    const bi = BAND_ORDER.indexOf(b.band);
    if (ai !== bi) return ai - bi;
    return a.rank - b.rank;
  });
  return { inBand: after.cells.length - outOfBand.length, outOfBand };
}

/** buildDeepGroup(beforeRows, afterRows) — one of deep.byClass/bySub/byRace: floors-gained/encounters-survived only, NEVER a band or verdict. */
function buildDeepGroup(beforeRows, afterRows) {
  const ranked = rankRollupRows(afterRows);
  const beforeByKey = new Map(beforeRows.map((r) => [r.key, r]));
  return ranked.map((r) => {
    const b = beforeByKey.get(r.key) || null;
    const deltaFloors = b && b.meanFloorsGained !== null && b.meanFloorsGained !== undefined && r.meanFloorsGained !== null && r.meanFloorsGained !== undefined
      ? round2(r.meanFloorsGained - b.meanFloorsGained)
      : null;
    const deltaEnc = b && b.meanEncountersSurvived !== null && b.meanEncountersSurvived !== undefined && r.meanEncountersSurvived !== null && r.meanEncountersSurvived !== undefined
      ? round2(r.meanEncountersSurvived - b.meanEncountersSurvived)
      : null;
    return {
      key: r.key,
      rank: r.rank,
      before: deepRowMetrics(b),
      after: deepRowMetrics(r),
      delta: { floorsGained: deltaFloors, encountersSurvived: deltaEnc },
    };
  });
}

function buildDeepRollups(beforeDeep, afterDeep) {
  return {
    byClass: buildDeepGroup(beforeDeep.rollups.byClass, afterDeep.rollups.byClass),
    bySub: buildDeepGroup(beforeDeep.rollups.bySub, afterDeep.rollups.bySub),
    byRace: buildDeepGroup(beforeDeep.rollups.byRace, afterDeep.rollups.byRace),
  };
}

// --- verdicts builder (exported) ----------------------------------------

/**
 * buildVerdicts({ before, after, beforeDeep, afterDeep, prior }) -> the
 * full verdicts.json object (schema "class-pass-verdicts/1"; see the
 * header comment for the shape). When `prior` is given, finishes with
 * mergeEditorial so a re-run copies forward the human accept/revisit
 * verdicts by key.
 */
export function buildVerdicts({ before, after, beforeDeep, afterDeep, prior } = {}) {
  const muBefore = muOverRuns(before);
  const muAfter = muOverRuns(after);
  const clsMap = subToCls(after);

  const verdicts = {
    schema: "class-pass-verdicts/1",
    meta: {
      before: metaOf(before),
      after: metaOf(after),
      beforeDeep: metaOf(beforeDeep),
      afterDeep: metaOf(afterDeep),
      parity: {
        natural: metaParity(before.meta, after.meta),
        deep: metaParity(beforeDeep.meta, afterDeep.meta),
      },
      mu: {
        basis: "runs",
        before: round4(muBefore),
        after: round4(muAfter),
      },
      bands: {
        tooWeakBelow: BAND_LOW,
        tooStrongAbove: BAND_HIGH,
        cannotActKillsBelow: CANNOT_ACT_KILLS,
        edges: {
          low: muAfter === null ? null : round4(muAfter * BAND_LOW),
          high: muAfter === null ? null : round4(muAfter * BAND_HIGH),
        },
      },
      runs: {
        natural: runsSummary(after),
        deep: runsSummary(afterDeep),
      },
      pooledReach: {
        before: pooledReach(before),
        after: pooledReach(after),
      },
    },
    cannotAct: cannotActCells(after),
    classes: buildClassRows(before.rollups.byClass, after.rollups.byClass),
    subs: buildEditorialRows(before.rollups.bySub, after.rollups.bySub, muAfter, "sub", clsMap),
    races: buildEditorialRows(before.rollups.byRace, after.rollups.byRace, muAfter, "race", clsMap),
    cells: buildCellAppendix(before, after, muAfter),
    deep: buildDeepRollups(beforeDeep, afterDeep),
    rollups: {
      natural: {
        byClass: rankRollupRows(after.rollups.byClass),
        bySub: rankRollupRows(after.rollups.bySub),
        byRace: rankRollupRows(after.rollups.byRace),
      },
      deep: {
        byClass: rankRollupRows(afterDeep.rollups.byClass),
        bySub: rankRollupRows(afterDeep.rollups.bySub),
        byRace: rankRollupRows(afterDeep.rollups.byRace),
      },
    },
  };

  return prior ? mergeEditorial(verdicts, prior) : verdicts;
}

/**
 * mergeEditorial(verdicts, prior) -> copies verdict/reason/lever by `key`
 * from prior.subs/prior.races onto the matching freshly-built rows — ONLY
 * those three fields; everything else is recomputed. Throws when a prior
 * verdict is not one of "accept", "revisit", or null. Idempotent: merging
 * a verdicts object's own subs/races back in as `prior` reproduces it.
 */
export function mergeEditorial(verdicts, prior) {
  const valid = new Set(["accept", "revisit", null]);
  const applyPrior = (rows, priorRows) => {
    const priorByKey = new Map((priorRows || []).map((r) => [r.key, r]));
    for (const row of rows) {
      const p = priorByKey.get(row.key);
      if (!p) continue;
      const verdict = p.verdict === undefined ? null : p.verdict;
      if (!valid.has(verdict)) {
        throw new Error(`mergeEditorial: invalid verdict "${p.verdict}" for key "${row.key}" — must be "accept", "revisit", or null`);
      }
      row.verdict = verdict;
      row.reason = p.reason === undefined ? null : p.reason;
      row.lever = p.lever === undefined ? null : p.lever;
    }
  };
  applyPrior(verdicts.subs, prior.subs);
  applyPrior(verdicts.races, prior.races);
  return verdicts;
}

// --- Markdown rendering (exported) --------------------------------------

/** verdictCell(row) — "accept"/"revisit", "" for an in-band null verdict, "(verdict pending)" for an out-of-band null verdict. */
function verdictCell(row) {
  if (row.verdict === "accept" || row.verdict === "revisit") return row.verdict;
  return row.band === "fine" ? "" : "(verdict pending)";
}

function reasonCell(row) {
  return row.reason || "";
}

function headline(v) {
  const cellsCount = v.meta.after.cells;
  const natural = v.meta.runs.natural;
  const deep = v.meta.runs.deep;
  if (v.cannotAct.length === 0) {
    return `**Zero cannot-act cells.** 0 of ${cellsCount} AFTER natural-start cells have meanKills < 0.5 or stuck > 0 (${natural.stuck} of ${natural.n} natural-start runs stuck; depth-20 slice: ${deep.stuck} of ${deep.n} runs stuck).`;
  }
  const headers = ["#", "Class", "Sub", "Race", "kills", "stuck", "completed", "top causes"];
  const rows = v.cannotAct.map((c, i) => {
    const [cls, sub, race] = c.key.split("/");
    return [String(i + 1), cls, sub, race, fmt(c.meanKills), String(c.stuck), String(c.completed), causesStr(c.topCauses)];
  });
  return [
    `**CANNOT-ACT GATE FAILED.** ${v.cannotAct.length} of ${cellsCount} AFTER cells have meanKills < 0.5 or stuck > 0:`,
    "",
    mdTable(headers, rows),
  ].join("\n");
}

function parityLine(v) {
  const describe = (label, p) => (p.ok ? `${label} identical` : `${label} mismatched: ${p.mismatches.join(", ")}`);
  return `**Parameter parity (BEFORE vs AFTER, modulo commit):** ${describe("natural pair", v.meta.parity.natural)}; ${describe("deep pair", v.meta.parity.deep)}.`;
}

function muLine(v) {
  const after = fmt(v.meta.mu.after);
  const before = fmt(v.meta.mu.before);
  const delta = v.meta.mu.after !== null && v.meta.mu.before !== null ? signedFmt(v.meta.mu.after - v.meta.mu.before) : "n/a";
  const low = fmt(v.meta.bands.edges.low);
  const high = fmt(v.meta.bands.edges.high);
  return `**mu (mean death depth over all completed AFTER natural-start runs) = ${after}** (BEFORE mu ${before}, delta ${delta}). Bands relative to AFTER mu: too weak < ${low} (0.75mu) · fine ${low}–${high} (closed) · too strong > ${high} (1.35mu) · cannot act = meanKills < 0.5 or stuck > 0. mu is run-weighted: sum(meanDepth x completed) / sum(completed) over the ${v.meta.after.cells} cells.`;
}

function byClassTable(v) {
  const headers = ["#", "Class", "BEFORE mean", "AFTER mean", "Δ", "BEFORE p50", "AFTER p50", "BEFORE ≥5", "AFTER ≥5", "AFTER ≥10", "AFTER kills"];
  const rows = v.classes.map((c) => [
    String(c.rank),
    c.key,
    fmt(c.before?.meanDepth),
    fmt(c.after?.meanDepth),
    signedFmt(c.delta),
    fmt(c.before?.p50Depth, 1),
    fmt(c.after?.p50Depth, 1),
    pct(c.before?.reach5),
    pct(c.after?.reach5),
    pct(c.after?.reach10),
    fmt(c.after?.meanKills),
  ]);
  return mdTable(headers, rows);
}

function subsBottomTopTables(v) {
  const subs = v.subs;
  const bottom = subs.slice(-5);
  const top = subs.slice(0, 5);
  const headers = ["#", "Sub", "Class", "BEFORE", "AFTER", "Δ", "Band", "Verdict", "Reason"];
  const rowOf = (r) => [String(r.rank), r.key, r.cls, fmt(r.before?.meanDepth), fmt(r.after?.meanDepth), signedFmt(r.delta), r.band ?? "n/a", verdictCell(r), reasonCell(r)];
  return ["**Bottom five**", "", mdTable(headers, bottom.map(rowOf)), "", "**Top five**", "", mdTable(headers, top.map(rowOf))].join("\n");
}

function racesTable(v) {
  const headers = ["#", "Race", "BEFORE", "AFTER", "Δ", "≥5 BEFORE", "≥5 AFTER", "Band", "Verdict", "Reason"];
  const rows = v.races.map((r) => [
    String(r.rank),
    r.key,
    fmt(r.before?.meanDepth),
    fmt(r.after?.meanDepth),
    signedFmt(r.delta),
    pct(r.before?.reach5),
    pct(r.after?.reach5),
    r.band ?? "n/a",
    verdictCell(r),
    reasonCell(r),
  ]);
  return mdTable(headers, rows);
}

function subsAllTable(v) {
  const headers = ["#", "Sub", "Class", "BEFORE", "AFTER", "Δ", "≥5 BEFORE", "≥5 AFTER", "Band", "Verdict", "Reason"];
  const rows = v.subs.map((r) => [
    String(r.rank),
    r.key,
    r.cls,
    fmt(r.before?.meanDepth),
    fmt(r.after?.meanDepth),
    signedFmt(r.delta),
    pct(r.before?.reach5),
    pct(r.after?.reach5),
    r.band ?? "n/a",
    verdictCell(r),
    reasonCell(r),
  ]);
  return mdTable(headers, rows);
}

function reachTable(v) {
  const pr = v.meta.pooledReach;
  const headers = ["Floor", "BEFORE", "AFTER"];
  const rows = [
    ["≥5", pct(pr.before.reach5), pct(pr.after.reach5)],
    ["≥10", pct(pr.before.reach10), pct(pr.after.reach10)],
    ["≥20", "n/a", "n/a"],
  ];
  const note = `≥20 is not carried per cell by the Phase 22 harness JSON (reach5/reach10 only); the highest per-cell p90 in the AFTER matrix is ${fmt(pr.after.maxP90, 1)}, so no cell reaches 20 in 10% or more of its runs; the depth-20 slice below is the ≥20 yardstick.`;
  return [mdTable(headers, rows), "", note].join("\n");
}

function deepSliceRows(rows, keyLabel) {
  const headers = ["#", keyLabel, "floors gained BEFORE", "AFTER", "Δ", "encounters survived BEFORE", "AFTER", "Δ"];
  const body = rows.map((r) => [
    String(r.rank),
    r.key,
    fmt(r.before?.meanFloorsGained),
    fmt(r.after?.meanFloorsGained),
    signedFmt(r.delta.floorsGained),
    fmt(r.before?.meanEncountersSurvived),
    fmt(r.after?.meanEncountersSurvived),
    signedFmt(r.delta.encountersSurvived),
  ]);
  return mdTable(headers, body);
}

function deepSliceTables(v) {
  return [
    "**By class**",
    "",
    deepSliceRows(v.deep.byClass, "Class"),
    "",
    "**By sub-class**",
    "",
    deepSliceRows(v.deep.bySub, "Sub"),
    "",
    "**By race**",
    "",
    deepSliceRows(v.deep.byRace, "Race"),
  ].join("\n");
}

function outOfBandAppendix(v) {
  const { inBand, outOfBand } = v.cells;
  const totalCells = inBand + outOfBand.length;
  const header = `In band: ${inBand} of ${totalCells} cells (fine).`;
  if (outOfBand.length === 0) {
    return [header, "", "No out-of-band cells."].join("\n");
  }
  const headers = ["Band", "#", "Class", "Sub", "Race", "BEFORE", "AFTER", "Δ", "AFTER kills"];
  const rows = outOfBand.map((c) => [
    c.band,
    String(c.rank),
    c.cls,
    c.sub,
    c.race,
    fmt(c.before?.meanDepth),
    fmt(c.after.meanDepth),
    signedFmt(c.delta),
    fmt(c.after.meanKills),
  ]);
  return [header, "", mdTable(headers, rows)].join("\n");
}

function renderAfter(v) {
  return [
    headline(v),
    parityLine(v),
    muLine(v),
    "",
    "### By class — BEFORE → AFTER",
    byClassTable(v),
    "",
    "### Sub-classes — bottom five and top five (AFTER)",
    subsBottomTopTables(v),
    "",
    "### Races — BEFORE → AFTER (Human is the control)",
    racesTable(v),
    "",
    "### Sub-classes — all 24 rows (AFTER rank order)",
    subsAllTable(v),
    "",
    "### Reach table (AFTER natural, pooled over completed runs)",
    reachTable(v),
    "",
    "### Depth-20 slice — Phase 27's yardstick (no verdicts)",
    deepSliceTables(v),
    "",
    "### Out-of-band cells (appendix)",
    outOfBandAppendix(v),
  ].join("\n");
}

function renderOutliers(v) {
  const revisitSubs = v.subs.filter((r) => r.verdict === "revisit");
  const revisitRaces = v.races.filter((r) => r.verdict === "revisit");
  const lines = ["## Outliers (Phase 26 — revisit list)", ""];
  if (revisitSubs.length === 0 && revisitRaces.length === 0) {
    lines.push("No revisit rows — every out-of-band row was accepted.");
    return lines.join("\n");
  }
  const headers = ["Row", "Kind", "Band", "BEFORE", "AFTER", "Δ", "Reason", "Suggested lever (v1.3)"];
  const rowOf = (r, kind) => [r.key, kind, r.band ?? "n/a", fmt(r.before?.meanDepth), fmt(r.after?.meanDepth), signedFmt(r.delta), r.reason || "", r.lever || ""];
  const rows = [...revisitSubs.map((r) => rowOf(r, "sub")), ...revisitRaces.map((r) => rowOf(r, "race"))];
  lines.push(mdTable(headers, rows));
  lines.push("");
  lines.push("Every lever above is a v1.3 candidate — Phase 26 measures and judges; it changes no engine, content or tool code.");
  return lines.join("\n");
}

function yardstickSummary(v) {
  const pr = v.meta.pooledReach;
  return [
    `mu (AFTER, run-weighted) = ${fmt(v.meta.mu.after)} — bands: too weak < ${fmt(v.meta.bands.edges.low)}, fine ${fmt(v.meta.bands.edges.low)}–${fmt(v.meta.bands.edges.high)}, too strong > ${fmt(v.meta.bands.edges.high)}.`,
    `Reach (AFTER, pooled): ≥5 ${pct(pr.after.reach5)}, ≥10 ${pct(pr.after.reach10)}, ≥20 n/a (see depth-20 slice below).`,
    `Cannot-act cells: ${v.cannotAct.length} of ${v.meta.after.cells}.`,
    `Commits: before ${v.meta.before.commit}, after ${v.meta.after.commit}, before-deep ${v.meta.beforeDeep.commit}, after-deep ${v.meta.afterDeep.commit}.`,
  ].join("\n");
}

function naturalRollupTable(rows, keyLabel) {
  const headers = ["#", keyLabel, "mean", "p50", "p90", "≥5", "≥10", "kills", "lvl", "actions"];
  const body = rows.map((r) => [String(r.rank), r.key, fmt(r.meanDepth), fmt(r.p50Depth, 1), fmt(r.p90Depth, 1), pct(r.reach5), pct(r.reach10), fmt(r.meanKills), fmt(r.meanLevel), fmt(r.meanActions)]);
  return mdTable(headers, body);
}

function deepRollupTable(rows, keyLabel) {
  const headers = ["#", keyLabel, "floors gained (mean)", "floors gained (p50)", "encounters survived", "kills"];
  const body = rows.map((r) => [String(r.rank), r.key, fmt(r.meanFloorsGained), fmt(r.p50FloorsGained, 1), fmt(r.meanEncountersSurvived), fmt(r.meanKills)]);
  return mdTable(headers, body);
}

function editorialList(v, predicate) {
  const rows = [
    ...v.subs.filter(predicate).map((r) => ({ ...r, kind: "sub" })),
    ...v.races.filter(predicate).map((r) => ({ ...r, kind: "race" })),
  ];
  if (rows.length === 0) return null;
  return rows.map((r) => `- ${r.key} (${r.kind}): AFTER ${fmt(r.after?.meanDepth)} — ${r.reason || ""}`).join("\n");
}

function acceptedButStrong(v) {
  return editorialList(v, (r) => r.band === "too strong" && r.verdict === "accept") ?? "None — no row is both too strong and accepted.";
}

function revisitRowsList(v) {
  return editorialList(v, (r) => r.verdict === "revisit") ?? "None.";
}

function caveats() {
  return [
    "- This is a tuning proxy, not a gate, and not a substitute for the Phase 27 human DR round.",
    "- Pairing is by seed, not by path — engine changes shift downstream dice.",
    "- The natural matrix's ≥20 rate and its overall median are not carried per cell by the harness JSON, so Phase 27's own readout supplies them.",
    "- Bands are relative to the AFTER mu and the AFTER mu only.",
  ].join("\n");
}

function renderHandoff(v) {
  return [
    "## Handoff to Phase 27",
    "",
    "### Yardstick summary",
    yardstickSummary(v),
    "",
    "### AFTER natural roll-ups — by class",
    naturalRollupTable(v.rollups.natural.byClass, "Class"),
    "",
    "### AFTER natural roll-ups — by sub-class",
    naturalRollupTable(v.rollups.natural.bySub, "Sub"),
    "",
    "### AFTER natural roll-ups — by race",
    naturalRollupTable(v.rollups.natural.byRace, "Race"),
    "",
    "### Depth-20 roll-ups — by class",
    deepRollupTable(v.rollups.deep.byClass, "Class"),
    "",
    "### Depth-20 roll-ups — by sub-class",
    deepRollupTable(v.rollups.deep.bySub, "Sub"),
    "",
    "### Depth-20 roll-ups — by race",
    deepRollupTable(v.rollups.deep.byRace, "Race"),
    "",
    "### Accepted-but-strong rows",
    acceptedButStrong(v),
    "",
    "### Revisit rows",
    revisitRowsList(v),
    "",
    "### Caveats",
    caveats(),
  ].join("\n");
}

/** renderMarkdown(verdicts, section) -> "after" | "outliers" | "handoff" | "all" (the three joined by a blank line). */
export function renderMarkdown(verdicts, section = "all") {
  if (section === "after") return renderAfter(verdicts);
  if (section === "outliers") return renderOutliers(verdicts);
  if (section === "handoff") return renderHandoff(verdicts);
  if (section === "all") return [renderAfter(verdicts), renderOutliers(verdicts), renderHandoff(verdicts)].join("\n\n");
  throw new Error(`renderMarkdown: unknown section "${section}" — valid sections are after, outliers, handoff, all`);
}

// --- CLI (main module only) ---------------------------------------------

function usage() {
  return [
    "Usage: node tools/class-pass-diff.mjs [options]",
    "  --before PATH         BEFORE natural JSON (default docs/class-pass/before.json)",
    "  --after PATH          AFTER natural JSON (default docs/class-pass/after.json)",
    "  --before-deep PATH    BEFORE depth-20 JSON (default docs/class-pass/before-depth20.json)",
    "  --after-deep PATH     AFTER depth-20 JSON (default docs/class-pass/after-depth20.json)",
    "  --verdicts PATH       existing verdicts.json to merge verdict/reason/lever from",
    "  --out-verdicts PATH   write the verdicts JSON atomically to PATH",
    "  --section X           after|outliers|handoff|all (default all)",
    "  --json                print the verdicts object instead of Markdown",
    "  --gate                load only --after; print cannot-act cells; exit 3 if any, else 0",
  ].join("\n");
}

function fail(msg) {
  process.stderr.write(`${msg}\n${usage()}\n`);
  process.exit(2);
}

/** parseArgs(argv) — accepts both `--flag value` and `--flag=value` forms; unknown flag exits 2 with usage. */
function parseArgs(argv) {
  const opts = {
    before: "docs/class-pass/before.json",
    after: "docs/class-pass/after.json",
    beforeDeep: "docs/class-pass/before-depth20.json",
    afterDeep: "docs/class-pass/after-depth20.json",
    verdicts: null,
    outVerdicts: null,
    section: "all",
    json: false,
    gate: false,
  };

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (!arg.startsWith("--")) fail(`Unrecognized argument: ${arg}`);
    const eqIdx = arg.indexOf("=");
    const flag = eqIdx === -1 ? arg : arg.slice(0, eqIdx);
    const inlineValue = eqIdx === -1 ? null : arg.slice(eqIdx + 1);
    const nextValue = () => {
      if (inlineValue !== null) return inlineValue;
      i++;
      if (i >= argv.length) fail(`${flag} requires a value`);
      return argv[i];
    };

    switch (flag) {
      case "--before":
        opts.before = nextValue();
        break;
      case "--after":
        opts.after = nextValue();
        break;
      case "--before-deep":
        opts.beforeDeep = nextValue();
        break;
      case "--after-deep":
        opts.afterDeep = nextValue();
        break;
      case "--verdicts":
        opts.verdicts = nextValue();
        break;
      case "--out-verdicts":
        opts.outVerdicts = nextValue();
        break;
      case "--section": {
        const v = nextValue();
        if (!["after", "outliers", "handoff", "all"].includes(v)) fail(`--section must be one of after|outliers|handoff|all`);
        opts.section = v;
        break;
      }
      case "--json":
        opts.json = true;
        break;
      case "--gate":
        opts.gate = true;
        break;
      default:
        fail(`Unknown flag: ${flag}`);
    }
    i++;
  }
  return opts;
}

/** readJSON(p, label) — exits 2 with a clear message naming the file when it is missing or unparseable. */
function readJSON(p, label) {
  let raw;
  try {
    raw = fs.readFileSync(p, "utf8");
  } catch (e) {
    fail(`Cannot read ${label} file "${p}": ${e.message}`);
    return undefined; // unreachable — fail() exits the process
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    fail(`Cannot parse ${label} file "${p}" as JSON: ${e.message}`);
    return undefined; // unreachable — fail() exits the process
  }
}

function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.gate) {
    const after = readJSON(opts.after, "--after");
    const flagged = cannotActCells(after);
    process.stdout.write(`cannot-act cells: ${flagged.length} of ${after.meta.cells}\n`);
    for (const c of flagged) {
      process.stdout.write(`${c.key}  kills=${fmt(c.meanKills)}  stuck=${c.stuck}  completed=${c.completed}  top causes: ${causesStr(c.topCauses)}\n`);
    }
    process.exit(flagged.length > 0 ? 3 : 0);
    return;
  }

  const before = readJSON(opts.before, "--before");
  const after = readJSON(opts.after, "--after");
  const beforeDeep = readJSON(opts.beforeDeep, "--before-deep");
  const afterDeep = readJSON(opts.afterDeep, "--after-deep");
  const prior = opts.verdicts ? readJSON(opts.verdicts, "--verdicts") : null;

  let verdicts;
  try {
    verdicts = buildVerdicts({ before, after, beforeDeep, afterDeep, prior });
  } catch (e) {
    fail(`Failed to build verdicts: ${e.message}`);
    return; // unreachable — fail() exits the process
  }

  if (opts.outVerdicts) {
    const dir = path.dirname(opts.outVerdicts);
    if (dir && dir !== ".") fs.mkdirSync(dir, { recursive: true });
    const tmpPath = `${opts.outVerdicts}.tmp`;
    fs.writeFileSync(tmpPath, `${JSON.stringify(verdicts, null, 2)}\n`);
    fs.renameSync(tmpPath, opts.outVerdicts); // written ONCE, atomically
  }

  if (opts.json) {
    process.stdout.write(`${JSON.stringify(verdicts, null, 2)}\n`);
  } else {
    process.stdout.write(`${renderMarkdown(verdicts, opts.section)}\n`);
  }
  process.exit(0);
}

function isMainModule() {
  try {
    return path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isMainModule()) {
  main();
}
