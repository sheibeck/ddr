// test/unit/condition-roll-mods.test.js
//
// Phase 77, plan 77-07 (CMBUI-13, "Dazed honesty", user 2026-09-25): "i was
// dazed in combat, but it seems like it doesn't do anything. The
// description is too vague to know." Dazed always worked (toHit takes two
// winning faces away), but the strike line never said so. This file pins
// the honesty fix end to end:
//
//   1. engine/derived.js#toHitBreakdown mirrors toHit step for step: its
//      `need` equals toHit(state) over a class x race x weapon x inspired x
//      dazed x darkness x heroBlind matrix (the foeToHitBreakdown
//      precedent in test/unit/feedback-payload.test.js), and its `mods`
//      name only the live condition terms (inspired, dazed, dark, blind).
//   2. playerStrike's strikeMissed/struck `mods` carry those condition
//      entries first, then Mirror Self, Overhead Blow and afraid; a strike
//      with no live condition has exactly today's mods (absent when empty).
//   3. The roll, the faces, the outcome, every draw and the resulting state
//      are byte-identical to the plan base (e8bd4808): the STRIKE_DIGESTS
//      below were recorded at the base with `mods` stripped, over eight
//      seeds per scenario, with a counting rng. This plan is payload only.
//   4. (Task 2) the foeDebuffed payload and the onset/fade lines.
//
// Local fixtures follow the repo's per-file convention (never imported
// cross-file).

import test from "node:test";
import assert from "node:assert/strict";

import { newRun } from "../../engine/engine.js";
import { playerStrike } from "../../engine/combat.js";
import { toHit, toHitBreakdown, DAZED_TO_HIT_PENALTY } from "../../engine/derived.js";
import { makeRng, hashString } from "../../engine/rng.js";
import { resolveFoeAbility } from "../../engine/foeAbilities.js";
import { foeTurn } from "../../engine/combat.js";
import { RACES, FOE_ABILITIES } from "../../content/index.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { LINE_FOR } from "../../src/browser/narrationLines.js";

// ─── local fixtures ────────────────────────────────────────────────────────

/** fakeRng(seq) — `.d()` pops the next value regardless of sides; throws
 * on underflow. A d20 face of 20 mirrors to a roll of 1 (a sure miss). */
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

