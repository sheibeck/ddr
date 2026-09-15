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
import { BESTIARY } from "../../content/index.js";

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
  // Phase 24 (2026-09-14, race pass): was 101/10/died — this seed's hero is a
  // Fridgian Soldier; the frenzy corpse-whiff draw was removed and hide -2
  // now shaves every landed foe blow (IDENT-08/09), so the fight now KILLS
  // the Shriek instead of dying to it. Re-measured live via runFullFight
  // against the patched engine (never hand-computed).
  { seed: 14, forced: "Beasts", foeNames: ["Bat/Rat", "Shriek"], totalDraws: 87, attacks: 8, outcome: "won" },
  // Phase 24 (2026-09-14, race pass): was 111/11/won — same cause (a
  // Fridgian Pilfer): the corpse-whiff draw is gone and hide -2 shortens the
  // fight by two rounds. Re-measured live.
  { seed: 17, forced: "Beasts", foeNames: ["Viper", "Shriek"], totalDraws: 101, attacks: 9, outcome: "won" },
  // Phase 27 (2026-09-15, TUNE-06): was foeNames ["Dante", "Dante"], attacks
  // 6 — Dante demoted to tier 2, Ned is now the tier-1 Humans row; total
  // draws happens to stay 66 (re-measured live via runFullFight, never
  // hand-computed).
  { seed: 303, forced: "Humans", foeNames: ["Ned", "Ned"], totalDraws: 66, attacks: 10, outcome: "won" },
  { seed: 8, forced: "Beasts", foeNames: ["Shriek"], totalDraws: 32, attacks: 4, outcome: "won" },
  // Phase 24 (2026-09-14, race pass): new row. A plain Human Apprentice
  // (unaffected by the race pass — no Fridgian/Dwarven mechanic in play),
  // added to restore death-path FID-02 coverage now that seed 14's Fridgian
  // no longer dies; pairs with the parity fixture's new lose-apprentice
  // scenario (same seed, same roster, same reason).
  { seed: 127, forced: "Beasts", foeNames: ["Bat/Rat", "Shriek"], totalDraws: 119, attacks: 14, outcome: "died" },
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

// --- Section 4: Phase 19 — the ability gate (FOE-01/FOE-06, D-04/D-05/D-15) --
//
// PROVENANCE: every draw count and event-type array below was MEASURED
// against the post-19-03 engine (engine/foeAbilities.js + engine/combat.js's
// D-04 ability gate) on 2026-09-13/14, by running the exact fixtures below
// through the real `foeTurn`/`runFullFight` and recording what came out.
// Sections 1-3 above are re-asserted UNCHANGED by this same test run — this
// file's own trailing `for (const row of FULL_FIGHTS)` loop still runs and
// still passes, byte-identical to before Phase 19.
//
// THE RULE (restated, same as Sections 1-3): a mismatch anywhere in this
// section means engine/foeAbilities.js's or foeTurn's ability gating CHANGED
// — that is a defect in 19-01..03's engine code to report, never a reason to
// "adjust" a number below to make a red run green.

