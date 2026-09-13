// test/unit/foe-turn-draw-count.test.js
//
// FID-02's pinned RNG-draw baseline for foes WITHOUT an `abilities` field.
// That field does not exist anywhere in content/bestiary.js or on any
// state.combat.foes entry today (Phase 19 is the one that adds it). Phase 19
// must re-run this file UNCHANGED to prove its ability-attempt gate draws
// ZERO additional RNG for a foe that lacks `abilities` (or carries an empty
// `abilities: []`, which must behave identically to an absent field).
//
// WHY THIS FILE EXISTS (and the parity suite alone doesn't cover it):
// test/parity/harness/comparables.js's combatComparable/movementComparable/
// economyComparable all strip `rngState` out of the compared state before
// diffing against the frozen prototype (17-RESEARCH.md Pitfall 3) — an extra
// or missing draw only shows up INDIRECTLY, as a desynced value on some LATER
// roll. That is a real, load-bearing guard, but it is not a literal draw
// counter. This file counts draws directly, via a `countingRng(inner)`
// wrapper around the real `makeRng`/`fakeRng` objects, so a silently-added
// draw fails loudly and immediately, at the exact call site.
//
// PROVENANCE: the five full-fight totals below (Section 2) were measured
// against the PRE-Phase-17 foeTurn on 2026-09-13, before pickFoeTarget/
// applyFoeDamageToPlayer were extracted (17-02). Re-running them now, after
// the extraction, against this same counting wrapper and getting the
// identical totals is itself proof that 17-02's extraction is draw-for-draw
// identical to the inline code it replaced — this file is both the FID-02
// baseline AND a regression check on the 17-02 refactor.
//
// THE RULE: a mismatch here means engine/combat.js's draw order or count
// CHANGED — that is an ENGINE bug (or an intentional, escalated divergence
// with a stated rationale), never a reason to edit a pinned number in this
// file. See the plan's `prohibitions` — pins are measured, not adjusted.

import test from "node:test";
import assert from "node:assert/strict";

import { makeRng } from "../../engine/rng.js";
import { newRun } from "../../engine/engine.js";
import { startCombat, playerStrike, foeTurn } from "../../engine/combat.js";

// --- countingRng: the ONLY rng object the engine sees in every test below --

/**
 * countingRng(inner) — wraps ANY rng object (a fakeRng or a real makeRng)
 * and counts every draw-producing call: `d()`, `pick()`, `next()` each count
 * as 1 draw; `shuffle(arr)` counts `max(0, arr.length - 1)` draws, matching
 * engine/rng.js's Fisher-Yates loop exactly (it calls `next()` that many
 * times internally). Pass-through `getState`/`setState` when the inner
 * provides them, so a seeded fight's cursor can still be inspected/verified.
 */
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

// --- local test fixtures (mirror test/unit/party-combat.test.js verbatim) --

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

function fixedCombat(foes, overrides = {}) {
  return { foes, type: foes[0]?.type || "Beasts", round: 1, target: 0, spellOpen: false, tracked: false, ...overrides };
}

/** assertNoAbilities(foes) — the precondition every pin in this file depends
 * on: Phase 19 has not landed yet, so no foe anywhere carries `abilities`. */
function assertNoAbilities(foes) {
  for (const f of foes) {
    assert.equal(Object.hasOwn(f, "abilities"), false, `foe ${f.name} unexpectedly has an "abilities" field`);
  }
}

// --- Section 1: per-foeTurn micro pins (exact, via fakeRng) ----------------

test("countingRng self-test: counts shuffle as arr.length-1 draws and agrees with the mulberry32 cursor", () => {
  const start = 42;
  const rng = countingRng(makeRng(start));
  for (let i = 0; i < 137; i++) rng.d(20);
  rng.shuffle([1, 2, 3, 4, 5]);
  rng.pick(["a", "b"]);
  assert.equal(rng.draws, 142, "137 d() + 4 shuffle + 1 pick");
  assert.equal((start + Math.imul(rng.draws, 0x6d2b79f5)) | 0, rng.getState() | 0, "counter disagrees with the rng cursor");
});

test("FID-02 micro: asleep foe draws 0 rng", () => {
  const foe = fixedFoe({ asleep: 2 });
  assertNoAbilities([foe]);
  const state = fixedState({ combat: fixedCombat([foe]) });
  const rng = countingRng(fakeRng([]));
  const events = foeTurn(state, rng, []);
  assert.equal(rng.draws, 0);
  assert.deepEqual(events.map((e) => e.type), ["foeSlept"]);
});

