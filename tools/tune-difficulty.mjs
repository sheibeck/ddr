#!/usr/bin/env node
// tools/tune-difficulty.mjs
//
// Dev-only, zero-dependency Node ESM script — NOT shipped, NOT a node:test
// file (it makes no assertions, so `node --test` never picks it up). The
// bot policy lives in tools/lib/tuning-bot.mjs (Phase 21, TUNE-02) — cast/
// drink/camp/descend + caster-aware flee (D-05/D-06), tallies (D-07),
// readout (D-08) — imported here, not duplicated.
//
// THIS IS A TUNING PROXY, NOT A PASS/FAIL GATE, and NOT a substitute for the
// deferred human playtest (03-CONTEXT.md / 03-RESEARCH.md Pitfall 3 — a
// heuristic bot's play skill is arbitrary: it may flee too eagerly,
// understating combat lethality, or too rarely, overstating it). Do not gate
// any build or CI check on this script's output; read the distributions as
// a rough sanity signal while hand-tuning engine/difficulty.js's constants.
//
// Run:
//   node tools/tune-difficulty.mjs --seeds=200
//   node tools/tune-difficulty.mjs --seeds=200 --json
//   node tools/tune-difficulty.mjs --seeds=200 --party
//   node tools/tune-difficulty.mjs --seeds=200 --max-actions=5000 --explore-budget=30
//   node tools/tune-difficulty.mjs --seeds=50 --start-depth=20
//
// HARN-04 (22-CONTEXT.md "Start-at-depth for the bot"): `--start-depth=N`
// reuses newRun's existing dev-only start-at-depth option exactly as the
// Settings toggle does, threaded straight through playRun's opts.startDepth
// (default 1, BOT_DEFAULTS.startDepth). No extra kit or gear grants — a
// deep-start character is exactly what the dev path already produces (SP
// set to the depth's threshold, leveled via checkLevel, capped at 5; a
// depth-scaled purse).
//
// Phase 54 (BAND-01): the always-on Four-band readout block
// (tools/lib/band-readout.mjs) — the reach >=16 / band-share / per-band-cause
// numbers the four-band ledger needs; a report addition only, the bot policy
// in tools/lib/tuning-bot.mjs is untouched.
//
// Phase 54 (USER RULING C): the per-floor survival block — the tuning target
// is the 25-row p_L / S_L curve in TARGET_SURVIVAL; report-only, bot policy
// untouched.

import { playRun, distribution, percentile, sharedJson, printSharedReadout, BOT_DEFAULTS } from "./lib/tuning-bot.mjs";
import { bandReadout, formatBandReadout, survivalReadout, formatSurvivalReadout } from "./lib/band-readout.mjs";

/**
 * autoPlayOnce(seed, opts) — plays one full run to completion via the
 * shared playRun loop (tools/lib/tuning-bot.mjs), layering the Phase 20
 * (D-15) parley tally on top via playRun's onStep hook. `state` is dropped
 * from the returned record (spread `run` minus `state`) so 200 results do
 * not each pin a full floor object in memory.
 */
function autoPlayOnce(seed, opts) {
  let parleyAttempts = 0;
  let parleySuccesses = 0;
  let parleyFailures = 0;
  let parleyRefused = 0;
  let parleyExhausted = 0;
  let parleySp = 0;
  const run = playRun(seed, opts, (events) => {
    for (const e of events) {
      if (e.type === "parleyRolled") parleyAttempts++;
      else if (e.type === "spGained" && e.reason === "parley") {
        parleySuccesses++;
        parleySp += e.amount;
      } else if (e.type === "parleyFailed") parleyFailures++;
      else if (e.type === "parleyRefused") parleyRefused++;
      else if (e.type === "parleyExhausted") parleyExhausted++;
    }
  });
  const { state, ...rest } = run;
  return {
    ...rest,
    parleyAttempts,
    parleySuccesses,
    parleyFailures,
    parleyRefused,
    parleyExhausted,
    parleySp,
    spTotal: state.c.sp,
  };
}

// --- reporting ---------------------------------------------------------

function causeBreakdown(results) {
  const counts = {};
  for (const r of results) counts[r.cause] = (counts[r.cause] || 0) + 1;
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([cause, count]) => ({ cause, count }));
}

/**
 * parleySummary(results) — Phase 20 (D-15) readout aggregation, informational
 * only (never a gate). Sums each run's parley tally and reports the derived
 * successRate/spShare ratios across the whole batch.
 */
