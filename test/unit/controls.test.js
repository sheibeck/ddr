// Task 1 (TDD) — tap-to-cell + gesture-classification pure math.
//
// RED-first: this file imports src/browser/controls.js, which does not exist
// yet, so `node --test` fails to load it. Implementing that module (GREEN)
// turns it green.
//
// Proves: screenToCell inverts the SAME cs/pan/DPR affine transform the
// renderer uses (04-RESEARCH.md Pattern 1); resolveTapDirection returns a
// direction ONLY for an orthogonally-adjacent, currently-seen cell against
// the REAL engine floor shape (floor.g[y][x].seen), never a mockup Set
// (04-RESEARCH.md Pitfall 1); classifyPointerGesture distinguishes tap from
// pan-drag by travel threshold + duration (04-RESEARCH.md Pattern 2).

import test from "node:test";
import assert from "node:assert/strict";

import {
  screenToCell,
  resolveTapDirection,
  classifyPointerGesture,
  TAP_MOVE_THRESHOLD_PX,
  TAP_MAX_DURATION_MS,
  keepInViewAxis,
  keepInViewRect,
  EDGE_TRIGGER_CELLS,
} from "../../src/browser/controls.js";

// A minimal real-shaped floor grid: 5x5, all seen except one cell, matching
// the actual engine/maze.js shape (g[y][x] = { wall, seen, feat }), NOT the
// mockup's Set<string> keyed on "x,y".
function makeFloor() {
  const g = [];
  for (let y = 0; y < 5; y++) {
    g.push([]);
    for (let x = 0; x < 5; x++) g[y].push({ wall: false, seen: true, feat: null });
  }
  g[1][3].seen = false; // one deliberately unseen cell, north of (3,2)
  return { g, px: 2, py: 2 };
}

function isSeenFor(floor) {
  return (x, y) => !!(floor.g[y] && floor.g[y][x] && floor.g[y][x].seen);
}

test("controls.js: exports pure constants", () => {
  assert.equal(TAP_MOVE_THRESHOLD_PX, 10);
  assert.equal(TAP_MAX_DURATION_MS, 350);
});

test("screenToCell: exact-center tap resolves to the player's own cell", () => {
  const pos = { x: 5, y: 5 };
  const pan = { x: 0, y: 0 };
  const cs = 30;
  const canvasPad = 0;
  const viewportRect = { left: 0, top: 0, width: 300, height: 300 };
  // Forward transform places pos at the viewport center exactly.
  const clientX = viewportRect.width / 2;
  const clientY = viewportRect.height / 2;
  const cell = screenToCell(clientX, clientY, viewportRect, pos, pan, cs, canvasPad);
  assert.deepEqual(cell, { x: 5, y: 5 });
});

test("screenToCell: adjacent E/W/N/S taps resolve to the correct neighbor cell", () => {
  const pos = { x: 5, y: 5 };
  const pan = { x: 0, y: 0 };
  const cs = 30;
  const canvasPad = 0;
  const viewportRect = { left: 0, top: 0, width: 300, height: 300 };
  const cx = viewportRect.width / 2;
  const cy = viewportRect.height / 2;

  const east = screenToCell(cx + cs, cy, viewportRect, pos, pan, cs, canvasPad);
  assert.deepEqual(east, { x: 6, y: 5 });

  const west = screenToCell(cx - cs, cy, viewportRect, pos, pan, cs, canvasPad);
  assert.deepEqual(west, { x: 4, y: 5 });

  const south = screenToCell(cx, cy + cs, viewportRect, pos, pan, cs, canvasPad);
  assert.deepEqual(south, { x: 5, y: 6 });

  const north = screenToCell(cx, cy - cs, viewportRect, pos, pan, cs, canvasPad);
  assert.deepEqual(north, { x: 5, y: 4 });
});