test("FID-02 micro: one swing that misses draws 1 (to-hit only)", () => {
  const foe = fixedFoe();
  assertNoAbilities([foe]);
  const state = fixedState({ combat: fixedCombat([foe]) });
  const rng = countingRng(fakeRng([7]));
  const events = foeTurn(state, rng, []);
  assert.equal(rng.draws, 1);
  assert.deepEqual(events.map((e) => e.type), ["foeMissed"]);
});

test("FID-02 micro: one swing that hits an unarmoured hero draws 2 (to-hit + d6 damage)", () => {
  const foe = fixedFoe();
  assertNoAbilities([foe]);
  const state = fixedState({ combat: fixedCombat([foe]) });
  const rng = countingRng(fakeRng([3, 4]));
  const events = foeTurn(state, rng, []);
  assert.equal(rng.draws, 2);
  assert.deepEqual(events.map((e) => e.type), ["struckByFoe"]);
  assert.equal(state.c.wp, 50);
});

test("FID-02 micro: Bat/Rat shape (atk 2, flat damage) draws 2 — two to-hit rolls, ZERO damage dice", () => {
  const foe = fixedFoe({ name: "Bat/Rat", wp: 1, maxWP: 1, sp: { atk: 2, dmg: { n: 0, sides: 0, bonus: 1 } } });
  assertNoAbilities([foe]);
  const state = fixedState({ combat: fixedCombat([foe]) });
  const rng = countingRng(fakeRng([3, 3]));
  const events = foeTurn(state, rng, []);
  assert.equal(rng.draws, 2, "two to-hit rolls; the flat {n:0} damage notation draws no dice");
  assert.deepEqual(events.map((e) => e.type), ["struckByFoe", "struckByFoe"]);
  for (const e of events) assert.equal(e.dmg, 2, "lvl^2 (1) + flat bonus (1)");
});

test("FID-02 micro: hit on an armoured hero draws 3 (to-hit + d6 + d20 soak)", () => {
  const foe = fixedFoe();
  assertNoAbilities([foe]);
  const state = fixedState({
    combat: fixedCombat([foe]),
    c: { ar: 15, armorWP: 20, armorMax: 20, armorMin: 0, armor: "Studded" },
  });
  const rng = countingRng(fakeRng([3, 4, 10]));
  const events = foeTurn(state, rng, []);
  assert.equal(rng.draws, 3);
  assert.deepEqual(events.map((e) => e.type), ["armorSoaked"]);
});

test("FID-02 micro: two Dante-shaped foes (atk 3 each), all six swings miss, draws 6", () => {
  const foes = [
    fixedFoe({ name: "Dante", type: "Humans", wp: 20, maxWP: 20, sp: { atk: 3 } }),
    fixedFoe({ name: "Dante", type: "Humans", wp: 20, maxWP: 20, sp: { atk: 3 } }),
  ];
  assertNoAbilities(foes);
  const state = fixedState({ combat: fixedCombat(foes) });
  const rng = countingRng(fakeRng([7, 7, 7, 7, 7, 7]));
  const events = foeTurn(state, rng, []);
  assert.equal(rng.draws, 6);
  assert.deepEqual(events.map((e) => e.type), ["foeMissed", "foeMissed", "foeMissed", "foeMissed", "foeMissed", "foeMissed"]);
});

// --- Section 2: full fixture-seeded fights (via makeRng, real characters) --
//
// Phase 19 contract: every number pinned below (per-foeTurn AND full-fight)
// must be reproduced EXACTLY by a foe lacking `abilities` after Phase 19's
// ability-attempt gate lands. `abilities: []` must behave identically to an
// absent field — zero extra draws either way. Only a foe with a non-empty
// `abilities` kit may draw more, and that additional draw must be gated
// behind the presence of that kit, mirroring every other zero-draw gate in
// this engine (c.regen, f.acid, C.allies, c.halfNext).

/** runFullFight(seed, forced) — replays one parity-fixture-representative
 * fight start-to-finish (startCombat, then playerStrike in a loop until
 * combat resolves or the hero dies), driven entirely by ONE counting rng so
 * the returned draw count covers the whole fight, not just one action. */
