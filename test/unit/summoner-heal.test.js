// test/unit/summoner-heal.test.js
//
// RULES-03 (Phase 75, user 2026-09-25, second half): the Summoner's stated
// weakness is that its OWN healing-school spells restore half (floor,
// minimum 1). Covers the chart flag and its one halving helper
// (engine/derived.js#healMulFor/applyCasterHealMul), both consumer sites
// (engine/magic.js's castSpell heal branch, engine/combat.js's foeTurn
// regeneration tick), the ordering (after the Cleric bonus and a heal2x
// race's doubling), the unaffected controls (potions, other casters, a
// non-heal ATTACK_SPELL_KINDS pin for allyCast), and a zero-added-draw
// guarantee via a counting rng.

import test from "node:test";
import assert from "node:assert/strict";

import { castSpell, drinkPotion, readScroll } from "../../engine/magic.js";
import { foeTurn } from "../../engine/combat.js";
import { healMulFor, applyCasterHealMul, ATTACK_SPELL_KINDS } from "../../engine/derived.js";
import { SPELLS, RACES } from "../../content/index.js";
import { GW, GH } from "../../engine/maze.js";

const SPELL_IDX = Object.fromEntries(SPELLS.map((sp, i) => [sp.n, i]));

/** fakeRng(seq) — `.d()` pops the next value off `seq` regardless of the
 * requested side count; `.pick(arr)` returns `arr[0]` unless a picker is
 * supplied. Ports test/unit/magic.test.js's helper verbatim. */
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

/** countingRng(seq) — identical to fakeRng, but tracks the total number of
 * `.d()`/`.pick()` draws made, so a test can prove the halving rule adds
 * zero draws relative to a non-Summoner doing the same thing. */
