// Direct unit coverage for engine/combat.js — the encounter setup, player
// strikes, kills, foe turns, allies, and flee/parley/sing exits. Each test
// documents, in order, exactly which die rolls the ported prototype code
// consumes via a deterministic `.d()` sequence (see fakeRng below), mirroring
// test/unit/movement.test.js's established pattern. The win/lose/flee/parley
// prototype-parity proof lives in test/parity/combat-parity.test.js (Task 3);
// these tests fill in branches a single parity fixture can't reach without
// hand-crafted foe/character states (multi-foe counts, specific subclasses,
// lethal/near-lethal wp).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { makeRng } from "../../engine/rng.js";
import {
  startCombat,
  fight,
  rollInitiative,
  liveFoes,
  playerStrike,
  killFoe,
  canParley,
  parley,
  flee,
  songReady,
  sing,
  endCombat,
  afterPlayerAction,
  allyTurn,
  alliesTurn,
  foeTurn,
  applyFoeDamageToPlayer,
} from "../../engine/combat.js";
import { weaponDamage } from "../../engine/derived.js";
import { setIdentityDials } from "./harness/identityDials.js";
// Phase 72-05 (ROLL-01 (b)): the shared odds harness, reused here for the
// three outcome-based frenzy-swing tests below — never for anything else in
// this file, which keeps its own fixedState/fakeRng scaffolding.
import { faceOdds, heroState, foeFrom, inCombat } from "./harness/rollOdds.js";

// Phase 54-07 (USER RULING G cycle 3): DIALS ships FITTED, not identity —
// this file's own pins are canon-mechanic numbers written before the fit
// existed, so it runs under an explicit identity override for its whole
// lifetime (test/unit/harness/identityDials.js).
setIdentityDials();
// Phase 54 (BAND-02, USER RULING D): FOE_CAP_MAX is retired — foe count is
// now FOE_COUNT_TABLE-bounded (identity FOE_COUNT_SKEW row 0 tops out at 3,
// the same canon ceiling the retired constant used to enforce structurally).
const FOE_COUNT_MAX = 3;

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

/** fakeRng(seq) — `.d()` pops the next value off `seq` regardless of the
 * requested side count; `.pick(arr)` returns `arr[0]` unless a picker is
 * supplied. Throws if the sequence underflows, which doubles as a "no more
 * rng draws expected" assertion (ports test/unit/movement.test.js's helper
 * verbatim, since the combat domain needs the exact same discipline). */
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
    // audit-batch1 (2026-09-09, A2): Cloak of Flying's charge/cooldown
    // fields — 0/0 (ready-to-activate) by default, same treatment as
    // darkFor above.
    ...overrides,
  };
}

/** A tiny fully-lit 3x3 open floor, sufficient for inDark(state) reads. */
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

// --- startCombat / rollInitiative / liveFoes -------------------------------

test("startCombat: builds a deterministic foe list from BESTIARY for a fixed seed", () => {
  const state1 = fixedState();
  const events1 = startCombat(state1, false, "Beasts", makeRng(42), []);

  const state2 = fixedState();
  startCombat(state2, false, "Beasts", makeRng(42), []);

  assert.deepStrictEqual(state1.combat.foes, state2.combat.foes, "same seed -> byte-identical foe list");
  assert.ok(state1.combat.foes.length >= 1 && state1.combat.foes.length <= 2, "level 1 caps at 2 foes");
  assert.ok(state1.combat.foes.every((f) => f.type === "Beasts" && f.lvl === 1));
  assert.ok(events1.some((e) => e.type === "encounterStarted"));
});

// audit-bugs (2026-09-09, E4): the reported live bug was a foe's rendered hp
// showing current/current (e.g. "5/5") instead of current/max (e.g. "5/20")
// after taking damage. The render (mazeworld.html renderEncounter) reads
// state.combat.foes directly, so the fix here is defense-in-depth: (1) each
// foe is created with a stable maxWP === its starting wp, unaffected by later
// damage, and (2) the encounterStarted event additively carries maxWP too, so
// any consumer reading the event instead of live state gets the same real
// starting hp rather than a value that silently degrades to "current/current".
test("startCombat: each foe's maxWP is its stable starting hp, on both state.combat.foes and the encounterStarted event", () => {
  const state = fixedState();
  const events = startCombat(state, false, "Beasts", makeRng(42), []);
  const started = events.find((e) => e.type === "encounterStarted");
  assert.ok(started);
  state.combat.foes.forEach((f, i) => {
    assert.equal(f.maxWP, f.wp, "freshly created foe starts at full (max) hp");
    assert.equal(started.foes[i].maxWP, f.maxWP, "encounterStarted event's maxWP matches the real foe");
    assert.equal(started.foes[i].wp, f.wp);
  });
});

test("startCombat: a wandering encounter is always exactly one foe", () => {
  const state = fixedState();
  startCombat(state, true, "Humans", makeRng(7), []);
  assert.equal(state.combat.foes.length, 1);
});

test("startCombat: a Knight is beneath the notice of a weak foe (fled, not fought)", () => {
  const state = fixedState({ c: { sub: "Knight" } });
  // forced "Beasts" + a fixed seed known to draw a level-1 Beasts roster
  // where every candidate's maxWP < 5 (Bat/Rat wp:1, Shriek wp:3, Viper
  // wp:3) — any level-1 Beasts foe qualifies, so any seed works here.
  const events = startCombat(state, true, "Beasts", makeRng(99), []);
  assert.ok(events.some((e) => e.type === "foeFled" && e.reason === "knight"));
  assert.equal(state.combat, null, "the only foe fled -> nothing left to fight");
});

// --- PHOBIA-01 / CMB-01 (Phase 31): the Darkness-phobia Afraid penalty on
// Fight! (04.1-05, re-pinned 2026-09-16 — "Phobia should be penalties, never
// a no actions state") -------------------------------------------------
//
// Every test below hand-drives startCombat(state, true /* wandering */,
// "Beasts", rng, []) THEN fight(state, rng, events) on the SAME rng/events —
// CMB-01 (Phase 31) split the single call in two, so the roster/initiative
// rng draws are still pinned to exactly 3 total, just split across the two
// calls: rng.d(4) (the foe's level-reduction roll, here 1 -> lvl 1, consumed
// by startCombat), then rng.d(20) x2 for rollInitiative (mine, theirs, now
// consumed by fight), chosen so mine >= theirs -> first === "you", which
// skips foeTurn() entirely and keeps the draw count exact. A 4th fakeRng
// entry, when present, is the Hardiness mitigation roll (rng.d(2), still
// inside fight). fakeRng throws on sequence underflow, so any test that
// supplies EXACTLY 3 entries also proves no extra rng draw fires for that
// scenario (T-04.1-10).

test("startCombat+fight: a Darkness-phobic character is Afraid after Fight! while dark", () => {
  const state = fixedState({ c: { phobia: "Darkness", phobiaType: null } });
  state.floor.g[state.floor.py][state.floor.px].dark = true;
  const rng = fakeRng([1, 15, 5]);
  const events = startCombat(state, true, "Beasts", rng, []);
  fight(state, rng, events);
  assert.equal(state.combat.afraid, 2);
  assert.ok(events.some((e) => e.type === "phobiaAfraid" && e.rounds === 2));
});

test("startCombat+fight: the persistent darkness counter (darkFor) also triggers the Darkness-phobia Afraid penalty off a lit tile", () => {
  const state = fixedState({ c: { phobia: "Darkness", phobiaType: null, darkFor: 10 } });
  // floor tile itself stays lit (fixedFloor default dark:false) — only the
  // persistent counter is active, proving Task 1's inDark extension flows
  // through here too.
  const rng = fakeRng([1, 15, 5]);
  const events = startCombat(state, true, "Beasts", rng, []);
  fight(state, rng, events);
  assert.equal(state.combat.afraid, 2);
  assert.ok(events.some((e) => e.type === "phobiaAfraid" && e.rounds === 2));
});

test("startCombat+fight: the same Darkness-phobic character is NOT Afraid in the light, and no extra rng is drawn", () => {
  const state = fixedState({ c: { phobia: "Darkness", phobiaType: null } });
  // floor stays lit, darkFor stays 0 — exactly 3 fakeRng entries: any 4th
  // (unwanted Hardiness-style) draw would throw "sequence exhausted".
  const rng = fakeRng([1, 15, 5]);
  const events = startCombat(state, true, "Beasts", rng, []);
  fight(state, rng, events);
  assert.ok(!state.combat.afraid);
  assert.ok(!events.some((e) => e.type === "phobiaAfraid"));
});

test("startCombat+fight: a non-Darkness, non-type-matched phobic character in the dark is NOT Afraid and draws no extra rng", () => {
  const state = fixedState({ c: { phobia: "Spiders", phobiaType: "x" } });
  state.floor.g[state.floor.py][state.floor.px].dark = true;
  const rng = fakeRng([1, 15, 5]);
  const events = startCombat(state, true, "Beasts", rng, []);
  fight(state, rng, events);
  assert.ok(!state.combat.afraid, "an unrelated phobia never triggers the Darkness Afraid penalty");
  assert.ok(!events.some((e) => e.type === "phobiaAfraid"));
  assert.ok(events.some((e) => e.type === "combatInDark"), "the ordinary in-dark combat notice still fires, unrelated to phobia");
});

test("startCombat+fight: Hardiness gives a Darkness-phobic character a 50% chance to shrug off the Afraid penalty (roll shrugs it off)", () => {
  const state = fixedState({ c: { phobia: "Darkness", phobiaType: null, skills: { Hardiness: 1 } } });
  state.floor.g[state.floor.py][state.floor.px].dark = true;
  const rng = fakeRng([1, 15, 5, 1]); // Hardiness roll: d(2)=1 -> shrugged off
  const events = startCombat(state, true, "Beasts", rng, []);
  fight(state, rng, events);
  assert.ok(!state.combat.afraid, "a Hardiness roll of 1 shrugs the Afraid penalty off entirely");
  assert.ok(!events.some((e) => e.type === "phobiaAfraid"));
});

test("startCombat+fight: Hardiness's mitigation roll can still fail, leaving the Darkness-phobia Afraid penalty in place", () => {
  const state = fixedState({ c: { phobia: "Darkness", phobiaType: null, skills: { Hardiness: 1 } } });
  state.floor.g[state.floor.py][state.floor.px].dark = true;
  const rng = fakeRng([1, 15, 5, 2]); // Hardiness roll: d(2)=2 -> no shrug
  const events = startCombat(state, true, "Beasts", rng, []);
  fight(state, rng, events);
  assert.equal(state.combat.afraid, 2);
  assert.ok(events.some((e) => e.type === "phobiaAfraid" && e.rounds === 2));
});

// --- PHOBIA-01 / CMB-01 (Phase 31): the Death-phobia near-death Afraid
// penalty on Fight! (04.1-06, re-pinned 2026-09-16) ---------------------
//
// maxWP is 55 (fixedFighter default), so DEATH_PANIC_THRESHOLD (0.25) puts
// the near-death line at wp <= 13.75. wp:10 is at/below it; wp:20 is above
// it. Same 3-draw rng shape as the Darkness tests above (foe-level roll +
// initiative x2, "you" goes first so foeTurn never runs and the draw count
// stays exact, now split across startCombat+fight); a 4th entry, when
// present, is the Hardiness mitigation roll.

test("startCombat+fight: a Death-phobic character at/below the near-death threshold is Afraid after Fight!", () => {
  const state = fixedState({ c: { phobia: "Death", phobiaType: null, wp: 10 } });
  const rng = fakeRng([1, 15, 5]);
  const events = startCombat(state, true, "Beasts", rng, []);
  fight(state, rng, events);
  assert.equal(state.combat.afraid, 2);
  assert.ok(events.some((e) => e.type === "phobiaAfraid" && e.rounds === 2));
});

test("startCombat+fight: the same Death-phobic character is NOT Afraid above the threshold, and no extra rng is drawn", () => {
  const state = fixedState({ c: { phobia: "Death", phobiaType: null, wp: 20 } });
  // exactly 3 fakeRng entries: any 4th (unwanted Hardiness-style) draw would throw.
  const rng = fakeRng([1, 15, 5]);
  const events = startCombat(state, true, "Beasts", rng, []);
  fight(state, rng, events);
  assert.ok(!state.combat.afraid);
  assert.ok(!events.some((e) => e.type === "phobiaAfraid"));
});

test("startCombat+fight: a non-Death phobic character near death is NOT Afraid and draws no extra rng", () => {
  const state = fixedState({ c: { phobia: "Spiders", phobiaType: "x", wp: 5 } });
  const rng = fakeRng([1, 15, 5]);
  const events = startCombat(state, true, "Beasts", rng, []);
  fight(state, rng, events);
  assert.ok(!state.combat.afraid, "an unrelated phobia never triggers the near-death panic");
  assert.ok(!events.some((e) => e.type === "phobiaAfraid"));
});

test("startCombat+fight: Hardiness gives a near-death Death-phobic character a 50% chance to shrug off the panic (roll shrugs it off)", () => {
  const state = fixedState({ c: { phobia: "Death", phobiaType: null, wp: 10, skills: { Hardiness: 1 } } });
  const rng = fakeRng([1, 15, 5, 1]); // Hardiness roll: d(2)=1 -> shrugged off
  const events = startCombat(state, true, "Beasts", rng, []);
  fight(state, rng, events);
  assert.ok(!state.combat.afraid, "a Hardiness roll of 1 shrugs the panic off entirely");
  assert.ok(!events.some((e) => e.type === "phobiaAfraid"));
});

