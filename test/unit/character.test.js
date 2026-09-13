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
import { rollCharacter, checkLevel, nameFor } from "../../engine/character.js";
import {
  strikeDie,
  toHit,
  weaponDamage,
  upkeep,
  levelFromSP,
  foeDie,
} from "../../engine/derived.js";
import { KIT, STRIKE_DICE, THRESHOLDS, NAMES } from "../../content/index.js";

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

// ---- audit-batch E12 (part 4) + DR-name-generator: determinism-safe,
//      GENERATIVE (first × surname) name dedup ----

// Mirror the engine's index → name decode so the tests can enumerate the full
// combo space independently of nameFor (content/names.js is now a { first, sur }
// bank per race, not a flat pool).
function buildName(pool, idx) {
  const first = pool.first[idx % pool.first.length];
  const sur = pool.sur[Math.floor(idx / pool.first.length)];
  return sur ? first + " " + sur : first;
}
function allNames(pool) {
  const combos = pool.first.length * pool.sur.length;
  const out = [];
  for (let i = 0; i < combos; i++) out.push(buildName(pool, i));
  return out;
}
function comboCount(pool) {
  return pool.first.length * pool.sur.length;
}

test("nameFor consumes exactly ONE rng draw (one gen.next(), same as the old rng.pick), with or without an exclusion", () => {
  for (const race of Object.keys(NAMES)) {
    const pool = NAMES[race];
    for (const seed of [1, 42, 12345]) {
      // baseline: cursor after a single gen.next() (rng.d/pick both draw once)
      const rngOne = makeRng(seed);
      rngOne.next();
      const afterOne = rngOne.getState();

      // no exclusion
      const rngA = makeRng(seed);
      nameFor(rngA, race);
      assert.equal(rngA.getState(), afterOne, `${race}/${seed}: empty-exclude nameFor draws once`);

      // with an exclusion (forward-walk must consume NO extra rng)
      const rngB = makeRng(seed);
      nameFor(rngB, race, allNames(pool)); // exclude every combo → forces the walk
      assert.equal(rngB.getState(), afterOne, `${race}/${seed}: excluded nameFor still draws exactly once`);
    }
  }
});

test("nameFor with empty/absent exclusion is deterministic and yields a real first × surname combo", () => {
  for (const race of Object.keys(NAMES)) {
    const pool = NAMES[race];
    const valid = new Set(allNames(pool));
    for (const seed of [1, 42, 999, 20260907]) {
      const a = nameFor(makeRng(seed), race);
      const b = nameFor(makeRng(seed), race);
      assert.equal(a, b, `${race}/${seed}: same seed → identical name`);
      assert.ok(valid.has(a), `${race}/${seed}: "${a}" is a real first × surname combo`);
    }
  }
});

test("nameFor returns a name NOT in the exclusion when one is available (deterministic forward-walk)", () => {
  const race = "Human";
  const pool = NAMES[race];
  const combos = allNames(pool); // Human has no mononym column → all distinct
  const keep = combos[combos.length - 1];
  const exclude = combos.filter((n) => n !== keep); // exclude all but one
  for (const seed of [1, 2, 3, 7, 42, 100, 555]) {
    const name = nameFor(makeRng(seed), race, exclude);
    assert.equal(name, keep, `seed ${seed}: forward-walk lands on the sole non-excluded name`);
  }
});

test("nameFor falls back to the originally-built name when EVERY combo is excluded", () => {
  for (const race of Object.keys(NAMES)) {
    const pool = NAMES[race];
    const all = allNames(pool);
    const combos = comboCount(pool);
    for (const seed of [1, 5, 9, 77]) {
      // the name it would build from its single draw, with no exclusion applied
      const i = makeRng(seed).d(combos) - 1;
      const expected = buildName(pool, i);
      const name = nameFor(makeRng(seed), race, all);
      assert.equal(name, expected, `${race}/${seed}: a fully-excluded pool falls back to the built name`);
    }
  }
});

test("nameFor yields FAR more distinct names than the old 3-per-race (the duplicate-name fix)", () => {
  for (const race of Object.keys(NAMES)) {
    const seen = new Set();
    for (let seed = 1; seed <= 400; seed++) seen.add(nameFor(makeRng(seed), race));
    // The old flat pool produced ~3 names/race; the generative banks produce
    // hundreds of combos, so 400 seeds must surface many dozens of distinct names.
    assert.ok(seen.size >= 100, `${race}: expected 100+ distinct names across 400 seeds, got ${seen.size}`);
  }
});

test("rollCharacter with an empty/absent exclusion rolls the byte-identical character (parity-safe)", () => {
  for (const seed of [1, 42, 12345, 20260907]) {
    const base = rollCharacter(makeRng(seed));
    const empty = rollCharacter(makeRng(seed), []);
    assert.deepStrictEqual(empty, base, `seed ${seed}: an empty exclusion must not change the roll`);
  }
});

test("rollCharacter forwards the exclusion to the name pick and changes ONLY c.name", () => {
  for (const seed of [3, 77, 555, 4242, 20260907]) {
    const base = rollCharacter(makeRng(seed));
    const excl = rollCharacter(makeRng(seed), [base.name]); // exclude the name it would have used
    const { name: baseName, ...baseRest } = base;
    const { name: exclName, ...exclRest } = excl;
    assert.deepStrictEqual(exclRest, baseRest, `seed ${seed}: every rng-driven field stays identical`);
    assert.notEqual(exclName, baseName, `seed ${seed}: the excluded name was avoided (hundreds of combos available)`);
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
