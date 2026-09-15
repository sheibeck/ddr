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
  FOE_GRACE_AT_1,
  FOE_GRACE_AT_2,
  FOE_GRACE_CANON_FROM_DEPTH,
  HAZARD_FROM_DEPTH,
  HAZARD_SCALE_AT_START,
  HAZARD_FLAT_THROUGH_DEPTH,
  HAZARD_CANON_FROM_DEPTH,
  foeCountFor,
  foeWpFor,
  foeDmgBonusFor,
  scaleHazard,
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

// PHASE_27_PINS — the ONE place the Phase 27 dials are pinned (2026-09-15,
// TUNE-06). 27-03 edits ONLY these numbers per iteration; values recorded in
// docs/DIFFICULTY-RETUNE.md's v1.2 change table.
const PHASE_27_PINS = {
  COMBAT_SCALE_FROM_DEPTH: 6,
  FOE_CAP_BASE: 3,
  FOE_CAP_MAX: 5,
  FOE_CAP_SOFT_K: 20,
  FOE_POWER_BASE: 1,
  FOE_POWER_MAX: 1.6,
  FOE_POWER_SOFT_K: 35,
  ABILITY_THREAT_BASE: 1,
  ABILITY_THREAT_MAX: 2.0,
  ABILITY_THREAT_SOFT_K: 30,
  FOE_LVL_BIAS: 0,
  FOE_GRACE_AT_1: 1,
  FOE_GRACE_AT_2: 0.75,
  FOE_GRACE_CANON_FROM_DEPTH: 5,
  HAZARD_FROM_DEPTH: 2,
  HAZARD_SCALE_AT_START: 0.5,
  HAZARD_FLAT_THROUGH_DEPTH: 3,
  HAZARD_CANON_FROM_DEPTH: 5,
};

// NON_COMBAT_PINS — depths 1-5's dots/darkBlobs/darkRadius after Phase 27's
// early-floor easing (floors 1-2 canon by construction; floors 3-5 eased).
const NON_COMBAT_PINS = {
  1: { dots: 10, darkBlobs: 0, darkRadius: 4 },
  2: { dots: 11, darkBlobs: 1, darkRadius: 5 },
  3: { dots: 11, darkBlobs: 1, darkRadius: 6 },
  4: { dots: 12, darkBlobs: 2, darkRadius: 7 },
  5: { dots: 12, darkBlobs: 3, darkRadius: 7 },
};

test("Phase 27 retune pins match engine/difficulty.js — recorded in docs/DIFFICULTY-RETUNE.md", () => {
  assert.equal(COMBAT_SCALE_FROM_DEPTH, PHASE_27_PINS.COMBAT_SCALE_FROM_DEPTH);
  assert.equal(FOE_CAP_BASE, PHASE_27_PINS.FOE_CAP_BASE);
  assert.equal(FOE_CAP_MAX, PHASE_27_PINS.FOE_CAP_MAX);
  assert.equal(FOE_CAP_SOFT_K, PHASE_27_PINS.FOE_CAP_SOFT_K);
  assert.equal(FOE_POWER_BASE, PHASE_27_PINS.FOE_POWER_BASE);
  assert.equal(FOE_POWER_MAX, PHASE_27_PINS.FOE_POWER_MAX);
  assert.equal(FOE_POWER_SOFT_K, PHASE_27_PINS.FOE_POWER_SOFT_K);
  assert.equal(ABILITY_THREAT_BASE, PHASE_27_PINS.ABILITY_THREAT_BASE);
  assert.equal(ABILITY_THREAT_MAX, PHASE_27_PINS.ABILITY_THREAT_MAX);
  assert.equal(ABILITY_THREAT_SOFT_K, PHASE_27_PINS.ABILITY_THREAT_SOFT_K);
  assert.equal(FOE_LVL_BIAS, PHASE_27_PINS.FOE_LVL_BIAS);
  assert.equal(FOE_GRACE_AT_1, PHASE_27_PINS.FOE_GRACE_AT_1);
  assert.equal(FOE_GRACE_AT_2, PHASE_27_PINS.FOE_GRACE_AT_2);
  assert.equal(FOE_GRACE_CANON_FROM_DEPTH, PHASE_27_PINS.FOE_GRACE_CANON_FROM_DEPTH);
  assert.equal(HAZARD_FROM_DEPTH, PHASE_27_PINS.HAZARD_FROM_DEPTH);
  assert.equal(HAZARD_SCALE_AT_START, PHASE_27_PINS.HAZARD_SCALE_AT_START);
  assert.equal(HAZARD_FLAT_THROUGH_DEPTH, PHASE_27_PINS.HAZARD_FLAT_THROUGH_DEPTH);
  assert.equal(HAZARD_CANON_FROM_DEPTH, PHASE_27_PINS.HAZARD_CANON_FROM_DEPTH);
});

