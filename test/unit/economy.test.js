// Task 1 — the store domain (ENG-01, ENG-03, ENG-04): stock is plain data
// (no closures) and an engine-side STORE_EFFECTS lookup applies a purchase.
//
// Proves: openStore builds plain-data stock entries (no function-typed
// leaves anywhere in state.store — the flagged anti-pattern is gone);
// buyFrom deducts gold, marks the slot sold, and applies the right
// STORE_EFFECTS effect; buyFrom guards out-of-range/sold/insufficient-gold
// buys as no-ops; leaveStore clears the store; a GameState with an open
// store round-trips JSON deepStrictEqual (the store now survives
// save/reload); economy.js references no Math.random/document/localStorage.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { makeRng } from "../../engine/rng.js";
import { openStore, buyFrom, leaveStore, STORE_EFFECTS, priceFor, sellPriceFor, sellItem } from "../../engine/economy.js";
import { newRun } from "../../engine/engine.js";

function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
    maxWP: 55, wp: 40, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Cloth", ar: 3, armorMin: 1, armorWP: 6, armorMax: 12, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 1, rations: 6, gold: 100000, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    ...overrides,
  };
}

function fixedState(overrides = {}) {
  const { c: cOverrides, floor: floorOverrides, ...rest } = overrides;
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedFighter(cOverrides),
    floor: { depth: 1, ...floorOverrides },
    day: 1, steps: 0, combat: null, store: null, beats: null,
    dead: false, deathNote: "", epitaph: "",
    ...rest,
  };
}

/** Recursively assert no function-typed leaf exists anywhere in `value`. */
function assertNoFunctionLeaves(value, label = "value") {
  if (typeof value === "function") assert.fail(`${label} is a function`);
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) assertNoFunctionLeaves(v, `${label}.${k}`);
  }
}

// --- priceFor ---------------------------------------------------------

test("priceFor: triples for a Troll, halves (rounded) for Elven/Dwarven, unchanged otherwise", () => {
  assert.equal(priceFor(100, "Troll"), 300);
  assert.equal(priceFor(101, "Elven"), 51);
  assert.equal(priceFor(101, "Dwarven"), 51);
  assert.equal(priceFor(100, "Human"), 100);
});

// --- Pickpocket bad (IDENT-05): store buy x1.25, sell-back x0.75 ----------

test("priceFor: Pickpocket marks up x1.25 (rounded) AFTER the race multiplier, floored at 1", () => {
  assert.equal(priceFor(100, "Human", "Pickpocket"), 125);
  assert.equal(priceFor(101, "Elven", "Pickpocket"), 64); // round(51 x 1.25 = 63.75)
  assert.equal(priceFor(100, "Troll", "Pickpocket"), 375); // 300 x 1.25
  assert.equal(priceFor(1, "Elven", "Pickpocket"), 1); // round(round(0.5)*1.25)=round(1*1.25)=1, floored either way
});

test("priceFor: a non-Pickpocket sub (or omitted sub) is value-identical to before this change", () => {
  assert.equal(priceFor(100, "Human", "Cutthroat"), 100);
  assert.equal(priceFor(100, "Human"), 100);
});

test("sellPriceFor: Pickpocket sells at x0.75 of the ordinary sell price, floored at 1", () => {
  const cloak = { kind: "cloak", n: "Cloak of Armor" };
  assert.equal(sellPriceFor(cloak, "Human"), 1250); // 2500 x 0.5, non-Pickpocket baseline
  assert.equal(sellPriceFor(cloak, "Human", "Pickpocket"), 938); // round(2500 x 0.5 x 0.75 = 937.5)
});

// --- openStore: plain-data stock, no closures --------------------------

