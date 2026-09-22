// src/browser/dressing.js
//
// Phase 59 (DRESS-01..05) — dungeon set dressing: ambient props scattered
// across a floor's walls and walkable squares, purely for atmosphere. This
// module is the ENTIRE rules-free contract: it categorises the 54 shipped
// `set_dungeon_*` images, places a sparse, deterministic scatter of them on
// a floor, hides any prop that would ever be confused with a real encounter,
// and draws the survivors dim and small beneath the feature layer.
//
// Four rules govern every export here:
//   1. Pure ambiance, no rules effect. A prop is never interactable,
//      inspectable, or examined by any engine code — placement lives
//      entirely in src/browser/, never engine/ or content/.
//   2. Its only randomness is `derivedRng(seed, "dressing", depth)` — the
//      milestone's `makeRng(hash(seed, "dressing", depth))` (engine/rng.js).
//      This NEVER touches the run's own `state.rngState`: derivedRng builds
//      a brand new generator from a hash of its key parts every call, with
//      no shared mutable state, so no other rng instance's cursor moves.
//   3. Placement reads ONLY the immutable floor structure — the wall
//      layout, `water`, and the fixed (1,1) start square — never `feat`,
//      `seen`, `dark`, `spellSeen`, or the party's live position. Those
//      change at runtime (engine/movement.js clears a feature's `feat` to
//      null when it resolves) and a save can be reloaded mid-floor; a
//      placement that read them would silently reshuffle after every
//      reload. So the SAME seed and depth always place identically
//      (DRESS-04), across reloads and after any feature has resolved. The
//      feature/stairs/party exclusion (DRESS-03) is applied separately, at
//      DRAW time, by `visibleProps` below — the one visible consequence is
//      that a floor prop whose square held a feature becomes visible on
//      that square once the feature resolves (that is genFloor's own
//      (1,1) start guarantee at work, not a bug).
//   4. Opacity and scale are the legibility contract that keeps a prop
//      from ever reading as an encounter: floor props are dim (D-11), wall
//      props are strong but still below full ink (D-12), and every prop is
//      smaller than a feature icon (D-13).
//
// Import only `derivedRng` from engine/rng.js — no other engine/content
// import, no Math.random, no Date.now/performance.now, no window/document
// reference (this module must load cleanly under a plain `node --test`
// process and stay pure/DOM-free like src/browser/icons.js's pure half).

import { derivedRng } from "../../engine/rng.js";

// --- The 54-prop category table (D-07) ------------------------------------
//
// Transcribed from 59-CONTEXT.md's curated wall/floor split, verified 1:1
// against icons/optimized/set_dungeon_*.png by test/unit/dressing.test.js.
// `lean` is "shallow" (favoured at low depth), "deep" (favoured at high
// depth), or null (depth-neutral). `weight` is 1, or RARE_WEIGHT (0.25) for
// the two blood props (family-friendly "grit not gore") and the two
// encounter look-alikes `coins_gems` (reads as a chest) and `pit` (reads as
// a crevice) — made rare at the planner's discretion (D-09).

/** @typedef {{id: string, icon: string, kind: "wall"|"floor", lean: "shallow"|"deep"|null, weight: number}} DressingProp */

const RARE = 0.25;
const NORMAL = 1;

