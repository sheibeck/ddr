// tools/lib/class-matrix.mjs
//
// Dev-only, zero-dependency, PURE Node ESM helper module for
// tools/tune-classes.mjs (Phase 22, HARN-03). No Math.random, no Date.now,
// no fs, no os, no worker_threads — this module owns cell enumeration, name
// resolution, seed generation, per-cell aggregation, ranking, roll-ups, and
// text formatting; the CLI tool (tools/tune-classes.mjs) owns all I/O and
// thread orchestration.
//
// THIS IS A TUNING PROXY, NOT A PASS/FAIL GATE, and NOT a substitute for a
// human playtest (03-CONTEXT.md / 03-RESEARCH.md Pitfall 3 — a heuristic
// bot's play skill is arbitrary). Do not gate any build or CI check on this
// module's output; read the ranked matrix as a rough sanity signal only.
//
// RANKING TIE-BREAK (documented once here; rankCells/rollups both use it):
//   1. meanDepth desc (a cell with no completed runs — meanDepth === null —
//      always sorts LAST, never first)
//   2. p50Depth desc
//   3. reach5 desc
//   4. sub asc, then race asc (rankCells) — OR key asc (rollups' three
//      grouped tables) — plain `<`/`>` string comparison, NOT localeCompare.
//
// JSON SHAPE (tools/tune-classes.mjs's buildReport/formatText contract):
//   {
//     meta: {
//       tool: "tune-classes", commit, seeds, seedList: "i*7919+1", workers,
//       maxActions, startDepth, exploreBudget, bot (the grep-stable "Bot: "
//       line), runFlags (Phase 42, BAL-01/02 — tuning-bot.mjs#RUN_FLAGS,
//       machine-visible next to the frozen `bot` line, NOT in
//       class-pass-diff.mjs's PARITY_FIELDS list), cells (cell count),
//       excluded (EXCLUDED_CELLS), filter: { cls, sub, race } (each null
//       when unset by the CLI)
//     },
//     cells: [{ rank, cls, sub, race, n, completed, stuck, meanDepth,
//       p50Depth, p90Depth, reach5, reach10, reach20, meanKills, meanLevel,
//       meanActions, meanFloorsGained, p50FloorsGained,
//       meanEncountersSurvived, topCauses, usage }],
//     rollups: { byClass, bySub, byRace, pooled } — byClass/bySub/byRace are
//       each an array of { key, n, completed, stuck, meanDepth, ...
//       (same summarizeRows shape) }; pooled is a single object
//       { key: "ALL", ...summarizeRows(every cell's rows concatenated) } —
//       Phase 27's (TUNE-05) run-weighted band readout (docs/DIFFICULTY-
//       RETUNE.md's `## v1.2 retune (Phase 27)`), added by pooledSummary().
//   }
// `usage` (Phase 42, BAL-02 — every cell/rollup row's own
// `{ abilities, spells, items }` pick tally, each a label ->
// `{ uses, runs }` map) is an ADDITIVE readout, exactly like `reach20`/
// `pooled` before it — see rowFromRun/aggregateUsage/formatUsageMarkdown
// below. NO timing fields (elapsed/ms/time) appear ANYWHERE in this shape —
// the CLI tool prints elapsed to stderr only, so BEFORE/AFTER JSON snapshots
// diff cleanly (22-CONTEXT.md, Claude's Discretion). `reach20`/`pooled`/
// `usage`/`runFlags` are all ADDITIVE readout changes — no run, no rng draw,
// no Bot: line is affected; tools/lib/tuning-bot.mjs's own play/scoring
// logic gains new tactics (Plan 03) but this module never plays a run.

import { CLASSES, RACES, ABILITIES, SPELLS } from "../../content/index.js";
import { percentile, botLine, RUN_FLAGS } from "./tuning-bot.mjs";

/**
 * EXCLUDED_CELLS — the one canon-impossible sub-class x race combo
 * ("Fridges don't wear any armor" — the prototype rerolls the sub rather
 * than ever letting this combo stand). enumerateCells() skips it, so the
 * matrix has 143 cells, not 144; the harness/CLI refuse it with a friendly
 * message BEFORE any newRun (see resolveForce below).
 */
