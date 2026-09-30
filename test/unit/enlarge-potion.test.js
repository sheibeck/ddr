// test/unit/enlarge-potion.test.js
//
// Phase 89 plan 02 (ITEM-05, report #6: "Enlarge potion send worthless. +2
// damage to get hit now often? Should be more in alignment with troll +11 to
// damage."): the Enlarge potion is Troll-sized. Ruled 2026-09-30: +11 damage
// for 50 squares (the one size step's +2 plus +9 bulk, carried as activation
// data `eff.dmg`), at the cost of one size step (every foe +1 to hit the
// drinker), priced 150 so it does not undercut Strength (+8 for 25 squares at
// 100). The text names both sides in TEXT-01 wording.
//
// Every number a text states is read from the engine below, never hand-typed
// on the engine side of an assertion.

import test from "node:test";
import assert from "node:assert/strict";

import { useItem } from "../../engine/items.js";
import { openStore } from "../../engine/economy.js";
import { makeRng } from "../../engine/rng.js";
import { newRun } from "../../engine/engine.js";
import {
  SIZE_DAMAGE_PER_STEP,
  SIZE_FACES_PER_STEP,
  conditionsOf,
  expectedStrike,
  foeToHitVs,
  heroSize,
  weaponDamageRange,
  weaponDamageTerms,
} from "../../engine/derived.js";
import { startEffect } from "../../engine/effects.js";
import { ACTIVATION_OF, POTIONS } from "../../content/index.js";
import { setIdentityDials } from "./harness/identityDials.js";

setIdentityDials();

/** fakeRng(seq) — `.d()` pops the next value; throws on underflow (a "no draw" assertion). */
function fakeRng(seq) {
  let i = 0;
  return {
    d() {
      if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick: (arr) => arr[0],
    shuffle: (a) => a,
    get draws() {
      return i;
    },
  };
}

function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
    maxWP: 55, wp: 55, skills: {},
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    gold: 50, kills: 0, might: 0, ward: null, regen: false, mirror: 0,
    affliction: null, items: [], motive: "Money", name: "Test Delver",
    ...overrides,
  };
}

function fixedState(overrides = {}) {
  const { c: cOverrides, ...rest } = overrides;
  return {
    c: fixedFighter(cOverrides),
    floor: { depth: 1 },
    day: 1,
    steps: 0,
    combat: null,
    ...rest,
  };
}

const enlargePotion = () => ({ kind: "potion", n: "Enlarge potion", eff2: "enlarge", uses: 1 });
const potion = (n) => POTIONS.find((p) => p.n === n);

/** withEnlarge(race) — a fighter of `race` with a live Enlarge record, and the same fighter without. */
function pair(race) {
  const plain = fixedFighter({ race });
  const big = fixedFighter({ race });
  startEffect(big, "item:Enlarge", { squares: 50 });
  return { plain, big };
}

/** damageDelta(race) — the weapon damage terms' bonus the potion adds, read from the engine. */
function damageDelta(race) {
  const { plain, big } = pair(race);
  return weaponDamageTerms(big).bonus - weaponDamageTerms(plain).bonus;
}

/** toHitDelta(race) — how many more faces every foe wins on against the drinker, read from the engine. */
function toHitDelta(race) {
  const { plain, big } = pair(race);
  return foeToHitVs({ c: big, combat: { foes: [{ alive: true }] } }) - foeToHitVs({ c: plain, combat: { foes: [{ alive: true }] } });
}

// --- the numbers ------------------------------------------------------------

test("ITEM-05 numbers: Enlarge is 50 squares of one size step plus +9 bulk, priced 150; Strength is still +8 for 25 squares at 100", () => {
  assert.deepStrictEqual(ACTIVATION_OF.Enlarge, { kind: "enlarge", effect: 50, eff: { size: 1, dmg: 9 } });
  assert.equal("cd" in ACTIVATION_OF.Enlarge, false);
  assert.equal(potion("Enlarge").price, 150);
  assert.deepStrictEqual(potion("Strength").act, { kind: "might", effect: 25, might: 8 });
  assert.equal(potion("Strength").price, 100);
  assert.ok(potion("Enlarge").price > potion("Strength").price, "+11 for 50 squares must never undercut +8 for 25 squares");
});

test("a Human's damage terms rise by exactly 11; the damage range and the expected strike follow", () => {
  const { plain, big } = pair("Human");
  assert.equal(damageDelta("Human"), 11);
  assert.equal(damageDelta("Human"), SIZE_DAMAGE_PER_STEP * ACTIVATION_OF.Enlarge.eff.size + ACTIVATION_OF.Enlarge.eff.dmg);
  const r0 = weaponDamageRange(plain);
  const r1 = weaponDamageRange(big);
  assert.equal(r1.min - r0.min, 11);
  assert.equal(r1.max - r0.max, 11);
  // expectedStrike moves by 11 times the (hit + crit) chance it already applies:
  // that chance is the change one extra point of `bonus` makes.
  const chance = expectedStrike(plain, "Club", 1) - expectedStrike(plain, "Club", 0);
  assert.ok(chance > 0);
  const moved = expectedStrike(big, "Club") - expectedStrike(plain, "Club");
  assert.ok(Math.abs(moved - 11 * chance) < 1e-9, `moved ${moved} vs ${11 * chance}`);
});

