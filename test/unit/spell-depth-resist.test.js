// test/unit/spell-depth-resist.test.js
//
// Phase 90 plan 04 (SPELL-12, user ruling at the Phase 89 checkpoint,
// 2026-09-30: "rising resists on higher floors should apply to ALL spells and
// spell-like effects ... remove the floor-12 special effects only"; confirmed
// for damage spells after 89-08: "I'm good with that").
//
// Every spell a foe can resist, cast by the hero, by a scroll's free cast or by
// a Joiner, rolls exactly ONE resist per targeted foe, and that resist is the
// shared depth-rising one (engine/derived.js#risingResistFaces, rolled by
// engine/combat.js#foeResistsEffect, which foeResistsSpell now IS). No spell
// site calls the RULES-18 control resist (resistControl), and no spell keeps a
// past-floor-12 special effect: no three-round hold (controlHoldRoundsFor), no
// fight cap (controlCapRounds), no extra resist.
//
// Each foe below carries intelligence 10 (5 half-intelligence faces), so the
// rise is easy to read: floor 12 -> 5 faces, floor 13 -> 6, floor 20 -> 11.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { castSpell } from "../../engine/magic.js";
import { alliesTurn } from "../../engine/combat.js";
import { foeRisingResistCheck, risingResistFaces, resistFaces } from "../../engine/derived.js";
import { SPELLS } from "../../content/index.js";
import { GW, GH } from "../../engine/maze.js";

const IDX = Object.fromEntries(SPELLS.map((sp, i) => [sp.n, i]));
const ONES = (n) => new Array(n).fill(1);

/** fakeRng(seq) — `.d()` pops the next raw value (a raw 1 is the best face of
 * a roll-high check). The cursor (`getState`) is FIXED at 0, so a forced
 * resist outcome never depends on how many main draws came first. */
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

function fixedFloor(depth) {
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
  return { name, type: "Beasts", lvl: 1, size: "S", intel: 10, wp: 30, maxWP: 30, alive: true, asleep: 0, sp: {}, lives: 1, ...overrides };
}

function spellState(depth, spellName, level, nFoes, { foeOver = {}, type = "Beasts" } = {}) {
  return {
    version: 1, seed: 1, rngState: 1, acts: 0,
    c: hero({ level, grimoire: [spellName] }),
    floor: fixedFloor(depth),
    day: 1, steps: 0, store: null, beats: null, dead: false, deathNote: "", epitaph: "",
    combat: {
      foes: Array.from({ length: nFoes }, (_, k) => foe(`F${k + 1}`, { type, ...foeOver })),
      type, round: 1, target: 0, spellOpen: false, tracked: false,
    },
  };
}

const isResistLine = (e) => e.type === "spellResisted" || e.type === "resistFailed";

/** findActs(depth, wants, intel) — the first state.acts whose REAL
 * foeRisingResistCheck gives every `[source, idx, resisted]` in `wants`, off
 * cursor 0, round 1, caster "you". */
function findActs(depth, wants, intel = 10) {
  const probe = { getState: () => 0 };
  for (let acts = 0; acts <= 20000; acts++) {
    if (wants.every(([source, idx, resisted]) => foeRisingResistCheck({ floor: { depth }, acts, combat: { round: 1 } }, probe, source, idx, intel).resisted === resisted)) return acts;
  }
  throw new Error(`findActs: nothing for ${JSON.stringify(wants)} at depth ${depth}`);
}

/** failActs(depths, source, nFoes, intel) — the first acts where NO foe
 * resists `source` at ANY of `depths` (the rise only ever adds faces, so a roll
 * that fails at the deepest floor fails at every shallower one). */
function failActs(depths, source, nFoes, intel = 10) {
  const probe = { getState: () => 0 };
  for (let acts = 0; acts <= 20000; acts++) {
    let ok = true;
    for (const depth of depths) {
      for (let i = 0; i < nFoes; i++) {
        if (foeRisingResistCheck({ floor: { depth }, acts, combat: { round: 1 } }, probe, source, i, intel).resisted) ok = false;
      }
    }
    if (ok) return acts;
  }
  throw new Error(`failActs: nothing for ${source}`);
}