export const EXCLUDED_CELLS = Object.freeze([
  { cls: "Fighter", sub: "Samurai", race: "Fridgian", reason: "canon-impossible: Fridges don't wear any armor (the prototype rerolls the sub)" },
]);

function isExcludedCell(cls, sub, race) {
  return EXCLUDED_CELLS.some((e) => e.cls === cls && e.sub === sub && e.race === race);
}

/**
 * enumerateCells() — every valid { cls, sub, race } triple: for each class
 * (CLASSES key order), each of its subs (CLASSES[cls].subs order), each race
 * (RACES key order) — skipping EXCLUDED_CELLS. 3 classes x 8 subs x 6 races
 * = 144 combos, minus the 1 excluded combo = 143 cells.
 */
export function enumerateCells() {
  const cells = [];
  for (const cls of Object.keys(CLASSES)) {
    for (const sub of CLASSES[cls].subs) {
      for (const race of Object.keys(RACES)) {
        if (isExcludedCell(cls, sub, race)) continue;
        cells.push({ cls, sub, race });
      }
    }
  }
  return cells;
}

/** canonicalList(kind) — the canonical string set resolveName matches against. */
function canonicalList(kind) {
  if (kind === "cls") return Object.keys(CLASSES);
  if (kind === "sub") return Object.values(CLASSES).flatMap((c) => c.subs);
  if (kind === "race") return Object.keys(RACES);
  throw new Error(`resolveName: unknown kind "${kind}" — valid kinds are cls, sub, race`);
}

/**
 * resolveName(kind, raw) — case-insensitive CLI name resolution to a
 * canonical CLASSES/RACES/subs string key. `kind` is "cls" | "sub" | "race".
 * Trims surrounding whitespace, matches case-insensitively, and returns the
 * EXACT canonical spelling. Throws an Error listing every valid value for
 * `kind` when no match is found.
 */
export function resolveName(kind, raw) {
  const list = canonicalList(kind);
  const trimmed = String(raw).trim();
  const lower = trimmed.toLowerCase();
  const match = list.find((v) => v.toLowerCase() === lower);
  if (!match) {
    throw new Error(`resolveName: "${raw}" is not a valid ${kind} — valid ${kind} values are ${list.join(", ")}`);
  }
  return match;
}

/**
 * resolveForce({ cls, sub, race }) — the CLI-facing counterpart of
 * engine/character.js#normalizeForce: resolves raw, case-insensitive CLI
 * strings to canonical keys (via resolveName), infers `cls` from `sub` when
 * only `sub` is given (the unique class whose `subs` includes it), throws
 * when a given `cls` does not own the given `sub`, and throws a friendly,
 * canon-quoting message for Samurai + Fridgian — BEFORE any newRun call, so
 * the harness never even reaches engine/character.js's own rejection.
 * Returns `null` when no key is given at all (the "no forcing" case).
 */
export function resolveForce({ cls, sub, race } = {}) {
  const hasAny = cls !== undefined || sub !== undefined || race !== undefined;
  if (!hasAny) return null;

  let resolvedCls = cls !== undefined ? resolveName("cls", cls) : undefined;
  let resolvedSub;
  if (sub !== undefined) {
    resolvedSub = resolveName("sub", sub);
    if (resolvedCls !== undefined) {
      if (!CLASSES[resolvedCls].subs.includes(resolvedSub)) {
        throw new Error(
          `resolveForce: "${resolvedSub}" is not a subclass of ${resolvedCls} — valid subs are ${CLASSES[resolvedCls].subs.join(", ")}`,
        );
      }
    } else {
      const owner = Object.keys(CLASSES).find((c) => CLASSES[c].subs.includes(resolvedSub));
      resolvedCls = owner;
    }
  }
  const resolvedRace = race !== undefined ? resolveName("race", race) : undefined;

  if (resolvedSub === "Samurai" && resolvedRace === "Fridgian") {
    throw new Error(
      `resolveForce: cannot force a Fridgian Samurai — "Fridges don't wear any armor." The matrix omits this cell (see EXCLUDED_CELLS).`,
    );
  }

  const result = {};
  if (resolvedCls !== undefined) result.cls = resolvedCls;
  if (resolvedSub !== undefined) result.sub = resolvedSub;
  if (resolvedRace !== undefined) result.race = resolvedRace;
  return result;
}

