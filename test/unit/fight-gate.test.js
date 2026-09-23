// test/unit/fight-gate.test.js
//
// CMB-01 (Phase 31): the Fight! split — nothing rolls or strikes before the
// player presses Fight!. Pins engine/combat.js#startCombat/fight/
// refuseIfPending directly (mirrors test/unit/combat.test.js's fakeRng/
// fixedState/fixedFloor helpers and discipline: every sequence is exact,
// fakeRng throws on underflow so an unexpected extra draw fails loudly).

import test from "node:test";
import assert from "node:assert/strict";

import { makeRng } from "../../engine/rng.js";
import { startCombat, fight, refuseIfPending, playerStrike, flee, parley, sing } from "../../engine/combat.js";
import { castSpell, drinkPotion, readScroll } from "../../engine/magic.js";
import { useItem } from "../../engine/items.js";
import { applyAction, newRun } from "../../engine/engine.js";

/** fakeRng(seq) — `.d()` pops the next value off `seq` regardless of the
 * requested side count; throws on underflow (doubles as a "no more rng
 * draws expected" assertion). `.pick(arr)` returns `arr[0]` unless a picker
 * is supplied. Verbatim copy of test/unit/combat.test.js's helper. */
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

/** countingRng(inner) — wraps any rng, counting every `.d()`/`.pick()` call. */
function countingRng(inner) {
  let draws = 0;
  return {
    d(sides) {
      draws++;
      return inner.d(sides);
    },
    pick(...args) {
      draws++;
      return inner.pick(...args);
    },
    shuffle: (...args) => inner.shuffle(...args),
    get draws() {
      return draws;
    },
    getState: inner.getState,
  };
}

function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
    maxWP: 55, wp: 55, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 1, rations: 6, gold: 50, scrolls: 1,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [{ n: "Test Item", kind: "misc", use: "heal" }], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    darkFor: 0,
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

// --- (a) The encounter step draws nothing past the roster -----------------

test("(a) startCombat leaves combat.pending, no first, no combatJoined/phobiaAfraid/combatInDark/foe-strike event", () => {
  const state = fixedState({ c: { foresight: true } });
  const events = startCombat(state, true, "Beasts", fakeRng([1]), []);
  assert.equal(state.combat.pending, true);
  assert.equal(state.combat.first, undefined);
  assert.equal(state.c.foresight, true, "foresight is untouched at the encounter step");
  const started = events.find((e) => e.type === "encounterStarted");
  assert.ok(started);
  assert.equal("first" in started, false, "encounterStarted no longer carries first");
  for (const type of ["combatJoined", "phobiaAfraid", "combatInDark", "foeMissed", "struckByFoe"]) {
    assert.equal(events.some((e) => e.type === type), false, `${type} must not fire before fight`);
  }
});

// --- (b) fight consumes exactly the initiative draws, clears pending ------

test("(b) fight draws exactly two (initiative), pushes combatJoined, clears pending, consumes foresight", () => {
  const state = fixedState({ c: { foresight: true } });
  startCombat(state, true, "Beasts", fakeRng([1]), []);
  const rng = fakeRng([15, 5]); // mine >= theirs -> "you"
  const events = fight(state, rng, []);
  assert.throws(() => rng.d(1), /sequence exhausted/, "fight drew exactly two — a third draw throws");
  assert.deepStrictEqual(
    events.find((e) => e.type === "combatJoined"),
    { type: "combatJoined", first: "you", mine: 15, theirs: 5, why: "foreseen", foe: "Bat/Rat" },
  );
  assert.equal("pending" in state.combat, false, "pending is deleted, never set false");
  assert.equal(state.c.foresight, false, "foresight is consumed at Fight! time");
});

// --- (c) Phobia order: the Hardiness mitigation roll, still inside fight --

