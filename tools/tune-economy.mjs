#!/usr/bin/env node
// tools/tune-economy.mjs
//
// Dev-only, zero-dependency Node ESM script -- NOT shipped, NOT a node:test
// file (it makes no assertions, so `node --test` never picks it up). The bot
// policy lives in tools/lib/tuning-bot.mjs (cast/drink/camp/descend, gear and
// ration shopping, caster-aware flee, tallies, readout) and is imported here,
// never duplicated. The aggregation and the text/Markdown renderers live in
// tools/lib/economy-readout.mjs.
//
// ============================ WHAT THIS MEASURES ============================
// ECON-11 (Phase 92): for each depth on floors 1-12, the gold a hero holds on
// reaching a store against that store's total stock price, and gold income
// broken down by source (the goldGained `why`: off the body, chest, tableFour,
// faerie, grimoire, cutpurse, parley, plus the starting purse). Two samples:
//   - store visits: on every `storeOpened` event, the post-action state's gold
//     against the shelf the engine just built (each line's `cost` already
//     carries race, Pickpocket and the Wilmsry haggle; the Rations line counts
//     as price x the d10 stock left);
//   - floor arrivals: on reaching every new floor, the hero's gold against the
//     store that hero would face THERE. That store comes from the engine's own
//     openStore called on a structuredClone of the state with a throwaway
//     derivedRng(seed, "econReadout", depth) stream -- HARNESS-ONLY: the clone
//     is discarded, the real run and its rng are never touched (the
//     determinism test pins deathDepth and actions equal playRun's).
// Beside the gold held it reports the sale value of the bag (sellPriceFor over
// c.items), because the fair bot never sells and a human does.
//
// THE BOT: shops for weapon and armour upgrades (keeping GOLD_RESERVE back)
// and rations (to three nights of the party's upkeep); it never buys repairs
// and never sells. THIS IS A TUNING PROXY, NOT A PASS/FAIL GATE, and not a
// substitute for a human playtest: do not gate a build or CI check on it. The
// deeper rows are survivors of a bot whose median death is about floor 4.
//
// Run:
//   node tools/tune-economy.mjs --seeds=200
//   node tools/tune-economy.mjs --seeds=1000 --workers=4 --out=docs/economy/econ-before-1000.json
//   node tools/tune-economy.mjs --seeds=200 --json
//   node tools/tune-economy.mjs --seeds=200 --dials='{"LOOT_SCALE":0.6}'
//   node tools/tune-economy.mjs --seeds=200 --party --max-actions=5000 --explore-budget=30
// Flags: --seeds, --json, --out=<path.json>, --workers=N (byte-identical output
// for any N), --dials=<json|path> (setDialsForTuning once per process, before
// any run), --max-depth=N (default 12), --party, --max-actions, --explore-budget,
// --rows (add a per-run {seed, deathDepth, actions} list to the JSON; a test aid).
// Elapsed time goes to stderr only: stdout and the JSON are free of timing.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";

import { newRun } from "../engine/engine.js";
import { openStore, sellPriceFor } from "../engine/economy.js";
import { derivedRng } from "../engine/rng.js";
import { setDialsForTuning } from "../engine/difficulty.js";
import { BAGS } from "../content/bags.js";
import { playRun, distribution, sharedJson, printSharedReadout, botLine, BOT_DEFAULTS, RUN_FLAGS } from "./lib/tuning-bot.mjs";
import { stockGroups, economyReadout, projectLever, formatEconomyReadout } from "./lib/economy-readout.mjs";

/** bagCapOf(c) -- the hero's bag wilmst cap, or null (a bag-less test hero). */
function bagCapOf(c) {
  return BAGS[c.bag]?.wilmst ?? null;
}

/** sellValueOf(c) -- what the bag would fetch at a store (the bot never sells; a human does). */
function sellValueOf(c) {
  let s = 0;
  for (const it of c.items || []) s += sellPriceFor(it, c.race, c.sub);
  return s;
}

