// test/unit/control-slate-spells.test.js
//
// Phase 90 plan 08 (SPELL-10): the control spells of the accepted slate, with
// the school stretch of Q6 A (+1 round per school bonus point on a round-timed
// new spell).
//   - Stop Time (Special 3): every live foe rolls the one depth-rising resist;
//     each that fails is held kind "time" for 2 rounds + the caster's Special
//     bonus. It takes no turns, a blow does not end or restart it, strikes land
//     on at least the top five faces, a longer live hold stands, no main draw.
//   - Senseless (Illusion 2): the picked foe swings at the first OTHER live foe
//     (C.foes order) for d4 rounds + the Illusion bonus; with nobody else it
//     swings at the air; never at the hero's side.
//   - Duplicate Foe (Illusion 5): the same system aimed at itself, d4+1 rounds.
// The misdirected turn (engine/combat.js#resolveMisdirectedTurn) draws a to-hit
// then, on a hit, the damage dice, exactly where the foe's own swing would; its
// to-hit has no body's defences; blind caps it to the top face and forbids a
// crit; Weaken, Shrink and Hamstring halve it; `left` counts only the turns the
// foe actually takes; a kill pays the hero (killFoe).
//
// Every resist is the ONE depth-rising resist (derived stream); its outcome is
// forced by searching for a `state.acts` whose real roll gives the wanted result
// (the doze-stun-ice.test.js pattern), the main-rng cursor fixed at 0.

import test from "node:test";
import assert from "node:assert/strict";

import { castSpell, readScroll } from "../../engine/magic.js";
import { foeTurn, stopTime, misdirectFoe, holdFoe, HERO_OUT_MAX } from "../../engine/combat.js";
import { damageFoe } from "../../engine/foeDamage.js";
import { resolveScrollFumble } from "../../engine/scrollFumble.js";
import { foeRisingResistCheck, targetStrikeFaces, spellEffectRounds, foeSwingVsFoe, foeDie, canCast } from "../../engine/derived.js";
import { atLeastFor } from "../../engine/dice.js";
import { SPELLS, SCROLL_FUMBLE } from "../../content/index.js";
import { GW, GH } from "../../engine/maze.js";
import fs from "node:fs";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { LINE_FOR, linesForAction } from "../../src/browser/narrationLines.js";
import { COMBAT_MENU_COPY } from "../../src/browser/combatMenu.js";

const IDX = Object.fromEntries(SPELLS.map((sp, i) => [sp.n, i]));
const SP = Object.fromEntries(SPELLS.map((sp) => [sp.n, sp]));
const ONES = (n) => new Array(n).fill(1);

