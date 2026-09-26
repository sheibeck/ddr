// test/unit/gear-view-models.test.js
//
// Phase 62 (GSCR-01..06), Plan 01 — behavior, edge, purity and copy coverage
// for every pure Gear-tab view model added this plan: gearHeaderModel,
// gearUseCell, gearWornModel, gearBagMeterModel, gearBagCardsModel,
// gearConsumablesModel, gearKitRows, plus GEAR_WORN_ORDER and the extended
// GEAR_COPY/emptySlotRows they read. Every model is exercised as plain
// `{ c }` state objects (mirroring test/unit/gear-panels.test.js's
// fixedChar pattern) except the one heal-enabled agreement test, which
// spins up a real `newRun` state so `combatMenuViewModel` has every field
// it reads.

import test from "node:test";
import assert from "node:assert/strict";

import {
  GEAR_COPY,
  GEAR_WORN_ORDER,
  ITEM_STATE_COPY,
  emptySlotRows,
  itemRowState,
  bagUsage,
  gearHeaderModel,
  gearUseCell,
  gearWornModel,
  gearBagMeterModel,
  gearBagCardsModel,
  gearConsumablesModel,
  gearKitRows,
} from "../../src/browser/gearTab.js";
import { armorDisplay, bagArmorText, usableBy, dropShelfItems } from "../../src/browser/viewModels.js";
import { combatMenuViewModel } from "../../src/browser/combatMenu.js";
import { newRun } from "../../engine/state.js";
import { maxCharges } from "../../engine/movement.js";
import { WEAPONS } from "../../content/index.js";

// ─── fixtures ────────────────────────────────────────────────────────────

function fixedChar(overrides = {}) {
  return {
    cls: "Fighter",
    race: "Human",
    level: 1,
    weapon: "Axe",
    armor: "Mail",
    ar: 12,
    armorWP: 30,
    armorMax: 30,
    magicWpn: 0,
    gold: 0,
    items: [],
    worn: {},
    potions: 0,
    scrolls: 0,
    rations: 0,
    kills: 0,
    wp: 10,
    maxWP: 10,
    ...overrides,
  };
}

const st = (c) => ({ c });

// ═══════════════════════ Task 1: header / worn / use cell ═════════════════

// ─── GEAR_WORN_ORDER ────────────────────────────────────────────────────

test("GEAR_WORN_ORDER is the frozen five-key display order", () => {
  assert.deepStrictEqual(GEAR_WORN_ORDER, ["weapon", "armor", "cloak", "jewelry1", "jewelry2"]);
  assert.ok(Object.isFrozen(GEAR_WORN_ORDER));
});

// ─── gearHeaderModel ────────────────────────────────────────────────────

test("gearHeaderModel: a bare Fighter reads ARMOR RATING 0, WILMST 0", () => {
  const c = fixedChar({ armor: "Nothing", ar: 0, armorWP: 0, armorMax: 0, gold: 0 });
  assert.deepStrictEqual(gearHeaderModel(st(c)), {
    stats: [
      { key: "ar", label: "ARMOR RATING", value: 0, text: "0" },
      { key: "gold", label: "WILMST", value: 0, text: "0" },
    ],
  });
});

test("gearHeaderModel: gold 1234 reads WILMST '1,234'", () => {
  const c = fixedChar({ gold: 1234 });
  assert.equal(gearHeaderModel(st(c)).stats[1].text, "1,234");
});

test("gearHeaderModel: worn Mail gives ar.value === armorDisplay(c).ar", () => {
  const c = fixedChar({ armor: "Mail", ar: 12, armorWP: 30, armorMax: 30 });
  assert.equal(gearHeaderModel(st(c)).stats[0].value, armorDisplay(c).ar);
});

test("gearHeaderModel: an active Cloak of Armor over Mail gives ar.value === the magic armorDisplay(c).ar", () => {
  const c = fixedChar({
    armor: "Mail", ar: 12, armorWP: 30, armorMax: 30,
    worn: { cloak: { kind: "cloak", n: "Cloak of Armor", eff: { cloakArmor: 4 } } },
    timers: { "item:Cloak of Armor": { cadence: "squares", left: 50, cd: 50, phase: "effect" } },
  });
  const armorD = armorDisplay(c);
  assert.ok(armorD.magic);
  assert.equal(gearHeaderModel(st(c)).stats[0].value, armorD.ar);
});

// ─── Edge GSCR-01 ───────────────────────────────────────────────────────

test("Edge GSCR-01/adjacency: AR and WILMST equal (both 0 bare) still returns two separate labelled stats, in order", () => {
  const c = fixedChar({ armor: "Nothing", ar: 0, armorWP: 0, armorMax: 0, gold: 0 });
  const model = gearHeaderModel(st(c));
  assert.equal(model.stats.length, 2);
  assert.equal(model.stats[0].label, "ARMOR RATING");
  assert.equal(model.stats[1].label, "WILMST");
});

test("Edge GSCR-01/empty: a bare character never reads blank/undefined/NaN for either stat", () => {
  const c = fixedChar({ armor: "Nothing", ar: 0, armorWP: 0, armorMax: 0, gold: 0 });
  const model = gearHeaderModel(st(c));
  for (const s of model.stats) {
    assert.notEqual(s.text, "");
    assert.notEqual(s.text, "undefined");
    assert.notEqual(s.text, "NaN");
  }
});

test("Edge GSCR-01/encoding: gold 1234 -> '1,234' (toLocaleString); AR text is a plain integer string", () => {
  const c = fixedChar({ gold: 1234, ar: 12 });
  const model = gearHeaderModel(st(c));
  assert.equal(model.stats[1].text, "1,234");
  assert.equal(model.stats[0].text, String(armorDisplay(c).ar));
});

test("Edge GSCR-01/ordering: stats[0] is always ARMOR RATING and stats[1] is always WILMST", () => {
  for (const c of [fixedChar(), fixedChar({ gold: 500 }), fixedChar({ armor: "Nothing", ar: 0, armorWP: 0, armorMax: 0 })]) {
    const model = gearHeaderModel(st(c));
    assert.equal(model.stats[0].key, "ar");
    assert.equal(model.stats[1].key, "gold");
  }
});

// ─── gearUseCell ────────────────────────────────────────────────────────

test("gearUseCell: a weapon item, rope, ladder or picks give null", () => {
  const weapon = { n: "Club", kind: "weapon", base: "Club" };
  const rope = { n: "Rope", kind: "tool", tool: "rope" };
  const ladder = { n: "Ladder", kind: "tool", tool: "ladder" };
  const picks = { n: "Lockpicks", kind: "picks" };
  for (const it of [weapon, rope, ladder, picks]) {
    assert.equal(gearUseCell(st(fixedChar()), it), null);
  }
});

