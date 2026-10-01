// test/unit/wizard-day-one.test.js
//
// Phase 91 plan 02 (IDENT-13), user ruling 2026-09-30: "not having a direct
// damage spell makes the class very not-fun" -- a Wizard always opens with at
// least one direct-damage level-1 spell it can cast on day one, drawn from the
// FULL level-1 direct-damage pool. Pinned across a 1,000-seed sweep.
//
// FLAGGED ASSUMPTION (unclassified probe IDENT-13): "direct-damage" means a
// spell whose own kind deals damage to a foe (engine/derived.js
// DAMAGE_SPELL_KINDS / dealsDamage), never a summon or a buff; "castable on day
// one" means canCast at level 1 plus a spell charge left. Recorded in the
// 91-02 SUMMARY for the user's review.
//
// The step is Wizard-only (the other Magic User subs keep the Phase 40
// best-effort top-up) and draws only from the grimoire DERIVED stream, never
// the main rng.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import { makeRng, derivedRng } from "../../engine/rng.js";
import { rollGrimoire, topUpWizardDamage } from "../../engine/character.js";
import { newRun } from "../../engine/engine.js";
import { SPELLS, RACES, CLASSES } from "../../content/index.js";
import { canCast, canLearn, dealsDamage, schoolGate, spellLevelFor } from "../../engine/derived.js";
import { maxCharges } from "../../engine/movement.js";

const byName = (n) => SPELLS.find((sp) => sp.n === n);
const SEEDS_1000 = Array.from({ length: 1000 }, (_, i) => i + 1);
const SEEDS_200 = Array.from({ length: 200 }, (_, i) => i + 1);

/** the Wizard's day-one rule: a level-1 direct-damage spell, castable, with a charge */
function holdsDayOneDamage(state) {
  const charge = maxCharges(state.c) - state.c.spellsUsed > 0;
  return (
    charge &&
    state.c.grimoire.some((n) => {
      const sp = byName(n);
      return dealsDamage(sp) && spellLevelFor("Wizard", sp) === 1 && canCast(state, sp);
    })
  );
}

// The full level-1 direct-damage pool, derived independently of the helper.
const fullPool = () =>
  SPELLS.filter((sp) => canLearn("Wizard", sp) && spellLevelFor("Wizard", sp) === 1 && schoolGate("Wizard", sp.s) <= 1 && dealsDamage(sp));

function countingRng(inner) {
  let draws = 0;
  return {
    d(n) { draws++; return inner.d(n); },
    pick(a) { draws++; return inner.pick(a); },
    shuffle(a) { draws += Math.max(0, a.length - 1); return inner.shuffle(a); },
    next() { draws++; return inner.next(); },
    getState: inner.getState,
    setState: inner.setState,
    get draws() { return draws; },
  };
}

test("IDENT-13: every new Wizard holds a castable direct-damage level-1 spell on day one, seeds 1 to 1000", () => {
  for (const seed of SEEDS_1000) {
    const state = newRun(seed, [], { force: { cls: "Magic User", sub: "Wizard" } });
    assert.equal(state.c.sub, "Wizard");
    assert.equal(state.c.level, 1);
    assert.ok(holdsDayOneDamage(state), `seed ${seed}: no castable level-1 direct-damage spell (grimoire ${JSON.stringify(state.c.grimoire)})`);
  }
});

test("IDENT-13: the guarantee holds for a Wizard of every race, seeds 1 to 200 each", () => {
  for (const race of Object.keys(RACES)) {
    for (const seed of SEEDS_200) {
      const state = newRun(seed, [], { force: { cls: "Magic User", sub: "Wizard", race } });
      assert.equal(state.c.race, race);
      assert.ok(holdsDayOneDamage(state), `${race} seed ${seed}: no castable level-1 direct-damage spell (grimoire ${JSON.stringify(state.c.grimoire)})`);
    }
  }
});

test("IDENT-13: rollGrimoire alone (no newRun) gives every Wizard seed 1 to 1000 such a spell", () => {
  for (const seed of SEEDS_1000) {
    const book = rollGrimoire(makeRng(seed), "Wizard");
    const ok = book.some((n) => {
      const sp = byName(n);
      return dealsDamage(sp) && spellLevelFor("Wizard", sp) === 1 && schoolGate("Wizard", sp.s) <= 1;
    });
    assert.ok(ok, `seed ${seed}: ${JSON.stringify(book)}`);
  }
});

