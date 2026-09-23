// test/unit/store-delivery.test.js
//
// Phase 61 (STORE-02, STORE-03 rail half): a store purchase always delivers
// what it charges for. buyFrom settles legality and room BEFORE any gold
// moves — every refusal (insufficientGold/bagFull/itemRejected) is atomic
// (state byte-identical). A legal weapon/armor/premium buy that is an
// upgrade auto-equips exactly as before and now names the traded-in piece
// (itemTaken.replaced); a legal buy that is NOT an upgrade is charged and
// stowed with one `purchaseBagged { item, why }` event. The Spiked Staff
// acceptance case (a Magic User buys a Spiked Staff) proves the whole chain
// end to end, including the rail explanation from Plan 02's
// gearCompareParts/upgradeWhyText.
//
import test from "node:test";
import assert from "node:assert/strict";

import { newRun, applyAction } from "../../engine/engine.js";
import { buyFrom, STORE_EFFECTS, storeBuyRefusal } from "../../engine/economy.js";
import { hasPicks, toolItem } from "../../engine/items.js";
import { hasTool, gearCompareParts } from "../../engine/derived.js";
import { WEAPONS, ARMORS } from "../../content/index.js";
import { upgradeWhyText } from "../../src/browser/upgradeWhy.js";

// ─── Fixtures ───────────────────────────────────────────────────────────

/** A minimal, fully-specified Fighter — mirrors test/unit/economy.test.js's
 * own fixedFighter shape, plus a `bag` (that file's own hero is bag-less on
 * purpose; this suite needs bag-cap control for the room-before-payment
 * cases) and a weak starting weapon/armor (Dagger/Cloth) so most candidate
 * gear reads as an upgrade by default. */
function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: null, race: "Human", level: 3, sp: 0,
    maxWP: 60, wp: 45, skills: {}, vp: 0,
    weapon: "Dagger", prof: 0, magicWpn: 0,
    armor: "Cloth", ar: 3, armorMin: 1, armorWP: 12, armorMax: 12, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    rations: 6, gold: 100000, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    bag: "large", // 8 slots — plenty of room unless a test caps it down
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

const GEAR = (n) => ({ kind: "gear", n });

/** Stock-line / item builders mirroring engine/economy.js#openStore's own
 * shapes (weaponLine/armorLine/premiumLine, mk) — that module's own helpers
 * are not exported, so these are hand-built to the SAME contract. */
const mkStock = (n, cost, effectId, effectParams, sub = null) => ({ n, sub, cost, effectId, effectParams: effectParams ?? null, sold: false });

function weaponItem(base, opts = {}) {
  return { kind: "weapon", n: opts.n ?? base, base, bonus: opts.bonus ?? 0, txt: opts.txt ?? WEAPONS[base].lab };
}
function armorItem(name, opts = {}) {
  const a = ARMORS.find((x) => x.name === name);
  const ar = opts.ar ?? a.ar;
  const wp = opts.wp ?? a.wp;
  return { kind: "armor", n: opts.n ?? name, armor: name, ar, wp, min: opts.min ?? a.min, cls: opts.cls ?? a.cls, txt: opts.txt ?? `AR ${ar}` };
}
const weaponLine = (item, cost = 100) => mkStock(item.n, cost, "buyWeapon", { item }, item.txt);
const armorLine = (item, cost = 100) => mkStock(item.n, cost, "buyArmor", { item }, `AR ${item.ar}, ${item.wp} hp`);
const premiumLine = (item, cost = 100) => mkStock(item.n, cost, "buyPremium", { item }, `${item.txt} · enchanted`);

function openWith(state, line) {
  state.store = { stock: [line], haggle: 1, race: state.c.race };
  return state;
}

/** Asserts a pre-payment refusal: exactly one event of `expectedEventType`
 * (optionally `expectedReason`), and the WHOLE state byte-identical to
 * before the call (T-61-06's atomicity guarantee). */
function assertPrePaymentRefusal(state, idx, expectedEventType, expectedReason) {
  const before = structuredClone(state);
  const events = buyFrom(state, idx, []);
  assert.deepStrictEqual(state, before, "a refused buy must be atomic — state unchanged");
  assert.equal(events.length, 1, `expected exactly one event, got ${JSON.stringify(events)}`);
  assert.equal(events[0].type, expectedEventType);
  if (expectedReason !== undefined) assert.equal(events[0].reason, expectedReason);
}

/** For a buyWeapon/buyArmor/buyPremium delivery: EQUIPPED (itemTaken, and
 * c.weapon/c.armor+c.ar now match) OR BAGGED (purchaseBagged, item in
 * c.items) — never neither. */