test("startCombat+fight: Hardiness's mitigation roll can still fail, leaving the Death-phobia Afraid penalty in place", () => {
  const state = fixedState({ c: { phobia: "Death", phobiaType: null, wp: 10, skills: { Hardiness: 1 } } });
  const rng = fakeRng([1, 15, 5, 2]); // Hardiness roll: d(2)=2 -> no shrug
  const events = startCombat(state, true, "Beasts", rng, []);
  fight(state, rng, events);
  assert.equal(state.combat.afraid, 2);
  assert.ok(events.some((e) => e.type === "phobiaAfraid" && e.rounds === 2));
});

test("liveFoes: filters to only alive foes; empty outside combat", () => {
  const state = fixedState();
  assert.deepStrictEqual(liveFoes(state), []);
  state.combat = fixedCombat([fixedFoe({ name: "A", alive: true }), fixedFoe({ name: "B", alive: false })]);
  assert.deepStrictEqual(liveFoes(state).map((f) => f.name), ["A"]);
});

// Phase 51 (INIT-01, INIT-02): re-targeted at `fight()` — the single call
// site now that `afterPlayerAction` never re-rolls. Every override branch is
// asserted via `combatJoined.why` (and, when the foes win the roll, a
// pre-emptive foeTurn runs inside this same `fight()` call, so the fakeRng
// sequence budgets for it too — the trailing value(s) are that foeTurn's own
// draws, not a second initiative roll).

test("fight: initiative — a Samurai is forced foe unless foreseen; combatJoined names why + the single foe", () => {
  const state = fixedState({ c: { sub: "Samurai" } });
  state.combat = fixedCombat([fixedFoe()], { pending: true });
  const events = fight(state, fakeRng([10, 1, 20]), []);
  const joined = events.find((e) => e.type === "combatJoined");
  assert.equal(joined.first, "foe");
  assert.equal(joined.why, "samurai");
  assert.equal(joined.mine, 10);
  assert.equal(joined.theirs, 1);
  assert.equal(joined.foe, "Target", "a single live foe is named");
});

test("fight: initiative — foresight overrides a Samurai's forced foe; why is 'foreseen', foresight consumed", () => {
  const state = fixedState({ c: { sub: "Samurai", foresight: true } });
  state.combat = fixedCombat([fixedFoe()], { pending: true });
  const events = fight(state, fakeRng([1, 10]), []);
  const joined = events.find((e) => e.type === "combatJoined");
  assert.equal(joined.first, "you");
  assert.equal(joined.why, "foreseen");
  assert.equal(state.c.foresight, false, "foresight is consumed by the roll");
});

// Phase 40 (SPELL-02, DELIBERATE RULES CHANGE): Sense Presence (`c.senses`)
// also waives every forced foe-first rule — a Samurai with c.senses up rolls
// a fair d20 pair like anyone else; with c.senses at 0 the forced-foe pin is
// untouched.
test("fight: initiative — Sense Presence waives a Samurai's forced foe; why is 'senses', senses:true rides along", () => {
  const state = fixedState({ c: { sub: "Samurai", senses: 1 } });
  state.combat = fixedCombat([fixedFoe()], { pending: true });
  const events = fight(state, fakeRng([10, 1]), []);
  const joined = events.find((e) => e.type === "combatJoined");
  assert.equal(joined.first, "you", "mine(10) >= theirs(1) — senses waived the forced clause");
  assert.equal(joined.why, "senses");
  assert.equal(joined.senses, true);
});

test("fight: initiative — senses at 0 leaves a Samurai's forced foe untouched; why stays 'samurai'", () => {
  const state = fixedState({ c: { sub: "Samurai", senses: 0 } });
  state.combat = fixedCombat([fixedFoe()], { pending: true });
  const events = fight(state, fakeRng([19, 1, 20]), []);
  const joined = events.find((e) => e.type === "combatJoined");
  assert.equal(joined.first, "foe", "senses at 0 — the forced clause still applies, byte-identical to before");
  assert.equal(joined.why, "samurai");
});

test("fight: initiative — a Fridgian's slow race forces foe; why is 'slow'", () => {
  const state = fixedState({ c: { race: "Fridgian" } });
  state.combat = fixedCombat([fixedFoe()], { pending: true });
  const events = fight(state, fakeRng([12, 5, 20]), []);
  const joined = events.find((e) => e.type === "combatJoined");
  assert.equal(joined.first, "foe");
  assert.equal(joined.why, "slow");
});

test("fight: initiative — Acute Hearing wins even on losing dice; why is 'acuteHearing'", () => {
  const state = fixedState({ c: { skills: { "Acute Hearing": 1 } } });
  state.combat = fixedCombat([fixedFoe()], { pending: true });
  const events = fight(state, fakeRng([1, 10]), []);
  const joined = events.find((e) => e.type === "combatJoined");
  assert.equal(joined.first, "you");
  assert.equal(joined.why, "acuteHearing");
});

test("fight: initiative — a Knight facing a live maxWP>=20 foe is forced foe; why is 'knight'", () => {
  const state = fixedState({ c: { sub: "Knight" } });
  state.combat = fixedCombat([fixedFoe({ maxWP: 20, wp: 20 })], { pending: true });
  const events = fight(state, fakeRng([5, 12, 20]), []);
  const joined = events.find((e) => e.type === "combatJoined");
  assert.equal(joined.first, "foe");
  assert.equal(joined.why, "knight");
});

test("fight: initiative — a Court Mage talks first at round 1; why is 'courtMage'", () => {
  const state = fixedState({ c: { sub: "Court Mage" } });
  state.combat = fixedCombat([fixedFoe()], { pending: true }); // round: 1 by fixedCombat's default
  const events = fight(state, fakeRng([5, 12, 20]), []);
  const joined = events.find((e) => e.type === "combatJoined");
  assert.equal(joined.first, "foe");
  assert.equal(joined.why, "courtMage");
});

test("fight: initiative — a plain hero has no override; combatJoined carries no why key, names the single foe", () => {
  const state = fixedState();
  state.combat = fixedCombat([fixedFoe()], { pending: true });
  const events = fight(state, fakeRng([14, 9]), []);
  const joined = events.find((e) => e.type === "combatJoined");
  assert.equal(joined.first, "you");
  assert.equal(Object.hasOwn(joined, "why"), false, "no override fired — why is omitted, not a null/false key");
  assert.equal(joined.foe, "Target");
});

test("fight: initiative — combatJoined omits foe for a multi-foe roster", () => {
  const state = fixedState();
  state.combat = fixedCombat([fixedFoe({ name: "A" }), fixedFoe({ name: "B" })], { pending: true });
  const events = fight(state, fakeRng([14, 9]), []);
  const joined = events.find((e) => e.type === "combatJoined");
  assert.equal(joined.first, "you");
  assert.equal(Object.hasOwn(joined, "foe"), false, "a foe group never names a single target");
});

// INIT-01 (SC2): the whole point of the rule — a forced-foe character (a
// Samurai here) opens the fight with the foe's turn, then STRICTLY
// alternates for the rest of the fight; the foe never gets two turns back to
// back, proven by walking the concatenated event stream across the opener
// and three subsequent player actions, all sharing ONE fakeRng.
test("fight: initiative — INIT-01 (SC2): a Samurai's forced-foe fight alternates strictly — foe turns = player actions + 1, never two in a row", () => {
  const state = fixedState({ c: { sub: "Samurai" } });
  state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })], { pending: true });
  // init x2 (10, 1 — forced foe regardless), opener foe miss (20), then three
  // rounds of (hero miss 20, foe miss 20) — 9 draws total, one shared rng.
  const rng = fakeRng([10, 1, 20, 20, 20, 20, 20, 20, 20]);
  const events = fight(state, rng, []);
  for (let i = 0; i < 3; i++) playerStrike(state, rng, events);

  const foeTurnCount = events.filter((e) => e.type === "foeMissed" || e.type === "struckByFoe").length;
  const heroTurnCount = events.filter((e) => e.type === "strikeMissed" || e.type === "struck").length;
  assert.equal(foeTurnCount, 4, "3 player actions + 1 foe-first opener = 4 foe turns");
  assert.equal(heroTurnCount, 3);

  let lastWasFoe = false;
  for (const e of events) {
    const isFoeTurn = e.type === "foeMissed" || e.type === "struckByFoe";
    const isHeroTurn = e.type === "strikeMissed" || e.type === "struck";
    if (isFoeTurn) {
      assert.equal(lastWasFoe, false, "two foe turns back to back — the removed pre-emptive re-roll is back");
      lastWasFoe = true;
    } else if (isHeroTurn) {
      lastWasFoe = false;
    }
  }
  assert.throws(() => rng.d(1), /sequence exhausted/, "the rng is fully consumed after the third strike");
  assert.equal(state.combat.round, 4);
});

// INIT-01 (once pin): `combatJoined` already fires exactly once per fight
// (fight() runs once per encounter) — this proves it holds across a real
// multi-round exchange, and that no OTHER event ever smuggles the dice.
test("fight: initiative — INIT-01: a 3-round fight emits exactly one combatJoined and no other event carries mine/theirs", () => {
  const state = fixedState({ c: { sub: "Samurai" } });
  state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })], { pending: true });
  const rng = fakeRng([10, 1, 20, 20, 20, 20, 20, 20, 20]);
  const events = fight(state, rng, []);
  for (let i = 0; i < 3; i++) playerStrike(state, rng, events);

  const joinedEvents = events.filter((e) => e.type === "combatJoined");
  assert.equal(joinedEvents.length, 1, "combatJoined fires once, never per round");
  assert.ok(
    events.every((e) => e.type === "combatJoined" || (!("mine" in e) && !("theirs" in e))),
    "no other event ever carries mine/theirs",
  );
});

// --- weaponDamage: Master of Arms "+2 with every weapon" (RULE-02) --------

test("weaponDamage: Master of Arms deals exactly +2 versus an identical non-Master-of-Arms fighter", () => {
  const plain = fixedFighter();
  const moa = fixedFighter({ sub: "Master of Arms" });
  // Same weapon (Club), same level, same rng draw for the weapon's dice ->
  // any difference in the result is solely the Master of Arms bonus.
  const dmgPlain = weaponDamage(plain, fakeRng([4]));
  const dmgMoA = weaponDamage(moa, fakeRng([4]));
  assert.equal(dmgMoA, dmgPlain + 2, "Master of Arms adds exactly +2 weapon damage");
});

// --- playerStrike ------------------------------------------------------

test("playerStrike: a Wizard refuses to melee while an attack spell is castable", () => {
  const state = fixedState({ c: { cls: "Magic User", sub: "Wizard", spellsUsed: 0, grimoire: ["Freeze"], level: 1 } });
  state.combat = fixedCombat([fixedFoe({ wp: 10 })]);
  const events = playerStrike(state, fakeRng([]), []);
  assert.deepStrictEqual(events, [{ type: "strikeRefused", reason: "wizard", spell: "Freeze" }]);
});

test("playerStrike: a hit applies weaponDamage, kills the foe on lethal wp, and clears the encounter", () => {
  const state = fixedState();
  state.combat = fixedCombat([fixedFoe({ wp: 1, maxWP: 1 })]);
  // strike d20=1 (Soldier is noCrit, so a natural 1 does NOT double here) vs
  // need=5 -> hit; club d6=3 -> dmg = level^2(1) + 3 = 4, lethal.
  // killFoe: sp d6=4, coin d10=5, treasure-check d20=20 (skips, >2+lvl),
  // cooking-fallback d6=1 (skips, type is Beasts but roll<4).
  const rng = fakeRng([1, 3, 4, 5, 20, 1]);
  const events = playerStrike(state, rng, []);
  assert.ok(events.some((e) => e.type === "struck" && e.dmg === 4 && e.critical === false));
  assert.ok(events.some((e) => e.type === "foeKilled"));
  assert.equal(state.c.kills, 1);
  assert.ok(state.c.sp > 0, "killFoe awarded skill points");
  assert.equal(state.combat, null, "the encounter clears once the only foe dies");
});

test("playerStrike: a non-lethal hit lowers wp but leaves maxWP (starting hp) unchanged (E4 regression)", () => {
  const state = fixedState();
  state.combat = fixedCombat([fixedFoe({ wp: 20, maxWP: 20 })]);
  // strike d20=1 vs need=5 -> hit; club d6=6 -> dmg = level^2(1) + 6 = 7, non-lethal
  // (20-7=13). afterPlayerAction then runs foeTurn (d20=20 vs need=5 -> miss)
  // and advances the round — no round-advance draws, initiative is rolled
  // once, Phase 51 — same pattern as the Barbarian/Ambidextrous/haste test
  // above.
  const rng = fakeRng([1, 6, 20]);
  const events = playerStrike(state, rng, []);
  assert.ok(events.some((e) => e.type === "struck" && e.dmg === 7));
  const foe = state.combat.foes[0];
  assert.equal(foe.wp, 13, "took 7 damage off 20");
  assert.equal(foe.maxWP, 20, "maxWP (starting hp) is untouched by damage — never 5/5-style collapse");
});

