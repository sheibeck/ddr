// test/unit/feedback-payload.test.js
//
// Phase 25 (FEED-01/FEED-02/FEED-06), plan 25-01 Task 3 — direct coverage
// for every additive event-payload field landed in Tasks 1-2: the
// foeToHitBreakdown/foeToHitVs equality matrix, the needMods threaded
// through every foe-vs-hero swing event, the passive `soaked` object,
// armorSoaked's `wear`/`halved`, playerStrike's `need`/`critBy`, the
// rested/potionDrunk/armorPatched doubling fields, the zero-draw
// `scrollRefused` refusal, `weaponRefusalReason`'s "acrobat" reason, and the
// EVENT_NARRATION clauses that render all of the above.
//
// Local helper copies (fakeRng/fixedFighter/fixedFloor/fixedState/fixedFoe/
// fixedCombat/fixedAlly/fixedMember/countingRng) mirror test/unit/
// combat.test.js and test/unit/party-combat.test.js verbatim — this repo's
// established per-file-fixture convention (never imported cross-file).

import test from "node:test";
import assert from "node:assert/strict";

import { foeToHitVs, foeToHitBreakdown, toHit } from "../../engine/derived.js";
import { applyFoeDamageToPlayer, foeTurn, playerStrike, flee } from "../../engine/combat.js";
import { newDay } from "../../engine/movement.js";
import { readScroll, drinkPotion } from "../../engine/magic.js";
import { weaponRefusalReason, takeItem, equipItem } from "../../engine/items.js";
import { RACES } from "../../content/index.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";