function assertDeliveredGear(c, events, item, kind) {
  const equipped =
    events.some((e) => e.type === "itemTaken") && (kind === "weapon" ? c.weapon === item.base : c.armor === item.armor && c.ar === item.ar);
  const bagged = events.some((e) => e.type === "purchaseBagged") && c.items.some((i) => i === item);
  assert.ok(equipped || bagged, `expected ${item.n} to be EQUIPPED or BAGGED; events: ${events.map((e) => e.type).join(",")}`);
}

// ─── Spiked Staff acceptance (STORE-02/STORE-03) ───────────────────────

test("Spiked Staff acceptance: a level-3 Quarter-Staff Magic User buys a Spiked Staff — bought+purchaseBagged, why matches gearCompareParts, exact rail string", () => {
  const base = newRun(7);
  const c = { ...base.c, level: 3, weapon: "Quarter Staff", prof: 0, magicWpn: 0, gold: 500 };
  const item = weaponItem("Spiked Staff", { txt: "d8" });
  const line = weaponLine(item, 100);
  const state = { ...base, c, store: { stock: [line], haggle: 1, race: c.race } };
  const preC = structuredClone(c);
  const rngBefore = state.rngState;

  const { state: after, events } = applyAction(state, { type: "buyItem", idx: 0 });

  assert.deepStrictEqual(events.map((e) => e.type), ["bought", "purchaseBagged"]);
  const pb = events.find((e) => e.type === "purchaseBagged");
  assert.deepStrictEqual(pb.why, gearCompareParts(preC, item));
  assert.equal(upgradeWhyText(pb.why), "d8 vs your d6 · −1 to hit · 4.1 vs 5.0 a swing");
  assert.equal(after.c.gold, 400);
  assert.equal(after.c.weapon, "Quarter Staff");
  assert.ok(after.c.items.some((i) => i.n === "Spiked Staff"));
  assert.equal(after.store.stock[0].sold, true);
  assert.equal(after.rngState, rngBefore, "a pure buy draws no rng");
});

// ─── Property: every STORE_EFFECTS effectId delivers ───────────────────

/** deliveryCase(effectId) — a scenario proven to be legal, affordable, and
 * roomy for that effectId: fresh state + a deliverable stock line + a
 * predicate proving the per-effect delivery rule from the plan's
 * <behavior>. */
function deliveryCase(effectId) {
  switch (effectId) {
    case "eatRation": {
      const state = fixedState({ c: { wp: 30, maxWP: 60 } });
      const line = mkStock("Meal (+15 hp)", 20, "eatRation", { wp: 15 });
      return { state, line, predicate: (c) => assert.equal(c.wp, Math.min(60, 30 + 15)) };
    }
    case "buyRations": {
      const state = fixedState({ c: { rations: 5 } });
      const line = mkStock("Rations (+1 ration)", 20, "buyRations", { amount: 1 });
      return { state, line, predicate: (c) => assert.equal(c.rations, 6) };
    }
    case "givePotion": {
      const state = fixedState();
      const item = { kind: "potion", n: "Healing potion", txt: "+d10+2 hp", eff2: "heal", uses: 1 };
      const line = mkStock(item.n, 20, "givePotion", { item });
      return { state, line, predicate: (c) => assert.ok(c.items.some((i) => i.n === "Healing potion")) };
    }
    case "giveLockpicks": {
      const state = fixedState();
      const item = { kind: "picks", n: "Lockpicks", txt: "1–5 on d10 against any lock" };
      const line = mkStock(item.n, 20, "giveLockpicks", { item });
      return { state, line, predicate: (c) => assert.equal(hasPicks(c), true) };
    }
    case "giveTool": {
      const state = fixedState();
      const item = toolItem("torch");
      const line = mkStock(item.n, 20, "giveTool", { item });
      return { state, line, predicate: (c) => assert.equal(hasTool(c, "torch"), true) };
    }
    case "repairArmor": {
      const state = fixedState({ c: { armorWP: 6, armorMax: 12 } });
      const line = mkStock("Repair your cloth", 20, "repairArmor", null);
      return { state, line, predicate: (c) => assert.equal(c.armorWP, c.armorMax) };
    }
    case "buyWeapon": {
      const state = fixedState();
      const item = weaponItem("Long Sword");
      const line = weaponLine(item, 200);
      return { state, line, predicate: (c, events) => assertDeliveredGear(c, events, item, "weapon") };
    }
    case "buyArmor": {
      const state = fixedState();
      const item = armorItem("Plate");
      const line = armorLine(item, 200);
      return { state, line, predicate: (c, events) => assertDeliveredGear(c, events, item, "armor") };
    }
    case "buyScroll": {
      const state = fixedState({ c: { scrolls: 2 } });
      const line = mkStock("Sealed scroll", 20, "buyScroll", null);
      return { state, line, predicate: (c) => assert.equal(c.scrolls, 3) };
    }
    case "buyPremium": {
      const state = fixedState();
      const item = weaponItem("Broadsword", { bonus: 1, n: "Broadsword +1, a broadsword", txt: "d10+2 +1" });
      const line = premiumLine(item, 200);
      return { state, line, predicate: (c, events) => assertDeliveredGear(c, events, item, "weapon") };
    }
    default:
      throw new Error(`store-delivery.test.js: no delivery case authored for effectId "${effectId}" — STORE_EFFECTS gained a new effect; add a case here`);
  }
}

