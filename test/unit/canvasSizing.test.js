// Task 2 (TDD) — DPR canvas-sizing math.
//
// RED-first: this file imports src/browser/canvasSizing.js, which does not
// exist yet, so `node --test` fails to load it. Implementing that module
// (GREEN) turns it green.
//
// Proves: computeCanvasBacking preserves the fit() invariant (backing store
// = CSS px * devicePixelRatio) for integer and fractional DPR
// (04-RESEARCH.md Code Example #1); cellSizeForTextScale maps S/M/L to the
// device-review-revised 48/60/72 CSS-px values (04-CONTEXT.md "Device-review
// revisions" #1, supersedes the original UI-SPEC 28/34/40), defaulting
// unknown input to M.

import test from "node:test";
import assert from "node:assert/strict";

import { computeCanvasBacking, cellSizeForTextScale } from "../../src/browser/canvasSizing.js";

test("computeCanvasBacking: backing === style * dpr for dpr=1", () => {
  const result = computeCanvasBacking(300, 1);
  assert.equal(result.style, 300);
  assert.equal(result.backing, 300);
});

test("computeCanvasBacking: backing === style * dpr for dpr=2", () => {
  const result = computeCanvasBacking(300, 2);
  assert.equal(result.style, 300);
  assert.equal(result.backing, 600);
});

test("computeCanvasBacking: backing === style * dpr for dpr=3", () => {
  const result = computeCanvasBacking(300, 3);
  assert.equal(result.style, 300);
  assert.equal(result.backing, 900);
});

test("computeCanvasBacking: backing === style * dpr for fractional dpr=2.625 (Pixel 7 class device)", () => {
  const cssPx = 300;
  const dpr = 2.625;
  const result = computeCanvasBacking(cssPx, dpr);
  assert.equal(result.style, cssPx);
  assert.equal(result.backing, cssPx * dpr);
});

test("cellSizeForTextScale: S -> 48", () => {
  assert.equal(cellSizeForTextScale("S"), 48);
});

test("cellSizeForTextScale: M -> 60", () => {
  assert.equal(cellSizeForTextScale("M"), 60);
});

test("cellSizeForTextScale: L -> 72", () => {
  assert.equal(cellSizeForTextScale("L"), 72);
});

test("cellSizeForTextScale: unknown size defaults to M (60)", () => {
  assert.equal(cellSizeForTextScale("XL"), 60);
  assert.equal(cellSizeForTextScale(undefined), 60);
  assert.equal(cellSizeForTextScale(null), 60);
  assert.equal(cellSizeForTextScale(""), 60);
});

test("canvasSizing.js has no document/window references", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../../src/browser/canvasSizing.js", import.meta.url), "utf8");
  assert.equal(/\bdocument\b/.test(src), false);
  assert.equal(/\bwindow\b/.test(src), false);
});

// --- Phase 97 (SCREEN-04): the screen cell scale and its cap -----------------

import {
  cellScaleForWindow,
  cellPxFor,
  CELL_MAX_PX,
  WINDOW_CELL_BASE_PX,
  WINDOW_CELL_SLOPE_PX,
  WINDOW_CELL_SCALE_MAX,
} from "../../src/browser/canvasSizing.js";

const near = (a, b) => Math.abs(a - b) < 1e-9;

test("cellScaleForWindow: 1 up to a 412 px shorter side, linear, capped at 1.5", () => {
  const cases = [
    [412, 915, 1],
    [915, 412, 1],
    [360, 800, 1],
    [800, 360, 1],
    [600, 960, 1.235],
    [800, 1280, 1.485],
    [1366, 768, 1.445],
    [841, 701, 1.36125],
    [812, 1000, 1.5],
    [2000, 2000, 1.5],
    [NaN, 5, 1],
    [0, 0, 1],
  ];
  for (const [w, h, want] of cases) {
    const got = cellScaleForWindow(w, h);
    assert.ok(near(got, want), `${w}x${h}: ${got} vs ${want}`);
  }
  assert.equal(WINDOW_CELL_BASE_PX, 412);
  assert.equal(WINDOW_CELL_SLOPE_PX, 800);
  assert.equal(WINDOW_CELL_SCALE_MAX, 1.5);
  assert.equal(CELL_MAX_PX, 144);
});

test("cellPxFor: scales, caps at 144, floors at 6, reads a bad scale as 1", () => {
  assert.equal(cellPxFor(60, 0.8, 1), 48);
  assert.equal(cellPxFor(72, 2, 1), 144);
  assert.equal(cellPxFor(72, 2, 1.5), 144);
  assert.equal(cellPxFor(60, 0.8, 1.5), 72);
  assert.equal(cellPxFor(48, 0.6, 1), 29);
  assert.equal(cellPxFor(1, 1, 1), 6);
  assert.equal(cellPxFor(60, 0.8, NaN), 48);
  assert.equal(cellPxFor(60, 0.8, 0), 48);
  assert.equal(cellPxFor(60, 0.8, undefined), 48);
});

test("cellPxFor: a phone-sized screen gets exactly today's cell for every size and zoom", () => {
  for (const base of [48, 60, 72]) {
    for (let step = 0; step <= 28; step += 1) {
      const zoom = Math.round((0.6 + step * 0.05) * 100) / 100;
      const want = Math.max(6, Math.round(base * zoom));
      assert.equal(cellPxFor(base, zoom, cellScaleForWindow(412, 915)), want, `${base} x ${zoom}`);
      assert.equal(cellPxFor(base, zoom, cellScaleForWindow(360, 800)), want, `${base} x ${zoom} (360)`);
    }
  }
});

test("cellPxFor: no screen makes a cell larger than a phone's largest", () => {
  for (const base of [48, 60, 72]) {
    for (const zoom of [0.6, 1, 1.5, 2]) {
      assert.ok(cellPxFor(base, zoom, WINDOW_CELL_SCALE_MAX) <= CELL_MAX_PX);
    }
  }
});
