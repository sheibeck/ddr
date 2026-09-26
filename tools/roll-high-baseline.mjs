#!/usr/bin/env node
// tools/roll-high-baseline.mjs
//
// Phase 73 (ROLL-05, Plan 02): the generator behind test/unit/harness/
// rollHighBaseline.js — pins the UNTOUCHED engine's outcomes BEFORE any
// Phase 73 engine edit. Dev-only, zero-dependency Node ESM script — NOT
// shipped, NOT a node:test file.
//
// Modes:
//   node tools/roll-high-baseline.mjs pins
//     Runs every PIN_RUNS entry TWICE, fails loudly if the two hashes for
//     any entry differ (stateHash must be deterministic before anything is
//     pinned), then prints the pinned table as JavaScript object literals
//     ready to paste into test/unit/roll-high-state-pins.test.js.
//
//   node tools/roll-high-baseline.mjs save
//     Builds the pre-switch save fixture (test/unit/fixtures/roll-high/
//     pre-switch-save.json): a bot-played, party seed run snapshotted at the
//     first "quiet" step (no combat/store/pending*), reloaded through the
//     shell's own load path, then continued for ~300 more actions. Prints
//     the fixture's summary; writes the fixture file itself.

import { PIN_RUNS, pinRun, stateHash, botSteps, loadSave, serializeRun, forceParty } from "../test/unit/harness/rollHighBaseline.js";
import { newRun } from "../engine/engine.js";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const FIXTURE_PATH = path.resolve(REPO_ROOT, "test/unit/fixtures/roll-high/pre-switch-save.json");

function isQuiet(state) {
  return (
    !state.combat &&
    !state.store &&
    !state.pendingJoiner &&
    !state.pendingFind &&
    !state.pendingHazard &&
    // RULES-12 (Phase 75, Plan 12): pendingTile is a ninth transient
    // decision field, mirroring pendingHazard just above — never snapshot
    // mid-resolution.
    !state.pendingTile &&
    (!state.pendingLoot || state.pendingLoot.length === 0)
  );
}

function runPins() {
  let failures = 0;
  const pinnedTable = [];
  for (const cfg of PIN_RUNS) {
    const first = pinRun(cfg);
    const second = pinRun(cfg);
    if (first.hash !== second.hash) {
      failures++;
      console.error(`NON-DETERMINISTIC: ${cfg.label} hashed differently across two runs of the same seed/opts:`);
      console.error(`  run 1: ${JSON.stringify(first)}`);
      console.error(`  run 2: ${JSON.stringify(second)}`);
      continue;
    }
    console.log(`OK  ${cfg.label}: hashed identically twice (actions=${first.actions} dead=${first.dead} depth=${first.depth})`);
    pinnedTable.push(first);
  }
  if (failures > 0) {
    console.error(`\n${failures} PIN_RUNS entr${failures === 1 ? "y" : "ies"} non-deterministic. Fix stateHash before pinning.`);
    process.exit(1);
  }
  console.log("\n// Paste into test/unit/roll-high-state-pins.test.js's PINNED table:");
  console.log("export const PINNED = " + JSON.stringify(Object.fromEntries(pinnedTable.map((r) => [r.label, { actions: r.actions, dead: r.dead, depth: r.depth, hash: r.hash }])), null, 2) + ";");
  process.exit(0);
}

function gitShortHead() {
  try {
    return execSync("git rev-parse --short HEAD", { cwd: REPO_ROOT }).toString().trim();
  } catch {
    return "unknown";
  }
}

function runSave() {
  const seed = 909;
  const opts = { party: true, startDepth: 3, maxActions: 400 };
  const policySeed = seed;
  let state = newRun(seed, [], { startDepth: opts.startDepth });
  forceParty(state);

  // Walk the bot one action at a time (mirroring playRun's own dispatch
  // shape via botSteps), stopping at the FIRST quiet step (state.combat
  // null, nothing pending) after a short warm-up. If that step's save
  // doesn't round-trip through loadSave (should never happen — quiet means
  // quiet — but the plan calls for the fallback explicitly), keep walking
  // and try the next quiet step.
  let dispatchedSoFar = [];
  let snapshotAt = -1;
  let save = null;
  let loaded = null;
  for (let i = 0; i < opts.maxActions && !state.dead; i++) {
    const stepResult = botSteps(state, policySeed, opts, 1);
    dispatchedSoFar = dispatchedSoFar.concat(stepResult.dispatched);
    state = stepResult.state;
    if (i < 5 || !isQuiet(state)) continue;
    const candidateSave = serializeRun(state);
    const candidateLoaded = loadSave(candidateSave);
    if (stateHash(candidateLoaded) === stateHash(state)) {
      save = candidateSave;
      loaded = candidateLoaded;
      snapshotAt = i;
      break;
    }
  }
  if (!save) {
    console.error("save: never found a quiet step that round-trips through loadSave within maxActions — widen the budget.");
    process.exit(1);
  }
  console.log(`Snapshot taken after ${dispatchedSoFar.length} warm-up actions (quiet at step ${snapshotAt}), hash matches through loadSave round trip.`);

  const continued = botSteps(loaded, policySeed, opts, 300);
  const expected = {
    actions: continued.dispatched.length,
    dead: continued.state.dead,
    depth: continued.state.floor.depth,
    hash: stateHash(continued.state),
  };

  const baseCommit = gitShortHead();
  const fixture = {
    baseCommit,
    rollLogicUnchangedSince: "c3513b0",
    note:
      `This save was written by the pre-switch engine at commit ${baseCommit} (recorded above). ` +
      `\`git diff --stat c3513b0 ${baseCommit} -- engine/\` touches only engine/records.js ` +
      "(Phase 81 leaderboard bookkeeping) — the roll logic itself is unchanged since the " +
      "Phase 72 close (c3513b0). The switch keeps every stored number's meaning, so no " +
      "migration exists and none is needed. A failure means a check was flipped wrong or a " +
      "stored field changed meaning. Never regenerate this fixture in Phase 73.",
    seed,
    opts,
    save,
    dispatched: continued.dispatched,
    expected,
  };

  fs.mkdirSync(path.dirname(FIXTURE_PATH), { recursive: true });
  fs.writeFileSync(FIXTURE_PATH, JSON.stringify(fixture, null, 2) + "\n");
  console.log(`Wrote ${FIXTURE_PATH}`);
  console.log(`dispatched.length=${fixture.dispatched.length} expected=${JSON.stringify(expected)}`);
  process.exit(0);
}

function main() {
  const mode = process.argv[2];
  if (mode === "pins") return runPins();
  if (mode === "save") return runSave();
  console.error("Usage: node tools/roll-high-baseline.mjs <pins|save>");
  process.exit(1);
}

main();
