#!/usr/bin/env node
// tools/tune-economy.mjs
//
// Dev-only, zero-dependency Node ESM script — NOT shipped, NOT a node:test
// file (it makes no assertions, so `node --test` never picks it up). The
// bot policy lives in tools/lib/tuning-bot.mjs (Phase 21, TUNE-02) — cast/
// drink/camp/descend + caster-aware flee (D-05/D-06), tallies (D-07),
// readout (D-08) — imported here, not duplicated.
//
// ============================ SCOPE / STATUS ============================
// SCAFFOLD STUB ONLY (Phase 16, Economy E, Task 4 — "optional"). This harness
// is intentionally LIGHTWEIGHT and is NOT driven to set final balance in
// Phase 16. The phase's number changes (the depth-scaled "wilmst cache" row,
// the confirmed bag caps) were made CONSERVATIVELY by inspection, not by this
// script. It exists so the LATER deep-tune (Phase 21, this pass) has a ready
// place to simulate N seeded runs and read gold-earned / gold-by-source /
// gold-at-death distributions.
//
// THIS IS A TUNING PROXY, NOT A PASS/FAIL GATE, and NOT a substitute for a
// human playtest. A heuristic bot's play skill is arbitrary, so its gold
// curves are a rough sanity signal only. Do NOT gate any build or CI check
// on this script's output.
//
// The bot now takes finds (leaveFind only on a full bag), casts/drinks/
// camps, and heads for the exit once a floor's dots are cleared or the
// exploration budget is spent — it still never shops (Deferred Idea), so
// store income/spend stays out of the signal.
//
// Run:
//   node tools/tune-economy.mjs --seeds=200
//   node tools/tune-economy.mjs --seeds=200 --json
//   node tools/tune-economy.mjs --seeds=200 --party
//   node tools/tune-economy.mjs --seeds=200 --max-actions=5000 --explore-budget=30

import { newRun } from "../engine/engine.js";
import { playRun, distribution, percentile, sharedJson, printSharedReadout, BOT_DEFAULTS } from "./lib/tuning-bot.mjs";

/**
 * autoPlayOnce(seed, opts) — one full run via the shared playRun loop
 * (tools/lib/tuning-bot.mjs), layering the gold (wilmst) economy tally on
 * top via playRun's onStep hook. `startGold` is read from a SEPARATE
 * `newRun(seed)` call before playRun (newRun is pure, so one extra chargen
 * per seed is cheap) — with `--party` the forced member changes nothing
 * about the hero's own purse. `state` is dropped from the returned record.
 */
function autoPlayOnce(seed, opts) {
  const startGold = newRun(seed).c.gold;
  let peakGold = startGold;
  let earned = 0; // sum of positive goldGained amounts
  const bySource = {}; // why -> total amount
  const run = playRun(seed, opts, (events, state) => {
    for (const e of events) {
      if (e.type === "goldGained" && typeof e.amount === "number") {
        earned += e.amount;
        const why = e.why || "unknown";
        bySource[why] = (bySource[why] || 0) + e.amount;
      }
    }
    if (state.c.gold > peakGold) peakGold = state.c.gold;
  });
  const { state, ...rest } = run;
  return {
    ...rest,
    startGold,
    endGold: state.c.gold,
    peakGold,
    earned,
    bySource,
  };
}

// --- reporting -----------------------------------------------------------

function sourceBreakdown(results) {
  const totals = {};
  for (const r of results) for (const [why, amt] of Object.entries(r.bySource)) totals[why] = (totals[why] || 0) + amt;
  const grand = Object.values(totals).reduce((a, b) => a + b, 0) || 1;
  return Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .map(([why, amt]) => ({ why, amt, pct: (amt / grand) * 100 }));
}

function printReport(results, opts) {
  const earned = distribution(results.map((r) => r.earned));
  const peak = distribution(results.map((r) => r.peakGold));
  const end = distribution(results.map((r) => r.endGold));
  const depths = distribution(results.map((r) => r.deathDepth));
  const sources = sourceBreakdown(results);

  console.log(`\ntune-economy: ${results.length} seeded auto-play run(s)`);
  console.log("(SCAFFOLD STUB / TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)\n");

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

  printSharedReadout(results, opts);
  console.log("");
}

// --- CLI -----------------------------------------------------------------

function parseArgs(argv) {
  const opts = { seeds: 200, json: false, ...BOT_DEFAULTS };
  for (const arg of argv) {
    if (arg.startsWith("--seeds=")) {
      const n = parseInt(arg.slice("--seeds=".length), 10);
      if (Number.isFinite(n) && n > 0) opts.seeds = n;
    } else if (arg === "--json") {
      opts.json = true;
    } else if (arg === "--party") {
      opts.party = true;
    } else if (arg.startsWith("--max-actions=")) {
      const n = parseInt(arg.slice("--max-actions=".length), 10);
      if (Number.isFinite(n) && n > 0) opts.maxActions = n;
    } else if (arg.startsWith("--explore-budget=")) {
      const n = parseInt(arg.slice("--explore-budget=".length), 10);
      if (Number.isFinite(n) && n >= 0) opts.exploreBudget = n;
    }
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const seeds = Array.from({ length: opts.seeds }, (_, i) => i * 7919 + 1);
  const results = seeds.map((seed) => autoPlayOnce(seed, opts));

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          runs: results.length,
          earned: distribution(results.map((r) => r.earned)),
          peakGold: distribution(results.map((r) => r.peakGold)),
          endGold: distribution(results.map((r) => r.endGold)),
          deathDepth: distribution(results.map((r) => r.deathDepth)),
          bySource: sourceBreakdown(results),
          ...sharedJson(results, opts),
        },
        null,
        2,
      ),
    );
  } else {
    printReport(results, opts);
  }
}

main();
