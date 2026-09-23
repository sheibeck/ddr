// test/unit/gear-panels.test.js
//
// Phase 43 (CLAR-04): pins for src/browser/viewModels.js#dropShelfItems /
// #emptySlotRows / GEAR_COPY — the bag-full drop prompt's bag-only source
// list (with the true c.items index, in lock-step with engine/derived.js
// #slotItems), and the ON YOU panel's in-voice empty-slot rows.

import test from "node:test";
import assert from "node:assert/strict";

import { dropShelfItems } from "../../src/browser/viewModels.js";
import { emptySlotRows, GEAR_COPY } from "../../src/browser/gearTab.js";
import { slotItems } from "../../engine/derived.js";
import { BANNED } from "../../content/safety-wordlist.js";

function collectStringLeaves(obj, pathLabel = "") {
  const leaves = [];
  if (typeof obj === "string") {
    leaves.push([pathLabel, obj]);
    return leaves;
  }
  if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) leaves.push(...collectStringLeaves(v, pathLabel ? `${pathLabel}.${k}` : k));
  }
  return leaves;
}

function fixedChar(overrides = {}) {
  return {
    cls: "Fighter", weapon: "Axe", armor: "Mail", ar: 12, armorWP: 30, armorMax: 30,
    items: [], worn: {},
    ...overrides,
  };
}

// ─── GEAR_COPY — frozen shape pin ───────────────────────────────────────────

test("GEAR_COPY carries the exact frozen literal shape (260918-w4n: no staff leaves; 260918-wy1: ring/bracelet/amulet/helm merged into jewelry1/jewelry2; Phase 62 GSCR-01..06 extension)", () => {
  assert.deepEqual(GEAR_COPY, {
    onYou: "ON YOU",
    wielded: "WIELDED",
    worn: "WORN",
    alsoOnYou: "ALSO ON YOU",
    bag: "BAG",
    freeRide: "potions & scrolls ride free",
    empty: {
      weapon: "fists — nothing in hand. Free, always with you, and not very good.",
      armor: "armor — nothing. The wind is your armor, and the wind is not on your side.",
      jewelry1: "jewelry — nothing. Ten fingers, one neck, zero commitments.",
      jewelry2: "jewelry — nothing. Room for one more bad decision.",
      cloak: "cloak — nothing. Cold and unmagical, in that order.",
    },
    armorRating: "ARMOR RATING",
    wilmst: "WILMST",
    consumables: "CONSUMABLES",
    count: "{n} / {max}",
    held: "{n} HELD",
    slot: {
      weapon: "WEAPON",
      armor: "ARMOR",
      cloak: "CLOAK",
      jewelry1: "JEWELRY 1",
      jewelry2: "JEWELRY 2",
    },
    family: {
      weapon: "WEAPON",
      armor: "ARMOR",
      cloak: "CLOAK",
      jewelry: "JEWELRY",
    },
    swap: " · SWAP",
    emptyName: "empty",
    noValue: "—",
    chevron: "›",
    weaponMagic: "+{n} magic. Somebody cared, once.",
    weaponMundane: "no enchantment. Just you and the swing.",
    magicPlate: "magic plate",
    armorWear: "{current}/{max} hp",
    armorDestroyed: "destroyed",
    bagFull: "BAG FULL · DROP OR USE SOMETHING",
    bagEmptyHead: "NOTHING LEFT TO CARRY",
    bagEmptyBody: "You used it all. That was the plan, technically.",
    use: {
      use: "USE",
      active: "ACTIVE",
      cooling: "COOLING",
      read: "READ",
    },
    healingPotion: "HEALING POTION",
    healingDesc: "Heals. Wasted at full health.",
    scrolls: "SCROLLS",
    scrollDesc: "A random spell, read aloud. No refunds.",
    qty: "×{n}",
    kit: {
      rations: "Rations",
      rationsValue: "{n} days",
      spellCharges: "Spell charges",
      spellChargesValue: "{k} / {max}",
      wardValue: "{pool} hp left · {rounds} rds",
      strength: "Strength",
      strengthValue: "+{n} damage",
      regen: "Regeneration",
      regenValue: "d8 a round",
      mirror: "Mirror Self",
      mirrorValue: "{n} rds",
      senses: "Sense Presence",
      sensesValue: "till the fight ends",
      foresight: "Sense Danger",
      foresightValue: "armed",
      reveal: "Map the Floor",
      revealValue: "{n} sq",
      kills: "Kills",
    },
    act: {
      unequip: "Unequip",
      bagFull: "Bag full",
    },
  });
  assert.ok(Object.isFrozen(GEAR_COPY));
  assert.ok(Object.isFrozen(GEAR_COPY.empty));
  assert.ok(Object.isFrozen(GEAR_COPY.slot));
  assert.ok(Object.isFrozen(GEAR_COPY.family));
  assert.ok(Object.isFrozen(GEAR_COPY.use));
  assert.ok(Object.isFrozen(GEAR_COPY.kit));
  assert.ok(Object.isFrozen(GEAR_COPY.act));
  assert.deepStrictEqual(Object.keys(GEAR_COPY.empty).sort(), ["armor", "cloak", "jewelry1", "jewelry2", "weapon"]);
});

