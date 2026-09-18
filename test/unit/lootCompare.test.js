// test/unit/lootCompare.test.js
//
// Phase 29 (LOOT-03): lootCompare/bagUsage pin — the compare-to-equipped
// view-model that reads takeItem's OWN weaponUpgradeDelta/armorUpgradeDelta
// (engine/items.js) rather than restating the "is this better" rule, plus
// the bagFull/bagUpgraded presentation entries (toasts.js/eventNarration.js).

import test from "node:test";
import assert from "node:assert/strict";

import { lootCompare, bagUsage, bagArmorText } from "../../src/browser/viewModels.js";
import { TOAST_FOR } from "../../src/browser/toasts.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { WEAPONS } from "../../content/index.js";
import { takeItem, canEquipWeapon } from "../../engine/items.js";

function fixedChar(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1,
    weapon: "Broadsword", prof: 0, magicWpn: 0,
    armor: "Leather", ar: 6, armorMin: 1, armorWP: 15, armorMax: 15, patches: 0,
    skills: {}, gold: 50, rations: 6, scrolls: 0, maxWP: 55, wp: 40,
    bag: "small", items: [],
    ...overrides,
  };
}

// --- weapon compare ---------------------------------------------------

test("lootCompare: a strictly-better weapon is an upgrade, equip-now", () => {
  // Phase 39 (GEAR-01): weaponUpgradeDelta is now expectedStrike-based. This
  // fixedChar is a Fighter/Soldier (noCrit) wielding a Broadsword (need 0,
  // dieN 20 at level 1): expectedStrike(Broadsword,+2) - expectedStrike
  // (Broadsword,+0) = 0.25*(1+7.5+2) - 0.25*(1+7.5) = 2.625 - 2.125 = 0.5.
  const c = fixedChar();
  const it = { kind: "weapon", base: "Broadsword", bonus: 2, n: "Broadsword +2", txt: "d10+2 +2" };
  const cmp = lootCompare(c, it);
  assert.equal(cmp.kind, "weapon");
  assert.equal(cmp.legal, true);
  assert.equal(cmp.reason, null);
  assert.equal(cmp.delta, 0.5);
  assert.equal(cmp.upgrade, true);
  assert.equal(cmp.equipNow, true);
  assert.equal(cmp.line, "+0.5 a swing");
  assert.equal(cmp.sub, it.txt);
});

test("lootCompare: a not-better weapon reads 'not an upgrade', no equip-now", () => {
  const c = fixedChar();
  const it = { kind: "weapon", base: "Dagger", bonus: 0, n: "Dagger", txt: "d6/2" };
  const cmp = lootCompare(c, it);
  assert.equal(cmp.upgrade, false);
  assert.equal(cmp.equipNow, false);
  assert.equal(cmp.line, "not an upgrade");
});

test("lootCompare: class-illegal weapon reads 'can't use (Fighter only)'", () => {
  const mu = fixedChar({ cls: "Magic User", weapon: "Club", prof: 0, magicWpn: 0 });
  const it = { kind: "weapon", base: "Broadsword", bonus: 3, n: "Broadsword +3", txt: "d10+2 +3" };
  const cmp = lootCompare(mu, it);
  assert.equal(cmp.legal, false);
  assert.equal(cmp.reason, "wrongClass");
  assert.equal(cmp.equipNow, false);
  assert.ok(cmp.line.startsWith("can't use ("));
  assert.equal(cmp.line, "can't use (Fighter only)");
});

test("lootCompare: an Acrobat offered a non-dagger reads the acrobat-specific line", () => {
  const acrobat = fixedChar({ cls: "Thief", sub: "Acrobat", weapon: "Dagger", prof: 0, magicWpn: 0 });
  const it = { kind: "weapon", base: "Long Sword", bonus: 0, n: "Long Sword", txt: "d8" };
  const cmp = lootCompare(acrobat, it);
  assert.equal(cmp.reason, "acrobat");
  assert.equal(cmp.line, "can't use (Acrobat: dagger only)");
});

// --- armor compare ------------------------------------------------------