/** fakeRng(seq) — `.d()` pops the next raw value (a raw 1 is the best face of a
 * roll-high check); the cursor (`getState`) is fixed at 0 so a forced resist
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
    cls: "Magic User", sub: "Illusionist", race: "Human", level: 5, sp: 0,
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

function spellState(spellName, nFoes, { sub = "Illusionist", target = 0, foeOver = {}, level = 5, depth = 1 } = {}) {
  return {
    version: 1, seed: 1, rngState: 1, acts: 0,
    c: hero({ sub, level, grimoire: spellName ? [spellName] : [] }),
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

const failActs = (source, nFoes, by) => findActs(Array.from({ length: nFoes }, (_, i) => [source, i, false, by]));

// ---------------------------------------------------------------------------
// The rows
// ---------------------------------------------------------------------------

test("rows: the last three SPELLS rows are Stop Time, Senseless, Duplicate Foe, after Speed of Sound, with the ruled level, school, flags and numbers", () => {
  // Phase 90 plan 09 appended Door Illusion, Chameleon Tongue and Size of the Behemoth after Duplicate Foe.
  const tail = SPELLS.slice(-7, -3).map((sp) => sp.n);
  assert.deepEqual(tail, ["Speed of Sound", "Stop Time", "Senseless", "Duplicate Foe"]);
  const stop = SP["Stop Time"];
  assert.equal(stop.lvl, 3);
  assert.equal(stop.s, "special");
  assert.equal(stop.kind, "timestop");
  assert.equal(stop.holdRounds, 2);
  const sen = SP.Senseless;
  assert.equal(sen.lvl, 2);
  assert.equal(sen.s, "illusion");
  assert.equal(sen.kind, "misdirect");
  assert.equal(sen.at, "friends");
  assert.deepEqual(sen.rounds, { n: 1, sides: 4, bonus: 0 });
  const dup = SP["Duplicate Foe"];
  assert.equal(dup.lvl, 5);
  assert.equal(dup.s, "illusion");
  assert.equal(dup.kind, "misdirect");
  assert.equal(dup.at, "self");
  assert.deepEqual(dup.rounds, { n: 1, sides: 4, bonus: 1 });
  for (const sp of [stop, sen, dup]) {
    assert.equal(sp.combatOnly, true, `${sp.n} is combat-only`);
    assert.equal(sp.stretch, "rounds", `${sp.n} stretches by rounds`);
    assert.equal(sp.roll, "derived", `${sp.n} joins the pools through a derived stream`);
    assert.equal(sp.niche, "control");
    assert.ok(sp.txt.startsWith("control · "), `${sp.n}: text starts with its niche`);
    assert.match(sp.txt, /\+1 round per school bonus point/, `${sp.n}: text states the stretch`);
    assert.match(sp.txt, /resist/, `${sp.n}: text states the resist`);
  }
});

test("the school stretch: Stop Time is 2 rounds for a Wizard or Apprentice, 3 for a Sorcerer or Summoner, 6 for an Illusionist; a non-caster's scroll reads the base", () => {
  const rounds = (sub) => spellEffectRounds(sub, SP["Stop Time"], SP["Stop Time"].holdRounds);
  assert.equal(rounds("Wizard"), 2);
  assert.equal(rounds("Apprentice"), 2);
  assert.equal(rounds("Sorcerer"), 3);
  assert.equal(rounds("Summoner"), 3);
  assert.equal(rounds("Illusionist"), 6);
  assert.equal(rounds("Soldier"), 2, "no chart row, no stretch");
  // The chart gives the Illusion school +1 to the Illusionist and +0 to the Apprentice (Phase 91.1 plan 03 (V19 B, 2026-10-01): was +0 for both).
  assert.equal(spellEffectRounds("Illusionist", SP.Senseless, 3), 4);
  assert.equal(spellEffectRounds("Apprentice", SP["Duplicate Foe"], 4), 4);
});

test("the school gates hold with no extra code: Stop Time reaches the Special sub-classes, Senseless and Duplicate Foe only the Illusionist and Apprentice", () => {
  const can = (sub, name) => canCast({ c: { sub, level: 5, grimoire: [name] } }, SP[name]);
  for (const sub of ["Wizard", "Sorcerer", "Illusionist", "Summoner", "Apprentice"]) assert.equal(can(sub, "Stop Time"), true, `${sub} casts Stop Time`);
  for (const sub of ["Warlock", "Court Mage", "Cleric"]) assert.equal(can(sub, "Stop Time"), false, `${sub} never casts Stop Time`);
  for (const name of ["Senseless", "Duplicate Foe"]) {
    for (const sub of ["Illusionist", "Apprentice"]) assert.equal(can(sub, name), true, `${sub} casts ${name}`);
    for (const sub of ["Wizard", "Warlock", "Sorcerer", "Court Mage", "Cleric", "Summoner"]) assert.equal(can(sub, name), false, `${sub} never casts ${name}`);
  }
});

// ---------------------------------------------------------------------------
// Stop Time
// ---------------------------------------------------------------------------

test("Stop Time: with three foes (one resisting) a Wizard holds the two that fail kind time for 2 rounds, an Illusionist for 6; no main-rng draw", () => {
  const s = spellState("Stop Time", 3, { sub: "Wizard" });
  s.acts = findActs([["Stop Time", 0, false], ["Stop Time", 1, true], ["Stop Time", 2, false]]);
  const rng = fakeRng([]);
  const ev = [];
  const held = stopTime(s, SP["Stop Time"], rng, ev, { sub: "Wizard" });
  assert.equal(held, 2);
  assert.equal(rng.count(), 0, "the main cursor does not move");
  const [f1, f2, f3] = s.combat.foes;
  assert.deepEqual(f1.held, { kind: "time", left: 2 });
  assert.equal(f2.held, undefined, "the resister is not held");
  assert.deepEqual(f3.held, { kind: "time", left: 2 });
  assert.deepEqual(ev.filter((e) => e.type === "timeStopped"), [{ type: "timeStopped", count: 2, rounds: 2 }]);
  assert.deepEqual(ev.filter(isResistLine).map((e) => `${e.type}:${e.target}`), ["resistFailed:F1", "spellResisted:F2", "resistFailed:F3"], "C.foes order");
  assert.deepEqual(ev.filter((e) => e.type === "controlHeld").map((e) => [e.target, e.kind, e.rounds]), [["F1", "time", 2], ["F3", "time", 2]]);

  const s2 = spellState("Stop Time", 2, { sub: "Illusionist" });
  s2.acts = failActs("Stop Time", 2);
  stopTime(s2, SP["Stop Time"], fakeRng([]), [], { sub: "Illusionist" });
  assert.deepEqual(s2.combat.foes.map((f) => f.held.left), [6, 6]);
});

test("Stop Time: a stopped foe skips its turns and a blow does not end or restart the stop; strikes against it land on at least the top five faces", () => {
  const s = spellState("Stop Time", 1);
  s.acts = failActs("Stop Time", 1);
  const f = s.combat.foes[0];
  stopTime(s, SP["Stop Time"], fakeRng([]), [], { sub: "Wizard" });
  assert.deepEqual(f.held, { kind: "time", left: 2 });
  assert.equal(targetStrikeFaces(s.c, f, 1), 5, "a stopped foe is hit as a sleeper is");
  // round 1: held left 2 -> 1, a hero blow lands, round 2: the hold breaks
  const ev1 = foeTurn(s, fakeRng([]), []);
  assert.deepEqual(ev1.filter((e) => e.type === "foeStillHeld").map((e) => [e.name, e.kind, e.left]), [["F1", "time", 1]]);
  damageFoe(s, f, 5, { kind: "melee", crit: false }, fakeRng([]), []);
  assert.deepEqual(f.held, { kind: "time", left: 1 }, "a hit does not end or restart the hold");
  assert.equal(s.c.wp, 60, "the stopped foe never swung");
  const ev2 = foeTurn(s, fakeRng([]), []);
  assert.deepEqual(ev2.filter((e) => e.type === "foeHoldBroken").map((e) => [e.name, e.kind]), [["F1", "time"]]);
  assert.equal(f.held, undefined);
});

test("Stop Time edge (adjacency): a foe already stunned longer keeps the longer hold; a shorter hold is replaced", () => {
  const s = spellState("Stop Time", 2);
  s.acts = failActs("Stop Time", 2);
  const [f1, f2] = s.combat.foes;
  f1.held = { kind: "stunned", left: 4 };
  f2.held = { kind: "frozen", left: 1 };
  const ev = [];
  stopTime(s, SP["Stop Time"], fakeRng([]), ev, { sub: "Wizard" });
  assert.deepEqual(f1.held, { kind: "stunned", left: 4 }, "the longer Stun stands");
  assert.deepEqual(f2.held, { kind: "time", left: 2 }, "the shorter Freeze is replaced");
  assert.deepEqual(ev.filter((e) => e.type === "controlHeld").map((e) => [e.target, e.kind, e.rounds]), [["F1", "stunned", 4], ["F2", "time", 2]], "each line reports the hold in force");
});

test("Stop Time edge (empty): every foe resists, nobody is held, and one line says so", () => {
  const s = spellState("Stop Time", 2);
  s.acts = findActs([["Stop Time", 0, true], ["Stop Time", 1, true]]);
  const ev = [];
  const held = stopTime(s, SP["Stop Time"], fakeRng([]), ev, { sub: "Wizard" });
  assert.equal(held, 0);
  assert.equal(s.combat.foes.some((f) => f.held), false);
  assert.deepEqual(ev.filter((e) => e.type === "timeStopped"), [{ type: "timeStopped", count: 0, rounds: 2 }]);
  assert.equal(ev.filter((e) => e.type === "controlHeld").length, 0);
});

test("Stop Time: a dead foe is never rolled for, and a Joiner's cast names its caster", () => {
  const s = spellState("Stop Time", 2);
  s.combat.foes[0].alive = false;
  s.acts = findActs([["Stop Time", 1, false, "Joiner Jo"]]);
  const ev = [];
  stopTime(s, SP["Stop Time"], fakeRng([]), ev, { by: "Joiner Jo", sub: "Wizard" });
  assert.equal(s.combat.foes[0].held, undefined);
  assert.deepEqual(ev.filter((e) => e.type === "timeStopped"), [{ type: "timeStopped", count: 1, rounds: 2, by: "Joiner Jo" }]);
});

test("Stop Time through castSpell: the cast spends a charge, holds the failers (one foe visit already spent) and draws nothing before the foes' own turn", () => {
  const s = spellState("Stop Time", 2, { sub: "Wizard" });
  s.acts = failActs("Stop Time", 2);
  const ev = castSpell(s, IDX["Stop Time"], fakeRng(ONES(80)), []);
  assert.equal(s.c.spellsUsed, 1);
  assert.equal(ev.filter((e) => e.type === "timeStopped").length, 1);
  assert.deepEqual(s.combat.foes.map((f) => f.held.left), [1, 1], "2 rounds, one foe visit spent this dispatch");
  assert.equal(s.c.wp, 60, "nothing swung at the hero");
});

// ---------------------------------------------------------------------------
// Senseless and Duplicate Foe: the cast
// ---------------------------------------------------------------------------

test("Senseless: a target that fails its resist gets misdirect { at: friends, left: d4 }; the one main-rng draw is the duration die", () => {
  const s = spellState("Senseless", 2, { target: 0 });
  s.acts = failActs("Senseless", 1);
  const rng = fakeRng([3]);
  const ev = [];
  const rounds = misdirectFoe(s, s.combat.foes[0], SP.Senseless, rng, ev, { sub: "Illusionist" });
  assert.equal(rounds, 4, "d4 (3) + the Illusionist's Illusion bonus 1 (Phase 91.1 plan 03 (V19 B, 2026-10-01))");
  assert.equal(rng.count(), 1, "one main draw: the duration die");
  assert.deepEqual(s.combat.foes[0].misdirect, { at: "friends", left: 4 });
  assert.deepEqual(ev, [{ type: "foeMisdirected", target: "F1", at: "friends", rounds: 4 }]);
});

// Phase 91.1 plan 03 (V19 B, 2026-10-01): the Illusionist adds its Illusion bonus (1) to the d4+1, so the cast below lasts 6.
test("Duplicate Foe: d4+1 rounds, aimed at itself", () => {
  const s = spellState("Duplicate Foe", 1);
  const ev = [];
  misdirectFoe(s, s.combat.foes[0], SP["Duplicate Foe"], fakeRng([4]), ev, {});
  assert.deepEqual(s.combat.foes[0].misdirect, { at: "self", left: 6 });
  assert.deepEqual(ev.map((e) => [e.type, e.at, e.rounds]), [["foeMisdirected", "self", 6]]);
});

test("Senseless through castSpell: the picked foe's one resist is rolled up front; a resist ends the cast with no duration draw and no misdirect", () => {
  const s = spellState("Senseless", 2, { target: 1 });
  s.acts = findActs([["Senseless", 1, true]]);
  const rng = fakeRng(ONES(40));
  const ev = castSpell(s, IDX.Senseless, rng, []);
  assert.equal(ev.filter((e) => e.type === "spellResisted").length, 1);
  assert.equal(ev.some((e) => e.type === "foeMisdirected"), false);
  assert.equal(s.combat.foes[1].misdirect, undefined);
  assert.equal(s.combat.foes[0].misdirect, undefined);
});

test("Senseless through castSpell: it lands on the picked foe, which spends its first misdirected turn this very dispatch (left counts down)", () => {
  const s = spellState("Senseless", 2, { target: 0 });
  s.combat.foes[1].asleep = 9;
  s.acts = failActs("Senseless", 1);
  const ev = castSpell(s, IDX.Senseless, fakeRng([3, ...ONES(40)]), []);
  assert.equal(ev.filter((e) => e.type === "foeMisdirected").length, 1);
  assert.deepEqual(s.combat.foes[0].misdirect, { at: "friends", left: 3 }, "d4 3 + 1 (Illusionist), one turn taken");
  assert.equal(ev.filter((e) => e.type === "foeMisdirectedHit").length, 1);
  assert.equal(s.c.wp, 60, "the hero was never swung at");
});

test("a Joiner's cast rolls the target's resist inside misdirectFoe (the hero's is the up-front one); a resist stops it with no draw", () => {
  const s = spellState("Senseless", 1);
  s.acts = findActs([["Senseless", 0, true, "Joiner Jo"]]);
  const rng = fakeRng([]);
  const ev = [];
  assert.equal(misdirectFoe(s, s.combat.foes[0], SP.Senseless, rng, ev, { by: "Joiner Jo", sub: "Apprentice" }), 0);
  assert.equal(rng.count(), 0);
  assert.equal(s.combat.foes[0].misdirect, undefined);
  assert.equal(ev.filter((e) => e.type === "spellResisted" && e.by === "Joiner Jo").length, 1);
  const s2 = spellState("Senseless", 1);
  s2.acts = failActs("Senseless", 1, "Joiner Jo");
  const ev2 = [];
  misdirectFoe(s2, s2.combat.foes[0], SP.Senseless, fakeRng([2]), ev2, { by: "Joiner Jo", sub: "Apprentice" });
  assert.deepEqual(ev2.filter((e) => e.type === "foeMisdirected"), [{ type: "foeMisdirected", target: "F1", at: "friends", rounds: 2, by: "Joiner Jo" }]);
});

test("a new misdirect never shortens a longer live one (the longer record, its aim and its rounds, stands)", () => {
  const s = spellState("Duplicate Foe", 1);
  const f = s.combat.foes[0];
  f.misdirect = { at: "self", left: 5 };
  const ev = [];
  misdirectFoe(s, f, SP.Senseless, fakeRng([2]), ev, { sub: "Illusionist" });
  assert.deepEqual(f.misdirect, { at: "self", left: 5 });
  assert.deepEqual(ev, [{ type: "foeMisdirected", target: "F1", at: "self", rounds: 5 }]);
  misdirectFoe(s, f, SP.Senseless, fakeRng([3]), [], { sub: "Illusionist" });
  assert.deepEqual(f.misdirect, { at: "self", left: 5 }, "a d4 of 3 (+1 for the Illusionist = 4) is still shorter than 5");
  f.misdirect = { at: "self", left: 1 };
  misdirectFoe(s, f, SP.Senseless, fakeRng([3]), [], { sub: "Illusionist" });
  assert.deepEqual(f.misdirect, { at: "friends", left: 4 }, "a longer new cast replaces a shorter one");
});

// ---------------------------------------------------------------------------
// The misdirected turn
// ---------------------------------------------------------------------------

/** a two-foe fight where F1 is misdirected and F2 sleeps (so F2's own turn is a skip). */
function twoFoeFight({ at = "friends", left = 3, f1 = {}, f2 = {} } = {}) {
  const s = spellState(null, 2, { sub: "Illusionist" });
  Object.assign(s.combat.foes[0], f1, { misdirect: { at, left } });
  Object.assign(s.combat.foes[1], { asleep: 9 }, f2);
  return s;
}

