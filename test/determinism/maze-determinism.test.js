// ENG-05 determinism proof: genFloor(depth, rng) is a pure function of
// (depth, seed) — the same seed produces a byte-identical floor for every
// depth the fixed 5-floor Gate spans (1-5), and different seeds diverge.
// This is engine-vs-engine determinism (same seed twice); prototype parity
// for maze generation is proven separately via the per-slice parity
// fixtures built on the harness from 01-03.

import test from "node:test";
import assert from "node:assert/strict";
import { genFloor } from "../../engine/maze.js";
import { makeRng } from "../../engine/rng.js";

test("genFloor: same seed produces a byte-identical floor for depths 1-5", () => {
  for (const depth of [1, 2, 3, 4, 5]) {
    const a = genFloor(depth, makeRng(2026));
    const b = genFloor(depth, makeRng(2026));
    assert.deepStrictEqual(a, b, `depth ${depth}: same seed must produce identical floors`);
  }
});

test("genFloor: two different seeds produce different floors (seed actually drives generation)", () => {
  for (const depth of [1, 2, 3, 4, 5]) {
    const a = genFloor(depth, makeRng(1));
    const b = genFloor(depth, makeRng(2));
    assert.notDeepStrictEqual(a, b, `depth ${depth}: different seeds should not coincide`);
  }
});

test("genFloor: same seed reused across depths in one run still determines each floor independently", () => {
  // Each depth gets its own freshly-seeded rng in this test (as newRun will
  // do per-floor in a later plan); confirm no cross-depth leakage by
  // re-running the full depth 1-5 sequence twice with the same base seed
  // and comparing floor-by-floor.
  const seed = 777;
  const runOnce = () => [1, 2, 3, 4, 5].map((depth) => genFloor(depth, makeRng(seed + depth)));
  const run1 = runOnce();
  const run2 = runOnce();
  assert.deepStrictEqual(run1, run2);
});
