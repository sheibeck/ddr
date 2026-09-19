// RUN-04 coverage (03-03 Task 2): die() is the SOLE terminator of a run, and
// death is permanent — there is no revive/undo/continue anywhere in the
// engine. A dead character stays dead; ordinary actions become no-ops.

import test from "node:test";
import assert from "node:assert/strict";

import { newRun, applyAction } from "../../engine/engine.js";
import { die } from "../../engine/death.js";
import { makeRng } from "../../engine/rng.js";
import { move } from "../../engine/movement.js";

test("die() sets state.dead to true", () => {
  const state = newRun(1);
  const rng = makeRng(state.rngState);
  const events = [];
  die(state, "starve", null, rng, events, () => 0);
  assert.equal(state.dead, true);
});

test("die() is the sole terminator — a died event is pushed, no win/Gate path involved", () => {
  const state = newRun(1);
  const rng = makeRng(state.rngState);
  const events = [];
  die(state, "starve", null, rng, events, () => 0);
  assert.ok(events.some((e) => e.type === "died"), "die() pushes a died event");
  assert.ok(!("won" in state), "death is never routed through a win path — the run carries no won flag");
});

test("death is permanent: move() is a no-op once state.dead is true (no revive/undo/continue)", () => {
  const state = newRun(1);
  const rng = makeRng(state.rngState);
  die(state, "starve", null, rng, [], () => 0);
  assert.equal(state.dead, true);

  const before = JSON.parse(JSON.stringify(state));
  const events = move(state, "N", rng, []);
  assert.equal(state.dead, true, "state.dead stays true — no field flips it back");
  assert.deepStrictEqual(state, before, "move() leaves a dead state completely unchanged");
  assert.deepStrictEqual(events, [], "move() returns no events for a dead run");
});

test("death is permanent: applyAction(move) on a dead run is a no-op through the full dispatcher", () => {
  let state = newRun(1);
  const rng = makeRng(state.rngState);
  die(state, "starve", null, rng, [], () => 0);
  assert.equal(state.dead, true);

  const { state: next, events } = applyAction(state, { type: "move", dir: "N" });
  assert.equal(next.dead, true, "state.dead remains true through applyAction");
  assert.deepStrictEqual(events, [], "no events are produced for a dead run's move");
});

test("there is no revive/undo/continue action type in the engine's dispatcher", () => {
  let state = newRun(1);
  const rng = makeRng(state.rngState);
  die(state, "starve", null, rng, [], () => 0);

  for (const badType of ["revive", "undo", "continue", "resurrect"]) {
    const { state: next, events } = applyAction(state, { type: badType });
    assert.equal(next.dead, true, `unknown action "${badType}" cannot revive a dead run`);
    assert.deepStrictEqual(events, [], `unknown action "${badType}" is a no-op`);
  }
});