test("(c) a Darkness-phobic character with Hardiness: the mitigation d2 is drawn inside fight, after the two initiative d20s", () => {
  const withHardiness = fixedState({ c: { phobia: "Darkness", phobiaType: null, skills: { Hardiness: 1 } } });
  withHardiness.floor.g[withHardiness.floor.py][withHardiness.floor.px].dark = true;
  startCombat(withHardiness, true, "Beasts", fakeRng([1]), []);
  const eventsA = fight(withHardiness, fakeRng([15, 5, 2]), []); // d2=2 -> no shrug
  assert.equal(withHardiness.combat.afraid, 2);
  const joinedIdxA = eventsA.findIndex((e) => e.type === "combatJoined");
  const afraidIdxA = eventsA.findIndex((e) => e.type === "phobiaAfraid");
  assert.ok(joinedIdxA >= 0 && afraidIdxA > joinedIdxA, "phobiaAfraid follows combatJoined");
  assert.deepStrictEqual(eventsA[afraidIdxA], { type: "phobiaAfraid", rounds: 2 });

  const withoutHardiness = fixedState({ c: { phobia: "Darkness", phobiaType: null } });
  withoutHardiness.floor.g[withoutHardiness.floor.py][withoutHardiness.floor.px].dark = true;
  startCombat(withoutHardiness, true, "Beasts", fakeRng([1]), []);
  const rngNoHardiness = fakeRng([15, 5]); // exactly two — no d2 for a non-Hardiness character
  const eventsB = fight(withoutHardiness, rngNoHardiness, []);
  assert.throws(() => rngNoHardiness.d(1), /sequence exhausted/, "no Hardiness -> no conditional d2 draw");
  assert.equal(withoutHardiness.combat.afraid, 2);
  assert.ok(eventsB.some((e) => e.type === "phobiaAfraid" && e.rounds === 2));
});

// --- (d) A foes-first pre-emptive strike happens only inside fight --------

test("(d) a foes-first opener (combatJoined.first === 'foe') strikes only after fight is called, never before", () => {
  let found = false;
  for (let seed = 1; seed <= 200 && !found; seed++) {
    const state = newRun(seed);
    const rng = makeRng(state.rngState);
    const beforeEvents = [];
    startCombat(state, false, "Beasts", rng, beforeEvents);
    if (!state.combat) continue; // every foe fled/bored before Fight! existed as a concept
    // Nothing resembling a foe strike exists before fight() runs.
    for (const type of ["foeMissed", "struckByFoe", "combatJoined"]) {
      assert.equal(beforeEvents.some((e) => e.type === type), false, `seed ${seed}: ${type} fired before fight`);
    }
    const afterEvents = [];
    fight(state, rng, afterEvents);
    const joined = afterEvents.find((e) => e.type === "combatJoined");
    if (!joined || joined.first !== "foe") continue;
    found = true;
    assert.ok(
      afterEvents.some((e) => e.type === "foeMissed" || e.type === "struckByFoe" || e.type === "foeKilled"),
      `seed ${seed}: a foes-first opener produced no foe-side event inside fight`,
    );
  }
  assert.ok(found, "the seed scan must find at least one foes-first opener (else this test proves nothing)");
});

// --- (e) fight is idempotent on a null or already-joined combat -----------

test("(e) fight on a null combat, and on an already-joined (non-pending) combat, is a zero-draw no-op", () => {
  const nullCombatState = fixedState();
  const events1 = fight(nullCombatState, fakeRng([]), []);
  assert.deepStrictEqual(events1, []);

  const joinedState = fixedState();
  joinedState.combat = { foes: [fixedFoe()], type: "Beasts", round: 1, target: 0, spellOpen: false, tracked: false, first: "you" };
  const before = JSON.stringify(joinedState);
  const events2 = fight(joinedState, fakeRng([]), []);
  assert.deepStrictEqual(events2, []);
  assert.equal(JSON.stringify(joinedState), before, "a replayed Fight! never mutates an already-joined combat");
});

// --- (f) refuseIfPending: the ONE notFought guard, all eight call sites ---

/** pendingState(overrides) — a hand-built fixedState with a pending combat,
 * suitable for dispatch through the real applyAction (which structuredClones
 * and rebuilds the rng from rngState — a plain integer rngState is a valid
 * makeRng seed). */
function pendingState(overrides = {}) {
  const state = fixedState(overrides);
  state.combat = { foes: [fixedFoe()], type: "Beasts", round: 1, target: 0, spellOpen: false, tracked: false, pending: true };
  return state;
}

