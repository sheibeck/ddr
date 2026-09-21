// test/unit/combat-scaling.test.js
//
// Phase 54 (BAND-02, 2026-09-21, USER RULING D) — the GLOBAL DIFFICULTY
// MODEL rewrite of every combat-scaling wiring test: foe level from DEPTH
// (never the hero's level), the count table (canon draw shape, no
// level-keyed cap), the whole-hit FOE_HIT_SCALE at the three damage sites,
// and the ROUND_DAMAGE_CEILING per-visit budget. History (Phase 21/27's
// identity-band/combat-dial pins) lives in docs/DIFFICULTY-RETUNE.md, not
// here.
//
// fakeRng/countingRng are copied locally (never imported from another test
// file) per this repo's established per-file-fixture convention. Every
// literal below is pasted from `node -e` output against the landed engine —
// never hand-computed.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import {
  DIALS,
  difficultyCurve,
  foeLevelFor,
  FOE_COUNT_TABLE,
  foeCountFor,
  foeWpFor,
  foeHitFor,
  roundDamageCapFor,
  tierSpreadFor,
  scaleHazard,
  abilityCadenceFor,
  setDialsForTuning,
} from "../../engine/difficulty.js";
import { startCombat, fight, foeTurn } from "../../engine/combat.js";
import { tickAbilityCooldowns, firstReadyAbility } from "../../engine/foeAbilities.js";
import { BESTIARY, FOE_ABILITIES } from "../../content/index.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

// --- local test fixtures (mirror test/unit/foe-turn-draw-count.test.js) ----

/** fakeRng(seq) — `.d()` pops the next value regardless of side count; throws
 * on underflow, which doubles as a "no more rng draws expected" assertion. */
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

/** countingRng(inner) — wraps any rng object and counts every draw-producing
 * call: d()/pick()/next() count as 1, shuffle(arr) counts max(0, len-1). */
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

function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
    maxWP: 55, wp: 55, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 1, rations: 6, gold: 50, scrolls: 0,
    affliction: null, joiner: null,
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
    day: 1, steps: 0, combat: null, store: null, beats: null, party: [],
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

// --- DIALS pins used by combat wiring ---------------------------------------

test("DIALS pins used by combat wiring are at their identity values (docs/DIFFICULTY-RETUNE.md's dial table)", () => {
  assert.deepStrictEqual(DIALS.FOE_LEVEL, { base: 0.6, perDepth: 0.2 });
  assert.equal(DIALS.TIER_SPREAD, 1);
  assert.deepStrictEqual(DIALS.FOE_HIT_SCALE, { base: 1, perDepth: 0 });
  assert.deepStrictEqual(DIALS.FOE_HP_SCALE, { base: 1, perDepth: 0 });
  assert.equal(DIALS.FOE_COUNT_SKEW, 0);
  assert.equal(DIALS.ROUND_DAMAGE_CEILING, 0);
});

// --- wiring at depth 1 (identity: foeLevelFor(1) === 1, no bleed possible) --

test("wiring at depth 1: every foe built by startCombat has lvl === foeLevelFor(1) (1, floor-clamped either way the bleed rolls), wp === row.wp, NO dmgBonus key", () => {
  const state = fixedState({ c: { level: 5 }, floor: { depth: 1 } });
  // count: 3 (>2), 3 (second roll) -> FOE_COUNT_TABLE[0][2] = 2 foes; then 2 bleed rolls
  const rng = fakeRng([3, 3, 2, 2]);
  startCombat(state, false, "Beasts", rng, []);
  assert.equal(state.combat.foes.length, 2);
  for (const f of state.combat.foes) {
    assert.equal(f.lvl, foeLevelFor(1));
    assert.equal(f.wp, BESTIARY.Beasts[f.lvl - 1][0].wp);
    assert.equal(f.maxWP, f.wp);
    assert.equal("dmgBonus" in f, false, "dmgBonus is retired — no consumer should ever see this key again");
  }
});

// --- wiring at depth 5 / 20: lvl keys to depth, never the hero's level -----