test("openStore: builds plain-data stock with no function-typed leaves anywhere in state.store", () => {
  const state = fixedState();
  const rng = makeRng(1234);
  openStore(state, rng, []);
  assert.ok(state.store, "store is open");
  assert.ok(Array.isArray(state.store.stock) && state.store.stock.length > 0);
  for (const entry of state.store.stock) {
    assert.equal(typeof entry.effectId, "string", "every stock entry carries a plain effectId");
    assert.notEqual(typeof entry.buy, "function", "no closure-typed `buy` field survives");
  }
  assertNoFunctionLeaves(state.store, "state.store");
});

test("openStore: every stock entry's effectId resolves to a real STORE_EFFECTS handler", () => {
  const state = fixedState();
  openStore(state, makeRng(42), []);
  for (const entry of state.store.stock) {
    assert.equal(typeof STORE_EFFECTS[entry.effectId], "function", `unknown effectId: ${entry.effectId}`);
  }
});

test("openStore emits a storeOpened event and clears beats", () => {
  const state = fixedState({ beats: { groups: [] } });
  const events = openStore(state, makeRng(5), []);
  assert.ok(events.some((e) => e.type === "storeOpened"));
  assert.equal(state.beats, null);
});

test("openStore: storeOpened.pickpocket is true only for a Pickpocket hero", () => {
  const pickpocketState = fixedState({ c: { sub: "Pickpocket" } });
  const pickpocketEvents = openStore(pickpocketState, makeRng(5), []);
  const pickpocketEvent = pickpocketEvents.find((e) => e.type === "storeOpened");
  assert.equal(pickpocketEvent.pickpocket, true);

  const cutthroatState = fixedState({ c: { sub: "Cutthroat" } });
  const cutthroatEvents = openStore(cutthroatState, makeRng(5), []);
  const cutthroatEvent = cutthroatEvents.find((e) => e.type === "storeOpened");
  assert.equal(cutthroatEvent.pickpocket, false);
});

// --- TERM-02: engine-generated store-row labels read "hp", not "wp" -------
// engine/economy.js builds these label strings itself (they end up embedded
// in serialized state.store.stock[i].n) — a text-only rename, but it must be
// asserted here because it's generated code, not static markup.

test("openStore: the food stock label reads '(+N hp)', never '(+N wp)'", () => {
  const state = fixedState();
  openStore(state, makeRng(9), []);
  const foodEntries = state.store.stock.filter((s) => s.effectId === "eatRation");
  assert.ok(foodEntries.length > 0, "fixture must roll at least one food entry");
  for (const entry of foodEntries) {
    assert.match(entry.n, /\(\+\d+ hp\)/, `food label "${entry.n}" must read hp, not wp`);
    assert.doesNotMatch(entry.n, /\bwp\b/, `food label "${entry.n}" must not contain the old wp unit`);
  }
});

test("openStore: an armor upgrade's sub-label reads 'AR N, M hp', never '... wp'", () => {
  // Give the fixture a beatable armor so a strictly-better upgrade is offered.
  const state = fixedState({ c: { armor: "Nothing", ar: 0, armorWP: 0, armorMax: 0 } });
  openStore(state, makeRng(9), []);
  const armorEntries = state.store.stock.filter((s) => s.effectId === "buyArmor");
  assert.ok(armorEntries.length > 0, "fixture must roll an armor upgrade entry");
  for (const entry of armorEntries) {
    assert.match(entry.sub, /AR \d+, \d+ hp/, `armor sub-label "${entry.sub}" must read hp, not wp`);
    assert.doesNotMatch(entry.sub, /\bwp\b/, `armor sub-label "${entry.sub}" must not contain the old wp unit`);
  }
});

// --- buyFrom ------------------------------------------------------------

test("buyFrom: deducts gold, marks sold, and applies the STORE_EFFECTS effect", () => {
  const state = fixedState({ c: { gold: 100000, rations: 0, wp: 10, maxWP: 55 } });
  openStore(state, makeRng(9), []);
  const idx = state.store.stock.findIndex((s) => s.effectId === "eatRation");
  assert.notEqual(idx, -1, "fixture must roll a food entry");
  const before = state.c.gold;
  const events = buyFrom(state, idx, []);
  assert.equal(state.store.stock[idx].sold, true);
  assert.equal(state.c.gold, before - state.store.stock[idx].cost);
  assert.ok(state.c.wp > 10, "eatRation healed wp via STORE_EFFECTS");
  assert.ok(events.some((e) => e.type === "bought"));
});

