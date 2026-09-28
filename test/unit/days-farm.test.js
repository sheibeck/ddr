// test/unit/days-farm.test.js
//
// Phase 82 (FARM-01/FARM-02) — small caps only. No full-cap bot run (20,000
// actions / 500 days) ever runs inside `npm test`; every playRun/playFarmRun
// call in this file caps maxActions well under 3,000. The 200-seed measured
// run is plan 82-02's own one-off CLI invocation, never a test.

import test from "node:test";
import assert from "node:assert/strict";

import { playRun, decideAction, makeBotContext, botLine, BOT_DEFAULTS } from "../../tools/lib/tuning-bot.mjs";

// --- Task 1: playRun hooks (opts.policy / opts.stopWhen) -------------------

test("playRun hooks", async (t) => {
  await t.test("BOT_DEFAULTS keeps exactly its 8 keys; no policy or stopWhen key", () => {
    const keys = Object.keys(BOT_DEFAULTS).sort();
    assert.deepEqual(keys, [
      "campThreshold",
      "casterFleeThreshold",
      "exploreBudget",
      "fleeThreshold",
      "maxActions",
      "party",
      "potionThreshold",
      "startDepth",
    ]);
    assert.equal("policy" in BOT_DEFAULTS, false);
    assert.equal("stopWhen" in BOT_DEFAULTS, false);
  });

  await t.test("botLine with policy and stopWhen added equals botLine(BOT_DEFAULTS)", () => {
    const withHooks = { ...BOT_DEFAULTS, startDepth: 1, policy: decideAction, stopWhen: () => false };
    assert.equal(botLine(withHooks), botLine({ ...BOT_DEFAULTS, startDepth: 1 }));
  });

  const project = (result) => ({
    actions: result.actions,
    deathDepth: result.deathDepth,
    dead: result.dead,
    cause: result.cause,
    day: result.state.day,
    steps: result.state.steps,
    rngState: result.state.rngState,
  });

  for (const seed of [1, 7920, 47515]) {
    await t.test(`playRun with policy: decideAction, or stopWhen: () => false, matches the bare call (seed ${seed})`, () => {
      const bare = project(playRun(seed, { maxActions: 400 }));
      const withPolicy = project(playRun(seed, { maxActions: 400, policy: decideAction }));
      const withStopWhen = project(playRun(seed, { maxActions: 400, stopWhen: () => false }));
      assert.deepEqual(withPolicy, bare);
      assert.deepEqual(withStopWhen, bare);
    });
  }

  await t.test("stopWhen: (s, n) => n >= 25 stops the run at exactly 25 actions with stuck false", () => {
    const result = playRun(1, { maxActions: 400, stopWhen: (_s, n) => n >= 25 });
    assert.equal(result.actions, 25);
    assert.equal(result.stuck, false);
    assert.equal(result.outcome, "unknown");
  });

  await t.test("a counting policy that wraps decideAction is called exactly `actions` times", () => {
    let calls = 0;
    const countingPolicy = (state, policyRng, ctx) => {
      calls++;
      return decideAction(state, policyRng, ctx);
    };
    const result = playRun(1, { maxActions: 400, policy: countingPolicy });
    assert.equal(calls, result.actions);
  });
});
