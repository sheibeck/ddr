// ENG-04 standing round-trip guardrail. From this plan (01-07) forward, every
// slice that adds action handlers must keep this test green: a run's state,
// after EVERY applyAction call, must JSON round-trip deepStrictEqual (modulo
// the volatile wall-clock fields diffState.js already strips). This is the
// mechanical proof that GameState stays 100% plain, serializable data —
// no closures, no class instances, no non-JSON leaf ever sneaks in.
//
// Uses the movement action-script fixture (test/parity/fixtures/
// action-script.movement.json) so the guardrail runs against a real, varied
// sequence: plain moves, a blocked wall no-op, a one-way door, a floor
// descend, and a day-cycle upkeep tick — the full movement slice this plan
// lands.
//
// 01-08 extends the guardrail with the combat action-script fixture (test/
// parity/fixtures/action-script.combat.json), proving the round-trip stays
// lossless with an ACTIVE `state.combat` sub-state (foes, ally, in-progress
// round) on the wire, not just before/after a fight.
//
// 01-09 extends it further with the magic action-script fixture (test/
// parity/fixtures/action-script.magic.json), proving the round-trip stays
// lossless through a ward/spell sub-state (a Shield/Bubble's pool/rounds on
// `state.c.ward`, `state.c.mirror`, `state.c.might`/`strengthBoost`, a live
// `state.combat` mid-cast) — every field castSpell/drinkPotion/readScroll
// can set is plain JSON, same as every other rule domain.
//
// 01-10 (ENG-05's phase gate) extends it a final time with the economy
// fixture (test/parity/fixtures/action-script.economy.json — an OPEN store,
// the exact sub-state the prototype itself flagged as unsaveable, now plain
// data) and the encounters fixture (test/parity/fixtures/
// action-script.encounters.json — a trap-set affliction, a chest, a
// faerie). It also originally added the win fixture (a full run through the
// then-existing win-path state) — that fixture and its round-trip test were
// DELIBERATELY RETIRED in 03-02 (endless descent, RUN-02/RUN-04): the win
// path is no longer a reachable run terminator (genFloor never emits "gate"
// anymore, and move() routes any legacy "gate" tile to descend() instead;
// Phase 46, DEAD-04, later deleted the win path entirely).
// ENG-04 round-trip coverage remains complete via the movement/combat/magic/
// economy/encounters fixtures above; `descend` stays imported below — it is
// still exercised via ECONOMY_INTERNAL_FNS in the economy/encounters
// round-trip scenarios.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { newRun, applyAction } from "../../engine/engine.js";
import { startCombat } from "../../engine/combat.js";
import { descend } from "../../engine/movement.js";
import { makeRng } from "../../engine/rng.js";
import { stripVolatileFields } from "../parity/harness/diffState.js";
import { openStore } from "../../engine/economy.js";
import { springTrap, openChest, encounterDot } from "../../engine/encounters.js";
import { SPELLS } from "../../content/index.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const FIXTURE = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "..", "parity", "fixtures", "action-script.movement.json"), "utf8"),
);
const COMBAT_FIXTURE = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "..", "parity", "fixtures", "action-script.combat.json"), "utf8"),
);
const MAGIC_FIXTURE = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "..", "parity", "fixtures", "action-script.magic.json"), "utf8"),
);
const ECONOMY_FIXTURE = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "..", "parity", "fixtures", "action-script.economy.json"), "utf8"),
);
const ENCOUNTERS_FIXTURE = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "..", "parity", "fixtures", "action-script.encounters.json"), "utf8"),
);
// action-script.win.json was DELIBERATELY RETIRED in 03-02 — see header comment.

/** applyStartCombat(state, wandering, forced) — the same non-validated-action
 * shape test/parity/combat-parity.test.js uses: `startCombat` is not in
 * engine/actions.js's ACTION_TYPES (it's an internal function other rule
 * domains call, not a player action), so this mirrors applyAction's own
 * clone/rng-rehydrate/persist shape by hand. */
