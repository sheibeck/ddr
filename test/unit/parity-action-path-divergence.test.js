// test/unit/parity-action-path-divergence.test.js
//
// FID-07 (Phase 24, plan 24-02): synthetic-data unit tests for the new
// generic "action-path" divergence helpers in test/parity/harness/
// comparables.js — actionPathDivergenceOf, skipsByteDiffAt, declaredEndDiffs,
// PRICEFOR_ROUTED_EFFECTS, stockMarkupDiff. These are the FID-07 instrument
// Plans 24-03 (Fridgian hide/whiff) and 24-04 (Pickpocket markup) will use to
// declare real divergences; this plan wires them in as a provable no-op with
// no fixture present anywhere yet, so all coverage here is over hand-built
// synthetic data, never a real fixture.
//
// Mirrors test/unit/parley-carveout.test.js's exact-field / no-over-strip
// test style for the existing FID-06 divergence helpers.

import test from "node:test";
import assert from "node:assert/strict";

import {
  actionPathDivergenceOf,
  skipsByteDiffAt,
  declaredEndDiffs,
  PRICEFOR_ROUTED_EFFECTS,
  stockMarkupDiff,
} from "../parity/harness/comparables.js";

// --- actionPathDivergenceOf --------------------------------------------------

test("actionPathDivergenceOf: null for a holder with no divergence at all", () => {
  assert.equal(actionPathDivergenceOf({}), null);
  assert.equal(actionPathDivergenceOf(null), null);
  assert.equal(actionPathDivergenceOf(undefined), null);
});

test("actionPathDivergenceOf: null for a Phase-23-shaped record without `kind`", () => {
  const holder = {
    divergence: {
      phase: 23,
      requirements: ["FID-06"],
      fields: ["grimoire"],
      before: { grimoire: [] },
      after: { grimoire: ["Freeze"] },
      rationale: "guaranteed day-one attack spell",
    },
  };
  assert.equal(actionPathDivergenceOf(holder), null);
});

test("actionPathDivergenceOf: returns the record itself for kind action-path", () => {
  const divergence = { kind: "action-path", fromAction: 2, fields: ["hide"], before: {}, after: {} };
  const holder = { divergence };
  assert.equal(actionPathDivergenceOf(holder), divergence);
});

// --- skipsByteDiffAt ---------------------------------------------------------

test("skipsByteDiffAt: false when no record is present", () => {
  assert.equal(skipsByteDiffAt(null, 0), false);
  assert.equal(skipsByteDiffAt(undefined, 5), false);
});

test("skipsByteDiffAt: false for an index below fromAction", () => {
  assert.equal(skipsByteDiffAt({ fromAction: 3 }, 0), false);
  assert.equal(skipsByteDiffAt({ fromAction: 3 }, 2), false);
});

test("skipsByteDiffAt: true at and above fromAction", () => {
  assert.equal(skipsByteDiffAt({ fromAction: 3 }, 3), true);
  assert.equal(skipsByteDiffAt({ fromAction: 3 }, 10), true);
});

test("skipsByteDiffAt: false when fromAction is not a plain integer", () => {
  assert.equal(skipsByteDiffAt({ fromAction: "3" }, 3), false);
  assert.equal(skipsByteDiffAt({ fromAction: 1.5 }, 2), false);
  assert.equal(skipsByteDiffAt({}, 2), false);
});

// --- declaredEndDiffs ---------------------------------------------------------

test("declaredEndDiffs: both null when the measured c-level fields match the declared before/after", () => {
  const divergence = {
    kind: "action-path",
    fromAction: 2,
    fields: ["sp", "gold"],
    before: { sp: 0, gold: 50 },
    after: { sp: 5, gold: 51 },
  };
  const protoState = { c: { sp: 0, gold: 50, wp: 20 } };
  const engineState = { c: { sp: 5, gold: 51, wp: 20 } };

  const result = declaredEndDiffs(protoState, engineState, divergence);
  assert.equal(result.before, null);
  assert.equal(result.after, null);
});

test("declaredEndDiffs: non-null `before` when the prototype's measured field disagrees with the declared before", () => {
  const divergence = {
    kind: "action-path",
    fromAction: 2,
    fields: ["sp"],
    before: { sp: 0 },
    after: { sp: 5 },
  };
  const protoState = { c: { sp: 1 } }; // disagrees with declared before (0)
  const engineState = { c: { sp: 5 } };

  const result = declaredEndDiffs(protoState, engineState, divergence);
  assert.notEqual(result.before, null);
  assert.equal(result.after, null);
});

test("declaredEndDiffs: non-null `after` when the engine's measured field disagrees with the declared after", () => {
  const divergence = {
    kind: "action-path",
    fromAction: 2,
    fields: ["sp"],
    before: { sp: 0 },
    after: { sp: 5 },
  };
  const protoState = { c: { sp: 0 } };
  const engineState = { c: { sp: 999 } }; // disagrees with declared after (5)

  const result = declaredEndDiffs(protoState, engineState, divergence);
  assert.equal(result.before, null);
  assert.notEqual(result.after, null);
});

