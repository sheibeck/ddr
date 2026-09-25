// test/unit/afraid.test.js
//
// CMB-01 (Phase 31, user ruling 2026-09-16: "Phobia should be penalties,
// never a no actions state") — the strike-side Afraid pins: direction
// (to-hit is a LOW range, the penalty SHRINKS the need), the miss/damage
// arithmetic, the never-refused guarantee, the countdown to fearPassed,
// endCombat's clear, and the condition chip. Plan 02 appends the spell/item
// side to this same file. Mirrors test/unit/combat.test.js's fakeRng/
// fixedState/fixedCombat/fixedFoe helpers and discipline.

import test from "node:test";
import assert from "node:assert/strict";

import {
  AFRAID_ROUNDS,
  AFRAID_TO_HIT_PENALTY,
  AFRAID_DMG_DIV,
  afraidNeed,
  afraidDamage,
  toHit,
  conditionsOf,
} from "../../engine/derived.js";
import { playerStrike, foeTurn, endCombat, startCombat, fight } from "../../engine/combat.js";
import { castSpell, drinkPotion, readScroll } from "../../engine/magic.js";
import { useItem } from "../../engine/items.js";
import { applyAction, newRun } from "../../engine/engine.js";
import { makeRng } from "../../engine/rng.js";
import { SPELLS } from "../../content/index.js";

const SPELL_IDX = Object.fromEntries(SPELLS.map((sp, i) => [sp.n, i]));

/** fakeRng(seq) — verbatim copy of test/unit/combat.test.js's helper. */
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

// --- (i) DIRECTION: the penalty shrinks the NEED, floor 1, never revives an
// untouchable foe --------------------------------------------------------

test("(i) afraidNeed shrinks the need by AFRAID_TO_HIT_PENALTY, floor 1, and never touches an untouchable (need 0) foe", () => {
  const afraidState = { combat: { afraid: 2 } };
  const need = toHit({ c: fixedFighter(), combat: null });
  assert.equal(need, 5, "sanity: a Fighter/Soldier needs 5 unafraid");
  const shrunk = afraidNeed(afraidState, need);
  assert.ok(shrunk < need, "afraid need is STRICTLY LESS than the unafraid need");
  assert.equal(shrunk, Math.max(1, need - AFRAID_TO_HIT_PENALTY));
  assert.equal(afraidNeed({ combat: { afraid: 0 } }, need), need, "afraid: 0 -> unchanged");
  assert.equal(afraidNeed({ combat: null }, need), need, "no combat -> unchanged");
  assert.equal(afraidNeed(afraidState, 0), 0, "an untouchable (need 0) foe is NEVER made hittable by fear");
  assert.equal(afraidNeed(afraidState, 2), 1, "floor 1, never 0 or negative");
});

// --- (ii) A roll that hits unafraid misses afraid --------------------------

test("(ii) the SAME raw draw that hits unafraid (5 faces, mirrored roll 16 vs atLeast 16) misses afraid (2 faces, atLeast 19) — one fewer die drawn (no damage roll)", () => {
  const unafraidState = fixedState();
  unafraidState.combat = fixedCombat([fixedFoe({ wp: 10, maxWP: 10 })]);
  // Phase 51 (INIT-01): no round-advance draws — initiative is rolled once.
  const unafraidRng = countingRng(fakeRng([5, 4, 20])); // roll, weapon d6, foe-die-miss
  const unafraidEvents = playerStrike(unafraidState, unafraidRng, []);
  const struck = unafraidEvents.find((e) => e.type === "struck");
  assert.ok(struck, "unafraid: the roll hits");
  assert.equal(struck.atLeast, 16);
  assert.equal(struck.dieN, 20);
  assert.equal(struck.roll, 16, "raw draw 5 mirrors to face 16 on a d20");
  assert.equal("mods" in struck, false, "no afraid mods when not afraid");

  const afraidState = fixedState();
  afraidState.combat = fixedCombat([fixedFoe({ wp: 10, maxWP: 10 })], { afraid: 2 });
  const afraidRng = countingRng(fakeRng([5, 20])); // roll, foe-die-miss -- NO damage die, no round-advance draws
  const afraidEvents = playerStrike(afraidState, afraidRng, []);
  const missed = afraidEvents.find((e) => e.type === "strikeMissed");
  assert.ok(missed, "afraid: the SAME raw draw (5, mirrored to face 16) now misses (atLeast widens to 19)");
  assert.equal(missed.atLeast, 19);
  assert.equal(missed.dieN, 20);
  assert.equal(missed.roll, 16);
  assert.deepStrictEqual(missed.mods, [{ name: "afraid", delta: -3 }]);
  assert.equal(afraidState.combat.foes[0].wp, 10, "the foe took no damage");

  assert.equal(unafraidRng.draws - 1, afraidRng.draws, "the afraid run draws exactly one fewer die (no damage roll)");
});