test("floor 1 is exactly canon (D-19 / Phase 27): foePower, hazardScale, dots/blobs/radius, foeCap, abilityThreat", () => {
  const dc = difficultyCurve(1);
  // FOE_GRACE_AT_1 is pinned to 1 in Phase 27 — if a future escalation ever
  // moves it below 1.0 (the LAST RESORT rung), this assertion is the one
  // that must be updated to the declared floor-1 value, with a ledger note.
  assert.equal(FOE_GRACE_AT_1, 1, "FOE_GRACE_AT_1 must stay exactly 1 in this plan (27-02)");
  assert.ok(Object.is(dc.foePower, 1), "floor 1: foePower must be exactly 1");
  assert.ok(Object.is(dc.hazardScale, 1), "floor 1: hazardScale must be exactly 1");
  assert.equal(dc.foeCap, FOE_CAP_BASE);
  assert.equal(dc.foeBonus, 0);
  assert.ok(Object.is(dc.abilityThreat, 1), "floor 1: abilityThreat must be exactly 1");
  assert.equal(dc.dots, NON_COMBAT_PINS[1].dots);
  assert.equal(dc.darkBlobs, NON_COMBAT_PINS[1].darkBlobs);
  assert.equal(dc.darkRadius, NON_COMBAT_PINS[1].darkRadius);
});

test("grace band: depths 2..FOE_GRACE_CANON_FROM_DEPTH-1 carry the interpolated foePower and hazardScale formulas, never below FOE_GRACE_AT_2", () => {
  for (let d = 2; d < FOE_GRACE_CANON_FROM_DEPTH; d++) {
    const dc = difficultyCurve(d);
    const expectedPower = FOE_GRACE_AT_2 + (1 - FOE_GRACE_AT_2) * (d - 2) / (FOE_GRACE_CANON_FROM_DEPTH - 2);
    assert.ok(Math.abs(dc.foePower - expectedPower) < 1e-12, `depth ${d}: foePower ${dc.foePower} !~= ${expectedPower}`);
    assert.ok(dc.foePower >= FOE_GRACE_AT_2, `depth ${d}: foePower ${dc.foePower} below FOE_GRACE_AT_2`);

    const expectedHazard =
      d < HAZARD_FROM_DEPTH || d >= HAZARD_CANON_FROM_DEPTH
        ? 1
        : d <= HAZARD_FLAT_THROUGH_DEPTH
          ? HAZARD_SCALE_AT_START
          : HAZARD_SCALE_AT_START + (1 - HAZARD_SCALE_AT_START) * (d - HAZARD_FLAT_THROUGH_DEPTH) / (HAZARD_CANON_FROM_DEPTH - HAZARD_FLAT_THROUGH_DEPTH);
    assert.ok(Math.abs(dc.hazardScale - expectedHazard) < 1e-12, `depth ${d}: hazardScale ${dc.hazardScale} !~= ${expectedHazard}`);

    if (NON_COMBAT_PINS[d]) {
      assert.equal(dc.dots, NON_COMBAT_PINS[d].dots, `depth ${d}: dots`);
      assert.equal(dc.darkBlobs, NON_COMBAT_PINS[d].darkBlobs, `depth ${d}: darkBlobs`);
      assert.equal(dc.darkRadius, NON_COMBAT_PINS[d].darkRadius, `depth ${d}: darkRadius`);
    }
  }
});

