// engine/maze.js
//
// Pure, RNG-injected maze/floor generator (ENG-02, ENG-05). Ports the
// prototype's genFloor/bfs/reveal (mazeworld.html lines 1167-1287) with every
// Math.random() call replaced by the injected seeded rng (engine/rng.js),
// preserving the exact RNG-consumption order so the same seed produces a
// byte-identical floor. No DOM, no module-global state, no Math.random.

import { difficultyCurve, WATER_POOL_SIZE_MIN, WATER_POOL_SIZE_MAX } from "./difficulty.js";
import { derivedRng } from "./rng.js";

export const GW = 21;
export const GH = 21;

/**
 * bfs(g, sx, sy) — breadth-first distance map from (sx,sy) over open cells.
 * Verbatim port of the prototype's bfs (mazeworld.html lines 1250-1264).
 * No RNG involved.
 * @returns {number[][]} distance grid, -1 for unreached cells
 */
export function bfs(g, sx, sy) {
  const d = g.map((r) => r.map(() => -1));
  d[sy][sx] = 0;
  const q = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ]) {
      const nx = x + dx,
        ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
      if (g[ny][nx].wall || d[ny][nx] !== -1) continue;
      d[ny][nx] = d[y][x] + 1;
      q.push([nx, ny]);
    }
  }
  return d;
}

/**
 * genFloor(depth, rng) — recursive-backtracker maze + loop-carving + a
 * farthest-cell exit + feature scatter + dark-zone blobs + one-way doors.
 * Pure function of (depth, rng): takes rng as a parameter, reads no module
 * global, touches no DOM. Ports mazeworld.html lines 1167-1247 line-for-line,
 * replacing every random draw with the injected rng while preserving the
 * prototype's exact call-consumption order.
 *
 * Descent is ENDLESS (RUN-02): the farthest-cell descent tile is ALWAYS
 * "exit" at every depth — the old fixed 5-floor "gate" Gate tile is retired
 * (this is the phase's one intentional divergence from the frozen
 * prototype, which still places a "gate" at depth >= 5). The three
 * difficulty knobs (encounter-dot count, dark-blob count, dark-blob BFS
 * radius) are sourced from difficultyCurve(depth) (engine/difficulty.js,
 * RUN-03) instead of the old unbounded inline formulas; difficultyCurve
 * consumes no RNG, so the seeded RNG cursor order is unchanged for the
 * depths (1-5) where its output matches the old formulas exactly.
 *
 * Phase 41 (TERR-01): the LAST pass before `return` places multi-square
 * water pools (`cell.water = true`) via `placeWater`, drawing exclusively
 * from a DERIVED rng stream keyed on the post-generation cursor, "terrain",
 * and the floor's depth (see the call site below and placeWater's own doc
 * comment).
 *
 * @param {number} depth - current floor depth (1-based); no upper bound
 * @param {{next: () => number, pick: (a: any[]) => any, shuffle: (a: any[]) => any[]}} rng
 * @returns {{g: object[][], px: number, py: number, depth: number}} cells may
 *   additionally carry `water: true` (Phase 41, TERR-01) — never `false`
 */
