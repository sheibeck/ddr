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
  POTIONS, TRAPS, EPITAPHS, CAUSE_TEXT, DAMAGE_MULTIPLIERS, FOE_ABILITIES,
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

// Phase 40 (SPELL-01/05): the table grew to 33 rows — 32 canon rows plus
// the new Lesser Summon (row 32).
test("SPELLS: 33 entries (Phase 40 — the canon 32 plus Lesser Summon)", () => {
  assert.equal(SPELLS.length, 33);
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

// Phase 39 (GEAR-01, DELIBERATE RULES CHANGE): the weapon table was
// re-diced/re-priced to make room for the need/crit axes (39-01-PLAN.md) —
// Axe and Dagger's dice are unchanged from the prototype; Bastard Sword's
// dice moved from 2d6 to 2d8+1 (a genuine rebalance, not an extraction
// error). See content/weapons.js's header comment and
// test/parity/FIXTURE-INVENTORY.md's "Phase 39: gear axes" section for the
// full before/after ledger.
test("WEAPONS: Axe/Bastard Sword/Dagger dice-notation (Bastard Sword re-diced in Phase 39)", () => {
  assert.deepStrictEqual(WEAPONS["Axe"].dice, { n: 1, sides: 6, bonus: 0 });
  assert.deepStrictEqual(WEAPONS["Bastard Sword"].dice, { n: 2, sides: 8, bonus: 1 });
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

// Phase 40: Detect Magic -> Map the Floor (rename, still non-combat) and
// Lesser Summon (new row, combatOnly: false) join the list — 13 entries.
test("SPELLS: 13 non-combat (utility/self) castable outside an encounter", () => {
  const nonCombat = SPELLS.filter((sp) => !sp.combatOnly).map((sp) => sp.n).sort();
  assert.deepStrictEqual(nonCombat, [
    "Bubble", "Heal", "Lesser Summon", "Major Heal", "Map the Floor",
    "Mirror Self", "Phantom Host", "Regeneration", "Sense Danger",
    "Sense Presence", "Shield", "Strength", "Summon",
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
// named carve-out — which Phase 18 forbids (D-14). Phase 27 (TUNE-06)
// supersedes this for Dante specifically: Dante is now tier 2 (still
// byte-identical wherever it sits — see the assertion below), and Ned is
// the new tier-1 Humans exposed row.
test("BESTIARY Phase 18 / D-14 (BEST-03, FID-05): the four fixture-exposed rows are byte-identical to the prototype (Dante now tier 2, Ned is the exposed tier-1 row)", () => {
  assert.deepStrictEqual(BESTIARY["Beasts"][0], [
    { n: "Bat/Rat", sz: "T", i: 1, wp: 1, sp: { atk: 2, dmg: { n: 0, sides: 0, bonus: 1 }, note: "two attacks, 1 wp each" } },
    { n: "Shriek", sz: "T", i: 1, wp: 3, sp: { shriek: true, note: "a scream deafens; half damage after" } },
    { n: "Viper", sz: "S", i: 1, wp: 3, sp: { poison: true, note: "venom: 2 wp a round for d10 rounds" } },
  ]);
  // Phase 27 (2026-09-15, TUNE-06): was BESTIARY["Humans"][0] === [Dante] —
  // Dante moved to tier 2, Ned is the tier-1 Humans row (re-measured live).
  assert.deepStrictEqual(BESTIARY["Humans"][0], [
    { n: "Ned", sz: "H", i: 8, wp: 8, sp: { note: "a bandit: one knife, one grudge, no plan" } },
  ]);
  // Dante stays recognisably Dante deeper: byte-identical stats/note as the
  // LAST entry of Humans tier 2.
  assert.deepStrictEqual(BESTIARY["Humans"][1].at(-1), {
    n: "Dante", sz: "H", i: 12, wp: 20, sp: { atk: 3, note: "twins, four arms: three strikes a round" },
  });
});

test("BESTIARY Phase 18 / D-17: no creature added, removed, or reordered — tier lengths per type", () => {
  assert.deepStrictEqual(Object.keys(BESTIARY), ["Beasts", "Demons", "Humans", "Lair Beasts", "Magical", "Walking Dead"]);
  // Phase 27 (2026-09-15, TUNE-06): Humans tier lengths were [1, 2, 2, 2, 1]
  // — Dante moved from tier 1 to the end of tier 2, so tier 1 shrinks to 1
  // (Ned) and tier 2 grows to 3 (China Wolf, Krupke, Dante).
  assert.deepStrictEqual(
    Object.values(BESTIARY).map((tiers) => tiers.map((t) => t.length)),
    [[3, 2, 5, 2, 2], [1, 1, 1, 3, 1], [1, 3, 2, 2, 1], [5, 2, 1, 1, 1], [1, 1, 1, 1, 1], [1, 2, 2, 3, 1]],
  );
  // Phase 27 (2026-09-15, TUNE-06): was 53 — Ned added, Dante count unchanged (moved, not removed).
  assert.equal(Object.values(BESTIARY).flat(2).length, 54);
});

test("BESTIARY Phase 18/19 / D-17: every entry keeps the flat shape — allowed top-level keys n/sz/i/wp/sp/abilities only, and sp.dmg where present is {n,sides,bonus}", () => {
  // Phase 19 (FOE-01/D-17 extension): the allowlist gains exactly one key,
  // `abilities` — a non-empty array of unique string ids, each resolving to a
  // real FOE_ABILITIES entry (never an empty array; absence is the gate).
  const allowedTopKeys = new Set(["n", "sz", "i", "wp", "sp", "abilities"]);
  const abilityIds = new Set(FOE_ABILITIES.map((a) => a.id));
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
    if (Object.hasOwn(row, "abilities")) {
      assert.ok(Array.isArray(row.abilities) && row.abilities.length > 0, `${row.n} abilities must be a non-empty array`);
      assert.equal(new Set(row.abilities).size, row.abilities.length, `${row.n} abilities must have no duplicate ids`);
      for (const id of row.abilities) {
        assert.ok(abilityIds.has(id), `${row.n} abilities id "${id}" must resolve to a FOE_ABILITIES entry`);
      }
    }
  }
});

// --- Phase 19: foe-ability registry + kits (FOE-01/FOE-05/FOE-06/CANON-02) ---

test("FOE_ABILITIES: 19 descriptors, unique ids, valid kinds, valid shapes", () => {
  assert.equal(FOE_ABILITIES.length, 19);
  const ids = FOE_ABILITIES.map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length, "every FOE_ABILITIES id must be unique");
  const VALID_KINDS = new Set(["bolt", "drain", "debuff", "heal", "summon"]);
  for (const a of FOE_ABILITIES) {
    assert.ok(VALID_KINDS.has(a.kind), `${a.id} has invalid kind ${a.kind}`);
    if (a.kind === "bolt" || a.kind === "drain" || a.kind === "heal") {
      assert.ok(a.dmg && typeof a.dmg === "object", `${a.id} (${a.kind}) must carry dmg`);
      assert.ok(Number.isInteger(a.dmg.n), `${a.id}.dmg.n must be an integer`);
      assert.ok(Number.isInteger(a.dmg.sides), `${a.id}.dmg.sides must be an integer`);
      assert.ok(Number.isInteger(a.dmg.bonus), `${a.id}.dmg.bonus must be an integer`);
    }
    if (a.kind === "debuff") {
      assert.ok(["weakened", "dazed"].includes(a.effect), `${a.id} debuff effect must be weakened or dazed`);
    }
    if (a.kind === "summon") {
      assert.equal(a.effect.type, "Walking Dead");
      assert.equal(a.effect.tier, 2);
      assert.ok(Array.isArray(BESTIARY["Walking Dead"][1]) && BESTIARY["Walking Dead"][1].length > 0, "Walking Dead tier 2 roster must be non-empty");
    }
    if (Object.hasOwn(a, "every")) assert.ok(Number.isInteger(a.every) && a.every > 0, `${a.id}.every must be a positive integer`);
    if (Object.hasOwn(a, "uses")) assert.ok(Number.isInteger(a.uses) && a.uses > 0, `${a.id}.uses must be a positive integer`);
    assert.equal(typeof a.txt, "string");
    assert.ok(a.txt.length > 0 && a.txt.endsWith("."), `${a.id}.txt must be a non-empty sentence ending in a period`);
  }
});

test("BESTIARY Phase 19 / D-03: exact kits per caster row", () => {
  const krupke = BESTIARY["Humans"][1][1];
  const drudgeT4 = BESTIARY["Magical"][3][0];
  const drudgeT5 = BESTIARY["Magical"][4][0];
  const djinniT4 = BESTIARY["Demons"][3][0];
  const djinniT5 = BESTIARY["Demons"][4][0];
  const vampire = BESTIARY["Walking Dead"][4][0];
  const stalka = BESTIARY["Beasts"][4][1];
  const drake = BESTIARY["Beasts"][3][0];

  assert.deepStrictEqual(krupke.abilities, ["krupkeWeaken", "krupkeFreeze"]);
  assert.deepStrictEqual(drudgeT4.abilities, ["drudgeLightning", "drudgeFireball", "drudgeWeaken", "drudgeFreeze"]);
  assert.deepStrictEqual(drudgeT5.abilities, ["drudgeLightning", "drudgeFireball", "drudgeWeaken", "drudgeFreeze"]);
  assert.deepStrictEqual(djinniT4.abilities, ["djinniFireball", "djinniDaze", "djinniLightning", "djinniFreeze"]);
  assert.deepStrictEqual(djinniT5.abilities, ["djinniFireball", "djinniDaze", "djinniLightning", "djinniFreeze"]);
  assert.deepStrictEqual(vampire.abilities, ["vampireSummon", "vampireFireball", "vampireLightning", "vampireDrain"]);
  assert.deepStrictEqual(stalka.abilities, ["stalkaHeal", "stalkaLightning", "stalkaFireball", "stalkaFreeze"]);
  assert.deepStrictEqual(drake.abilities, ["drakeBreath"]);
});

test("BESTIARY Phase 19 / D-01: abilities is ABSENT (not empty) on every non-caster row — 46 of 54", () => {
  const rows = Object.values(BESTIARY).flat(2);
  // Phase 27 (2026-09-15, TUNE-06): was 53 — Ned added (no abilities kit).
  assert.equal(rows.length, 54);
  const withAbilities = rows.filter((row) => Object.hasOwn(row, "abilities"));
  assert.equal(withAbilities.length, 8);
  const withoutAbilities = rows.filter((row) => !Object.hasOwn(row, "abilities"));
  // Phase 27 (2026-09-15, TUNE-06): was 45 — Ned added, no abilities kit.
  assert.equal(withoutAbilities.length, 46);
  for (const row of rows) {
    if (Object.hasOwn(row, "abilities")) continue;
    assert.equal(row.abilities, undefined, `${row.n} must not have an abilities key at all`);
  }
  const spectre = BESTIARY["Demons"][3][2];
  const ghost = BESTIARY["Demons"][3][1];
  const werebeast = BESTIARY["Magical"][2][0];
  const dreadLock = BESTIARY["Beasts"][4][0];
  assert.equal(spectre.n, "Spectre");
  assert.equal(ghost.n, "Ghost");
  assert.equal(werebeast.n, "Werebeast");
  assert.equal(dreadLock.n, "Dread Lock");
  for (const row of [spectre, ghost, werebeast, dreadLock]) {
    assert.equal(Object.hasOwn(row, "abilities"), false, `${row.n} must not have an abilities key`);
  }
});

// Any diff here means a fixture-exposed creature moved and BEST-03 requires a
// named carve-out — which this plan forbids (no fixture-exposed row touched).
test("BESTIARY Phase 19 / D-14: the four fixture-exposed rows are still byte-identical (Dante now tier 2, Ned is the exposed tier-1 row)", () => {
  assert.deepStrictEqual(BESTIARY["Beasts"][0], [
    { n: "Bat/Rat", sz: "T", i: 1, wp: 1, sp: { atk: 2, dmg: { n: 0, sides: 0, bonus: 1 }, note: "two attacks, 1 wp each" } },
    { n: "Shriek", sz: "T", i: 1, wp: 3, sp: { shriek: true, note: "a scream deafens; half damage after" } },
    { n: "Viper", sz: "S", i: 1, wp: 3, sp: { poison: true, note: "venom: 2 wp a round for d10 rounds" } },
  ]);
  // Phase 27 (2026-09-15, TUNE-06): was BESTIARY["Humans"][0] === [Dante].
  assert.deepStrictEqual(BESTIARY["Humans"][0], [
    { n: "Ned", sz: "H", i: 8, wp: 8, sp: { note: "a bandit: one knife, one grudge, no plan" } },
  ]);
});

test("BESTIARY Phase 19 / D-03: Djinni x2 carry sp.fleesBelow 0.25 and no other row does", () => {
  const djinniT4 = BESTIARY["Demons"][3][0];
  const djinniT5 = BESTIARY["Demons"][4][0];
  assert.equal(djinniT4.n, "Djinni");
  assert.equal(djinniT5.n, "Djinni");
  assert.equal(djinniT4.sp.fleesBelow, 0.25);
  assert.equal(djinniT5.sp.fleesBelow, 0.25);
  const rows = Object.values(BESTIARY).flat(2);
  const withFleesBelow = rows.filter((row) => row.sp && Object.hasOwn(row.sp, "fleesBelow"));
  assert.equal(withFleesBelow.length, 2);
});

test("FOE_ABILITIES Phase 19 / D-03 cap: every bolt/drain referenced at tier t has expected damage <= 0.5 * HERO_HP[t]", () => {
  // Mirrors tools/bestiary-yardstick.mjs's HERO_HP table (composite hero
  // expected WP per tier, 18-RESEARCH.md "Hero-side formulas").
  const HERO_HP = [41.7, 46.2, 50.0, 54.5, 60.0];
  const byId = Object.fromEntries(FOE_ABILITIES.map((a) => [a.id, a]));
  let maxExpected = 0;
  for (const [, tiers] of Object.entries(BESTIARY)) {
    tiers.forEach((tier, t) => {
      for (const row of tier) {
        if (!Object.hasOwn(row, "abilities")) continue;
        for (const id of row.abilities) {
          const ability = byId[id];
          if (ability.kind !== "bolt" && ability.kind !== "drain") continue;
          const { n, sides, bonus } = ability.dmg;
          const expected = (n * (sides + 1)) / 2 + bonus;
          maxExpected = Math.max(maxExpected, expected);
          assert.ok(expected <= 0.5 * HERO_HP[t], `${row.n}'s ${id} expected damage ${expected} exceeds 50% of tier-${t} hero HP (${HERO_HP[t]})`);
          assert.notEqual(sides, 20, `${id} must not use Mangle-class d20 dice`);
        }
      }
    });
  }
  assert.equal(maxExpected, 15, "the registry's largest expected bolt/drain damage must be exactly 15 (2d10+4)");
});

test("CANON-02 Phase 19 / D-08: Drake breath descriptor every 4; Drake sp.dmg/sp.every unchanged; Drudge never_melee; Spectre pursues and has no abilities", () => {
  const drakeBreath = FOE_ABILITIES.find((a) => a.id === "drakeBreath");
  assert.equal(drakeBreath.every, 4);
  assert.deepStrictEqual(drakeBreath.dmg, { n: 2, sides: 10, bonus: 4 });

  const drake = BESTIARY["Beasts"][3][0];
  assert.equal(drake.sp.every, 4);
  assert.deepStrictEqual(drake.sp.dmg, { n: 2, sides: 10, bonus: 4 });

  const drudgeT4 = BESTIARY["Magical"][3][0];
  const drudgeT5 = BESTIARY["Magical"][4][0];
  assert.equal(drudgeT4.sp.never_melee, true);
  assert.equal(drudgeT5.sp.never_melee, true);

  const spectre = BESTIARY["Demons"][3][2];
  assert.equal(spectre.n, "Spectre");
  assert.equal(spectre.sp.pursues, true);
  assert.equal(Object.hasOwn(spectre, "abilities"), false);
});

// D-06 "planner discretion resolved" note: a kit with a single, unbounded
// weak bolt (Krupke's krupkeFreeze, 1d6, E[dmg]=3.5 — the dice-budget table's
// own "—" bound) is not a spam risk and is excluded; this invariant targets
// kits shaped with a bounded primary bolt PLUS an unbounded weak fallback
// (Drudge/Djinni/Vampire/Stalka/Drake), where the STRONG bolt must be capped.
test("FOE-06 Phase 19: the strongest bolt in every multi-bolt kit is bounded (every >= 2 or uses)", () => {
  const byId = Object.fromEntries(FOE_ABILITIES.map((a) => [a.id, a]));
  const rows = Object.values(BESTIARY).flat(2).filter((row) => Object.hasOwn(row, "abilities"));
  for (const row of rows) {
    const bolts = row.abilities.map((id) => byId[id]).filter((a) => a.kind === "bolt");
    if (bolts.length < 2) continue;
    const expectedOf = (a) => (a.dmg.n * (a.dmg.sides + 1)) / 2 + a.dmg.bonus;
    const strongest = bolts.reduce((best, a) => (expectedOf(a) > expectedOf(best) ? a : best), bolts[0]);
    const bounded = (Object.hasOwn(strongest, "every") && strongest.every >= 2) || Object.hasOwn(strongest, "uses");
    assert.ok(bounded, `${row.n}'s strongest bolt ${strongest.id} must be bounded (every >= 2 or uses)`);
  }
});
