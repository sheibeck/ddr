// test/unit/store-sell.test.js
//
// Phase 14 (Economy C, ECON-06): the store SELL path — sell any carried item at
// a store. Covers the pure engine handler (engine/economy.js sellItem) and its
// price helper (sellPriceFor), plus the applyAction wiring/validation seam
// (engine/engine.js + engine/actions.js).
//
// sellItem is PURE (no rng): it splices c.items[i], credits c.gold by
// sellPriceFor(item, race), then runs the Phase-12 GATED clamp (clampCarry) so
// the credited gold never exceeds the bag's wilmst cap. A bag-less character is
// never capped (matches the clampCarry gate). No parity fixture drives it (no
// rng, new action) — inherently parity-safe.

import test from "node:test";
import assert from "node:assert/strict";

import { sellItem, sellPriceFor } from "../../engine/economy.js";
import { applyAction } from "../../engine/engine.js";
import { validateAction } from "../../engine/actions.js";

/** A minimal character mirroring engine/character.js's shape for the fields
 * sellItem/sellPriceFor read/write. */
function fixedChar(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1,
    weapon: "Broadsword", prof: 0, magicWpn: 0,
    armor: "Leather", ar: 6, armorMin: 1, armorWP: 15, armorMax: 15, patches: 0,
    skills: {}, gold: 50, rations: 6, scrolls: 0, maxWP: 55, wp: 40,
    bag: "small", // BAGS.small: 4 slots, 2000 wilmst
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
    party: [], pendingJoiner: null, pendingFind: null,
    dead: false, won: false,
    ...rest,
  };
}

const WEAPON = (base, bonus = 0) => ({ kind: "weapon", n: base, base, bonus, txt: base });
const ARMOR = (name, ar) => ({ kind: "armor", n: name, armor: name, ar, wp: 15, min: 1, cls: "FT", txt: `AR ${ar}` });
const POTION = (name) => ({ kind: "potion", n: `${name} potion`, txt: "", eff2: "heal", uses: 1 });
const JEWEL = (name) => ({ kind: "jewel", n: name, eff: {}, txt: "shiny" });

// --- sellPriceFor (base-value sources + treasure fallback) -------------------

test("sellPriceFor: ~50% of buy value for a weapon", () => {
  // Long Sword cost 500 (content/weapons.js); Human race → priceFor is identity.
  assert.equal(sellPriceFor(WEAPON("Long Sword"), "Human"), 250);
});

test("sellPriceFor: ~50% of buy value for armor", () => {
  // Leather cost 500 (content/armors.js); base AR 6 → no enchant premium.
  assert.equal(sellPriceFor(ARMOR("Leather", 6), "Human"), 250);
});

test("sellPriceFor: ~50% of buy value for a potion", () => {
  // Healing potion price 150 (content/potions.js).
  assert.equal(sellPriceFor(POTION("Healing"), "Human"), 75);
});

test("sellPriceFor: treasure item with no base value yields a positive fallback price", () => {
  const price = sellPriceFor(JEWEL("Ring of Power"), "Human");
  assert.ok(price > 0, "a jewel with no cost still sells for something (Phase-15 fallback)");
});

test("sellPriceFor: race multiplier flows through priceFor (elf half, troll triple)", () => {
  const human = sellPriceFor(WEAPON("Long Sword"), "Human"); // 250
  assert.equal(sellPriceFor(WEAPON("Long Sword"), "Elven"), Math.round(human / 2), "elves get half");
  assert.equal(sellPriceFor(WEAPON("Long Sword"), "Troll"), human * 3, "trolls get triple");
});

test("sellPriceFor: a magic (bonus) weapon is worth more than its plain base", () => {
  const plain = sellPriceFor(WEAPON("Long Sword", 0), "Human");
  const magic = sellPriceFor(WEAPON("Long Sword", 2), "Human");
  assert.ok(magic > plain, "the enchant premium raises the sell value");
});

// --- sellItem (credit, free slot, clamp, no-op) ------------------------------

test("sellItem: credits gold by sellPriceFor and frees the slot", () => {
  const state = fixedState({ c: { gold: 100, items: [WEAPON("Long Sword")] } });
  const events = [];
  sellItem(state, 0, events);
  assert.equal(state.c.gold, 100 + 250, "gold credited by the sell price");
  assert.equal(state.c.items.length, 0, "the slot is freed");
  const sold = events.find((e) => e.type === "itemSold");
  assert.ok(sold, "an itemSold event is pushed");
  assert.equal(sold.price, 250);
  assert.equal(sold.item.n, "Long Sword");
});

test("sellItem: clamps the credited gold to the bag's wilmst cap", () => {
  // BAGS.small wilmst cap = 2000. Start near the cap so the sale would overflow.
  const state = fixedState({ c: { bag: "small", gold: 1990, items: [WEAPON("Long Sword")] } });
  sellItem(state, 0, []);
  assert.equal(state.c.gold, 2000, "gold is clamped down to the wilmst cap, not 1990+250");
});

test("sellItem: a bag-less character is NOT gold-capped (clampCarry gate)", () => {
  const state = fixedState({ c: { bag: undefined, gold: 1990, items: [WEAPON("Long Sword")] } });
  sellItem(state, 0, []);
  assert.equal(state.c.gold, 1990 + 250, "no bag → no clamp; full price credited");
});

test("sellItem: an out-of-range index is a safe no-op", () => {
  const state = fixedState({ c: { gold: 100, items: [WEAPON("Long Sword")] } });
  const events = [];
  sellItem(state, 5, events);
  assert.equal(state.c.gold, 100, "gold unchanged");
  assert.equal(state.c.items.length, 1, "items unchanged");
  assert.equal(events.length, 0, "no event on a no-op");
});

// --- applyAction wiring + validation -----------------------------------------

test("applyAction: sellItem dispatch credits gold, removes the item, emits itemSold", () => {
  const state = fixedState({ c: { gold: 100, items: [WEAPON("Long Sword")] } });
  const { state: next, events } = applyAction(state, { type: "sellItem", i: 0 });
  assert.equal(next.c.gold, 350);
  assert.equal(next.c.items.length, 0);
  assert.ok(events.some((e) => e.type === "itemSold"));
  // purity: the original state is untouched (applyAction deep-clones).
  assert.equal(state.c.gold, 100);
  assert.equal(state.c.items.length, 1);
});

test("validateAction: sellItem.i must be a non-negative integer", () => {
  assert.equal(validateAction({ type: "sellItem", i: 0 }).ok, true);
  assert.equal(validateAction({ type: "sellItem", i: 3 }).ok, true);
  assert.equal(validateAction({ type: "sellItem", i: -1 }).ok, false);
  assert.equal(validateAction({ type: "sellItem", i: 1.5 }).ok, false);
  assert.equal(validateAction({ type: "sellItem" }).ok, false);
});

test("applyAction: a malformed sellItem is a no-op (no throw, unchanged state)", () => {
  const state = fixedState({ c: { gold: 100, items: [WEAPON("Long Sword")] } });
  const { state: next, events } = applyAction(state, { type: "sellItem", i: -1 });
  assert.equal(next.c.gold, 100);
  assert.equal(next.c.items.length, 1);
  assert.equal(events.length, 0);
});
