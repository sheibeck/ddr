// Direct unit coverage for engine/magic.js — castSpell's charge/grimoire
// gating, the Apprentice backfire, a representative sample of spell kinds
// (thrown damage + kill, heal cap, ward, might, earthquake self-damage), and
// drinkPotion/readScroll. The full byte-for-byte prototype comparison lives
// in test/parity/magic-parity.test.js; these tests fill in branches a single
// parity fixture can't reach without hand-crafted character/foe states,
// mirroring test/unit/combat.test.js's established pattern (fakeRng/
// fixedFighter/fixedState/fixedFoe/fixedCombat).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { castSpell, drinkPotion, readScroll, canRead } from "../../engine/magic.js";
import { SPELLS } from "../../content/index.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const SPELL_IDX = Object.fromEntries(SPELLS.map((sp, i) => [sp.n, i]));

/** fakeRng(seq) — `.d()` pops the next value off `seq` regardless of the
 * requested side count; `.pick(arr)` returns `arr[0]` unless a picker is
 * supplied. Throws if the sequence underflows (ports test/unit/combat.test.js's
 * helper verbatim). */
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

function fixedWizard(overrides = {}) {
  return {
    cls: "Magic User", sub: "Wizard", race: "Human", level: 1, sp: 0,
    maxWP: 31, wp: 31, skills: {}, vp: 0,
    weapon: "Dagger", prof: 0, magicWpn: 0,
    armor: "Cloth", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 4, rations: 4, gold: 50, scrolls: 1,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Caster",
    ...overrides,
  };
}

function fixedFloor(overrides = {}) {
  const g = [];
  for (let y = 0; y < 3; y++) {
    g.push([]);
    for (let x = 0; x < 3; x++) g[y].push({ wall: false, dark: false, seen: false, feat: null });
  }
  return { g, px: 1, py: 1, depth: 1, ...overrides };
}

