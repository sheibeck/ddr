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

// --- Phase 78 (CLIMB-01/02): resolveHazard { cross } -------------------------

test("CLIMB-01: ACTION_TYPES includes resolveHazard", () => {
  assert.ok(ACTION_TYPES.has("resolveHazard"));
});

test("CLIMB-01: validateAction accepts resolveHazard with a boolean cross (commit or TURN BACK)", () => {
  assert.equal(validateAction({ type: "resolveHazard", cross: true }).ok, true);
  assert.equal(validateAction({ type: "resolveHazard", cross: false }).ok, true);
});

test("CLIMB-01: validateAction rejects a missing, string or numeric resolveHazard.cross", () => {
  for (const bad of [{ type: "resolveHazard" }, { type: "resolveHazard", cross: "true" }, { type: "resolveHazard", cross: 0 }]) {
    const r = validateAction(bad);
    assert.equal(r.ok, false, JSON.stringify(bad));
    assert.equal(r.reason, "resolveHazard.cross must be a boolean");
  }
});

// --- Phase 91 (IDENT-14): teleportPick { x, y } | { auto: true } -------------

test("IDENT-14: ACTION_TYPES includes teleportPick", () => {
  assert.ok(ACTION_TYPES.has("teleportPick"));
});

test("IDENT-14: validateAction accepts a pick on finite coordinates (the engine refuses non-integers by name) or LET IT CHOOSE", () => {
  assert.equal(validateAction({ type: "teleportPick", x: 8, y: 10 }).ok, true);
  assert.equal(validateAction({ type: "teleportPick", x: 8.5, y: 10 }).ok, true);
  assert.equal(validateAction({ type: "teleportPick", auto: true }).ok, true);
});

test("IDENT-14: validateAction rejects a bare pick, string or NaN coordinates, and a non-true auto", () => {
  for (const bad of [
    { type: "teleportPick" },
    { type: "teleportPick", x: "8", y: 10 },
    { type: "teleportPick", x: 8 },
    { type: "teleportPick", x: NaN, y: 10 },
    { type: "teleportPick", x: Infinity, y: 10 },
    { type: "teleportPick", auto: 1 },
    { type: "teleportPick", auto: false },
  ]) {
    assert.equal(validateAction(bad).ok, false, JSON.stringify(bad));
  }
});

// --- RULES-10 (Phase 75.1): loseTurn (no payload) ---------------------------

test("ACTION_TYPES includes loseTurn", () => {
  assert.ok(ACTION_TYPES.has("loseTurn"));
});

test("validateAction accepts a bare loseTurn action (no payload, like fight)", () => {
  assert.equal(validateAction({ type: "loseTurn" }).ok, true);
});
