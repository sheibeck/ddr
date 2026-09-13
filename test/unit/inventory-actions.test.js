// test/unit/inventory-actions.test.js
//
// Phase 13 (Economy B, ECON-03/04/05): the player-choice inventory actions
// that REPLACE the prototype's auto-take-best behavior. Covers the pure engine
// handlers (engine/items.js takeFind/leaveFind/dropItem/equipItem/unequipSlot)
// AND the extracted legality predicates (canEquipWeapon/canEquipArmor), plus
// the applyAction wiring/validation seam (engine/engine.js + engine/actions.js).
//
// Every handler is PURE (no rng) and enforces the bag-slot cap (content/bags.js
// BAGS[c.bag].slots) ONLY here — the frozen giveItem/gainWilmst/takeItem paths
// stay uncapped (proven byte-identical by test/parity/*). A bag-less character
// is never capped (matches the clampCarry gate).

import test from "node:test";
import assert from "node:assert/strict";

import {
  takeFind,
  leaveFind,
  dropItem,
  equipItem,
  unequipSlot,
  canEquipWeapon,
  canEquipArmor,
} from "../../engine/items.js";
import { applyAction, newRun } from "../../engine/engine.js";
import { validateAction } from "../../engine/actions.js";
import { BAGS } from "../../content/bags.js";

/** A minimal character with a bag, an equipped weapon/armor, and an items array.
 * Fields mirror engine/character.js's rollCharacter shape for the parts these
 * handlers read/write. */