test("Phase 19 / FOE-01 identity: abilities: [] reproduces the six Section-1 micro pins (0/1/2/2/3/6) with identical event types", () => {
  const IDENTITY_ROWS = [
    {
      label: "asleep foe draws 0",
      foes: [fixedFoe({ asleep: 2, abilities: [] })],
      seq: [],
      draws: 0,
      types: ["foeSlept"],
    },
    {
      label: "one swing that misses draws 1 (to-hit only)",
      foes: [fixedFoe({ abilities: [] })],
      seq: [7],
      draws: 1,
      types: ["foeMissed"],
    },
    {
      label: "one swing that hits an unarmoured hero draws 2 (to-hit + d6 damage)",
      foes: [fixedFoe({ abilities: [] })],
      seq: [3, 4],
      draws: 2,
      types: ["struckByFoe"],
    },
    {
      label: "Bat/Rat shape (atk 2, flat damage) draws 2 — two to-hit rolls, ZERO damage dice",
      foes: [
        fixedFoe({
          name: "Bat/Rat",
          wp: 1,
          maxWP: 1,
          sp: { atk: 2, dmg: { n: 0, sides: 0, bonus: 1 } },
          abilities: [],
        }),
      ],
      seq: [3, 3],
      draws: 2,
      types: ["struckByFoe", "struckByFoe"],
    },
    {
      label: "hit on an armoured hero draws 3 (to-hit + d6 + d20 soak)",
      foes: [fixedFoe({ abilities: [] })],
      c: { ar: 15, armorWP: 20, armorMax: 20, armorMin: 0, armor: "Studded" },
      seq: [3, 4, 10],
      draws: 3,
      types: ["armorSoaked"],
    },
    {
      label: "two Dante-shaped foes (atk 3 each), all six swings miss, draws 6",
      foes: [
        fixedFoe({ name: "Dante", type: "Humans", wp: 20, maxWP: 20, sp: { atk: 3 }, abilities: [] }),
        fixedFoe({ name: "Dante", type: "Humans", wp: 20, maxWP: 20, sp: { atk: 3 }, abilities: [] }),
      ],
      seq: [7, 7, 7, 7, 7, 7],
      draws: 6,
      types: ["foeMissed", "foeMissed", "foeMissed", "foeMissed", "foeMissed", "foeMissed"],
    },
  ];
  for (const row of IDENTITY_ROWS) {
    for (const f of row.foes) {
      assert.ok(Array.isArray(f.abilities) && f.abilities.length === 0, `${row.label}: foe missing abilities: []`);
    }
    const state = fixedState({ combat: fixedCombat(row.foes), c: row.c });
    const rng = countingRng(fakeRng(row.seq));
    const events = foeTurn(state, rng, []);
    assert.equal(rng.draws, row.draws, row.label);
    assert.deepEqual(events.map((e) => e.type), row.types, row.label);
  }
});

test("Phase 19 / RESEARCH Pitfall 3: a caster with nothing ready draws only its melee to-hit (1) — never the d6; never_melee with nothing ready draws 0", () => {
  {
    // an exhausted `uses` cap: 1 draw (the melee to-hit), never the d6.
    const foe = fixedFoe({ abilities: ["djinniLightning"], uses: { djinniLightning: 0 } });
    const state = fixedState({ combat: fixedCombat([foe]) });
    const rng = countingRng(fakeRng([7]));
    const events = foeTurn(state, rng, []);
    assert.equal(rng.draws, 1, "exhausted uses cap");
    assert.deepEqual(events.map((e) => e.type), ["foeMissed"]);
  }
  {
    // an every:4 ability's FIRST visit lazily initializes cd to 4, then ticks
    // to 3 — not ready yet, so this visit also melees for exactly 1 draw.
    const foe = fixedFoe({ abilities: ["drakeBreath"] });
    const state = fixedState({ combat: fixedCombat([foe]) });
    const rng = countingRng(fakeRng([7]));
    const events = foeTurn(state, rng, []);
    assert.equal(rng.draws, 1, "cooling every:4 ability, first visit");
    assert.deepEqual(events.map((e) => e.type), ["foeMissed"]);
    assert.equal(foe.cd.drakeBreath, 3, "cd lazily initialized to 4 then ticked to 3");
  }
  {
    // never_melee with nothing ready: 0 draws, foeOutOfSpells, no melee fallback.
    const foe = fixedFoe({ abilities: ["drakeBreath"], sp: { never_melee: true } });
    const state = fixedState({ combat: fixedCombat([foe]) });
    const rng = countingRng(fakeRng([]));
    const events = foeTurn(state, rng, []);
    assert.equal(rng.draws, 0);
    assert.deepEqual(events, [{ type: "foeOutOfSpells", name: "Target" }]);
  }
});

