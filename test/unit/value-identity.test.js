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
// Part B of plan 91.1-03 (appended below, one section per question):
//   V7 B:  the Bard may sing a second song 5 rounds after the first (hero and Joiner alike), never a third.
//   V25 B: Con Artist: a level 1 foe still leaves 2 times in 3, a level 2 foe leaves 1 time in 3.
//   V27 B: the Cloaker's free vanish also escapes a pursuing Spectre's parting blow.
//
// Local fixtures follow summoner-heal.test.js and control-slate-spells.test.js (the repo's per-file fixture
// convention, never imported cross-file).

import test from "node:test";
import assert from "node:assert/strict";

import { castSpell, readScroll } from "../../engine/magic.js";
import {
  applyFoeDamageToPlayer, applyFoeDamageToMember, alliesTurn, misdirectFoe,
  sing, songReady, songDue, SONG_GAP_ROUNDS, SONGS_PER_FIGHT, startCombat, endCombat, flee, CON_ARTIST_LEAVE_FACES, CON_ARTIST_LEAVE_MAX_LVL,
} from "../../engine/combat.js";
import { combatMenuViewModel, COMBAT_MENU_COPY } from "../../src/browser/combatMenu.js";
// Phase 94 (ASTATE-02): the Sing row reads the shared ability-state words.
import { ABILITY_STATE_COPY } from "../../src/browser/abilityStates.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { LINE_FOR } from "../../src/browser/narrationLines.js";
import { decideAction, makeBotContext } from "../../tools/lib/tuning-bot.mjs";
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
import { heroState, foeFrom, inCombat } from "./harness/rollOdds.js";

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

