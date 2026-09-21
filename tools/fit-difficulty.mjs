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
// RULING F "Adjustment 1"/"Adjustment 1b", mid-54-07): the in-process,
// worker-threaded, deterministic, logged evaluator and bounded coordinate
// search over tools/lib/fit-score.mjs's SEARCH_PLAN (Ruling F's coordinate,
// CLASS_MITIGATION["Magic User"].spellPower, probed FIRST, then the core 10
// — every OTHER dial is HELD at its `--start` value, never probed). Each
// evaluation plays the
// fair bot's SOLO 200-seed run (the SAME seed list tune-difficulty.mjs
// uses, `i*7919+1`) in-process across worker
// threads: each worker imports the engine fresh (via tools/lib/tuning-bot.mjs),
// calls setDialsForTuning(candidate) ONCE, then plays its own seed slice
// through playRun — no engine state ever crosses a thread boundary, only
// plain-object rows.
//
// Run:
//   node tools/fit-difficulty.mjs --dials=fit/start.json --seeds=200 --workers=4
//   node tools/fit-difficulty.mjs --dials='{}' --seeds=20            (identity)
//   node tools/fit-difficulty.mjs --search --start=fit/start.json --budget=80 --out=fit/best.json
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
//                          (an existing log RESUMES a --search run)
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

// --- coordinate-descent search (bounded, deterministic, resumable) ---------

/**
 * walkCoordinate(current, currentScore, coord, stepScale, evaluate) — probes
 * `+1` first (skipped if applyStep returns null, i.e. already at the
 * bound); if the score strictly improves, accepts and keeps stepping the
 * SAME direction (up to 2 more times, 3 total) while it keeps improving;
 * otherwise probes `-1` the same way. Returns `{ current, score, stop,
 * passed }` — `stop: true` means the budget ran out (evaluate returned
 * `null`) or a PASS+ok candidate was found (`passed: true`).
 */
async function walkCoordinate(current, currentScore, coord, stepScale, evaluate) {
  for (const dir of [1, -1]) {
    let base = current;
    let baseScore = currentScore;
    let steps = 0;
    let improvedAny = false;
    while (steps < 3) {
      const probe = applyStep(base, coord, dir, stepScale);
      if (probe === null) break;
      const row = await evaluate(probe);
      if (row === null) return { current: base, score: baseScore, stop: true, passed: false };
      steps++;
      if (row.score < baseScore) {
        base = probe;
        baseScore = row.score;
        improvedAny = true;
        if (row.verdict === "PASS" && row.constraints.ok) {
          return { current: base, score: baseScore, stop: true, passed: true };
        }
      } else {
        break;
      }
    }
    if (improvedAny) return { current: base, score: baseScore, stop: false, passed: false };
  }
  return { current, score: currentScore, stop: false, passed: false };
}

/**
 * runSearch({ startDials, budget, evaluate }) — PASS 1 over SEARCH_PLAN's 10
 * coordinates (in order, full step), then PASS 2 (the same 10, stepScale
 * 0.5). Every held dial is carried through untouched from `startDials`
 * (walkCoordinate/applyStep only ever touch the ONE coordinate's own path).
 * Stops early on budget exhaustion or a PASS+ok candidate.
 */
async function runSearch({ startDials, evaluate }) {
  const startRow = await evaluate(startDials);
  if (startRow === null) return { best: null, stopped: "budget" };
  let best = startRow;
  let current = startDials;
  let currentScore = startRow.score;
  if (startRow.verdict === "PASS" && startRow.constraints.ok) return { best: startRow, stopped: "pass" };

  const trackBest = async (dials) => {
    const row = await evaluate(dials);
    if (row && row.score < best.score) best = row;
    return row;
  };

  for (const pass of [1, 2]) {
    const stepScale = pass === 1 ? 1 : 0.5;
    for (const coord of SEARCH_PLAN) {
      const result = await walkCoordinate(current, currentScore, coord, stepScale, trackBest);
      current = result.current;
      currentScore = result.score;
      if (result.stop) return { best, stopped: result.passed ? "pass" : "budget" };
    }
  }
  return { best, stopped: "plan-exhausted" };
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

/** appendLog(logPath, row) — appends ONE JSON line (JSONL, append-only). No-op when `logPath` is null. */
function appendLog(logPath, obj) {
  if (!logPath) return;
  const dir = path.dirname(logPath);
  if (dir && dir !== ".") fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(logPath, `${JSON.stringify(obj)}\n`);
}

/** readLog(logPath) — every already-logged evaluation row, keyed by `n` (a Map), or an empty Map if the file does not exist. */
function readLog(logPath) {
  const byN = new Map();
  if (!logPath || !fs.existsSync(logPath)) return byN;
  const lines = fs.readFileSync(logPath, "utf8").split("\n").filter(Boolean);
  for (const line of lines) {
    const obj = JSON.parse(line);
    if (typeof obj.n === "number") byN.set(obj.n, obj);
  }
  return byN;
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

  let n = 0;
  const startedAt = Date.now();
  const evaluate = async (dials) => {
    n++;
    if (n > opts.budget) return null;
    const logged = loggedByN.get(n);
    if (logged && JSON.stringify(logged.dials) === JSON.stringify(dials)) {
      // Deterministic replay: the SAME walk produces the SAME nth candidate
      // — reuse the logged row verbatim, spending zero bot time.
      return logged;
    }
    const result = await evaluateCandidate(dials, seeds, botOpts, opts.workers);
    const row = evalRow(n, dials, { ...result, walkPass: 1 });
    console.log(formatEvalLine(row));
    appendLog(opts.log, row);
    return row;
  };

  const { best, stopped } = await runSearch({ startDials, evaluate });

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