export function genFloor(depth, rng) {
  const g = [];
  for (let y = 0; y < GH; y++) {
    g.push([]);
    for (let x = 0; x < GW; x++) g[y].push({ wall: true, seen: false, feat: null });
  }

  // recursive backtracker
  const stack = [[1, 1]];
  g[1][1].wall = false;
  const dirs = [
    [0, -2],
    [0, 2],
    [-2, 0],
    [2, 0],
  ];
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const opts = [];
    for (const [dx, dy] of dirs) {
      const nx = x + dx,
        ny = y + dy;
      if (nx > 0 && ny > 0 && nx < GW - 1 && ny < GH - 1 && g[ny][nx].wall) opts.push([nx, ny, dx, dy]);
    }
    if (!opts.length) {
      stack.pop();
      continue;
    }
    const [nx, ny, dx, dy] = rng.pick(opts);
    g[y + dy / 2][x + dx / 2].wall = false;
    g[ny][nx].wall = false;
    stack.push([nx, ny]);
  }

  // a few loops so it isn't a pure tree
  // Prototype (lines 1190-1191) draws two Math.random() calls for x (the
  // floor draw, then the +/-1 draw) then one for y, per iteration — the same
  // left-to-right evaluation order is preserved here via rng.next().
  for (let i = 0; i < 10; i++) {
    const x = 1 + 2 * Math.floor(rng.next() * ((GW - 1) / 2)) + (rng.next() < 0.5 ? 1 : -1);
    const y = 1 + 2 * Math.floor(rng.next() * ((GH - 1) / 2));
    if (x > 0 && x < GW - 1 && g[y] && g[y][x] && g[y][x].wall) g[y][x].wall = false;
  }

  // The three difficulty knobs for this floor — a pure lookup, no RNG
  // consumed, so it never perturbs the rng cursor below (RUN-03).
  const dc = difficultyCurve(depth);

  const open = [];
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (!g[y][x].wall) open.push([x, y]);

  // farthest open cell from the start becomes the descent — always "exit"
  // now that descent is endless (the old depth >= 5 "gate" is retired).
  const dist = bfs(g, 1, 1);
  let best = [1, 1],
    bd = -1;
  for (const [x, y] of open) if (dist[y][x] > bd) { bd = dist[y][x]; best = [x, y]; }
  g[best[1]][best[0]].feat = "exit";

  // features
  const far = open.filter(([x, y]) => dist[y][x] > 4 && !g[y][x].feat);
  rng.shuffle(far);
  let i = 0;
  const nDots = dc.dots;
  for (let k = 0; k < nDots && i < far.length; k++, i++) { const [x, y] = far[i]; g[y][x].feat = "dot"; }
  for (let k = 0; k < 2 && i < far.length; k++, i++) { const [x, y] = far[i]; g[y][x].feat = "tele"; }
  for (let k = 0; k < 2 && i < far.length; k++, i++) { const [x, y] = far[i]; g[y][x].feat = "chest"; }
  for (let k = 0; k < 2 && i < far.length; k++, i++) { const [x, y] = far[i]; g[y][x].feat = "trap"; }
  for (let k = 0; k < 2 && i < far.length; k++, i++) { const [x, y] = far[i]; g[y][x].feat = "climb"; }
  for (let k = 0; k < 2 && i < far.length; k++, i++) { const [x, y] = far[i]; g[y][x].feat = "gorge"; }

  // unlit stretches: the deeper you go the more of the floor has no light at
  // all — bounded by difficultyCurve's darkBlobs/darkRadius (RUN-03) instead
  // of the old unbounded depth-1 / 3+depth formulas. dc.darkBlobs equals the
  // old `blobs` count for depths 1-5, so rng.pick(open) is still called
  // exactly darkBlobs times here, preserving the seeded RNG cursor.
  if (dc.darkBlobs > 0) {
    for (let bIdx = 0; bIdx < dc.darkBlobs && open.length; bIdx++) {
      const [sx, sy] = rng.pick(open);
      const d2 = bfs(g, sx, sy);
      for (const [x, y] of open) if (d2[y][x] >= 0 && d2[y][x] <= dc.darkRadius) g[y][x].dark = true;
    }
    g[1][1].dark = false;
  }

  // one-way doors are cut THROUGH a wall: a wall square with open corridor on
  // both sides of it, opened in one direction only so it joins two passages.
  const spots = [];
  for (let y = 1; y < GH - 1; y++)
    for (let x = 1; x < GW - 1; x++) {
      if (!g[y][x].wall) continue;
      const n = g[y - 1][x].wall,
        s = g[y + 1][x].wall,
        e = g[y][x + 1].wall,
        w = g[y][x - 1].wall;
      if (!n && !s && e && w) spots.push([x, y, ["N", "S"]]);
      else if (!e && !w && n && s) spots.push([x, y, ["E", "W"]]);
    }
  rng.shuffle(spots);
  const doors = [];
  for (const [x, y, axis] of spots) {
    if (doors.length >= 3) break;
    if (doors.some(([dx, dy]) => Math.abs(dx - x) + Math.abs(dy - y) < 4)) continue;
    g[y][x].wall = false;
    g[y][x].feat = "one";
    g[y][x].dir = rng.pick(axis);
    doors.push([x, y]);
  }

  // Phase 41 (TERR-01): water pools on a DERIVED rng stream. The key is
  // read via `rng.getState()` AFTER every existing draw above (the
  // backtracker, loop-carving, feature scatter, dark blobs, one-way doors)
  // so NO main-rng draw moves — test/unit/floor-gen-rng-pin.test.js pins the
  // exact per-(seed,depth) draw count and post-generation cursor and proves
  // this byte-for-byte. This reuses the Phase 38/39/40 derived-stream
  // discipline (engine/rng.js#derivedRng) verbatim, not a new invention.
  // Water is generated for EVERY run — fixture, bot, and old save alike —
  // per the 2026-09-17 greenfield ruling (STATE.md's Engine Gate AMENDMENT):
  // no run flag, no dual path.
  placeWater(g, dc.depth, derivedRng(rng.getState(), "terrain", dc.depth));

  // WR-01: return dc.depth (difficultyCurve's sanitized, clamped-to-positive-
  // integer depth), not the raw `depth` parameter. difficultyCurve()'s own
  // safeDepth() guard was written specifically so a corrupted/non-integer/
  // non-positive save-derived depth "can never poison this module's output
  // with NaN/Infinity, which could later corrupt a serialized floor" (see
  // engine/difficulty.js's safeDepth() doc comment) -- but returning the raw
  // parameter here defeated that guard for the *returned* floor's own depth
  // field, even though dc already computed the sanitized value two lines
  // above for the dots/darkBlobs/darkRadius knobs. For any valid depth >= 1
  // this is a no-op (dc.depth === depth); it only changes behavior for a
  // tampered/negative/NaN input.
  return { g, px: 1, py: 1, depth: dc.depth };
}

