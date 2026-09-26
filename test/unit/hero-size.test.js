// test/unit/hero-size.test.js
//
// RULES-11 (Phase 75.2, "Hero Size Matters", user ruling 2026-09-25) — size
// is a real stat. Task 1 (this file's first section) covers the size step
// (race base + items), the signature masks and their data guard (derived
// from content, never a race-name check), floors, heroSize/sizeName, the
// weaponDamage/expectedStrike size term, and draw-count neutrality. Task 2
// appends foeToHitVs/foeToHitBreakdown's hero-side face term and the
// foeTurn member-branch face term.
//
// Local fixtures mirror test/unit/item-wiring.test.js / hero-out.test.js's
// own per-file convention (no cross-import of test helpers).

import test from "node:test";
import assert from "node:assert/strict";

import {
  raceSizeStep,
  itemSizeStep,
  sizeStepOf,
  sizeAxisStep,
  sizeName,
  heroSize,
  sizeDamage,
  weaponDamage,
  expectedStrike,
  classNeed,
  weaponNeedMod,
  strikeDie,
  foeToHitVs,
  foeToHitBreakdown,
  foeSwingVsHero,
} from "../../engine/derived.js";
import { RACES, SIZE_AXES, SIZE_AXIS_TRAITS, SIZE_STEP_OF } from "../../content/index.js";
import { playerStrike, foeTurn } from "../../engine/combat.js";
import { startEffect } from "../../engine/effects.js";

/** fakeRng(seq) — `.d()` pops the next value off `seq` regardless of the
 * requested side count; throws on underflow (a "no more rng draws expected"
 * assertion). */
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
    maxWP: 55, wp: 55, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 0, rations: 6, gold: 50, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    darkFor: 0, halfNext: false,
    ...overrides,
  };
}

function fixedFloor(overrides = {}) {
  const g = [];
  for (let y = 0; y < 3; y++) {
    g.push([]);
    for (let x = 0; x < 3; x++) g[y].push({ wall: false, dark: false, seen: true, feat: null });
  }
  return { g, px: 1, py: 1, depth: 1, ...overrides };
}

function fixedState(overrides = {}) {
  const { c: cOverrides, floor: floorOverrides, ...rest } = overrides;
  return {
    version: 1, seed: 1, rngState: 1, acts: 0,
    c: fixedFighter(cOverrides),
    floor: fixedFloor(floorOverrides),
    day: 1, steps: 0, combat: null, store: null, beats: null, party: [],
    dead: false, deathNote: "", epitaph: "",
    ...rest,
  };
}

function fixedFoe(overrides = {}) {
  return { name: "Target", type: "Beasts", lvl: 1, size: "S", intel: 1, wp: 999, maxWP: 999, alive: true, asleep: 0, sp: {}, lives: 1, ...overrides };
}

function fixedCombat(foes, overrides = {}) {
  return { foes, type: foes[0]?.type || "Beasts", round: 1, target: 0, spellOpen: false, tracked: false, ...overrides };
}

/** soldierOverrides(race, extra) — the plan's own canonical damage-case rig:
 * a level-1 Fighter/Soldier with a Club, prof 0, magicWpn 0, no skills — the
 * ONLY thing that varies race-to-race is `race` itself, unless `extra`
 * overrides something on purpose. */
function soldierOverrides(race, extra = {}) {
  return { race, cls: "Fighter", sub: "Soldier", weapon: "Club", prof: 0, magicWpn: 0, skills: {}, level: 1, ...extra };
}

/** soldier(race, extra) — soldierOverrides, built into a full fixedFighter
 * sheet, for direct calls into weaponDamage/expectedStrike/heroSize/etc. */
function soldier(race, extra = {}) {
  return fixedFighter(soldierOverrides(race, extra));
}

/** withGauntlet(sheet) — starts a live Gauntlet-of-the-Giant item effect
 * (+1 size step, both axes, in full) via the real startEffect seam —
 * mirrors test/unit/item-wiring.test.js's own worn-AND-used Gauntlet
 * fixture, but built through the timers API rather than a raw literal, so
 * this file never restates ACTIVATION_OF's own shape. */
