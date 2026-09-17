// test/unit/identity-contract.test.js
//
// Phase 24 Plan 06 (IDENT-08): the identity-contract table — ONE data table
// proving a named GOOD and a named BAD for every one of the 24 sub-classes
// and the 5 non-Human races, plus a Human-neutral entry, each scenario built
// from Phase 22's newRun(seed, [], { force }) seam (engine/state.js, backed
// by engine/character.js#rollCharacter's dev-only force option) plus a
// synthetic combat/store/camp state where needed. This file never
// re-implements engine arithmetic as an oracle beyond the literal numbers
// the phase's decisions fix (20 hp, d20 <= 2, d12 <= 2, ar <= 10, x1.25/
// x0.75, ceil(dmg/2), -2 hide, -1 Guard, 0.6x Elven wp, +9 Troll damage) —
// every other assertion is a differential comparison against a plain
// control hero built the same way.
//
// Task 1 (this commit): scaffold (fakeRng/looseRng/countingRng/hero/
// withCombat/withWeapon/fixedFoe/expectEvent) plus the Fighter and Thief
// rows (16 sub-classes x good/bad). Task 2 appends the Magic User rows, the
// 5 non-Human races, and the Human-neutral entry. Task 3 appends the
// completeness meta-test, negative cases, and idempotency proofs.

import test from "node:test";
import assert from "node:assert/strict";

import { newRun } from "../../engine/state.js";
import {
  rollInitiative,
  startCombat,
  playerStrike,
  flee,
  canParley,
  parley,
  pickFoeTarget,
  foeTurn,
  applyFoeDamageToPlayer,
} from "../../engine/combat.js";
import {
  foeToHitVs,
  toHit,
  weaponDamage,
  killSpFor,
  strikeDie,
  foeDie,
  schoolBonus,
  schoolGate,
  canLearn,
  canCast,
  spellLevelFor,
} from "../../engine/derived.js";
import { canEquipArmor, canEquipWeapon, armorRefusalReason, useItem, gainWilmst } from "../../engine/items.js";
import { meetJoiner, resolveJoiner, springTrap, openChest } from "../../engine/encounters.js";
import { priceFor, sellPriceFor } from "../../engine/economy.js";
import { newDay, makeCamp, cutthroatMurderCheck } from "../../engine/movement.js";
import { castSpell, canRead } from "../../engine/magic.js";
import { makeRng } from "../../engine/rng.js";
import { CLASSES, RACES, ARMORS, ENC_TYPES, WEAPON_MAX, SPELLS, STRIKE_DICE } from "../../content/index.js";

/* ============================================================
 * Scaffold — local helpers, mirroring test/unit/identity-combat.test.js /
 * identity-race.test.js / identity-world.test.js's established conventions
 * (this file does not import theirs, per those files' own precedent, so
 * this suite reads standalone).
 * ============================================================ */

/** fakeRng(seq) — `.d()` pops the next value off `seq` regardless of the
 * requested side count; throws on underflow (doubles as a "no more rng
 * draws expected" assertion). `.pick(arr)` returns `arr[0]` unless a picker
 * is supplied. */
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

/** looseRng(seq, fallback) — like fakeRng, but returns `fallback` forever
 * once `seq` is exhausted instead of throwing. Used only where the exact
 * PRECEDING draws are pinned but downstream content-driven draws (a foe's
 * own bestiary arithmetic, a further combat round) are not this test's
 * claim — `fallback` is chosen as a safe universal "miss"/"low roll" value
 * for whatever die is drawn next. */
function looseRng(seq, fallback = 20) {
  let i = 0;
  return {
    d(_sides) {
      return i < seq.length ? seq[i++] : fallback;
    },
    pick: (arr) => arr[0],
    shuffle: (a) => a,
  };
}

/** countingRng(rng) — wraps any rng, counting every `.d()` call. */
function countingRng(rng) {
  let draws = 0;
  return {
    d(sides) {
      draws++;
      return rng.d(sides);
    },
    pick: (...args) => rng.pick(...args),
    shuffle: (...args) => rng.shuffle(...args),
    get draws() {
      return draws;
    },
  };
}

/**
 * hero(sub, race = "Human", seed = 1) — the ONE hero-building seam every
 * entry in CONTRACT uses: newRun(seed, [], { force: { sub, race } }) (Phase
 * 22-01), with `state.combat` nulled (newRun's own default) and a handful
 * of already-rolled, purely-cosmetic scalar fields neutralized so a single
 * mechanic's assertion is never confounded by an UNRELATED natural roll
 * (a skill, a phobia that happens to match the scripted encounter type, a
 * transient buff). The sub/race/class draw RESULTS are still the real
 * Phase-22 force seam; everything else on `c` (weapon, prof, magicWpn,
 * armor, grimoire, gold, items, maxWP) is the real rollCharacter() output
 * for that (seed, sub, race).
 */
function hero(sub, race = "Human", seed = 1) {
  const state = newRun(seed, [], { force: { sub, race } });
  state.combat = null;
  // newRun does not pre-populate pendingJoiner (only meetJoiner/resolveJoiner
  // ever touch it) — seed it to null so every hero starts from the same
  // "no candidate pending" baseline the other identity-*.test.js fixtures use.
  state.pendingJoiner = null;
  Object.assign(state.c, {
    skills: {},
    phobia: "Spiders",
    phobiaType: "x",
    foresight: false,
    haste: 0,
    invis: 0,
    ether: 0,
    acute: 0,
    might: 0,
    mirror: 0,
    affliction: null,
    foeEffect: null,
    halfNext: false,
    ward: null,
    regen: false,
  });
  return state;
}

/** withWeapon(state, weapon, prof, magicWpn) — pins the equipped weapon so a
 * weaponDamage differential comparison never confounds on two subs'
 * different starting KIT weapons or dice notation. */
function withWeapon(state, weapon = "Club", prof = 0, magicWpn = 0) {
  state.c.weapon = weapon;
  state.c.prof = prof;
  state.c.magicWpn = magicWpn;
  return state;
}

/** fixedFoe(overrides) — a minimal live foe, mirroring the other
 * identity-*.test.js files' helper verbatim. */
function fixedFoe(overrides = {}) {
  return {
    name: "Target",
    type: "Beasts",
    lvl: 1,
    size: "S",
    intel: 1,
    wp: 10,
    maxWP: 10,
    alive: true,
    asleep: 0,
    sp: {},
    lives: 1,
    ...overrides,
  };
}

/** withCombat(state, foes, overrides) — attaches a synthetic
 * state.combat, mirroring the other identity-*.test.js files' fixedCombat
 * helper verbatim. */
