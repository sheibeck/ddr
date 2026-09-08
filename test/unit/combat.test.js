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
  foeTurn,
} from "../../engine/combat.js";

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

test("liveFoes: filters to only alive foes; empty outside combat", () => {
  const state = fixedState();
  assert.deepStrictEqual(liveFoes(state), []);
  state.combat = fixedCombat([fixedFoe({ name: "A", alive: true }), fixedFoe({ name: "B", alive: false })]);
  assert.deepStrictEqual(liveFoes(state).map((f) => f.name), ["A"]);
});

test("rollInitiative: a Samurai never wins the first roll unless foreseen", () => {
  const state = fixedState({ c: { sub: "Samurai" } });
  state.combat = fixedCombat([]);
  assert.equal(rollInitiative(state, fakeRng([10, 1])), "foe");

  const state2 = fixedState({ c: { sub: "Samurai", foresight: true } });
  state2.combat = fixedCombat([]);
  assert.equal(rollInitiative(state2, fakeRng([1, 10])), "you");
  assert.equal(state2.c.foresight, false, "foresight is consumed by the roll");
});

// --- playerStrike ------------------------------------------------------

test("playerStrike: a Wizard refuses to melee while a spell charge remains", () => {
  const state = fixedState({ c: { cls: "Magic User", sub: "Wizard", spellsUsed: 0 } });
  state.combat = fixedCombat([fixedFoe({ wp: 10 })]);
  const events = playerStrike(state, fakeRng([]), []);
  assert.deepStrictEqual(events, [{ type: "strikeRefused", reason: "wizard" }]);
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

test("playerStrike: Barbarian, Ambidextrous, and haste each grant two attacks", () => {
  const cases = [{ sub: "Barbarian" }, { skills: { Ambidextrous: 1 } }, { haste: 5 }];
  for (const cOverrides of cases) {
    const state = fixedState({ c: cOverrides });
    state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })]);
    // both strikes miss (roll 20 vs need 5); the still-alive foe's own swing
    // then also misses (foeDie roll 20 vs need 5); initiative mine(15) >=
    // theirs(10) keeps the foes from getting a second turn this call.
    const rng = fakeRng([20, 20, 20, 15, 10]);
    const events = playerStrike(state, rng, []);
    const misses = events.filter((e) => e.type === "strikeMissed").length;
    assert.equal(misses, 2, `${JSON.stringify(cOverrides)} should grant 2 attacks`);
  }
});

test("playerStrike: Fridgian frenzy grants a second wild swing, which can be wasted on a corpse", () => {
  const state = fixedState({ c: { race: "Fridgian" } });
  state.combat = fixedCombat([
    fixedFoe({ name: "Corpse", wp: 0, alive: false }),
    fixedFoe({ name: "Target", wp: 999, maxWP: 999 }),
  ], { target: 1 });
  // frenzy roll d8=5 (<=5, triggers); corpse-waste roll d10=5 (<=5, wastes
  // the whole round); the still-alive Target swings back and misses (foeDie
  // 20 vs need 5); a Fridgian's `slow` race flag forces rollInitiative to
  // ALWAYS resolve "foe" regardless of the mine(15)/theirs(10) roll values
  // (both still drawn), so a second foeTurn miss (20) follows.
  const rng = fakeRng([5, 5, 20, 15, 10, 20]);
  const events = playerStrike(state, rng, []);
  assert.ok(events.some((e) => e.type === "frenzy"));
  assert.ok(events.some((e) => e.type === "frenzyWasted" && e.target === "Corpse"));
  assert.equal(events.some((e) => e.type === "struck"), false, "the round was wasted, nothing landed");
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
  // foeDie=20-sided; roll=1 (hit + natural-1 critical, doubled) vs need=5;
  // dmg base = lvl^2(1) + d6(6) = 7, doubled to 14 -> lethal against 1 wp.
  const rng = fakeRng([1, 6]);
  const events = foeTurn(state, rng, []);
  assert.equal(state.dead, true);
  assert.ok(events.some((e) => e.type === "struckByFoe" && e.dmg === 14 && e.critical === true));
  assert.ok(events.some((e) => e.type === "died" && e.cause === "combat"));
});

