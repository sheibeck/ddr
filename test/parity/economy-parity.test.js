// ENG-05 economy + encounters parity: the extracted engine's store domain
// (openStore/buyFrom/leaveStore, now plain-data stock via STORE_EFFECTS) and
// encounter/trap/chest domain (springTrap/openChest/encounterDot and their
// helper tables) match the frozen prototype, action for action, across the
// economy fixture (a full store visit: food/potion/weapon/armor/premium/
// lockpicks purchases plus an insufficient-gold case) and five independent
// encounters scenarios (trap, chest, table-four, faerie, affliction — see
// each fixture's `_note` for how seeds were found). Both sides consume the
// SAME mulberry32 stream, so a faithful port produces byte-identical state
// after every action.
//
// `openStore`/`springTrap`/`openChest`/`encounterDot` are internal
// (non-validated) function calls, not real `applyAction` action types —
// mirrors test/parity/combat-parity.test.js's `startCombat` special-casing:
// the harness clones state, rebuilds the rng from the persisted cursor,
// calls the engine function directly, and persists the rng cursor, the same
// shape applyAction itself uses. `buyItem`/`leaveStore` ARE validated
// actions and go through the real `applyAction`. See
// test/parity/harness/comparables.js for the shared dispatch/comparable
// helpers (also reused by test/parity/full-suite.test.js).
//
// A structural, byte-for-byte `diffState` comparison of `state.store` is
// impossible between the two sides by DESIGN — the prototype's stock still
// holds live `buy` closures (the very anti-pattern this plan eliminates on
// the engine side), and a closure can never structurally equal a plain
// `{effectId, effectParams}` descriptor. `stripStoreClosures` (in the shared
// harness) reduces both sides' stock entries to the fields that ARE
// comparable (`n`, `sub`, `cost`, `sold`) before every diff, mirroring
// test/parity/combat-parity.test.js's `stripFoeDamageClosures` carve-out for
// the exact same reason (BESTIARY's `sp.dmg`/`acid.dmg` closures). Likewise,
// `catchAffliction`/`springTrap`'s poisoned-arrow branch set
// `state.c.affliction.loss` to a closure on the prototype side and a plain
// dice-notation object on the engine side — stripped the same way.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { newRun } from "../../engine/engine.js";
import { loadPrototypeSandbox } from "./harness/sandboxPrototype.js";
import { diffState } from "./harness/diffState.js";
import {
  economyComparable as comparable,
  runEconomyAction as runAction,
  actionPathDivergenceOf,
  skipsByteDiffAt,
  declaredEndDiffs,
  stockMarkupDiff as checkStockMarkup,
  declaredStockDiffs,
  chargenShiftOf,
  stripChargenShift,
  chargenShiftDiffs,
} from "./harness/comparables.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ECONOMY_FIXTURE = JSON.parse(fs.readFileSync(path.resolve(__dirname, "fixtures", "action-script.economy.json"), "utf8"));
const ENCOUNTERS_FIXTURE = JSON.parse(fs.readFileSync(path.resolve(__dirname, "fixtures", "action-script.encounters.json"), "utf8"));

// --- economy: a full store visit -------------------------------------------

