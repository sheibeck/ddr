// test/unit/dressing.test.js
//
// Phase 59 (DRESS-01..05), Plan 02 — pins for src/browser/dressing.js's pure
// core: the 54-prop category table (D-07), the light depth weighting (D-08),
// blood/look-alike rarity (D-09), and the deterministic, spaced, sparse
// placement (D-06, D-10) drawn purely from `derivedRng(seed, "dressing",
// depth)`. Task 2 extends this file with the draw-time exclusion (D-10),
// the dimmed layer (D-11/D-12/D-13), the lazy-load controller (D-14) and the
// bridge factory (D-16) — see the bottom of this file once Task 2 lands.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import {
  DRESSING_PROPS,
  DRESSING_ICON_NAMES,
  FLOOR_START,
  PROPS_MIN,
  PROPS_MAX,
  MIN_PROP_SPACING,
  RARE_WEIGHT,
  DEPTH_LEAN,
  DEPTH_LEAN_SPAN,
  PROP_SCALE,
  FLOOR_PROP_ALPHA,
  WALL_PROP_ALPHA,
  propWeight,
  placeDressing,
  dressingKey,
  visibleProps,
  drawDressingLayer,
  createDressingArt,
  createDressingBridge,
} from "../../src/browser/dressing.js";
import { genFloor } from "../../engine/maze.js";
import { makeRng } from "../../engine/rng.js";
import { drawFeatureIcon } from "../../src/browser/icons.js";
import { createRecordingContext } from "./harness/recordingCanvas.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

function findProp(id) {
  const prop = DRESSING_PROPS.find((p) => p.id === id);
  assert.ok(prop, `expected a DRESSING_PROPS entry for "${id}"`);
  return prop;
}

// --- The 54-prop category table (D-07) --------------------------------------

test("DRESSING_PROPS: 54 frozen entries, unique ids, icon = set_dungeon_<id>, 15 wall / 39 floor, matching the discovery table", () => {
  assert.equal(DRESSING_PROPS.length, 54);
  assert.ok(Object.isFrozen(DRESSING_PROPS));
  const ids = new Set();
  for (const prop of DRESSING_PROPS) {
    assert.ok(Object.isFrozen(prop), `entry ${prop.id} should be frozen`);
    assert.equal(prop.icon, `set_dungeon_${prop.id}`);
    assert.equal(ids.has(prop.id), false, `duplicate id ${prop.id}`);
    ids.add(prop.id);
    assert.ok(["wall", "floor"].includes(prop.kind));
    assert.ok([null, "shallow", "deep"].includes(prop.lean));
    assert.ok(typeof prop.weight === "number");
  }
  assert.equal(DRESSING_PROPS.filter((p) => p.kind === "wall").length, 15);
  assert.equal(DRESSING_PROPS.filter((p) => p.kind === "floor").length, 39);

  // The set of icons equals the set of set_dungeon_*.png stems on disk.
  const dir = path.join(REPO_ROOT, "icons", "optimized");
  const onDisk = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("set_dungeon_") && f.endsWith(".png"))
    .map((f) => f.slice("set_dungeon_".length, -".png".length))
    .sort();
  const inTable = DRESSING_PROPS.map((p) => p.id).sort();
  assert.deepEqual(inTable, onDisk);

  // Every entry's kind/lean/weight matches the discovery table exactly.
  const expected = {
    banner_blue_lily: ["wall", "shallow", 1],
    banner_red_skull: ["wall", "deep", 1],
    banner_torn: ["wall", null, 1],
    candelabra: ["wall", null, 1],
    cobweb: ["wall", null, 1],
    cobweb_spider: ["wall", "deep", 1],
    hanging_brazier: ["wall", null, 1],
    hanging_chain: ["wall", "deep", 1],
    hanging_vine: ["wall", "shallow", 1],
    roots: ["wall", null, 1],
    rusty_shackles: ["wall", "deep", 1],
    shackles: ["wall", "deep", 1],
    torch_sconce: ["wall", null, 1],
    wall_brazier: ["wall", null, 1],
    wall_torch: ["wall", null, 1],
    ash_pile: ["floor", "deep", 1],
    barrel: ["floor", "shallow", 1],
    beast_skull: ["floor", "deep", 1],
    blood_drops: ["floor", null, 0.25],
    blood_pool: ["floor", null, 0.25],
    bone_pile: ["floor", "deep", 1],
    book: ["floor", null, 1],
    boulder: ["floor", null, 1],
    broken_barrel: ["floor", "shallow", 1],
    broken_planks: ["floor", null, 1],
    broken_urn: ["floor", null, 1],
    bush: ["floor", "shallow", 1],
    candle: ["floor", null, 1],
    cobblestones: ["floor", null, 1],
    coins_gems: ["floor", null, 0.25],
    crate: ["floor", "shallow", 1],
    dirt_clods: ["floor", null, 1],
    fern: ["floor", "shallow", 1],
    fish_bones: ["floor", null, 1],
    flowers: ["floor", "shallow", 1],
    grate: ["floor", null, 1],
    hay_pile: ["floor", "shallow", 1],
    moss: ["floor", null, 1],
    pit: ["floor", "deep", 0.25],
    puddle: ["floor", null, 1],
    purple_mushrooms: ["floor", "shallow", 1],
    rat: ["floor", null, 1],
    red_mushrooms: ["floor", "shallow", 1],
    rocks: ["floor", null, 1],
    rope_coil: ["floor", "shallow", 1],
    rubble: ["floor", null, 1],
    sack: ["floor", "shallow", 1],
    sapling: ["floor", "shallow", 1],
    scrolls: ["floor", null, 1],
    skeleton: ["floor", "deep", 1],
    skull_bones: ["floor", "deep", 1],
    skull_crossbones: ["floor", "deep", 1],
    slime_puddle: ["floor", "deep", 1],
    wooden_hatch: ["floor", null, 1],
  };
  assert.equal(Object.keys(expected).length, 54);
  for (const prop of DRESSING_PROPS) {
    const [kind, lean, weight] = expected[prop.id];
    assert.equal(prop.kind, kind, `${prop.id}.kind`);
    assert.equal(prop.lean, lean, `${prop.id}.lean`);
    assert.equal(prop.weight, weight, `${prop.id}.weight`);
  }
});

