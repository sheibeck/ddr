// test/unit/gear-sheet-model.test.js
//
// Phase 63 (GSCR-07..10, GRULE-02), Plan 01 — behavior, acceptance, combat
// lock, edge and purity coverage for gearSheetModel(state, target) and
// GEAR_SHEET_COPY (src/browser/gearSheet.js). Every assertion cross-checks
// the model against the SAME engine/view-model rules it reads (lootCompare,
// gearWornModel, gearBagCardsModel, gearLockReason, LINE_FOR.gearRefused)
// rather than restating game-rule literals, except the strings CONTEXT/
// GSCR-07..09 pin exactly. Task 2 appends the module-contract section below.

import test from "node:test";
import assert from "node:assert/strict";

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { gearSheetModel, GEAR_SHEET_COPY } from "../../src/browser/gearSheet.js";
import { GEAR_COPY, GEAR_WORN_ORDER, gearWornModel, gearBagCardsModel } from "../../src/browser/gearTab.js";
import { armorDisplay, lootCompare } from "../../src/browser/viewModels.js";
import { LINE_FOR } from "../../src/browser/narrationLines.js";
import { newRun } from "../../engine/engine.js";
import { toolItem } from "../../engine/items.js";
import { fixedStates } from "./harness/shellSandbox.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

// ─── fixtures (mirrors test/unit/gear-tab-dom.test.js's own fixedChar) ─────

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
    gold: 250,
    items: [],
    worn: {},
    potions: 0,
    scrolls: 0,
    rations: 3,
    kills: 2,
    wp: 10,
    maxWP: 10,
    timers: {},
    ...overrides,
  };
}

const st = (c) => ({ c });

const RING_OF_POWER = { kind: "jewelry", n: "Ring of Power", txt: "used, it adds +1 damage to every attack for fifty squares; then fifty squares of quiet" };
const GAUNTLET = { kind: "jewelry", n: "Gauntlet of the Giant", txt: "used, you are one size larger for fifty squares; mind the ceilings, then fifty squares of shrinking back" };
const AMULET_OF_LIGHT = { kind: "jewelry", n: "Amulet of Light", txt: "used, it lights fifty squares and tells the dark to leave at once; then it sulks for fifty" };

// ═══════════════════════ GEAR_SHEET_COPY ═══════════════════════════════════

test("GEAR_SHEET_COPY: frozen, every nested group frozen, every leaf a string", () => {
  assert.ok(Object.isFrozen(GEAR_SHEET_COPY));
  const walk = (obj) => {
    for (const v of Object.values(obj)) {
      if (typeof v === "string") continue;
      assert.ok(v && typeof v === "object", "every non-string leaf must be a nested object");
      assert.ok(Object.isFrozen(v), "every nested group must be frozen");
      walk(v);
    }
  };
  walk(GEAR_SHEET_COPY);
});

test("GEAR_SHEET_COPY: carries the exact CONTEXT-pinned strings", () => {
  assert.equal(GEAR_SHEET_COPY.head.nothingWorn, "NOTHING WORN");
  assert.equal(GEAR_SHEET_COPY.act.nothing, "NOTHING TO EQUIP");
  assert.equal(GEAR_SHEET_COPY.act.use, "USE");
  assert.equal(GEAR_SHEET_COPY.act.unequip, "UNEQUIP");
  assert.equal(GEAR_SHEET_COPY.act.discard, "DISCARD");
  assert.equal(GEAR_SHEET_COPY.act.drop, "DROP");
  assert.equal(GEAR_SHEET_COPY.act.dropConfirm, "DROP IT? · tap again");
  assert.equal(GEAR_SHEET_COPY.act.swapFor, "SWAP FOR {name}");
  assert.equal(GEAR_SHEET_COPY.act.equip, "EQUIP {name}");
  assert.equal(GEAR_SHEET_COPY.act.equipTo, "EQUIP TO {slot}");
  assert.equal(GEAR_SHEET_COPY.act.swapInto, "SWAP INTO {slot}");
  assert.equal(GEAR_SHEET_COPY.sub.bagFull, "Bag is full — free a slot first.");
  assert.equal(GEAR_SHEET_COPY.head.fromBag, "USED FROM THE BAG");
  assert.equal(GEAR_SHEET_COPY.cancel, "CANCEL");
});

// ═══════════════════════ Worn target: filled slot ══════════════════════════