test("lootCompare: a strictly-better armor is an upgrade with a fresh-drop durability sub", () => {
  const c = fixedChar({ ar: 6 });
  const it = { kind: "armor", n: "Plate", armor: "Plate", ar: 15, wp: 45, min: 2, cls: "F", txt: "AR 15" };
  const cmp = lootCompare(c, it);
  assert.equal(cmp.delta, 9);
  assert.equal(cmp.upgrade, true);
  assert.equal(cmp.equipNow, true);
  assert.equal(cmp.line, "AR 15 vs your AR 6 · upgrade");
  assert.equal(cmp.sub, "45/45 hp");
});

test("lootCompare: a worn piece's remaining durability shows in sub (30/45), destroyed at 0", () => {
  const c = fixedChar({ ar: 6 });
  const worn = { kind: "armor", n: "Plate", armor: "Plate", ar: 15, wp: 45, left: 30, min: 2, cls: "F", txt: "AR 15" };
  assert.equal(lootCompare(c, worn).sub, "30/45 hp");
  const destroyed = { kind: "armor", n: "Plate", armor: "Plate", ar: 15, wp: 45, left: 0, min: 2, cls: "F", txt: "AR 15" };
  assert.equal(lootCompare(c, destroyed).sub, "destroyed");
});

test("lootCompare: equal AR armor is not an upgrade", () => {
  const c = fixedChar({ ar: 6 });
  const it = { kind: "armor", n: "Leather", armor: "Leather", ar: 6, wp: 15, min: 1, cls: "FT", txt: "AR 6" };
  const cmp = lootCompare(c, it);
  assert.equal(cmp.upgrade, false);
  assert.equal(cmp.line, "AR 6 vs your AR 6 · not an upgrade");
});

test("lootCompare: a noArmor race reads 'your kind wears no armour'", () => {
  const fridgian = fixedChar({ race: "Fridgian", armor: "Nothing", ar: 0, armorMax: 0, armorWP: 0 });
  const it = { kind: "armor", n: "Cloth", armor: "Cloth", ar: 3, wp: 12, min: 1, cls: "FTM", txt: "AR 3" };
  const cmp = lootCompare(fridgian, it);
  assert.equal(cmp.reason, "noArmor");
  assert.equal(cmp.line, "can't use (your kind wears no armour)");
});

test("lootCompare: a Woodsman offered Plate reads the woodsman-specific line", () => {
  const woodsman = fixedChar({ sub: "Woodsman", armor: "Leather", ar: 6 });
  const it = { kind: "armor", n: "Plate", armor: "Plate", ar: 15, wp: 45, min: 2, cls: "F", txt: "AR 15" };
  const cmp = lootCompare(woodsman, it);
  assert.equal(cmp.reason, "woodsman");
  assert.equal(cmp.line, "can't use (no mail or plate for a Woodsman)");
});

test("lootCompare: a plain Thief offered Mail reads 'can't use (Fighter only)' (tooHeavy)", () => {
  const thief = fixedChar({ cls: "Thief", sub: "Cutthroat", weapon: "Dagger", armor: "Leather", ar: 6 });
  const it = { kind: "armor", n: "Mail", armor: "Mail", ar: 12, wp: 30, min: 3, cls: "F", txt: "AR 12" };
  const cmp = lootCompare(thief, it);
  assert.equal(cmp.reason, "tooHeavy");
  assert.equal(cmp.line, "can't use (Fighter only)");
});

// --- bag / misc compare ---------------------------------------------------

test("lootCompare: a bag item shows the slot delta, never equip-now", () => {
  const c = fixedChar({ bag: "small" });
  const it = { kind: "bag", tier: "medium", n: "Medium bag", txt: "6 slots. Room to regret more things." };
  const cmp = lootCompare(c, it);
  assert.equal(cmp.equipNow, false);
  assert.equal(cmp.upgrade, null);
  assert.equal(cmp.legal, true);
  assert.equal(cmp.line, "6 slots — you carry 4");
  assert.equal(cmp.sub, "");
});

test("lootCompare: a plain treasure item (jewel) just shows its txt", () => {
  const c = fixedChar();
  const it = { kind: "jewel", n: "Ring", txt: "x" };
  const cmp = lootCompare(c, it);
  assert.equal(cmp.equipNow, false);
  assert.equal(cmp.upgrade, null);
  assert.equal(cmp.legal, true);
  assert.equal(cmp.line, "x");
  assert.equal(cmp.sub, "");
});

