#!/usr/bin/env node
// tools/tune-classes.mjs
//
// Dev-only, zero-dependency Node ESM script — NOT shipped (see
// tools/build-www.mjs's copy list, which never references this file or
// tools/lib/*.mjs), NOT a node:test file (it makes no assertions, so
// `node --test` never picks it up).
//
// THIS IS A TUNING PROXY, NOT A PASS/FAIL GATE, and NOT a substitute for a
// human playtest — a heuristic bot's play skill is arbitrary (see
// tools/lib/tuning-bot.mjs's own header). Do not gate any build or CI check
// on this script's output; read the ranked matrix as a rough sanity signal
// while identity-pass work (Phases 23-24) and the mass playtest (Phase 26)
// give it a corrected yardstick.
//
// Run:
//   node tools/tune-classes.mjs
//   node tools/tune-classes.mjs --seeds 40 --workers 4 --out docs/class-pass/before.json
//   node tools/tune-classes.mjs --start-depth 20 --seeds 10
//   node tools/tune-classes.mjs --sub Summoner --race Troll --seeds 5
//   node tools/tune-classes.mjs --json
//
// JSON SHAPE (see tools/lib/class-matrix.mjs's header for the full contract):
//   {
//     meta: { tool: "tune-classes", commit, seeds, seedList: "i*7919+1",
//       workers, maxActions, startDepth, exploreBudget, bot, cells,
//       excluded, filter: { cls, sub, race } },
//     cells: [{ rank, cls, sub, race, n, completed, stuck, meanDepth,
//       p50Depth, p90Depth, reach5, reach10, reach20, meanKills, meanLevel,
//       meanActions, meanFloorsGained, p50FloorsGained,
//       meanEncountersSurvived, topCauses }],
//     rollups: { byClass, bySub, byRace, pooled }
//   }
// `reach20` (per cell) and `rollups.pooled` (key "ALL", the full
// summarizeRows shape over every cell's rows, run-weighted) are Phase 27's
// (TUNE-05) additive band readout — see tools/lib/class-matrix.mjs's header
// and docs/DIFFICULTY-RETUNE.md's `## v1.2 retune (Phase 27)`.
// NO timing field ever appears in this shape — elapsed time is printed to
// STDERR ONLY (`elapsed: <seconds>s  workers=<n>  runs=<cells*seeds>`), so a
// BEFORE/AFTER JSON snapshot pair diffs cleanly (22-CONTEXT.md, Claude's
// Discretion).
//
// RANKING TIE-BREAK (see tools/lib/class-matrix.mjs's header — documented
// once, transcribed here so the ledger can cite either file): meanDepth
// desc (null last), p50Depth desc, reach5 desc, then sub asc, then race asc.
//
// WORK DISTRIBUTION (Claude's Discretion, 22-CONTEXT.md): work is
// distributed BY CELL through a main-thread queue — each worker plays a
// whole cell's full seed list and returns compact per-run rows; the main
// thread only aggregates (rankCells/rollups/buildReport), so p50/p90 and
// roll-ups are true percentiles over runs and the output is
// scheduling-independent (byte-identical `cells`/`rollups` regardless of
// `--workers`). No engine state ever crosses a thread boundary — each
// worker imports the engine (via tools/lib/tuning-bot.mjs) and plays its
// own runs from scratch; only plain-object `{ idx, cell, rows }` messages
// are exchanged.

import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, renameSync } from "node:fs";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";

import { playRun, BOT_DEFAULTS } from "./lib/tuning-bot.mjs";
import { selectCells, seedList, rowFromRun, resolveForce, buildReport, formatText } from "./lib/class-matrix.mjs";

// --- shared cell-playing helper (used by the main thread's inline path AND every worker) ---

/** playCell(cell, seeds, opts) — plays every seed against one forced cell, returning compact rows. */
function playCell(cell, seeds, opts) {
  return seeds.map((seed) => rowFromRun(playRun(seed, { ...opts, force: cell })));
}

// --- worker thread branch ---------------------------------------------------

if (!isMainThread) {
  const { opts, seeds } = workerData;
  parentPort.on("message", ({ idx, cell }) => {
    const rows = playCell(cell, seeds, opts);
    parentPort.postMessage({ idx, cell, rows });
  });
}

// --- CLI (main thread only) --------------------------------------------------

function usage() {
  return [
    "Usage: node tools/tune-classes.mjs [options]",
    "  --seeds N          paired seeds per cell, i*7919+1 (default 40, >= 1)",
    "  --workers N        worker_threads count (default os.availableParallelism(), >= 1)",
    "  --max-actions N    per-run action cap (default 5000, >= 1)",
    "  --start-depth N    dev-only deep start (default 1, >= 1)",
    "  --explore-budget N actions explored per floor before heading to the exit (default 50, >= 0)",
    "  --cls X            force this class (case-insensitive)",
    "  --sub X            force this subclass (case-insensitive)",
    "  --race X           force this race (case-insensitive)",
    "  --json             print the JSON report instead of the text matrix",
    "  --out PATH         also write the JSON report atomically to PATH",
  ].join("\n");
}

function fail(msg) {
  process.stderr.write(`${msg}\n${usage()}\n`);
  process.exit(2);
}

