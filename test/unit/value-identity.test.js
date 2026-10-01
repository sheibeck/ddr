// test/unit/value-identity.test.js
//
// Phase 91.1 plan 03 (part A: races and the Magic User chart, VALUE-01 / VALUE-02 / VALUE-04). One pin per
// built ledger row, each titled with its question id (docs/VALUE-LEDGER.md cites these titles). The user's
// rulings, 2026-10-01:
//   V15 B: the Elf's smaller strike die applies on top of the Illusionist's d20 for an Elf Illusionist
//          (a d12 at level 1, a d10 at level 2).
//   V16 B: Dwarven +3 damage (was +2).
//   V17 B: the Fridgian's thick hide soaks 3 (was 2), hero and Joiner alike.
//   V18 B: a healing bonus adds to every heal the caster casts (Cleric +4 replacing its separate +3,
//          Court Mage +1); a protection bonus adds 5 HP per point to Shield's soak and Bubble's film
//          (Cleric +15, Summoner and Court Mage +10, Sorcerer +5); the divination numbers are 0.
//   V19 B: the Illusionist's Illusion bonus is 1 (Senseless d4+1, Duplicate Foe d4+2); the Apprentice stays 0.
//   V20 B: a Cleric may learn Strength (one named exception in the gate data); every other offense spell
//          stays closed to it.
//
// Part B of plan 91.1-03 (V7, V25, V27) is a separate execution; nothing here pins it.
//
// Local fixtures follow summoner-heal.test.js and control-slate-spells.test.js (the repo's per-file fixture
// convention, never imported cross-file).

import test from "node:test";
import assert from "node:assert/strict";

import { castSpell, readScroll } from "../../engine/magic.js";
import { applyFoeDamageToPlayer, applyFoeDamageToMember, alliesTurn, misdirectFoe } from "../../engine/combat.js";
import { rollGrimoire, grantableAt } from "../../engine/character.js";
import { makeRng, derivedRng } from "../../engine/rng.js";
import { rollDice } from "../../engine/dice.js";
import {
  strikeDie, weaponDamageTerms, weaponDamage, canLearn, canCast, schoolBonus, schoolAllowed, schoolClosed, spellClosed,
  spellException, healBonusFor, wardBonusFor, SCHOOL_WARD_HP, spellEffectRounds,
} from "../../engine/derived.js";
import { GW, GH } from "../../engine/maze.js";
import { SPELLS, RACES, MU_CHART, MU_SPELL_EXCEPTIONS, STRIKE_DICE } from "../../content/index.js";
import { identityFooter } from "../../src/browser/identityFooter.js";
import { setIdentityDials } from "./harness/identityDials.js";
import { heroState, foeFrom } from "./harness/rollOdds.js";

setIdentityDials();

const IDX = Object.fromEntries(SPELLS.map((sp, i) => [sp.n, i]));
const SP = Object.fromEntries(SPELLS.map((sp) => [sp.n, sp]));
const ONES = (n) => new Array(n).fill(1);