test("foeTurn: armor soaks a blow that lands under the character's AR", () => {
  const state = fixedState({ c: { wp: 55, maxWP: 55, ar: 15, armorWP: 20, armorMax: 20, armorMin: 0, armor: "Studded" } });
  const foe = fixedFoe({ wp: 10, maxWP: 10 });
  state.combat = fixedCombat([foe]);
  // foeDie roll=3 (hit, no crit) vs need=5; dmg = 1 + d6(4) = 5; armor soak
  // roll d20=10 <= ar(15) -> the armor takes it, player wp untouched.
  const rng = fakeRng([3, 4, 10]);
  const events = foeTurn(state, rng, []);
  assert.equal(state.c.wp, 55, "the armor absorbed the hit");
  assert.equal(state.c.armorWP, 15, "5 damage came off the armor's wp");
  assert.ok(events.some((e) => e.type === "armorSoaked"));
});

test("foeTurn: a sleeping foe skips its turn without drawing a die", () => {
  const state = fixedState();
  const foe = fixedFoe({ asleep: 3 });
  state.combat = fixedCombat([foe]);
  const events = foeTurn(state, fakeRng([]), []);
  assert.equal(foe.asleep, 2);
  assert.ok(events.some((e) => e.type === "foeSlept"));
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
  const state = fixedState({ c: { cls: "Thief", sub: "Cat Burglar" } });
  state.combat = fixedCombat([fixedFoe()]);
  const events = flee(state, fakeRng([6]), []); // 6 + 5 = 11 >= 11
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

test("canParley: Con Artist/Woodsman/Bard/Language/Wilmsry/Elven gates match the prototype", () => {
  const mk = (cOverrides, type) => {
    const state = fixedState({ c: cOverrides });
    state.combat = fixedCombat([], { type });
    return state;
  };
  assert.equal(canParley(mk({ sub: "Con Artist" }, "Magical")), false, "Magical is never talkative");
  assert.equal(canParley(mk({ sub: "Con Artist" }, "Humans")), true);
  assert.equal(canParley(mk({ sub: "Woodsman" }, "Beasts")), true);
  assert.equal(canParley(mk({ sub: "Woodsman" }, "Humans")), false);
  assert.equal(canParley(mk({ sub: "Bard" }, "Humans")), true);
  assert.equal(canParley(mk({ race: "Wilmsry" }, "Beasts")), true);
  assert.equal(canParley(mk({ race: "Wilmsry" }, "Magical")), false);
  assert.equal(canParley(mk({ race: "Elven" }, "Humans")), true);
  assert.equal(canParley(mk({ race: "Elven" }, "Beasts")), false);
  assert.equal(canParley(mk({ skills: { Language: 1 } }, "Demons")), true);
  assert.equal(canParley(mk({}, "Humans")), false);
});

test("parley: a Con Artist can always parley, and success ends combat with skill points", () => {
  const state = fixedState({ c: { sub: "Con Artist" } });
  const foe = fixedFoe({ type: "Humans" });
  state.combat = fixedCombat([foe]);
  // bonus = 6 (Con Artist) + level(1) - top(1) = 6; need = 15. roll=10 <=
  // 15 -> success. per-foe sp roll d6=3 -> sp=round(3*1*2.5)=8. Humans
  // bonus-payout check d6=2 (<4, skipped).
  const rng = fakeRng([10, 3, 2]);
  const events = parley(state, rng, []);
  assert.ok(events.some((e) => e.type === "spGained" && e.reason === "parley" && e.amount === 8));
  assert.equal(state.combat, null);
});

test("parley: a failing roll triggers the foe's turn instead of ending combat", () => {
  const state = fixedState({ c: { sub: "Con Artist" } });
  const foe = fixedFoe({ type: "Humans", asleep: 5 });
  state.combat = fixedCombat([foe]);
  // 20 > need(15) -> fails; the failure runs afterPlayerAction, whose
  // asleep-foe foeTurn draws nothing, but the round-advance always rolls a
  // fresh initiative (mine=15, theirs=10 -> "you", no second foe turn).
  const rng = fakeRng([20, 15, 10]);
  const events = parley(state, rng, []);
  assert.ok(events.some((e) => e.type === "parleyFailed"));
  assert.ok(state.combat, "combat is still active after a failed parley");
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
  // initiative mine(15) >= theirs(10) avoids a second foe turn.
  const rng = fakeRng([2, 15, 10]);
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