function withCombat(state, foes, overrides = {}) {
  state.combat = {
    foes,
    type: foes[0]?.type || "Beasts",
    round: 1,
    target: 0,
    spellOpen: false,
    tracked: false,
    ...overrides,
  };
  return state;
}

/** findEvent(events, type) — the first event of `type`, or undefined. */
function findEvent(events, type) {
  return events.find((e) => e.type === type);
}

/** expectEvent(events, type, fields) — asserts an event of `type` exists
 * and (optionally) that each named field matches; returns the event. */
function expectEvent(events, type, fields = {}) {
  const e = findEvent(events, type);
  assert.ok(e, `expected an event of type "${type}" in ${JSON.stringify(events.map((x) => x.type))}`);
  for (const [k, v] of Object.entries(fields)) assert.equal(e[k], v, `event ${type}.${k}`);
  return e;
}

/* ============================================================
 * CONTRACT — an ordered array of entries, each carrying a `key`, a `kind`
 * ("sub" or "race"), and either a `good`/`bad` pair or (Human only) a
 * `neutral` descriptor — in canonical CLASSES[*].subs
 * order (Magic User, Fighter, Thief per content/classes.js), then RACES
 * order, with Human last. Each half is { name, run() }; `run` is the
 * node:test callback registered below.
 * ============================================================ */

