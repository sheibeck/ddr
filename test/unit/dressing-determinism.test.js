// test/unit/dressing-determinism.test.js
//
// Phase 59 (DRESS-01..05), Plan 02 — the DRESS-04 ledger: proof that dungeon
// set dressing is a pure function of seed, depth and the immutable floor
// structure, and that placing/drawing it NEVER changes how a run plays or
// touches the engine's own state. Every test here drives the REAL engine
// (engine/state.js#newRun, engine/engine.js#applyAction, engine/saveState.js)
// alongside src/browser/dressing.js — this file is the load-bearing evidence
// for the threat register's T-59-04 mitigation.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { newRun } from "../../engine/state.js";
import { applyAction } from "../../engine/engine.js";
import { serializeRun, validateSave, rehydrate } from "../../engine/saveState.js";
import { placeDressing, drawDressingLayer, DRESSING_ICON_NAMES } from "../../src/browser/dressing.js";
import { drawFeatureIcon } from "../../src/browser/icons.js";
import { createRecordingContext } from "./harness/recordingCanvas.js";
import { stripJs } from "../../tools/ident-sweep.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

function decodedImageMap() {
  const images = {};
  for (const name of DRESSING_ICON_NAMES) images[name] = { complete: true, naturalWidth: 144 };
  return images;
}

// --- DRESS-04: placement is a pure function of (seed, depth, grid) --------

test("DRESS-04: placeDressing on the same seed/depth/grid twice, on a structuredClone of the grid, and after a full save/reload round trip all give JSON-identical arrays", () => {
  const state = newRun(42);
  const { seed } = state;
  const { depth, g: grid } = state.floor;

  const first = placeDressing({ seed, depth, grid });
  const second = placeDressing({ seed, depth, grid });
  assert.equal(JSON.stringify(first), JSON.stringify(second));

  const clonedGrid = structuredClone(grid);
  const onClone = placeDressing({ seed, depth, grid: clonedGrid });
  assert.equal(JSON.stringify(first), JSON.stringify(onClone));

  // The landed real-world call shape (see e.g. test/unit/loot-pile.test.js):
  // serializeRun -> JSON.stringify -> validateSave -> .value -> rehydrate.
  const reloaded = rehydrate(validateSave(JSON.stringify(serializeRun(state))).value);
  const onReload = placeDressing({ seed: reloaded.seed, depth: reloaded.floor.depth, grid: reloaded.floor.g });
  assert.equal(JSON.stringify(first), JSON.stringify(onReload));
});

test("Resolving a feature does not move a prop: clearing every feat on a cloned grid leaves placeDressing's output JSON-identical", () => {
  const state = newRun(77);
  const { seed } = state;
  const { depth, g: grid } = state.floor;

  const before = placeDressing({ seed, depth, grid });

  const resolvedGrid = structuredClone(grid);
  for (const row of resolvedGrid) {
    for (const cell of row) cell.feat = null;
  }
  const after = placeDressing({ seed, depth, grid: resolvedGrid });
  assert.equal(JSON.stringify(before), JSON.stringify(after));
});

// --- Engine untouched: dressing never mutates state or its rng cursor -----

test("Engine untouched: running placeDressing + drawDressingLayer on a fresh state never changes JSON.stringify(state) or state.rngState", () => {
  const state = newRun(555);
  const before = JSON.stringify(state);
  const beforeRngState = state.rngState;

  const props = placeDressing({ seed: state.seed, depth: state.floor.depth, grid: state.floor.g });
  const ctx = createRecordingContext();
  drawDressingLayer(ctx, props, {
    grid: state.floor.g,
    party: { x: state.floor.px, y: state.floor.py },
    images: decodedImageMap(),
    cell: 32,
    drawIcon: drawFeatureIcon,
  });

  assert.equal(JSON.stringify(state), before);
  assert.equal(state.rngState, beforeRngState);
});

// --- Dressing never changes how a run plays --------------------------------

const MOVE_CYCLE = ["E", "S", "W", "N"];

function runScriptedWalk(seed, { drawDressing }) {
  let state = newRun(seed);
  for (let i = 0; i < 40; i++) {
    const dir = MOVE_CYCLE[i % MOVE_CYCLE.length];
    const result = applyAction(state, { type: "move", dir });
    state = result.state; // a rejected/combat-blocked move just returns the same state — still the next action

    if (drawDressing) {
      const props = placeDressing({ seed: state.seed, depth: state.floor.depth, grid: state.floor.g });
      const ctx = createRecordingContext();
      drawDressingLayer(ctx, props, {
        grid: state.floor.g,
        party: { x: state.floor.px, y: state.floor.py },
        images: decodedImageMap(),
        cell: 32,
        drawIcon: drawFeatureIcon,
      });
    }
  }
  return state;
}

test("Dressing never changes how a run plays: a 40-move scripted walk ends with byte-identical serializeRun output whether or not placeDressing/drawDressingLayer ran on every intermediate state", () => {
  const seed = 20260922;
  const withoutDressing = runScriptedWalk(seed, { drawDressing: false });
  const withDressing = runScriptedWalk(seed, { drawDressing: true });
  assert.equal(JSON.stringify(serializeRun(withoutDressing)), JSON.stringify(serializeRun(withDressing)));
});

// --- Walls are immutable at runtime ----------------------------------------

test("Walls are immutable at runtime: no engine/*.js file except engine/maze.js assigns a .wall property", () => {
  const engineDir = path.join(REPO_ROOT, "engine");
  const files = fs.readdirSync(engineDir).filter((f) => f.endsWith(".js") && f !== "maze.js");
  assert.ok(files.length > 0, "expected to find engine/*.js files to scan");
  const wallAssignRe = /\.wall\s*=[^=]/;
  for (const file of files) {
    const src = fs.readFileSync(path.join(engineDir, file), "utf8");
    const stripped = stripJs(src);
    assert.doesNotMatch(stripped, wallAssignRe, `${file} must never assign .wall — walls are fixed at genFloor time`);
  }
});