/**
 * selectCells(force) — enumerateCells() filtered down to whichever of
 * cls/sub/race the (already-resolved, canonical) `force` sets. `null`
 * (or an object with no matching keys) returns all 143 cells unfiltered.
 */
export function selectCells(force) {
  const cells = enumerateCells();
  if (!force) return cells;
  return cells.filter(
    (cell) =>
      (force.cls === undefined || cell.cls === force.cls) &&
      (force.sub === undefined || cell.sub === force.sub) &&
      (force.race === undefined || cell.race === force.race),
  );
}

/**
 * seedList(n) — the fixed, paired seed list every matrix cell plays: the
 * exact `i*7919+1` stride tools/tune-difficulty.mjs already uses, so a
 * class-aware comparison and a difficulty comparison sample the identical
 * maze/encounter streams for the same index.
 */
export function seedList(n) {
  return Array.from({ length: n }, (_, i) => i * 7919 + 1);
}

/**
 * rowFromRun(run) — a compact per-run record extracted from a
 * tools/lib/tuning-bot.mjs#playRun result: no `state` object crosses a
 * thread-message boundary or accumulates in memory beyond what
 * summarizeRows needs. `usage` (Phase 42, BAL-02) carries the run's own
 * `{ abilities, spells, items }` pick tally straight through — the source
 * `summarizeRows`/`rollups` aggregate for the pick-rate renderer.
 */
export function rowFromRun(run) {
  return {
    seed: run.seed,
    deathDepth: run.deathDepth,
    floorsGained: run.floorsGained,
    kills: run.state.c.kills,
    level: run.state.c.level,
    actions: run.actions,
    stuck: run.stuck,
    cause: run.cause,
    encounters: run.tallies.encounters,
    encountersSurvived: run.encountersSurvived,
    usage: run.tallies.usage,
  };
}

/**
 * aggregateUsage(rows) — Phase 42 (BAL-02): sums each row's `usage`
 * (`{ abilities, spells, items }`, each a label -> use-count map; rows with
 * no `usage` field at all — e.g. older synthetic-state test rows — are
 * treated as carrying zero uses everywhere) into
 * `{ abilities, spells, items }`, each a label -> `{ uses, runs }` map:
 * `uses` is the summed count across every row, `runs` is the count of rows
 * whose own count for that label was present (i.e. >= 1 — a label is only
 * ever recorded on a row when at least one use happened, see
 * tuning-bot.mjs#tallyUsage). Label keys are inserted in ASCENDING sorted
 * order so JSON key order (and therefore JSON.stringify output) is stable
 * regardless of row iteration order. Never NaN, never missing a category.
 */
function aggregateUsage(rows) {
  const out = { abilities: {}, spells: {}, items: {} };
  for (const cat of ["abilities", "spells", "items"]) {
    const totals = {};
    for (const r of rows) {
      const catUsage = r.usage && r.usage[cat];
      if (!catUsage) continue;
      for (const label of Object.keys(catUsage)) {
        const uses = catUsage[label];
        if (!uses) continue;
        if (!totals[label]) totals[label] = { uses: 0, runs: 0 };
        totals[label].uses += uses;
        totals[label].runs += 1;
      }
    }
    for (const label of Object.keys(totals).sort()) out[cat][label] = totals[label];
  }
  return out;
}

/** mean(arr) — arithmetic mean rounded to 2 decimals, or null when arr is empty. */
function mean(arr) {
  if (!arr.length) return null;
  return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100;
}

/**
 * summarizeRows(rows) — aggregates a cell's per-run rows into the report's
 * per-cell metrics. Sorts a COPY by seed first (order-independence — the
 * result never depends on which order the rows arrived in). Every
 * depth/kill/level/actions/floors/encounters metric is computed over
 * `completed` (non-stuck) rows ONLY, and is `null` — never NaN — when there
 * are zero completed rows. `reach5`/`reach10`/`reach20` are percentages
 * (one decimal) of completed runs whose deathDepth is >= 5 / >= 10 / >= 20
 * (`reach20` added by Phase 27, TUNE-05 — same `reachPct` closure, same
 * null-in-the-zero-completed-branch discipline as reach5/reach10).
 * `topCauses` is the three most frequent `cause` strings among completed
 * runs, sorted by count desc then cause asc. `usage` (Phase 42, BAL-02) is
 * `aggregateUsage(completed)` — the ability/spell/item pick-rate tally
 * summed over the SAME completed-rows-only set every other metric here uses;
 * `{ abilities: {}, spells: {}, items: {} }` (never null) when there are
 * zero completed rows.
 */
