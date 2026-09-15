// Unit tests for engine/maze.js: genFloor, bfs, reveal — the pure,
// RNG-injected floor generator ported from mazeworld.html lines 1167-1287
// (ENG-02, ENG-05).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { genFloor, bfs, reveal, GW, GH } from "../../engine/maze.js";
import { makeRng } from "../../engine/rng.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

function countFeats(g) {
  const counts = {};
  for (const row of g) for (const c of row) if (c.feat) counts[c.feat] = (counts[c.feat] || 0) + 1;
  return counts;
}

test("GW/GH are the prototype's fixed 21x21 grid dimensions", () => {
  assert.equal(GW, 21);
  assert.equal(GH, 21);
});

test("genFloor(1, rng) returns { g, px:1, py:1, depth:1 } with a 21x21 grid of {wall,seen,feat}", () => {
  const floor = genFloor(1, makeRng(42));
  assert.equal(floor.px, 1);
  assert.equal(floor.py, 1);
  assert.equal(floor.depth, 1);
  assert.equal(floor.g.length, GH);
  for (const row of floor.g) {
    assert.equal(row.length, GW);
    for (const cell of row) {
      assert.equal(typeof cell.wall, "boolean");
      assert.equal(cell.seen, false);
      assert.ok(cell.feat === null || typeof cell.feat === "string");
    }
  }
});

test("genFloor: depth 1 places exactly one 'exit' feature, no 'gate'", () => {
  const floor = genFloor(1, makeRng(42));
  const counts = countFeats(floor.g);
  assert.equal(counts.exit, 1);
  assert.equal(counts.gate, undefined);
});

test("genFloor: depth 5 places exactly one 'exit' feature, no 'gate' (endless descent — RUN-02, the phase's one intentional behavior change from the frozen prototype's fixed 5-floor Gate)", () => {
  const floor = genFloor(5, makeRng(42));
  const counts = countFeats(floor.g);
  assert.equal(counts.exit, 1);
  assert.equal(counts.gate, undefined);
});

test("genFloor: depth 4 still places 'exit', not 'gate' (Gate is depth >= 5 only)", () => {
  const floor = genFloor(4, makeRng(42));
  const counts = countFeats(floor.g);
  assert.equal(counts.exit, 1);
  assert.equal(counts.gate, undefined);
});

test("genFloor: feature counts match the prototype's formula for seed 42, depths 1-5", () => {
  // Locked to actual genFloor(depth, makeRng(42)) output — dots sourced from
  // difficultyCurve(depth); depths 1-2 reproduce the old 9+depth formula by
  // construction (DENSITY_CANON_THROUGH_DEPTH); depths 3-5 carry Phase 27's
  // (2026-09-15, TUNE-06) deliberate early-floor easing (was dot 12/13/14 —
  // re-measured live against the patched engine, never hand-computed). 2
  // each of tele/chest/trap/climb/gorge, up to 3 one-way doors. depth-5's
  // descent tile is now "exit" (endless descent, RUN-02) instead of "gate" —
  // a separate, earlier intentional behavior change vs the frozen prototype.
  const expected = {
    1: { dot: 10, tele: 2, chest: 2, trap: 2, climb: 2, gorge: 2, one: 3, exit: 1 },
    2: { dot: 11, tele: 2, chest: 2, trap: 2, climb: 2, gorge: 2, one: 3, exit: 1 },
    3: { dot: 11, tele: 2, chest: 2, trap: 2, climb: 2, gorge: 2, one: 3, exit: 1 },
    4: { dot: 12, tele: 2, chest: 2, trap: 2, climb: 2, gorge: 2, one: 3, exit: 1 },
    5: { dot: 12, tele: 2, chest: 2, trap: 2, climb: 2, gorge: 2, one: 3, exit: 1 },
  };
  for (const depth of [1, 2, 3, 4, 5]) {
    const floor = genFloor(depth, makeRng(42));
    const counts = countFeats(floor.g);
    assert.deepEqual(counts, expected[depth], `depth ${depth} feature counts`);
  }
});

test("genFloor: no depth ever produces a 'gate' feature — descent is endless (RUN-02)", () => {
  for (const depth of [5, 6, 10, 20, 50, 100]) {
    const floor = genFloor(depth, makeRng(42));
    const counts = countFeats(floor.g);
    assert.equal(counts.gate, undefined, `depth ${depth} must never place a 'gate'`);
    assert.equal(counts.exit, 1, `depth ${depth} must place exactly one 'exit'`);
  }
});

