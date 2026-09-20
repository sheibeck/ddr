// test/unit/bag-cap-gate.test.js
//
// Phase 29 (LOOT-04/LOOT-05): the single bag-cap gate and bag content. Pins
// slotItems/clampCarry/BAG_ORDER/BAG_FLOORS/BAG_DROP_UNDER/BAG_ITEMS (Task 1),
// then stowItem/canStow/bagCap/weaponUpgradeDelta/armorUpgradeDelta/
// bagUpgradeTier/bagItemFor plus the store's pre-pay stow gate (Task 2).

import test from "node:test";
import assert from "node:assert/strict";

import { slotItems, clampCarry, takesBagSlot, BAG_FREE_KINDS } from "../../engine/derived.js";
import { BAGS, BAG_ORDER, BAG_FLOORS, BAG_DROP_UNDER, BAG_ITEMS } from "../../content/bags.js";
import {
  bagCap,
  canStow,
  stowItem,
  weaponUpgradeDelta,
  armorUpgradeDelta,
  bagUpgradeTier,
  bagItemFor,
  takeFind,
  unequipSlot,
  takeItem,
} from "../../engine/items.js";
import { buyFrom } from "../../engine/economy.js";
import { findMisc } from "../../engine/encounters.js";
import { newRun } from "../../engine/engine.js";
import { CLASSES } from "../../content/index.js";

/** A minimal character with a bag, an equipped weapon/armor, and an items
 * array. Mirrors test/unit/inventory-actions.test.js's fixedChar shape. */
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
    dead: false,
    ...rest,
  };
}

const GEAR = (n) => ({ kind: "gear", n });
const POTION = (n) => ({ kind: "potion", n, txt: n, eff2: "heal", uses: 1 });
const SCROLL = (n) => ({ kind: "scroll", n });

// --- takesBagSlot / BAG_FREE_KINDS (quick 260918-vvt) -----------------------

test("BAG_FREE_KINDS: sorted contents are exactly [bag, potion, scroll]", () => {
  assert.deepStrictEqual([...BAG_FREE_KINDS].sort(), ["bag", "potion", "scroll"]);
});

test("takesBagSlot: potion/scroll/bag are bag-free; non-objects are false; gear-ish kinds are true", () => {
  assert.equal(takesBagSlot({ kind: "potion" }), false);
  assert.equal(takesBagSlot({ kind: "scroll" }), false);
  assert.equal(takesBagSlot({ kind: "bag" }), false);
  assert.equal(takesBagSlot(null), false);
  assert.equal(takesBagSlot(undefined), false);
  assert.equal(takesBagSlot("potion"), false);
  assert.equal(takesBagSlot(42), false);
  assert.equal(takesBagSlot({ kind: "gear" }), true);
  assert.equal(takesBagSlot({ kind: "weapon" }), true);
  assert.equal(takesBagSlot({ kind: "armor" }), true);
  assert.equal(takesBagSlot({ kind: "jewel" }), true);
  assert.equal(takesBagSlot({ kind: "cloak" }), true);
  assert.equal(takesBagSlot({ kind: "staff" }), true);
  assert.equal(takesBagSlot({ kind: "tool" }), true);
  assert.equal(takesBagSlot({ kind: "picks" }), true);
  assert.equal(takesBagSlot({ n: "x" }), true, "kind-less object still takes a slot");
});

// --- slotItems ---------------------------------------------------------

test("slotItems: counts gear/treasure, excludes kind:potion", () => {
  const gearA = GEAR("a");
  const potion = POTION("p");
  const gearB = GEAR("b");
  assert.deepStrictEqual(slotItems({ items: [gearA, potion, gearB] }), [gearA, gearB]);
});

test("slotItems: excludes kind:scroll too (defensive — scrolls are a scalar today)", () => {
  const gearA = GEAR("a");
  const scroll = SCROLL("s");
  const potion = POTION("p");
  const gearB = GEAR("b");
  assert.deepStrictEqual(slotItems({ items: [gearA, scroll, potion, gearB] }), [gearA, gearB]);
});

