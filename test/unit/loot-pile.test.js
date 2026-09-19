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
import fs from "node:fs";

import { offerLoot, takeLoot, leaveLoot, takeAllLoot, leaveAllLoot } from "../../engine/items.js";
import { newRun, applyAction } from "../../engine/engine.js";
import { validateAction } from "../../engine/actions.js";
import { serializeRun, validateSave, rehydrate } from "../../engine/saveState.js";
import { killFoe, flee } from "../../engine/combat.js";
import { die, forfeitLoot } from "../../engine/death.js";
import { BAG_ITEMS } from "../../content/bags.js";
import { movementComparable, combatComparable, economyComparable } from "../parity/harness/comparables.js";
import { diffState } from "../parity/harness/diffState.js";

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

// ============================================================================
// Task 2: dispatch/validation, killFoe redirect + guarded bag draw, forfeit
// ============================================================================

// --- combat-domain helpers (mirrors combat.test.js) -------------------------

/** countingRng(seq) — like combat.test.js's fakeRng, but also records how
 * many draws were consumed (`.calls`), so killFoe's draw-count pinning tests
 * can assert exactly how many values were read regardless of which branch
 * fired. `.pick` returns arr[0]; `.shuffle` is identity. */
function countingRng(seq) {
  let i = 0;
  return {
    calls: 0,
    d(_sides) {
      if (i >= seq.length) throw new Error(`countingRng: sequence exhausted at index ${i}`);
      this.calls++;
      return seq[i++];
    },
    pick: (arr) => arr[0],
    shuffle: (a) => a,
  };
}

function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
    maxWP: 55, wp: 55, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 1, rations: 6, gold: 50, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    darkFor: 0, flightLeft: 0, flightCooldown: 0,
    bag: "small",
    ...overrides,
  };
}

function fixedFloor(depth = 1, overrides = {}) {
  const g = [];
  for (let y = 0; y < 3; y++) {
    g.push([]);
    for (let x = 0; x < 3; x++) g[y].push({ wall: false, dark: false, seen: true, feat: null });
  }
  return { g, px: 1, py: 1, depth, ...overrides };
}

function fixedCombatState(overrides = {}) {
  const { c: cOverrides, floor: floorOverrides, ...rest } = overrides;
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedFighter(cOverrides),
    floor: fixedFloor(1, floorOverrides),
    day: 1, steps: 0, combat: null, store: null, beats: null,
    pendingLoot: [], dead: false, won: false, deathNote: "", epitaph: "",
    ...rest,
  };
}

function fixedFoe(overrides = {}) {
  return {
    name: "Target", type: "Beasts", lvl: 1, size: "S", intel: 1,
    wp: 10, maxWP: 10, alive: true, asleep: 0, sp: {}, lives: 1,
    ...overrides,
  };
}

function fixedCombat(foes, overrides = {}) {
  return { foes, type: foes[0]?.type || "Beasts", round: 1, target: 0, spellOpen: false, tracked: false, ...overrides };
}

test("validateAction: takeLoot/leaveLoot/takeAllLoot/leaveAllLoot contracts", () => {
  assert.equal(validateAction({ type: "takeLoot", i: 0 }).ok, true);
  assert.equal(validateAction({ type: "takeLoot", i: -1 }).ok, false);
  assert.equal(validateAction({ type: "takeLoot", i: "0" }).ok, false);
  assert.equal(validateAction({ type: "takeLoot" }).ok, false);
  assert.equal(validateAction({ type: "takeLoot", i: 0, equip: true }).ok, true);
  assert.equal(validateAction({ type: "takeLoot", i: 0, equip: "yes" }).ok, false);
  assert.equal(validateAction({ type: "leaveLoot", i: 2 }).ok, true);
  assert.equal(validateAction({ type: "leaveLoot" }).ok, false);
  assert.equal(validateAction({ type: "takeAllLoot" }).ok, true);
  assert.equal(validateAction({ type: "leaveAllLoot" }).ok, true);
});

