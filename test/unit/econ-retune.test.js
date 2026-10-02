// test/unit/econ-retune.test.js
//
// Phase 92 plan 03 (ECON-12): the sell-fraction dial (lever S, user ruling
// 2026-10-01: "stores pay less when you sell", "Scale with depth"). The dial is
// DIALS.SELL_FRACTION = { shallow, deep, shallowTo, deepFrom }; sellFractionFor
// (engine/difficulty.js) gives the fraction of an item's base value a store
// pays at a floor, and engine/economy.js#sellPriceFor reads it.
//
// Part 1 (identity): with every override reset, a sale pays exactly what it paid
// on the plan base (commit 0012457), at every floor. These literals were
// measured on that base BEFORE the engine was edited.
// Part 2 (the dial moves only the sale): an override moves floors past the
// shallow edge and nothing else; the Pickpocket x0.75 and Q5 A (every race is
// paid the same) stay relative to the new base; buy prices never move.
// Part 3 (locked value): added when plan 92-03 locks the value (see the bottom).

import test from "node:test";
import assert from "node:assert/strict";

import { DIALS, setDialsForTuning, sellFractionFor } from "../../engine/difficulty.js";
import { openStore, sellPriceFor, sellItem } from "../../engine/economy.js";
import { makeRng } from "../../engine/rng.js";

const ITEMS = {
  longSword: { kind: "weapon", n: "Long Sword", base: "Long Sword", bonus: 0 },
  magicSword: { kind: "weapon", n: "Long Sword", base: "Long Sword", bonus: 2 },
  leather: { kind: "armor", n: "Leather", armor: "Leather", ar: 6 },
  healing: { kind: "potion", n: "Healing potion" },
  picks: { kind: "picks", n: "Lockpicks" },
  cloak: { kind: "cloak", n: "Cloak of Armor" },
  ring: { kind: "jewel", n: "Ring of Power" },
  pine: { kind: "staff", n: "Pine Staff" },
};

// Measured on the plan base (commit 0012457) before the engine was edited:
// what a store paid a Human, and a Pickpocket, for each item.
const BASE_PAID = {
  longSword: [200, 150],
  magicSword: [800, 600],
  leather: [250, 188],
  healing: [75, 56],
  picks: [225, 169],
  cloak: [1250, 938],
  ring: [750, 563],
  pine: [1300, 975],
};

const DEPTHS = [1, 3, 7, 10];

function withDials(overrides, fn) {
  const restore = setDialsForTuning(overrides);
  try {
    return fn();
  } finally {
    restore();
  }
}

function sellChar(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
    maxWP: 55, wp: 40, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Cloth", ar: 3, armorMin: 1, armorWP: 6, armorMax: 12, patches: 0,
    potions: 1, rations: 6, gold: 100, scrolls: 0,
    items: [], grimoire: [], name: "Test Delver",
    ...overrides,
  };
}

function stateAt(depth, cOverrides = {}) {
  return {
    version: 1, seed: 1, rngState: 1,
    c: sellChar(cOverrides),
    floor: { depth },
    day: 1, steps: 0, combat: null, store: null, beats: null,
    dead: false, deathNote: "", epitaph: "",
  };
}

// --- Part 1: identity -------------------------------------------------------

test("econ retune: SELL_FRACTION is a DIALS entry at its identity (0.5 everywhere) until the value is locked", () => {
  // Part 3 below pins the shipped value; this one pins the shape of the entry.
  const f = DIALS.SELL_FRACTION;
  assert.deepEqual(Object.keys(f).sort(), ["deep", "deepFrom", "shallow", "shallowTo"]);
  assert.equal(f.shallow, 0.5, "shallow floors pay today's half");
  assert.ok(f.shallowTo < f.deepFrom, "the ramp has a length");
});

