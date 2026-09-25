// test/unit/odds-helpers.test.js
//
// Phase 74 (ROLL-02), plan 74-01 Task 1 — coverage for the three pure
// odds-display helpers this plan lifts into engine/derived.js
// (targetStrikeFaces, heroStrikeFacesVs, foeSwingVsHero), plus an
// equivalence matrix proving each helper matches the real event a live
// playerStrike/foeTurn/pursuit strike (via flee) emits, run against the
// engine AS IT STANDS at Task 1 (the engine still runs its own inline
// per-target/per-foe chains — this proves the helpers match those chains
// before Task 2 swaps the engine over to call them).
//
// Local helper copies (fakeRng/fixedFighter/fixedFloor/fixedState/fixedFoe/
// fixedCombat) mirror test/unit/feedback-payload.test.js and
// test/unit/ability-strike.test.js verbatim — this repo's established
// per-file-fixture convention (never imported cross-file).
//
// Every equivalence case forces a MISS via a single raw draw equal to the
// check die's side count (dieN): rollCheck mirrors a raw draw `r` to
// `roll = dieN + 1 - r`, so `r = dieN` always produces `roll = 1`, the
// worst possible roll for the roller — guaranteed to miss any atLeast in
// this matrix's range, with zero extra draws (no damage roll, no crit
// branch, no kill-cascade). This keeps every case a single fakeRng entry
// (two for the pursuit cases: the flee roll, then the pursuit strike).

import test from "node:test";
import assert from "node:assert/strict";

import {
  toHit,
  foeToHitVs,
  foeToHitBreakdown,
  targetStrikeFaces,
  heroStrikeFacesVs,
  foeSwingVsHero,
} from "../../engine/derived.js";
import { playerStrike, foeTurn, flee } from "../../engine/combat.js";
import { atLeastFor } from "../../engine/dice.js";

// --- local fixtures (mirror test/unit/feedback-payload.test.js verbatim) ---

/** fakeRng(seq) — `.d()` pops the next value off `seq` regardless of the
 * requested side count; throws if the sequence underflows, which doubles as
 * a "no more rng draws expected" assertion. */
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

/** A tiny 3x3 floor whose (1,1) center tile's `dark` flag is controlled by
 * `overrides.dark` (default false). */
function fixedFloor(overrides = {}) {
  const { dark = false, ...rest } = overrides;
  const g = [];
  for (let y = 0; y < 3; y++) {
    g.push([]);
    for (let x = 0; x < 3; x++) g[y].push({ wall: false, dark, seen: true, feat: null });
  }
  return { g, px: 1, py: 1, depth: 1, ...rest };
}

function fixedState(overrides = {}) {
  const { c: cOverrides, floor: floorOverrides, ...rest } = overrides;
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedFighter(cOverrides),
    floor: fixedFloor(floorOverrides),
    day: 1, steps: 0, combat: null, store: null, beats: null, party: [],
    dead: false, deathNote: "", epitaph: "",
    ...rest,
  };
}

function fixedFoe(overrides = {}) {
  return {
    name: "Target", type: "Beasts", lvl: 1, size: "S", intel: 1,
    wp: 30, maxWP: 30, alive: true, asleep: 0, sp: {}, lives: 1,
    ...overrides,
  };
}

function fixedCombat(foes, overrides = {}) {
  return { foes, type: foes[0]?.type || "Beasts", round: 1, target: 0, spellOpen: false, tracked: false, ...overrides };
}

function timersFor(key) {
  return { [`ability:${key}`]: { cadence: "rounds", left: 2, phase: "effect", cd: 5 } };
}

// A level-1 Human/Elven hero (no strikeStep/foeStrikeStep race term in this
// matrix) always strikes on a d20 and is always struck on a d20 — every
// equivalence case below can hardcode dieN = 20.
const DIE_N = 20;

