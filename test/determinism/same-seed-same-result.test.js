// ENG-02 / ENG-04 determinism proof: newRun(seed) is byte-identical across two
// independent invocations for the same seed. The seeded RNG cursor lives inside
// GameState, so nothing ambient (no Math.random, no wall clock) leaks into a
// run — the same seed rolls the same adventurer and the same floor 1 every time.
//
// Volatile wall-clock fields are stripped before comparison via
// stripVolatileFields (there are none on a fresh newRun today, but the helper
// keeps this test consistent with the parity/round-trip harness and future-
// proofs it if a timestamp field is ever added to GameState).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { newRun } from "../../engine/engine.js";
import { stripVolatileFields } from "../parity/harness/diffState.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const FIXTURE = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "..", "parity", "fixtures", "action-script.chargen.json"), "utf8"),
);
const SEEDS = FIXTURE.seeds;

test("newRun(seed) is deterministic across the covering seed set", () => {
  assert.ok(Array.isArray(SEEDS) && SEEDS.length > 0, "fixture must carry a non-empty seeds array");
  for (const seed of SEEDS) {
    const a = stripVolatileFields(newRun(seed));
    const b = stripVolatileFields(newRun(seed));
    assert.deepStrictEqual(a, b, `seed ${seed}: two newRun() calls must be byte-identical`);
  }
});

test("different seeds produce different runs (the seed actually drives generation)", () => {
  const a = stripVolatileFields(newRun(SEEDS[0]));
  const b = stripVolatileFields(newRun(SEEDS[1]));
  assert.notDeepStrictEqual(a, b, "distinct seeds should not coincide");
});

test("newRun state survives a JSON round-trip for every fixture seed", () => {
  for (const seed of SEEDS) {
    const state = newRun(seed);
    const roundTripped = JSON.parse(JSON.stringify(state));
    assert.deepStrictEqual(roundTripped, state, `seed ${seed}: GameState must round-trip losslessly`);
  }
});
