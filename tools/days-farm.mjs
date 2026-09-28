#!/usr/bin/env node
// tools/days-farm.mjs
//
// Dev-only, zero-dependency Node ESM CLI. NOT shipped (build-www.mjs never
// copies tools/ into www/), NOT a node:test file (it makes no assertions, so
// `node --test` never picks it up).
//
// THIS IS A TUNING PROXY, NOT A PASS/FAIL GATE — same status as every other
// tools/lib/tuning-bot.mjs consumer. Phase 82's ONE exploit measurement: does
// a hero who never leaves floor 1 (and, as a follow-up, floor 2) bank more
// DAYS than an honest descending run? This is the documented exception to
// the "bots only at milestone end" convention — the engine does not change
// this milestone, so measuring now (rather than waiting for the milestone
// close) reads the same final rules a later measurement would.
//
// Run:
//   node tools/days-farm.mjs --seeds=200 --farm-floor=1,2 --json --out=docs/days-farming/days-farm.json
//   node tools/days-farm.mjs --seeds=4                       (smoke)
//   node tools/days-farm.mjs --from=docs/days-farming/days-farm.json
//
// WORK DISTRIBUTION: work is distributed BY RUN (not by cell/seed-list, since
// each honest/farm-floor/variant/seed combination is its own independent
// unit) through a main-thread queue — a worker plays ONE unit (playHonestRun
// or playFarmRun; the farmer policy closure is built INSIDE playFarmRun, so
// no function ever crosses the worker_threads boundary) and posts
// `{idx, row}` back. The main thread re-assembles honest/farm rows by
// iterating the SAME `units` array in its original construction order (all
// honest seeds, then each farm floor ascending, each variant in
// FARM_VARIANTS order, then all seeds) — never completion order — so output
// is scheduling-independent (byte-identical `--workers=1` vs `--workers=N`).
// `--workers=1` skips worker_threads entirely (an inline loop) so a small
// spot-check never pays startup cost.

import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, renameSync, readFileSync } from "node:fs";
import { Worker, isMainThread, parentPort } from "node:worker_threads";

import { BOT_DEFAULTS, RUN_FLAGS } from "./lib/tuning-bot.mjs";
import { FARM_CAPS, FARM_VARIANTS, CLOCK_WINDOW, BREAKER_LIMIT, playHonestRun, playFarmRun, buildFarmReport, formatFarmReport } from "./lib/days-farm.mjs";
import { seedList } from "./lib/class-matrix.mjs";

/** playUnit(unit) — plays exactly one work unit, shared by the inline path AND every worker. */
function playUnit(unit) {
  if (unit.kind === "honest") return playHonestRun(unit.seed);
  return playFarmRun(unit.seed, { variant: unit.variant, farmFloor: unit.farmFloor, maxActions: unit.maxActions, maxDays: unit.maxDays });
}

// --- worker thread branch ---------------------------------------------------

if (!isMainThread) {
  parentPort.on("message", (unit) => {
    const row = playUnit(unit);
    parentPort.postMessage({ idx: unit.idx, row });
  });
}

// --- CLI (main thread only) --------------------------------------------------

function usage() {
  return [
    "Usage: node tools/days-farm.mjs [options]",
    "  --seeds=N          paired seeds, i*7919+1 (default 200, >= 1)",
    "  --farm-floor=1|2|1,2   which farm floor(s) to measure (default 1,2)",
    "  --json             print the JSON report instead of the markdown block",
    "  --workers=N        worker_threads count (default os.availableParallelism(), >= 1; 1 plays inline)",
    "  --out=PATH         write the JSON report atomically to PATH",
    "  --from=PATH        load a saved report and print it (plays nothing)",
    "  --max-actions=N    the FARMER cap (default 20000, >= 1) — the honest baseline always plays BOT_DEFAULTS unchanged",
    "  --max-days=N       the farmer day cap (default 500, >= 1)",
    "",
    "Examples:",
    "  node tools/days-farm.mjs --seeds=200 --farm-floor=1,2 --json --out=docs/days-farming/days-farm.json",
    "  node tools/days-farm.mjs --seeds=4",
    "  node tools/days-farm.mjs --from=docs/days-farming/days-farm.json",
  ].join("\n");
}