test("Filled worn jewel: label/title/note/why, action keys and runs", () => {
  const c = fixedChar({ worn: { jewelry1: RING_OF_POWER }, items: [GAUNTLET] });
  const stt = st(c);
  const row = gearWornModel(stt).rows.find((r) => r.key === "jewelry1");
  const model = gearSheetModel(stt, { from: "worn", slot: "jewelry1" });

  assert.equal(model.label, "JEWELRY 1 · WORN");
  assert.equal(model.title, "Ring of Power");
  assert.equal(model.note, row.note);
  assert.equal(model.why, "");
  assert.deepStrictEqual(model.actions.map((a) => a.key), ["use", "unequip", "swap:0"]);

  const use = model.actions[0];
  assert.deepStrictEqual(use.run, { type: "useItem", slot: "jewelry1" });
  assert.equal(use.enabled, true);
  assert.equal(use.reason, "");

  const unequip = model.actions[1];
  assert.deepStrictEqual(unequip.run, { type: "unequipSlot", slot: "jewelry1" });
  assert.equal(unequip.enabled, true);
  assert.equal(unequip.sub, "Moves to the bag and takes a slot.");

  const swap = model.actions[2];
  assert.equal(swap.label, "SWAP FOR Gauntlet of the Giant");
  assert.deepStrictEqual(swap.run, { type: "equipItem", i: 0, slot: "jewelry1" });
  const card = gearBagCardsModel(stt).find((k) => k.i === 0);
  assert.equal(swap.sub, card.desc);
  assert.equal(swap.enabled, true);
});

test("Worn weapon: no USE, UNEQUIP targets weapon, SWAP FOR carries no slot key and sub === lootCompare(c, it).line", () => {
  const shortSword = { kind: "weapon", base: "Short Sword", bonus: 0, n: "Short Sword", txt: "d6+2" };
  const c = fixedChar({ weapon: "Axe", items: [shortSword] });
  const stt = st(c);
  const model = gearSheetModel(stt, { from: "worn", slot: "weapon" });

  assert.ok(!model.actions.some((a) => a.key === "use"));
  const unequip = model.actions.find((a) => a.key === "unequip");
  assert.deepStrictEqual(unequip.run, { type: "unequipSlot", slot: "weapon" });

  const swap = model.actions.find((a) => a.key === "swap:0");
  assert.deepStrictEqual(swap.run, { type: "equipItem", i: 0 });
  assert.ok(!("slot" in swap.run));
  assert.equal(swap.sub, lootCompare(c, shortSword).line);
});

test("Destroyed armor on a full bag: DISCARD (not UNEQUIP), enabled, run unequipSlot armor", () => {
  const c = fixedChar({
    armor: "Mail", ar: 12, armorWP: 0, armorMax: 40, bag: "small",
    items: [{ kind: "jewelry", n: "A" }, { kind: "jewelry", n: "B" }, { kind: "jewelry", n: "C" }, { kind: "jewelry", n: "D" }],
  });
  const stt = st(c);
  const model = gearSheetModel(stt, { from: "worn", slot: "armor" });
  assert.ok(!model.actions.some((a) => a.key === "unequip"));
  const discard = model.actions.find((a) => a.key === "discard");
  assert.ok(discard, "expected a DISCARD action");
  assert.equal(discard.enabled, true);
  assert.deepStrictEqual(discard.run, { type: "unequipSlot", slot: "armor" });
});

test("Cloak-of-Armor-only armor slot: label ARMOR · EMPTY, title magicPlate, EQUIP actions for bag armor (none -> NOTHING TO EQUIP)", () => {
  const studded = { kind: "armor", n: "Studded", ar: 10, wp: 18, left: 18, cls: "FT" };
  const c = fixedChar({
    armor: "Nothing", ar: 0, armorWP: 0, armorMax: 0,
    worn: { cloak: { kind: "cloak", n: "Cloak of Armor", eff: { cloakArmor: 4 } } },
    timers: { "item:Cloak of Armor": { cadence: "squares", left: 50, cd: 50, phase: "effect" } },
    items: [],
  });
  const stt = st(c);
  const armorD = armorDisplay(c);
  assert.ok(armorD.magic && !armorD.worn);
  let model = gearSheetModel(stt, { from: "worn", slot: "armor" });
  assert.equal(model.label, "ARMOR · EMPTY");
  assert.equal(model.title, GEAR_COPY.magicPlate);
  assert.deepStrictEqual(model.actions.map((a) => a.key), ["nothing"]);
  assert.equal(model.actions[0].enabled, false);
  assert.equal(model.actions[0].run, null);

  const c2 = { ...c, items: [studded] };
  const model2 = gearSheetModel(st(c2), { from: "worn", slot: "armor" });
  assert.deepStrictEqual(model2.actions.map((a) => a.key), ["equip:0"]);
  assert.equal(model2.actions[0].label, "EQUIP Studded");
});

// ═══════════════════════ Worn target: empty slot ═══════════════════════════

test("Empty weapon slot (Fists) with a bagged weapon: label WEAPON · EMPTY, title NOTHING WORN, one EQUIP action", () => {
  const club = { kind: "weapon", base: "Club", bonus: 0, n: "Club", txt: "d4" };
  const c = fixedChar({ weapon: "Fists", items: [club] });
  const model = gearSheetModel(st(c), { from: "worn", slot: "weapon" });
  assert.equal(model.label, "WEAPON · EMPTY");
  assert.equal(model.title, "NOTHING WORN");
  assert.equal(model.note, GEAR_COPY.empty.weapon);
  assert.deepStrictEqual(model.actions.map((a) => a.key), ["equip:0"]);
  assert.equal(model.actions[0].label, "EQUIP Club");
  assert.deepStrictEqual(model.actions[0].run, { type: "equipItem", i: 0 });
});