test("playerStrike: Barbarian, Ambidextrous, and haste each grant two attacks", () => {
  // Phase 39 (GEAR-02): the retired c.haste counter — a live "haste" item
  // effect now reads through c.timers.
  const cases = [
    { sub: "Barbarian" },
    { skills: { Ambidextrous: 1 } },
    { timers: { "item:Cloak of Speed": { cadence: "squares", left: 5, cd: 50, phase: "effect" } } },
  ];
  for (const cOverrides of cases) {
    const state = fixedState({ c: cOverrides });
    state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })]);
    // both strikes miss (roll 20 vs need 5); the still-alive foe's own swing
    // then also misses (foeDie roll 20 vs need 5); no round-advance draws —
    // initiative is rolled once, Phase 51.
    const rng = fakeRng([20, 20, 20]);
    const events = playerStrike(state, rng, []);
    const misses = events.filter((e) => e.type === "strikeMissed").length;
    assert.equal(misses, 2, `${JSON.stringify(cOverrides)} should grant 2 attacks`);
  }
});

test("playerStrike: Fridgian frenzy grants a second wild swing that always targets a live foe", () => {
  const state = fixedState({ c: { race: "Fridgian" } });
  state.combat = fixedCombat([
    fixedFoe({ name: "Corpse", wp: 0, alive: false }),
    fixedFoe({ name: "Target", wp: 999, maxWP: 999 }),
  ], { target: 1 });
  // DELIBERATE RULES CHANGE (Phase 24, race pass / IDENT-08): the prototype
  // could roll a d10 <= 5 against a dead foe here and waste the whole round
  // ("frenzyWasted") — that branch and its rng.d(10) draw are both gone.
  // frenzy roll d8=5 (<=5, triggers); both swings target the live Target and
  // miss (need 5 for the first swing; the frenzy swing's need is the normal
  // need narrowed by one (Phase 72 ROLL-01 (b)), so need 4 here — 20 beats
  // both); the still-alive Target swings back and misses (foeDie 20 vs need
  // 5). Phase 51 (INIT-01): a Fridgian's `slow` race flag no longer forces a
  // SECOND foeTurn this call — initiative is rolled once, at fight()'s Fight!
  // gate (never called by this test, which builds combat directly), and
  // afterPlayerAction no longer re-rolls or reads `C.first` at all. Four
  // draws total.
  const rng = fakeRng([5, 20, 20, 20]);
  const events = playerStrike(state, rng, []);
  assert.ok(events.some((e) => e.type === "frenzy"));
  const misses = events.filter((e) => e.type === "strikeMissed");
  assert.equal(misses.length, 2, "both frenzy swings are attempted against the live foe");
  assert.ok(
    misses.every((e) => e.target === "Target"),
    "neither swing ever targets the corpse",
  );
  assert.equal(
    events.some((e) => e.type.toLowerCase().includes("wasted")),
    false,
    "the corpse-whiff branch no longer exists",
  );
  assert.throws(
    () => rng.d(10),
    /sequence exhausted/,
    "the fakeRng is fully consumed — the whiff draw is gone, not merely unused",
  );
});

// --- Phase 72 ROLL-01 (b): frenzy's second swing, outcome-based (72-05) ----
//
// Three odds rows, driven through the shared harness (test/unit/harness/
// rollOdds.js) rather than fakeRng, so the claim is proven on SUCCESS ODDS
// (wins/N over the probed die's own faces), never on a hand-computed need
// number — matching test/unit/rollDirection.test.js's own frenzy rows,
// which these mirror as a second, independent proof.

/** withClubHarness(state) — pins the hero's weapon to Club and clears
 * skills/spell charges, mirroring test/unit/rollDirection.test.js's own
 * withClub helper, so the frenzy-swing comparison below isn't also a silent
 * weapon/skill comparison. */
function withClubHarness(state) {
  state.c.weapon = "Club";
  state.c.magicWpn = 0;
  state.c.prof = 0;
  state.c.spellsUsed = 999;
  state.c.skills = {};
  return state;
}

/** landedHarness(state, rng) — the hero's strike connected (mirrors
 * test/unit/rollDirection.test.js's own `landed` helper). */
function landedHarness(state, rng) {
  const events = [];
  playerStrike(state, rng, events);
  return events.some((e) => e.type === "struck" || e.type === "foeArmorSoaked");
}

// Ned (Humans tier 1): no sp.atk/abilities kit, the plainest single-swing foe.
const harnessNeutralFoe = () => foeFrom("Humans", 1, "Ned");

// Draw 0 = the frenzy trigger (d8), fixed at face 1 so it always fires. Draw
// 1 = swing 1's strike die, filled to its own worst face (a guaranteed
// miss) so swing 2 is reached. Draw 2 = swing 2, the row's own probed draw.
const frenzyOpts = { isProbe: (i) => i === 2, fill: (i, sides) => (i === 0 ? 1 : sides) };

test("[ROLL-01 (b)] frenzy second swing, lit Fighter: swing 2 wins = normal wins - 1", () => {
  const frenzied = () => withClubHarness(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Fridgian" }), [harnessNeutralFoe()]));
  const plain = () => withClubHarness(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [harnessNeutralFoe()]));
  const swing2 = faceOdds((rng) => landedHarness(frenzied(), rng), { ...frenzyOpts, label: "ROLL-01 (b) frenzy lit Fighter swing 2" });
  const normal = faceOdds((rng) => landedHarness(plain(), rng), { label: "ROLL-01 (b) frenzy lit Fighter normal" });
  assert.equal(swing2.n, normal.n, "[ROLL-01 (b)] the frenzy swing rolls the hero's own normal die");
  assert.equal(swing2.wins, normal.wins - 1, "[ROLL-01 (b)] a fighter's frenzy swing is exactly one face worse than normal");
});

test("[ROLL-01 (b)] frenzy second swing, lit Magic User: swing 2 wins = normal wins - 1 (canon had it EQUAL)", () => {
  const frenzied = () => withClubHarness(inCombat(heroState({ cls: "Magic User", sub: "Wizard", race: "Fridgian" }), [harnessNeutralFoe()]));
  const plain = () => withClubHarness(inCombat(heroState({ cls: "Magic User", sub: "Wizard", race: "Human" }), [harnessNeutralFoe()]));
  const swing2 = faceOdds((rng) => landedHarness(frenzied(), rng), { ...frenzyOpts, label: "ROLL-01 (b) frenzy lit MU swing 2" });
  const normal = faceOdds((rng) => landedHarness(plain(), rng), { label: "ROLL-01 (b) frenzy lit MU normal" });
  assert.equal(swing2.n, normal.n, "[ROLL-01 (b)] the frenzy swing rolls the hero's own normal die");
  assert.equal(swing2.wins, normal.wins - 1, "[ROLL-01 (b)] a magic user's frenzy swing is exactly one face worse than normal (canon left it equal)");
});

test("[ROLL-01 (b)] frenzy second swing, dark without Night Vision: never above the dark-capped normal swing, never below one face", () => {
  const frenziedDark = () => {
    const s = withClubHarness(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Fridgian" }), [harnessNeutralFoe()]));
    s.floor.g[s.floor.py][s.floor.px].dark = true;
    return s;
  };
  const plainDark = () => {
    const s = withClubHarness(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [harnessNeutralFoe()]));
    s.floor.g[s.floor.py][s.floor.px].dark = true;
    return s;
  };
  const swing2 = faceOdds((rng) => landedHarness(frenziedDark(), rng), { ...frenzyOpts, label: "ROLL-01 (b) frenzy dark swing 2" });
  const normal = faceOdds((rng) => landedHarness(plainDark(), rng), { label: "ROLL-01 (b) frenzy dark normal" });
  assert.ok(swing2.wins <= normal.wins, "[ROLL-01 (b)] the frenzy swing in the dark is never above the dark-capped normal swing");
  assert.ok(swing2.wins >= 1, "[ROLL-01 (b)] the frenzy swing never drops below the single best face against a touchable foe");
});

// audit-bugs (2026-09-09, E7): a Con Artist's opening blow is a deliberate
// no-damage "warning" (the conArtistOpener bail applies no damage). The bug:
// the opening-crit block still fired a `backstab` event first, so the game
// announced "A blade in the back. Critical." for a strike that dealt nothing.
// The fix guards that block with `c.sub !== "Con Artist"`, leaving
// conArtistOpener as the ONLY opener event and no `struck`/`backstab`.
test("playerStrike: a Con Artist's opening strike emits only conArtistOpener — no backstab, no struck, no damage (E7)", () => {
  const state = fixedState({ c: { cls: "Thief", sub: "Con Artist", skills: {} } });
  state.combat = fixedCombat([fixedFoe({ wp: 10, maxWP: 10 })]);
  // strike d20=3 vs Thief need=4 -> hit; club d6=4 (weaponDamage is computed
  // before the opener bail, so the draw is still consumed) but the damage is
  // discarded by the conArtistOpener `continue`. The foe survives untouched, so
  // afterPlayerAction runs a foe swing (d?=20 vs need 5 -> miss); no
  // round-advance draws — initiative is rolled once, Phase 51.
  const rng = fakeRng([3, 4, 20]);
  const events = playerStrike(state, rng, []);
  assert.ok(events.some((e) => e.type === "conArtistOpener"), "the warning-shot beat fires");
  assert.equal(events.some((e) => e.type === "backstab"), false, "no misleading backstab crit is announced");
  assert.equal(events.some((e) => e.type === "struck"), false, "the opener deals no damage");
  assert.equal(state.combat.foes[0].wp, 10, "the foe took no damage from the warning shot");
});

test("playerStrike: a plain (non-Con-Artist) Thief still opens with a backstab for doubled damage (E7 control)", () => {
  const state = fixedState({ c: { cls: "Thief", sub: "Pilfer", skills: {} } });
  state.combat = fixedCombat([fixedFoe({ wp: 3, maxWP: 3 })]);
  // Pilfer (a plain Thief sub — not Pickpocket, whose gainWilmst rolls extra
  // gold draws; not Cat Burglar/Ninja auto-open; not Cutthroat/Con Artist).
  // strike d20=3 vs Thief need=4 -> hit; club d6=4 -> base dmg = level^2(1)+4 = 5,
  // doubled by the backstab crit to 10, lethal against 3 wp. killFoe then draws
  // sp d6=5, coin d10=5, treasure d20=20 (skips), cooking d6=1 (skips) — the
  // encounter clears with no foe turn (only foe dead).
  const rng = fakeRng([3, 4, 5, 5, 20, 1]);
  const events = playerStrike(state, rng, []);
  assert.ok(events.some((e) => e.type === "backstab"), "a real Thief opener still backstabs");
  assert.ok(
    events.some((e) => e.type === "struck" && e.critical === true && e.dmg === 10),
    "the backstab lands doubled damage (base 5 -> 10)",
  );
  assert.ok(events.some((e) => e.type === "foeKilled"), "the doubled backstab killed the foe");
  assert.equal(state.combat, null, "the encounter clears once the only foe dies");
});

// --- killFoe -------------------------------------------------------------

test("killFoe: awards d6 x level x mul skill points, rolls coin, and calls checkLevel", () => {
  const state = fixedState();
  const foe = fixedFoe({ type: "Humans", lvl: 2, wp: 0 });
  state.combat = fixedCombat([foe]);
  // sp roll d6=4 -> raw=4*2=8, mul=5*spMul(1)*barbarian(1)*apprentice(1)=5
  // -> gained=40; coin roll d10=6 -> coin=round(6*2*12/10)=14; treasure
  // check d20=20 (skips, >2+lvl=4). Humans skips the Beasts/Lair-Beasts
  // cooking branch entirely (no extra draw).
  const events = killFoe(state, foe, fakeRng([4, 6, 20]), []);
  assert.equal(foe.alive, false);
  assert.equal(state.c.kills, 1);
  assert.equal(state.c.sp, 40);
  assert.ok(events.some((e) => e.type === "foeKilled" && e.spGained === 40));
  assert.ok(events.some((e) => e.type === "goldGained" && e.amount === 14));
});

test("killFoe: a foe with `lives: 2` gets back up once instead of dying", () => {
  const state = fixedState();
  const foe = fixedFoe({ type: "Walking Dead", wp: 0, maxWP: 5, sp: { twice: true }, lives: 2 });
  state.combat = fixedCombat([foe]);
  const events = killFoe(state, foe, fakeRng([]), []);
  assert.equal(foe.alive, true);
  assert.equal(foe.lives, 1);
  assert.equal(foe.wp, 5);
  assert.ok(events.some((e) => e.type === "foeRevived"));
});

// --- foeTurn ---------------------------------------------------------------

test("foeTurn: a landed critical hit damages the player, and wp<=0 triggers die('combat')", () => {
  const state = fixedState({ c: { wp: 1, maxWP: 55 } });
  const foe = fixedFoe({ name: "Ogre", wp: 10, maxWP: 10 });
  state.combat = fixedCombat([foe]);
  // foeDie=20-sided; raw draw 1 mirrors to roll=20 (the top face — hit +
  // critical) vs atLeast=16 (5 faces); dmg = lvl^2(1) + 2*d6(6) = 13 --
  // lethal against 1 wp. Phase 52 (DMG-02, 2026-09-20): a crit doubles the
  // DICE only (was 14 under the old whole-sum-doubling rule: 2*(1+6)).
  const rng = fakeRng([1, 6]);
  const events = foeTurn(state, rng, []);
  assert.equal(state.dead, true);
  assert.ok(events.some((e) => e.type === "struckByFoe" && e.dmg === 13 && e.critical === true));
  assert.ok(events.some((e) => e.type === "died" && e.cause === "combat"));
});

