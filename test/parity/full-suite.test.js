// ENG-05 phase gate: the aggregate parity + round-trip pass across the
// ENTIRE ruleset extracted in this phase — chargen, movement, combat, magic,
// economy, and encounters. Every per-domain parity test (chargen-parity/
// movement-parity/combat-parity/magic-parity/economy-parity) already proves
// its own slice in isolation; this file's job is the single aggregate
// assertion the phase's success criteria point to — "the entire prototype
// ruleset runs behind the pure, deterministic, serializable applyAction
// contract with zero regressions."
//
// The win path (a full run to the floor-5 Gate, diffState-compared against
// the frozen prototype including the `winGame` event/state itself) was
// closed here in 01-10 and DELIBERATELY RETIRED in 03-02 (endless descent,
// RUN-02/RUN-04): the frozen prototype still wins at the floor-5 Gate, but
// the endless engine now descends past it (genFloor never emits "gate"
// anymore), so a byte-for-byte win-parity comparison against the frozen
// prototype no longer applies — this is the phase's one intentional,
// documented divergence from the prototype. Endless-descent behavior is
// proven instead by test/unit/endless-descent.test.js.
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
import { loadPrototypeSandbox } from "./harness/sandboxPrototype.js";
import { diffState } from "./harness/diffState.js";
import {
  movementComparable,
  combatComparable,
  applyStartCombat,
  economyComparable,
  runEconomyAction,
  stripParleyDivergence,
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
// action-script.win.json was DELIBERATELY RETIRED in 03-02 — see header comment.

const CHARACTER_FIELDS = [
  "cls", "sub", "race", "intel", "level", "sp", "maxWP", "wp", "skills", "vp",
  "weapon", "prof", "magicWpn", "armor", "ar", "armorMin", "armorWP", "armorMax",
  "patches", "temperament", "motive", "phobia", "phobiaType", "potions", "rations",
  "gold", "scrolls", "haste", "invis", "ether", "acute", "affliction", "joiner",
  "items", "grimoire", "spellsUsed", "kills", "might", "ward", "regen", "mirror",
  "foresight",
  // DR-name-generator (2026-09-09): "name" is carved out of the parity field
  // list — nameFor now builds a GENERATIVE first × surname name (a cosmetic
  // divergence from the frozen prototype) while making the SAME single rng
  // draw, so every OTHER chargen field stays byte-identical. The engine still
  // builds c.name, so it is appended to the shape assertion and stripped from
  // both sides before diffState below. See chargen-parity.test.js for the full
  // rationale.
  // PHOBIA-01 (04.1-05): engine-only persistent darkness counter, no
  // prototype-side equivalent — see chargen-parity.test.js's identical
  // comment for the full rationale; stripped again below before diffState.
  "darkFor",
  // audit-batch1 (2026-09-09, A2): engine-only Cloak-of-Flying charge/
  // cooldown fields, no prototype-side equivalent — same treatment as
  // darkFor immediately above; stripped again below before diffState.
  "flightLeft",
  "flightCooldown",
  // ECON-01 (Phase 12): engine-only class-derived carry bag key, no
  // prototype-side equivalent — plain assignment (no rng), stripped again
  // below before diffState. See chargen-parity.test.js for the full rationale.
  "bag",
];

test("ENG-05 phase gate: full-suite parity across chargen/movement/combat/magic/economy/encounters", async (t) => {
  const start = Date.now();

  await t.test("chargen: every fixture seed matches the frozen prototype", () => {
    for (const seed of CHARGEN_FIXTURE.seeds) {
      const ctx = loadPrototypeSandbox({ seed });
      const engineC = newRun(seed).c;
      // "name" is carved out of the field list but still built by the engine.
      assert.deepStrictEqual(Object.keys(engineC).sort(), [...CHARACTER_FIELDS, "name"].sort());
      // DR-name-generator: strip the generative "name" from both sides — a
      // deliberate cosmetic divergence with no rng-order effect.
      const { name: _en, darkFor, flightLeft, flightCooldown, bag, ...engineCForDiff } = engineC;
      const { name: _pn, ...protoCForDiff } = ctx.S.c;
      assert.equal(diffState(protoCForDiff, engineCForDiff), null, `chargen seed ${seed} diverged`);
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
      // D-13/D-18 (Phase 20): the parley scenario carries a deliberate,
      // scenario-scoped divergence (c.sp/c.gold/combat.parleyTried/
      // combat.parleyInsulted); see the imported stripper's JSDoc in
      // ./harness/comparables.js. Every other scenario (win/lose/flee) keeps
      // comparing on the bare combatComparable.
      const cmp = scenario.name === "parley" ? (s) => stripParleyDivergence(combatComparable(s)) : combatComparable;

      const ctx = loadPrototypeSandbox({ seed: scenario.seed });
      let engineState = newRun(scenario.seed);
      assert.equal(diffState(cmp(ctx.S), cmp(engineState)), null);
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
        const d = diffState(cmp(ctx.S), cmp(engineState));
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

  // "win" sub-test DELIBERATELY RETIRED in 03-02 (endless descent): the
  // frozen prototype still wins at the floor-5 Gate; the endless engine now
  // descends past it instead, so this byte-for-byte win-parity comparison no
  // longer applies. See the file header comment for the full rationale.
  // Endless-descent behavior is proven instead by
  // test/unit/endless-descent.test.js.

  const elapsedMs = Date.now() - start;
  assert.ok(elapsedMs < 15000, `full-suite gate should stay within the ~15s budget target (took ${elapsedMs}ms)`);
});