test("applyAction: dispatches takeLoot/leaveLoot/takeAllLoot/leaveAllLoot and clones state", () => {
  let state = newRun(7);
  state.pendingLoot = [WEAPON("Dagger", 1)];

  const r1 = applyAction(state, { type: "takeLoot", i: 0 });
  assert.notEqual(r1.state, state, "returns a NEW state");
  assert.equal(r1.state.pendingLoot.length, 0);
  assert.ok(r1.events.some((e) => e.type === "lootTaken"));

  state = newRun(7);
  state.pendingLoot = [WEAPON("Dagger", 1)];
  const r2 = applyAction(state, { type: "takeLoot", i: 0, equip: true });
  assert.ok(r2.events.some((e) => e.type === "itemEquipped"));

  state = newRun(7);
  state.pendingLoot = [JEWEL("A"), JEWEL("B")];
  const r3 = applyAction(state, { type: "leaveLoot", i: 0 });
  assert.deepStrictEqual(r3.state.pendingLoot, [JEWEL("B")]);
  assert.ok(r3.events.some((e) => e.type === "lootLeft"));

  state = newRun(7);
  state.pendingLoot = [JEWEL("A")];
  const r4 = applyAction(state, { type: "takeAllLoot" });
  assert.ok(r4.events.some((e) => e.type === "lootTaken"));

  state = newRun(7);
  state.pendingLoot = [JEWEL("A")];
  const r5 = applyAction(state, { type: "leaveAllLoot" });
  assert.deepStrictEqual(r5.state.pendingLoot, []);
  assert.ok(r5.events.some((e) => e.type === "lootLeft"));
});

test("killFoe: depth 1, small bag — draws exactly 6, pushes a jewel to pendingLoot, no auto-take", () => {
  const state = fixedCombatState({ floor: { depth: 1 } });
  const foe = fixedFoe({ type: "Humans", lvl: 1, wp: 0 }); // Humans never cook
  state.combat = fixedCombat([foe]);
  const rng = countingRng([1, 1, 1, 5, 6, 1]); // sp d6, coin d10, treasure gate d20<=3, picks d12!=1, kind d10->jewel, jewel d8
  const events = killFoe(state, foe, rng, []);
  assert.equal(rng.calls, 6);
  assert.equal(state.pendingLoot.length, 1);
  assert.equal(state.pendingLoot[0].kind, "jewel");
  assert.ok(events.some((e) => e.type === "lootDropped" && e.kind === "jewel"));
  assert.ok(events.some((e) => e.type === "foeKilled"));
  assert.ok(!events.some((e) => ["itemTaken", "itemRejected", "itemGiven"].includes(e.type)));
  assert.deepStrictEqual(state.c.items, []);
  assert.equal(state.c.sp, 5);
});

test("killFoe: depth 2, small bag — draws exactly 7; a low 7th roll swaps in a bag item instead of the jewel", () => {
  const state = fixedCombatState({ floor: { depth: 2 } });
  const foe = fixedFoe({ type: "Humans", lvl: 1, wp: 0 });
  state.combat = fixedCombat([foe]);
  const rng = countingRng([1, 1, 1, 5, 6, 1, 1]); // + bag-swap d20 <= BAG_DROP_UNDER
  killFoe(state, foe, rng, []);
  assert.equal(rng.calls, 7);
  assert.equal(state.pendingLoot.length, 1);
  assert.equal(state.pendingLoot[0].kind, "bag");
  assert.equal(state.pendingLoot[0].tier, "medium");
});

test("killFoe: depth 2, small bag — a high 7th roll keeps the jewel", () => {
  const state = fixedCombatState({ floor: { depth: 2 } });
  const foe = fixedFoe({ type: "Humans", lvl: 1, wp: 0 });
  state.combat = fixedCombat([foe]);
  const rng = countingRng([1, 1, 1, 5, 6, 1, 20]);
  killFoe(state, foe, rng, []);
  assert.equal(state.pendingLoot.length, 1);
  assert.equal(state.pendingLoot[0].kind, "jewel");
});

