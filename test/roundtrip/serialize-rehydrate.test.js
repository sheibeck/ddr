// ENG-04 standing round-trip guardrail. From this plan (01-07) forward, every
// slice that adds action handlers must keep this test green: a run's state,
// after EVERY applyAction call, must JSON round-trip deepStrictEqual (modulo
// the volatile wall-clock fields diffState.js already strips). This is the
// mechanical proof that GameState stays 100% plain, serializable data —
// no closures, no class instances, no non-JSON leaf ever sneaks in.
//
// Uses the movement action-script fixture (test/parity/fixtures/
// action-script.movement.json) so the guardrail runs against a real, varied
// sequence: plain moves, a blocked wall no-op, a one-way door, a floor
// descend, and a day-cycle upkeep tick — the full movement slice this plan
// lands.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { newRun, applyAction } from "../../engine/engine.js";
import { stripVolatileFields } from "../parity/harness/diffState.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const FIXTURE = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "..", "parity", "fixtures", "action-script.movement.json"), "utf8"),
);

test("newRun(seed) itself round-trips before any action runs", () => {
  const state = newRun(FIXTURE.seed);
  const stripped = stripVolatileFields(state);
  const rehydrated = JSON.parse(JSON.stringify(stripped));
  assert.deepStrictEqual(rehydrated, stripped);
});

test("state survives a JSON round-trip after EVERY action in the movement fixture", () => {
  let state = newRun(FIXTURE.seed);
  assert.ok(Array.isArray(FIXTURE.actions) && FIXTURE.actions.length > 0, "fixture must carry actions");

  FIXTURE.actions.forEach((action, i) => {
    const result = applyAction(state, action);
    state = result.state;
    const stripped = stripVolatileFields(state);
    const rehydrated = JSON.parse(JSON.stringify(stripped));
    assert.deepStrictEqual(rehydrated, stripped, `state must round-trip losslessly after action ${i} (${JSON.stringify(action)})`);
  });

  // Sanity: the fixture is supposed to actually exercise a descend and a
  // day-cycle tick, not silently no-op the whole way through.
  assert.equal(state.floor.depth, 2, "the fixture must have descended to floor 2");
  assert.equal(state.day, 2, "the fixture must have crossed a day tick");
  assert.equal(state.steps, 100, "the fixture must land on exactly 100 cumulative steps");
});

test("applyAction never mutates the state object passed in (returns a fresh clone)", () => {
  const before = newRun(FIXTURE.seed);
  const beforeJSON = JSON.stringify(before);
  applyAction(before, FIXTURE.actions[1]);
  assert.equal(JSON.stringify(before), beforeJSON, "the input state must be untouched (structuredClone in applyAction)");
});