/**
 * wouldFaceGroups(state, seed) -- the shelf (by group) this hero would meet on
 * opening a store on `state`'s floor. HARNESS-ONLY: openStore runs on a
 * structuredClone with its own derived rng, so neither the live state nor the
 * run's rng stream is touched.
 */
function wouldFaceGroups(state, seed) {
  const clone = structuredClone(state);
  openStore(clone, derivedRng(seed, "econReadout", clone.floor.depth), []);
  return stockGroups(clone.store.stock);
}

const copyMap = (m) => ({ ...m });

/**
 * autoPlayOnce(seed, opts) -- one full run via the shared playRun loop,
 * layering the gold economy tally on top via playRun's onStep hook. Returns
 * the playRun record (state dropped) plus the legacy gold fields and `econ`,
 * the plain per-run record economyReadout aggregates.
 */
function autoPlayOnce(seed, opts) {
  const start = newRun(seed, [], { startDepth: opts.startDepth, ...RUN_FLAGS });
  const startGold = start.c.gold;
  let peakGold = startGold;
  let earned = 0; // sum of positive goldGained amounts
  const bySource = {}; // why -> total amount
  const incomeByDepth = {};
  const spentByDepth = {};
  const running = {}; // why -> income so far (this run)
  let spent = 0;
  let curDepth = start.floor.depth;
  let deepest = curDepth;
  const visits = [];
  const arrivals = [];
  const arrive = (state) => {
    arrivals.push({
      depth: state.floor.depth,
      gold: state.c.gold,
      sellValue: sellValueOf(state.c),
      bagCap: bagCapOf(state.c),
      wouldFace: wouldFaceGroups(state, seed),
      incomeSoFar: copyMap(running),
    });
  };
  arrive(start);

  const run = playRun(seed, opts, (events, state) => {
    for (const e of events) {
      if (e.type === "goldGained" && typeof e.amount === "number") {
        earned += e.amount;
        const why = e.why || "unknown";
        bySource[why] = (bySource[why] || 0) + e.amount;
        const d = (incomeByDepth[curDepth] ||= {});
        d[why] = (d[why] || 0) + e.amount;
        running[why] = (running[why] || 0) + e.amount;
      } else if (e.type === "bought" && typeof e.cost === "number") {
        spent += e.cost;
        spentByDepth[curDepth] = (spentByDepth[curDepth] || 0) + e.cost;
      } else if (e.type === "storeOpened" && state.store) {
        visits.push({
          depth: e.depth,
          gold: state.c.gold,
          bagCap: bagCapOf(state.c),
          sellValue: sellValueOf(state.c),
          groups: stockGroups(state.store.stock),
          incomeSoFar: copyMap(running),
          spentSoFar: spent,
        });
      }
    }
    if (state.c.gold > peakGold) peakGold = state.c.gold;
    curDepth = state.floor.depth;
    if (curDepth > deepest) {
      deepest = curDepth;
      arrive(state);
    }
  });
  const { state, ...rest } = run;
  return {
    ...rest,
    startGold,
    endGold: state.c.gold,
    peakGold,
    earned,
    bySource,
    econ: { seed, cls: rest.cls, sub: rest.sub, race: rest.race, startGold, deathDepth: rest.deathDepth, visits, arrivals, incomeByDepth, spentByDepth },
  };
}

// --- worker thread branch (the tools/fit-difficulty.mjs pattern) ---------------------------
//
// Each worker is a fresh module instance, so setDialsForTuning's process-local
// override is applied once per worker before its slice and can never leak.

if (!isMainThread) {
  const { dials, seeds, opts } = workerData;
  if (dials) setDialsForTuning(dials);
  parentPort.postMessage(seeds.map((seed) => autoPlayOnce(seed, opts)));
}