test("a Troll drinking Enlarge stacks: its damage terms rise by exactly 11 (+11 to +22) and its size steps Large to Huge; a Human reads Large", () => {
  const { plain, big } = pair("Troll");
  assert.equal(weaponDamageTerms(plain).bonus - weaponDamageTerms(pair("Human").plain).bonus, 11, "the Troll's own race terms: +9 own and Large +2");
  assert.equal(damageDelta("Troll"), 11);
  assert.equal(weaponDamageTerms(big).bonus - weaponDamageTerms(pair("Human").plain).bonus, 22);
  assert.equal(heroSize(plain).name, "Large");
  assert.equal(heroSize(big).name, "Huge");
  assert.equal(heroSize(pair("Human").big).name, "Large");
});

test("the cost: every foe is exactly SIZE_FACES_PER_STEP (1) more to hit the drinker, Human and Troll alike", () => {
  assert.equal(toHitDelta("Human"), SIZE_FACES_PER_STEP * ACTIVATION_OF.Enlarge.eff.size);
  assert.equal(toHitDelta("Human"), 1);
  assert.equal(toHitDelta("Troll"), 1);
});

// --- use ---------------------------------------------------------------------

test("using Enlarge: started carries kind, left 50, step 1, sizeDmg 2, dmgTotal 11, size Large; the potion is consumed; no rng draw", () => {
  const state = fixedState({ c: { items: [enlargePotion()] } });
  const rng = fakeRng([]);
  const events = useItem(state, 0, rng, []);
  const started = events.find((e) => e.type === "itemEffectStarted");
  assert.ok(started);
  assert.equal(started.kind, "enlarge");
  assert.equal(started.left, 50);
  assert.equal(started.step, 1);
  assert.equal(started.sizeDmg, 2);
  assert.equal(started.dmgTotal, 11);
  assert.equal(started.size, "Large");
  assert.ok(events.some((e) => e.type === "itemConsumed"));
  assert.equal(rng.draws, 0);
  assert.deepStrictEqual(state.c.items, []);
});

test("the Gauntlet of the Giant is unchanged: started sizeDmg 2 and dmgTotal 2, its damage delta stays 2", () => {
  const gauntlet = { kind: "jewelry", n: "Gauntlet of the Giant", eff: { size: 1 } };
  const state = fixedState({ c: { worn: { jewelry1: gauntlet } } });
  const events = useItem(state, { slot: "jewelry1" }, fakeRng([]), []);
  const started = events.find((e) => e.type === "itemEffectStarted");
  assert.ok(started);
  assert.equal(started.sizeDmg, 2);
  assert.equal(started.dmgTotal, 2);
  const plain = fixedFighter();
  const big = fixedFighter();
  startEffect(big, "item:Gauntlet of the Giant", { squares: 50, cd: 50 });
  assert.equal(weaponDamageTerms(big).bonus - weaponDamageTerms(plain).bonus, 2);
});

test("a non-size item's started event carries no dmgTotal", () => {
  const strength = { kind: "potion", n: "Strength potion", eff2: "strength", uses: 1 };
  const state = fixedState({ c: { items: [strength] } });
  const started = useItem(state, 0, fakeRng([]), []).find((e) => e.type === "itemEffectStarted");
  assert.equal("dmgTotal" in started, false);
});

test("the Enlarged chip carries step 1, size Large and dmgTotal 11", () => {
  const { big } = pair("Human");
  const chip = conditionsOf({ c: big }).find((x) => x.key === "enlarge");
  assert.ok(chip);
  assert.equal(chip.step, 1);
  assert.equal(chip.size, "Large");
  assert.equal(chip.dmgTotal, 11);
});

// --- the store ---------------------------------------------------------------

test("a store stocking Enlarge sells the potion at 150 wilmst", () => {
  let line = null;
  for (let seed = 1; seed <= 400 && !line; seed++) {
    const state = newRun(seed);
    state.storeRoll = true;
    state.floor.depth = 1;
    openStore(state, makeRng(state.rngState), []);
    line = state.store.stock.find((s) => s.n === "Enlarge potion") || null;
  }
  assert.ok(line, "some seeded store stocks the Enlarge potion");
  assert.equal(line.cost, 150);
});

// --- the text ----------------------------------------------------------------

test("the Enlarge text states both sides, and both numbers are the engine's own", () => {
  const txt = potion("Enlarge").txt;
  assert.ok(txt.includes(`+${damageDelta("Human")} damage`), txt);
  assert.ok(txt.includes(`foes +${toHitDelta("Human")} to hit you`), txt);
  assert.equal(txt, "one size larger for fifty squares: +11 damage, and foes +1 to hit you");
});