export function summarizeRows(rows) {
  const sorted = [...rows].sort((a, b) => a.seed - b.seed);
  const completed = sorted.filter((r) => !r.stuck);
  const n = sorted.length;
  const stuckCount = n - completed.length;

  if (completed.length === 0) {
    return {
      n,
      completed: 0,
      stuck: stuckCount,
      meanDepth: null,
      p50Depth: null,
      p90Depth: null,
      reach5: null,
      reach10: null,
      reach20: null,
      meanKills: null,
      meanLevel: null,
      meanActions: null,
      meanFloorsGained: null,
      p50FloorsGained: null,
      meanEncountersSurvived: null,
      topCauses: [],
      usage: aggregateUsage([]),
    };
  }

  const depths = completed.map((r) => r.deathDepth).sort((a, b) => a - b);
  const floorsGained = completed.map((r) => r.floorsGained).sort((a, b) => a - b);
  const reachPct = (floor) => Math.round((completed.filter((r) => r.deathDepth >= floor).length / completed.length) * 1000) / 10;

  const causeCounts = {};
  for (const r of completed) causeCounts[r.cause] = (causeCounts[r.cause] || 0) + 1;
  const topCauses = Object.entries(causeCounts)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .slice(0, 3)
    .map(([cause, count]) => ({ cause, count }));

  return {
    n,
    completed: completed.length,
    stuck: stuckCount,
    meanDepth: mean(depths),
    p50Depth: percentile(depths, 0.5),
    p90Depth: percentile(depths, 0.9),
    reach5: reachPct(5),
    reach10: reachPct(10),
    reach20: reachPct(20),
    meanKills: mean(completed.map((r) => r.kills)),
    meanLevel: mean(completed.map((r) => r.level)),
    meanActions: mean(completed.map((r) => r.actions)),
    meanFloorsGained: mean(floorsGained),
    p50FloorsGained: percentile(floorsGained, 0.5),
    meanEncountersSurvived: mean(completed.map((r) => r.encountersSurvived)),
    topCauses,
    usage: aggregateUsage(completed),
  };
}

/**
 * pooledSummary(cellRows) — Phase 27's (TUNE-05) band-measurement seam:
 * `{ key: "ALL", ...summarizeRows(every cell's rows concatenated) }`, i.e.
 * the harness's OWN summarizer applied once over the full set of runs
 * rather than averaged per-cell — every pooled metric (p50Depth, p90Depth,
 * reach5/10/20, meanEncountersSurvived, p50FloorsGained,
 * meanFloorsGained, topCauses, ...) is therefore run-weighted by
 * construction and `null` (never NaN) when nothing completed. This closes
 * the exact gap Phase 26's own handoff (docs/CLASS-PASS.md `## Handoff to
 * Phase 27`) named: "the natural matrix's >= 20 rate and its overall
 * median are not carried per cell by the harness JSON." Referenced by
 * docs/DIFFICULTY-RETUNE.md's `## v1.2 retune (Phase 27)` band table's
 * "how measured" column. Additive only — no play, no rng draw, no Bot:
 * line change.
 */
export function pooledSummary(cellRows) {
  return { key: "ALL", ...summarizeRows(cellRows.flatMap(({ rows }) => rows)) };
}

/** nullLast(v) — sentinel so a null metric always sorts LAST in a desc comparator. */
function nullLast(v) {
  return v === null || v === undefined ? -Infinity : v;
}

/**
 * baseCompare(a, b) — the shared meanDepth/p50Depth/reach5-desc comparator
 * core, used by both rankCells (sub/race final tiebreak) and rollups'
 * grouped tables (key final tiebreak). Returns 0 when every one of these
 * three metrics ties, leaving the final tiebreak to the caller.
 */