test("foeTurn: armor soaks a blow that lands under the character's AR", () => {
  const state = fixedState({ c: { wp: 55, maxWP: 55, ar: 15, armorWP: 20, armorMax: 20, armorMin: 0, armor: "Studded" } });
  const foe = fixedFoe({ wp: 10, maxWP: 10 });
  state.combat = fixedCombat([foe]);
  // foeDie raw draw 3 mirrors to roll=18 (hit, no crit) vs atLeast=16; dmg = 1 + d6(4) = 5; armor soak
  // roll d20=10 <= ar(15) -> the armor takes it, player wp untouched.
  const rng = fakeRng([3, 4, 10]);
  const events = foeTurn(state, rng, []);
  assert.equal(state.c.wp, 55, "the armor absorbed the hit");
  assert.equal(state.c.armorWP, 15, "5 damage came off the armor's wp");
  assert.ok(events.some((e) => e.type === "armorSoaked"));
});

// audit-bugs (2026-09-09, E8): the Cloak of Armor (eff:{cloakArmor:1}, "a full
// suit of plate that weighs nothing") was inert — cloakArmor was read nowhere.
// Wired via engine/derived.js#armorSoak: a cloak-bearer's effective armour is
// PLATE (ar:15), take-the-better of the cloak's plate and the worn armour, and
// the magical plate never wears out.
test("foeTurn: a Leather-wearer holding the Cloak of Armor soaks as Plate — AR 15, not Leather's 6 (E8)", () => {
  // 260918-w4n (use-activated-only): the cloak's plate applies only while
  // its own item:Cloak of Armor record is LIVE.
  const state = fixedState({
    c: {
      wp: 55, maxWP: 55,
      armor: "Leather", ar: 6, armorWP: 15, armorMax: 15, armorMin: 1,
      items: [{ n: "Cloak of Armor", eff: { cloakArmor: 1 } }],
      timers: { "item:Cloak of Armor": { cadence: "squares", left: 50, cd: 50, phase: "effect" } },
    },
  });
  const foe = fixedFoe({ wp: 10, maxWP: 10 });
  state.combat = fixedCombat([foe]);
  // foeDie raw draw 3 mirrors to roll=18 (hit, no crit) vs atLeast=16; dmg = 1 + d6(4) = 5; armor soak
  // roll d20=12 — this is the crux: 12 > Leather's ar 6 (would have hit the
  // player) but 12 <= the cloak's Plate ar 15, so it lands on the (magical,
  // non-degrading) plate instead.
  const rng = fakeRng([3, 4, 12]);
  const events = foeTurn(state, rng, []);
  assert.equal(state.c.wp, 55, "the cloak's plate (AR 15) soaked a blow leather's AR 6 would have taken");
  assert.equal(state.c.armorWP, 15, "the weightless magical plate does not wear out — worn-armour wp untouched");
  assert.ok(events.some((e) => e.type === "armorSoaked"));
  assert.equal(events.some((e) => e.type === "armorDestroyed"), false, "the magical plate is never destroyed");
});

test("foeTurn: the SAME Leather-wearer WITHOUT the cloak takes the blow — soaks only as Leather AR 6 (E8 control)", () => {
  const state = fixedState({
    c: {
      wp: 55, maxWP: 55,
      armor: "Leather", ar: 6, armorWP: 15, armorMax: 15, armorMin: 1,
      items: [],
    },
  });
  const foe = fixedFoe({ wp: 10, maxWP: 10 });
  state.combat = fixedCombat([foe]);
  // Identical foe swing and soak roll as above (roll d20=12); with no cloak the
  // effective AR is Leather's 6, so 12 > 6 misses the armour and the 5 damage
  // lands on the player — proving the previous test's soak came from the cloak.
  const rng = fakeRng([3, 4, 12]);
  const events = foeTurn(state, rng, []);
  assert.equal(state.c.wp, 50, "without the cloak, AR 6 can't stop a soak roll of 12 — the player takes 5");
  assert.equal(state.c.armorWP, 15, "the blow bypassed the armour entirely, so its wp is untouched");
  assert.ok(events.some((e) => e.type === "struckByFoe" && e.dmg === 5));
  assert.equal(events.some((e) => e.type === "armorSoaked"), false, "leather's AR 6 did not soak this blow");
});

test("foeTurn: a sleeping foe skips its turn without drawing a die", () => {
  const state = fixedState();
  const foe = fixedFoe({ asleep: 3 });
  state.combat = fixedCombat([foe]);
  const events = foeTurn(state, fakeRng([]), []);
  assert.equal(foe.asleep, 2);
  assert.ok(events.some((e) => e.type === "foeSlept"));
});

// --- applyFoeDamageToPlayer (Phase 17, FID-03) ------------------------------

test("applyFoeDamageToPlayer: a plain hit with no armour lands on the hero, key order pinned", () => {
  const state = fixedState();
  const foe = fixedFoe();
  state.combat = fixedCombat([foe]);
  const events = [];
  const result = applyFoeDamageToPlayer(state, foe, fakeRng([]), events, { dmg: 5, roll: 18, atLeast: 16, dieN: 20 });
  assert.deepEqual(result, { died: false, onArmour: false, applied: 5 });
  assert.equal(state.c.wp, 50);
  const struck = events.find((e) => e.type === "struckByFoe");
  assert.deepStrictEqual(struck, {
    type: "struckByFoe",
    name: "Target",
    roll: 18,
    atLeast: 16,
    dieN: 20,
    dmg: 5,
    ignoresArmor: false,
    critical: false,
  });
  assert.deepEqual(Object.keys(struck), ["type", "name", "roll", "atLeast", "dieN", "dmg", "ignoresArmor", "critical"], "event key order pinned");
});

test("applyFoeDamageToPlayer: Hardiness reduces damage by 3, floored at 1", () => {
  const state = fixedState({ c: { skills: { Hardiness: 1 } } });
  const foe = fixedFoe();
  state.combat = fixedCombat([foe]);
  applyFoeDamageToPlayer(state, foe, fakeRng([]), [], { dmg: 5, roll: 18, atLeast: 16, dieN: 20 });
  assert.equal(state.c.wp, 53, "5 - 3 = 2 damage");
  applyFoeDamageToPlayer(state, foe, fakeRng([]), [], { dmg: 2, roll: 18, atLeast: 16, dieN: 20 });
  assert.equal(state.c.wp, 52, "floor(1): 2 - 3 would be negative, clamped to 1 damage, never 0 or less");
});

test("applyFoeDamageToPlayer: halfNext (Pendant of Fortitude) ceil-halves once then clears", () => {
  const state = fixedState({ c: { halfNext: true } });
  const foe = fixedFoe();
  state.combat = fixedCombat([foe]);
  const events = [];
  applyFoeDamageToPlayer(state, foe, fakeRng([]), events, { dmg: 5, roll: 18, atLeast: 16, dieN: 20 });
  assert.equal(state.c.wp, 52, "ceil(5/2) = 3 damage");
  assert.equal(state.c.halfNext, false, "single-charge buffer clears after use");
  assert.deepEqual(events.map((e) => e.type), ["damageHalved", "struckByFoe"]);
});

test("applyFoeDamageToPlayer: Hardiness applies BEFORE halfNext", () => {
  const state = fixedState({ c: { skills: { Hardiness: 1 }, halfNext: true } });
  const foe = fixedFoe();
  state.combat = fixedCombat([foe]);
  const events = [];
  applyFoeDamageToPlayer(state, foe, fakeRng([]), events, { dmg: 5, roll: 18, atLeast: 16, dieN: 20 });
  // Hardiness: 5 -> 2; halfNext: ceil(2/2) -> 1.
  assert.equal(state.c.wp, 54);
  const struck = events.find((e) => e.type === "struckByFoe");
  assert.equal(struck.dmg, 1);
});

test("applyFoeDamageToPlayer: a ward absorbs the blow fully, no struckByFoe, zero draws", () => {
  const state = fixedState({ c: { ward: { pool: 10, rounds: 3 } } });
  const foe = fixedFoe();
  state.combat = fixedCombat([foe]);
  const events = [];
  const result = applyFoeDamageToPlayer(state, foe, fakeRng([]), events, { dmg: 5, roll: 18, atLeast: 16, dieN: 20 });
  assert.deepEqual(events, [{ type: "wardAbsorbed", amount: 5, remaining: 5 }]);
  assert.equal(state.c.wp, 55, "the hero took no damage");
  assert.equal(state.c.ward.pool, 5);
  assert.equal(events.some((e) => e.type === "struckByFoe"), false);
  assert.deepEqual(result, { died: false, onArmour: false, applied: 0 });
});

test("applyFoeDamageToPlayer: a ward shatters partway and the remainder lands", () => {
  const state = fixedState({ c: { ward: { pool: 3, rounds: 3 } } });
  const foe = fixedFoe();
  state.combat = fixedCombat([foe]);
  const events = [];
  applyFoeDamageToPlayer(state, foe, fakeRng([]), events, { dmg: 5, roll: 18, atLeast: 16, dieN: 20 });
  assert.deepEqual(events.map((e) => e.type), ["wardAbsorbed", "wardShattered", "struckByFoe"]);
  assert.equal(state.c.ward, null);
  assert.equal(state.c.wp, 53, "5 - 3 absorbed = 2 damage lands");
});

// RULES-14 (Phase 75, user 2026-09-25): Bubble is a one-shot mirror, re-pinned
// from the old reflect-the-soaked-share shape. See test/unit/bubble-mirror.test.js
// for the full mirror/pop-pool behaviour.
test("applyFoeDamageToPlayer: an armed mirror reflects the whole blow, kills the FOE, and returns died:false (Pitfall 1)", () => {
  const state = fixedState({ c: { ward: { name: "Bubble", mirror: true, pool: 0, popPool: 25, rounds: null } } });
  const foe = fixedFoe({ wp: 3, maxWP: 3 });
  state.combat = fixedCombat([foe]);
  const events = [];
  // killFoe's four draws: d6 sp(1), d10 coin(1), d20 item(20 -> none), d6 cook(1 -> none).
  const result = applyFoeDamageToPlayer(state, foe, fakeRng([1, 1, 20, 1]), events, { dmg: 5, roll: 18, atLeast: 16, dieN: 20 });
  assert.deepEqual(events.map((e) => e.type), ["wardReflected", "foeKilled"]);
  assert.ok(events.some((e) => e.type === "wardReflected" && e.target === "Target" && e.amount === 5 && e.mirror === true));
  assert.equal(foe.alive, false);
  assert.equal(state.c.wp, 55, "the hero took no damage from a foe's own reflect-death");
  assert.deepEqual(result, { died: false, onArmour: false, applied: 0 });
  assert.notEqual(state.combat, null, "state.combat is untouched — only the hero's own death nulls it");
  assert.deepEqual(state.c.ward, { name: "Bubble", pool: 25, rounds: 1 }, "the mirror still pops even on a reflect-kill");
});

test("applyFoeDamageToPlayer: armour soaks the blow", () => {
  const state = fixedState({ c: { ar: 15, armorWP: 20, armorMax: 20, armorMin: 0, armor: "Studded" } });
  const foe = fixedFoe();
  state.combat = fixedCombat([foe]);
  const events = [];
  const rng = fakeRng([10]);
  const result = applyFoeDamageToPlayer(state, foe, rng, events, { dmg: 5, roll: 18, atLeast: 16, dieN: 20 });
  assert.deepEqual(result, { died: false, onArmour: true, applied: 0 });
  assert.ok(events.some((e) => e.type === "armorSoaked" && e.name === "Target" && e.amount === 5));
  assert.equal(state.c.armorWP, 15);
  assert.equal(state.c.wp, 55, "the hero took no damage");
  assert.equal(events.some((e) => e.type === "struckByFoe"), false);
  assert.throws(() => rng.d(20), /sequence exhausted/, "exactly one soak draw was consumed");
});

test("applyFoeDamageToPlayer: an armour soak roll that fails lets the blow through", () => {
  const state = fixedState({ c: { ar: 15, armorWP: 20, armorMax: 20, armorMin: 0, armor: "Studded" } });
  const foe = fixedFoe();
  state.combat = fixedCombat([foe]);
  const events = [];
  const result = applyFoeDamageToPlayer(state, foe, fakeRng([16]), events, { dmg: 5, roll: 18, atLeast: 16, dieN: 20 });
  assert.equal(state.c.wp, 50);
  assert.ok(events.some((e) => e.type === "struckByFoe" && e.dmg === 5));
  assert.equal(result.onArmour, false);
});