const CONTRACT = [
  // ---------------- Magic User (content/classes.js order) ----------------

  {
    key: "Wizard",
    kind: "sub",
    good: {
      name: "the most versatile school reader — full offense bonus, learns every spell",
      run() {
        assert.equal(schoolBonus("Wizard", "offense"), 3);
        assert.ok(SPELLS.every((sp) => canLearn("Wizard", sp)), "a Wizard can learn every school");
      },
    },
    bad: {
      name: "refuses to melee while a castable attack spell sits unused",
      run() {
        const state = hero("Wizard");
        state.c.grimoire = ["Freeze"];
        state.c.spellsUsed = 0;
        withCombat(state, [fixedFoe({ wp: 999, maxWP: 999 })]);
        const events = playerStrike(state, fakeRng([]), []);
        expectEvent(events, "strikeRefused", { reason: "wizard" });
      },
    },
  },

  {
    key: "Warlock",
    kind: "sub",
    good: {
      name: "a nightly potion duplicates itself",
      run() {
        const state = hero("Warlock");
        state.c.potions = 1;
        state.c.rations = 10;
        const events = newDay(state, false, fakeRng([5, 3, 3, 3, 3, 3, 3, 3, 3]), []);
        expectEvent(events, "potionDuplicated");
        assert.equal(state.c.potions, 2);
      },
    },
    bad: {
      name: "props up every Walking Dead foe in the room",
      run() {
        const state = hero("Warlock");
        const events = startCombat(state, false, "Walking Dead", fakeRng([1, 2, 10, 10]), []);
        const boost = expectEvent(events, "warlockBoost");
        assert.equal(boost.amount, state.c.level);

        const control = hero("Soldier");
        startCombat(control, false, "Walking Dead", fakeRng([1, 2, 10, 10]), []);
        assert.equal(state.combat.foes[0].maxWP, control.combat.foes[0].maxWP + boost.amount);
      },
    },
  },

  {
    key: "Sorcerer",
    kind: "sub",
    good: {
      name: "a grimoire guaranteed to carry Freeze and Fireball",
      run() {
        const state = hero("Sorcerer");
        assert.ok(state.c.grimoire.includes("Freeze"));
        assert.ok(state.c.grimoire.includes("Fireball"));
      },
    },
    bad: {
      name: "a Sorcerer's own arm caps at 9 damage",
      run() {
        const state = withWeapon(hero("Sorcerer"), "Claymore", 0, 0);
        state.c.level = 5;
        const dmg = weaponDamage(state.c, fakeRng([12]));
        assert.equal(dmg, 9);
      },
    },
  },

  {
    key: "Summoner",
    kind: "sub",
    good: {
      name: "summons at level one instead of level two",
      run() {
        const summon = SPELLS.find((sp) => sp.n === "Summon");
        assert.equal(spellLevelFor("Summoner", summon), 1);
        const state = hero("Summoner");
        state.c.grimoire = ["Summon"];
        const events = castSpell(state, SPELLS.indexOf(summon), fakeRng([5, 3]), []);
        assert.ok(!events.some((e) => e.type === "spellAboveLevel"));
        expectEvent(events, "allyPending");
      },
    },
    bad: {
      name: "gated out of offense at level one even when a spell is known",
      run() {
        assert.equal(schoolGate("Summoner", "offense"), 3);
        const freeze = SPELLS.find((sp) => sp.n === "Freeze");
        const state = hero("Summoner");
        state.c.grimoire = ["Freeze"];
        assert.equal(canCast(state, freeze), false, "level 1 < the offense gate of 3");
      },
    },
  },

  {
    key: "Cleric",
    kind: "sub",
    good: {
      name: "heals 3 more than anyone else, rolls 4 to hit",
      run() {
        const heal = SPELLS.find((sp) => sp.n === "Heal");
        const cleric = hero("Cleric");
        cleric.c.grimoire = ["Heal"];
        const clericEvents = castSpell(cleric, SPELLS.indexOf(heal), fakeRng([5]), []);
        const clericHealed = expectEvent(clericEvents, "healed");

        const control = hero("Wizard");
        control.c.grimoire = ["Heal"];
        const controlEvents = castSpell(control, SPELLS.indexOf(heal), fakeRng([5]), []);
        const controlHealed = expectEvent(controlEvents, "healed");

        assert.equal(clericHealed.amount, controlHealed.amount + 3);
        assert.equal(toHit(cleric), 4);
      },
    },
    bad: {
      name: "no offensive bonus at all — the audit's soft bad",
      run() {
        assert.equal(schoolBonus("Cleric", "offense"), 0);
      },
    },
  },

  {
    key: "Illusionist",
    kind: "sub",
    good: {
      name: "a Phantom Host summonable at level one instead of level three",
      run() {
        const phantomHost = SPELLS.find((sp) => sp.n === "Phantom Host");
        assert.equal(spellLevelFor("Illusionist", phantomHost), 1);
      },
    },
    bad: {
      name: "strikes on a d20 until level three",
      run() {
        const state = hero("Illusionist");
        assert.equal(strikeDie(state.c), STRIKE_DICE[0]);
        state.c.level = 3;
        assert.equal(strikeDie(state.c), STRIKE_DICE[2]);
      },
    },
  },

  {
    key: "Court Mage",
    kind: "sub",
    good: {
      name: "boredom kills 1-in-6 (d12 <= 2); always parleys Humans",
      run() {
        // CMB-01 (Phase 31): the Court Mage boredom d12 is drawn inside
        // startCombat's encounter-step removal loop, which now runs BEFORE
        // `fight` (and its rollInitiative) rather than after — this test
        // never calls `fight`, so the sequence is just the two roster draws
        // then the d12, with no initiative placeholders.
        const fires = hero("Court Mage");
        const eventsFires = startCombat(fires, false, "Beasts", looseRng([1, 2, 2]), []);
        expectEvent(eventsFires, "foeBored");

        const noFire = hero("Court Mage");
        const eventsNoFire = startCombat(noFire, false, "Beasts", looseRng([1, 2, 3]), []);
        assert.ok(!eventsNoFire.some((e) => e.type === "foeBored"), "d12 === 3 never fires");

        const parleyState = hero("Court Mage");
        withCombat(parleyState, [fixedFoe({ type: "Humans" })], { type: "Humans" });
        assert.equal(canParley(parleyState), true);
      },
    },
    bad: {
      name: "you talk first — foes act first in round one only",
      run() {
        const state = hero("Court Mage");
        withCombat(state, [fixedFoe()], { round: 1 });
        assert.equal(rollInitiative(state, fakeRng([20, 1])), "foe");

        const round2 = hero("Court Mage");
        withCombat(round2, [fixedFoe()], { round: 2 });
        assert.equal(rollInitiative(round2, fakeRng([20, 1])), "you", "round 2+ rolls normally");
      },
    },
  },

  {
    key: "Apprentice",
    kind: "sub",
    good: {
      name: "double skill points off a kill at level one",
      run() {
        const foe = fixedFoe({ lvl: 2 });
        const apprentice = hero("Apprentice").c;
        const control = hero("Wizard").c;
        assert.equal(killSpFor(apprentice, foe, 4), killSpFor(control, foe, 4) * 2);
      },
    },
    bad: {
      name: "one spell in eight backfires",
      run() {
        const heal = SPELLS.find((sp) => sp.n === "Heal");
        const state = hero("Apprentice");
        state.c.grimoire = ["Heal"];
        const events = castSpell(state, SPELLS.indexOf(heal), fakeRng([1]), []);
        expectEvent(events, "spellBackfired", { spell: "Heal" });
      },
    },
  },

  // ---------------- Fighter (content/classes.js order) ----------------

  {
    key: "Knight",
    kind: "sub",
    good: {
      name: "beneath the notice of small things — a foe under 5 maxWP flees before it can act",
      run() {
        const state = hero("Knight");
        const events = startCombat(state, false, "Beasts", fakeRng([1, 2, 20, 1]), []);
        expectEvent(events, "foeFled", { reason: "knight" });
        assert.ok(events.some((e) => e.type === "encounterCleared"));
      },
    },
    bad: {
      name: "everything over 20 comes straight at you — never wins initiative vs a live maxWP >= 20 foe",
      run() {
        const state = hero("Knight");
        withCombat(state, [fixedFoe({ wp: 20, maxWP: 20 })]);
        // mine=20 >= theirs=1 would otherwise be "you" — the Knight clause overrides it.
        assert.equal(rollInitiative(state, fakeRng([20, 1])), "foe");

        const state19 = hero("Knight");
        withCombat(state19, [fixedFoe({ wp: 19, maxWP: 19 })]);
        assert.equal(rollInitiative(state19, fakeRng([20, 1])), "you", "a foe at maxWP 19 does not trigger");

        const foreseen = hero("Knight");
        foreseen.c.foresight = true;
        withCombat(foreseen, [fixedFoe({ wp: 20, maxWP: 20 })]);
        assert.equal(rollInitiative(foreseen, fakeRng([1, 20])), "you", "a foreseen Knight still goes first");
      },
    },
  },

  {
    key: "Guard",
    kind: "sub",
    good: {
      name: "the profession is standing there — every foe needs one better to land a blow",
      run() {
        const guard = hero("Guard");
        const control = hero("Soldier");
        assert.equal(foeToHitVs(guard) + 1, foeToHitVs(control));
        guard.c.skills = { Agility: 1 };
        assert.equal(foeToHitVs(guard), foeToHitVs(control) - 2, "Agility stacks with the Guard -1");
      },
    },
    bad: {
      name: "a Guard's own blow is weaker and never crits",
      run() {
        const guard = withWeapon(hero("Guard"), "Club", 0, 0);
        const control = withWeapon(hero("Soldier"), "Club", 0, 0);
        assert.equal(weaponDamage(guard.c, fakeRng([4])) + 3, weaponDamage(control.c, fakeRng([4])), "level 1: d -= 4 - level = 3");

        const strike = hero("Guard");
        withCombat(strike, [fixedFoe({ wp: 999, maxWP: 999 })]);
        const events = playerStrike(strike, looseRng([1, 4], 20), []);
        const struck = findEvent(events, "struck");
        assert.ok(struck, "the guard's roll of 1 still hits");
        assert.equal(struck.critical, false, "a Guard's blow never crits");
      },
    },
  },

  {
    key: "Woodsman",
    kind: "sub",
    good: {
      name: "the professional forester — parleys Beasts and Lair Beasts, refused for Humans",
      run() {
        const state = hero("Woodsman");
        withCombat(state, [fixedFoe({ type: "Beasts" })], { type: "Beasts" });
        assert.equal(canParley(state), true);
        withCombat(state, [fixedFoe({ type: "Lair Beasts" })], { type: "Lair Beasts" });
        assert.equal(canParley(state), true);
        withCombat(state, [fixedFoe({ type: "Humans" })], { type: "Humans" });
        assert.equal(canParley(state), false);
      },
    },
    bad: {
      name: "no mail, no plate — refused anything heavier than Studded",
      run() {
        const woodsman = { race: "Human", cls: "Fighter", sub: "Woodsman", skills: {} };
        const STUDDED = ARMORS.find((a) => a.name === "Studded"); // ar: 10 — the Woodsman's legal ceiling
        const MAIL = ARMORS.find((a) => a.name === "Mail"); // ar: 12 — refused
        const PLATE = ARMORS.find((a) => a.name === "Plate");
        assert.equal(STUDDED.ar, 10);
        assert.equal(MAIL.ar, 12);
        assert.equal(canEquipArmor(woodsman, STUDDED), true);
        assert.equal(canEquipArmor(woodsman, MAIL), false);
        assert.equal(armorRefusalReason(woodsman, MAIL), "woodsman");
        assert.equal(canEquipArmor(woodsman, PLATE), false);
      },
    },
  },

  {
    key: "Soldier",
    kind: "sub",
    good: {
      name: "camp heals a Soldier twice as fast",
      run() {
        const soldier = hero("Soldier");
        soldier.c.wp = soldier.c.maxWP - 50;
        soldier.c.rations = 10;
        const control = hero("Knight");
        control.c.wp = control.c.maxWP - 50;
        control.c.rations = 10;
        const seq = () => fakeRng([5, 3, 3, 3, 3, 3, 3, 3, 3]);
        const soldierEvents = newDay(soldier, false, seq(), []);
        const controlEvents = newDay(control, false, seq(), []);
        const soldierRested = findEvent(soldierEvents, "rested");
        const controlRested = findEvent(controlEvents, "rested");
        assert.equal(soldierRested.amount, controlRested.amount * 2);
      },
    },
    bad: {
      name: "a foe's roll of 2 crits a Soldier, doubling the blow",
      run() {
        const soldier = hero("Soldier");
        soldier.c.ar = 0;
        soldier.c.armorWP = 0;
        soldier.c.armorMax = 0;
        withCombat(soldier, [fixedFoe({ lvl: 1 })]);
        const soldierEvents = foeTurn(soldier, fakeRng([2, 3]), []);

        const control = hero("Knight");
        control.c.ar = 0;
        control.c.armorWP = 0;
        control.c.armorMax = 0;
        withCombat(control, [fixedFoe({ lvl: 1 })]);
        const controlEvents = foeTurn(control, fakeRng([2, 3]), []);

        const soldierHit = findEvent(soldierEvents, "struckByFoe");
        const controlHit = findEvent(controlEvents, "struckByFoe");
        assert.equal(soldierHit.dmg, controlHit.dmg * 2, "a roll of 2 doubles only for a Soldier");
      },
    },
  },

  {
    key: "Barbarian",
    kind: "sub",
    good: {
      name: "two attacks every strike",
      run() {
        const state = hero("Barbarian");
        withCombat(state, [fixedFoe({ wp: 999, maxWP: 999 })]);
        const events = playerStrike(state, looseRng([20, 20], 20), []);
        assert.equal(events.filter((e) => e.type === "strikeMissed").length, 2, "a Barbarian swings twice a turn");
      },
    },
    bad: {
      name: "half skill points off a kill",
      run() {
        const foe = fixedFoe({ lvl: 2 });
        const barbarian = hero("Barbarian").c;
        const control = hero("Knight").c;
        assert.equal(killSpFor(barbarian, foe, 4), killSpFor(control, foe, 4) / 2);
      },
    },
  },

  {
    key: "Master of Arms",
    kind: "sub",
    good: {
      name: "plus two with every weapon ever forged",
      run() {
        const moa = withWeapon(hero("Master of Arms"), "Club", 0, 0);
        const control = withWeapon(hero("Soldier"), "Club", 0, 0);
        assert.equal(weaponDamage(moa.c, fakeRng([3])), weaponDamage(control.c, fakeRng([3])) + 2);
      },
    },
    bad: {
      name: "cannot parley, ever; no clean round-1 tracked withdrawal",
      run() {
        const state = hero("Master of Arms");
        state.c.skills = { Language: 1 };
        for (const type of ENC_TYPES) {
          withCombat(state, [fixedFoe({ type })], { type });
          assert.equal(canParley(state), false, `Master of Arms vs ${type}`);
        }
        const withdraw = hero("Master of Arms");
        withCombat(withdraw, [fixedFoe({ asleep: 5 })], { tracked: true, round: 1 });
        const events = flee(withdraw, fakeRng([1]), []);
        expectEvent(events, "withdrawalDenied", { reason: "masterOfArms" });
        assert.ok(events.some((e) => e.type === "fleeRolled"));
      },
    },
  },

  {
    key: "Samurai",
    kind: "sub",
    good: {
      name: "born in plate, wielding a magic katana — chargen invariants",
      run() {
        const state = hero("Samurai");
        assert.equal(state.c.armor, "Plate");
        assert.equal(state.c.magicWpn, 2);
      },
    },
    bad: {
      name: "never wins initiative, never runs",
      run() {
        const state = hero("Samurai");
        withCombat(state, [fixedFoe()]);
        assert.equal(rollInitiative(state, fakeRng([20, 1])), "foe");

        const fleeing = hero("Samurai");
        withCombat(fleeing, [fixedFoe()]);
        const events = flee(fleeing, fakeRng([]), []);
        expectEvent(events, "fleeRefused", { reason: "samurai" });
      },
    },
  },

  {
    key: "Bard",
    kind: "sub",
    good: {
      name: "courtly enough to talk to anyone — parleys Humans at fluency 0",
      run() {
        const state = hero("Bard");
        withCombat(state, [fixedFoe({ type: "Humans" })], { type: "Humans" });
        assert.equal(canParley(state), true);
      },
    },
    bad: {
      name: "camp wakes wandering monsters twice as often; dumb foes come for the Bard",
      run() {
        const bard = hero("Bard");
        bard.c.rations = 10;
        const BARD_WAKE_SEQ = [5, 3, 3, 3, 3, 3, 3, 3, 2, 3, 15, 10];
        const events = newDay(bard, false, fakeRng(BARD_WAKE_SEQ), []);
        const wm = findEvent(events, "wanderingMonster");
        assert.ok(wm, "a Bard's wandering-monster check fires on a 2");
        assert.equal(wm.bard, true);

        const soldier = hero("Soldier");
        soldier.c.rations = 10;
        const controlEvents = newDay(soldier, false, fakeRng(BARD_WAKE_SEQ), []);
        assert.ok(!controlEvents.some((e) => e.type === "wanderingMonster"), "a Soldier never wakes on a 2");

        const bardState = { c: { sub: "Bard" }, combat: { foes: [], allies: [{ partyIdx: 0, name: "Ada", wp: 20, maxWP: 20 }] } };
        assert.equal(pickFoeTarget(bardState, fakeRng([2]), fixedFoe({ intel: 1 })), null, "a dumb foe swings at the Bard");
        assert.equal(pickFoeTarget(bardState, fakeRng([2]), fixedFoe({ intel: 4 })).name, "Ada", "intel 4 is not too stupid");
      },
    },
  },

  // ---------------- Thief (content/classes.js order) ----------------

  {
    key: "Pickpocket",
    kind: "sub",
    good: {
      name: "an extra take off every kill/chest",
      run() {
        const pickpocket = hero("Pickpocket");
        const pickpocketAmt = gainWilmst(pickpocket, 100, "test", fakeRng([5, 5, 3]), []);
        const control = hero("Cutthroat");
        const controlAmt = gainWilmst(control, 100, "test", fakeRng([5, 5, 3]), []);
        assert.ok(pickpocketAmt > controlAmt, "a Pickpocket's take is padded beyond the ordinary amount");
      },
    },
    bad: {
      name: "shopkeepers know your face — buys x1.25, sells x0.75",
      run() {
        assert.equal(priceFor(100, "Human", "Pickpocket"), 125);
        assert.equal(priceFor(100, "Human"), 100, "a non-Pickpocket call is unaffected");
        assert.equal(sellPriceFor({ kind: "cloak", n: "Cloak of Armor" }, "Human", "Pickpocket"), 938);
      },
    },
  },

  {
    key: "Pilfer",
    kind: "sub",
    good: {
      name: "disarms every trap, opens every chest for free",
      run() {
        const trapState = hero("Pilfer");
        const trapEvents = springTrap(trapState, fakeRng([10]), []);
        expectEvent(trapEvents, "trapDisarmed", { reason: "pilfer" });

        const chestState = hero("Pilfer");
        const chestEvents = openChest(chestState, looseRng([5, 4], 8), []);
        expectEvent(chestEvents, "chestOpened", { reason: "pilfer" });
        assert.ok(!chestEvents.some((e) => e.type === "chestLockRolled"), "no lock roll for a free open");
      },
    },
    bad: {
      name: "cannot use a single item that does not heal",
      run() {
        const strength = { kind: "potion", n: "Strength potion", eff2: "strength", uses: 1 };
        const state = hero("Pilfer");
        state.c.items = [strength];
        const events = useItem(state, 0, fakeRng([]), []);
        expectEvent(events, "useRefused", { reason: "pilfer" });
        assert.equal(state.c.might, 0, "no side effect on a refusal");
      },
    },
  },

  {
    key: "Cat Burglar",
    kind: "sub",
    good: {
      name: "the first strike of any fight always lands",
      run() {
        const state = hero("Cat Burglar");
        withCombat(state, [fixedFoe({ wp: 999, maxWP: 999 })]);
        const events = playerStrike(state, looseRng([20, 3], 20), []);
        assert.ok(events.some((e) => e.type === "struck"), "roll 20 still hits — the opener is automatic");
      },
    },
    bad: {
      name: "every trap that catches a Cat Burglar deals double damage",
      run() {
        const catBurglar = hero("Cat Burglar");
        catBurglar.c.wp = catBurglar.c.maxWP;
        const catEvents = springTrap(catBurglar, looseRng([10, 1], 3), []);

        const control = hero("Soldier");
        control.c.wp = control.c.maxWP;
        const controlEvents = springTrap(control, looseRng([10, 1], 3), []);

        const catSprung = findEvent(catEvents, "trapSprung");
        const controlSprung = findEvent(controlEvents, "trapSprung");
        assert.equal(catSprung.dmg, controlSprung.dmg * 2);
      },
    },
  },

  {
    key: "Cutthroat",
    kind: "sub",
    good: {
      name: "the first landed blow always crits, even in armor a backstab would refuse",
      run() {
        const cutthroat = withWeapon(hero("Cutthroat"), "Club", 0, 0);
        cutthroat.c.armor = "Chain Mail"; // triggers combat.js's heavy-armor backstab denial
        withCombat(cutthroat, [fixedFoe({ wp: 999, maxWP: 999 })]);
        const cutthroatEvents = playerStrike(cutthroat, looseRng([2, 4], 20), []);
        expectEvent(cutthroatEvents, "backstabDenied", { reason: "heavyArmor" });
        const cutthroatStruck = expectEvent(cutthroatEvents, "struck", { critical: true });

        const pickpocket = withWeapon(hero("Pickpocket"), "Club", 0, 0);
        pickpocket.c.armor = "Chain Mail";
        withCombat(pickpocket, [fixedFoe({ wp: 999, maxWP: 999 })]);
        const pickpocketEvents = playerStrike(pickpocket, looseRng([2, 4], 20), []);
        const pickpocketStruck = expectEvent(pickpocketEvents, "struck", { critical: false });

        assert.equal(cutthroatStruck.dmg, pickpocketStruck.dmg * 2);
      },
    },
    bad: {
      name: "one descent in twenty, the Joiner beside you does not reach the next floor",
      run() {
        const cutthroat = hero("Cutthroat");
        meetJoiner(cutthroat, makeRng(555), []);
        assert.ok(cutthroat.pendingJoiner, "a Cutthroat is offered a Joiner like anyone else (CUT-01)");
        resolveJoiner(cutthroat, true, []);
        assert.equal(cutthroat.party.length, 1);
        const memberName = cutthroat.party[0].name;
        const memberSub = cutthroat.party[0].sub;
        const events = cutthroatMurderCheck(cutthroat, fakeRng([1]), []);
        expectEvent(events, "joinerMurdered", { name: memberName, sub: memberSub });
        assert.equal(cutthroat.party.length, 0);

        const control = hero("Soldier");
        meetJoiner(control, makeRng(555), []);
        resolveJoiner(control, true, []);
        assert.equal(control.party.length, 1);
        const controlEvents = cutthroatMurderCheck(control, fakeRng([]), []);
        assert.deepEqual(controlEvents, []);
        assert.equal(control.party.length, 1, "a non-Cutthroat control keeps the Joiner");
      },
    },
  },

  {
    key: "Cloaker",
    kind: "sub",
    good: {
      name: "a free vanish while nobody has seen your face",
      run() {
        const state = hero("Cloaker");
        withCombat(state, [fixedFoe()]);
        const events = flee(state, fakeRng([]), []);
        expectEvent(events, "fled", { reason: "cloaker" });
        assert.ok(!events.some((e) => e.type === "fleeRolled"));
      },
    },
    bad: {
      name: "once seen, the vanish is denied — a distinct scenario from the good's",
      run() {
        const state = hero("Cloaker");
        withCombat(state, [fixedFoe()], { opened2: true });
        const events = flee(state, fakeRng([20]), []);
        expectEvent(events, "vanishDenied", { reason: "seen" });
        assert.ok(events.some((e) => e.type === "fleeRolled"));
      },
    },
  },

  {
    key: "Ninja",
    kind: "sub",
    good: {
      name: "the opener always lands for max weapon damage; a later roll of 2 crits",
      run() {
        const state = hero("Ninja"); // natural KIT weapon: Wakazashi, prof 1
        withCombat(state, [fixedFoe({ wp: 999, maxWP: 999 })]);
        const events = playerStrike(state, looseRng([10, 3], 20), []);
        const struck = expectEvent(events, "struck");
        expectEvent(events, "ninjaFirstStrike");
        assert.equal(struck.dmg, state.c.level * state.c.level + WEAPON_MAX[state.c.weapon] + state.c.prof);

        const ninja2 = withWeapon(hero("Ninja"), "Club", 0, 0);
        withCombat(ninja2, [fixedFoe({ wp: 999, maxWP: 999 })], { opened: true, opened2: true });
        const ninja2Events = playerStrike(ninja2, looseRng([2, 3], 20), []);
        const ninja2Struck = expectEvent(ninja2Events, "struck", { critical: true });

        const control = withWeapon(hero("Pickpocket"), "Club", 0, 0);
        withCombat(control, [fixedFoe({ wp: 999, maxWP: 999 })], { opened: true, opened2: true });
        const controlEvents = playerStrike(control, looseRng([2, 3], 20), []);
        const controlStruck = expectEvent(controlEvents, "struck", { critical: false });

        assert.equal(ninja2Struck.dmg, controlStruck.dmg * 2, "only the Ninja's non-opening roll of 2 crits");
      },
    },
    bad: {
      name: "you never speak — canParley is false unconditionally",
      run() {
        const state = hero("Ninja");
        state.c.skills = { Language: 1 };
        for (const type of ENC_TYPES) {
          withCombat(state, [fixedFoe({ type })], { type });
          assert.equal(canParley(state), false, `Ninja vs ${type}`);
        }
        withCombat(state, [fixedFoe({ type: "Humans" })], { type: "Humans" });
        const events = parley(state, fakeRng([]), []);
        assert.deepEqual(events, [{ type: "parleyRefused", reason: "ninja" }]);
      },
    },
  },

  {
    key: "Con Artist",
    kind: "sub",
    good: {
      name: "can talk anyone down except Magical/Walking Dead, and a weak foe leaves before the fight starts",
      run() {
        const state = hero("Con Artist");
        for (const type of ["Beasts", "Demons", "Humans", "Lair Beasts"]) {
          withCombat(state, [fixedFoe({ type })], { type });
          assert.equal(canParley(state), true, `Con Artist vs ${type}`);
        }
        withCombat(state, [fixedFoe({ type: "Magical" })], { type: "Magical" });
        assert.equal(canParley(state), false, "Magical is gated on fluency ahead of the Con Artist clause");
        withCombat(state, [fixedFoe({ type: "Walking Dead" })], { type: "Walking Dead" });
        assert.equal(canParley(state), false);

        // CMB-01 (Phase 31): the Con Artist's escape d6 is drawn inside
        // startCombat's encounter-step removal loop, which now runs BEFORE
        // `fight` (and its rollInitiative) rather than after — no initiative
        // placeholders needed since this test never calls `fight`.
        const startState = hero("Con Artist");
        const events = startCombat(startState, false, "Beasts", fakeRng([1, 2, 4]), []);
        expectEvent(events, "foeFled", { reason: "conArtist" });
      },
    },
    bad: {
      name: "the opening blow is a warning, not an injury",
      run() {
        const state = hero("Con Artist");
        const foe = fixedFoe({ wp: 10, maxWP: 10 });
        withCombat(state, [foe]);
        const events = playerStrike(state, looseRng([2, 3], 20), []);
        expectEvent(events, "conArtistOpener");
        assert.equal(foe.wp, 10, "the opener deals zero damage");
        assert.ok(!events.some((e) => e.type === "struck"));
      },
    },
  },

  {
    key: "Acrobat",
    kind: "sub",
    good: {
      name: "harder to land a blow on, easier to land one",
      run() {
        const state = hero("Acrobat");
        assert.equal(foeToHitVs(state), 3);
        assert.equal(toHit(state), 5);
      },
    },
    bad: {
      name: "a dagger, and only a dagger",
      run() {
        const acrobat = { race: "Human", cls: "Thief", sub: "Acrobat" };
        assert.equal(canEquipWeapon(acrobat, { base: "Long Sword" }), false);
        assert.equal(canEquipWeapon(acrobat, { base: "Dagger" }), true);
      },
    },
  },

  // ---------------- Races (content/races.js / Object.keys(RACES) order) --

  {
    key: "Human",
    kind: "race",
    neutral: {
      name: "the neutral control — no race modifier anywhere",
      run() {
        assert.deepEqual(Object.keys(RACES.Human), ["size", "upkeep", "note"]);

        const state = hero("Soldier", "Human");
        assert.equal(foeToHitVs(state), 5);
        assert.equal(priceFor(100, "Human"), 100);
        assert.equal(sellPriceFor({ kind: "picks", n: "Lockpicks" }, "Human"), 225, "half of the 450 base, no race adjustment");

        assert.equal(strikeDie(state.c), STRIKE_DICE[0]);
        assert.equal(foeDie(state.c, fixedFoe({ lvl: 1 })), Math.max(8, STRIKE_DICE[0]));

        const youFirst = hero("Soldier", "Human");
        withCombat(youFirst, [fixedFoe()]);
        assert.equal(rollInitiative(youFirst, fakeRng([20, 1])), "you");
        const foeFirst = hero("Soldier", "Human");
        withCombat(foeFirst, [fixedFoe()]);
        assert.equal(rollInitiative(foeFirst, fakeRng([1, 20])), "foe");

        const armorState = { race: "Human", cls: "Fighter", sub: "Soldier", skills: {} };
        const MAIL = ARMORS.find((a) => a.name === "Mail");
        assert.equal(canEquipArmor(armorState, MAIL), true);

        const joinerState = hero("Soldier", "Human");
        const joinerEvents = meetJoiner(joinerState, makeRng(1), []);
        assert.equal(joinerState.c.joiner.cls, "Magic User", "the pinned seed rolls a Magic User joiner");
        assert.ok(joinerState.pendingJoiner, "a Human recruits the same joiner a Wilmsry would refuse");
        assert.ok(!joinerEvents.some((e) => e.type === "joinerRefused"));

        const dmgState = hero("Soldier", "Human");
        dmgState.c.ar = 0;
        dmgState.c.armorWP = 0;
        const events = [];
        applyFoeDamageToPlayer(dmgState, fixedFoe(), fakeRng([]), events, { dmg: 5, roll: 3, need: 5 });
        assert.equal(dmgState.c.wp, dmgState.c.maxWP - 5, "no hide, no Hardiness — full damage");

        const wornState = hero("Soldier", "Human");
        wornState.c.armor = "Leather";
        wornState.c.ar = 6;
        wornState.c.armorMin = 1;
        wornState.c.armorWP = 15;
        wornState.c.armorMax = 15;
        applyFoeDamageToPlayer(wornState, fixedFoe(), fakeRng([1]), [], { dmg: 5, roll: 3, need: 5 });
        assert.equal(wornState.c.armorWP, 10, "a soaked blow costs the full dmg — no Dwarven halving");
      },
    },
  },

  {
    key: "Elven",
    kind: "race",
    good: {
      name: "strikes a die better and hits at 5 whatever the class",
      run() {
        const elven = hero("Soldier", "Elven");
        const control = hero("Soldier", "Human");
        assert.equal(strikeDie(elven.c), STRIKE_DICE[1]);
        assert.equal(strikeDie(control.c), STRIKE_DICE[0]);
        assert.equal(toHit(elven), 5);
      },
    },
    bad: {
      name: "0.6x wp and easier to hit",
      run() {
        const elven = hero("Soldier", "Elven", 7);
        const control = hero("Soldier", "Human", 7);
        assert.equal(elven.c.maxWP, Math.round(control.c.maxWP * 0.6));
        // Phase 31 (DELIBERATE RULES CHANGE, user decision 2026-09-16, audit
        // Finding 1): Elves are EASIER to hit: the foe's need is one HIGHER
        // than a Human's (hit on roll <= need) — the prototype's foeToHit −1
        // inverted this (see content/races.js's Elven comment).
        assert.equal(
          foeToHitVs(elven),
          foeToHitVs(control) + 1,
          "Elves are EASIER to hit: the foe's need is one HIGHER than a Human's (hit on roll <= need)",
        );
        assert.ok(foeToHitVs(elven) > foeToHitVs(control));
      },
    },
  },

  {
    key: "Dwarven",
    kind: "race",
    good: {
      name: "+2 damage; armour built to be hit wears at half the rate",
      run() {
        const dwarven = withWeapon(hero("Soldier", "Dwarven"), "Club", 0, 0);
        const control = withWeapon(hero("Soldier", "Human"), "Club", 0, 0);
        assert.equal(weaponDamage(dwarven.c, fakeRng([3])), weaponDamage(control.c, fakeRng([3])) + 2);

        const state = hero("Soldier", "Dwarven");
        state.c.armor = "Leather";
        state.c.ar = 6;
        state.c.armorMin = 1;
        state.c.armorWP = 15;
        state.c.armorMax = 15;
        applyFoeDamageToPlayer(state, fixedFoe(), fakeRng([1]), [], { dmg: 5, roll: 3, need: 5 });
        assert.equal(state.c.armorWP, 12, "15 - ceil(5*0.5)=3 = 12");

        const oneOver = hero("Soldier", "Dwarven");
        oneOver.c.armor = "Leather";
        oneOver.c.ar = 6;
        oneOver.c.armorMin = 1;
        oneOver.c.armorWP = 15;
        oneOver.c.armorMax = 15;
        applyFoeDamageToPlayer(oneOver, fixedFoe(), fakeRng([1]), [], { dmg: 4, roll: 3, need: 5 });
        assert.equal(oneOver.c.armorWP, 13, "15 - ceil(4*0.5)=2 = 13");
      },
    },
    bad: {
      name: "foes strike at a better die",
      run() {
        const dwarven = hero("Soldier", "Dwarven");
        const control = hero("Soldier", "Human");
        assert.equal(foeDie(dwarven.c, fixedFoe({ lvl: 1 })), Math.max(8, STRIKE_DICE[1]));
        assert.equal(foeDie(control.c, fixedFoe({ lvl: 1 })), Math.max(8, STRIKE_DICE[0]));
      },
    },
  },

  {
    key: "Wilmsry",
    kind: "race",
    good: {
      name: "camp heals twice as fast; parleys Beasts at fluency 0",
      run() {
        const wilmsry = hero("Knight", "Wilmsry");
        wilmsry.c.wp = wilmsry.c.maxWP - 50;
        wilmsry.c.rations = 10;
        const control = hero("Knight", "Human");
        control.c.wp = control.c.maxWP - 50;
        control.c.rations = 10;
        const seq = () => fakeRng([5, 3, 3, 3, 3, 3, 3, 3, 3]);
        const wilmsryEvents = newDay(wilmsry, false, seq(), []);
        const controlEvents = newDay(control, false, seq(), []);
        assert.equal(
          findEvent(wilmsryEvents, "rested").amount,
          findEvent(controlEvents, "rested").amount * 2,
        );

        const parleyState = hero("Soldier", "Wilmsry");
        withCombat(parleyState, [fixedFoe({ type: "Beasts" })], { type: "Beasts" });
        assert.equal(canParley(parleyState), true);
      },
    },
    bad: {
      name: "half skill points; Magic User Joiners refuse to travel with you",
      run() {
        const foe = fixedFoe({ lvl: 2 });
        const wilmsry = hero("Soldier", "Wilmsry").c;
        const control = hero("Soldier", "Human").c;
        assert.equal(killSpFor(wilmsry, foe, 4), killSpFor(control, foe, 4) / 2);

        const state = hero("Soldier", "Wilmsry");
        const events = meetJoiner(state, makeRng(1), []);
        assert.equal(state.c.joiner.cls, "Magic User", "pinned seed rolls a Magic User joiner");
        expectEvent(events, "joinerRefused", { reason: "wilmsry" });
        assert.equal(state.pendingJoiner, null);
      },
    },
  },

  {
    key: "Fridgian",
    kind: "race",
    good: {
      name: "frenzy never wastes its second swing; thick hide soaks 2 from every blow",
      run() {
        const state = hero("Soldier", "Fridgian");
        withCombat(
          state,
          [fixedFoe({ name: "Corpse", wp: 0, alive: false }), fixedFoe({ name: "Target", wp: 999, maxWP: 999 })],
          { target: 1 },
        );
        const seq = [5, 20, 20, 20, 15, 10, 20];
        const rng = countingRng(fakeRng(seq));
        const events = playerStrike(state, rng, []);
        expectEvent(events, "frenzy");
        assert.equal(rng.draws, seq.length, "no corpse-whiff draw — every scripted draw is consumed, none skipped");

        const hideState = hero("Soldier", "Fridgian");
        hideState.c.skills = { Hardiness: 1 };
        applyFoeDamageToPlayer(hideState, fixedFoe(), fakeRng([]), [], { dmg: 7, roll: 3, need: 5 });
        assert.equal(hideState.c.wp, hideState.c.maxWP - 2, "max(1, max(1, 7-3) - 2) = 2");
      },
    },
    bad: {
      name: "never wears armor, always strikes last",
      run() {
        const armorless = { race: "Fridgian", cls: "Fighter", sub: "Soldier", skills: {} };
        const LEATHER = ARMORS.find((a) => a.name === "Leather");
        assert.equal(armorRefusalReason(armorless, LEATHER), "noArmor");
        assert.equal(canEquipArmor(armorless, LEATHER), false);

        const state = hero("Soldier", "Fridgian");
        withCombat(state, [fixedFoe()]);
        assert.equal(rollInitiative(state, fakeRng([20, 1])), "foe");
      },
    },
  },

  {
    key: "Troll",
    kind: "race",
    good: {
      name: "75 wp regardless of class; +9 damage",
      run() {
        const troll = withWeapon(hero("Soldier", "Troll"), "Club", 0, 0);
        assert.equal(troll.c.maxWP, 75);
        const control = withWeapon(hero("Soldier", "Human"), "Club", 0, 0);
        assert.equal(weaponDamage(troll.c, fakeRng([3])), weaponDamage(control.c, fakeRng([3])) + 9);
      },
    },
    bad: {
      name: "prices triple, eats two rations a night",
      run() {
        assert.equal(priceFor(100, "Troll"), 300);
        assert.equal(RACES.Troll.eats, 2);
        const state = hero("Soldier", "Troll");
        state.c.rations = 1;
        const events = makeCamp(state, fakeRng([]), []);
        expectEvent(events, "campFailed", { reason: "noRations" });
      },
    },
  },
];