test("Senseless edge (adjacency): with two foes the target hits the OTHER; its swing draws a to-hit then the damage, two main draws, and the hero's side is untouched", () => {
  const s = twoFoeFight();
  s.combat.allies = [{ name: "Joiner Jo", partyIdx: 0, wp: 20, maxWP: 20 }];
  s.party = [{ race: "Human", cls: "Fighter", sub: "Soldier", level: 1, wp: 20, maxWP: 20 }];
  const rng = fakeRng([1, 3]);
  const ev = foeTurn(s, rng, []);
  assert.equal(rng.count(), 2, "the foe's own swing's draws, in its own positions: to-hit then damage");
  const hit = ev.find((e) => e.type === "foeMisdirectedHit");
  assert.ok(hit, "a misdirected hit line");
  assert.equal(hit.name, "F1");
  assert.equal(hit.target, "F2");
  assert.equal(hit.self, false);
  assert.ok(hit.dmg > 0);
  assert.equal(s.combat.foes[1].wp, 30 - hit.dmg);
  assert.equal(s.combat.foes[0].wp, 30, "it did not hurt itself");
  assert.equal(s.c.wp, 60, "the hero was never swung at");
  assert.equal(s.combat.allies[0].wp, 20, "a Joiner was never swung at");
  assert.equal(ev.some((e) => e.type === "foeMissed" || e.type === "struck"), false);
  assert.deepEqual(s.combat.foes[0].misdirect, { at: "friends", left: 2 });
});