test("property: every STORE_EFFECTS effectId delivers — bought, gold -cost exactly once, sold true, and the per-effect delivery predicate holds", () => {
  const exercised = [];
  for (const effectId of Object.keys(STORE_EFFECTS)) {
    exercised.push(effectId);
    const { state, line, predicate } = deliveryCase(effectId);
    state.c.gold = 100000;
    openWith(state, line);
    const before = structuredClone(state);
    const events = buyFrom(state, 0, []);
    assert.equal(events[0]?.type, "bought", `${effectId}: bought must be the first event`);
    assert.equal(state.c.gold, before.c.gold - line.cost, `${effectId}: gold charged exactly once`);
    assert.equal(state.store.stock[0].sold, true, `${effectId}: stock line marked sold`);
    predicate(state.c, events);
  }
  assert.deepStrictEqual(exercised.sort(), Object.keys(STORE_EFFECTS).sort(), "every STORE_EFFECTS effectId must be exercised");
});

// ─── Legality before payment ────────────────────────────────────────────

test("legality before payment: an Acrobat buying a Long Sword gives itemRejected acrobat, gold/sold unchanged", () => {
  const item = weaponItem("Long Sword");
  const state = openWith(fixedState({ c: { cls: "Thief", sub: "Acrobat", weapon: "Dagger" } }), weaponLine(item, 200));
  assertPrePaymentRefusal(state, 0, "itemRejected", "acrobat");
});

test("legality before payment: a Magic User buying a Broadsword gives wrongClass, gold/sold unchanged", () => {
  const item = weaponItem("Broadsword");
  const state = openWith(fixedState({ c: { cls: "Magic User", sub: null, weapon: "Quarter Staff" } }), weaponLine(item, 200));
  assertPrePaymentRefusal(state, 0, "itemRejected", "wrongClass");
});

test("legality before payment: a Thief without Heft buying Plate gives tooHeavy, gold/sold unchanged", () => {
  const item = armorItem("Plate");
  const state = openWith(fixedState({ c: { cls: "Thief", sub: null, skills: {}, armor: "Leather", ar: 6 } }), armorLine(item, 400));
  assertPrePaymentRefusal(state, 0, "itemRejected", "tooHeavy");
});

test("legality before payment: a Fridgian buying armor gives noArmor, gold/sold unchanged", () => {
  const item = armorItem("Cloth");
  const state = openWith(fixedState({ c: { race: "Fridgian", armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0 } }), armorLine(item, 200));
  assertPrePaymentRefusal(state, 0, "itemRejected", "noArmor");
});

test("legality before payment: a Woodsman buying Mail gives woodsman, gold/sold unchanged", () => {
  const item = armorItem("Mail");
  const state = openWith(fixedState({ c: { sub: "Woodsman", armor: "Cloth", ar: 3, armorMin: 1, armorWP: 12, armorMax: 12 } }), armorLine(item, 700));
  assertPrePaymentRefusal(state, 0, "itemRejected", "woodsman");
});

// ─── Room before payment ─────────────────────────────────────────────────

test("room before payment: a not-better weapon with a full bag refuses bagFull; with one free slot it succeeds and bags", () => {
  const item = weaponItem("Dagger"); // not-better than the wielded Broadsword
  const full = openWith(
    fixedState({ c: { weapon: "Broadsword", bag: "small", items: [GEAR("a"), GEAR("b"), GEAR("c"), GEAR("d")] } }), // 4/4 slots
    weaponLine(item, 50),
  );
  const before = structuredClone(full);
  const events = buyFrom(full, 0, []);
  assert.deepStrictEqual(full, before, "a bagFull refusal must be atomic");
  assert.deepStrictEqual(events, [{ type: "bagFull", item, have: 4, slots: 4 }]);

  const roomy = openWith(
    fixedState({ c: { weapon: "Broadsword", bag: "small", items: [GEAR("a"), GEAR("b"), GEAR("c")] } }), // 3/4 slots
    weaponLine(structuredClone(item), 50),
  );
  const roomyEvents = buyFrom(roomy, 0, []);
  assert.deepStrictEqual(roomyEvents.map((e) => e.type), ["bought", "purchaseBagged"]);
  assert.ok(roomy.c.items.some((i) => i.n === "Dagger"));
});