// --- (iii) Damage halved, floor 1, and the crit/weakened/afraid order -----

test("(iii) afraid halves the player's already-rolled weapon damage, floor 1", () => {
  // weaponDamage forced to 3 (level^2(1) + weapon-die(2)) via a Soldier
  // (noCrit, so roll=2 never crits) — afraid halves 3 -> ceil(3/2) = 2.
  const stateA = fixedState();
  stateA.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })], { afraid: 2 });
  const rngA = fakeRng([2, 2, 20, 15, 10]);
  const eventsA = playerStrike(stateA, rngA, []);
  const struckA = eventsA.find((e) => e.type === "struck");
  assert.equal(struckA.dmg, 2, "Math.ceil(3/2) = 2");
  assert.equal(struckA.afraid, true);

  // weaponDamage forced to 1 (weapon-die 0) -> afraid halves to Math.max(1, ceil(1/2)) = 1, never 0.
  const stateB = fixedState();
  stateB.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })], { afraid: 2 });
  const rngB = fakeRng([2, 0, 20, 15, 10]);
  const eventsB = playerStrike(stateB, rngB, []);
  const struckB = eventsB.find((e) => e.type === "struck");
  assert.equal(struckB.dmg, 1, "damage never floors below 1");
});

test("(iii) a noCrit Soldier rolling a natural 1 still just halves (no crit double) while afraid", () => {
  const state = fixedState({ c: { sub: "Soldier" } }); // Soldier: noCrit
  state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })], { afraid: 2 });
  const rng = fakeRng([1, 2, 20, 15, 10]); // roll=1 (would crit if not noCrit), weapon-die=2 -> base dmg 3
  const events = playerStrike(state, rng, []);
  const struck = events.find((e) => e.type === "struck");
  assert.equal(struck.critical, false, "Soldier never crits");
  assert.equal(struck.dmg, 2, "Math.ceil(3/2) = 2, no crit doubling");
});

test("(iii) crit doubles FIRST, then afraid halves — Math.ceil(2*w/2) === w", () => {
  const state = fixedState({ c: { sub: "Bard" } }); // Fighter/Bard: not noCrit, no attack-count/dmg side effects
  state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })], { afraid: 2 });
  const rng = fakeRng([1, 2, 20, 15, 10]); // roll=1 -> crit; weapon-die=2 -> base dmg 3
  const events = playerStrike(state, rng, []);
  const struck = events.find((e) => e.type === "struck");
  assert.equal(struck.critical, true);
  assert.equal(struck.dmg, 3, "crit doubles 3 -> 6, afraid halves 6 -> 3: the base value, composed");
});

test("(iii) weakened then afraid compose: Math.ceil(Math.ceil(w/2)/2)", () => {
  const state = fixedState({ c: { sub: "Soldier", foeEffect: { kind: "weakened", rounds: 2 } } });
  state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })], { afraid: 2 });
  const rng = fakeRng([2, 2, 20, 15, 10]); // weapon-die=2 -> base dmg 3
  const events = playerStrike(state, rng, []);
  const struck = events.find((e) => e.type === "struck");
  assert.equal(struck.dmg, 1, "weakened ceil(3/2)=2, then afraid ceil(2/2)=1");
});