test("Senseless: a miss pushes foeMisdirectedMiss, draws only the to-hit, and the damage never lands", () => {
  const s = twoFoeFight();
  const dieN = foeDie(null, s.combat.foes[0]);
  const rng = fakeRng([dieN]); // the worst face
  const ev = foeTurn(s, rng, []);
  assert.equal(rng.count(), 1);
  const miss = ev.find((e) => e.type === "foeMisdirectedMiss");
  assert.ok(miss);
  assert.equal(miss.target, "F2");
  assert.equal(miss.self, false);
  assert.equal(miss.roll, 1);
  assert.equal(miss.dieN, dieN);
  assert.equal(s.combat.foes[1].wp, 30);
});

test("the misdirected to-hit has no body's defences: the foe's own die against 5 + FOE_ACCURACY, and a blind foe's top face only", () => {
  const s = twoFoeFight();
  const f = s.combat.foes[0];
  const { faces, mods } = foeSwingVsFoe(s, f);
  assert.equal(faces, 5);
  assert.deepEqual(mods, []);
  f.blind = true;
  assert.deepEqual(foeSwingVsFoe(s, f), { faces: 1, mods: [{ name: "blind", delta: -4 }] });
  // an Acrobat or a Guard hero changes nothing: the victim is a monster
  s.c.sub = "Acrobat";
  assert.equal(foeSwingVsFoe(s, { ...f, blind: false }).faces, 5);
  // the swing's winning faces are exactly what rollCheck reads
  const dieN = foeDie(null, f);
  assert.equal(atLeastFor(5, dieN), dieN - 4);
});