// ─── Adjacency edges ──────────────────────────────────────────────────────

test("an upgrade still equips even with a full bag — no bagFull, no slot consumed", () => {
  const item = weaponItem("Long Sword"); // an upgrade over the wielded Dagger
  const state = openWith(
    fixedState({ c: { weapon: "Dagger", bag: "small", items: [GEAR("a"), GEAR("b"), GEAR("c"), GEAR("d")] } }), // 4/4 slots
    weaponLine(item, 200),
  );
  const events = buyFrom(state, 0, []);
  assert.ok(events.some((e) => e.type === "itemTaken"));
  assert.ok(!events.some((e) => e.type === "bagFull"));
  assert.equal(state.c.weapon, "Long Sword");
});

test("delta exactly 0 (same base, bonus 0, prof 0) is bagged, not equipped", () => {
  const item = weaponItem("Broadsword"); // same base as wielded -> delta 0
  const wState = openWith(fixedState({ c: { weapon: "Broadsword", prof: 0, magicWpn: 0, bag: "large", items: [] } }), weaponLine(item, 200));
  const wEvents = buyFrom(wState, 0, []);
  assert.deepStrictEqual(wEvents.map((e) => e.type), ["bought", "purchaseBagged"]);
  assert.equal(wState.c.weapon, "Broadsword");
  assert.ok(wState.c.items.some((i) => i.n === "Broadsword"));
});

test("equal-AR armor is bagged, not equipped", () => {
  const aItem = armorItem("Leather"); // same AR as worn
  const aState = openWith(fixedState({ c: { armor: "Leather", ar: 6, bag: "large", items: [] } }), armorLine(aItem, 200));
  const aEvents = buyFrom(aState, 0, []);
  assert.deepStrictEqual(aEvents.map((e) => e.type), ["bought", "purchaseBagged"]);
  assert.equal(aState.c.armor, "Leather");
});

// ─── Trade-in (itemTaken.replaced) ────────────────────────────────────────

test("trade-in: an upgrade over a held Dagger names it in itemTaken.replaced", () => {
  const item = weaponItem("Long Sword");
  const state = openWith(fixedState({ c: { weapon: "Dagger", prof: 0, magicWpn: 0 } }), weaponLine(item, 200));
  const events = buyFrom(state, 0, []);
  const taken = events.find((e) => e.type === "itemTaken");
  assert.equal(taken.replaced?.n, "Dagger");
});

test("trade-in: an armor upgrade over Leather names it in itemTaken.replaced", () => {
  const item = armorItem("Plate");
  const state = openWith(fixedState({ c: { armor: "Leather", ar: 6, armorMin: 1, armorWP: 15, armorMax: 15 } }), armorLine(item, 400));
  const events = buyFrom(state, 0, []);
  const taken = events.find((e) => e.type === "itemTaken");
  assert.equal(taken.replaced?.n, "Leather");
});

test("bare-handed (Fists) / Nothing-wearing / destroyed-armor heroes get an itemTaken with NO replaced key", () => {
  const wItem = weaponItem("Long Sword");
  const bare = openWith(fixedState({ c: { weapon: "Fists", prof: 0, magicWpn: 0 } }), weaponLine(wItem, 200));
  const bareTaken = buyFrom(bare, 0, []).find((e) => e.type === "itemTaken");
  assert.ok(bareTaken, "expected an itemTaken event");
  assert.ok(!("replaced" in bareTaken), "a bare-handed equip must carry no replaced key");

  const aItem = armorItem("Leather");
  const nothing = openWith(fixedState({ c: { armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0 } }), armorLine(aItem, 200));
  const nothingTaken = buyFrom(nothing, 0, []).find((e) => e.type === "itemTaken");
  assert.ok(nothingTaken, "expected an itemTaken event");
  assert.ok(!("replaced" in nothingTaken), "a Nothing-wearing equip must carry no replaced key");

  const pItem = armorItem("Plate");
  const destroyed = openWith(fixedState({ c: { armor: "Leather", ar: 6, armorMin: 1, armorWP: 0, armorMax: 15 } }), armorLine(pItem, 400));
  const destroyedTaken = buyFrom(destroyed, 0, []).find((e) => e.type === "itemTaken");
  assert.ok(destroyedTaken, "expected an itemTaken event");
  assert.ok(!("replaced" in destroyedTaken), "a destroyed-armor equip must carry no replaced key");
});