// ═══════════════════════ Bag target ═══════════════════════════════════════

test("Bag weapon card: SWAP INTO WEAPON when wielding one, EQUIP TO WEAPON on Fists", () => {
  const club = { kind: "weapon", base: "Club", bonus: 0, n: "Club", txt: "d4" };
  const wielding = fixedChar({ weapon: "Axe", items: [club] });
  const modelWielding = gearSheetModel(st(wielding), { from: "bag", i: 0, n: "Club" });
  const slotAction = modelWielding.actions.find((a) => a.key === "slot:weapon");
  assert.equal(slotAction.label, "SWAP INTO WEAPON");
  assert.equal(slotAction.sub, "Axe comes off and goes to the bag.");

  const bare = fixedChar({ weapon: "Fists", items: [club] });
  const modelBare = gearSheetModel(st(bare), { from: "bag", i: 0, n: "Club" });
  const slotAction2 = modelBare.actions.find((a) => a.key === "slot:weapon");
  assert.equal(slotAction2.label, "EQUIP TO WEAPON");
  assert.equal(slotAction2.sub, "Fills the slot and frees a bag slot.");
});

test("Bag armor card over destroyed worn armor: SWAP INTO ARMOR, sub '<armor name> is scrap. It stays behind.'", () => {
  const studded = { kind: "armor", n: "Studded", ar: 10, wp: 18, left: 18, cls: "FT" };
  const c = fixedChar({ armor: "Mail", ar: 12, armorWP: 0, armorMax: 40, items: [studded] });
  const model = gearSheetModel(st(c), { from: "bag", i: 0, n: "Studded" });
  const slotAction = model.actions.find((a) => a.key === "slot:armor");
  assert.equal(slotAction.label, "SWAP INTO ARMOR");
  assert.equal(slotAction.sub, "Mail is scrap. It stays behind.");
});

test("Bag header: label BAG · <FAMILY> or USED FROM THE BAG; title/note/why", () => {
  const club = { kind: "weapon", base: "Club", bonus: 0, n: "Club", txt: "d4" };
  const c = fixedChar({ items: [club] });
  const model = gearSheetModel(st(c), { from: "bag", i: 0, n: "Club" });
  assert.equal(model.label, "BAG · WEAPON");
  assert.equal(model.title, "Club");
  const card = gearBagCardsModel(st(c))[0];
  assert.equal(model.note, card.desc);
  assert.equal(model.why, lootCompare(c, club).line);

  const rope = toolItem("rope");
  const c2 = fixedChar({ items: [rope] });
  const model2 = gearSheetModel(st(c2), { from: "bag", i: 0, n: "Rope" });
  assert.equal(model2.label, "BAG · USED FROM THE BAG");
  assert.equal(model2.why, "");
});

// ═══════════════════════ Acceptance: Spiked Staff ══════════════════════════

function spikedStaffState(combat) {
  const state = newRun(7);
  state.c.level = 3;
  state.c.weapon = "Quarter Staff";
  state.c.prof = 0;
  state.c.magicWpn = 0;
  state.c.items = [{ kind: "weapon", base: "Spiked Staff", bonus: 0, n: "Spiked Staff", txt: "d8" }];
  if (combat) state.combat = { pending: true };
  return state;
}

test("Acceptance: Spiked Staff bag sheet — exact why, exact action labels, DROP confirm/run", () => {
  const state = spikedStaffState(false);
  const model = gearSheetModel(state, { from: "bag", i: 0, n: "Spiked Staff" });
  assert.equal(model.why, "d8 vs your d6 · −1 to hit · 4.1 vs 5.0 a swing · not an upgrade");
  assert.deepStrictEqual(model.actions.map((a) => a.label), ["SWAP INTO WEAPON", "DROP"]);
  const drop = model.actions.find((a) => a.key === "drop");
  assert.equal(drop.confirm, true);
  assert.deepStrictEqual(drop.run, { type: "dropItem", i: 0 });
});

test("Acceptance/combat: SWAP INTO WEAPON greyed with the Phase 61 gearRefused line, DROP stays enabled; clearing combat re-enables it", () => {
  const state = spikedStaffState(true);
  const model = gearSheetModel(state, { from: "bag", i: 0, n: "Spiked Staff" });
  const swap = model.actions.find((a) => a.key === "slot:weapon");
  const expectedText = LINE_FOR.gearRefused({ type: "gearRefused", verb: "equipItem", reason: "combat" }).text;
  assert.equal(swap.enabled, false);
  assert.equal(swap.reason, expectedText);
  assert.equal(swap.sub, expectedText);
  const drop = model.actions.find((a) => a.key === "drop");
  assert.equal(drop.enabled, true);

  const cleared = spikedStaffState(false);
  const clearedModel = gearSheetModel(cleared, { from: "bag", i: 0, n: "Spiked Staff" });
  assert.equal(clearedModel.actions.find((a) => a.key === "slot:weapon").enabled, true);
});

