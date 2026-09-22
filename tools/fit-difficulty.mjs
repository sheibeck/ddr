#!/usr/bin/env node
// tools/fit-difficulty.mjs
//
// TUNING FIT — not a gate; the fair bot's solo run is the objective; the
// class smoke is run by 54-04 (BEFORE) and 54-07 (AFTER) only.
//
// Dev-only, zero-dependency Node ESM script — NOT shipped (tools/build-www.mjs's
// copy list never references tools/ or tools/lib/), NOT a node:test file (it
// makes no assertions, so `node --test` never picks it up).
//
// Phase 54 (BAND-02, 2026-09-21, USER RULING D / plan-approval cuts; USER
// RULING G "Adjustment 3", mid-54-07 cycle 3): the in-process,
// worker-threaded, deterministic, logged evaluator and bounded coordinate
// search over tools/lib/fit-score.mjs's SEARCH_PLAN (the core 10; every
// OTHER dial, including CLASS_MITIGATION["Magic User"].spellPower — USER
// RULING G dropped it back out of the search after cycle 2 proved it a
// structural no-op — is HELD at its `--start` value, never probed). Each
// evaluation plays the fair bot's SOLO 200-seed run (the SAME seed list
// tune-difficulty.mjs uses, `i*7919+1`) in-process across worker threads:
// each worker imports the engine fresh (via tools/lib/tuning-bot.mjs),
// calls setDialsForTuning(candidate) ONCE, then plays its own seed slice
// through playRun — no engine state ever crosses a thread boundary, only
// plain-object rows.
//
// The replay/resume/coordinate-walk machinery (readLog/appendLog/
// makeResumableEvaluate/walkCoordinate/runSearch) lives in the PURE,
// engine-free tools/lib/fit-resume.mjs — see that module's header for the
// Infinity/null replay bug USER RULING G "Adjustment 3(c)" fixes there.
//
// Run:
//   node tools/fit-difficulty.mjs --dials=fit/start.json --seeds=200 --workers=4
//   node tools/fit-difficulty.mjs --dials='{}' --seeds=20            (identity)
//   node tools/fit-difficulty.mjs --search --start=fit/start.json --budget=80 --out=fit/best.json
//
// A backgrounded `--search` run's stdout should always be redirected with
// `>>` (append), never `>` (truncate) — USER RULING G "Adjustment 3(d)": a
// multi-block cycle re-runs this same command with a growing `--budget`
// against the SAME `--log`, and a truncating redirect would silently
// discard every earlier block's console transcript on each re-run.
//
// Flags:
//   --dials=<json|path>   a single evaluation against this partial DIALS
//                         override (inline JSON or a path to a JSON file)
//   --search              bounded coordinate descent (see the module header
//                         of tools/lib/fit-score.mjs#SEARCH_PLAN)
//   --start=<path>        the search's starting dial set (default: DIALS
//                         identity, i.e. `{}`)
//   --budget=N            max evaluations for --search (default 80)
//   --seeds=N              seeds per evaluation (default 200)
//   --workers=N            worker_threads count (default 4)
//   --log=<path.jsonl>     append every evaluation as one JSON line here
//                          (an existing log RESUMES a --search run; ALWAYS
//                          redirect this script's own stdout with >>, never
//                          >, when re-running against a growing --budget)
//   --out=<path>           write the best (or the single evaluation's) dial
//                          set as JSON here
//   --max-actions=N        per-run action cap (default BOT_DEFAULTS.maxActions)

import fs from "node:fs";
import path from "node:path";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";

import { playRun, BOT_DEFAULTS } from "./lib/tuning-bot.mjs";
import { survivalReadout, classIdentityReadout, paceReadout } from "./lib/band-readout.mjs";
import { setDialsForTuning } from "../engine/difficulty.js";
import { SEARCH_PLAN, scoreSurvival, classConstraints, applyStep, evalRow, formatEvalLine } from "./lib/fit-score.mjs";
import { readLog, appendLog, makeResumableEvaluate, runSearch } from "./lib/fit-resume.mjs";

