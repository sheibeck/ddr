// test/unit/icons.test.js
//
// Pins for src/browser/icons.js: FEATURE_ICONS / PLAYER_MARKER_ICON /
// featureKeyForCell / drawFeatureIcon rotation + scale. featureKeyForCell
// maps every engine feat key mazeworld.html's draw() renders (dot/tele/one/
// trap/chest/climb/gorge/exit/gate) to the correct one of the 9 provided PNG
// keys. icons.js's Image()/canvas parts are browser-only and deferred to
// device-UAT — this file only exercises the pure featureKeyForCell mapping,
// and asserts icons.js imports cleanly under node --test (no Image()
// construction at module top level).
//
// Moved (git mv, history follows) from the test file the 04-era coach-mark
// sequencer shared a home with (Phase 46, DEAD-05: the sequencer module and
// its ten sequencer/seen-flag tests were deleted — see PROJECT.md Key
// Decisions). These fifteen icons.js pins are unchanged by the move.

import test from "node:test";
import assert from "node:assert/strict";

import { FEATURE_ICONS, PLAYER_MARKER_ICON, featureKeyForCell, drawFeatureIcon } from "../../src/browser/icons.js";

/** A minimal fake CanvasRenderingContext2D that just records call order/args. */
function makeFakeCtx() {
  const calls = [];
  return {
    calls,
    save: () => calls.push(["save"]),
    restore: () => calls.push(["restore"]),
    translate: (x, y) => calls.push(["translate", x, y]),
    rotate: (rad) => calls.push(["rotate", rad]),
    drawImage: (img, x, y, w, h) => calls.push(["drawImage", x, y, w, h]),
  };
}

// --- featureKeyForCell (icons.js, pure, DOM-free) ----------------------------

test("icons.js: FEATURE_ICONS is exactly the 9 provided PNG keys", () => {
  assert.deepEqual(
    [...FEATURE_ICONS].sort(),
    ["chest", "crevice", "descent", "encounter", "onewaydoor", "party", "teleport", "trap", "wall"].sort()
  );
});

test("icons.js: PLAYER_MARKER_ICON is the party icon", () => {
  assert.equal(PLAYER_MARKER_ICON, "party");
  assert.ok(FEATURE_ICONS.includes(PLAYER_MARKER_ICON));
});

test("featureKeyForCell: maps every engine feat key mazeworld.html draw() renders to the correct PNG key", () => {
  const cases = [
    ["dot", "encounter"],
    ["tele", "teleport"],
    ["one", "onewaydoor"],
    ["trap", "trap"],
    ["chest", "chest"],
    ["climb", "wall"],
    ["gorge", "crevice"],
    ["exit", "descent"],
    ["gate", "descent"],
  ];
  for (const [feat, expected] of cases) {
    assert.equal(featureKeyForCell(feat), expected, `feat "${feat}"`);
    // Also accept a real engine/maze.js floor-cell shape (g[y][x] = {feat, ...}).
    assert.equal(featureKeyForCell({ feat, seen: true, dark: false }), expected, `cell.feat "${feat}"`);
  }
});

test("featureKeyForCell: an unfeatured/unrecognized cell returns null (no icon drawn, never a crash)", () => {
  assert.equal(featureKeyForCell(null), null);
  assert.equal(featureKeyForCell(undefined), null);
  assert.equal(featureKeyForCell({ feat: null }), null);
  assert.equal(featureKeyForCell("not-a-real-feat"), null);
});

test("icons.js imports cleanly under node --test (no Image()/canvas construction at module top level)", () => {
  assert.equal(typeof featureKeyForCell, "function");
});

// --- drawFeatureIcon dir/rotation (DR5, pure logic against a fake ctx) ------

test("drawFeatureIcon: no dir arg draws unrotated (every non-door icon + the player marker)", () => {
  const ctx = makeFakeCtx();
  const img = {};
  drawFeatureIcon(ctx, img, 10, 20, 32);
  assert.deepEqual(ctx.calls.map((c) => c[0]), ["drawImage"]);
  assert.equal(ctx.calls[0][1], 10 + (32 - Math.round(32 * 1.0)) / 2);
});