const REFUSAL_CASES = [
  { action: { type: "attack" }, refusal: { type: "strikeRefused", reason: "notFought" } },
  { action: { type: "flee" }, refusal: { type: "fleeRefused", reason: "notFought" } },
  { action: { type: "parley" }, refusal: { type: "parleyRefused", reason: "notFought" } },
  { action: { type: "sing" }, refusal: { type: "actionRefused", action: "sing", reason: "notFought" } },
  { action: { type: "castSpell", idx: 0 }, refusal: { type: "castRefused", spell: "Heal", reason: "notFought" } },
  { action: { type: "drinkPotion" }, refusal: { type: "actionRefused", action: "drinkPotion", reason: "notFought" } },
  { action: { type: "readScroll" }, refusal: { type: "scrollRefused", reason: "notFought" } },
  { action: { type: "useItem", i: 0 }, refusal: { type: "useRefused", item: { n: "Test Item", kind: "misc", use: "heal" }, reason: "notFought" } },
];

for (const { action, refusal } of REFUSAL_CASES) {
  test(`(f) while combat.pending, ${action.type} refuses with exactly one notFought event and mutates nothing`, () => {
    const state = pendingState();
    const before = structuredClone(state);
    const { state: next, events } = applyAction(state, action);
    assert.deepStrictEqual(events, [refusal]);
    // Phase 65 (RUN-01): this action passes validateAction (it is only the
    // handler that refuses it), so applyAction still counts it — acts moves
    // by exactly 1, the same non-negative-integer coercion validateSave
    // uses for a state (like this hand-built fixedState) that carries no
    // acts key at all. Everything else stays byte-for-byte the input
    // (rngState included — zero draws).
    const beforeActs = Number.isInteger(before.acts) && before.acts >= 0 ? before.acts : 0;
    assert.equal(next.acts, beforeActs + 1, "a refused-but-validated action still counts as one action");
    const stripActs = (s) => { const { acts, ...rest } = s; return rest; };
    assert.deepStrictEqual(stripActs(next), stripActs(before), "the returned state is otherwise byte-for-byte the input (rngState included — zero draws)");
  });
}

test("(f) refuseIfPending returns false and pushes nothing when combat is null or already joined", () => {
  const events1 = [];
  assert.equal(refuseIfPending(fixedState(), events1, "strikeRefused"), false);
  assert.deepStrictEqual(events1, []);

  const joined = fixedState();
  joined.combat = { foes: [fixedFoe()], type: "Beasts", round: 1, target: 0, spellOpen: false, tracked: false, first: "you" };
  const events2 = [];
  assert.equal(refuseIfPending(joined, events2, "strikeRefused"), false);
  assert.deepStrictEqual(events2, []);
});

// --- (g) Draw-count split: startCombat alone < startCombat + fight --------

const SPLIT_SEEDS = [
  { seed: 3, forced: "Beasts" },
  { seed: 14, forced: "Beasts" },
  { seed: 17, forced: "Beasts" },
  { seed: 303, forced: "Humans" },
];

for (const { seed, forced } of SPLIT_SEEDS) {
  test(`(g) seed ${seed}/${forced}: startCombat alone draws strictly fewer than startCombat + fight (fight adds >= 2); first is set only after fight`, () => {
    const state = newRun(seed);
    const rng = countingRng(makeRng(state.rngState));
    startCombat(state, false, forced, rng, []);
    const encounterOnlyDraws = rng.draws;
    assert.equal(state.combat.first, undefined, "first is not set by the encounter step alone");
    fight(state, rng, []);
    const combinedDraws = rng.draws;
    assert.ok(combinedDraws > encounterOnlyDraws, `seed ${seed}: fight must add at least one draw`);
    assert.ok(combinedDraws - encounterOnlyDraws >= 2, `seed ${seed}: fight must add at least the two initiative draws`);
    assert.ok(["you", "foe"].includes(state.combat.first), "first is set only after fight");
  });
}

// (h) tuning-bot's pending-gate coverage lives in test/unit/tuning-bot.test.js
// ("CMB-01: decideAction returns {type:'fight'} whenever state.combat.pending
// is truthy") — not duplicated here.