// --- (iv) Never a lost action, never refused for fear ----------------------

test("(iv) an afraid character can strike, cast, drink, read, use, flee, parley, and sing — never refused for fear", () => {
  const FEAR_FREE_VOCAB = new Set([
    "notFought", "cooldown", "wrongClass", "combatOnly", "exploreOnly", "noTarget",
    "pilfer", "wizard", "samurai", "ninja", "masterOfArms", "exhausted",
    "noScrolls", "noRunes", "tried", "wilmsryVsMagical", "walkingDead", "magical",
  ]);
  const assertNeverFearRefused = (events) => {
    for (const e of events) {
      if (typeof e.type === "string" && e.type.endsWith("Refused")) {
        assert.ok(FEAR_FREE_VOCAB.has(e.reason), `${e.type} carries an unexpected reason "${e.reason}" — never "frozen"/"afraid"`);
        assert.notEqual(e.reason, "frozen");
        assert.notEqual(e.reason, "afraid");
      }
    }
  };

  // attack: a real swing (struck or strikeMissed), never strikeRefused, and
  // afterPlayerAction ran (a foe event or round advance is present).
  const attackState = fixedState();
  attackState.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })], { afraid: 2 });
  attackState.rngState = 12345;
  const attackResult = applyAction(attackState, { type: "attack" });
  assertNeverFearRefused(attackResult.events);
  assert.ok(
    attackResult.events.some((e) => e.type === "struck" || e.type === "strikeMissed"),
    "a real swing happens — never the old shake-off, never a lost action",
  );
  assert.equal(attackResult.events.some((e) => e.type === "strikeRefused"), false);

  // castSpell: a known, charged spell casts normally while afraid.
  const casterState = fixedState({
    c: { cls: "Magic User", sub: "Wizard", level: 5, grimoire: ["Heal"], spellsUsed: 0, wp: 20, maxWP: 40 },
  });
  casterState.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })], { afraid: 2 });
  casterState.rngState = 99;
  const castResult = applyAction(casterState, { type: "castSpell", idx: 0 });
  assertNeverFearRefused(castResult.events);
  assert.equal(castResult.events.some((e) => e.type === "castRefused"), false);
  assert.ok(castResult.events.some((e) => e.type === "healed"), "the afraid caster's Heal still lands");

  // drinkPotion / readScroll / useItem: normal outcomes while afraid.
  const potionState = fixedState({ c: { potions: 1 } });
  potionState.combat = fixedCombat([fixedFoe()], { afraid: 2 });
  potionState.rngState = 7;
  const potionResult = applyAction(potionState, { type: "drinkPotion" });
  assertNeverFearRefused(potionResult.events);
  assert.ok(potionResult.events.some((e) => e.type === "potionDrunk"));

  const scrollState = fixedState({ c: { cls: "Magic User", sub: "Wizard", scrolls: 1, level: 5 } });
  scrollState.combat = fixedCombat([fixedFoe()], { afraid: 2 });
  scrollState.rngState = 42;
  const scrollResult = applyAction(scrollState, { type: "readScroll" });
  assertNeverFearRefused(scrollResult.events);
  assert.ok(scrollResult.events.some((e) => ["scrollRead", "scrollCast", "scrollCopiedToGrimoire"].includes(e.type)));

  const itemState = fixedState({ c: { items: [{ n: "Vial", kind: "potion", eff2: "heal" }], wp: 20, maxWP: 40 } });
  itemState.combat = fixedCombat([fixedFoe()], { afraid: 2 });
  itemState.rngState = 55;
  const itemResult = applyAction(itemState, { type: "useItem", i: 0 });
  assertNeverFearRefused(itemResult.events);
  assert.ok(itemResult.events.some((e) => e.type === "healed"));

  // flee / parley: never a fear-related refusal (ordinary refusals allowed).
  const fleeState = fixedState();
  fleeState.combat = fixedCombat([fixedFoe()], { afraid: 2 });
  fleeState.rngState = 3;
  const fleeResult = applyAction(fleeState, { type: "flee" });
  assertNeverFearRefused(fleeResult.events);

  const parleyState = fixedState({ c: { sub: "Con Artist" } });
  parleyState.combat = fixedCombat([fixedFoe({ type: "Beasts" })], { afraid: 2, type: "Beasts" });
  parleyState.rngState = 21;
  const parleyResult = applyAction(parleyState, { type: "parley" });
  assertNeverFearRefused(parleyResult.events);

  // sing: a Bard's song fires normally while afraid.
  const bardState = fixedState({ c: { sub: "Bard", level: 1 } });
  bardState.combat = fixedCombat([fixedFoe({ type: "Beasts" })], { afraid: 2, type: "Beasts" });
  bardState.rngState = 8;
  const singResult = applyAction(bardState, { type: "sing" });
  assertNeverFearRefused(singResult.events);
  assert.ok(singResult.events.some((e) => e.type === "sang"));
});