test("Combat, worn jewel sheet: USE enabled, UNEQUIP and every SWAP FOR greyed with the unequipSlot/equipItem gearRefused text", () => {
  const c = fixedChar({ worn: { jewelry1: RING_OF_POWER }, items: [GAUNTLET] });
  const state = { c, combat: { pending: true } };
  const model = gearSheetModel(state, { from: "worn", slot: "jewelry1" });
  const unequipText = LINE_FOR.gearRefused({ type: "gearRefused", verb: "unequipSlot", reason: "combat" }).text;
  const equipText = LINE_FOR.gearRefused({ type: "gearRefused", verb: "equipItem", reason: "combat" }).text;

  const use = model.actions.find((a) => a.key === "use");
  assert.equal(use.enabled, true);
  const unequip = model.actions.find((a) => a.key === "unequip");
  assert.equal(unequip.enabled, false);
  assert.equal(unequip.reason, unequipText);
  const swap = model.actions.find((a) => a.key === "swap:0");
  assert.equal(swap.enabled, false);
  assert.equal(swap.reason, equipText);
});

// ═══════════════════════ Illegal candidates ════════════════════════════════

test("Illegal weapon/armor: a Magic User's bagged Long Sword and Mail are listed, greyed, reason === lootCompare(c, it).line starting 'can't use'", () => {
  const longSword = { kind: "weapon", base: "Long Sword", bonus: 0, n: "Long Sword", txt: "d8+2" };
  const mail = { kind: "armor", n: "Mail", ar: 12, wp: 30, left: 30, cls: "F" };
  const c = fixedChar({ cls: "Magic User", weapon: "Quarter Staff", armor: "Nothing", ar: 0, armorWP: 0, armorMax: 0, items: [longSword, mail] });
  const stt = st(c);

  const wornWeapon = gearSheetModel(stt, { from: "worn", slot: "weapon" });
  const wSwap = wornWeapon.actions.find((a) => a.key === "swap:0");
  assert.equal(wSwap.enabled, false);
  assert.equal(wSwap.reason, lootCompare(c, longSword).line);
  assert.ok(wSwap.reason.startsWith("can't use"));

  const wornArmor = gearSheetModel(stt, { from: "worn", slot: "armor" });
  const aEquip = wornArmor.actions.find((a) => a.key === "equip:1");
  assert.equal(aEquip.enabled, false);
  assert.equal(aEquip.reason, lootCompare(c, mail).line);
  assert.ok(aEquip.reason.startsWith("can't use"));

  const bagWeapon = gearSheetModel(stt, { from: "bag", i: 0, n: "Long Sword" });
  const bwSlot = bagWeapon.actions.find((a) => a.key === "slot:weapon");
  assert.equal(bwSlot.enabled, false);
  assert.ok(bwSlot.reason.startsWith("can't use"));

  const bagArmor = gearSheetModel(stt, { from: "bag", i: 1, n: "Mail" });
  const baSlot = bagArmor.actions.find((a) => a.key === "slot:armor");
  assert.equal(baSlot.enabled, false);
  assert.ok(baSlot.reason.startsWith("can't use"));
});

// ═══════════════════════ USE sub by phase ══════════════════════════════════

test("USE sub by phase: ready, cooling (12/1), effect (23/1), staff charges, torch one-use — always enabled", () => {
  const readyModel = gearSheetModel(st(fixedChar({ worn: { jewelry1: RING_OF_POWER } })), { from: "worn", slot: "jewelry1" });
  const readyUse = readyModel.actions.find((a) => a.key === "use");
  assert.equal(readyUse.sub, "Ready when you are.");
  assert.equal(readyUse.enabled, true);

  const cooling12 = st(fixedChar({ worn: { jewelry1: RING_OF_POWER }, timers: { "item:Ring of Power": { cadence: "squares", left: 12, phase: "cooldown" } } }));
  assert.equal(gearSheetModel(cooling12, { from: "worn", slot: "jewelry1" }).actions[0].sub, "Cooling down — 12 more squares.");
  const cooling1 = st(fixedChar({ worn: { jewelry1: RING_OF_POWER }, timers: { "item:Ring of Power": { cadence: "squares", left: 1, phase: "cooldown" } } }));
  assert.equal(gearSheetModel(cooling1, { from: "worn", slot: "jewelry1" }).actions[0].sub, "Cooling down — 1 more square.");

  const effect23 = st(fixedChar({ worn: { jewelry1: RING_OF_POWER }, timers: { "item:Ring of Power": { cadence: "squares", left: 23, phase: "effect" } } }));
  assert.equal(gearSheetModel(effect23, { from: "worn", slot: "jewelry1" }).actions[0].sub, "Already running — 23 squares left.");
  const effect1 = st(fixedChar({ worn: { jewelry1: RING_OF_POWER }, timers: { "item:Ring of Power": { cadence: "squares", left: 1, phase: "effect" } } }));
  assert.equal(gearSheetModel(effect1, { from: "worn", slot: "jewelry1" }).actions[0].sub, "Already running — 1 square left.");

  const staff = { kind: "staff", n: "Poplar Staff", use: "heal", charges: 1 };
  const staffState = st(fixedChar({ cls: "Magic User", items: [staff], timers: { "charges:Poplar Staff": { cadence: "squares", left: 20, phase: "cooldown" } } }));
  const staffModel = gearSheetModel(staffState, { from: "bag", i: 0, n: "Poplar Staff" });
  const staffUse = staffModel.actions.find((a) => a.key === "use");
  const cardsForStaff = gearBagCardsModel(staffState);
  assert.equal(staffUse.sub, `Charges ${cardsForStaff[0].use.sub}.`);
  assert.equal(staffUse.enabled, true);

  const torch = toolItem("torch");
  const torchModel = gearSheetModel(st(fixedChar({ items: [torch] })), { from: "bag", i: 0, n: "Torch" });
  const torchUse = torchModel.actions.find((a) => a.key === "use");
  assert.equal(torchUse.sub, "One use. Then it is a memory.");
  assert.equal(torchUse.enabled, true);
});

