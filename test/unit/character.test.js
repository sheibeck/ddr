// Task 2 (TDD) — character generation, derived numbers & leveling.
//
// RED-first: this file imports engine/character.js and engine/derived.js,
// which do not exist yet, so `node --test` fails to load it. Implementing
// those two modules (GREEN) turns it green.
//
// Proves: rollCharacter is RNG-injected & deterministic (same seed → identical
// character), the Fridgian-Samurai reroll invariant holds, Magic Users get a
// grimoire and Thieves a cloak, and the derived numbers + checkLevel leveling
// are pure functions of a passed character/state (no global S).

import test from "node:test";
import assert from "node:assert/strict";

import { makeRng } from "../../engine/rng.js";
import { rollCharacter, checkLevel } from "../../engine/character.js";
import {
  strikeDie,
  toHit,
  weaponDamage,
  upkeep,
  levelFromSP,
  foeDie,
} from "../../engine/derived.js";
import { KIT, STRIKE_DICE, THRESHOLDS } from "../../content/index.js";

// A complete, fixed level-1 Fighter for the pure-derived assertions — no RNG,
// no global state, every field the engine's character shape carries.
function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", intel: 10, level: 1, sp: 0,
    maxWP: 55, wp: 55, skills: {}, vp: 0,
    weapon: "Long Sword", prof: 1, magicWpn: 0,
    armor: "Studded", ar: 10, armorMin: 2, armorWP: 18, armorMax: 18, patches: 0,
    temperament: "Wary", motive: "Money", phobia: "Darkness", phobiaType: null,
    potions: 1, rations: 6, gold: 50, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [],
    spellsUsed: 0, kills: 0, might: 0, ward: null, regen: false, mirror: 0, foresight: false,
    name: "Test Delver",
    ...overrides,
  };
}

test("rollCharacter is deterministic: same seed → deepStrictEqual character", () => {
  for (const seed of [1, 42, 12345, 20260907]) {
    const a = rollCharacter(makeRng(seed));
    const b = rollCharacter(makeRng(seed));
    assert.deepStrictEqual(a, b, `seed ${seed} must roll an identical character twice`);
  }
});

test("rollCharacter produces the full character shape", () => {
  const c = rollCharacter(makeRng(12345));
  for (const key of ["cls", "sub", "race", "intel", "level", "maxWP", "wp", "skills", "weapon", "armor", "grimoire", "name"]) {
    assert.ok(key in c, `character is missing field: ${key}`);
  }
  assert.equal(c.level, 1);
  assert.equal(c.wp, c.maxWP);
  assert.ok(c.maxWP > 0);
});

test("no Fridgian Samurai is ever rolled (reroll loop preserved)", () => {
  let sawFridgian = false;
  for (let seed = 1; seed <= 800; seed++) {
    const c = rollCharacter(makeRng(seed));
    if (c.race === "Fridgian") sawFridgian = true;
    assert.ok(
      !(c.race === "Fridgian" && c.sub === "Samurai"),
      `seed ${seed} produced a Fridgian Samurai`,
    );
  }
  assert.ok(sawFridgian, "expected at least one Fridgian across 800 seeds (sanity)");
});

test("Magic Users get a grimoire of >= 4 spells; Thieves start with a cloak", () => {
  let sawMU = false, sawThief = false;
  for (let seed = 1; seed <= 400; seed++) {
    const c = rollCharacter(makeRng(seed));
    if (c.cls === "Magic User") {
      sawMU = true;
      assert.ok(c.grimoire.length >= 4, `seed ${seed}: MU grimoire has ${c.grimoire.length} spells`);
    }
    if (c.cls === "Thief") {
      sawThief = true;
      assert.ok(
        Array.isArray(c.items) && c.items.some((it) => it.kind === "cloak"),
        `seed ${seed}: Thief has no starting cloak`,
      );
    }
  }
  assert.ok(sawMU, "expected at least one Magic User across 400 seeds");
  assert.ok(sawThief, "expected at least one Thief across 400 seeds");
});

