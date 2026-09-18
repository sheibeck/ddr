// test/unit/gear-axes.test.js
//
// Phase 39 (GEAR-01, 39-01-PLAN.md) — the gear-axes contract suite. Task 1
// pins the eight content-table behaviours (weapon need/crit, armor bulk, the
// pinned key order/cls strings, WEAPON_MAX consistency, store band role
// coverage, KIT weapon existence, and the Magic User cost ceiling). Task 2
// appends the engine-read behaviours (classNeed/weaponNeedMod/weaponCrit/
// armorBulk/expectedStrike/toHit/crit/Stealth-bulk/flee-bulk/climb-leap-bulk/
// weaponUpgradeDelta/lootCompare) directly below this section.

import test from "node:test";
import assert from "node:assert/strict";

import { WEAPONS, WEAPON_MAX, ARMORS, CLASSES, KIT } from "../../content/index.js";
import { storeWeaponPool } from "../../engine/economy.js";

const CLASS_LETTER = { "Fighter": "F", "Thief": "T", "Magic User": "M" };

// --- Task 1: content-table axes -------------------------------------------

test("Test 1: WEAPONS key order and cls strings are pinned byte-for-byte", () => {
  const expectedOrder = [
    "Axe", "Bastard Sword", "Battle Axe", "Broadsword", "Claymore", "Dagger", "Katana",
    "Kopesh Sword", "Long Sword", "Ninja-to", "Rapier", "Short Sword", "Wakazashi", "Club",
    "Flail", "Mace", "Morning Star", "Quarter Staff", "Spiked Staff", "Whip", "Awl Pike",
    "Bardiche", "Naganita", "Spear",
  ];
  assert.deepStrictEqual(Object.keys(WEAPONS), expectedOrder);

  const expectedCls = {
    "Axe": "FTM", "Bastard Sword": "F", "Battle Axe": "F", "Broadsword": "F", "Claymore": "F",
    "Dagger": "FTM", "Katana": "FT", "Kopesh Sword": "F", "Long Sword": "FT", "Ninja-to": "FT",
    "Rapier": "FTM", "Short Sword": "FTM", "Wakazashi": "FT", "Club": "FTM", "Flail": "FT",
    "Mace": "FT", "Morning Star": "FT", "Quarter Staff": "FTM", "Spiked Staff": "FTM", "Whip": "FT",
    "Awl Pike": "FT", "Bardiche": "F", "Naganita": "F", "Spear": "FTM",
  };
  for (const [name, cls] of Object.entries(expectedCls)) {
    assert.equal(WEAPONS[name].cls, cls, `${name}.cls`);
  }
});

test("Test 2: every WEAPONS row carries need in {-2,-1,0,1} and crit in {1,2}; the precise-blade/Bardiche pins hold", () => {
  const preciseBlades = ["Rapier", "Katana", "Wakazashi", "Ninja-to", "Dagger"];
  let critTwoCount = 0;
  let needMinusTwoCount = 0;
  for (const [name, w] of Object.entries(WEAPONS)) {
    assert.ok(Number.isInteger(w.need) && [-2, -1, 0, 1].includes(w.need), `${name}.need`);
    assert.ok([1, 2].includes(w.crit), `${name}.crit`);
    if (w.crit === 2) critTwoCount++;
    if (w.need === -2) needMinusTwoCount++;
  }
  for (const name of preciseBlades) assert.equal(WEAPONS[name].crit, 2, `${name} must crit on 1-2`);
  assert.equal(critTwoCount, preciseBlades.length, "exactly the five precise blades crit on 1-2");
  assert.equal(needMinusTwoCount, 1, "exactly one weapon carries need: -2");
  assert.equal(WEAPONS["Bardiche"].need, -2);
  assert.equal(WEAPONS["Bardiche"].cls, "F");
});