// --- RATION-01: food is pure HP healing; Rations are a dedicated, visible line ---

test("buyFrom: buying food (eatRation) heals wp and leaves c.rations UNCHANGED", () => {
  const state = fixedState({ c: { gold: 100000, rations: 3, wp: 10, maxWP: 55 } });
  openStore(state, makeRng(9), []);
  const idx = state.store.stock.findIndex((s) => s.effectId === "eatRation");
  assert.notEqual(idx, -1, "fixture must roll a food entry");
  buyFrom(state, idx, []);
  assert.ok(state.c.wp > 10, "wp healed");
  assert.equal(state.c.rations, 3, "food purchase must not change rations");
});

test("openStore: offers a dedicated Rations line, race-priced via priceFor", () => {
  const state = fixedState();
  openStore(state, makeRng(9), []);
  const rationEntries = state.store.stock.filter((s) => s.effectId === "buyRations");
  assert.equal(rationEntries.length, 1, "exactly one Rations line item");
  assert.equal(rationEntries[0].cost, priceFor(30, state.store.race));
});

test("buyFrom: buying the Rations line increments c.rations and emits rationsBought", () => {
  const state = fixedState({ c: { gold: 100000, rations: 3 } });
  openStore(state, makeRng(9), []);
  const idx = state.store.stock.findIndex((s) => s.effectId === "buyRations");
  assert.notEqual(idx, -1, "fixture must roll the Rations line");
  const amount = state.store.stock[idx].effectParams.amount;
  const events = buyFrom(state, idx, []);
  assert.equal(state.c.rations, 3 + amount);
  assert.ok(events.some((e) => e.type === "rationsBought" && e.amount === amount));
});

test("buyFrom: an out-of-range idx is a no-op, never a throw", () => {
  const state = fixedState();
  openStore(state, makeRng(3), []);
  const before = structuredClone(state);
  const events = buyFrom(state, 9999, []);
  assert.deepStrictEqual(state, before);
  assert.deepStrictEqual(events, []);
});

test("buyFrom: buying an already-sold slot is a no-op", () => {
  const state = fixedState({ c: { gold: 100000 } });
  openStore(state, makeRng(3), []);
  buyFrom(state, 0, []);
  const goldAfterFirst = state.c.gold;
  buyFrom(state, 0, []);
  assert.equal(state.c.gold, goldAfterFirst, "a second buy on a sold slot changes nothing");
});

test("buyFrom: insufficient gold fails without mutating state", () => {
  const state = fixedState({ c: { gold: 0 } });
  openStore(state, makeRng(3), []);
  const before = structuredClone(state);
  const events = buyFrom(state, 0, []);
  assert.deepStrictEqual(state, before);
  assert.ok(events.some((e) => e.type === "buyFailed" && e.reason === "insufficientGold"));
});

test("buyFrom with no open store is a no-op", () => {
  const state = fixedState();
  const events = buyFrom(state, 0, []);
  assert.deepStrictEqual(events, []);
});

// --- leaveStore -----------------------------------------------------------

test("leaveStore clears the store and emits storeLeft", () => {
  const state = fixedState();
  openStore(state, makeRng(3), []);
  const events = leaveStore(state, []);
  assert.equal(state.store, null);
  assert.ok(events.some((e) => e.type === "storeLeft"));
});

// --- round-trip (ENG-04): an OPEN store now survives save/reload ---------

test("a GameState with an open store round-trips JSON deepStrictEqual (the closure fix)", () => {
  const state = fixedState();
  openStore(state, makeRng(77), []);
  assert.ok(state.store, "store must actually be open for this to prove anything");
  const roundTripped = JSON.parse(JSON.stringify(state));
  assert.deepStrictEqual(roundTripped, state);
  // structuredClone throws immediately on any function-typed leaf (applyAction's
  // own clone strategy, per engine/engine.js) — the strongest possible proof.
  assert.doesNotThrow(() => structuredClone(state));
});

