// test/unit/fluency.test.js
//
// Phase 20 LANG-01 / PARLEY-01 — D-09 fluency tiers and D-01 killSpFor
// equivalence. Mirrors test/unit/resist-roll.test.js's dedicated-leaf-helper
// test style: pin the exact gate/arithmetic of a pure engine/derived.js
// helper, then a single killFoe integration test proving the extraction
// (engine/combat.js#killFoe -> engine/derived.js#killSpFor) is byte-identical.

import test from "node:test";
import assert from "node:assert/strict";

import { fluency, killSpFor } from "../../engine/derived.js";
import { killFoe } from "../../engine/combat.js";
import { RACES } from "../../content/index.js";

/** fakeRng(seq) — `.d()` pops the next value off `seq` regardless of the
 * requested side count; throws on underflow, which doubles as a "no more
 * rng draws expected" assertion (ported from test/unit/combat.test.js
 * verbatim). */
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

// --- D-09: fluency tiers -----------------------------------------------

test("D-09: fluency is 0 / 1 / 1 / 2 for neither / skill / Helm / both", () => {
  assert.equal(fluency({ skills: {}, items: [] }), 0, "neither");
  assert.equal(fluency({ skills: { Language: 1 } }), 1, "skill tier 1");
  assert.equal(fluency({ skills: { Language: 2 } }), 1, "skill tier is irrelevant — still 1");
  assert.equal(fluency({ items: [{ n: "Helm of Knowledge", eff: { tongue: 1 } }] }), 1, "Helm alone");
  assert.equal(
    fluency({ skills: { Language: 1 }, items: [{ n: "Helm of Knowledge", eff: { tongue: 1 } }] }),
    2,
    "both",
  );
});

test("D-09 boundaries: undefined skills/items, a zero tongue effect, and an unrelated skill all read 0", () => {
  assert.equal(fluency({}), 0, "no skills/items keys at all");
  assert.equal(fluency({ items: [{ n: "x", eff: { tongue: 0 } }] }), 0, "a zero tongue effect does not count");
  assert.equal(fluency({ skills: { Tracking: 1 } }), 0, "an unrelated skill does not count");
});

test("D-09 purity: fluency neither draws nor mutates", () => {
  const c = { skills: { Language: 1 }, items: [{ n: "Helm of Knowledge", eff: { tongue: 1 } }] };
  const before = structuredClone(c);
  fluency(c);
  assert.deepStrictEqual(c, before, "fluency must not mutate its argument");
  assert.equal(fluency.length, 1, "fluency takes exactly one argument (c)");
});

// --- D-01: killSpFor equivalence -----------------------------------------

test("D-01: killSpFor equals the inline killFoe formula for every race x sub x level x foe level x d6", () => {
  const subs = ["Soldier", "Barbarian", "Apprentice", "Con Artist"];
  let cases = 0;
  for (const race of Object.keys(RACES)) {
    for (const sub of subs) {
      for (let level = 1; level <= 3; level++) {
        for (let lvl = 1; lvl <= 5; lvl++) {
          for (let roll = 1; roll <= 6; roll++) {
            const c = { race, sub, level };
            const f = { lvl };
            const expected = Math.round(
              (roll * lvl) *
                (5 * (RACES[race].spMul || 1) * (sub === "Barbarian" ? 0.5 : 1) * (sub === "Apprentice" && level < 3 ? 2 : 1)),
            );
            assert.equal(killSpFor(c, f, roll), expected, `race=${race} sub=${sub} level=${level} lvl=${lvl} roll=${roll}`);
            cases++;
          }
        }
      }
    }
  }
  assert.equal(cases, Object.keys(RACES).length * 4 * 3 * 5 * 6);

  // Spot pins (D-01):
  assert.equal(killSpFor({ race: "Human", sub: "Soldier", level: 2 }, { lvl: 2 }, 4), 40, "Human Soldier lvl2 roll4 -> 40");
  assert.equal(
    killSpFor({ race: "Wilmsry", sub: "Con Artist", level: 1 }, { lvl: 1 }, 5),
    13,
    "Wilmsry Con Artist level1 lvl1 roll5 -> 13 (seed-303 combat-equivalent)",
  );
  assert.equal(killSpFor({ race: "Wilmsry", sub: "Barbarian", level: 1 }, { lvl: 1 }, 1), 1, "minimum stays >= 1");
  assert.equal(killSpFor({ race: "Human", sub: "Apprentice", level: 2 }, { lvl: 1 }, 6), 60, "Human Apprentice level2 lvl1 roll6 -> 60");
  assert.equal(killSpFor({ race: "Human", sub: "Apprentice", level: 3 }, { lvl: 1 }, 6), 30, "Human Apprentice level3 lvl1 roll6 -> 30 (no longer <3)");
});

test("D-01: killFoe pays exactly killSpFor(c, f, roll) for the d6 it draws (solo)", () => {
  const state = fixedState();
  const foe = fixedFoe({ type: "Humans", lvl: 2, wp: 0 });
  state.combat = fixedCombat([foe]);
  const events = killFoe(state, foe, fakeRng([4, 6, 20]), []);
  const expected = killSpFor(state.c, foe, 4);
  assert.equal(expected, 40);
  const killed = events.find((e) => e.type === "foeKilled");
  assert.equal(killed.spGained, expected);
  assert.equal(state.c.sp, 40);
});