test("declaredEndDiffs: honors optional stateFields/stateBefore/stateAfter alongside c-level fields", () => {
  const divergence = {
    kind: "action-path",
    fromAction: 1,
    fields: ["wp"],
    before: { wp: 10 },
    after: { wp: 0 },
    stateFields: ["dead"],
    stateBefore: { dead: false },
    stateAfter: { dead: true },
  };
  const protoState = { c: { wp: 10 }, dead: false };
  const engineState = { c: { wp: 0 }, dead: true };

  const result = declaredEndDiffs(protoState, engineState, divergence);
  assert.equal(result.before, null);
  assert.equal(result.after, null);

  // a mismatched top-level stateField is caught too.
  const badEngineState = { c: { wp: 0 }, dead: false };
  const badResult = declaredEndDiffs(protoState, badEngineState, divergence);
  assert.equal(badResult.before, null);
  assert.notEqual(badResult.after, null);
});

test("declaredEndDiffs: throws a clear Error on a record with empty fields", () => {
  const protoState = { c: {} };
  const engineState = { c: {} };
  assert.throws(
    () => declaredEndDiffs(protoState, engineState, { kind: "action-path", fromAction: 0, fields: [], before: {}, after: {} }),
    /non-empty `fields`/,
  );
  assert.throws(
    () => declaredEndDiffs(protoState, engineState, { kind: "action-path", fromAction: 0, before: {}, after: {} }),
    /non-empty `fields`/,
  );
});

// --- stockMarkupDiff ----------------------------------------------------------

function baseProtoStore() {
  return {
    stock: [
      { n: "Bread (+12 wp)", sub: null, cost: 30 },
      { n: "Long Sword", sub: "a fine blade", cost: 500 },
      { n: "Studded Leather", sub: "AR 3, 12 wp", cost: 600 },
    ],
  };
}

function baseEngineStore({ weaponCost = 625, armorCost = 750 } = {}) {
  return {
    stock: [
      { n: "Bread (+12 hp)", sub: null, cost: 30, effectId: "eatRation", sold: false },
      { n: "Long Sword", sub: "a fine blade", cost: weaponCost, effectId: "buyWeapon", sold: false },
      { n: "Studded Leather", sub: "AR 3, 12 hp", cost: armorCost, effectId: "buyArmor", sold: false },
      { n: "Rations (+1 ration)", sub: null, cost: 30, effectId: "buyRations", sold: false },
    ],
  };
}

test("stockMarkupDiff: null when routed lines are marked up by mul and flat lines are unchanged (buyRations line ignored; wp/hp name normalized)", () => {
  const result = stockMarkupDiff(baseProtoStore(), baseEngineStore({ weaponCost: 625, armorCost: 750 }), 1.25);
  assert.equal(result, null);
});

test("stockMarkupDiff: non-null when a flat line's cost changes", () => {
  const engineStore = baseEngineStore();
  engineStore.stock[0].cost = 31; // eatRation is flat-priced, not in PRICEFOR_ROUTED_EFFECTS
  const result = stockMarkupDiff(baseProtoStore(), engineStore, 1.25);
  assert.notEqual(result, null);
  assert.match(result, /stock\[0\]\.cost/);
});

test("stockMarkupDiff: non-null when a routed line is NOT marked up", () => {
  const engineStore = baseEngineStore({ weaponCost: 500 }); // should be 625 at mul=1.25
  const result = stockMarkupDiff(baseProtoStore(), engineStore, 1.25);
  assert.notEqual(result, null);
  assert.match(result, /stock\[1\]\.cost/);
});

test("stockMarkupDiff: non-null when a name differs beyond the wp/hp normalization", () => {
  const engineStore = baseEngineStore();
  engineStore.stock[1].n = "Short Sword";
  const result = stockMarkupDiff(baseProtoStore(), engineStore, 1.25);
  assert.notEqual(result, null);
  assert.match(result, /stock\[1\]\.n/);
});

test("stockMarkupDiff: non-null when the stock lengths differ", () => {
  const protoStore = baseProtoStore();
  protoStore.stock.push({ n: "Sealed scroll", sub: null, cost: 900 });
  const result = stockMarkupDiff(protoStore, baseEngineStore(), 1.25);
  assert.notEqual(result, null);
  assert.match(result, /stock\.length/);
});

test("PRICEFOR_ROUTED_EFFECTS: names exactly the priceFor-routed openStore lines", () => {
  assert.deepStrictEqual(
    [...PRICEFOR_ROUTED_EFFECTS].sort(),
    ["buyArmor", "buyPremium", "buyRations", "buyWeapon", "repairArmor"].sort(),
  );
});