test("applyFoeDamageToPlayer: armour destroyed at 0 wp emits armorDestroyed and armorSoaked", () => {
  const state = fixedState({ c: { ar: 15, armorWP: 3, armorMax: 20, armorMin: 0, armor: "Studded" } });
  const foe = fixedFoe();
  state.combat = fixedCombat([foe]);
  const events = [];
  applyFoeDamageToPlayer(state, foe, fakeRng([10]), events, { dmg: 5, roll: 18, atLeast: 16, dieN: 20 });
  assert.equal(state.c.armorWP, 0);
  assert.deepEqual(events.map((e) => e.type), ["armorDestroyed", "armorSoaked"]);
});

test("applyFoeDamageToPlayer: a noArmor foe skips the soak draw entirely", () => {
  const state = fixedState({ c: { ar: 15, armorWP: 20, armorMax: 20, armorMin: 0, armor: "Studded" } });
  const foe = fixedFoe({ sp: { noArmor: true } });
  state.combat = fixedCombat([foe]);
  const events = [];
  const result = applyFoeDamageToPlayer(state, foe, fakeRng([]), events, { dmg: 5, roll: 18, atLeast: 16, dieN: 20 });
  assert.equal(state.c.wp, 50);
  assert.ok(events.some((e) => e.type === "struckByFoe" && e.ignoresArmor === true));
  assert.equal(result.onArmour, false);
});

test("applyFoeDamageToPlayer: lethal damage returns died:true and die() ran", () => {
  const state = fixedState({ c: { wp: 1 } });
  const foe = fixedFoe();
  state.combat = fixedCombat([foe]);
  const events = [];
  const result = applyFoeDamageToPlayer(state, foe, fakeRng([]), events, { dmg: 5, roll: 18, atLeast: 16, dieN: 20 });
  assert.deepEqual(result, { died: true, onArmour: false, applied: 5 });
  assert.equal(state.dead, true);
  assert.equal(state.combat, null);
  assert.deepEqual(events.map((e) => e.type), ["struckByFoe", "died"]);
  assert.equal(events[1].cause, "combat");
});

test("applyFoeDamageToPlayer: the critical flag mirrors the die's top face (roll===dieN) and dmg is applied verbatim (no re-doubling)", () => {
  const state = fixedState();
  const foe = fixedFoe();
  state.combat = fixedCombat([foe]);
  const events = [];
  applyFoeDamageToPlayer(state, foe, fakeRng([]), events, { dmg: 14, roll: 20, atLeast: 16, dieN: 20 });
  const struck = events.find((e) => e.type === "struckByFoe");
  assert.equal(struck.critical, true);
  assert.equal(struck.dmg, 14);
  assert.equal(state.c.wp, 41);
});

// --- foeTurn control flow through the helpers (Phase 17, FID-03) -----------

// RULES-14 (Phase 75): re-pinned for the armed-mirror shape. After the
// reflect-kill the mirror pops into a 25 hp pool for the rest of THIS round
// — since this foeTurn call is that same round, the tail tick always fades
// it (rounds: 1 -> 0) before the call returns.
test("foeTurn: an armed mirror reflect-kill mid-swing continues to the next foe, pops into a pool, and the tail tick fades that pool", () => {
  const state = fixedState({ c: { ward: { name: "Bubble", mirror: true, pool: 0, popPool: 25, rounds: null }, mirror: 0 } });
  const foeA = fixedFoe({ name: "A", wp: 3, maxWP: 3 });
  const foeB = fixedFoe({ name: "B", wp: 10, maxWP: 10 });
  state.combat = fixedCombat([foeA, foeB]);
  // A: to-hit d20(3) hit, dmg 1+d6(4)=5 -> reflected for 5 -> A dies via
  // killFoe's four draws (d6 sp=1, d10 coin=1, d20 item=20, d6 cook=1).
  // B: to-hit d20(7) > need(5) -> miss.
  const events = foeTurn(state, fakeRng([3, 4, 1, 1, 20, 1, 7]), []);
  assert.deepEqual(events.map((e) => e.type), ["wardReflected", "foeKilled", "foeMissed", "wardFaded"]);
  assert.equal(foeA.alive, false);
  assert.equal(foeB.alive, true);
  assert.equal(foeB.wp, 10);
  assert.equal(state.c.wp, 55, "the hero took no damage");
  assert.equal(state.c.ward, null, "the popped pool faded at the tail of this same foe turn");
  assert.equal(state.dead, false);
});

test("foeTurn: the hero dying mid-loop returns immediately — remaining foes never swing and the ward tick is skipped", () => {
  const state = fixedState({ c: { wp: 1, ward: { pool: 0, rounds: 3 }, mirror: 0 } });
  const foeA = fixedFoe({ name: "A" });
  const foeB = fixedFoe({ name: "B" });
  state.combat = fixedCombat([foeA, foeB]);
  const events = foeTurn(state, fakeRng([3, 4]), []);
  assert.deepEqual(events.map((e) => e.type), ["struckByFoe", "died"]);
  assert.equal(state.dead, true);
  assert.equal(state.combat, null);
});

test("foeTurn: a partial ward absorb shatters the ward and the remainder lands", () => {
  const state = fixedState({ c: { ward: { pool: 3, rounds: 3 } } });
  const foe = fixedFoe();
  state.combat = fixedCombat([foe]);
  const events = foeTurn(state, fakeRng([3, 4]), []);
  assert.deepEqual(events.map((e) => e.type), ["wardAbsorbed", "wardShattered", "struckByFoe"]);
  const struck = events.find((e) => e.type === "struckByFoe");
  assert.equal(struck.dmg, 2);
  assert.equal(state.c.wp, 53);
  assert.equal(state.c.ward, null);
});

test("foeTurn: Hardiness then halfNext, in that order", () => {
  const state = fixedState({ c: { skills: { Hardiness: 1 }, halfNext: true } });
  const foe = fixedFoe();
  state.combat = fixedCombat([foe]);
  const events = foeTurn(state, fakeRng([3, 4]), []);
  assert.deepEqual(events.map((e) => e.type), ["damageHalved", "struckByFoe"]);
  const struck = events.find((e) => e.type === "struckByFoe");
  assert.equal(struck.dmg, 1);
  assert.equal(state.c.wp, 54);
  assert.equal(state.c.halfNext, false);
});

// --- flee ------------------------------------------------------------------

test("flee: a Samurai refuses to run", () => {
  const state = fixedState({ c: { sub: "Samurai" } });
  state.combat = fixedCombat([fixedFoe()]);
  const events = flee(state, fakeRng([]), []);
  assert.deepStrictEqual(events, [{ type: "fleeRefused", reason: "samurai" }]);
});

test("flee: a Cloaker always gets away, for free", () => {
  const state = fixedState({ c: { cls: "Thief", sub: "Cloaker" } });
  state.combat = fixedCombat([fixedFoe()]);
  const events = flee(state, fakeRng([]), []);
  assert.ok(events.some((e) => e.type === "fled" && e.reason === "cloaker"));
  assert.equal(state.combat, null);
});

test("flee: a Thief's +5 bonus can turn a marginal roll into a clean escape", () => {
  // Phase 42 (FLEE-01): need is now 14 (was 11) — a Human Thief's only
  // modifier is the Thief +5, so the marginal roll moves from 6 to 9.
  const state = fixedState({ c: { cls: "Thief", sub: "Cat Burglar" } });
  state.combat = fixedCombat([fixedFoe()]);
  const events = flee(state, fakeRng([9]), []); // 9 + 5 = 14 >= 14
  assert.ok(events.some((e) => e.type === "fled" && e.reason === "escaped"));
  assert.equal(state.combat, null);
});

test("flee: a failed roll triggers the foe's turn and advances the round", () => {
  const state = fixedState();
  const foe = fixedFoe({ asleep: 5 }); // asleep -> foeTurn draws nothing
  state.combat = fixedCombat([foe]);
  const events = flee(state, fakeRng([1]), []); // 1 + 0 bonus < 11
  assert.ok(events.some((e) => e.type === "fleeFailed"));
  assert.equal(state.combat.round, 2);
});

// --- canParley / parley ------------------------------------------------

test("canParley: Con Artist/Woodsman/Bard/Wilmsry/Elven gates match the prototype", () => {
  const mk = (cOverrides, type) => {
    const state = fixedState({ c: cOverrides });
    state.combat = fixedCombat([], { type });
    return state;
  };
  assert.equal(canParley(mk({ sub: "Con Artist" }, "Magical")), false, "Magical needs fluency 2 (D-11); fluency 0 here");
  assert.equal(canParley(mk({ sub: "Con Artist" }, "Humans")), true);
  assert.equal(canParley(mk({ sub: "Woodsman" }, "Beasts")), true);
  assert.equal(canParley(mk({ sub: "Woodsman" }, "Humans")), false);
  assert.equal(canParley(mk({ sub: "Bard" }, "Humans")), true);
  assert.equal(canParley(mk({ race: "Wilmsry" }, "Beasts")), true);
  assert.equal(canParley(mk({ race: "Wilmsry" }, "Magical")), false);
  assert.equal(canParley(mk({ race: "Elven" }, "Humans")), true);
  assert.equal(canParley(mk({ race: "Elven" }, "Beasts")), false);
  assert.equal(canParley(mk({}, "Demons")), false);
  assert.equal(canParley(mk({}, "Humans")), false);
  // D-11: Walking Dead is refused for everyone, even a Con Artist.
  assert.equal(canParley(mk({ sub: "Con Artist" }, "Walking Dead")), false);
  // Phase 38 (ABIL-02): Language is retired outright — a planted Language
  // skill changes nothing versus a plain {} character (both fluency 0).
  assert.equal(canParley(mk({ skills: { Language: 1 } }, "Demons")), canParley(mk({}, "Demons")));
  // Fluency now maxes at 1 (a tongue item alone) — the fluency-2 Magical
  // gate is unreachable for anyone, including a Con Artist with the Helm.
  assert.equal(
    canParley(mk({ sub: "Con Artist", items: [{ n: "Helm of Knowledge", eff: { tongue: 1 } }] }, "Magical")),
    false,
  );
});

test("parley: a Con Artist can always parley, and success ends combat with skill points", () => {
  const state = fixedState({ c: { sub: "Con Artist" } });
  const foe = fixedFoe({ type: "Humans" });
  state.combat = fixedCombat([foe]);
  // D-07: bonus = 4 (Con Artist) + level(1) - top(1) = 4; need = min(9+4,17)
  // = 13. roll=10 <= 13 -> success. per-foe sp roll d6=3 -> combatEquivalent
  // = killSpFor(Human, lvl 1, 3) = round(3*1 * 5*1*1*1) = 15 -> sp =
  // round(15 * 0.5) = 8 (D-01/D-02 — the same 8 the old formula happened to
  // give). Humans wilmst check d6=2 (not 6, skipped — D-03).
  const rng = fakeRng([10, 3, 2]);
  const events = parley(state, rng, []);
  assert.ok(events.some((e) => e.type === "spGained" && e.reason === "parley" && e.amount === 8));
  // Phase 73 (ROLL-05): the old `need` (13) is the same faces count, now
  // read as atLeast = 21 - 13 = 8 on a d20.
  assert.ok(events.some((e) => e.type === "parleyRolled" && e.atLeast === 8 && e.dieN === 20 && e.fluency === 0));
  assert.equal(state.combat, null);
});

test("parley: a failing roll triggers the foe's turn instead of ending combat", () => {
  const state = fixedState({ c: { sub: "Con Artist" } });
  const foe = fixedFoe({ type: "Humans", asleep: 5 });
  state.combat = fixedCombat([foe]);
  // D-07/D-08: 20 > need(13) -> fails; the failure runs afterPlayerAction,
  // whose asleep-foe foeTurn draws nothing, and the round-advance draws
  // nothing either — initiative is rolled once, Phase 51.
  const rng = fakeRng([20]);
  const events = parley(state, rng, []);
  assert.ok(events.some((e) => e.type === "parleyFailed"));
  assert.ok(state.combat, "combat is still active after a failed parley");
  const failedIdx = events.findIndex((e) => e.type === "parleyFailed");
  const insultedIdx = events.findIndex((e) => e.type === "parleyInsulted");
  assert.ok(insultedIdx > failedIdx, "parleyInsulted comes AFTER parleyFailed");
  assert.equal(state.combat.parleyInsulted, true);
  assert.equal(state.combat.parleyTried, true);
});

test("D-05: the second parley in the same encounter is refused with parleyExhausted and draws nothing", () => {
  const state = fixedState({ c: { sub: "Con Artist" } });
  const foe = fixedFoe({ type: "Humans", asleep: 5 });
  state.combat = fixedCombat([foe]);
  parley(state, fakeRng([20]), []); // first attempt: fails, sets parleyTried/parleyInsulted
  assert.equal(canParley(state), false, "the button hides once tried");
  const snapshot = structuredClone(state);
  const events = parley(state, fakeRng([]), []);
  assert.deepStrictEqual(events, [{ type: "parleyExhausted" }]);
  assert.deepStrictEqual(state, snapshot, "no further state change on a re-sent parley");
});

