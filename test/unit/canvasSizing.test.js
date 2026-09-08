// Task 2 (TDD) — DPR canvas-sizing math.
//
// RED-first: this file imports src/browser/canvasSizing.js, which does not
// exist yet, so `node --test` fails to load it. Implementing that module
// (GREEN) turns it green.
//
// Proves: computeCanvasBacking preserves the fit() invariant (backing store
// = CSS px * devicePixelRatio) for integer and fractional DPR
// (04-RESEARCH.md Code Example #1); cellSizeForTextScale maps S/M/L to the
// UI-SPEC's locked 28/34/40 CSS-px values, defaulting unknown input to M.

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

test("cellSizeForTextScale: S -> 28", () => {
  assert.equal(cellSizeForTextScale("S"), 28);
});

test("cellSizeForTextScale: M -> 34", () => {
  assert.equal(cellSizeForTextScale("M"), 34);
});

test("cellSizeForTextScale: L -> 40", () => {
  assert.equal(cellSizeForTextScale("L"), 40);
});

test("cellSizeForTextScale: unknown size defaults to M (34)", () => {
  assert.equal(cellSizeForTextScale("XL"), 34);
  assert.equal(cellSizeForTextScale(undefined), 34);
  assert.equal(cellSizeForTextScale(null), 34);
  assert.equal(cellSizeForTextScale(""), 34);
});

test("canvasSizing.js has no document/window references", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../../src/browser/canvasSizing.js", import.meta.url), "utf8");
  assert.equal(/\bdocument\b/.test(src), false);
  assert.equal(/\bwindow\b/.test(src), false);
});
