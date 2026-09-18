// test/unit/terrain.test.js
//
// Phase 41 (TERR-01, Plan 01, Task 2): water pool placement — every depth
// carries pools, every pool respects the eligibility rules, every pool is
// contiguous, generation stays deterministic, the difficultyCurve waterPools
// table is pinned, the draw ORDER (seed pick, size draw, growth picks) is
// proven against a hand-built grid and a scripted rng, and the main rng
// cursor stays byte-identical to the pre-Phase-41 pin.

import test from "node:test";
import assert from "node:assert/strict";

import { genFloor, bfs, placeWater, GW, GH } from "../../engine/maze.js";
import { makeRng } from "../../engine/rng.js";
import { difficultyCurve, WATER_POOL_SIZE_MIN, WATER_POOL_SIZE_MAX } from "../../engine/difficulty.js";

const SEEDS = [1, 7, 42, 256, 2026];

test("every depth 1..30, every seed: genFloor places at least WATER_POOL_SIZE_MIN and at most waterPools*WATER_POOL_SIZE_MAX water cells", () => {
  for (const seed of SEEDS) {
    for (let depth = 1; depth <= 30; depth++) {
      const floor = genFloor(depth, makeRng(seed));
      let n = 0;
      for (const row of floor.g) for (const cell of row) if (cell.water === true) n++;
      const dc = difficultyCurve(depth);
      assert.ok(n >= WATER_POOL_SIZE_MIN, `seed ${seed} depth ${depth}: expected >= ${WATER_POOL_SIZE_MIN} water cells, got ${n}`);
      assert.ok(n <= dc.waterPools * WATER_POOL_SIZE_MAX, `seed ${seed} depth ${depth}: expected <= ${dc.waterPools * WATER_POOL_SIZE_MAX} water cells, got ${n}`);
    }
  }
});

test("no water cell is a wall, has a feat, is the spawn cell, has dist <= 4 from spawn, or is orthogonally adjacent to the exit", () => {
  for (const seed of SEEDS) {
    for (const depth of [1, 2, 5, 6, 9, 15, 20]) {
      const floor = genFloor(depth, makeRng(seed));
      const dist = bfs(floor.g, floor.px, floor.py);
      let ex = -1;
      let ey = -1;
      for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (floor.g[y][x].feat === "exit") { ex = x; ey = y; }
      for (let y = 0; y < GH; y++) {
        for (let x = 0; x < GW; x++) {
          const cell = floor.g[y][x];
          if (cell.water !== true) continue;
          assert.equal(cell.wall, false, `seed ${seed} depth ${depth}: water cell (${x},${y}) is a wall`);
          assert.equal(!!cell.feat, false, `seed ${seed} depth ${depth}: water cell (${x},${y}) has a feat (${cell.feat})`);
          assert.ok(!(x === floor.px && y === floor.py), `seed ${seed} depth ${depth}: water cell (${x},${y}) is the spawn cell`);
          assert.ok(dist[y][x] > 4, `seed ${seed} depth ${depth}: water cell (${x},${y}) has dist ${dist[y][x]} <= 4 from spawn`);
          if (ex >= 0) {
            assert.ok(Math.abs(x - ex) + Math.abs(y - ey) !== 1, `seed ${seed} depth ${depth}: water cell (${x},${y}) is orthogonally adjacent to the exit (${ex},${ey})`);
          }
        }
      }
    }
  }
});

test("every water pool is contiguous (a BFS restricted to the pool's own cells reaches every member)", () => {
  for (const seed of SEEDS) {
    for (const depth of [1, 6, 9, 12, 20]) {
      // Build the maze/features/dark pass identically to genFloor, then call
      // placeWater directly to capture its `pools` return value (genFloor
      // itself doesn't expose it) — a second, independent derived-stream
      // rng, mirroring the call genFloor makes internally.
      const floor = genFloor(depth, makeRng(seed));
      for (const row of floor.g) for (const cell of row) delete cell.water;
      const pools = placeWater(floor.g, depth, makeRng(seed * 7919 + depth));
      for (const pool of pools) {
        const keys = new Set(pool.map(([x, y]) => `${x},${y}`));
        const visited = new Set();
        const q = [pool[0]];
        visited.add(`${pool[0][0]},${pool[0][1]}`);
        while (q.length) {
          const [x, y] = q.shift();
          for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
            const nk = `${x + dx},${y + dy}`;
            if (keys.has(nk) && !visited.has(nk)) {
              visited.add(nk);
              q.push([x + dx, y + dy]);
            }
          }
        }
        assert.equal(visited.size, pool.length, `seed ${seed} depth ${depth}: pool ${JSON.stringify(pool)} is not contiguous`);
      }
    }
  }
});

