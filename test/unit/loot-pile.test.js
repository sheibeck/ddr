// test/unit/loot-pile.test.js
//
// Phase 29 LOOT-01/02/05/06 — the pending pile. Turns the mid-fight
// auto-take into a real end-of-combat decision: state.pendingLoot (a
// serialized sibling of pendingFind), the five pure handlers
// (offerLoot/takeLoot/leaveLoot/takeAllLoot/leaveAllLoot), killFoe's
// redirect + the ONE guarded LOOT-05 bag draw, the forfeit rule on
// flee/death, and the reconcilePendingLoot parity carve-out. Mirrors
// test/unit/inventory-actions.test.js's fixedChar/fixedState shape and
// test/unit/combat.test.js's fakeRng/fixedFoe/fixedCombat shape, since this
// file spans both the inventory and combat domains (Task 1 below covers the
// pure pile/handler/serialization slice; Task 2 and Task 3 sections are
// appended by their own plan tasks).

import test from "node:test";
import assert from "node:assert/strict";

import { offerLoot, takeLoot, leaveLoot, takeAllLoot, leaveAllLoot } from "../../engine/items.js";
import { newRun } from "../../engine/engine.js";
import { serializeRun, validateSave, rehydrate } from "../../engine/saveState.js";
import { BAG_ITEMS } from "../../content/bags.js";

// --- fixed character/state helpers (mirrors inventory-actions.test.js) -----

function fixedChar(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1,
    weapon: "Broadsword", prof: 0, magicWpn: 0, // WEAPON_MAX Broadsword = 12
    armor: "Leather", ar: 6, armorMin: 1, armorWP: 15, armorMax: 15, patches: 0,
    skills: {}, gold: 50, rations: 6, scrolls: 0, maxWP: 55, wp: 40,
    bag: "small", // 4 slots
    items: [],
    ...overrides,
  };
}

function fixedState(overrides = {}) {
  const { c: cOverrides, ...rest } = overrides;
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedChar(cOverrides),
    floor: { depth: 1 },
    day: 1, steps: 0, combat: null, store: null, beats: null,
    party: [], pendingJoiner: null, pendingFind: null, pendingLoot: [],
    dead: false, won: false,
    ...rest,
  };
}

const WEAPON = (base, bonus = 0) => ({ kind: "weapon", n: base, base, bonus, txt: base });
const ARMOR = (name, ar, cls = "FTM", extra = {}) => ({ kind: "armor", n: name, armor: name, ar, wp: 20, min: 1, cls, txt: `AR ${ar}`, ...extra });
const JEWEL = (n) => ({ kind: "jewel", n, txt: n });
const POTION = (n) => ({ kind: "potion", n, txt: n });
const BAG = (tier) => ({ ...BAG_ITEMS[tier] });

// ============================================================================
// Task 1: pendingLoot model + serialization + the four pure handlers
// ============================================================================

test("newRun seeds a top-level pendingLoot: [] (sibling of pendingFind)", () => {
  const state = newRun(1);
  assert.deepStrictEqual(state.pendingLoot, []);
  assert.ok("pendingLoot" in state, "pendingLoot must be a real top-level field");
});

test("LOOT-06: serializeRun -> validateSave -> rehydrate keeps a 3-item pile in order and idempotently", () => {
  const state = newRun(1);
  state.pendingLoot = [JEWEL("A"), JEWEL("B"), WEAPON("Dagger")];
  const saved = serializeRun(state);
  const check = validateSave(JSON.stringify(saved));
  assert.equal(check.ok, true);
  const rehydrated = rehydrate(check.value);
  assert.deepStrictEqual(rehydrated.pendingLoot, [JEWEL("A"), JEWEL("B"), WEAPON("Dagger")]);

  const again = rehydrate(validateSave(JSON.stringify(serializeRun(rehydrated))).value);
  assert.deepStrictEqual(again.pendingLoot, rehydrated.pendingLoot, "idempotent double round-trip");
});