test("DRESSING_ICON_NAMES: the 54 icons, in DRESSING_PROPS table order", () => {
  assert.deepEqual(DRESSING_ICON_NAMES, DRESSING_PROPS.map((p) => p.icon));
  assert.equal(DRESSING_ICON_NAMES.length, 54);
  assert.ok(Object.isFrozen(DRESSING_ICON_NAMES));
});

test("Placement constants match the plan exactly", () => {
  assert.equal(RARE_WEIGHT, 0.25);
  assert.equal(DEPTH_LEAN, 0.4);
  assert.equal(DEPTH_LEAN_SPAN, 19);
  assert.equal(PROPS_MIN, 8);
  assert.equal(PROPS_MAX, 12);
  assert.equal(MIN_PROP_SPACING, 2);
  assert.deepEqual(FLOOR_START, { x: 1, y: 1 });
});

// --- propWeight (D-08, D-09) -------------------------------------------------

test("propWeight: a shallow-leaning prop is favoured at depth 1 and disfavoured at depth 20", () => {
  const barrel = findProp("barrel");
  assert.ok(Math.abs(propWeight(barrel, 1) - 1.4) < 1e-9);
  assert.ok(Math.abs(propWeight(barrel, 20) - 0.6) < 1e-9);
});

test("propWeight: a deep-leaning prop is the mirror image of a shallow one", () => {
  const skeleton = findProp("skeleton");
  assert.ok(Math.abs(propWeight(skeleton, 1) - 0.6) < 1e-9);
  assert.ok(Math.abs(propWeight(skeleton, 20) - 1.4) < 1e-9);
});

test("propWeight: a neutral prop is depth-independent", () => {
  const book = findProp("book");
  for (const d of [1, 10, 20, 50]) {
    assert.equal(propWeight(book, d), 1);
  }
});

test("propWeight: blood_pool is rare (0.25) regardless of depth", () => {
  const bloodPool = findProp("blood_pool");
  for (const d of [1, 10, 20]) {
    assert.equal(propWeight(bloodPool, d), 0.25);
  }
});

