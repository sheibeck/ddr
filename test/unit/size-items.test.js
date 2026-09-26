// test/unit/size-items.test.js
//
// RULES-11 (Phase 75.2, Plan 02, "Hero Size Matters" — user ruling
// 2026-09-25, after planning): the Gauntlet of the Giant and the Enlarge
// potion each deliver EXACTLY one size step for their duration — Enlarge's
// separate might-kind damage payload is gone, both items' text states
// exactly what a step does, the started event and the condition chip carry
// the size data the shell (75.2-04) will show, and a content guard proves
// every OTHER present-or-future size-stepping item follows the same rule.
//
// Local fixtures mirror test/unit/hero-size.test.js's own per-file
// convention (no cross-import of test helpers).

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { useItem } from "../../engine/items.js";
import {
  sizeStepOf,
  heroSize,
  weaponDamage,
  foeToHitVs,
  potionMight,
  conditionsOf,
} from "../../engine/derived.js";
import { startEffect } from "../../engine/effects.js";
import { newRun } from "../../engine/engine.js";
import { validateSave, serializeRun } from "../../engine/saveState.js";
import { ACTIVATION_OF } from "../../content/index.js";

/** fakeRng(seq) — `.d()` pops the next value; throws on underflow (a "no
 * further rng draw expected" assertion). */