test("validateSave: no pendingLoot key -> []; tampered values degrade to []; malformed entries dropped", () => {
  const validChar = { wp: 10, maxWP: 10, level: 1, skills: {} };
  const validFloor = { g: [[{ wall: false }]], px: 0, py: 0, depth: 1 };
  const noKey = validateSave(JSON.stringify({ c: validChar, floor: validFloor }));
  assert.deepStrictEqual(noKey.value.pendingLoot, []);
  assert.deepStrictEqual(rehydrate(noKey.value).pendingLoot, []);

  for (const bad of ["x", 42, {}]) {
    const check = validateSave(JSON.stringify({ c: validChar, floor: validFloor, pendingLoot: bad }));
    assert.deepStrictEqual(check.value.pendingLoot, []);
  }

  const withJunk = validateSave(
    JSON.stringify({ c: validChar, floor: validFloor, pendingLoot: [null, 1, { kind: "jewel", n: "A" }] }),
  );
  assert.deepStrictEqual(withJunk.value.pendingLoot, [{ kind: "jewel", n: "A" }]);
});

test("the existing pendingFind-is-reset assertions still pass alongside pendingLoot", () => {
  const state = newRun(1);
  state.pendingFind = { kind: "cloak", n: "Cloak of Testing" };
  state.pendingLoot = [JEWEL("A")];
  const rehydrated = rehydrate(validateSave(JSON.stringify(serializeRun(state))).value);
  assert.equal(rehydrated.pendingFind, null, "pendingFind is still reset to null on rehydrate");
  assert.deepStrictEqual(rehydrated.pendingLoot, [JEWEL("A")], "pendingLoot survives, unlike pendingFind");
});

test("offerLoot: appends to pendingLoot, pushes lootDropped, never touches c.items", () => {
  const state = fixedState();
  const events = offerLoot(state, JEWEL("Bracelet"), []);
  assert.deepStrictEqual(state.pendingLoot, [JEWEL("Bracelet")]);
  assert.deepStrictEqual(state.c.items, []);
  assert.deepStrictEqual(events, [{ type: "lootDropped", name: "Bracelet", kind: "jewel" }]);
});

test("offerLoot: creates the array when the hand-built state lacks it", () => {
  const state = fixedState();
  delete state.pendingLoot;
  offerLoot(state, JEWEL("X"), []);
  assert.deepStrictEqual(state.pendingLoot, [JEWEL("X")]);
});

test("takeLoot: stows pile[0], splices it, pushes lootTaken", () => {
  const state = fixedState({ pendingLoot: [JEWEL("Ring")] });
  const events = takeLoot(state, 0, false, []);
  assert.deepStrictEqual(state.pendingLoot, []);
  assert.deepStrictEqual(state.c.items, [JEWEL("Ring")]);
  assert.ok(events.some((e) => e.type === "lootTaken" && e.item.n === "Ring"));
});

test("takeLoot: at cap, pushes bagFull, pile unchanged, no lootTaken", () => {
  const filler = [JEWEL("1"), JEWEL("2"), JEWEL("3"), JEWEL("4")]; // small bag cap 4
  const state = fixedState({ c: { items: filler }, pendingLoot: [JEWEL("5")] });
  const events = takeLoot(state, 0, false, []);
  assert.deepStrictEqual(state.pendingLoot, [JEWEL("5")]);
  assert.deepStrictEqual(state.c.items, filler);
  assert.ok(events.some((e) => e.type === "bagFull" && e.have === 4 && e.slots === 4));
  assert.ok(!events.some((e) => e.type === "lootTaken"));
});

test("takeLoot equip:true — legal weapon, worn Broadsword, free slot: direct swap + displaced piece stowed", () => {
  const state = fixedState({ pendingLoot: [WEAPON("Long Sword", 1)] });
  const events = takeLoot(state, 0, true, []);
  assert.equal(state.c.weapon, "Long Sword");
  assert.equal(state.c.prof, 0);
  assert.equal(state.c.magicWpn, 1);
  assert.deepStrictEqual(state.pendingLoot, []);
  assert.equal(state.c.items.length, 1, "the displaced Broadsword lands in the bag");
  assert.equal(state.c.items[0].base, "Broadsword");
  assert.ok(events.some((e) => e.type === "itemEquipped" && e.slot === "weapon"));
  assert.ok(!events.some((e) => e.type === "lootTaken"));
});

