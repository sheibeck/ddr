// test/unit/combat-scaling.test.js
//
// Phase 21 (TUNE-01) — combat-scaling knobs: identity band, bounds,
// synthetic-curve helper pins, startCombat/foeTurn/foeAbilities wiring, and
// draw-shape equality. Every constant in engine/difficulty.js lands at its
// identity value in THIS plan (21-02) — the whole point is that this file's
// pins prove the wiring is inert everywhere until 21-04 retunes the dials.
//
// fakeRng/countingRng are copied locally (never imported from another test
// file) per this repo's established per-file-fixture convention.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import {
  difficultyCurve,
  isBreather,
  COMBAT_SCALE_FROM_DEPTH,
  FOE_CAP_BASE,
  FOE_CAP_MAX,
  FOE_CAP_SOFT_K,
  FOE_POWER_BASE,
  FOE_POWER_MAX,
  FOE_POWER_SOFT_K,
  ABILITY_THREAT_BASE,
  ABILITY_THREAT_MAX,
  ABILITY_THREAT_SOFT_K,
  FOE_LVL_BIAS,
  foeCountFor,
  foeWpFor,
  foeDmgBonusFor,
  abilityCadenceFor,
} from "../../engine/difficulty.js";
import { startCombat, foeTurn } from "../../engine/combat.js";
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
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    darkFor: 0, flightLeft: 0, flightCooldown: 0,
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
    dead: false, won: false, deathNote: "", epitaph: "",
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

// --- Task 1 tests -----------------------------------------------------------

test("D-19 identity: difficultyCurve(1..5) deep-equals the exact pre-Phase-21 object plus the identity fields", () => {
  for (let d = 1; d <= 5; d++) {
    const dc = difficultyCurve(d);
    assert.deepStrictEqual(dc, {
      depth: d,
      breather: false,
      dots: 9 + d,
      darkBlobs: d - 1,
      darkRadius: 3 + d,
      foeCap: 3,
      foeBonus: 0,
      foeLvlBias: 0,
      foePower: 1,
      abilityThreat: 1,
    });
    assert.ok(Object.is(dc.foePower, 1), `depth ${d}: foePower must be exactly 1, never 0.999...`);
    assert.ok(Object.is(dc.abilityThreat, 1), `depth ${d}: abilityThreat must be exactly 1, never 0.999...`);
  }
});

test("21-02 constants are identity (MAX === BASE) — the retune (21-04) is the only thing allowed to move them", () => {
  // 21-04 rewrites the three MAX pins (FOE_CAP_MAX/FOE_POWER_MAX/ABILITY_THREAT_MAX)
  // to the retuned values and re-records them in docs/DIFFICULTY-RETUNE.md.
  assert.equal(COMBAT_SCALE_FROM_DEPTH, 6);
  assert.equal(FOE_CAP_BASE, 3);
  assert.equal(FOE_CAP_MAX, 3);
  assert.equal(FOE_CAP_SOFT_K, 20);
  assert.equal(FOE_POWER_BASE, 1);
  assert.equal(FOE_POWER_MAX, 1);
  assert.equal(FOE_POWER_SOFT_K, 25);
  assert.equal(ABILITY_THREAT_BASE, 1);
  assert.equal(ABILITY_THREAT_MAX, 1);
  assert.equal(ABILITY_THREAT_SOFT_K, 20);
  assert.equal(FOE_LVL_BIAS, 0);
});

test("cap boundaries: every combat field stays within [BASE, MAX] at depths 6, 10, 20, 30, 50, 100, 1000; foeBonus === foeCap - FOE_CAP_BASE; foeLvlBias === FOE_LVL_BIAS", () => {
  for (const depth of [6, 10, 20, 30, 50, 100, 1000]) {
    const dc = difficultyCurve(depth);
    assert.ok(dc.foeCap >= FOE_CAP_BASE && dc.foeCap <= FOE_CAP_MAX, `depth ${depth}: foeCap out of bounds`);
    assert.ok(dc.foePower >= FOE_POWER_BASE && dc.foePower <= FOE_POWER_MAX, `depth ${depth}: foePower out of bounds`);
    assert.ok(
      dc.abilityThreat >= ABILITY_THREAT_BASE && dc.abilityThreat <= ABILITY_THREAT_MAX,
      `depth ${depth}: abilityThreat out of bounds`,
    );
    assert.equal(dc.foeBonus, dc.foeCap - FOE_CAP_BASE, `depth ${depth}: foeBonus mismatch`);
    assert.equal(dc.foeLvlBias, FOE_LVL_BIAS, `depth ${depth}: foeLvlBias mismatch`);
  }
});