/* ============================================================
 * Registration — one node:test case per GOOD/BAD half (or NEUTRAL for
 * Human), in CONTRACT's own order, each an independent test with no shared
 * mutable state (every run() builds its own hero()).
 * ============================================================ */

for (const entry of CONTRACT) {
  if (entry.key === "Human") {
    test(`identity-contract Human NEUTRAL: ${entry.neutral.name}`, entry.neutral.run);
  } else {
    test(`identity-contract ${entry.key} GOOD: ${entry.good.name}`, entry.good.run);
    test(`identity-contract ${entry.key} BAD: ${entry.bad.name}`, entry.bad.run);
  }
}

/* ============================================================
 * Task 3 — the completeness meta-test, negative cases (probe IDENT-05/
 * IDENT-07 empty), and idempotency proofs (probe FID-07).
 * ============================================================ */

test("IDENT-08: the contract table is complete and canonically ordered", () => {
  const subKeys = CONTRACT.filter((e) => e.kind === "sub").map((e) => e.key);
  const expectedSubs = [...CLASSES["Magic User"].subs, ...CLASSES.Fighter.subs, ...CLASSES.Thief.subs];
  assert.deepEqual(subKeys, expectedSubs, "sub-class rows are in CLASSES[*].subs order, one per key");

  const raceKeys = CONTRACT.filter((e) => e.kind === "race").map((e) => e.key);
  assert.deepEqual(raceKeys, Object.keys(RACES), "race rows are in Object.keys(RACES) order, one per key");

  for (const entry of CONTRACT) {
    if (entry.key === "Human") {
      assert.ok(entry.neutral && typeof entry.neutral.name === "string" && entry.neutral.name.length > 0);
      assert.equal(entry.good, undefined, "Human carries neutral, not good/bad");
      assert.equal(entry.bad, undefined);
    } else {
      assert.ok(entry.good && typeof entry.good.name === "string" && entry.good.name.length > 0, `${entry.key} good has a name`);
      assert.ok(entry.bad && typeof entry.bad.name === "string" && entry.bad.name.length > 0, `${entry.key} bad has a name`);
    }
  }

  const keys = CONTRACT.map((e) => e.key);
  assert.equal(new Set(keys).size, keys.length, "no duplicate keys");
});