test("takeLoot equip:true — weapon, bare-handed (Fists) and FULL bag: equips, c.items unchanged, no slot needed", () => {
  const filler = [JEWEL("1"), JEWEL("2"), JEWEL("3"), JEWEL("4")];
  const state = fixedState({ c: { weapon: "Fists", items: filler }, pendingLoot: [WEAPON("Dagger")] });
  const events = takeLoot(state, 0, true, []);
  assert.equal(state.c.weapon, "Dagger");
  assert.deepStrictEqual(state.c.items, filler, "no slot needed — Fists has no bag copy");
  assert.ok(events.some((e) => e.type === "itemEquipped"));
});

test("takeLoot equip:true — weapon, worn weapon present, FULL bag: bagFull, nothing changes", () => {
  const filler = [JEWEL("1"), JEWEL("2"), JEWEL("3"), JEWEL("4")];
  const state = fixedState({ c: { items: filler }, pendingLoot: [WEAPON("Long Sword", 1)] });
  const before = JSON.parse(JSON.stringify({ c: state.c, pendingLoot: state.pendingLoot }));
  const events = takeLoot(state, 0, true, []);
  assert.deepStrictEqual(state.c, before.c);
  assert.deepStrictEqual(state.pendingLoot, before.pendingLoot);
  assert.ok(events.some((e) => e.type === "bagFull" && e.item.base === "Broadsword"));
});

test("takeLoot equip:true — class-illegal weapon (Magic User + Broadsword): equipRejected wrongClass", () => {
  const state = fixedState({ c: { cls: "Magic User" }, pendingLoot: [WEAPON("Broadsword")] });
  const events = takeLoot(state, 0, true, []);
  assert.deepStrictEqual(state.pendingLoot, [WEAPON("Broadsword")]);
  assert.ok(events.some((e) => e.type === "equipRejected" && e.reason === "wrongClass"));
});

test("takeLoot equip:true — armor: direct swap, displaced piece carries left/patches (Phase 28)", () => {
  const state = fixedState({ pendingLoot: [ARMOR("Plate", 15, "FTM", { min: 2 })] });
  const events = takeLoot(state, 0, true, []);
  assert.equal(state.c.armor, "Plate");
  assert.equal(state.c.ar, 15);
  assert.equal(state.c.armorMin, 2);
  assert.equal(state.c.armorMax, 20);
  assert.equal(state.c.armorWP, 20);
  assert.equal(state.c.patches, 0);
  assert.equal(state.c.items.length, 1, "the displaced Leather lands in the bag");
  assert.equal(state.c.items[0].armor, "Leather");
  assert.equal(state.c.items[0].left, 15, "the displaced piece keeps its remaining durability");
  assert.ok(events.some((e) => e.type === "itemEquipped" && e.slot === "armor"));
});

test("takeLoot equip:true — armor with a DESTROYED worn piece: no bag copy, no slot needed", () => {
  const state = fixedState({ c: { armorWP: 0 }, pendingLoot: [ARMOR("Plate", 15, "FTM", { min: 2 })] });
  const events = takeLoot(state, 0, true, []);
  assert.equal(state.c.armor, "Plate");
  assert.deepStrictEqual(state.c.items, [], "destroyed worn piece leaves no bag copy");
  assert.ok(events.some((e) => e.type === "itemEquipped"));
});

test("takeLoot equip:true — a jewel: equipRejected notEquippable, pile unchanged", () => {
  const state = fixedState({ pendingLoot: [JEWEL("Ring")] });
  const events = takeLoot(state, 0, true, []);
  assert.deepStrictEqual(state.pendingLoot, [JEWEL("Ring")]);
  assert.deepStrictEqual(events, [{ type: "equipRejected", item: JEWEL("Ring"), reason: "notEquippable" }]);
});

test("takeLoot: out-of-range index is a no-op", () => {
  const state = fixedState({ pendingLoot: [JEWEL("A")] });
  const events = takeLoot(state, 5, false, []);
  assert.deepStrictEqual(events, []);
  assert.deepStrictEqual(state.pendingLoot, [JEWEL("A")]);
});