// playerStrike always chains into afterPlayerAction (allyTurn/alliesTurn are
// zero-draw no-ops on this solo fixture, but foeTurn is NOT — a live target
// foe gets its own counter-swing unless it was asleep/stupid-skipped this
// round). A generous same-value tail keeps every hero-equivalence case's
// draw count correct regardless of whether the target's own turn draws:
// every trailing DIE_N forces the same guaranteed-miss roll of 1, and any
// unused entries are simply never popped.
const FILL = new Array(8).fill(DIE_N);

// --- 1. targetStrikeFaces: direct unit coverage of the five terms ----------

test("targetStrikeFaces: a plain target returns faces unchanged", () => {
  const c = fixedFighter();
  const t = fixedFoe();
  assert.equal(targetStrikeFaces(c, t, 5), 5);
});

test("targetStrikeFaces: a dozing or stupid target floors faces at 5", () => {
  const c = fixedFighter();
  assert.equal(targetStrikeFaces(c, fixedFoe({ asleep: 1 }), 3), 5);
  assert.equal(targetStrikeFaces(c, fixedFoe({ stupid: true }), 3), 5);
  // A Fighter already at 5+ is unaffected (clamp, not an override).
  assert.equal(targetStrikeFaces(c, fixedFoe({ asleep: 1 }), 7), 7);
});

test("targetStrikeFaces: sp.toHit caps faces down (hard to hit)", () => {
  const c = fixedFighter();
  assert.equal(targetStrikeFaces(c, fixedFoe({ sp: { toHit: 4 } }), 5), 4);
  assert.equal(targetStrikeFaces(c, fixedFoe({ sp: { toHit: 1 } }), 5), 1);
  // Already under the cap is unaffected.
  assert.equal(targetStrikeFaces(c, fixedFoe({ sp: { toHit: 4 } }), 3), 3);
});

test("targetStrikeFaces: sp.fast removes one winning face, floored at 1", () => {
  const c = fixedFighter();
  assert.equal(targetStrikeFaces(c, fixedFoe({ sp: { fast: true } }), 5), 4);
  assert.equal(targetStrikeFaces(c, fixedFoe({ sp: { fast: true } }), 1), 1);
});

test("targetStrikeFaces: sp.magicOnly zeroes faces without a magic weapon, restores with one", () => {
  const t = fixedFoe({ sp: { magicOnly: true } });
  assert.equal(targetStrikeFaces(fixedFighter({ magicWpn: 0 }), t, 5), 0);
  assert.equal(targetStrikeFaces(fixedFighter({ magicWpn: 1 }), t, 5), 5);
});

test("targetStrikeFaces: sp.daggerOnly zeroes faces without a dagger or magic weapon, restores with either", () => {
  const t = fixedFoe({ sp: { daggerOnly: true } });
  assert.equal(targetStrikeFaces(fixedFighter({ weapon: "Club", magicWpn: 0 }), t, 5), 0);
  assert.equal(targetStrikeFaces(fixedFighter({ weapon: "Dagger", magicWpn: 0 }), t, 6), 6);
  assert.equal(targetStrikeFaces(fixedFighter({ weapon: "Club", magicWpn: 1 }), t, 5), 5);
});

// --- 2. Purity ---------------------------------------------------------------

test("targetStrikeFaces/heroStrikeFacesVs/foeSwingVsHero: pure — deep-frozen inputs, no throw, deep-equal across two calls", () => {
  const c = Object.freeze(fixedFighter({ sub: "Guard" }));
  const t = Object.freeze(fixedFoe({ sp: Object.freeze({ toHit: 4 }) }));
  assert.doesNotThrow(() => targetStrikeFaces(c, t, 5));
  assert.equal(targetStrikeFaces(c, t, 5), targetStrikeFaces(c, t, 5));

  const combat = Object.freeze(fixedCombat([t], { foeToHitPenalty: 3, parleyInsulted: true }));
  const state = Object.freeze({ ...fixedState({ c: { sub: "Guard" } }), c, combat });
  assert.doesNotThrow(() => heroStrikeFacesVs(state, t));
  assert.equal(heroStrikeFacesVs(state, t), heroStrikeFacesVs(state, t));

  assert.doesNotThrow(() => foeSwingVsHero(state, t));
  assert.deepEqual(foeSwingVsHero(state, t), foeSwingVsHero(state, t));
});

