// test/unit/effects.test.js
//
// Phase 36 (BAL foundation, ROADMAP SC-6) — engine/effects.js, the single
// plain-JSON timer/cooldown shape every later v1.5 timer (ability cooldowns
// Phase 38, item use-then-effect-then-cooldown Phase 39, timed map reveal
// Phase 40) shares instead of inventing three bespoke ones.
//
// Written FIRST (TDD RED), before engine/effects.js existed. Section 1
// (unit) proves the seven pure functions in isolation. Section 2 (wiring,
// added by Task 2) proves the three tick sites (engine/movement.js
// per-step, engine/combat.js foeTurn tail + endCombat) and load tolerance
// (engine/saveState.js) — all guarded so no fixture, bot, or old save
// changes a single byte until a LATER phase actually creates a timer
// record (none does in this phase).
//
// No cross-test-file imports (this project's convention for these
// deterministic unit suites, per test/unit/identity-contract.test.js) —
// every rng/state helper this file needs is defined locally.

import test from "node:test";
import assert from "node:assert/strict";

import {
  startEffect,
  startCooldown,
  tickRounds,
  tickSquares,
  remaining,
  isReady,
  clearRoundTimers,
} from "../../engine/effects.js";
import { newRun } from "../../engine/engine.js";

/* ============================================================
 * Section 1 — unit tests for the seven pure functions
 * ============================================================ */

test("startEffect on a c without timers creates c.timers and returns the record (with cd)", () => {
  const c = {};
  const rec = startEffect(c, "ability:whirl", { rounds: 3, cd: 5 });
  assert.deepStrictEqual(c.timers, {
    "ability:whirl": { cadence: "rounds", left: 3, cd: 5, phase: "effect" },
  });
  assert.deepStrictEqual(rec, { cadence: "rounds", left: 3, cd: 5, phase: "effect" });
});

test("startEffect without cd omits the cd key entirely", () => {
  const c = {};
  const rec = startEffect(c, "item:Cloak of Light", { squares: 20 });
  assert.deepStrictEqual(rec, { cadence: "squares", left: 20, phase: "effect" });
  assert.equal("cd" in rec, false);
});

test("startCooldown creates a phase:cooldown record", () => {
  const c = {};
  const rec = startCooldown(c, "ability:whirl", { rounds: 4 });
  assert.deepStrictEqual(rec, { cadence: "rounds", left: 4, phase: "cooldown" });
});

test("tickRounds: effect->cooldown flip, then cooldown->deleted, key stays as {}", () => {
  const c = {};
  startEffect(c, "ability:whirl", { rounds: 3, cd: 5 });

  assert.deepStrictEqual(tickRounds(c), []);
  assert.deepStrictEqual(tickRounds(c), []);
  assert.deepStrictEqual(tickRounds(c), [{ id: "ability:whirl", from: "effect", to: "cooldown" }]);
  assert.deepStrictEqual(c.timers["ability:whirl"], { cadence: "rounds", left: 5, cd: 5, phase: "cooldown" });

  assert.deepStrictEqual(tickRounds(c), []);
  assert.deepStrictEqual(tickRounds(c), []);
  assert.deepStrictEqual(tickRounds(c), []);
  assert.deepStrictEqual(tickRounds(c), []);
  assert.deepStrictEqual(tickRounds(c), [{ id: "ability:whirl", from: "cooldown", to: null }]);
  assert.equal("ability:whirl" in c.timers, false);
  // the timers KEY stays even though the last record is gone
  assert.deepStrictEqual(c.timers, {});
});

test("an effect with no cd expiring is deleted outright", () => {
  const c = {};
  startEffect(c, "spell:reveal", { rounds: 1 });
  assert.deepStrictEqual(tickRounds(c), [{ id: "spell:reveal", from: "effect", to: null }]);
  assert.deepStrictEqual(c.timers, {});
});

test("cross-cadence isolation: tickSquares never touches rounds, tickRounds never touches squares", () => {
  const c = {};
  startEffect(c, "ability:whirl", { rounds: 3 });
  startEffect(c, "item:Cloak of Light", { squares: 3 });

  tickSquares(c, 1);
  assert.equal(c.timers["ability:whirl"].left, 3, "a squares tick must not touch a rounds record");
  assert.equal(c.timers["item:Cloak of Light"].left, 2);

  tickRounds(c);
  assert.equal(c.timers["ability:whirl"].left, 2);
  assert.equal(c.timers["item:Cloak of Light"].left, 2, "a rounds tick must not touch a squares record");
});

test("tickSquares(c, 2) on left:1/cd:10 flips to cooldown with left exactly 10 (no overshoot)", () => {
  const c = {};
  startEffect(c, "item:Cloak of Light", { squares: 1, cd: 10 });
  const transitions = tickSquares(c, 2);
  assert.deepStrictEqual(transitions, [{ id: "item:Cloak of Light", from: "effect", to: "cooldown" }]);
  assert.deepStrictEqual(c.timers["item:Cloak of Light"], {
    cadence: "squares",
    left: 10,
    cd: 10,
    phase: "cooldown",
  });
});

test("tickRounds/tickSquares on a c WITHOUT timers return [] and create no key", () => {
  const c = { some: "field" };
  const before = structuredClone(c);
  assert.deepStrictEqual(tickRounds(c), []);
  assert.deepStrictEqual(tickSquares(c, 1), []);
  assert.deepStrictEqual(c, before);
  assert.equal("timers" in c, false);
});