function fixedState(overrides = {}) {
  const { c: cOverrides, floor: floorOverrides, ...rest } = overrides;
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedWizard(cOverrides),
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

// --- charge / grimoire / school gating --------------------------------

test("castSpell: no charges left is a no-op", () => {
  const state = fixedState({ c: { grimoire: ["Heal"], spellsUsed: 4 } }); // maxCharges(lvl1) = 4
  const events = castSpell(state, SPELL_IDX.Heal, fakeRng([]), []);
  assert.equal(state.c.spellsUsed, 4, "no charge consumed");
  assert.equal(state.c.wp, 31, "no effect applied");
  assert.ok(events.some((e) => e.type === "noChargesLeft"));
});

test("castSpell: a spell not in the grimoire is refused", () => {
  const state = fixedState({ c: { grimoire: [] } });
  const events = castSpell(state, SPELL_IDX.Heal, fakeRng([]), []);
  assert.equal(state.c.spellsUsed, 0);
  assert.ok(events.some((e) => e.type === "spellNotKnown"));
});

test("castSpell: a spell above the caster's skill level is refused", () => {
  const state = fixedState({ c: { grimoire: ["Mangle"], level: 1 } }); // Mangle is lvl 5
  const events = castSpell(state, SPELL_IDX.Mangle, fakeRng([]), []);
  assert.equal(state.c.spellsUsed, 0);
  assert.ok(events.some((e) => e.type === "spellAboveLevel"));
});

test("castSpell: a school the subclass may not yet work is refused", () => {
  // Sorcerer's healing school is gated to skill level 4 (MU_CHART).
  const state = fixedState({ c: { sub: "Sorcerer", grimoire: ["Heal"], level: 1 } });
  const events = castSpell(state, SPELL_IDX.Heal, fakeRng([]), []);
  assert.equal(state.c.spellsUsed, 0);
  assert.ok(events.some((e) => e.type === "spellSchoolLocked"));
});

test("castSpell: an unknown scroll-cast spell ignores grimoire/level gating", () => {
  const state = fixedState({ c: { grimoire: [], level: 1, scrollCast: true } });
  const events = castSpell(state, SPELL_IDX.Heal, fakeRng([10]), []);
  assert.ok(events.some((e) => e.type === "healed"));
});

// --- Apprentice backfire ------------------------------------------------

test("castSpell: an Apprentice's thrown spell can backfire and hurt the caster", () => {
  const state = fixedState({ c: { sub: "Apprentice", grimoire: ["Freeze"], wp: 20 } });
  // d8=1 -> backfire; sp.dmg = {n:1,sides:6}, d6=6 -> self = ceil(6/2) = 3
  const events = castSpell(state, SPELL_IDX.Freeze, fakeRng([1, 6]), []);
  assert.equal(state.c.wp, 17, "backfire self-damage applied");
  assert.ok(events.some((e) => e.type === "spellBackfired"));
  assert.ok(events.some((e) => e.type === "backfireSelfDamage" && e.amount === 3));
});

test("castSpell: a lethal Apprentice backfire kills the caster", () => {
  const state = fixedState({ c: { sub: "Apprentice", grimoire: ["Freeze"], wp: 2 } });
  const events = castSpell(state, SPELL_IDX.Freeze, fakeRng([1, 6]), []);
  assert.equal(state.dead, true);
  assert.ok(events.some((e) => e.type === "died" && e.cause === "backfire"));
});

// --- damage / kill --------------------------------------------------------

test("castSpell: a thrown damage spell (Fireball) applies rollDice damage and kills the foe on lethal wp", () => {
  // type "Humans" (not Beasts/Lair Beasts) so killFoe skips the optional
  // cooking-check roll and its rng consumption stays exactly 3 draws.
  const foe = fixedFoe({ wp: 10, maxWP: 10, intel: 1, type: "Humans" });
  const state = fixedState({
    c: { sub: "Wizard", grimoire: ["Fireball"], level: 3 },
    combat: fixedCombat([foe]),
  });
  // toHit d8=1 (bonus 3 for Wizard offense, still a hit); dmg 2d10+4 = 5+5+4=14;
  // killFoe: sp d6=1, coin d10=1, treasure-check d20=20 (skip, >2+lvl)
  const events = castSpell(state, SPELL_IDX.Fireball, fakeRng([1, 5, 5, 1, 1, 20]), []);
  assert.equal(foe.alive, false, "the foe died");
  assert.equal(foe.wp, 0);
  assert.ok(events.some((e) => e.type === "spellHit" && e.dmg === 14));
  assert.ok(events.some((e) => e.type === "foeKilled"));
});

test("castSpell: nothing to throw at is a safe no-op (no foe turn)", () => {
  const state = fixedState({ c: { sub: "Wizard", grimoire: ["Fireball"], level: 3 }, combat: null });
  const events = castSpell(state, SPELL_IDX.Fireball, fakeRng([]), []);
  assert.ok(events.some((e) => e.type === "nothingToThrowAt"));
});

// --- heal / ward / might / earthquake --------------------------------------

test("castSpell: Heal caps at maxWP", () => {
  const state = fixedState({ c: { grimoire: ["Heal"], wp: 25, maxWP: 31 } });
  const events = castSpell(state, SPELL_IDX.Heal, fakeRng([10]), []); // d10=10
  assert.equal(state.c.wp, 31, "healing is capped, not 25+10=35");
  assert.ok(events.some((e) => e.type === "healed" && e.amount === 10));
});

test("castSpell: Shield sets a ward pool/rounds", () => {
  const state = fixedState({ c: { grimoire: ["Shield"] } });
  const events = castSpell(state, SPELL_IDX.Shield, fakeRng([]), []);
  assert.deepStrictEqual(state.c.ward, { pool: 50, rounds: 5, reflect: false, name: "Shield" });
  assert.ok(events.some((e) => e.type === "wardRaised"));
});

test("castSpell: Bubble sets a reflecting ward pool", () => {
  const state = fixedState({ c: { grimoire: ["Bubble"], level: 3 } });
  const events = castSpell(state, SPELL_IDX.Bubble, fakeRng([]), []);
  assert.deepStrictEqual(state.c.ward, { pool: 100, rounds: 12, reflect: true, name: "Bubble" });
  assert.ok(events.some((e) => e.type === "wardRaised" && e.reflect === true));
});

test("castSpell: Strength grants +damage and doubles Win Potential once", () => {
  const state = fixedState({ c: { grimoire: ["Strength"], maxWP: 31, wp: 20 } });
  const events = castSpell(state, SPELL_IDX.Strength, fakeRng([10]), []); // d10=10
  assert.equal(state.c.might, 10);
  assert.equal(state.c.strengthBoost, 31);
  assert.equal(state.c.maxWP, 62, "maxWP doubled");
  assert.equal(state.c.wp, 51, "current wp boosted by the same amount");
  assert.ok(events.some((e) => e.type === "strengthCast"));
});

test("castSpell: Earthquake damages every foe AND the caster when unwarded", () => {
  // The foe's wp is set low enough that the quake kills it outright, so the
  // trailing afterPlayerAction() sees an empty encounter and returns before
  // drawing any further foeTurn rolls (matching killFoe's own event chain).
  // type "Humans" so killFoe skips the optional cooking-check roll.
  const foe = fixedFoe({ wp: 30, maxWP: 30, type: "Humans" });
  const state = fixedState({
    c: { sub: "Wizard", grimoire: ["Earthquake"], level: 4, wp: 50, maxWP: 50, ward: null },
    combat: fixedCombat([foe]),
  });
  // dmg 3d10+8: d10,d10,d10 = 10,10,10 -> 30+8=38; killFoe: sp d6=1, coin
  // d10=1, treasure-check d20=20 (skip, >2+lvl)
  const events = castSpell(state, SPELL_IDX.Earthquake, fakeRng([10, 10, 10, 1, 1, 20]), []);
  assert.equal(foe.wp, 0, "the foe died to the full 38");
  assert.equal(foe.alive, false);
  assert.equal(state.c.wp, 31, "the caster took half (ceil(38/2)=19), with no ward up");
  assert.ok(events.some((e) => e.type === "earthquake" && e.amount === 38));
  assert.ok(events.some((e) => e.type === "earthquakeSelfDamage" && e.amount === 19));
  assert.ok(events.some((e) => e.type === "foeKilled"));
});

test("castSpell: Earthquake spares the caster behind a ward", () => {
  const state = fixedState({
    c: { sub: "Wizard", grimoire: ["Earthquake"], level: 4, wp: 50, maxWP: 50, ward: { pool: 10, rounds: 1, reflect: false, name: "Shield" } },
    combat: null,
  });
  castSpell(state, SPELL_IDX.Earthquake, fakeRng([1, 1, 1]), []);
  assert.equal(state.c.wp, 50, "warded, so no self-damage");
});

// --- drinkPotion ------------------------------------------------------

test("drinkPotion: heals and decrements the potion count; a no-op with none left", () => {
  const state = fixedState({ c: { potions: 2, wp: 10, maxWP: 40 } });
  const events = drinkPotion(state, fakeRng([10]), []); // 2*10+5 = 25
  assert.equal(state.c.potions, 1);
  assert.equal(state.c.wp, 35);
  assert.ok(events.some((e) => e.type === "potionDrunk" && e.amount === 25));

  const dry = fixedState({ c: { potions: 0 } });
  const noEvents = drinkPotion(dry, fakeRng([]), []);
  assert.equal(noEvents.length, 0);
});

test("drinkPotion: caps at maxWP", () => {
  const state = fixedState({ c: { potions: 1, wp: 38, maxWP: 40 } });
  drinkPotion(state, fakeRng([10]), []); // amount 25, would overflow to 63
  assert.equal(state.c.wp, 40);
});

// --- canRead / readScroll -----------------------------------------------

test("canRead: a Pilfer can never read a scroll; a Magic User always can", () => {
  assert.equal(canRead(fixedState({ c: { sub: "Pilfer", cls: "Thief" } })), false);
  assert.equal(canRead(fixedState({ c: { cls: "Magic User", sub: "Wizard" } })), true);
  assert.equal(canRead(fixedState({ c: { cls: "Fighter", sub: "Knight", skills: {} } })), false);
  assert.equal(canRead(fixedState({ c: { cls: "Fighter", sub: "Knight", skills: { "Runes/Signs": 1 } } })), true);
});

test("readScroll: a learnable, unknown spell is copied into the grimoire instead of cast", () => {
  const state = fixedState({ c: { scrolls: 1, cls: "Magic User", sub: "Wizard", level: 5, grimoire: [] } });
  // pick() defaults to options[0]; Heal (lvl1, healing) is learnable by a Wizard.
  const events = readScroll(state, fakeRng([], { pick: (arr) => arr.find((sp) => sp.n === "Heal") }), []);
  assert.equal(state.c.scrolls, 0);
  assert.ok(state.c.grimoire.includes("Heal"));
  assert.ok(events.some((e) => e.type === "scrollCopiedToGrimoire"));
});

test("readScroll: an already-known spell is cast for free, ignoring the charge economy", () => {
  const state = fixedState({
    c: { scrolls: 1, cls: "Magic User", sub: "Wizard", level: 1, grimoire: ["Heal"], spellsUsed: 4, wp: 10, maxWP: 31 },
  });
  const events = readScroll(state, fakeRng([10], { pick: (arr) => arr.find((sp) => sp.n === "Heal") }), []);
  assert.equal(state.c.scrolls, 0);
  assert.equal(state.c.spellsUsed, 4, "the caster's own charge count is restored, untouched");
  assert.equal(state.c.wp, 20, "the heal still applied");
  assert.ok(events.some((e) => e.type === "scrollCast"));
  assert.ok(events.some((e) => e.type === "healed"));
});

test("readScroll: no scrolls or cannot read is a no-op", () => {
  const noScrolls = fixedState({ c: { scrolls: 0, cls: "Magic User" } });
  assert.deepStrictEqual(readScroll(noScrolls, fakeRng([]), []), []);

  const cannotRead = fixedState({ c: { scrolls: 1, cls: "Thief", sub: "Pilfer" } });
  assert.deepStrictEqual(readScroll(cannotRead, fakeRng([]), []), []);
});

// --- purity ---------------------------------------------------------------

/** Strip block + line comments before scanning source for forbidden refs. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

test("magic.js references no Math.random/document/localStorage", () => {
  const src = stripComments(fs.readFileSync(path.join(REPO_ROOT, "engine", "magic.js"), "utf8"));
  assert.ok(!/Math\.random/.test(src));
  assert.ok(!/\bdocument\b/.test(src));
  assert.ok(!/\blocalStorage\b/.test(src));
});