test("Senseless: a blind misdirected foe hits only on its top face and never crits", () => {
  const dieN = foeDie(null, foe("probe"));
  const near = twoFoeFight({ f1: { blind: true } });
  const ev1 = foeTurn(near, fakeRng([2, 3]), []);
  assert.equal(ev1.some((e) => e.type === "foeMisdirectedHit"), false, "the second-best face misses a blind foe");
  assert.equal(ev1.filter((e) => e.type === "foeMisdirectedMiss").length, 1);
  const top = twoFoeFight({ f1: { blind: true } });
  const ev2 = foeTurn(top, fakeRng([1, 3]), []);
  const hit = ev2.find((e) => e.type === "foeMisdirectedHit");
  assert.ok(hit, "the top face hits");
  assert.equal(hit.roll, dieN);
  assert.equal(hit.crit, undefined, "and is no crit");
  const sighted = twoFoeFight();
  const ev3 = foeTurn(sighted, fakeRng([1, 3]), []);
  const crit = ev3.find((e) => e.type === "foeMisdirectedHit");
  assert.equal(crit.crit, true, "a sighted top face crits");
  assert.ok(crit.dmg > hit.dmg, "the crit doubles the dice");
});

test("Senseless: Weaken, Shrink and Hamstring each halve a misdirected blow like any of its blows (ceil, independently)", () => {
  const dmgFor = (setup) => {
    const s = twoFoeFight();
    setup(s);
    const ev = foeTurn(s, fakeRng([2, 4]), []);
    return ev.find((e) => e.type === "foeMisdirectedHit").dmg;
  };
  const plain = dmgFor(() => {});
  assert.ok(plain >= 4);
  assert.equal(dmgFor((s) => { s.combat.weakened = true; }), Math.ceil(plain / 2), "Weaken");
  assert.equal(dmgFor((s) => { s.combat.foes[0].shrunk = true; }), Math.ceil(plain / 2), "Shrink");
  assert.equal(dmgFor((s) => { s.combat.foes[0].hamstrung = true; }), Math.ceil(plain / 2), "Hamstring");
  assert.equal(dmgFor((s) => { s.combat.weakened = true; s.combat.foes[0].shrunk = true; }), Math.ceil(Math.ceil(plain / 2) / 2), "both halve, independently");
});

test("Senseless edge (adjacency): when the other foe dies, the next turn swings at the air; the kill line comes after the blow's line and pays the hero", () => {
  const s = twoFoeFight({ f2: { wp: 2, maxWP: 30 } });
  s.combat.foes[1].asleep = 0;
  s.combat.foes[1].alive = true;
  const ev = foeTurn(s, fakeRng([1, 3, ...ONES(80)]), []);
  const types = ev.map((e) => e.type);
  assert.ok(types.indexOf("foeMisdirectedHit") >= 0 && types.indexOf("foeKilled") > types.indexOf("foeMisdirectedHit"), "the blow's line comes before the victim's foeKilled");
  assert.equal(s.combat.foes[1].alive, false);
  assert.equal(s.c.kills, 1);
  assert.ok(s.c.sp > 0, "the hero gains its experience");
  const ev2 = foeTurn(s, fakeRng(ONES(20)), []);
  assert.equal(ev2.filter((e) => e.type === "foeSwingsAtAir").length, 1);
  assert.equal(ev2.some((e) => e.type === "foeMisdirectedHit"), false);
  assert.equal(s.c.wp, 60);
  assert.deepEqual(s.combat.foes[0].misdirect, { at: "friends", left: 1 });
});

test("Senseless edge (empty): on a lone foe the turn is lost with a swing at the air, no draw, no damage, and left still counts down", () => {
  const s = spellState(null, 1);
  s.combat.foes[0].misdirect = { at: "friends", left: 2 };
  const rng = fakeRng([]);
  const ev = foeTurn(s, rng, []);
  assert.equal(rng.count(), 0);
  assert.deepEqual(ev.filter((e) => e.type === "foeSwingsAtAir"), [{ type: "foeSwingsAtAir", name: "F1" }]);
  assert.equal(s.c.wp, 60, "it never swings at the hero's side");
  assert.deepEqual(s.combat.foes[0].misdirect, { at: "friends", left: 1 });
  const ev2 = foeTurn(s, rng, []);
  assert.deepEqual(ev2.filter((e) => e.type === "foeMisdirectEnded"), [{ type: "foeMisdirectEnded", name: "F1", at: "friends" }]);
  assert.equal(s.combat.foes[0].misdirect, undefined);
  // after the spell ends it swings at the hero again (a normal turn: draws)
  const ev3 = foeTurn(s, fakeRng(ONES(40)), []);
  assert.equal(ev3.some((e) => e.type === "foeSwingsAtAir"), false);
  assert.equal(ev3.some((e) => e.type === "foeMisdirectedHit" || e.type === "foeMisdirectedMiss"), false, "a normal turn resumes: no misdirected line");
  assert.ok(ev3.length > 0, "and the foe swings at the hero's side again");
});

test("Senseless: a hit on the misdirected foe does not end the spell", () => {
  const s = twoFoeFight();
  damageFoe(s, s.combat.foes[0], 4, { kind: "melee", crit: false }, fakeRng([]), []);
  assert.deepEqual(s.combat.foes[0].misdirect, { at: "friends", left: 3 });
});