test("gearUseCell: a potion and the torch (consumable) read USE with empty sub", () => {
  const potion = { n: "Speed potion", kind: "potion", eff2: "speed" };
  const torch = { n: "Torch", kind: "tool", tool: "torch", use: "light" };
  for (const it of [potion, torch]) {
    assert.deepStrictEqual(gearUseCell(st(fixedChar()), it), { phase: "consumable", label: "USE", sub: "", remaining: 0 });
  }
});

test("gearUseCell: a worn Cloak of Speed with no timer record reads READY -> USE, empty sub", () => {
  const cloak = { n: "Cloak of Speed", kind: "cloak", use: "haste" };
  assert.deepStrictEqual(gearUseCell(st(fixedChar()), cloak), { phase: "ready", label: "USE", sub: "", remaining: 0 });
});

test("gearUseCell, effect: left 23 gives ACTIVE '23 SQ'; left 1 gives ACTIVE '1 SQ'", () => {
  const cloak = { n: "Cloak of Speed", kind: "cloak", use: "haste" };
  const c23 = fixedChar({ timers: { "item:Cloak of Speed": { cadence: "squares", left: 23, phase: "effect" } } });
  assert.deepStrictEqual(gearUseCell(st(c23), cloak), { phase: "effect", label: "ACTIVE", sub: "23 SQ", remaining: 23 });
  const c1 = fixedChar({ timers: { "item:Cloak of Speed": { cadence: "squares", left: 1, phase: "effect" } } });
  assert.deepStrictEqual(gearUseCell(st(c1), cloak), { phase: "effect", label: "ACTIVE", sub: "1 SQ", remaining: 1 });
});

test("gearUseCell, cooldown: left 12 gives COOLING '12 SQ'; left 1 gives COOLING '1 SQ'", () => {
  const cloak = { n: "Cloak of Speed", kind: "cloak", use: "haste" };
  const c12 = fixedChar({ timers: { "item:Cloak of Speed": { cadence: "squares", left: 12, phase: "cooldown" } } });
  assert.deepStrictEqual(gearUseCell(st(c12), cloak), { phase: "cooldown", label: "COOLING", sub: "12 SQ", remaining: 12 });
  const c1 = fixedChar({ timers: { "item:Cloak of Speed": { cadence: "squares", left: 1, phase: "cooldown" } } });
  assert.deepStrictEqual(gearUseCell(st(c1), cloak), { phase: "cooldown", label: "COOLING", sub: "1 SQ", remaining: 1 });
});

test("gearUseCell, charges: a recharging staff's sub equals itemRowState(state, it).text", () => {
  const staff = { n: "Pine Staff", kind: "staff", use: "fire", charges: 0 };
  const c = fixedChar({ timers: { "charges:Pine Staff": { cadence: "squares", left: 94, phase: "cooldown" } } });
  const stt = st(c);
  const cell = gearUseCell(stt, staff);
  assert.equal(cell.phase, "charges");
  assert.equal(cell.label, "USE");
  assert.equal(cell.sub, itemRowState(stt, staff).text);
});

test("gearUseCell: phase always equals itemRowState(state, it).kind, across every case above", () => {
  const cloak = { n: "Cloak of Speed", kind: "cloak", use: "haste" };
  const cases = [
    fixedChar(),
    fixedChar({ timers: { "item:Cloak of Speed": { cadence: "squares", left: 5, phase: "effect" } } }),
    fixedChar({ timers: { "item:Cloak of Speed": { cadence: "squares", left: 5, phase: "cooldown" } } }),
  ];
  for (const c of cases) {
    const stt = st(c);
    const cell = gearUseCell(stt, cloak);
    assert.equal(cell.phase, itemRowState(stt, cloak).kind);
  }
});

// ─── Edge GSCR-03 ───────────────────────────────────────────────────────

test("Edge GSCR-03/adjacency: exactly 1 SQ remaining reads '1 SQ'; an item with no timer record reads USE with an empty sub", () => {
  const cloak = { n: "Cloak of Speed", kind: "cloak", use: "haste" };
  const c1 = fixedChar({ timers: { "item:Cloak of Speed": { cadence: "squares", left: 1, phase: "effect" } } });
  assert.equal(gearUseCell(st(c1), cloak).sub, "1 SQ");
  assert.deepStrictEqual(gearUseCell(st(fixedChar()), cloak), { phase: "ready", label: "USE", sub: "", remaining: 0 });
});

test("Edge GSCR-03/empty: weapon and armor rows never carry a use cell; an item with no activation gets null", () => {
  const weapon = { n: "Club", kind: "weapon", base: "Club" };
  const rope = { n: "Rope", kind: "tool", tool: "rope" };
  const ladder = { n: "Ladder", kind: "tool", tool: "ladder" };
  const picks = { n: "Lockpicks", kind: "picks" };
  for (const it of [weapon, rope, ladder, picks]) {
    assert.equal(gearUseCell(st(fixedChar()), it), null);
  }
});

test("Edge GSCR-03/encoding: label/sub come only from GEAR_COPY.use / ITEM_STATE_COPY / itemRowState text, never the item name", () => {
  const cloak = { n: "Cloak of Speed", kind: "cloak", use: "haste" };
  const c = fixedChar({ timers: { "item:Cloak of Speed": { cadence: "squares", left: 7, phase: "effect" } } });
  const cell = gearUseCell(st(c), cloak);
  assert.ok(!cell.label.includes(cloak.n));
  assert.ok(!cell.sub.includes(cloak.n));
  assert.equal(cell.label, GEAR_COPY.use.active);
  assert.equal(cell.sub, "7 SQ");
});

// ─── gearWornModel ──────────────────────────────────────────────────────

test("gearWornModel, bare Fighter: countText '0 / 5', every row empty", () => {
  const c = fixedChar({ weapon: "Fists", armor: "Nothing", ar: 0, armorWP: 0, armorMax: 0, worn: {} });
  const model = gearWornModel(st(c));
  assert.equal(model.filled, 0);
  assert.equal(model.max, 5);
  assert.equal(model.countText, "0 / 5");
  assert.deepStrictEqual(model.rows.map((r) => r.key), GEAR_WORN_ORDER.slice());
  for (const row of model.rows) {
    assert.equal(row.filled, false);
    assert.equal(row.name, "empty");
    assert.equal(row.note, GEAR_COPY.empty[row.key]);
    assert.equal(row.value, "—");
    assert.equal(row.use, null);
    assert.equal(row.useRef, null);
    assert.equal(row.unequip, null);
  }
});

