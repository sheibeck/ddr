// Phase 87 (STORE-04) — a store stocks a d10 of rations, sold one per BUY.
//
// Proves: the roll comes from a DERIVED stream keyed on the main cursor
// after every openStore draw (zero main-rng draws, so the cursor and the
// stock indices stay put); the count lives on the Rations line as `left`;
// each buy sells exactly one ration and keeps the line buyable until the
// count is spent; a sold-out line and a pack at its ration cap are refused
// BEFORE any gold moves; an old save with no `left` reads tolerantly; the
// count survives save/load and never re-rolls.

import test from "node:test";
import assert from "node:assert/strict";

import { makeRng, derivedRng } from "../../engine/rng.js";
import { newRun } from "../../engine/engine.js";
import {
  openStore,
  buyFrom,
  storeBuyRefusal,
  priceFor,
  rollRationsStock,
  rationsLeft,
  RATIONS_STOCK_DIE,
} from "../../engine/economy.js";
import { serializeRun, validateSave, rehydrate } from "../../engine/saveState.js";

/** A test double whose cursor is fixed, for the derived-stream key. */
function rngAtCursor(cursor) {
  return { getState: () => cursor };
}

/** A hand-built open store with a Rations line carrying `line` overrides. */
function rationsState({ gold = 100000, rations = 0, bag, left = 3, sold = false, omitLeft = false, race = "Human" } = {}) {
  const line = {
    n: "Rations (+1 ration)",
    sub: null,
    cost: 30,
    effectId: "buyRations",
    effectParams: { amount: 1 },
    sold,
  };
  if (!omitLeft) line.left = left;
  const c = { gold, rations, race, sub: "Soldier", items: [] };
  if (bag) c.bag = bag;
  return {
    c,
    floor: { depth: 1 },
    store: { stock: [{ n: "Chicken (+12 hp)", sub: null, cost: 20, effectId: "eatRation", effectParams: { wp: 12 }, sold: false }, line], haggle: 1, race },
  };
}

test("RATIONS_STOCK_DIE is a flat d10", () => {
  assert.equal(RATIONS_STOCK_DIE, 10);
});

test("openStore: exactly one Rations line, left is an integer 1..10, position and shape unchanged", () => {
  for (const seed of [1, 2, 3, 7, 11, 42]) {
    const state = newRun(seed, [], { storeRoll: true });
    openStore(state, makeRng(state.rngState), []);
    const lines = state.store.stock.filter((l) => l.effectId === "buyRations");
    assert.equal(lines.length, 1);
    const line = lines[0];
    assert.ok(Number.isInteger(line.left) && line.left >= 1 && line.left <= 10, `seed ${seed}: left ${line.left}`);
    assert.equal(line.n, "Rations (+1 ration)");
    const haggle = state.c.race === "Wilmsry" ? 0.7 : 1;
    assert.equal(line.cost, Math.round(priceFor(30, state.c.race, state.c.sub) * haggle));
    assert.deepStrictEqual(line.effectParams, { amount: 1 });
    assert.equal(line.sold, false);
    // still directly before the tool lines and after every gear line
    const at = state.store.stock.indexOf(line);
    assert.ok(state.store.stock.slice(0, at).every((l) => l.effectId !== "giveTool"));
  }
});

test("openStore: the roll never moves the main rng (draw count identical with and without it)", () => {
  const a = newRun(5, [], { storeRoll: true });
  const b = newRun(5, [], { storeRoll: true });
  const ra = makeRng(a.rngState);
  const rb = makeRng(b.rngState);
  openStore(a, ra, []);
  // the same store, then a bare roll at the resulting cursor: must not move it
  openStore(b, rb, []);
  const before = rb.getState();
  rollRationsStock(rb, b.floor.depth);
  assert.equal(rb.getState(), before, "rollRationsStock never advances the passed rng");
  assert.equal(ra.getState(), rb.getState());
  assert.deepStrictEqual(a.store, b.store);
});