test("counting: `left` counts only the turns the foe actually takes; a held or sleeping turn spends none", () => {
  const held = twoFoeFight({ left: 2 });
  held.combat.foes[0].held = { kind: "time", left: 2 };
  const ev = foeTurn(held, fakeRng([]), []);
  assert.deepEqual(held.combat.foes[0].misdirect, { at: "friends", left: 2 }, "held: unchanged");
  assert.equal(ev.some((e) => e.type === "foeMisdirectedHit" || e.type === "foeSwingsAtAir"), false);
  const asleep = twoFoeFight({ left: 2, f1: { asleep: 2 } });
  foeTurn(asleep, fakeRng([]), []);
  assert.deepEqual(asleep.combat.foes[0].misdirect, { at: "friends", left: 2 }, "asleep: unchanged");
  const stunned = twoFoeFight({ left: 2, f1: { stunned: true } });
  foeTurn(stunned, fakeRng([]), []);
  assert.deepEqual(stunned.combat.foes[0].misdirect, { at: "friends", left: 2 }, "stunned: unchanged");
  const live = twoFoeFight({ left: 1 });
  const ev2 = foeTurn(live, fakeRng([2, 3]), []);
  assert.equal(live.combat.foes[0].misdirect, undefined, "at 0 the spell ends");
  assert.deepEqual(ev2.filter((e) => e.type === "foeMisdirectEnded"), [{ type: "foeMisdirectEnded", name: "F1", at: "friends" }]);
});

test("Duplicate Foe: every swing lands on itself at its own damage, the hero's side is left alone", () => {
  const s = spellState(null, 1);
  const f = s.combat.foes[0];
  f.misdirect = { at: "self", left: 3 };
  const rng = fakeRng([1, 3]);
  const ev = foeTurn(s, rng, []);
  const hit = ev.find((e) => e.type === "foeMisdirectedHit");
  assert.equal(hit.self, true);
  assert.equal(hit.target, "F1");
  assert.equal(f.wp, 30 - hit.dmg);
  assert.equal(s.c.wp, 60);
  assert.equal(rng.count(), 2);
});

test("Duplicate Foe edge (adjacency): a two-attack foe lands both swings on itself", () => {
  const s = spellState(null, 2);
  const f = s.combat.foes[0];
  f.sp = { atk: 2 };
  f.misdirect = { at: "self", left: 2 };
  s.combat.foes[1].asleep = 9;
  const rng = fakeRng([1, 3, 1, 3]);
  const ev = foeTurn(s, rng, []);
  const hits = ev.filter((e) => e.type === "foeMisdirectedHit");
  assert.equal(hits.length, 2);
  assert.equal(f.wp, 30 - hits[0].dmg - hits[1].dmg);
  assert.equal(s.combat.foes[1].wp, 30, "the neighbour is left alone too");
  assert.equal(rng.count(), 4);
});

test("Duplicate Foe edge (empty): a foe that kills itself pays the hero the kill, and does not swing again", () => {
  const s = spellState(null, 2);
  const f = s.combat.foes[0];
  f.sp = { atk: 2 };
  f.wp = 3;
  f.misdirect = { at: "self", left: 4 };
  s.combat.foes[1].asleep = 9;
  const ev = foeTurn(s, fakeRng([1, 3, ...ONES(80)]), []);
  const types = ev.map((e) => e.type);
  assert.equal(f.alive, false);
  assert.ok(types.indexOf("foeKilled") > types.indexOf("foeMisdirectedHit"));
  assert.equal(ev.filter((e) => e.type === "foeMisdirectedHit").length, 1, "dead, it takes no second swing");
  assert.equal(s.c.kills, 1);
  assert.ok(s.c.sp > 0);
});

test("a misdirected caster foe does not cast: the whole turn is misdirected, ahead of the ability gate", () => {
  const s = spellState(null, 1);
  const f = s.combat.foes[0];
  f.abilities = ["drakeBreath"];
  f.misdirect = { at: "self", left: 2 };
  const ev = foeTurn(s, fakeRng([1, 3]), []);
  assert.equal(ev.some((e) => e.type === "foeCast"), false);
  assert.equal(ev.filter((e) => e.type === "foeMisdirectedHit").length, 1);
});

test("a misdirected blow draws exactly what the foe's own normal swing turn would (to-hit, then damage)", () => {
  // a normal turn on the hero: one swing = pickFoeTarget (no draw solo), to-hit, damage
  const normal = spellState(null, 1);
  const nrng = fakeRng([1, 3, ...ONES(20)]);
  foeTurn(normal, nrng, []);
  const mis = spellState(null, 1);
  mis.combat.foes[0].misdirect = { at: "self", left: 2 };
  const mrng = fakeRng([1, 3, ...ONES(20)]);
  foeTurn(mis, mrng, []);
  assert.equal(mrng.count(), 2, "to-hit then damage");
  assert.ok(nrng.count() >= 2, "the normal swing draws the same two first (then the hero's own defences, if any)");
});

// ---------------------------------------------------------------------------
// Scroll fumbles and the scroll pool
// ---------------------------------------------------------------------------