test("D-06/D-20: parleyInsulted widens the foe's atLeast by one more top face on the hero branch, the mirrored roll is untouched", () => {
  const baseline = fixedState();
  const foe = fixedFoe({ type: "Beasts", lvl: 1 });
  baseline.combat = fixedCombat([foe]);
  const baselineEvents = foeTurn(baseline, fakeRng([6, 3]), []);
  const missed = baselineEvents.find((e) => e.type === "foeMissed");
  assert.ok(missed, "baseline: foeToHitVs is 5 faces (atLeast 16 of 20), the mirrored roll 15 misses");
  assert.equal(missed.atLeast, 16);
  assert.equal(missed.dieN, 20);
  assert.equal(missed.roll, 15, "raw draw 6 mirrors to 21 - 6 = 15");
  assert.equal(baseline.c.wp, 55);

  const insulted = fixedState();
  const insultedFoe = fixedFoe({ type: "Beasts", lvl: 1 });
  insulted.combat = fixedCombat([insultedFoe], { parleyInsulted: true });
  const insultedEvents = foeTurn(insulted, fakeRng([6, 3]), []);
  const struck = insultedEvents.find((e) => e.type === "struckByFoe");
  assert.ok(struck, "insulted: atLeast widens by one more top face (16 -> 15), the same mirrored roll 15 now hits");
  assert.ok(struck.atLeast === 15, "D-06/D-20: struck.atLeast === 15 (one more top face than the baseline's 16)");
  assert.equal(struck.roll, 15, "the narrated roll is the mirrored face, unmodified by the insult");
  assert.equal(struck.dmg, 4, "1 + d6(3)");
  assert.equal(insulted.c.wp, 51);
});

// LO-03 regression: Math.max(...liveFoes(state).map(...)) would evaluate to
// -Infinity with zero live foes, inflating `bonus` to +Infinity and making
// parley un-failable. Currently unreachable via startCombat/afterPlayerAction
// (state.combat is nulled the instant liveFoes empties), so this test forces
// the edge directly by leaving state.combat non-null with only dead foes.
test("LO-03: parley with zero live foes is a safe no-op, not a Math.max(...[]) crash/exploit", () => {
  const state = fixedState({ c: { sub: "Con Artist" } });
  const foe = fixedFoe({ type: "Humans", alive: false });
  state.combat = fixedCombat([foe]);
  const events = parley(state, fakeRng([]), []);
  assert.equal(events.length, 0, "no rng draws, no events -- a clean no-op");
  assert.ok(state.combat, "combat state is left untouched, not corrupted");
});

// --- songReady / sing --------------------------------------------------

test("songReady: only a Bard, and only every 100 squares", () => {
  const bard = fixedState({ c: { sub: "Bard" }, steps: 150 });
  assert.equal(songReady(bard), true, "no songAt yet -> always ready");
  bard.c.songAt = 100;
  assert.equal(songReady(bard), false, "50 squares since the last song");
  const notBard = fixedState({ c: { sub: "Soldier" }, steps: 500 });
  assert.equal(songReady(notBard), false);
});

test("sing: a Bard's highest available song can put foes to sleep", () => {
  const state = fixedState({ c: { sub: "Bard", level: 3 } });
  const foeA = fixedFoe({ name: "A" });
  const foeB = fixedFoe({ name: "B" });
  state.combat = fixedCombat([foeA, foeB]);
  // level 3 -> "Lullaby": n=d6=2 -> both foes asleep for 24 rounds. sing()
  // then runs afterPlayerAction in the SAME call, whose foeTurn immediately
  // decrements each now-asleep foe by 1 (23, not 24) without drawing a die;
  // the round-advance draws nothing — initiative is rolled once, Phase 51.
  const rng = fakeRng([2]);
  const events = sing(state, rng, []);
  assert.ok(events.some((e) => e.type === "sang" && e.song === "Lullaby"));
  assert.equal(foeA.asleep, 23);
  assert.equal(foeB.asleep, 23);
});

// --- endCombat / afterPlayerAction / allyTurn ---------------------------

test("endCombat: clears combat/ward/regen/mirror and adds c.senses=0 even on a fresh character", () => {
  const state = fixedState();
  state.combat = fixedCombat([]);
  assert.equal("senses" in state.c, false);
  const events = endCombat(state, []);
  assert.equal(state.combat, null);
  assert.equal(state.c.senses, 0, "matches the prototype's own side effect of adding this field");
  assert.ok(events.some((e) => e.type === "combatEnded"));
});

test("afterPlayerAction: clearing the last foe ends combat without a foe turn", () => {
  const state = fixedState();
  state.combat = fixedCombat([fixedFoe({ alive: false })]);
  const events = afterPlayerAction(state, fakeRng([]), []);
  assert.ok(events.some((e) => e.type === "encounterCleared"));
  assert.equal(state.combat, null);
});

test("allyTurn: a summoned ally strikes for the player and eventually departs", () => {
  const state = fixedState();
  const foe = fixedFoe({ wp: 4 });
  state.combat = fixedCombat([foe], { ally: { lvl: 1, rounds: 1, name: "A shape that hurts to look at" } });
  // ally strike die: STRIKE_DICE[0]=20-sided; roll=3 (<=5, hits); dmg =
  // lvl^2(1) + d6(6) = 7, lethal against 4 wp -> killFoe fires (sp d6=2,
  // coin d10=1, treasure-check d20=20 skip, Beasts cooking-fallback d6=1 skip).
  const rng = fakeRng([3, 6, 2, 1, 20, 1]);
  const events = allyTurn(state, rng, []);
  assert.ok(events.some((e) => e.type === "allyStruck"));
  assert.ok(events.some((e) => e.type === "foeKilled"));
  assert.ok(events.some((e) => e.type === "allyDeparted"));
  assert.equal(state.combat.ally, null);
});

// --- high-depth regression (03-02, RUN-02/RUN-03) --------------------------
//
// endless descent (Plan 02) means state.floor.depth can grow arbitrarily
// large with no cap. Phase 54 (BAND-02, USER RULING D) replaces the retired
// floor-range foe-count ceiling with FOE_COUNT_TABLE (identity row 0 tops
// out at 3, same as canon) — this sweep proves both the tier clamp
// (foe.lvl <= 5) and the count clamp stay BOUNDED at absurd depth.

test("startCombat: foe tier and count clamps stay bounded at arbitrarily large floor.depth", () => {
  // Read the roster off the "encounterStarted" event rather than
  // state.combat.foes after the call: at max level 5 a foe going first
  // (rollInitiative can resolve "foe") may hit hard enough to kill this
  // fixed-wp test character in the SAME startCombat call (foeTurn runs
  // inline when first === "foe"), which nulls state.combat via die/endCombat
  // — irrelevant to what this test is actually proving (the roster startCombat
  // BUILT was already tier/count-clamped before any of that happens).
  for (const depth of [5, 20, 50, 100, 1000]) {
    const state = fixedState({ c: { level: 5 }, floor: { depth } });
    const events = startCombat(state, false, "Beasts", makeRng(depth), []);
    const started = events.find((e) => e.type === "encounterStarted");
    assert.ok(started, `depth ${depth}: startCombat should produce an encounter`);
    for (const foe of started.foes) {
      assert.ok(foe.lvl <= 5, `depth ${depth}: foe level ${foe.lvl} must stay <= 5 (tier clamp)`);
      assert.ok(foe.lvl >= 1, `depth ${depth}: foe level ${foe.lvl} must stay >= 1`);
    }
    assert.ok(
      started.foes.length <= FOE_COUNT_MAX,
      `depth ${depth}: foe count ${started.foes.length} must stay <= FOE_COUNT_MAX (${FOE_COUNT_MAX})`,
    );
  }
});

// --- purity -----------------------------------------------------------

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

test("combat.js references no Math.random/document/localStorage", () => {
  const src = stripComments(fs.readFileSync(path.join(REPO_ROOT, "engine", "combat.js"), "utf8"));
  assert.ok(!/Math\.random/.test(src));
  assert.ok(!/\bdocument\b/.test(src));
  assert.ok(!/\blocalStorage\b/.test(src));
});

// --- regression: DoT/reflect kills during foeTurn must end combat ----------

test("afterPlayerAction: an acid tick that kills the last foe during foeTurn ends combat", () => {
  // Regression (DR13): a foe can die from an acid-over-time tick INSIDE
  // foeTurn, not only from the player's strike. afterPlayerAction only checked
  // liveFoes BEFORE foeTurn, so the encounter stayed open with nothing left to
  // fight — the player was stranded on the combat screen and had to flee out.
  const state = fixedState();
  const foe = fixedFoe({ wp: 1, maxWP: 10, acid: { rounds: 2, dmg: { n: 1, sides: 6 } } });
  state.combat = fixedCombat([foe]);

  const events = afterPlayerAction(state, makeRng(5), []);

  assert.ok(events.some((e) => e.type === "acidTick"), "acid ticked this foeTurn");
  assert.equal(foe.alive, false, "the tick killed the foe");
  assert.equal(state.combat, null, "combat ends instead of stranding the player");
  assert.ok(events.some((e) => e.type === "encounterCleared"), "encounterCleared emitted");
});

// --- Phase 18: damageFoe routing + slow (CANON-01/03/04/05) ---------------

test("playerStrike: natural armour soaks a blow (roll <= sp.ar): foeArmorSoaked, no struck, wp unchanged, exactly one extra d20", () => {
  const state = fixedState();
  const foe = fixedFoe({ sp: { ar: 12 }, wp: 10, maxWP: 10 });
  state.combat = fixedCombat([foe]);
  // strike d20=3 vs need=5 -> hit; club d6=4 -> dmg=5; armor soak d20=5 <= ar 12
  // -> soaked, no struck; foe's own swing (foeDie 7) misses; no round-advance
  // draws — initiative is rolled once, Phase 51.
  const rng = fakeRng([3, 4, 5, 7]);
  const events = playerStrike(state, rng, []);
  // raw draw 5 mirrors to face 16 on a d20; atLeastFor(ar 12, 20) = 9.
  assert.deepEqual(events.find((e) => e.type === "foeArmorSoaked"), { type: "foeArmorSoaked", name: "Target", amount: 5, roll: 16, atLeast: 9, dieN: 20 });
  assert.equal(events.some((e) => e.type === "struck"), false, "a soaked blow emits no struck event");
  assert.equal(foe.wp, 10, "the armor absorbed the blow entirely");
  assert.equal(state.combat.round, 2);
  assert.throws(() => rng.d(20), /sequence exhausted/, "exactly one extra d20 (the soak roll) was drawn");
});

test("playerStrike: a soak roll above sp.ar lets the blow land", () => {
  const state = fixedState();
  const foe = fixedFoe({ sp: { ar: 12 }, wp: 10, maxWP: 10 });
  state.combat = fixedCombat([foe]);
  // Phase 51 (INIT-01): no round-advance draws — initiative is rolled once.
  const rng = fakeRng([3, 4, 13, 7]);
  const events = playerStrike(state, rng, []);
  assert.ok(events.some((e) => e.type === "struck" && e.dmg === 5));
  assert.equal(foe.wp, 5);
  assert.equal(events.some((e) => e.type === "foeArmorSoaked"), false);
});

test("playerStrike: a critical ignores the soak (D-07) — no d20 drawn", () => {
  const state = fixedState({ c: { sub: "Knight" } });
  // Phase 24 (IDENT-05) collision-avoidance: maxWP is kept at 19, not 20 —
  // 20 would now make this foe trip the Knight's new "never wins initiative
  // vs a live maxWP >= 20 foe" bad (engine/combat.js#knightFacesBigFoe),
  // forcing an extra foeTurn this test's rng sequence doesn't budget for.
  // Unrelated to what this test actually proves (D-07's soak bypass).
  const foe = fixedFoe({ sp: { ar: 12 }, wp: 19, maxWP: 19 });
  state.combat = fixedCombat([foe]);
  // strike d20=1 -> natural-1 crit (Knight is not noCrit); club d6=4 -> base
  // dmg=5, doubled to 10; the crit bypasses the armor soak entirely (no d20
  // drawn for it); foe's own swing (foeDie 7) misses; no round-advance draws
  // — initiative is rolled once, Phase 51.
  const rng = fakeRng([1, 4, 7]);
  const events = playerStrike(state, rng, []);
  assert.ok(events.some((e) => e.type === "struck" && e.critical === true && e.dmg === 10));
  assert.equal(foe.wp, 9);
  assert.throws(() => rng.d(20), /sequence exhausted/, "exactly 3 draws total — no soak roll for a crit, no round-advance roll");
});

test("playerStrike: slow — two dice, the better mirrored face kept: raw draws 7 then 2 hit with struck.roll === 19 (D-12)", () => {
  const state = fixedState();
  const foe = fixedFoe({ sp: { slow: true }, wp: 20, maxWP: 20 });
  state.combat = fixedCombat([foe]);
  // Phase 51 (INIT-01): no round-advance draws — initiative is rolled once.
  // raw draws 7, 2 mirror to faces 14, 19 on a d20 — the higher mirrored face
  // (19) is kept, byte-identical to the old "keep the lower raw face" rule.
  const rng = fakeRng([7, 2, 4, 7]);
  const events = playerStrike(state, rng, []);
  const struck = events.find((e) => e.type === "struck");
  assert.equal(struck.roll, 19, "the better (higher) of the two mirrored faces is kept");
  assert.equal(struck.dmg, 5);
  assert.equal(foe.wp, 15);
});