test("gearWornModel, weapon: a +2 Broadsword reads value 'd10+2 +2' and note weaponMagic; unenchanted reads 'd10+2' and weaponMundane", () => {
  const magic = fixedChar({ weapon: "Broadsword", magicWpn: 2 });
  const rowMagic = gearWornModel(st(magic)).rows.find((r) => r.key === "weapon");
  assert.equal(rowMagic.value, "d10+2 +2");
  assert.equal(rowMagic.note, GEAR_COPY.weaponMagic.replace("{n}", 2));
  assert.equal(rowMagic.unequip.slot, "weapon");

  const mundane = fixedChar({ weapon: "Broadsword", magicWpn: 0 });
  const rowMundane = gearWornModel(st(mundane)).rows.find((r) => r.key === "weapon");
  assert.equal(rowMundane.value, "d10+2");
  assert.equal(rowMundane.note, GEAR_COPY.weaponMundane);
});

test("gearWornModel, armor: Mail 22/40 hp reads value 'AR 12', note '22/40 hp'; destroyed reads 'destroyed' and unequip.blocked stays false on a full bag", () => {
  const worn = fixedChar({ armor: "Mail", ar: 12, armorWP: 22, armorMax: 40 });
  const rowWorn = gearWornModel(st(worn)).rows.find((r) => r.key === "armor");
  assert.equal(rowWorn.name, "Mail");
  assert.equal(rowWorn.value, "AR 12");
  assert.equal(rowWorn.note, "22/40 hp");

  // Full bag (small cap 4): 4 slot items.
  const destroyed = fixedChar({
    armor: "Mail", ar: 12, armorWP: 0, armorMax: 40, bag: "small",
    items: [
      { kind: "jewel", n: "A" }, { kind: "jewel", n: "B" },
      { kind: "jewel", n: "C" }, { kind: "jewel", n: "D" },
    ],
  });
  const rowDestroyed = gearWornModel(st(destroyed)).rows.find((r) => r.key === "armor");
  assert.equal(rowDestroyed.note, "destroyed");
  assert.equal(rowDestroyed.unequip.blocked, false);
});

test("gearWornModel: an active Cloak of Armor over Mail — cloak row 'Cloak of Armor', armor row 'Mail', value 'AR <c.ar>', note === armorDisplay(c).under", () => {
  const c = fixedChar({
    armor: "Mail", ar: 12, armorWP: 22, armorMax: 40,
    worn: { cloak: { kind: "cloak", n: "Cloak of Armor", eff: { cloakArmor: 4 } } },
    timers: { "item:Cloak of Armor": { cadence: "squares", left: 50, cd: 50, phase: "effect" } },
  });
  const armorD = armorDisplay(c);
  const model = gearWornModel(st(c));
  const cloakRow = model.rows.find((r) => r.key === "cloak");
  const armorRow = model.rows.find((r) => r.key === "armor");
  assert.equal(cloakRow.name, "Cloak of Armor");
  assert.equal(armorRow.name, "Mail");
  assert.equal(armorRow.value, `AR ${c.ar}`);
  assert.equal(armorRow.note, armorD.under);
});

test("gearWornModel: an active Cloak of Armor with no plate — armor row filled, magicPlate name, note under, unequip null", () => {
  const c = fixedChar({
    armor: "Nothing", ar: 0, armorWP: 0, armorMax: 0,
    worn: { cloak: { kind: "cloak", n: "Cloak of Armor", eff: { cloakArmor: 4 } } },
    timers: { "item:Cloak of Armor": { cadence: "squares", left: 50, cd: 50, phase: "effect" } },
  });
  const armorD = armorDisplay(c);
  const armorRow = gearWornModel(st(c)).rows.find((r) => r.key === "armor");
  assert.equal(armorRow.filled, true);
  assert.equal(armorRow.name, GEAR_COPY.magicPlate);
  assert.equal(armorRow.value, `AR ${armorD.ar}`);
  assert.equal(armorRow.note, armorD.under);
  assert.equal(armorRow.unequip, null);
});

test("gearWornModel, worn jewel in jewelry1: value '—', note it.txt, use === gearUseCell(state, it), useRef/unequip target jewelry1", () => {
  const ring = { kind: "jewel", n: "Ring of Power", txt: "a ring, of power, allegedly", eff: { dmg: 1 } };
  const c = fixedChar({ worn: { jewelry1: ring } });
  const stt = st(c);
  const row = gearWornModel(stt).rows.find((r) => r.key === "jewelry1");
  assert.equal(row.value, "—");
  assert.equal(row.note, ring.txt);
  assert.deepStrictEqual(row.use, gearUseCell(stt, ring));
  assert.ok(row.use !== null, "Ring of Power is expected to resolve an activation for this assertion to be meaningful");
  assert.deepStrictEqual(row.useRef, { slot: "jewelry1" });
  assert.deepStrictEqual(row.unequip, { slot: "jewelry1", blocked: false });
});

test("gearWornModel: two jewels with the same name in jewelry1/jewelry2 give two filled rows; all five filled reads '5 / 5'; only jewelry2 filled keeps key order", () => {
  const c = fixedChar({
    weapon: "Axe", armor: "Mail", ar: 12, armorWP: 30, armorMax: 30,
    worn: {
      cloak: { kind: "cloak", n: "Cloak", txt: "a cloak" },
      jewelry1: { kind: "jewel", n: "Gem", txt: "a gem" },
      jewelry2: { kind: "jewel", n: "Gem", txt: "a gem" },
    },
  });
  const model = gearWornModel(st(c));
  assert.equal(model.filled, 5);
  assert.equal(model.countText, "5 / 5");
  assert.equal(model.rows.find((r) => r.key === "jewelry1").filled, true);
  assert.equal(model.rows.find((r) => r.key === "jewelry2").filled, true);

  const onlyJ2 = fixedChar({
    weapon: "Fists", armor: "Nothing", ar: 0, armorWP: 0, armorMax: 0,
    worn: { jewelry2: { kind: "jewel", n: "Gem", txt: "a gem" } },
  });
  const modelJ2 = gearWornModel(st(onlyJ2));
  assert.deepStrictEqual(modelJ2.rows.map((r) => r.key), GEAR_WORN_ORDER.slice());
  assert.equal(modelJ2.rows.find((r) => r.key === "jewelry2").filled, true);
  assert.equal(modelJ2.rows.find((r) => r.key === "jewelry1").filled, false);
});

test("gearWornModel, encoding: a jewel with punctuation/angle-brackets/emoji in its name comes through row.name verbatim", () => {
  const weird = "Thief's \"Lucky\" <Ring> 🎲";
  const c = fixedChar({ worn: { jewelry1: { kind: "jewel", n: weird, txt: "a strange ring" } } });
  const row = gearWornModel(st(c)).rows.find((r) => r.key === "jewelry1");
  assert.equal(row.name, weird);
});

