#!/usr/bin/env node
// tools/tune-difficulty.mjs
//
// Dev-only, zero-dependency Node ESM script — NOT shipped, NOT a node:test
// file (it makes no assertions, so `node --test` never picks it up). Imports
// only from engine/ (through the public applyAction/newRun/makeRng surface,
// never engine internals directly) and Node builtins.
//
// THIS IS A TUNING PROXY, NOT A PASS/FAIL GATE, and NOT a substitute for the
// deferred human playtest (03-CONTEXT.md / 03-RESEARCH.md Pitfall 3 — a
// heuristic bot's play skill is arbitrary: it may flee too eagerly,
// understating combat lethality, or too rarely, overstating it). Do not gate
// any build or CI check on this script's output; read the distributions as
// a rough sanity signal while hand-tuning engine/difficulty.js's constants.
//
// Until Plan 02 makes descent endless, every run still terminates at the
// legacy floor-5 Gate (state.won) almost immediately — the death-depth
// distribution only becomes a meaningful signal after Plan 02 (endless
// descent) and Plan 03 (one-tap new-run loop) land.
//
// Run:
//   node tools/tune-difficulty.mjs --seeds=200
//   node tools/tune-difficulty.mjs --seeds=200 --json

import { newRun, applyAction } from "../engine/engine.js";
import { makeRng } from "../engine/rng.js";
import { canParley } from "../engine/combat.js";

const MAX_ACTIONS = 20000; // hard safety stop — prevents a runaway loop bug from hanging the harness

// The four cardinal directions the movement domain understands. Defined
// locally (not imported from engine/movement.js) so this harness only ever
// talks to the engine through its public applyAction/newRun black-box
// surface, exactly as the real UI would.
const DIRS = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };

/**
 * canStep(f, x, y, dir) — mirrors movement.js's move() one-way-door guard
 * exactly: a step is illegal if the destination is a wall/out-of-bounds, OR
 * the destination is a "one" (one-way door) tile entered from the wrong
 * side, OR the CURRENT tile is a "one" tile departed in the wrong direction.
 * Without this guard, BFS/legalDirs would recommend a move() call that
 * silently no-ops (movement.js's approach/departure blocked branches),
 * which — since the player's position never changes — would make
 * nearestUnseenDir() recommend the exact same blocked direction forever,
 * burning the entire MAX_ACTIONS budget on a stall instead of exploring.
 */
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

/**
 * nearestUnseenDir(state) — BFS over the current floor's open cells from the
 * player's position (respecting one-way doors via canStep); returns the
 * first-step direction toward the nearest still-unseen tile, or null if
 * every reachable tile is already seen. No engine RNG involved — pure grid
 * search over state.floor.g.
 */