test("V17 Fridgian race-hide: a Joiner Fridgian's hide soaks 3 as well (a Human Joiner takes the whole 7, the other races carry no hide)", () => {
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

test("V18 Court Mage chart-bonus-healing: every heal a Court Mage casts adds 1, a Wizard, Warlock and Apprentice add nothing", () => {
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

// ═══ Part B (plan 91.1-03 part B): V7, V25, V27 ════════════════════════════

// ─── V7 Sing ───────────────────────────────────────────────────────────────

/** A level-3 Bard hero in a live fight against one huge sleeper (its turn draws nothing from the main rng). */
function bardHero(round = 1) {
  const state = heroState({ cls: "Fighter", sub: "Bard", race: "Human", level: 3 });
  state.c.wp = state.c.maxWP = 400;
  inCombat(state, [{ ...foeFrom("Humans", 1, "Ned", { wp: 5000 }), asleep: 99 }], { round });
  return state;
}

/** A rng that throws on any draw: proves a song and a refusal draw nothing from the main stream. */
const noDraws = () => fakeRng([], 4242);

const refusals = (events) => events.filter((e) => e.type === "actionRefused").map((e) => [e.reason, e.rounds]);
const songs = (events) => events.filter((e) => e.type === "sang");

test("V7 Sing sing-once: a Bard sings a second song 5 rounds after the first (round 1 to round 6), and never a third", () => {
  assert.equal(SONG_GAP_ROUNDS, 5);
  assert.equal(SONGS_PER_FIGHT, 2);
  const state = bardHero(1);
  assert.equal(songReady(state), true, "round 1: the first song");
  assert.equal(songs(sing(state, noDraws(), [])).length, 1);
  assert.equal(state.combat.sang, true);
  assert.equal(state.combat.sangAt, 1, "the round of the first song");

  // the boundary: rounds 2 to 5 are still resting, round 6 is the first round the second song is due
  for (const round of [2, 3, 4, 5]) {
    state.combat.round = round;
    assert.equal(songReady(state), false, `round ${round}: resting`);
  }
  state.combat.round = 6;
  assert.equal(songReady(state), true, "round 6: five rounds after the first");
  const second = sing(state, noDraws(), []);
  assert.equal(songs(second).length, 1, "the second song is sung");
  assert.equal(state.combat.sangAt, null, "the second song closes the fight's songs");

  // never a third, however long the fight runs
  for (const round of [7, 11, 12, 40, 400]) {
    state.combat.round = round;
    assert.equal(songReady(state), false, `round ${round}: no third song`);
    assert.deepEqual(refusals(sing(state, noDraws(), [])), [["sungThisFight", undefined]], `round ${round}`);
  }
});

test("V7 Sing sing-once: a song inside the 5 rounds is refused songResting with the rounds left, zero draws and nothing spent", () => {
  const state = bardHero(1);
  sing(state, noDraws(), []);
  state.combat.round = 2;
  assert.deepEqual(refusals(sing(state, noDraws(), [])), [["songResting", 4]], "sung in round 1, round 2: four rounds to go");
  state.combat.round = 5;
  assert.deepEqual(refusals(sing(state, noDraws(), [])), [["songResting", 1]]);
  assert.equal(state.combat.sangAt, 1, "a refusal changes nothing");
  state.combat.round = 6;
  assert.equal(songs(sing(state, noDraws(), [])).length, 1);
});

test("V7 Sing sing-once: songDue is the one test: no song yet is due, the first song's round plus 5 opens the second, and null or a bare flag closes it", () => {
  assert.equal(songDue(undefined, undefined, 1), true);
  assert.equal(songDue(true, 3, 7), false);
  assert.equal(songDue(true, 3, 8), true);
  assert.equal(songDue(true, 3, 9), true);
  assert.equal(songDue(true, null, 99), false, "after the second song");
  assert.equal(songDue(true, undefined, 99), false, "a bare flag (an older save, a fixture) never reopens");
});

test("V7 Sing sing-once: the second song's pick comes from the derived stream and the main rng draws nothing for either song (a throwing rng survives both)", () => {
  const state = bardHero(1);
  const rng = noDraws();
  sing(state, rng, []);
  state.combat.round = 6;
  state.acts = 7;
  const events = sing(state, rng, []);
  assert.equal(rng.count(), 0, "no main-rng draw for either song");
  const stream = derivedRng(4242, "song", 7);
  const pool = SPELLS.filter((sp) => ["offense", "protection"].includes(sp.s) && sp.lvl <= 3);
  assert.equal(songs(events)[0].spell, pool[stream.d(pool.length) - 1].n, "the pick reproduces from derivedRng(cursor, \"song\", acts)");
});

test("V7 Sing sing-once: only the exact Bard sings; a Soldier, a near-miss 'bard' and a Bard in a pending fight are refused as before", () => {
  const soldierHero = heroState({ cls: "Fighter", sub: "Soldier", race: "Human", level: 3 });
  inCombat(soldierHero, [{ ...foeFrom("Humans", 1, "Ned", { wp: 5000 }), asleep: 99 }], { round: 9 });
  assert.deepEqual(refusals(sing(soldierHero, noDraws(), [])), [["wrongClass", undefined]]);
  assert.equal(songReady(soldierHero), false);
  const near = bardHero(9);
  near.c.sub = "bard";
  assert.equal(songReady(near), false);
  assert.deepEqual(refusals(sing(near, noDraws(), [])), [["wrongClass", undefined]]);
  const pending = bardHero(9);
  pending.combat.pending = true;
  assert.equal(songReady(pending), false);
});

test("V7 Sing sing-once: the combat menu row counts the rounds then reads READY, SPENT THIS FIGHT after the second song, and the next fight starts with no song sung", () => {
  const state = bardHero(1);
  sing(state, noDraws(), []);
  const resting = combatMenuViewModel(state).submenus.abilities.rows[0];
  // Phase 94 (ASTATE-02): the Sing row's words are the shared ability-state words (READY IN N / READY / SPENT THIS FIGHT).
  assert.equal(resting.cost, ABILITY_STATE_COPY.recharging.replace("{n}", String(state.combat.sangAt + SONG_GAP_ROUNDS - state.combat.round)));
  assert.equal(resting.enabled, false);
  state.combat.round = 6;
  const due = combatMenuViewModel(state);
  assert.equal(due.submenus.abilities.rows[0].cost, ABILITY_STATE_COPY.ready);
  assert.equal(due.submenus.abilities.rows[0].enabled, true);
  assert.equal(due.actions[1].sub, "SING · READY");
  sing(state, noDraws(), []);
  const done = combatMenuViewModel(state).submenus.abilities.rows[0];
  assert.equal(done.cost, ABILITY_STATE_COPY.spent, "after the second song: SPENT THIS FIGHT");
  assert.equal(done.enabled, false);
  endCombat(state, []);
  inCombat(state, [{ ...foeFrom("Humans", 1, "Ned", { wp: 5000 }), asleep: 99 }]);
  assert.equal(state.combat.sang, undefined);
  assert.equal(state.combat.sangAt, undefined);
  assert.equal(songReady(state), true);
});

/** The Joiner fixture (joiner-bard-song.test.js keeps its own copy of the same shapes). */
function joinerFight(round) {
  const sheet = { name: "Lyra", level: 3, sub: "Bard", cls: "Fighter", race: "Human", wp: 400, maxWP: 400, status: "ok", weapon: "Club", prof: 0, magicWpn: 0, might: 0, items: [], skills: {}, armor: "Nothing", grimoire: [], spellsUsed: 0, potions: 0, worn: {} };
  const state = heroState({ cls: "Fighter", sub: "Soldier", race: "Human", level: 3 });
  state.party = [sheet];
  inCombat(state, [{ ...foeFrom("Humans", 1, "Ned", { wp: 5000 }), asleep: 99 }], {
    round, allies: [{ partyIdx: 0, name: sheet.name, lvl: sheet.level, sub: sheet.sub, wp: sheet.wp, maxWP: sheet.maxWP }],
  });
  return state;
}

test("V7 Sing sing-once: a Joiner Bard sings its second song on its own first turn from round 6 (5 rounds after its first), and never a third", () => {
  const state = joinerFight(1);
  const rng = makeRng(7);
  const sung = (round) => { state.combat.round = round; state.acts += 1; const ev = []; alliesTurn(state, rng, ev); return songs(ev).length; };
  assert.equal(sung(1), 1, "round 1: the first song");
  assert.equal(state.combat.allies[0].sangAt, 1);
  for (const round of [2, 3, 4, 5]) assert.equal(sung(round), 0, `round ${round}: resting`);
  assert.equal(sung(6), 1, "round 6: the second song");
  assert.equal(state.combat.allies[0].sangAt, null);
  for (const round of [7, 11, 12, 30]) assert.equal(sung(round), 0, `round ${round}: no third song`);
  assert.equal(state.combat.sang, undefined, "the hero's own flag is never marked by a Joiner's song");
  assert.equal(state.combat.sangAt, undefined);
});

test("V7 Sing sing-once: a hero Bard and a Joiner Bard keep separate clocks (the hero's second song is due at round 6, the Joiner's, sung at round 3, at round 8)", () => {
  const state = joinerFight(6);
  state.c.sub = "Bard";
  state.c.wp = state.c.maxWP = 400;
  state.combat.sang = true; // the hero sang in round 1
  state.combat.sangAt = 1;
  const joiner = state.combat.allies[0];
  joiner.sang = true; // the Joiner sang in round 3
  joiner.sangAt = 3;
  const rng = makeRng(9);
  const ev = [];
  sing(state, rng, ev);
  assert.deepEqual(songs(ev).map((e) => e.member), [undefined], "round 6: the hero's second song, the Joiner still resting");
  assert.equal(state.combat.sangAt, null, "the hero's clock closed");
  assert.equal(joiner.sangAt, 3, "the Joiner's clock is untouched by the hero's song");
  state.combat.round = 8;
  const j = [];
  alliesTurn(state, rng, j);
  assert.deepEqual(songs(j).map((e) => e.member), ["Lyra"], "round 8: the Joiner's second song");
  assert.equal(joiner.sangAt, null);
  assert.equal(state.combat.sangAt, null, "the Joiner's song never reopens the hero's clock");
});

// ─── V25 Con Artist ────────────────────────────────────────────────────────

/** A rng whose draws come from a real stream but whose cursor is fixed, so a derived stream is reproducible; counts main draws. */
function spyRng(seed, cursor = 4242) {
  const r = makeRng(seed);
  let n = 0;
  return {
    d: (s) => { n++; return r.d(s); },
    pick: (a) => { n++; return r.pick(a); },
    next: () => { n++; return r.next(); },
    shuffle: (a) => { n++; return r.shuffle(a); },
    getState: () => cursor,
    count: () => n,
  };
}

/** Starts a fight for `sub` (a clone of one base state, so the floor and the foes match) and returns its events and main-draw count. */
function startFor(base, sub, seed, depth) {
  const state = structuredClone(base);
  state.c.sub = sub;
  state.floor.depth = depth;
  state.acts = seed; // varies the derived stream (derivedRng(cursor, purpose, acts, ...)) from case to case
  const rng = spyRng(seed);
  const events = startCombat(state, false, "Beasts", rng, []);
  return { state, events, draws: rng.count() };
}

/** Seeds and depths whose encounter is exactly one foe of level `lvl`. */
function singleFoeCases(lvl, want = 6) {
  const base = heroState({ cls: "Thief", sub: "Con Artist", race: "Human" });
  const found = [];
  for (let depth = 1; depth <= 12 && found.length < want; depth++) {
    for (let seed = 1; seed <= 300 && found.length < want; seed++) {
      const { events } = startFor(base, "Soldier", seed, depth);
      const enc = events.find((e) => e.type === "encounterStarted");
      if (enc.foes.length === 1 && enc.foes[0].lvl === lvl) found.push({ base, seed, depth });
    }
  }
  assert.ok(found.length >= Math.min(want, 3), `found ${found.length} single level ${lvl} foe encounters`);
  return found;
}

test("V25 Con Artist con-artist-leave: the leave table is level 1 four faces of six (2 times in 3) and level 2 two faces of six (1 time in 3), and nothing above", () => {
  assert.deepEqual({ ...CON_ARTIST_LEAVE_FACES }, { 1: 4, 2: 2 });
  assert.equal(CON_ARTIST_LEAVE_MAX_LVL, 2);
  assert.equal(CON_ARTIST_LEAVE_FACES[1] / 6, 2 / 3);
  assert.equal(CON_ARTIST_LEAVE_FACES[2] / 6, 1 / 3);
  assert.equal(CON_ARTIST_LEAVE_FACES[3], undefined);
});

test("V25 Con Artist con-artist-leave: a level 1 foe still draws one d6 on the main rng and leaves on a rolled 3 or more (4 faces of 6), unchanged", () => {
  let left = 0;
  let stayed = 0;
  for (const { base, seed, depth } of singleFoeCases(1, 40)) {
    const con = startFor(base, "Con Artist", seed, depth);
    const plain = startFor(base, "Soldier", seed, depth);
    assert.equal(con.draws - plain.draws, 1, "exactly one main-rng d6, as before");
    const fled = con.events.find((e) => e.type === "foeFled" && e.reason === "conArtist");
    if (fled) {
      left++;
      assert.equal(fled.atLeast, 3);
      assert.equal(fled.dieN, 6);
      assert.ok(fled.roll >= 3);
    } else stayed++;
    assert.equal(!!fled, !!con.events.find((e) => e.type === "encounterCleared"), "a lone foe that leaves clears the encounter");
  }
  assert.ok(left > 0 && stayed > 0, `both outcomes occur (left ${left}, stayed ${stayed})`);
});

test("V25 Con Artist con-artist-leave: a level 2 foe leaves one time in three from derivedRng(cursor, 'conArtistLeave', acts, foe index), and the main rng draws nothing for it", () => {
  let left = 0;
  let stayed = 0;
  for (const { base, seed, depth } of singleFoeCases(2, 60)) {
    const con = startFor(base, "Con Artist", seed, depth);
    const plain = startFor(base, "Soldier", seed, depth);
    assert.equal(con.draws, plain.draws, "no main-rng draw for a level 2 foe: no existing draw moves");
    const r = derivedRng(4242, "conArtistLeave", seed, 0).d(6);
    const wantLeave = 7 - r >= 5; // the two top numbers of the d6
    const fled = con.events.find((e) => e.type === "foeFled" && e.reason === "conArtist");
    assert.equal(!!fled, wantLeave, `seed ${seed} depth ${depth}`);
    if (fled) {
      left++;
      assert.equal(fled.atLeast, 5);
      assert.equal(fled.dieN, 6);
      assert.equal(fled.roll, 7 - r);
    } else stayed++;
  }
  assert.ok(left > 0 && stayed > left, `about one in three leaves (left ${left}, stayed ${stayed})`);
});

test("V25 Con Artist con-artist-leave: a level 3 foe never leaves and draws nothing, and a near-miss sub ('Con artist') and a Joiner Con Artist change nothing", () => {
  for (const { base, seed, depth } of singleFoeCases(3, 8)) {
    const con = startFor(base, "Con Artist", seed, depth);
    const plain = startFor(base, "Soldier", seed, depth);
    assert.equal(con.draws, plain.draws, "no draw for a level 3 foe");
    assert.equal(con.events.some((e) => e.type === "foeFled"), false);
  }
  for (const { base, seed, depth } of singleFoeCases(1, 8)) {
    const near = startFor(base, "Con artist", seed, depth);
    const plain = startFor(base, "Soldier", seed, depth);
    assert.equal(near.draws, plain.draws);
    assert.equal(near.events.some((e) => e.type === "foeFled"), false);
    // a Joiner Con Artist: the hero is a Soldier, the party member never rolls a leave
    const joiner = structuredClone(base);
    joiner.c.sub = "Soldier";
    joiner.floor.depth = depth;
    joiner.party = [{ name: "Slick", level: 1, sub: "Con Artist", cls: "Thief", race: "Human", wp: 30, maxWP: 30, status: "ok", items: [], skills: {}, potions: 0, worn: {} }];
    const rng = spyRng(seed);
    const ev = startCombat(joiner, false, "Beasts", rng, []);
    assert.equal(rng.count(), plain.draws, "a Joiner Con Artist draws nothing extra");
    assert.equal(ev.some((e) => e.type === "foeFled"), false);
  }
});

// ─── V27 Cloaker ───────────────────────────────────────────────────────────

const spectre = () => foeFrom("Demons", 4, "Spectre");

function cloakerFight(opts = {}) {
  const state = heroState({ cls: "Thief", sub: "Cloaker", race: "Human", level: 3 });
  state.c.sub = opts.sub ?? "Cloaker"; // a near-miss name is set after chargen (chargen refuses an invalid sub-class)
  state.c.wp = state.c.maxWP = 300;
  inCombat(state, [spectre()], { round: opts.round ?? 2, tracked: !!opts.tracked, ...(opts.opened2 ? { opened2: true } : {}) });
  return state;
}

/** A real rng whose first draw is the top face (flee's d20 is already roll-high: raw 20 is a natural 20): the flee always escapes. */
function escapingRng(seed = 11) {
  const rng = makeRng(seed);
  const draw = rng.d.bind(rng);
  let first = true;
  rng.d = (s) => { if (first) { first = false; return s; } return draw(s); };
  return rng;
}

test("V27 Cloaker cloaker-vanish: the unseen Cloaker's free vanish escapes a pursuing Spectre with no parting blow, no foePursued and no draw", () => {
  assert.equal(spectre().sp.pursues, true);
  const state = cloakerFight();
  const hp = state.c.wp;
  const events = flee(state, noDraws(), []);
  assert.deepEqual(events.map((e) => e.type), ["fled", "combatEnded"]);
  assert.equal(events[0].reason, "cloaker");
  assert.equal(state.c.wp, hp, "no parting blow landed");
  assert.equal(state.combat, null);
});

test("V27 Cloaker cloaker-vanish: a Cloaker who has struck (opened2) is seen, the vanish is denied and the ordinary escape still eats the Spectre's parting blow", () => {
  const state = cloakerFight({ opened2: true });
  const events = flee(state, escapingRng(), []);
  const types = events.map((e) => e.type);
  assert.ok(types.includes("vanishDenied"));
  assert.ok(types.includes("fleeRolled"));
  assert.ok(types.includes("foePursued"), "the seen Cloaker still takes the parting blow");
  assert.ok(types.indexOf("foePursued") < types.indexOf("fled"));
});

test("V27 Cloaker cloaker-vanish: every other hero still takes the Spectre's parting blow on a tracked withdrawal and on an ordinary escape, and a near-miss sub ('Cloaker ') gets no free vanish", () => {
  const tracked = cloakerFight({ sub: "Cat Burglar", tracked: true, round: 1 });
  const tev = flee(tracked, makeRng(5), []);
  assert.ok(tev.some((e) => e.type === "foePursued"), "tracked withdrawal");
  assert.equal(tev.find((e) => e.type === "fled").reason, "tracked");

  const near = cloakerFight({ sub: "Cloaker " });
  const nev = flee(near, escapingRng(), []);
  assert.ok(nev.some((e) => e.type === "fleeRolled"), "no free vanish for a near-miss name");
  assert.ok(nev.some((e) => e.type === "foePursued"));
});

test("V27 Cloaker cloaker-vanish: against a foe that does not pursue the vanish is the same free escape as before", () => {
  const state = heroState({ cls: "Thief", sub: "Cloaker", race: "Human", level: 3 });
  inCombat(state, [foeFrom("Humans", 1, "Ned", { wp: 40 })], { round: 2 });
  const events = flee(state, noDraws(), []);
  assert.deepEqual(events.map((e) => e.type), ["fled", "combatEnded"]);
});

// ─── edges shared by the part B rows ───────────────────────────────────────

test("edge (adjacency, V7 V25 V27): each part B rule touches only its own sub-class (a Cloaker's or a Bard's start draws no leave, a Bard fleeing a Spectre still takes the blow)", () => {
  const base = heroState({ cls: "Thief", sub: "Con Artist", race: "Human" });
  for (const { seed, depth } of singleFoeCases(1, 4)) {
    assert.equal(startFor(base, "Cloaker", seed, depth).draws, startFor(base, "Soldier", seed, depth).draws);
    assert.equal(startFor(base, "Bard", seed, depth).draws, startFor(base, "Soldier", seed, depth).draws);
  }
  const bard = bardHero(1);
  inCombat(bard, [spectre()], { round: 2 });
  assert.ok(flee(bard, escapingRng(), []).some((e) => e.type === "foePursued"), "a Bard fleeing a Spectre still takes the blow");
});

test("edge (empty, V7 V25 V27): no fight means nothing to sing at and nothing to vanish from; neither throws or draws", () => {
  const state = heroState({ cls: "Fighter", sub: "Bard", race: "Human", level: 3 });
  assert.equal(songReady(state), false, "no fight");
  assert.deepEqual(sing(state, noDraws(), []), []);
  assert.deepEqual(flee(state, noDraws(), []), []);
});
test("V7 text: the Bard's footer, the SING row and the new refusal say a second song 5 rounds after the first, from the engine's own number", () => {
  const good = identityFooter("sub", "Bard").good.join(" | ");
  assert.ok(good.includes(`a second song ${SONG_GAP_ROUNDS} rounds after the first`), good);
  assert.match(COMBAT_MENU_COPY.singDesc, new RegExp(`second song ${SONG_GAP_ROUNDS} rounds after the first, and never a third`));
  const resting = { type: "actionRefused", action: "sing", reason: "songResting", rounds: 3 };
  assert.match(EVENT_NARRATION.actionRefused(resting), /3 more rounds/);
  assert.match(LINE_FOR.actionRefused(resting).text, /3 more rounds/);
  assert.match(EVENT_NARRATION.actionRefused({ ...resting, rounds: 1 }), /1 more round before/);
  assert.match(EVENT_NARRATION.actionRefused({ type: "actionRefused", reason: "sungThisFight" }), /Two songs a fight/);
});

test("V25 text: the Con Artist's footer states the same table (a level 1 foe two times in three, a level 2 foe one time in three)", () => {
  const good = identityFooter("sub", "Con Artist").good.join(" | ");
  assert.ok(good.includes("a level 1 foe leaves before the fight two times in three"), good);
  assert.ok(good.includes("a level 2 foe one time in three"), good);
});

test("V27 text: the Cloaker's footer states the vanish is free even against a Spectre", () => {
  const good = identityFooter("sub", "Cloaker").good.join(" | ");
  assert.ok(/Spectre/.test(good), good);
});

test("V7 Sing sing-once: the bot plays the new rule (it sings the second song as soon as songReady allows it, round 6, and not before)", () => {
  const policyRng = { pick: (arr) => arr[0] };
  const ctx = makeBotContext();
  const state = bardHero(1);
  state.combat.type = "Walking Dead"; // a Bard talks to Humans first
  state.combat.foes[0].type = "Walking Dead";
  assert.deepEqual(decideAction(state, policyRng, ctx), { type: "sing" }, "round 1: the first song");
  sing(state, noDraws(), []);
  for (const round of [2, 5]) {
    state.combat.round = round;
    assert.notEqual(decideAction(state, policyRng, ctx).type, "sing", `round ${round}: resting`);
  }
  state.combat.round = 6;
  assert.deepEqual(decideAction(state, policyRng, ctx), { type: "sing" }, "round 6: the second song");
  sing(state, noDraws(), []);
  state.combat.round = 12;
  assert.notEqual(decideAction(state, policyRng, ctx).type, "sing", "never a third");
});
