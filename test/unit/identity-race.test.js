// Direct unit coverage for Phase 24's race pass (IDENT-08/IDENT-09): the
// Fridgian's hide (-2 flat, floor 1, stacks with Hardiness) and never-wasted
// frenzy second swing, and the Dwarven armour's half-rate durability wear —
// all landed as content/races.js data flags read by engine/combat.js.
//
// Mirrors test/unit/combat.test.js's fakeRng/fixedFighter/fixedFloor/
// fixedState/fixedFoe/fixedCombat helpers verbatim (local copies, per the
// plan — this file does not import them) so this suite reads standalone.

import test from "node:test";
import assert from "node:assert/strict";

import { applyFoeDamageToPlayer, playerStrike } from "../../engine/combat.js";
import { RACES } from "../../content/index.js";

/** fakeRng(seq) — `.d()` pops the next value off `seq` regardless of the
 * requested side count; `.pick(arr)` returns `arr[0]` unless a picker is
 * supplied. Throws if the sequence underflows, which doubles as a "no more
 * rng draws expected" assertion (ports test/unit/combat.test.js's helper
 * verbatim). */
function fakeRng(seq, { pick = (arr) => arr[0] } = {}) {
  let i = 0;
  return {
    d(_sides) {
      if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick,
    shuffle: (a) => a,
  };
}

/** countingRng(rng) — wraps any rng, counting every `.d()` call, so a test
 * can assert the exact number of draws consumed without hand-decoding the
 * sequence twice. */
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
    potions: 1, rations: 6, gold: 50, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    darkFor: 0,
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
    version: 1, seed: 1, rngState: 1,
    c: fixedFighter(cOverrides),
    floor: fixedFloor(floorOverrides),
    day: 1, steps: 0, combat: null, store: null, beats: null,
    dead: false, deathNote: "", epitaph: "",
    ...rest,
  };
}

function fixedFoe(overrides = {}) {
  return {
    name: "Target", type: "Beasts", lvl: 1, size: "S", intel: 1,
    wp: 10, maxWP: 10, alive: true, asleep: 0, sp: {}, lives: 1,
    ...overrides,
  };
}

function fixedCombat(foes, overrides = {}) {
  return { foes, type: foes[0]?.type || "Beasts", round: 1, target: 0, spellOpen: false, tracked: false, ...overrides };
}

// --- RACES flags -------------------------------------------------------

test("RACES: Fridgian carries hide 2, Dwarven carries armorWear 0.5, and no other race carries either flag", () => {
  assert.equal(RACES.Fridgian.hide, 2);
  assert.equal(RACES.Dwarven.armorWear, 0.5);
  for (const r of ["Human", "Elven", "Wilmsry", "Troll"]) {
    assert.ok(!("hide" in RACES[r]), `${r} should not carry hide`);
    assert.ok(!("armorWear" in RACES[r]), `${r} should not carry armorWear`);
  }
});

test("RACES: Fridgian still carries noArmor and slow; Dwarven still carries dmg 2, upkeep 1, foeStrikeStep 1", () => {
  assert.equal(RACES.Fridgian.noArmor, true);
  assert.equal(RACES.Fridgian.slow, true);
  assert.equal(RACES.Fridgian.frenzy, true);
  assert.equal(RACES.Dwarven.dmg, 2);
  assert.equal(RACES.Dwarven.upkeep, 1);
  assert.equal(RACES.Dwarven.foeStrikeStep, 1);
});

test("RACES: Human carries exactly size/upkeep/note, no mechanic flags", () => {
  assert.deepEqual(Object.keys(RACES.Human).sort(), ["note", "size", "upkeep"]);
});

// --- Fridgian hide: flat -2, floor 1, stacks with Hardiness -------------

test("applyFoeDamageToPlayer: a Fridgian's hide soaks 2 flat from every blow, floor 1, zero draws", () => {
  const state = fixedState({ c: { race: "Fridgian" } });
  const events = [];
  applyFoeDamageToPlayer(state, fixedFoe(), fakeRng([]), events, { dmg: 5, roll: 3, need: 5 });
  assert.equal(state.c.wp, 52, "55 - (5 - 2) = 52");
  const struck = events.find((e) => e.type === "struckByFoe");
  assert.equal(struck.dmg, 3);
});

