// test/unit/strength-spell.test.js
//
// Phase 90 plan 03 (SPELL-09, report #8: "Strength spell says +d10 damage
// until tomorrow. But casting it actually grants you hit points instead."):
// the Strength spell adds a d10 to every damage roll in its ruled reach for
// 100 squares, grants no hit points, and restarts when recast. The ruled
// reach is Q1 A (docs/SPELL-AUDIT.md Rulings, user 2026-09-30): each weapon
// blow (both blows of a double strike) and each damage spell's roll as it
// lands (a thrown hit, each foe of Lightning, Earthquake's one roll, each
// Fireballs bolt); a damage-over-time tick gets none.
//
// The record is one `c.timers["spell:Strength"]` squares record started from
// the SPELLS row's `act` (engine/combat.js#startSpellEffect); the d10 is drawn
// from a DERIVED stream (engine/derived.js#strengthRoll), so the main rng
// never advances for it.
//
// Edge probes (fallback SPELL-09), where each lives:
//   boundary  ... "boundary: 99 squares still adds the d10 ..." and the
//                 2-square water step and the recast-at-1-left tests
//   adjacency ... "adjacency: the Strength spell, the Strength potion and the
//                 phobia rage are three separate sources ..."
//   empty     ... "empty: a missed blow rolls no d10", "empty: a hero with no
//                 weapon ...", "empty: casting outside a fight ..."
//   encoding  ... "encoding: the record id is exactly spell:Strength ..."
//   ordering  ... "ordering: strengthCast comes before a later strike's hit
//                 events" and the expiry-order test
//   precision ... "precision: the d10 is added before the Sorcerer's cap ..."
//                 and "precision: spell damage adds the d10 before Afraid ..."

import test from "node:test";
import assert from "node:assert/strict";

import { castSpell } from "../../engine/magic.js";
import { playerStrike, foeTurn, startCombat } from "../../engine/combat.js";
import { move, newDay } from "../../engine/movement.js";
import { tickSquares, startEffect } from "../../engine/effects.js";
import { conditionsOf, weaponDamage, weaponDamageRange, strengthRoll, liveItemEffects, afraidDamage, SPELL_ACT_OF } from "../../engine/derived.js";
import { derivedRng, makeRng } from "../../engine/rng.js";
import { newRun } from "../../engine/engine.js";
import { serializeRun, validateSave } from "../../engine/saveState.js";
import { resolveScrollFumble } from "../../engine/scrollFumble.js";
import { SPELLS } from "../../content/index.js";
import { GW, GH } from "../../engine/maze.js";
import { setIdentityDials } from "./harness/identityDials.js";
import { noResistActs } from "./harness/spellResistActs.js";

setIdentityDials();

const SPELL_IDX = Object.fromEntries(SPELLS.map((sp, i) => [sp.n, i]));
const STRENGTH = SPELLS.find((sp) => sp.n === "Strength");

/** mkRng(seq, { moving }) — `.d()` pops the next scripted value; throws on
 * underflow (an exhausted script doubles as a "no further draw" assertion).
 * `getState()` is the draw index when `moving`, else a constant 0 (the usual
 * test double with a fixed cursor). */
