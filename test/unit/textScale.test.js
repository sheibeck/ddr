// Task 2 (TDD) — Text-scale clamping (pure).
//
// RED-first: textScaleForSize/clampTextScale/effectiveTextScale don't exist
// on src/browser/settings.js yet.
//
// Proves (04-UI-SPEC.md Typography / Accessibility Contract, 04-02-PLAN.md
// must_haves): S/M/L -> 0.85/1.0/1.25; unknown size -> 1.0; an OS font-scale
// input is clamped to [0.85, 1.25] regardless of how extreme; the FINAL
// product of size-scale * OS-scale is itself clamped to [0.85, 1.25] so an
// extreme OS setting can never break the fixed pixel-art layout.

import test from "node:test";
import assert from "node:assert/strict";

import { textScaleForSize, clampTextScale, effectiveTextScale } from "../../src/browser/settings.js";

test("textScaleForSize: S -> 0.85, M -> 1.0, L -> 1.25", () => {
  assert.equal(textScaleForSize("S"), 0.85);
  assert.equal(textScaleForSize("M"), 1.0);
  assert.equal(textScaleForSize("L"), 1.25);
});

test("textScaleForSize: unknown size defaults to 1.0", () => {
  assert.equal(textScaleForSize("XL"), 1.0);
  assert.equal(textScaleForSize(undefined), 1.0);
  assert.equal(textScaleForSize(null), 1.0);
  assert.equal(textScaleForSize(""), 1.0);
});

test("clampTextScale: within-range values pass through unchanged", () => {
  assert.equal(clampTextScale(1.0), 1.0);
  assert.equal(clampTextScale(0.85), 0.85);
  assert.equal(clampTextScale(1.25), 1.25);
  assert.equal(clampTextScale(1.1), 1.1);
});

test("clampTextScale: OS extremes clamp to [0.85, 1.25]", () => {
  assert.equal(clampTextScale(0.1), 0.85);
  assert.equal(clampTextScale(0), 0.85);
  assert.equal(clampTextScale(-5), 0.85);
  assert.equal(clampTextScale(3), 1.25);
  assert.equal(clampTextScale(100), 1.25);
});

test("clampTextScale: non-finite input defaults to 1.0", () => {
  assert.equal(clampTextScale(NaN), 1.0);
  assert.equal(clampTextScale(Infinity), 1.0);
  assert.equal(clampTextScale(-Infinity), 1.0);
  assert.equal(clampTextScale(undefined), 1.0);
  assert.equal(clampTextScale(null), 1.0);
  assert.equal(clampTextScale("2"), 1.0);
});

test("effectiveTextScale: combines size + OS scale, never leaves [0.85, 1.25]", () => {
  assert.equal(effectiveTextScale("M", 1.0), 1.0);
  assert.equal(effectiveTextScale("S", 1.0), 0.85);
  assert.equal(effectiveTextScale("L", 1.0), 1.25);

  // Extreme OS scale can't push the product past the bound even for L.
  assert.ok(effectiveTextScale("L", 100) <= 1.25);
  assert.ok(effectiveTextScale("L", 100) >= 0.85);

  // Extreme low OS scale can't push the product below the bound even for S.
  assert.ok(effectiveTextScale("S", 0) >= 0.85);
  assert.ok(effectiveTextScale("S", 0) <= 1.25);

  // Non-finite OS scale falls back to a neutral 1.0 factor.
  assert.equal(effectiveTextScale("M", NaN), 1.0);
  assert.equal(effectiveTextScale("S", undefined), 0.85);
});

test("effectiveTextScale: return value is always within [0.85, 1.25] for any size/OS-scale combo", () => {
  const sizes = ["S", "M", "L", "XL", undefined];
  const osScales = [-10, 0, 0.5, 1, 1.25, 2, 10, NaN, Infinity, -Infinity];
  for (const size of sizes) {
    for (const os of osScales) {
      const result = effectiveTextScale(size, os);
      assert.ok(result >= 0.85 && result <= 1.25, `effectiveTextScale(${size}, ${os}) = ${result} out of bounds`);
    }
  }
});