/** parseArgs(argv) — accepts both `--flag value` and `--flag=value` forms. */
function parseArgs(argv) {
  const opts = {
    ...BOT_DEFAULTS,
    seeds: 40,
    workers: os.availableParallelism(),
    maxActions: 5000,
    startDepth: 1,
    json: false,
    out: null,
    cls: null,
    sub: null,
    race: null,
  };

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      fail(`Unrecognized argument: ${arg}`);
    }
    const eqIdx = arg.indexOf("=");
    const flag = eqIdx === -1 ? arg : arg.slice(0, eqIdx);
    const inlineValue = eqIdx === -1 ? null : arg.slice(eqIdx + 1);
    const nextValue = () => {
      if (inlineValue !== null) return inlineValue;
      i++;
      if (i >= argv.length) fail(`${flag} requires a value`);
      return argv[i];
    };
    const intFlag = (min) => {
      const n = parseInt(nextValue(), 10);
      if (!Number.isFinite(n) || n < min) fail(`${flag} must be an integer >= ${min}`);
      return n;
    };

    switch (flag) {
      case "--seeds":
        opts.seeds = intFlag(1);
        break;
      case "--workers":
        opts.workers = intFlag(1);
        break;
      case "--max-actions":
        opts.maxActions = intFlag(1);
        break;
      case "--start-depth":
        opts.startDepth = intFlag(1);
        break;
      case "--explore-budget":
        opts.exploreBudget = intFlag(0);
        break;
      case "--cls":
        opts.cls = nextValue();
        break;
      case "--sub":
        opts.sub = nextValue();
        break;
      case "--race":
        opts.race = nextValue();
        break;
      case "--json":
        opts.json = true;
        break;
      case "--out":
        opts.out = nextValue();
        break;
      default:
        fail(`Unknown flag: ${flag}`);
    }
    i++;
  }
  return opts;
}

/**
 * runWithWorkers(cells, seeds, opts, workerCount) — a main-thread queue over
 * `worker_threads`: spawns `min(workerCount, cells.length)` same-file
 * workers, hands each an unclaimed cell index at a time, and resolves with
 * `cellRows` in ENUMERATION order (not completion order) once every cell
 * has returned. No engine state crosses threads — only `{ idx, cell }` /
 * `{ idx, cell, rows }` plain-object messages.
 */
function runWithWorkers(cells, seeds, opts, workerCount) {
  return new Promise((resolve, reject) => {
    const poolSize = Math.min(workerCount, cells.length);
    const cellRows = new Array(cells.length);
    let nextIndex = 0;
    let doneCount = 0;
    let settled = false;

    const settleError = (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    const assignNext = (worker) => {
      if (nextIndex >= cells.length) {
        worker.terminate();
        return;
      }
      const idx = nextIndex++;
      worker.postMessage({ idx, cell: cells[idx] });
    };

    for (let w = 0; w < poolSize; w++) {
      const worker = new Worker(new URL(import.meta.url), { workerData: { opts, seeds } });
      worker.on("message", (msg) => {
        cellRows[msg.idx] = { cell: cells[msg.idx], rows: msg.rows };
        doneCount++;
        if (doneCount === cells.length) {
          settled = true;
          resolve(cellRows);
        } else {
          assignNext(worker);
        }
      });
      worker.on("error", settleError);
      assignNext(worker);
    }
  });
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  // Resolve --cls/--sub/--race BEFORE any newRun — this is where a Fridgian
  // Samurai (or an unknown name) is refused (HARN-01's CLI half).
  let force = null;
  try {
    force = resolveForce({
      cls: opts.cls === null ? undefined : opts.cls,
      sub: opts.sub === null ? undefined : opts.sub,
      race: opts.race === null ? undefined : opts.race,
    });
  } catch (e) {
    process.stderr.write(`${e.message}\n`);
    process.exit(2);
  }
  // Record the CANONICAL resolved values (or null) so meta.filter and the
  // Bot: line's downstream consumers see the exact strings, not raw CLI text.
  opts.cls = force?.cls ?? null;
  opts.sub = force?.sub ?? null;
  opts.race = force?.race ?? null;

  const startedAt = Date.now();
  const cells = selectCells(force);
  const seeds = seedList(opts.seeds);

  let cellRows;
  if (opts.workers === 1 || cells.length === 1) {
    // Inline path — same playCell function a worker uses, just called
    // directly, so a --workers 1 run and any single-cell spot check never
    // pay worker_threads startup cost.
    cellRows = cells.map((cell) => ({ cell, rows: playCell(cell, seeds, opts) }));
  } else {
    try {
      cellRows = await runWithWorkers(cells, seeds, opts, opts.workers);
    } catch (err) {
      console.error(err);
      process.exit(1);
      return;
    }
  }

  let commit = "unknown";
  try {
    commit = execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    // dev machine without git history reachable — "unknown" is an honest fallback.
  }

  const report = buildReport({ cellRows, opts, commit });

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatText(report));
  }

  if (opts.out) {
    const dir = path.dirname(opts.out);
    mkdirSync(dir, { recursive: true });
    const tmpPath = `${opts.out}.tmp`;
    writeFileSync(tmpPath, JSON.stringify(report, null, 2));
    renameSync(tmpPath, opts.out); // written ONCE, after every worker has returned
  }

  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  process.stderr.write(`elapsed: ${elapsedSec}s  workers=${opts.workers}  runs=${cells.length * opts.seeds}\n`);
  process.exit(0);
}

if (isMainThread) {
  main();
}