// --- lootCompare never disagrees with takeItem (property check) -----------

test("lootCompare.upgrade === (takeItem emits itemTaken), for every legal weapon base x bonus 0..2", () => {
  let checked = 0;
  for (const base of Object.keys(WEAPONS)) {
    for (const bonus of [0, 1, 2]) {
      const c = fixedChar({ weapon: "Broadsword", prof: 0, magicWpn: 0 });
      const it = { kind: "weapon", base, bonus, n: base, txt: base };
      if (!canEquipWeapon(c, it)) continue; // only legal gear is a meaningful "is this an upgrade" comparison
      checked++;
      const cmp = lootCompare(c, it);
      const state = { c: structuredClone(c) };
      const events = takeItem(state, it, []);
      const tookIt = events.some((e) => e.type === "itemTaken");
      assert.equal(cmp.upgrade, tookIt, `base=${base} bonus=${bonus}: lootCompare.upgrade must equal takeItem's itemTaken outcome`);
    }
  }
  assert.ok(checked > 0, "at least one legal base/bonus combo must have been checked");
});

// --- bagUsage -------------------------------------------------------------

test("bagUsage: counts gear only, reports full/text", () => {
  const gear = (n) => ({ kind: "gear", n });
  const potion = (n) => ({ kind: "potion", n });
  assert.deepStrictEqual(bagUsage({ bag: "small", items: [gear("a"), gear("b"), gear("c"), potion("p")] }), {
    have: 3,
    slots: 4,
    full: false,
    text: "3 / 4",
  });
  assert.deepStrictEqual(bagUsage({ bag: "small", items: [gear("a"), gear("b"), gear("c"), gear("d")] }), {
    have: 4,
    slots: 4,
    full: true,
    text: "4 / 4",
  });
  assert.deepStrictEqual(bagUsage({ items: [gear("a"), gear("b")] }), { have: 2, slots: null, full: false, text: "2" });
  assert.deepStrictEqual(bagUsage({}), { have: 0, slots: null, full: false, text: "" });
});

// --- presentation: bagFull / bagUpgraded -----------------------------------

test("TOAST_FOR.bagFull: richer text with have/slots, sane fallback without", () => {
  const withCounts = TOAST_FOR.bagFull({ type: "bagFull", have: 4, slots: 4 });
  assert.equal(withCounts.text, "Bag full (4/4) — drop something to make room.");
  assert.equal(withCounts.tone, "block");
  const bare = TOAST_FOR.bagFull({ type: "bagFull" });
  assert.equal(bare.text, "No room in the bag.");
});

test("TOAST_FOR.bagUpgraded: names the new slot count; bare call is non-empty", () => {
  const t = TOAST_FOR.bagUpgraded({ type: "bagUpgraded", to: "medium", slots: 6 });
  assert.equal(t.text, "Bigger bag: 6 slots.");
  assert.equal(t.tone, "hit");
  const bare = TOAST_FOR.bagUpgraded({ type: "bagUpgraded" });
  assert.ok(bare.text.length > 0);
});

test("EVENT_NARRATION.bagUpgraded: names the item and slot count; bare call does not throw", () => {
  const html = EVENT_NARRATION.bagUpgraded({ type: "bagUpgraded", item: { n: "Medium bag" }, slots: 6 });
  assert.match(html, /6 slots/);
  assert.match(html, /<span class="hit">/);
  assert.doesNotThrow(() => EVENT_NARRATION.bagUpgraded({ type: "bagUpgraded" }));
});

test("EVENT_NARRATION.bagFull: appends (have/slots) when present, unchanged wording otherwise", () => {
  const withCounts = EVENT_NARRATION.bagFull({ type: "bagFull", item: { n: "X" }, have: 4, slots: 4 });
  assert.match(withCounts, /\(4\/4\)/);
  const withoutCounts = EVENT_NARRATION.bagFull({ type: "bagFull", item: { n: "X" } });
  assert.doesNotMatch(withoutCounts, /\(\d+\/\d+\)/);
});

void bagArmorText;