test("applyFoeDamageToPlayer: a Fridgian's hide floors at 1, never negative or zero", () => {
  const state1 = fixedState({ c: { race: "Fridgian" } });
  applyFoeDamageToPlayer(state1, fixedFoe(), fakeRng([]), [], { dmg: 2, roll: 3, need: 5 });
  assert.equal(state1.c.wp, 54, "55 - max(1, 2-2) = 55 - 1 = 54");

  const state2 = fixedState({ c: { race: "Fridgian" } });
  applyFoeDamageToPlayer(state2, fixedFoe(), fakeRng([]), [], { dmg: 1, roll: 3, need: 5 });
  assert.equal(state2.c.wp, 54, "55 - max(1, 1-2) = 55 - 1 = 54");
});

test("applyFoeDamageToPlayer: a Fridgian's hide stacks with Hardiness (hide applied after Hardiness's -3)", () => {
  const state = fixedState({ c: { race: "Fridgian", skills: { Hardiness: 1 } } });
  applyFoeDamageToPlayer(state, fixedFoe(), fakeRng([]), [], { dmg: 7, roll: 3, need: 5 });
  assert.equal(state.c.wp, 53, "55 - max(1, max(1, 7-3) - 2) = 55 - 2 = 53");
});

test("applyFoeDamageToPlayer: a Human takes the full blow — no hide, zero draws", () => {
  const state = fixedState({ c: { race: "Human" } });
  applyFoeDamageToPlayer(state, fixedFoe(), fakeRng([]), [], { dmg: 5, roll: 3, need: 5 });
  assert.equal(state.c.wp, 50, "55 - 5 = 50, no soak");
});

// --- Dwarven armour: half-rate durability wear --------------------------

function leatherArmor() {
  return { armor: "Leather", ar: 6, armorMin: 1, armorWP: 15, armorMax: 15 };
}

test("applyFoeDamageToPlayer: a Dwarf's soaked armour wears at Math.ceil(dmg * 0.5)", () => {
  const state = fixedState({ c: { race: "Dwarven", ...leatherArmor() } });
  const events = [];
  // soak die 1 <= ar 6 -> onArmour
  applyFoeDamageToPlayer(state, fixedFoe(), fakeRng([1]), events, { dmg: 5, roll: 3, need: 5 });
  assert.equal(state.c.armorWP, 12, "15 - ceil(5*0.5)=3 = 12");
  assert.ok(events.some((e) => e.type === "armorSoaked"));
  assert.equal(events.some((e) => e.type === "struckByFoe"), false, "a soaked blow never lands on the hero");
});

test("applyFoeDamageToPlayer: a 1-point-over-min Dwarven soak still costs 1 durability (ceil rounds up)", () => {
  const state = fixedState({ c: { race: "Dwarven", ...leatherArmor() } });
  applyFoeDamageToPlayer(state, fixedFoe(), fakeRng([1]), [], { dmg: 4, roll: 3, need: 5 });
  assert.equal(state.c.armorWP, 13, "15 - ceil(4*0.5)=2 = 13");
});

test("applyFoeDamageToPlayer: a Dwarven soak at or under armorMin never wears the armour (unchanged behaviour)", () => {
  const state = fixedState({ c: { race: "Dwarven", ...leatherArmor() } });
  applyFoeDamageToPlayer(state, fixedFoe(), fakeRng([1]), [], { dmg: 1, roll: 3, need: 5 });
  assert.equal(state.c.armorWP, 15, "dmg 1 is not > armorMin 1, so no wear at all — same as before");
});

test("applyFoeDamageToPlayer: a Human's soaked armour wears at the full dmg rate (unchanged)", () => {
  const state = fixedState({ c: { race: "Human", ...leatherArmor() } });
  applyFoeDamageToPlayer(state, fixedFoe(), fakeRng([1]), [], { dmg: 5, roll: 3, need: 5 });
  assert.equal(state.c.armorWP, 10, "15 - 5 = 10, no Dwarven halving");
});

// --- Fridgian frenzy: never wasted --------------------------------------

test("playerStrike: a Fridgian's frenzy second swing always targets a live foe — draw count proves the whiff roll is gone", () => {
  const state = fixedState({ c: { race: "Fridgian" } });
  state.combat = fixedCombat([
    fixedFoe({ name: "Corpse", wp: 0, alive: false }),
    fixedFoe({ name: "Target", wp: 999, maxWP: 999 }),
  ], { target: 1 });
  const seq = [5, 20, 20, 20, 15, 10, 20];
  const rng = countingRng(fakeRng(seq));
  const events = playerStrike(state, rng, []);
  assert.ok(events.some((e) => e.type === "frenzy"));
  assert.equal(events.some((e) => e.type.toLowerCase().includes("wasted")), false);
  assert.equal(rng.draws, seq.length, "every scripted draw was consumed, none skipped, none extra");
});