test("fumbles: Stop Time costs the reader exactly two turns (a stopped out); Senseless and Duplicate Foe a maddened out (d4, d4+1 clamped to the cap)", () => {
  assert.deepEqual(SCROLL_FUMBLE["Stop Time"], { side: "harmful", effect: "out", kind: "stopped", rounds: { n: 0, sides: 1, bonus: 2 } });
  assert.equal(SCROLL_FUMBLE.Senseless.kind, "maddened");
  assert.deepEqual(SCROLL_FUMBLE.Senseless.rounds, { n: 1, sides: 4, bonus: 0 });
  assert.equal(SCROLL_FUMBLE["Duplicate Foe"].kind, "maddened");
  assert.deepEqual(SCROLL_FUMBLE["Duplicate Foe"].rounds, { n: 1, sides: 4, bonus: 1 });
  const s = spellState(null, 1, { sub: "Soldier" });
  const ev = resolveScrollFumble(s, SP["Stop Time"], fakeRng([]), fakeRng([]), []);
  assert.deepEqual(s.combat.heroOut, { kind: "stopped", left: 2, spell: "Stop Time" });
  assert.deepEqual(ev, [{ type: "fumbleOnReader", spell: "Stop Time", effect: "out", kind: "stopped", rounds: 2 }]);
  const s2 = spellState(null, 1);
  resolveScrollFumble(s2, SP["Duplicate Foe"], fakeRng([4]), fakeRng([]), []);
  assert.deepEqual(s2.combat.heroOut, { kind: "maddened", left: Math.min(5, HERO_OUT_MAX), spell: "Duplicate Foe" });
  const s3 = spellState(null, 1);
  resolveScrollFumble(s3, SP.Senseless, fakeRng([3]), fakeRng([]), []);
  assert.deepEqual(s3.combat.heroOut, { kind: "maddened", left: 3, spell: "Senseless" });
});

test("the scroll pool includes the three at their level (the pool is every SPELLS row up to depth + 1)", () => {
  // depth 2 (levels up to 3): Stop Time (3) and Senseless (2); Duplicate Foe (5) only from depth 4
  const poolNames = (depth) => SPELLS.filter((sp) => sp.lvl <= Math.min(5, depth + 1)).map((sp) => sp.n);
  assert.ok(poolNames(1).includes("Senseless"));
  assert.ok(!poolNames(1).includes("Stop Time"));
  assert.ok(poolNames(2).includes("Stop Time"));
  assert.ok(!poolNames(3).includes("Duplicate Foe"));
  assert.ok(poolNames(4).includes("Duplicate Foe"));
  // and a read really picks from the live table: a scroll reaching Stop Time free-casts it in a fight
  const s = spellState(null, 1, { sub: "Soldier" });
  s.c.scrolls = 1;
  s.c.cls = "Fighter";
  s.floor.depth = 2;
  const pick = (arr) => arr.find((sp) => sp.n === "Stop Time");
  const rng = { ...fakeRng(ONES(120)), pick };
  const ev = readScroll(s, rng, []);
  assert.ok(ev.some((e) => e.type === "scrollRead" && e.spell === "Stop Time") || ev.some((e) => e.type === "scrollCast" && e.spell === "Stop Time"), "the scroll names Stop Time");
});

// ---------------------------------------------------------------------------
// The surfaces: the Oracle, the rail twin, the fold, the hero chip
// ---------------------------------------------------------------------------

const NEW_TYPES = ["timeStopped", "foeMisdirected", "foeMisdirectedHit", "foeMisdirectedMiss", "foeSwingsAtAir", "foeMisdirectEnded"];