// ═══════════════════════ Run-shape and confirm sweeps ══════════════════════

test("Every action except NOTHING TO EQUIP carries a non-null run; NOTHING TO EQUIP carries run null", () => {
  const mu = fixedChar({ cls: "Magic User", weapon: "Quarter Staff", armor: "Nothing", ar: 0, armorWP: 0, armorMax: 0, items: [] });
  const model = gearSheetModel(st(mu), { from: "worn", slot: "armor" });
  for (const a of model.actions) {
    if (a.key === "nothing") assert.equal(a.run, null);
    else assert.ok(a.run && typeof a.run === "object");
  }

  const rich = fixedChar({ worn: { jewelry1: RING_OF_POWER }, items: [GAUNTLET] });
  const richModel = gearSheetModel(st(rich), { from: "worn", slot: "jewelry1" });
  assert.ok(richModel.actions.every((a) => a.key === "nothing" || (a.run && typeof a.run === "object")));
});

test("Run shapes: cloak/jewelry1/jewelry2 equip runs carry a slot key; weapon/armor equip runs never do", () => {
  const club = { kind: "weapon", base: "Club", bonus: 0, n: "Club", txt: "d4" };
  const weaponModel = gearSheetModel(st(fixedChar({ weapon: "Fists", items: [club] })), { from: "worn", slot: "weapon" });
  const weaponEquip = weaponModel.actions.find((a) => a.key === "equip:0");
  assert.deepStrictEqual(weaponEquip.run, { type: "equipItem", i: 0 });

  const cloakItem = { kind: "cloak", n: "Traveler's Cloak", txt: "a plain cloak" };
  const cloakModel = gearSheetModel(st(fixedChar({ worn: {}, items: [cloakItem] })), { from: "worn", slot: "cloak" });
  const cloakEquip = cloakModel.actions.find((a) => a.key === "equip:0");
  assert.deepStrictEqual(cloakEquip.run, { type: "equipItem", i: 0, slot: "cloak" });

  const bagModel = gearSheetModel(st(fixedChar({ worn: { jewelry1: RING_OF_POWER }, items: [GAUNTLET] })), { from: "bag", i: 0, n: "Gauntlet of the Giant" });
  const j2Action = bagModel.actions.find((a) => a.key === "slot:jewelry2");
  assert.deepStrictEqual(j2Action.run, { type: "equipItem", i: 0, slot: "jewelry2" });
});

test("USE is never greyed, across every phase (ready, effect, cooldown, charges, consumable)", () => {
  const cases = [
    st(fixedChar({ worn: { jewelry1: RING_OF_POWER } })),
    st(fixedChar({ worn: { jewelry1: RING_OF_POWER }, timers: { "item:Ring of Power": { cadence: "squares", left: 5, phase: "effect" } } })),
    st(fixedChar({ worn: { jewelry1: RING_OF_POWER }, timers: { "item:Ring of Power": { cadence: "squares", left: 5, phase: "cooldown" } } })),
  ];
  for (const stt of cases) {
    const use = gearSheetModel(stt, { from: "worn", slot: "jewelry1" }).actions.find((a) => a.key === "use");
    assert.equal(use.enabled, true);
    assert.equal(use.reason, "");
  }
  const torchModel = gearSheetModel(st(fixedChar({ items: [toolItem("torch")] })), { from: "bag", i: 0, n: "Torch" });
  const torchUse = torchModel.actions.find((a) => a.key === "use");
  assert.equal(torchUse.enabled, true);
});

test("DROP always carries confirm true; every other action carries confirm false", () => {
  const models = [
    gearSheetModel(st(fixedChar({ worn: { jewelry1: RING_OF_POWER }, items: [GAUNTLET] })), { from: "worn", slot: "jewelry1" }),
    gearSheetModel(st(fixedChar({ items: [{ kind: "weapon", base: "Club", bonus: 0, n: "Club", txt: "d4" }] })), { from: "bag", i: 0, n: "Club" }),
  ];
  for (const model of models) {
    for (const a of model.actions) {
      assert.equal(a.confirm, a.key === "drop", `${a.key} confirm must be true only for drop`);
    }
  }
});

