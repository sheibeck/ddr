// test/unit/itemRowState.test.js
//
// Phase 39 (GEAR-02/GEAR-05), Plan 05 — direct unit coverage for
// src/browser/viewModels.js#itemRowState: the ONE row-state rule (READY /
// "{n} SQ" effect / "cd {n} SQ" cooldown / "{k}/{max} · {n} SQ" staff
// charges) shared by the Gear tab's worn/carried rows and the ITEMS
// submenu (combatMenu.js — mirrors the Phase 38 ability-row precedent:
// READY / N ROUNDS / ONCE A FIGHT · USED lives in exactly one place). Reads
// state.c.timers via engine/effects.js's remaining/isReady and the item's
// own activation via engine/derived.js#activationFor — NEVER it.usedAt/
// it.every (the retired counter-based staff/cooldown gate this plan
// finishes burying).

import test from "node:test";
import assert from "node:assert/strict";

import { itemRowState, ITEM_STATE_COPY } from "../../src/browser/viewModels.js";

function state(timers = {}) {
  return { c: { timers } };
}

test("ITEM_STATE_COPY carries the five row-state literals", () => {
  assert.deepEqual(ITEM_STATE_COPY, {
    ready: "READY",
    squares: "{n} SQ",
    square: "1 SQ",
    cooling: "cd {n} SQ",
    charges: "{k}/{max} · {n} SQ",
  });
});

test("a non-activatable item (no use, not a potion) — weapon, rope, ladder — reads kind:none, empty text", () => {
  const weapon = { n: "Club", kind: "weapon" };
  const rope = { n: "Rope", kind: "tool", tool: "rope" };
  const ladder = { n: "Ladder", kind: "tool", tool: "ladder" };
  for (const it of [weapon, rope, ladder]) {
    assert.deepEqual(itemRowState(state(), it), { text: "", kind: "none" });
  }
});

test("a potion and the torch (kind:tool with use) read kind:consumable, empty text", () => {
  const potion = { n: "Speed potion", kind: "potion", eff2: "speed" };
  const torch = { n: "Torch", kind: "tool", tool: "torch", use: "light" };
  assert.deepEqual(itemRowState(state(), potion), { text: "", kind: "consumable" });
  assert.deepEqual(itemRowState(state(), torch), { text: "", kind: "consumable" });
});

test("a cd item (duration+cooldown jewelry/cloak) with no c.timers record reads READY", () => {
  const cloak = { n: "Cloak of Speed", kind: "cloak", use: "haste" };
  assert.deepEqual(itemRowState(state(), cloak), { text: "READY", kind: "ready" });
});

test("a cd item mid-effect reads '{n} SQ'; singular '1 SQ' at exactly 1 remaining", () => {
  const cloak = { n: "Cloak of Speed", kind: "cloak", use: "haste" };
  const midEffect = state({ "item:Cloak of Speed": { cadence: "squares", left: 23, phase: "effect" } });
  assert.deepEqual(itemRowState(midEffect, cloak), { text: "23 SQ", kind: "effect", remaining: 23 });
  const oneLeft = state({ "item:Cloak of Speed": { cadence: "squares", left: 1, phase: "effect" } });
  assert.deepEqual(itemRowState(oneLeft, cloak), { text: "1 SQ", kind: "effect", remaining: 1 });
});

// 260918-wy1 (jewelry-merge): itemRowState reads only the ITEM and
// state.c.timers — never a worn KEY — so a live record started from a
// jewelry2 piece reads exactly like one started from jewelry1. One pin is
// enough (the function is shape-agnostic by construction; no code change
// was needed for the jewelry merge).
test("a worn jewelry2 piece reads the same row state as jewelry1 (itemRowState never addresses by worn key)", () => {
  const ring = { n: "Ring of Power", kind: "jewel", eff: { dmg: 1 } };
  const live = state({ "item:Ring of Power": { cadence: "squares", left: 50, cd: 50, phase: "effect" } });
  const fromJewelry1 = itemRowState({ c: { worn: { jewelry1: ring }, timers: live.c.timers } }, ring);
  const fromJewelry2 = itemRowState({ c: { worn: { jewelry2: ring }, timers: live.c.timers } }, ring);
  assert.deepEqual(fromJewelry1, fromJewelry2);
  assert.deepEqual(fromJewelry1, { text: "50 SQ", kind: "effect", remaining: 50 });
});

test("a cd item cooling reads 'cd {n} SQ'", () => {
  const cloak = { n: "Cloak of Speed", kind: "cloak", use: "haste" };
  const cooling = state({ "item:Cloak of Speed": { cadence: "squares", left: 41, phase: "cooldown" } });
  assert.deepEqual(itemRowState(cooling, cloak), { text: "cd 41 SQ", kind: "cooldown", remaining: 41 });
});

test("a staff at full charges with no recharge record reads READY", () => {
  const staff = { n: "Poplar Staff", kind: "staff", use: "heal", charges: 3 };
  assert.deepEqual(itemRowState(state(), staff), { text: "READY", kind: "ready" });
});

test("a staff missing its charges field entirely (a fresh/legacy item) reads READY (treated as full)", () => {
  const staff = { n: "Poplar Staff", kind: "staff", use: "heal" };
  assert.deepEqual(itemRowState(state(), staff), { text: "READY", kind: "ready" });
});

test("a recharging single-charge staff reads '{k}/{max} · {n} SQ' (k may be 0)", () => {
  const staff = { n: "Pine Staff", kind: "staff", use: "fire", charges: 0 };
  const st = state({ "charges:Pine Staff": { cadence: "squares", left: 94, phase: "cooldown" } });
  assert.deepEqual(itemRowState(st, staff), { text: "0/1 · 94 SQ", kind: "charges", remaining: 94 });
});

test("a recharging multi-charge staff with a partial pool reads its own current count", () => {
  const staff = { n: "Poplar Staff", kind: "staff", use: "heal", charges: 1 };
  const st = state({ "charges:Poplar Staff": { cadence: "squares", left: 17, phase: "cooldown" } });
  assert.deepEqual(itemRowState(st, staff), { text: "1/3 · 17 SQ", kind: "charges", remaining: 17 });
});

test("a legacy c with no c.timers map at all still reads READY for every cd/staff item — never throws", () => {
  const cloak = { n: "Cloak of Speed", kind: "cloak", use: "haste" };
  const staff = { n: "Poplar Staff", kind: "staff", use: "heal" };
  const legacy = { c: {} };
  assert.deepEqual(itemRowState(legacy, cloak), { text: "READY", kind: "ready" });
  assert.deepEqual(itemRowState(legacy, staff), { text: "READY", kind: "ready" });
});

test("never reads it.usedAt/it.every — a stale legacy field on the item is ignored entirely", () => {
  const cloak = { n: "Cloak of Speed", kind: "cloak", use: "haste", every: 50, usedAt: 0 };
  assert.deepEqual(itemRowState(state(), cloak), { text: "READY", kind: "ready" });
});