// ─── Edge GSCR-02 ───────────────────────────────────────────────────────

test("Edge GSCR-02/boundary: a bare-handed unarmoured unadorned character reads '0 / 5'; a fully-geared one reads '5 / 5'", () => {
  const bare = fixedChar({ weapon: "Fists", armor: "Nothing", ar: 0, armorWP: 0, armorMax: 0, worn: {} });
  assert.equal(gearWornModel(st(bare)).countText, "0 / 5");

  const full = fixedChar({
    weapon: "Axe", armor: "Mail", ar: 12, armorWP: 30, armorMax: 30,
    worn: {
      cloak: { kind: "cloak", n: "Cloak", txt: "a cloak" },
      jewelry1: { kind: "jewel", n: "Ring", txt: "a ring" },
      jewelry2: { kind: "jewel", n: "Bracelet", txt: "a bracelet" },
    },
  });
  assert.equal(gearWornModel(st(full)).countText, "5 / 5");
});

test("Edge GSCR-02/adjacency: two jewels with the same name worn in jewelry1 and jewelry2 are two separate filled rows", () => {
  const c = fixedChar({
    worn: {
      jewelry1: { kind: "jewel", n: "Gem", txt: "a gem" },
      jewelry2: { kind: "jewel", n: "Gem", txt: "a gem" },
    },
  });
  const rows = gearWornModel(st(c)).rows;
  assert.equal(rows.find((r) => r.key === "jewelry1").filled, true);
  assert.equal(rows.find((r) => r.key === "jewelry2").filled, true);
});

test("Edge GSCR-02/empty: Fists yields the weapon empty row with GEAR_COPY.empty.weapon; each of the five rows falls back to its own in-voice line", () => {
  const c = fixedChar({ weapon: "Fists", armor: "Nothing", ar: 0, armorWP: 0, armorMax: 0, worn: {} });
  const rows = gearWornModel(st(c)).rows;
  for (const row of rows) {
    assert.equal(row.note, GEAR_COPY.empty[row.key]);
  }
  assert.equal(rows.find((r) => r.key === "weapon").note, GEAR_COPY.empty.weapon);
});

test("Edge GSCR-02/ordering: row keys are always weapon, armor, cloak, jewelry1, jewelry2, including when only jewelry2 is filled", () => {
  const c = fixedChar({ weapon: "Fists", armor: "Nothing", ar: 0, armorWP: 0, armorMax: 0, worn: { jewelry2: { kind: "jewel", n: "Gem" } } });
  assert.deepStrictEqual(gearWornModel(st(c)).rows.map((r) => r.key), ["weapon", "armor", "cloak", "jewelry1", "jewelry2"]);
});

test("Edge GSCR-02/precision: armor value is an integer 'AR <c.ar>'; wear reads '<armorWP>/<armorMax> hp' or 'destroyed'; a +2 Broadsword reads 'd10+2 +2'", () => {
  const worn = fixedChar({ armor: "Mail", ar: 12, armorWP: 22, armorMax: 40 });
  const rowWorn = gearWornModel(st(worn)).rows.find((r) => r.key === "armor");
  assert.equal(rowWorn.value, "AR 12");
  assert.equal(rowWorn.note, "22/40 hp");

  const destroyed = fixedChar({ armor: "Mail", ar: 12, armorWP: 0, armorMax: 40 });
  const rowDestroyed = gearWornModel(st(destroyed)).rows.find((r) => r.key === "armor");
  assert.equal(rowDestroyed.note, "destroyed");

  const blade = fixedChar({ weapon: "Broadsword", magicWpn: 2 });
  const rowBlade = gearWornModel(st(blade)).rows.find((r) => r.key === "weapon");
  assert.equal(rowBlade.value, "d10+2 +2");
  assert.equal(WEAPONS["Broadsword"].lab, "d10+2");
});

// ═══════════════════════ Task 2: bag meter / cards / consumables / kit ════

// ─── gearBagMeterModel ──────────────────────────────────────────────────

test("gearBagMeterModel, small bag (cap 4) holding 3 slot items + 2 potions + 3 scrolls: 3 / 4, not full", () => {
  const c = fixedChar({
    bag: "small",
    items: [
      { kind: "jewel", n: "A" }, { kind: "tool", n: "Rope", tool: "rope" }, { kind: "weapon", n: "Club", base: "Club" },
      { kind: "potion", n: "P1", eff2: "speed" }, { kind: "potion", n: "P2", eff2: "speed" },
    ],
    scrolls: 3,
  });
  const model = gearBagMeterModel(st(c));
  assert.equal(model.have, 3);
  assert.equal(model.slots, 4);
  assert.equal(model.countText, "3 / 4");
  assert.deepStrictEqual(model.pips, [true, true, true, false]);
  assert.equal(model.full, false);
  assert.equal(model.fullLine, "");
  assert.equal(model.freeRide, GEAR_COPY.freeRide);
});

test("gearBagMeterModel: at cap (4/4) every pip is lit, full is true, fullLine === GEAR_COPY.bagFull", () => {
  const c = fixedChar({
    bag: "small",
    items: [{ kind: "jewel", n: "A" }, { kind: "jewel", n: "B" }, { kind: "jewel", n: "C" }, { kind: "jewel", n: "D" }],
  });
  const model = gearBagMeterModel(st(c));
  assert.equal(model.full, true);
  assert.ok(model.pips.every(Boolean));
  assert.equal(model.fullLine, GEAR_COPY.bagFull);
});

test("gearBagMeterModel: medium/large/exlarge bags give pips.length 6/8/10", () => {
  const expected = { medium: 6, large: 8, exlarge: 10 };
  for (const [tier, n] of Object.entries(expected)) {
    const c = fixedChar({ bag: tier, items: [] });
    assert.equal(gearBagMeterModel(st(c)).pips.length, n);
  }
});

test("gearBagMeterModel, bag-less character: slots null, pips [], freeRide '', countText matches bagUsage(c).text", () => {
  const empty = fixedChar({ bag: undefined, items: [] });
  const modelEmpty = gearBagMeterModel(st(empty));
  assert.equal(modelEmpty.slots, null);
  assert.deepStrictEqual(modelEmpty.pips, []);
  assert.equal(modelEmpty.freeRide, "");
  assert.equal(modelEmpty.countText, "");

  const two = fixedChar({ bag: undefined, items: [{ kind: "jewel", n: "A" }, { kind: "jewel", n: "B" }] });
  const modelTwo = gearBagMeterModel(st(two));
  assert.equal(modelTwo.countText, "2");
});