test("propWeight: pit is rare AND deep-leaning — pit at depth 1 is 0.25 * 0.6", () => {
  const pit = findProp("pit");
  assert.ok(Math.abs(propWeight(pit, 1) - 0.25 * 0.6) < 1e-9);
});

test("propWeight: depths past 20 clamp to depth 20's weights", () => {
  const barrel = findProp("barrel");
  assert.equal(propWeight(barrel, 20), propWeight(barrel, 21));
  assert.equal(propWeight(barrel, 20), propWeight(barrel, 999));
});

test("propWeight: a depth below 1 or non-finite behaves as depth 1", () => {
  const barrel = findProp("barrel");
  assert.equal(propWeight(barrel, 1), propWeight(barrel, 0));
  assert.equal(propWeight(barrel, 1), propWeight(barrel, -5));
  assert.equal(propWeight(barrel, 1), propWeight(barrel, NaN));
  assert.equal(propWeight(barrel, 1), propWeight(barrel, undefined));
});

// --- placeDressing: sparse, spaced, deterministic placement (D-06, D-10) ----

const FIXED_SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);
const CHECK_DEPTHS = [1, 5, 20];

test("placeDressing: across 200 fixed seeds and depths 1/5/20, every placement respects count, category split, cell kind, spacing and the arrival-square exclusion", () => {
  for (const depth of CHECK_DEPTHS) {
    for (const seed of FIXED_SEEDS) {
      const grid = genFloor(depth, makeRng(seed)).g;
      const props = placeDressing({ seed, depth, grid });

      assert.ok(props.length >= 8 && props.length <= 12, `seed ${seed} depth ${depth}: got ${props.length} props`);

      const wallProps = props.filter((p) => p.kind === "wall");
      const floorProps = props.filter((p) => p.kind === "floor");
      assert.equal(wallProps.length, Math.floor(props.length / 2), `seed ${seed} depth ${depth}: wall count`);
      assert.equal(wallProps.length + floorProps.length, props.length);

      for (const prop of wallProps) {
        assert.ok(prop.x >= 1 && prop.x <= 19 && prop.y >= 1 && prop.y <= 19, `wall prop off interior: seed ${seed}`);
        const cell = grid[prop.y][prop.x];
        assert.equal(cell.wall, true, `wall prop ${prop.id} not on a wall cell (seed ${seed})`);
        const neighbors = [grid[prop.y - 1]?.[prop.x], grid[prop.y + 1]?.[prop.x], grid[prop.y]?.[prop.x - 1], grid[prop.y]?.[prop.x + 1]];
        assert.ok(neighbors.some((n) => n && n.wall === false), `wall prop ${prop.id} has no open 4-neighbour (seed ${seed})`);
        const tableEntry = DRESSING_PROPS.find((p) => p.id === prop.id);
        assert.equal(tableEntry.kind, "wall");
      }

      for (const prop of floorProps) {
        const cell = grid[prop.y][prop.x];
        assert.equal(cell.wall, false, `floor prop ${prop.id} on a wall cell (seed ${seed})`);
        assert.ok(!cell.water, `floor prop ${prop.id} on a water cell (seed ${seed})`);
        assert.ok(!(prop.x === 1 && prop.y === 1), `floor prop placed on the (1,1) arrival square (seed ${seed})`);
        const tableEntry = DRESSING_PROPS.find((p) => p.id === prop.id);
        assert.equal(tableEntry.kind, "floor");
      }

      for (let i = 0; i < props.length; i++) {
        for (let j = i + 1; j < props.length; j++) {
          const dist = Math.max(Math.abs(props[i].x - props[j].x), Math.abs(props[i].y - props[j].y));
          assert.ok(dist >= 2, `props ${props[i].id}@(${props[i].x},${props[i].y}) and ${props[j].id}@(${props[j].x},${props[j].y}) too close (seed ${seed} depth ${depth})`);
        }
      }
    }
  }
});