test("determinism: genFloor(depth, makeRng(seed)) twice gives deepStrictEqual floors, including water", () => {
  for (const seed of SEEDS) {
    for (const depth of [1, 5, 9, 20]) {
      const a = genFloor(depth, makeRng(seed));
      const b = genFloor(depth, makeRng(seed));
      assert.deepStrictEqual(a, b, `seed ${seed} depth ${depth}: two genFloor calls diverged`);
    }
  }
});

test("difficultyCurve(depth).waterPools table", () => {
  // The real breather cadence (engine/difficulty.js#isBreather,
  // BREATHER_EVERY = 5) puts the first breather at depth 6 (then 11, 16,
  // 21, ...) — NOT at depth 5/10/15/20. waterPools follows darkBlobs'
  // existing `breather` convention exactly, so this table is measured
  // against the LIVE isBreather()/difficultyCurve(), not hand-typed against
  // an assumed breather list.
  const table = {
    1: 1, 2: 1, 3: 1, 4: 1,
    5: 2, // not a breather — floor(4/4)=1 -> min(1+1,3)=2
    6: 1, // breather (BREATHER_EVERY=5, first breather at depth 6)
    7: 2, 8: 2,
    9: 3, 10: 3,
    11: 1, // breather
    12: 3, 13: 3, 14: 3, 15: 3,
    16: 1, // breather
    17: 3, 18: 3, 19: 3, 20: 3,
    21: 1, // breather
    50: 3,
  };
  for (const [depth, expected] of Object.entries(table)) {
    assert.equal(
      difficultyCurve(Number(depth)).waterPools,
      expected,
      `depth ${depth}: expected waterPools ${expected}`,
    );
  }
});

test("placeWater on a hand-built corridor grid with a scripted rng places exactly the scripted cells (proves the seed/size/growth draw order)", () => {
  // A full 21x21 grid, all walls, except a straight open corridor along
  // y=1, x=1..19 (connected to the spawn cell (1,1)). No exit feature, so
  // the exit-adjacency exclusion never fires. dist(x,1) = x-1 via bfs, so
  // cells with x >= 6 are the only ones eligible (dist > 4).
  const g = [];
  for (let y = 0; y < GH; y++) {
    g.push([]);
    for (let x = 0; x < GW; x++) g[y].push({ wall: true, seen: false, feat: null });
  }
  for (let x = 1; x <= 19; x++) g[1][x].wall = false;

  // A scripted rng: pick() always returns the FIRST element of the array
  // handed to it, d() always returns 1. Traced by hand against placeWater's
  // own algorithm (Task 2's action text): pick(seeds) selects seed (6,1)
  // (the first eligible cell in row-major scan order); d(...) with a
  // constant 1 gives target = WATER_POOL_SIZE_MIN + 1 - 1 = 3; growth then
  // picks (7,1) then (8,1) off the frontier (each step's frontier has
  // exactly one eligible neighbour, since the corridor is 1 cell wide and
  // depth 1 keeps every non-breather curve at 1 pool).
  const scripted = {
    pick(arr) { return arr[0]; },
    d() { return 1; },
  };

  const pools = placeWater(g, 1, scripted);
  assert.equal(pools.length, 1, "depth 1 -> difficultyCurve(1).waterPools === 1 -> exactly one pool");
  assert.deepStrictEqual(pools[0], [[6, 1], [7, 1], [8, 1]], "the scripted pick/d sequence must produce this exact pool");

  const waterCells = [];
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (g[y][x].water === true) waterCells.push([x, y]);
  assert.deepStrictEqual(waterCells, [[6, 1], [7, 1], [8, 1]], "no water cell exists outside the scripted pool");
});

test("the main rng is untouched: a counting wrapper around genFloor's rng draws exactly the pinned count for three (seed, depth) keys", () => {
  // These three numbers are repeated inline (not imported) from
  // test/unit/floor-gen-rng-pin.test.js's FLOOR_GEN_PIN table, measured at
  // the same pre-Phase-41 commit — "1:1" -> 425, "7:5" -> 429,
  // "256:10" -> 430. See that file for the full 98-entry pin and the
  // countingRng wrapper this mirrors.
  const cases = [
    { seed: 1, depth: 1, draws: 425 },
    { seed: 7, depth: 5, draws: 429 },
    { seed: 256, depth: 10, draws: 430 },
  ];
  for (const { seed, depth, draws } of cases) {
    let count = 0;
    const inner = makeRng(seed);
    const counting = {
      next() { count++; return inner.next(); },
      d(n) { count++; return inner.d(n); },
      pick(a) { count++; return inner.pick(a); },
      shuffle(a) { count += Math.max(0, a.length - 1); return inner.shuffle(a); },
      getState: () => inner.getState(),
      setState: (s) => inner.setState(s),
    };
    genFloor(depth, counting);
    assert.equal(count, draws, `seed ${seed} depth ${depth}: main-rng draw count drifted from the pin`);
  }
});
