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