test("Label templates: EQUIP {name} vs SWAP FOR {name} on a worn sheet; EQUIP TO {slot} vs SWAP INTO {slot} on a bag sheet all substitute correctly", () => {
  const club = { kind: "weapon", base: "Club", bonus: 0, n: "Club", txt: "d4" };
  const equipLabel = gearSheetModel(st(fixedChar({ weapon: "Fists", items: [club] })), { from: "worn", slot: "weapon" }).actions.find((a) => a.key === "equip:0").label;
  assert.equal(equipLabel, "EQUIP Club");
  const swapForLabel = gearSheetModel(st(fixedChar({ weapon: "Axe", items: [club] })), { from: "worn", slot: "weapon" }).actions.find((a) => a.key === "swap:0").label;
  assert.equal(swapForLabel, "SWAP FOR Club");
  const equipToLabel = gearSheetModel(st(fixedChar({ worn: {}, items: [GAUNTLET] })), { from: "bag", i: 0, n: "Gauntlet of the Giant" }).actions.find((a) => a.key === "slot:jewelry1").label;
  assert.equal(equipToLabel, "EQUIP TO JEWELRY 1");
  const swapIntoLabel = gearSheetModel(st(fixedChar({ worn: { jewelry1: RING_OF_POWER }, items: [GAUNTLET] })), { from: "bag", i: 0, n: "Gauntlet of the Giant" }).actions.find((a) => a.key === "slot:jewelry1").label;
  assert.equal(swapIntoLabel, "SWAP INTO JEWELRY 1");
});

// ═══════════════════════ Null cases ════════════════════════════════════════

test("Null cases: malformed target, unknown worn slot, missing/mismatched bag card, no c", () => {
  const c = fixedChar({ items: [{ kind: "potion", n: "P", eff2: "speed" }] });
  const stt = st(c);
  assert.equal(gearSheetModel(stt, null), null);
  assert.equal(gearSheetModel(stt, {}), null);
  assert.equal(gearSheetModel(stt, { from: "worn", slot: "helm" }), null);
  assert.equal(gearSheetModel(stt, { from: "bag", i: 99, n: "x" }), null);
  assert.equal(gearSheetModel(stt, { from: "bag", i: 0, n: "Not The Real Name" }), null);
  assert.equal(gearSheetModel(stt, { from: "bag", i: 0, n: "P" }), null, "a potion is bag-free and carries no card");
  assert.equal(gearSheetModel({ c: null }, { from: "worn", slot: "weapon" }), null);
  assert.equal(gearSheetModel({}, { from: "worn", slot: "weapon" }), null);
});

// ═══════════════════════ Purity ════════════════════════════════════════════

test("Purity: two calls deep-equal; JSON.stringify(state) unchanged; a sparse state never throws for every GEAR_WORN_ORDER slot", () => {
  const c = fixedChar({ worn: { jewelry1: RING_OF_POWER }, items: [GAUNTLET, { kind: "weapon", base: "Club", bonus: 0, n: "Club", txt: "d4" }] });
  const stt = st(c);
  for (const target of [{ from: "worn", slot: "jewelry1" }, { from: "worn", slot: "weapon" }, { from: "bag", i: 0, n: "Gauntlet of the Giant" }]) {
    const before = JSON.stringify(stt);
    const a = gearSheetModel(stt, target);
    const b = gearSheetModel(stt, target);
    assert.deepStrictEqual(a, b);
    assert.equal(JSON.stringify(stt), before);
  }

  const sparse = { c: { weapon: "Fists", armor: "Nothing" } };
  for (const slot of GEAR_WORN_ORDER) {
    assert.doesNotThrow(() => gearSheetModel(sparse, { from: "worn", slot }));
  }
});

// ═══════════════════════ Edge GSCR-07 (worn-slot sheet) ════════════════════

test("Edge GSCR-07/adjacency: the thief fixture's full bag greys jewelry1 UNEQUIP with the bag-full line; one free slot enables it", () => {
  const { thief } = fixedStates();
  const model = gearSheetModel(thief, { from: "worn", slot: "jewelry1" });
  const unequip = model.actions.find((a) => a.key === "unequip");
  assert.equal(unequip.enabled, false);
  assert.equal(unequip.reason, "Bag is full — free a slot first.");

  const freed = fixedStates().thief;
  const idx = freed.c.items.findIndex((it) => it && it.kind !== "potion");
  freed.c.items.splice(idx, 1);
  const modelFreed = gearSheetModel(freed, { from: "worn", slot: "jewelry1" });
  assert.equal(modelFreed.actions.find((a) => a.key === "unequip").enabled, true);
});

