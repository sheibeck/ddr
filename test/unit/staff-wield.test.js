// test/unit/staff-wield.test.js
//
// RULES-13 (Phase 75, user 2026-09-25) — a magic staff is a Magic User's
// WIELDED weapon: equipped into the weapon slot, it fights as a flat d8
// melee weapon (need 0, crit 1, max 8) plus the hero's usual damage
// modifiers, and its charged power is used from that same slot. This
// reverses the 2026-09-18 staff amendment (content/treasure-tables.js).
//
// Plan 75-07 (this file) builds the wield MODEL: weaponRow/wieldedStaff
// (engine/derived.js, Task 1), the staff branch on every weapon path
// (engine/items.js/economy.js, Task 2), useItem by slot, save tolerance, and
// the parity comparables carve-out. Plan 75-09 later makes a BAGGED staff's
// power inert and teaches the bot to wield.
//
// Local fixedFighter/fixedState helpers mirror test/unit/bubble-mirror.test.js's
// established convention (kept local per that file's own comment).

import test from "node:test";
import assert from "node:assert/strict";

import {
  weaponRow,
  wieldedStaff,
  weaponNeedMod,
  weaponCrit,
  weaponDamage,
  expectedStrike,
  gearCompareParts,
  carriedItems,
} from "../../engine/derived.js";
import { equipItem, unequipSlot, takeLoot, useItem } from "../../engine/items.js";
import { deliverGear } from "../../engine/economy.js";
import { validateAction } from "../../engine/actions.js";
import { rehydrate } from "../../engine/saveState.js";
import { newRun } from "../../engine/state.js";
import { WEAPONS, STAFF_WEAPON, STAFF_NAMES } from "../../content/index.js";

/** fakeRng(seq) — `.d()` pops the next value off `seq` regardless of the
 * requested side count. Throws if the sequence underflows. */