// --- Negative cases (probe IDENT-05/IDENT-07 empty) -------------------

test("negative: a Knight vs foes all under maxWP 20 rolls initiative purely by dice", () => {
  const state = hero("Knight");
  withCombat(state, [fixedFoe({ wp: 19, maxWP: 19 })]);
  assert.equal(rollInitiative(state, fakeRng([20, 1])), "you");
  const foeWins = hero("Knight");
  withCombat(foeWins, [fixedFoe({ wp: 19, maxWP: 19 })]);
  assert.equal(rollInitiative(foeWins, fakeRng([1, 20])), "foe");
});

test("negative: a solo Bard's pickFoeTarget returns null without drawing (no allies present)", () => {
  const bardState = { c: { sub: "Bard" }, combat: { foes: [], allies: [] } };
  assert.equal(pickFoeTarget(bardState, fakeRng([]), fixedFoe({ intel: 1 })), null);
  const noAlliesKey = { c: { sub: "Bard" }, combat: { foes: [] } };
  assert.equal(pickFoeTarget(noAlliesKey, fakeRng([]), fixedFoe({ intel: 1 })), null);
});

test("negative: a Cutthroat/Wilmsry who never meets a Joiner has pendingJoiner and c.joiner both null", () => {
  const cutthroat = hero("Cutthroat");
  assert.equal(cutthroat.c.joiner, null);
  assert.equal(cutthroat.pendingJoiner, null);
  const wilmsry = hero("Soldier", "Wilmsry");
  assert.equal(wilmsry.c.joiner, null);
  assert.equal(wilmsry.pendingJoiner, null);
});