// --- (v) Countdown + fearPassed ---------------------------------------------

test("(v) combat.afraid ticks down once per foeTurn, emits exactly one fearPassed at 0, and never rebounds", () => {
  const state = fixedState();
  state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })], { afraid: 2 });
  const eventsA = foeTurn(state, fakeRng([20]), []); // foe misses (roll 20 vs need 5)
  assert.equal(state.combat.afraid, 1);
  assert.equal(eventsA.some((e) => e.type === "fearPassed"), false);

  const eventsB = foeTurn(state, fakeRng([20]), []);
  assert.equal(state.combat.afraid, 0);
  assert.equal(eventsB.filter((e) => e.type === "fearPassed").length, 1);

  const eventsC = foeTurn(state, fakeRng([20]), []);
  assert.equal(state.combat.afraid, 0);
  assert.equal(eventsC.some((e) => e.type === "fearPassed"), false);
});

test("(v) a combat without the afraid key never gains it from foeTurn", () => {
  const state = fixedState();
  state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })]);
  foeTurn(state, fakeRng([20]), []);
  assert.equal("afraid" in state.combat, false);
});

test("(v) the foeTurn tail ticks ward, then mirror, then foeEffect, then afraid, in that order", () => {
  const state = fixedState({ c: { ward: { pool: 1, rounds: 1, name: "X" }, mirror: 1, foeEffect: { kind: "weakened", rounds: 1 } } });
  state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })], { afraid: 1 });
  const events = foeTurn(state, fakeRng([20]), []); // the foe misses
  const types = events.map((e) => e.type);
  assert.deepStrictEqual(types, ["foeMissed", "wardFaded", "mirrorFaded", "foeEffectFaded", "fearPassed"]);
});

// --- (vi) A foes-first opener ticks Afraid once, inside fight ---------------

test("(vi) a foes-first opener triggers Afraid then ticks it once (2 -> 1) inside the SAME fight call", () => {
  const state = fixedState({ c: { phobia: "Darkness", phobiaType: null } });
  state.floor.g[state.floor.py][state.floor.px].dark = true;
  startCombat(state, true, "Beasts", fakeRng([1]), []);
  // mine=1 < theirs=20 -> "foe" first; the wandering roster's Bat/Rat (sp.atk:2)
  // swings twice, both missing (roll 20 vs need 5).
  const events = fight(state, fakeRng([1, 20, 20, 20]), []);
  assert.equal(state.combat.afraid, 1, "the pre-emptive foeTurn already ticked it down once");
  const joinedIdx = events.findIndex((e) => e.type === "combatJoined");
  const afraidIdx = events.findIndex((e) => e.type === "phobiaAfraid");
  const missedIdx = events.findIndex((e) => e.type === "foeMissed");
  assert.ok(joinedIdx >= 0 && afraidIdx > joinedIdx, "phobiaAfraid follows combatJoined");
  assert.ok(missedIdx > afraidIdx, "phobiaAfraid precedes the foe's own swing");
  assert.equal(events.some((e) => e.type === "fearPassed"), false, "not yet — the counter is at 1, not 0");
});

// --- (vii) endCombat clears afraid implicitly -------------------------------