function parleySummary(results) {
  const attempts = results.reduce((sum, r) => sum + r.parleyAttempts, 0);
  const successes = results.reduce((sum, r) => sum + r.parleySuccesses, 0);
  const failures = results.reduce((sum, r) => sum + r.parleyFailures, 0);
  const refused = results.reduce((sum, r) => sum + r.parleyRefused, 0);
  const exhausted = results.reduce((sum, r) => sum + r.parleyExhausted, 0);
  const runsWithAttempt = results.filter((r) => r.parleyAttempts > 0).length;
  const parleySp = results.reduce((sum, r) => sum + r.parleySp, 0);
  const spTotal = results.reduce((sum, r) => sum + r.spTotal, 0);
  return {
    attempts,
    successes,
    failures,
    refused,
    exhausted,
    runsWithAttempt,
    parleySp,
    spTotal,
    successRate: attempts ? successes / attempts : 0,
    spShare: spTotal ? parleySp / spTotal : 0,
  };
}

function printReport(results, opts) {
  // HARN-02: a `stuck` run (hit maxActions without dying) is its
  // own outcome bucket — excluded from every depth stat below so a 5% stuck
  // rate never silently corrupts the death-depth/cause readout.
  const completed = results.filter((r) => !r.stuck);
  const stuckCount = results.length - completed.length;
  const depths = distribution(completed.map((r) => r.deathDepth));
  const actions = distribution(results.map((r) => r.actions)); // action-count is not a depth stat — stays over ALL runs
  const causes = causeBreakdown(completed);
  const deadCount = results.filter((r) => r.dead).length;

  console.log(`\ntune-difficulty: ${results.length} seeded auto-play run(s), start depth ${opts.startDepth}`);
  console.log("(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)\n");

  console.log("Death-depth distribution:");
  console.log(`  min=${depths.min}  p50=${depths.p50}  p90=${depths.p90}  max=${depths.max}`);

  console.log("\nAction-count distribution:");
  console.log(`  min=${actions.min}  p50=${actions.p50}  p90=${actions.p90}  max=${actions.max}`);

  console.log("\nDeath-cause breakdown:");
  for (const { cause, count } of causes) {
    const pct = ((count / results.length) * 100).toFixed(1);
    console.log(`  ${String(cause).padEnd(20)} ${count} (${pct}%)`);
  }

  const parley = parleySummary(results);
  const successPct = (parley.successRate * 100).toFixed(1);
  const spSharePct = (parley.spShare * 100).toFixed(1);
  console.log("\nParley (D-15 readout — informational, not a gate):");
  console.log(
    `  attempts=${parley.attempts}  successes=${parley.successes} (${successPct}%)  failures=${parley.failures}  refused=${parley.refused}  exhausted=${parley.exhausted}`,
  );
  console.log(`  runs with >=1 attempt: ${parley.runsWithAttempt} of ${results.length}`);
  console.log(`  SP from parley: ${parley.parleySp} of ${parley.spTotal} total SP (${spSharePct}%)`);
  console.log("");

  printSharedReadout(results, opts);

  console.log("");
  for (const line of formatBandReadout(bandReadout(results, opts))) {
    console.log(line);
  }

  console.log("");
  for (const line of formatSurvivalReadout(survivalReadout(results, opts))) {
    console.log(line);
  }

  console.log(`\nOutcome: ${deadCount} dead, ${stuckCount} stuck (hit maxActions=${opts.maxActions}; excluded from depth stats)`);
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
    } else if (arg.startsWith("--start-depth=")) {
      // HARN-04 (22-CONTEXT.md "Start-at-depth for the bot"): reuses
      // newRun's dev-only start-at-depth option exactly, via playRun's
      // opts.startDepth. Default comes from BOT_DEFAULTS.startDepth (1).
      const n = parseInt(arg.slice("--start-depth=".length), 10);
      if (Number.isFinite(n) && n >= 1) opts.startDepth = n;
    }
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  // Deterministic, reproducible seed list (not the engine's own rng — this is
  // just which seeds to sample, chosen with a simple stride so re-running
  // with the same --seeds=N always samples the identical set of runs).
  const seeds = Array.from({ length: opts.seeds }, (_, i) => i * 7919 + 1);
  const results = seeds.map((seed) => autoPlayOnce(seed, opts));
  // HARN-02: stuck runs are their own outcome bucket, excluded from every
  // depth stat (deathDepth/causes) in the JSON output too — a stuck run's
  // "death depth" is a mid-run action-cap measurement, not a real death.
  const completedResults = results.filter((r) => !r.stuck);

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          runs: results.length,
          deathDepth: distribution(completedResults.map((r) => r.deathDepth)),
          actions: distribution(results.map((r) => r.actions)),
          causes: causeBreakdown(completedResults),
          dead: results.filter((r) => r.dead).length,
          parley: parleySummary(results),
          bands: bandReadout(results, opts),
          survival: survivalReadout(results, opts),
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