test("leaveLoot: splices only index i, pushes lootLeft; out-of-range is a no-op", () => {
  const state = fixedState({ pendingLoot: [JEWEL("A"), JEWEL("B"), JEWEL("B2")] });
  const events = leaveLoot(state, 1, []);
  assert.deepStrictEqual(state.pendingLoot, [JEWEL("A"), JEWEL("B2")]);
  assert.deepStrictEqual(events, [{ type: "lootLeft", item: JEWEL("B") }]);

  const noop = leaveLoot(state, 9, []);
  assert.deepStrictEqual(noop, []);
});

test("takeAllLoot: takes what fits in order, ONE bagFull for the remainder, nothing lost", () => {
  const gearA = ARMOR("Studded Leather", 8);
  const gearB = ARMOR("Chain", 9);
  const potion = POTION("Acuteness");
  const gearC = ARMOR("Mail", 10);
  // 3 filler items already in a small (4-slot) bag -> exactly ONE free slot.
  const filler = [JEWEL("1"), JEWEL("2"), JEWEL("3")];
  const expectedItems = [...filler, gearA, potion]; // snapshot BEFORE the call — c.items aliases filler below
  const state = fixedState({ c: { items: [...filler] }, pendingLoot: [gearA, gearB, potion, gearC] });
  const events = takeAllLoot(state, []);
  assert.deepStrictEqual(state.pendingLoot, [gearB, gearC]);
  assert.deepStrictEqual(state.c.items, expectedItems);
  const types = events.map((e) => e.type);
  assert.equal(types.filter((t) => t === "bagFull").length, 1, "exactly one bagFull");
  assert.deepStrictEqual(types, ["lootTaken", "bagFull", "lootTaken"]);
});

test("takeAllLoot: a bag upgrade is taken first, freeing room for gear behind it", () => {
  const filler = [JEWEL("1"), JEWEL("2"), JEWEL("3"), JEWEL("4")]; // small bag, full
  const gearA = ARMOR("Studded Leather", 8);
  const expectedItems = [...filler, gearA]; // snapshot BEFORE the call — c.items aliases filler below
  const state = fixedState({ c: { items: [...filler] }, pendingLoot: [BAG("medium"), gearA] });
  const events = takeAllLoot(state, []);
  assert.deepStrictEqual(state.pendingLoot, []);
  assert.equal(state.c.bag, "medium");
  assert.deepStrictEqual(state.c.items, expectedItems);
  const types = events.map((e) => e.type);
  assert.equal(types.filter((t) => t === "lootTaken").length, 2);
  assert.ok(types.includes("bagUpgraded"));
});

test("takeAllLoot on []: no events; leaveAllLoot on [A, B]: pile [], events in order; leaveAllLoot on []: no events", () => {
  const empty = fixedState({ pendingLoot: [] });
  assert.deepStrictEqual(takeAllLoot(empty, []), []);

  const state = fixedState({ pendingLoot: [JEWEL("A"), JEWEL("B")] });
  const events = leaveAllLoot(state, []);
  assert.deepStrictEqual(state.pendingLoot, []);
  assert.deepStrictEqual(events, [
    { type: "lootLeft", item: JEWEL("A") },
    { type: "lootLeft", item: JEWEL("B") },
  ]);

  assert.deepStrictEqual(leaveAllLoot(fixedState({ pendingLoot: [] }), []), []);
});

test("none of the five handlers accepts an rng argument", () => {
  // Function.length only counts params before the first default value — every
  // handler's LAST real parameter is `events = []`, so each arity below is one
  // less than its total declared parameter count (state[, i][, equip], events).
  assert.equal(offerLoot.length, 2, "offerLoot(state, it, events=[])");
  assert.equal(takeLoot.length, 2, "takeLoot(state, i, equip=false, events=[])");
  assert.equal(leaveLoot.length, 2, "leaveLoot(state, i, events=[])");
  assert.equal(takeAllLoot.length, 1, "takeAllLoot(state, events=[])");
  assert.equal(leaveAllLoot.length, 1, "leaveAllLoot(state, events=[])");
});