function fakeRng(seq) {
  let i = 0;
  return {
    d(_sides) {
      if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick: (arr) => arr[0],
    shuffle: (a) => a,
  };
}

/** countingRng(rng) — wraps any rng, counting every `.d()` call. */
function countingRng(rng) {
  let draws = 0;
  return {
    d(sides) {
      draws++;
      return rng.d(sides);
    },
    pick: (...args) => rng.pick(...args),
    shuffle: (...args) => rng.shuffle(...args),
    get draws() {
      return draws;
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

/** enlargePotion() — a plain Enlarge potion item, bag-shaped exactly the
 * way engine/economy.js's store line / engine/encounters.js's find offer
 * build one (kind, n, eff2, uses — no `act` spread onto the item itself). */
function enlargePotion() {
  return { kind: "potion", n: "Enlarge potion", eff2: "enlarge", uses: 1 };
}

// =============================================================================
// ACTIVATION_OF shape
// =============================================================================

test("ACTIVATION_OF.Enlarge is exactly a +1 size step with no might; Strength is unchanged; the Gauntlet still carries eff.size 1", () => {
  assert.deepStrictEqual(ACTIVATION_OF.Enlarge, { kind: "enlarge", effect: 50, eff: { size: 1 } });
  assert.deepStrictEqual(ACTIVATION_OF.Strength, { kind: "might", effect: 25, might: 8 });
  assert.deepStrictEqual(ACTIVATION_OF["Gauntlet of the Giant"], { kind: "giant", effect: 50, cd: 50, eff: { size: 1 } });
});

// =============================================================================
// Drinking Enlarge: size step, not might
// =============================================================================

test("drinking Enlarge starts item:Enlarge for 50 squares; sizeStepOf rises by 1 and potionMight stays 0; a Human's weaponDamage rises by 2 and foeToHitVs by 1", () => {
  const before = fixedState({ c: { items: [] } });
  const humanDamage = weaponDamage(before.c, fakeRng([3]));
  before.combat = { foes: [{ alive: true }] };
  const humanNeed = foeToHitVs(before);

  const state = fixedState({ c: { items: [enlargePotion()] } });
  const events = useItem(state, 0, fakeRng([]), []);
  assert.deepStrictEqual(state.c.timers["item:Enlarge"], { cadence: "squares", left: 50, phase: "effect" });
  assert.equal(sizeStepOf(state.c), 1);
  assert.equal(potionMight(state.c), 0);
  assert.equal(weaponDamage(state.c, fakeRng([3])), humanDamage + 2);
  state.combat = { foes: [{ alive: true }] };
  assert.equal(foeToHitVs(state), humanNeed + 1);
  assert.ok(events.some((e) => e.type === "itemConsumed"));
});

test("Strength then Enlarge: potionMight is 8 (Strength only) and the size step is +1", () => {
  const strength = () => ({ kind: "potion", n: "Strength potion", eff2: "strength", uses: 1 });
  const state = fixedState({ c: { items: [strength(), enlargePotion()] } });
  useItem(state, 0, fakeRng([]), []);
  useItem(state, 0, fakeRng([]), []); // now index 0 is the Enlarge potion
  assert.equal(potionMight(state.c), 8);
  assert.equal(sizeStepOf(state.c), 1);
});

test("Gauntlet used and Enlarge drunk: a Human is step 2 (Huge), +4 damage, foe faces +2; a second Enlarge while the first is live leaves the step at 2", () => {
  const humanDamage = weaponDamage(fixedFighter(), fakeRng([3]));
  const needState = fixedState({ c: fixedFighter() });
  needState.combat = { foes: [{ alive: true }] };
  const humanNeed = foeToHitVs(needState);

  const state = fixedState({ c: { items: [enlargePotion()] } });
  startEffect(state.c, "item:Gauntlet of the Giant", { squares: 50, cd: 50 });
  useItem(state, 0, fakeRng([]), []); // drink Enlarge
  assert.equal(sizeStepOf(state.c), 2);
  assert.equal(heroSize(state.c).name, "Huge");
  assert.equal(weaponDamage(state.c, fakeRng([3])), humanDamage + 4);
  state.combat = { foes: [{ alive: true }] };
  assert.equal(foeToHitVs(state), humanNeed + 2);

  // a second Enlarge while the first is live refreshes the SAME record —
  // never a third step.
  state.c.items.push(enlargePotion());
  useItem(state, 0, fakeRng([]), []);
  assert.equal(sizeStepOf(state.c), 2, "still exactly 2 steps — the record was refreshed, not duplicated");
});

test("masks never touch items: a Dwarf drinking Enlarge gains exactly +2 damage (Human + 4 in all) and its foe need goes from 4 to 5", () => {
  const human = weaponDamage(fixedFighter({ race: "Human" }), fakeRng([3]));
  const dwarvenState = fixedState({ c: fixedFighter({ race: "Dwarven", items: [enlargePotion()] }) });
  dwarvenState.combat = { foes: [{ alive: true }] };
  const dwarvenNeedBefore = foeToHitVs(dwarvenState);
  useItem(dwarvenState, 0, fakeRng([]), []);
  assert.equal(weaponDamage(dwarvenState.c, fakeRng([3])), human + 4);
  dwarvenState.combat = { foes: [{ alive: true }] };
  assert.equal(foeToHitVs(dwarvenState), dwarvenNeedBefore + 1, "the item's face step is never masked, even though the Dwarven RACE base is unmasked on this axis already");
});

test("masks never touch items: an Elf drinking Enlarge loses nothing to the mask either — damage back to the Human's, foe need 6 to 7", () => {
  const human = weaponDamage(fixedFighter({ race: "Human" }), fakeRng([3]));
  const elvenState = fixedState({ c: fixedFighter({ race: "Elven", items: [enlargePotion()] }) });
  elvenState.combat = { foes: [{ alive: true }] };
  const elvenNeedBefore = foeToHitVs(elvenState);
  assert.equal(elvenNeedBefore, 6);
  useItem(elvenState, 0, fakeRng([]), []);
  assert.equal(weaponDamage(elvenState.c, fakeRng([3])), human, "Elven's own -2 damage plus the item's own +2 damage nets back to the Human baseline");
  elvenState.combat = { foes: [{ alive: true }] };
  assert.equal(foeToHitVs(elvenState), 7, "the item's face step applies in full despite the Elven face-axis mask on the race base");
});

// =============================================================================
// itemEffectStarted's size/step/sizeDmg fields
// =============================================================================

test("itemEffectStarted for Enlarge carries kind enlarge, size Large, step 1, sizeDmg 2 (a Human)", () => {
  const state = fixedState({ c: { items: [enlargePotion()] } });
  const events = useItem(state, 0, fakeRng([]), []);
  const started = events.find((e) => e.type === "itemEffectStarted");
  assert.ok(started);
  assert.equal(started.kind, "enlarge");
  assert.equal(started.size, "Large");
  assert.equal(started.step, 1);
  assert.equal(started.sizeDmg, 2);
  assert.equal("might" in started, false);
});

test("itemEffectStarted for the Gauntlet on a Troll carries size Huge", () => {
  const gauntlet = { kind: "jewelry", n: "Gauntlet of the Giant", eff: { size: 1 } };
  const state = fixedState({ c: { race: "Troll", worn: { jewelry1: gauntlet } } });
  const events = useItem(state, { slot: "jewelry1" }, fakeRng([]), []);
  const started = events.find((e) => e.type === "itemEffectStarted");
  assert.ok(started);
  assert.equal(started.size, "Huge");
  assert.equal(started.step, 1);
  assert.equal(started.sizeDmg, 2);
});

test("itemEffectStarted for Strength carries might 8 and no size fields", () => {
  const strength = { kind: "potion", n: "Strength potion", eff2: "strength", uses: 1 };
  const state = fixedState({ c: { items: [strength] } });
  const events = useItem(state, 0, fakeRng([]), []);
  const started = events.find((e) => e.type === "itemEffectStarted");
  assert.ok(started);
  assert.equal(started.kind, "might");
  assert.equal(started.might, 8);
  assert.equal("size" in started, false);
  assert.equal("step" in started, false);
  assert.equal("sizeDmg" in started, false);
});

// =============================================================================
// conditionsOf's chip fields
// =============================================================================

test("conditionsOf with the Gauntlet live: its chip carries step 1 and the hero's current size name", () => {
  const c = fixedFighter({ race: "Human" });
  startEffect(c, "item:Gauntlet of the Giant", { squares: 30, cd: 50 });
  const conds = conditionsOf({ c });
  const chip = conds.find((x) => x.key === "giant");
  assert.ok(chip);
  assert.equal(chip.step, 1);
  assert.equal(chip.size, "Large");
});

test("conditionsOf with both the Gauntlet and Enlarge live: two chips in c.timers insertion order, each naming the same current size", () => {
  const c = fixedFighter({ race: "Human" });
  startEffect(c, "item:Gauntlet of the Giant", { squares: 30, cd: 50 });
  startEffect(c, "item:Enlarge", { squares: 40 });
  const conds = conditionsOf({ c });
  const chips = conds.filter((x) => x.key === "giant" || x.key === "enlarge");
  assert.deepStrictEqual(chips.map((x) => x.key), ["giant", "enlarge"]);
  for (const chip of chips) {
    assert.equal(chip.size, "Huge", "both chips report the SAME current total size, not each item's own contribution alone");
  }
  assert.equal(chips[0].step, 1);
  assert.equal(chips[1].step, 1);
});

test("conditionsOf: a Strength chip carries might and no size fields; no size-stepping record means no size fields anywhere", () => {
  const c = fixedFighter({ race: "Human" });
  startEffect(c, "item:Strength", { squares: 20 });
  const conds = conditionsOf({ c });
  const chip = conds.find((x) => x.key === "might" && x.remaining !== undefined);
  assert.ok(chip);
  assert.equal(chip.might, 8);
  assert.equal("step" in chip, false);
  assert.equal("size" in chip, false);
  for (const cond of conds) {
    assert.equal("step" in cond, false);
    assert.equal("size" in cond, false);
  }
});

// =============================================================================
// Old save: tolerant load of a pre-rework live Enlarge record
// =============================================================================

test("old save: a saved state whose c.timers holds a live item:Enlarge effect record round-trips through the save loader and reads as step +1, potionMight 0, no throw", () => {
  const run = newRun(11);
  startEffect(run.c, "item:Enlarge", { squares: 30 });
  const check = validateSave(JSON.stringify(serializeRun(run)));
  assert.equal(check.ok, true);
  assert.equal(sizeStepOf(check.value.c), 1);
  assert.equal(potionMight(check.value.c), 0);
});

// =============================================================================
// Content guard: every ACTIVATION_OF entry with a size eff follows the rule
// =============================================================================

test("content guard: every ACTIVATION_OF entry whose eff carries a size key has size 1 or -1 and no might; its source row's text names the step's damage and odds, with no overhead-clearance wording", () => {
  const sizeEntries = Object.entries(ACTIVATION_OF).filter(([, act]) => act.eff && typeof act.eff.size === "number");
  assert.ok(sizeEntries.length >= 2, "at least Enlarge and the Gauntlet of the Giant");
  for (const [key, act] of sizeEntries) {
    assert.ok(act.eff.size === 1 || act.eff.size === -1, `${key}: size must be exactly +-1`);
    assert.equal("might" in act, false, `${key}: a size-stepping activation must carry no might`);
  }

  // Every row this guard names is authored in content/potions.js or
  // content/treasure-tables.js; grep the exact source text (never a
  // parsed-back derivation) so a future author who adds a size row without
  // the honest wording fails this guard by construction.
  const potionsSrc = readTextSource("../../content/potions.js");
  const treasureSrc = readTextSource("../../content/treasure-tables.js");
  for (const [key] of sizeEntries) {
    const found = potionsSrc.includes(key) || treasureSrc.includes(key);
    assert.ok(found, `${key}: no authored row text found in content/potions.js or content/treasure-tables.js`);
  }
  assert.match(potionsSrc + treasureSrc, /one size/i);
  assert.match(potionsSrc + treasureSrc, /\+2 damage/);
  assert.match(potionsSrc + treasureSrc, /one face easier for foes to hit/);
  assert.doesNotMatch(potionsSrc, /ceiling/i);
  assert.doesNotMatch(treasureSrc, /ceiling/i);
});

/** readTextSource(relPath) — module-private: reads a content source file's
 * raw text (relative to this test file), for the guard's plain grep above —
 * the ONE assertion in this file that needs raw source text rather than a
 * parsed export, so a future author who adds a size row without the
 * honest wording fails this guard by construction. */
function readTextSource(relPath) {
  return readFileSync(new URL(relPath, import.meta.url), "utf8");
}
