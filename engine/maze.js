// engine/maze.js
//
// Pure, RNG-injected maze/floor generator (ENG-02, ENG-05). Ports the
// prototype's genFloor/bfs/reveal (mazeworld.html lines 1167-1287) with every
// Math.random() call replaced by the injected seeded rng (engine/rng.js),
// preserving the exact RNG-consumption order so the same seed produces a
// byte-identical floor. No DOM, no module-global state, no Math.random.

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
 * farthest-cell exit/gate + feature scatter + dark-zone blobs + one-way
 * doors. Pure function of (depth, rng): takes rng as a parameter, reads no
 * module global, touches no DOM. Ports mazeworld.html lines 1167-1247
 * line-for-line, replacing every random draw with the injected rng while
 * preserving the prototype's exact call-consumption order.
 *
 * @param {number} depth - current floor depth (1-based); depth >= 5 places
 *   a "gate" feature instead of "exit" (fixed 5-floor Gate, preserved as-is)
 * @param {{next: () => number, pick: (a: any[]) => any, shuffle: (a: any[]) => any[]}} rng
 * @returns {{g: object[][], px: number, py: number, depth: number}}
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

  const open = [];
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (!g[y][x].wall) open.push([x, y]);

  // farthest open cell from the start becomes the descent
  const dist = bfs(g, 1, 1);
  let best = [1, 1],
    bd = -1;
  for (const [x, y] of open) if (dist[y][x] > bd) { bd = dist[y][x]; best = [x, y]; }
  g[best[1]][best[0]].feat = depth >= 5 ? "gate" : "exit";

  // features
  const far = open.filter(([x, y]) => dist[y][x] > 4 && !g[y][x].feat);
  rng.shuffle(far);
  let i = 0;
  const nDots = 9 + depth;
  for (let k = 0; k < nDots && i < far.length; k++, i++) { const [x, y] = far[i]; g[y][x].feat = "dot"; }
  for (let k = 0; k < 2 && i < far.length; k++, i++) { const [x, y] = far[i]; g[y][x].feat = "tele"; }
  for (let k = 0; k < 2 && i < far.length; k++, i++) { const [x, y] = far[i]; g[y][x].feat = "chest"; }
  for (let k = 0; k < 2 && i < far.length; k++, i++) { const [x, y] = far[i]; g[y][x].feat = "trap"; }
  for (let k = 0; k < 2 && i < far.length; k++, i++) { const [x, y] = far[i]; g[y][x].feat = "climb"; }
  for (let k = 0; k < 2 && i < far.length; k++, i++) { const [x, y] = far[i]; g[y][x].feat = "gorge"; }

  // unlit stretches: the deeper you go the more of the floor has no light at all
  if (depth >= 2) {
    const blobs = depth - 1;
    for (let bIdx = 0; bIdx < blobs && open.length; bIdx++) {
      const [sx, sy] = rng.pick(open);
      const d2 = bfs(g, sx, sy);
      for (const [x, y] of open) if (d2[y][x] >= 0 && d2[y][x] <= 3 + depth) g[y][x].dark = true;
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

  return { g, px: 1, py: 1, depth };
}

/**
 * reveal(floor, radius = 2) — marks the (2*radius+1)x(2*radius+1) square of
 * cells centered on the player's position as seen, clipped to grid bounds.
 * Pure mutation of the passed floor's grid; no RNG.
 *
 * NOTE ON FIDELITY: the prototype's reveal() (mazeworld.html lines
 * 1281-1287) computes its radius from `S.floor`, character skills
 * (`skill("Night Vision")`) and active effects (`eff("sight")`):
 * `r = ((g[py][px].dark && !skill("Night Vision")) ? 1 : 2) + eff("sight")`.
 * Character skills/effects are not part of the engine surface this plan
 * extracts (character/effects extraction is a later plan). This pure
 * reveal(floor, radius) takes the resulting radius as an explicit parameter
 * (default 2, the non-dark/no-bonus case), reproducing the prototype's
 * square-block reveal shape exactly for that case — which is always the
 * correct radius at any floor's starting position, since depth-1 floors are
 * never dark and genFloor always forces g[1][1].dark = false even on floors
 * with dark-zone blobs. A future plan wiring skills/effects into engine
 * state can compute the correct radius and pass it in.
 */
export function reveal(floor, radius = 2) {
  const { g, px, py } = floor;
  for (let y = py - radius; y <= py + radius; y++)
    for (let x = px - radius; x <= px + radius; x++) if (g[y] && g[y][x]) g[y][x].seen = true;
}