/** Raw [id, kind, lean, rare] rows, in the discovery table's own order (wall entries first, then floor). */
const RAW_PROPS = [
  // -- wall (15) --
  ["banner_blue_lily", "wall", "shallow", false],
  ["banner_red_skull", "wall", "deep", false],
  ["banner_torn", "wall", null, false],
  ["candelabra", "wall", null, false],
  ["cobweb", "wall", null, false],
  ["cobweb_spider", "wall", "deep", false],
  ["hanging_brazier", "wall", null, false],
  ["hanging_chain", "wall", "deep", false],
  ["hanging_vine", "wall", "shallow", false],
  ["roots", "wall", null, false],
  ["rusty_shackles", "wall", "deep", false],
  ["shackles", "wall", "deep", false],
  ["torch_sconce", "wall", null, false],
  ["wall_brazier", "wall", null, false],
  ["wall_torch", "wall", null, false],
  // -- floor (39) --
  ["ash_pile", "floor", "deep", false],
  ["barrel", "floor", "shallow", false],
  ["beast_skull", "floor", "deep", false],
  ["blood_drops", "floor", null, true],
  ["blood_pool", "floor", null, true],
  ["bone_pile", "floor", "deep", false],
  ["book", "floor", null, false],
  ["boulder", "floor", null, false],
  ["broken_barrel", "floor", "shallow", false],
  ["broken_planks", "floor", null, false],
  ["broken_urn", "floor", null, false],
  ["bush", "floor", "shallow", false],
  ["candle", "floor", null, false],
  ["cobblestones", "floor", null, false],
  ["coins_gems", "floor", null, true],
  ["crate", "floor", "shallow", false],
  ["dirt_clods", "floor", null, false],
  ["fern", "floor", "shallow", false],
  ["fish_bones", "floor", null, false],
  ["flowers", "floor", "shallow", false],
  ["grate", "floor", null, false],
  ["hay_pile", "floor", "shallow", false],
  ["moss", "floor", null, false],
  ["pit", "floor", "deep", true],
  ["puddle", "floor", null, false],
  ["purple_mushrooms", "floor", "shallow", false],
  ["rat", "floor", null, false],
  ["red_mushrooms", "floor", "shallow", false],
  ["rocks", "floor", null, false],
  ["rope_coil", "floor", "shallow", false],
  ["rubble", "floor", null, false],
  ["sack", "floor", "shallow", false],
  ["sapling", "floor", "shallow", false],
  ["scrolls", "floor", null, false],
  ["skeleton", "floor", "deep", false],
  ["skull_bones", "floor", "deep", false],
  ["skull_crossbones", "floor", "deep", false],
  ["slime_puddle", "floor", "deep", false],
  ["wooden_hatch", "floor", null, false],
];

/** DRESSING_PROPS — the frozen 54-entry category table (D-07). */
export const DRESSING_PROPS = Object.freeze(
  RAW_PROPS.map(([id, kind, lean, rare]) =>
    Object.freeze({ id, icon: `set_dungeon_${id}`, kind, lean, weight: rare ? RARE : NORMAL })
  )
);

/** DRESSING_ICON_NAMES — the 54 icon names, in DRESSING_PROPS order. */
export const DRESSING_ICON_NAMES = Object.freeze(DRESSING_PROPS.map((p) => p.icon));

// --- Placement constants (D-06, D-08, D-09) --------------------------------

/** The party's floor-start square (engine/maze.js genFloor always returns px:1, py:1). */
export const FLOOR_START = Object.freeze({ x: 1, y: 1 });

/** Sparse per-floor prop count (D-06): 8 to 12. */
export const PROPS_MIN = 8;
export const PROPS_MAX = 12;

/** Minimum Chebyshev spacing between any two placed props. */
export const MIN_PROP_SPACING = 2;

/** The rare-prop weight multiplier baseline (D-09): blood + the two look-alikes. */
export const RARE_WEIGHT = 0.25;

/** Light depth-weighting strength (D-08): +/-40% swing across the depth span. */
export const DEPTH_LEAN = 0.4;

/** The depth span the lean ramps over: depth 1 (t=0) to depth 20 (t=1). */
export const DEPTH_LEAN_SPAN = 19;

/**
 * propWeight(prop, depth) — the depth-weighted draw weight for `prop` (D-08).
 * A shallow-leaning prop is favoured at low depth and disfavoured at high
 * depth; a deep-leaning prop is the mirror image; a neutral prop (lean:
 * null) is unaffected by depth. `depth` is clamped: any non-finite value
 * (NaN, undefined, a non-number) behaves as depth 1, and any depth past 20
 * clamps to depth 20's weights (t is clamped to [0, 1] either side).
 */
export function propWeight(prop, depth) {
  const effectiveDepth = Number.isFinite(depth) ? depth : 1;
  const t = Math.min(1, Math.max(0, (effectiveDepth - 1) / DEPTH_LEAN_SPAN));
  if (prop.lean === "shallow") return prop.weight * (1 + DEPTH_LEAN * (1 - 2 * t));
  if (prop.lean === "deep") return prop.weight * (1 + DEPTH_LEAN * (2 * t - 1));
  return prop.weight;
}

const WALL_ENTRIES = DRESSING_PROPS.filter((p) => p.kind === "wall");
const FLOOR_ENTRIES = DRESSING_PROPS.filter((p) => p.kind === "floor");