function mkRng(seq, { moving = false } = {}) {
  let i = 0;
  return {
    d() {
      if (i >= seq.length) throw new Error(`mkRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    getState: () => (moving ? i : 0),
    pick: (arr) => arr[0],
    shuffle: (a) => a,
    get draws() {
      return i;
    },
  };
}

/** the d10 strengthRoll yields when the main cursor reads `cursor`. */
const d10At = (cursor) => derivedRng(cursor, "strength").d(10);

function fixedFloor() {
  const g = [];
  for (let y = 0; y < GH; y++) {
    g.push([]);
    for (let x = 0; x < GW; x++) g[y].push({ wall: false, dark: false, seen: true, feat: null });
  }
  return { g, px: 5, py: 5, depth: 1 };
}

function fixedHero(overrides = {}) {
  return {
    cls: "Fighter", sub: "Knight", race: "Human", level: 1, sp: 0,
    maxWP: 200, wp: 200, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 0, rations: 6, gold: 50, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    darkFor: 0, halfNext: false, worn: {},
    ...overrides,
  };
}

function fixedWizard(overrides = {}) {
  return fixedHero({
    cls: "Magic User", sub: "Wizard", maxWP: 31, wp: 31, weapon: "Dagger", potions: 4, scrolls: 1,
    grimoire: ["Strength"], ...overrides,
  });
}

function fixedState(cOverrides = {}, { wizard = false, ...rest } = {}) {
  return {
    version: 1, seed: 1, rngState: 1,
    c: wizard ? fixedWizard(cOverrides) : fixedHero(cOverrides),
    floor: fixedFloor(),
    day: 1, steps: 0, combat: null, store: null, beats: null, party: [],
    dead: false, deathNote: "", epitaph: "",
    pendingJoiner: null, pendingFind: null,
    ...rest,
  };
}

function fixedFoe(overrides = {}) {
  return { name: "Wolf", type: "Humans", lvl: 1, size: "S", intel: 1, wp: 500, maxWP: 500, alive: true, asleep: 0, sp: {}, lives: 1, ...overrides };
}

function fixedCombat(foes, overrides = {}) {
  return { foes, type: foes[0]?.type || "Humans", round: 1, target: 0, spellOpen: false, tracked: false, ...overrides };
}

/** live(c) — start the Strength record by hand (the cast's own bookkeeping). */
function giveStrength(c, left = 100) {
  startEffect(c, "spell:Strength", { squares: left });
  return c;
}

const strengthCastEvents = (events) => events.filter((e) => e.type === "strengthCast");

// --- the cast: a record, never hit points -----------------------------------

test("the row: Strength carries an act record and no damage die of its own", () => {
  assert.deepStrictEqual(STRENGTH.act, { kind: "strength", effect: 100, dice: { n: 1, sides: 10, bonus: 0 } });
  assert.equal("dmg" in STRENGTH, false, "the die lives in act.dice");
  assert.equal(SPELL_ACT_OF.Strength, STRENGTH.act);
  assert.match(STRENGTH.txt, /100 squares/);
  assert.match(STRENGTH.txt, /d10/);
  assert.match(STRENGTH.txt, /no extra HP/);
});

test("cast: Strength starts one 100-square spell:Strength record, grants no hit points and draws nothing", () => {
  const state = fixedState({ maxWP: 31, wp: 20 }, { wizard: true });
  const events = [];
  castSpell(state, SPELL_IDX.Strength, mkRng([]), events);
  assert.deepStrictEqual(state.c.timers["spell:Strength"], { cadence: "squares", left: 100, phase: "effect" });
  assert.equal(state.c.maxWP, 31, "max hit points are never raised");
  assert.equal(state.c.wp, 20, "current hit points are never raised");
  assert.equal("strengthBoost" in state.c, false, "the retired doubling field is never written");
  assert.equal(state.c.might, 0, "the cast no longer writes c.might (that is the phobia rage's)");
  assert.deepStrictEqual(strengthCastEvents(events), [{ type: "strengthCast", squares: 100, restarted: false }]);
  assert.equal(state.c.spellsUsed, 1);
});

test("cast: casting Strength twice never doubles anything and never stacks a second record", () => {
  const state = fixedState({ maxWP: 31, wp: 31 }, { wizard: true });
  castSpell(state, SPELL_IDX.Strength, mkRng([]), []);
  castSpell(state, SPELL_IDX.Strength, mkRng([]), []);
  assert.equal(state.c.maxWP, 31);
  assert.equal(state.c.wp, 31);
  assert.deepStrictEqual(Object.keys(state.c.timers), ["spell:Strength"]);
});

test("restart: a recast 40 squares in goes back to 100, flagged restarted, one record, one d10 per roll", () => {
  const state = fixedState({}, { wizard: true });
  castSpell(state, SPELL_IDX.Strength, mkRng([]), []);
  tickSquares(state.c, 40);
  assert.equal(state.c.timers["spell:Strength"].left, 60);
  const events = [];
  castSpell(state, SPELL_IDX.Strength, mkRng([]), events);
  assert.equal(state.c.timers["spell:Strength"].left, 100, "restarted, never 160");
  assert.deepStrictEqual(strengthCastEvents(events), [{ type: "strengthCast", squares: 100, restarted: true }]);
  assert.deepStrictEqual(Object.keys(state.c.timers), ["spell:Strength"]);
  // one d10 per roll: the Dagger roll plus exactly one Strength d10
  const plain = weaponDamage(fixedWizard(), mkRng([3]));
  assert.equal(weaponDamage(state.c, mkRng([3])), plain + d10At(0), "not two dice");
});

test("camp: making camp and a new day neither end nor shorten the record, and add no hit points", () => {
  for (const camped of [true, false]) {
    const state = fixedState({ maxWP: 40, wp: 40, rations: 6 }, { wizard: true });
    giveStrength(state.c, 77);
    newDay(state, camped, makeRng(1), []);
    assert.deepStrictEqual(state.c.timers["spell:Strength"], { cadence: "squares", left: 77, phase: "effect" }, `camped=${camped}`);
    assert.equal(state.c.maxWP, 40);
  }
});

// --- the clock: 100 squares, then one fade line ------------------------------

test("boundary: 99 squares still adds the d10, the step that walks the 100th ends it with one spellEffectFaded", () => {
  const state = fixedState({}, { wizard: true });
  castSpell(state, SPELL_IDX.Strength, mkRng([]), []);
  tickSquares(state.c, 99);
  assert.equal(state.c.timers["spell:Strength"].left, 1, "99 squares in: still live");
  assert.equal(strengthRoll(state.c, mkRng([])), d10At(0), "and still adding its d10");
  const events = move(state, "N", mkRng([]), []);
  assert.equal("spell:Strength" in state.c.timers, false, "the 100th square ends it");
  const faded = events.filter((e) => e.type === "spellEffectFaded");
  assert.deepStrictEqual(faded, [{ type: "spellEffectFaded", spell: "Strength", kind: "strength" }]);
  assert.equal(strengthRoll(state.c, mkRng([])), 0);
});

test("boundary: a recast with 1 square left restarts to 100", () => {
  const state = fixedState({}, { wizard: true });
  giveStrength(state.c, 1);
  const events = [];
  castSpell(state, SPELL_IDX.Strength, mkRng([]), events);
  assert.equal(state.c.timers["spell:Strength"].left, 100);
  assert.equal(strengthCastEvents(events)[0].restarted, true);
});

test("boundary: a 2-square water step with 1 left ends it with no negative left", () => {
  const state = fixedState({}, { wizard: true });
  giveStrength(state.c, 1);
  state.floor.g[4][5] = { wall: false, dark: false, seen: true, feat: null, water: true };
  const events = move(state, "N", mkRng([]), []);
  assert.equal(state.steps, 2, "the wade cost two squares");
  assert.equal("spell:Strength" in state.c.timers, false, "deleted, not left at -1");
  assert.equal(events.filter((e) => e.type === "spellEffectFaded").length, 1);
});

test("ordering: strengthCast comes before a later strike's hit events; the fade is told on the step that ends it, before any later event", () => {
  const state = fixedState({}, { wizard: true });
  const events = [];
  castSpell(state, SPELL_IDX.Strength, mkRng([]), events);
  state.combat = fixedCombat([fixedFoe()]);
  playerStrike(state, mkRng([1, 4, 20]), events);
  const iCast = events.findIndex((e) => e.type === "strengthCast");
  const iHit = events.findIndex((e) => e.type === "struck");
  assert.ok(iCast >= 0 && iHit > iCast, "strengthCast first, then the blow");
  // expiry: the fade sits right after the step's `moved`, before anything it brings on
  const walker = fixedState({}, { wizard: true });
  giveStrength(walker.c, 1);
  const stepEvents = move(walker, "N", mkRng([]), []);
  const types = stepEvents.map((e) => e.type);
  assert.ok(types.indexOf("spellEffectFaded") > types.indexOf("moved"));
  assert.equal(types.filter((t) => t === "spellEffectFaded").length, 1);
});

// --- the blow: a derived d10 per weapon roll ----------------------------------

/** strike(state, seq, opts) — one playerStrike with a scripted rng. */
function strike(state, seq, opts) {
  const rng = mkRng(seq, opts);
  const events = playerStrike(state, rng, []);
  return { events, rng, struck: events.filter((e) => e.type === "struck") };
}

test("blow: a landed blow adds strengthRoll's d10, and the main rng draws exactly what the plain blow draws", () => {
  const plainState = fixedState();
  plainState.combat = fixedCombat([fixedFoe()]);
  const plain = strike(plainState, [5, 4, 20], { moving: true });
  const state = fixedState();
  giveStrength(state.c);
  state.combat = fixedCombat([fixedFoe()]);
  const withS = strike(state, [5, 4, 20], { moving: true });
  // cursor after to-hit and the club die is 2
  assert.equal(withS.struck[0].dmg, plain.struck[0].dmg + d10At(2));
  assert.equal(withS.rng.draws, plain.rng.draws, "the d10 is derived: the main cursor never moves for it");
});

test("blow: both blows of a double strike get their own independently keyed d10", () => {
  const seq = [5, 4, 5, 4, 20];
  assert.notEqual(d10At(2), d10At(4), "precondition: the two cursors give different d10s");
  const plainState = fixedState({ sub: "Barbarian" });
  plainState.combat = fixedCombat([fixedFoe()]);
  const plain = strike(plainState, seq, { moving: true });
  assert.equal(plain.struck.length, 2);
  const state = fixedState({ sub: "Barbarian" });
  giveStrength(state.c);
  state.combat = fixedCombat([fixedFoe()]);
  const withS = strike(state, seq, { moving: true });
  assert.equal(withS.struck.length, 2);
  assert.equal(withS.struck[0].dmg, plain.struck[0].dmg + d10At(2));
  assert.equal(withS.struck[1].dmg, plain.struck[1].dmg + d10At(4));
});

test("blow: a critical doubles the whole roll, the Strength d10 included (it is part of the damage roll)", () => {
  const plainState = fixedState();
  plainState.combat = fixedCombat([fixedFoe()]);
  const plain = strike(plainState, [1, 4, 20], { moving: true });
  const state = fixedState();
  giveStrength(state.c);
  state.combat = fixedCombat([fixedFoe()]);
  const withS = strike(state, [1, 4, 20], { moving: true });
  assert.equal(plain.struck[0].critical, true);
  assert.equal(withS.struck[0].dmg, plain.struck[0].dmg + 2 * d10At(2));
});

test("precision: the d10 is added before the Sorcerer's cap of 9 and the floor of 1; the total is an integer", () => {
  const sorc = () => fixedHero({ cls: "Magic User", sub: "Sorcerer", weapon: "Club", maxWP: 40, wp: 40 });
  const mk = (strength) => {
    const c = sorc();
    if (strength) giveStrength(c);
    return c;
  };
  // club d6 = 5, level 1: 1 + 5 = 6 plain; with the d10 (4 at cursor 0) it would be 10, capped to 9
  assert.equal(weaponDamage(mk(false), mkRng([5])), 6);
  assert.equal(d10At(0), 4);
  const capped = weaponDamage(mk(true), mkRng([5]));
  assert.equal(capped, 9, "capped at 9 after the d10 joined");
  assert.ok(Number.isInteger(capped));
  assert.deepStrictEqual(weaponDamageRange(mk(true)), { min: 3, max: 9 }, "the range reads the same cap");
});

test("range: weaponDamageRange with Strength live is the plain range plus 1 to 10", () => {
  const plain = weaponDamageRange(fixedHero());
  const withS = weaponDamageRange(giveStrength(fixedHero()));
  assert.deepStrictEqual(withS, { min: plain.min + 1, max: plain.max + 10 });
});

test("empty: a missed blow rolls no d10", () => {
  const state = fixedState();
  giveStrength(state.c);
  state.combat = fixedCombat([fixedFoe()]);
  // to-hit raw 20 -> the worst face: a miss; then the foe's own swing (20)
  const rng = mkRng([20, 20], { moving: true });
  const events = playerStrike(state, rng, []);
  assert.equal(events.some((e) => e.type === "struck"), false);
  assert.equal(events.some((e) => e.type === "strikeMissed"), true);
  assert.equal(rng.draws, 2, "the miss and the foe's swing only");
});

test("empty: a hero with no weapon (the Club row) still gets the d10", () => {
  const state = fixedState({ weapon: null });
  giveStrength(state.c);
  assert.equal(weaponDamage(state.c, mkRng([3])), 1 + 3 + d10At(0));
  assert.deepStrictEqual(weaponDamageRange(state.c), { min: 1 + 1 + 1, max: 1 + 6 + 10 });
});

test("empty: casting outside a fight starts the record and a later fight inherits it", () => {
  const state = fixedState({}, { wizard: true });
  assert.equal(state.combat, null);
  castSpell(state, SPELL_IDX.Strength, mkRng([]), []);
  assert.equal(state.c.timers["spell:Strength"].left, 100);
  state.combat = fixedCombat([fixedFoe()]);
  const plainState = fixedState({}, { wizard: true });
  plainState.combat = fixedCombat([fixedFoe()]);
  const a = strike(plainState, [3, 4, 20], { moving: true });
  const b = strike(state, [3, 4, 20], { moving: true });
  assert.equal(b.struck[0].dmg, a.struck[0].dmg + d10At(2));
});

// --- the ruled reach (Q1 A): spell damage rolls ------------------------------

/** castDamage(spellName, setup, seq) — cast with and without Strength on a
 * constant-cursor rng; returns both runs. */
function castBoth(spellName, { level, foes, seq, source = spellName, afraid = 0 }) {
  const run = (strength) => {
    const state = fixedState({ level }, { wizard: true });
    state.c.grimoire = [spellName];
    state.c.maxWP = state.c.wp = 400;
    if (strength) giveStrength(state.c);
    state.combat = fixedCombat(foes.map((f) => fixedFoe(f)), afraid ? { afraid } : {});
    state.acts = noResistActs(source, foes.length);
    const events = castSpell(state, SPELL_IDX[spellName], mkRng(seq), []);
    return { state, events };
  };
  return { plain: run(false), strong: run(true) };
}

test("reach (Q1 A): a thrown spell hit adds the d10 to its damage roll", () => {
  // Fireball: d8 to hit (raw 1), 2d10+4 (5 + 5), then the foe's swing
  const { plain, strong } = castBoth("Fireball", { level: 3, foes: [{}], seq: [1, 5, 5, 20] });
  const hitP = plain.events.find((e) => e.type === "spellHit");
  const hitS = strong.events.find((e) => e.type === "spellHit");
  assert.equal(hitS.dmg, hitP.dmg + d10At(0));
  assert.equal(strong.state.combat.foes[0].wp, plain.state.combat.foes[0].wp - d10At(0));
});

test("reach (Q1 A): Lightning adds a d10 for each foe it hits", () => {
  const { plain, strong } = castBoth("Lightning", { level: 4, foes: [{ name: "A" }, { name: "B" }], seq: [1, 5, 1, 5, 20, 20] });
  const hits = (r) => r.events.filter((e) => e.type === "spellHit").map((e) => e.dmg);
  assert.equal(hits(plain).length, 2);
  assert.deepStrictEqual(hits(strong), hits(plain).map((d) => d + d10At(0)));
});

test("reach (Q1 A): Earthquake adds the d10 to its one roll (every foe takes it); the caster's backlash is the dice alone", () => {
  const { plain, strong } = castBoth("Earthquake", { level: 4, foes: [{ name: "A" }, { name: "B" }], seq: [10, 10, 10, 20, 20] });
  for (const i of [0, 1]) {
    assert.equal(strong.state.combat.foes[i].wp, plain.state.combat.foes[i].wp - d10At(0));
  }
  assert.equal(strong.state.c.wp, plain.state.c.wp, "the backlash does not grow");
});

test("reach (Q1 A): Fireballs adds a d10 to each bolt", () => {
  // d8 = 2 bolts, d10+2 each (5 then 3), then the foe's swing
  const { plain, strong } = castBoth("Fireballs", { level: 4, foes: [{}], seq: [2, 5, 3, 20] });
  const vol = (r) => r.events.find((e) => e.type === "volley");
  assert.equal(vol(strong).rolls, 2);
  assert.equal(vol(strong).totalDamage, vol(plain).totalDamage + 2 * d10At(0), "one d10 per bolt");
});

test("precision: spell damage adds the d10 before Afraid halving", () => {
  const { plain, strong } = castBoth("Fireball", { level: 3, foes: [{}], seq: [1, 5, 5, 20], afraid: 3 });
  const base = 5 + 5 + 4 + 9; // 2d10 + 4 + level squared
  const hitP = plain.events.find((e) => e.type === "spellHit");
  const hitS = strong.events.find((e) => e.type === "spellHit");
  const afraidState = { combat: { afraid: 3 } };
  assert.equal(hitP.dmg, afraidDamage(afraidState, base));
  assert.equal(hitS.dmg, afraidDamage(afraidState, base + d10At(0)), "halved after the d10, not before");
});

test("reach (Q1 A): a damage-over-time tick adds no d10", () => {
  for (const field of ["acid", "dot"]) {
    const run = (strength) => {
      const state = fixedState();
      if (strength) giveStrength(state.c);
      const foe = fixedFoe();
      if (field === "acid") foe.acid = { rounds: 2, dmg: { n: 1, sides: 6, bonus: 0 }, levelSq: 1 };
      else foe.dot = { left: 2, dmg: { n: 1, sides: 6, bonus: 0 }, by: "ice", levelSq: 1 };
      state.combat = fixedCombat([foe]);
      foeTurn(state, mkRng([4, 20]), []);
      return foe.wp;
    };
    assert.equal(run(true), run(false), `${field}: Strength does not touch the tick`);
    assert.equal(500 - run(false), 4 + 1, `${field}: the tick is its dice plus level squared, as before`);
  }
});

// --- sources, records, chips -------------------------------------------------

test("adjacency: the Strength spell, the Strength potion and the phobia rage are three separate sources that all add", () => {
  const base = fixedHero();
  const plain = weaponDamage(base, mkRng([3]));
  const c = fixedHero({ might: 5 });
  startEffect(c, "item:Strength", { squares: 25 });
  giveStrength(c);
  assert.equal(weaponDamage(c, mkRng([3])), plain + 5 + 8 + d10At(0));
  const entries = liveItemEffects(c);
  assert.deepStrictEqual(entries.map((e) => [e.key, e.source]), [["Strength", "item"], ["Strength", "spell"]]);
  // none replaces another: dropping the spell leaves the potion and the rage
  delete c.timers["spell:Strength"];
  assert.equal(weaponDamage(c, mkRng([3])), plain + 5 + 8);
});

test("encoding: the record id is exactly spell: plus the row's n, and the potion's item:Strength never collides with it", () => {
  const state = fixedState({}, { wizard: true });
  startEffect(state.c, "item:Strength", { squares: 25 });
  castSpell(state, SPELL_IDX.Strength, mkRng([]), []);
  assert.deepStrictEqual(Object.keys(state.c.timers).sort(), ["item:Strength", "spell:Strength"]);
  assert.equal(state.c.timers["item:Strength"].left, 25, "the potion record is untouched by the cast");
  assert.equal(state.c.timers["spell:Strength"].left, 100);
  assert.equal("spell:strength" in state.c.timers, false, "matched code unit for code unit: no lowercase twin");
  assert.equal(strengthRoll(fixedHero({ timers: { "spell:strength": { cadence: "squares", left: 9, phase: "effect" } } }), mkRng([])), 0);
});

test("chip: the live record shows as a Strength chip with its squares left, and no hit-point chip exists", () => {
  const c = giveStrength(fixedHero(), 64);
  const chips = conditionsOf({ c, combat: null });
  const chip = chips.find((x) => x.key === "strength");
  assert.deepStrictEqual(chip, { key: "strength", polarity: "good", remaining: 64, cadence: "squares", source: "Strength" });
  assert.equal(chips.some((x) => x.key === "strengthBoost"), false);
  assert.equal(chips.some((x) => x.key === "might"), false, "c.might is the rage's, not the spell's");
});

// --- a fumbled Strength on a foe, and loading an old save -------------------

test("fumble: a fumbled Strength scroll sets the foe's might to a d10 from the fumble stream and never touches its hit points", () => {
  const state = fixedState();
  const foe = fixedFoe({ wp: 40, maxWP: 40 });
  state.combat = fixedCombat([foe]);
  const events = resolveScrollFumble(state, STRENGTH, mkRng([7]), mkRng([]), []);
  assert.equal(foe.might, 7);
  assert.equal(foe.maxWP, 40);
  assert.equal(foe.wp, 40);
  assert.equal("strengthBoost" in foe, false);
  const e = events.find((x) => x.type === "fumbleOnFoe");
  assert.equal(e.effect, "might");
  assert.equal(e.might, 7);
  assert.equal("gained" in e, false);
});

function retiredSave(mutate) {
  const state = newRun(4242);
  mutate(state);
  return JSON.stringify(serializeRun(state));
}

test("load: a saved hero with the retired doubled-hit-point field comes back with the doubling unwound", () => {
  const raw = retiredSave((s) => {
    s.c.maxWP = 60;
    s.c.wp = 55;
    s.c.strengthBoost = 30;
  });
  const loaded = validateSave(raw);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.value.c.maxWP, 30);
  assert.equal(loaded.value.c.wp, 30, "clamped to the new maximum");
  assert.equal("strengthBoost" in loaded.value.c, false);
});

test("load: a saved fight's foe with the retired field is unwound too, and nothing throws", () => {
  const raw = retiredSave((s) => {
    startCombat(s, false, null, makeRng(7), []);
    const f = s.combat.foes[0];
    f.maxWP = 50;
    f.wp = 50;
    f.strengthBoost = 25;
  });
  const loaded = validateSave(raw);
  assert.equal(loaded.ok, true);
  const f = loaded.value.combat.foes[0];
  assert.equal(f.maxWP, 25);
  assert.equal(f.wp, 25);
  assert.equal("strengthBoost" in f, false);
});

test("load: a save without the field loads byte-identical (a genuine no-op)", () => {
  const state = newRun(4242);
  const raw = JSON.stringify(serializeRun(state));
  const loaded = validateSave(raw);
  assert.equal(loaded.ok, true);
  assert.equal(JSON.stringify(loaded.value.c.maxWP), JSON.stringify(state.c.maxWP));
  assert.equal(loaded.value.c.wp, state.c.wp);
  assert.equal("strengthBoost" in loaded.value.c, false);
});