test("screenToCell: honors pan offset and canvasPad in the inverse transform", () => {
  const pos = { x: 5, y: 5 };
  const pan = { x: 15, y: -15 };
  const cs = 30;
  const canvasPad = 8;
  const viewportRect = { left: 20, top: 40, width: 300, height: 300 };
  const vw = viewportRect.width, vh = viewportRect.height;
  const tx = vw / 2 - (pos.x + 0.5) * cs - canvasPad + pan.x;
  const ty = vh / 2 - (pos.y + 0.5) * cs - canvasPad + pan.y;
  // Place the client point exactly at the center of cell (5,5) using the
  // SAME forward transform screenToCell must invert.
  const localX = tx + 5 * cs + cs / 2;
  const localY = ty + 5 * cs + cs / 2;
  const clientX = viewportRect.left + localX;
  const clientY = viewportRect.top + localY;
  const cell = screenToCell(clientX, clientY, viewportRect, pos, pan, cs, canvasPad);
  assert.deepEqual(cell, { x: 5, y: 5 });
});

test("resolveTapDirection: adjacent seen cells resolve N/E/S/W correctly", () => {
  const floor = makeFloor();
  const isSeen = isSeenFor(floor);
  const pos = { x: floor.px, y: floor.py }; // (2,2)

  assert.equal(resolveTapDirection(pos, { x: 3, y: 2 }, isSeen), "E");
  assert.equal(resolveTapDirection(pos, { x: 1, y: 2 }, isSeen), "W");
  assert.equal(resolveTapDirection(pos, { x: 2, y: 3 }, isSeen), "S");
  assert.equal(resolveTapDirection(pos, { x: 2, y: 1 }, isSeen), "N");
});

test("resolveTapDirection: diagonal tap returns null", () => {
  const floor = makeFloor();
  const isSeen = isSeenFor(floor);
  const pos = { x: floor.px, y: floor.py };
  assert.equal(resolveTapDirection(pos, { x: 3, y: 3 }, isSeen), null);
  assert.equal(resolveTapDirection(pos, { x: 1, y: 1 }, isSeen), null);
});

test("resolveTapDirection: distance-2 tap returns null", () => {
  const floor = makeFloor();
  const isSeen = isSeenFor(floor);
  const pos = { x: floor.px, y: floor.py };
  assert.equal(resolveTapDirection(pos, { x: 4, y: 2 }, isSeen), null);
});

test("resolveTapDirection: same-cell tap returns null", () => {
  const floor = makeFloor();
  const isSeen = isSeenFor(floor);
  const pos = { x: floor.px, y: floor.py };
  assert.equal(resolveTapDirection(pos, { x: 2, y: 2 }, isSeen), null);
});

test("resolveTapDirection: unseen adjacent cell returns null even though orthogonally adjacent", () => {
  const floor = makeFloor();
  const isSeen = isSeenFor(floor);
  // (3,1) is unseen and orthogonally adjacent to pos (3,2).
  const pos = { x: 3, y: 2 };
  assert.equal(resolveTapDirection(pos, { x: 3, y: 1 }, isSeen), null);
});

test("resolveTapDirection: uses the isSeen predicate against real floor.g[y][x].seen shape, not a mockup Set", () => {
  const floor = makeFloor();
  let calledWith = null;
  const isSeen = (x, y) => {
    calledWith = { x, y };
    return isSeenFor(floor)(x, y);
  };
  const pos = { x: floor.px, y: floor.py };
  resolveTapDirection(pos, { x: 3, y: 2 }, isSeen);
  assert.deepEqual(calledWith, { x: 3, y: 2 });
});

test("classifyPointerGesture: below-threshold quick pointer classifies as tap", () => {
  const downEvt = { timeStamp: 1000 };
  const upEvt = { timeStamp: 1000 + TAP_MAX_DURATION_MS - 50 };
  const result = classifyPointerGesture(downEvt, upEvt, TAP_MOVE_THRESHOLD_PX - 1);
  assert.equal(result, "tap");
});

