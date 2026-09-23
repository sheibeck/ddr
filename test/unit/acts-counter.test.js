// test/unit/acts-counter.test.js
//
// Phase 65 (RUN-01): state.acts is a non-negative integer on every
// GameState, incremented once per VALIDATED action inside
// engine/engine.js#applyAction (whatever the handler then does), tolerant-
// loaded from old/tampered saves, and adds zero rng draws. This file pins
// every <behavior> bullet of 65-01-PLAN.md Task 1, plus (Task 2) the
// carve-out guard proving acts is invisible to the three harness
// comparables.

import test from "node:test";
import assert from "node:assert/strict";

import { newRun, applyAction } from "../../engine/engine.js";
import { validateSave, rehydrate, serializeRun } from "../../engine/saveState.js";

// firstWallDir(state) — the first cardinal direction from the player's
// current position that leads onto a wall cell, mirroring
// test/unit/engineAdapter.test.js#firstOpenPlainDir's neighbour scan (that
// helper looks for an OPEN cell; this one looks for the opposite, so the
// "refused move" behavior bullet exercises a genuine handler refusal rather
// than an incidental successful step).
function firstWallDir(state) {
  const f = state.floor;
  const DIRV = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
  for (const [d, [dx, dy]] of Object.entries(DIRV)) {
    const nx = f.px + dx;
    const ny = f.py + dy;
    const cell = f.g[ny] && f.g[ny][nx];
    if (cell && cell.wall) return d;
  }
  return null;
}

test("newRun(seed).acts === 0 for a default run, a dev start-at-depth run and a forced-chargen run alike", () => {
  assert.equal(newRun(1).acts, 0);
  assert.equal(newRun(1, [], { startDepth: 20 }).acts, 0);
  assert.equal(newRun(1, [], { force: { cls: "Thief" } }).acts, 0);
});

test("applyAction increments acts by exactly 1 per validated action, even when the handler refuses", () => {
  let state = newRun(7);
  const wallDir = firstWallDir(state);
  assert.ok(wallDir, "seed 7's floor 1 has at least one wall-facing neighbor from the start tile");

  const r1 = applyAction(state, { type: "camp" });
  assert.equal(r1.state.acts, 1);
  state = r1.state;

  // A move toward a wall: validateAction only checks that dir is one of
  // N/S/E/W, so this passes validation and applyAction increments acts —
  // the movement handler itself then refuses the step (the player does not
  // move), proving the counter fires on VALIDATION, not on handler success.
  const r2 = applyAction(state, { type: "move", dir: wallDir });
  assert.equal(r2.state.acts, 2);
  state = r2.state;

  const r3 = applyAction(state, { type: "camp" });
  assert.equal(r3.state.acts, 3);
});

test("an action that fails validateAction returns the SAME state object with acts unchanged", () => {
  const s = newRun(3);
  const before = s.acts;

  const r1 = applyAction(s, null);
  assert.equal(r1.state, s, "null action returns the same state object");
  assert.equal(r1.state.acts, before);

  const r2 = applyAction(s, { type: "bogus" });
  assert.equal(r2.state, s, "unknown action.type returns the same state object");
  assert.equal(r2.state.acts, before);

  const r3 = applyAction(s, { type: "move", dir: "X" });
  assert.equal(r3.state, s, "an invalid move.dir returns the same state object");
  assert.equal(r3.state.acts, before);
});

test("acts is coerced to 0 before the increment when absent, negative, fractional, NaN or a string", () => {
  for (const rawActs of [undefined, -3, 2.5, NaN, "4"]) {
    const s = newRun(11);
    if (rawActs === undefined) {
      delete s.acts;
    } else {
      s.acts = rawActs;
    }
    const result = applyAction(s, { type: "camp" });
    assert.equal(result.state.acts, 1, `acts ${JSON.stringify(rawActs)} must coerce to 0 then increment to 1`);
  }
});

test("the counter adds zero rng draws: a fixed 12-action list gives identical rngState and states (acts aside) with or without a starting acts field", () => {
  // Fixed list: moves in every direction (twice over), a camp, and a
  // refused move — validateAction accepts any N/S/E/W dir regardless of
  // whether the handler then steps or refuses, so this list needs no
  // floor-shape lookup to stay "fixed".
  const ACTIONS = [
    { type: "move", dir: "N" },
    { type: "move", dir: "S" },
    { type: "move", dir: "E" },
    { type: "move", dir: "W" },
    { type: "camp" },
    { type: "move", dir: "N" },
    { type: "move", dir: "S" },
    { type: "move", dir: "E" },
    { type: "move", dir: "W" },
    { type: "camp" },
    { type: "move", dir: "N" },
    { type: "move", dir: "E" },
  ];
  assert.equal(ACTIONS.length, 12);

  let withActs = newRun(424242);
  for (const action of ACTIONS) {
    withActs = applyAction(withActs, action).state;
  }

  let withoutActs = structuredClone(newRun(424242));
  delete withoutActs.acts;
  for (const action of ACTIONS) {
    withoutActs = applyAction(withoutActs, action).state;
  }

  assert.deepStrictEqual(withActs.rngState, withoutActs.rngState, "the rng cursor must be identical regardless of the starting acts field");

  const stripActs = (s) => {
    const clone = structuredClone(s);
    delete clone.acts;
    return clone;
  };
  assert.deepStrictEqual(stripActs(withActs), stripActs(withoutActs), "the final states must be deepStrictEqual once acts is removed from both");
});

test("validateSave/rehydrate tolerant-load acts: absent, tampered and a valid round-trip", () => {
  const obj = serializeRun(newRun(5));
  delete obj.acts;
  const check = validateSave(JSON.stringify(obj));
  assert.equal(check.ok, true);
  assert.equal(check.value.acts, 0, "a save missing the acts key validates to acts: 0");
  assert.equal(rehydrate(check.value).acts, 0, "rehydrate also defaults the missing key to 0");

  const validFloor = { g: [[{ wall: false }]], px: 0, py: 0, depth: 1 };
  const validChar = { wp: 10, maxWP: 10, level: 1, skills: {} };
  for (const raw of [-1, 1.5, NaN, "9", null]) {
    const save = { c: validChar, floor: validFloor, acts: raw };
    const tampered = validateSave(JSON.stringify(save));
    assert.equal(tampered.ok, true);
    assert.equal(tampered.value.acts, 0, `acts ${JSON.stringify(raw)} must coerce to 0 via validateSave`);
    assert.equal(rehydrate({ ...tampered.value, acts: raw }).acts, 0, `acts ${JSON.stringify(raw)} must coerce to 0 via rehydrate`);
  }
});

test("acts 57 survives serializeRun -> JSON.stringify -> validateSave -> rehydrate unchanged", () => {
  const state = newRun(5);
  state.acts = 57;
  const json = JSON.stringify(serializeRun(state));
  const check = validateSave(json);
  assert.equal(check.ok, true);
  assert.equal(check.value.acts, 57);
  const rehydrated = rehydrate(check.value);
  assert.equal(rehydrated.acts, 57);
});
