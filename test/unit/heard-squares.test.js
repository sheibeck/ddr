// test/unit/heard-squares.test.js
//
// Phase 78 (HUD-07), plan 78-09: engine/derived.js#heardSquares — the pure
// read behind Acute Hearing's "hear the next room". Ruled option A (user,
// 2026-09-26): every UNRESOLVED encounter dot (`feat === "dot"`) within
// HEARING_RANGE (3, Chebyshev, walls ignored — it works through walls) that
// the map is not currently showing (not `seen`, or outside the dark view
// window). Traps, chests and every other feature stay silent; a hero without
// the skill, a dead hero or a missing state hears nothing; no rng, no
// mutation, row-major order.
//
// Real newRun floors (engine/state.js#newRun) with the grid cleared to open,
// unseen floor and hand-set feats/seen flags, so every case is exact.

import test from "node:test";
import assert from "node:assert/strict";

import { newRun } from "../../engine/state.js";
import { GW, GH } from "../../engine/maze.js";
import { heardSquares, HEARING_RANGE, inViewWindow } from "../../engine/derived.js";

const PX = 10, PY = 10;

/** A real newRun state, the hero given Acute Hearing (or not), the floor
 * cleared to open unseen ground with no features, the party at (10,10) on a
 * seen, lit square. */
function hearingState({ hearing = true, seed = 7 } = {}) {
  const state = newRun(seed);
  state.c.skills = { ...(state.c.skills || {}) };
  if (hearing) state.c.skills["Acute Hearing"] = 1;
  else delete state.c.skills["Acute Hearing"];
  delete state.c.skills["Night Vision"];
  state.c.darkFor = 0;
  state.c.timers = {};
  state.c.items = [];
  const g = state.floor.g;
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) g[y][x] = { wall: false, seen: false, feat: null, dark: false };
  state.floor.px = PX;
  state.floor.py = PY;
  // the reveal radius around the party: seen, so the adjacent squares are shown
  for (let y = PY - 1; y <= PY + 1; y++) for (let x = PX - 1; x <= PX + 1; x++) g[y][x].seen = true;
  return state;
}

const at = (state, x, y) => state.floor.g[y][x];
const keys = (list) => list.map(({ x, y }) => `${x},${y}`);

