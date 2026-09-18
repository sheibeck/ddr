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
  chargenDivergenceFor,
  stripDeclaredFields,
  stripScenarioDivergence,
  actionPathDivergenceOf,
  skipsByteDiffAt,
  declaredEndDiffs,
  stockMarkupDiff as checkStockMarkup,
  chargenShiftOf,
  stripChargenShift,
  chargenShiftDiffs,
  stripReauthoredEveryField,
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
  "gold", "scrolls", "affliction", "joiner",
  "items", "grimoire", "spellsUsed", "kills", "might", "ward", "regen", "mirror",
  "foresight",
  // Phase 39 (GEAR-02, greenfield retirement): "haste"/"invis"/"ether"/
  // "acute"/"flightLeft"/"flightCooldown" are REMOVED entirely — the engine
  // no longer builds these fields at all. See chargen-parity.test.js's
  // identical comment for the full rationale.
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
  // ECON-01 (Phase 12): engine-only class-derived carry bag key, no
  // prototype-side equivalent — plain assignment (no rng), stripped again
  // below before diffState. See chargen-parity.test.js for the full rationale.
  "bag",
  // Phase 38 (ABIL-01/02/03): engine-only ordered array of catalog ability
  // ids, no prototype-side equivalent — stripped again below before
  // diffState. See chargen-parity.test.js for the full rationale.
  "abilities",
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
      const { name: _en, darkFor, bag, abilities, ...engineCForDiff0 } = engineC;
      // Phase 39 (GEAR-02): the prototype still carries haste/invis/ether/
      // acute at chargen — strip them off protoC only.
      const { name: _pn, haste, invis, ether, acute, ...protoCForDiff0 } = ctx.S.c;
      // Phase 39 (GEAR-02, once-a-day rule): strip the three re-authored
      // treasure rows' `every` value too — seed 3's Thief starts with a
      // Cloak of Ether.
      const engineCForDiff = stripReauthoredEveryField(engineCForDiff0);
      const protoCForDiff = stripReauthoredEveryField(protoCForDiff0);

      // FID-06 (Phase 23): seeds 15 and 24 carry a declared, measured chargen
      // divergence (see the chargen fixture's `divergences` map) — assert the
      // before/after values, then strip only the declared fields. Every
      // other seed has no record and is compared byte-identically.
      const record = chargenDivergenceFor(CHARGEN_FIXTURE, seed);
      let strippedProto = protoCForDiff;
      let strippedEngine = engineCForDiff;
      if (record) {
        for (const field of record.fields) {
          // See chargen-parity.test.js's identical comment: protoCForDiff
          // lives in the vm sandbox's realm, so diffState (structuredClone
          // first) is used instead of a bare assert.deepStrictEqual.
          assert.equal(diffState(protoCForDiff[field], record.before[field]), null, `chargen seed ${seed}: prototype ${field} != declared before`);
          assert.equal(diffState(engineCForDiff[field], record.after[field]), null, `chargen seed ${seed}: engine ${field} != declared after`);
        }
        strippedProto = stripDeclaredFields(protoCForDiff, record.fields);
        strippedEngine = stripDeclaredFields(engineCForDiff, record.fields);
      }
      assert.equal(diffState(strippedProto, strippedEngine), null, `chargen seed ${seed} diverged`);
    }
  });

  await t.test("movement: the movement fixture matches the frozen prototype", () => {
    // Phase 38 (ABIL-02): the movement fixture's seed 256 (Thief Cat
    // Burglar) is a declared chargenDivergence (the table reshape moved its
    // c.skills) — wrap movementComparable with the shift strip, and prove
    // both sides' chargen c matches the record's before/after first.
    const shift = chargenShiftOf(MOVEMENT_FIXTURE);
    const cmp = shift ? (s) => stripChargenShift(movementComparable(s), shift) : movementComparable;
    const ctx = loadPrototypeSandbox({ seed: MOVEMENT_FIXTURE.seed });
    let engineState = newRun(MOVEMENT_FIXTURE.seed);
    if (shift) {
      const shiftDiffs = chargenShiftDiffs(ctx.S.c, engineState.c, shift);
      assert.equal(shiftDiffs.before, null, `movement fixture: prototype chargen shift != declared before at ${shiftDiffs.before}`);
      assert.equal(shiftDiffs.after, null, `movement fixture: engine chargen shift != declared after at ${shiftDiffs.after}`);
    }
    assert.equal(diffState(cmp(ctx.S), cmp(engineState)), null);
    MOVEMENT_FIXTURE.actions.forEach((action, i) => {
      ctx.move(action.dir);
      const { state } = applyAction(engineState, action);
      engineState = state;
      const d = diffState(cmp(ctx.S), cmp(engineState));
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
      const baseCmp = scenario.name === "parley" ? (s) => stripParleyDivergence(combatComparable(s)) : combatComparable;
      // Phase 38 (ABIL-02): win/lose/lose-plain/flee/parley all carry a
      // declared chargenDivergence (the table reshape moved their chargen
      // c.skills) — wrap the base comparable with the shift strip.
      const shift = chargenShiftOf(scenario);
      const cmp = shift ? (s) => stripChargenShift(baseCmp(s), shift) : baseCmp;
      // FID-07 (Phase 24, plan 24-02): the identical consult/skip/end-assert
      // logic as combat-parity.test.js — both replay sites must agree (the
      // Phase 23 rule). `null` for every scenario today (no-op).
      const pathDiv = actionPathDivergenceOf(scenario);

      const ctx = loadPrototypeSandbox({ seed: scenario.seed });
      let engineState = newRun(scenario.seed);
      if (shift) {
        const shiftDiffs = chargenShiftDiffs(ctx.S.c, engineState.c, shift);
        assert.equal(shiftDiffs.before, null, `combat scenario ${scenario.name}: prototype chargen shift != declared before at ${shiftDiffs.before}`);
        assert.equal(shiftDiffs.after, null, `combat scenario ${scenario.name}: engine chargen shift != declared after at ${shiftDiffs.after}`);
      }
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
        if (!skipsByteDiffAt(pathDiv, i)) {
          const d = diffState(cmp(ctx.S), cmp(engineState));
          assert.equal(d, null, `combat scenario ${scenario.name}, action ${i}: diverged at ${d}`);
        }
      });

      if (pathDiv) {
        const ends = declaredEndDiffs(ctx.S, engineState, pathDiv);
        assert.equal(ends.before, null, `combat scenario ${scenario.name}: prototype end-state != declared before at ${ends.before}`);
        assert.equal(ends.after, null, `combat scenario ${scenario.name}: engine end-state != declared after at ${ends.after}`);
      }
    }
  });

  await t.test("magic: every magic scenario matches the frozen prototype", () => {
    for (const scenario of MAGIC_FIXTURE.scenarios) {
      // FID-06 (Phase 23, "Freeze pays out") / CMB-01 (Phase 31): the
      // `cast-damage` scenario (seed 8) carries a declared, measured
      // `divergence` record — Phase 31 upgraded it to an "action-path"
      // shape (the compared combat object itself differs from action 0),
      // mirroring the combat sub-test above and magic-parity.test.js's
      // identical selection. A kind-less (Phase 23-shaped) record still
      // selects the scenario-scoped stripper (no fixture uses that shape
      // today, but it stays supported).
      const pathDiv = actionPathDivergenceOf(scenario);
      let cmp = pathDiv ? combatComparable : scenario.divergence ? (s) => stripScenarioDivergence(combatComparable(s), scenario.divergence) : combatComparable;
      // Phase 38 (ABIL-02): the "potion" scenario (seed 1) carries a declared
      // chargenDivergence — wrap outermost, on top of pathDiv/scenario.divergence.
      const shift = chargenShiftOf(scenario);
      if (shift) { const inner = cmp; cmp = (s) => stripChargenShift(inner(s), shift); }

      const ctx = loadPrototypeSandbox({ seed: scenario.seed });
      let engineState = newRun(scenario.seed);
      if (shift) {
        const shiftDiffs = chargenShiftDiffs(ctx.S.c, engineState.c, shift);
        assert.equal(shiftDiffs.before, null, `magic scenario ${scenario.name}: prototype chargen shift != declared before at ${shiftDiffs.before}`);
        assert.equal(shiftDiffs.after, null, `magic scenario ${scenario.name}: engine chargen shift != declared after at ${shiftDiffs.after}`);
      }
      assert.equal(diffState(cmp(ctx.S), cmp(engineState)), null);
      const allEventTypes = [];
      scenario.actions.forEach((action, i) => {
        if (action.type === "startCombat") {
          ctx.startCombat(action.wandering, action.forced);
          const { state, events } = applyStartCombat(engineState, action.wandering, action.forced);
          engineState = state;
          allEventTypes.push(...events.map((e) => e.type));
        } else if (action.type === "castSpell") {
          ctx.castSpell(action.idx);
          const { state, events } = applyAction(engineState, { type: "castSpell", idx: action.idx });
          engineState = state;
          allEventTypes.push(...events.map((e) => e.type));
        } else {
          ctx[action.type]();
          const { state, events } = applyAction(engineState, { type: action.type });
          engineState = state;
          allEventTypes.push(...events.map((e) => e.type));
        }
        // FID-07 (Phase 24) / CMB-01 (Phase 31): skip the per-action byte
        // diff only when a declared action-path record says the path
        // diverges from this index on.
        if (!skipsByteDiffAt(pathDiv, i)) {
          const d = diffState(cmp(ctx.S), cmp(engineState));
          assert.equal(d, null, `magic scenario ${scenario.name}, action ${i}: diverged at ${d}`);
        }
      });

      if (pathDiv) {
        const ends = declaredEndDiffs(ctx.S, engineState, pathDiv);
        assert.equal(ends.before, null, `magic scenario ${scenario.name}: prototype end-state != declared before at ${ends.before}`);
        assert.equal(ends.after, null, `magic scenario ${scenario.name}: engine end-state != declared after at ${ends.after}`);
      } else if (scenario.divergence) {
        const protoC = combatComparable(ctx.S).c;
        const engineC = combatComparable(engineState).c;
        for (const field of scenario.divergence.fields) {
          assert.equal(diffState(protoC[field], scenario.divergence.before[field]), null, `magic scenario ${scenario.name}: prototype ${field} != declared before`);
          assert.equal(diffState(engineC[field], scenario.divergence.after[field]), null, `magic scenario ${scenario.name}: engine ${field} != declared after`);
        }
      }

      if (scenario.name === "cast-damage") {
        // Phase 31 (CMB-01): the afraid caster still casts and still pays
        // out; nothing is ever refused for fear.
        assert.ok(allEventTypes.includes("phobiaAfraid"), "the Illusionist's Beasts phobia triggered Afraid");
        assert.ok(allEventTypes.includes("spellThrown"), "the afraid caster still casts");
        assert.ok(allEventTypes.includes("frozenSolid"), "the frozen foe was narrated");
        assert.ok(allEventTypes.includes("foeKilled"), "the Freeze kill paid out via killFoe");
        assert.ok(!allEventTypes.includes("castRefused"), "nothing is ever refused for fear");
        assert.ok(!allEventTypes.includes("strikeRefused"), "nothing is ever refused for fear");
        assert.equal(engineState.combat, null);
      }
    }
  });

  await t.test("economy + encounters: the store visit and every encounters scenario match the frozen prototype", () => {
    {
      // FID-07 (Phase 24, plan 24-02): the identical consult/skip/end-assert/
      // markup logic as economy-parity.test.js — both replay sites must
      // agree. `null` today (no-op).
      const pathDiv = actionPathDivergenceOf(ECONOMY_FIXTURE);
      // Phase 38 (ABIL-02): the economy fixture's script top level carries a
      // declared chargenDivergence (seed 3, Thief Pickpocket).
      const shift = chargenShiftOf(ECONOMY_FIXTURE);
      const cmp = shift ? (s) => stripChargenShift(economyComparable(s), shift) : economyComparable;

      const ctx = loadPrototypeSandbox({ seed: ECONOMY_FIXTURE.seed });
      let engineState = newRun(ECONOMY_FIXTURE.seed);
      if (shift) {
        const shiftDiffs = chargenShiftDiffs(ctx.S.c, engineState.c, shift);
        assert.equal(shiftDiffs.before, null, `economy fixture: prototype chargen shift != declared before at ${shiftDiffs.before}`);
        assert.equal(shiftDiffs.after, null, `economy fixture: engine chargen shift != declared after at ${shiftDiffs.after}`);
      }
      assert.equal(diffState(cmp(ctx.S), cmp(engineState)), null);
      ctx.S.c.gold = 5000;
      engineState.c.gold = 5000;
      ECONOMY_FIXTURE.actions.forEach((action, i) => {
        const { state } = runEconomyAction(ctx, engineState, action);
        engineState = state;

        if (pathDiv?.stockCostMul != null && action.type === "openStore") {
          const markupDivergence = checkStockMarkup(ctx.S.store, engineState.store, pathDiv.stockCostMul);
          assert.equal(markupDivergence, null, `economy action ${i}: store markup diverged at ${markupDivergence}`);
        }

        if (!skipsByteDiffAt(pathDiv, i)) {
          const d = diffState(cmp(ctx.S), cmp(engineState));
          assert.equal(d, null, `economy action ${i}: diverged at ${d}`);
        }
      });

      if (pathDiv) {
        const ends = declaredEndDiffs(ctx.S, engineState, pathDiv);
        assert.equal(ends.before, null, `economy fixture: prototype end-state != declared before at ${ends.before}`);
        assert.equal(ends.after, null, `economy fixture: engine end-state != declared after at ${ends.after}`);
      }
    }
    for (const scenario of ENCOUNTERS_FIXTURE.scenarios) {
      // Phase 38 (ABIL-02): trap/chest/tablefour/faerie/affliction all carry
      // a declared chargenDivergence.
      const shift = chargenShiftOf(scenario);
      const cmp = shift ? (s) => stripChargenShift(economyComparable(s), shift) : economyComparable;
      const ctx = loadPrototypeSandbox({ seed: scenario.seed });
      let engineState = newRun(scenario.seed);
      if (shift) {
        const shiftDiffs = chargenShiftDiffs(ctx.S.c, engineState.c, shift);
        assert.equal(shiftDiffs.before, null, `encounters scenario ${scenario.name}: prototype chargen shift != declared before at ${shiftDiffs.before}`);
        assert.equal(shiftDiffs.after, null, `encounters scenario ${scenario.name}: engine chargen shift != declared after at ${shiftDiffs.after}`);
      }
      assert.equal(diffState(cmp(ctx.S), cmp(engineState)), null);
      scenario.actions.forEach((action, i) => {
        const { state } = runEconomyAction(ctx, engineState, action);
        engineState = state;
        const d = diffState(cmp(ctx.S), cmp(engineState));
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