// [label, spell, caster level, foes, foe type, resists rolled, main sequence]
const KINDS = [
  ["thrown, one foe (Fireball)", "Fireball", 3, 3, "Beasts", 1, ONES(80)],
  ["thrown, every foe (Lightning)", "Lightning", 4, 3, "Beasts", 3, ONES(80)],
  ["thrown, one foe (Mangle)", "Mangle", 5, 3, "Beasts", 1, ONES(80)],
  ["Freeze's post-damage freeze", "Freeze", 1, 2, "Beasts", 1, ONES(80)],
  ["status (Doze)", "Doze", 1, 3, "Beasts", 1, ONES(80)],
  ["stun", "Stun", 1, 3, "Beasts", 3, [6, ...ONES(80)]],
  ["weaken", "Weaken", 1, 3, "Beasts", 3, ONES(80)],
  ["stupid (Stupidity)", "Stupidity", 2, 3, "Beasts", 1, ONES(80)],
  ["blind", "Blind", 3, 3, "Beasts", 1, ONES(80)],
  ["shrink", "Shrink", 3, 3, "Beasts", 3, [6, ...ONES(80)]],
  ["acid", "Acid", 2, 3, "Beasts", 1, ONES(80)],
  ["dot (Ice)", "Ice", 3, 3, "Beasts", 1, ONES(80)],
  ["quake (Earthquake)", "Earthquake", 4, 3, "Beasts", 3, ONES(80)],
  ["vapor (Noxious Vapor)", "Noxious Vapor", 4, 3, "Beasts", 3, ONES(80)],
  ["volley (Fireballs)", "Fireballs", 4, 3, "Beasts", 3, ONES(80)],
  ["petrify", "Petrify", 5, 3, "Beasts", 1, ONES(80)],
  ["insane", "Insane", 2, 3, "Beasts", 1, ONES(80)],
  ["death", "Death", 5, 3, "Beasts", 1, ONES(80)],
  ["turn (Turn Walking Dead)", "Turn Walking Dead", 2, 3, "Walking Dead", 3, ONES(80)],
  ["gate (Plane Gate)", "Plane Gate", 3, 3, "Walking Dead", 3, [6, ...ONES(80)]],
];

for (const depth of [1, 12, 13, 20]) {
  test(`one resist per targeted foe for every resistible spell kind, on the depth-rising faces, floor ${depth}: no controlResisted, no controlHeld`, () => {
    const faces = risingResistFaces(depth, 10);
    for (const [label, name, level, nFoes, type, expected, seq] of KINDS) {
      const s = spellState(depth, name, level, nFoes, { type });
      s.acts = 7;
      const events = castSpell(s, IDX[name], fakeRng(seq), []);
      const lines = events.filter(isResistLine);
      assert.equal(lines.length, expected, `${label}: ${lines.length} resist lines, wanted ${expected}`);
      for (const e of lines) {
        assert.equal(e.faces, faces, `${label}: faces`);
        assert.equal(e.intel, 10, `${label}: intel`);
        if (depth <= 12) assert.equal("depthFaces" in e, false, `${label}: no depthFaces at or below floor 12`);
        else assert.equal(e.depthFaces, faces - resistFaces(10), `${label}: depthFaces`);
      }
      assert.equal(events.some((e) => e.type === "controlResisted" || (e.type === "controlHeld" && !e.freeze)), false, `${label}: the RULES-18 control resist and hold are gone (a Freeze's own rolled hold is the one controlHeld left)`);
      assert.equal(s.combat ? s.combat.foes.some((f) => "resisted" in f || ("held" in f && name !== "Freeze")) : false, false, `${label}: no Unmoved mark and no hold on any foe (a Freeze holds its rolled d4)`);
    }
  });
}

test("rising odds: intelligence 10 resists on 16-20 at floor 12 (5 faces), 15-20 at floor 13 (6), 10-20 at floor 20 (11); the spell's event carries the same", () => {
  assert.deepEqual([1, 12, 13, 20].map((d) => risingResistFaces(d, 10)), [5, 5, 6, 11]);
  const resist = (depth) => {
    const s = spellState(depth, "Fireball", 3, 1);
    s.acts = 7;
    return castSpell(s, IDX.Fireball, fakeRng(ONES(80)), []).find(isResistLine);
  };
  const [e12, e13, e20] = [12, 13, 20].map(resist);
  assert.deepEqual([e12.atLeast, e13.atLeast, e20.atLeast], [16, 15, 10]);
  assert.equal(e12.roll, e13.roll, "the same acts and stream key give the same die on both floors");
  assert.equal(e13.roll, e20.roll);
});

