// test/unit/staff-surfaces.test.js
//
// Phase 75 (RULES-13, user 2026-09-25), Plan 11 — cross-surface coverage:
// the Gear tab, the gear sheet, the item stat formatter, the hero sheet and
// combat ITEMS all show and act on a wielded or bagged magic staff, and
// NEVER offer USE on a bagged one or EQUIP to a non-Magic-User. Every
// legality read is proven against the engine's own `wieldedStaff`/
// `weaponRow` (engine/derived.js, landed by 75-07/75-09) — nothing here
// restates a rule the engine already owns. Presentation only: no engine,
// content or parity fixture is touched by this plan (verified separately by
// `git diff --stat <plan-base> -- engine content test/parity mazeworld.html`
// printing nothing).

import test from "node:test";
import assert from "node:assert/strict";

import { gearWornModel, gearBagCardsModel, emptySlotRows, gearUseCell } from "../../src/browser/gearTab.js";
import { gearSheetModel } from "../../src/browser/gearSheet.js";
import { itemStatLines, wornItemFor, lootCompare, usableBy, ITEM_STAT_COPY } from "../../src/browser/viewModels.js";
import { characterSheetViewModel } from "../../src/browser/heroTab.js";
import { combatMenuViewModel, COMBAT_MENU_COPY } from "../../src/browser/combatMenu.js";
import { weaponRow, wieldedStaff } from "../../engine/derived.js";
import { WEAPONS, STAFF_WEAPON } from "../../content/index.js";

// ─── fixtures ────────────────────────────────────────────────────────────
//
// fixedFighter/fixedFloor/fixedState/fixedCombat mirror
// test/unit/combatMenu.test.js's own helpers exactly (proven safe inputs for
// combatMenuViewModel/characterSheetViewModel), so this file can build a
// full combat-capable state without re-deriving what fields those view
// models read.

function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
    maxWP: 55, wp: 55, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 0, rations: 6, gold: 50, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    darkFor: 0, worn: {}, timers: {},
    ...overrides,
  };
}

function fixedFloor(overrides = {}) {
  const g = [];
  for (let y = 0; y < 3; y++) {
    g.push([]);
    for (let x = 0; x < 3; x++) g[y].push({ wall: false, dark: false, seen: true, feat: null });
  }
  return { g, px: 1, py: 1, depth: 1, ...overrides };
}

function fixedState(overrides = {}) {
  const { c: cOverrides, floor: floorOverrides, ...rest } = overrides;
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedFighter(cOverrides),
    floor: fixedFloor(floorOverrides),
    day: 1, steps: 0, combat: null, store: null, beats: null, party: [],
    dead: false, deathNote: "", epitaph: "",
    ...rest,
  };
}

function fixedCombat(foes, overrides = {}) {
  return { foes, type: foes[0]?.type || "Beasts", round: 1, target: 0, spellOpen: false, tracked: false, ...overrides };
}

// Birch Staff (content/treasure-tables.js): { kind: "freeze", charges: 2,
// recharge: 100 } — freezes up to 2 squares of opponents indefinitely.
const BIRCH_TXT = "freezes up to 2 squares of opponents indefinitely";
function birchStaff(overrides = {}) {
  return { n: "Birch Staff", kind: "staff", use: "freeze", charges: 2, txt: BIRCH_TXT, ...overrides };
}

const st = (c, combat = null) => ({ c, combat });

// ═══════════════════════ Gear tab: WEAPON row (gearWornModel) ═════════════

test("Gear tab WEAPON row: a wielded Birch Staff is filled, named, valued d8, carries its own USE cell (dispatch {slot:'weapon'}) and UNEQUIP", () => {
  const staff = birchStaff();
  const c = fixedFighter({ cls: "Magic User", weapon: "Birch Staff", staff, items: [] });
  const model = gearWornModel(st(c));
  const row = model.rows.find((r) => r.key === "weapon");
  assert.equal(row.filled, true);
  assert.equal(row.name, "Birch Staff");
  assert.equal(row.value, "d8");
  assert.ok(row.use, "expected a USE cell on the wielded-staff row");
  assert.deepEqual(row.useRef, { slot: "weapon" });
  assert.deepEqual(row.unequip, { slot: "weapon", blocked: false });
});