/** fakeRng(seq) — `.d()` pops the next value off `seq` regardless of the
 * requested side count; `.pick(arr)` returns `arr[0]` unless a picker is
 * supplied. Throws if the sequence underflows, which doubles as a "no more
 * rng draws expected" assertion (ports test/unit/combat.test.js's helper
 * verbatim). */
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
 * call (ports test/unit/combat-scaling.test.js's helper verbatim). */
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

/** A tiny 3x3 floor whose (1,1) center tile's `dark` flag is controlled by
 * `overrides.dark` (default false) — sufficient for every inDark(state) read
 * these tests exercise. */
function fixedFloor(overrides = {}) {
  const { dark = false, ...rest } = overrides;
  const g = [];
  for (let y = 0; y < 3; y++) {
    g.push([]);
    for (let x = 0; x < 3; x++) g[y].push({ wall: false, dark, seen: true, feat: null });
  }
  return { g, px: 1, py: 1, depth: 1, ...rest };
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

/** A combat-scoped ally entry as startCombat's sync produces it. */
function fixedAlly(overrides = {}) {
  return { partyIdx: 0, name: "Ada", lvl: 1, sub: "Fighter", wp: 20, maxWP: 20, ...overrides };
}

/** A persistent roster member (a rollCharacter-shaped sheet; `level` not `lvl`). */
function fixedMember(overrides = {}) {
  return { name: "Ada", level: 1, sub: "Fighter", cls: "Fighter", race: "Human", wp: 20, maxWP: 20, status: "ok", ...overrides };
}

// A generous tail of harmless filler draws (always misses foeToHitVs's
// typical 1-6 range) for tests that run playerStrike -> afterPlayerAction
// and don't care what the foe's own turn/reroll does, only about the
// `struck` event playerStrike itself pushed synchronously.
const FILL = new Array(24).fill(20);

// --- 1. foeToHitBreakdown equality matrix -----------------------------------

test("foeToHitBreakdown: need matches foeToHitVs across the full race x sub x Agility x mirror x invis x dark(+Silence) matrix; mods sum to need-5", () => {
  const subs = ["Soldier", "Guard", "Acrobat", "Wizard"];
  for (const race of Object.keys(RACES)) {
    for (const sub of subs) {
      for (const agility of [0, 1]) {
        for (const mirror of [0, 1]) {
          for (const invis of [0, 1]) {
            for (const dark of [false, true]) {
              const skills = {};
              if (agility) skills.Agility = 1;
              if (dark) skills.Silence = 1;
              const state = fixedState({
                c: { race, sub, skills, mirror: mirror ? 3 : 0, invis: invis ? 3 : 0 },
                floor: { dark },
              });
              const expected = foeToHitVs(state);
              const { need, mods } = foeToHitBreakdown(state);
              assert.equal(need, expected, `${race}/${sub}/ag${agility}/mir${mirror}/inv${invis}/dk${dark}`);
              const deltaSum = mods.reduce((s, m) => s + m.delta, 0);
              assert.equal(5 + deltaSum, need, `mods must sum to need-5 for ${race}/${sub}/ag${agility}/mir${mirror}/inv${invis}/dk${dark}`);
            }
          }
        }
      }
    }
  }
});

test("foeToHitBreakdown: a plain Human Soldier has zero mods; a Guard has exactly one; Guard+Agility orders Agility then Guard", () => {
  const human = fixedState({ c: { race: "Human", sub: "Soldier", skills: {} } });
  assert.deepEqual(foeToHitBreakdown(human).mods, []);

  const guard = fixedState({ c: { race: "Human", sub: "Guard", skills: {} } });
  assert.deepEqual(foeToHitBreakdown(guard).mods, [{ name: "Guard", delta: -1 }]);

  const guardAgile = fixedState({ c: { race: "Human", sub: "Guard", skills: { Agility: 1 } } });
  assert.deepEqual(foeToHitBreakdown(guardAgile).mods, [
    { name: "Agility", delta: -1 },
    { name: "Guard", delta: -1 },
  ]);
});

// --- 2. needMods on events ---------------------------------------------------

test("foeTurn: foeMissed carries needMods for a Guard hero; a plain Soldier's foeMissed has none", () => {
  const guardState = fixedState({ c: { sub: "Guard" } });
  const foe = fixedFoe();
  guardState.combat = fixedCombat([foe]);
  // need = 4 (Guard); roll 5 misses.
  const ev1 = foeTurn(guardState, fakeRng([5]), []);
  const missed1 = ev1.find((e) => e.type === "foeMissed");
  assert.deepEqual(missed1.needMods, [{ name: "Guard", delta: -1 }]);
  assert.equal(missed1.need, 4);

  const soldierState = fixedState({ c: { sub: "Soldier" } });
  const foe2 = fixedFoe();
  soldierState.combat = fixedCombat([foe2]);
  // need = 5 (no mods); roll 6 misses.
  const ev2 = foeTurn(soldierState, fakeRng([6]), []);
  const missed2 = ev2.find((e) => e.type === "foeMissed");
  assert.equal("needMods" in missed2, false);
});

test("foeTurn: struckByFoe carries needMods on a landed hit against a Guard hero", () => {
  const state = fixedState({ c: { sub: "Guard" } });
  const foe = fixedFoe();
  state.combat = fixedCombat([foe]);
  // roll 3 (<= need 4) hits; damage die d6 = 4.
  const ev = foeTurn(state, fakeRng([3, 4]), []);
  const struck = ev.find((e) => e.type === "struckByFoe");
  assert.deepEqual(struck.needMods, [{ name: "Guard", delta: -1 }]);
});

test("foeTurn: the member branch (memberStruck + its miss) carries needMods too — the hero's own passives still apply", () => {
  const foeHit = fixedFoe({ lvl: 1, wp: 30 });
  const allyHit = fixedAlly({ wp: 12, maxWP: 20 });
  const hitState = fixedState({ c: { sub: "Guard" }, party: [fixedMember({ wp: 12 })] });
  hitState.combat = fixedCombat([foeHit], { allies: [allyHit] });
  // pick d(2)=2 -> member; to-hit roll 3 (<= need 4) hits; dmg die d6 = 4.
  const evHit = foeTurn(hitState, fakeRng([2, 3, 4]), []);
  const ms = evHit.find((e) => e.type === "memberStruck");
  assert.deepEqual(ms.needMods, [{ name: "Guard", delta: -1 }]);
  assert.equal(ms.need, 4);

  const foeMiss = fixedFoe({ lvl: 1, wp: 30 });
  const allyMiss = fixedAlly({ wp: 12, maxWP: 20 });
  const missState = fixedState({ c: { sub: "Guard" }, party: [fixedMember({ wp: 12 })] });
  missState.combat = fixedCombat([foeMiss], { allies: [allyMiss] });
  // pick d(2)=2 -> member; to-hit roll 5 (> need 4) misses.
  const evMiss = foeTurn(missState, fakeRng([2, 5]), []);
  const missed = evMiss.find((e) => e.type === "foeMissed" && e.member);
  assert.deepEqual(missed.needMods, [{ name: "Guard", delta: -1 }]);
});

test("flee: pursuitStrike's foeMissed carries needMods for a Guard hero (module-private, exercised via flee)", () => {
  const state = fixedState({ c: { sub: "Guard", cls: "Fighter" } });
  const foe = fixedFoe({ sp: { pursues: true } });
  state.combat = fixedCombat([foe]);
  // flee roll 11 (>=11, bonus 0 for a non-Thief) succeeds; pursuit roll 5 (> need 4) misses.
  const events = flee(state, fakeRng([11, 5]), []);
  const missed = events.find((e) => e.type === "foeMissed");
  assert.deepEqual(missed.needMods, [{ name: "Guard", delta: -1 }]);
  assert.ok(events.some((e) => e.type === "fled" && e.reason === "escaped"));
});

test("foeTurn: C.parleyInsulted appends an 'insulted' entry after the passive breakdown", () => {
  const state = fixedState({ c: { sub: "Guard" } });
  const foe = fixedFoe();
  state.combat = fixedCombat([foe], { parleyInsulted: true });
  // need = 4 (Guard) + 1 (insulted) = 5; roll 6 misses.
  const events = foeTurn(state, fakeRng([6]), []);
  const missed = events.find((e) => e.type === "foeMissed");
  assert.deepEqual(missed.needMods, [
    { name: "Guard", delta: -1 },
    { name: "insulted", delta: 1 },
  ]);
  assert.equal(missed.need, 5);
});

// --- 3. soaked -----------------------------------------------------------

test("applyFoeDamageToPlayer: soaked.hide for a Fridgian; final dmg reflects the soak", () => {
  const state = fixedState({ c: { race: "Fridgian" } });
  const foe = fixedFoe();
  state.combat = fixedCombat([foe]);
  const events = [];
  applyFoeDamageToPlayer(state, foe, fakeRng([]), events, { dmg: 5, roll: 3, need: 5 });
  const struck = events.find((e) => e.type === "struckByFoe");
  assert.deepEqual(struck.soaked, { hide: 2 });
  assert.equal(struck.dmg, 3);
});

test("applyFoeDamageToPlayer: soaked.hardiness for a Hardiness hero", () => {
  const state = fixedState({ c: { skills: { Hardiness: 1 } } });
  const foe = fixedFoe();
  state.combat = fixedCombat([foe]);
  const events = [];
  applyFoeDamageToPlayer(state, foe, fakeRng([]), events, { dmg: 5, roll: 3, need: 5 });
  const struck = events.find((e) => e.type === "struckByFoe");
  assert.deepEqual(struck.soaked, { hardiness: 3 });
  assert.equal(struck.dmg, 2);
});

test("applyFoeDamageToPlayer: soaked stacks Hardiness then hide for a Fridgian with Hardiness", () => {
  const state = fixedState({ c: { race: "Fridgian", skills: { Hardiness: 1 } } });
  const foe = fixedFoe();
  state.combat = fixedCombat([foe]);
  const events = [];
  applyFoeDamageToPlayer(state, foe, fakeRng([]), events, { dmg: 10, roll: 3, need: 5 });
  const struck = events.find((e) => e.type === "struckByFoe");
  assert.deepEqual(struck.soaked, { hardiness: 3, hide: 2 });
  assert.equal(struck.dmg, 5);
});

test("applyFoeDamageToPlayer: soaked.ward for a ward pool 4 vs dmg 9", () => {
  const state = fixedState({ c: { ward: { pool: 4, reflect: false, rounds: 3 } } });
  const foe = fixedFoe();
  state.combat = fixedCombat([foe]);
  const events = [];
  applyFoeDamageToPlayer(state, foe, fakeRng([]), events, { dmg: 9, roll: 3, need: 5 });
  const struck = events.find((e) => e.type === "struckByFoe");
  assert.deepEqual(struck.soaked, { ward: 4 });
  assert.equal(struck.dmg, 5);
});

test("applyFoeDamageToPlayer: plain hero has no soaked/needMods/soldierCrit keys; key order re-pinned", () => {
  const state = fixedState();
  const foe = fixedFoe();
  state.combat = fixedCombat([foe]);
  const events = [];
  applyFoeDamageToPlayer(state, foe, fakeRng([]), events, { dmg: 5, roll: 3, need: 5 });
  const struck = events.find((e) => e.type === "struckByFoe");
  assert.equal("soaked" in struck, false);
  assert.equal("needMods" in struck, false);
  assert.equal("soldierCrit" in struck, false);
  assert.deepEqual(Object.keys(struck), ["type", "name", "roll", "need", "dmg", "ignoresArmor", "critical"]);
});

test("applyFoeDamageToPlayer: an ability bolt (foeBolted) also carries soaked", () => {
  const state = fixedState({ c: { race: "Fridgian" } });
  const foe = fixedFoe();
  state.combat = fixedCombat([foe]);
  const events = [];
  applyFoeDamageToPlayer(state, foe, fakeRng([]), events, { dmg: 6, ability: "krupkeFreeze" });
  const bolted = events.find((e) => e.type === "foeBolted");
  assert.deepEqual(bolted.soaked, { hide: 2 });
  assert.equal(bolted.dmg, 4);
});

// --- 4. soldierCrit -----------------------------------------------------

test("applyFoeDamageToPlayer: soldierCrit is true ONLY for a Soldier's roll of 2 — absent on roll 1, absent for a Guard", () => {
  const soldierState = fixedState({ c: { sub: "Soldier" } });
  const foe = fixedFoe();
  soldierState.combat = fixedCombat([foe]);

  let events = [];
  applyFoeDamageToPlayer(soldierState, foe, fakeRng([]), events, { dmg: 5, roll: 2, need: 5 });
  let struck = events.find((e) => e.type === "struckByFoe");
  assert.equal(struck.soldierCrit, true);
  assert.equal(struck.critical, false);

  events = [];
  applyFoeDamageToPlayer(soldierState, foe, fakeRng([]), events, { dmg: 5, roll: 1, need: 5 });
  struck = events.find((e) => e.type === "struckByFoe");
  assert.equal("soldierCrit" in struck, false);
  assert.equal(struck.critical, true);

  const guardState = fixedState({ c: { sub: "Guard" } });
  events = [];
  applyFoeDamageToPlayer(guardState, foe, fakeRng([]), events, { dmg: 5, roll: 2, need: 5 });
  struck = events.find((e) => e.type === "struckByFoe");
  assert.equal("soldierCrit" in struck, false);
});

// --- 5. armorSoaked wear / halved -----------------------------------------

test("applyFoeDamageToPlayer: armorSoaked reports wear; Dwarven halves it", () => {
  const state = fixedState({ c: { race: "Dwarven", ar: 10, armorMin: 0, armorMax: 10, armorWP: 10 } });
  const foe = fixedFoe();
  state.combat = fixedCombat([foe]);
  const events = [];
  applyFoeDamageToPlayer(state, foe, fakeRng([5]), events, { dmg: 5, roll: 3, need: 5 });
  const soaked = events.find((e) => e.type === "armorSoaked");
  assert.equal(soaked.wear, 3, "ceil(5*0.5) = 3");
  assert.equal(soaked.halved, true);
  assert.equal(state.c.armorWP, 7);
});

test("applyFoeDamageToPlayer: armorSoaked wear is NOT halved for a Human", () => {
  const state = fixedState({ c: { race: "Human", ar: 10, armorMin: 0, armorMax: 10, armorWP: 10 } });
  const foe = fixedFoe();
  state.combat = fixedCombat([foe]);
  const events = [];
  applyFoeDamageToPlayer(state, foe, fakeRng([5]), events, { dmg: 5, roll: 3, need: 5 });
  const soaked = events.find((e) => e.type === "armorSoaked");
  assert.equal(soaked.wear, 5);
  assert.equal("halved" in soaked, false);
});

test("applyFoeDamageToPlayer: magic plate (Cloak of Armor) never wears — wear: 0", () => {
  const state = fixedState({ c: { race: "Human", items: [{ eff: { cloakArmor: 1 } }] } });
  const foe = fixedFoe();
  state.combat = fixedCombat([foe]);
  const events = [];
  // av.ar becomes 15 (plate), av.wp 45; soak roll 1 <= 15 lands on the armor.
  applyFoeDamageToPlayer(state, foe, fakeRng([1]), events, { dmg: 5, roll: 3, need: 5 });
  const soaked = events.find((e) => e.type === "armorSoaked");
  assert.equal(soaked.wear, 0);
  assert.equal("halved" in soaked, false);
});

// --- 6. struck: need + critBy --------------------------------------------

test("playerStrike: struck carries need = toHit(state); critBy absent when not critical (Soldier's noCrit)", () => {
  const state = fixedState({ c: { sub: "Soldier" } });
  const foe = fixedFoe({ wp: 100, maxWP: 100 });
  state.combat = fixedCombat([foe]);
  const need = toHit(state);
  const events = playerStrike(state, fakeRng([need, 4, ...FILL]), []);
  const struck = events.find((e) => e.type === "struck");
  assert.equal(struck.need, need);
  assert.equal("critBy" in struck, false);
});

test("playerStrike: struck.critBy = 'roll' for a plain roll-of-1 crit", () => {
  const state = fixedState({ c: { sub: "X", cls: "Fighter" } });
  const foe = fixedFoe({ wp: 100, maxWP: 100 });
  state.combat = fixedCombat([foe]);
  const events = playerStrike(state, fakeRng([1, 4, ...FILL]), []);
  const struck = events.find((e) => e.type === "struck");
  assert.equal(struck.critical, true);
  assert.equal(struck.critBy, "roll");
});

test("playerStrike: struck.critBy = 'silence' for a Silence opening strike", () => {
  const state = fixedState({ c: { sub: "X", cls: "Fighter", skills: { Silence: 1 } } });
  const foe = fixedFoe({ wp: 100, maxWP: 100 });
  state.combat = fixedCombat([foe]);
  const events = playerStrike(state, fakeRng([3, 4, ...FILL]), []);
  const struck = events.find((e) => e.type === "struck");
  assert.equal(struck.critBy, "silence");
});

test("playerStrike: struck.critBy = 'stealth' for a Stealth opening strike (roll <= 2)", () => {
  const state = fixedState({ c: { sub: "X", cls: "Fighter", skills: { Stealth: 1 } } });
  const foe = fixedFoe({ wp: 100, maxWP: 100 });
  state.combat = fixedCombat([foe]);
  const events = playerStrike(state, fakeRng([2, 4, ...FILL]), []);
  const struck = events.find((e) => e.type === "struck");
  assert.equal(struck.critBy, "stealth");
});

test("playerStrike: struck.critBy = 'backstab' for a plain Thief's opening strike", () => {
  const state = fixedState({ c: { sub: "X", cls: "Thief", armor: "Nothing" } });
  const foe = fixedFoe({ wp: 100, maxWP: 100 });
  state.combat = fixedCombat([foe]);
  const events = playerStrike(state, fakeRng([3, 4, ...FILL]), []);
  const struck = events.find((e) => e.type === "struck");
  assert.equal(struck.critBy, "backstab");
});

test("playerStrike: struck.critBy = 'cutthroat' for a Cutthroat's first landed blow in heavy armour (backstab suppressed)", () => {
  const state = fixedState({ c: { sub: "Cutthroat", cls: "Thief", armor: "Chain Mail" } });
  const foe = fixedFoe({ wp: 100, maxWP: 100 });
  state.combat = fixedCombat([foe]);
  const events = playerStrike(state, fakeRng([3, 4, ...FILL]), []);
  const struck = events.find((e) => e.type === "struck");
  assert.equal(struck.critBy, "cutthroat");
  assert.ok(events.some((e) => e.type === "backstabDenied"), "heavy armor denies the backstab this crit is NOT riding on");
});

test("playerStrike: struck.critBy = 'ninja' for a Ninja's later roll-of-2 (not the auto-hit opening swing)", () => {
  const state = fixedState({ c: { sub: "Ninja", cls: "Thief", armor: "Nothing", skills: { Ambidextrous: 1 } } });
  const foe = fixedFoe({ wp: 100, maxWP: 100 });
  state.combat = fixedCombat([foe]);
  // attack 0 (auto-hit opening swing): roll 20 (irrelevant, auto bypasses to-hit), dmg die 4.
  // attack 1 (opening already spent): roll 2 (<=2 triggers the Ninja clause), dmg die 4.
  const events = playerStrike(state, fakeRng([20, 4, 2, 4, ...FILL]), []);
  const strucks = events.filter((e) => e.type === "struck");
  assert.equal(strucks.length, 2);
  assert.equal(strucks[1].critBy, "ninja");
});

// --- 7. rested / potionDrunk / armorPatched --------------------------------

test("newDay: rested.doubled names Soldier or a heal2x race; absent for a plain Human", () => {
  // wp below maxWP so the heal actually applies (a fully-healed hero's clamped
  // heal pushes NO `rested` event at all — pre-existing, unrelated behavior).
  const soldier = fixedState({ c: { sub: "Soldier", wp: 40 } });
  const ev1 = newDay(soldier, false, fakeRng([5, 2, 2, 2, 2, 2, 2, 2, 2]), []);
  assert.equal(ev1.find((e) => e.type === "rested").doubled, "Soldier");

  const wilmsry = fixedState({ c: { race: "Wilmsry", sub: "Fighter", wp: 40 } });
  const ev2 = newDay(wilmsry, false, fakeRng([5, 2, 2, 2, 2, 2, 2, 2, 2]), []);
  assert.equal(ev2.find((e) => e.type === "rested").doubled, "Wilmsry");

  const human = fixedState({ c: { race: "Human", sub: "Fighter", wp: 40 } });
  const ev3 = newDay(human, false, fakeRng([5, 2, 2, 2, 2, 2, 2, 2, 2]), []);
  assert.equal("doubled" in ev3.find((e) => e.type === "rested"), false);
});

test("newDay: armorPatched.by names Sewing or Master of Arms", () => {
  const sewing = fixedState({ c: { skills: { Sewing: 1 }, armorWP: 10, armorMax: 20, patches: 0 } });
  const ev1 = newDay(sewing, false, fakeRng([5, 6, 2, 2, 2, 2, 2, 2, 2, 2]), []);
  assert.equal(ev1.find((e) => e.type === "armorPatched").by, "Sewing");

  const moa = fixedState({ c: { sub: "Master of Arms", armorWP: 10, armorMax: 20 } });
  const ev2 = newDay(moa, false, fakeRng([5, 3, 2, 2, 2, 2, 2, 2, 2, 2]), []);
  assert.equal(ev2.find((e) => e.type === "armorPatched").by, "Master of Arms");
});

test("drinkPotion: potionDrunk.doubled names a heal2x race; absent for a Human", () => {
  const wilmsry = fixedState({ c: { race: "Wilmsry", potions: 1 } });
  const ev1 = drinkPotion(wilmsry, fakeRng([5]), []);
  const pd1 = ev1.find((e) => e.type === "potionDrunk");
  assert.equal(pd1.doubled, "Wilmsry");
  assert.equal(pd1.amount, (2 * 5 + 5) * 2);

  const human = fixedState({ c: { race: "Human", potions: 1 } });
  const ev2 = drinkPotion(human, fakeRng([5]), []);
  assert.equal("doubled" in ev2.find((e) => e.type === "potionDrunk"), false);
});

// --- 8. scrollRefused --------------------------------------------------

test("readScroll: scrollRefused reasons (noScrolls, pilfer, noRunes) draw zero rng and mutate nothing; a legal reader still reads", () => {
  const noScrolls = fixedState({ c: { scrolls: 0 } });
  assert.deepEqual(readScroll(noScrolls, fakeRng([]), []), [{ type: "scrollRefused", reason: "noScrolls" }]);

  const pilfer = fixedState({ c: { scrolls: 1, cls: "Thief", sub: "Pilfer" } });
  assert.deepEqual(readScroll(pilfer, fakeRng([]), []), [{ type: "scrollRefused", reason: "pilfer" }]);
  assert.equal(pilfer.c.scrolls, 1);

  const noRunes = fixedState({ c: { scrolls: 1, cls: "Fighter", sub: "Soldier" } });
  assert.deepEqual(readScroll(noRunes, fakeRng([]), []), [{ type: "scrollRefused", reason: "noRunes" }]);
  assert.equal(noRunes.c.scrolls, 1);

  const reader = fixedState({ c: { scrolls: 1, cls: "Magic User", sub: "Wizard", level: 5, grimoire: [] } });
  const evReader = readScroll(reader, fakeRng([], { pick: (arr) => arr.find((sp) => sp.n === "Heal") }), []);
  assert.ok(evReader.some((e) => e.type === "scrollRead"));
  assert.ok(!evReader.some((e) => e.type === "scrollRefused"));
});

test("readScroll: the noScrolls/pilfer/noRunes refusals draw exactly zero rng (countingRng proof)", () => {
  const noScrolls = fixedState({ c: { scrolls: 0 } });
  const rng = countingRng(fakeRng([]));
  readScroll(noScrolls, rng, []);
  assert.equal(rng.draws, 0);
});

// --- 9. weaponRefusalReason -----------------------------------------------

test("weaponRefusalReason: Acrobat + Long Sword -> acrobat; Magic User + Broadsword -> wrongClass; Acrobat + Dagger -> null", () => {
  const acrobat = { cls: "Thief", sub: "Acrobat" };
  assert.equal(weaponRefusalReason(acrobat, { base: "Long Sword" }), "acrobat");
  assert.equal(weaponRefusalReason(acrobat, { base: "Dagger" }), null);

  const mu = { cls: "Magic User", sub: "Wizard" };
  assert.equal(weaponRefusalReason(mu, { base: "Broadsword" }), "wrongClass");
});

test("takeItem/equipItem: an Acrobat's weapon rejection reports reason 'acrobat'", () => {
  const takeState = fixedState({ c: { cls: "Thief", sub: "Acrobat", weapon: "Dagger", prof: 0, magicWpn: 0 } });
  const evTake = takeItem(takeState, { kind: "weapon", n: "Long Sword", base: "Long Sword", bonus: 0, txt: "d8" }, []);
  assert.ok(evTake.some((e) => e.type === "itemRejected" && e.reason === "acrobat"));

  const equipState = fixedState({
    c: {
      cls: "Thief",
      sub: "Acrobat",
      weapon: "Dagger",
      items: [{ kind: "weapon", n: "Long Sword", base: "Long Sword", bonus: 0, txt: "d8" }],
    },
  });
  const evEquip = equipItem(equipState, 0, []);
  assert.ok(evEquip.some((e) => e.type === "equipRejected" && e.reason === "acrobat"));
});

// --- 10. narration clauses --------------------------------------------

test("EVENT_NARRATION.struckByFoe: soaked + needMods render; the unflagged sentence is byte-identical to before", () => {
  const decorated = EVENT_NARRATION.struckByFoe({
    type: "struckByFoe",
    name: "Dante",
    roll: 3,
    need: 4,
    dmg: 4,
    ignoresArmor: false,
    critical: false,
    soaked: { hide: 2 },
    needMods: [{ name: "Guard", delta: -1 }],
  });
  assert.match(decorated, /hide soaked 2/);
  assert.match(decorated, /Guard/);
  assert.match(decorated, /[−-]1/);

  const plain = EVENT_NARRATION.struckByFoe({
    type: "struckByFoe",
    name: "Dante",
    roll: 3,
    need: 4,
    dmg: 4,
    ignoresArmor: false,
    critical: false,
  });
  assert.equal(plain, '<span class="roll">3</span> vs 4. Dante hits you for <span class="hurt">4 hp</span>.');
});

test("EVENT_NARRATION.strikeMissed: appends the quip after the roll and the plain miss sentence; absent quip renders identically to before", () => {
  const withQuip = EVENT_NARRATION.strikeMissed({ type: "strikeMissed", target: "Dante", roll: 7, need: 5, quip: "Wide. Impressively wide." });
  assert.match(withQuip, /<span class="roll">7<\/span> vs 5\. .*You miss Dante\.<\/span> Wide\. Impressively wide\.$/);

  const noQuip = EVENT_NARRATION.strikeMissed({ type: "strikeMissed", target: "Dante", roll: 7, need: 5 });
  assert.equal(noQuip, '<span class="roll">7</span> vs 5. <span class="miss">You miss Dante.</span>');
});

test("EVENT_NARRATION: rested/scrollRefused/equipRejected render the new fields in voice", () => {
  assert.match(EVENT_NARRATION.rested({ type: "rested", amount: 16, doubled: "Soldier" }), /Soldier/);
  assert.match(EVENT_NARRATION.scrollRefused({ type: "scrollRefused", reason: "pilfer" }), /Pilfer/i);
  assert.ok(EVENT_NARRATION.scrollRefused({ type: "scrollRefused" }).length > 0);
  assert.match(EVENT_NARRATION.equipRejected({ type: "equipRejected", reason: "acrobat", item: { n: "Long Sword" } }), /dagger/i);
});

test("EVENT_NARRATION.armorSoaked: wear + the Dwarven halving render only when present", () => {
  const halved = EVENT_NARRATION.armorSoaked({ type: "armorSoaked", name: "Dante", amount: 5, wear: 3, halved: true });
  assert.match(halved, /3/);
  assert.match(halved, /half/i);

  const plain = EVENT_NARRATION.armorSoaked({ type: "armorSoaked", name: "Dante", amount: 5, wear: 0 });
  assert.doesNotMatch(plain, /half/i);
});

test("EVENT_NARRATION.struck: critBy reasons each render a distinct line; unflagged critical stays 'Critical!'", () => {
  const base = { type: "struck", roll: 1, need: 5, target: "Dante", dmg: 4, critical: true };
  assert.match(EVENT_NARRATION.struck(base), /Critical!/);
  assert.match(EVENT_NARRATION.struck({ ...base, critBy: "backstab" }), /behind/i);
  assert.match(EVENT_NARRATION.struck({ ...base, critBy: "cutthroat" }), /Cutthroat/);
  assert.match(EVENT_NARRATION.struck({ ...base, critBy: "ninja" }), /Ninja/);
});

// --- Coverage guard sanity: every builder above still survives a bare {type} ---

test("EVENT_NARRATION: the new/extended builders render a non-empty string from a bare {type}", () => {
  for (const type of [
    "scrollRefused",
    "struckByFoe",
    "foeBolted",
    "foeMissed",
    "memberStruck",
    "armorSoaked",
    "struck",
    "strikeMissed",
    "rested",
    "potionDrunk",
    "armorPatched",
    "itemRejected",
    "equipRejected",
  ]) {
    const out = EVENT_NARRATION[type]({ type });
    assert.equal(typeof out, "string");
    assert.ok(out.trim().length > 0, `${type} produced an empty line from a bare {type}`);
  }
});