function applyStartCombat(state, wandering, forced) {
  const next = structuredClone(state);
  const rng = makeRng(next.rngState);
  const events = [];
  startCombat(next, wandering, forced, rng, events);
  next.rngState = rng.getState();
  return { state: next, events };
}

test("newRun(seed) itself round-trips before any action runs", () => {
  const state = newRun(FIXTURE.seed);
  const stripped = stripVolatileFields(state);
  const rehydrated = JSON.parse(JSON.stringify(stripped));
  assert.deepStrictEqual(rehydrated, stripped);
});

test("state survives a JSON round-trip after EVERY action in the movement fixture", () => {
  let state = newRun(FIXTURE.seed);
  assert.ok(Array.isArray(FIXTURE.actions) && FIXTURE.actions.length > 0, "fixture must carry actions");

  FIXTURE.actions.forEach((action, i) => {
    const result = applyAction(state, action);
    state = result.state;
    const stripped = stripVolatileFields(state);
    const rehydrated = JSON.parse(JSON.stringify(stripped));
    assert.deepStrictEqual(rehydrated, stripped, `state must round-trip losslessly after action ${i} (${JSON.stringify(action)})`);
  });

  // Sanity: the fixture is supposed to actually exercise a descend and a
  // day-cycle tick, not silently no-op the whole way through.
  assert.equal(state.floor.depth, 2, "the fixture must have descended to floor 2");
  assert.equal(state.day, 2, "the fixture must have crossed a day tick");
  assert.equal(state.steps, 100, "the fixture must land on exactly 100 cumulative steps");
});

test("applyAction never mutates the state object passed in (returns a fresh clone)", () => {
  const before = newRun(FIXTURE.seed);
  const beforeJSON = JSON.stringify(before);
  applyAction(before, FIXTURE.actions[1]);
  assert.equal(JSON.stringify(before), beforeJSON, "the input state must be untouched (structuredClone in applyAction)");
});

// --- 01-08: the guardrail extended through an ACTIVE combat sub-state ------

for (const scenario of COMBAT_FIXTURE.scenarios) {
  test(`state survives a JSON round-trip through the combat fixture's "${scenario.name}" scenario, including mid-fight combat sub-state`, () => {
    let state = newRun(scenario.seed);
    let sawActiveCombat = false;

    scenario.actions.forEach((action, i) => {
      const result =
        action.type === "startCombat" ? applyStartCombat(state, action.wandering, action.forced) : applyAction(state, action);
      state = result.state;
      if (state.combat) sawActiveCombat = true;

      const stripped = stripVolatileFields(state);
      const rehydrated = JSON.parse(JSON.stringify(stripped));
      assert.deepStrictEqual(
        rehydrated,
        stripped,
        `scenario ${scenario.name}, action ${i} (${JSON.stringify(action)}) must round-trip losslessly`,
      );
    });

    assert.ok(sawActiveCombat, `scenario ${scenario.name} must exercise an active combat sub-state at some point`);
  });
}

// --- 01-09: the guardrail extended through the magic fixture ---------------

for (const scenario of MAGIC_FIXTURE.scenarios) {
  test(`state survives a JSON round-trip through the magic fixture's "${scenario.name}" scenario`, () => {
    let state = newRun(scenario.seed);

    scenario.actions.forEach((action, i) => {
      const result = action.type === "startCombat" ? applyStartCombat(state, action.wandering, action.forced) : applyAction(state, action);
      state = result.state;

      const stripped = stripVolatileFields(state);
      const rehydrated = JSON.parse(JSON.stringify(stripped));
      assert.deepStrictEqual(
        rehydrated,
        stripped,
        `scenario ${scenario.name}, action ${i} (${JSON.stringify(action)}) must round-trip losslessly`,
      );
    });
  });
}