test("classifyPointerGesture: at-threshold travel and duration still classifies as tap", () => {
  const downEvt = { timeStamp: 1000 };
  const upEvt = { timeStamp: 1000 + TAP_MAX_DURATION_MS };
  const result = classifyPointerGesture(downEvt, upEvt, TAP_MOVE_THRESHOLD_PX);
  assert.equal(result, "tap");
});

test("classifyPointerGesture: over-threshold travel classifies as drag", () => {
  const downEvt = { timeStamp: 1000 };
  const upEvt = { timeStamp: 1050 };
  const result = classifyPointerGesture(downEvt, upEvt, TAP_MOVE_THRESHOLD_PX + 1);
  assert.equal(result, "drag");
});

test("classifyPointerGesture: over-duration with low travel classifies as drag (long-press, reserved)", () => {
  const downEvt = { timeStamp: 1000 };
  const upEvt = { timeStamp: 1000 + TAP_MAX_DURATION_MS + 1 };
  const result = classifyPointerGesture(downEvt, upEvt, 1);
  assert.equal(result, "drag");
});

// ─── keepInViewAxis (quick 260918-vm3): the one-axis stationary-camera rule ──
//
// EDGE_TRIGGER_CELLS === 2: the party's cell-centre distance from a visible
// edge, in cells, below which the camera nudges. The camera coordinate is
// the grid point (cell units, fractional) pinned under the viewport centre
// on that axis; the caller runs this once per axis.

test("keepInViewAxis: exports EDGE_TRIGGER_CELLS === 2", () => {
  assert.equal(EDGE_TRIGGER_CELLS, 2);
});

test("keepInViewAxis: identity — party comfortably inside, nothing moves", () => {
  assert.equal(keepInViewAxis(6, 6.5, 12), 6);
});

test("keepInViewAxis: low edge — party within the trigger nudges the minimum to rest the margin", () => {
  const result = keepInViewAxis(6, 1.5, 12);
  assert.equal(result, 3.5);
  // party sits exactly rest=4 cells in from the low edge (result - half)
  assert.equal(1.5 - (result - 6), 4);
  assert.notEqual(result, 1.5, "never centred on the party");
});

test("keepInViewAxis: high edge — party within the trigger nudges the minimum to rest the margin", () => {
  const result = keepInViewAxis(6, 10.5, 12);
  assert.equal(result, 8.5);
  assert.equal(result + 6 - 10.5, 4);
});

test("keepInViewAxis: off-screen recovery — a party already past the high edge (e.g. after a drag) is brought back to the margin", () => {
  const result = keepInViewAxis(6, 14.5, 12);
  assert.equal(result, 12.5);
  assert.equal(result + 6 - 14.5, 4);
});

test("keepInViewAxis: a viewport too small to hold the margin on both sides centres that axis", () => {
  // span 5: rest = max(3, 5/3) = 3; 2*rest = 6 >= 5, so this axis always centres.
  assert.equal(keepInViewAxis(6, 999, 5), 999);
  assert.equal(keepInViewAxis(-40, -3.2, 5), -3.2);
});

test("keepInViewAxis: post-nudge stability — the camera only moves toward the party, one margin at a time", () => {
  // Starting camera at 6 (span 12), a party at 1.5 nudges the camera to 3.5
  // (Test 2 above) — the visible low edge is now cam - half = 3.5 - 6 = -2.5.
  const cam = 3.5;
  // Stepping back toward the centre stays put — well clear of the margin.
  assert.equal(keepInViewAxis(cam, 2.5, 12), 3.5);
  // Still 3 cells inside the new edge (0.5 - (-2.5) === 3) — stays put.
  assert.equal(keepInViewAxis(cam, 0.5, 12), 3.5);
  // Exactly EDGE_TRIGGER_CELLS (2) from the new edge is still outside the
  // strict "<" trigger — one more step is needed to actually cross it.
  assert.equal(keepInViewAxis(cam, -0.5, 12), 3.5);
  // Crossing inside the trigger (distance 1.5 < 2) nudges again, to the
  // point that rests the party exactly `rest` (4) cells from the new edge.
  const result = keepInViewAxis(cam, -1, 12);
  assert.equal(result, 1);
  assert.equal(-1 - (result - 6), 4);
});