test("edge (boundary): the same Doze cast on floor 12 and floor 13, a roll that fails both, differs only in the resist odds the helper returns", () => {
  const acts = failActs([13], "Doze", 1);
  const run = (depth) => {
    const s = spellState(depth, "Doze", 1, 1);
    s.acts = acts;
    const events = castSpell(s, IDX.Doze, fakeRng(ONES(80)), []);
    const dozed = events.filter((e) => e.type === "dozed");
    return { foe: s.combat.foes[0].asleep, dozed, line: events.find(isResistLine) };
  };
  const a = run(12);
  const b = run(13);
  assert.equal(a.line.type, "resistFailed");
  assert.equal(b.line.type, "resistFailed");
  assert.equal(a.line.roll, b.line.roll);
  assert.equal(b.line.faces - a.line.faces, 1);
  assert.deepEqual(a.dozed, b.dozed);
  assert.equal(a.foe, b.foe);
});

test("edge (precision): intelligence 1 gives one resist face (max(1, round(1 / 2)) = 1); the rise adds whole numbers and the total never passes 19", () => {
  assert.equal(resistFaces(1), 1);
  assert.equal(risingResistFaces(12, 1), 1);
  assert.equal(risingResistFaces(13, 1), 2);
  for (const intel of [1, 6, 10, 20, 38]) {
    for (let depth = 1; depth <= 60; depth++) {
      const f = risingResistFaces(depth, intel);
      assert.ok(Number.isInteger(f) && f >= resistFaces(intel) && f <= 19, `intel ${intel} depth ${depth}: ${f}`);
    }
  }
});

// ---------------------------------------------------------------------------
// No cap: a landed spell is its floor-1 effect at every depth.
// ---------------------------------------------------------------------------

const DIGEST_FIELDS = ["wp", "maxWP", "alive", "asleep", "stupid", "blind", "blindFor", "frozen", "shrunk", "held", "resisted", "intel", "lives"];
const CAST_TYPES = new Set(["stunned", "dozed", "weakened", "stupefied", "blinded", "shrunk", "petrified", "vaporRolled", "insaneRolled", "foeKilled"]);
function digest(s, events, rng) {
  return {
    n: rng.count(),
    cast: events.filter((e) => CAST_TYPES.has(e.type)).map((e) => ({ ...e, spGained: undefined })),
    foes: s.combat ? s.combat.foes.map((f) => Object.fromEntries(DIGEST_FIELDS.filter((k) => k in f).map((k) => [k, f[k]]))) : null,
  };
}

const LAND = [
  // [spell, caster level, foes, foe type, main sequence] — the sequences give each spell a clean landed outcome.
  ["Doze", 1, 1, [3, ...ONES(80)]],
  ["Stun", 1, 3, [6, 2, 3, 4, ...ONES(80)]],
  ["Stupidity", 2, 1, ONES(80)],
  ["Blind", 3, 1, ONES(80)],
  ["Shrink", 3, 3, [6, ...ONES(80)]],
  ["Noxious Vapor", 4, 2, [2, 3, 5, ...ONES(80)]],
  ["Insane", 2, 1, [4, 2, ...ONES(80)]],
  ["Petrify", 5, 2, ONES(80)],
];

test("no cap: a landed Doze, Stun, Stupidity, Blind, Shrink, Noxious Vapor, Insane (the nap) and Petrify is the same on floor 20 as on floor 1 (events, foes, main draws): no hold, no rounds on blinded, no extra resist", () => {
  for (const [name, level, nFoes, seq] of LAND) {
    const acts = failActs([1, 20], name, nFoes);
    const at = (depth) => {
      const s = spellState(depth, name, level, nFoes);
      s.acts = acts;
      const rng = fakeRng(seq);
      const events = castSpell(s, IDX[name], rng, []);
      return { s, events, d: digest(s, events, rng) };
    };
    const shallow = at(1);
    const deep = at(20);
    assert.deepEqual(deep.d, shallow.d, name);
    assert.equal(deep.events.some((e) => e.type === "controlHeld" || e.type === "controlResisted"), false, name);
    assert.equal(deep.s.combat ? deep.s.combat.foes.some((f) => "held" in f || "blindFor" in f) : false, false, `${name}: no hold, no blind countdown at floor 20`);
  }
});