function baseCompare(a, b) {
  const ad = nullLast(a.meanDepth);
  const bd = nullLast(b.meanDepth);
  if (ad !== bd) return bd - ad;
  const ap = nullLast(a.p50Depth);
  const bp = nullLast(b.p50Depth);
  if (ap !== bp) return bp - ap;
  const ar = nullLast(a.reach5);
  const br = nullLast(b.reach5);
  if (ar !== br) return br - ar;
  return 0;
}

/**
 * rankCells(cells) — a sorted COPY of `cells` (each already carrying
 * summarizeRows' metrics alongside cls/sub/race) by the documented tie-break
 * (meanDepth desc, p50Depth desc, reach5 desc, sub asc, race asc — plain
 * string comparison, not localeCompare), assigning `rank` 1..N.
 */
export function rankCells(cells) {
  const sorted = [...cells].sort((a, b) => {
    const base = baseCompare(a, b);
    if (base !== 0) return base;
    if (a.sub !== b.sub) return a.sub < b.sub ? -1 : 1;
    if (a.race !== b.race) return a.race < b.race ? -1 : 1;
    return 0;
  });
  return sorted.map((cell, i) => ({ ...cell, rank: i + 1 }));
}

/** sortByKeyTiebreak(items) — the same comparator, with `key` asc as the final tiebreak (rollups). */
function sortByKeyTiebreak(items) {
  return [...items].sort((a, b) => {
    const base = baseCompare(a, b);
    if (base !== 0) return base;
    if (a.key !== b.key) return (a.key < b.key ? -1 : 1);
    return 0;
  });
}

/**
 * groupAndSummarize(cellRows, keyFn) — concatenates every cell's rows sharing
 * the same `keyFn(cell)` value and summarizes the pooled set, returning a
 * ranked (key-asc-tiebreak) array of `{ key, ...summarizeRows(...) }`.
 */
function groupAndSummarize(cellRows, keyFn) {
  const groups = new Map();
  for (const { cell, rows } of cellRows) {
    const key = keyFn(cell);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(...rows);
  }
  const entries = Array.from(groups.entries()).map(([key, rows]) => ({ key, ...summarizeRows(rows) }));
  return sortByKeyTiebreak(entries);
}

/**
 * rollups(cellRows) — `cellRows` is `[{ cell: {cls,sub,race}, rows }]`.
 * Returns `{ byClass, bySub, byRace, pooled }`: byClass/bySub/byRace are
 * each an array of `{ key, ...summarizeRows(pooled rows) }` grouped by
 * cls/sub/race respectively and ranked by the shared tie-break (key asc
 * final tiebreak); `pooled` is `pooledSummary(cellRows)` — Phase 27's
 * (TUNE-05) single run-weighted summary over every cell's rows, key
 * `"ALL"`, added alongside (not replacing) the three grouped roll-ups.
 */
export function rollups(cellRows) {
  return {
    byClass: groupAndSummarize(cellRows, (cell) => cell.cls),
    bySub: groupAndSummarize(cellRows, (cell) => cell.sub),
    byRace: groupAndSummarize(cellRows, (cell) => cell.race),
    pooled: pooledSummary(cellRows),
  };
}

/**
 * buildReport({ cellRows, opts, commit }) — assembles the full report shape
 * documented at the top of this file. NO timing field is ever added here —
 * elapsed time is the CLI tool's own stderr-only concern.
 */
export function buildReport({ cellRows, opts, commit }) {
  const cells = rankCells(cellRows.map(({ cell, rows }) => ({ ...cell, ...summarizeRows(rows) })));
  const meta = {
    tool: "tune-classes",
    commit,
    seeds: opts.seeds,
    seedList: "i*7919+1",
    workers: opts.workers,
    maxActions: opts.maxActions,
    startDepth: opts.startDepth,
    exploreBudget: opts.exploreBudget,
    bot: botLine(opts),
    runFlags: RUN_FLAGS, // Phase 42 (BAL-01/02): additive — NOT in class-pass-diff.mjs's PARITY_FIELDS list
    cells: cellRows.length,
    excluded: EXCLUDED_CELLS,
    filter: {
      cls: opts.cls ?? null,
      sub: opts.sub ?? null,
      race: opts.race ?? null,
    },
  };
  return { meta, cells, rollups: rollups(cellRows) };
}

/** fmt(v, digits) — "n/a" for null/undefined, else a fixed-decimal string. */
function fmt(v, digits = 2) {
  return v === null || v === undefined ? "n/a" : Number(v).toFixed(digits);
}