test("identity band: depths FOE_GRACE_CANON_FROM_DEPTH..COMBAT_SCALE_FROM_DEPTH-1 carry foePower/abilityThreat/hazardScale exactly at identity, foeCap at FOE_CAP_BASE", () => {
  for (let d = FOE_GRACE_CANON_FROM_DEPTH; d < COMBAT_SCALE_FROM_DEPTH; d++) {
    const dc = difficultyCurve(d);
    assert.ok(Object.is(dc.foePower, 1), `depth ${d}: foePower must be exactly 1`);
    assert.ok(Object.is(dc.abilityThreat, 1), `depth ${d}: abilityThreat must be exactly 1`);
    assert.equal(dc.foeCap, FOE_CAP_BASE, `depth ${d}: foeCap must be FOE_CAP_BASE`);
    assert.ok(Object.is(dc.hazardScale, 1), `depth ${d}: hazardScale must be exactly 1`);
  }
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

test("monotone: foeCap and abilityThreat are non-decreasing across depths 1..200 including breather floors (no dip)", () => {
  let prevCap = -Infinity;
  let prevThreat = -Infinity;
  for (let depth = 1; depth <= 200; depth++) {
    const dc = difficultyCurve(depth);
    assert.ok(dc.foeCap >= prevCap, `depth ${depth}: foeCap regressed (${dc.foeCap} < ${prevCap})`);
    assert.ok(dc.abilityThreat >= prevThreat, `depth ${depth}: abilityThreat regressed (${dc.abilityThreat} < ${prevThreat})`);
    prevCap = dc.foeCap;
    prevThreat = dc.abilityThreat;
  }
});

// Phase 27 (2026-09-15, TUNE-06): foePower is monotone non-decreasing only
// from depth 2 on — floor 1 is the canon anchor the grace band deliberately
// dips UNDER by design (FOE_GRACE_AT_2 < FOE_GRACE_AT_1), so a depth-1-vs-2
// comparison is expected to regress; that is the grace, not a bug.
test("monotone from depth 2: foePower is non-decreasing across depths 2..200 (floor 1 is the canon anchor the grace dips under, by design); foeWpFor never rounds below 1", () => {
  let prevPower = -Infinity;
  for (let depth = 2; depth <= 200; depth++) {
    const dc = difficultyCurve(depth);
    assert.ok(dc.foePower >= prevPower, `depth ${depth}: foePower regressed (${dc.foePower} < ${prevPower})`);
    prevPower = dc.foePower;
  }
  assert.ok(difficultyCurve(1).foePower > difficultyCurve(2).foePower, "floor 1 (canon) must sit ABOVE the floor-2 grace dip");
  for (let baseWp = 1; baseWp <= 20; baseWp++) {
    assert.ok(foeWpFor(baseWp, { foePower: FOE_GRACE_AT_2 }) >= 1, `foeWpFor(${baseWp}, grace) rounded below 1`);
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

  // Phase 27 (2026-09-15, TUNE-06): foeWpFor/foeDmgBonusFor at a grace curve,
  // and scaleHazard at a hazard curve — every pin measured against the
  // functions themselves, never hand-computed.
  assert.equal(foeWpFor(1, { foePower: 0.75 }), 1, "foeWpFor must never round a graced low-wp foe to 0");
  assert.equal(foeWpFor(16, { foePower: 0.75 }), 12);
  assert.equal(foeDmgBonusFor(2, { foePower: 0.75 }), -1, "a graced foe carries a NEGATIVE dmgBonus");
  assert.equal(foeDmgBonusFor(1, { foePower: 0.75 }), 0);
  assert.equal(scaleHazard(3, { hazardScale: 0.5 }), 2);
  assert.equal(scaleHazard(1, { hazardScale: 0.5 }), 1, "scaleHazard must never round a positive amount down to 0");
  assert.equal(scaleHazard(0, { hazardScale: 0.5 }), 0);
  assert.equal(scaleHazard(7, { hazardScale: 1 }), 7, "hazardScale === 1 is the identity fast path");
});

test("startCombat at depth 2 / level 2 copies a NEGATIVE dmgBonus key on a lvl-2 foe and none on a lvl-1 foe; at depth 1 no foe carries the key", () => {
  const curve2 = difficultyCurve(2);
  assert.equal(curve2.foePower, FOE_GRACE_AT_2, "sanity: depth 2's foePower is the grace value");

  // Level-2 hero, depth 2: maxLvl = clamp(min(2,2),1,5) = 2; cap = 2 (level
  // <= 2). d4 draw 2 (<=2 -> canon count 1, short-circuits, no second d4
  // draw). Per-foe: d4=2 (!==1, lvl stays maxLvl=2), pick (default: first
  // roster entry, no draw). Then 2 initiative draws.
  const state2 = fixedState({ c: { level: 2 }, floor: { depth: 2 } });
  const rng2 = fakeRng([2, 2, 10, 5]);
  startCombat(state2, false, "Beasts", rng2, []);
  assert.equal(state2.combat.foes.length, 1);
  const f2 = state2.combat.foes[0];
  assert.equal(f2.lvl, 2);
  const expectedBonus2 = foeDmgBonusFor(2, curve2);
  assert.ok(expectedBonus2 < 0, "sanity: a lvl-2 foe at the grace curve carries a negative bonus");
  assert.equal(f2.dmgBonus, expectedBonus2);
  assert.equal(f2.wp, foeWpFor(BESTIARY.Beasts[1][0].wp, curve2));

  // Level-1 hero, depth 2: maxLvl = clamp(min(1,2),1,5) = 1 -> lvl 1 ->
  // foeDmgBonusFor(1, curve2) rounds to 0 (never carries the key).
  const state1 = fixedState({ c: { level: 1 }, floor: { depth: 2 } });
  const rng1 = fakeRng([2, 2, 10, 5]);
  startCombat(state1, false, "Beasts", rng1, []);
  const f1 = state1.combat.foes[0];
  assert.equal(f1.lvl, 1);
  assert.equal(foeDmgBonusFor(1, curve2), 0, "sanity: a lvl-1 foe's grace bonus rounds to 0");
  assert.equal("dmgBonus" in f1, false);

  // Depth 1: FOE_GRACE_AT_1 is exactly 1 — no foe ever carries the key.
  const stateD1 = fixedState({ c: { level: 5 }, floor: { depth: 1 } });
  const rngD1 = fakeRng([3, 3, 2, 2, 10, 5]);
  startCombat(stateD1, false, "Beasts", rngD1, []);
  for (const f of stateD1.combat.foes) assert.equal("dmgBonus" in f, false);
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

// --- Task 1 (21-04) tests ----------------------------------------------------

// Phase 27 (2026-09-15, TUNE-06): parametrised on COMBAT_SCALE_FROM_DEPTH —
// foeCap/foeBonus/foeLvlBias/abilityThreat stay at identity through
// COMBAT_SCALE_FROM_DEPTH-1 (foePower/hazardScale have their OWN bands,
// covered by the grace-band/identity-band tests above, since foePower now
// dips below 1 at depths 2..FOE_GRACE_CANON_FROM_DEPTH-1).
test("depth-6 first divergence (D-19), parametrised on COMBAT_SCALE_FROM_DEPTH: combat-dial identity ends exactly one depth before it", () => {
  for (let d = 1; d < COMBAT_SCALE_FROM_DEPTH; d++) {
    const dc = difficultyCurve(d);
    assert.equal(dc.foeCap, FOE_CAP_BASE, `depth ${d}: foeCap`);
    assert.equal(dc.foeBonus, 0, `depth ${d}: foeBonus`);
    assert.equal(dc.foeLvlBias, FOE_LVL_BIAS, `depth ${d}: foeLvlBias`);
    assert.ok(Object.is(dc.abilityThreat, 1), `depth ${d}: abilityThreat must be exactly 1`);
  }
  const dcLast = difficultyCurve(COMBAT_SCALE_FROM_DEPTH - 1);
  assert.equal(dcLast.foeCap, FOE_CAP_BASE);

  const dcFirst = difficultyCurve(COMBAT_SCALE_FROM_DEPTH);
  assert.ok(dcFirst.abilityThreat > 1, `depth ${COMBAT_SCALE_FROM_DEPTH}: abilityThreat must have left identity`);
});

test("the caps are reached: foeCap === FOE_CAP_MAX at some depth <= 100; foePower and abilityThreat are within 0.05 of their MAX at depth 200", () => {
  let reached = false;
  for (let d = 1; d <= 100; d++) {
    if (difficultyCurve(d).foeCap === FOE_CAP_MAX) {
      reached = true;
      break;
    }
  }
  assert.ok(reached, "foeCap never reaches FOE_CAP_MAX by depth 100");

  const dc200 = difficultyCurve(200);
  if (FOE_POWER_MAX > FOE_POWER_BASE) {
    assert.ok(
      Math.abs(dc200.foePower - FOE_POWER_MAX) <= 0.05,
      `foePower at depth 200 (${dc200.foePower}) not within 0.05 of MAX (${FOE_POWER_MAX})`,
    );
  }
  if (ABILITY_THREAT_MAX > ABILITY_THREAT_BASE) {
    assert.ok(
      Math.abs(dc200.abilityThreat - ABILITY_THREAT_MAX) <= 0.05,
      `abilityThreat at depth 200 (${dc200.abilityThreat}) not within 0.05 of MAX (${ABILITY_THREAT_MAX})`,
    );
  }
});

test("startCombat at depth 30 builds more than 3 foes when the canon roll is 3 and foeBonus >= 1", () => {
  const curve30 = difficultyCurve(30);
  const state = fixedState({ c: { level: 5 }, floor: { depth: 30 } });
  // d4=3 (>2, second roll needed), d4=4 (>3 -> canon count 3); then per-foe
  // lvl/pick draws, then 2 initiative draws. Sequence sized generously so
  // however many foes foeCountFor(3, curve30) produces, the run never
  // exhausts (fakeRng throws on underflow, which would fail the test loudly).
  const seq = [3, 4, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 10, 5];
  const rng = fakeRng(seq);
  startCombat(state, false, "Beasts", rng, []);

  const expectedCount = foeCountFor(3, curve30);
  assert.equal(state.combat.foes.length, expectedCount);
  if (curve30.foeBonus >= 1) {
    assert.ok(expectedCount > 3, `expected more than 3 foes at depth 30 when foeBonus (${curve30.foeBonus}) >= 1`);
  }
  for (const f of state.combat.foes) {
    assert.equal(f.wp, foeWpFor(BESTIARY.Beasts[f.lvl - 1][0].wp, curve30));
    const expectedBonus = foeDmgBonusFor(f.lvl, curve30);
    if (expectedBonus > 0) {
      assert.equal(f.dmgBonus, expectedBonus);
    } else {
      assert.equal("dmgBonus" in f, false);
    }
  }
});