test("placeDressing: depth weighting biases shallow props toward depth 1 and deep props toward depth 20, across 200 seeds", () => {
  let shallowAtD1 = 0;
  let shallowAtD20 = 0;
  let deepAtD1 = 0;
  let deepAtD20 = 0;
  let totalD1 = 0;
  let totalD20 = 0;

  for (const seed of FIXED_SEEDS) {
    const gridD1 = genFloor(1, makeRng(seed)).g;
    const propsD1 = placeDressing({ seed, depth: 1, grid: gridD1 });
    for (const p of propsD1) {
      totalD1++;
      const entry = DRESSING_PROPS.find((e) => e.id === p.id);
      if (entry.lean === "shallow") shallowAtD1++;
      if (entry.lean === "deep") deepAtD1++;
    }

    const gridD20 = genFloor(20, makeRng(seed)).g;
    const propsD20 = placeDressing({ seed, depth: 20, grid: gridD20 });
    for (const p of propsD20) {
      totalD20++;
      const entry = DRESSING_PROPS.find((e) => e.id === p.id);
      if (entry.lean === "shallow") shallowAtD20++;
      if (entry.lean === "deep") deepAtD20++;
    }
  }

  const shallowShareD1 = shallowAtD1 / totalD1;
  const shallowShareD20 = shallowAtD20 / totalD20;
  const deepShareD1 = deepAtD1 / totalD1;
  const deepShareD20 = deepAtD20 / totalD20;

  assert.ok(shallowShareD1 > shallowShareD20, `shallow share at depth 1 (${shallowShareD1}) should exceed depth 20 (${shallowShareD20})`);
  assert.ok(deepShareD20 > deepShareD1, `deep share at depth 20 (${deepShareD20}) should exceed depth 1 (${deepShareD1})`);
});

test("placeDressing: total and pure — a missing grid, empty grid, no-walkable-cell grid, non-number seed and NaN depth never throw and always return an array", () => {
  assert.deepEqual(placeDressing({ seed: 1, depth: 1 }), []);
  assert.deepEqual(placeDressing({ seed: 1, depth: 1, grid: undefined }), []);
  assert.deepEqual(placeDressing({ seed: 1, depth: 1, grid: [] }), []);

  const allWallGrid = Array.from({ length: 21 }, () => Array.from({ length: 21 }, () => ({ wall: true, seen: false, feat: null })));
  assert.deepEqual(placeDressing({ seed: 1, depth: 1, grid: allWallGrid }), []);

  const realGrid = genFloor(1, makeRng(42)).g;
  assert.doesNotThrow(() => placeDressing({ seed: "not-a-number", depth: 1, grid: realGrid }));
  const withStringSeed = placeDressing({ seed: "not-a-number", depth: 1, grid: realGrid });
  assert.ok(Array.isArray(withStringSeed));

  assert.doesNotThrow(() => placeDressing({ seed: 42, depth: NaN, grid: realGrid }));
  const withNaNDepth = placeDressing({ seed: 42, depth: NaN, grid: realGrid });
  assert.ok(Array.isArray(withNaNDepth));
});

test("placeDressing: a grid too small/sparse for 8 spaced props returns fewer, never loops or throws", () => {
  // A tiny 5x5 grid: only the interior 3x3 open, everything else wall.
  // Excluding (1,1) (FLOOR_START), only a handful of 2-apart floor slots
  // exist — far fewer than PROPS_MIN, and the tiny border leaves almost no
  // valid wall-adjacent-to-open interior cells either.
  const size = 5;
  const tinyGrid = Array.from({ length: size }, (_, y) =>
    Array.from({ length: size }, (_, x) => ({
      wall: !(x >= 1 && x <= size - 2 && y >= 1 && y <= size - 2),
      seen: false,
      feat: null,
    }))
  );
  const props = placeDressing({ seed: 7, depth: 1, grid: tinyGrid });
  assert.ok(Array.isArray(props));
  assert.ok(props.length < PROPS_MIN, `expected fewer than ${PROPS_MIN} props on a tiny grid, got ${props.length}`);
});

test("placeDressing: never mutates its grid input", () => {
  const grid = genFloor(3, makeRng(11)).g;
  const before = JSON.stringify(grid);
  placeDressing({ seed: 11, depth: 3, grid });
  assert.equal(JSON.stringify(grid), before);
});

test("placeDressing: same seed/depth/grid always places identically (DRESS-04 core)", () => {
  const grid = genFloor(4, makeRng(99)).g;
  const first = placeDressing({ seed: 99, depth: 4, grid });
  const second = placeDressing({ seed: 99, depth: 4, grid });
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});