// ─── keepInViewRect (Phase 78, HUD-08): the pad is an edge ──────────────────
//
// The same stationary-camera rule with the arrow pad's on-screen rect as an
// extra visible edge. Every quantity is in cells; the obstacle is relative
// to the viewport's top-left. With span {x:14, y:20} and cam {x:7, y:10} the
// viewport's top-left sits on grid point {0, 0}, so a party's grid point IS
// its viewport position in these cases.

const SPAN = Object.freeze({ x: 14, y: 20 });
const CAM = Object.freeze({ x: 7, y: 10 });
// A 4 x 4-cell pad in each bottom corner (mirror images).
const PAD_RIGHT = Object.freeze({ left: 10, top: 16, right: 14, bottom: 20 });
const PAD_LEFT = Object.freeze({ left: 0, top: 16, right: 4, bottom: 20 });

test("keepInViewRect: HUD-08 empty — a null obstacle gives exactly keepInViewAxis on each axis (tap mode's camera is unchanged)", () => {
  for (const cam of [{ x: 7, y: 10 }, { x: -3.25, y: 40 }, { x: 12.5, y: 0.5 }]) {
    for (const party of [{ x: 7.5, y: 10.5 }, { x: 0.5, y: 19.5 }, { x: 30, y: -8 }, { x: 13.2, y: 1.1 }]) {
      for (const span of [{ x: 14, y: 20 }, { x: 5, y: 5 }, { x: 30.5, y: 11 }]) {
        assert.deepEqual(keepInViewRect(cam, party, span, null), {
          x: keepInViewAxis(cam.x, party.x, span.x),
          y: keepInViewAxis(cam.y, party.y, span.y),
        });
      }
    }
  }
});

test("keepInViewRect: a malformed obstacle (non-finite, empty) is treated as no pad", () => {
  const party = { x: 12.5, y: 14.5 };
  const plain = keepInViewRect(CAM, party, SPAN, null);
  for (const bad of [undefined, {}, { left: 10, top: 16, right: 10, bottom: 20 }, { left: NaN, top: 16, right: 14, bottom: 20 }]) {
    assert.deepEqual(keepInViewRect(CAM, party, SPAN, bad), plain);
  }
});

test("keepInViewRect: nothing near any edge returns the input camera unchanged", () => {
  for (const pad of [null, PAD_RIGHT, PAD_LEFT]) {
    assert.deepEqual(keepInViewRect(CAM, { x: 7.5, y: 8.5 }, SPAN, pad), { x: 7, y: 10 });
  }
});

test("keepInViewRect: HUD-08 adjacency — walking down inside the pad's column scrolls at the pad's top edge, strictly", () => {
  // Exactly EDGE_TRIGGER_CELLS (2) above the pad's top edge: no scroll.
  assert.deepEqual(keepInViewRect(CAM, { x: 12, y: 16 - EDGE_TRIGGER_CELLS }, SPAN, PAD_RIGHT), { x: 7, y: 10 });
  // Closer (1.5): the camera moves down the minimum to rest the margin above
  // the pad, never centring on the party.
  const party = { x: 12, y: 14.5 };
  const next = keepInViewRect(CAM, party, SPAN, PAD_RIGHT);
  assert.equal(next.x, 7, "the x axis is untouched");
  assert.ok(next.y > CAM.y, "the camera scrolls down");
  assert.notEqual(next.y, party.y, "never centred on the party");
  const relY = party.y - (next.y - SPAN.y / 2);
  const gap = PAD_RIGHT.top - relY;
  assert.ok(gap > EDGE_TRIGGER_CELLS, `the party rests clear of the pad (gap ${gap})`);
  // keepInViewAxis's own rest over the region above the pad: max(3, 16/3).
  assert.ok(Math.abs(gap - Math.max(EDGE_TRIGGER_CELLS + 1, PAD_RIGHT.top / 3)) < 1e-9, `rest margin (gap ${gap})`);
  // Post-nudge stability: the same party at the new camera stays put.
  assert.deepEqual(keepInViewRect(next, party, SPAN, PAD_RIGHT), next);
});