/** causesStr(topCauses) — compact "cause(count),cause(count)" text, "-" when empty. */
function causesStr(topCauses) {
  return topCauses && topCauses.length ? topCauses.map((c) => `${c.cause}(${c.count})`).join(",") : "-";
}

/** reachStr(v) — ">=X%" column value: "n/a" for null, else one decimal. */
function reachStr(v) {
  return v === null || v === undefined ? "n/a" : v.toFixed(1);
}

/**
 * formatPooledBlock(ru, deep) — the Phase 27 (TUNE-05) `POOLED` text block:
 * a header row and one value row for `ru.pooled`, adding a `>=20%` column
 * (never added to BASE_HEADERS/rowValues, so the ranked/roll-up tables keep
 * their Phase 26 columns for visual BEFORE/AFTER comparability). Reuses
 * `fmt`/`causesStr`; never contains "fun"/"strong"/"weak".
 */
function formatPooledBlock(ru, deep) {
  const headers = ["n", "stuck", "mean", "p50", "p90", ">=5%", ">=10%", ">=20%", "kills", "lvl", "actions", ...(deep ? DEEP_HEADERS : []), "top causes"];
  const p = ru.pooled;
  const cols = [
    String(p.n),
    String(p.stuck),
    fmt(p.meanDepth),
    fmt(p.p50Depth, 1),
    fmt(p.p90Depth, 1),
    reachStr(p.reach5),
    reachStr(p.reach10),
    reachStr(p.reach20),
    fmt(p.meanKills),
    fmt(p.meanLevel),
    fmt(p.meanActions),
  ];
  if (deep) {
    cols.push(fmt(p.meanFloorsGained), fmt(p.p50FloorsGained, 1), fmt(p.meanEncountersSurvived));
  }
  cols.push(causesStr(p.topCauses));
  return ["POOLED (all cells, run-weighted over completed runs):", headers.join("  "), cols.join("  ")].join("\n");
}

const BASE_HEADERS = ["n", "stuck", "mean", "p50", "p90", ">=5%", ">=10%", "kills", "lvl", "actions"];
const DEEP_HEADERS = ["gained(mean)", "gained(p50)", "survived"];

/** rowValues(row, deep) — the metric columns shared by every table (ranked + all three roll-ups). */
function rowValues(row, deep) {
  const cols = [
    String(row.n),
    String(row.stuck),
    fmt(row.meanDepth),
    fmt(row.p50Depth, 1),
    fmt(row.p90Depth, 1),
    row.reach5 === null ? "n/a" : row.reach5.toFixed(1),
    row.reach10 === null ? "n/a" : row.reach10.toFixed(1),
    fmt(row.meanKills),
    fmt(row.meanLevel),
    fmt(row.meanActions),
  ];
  if (deep) {
    cols.push(fmt(row.meanFloorsGained), fmt(row.p50FloorsGained, 1), fmt(row.meanEncountersSurvived));
  }
  cols.push(causesStr(row.topCauses));
  return cols;
}

/** formatRankedTable(cells, deep) — the "#  class  sub  race  ...top causes" table. */
function formatRankedTable(cells, deep) {
  const headers = ["#", "class", "sub", "race", ...BASE_HEADERS, ...(deep ? DEEP_HEADERS : []), "top causes"];
  const lines = [headers.join("  ")];
  for (const c of cells) {
    lines.push([String(c.rank), c.cls, c.sub, c.race, ...rowValues(c, deep)].join("  "));
  }
  return lines.join("\n");
}

/** formatRollupTable(title, keyLabel, rows, deep) — a roll-up table (no rank column). */
function formatRollupTable(title, keyLabel, rows, deep) {
  const headers = [keyLabel, ...BASE_HEADERS, ...(deep ? DEEP_HEADERS : []), "top causes"];
  const lines = [`${title}:`, headers.join("  ")];
  for (const r of rows) {
    lines.push([r.key, ...rowValues(r, deep)].join("  "));
  }
  return lines.join("\n");
}