// --- worker thread branch ---------------------------------------------------
//
// Each worker is a FRESH module instance (worker_threads gives every worker
// its own isolated V8 context and module registry) — setDialsForTuning's
// `live` override is process-local, so calling it once per worker before
// playing that worker's seed slice can never leak across workers or across
// evaluations. The main thread never imports engine/difficulty.js's
// setDialsForTuning for anything but the identity-equivalence dry-run check
// below — it never itself evaluates a candidate.

if (!isMainThread) {
  const { dials, seeds, opts } = workerData;
  setDialsForTuning(dials);
  const rows = seeds.map((seed) => {
    const { state, ...rest } = playRun(seed, opts);
    return rest;
  });
  parentPort.postMessage(rows);
}

// --- seed list (identical to tune-difficulty.mjs's own) --------------------

function seedList(n) {
  return Array.from({ length: n }, (_, i) => i * 7919 + 1);
}

// --- in-process worker evaluation of ONE candidate --------------------------

/** playSeedsWithWorkers(dials, seeds, opts, workerCount) — splits `seeds` into
 * `workerCount` CONTIGUOUS slices, plays each slice in its own worker, and
 * concatenates in slice order (never completion order) — deterministic
 * regardless of `--workers` or OS scheduling. */
function playSeedsWithWorkers(dials, seeds, opts, workerCount) {
  return new Promise((resolve, reject) => {
    const poolSize = Math.max(1, Math.min(workerCount, seeds.length));
    const sliceSize = Math.ceil(seeds.length / poolSize);
    const slices = [];
    for (let i = 0; i < poolSize; i++) {
      const slice = seeds.slice(i * sliceSize, (i + 1) * sliceSize);
      if (slice.length) slices.push(slice);
    }
    const rowsBySlice = new Array(slices.length);
    let done = 0;
    let settled = false;
    if (!slices.length) {
      resolve([]);
      return;
    }
    slices.forEach((slice, i) => {
      const worker = new Worker(new URL(import.meta.url), { workerData: { dials, seeds: slice, opts } });
      worker.on("message", (rows) => {
        rowsBySlice[i] = rows;
        worker.terminate();
        done++;
        if (done === slices.length && !settled) {
          settled = true;
          resolve(rowsBySlice.flat());
        }
      });
      worker.on("error", (err) => {
        if (!settled) {
          settled = true;
          reject(err);
        }
      });
    });
  });
}

/**
 * evaluateCandidate(dials, seeds, opts, workerCount) — plays the solo run,
 * builds the survival/class-identity/pace readouts (band-readout.mjs, the
 * SAME functions tune-difficulty.mjs's --json output reads), scores it
 * (fit-score.mjs), and returns the pieces evalRow needs.
 */
async function evaluateCandidate(dials, seeds, opts, workerCount) {
  const startedAt = Date.now();
  const rows = await playSeedsWithWorkers(dials, seeds, opts, workerCount);
  const survival = survivalReadout(rows, opts);
  const scored = scoreSurvival(survival);
  const classIdentity = classIdentityReadout(rows);
  const constraints = classConstraints(classIdentity);
  const pace = paceReadout(rows);
  const elapsedMs = Date.now() - startedAt;
  return { survival, scored, classIdentity, constraints, pace, elapsedMs };
}

// --- CLI ---------------------------------------------------------------------

function usage() {
  return [
    "Usage: node tools/fit-difficulty.mjs [options]",
    "  --dials=<json|path>  a single evaluation against this partial DIALS override",
    "  --search              bounded coordinate descent: Ruling F's spellPower coordinate first, then the core 10",
    "  --start=<path>        the search's starting dial set (default: {})",
    "  --budget=N            max evaluations for --search (default 80)",
    "  --seeds=N             seeds per evaluation (default 200)",
    "  --workers=N           worker_threads count (default 4)",
    "  --log=<path.jsonl>    append every evaluation as one JSON line (resumable)",
    "  --out=<path>          write the best/single dial set as JSON here",
    "  --max-actions=N       per-run action cap (default BOT_DEFAULTS.maxActions)",
  ].join("\n");
}