test("gearBagMeterModel: countText === bagUsage(c).text across several shapes", () => {
  const shapes = [
    fixedChar({ bag: "small", items: [{ kind: "jewel", n: "A" }] }),
    fixedChar({ bag: undefined, items: [] }),
    fixedChar({ bag: undefined, items: [{ kind: "jewel", n: "A" }, { kind: "jewel", n: "B" }] }),
    fixedChar({ bag: "large", items: [], scrolls: 4, potions: 2 }),
  ];
  for (const c of shapes) {
    assert.equal(gearBagMeterModel(st(c)).countText, bagUsage(c).text);
  }
});

// ─── Edge GSCR-04 ───────────────────────────────────────────────────────

test("Edge GSCR-04/boundary: at have === cap the model is full; at have === cap - 1 it is not full and fullLine is ''", () => {
  const full = fixedChar({ bag: "small", items: [{ kind: "jewel", n: "A" }, { kind: "jewel", n: "B" }, { kind: "jewel", n: "C" }, { kind: "jewel", n: "D" }] });
  const modelFull = gearBagMeterModel(st(full));
  assert.equal(modelFull.full, true);
  assert.ok(modelFull.fullLine.length > 0);

  const notFull = fixedChar({ bag: "small", items: [{ kind: "jewel", n: "A" }, { kind: "jewel", n: "B" }, { kind: "jewel", n: "C" }] });
  const modelNotFull = gearBagMeterModel(st(notFull));
  assert.equal(modelNotFull.full, false);
  assert.equal(modelNotFull.fullLine, "");
});

test("Edge GSCR-04/precision: pips.length equals the bag cap exactly, and the number of lit pips equals have", () => {
  const c = fixedChar({ bag: "medium", items: [{ kind: "jewel", n: "A" }, { kind: "jewel", n: "B" }] });
  const model = gearBagMeterModel(st(c));
  assert.equal(model.pips.length, 6);
  assert.equal(model.pips.filter(Boolean).length, 2);
});

// ─── gearBagCardsModel ──────────────────────────────────────────────────

test("gearBagCardsModel, order and index: potions are skipped without shifting index; matches dropShelfItems(c).map(e => e.i)", () => {
  const jewel = { kind: "jewel", n: "Ring", txt: "a ring" };
  const potion = { kind: "potion", n: "P", eff2: "speed" };
  const rope = { kind: "tool", n: "Rope", tool: "rope" };
  const staff = { kind: "staff", n: "Poplar Staff", use: "heal", charges: 3 };
  const c = fixedChar({ items: [jewel, potion, rope, staff] });
  const cards = gearBagCardsModel(st(c));
  assert.deepStrictEqual(cards.map((card) => card.i), [0, 2, 3]);
  assert.deepStrictEqual(cards.map((card) => card.i), dropShelfItems(c).map((e) => e.i));
});

test("gearBagCardsModel, weapon card: WEAPON when bare-fisted, WEAPON · SWAP when a real weapon is wielded", () => {
  const club = { kind: "weapon", n: "Club", base: "Club" };
  const bare = fixedChar({ weapon: "Fists", items: [club] });
  assert.equal(gearBagCardsModel(st(bare))[0].tag, "WEAPON");

  const wielded = fixedChar({ weapon: "Axe", items: [club] });
  assert.equal(gearBagCardsModel(st(wielded))[0].tag, "WEAPON · SWAP");
});

test("gearBagCardsModel, armor card: ARMOR · SWAP when armor is worn, else ARMOR; desc starts with bagArmorText(it)", () => {
  const bagged = { kind: "armor", n: "Studded", ar: 10, wp: 18, left: 18, cls: "FT" };
  const worn = fixedChar({ armor: "Mail", ar: 12, armorWP: 30, armorMax: 30, items: [bagged] });
  const cardWorn = gearBagCardsModel(st(worn))[0];
  assert.equal(cardWorn.tag, "ARMOR · SWAP");
  assert.ok(cardWorn.desc.startsWith(bagArmorText(bagged)));

  const unworn = fixedChar({ armor: "Nothing", ar: 0, armorWP: 0, armorMax: 0, items: [bagged] });
  const cardUnworn = gearBagCardsModel(st(unworn))[0];
  assert.equal(cardUnworn.tag, "ARMOR");
});

test("gearBagCardsModel, jewel card: JEWELRY with only jewelry1 worn; JEWELRY · SWAP with both jewelry keys worn; a cloak card reads CLOAK · SWAP when a cloak is worn", () => {
  const jewel = { kind: "jewel", n: "Ring", txt: "a ring" };
  const oneWorn = fixedChar({ worn: { jewelry1: { kind: "jewel", n: "Bracelet", txt: "worn" } }, items: [jewel] });
  assert.equal(gearBagCardsModel(st(oneWorn))[0].tag, "JEWELRY");

  const bothWorn = fixedChar({
    worn: { jewelry1: { kind: "jewel", n: "Bracelet", txt: "worn" }, jewelry2: { kind: "jewel", n: "Amulet", txt: "worn" } },
    items: [jewel],
  });
  assert.equal(gearBagCardsModel(st(bothWorn))[0].tag, "JEWELRY · SWAP");

  const cloakItem = { kind: "cloak", n: "Traveler's Cloak", txt: "a plain cloak" };
  const cloakWorn = fixedChar({ worn: { cloak: { kind: "cloak", n: "Cloak", txt: "worn" } }, items: [cloakItem] });
  assert.equal(gearBagCardsModel(st(cloakWorn))[0].tag, "CLOAK · SWAP");
});

// RULES-13 (Phase 75, user 2026-09-25): reverses the pre-Phase-75 reading
// that a bagged staff "gets a use cell" — a bagged staff's power is inert
// (75-09's engine-side `notWielded` refusal), so it never carries a USE cell
// anywhere, for ANY class. A Fighter's bagged staff (this test's fixedChar
// default class) also carries no family at all — it cannot wield one.
test("gearBagCardsModel, bag-only items: rope gives family null/tag ''/use null/useRef null; a Fighter's bagged staff is the same (RULES-13: never a use cell); the torch reads consumable", () => {
  const rope = { kind: "tool", n: "Rope", tool: "rope" };
  const staff = { kind: "staff", n: "Poplar Staff", use: "heal", charges: 3 };
  const torch = { kind: "tool", n: "Torch", tool: "torch", use: "light" };
  const c = fixedChar({ items: [rope, staff, torch] });
  const stt = st(c);
  const cards = gearBagCardsModel(stt);

  const ropeCard = cards.find((card) => card.name === "Rope");
  assert.equal(ropeCard.family, null);
  assert.equal(ropeCard.tag, "");
  assert.equal(ropeCard.use, null);
  assert.equal(ropeCard.useRef, null);

  const staffCard = cards.find((card) => card.name === "Poplar Staff");
  assert.equal(staffCard.family, null, "a Fighter cannot wield a staff — no family");
  assert.equal(staffCard.tag, "");
  assert.equal(staffCard.use, null, "RULES-13: a bagged staff never gets a use cell, even though itemRowState reads it ready");
  assert.equal(staffCard.useRef, null);

  const torchCard = cards.find((card) => card.name === "Torch");
  assert.equal(torchCard.use.phase, "consumable");
});

