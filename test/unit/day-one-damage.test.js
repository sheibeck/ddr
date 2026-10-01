// test/unit/day-one-damage.test.js
//
// Phase 40 (SPELL-04), Plan 01, Task 2 — the day-one damage guarantee:
// every Magic User sub-class holds a castable, damage-dealing spell on day
// one (proven over every sub x 200 seeds), and the ZERO-DRAW guarantee: the
// derived-row path consumes no additional main-rng draws.
//
// Phase 90 plan 06 (SPELL-12, user 2026-09-30): Lesser Summon (the Phase 40
// stand-in that carried the Summoner's day-one damage) is REMOVED. The
// Summoner is deterministically granted Summon, castable at level 1 through
// the named exception SPELL_LEVEL_OVERRIDES.Summoner.Summon; a summon never
// counts as damage, so the Summoner's day-one damage spell comes from the
// same top-up every other sub-class's does.
//
// Phase 91 plan 02 (IDENT-15, user 2026-09-30): the Cleric never learns the
// offense school, so it holds NO damage spell by ruling; the day-one damage
// sweeps below skip it by name (a test-side exclusion only, no Cleric check in
// the engine) and assert it holds none. IDENT-13: the Wizard's own guarantee is
// pinned across 1,000 seeds in test/unit/wizard-day-one.test.js.

import test from "node:test";
import assert from "node:assert/strict";

import { makeRng } from "../../engine/rng.js";
import { rollGrimoire } from "../../engine/character.js";
import { newRun } from "../../engine/engine.js";
import { SPELLS, CLASSES, SPELL_LEVEL_OVERRIDES } from "../../content/index.js";
import { canCast, dealsDamage, DAMAGE_SPELL_KINDS } from "../../engine/derived.js";
import { maxCharges } from "../../engine/movement.js";

const MU_SUBS = CLASSES["Magic User"].subs;
const SEED_COUNT = 200;
const SEEDS = Array.from({ length: SEED_COUNT }, (_, i) => i * 7919 + 1);
const byName = (n) => SPELLS.find((sp) => sp.n === n);

// countingRng, copied verbatim from test/unit/chargen-rng-pin.test.js /
// test/unit/guaranteed-attack-spell.test.js — counts every draw-producing
// call; getState/setState pass through unmetered.
function countingRng(inner) {
  let draws = 0;
  const wrapped = {
    d(n) {
      draws++;
      return inner.d(n);
    },
    pick(a) {
      draws++;
      return inner.pick(a);
    },
    shuffle(a) {
      draws += Math.max(0, a.length - 1);
      return inner.shuffle(a);
    },
    get draws() {
      return draws;
    },
  };
  if (typeof inner.next === "function") {
    wrapped.next = () => {
      draws++;
      return inner.next();
    };
  }
  if (typeof inner.getState === "function") wrapped.getState = inner.getState;
  if (typeof inner.setState === "function") wrapped.setState = inner.setState;
  return wrapped;
}

// Restated from test/unit/chargen-rng-pin.test.js so this file is
// self-contained (mirrors test/unit/guaranteed-attack-spell.test.js).
//
// RULES-03 (Phase 75, user 2026-09-25): Summoner re-measured live, 31 -> 36
// — see test/unit/chargen-rng-pin.test.js's own comment on this constant
// for the full cause (the offense gate's removal widens the day-one `spare`
// pool). Phase 90 plan 06 (SPELL-12): Wizard 39 -> 36, Illusionist 34 -> 33,
// Apprentice 38 -> 37, measured live (Phantom Host removed; the Wizard lost
// the Illusion school) — same declaration as that file's.
// Phase 91 plan 02 (IDENT-15): Cleric 34 -> 10, measured live: the offense school
// left both of its main-rng pool shuffles (low 5, high 5, spare 2) — same
// declaration as that file's.
const ROLL_GRIMOIRE_DRAW_COUNTS = {
  Wizard: 36, Warlock: 33, Sorcerer: 35, Summoner: 36,
  Cleric: 12, Illusionist: 33, "Court Mage": 34, Apprentice: 37,
};

// --- table shape ----------------------------------------------------------

