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
  POTIONS, TRAPS, EPITAPHS, CAUSE_TEXT, DAMAGE_MULTIPLIERS,
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

// Device-review Pass B1 item 3: "abandon" is a distinct, non-combat/hazard
// death cause for the voluntary "Abandon this character" action — sarcastic
// but family-friendly per the design brief.
test("EPITAPHS.abandon and CAUSE_TEXT.abandon are distinct from every combat/hazard cause", () => {
  assert.ok(Array.isArray(EPITAPHS.abandon));
  assert.ok(EPITAPHS.abandon.length > 0);
  for (const line of EPITAPHS.abandon) {
    assert.equal(typeof line, "string");
  }
  assert.equal(typeof CAUSE_TEXT.abandon, "string");
  assert.notEqual(CAUSE_TEXT.abandon, CAUSE_TEXT.combat);
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

// 04-DR10: every spell carries an explicit combatOnly boolean (Grimoire
// classification, engine/magic.js's own no-combat-context support).
test("SPELLS: every entry has a boolean combatOnly field", () => {
  for (const sp of SPELLS) {
    assert.equal(typeof sp.combatOnly, "boolean", `${sp.n} missing boolean combatOnly`);
  }
});

test("SPELLS: 12 non-combat (utility/self) castable outside an encounter", () => {
  const nonCombat = SPELLS.filter((sp) => !sp.combatOnly).map((sp) => sp.n).sort();
  assert.deepStrictEqual(nonCombat, [
    "Bubble", "Detect Magic", "Heal", "Major Heal", "Mirror Self",
    "Phantom Host", "Regeneration", "Sense Danger", "Sense Presence",
    "Shield", "Strength", "Summon",
  ]);
});

test("SPELLS: combat-only spells target a foe or an active encounter (Fireball, Death, Doze)", () => {
  const byName = Object.fromEntries(SPELLS.map((sp) => [sp.n, sp]));
  assert.equal(byName["Fireball"].combatOnly, true);
  assert.equal(byName["Death"].combatOnly, true);
  assert.equal(byName["Doze"].combatOnly, true);
});

// Phase 18 (CANON-04, D-11, D-13): the multiplier table is pinned verbatim so
// a silent edit — a new row, a changed factor, or widening the Trachea row
// to kind "ally" (which would violate D-20's hero-only scope) fails loudly.
test("DAMAGE_MULTIPLIERS (CANON-04, D-11): exactly the three canon rows, hero-only Trachea (D-20)", () => {
  assert.equal(DAMAGE_MULTIPLIERS.length, 3);
  assert.deepStrictEqual(DAMAGE_MULTIPLIERS, [
    { sourceKind: "spell", casterSub: "Cleric", casterClass: null, foeType: "Demons", foeName: null, mult: 2 },
    { sourceKind: "spell", casterSub: null, casterClass: null, foeType: "Walking Dead", foeName: null, mult: 2 },
    { sourceKind: "melee", casterSub: null, casterClass: "Fighter", foeType: null, foeName: "Trachea", mult: 2 },
  ]);
});

// --- Phase 18: bestiary rebalance pins (BEST-01/02/03, D-03/D-14/D-17/D-18/D-19) ---

test("BESTIARY Phase 18 / D-03: Djinni (Demons T4 and T5) -25% HP and a d4 melee step", () => {
  const djinniT4 = BESTIARY["Demons"][3][0];
  const djinniT5 = BESTIARY["Demons"][4][0];
  for (const djinni of [djinniT4, djinniT5]) {
    assert.equal(djinni.n, "Djinni");
    assert.equal(djinni.wp, 65);
    assert.deepStrictEqual(djinni.sp.dmg, { n: 1, sides: 4, bonus: 0 });
    assert.equal(djinni.sp.caster, true);
  }
});

test("BESTIARY Phase 18 / D-03: Krupke wp 17, d6+2", () => {
  const krupke = BESTIARY["Humans"][1][1];
  assert.equal(krupke.n, "Krupke");
  assert.equal(krupke.wp, 17);
  assert.deepStrictEqual(krupke.sp.dmg, { n: 1, sides: 6, bonus: 2 });
  assert.equal(krupke.sp.ar, 12);
});

test("BESTIARY Phase 18 / D-03: Drudge (Magical T4 and T5) wp 9, HP-only — no dmg field", () => {
  const drudgeT4 = BESTIARY["Magical"][3][0];
  const drudgeT5 = BESTIARY["Magical"][4][0];
  for (const drudge of [drudgeT4, drudgeT5]) {
    assert.equal(drudge.n, "Drudge");
    assert.equal(drudge.wp, 9);
    assert.equal(Object.hasOwn(drudge.sp, "dmg"), false);
    assert.equal(drudge.sp.never_melee, true);
  }
});

test("BESTIARY Phase 18 / D-03: Vampire wp 71 + d4; Stalka Beast wp 94 + d4; both keep atk 2", () => {
  const vampire = BESTIARY["Walking Dead"][4][0];
  const stalka = BESTIARY["Beasts"][4][1];
  assert.equal(vampire.n, "Vampire");
  assert.equal(vampire.wp, 71);
  assert.deepStrictEqual(vampire.sp.dmg, { n: 1, sides: 4, bonus: 0 });
  assert.equal(vampire.sp.atk, 2);
  assert.equal(stalka.n, "Stalka Beast");
  assert.equal(stalka.wp, 94);
  assert.deepStrictEqual(stalka.sp.dmg, { n: 1, sides: 4, bonus: 0 });
  assert.equal(stalka.sp.atk, 2);
});

test("BESTIARY Phase 18 / D-18: Drake wp 38 (was 135), dmg 2d10+4 and every:4 unchanged", () => {
  const drake = BESTIARY["Beasts"][3][0];
  assert.equal(drake.n, "Drake");
  assert.equal(drake.wp, 38);
  assert.deepStrictEqual(drake.sp.dmg, { n: 2, sides: 10, bonus: 4 });
  assert.equal(drake.sp.every, 4);
});

test("BESTIARY Phase 18 / D-18: Werebeast two attacks at d10 (bonus 5 -> 0), wp 32 unchanged, note matches the dice", () => {
  const werebeast = BESTIARY["Magical"][2][0];
  assert.equal(werebeast.n, "Werebeast");
  assert.equal(werebeast.wp, 32);
  assert.equal(werebeast.sp.atk, 2);
  assert.deepStrictEqual(werebeast.sp.dmg, { n: 1, sides: 10, bonus: 0 });
  assert.equal(werebeast.sp.note, "two attacks at d10");
});

test("BESTIARY Phase 18 / D-19: Sterling keeps wp 35 and halfDmg (TTK doubling recorded in BESTIARY-REBALANCE.md, revisit Phase 21)", () => {
  const sterling = BESTIARY["Beasts"][2][3];
  assert.equal(sterling.n, "Sterling");
  assert.equal(sterling.wp, 35);
  assert.equal(sterling.sp.halfDmg, true);
  assert.deepStrictEqual(sterling.sp.dmg, { n: 1, sides: 12, bonus: 0 });
});

// Any diff here means a fixture-exposed creature moved and BEST-03 requires a
// named carve-out — which Phase 18 forbids (D-14).
test("BESTIARY Phase 18 / D-14 (BEST-03, FID-05): the four fixture-exposed rows are byte-identical to the prototype", () => {
  assert.deepStrictEqual(BESTIARY["Beasts"][0], [
    { n: "Bat/Rat", sz: "T", i: 1, wp: 1, sp: { atk: 2, dmg: { n: 0, sides: 0, bonus: 1 }, note: "two attacks, 1 wp each" } },
    { n: "Shriek", sz: "T", i: 1, wp: 3, sp: { shriek: true, note: "a scream deafens; half damage after" } },
    { n: "Viper", sz: "S", i: 1, wp: 3, sp: { poison: true, note: "venom: 2 wp a round for d10 rounds" } },
  ]);
  assert.deepStrictEqual(BESTIARY["Humans"][0], [
    { n: "Dante", sz: "H", i: 12, wp: 20, sp: { atk: 3, note: "twins, four arms: three strikes a round" } },
  ]);
});

test("BESTIARY Phase 18 / D-17: no creature added, removed, or reordered — tier lengths per type", () => {
  assert.deepStrictEqual(Object.keys(BESTIARY), ["Beasts", "Demons", "Humans", "Lair Beasts", "Magical", "Walking Dead"]);
  assert.deepStrictEqual(
    Object.values(BESTIARY).map((tiers) => tiers.map((t) => t.length)),
    [[3, 2, 5, 2, 2], [1, 1, 1, 3, 1], [1, 2, 2, 2, 1], [5, 2, 1, 1, 1], [1, 1, 1, 1, 1], [1, 2, 2, 3, 1]],
  );
  assert.equal(Object.values(BESTIARY).flat(2).length, 53);
});

test("BESTIARY Phase 18 / D-17: every entry keeps the flat shape — allowed top-level keys n/sz/i/wp/sp only, and sp.dmg where present is {n,sides,bonus}", () => {
  const allowedTopKeys = new Set(["n", "sz", "i", "wp", "sp"]);
  for (const row of Object.values(BESTIARY).flat(2)) {
    for (const key of Object.keys(row)) {
      assert.ok(allowedTopKeys.has(key), `${row.n} has unexpected top-level key ${key}`);
    }
    assert.ok(Number.isInteger(row.wp) && row.wp > 0, `${row.n} must have a positive integer wp`);
    if (row.sp && Object.hasOwn(row.sp, "dmg")) {
      const { n, sides, bonus } = row.sp.dmg;
      assert.ok(Number.isInteger(n), `${row.n} sp.dmg.n must be an integer`);
      assert.ok(Number.isInteger(sides), `${row.n} sp.dmg.sides must be an integer`);
      assert.ok(Number.isInteger(bonus), `${row.n} sp.dmg.bonus must be an integer`);
    }
  }
});
