// test/parity/pending-fight-audit.test.js
//
// CMB-01 (Phase 31): the standing A3 walk (RESEARCH A3; orchestrator
// resolution 3). Engine-only replay (no prototype sandbox needed — this test
// proves an ENGINE-INTERNAL invariant, not a parity comparison) over every
// fixture/scenario this suite drives, asserting three things at every
// action index `i`:
//
//   (a) after `applyStartCombat` the state NEVER has `combat.pending` — the
//       chain proof that `fight` really is chained on the same rng inside
//       the harness's `applyStartCombat` (test/parity/harness/comparables.js),
//       so every scripted `startCombat` fixture action advances exactly as
//       far as the prototype's single call did.
//   (b) whenever `state.combat?.pending` is truthy after action `i`, there
//       is NO scripted action `i+1` — a pending encounter only ever survives
//       to the END of a scenario/script, where the compare-only
//       `reconcilePendingFight` (wired into every comparable) is sufficient;
//       no fixture ever chains a non-`fight` action onto a pending combat.
//   (c) the movement fixture's 101 actions never produce a non-null
//       `state.combat` (seed 256's step-100 `newDay` wandering-monster check
//       draws no monster — a zero-draw structural fact, not luck), and the
//       three `encounterDot`-driven encounters scenarios (tablefour/faerie/
//       affliction) never produce a combat either.
//
// Print nothing on success (this file only ever fails loudly, naming the
// fixture/scenario/index); every scenario across combat/magic/movement/
// economy/encounters is walked, in fixture order.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { newRun, applyAction } from "../../engine/engine.js";
import { makeRng } from "../../engine/rng.js";
import { springTrap, openChest, encounterDot } from "../../engine/encounters.js";
import { openStore } from "../../engine/economy.js";
import { applyStartCombat } from "./harness/comparables.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, "fixtures");
const readFixture = (name) => JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, name), "utf8"));

/** applyInternal(state, fn) — the shared clone/rng-rehydrate/persist shape
 * every internal (non-validated) function a fixture drives directly needs.
 * Mirrors comparables.js's own (unexported) applyInternal exactly — kept as
 * a local copy here rather than exporting the harness's private helper, so
 * this file's dependency surface stays "engine functions + applyStartCombat"
 * only, matching the plan's read_first note. */
function applyInternal(state, fn) {
  const next = structuredClone(state);
  const rng = makeRng(next.rngState);
  const events = [];
  fn(next, rng, events);
  next.rngState = rng.getState();
  return { state: next, events };
}

const INTERNAL_FNS = { openStore, springTrap, openChest, encounterDot };

/**
 * walkScenario(fixture, scenario, seed, actions, opts) — replays one
 * scenario/script's actions against a fresh `newRun(seed)`, asserting (a)
 * and (b) at every index. `opts.bumpGold` mirrors full-suite.test.js's
 * economy setup (gold=5000 before the script, on the engine side only —
 * this file never touches the prototype sandbox).
 */
function walkScenario(fixture, scenario, seed, actions, { bumpGold = false } = {}) {
  let state = newRun(seed);
  if (bumpGold) state.c.gold = 5000;

  actions.forEach((action, i) => {
    if (action.type === "startCombat") {
      const { state: next } = applyStartCombat(state, action.wandering, action.forced);
      state = next;
      // (a) the chain proof: applyStartCombat real-dispatches `fight` on the
      // same rng, so the state it returns NEVER has a pending combat.
      assert.ok(
        !state.combat || !state.combat.pending,
        `${fixture} / ${scenario}, action ${i} (startCombat): applyStartCombat left combat.pending truthy — fight was not chained`,
      );
    } else if (action.type in INTERNAL_FNS) {
      const { state: next } = applyInternal(state, INTERNAL_FNS[action.type]);
      state = next;
    } else {
      const { state: next } = applyAction(state, action);
      state = next;
    }

    // (b) a pending encounter must never survive into a scripted next
    // action — only to the end of the scenario/script.
    if (state.combat && state.combat.pending) {
      assert.ok(
        i === actions.length - 1,
        `${fixture} / ${scenario}, action ${i} (${action.type}): combat.pending survived into a scripted next action (${actions[i + 1]?.type}) — no fixture may chain a non-fight action onto a pending combat`,
      );
    }
  });

  return state;
}

test("CMB-01 (A3): combat fixture — no scenario chains a non-fight action onto a pending combat", () => {
  const fixture = readFixture("action-script.combat.json");
  for (const scenario of fixture.scenarios) {
    walkScenario("action-script.combat.json", scenario.name, scenario.seed, scenario.actions);
  }
});

test("CMB-01 (A3): magic fixture — no scenario chains a non-fight action onto a pending combat", () => {
  const fixture = readFixture("action-script.magic.json");
  for (const scenario of fixture.scenarios) {
    walkScenario("action-script.magic.json", scenario.name, scenario.seed, scenario.actions);
  }
});

test("CMB-01 (A3): movement fixture — 101 actions never produce a non-null state.combat", () => {
  const fixture = readFixture("action-script.movement.json");
  let state = newRun(fixture.seed);
  fixture.actions.forEach((action, i) => {
    const { state: next } = applyAction(state, action);
    state = next;
    // (c) seed 256's step-100 newDay wandering-monster check draws no
    // monster — this is a zero-draw structural fact for this seed, proven
    // by actually replaying, not by trusting the fixture's own comment.
    assert.equal(
      state.combat,
      null,
      `action-script.movement.json / (script), action ${i} (${action.type}): produced a non-null state.combat — seed 256 was chosen specifically to avoid this`,
    );
  });
});

test("CMB-01 (A3): economy fixture — no scenario chains a non-fight action onto a pending combat", () => {
  const fixture = readFixture("action-script.economy.json");
  const state = walkScenario("action-script.economy.json", "(script)", fixture.seed, fixture.actions, { bumpGold: true });
  // The economy domain never references BESTIARY (openStore/buyItem/
  // leaveStore never start a fight) — defensive confirmation alongside the
  // per-action pending check walkScenario already ran.
  assert.equal(state.combat, null, "action-script.economy.json / (script): the economy script must never start a combat");
});

test("CMB-01 (A3): encounters fixture — the three encounterDot scenarios never produce a combat", () => {
  const fixture = readFixture("action-script.encounters.json");
  for (const scenario of fixture.scenarios) {
    const state = walkScenario("action-script.encounters.json", scenario.name, scenario.seed, scenario.actions);
    if (scenario.actions.some((a) => a.type === "encounterDot")) {
      // (c) the three encounterDot-driven scenarios (tablefour/faerie/
      // affliction) never produce a combat for their pinned seeds.
      assert.equal(
        state.combat,
        null,
        `action-script.encounters.json / ${scenario.name}: an encounterDot scenario produced a non-null state.combat`,
      );
    }
  }
});