function withGauntlet(sheet) {
  startEffect(sheet, "item:Gauntlet of the Giant", { squares: 50, cd: 50 });
  return sheet;
}

// =============================================================================
// Task 1 — the size step, the signature masks, and what size does to damage
// =============================================================================

test("raceSizeStep: Human, Wilmsry, Fridgian 0; Elven, Dwarven -1; Troll +1", () => {
  assert.equal(raceSizeStep(fixedFighter({ race: "Human" })), 0);
  assert.equal(raceSizeStep(fixedFighter({ race: "Wilmsry" })), 0);
  assert.equal(raceSizeStep(fixedFighter({ race: "Fridgian" })), 0);
  assert.equal(raceSizeStep(fixedFighter({ race: "Elven" })), -1);
  assert.equal(raceSizeStep(fixedFighter({ race: "Dwarven" })), -1);
  assert.equal(raceSizeStep(fixedFighter({ race: "Troll" })), 1);
});

test("itemSizeStep: 0 with no live size record, 1 with a live Gauntlet record", () => {
  assert.equal(itemSizeStep(fixedFighter()), 0);
  assert.equal(itemSizeStep(withGauntlet(fixedFighter())), 1);
});

test("sizeStepOf: race base + items — a Troll with the Gauntlet is 2", () => {
  assert.equal(sizeStepOf(fixedFighter({ race: "Human" })), 0);
  assert.equal(sizeStepOf(fixedFighter({ race: "Troll" })), 1);
  assert.equal(sizeStepOf(withGauntlet(fixedFighter({ race: "Troll" }))), 2);
});

test('sizeAxisStep(sheet, "dmg"): Dwarven 0 (masked), Elven -1, Troll 1, Human 0', () => {
  assert.equal(sizeAxisStep(fixedFighter({ race: "Dwarven" }), "dmg"), 0);
  assert.equal(sizeAxisStep(fixedFighter({ race: "Elven" }), "dmg"), -1);
  assert.equal(sizeAxisStep(fixedFighter({ race: "Troll" }), "dmg"), 1);
  assert.equal(sizeAxisStep(fixedFighter({ race: "Human" }), "dmg"), 0);
});

test('sizeAxisStep(sheet, "face"): Dwarven -1, Elven 0 (masked), Troll 1, Human 0', () => {
  assert.equal(sizeAxisStep(fixedFighter({ race: "Dwarven" }), "face"), -1);
  assert.equal(sizeAxisStep(fixedFighter({ race: "Elven" }), "face"), 0);
  assert.equal(sizeAxisStep(fixedFighter({ race: "Troll" }), "face"), 1);
  assert.equal(sizeAxisStep(fixedFighter({ race: "Human" }), "face"), 0);
});

test("sizeAxisStep with a live Gauntlet: each axis is one higher than its unworn reading — an item step is never masked", () => {
  assert.equal(sizeAxisStep(withGauntlet(fixedFighter({ race: "Dwarven" })), "dmg"), 1);
  assert.equal(sizeAxisStep(withGauntlet(fixedFighter({ race: "Elven" })), "dmg"), 0);
  assert.equal(sizeAxisStep(withGauntlet(fixedFighter({ race: "Troll" })), "dmg"), 2);
  assert.equal(sizeAxisStep(withGauntlet(fixedFighter({ race: "Human" })), "dmg"), 1);

  assert.equal(sizeAxisStep(withGauntlet(fixedFighter({ race: "Dwarven" })), "face"), 0);
  assert.equal(sizeAxisStep(withGauntlet(fixedFighter({ race: "Elven" })), "face"), 1);
  assert.equal(sizeAxisStep(withGauntlet(fixedFighter({ race: "Troll" })), "face"), 2);
  assert.equal(sizeAxisStep(withGauntlet(fixedFighter({ race: "Human" })), "face"), 1);
});