test("SPELL_LEVEL_OVERRIDES: exactly the Summoner's Summon (Phase 90 plan 06, SPELL-12) — the Illusionist's Phantom Host row went with the spell", () => {
  assert.deepStrictEqual(SPELL_LEVEL_OVERRIDES, { Summoner: { Summon: 1 } });
});

test("spellLevelFor: Summon is level 1 for the Summoner (the named exception) and level 2 for everyone else", async () => {
  const { spellLevelFor } = await import("../../engine/derived.js");
  assert.equal(spellLevelFor("Summoner", byName("Summon")), 1);
  for (const sub of MU_SUBS) if (sub !== "Summoner") assert.equal(spellLevelFor(sub, byName("Summon")), 2, sub);
});

// --- DAMAGE_SPELL_KINDS / dealsDamage --------------------------------------

test("DAMAGE_SPELL_KINDS is exactly {thrown, blast, acid, volley, quake, death} (Phase 90 plan 05: Ice's kind blast replaced dot)", () => {
  assert.deepStrictEqual([...DAMAGE_SPELL_KINDS].sort(), ["acid", "blast", "death", "quake", "thrown", "volley"]);
});

test("dealsDamage: true for the real damage kinds, false for disables, utility and a summon (a summon is never damage)", () => {
  const trueNames = ["Freeze", "Ice", "Acid", "Fireball", "Fireballs", "Earthquake", "Lightning", "Mangle", "Death"];
  const falseNames = ["Doze", "Stun", "Weaken", "Summon", "Heal", "Shield", "Map the Floor"];
  for (const n of trueNames) assert.equal(dealsDamage(byName(n)), true, `${n} must deal damage`);
  for (const n of falseNames) assert.equal(dealsDamage(byName(n)), false, `${n} must not deal damage`);
});

// --- main-rng draw count is unchanged (FID-06 / zero-draw guarantee) ------

test("rollGrimoire main-rng draw count per sub is UNCHANGED (countingRng only counts the passed rng — the derived stream is separate)", () => {
  for (const sub of MU_SUBS) {
    for (const seed of SEEDS) {
      const rng = makeRng(seed);
      const counting = countingRng(rng);
      rollGrimoire(counting, sub);
      assert.equal(
        counting.draws,
        ROLL_GRIMOIRE_DRAW_COUNTS[sub],
        `${sub} seed ${seed}: rollGrimoire drew ${counting.draws} main-rng values, expected ${ROLL_GRIMOIRE_DRAW_COUNTS[sub]} (Phase 40 must not lengthen the main-rng shuffles)`,
      );
    }
  }
});

test("a fakeRng-style rng lacking getState still works — the derived key falls back to cursor 0", () => {
  // No getState/setState at all, only d/pick/shuffle — rollGrimoire must not
  // throw and must still return a valid, non-empty book.
  let i = 0;
  const seq = [3, 5, 2, 4, 7, 1, 6, 8, 5, 2, 9, 1, 3, 7, 4, 6, 8, 2, 5, 3, 1, 9, 4, 6, 7, 2, 8, 5, 3, 1, 4, 6, 9, 7, 2, 8, 5, 3, 1];
  const rng = {
    d(sides) { return 1 + (seq[i++ % seq.length] % sides); },
    pick(arr) { return arr[seq[i++ % seq.length] % arr.length]; },
    shuffle(arr) { for (let k = arr.length - 1; k > 0; k--) { const j = seq[i++ % seq.length] % (k + 1); [arr[k], arr[j]] = [arr[j], arr[k]]; } return arr; },
  };
  const book = rollGrimoire(rng, "Wizard");
  assert.ok(Array.isArray(book) && book.length > 0);
});

// --- the 8-sub x 200-seed day-one damage guarantee (SPELL-04) -------------