test("a mid-cast ward sub-state (Shield) round-trips losslessly", () => {
  // Directly exercise a ward spell's serializable shape (state.c.ward's
  // pool/rounds/name) rather than relying on a fixture seed happening
  // to roll "Shield" into its grimoire — this is a serialization proof
  // (ENG-04), not a prototype-parity proof (that's magic-parity.test.js's job).
  let state = newRun(1);
  state.c.grimoire = ["Shield"];
  const { state: afterCast } = applyAction(state, { type: "castSpell", idx: 1 }); // SPELLS[1] === Shield
  state = afterCast;
  assert.deepStrictEqual(state.c.ward, { pool: 50, rounds: 5, name: "Shield" }, "the ward was actually set");

  const stripped = stripVolatileFields(state);
  const rehydrated = JSON.parse(JSON.stringify(stripped));
  assert.deepStrictEqual(rehydrated, stripped, "state with an active ward sub-state must round-trip losslessly");
});

// RULES-14 (Phase 75, user 2026-09-25): an armed Bubble mirror (rounds: null)
// round-trips losslessly too — the sibling proof to Shield's above.
test("a mid-cast armed mirror (Bubble) round-trips losslessly, including a null rounds", () => {
  let state = newRun(1);
  state.c.grimoire = ["Bubble"];
  state.c.level = 3;
  const bubbleIdx = SPELLS.findIndex((sp) => sp.n === "Bubble");
  const { state: afterCast } = applyAction(state, { type: "castSpell", idx: bubbleIdx });
  state = afterCast;
  assert.deepStrictEqual(
    state.c.ward,
    { name: "Bubble", mirror: true, pool: 0, popPool: 25, rounds: null },
    "the armed mirror was actually set",
  );

  const stripped = stripVolatileFields(state);
  const rehydrated = JSON.parse(JSON.stringify(stripped));
  assert.deepStrictEqual(rehydrated, stripped, "state with an armed mirror must round-trip losslessly, including rounds: null");
});

// RULES-13 (Phase 75, user 2026-09-25): a wielded magic staff — c.weapon
// naming the staff AND c.staff carrying the real, charge-bearing object —
// round-trips losslessly, exactly like the ward sub-states above.
test("a wielded magic staff (c.weapon/c.staff) round-trips losslessly", () => {
  let state = newRun(1);
  state.c.cls = "Magic User";
  state.c.sub = "Wizard";
  state.c.items = state.c.items || [];
  state.c.items.push({ kind: "staff", n: "Birch Staff", use: "freeze", txt: "freezes up to 2 squares of opponents indefinitely", charges: 2 });
  const staffIdx = state.c.items.length - 1;
  const { state: afterEquip } = applyAction(state, { type: "equipItem", i: staffIdx });
  state = afterEquip;
  assert.equal(state.c.weapon, "Birch Staff", "the staff was actually wielded");
  assert.deepStrictEqual(
    state.c.staff,
    { kind: "staff", n: "Birch Staff", use: "freeze", txt: "freezes up to 2 squares of opponents indefinitely", charges: 2 },
    "c.staff carries the real charge-bearing object",
  );

  const stripped = stripVolatileFields(state);
  const rehydrated = JSON.parse(JSON.stringify(stripped));
  assert.deepStrictEqual(rehydrated, stripped, "state with a wielded staff must round-trip losslessly");
  assert.doesNotThrow(() => structuredClone(state), "structuredClone must not throw on a wielded staff");
});

test("Phase 29 (LOOT-06): a state carrying a 3-item pendingLoot pile round-trips losslessly and idempotently", () => {
  const state = newRun(1);
  state.pendingLoot = [
    { kind: "jewel", n: "A" },
    { kind: "weapon", n: "Dagger", base: "Dagger", bonus: 0, txt: "d6/2" },
    { kind: "bag", tier: "medium", n: "Medium bag", txt: "6 slots. Room to regret more things." },
  ];

  const stripped = stripVolatileFields(state);
  const rehydrated = JSON.parse(JSON.stringify(stripped));
  assert.deepStrictEqual(rehydrated, stripped, "a 3-item pendingLoot pile must round-trip losslessly");

  const again = JSON.parse(JSON.stringify(stripVolatileFields(JSON.parse(JSON.stringify(stripped)))));
  assert.deepStrictEqual(again, stripped, "double round-trip is idempotent");
});

