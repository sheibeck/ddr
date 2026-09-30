// test/unit/item-source-comparables.test.js
//
// Phase 88 plan 02 (ITEM-02): the effect-source link `src { slot, n }` is a new
// serialized field. It lives inside `c.timers`, which test/parity/harness/
// comparables.js#stripTimersField removes in ALL THREE comparable chains, so it
// never reaches a parity compare against the frozen prototype. Engine gate:
// "new serialized fields are carved out of all three *Comparable() functions".
// One test per comparable.

import test from "node:test";
import assert from "node:assert/strict";

import { newRun } from "../../engine/engine.js";
import { movementComparable, combatComparable, economyComparable } from "../parity/harness/comparables.js";
import { setIdentityDials } from "./harness/identityDials.js";

setIdentityDials();

function linkedState() {
  const state = newRun(3);
  state.c.timers = {
    "item:Cloak of Flying": {
      cadence: "squares",
      left: 10,
      cd: 50,
      phase: "effect",
      src: { slot: "cloak", n: "Cloak of Flying" },
    },
  };
  return state;
}

function withoutTimers(state) {
  const copy = JSON.parse(JSON.stringify(state));
  delete copy.c.timers;
  return copy;
}

for (const [name, comparable] of [
  ["movementComparable", movementComparable],
  ["combatComparable", combatComparable],
  ["economyComparable", economyComparable],
]) {
  test(`${name}: c.timers (and the src inside it) never reaches the compare`, () => {
    const state = linkedState();
    const out = comparable(state);
    assert.equal("timers" in out.c, false, "c.timers is stripped");
    assert.equal(JSON.stringify(out).includes('"src"'), false, "no src anywhere in the comparable");
    assert.deepEqual(out, comparable(withoutTimers(state)), "the same state without timers compares identically");
  });
}