test("(vii) endCombat nulls combat (and afraid with it) — no fearPassed line, no afraid chip after", () => {
  const state = fixedState();
  state.combat = fixedCombat([fixedFoe()], { afraid: 2 });
  const events = endCombat(state, []);
  assert.equal(state.combat, null);
  assert.equal(events.some((e) => e.type === "fearPassed"), false, "the fear ends with the fight, not with a line");
  assert.deepStrictEqual(conditionsOf(state), []);
});

// --- (viii) The condition chip ----------------------------------------------

test("(viii) conditionsOf surfaces exactly one afraid chip while combat.afraid > 0, naming the fear and the remaining rounds", () => {
  const state = fixedState({ c: { phobia: "Bats and rats", phobiaType: "Beasts" } });
  state.combat = fixedCombat([fixedFoe({ type: "Beasts" })], { afraid: 2, type: "Beasts" });
  assert.deepStrictEqual(conditionsOf(state), [{ key: "afraid", polarity: "bad", remaining: 2, phobia: "Bats and rats" }]);

  // A Hardiness shrug-off (the trigger fired but the counter was never set) shows nothing.
  const shrugged = fixedState({ c: { phobia: "Bats and rats", phobiaType: "Beasts" } });
  shrugged.combat = fixedCombat([fixedFoe({ type: "Beasts" })], { type: "Beasts" });
  assert.deepStrictEqual(conditionsOf(shrugged), []);
});

// --- (ix) Zero new draws: the ruling added no rng consumption --------------

test("(ix) a triggered phobia without Hardiness draws exactly the initiative pair; with Hardiness, exactly one more (the d2)", () => {
  const withoutHardiness = fixedState({ c: { phobia: "Darkness", phobiaType: null } });
  withoutHardiness.floor.g[withoutHardiness.floor.py][withoutHardiness.floor.px].dark = true;
  startCombat(withoutHardiness, true, "Beasts", fakeRng([1]), []);
  const rngA = countingRng(fakeRng([15, 5])); // mine >= theirs -> "you", no pre-emptive foeTurn
  fight(withoutHardiness, rngA, []); // Phase 51 (INIT-01): the only initiative roll for the whole fight
  assert.equal(rngA.draws, 2, "no Hardiness -> exactly the two initiative draws, no shake-off roll");
  assert.equal(withoutHardiness.combat.afraid, 2);

  const withHardiness = fixedState({ c: { phobia: "Darkness", phobiaType: null, skills: { Hardiness: 1 } } });
  withHardiness.floor.g[withHardiness.floor.py][withHardiness.floor.px].dark = true;
  startCombat(withHardiness, true, "Beasts", fakeRng([1]), []);
  const rngB = countingRng(fakeRng([15, 5, 2])); // + the conditional Hardiness d2 (no shrug)
  fight(withHardiness, rngB, []);
  assert.equal(rngB.draws, 3, "with Hardiness -> exactly one more draw (the mitigation d2), never a shake-off roll");
  assert.equal(withHardiness.combat.afraid, 2);
});

// --- Plan 02: the spell/item side of Afraid ---------------------------------
// Illusionist (MU_CHART offense bonus 0) is used throughout so `bonus` in
// the spellThrown event stays 0 and the arithmetic below reads cleanly.

// --- (x) THROWN DIRECTION: the target SHRINKS, never the roll --------------

