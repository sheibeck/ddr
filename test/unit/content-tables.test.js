// test/unit/content-tables.test.js
//
// Locks the extracted content/*.js tables to the prototype's exact values
// (ENG-03 complement to the pure-data purity guard) — spot-checks known
// rows/counts and confirms the barrel index exposes everything downstream
// consumers need.

import test from "node:test";
import assert from "node:assert/strict";
import {
  WEAPONS, CLASSES, RACES, RACE_D8, ARMORS, BESTIARY, ENC_TYPES, SPELLS,
  POTIONS, TRAPS, EPITAPHS, CAUSE_TEXT,
} from "../../content/index.js";

test("content/index.js exposes WEAPONS/CLASSES/RACES/BESTIARY/SPELLS", () => {
  assert.ok(WEAPONS && typeof WEAPONS === "object");
  assert.ok(CLASSES && typeof CLASSES === "object");
  assert.ok(RACES && typeof RACES === "object");
  assert.ok(BESTIARY && typeof BESTIARY === "object");
  assert.ok(Array.isArray(SPELLS));
});

test("ARMORS: 5 rows, Plate costs 2000", () => {
  assert.equal(ARMORS.length, 5);
  const plate = ARMORS.find((a) => a.name === "Plate");
  assert.ok(plate, "Plate armor row must exist");
  assert.equal(plate.cost, 2000);
});

test("RACE_D8: 6 distinct races, Human appears 3 times", () => {
  const distinct = new Set(RACE_D8);
  assert.equal(distinct.size, 6);
  const humanCount = RACE_D8.filter((r) => r === "Human").length;
  assert.equal(humanCount, 3);
});

test("SPELLS: 32 entries (the prototype's actual count)", () => {
  assert.equal(SPELLS.length, 32);
});

test("ENC_TYPES: 6 entries", () => {
  assert.equal(ENC_TYPES.length, 6);
});

test("POTIONS: 10 entries", () => {
  assert.equal(POTIONS.length, 10);
});

test("EPITAPHS.combat is a non-empty array of strings", () => {
  assert.ok(Array.isArray(EPITAPHS.combat));
  assert.ok(EPITAPHS.combat.length > 0);
  for (const line of EPITAPHS.combat) {
    assert.equal(typeof line, "string");
  }
});

test("CAUSE_TEXT templates are strings, not functions", () => {
  for (const [cause, template] of Object.entries(CAUSE_TEXT)) {
    assert.equal(typeof template, "string", `CAUSE_TEXT.${cause} must be a string`);
  }
  assert.equal(CAUSE_TEXT.combat, "cut down by a {foe}");
});

test("WEAPONS: Axe/Bastard Sword/Dagger dice-notation matches the prototype's rolls", () => {
  assert.deepStrictEqual(WEAPONS["Axe"].dice, { n: 1, sides: 6, bonus: 0 });
  assert.deepStrictEqual(WEAPONS["Bastard Sword"].dice, { n: 2, sides: 6, bonus: 0 });
  assert.deepStrictEqual(WEAPONS["Dagger"].dice, { n: 1, sides: 6, bonus: 0 });
  assert.equal(WEAPONS["Dagger"].halve, true);
});

test("CLASSES.Fighter: baseWP is 50 + d8, gain[1] is d8 notation", () => {
  assert.deepStrictEqual(CLASSES["Fighter"].baseWP, { base: 50, dice: { n: 1, sides: 8, bonus: 0 } });
  assert.deepStrictEqual(CLASSES["Fighter"].gain[1], { n: 1, sides: 8, bonus: 0 });
});

test("BESTIARY: Bat/Rat sp.dmg is a flat 1, atk 2; Drake dmg is 2d10+4", () => {
  const batRat = BESTIARY["Beasts"][0][0];
  assert.equal(batRat.n, "Bat/Rat");
  assert.deepStrictEqual(batRat.sp.dmg, { n: 0, sides: 0, bonus: 1 });
  assert.equal(batRat.sp.atk, 2);

  const drake = BESTIARY["Beasts"][3][0];
  assert.equal(drake.n, "Drake");
  assert.deepStrictEqual(drake.sp.dmg, { n: 2, sides: 10, bonus: 4 });
});

test("TRAPS: Spike carries base d10 notation with a times:5 flag", () => {
  const spike = TRAPS.find((t) => t.n === "Spike");
  assert.ok(spike);
  assert.deepStrictEqual(spike.dmg, { n: 1, sides: 10, bonus: 0 });
  assert.equal(spike.times, 5);
});

test("SPELLS: Fireball is 2d10+4, Mangle is 2d20+15", () => {
  const fireball = SPELLS.find((sp) => sp.n === "Fireball");
  const mangle = SPELLS.find((sp) => sp.n === "Mangle");
  assert.deepStrictEqual(fireball.dmg, { n: 2, sides: 10, bonus: 4 });
  assert.deepStrictEqual(mangle.dmg, { n: 2, sides: 20, bonus: 15 });
});