test("economy parity (store visit): engine matches the frozen prototype after every action", () => {
  // FID-07 (Phase 24, plan 24-02): a script fixture (unlike a scenario-keyed
  // fixture) carries its action-path record, if any, at the fixture's own
  // top level. `null` today (no record declared yet) — a no-op until Plan
  // 24-04 declares the Pickpocket markup here.
  const pathDiv = actionPathDivergenceOf(ECONOMY_FIXTURE);
  // Phase 38 (ABIL-02): the economy fixture's script top level carries a
  // declared chargenDivergence (seed 3, Thief Pickpocket).
  const shift = chargenShiftOf(ECONOMY_FIXTURE);
  const cmp = shift ? (s) => stripChargenShift(comparable(s), shift) : comparable;

  const ctx = loadPrototypeSandbox({ seed: ECONOMY_FIXTURE.seed });
  let engineState = newRun(ECONOMY_FIXTURE.seed);

  if (shift) {
    const shiftDiffs = chargenShiftDiffs(ctx.S.c, engineState.c, shift);
    assert.equal(shiftDiffs.before, null, `economy fixture: prototype chargen shift != declared before at ${shiftDiffs.before}`);
    assert.equal(shiftDiffs.after, null, `economy fixture: engine chargen shift != declared after at ${shiftDiffs.after}`);
  }

  const initialDivergence = diffState(cmp(ctx.S), cmp(engineState));
  assert.equal(initialDivergence, null, `seed ${ECONOMY_FIXTURE.seed}: initial boot state diverges at ${initialDivergence}`);

  // Bump gold identically on both sides so the scenario can afford a full
  // spread of purchase categories (see the fixture's `_note`).
  ctx.S.c.gold = 5000;
  engineState.c.gold = 5000;
  assert.equal(diffState(cmp(ctx.S), cmp(engineState)), null, "the gold bump itself must land identically on both sides");

  const allEventTypes = [];
  ECONOMY_FIXTURE.actions.forEach((action, i) => {
    const { state, events } = runAction(ctx, engineState, action);
    engineState = state;
    allEventTypes.push(...events.map((e) => e.type));

    // ENG-04, mid-scenario: whenever the store is open, the engine's state
    // must survive a JSON round-trip losslessly (the closure fix) — checked
    // at every step, not just once, since a real save can happen at any
    // point mid-shop.
    if (engineState.store) {
      const rehydrated = JSON.parse(JSON.stringify(engineState));
      assert.deepStrictEqual(rehydrated, engineState, `action ${i}: an open store must round-trip losslessly`);
      assert.doesNotThrow(() => structuredClone(engineState), `action ${i}: structuredClone must not throw on an open store`);
    }

    // FID-07: when the record declares a store-roll markup, the openStore
    // action must prove the store ROLL itself (names, order, subs) is still
    // byte-identical and every routed line's cost is exactly the declared
    // multiplier off the prototype's cost — before the per-action byte diff
    // is skipped for this and later actions.
    if (pathDiv?.stockCostMul != null && action.type === "openStore") {
      const markupDivergence = checkStockMarkup(ctx.S.store, engineState.store, pathDiv.stockCostMul);
      assert.equal(markupDivergence, null, `action ${i}: store markup diverged at ${markupDivergence}`);
    }
    // Phase 39 (GEAR-01, Task 3): the re-priced WEAPONS/ARMORS tables mean a
    // flat cost multiplier can no longer describe the engine's stock — the
    // stronger stockNames/stockAfter pin replaces it: the store ROLL
    // (names/order/subs) is still byte-identical to the prototype, and the
    // engine's own re-priced [n, cost] pairs are pinned exactly.
    if (pathDiv?.stockAfter && action.type === "openStore") {
      const stockDivergence = declaredStockDiffs(ctx.S.store, engineState.store, pathDiv);
      assert.equal(stockDivergence.names, null, `action ${i}: store roll (names) diverged at ${stockDivergence.names}`);
      assert.equal(stockDivergence.after, null, `action ${i}: engine stock diverged at ${stockDivergence.after}`);
    }

    if (!skipsByteDiffAt(pathDiv, i)) {
      const divergence = diffState(cmp(ctx.S), cmp(engineState));
      assert.equal(divergence, null, `action ${i} (${JSON.stringify(action)}): state diverges at ${divergence}`);
    }
  });

  // FID-07: end-of-scenario before/after pins, machine-checked, when a
  // record is declared. No-op when pathDiv is null.
  if (pathDiv) {
    const ends = declaredEndDiffs(ctx.S, engineState, pathDiv);
    assert.equal(ends.before, null, `economy fixture: prototype end-state != declared before at ${ends.before}`);
    assert.equal(ends.after, null, `economy fixture: engine end-state != declared after at ${ends.after}`);
  }

  assert.ok(allEventTypes.includes("storeOpened"));
  assert.ok(allEventTypes.includes("bought"), "at least one purchase succeeded");
  assert.ok(allEventTypes.includes("buyFailed"), "the fixture must hit an insufficient-gold case");
  assert.ok(allEventTypes.includes("storeLeft"));
  assert.equal(engineState.store, null, "the store was left");
});

// --- encounters: trap / chest / table-four / faerie / affliction -----------

for (const scenario of ENCOUNTERS_FIXTURE.scenarios) {
  test(`encounters parity (${scenario.name}): engine matches the frozen prototype after every action`, () => {
    // Phase 38 (ABIL-02): trap/chest/tablefour/faerie/affliction all carry a
    // declared chargenDivergence.
    const shift = chargenShiftOf(scenario);
    const cmp = shift ? (s) => stripChargenShift(comparable(s), shift) : comparable;
    // Phase 54 (BAND-02, USER RULING D): a scenario MAY also carry a
    // "action-path" divergence record — the SAME mechanism
    // combat-parity.test.js's scenario loop already uses. `null` for every
    // scenario except a declared mover.
    const pathDiv = actionPathDivergenceOf(scenario);

    const ctx = loadPrototypeSandbox({ seed: scenario.seed });
    let engineState = newRun(scenario.seed);

    if (shift) {
      const shiftDiffs = chargenShiftDiffs(ctx.S.c, engineState.c, shift);
      assert.equal(shiftDiffs.before, null, `scenario ${scenario.name}: prototype chargen shift != declared before at ${shiftDiffs.before}`);
      assert.equal(shiftDiffs.after, null, `scenario ${scenario.name}: engine chargen shift != declared after at ${shiftDiffs.after}`);
    }

    const initialDivergence = diffState(cmp(ctx.S), cmp(engineState));
    assert.equal(
      initialDivergence,
      null,
      `scenario ${scenario.name}, seed ${scenario.seed}: initial boot state diverges at ${initialDivergence}`,
    );

    const allEventTypes = [];
    scenario.actions.forEach((action, i) => {
      const { state, events } = runAction(ctx, engineState, action);
      engineState = state;
      allEventTypes.push(...events.map((e) => e.type));

      if (!skipsByteDiffAt(pathDiv, i)) {
        const divergence = diffState(cmp(ctx.S), cmp(engineState));
        assert.equal(
          divergence,
          null,
          `scenario ${scenario.name}, action ${i} (${JSON.stringify(action)}): state diverges at ${divergence}`,
        );
      }
    });

    if (pathDiv) {
      const ends = declaredEndDiffs(ctx.S, engineState, pathDiv);
      assert.equal(ends.before, null, `scenario ${scenario.name}: prototype end-state != declared before at ${ends.before}`);
      assert.equal(ends.after, null, `scenario ${scenario.name}: engine end-state != declared after at ${ends.after}`);
    }

    if (scenario.name === "trap") assert.ok(allEventTypes.includes("trapSprung"));
    else if (scenario.name === "chest") assert.ok(allEventTypes.includes("chestOpened"));
    else if (scenario.name === "tablefour") assert.ok(allEventTypes.includes("tableFour"));
    else if (scenario.name === "faerie") assert.ok(allEventTypes.includes("faerieMet"));
    else if (scenario.name === "affliction") assert.ok(allEventTypes.includes("afflictionCaught"));
  });
}
