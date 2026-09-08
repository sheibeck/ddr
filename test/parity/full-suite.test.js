// ENG-05 phase gate: the aggregate parity + round-trip pass across the
// ENTIRE ruleset extracted in this phase — chargen, movement, combat, magic,
// economy, encounters, and (new in 01-10) the win path itself. Every
// per-domain parity test (chargen-parity/movement-parity/combat-parity/
// magic-parity/economy-parity) already proves its own slice in isolation;
// this file's job is the single aggregate assertion the phase's success
// criteria point to — "the entire prototype ruleset runs behind the pure,
// deterministic, serializable applyAction contract with zero regressions" —
// plus closing the win-path gap the 01-07 plan-checker flagged and 01-09
// deferred here: a full run that reaches the floor-5 Gate and wins,
// diffState-compared against the frozen prototype the whole way, including
// the `winGame` event/state itself.
//
// Reuses test/parity/harness/comparables.js's shared comparable()/
// internal-action-dispatch helpers (the same single source of truth every
// per-domain parity test file uses) rather than importing those test files
// as modules — importing a `*.test.js` file would re-execute its own
// top-level `test(...)` registrations a second time under node:test.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { newRun, applyAction } from "../../engine/engine.js";
import { makeRng } from "../../engine/rng.js";
import { descend } from "../../engine/movement.js";
import { loadPrototypeSandbox } from "./harness/sandboxPrototype.js";
import { diffState } from "./harness/diffState.js";
import {
  movementComparable,
  combatComparable,
  applyStartCombat,
  economyComparable,
  runEconomyAction,
} from "./harness/comparables.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, "fixtures");
const readFixture = (name) => JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, name), "utf8"));

const CHARGEN_FIXTURE = readFixture("action-script.chargen.json");
const MOVEMENT_FIXTURE = readFixture("action-script.movement.json");
const COMBAT_FIXTURE = readFixture("action-script.combat.json");
const MAGIC_FIXTURE = readFixture("action-script.magic.json");
const ECONOMY_FIXTURE = readFixture("action-script.economy.json");
const ENCOUNTERS_FIXTURE = readFixture("action-script.encounters.json");
const WIN_FIXTURE = readFixture("action-script.win.json");

const CHARACTER_FIELDS = [
  "cls", "sub", "race", "intel", "level", "sp", "maxWP", "wp", "skills", "vp",
  "weapon", "prof", "magicWpn", "armor", "ar", "armorMin", "armorWP", "armorMax",
  "patches", "temperament", "motive", "phobia", "phobiaType", "potions", "rations",
  "gold", "scrolls", "haste", "invis", "ether", "acute", "affliction", "joiner",
  "items", "grimoire", "spellsUsed", "kills", "might", "ward", "regen", "mirror",
  "foresight", "name",
];

/** applyDescend(state) — the internal (non-validated) descend() call, same
 * clone/rng-rehydrate/persist shape every other internal fixture action in
 * this directory uses. */
function applyDescend(state) {
  const next = structuredClone(state);
  const rng = makeRng(next.rngState);
  const events = [];
  descend(next, rng, events);
  next.rngState = rng.getState();
  return { state: next, events };
}