test("rollRationsStock: pure per (cursor, depth), covers exactly 1..10", () => {
  const seen = new Set();
  for (let cursor = 0; cursor < 10000; cursor++) {
    const v = rollRationsStock(rngAtCursor(cursor), 3);
    assert.equal(v, rollRationsStock(rngAtCursor(cursor), 3), "same cursor+depth, same roll");
    assert.ok(Number.isInteger(v) && v >= 1 && v <= 10);
    seen.add(v);
  }
  assert.deepStrictEqual([...seen].sort((x, y) => x - y), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test("rollRationsStock: uses the storeRations derived stream, and an rng without getState reads cursor 0", () => {
  assert.equal(rollRationsStock(rngAtCursor(1234), 4), derivedRng(1234, "storeRations", 4).d(10));
  assert.equal(rollRationsStock({}, 2), derivedRng(0, "storeRations", 2).d(10));
});

test("rollRationsStock: flat across depth (any depth can roll any face)", () => {
  const byDepth = (depth) => {
    const s = new Set();
    for (let cursor = 0; cursor < 3000; cursor++) s.add(rollRationsStock(rngAtCursor(cursor), depth));
    return s.size;
  };
  for (const depth of [1, 5, 12, 30]) assert.equal(byDepth(depth), 10);
});

test("buyFrom: left 3 sells three rations one at a time, then sells out; more taps do nothing", () => {
  const state = rationsState({ left: 3, rations: 0 });
  const line = state.store.stock[1];
  let ev = buyFrom(state, 1, []);
  assert.equal(state.c.rations, 1);
  assert.equal(line.left, 2);
  assert.equal(line.sold, false);
  assert.equal(state.c.gold, 100000 - 30);
  assert.ok(ev.some((e) => e.type === "rationsBought" && e.amount === 1));
  assert.ok(!ev.some((e) => e.type === "rationsSoldOut"));
  buyFrom(state, 1, []);
  assert.equal(line.left, 1);
  assert.equal(line.sold, false);
  ev = buyFrom(state, 1, []);
  assert.equal(line.left, 0);
  assert.equal(line.sold, true);
  assert.equal(state.c.rations, 3);
  const types = ev.map((e) => e.type);
  assert.ok(types.indexOf("rationsBought") !== -1 && types.indexOf("rationsSoldOut") > types.indexOf("rationsBought"), "rationsSoldOut follows rationsBought");
  const snapshot = structuredClone(state);
  for (let i = 0; i < 20; i++) assert.deepStrictEqual(buyFrom(state, 1, []), []);
  assert.deepStrictEqual(state, snapshot, "a spent line never changes anything");
});

test("buyFrom: a store that rolled the minimum (1) sells exactly one ration", () => {
  const state = rationsState({ left: 1 });
  const ev = buyFrom(state, 1, []);
  assert.equal(state.c.rations, 1);
  assert.equal(state.store.stock[1].left, 0);
  assert.equal(state.store.stock[1].sold, true);
  assert.ok(ev.some((e) => e.type === "rationsSoldOut"));
  assert.deepStrictEqual(buyFrom(state, 1, []), []);
  assert.equal(state.c.rations, 1);
});

test("buyFrom: a real rolled store, bought to the end, never oversells and never goes below 0", () => {
  const state = newRun(9, [], { storeRoll: true });
  state.c.gold = 100000;
  state.c.rations = 0;
  delete state.c.bag;
  openStore(state, makeRng(state.rngState), []);
  const idx = state.store.stock.findIndex((l) => l.effectId === "buyRations");
  const stocked = state.store.stock[idx].left;
  for (let i = 0; i < 40; i++) buyFrom(state, idx, []);
  assert.equal(state.c.rations, stocked, "exactly the rolled stock was delivered");
  assert.equal(state.store.stock[idx].left, 0);
  assert.equal(state.store.stock[idx].sold, true);
  assert.equal(state.c.gold, 100000 - stocked * state.store.stock[idx].cost);
});

test("buyFrom: a malformed line (left 0, sold false) is refused with no gold moved", () => {
  const state = rationsState({ left: 0, sold: false });
  const snapshot = structuredClone(state);
  assert.deepStrictEqual(buyFrom(state, 1, []), []);
  assert.deepStrictEqual(state, snapshot);
});

test("rationsLeft: an old-save line (no left) reads 1 unsold, 0 sold; garbage counts read tolerantly", () => {
  assert.equal(rationsLeft({ effectId: "buyRations", sold: false }), 1);
  assert.equal(rationsLeft({ effectId: "buyRations", sold: true }), 0);
  assert.equal(rationsLeft({ left: 4 }), 4);
  assert.equal(rationsLeft({ left: 0, sold: true }), 0);
  assert.equal(rationsLeft({ left: -2, sold: false }), 1);
  assert.equal(rationsLeft({ left: "7", sold: false }), 1);
  assert.equal(rationsLeft({ left: 2.5, sold: true }), 0);
  assert.equal(rationsLeft({ left: 9999 }), 10, "a tampered count is capped at the die");
});

test("old save: an unsold Rations line with no left sells one ration and sells out; survives serialize/validate/rehydrate", () => {
  const src = newRun(4, [], { storeRoll: true });
  src.c.gold = 100000;
  src.c.rations = 0;
  delete src.c.bag;
  openStore(src, makeRng(src.rngState), []);
  const idx = src.store.stock.findIndex((l) => l.effectId === "buyRations");
  delete src.store.stock[idx].left;
  const checked = validateSave(JSON.stringify(serializeRun(src)));
  assert.equal(checked.ok, true, checked.reason);
  const state = rehydrate(checked.value) || checked.value;
  const line = state.store.stock[idx];
  assert.equal(rationsLeft(line), 1);
  const ev = buyFrom(state, idx, []);
  assert.equal(state.c.rations, 1);
  assert.equal(line.sold, true);
  assert.ok(ev.some((e) => e.type === "rationsSoldOut"));
  assert.deepStrictEqual(buyFrom(state, idx, []), []);
});

test("save/load mid-store keeps the remaining count and never re-rolls", () => {
  const src = newRun(6, [], { storeRoll: true });
  src.c.gold = 100000;
  src.c.rations = 0;
  delete src.c.bag;
  openStore(src, makeRng(src.rngState), []);
  const idx = src.store.stock.findIndex((l) => l.effectId === "buyRations");
  const rolled = src.store.stock[idx].left;
  buyFrom(src, idx, []);
  const checked = validateSave(JSON.stringify(serializeRun(src)));
  assert.equal(checked.ok, true, checked.reason);
  const state = rehydrate(checked.value) || checked.value;
  assert.equal(state.store.stock[idx].left, rolled - 1);
  assert.equal(state.store.stock[idx].sold, rolled - 1 === 0);
  // the roll is a pure function of its key: a re-roll at the same cursor is identical
  const cursor = 777;
  assert.equal(rollRationsStock(rngAtCursor(cursor), 2), rollRationsStock(rngAtCursor(cursor), 2));
});

test("storeBuyRefusal: a small bag at 10 rations refuses with rationsFull; insufficientGold still comes first", () => {
  const state = rationsState({ bag: "small", rations: 10, left: 4 });
  const line = state.store.stock[1];
  assert.deepStrictEqual(storeBuyRefusal(state.c, line), { reason: "rationsFull", have: 10, cap: 10 });
  state.c.gold = 0;
  assert.equal(storeBuyRefusal(state.c, line).reason, "insufficientGold");
});

test("buyFrom: rationsFull refuses before any gold moves; 9 of 10 buys one, then refuses", () => {
  const state = rationsState({ bag: "small", rations: 10, left: 4 });
  const snapshot = structuredClone(state);
  const ev = buyFrom(state, 1, []);
  assert.deepStrictEqual(ev, [{ type: "rationsFull", have: 10, cap: 10 }]);
  assert.deepStrictEqual(state, snapshot, "gold, rations and left are unchanged");

  const nine = rationsState({ bag: "small", rations: 9, left: 4 });
  buyFrom(nine, 1, []);
  assert.equal(nine.c.rations, 10);
  assert.equal(nine.store.stock[1].left, 3);
  const ev2 = buyFrom(nine, 1, []);
  assert.deepStrictEqual(ev2, [{ type: "rationsFull", have: 10, cap: 10 }]);
  assert.equal(nine.c.rations, 10);
  assert.equal(nine.store.stock[1].left, 3);
});

test("storeBuyRefusal: a state with no bag (old save) is never cap-refused", () => {
  const state = rationsState({ rations: 500, left: 4 });
  assert.equal(storeBuyRefusal(state.c, state.store.stock[1]), null);
});

test("storeBuyRefusal: a non-Rations line is unaffected by the ration cap", () => {
  const state = rationsState({ bag: "small", rations: 10 });
  assert.equal(storeBuyRefusal(state.c, state.store.stock[0]), null);
});

test("every other line still sells once and is marked sold", () => {
  const state = rationsState({ left: 3 });
  const before = state.c.gold;
  buyFrom(state, 0, []);
  assert.equal(state.store.stock[0].sold, true);
  assert.equal(state.c.gold, before - 20);
  assert.equal(state.store.stock[0].left, undefined, "only the Rations line carries left");
  assert.deepStrictEqual(buyFrom(state, 0, []), []);
});