test("playerStrike: slow — the better mirrored face still misses: strikeMissed with roll 14 (raw draws 7 and 9), then the foe turn", () => {
  const state = fixedState();
  const foe = fixedFoe({ sp: { slow: true }, wp: 20, maxWP: 20 });
  state.combat = fixedCombat([foe]);
  // Phase 51 (INIT-01): no round-advance draws — initiative is rolled once.
  // raw draws 7, 9 mirror to faces 14, 12 on a d20 — the better (14) is kept,
  // still short of atLeast 16.
  const rng = fakeRng([7, 9, 7]);
  const events = playerStrike(state, rng, []);
  const missed = events.find((e) => e.type === "strikeMissed");
  assert.equal(missed.roll, 14, "the better of the two mirrored faces (14 vs 12) is kept");
  assert.equal(foe.wp, 20);
  assert.throws(() => rng.d(20), /sequence exhausted/, "exactly 3 draws for a slow foe");

  // Control: a non-slow foe draws exactly one strike die and misses after 2 draws total.
  const state2 = fixedState();
  const foe2 = fixedFoe({ wp: 20, maxWP: 20 });
  state2.combat = fixedCombat([foe2]);
  const rng2 = fakeRng([7, 7]);
  playerStrike(state2, rng2, []);
  assert.throws(() => rng2.d(20), /sequence exhausted/, "exactly 2 draws for a non-slow foe");
});

test("playerStrike: a halfDmg foe takes ceil(5/2) = 3 (D-10)", () => {
  const state = fixedState();
  const foe = fixedFoe({ sp: { halfDmg: true }, wp: 20, maxWP: 20 });
  state.combat = fixedCombat([foe]);
  // Phase 51 (INIT-01): no round-advance draws — initiative is rolled once.
  const rng = fakeRng([3, 4, 7]);
  const events = playerStrike(state, rng, []);
  assert.ok(events.some((e) => e.type === "struck" && e.dmg === 3));
  assert.equal(foe.wp, 17);
});

test("playerStrike: a Fighter's melee doubles against Trachea (D-11); a Thief's does not (hero class check, D-20)", () => {
  const state = fixedState();
  const foe = fixedFoe({ name: "Trachea", type: "Lair Beasts", wp: 20, maxWP: 20 });
  state.combat = fixedCombat([foe]);
  // Phase 51 (INIT-01): no round-advance draws — initiative is rolled once.
  const rng = fakeRng([3, 4, 7]);
  const events = playerStrike(state, rng, []);
  assert.ok(events.some((e) => e.type === "struck" && e.dmg === 10), "a Fighter's melee doubles vs Trachea");
  assert.equal(foe.wp, 10);

  // Thief control: opened2:true skips the opening backstab so the comparison is clean.
  const state2 = fixedState({ c: { cls: "Thief", sub: "Cutpurse" } });
  const foe2 = fixedFoe({ name: "Trachea", type: "Lair Beasts", wp: 20, maxWP: 20 });
  state2.combat = fixedCombat([foe2], { opened2: true });
  const rng2 = fakeRng([3, 4, 7]);
  const events2 = playerStrike(state2, rng2, []);
  assert.ok(events2.some((e) => e.type === "struck" && e.dmg === 5), "a Thief's melee does not double vs Trachea");
  assert.equal(foe2.wp, 15);
});

test("allyTurn: an ally's blow can be soaked (one extra d20, no allyStruck), and an ally never doubles against Trachea (D-20)", () => {
  const state = fixedState();
  const foe = fixedFoe({ sp: { ar: 12 }, wp: 10, maxWP: 10 });
  state.combat = fixedCombat([foe], { ally: { lvl: 1, rounds: 2, name: "Bear" } });
  const rng = fakeRng([3, 4, 5]);
  const events = allyTurn(state, rng, []);
  // raw draw 5 mirrors to face 16 on a d20; atLeastFor(ar 12, 20) = 9.
  assert.deepEqual(events.find((e) => e.type === "foeArmorSoaked"), { type: "foeArmorSoaked", name: "Target", amount: 5, roll: 16, atLeast: 9, dieN: 20 });
  assert.equal(events.some((e) => e.type === "allyStruck"), false);
  assert.equal(foe.wp, 10);
  assert.equal(state.combat.ally.rounds, 1);

  const state2 = fixedState();
  const foe2 = fixedFoe({ name: "Trachea", type: "Lair Beasts", wp: 20, maxWP: 20 });
  state2.combat = fixedCombat([foe2], { ally: { lvl: 1, rounds: 2, name: "Bear" } });
  const rng2 = fakeRng([3, 4]);
  const events2 = allyTurn(state2, rng2, []);
  assert.ok(events2.some((e) => e.type === "allyStruck" && e.dmg === 5), "an ally never doubles vs Trachea");
  assert.equal(foe2.wp, 15);
});

test("alliesTurn: a party member's strike is routed through the seam (soakable)", () => {
  const state = fixedState({ party: [{ name: "Ada", level: 1, sub: "Soldier", wp: 20, maxWP: 20 }] });
  const foe = fixedFoe({ sp: { ar: 12 }, wp: 10, maxWP: 10 });
  state.combat = fixedCombat([foe], { allies: [{ partyIdx: 0, name: "Ada", lvl: 1, sub: "Soldier", wp: 20, maxWP: 20 }] });
  const rng = fakeRng([3, 4, 5]);
  const events = alliesTurn(state, rng, []);
  // raw draw 5 mirrors to face 16 on a d20; atLeastFor(ar 12, 20) = 9.
  assert.deepEqual(events.find((e) => e.type === "foeArmorSoaked"), { type: "foeArmorSoaked", name: "Target", amount: 5, roll: 16, atLeast: 9, dieN: 20 });
  assert.equal(events.some((e) => e.type === "allyStruck"), false);
  assert.equal(foe.wp, 10);
});

// --- Phase 72 (ROLL-01, finding F1, user ruling 2026-09-24): member/legacy/
// summon strikes obey the hero's own per-target to-hit rules --------------
//
// The odds-based direction rows for the CLASSED member path live in
// test/unit/rollDirection.test.js ([member-strike:per-target-rules]); these
// are functional regression tests for all three F1 sites (classed member,
// the pre-25.1 legacy branch, and the summoned C.ally), each proving a
// magicOnly/daggerOnly foe is untouchable with no magic weapon (need forced
// to 0 — even the die's own best face misses), the SAME clamp
// playerStrike's own [hero-strike:magic-only]/[hero-strike:dagger-only]
// rows prove.

test("memberStrike (F1, classed): a daggerOnly foe (Shadow) is untouchable to a classed member with a Club and no magic weapon", () => {
  const state = fixedState({ party: [{ cls: "Fighter", race: "Human", sub: "Soldier", level: 1, weapon: "Club", magicWpn: 0, wp: 20, maxWP: 20 }] });
  const foe = fixedFoe({ sp: { daggerOnly: true }, wp: 20, maxWP: 20 });
  state.combat = fixedCombat([foe], { allies: [{ partyIdx: 0, name: "Ada", lvl: 1, sub: "Fighter", wp: 20, maxWP: 20 }] });
  const rng = fakeRng([1]); // the die's own best face — would hit under the pre-F1 flat memberToHit need
  const events = alliesTurn(state, rng, []);
  assert.ok(events.some((e) => e.type === "allyMissed"), "F3: daggerOnly leaves a classed member's blow untouchable without a dagger or magic weapon");
  assert.equal(foe.wp, 20, "no damage landed");
});

test("memberStrike (F1, classed): the same Shadow, hittable once the member's own sheet carries a Dagger", () => {
  const state = fixedState({ party: [{ cls: "Fighter", race: "Human", sub: "Soldier", level: 1, weapon: "Dagger", magicWpn: 0, wp: 20, maxWP: 20 }] });
  const foe = fixedFoe({ sp: { daggerOnly: true }, wp: 20, maxWP: 20 });
  state.combat = fixedCombat([foe], { allies: [{ partyIdx: 0, name: "Ada", lvl: 1, sub: "Fighter", wp: 20, maxWP: 20 }] });
  const rng = fakeRng([1, 3]); // best strike face, then the dagger's own damage die
  const events = alliesTurn(state, rng, []);
  assert.ok(events.some((e) => e.type === "allyStruck"), "F3: a Dagger lands on the same Shadow");
});

test("alliesTurn (F1, legacy branch): a magicOnly foe is untouchable to a legacy ally with no persistent sheet", () => {
  const state = fixedState(); // no state.party -> the classed lookup misses -> legacy path
  const foe = fixedFoe({ sp: { magicOnly: true }, wp: 20, maxWP: 20 });
  state.combat = fixedCombat([foe], { allies: [{ partyIdx: 0, name: "Bear", lvl: 1, wp: 20, maxWP: 20 }] });
  const rng = fakeRng([1]); // the die's own best face — would hit under the pre-F1 flat need-5
  const events = alliesTurn(state, rng, []);
  assert.ok(events.some((e) => e.type === "allyMissed"), "F1: magicOnly leaves a legacy ally's blow untouchable (it carries no weapon of its own)");
  assert.equal(foe.wp, 20, "no damage landed");
});

test("alliesTurn (F1, legacy branch): a fast foe (Pogo-like) is a strict penalty, one face narrower than the flat need-5", () => {
  const state = fixedState();
  const foe = fixedFoe({ sp: { fast: true }, wp: 20, maxWP: 20 });
  state.combat = fixedCombat([foe], { allies: [{ partyIdx: 0, name: "Bear", lvl: 1, wp: 20, maxWP: 20 }] });
  const rng = fakeRng([5]); // the old flat need-5 would hit on this face; fast narrows to need 4
  const events = alliesTurn(state, rng, []);
  assert.ok(events.some((e) => e.type === "allyMissed"), "F1: fast narrows a legacy ally's need by one face");
});

test("allyTurn (F1, summon): a daggerOnly foe is untouchable to a summoned ally with no weapon of its own", () => {
  const state = fixedState();
  const foe = fixedFoe({ sp: { daggerOnly: true }, wp: 20, maxWP: 20 });
  state.combat = fixedCombat([foe], { ally: { lvl: 1, rounds: 2, name: "A tall grey silence" } });
  const rng = fakeRng([1]); // the die's own best face — would hit under the pre-F1 flat need-5
  const events = allyTurn(state, rng, []);
  assert.ok(events.some((e) => e.type === "allyMissed"), "F3: daggerOnly leaves a summoned ally's blow untouchable");
  assert.equal(foe.wp, 20, "no damage landed");
  assert.equal(state.combat.ally.rounds, 1, "the departure countdown still ticks on a miss");
});

// RULES-14 (Phase 75): re-pinned — a mirrored blow can still be soaked by
// the foe's own natural armor exactly as any reflect does today (no
// wardReflected pushed since damageFoe's own `soaked` flag came back true),
// and the mirror still pops into the plain pool regardless.
test("applyFoeDamageToPlayer: a mirrored blow onto an armoured foe can be soaked — no wardReflected, foe unhurt, died:false, still pops", () => {
  const state = fixedState({ c: { ward: { name: "Bubble", mirror: true, pool: 0, popPool: 25, rounds: null } } });
  const foe = fixedFoe({ sp: { ar: 12 }, wp: 10, maxWP: 10 });
  state.combat = fixedCombat([foe]);
  const events = [];
  const rng = fakeRng([5]);
  const result = applyFoeDamageToPlayer(state, foe, rng, events, { dmg: 5, roll: 18, atLeast: 16, dieN: 20 });
  assert.deepEqual(result, { died: false, onArmour: false, applied: 0 });
  // raw draw 5 mirrors to face 16 on a d20; atLeastFor(ar 12, 20) = 9.
  assert.deepStrictEqual(events, [{ type: "foeArmorSoaked", name: "Target", amount: 5, roll: 16, atLeast: 9, dieN: 20 }]);
  assert.equal(foe.wp, 10);
  assert.deepEqual(state.c.ward, { name: "Bubble", pool: 25, rounds: 1 }, "the mirror still pops even when the foe's own armor soaks the reflect");
  assert.equal(state.c.wp, 55);
});

test("foeTurn: an acid tick on a Walking Dead foe is spell damage — doubled (D-11), never soaked (D-06)", () => {
  const state = fixedState();
  const foe = fixedFoe({
    type: "Walking Dead",
    sp: { ar: 15 },
    acid: { rounds: 2, dmg: { n: 1, sides: 6 } },
    wp: 20,
    maxWP: 20,
  });
  state.combat = fixedCombat([foe]);
  const rng = fakeRng([4, 7]);
  const events = foeTurn(state, rng, []);
  assert.ok(events.some((e) => e.type === "acidTick" && e.dmg === 8), "any-spell x2 vs Walking Dead, no soak");
  assert.equal(foe.wp, 12);
  assert.ok(events.some((e) => e.type === "foeMissed"));
  assert.equal(foe.acid.rounds, 1);
  assert.throws(() => rng.d(20), /sequence exhausted/, "exactly 2 draws — the ar-15 armor never gates a spell tick");
});

test("foeTurn: an acid tick on a halfDmg foe is halved (ceil)", () => {
  const state = fixedState();
  const foe = fixedFoe({ sp: { halfDmg: true }, acid: { rounds: 2, dmg: { n: 1, sides: 6 } }, wp: 20, maxWP: 20 });
  state.combat = fixedCombat([foe]);
  const rng = fakeRng([5, 7]);
  const events = foeTurn(state, rng, []);
  assert.ok(events.some((e) => e.type === "acidTick" && e.dmg === 3));
  assert.equal(foe.wp, 17);
});