// --- dressingKey --------------------------------------------------------------

test("dressingKey: seed:depth: followed by one char per cell, row-major, 1 for wall else 0", () => {
  const grid = [
    [{ wall: true }, { wall: false }],
    [{ wall: false }, { wall: true }],
  ];
  assert.equal(dressingKey(42, 3, grid), "42:3:1001");
});

test("dressingKey: a missing/malformed grid yields an empty cell tail, never throws", () => {
  assert.equal(dressingKey(1, 1, undefined), "1:1:");
  assert.equal(dressingKey(1, 1, []), "1:1:");
});

// --- Task 2: draw-time exclusions, the dimmed layer, lazy-load, the bridge -

function openCell() {
  return { wall: false, seen: true, feat: null };
}

test("createRecordingContext: supports every method/property draw() and drawFeatureIcon use, records calls with alpha, keeps a save/restore state stack, and exposes imageDraws()", () => {
  const ctx = createRecordingContext();
  assert.equal(ctx.globalAlpha, 1);

  ctx.fillStyle = "#111";
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 3;
  ctx.font = "12px sans";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillRect(0, 0, 10, 10);
  ctx.strokeRect(0, 0, 10, 10);
  ctx.clearRect(0, 0, 10, 10);
  ctx.fillText("hi", 0, 0);
  ctx.translate(1, 1);
  ctx.rotate(0.5);
  ctx.scale(1, 1);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(1, 1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.arc(0, 0, 5, 0, 7);

  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 5);
  assert.equal(typeof grad.addColorStop, "function");
  grad.addColorStop(0, "red");
  grad.addColorStop(1, "blue");

  ctx.save();
  ctx.globalAlpha = 0.5;
  const img = { fake: true };
  ctx.drawImage(img, 1, 2, 3, 4);
  ctx.restore();

  // globalAlpha reverted after restore (state stack).
  assert.equal(ctx.globalAlpha, 1);

  // Every call was recorded with an op/args/alpha shape.
  for (const call of ctx.calls) {
    assert.ok(typeof call.op === "string");
    assert.ok(Array.isArray(call.args));
    assert.ok(typeof call.alpha === "number");
  }
  const opsSeen = new Set(ctx.calls.map((c) => c.op));
  for (const op of [
    "setTransform", "fillRect", "strokeRect", "clearRect", "fillText",
    "save", "restore", "translate", "rotate", "scale", "beginPath",
    "closePath", "arc", "fill", "stroke", "moveTo", "lineTo", "drawImage",
    "createRadialGradient",
  ]) {
    assert.ok(opsSeen.has(op), `expected ctx.calls to include a "${op}" entry`);
  }

  const draws = ctx.imageDraws();
  assert.deepEqual(draws, [{ img, x: 1, y: 2, w: 3, h: 4, alpha: 0.5 }]);
});

test("PROP_SCALE / FLOOR_PROP_ALPHA / WALL_PROP_ALPHA match the plan exactly", () => {
  assert.equal(PROP_SCALE, 0.6);
  assert.equal(FLOOR_PROP_ALPHA, 0.35);
  assert.equal(WALL_PROP_ALPHA, 0.85);
});