function fail(msg) {
  process.stderr.write(`${msg}\n${usage()}\n`);
  process.exit(2);
}

/** parseArgs(argv) — accepts both `--flag value` and `--flag=value` forms (mirrors tools/tune-classes.mjs). */
function parseArgs(argv) {
  const opts = {
    seeds: 200,
    farmFloors: [1, 2],
    json: false,
    workers: os.availableParallelism(),
    out: null,
    from: null,
    maxActions: FARM_CAPS.maxActions,
    maxDays: FARM_CAPS.maxDays,
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
    const intFlag = (min) => {
      const n = parseInt(nextValue(), 10);
      if (!Number.isFinite(n) || n < min) fail(`${flag} must be an integer >= ${min}`);
      return n;
    };

    switch (flag) {
      case "--seeds":
        opts.seeds = intFlag(1);
        break;
      case "--farm-floor": {
        const raw = nextValue();
        const values = raw.split(",").map((s) => parseInt(s.trim(), 10));
        if (!values.length || values.some((v) => v !== 1 && v !== 2)) fail(`${flag} must be 1, 2, or 1,2`);
        opts.farmFloors = [...new Set(values)].sort((a, b) => a - b);
        break;
      }
      case "--json":
        opts.json = true;
        break;
      case "--workers":
        opts.workers = intFlag(1);
        break;
      case "--out":
        opts.out = nextValue();
        break;
      case "--from":
        opts.from = nextValue();
        break;
      case "--max-actions":
        opts.maxActions = intFlag(1);
        break;
      case "--max-days":
        opts.maxDays = intFlag(1);
        break;
      default:
        fail(`Unknown flag: ${flag}`);
    }
    i++;
  }
  return opts;
}

/**
 * buildUnits(opts) — the fixed work-unit order this file's own header
 * documents: all honest seeds, then for each farm floor ascending, for each
 * variant in FARM_VARIANTS order, all seeds. Seeds come from `seedList`
 * (i*7919+1) — the same heroes `tune-difficulty` samples; there is no class
 * forcing here, the seed-rolled heroes ARE the rotation.
 */
function buildUnits(opts) {
  const seeds = seedList(opts.seeds);
  const units = [];
  let idx = 0;
  for (const seed of seeds) units.push({ idx: idx++, kind: "honest", seed });
  for (const farmFloor of opts.farmFloors) {
    for (const variant of FARM_VARIANTS) {
      for (const seed of seeds) {
        units.push({ idx: idx++, kind: "farm", seed, variant, farmFloor, maxActions: opts.maxActions, maxDays: opts.maxDays });
      }
    }
  }
  return units;
}

/** reportProgress(done, total, startedAt) — every 25 finished units (and the final one), to stderr only. */
function reportProgress(done, total, startedAt) {
  if (done % 25 !== 0 && done !== total) return;
  const sec = ((Date.now() - startedAt) / 1000).toFixed(1);
  process.stderr.write(`progress: ${done}/${total} runs  ${sec}s\n`);
}

/** runInline(units) — `--workers=1`: no worker_threads, the same playUnit the worker branch uses. */
function runInline(units) {
  const results = new Array(units.length);
  const startedAt = Date.now();
  for (let i = 0; i < units.length; i++) {
    results[units[i].idx] = playUnit(units[i]);
    reportProgress(i + 1, units.length, startedAt);
  }
  return results;
}

/**
 * runWithWorkers(units, workerCount) — a main-thread queue over
 * `worker_threads`: spawns `min(workerCount, units.length)` same-file
 * workers, hands each an unclaimed unit at a time, and resolves with
 * `results` indexed by each unit's own `idx` (not completion order) once
 * every unit has returned. Only `{idx, kind, seed, variant, farmFloor,
 * maxActions, maxDays}` / `{idx, row}` plain-object messages cross the
 * thread boundary — no engine state, no function.
 */