test("keepInViewRect: walking down OUTSIDE the pad's column only reacts to the viewport's own bottom edge", () => {
  // 1.5 cells above the pad's top edge, but beside it: nothing moves.
  assert.deepEqual(keepInViewRect(CAM, { x: 5, y: 14.5 }, SPAN, PAD_RIGHT), { x: 7, y: 10 });
  // Near the viewport's bottom edge: exactly keepInViewAxis's answer.
  assert.deepEqual(keepInViewRect(CAM, { x: 5, y: 18.5 }, SPAN, PAD_RIGHT), { x: 7, y: keepInViewAxis(10, 18.5, 20) });
});

test("keepInViewRect: walking right inside the pad's row band reacts to the pad's left edge, strictly", () => {
  assert.deepEqual(keepInViewRect(CAM, { x: 10 - EDGE_TRIGGER_CELLS, y: 18 }, SPAN, PAD_RIGHT), { x: 7, y: 10 });
  const party = { x: 8.5, y: 18 };
  const next = keepInViewRect(CAM, party, SPAN, PAD_RIGHT);
  assert.equal(next.y, 10, "the y axis is untouched");
  assert.ok(next.x > CAM.x, "the camera scrolls right");
  const relX = party.x - (next.x - SPAN.x / 2);
  assert.ok(PAD_RIGHT.left - relX > EDGE_TRIGGER_CELLS, "the party rests clear of the pad's left edge");
  assert.deepEqual(keepInViewRect(next, party, SPAN, PAD_RIGHT), next);
});

test("keepInViewRect: a party already under the pad (after a drag) is brought back above it", () => {
  const party = { x: 12, y: 18 };
  const next = keepInViewRect(CAM, party, SPAN, PAD_RIGHT);
  const relY = party.y - (next.y - SPAN.y / 2);
  assert.ok(relY < PAD_RIGHT.top - EDGE_TRIGGER_CELLS, `the party is back above the pad (rel ${relY})`);
});

test("keepInViewRect: BOTTOM LEFT mirrors BOTTOM RIGHT, case for case (a pinned mirrored pair)", () => {
  const mirrorX = (p) => ({ x: SPAN.x - p.x, y: p.y });
  const cases = [
    { x: 12, y: 14 }, // exactly the trigger above the pad: no scroll
    { x: 12, y: 14.5 }, // inside the column, closer: scroll down
    { x: 5, y: 14.5 }, // outside the column: nothing
    { x: 5, y: 18.5 }, // outside the column, near the viewport bottom
    { x: 8, y: 18 }, // row band, exactly the trigger from the inner edge
    { x: 8.5, y: 18 }, // row band, closer: scroll toward the open side
    { x: 12, y: 18 }, // under the pad
  ];
  for (const party of cases) {
    const right = keepInViewRect(CAM, party, SPAN, PAD_RIGHT);
    const left = keepInViewRect(CAM, mirrorX(party), SPAN, PAD_LEFT);
    assert.ok(Math.abs(left.x - (SPAN.x - right.x)) < 1e-9, `x mirrors for ${JSON.stringify(party)}: ${left.x} vs ${SPAN.x - right.x}`);
    assert.ok(Math.abs(left.y - right.y) < 1e-9, `y matches for ${JSON.stringify(party)}`);
  }
  // The inner side edge of a BOTTOM LEFT pad is its right edge.
  const next = keepInViewRect(CAM, { x: 5.5, y: 18 }, SPAN, PAD_LEFT);
  assert.ok(next.x < CAM.x, "walking left toward a BOTTOM LEFT pad scrolls left");
});