/** fakeRng(seq) — `.d()` pops the next raw value, throws on underflow; the cursor is what derived streams read. */
function fakeRng(seq = [], cursor = 4242) {
  let i = 0;
  return {
    d() {
      if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick: (a) => a[0],
    shuffle: (a) => a,
    getState: () => cursor,
    count: () => i,
  };
}

function caster(overrides = {}) {
  return {
    cls: "Magic User", sub: "Wizard", race: "Human", level: 5, sp: 0,
    maxWP: 100, wp: 50, skills: {}, vp: 0,
    weapon: "Dagger", prof: 0, magicWpn: 0,
    armor: "Cloth", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 4, rations: 4, gold: 50, scrolls: 1,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Caster", timers: [],
    ...overrides,
  };
}

function fixedFloor(depth = 1) {
  const g = [];
  for (let y = 0; y < GH; y++) {
    g.push([]);
    for (let x = 0; x < GW; x++) g[y].push({ wall: false, dark: false, seen: false, feat: null });
  }
  return { g, px: 1, py: 1, depth };
}

function stateWith(c, extra = {}) {
  return {
    version: 1, seed: 1, rngState: 1, acts: 0,
    c: caster(c), floor: fixedFloor(), day: 1, steps: 0, combat: null, store: null, beats: null,
    dead: false, deathNote: "", epitaph: "", ...extra,
  };
}

const foeRow = (name, over = {}) => ({ name, type: "Humans", lvl: 1, size: "S", intel: 10, wp: 30, maxWP: 30, alive: true, asleep: 0, sp: {}, lives: 1, ...over });

const dieSides = (race, sub, level) => strikeDie({ race, sub, level, timers: [], items: [] });

// ─── V15 Elf Illusionist ───────────────────────────────────────────────────

test("V15 Elven race-strike-step: an Elf Illusionist strikes a d12 at level 1 and a d10 at level 2, the Elf's own die (the boundary is level 3)", () => {
  assert.deepEqual([1, 2, 3, 4, 5].map((l) => dieSides("Elven", "Illusionist", l)), [12, 10, 8, 6, 6]);
  assert.deepEqual(
    [1, 2, 3, 4, 5].map((l) => dieSides("Elven", "Illusionist", l)),
    [1, 2, 3, 4, 5].map((l) => dieSides("Elven", "Wizard", l)),
    "an Elf Illusionist strikes like any Elf at every level",
  );
});

test("V15 Illusionist illusionist-d20: every other Illusionist still strikes a d20 at levels 1 and 2 and its own die from level 3 (the Human is untouched)", () => {
  assert.deepEqual([1, 2, 3, 4, 5].map((l) => dieSides("Human", "Illusionist", l)), [20, 20, 10, 8, 6]);
  for (const race of ["Dwarven", "Wilmsry", "Fridgian", "Troll"]) {
    assert.equal(dieSides(race, "Illusionist", 1), 20, `${race} Illusionist level 1`);
    assert.equal(dieSides(race, "Illusionist", 2), 20, `${race} Illusionist level 2`);
  }
  // the Elf's die for a sub-class other than the Illusionist is unchanged: a d12, then a d10
  assert.deepEqual([1, 2].map((l) => dieSides("Elven", "Soldier", l)), [12, 10]);
  assert.deepEqual(STRIKE_DICE.slice(0, 5), [20, 12, 10, 8, 6]);
});

test("V15 Elven race-strike-step: an exact-key near-miss ('illusionist', ' Illusionist') is no Illusionist at all, so the plain Elf die and the plain Human die stand", () => {
  assert.equal(dieSides("Human", "illusionist", 1), 20);
  assert.equal(dieSides("Human", " Illusionist", 1), 20);
  assert.equal(dieSides("Human", "Illusionist", 1), 20);
  assert.equal(dieSides("Human", "Wizard", 1), 20, "a level 1 Human strikes a d20 whatever the sub-class");
});

// ─── V16 Dwarven ───────────────────────────────────────────────────────────

const soldier = (race) => caster({ cls: "Fighter", sub: "Soldier", race, weapon: "Club", level: 1 });

test("V16 Dwarven race-dmg: a Dwarf deals +3 damage with every weapon (a Human's blow plus 3, the Small damage axis masked)", () => {
  assert.equal(RACES.Dwarven.dmg, 3);
  const human = weaponDamage(soldier("Human"), fakeRng([3]));
  assert.equal(weaponDamage(soldier("Dwarven"), fakeRng([3])), human + 3);
  assert.equal(weaponDamageTerms(soldier("Dwarven")).bonus - weaponDamageTerms(soldier("Human")).bonus, 3);
});

test("V16 Dwarven race-dmg: the footer states +3, and the Troll's +11, the Elf's −2 and the Human's nothing are untouched", () => {
  assert.ok(identityFooter("race", "Dwarven").good.includes("+3 damage with every weapon"), JSON.stringify(identityFooter("race", "Dwarven")));
  const human = weaponDamage(soldier("Human"), fakeRng([3]));
  assert.equal(weaponDamage(soldier("Troll"), fakeRng([3])), human + 11);
  assert.equal(weaponDamage(soldier("Elven"), fakeRng([3])), human - 2);
  assert.equal(weaponDamageTerms(soldier("Wilmsry")).bonus, weaponDamageTerms(soldier("Human")).bonus);
});

test("V16 Dwarven race-dmg: a Joiner Dwarf's blow reads its own body, +3 too", () => {
  const human = weaponDamage(soldier("Human"), fakeRng([3]));
  const joiner = soldier("Dwarven");
  assert.equal(weaponDamage(joiner, fakeRng([3])), human + 3);
});

// ─── V17 Fridgian ──────────────────────────────────────────────────────────

const blow = (dmg) => ({ dmg, roll: 20, atLeast: 12, dieN: 20, mods: [] });

test("V17 Fridgian race-hide: the hero's thick hide soaks 3 from a landed blow (7 takes 4), and a blow of 3 still costs 1", () => {
  assert.equal(RACES.Fridgian.hide, 3);
  const state = heroState({ cls: "Fighter", sub: "Soldier", race: "Fridgian" });
  state.c.skills = {};
  const rng = { d: () => 1, pick: (a) => a[0], shuffle: (a) => a, getState: () => 1 };
  const before = state.c.wp;
  applyFoeDamageToPlayer(state, foeFrom("Humans", 1, "Ned"), rng, [], blow(7));
  assert.equal(before - state.c.wp, 4, "max(1, 7 - 3) = 4");
  const b2 = state.c.wp;
  applyFoeDamageToPlayer(state, foeFrom("Humans", 1, "Ned"), rng, [], blow(3));
  assert.equal(b2 - state.c.wp, 1, "the floor of 1");
});

test("V17 Fridgian race-hide: a Joiner Fridgian's hide soaks 3 as well (a Human Joiner takes the whole 7; the other races carry no hide)", () => {
  const rows = [];
  for (const race of ["Fridgian", "Human", "Dwarven", "Elven", "Troll", "Wilmsry"]) {
    const sheet = { name: "Brom", cls: "Fighter", sub: "Soldier", race, level: 1, wp: 30, maxWP: 30, status: "ok", timers: [], armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0 };
    const member = { partyIdx: 0, name: "Brom", lvl: 1, sub: "Soldier", wp: 30, maxWP: 30 };
    const hero = { name: "Hero", cls: "Fighter", sub: "Soldier", race: "Human", wp: 40, maxWP: 40, ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, timers: [] };
    const foe = { name: "Ned", type: "Humans", lvl: 1, wp: 10, maxWP: 10, alive: true, asleep: 0, sp: {} };
    const state = { c: hero, party: [sheet], combat: { foes: [foe], round: 2, allies: [member] } };
    const res = applyFoeDamageToMember(state, foe, member, { d() { throw new Error("main stream"); }, pick() { throw new Error("main stream"); }, getState: () => 1 }, [], { dmg: 7, roll: 20, atLeast: 12, dieN: 20 });
    rows.push([race, res.applied]);
  }
  assert.deepEqual(rows, [["Fridgian", 4], ["Human", 7], ["Dwarven", 7], ["Elven", 7], ["Troll", 7], ["Wilmsry", 7]]);
});

// ─── V18 chart bonuses ─────────────────────────────────────────────────────

const healCast = (sub, roll, c = {}) => {
  const state = stateWith({ sub, grimoire: ["Heal"], wp: 10, maxWP: 100, level: 5, ...c });
  const events = castSpell(state, IDX.Heal, fakeRng([roll]), []);
  return { state, events, healed: events.find((e) => e.type === "healed") };
};

test("V18 Cleric chart-bonus-healing: every heal a Cleric casts adds 4 (the chart's healing bonus, replacing the separate +3)", () => {
  assert.equal(MU_CHART.Cleric.healing, 4);
  assert.equal(healBonusFor("Cleric"), 4);
  const { state, healed } = healCast("Cleric", 8);
  assert.equal(state.c.wp, 22, "10 + 8 + 4");
  assert.deepEqual(healed, { type: "healed", amount: 12, spell: "Heal", gained: 12 });
});

test("V18 Cleric chart-bonus-healing: Major Heal adds the same 4 once (a bonus per heal, never per die)", () => {
  const state = stateWith({ sub: "Cleric", grimoire: ["Major Heal"], wp: 10, maxWP: 200, level: 5 });
  const events = castSpell(state, IDX["Major Heal"], fakeRng([5, 5, 5]), []);
  assert.equal(events.find((e) => e.type === "healed").amount, 15 + 4);
});

test("V18 Court Mage chart-bonus-healing: every heal a Court Mage casts adds 1; a Wizard, Warlock and Apprentice add nothing", () => {
  assert.equal(healCast("Court Mage", 8, { level: 5 }).healed.amount, 9);
  for (const sub of ["Wizard", "Warlock", "Sorcerer", "Soldier", undefined]) {
    assert.equal(healBonusFor(sub), 0, `${sub}`);
    if (sub && MU_CHART[sub] && MU_CHART[sub].healing !== null) assert.equal(healCast(sub, 8, { level: 5 }).healed.amount, 8, `${sub}`);
  }
});

test("V18 Cleric chart-bonus-healing: the bonus comes before a Wilmsry's doubling and a Summoner's halving, and a Cleric's scroll-read heal is a cast too", () => {
  assert.equal(healCast("Cleric", 8, { race: "Wilmsry" }).healed.amount, (8 + 4) * 2);
  // a Summoner's healing bonus is 0, so the halving reads the bare roll (Q: unchanged)
  assert.equal(healCast("Summoner", 8, { level: 5 }).healed.amount, 4);
  const state = stateWith({ sub: "Cleric", grimoire: ["Heal"], wp: 10, maxWP: 100, scrolls: 1 });
  const events = readScroll(state, { ...fakeRng([8]), pick: (arr) => arr.find((sp) => sp.n === "Heal") }, []);
  assert.equal(events.find((e) => e.type === "healed").amount, 12);
});

test("V18 Cleric chart-bonus-healing: a Joiner Cleric adds the same 4 through its own derived stream, no main draw", () => {
  const sheet = {
    name: "Ada", level: 3, sub: "Cleric", cls: "Magic User", race: "Human", wp: 4, maxWP: 40, status: "ok",
    weapon: "Quarter Staff", prof: 0, magicWpn: 0, might: 0, items: [], skills: {}, armor: "Nothing", grimoire: ["Heal"], spellsUsed: 0, potions: 0, worn: {},
  };
  const state = stateWith({ cls: "Fighter", sub: "Soldier", level: 1 }, {
    party: [sheet],
    combat: { foes: [foeRow("A")], type: "Humans", round: 1, target: 0, pending: false, opened: false, opened2: false, spellOpen: false, tracked: false, allies: [{ partyIdx: 0, name: "Ada", lvl: 3, sub: "Cleric", wp: 4, maxWP: 40 }] },
  });
  const roll = rollDice(derivedRng(4242, "memberHeal", 1, 0, 1), SP.Heal.dmg);
  const events = alliesTurn(state, fakeRng([]), []);
  assert.equal(events.find((e) => e.type === "memberHealed").amount, roll + 4);
});

const shieldCast = (sub) => {
  const state = stateWith({ sub, grimoire: ["Shield", "Bubble"], level: 5 });
  castSpell(state, IDX.Shield, fakeRng([]), []);
  return state.c.ward;
};
const bubbleCast = (sub) => {
  const state = stateWith({ sub, grimoire: ["Shield", "Bubble"], level: 5 });
  castSpell(state, IDX.Bubble, fakeRng([]), []);
  return state.c.ward;
};

test("V18 chart-bonus-protection: Shield soaks 50 plus 5 HP a point of protection bonus (Cleric 65, Summoner 60, Court Mage 60, Sorcerer 55, Wizard 50)", () => {
  assert.equal(SCHOOL_WARD_HP, 5);
  const want = { Cleric: 65, Summoner: 60, "Court Mage": 60, Sorcerer: 55, Wizard: 50, Warlock: 50 };
  for (const [sub, pool] of Object.entries(want)) {
    if (!schoolAllowed(sub, "protection")) continue;
    assert.equal(shieldCast(sub).pool, pool, sub);
    assert.equal(shieldCast(sub).rounds, 5, `${sub}: the five rounds are unchanged`);
  }
  assert.equal(wardBonusFor("Cleric"), 15);
  assert.equal(wardBonusFor("Summoner"), 10);
  assert.equal(wardBonusFor("Court Mage"), 10);
  assert.equal(wardBonusFor("Sorcerer"), 5);
  assert.equal(wardBonusFor("Wizard"), 0);
  assert.equal(wardBonusFor("Bard"), 0, "a sub-class with no chart row reads 0, never NaN");
});

test("V18 chart-bonus-protection: Bubble's film is 25 plus 5 HP a point (Cleric 40, Summoner 35, Court Mage 35, Sorcerer 30, Wizard 25), and the Oracle event carries it", () => {
  const want = { Cleric: 40, Summoner: 35, "Court Mage": 35, Sorcerer: 30, Wizard: 25 };
  for (const [sub, film] of Object.entries(want)) {
    const w = bubbleCast(sub);
    assert.equal(w.mirror, true, sub);
    assert.equal(w.pool, 0, `${sub}: an armed mirror has no soak yet`);
    assert.equal(w.popPool, film, sub);
  }
  const state = stateWith({ sub: "Cleric", grimoire: ["Bubble"], level: 5 });
  const events = castSpell(state, IDX.Bubble, fakeRng([]), []);
  assert.equal(events.find((e) => e.type === "wardRaised").popPool, 40);
});

test("V18 chart-bonus-protection: the enlarged Shield really soaks 65 for a Cleric and the film really holds 40 after the bounce", () => {
  const rng = { d: () => 1, pick: (a) => a[0], shuffle: (a) => a, getState: () => 1 };
  const state = stateWith({ sub: "Cleric", grimoire: ["Shield"], level: 5, wp: 100, maxWP: 100, race: "Human" });
  castSpell(state, IDX.Shield, fakeRng([]), []);
  const foe = foeFrom("Humans", 1, "Ned");
  state.combat = { foes: [foe], type: "Humans", round: 1, target: 0, spellOpen: false, tracked: false, pending: false };
  applyFoeDamageToPlayer(state, foe, rng, [], blow(60));
  assert.equal(state.c.wp, 100, "60 of the 65 is soaked, the hero takes nothing");
  assert.equal(state.c.ward.pool, 5);
  // Bubble: the next blow bounces whole, then the 40 HP film soaks the rest of the round
  const bub = stateWith({ sub: "Cleric", grimoire: ["Bubble"], level: 5, wp: 100, maxWP: 100 });
  castSpell(bub, IDX.Bubble, fakeRng([]), []);
  bub.combat = { foes: [foe], type: "Humans", round: 1, target: 0, spellOpen: false, tracked: false, pending: false };
  applyFoeDamageToPlayer(bub, { ...foe, wp: 999, maxWP: 999 }, rng, [], blow(10));
  assert.equal(bub.c.ward.pool, 40, "after the bounce the film is the Cleric's 40, not 25");
});

test("V18 chart-bonus-protection: a Bard's sung Shield and a non-caster's scroll cast stay at the base 50 and 25 (no chart row, no bonus)", () => {
  assert.equal(MU_CHART.Bard, undefined, "the Bard gets no MU_CHART row");
  assert.equal(shieldCast("Bard").pool, 50);
  assert.equal(bubbleCast("Bard").popPool, 25);
  assert.equal(shieldCast("Soldier").pool, 50);
});

test("V18 divination: every divination bonus in the chart is 0 (no divination spell has a number to stretch), and no other school's number moved", () => {
  for (const [sub, row] of Object.entries(MU_CHART)) assert.ok(row.divination === 0, `${sub} divination ${row.divination}`);
  const after = {
    Wizard: [3, 0, 0, 0], Warlock: [4, 0, 0, null], Sorcerer: [4, 1, 0, 1], "Court Mage": [2, 2, 1, null],
    Illusionist: [0, 0, null, 4], Cleric: [null, 3, 4, null], Summoner: [0, 2, 0, 1], Apprentice: [0, 0, 0, 0],
  };
  for (const [sub, [offense, protection, healing, special]] of Object.entries(after)) {
    const r = MU_CHART[sub];
    assert.deepEqual([r.offense, r.protection, r.healing, r.special], [offense, protection, healing, special], sub);
  }
});

test("V18 edge (empty): a zero or never-learned bonus reads 0 everywhere the new rules look (no NaN): an Illusionist's healing is null, a Wizard's protection is 0", () => {
  for (const sub of Object.keys(MU_CHART)) {
    for (const fn of [healBonusFor, wardBonusFor]) {
      const v = fn(sub);
      assert.ok(Number.isFinite(v) && v >= 0, `${fn.name}(${sub}) = ${v}`);
    }
  }
  assert.equal(healBonusFor("Illusionist"), 0);
  assert.equal(wardBonusFor("Wizard"), 0);
  assert.equal(healBonusFor(undefined), 0);
});

test("V18 text: the footers state the real healing and protection bonuses from the engine, and no divination bonus (edge: ordering, authored then generated)", () => {
  const f = (sub) => identityFooter("sub", sub);
  assert.ok(f("Cleric").good.includes(`every healing spell you cast heals ${healBonusFor("Cleric")} more`), JSON.stringify(f("Cleric")));
  assert.ok(f("Cleric").good.includes(`your Shield soaks ${wardBonusFor("Cleric")} more HP and your Bubble's film holds ${wardBonusFor("Cleric")} more`), JSON.stringify(f("Cleric")));
  assert.ok(f("Court Mage").good.includes("every healing spell you cast heals 1 more"));
  assert.ok(f("Court Mage").good.includes("your Shield soaks 10 more HP and your Bubble's film holds 10 more"));
  assert.ok(f("Summoner").good.includes("your Shield soaks 10 more HP and your Bubble's film holds 10 more"));
  assert.ok(f("Sorcerer").good.includes("your Shield soaks 5 more HP and your Bubble's film holds 5 more"));
  const all = ["Warlock", "Sorcerer", "Summoner", "Illusionist", "Cleric", "Court Mage", "Wizard", "Apprentice"].map((s) => JSON.stringify(f(s))).join(" ");
  assert.doesNotMatch(all, /divination bonus|divination spells you/i);
  assert.ok(!identityFooter("sub", "Cleric").good.includes("every healing spell heals 3 more"), "the separate +3 line is gone");
});

// ─── V19 the Illusion bonus ────────────────────────────────────────────────

const rollsFor = (sub, spell, d) => {
  const s = stateWith({ sub, level: 5 }, { combat: { foes: [foeRow("F1"), foeRow("F2")], type: "Humans", round: 1, target: 0, spellOpen: false, tracked: false } });
  const ev = [];
  const rounds = misdirectFoe(s, s.combat.foes[0], SP[spell], fakeRng([d]), ev, { sub });
  return { rounds, ev, foe: s.combat.foes[0] };
};

test("V19 Illusionist chart-stretch-illusion: Senseless lasts d4 plus 1 rounds (a 3 lasts 4) and Duplicate Foe d4 plus 2 (a 3 lasts 5)", () => {
  assert.equal(MU_CHART.Illusionist.illusion, 1);
  assert.equal(schoolBonus("Illusionist", "illusion"), 1);
  assert.equal(rollsFor("Illusionist", "Senseless", 3).rounds, 4);
  assert.deepEqual(rollsFor("Illusionist", "Senseless", 3).foe.misdirect, { at: "friends", left: 4 });
  assert.equal(rollsFor("Illusionist", "Duplicate Foe", 3).rounds, 5);
  assert.deepEqual(rollsFor("Illusionist", "Duplicate Foe", 3).foe.misdirect, { at: "self", left: 5 });
  assert.equal(spellEffectRounds("Illusionist", SP.Senseless, 4), 5);
});

test("V19 Apprentice chart-stretch-illusion: the Apprentice stays at 0 (Senseless d4, Duplicate Foe d4+1), the Illusionist's Stop Time stays 6 rounds, and the footer says one round longer", () => {
  assert.equal(MU_CHART.Apprentice.illusion, 0);
  assert.equal(rollsFor("Apprentice", "Senseless", 3).rounds, 3);
  assert.equal(rollsFor("Apprentice", "Duplicate Foe", 3).rounds, 4);
  assert.equal(spellEffectRounds("Illusionist", SP["Stop Time"], SP["Stop Time"].holdRounds), 6);
  const good = identityFooter("sub", "Illusionist").good;
  assert.ok(good.includes("your Senseless and Duplicate Foe last 1 round longer"), JSON.stringify(good));
  assert.ok(!identityFooter("sub", "Apprentice").good.some((t) => /Senseless/.test(t)), "an Apprentice's footer states no Illusion stretch");
});

// ─── V20 the Cleric's Strength ─────────────────────────────────────────────

test("V20 Cleric chart-never: a Cleric may learn Strength, and only Strength, of the offense school (a single named exception in the gate data)", () => {
  assert.deepEqual(MU_SPELL_EXCEPTIONS, { Cleric: ["Strength"] });
  assert.equal(MU_CHART.Cleric.offense, null, "the school gate is unchanged");
  assert.equal(schoolAllowed("Cleric", "offense"), false);
  assert.equal(schoolClosed("Cleric", "offense"), true);
  for (const sp of SPELLS.filter((s) => s.s === "offense")) {
    assert.equal(canLearn("Cleric", sp), sp.n === "Strength", sp.n);
    assert.equal(spellClosed("Cleric", sp), sp.n !== "Strength", sp.n);
  }
  assert.equal(spellException("Cleric", SP.Strength), true);
  assert.equal(spellException("Wizard", SP.Strength), false);
  // the special and illusion schools stay closed with no exception
  for (const sp of SPELLS.filter((s) => s.s === "special" || s.s === "illusion")) assert.equal(canLearn("Cleric", sp), false, sp.n);
});

test("V20 Cleric chart-never: a Cleric's own Strength casts (a book that holds it is castable), a Cleric's Freeze never does, and a Wizard's Strength is unchanged", () => {
  const c = stateWith({ sub: "Cleric", level: 5, grimoire: ["Strength", "Freeze"] });
  assert.equal(canCast(c, SP.Strength), true);
  assert.equal(canCast(c, SP.Freeze), false);
  const events = castSpell(c, IDX.Strength, fakeRng([]), []);
  assert.ok(events.some((e) => e.type === "strengthCast"), JSON.stringify(events));
  assert.ok(c.c.timers && c.c.timers["spell:Strength"], "Strength's timed effect started");
  const frozen = castSpell(stateWith({ sub: "Cleric", level: 5, grimoire: ["Freeze"], combat: { foes: [foeRow("A")], type: "Humans", round: 1, target: 0, spellOpen: false, tracked: false } }), IDX.Freeze, fakeRng([]), []);
  assert.ok(frozen.some((e) => e.type === "spellSchoolLocked" && e.forbidden), JSON.stringify(frozen));
  assert.equal(canCast(stateWith({ sub: "Wizard", level: 5, grimoire: ["Strength"] }), SP.Strength), true);
});

test("V20 Cleric chart-never: Strength reaches a Cleric's book (some seed deals it), no other offense spell ever does, seeds 1 to 1000", () => {
  let dealt = 0;
  for (let seed = 1; seed <= 1000; seed++) {
    const book = rollGrimoire(makeRng(seed), "Cleric", 5);
    for (const n of book) {
      const sp = SP[n];
      if (sp.s === "offense") {
        assert.equal(n, "Strength", `seed ${seed}: ${n}`);
        dealt++;
      }
    }
    assert.ok(book.includes("Heal"), `seed ${seed}: the Cleric always holds Heal`);
  }
  assert.ok(dealt > 20, `Strength dealt ${dealt} times in 1000 seeds`);
  assert.equal(grantableAt("Cleric", SP.Strength, 1), true);
  assert.equal(grantableAt("Cleric", SP.Freeze, 5), false);
});

test("V20 Cleric chart-never: a Magic User that still learns offense is untouched (the Wizard's, Warlock's and Sorcerer's offense spells all learnable), and a scroll's free Freeze for a Cleric still casts", () => {
  for (const sub of ["Wizard", "Warlock", "Sorcerer", "Court Mage", "Summoner", "Apprentice", "Illusionist"]) {
    for (const sp of SPELLS.filter((s) => s.s === "offense")) assert.equal(canLearn(sub, sp), true, `${sub} ${sp.n}`);
  }
  assert.equal(schoolBonus("Cleric", "offense"), 0);
});

test("V20 text: the Cleric's footer names the exception ('never learns offense (except Strength), special or illusion spells')", () => {
  const bad = identityFooter("sub", "Cleric").bad;
  assert.ok(bad.includes("never learns offense (except Strength), special or illusion spells"), JSON.stringify(bad));
  assert.ok(!identityFooter("sub", "Wizard").bad.some((t) => /Strength/.test(t)));
});

// ─── edges shared by the rows ──────────────────────────────────────────────

test("edge (adjacency, V16 V17): the Dwarf's +3 and the Fridgian's 3 never move each other or the Troll; one changed row never edits its neighbour", () => {
  assert.equal(RACES.Dwarven.hide, undefined);
  assert.equal(RACES.Fridgian.dmg, undefined);
  assert.equal(RACES.Troll.dmg + RACES.Troll.wpnBonus, 9);
});

test("edge (adjacency, V18 V19 V20): the three chart rows touch only their own cells (Illusionist healing stays never, Cleric offense stays never, Warlock gates unchanged)", () => {
  assert.equal(MU_CHART.Illusionist.healing, null);
  assert.deepEqual(MU_CHART.Warlock.gate, { protection: 4, healing: 3 });
  assert.deepEqual(MU_CHART.Cleric.gate, { divination: 3 });
  assert.equal(MU_CHART.Summoner.healMul, 0.5);
});