test("visibleProps: drops a prop on a feature (the stairs included), the party square, an unseen cell, or a cell the visible predicate rejects; clearing that cell's feat makes the prop visible again", () => {
  const grid = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => openCell()));
  grid[1][1].feat = "exit"; // the stairs, at (x:1, y:1)
  grid[1][2].feat = "dot"; // at (x:2, y:1)
  grid[3][3].seen = false; // at (x:3, y:3)

  const party = { x: 2, y: 2 };
  const props = [
    { x: 1, y: 1, id: "sack", icon: "set_dungeon_sack", kind: "floor" }, // on the stairs
    { x: 2, y: 1, id: "crate", icon: "set_dungeon_crate", kind: "floor" }, // on a "dot" cell
    { x: 2, y: 2, id: "rat", icon: "set_dungeon_rat", kind: "floor" }, // the party square
    { x: 3, y: 3, id: "moss", icon: "set_dungeon_moss", kind: "floor" }, // unseen
    { x: 4, y: 1, id: "rocks", icon: "set_dungeon_rocks", kind: "floor" }, // predicate rejects (4,1)
    { x: 4, y: 4, id: "book", icon: "set_dungeon_book", kind: "floor" }, // survives every filter
  ];
  const visible = (x, y) => !(x === 4 && y === 1);

  const kept = visibleProps(props, { grid, party, visible });
  assert.deepEqual(kept.map((p) => p.id), ["book"]);

  // No `visible` predicate given: fails open (never drops for that reason alone).
  const keptNoPredicate = visibleProps(
    [{ x: 4, y: 1, id: "rocks", icon: "set_dungeon_rocks", kind: "floor" }],
    { grid, party }
  );
  assert.deepEqual(keptNoPredicate.map((p) => p.id), ["rocks"]);

  // Clearing the stairs' feat makes that prop visible again (the one
  // documented consequence of placement never reading `feat`).
  grid[1][1].feat = null;
  const keptAfterResolve = visibleProps(props, { grid, party, visible });
  assert.deepEqual(keptAfterResolve.map((p) => p.id).sort(), ["book", "sack"]);
});

test("drawDressingLayer: draws every visible prop dim/small and centred, in exactly one save/restore, restores globalAlpha to 1, and skips an undecoded/missing image", () => {
  const grid = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => openCell()));
  const cell = 32;
  const props = [
    { x: 1, y: 1, id: "sack", icon: "set_dungeon_sack", kind: "floor" },
    { x: 3, y: 3, id: "torch_sconce", icon: "set_dungeon_torch_sconce", kind: "wall" },
    { x: 4, y: 4, id: "book", icon: "set_dungeon_book", kind: "floor" }, // image missing
    { x: 0, y: 4, id: "rat", icon: "set_dungeon_rat", kind: "floor" }, // image present but undecoded
  ];
  const images = {
    set_dungeon_sack: { complete: true, naturalWidth: 144 },
    set_dungeon_torch_sconce: { complete: true, naturalWidth: 144 },
    set_dungeon_rat: { complete: false, naturalWidth: 0 },
  };

  const ctx = createRecordingContext();
  const drawn = drawDressingLayer(ctx, props, {
    grid,
    party: { x: 0, y: 0 },
    images,
    cell,
    drawIcon: drawFeatureIcon,
  });
  assert.equal(drawn, 2);

  assert.equal(ctx.calls.filter((c) => c.op === "save").length, 1);
  assert.equal(ctx.calls.filter((c) => c.op === "restore").length, 1);
  assert.equal(ctx.globalAlpha, 1);

  const draws = ctx.imageDraws();
  assert.equal(draws.length, 2);
  const iconSize = Math.round(cell * PROP_SCALE);
  assert.equal(iconSize, Math.round(cell * 0.6));
  assert.ok(iconSize < Math.round(cell * 0.75), "props must draw smaller than a feature icon");

  const floorDraw = draws.find((d) => d.img === images.set_dungeon_sack);
  const wallDraw = draws.find((d) => d.img === images.set_dungeon_torch_sconce);
  assert.ok(floorDraw, "the floor prop should have been drawn");
  assert.ok(wallDraw, "the wall prop should have been drawn");
  assert.equal(floorDraw.alpha, FLOOR_PROP_ALPHA);
  assert.equal(wallDraw.alpha, WALL_PROP_ALPHA);
  assert.equal(floorDraw.w, iconSize);
  assert.equal(floorDraw.h, iconSize);
  assert.equal(floorDraw.x, 1 * cell + (cell - iconSize) / 2);
  assert.equal(floorDraw.y, 1 * cell + (cell - iconSize) / 2);
});