// --- 01-10: the guardrail extended through economy/encounters/win ---------

/** applyInternal(state, fn) — the same clone/rng-rehydrate/persist shape as
 * applyStartCombat above, generalized for economy.js's/encounters.js's
 * internal (non-validated) functions (openStore/springTrap/openChest/
 * encounterDot/descend). */
function applyInternal(state, fn) {
  const next = structuredClone(state);
  const rng = makeRng(next.rngState);
  const events = [];
  fn(next, rng, events);
  next.rngState = rng.getState();
  return { state: next, events };
}

const ECONOMY_INTERNAL_FNS = { openStore, springTrap, openChest, encounterDot, descend };

for (const scenario of [{ name: "store", ...ECONOMY_FIXTURE }]) {
  test(`state survives a JSON round-trip through the economy fixture's "${scenario.name}" scenario, including an OPEN store`, () => {
    let state = newRun(scenario.seed);
    let sawOpenStore = false;

    scenario.actions.forEach((action, i) => {
      const result =
        action.type in ECONOMY_INTERNAL_FNS ? applyInternal(state, ECONOMY_INTERNAL_FNS[action.type]) : applyAction(state, action);
      state = result.state;
      if (state.store) sawOpenStore = true;

      const stripped = stripVolatileFields(state);
      const rehydrated = JSON.parse(JSON.stringify(stripped));
      assert.deepStrictEqual(
        rehydrated,
        stripped,
        `scenario ${scenario.name}, action ${i} (${JSON.stringify(action)}) must round-trip losslessly`,
      );
      // structuredClone throws immediately on any function-typed leaf — the
      // strongest possible proof the store's closures are gone (ENG-03/04).
      assert.doesNotThrow(() => structuredClone(state), `scenario ${scenario.name}, action ${i}: structuredClone must not throw`);
    });

    assert.ok(sawOpenStore, "the economy fixture must exercise an OPEN store sub-state at some point");
  });
}

for (const scenario of ENCOUNTERS_FIXTURE.scenarios) {
  test(`state survives a JSON round-trip through the encounters fixture's "${scenario.name}" scenario`, () => {
    let state = newRun(scenario.seed);

    scenario.actions.forEach((action, i) => {
      const result =
        action.type in ECONOMY_INTERNAL_FNS ? applyInternal(state, ECONOMY_INTERNAL_FNS[action.type]) : applyAction(state, action);
      state = result.state;

      const stripped = stripVolatileFields(state);
      const rehydrated = JSON.parse(JSON.stringify(stripped));
      assert.deepStrictEqual(
        rehydrated,
        stripped,
        `scenario ${scenario.name}, action ${i} (${JSON.stringify(action)}) must round-trip losslessly`,
      );
    });
  });
}

// RULES-12 (Phase 75, user 2026-09-25): a pending tile (the record a
// newDay wandering-monster check leaves under the hero — see
// engine/movement.js#resolvePendingTile) round-trips losslessly too, the
// same sibling proof pendingLoot's own test above gives.
test("Phase 75 (RULES-12): a state carrying a pendingTile record round-trips losslessly and idempotently", () => {
  const state = newRun(1);
  state.pendingTile = { x: state.floor.px, y: state.floor.py, depth: state.floor.depth };

  const stripped = stripVolatileFields(state);
  const rehydrated = JSON.parse(JSON.stringify(stripped));
  assert.deepStrictEqual(rehydrated, stripped, "a pendingTile record must round-trip losslessly");

  const again = JSON.parse(JSON.stringify(stripVolatileFields(JSON.parse(JSON.stringify(stripped)))));
  assert.deepStrictEqual(again, stripped, "double round-trip is idempotent");
});

// "win fixture round-trip" test DELIBERATELY RETIRED in 03-02 (endless
// descent): the win path is no longer a reachable run terminator, so there
// is no win-path state left to prove round-trips (Phase 46, DEAD-04, later
// deleted the win path entirely). See the file header comment for the full
// rationale.