function deepFreeze(o) {
  if (o && typeof o === "object" && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

test("HEARING_RANGE is 3", () => {
  assert.equal(HEARING_RANGE, 3);
});

test("an unseen dot 3 squares away diagonally is heard; one 4 away is not", () => {
  const s = hearingState();
  at(s, PX + 3, PY + 3).feat = "dot";
  at(s, PX - 4, PY).feat = "dot";
  at(s, PX, PY + 4).feat = "dot";
  assert.deepEqual(heardSquares(s), [{ x: PX + 3, y: PY + 3 }]);
});

test("hearing works through walls: a dot behind a solid wall line is heard", () => {
  const s = hearingState();
  for (let y = 0; y < GH; y++) at(s, PX + 2, y).wall = true;
  at(s, PX + 3, PY).feat = "dot";
  assert.deepEqual(heardSquares(s), [{ x: PX + 3, y: PY }]);
});

test("silent features: an unseen chest, trap, teleporter, climb, gorge, one-way door, exit or gate 2 away is never heard", () => {
  const s = hearingState();
  const silent = ["chest", "trap", "tele", "climb", "gorge", "one", "exit", "gate"];
  const spots = [[PX - 2, PY - 2], [PX, PY - 2], [PX + 2, PY - 2], [PX - 2, PY], [PX + 2, PY], [PX - 2, PY + 2], [PX, PY + 2], [PX + 2, PY + 2]];
  silent.forEach((feat, i) => { at(s, spots[i][0], spots[i][1]).feat = feat; });
  assert.deepEqual(heardSquares(s), []);
});

test("a dot the map already shows (seen, lit) is not heard", () => {
  const s = hearingState();
  at(s, PX + 2, PY).feat = "dot";
  at(s, PX + 2, PY).seen = true;
  assert.deepEqual(heardSquares(s), []);
});

test("the party's own square is never heard, even with an unseen dot on it", () => {
  const s = hearingState();
  at(s, PX, PY).feat = "dot";
  at(s, PX, PY).seen = false;
  assert.deepEqual(heardSquares(s), []);
});

test("in the dark with no light: a dot already seen but outside the 3x3 view window is heard", () => {
  const s = hearingState();
  at(s, PX, PY).dark = true; // darkLimited: no Night Vision, no torch, no Amulet
  at(s, PX + 2, PY + 1).feat = "dot";
  at(s, PX + 2, PY + 1).seen = true; // explored, but hidden by the dark window
  at(s, PX + 1, PY + 1).feat = "dot"; // inside the 3x3: shown, so not heard
  assert.deepEqual(heardSquares(s), [{ x: PX + 2, y: PY + 1 }]);
});

test("a resolved dot (feat null) is not heard; after its square is revealed it is no longer heard", () => {
  const s = hearingState();
  at(s, PX + 3, PY).feat = "dot";
  assert.equal(heardSquares(s).length, 1);
  at(s, PX + 3, PY).seen = true;
  assert.deepEqual(heardSquares(s), [], "revealed: the map shows it, the ripple is gone");
  at(s, PX + 3, PY).seen = false;
  at(s, PX + 3, PY).feat = null;
  assert.deepEqual(heardSquares(s), [], "resolved: nothing left to hear");
});

test("a hero without the skill, a dead hero, and a missing state hear nothing", () => {
  const without = hearingState({ hearing: false });
  at(without, PX + 2, PY).feat = "dot";
  assert.deepEqual(heardSquares(without), []);

  const dead = hearingState();
  at(dead, PX + 2, PY).feat = "dot";
  dead.dead = true;
  assert.deepEqual(heardSquares(dead), []);

  const fallen = hearingState();
  at(fallen, PX + 2, PY).feat = "dot";
  fallen.c.wp = 0;
  assert.deepEqual(heardSquares(fallen), []);

  assert.deepEqual(heardSquares(null), []);
  assert.deepEqual(heardSquares(undefined), []);
  assert.deepEqual(heardSquares({}), []);
  assert.deepEqual(heardSquares({ c: without.c }), []);
});

test("squares near the grid edge are clipped, never read out of bounds", () => {
  const s = hearingState();
  s.floor.px = 0; s.floor.py = 0;
  at(s, 3, 0).feat = "dot";
  at(s, 0, 3).feat = "dot";
  at(s, 2, 2).feat = "dot";
  assert.deepEqual(keys(heardSquares(s)), ["3,0", "2,2", "0,3"]);
});

test("order: row-major (y, then x)", () => {
  const s = hearingState();
  const spots = [[PX + 3, PY - 3], [PX - 3, PY - 3], [PX - 2, PY + 3], [PX + 3, PY], [PX - 3, PY], [PX, PY - 2]];
  for (const [x, y] of spots) at(s, x, y).feat = "dot";
  assert.deepEqual(keys(heardSquares(s)), [
    `${PX - 3},${PY - 3}`, `${PX + 3},${PY - 3}`,
    `${PX},${PY - 2}`,
    `${PX - 3},${PY}`, `${PX + 3},${PY}`,
    `${PX - 2},${PY + 3}`,
  ]);
});

test("purity: a deep-frozen state passes and is unchanged; no rng is read", () => {
  const s = hearingState();
  at(s, PX + 3, PY - 1).feat = "dot";
  at(s, PX - 2, PY + 3).feat = "dot";
  const before = JSON.stringify(s);
  const rngBefore = s.rngState;
  deepFreeze(s);
  const heard = heardSquares(s);
  assert.deepEqual(keys(heard), [`${PX + 3},${PY - 1}`, `${PX - 2},${PY + 3}`]);
  assert.equal(JSON.stringify(s), before);
  assert.equal(s.rngState, rngBefore);
  // idempotent: the same state reads the same squares every call
  assert.deepEqual(heardSquares(s), heard);
});

test("the ruling holds on several real floors: every heard square is an unshown dot within range, and every such dot is heard", () => {
  for (const seed of [1, 2, 3, 11, 42]) {
    const s = newRun(seed);
    s.c.skills = { ...(s.c.skills || {}), "Acute Hearing": 1 };
    const { g, px, py } = s.floor;
    const expected = [];
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      if (x === px && y === py) continue;
      if (Math.max(Math.abs(x - px), Math.abs(y - py)) > HEARING_RANGE) continue;
      if (g[y][x].feat === "dot" && !(g[y][x].seen && inViewWindow(s, x, y))) expected.push(`${x},${y}`);
    }
    assert.deepEqual(keys(heardSquares(s)), expected, `seed ${seed}`);
  }
});