/**
 * reveal(floor, radius = 2) — marks the (2*radius+1)x(2*radius+1) square of
 * cells centered on the player's position as seen, clipped to grid bounds.
 * Pure mutation of the passed floor's grid; no RNG.
 *
 * The prototype's reveal() (mazeworld.html lines 1281-1287) computes its
 * radius from `S.floor`, character skills (`skill("Night Vision")`) and
 * active effects (`eff("sight")`):
 * `r = ((g[py][px].dark && !skill("Night Vision")) ? 1 : 2) + eff("sight")`.
 * This pure reveal(floor, radius) takes the resulting radius as an explicit
 * parameter (default 2, the non-dark/no-bonus case) — every real call site
 * (move/teleport/descend in engine/movement.js, newRun in engine/state.js)
 * now computes and passes the true radius via engine/derived.js's
 * revealRadius(state) (HI-01), matching the prototype's dark/Night
 * Vision/sight behavior exactly.
 *
 * Phase 40 (SPELL-05, Plan 04) graduation: a cell this reveal actually
 * touches loses its `spellSeen` provenance flag (engine/magic.js's reveal
 * branch), the ratified Key Decision that ONLY what Map the Floor alone
 * showed re-fogs at the window's expiry — normal exploration during the
 * window "earns" the cell permanently. `delete cell.spellSeen` is a no-op on
 * every cell that never carried the flag, so every fixture floor (none ever
 * casts the reveal spell) stays byte-identical.
 */
export function reveal(floor, radius = 2) {
  const { g, px, py } = floor;
  for (let y = py - radius; y <= py + radius; y++)
    for (let x = px - radius; x <= px + radius; x++) {
      const cell = g[y] && g[y][x];
      if (!cell) continue;
      cell.seen = true;
      if (cell.spellSeen) delete cell.spellSeen;
    }
}

/**
 * refogSpellSeen(floor) — Phase 40 (SPELL-05, Plan 04): the ONE sweep that
 * runs when Map the Floor's `spell:reveal` timer expires (research Pitfall
 * 4 — never a per-step poll). Walks every cell still carrying the
 * `spellSeen` provenance flag (i.e. never graduated by an actual `reveal()`
 * touch during the window) and re-fogs it: `seen = false`, flag removed.
 * Every OTHER cell (walked, or never revealed at all) is untouched. Pure
 * mutation of the passed floor's grid; no RNG. Returns the count of cells
 * re-fogged (for the caller's `revealFaded { cells }` narration).
 */
export function refogSpellSeen(floor) {
  let count = 0;
  for (const row of floor.g) {
    for (const cell of row) {
      if (cell.spellSeen) {
        cell.seen = false;
        delete cell.spellSeen;
        count++;
      }
    }
  }
  return count;
}