test("wiring at depth 5 / 20: lvl === curve.foeLevel or curve.foeLevel - 1 (the tier bleed); wp === foeWpFor(row.wp, curve); hero level never affects the roster", () => {
  for (const depth of [5, 20]) {
    const curve = difficultyCurve(depth);
    // A level-1 hero and a level-5 hero at the SAME depth must build the
    // IDENTICAL roster (USER RULING D: foe level keys to depth, not level).
    for (const heroLevel of [1, 5]) {
      const state = fixedState({ c: { level: heroLevel }, floor: { depth } });
      const rng = fakeRng([3, 3, 2, 2]);
      startCombat(state, false, "Beasts", rng, []);
      assert.equal(state.combat.foes.length, 2);
      for (const f of state.combat.foes) {
        assert.ok(f.lvl === curve.foeLevel || f.lvl === curve.foeLevel - 1, `depth ${depth}: lvl ${f.lvl} must be curve.foeLevel (${curve.foeLevel}) or one lower`);
        assert.equal(f.wp, foeWpFor(BESTIARY.Beasts[f.lvl - 1][0].wp, curve));
        assert.equal("dmgBonus" in f, false);
      }
    }
  }
});

// --- the level-keyed cap is gone --------------------------------------------

test("the level-keyed foe-count cap is gone: a level-1 hero whose count rolls (r1 > 2, r2 = 4) faces 3 foes (was capped at 2 pre-Phase-54)", () => {
  const state = fixedState({ c: { level: 1 }, floor: { depth: 1 } });
  const rng = fakeRng([3, 4, 2, 2, 2]);
  startCombat(state, false, "Beasts", rng, []);
  assert.equal(state.combat.foes.length, 3);
});

test("FOE_COUNT_TABLE row 0 (identity, FOE_COUNT_SKEW 0) reproduces the canon draw shape exactly", () => {
  assert.deepStrictEqual(FOE_COUNT_TABLE[0], [2, 2, 2, 3]);
  assert.equal(foeCountFor(1, () => { throw new Error("must not draw a second d4"); }), 1);
  assert.equal(foeCountFor(2, () => { throw new Error("must not draw a second d4"); }), 1);
  assert.equal(foeCountFor(3, () => 1), 2);
  assert.equal(foeCountFor(3, () => 4), 3);
});

// --- draw-shape equality: the count roll keeps the canon draw shape --------

test("draw-shape equality: startCombat+fight draws 8 at depth 1 and at depth 20 (measured; the count roll draws 1 or 2 d4 exactly as canon)", () => {
  const seq = [3, 3, 2, 2, 2, 2, 2, 10, 5];
  const state1 = fixedState({ c: { level: 5 }, floor: { depth: 1 } });
  const rng1 = countingRng(fakeRng(seq));
  startCombat(state1, false, "Beasts", rng1, []);
  fight(state1, rng1, []);
  assert.equal(rng1.draws, 8);

  const state20 = fixedState({ c: { level: 5 }, floor: { depth: 20 } });
  const rng20 = countingRng(fakeRng(seq));
  startCombat(state20, false, "Beasts", rng20, []);
  fight(state20, rng20, []);
  assert.equal(rng20.draws, 8);
});

test("wandering encounters still draw no count dice", () => {
  for (const depth of [1, 20]) {
    const state = fixedState({ c: { level: 5 }, floor: { depth } });
    const rng = countingRng(fakeRng([2, 10, 5]));
    startCombat(state, true, "Beasts", rng, []);
    fight(state, rng, []);
    assert.equal(state.combat.foes.length, 1);
    assert.equal(rng.draws, 1 + 1 + 2);
  }
});

// --- foeHitFor: the WHOLE hit is scaled, including the crit ----------------

test("foeHitFor is applied to the whole hit including the crit (synthetic curve foeHitScale 0.5): a 25 + 2x6 = 37 Herman-style crit lands as 19 before the pipeline", () => {
  assert.equal(foeHitFor(25 + 2 * 6, { foeHitScale: 0.5 }), 19);
  assert.equal(Object.is(foeHitFor(37, { foeHitScale: 1 }), 37), true, "identity fast path returns the raw value by identity");
});