function nearestUnseenDir(state) {
  const f = state.floor;
  const startKey = `${f.px},${f.py}`;
  const visited = new Set([startKey]);
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

/** legalDirs(state) — cardinal directions that lead onto a real, enterable cell. */
function legalDirs(state) {
  const f = state.floor;
  const legal = [];
  for (const dir of Object.keys(DIRS)) {
    if (canStep(f, f.px, f.py, dir)) legal.push(dir);
  }
  return legal;
}

/**
 * pickFallbackDir(state, policyRng) — a policyRng-picked legal direction,
 * used when nearestUnseenDir() finds no reachable unseen tile (floor fully
 * explored). Falls back to any cardinal direction in the (should-never-
 * happen-on-a-generated-floor) case of being fully boxed in.
 */
function pickFallbackDir(state, policyRng) {
  const legal = legalDirs(state);
  return legal.length ? policyRng.pick(legal) : policyRng.pick(["N", "S", "E", "W"]);
}

/**
 * decideAction(state, policyRng) — the documented, deterministic heuristic
 * auto-play policy (03-RESEARCH.md "Headless tuning harness skeleton"):
 *   - in combat: attack, UNLESS wp/maxWP < ~0.3 AND flee/parley is viable,
 *     in which case prefer parley (if canParley-equivalent conditions hold)
 *     else flee;
 *   - in a store: leave immediately (store strategy is out of scope for the
 *     difficulty-curve question this harness answers);
 *   - otherwise: explore toward the nearest unseen tile (BFS), falling back
 *     to a policyRng-picked legal direction.
 * `policyRng` is a SEPARATE rng stream from the engine's own — see
 * autoPlayOnce() — so harness decisions never perturb engine determinism.
 */
function decideAction(state, policyRng) {
  if (state.combat) {
    const c = state.c;
    const ratio = c.maxWP > 0 ? c.wp / c.maxWP : 0;
    if (ratio < 0.3) {
      // Prefer parley when this encounter type is talkable-down (the
      // engine's own canParley() gate — race/sub/skill/encounter-type
      // dependent); otherwise flee.
      if (canParley(state)) return { type: "parley" };
      return { type: "flee" };
    }
    return { type: "attack" };
  }
  if (state.store) {
    return { type: "leaveStore" };
  }
  const dir = nearestUnseenDir(state) || pickFallbackDir(state, policyRng);
  return { type: "move", dir };
}

/**
 * autoPlayOnce(seed) — plays one full run to completion (death, win, or the
 * MAX_ACTIONS safety stop). Uses a harness-local policyRng =
 * makeRng(seed ^ 0x9e3779b9) — a SEPARATE stream from the engine's own
 * rngState — so the policy's own dice-rolling never perturbs the engine's
 * seeded determinism.
 */
function autoPlayOnce(seed) {
  const policyRng = makeRng(seed ^ 0x9e3779b9);
  let state = newRun(seed);
  let actions = 0;
  // Phase 20 (D-15): a READOUT ONLY (informational, like 18-06's tune-
  // difficulty readout, never a pass/fail gate) tallying parley attempts /
  // successes / failures / refusals / exhausted-retries / SP share per run.
  // parleyExhausted is expected to read 0 until the Phase 20 engine rules
  // (20-02) land — this plan touches no dial, no economy number, and no
  // policy decision (decideAction is unchanged).
  let parleyAttempts = 0;
  let parleySuccesses = 0;
  let parleyFailures = 0;
  let parleyRefused = 0;
  let parleyExhausted = 0;
  let parleySp = 0;
  while (!state.dead && !state.won && actions < MAX_ACTIONS) {
    const action = decideAction(state, policyRng);
    let events;
    ({ state, events } = applyAction(state, action));
    for (const e of events) {
      if (e.type === "parleyRolled") parleyAttempts++;
      else if (e.type === "spGained" && e.reason === "parley") {
        parleySuccesses++;
        parleySp += e.amount;
      } else if (e.type === "parleyFailed") parleyFailures++;
      else if (e.type === "parleyRefused") parleyRefused++;
      else if (e.type === "parleyExhausted") parleyExhausted++;
    }
    actions++;
  }
  return {
    seed,
    deathDepth: state.floor.depth,
    dead: state.dead,
    won: state.won,
    cause: state.deathNote || (state.won ? "walked out" : actions >= MAX_ACTIONS ? "maxActionsHit" : "unknown"),
    actions,
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

function printReport(results) {
  const depths = distribution(results.map((r) => r.deathDepth));
  const actions = distribution(results.map((r) => r.actions));
  const causes = causeBreakdown(results);
  const wonCount = results.filter((r) => r.won).length;
  const deadCount = results.filter((r) => r.dead).length;
  const stoppedCount = results.filter((r) => !r.dead && !r.won).length;

  console.log(`\ntune-difficulty: ${results.length} seeded auto-play run(s)`);
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

  console.log(`\nOutcome: ${deadCount} dead, ${wonCount} won (legacy floor-5 Gate), ${stoppedCount} hit MAX_ACTIONS`);
  if (wonCount > 0) {
    console.log(
      "NOTE: runs still terminate at the legacy floor-5 Gate (state.won) — this harness becomes a",
    );
    console.log("meaningful depth-distribution signal only after Plan 02 (endless descent) lands.");
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
  // Deterministic, reproducible seed list (not the engine's own rng — this is
  // just which seeds to sample, chosen with a simple stride so re-running
  // with the same --seeds=N always samples the identical set of runs).
  const seeds = Array.from({ length: opts.seeds }, (_, i) => i * 7919 + 1);
  const results = seeds.map((seed) => autoPlayOnce(seed));

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          runs: results.length,
          deathDepth: distribution(results.map((r) => r.deathDepth)),
          actions: distribution(results.map((r) => r.actions)),
          causes: causeBreakdown(results),
          won: results.filter((r) => r.won).length,
          dead: results.filter((r) => r.dead).length,
          parley: parleySummary(results),
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