test("drawFeatureIcon: an unrecognized dir value fails open — draws unrotated", () => {
  const ctx = makeFakeCtx();
  drawFeatureIcon(ctx, {}, 0, 0, 32, "NE");
  assert.deepEqual(ctx.calls.map((c) => c[0]), ["drawImage"]);
});

test("drawFeatureIcon: dir='E' rotates 0deg (base onewaydoor.png already points East/right)", () => {
  const ctx = makeFakeCtx();
  drawFeatureIcon(ctx, {}, 0, 0, 32, "E");
  assert.deepEqual(ctx.calls.map((c) => c[0]), ["save", "translate", "rotate", "drawImage", "restore"]);
  assert.equal(ctx.calls[2][1], 0);
});

test("drawFeatureIcon: dir='S' rotates 90deg clockwise (points down)", () => {
  const ctx = makeFakeCtx();
  drawFeatureIcon(ctx, {}, 0, 0, 32, "S");
  assert.equal(ctx.calls[2][0], "rotate");
  assert.ok(Math.abs(ctx.calls[2][1] - Math.PI / 2) < 1e-9);
});

test("drawFeatureIcon: dir='W' rotates 180deg (points left)", () => {
  const ctx = makeFakeCtx();
  drawFeatureIcon(ctx, {}, 0, 0, 32, "W");
  assert.equal(ctx.calls[2][0], "rotate");
  assert.ok(Math.abs(ctx.calls[2][1] - Math.PI) < 1e-9);
});

test("drawFeatureIcon: dir='N' rotates 270deg (points up)", () => {
  const ctx = makeFakeCtx();
  drawFeatureIcon(ctx, {}, 0, 0, 32, "N");
  assert.equal(ctx.calls[2][0], "rotate");
  assert.ok(Math.abs(ctx.calls[2][1] - (3 * Math.PI) / 2) < 1e-9);
});

test("drawFeatureIcon: rotated draw is centered on the cell (translate to cell center, drawImage offset by -iconSize/2)", () => {
  const ctx = makeFakeCtx();
  const size = 32;
  drawFeatureIcon(ctx, {}, 100, 200, size, "S");
  const iconSize = Math.round(size * 1.0);
  assert.deepEqual(ctx.calls[1], ["translate", 100 + size / 2, 200 + size / 2]);
  assert.deepEqual(ctx.calls[3], ["drawImage", -iconSize / 2, -iconSize / 2, iconSize, iconSize]);
});

// --- drawFeatureIcon scale param (DR11, "Feature icons -> ~3/4 size") ------

test("drawFeatureIcon: no scale arg defaults to 1.0 (party-marker call site is unaffected)", () => {
  const ctx = makeFakeCtx();
  const size = 32;
  drawFeatureIcon(ctx, {}, 10, 20, size);
  const iconSize = Math.round(size * 1.0);
  assert.deepEqual(ctx.calls[0], ["drawImage", 10 + (size - iconSize) / 2, 20 + (size - iconSize) / 2, iconSize, iconSize]);
});

test("drawFeatureIcon: scale=0.75 shrinks the unrotated icon but keeps it centered in the cell", () => {
  const ctx = makeFakeCtx();
  const size = 32;
  drawFeatureIcon(ctx, {}, 10, 20, size, undefined, 0.75);
  const iconSize = Math.round(size * 0.75);
  assert.equal(iconSize, 24);
  assert.deepEqual(ctx.calls[0], ["drawImage", 10 + (size - iconSize) / 2, 20 + (size - iconSize) / 2, iconSize, iconSize]);
});

test("drawFeatureIcon: scale=0.75 with a rotated (one-way-door) icon shrinks it without moving the rotation pivot off the cell center", () => {
  const ctx = makeFakeCtx();
  const size = 32;
  drawFeatureIcon(ctx, {}, 100, 200, size, "S", 0.75);
  const iconSize = Math.round(size * 0.75);
  assert.deepEqual(ctx.calls[1], ["translate", 100 + size / 2, 200 + size / 2]);
  assert.deepEqual(ctx.calls[3], ["drawImage", -iconSize / 2, -iconSize / 2, iconSize, iconSize]);
});
