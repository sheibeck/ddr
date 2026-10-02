// test/unit/bot-balance-close.test.js
//
// Phase 92 plan 01 (TUNE-10, ECON-11): probes for the bot-only fixes the
// milestone-end balance close leans on. Every test here is a hand-built state
// or a short bounded bot run; no balance readout runs in this file.
//   - "camp gate:"  the fair bot camps on the whole party's nightly need
//                   (nightlyEats), the number makeCamp refuses on (89-06).
//   - "cloak:"      a Cloak of Regeneration is a heal over time, not a free
//                   instant heal (88-04).
//   - "tally:"      a Joiner's itemUsed is counted apart from the hero's (89-07).
//   - "cutpurse:"   the 91.1 Cutpurse is the never-worse-than-STRIKE fallback.

import test from "node:test";
import assert from "node:assert/strict";

import { newRun } from "../../engine/engine.js";
import { eatsFor, nightlyEats } from "../../engine/movement.js";
import { decideAction, makeBotContext, forceParty, playRun, BOT_DEFAULTS, RUN_FLAGS } from "../../tools/lib/tuning-bot.mjs";
import { setIdentityDials } from "./harness/identityDials.js";

// The real-run probes are measured against the identity dials, like the other
// bot-driven suites (tuning-bot.test.js, bot-tactics.test.js).
setIdentityDials();

const FIRST = { pick: (arr) => arr[0] };

// A fresh solo state, hurt below campThreshold with no potions: the setup the
// camp gate decides on.
function hurtSolo(seed = 1) {
  const state = newRun(seed, [], { ...RUN_FLAGS });
  state.c.wp = Math.max(1, Math.floor(state.c.maxWP * BOT_DEFAULTS.campThreshold) - 1);
  state.c.potions = 0;
  return state;
}

test("camp gate: a solo hero below campThreshold with rations equal to its own appetite camps", () => {
  const state = hurtSolo(1);
  state.c.rations = nightlyEats(state);
  assert.equal(nightlyEats(state), eatsFor(state.c), "a solo hero's need is its own appetite");
  assert.deepStrictEqual(decideAction(state, FIRST, makeBotContext()), { type: "camp" });
});

test("camp gate: with a Joiner, rations at the hero's appetite alone do not camp; at nightlyEats they do", () => {
  const state = hurtSolo(1);
  forceParty(state);
  assert.ok(state.party.length >= 1, "forceParty must recruit at least one member");
  state.c.wp = Math.max(1, Math.floor(state.c.maxWP * BOT_DEFAULTS.campThreshold) - 1);
  state.c.potions = 0;
  assert.ok(nightlyEats(state) > eatsFor(state.c), "a Joiner adds to the nightly need");

  state.c.rations = eatsFor(state.c);
  const short = decideAction(state, FIRST, makeBotContext());
  assert.notEqual(short.type, "camp", "rations short of the party's need must not camp (makeCamp would refuse)");

  state.c.rations = nightlyEats(state);
  assert.deepStrictEqual(decideAction(state, FIRST, makeBotContext()), { type: "camp" });
});

test("camp gate: a seed that used to loop campFailed ends dead within its budget with no campFailed and not stuck", () => {
  // Measured live at identity dials, maxActions 1500 (never hand-typed): seed 4
  // stalled at depth 5 on the plan base with 1032 campFailed events (a Joiner's
  // appetite the hero-only gate did not count); with the gate on nightlyEats it
  // dies at action 528, depth 6, with none.
  let campFailed = 0;
  const r = playRun(4, { ...BOT_DEFAULTS, maxActions: 1500 }, (events) => {
    for (const e of events) if (e.type === "campFailed") campFailed++;
  });
  assert.equal(campFailed, 0, "no campFailed event");
  assert.equal(r.stuck, false, "not stuck");
  assert.equal(r.dead, true, "ends dead inside its budget");
});