test("GEAR_COPY: every string leaf clears the family-friendly safety wordlist", () => {
  const bannedRe = BANNED.map((term) => new RegExp("\\b" + term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i"));
  for (const [leafPath, value] of collectStringLeaves(GEAR_COPY)) {
    for (const re of bannedRe) {
      assert.doesNotMatch(value, re, `GEAR_COPY.${leafPath} -> "${value}" matches banned term ${re}`);
    }
  }
});

// ─── dropShelfItems ──────────────────────────────────────────────────────────

test("dropShelfItems: true c.items indices, potions skipped, worn/wielded never included", () => {
  const a = { kind: "jewel", n: "a" };
  const p = { kind: "potion", n: "p" };
  const b = { kind: "tool", n: "b" };
  const c = { items: [a, p, b], worn: { ring: { kind: "jewel", n: "Ring" } }, weapon: "Axe", armor: "Mail" };
  const rows = dropShelfItems(c);
  assert.deepStrictEqual(rows, [{ it: a, i: 0 }, { it: b, i: 2 }]);
  assert.equal(rows[0].it, a); // same reference, not a clone
  assert.equal(rows[1].it, b);
});

test("dropShelfItems: scrolls are also excluded (quick 260918-vvt)", () => {
  const a = { kind: "jewel", n: "a" };
  const s = { kind: "scroll", n: "s" };
  const b = { kind: "tool", n: "b" };
  const c = { items: [a, s, b] };
  const rows = dropShelfItems(c);
  assert.deepStrictEqual(rows, [{ it: a, i: 0 }, { it: b, i: 2 }]);
});

test("dropShelfItems: an empty/absent bag returns []", () => {
  assert.deepStrictEqual(dropShelfItems({ items: [], worn: { ring: {} }, weapon: "Axe", armor: "Mail" }), []);
  assert.deepStrictEqual(dropShelfItems({}), []);
  assert.deepStrictEqual(dropShelfItems(null), []);
});

test("dropShelfItems: never mutates c or its items", () => {
  const a = { kind: "jewel", n: "a" };
  const c = { items: [a] };
  const before = JSON.stringify(c);
  dropShelfItems(c);
  assert.equal(JSON.stringify(c), before);
});

test("dropShelfItems(c).length === slotItems(c).length across several shapes", () => {
  const shapes = [
    { items: [{ kind: "jewel", n: "a" }, { kind: "potion", n: "p" }, { kind: "tool", n: "b" }] },
    { items: [] },
    { items: [{ kind: "potion", n: "p1" }, { kind: "potion", n: "p2" }] },
    { items: [{ kind: "jewel", n: "a" }, { kind: "scroll", n: "s" }, { kind: "tool", n: "b" }] },
    {},
    null,
  ];
  for (const c of shapes) {
    assert.equal(dropShelfItems(c).length, slotItems(c).length, JSON.stringify(c));
  }
});

// ─── emptySlotRows ───────────────────────────────────────────────────────────

test("emptySlotRows: a fresh Fighter with nothing worn and no armor gets all four rows (armor + jewelry1 + jewelry2 + cloak — 260918-wy1)", () => {
  const c = fixedChar({ armor: "Nothing", ar: 0, armorWP: 0, armorMax: 0 });
  const rows = emptySlotRows(c);
  assert.deepStrictEqual(
    rows.map((r) => r.slot),
    ["armor", "jewelry1", "jewelry2", "cloak"],
  );
  assert.equal(rows[0].text, GEAR_COPY.empty.armor);
  assert.equal(rows[rows.length - 1].text, GEAR_COPY.empty.cloak);
});

test("emptySlotRows: worn armor removes the armor row; a worn jewelry1 leaves jewelry2 + cloak (260918-wy1)", () => {
  const c = fixedChar({ worn: { jewelry1: { kind: "jewel", n: "Ring" } } });
  const rows = emptySlotRows(c);
  assert.deepStrictEqual(
    rows.map((r) => r.slot),
    ["jewelry2", "cloak"],
  );
  assert.equal(rows[0].slot, "jewelry2");
  assert.equal(rows[rows.length - 1].slot, "cloak");
});

test("emptySlotRows: a fully-slotted Magic User (both jewelry keys + cloak worn) yields no worn-slot rows — a staff is never one of them", () => {
  const c = fixedChar({ cls: "Magic User", worn: { jewelry1: {}, jewelry2: {}, cloak: {} } });
  const rows = emptySlotRows(c);
  assert.deepStrictEqual(rows, []);
});

test("emptySlotRows: the Cloak of Armor's magic plate counts as worn (no armor row) even with c.armor unset — worn AND used (260918-w4n)", () => {
  const c = fixedChar({
    armor: "Nothing", ar: 0, armorWP: 0, armorMax: 0,
    worn: { cloak: { kind: "cloak", n: "Cloak of Armor", eff: { cloakArmor: 4 } } },
    timers: { "item:Cloak of Armor": { cadence: "squares", left: 50, cd: 50, phase: "effect" } },
  });
  const rows = emptySlotRows(c);
  assert.ok(!rows.some((r) => r.slot === "armor"));
});

test("emptySlotRows: a legacy c with no worn map yields all three worn-key rows (plus armor if unworn)", () => {
  const c = { cls: "Fighter", weapon: "Axe", armor: "Nothing", ar: 0, armorWP: 0, armorMax: 0, items: [] };
  const rows = emptySlotRows(c);
  assert.deepStrictEqual(
    rows.map((r) => r.slot),
    ["armor", "jewelry1", "jewelry2", "cloak"],
  );
});

test("emptySlotRows: a fully-equipped Magic User (armor worn, both jewelry keys + cloak filled, staff bagged) returns []", () => {
  const c = fixedChar({
    cls: "Magic User",
    worn: {
      jewelry1: { kind: "jewel", n: "Ring" },
      jewelry2: { kind: "jewel", n: "Bracelet" },
      cloak: { kind: "cloak", n: "Cloak" },
    },
    items: [{ kind: "staff", n: "Staff" }],
  });
  assert.deepStrictEqual(emptySlotRows(c), []);
});

test("emptySlotRows: a bare-fisted character gets the weapon row first (Fists/empty/undefined/not-a-weapon-name); a real weapon gets none", () => {
  for (const weapon of ["Fists", "", undefined, "NotAWeapon"]) {
    const c = fixedChar({ weapon, armor: "Nothing", ar: 0, armorWP: 0, armorMax: 0 });
    const rows = emptySlotRows(c);
    assert.equal(rows[0].slot, "weapon");
    assert.equal(rows[0].text, GEAR_COPY.empty.weapon);
  }
  const c = fixedChar({ weapon: "Axe" });
  assert.ok(!emptySlotRows(c).some((r) => r.slot === "weapon"));
});

test("emptySlotRows: pure — never mutates c, never throws on a sparse c", () => {
  const c = fixedChar({ worn: { jewelry1: {} } });
  const before = JSON.stringify(c);
  assert.doesNotThrow(() => emptySlotRows(c));
  assert.equal(JSON.stringify(c), before);
  assert.doesNotThrow(() => emptySlotRows(null));
  assert.doesNotThrow(() => emptySlotRows({}));
});