test("slotItems: empty/missing items array returns []", () => {
  assert.deepStrictEqual(slotItems({}), []);
  assert.deepStrictEqual(slotItems({ items: null }), []);
});

test("slotItems: skips null/undefined entries defensively", () => {
  const gearA = GEAR("a");
  assert.deepStrictEqual(slotItems({ items: [null, gearA, undefined] }), [gearA]);
});

// --- clampCarry (potion-preserving slot trim) ---------------------------

test("clampCarry: small bag, 5 gear + 1 potion — potion survives, trailing gear dropped", () => {
  const a = GEAR("a");
  const potionP = POTION("p");
  const b = GEAR("b");
  const c2 = GEAR("c");
  const d = GEAR("d");
  const e = GEAR("e");
  const c = fixedChar({ items: [a, potionP, b, c2, d, e] });
  clampCarry(c);
  assert.deepStrictEqual(c.items, [a, potionP, b, c2, d]);
});

test("clampCarry: small bag, 4 gear + 3 potions — all 7 entries untouched (at cap, not over)", () => {
  const items = [GEAR("a"), GEAR("b"), GEAR("c"), GEAR("d"), POTION("p1"), POTION("p2"), POTION("p3")];
  const c = fixedChar({ items: [...items] });
  clampCarry(c);
  assert.equal(c.items.length, 7);
  assert.deepStrictEqual(c.items, items);
});

// --- content/bags.js pure data -------------------------------------------

test("BAGS is unchanged (its four tiers)", () => {
  assert.deepStrictEqual(BAGS, {
    small: { slots: 4, wilmst: 2000, rations: 10 },
    medium: { slots: 6, wilmst: 5000, rations: 20 },
    large: { slots: 8, wilmst: 8000, rations: 40 },
    exlarge: { slots: 10, wilmst: 10000, rations: 60 },
  });
});

test("BAG_ORDER / BAG_FLOORS / BAG_DROP_UNDER / BAG_ITEMS shape", () => {
  assert.deepStrictEqual(BAG_ORDER, ["small", "medium", "large", "exlarge"]);
  assert.deepStrictEqual(BAG_FLOORS, { medium: 2, large: 5, exlarge: 9 });
  assert.equal(Number.isInteger(BAG_DROP_UNDER), true);
  assert.ok(BAG_DROP_UNDER >= 1 && BAG_DROP_UNDER <= 20);
  for (const tier of ["medium", "large", "exlarge"]) {
    const item = BAG_ITEMS[tier];
    assert.equal(item.kind, "bag");
    assert.equal(item.tier, tier);
    assert.equal(typeof item.n, "string");
    assert.equal(typeof item.txt, "string");
    assert.match(item.txt, new RegExp(`${BAGS[tier].slots} slots`));
  }
});

// --- bagCap / canStow -----------------------------------------------------

test("bagCap/canStow: small bag caps at 4, bag-less character is Infinity", () => {
  assert.equal(bagCap({ bag: "small" }), 4);
  assert.equal(bagCap({}), Infinity);
  const three = fixedChar({ items: [GEAR("a"), GEAR("b"), GEAR("c")] });
  assert.equal(canStow(three), true);
  const four = fixedChar({ items: [GEAR("a"), GEAR("b"), GEAR("c"), GEAR("d")] });
  assert.equal(canStow(four), false);
});

// --- stowItem ---------------------------------------------------------

test("stowItem: room to spare — appends quietly by default, no bagFull/itemGiven", () => {
  const gear = GEAR("sword");
  const state = fixedState({ c: { items: [GEAR("a"), GEAR("b"), GEAR("c")] } });
  const events = [];
  const ok = stowItem(state, gear, events);
  assert.equal(ok, true);
  assert.deepStrictEqual(state.c.items[3], gear);
  assert.equal(events.length, 0);
});