test("(x) a thrown spell's need shrinks by 3 while afraid — the same roll that hits unafraid misses afraid", () => {
  const foeA = fixedFoe({ wp: 999, maxWP: 999, type: "Humans" });
  const stateA = fixedState({ c: { cls: "Magic User", sub: "Illusionist", level: 3, grimoire: ["Fireball"], wp: 40, maxWP: 40 } });
  stateA.combat = fixedCombat([foeA]);
  // roll d8=4 (need 4 unafraid, hits); dmg 2d10+4 = 5+5+4=14; tail: foe miss(7)
  // — no round-advance draws, initiative is rolled once, Phase 51.
  const eventsA = castSpell(stateA, SPELL_IDX.Fireball, fakeRng([4, 5, 5, 7]), []);
  const thrownA = eventsA.find((e) => e.type === "spellThrown");
  // faces 4 -> atLeastFor(4, 8) = 5; raw draw 4 mirrors to roll 5 (5 >= 5 hits).
  assert.equal(thrownA.roll, 5);
  assert.equal(thrownA.atLeast, 5);
  assert.equal(thrownA.dieN, 8);
  assert.equal("mods" in thrownA, false, "no afraid mods when not afraid");
  assert.ok(eventsA.some((e) => e.type === "spellHit"));

  const foeB = fixedFoe({ wp: 999, maxWP: 999, type: "Humans" });
  const stateB = fixedState({ c: { cls: "Magic User", sub: "Illusionist", level: 3, grimoire: ["Fireball"], wp: 40, maxWP: 40 } });
  stateB.combat = fixedCombat([foeB], { afraid: 2 });
  // the SAME raw draw (4) now misses: faces shrinks 4 -> 1, atLeastFor(1, 8) = 8;
  // the mirrored roll (5) no longer reaches the die's top face.
  const eventsB = castSpell(stateB, SPELL_IDX.Fireball, fakeRng([4, 7]), []);
  const thrownB = eventsB.find((e) => e.type === "spellThrown");
  assert.equal(thrownB.roll, 5);
  assert.equal(thrownB.atLeast, 8);
  assert.equal(thrownB.dieN, 8);
  assert.deepStrictEqual(thrownB.mods, [{ name: "afraid", delta: -3 }]);
  assert.ok(eventsB.some((e) => e.type === "spellMissed"));
  assert.equal(foeB.wp, 999, "the foe took no damage");
});

test("(x) Freeze's need shrinks 6 -> 3 while afraid — a d10 roll of 3 lands, a 4 misses", () => {
  const foeA = fixedFoe({ wp: 999, maxWP: 999, type: "Humans", lvl: 1 });
  const stateA = fixedState({ c: { cls: "Magic User", sub: "Illusionist", level: 3, grimoire: ["Freeze"], wp: 40, maxWP: 40 } });
  stateA.combat = fixedCombat([foeA], { afraid: 2 });
  // roll d10=3 (need 3, hits: 3<=3); dmg d6=4; Freeze always kills through
  // killFoe on a hit — sp d6=1, coin d10=1, loot-gate d20=20 (skip, >2+lvl);
  // the sole foe dies, so afterPlayerAction clears with zero further draws.
  const eventsA = castSpell(stateA, SPELL_IDX.Freeze, fakeRng([3, 4, 1, 1, 20]), []);
  const thrownA = eventsA.find((e) => e.type === "spellThrown");
  // faces shrinks 6 -> 3 (afraid), atLeastFor(3, 10) = 8; raw draw 3 mirrors
  // to roll 8 (8 >= 8 lands).
  assert.equal(thrownA.roll, 8);
  assert.equal(thrownA.atLeast, 8);
  assert.equal(thrownA.dieN, 10);
  assert.ok(eventsA.some((e) => e.type === "frozenSolid"), "the mirrored top face lands");

  const foeB = fixedFoe({ wp: 999, maxWP: 999, type: "Humans", lvl: 1 });
  const stateB = fixedState({ c: { cls: "Magic User", sub: "Illusionist", level: 3, grimoire: ["Freeze"], wp: 40, maxWP: 40 } });
  stateB.combat = fixedCombat([foeB], { afraid: 2 });
  // raw draw 4 mirrors to roll 7 (7 < atLeast 8, misses); tail: foe miss(7) —
  // no round-advance draws, initiative is rolled once, Phase 51.
  const eventsB = castSpell(stateB, SPELL_IDX.Freeze, fakeRng([4, 7]), []);
  const thrownB = eventsB.find((e) => e.type === "spellThrown");
  assert.equal(thrownB.roll, 7);
  assert.equal(thrownB.atLeast, 8);
  assert.equal(thrownB.dieN, 10);
  assert.ok(eventsB.some((e) => e.type === "spellMissed"), "roll 7 < atLeast 8 misses");
  assert.equal(foeB.wp, 999, "the foe took no damage");
});