test("mask guard: sizeAxes[axis] === false exactly when the row's base step and that axis's own SIZE_AXIS_TRAITS fields oppose it in sign — derived from content data, never a race name", () => {
  for (const [raceName, R] of Object.entries(RACES)) {
    const base = (R.size && SIZE_STEP_OF[R.size]) || 0;
    for (const axis of SIZE_AXES) {
      const traitSum = SIZE_AXIS_TRAITS[axis].reduce((sum, field) => sum + (R[field] || 0), 0);
      const opposes = base !== 0 && traitSum !== 0 && Math.sign(base) !== Math.sign(traitSum);
      const masked = !!(R.sizeAxes && R.sizeAxes[axis] === false);
      assert.equal(masked, opposes, `${raceName}.${axis}: base=${base} traitSum=${traitSum}`);
    }
  }
  // Exactly Dwarven.dmg and Elven.face are masked; nothing else.
  const maskedPairs = [];
  for (const [raceName, R] of Object.entries(RACES)) {
    for (const axis of SIZE_AXES) if (R.sizeAxes && R.sizeAxes[axis] === false) maskedPairs.push(`${raceName}.${axis}`);
  }
  assert.deepEqual(maskedPairs.sort(), ["Dwarven.dmg", "Elven.face"]);
});

test("mask guard catches a doctored row: a Small race with an opposing face trait and no mask fails the guard's own opposes/masked equality", () => {
  const doctored = { size: "Small", foeToHit: 1 }; // opposes on face (Small=-1, foeToHit=+1), no sizeAxes authored
  const base = (doctored.size && SIZE_STEP_OF[doctored.size]) || 0;
  const traitSum = SIZE_AXIS_TRAITS.face.reduce((sum, field) => sum + (doctored[field] || 0), 0);
  const opposes = base !== 0 && traitSum !== 0 && Math.sign(base) !== Math.sign(traitSum);
  const masked = !!(doctored.sizeAxes && doctored.sizeAxes.face === false);
  assert.equal(opposes, true, "sanity: this fixture really does oppose on the face axis");
  assert.notEqual(masked, opposes, "a doctored row with no mask fails the guard's own opposes/masked equality");
});

test("empty input: an unknown race, an unrecognized axis key, no timers, and a malformed timers map all read 0 without throwing", () => {
  assert.equal(raceSizeStep(fixedFighter({ race: "Nonexistent" })), 0);
  assert.equal(raceSizeStep({}), 0, "no race field at all");
  assert.doesNotThrow(() => raceSizeStep(null));
  assert.equal(raceSizeStep(null), 0);
  assert.equal(raceSizeStep(undefined), 0);

  assert.equal(sizeAxisStep(fixedFighter({ race: "Elven" }), "unknownAxis"), -1, "an unrecognized axis key is simply unmasked, reading the (unmasked) base step");
  assert.doesNotThrow(() => sizeAxisStep(null, "dmg"));
  assert.equal(sizeAxisStep(null, "dmg"), 0);
  assert.equal(sizeAxisStep(undefined, "face"), 0);

  assert.equal(itemSizeStep(fixedFighter({ timers: undefined })), 0);
  assert.equal(itemSizeStep(fixedFighter({ timers: null })), 0);
  assert.equal(itemSizeStep(fixedFighter({ timers: "not an object" })), 0);
  assert.doesNotThrow(() => itemSizeStep(fixedFighter({ timers: "not an object" })));
});

test('sizeName: 0 Human, -1 Small, +1 Large, +2 Huge, +3 Giant, -2 Tiny; clamps beyond either end', () => {
  assert.equal(sizeName(0), "Human");
  assert.equal(sizeName(-1), "Small");
  assert.equal(sizeName(1), "Large");
  assert.equal(sizeName(2), "Huge");
  assert.equal(sizeName(3), "Giant");
  assert.equal(sizeName(-2), "Tiny");
  assert.equal(sizeName(4), "Giant", "clamps beyond the top");
  assert.equal(sizeName(-3), "Tiny", "clamps beyond the bottom");
});