test("stowItem: quiet=false pushes itemGiven", () => {
  const gear = GEAR("sword");
  const state = fixedState({ c: { items: [] } });
  const events = [];
  stowItem(state, gear, events, false);
  assert.deepStrictEqual(events, [{ type: "itemGiven", item: gear }]);
});

test("stowItem: full bag refuses, leaves items unchanged, pushes exactly one bagFull", () => {
  const gear = GEAR("sword");
  const items = [GEAR("a"), GEAR("b"), GEAR("c"), GEAR("d")];
  const state = fixedState({ c: { items: [...items] } });
  const before = JSON.parse(JSON.stringify(state.c.items));
  const events = [];
  const ok = stowItem(state, gear, events);
  assert.equal(ok, false);
  assert.deepStrictEqual(state.c.items, before);
  assert.deepStrictEqual(events, [{ type: "bagFull", item: gear, have: 4, slots: 4 }]);
});

test("stowItem: potions are exempt — stow succeeds even at a full bag", () => {
  const potion = POTION("Acuteness");
  const items = [GEAR("a"), GEAR("b"), GEAR("c"), GEAR("d"), POTION("p1"), POTION("p2")];
  const state = fixedState({ c: { items: [...items] } });
  const events = [];
  const ok = stowItem(state, potion, events);
  assert.equal(ok, true);
  assert.deepStrictEqual(state.c.items[state.c.items.length - 1], potion);
});

test("stowItem: a kind:scroll item stows onto a full bag — defensive, no bagFull (quick 260918-vvt)", () => {
  const scroll = SCROLL("Sealed scroll");
  const items = [GEAR("a"), GEAR("b"), GEAR("c"), GEAR("d")];
  const state = fixedState({ c: { items: [...items] } });
  const events = [];
  const ok = stowItem(state, scroll, events);
  assert.equal(ok, true);
  assert.deepStrictEqual(state.c.items[state.c.items.length - 1], scroll);
  assert.ok(!events.some((e) => e.type === "bagFull"));
});

test("stowItem: applies eff.wp on stow exactly like giveItem", () => {
  const gear = { kind: "gear", n: "amulet", eff: { wp: 3 } };
  const state = fixedState({ c: { items: [], maxWP: 50, wp: 40 } });
  stowItem(state, gear, []);
  assert.equal(state.c.maxWP, 53);
  assert.equal(state.c.wp, 43);
});

test("stowItem: a kind:bag item upgrades c.bag in place, consumes no slot", () => {
  const bagItem = { ...BAG_ITEMS.medium };
  const state = fixedState({ c: { bag: "small", items: [GEAR("a")] } });
  const events = [];
  const ok = stowItem(state, bagItem, events);
  assert.equal(ok, true);
  assert.equal(state.c.bag, "medium");
  assert.deepStrictEqual(state.c.items, [GEAR("a")]);
  assert.deepStrictEqual(events, [{ type: "bagUpgraded", from: "small", to: "medium", slots: 6, item: bagItem }]);
});

test("stowItem: a same-or-lower tier bag item is rejected as notBetter, no bagUpgraded", () => {
  for (const carried of ["medium", "large"]) {
    const bagItem = { ...BAG_ITEMS.medium };
    const state = fixedState({ c: { bag: carried, items: [] } });
    const events = [];
    const ok = stowItem(state, bagItem, events);
    assert.equal(ok, true);
    assert.equal(state.c.bag, carried, "c.bag unchanged");
    assert.deepStrictEqual(events, [{ type: "itemRejected", item: bagItem, reason: "notBetter" }]);
  }
});

// --- takeFind / unequipSlot routed through stowItem ------------------------