test("topUpWizardDamage: a damage-less book gains exactly one pool spell; a book that already has one is untouched and draws nothing", () => {
  const pool = fullPool().map((sp) => sp.n);
  assert.ok(pool.length >= 1, "the Wizard's level-1 direct-damage pool is not empty");

  const book = topUpWizardDamage(["Heal", "Shield"], "Wizard", derivedRng(7, "grimoire", "Wizard"));
  assert.equal(book.length, 3);
  assert.deepEqual(book.slice(0, 2), ["Heal", "Shield"]);
  assert.ok(pool.includes(book[2]), `${book[2]} is not in the full level-1 direct-damage pool ${JSON.stringify(pool)}`);

  // a book already holding one: no change and no draw
  let draws = 0;
  const spy = { d() { draws++; return 1; } };
  const holding = ["Heal", "Freeze"];
  assert.equal(topUpWizardDamage(holding, "Wizard", spy), holding);
  assert.deepEqual(holding, ["Heal", "Freeze"]);
  assert.equal(draws, 0);

  // a level-5 damage spell in the book is NOT usable now, so it does not satisfy the rule
  const high = topUpWizardDamage(["Mangle"], "Wizard", derivedRng(7, "grimoire", "Wizard"));
  assert.equal(high.length, 2);
  assert.ok(pool.includes(high[1]));
});

test("topUpWizardDamage: the pool is the full level-1 direct-damage list, never a summon, a buff or a level above 1", () => {
  const pool = fullPool();
  assert.ok(pool.length >= 1);
  for (const sp of pool) {
    assert.equal(sp.lvl, 1, sp.n);
    assert.equal(dealsDamage(sp), true, sp.n);
    assert.notEqual(sp.kind, "summon", sp.n);
    assert.notEqual(sp.kind, "might", sp.n);
    assert.ok(canLearn("Wizard", sp), sp.n);
  }
  assert.ok(pool.some((sp) => sp.n === "Freeze"));
  // drawn spells over many derived streams only ever come from that pool
  const names = new Set(pool.map((sp) => sp.n));
  for (let i = 1; i <= 200; i++) {
    const book = topUpWizardDamage([], "Wizard", derivedRng(i, "grimoire", "Wizard"));
    assert.equal(book.length, 1);
    assert.ok(names.has(book[0]), `${book[0]} outside the pool`);
  }
});

test("topUpWizardDamage: Wizard only -- every other sub gets its book back unchanged with zero draws", () => {
  for (const sub of CLASSES["Magic User"].subs.filter((s) => s !== "Wizard")) {
    let draws = 0;
    const spy = { d() { draws++; return 1; }, pick() { draws++; return 0; } };
    const book = ["Heal", "Shield"];
    assert.equal(topUpWizardDamage(book, sub, spy), book);
    assert.deepEqual(book, ["Heal", "Shield"], sub);
    assert.equal(draws, 0, sub);
  }
});

// Recorded from a run on the base commit (1823e0ed, before this plan): the
// books of every other Magic User sub (the Cleric moves by design, IDENT-15,
// and is pinned in cleric-offense-ban.test.js) and the Wizard's own 1,000
// books. The Wizard digest equals the base because the existing top-up already
// covered every seed: this step is the explicit, named guarantee that keeps it
// true, and it adds nothing to a book that already holds a castable Freeze.
const OTHER_SUBS_DIGEST = "0b725d21e446da8933a70d4da8bd3e893d238306848c178b04c44eeac7c2070f";
const WIZARD_BOOKS_DIGEST = "3231594ffb0be1d6518bf3a656d2220e5164c5376d001a4505489c40afd9db45";

test("Wizard only: every other Magic User sub (but the Cleric) rolls the byte-identical book it did before this plan, seeds 1 to 200", () => {
  const h = createHash("sha256");
  for (const sub of ["Warlock", "Sorcerer", "Court Mage", "Illusionist", "Summoner", "Apprentice"]) {
    for (const seed of SEEDS_200) h.update(sub + ":" + seed + ":" + JSON.stringify(rollGrimoire(makeRng(seed), sub)) + "\n");
  }
  assert.equal(h.digest("hex"), OTHER_SUBS_DIGEST);
});

test("the Wizard's 1,000 rolled books are byte-identical to the base commit's (the top-up never fires on a seed that already holds Freeze)", () => {
  const h = createHash("sha256");
  for (const seed of SEEDS_1000) h.update(seed + ":" + JSON.stringify(rollGrimoire(makeRng(seed), "Wizard")) + "\n");
  assert.equal(h.digest("hex"), WIZARD_BOOKS_DIGEST);
});

test("zero main-rng draws: the Wizard's rollGrimoire draw count is the pinned 36 on every seed, and the step never touches the main rng", () => {
  for (const seed of SEEDS_200) {
    const counting = countingRng(makeRng(seed));
    rollGrimoire(counting, "Wizard");
    assert.equal(counting.draws, 36, `seed ${seed}`);
  }
});