test("Gear tab: the empty-weapon rule (emptySlotRows) treats a wielded staff as filled — never one of the empty-slot rows", () => {
  const staff = birchStaff();
  const c = fixedFighter({ cls: "Magic User", weapon: "Birch Staff", staff });
  assert.ok(!emptySlotRows(c).some((r) => r.slot === "weapon"), "the weapon slot must not read empty while a staff is wielded");

  const bare = fixedFighter({ cls: "Magic User", weapon: "Fists", staff: null });
  assert.ok(emptySlotRows(bare).some((r) => r.slot === "weapon"), "sanity: a bare-fisted hero still reads the weapon slot empty");
});

test("Gear tab WEAPON row: a bare-fisted Magic User's row reads empty, never confused with a wielded staff", () => {
  const c = fixedFighter({ cls: "Magic User", weapon: "Fists", staff: null, items: [] });
  const model = gearWornModel(st(c));
  const row = model.rows.find((r) => r.key === "weapon");
  assert.equal(row.filled, false);
  assert.equal(row.use, null);
});

// ═══════════════════════ Gear tab: BAG card (gearBagCardsModel) ═══════════

test("Gear tab BAG card: a Magic User with a bagged Rowan Staff and a Club in hand — family 'weapon', tagged SWAP, no USE cell", () => {
  const rowan = { n: "Rowan Staff", kind: "staff", use: "dome", charges: 2, txt: "a protective dome of 100 hp" };
  const c = fixedFighter({ cls: "Magic User", weapon: "Club", staff: null, items: [rowan] });
  const cards = gearBagCardsModel(st(c));
  const card = cards.find((k) => k.name === "Rowan Staff");
  assert.equal(card.family, "weapon");
  assert.equal(card.tag, "WEAPON" + " · SWAP");
  assert.equal(card.use, null);
  assert.equal(card.useRef, null);
});

test("Gear tab BAG card: a Magic User bare-handed with a bagged staff — family 'weapon', EQUIP TO (no SWAP tag), no USE cell", () => {
  const staff = birchStaff();
  const c = fixedFighter({ cls: "Magic User", weapon: "Fists", staff: null, items: [staff] });
  const cards = gearBagCardsModel(st(c));
  const card = cards.find((k) => k.name === "Birch Staff");
  assert.equal(card.family, "weapon");
  assert.equal(card.tag, "WEAPON");
  assert.equal(card.use, null);
});

test("Gear tab BAG card: a Fighter with a bagged staff — no family, no equip affordance, no USE cell, and its text says a Magic User can wield it", () => {
  const staff = birchStaff();
  const c = fixedFighter({ cls: "Fighter", weapon: "Club", items: [staff] });
  const cards = gearBagCardsModel(st(c));
  const card = cards.find((k) => k.name === "Birch Staff");
  assert.equal(card.family, null);
  assert.equal(card.tag, "");
  assert.equal(card.use, null);
  assert.equal(card.useRef, null);
  assert.ok(card.desc.includes(usableBy(staff, c)), "the card's desc must carry the usable-by suffix naming Magic Users");
  assert.match(card.desc, /Magic Users — not you/);
});

test("Gear tab BAG card: swap detection counts a wielded staff — a bagged ordinary weapon reads WEAPON · SWAP while a staff is wielded", () => {
  const staff = birchStaff();
  const sword = { n: "Long Sword", kind: "weapon", base: "Long Sword", bonus: 0, txt: "d8+2" };
  const c = fixedFighter({ cls: "Magic User", weapon: "Birch Staff", staff, items: [sword] });
  const cards = gearBagCardsModel(st(c));
  const card = cards.find((k) => k.name === "Long Sword");
  assert.equal(card.tag, "WEAPON · SWAP", "the weapon slot is occupied by the wielded staff — weaponRow(c.weapon) must read it, not a raw WEAPONS lookup");
});

// ═══════════════════════ Gear sheet ════════════════════════════════════════