/** countingRng(inner) — counts every draw-producing call. */
function countingRng(inner) {
  let draws = 0;
  return {
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
}

const FILL = new Array(24).fill(20);

function plainFoe(over = {}) {
  return { name: "Target", type: "Beasts", lvl: 1, size: "S", intel: 1, wp: 30, maxWP: 30, alive: true, asleep: 0, sp: {}, lives: 1, ...over };
}

/**
 * strikeState(sc) — a real newRun(1) state as a level-1 Human
 * Fighter/Soldier on a Club (5 winning faces), Night Vision stripped, the
 * current tile's darkness set from `sc.dark`, `sc.c` merged onto the
 * sheet, `sc.skills` onto its skills and `sc.combat` onto one live foe's
 * combat.
 */
const BASE_RUN = newRun(1);

function strikeState(sc = {}) {
  const state = structuredClone(BASE_RUN);
  Object.assign(state.c, { race: "Human", cls: "Fighter", sub: "Soldier", level: 1, weapon: "Club", ...(sc.c || {}) });
  if (!state.c.timers || typeof state.c.timers !== "object") state.c.timers = {};
  if (state.c.skills) delete state.c.skills["Night Vision"];
  Object.assign(state.c.skills || (state.c.skills = {}), sc.skills || {});
  const f = state.floor;
  f.g[f.py][f.px].dark = !!sc.dark;
  state.combat = { foes: [plainFoe()], type: "Beasts", round: 1, target: 0, spellOpen: false, tracked: false, ...(sc.combat || {}) };
  return state;
}

/** The first strikeMissed/struck of a scripted sure-miss strike. */
function missedStrike(sc) {
  const state = strikeState(sc);
  const events = playerStrike(state, fakeRng([20, 20, ...FILL]), []);
  const e = events.find((ev) => ev.type === "strikeMissed" || ev.type === "struck");
  assert.ok(e, "expected a strike event");
  return e;
}

// ─── 1. the breakdown matrix ──────────────────────────────────────────────

const CONDITION_NAMES = new Set(["inspired", "dazed", "dark", "blind"]);
const TORCH_LIT = { "item:Torch": { cadence: "squares", left: 40, phase: "effect" } };

const DARK_CASES = [
  { key: "lit" },
  { key: "darkTile", dark: true },
  { key: "darkFor", c: { darkFor: 5 } },
  { key: "darkNightVision", dark: true, skills: { "Night Vision": 1 } },
  { key: "darkTorch", dark: true, c: { timers: { ...TORCH_LIT } } },
  { key: "darkSenses", dark: true, c: { senses: true } },
];
const DAZE_CASES = [
  { key: "none" },
  { key: "dazed", c: { foeEffect: { kind: "dazed", rounds: 2 } } },
  { key: "dazedSpent", c: { foeEffect: { kind: "dazed", rounds: 0 } } },
  { key: "weakened", c: { foeEffect: { kind: "weakened", rounds: 2 } } },
];

test("toHitBreakdown: need equals toHit across class x race x weapon x inspired x dazed x darkness x heroBlind (and with no combat); mods name only live condition terms and account for the whole change", () => {
  let cases = 0;
  const seen = new Set();
  for (const cls of ["Fighter", "Thief", "Magic User"]) {
    for (const race of Object.keys(RACES)) {
      for (const weapon of ["Club", "Dagger", "Bastard Sword"]) {
        for (const inspired of [0, 1]) {
          for (const daze of DAZE_CASES) {
            for (const dark of DARK_CASES) {
              for (const heroBlind of [false, true]) {
                for (const inCombat of [true, false]) {
                  const sc = {
                    c: { cls, race, sub: "X", weapon, ...(daze.c || {}), ...(dark.c || {}) },
                    skills: dark.skills,
                    dark: dark.dark,
                    combat: { ...(inspired ? { inspired } : {}), ...(heroBlind ? { heroBlind: true } : {}) },
                  };
                  const state = strikeState(sc);
                  if (!inCombat) state.combat = null;
                  const label = `${cls}/${race}/${weapon}/insp${inspired}/${daze.key}/${dark.key}/blind${heroBlind}/combat${inCombat}`;
                  const { need, mods } = toHitBreakdown(state);
                  assert.equal(need, toHit(state), label);
                  for (const m of mods) {
                    assert.ok(CONDITION_NAMES.has(m.name), `${label}: unexpected mod name ${m.name}`);
                    assert.notEqual(m.delta, 0, `${label}: a zero-delta entry is never recorded`);
                    seen.add(m.name);
                  }
                  // The whole change the conditions made: toHit of the same
                  // sheet with every condition stripped, plus the mods.
                  const bare = strikeState({ c: { cls, race, sub: "X", weapon } });
                  const deltaSum = mods.reduce((s, m) => s + m.delta, 0);
                  assert.equal(toHit(bare) + deltaSum, need, `${label}: mods account for need − base`);
                  cases++;
                }
              }
            }
          }
        }
      }
    }
  }
  assert.ok(cases > 1000, "the matrix is not vacuous");
  assert.deepEqual([...seen].sort(), ["blind", "dark", "dazed", "inspired"], "every condition term fires somewhere in the matrix");
});

test("DAZED_TO_HIT_PENALTY is the engine's own dazed step (2 winning faces)", () => {
  assert.equal(DAZED_TO_HIT_PENALTY, 2);
  const plain = strikeState();
  const dazed = strikeState({ c: { foeEffect: { kind: "dazed", rounds: 3 } } });
  assert.equal(toHit(plain) - toHit(dazed), DAZED_TO_HIT_PENALTY);
});

test("toHitBreakdown: each term is itemised as applied, in toHit's order (inspired, dazed, dark, blind)", () => {
  const all = strikeState({ dark: true, c: { foeEffect: { kind: "dazed", rounds: 2 } }, combat: { inspired: 1, heroBlind: true } });
  // Fighter 5 → inspired 6 → dazed 4 → dark cap 2 → blind 1.
  assert.deepEqual(toHitBreakdown(all), {
    need: 1,
    mods: [
      { name: "inspired", delta: 1 },
      { name: "dazed", delta: -2 },
      { name: "dark", delta: -2 },
      { name: "blind", delta: -1 },
    ],
  });
  assert.deepEqual(toHitBreakdown(strikeState()), { need: 5, mods: [] });
});

// ─── 2. strike mods ──────────────────────────────────────────────────────

test("playerStrike: a dazed level-1 Human Fighter's strike carries { name: 'dazed', delta: −2 }", () => {
  const e = missedStrike({ c: { foeEffect: { kind: "dazed", rounds: 3 } } });
  assert.equal(e.type, "strikeMissed");
  assert.deepEqual(e.mods, [{ name: "dazed", delta: -DAZED_TO_HIT_PENALTY }]);
  assert.equal(e.atLeast, 18, "3 winning faces on the d20: 18–20");
});

test("playerStrike: a floored daze carries the floored delta (a Magic User on a Club: −2; on a Flail, 2 faces floored to 1: −1)", () => {
  const club = missedStrike({ c: { cls: "Magic User", sub: "Sorcerer", foeEffect: { kind: "dazed", rounds: 2 } } });
  assert.deepEqual(club.mods, [{ name: "dazed", delta: -2 }]);
  const flail = missedStrike({ c: { cls: "Magic User", sub: "Sorcerer", weapon: "Flail", foeEffect: { kind: "dazed", rounds: 2 } } });
  // Magic User 3 − Flail 1 = 2 faces; dazed floors at 1, a −1 change.
  assert.deepEqual(flail.mods, [{ name: "dazed", delta: -1 }]);
});

test("playerStrike: inspired, the dark cap and hero Blind each name themselves", () => {
  assert.deepEqual(missedStrike({ combat: { inspired: 1 } }).mods, [{ name: "inspired", delta: 1 }]);
  assert.deepEqual(missedStrike({ dark: true }).mods, [{ name: "dark", delta: -3 }]);
  assert.deepEqual(missedStrike({ combat: { heroBlind: true } }).mods, [{ name: "blind", delta: -4 }]);
});

test("playerStrike: a light (Night Vision) or Sense Presence lifts the dark cap, and no 'dark' entry appears", () => {
  assert.equal("mods" in missedStrike({ dark: true, skills: { "Night Vision": 1 } }), false);
  assert.equal("mods" in missedStrike({ dark: true, c: { senses: true } }), false);
  assert.equal("mods" in missedStrike({ dark: true, c: { timers: { ...TORCH_LIT } } }), false);
});

test("playerStrike: condition entries come first, then Overhead Blow, then afraid", () => {
  const e = missedStrike({
    c: { foeEffect: { kind: "dazed", rounds: 2 } },
    combat: { afraid: 2, inspired: 1, abilityStrike: { key: "overheadBlow", dmgMul: 2, needShift: -2 } },
  });
  // 5 +1 inspired = 6, −2 dazed = 4, overhead −2 = 2, afraid floors at 1 (−1).
  assert.deepEqual(e.mods, [
    { name: "inspired", delta: 1 },
    { name: "dazed", delta: -2 },
    { name: "overhead", delta: -2 },
    { name: "afraid", delta: -1 },
  ]);
});

test("playerStrike: a strike with no live condition keeps today's mods (absent when empty; a weakening is not a to-hit term)", () => {
  assert.equal("mods" in missedStrike({}), false);
  assert.equal("mods" in missedStrike({ c: { foeEffect: { kind: "weakened", rounds: 2 } } }), false);
  assert.equal("mods" in missedStrike({ c: { foeEffect: { kind: "dazed", rounds: 0 } } }), false);
  assert.deepEqual(missedStrike({ combat: { afraid: 2 } }).mods, [{ name: "afraid", delta: -3 }]);
});

test("playerStrike: the frenzy second swing reads the same condition entries (a dazed Fridgian)", () => {
  // The frenzy check (d8 face 1 → roll 8, a success), then two sure misses.
  const state = strikeState({ c: { race: "Fridgian", foeEffect: { kind: "dazed", rounds: 3 } } });
  const events = playerStrike(state, fakeRng([1, 20, 20, ...FILL]), []);
  assert.ok(events.some((e) => e.type === "frenzy"), "the frenzy fired");
  const swings = events.filter((e) => e.type === "strikeMissed");
  assert.ok(swings.length >= 2, "two swings");
  for (const s of swings) assert.deepEqual(s.mods, [{ name: "dazed", delta: -2 }]);
});

// ─── 3. measured zero: nothing but the mods changed ───────────────────────

// Recorded at the plan base (e8bd4808) with `mods` (and Task 2's
// foeDebuffed/foeEffectFaded `toHit`) stripped from every event: hashString(JSON.stringify([{ draws, events, state } x seeds 1-8])),
// the strike driven by countingRng(makeRng(seed * 7919)). A moved digest
// means this plan changed a roll, a face, a draw or the state.
const STRIKE_SCENARIOS = {
  none: {},
  dazed: { c: { foeEffect: { kind: "dazed", rounds: 3 } } },
  weakened: { c: { foeEffect: { kind: "weakened", rounds: 3 } } },
  inspired: { combat: { inspired: 1 } },
  dark: { dark: true },
  darkLit: { dark: true, skills: { "Night Vision": 1 } },
  blind: { combat: { heroBlind: true } },
  stacked: { dark: true, c: { foeEffect: { kind: "dazed", rounds: 2 } }, combat: { inspired: 1 } },
  afraidDazed: { c: { foeEffect: { kind: "dazed", rounds: 2 } }, combat: { afraid: 2 } },
  muFloored: { c: { cls: "Magic User", sub: "Sorcerer", foeEffect: { kind: "dazed", rounds: 2 } } },
  frenzyDazed: { c: { race: "Fridgian", foeEffect: { kind: "dazed", rounds: 3 } } },
};
// Phase 79.2 early-floor lock (user ruling 2026-09-27, locked by
// RF-79.2-02-3): all eleven digests re-recorded. Traced with a scratch copy
// of this loop run twice on the locked engine: under
// setDialsForTuning(79.2's fit/start.json) it reproduces every old digest
// (none 4762ee31, dazed 276b8e40, weakened 330fe5ed, inspired 98976971,
// dark 90def8ec, darkLit bc9c079, blind 4acd5aa6, stacked 940e094,
// afraidDazed 20661057, muFloored 43f49550, frenzyDazed fab9135a); under the
// locked DIALS every scenario's `state` differs first in c.maxWP/c.wp
// (BASE_RUN = newRun(1): heroMaxWpFor reads HERO_HP_SCALE 1.25 -> 1.4,
// 73 -> 81), and the events differ only where the foe's return swing lands
// (seed 8, or seed 5 for frenzyDazed: struckByFoe dmg 2 -> 3, foeHitFor
// reads FOE_HIT_SCALE { 0.6, 0.01 } -> { 0.84, 0.02 }). Every roll, face,
// outcome and draw count is unchanged.
const STRIKE_DIGESTS = {
  none: "a93fc4fe",
  dazed: "53dde3a3",
  weakened: "4a210650",
  inspired: "9658fd58",
  dark: "939d2701",
  darkLit: "fd8ee966",
  blind: "84d1e71f",
  stacked: "beb06a3b",
  afraidDazed: "d02406de",
  muFloored: "5ba11e7b",
  frenzyDazed: "c0da3841",
};

test("measured zero: every strike's roll, faces, outcome, draw count and resulting state match the plan base (mods stripped)", () => {
  // Strips only this plan's payload fields: `mods` everywhere, and the
  // `toHit` Task 2 adds to foeDebuffed/foeEffectFaded (a dazed strike's
  // follow-on foe turn can fade the daze). Everything else must match.
  const stripMods = (e) => {
    const { mods, ...rest } = e;
    if (rest.type === "foeDebuffed" || rest.type === "foeEffectFaded") delete rest.toHit;
    return rest;
  };
  for (const [name, sc] of Object.entries(STRIKE_SCENARIOS)) {
    const parts = [];
    for (let seed = 1; seed <= 8; seed++) {
      const state = strikeState(sc);
      const rng = countingRng(makeRng(seed * 7919));
      const events = playerStrike(state, rng, []);
      parts.push({ draws: rng.draws, events: events.map(stripMods), state });
    }
    assert.equal(hashString(JSON.stringify(parts)).toString(16), STRIKE_DIGESTS[name], `${name}: the strike moved`);
  }
});

// ─── 4. the onset and fade lines say what the effect does (Task 2) ────────

const plain = (html) => String(html ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const DJINNI_DAZE = FOE_ABILITIES.find((a) => a.id === "djinniDaze");
const KRUPKE_WEAKEN = FOE_ABILITIES.find((a) => a.id === "krupkeWeaken");

/** A real debuff through the engine's own resolver, the rounds die
 * scripted. Quick 260928-hrs (user ruling 2026-09-28): every hero rolls a
 * resist d20 first (intel 5: 18–20); a raw 20 mirrors to roll 1, which
 * never resists. */
function realDebuff(ability, roundsFace) {
  const state = strikeState({ c: { intel: 5 } });
  const foe = plainFoe({ name: ability === DJINNI_DAZE ? "Djinni" : "Krupke" });
  state.combat.foes = [foe];
  const events = [];
  resolveFoeAbility(state, foe, ability, fakeRng([20, roundsFace]), events);
  const e = events.find((ev) => ev.type === "foeDebuffed");
  assert.ok(e, "expected a foeDebuffed event");
  return { state, e };
}

/** A real fade: the effect's last round ticks out on a foe turn. */
function realFade(kind) {
  const state = strikeState({ c: { intel: 5, foeEffect: { kind, rounds: 1 } } });
  const events = foeTurn(state, fakeRng([...FILL]), []);
  const e = events.find((ev) => ev.type === "foeEffectFaded");
  assert.ok(e, "expected a foeEffectFaded event");
  assert.equal(state.c.foeEffect, null);
  return e;
}

test("foeDebuffed: a real Djinni daze carries toHit −DAZED_TO_HIT_PENALTY; a weakening carries no toHit field", () => {
  const dazed = realDebuff(DJINNI_DAZE, 3);
  assert.deepEqual(dazed.e, { type: "foeDebuffed", name: "Djinni", ability: "djinniDaze", kind: "dazed", rounds: 3, toHit: -DAZED_TO_HIT_PENALTY });
  assert.deepEqual(dazed.state.c.foeEffect, { kind: "dazed", rounds: 3 }, "the state is unchanged by the payload");
  const weak = realDebuff(KRUPKE_WEAKEN, 2);
  assert.deepEqual(weak.e, { type: "foeDebuffed", name: "Krupke", ability: "krupkeWeaken", kind: "weakened", rounds: 2 });
});

test("onset: the Oracle and the fold name the daze as '−2 to hit' for N rounds, from the payload", () => {
  const { e } = realDebuff(DJINNI_DAZE, 3);
  const oracle = plain(EVENT_NARRATION.foeDebuffed(e));
  assert.match(oracle, /−2 to hit for 3 rounds/, oracle);
  assert.doesNotMatch(oracle, /\+2 to hit|-2 to hit/, "U+2212, never the opposite sign or a hyphen");
  const fold = LINE_FOR.foeDebuffed(e, {});
  assert.ok(fold.text.startsWith("Djinni"), fold.text);
  assert.match(fold.text, /−2 to hit for 3 rounds/, fold.text);
  // The number comes from the payload, never typed by hand.
  const odd = { ...e, toHit: -5, rounds: 1 };
  assert.match(plain(EVENT_NARRATION.foeDebuffed(odd)), /−5 to hit for 1 round\b/);
  assert.match(LINE_FOR.foeDebuffed(odd, {}).text, /−5 to hit for 1 round\b/);
});

test("onset: a weakening says your blows do half damage for N rounds", () => {
  const { e } = realDebuff(KRUPKE_WEAKEN, 2);
  const oracle = plain(EVENT_NARRATION.foeDebuffed(e));
  assert.match(oracle, /half damage for 2 rounds/, oracle);
  const fold = LINE_FOR.foeDebuffed(e, {});
  assert.ok(fold.text.startsWith("Krupke"), fold.text);
  assert.match(fold.text, /half damage for 2 rounds/, fold.text);
});

test("fade: a real daze fading says the −2 to hit is gone; a weakening says full damage again", () => {
  const dazed = realFade("dazed");
  assert.deepEqual(dazed, { type: "foeEffectFaded", kind: "dazed", toHit: -DAZED_TO_HIT_PENALTY });
  assert.match(plain(EVENT_NARRATION.foeEffectFaded(dazed)), /no longer −2 to hit/i);
  assert.match(LINE_FOR.foeEffectFaded(dazed, {}).text, /no longer −2 to hit/);
  const weak = realFade("weakened");
  assert.deepEqual(weak, { type: "foeEffectFaded", kind: "weakened" });
  assert.match(plain(EVENT_NARRATION.foeEffectFaded(weak)), /full damage/);
  assert.match(LINE_FOR.foeEffectFaded(weak, {}).text, /full damage/);
});

test("onset/fade: a bare { type } (an old event with no toHit) still reads a non-empty line, in words", () => {
  for (const type of ["foeDebuffed", "foeEffectFaded"]) {
    assert.ok(plain(EVENT_NARRATION[type]({ type })).length > 0, `${type} Oracle`);
    assert.ok(LINE_FOR[type]({ type }, {}).text.trim().length > 0, `${type} fold`);
    for (const kind of ["dazed", "weakened"]) {
      assert.doesNotMatch(plain(EVENT_NARRATION[type]({ type, kind })), /undefined|NaN|\?/, `${type}/${kind} Oracle`);
      assert.doesNotMatch(LINE_FOR[type]({ type, kind }, {}).text, /undefined|NaN|\?/, `${type}/${kind} fold`);
    }
  }
});

test("a fumbled Weaken on the reader (76-06) says what it does too: half damage, still 'weakens you'", () => {
  const ev = { type: "fumbleOnReader", spell: "Weaken", effect: "weakened", rounds: 3 };
  const oracle = plain(EVENT_NARRATION.fumbleOnReader(ev));
  assert.match(oracle, /weakens you/);
  assert.match(oracle, /half damage/);
  const fold = LINE_FOR.fumbleOnReader(ev, {}).text;
  assert.match(fold, /weakens you/);
  assert.match(fold, /half damage/);
});