/**
 * formatText(report) — the deterministic text rendering of buildReport's
 * output: header line, the TUNING PROXY warning, the ranked cells table,
 * the three roll-up tables (BY CLASS / BY SUBCLASS / BY RACE), the Phase 27
 * (TUNE-05) POOLED block, a footnote per `meta.excluded` entry, the Stuck
 * bucket line, and finally `meta.bot` verbatim as the LAST line (the ledger
 * greps this exact line). No fun-band verdicts, no
 * "fun"/"strong"/"weak"/"over"/"under" editorializing anywhere — numbers
 * only (Phase 26/PLAY-02 owns editorial verdicts).
 */
export function formatText(report) {
  const { meta, cells, rollups: ru } = report;
  const deep = meta.startDepth > 1;
  const totalRuns = cells.reduce((sum, c) => sum + c.n, 0);
  const totalStuck = cells.reduce((sum, c) => sum + c.stuck, 0);

  const lines = [];
  lines.push(`tune-classes: ${meta.cells} cells x ${meta.seeds} seeds (${totalRuns} runs) — start depth ${meta.startDepth}`);
  lines.push("(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)");
  lines.push("");
  lines.push(formatRankedTable(cells, deep));
  lines.push("");
  lines.push(formatRollupTable("BY CLASS", "class", ru.byClass, deep));
  lines.push("");
  lines.push(formatRollupTable("BY SUBCLASS", "sub", ru.bySub, deep));
  lines.push("");
  lines.push(formatRollupTable("BY RACE", "race", ru.byRace, deep));
  lines.push("");
  lines.push(formatPooledBlock(ru, deep));
  lines.push("");
  for (const ex of meta.excluded) {
    lines.push(`* ${ex.cls} ${ex.sub} ${ex.race} omitted: ${ex.reason}`);
  }
  lines.push(
    `Stuck: ${totalStuck} of ${totalRuns} runs hit maxActions=${meta.maxActions} (own bucket; excluded from depth stats)`,
  );
  lines.push(meta.bot);
  return lines.join("\n");
}

// --- formatUsageMarkdown (Phase 42, BAL-02) ---------------------------------
//
// A SEPARATE renderer from formatText's ledger-pasted transcript shape — the
// BEFORE/AFTER text matrix format stays byte-for-byte unchanged; this is the
// new pick-rate table BAL-02 needs. mdRow/mdTable are a local copy of
// tools/class-pass-diff.mjs's own tiny Markdown helpers (that script
// deliberately never imports content/tools-internal modules, so the two
// copies stay independent rather than one importing the other).

/** mdRow(cells) — one Markdown table row. */
function mdRow(cells) {
  return `| ${cells.join(" | ")} |`;
}

/** mdTable(headers, rows) — a full Markdown table (header + --- separator + rows). */
function mdTable(headers, rows) {
  const lines = [mdRow(headers), mdRow(headers.map(() => "---"))];
  for (const r of rows) lines.push(mdRow(r));
  return lines.join("\n");
}

/** usageRate(uses, eligible) — fixed 2-decimal rate string; "0.00" when eligible is 0 (never NaN). */
function usageRate(uses, eligible) {
  return eligible > 0 ? (uses / eligible).toFixed(2) : "0.00";
}

/**
 * eligibleForClass(report, cls) — the pooled completed-run count over every
 * cell of class `cls`, read straight off `report.rollups.byClass` (which
 * already carries a run-weighted `completed` sum per class) rather than
 * re-deriving it from `report.cells`.
 */
function eligibleForClass(report, cls) {
  const row = report.rollups && report.rollups.byClass ? report.rollups.byClass.find((r) => r.key === cls) : null;
  return row ? row.completed : 0;
}

/**
 * usageEntry(report, cat, label) — `{ uses, runs }` for one pooled usage
 * label, `{ uses: 0, runs: 0 }` when the report carries no `usage` at all
 * (an older report — e.g. the BEFORE pin) or the label was never used.
 */
function usageEntry(report, cat, label) {
  const pooled = report.rollups && report.rollups.pooled && report.rollups.pooled.usage;
  return (pooled && pooled[cat] && pooled[cat][label]) || { uses: 0, runs: 0 };
}