test("killFoe: no bag-swap draw when no upgrade is available (exlarge bag, existing bag pending, or below floor)", () => {
  // depth 2, exlarge bag (no next tier)
  let state = fixedCombatState({ c: { bag: "exlarge" }, floor: { depth: 2 } });
  let foe = fixedFoe({ type: "Humans", lvl: 1, wp: 0 });
  state.combat = fixedCombat([foe]);
  let rng = countingRng([1, 1, 1, 5, 6, 1]);
  killFoe(state, foe, rng, []);
  assert.equal(rng.calls, 6);

  // depth 2, a bag item already pending
  state = fixedCombatState({ floor: { depth: 2 }, pendingLoot: [BAG("medium")] });
  foe = fixedFoe({ type: "Humans", lvl: 1, wp: 0 });
  state.combat = fixedCombat([foe]);
  rng = countingRng([1, 1, 1, 5, 6, 1]);
  killFoe(state, foe, rng, []);
  assert.equal(rng.calls, 6);

  // depth 4, medium bag (large needs floor 5)
  state = fixedCombatState({ c: { bag: "medium" }, floor: { depth: 4 } });
  foe = fixedFoe({ type: "Humans", lvl: 1, wp: 0 });
  state.combat = fixedCombat([foe]);
  rng = countingRng([1, 1, 1, 5, 6, 1]);
  killFoe(state, foe, rng, []);
  assert.equal(rng.calls, 6);
});

test("killFoe: depth 5, medium bag — draws exactly 7 (large tier now available)", () => {
  const state = fixedCombatState({ c: { bag: "medium" }, floor: { depth: 5 } });
  const foe = fixedFoe({ type: "Humans", lvl: 1, wp: 0 });
  state.combat = fixedCombat([foe]);
  const rng = countingRng([1, 1, 1, 5, 6, 1, 20]);
  killFoe(state, foe, rng, []);
  assert.equal(rng.calls, 7);
});

test("killFoe: a Beasts foe at depth 1 still draws its cooking d6 AFTER the treasure block", () => {
  const state = fixedCombatState({ c: { skills: {} } });
  const foe = fixedFoe({ type: "Beasts", lvl: 1, wp: 0 });
  state.combat = fixedCombat([foe]);
  const rng = countingRng([1, 1, 1, 5, 6, 1, 6]); // + cooking d6
  killFoe(state, foe, rng, []);
  assert.equal(rng.calls, 7);
});

test("killFoe never calls the legacy auto-take (source assertion)", () => {
  const src = fs.readFileSync(new URL("../../engine/combat.js", import.meta.url), "utf8");
  const stripped = src.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(!stripped.includes("takeItem("), "combat.js must not call the legacy auto-take");
});

test("flee: a Cloaker with a pile forfeits before fled, in order; empty pile emits no lootForfeited", () => {
  const state = fixedCombatState({ c: { sub: "Cloaker" }, pendingLoot: [JEWEL("A"), JEWEL("B")] });
  state.combat = fixedCombat([fixedFoe({ sp: {} })], { opened2: false });
  const events = flee(state, countingRng([]), []);
  assert.deepStrictEqual(
    events.map((e) => e.type),
    ["lootForfeited", "fled", "combatEnded"],
  );
  assert.deepStrictEqual(state.pendingLoot, []);

  const state2 = fixedCombatState({ c: { sub: "Cloaker" }, pendingLoot: [] });
  state2.combat = fixedCombat([fixedFoe({ sp: {} })], { opened2: false });
  const events2 = flee(state2, countingRng([]), []);
  assert.ok(!events2.some((e) => e.type === "lootForfeited"));
});

test("flee: tracked round-1 withdrawal forfeits before fled", () => {
  const state = fixedCombatState({ pendingLoot: [JEWEL("A")] });
  state.combat = fixedCombat([fixedFoe({ sp: {} })], { tracked: true, round: 1 });
  const events = flee(state, countingRng([]), []);
  assert.deepStrictEqual(
    events.map((e) => e.type),
    ["lootForfeited", "fled", "combatEnded"],
  );
});

test("flee: an ordinary successful escape forfeits before fled", () => {
  const state = fixedCombatState({ pendingLoot: [JEWEL("A")] });
  state.combat = fixedCombat([fixedFoe({ sp: {} })]);
  const events = flee(state, countingRng([20]), []); // d20=20 -> escaped
  assert.deepStrictEqual(
    events.map((e) => e.type),
    ["fleeRolled", "lootForfeited", "fled", "combatEnded"],
  );
});