test("foeSwingVsHero: a missing state.combat skips the two combat-wide terms and never throws", () => {
  const state = fixedState({ c: { sub: "Guard" } });
  state.combat = null;
  const foe = fixedFoe();
  assert.doesNotThrow(() => foeSwingVsHero(state, foe));
  const result = foeSwingVsHero(state, foe);
  assert.equal(result.faces, foeToHitVs(state));
  assert.deepEqual(result.mods, foeToHitBreakdown(state).mods);
});

// --- 3. Equivalence (hero): heroStrikeFacesVs vs a real playerStrike -------

const HERO_CLASSES = ["Fighter", "Thief", "Magic User"];

const TARGET_CASES = [
  { label: "plain", foe: {} },
  { label: "asleep", foe: { asleep: 1 } },
  { label: "stupid", foe: { stupid: true } },
  { label: "sp.toHit 4", foe: { sp: { toHit: 4 } } },
  { label: "sp.toHit 1", foe: { sp: { toHit: 1 } } },
  { label: "sp.fast", foe: { sp: { fast: true } } },
  { label: "magicOnly w/o magic weapon", foe: { sp: { magicOnly: true } }, c: { magicWpn: 0 } },
  { label: "magicOnly w/ magic weapon", foe: { sp: { magicOnly: true } }, c: { magicWpn: 1 } },
  { label: "daggerOnly w/ Club", foe: { sp: { daggerOnly: true } }, c: { weapon: "Club", magicWpn: 0 } },
  { label: "daggerOnly w/ Dagger", foe: { sp: { daggerOnly: true } }, c: { weapon: "Dagger", magicWpn: 0 } },
  { label: "daggerOnly w/ magic weapon", foe: { sp: { daggerOnly: true } }, c: { weapon: "Club", magicWpn: 1 } },
];

for (const cls of HERO_CLASSES) {
  for (const tc of TARGET_CASES) {
    for (const afraid of [false, true]) {
      const label = `hero equivalence: ${cls} vs ${tc.label}${afraid ? " (afraid)" : ""}`;
      test(label, () => {
        const state = fixedState({ c: { cls, weapon: "Club", magicWpn: 0, ...(tc.c || {}) } });
        const foe = fixedFoe(tc.foe);
        state.combat = fixedCombat([foe], afraid ? { afraid: 3 } : {});
        const expectedFaces = heroStrikeFacesVs(state, foe);
        const expectedAtLeast = atLeastFor(expectedFaces, DIE_N);
        const events = playerStrike(state, fakeRng([DIE_N, ...FILL]), []);
        const missed = events.find((e) => e.type === "strikeMissed" && e.target === foe.name);
        assert.ok(missed, `${label}: expected a strikeMissed event`);
        assert.equal(missed.dieN, DIE_N, label);
        assert.equal(missed.atLeast, expectedAtLeast, label);
      });
    }
  }
}

test("hero equivalence: Fighter vs a plain foe on a dark tile", () => {
  const state = fixedState({ c: { cls: "Fighter" }, floor: { dark: true } });
  const foe = fixedFoe();
  state.combat = fixedCombat([foe]);
  const expectedFaces = heroStrikeFacesVs(state, foe);
  const expectedAtLeast = atLeastFor(expectedFaces, DIE_N);
  const events = playerStrike(state, fakeRng([DIE_N, ...FILL]), []);
  const missed = events.find((e) => e.type === "strikeMissed" && e.target === foe.name);
  assert.ok(missed, "expected a strikeMissed event");
  assert.equal(missed.atLeast, expectedAtLeast);
});

// --- 4. Equivalence (foe): foeSwingVsHero vs a real foeTurn/pursuit strike -

const FOE_HEROES = [
  { label: "Human Soldier", c: { race: "Human", cls: "Fighter", sub: "Soldier" } },
  { label: "Human Guard", c: { race: "Human", cls: "Fighter", sub: "Guard" } },
  { label: "Human Acrobat", c: { race: "Human", cls: "Thief", sub: "Acrobat" } },
  { label: "Elven", c: { race: "Elven", cls: "Fighter", sub: "Soldier" } },
];

