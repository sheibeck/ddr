// test/unit/doze-stun-ice.test.js
//
// Phase 90 plan 05 (SPELL-11 and the Ice part of SPELL-12), for the hero and a
// Joiner Magic User. The user's rulings (2026-09-30):
//   - SPELL-11: "Doze sleeps d4 foes for d4 rounds and a hit wakes a dozing
//     foe; Stun holds one foe for d4 rounds and a hit does not end it."
//   - SPELL-12: "Ice is an area d10 to every foe with a chance to freeze each
//     target 1d4 rounds" (the area version of the level-1 Freeze).
//   - Q3 A: only Doze's sleep wakes on a hit. Q4 A: Doze reaches exactly d4
//     foes, the target first. Q5 A: Ice has no to-hit roll; every foe takes
//     d10 + level^2, and a survivor is frozen d4 rounds unless it resists
//     (the resist stops only the freeze).
//
// Every resist below is the ONE depth-rising resist (engine/combat.js
// foeResistsSpell = foeResistsEffect). Its outcome is forced by searching for
// a `state.acts` whose real derived roll gives the wanted result (the
// spell-depth-resist.test.js pattern), with the main-rng cursor fixed at 0.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { castSpell } from "../../engine/magic.js";
import { alliesTurn, foeTurn, playerStrike, dozeFoes, stunFoe, iceStorm } from "../../engine/combat.js";
import { damageFoe } from "../../engine/foeDamage.js";
import { resolveScrollFumble } from "../../engine/scrollFumble.js";
import { foeRisingResistCheck, isAttackSpell, DAMAGE_SPELL_KINDS, ATTACK_SPELL_KINDS } from "../../engine/derived.js";
import { SPELLS, SCROLL_FUMBLE } from "../../content/index.js";
import { GW, GH } from "../../engine/maze.js";
import { newRun } from "../../engine/engine.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { LINE_FOR, linesForAction } from "../../src/browser/narrationLines.js";
import { movementComparable, combatComparable, economyComparable } from "../parity/harness/comparables.js";

const IDX = Object.fromEntries(SPELLS.map((sp, i) => [sp.n, i]));
const SP = Object.fromEntries(SPELLS.map((sp) => [sp.n, sp]));
const ONES = (n) => new Array(n).fill(1);

/** fakeRng(seq) — `.d()` pops the next raw value (a raw 1 is the best face of
 * a roll-high check); the cursor (`getState`) is fixed at 0 so a forced resist
 * outcome never depends on how many main draws came first. */