test("takeFind: at cap, bagFull carries have/slots and pendingFind is kept", () => {
  const it = GEAR("shield");
  const items = [GEAR("a"), GEAR("b"), GEAR("c"), GEAR("d")];
  const state = fixedState({ c: { items: [...items] }, pendingFind: it });
  const events = takeFind(state, []);
  assert.deepStrictEqual(events, [{ type: "bagFull", item: it, have: 4, slots: 4 }]);
  assert.deepStrictEqual(state.pendingFind, it, "pendingFind stays — the player must drop something first");
});

test("takeFind: a potion find succeeds at a full bag", () => {
  const it = POTION("Acuteness");
  const items = [GEAR("a"), GEAR("b"), GEAR("c"), GEAR("d")];
  const state = fixedState({ c: { items: [...items] }, pendingFind: it });
  const events = takeFind(state, []);
  assert.equal(state.pendingFind, null);
  assert.ok(events.some((e) => e.type === "findTaken" && e.item === it));
});

test("unequipSlot: at cap, bagFull carries have/slots and the worn weapon stays equipped", () => {
  const items = [GEAR("a"), GEAR("b"), GEAR("c"), GEAR("d")];
  const state = fixedState({ c: { items: [...items], weapon: "Broadsword", prof: 0, magicWpn: 0 } });
  const events = unequipSlot(state, "weapon", []);
  assert.deepStrictEqual(events, [{ type: "bagFull", item: { kind: "weapon", n: "Broadsword", base: "Broadsword", bonus: 0, txt: "d10+2" }, have: 4, slots: 4 }]);
  assert.equal(state.c.weapon, "Broadsword", "the worn weapon stays equipped");
});

// --- weaponUpgradeDelta / armorUpgradeDelta --------------------------------

test("weaponUpgradeDelta / armorUpgradeDelta match takeItem's own rule", () => {
  // Phase 39 (GEAR-01): weaponUpgradeDelta is now expectedStrike-based, not
  // WEAPON_MAX-based. fixedChar is a Fighter/Soldier (noCrit) wielding a
  // Broadsword (need 0, dieN 20 at level 1): expectedStrike(Broadsword, +2,
  // 0) - expectedStrike(Broadsword, +0, 0) = 0.25*(1+7.5+2) - 0.25*(1+7.5) =
  // 2.625 - 2.125 = 0.5 — still a genuine upgrade (delta > 0); a +0
  // Broadsword is not (delta 0).
  const better = { kind: "weapon", base: "Broadsword", bonus: 2, n: "Broadsword +2", txt: "Broadsword +2" };
  const betterState = fixedState();
  const betterDelta = weaponUpgradeDelta(betterState.c, better);
  assert.equal(betterDelta, 0.5);
  assert.ok(takeItem(betterState, better, []).some((e) => e.type === "itemTaken"));

  const same = { kind: "weapon", base: "Broadsword", bonus: 0, n: "Broadsword", txt: "Broadsword" };
  const sameState = fixedState();
  const before = JSON.parse(JSON.stringify(sameState.c));
  const sameDelta = weaponUpgradeDelta(sameState.c, same);
  assert.equal(sameDelta, 0);
  const sameEvents = takeItem(sameState, same, []);
  assert.ok(sameEvents.some((e) => e.type === "itemRejected" && e.reason === "notBetter"));
  assert.deepStrictEqual(sameState.c, before);

  const armorState = fixedState(); // ar: 6 (Leather)
  const betterArmor = { kind: "armor", n: "Plate", armor: "Plate", ar: 15, wp: 45, min: 2, cls: "F", txt: "AR 15" };
  assert.equal(armorUpgradeDelta(armorState.c, betterArmor), 9);
  assert.ok(takeItem(armorState, betterArmor, []).some((e) => e.type === "itemTaken"));

  const sameArmorState = fixedState();
  const sameArmor = { kind: "armor", n: "Leather", armor: "Leather", ar: 6, wp: 15, min: 1, cls: "F", txt: "AR 6" };
  assert.equal(armorUpgradeDelta(sameArmorState.c, sameArmor), 0);
  assert.ok(takeItem(sameArmorState, sameArmor, []).some((e) => e.type === "itemRejected" && e.reason === "notBetter"));
});

