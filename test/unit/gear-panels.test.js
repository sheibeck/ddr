// test/unit/gear-panels.test.js
//
// Phase 43 (CLAR-04): pins for src/browser/viewModels.js#dropShelfItems /
// #emptySlotRows / GEAR_COPY — the bag-full drop prompt's bag-only source
// list (with the true c.items index, in lock-step with engine/derived.js
// #slotItems), and the ON YOU panel's in-voice empty-slot rows.

import test from "node:test";
import assert from "node:assert/strict";

import { dropShelfItems, emptySlotRows, GEAR_COPY } from "../../src/browser/viewModels.js";
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

test("GEAR_COPY carries the exact frozen literal shape (260918-w4n: no staff leaves — a staff is a bag item)", () => {
  assert.deepEqual(GEAR_COPY, {
    onYou: "ON YOU",
    wielded: "WIELDED",
    worn: "WORN",
    alsoOnYou: "ALSO ON YOU",
    bag: "BAG",
    freeRide: "potions & scrolls ride free",
    empty: {
      armor: "armor — nothing. The wind is your armor, and the wind is not on your side.",
      ring: "ring — nothing. Ten fingers, zero commitments.",
      bracelet: "bracelet — nothing. A bare wrist, ready for bad decisions.",
      amulet: "amulet — nothing. Your neck has never been less interesting.",
      helm: "helm — nothing. Hair, technically, counts for zero.",
      cloak: "cloak — nothing. Cold and unmagical, in that order.",
    },
  });
  assert.ok(Object.isFrozen(GEAR_COPY));
  assert.ok(Object.isFrozen(GEAR_COPY.empty));
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

test("emptySlotRows: a fresh Fighter with nothing worn and no armor gets all six rows (260918-w4n: no staff row)", () => {
  const c = fixedChar({ armor: "Nothing", ar: 0, armorWP: 0, armorMax: 0 });
  const rows = emptySlotRows(c);
  assert.deepStrictEqual(
    rows.map((r) => r.slot),
    ["armor", "ring", "bracelet", "amulet", "helm", "cloak"],
  );
  assert.equal(rows[0].text, GEAR_COPY.empty.armor);
  assert.equal(rows[rows.length - 1].text, GEAR_COPY.empty.cloak);
});

test("emptySlotRows: worn armor removes the armor row; worn slots are skipped in order (no staff row)", () => {
  const c = fixedChar({ worn: { ring: { kind: "jewel", n: "Ring" } } });
  const rows = emptySlotRows(c);
  assert.deepStrictEqual(
    rows.map((r) => r.slot),
    ["bracelet", "amulet", "helm", "cloak"],
  );
  assert.equal(rows[0].slot, "bracelet");
  assert.equal(rows[rows.length - 1].slot, "cloak");
});

test("emptySlotRows: a fully-slotted Magic User (all five worn) yields no worn-slot rows — a staff is never one of them", () => {
  const c = fixedChar({ cls: "Magic User", worn: { ring: {}, bracelet: {}, amulet: {}, helm: {}, cloak: {} } });
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

test("emptySlotRows: a legacy c with no worn map yields all five worn-slot rows (plus armor if unworn)", () => {
  const c = { cls: "Fighter", weapon: "Axe", armor: "Nothing", ar: 0, armorWP: 0, armorMax: 0, items: [] };
  const rows = emptySlotRows(c);
  assert.deepStrictEqual(
    rows.map((r) => r.slot),
    ["armor", "ring", "bracelet", "amulet", "helm", "cloak"],
  );
});

test("emptySlotRows: a fully-equipped Magic User (armor worn, six slots filled) returns []", () => {
  const c = fixedChar({
    cls: "Magic User",
    worn: {
      ring: { kind: "jewel", n: "Ring" },
      bracelet: { kind: "jewel", n: "Bracelet" },
      amulet: { kind: "jewel", n: "Amulet" },
      helm: { kind: "jewel", n: "Helm" },
      cloak: { kind: "cloak", n: "Cloak" },
      staff: { kind: "staff", n: "Staff" },
    },
  });
  assert.deepStrictEqual(emptySlotRows(c), []);
});

test("emptySlotRows: pure — never mutates c, never throws on a sparse c", () => {
  const c = fixedChar({ worn: { ring: {} } });
  const before = JSON.stringify(c);
  assert.doesNotThrow(() => emptySlotRows(c));
  assert.equal(JSON.stringify(c), before);
  assert.doesNotThrow(() => emptySlotRows(null));
  assert.doesNotThrow(() => emptySlotRows({}));
});