// --- Phase 19: combat.js seams (FOE-02/03/04, CANON-02, D-09/D-10/D-18/D-19) ---

test("applyFoeDamageToPlayer: applied reports the landed amount; ignoresArmor:true skips the soak d20; ability switches the event to foeBolted", () => {
  const armoredState = fixedState({ c: { ar: 15, armorWP: 20, armorMax: 20, armorMin: 0, armor: "Studded" } });
  const foe = fixedFoe();
  let result = applyFoeDamageToPlayer(armoredState, foe, fakeRng([10]), [], { dmg: 5, roll: 18, atLeast: 16, dieN: 20 });
  assert.deepEqual(result, { died: false, onArmour: true, applied: 0 });

  const events1 = [];
  result = applyFoeDamageToPlayer(armoredState, foe, fakeRng([]), events1, { dmg: 5, ignoresArmor: true, ability: "vampireDrain" });
  assert.deepEqual(result, { died: false, onArmour: false, applied: 5 });
  assert.deepStrictEqual(events1, [{ type: "foeBolted", name: "Target", ability: "vampireDrain", dmg: 5, ignoresArmor: true }]);
  assert.equal(armoredState.c.wp, 50);

  const unarmoredState = fixedState();
  const events2 = [];
  applyFoeDamageToPlayer(unarmoredState, foe, fakeRng([]), events2, { dmg: 5, ability: "krupkeFreeze" });
  assert.deepStrictEqual(events2, [{ type: "foeBolted", name: "Target", ability: "krupkeFreeze", dmg: 5, ignoresArmor: false }]);

  const events3 = [];
  applyFoeDamageToPlayer(unarmoredState, foe, fakeRng([]), events3, { dmg: 5, roll: 18, atLeast: 16, dieN: 20 });
  assert.equal(events3[0].type, "struckByFoe");
  assert.equal(events3[0].dmg, 5);
});

test("applyFoeDamageToPlayer: a warded drain heals nothing — applied is the post-ward amount", () => {
  const state1 = fixedState({ c: { ward: { pool: 10, rounds: 3 } } });
  const foe1 = fixedFoe();
  const events1 = [];
  const result1 = applyFoeDamageToPlayer(state1, foe1, fakeRng([]), events1, { dmg: 4, ignoresArmor: true, ability: "vampireDrain" });
  assert.equal(result1.applied, 0);
  assert.deepStrictEqual(events1, [{ type: "wardAbsorbed", amount: 4, remaining: 6 }]);

  const state2 = fixedState({ c: { ward: { pool: 10, rounds: 3 } } });
  const foe2 = fixedFoe();
  const events2 = [];
  const result2 = applyFoeDamageToPlayer(state2, foe2, fakeRng([]), events2, { dmg: 15, ignoresArmor: true, ability: "vampireDrain" });
  assert.equal(result2.applied, 5);
  assert.deepEqual(events2.map((e) => e.type), ["wardAbsorbed", "wardShattered", "foeBolted"]);
  assert.equal(events2[2].dmg, 5);
});

test("playerStrike: weakened halves the hero's damage (ceil) before the seam; a dazed foeEffect does not", () => {
  // Phase 51 (INIT-01): no round-advance draws — initiative is rolled once.
  const state = fixedState({ c: { foeEffect: { kind: "weakened", rounds: 2 } } });
  const foe = fixedFoe({ wp: 20, maxWP: 20 });
  state.combat = fixedCombat([foe]);
  const events = playerStrike(state, fakeRng([3, 4, 7]), []);
  assert.ok(events.some((e) => e.type === "struck" && e.dmg === 3));
  assert.equal(foe.wp, 17);

  const state2 = fixedState({ c: { foeEffect: { kind: "dazed", rounds: 2 } } });
  const foe2 = fixedFoe({ wp: 20, maxWP: 20 });
  state2.combat = fixedCombat([foe2]);
  const events2 = playerStrike(state2, fakeRng([3, 4, 7]), []);
  assert.ok(events2.some((e) => e.type === "struck" && e.dmg === 5));
  assert.equal(foe2.wp, 15);

  const state3 = fixedState({ c: { foeEffect: { kind: "dazed", rounds: 2 } } });
  const foe3 = fixedFoe({ wp: 20, maxWP: 20 });
  state3.combat = fixedCombat([foe3]);
  const events3 = playerStrike(state3, fakeRng([4, 7]), []);
  assert.ok(events3.some((e) => e.type === "strikeMissed" && e.atLeast === 18 && e.dieN === 20));
});

test("foeTurn: foeEffect ticks at the end of a foeTurn that did NOT apply it, fades at 0, and endCombat clears a set one without adding the key", () => {
  const state = fixedState({ c: { foeEffect: { kind: "dazed", rounds: 1 } } });
  const foe = fixedFoe({ asleep: 3 });
  state.combat = fixedCombat([foe]);
  const events = foeTurn(state, fakeRng([]), []);
  assert.deepEqual(events.map((e) => e.type), ["foeSlept", "foeEffectFaded"]);
  assert.equal(state.c.foeEffect, null);

  endCombat(state, []);
  assert.equal(state.c.foeEffect, null);

  const fresh = fixedState();
  endCombat(fresh, []);
  assert.equal(Object.hasOwn(fresh.c, "foeEffect"), false);

  const state2 = fixedState({ c: { foeEffect: { kind: "dazed", rounds: 2 } } });
  const foe2 = fixedFoe({ asleep: 3 });
  state2.combat = fixedCombat([foe2]);
  const events2 = foeTurn(state2, fakeRng([]), []);
  assert.equal(events2.some((e) => e.type === "foeEffectFaded"), false);
  assert.equal(state2.c.foeEffect.rounds, 1);
});

test("foeTurn: sp.fleesBelow — wp under the threshold flees with no draw and no XP; at exactly the threshold it fights", () => {
  const state = fixedState();
  const foe = fixedFoe({ sp: { fleesBelow: 0.25 }, wp: 15, maxWP: 64 });
  state.combat = fixedCombat([foe]);
  const events = foeTurn(state, fakeRng([]), []);
  assert.deepStrictEqual(events, [{ type: "foeFled", name: "Target", reason: "lowHp" }]);
  assert.equal(foe.alive, false);
  assert.equal(foe.fled, true);
  assert.equal(state.c.sp, 0);
  assert.equal(state.c.kills, 0);

  const state2 = fixedState();
  const foe2 = fixedFoe({ sp: { fleesBelow: 0.25 }, wp: 16, maxWP: 64 });
  state2.combat = fixedCombat([foe2]);
  const events2 = foeTurn(state2, fakeRng([7]), []);
  assert.ok(events2.some((e) => e.type === "foeMissed"));
});

test("flee: a live pursues foe strikes once on the roll-based escape — foePursued, hit, then fled", () => {
  const state = fixedState();
  const foe = fixedFoe({ sp: { pursues: true, noArmor: true } });
  state.combat = fixedCombat([foe]);
  const events = flee(state, fakeRng([15, 3, 4]), []);
  assert.deepEqual(events.map((e) => e.type), ["fleeRolled", "foePursued", "struckByFoe", "fled", "combatEnded"]);
  assert.equal(state.c.wp, 50);
  assert.equal(state.combat, null);

  const state2 = fixedState();
  const foe2 = fixedFoe({ sp: { pursues: true, noArmor: true } });
  state2.combat = fixedCombat([foe2]);
  const events2 = flee(state2, fakeRng([15, 7]), []);
  assert.deepEqual(events2.map((e) => e.type), ["fleeRolled", "foePursued", "foeMissed", "fled", "combatEnded"]);
});

test("flee: the pursuit also fires on the Cloaker and tracked-round-1 exits (D-19), and never without a pursues foe", () => {
  const state = fixedState({ c: { cls: "Thief", sub: "Cloaker" } });
  const foe = fixedFoe({ sp: { pursues: true, noArmor: true } });
  state.combat = fixedCombat([foe]);
  const events = flee(state, fakeRng([3, 4]), []);
  assert.deepEqual(events.map((e) => e.type), ["foePursued", "struckByFoe", "fled", "combatEnded"]);

  const state2 = fixedState();
  const foe2 = fixedFoe({ sp: { pursues: true, noArmor: true } });
  state2.combat = fixedCombat([foe2], { tracked: true, round: 1 });
  const events2 = flee(state2, fakeRng([3, 4]), []);
  assert.deepEqual(events2.map((e) => e.type), ["foePursued", "struckByFoe", "fled", "combatEnded"]);

  const state3 = fixedState({ c: { cls: "Thief", sub: "Cloaker" } });
  const foe3 = fixedFoe();
  state3.combat = fixedCombat([foe3]);
  const events3 = flee(state3, fakeRng([]), []);
  assert.deepEqual(events3.map((e) => e.type), ["fled", "combatEnded"]);
});

test("flee: a lethal pursuit strike kills the hero mid-escape — no fled, no combatEnded, died", () => {
  const state = fixedState({ c: { wp: 3 } });
  const foe = fixedFoe({ sp: { pursues: true, noArmor: true } });
  state.combat = fixedCombat([foe]);
  const events = flee(state, fakeRng([15, 3, 4]), []);
  assert.equal(state.dead, true);
  assert.ok(events.some((e) => e.type === "died"));
  assert.equal(events.some((e) => e.type === "fled"), false);
  assert.equal(events.some((e) => e.type === "combatEnded"), false);
});

test("flee: a failed flee whose foeTurn leaves no live foe ends the encounter instead of stranding it", () => {
  const state = fixedState();
  const foe = fixedFoe({ sp: { fleesBelow: 0.25 }, wp: 10, maxWP: 64 });
  state.combat = fixedCombat([foe]);
  const events = flee(state, fakeRng([1]), []);
  assert.deepEqual(events.map((e) => e.type), ["fleeRolled", "fleeFailed", "foeFled", "encounterCleared", "combatEnded"]);
  assert.equal(state.combat, null);

  // the existing "failed roll triggers the foe's turn" shape (an asleep,
  // still-alive foe) still advances the round rather than clearing.
  const state2 = fixedState();
  const foe2 = fixedFoe({ asleep: 5 });
  state2.combat = fixedCombat([foe2]);
  const events2 = flee(state2, fakeRng([1]), []);
  assert.ok(events2.some((e) => e.type === "fleeFailed"));
  assert.equal(state2.combat.round, 2);
});

test("foeTurn: a pending summon joins at the top, before regen, and acts as an ordinary foe", () => {
  const state = fixedState({ c: { regen: true, wp: 50 } });
  const sleepingFoe = fixedFoe({ asleep: 5 });
  const skeleton = fixedFoe({ name: "Skeleton", type: "Walking Dead", lvl: 4 });
  state.combat = fixedCombat([sleepingFoe], { pendingFoes: [{ by: "Vampire", foe: skeleton }] });
  const events = foeTurn(state, fakeRng([5, 7]), []);
  assert.deepEqual(events.map((e) => e.type), ["foeSummoned", "regenerated", "foeSlept", "foeMissed"]);
  assert.deepStrictEqual(events[0], { type: "foeSummoned", name: "Skeleton", by: "Vampire", pending: false });
  assert.equal(state.combat.foes.length, 2);
  assert.equal(state.combat.pendingFoes, null);
});

// --- Phase 26 gap closure (2026-09-15): the opening foe turn can clear the ---
// encounter. A Samurai NEVER strikes first (Phase 24), so the foe's turn runs
// inline in startCombat; with a reflecting ward (Bubble) up, a low-hp foe's own
// blow bounces back and kills it. startCombat returned with state.combat still
// open and no live foe — the AFTER matrix found seed 197976 stranded there for
// 4,600 no-op actions. The test scans seeds for that exact shape (foe first,
// wardReflected + foeKilled in the opener) so it survives future dice-shape
// changes, and asserts combat is closed with encounterCleared.
test("startCombat+fight: a foe killed by ward reflection during its opening turn ends the encounter (no stranded combat)", () => {
  let hits = 0;
  for (let seed = 1; seed <= 400 && hits < 3; seed++) {
    const state = fixedState({ c: { sub: "Samurai", ward: { name: "Bubble", mirror: true, pool: 0, popPool: 25, rounds: null } } });
    const rng = makeRng(seed);
    const events = startCombat(state, false, "Beasts", rng, []);
    fight(state, rng, events);
    // CMB-01 (Phase 31): `first` moved from encounterStarted to fight's own
    // combatJoined event.
    const joined = events.find((e) => e.type === "combatJoined");
    if (!joined || joined.first !== "foe") continue;
    if (!events.some((e) => e.type === "wardReflected") || !events.some((e) => e.type === "foeKilled")) continue;
    if (state.dead) continue;
    if (state.combat && liveFoes(state).length) continue; // a foe survived — not the shape under test
    hits++;
    assert.equal(state.combat, null, `seed ${seed}: combat must close when the opener leaves no live foe`);
    assert.ok(events.some((e) => e.type === "encounterCleared"), `seed ${seed}: encounterCleared must be emitted`);
    assert.ok(events.indexOf(events.find((e) => e.type === "foeKilled")) < events.indexOf(events.find((e) => e.type === "encounterCleared")));
  }
  assert.ok(hits >= 1, "the seed scan must find at least one reflect-kill opener (else the test proves nothing)");
});