test("heroSize(c): a Dwarf reads step -1, name Small, dmgStep 0, faceStep -1", () => {
  const hs = heroSize(fixedFighter({ race: "Dwarven" }));
  assert.deepEqual(hs, { step: -1, base: -1, name: "Small", baseName: "Small", dmgStep: 0, faceStep: -1 });
});

test("heroSize(c): a Human with the Gauntlet reads step 1, base 0, name Large, baseName Human, dmgStep 1, faceStep 1", () => {
  const hs = heroSize(withGauntlet(fixedFighter({ race: "Human" })));
  assert.deepEqual(hs, { step: 1, base: 0, name: "Large", baseName: "Human", dmgStep: 1, faceStep: 1 });
});

test("weaponDamage, same scripted die, level-1 Club Soldier prof 0 magicWpn 0: Troll +11, Dwarven +2, Elven -2 vs Human", () => {
  const human = weaponDamage(soldier("Human"), fakeRng([3]));
  assert.equal(weaponDamage(soldier("Troll"), fakeRng([3])), human + 11);
  assert.equal(weaponDamage(soldier("Dwarven"), fakeRng([3])), human + 2, "Small's damage axis is dropped for Dwarven — only the race's own +2 dmg applies");
  assert.equal(weaponDamage(soldier("Elven"), fakeRng([3])), human - 2, "Small's damage axis applies in full for Elven (only the face axis is masked)");
});

test("weaponDamage with a live Gauntlet: the item's step applies in full on top of the resolved race base — Human +2, Dwarven +4 total, Elven +0 total (unchanged from Human)", () => {
  const human = weaponDamage(soldier("Human"), fakeRng([3]));
  const dwarvenNoItem = weaponDamage(soldier("Dwarven"), fakeRng([3]));
  const elvenNoItem = weaponDamage(soldier("Elven"), fakeRng([3]));
  assert.equal(weaponDamage(withGauntlet(soldier("Human")), fakeRng([3])), human + 2);
  assert.equal(weaponDamage(withGauntlet(soldier("Dwarven")), fakeRng([3])), dwarvenNoItem + 2, "the item's step stacks on top of the race's own unmasked +2, reaching Human + 4 total");
  assert.equal(weaponDamage(withGauntlet(soldier("Dwarven")), fakeRng([3])), human + 4);
  assert.equal(weaponDamage(withGauntlet(soldier("Elven")), fakeRng([3])), elvenNoItem + 2, "the item's step applies in full despite the Elven face-axis mask (this is the damage axis, never masked for Elven)");
  assert.equal(weaponDamage(withGauntlet(soldier("Elven")), fakeRng([3])), human);
});

test("floor adjacency: an Elf's damage floors at 1 while a Human's does not, at the same raw Club faces (1, 2, 3)", () => {
  const cases = [
    [1, 1, 2],
    [2, 1, 3],
    [3, 2, 4],
  ];
  for (const [raw, elfExpected, humanExpected] of cases) {
    assert.equal(weaponDamage(soldier("Elven"), fakeRng([raw])), elfExpected, `raw ${raw} (Elf)`);
    assert.equal(weaponDamage(soldier("Human"), fakeRng([raw])), humanExpected, `raw ${raw} (Human)`);
  }
});

test("Sorcerer cap: a Troll Sorcerer's damage never exceeds 9 even with the size term", () => {
  const trollSorcerer = soldier("Troll", { sub: "Sorcerer" });
  for (const raw of [1, 2, 3, 4, 5, 6]) {
    assert.ok(weaponDamage(trollSorcerer, fakeRng([raw])) <= 9, `raw ${raw}`);
  }
});