test("WR-01: genFloor returns difficultyCurve's sanitized depth, not the raw (possibly tampered) parameter", () => {
  // A hand-edited/corrupted save could carry a negative, non-integer, or
  // non-finite floor.depth (engine/saveState.js#isValidFloor only checks
  // Number.isInteger, not >= 1). Before the fix, genFloor computed
  // difficultyCurve(depth) (correctly sanitized internally for the
  // dots/darkBlobs/darkRadius knobs) but still returned the raw, untouched
  // `depth` parameter in the floor object — so the corruption survived into
  // the very state the safeDepth() guard exists to protect.
  for (const tampered of [-500, 0, -1, 1.7, NaN, Infinity, -Infinity]) {
    const floor = genFloor(tampered, makeRng(7));
    assert.ok(Number.isInteger(floor.depth), `depth ${tampered}: returned floor.depth must be a sane integer, got ${floor.depth}`);
    assert.ok(floor.depth >= 1, `depth ${tampered}: returned floor.depth must be >= 1, got ${floor.depth}`);
  }
});

test("genFloor is pure: no Math.random / document / localStorage / window in engine/maze.js", () => {
  const source = fs.readFileSync(path.join(REPO_ROOT, "engine", "maze.js"), "utf8");
  const noBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""));
  const codeOnly = noBlockComments
    .split("\n")
    .map((line) => {
      const idx = line.indexOf("//");
      return idx === -1 ? line : line.slice(0, idx);
    })
    .join("\n");
  assert.doesNotMatch(codeOnly, /Math\.random/);
  assert.doesNotMatch(codeOnly, /\bdocument\b/);
  assert.doesNotMatch(codeOnly, /\blocalStorage\b/);
  assert.doesNotMatch(codeOnly, /\bwindow\b/);
});

test("bfs: distances on a hand-built grid with a straight corridor and a branch", () => {
  // Build a full GWxGH all-wall grid (bfs's bounds check is hardcoded to
  // GW/GH, matching the prototype's own hardcoded assumption — see
  // engine/maze.js), then hand-carve a small open path:
  //   (1,1)-(1,2)-(1,3)-(1,4)-(1,5) vertical corridor, plus a branch (2,3).
  const g = [];
  for (let y = 0; y < GH; y++) {
    g.push([]);
    for (let x = 0; x < GW; x++) g[y].push({ wall: true, seen: false, feat: null });
  }
  const openCells = [
    [1, 1],
    [1, 2],
    [1, 3],
    [1, 4],
    [1, 5],
    [2, 3],
  ];
  for (const [x, y] of openCells) g[y][x].wall = false;

  const d = bfs(g, 1, 1);
  assert.equal(d[1][1], 0);
  assert.equal(d[2][1], 1);
  assert.equal(d[3][1], 2);
  assert.equal(d[4][1], 3);
  assert.equal(d[5][1], 4);
  assert.equal(d[3][2], 3); // via the branch: (1,1)->(1,2)->(1,3)->(2,3)
  // An open cell not reachable from the carved path (isolated) stays -1.
  g[10][10].wall = false;
  const d2 = bfs(g, 1, 1);
  assert.equal(d2[10][10], -1);
});

test("reveal(floor): default radius 2 marks the 5x5 square around the player, clipped to bounds", () => {
  const floor = genFloor(1, makeRng(1));
  // Player starts at (1,1); before reveal, cells start seen:false (except
  // whatever genFloor itself sets, which is nothing — seen defaults false).
  reveal(floor);
  for (let y = -1; y <= 3; y++) {
    for (let x = -1; x <= 3; x++) {
      if (x < 0 || y < 0) continue; // out of bounds, nothing to check
      assert.equal(floor.g[y][x].seen, true, `expected (${x},${y}) seen`);
    }
  }
  // A cell well outside the radius must remain unseen.
  assert.equal(floor.g[10][10].seen, false);
});

test("reveal(floor, radius): custom radius widens/narrows the revealed square", () => {
  const floor = genFloor(1, makeRng(1));
  reveal(floor, 1);
  assert.equal(floor.g[0][0].seen, true);
  assert.equal(floor.g[2][2].seen, true);
  assert.equal(floor.g[3][3].seen, false); // outside radius-1 square
});