test("Edge GSCR-07/empty: a fresh Magic User's empty armor slot with an empty bag yields exactly one NOTHING TO EQUIP; a filled slot with no fitting bag item yields zero SWAP FOR", () => {
  const mu = fixedChar({ cls: "Magic User", weapon: "Quarter Staff", armor: "Nothing", ar: 0, armorWP: 0, armorMax: 0, items: [] });
  const stt = st(mu);
  const armorModel = gearSheetModel(stt, { from: "worn", slot: "armor" });
  assert.deepStrictEqual(armorModel.actions.map((a) => a.key), ["nothing"]);
  assert.equal(armorModel.actions[0].enabled, false);
  assert.equal(armorModel.actions[0].run, null);

  const weaponModel = gearSheetModel(stt, { from: "worn", slot: "weapon" });
  assert.ok(!weaponModel.actions.some((a) => a.key.startsWith("swap:")));
});

test("Edge GSCR-07/ordering: a filled activatable jewel with two fitting bag jewels reads keys [use, unequip, swap:<lower i>, swap:<higher i>], twice", () => {
  const c = fixedChar({ worn: { jewelry1: RING_OF_POWER }, items: [GAUNTLET, AMULET_OF_LIGHT] });
  const stt = st(c);
  const target = { from: "worn", slot: "jewelry1" };
  const model1 = gearSheetModel(stt, target);
  assert.deepStrictEqual(model1.actions.map((a) => a.key), ["use", "unequip", "swap:0", "swap:1"]);
  const model2 = gearSheetModel(stt, target);
  assert.deepStrictEqual(model2.actions.map((a) => a.key), ["use", "unequip", "swap:0", "swap:1"]);
});

// ═══════════════════════ Edge GSCR-08 (bag-card sheet) ═════════════════════

test("Edge GSCR-08/adjacency: a bag jewel — jewelry1 worn/jewelry2 free -> SWAP INTO 1 + EQUIP TO 2; both worn -> two SWAP INTO; both free -> two EQUIP TO; each run targets its own key", () => {
  const mixed = fixedChar({ worn: { jewelry1: RING_OF_POWER }, items: [GAUNTLET] });
  const mixedModel = gearSheetModel(st(mixed), { from: "bag", i: 0, n: "Gauntlet of the Giant" });
  assert.deepStrictEqual(mixedModel.actions.map((a) => a.label), ["SWAP INTO JEWELRY 1", "EQUIP TO JEWELRY 2", "DROP"]);
  assert.deepStrictEqual(mixedModel.actions[0].run, { type: "equipItem", i: 0, slot: "jewelry1" });
  assert.deepStrictEqual(mixedModel.actions[1].run, { type: "equipItem", i: 0, slot: "jewelry2" });

  const bothWorn = fixedChar({ worn: { jewelry1: RING_OF_POWER, jewelry2: AMULET_OF_LIGHT }, items: [GAUNTLET] });
  const bothWornModel = gearSheetModel(st(bothWorn), { from: "bag", i: 0, n: "Gauntlet of the Giant" });
  assert.deepStrictEqual(bothWornModel.actions.map((a) => a.label), ["SWAP INTO JEWELRY 1", "SWAP INTO JEWELRY 2", "DROP"]);

  const bothFree = fixedChar({ worn: {}, items: [GAUNTLET] });
  const bothFreeModel = gearSheetModel(st(bothFree), { from: "bag", i: 0, n: "Gauntlet of the Giant" });
  assert.deepStrictEqual(bothFreeModel.actions.map((a) => a.label), ["EQUIP TO JEWELRY 1", "EQUIP TO JEWELRY 2", "DROP"]);
});

test("Edge GSCR-08/empty: a bag-only item with no activation (a rope) yields exactly one DROP action; a target index past the end yields null", () => {
  const rope = toolItem("rope");
  const c = fixedChar({ items: [rope] });
  const model = gearSheetModel(st(c), { from: "bag", i: 0, n: "Rope" });
  assert.deepStrictEqual(model.actions.map((a) => a.key), ["drop"]);
  assert.equal(gearSheetModel(st(c), { from: "bag", i: 5, n: "Rope" }), null);
});

test("Edge GSCR-08/ordering: a bag-only activatable (a Magic User's staff) yields [use, drop], USE first and DROP last", () => {
  const staff = { kind: "staff", n: "Poplar Staff", use: "heal", charges: 3 };
  const c = fixedChar({ cls: "Magic User", items: [staff] });
  const model = gearSheetModel(st(c), { from: "bag", i: 0, n: "Poplar Staff" });
  assert.deepStrictEqual(model.actions.map((a) => a.key), ["use", "drop"]);
});

// ═══════════════════════ Edge GSCR-09 (reasons) ════════════════════════════