test("narration: every new event has an Oracle line and a rail twin, and a bare payload renders with no undefined", () => {
  for (const type of NEW_TYPES) {
    assert.equal(typeof EVENT_NARRATION[type], "function", `${type}: Oracle line`);
    assert.equal(typeof LINE_FOR[type], "function", `${type}: rail twin`);
    const oracle = EVENT_NARRATION[type]({ type });
    const rail = LINE_FOR[type]({ type }).text;
    for (const text of [oracle, rail]) {
      assert.ok(text.trim().length > 0, `${type} survives a bare payload`);
      assert.doesNotMatch(text, /undefined|NaN|\[object/, `${type}: ${text}`);
    }
  }
});

test("narration: Stop Time says the count and the rounds, and names a Joiner's cast; a count of zero says nobody stopped", () => {
  assert.match(EVENT_NARRATION.timeStopped({ count: 2, rounds: 6 }), /Time stops for 2 foes, 6 rounds: no turns for them.*Somewhere a clock is very upset about this\./);
  assert.match(EVENT_NARRATION.timeStopped({ count: 1, rounds: 2 }), /Time stops for 1 foe, 2 rounds/);
  assert.match(EVENT_NARRATION.timeStopped({ count: 1, rounds: 2, by: "Ada" }), /^<span class="hit">Ada's Stop Time: /);
  assert.match(EVENT_NARRATION.timeStopped({ count: 0, rounds: 2 }), /Time declines to stop for anyone\./);
  assert.equal(LINE_FOR.timeStopped({ count: 2, rounds: 6 }).text, "Time stops for 2 foes, 6 rounds.");
  assert.equal(LINE_FOR.timeStopped({ count: 0, rounds: 2 }).text, "Time declines to stop for anyone.");
  // each foe's own hold line, the count down and the end
  assert.match(EVENT_NARRATION.controlHeld({ target: "Orc", kind: "time", rounds: 2 }), /Orc is stopped for 2 rounds\..*no turns.*does not start time again/);
  assert.match(EVENT_NARRATION.foeStillHeld({ name: "Orc", kind: "time", left: 1 }), /Orc is still stopped\./);
  assert.match(EVENT_NARRATION.foeHoldBroken({ name: "Orc", kind: "time" }), /Time starts again for Orc\./);
  assert.match(LINE_FOR.controlHeld({ target: "Orc", kind: "time", rounds: 2 }).text, /Orc stopped for 2 rounds; a hit will not start time again\./);
  assert.equal(LINE_FOR.foeStillHeld({ name: "Orc", kind: "time", left: 1 }).text, "Orc still stopped (1).");
  assert.equal(LINE_FOR.foeHoldBroken({ name: "Orc", kind: "time" }).text, "Time starts again for Orc.");
  assert.equal(LINE_FOR.foeHoldBroken({ name: "Orc", kind: "frozen" }).text, "Orc breaks free.", "other holds keep their line");
});

test("narration: the misdirect cast lines say the aim, the rounds and who is left alone; the blow lines name who hit whom, for how much", () => {
  assert.match(EVENT_NARRATION.foeMisdirected({ target: "Orc", at: "friends", rounds: 3 }), /Orc can no longer tell friend from furniture\..*3 rounds.*never yours/);
  assert.match(EVENT_NARRATION.foeMisdirected({ target: "Orc", at: "self", rounds: 4 }), /A second Orc appears\..*first Orc finds this unacceptable.*4 rounds.*leaves you alone/);
  assert.match(EVENT_NARRATION.foeMisdirected({ target: "Orc", at: "friends", rounds: 1, by: "Ada" }), /Ada's Senseless: Orc/);
  assert.match(LINE_FOR.foeMisdirected({ target: "Orc", at: "friends", rounds: 3 }).text, /Orc is senseless, 3 rounds: it swings at its own side\./);
  assert.match(LINE_FOR.foeMisdirected({ target: "Orc", at: "self", rounds: 1 }).text, /Orc fights its double, 1 round\./);
  const hit = { name: "Orc", target: "Elf", dmg: 7, self: false, roll: 15, atLeast: 12, dieN: 20 };
  assert.match(EVENT_NARRATION.foeMisdirectedHit(hit), /15<\/span> vs 12–20\..*Orc hits Elf instead of you for <span class="hit">7 hp<\/span>/);
  assert.match(EVENT_NARRATION.foeMisdirectedHit({ ...hit, target: "Orc", self: true }), /Orc hits itself for <span class="hit">7 hp<\/span>/);
  assert.match(EVENT_NARRATION.foeMisdirectedHit({ ...hit, crit: true }), /Critical!/);
  assert.equal(LINE_FOR.foeMisdirectedHit(hit).text, "Orc hits Elf (7).");
  assert.equal(LINE_FOR.foeMisdirectedHit({ ...hit, self: true }).text, "Orc hits itself (7).");
  assert.match(EVENT_NARRATION.foeMisdirectedMiss({ name: "Orc", target: "Elf", self: false, roll: 3, atLeast: 12, dieN: 20 }), /Orc swings at Elf, <span class="roll">3<\/span> vs 12–20, and misses\./);
  assert.equal(LINE_FOR.foeMisdirectedMiss({ name: "Orc", self: true }).text, "Orc misses itself.");
  assert.match(EVENT_NARRATION.foeSwingsAtAir({ name: "Orc" }), /Orc swings at the air\./);
  assert.equal(LINE_FOR.foeSwingsAtAir({ name: "Orc" }).text, "Orc swings at the air.");
  assert.match(EVENT_NARRATION.foeMisdirectEnded({ name: "Orc", at: "friends" }), /Orc can tell friend from furniture again\./);
  assert.match(EVENT_NARRATION.foeMisdirectEnded({ name: "Orc", at: "self" }), /Orc's double goes away\./);
  assert.equal(LINE_FOR.foeMisdirectEnded({ name: "Orc" }).text, "Orc is itself again.");
});

test("narration: a failed resist folds behind Senseless's own line, and behind each stopped foe's hold, so the rail shows each once", () => {
  const folded = linesForAction("castSpell", [
    { type: "resistFailed", target: "Orc", spell: "Senseless", roll: 3, atLeast: 16, dieN: 20, intel: 10, faces: 5 },
    { type: "foeMisdirected", target: "Orc", at: "friends", rounds: 3 },
  ], {});
  assert.deepEqual(folded.map((l) => l.text), ["Orc is senseless, 3 rounds: it swings at its own side."]);
  const stopped = linesForAction("castSpell", [
    { type: "resistFailed", target: "Orc", spell: "Stop Time", roll: 3, atLeast: 16, dieN: 20, intel: 10, faces: 5 },
    { type: "controlHeld", target: "Orc", kind: "time", rounds: 2, source: "Stop Time" },
    { type: "timeStopped", count: 1, rounds: 2 },
  ], {});
  assert.deepEqual(stopped.map((l) => l.text).sort(), ["Orc stopped for 2 rounds; a hit will not start time again.", "Time stops for 1 foe, 2 rounds."], "the bare resist line is gone; the hold and the closing line stay (the rail orders them by priority)");
});

test("a fumbled Stop Time reads as the reader stopped for two turns on both surfaces", () => {
  const e = { type: "fumbleOnReader", spell: "Stop Time", effect: "out", kind: "stopped", rounds: 2 };
  assert.match(EVENT_NARRATION.fumbleOnReader(e), /Stop Time stops the room, and you are standing in it: you cannot act for 2 turns\./);
  assert.equal(LINE_FOR.fumbleOnReader(e).text, "Stop Time stops you in place, 2 turns.");
  // the other out kinds keep their lines
  assert.match(EVENT_NARRATION.fumbleOnReader({ ...e, spell: "Insane", kind: "maddened", rounds: 3 }), /takes you out of the fight, maddened for 3 turns/);
});

test("the hero's chip for a fumbled Stop Time: the combat menu words it STOPPED, and the shell labels and explains it", () => {
  assert.equal(COMBAT_MENU_COPY.heroOutKind.stopped, "STOPPED");
  const html = fs.readFileSync("mazeworld.html", "utf8").replace(/\r\n/g, "\n");
  assert.match(html, /heroOut: \{ label: "Helpless", unit: "rds", kinds: \{[^}]*stopped: "Stopped"/);
  assert.match(html, /HERO_OUT_EXPLAIN = \{ stopped: "Time has stopped around you: you cannot act for two turns/);
  assert.match(html, /EXPLAIN_BY_KIND = \{ foeEffect: FOE_EFFECT_EXPLAIN, heroOut: HERO_OUT_EXPLAIN \}/);
});