function fakeRng(seq) {
  let i = 0;
  return {
    d(_sides) {
      if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick: (arr) => arr[0],
    shuffle: (a) => a,
  };
}

function fixedFighter(overrides = {}) {
  return {
    cls: "Magic User", sub: "Wizard", race: "Human", level: 1, sp: 0,
    maxWP: 40, wp: 40, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 1, rations: 6, gold: 50, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Caster",
    darkFor: 0,
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
    day: 1, steps: 0, combat: null, store: null, beats: null,
    dead: false, deathNote: "", epitaph: "",
    ...rest,
  };
}

function birchStaff(overrides = {}) {
  return { kind: "staff", n: "Birch Staff", use: "freeze", txt: "freezes up to 2 squares of opponents indefinitely", charges: 2, ...overrides };
}

function fixedFoe(overrides = {}) {
  return {
    name: "Target", type: "Beasts", lvl: 1, size: "S", intel: 1,
    wp: 10, maxWP: 10, alive: true, asleep: 0, sp: {}, lives: 1,
    ...overrides,
  };
}

function fixedCombat(foes, overrides = {}) {
  return { foes, type: foes[0]?.type || "Beasts", round: 1, target: 0, spellOpen: false, tracked: false, ...overrides };
}

// ─── 1: weaponRow ────────────────────────────────────────────────────────

test("weaponRow: an ordinary WEAPONS name resolves to its own row", () => {
  assert.equal(weaponRow("Long Sword"), WEAPONS["Long Sword"]);
});

test("weaponRow: a STAFF_NAMES name resolves to STAFF_WEAPON", () => {
  for (const name of STAFF_NAMES) {
    assert.equal(weaponRow(name), STAFF_WEAPON);
  }
});

test("weaponRow: 'Fists' and an unrecognized/undefined name are null", () => {
  assert.equal(weaponRow("Fists"), null);
  assert.equal(weaponRow("Not A Weapon"), null);
  assert.equal(weaponRow(undefined), null);
});

test("STAFF_WEAPON's own shape: d8, need 0, crit 1, max 8, class M", () => {
  assert.deepStrictEqual(STAFF_WEAPON, { dice: { n: 1, sides: 8, bonus: 0 }, lab: "d8", cls: "M", need: 0, crit: 1, max: 8 });
});

// ─── 2: wieldedStaff ─────────────────────────────────────────────────────

test("wieldedStaff: returns the staff when c.staff.n matches c.weapon", () => {
  const staff = birchStaff();
  const c = fixedFighter({ weapon: "Birch Staff", staff });
  assert.equal(wieldedStaff(c), staff);
});

test("wieldedStaff: null when c.staff is absent", () => {
  const c = fixedFighter({ weapon: "Birch Staff" });
  assert.equal(wieldedStaff(c), null);
});

test("wieldedStaff: null when c.staff.n and c.weapon disagree (mismatched/stale)", () => {
  const c = fixedFighter({ weapon: "Oak Staff", staff: birchStaff() });
  assert.equal(wieldedStaff(c), null);
});

// ─── 3: a wielded staff reads as a d8 weapon everywhere ─────────────────

test("weaponDamage: a wielded Birch Staff rolls 1d8 plus the usual flat terms — a scripted 8 matches a Spear's scripted 8", () => {
  const staffC = fixedFighter({ weapon: "Birch Staff", staff: birchStaff(), level: 2 });
  const spearC = fixedFighter({ weapon: "Spear", level: 2 });
  const staffDmg = weaponDamage(staffC, fakeRng([8]));
  const spearDmg = weaponDamage(spearC, fakeRng([8]));
  assert.equal(staffDmg, spearDmg);
});

test("weaponCrit: a wielded staff crits on 1, like the Spear", () => {
  const c = fixedFighter({ weapon: "Birch Staff", staff: birchStaff() });
  assert.equal(weaponCrit(c), 1);
});

test("weaponNeedMod: a wielded staff's need modifier is 0, like the Spear", () => {
  assert.equal(weaponNeedMod("Birch Staff"), 0);
  const c = fixedFighter({ weapon: "Birch Staff" });
  assert.equal(weaponNeedMod(c), 0);
});

test("expectedStrike: a wielded staff equals the Spear's expectedStrike for the same hero (same dice/need/crit shape)", () => {
  const c = fixedFighter({ level: 3 });
  assert.equal(expectedStrike(c, "Birch Staff", 0, 0), expectedStrike(c, "Spear", 0, 0));
});

test("gearCompareParts: the 'have' side reads a wielded staff's row (lab d8, need 0, crit 1)", () => {
  const c = fixedFighter({ weapon: "Birch Staff", staff: birchStaff() });
  const parts = gearCompareParts(c, { kind: "weapon", base: "Long Sword", bonus: 0 });
  assert.equal(parts.have.lab, "d8");
  assert.equal(parts.have.need, 0);
  assert.equal(parts.have.crit, 1);
});

// ─── 4: carriedItems includes the wielded staff exactly once ────────────

test("carriedItems: includes the wielded staff once, after the bag and worn items", () => {
  const staff = birchStaff();
  const ring = { n: "Ring of Power", kind: "jewel" };
  const c = fixedFighter({ weapon: "Birch Staff", staff, items: [{ n: "Rope", kind: "tool" }], worn: { jewelry1: ring } });
  const carried = carriedItems(c);
  assert.deepStrictEqual(carried, [{ n: "Rope", kind: "tool" }, ring, staff]);
});

test("carriedItems: a bagged (unwielded) staff is not duplicated — it stays a plain bag item", () => {
  const staff = birchStaff();
  const c = fixedFighter({ weapon: "Club", items: [staff] });
  const carried = carriedItems(c);
  assert.deepStrictEqual(carried, [staff]);
});

// ─── 5: WEAPONS is untouched ─────────────────────────────────────────────

test("WEAPONS' key order is byte-identical to the plan base (24 keys)", () => {
  assert.deepStrictEqual(Object.keys(WEAPONS), [
    "Axe", "Bastard Sword", "Battle Axe", "Broadsword", "Claymore", "Dagger", "Katana", "Kopesh Sword",
    "Long Sword", "Ninja-to", "Rapier", "Short Sword", "Wakazashi", "Club", "Flail", "Mace", "Morning Star",
    "Quarter Staff", "Spiked Staff", "Whip", "Awl Pike", "Bardiche", "Naganita", "Spear",
  ]);
});

// ─── Task 2: wield/unwield on every weapon path, use by slot, save
//     tolerance, the parity carve-out ───────────────────────────────────

// 6: equipItem — the wield swap

test("equipItem: a Magic User with a Club equips a bagged Birch Staff — wield state, itemEquipped replaces Club", () => {
  const staff = birchStaff();
  const state = fixedState({ c: { weapon: "Club", items: [staff] } });
  const events = equipItem(state, 0, []);
  assert.equal(state.c.weapon, "Birch Staff");
  assert.equal(state.c.staff, staff);
  assert.equal(state.c.prof, 0);
  assert.equal(state.c.magicWpn, 0);
  const club = { kind: "weapon", n: "Club", base: "Club", bonus: 0, txt: "d6" };
  assert.deepStrictEqual(state.c.items, [club]);
  const evt = events.find((e) => e.type === "itemEquipped");
  assert.equal(evt.slot, "weapon");
  assert.deepStrictEqual(evt.replaced, club);
});

test("equipItem: a Fighter cannot equip a staff — equipRejected wrongClass, state unchanged", () => {
  const staff = birchStaff();
  const state = fixedState({ c: { cls: "Fighter", sub: "Soldier", weapon: "Long Sword", items: [staff] } });
  const before = structuredClone(state);
  const events = equipItem(state, 0, []);
  assert.deepStrictEqual(events, [{ type: "equipRejected", item: staff, reason: "wrongClass" }]);
  assert.deepStrictEqual(state, before);
});

test("equipItem: with a staff wielded, equipping a Dagger bags the SAME staff object (charges preserved) and clears c.staff", () => {
  const staff = birchStaff({ charges: 1 });
  const dagger = { kind: "weapon", n: "Dagger", base: "Dagger", bonus: 0 };
  const state = fixedState({ c: { weapon: "Birch Staff", staff, items: [dagger] } });
  const events = equipItem(state, 0, []);
  assert.equal(state.c.weapon, "Dagger");
  assert.equal("staff" in state.c, false);
  assert.equal(state.c.items[0], staff);
  assert.equal(state.c.items[0].charges, 1);
  const evt = events.find((e) => e.type === "itemEquipped");
  assert.equal(evt.slot, "weapon");
});

test("equipItem: wielding a second staff swaps the first into the bag", () => {
  const first = birchStaff({ charges: 1 });
  const second = birchStaff({ n: "Oak Staff", use: "stone", charges: 1 });
  const state = fixedState({ c: { weapon: "Birch Staff", staff: first, items: [second] } });
  const events = equipItem(state, 0, []);
  assert.equal(state.c.weapon, "Oak Staff");
  assert.equal(state.c.staff, second);
  assert.equal(state.c.items[0], first);
  const evt = events.find((e) => e.type === "itemEquipped");
  assert.deepStrictEqual(evt.replaced, first);
});

// 7: unequipSlot("weapon")

test("unequipSlot('weapon'): bags a wielded staff (the same object) and sets Fists", () => {
  const staff = birchStaff();
  const state = fixedState({ c: { weapon: "Birch Staff", staff, items: [] } });
  unequipSlot(state, "weapon", []);
  assert.equal(state.c.weapon, "Fists");
  assert.equal(state.c.prof, 0);
  assert.equal(state.c.magicWpn, 0);
  assert.equal("staff" in state.c, false);
  assert.equal(state.c.items[0], staff);
});

// 8: takeLoot(equip:true)

test("takeLoot(equip:true): a dropped weapon stows a wielded staff first; bagFull keeps everything pending when there is no room", () => {
  const staff = birchStaff();
  // "Club" (cls FTM) is legal for a Magic User to equip — "Long Sword" (FT) is not.
  const club = { kind: "weapon", n: "Club", base: "Club", bonus: 0 };
  const filler = () => ({ kind: "tool", n: "Rope", tool: "Rope" });
  const state = fixedState({ c: { weapon: "Birch Staff", staff, bag: "small", items: [filler(), filler(), filler(), filler()] } });
  state.pendingLoot = [club];
  const events = takeLoot(state, 0, true, []);
  assert.ok(events.some((e) => e.type === "bagFull"));
  assert.equal(state.c.weapon, "Birch Staff");
  assert.equal(state.c.staff, staff);
  assert.equal(state.pendingLoot.length, 1);
});

test("takeLoot(equip:true): a bagged staff equips into the weapon slot for a Magic User (mirrors the weapon branch)", () => {
  const staff = birchStaff();
  const state = fixedState({ c: { weapon: "Club" } });
  state.pendingLoot = [staff];
  const events = takeLoot(state, 0, true, []);
  assert.equal(state.c.weapon, "Birch Staff");
  assert.equal(state.c.staff, staff);
  assert.equal(state.pendingLoot.length, 0);
  const evt = events.find((e) => e.type === "itemEquipped");
  assert.equal(evt.slot, "weapon");
});

// 9: the store never trades a wielded staff away

test("deliverGear: a weapon purchase while a staff is wielded is bagged (purchaseBagged); the staff stays wielded", () => {
  const staff = birchStaff();
  const state = fixedState({ c: { weapon: "Birch Staff", staff, items: [] } });
  const longSword = { kind: "weapon", base: "Long Sword", bonus: 0, n: "Long Sword" };
  const events = [];
  deliverGear(state, longSword, events);
  assert.equal(state.c.weapon, "Birch Staff");
  assert.equal(state.c.staff, staff);
  assert.deepStrictEqual(state.c.items, [longSword]);
  assert.ok(events.some((e) => e.type === "purchaseBagged"));
});

// 10: useItem by slot

test("useItem({slot:'weapon'}): a wielded Birch Staff freezes foes and spends its OWN charge", () => {
  const staff = birchStaff({ charges: 2 });
  const state = fixedState({
    c: { weapon: "Birch Staff", staff, items: [] },
    combat: fixedCombat([fixedFoe(), fixedFoe()]),
  });
  const events = useItem(state, { slot: "weapon" }, fakeRng([]), []);
  assert.equal(staff.charges, 1);
  assert.ok(events.some((e) => e.type === "itemUsed"));
  assert.ok(state.combat.foes[0].asleep >= 99);
});

test("useItem({slot:'weapon'}): with no staff wielded, a silent no-op", () => {
  const state = fixedState({ c: { weapon: "Club", items: [] } });
  const events = useItem(state, { slot: "weapon" }, fakeRng([]), []);
  assert.deepStrictEqual(events, []);
});

test("validateAction: useItem accepts {slot:'weapon'} and still rejects slot plus i together", () => {
  assert.deepStrictEqual(validateAction({ type: "useItem", slot: "weapon" }), { ok: true });
  const rejected = validateAction({ type: "useItem", slot: "weapon", i: 0 });
  assert.equal(rejected.ok, false);
});

// 11: the gear lock refuses every path above, first

test("gear lock: equipItem/unequipSlot/takeLoot(equip) all refuse a staff swap while state.combat is set", () => {
  const dagger = { kind: "weapon", n: "Dagger", base: "Dagger", bonus: 0 };
  const combat1 = fixedCombat([fixedFoe()]);
  const state1 = fixedState({ c: { weapon: "Birch Staff", staff: birchStaff(), items: [dagger] }, combat: combat1 });
  const before1 = structuredClone(state1.c);
  const ev1 = equipItem(state1, 0, []);
  assert.equal(ev1[0].type, "gearRefused");
  assert.deepStrictEqual(state1.c, before1);

  const state2 = fixedState({ c: { weapon: "Birch Staff", staff: birchStaff(), items: [] }, combat: fixedCombat([fixedFoe()]) });
  const before2 = structuredClone(state2.c);
  const ev2 = unequipSlot(state2, "weapon", []);
  assert.equal(ev2[0].type, "gearRefused");
  assert.deepStrictEqual(state2.c, before2);

  const state3 = fixedState({ c: { weapon: "Birch Staff", staff: birchStaff(), items: [] }, combat: fixedCombat([fixedFoe()]) });
  state3.pendingLoot = [{ kind: "weapon", n: "Long Sword", base: "Long Sword", bonus: 0 }];
  const before3 = structuredClone(state3.pendingLoot);
  const ev3 = takeLoot(state3, 0, true, []);
  assert.equal(ev3[0].type, "gearRefused");
  assert.deepStrictEqual(state3.pendingLoot, before3);
});

// 12: the comparables carve-out

test("comparables: movementComparable/combatComparable/economyComparable strip c.staff", async () => {
  const { movementComparable, combatComparable, economyComparable } = await import("../parity/harness/comparables.js");
  const staff = birchStaff();
  const state = fixedState({ c: { weapon: "Birch Staff", staff, items: [] } });
  assert.equal("staff" in movementComparable(structuredClone(state)).c, false);
  assert.equal("staff" in combatComparable(structuredClone(state)).c, false);
  assert.equal("staff" in economyComparable(structuredClone(state)).c, false);
});

// 13: save tolerance

test("saveState#rehydrate: a bag staff with no c.staff loads unchanged (no auto-equip)", () => {
  const state = newRun(1);
  state.c.cls = "Magic User";
  state.c.items = [birchStaff()];
  const before = structuredClone(state.c);
  const out = rehydrate(state);
  assert.equal(out.c.weapon, before.weapon);
  assert.equal("staff" in out.c, false);
  assert.deepStrictEqual(out.c.items, before.items);
});

test("saveState#rehydrate: a valid wielded staff round-trips", () => {
  const state = newRun(1);
  const staff = birchStaff();
  state.c.weapon = "Birch Staff";
  state.c.staff = staff;
  const out = rehydrate(state);
  assert.equal(out.c.weapon, "Birch Staff");
  assert.deepStrictEqual(out.c.staff, staff);
});

test("saveState#rehydrate: a mismatched c.staff name is dropped, and c.weapon (a staff name with no valid c.staff) resets to Fists", () => {
  const state = newRun(1);
  state.c.weapon = "Birch Staff";
  state.c.staff = birchStaff({ n: "Oak Staff" });
  const out = rehydrate(state);
  assert.equal("staff" in out.c, false);
  assert.equal(out.c.weapon, "Fists");
  assert.equal(out.c.prof, 0);
  assert.equal(out.c.magicWpn, 0);
});

test("saveState#rehydrate: c.weapon names a staff with no c.staff at all — resets to Fists", () => {
  const state = newRun(1);
  state.c.weapon = "Birch Staff";
  delete state.c.staff;
  const out = rehydrate(state);
  assert.equal(out.c.weapon, "Fists");
  assert.equal("staff" in out.c, false);
});
