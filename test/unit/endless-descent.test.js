// test/unit/endless-descent.test.js
//
// RUN-02 / RUN-04: proves descent is genuinely endless — no floor cap, no
// Gate ending — and that permadeath (die, engine/death.js) is the ONLY run
// terminator. Complements test/unit/movement.test.js's single-step exit/gate
// dispatch tests and test/unit/maze.test.js's genFloor-level "never gate"
// coverage by driving descend() itself in a loop from a real newRun(seed)
// state, well past the old fixed 5-floor Gate cap.

import test from "node:test";
import assert from "node:assert/strict";
import { newRun } from "../../engine/state.js";
import { descend } from "../../engine/movement.js";
import { die } from "../../engine/death.js";
import { makeRng } from "../../engine/rng.js";

const TARGET_DEPTH = 60;

test("descend: driven in a loop from newRun, depth increases by exactly 1 each call with no cap and never wins", () => {
  const state = newRun(2026);
  const rng = makeRng(2026); // descend()'s own rng draws are independent of newRun's internal rng
  let depth = state.floor.depth;
  assert.equal(depth, 1);

  for (let i = 0; i < TARGET_DEPTH - 1; i++) {
    const events = descend(state, rng, []);
    depth++;
    assert.equal(state.floor.depth, depth, `after descend #${i + 1}, depth should be ${depth}`);
    assert.equal(state.won, false, `state.won must stay false at depth ${depth}`);
    assert.equal(state.dead, false, `state.dead must stay false at depth ${depth} (no lethal event injected here)`);
    assert.ok(events.some((e) => e.type === "floorChanged" && e.depth === depth));

    // the newly-generated floor must never contain a "gate" feature.
    let hasGate = false;
    for (const row of state.floor.g) for (const cell of row) if (cell.feat === "gate") hasGate = true;
    assert.equal(hasGate, false, `depth ${depth}'s generated floor must never contain a 'gate' feature`);
  }

  assert.equal(state.floor.depth, TARGET_DEPTH, "the descent loop must reach the target depth without self-terminating");
});

test("die: permadeath, not a Gate, is the run's actual terminator", () => {
  const state = newRun(2026);
  const rng = makeRng(2026);
  // descend a few floors mid-run, same as a real play session would.
  descend(state, rng, []);
  descend(state, rng, []);
  assert.equal(state.dead, false);
  assert.equal(state.won, false);

  const events = [];
  die(state, "combat", "a nameless horror", rng, events, () => 12345);
  assert.equal(state.dead, true, "die() is the terminator");
  assert.equal(state.won, false, "dying is not winning");
  assert.ok(events.some((e) => e.type === "died" && e.cause === "combat"));
});