test("no cap: Noxious Vapor's sleep is its own d6+2 and Insane's nap its own d4 at floor 20 (the d6 / d4 draws sit where they always did)", () => {
  const v = spellState(20, "Noxious Vapor", 4, 2);
  v.acts = findActs(20, [["Noxious Vapor", 0, true], ["Noxious Vapor", 1, false]]);
  castSpell(v, IDX["Noxious Vapor"], fakeRng([2, 3, 5, ...ONES(80)]), []);
  assert.equal(v.combat.foes[0].asleep, 0, "the resisting foe stays awake and draws no d6");
  assert.equal(v.combat.foes[1].asleep, 4, "its own d6 3 + 2 = 5, one visit spent this dispatch");

  const i = spellState(20, "Insane", 2, 1);
  i.acts = failActs([20], "Insane", 1);
  castSpell(i, IDX.Insane, fakeRng([4, 2, ...ONES(80)]), []);
  assert.equal(i.combat.foes[0].asleep, 1, "d4 2, one visit spent");
});

test("no cap: Shrink halves and Weaken runs its d4+1 at floor 20", () => {
  const s = spellState(20, "Shrink", 3, 3);
  s.acts = failActs([20], "Shrink", 3);
  castSpell(s, IDX.Shrink, fakeRng([6, ...ONES(80)]), []);
  assert.deepEqual(s.combat.foes.map((f) => f.wp), [15, 15, 15]);
  assert.deepEqual(s.combat.foes.map((f) => f.maxWP), [15, 15, 15]);

  const w = spellState(20, "Weaken", 1, 2);
  w.acts = failActs([20], "Weaken", 2);
  const ev = castSpell(w, IDX.Weaken, fakeRng([3, ...ONES(80)]), []);
  assert.equal(ev.find((e) => e.type === "weakened").rounds, 4);
  assert.ok(w.c.timers["spell:weaken"]);
});

// ---------------------------------------------------------------------------
// Ordering and the resisted single-target cast.
// ---------------------------------------------------------------------------

test("edge (ordering): each resist line is pushed before its spell's effect line; a resisted single-target spell ends the cast at once (the charge and the turn spent, no further draws)", () => {
  for (const [name, level, effect] of [["Stupidity", 2, "stupefied"], ["Blind", 3, "blinded"], ["Petrify", 5, "petrified"], ["Doze", 1, "dozed"]]) {
    const landed = spellState(20, name, level, 1);
    landed.acts = failActs([20], name, 1);
    const ev = castSpell(landed, IDX[name], fakeRng(ONES(80)), []);
    assert.ok(ev.findIndex(isResistLine) >= 0 && ev.findIndex(isResistLine) < ev.findIndex((e) => e.type === effect), `${name}: resist line first`);

    const resisted = spellState(20, name, level, 1);
    resisted.acts = findActs(20, [[name, 0, true]]);
    const rng = fakeRng(ONES(80));
    const used = resisted.c.spellsUsed;
    const ev2 = castSpell(resisted, IDX[name], rng, []);
    assert.equal(ev2.some((e) => e.type === effect), false, `${name}: a resisted cast lands nothing`);
    assert.equal(resisted.c.spellsUsed, used + 1, `${name}: the charge is spent`);
    assert.equal(ev2.filter((e) => e.type === "spellResisted").length, 1, `${name}: one resist line`);
  }
});

// ---------------------------------------------------------------------------
// A Joiner's cast (combat.js#allyCast) rolls the same single resist.
// ---------------------------------------------------------------------------

function joinerState(depth, grimoire, foes) {
  const g = fixedFloor(depth);
  const mu = {
    name: "Ada", level: 3, sub: "Wizard", cls: "Magic User", race: "Human", wp: 20, maxWP: 20, status: "ok",
    weapon: "Quarter Staff", prof: 0, magicWpn: 0, might: 0, items: [], skills: {}, armor: "Nothing", grimoire, spellsUsed: 0,
  };
  return {
    version: 1, seed: 1, rngState: 1, acts: 0,
    c: hero({ cls: "Fighter", sub: "Soldier", level: 1, maxWP: 55, wp: 55, grimoire: [] }),
    floor: g, day: 1, steps: 0, store: null, beats: null, party: [mu], dead: false, deathNote: "", epitaph: "",
    combat: { foes, type: "Beasts", round: 1, target: 0, spellOpen: false, tracked: false, allies: [{ partyIdx: 0, name: "Ada", lvl: 3, sub: "Wizard", wp: 20, maxWP: 20 }] },
  };
}