test("dmgBonus is retired: a hero-side foeTurn swing's damage is exactly foeHitFor(foeLevelBase(f) + dice, curve) with no flat bonus term", () => {
  const foe1 = fixedFoe({ type: "Beasts", lvl: 1 });
  const state1 = fixedState({ combat: { foes: [foe1], type: "Beasts", round: 1, target: 0, spellOpen: false, tracked: false } });
  const rng1 = countingRng(fakeRng([3, 4]));
  const events1 = foeTurn(state1, rng1, []);
  const struck1 = events1.find((e) => e.type === "struckByFoe");
  assert.ok(struck1);
  assert.equal(struck1.roll, 3);
  assert.equal(struck1.dmg, 1 * 1 + 4, "foeLevelBase(1) + dice, no dmgBonus term (identity FOE_HIT_SCALE)");
  assert.equal(state1.c.wp, 55 - struck1.dmg);
  assert.equal(rng1.draws, 2);
});

// --- ROUND_DAMAGE_CEILING: a per-visit budget, identity (0) is a no-op -----

test("roundDamageCapFor: Infinity at identity (0, off) — every cliff hits exactly as hard as canon until this dial is released", () => {
  assert.equal(roundDamageCapFor(1), Infinity);
});

test("round-damage ceiling: with ROUND_DAMAGE_CEILING 0.5 a three-swing foe's visit total is clamped to roundDamageCapFor(1) (21) at level 1 — restored after", () => {
  const restore = setDialsForTuning({ ROUND_DAMAGE_CEILING: 0.5 });
  try {
    assert.equal(roundDamageCapFor(1), 21);
    const foe = fixedFoe({ lvl: 1, wp: 1000, maxWP: 1000, sp: { atk: 3, dmg: { n: 1, sides: 1, bonus: 30 } } });
    const state = fixedState({ c: { level: 1, maxWP: 200, wp: 200 }, combat: { foes: [foe], type: "Beasts", round: 1, target: 0, spellOpen: false, tracked: false } });
    const rng = fakeRng([5, 5, 5, 5, 5, 5]); // 3 swings x (toHitRoll, dmgDiceRoll)
    const events = foeTurn(state, rng, []);
    const totalDealt = events.filter((e) => e.type === "struckByFoe").reduce((sum, e) => sum + e.dmg, 0);
    assert.ok(totalDealt <= 21, `visit total ${totalDealt} must stay <= the level-1 cap (21)`);
    assert.equal(state.c.wp, 200 - totalDealt);
  } finally {
    restore();
  }
});

// --- pursuitStrike uses the same helper -------------------------------------

test("pursuitStrike uses foeHitFor + roundDamageCapFor exactly like foeTurn's hero swing", () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, "engine/combat.js"), "utf8");
  const pursuitStrikeBody = src.slice(src.indexOf("function pursuitStrike"), src.indexOf("\n}\n", src.indexOf("function pursuitStrike")));
  assert.ok(pursuitStrikeBody.includes("foeHitFor("), "pursuitStrike must scale its hit through foeHitFor");
  assert.ok(pursuitStrikeBody.includes("roundDamageCapFor("), "pursuitStrike must apply its own ROUND_DAMAGE_CEILING budget");
});

// --- synthetic-curve helper pins ---------------------------------------------