// --- seed-3 stock pin (IDENT-05, FID-07): the economy fixture's hero -------
// Proves the exact Pickpocket-marked-up store numbers this plan declares as
// a parity divergence in test/parity/fixtures/action-script.economy.json,
// and that the SAME seed's store ROLL (names/order/subs) is unchanged when
// forced to a non-Pickpocket sub — only the routed line costs move.

// Phase 39 (GEAR-01): Katana re-priced 525 -> 650 and the premium Casket's
// base (Broadsword) re-priced 500 -> 550, so their Pickpocket-marked-up
// numbers move too (Axe/Studded/Rations are unaffected — their base prices
// did not change). Measured live, not hand-computed.
test("seed 3 (a Human Pickpocket): store roll pins Katana 813 / Axe 63 / Studded 938 / Casket 4128 / Rations 38; flat lines unchanged", () => {
  const state = newRun(3);
  assert.equal(state.c.sub, "Pickpocket", "seed 3's hero must be a Pickpocket for this pin to prove anything");
  const rng = makeRng(state.rngState);
  openStore(state, rng, []);
  const byName = Object.fromEntries(state.store.stock.map((s) => [s.n, s.cost]));
  assert.equal(byName["Katana"], 813);
  assert.equal(byName["Axe"], 63);
  assert.equal(byName["Studded"], 938);
  assert.equal(byName["Casket, a broadsword"], 4128);
  assert.equal(byName["Rations (+1 ration)"], 38);
  // flat lines (food/potions/lockpicks) are never routed through priceFor's
  // Pickpocket markup — unchanged regardless of sub.
  assert.equal(byName["Chicken (+12 hp)"], 20);
  assert.equal(byName["Healing potion"], 150);
  assert.equal(byName["Set of lockpicks"], 450);
});

test("seed 3 forced to a Cutthroat: same store roll (names/order/subs), un-marked-up costs", () => {
  const state = newRun(3, [], { force: { sub: "Cutthroat" } });
  assert.equal(state.c.sub, "Cutthroat");
  const rng = makeRng(state.rngState);
  openStore(state, rng, []);
  const byName = Object.fromEntries(state.store.stock.map((s) => [s.n, s.cost]));
  assert.equal(byName["Katana"], 650);
  assert.equal(byName["Axe"], 50);
  assert.equal(byName["Studded"], 750);
  assert.equal(byName["Rations (+1 ration)"], 30);
});

test("seed 3: sellItem on a Pickpocket credits the Pickpocket sell price for a Cloak of Armor", () => {
  const state = newRun(3);
  assert.equal(state.c.sub, "Pickpocket");
  state.c.items = [{ kind: "cloak", n: "Cloak of Armor" }];
  const before = state.c.gold;
  const events = sellItem(state, 0, []);
  assert.equal(state.c.gold, before + 938);
  assert.ok(events.some((e) => e.type === "itemSold" && e.price === 938));
});

// --- purity ---------------------------------------------------------------
// (the project-wide code-line scan — comment-aware — lives in
// test/unit/engine-purity.test.js and already covers this file)

test("economy.js has no ACTUAL Math.random/document/localStorage code reference (comment-stripped)", () => {
  const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
  const raw = fs.readFileSync(path.resolve(__dirname, "..", "..", "engine", "economy.js"), "utf8");
  const codeOnly = raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => {
      const idx = line.indexOf("//");
      return idx === -1 ? line : line.slice(0, idx);
    })
    .join("\n");
  assert.doesNotMatch(codeOnly, /Math\.random/);
  assert.doesNotMatch(codeOnly, /\bdocument\b/);
  assert.doesNotMatch(codeOnly, /\blocalStorage\b/);
});