test("a Joiner's Doze and Weaken roll the same single depth-rising resist per foe (with `by`), no controlResisted, a landed Doze lasts its d4", () => {
  const f1 = foe("J1", { intel: 10, type: "Humans", wp: 30 });
  const s = joinerState(20, ["Doze"], [f1]);
  // The Joiner's resist keys on its own name: search with caster "Ada".
  const probe = { getState: () => 0 };
  for (let acts = 0; acts <= 20000; acts++) {
    if (!foeRisingResistCheck({ floor: { depth: 20 }, acts, combat: { round: 1 } }, probe, "Doze", 0, 10, "Ada").resisted) {
      s.acts = acts;
      break;
    }
  }
  const events = alliesTurn(s, fakeRng([3, ...ONES(40)]), []);
  const lines = events.filter(isResistLine);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].by, "Ada");
  assert.equal(lines[0].faces, risingResistFaces(20, 10));
  assert.equal(lines[0].depthFaces, 6);
  assert.equal(events.some((e) => e.type === "controlResisted"), false);
  assert.equal(events.find((e) => e.type === "allySpellHit").rounds, 3, "the rolled d4, never capped");
  assert.equal(f1.asleep, 3);

  const w1 = foe("W1", { intel: 10, type: "Humans", wp: 30 });
  const w2 = foe("W2", { intel: 10, type: "Humans", wp: 30 });
  const sw = joinerState(20, ["Weaken"], [w1, w2]);
  for (let acts = 0; acts <= 20000; acts++) {
    const fails = [0, 1].every((i) => !foeRisingResistCheck({ floor: { depth: 20 }, acts, combat: { round: 1 } }, probe, "Weaken", i, 10, "Ada").resisted);
    if (fails) {
      sw.acts = acts;
      break;
    }
  }
  const ev = alliesTurn(sw, fakeRng([3, ...ONES(40)]), []);
  assert.equal(ev.filter(isResistLine).length, 2, "one resist per live foe");
  assert.equal(ev.some((e) => e.type === "controlResisted"), false);
  assert.equal(sw.combat.weakened, true);
});

// ---------------------------------------------------------------------------
// Source guard: no spell site calls the RULES-18 helpers.
// ---------------------------------------------------------------------------

const stripComments = (src) => src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");

test("engine/magic.js castSpell and combat.js allyCast call neither resistControl, controlHoldRoundsFor nor controlCapRounds (the Bard's sing is the one caller left)", () => {
  const magic = stripComments(fs.readFileSync("engine/magic.js", "utf8"));
  for (const token of ["resistControl(", "controlHoldRoundsFor(", "controlCapRounds(", "holdFoe("]) assert.equal(magic.includes(token), false, `magic.js: ${token}`);
  const combat = fs.readFileSync("engine/combat.js", "utf8").replace(/\r\n/g, "\n");
  const ally = stripComments(combat.slice(combat.indexOf("function allyCast("), combat.indexOf("export function downMember(")));
  assert.equal(ally.includes("resistControl("), false, "allyCast");
  const sing = stripComments(combat.slice(combat.indexOf("export function sing("), combat.indexOf("export function sing(") + 6000));
  assert.ok(sing.includes("resistControl("), "sing still rolls the RULES-18 resist until Phase 91 (IDENT-17)");
});

test("foeResistsSpell IS the depth-rising gate: a floor-20 spell resist line carries depthFaces and the helper's faces, a floor-12 one carries none", () => {
  const at = (depth) => {
    const s = spellState(depth, "Acid", 2, 1);
    s.acts = 3;
    return castSpell(s, IDX.Acid, fakeRng(ONES(80)), []).find(isResistLine);
  };
  assert.equal(at(12).faces, 5);
  assert.equal("depthFaces" in at(12), false);
  assert.equal(at(20).faces, 11);
  assert.equal(at(20).depthFaces, 6);
});