test("econ retune: with the dial at identity a sale pays the plan-base amount at every floor", () => {
  const restore = setDialsForTuning({ SELL_FRACTION: { shallow: 0.5, deep: 0.5 } });
  try {
    for (const depth of DEPTHS) {
      assert.equal(sellFractionFor(depth), 0.5, `fraction at ${depth}`);
      for (const [k, [human, pick]] of Object.entries(BASE_PAID)) {
        assert.equal(sellPriceFor(ITEMS[k], "Human", null, depth), human, `${k} at ${depth}`);
        assert.equal(sellPriceFor(ITEMS[k], "Human", "Pickpocket", depth), pick, `${k} Pickpocket at ${depth}`);
      }
    }
  } finally {
    restore();
  }
});

test("econ retune: the shallow fraction is what a call with no depth pays (every old two-argument caller)", () => {
  for (const [k, [human, pick]] of Object.entries(BASE_PAID)) {
    assert.equal(sellPriceFor(ITEMS[k], "Human"), human, k);
    assert.equal(sellPriceFor(ITEMS[k], "Human", "Pickpocket"), pick, `${k} Pickpocket`);
  }
});

// --- Part 2: the dial moves only the sale -----------------------------------

test("econ retune: the fraction is flat to the shallow edge, eases to the deep value, and stays there", () => {
  withDials({ SELL_FRACTION: { shallow: 0.5, deep: 0.1, shallowTo: 4, deepFrom: 7 } }, () => {
    for (const d of [1, 2, 3, 4]) assert.equal(sellFractionFor(d), 0.5, `floor ${d}`);
    assert.ok(Math.abs(sellFractionFor(5) - 0.3667) < 0.001, "floor 5 is a third of the way down");
    assert.ok(Math.abs(sellFractionFor(6) - 0.2333) < 0.001, "floor 6 is two thirds of the way down");
    for (const d of [7, 8, 10, 12, 30]) assert.equal(sellFractionFor(d), 0.1, `floor ${d}`);
    assert.equal(sellFractionFor(undefined), 0.5, "no depth reads the shallow value");
    assert.equal(sellFractionFor(NaN), 0.5, "a non-finite depth reads the shallow value");
  });
});

test("econ retune: an override moves a sale at floor 7 and 10, not floors 1 to 4", () => {
  withDials({ SELL_FRACTION: { deep: 0.125 } }, () => {
    for (const d of [1, 3]) {
      assert.equal(sellPriceFor(ITEMS.cloak, "Human", null, d), 1250, `floor ${d} unchanged`);
    }
    for (const d of [7, 10]) {
      assert.equal(sellPriceFor(ITEMS.cloak, "Human", null, d), 313, `floor ${d}: round(2500 x 0.125)`);
      assert.equal(sellPriceFor(ITEMS.longSword, "Human", null, d), 50, `floor ${d}: round(400 x 0.125)`);
    }
  });
});

test("econ retune: the Pickpocket x0.75 and Q5 A stay relative to the new base fraction", () => {
  withDials({ SELL_FRACTION: { deep: 0.125 } }, () => {
    const human = sellPriceFor(ITEMS.longSword, "Human", null, 7);
    for (const race of ["Elven", "Dwarven", "Troll", "Human"]) {
      assert.equal(sellPriceFor(ITEMS.longSword, race, null, 7), human, `${race} is paid the ordinary price`);
    }
    assert.equal(sellPriceFor(ITEMS.cloak, "Human", "Pickpocket", 7), Math.round(2500 * 0.125 * 0.75), "round(234.375)");
    assert.equal(sellPriceFor(ITEMS.picks, "Human", null, 7), Math.round(450 * 0.125), "picks, 56.25");
  });
});

test("econ retune: a sale never pays less than 1", () => {
  withDials({ SELL_FRACTION: { deep: 0.001 } }, () => {
    assert.equal(sellPriceFor(ITEMS.healing, "Human", "Pickpocket", 9), 1);
  });
});