// --- bagUpgradeTier / bagItemFor -------------------------------------------

test("bagUpgradeTier: null below floor, null at/above own tier, next tier at the floor, null with a bag already pending", () => {
  assert.equal(bagUpgradeTier({ c: { bag: "small" }, floor: { depth: 1 }, pendingLoot: [] }), null);
  assert.equal(bagUpgradeTier({ c: { bag: "small" }, floor: { depth: 2 }, pendingLoot: [] }), "medium");
  assert.equal(bagUpgradeTier({ c: { bag: "medium" }, floor: { depth: 2 }, pendingLoot: [] }), null, "large needs depth 5");
  assert.equal(bagUpgradeTier({ c: { bag: "medium" }, floor: { depth: 5 }, pendingLoot: [] }), "large");
  assert.equal(bagUpgradeTier({ c: { bag: "exlarge" }, floor: { depth: 99 }, pendingLoot: [] }), null);
  assert.equal(bagUpgradeTier({ c: {}, floor: { depth: 99 }, pendingLoot: [] }), null, "missing c.bag");
  assert.equal(
    bagUpgradeTier({ c: { bag: "small" }, floor: { depth: 2 }, pendingLoot: [{ kind: "bag", tier: "medium" }] }),
    null,
    "a bag already sits in pendingLoot",
  );
  assert.doesNotThrow(() => bagUpgradeTier({ c: { bag: "small" }, floor: { depth: 2 } }));
});

test("bagItemFor: deepStrictEquals BAG_ITEMS[tier] but is a fresh copy", () => {
  const copy = bagItemFor("medium");
  assert.deepStrictEqual(copy, BAG_ITEMS.medium);
  assert.notEqual(copy, BAG_ITEMS.medium);
});

// --- store: buyFrom pre-pay stow gate ---------------------------------------

function fixedStoreState(overrides = {}) {
  const lockpicksItem = { kind: "picks", n: "Lockpicks", txt: "1–5 on d10 against any lock" };
  const potionItem = { kind: "potion", n: "Acuteness potion", txt: "sharpens the mind", eff2: "acute", uses: 1 };
  const stock = [
    { n: "Set of lockpicks", sub: null, cost: 450, effectId: "giveLockpicks", effectParams: { item: lockpicksItem }, sold: false },
    { n: "Acuteness potion", sub: null, cost: 200, effectId: "givePotion", effectParams: { item: potionItem }, sold: false },
    { n: "Sealed scroll", sub: null, cost: 900, effectId: "buyScroll", effectParams: null, sold: false },
  ];
  return fixedState({
    c: { gold: 1000, ...overrides.c },
    store: { stock, haggle: false, race: "Human" },
    ...overrides.rest,
  });
}

test("buyFrom: lockpicks with a full bag spends no gold, leaves sold false, emits exactly one bagFull", () => {
  const items = [GEAR("a"), GEAR("b"), GEAR("c"), GEAR("d")];
  const state = fixedStoreState({ c: { items: [...items] } });
  const before = JSON.parse(JSON.stringify(state.c.items));
  const events = buyFrom(state, 0, []);
  assert.equal(state.c.gold, 1000, "no gold spent");
  assert.equal(state.store.stock[0].sold, false, "not marked sold");
  assert.deepStrictEqual(state.c.items, before, "items unchanged");
  assert.deepStrictEqual(events, [
    { type: "bagFull", item: state.store.stock[0].effectParams.item, have: 4, slots: 4 },
  ]);
});

test("buyFrom: lockpicks with room deducts gold, marks sold, bought then itemGiven", () => {
  const state = fixedStoreState({ c: { items: [] } });
  const events = buyFrom(state, 0, []);
  assert.equal(state.c.gold, 1000 - 450);
  assert.equal(state.store.stock[0].sold, true);
  assert.equal(events[0].type, "bought");
  assert.equal(events[1].type, "itemGiven");
  assert.ok(state.c.items.some((it) => it.kind === "picks"));
});

