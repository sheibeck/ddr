#!/usr/bin/env node
// tools/tune-economy.mjs
//
// Dev-only, zero-dependency Node ESM script — NOT shipped, NOT a node:test
// file (it makes no assertions, so `node --test` never picks it up). Imports
// only from engine/ through the public applyAction/newRun/makeRng surface,
// never engine internals directly, and Node builtins.
//
// ============================ SCOPE / STATUS ============================
// SCAFFOLD STUB ONLY (Phase 16, Economy E, Task 4 — "optional"). This harness
// is intentionally LIGHTWEIGHT and is NOT driven to set final balance in
// Phase 16. The phase's number changes (the depth-scaled "wilmst cache" row,
// the confirmed bag caps) were made CONSERVATIVELY by inspection, not by this
// script. It exists so the LATER deep-tune (deferred to the consolidated
// cross-milestone pass) has a ready place to simulate N seeded runs and read
// gold-earned / gold-by-source / gold-at-death distributions.
//
// THIS IS A TUNING PROXY, NOT A PASS/FAIL GATE, and NOT a substitute for a
// human playtest. A heuristic bot's play skill is arbitrary (it explores
// blindly and never shops), so its gold curves are a rough sanity signal only.
// Do NOT gate any build or CI check on this script's output.
//
// It shares tune-difficulty.mjs's auto-play policy skeleton (explore via BFS,
// attack/flee/parley in combat, leave any store). The ONLY difference is what
// it measures: wilmst (gold) flow rather than death depth. Gold sources are
// read from the `goldGained` event's `why` tag that gainWilmst() already
// emits (engine/items.js), so no engine change is needed to attribute income.
//
// Run:
//   node tools/tune-economy.mjs --seeds=200
//   node tools/tune-economy.mjs --seeds=200 --json

import { newRun, applyAction } from "../engine/engine.js";
import { makeRng } from "../engine/rng.js";
import { canParley } from "../engine/combat.js";

const MAX_ACTIONS = 20000; // hard safety stop — prevents a runaway loop bug from hanging the harness

const DIRS = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };

// --- auto-play policy (mirrors tune-difficulty.mjs; black-box engine use) ---

function canStep(f, x, y, dir) {
  const [dx, dy] = DIRS[dir];
  const nx = x + dx;
  const ny = y + dy;
  const there = f.g[ny] && f.g[ny][nx];
  if (!there || there.wall) return false;
  if (there.feat === "one" && there.dir !== dir) return false;
  const here = f.g[y][x];
  if (here.feat === "one" && here.dir !== dir) return false;
  return true;
}

function nearestUnseenDir(state) {
  const f = state.floor;
  const visited = new Set([`${f.px},${f.py}`]);
  const queue = [{ x: f.px, y: f.py, first: null }];
  let qi = 0;
  while (qi < queue.length) {
    const { x, y, first } = queue[qi++];
    const cell = f.g[y] && f.g[y][x];
    if (cell && !cell.seen && !(x === f.px && y === f.py)) return first;
    for (const dir of Object.keys(DIRS)) {
      if (!canStep(f, x, y, dir)) continue;
      const [dx, dy] = DIRS[dir];
      const nx = x + dx;
      const ny = y + dy;
      const key = `${nx},${ny}`;
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push({ x: nx, y: ny, first: first || dir });
    }
  }
  return null;
}

function legalDirs(state) {
  const f = state.floor;
  const legal = [];
  for (const dir of Object.keys(DIRS)) if (canStep(f, f.px, f.py, dir)) legal.push(dir);
  return legal;
}

function pickFallbackDir(state, policyRng) {
  const legal = legalDirs(state);
  return legal.length ? policyRng.pick(legal) : policyRng.pick(["N", "S", "E", "W"]);
}

function decideAction(state, policyRng) {
  if (state.combat) {
    const c = state.c;
    const ratio = c.maxWP > 0 ? c.wp / c.maxWP : 0;
    if (ratio < 0.3) {
      if (canParley(state)) return { type: "parley" };
      return { type: "flee" };
    }
    return { type: "attack" };
  }
  // The economy harness declines any offered find and leaves any store (buy/
  // sell strategy is out of scope for this first-pass income-curve signal).
  if (state.pendingFind) return { type: "leaveFind" };
  if (state.store) return { type: "leaveStore" };
  const dir = nearestUnseenDir(state) || pickFallbackDir(state, policyRng);
  return { type: "move", dir };
}

/**
 * autoPlayOnce(seed) — one full run; accumulates the gold (wilmst) economy
 * signal. policyRng is a SEPARATE stream (seed ^ 0x9e3779b9) so harness
 * decisions never perturb the engine's seeded determinism.
 */
function autoPlayOnce(seed) {
  const policyRng = makeRng(seed ^ 0x9e3779b9);
  let state = newRun(seed);
  let actions = 0;
  const startGold = state.c.gold;
  let peakGold = startGold;
  let earned = 0; // sum of positive goldGained amounts
  const bySource = {}; // why -> total amount
  while (!state.dead && !state.won && actions < MAX_ACTIONS) {
    const action = decideAction(state, policyRng);
    let events;
    ({ state, events } = applyAction(state, action));
    for (const e of events) {
      if (e.type === "goldGained" && typeof e.amount === "number") {
        earned += e.amount;
        const why = e.why || "unknown";
        bySource[why] = (bySource[why] || 0) + e.amount;
      }
    }
    if (state.c.gold > peakGold) peakGold = state.c.gold;
    actions++;
  }
  return {
    seed,
    deathDepth: state.floor.depth,
    dead: state.dead,
    won: state.won,
    actions,
    startGold,
    endGold: state.c.gold,
    peakGold,
    earned,
    bySource,
  };
}

// --- reporting -----------------------------------------------------------

function percentile(sortedArr, p) {
  if (!sortedArr.length) return 0;
  const idx = Math.min(sortedArr.length - 1, Math.floor(p * sortedArr.length));
  return sortedArr[idx];
}

function distribution(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    min: sorted[0] ?? 0,
    p50: percentile(sorted, 0.5),
    p90: percentile(sorted, 0.9),
    max: sorted[sorted.length - 1] ?? 0,
  };
}

function sourceBreakdown(results) {
  const totals = {};
  for (const r of results) for (const [why, amt] of Object.entries(r.bySource)) totals[why] = (totals[why] || 0) + amt;
  const grand = Object.values(totals).reduce((a, b) => a + b, 0) || 1;
  return Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .map(([why, amt]) => ({ why, amt, pct: (amt / grand) * 100 }));
}

function printReport(results) {
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
}

// --- CLI -----------------------------------------------------------------

function parseArgs(argv) {
  const opts = { seeds: 200, json: false };
  for (const arg of argv) {
    if (arg.startsWith("--seeds=")) {
      const n = parseInt(arg.slice("--seeds=".length), 10);
      if (Number.isFinite(n) && n > 0) opts.seeds = n;
    } else if (arg === "--json") {
      opts.json = true;
    }
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const seeds = Array.from({ length: opts.seeds }, (_, i) => i * 7919 + 1);
  const results = seeds.map((seed) => autoPlayOnce(seed));

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
        },
        null,
        2,
      ),
    );
  } else {
    printReport(results);
  }
}

main();