test("synthetic-curve helper pins", () => {
  assert.equal(foeWpFor(10, { foeHpScale: 1.6 }), 16);
  assert.equal(foeWpFor(7, { foeHpScale: 1.5 }), 11);
  for (const tier of Object.values(BESTIARY)) {
    for (const roster of tier) {
      for (const row of roster) {
        assert.ok(Number.isInteger(row.wp), `BESTIARY row ${row.n} has a non-integer wp`);
        assert.equal(foeWpFor(row.wp, { foeHpScale: 1 }), row.wp, `BESTIARY row ${row.n}: foeWpFor identity failed`);
      }
    }
  }

  assert.deepStrictEqual(abilityCadenceFor({ every: 2, uses: 4 }, { abilityThreat: 2 }), { every: 1, uses: 8 });
  const t15 = abilityCadenceFor({ every: 3 }, { abilityThreat: 1.5 });
  assert.equal(t15.every, 2);
  assert.equal(t15.uses, undefined);
  assert.equal(abilityCadenceFor({ every: 1 }, { abilityThreat: 4 }).every, 1);
  for (const a of FOE_ABILITIES) {
    assert.deepStrictEqual(abilityCadenceFor(a, { abilityThreat: 1 }), { every: a.every, uses: a.uses });
  }

  assert.equal(foeWpFor(1, { foeHpScale: 0.75 }), 1, "foeWpFor must never round a scaled low-wp foe to 0");
  assert.equal(foeWpFor(16, { foeHpScale: 0.75 }), 12);
  assert.equal(scaleHazard(3, { hazardScale: 0.5 }), 2);
  assert.equal(scaleHazard(1, { hazardScale: 0.5 }), 1, "scaleHazard must never round a positive amount down to 0");
  assert.equal(scaleHazard(0, { hazardScale: 0.5 }), 0);
  assert.equal(scaleHazard(7, { hazardScale: 1 }), 7, "hazardScale === 1 is the identity fast path");
});

// --- kept: tickAbilityCooldowns / abilityCadenceFor identity at abilityThreat 1

test("D-18: tickAbilityCooldowns(state, f) lazily inits from the cadence and counts down; identity at depth 1 (abilityThreat 1)", () => {
  assert.equal(tickAbilityCooldowns.length, 2);

  const state = fixedState({ floor: { depth: 1 }, combat: { foes: [], type: "Beasts", round: 1, target: 0, spellOpen: false, tracked: false } });
  const f = fixedFoe({ abilities: ["drudgeFireball"] });
  tickAbilityCooldowns(state, f);
  assert.equal(f.cd.drudgeFireball, 1);
  assert.equal(firstReadyAbility(state, f), null);
  tickAbilityCooldowns(state, f);
  assert.equal(f.cd.drudgeFireball, 0);
  assert.equal(firstReadyAbility(state, f).id, "drudgeFireball");

  const g = fixedFoe({ abilities: ["djinniFreeze"] });
  assert.equal(firstReadyAbility(state, g).id, "djinniFreeze");
  g.uses = { djinniFreeze: 0 };
  assert.equal(firstReadyAbility(state, g), null);
});

test("the D-15 / FID-02 contract is untouched by this plan's wiring changes", () => {
  const detFile = fs.readFileSync(path.join(REPO_ROOT, "test/determinism/foe-abilities.test.js"), "utf8");
  const drawCountFile = fs.readFileSync(path.join(REPO_ROOT, "test/unit/foe-turn-draw-count.test.js"), "utf8");
  assert.ok(!detFile.includes("Phase 21"));
  assert.ok(!drawCountFile.includes("Phase 21"));
});

// --- caps: foeLevelFor never exceeds 5; tierSpreadFor is a single dial -----

test("foeLevelFor never exceeds its [1,5] clamp at absurd depth; tierSpreadFor() reads live.TIER_SPREAD", () => {
  for (const depth of [30, 50, 100, 1000, 10000]) {
    const lvl = foeLevelFor(depth);
    assert.ok(lvl >= 1 && lvl <= 5, `depth ${depth}: foeLevelFor out of bounds (${lvl})`);
  }
  assert.equal(tierSpreadFor(), 1);
});

test("startCombat at depth 1000 stays bounded: foe.lvl in [1,5], wp === foeWpFor(row.wp, curve), no dmgBonus key", () => {
  const curve = difficultyCurve(1000);
  const state = fixedState({ c: { level: 5 }, floor: { depth: 1000 } });
  const seq = [3, 3, 2, 2, 2, 2, 2, 2, 2, 2];
  const rng = fakeRng(seq);
  startCombat(state, false, "Beasts", rng, []);
  for (const f of state.combat.foes) {
    assert.ok(f.lvl >= 1 && f.lvl <= 5, `foe level ${f.lvl} must stay in [1,5]`);
    assert.equal(f.wp, foeWpFor(BESTIARY.Beasts[f.lvl - 1][0].wp, curve));
    assert.equal("dmgBonus" in f, false);
  }
});