test("tickSquares no-ops on invalid n (0, negative, non-integer) without mutating existing records", () => {
  const c = {};
  startEffect(c, "item:Cloak of Light", { squares: 5 });
  assert.deepStrictEqual(tickSquares(c, 0), []);
  assert.deepStrictEqual(tickSquares(c, -1), []);
  assert.deepStrictEqual(tickSquares(c, 1.5), []);
  assert.equal(c.timers["item:Cloak of Light"].left, 5, "left must be untouched by an invalid n");
});

test("remaining: the record's left, or 0 with no record / no timers", () => {
  const c = {};
  assert.equal(remaining(c, "ability:whirl"), 0, "no timers map at all");
  startEffect(c, "ability:whirl", { rounds: 3 });
  assert.equal(remaining(c, "ability:whirl"), 3);
  assert.equal(remaining(c, "item:nope"), 0, "no record for this id");
});

test("isReady: true only when no record exists for id (effect AND cooldown both read not-ready)", () => {
  const c = {};
  assert.equal(isReady(c, "ability:whirl"), true, "nothing started yet");
  startEffect(c, "ability:whirl", { rounds: 1, cd: 3 });
  assert.equal(isReady(c, "ability:whirl"), false, "an active effect is not ready");
  tickRounds(c); // flips effect -> cooldown
  assert.equal(c.timers["ability:whirl"].phase, "cooldown");
  assert.equal(isReady(c, "ability:whirl"), false, "a running cooldown is also not ready");
  tickRounds(c);
  tickRounds(c);
  tickRounds(c);
  assert.equal(isReady(c, "ability:whirl"), true, "ready again once the record is gone");
});

test("clearRoundTimers deletes every rounds record (effect or cooldown), leaves squares, returns ids in order", () => {
  const c = {};
  startEffect(c, "ability:whirl", { rounds: 3 });
  startCooldown(c, "ability:stab", { rounds: 2 });
  startEffect(c, "item:Cloak of Light", { squares: 10 });

  const deleted = clearRoundTimers(c);
  assert.deepStrictEqual(deleted, ["ability:whirl", "ability:stab"]);
  assert.equal("ability:whirl" in c.timers, false);
  assert.equal("ability:stab" in c.timers, false);
  assert.ok(c.timers["item:Cloak of Light"], "the squares record must survive");
  assert.deepStrictEqual(c.timers["item:Cloak of Light"], { cadence: "squares", left: 10, phase: "effect" });
});

test("clearRoundTimers on a c without timers returns [] and creates no key", () => {
  const c = {};
  assert.deepStrictEqual(clearRoundTimers(c), []);
  assert.equal("timers" in c, false);
});

test("invalid starts are silent no-ops returning null and never throw", () => {
  assert.equal(startEffect(null, "x", { rounds: 1 }), null, "non-object c");
  assert.equal(startEffect([], "x", { rounds: 1 }), null, "array c");
  assert.equal(startEffect({}, "", { rounds: 1 }), null, "empty id");
  assert.equal(startEffect({}, 42, { rounds: 1 }), null, "non-string id");
  assert.equal(startEffect({}, "x", {}), null, "neither rounds nor squares");
  assert.equal(startEffect({}, "x", { rounds: 1, squares: 1 }), null, "both given");
  assert.equal(startEffect({}, "x", { rounds: 0 }), null, "non-positive duration");
  assert.equal(startEffect({}, "x", { rounds: -1 }), null, "negative duration");
  assert.equal(startEffect({}, "x", { rounds: 1.5 }), null, "non-integer duration");
  assert.equal(startEffect({}, "x", { rounds: 1, cd: 0 }), null, "non-positive cd");
  assert.equal(startEffect({}, "x", { rounds: 1, cd: -1 }), null, "negative cd");
  assert.equal(startEffect({}, "x", { rounds: 1, cd: 1.5 }), null, "non-integer cd");
  assert.equal(startCooldown(null, "x", { rounds: 1 }), null, "non-object c (cooldown)");
  assert.equal(startCooldown({}, "", { rounds: 1 }), null, "empty id (cooldown)");
  assert.equal(startCooldown({}, "x", { rounds: 1, squares: 1 }), null, "both given (cooldown)");
});

test("determinism: identical operation sequences on two fresh objects yield JSON-identical timers", () => {
  const run = (c) => {
    startEffect(c, "ability:whirl", { rounds: 3, cd: 5 });
    startEffect(c, "item:Cloak of Light", { squares: 20 });
    tickRounds(c);
    tickSquares(c, 5);
    tickRounds(c);
    tickRounds(c);
    return c;
  };
  const a = run({});
  const b = run({});
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test("a mid-cooldown record survives a JSON round-trip and continues ticking identically", () => {
  const c = {};
  startEffect(c, "ability:whirl", { rounds: 1, cd: 5 });
  tickRounds(c); // now mid-cooldown, left 5
  const clone = JSON.parse(JSON.stringify(c));

  const tOrig = tickRounds(c);
  const tClone = tickRounds(clone);
  assert.deepStrictEqual(tOrig, tClone);
  assert.deepStrictEqual(c, clone);
});

test("newRun(1).c has no timers key", () => {
  const s = newRun(1);
  assert.equal(Object.prototype.hasOwnProperty.call(s.c, "timers"), false);
});