test("ENG-05 phase gate: full-suite parity across chargen/movement/combat/magic/economy/encounters/win", async (t) => {
  const start = Date.now();

  await t.test("chargen: every fixture seed matches the frozen prototype", () => {
    for (const seed of CHARGEN_FIXTURE.seeds) {
      const ctx = loadPrototypeSandbox({ seed });
      const engineC = newRun(seed).c;
      assert.deepStrictEqual(Object.keys(engineC).sort(), CHARACTER_FIELDS.slice().sort());
      assert.equal(diffState(ctx.S.c, engineC), null, `chargen seed ${seed} diverged`);
    }
  });

  await t.test("movement: the movement fixture matches the frozen prototype", () => {
    const ctx = loadPrototypeSandbox({ seed: MOVEMENT_FIXTURE.seed });
    let engineState = newRun(MOVEMENT_FIXTURE.seed);
    assert.equal(diffState(movementComparable(ctx.S), movementComparable(engineState)), null);
    MOVEMENT_FIXTURE.actions.forEach((action, i) => {
      ctx.move(action.dir);
      const { state } = applyAction(engineState, action);
      engineState = state;
      const d = diffState(movementComparable(ctx.S), movementComparable(engineState));
      assert.equal(d, null, `movement action ${i}: diverged at ${d}`);
    });
  });

  await t.test("combat: every combat scenario matches the frozen prototype", () => {
    for (const scenario of COMBAT_FIXTURE.scenarios) {
      const ctx = loadPrototypeSandbox({ seed: scenario.seed });
      let engineState = newRun(scenario.seed);
      assert.equal(diffState(combatComparable(ctx.S), combatComparable(engineState)), null);
      scenario.actions.forEach((action, i) => {
        if (action.type === "startCombat") {
          ctx.startCombat(action.wandering, action.forced);
          const { state } = applyStartCombat(engineState, action.wandering, action.forced);
          engineState = state;
        } else {
          ctx[action.type === "attack" ? "playerStrike" : action.type]();
          const { state } = applyAction(engineState, { type: action.type });
          engineState = state;
        }
        const d = diffState(combatComparable(ctx.S), combatComparable(engineState));
        assert.equal(d, null, `combat scenario ${scenario.name}, action ${i}: diverged at ${d}`);
      });
    }
  });

  await t.test("magic: every magic scenario matches the frozen prototype", () => {
    for (const scenario of MAGIC_FIXTURE.scenarios) {
      const ctx = loadPrototypeSandbox({ seed: scenario.seed });
      let engineState = newRun(scenario.seed);
      assert.equal(diffState(combatComparable(ctx.S), combatComparable(engineState)), null);
      scenario.actions.forEach((action, i) => {
        if (action.type === "startCombat") {
          ctx.startCombat(action.wandering, action.forced);
          const { state } = applyStartCombat(engineState, action.wandering, action.forced);
          engineState = state;
        } else if (action.type === "castSpell") {
          ctx.castSpell(action.idx);
          const { state } = applyAction(engineState, { type: "castSpell", idx: action.idx });
          engineState = state;
        } else {
          ctx[action.type]();
          const { state } = applyAction(engineState, { type: action.type });
          engineState = state;
        }
        const d = diffState(combatComparable(ctx.S), combatComparable(engineState));
        assert.equal(d, null, `magic scenario ${scenario.name}, action ${i}: diverged at ${d}`);
      });
    }
  });

  await t.test("economy + encounters: the store visit and every encounters scenario match the frozen prototype", () => {
    {
      const ctx = loadPrototypeSandbox({ seed: ECONOMY_FIXTURE.seed });
      let engineState = newRun(ECONOMY_FIXTURE.seed);
      assert.equal(diffState(economyComparable(ctx.S), economyComparable(engineState)), null);
      ctx.S.c.gold = 5000;
      engineState.c.gold = 5000;
      ECONOMY_FIXTURE.actions.forEach((action, i) => {
        const { state } = runEconomyAction(ctx, engineState, action);
        engineState = state;
        const d = diffState(economyComparable(ctx.S), economyComparable(engineState));
        assert.equal(d, null, `economy action ${i}: diverged at ${d}`);
      });
    }
    for (const scenario of ENCOUNTERS_FIXTURE.scenarios) {
      const ctx = loadPrototypeSandbox({ seed: scenario.seed });
      let engineState = newRun(scenario.seed);
      assert.equal(diffState(economyComparable(ctx.S), economyComparable(engineState)), null);
      scenario.actions.forEach((action, i) => {
        const { state } = runEconomyAction(ctx, engineState, action);
        engineState = state;
        const d = diffState(economyComparable(ctx.S), economyComparable(engineState));
        assert.equal(d, null, `encounters scenario ${scenario.name}, action ${i}: diverged at ${d}`);
      });
    }
  });

  await t.test("win: a full run to the floor-5 Gate matches the frozen prototype, including winGame", () => {
    const ctx = loadPrototypeSandbox({ seed: WIN_FIXTURE.seed });
    let engineState = newRun(WIN_FIXTURE.seed);
    assert.equal(diffState(movementComparable(ctx.S), movementComparable(engineState)), null);

    const allEventTypes = [];
    WIN_FIXTURE.actions.forEach((action, i) => {
      if (action.type === "descend") {
        ctx.descend();
        const { state, events } = applyDescend(engineState);
        engineState = state;
        allEventTypes.push(...events.map((e) => e.type));
      } else if (action.type === "move") {
        ctx.move(action.dir);
        const { state, events } = applyAction(engineState, action);
        engineState = state;
        allEventTypes.push(...events.map((e) => e.type));
      } else {
        assert.fail(`unhandled win fixture action type: ${action.type}`);
      }
      const d = diffState(movementComparable(ctx.S), movementComparable(engineState));
      assert.equal(d, null, `win-path action ${i} (${JSON.stringify(action)}): diverged at ${d}`);
    });

    assert.ok(allEventTypes.includes("won"), "the engine's event stream must record the win");
    assert.equal(engineState.won, true);
    assert.equal(engineState.floor.depth, 5);
    assert.equal(ctx.S.won, true, "the prototype side won too");
    // winGame() itself, byte-for-byte: won/dead/deathNote/epitaph (deathAt is
    // volatile and already stripped by diffState/comparable on both sides).
    assert.equal(engineState.deathNote, ctx.S.deathNote);
    assert.equal(engineState.epitaph, ctx.S.epitaph);
  });

  const elapsedMs = Date.now() - start;
  assert.ok(elapsedMs < 15000, `full-suite gate should stay within the ~15s budget target (took ${elapsedMs}ms)`);
});
