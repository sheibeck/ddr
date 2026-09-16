// test/unit/bag-cap-gate.test.js
//
// Phase 29 (LOOT-04/LOOT-05): the single bag-cap gate and bag content. Pins
// slotItems/clampCarry/BAG_ORDER/BAG_FLOORS/BAG_DROP_UNDER/BAG_ITEMS (Task 1),
// then stowItem/canStow/bagCap/weaponUpgradeDelta/armorUpgradeDelta/
// bagUpgradeTier/bagItemFor plus the store's pre-pay stow gate (Task 2).

import test from "node:test";
import assert from "node:assert/strict";

import { slotItems, clampCarry } from "../../engine/derived.js";
import { BAGS, BAG_ORDER, BAG_FLOORS, BAG_DROP_UNDER, BAG_ITEMS } from "../../content/bags.js";

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
    dead: false, won: false,
    ...rest,
  };
}

const GEAR = (n) => ({ kind: "gear", n });
const POTION = (n) => ({ kind: "potion", n, txt: n, eff2: "heal", uses: 1 });

// --- slotItems ---------------------------------------------------------

test("slotItems: counts gear/treasure, excludes kind:potion", () => {
  const gearA = GEAR("a");
  const potion = POTION("p");
  const gearB = GEAR("b");
  assert.deepStrictEqual(slotItems({ items: [gearA, potion, gearB] }), [gearA, gearB]);
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
