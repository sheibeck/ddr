// test/unit/joiner-race-to-be-hit.test.js
//
// Phase 79, plan 79-02 (extra scope, orchestrator-routed todo 2026-09-25
// "An Elven Joiner never gets its own thin-boned to-be-hit trait").
//
// The bug, measured at the plan base (cd560cc8): the foe's swing at a Joiner
// (engine/combat.js#foeTurn's member branch) starts from
// foeToHitVs(state, "member"), which read the HERO's race row
// (`RACES[state.c.race].foeToHit`) — so an Elven Joiner beside a Human hero
// was NOT thin-boned (neutral to being hit), while a Human Joiner beside an
// Elven hero WAS (the hero's trait leaked onto the member's body).
//
// The fix follows the standing rulings: the Elven thin-boned trait is a race
// signature (Phase 31 for the hero; Phase 75.2: "race signatures survive
// size", "Joiners get size" under the same rule). The race's own to-be-hit
// trait now reads through ONE seam, engine/derived.js#raceFoeToHit(sheet),
// for whichever body the foe is swinging at: foeToHitVs/foeToHitBreakdown
// apply it for the hero (vs "hero"), and the member branch applies it from
// the Joiner's OWN sheet, beside the Joiner's own size term. Data read only
// (content/races.js's `foeToHit`), never a race-name check.

import test from "node:test";
import assert from "node:assert/strict";

import { foeToHitVs, foeToHitBreakdown, raceFoeToHit } from "../../engine/derived.js";
import { foeTurn } from "../../engine/combat.js";
import { startEffect } from "../../engine/effects.js";
import { RACES } from "../../content/index.js";

function fakeRng(seq) {
  let i = 0;
  const counter = { draws: 0 };
  return {
    d() {
      counter.draws++;
      if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick: (arr) => arr[0],
    shuffle: (a) => a,
    counter,
  };
}

function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
    maxWP: 55, wp: 55, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 0, rations: 6, gold: 50, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    darkFor: 0, halfNext: false,
    ...overrides,
  };
}

function fixedState(overrides = {}) {
  const { c: cOverrides, ...rest } = overrides;
  const g = [];
  for (let y = 0; y < 3; y++) {
    g.push([]);
    for (let x = 0; x < 3; x++) g[y].push({ wall: false, dark: false, seen: true, feat: null });
  }
  return {
    version: 1, seed: 1, rngState: 1, acts: 0,
    c: fixedFighter(cOverrides),
    floor: { g, px: 1, py: 1, depth: 1 },
    day: 1, steps: 0, combat: null, store: null, beats: null, party: [],
    dead: false, deathNote: "", epitaph: "",
    ...rest,
  };
}

const fixedFoe = () => ({ name: "Target", type: "Beasts", lvl: 1, size: "S", intel: 1, wp: 999, maxWP: 999, alive: true, asleep: 0, sp: {}, lives: 1 });

/** memberState(heroRace, memberRace) — a party of one, taunting (the
 * zero-draw pickFoeTarget short-circuit) so the foe's swing targets the
 * MEMBER branch. */
function memberState(heroRace, memberRace) {
  const state = fixedState({ c: { race: heroRace } });
  const sheet = fixedFighter({ race: memberRace, sub: "Guard", name: "Ada" });
  startEffect(sheet, "ability:taunt", { rounds: 1 });
  state.party = [sheet];
  state.combat = {
    foes: [fixedFoe()], type: "Beasts", round: 1, target: 0, spellOpen: false, tracked: false,
    allies: [{ partyIdx: 0, name: sheet.name, lvl: sheet.level, sub: sheet.sub, wp: sheet.wp, maxWP: sheet.maxWP }],
  };
  return state;
}

/** memberSwing(heroRace, memberRace) — the foe's one swing at the Joiner:
 * its winning faces (dieN + 1 − atLeast, read roll-high), its mods and the
 * draw count. Raw 1 mirrors to the top face: a guaranteed hit, then the
 * damage die. */