// ─── Precedence ────────────────────────────────────────────────────────

test("precedence: short gold on an illegal item gives only buyFailed", () => {
  const item = weaponItem("Broadsword"); // wrongClass for a Magic User
  const state = openWith(fixedState({ c: { cls: "Magic User", sub: null, weapon: "Quarter Staff", gold: 10 } }), weaponLine(item, 500));
  assertPrePaymentRefusal(state, 0, "buyFailed", "insufficientGold");
});

test("precedence: an illegal item on a full bag gives only itemRejected", () => {
  const item = weaponItem("Broadsword"); // wrongClass for a Magic User
  const state = openWith(
    fixedState({ c: { cls: "Magic User", sub: null, weapon: "Quarter Staff", bag: "small", items: [GEAR("a"), GEAR("b"), GEAR("c"), GEAR("d")] } }),
    weaponLine(item, 100),
  );
  assertPrePaymentRefusal(state, 0, "itemRejected", "wrongClass");
});

// ─── Idempotency ─────────────────────────────────────────────────────────

test("idempotency: two buyItem dispatches on the same row charge once and deliver once; the second is a silent no-op", () => {
  const item = weaponItem("Long Sword");
  const state = openWith(fixedState({ c: { weapon: "Dagger" } }), weaponLine(item, 200));
  buyFrom(state, 0, []);
  const goldAfterFirst = state.c.gold;
  const itemsAfterFirst = structuredClone(state.c.items);
  const weaponAfterFirst = state.c.weapon;
  const events2 = buyFrom(state, 0, []);
  assert.deepStrictEqual(events2, []);
  assert.equal(state.c.gold, goldAfterFirst);
  assert.deepStrictEqual(state.c.items, itemsAfterFirst);
  assert.equal(state.c.weapon, weaponAfterFirst);
});

// ─── Concurrency / bag-less ────────────────────────────────────────────

test("a bag-less (parity) character is never refused bagFull", () => {
  const item = weaponItem("Dagger"); // not-better than the wielded Broadsword
  const state = openWith(fixedState({ c: { weapon: "Broadsword", bag: undefined } }), weaponLine(item, 50));
  const events = buyFrom(state, 0, []);
  assert.ok(!events.some((e) => e.type === "bagFull"));
  assert.ok(events.some((e) => e.type === "purchaseBagged"));
});

// ─── Premium lines ───────────────────────────────────────────────────────

test("premium lines: a rollBlade-shaped illegal weapon premium refuses before payment", () => {
  const illegalPremium = weaponItem("Broadsword", { bonus: 2, n: "Broadsword +2, a broadsword", txt: "d10+2 +2" });
  const illegalState = openWith(fixedState({ c: { cls: "Magic User", sub: null, weapon: "Quarter Staff" } }), premiumLine(illegalPremium, 500));
  assertPrePaymentRefusal(illegalState, 0, "itemRejected", "wrongClass");
});

test("premium lines: a rollMailPiece-shaped legal armor premium equips or bags by its delta", () => {
  const legalArmorPremium = armorItem("Studded", { n: "Warded studded", ar: 14, wp: 24 });
  const legalState = openWith(fixedState({ c: { armor: "Leather", ar: 6 } }), premiumLine(legalArmorPremium, 500));
  const events = buyFrom(legalState, 0, []);
  assertDeliveredGear(legalState.c, events, legalArmorPremium, "armor");
});

// ─── storeBuyRefusal purity ────────────────────────────────────────────

test("storeBuyRefusal: null for a deliverable line, pure (c and line unchanged), the same reason buyFrom acts on otherwise", () => {
  const item = weaponItem("Long Sword");
  const line = weaponLine(item, 200);
  const state = fixedState({ c: { weapon: "Dagger" } });
  const cBefore = structuredClone(state.c);
  const lineBefore = structuredClone(line);
  assert.equal(storeBuyRefusal(state.c, line), null);
  assert.deepStrictEqual(state.c, cBefore);
  assert.deepStrictEqual(line, lineBefore);

  const shortState = fixedState({ c: { gold: 0 } });
  assert.deepStrictEqual(storeBuyRefusal(shortState.c, line), { reason: "insufficientGold", short: line.cost });
});
