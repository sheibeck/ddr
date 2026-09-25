// test/unit/rollRange.test.js
//
// Phase 73 Plan 03 (ROLL-05): the contract for src/browser/rollRange.js's
// rangeText/rollVsText — the ONE place a winning range is written on every
// event-driven roll line from Phase 73-04 on. Every example here is
// transcribed from 73-03-PLAN.md's <behavior> list.

import test from "node:test";
import assert from "node:assert/strict";
import { rangeText, rollVsText } from "../../src/browser/rollRange.js";

test("rangeText: a wide winning range reads lo–hi with the U+2013 en dash", () => {
  assert.equal(rangeText(16, 20), "16–20");
  assert.equal(rangeText(18, 20), "18–20");
  assert.equal(rangeText(2, 6), "2–6");
  assert.equal(rangeText(1, 2), "1–2");
});

test("rangeText: a single winning face reads as just the face", () => {
  assert.equal(rangeText(20, 20), "20");
  assert.equal(rangeText(2, 2), "2");
});

test("rangeText: no winning face reads 'nothing'", () => {
  assert.equal(rangeText(21, 20), "nothing");
});

test("rangeText: atLeast at or below 1 reads the full die as 1–N", () => {
  assert.equal(rangeText(1, 20), "1–20");
  assert.equal(rangeText(-3, 20), "1–20");
});

test("rangeText: a missing or non-numeric field reads '?'", () => {
  assert.equal(rangeText(undefined, 20), "?");
  assert.equal(rangeText(16, undefined), "?");
  assert.equal(rangeText(NaN, 20), "?");
});

test("rangeText: no hyphen-minus ever appears in the output", () => {
  const samples = [
    rangeText(16, 20),
    rangeText(18, 20),
    rangeText(20, 20),
    rangeText(21, 20),
    rangeText(1, 20),
    rangeText(-3, 20),
    rangeText(2, 6),
    rangeText(2, 2),
    rangeText(1, 2),
  ];
  for (const s of samples) {
    assert.ok(!s.includes("-"), `expected no hyphen-minus in "${s}"`);
  }
});

test("rollVsText: joins the roll and the winning range with 'vs'", () => {
  assert.equal(rollVsText(17, 18, 20), "17 vs 18–20");
});

test("rollVsText: a missing roll reads '?'", () => {
  assert.equal(rollVsText(undefined, 16, 20), "? vs 16–20");
});