test("monotone: foeCap, foePower, abilityThreat are non-decreasing across depths 1..200 including breather floors (no dip)", () => {
  let prevCap = -Infinity;
  let prevPower = -Infinity;
  let prevThreat = -Infinity;
  for (let depth = 1; depth <= 200; depth++) {
    const dc = difficultyCurve(depth);
    assert.ok(dc.foeCap >= prevCap, `depth ${depth}: foeCap regressed (${dc.foeCap} < ${prevCap})`);
    assert.ok(dc.foePower >= prevPower, `depth ${depth}: foePower regressed (${dc.foePower} < ${prevPower})`);
    assert.ok(dc.abilityThreat >= prevThreat, `depth ${depth}: abilityThreat regressed (${dc.abilityThreat} < ${prevThreat})`);
    prevCap = dc.foeCap;
    prevPower = dc.foePower;
    prevThreat = dc.abilityThreat;
  }
});

test("non-finite depth tolerance: for [0, -3, 1.5, NaN, Infinity, -Infinity] every new field is finite and equals its depth-1 identity value", () => {
  const identity = difficultyCurve(1);
  for (const depth of [0, -3, 1.5, NaN, Infinity, -Infinity]) {
    const dc = difficultyCurve(depth);
    for (const key of ["foeCap", "foeBonus", "foeLvlBias", "foePower", "abilityThreat"]) {
      assert.ok(Number.isFinite(dc[key]), `depth input ${depth}: field "${key}" is not finite (got ${dc[key]})`);
      assert.equal(dc[key], identity[key], `depth input ${depth}: field "${key}" should equal its depth-1 identity value`);
    }
  }
});

test("synthetic-curve helper pins", () => {
  // foeCountFor
  assert.equal(foeCountFor(3, { foeCap: 5, foeBonus: 2 }), 5);
  assert.equal(foeCountFor(1, { foeCap: 5, foeBonus: 2 }), 3);
  assert.equal(foeCountFor(2, { foeCap: 4, foeBonus: 1 }), 3);
  for (let k = 1; k <= 3; k++) assert.equal(foeCountFor(k, { foeCap: 3, foeBonus: 0 }), k);

  // foeWpFor
  assert.equal(foeWpFor(10, { foePower: 1.6 }), 16);
  assert.equal(foeWpFor(7, { foePower: 1.5 }), 11);
  for (const tier of Object.values(BESTIARY)) {
    for (const roster of tier) {
      for (const row of roster) {
        assert.ok(Number.isInteger(row.wp), `BESTIARY row ${row.n} has a non-integer wp`);
        assert.equal(foeWpFor(row.wp, { foePower: 1 }), row.wp, `BESTIARY row ${row.n}: foeWpFor identity failed`);
      }
    }
  }

  // foeDmgBonusFor
  assert.equal(foeDmgBonusFor(5, { foePower: 1.6 }), 15);
  assert.equal(foeDmgBonusFor(1, { foePower: 1.6 }), 1);
  assert.equal(foeDmgBonusFor(3, { foePower: 1 }), 0);

  // abilityCadenceFor
  assert.deepStrictEqual(abilityCadenceFor({ every: 2, uses: 4 }, { abilityThreat: 2 }), { every: 1, uses: 8 });
  const t15 = abilityCadenceFor({ every: 3 }, { abilityThreat: 1.5 });
  assert.equal(t15.every, 2);
  assert.equal(t15.uses, undefined);
  assert.equal(abilityCadenceFor({ every: 1 }, { abilityThreat: 4 }).every, 1);
  for (const a of FOE_ABILITIES) {
    assert.deepStrictEqual(abilityCadenceFor(a, { abilityThreat: 1 }), { every: a.every, uses: a.uses });
  }
});

// --- Task 2 tests -----------------------------------------------------------

test("D-19 wiring identity: at depth 1..5 every foe built by startCombat has wp === maxWP === the roster row's wp and NO dmgBonus key", () => {
  for (const depth of [1, 5]) {
    const state = fixedState({ c: { level: 5 }, floor: { depth } });
    const rng = fakeRng([3, 3, 2, 2, 10, 5]);
    startCombat(state, false, "Beasts", rng, []);
    assert.equal(state.combat.foes.length, 2);
    for (const f of state.combat.foes) {
      assert.equal(f.wp, BESTIARY.Beasts[f.lvl - 1][0].wp);
      assert.equal(f.maxWP, f.wp);
      assert.equal("dmgBonus" in f, false);
    }
  }
});