function runFullFight(seed, forced) {
  const state = newRun(seed);
  const start = state.rngState;
  const rng = countingRng(makeRng(start));
  const events = [];
  startCombat(state, false, forced, rng, events);
  assertNoAbilities(state.combat.foes);
  const foeNames = state.combat.foes.map((f) => f.name);
  let attacks = 0;
  while (state.combat && !state.dead && attacks < 200) {
    playerStrike(state, rng, events);
    attacks++;
  }
  return { state, rng, start, attacks, foeNames };
}

const FULL_FIGHTS = [
  { seed: 3, forced: "Beasts", foeNames: ["Shriek"], totalDraws: 12, attacks: 1, outcome: "won" },
  { seed: 14, forced: "Beasts", foeNames: ["Bat/Rat", "Shriek"], totalDraws: 101, attacks: 10, outcome: "died" },
  { seed: 17, forced: "Beasts", foeNames: ["Viper", "Shriek"], totalDraws: 111, attacks: 11, outcome: "won" },
  { seed: 303, forced: "Humans", foeNames: ["Dante", "Dante"], totalDraws: 66, attacks: 6, outcome: "won" },
  { seed: 8, forced: "Beasts", foeNames: ["Shriek"], totalDraws: 32, attacks: 4, outcome: "won" },
];

// --- Section 3: Phase 18 seam + slow — gated draws (D-13) ------------------
//
// PROVENANCE: measured against the post-18-03 engine on 2026-09-13; the
// Section 1/2 numbers above are re-asserted unchanged by this same run.
// THE RULE (restated): pins are measured, not adjusted — a mismatch here is
// an engine bug in the seam's gating, never a reason to edit a number below.

test("Phase 18 baseline: a lethal hero strike on a plain foe draws 6 (strike, damage, killFoe x4)", () => {
  const foe = fixedFoe({ wp: 1, maxWP: 1 });
  const state = fixedState({ combat: fixedCombat([foe]) });
  const rng = countingRng(fakeRng([3, 4, 1, 1, 20, 1]));
  const events = playerStrike(state, rng, []);
  assert.equal(rng.draws, 6);
  assert.equal(state.combat, null);
  const types = events.map((e) => e.type);
  assert.ok(types.includes("struck"));
  assert.ok(types.includes("foeKilled"));
});

test("CANON-01: the same strike on an sp.ar foe whose soak roll fails draws exactly 7 (+1 = the d20)", () => {
  const foe = fixedFoe({ wp: 1, maxWP: 1, sp: { ar: 12 } });
  const state = fixedState({ combat: fixedCombat([foe]) });
  const rng = countingRng(fakeRng([3, 4, 20, 1, 1, 20, 1]));
  const events = playerStrike(state, rng, []);
  assert.equal(rng.draws, 7);
  assert.equal(state.combat, null, "the foe died");
  assert.equal(events.some((e) => e.type === "foeArmorSoaked"), false);
});

test("CANON-01: a soaked strike costs one d20 and the fight continues — 6 draws for the whole action", () => {
  const foe = fixedFoe({ wp: 10, maxWP: 10, sp: { ar: 12 } });
  const state = fixedState({ combat: fixedCombat([foe]) });
  const rng = countingRng(fakeRng([3, 4, 5, 7, 15, 10]));
  const events = playerStrike(state, rng, []);
  assert.equal(rng.draws, 6, "strike, damage, soak, foe miss, initiative x2");
  assert.deepEqual(events.map((e) => e.type), ["foeArmorSoaked", "foeMissed"]);
  assert.equal(foe.wp, 10);
});

test("CANON-01 zero-draw: an armoured foe hit by a spell-kind tick draws no d20 — acid tick + foe miss = 2", () => {
  const foe = fixedFoe({
    type: "Walking Dead",
    sp: { ar: 15 },
    acid: { rounds: 2, dmg: { n: 1, sides: 6 } },
    wp: 20,
    maxWP: 20,
  });
  const state = fixedState({ combat: fixedCombat([foe]) });
  const rng = countingRng(fakeRng([4, 7]));
  const events = foeTurn(state, rng, []);
  assert.equal(rng.draws, 2, "the armored foe's own ar never gates a spell-kind tick");
  assert.ok(events.some((e) => e.type === "acidTick" && e.dmg === 8));
});