function fail(msg) {
  process.stderr.write(`${msg}\n${usage()}\n`);
  process.exit(2);
}

function readJsonArg(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);
  return JSON.parse(fs.readFileSync(trimmed, "utf8"));
}

function parseArgs(argv) {
  const opts = {
    dials: null,
    search: false,
    start: null,
    budget: 80,
    seeds: 200,
    workers: 4,
    log: null,
    out: null,
    maxActions: BOT_DEFAULTS.maxActions,
  };
  for (const arg of argv) {
    const eqIdx = arg.indexOf("=");
    const flag = eqIdx === -1 ? arg : arg.slice(0, eqIdx);
    const value = eqIdx === -1 ? null : arg.slice(eqIdx + 1);
    switch (flag) {
      case "--dials":
        opts.dials = value;
        break;
      case "--search":
        opts.search = true;
        break;
      case "--start":
        opts.start = value;
        break;
      case "--budget":
        opts.budget = parseInt(value, 10);
        break;
      case "--seeds":
        opts.seeds = parseInt(value, 10);
        break;
      case "--workers":
        opts.workers = parseInt(value, 10);
        break;
      case "--log":
        opts.log = value;
        break;
      case "--out":
        opts.out = value;
        break;
      case "--max-actions":
        opts.maxActions = parseInt(value, 10);
        break;
      default:
        fail(`Unknown flag: ${flag}`);
    }
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const botOpts = { ...BOT_DEFAULTS, maxActions: opts.maxActions };
  const seeds = seedList(opts.seeds);

  if (!opts.search) {
    // --- single evaluation -------------------------------------------------
    const dials = opts.dials === null ? {} : readJsonArg(opts.dials);
    const result = await evaluateCandidate(dials, seeds, botOpts, opts.workers);
    const row = evalRow(1, dials, { ...result, walkPass: 1 });
    console.log(formatEvalLine(row));
    appendLog(opts.log, row);
    if (opts.out) {
      const dir = path.dirname(opts.out);
      if (dir && dir !== ".") fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(opts.out, JSON.stringify(dials, null, 2));
    }
    process.stderr.write(`elapsed: ${(result.elapsedMs / 1000).toFixed(1)}s  workers=${opts.workers}  seeds=${opts.seeds}\n`);
    process.exit(0);
    return;
  }

  // --- --search: bounded coordinate descent, resumable -----------------------
  const startDials = opts.start ? readJsonArg(opts.start) : {};
  const loggedByN = readLog(opts.log);
  if (loggedByN.size) {
    appendLog(opts.log, { resumed: true, fromN: Math.max(...loggedByN.keys()) });
  }

  const startedAt = Date.now();
  const evaluate = makeResumableEvaluate({
    loggedByN,
    budget: opts.budget,
    onRow: (row) => {
      console.log(formatEvalLine(row));
      appendLog(opts.log, row);
    },
    realEvaluate: async (candN, dials) => {
      const result = await evaluateCandidate(dials, seeds, botOpts, opts.workers);
      return evalRow(candN, dials, { ...result, walkPass: 1 });
    },
  });
  let n = 0;
  const countingEvaluate = async (dials) => {
    const row = await evaluate(dials);
    if (row) n = row.n;
    return row;
  };

  const { best, stopped } = await runSearch({ startDials, evaluate: countingEvaluate, searchPlan: SEARCH_PLAN, applyStep });

  if (best) {
    console.log(`BEST #${best.n} score=${best.score === Infinity ? "+Infinity" : best.score.toFixed(4)} dials=${JSON.stringify(best.dials)}`);
    if (opts.out) {
      const dir = path.dirname(opts.out);
      if (dir && dir !== ".") fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(opts.out, JSON.stringify(best.dials, null, 2));
    }
  } else {
    console.log("BEST: none (budget exhausted before the first evaluation completed)");
  }
  process.stderr.write(`elapsed: ${((Date.now() - startedAt) / 1000).toFixed(1)}s  workers=${opts.workers}  evaluations=${n}  stopped=${stopped}\n`);
  process.exit(0);
}

if (isMainThread) {
  main();
}
