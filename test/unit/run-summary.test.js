// test/unit/run-summary.test.js
//
// Phase 65 (RUN-01): the run summary's season, seed, acts and integrity-hash
// fields. Proves SEASON === 1, that buildRunSummary carries all four new
// fields, that the hash is the run's stable id (immune to copy edits and the
// wall clock, but sensitive to the seed/action sequence), that die() and
// bury() agree on a hash for the same post-death state, that buildRunSummary
// never mutates its input, and that a hand-built state with no acts/seed
// still produces a valid, non-throwing summary.

import test from "node:test";
import assert from "node:assert/strict";

import { newRun, applyAction } from "../../engine/engine.js";
import { die, bury, buildRunSummary } from "../../engine/death.js";
import { makeRng } from "../../engine/rng.js";
import { runHash } from "../../engine/records.js";
import { SEASON } from "../../content/index.js";

/** runTo(seed, actions) — a fresh run driven through applyAction. */
function runTo(seed, actions) {
  let state = newRun(seed);
  for (const action of actions) {
    state = applyAction(state, action).state;
  }
  return state;
}

const CAMP_CAMP_ABANDON = [{ type: "camp" }, { type: "camp" }, { type: "abandon" }];

/** fixedState(overrides) — a hand-built state with NO seed and NO acts field,
 * mirroring test/unit/death.test.js's own fixedState/fixedCharacter helpers.
 */
function fixedCharacter(overrides = {}) {
  return {
    name: "Test Delver", race: "Human", sub: "Soldier", cls: "Fighter",
    level: 2, sp: 250.4, gold: 1234, kills: 3, motive: "Money",
    wp: 40, maxWP: 55, ward: null, regen: false, mirror: 0,
    ...overrides,
  };
}
function fixedState(overrides = {}) {
  const { c: cOverrides, ...rest } = overrides;
  return {
    c: fixedCharacter(cOverrides),
    floor: { depth: 3 },
    day: 7,
    steps: 500,
    combat: { foo: "bar" },
    beats: null,
    dead: false,
    deathNote: "",
    epitaph: "",
    ...rest,
  };
}

test("SEASON is 1", () => {
  assert.equal(SEASON, 1);
});

test("hash is the run id: buildRunSummary carries season, seed, acts, when and a stable hash", () => {
  const state = runTo(9001, CAMP_CAMP_ABANDON);
  const summary = buildRunSummary(state, "abandon", 123);
  assert.equal(summary.season, 1);
  assert.equal(summary.seed, 9001);
  assert.equal(summary.acts, 3);
  assert.equal(summary.when, 123);
  assert.match(summary.hash, /^[0-9a-f]{8}$/);
  assert.equal(summary.hash, runHash(summary));
});

test("hash is the run id: replaying the same seed and actions from a fresh newRun gives the same hash", () => {
  const stateA = runTo(9001, CAMP_CAMP_ABANDON);
  const stateB = runTo(9001, CAMP_CAMP_ABANDON);
  const summaryA = buildRunSummary(stateA, "abandon", 123);
  const summaryB = buildRunSummary(stateB, "abandon", 123);
  assert.equal(summaryA.hash, summaryB.hash);
});

test("hash is the run id: the wall clock (when) never changes the hash", () => {
  const state = runTo(9001, CAMP_CAMP_ABANDON);
  const summaryA = buildRunSummary(state, "abandon", 123);
  const summaryB = buildRunSummary(state, "abandon", 999);
  assert.equal(summaryA.hash, summaryB.hash);
});

test("hash is the run id: editing epitaph or note copy never changes the hash", () => {
  const state = runTo(9001, CAMP_CAMP_ABANDON);
  const summary = buildRunSummary(state, "abandon", 123);
  const edited = { ...summary, epitaph: "edited", note: "edited" };
  assert.equal(runHash(edited), summary.hash);
});

test("hash is the run id: a different seed with the same actions gives a different hash", () => {
  const state9001 = runTo(9001, CAMP_CAMP_ABANDON);
  const state9002 = runTo(9002, CAMP_CAMP_ABANDON);
  const summary9001 = buildRunSummary(state9001, "abandon", 123);
  const summary9002 = buildRunSummary(state9002, "abandon", 123);
  assert.notEqual(summary9001.hash, summary9002.hash);
});

test("die()'s returned hash equals bury()'s hash for the same post-death state and when", () => {
  const state = newRun(4242);
  const rng = makeRng(2);
  const summary = die(state, "trap", null, rng, [], () => 42);
  const graves = bury(state, "trap", null, [], () => 42);
  assert.equal(graves[0].hash, summary.hash);
});

test("buildRunSummary leaves its input state untouched (no mutation, rngState included)", () => {
  const state = newRun(555);
  const before = structuredClone(state);
  buildRunSummary(state, "abandon", 123);
  assert.deepStrictEqual(state, before);
  assert.deepStrictEqual(state.rngState, before.rngState);
});

test("a hand-built state with no acts and no seed gives acts 0, seed null and a valid, non-throwing hash", () => {
  const state = fixedState();
  assert.equal("acts" in state, false);
  assert.equal("seed" in state, false);
  const summary = buildRunSummary(state, "trap", 1);
  assert.equal(summary.acts, 0);
  assert.equal(summary.seed, null);
  assert.match(summary.hash, /^[0-9a-f]{8}$/);
});