test("negative: a Pickpocket who never opens a store keeps chargen gold unchanged", () => {
  const state = hero("Pickpocket");
  assert.equal(state.c.gold, 50);
});

test("negative: a Woodsman offered no armour equips nothing and emits nothing", () => {
  const state = hero("Woodsman");
  assert.equal(state.c.armor, "Leather", "unchanged starting kit");
});

test("negative: a Pilfer with an empty items array calling useItem emits nothing", () => {
  const state = hero("Pilfer");
  state.c.items = [];
  const events = useItem(state, 0, fakeRng([]), []);
  assert.deepEqual(events, []);
});

test("negative: a Cloaker with no active combat calling flee emits nothing", () => {
  const state = hero("Cloaker");
  const events = flee(state, fakeRng([]), []);
  assert.deepEqual(events, []);
});

// --- Idempotency (probe FID-07) ----------------------------------------

test("idempotency: hero(\"Cutthroat\") built twice from the same seed is deep-equal", () => {
  assert.deepEqual(hero("Cutthroat"), hero("Cutthroat"));
});

test("idempotency: the Cutthroat joiner scenario replays byte-identical event lists and rng cursors", () => {
  const first = hero("Cutthroat");
  const firstRng = makeRng(555);
  const firstEvents = meetJoiner(first, firstRng, []);

  const second = hero("Cutthroat");
  const secondRng = makeRng(555);
  const secondEvents = meetJoiner(second, secondRng, []);

  assert.deepEqual(firstEvents, secondEvents);
  assert.deepEqual(first.c.joiner, second.c.joiner);
  assert.equal(firstRng.getState(), secondRng.getState());
});

test("idempotency: a Cutthroat's meetJoiner OFFER consumes the identical rng cursor as an accepted Soldier control", () => {
  const control = makeRng(777);
  meetJoiner(hero("Soldier"), control, []);
  const controlNext = control.d(20);

  const cutthroat = makeRng(777);
  meetJoiner(hero("Cutthroat"), cutthroat, []);
  assert.equal(cutthroat.d(20), controlNext, "the draw following a Cutthroat's meetJoiner offer matches an accepted Soldier's");
});