/** playSeeds(seeds, opts, dials, workerCount) -- contiguous slices, rows concatenated in SLICE order (never completion order), so output is identical for any worker count. */
async function playSeeds(seeds, opts, dials, workerCount) {
  if (workerCount <= 1) {
    if (dials) setDialsForTuning(dials);
    return seeds.map((seed) => autoPlayOnce(seed, opts));
  }
  const poolSize = Math.max(1, Math.min(workerCount, seeds.length));
  const sliceSize = Math.ceil(seeds.length / poolSize);
  const slices = [];
  for (let i = 0; i < poolSize; i++) {
    const slice = seeds.slice(i * sliceSize, (i + 1) * sliceSize);
    if (slice.length) slices.push(slice);
  }
  const bySlice = new Array(slices.length);
  await Promise.all(
    slices.map(
      (slice, i) =>
        new Promise((resolve, reject) => {
          const worker = new Worker(new URL(import.meta.url), { workerData: { dials, seeds: slice, opts } });
          worker.on("message", (rows) => {
            bySlice[i] = rows;
            worker.terminate();
            resolve();
          });
          worker.on("error", reject);
        }),
    ),
  );
  return bySlice.flat();
}

// --- reporting -----------------------------------------------------------

function sourceBreakdown(results) {
  const totals = {};
  for (const r of results) for (const [why, amt] of Object.entries(r.bySource)) totals[why] = (totals[why] || 0) + amt;
  const grand = Object.values(totals).reduce((a, b) => a + b, 0) || 1;
  return Object.entries(totals)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .map(([why, amt]) => ({ why, amt, pct: (amt / grand) * 100 }));
}

const GEAR = ["weapons", "armour", "premium"];
const ALL_BUT_UPKEEP = ["potions", "lockpicks", "weapons", "armour", "scroll", "premium"];
const LOOT_SOURCES = ["off the body", "chest", "tableFour", "faerie"];
const PRICE_GRID = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 16];
const INCOME_GRID = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0];
const CAP_GRID = [1, 0.8, 0.6, 0.5, 0.4, 0.3, 0.25, 0.2, 0.15, 0.1, 0.05];

/** buildProjections(runs, maxDepth) -- the lever first guesses on both bases (the bot's own buying held fixed). */
function buildProjections(runs, maxDepth) {
  const out = [];
  for (const basis of ["gold", "goldWithSales"]) {
    out.push(projectLever(runs, { lever: "price", groups: GEAR, values: PRICE_GRID, basis, maxDepth }));
    out.push(projectLever(runs, { lever: "price", groups: ALL_BUT_UPKEEP, values: PRICE_GRID, basis, maxDepth }));
    out.push(projectLever(runs, { lever: "income", sources: LOOT_SOURCES, values: INCOME_GRID, basis, maxDepth }));
    out.push(projectLever(runs, { lever: "cap", values: CAP_GRID, basis, maxDepth }));
  }
  return out;
}

function gitCommit() {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "unknown";
  }
}

function dialsLine(dials) {
  return dials ? JSON.stringify(dials) : "shipped";
}

function printReport(results, opts, readout, dials) {
  const earned = distribution(results.map((r) => r.earned));
  const peak = distribution(results.map((r) => r.peakGold));
  const end = distribution(results.map((r) => r.endGold));
  const depths = distribution(results.map((r) => r.deathDepth));
  const sources = sourceBreakdown(results);

  console.log(`\ntune-economy: ${results.length} seeded auto-play run(s)`);
  console.log("(TUNING PROXY ONLY -- not a pass/fail gate, not a substitute for human playtest; the bot never sells and never buys repairs)\n");

  console.log("Wilmst earned per run:");
  console.log(`  min=${earned.min}  p50=${earned.p50}  p90=${earned.p90}  max=${earned.max}`);
  console.log("\nPeak wilmst held per run:");
  console.log(`  min=${peak.min}  p50=${peak.p50}  p90=${peak.p90}  max=${peak.max}`);
  console.log("\nWilmst held at run end:");
  console.log(`  min=${end.min}  p50=${end.p50}  p90=${end.p90}  max=${end.max}`);
  console.log("\nReached depth:");
  console.log(`  min=${depths.min}  p50=${depths.p50}  p90=${depths.p90}  max=${depths.max}`);

  console.log("\nIncome by source (goldGained.why):");
  for (const { why, amt, pct } of sources) {
    console.log(`  ${String(why).padEnd(14)} ${String(amt).padStart(10)} (${pct.toFixed(1)}%)`);
  }
  console.log("");

  for (const line of formatEconomyReadout(readout)) console.log(line);
  console.log("");
  console.log(`Dials: ${dialsLine(dials)}`);
  console.log("");

  printSharedReadout(results, opts);
  console.log("");
}