// --- (xi) THROWN DAMAGE: halved on a landed hit, floor 1 --------------------

test("(xi) a landing thrown spell's damage halves while afraid (ceil), floor 1", () => {
  const foeA = fixedFoe({ wp: 999, maxWP: 999, type: "Humans", lvl: 1 });
  const stateA = fixedState({ c: { cls: "Magic User", sub: "Illusionist", level: 1, grimoire: ["Freeze"], wp: 40, maxWP: 40 } });
  stateA.combat = fixedCombat([foeA], { afraid: 2 });
  // level 1 caster vs Freeze (lvl1) -> mult = max(1, 1-1) = 1; roll d10=1
  // (need 3, hits); dmg d6=3 -> rollDice=3*1=3, afraid halves ceil(3/2)=2;
  // Freeze always kills on a hit (killFoe: sp d6=1, coin d10=1, loot d20=20 skip).
  const eventsA = castSpell(stateA, SPELL_IDX.Freeze, fakeRng([1, 3, 1, 1, 20]), []);
  const hitA = eventsA.find((e) => e.type === "spellHit");
  assert.equal(hitA.dmg, 2, "ceil(3/2) = 2");
  assert.equal(hitA.afraid, true);

  const foeB = fixedFoe({ wp: 999, maxWP: 999, type: "Humans", lvl: 1 });
  const stateB = fixedState({ c: { cls: "Magic User", sub: "Illusionist", level: 1, grimoire: ["Freeze"], wp: 40, maxWP: 40 } });
  stateB.combat = fixedCombat([foeB], { afraid: 2 });
  // dmg d6=1 -> rollDice=1*1=1, afraid halves Math.max(1, ceil(1/2)) = 1, never 0.
  const eventsB = castSpell(stateB, SPELL_IDX.Freeze, fakeRng([1, 1, 1, 1, 20]), []);
  const hitB = eventsB.find((e) => e.type === "spellHit");
  assert.equal(hitB.dmg, 1, "damage never floors below 1");
});

// --- (xii) Earthquake and Volley halve per hit, same draw count ------------

test("(xii) Earthquake halves its per-foe damage while afraid, drawing the same number of rng values", () => {
  const foeA = fixedFoe({ wp: 999, maxWP: 999, type: "Humans" });
  const stateA = fixedState({
    c: { cls: "Magic User", sub: "Wizard", level: 4, grimoire: ["Earthquake"], wp: 50, maxWP: 50, ward: { pool: 10, rounds: 1, name: "Shield" } },
  });
  stateA.combat = fixedCombat([foeA]);
  // 3 quake dice, tail: foe miss(7) — no round-advance draws, Phase 51.
  const rngA = countingRng(fakeRng([10, 10, 10, 7]));
  castSpell(stateA, SPELL_IDX.Earthquake, rngA, []);
  assert.equal(foeA.wp, 999 - 38, "unafraid: the foe takes the full 3d10+8 = 38");

  const foeB = fixedFoe({ wp: 999, maxWP: 999, type: "Humans" });
  const stateB = fixedState({
    c: { cls: "Magic User", sub: "Wizard", level: 4, grimoire: ["Earthquake"], wp: 50, maxWP: 50, ward: { pool: 10, rounds: 1, name: "Shield" } },
  });
  stateB.combat = fixedCombat([foeB], { afraid: 2 });
  const rngB = countingRng(fakeRng([10, 10, 10, 7]));
  castSpell(stateB, SPELL_IDX.Earthquake, rngB, []);
  assert.equal(foeB.wp, 999 - 19, "afraid: ceil(38/2) = 19");

  assert.equal(rngA.draws, rngB.draws, "identical rng consumption — halving is post-roll arithmetic only");
});