test("CANON-05: a slow foe adds exactly one strike die — lethal 7 vs baseline 6", () => {
  const foe = fixedFoe({ wp: 1, maxWP: 1, sp: { slow: true } });
  const state = fixedState({ combat: fixedCombat([foe]) });
  const rng = countingRng(fakeRng([7, 2, 4, 1, 1, 20, 1]));
  const events = playerStrike(state, rng, []);
  assert.equal(rng.draws, 7, "one extra strike die vs the 6-draw plain-foe baseline");
  const struck = events.find((e) => e.type === "struck");
  assert.equal(struck.roll, 2);
});

test("CANON-05: a slow all-miss action draws 5 vs the non-slow 4", () => {
  const slowFoe = fixedFoe({ wp: 10, maxWP: 10, sp: { slow: true } });
  const slowState = fixedState({ combat: fixedCombat([slowFoe]) });
  const slowRng = countingRng(fakeRng([7, 9, 7, 15, 10]));
  playerStrike(slowState, slowRng, []);
  assert.equal(slowRng.draws, 5);

  const plainFoe = fixedFoe({ wp: 10, maxWP: 10 });
  const plainState = fixedState({ combat: fixedCombat([plainFoe]) });
  const plainRng = countingRng(fakeRng([7, 7, 15, 10]));
  playerStrike(plainState, plainRng, []);
  assert.equal(plainRng.draws, 4);
});

test("CANON-03/04 are pure arithmetic: halfDmg and the Trachea row add zero draws (5 each, same as a plain non-lethal hit)", () => {
  const halfDmgFoe = fixedFoe({ wp: 20, maxWP: 20, sp: { halfDmg: true } });
  const halfDmgState = fixedState({ combat: fixedCombat([halfDmgFoe]) });
  const halfDmgRng = countingRng(fakeRng([3, 4, 7, 15, 10]));
  const halfDmgEvents = playerStrike(halfDmgState, halfDmgRng, []);
  assert.equal(halfDmgRng.draws, 5);
  assert.ok(halfDmgEvents.some((e) => e.type === "struck" && e.dmg === 3));

  const tracheaFoe = fixedFoe({ name: "Trachea", type: "Lair Beasts", wp: 20, maxWP: 20 });
  const tracheaState = fixedState({ combat: fixedCombat([tracheaFoe]) });
  const tracheaRng = countingRng(fakeRng([3, 4, 7, 15, 10]));
  const tracheaEvents = playerStrike(tracheaState, tracheaRng, []);
  assert.equal(tracheaRng.draws, 5);
  assert.ok(tracheaEvents.some((e) => e.type === "struck" && e.dmg === 10));

  const plainFoe = fixedFoe({ wp: 20, maxWP: 20 });
  const plainState = fixedState({ combat: fixedCombat([plainFoe]) });
  const plainRng = countingRng(fakeRng([3, 4, 7, 15, 10]));
  const plainEvents = playerStrike(plainState, plainRng, []);
  assert.equal(plainRng.draws, 5);
  assert.ok(plainEvents.some((e) => e.type === "struck" && e.dmg === 5));
});

test("FID-02 contract restated: the five FULL_FIGHTS pins and six micro pins above are unchanged by Phase 18", () => {
  const r = runFullFight(3, "Beasts");
  assert.equal(r.rng.draws, 12);
});

for (const row of FULL_FIGHTS) {
  test(`FID-02 full fight: seed ${row.seed}/${row.forced} pins ${row.totalDraws} total draws (${row.outcome})`, () => {
    const r = runFullFight(row.seed, row.forced);
    assert.deepEqual(r.foeNames, row.foeNames, "fixture roster drifted — see FIXTURE-INVENTORY.md");
    assert.equal(r.rng.draws, row.totalDraws, "pinned total draws mismatch — an ENGINE change, not a pin to edit");
    assert.ok(r.attacks < 200, "hit the 200-attack safety cap — fight never resolved");
    assert.equal(r.attacks, row.attacks);
    if (row.outcome === "died") {
      assert.equal(r.state.dead, true);
    } else {
      assert.equal(r.state.dead, false);
      assert.equal(r.state.combat, null);
    }
    assert.equal(
      (r.start + Math.imul(r.rng.draws, 0x6d2b79f5)) | 0,
      r.rng.getState() | 0,
      "counter disagrees with the rng cursor",
    );
  });
}