test("expectedStrike moves by exactly the same flat term as weaponDamage for each race (Troll +11, Dwarven +2, Elven -2 vs Human) — isolated from any hitP/die difference; only the SIZE-attributable portion of that shift is new this plan (0 for Dwarven, +2 for Troll, -2 for Elven — sizeDamage's own delta from a non-item character's old contribution, which was always 0)", () => {
  const base = "Club";
  // inner(c) reconstructs expectedStrike's own (flat + avg + bonus + prof)
  // sum from its returned value and the SAME hitP arithmetic
  // expectedStrike computes internally (classNeed/weaponNeedMod/strikeDie,
  // all exported) — every race here is Soldier (noCritFor === true, so
  // critP is always 0), so dividing back out by hitP isolates the flat
  // term even though Elven's own strike die differs from the other three.
  const inner = (c) => {
    const need = Math.max(1, classNeed(c) + weaponNeedMod(base));
    const dieN = strikeDie(c);
    const hitP = Math.min(1, need / dieN);
    return expectedStrike(c, base, 0, 0) / hitP;
  };
  const human = inner(soldier("Human"));
  assert.ok(Math.abs(inner(soldier("Troll")) - (human + 11)) < 1e-9, "matches weaponDamage's own Troll = Human + 11");
  assert.ok(Math.abs(inner(soldier("Dwarven")) - (human + 2)) < 1e-9, "matches weaponDamage's own Dwarven = Human + 2");
  assert.ok(Math.abs(inner(soldier("Elven")) - (human - 2)) < 1e-9, "matches weaponDamage's own Elven = Human - 2");

  // sizeDamage's own contribution (the part of that shift this plan adds):
  // unchanged (0) for Dwarven (the damage axis is masked), +2 for Troll,
  // -2 for Elven — a non-item character's OLD size contribution was always
  // 0, so this is exactly the delta from before this plan.
  assert.equal(sizeDamage(soldier("Dwarven")), 0);
  assert.equal(sizeDamage(soldier("Troll")), 2);
  assert.equal(sizeDamage(soldier("Elven")), -2);
});

test("draws: weaponDamage consumes only the weapon's own dice, for every race", () => {
  for (const race of ["Human", "Elven", "Dwarven", "Troll", "Wilmsry", "Fridgian"]) {
    const rng = countingRng(fakeRng([3]));
    weaponDamage(soldier(race), rng);
    assert.equal(rng.draws, 1, race);
  }
});

test("Shrink composition: with C.heroShrunk, a Troll's landed blow in playerStrike equals ceil(weaponDamage(c) / 2) for the same scripted die — the size term sits inside the halving", () => {
  const expectedRaw = weaponDamage(soldier("Troll"), fakeRng([3]));

  const state = fixedState({ c: soldierOverrides("Troll") });
  state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })], { heroShrunk: true });
  // strike roll (guaranteed hit), one weapon-damage draw (raw 3), a harmless counter-swing miss.
  const events = playerStrike(state, fakeRng([1, 3, 999]), []);
  const struck = events.find((e) => e.type === "struck");
  assert.ok(struck, "the strike landed");
  assert.equal(struck.dmg, Math.ceil(expectedRaw / 2));
});

// =============================================================================
// Task 2 — how easily foes hit you, hero and Joiner, with direction rows
// (test/unit/rollDirection.test.js) and ledger rows (docs/ROLL-LEDGER.md)
// =============================================================================

/** needState(race, extra) — a fixedState whose `c` is soldierOverrides(race,
 * extra) and whose combat holds exactly one plain foe — the rig every
 * foeToHitVs/foeToHitBreakdown/foeSwingVsHero test below builds from. */
function needState(race, extra = {}) {
  const state = fixedState({ c: soldierOverrides(race, extra) });
  state.combat = fixedCombat([fixedFoe()]);
  return state;
}

/** memberState(heroRace, memberRace, memberSub) — a fixedState with a party
 * of one (memberRace/memberSub), taunting (pickFoeTarget's own zero-draw
 * short-circuit) so every foeTurn swing below targets the MEMBER branch,
 * never the hero. */
function memberState(heroRace, memberRace, memberSub = "Guard") {
  const state = fixedState({ c: soldierOverrides(heroRace) });
  const memberSheet = fixedFighter(soldierOverrides(memberRace, { sub: memberSub }));
  startEffect(memberSheet, "ability:taunt", { rounds: 1 });
  state.party = [memberSheet];
  state.combat = fixedCombat([fixedFoe()], {
    allies: [{ partyIdx: 0, name: memberSheet.name, lvl: memberSheet.level, sub: memberSheet.sub, wp: memberSheet.wp, maxWP: memberSheet.maxWP }],
  });
  return state;
}