// RULES-13 (Phase 75): a Magic User's bagged staff is a WEAPON-family card
// instead — EQUIP TO / SWAP INTO WEAPON lives on the sheet (gear-sheet-model
// tests), not a USE cell here.
test("gearBagCardsModel, RULES-13: a Magic User's bagged staff is family 'weapon' (SWAP tagged once a weapon is held), never a use cell", () => {
  const staff = { kind: "staff", n: "Poplar Staff", use: "heal", charges: 3 };

  const bareHanded = fixedChar({ cls: "Magic User", weapon: "Fists", items: [staff] });
  const bareCard = gearBagCardsModel(st(bareHanded))[0];
  assert.equal(bareCard.family, "weapon");
  assert.equal(bareCard.tag, "WEAPON");
  assert.equal(bareCard.use, null);
  assert.equal(bareCard.useRef, null);

  const wielding = fixedChar({ cls: "Magic User", weapon: "Quarter Staff", items: [staff] });
  const swapCard = gearBagCardsModel(st(wielding))[0];
  assert.equal(swapCard.tag, "WEAPON · SWAP");
});

test("gearBagCardsModel: a bagged jewel/cloak has use null even though itemRowState reads it ready (equippable gear only works from its worn slot)", () => {
  const ring = { kind: "jewel", n: "Ring of Power", txt: "a ring", eff: { dmg: 1 } };
  const c = fixedChar({ items: [ring] });
  const stt = st(c);
  assert.notEqual(itemRowState(stt, ring).kind, "none");
  const card = gearBagCardsModel(stt)[0];
  assert.equal(card.use, null);
});

test("gearBagCardsModel: a Fighter-only weapon card for a Magic User desc ends with usableBy(it, c) ('not you'); an unrestricted jewel's desc === it.txt", () => {
  const bastard = { kind: "weapon", n: "Bastard Sword", base: "Bastard Sword" };
  const mu = fixedChar({ cls: "Magic User", weapon: "Rapier", items: [bastard] });
  const card = gearBagCardsModel(st(mu))[0];
  assert.ok(card.desc.includes("not you"));
  assert.ok(card.desc.endsWith(usableBy(bastard, mu)));

  const plainJewel = { kind: "jewel", n: "Plain Ring", txt: "a plain ring" };
  const withPlain = fixedChar({ items: [plainJewel] });
  const jewelCard = gearBagCardsModel(st(withPlain))[0];
  assert.equal(jewelCard.desc, plainJewel.txt);
});

test("gearBagCardsModel: a bag of only potion items yields []; a weird name comes through verbatim", () => {
  const onlyPotions = fixedChar({ items: [{ kind: "potion", n: "P1", eff2: "speed" }, { kind: "potion", n: "P2", eff2: "speed" }] });
  assert.deepStrictEqual(gearBagCardsModel(st(onlyPotions)), []);

  const weird = "Thief's \"Lucky\" <Charm> 🎲";
  const withWeird = fixedChar({ items: [{ kind: "jewel", n: weird, txt: "a strange charm" }] });
  assert.equal(gearBagCardsModel(st(withWeird))[0].name, weird);
});

// ─── Edge GSCR-05 ───────────────────────────────────────────────────────

test("Edge GSCR-05/adjacency: a bagged jewel reads JEWELRY with only jewelry1 worn, JEWELRY · SWAP with both jewelry keys worn", () => {
  const jewel = { kind: "jewel", n: "Ring", txt: "a ring" };
  const oneWorn = fixedChar({ worn: { jewelry1: { kind: "jewel", n: "Bracelet", txt: "worn" } }, items: [jewel] });
  assert.equal(gearBagCardsModel(st(oneWorn))[0].tag, "JEWELRY");
  const bothWorn = fixedChar({
    worn: { jewelry1: { kind: "jewel", n: "Bracelet", txt: "worn" }, jewelry2: { kind: "jewel", n: "Amulet", txt: "worn" } },
    items: [jewel],
  });
  assert.equal(gearBagCardsModel(st(bothWorn))[0].tag, "JEWELRY · SWAP");
});

test("Edge GSCR-05/empty: a bag holding only potion items, or nothing, yields zero cards", () => {
  assert.deepStrictEqual(gearBagCardsModel(st(fixedChar({ items: [] }))), []);
  assert.deepStrictEqual(
    gearBagCardsModel(st(fixedChar({ items: [{ kind: "potion", n: "P", eff2: "speed" }] }))),
    [],
  );
});

test("Edge GSCR-05/ordering: card indices follow c.items order and equal dropShelfItems(c).map(e => e.i); potions are skipped without shifting the index", () => {
  const c = fixedChar({
    items: [
      { kind: "jewel", n: "A" },
      { kind: "potion", n: "P", eff2: "speed" },
      { kind: "tool", n: "Rope", tool: "rope" },
      { kind: "staff", n: "Poplar Staff", use: "heal" },
    ],
  });
  const cards = gearBagCardsModel(st(c));
  assert.deepStrictEqual(cards.map((card) => card.i), [0, 2, 3]);
  assert.deepStrictEqual(cards.map((card) => card.i), dropShelfItems(c).map((e) => e.i));
});

// ─── gearConsumablesModel ───────────────────────────────────────────────

test("gearConsumablesModel, nothing held: rows are exactly [heal] at ×0, heldText '0 HELD'", () => {
  const c = fixedChar({ potions: 0, items: [], scrolls: 0 });
  const model = gearConsumablesModel(st(c));
  assert.equal(model.rows.length, 1);
  assert.deepStrictEqual(model.rows[0], {
    key: "heal",
    name: "HEALING POTION",
    qty: 0,
    qtyText: "×0",
    desc: "Heals. Wasted at full health.",
    verb: "USE",
    enabled: false,
    reason: "",
    dispatch: { type: "drinkPotion" },
  });
  assert.equal(model.heldText, "0 HELD");
});