function countingRng(seq, { pick = (arr) => arr[0] } = {}) {
  let i = 0;
  const counter = { draws: 0 };
  return {
    d(_sides) {
      counter.draws++;
      if (i >= seq.length) throw new Error(`countingRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick(arr) {
      counter.draws++;
      return pick(arr);
    },
    shuffle: (a) => a,
    counter,
  };
}

function fixedCaster(overrides = {}) {
  return {
    cls: "Magic User", sub: "Wizard", race: "Human", level: 4, sp: 0,
    maxWP: 100, wp: 50, skills: {}, vp: 0,
    weapon: "Dagger", prof: 0, magicWpn: 0,
    armor: "Cloth", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 4, rations: 4, gold: 50, scrolls: 1,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Caster",
    ...overrides,
  };
}

// 04-DR10: full GW x GH, matching test/unit/magic.test.js's own fixture —
// castSpell's "reveal" kind iterates the whole grid unconditionally.
function fixedFloor(overrides = {}) {
  const g = [];
  for (let y = 0; y < GH; y++) {
    g.push([]);
    for (let x = 0; x < GW; x++) g[y].push({ wall: false, dark: false, seen: false, feat: null });
  }
  return { g, px: 1, py: 1, depth: 1, ...overrides };
}

function fixedState(overrides = {}) {
  const { c: cOverrides, floor: floorOverrides, ...rest } = overrides;
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedCaster(cOverrides),
    floor: fixedFloor(floorOverrides),
    day: 1, steps: 0, combat: null, store: null, beats: null,
    dead: false, deathNote: "", epitaph: "",
    ...rest,
  };
}

function fixedCombat(foes, overrides = {}) {
  return { foes, type: foes[0]?.type || "Beasts", round: 1, target: 0, spellOpen: false, tracked: false, ...overrides };
}

// --- healMulFor / applyCasterHealMul (the pure helpers) --------------------

test("healMulFor: 0.5 for Summoner, 1 for everyone else including undefined", () => {
  assert.equal(healMulFor("Summoner"), 0.5);
  assert.equal(healMulFor("Cleric"), 1);
  assert.equal(healMulFor("Wizard"), 1);
  assert.equal(healMulFor(undefined), 1);
});

test("applyCasterHealMul: the RULES-03 precision table — 1,2,3,7,10,30 -> 1,1,1,3,5,15 for a Summoner", () => {
  const table = [
    [1, 1],
    [2, 1],
    [3, 1],
    [7, 3],
    [10, 5],
    [30, 15],
  ];
  for (const [amount, expected] of table) {
    assert.equal(applyCasterHealMul("Summoner", amount), expected, `amount ${amount}`);
  }
});

test("applyCasterHealMul: any other sub-class returns the amount unchanged", () => {
  for (const sub of ["Wizard", "Cleric", "Warlock", "Sorcerer", "Court Mage", "Illusionist", "Apprentice", undefined]) {
    assert.equal(applyCasterHealMul(sub, 7), 7, `sub ${sub}`);
  }
});

// --- castSpell's heal branch -------------------------------------------

test("castSpell: a Summoner's Heal (d10 -> 8) restores 4 and carries halved: true", () => {
  const state = fixedState({ c: { sub: "Summoner", grimoire: ["Heal"], level: 1, wp: 10, maxWP: 100 } });
  const events = castSpell(state, SPELL_IDX.Heal, fakeRng([8]), []);
  assert.equal(state.c.wp, 14, "10 + floor(8*0.5) = 14");
  const healed = events.find((e) => e.type === "healed");
  assert.deepEqual(healed, { type: "healed", amount: 4, spell: "Heal", halved: true });
});

test("castSpell: a Wizard's Heal (d10 -> 8) restores 8 with no halved key", () => {
  const state = fixedState({ c: { sub: "Wizard", grimoire: ["Heal"], level: 1, wp: 10, maxWP: 100 } });
  const events = castSpell(state, SPELL_IDX.Heal, fakeRng([8]), []);
  assert.equal(state.c.wp, 18, "10 + 8 = 18");
  const healed = events.find((e) => e.type === "healed");
  assert.deepEqual(healed, { type: "healed", amount: 8, spell: "Heal" });
  assert.equal(Object.hasOwn(healed, "halved"), false);
});

test("castSpell: a heal2x (Wilmsry) Summoner rolling 5 restores 5 — doubled to 10, then halved", () => {
  const state = fixedState({ c: { sub: "Summoner", race: "Wilmsry", grimoire: ["Heal"], level: 1, wp: 0, maxWP: 100 } });
  assert.equal(RACES.Wilmsry.heal2x, true);
  const events = castSpell(state, SPELL_IDX.Heal, fakeRng([5]), []);
  assert.equal(state.c.wp, 5);
  const healed = events.find((e) => e.type === "healed");
  assert.deepEqual(healed, { type: "healed", amount: 5, spell: "Heal", halved: true });
});

test("castSpell: a Cleric's own +3 bonus is folded in before the (unrelated) mul — a non-Summoner Cleric heals normally", () => {
  const state = fixedState({ c: { sub: "Cleric", grimoire: ["Heal"], level: 1, wp: 10, maxWP: 100 } });
  const events = castSpell(state, SPELL_IDX.Heal, fakeRng([8]), []);
  assert.equal(state.c.wp, 21, "10 + 8 + 3 = 21, no halving for a Cleric");
  const healed = events.find((e) => e.type === "healed");
  assert.deepEqual(healed, { type: "healed", amount: 11, spell: "Heal" });
});

test("castSpell: Heal still caps at maxWP after halving", () => {
  const state = fixedState({ c: { sub: "Summoner", grimoire: ["Heal"], level: 1, wp: 98, maxWP: 100 } });
  const events = castSpell(state, SPELL_IDX.Heal, fakeRng([10]), []);
  assert.equal(state.c.wp, 100, "98 + floor(10*0.5)=5 would be 103, capped to 100");
  assert.ok(events.some((e) => e.type === "healed" && e.amount === 5 && e.halved === true));
});

// --- readScroll: a scroll-cast Heal is still a cast, and still halved -----

test("readScroll: a Summoner reading a Heal scroll (d10 -> 8) restores 4", () => {
  // Already in the grimoire so the copy-to-grimoire branch is skipped and
  // the free scroll-cast path (through castSpell, scrollCast: true) runs.
  const state = fixedState({ c: { sub: "Summoner", grimoire: ["Heal"], level: 1, wp: 10, maxWP: 100, scrolls: 1 } });
  const events = readScroll(state, fakeRng([8], { pick: (arr) => arr.find((sp) => sp.n === "Heal") }), []);
  assert.equal(state.c.wp, 14);
  const healed = events.find((e) => e.type === "healed");
  assert.deepEqual(healed, { type: "healed", amount: 4, spell: "Heal", halved: true });
});

// --- foeTurn's regeneration tick -----------------------------------------

test("foeTurn: a Summoner with c.regen (d8 -> 7) regains 3 with halved: true", () => {
  const state = fixedState({ c: { sub: "Summoner", regen: true, wp: 50, maxWP: 100 } });
  state.combat = fixedCombat([]);
  const events = foeTurn(state, fakeRng([7]), []);
  assert.equal(state.c.wp, 53, "50 + floor(7*0.5) = 53");
  const regen = events.find((e) => e.type === "regenerated");
  assert.deepEqual(regen, { type: "regenerated", amount: 3, halved: true });
});

test("foeTurn: a Wizard with c.regen (d8 -> 7) regains 7 with no halved key", () => {
  const state = fixedState({ c: { sub: "Wizard", regen: true, wp: 50, maxWP: 100 } });
  state.combat = fixedCombat([]);
  const events = foeTurn(state, fakeRng([7]), []);
  assert.equal(state.c.wp, 57, "50 + 7 = 57");
  const regen = events.find((e) => e.type === "regenerated");
  assert.deepEqual(regen, { type: "regenerated", amount: 7 });
  assert.equal(Object.hasOwn(regen, "halved"), false);
});

// --- unaffected controls ---------------------------------------------------

test("drinkPotion: a Summoner's potion restores its full, unhalved amount", () => {
  const state = fixedState({ c: { sub: "Summoner", potions: 1, wp: 0, maxWP: 100 } });
  const events = drinkPotion(state, fakeRng([10]), []);
  // 2 * d10 + 5 = 25, exactly as any other sub-class — drinkPotion never
  // reads applyCasterHealMul at all.
  assert.equal(state.c.wp, 25);
  const drunk = events.find((e) => e.type === "potionDrunk");
  assert.deepEqual(drunk, { type: "potionDrunk", amount: 25, remaining: 0 });
});

test("allyCast never casts a heal kind — ATTACK_SPELL_KINDS excludes 'heal'", () => {
  assert.equal(ATTACK_SPELL_KINDS.has("heal"), false);
  // Every kind allyCast is documented to handle (thrown/status/stun/weaken)
  // is present, and 'heal' is not one of them.
  assert.deepEqual([...ATTACK_SPELL_KINDS].sort(), ["status", "stun", "thrown", "weaken"]);
});

// --- zero-added-draw guarantee ----------------------------------------------

test("castSpell: a Summoner's Heal draws exactly as many rng values as a non-Summoner's", () => {
  const summonerRng = countingRng([8]);
  const summonerState = fixedState({ c: { sub: "Summoner", grimoire: ["Heal"], level: 1, wp: 10, maxWP: 100 } });
  castSpell(summonerState, SPELL_IDX.Heal, summonerRng, []);

  const wizardRng = countingRng([8]);
  const wizardState = fixedState({ c: { sub: "Wizard", grimoire: ["Heal"], level: 1, wp: 10, maxWP: 100 } });
  castSpell(wizardState, SPELL_IDX.Heal, wizardRng, []);

  assert.equal(summonerRng.counter.draws, wizardRng.counter.draws);
  assert.equal(summonerRng.counter.draws, 1, "one rollDice(d10) draw, nothing else");
});

test("foeTurn: a Summoner's regeneration tick draws exactly as many rng values as a non-Summoner's", () => {
  const summonerRng = countingRng([7]);
  const summonerState = fixedState({ c: { sub: "Summoner", regen: true, wp: 50, maxWP: 100 } });
  summonerState.combat = fixedCombat([]);
  foeTurn(summonerState, summonerRng, []);

  const wizardRng = countingRng([7]);
  const wizardState = fixedState({ c: { sub: "Wizard", regen: true, wp: 50, maxWP: 100 } });
  wizardState.combat = fixedCombat([]);
  foeTurn(wizardState, wizardRng, []);

  assert.equal(summonerRng.counter.draws, wizardRng.counter.draws);
  assert.equal(summonerRng.counter.draws, 1, "one d8 draw, nothing else");
});