test("strikeDie is a pure function of the passed character", () => {
  assert.equal(strikeDie(fixedFighter()), STRIKE_DICE[0]); // level 1, human → d20
  assert.equal(strikeDie(fixedFighter({ level: 5 })), STRIKE_DICE[4]); // d6
  assert.equal(strikeDie(fixedFighter({ race: "Elven" })), STRIKE_DICE[1]); // strikeStep +1 → d12
  assert.equal(strikeDie(fixedFighter({ sub: "Illusionist", level: 2 })), STRIKE_DICE[0]); // d20 until L3
  assert.equal(strikeDie(fixedFighter({ acute: 1 })), STRIKE_DICE[4]); // Acuteness → d6
});

test("toHit is a pure function of the passed state", () => {
  assert.equal(toHit({ c: fixedFighter(), combat: null, floor: null }), 5);
  assert.equal(toHit({ c: fixedFighter({ cls: "Magic User" }), combat: null, floor: null }), 3);
  assert.equal(toHit({ c: fixedFighter({ sub: "Cleric", cls: "Magic User" }), combat: null, floor: null }), 4);
  assert.equal(toHit({ c: fixedFighter({ race: "Elven" }), combat: null, floor: null }), 5);
});

test("weaponDamage is pure and deterministic given a character + rng", () => {
  const a = weaponDamage(fixedFighter(), makeRng(7));
  const b = weaponDamage(fixedFighter(), makeRng(7));
  assert.equal(a, b, "same character + same-seed rng must give identical damage");
  assert.ok(a >= 1, "damage floors at 1");
  // Sorcerer arm caps at 9.
  assert.ok(weaponDamage(fixedFighter({ cls: "Magic User", sub: "Sorcerer", level: 4, might: 40 }), makeRng(7)) <= 9);
});

test("upkeep is a pure function of the passed character", () => {
  assert.equal(upkeep(fixedFighter()), 4); // human
  assert.equal(upkeep(fixedFighter({ race: "Dwarven" })), 1); // dwarf 1/day
  assert.equal(upkeep(fixedFighter({ race: "Troll" })), 15); // troll eats
});

test("foeDie never drops below a d8", () => {
  assert.equal(foeDie(fixedFighter(), { lvl: 5 }), 8); // STRIKE_DICE[4]=6 floored to 8
  assert.equal(foeDie(fixedFighter(), { lvl: 1 }), 20); // STRIKE_DICE[0]
});

test("levelFromSP maps sp thresholds to levels", () => {
  assert.equal(levelFromSP(0), 1);
  assert.equal(levelFromSP(THRESHOLDS[1] - 1), 1);
  assert.equal(levelFromSP(THRESHOLDS[1]), 2);
  assert.equal(levelFromSP(THRESHOLDS[4]), 5);
});

test("checkLevel raises level when sp crosses a threshold", () => {
  const state = { c: fixedFighter({ sp: THRESHOLDS[1] }) };
  const events = checkLevel(state, makeRng(3), []);
  assert.equal(state.c.level, 2);
  assert.ok(state.c.maxWP > 55, "leveling adds Win Potential");
  assert.ok(state.c.wp > 55);
  assert.ok(events.some((e) => e.type === "leveled"), "emits a leveled event");
});

test("checkLevel: a Soldier is knighted at level 3", () => {
  const state = { c: fixedFighter({ sub: "Soldier", sp: THRESHOLDS[2] }) };
  checkLevel(state, makeRng(9), []);
  assert.ok(state.c.level >= 3);
  assert.equal(state.c.sub, "Knight");
  assert.equal(state.c.weapon, KIT["Knight"][0]);
});

test("checkLevel: an Apprentice becomes a real subclass at level 3", () => {
  const state = {
    c: fixedFighter({
      cls: "Magic User", sub: "Apprentice", weapon: "Quarter Staff", prof: 0,
      grimoire: ["Heal", "Shield"], sp: THRESHOLDS[2],
    }),
  };
  checkLevel(state, makeRng(11), []);
  assert.ok(state.c.level >= 3);
  assert.notEqual(state.c.sub, "Apprentice");
});

test("checkLevel: a Sorcerer gains spells on level up", () => {
  const state = {
    c: fixedFighter({
      cls: "Magic User", sub: "Sorcerer", weapon: "Quarter Staff", prof: 0,
      grimoire: ["Freeze", "Fireball"], sp: THRESHOLDS[1],
    }),
  };
  checkLevel(state, makeRng(13), []);
  assert.equal(state.c.level, 2);
  assert.equal(state.c.sub, "Sorcerer");
  assert.ok(state.c.grimoire.length >= 3, "gains two spells (may forget one non-fire)");
});