test("flee: a FAILED flee roll does NOT forfeit", () => {
  const state = fixedCombatState({ pendingLoot: [JEWEL("A")] });
  state.combat = fixedCombat([fixedFoe({ wp: 10, maxWP: 10, sp: {} })]);
  const events = flee(state, countingRng([1, 6, 15]), []); // d20=1 fails, then a foeTurn
  assert.ok(!events.some((e) => e.type === "lootForfeited"));
  assert.deepStrictEqual(state.pendingLoot, [JEWEL("A")]);
});

test("die: forfeits a pending pile with ONE lootForfeited BEFORE died; empty pile is silent; no key added when absent", () => {
  const state = fixedCombatState({ pendingLoot: [JEWEL("A"), JEWEL("B")] });
  const events = [];
  die(state, "starve", null, countingRng([1]), events);
  assert.deepStrictEqual(state.pendingLoot, []);
  const types = events.map((e) => e.type);
  assert.equal(types.indexOf("lootForfeited"), 0, "forfeit comes before died");
  assert.ok(types.includes("died"));

  const state2 = fixedCombatState({ pendingLoot: [] });
  const events2 = [];
  die(state2, "starve", null, countingRng([1]), events2);
  assert.ok(!events2.some((e) => e.type === "lootForfeited"));

  const state3 = fixedCombatState();
  delete state3.pendingLoot;
  const keysBefore = Object.keys(state3);
  const events3 = [];
  die(state3, "starve", null, countingRng([1]), events3);
  const newKeys = Object.keys(state3).filter((k) => !keysBefore.includes(k));
  assert.ok(!newKeys.includes("pendingLoot"), "die() must not add a pendingLoot key to a state that lacks one");
});

test("forfeitLoot is exported from engine/death.js and returns events", () => {
  const state = fixedCombatState({ pendingLoot: [JEWEL("A")] });
  const events = forfeitLoot(state, "fled", []);
  assert.deepStrictEqual(state.pendingLoot, []);
  assert.deepStrictEqual(events, [{ type: "lootForfeited", items: [JEWEL("A")], reason: "fled" }]);
});

// ============================================================================
// Task 3: reconcilePendingLoot carve-out
// ============================================================================

test("reconcilePendingLoot: a pendingLoot jewel compares equal to the same jewel already given, in all three comparables", () => {
  const s1 = newRun(3);
  s1.pendingLoot = [JEWEL("Bracelet of Flight")];
  const s2 = newRun(3);
  // Phase 45 (HEDGE-01): newRun(3)'s Thief already carries c.worn (cloak
  // worn, jewelry1/jewelry2 free) — the real takeItem reconcilePendingLoot
  // calls now auto-wears a jewel into the first free jewelry key (see
  // engine/items.js#autoWearSlot, gated on `"worn" in c`), so "already
  // given" means worn, not bagged.
  s2.c.worn.jewelry1 = JEWEL("Bracelet of Flight");

  assert.equal(diffState(movementComparable(s1), movementComparable(s2)), null);
  assert.equal(diffState(combatComparable(s1), combatComparable(s2)), null);
  assert.equal(diffState(economyComparable(s1), economyComparable(s2)), null);
});

test("reconcilePendingLoot: a two-item pile applies in order", () => {
  const s1 = newRun(3);
  s1.pendingLoot = [JEWEL("A"), JEWEL("B")];
  const s2 = newRun(3);
  // Phase 45 (HEDGE-01): both jewels auto-wear in order — jewelry1 then
  // jewelry2 — since newRun(3)'s jewelry keys start free (see the comment
  // above).
  s2.c.worn.jewelry1 = JEWEL("A");
  s2.c.worn.jewelry2 = JEWEL("B");

  assert.equal(diffState(combatComparable(s1), combatComparable(s2)), null);
});

test("reconcilePendingLoot: a kind:'bag' pile entry is ignored (no prototype equivalent)", () => {
  const s1 = newRun(3);
  s1.pendingLoot = [BAG("medium")];
  const s2 = newRun(3);

  assert.equal(diffState(combatComparable(s1), combatComparable(s2)), null);
});

test("reconcilePendingLoot: the comparable output has no pendingLoot key", () => {
  const s1 = newRun(3);
  s1.pendingLoot = [JEWEL("A")];
  assert.ok(!("pendingLoot" in combatComparable(s1)));
  assert.ok(!("pendingLoot" in movementComparable(s1)));
  assert.ok(!("pendingLoot" in economyComparable(s1)));
});