const FOE_MOD_CASES = [
  { label: "plain", c: {}, combat: {}, foe: {} },
  { label: "Sidestep", c: { timers: timersFor("sidestep") }, combat: {}, foe: {} },
  { label: "Smoke", c: { timers: timersFor("smoke") }, combat: {}, foe: {} },
  { label: "Battle Roar", c: { timers: timersFor("battleRoar") }, combat: {}, foe: {} },
  { label: "mirror", c: { mirror: 3 }, combat: {}, foe: {} },
  { label: "blind foe", c: {}, combat: {}, foe: { blind: true } },
  { label: "foeToHitPenalty 3", c: {}, combat: { foeToHitPenalty: 3 }, foe: {} },
  { label: "insulted", c: {}, combat: { parleyInsulted: true }, foe: {} },
  { label: "Smoke + insulted", c: { timers: timersFor("smoke") }, combat: { parleyInsulted: true }, foe: {} },
  { label: "blind + insulted", c: {}, combat: { parleyInsulted: true }, foe: { blind: true } },
];

for (const hero of FOE_HEROES) {
  for (const mc of FOE_MOD_CASES) {
    const label = `foeTurn equivalence: ${hero.label} — ${mc.label}`;
    test(label, () => {
      const state = fixedState({ c: { ...hero.c, ...mc.c } });
      const foe = fixedFoe({ ...mc.foe });
      state.combat = fixedCombat([foe], { ...mc.combat });
      const { faces: expectedFaces, mods: expectedMods } = foeSwingVsHero(state, foe);
      const expectedAtLeast = atLeastFor(expectedFaces, DIE_N);
      const events = foeTurn(state, fakeRng([DIE_N]), []);
      const missed = events.find((e) => e.type === "foeMissed");
      assert.ok(missed, label);
      assert.equal(missed.dieN, DIE_N, label);
      assert.equal(missed.atLeast, expectedAtLeast, label);
      assert.deepEqual(missed.mods || [], expectedMods, label);
    });
  }
}

// A pursuit strike (a sp.pursues foe on a successful flee) matches the same
// way — a subset of the modifier matrix, reached via flee() since
// pursuitStrike is module-private (test/unit/parley.test.js's own
// pursuit-insult probe uses the identical route). The flee roll's raw draw
// (20, max) always succeeds regardless of any hero's flee bonus.
const PURSUIT_MOD_CASES = [
  { label: "plain", c: {}, combat: {}, foe: {} },
  { label: "blind foe", c: {}, combat: {}, foe: { blind: true } },
  { label: "foeToHitPenalty 3", c: {}, combat: { foeToHitPenalty: 3 }, foe: {} },
  { label: "insulted", c: {}, combat: { parleyInsulted: true }, foe: {} },
  { label: "blind + insulted", c: {}, combat: { parleyInsulted: true }, foe: { blind: true } },
];

for (const hero of FOE_HEROES) {
  for (const mc of PURSUIT_MOD_CASES) {
    const label = `pursuit equivalence: ${hero.label} — ${mc.label}`;
    test(label, () => {
      const state = fixedState({ c: { ...hero.c, ...mc.c } });
      const foe = fixedFoe({ sp: { pursues: true }, ...mc.foe });
      state.combat = fixedCombat([foe], { ...mc.combat });
      const { faces: expectedFaces, mods: expectedMods } = foeSwingVsHero(state, foe);
      const expectedAtLeast = atLeastFor(expectedFaces, DIE_N);
      const events = flee(state, fakeRng([20, DIE_N]), []);
      const missed = events.find((e) => e.type === "foeMissed");
      assert.ok(missed, label);
      assert.equal(missed.dieN, DIE_N, label);
      assert.equal(missed.atLeast, expectedAtLeast, label);
      assert.deepEqual(missed.mods || [], expectedMods, label);
    });
  }
}