test("buyFrom: a potion buy succeeds even with a full bag (potions are exempt)", () => {
  const items = [GEAR("a"), GEAR("b"), GEAR("c"), GEAR("d")];
  const state = fixedStoreState({ c: { items: [...items] } });
  const events = buyFrom(state, 1, []);
  assert.equal(state.c.gold, 1000 - 200);
  assert.equal(state.store.stock[1].sold, true);
  assert.equal(events[0].type, "bought");
  assert.ok(state.c.items.some((it) => it.kind === "potion"));
});

test("buyFrom: a Sealed scroll buy succeeds with a full bag (scrolls are a scalar, exempt) — quick 260918-vvt", () => {
  const items = [GEAR("a"), GEAR("b"), GEAR("c"), GEAR("d")];
  const state = fixedStoreState({ c: { items: [...items], scrolls: 0, gold: 1000 } });
  const before = JSON.parse(JSON.stringify(state.c.items));
  const events = buyFrom(state, 2, []);
  assert.equal(state.c.gold, 100);
  assert.equal(state.store.stock[2].sold, true);
  assert.equal(state.c.scrolls, 1);
  assert.deepStrictEqual(state.c.items, before);
  assert.ok(events.some((e) => e.type === "bought"));
  assert.ok(!events.some((e) => e.type === "bagFull"));
});

// --- find paths: scroll + potion on a full bag (quick 260918-vvt) ----------

test("findMisc: a Scroll find on a full bag increments c.scrolls, no bagFull (quick 260918-vvt)", () => {
  const items = [GEAR("a"), GEAR("b"), GEAR("c"), GEAR("d")];
  const state = fixedState({ c: { bag: "small", items: [...items], scrolls: 0, grimoire: [] } });
  const rng = { d: () => 3 };
  const events = findMisc(state, rng, []);
  assert.equal(state.c.scrolls, 1);
  assert.ok(events.some((e) => e.type === "scrollFound"));
  assert.equal(state.pendingFind ?? null, null);
  assert.deepStrictEqual(state.c.items, items);
  assert.ok(!events.some((e) => e.type === "bagFull"));
});

test("findMisc: a Potion find then takeFind on a full bag succeeds, no bagFull (quick 260918-vvt)", () => {
  const items = [GEAR("a"), GEAR("b"), GEAR("c"), GEAR("d")];
  const state = fixedState({ c: { bag: "small", items: [...items], scrolls: 0, grimoire: [] } });
  const rng = { d: () => 2 };
  const findEvents = findMisc(state, rng, []);
  assert.equal(state.pendingFind.kind, "potion");
  const offeredPotion = state.pendingFind;
  assert.ok(!findEvents.some((e) => e.type === "bagFull"));
  const takeEvents = takeFind(state, []);
  assert.equal(state.pendingFind, null);
  assert.ok(takeEvents.some((e) => e.type === "findTaken"));
  assert.deepStrictEqual(state.c.items[state.c.items.length - 1], offeredPotion);
  assert.equal(slotItems(state.c).length, 4);
  assert.ok(!takeEvents.some((e) => e.type === "bagFull"));
});

// --- chargen kit never exceeds bagCap ---------------------------------------

test("chargen: for every class and seeds 1..30, newRun leaves slotItems(c).length <= bagCap(c)", () => {
  for (const cls of Object.keys(CLASSES)) {
    for (let seed = 1; seed <= 30; seed++) {
      const state = newRun(seed, [], { force: { cls } });
      assert.ok(
        slotItems(state.c).length <= bagCap(state.c),
        `cls=${cls} seed=${seed}: slotItems=${slotItems(state.c).length} bagCap=${bagCap(state.c)}`,
      );
    }
  }
});