test("gearConsumablesModel: heal.enabled agrees with the combat ITEMS potion row's own rule, at low HP and at full HP", () => {
  const full = newRun(24601, [], { force: { cls: "Fighter" } });
  full.c.potions = 3;
  full.c.wp = Math.max(1, full.c.maxWP - 1);

  const lowModel = gearConsumablesModel(full);
  const lowMenu = combatMenuViewModel(full);
  const lowPotionRow = lowMenu.submenus.items.rows.find((r) => r.id === "potion");
  assert.equal(lowModel.rows[0].enabled, true);
  assert.equal(lowModel.rows[0].enabled, lowPotionRow.enabled);

  full.c.wp = full.c.maxWP;
  const fullModel = gearConsumablesModel(full);
  const fullMenu = combatMenuViewModel(full);
  const fullPotionRow = fullMenu.submenus.items.rows.find((r) => r.id === "potion");
  assert.equal(fullModel.rows[0].enabled, false);
  assert.equal(fullModel.rows[0].enabled, fullPotionRow.enabled);
});

test("gearConsumablesModel, buff items: grouped by name in first-appearance order, ×N, desc is the first item's txt", () => {
  const acute1 = { kind: "potion", n: "Acuteness potion (blue)", eff2: "acuteness", txt: "sharpens the mind" };
  const strength = { kind: "potion", n: "Strength potion", eff2: "strength", txt: "hardens the arm" };
  const acute2 = { kind: "potion", n: "Acuteness potion (blue)", eff2: "acuteness", txt: "sharpens the mind (again)" };
  const c = fixedChar({ items: [{ kind: "jewel", n: "filler0" }, acute1, strength, { kind: "jewel", n: "filler3" }, acute2] });
  const model = gearConsumablesModel(st(c));
  assert.equal(model.rows.length, 3);
  assert.equal(model.rows[1].name, "Acuteness potion (blue)");
  assert.equal(model.rows[1].qty, 2);
  assert.equal(model.rows[1].qtyText, "×2");
  assert.equal(model.rows[1].desc, acute1.txt);
  assert.deepStrictEqual(model.rows[1].dispatch, { type: "useItem", i: 1 });
  assert.equal(model.rows[2].name, "Strength potion");
  assert.equal(model.rows[2].qty, 1);
  assert.deepStrictEqual(model.rows[2].dispatch, { type: "useItem", i: 2 });
});

test("gearConsumablesModel, scrolls: a readable Magic User gets SCROLLS ×N, verb READ, enabled true, reason ''", () => {
  const c = fixedChar({ cls: "Magic User", scrolls: 2 });
  const scrollRow = gearConsumablesModel(st(c)).rows.find((r) => r.key === "scroll");
  assert.equal(scrollRow.name, "SCROLLS");
  assert.equal(scrollRow.qtyText, "×2");
  assert.equal(scrollRow.verb, "READ");
  assert.equal(scrollRow.enabled, true);
  assert.equal(scrollRow.reason, "");
});

// RULES-10 (Phase 75.1): canRead is gone — a Pilfer Thief and a Fighter
// without Runes/Signs now READ under the intelligence rule, so their SCROLLS
// row is enabled with no refusal reason, exactly like a Magic User's.
test("gearConsumablesModel: a Pilfer Thief and a Fighter without Runes/Signs both get an enabled SCROLLS row with no reason", () => {
  const pilfer = fixedChar({ cls: "Thief", sub: "Pilfer", scrolls: 1 });
  const pilferRow = gearConsumablesModel(st(pilfer)).rows.find((r) => r.key === "scroll");
  assert.equal(pilferRow.enabled, true);
  assert.equal(pilferRow.reason, "");

  const fighter = fixedChar({ cls: "Fighter", scrolls: 1 });
  const fighterRow = gearConsumablesModel(st(fighter)).rows.find((r) => r.key === "scroll");
  assert.equal(fighterRow.enabled, true);
  assert.equal(fighterRow.reason, "");
});

test("gearConsumablesModel: potions 3 + 3 buff items + scrolls 2 gives heldText '8 HELD'", () => {
  const c = fixedChar({
    cls: "Magic User",
    potions: 3,
    scrolls: 2,
    items: [
      { kind: "potion", n: "Acuteness potion (blue)", eff2: "acuteness", txt: "x" },
      { kind: "potion", n: "Acuteness potion (blue)", eff2: "acuteness", txt: "x" },
      { kind: "potion", n: "Strength potion", eff2: "strength", txt: "y" },
    ],
  });
  assert.equal(gearConsumablesModel(st(c)).heldText, "8 HELD");
  assert.equal(gearConsumablesModel(st(c)).held, 8);
});

// ─── gearKitRows ────────────────────────────────────────────────────────

test("gearKitRows, Fighter with rations 4 and kills 0: [Rations '4 days', Kills '0']", () => {
  const c = fixedChar({ rations: 4, kills: 0 });
  assert.deepStrictEqual(gearKitRows(st(c)), [
    { label: "Rations", value: "4 days" },
    { label: "Kills", value: "0" },
  ]);
});

test("gearKitRows: a Magic User with spellsUsed 1 gets the second row Spell charges", () => {
  const c = fixedChar({ cls: "Magic User", level: 1, spellsUsed: 1, rations: 0, kills: 0 });
  const rows = gearKitRows(st(c));
  const max = maxCharges(c);
  assert.deepStrictEqual(rows[1], { label: "Spell charges", value: `${max - 1} / ${max}` });
});

test("gearKitRows, running effects: order is Rations, Shield, Strength, Regeneration, Mirror Self, Sense Presence, Sense Danger, Map the Floor, Kills", () => {
  const c = fixedChar({
    rations: 5, kills: 3,
    ward: { name: "Shield", pool: 9, rounds: 3 },
    might: 2, regen: true, mirror: 3, senses: true, foresight: true,
    timers: { "spell:reveal": { phase: "effect", left: 12 } },
  });
  assert.deepStrictEqual(gearKitRows(st(c)), [
    { label: "Rations", value: "5 days" },
    { label: "Shield", value: "9 hp left · 3 rds" },
    { label: "Strength", value: "+2 damage" },
    { label: "Regeneration", value: "d8 a round" },
    { label: "Mirror Self", value: "3 rds" },
    { label: "Sense Presence", value: "till the fight ends" },
    { label: "Sense Danger", value: "armed" },
    { label: "Map the Floor", value: "12 sq" },
    { label: "Kills", value: "3" },
  ]);
});