function fixedChar(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1,
    weapon: "Broadsword", prof: 0, magicWpn: 0, // WEAPON_MAX Broadsword = 12
    armor: "Leather", ar: 6, armorMin: 1, armorWP: 15, armorMax: 15, patches: 0,
    skills: {}, gold: 50, rations: 6, scrolls: 0, maxWP: 55, wp: 40,
    bag: "small", // 4 slots
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
const ARMOR = (name, ar, cls = "FT") => ({ kind: "armor", n: name, armor: name, ar, wp: 20, min: 1, cls, txt: `AR ${ar}` });

// --- canEquipWeapon / canEquipArmor (extracted legality, ECON-05) ------------

test("canEquipWeapon: class letter gate, Acrobat dagger-only", () => {
  const fighter = fixedChar();
  assert.equal(canEquipWeapon(fighter, WEAPON("Broadsword")), true, "Fighter can wield an F weapon");
  const mu = fixedChar({ cls: "Magic User" });
  assert.equal(canEquipWeapon(mu, WEAPON("Broadsword")), false, "a Magic User cannot wield an F-only weapon");
  assert.equal(canEquipWeapon(mu, WEAPON("Dagger")), true, "a Magic User can wield a Dagger (FTM)");
  const acrobat = fixedChar({ cls: "Thief", sub: "Acrobat" });
  assert.equal(canEquipWeapon(acrobat, WEAPON("Long Sword")), false, "an Acrobat may wield only a Dagger");
  assert.equal(canEquipWeapon(acrobat, WEAPON("Dagger")), true, "an Acrobat may wield a Dagger");
});

test("canEquipArmor: race noArmor, class gate, Thief Heft light-armor exception", () => {
  const fighter = fixedChar();
  assert.equal(canEquipArmor(fighter, ARMOR("Plate", 15, "F")), true, "a Fighter can wear plate");
  const fridgian = fixedChar({ race: "Fridgian" });
  assert.equal(canEquipArmor(fridgian, ARMOR("Leather", 6)), false, "a noArmor race can wear nothing");
  const thief = fixedChar({ cls: "Thief" });
  assert.equal(canEquipArmor(thief, ARMOR("Mail", 12, "F")), false, "a plain Thief cannot wear F-only mail");
  const heftThief = fixedChar({ cls: "Thief", skills: { Heft: 1 } });
  assert.equal(canEquipArmor(heftThief, ARMOR("Mail", 12, "F")), true, "a Heft Thief can wear armor up to AR 12");
  assert.equal(canEquipArmor(heftThief, ARMOR("Plate", 15, "F")), false, "even a Heft Thief cannot wear AR 15 plate");
});

// --- offer / takeFind / leaveFind (ECON-03/04) -------------------------------

test("takeFind: a pending find drops into a free bag slot and clears the offer", () => {
  const state = fixedState({ pendingFind: WEAPON("Dagger") });
  const events = takeFind(state, []);
  assert.equal(state.c.items.length, 1);
  assert.equal(state.c.items[0].base, "Dagger");
  assert.equal(state.pendingFind, null, "the offer is cleared on success");
  assert.ok(events.some((e) => e.type === "findTaken"));
});

test("takeFind: a found weapon lands in the BAG (no auto-equip — ECON-05 is a separate choice)", () => {
  const state = fixedState({ pendingFind: WEAPON("Claymore") });
  takeFind(state, []);
  assert.equal(state.c.weapon, "Broadsword", "the worn weapon is untouched — the find is not auto-equipped");
  assert.equal(state.c.items[0].base, "Claymore", "it sits in the bag until the player equips it");
});

test("takeFind: a FULL bag keeps the find pending and emits bagFull (ECON-04)", () => {
  const state = fixedState({
    c: { bag: "small", items: [WEAPON("Dagger"), WEAPON("Dagger"), WEAPON("Dagger"), WEAPON("Dagger")] },
    pendingFind: WEAPON("Claymore"),
  });
  assert.equal(state.c.items.length, BAGS.small.slots, "bag starts full");
  const events = takeFind(state, []);
  assert.ok(events.some((e) => e.type === "bagFull"));
  assert.ok(state.pendingFind, "the find stays pending on a full bag");
  assert.equal(state.c.items.length, 4, "nothing was added");
});

test("takeFind: applies a flat eff.wp on pickup (like giveItem)", () => {
  const state = fixedState({ pendingFind: { kind: "jewel", n: "Ring of Vigor", eff: { wp: 10 }, txt: "+10 hp" } });
  takeFind(state, []);
  assert.equal(state.c.maxWP, 65, "eff.wp raises the cap on pickup");
  assert.equal(state.c.wp, 50);
});

test("leaveFind: discards the pending find", () => {
  const state = fixedState({ pendingFind: WEAPON("Dagger") });
  const events = leaveFind(state, []);
  assert.equal(state.pendingFind, null);
  assert.equal(state.c.items.length, 0);
  assert.ok(events.some((e) => e.type === "findLeft"));
});

// --- dropItem (ECON-04) ------------------------------------------------------

test("dropItem: splices the item and frees a slot", () => {
  const state = fixedState({ c: { items: [WEAPON("Dagger"), ARMOR("Cloth", 3)] } });
  const events = dropItem(state, 0, []);
  assert.equal(state.c.items.length, 1);
  assert.equal(state.c.items[0].kind, "armor");
  assert.ok(events.some((e) => e.type === "itemDropped"));
});

test("dropItem: an out-of-range index is a no-op", () => {
  const state = fixedState({ c: { items: [WEAPON("Dagger")] } });
  const events = dropItem(state, 9, []);
  assert.equal(state.c.items.length, 1);
  assert.equal(events.length, 0);
});

// --- equipItem: direct swap, incl. INFERIOR gear (ECON-05) -------------------

test("equipItem: equips an INFERIOR legal weapon (direct swap; the worn piece returns to the bag)", () => {
  // Fighter wielding a Broadsword (WEAPON_MAX 12); a Dagger (3) in the bag.
  const state = fixedState({ c: { weapon: "Broadsword", magicWpn: 0, items: [WEAPON("Dagger")] } });
  const events = equipItem(state, 0, []);
  assert.equal(state.c.weapon, "Dagger", "equips the worse weapon regardless (the deliberate change vs takeItem)");
  assert.equal(state.c.items.length, 1, "no net slot change — direct swap");
  assert.equal(state.c.items[0].base, "Broadsword", "the previously-worn weapon dropped back into the bag");
  assert.ok(events.some((e) => e.type === "itemEquipped" && e.slot === "weapon"));
});

test("equipItem: equips an INFERIOR legal armor and swaps the worn piece back", () => {
  const state = fixedState({ c: { armor: "Plate", ar: 15, armorMax: 45, armorWP: 45, items: [ARMOR("Cloth", 3, "FTM")] } });
  const events = equipItem(state, 0, []);
  assert.equal(state.c.armor, "Cloth");
  assert.equal(state.c.ar, 3, "equipped even though it is worse AR");
  assert.equal(state.c.items.length, 1, "direct swap — no net slot change");
  assert.equal(state.c.items[0].armor, "Plate", "the worn plate returned to the bag");
  assert.ok(events.some((e) => e.type === "itemEquipped" && e.slot === "armor"));
});

test("equipItem: REJECTS an illegal class weapon (Magic User + F-only blade)", () => {
  const state = fixedState({ c: { cls: "Magic User", weapon: "Dagger", items: [WEAPON("Broadsword")] } });
  const events = equipItem(state, 0, []);
  assert.equal(state.c.weapon, "Dagger", "nothing equipped");
  assert.equal(state.c.items.length, 1, "the item stays in the bag");
  assert.ok(events.some((e) => e.type === "equipRejected" && e.reason === "wrongClass"));
});

test("equipItem: REJECTS an Acrobat wielding a non-dagger", () => {
  const state = fixedState({ c: { cls: "Thief", sub: "Acrobat", weapon: "Dagger", items: [WEAPON("Long Sword")] } });
  const events = equipItem(state, 0, []);
  assert.ok(events.some((e) => e.type === "equipRejected" && e.reason === "wrongClass"));
});

test("equipItem: REJECTS armor for a noArmor race", () => {
  const state = fixedState({ c: { race: "Fridgian", armor: "Nothing", ar: 0, items: [ARMOR("Leather", 6)] } });
  const events = equipItem(state, 0, []);
  assert.ok(events.some((e) => e.type === "equipRejected" && e.reason === "noArmor"));
  assert.equal(state.c.armor, "Nothing");
});

test("equipItem: REJECTS heavy armor for a Thief without Heft; ACCEPTS it with Heft", () => {
  const noHeft = fixedState({ c: { cls: "Thief", armor: "Nothing", ar: 0, items: [ARMOR("Mail", 12, "F")] } });
  assert.ok(equipItem(noHeft, 0, []).some((e) => e.type === "equipRejected" && e.reason === "tooHeavy"));

  const withHeft = fixedState({ c: { cls: "Thief", skills: { Heft: 1 }, armor: "Nothing", ar: 0, items: [ARMOR("Mail", 12, "F")] } });
  const ev = equipItem(withHeft, 0, []);
  assert.ok(ev.some((e) => e.type === "itemEquipped"));
  assert.equal(withHeft.c.armor, "Mail");
  assert.equal(withHeft.c.items.length, 0, "worn was 'Nothing' — no piece swapped back, net −1 slot");
});

test("equipItem: REJECTS a non-equippable item (a staff is a bag item, not a slot)", () => {
  const state = fixedState({ c: { items: [{ kind: "staff", n: "Staff of Testing", txt: "zap" }] } });
  const events = equipItem(state, 0, []);
  assert.ok(events.some((e) => e.type === "equipRejected" && e.reason === "notEquippable"));
  assert.equal(state.c.items.length, 1, "the staff stays in the bag");
});

// --- unequipSlot (ECON-05) ---------------------------------------------------

test("unequipSlot: returns worn armor to the bag and bares the slot", () => {
  const state = fixedState({ c: { armor: "Leather", ar: 6, armorMax: 15, armorWP: 15, items: [] } });
  const events = unequipSlot(state, "armor", []);
  assert.equal(state.c.armor, "Nothing");
  assert.equal(state.c.ar, 0);
  assert.equal(state.c.items.length, 1, "the armor is now in the bag");
  assert.equal(state.c.items[0].armor, "Leather");
  assert.ok(events.some((e) => e.type === "itemUnequipped" && e.slot === "armor"));
});

test("unequipSlot: returns worn weapon to the bag, leaving the hero bare-handed", () => {
  const state = fixedState({ c: { weapon: "Broadsword", magicWpn: 0, items: [] } });
  const events = unequipSlot(state, "weapon", []);
  assert.equal(state.c.weapon, "Fists");
  assert.equal(state.c.items[0].base, "Broadsword");
  assert.ok(events.some((e) => e.type === "itemUnequipped" && e.slot === "weapon"));
});

test("unequipSlot: a FULL bag blocks the unequip (bagFull)", () => {
  const state = fixedState({
    c: { armor: "Leather", ar: 6, armorMax: 15, items: [WEAPON("Dagger"), WEAPON("Dagger"), WEAPON("Dagger"), WEAPON("Dagger")] },
  });
  const events = unequipSlot(state, "armor", []);
  assert.ok(events.some((e) => e.type === "bagFull"));
  assert.equal(state.c.armor, "Leather", "still worn — nowhere to stow it");
});

// --- bag-slot cap is enforced ONLY in these handlers -------------------------

test("a bag-less character is never capped by the new handlers (matches the clampCarry gate)", () => {
  const state = fixedState({ c: { bag: undefined, items: [WEAPON("Dagger"), WEAPON("Dagger"), WEAPON("Dagger"), WEAPON("Dagger")] }, pendingFind: WEAPON("Claymore") });
  const events = takeFind(state, []);
  assert.ok(events.some((e) => e.type === "findTaken"), "no bag key -> no cap -> the find is taken");
  assert.equal(state.c.items.length, 5);
});

// --- applyAction wiring + validation -----------------------------------------

test("applyAction: routes each new action through the engine and persists no rng shift", () => {
  const base = newRun(7);
  base.pendingFind = WEAPON("Dagger");
  const rngBefore = base.rngState;
  const { state, events } = applyAction(base, { type: "takeFind" });
  assert.ok(events.some((e) => e.type === "findTaken"));
  assert.equal(state.rngState, rngBefore, "a pure action never shifts the seeded rng cursor");
});

test("validateAction: the new actions guard their payloads", () => {
  assert.equal(validateAction({ type: "takeFind" }).ok, true);
  assert.equal(validateAction({ type: "leaveFind" }).ok, true);
  assert.equal(validateAction({ type: "dropItem", i: 0 }).ok, true);
  assert.equal(validateAction({ type: "dropItem", i: -1 }).ok, false);
  assert.equal(validateAction({ type: "equipItem", i: 2 }).ok, true);
  assert.equal(validateAction({ type: "equipItem" }).ok, false);
  assert.equal(validateAction({ type: "unequipSlot", slot: "weapon" }).ok, true);
  assert.equal(validateAction({ type: "unequipSlot", slot: "armor" }).ok, true);
  assert.equal(validateAction({ type: "unequipSlot", slot: "boots" }).ok, false);
});

test("applyAction: a malformed new action is a safe no-op (never throws)", () => {
  const base = newRun(3);
  base.c.items = [WEAPON("Dagger")];
  const { state, events } = applyAction(base, { type: "dropItem", i: -5 });
  assert.equal(events.length, 0);
  assert.equal(state.c.items.length, 1, "state unchanged");
});