function runWithWorkers(units, workerCount) {
  return new Promise((resolve, reject) => {
    const poolSize = Math.min(workerCount, units.length);
    const results = new Array(units.length);
    let nextIndex = 0;
    let doneCount = 0;
    let settled = false;
    const startedAt = Date.now();

    const settleError = (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    const assignNext = (worker) => {
      if (nextIndex >= units.length) {
        worker.terminate();
        return;
      }
      worker.postMessage(units[nextIndex++]);
    };

    for (let w = 0; w < poolSize; w++) {
      const worker = new Worker(new URL(import.meta.url));
      worker.on("message", (msg) => {
        results[msg.idx] = msg.row;
        doneCount++;
        reportProgress(doneCount, units.length, startedAt);
        if (doneCount === units.length) {
          settled = true;
          resolve(results);
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

  if (opts.from) {
    let raw;
    try {
      raw = readFileSync(opts.from, "utf8");
    } catch (e) {
      process.stderr.write(`Cannot read --from=${opts.from}: ${e.message}\n`);
      process.exit(1);
      return;
    }
    const report = JSON.parse(raw);
    console.log(opts.json ? JSON.stringify(report, null, 2) : formatFarmReport(report));
    process.exit(0);
    return;
  }

  const startedAt = Date.now();
  const units = buildUnits(opts);

  let results;
  if (opts.workers === 1) {
    results = runInline(units);
  } else {
    try {
      results = await runWithWorkers(units, opts.workers);
    } catch (err) {
      console.error(err);
      process.exit(1);
      return;
    }
  }

  // Re-assemble by the units array's OWN order (idx-aligned to `results`),
  // never completion order — this is what makes --workers=1 and
  // --workers=N byte-identical.
  const honestRows = [];
  const farmRows = {};
  for (const farmFloor of opts.farmFloors) {
    farmRows[farmFloor] = {};
    for (const variant of FARM_VARIANTS) farmRows[farmFloor][variant] = [];
  }
  units.forEach((unit) => {
    const row = results[unit.idx];
    if (unit.kind === "honest") honestRows.push(row);
    else farmRows[unit.farmFloor][unit.variant].push(row);
  });

  let commit = "unknown";
  try {
    commit = execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    // dev machine without git history reachable — "unknown" is an honest fallback.
  }

  const meta = {
    tool: "days-farm",
    commit,
    seeds: opts.seeds,
    seedList: "i*7919+1",
    farmFloors: opts.farmFloors,
    variants: FARM_VARIANTS,
    caps: { maxActions: opts.maxActions, maxDays: opts.maxDays },
    clockWindow: CLOCK_WINDOW,
    breakerLimit: BREAKER_LIMIT,
    bot: {
      exploreBudget: BOT_DEFAULTS.exploreBudget,
      maxActions: BOT_DEFAULTS.maxActions,
      fleeThreshold: BOT_DEFAULTS.fleeThreshold,
      casterFleeThreshold: BOT_DEFAULTS.casterFleeThreshold,
      potionThreshold: BOT_DEFAULTS.potionThreshold,
      campThreshold: BOT_DEFAULTS.campThreshold,
      startDepth: BOT_DEFAULTS.startDepth,
    },
    runFlags: RUN_FLAGS,
  };

  const report = buildFarmReport({ meta, honestRows, farmRows });

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatFarmReport(report));
  }

  if (opts.out) {
    const dir = path.dirname(opts.out);
    mkdirSync(dir, { recursive: true });
    const tmpPath = `${opts.out}.tmp`;
    writeFileSync(tmpPath, JSON.stringify(report, null, 2));
    renameSync(tmpPath, opts.out); // written ONCE, after every worker has returned
  }

  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  process.stderr.write(`elapsed: ${elapsedSec}s  workers=${opts.workers}  runs=${units.length}\n`);
  process.exit(0);
}

if (isMainThread) {
  main();
}