function memberSwing(heroRace, memberRace) {
  const state = memberState(heroRace, memberRace);
  const rng = fakeRng([1, 5]);
  const events = foeTurn(state, rng, []);
  const e = events.find((ev) => ev.member && (ev.type === "struckByFoe" || ev.type === "foeMissed" || ev.type === "memberStruck"));
  assert.ok(e, `${heroRace} hero / ${memberRace} Joiner: the member swing resolved (${events.map((x) => x.type).join(",")})`);
  return { faces: e.dieN + 1 - e.atLeast, mods: e.mods || [], draws: rng.counter.draws };
}

test("raceFoeToHit(sheet) reads the race row's own `foeToHit` for any body: Elven +1, every other race 0, a missing race 0", () => {
  for (const [race, R] of Object.entries(RACES)) {
    assert.equal(raceFoeToHit(fixedFighter({ race })), R.foeToHit || 0, race);
  }
  assert.equal(raceFoeToHit(fixedFighter({ race: "Elven" })), 1);
  assert.equal(raceFoeToHit({}), 0);
  assert.equal(raceFoeToHit(null), 0);
});

test("an Elven Joiner is thin-boned: the foe's faces against it rise by exactly the race's foeToHit, with its own race mod", () => {
  const human = memberSwing("Human", "Human");
  const elven = memberSwing("Human", "Elven");
  assert.equal(elven.faces, human.faces + RACES.Elven.foeToHit, "one face easier to hit");
  assert.ok(elven.mods.some((m) => m.name === "Elven" && m.delta === 1), JSON.stringify(elven.mods));
  assert.equal(elven.mods.some((m) => m.name === "size"), false, "the Elven face-axis size mask still holds: no size step");
});

test("the hero's race no longer reaches a Joiner's body: an Elven hero's Human Joiner reads the same faces as a Human hero's", () => {
  const plain = memberSwing("Human", "Human");
  const elfHero = memberSwing("Elven", "Human");
  assert.equal(elfHero.faces, plain.faces);
  assert.equal(elfHero.mods.some((m) => m.name === "Elven"), false, JSON.stringify(elfHero.mods));
});

test("an Elven hero with an Elven Joiner: the Joiner is thin-boned once, never twice", () => {
  const plain = memberSwing("Human", "Human");
  const both = memberSwing("Elven", "Elven");
  assert.equal(both.faces, plain.faces + 1);
  assert.equal(both.mods.filter((m) => m.name === "Elven").length, 1);
});

test("the hero's own odds are unchanged: foeToHitVs/foeToHitBreakdown(vs hero) still carry the Elven +1", () => {
  const human = fixedState({ c: { race: "Human" } });
  const elven = fixedState({ c: { race: "Elven" } });
  assert.equal(foeToHitVs(elven), foeToHitVs(human) + 1);
  assert.deepEqual(foeToHitBreakdown(elven).mods.filter((m) => m.name === "Elven"), [{ name: "Elven", delta: 1 }]);
  assert.equal(foeToHitBreakdown(elven).need, foeToHitVs(elven));
});

test('foeToHitVs(state, "member") and its breakdown carry no race term from the hero (the member branch adds the Joiner\'s own)', () => {
  const elvenHero = fixedState({ c: { race: "Elven" } });
  const humanHero = fixedState({ c: { race: "Human" } });
  assert.equal(foeToHitVs(elvenHero, "member"), foeToHitVs(humanHero, "member"));
  assert.equal(foeToHitBreakdown(elvenHero, "member").mods.some((m) => m.name === "Elven"), false);
  assert.equal(foeToHitBreakdown(elvenHero, "member").need, foeToHitVs(elvenHero, "member"));
});

test("zero draws: the foe's swing at an Elven, Dwarven, Troll or Human Joiner draws the same count", () => {
  for (const race of ["Elven", "Dwarven", "Troll", "Human"]) assert.equal(memberSwing("Human", race).draws, 2, race);
});