test("every Magic User sub but the Cleric holds a castable, damage-dealing spell on day one, over 200 seeds each; the Cleric holds none (IDENT-15)", () => {
  for (const seed of SEEDS) {
    const state = newRun(seed, [], { force: { sub: "Cleric" } });
    assert.ok(!state.c.grimoire.some((n) => dealsDamage(byName(n))), `Cleric seed ${seed}: holds a damage spell (${JSON.stringify(state.c.grimoire)})`);
  }
  for (const sub of MU_SUBS.filter((s) => s !== "Cleric")) {
    for (const seed of SEEDS) {
      const state = newRun(seed, [], { force: { sub } });
      const ok = state.c.grimoire.some((n) => dealsDamage(byName(n)) && canCast(state, byName(n)));
      assert.ok(ok, `${sub} seed ${seed}: no castable damage-dealing spell (grimoire ${JSON.stringify(state.c.grimoire)})`);
    }
  }
});

test("the Summoner always holds Summon (deterministic grant), castable at level 1 with a charge, plus a castable damage spell from the top-up (a summon never counts as damage)", () => {
  const summon = byName("Summon");
  assert.equal(dealsDamage(summon), false);
  for (const seed of SEEDS) {
    const state = newRun(seed, [], { force: { sub: "Summoner" } });
    assert.ok(state.c.grimoire.includes("Summon"), `seed ${seed}: missing Summon`);
    assert.equal(state.c.level, 1);
    assert.equal(canCast(state, summon), true, `seed ${seed}: Summon must be castable at level 1`);
    assert.ok(maxCharges(state.c) - state.c.spellsUsed > 0, `seed ${seed}: no charge to cast it with`);
    assert.ok(state.c.grimoire.some((n) => n !== "Summon" && dealsDamage(byName(n)) && canCast(state, byName(n))), `seed ${seed}: the damage top-up found no castable damage spell`);
  }
});

// Phase 90 plan 07 (SPELL-10): the four appended Special rows are the only rows flagged roll: derived;
// plan 08 appended three more (Stop Time, Senseless, Duplicate Foe), each flagged the same way.
test("only the ten appended plan-07, plan-08 and plan-09 rows are flagged roll: derived, and no row is lesser (Lesser Summon was the earlier roll row)", () => {
  const DERIVED = ["Open/Lock", "Fly", "Enchant Character", "Speed of Sound", "Stop Time", "Senseless", "Duplicate Foe", "Door Illusion", "Chameleon Tongue", "Size of the Behemoth"];
  for (const sp of SPELLS) {
    assert.equal(sp.roll, DERIVED.includes(sp.n) ? "derived" : undefined, `${sp.n} roll flag`);
    assert.equal(sp.lesser, undefined, `${sp.n} must not carry lesser`);
  }
});

test("no duplicate names in any rolled grimoire, across all 8 Magic User subs x 200 seeds", () => {
  for (const sub of MU_SUBS) {
    for (const seed of SEEDS) {
      const rng = makeRng(seed);
      const book = rollGrimoire(rng, sub);
      assert.equal(new Set(book).size, book.length, `${sub} seed ${seed}: duplicate name in ${JSON.stringify(book)}`);
    }
  }
});

// --- the Summoner's offense gate is retired (RULES-03) ---------------------

test("RULES-03 (Phase 75) + SPELL-12 (Phase 90 plan 06): schoolGate('Summoner', 'offense') is 1; a level-1 Summoner holding Freeze and Summon casts both; a level-1 Wizard holding Summon is refused (the exception is the Summoner's alone)", async () => {
  const { schoolGate } = await import("../../engine/derived.js");
  assert.equal(schoolGate("Summoner", "offense"), 1, "the offense gate is removed from content/mu-chart.js");
  const state = newRun(1, [], { force: { sub: "Summoner" } });
  state.c.grimoire = ["Freeze", "Summon"];
  assert.equal(canCast(state, byName("Freeze")), true, "a level-1 Summoner can now cast offense");
  const summon = byName("Summon");
  assert.equal(canCast(state, summon), true, "Summon is castable from level 1 for the Summoner (the named exception)");
  const wizard = newRun(1, [], { force: { sub: "Wizard" } });
  wizard.c.grimoire = ["Summon"];
  assert.equal(canCast(wizard, summon), false, "Summon needs level 2 for every other sub-class");
  wizard.c.level = 2;
  assert.equal(canCast(wizard, summon), true);
});