/**
 * placeWater(g, depth, rng) — Phase 41 (TERR-01): places
 * `difficultyCurve(depth).waterPools` contiguous, bounded-flood-fill water
 * pools onto `g` (mutated in place), each a target size drawn from
 * [WATER_POOL_SIZE_MIN, WATER_POOL_SIZE_MAX]. Called by `genFloor` LAST,
 * after every other pass, with an rng that is ALREADY a derived stream —
 * every draw inside this function comes off the `rng` PARAMETER only; it
 * receives no reference to any caller's main rng, so it can never perturb
 * one even by accident. `genFloor` constructs that derived stream at the
 * call site immediately below (see its own comment there for the exact
 * expression).
 *
 * A cell (x, y) is ELIGIBLE for water iff it is open (`!wall`), carries no
 * feature (`!feat`), is farther than 4 BFS steps from the spawn cell (the
 * SAME `far`-list threshold `genFloor`'s own feature scatter already uses,
 * so the spawn cell and its first corridor are never wet), is not already
 * water, and is not orthogonally adjacent to the exit tile (Manhattan
 * distance exactly 1 — diagonal neighbours are fine). Water is always
 * passable, so no placement here can ever make a floor unsolvable.
 *
 * Per pool: pick a seed cell from the (re-scanned, row-major, excluding
 * already-water cells) eligible list, draw a target size, mark the seed
 * water, then grow by repeatedly picking a random cell from a frontier of
 * eligible, not-yet-water orthogonal neighbours of any pool cell (a
 * discovery-order-deduplicated array — never a Set, so `rng.pick` stays
 * deterministic) until the pool reaches its target size or the frontier is
 * exhausted (a pool can legitimately end up smaller than its target size
 * when it runs out of room — this is the design, not a bug). Cells only
 * ever gain `water: true` — this function never writes `false` and never
 * touches `wall`/`feat`/`dark`/`seen`/`dir`.
 *
 * @param {object[][]} g - the floor grid, mutated in place
 * @param {number} depth - the floor's (already-sanitized) depth
 * @param {{d: (n: number) => number, pick: (a: any[]) => any}} rng - a
 *   DERIVED stream, never the caller's main rng
 * @returns {number[][][]} pools - one array per pool, each an array of
 *   `[x, y]` cell coordinates (in growth order, seed first)
 */
export function placeWater(g, depth, rng) {
  const dc = difficultyCurve(depth);
  const pools = [];
  if (dc.waterPools <= 0) return pools;

  const dist = bfs(g, 1, 1);
  let ex = -1;
  let ey = -1;
  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) {
      if (g[y][x].feat === "exit") {
        ex = x;
        ey = y;
      }
    }
  }

  const isEligible = (x, y) => {
    const row = g[y];
    const cell = row && row[x];
    if (!cell || cell.wall || cell.feat || cell.water) return false;
    const drow = dist[y];
    if (!drow || !(drow[x] > 4)) return false;
    if (ex >= 0 && Math.abs(x - ex) + Math.abs(y - ey) === 1) return false;
    return true;
  };

  const eligibleSeeds = () => {
    const out = [];
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (isEligible(x, y)) out.push([x, y]);
    return out;
  };

  for (let k = 0; k < dc.waterPools; k++) {
    const seeds = eligibleSeeds();
    if (!seeds.length) break;
    const [sx, sy] = rng.pick(seeds);
    const target = WATER_POOL_SIZE_MIN + rng.d(WATER_POOL_SIZE_MAX - WATER_POOL_SIZE_MIN + 1) - 1;
    g[sy][sx].water = true;
    const pool = [[sx, sy]];

    const frontier = [];
    const inFrontier = new Set();
    const addFrontierNeighbors = (x, y) => {
      for (const [dx, dy] of [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        const key = `${nx},${ny}`;
        if (isEligible(nx, ny) && !inFrontier.has(key)) {
          inFrontier.add(key);
          frontier.push([nx, ny]);
        }
      }
    };
    addFrontierNeighbors(sx, sy);

    while (pool.length < target && frontier.length) {
      const [nx, ny] = rng.pick(frontier);
      const idx = frontier.findIndex(([fx, fy]) => fx === nx && fy === ny);
      frontier.splice(idx, 1);
      inFrontier.delete(`${nx},${ny}`);
      g[ny][nx].water = true;
      pool.push([nx, ny]);
      addFrontierNeighbors(nx, ny);
    }

    pools.push(pool);
  }

  return pools;
}