// RULES-14 (Phase 75, deviation Rule 1): an armed Bubble mirror's row reads
// "next hit" instead of interpolating wardValue against a null rounds.
test("gearKitRows: an armed Bubble mirror reads the ward row as 'Bubble — next hit'; a popped pool reads the plain pool/rounds shape", () => {
  const armed = fixedChar({
    rations: 0, kills: 0,
    ward: { name: "Bubble", mirror: true, pool: 0, popPool: 25, rounds: null },
  });
  const armedRow = gearKitRows(st(armed)).find((r) => r.label === "Bubble");
  assert.deepStrictEqual(armedRow, { label: "Bubble", value: "next hit" });

  const popped = fixedChar({ rations: 0, kills: 0, ward: { name: "Bubble", pool: 25, rounds: 1 } });
  const poppedRow = gearKitRows(st(popped)).find((r) => r.label === "Bubble");
  assert.deepStrictEqual(poppedRow, { label: "Bubble", value: "25 hp left · 1 rds" });
});

test("gearKitRows: no row is ever labelled Potions, Scrolls or Wilmst", () => {
  const c = fixedChar({ potions: 5, scrolls: 3, gold: 999, rations: 1, kills: 0 });
  const labels = gearKitRows(st(c)).map((r) => r.label);
  for (const bad of ["Potions", "Scrolls", "Wilmst"]) assert.ok(!labels.includes(bad));
});

// ─── Edge GSCR-06 ───────────────────────────────────────────────────────

test("Edge GSCR-06/boundary: potions 0 still yields HEALING POTION ×0 disabled; scrolls 0 yields no SCROLLS row", () => {
  const c = fixedChar({ potions: 0, scrolls: 0 });
  const model = gearConsumablesModel(st(c));
  assert.equal(model.rows[0].qtyText, "×0");
  assert.equal(model.rows[0].enabled, false);
  assert.ok(!model.rows.some((r) => r.key === "scroll"));
});

test("Edge GSCR-06/adjacency: two buff potions with the same name group into one ×2 row; different names stay separate rows", () => {
  const c = fixedChar({
    items: [
      { kind: "potion", n: "Acuteness potion (blue)", eff2: "acuteness", txt: "x" },
      { kind: "potion", n: "Acuteness potion (blue)", eff2: "acuteness", txt: "x" },
      { kind: "potion", n: "Strength potion", eff2: "strength", txt: "y" },
    ],
  });
  const rows = gearConsumablesModel(st(c)).rows;
  assert.equal(rows.length, 3);
  assert.equal(rows.find((r) => r.name === "Acuteness potion (blue)").qty, 2);
  assert.equal(rows.find((r) => r.name === "Strength potion").qty, 1);
});

test("Edge GSCR-06/empty: nothing held yields only the ×0 healing row and '0 HELD'", () => {
  const c = fixedChar({ potions: 0, scrolls: 0, items: [] });
  const model = gearConsumablesModel(st(c));
  assert.equal(model.rows.length, 1);
  assert.equal(model.heldText, "0 HELD");
});

test("Edge GSCR-06/ordering: HEALING POTION first, then buff groups in first-appearance order, then SCROLLS; kit rows keep Kills last", () => {
  const c = fixedChar({
    cls: "Magic User",
    potions: 1,
    scrolls: 1,
    items: [
      { kind: "potion", n: "Strength potion", eff2: "strength", txt: "y" },
      { kind: "potion", n: "Acuteness potion (blue)", eff2: "acuteness", txt: "x" },
    ],
  });
  const rows = gearConsumablesModel(st(c)).rows;
  assert.deepStrictEqual(rows.map((r) => r.key), ["heal", "potion:Strength potion", "potion:Acuteness potion (blue)", "scroll"]);

  const kitRows = gearKitRows(st(fixedChar({ rations: 1, kills: 5 })));
  assert.equal(kitRows[kitRows.length - 1].label, "Kills");
});

test("Edge GSCR-06/precision: heldText counts potions + buff items + scrolls exactly; Spell charges reads '<max-spellsUsed> / <max>'", () => {
  const c = fixedChar({
    cls: "Magic User", level: 2, spellsUsed: 2,
    potions: 2, scrolls: 1,
    items: [{ kind: "potion", n: "Strength potion", eff2: "strength", txt: "y" }],
  });
  assert.equal(gearConsumablesModel(st(c)).held, 4);
  const rows = gearKitRows(st(c));
  const max = maxCharges(c);
  assert.deepStrictEqual(rows[1], { label: "Spell charges", value: `${max - 2} / ${max}` });
});

// ═══════════════════════ Purity ════════════════════════════════════════

test("Purity: every new model is pure — two calls deep-equal, the state's JSON is unchanged, and a legacy c with no worn/items/timers never throws", () => {
  const legacy = { c: { weapon: "Fists", armor: "Nothing" } };
  const models = [
    () => gearHeaderModel(legacy),
    () => gearUseCell(legacy, { n: "Cloak of Speed", kind: "cloak", use: "haste" }),
    () => gearWornModel(legacy),
    () => gearBagMeterModel(legacy),
    () => gearBagCardsModel(legacy),
    () => gearConsumablesModel(legacy),
    () => gearKitRows(legacy),
  ];
  for (const build of models) {
    assert.doesNotThrow(build);
    const before = JSON.stringify(legacy);
    const a = build();
    const b = build();
    assert.deepStrictEqual(a, b);
    assert.equal(JSON.stringify(legacy), before);
  }

  // A richer, fully-populated character too — same purity guarantee.
  const rich = st(fixedChar({
    cls: "Magic User", level: 3, spellsUsed: 1,
    weapon: "Broadsword", magicWpn: 1,
    armor: "Mail", ar: 12, armorWP: 20, armorMax: 30,
    worn: {
      cloak: { kind: "cloak", n: "Cloak of Armor", eff: { cloakArmor: 4 } },
      jewelry1: { kind: "jewel", n: "Ring of Power", txt: "a ring", eff: { dmg: 1 } },
    },
    timers: { "item:Cloak of Armor": { cadence: "squares", left: 50, cd: 50, phase: "effect" } },
    bag: "medium",
    items: [{ kind: "jewel", n: "Spare Ring", txt: "spare" }, { kind: "potion", n: "Speed potion", eff2: "speed" }],
    potions: 2, scrolls: 1, rations: 3, kills: 4, gold: 500,
  }));
  const richModels = [
    () => gearHeaderModel(rich),
    () => gearWornModel(rich),
    () => gearBagMeterModel(rich),
    () => gearBagCardsModel(rich),
    () => gearConsumablesModel(rich),
    () => gearKitRows(rich),
  ];
  for (const build of richModels) {
    const before = JSON.stringify(rich);
    const a = build();
    const b = build();
    assert.deepStrictEqual(a, b);
    assert.equal(JSON.stringify(rich), before);
  }
});