test("Edge GSCR-09/adjacency: an action both combat-locked and illegal (or combat-locked and bag-full) shows the COMBAT reason — the engine checks the lock first", () => {
  const longSword = { kind: "weapon", base: "Long Sword", bonus: 0, n: "Long Sword", txt: "d8+2" };
  const c = fixedChar({ cls: "Magic User", weapon: "Quarter Staff", items: [longSword] });
  const state = { c, combat: { pending: true } };
  const equipText = LINE_FOR.gearRefused({ type: "gearRefused", verb: "equipItem", reason: "combat" }).text;
  const model = gearSheetModel(state, { from: "worn", slot: "weapon" });
  const swap = model.actions.find((a) => a.key === "swap:0");
  assert.equal(swap.enabled, false);
  assert.equal(swap.reason, equipText, "the combat line wins over the illegal-weapon reason");

  const { thief } = fixedStates();
  const combatThief = { ...thief, combat: { pending: true } };
  const unequipText = LINE_FOR.gearRefused({ type: "gearRefused", verb: "unequipSlot", reason: "combat" }).text;
  const jewelModel = gearSheetModel(combatThief, { from: "worn", slot: "jewelry1" });
  const unequip = jewelModel.actions.find((a) => a.key === "unequip");
  assert.equal(unequip.enabled, false);
  assert.equal(unequip.reason, unequipText, "the combat line wins over the bag-full reason");
});

test("Edge GSCR-09/empty: every enabled action has reason ''; every greyed action has a non-empty reason equal to its sub", () => {
  const longSword = { kind: "weapon", base: "Long Sword", bonus: 0, n: "Long Sword", txt: "d8+2" };
  const mail = { kind: "armor", n: "Mail", ar: 12, wp: 30, left: 30, cls: "F" };
  const mu = fixedChar({ cls: "Magic User", weapon: "Quarter Staff", armor: "Nothing", ar: 0, armorWP: 0, armorMax: 0, items: [longSword, mail] });
  const combatMu = { c: mu, combat: { pending: true } };
  const { thief } = fixedStates();

  const models = [
    gearSheetModel(st(mu), { from: "worn", slot: "weapon" }),
    gearSheetModel(st(mu), { from: "worn", slot: "armor" }),
    gearSheetModel(st(mu), { from: "bag", i: 0, n: "Long Sword" }),
    gearSheetModel(st(mu), { from: "bag", i: 1, n: "Mail" }),
    gearSheetModel(combatMu, { from: "worn", slot: "weapon" }),
    gearSheetModel(thief, { from: "worn", slot: "jewelry1" }),
  ];
  for (const model of models) {
    for (const a of model.actions) {
      if (a.enabled) assert.equal(a.reason, "", `enabled action ${a.key} must carry reason ''`);
      else assert.ok(a.reason && a.reason === a.sub, `greyed action ${a.key} must carry reason === sub`);
    }
  }
});

// ═══════════════════════ Module contract (Task 2) ══════════════════════════
//
// Reads gearSheet.js CRLF-normalized, comments stripped with the same
// order-sensitive stripper test/unit/gear-agreement.test.js's own no-fork
// source guard uses (line comments first, then block comments), and pins:
// (a) no window/document global read; (b) the no-fork list — every
// lower-level shared rule this module must never call directly; (c) the
// Phase 61 combat line's own text, read at test time (never a literal in
// this file), does not appear as a literal in the stripped source; (d)
// GEAR_SHEET_COPY and every nested object are frozen.

function stripComments(source) {
  const noLineComments = source
    .split("\n")
    .map((line) => {
      const i = line.indexOf("//");
      return i === -1 ? line : line.slice(0, i);
    })
    .join("\n");
  return noLineComments.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""));
}

function readNormalized(relPath) {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), "utf8").replace(/\r\n/g, "\n");
}

const GEAR_SHEET_STRIPPED = stripComments(readNormalized("src/browser/gearSheet.js"));

test("Module contract (a): gearSheet.js reads no window/document global", () => {
  assert.doesNotMatch(GEAR_SHEET_STRIPPED, /\bwindow\./);
  assert.doesNotMatch(GEAR_SHEET_STRIPPED, /\bdocument\./);
});

test("Module contract (b): gearSheet.js never calls a lower-level shared rule directly (no-fork)", () => {
  const FORBIDDEN_TOKENS = [
    "bagCap(", "canStow(", "slotItems(", "takesBagSlot(", "isReady(", "remaining(",
    "activationFor(", "itemTimerId(", "chargesTimerId(", "armorSoak(",
    "weaponUpgradeDelta(", "armorUpgradeDelta(", "expectedStrike(",
    "weaponRefusalReason(", "armorRefusalReason(",
  ];
  for (const token of FORBIDDEN_TOKENS) {
    assert.ok(!GEAR_SHEET_STRIPPED.includes(token), `gearSheet.js unexpectedly calls ${token}`);
  }
});

test("Module contract (c): the Phase 61 combat line's own text is never a literal in gearSheet.js", () => {
  const combatText = LINE_FOR.gearRefused({ type: "gearRefused", verb: "equipItem", reason: "combat" }).text;
  assert.ok(combatText.length > 0);
  assert.ok(!GEAR_SHEET_STRIPPED.includes(combatText), "gearSheet.js must read the combat line, never quote it");
});

test("Module contract (d): GEAR_SHEET_COPY and every nested object are frozen", () => {
  const walk = (obj) => {
    assert.ok(Object.isFrozen(obj));
    for (const v of Object.values(obj)) {
      if (v && typeof v === "object") walk(v);
    }
  };
  walk(GEAR_SHEET_COPY);
});