test("foeToHitVs, level-1 Soldier vs a plain foe: Human 5, Troll 6, Dwarven 4, Elven 6", () => {
  assert.equal(foeToHitVs(needState("Human")), 5);
  assert.equal(foeToHitVs(needState("Troll")), 6);
  assert.equal(foeToHitVs(needState("Dwarven")), 4);
  assert.equal(foeToHitVs(needState("Elven")), 6);
});

test("foeToHitVs with a live Gauntlet record: Human 6, Dwarven 5, Elven 7", () => {
  const human = needState("Human");
  withGauntlet(human.c);
  const dwarven = needState("Dwarven");
  withGauntlet(dwarven.c);
  const elven = needState("Elven");
  withGauntlet(elven.c);
  assert.equal(foeToHitVs(human), 6);
  assert.equal(foeToHitVs(dwarven), 5);
  assert.equal(foeToHitVs(elven), 7);
});

test('foeToHitBreakdown mods: Troll [size +1], Dwarven [size -1], Elven [Elven +1] (no size entry), Elven+Gauntlet [Elven +1, size +1], Human none', () => {
  assert.deepEqual(foeToHitBreakdown(needState("Troll")).mods, [{ name: "size", delta: 1 }]);
  assert.deepEqual(foeToHitBreakdown(needState("Dwarven")).mods, [{ name: "size", delta: -1 }]);
  assert.deepEqual(foeToHitBreakdown(needState("Elven")).mods, [{ name: "Elven", delta: 1 }]);
  const elvenGauntlet = needState("Elven");
  withGauntlet(elvenGauntlet.c);
  assert.deepEqual(foeToHitBreakdown(elvenGauntlet).mods, [
    { name: "Elven", delta: 1 },
    { name: "size", delta: 1 },
  ]);
  assert.deepEqual(foeToHitBreakdown(needState("Human")).mods, []);
});

test("ordering: a Troll Guard lists Guard before size", () => {
  const state = needState("Troll", { sub: "Guard" });
  assert.deepEqual(foeToHitBreakdown(state).mods, [
    { name: "Guard", delta: -1 },
    { name: "size", delta: 1 },
  ]);
});

test("ordering: a Troll Acrobat reads 4 (the Acrobat override, then size)", () => {
  const state = needState("Troll", { sub: "Acrobat" });
  assert.equal(foeToHitVs(state), 4);
});

test("ordering: a Troll with Smoke, Mirror Self, or a live invis item reads 1 — the size term never survives an override", () => {
  const smoke = needState("Troll");
  startEffect(smoke.c, "ability:smoke", { rounds: 1 });
  assert.equal(foeToHitVs(smoke), 1);

  const mirror = needState("Troll", { mirror: 1 });
  assert.equal(foeToHitVs(mirror), 1);

  const invis = needState("Troll");
  startEffect(invis.c, "item:Invisible", { rounds: 90 });
  assert.equal(foeToHitVs(invis), 1);
});

test("floor adjacency: a Dwarven Guard with Battle Roar and Sidestep live reads 1, mods ending with floor", () => {
  const state = needState("Dwarven", { sub: "Guard" });
  startEffect(state.c, "ability:battleRoar", { rounds: 2 });
  startEffect(state.c, "ability:sidestep", { rounds: 2 });
  const { need, mods } = foeToHitBreakdown(state);
  assert.equal(need, 1);
  assert.equal(mods[mods.length - 1].name, "floor");
});

test('vs "member": foeToHitVs and its breakdown carry no size term from the hero', () => {
  const troll = needState("Troll");
  assert.equal(foeToHitVs(troll, "member"), 5, "no size term for vs=member (the plain 5, unaffected by the hero's own Large step)");
  assert.deepEqual(foeToHitBreakdown(troll, "member").mods, []);
});