/**
 * formatUsageMarkdown(report) — Phase 42 (BAL-02): the pick-rate Markdown
 * BAL-02's "pick-rates for every new spell/ability" number is machine-
 * rendered from, never retyped by hand. Reads `report.rollups.pooled.usage`
 * (present once this plan's `summarizeRows` has run over a fresh JSON
 * report) and `report.rollups.byClass`/`bySub` for the per-class/per-sub
 * denominators and top-picks breakdown; a report carrying NO `usage` field
 * at all (an older report, e.g. the v1.5 BEFORE pin) renders every table
 * with zero uses and 0.00 rates — never throws, never NaN.
 *
 * Four H3 sections, in this exact order:
 *   1. `### Pick-rates — abilities` — one row per `ABILITIES` catalog entry
 *      (catalog order): Ability, Class, Uses, Runs used, Eligible runs (the
 *      ability's own class's pooled completed-run count via
 *      `eligibleForClass`), Uses / eligible run.
 *   2. `### Pick-rates — spells` — one row per `SPELLS` table entry (table
 *      order): Spell, Uses, Runs used, Eligible runs (Magic User's pooled
 *      completed-run count), Uses / eligible run.
 *   3. `### Pick-rates — items` — one row per label ever seen in
 *      `pooled.usage.items`, sorted by uses desc then label asc: Item, Uses,
 *      Runs used, Eligible runs (every completed run, pooled — items are
 *      usable by any class), Uses / eligible run.
 *   4. `### Top picks by sub-class` — one row per `rollups.bySub` entry (its
 *      own rank order): Sub-class, the top three `label (uses/runs)` picks
 *      across abilities+spells+items combined for that sub (uses desc, ties
 *      by label asc), joined ", " — "-" when the sub used nothing at all.
 */
export function formatUsageMarkdown(report) {
  const lines = [];

  const abilityRows = ABILITIES.map((a) => {
    const { uses, runs } = usageEntry(report, "abilities", a.id);
    const eligible = eligibleForClass(report, a.cls);
    return [a.name, a.cls, String(uses), String(runs), String(eligible), usageRate(uses, eligible)];
  });
  lines.push("### Pick-rates — abilities");
  lines.push(mdTable(["Ability", "Class", "Uses", "Runs used", "Eligible runs", "Uses / eligible run"], abilityRows));
  lines.push("");

  const spellEligible = eligibleForClass(report, "Magic User");
  const spellRows = SPELLS.map((sp) => {
    const { uses, runs } = usageEntry(report, "spells", sp.n);
    return [sp.n, String(uses), String(runs), String(spellEligible), usageRate(uses, spellEligible)];
  });
  lines.push("### Pick-rates — spells");
  lines.push(mdTable(["Spell", "Uses", "Runs used", "Eligible runs", "Uses / eligible run"], spellRows));
  lines.push("");

  const pooled = report.rollups && report.rollups.pooled;
  const pooledUsage = (pooled && pooled.usage) || { abilities: {}, spells: {}, items: {} };
  const itemEligible = (pooled && pooled.completed) || 0;
  const itemEntries = Object.entries(pooledUsage.items || {}).sort(
    (a, b) => b[1].uses - a[1].uses || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0),
  );
  const itemRows = itemEntries.map(([label, { uses, runs }]) => [
    label,
    String(uses),
    String(runs),
    String(itemEligible),
    usageRate(uses, itemEligible),
  ]);
  lines.push("### Pick-rates — items");
  lines.push(mdTable(["Item", "Uses", "Runs used", "Eligible runs", "Uses / eligible run"], itemRows));
  lines.push("");

  const bySub = (report.rollups && report.rollups.bySub) || [];
  const subRows = bySub.map((sub) => {
    const usage = sub.usage || { abilities: {}, spells: {}, items: {} };
    const combined = [];
    for (const cat of ["abilities", "spells", "items"]) {
      for (const [label, v] of Object.entries(usage[cat] || {})) combined.push({ label, uses: v.uses, runs: v.runs });
    }
    combined.sort((a, b) => b.uses - a.uses || (a.label < b.label ? -1 : a.label > b.label ? 1 : 0));
    const top3 = combined.slice(0, 3).map((p) => `${p.label} (${p.uses}/${p.runs})`);
    return [sub.key, top3.length ? top3.join(", ") : "-"];
  });
  lines.push("### Top picks by sub-class");
  lines.push(mdTable(["Sub-class", "Top picks (uses/runs)"], subRows));

  return lines.join("\n");
}