// --- CLI -----------------------------------------------------------------

function parseArgs(argv) {
  const opts = { seeds: 200, json: false, ...BOT_DEFAULTS };
  const cli = { workers: 1, dials: null, out: null, maxDepth: 12, rows: false };
  for (const arg of argv) {
    if (arg.startsWith("--seeds=")) {
      const n = parseInt(arg.slice("--seeds=".length), 10);
      if (Number.isFinite(n) && n > 0) opts.seeds = n;
    } else if (arg === "--json") {
      opts.json = true;
    } else if (arg === "--party") {
      opts.party = true;
    } else if (arg === "--rows") {
      cli.rows = true;
    } else if (arg.startsWith("--max-actions=")) {
      const n = parseInt(arg.slice("--max-actions=".length), 10);
      if (Number.isFinite(n) && n > 0) opts.maxActions = n;
    } else if (arg.startsWith("--explore-budget=")) {
      const n = parseInt(arg.slice("--explore-budget=".length), 10);
      if (Number.isFinite(n) && n >= 0) opts.exploreBudget = n;
    } else if (arg.startsWith("--workers=")) {
      const n = parseInt(arg.slice("--workers=".length), 10);
      if (Number.isFinite(n) && n > 0) cli.workers = n;
    } else if (arg.startsWith("--max-depth=")) {
      const n = parseInt(arg.slice("--max-depth=".length), 10);
      if (Number.isFinite(n) && n > 0) cli.maxDepth = n;
    } else if (arg.startsWith("--out=")) {
      cli.out = arg.slice("--out=".length);
    } else if (arg.startsWith("--dials=")) {
      const raw = arg.slice("--dials=".length).trim();
      const text = raw.startsWith("{") ? raw : fs.readFileSync(path.resolve(raw), "utf8");
      cli.dials = JSON.parse(text);
    }
  }
  return { opts, cli };
}

async function main() {
  const startedAt = Date.now();
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
    if (parsed.cli.dials) setDialsForTuning(parsed.cli.dials); // validates the dial names up front (also the in-process path)
  } catch (err) {
    console.error(`tune-economy: ${err.message}`);
    process.exit(1);
  }
  const { opts, cli } = parsed;
  const seeds = Array.from({ length: opts.seeds }, (_, i) => i * 7919 + 1);
  const results = await playSeeds(seeds, opts, cli.dials, cli.workers);
  const econRuns = results.map((r) => r.econ);

  const readout = economyReadout(econRuns, { maxDepth: cli.maxDepth });
  const projections = buildProjections(econRuns, cli.maxDepth);
  const report = {
    meta: {
      tool: "tune-economy",
      commit: gitCommit(),
      seeds: results.length,
      seedList: "i*7919+1",
      maxActions: opts.maxActions,
      dials: cli.dials ? cli.dials : "shipped",
      bot: botLine(opts),
      maxDepth: cli.maxDepth,
    },
    readout,
    projections,
    legacy: {
      earned: distribution(results.map((r) => r.earned)),
      peakGold: distribution(results.map((r) => r.peakGold)),
      endGold: distribution(results.map((r) => r.endGold)),
      deathDepth: distribution(results.map((r) => r.deathDepth)),
      bySource: sourceBreakdown(results),
      shared: sharedJson(results, opts),
    },
  };
  if (cli.rows) report.rows = results.map((r) => ({ seed: r.seed, deathDepth: r.deathDepth, actions: r.actions }));

  if (cli.out) {
    fs.mkdirSync(path.dirname(path.resolve(cli.out)), { recursive: true });
    fs.writeFileSync(cli.out, `${JSON.stringify(report, null, 2)}\n`);
  }
  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printReport(results, opts, readout, cli.dials);
  }
  console.error(`tune-economy: ${results.length} runs in ${((Date.now() - startedAt) / 1000).toFixed(1)}s (workers=${cli.workers})`);
}

if (isMainThread) await main();