test("econ retune: sellItem pays the fraction of the floor the store is on", () => {
  withDials({ SELL_FRACTION: { deep: 0.125 } }, () => {
    const shallow = stateAt(2, { items: [{ ...ITEMS.cloak }] });
    sellItem(shallow, 0, []);
    assert.equal(shallow.c.gold, 100 + 1250);
    const deep = stateAt(7, { items: [{ ...ITEMS.cloak }] });
    const events = [];
    sellItem(deep, 0, events);
    assert.equal(deep.c.gold, 100 + 313);
    assert.equal(events.find((e) => e.type === "itemSold").price, 313);
  });
});

test("econ retune: buy prices and the shelf never move (the dial is the sale only)", () => {
  for (const depth of DEPTHS) {
    const open = () => {
      const s = stateAt(depth, { gold: 100000 });
      openStore(s, makeRng(12345), []);
      return s.store;
    };
    const base = open();
    const moved = withDials({ SELL_FRACTION: { shallow: 0.3, deep: 0.05 } }, open);
    assert.deepEqual(moved, base, `store at floor ${depth}`);
  }
});

test("econ retune: setDialsForTuning accepts the key and rejects a misspelled one", () => {
  const restore = setDialsForTuning({ SELL_FRACTION: { deep: 0.2 } });
  restore();
  assert.throws(() => setDialsForTuning({ SELL_FRACTIONS: { deep: 0.2 } }), /unknown dial/);
});

test("econ retune: restore puts the shipped dial back exactly", () => {
  const before = [1, 5, 7, 12].map((d) => sellFractionFor(d));
  setDialsForTuning({ SELL_FRACTION: { shallow: 0.3, deep: 0.05 } })();
  assert.deepEqual([1, 5, 7, 12].map((d) => sellFractionFor(d)), before);
});

// --- Part 3: the locked value (plan 92-03, fit/econ-lock.json row 1) --------

test("econ retune: the shipped fraction is 0.5 through floor 4, 0.375 and 0.25 at floors 5 and 6, 0.125 from floor 7", () => {
  assert.deepEqual(DIALS.SELL_FRACTION, { shallow: 0.5, deep: 0.125, shallowTo: 4, deepFrom: 7 });
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((d) => sellFractionFor(d)),
    [0.5, 0.5, 0.5, 0.5, 0.375, 0.25, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125],
  );
});

test("econ retune: under the shipped dial a store pays what it did on floors 1 to 4 and an eighth of base value from floor 7", () => {
  // Cloak of Armor base 2500, Long Sword base 400, Healing potion base 150, Lockpicks base 450.
  const paid = (it, sub, d) => sellPriceFor(it, "Human", sub, d);
  for (const d of [1, 3]) {
    assert.equal(paid(ITEMS.cloak, null, d), 1250, `cloak at ${d}`);
    assert.equal(paid(ITEMS.longSword, null, d), 200, `Long Sword at ${d}`);
    assert.equal(paid(ITEMS.cloak, "Pickpocket", d), 938, `cloak, Pickpocket, at ${d}`);
  }
  assert.equal(paid(ITEMS.cloak, null, 5), 938, "floor 5: round(2500 x 0.375)");
  assert.equal(paid(ITEMS.cloak, null, 6), 625, "floor 6: 2500 x 0.25");
  for (const d of [7, 10]) {
    assert.equal(paid(ITEMS.cloak, null, d), 313, `cloak at ${d}: round(312.5)`);
    assert.equal(paid(ITEMS.longSword, null, d), 50, `Long Sword at ${d}`);
    assert.equal(paid(ITEMS.healing, null, d), 19, `Healing potion at ${d}: round(18.75)`);
    assert.equal(paid(ITEMS.picks, null, d), 56, `Lockpicks at ${d}: round(56.25)`);
    assert.equal(paid(ITEMS.cloak, "Pickpocket", d), 234, `cloak, Pickpocket, at ${d}: round(234.375)`);
  }
});
