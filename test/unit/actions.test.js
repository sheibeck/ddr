// test/unit/actions.test.js
//
// Phase 38 (ABIL-01/04) — dedicated validateAction pins for the new
// `useAbility { key }` action type, mirroring engine-purity.test.js's own
// castSpell.idx/useItem.i non-negative-integer pin style (this file did not
// exist before this plan; every action-shape pin previously lived inline in
// engine-purity.test.js — this file is the new home for useAbility's own
// wire-shape pins so they are easy to find alongside engine/abilities.js).

import test from "node:test";
import assert from "node:assert/strict";

import { ACTION_TYPES, validateAction } from "../../engine/actions.js";

test("ACTION_TYPES includes useAbility", () => {
  assert.ok(ACTION_TYPES.has("useAbility"));
});

test("validateAction rejects a useAbility with no key / a non-string key / an empty key", () => {
  assert.equal(validateAction({ type: "useAbility" }).ok, false);
  assert.equal(validateAction({ type: "useAbility" }).reason, "useAbility.key must be a non-empty string");
  assert.equal(validateAction({ type: "useAbility", key: "" }).ok, false);
  assert.equal(validateAction({ type: "useAbility", key: 5 }).ok, false);
  assert.equal(validateAction({ type: "useAbility", key: null }).ok, false);
});

test("validateAction accepts a useAbility with any non-empty string key (catalog membership is an engine refusal, not a validation failure)", () => {
  assert.equal(validateAction({ type: "useAbility", key: "kata" }).ok, true);
  // An unknown id still validates — useAbility itself yields a named
  // abilityRefused { reason: "unknown" } event, never a validation failure.
  assert.equal(validateAction({ type: "useAbility", key: "not-a-real-ability" }).ok, true);
});

// --- Phase 39 (GEAR-05): useTool { tool, dir } ------------------------------

test("ACTION_TYPES includes useTool", () => {
  assert.ok(ACTION_TYPES.has("useTool"));
});

test("validateAction accepts useTool with tool ladder or rope and a cardinal dir", () => {
  assert.equal(validateAction({ type: "useTool", tool: "ladder", dir: "N" }).ok, true);
  assert.equal(validateAction({ type: "useTool", tool: "rope", dir: "S" }).ok, true);
});

test("validateAction rejects useTool.tool that is not ladder/rope (including torch — it is a useItem activatable, not a movement tool)", () => {
  const torch = validateAction({ type: "useTool", tool: "torch", dir: "N" });
  assert.equal(torch.ok, false);
  assert.equal(torch.reason, "useTool.tool must be ladder or rope");
  assert.equal(validateAction({ type: "useTool", tool: "pickaxe", dir: "N" }).ok, false);
  assert.equal(validateAction({ type: "useTool", dir: "N" }).ok, false);
});

test("validateAction rejects a bad useTool.dir", () => {
  assert.equal(validateAction({ type: "useTool", tool: "ladder", dir: "NE" }).ok, false);
  assert.equal(validateAction({ type: "useTool", tool: "ladder" }).ok, false);
});

// --- RULES-10 (Phase 75.1): loseTurn (no payload) ---------------------------

test("ACTION_TYPES includes loseTurn", () => {
  assert.ok(ACTION_TYPES.has("loseTurn"));
});

test("validateAction accepts a bare loseTurn action (no payload, like fight)", () => {
  assert.equal(validateAction({ type: "loseTurn" }).ok, true);
});
