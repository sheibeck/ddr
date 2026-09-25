// test/unit/day-one-damage.test.js
//
// Phase 40 (SPELL-04), Plan 01, Task 2 — the day-one damage guarantee:
// every Magic User sub-class holds a castable, damage-dealing spell on day
// one (proven over every sub x 200 seeds), the Summoner is deterministically
// granted Lesser Summon (and still gets Summon), the retired
// SPELL_LEVEL_OVERRIDES.Summoner row, and the ZERO-DRAW guarantee: the
// Phase-40 derived-row insertion consumes no additional main-rng draws, so
// test/unit/chargen-rng-pin.test.js's pinned draw counts are untouched.

import test from "node:test";
import assert from "node:assert/strict";

import { makeRng } from "../../engine/rng.js";
import { rollGrimoire } from "../../engine/character.js";
import { newRun } from "../../engine/engine.js";
import { SPELLS, CLASSES, SPELL_LEVEL_OVERRIDES } from "../../content/index.js";
import { canCast, dealsDamage, DAMAGE_SPELL_KINDS } from "../../engine/derived.js";

const MU_SUBS = CLASSES["Magic User"].subs;
const SPECIAL_SUBS = ["Wizard", "Sorcerer", "Illusionist", "Summoner", "Apprentice"];
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
// pool).
const ROLL_GRIMOIRE_DRAW_COUNTS = {
  Wizard: 39, Warlock: 33, Sorcerer: 35, Summoner: 36,
  Cleric: 34, Illusionist: 34, "Court Mage": 34, Apprentice: 38,
};

// --- table shape ----------------------------------------------------------

test("SPELL_LEVEL_OVERRIDES: exactly the Illusionist row — the Summoner row is retired", () => {
  assert.deepStrictEqual(SPELL_LEVEL_OVERRIDES, { Illusionist: { "Phantom Host": 1 } });
});

test("spellLevelFor: Summon is level 2 for the Summoner again; Lesser Summon prints its own level 1", async () => {
  const { spellLevelFor } = await import("../../engine/derived.js");
  assert.equal(spellLevelFor("Summoner", byName("Summon")), 2);
  assert.equal(spellLevelFor("Illusionist", byName("Phantom Host")), 1);
  assert.equal(spellLevelFor("Summoner", byName("Lesser Summon")), 1);
});

// --- DAMAGE_SPELL_KINDS / dealsDamage --------------------------------------

test("DAMAGE_SPELL_KINDS is exactly {thrown, dot, acid, volley, quake, death}", () => {
  assert.deepStrictEqual([...DAMAGE_SPELL_KINDS].sort(), ["acid", "death", "dot", "quake", "thrown", "volley"]);
});

test("dealsDamage: true for the real damage kinds and Lesser Summon, false for disables/utility/other summons", () => {
  const trueNames = ["Freeze", "Ice", "Acid", "Fireball", "Fireballs", "Earthquake", "Lightning", "Mangle", "Death", "Lesser Summon"];
  const falseNames = ["Doze", "Stun", "Weaken", "Summon", "Phantom Host", "Heal", "Shield", "Map the Floor"];
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

test("every Magic User sub holds a castable, damage-dealing spell on day one, over 200 seeds each", () => {
  for (const sub of MU_SUBS) {
    for (const seed of SEEDS) {
      const state = newRun(seed, [], { force: { sub } });
      const ok = state.c.grimoire.some((n) => dealsDamage(byName(n)) && canCast(state, byName(n)));
      assert.ok(ok, `${sub} seed ${seed}: no castable damage-dealing spell (grimoire ${JSON.stringify(state.c.grimoire)})`);
    }
  }
});

test("the Summoner always holds Lesser Summon (deterministic grant) and still holds Summon", () => {
  for (const seed of SEEDS) {
    const state = newRun(seed, [], { force: { sub: "Summoner" } });
    assert.ok(state.c.grimoire.includes("Lesser Summon"), `seed ${seed}: missing Lesser Summon`);
    assert.ok(state.c.grimoire.includes("Summon"), `seed ${seed}: missing Summon`);
  }
});

test("the 5 special-school subs: Lesser Summon's derived insertion genuinely varies (present in >=1 non-Summoner grimoire, absent from >=1)", () => {
  for (const sub of SPECIAL_SUBS) {
    if (sub === "Summoner") continue; // deterministic grant, not a variance case
    let has = 0, miss = 0;
    for (const seed of SEEDS) {
      const state = newRun(seed, [], { force: { sub } });
      if (state.c.grimoire.includes("Lesser Summon")) has++; else miss++;
    }
    assert.ok(has >= 1, `${sub}: Lesser Summon never appears over ${SEED_COUNT} seeds`);
    assert.ok(miss >= 1, `${sub}: Lesser Summon appears in EVERY grimoire over ${SEED_COUNT} seeds (should vary)`);
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

test("RULES-03 (Phase 75): schoolGate('Summoner', 'offense') is 1 and a level-1 Summoner holding Freeze passes canCast; Summon (spell level 2) still needs level 2 — a spell-LEVEL lock, not a school gate", async () => {
  const { schoolGate } = await import("../../engine/derived.js");
  assert.equal(schoolGate("Summoner", "offense"), 1, "the offense gate is removed from content/mu-chart.js");
  const state = newRun(1, [], { force: { sub: "Summoner" } });
  state.c.grimoire = ["Freeze", "Summon"];
  assert.equal(canCast(state, byName("Freeze")), true, "a level-1 Summoner can now cast offense");
  const summon = byName("Summon");
  assert.equal(canCast(state, summon), false, "Summon needs level 2 again (spellLevelFor, unrelated to the retired gate)");
  state.c.level = 2;
  assert.equal(canCast(state, summon), true);
});
