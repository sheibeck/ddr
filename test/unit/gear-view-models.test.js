// test/unit/gear-view-models.test.js
//
// Phase 62 (GSCR-01..06), Plan 01, Task 1 — behavior, edge and purity
// coverage for the slim header, five-row WORN list and USE cell pure Gear-
// tab view models: gearHeaderModel, gearUseCell, gearWornModel, plus
// GEAR_WORN_ORDER and the extended GEAR_COPY/emptySlotRows they read.
// (Task 2 extends this file with the bag meter, bag cards, consumables and
// kit-row models.) Every model is exercised as plain `{ c }` state objects,
// mirroring test/unit/gear-panels.test.js's fixedChar pattern.

import test from "node:test";
import assert from "node:assert/strict";

import {
  GEAR_COPY,
  GEAR_WORN_ORDER,
  itemRowState,
  gearHeaderModel,
  gearUseCell,
  gearWornModel,
} from "../../src/browser/gearTab.js";
import { armorDisplay } from "../../src/browser/viewModels.js";
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

// ═══════════════════════ Purity ════════════════════════════════════════

test("Purity (Task 1 models): gearHeaderModel/gearUseCell/gearWornModel — two calls deep-equal, the state's JSON is unchanged, and a legacy c with no worn/items/timers never throws", () => {
  const legacy = { c: { weapon: "Fists", armor: "Nothing" } };
  const models = [
    () => gearHeaderModel(legacy),
    () => gearUseCell(legacy, { n: "Cloak of Speed", kind: "cloak", use: "haste" }),
    () => gearWornModel(legacy),
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
  ];
  for (const build of richModels) {
    const before = JSON.stringify(rich);
    const a = build();
    const b = build();
    assert.deepStrictEqual(a, b);
    assert.equal(JSON.stringify(rich), before);
  }
});