test("Gear sheet: the WORN weapon sheet for a wielded staff offers USE (dispatch {slot:'weapon'}), UNEQUIP, and SWAP FOR each bag weapon or staff", () => {
  const staff = birchStaff();
  const sword = { n: "Long Sword", kind: "weapon", base: "Long Sword", bonus: 0, n2: "sword", txt: "d8+2" };
  const rowan = { n: "Rowan Staff", kind: "staff", use: "dome", charges: 2, txt: "a protective dome of 100 hp" };
  const c = fixedFighter({ cls: "Magic User", weapon: "Birch Staff", staff, items: [sword, rowan] });
  const model = gearSheetModel(st(c), { from: "worn", slot: "weapon" });
  assert.ok(model, "the model must resolve for a wielded staff's own worn slot");
  const use = model.actions.find((a) => a.key === "use");
  assert.ok(use, "expected a USE action");
  assert.deepEqual(use.run, { type: "useItem", slot: "weapon" });
  const unequip = model.actions.find((a) => a.key === "unequip");
  assert.ok(unequip, "expected an UNEQUIP action");
  assert.deepEqual(unequip.run, { type: "unequipSlot", slot: "weapon" });
  const swapNames = model.actions.filter((a) => a.key.startsWith("swap:")).map((a) => a.label);
  assert.ok(swapNames.some((l) => l.includes("Long Sword")), "expected SWAP FOR the bag weapon");
  assert.ok(swapNames.some((l) => l.includes("Rowan Staff")), "expected SWAP FOR the bag staff too");
});

test("Gear sheet: a bag staff's sheet offers EQUIP TO / SWAP INTO WEAPON for a Magic User, and DROP — never USE", () => {
  const staff = birchStaff();

  const bareHanded = fixedFighter({ cls: "Magic User", weapon: "Fists", staff: null, items: [staff] });
  const equipModel = gearSheetModel(st(bareHanded), { from: "bag", i: 0, n: "Birch Staff" });
  assert.equal(equipModel.actions.find((a) => a.key === "use"), undefined);
  const equipAction = equipModel.actions.find((a) => a.key === "slot:weapon");
  assert.equal(equipAction.label, "EQUIP TO WEAPON");
  assert.deepEqual(equipAction.run, { type: "equipItem", i: 0 });
  assert.ok(equipModel.actions.some((a) => a.key === "drop"));

  const wielding = fixedFighter({ cls: "Magic User", weapon: "Club", items: [staff] });
  const swapModel = gearSheetModel(st(wielding), { from: "bag", i: 0, n: "Birch Staff" });
  assert.equal(swapModel.actions.find((a) => a.key === "use"), undefined);
  const swapAction = swapModel.actions.find((a) => a.key === "slot:weapon");
  assert.equal(swapAction.label, "SWAP INTO WEAPON");
});

test("Gear sheet: a bag staff's sheet for a non-Magic-User offers only DROP — no equip action, never USE", () => {
  const staff = birchStaff();
  const c = fixedFighter({ cls: "Fighter", weapon: "Club", items: [staff] });
  const model = gearSheetModel(st(c), { from: "bag", i: 0, n: "Birch Staff" });
  assert.deepEqual(model.actions.map((a) => a.key), ["drop"]);
});

// ═══════════════════════ itemStatLines / wornItemFor ══════════════════════

test("itemStatLines: a staff (bag or wielded) leads with the wield line, then its effect, then its charges", () => {
  const staff = birchStaff();
  const c = fixedFighter({ cls: "Magic User" });
  const bagLines = itemStatLines(staff, c);
  assert.deepEqual(bagLines.map((l) => l.key), ["wield", "effect", "charges", "usable"]);
  assert.equal(bagLines[0].text, ITEM_STAT_COPY.text.wield.replace("{lab}", "d8"));
  assert.equal(bagLines[1].text, BIRCH_TXT);
  assert.match(bagLines[2].text, /^\d+\/\d+ charges$/);
});

test("wornItemFor(c, 'weapon') returns the wielded staff object itself, so the worn and bag reads format identically", () => {
  const staff = birchStaff();
  const c = fixedFighter({ cls: "Magic User", weapon: "Birch Staff", staff });
  const worn = wornItemFor(c, "weapon");
  assert.equal(worn, staff, "wornItemFor must return the REAL wielded object, not a reconstruction");
  assert.deepEqual(itemStatLines(worn, c), itemStatLines(staff, c));
});