test("draw-shape equality (D-17/D-19): startCombat draws 8 at depth 1 and at depth 5, and 2 + foeCountFor(2, difficultyCurve(30)) * 2 + 2 at depth 30", () => {
  const seq = [3, 3, 2, 2, 2, 2, 2, 10, 5];
  const state1 = fixedState({ c: { level: 5 }, floor: { depth: 1 } });
  const rng1 = countingRng(fakeRng(seq));
  startCombat(state1, false, "Beasts", rng1, []);
  const draws1 = rng1.draws;

  const state5 = fixedState({ c: { level: 5 }, floor: { depth: 5 } });
  const rng5 = countingRng(fakeRng(seq));
  startCombat(state5, false, "Beasts", rng5, []);
  const draws5 = rng5.draws;

  const state30 = fixedState({ c: { level: 5 }, floor: { depth: 30 } });
  const rng30 = countingRng(fakeRng(seq));
  startCombat(state30, false, "Beasts", rng30, []);
  const draws30 = rng30.draws;

  assert.equal(draws1, 8);
  assert.equal(draws5, 8);
  assert.equal(draws30, 2 + foeCountFor(2, difficultyCurve(30)) * 2 + 2);

  const curve30 = difficultyCurve(30);
  for (const f of state30.combat.foes) {
    assert.equal(f.wp, foeWpFor(BESTIARY.Beasts[f.lvl - 1][0].wp, curve30));
    assert.equal("dmgBonus" in f, foeDmgBonusFor(f.lvl, curve30) > 0);
  }
});

test("wandering encounters still draw no count dice", () => {
  for (const depth of [1, 30]) {
    const state = fixedState({ c: { level: 5 }, floor: { depth } });
    const rng = countingRng(fakeRng([2, 10, 5]));
    startCombat(state, true, "Beasts", rng, []);
    assert.equal(state.combat.foes.length, 1);
    assert.equal(rng.draws, 1 + 1 + 2);
  }
});

test("dmgBonus is post-draw arithmetic on the hero swing", () => {
  const foe1 = fixedFoe({ type: "Beasts", lvl: 1 });
  const state1 = fixedState({ combat: { foes: [foe1], type: "Beasts", round: 1, target: 0, spellOpen: false, tracked: false } });
  const rng1 = countingRng(fakeRng([3, 4]));
  const events1 = foeTurn(state1, rng1, []);
  const struck1 = events1.find((e) => e.type === "struckByFoe");
  assert.ok(struck1);
  assert.equal(struck1.roll, 3);
  assert.equal(struck1.dmg, 5);
  assert.equal(state1.c.wp, 50);
  assert.equal(rng1.draws, 2);

  const foe2 = fixedFoe({ type: "Beasts", lvl: 1, dmgBonus: 5 });
  const state2 = fixedState({ combat: { foes: [foe2], type: "Beasts", round: 1, target: 0, spellOpen: false, tracked: false } });
  const rng2 = countingRng(fakeRng([3, 4]));
  const events2 = foeTurn(state2, rng2, []);
  const struck2 = events2.find((e) => e.type === "struckByFoe");
  assert.ok(struck2);
  assert.equal(struck2.dmg, 10);
  assert.equal(state2.c.wp, 45);
  assert.equal(rng2.draws, 2);
});

test("D-18: tickAbilityCooldowns(state, f) lazily inits from the cadence and counts down; identity at depth 5", () => {
  assert.equal(tickAbilityCooldowns.length, 2);

  const state = fixedState({ floor: { depth: 5 }, combat: { foes: [], type: "Beasts", round: 1, target: 0, spellOpen: false, tracked: false } });
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

test("the D-15 / FID-02 contract is untouched by Phase 21 wiring", () => {
  const detFile = fs.readFileSync(path.join(REPO_ROOT, "test/determinism/foe-abilities.test.js"), "utf8");
  const drawCountFile = fs.readFileSync(path.join(REPO_ROOT, "test/unit/foe-turn-draw-count.test.js"), "utf8");
  assert.ok(!detFile.includes("Phase 21"));
  assert.ok(!drawCountFile.includes("Phase 21"));
});