function fakeRng(seq) {
  let i = 0;
  return {
    d() {
      if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick: (arr) => arr[0],
    shuffle: (a) => a,
    getState: () => 0,
    count: () => i,
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

function hero(overrides = {}) {
  return {
    cls: "Magic User", sub: "Wizard", race: "Human", level: 5, sp: 0,
    maxWP: 60, wp: 60, skills: {}, vp: 0,
    weapon: "Dagger", prof: 0, magicWpn: 0,
    armor: "Cloth", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 0, rations: 4, gold: 50, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Caster",
    ...overrides,
  };
}

function foe(name, overrides = {}) {
  return { name, type: "Humans", lvl: 1, size: "S", intel: 10, wp: 30, maxWP: 30, alive: true, asleep: 0, sp: {}, lives: 1, ...overrides };
}

function spellState(spellName, level, nFoes, { target = 0, foeOver = {}, depth = 1 } = {}) {
  return {
    version: 1, seed: 1, rngState: 1, acts: 0,
    c: hero({ level, grimoire: [spellName] }),
    floor: fixedFloor(depth),
    day: 1, steps: 0, store: null, beats: null, dead: false, deathNote: "", epitaph: "",
    combat: {
      foes: Array.from({ length: nFoes }, (_, k) => foe(`F${k + 1}`, foeOver)),
      type: "Humans", round: 1, target, spellOpen: false, tracked: false,
    },
  };
}

const isResistLine = (e) => e.type === "spellResisted" || e.type === "resistFailed";

/** findActs(wants, depth) — the first state.acts whose REAL resist roll gives
 * every `[source, idx, resisted, by]` in `wants`. */
function findActs(wants, depth = 1, intel = 10) {
  const probe = { getState: () => 0 };
  for (let acts = 0; acts <= 20000; acts++) {
    if (wants.every(([source, idx, resisted, by]) => foeRisingResistCheck({ floor: { depth }, acts, combat: { round: 1 } }, probe, source, idx, intel, by).resisted === resisted)) return acts;
  }
  throw new Error(`findActs: nothing for ${JSON.stringify(wants)}`);
}

/** failActs(source, nFoes, by) — the first acts where NO foe resists `source`. */
function failActs(source, nFoes, by) {
  return findActs(Array.from({ length: nFoes }, (_, i) => [source, i, false, by]));
}

// ---------------------------------------------------------------------------
// Doze (Q3 A, Q4 A): d4 foes, the target first; each sleeper its own d4; a hit wakes.
// ---------------------------------------------------------------------------

test("Doze: a d4 reach of 2 over four foes sleeps the aimed foe and then the first other live foe, each its own d4, each marked dozing", () => {
  const s = spellState("Doze", 1, 4, { target: 2 });
  s.acts = failActs("Doze", 4);
  const events = castSpell(s, IDX.Doze, fakeRng([2, 3, 4, ...ONES(80)]), []);
  const dozed = events.filter((e) => e.type === "dozed");
  assert.deepEqual(dozed.map((e) => [e.target, e.rounds]), [["F3", 3], ["F1", 4]], "the aimed foe first, then C.foes order");
  const [f1, f2, f3, f4] = s.combat.foes;
  assert.equal(f3.dozing, true);
  assert.equal(f1.dozing, true);
  assert.equal(f3.asleep, 2, "d4 3, one foe visit spent this dispatch");
  assert.equal(f1.asleep, 3, "d4 4, one visit spent");
  assert.equal(f2.asleep, 0);
  assert.equal(f4.asleep, 0);
  assert.equal("dozing" in f2, false);
  assert.equal("dozing" in f4, false);
});

test("Doze: the reach is exactly the first d4 drawn on the main rng (no level multiplier, Q4 A): a level-5 caster with a d4 of 1 sleeps one foe", () => {
  const s = spellState("Doze", 5, 3, { target: 0 });
  s.acts = failActs("Doze", 3);
  const events = castSpell(s, IDX.Doze, fakeRng([1, 4, ...ONES(80)]), []);
  assert.equal(events.filter((e) => e.type === "dozed").length, 1);
  assert.equal(events.filter(isResistLine).length, 1, "one reached foe, one resist");
});

test("Doze: a reach larger than the live foes sleeps every live foe exactly once", () => {
  const s = spellState("Doze", 1, 2, { target: 1 });
  s.acts = failActs("Doze", 2);
  const events = castSpell(s, IDX.Doze, fakeRng([4, 2, 3, ...ONES(80)]), []);
  assert.deepEqual(events.filter((e) => e.type === "dozed").map((e) => e.target), ["F2", "F1"]);
  assert.equal(s.combat.foes.every((f) => f.dozing === true), true);
});

test("Doze: a foe that resists stays awake and draws no d4; the sleep and resist lines follow the target-first order", () => {
  const s = spellState("Doze", 1, 2, { target: 1 });
  // the aimed foe (index 1) resists, the other (index 0) does not
  s.acts = findActs([["Doze", 1, true], ["Doze", 0, false]]);
  const rng = fakeRng([2, 4, ...ONES(80)]);
  const events = castSpell(s, IDX.Doze, rng, []);
  const order = events.filter((e) => isResistLine(e) || e.type === "dozed").map((e) => `${e.type}:${e.target}`);
  assert.deepEqual(order, ["spellResisted:F2", "resistFailed:F1", "dozed:F1"]);
  assert.equal(s.combat.foes[1].asleep, 0);
  assert.equal("dozing" in s.combat.foes[1], false);
  assert.equal(s.combat.foes[0].dozing, true);
  assert.equal(events.find((e) => e.type === "dozed").rounds, 4, "the one d4 drawn after the reach went to the one sleeper");
});

test("Doze edge (empty): every reached foe resists, nobody sleeps, one closing line says so", () => {
  const s = spellState("Doze", 1, 2, { target: 0 });
  s.acts = findActs([["Doze", 0, true], ["Doze", 1, true]]);
  const events = castSpell(s, IDX.Doze, fakeRng([2, ...ONES(80)]), []);
  assert.equal(events.some((e) => e.type === "dozed"), false);
  assert.equal(events.filter((e) => e.type === "dozeFailed").length, 1);
  assert.equal(s.combat.foes.some((f) => f.dozing), false);
});

test("Doze edge (adjacency): a foe already asleep longer keeps the longer sleep; two Doze casts leave one dozing mark and the longer sleep", () => {
  const s = spellState("Doze", 1, 1);
  s.combat.foes[0].asleep = 6;
  const acts = failActs("Doze", 1);
  s.acts = acts;
  const ev = [];
  dozeFoes(s, SP.Doze, fakeRng([1, 2]), ev);
  assert.equal(s.combat.foes[0].asleep, 6, "d4 2 never shortens a 6");
  assert.equal(s.combat.foes[0].dozing, true);
  dozeFoes(s, SP.Doze, fakeRng([1, 4]), ev);
  assert.equal(s.combat.foes[0].asleep, 6);
  assert.equal(Object.keys(s.combat.foes[0]).filter((k) => k === "dozing").length, 1);
  const s2 = spellState("Doze", 1, 1);
  s2.acts = acts;
  dozeFoes(s2, SP.Doze, fakeRng([1, 3]), []);
  dozeFoes(s2, SP.Doze, fakeRng([1, 2]), []);
  assert.equal(s2.combat.foes[0].asleep, 3, "the second, shorter Doze keeps the first's three rounds");
});

test("Doze: when the sleep runs out the dozing mark goes with it", () => {
  const s = spellState("Doze", 1, 1);
  const f = s.combat.foes[0];
  f.asleep = 1;
  f.dozing = true;
  foeTurn(s, fakeRng(ONES(40)), []);
  assert.equal(f.asleep, 0);
  assert.equal("dozing" in f, false);
});

test("Doze: a dozing foe that is held while its sleep runs down loses the mark when the count hits 0", () => {
  const s = spellState("Doze", 1, 1);
  const f = s.combat.foes[0];
  f.asleep = 1;
  f.dozing = true;
  f.held = { kind: "frozen", left: 3 };
  foeTurn(s, fakeRng(ONES(40)), []);
  assert.equal(f.asleep, 0);
  assert.equal("dozing" in f, false);
});

// --- a hit wakes a dozing foe (damageFoe's seam) ---------------------------------

test("a hit wakes a dozing foe: the first damage it takes through damageFoe ends its sleep at once and pushes foeWoke", () => {
  const s = spellState("Doze", 1, 1);
  const f = s.combat.foes[0];
  f.asleep = 4;
  f.dozing = true;
  const events = [];
  const hit = damageFoe(s, f, 5, { kind: "melee" }, fakeRng(ONES(8)), events);
  assert.equal(hit.applied, 5);
  assert.equal(f.asleep, 0);
  assert.equal("dozing" in f, false);
  assert.deepEqual(events.filter((e) => e.type === "foeWoke"), [{ type: "foeWoke", target: "F1" }]);
});

test("a killing hit on a dozing foe needs no wake line (it is dead), and the sleep is cleared all the same", () => {
  const s = spellState("Doze", 1, 1, { foeOver: { wp: 3, maxWP: 3 } });
  const f = s.combat.foes[0];
  f.asleep = 4;
  f.dozing = true;
  const events = [];
  damageFoe(s, f, 5, { kind: "spell", school: "thrown" }, fakeRng(ONES(8)), events);
  assert.equal(events.some((e) => e.type === "foeWoke"), false);
  assert.equal(f.asleep, 0);
  assert.equal("dozing" in f, false);
});

test("a blow a ward absorbs wakes nobody: only damage the foe actually takes wakes it", () => {
  const s = spellState("Doze", 1, 1);
  const f = s.combat.foes[0];
  f.asleep = 4;
  f.dozing = true;
  f.ward = { name: "Shield", pool: 50, rounds: 5 };
  const events = [];
  damageFoe(s, f, 5, { kind: "melee" }, fakeRng(ONES(8)), events);
  assert.equal(f.asleep, 4);
  assert.equal(f.dozing, true);
  assert.equal(events.some((e) => e.type === "foeWoke"), false);
});

test("Q3 A: a plain asleep foe (Noxious Vapor, Insane's nap, a staff's gas: asleep with no dozing mark) is NOT woken by a hit", () => {
  const s = spellState("Doze", 1, 1);
  const f = s.combat.foes[0];
  f.asleep = 5;
  const events = [];
  damageFoe(s, f, 5, { kind: "melee" }, fakeRng(ONES(8)), events);
  assert.equal(f.asleep, 5);
  assert.equal(events.some((e) => e.type === "foeWoke"), false);
});

test("a hero's landed blow wakes a dozing foe at the floor of 5 winning faces, and the foe acts on its next turn", () => {
  const s = {
    version: 1, seed: 1, rngState: 1, acts: 0,
    c: hero({ cls: "Fighter", sub: "Soldier", weapon: "Club", armor: "Nothing", level: 1, maxWP: 55, wp: 55 }),
    floor: fixedFloor(1), day: 1, steps: 0, store: null, beats: null, dead: false, deathNote: "", epitaph: "",
    combat: { foes: [foe("F1", { wp: 60, maxWP: 60, asleep: 4, dozing: true })], type: "Humans", round: 1, target: 0, spellOpen: false, tracked: false },
  };
  // a raw 5 is a mirrored 16 on a d20: a miss at need 5 (faces 16-20 win), but the dozing floor of 5 faces still needs 16... use the best raw 1 for a sure hit
  const events = playerStrike(s, fakeRng([1, 3, ...ONES(60)]), []);
  assert.ok(events.some((e) => e.type === "struck"));
  assert.ok(events.some((e) => e.type === "foeWoke"));
  assert.equal(s.combat.foes[0].asleep, 0);
  assert.equal("dozing" in s.combat.foes[0], false);
  assert.equal(events.some((e) => e.type === "foeSlept"), false, "it does not sleep through the next foe turn");
});

test("a damage-over-time tick and an area spell wake a dozing foe too (any damage through damageFoe, whoever deals it)", () => {
  const s = spellState("Lightning", 4, 2);
  s.acts = 0;
  const [a, b] = s.combat.foes;
  a.asleep = 5;
  a.dozing = true;
  b.asleep = 5;
  b.dozing = true;
  a.acid = { rounds: 2, dmg: { n: 1, sides: 6, bonus: 0 } };
  const events = [];
  foeTurn(s, fakeRng(ONES(60)), events);
  assert.equal(a.asleep, 0, "an acid tick wakes it");
  assert.ok(events.some((e) => e.type === "foeWoke" && e.target === "F1"));
  assert.equal(b.asleep, 4, "the untouched sleeper keeps sleeping (one visit spent)");
  assert.equal(b.dozing, true);
  s.acts = failActs("Lightning", 2);
  const lightning = castSpell(s, IDX.Lightning, fakeRng(ONES(120)), []);
  assert.ok(lightning.some((e) => e.type === "foeWoke" && e.target === "F2"), "Lightning's damage wakes the other sleeper");
  assert.equal(b.asleep, 0);
  assert.equal("dozing" in b, false);
});

// ---------------------------------------------------------------------------
// Stun: one foe, d4 rounds, a hit does not end it, never shortens.
// ---------------------------------------------------------------------------

test("Stun: the aimed foe (not the first live foe) is held 'stunned' for exactly the d4 drawn after its resist, one controlHeld, no stunned count line", () => {
  const s = spellState("Stun", 1, 3, { target: 1 });
  s.acts = failActs("Stun", 3);
  const events = castSpell(s, IDX.Stun, fakeRng([3, ...ONES(80)]), []);
  const held = events.filter((e) => e.type === "controlHeld");
  assert.equal(held.length, 1);
  assert.deepEqual({ target: held[0].target, kind: held[0].kind, rounds: held[0].rounds, source: held[0].source }, { target: "F2", kind: "stunned", rounds: 3, source: "Stun" });
  assert.equal(events.filter(isResistLine).length, 1, "one resist, on the one foe");
  assert.equal(events.some((e) => e.type === "stunned"), false, "the 'N foes asleep' count line is gone");
  assert.equal(s.combat.foes[1].held.kind, "stunned");
  assert.equal(s.combat.foes[1].held.left, 2, "one foe visit already spent this dispatch");
  assert.equal(s.combat.foes[0].asleep + s.combat.foes[2].asleep, 0, "nobody else is touched");
});

test("Stun: a resisted cast holds nobody and draws no d4", () => {
  const s = spellState("Stun", 1, 2, { target: 0 });
  s.acts = findActs([["Stun", 0, true]]);
  const rng = fakeRng(ONES(80));
  const events = castSpell(s, IDX.Stun, rng, []);
  assert.equal(events.some((e) => e.type === "controlHeld"), false);
  assert.equal("held" in s.combat.foes[0], false);
});

test("Stun: the held foe skips its turns, a landed blow on it does not end the hold, and the hold breaks after exactly the d4 (edge: d4 = 4 holds four foe turns)", () => {
  const s = spellState("Stun", 1, 1);
  s.acts = failActs("Stun", 1);
  const f = s.combat.foes[0];
  f.wp = 400;
  f.maxWP = 400;
  const first = castSpell(s, IDX.Stun, fakeRng([4, ...ONES(80)]), []);
  let skips = first.filter((e) => e.type === "foeStillHeld" || e.type === "foeHoldBroken").length;
  assert.equal(f.held.left, 3);
  // a hero blow in between (a Wizard with an attack spell refuses melee, so the caster swaps to a Fighter's club):
  // it lands (held foes are hit on at least 5 winning faces) and does not touch the hold
  Object.assign(s.c, { cls: "Fighter", sub: "Soldier", weapon: "Club", armor: "Nothing", grimoire: [] });
  const blow = playerStrike(s, fakeRng([1, 3, ...ONES(80)]), []);
  assert.ok(blow.some((e) => e.type === "struck"));
  assert.equal(blow.some((e) => e.type === "foeHoldBroken"), false);
  skips += blow.filter((e) => e.type === "foeStillHeld" || e.type === "foeHoldBroken").length;
  for (let i = 0; i < 6 && skips < 4; i++) {
    const ev = foeTurn(s, fakeRng(ONES(40)), []);
    skips += ev.filter((e) => e.type === "foeStillHeld" || e.type === "foeHoldBroken").length;
  }
  assert.equal(skips, 4, "four foe turns skipped in all");
  assert.equal("held" in f, false, "the hold is gone after its last skip");
  const next = foeTurn(s, fakeRng(ONES(40)), []);
  assert.equal(next.some((e) => e.type === "foeStillHeld" || e.type === "foeHoldBroken"), false, "the next visit it acts");
});

test("Stun: a new hold never shortens a longer live one (the longer hold's kind and rounds stand, the new cast still says so)", () => {
  const s = spellState("Stun", 1, 1);
  const f = s.combat.foes[0];
  f.held = { kind: "frozen", left: 4 };
  const events = [];
  stunFoe(s, f, SP.Stun, fakeRng([2]), events);
  assert.deepEqual(f.held, { kind: "frozen", left: 4 });
  assert.equal(events.filter((e) => e.type === "controlHeld").length, 1);
  stunFoe(s, f, SP.Stun, fakeRng([4]), events);
  assert.equal(f.held.left, 4, "an equal hold does not shorten it either");
  const g = foe("G");
  g.held = { kind: "stunned", left: 1 };
  s.combat.foes.push(g);
  stunFoe(s, g, SP.Stun, fakeRng([3]), []);
  assert.deepEqual(g.held, { kind: "stunned", left: 3 }, "a longer new hold replaces a shorter one");
});

// ---------------------------------------------------------------------------
// Ice (Q5 A): every foe d10 + level^2, no to-hit; each survivor frozen d4 unless it resists.
// ---------------------------------------------------------------------------

test("Ice: every foe takes its own d10 + level^2 in C.foes order, then its own freeze (a d4, the resist, a frozen hold), foe by foe", () => {
  const s = spellState("Ice", 3, 3);
  s.acts = failActs("Ice", 3);
  const events = [];
  // per foe: damage d10, then the freeze d4
  iceStorm(s, SP.Ice, fakeRng([4, 2, 5, 3, 6, 1, ...ONES(20)]), events);
  const hits = events.filter((e) => e.type === "spellHit");
  assert.deepEqual(hits.map((e) => [e.target, e.dmg, e.levelSq]), [["F1", 13, 9], ["F2", 14, 9], ["F3", 15, 9]], "d10 + 9 each, integers");
  assert.deepEqual(s.combat.foes.map((f) => f.wp), [17, 16, 15]);
  assert.deepEqual(s.combat.foes.map((f) => f.held), [{ kind: "frozen", left: 2 }, { kind: "frozen", left: 3 }, { kind: "frozen", left: 1 }]);
  const order = events.filter((e) => e.type === "spellHit" || e.type === "controlHeld").map((e) => `${e.type}:${e.target}`);
  assert.deepEqual(order, ["spellHit:F1", "controlHeld:F1", "spellHit:F2", "controlHeld:F2", "spellHit:F3", "controlHeld:F3"], "damage, then that foe's freeze, then the next foe");
  assert.equal(events.some((e) => e.type === "spellThrown" || e.type === "spellMissed"), false, "no to-hit roll");
  assert.ok(events.every((e) => e.type !== "controlHeld" || e.freeze === true), "every hold is a Freeze's frozen hold");
});

test("Ice: a castSpell cast is an area cast: no spellThrown, one cast line, damage then freeze per foe, and nothing is resisted before the damage", () => {
  const s = spellState("Ice", 3, 2);
  s.acts = failActs("Ice", 2);
  const events = castSpell(s, IDX.Ice, fakeRng([4, 2, 5, 3, ...ONES(80)]), []);
  assert.equal(events.some((e) => e.type === "spellThrown"), false);
  assert.equal(events.filter((e) => e.type === "iceCast").length, 1);
  const firstHit = events.findIndex((e) => e.type === "spellHit");
  const firstResist = events.findIndex(isResistLine);
  assert.ok(firstHit >= 0 && firstResist > firstHit, "the freeze resist comes after that foe's damage");
  assert.equal(events.filter(isResistLine).length, 2, "one freeze resist per surviving foe");
  assert.deepEqual(s.combat.foes.map((f) => f.wp), [17, 16]);
  assert.equal(s.combat.foes[0].held.kind, "frozen");
});

test("Ice: a foe that resists the freeze still takes the damage; the resist stops only the freeze", () => {
  const s = spellState("Ice", 3, 2);
  s.acts = findActs([["Ice", 0, true], ["Ice", 1, false]]);
  const events = [];
  iceStorm(s, SP.Ice, fakeRng([4, 2, 5, 3, ...ONES(20)]), events);
  assert.deepEqual(s.combat.foes.map((f) => f.wp), [17, 16]);
  assert.equal("held" in s.combat.foes[0], false);
  assert.equal(s.combat.foes[1].held.kind, "frozen");
  const lines = events.filter(isResistLine);
  assert.equal(lines[0].type, "spellResisted");
  assert.equal(lines[0].freeze, true, "the line says the damage landed and only the ice was shrugged off");
});

test("Ice edge (boundary): a d10 + level^2 of exactly the foe's remaining hp kills it, no freeze, no resist roll for it", () => {
  const s = spellState("Ice", 3, 2);
  s.combat.foes[0].wp = 13; // d10 4 + 9 = 13 exactly
  s.combat.foes[0].maxWP = 13;
  s.acts = failActs("Ice", 2);
  const events = [];
  iceStorm(s, SP.Ice, fakeRng([4, 5, 3, ...ONES(40)]), events);
  assert.equal(s.combat.foes[0].alive, false);
  assert.ok(events.some((e) => e.type === "foeKilled" && e.name === "F1"));
  assert.equal(events.some((e) => e.type === "controlHeld" && e.target === "F1"), false);
  assert.equal(events.some((e) => isResistLine(e) && e.target === "F1"), false);
  assert.equal(s.combat.foes[1].held.kind, "frozen", "the next foe is frozen as usual");
});

test("Ice edge (empty): damage that kills every foe pushes no freeze event at all", () => {
  const s = spellState("Ice", 3, 2, { foeOver: { wp: 5, maxWP: 5 } });
  s.acts = failActs("Ice", 2);
  const events = [];
  iceStorm(s, SP.Ice, fakeRng([4, 5, ...ONES(60)]), events);
  assert.equal(s.combat.foes.every((f) => !f.alive), true);
  assert.equal(events.some((e) => e.type === "controlHeld" || isResistLine(e)), false);
});

test("Ice edge (adjacency): Ice on a dozing foe wakes it with the damage and then may freeze it (the hold wins over the sleep)", () => {
  const s = spellState("Ice", 3, 1);
  const f = s.combat.foes[0];
  f.asleep = 4;
  f.dozing = true;
  s.acts = failActs("Ice", 1);
  const events = [];
  iceStorm(s, SP.Ice, fakeRng([4, 3, ...ONES(20)]), events);
  assert.equal(f.asleep, 0);
  assert.equal("dozing" in f, false);
  assert.ok(events.some((e) => e.type === "foeWoke" && e.target === "F1"));
  assert.deepEqual(f.held, { kind: "frozen", left: 3 });
});

test("Ice edge (adjacency): Stun on a frozen foe keeps the longer hold (checked above); Ice on a held foe never shortens it", () => {
  const s = spellState("Ice", 3, 1);
  const f = s.combat.foes[0];
  f.held = { kind: "stunned", left: 4 };
  s.acts = failActs("Ice", 1);
  iceStorm(s, SP.Ice, fakeRng([4, 2, ...ONES(20)]), []);
  assert.deepEqual(f.held, { kind: "stunned", left: 4 });
});

test("Ice edge (precision): the freeze rounds are FREEZE_HOLD_DIE's d4; the damage is integers and Afraid halves it before the freeze", () => {
  const s = spellState("Ice", 3, 1);
  s.combat.afraid = 3;
  s.acts = failActs("Ice", 1);
  const events = [];
  iceStorm(s, SP.Ice, fakeRng([4, 4, ...ONES(20)]), events);
  const hit = events.find((e) => e.type === "spellHit");
  assert.equal(hit.dmg, Math.ceil(13 / 2));
  assert.equal(hit.afraid, true);
  assert.equal(s.combat.foes[0].held.left, 4);
  assert.ok(Number.isInteger(hit.dmg));
});

// ---------------------------------------------------------------------------
// A Joiner Magic User's allyCast takes the same shared tails, with `by` on every event.
// ---------------------------------------------------------------------------

function joinerState(spellName, foes) {
  const mu = {
    name: "Ada", level: 3, sub: "Wizard", cls: "Magic User", race: "Human", wp: 20, maxWP: 20, status: "ok",
    weapon: "Quarter Staff", prof: 0, magicWpn: 0, might: 0, items: [], skills: {}, armor: "Nothing", grimoire: [spellName], spellsUsed: 0,
  };
  return {
    version: 1, seed: 1, rngState: 1, acts: 0,
    c: hero({ cls: "Fighter", sub: "Soldier", level: 1, maxWP: 55, wp: 55, grimoire: [] }),
    floor: fixedFloor(1), day: 1, steps: 0, store: null, beats: null, party: [mu], dead: false, deathNote: "", epitaph: "",
    combat: { foes, type: "Humans", round: 1, target: 0, spellOpen: false, tracked: false, allies: [{ partyIdx: 0, name: "Ada", lvl: 3, sub: "Wizard", wp: 20, maxWP: 20 }] },
  };
}

test("a Joiner's Doze reaches d4 foes, target first, each its own d4, with `by` on every event", () => {
  const foes = [foe("J1"), foe("J2"), foe("J3")];
  const s = joinerState("Doze", foes);
  s.combat.target = 1;
  s.acts = failActs("Doze", 3, "Ada");
  const events = alliesTurn(s, fakeRng([2, 3, 4, ...ONES(80)]), []);
  const dozed = events.filter((e) => e.type === "dozed");
  assert.deepEqual(dozed.map((e) => [e.target, e.rounds, e.by]), [["J2", 3, "Ada"], ["J1", 4, "Ada"]]);
  assert.equal(foes[1].dozing, true);
  assert.equal(foes[0].dozing, true);
  assert.equal("dozing" in foes[2], false);
  for (const e of events.filter(isResistLine)) assert.equal(e.by, "Ada");
});

test("a Joiner's Stun holds the target for a d4 as 'stunned' after its own resist, with `by`", () => {
  const foes = [foe("J1"), foe("J2")];
  const s = joinerState("Stun", foes);
  s.acts = failActs("Stun", 2, "Ada");
  const events = alliesTurn(s, fakeRng([3, ...ONES(80)]), []);
  const held = events.find((e) => e.type === "controlHeld");
  assert.ok(held, "a controlHeld line");
  assert.equal(held.kind, "stunned");
  assert.equal(held.rounds, 3);
  assert.equal(held.by, "Ada");
  assert.equal(foes[0].held.kind, "stunned");
  assert.equal(events.filter(isResistLine).length, 1);
  assert.equal(events.filter(isResistLine)[0].by, "Ada");
});

test("a Joiner's Ice damages every foe with its own level^2 (3^2) and freezes each survivor for a d4, with `by`", () => {
  const foes = [foe("J1"), foe("J2")];
  const s = joinerState("Ice", foes);
  s.acts = failActs("Ice", 2, "Ada");
  const events = alliesTurn(s, fakeRng([4, 2, 5, 3, ...ONES(80)]), []);
  const hits = events.filter((e) => e.type === "allySpellHit" && e.effect === "damage");
  assert.deepEqual(hits.map((e) => [e.target, e.dmg, e.name]), [["J1", 13, "Ada"], ["J2", 14, "Ada"]]);
  assert.deepEqual(foes.map((f) => f.wp), [17, 16]);
  assert.equal(foes[0].held.kind, "frozen");
  assert.equal(foes[1].held.kind, "frozen");
  assert.ok(events.filter((e) => e.type === "controlHeld").every((e) => e.by === "Ada" && e.freeze === true));
});

// ---------------------------------------------------------------------------
// Kinds, content and the removed damage-over-time machinery.
// ---------------------------------------------------------------------------

test("the spell rows: Doze and Stun keep their kinds; Ice is an every-foe 'blast' with Freeze's onHit and a d10; no row has kind 'dot'", () => {
  assert.equal(SPELLS.some((sp) => sp.kind === "dot"), false, "no spell row is a damage-over-time spell any more");
  assert.equal(SP.Doze.kind, "status");
  assert.equal(SP.Stun.kind, "stun");
  const ice = SP.Ice;
  assert.equal(ice.kind, "blast");
  assert.equal(ice.aoe, "all");
  assert.equal(ice.onHit, "freeze");
  assert.deepEqual(ice.dmg, { n: 1, sides: 10, bonus: 0 });
  assert.equal(ice.lvl, 3);
  assert.equal(ice.niche, "multi");
});

test("DAMAGE_SPELL_KINDS has no 'dot' and has 'blast'; Ice counts as an attack spell (the Wizard refusal and a Joiner's pick)", () => {
  assert.equal(DAMAGE_SPELL_KINDS.has("dot"), false);
  assert.equal(DAMAGE_SPELL_KINDS.has("blast"), true);
  assert.equal(ATTACK_SPELL_KINDS.has("blast"), true);
  assert.equal(isAttackSpell(SP.Ice), true);
});

test("the scroll fumble rows: Doze and Stun are 'out' asleep d4 rows; Ice is an area damage row; no row carries `then`", () => {
  assert.deepEqual({ side: SCROLL_FUMBLE.Doze.side, effect: SCROLL_FUMBLE.Doze.effect, kind: SCROLL_FUMBLE.Doze.kind }, { side: "harmful", effect: "out", kind: "asleep" });
  assert.deepEqual({ side: SCROLL_FUMBLE.Stun.side, effect: SCROLL_FUMBLE.Stun.effect, kind: SCROLL_FUMBLE.Stun.kind }, { side: "harmful", effect: "out", kind: "asleep" });
  assert.deepEqual({ side: SCROLL_FUMBLE.Ice.side, effect: SCROLL_FUMBLE.Ice.effect }, { side: "area", effect: "damage" });
  for (const [name, row] of Object.entries(SCROLL_FUMBLE)) assert.equal("then" in row, false, `${name} has no 'then' hand-off`);
});

test("a fumbled Ice scroll hits the reader and the reader's side through resolveArea, and sets no selfDot", () => {
  const s = spellState("Ice", 4, 1);
  s.combat.allies = [{ partyIdx: 0, name: "Ada", wp: 20, maxWP: 20 }];
  s.party = [{ name: "Ada" }];
  const before = s.c.wp;
  const events = resolveScrollFumble(s, SP.Ice, fakeRng([5, 6]), fakeRng(ONES(8)), []);
  const hits = events.filter((e) => e.type === "fumbleOnSide");
  assert.ok(hits.some((e) => e.who === "member" && e.name === "Ada"));
  assert.ok(hits.some((e) => e.who === "reader"));
  assert.ok(s.c.wp < before);
  assert.equal("selfDot" in s.combat, false);
});

test("the new per-foe `dozing` field is carved out of ALL THREE parity *Comparable() functions (and only that field)", () => {
  const vampireFoe = { name: "Vampire", type: "Walking Dead", lvl: 5, size: "H", intel: 12, wp: 71, maxWP: 71, alive: true, asleep: 3, sp: { atk: 2 }, lives: 1 };
  const base = newRun(4);
  const clean = structuredClone(base);
  clean.combat = { foes: [{ ...vampireFoe }], type: "Walking Dead", round: 1, target: 0, spellOpen: false, tracked: false };
  const dirty = structuredClone(base);
  dirty.combat = { foes: [{ ...vampireFoe, dozing: true }], type: "Walking Dead", round: 1, target: 0, spellOpen: false, tracked: false };
  for (const cmp of [movementComparable, combatComparable, economyComparable]) {
    assert.deepStrictEqual(cmp(dirty), cmp(clean), `${cmp.name} must strip foe.dozing down to parity`);
    assert.equal(cmp(dirty).combat.foes[0].asleep, 3, `${cmp.name} still compares the sleep itself`);
  }
});

// ---------------------------------------------------------------------------
// The surfaces say what the engine does: the Oracle and the rail (and the fold).
// ---------------------------------------------------------------------------

test("narration: Doze, the nobody-slept line, the wake line, Ice's cast line and Stun's hold read right on the Oracle and the rail", () => {
  assert.match(EVENT_NARRATION.dozed({ target: "Orc", rounds: 3 }), /Orc dozes off for 3 rounds\. A hit will wake it\./);
  assert.match(EVENT_NARRATION.dozed({ target: "Orc", rounds: 1, by: "Ada" }), /Ada's Doze: Orc dozes off for 1 round\./);
  assert.match(EVENT_NARRATION.dozeFailed({ spell: "Doze" }), /Nobody dozes off\./);
  assert.match(EVENT_NARRATION.foeWoke({ target: "Orc" }), /Orc wakes up\./);
  assert.match(EVENT_NARRATION.foeWoke({ target: "Orc", by: "Ada" }), /courtesy of Ada/);
  assert.match(EVENT_NARRATION.iceCast({ spell: "Ice", foes: 3 }), /Ice sweeps the room\..*d10 plus level².*no roll to hit/);
  assert.match(EVENT_NARRATION.controlHeld({ target: "Orc", kind: "stunned", rounds: 3, source: "Stun" }), /Orc is stunned for 3 rounds\..*does not end it/);
  assert.match(EVENT_NARRATION.foeStillHeld({ name: "Orc", kind: "stunned", left: 2 }), /still stunned/);
  assert.match(LINE_FOR.dozed({ target: "Orc", rounds: 3 }).text, /Orc dozes off, 3 rounds\. A hit wakes it\./);
  assert.match(LINE_FOR.dozed({ target: "Orc", rounds: 3, by: "Ada" }).text, /^Ada's Doze: /);
  assert.equal(LINE_FOR.dozeFailed({}).text, "Nobody dozes off.");
  assert.equal(LINE_FOR.foeWoke({ target: "Orc" }).text, "Orc wakes up.");
  assert.match(LINE_FOR.iceCast({ spell: "Ice" }).text, /Ice sweeps the room/);
  assert.match(LINE_FOR.controlHeld({ target: "Orc", kind: "stunned", rounds: 1 }).text, /Orc stunned for 1 round; a hit will not end it\./);
  for (const type of ["dozed", "dozeFailed", "foeWoke", "iceCast", "controlHeld"]) {
    assert.ok(EVENT_NARRATION[type]({ type }).trim().length > 0, `${type} survives a bare payload (Oracle)`);
    assert.ok(LINE_FOR[type]({ type }).text.trim().length > 0, `${type} survives a bare payload (rail)`);
  }
});

test("narration: the retired events (stunned count, iceApplied, frozenSolid) have no Oracle or rail builder any more", () => {
  for (const type of ["stunned", "iceApplied", "frozenSolid"]) {
    assert.equal(EVENT_NARRATION[type], undefined, `${type} (Oracle)`);
    assert.equal(LINE_FOR[type], undefined, `${type} (rail)`);
  }
});

test("narration: a failed resist folds behind Stun's own hold, so the rail shows the hold once", () => {
  const lines = linesForAction("castSpell", [
    { type: "resistFailed", target: "Orc", spell: "Stun", roll: 3, atLeast: 16, dieN: 20, intel: 10, faces: 5 },
    { type: "controlHeld", target: "Orc", kind: "stunned", rounds: 2, source: "Stun" },
  ], {});
  assert.deepEqual(lines.map((l) => l.text), ["Orc stunned for 2 rounds; a hit will not end it."]);
});

const stripComments = (src) => src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");

test("source guards: castSpell has no dot branch and calls the three shared tails; foeTurn has no ice payoff and no 'then heavy' hand-off; allyCast calls the same tails", () => {
  const magic = stripComments(fs.readFileSync("engine/magic.js", "utf8"));
  assert.equal(magic.includes('sp.kind === "dot"'), false);
  for (const token of ["dozeFoes(", "stunFoe(", "iceStorm("]) assert.ok(magic.includes(token), `magic.js calls ${token}`);
  const combat = fs.readFileSync("engine/combat.js", "utf8").replace(/\r\n/g, "\n");
  const turn = stripComments(combat.slice(combat.indexOf("export function foeTurn("), combat.indexOf("export function foeTurn(") + 40000));
  assert.equal(turn.includes('by === "ice"'), false, "no ice payoff in foeTurn");
  assert.equal(turn.includes('then === "heavy"'), false, "no then-heavy hand-off in foeTurn");
  assert.equal(turn.includes("iceApplied"), false);
  const ally = stripComments(combat.slice(combat.indexOf("function allyCast("), combat.indexOf("export function downMember(")));
  for (const token of ["dozeFoes(", "stunFoe(", "iceStorm("]) assert.ok(ally.includes(token), `allyCast calls ${token}`);
  const scroll = stripComments(fs.readFileSync("engine/scrollFumble.js", "utf8"));
  assert.equal(/entry\.then/.test(scroll), false, "resolveHarmful no longer passes `then` through");
  assert.equal(combat.includes('"iceApplied"'), false);
  assert.equal(magic.includes("iceApplied"), false);
});