test("createDressingArt: loads the 54 images at most once, only once enabled AND released — every On/Off, release/setEnabled ordering the plan specifies", async () => {
  function makeDeferred() {
    let resolve;
    const promise = new Promise((res) => {
      resolve = res;
    });
    return { promise, resolve };
  }

  // setEnabled(true) before release() never loads; release() while enabled
  // loads exactly once; repeated release/setEnabled calls never reload;
  // images()/onReady resolve once, after the load; setEnabled(false) after
  // loading keeps images() while flipping enabled() false.
  {
    let loadCalls = 0;
    let readyCalls = 0;
    const deferred = makeDeferred();
    const art = createDressingArt({
      load: () => {
        loadCalls++;
        return deferred.promise;
      },
      onReady: () => {
        readyCalls++;
      },
    });

    art.setEnabled(true);
    assert.equal(loadCalls, 0, "setEnabled(true) before release() must never load");
    assert.equal(art.images(), null);

    art.release();
    assert.equal(loadCalls, 1, "release() while enabled must call load exactly once");

    art.release();
    art.setEnabled(true);
    assert.equal(loadCalls, 1, "repeated release/setEnabled calls must never load a second time");
    assert.equal(art.images(), null, "images() is null until the load resolves");
    assert.equal(readyCalls, 0);

    deferred.resolve({ set_dungeon_sack: {} });
    await Promise.resolve();
    await Promise.resolve();
    assert.deepEqual(art.images(), { set_dungeon_sack: {} });
    assert.equal(readyCalls, 1, "onReady is called once after the load resolves");

    art.setEnabled(false);
    assert.equal(art.enabled(), false);
    assert.deepEqual(art.images(), { set_dungeon_sack: {} }, "images() keeps the map after disabling");
  }

  // release() while disabled never loads; a later setEnabled(true) loads once.
  {
    let loadCalls = 0;
    const deferred = makeDeferred();
    const art = createDressingArt({
      load: () => {
        loadCalls++;
        return deferred.promise;
      },
    });

    art.release();
    assert.equal(loadCalls, 0, "release() while disabled must never load");

    art.setEnabled(true);
    assert.equal(loadCalls, 1, "a later setEnabled(true) must load exactly once");

    art.setEnabled(true);
    art.release();
    assert.equal(loadCalls, 1, "still never a second load");
  }
});

test("createDressingBridge: drawLayer no-ops (0 drawn, zero context calls) while disabled or before images arrive; with images it draws visibleProps(propsFor(state)); propsFor memoises per key and never mutates state", () => {
  const grid = genFloor(2, makeRng(5)).g;
  const state = { seed: 5, floor: { depth: 2, g: grid, px: 1, py: 1 } };

  {
    // Disabled, but with a fully-loaded image map — isolates the enabled()
    // guard itself (a populated images() alone must NOT be enough to draw).
    const images = {};
    for (const name of DRESSING_ICON_NAMES) images[name] = { complete: true, naturalWidth: 144 };
    const art = { enabled: () => false, images: () => images };
    const ctx = createRecordingContext();
    const bridge = createDressingBridge({ art, drawIcon: drawFeatureIcon });
    const drawn = bridge.drawLayer(ctx, state, 32, () => true);
    assert.equal(drawn, 0);
    assert.equal(ctx.calls.length, 0);
  }

  {
    const art = { enabled: () => true, images: () => null };
    const ctx = createRecordingContext();
    const bridge = createDressingBridge({ art, drawIcon: drawFeatureIcon });
    const drawn = bridge.drawLayer(ctx, state, 32, () => true);
    assert.equal(drawn, 0);
    assert.equal(ctx.calls.length, 0);
  }

  {
    const images = {};
    for (const name of DRESSING_ICON_NAMES) images[name] = { complete: true, naturalWidth: 144 };
    const art = { enabled: () => true, images: () => images };
    const bridge = createDressingBridge({ art, drawIcon: drawFeatureIcon });

    const props1 = bridge.propsFor(state);
    const props2 = bridge.propsFor(state);
    assert.equal(props1, props2, "propsFor memoises the SAME array object for the same key");

    const stateAtDepth3 = { seed: 5, floor: { depth: 3, g: genFloor(3, makeRng(5)).g, px: 1, py: 1 } };
    const props3 = bridge.propsFor(stateAtDepth3);
    assert.notEqual(props3, props1, "a new depth recomputes placement");

    const before = JSON.stringify(state);
    const ctx = createRecordingContext();
    const drawn = bridge.drawLayer(ctx, state, 32, () => true);
    assert.equal(JSON.stringify(state), before, "drawLayer never mutates state");
    const expected = visibleProps(props1, { grid, party: { x: 1, y: 1 }, visible: () => true });
    assert.equal(drawn, expected.length);
  }
});