test("(xii) Volley (Fireballs) halves each bolt's damage while afraid, drawing the same number of rng values", () => {
  const foeA = fixedFoe({ wp: 999, maxWP: 999, type: "Humans" });
  const stateA = fixedState({ c: { cls: "Magic User", sub: "Wizard", level: 4, grimoire: ["Fireballs"], wp: 50, maxWP: 50 } });
  stateA.combat = fixedCombat([foeA]);
  // n = d8 = 1 ball; dmg d10=1 -> 1+2=3; tail: foe miss(7) — no round-advance
  // draws, initiative is rolled once, Phase 51.
  const rngA = countingRng(fakeRng([1, 1, 7]));
  const eventsA = castSpell(stateA, SPELL_IDX.Fireballs, rngA, []);
  assert.equal(eventsA.find((e) => e.type === "volley").totalDamage, 3, "unafraid: 1+2=3");
  assert.equal(foeA.wp, 999 - 3);

  const foeB = fixedFoe({ wp: 999, maxWP: 999, type: "Humans" });
  const stateB = fixedState({ c: { cls: "Magic User", sub: "Wizard", level: 4, grimoire: ["Fireballs"], wp: 50, maxWP: 50 } });
  stateB.combat = fixedCombat([foeB], { afraid: 2 });
  const rngB = countingRng(fakeRng([1, 1, 7]));
  const eventsB = castSpell(stateB, SPELL_IDX.Fireballs, rngB, []);
  assert.equal(eventsB.find((e) => e.type === "volley").totalDamage, 2, "afraid: ceil(3/2) = 2");
  assert.equal(foeB.wp, 999 - 2);

  assert.equal(rngA.draws, rngB.draws, "identical rng consumption — halving is post-roll arithmetic only");
});

// --- (xiii) Item damage: the Pine Staff's fire halves too -------------------

test("(xiii) the Pine Staff's fire damage halves while afraid (ceil)", () => {
  // Phase 39 (GEAR-02): a real content staff name needs a charge to itemReady.
  const pineStaff = () => ({ n: "Pine Staff", kind: "item", use: "fire", charges: 1 });

  const foeA = fixedFoe({ wp: 999, maxWP: 999 });
  const stateA = fixedState({ c: { items: [pineStaff()] } });
  stateA.combat = fixedCombat([foeA]);
  // n = d6 = 1 fireball; dmg d10=1 -> 1+4=5.
  const eventsA = useItem(stateA, 0, fakeRng([1, 1]), []);
  assert.equal(eventsA.find((e) => e.type === "itemBurned").total, 5, "unafraid: full 5 damage");
  assert.equal(foeA.wp, 999 - 5);

  const foeB = fixedFoe({ wp: 999, maxWP: 999 });
  const stateB = fixedState({ c: { items: [pineStaff()] } });
  stateB.combat = fixedCombat([foeB], { afraid: 2 });
  const eventsB = useItem(stateB, 0, fakeRng([1, 1]), []);
  assert.equal(eventsB.find((e) => e.type === "itemBurned").total, 3, "afraid: ceil(5/2) = 3");
  assert.equal(foeB.wp, 999 - 3);
});

// --- (xiv) A scroll read while afraid casts — no scrollRefused -------------

test("(xiv) a scroll read while afraid casts normally — no scrollRefused, ever, for fear", () => {
  // A non-Magic-User Runes/Signs reader forces the scrollCast path (not the
  // grimoire-copy shortcut, which only fires for c.cls === "Magic User"),
  // so this actually exercises castSpell's afraid-tolerant path via readScroll.
  const state = fixedState({ c: { skills: { "Runes/Signs": 1 }, scrolls: 1, grimoire: [] } });
  state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })], { afraid: 2 });
  // rng.pick defaults to options[0] (Heal, lvl1); heal die d10=8; tail: foe
  // miss(7) — no round-advance draws, initiative is rolled once, Phase 51.
  const events = readScroll(state, fakeRng([8, 7]), []);
  assert.equal(events.some((e) => e.type === "scrollRefused"), false, "never refused for fear");
  assert.ok(events.some((e) => e.type === "scrollCast" && e.spell === "Heal"));
  assert.ok(events.some((e) => e.type === "healed"), "the afraid reader's scroll cast still lands");
});