test("Test 3: floor guarantee — no legal (class, weapon) pair yields a base need below 2", () => {
  for (const [clsName, letter] of Object.entries(CLASS_LETTER)) {
    for (const [wname, w] of Object.entries(WEAPONS)) {
      if (!w.cls.includes(letter)) continue;
      const base = CLASSES[clsName].toHit + w.need;
      assert.ok(base >= 2, `${clsName} with ${wname}: base need ${base} must be >= 2`);
    }
  }
});

test("Test 4: WEAPON_MAX matches the dice (halve -> ceil(max/2))", () => {
  for (const [name, w] of Object.entries(WEAPONS)) {
    const raw = w.dice.n * w.dice.sides + w.dice.bonus;
    const expected = w.halve ? Math.ceil(raw / 2) : raw;
    assert.equal(WEAPON_MAX[name], expected, `${name} WEAPON_MAX`);
  }
});

test("Test 5: every store band offers a heavy/neutral/light pick per class", () => {
  for (const letter of ["F", "T"]) {
    for (let tier = 0; tier < 4; tier++) {
      const pool = storeWeaponPool(letter, tier);
      const needs = pool.map((w) => WEAPONS[w].need);
      assert.ok(needs.some((n) => n < 0), `${letter} tier ${tier}: no heavy (need<0) pick`);
      assert.ok(needs.some((n) => n === 0), `${letter} tier ${tier}: no neutral (need 0) pick`);
      assert.ok(needs.some((n) => n > 0), `${letter} tier ${tier}: no light (need>0) pick`);
    }
  }
  for (const tier of [0, 1, 3]) {
    const pool = storeWeaponPool("M", tier);
    const needs = pool.map((w) => WEAPONS[w].need);
    assert.ok(needs.some((n) => n < 0), `M tier ${tier}: no heavy pick`);
    assert.ok(needs.some((n) => n === 0), `M tier ${tier}: no neutral pick`);
    assert.ok(needs.some((n) => n > 0), `M tier ${tier}: no light pick`);
  }
  const tier2 = storeWeaponPool("M", 2);
  const distinctNeeds = new Set(tier2.map((w) => WEAPONS[w].need));
  assert.ok(distinctNeeds.size >= 2, "M tier 2 must offer at least two distinct need values");
});

test("Test 6: every KIT starting weapon exists in WEAPONS", () => {
  for (const [sub, [weapon]] of Object.entries(KIT)) {
    assert.ok(Object.prototype.hasOwnProperty.call(WEAPONS, weapon), `KIT[${sub}][0] = "${weapon}" must be a WEAPONS key`);
  }
});

test("Test 7: ARMORS names/order/fields unchanged; bulk is 0,0,1,1,2", () => {
  const expected = [
    { name: "Cloth", cost: 300, wp: 12, ar: 3, cls: "FTM", min: 1, bulk: 0 },
    { name: "Leather", cost: 500, wp: 15, ar: 6, cls: "FT", min: 1, bulk: 0 },
    { name: "Studded", cost: 750, wp: 18, ar: 10, cls: "FT", min: 2, bulk: 1 },
    { name: "Mail", cost: 1000, wp: 30, ar: 12, cls: "F", min: 3, bulk: 1 },
    { name: "Plate", cost: 2000, wp: 45, ar: 15, cls: "F", min: 4, bulk: 2 },
  ];
  assert.equal(ARMORS.length, expected.length);
  for (let i = 0; i < expected.length; i++) {
    assert.deepStrictEqual(ARMORS[i], expected[i], `ARMORS[${i}]`);
  }
});

test("Test 8: every Magic User-legal weapon still costs <= 250 (keeps store-roll's M tier-3 fallback pin true)", () => {
  const legal = Object.keys(WEAPONS).filter((w) => WEAPONS[w].cls.includes("M"));
  for (const w of legal) assert.ok(WEAPONS[w].cost <= 250, `${w} (M-legal) must cost <= 250`);
});