function chebyshev(ax, ay, bx, by) {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

/** pickWeighted(entries, depth, rng) — a cumulative weighted draw over `entries` at `depth`. */
function pickWeighted(entries, depth, rng) {
  const weights = entries.map((p) => propWeight(p, depth));
  const sum = weights.reduce((a, b) => a + b, 0);
  const r = rng.next() * sum;
  let running = 0;
  for (let i = 0; i < entries.length; i++) {
    running += weights[i];
    if (running > r) return entries[i];
  }
  return entries[entries.length - 1];
}

/**
 * placeDressing({ seed, depth, grid }) — a pure, total function returning a
 * frozen array of frozen `{ x, y, id, icon, kind }` placements (D-06 through
 * D-10). See this module's head comment for the full determinism contract
 * (DRESS-04) and the draw-time exclusion rule (DRESS-03, `visibleProps`
 * below). NEVER mutates `grid`.
 *
 * Total is drawn once from the shell-derived stream
 * (`derivedRng(seed, "dressing", depth)`) in [PROPS_MIN, PROPS_MAX]; half go
 * to wall-mounted props (rounded down), the rest to floor props. Wall
 * candidates are interior cells (excluding the outer ring the maze border
 * strokes over) that are themselves a wall AND border a walkable cell, so
 * every placed wall prop is ever seen. Floor candidates are every walkable,
 * non-water cell except the party's arrival square. Candidates are shuffled
 * (`rng.shuffle`) then walked in that order, accepting a cell only when it
 * stays at least MIN_PROP_SPACING (Chebyshev) from every prop already
 * accepted (either kind), stopping once the category's share is filled — a
 * grid too small/sparse for the full count simply yields fewer props, never
 * loops. Total/never throws: a missing/empty grid, a grid with no walkable
 * cell, a non-number seed, and a non-finite depth all just yield an array.
 */
export function placeDressing({ seed, depth, grid } = {}) {
  if (!grid || !Array.isArray(grid) || grid.length === 0 || !Array.isArray(grid[0]) || grid[0].length === 0) {
    return Object.freeze([]);
  }

  const height = grid.length;
  const width = grid[0].length;
  const rng = derivedRng(seed, "dressing", depth);

  const total = PROPS_MIN + Math.floor(rng.next() * (PROPS_MAX - PROPS_MIN + 1));
  const nWall = Math.floor(total / 2);
  const nFloor = total - nWall;

  const wallCandidates = [];
  for (let y = 1; y <= height - 2; y++) {
    for (let x = 1; x <= width - 2; x++) {
      const cell = grid[y] && grid[y][x];
      if (!cell || !cell.wall) continue;
      const north = grid[y - 1] && grid[y - 1][x];
      const south = grid[y + 1] && grid[y + 1][x];
      const west = grid[y] && grid[y][x - 1];
      const east = grid[y] && grid[y][x + 1];
      const bordersWalkable =
        (north && north.wall === false) ||
        (south && south.wall === false) ||
        (west && west.wall === false) ||
        (east && east.wall === false);
      if (bordersWalkable) wallCandidates.push({ x, y });
    }
  }

  const floorCandidates = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = grid[y] && grid[y][x];
      if (!cell || cell.wall) continue;
      if (cell.water) continue;
      if (x === FLOOR_START.x && y === FLOOR_START.y) continue;
      floorCandidates.push({ x, y });
    }
  }

  const placed = [];

  function spacingOk(x, y) {
    for (const p of placed) {
      if (chebyshev(p.x, p.y, x, y) < MIN_PROP_SPACING) return false;
    }
    return true;
  }

  function fillCategory(candidates, count, entries, kind) {
    if (count <= 0 || entries.length === 0) return;
    const shuffled = rng.shuffle(candidates.slice());
    let accepted = 0;
    for (const cand of shuffled) {
      if (accepted >= count) break;
      if (!spacingOk(cand.x, cand.y)) continue;
      const prop = pickWeighted(entries, depth, rng);
      placed.push(Object.freeze({ x: cand.x, y: cand.y, id: prop.id, icon: prop.icon, kind }));
      accepted++;
    }
  }

  fillCategory(wallCandidates, nWall, WALL_ENTRIES, "wall");
  fillCategory(floorCandidates, nFloor, FLOOR_ENTRIES, "floor");

  return Object.freeze(placed);
}

/**
 * dressingKey(seed, depth, grid) — the memo key `createDressingBridge` uses
 * to cache a floor's placement: `${seed}:${depth}:` followed by one "1"
 * (wall) or "0" (not) per cell, row-major. Pure, total, never throws.
 */
export function dressingKey(seed, depth, grid) {
  let cells = "";
  if (Array.isArray(grid)) {
    for (const row of grid) {
      if (!Array.isArray(row)) continue;
      for (const cell of row) {
        cells += cell && cell.wall ? "1" : "0";
      }
    }
  }
  return `${seed}:${depth}:${cells}`;
}