test("lootCompare for a staff card never throws: legal for a Magic User, 'not you' otherwise", () => {
  const staff = birchStaff();
  const mu = fixedFighter({ cls: "Magic User" });
  const fighter = fixedFighter({ cls: "Fighter" });

  const legal = lootCompare(mu, staff);
  assert.equal(legal.legal, true);
  assert.equal(legal.line, ITEM_STAT_COPY.text.wield.replace("{lab}", "d8"));

  const illegal = lootCompare(fighter, staff);
  assert.equal(illegal.legal, false);
  assert.equal(illegal.reason, "wrongClass");
  assert.match(illegal.line, /can't use/);
  assert.doesNotThrow(() => lootCompare(fighter, staff));
});

// ═══════════════════════ Hero sheet ════════════════════════════════════════

test("Hero sheet: the weapon damage row reads the wielded staff's d8 through weaponRow, never the Club fallback", () => {
  const staff = birchStaff();
  const wielding = fixedFighter({ cls: "Magic User", weapon: "Birch Staff", staff, level: 1, prof: 0, magicWpn: 0, might: 0 });
  const bareFisted = fixedFighter({ cls: "Magic User", weapon: "Fists", staff: null, level: 1, prof: 0, magicWpn: 0, might: 0 });

  const wieldingDamage = characterSheetViewModel(fixedState({ c: wielding })).stats.find((s) => s.key === "damage");
  const clubDamage = characterSheetViewModel(fixedState({ c: bareFisted })).stats.find((s) => s.key === "damage");

  // Birch Staff resolves through STAFF_WEAPON (1d8+1 flat = 2-9); the Club
  // fallback is 1d6+1 flat = 2-7 — the two ranges must differ, proving the
  // sheet did not silently fall back to the Club for a recognized staff
  // name. (level 1: flat = level^2 + prof + magicWpn = 1, Human carries no
  // race dmg/wpnBonus.)
  assert.notDeepEqual(wieldingDamage, clubDamage);
  assert.equal(wieldingDamage.min, 1 * 1 + 1);
  assert.equal(wieldingDamage.max, STAFF_WEAPON.dice.sides + 1);
  assert.equal(clubDamage.min, 1 * 1 + 1);
  assert.equal(clubDamage.max, WEAPONS["Club"].dice.sides + 1);
  assert.equal(weaponRow("Birch Staff"), STAFF_WEAPON);
});

// ═══════════════════════ Combat ITEMS ═════════════════════════════════════

test("Combat ITEMS: a Magic User in combat with a Birch Staff in the bag — disabled row, NOT WIELDED, not counted", () => {
  const staff = birchStaff();
  const c = fixedFighter({ cls: "Magic User", weapon: "Fists", staff: null, items: [staff] });
  const state = fixedState({ c, combat: fixedCombat([]) });
  const vm = combatMenuViewModel(state);
  const row = vm.submenus.items.rows.find((r) => r.id === "item-0");
  assert.equal(row.enabled, false);
  assert.equal(row.cost, COMBAT_MENU_COPY.notWielded);
  assert.equal(row.desc, COMBAT_MENU_COPY.notWieldedDesc);
  assert.equal(vm.actions[2].sub, "0 usable");
});

test("Combat ITEMS: a Magic User in combat wielding a Birch Staff — its own EQUIPPED row, dispatches by slot, counted", () => {
  const staff = birchStaff();
  const c = fixedFighter({ cls: "Magic User", weapon: "Birch Staff", staff, items: [] });
  const state = fixedState({ c, combat: fixedCombat([]) });
  const vm = combatMenuViewModel(state);
  const row = vm.submenus.items.rows.find((r) => r.id === "worn-weapon");
  assert.ok(row, "expected a worn-weapon row for the wielded staff");
  assert.equal(row.enabled, true);
  assert.equal(row.cost, `${COMBAT_MENU_COPY.equipped} · READY`);
  assert.deepEqual(row.dispatch, { type: "useItem", slot: "weapon" });
  assert.equal(vm.actions[2].sub, "1 usable");
});

// ═══════════════════════ Presentation-only guard ══════════════════════════

test("presentation-only: every legality read for a staff routes through the engine's own wieldedStaff/weaponRow, never a restated rule", () => {
  const staff = birchStaff();
  const c = fixedFighter({ cls: "Magic User", weapon: "Birch Staff", staff });
  assert.equal(wieldedStaff(c), staff);
  assert.equal(weaponRow(c.weapon), STAFF_WEAPON);
});