test("foeSwingVsHero(state, f) for a Troll includes the size mod", () => {
  const state = needState("Troll");
  const { mods } = foeSwingVsHero(state, state.combat.foes[0]);
  assert.deepEqual(mods, [{ name: "size", delta: 1 }]);
});

test("foeTurn against a Troll emits struckByFoe/foeMissed with mods including size +1; against an Elf, mods carry no size entry", () => {
  const trollState = needState("Troll");
  // draw 1: to-hit (raw 1 mirrors to the top face — a guaranteed hit for any
  // dieN/atLeastFor); draw 2: the damage die (rng.d(6)).
  const trollEvents = foeTurn(trollState, fakeRng([1, 5]), []);
  const trollHit = trollEvents.find((e) => e.type === "struckByFoe" || e.type === "foeMissed");
  assert.ok(trollHit, "the Troll's swing resolved");
  assert.ok(trollHit.mods && trollHit.mods.some((m) => m.name === "size" && m.delta === 1));

  const elfState = needState("Elven");
  const elfEvents = foeTurn(elfState, fakeRng([1, 5]), []);
  const elfHit = elfEvents.find((e) => e.type === "struckByFoe" || e.type === "foeMissed");
  assert.ok(elfHit, "the Elf's swing resolved");
  assert.equal(elfHit.mods ? elfHit.mods.some((m) => m.name === "size") : false, false, "no size entry — the Elven face axis is masked");
});

test("draws: foeTurn against a Troll, a Dwarf, an Elf and a Human all draw the same count for the same scripted sequence", () => {
  for (const race of ["Troll", "Dwarven", "Elven", "Human"]) {
    const state = needState(race);
    const rng = countingRng(fakeRng([1, 5]));
    foeTurn(state, rng, []);
    assert.equal(rng.draws, 2, race);
  }
});

test("foeTurn member branch: a Troll member raises the foe's faces by 1 (size +1), a Dwarven member lowers them by 1 (size -1); an Elven member and a Human member add none; the hero's own race never reaches a member's faces through this term", () => {
  const trollMember = memberState("Human", "Troll");
  const trollEvents = foeTurn(trollMember, fakeRng([1, 5]), []);
  const trollHit = trollEvents.find((e) => e.member);
  assert.ok(trollHit, "the Troll member's swing resolved");
  assert.ok(trollHit.mods && trollHit.mods.some((m) => m.name === "size" && m.delta === 1));

  const dwarvenMember = memberState("Human", "Dwarven");
  const dwarvenEvents = foeTurn(dwarvenMember, fakeRng([1, 5]), []);
  const dwarvenHit = dwarvenEvents.find((e) => e.member);
  assert.ok(dwarvenHit, "the Dwarven member's swing resolved");
  assert.ok(dwarvenHit.mods && dwarvenHit.mods.some((m) => m.name === "size" && m.delta === -1));

  const elvenMember = memberState("Human", "Elven");
  const elvenEvents = foeTurn(elvenMember, fakeRng([1, 5]), []);
  const elvenHit = elvenEvents.find((e) => e.member);
  assert.ok(elvenHit, "the Elven member's swing resolved");
  assert.equal(elvenHit.mods ? elvenHit.mods.some((m) => m.name === "size") : false, false);

  const humanMember = memberState("Human", "Human");
  const humanEvents = foeTurn(humanMember, fakeRng([1, 5]), []);
  const humanHit = humanEvents.find((e) => e.member);
  assert.ok(humanHit, "the Human member's swing resolved");
  assert.equal(humanHit.mods ? humanHit.mods.some((m) => m.name === "size") : false, false);

  // The hero's own race never reaches a member's faces through this term: a
  // Troll HERO with a plain Human member reads no size mod on the swing.
  const trollHeroHumanMember = memberState("Troll", "Human");
  const mixedEvents = foeTurn(trollHeroHumanMember, fakeRng([1, 5]), []);
  const mixedHit = mixedEvents.find((e) => e.member);
  assert.ok(mixedHit, "the swing resolved");
  assert.equal(mixedHit.mods ? mixedHit.mods.some((m) => m.name === "size") : false, false, "the hero's own Large step never reaches the member's odds");
});