// D-04 gated-draw table — the exact rng cost of each ability kind, measured
// via countingRng on the fixed unarmoured intel-1 Fighter (unless a row
// overrides `c`). Mirrors 19-03-SUMMARY.md's "Draws per fired ability" table
// exactly; a mismatch here is a 19-03 engine defect to report, never a pin
// to edit.
const GATED_DRAWS = [
  { label: "bolt cast: d6 + d6 dmg = 2", foe: { abilities: ["krupkeFreeze"] }, seq: [1, 4], draws: 2, types: ["foeCast", "foeBolted"] },
  { label: "bolt declined by the d6 (5): d6 + to-hit miss = 2", foe: { abilities: ["krupkeFreeze"] }, seq: [5, 7], draws: 2, types: ["foeMissed"] },
  { label: "drain: d6 + 2d6 = 3", foe: { abilities: ["vampireDrain"], wp: 5, maxWP: 10 }, seq: [1, 3, 4], draws: 3, types: ["foeCast", "foeBolted", "foeDrained"] },
  { label: "debuff: d6 + d4 = 2", foe: { abilities: ["krupkeWeaken"], cd: { krupkeWeaken: 1 } }, seq: [1, 2], draws: 2, types: ["foeCast", "foeDebuffed"] },
  { label: "heal: d6 + d10 = 2", foe: { abilities: ["stalkaHeal"], wp: 5, maxWP: 10, cd: { stalkaHeal: 1 } }, seq: [1, 6], draws: 2, types: ["foeCast", "foeHealed"] },
  { label: "summon: d6 + pick = 2", foe: { abilities: ["vampireSummon"], lvl: 5, cd: { vampireSummon: 1 } }, seq: [1], pick: (arr) => arr[0], draws: 2, types: ["foeCast", "foeSummoned"] },
  { label: "never_melee bolt: dmg only = 1", foe: { abilities: ["drudgeFreeze"], sp: { never_melee: true } }, seq: [3], draws: 1, types: ["foeCast", "foeBolted"] },
  { label: "intel-12 hero resists: d6 + d20 = 2", foe: { abilities: ["krupkeFreeze"] }, c: { intel: 12 }, seq: [1, 11], draws: 2, types: ["foeCast", "heroResisted"] },
  { label: "intel-12 hero fails to resist: d6 + d20 + dmg = 3", foe: { abilities: ["krupkeFreeze"] }, c: { intel: 12 }, seq: [1, 12, 4], draws: 3, types: ["foeCast", "heroResistFailed", "foeBolted"] },
  { label: "armoured hero bolt: d6 + dmg + soak d20 = 3", foe: { abilities: ["krupkeFreeze"] }, c: { ar: 15, armorWP: 20, armorMax: 20, armorMin: 0, armor: "Studded" }, seq: [1, 4, 10], draws: 3, types: ["foeCast", "armorSoaked"] },
];

for (const row of GATED_DRAWS) {
  test(`Phase 19 / D-04 gated draws: ${row.label}`, () => {
    const foe = fixedFoe(row.foe);
    const state = fixedState({ combat: fixedCombat([foe]), c: row.c });
    const rng = countingRng(fakeRng(row.seq, row.pick ? { pick: row.pick } : {}));
    const events = foeTurn(state, rng, []);
    assert.equal(rng.draws, row.draws, row.label);
    assert.deepEqual(events.map((e) => e.type), row.types, row.label);
    assert.throws(() => rng.d(1), /sequence exhausted/, `${row.label}: fakeRng should be fully consumed`);
  });
}

// Phase 24 (2026-09-14, race pass, IDENT-08/09): two of the five original
// totals (seed 14, seed 17 — both Fridgian heroes) changed because the
// frenzy corpse-whiff draw was DELIBERATELY removed and hide -2 now shaves
// every landed foe blow; that is a rules change, not a seam bug. Seed 127
// is a new sixth row (a plain Human, unaffected by the race pass) restoring
// death-path coverage. See the FULL_FIGHTS array above for the full
// rationale on each changed/added row.
test("FID-02 restated post-Phase-24: the six FULL_FIGHTS totals (12/87/101/66/32/119) are measured-current and no fixture-roster creature carries a kit", () => {
  for (const row of FULL_FIGHTS) {
    const r = runFullFight(row.seed, row.forced);
    assert.equal(r.rng.draws, row.totalDraws, `seed ${row.seed}/${row.forced} pinned total draws`);
    assert.deepEqual(r.foeNames, row.foeNames, `seed ${row.seed}/${row.forced} roster`);
  }
  // Phase 27 (2026-09-15, TUNE-06): was ["Bat/Rat", "Shriek", "Viper",
  // "Dante"] — Dante moved to tier 2 and no fixture rolls it anymore; Ned is
  // the new tier-1 Humans fixture-exposed row.
  const FIXTURE_NAMES = ["Bat/Rat", "Shriek", "Viper", "Ned"];
  let kitCount = 0;
  for (const type of Object.keys(BESTIARY)) {
    for (const tier of BESTIARY[type]) {
      for (const row of tier) {
        if (Object.hasOwn(row, "abilities")) kitCount++;
        if (FIXTURE_NAMES.includes(row.n)) {
          assert.equal(Object.hasOwn(row, "abilities"), false, `${row.n} (${type}) unexpectedly carries an abilities kit`);
        }
      }
    }
  }
  assert.equal(kitCount, 8, "expected exactly 8 bestiary rows to carry an abilities kit (19-01's pin)");
});
