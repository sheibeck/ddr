// test/unit/control-spells-depth.test.js
//
// Phase 75.3, Plan 05 (RULES-18) — "Control spells at depth", the hero's own
// spells and the control items. 75.3-04 built the rule (CONTROL_AT_DEPTH,
// engine/combat.js#resistControl / #holdFoe) and wired every combat.js site;
// this file covers the control audit's remaining rows (75.3-04-PLAN.md):
//   C1 Freeze, C5 Petrify, C7 Doze, C8 Stun, C10 Noxious Vapor's sleep, C11
//   Insane's sleep face, C14 Weaken, C17 Stupidity, C18 Blind, C19 Shrink
//   (engine/magic.js#castSpell), a scroll cast through the same branch, and
//   C4 Birch Staff, C6 Oak Staff / Amulet of Stone, C12 Cedar Staff, C16
//   Walnut Staff (engine/items.js#useItem), plus the honest texts.
//
// Runs under the SHIPPED dials (CONTROL_AT_DEPTH { kneeDepth 12,
// resistPerDepth 1, resistCap 15, holdRounds 3 }): floor 20 carries 8 resist
// faces and a 3-round hold; floor 12 carries neither.
//
// Determinism idiom (75.3-04's): a forced resist / land outcome is found by
// searching state.acts against the REAL engine/derived.js#controlResistCheck
// off the fake rng's fixed cursor (getState -> 0), never a mocked stream.
//
// The floor-12 digests below were captured from the PRE-PLAN engine (base
// 15d08ab, before this plan's magic.js / items.js edits) with this file's own
// scenario builders — they are written expectations, never regenerated from
// the new code.

import test from "node:test";
import assert from "node:assert/strict";

import { castSpell, readScroll } from "../../engine/magic.js";
import { useItem } from "../../engine/items.js";
import { foeTurn } from "../../engine/combat.js";
import { controlResistCheck, foeSpellResistCheck } from "../../engine/derived.js";
import { DIALS, controlHoldRoundsFor } from "../../engine/difficulty.js";
import { SPELLS } from "../../content/index.js";
import { STAVES, JEWELRY } from "../../content/treasure-tables.js";
import { GW, GH } from "../../engine/maze.js";

const IDX = Object.fromEntries(SPELLS.map((sp, i) => [sp.n, i]));
const PAD = (n, v = 10) => new Array(n).fill(v);

/** fakeRng(seq) — `.d()` pops the next value; throws on underflow. The
 * cursor (`getState`) is a FIXED 0 so a forced resist outcome never depends
 * on how many main draws came first; `count()` is the real number of main
 * draws taken (the main-draw parity measure). */
function fakeRng(seq) {
  let i = 0;
  return {
    d(_sides) {
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
  return { name, type: "Beasts", lvl: 1, size: "S", intel: 1, wp: 30, maxWP: 30, alive: true, asleep: 0, sp: {}, lives: 1, ...overrides };
}

/** spellState(depth, spellName, level, nFoes) — a Wizard with `spellName` in
 * its book, in a live fight against `nFoes` intel-1 Beasts (no intel resist
 * draw), targeting the first. */
function spellState(depth, spellName, level, nFoes, foeOverrides = {}) {
  return {
    version: 1, seed: 1, rngState: 1, acts: 0,
    c: hero({ level, grimoire: [spellName] }),
    floor: fixedFloor(depth),
    day: 1, steps: 0, store: null, beats: null, dead: false, deathNote: "", epitaph: "",
    combat: {
      foes: Array.from({ length: nFoes }, (_, k) => foe(`F${k + 1}`, foeOverrides)),
      type: "Beasts", round: 1, target: 0, spellOpen: false, tracked: false,
    },
  };
}

/** findActs(depth, wants) — the first state.acts (0..5000) whose REAL
 * controlResistCheck gives every `[purpose, idx, resisted]` in `wants`, off
 * cursor 0, round 1 (every cast-time resist happens before the round ticks). */
function findActs(depth, wants) {
  const probe = { getState: () => 0 };
  // Quick 260927-rsx: this file pins the RULES-18 depth resist, so the acts
  // it picks must also leave every foe failing the (earlier, separate) intel
  // resist for the same source — see intelQuiet below.
  const source = wants.length ? wants[0][0].slice(wants[0][0].indexOf(":") + 1) : "";
  for (let acts = 0; acts <= 20000; acts++) {
    const ok = wants.every(([purpose, idx, resisted]) => {
      const r = controlResistCheck({ floor: { depth }, acts, combat: { round: 1 } }, probe, purpose, idx);
      return r.rolled && r.resisted === resisted;
    });
    if (ok && intelQuiet(acts, source)) return acts;
  }
  throw new Error(`findActs: nothing for ${JSON.stringify(wants)} at depth ${depth}`);
}

/** intelQuiet(acts, source) — quick 260927-rsx (user ruling 2026-09-27):
 * every spell cast on a foe first rolls the foe's intel resist
 * (engine/derived.js#foeSpellResistCheck, a derived stream off the same fixed
 * cursor). This file's scenarios pin the depth rule, so they run at an acts
 * where none of the (up to five, intel-1) foes resists `source` that way. */
function intelQuiet(acts, source) {
  const probe = { getState: () => 0 };
  for (let idx = 0; idx < 5; idx++) {
    if (foeSpellResistCheck({ acts, combat: { round: 1 } }, probe, source, idx, 1).resisted) return false;
  }
  return true;
}

/** quietActs(source) — the first acts where intelQuiet holds. */
function quietActs(source) {
  for (let acts = 0; acts <= 20000; acts++) if (intelQuiet(acts, source)) return acts;
  throw new Error(`quietActs: nothing for ${source}`);
}

/** markingEvents(rng, type) — an events array that records the main-draw
 * count each time an event of `type` is pushed. With `c.regen` on and the
 * hero below full hp, foeTurn's FIRST draw is the regen d8, pushed as
 * `regenerated` — so the count at that push is (the cast's own draws + 1),
 * whatever the foes then do. */
function markingEvents(rng, type) {
  const ev = [];
  ev.marks = [];
  ev.push = function push(...xs) {
    for (const x of xs) if (x && x.type === type) ev.marks.push(rng.count());
    return Array.prototype.push.apply(ev, xs);
  };
  return ev;
}

const FIELDS = ["wp", "maxWP", "alive", "asleep", "stupid", "blind", "blindFor", "frozen", "shrunk", "held", "resisted"];
const CAST = new Set(["stunned", "dozed", "weakened", "stupefied", "blinded", "shrunk", "petrified", "vaporRolled", "insaneRolled", "spellHit", "frozenSolid", "foeStoned", "controlResisted", "controlHeld"]);
function digest(s, events, rng) {
  return {
    n: rng.count(),
    // Quick 260927-rsx (declared): the intel resist is new since the pre-plan
    // capture; its failed rolls (resistFailed) are dropped from the digest,
    // and every scenario runs at an acts where no foe resists (intelQuiet),
    // so the pre-plan expectations below stand as written.
    ev: events.map((e) => e.type).filter((t) => t !== "resistFailed"),
    cast: events.filter((e) => CAST.has(e.type)),
    foes: s.combat ? s.combat.foes.map((f) => Object.fromEntries(FIELDS.filter((k) => k in f).map((k) => [k, f[k]]))) : null,
    weakened: s.combat ? !!s.combat.weakened : null,
    timers: s.c.timers ? Object.keys(s.c.timers) : [],
  };
}

/** The ten spell scenarios: [spell, caster level, foes, main sequence]. */
const SPELL_SCENARIOS = {
  Freeze: ["Freeze", 1, 2, [1, 4, ...PAD(20)]],
  Doze: ["Doze", 1, 1, [3, ...PAD(20)]],
  Stun: ["Stun", 1, 3, [6, 2, 3, 4, ...PAD(20)]],
  Weaken: ["Weaken", 1, 2, [3, ...PAD(20)]],
  Stupidity: ["Stupidity", 2, 1, [...PAD(20)]],
  Blind: ["Blind", 3, 1, [...PAD(20)]],
  Shrink: ["Shrink", 3, 3, [6, ...PAD(20)]],
  Petrify: ["Petrify", 5, 2, [...PAD(20)]],
  Vapor: ["Noxious Vapor", 4, 2, [2, 3, 5, ...PAD(20)]],
  Insane: ["Insane", 2, 1, [4, 2, ...PAD(20)]],
};

function castScenario(key, depth, acts = quietActs(SPELL_SCENARIOS[key][0])) {
  const [name, level, nFoes, seq] = SPELL_SCENARIOS[key];
  const s = spellState(depth, name, level, nFoes);
  s.acts = acts;
  const rng = fakeRng(seq);
  const events = castSpell(s, IDX[name], rng, []);
  return { s, rng, events };
}

// Pre-plan engine (base 15d08ab), floor 12 — see the header.
// User rulings 2026-09-28 (declared): Freeze no longer kills at or below the
// knee (damage, then a d4-round freeze at every depth), so its floor-12 row
// is gone from this pre-plan table; test/unit/freeze-rule.test.js pins it.
const PRE_PLAN_FLOOR_12 = {
  Doze: { n: 1, ev: ["dozed", "foeSlept"], cast: [{ type: "dozed", target: "F1", rounds: 3 }], foes: [{ wp: 30, maxWP: 30, alive: true, asleep: 2 }], weakened: false, timers: [] },
  Stun: { n: 4, ev: ["stunned", "foeSlept", "foeSlept", "foeSlept"], cast: [{ type: "stunned", count: 3 }], foes: [{ wp: 30, maxWP: 30, alive: true, asleep: 1 }, { wp: 30, maxWP: 30, alive: true, asleep: 2 }, { wp: 30, maxWP: 30, alive: true, asleep: 3 }], weakened: false, timers: [] },
  Weaken: { n: 3, ev: ["weakened", "foeMissed", "foeMissed"], cast: [{ type: "weakened", rounds: 4 }], foes: [{ wp: 30, maxWP: 30, alive: true, asleep: 0 }, { wp: 30, maxWP: 30, alive: true, asleep: 0 }], weakened: true, timers: ["spell:weaken"] },
  Stupidity: { n: 0, ev: ["stupefied", "foeStupefied"], cast: [{ type: "stupefied", target: "F1" }], foes: [{ wp: 30, maxWP: 30, alive: true, asleep: 0, stupid: true }], weakened: false, timers: [] },
  Blind: { n: 1, ev: ["blinded", "foeMissed"], cast: [{ type: "blinded", target: "F1" }], foes: [{ wp: 30, maxWP: 30, alive: true, asleep: 0, blind: true }], weakened: false, timers: [] },
  Shrink: { n: 4, ev: ["shrunk", "foeMissed", "foeMissed", "foeMissed"], cast: [{ type: "shrunk", count: 3 }], foes: [{ wp: 15, maxWP: 15, alive: true, asleep: 0, shrunk: true }, { wp: 15, maxWP: 15, alive: true, asleep: 0, shrunk: true }, { wp: 15, maxWP: 15, alive: true, asleep: 0, shrunk: true }], weakened: false, timers: [] },
  Petrify: { n: 1, ev: ["petrified", "foeMissed"], cast: [{ type: "petrified", target: "F1" }], foes: [{ wp: 0, maxWP: 30, alive: false, asleep: 0, frozen: true }, { wp: 30, maxWP: 30, alive: true, asleep: 0 }], weakened: false, timers: [] },
  Vapor: { n: 3, ev: ["vaporRolled", "foeSlept", "foeSlept"], cast: [{ type: "vaporRolled", roll: 2 }], foes: [{ wp: 30, maxWP: 30, alive: true, asleep: 4 }, { wp: 30, maxWP: 30, alive: true, asleep: 6 }], weakened: false, timers: [] },
  Insane: { n: 2, ev: ["insaneRolled", "foeSlept"], cast: [{ type: "insaneRolled", target: "F1", roll: 4 }], foes: [{ wp: 30, maxWP: 30, alive: true, asleep: 1 }], weakened: false, timers: [] },
};

// ---------------------------------------------------------------------------
// Task 1: the hero's control spells (engine/magic.js#castSpell).
// ---------------------------------------------------------------------------

test("floor 12: every hero control spell (Freeze excepted, user rulings 2026-09-28) matches the pre-plan engine exactly (events, foes, draws)", () => {
  for (const key of Object.keys(SPELL_SCENARIOS)) {
    if (key === "Freeze") continue; // moved by the 2026-09-28 rulings: freeze-rule.test.js
    const { s, rng, events } = castScenario(key, 12);
    assert.deepEqual(digest(s, events, rng), PRE_PLAN_FLOOR_12[key], key);
    assert.equal(events.some((e) => e.type === "controlResisted" || e.type === "controlHeld"), false, key);
  }
});

// User rulings 2026-09-28 (re-pinned): the hold is the rolled d4 at every
// depth (FREEZE_HOLD_DIE), not controlHoldRoundsFor; the d4 is one new main
// draw right after the damage. This row rolls a 3, the old hold's number.
test("Freeze (C1) floor 20: a hit that leaves the foe standing and is not resisted holds it for the rolled d4 (3) — alive, none of killFoe's draws", () => {
  const s = spellState(20, "Freeze", 1, 1);
  s.acts = findActs(20, [["freeze:Freeze", 0, false]]);
  const rng = fakeRng([1, 4, 3]); // to-hit d10 (raw 1 -> 10), damage d6 = 4, hold d4 = 3 — nothing else may draw
  const events = castSpell(s, IDX.Freeze, rng, []);
  const f = s.combat.foes[0];
  assert.equal(f.alive, true);
  assert.equal(f.wp, 25); // d6 4 + the level-1 caster's level² 1 (quick 260928-sq2)
  assert.equal("frozen" in f, false);
  const held = events.find((e) => e.type === "controlHeld");
  assert.deepEqual({ kind: held.kind, rounds: held.rounds, source: held.source, freeze: held.freeze }, { kind: "frozen", rounds: 3, source: "Freeze", freeze: true });
  // The same dispatch's foeTurn spends the first held visit (one-tick-already-spent).
  assert.deepEqual(f.held, { kind: "frozen", left: 2 });
  assert.equal(events.some((e) => e.type === "frozenSolid" || e.type === "foeKilled"), false);
  assert.equal(rng.count(), 3);
});

test("Freeze (C1) floor 20: a resisted hit leaves the foe standing and damaged — controlResisted, no hold, no kill", () => {
  const s = spellState(20, "Freeze", 1, 1);
  s.acts = findActs(20, [["freeze:Freeze", 0, true]]);
  const events = castSpell(s, IDX.Freeze, fakeRng([1, 4, ...PAD(10)]), []);
  const f = s.combat.foes[0];
  assert.equal(f.alive, true);
  assert.equal(f.wp, 25); // d6 4 + level² 1 (quick 260928-sq2)
  assert.equal(f.resisted, "freeze");
  assert.equal("held" in f, false);
  const r = events.find((e) => e.type === "controlResisted");
  assert.equal(r.source, "Freeze");
  assert.equal(r.effect, "freeze");
  assert.equal(events.some((e) => e.type === "frozenSolid" || e.type === "foeKilled"), false);
});

// User rulings 2026-09-28 (re-pinned): a Freeze whose damage kills is a
// NORMAL kill at every depth — never frozen solid.
test("Freeze (C1): a blow that drops the foe to 0 hp is a normal kill (no frozenSolid, not frozen), on floor 20 and floor 12", () => {
  for (const depth of [12, 20]) {
    const s = spellState(depth, "Freeze", 1, 2, { wp: 3 });
    const events = castSpell(s, IDX.Freeze, fakeRng([1, 4, ...PAD(10)]), []);
    assert.equal(s.combat.foes[0].alive, false, `depth ${depth}`);
    assert.equal(events.some((e) => e.type === "frozenSolid"), false, `depth ${depth}`);
    assert.equal("frozen" in s.combat.foes[0], false, `depth ${depth}`);
    assert.ok(events.some((e) => e.type === "foeKilled"), `depth ${depth}`);
    assert.equal(events.some((e) => e.type === "controlResisted" || e.type === "controlHeld"), false, `depth ${depth}`);
  }
});

test("Doze (C7) floor 20: resisted -> no dozed, awake, Unmoved; landed -> asleep the rolled d4; the d4 is drawn either way", () => {
  const r = spellState(20, "Doze", 1, 1);
  r.acts = findActs(20, [["sleep:Doze", 0, true]]);
  const rngR = fakeRng([3, ...PAD(10)]);
  const evR = castSpell(r, IDX.Doze, rngR, []);
  assert.equal(r.combat.foes[0].asleep, 0);
  assert.equal(r.combat.foes[0].resisted, "sleep");
  assert.equal(evR.some((e) => e.type === "dozed"), false);
  assert.ok(evR.some((e) => e.type === "controlResisted"));

  const l = spellState(20, "Doze", 1, 1);
  l.acts = findActs(20, [["sleep:Doze", 0, false]]);
  const evL = castSpell(l, IDX.Doze, fakeRng([3, ...PAD(10)]), []);
  assert.equal(evL.find((e) => e.type === "dozed").rounds, 3, "the rolled d4, never capped");
  assert.equal(l.combat.foes[0].asleep, 2, "one visit already spent this dispatch");
  assert.equal("resisted" in l.combat.foes[0], false);
});

test("Stun (C8) floor 20: three affected foes, the second resists — 1 and 3 asleep, 2 awake and Unmoved; count 2; one d4 per foe", () => {
  const s = spellState(20, "Stun", 1, 3);
  s.acts = findActs(20, [["sleep:Stun", 0, false], ["sleep:Stun", 1, true], ["sleep:Stun", 2, false]]);
  const rng = fakeRng([6, 2, 3, 4, ...PAD(10)]);
  const events = castSpell(s, IDX.Stun, rng, []);
  const [f1, f2, f3] = s.combat.foes;
  assert.equal(f1.asleep, 1); // d4 2, one visit spent
  assert.equal(f2.asleep, 0);
  assert.equal(f2.resisted, "sleep");
  assert.equal(f3.asleep, 3); // d4 4, one visit spent
  assert.equal(events.find((e) => e.type === "stunned").count, 2);
  assert.equal(events.filter((e) => e.type === "controlResisted").length, 1);
});

test("Weaken (C14) floor 20: resisted -> no weakened flag, no timer, every live foe Unmoved; landed -> today's d4+1", () => {
  const r = spellState(20, "Weaken", 1, 2);
  r.acts = findActs(20, [["weaken:Weaken", 0, true]]);
  const rngR = fakeRng([3, ...PAD(10)]);
  const evR = castSpell(r, IDX.Weaken, rngR, []);
  assert.equal(!!r.combat.weakened, false);
  assert.equal(r.c.timers && r.c.timers["spell:weaken"], undefined);
  assert.deepEqual(r.combat.foes.map((f) => f.resisted), ["weaken", "weaken"]);
  assert.equal(evR.some((e) => e.type === "weakened"), false);
  assert.equal(evR.filter((e) => e.type === "controlResisted").length, 1, "one resist for the room");

  const l = spellState(20, "Weaken", 1, 2);
  l.acts = findActs(20, [["weaken:Weaken", 0, false]]);
  const evL = castSpell(l, IDX.Weaken, fakeRng([3, ...PAD(10)]), []);
  assert.equal(l.combat.weakened, true);
  assert.equal(evL.find((e) => e.type === "weakened").rounds, 4);
  assert.ok(l.c.timers["spell:weaken"]);
});

test("Stupidity (C17): floor 20 landed -> a stupid hold of 3, no fight-long flag; floor 12 -> today's flag", () => {
  const s = spellState(20, "Stupidity", 2, 1);
  s.acts = findActs(20, [["stupid:Stupidity", 0, false]]);
  const events = castSpell(s, IDX.Stupidity, fakeRng(PAD(10)), []);
  const f = s.combat.foes[0];
  assert.equal("stupid" in f, false);
  const held = events.find((e) => e.type === "controlHeld");
  assert.deepEqual({ kind: held.kind, rounds: held.rounds }, { kind: "stupid", rounds: 3 });
  assert.deepEqual(f.held, { kind: "stupid", left: 2 });

  const r = spellState(20, "Stupidity", 2, 1);
  r.acts = findActs(20, [["stupid:Stupidity", 0, true]]);
  castSpell(r, IDX.Stupidity, fakeRng(PAD(10)), []);
  assert.equal(r.combat.foes[0].resisted, "stupid");
  assert.equal("held" in r.combat.foes[0], false);
  assert.equal("stupid" in r.combat.foes[0], false);

  const { s: t } = castScenario("Stupidity", 12);
  assert.equal(t.combat.foes[0].stupid, true);
});

test("Blind (C18): floor 20 landed -> blind with blindFor 3 and blinded.rounds 3; floor 12 -> blind for the fight, no blindFor", () => {
  const s = spellState(20, "Blind", 3, 1);
  s.acts = findActs(20, [["blind:Blind", 0, false]]);
  const events = castSpell(s, IDX.Blind, fakeRng(PAD(10)), []);
  const f = s.combat.foes[0];
  assert.equal(f.blind, true);
  assert.equal(events.find((e) => e.type === "blinded").rounds, 3);
  assert.equal(f.blindFor, 2, "the foe's own visit this dispatch ticks the countdown once");

  const r = spellState(20, "Blind", 3, 1);
  r.acts = findActs(20, [["blind:Blind", 0, true]]);
  const evR = castSpell(r, IDX.Blind, fakeRng(PAD(10)), []);
  assert.equal(!!r.combat.foes[0].blind, false);
  assert.equal(evR.some((e) => e.type === "blinded"), false);
  assert.equal(r.combat.foes[0].resisted, "blind");

  const { s: t, events: evT } = castScenario("Blind", 12);
  assert.equal(t.combat.foes[0].blind, true);
  assert.equal("blindFor" in t.combat.foes[0], false);
  assert.equal("rounds" in evT.find((e) => e.type === "blinded"), false);
});

test("Shrink (C19) floor 20: a resisting foe keeps its hp; the others halve; shrunk.count counts the halved", () => {
  const s = spellState(20, "Shrink", 3, 3);
  s.acts = findActs(20, [["shrink:Shrink", 0, false], ["shrink:Shrink", 1, true], ["shrink:Shrink", 2, false]]);
  const events = castSpell(s, IDX.Shrink, fakeRng([6, ...PAD(10)]), []);
  const [f1, f2, f3] = s.combat.foes;
  assert.equal(f1.wp, 15);
  assert.equal(f2.wp, 30);
  assert.equal(f2.maxWP, 30);
  assert.equal("shrunk" in f2, false);
  assert.equal(f2.resisted, "shrink");
  assert.equal(f3.wp, 15);
  assert.equal(events.find((e) => e.type === "shrunk").count, 2);
});

test("Petrify (C5): floor 20 landed -> a stone hold of 3, the foe alive; resisted -> flesh, Unmoved; floor 12 -> today's removal", () => {
  const s = spellState(20, "Petrify", 5, 2);
  s.acts = findActs(20, [["stone:Petrify", 0, false]]);
  const events = castSpell(s, IDX.Petrify, fakeRng(PAD(10)), []);
  const f = s.combat.foes[0];
  assert.equal(f.alive, true);
  assert.equal(f.wp, 30);
  assert.deepEqual(f.held, { kind: "stone", left: 2 });
  assert.equal(events.find((e) => e.type === "controlHeld").rounds, 3);
  assert.equal(events.some((e) => e.type === "petrified"), false);

  const r = spellState(20, "Petrify", 5, 2);
  r.acts = findActs(20, [["stone:Petrify", 0, true]]);
  castSpell(r, IDX.Petrify, fakeRng(PAD(10)), []);
  assert.equal(r.combat.foes[0].alive, true);
  assert.equal(r.combat.foes[0].resisted, "stone");
  assert.equal("held" in r.combat.foes[0], false);

  const { s: t } = castScenario("Petrify", 12);
  assert.equal(t.combat.foes[0].alive, false);
  assert.equal(t.combat.foes[0].frozen, true);
});

test("Noxious Vapor's sleep (C10) and Insane's sleep face (C11) floor 20: a resisting foe stays awake; the d6 / d4 draws happen as today", () => {
  const v = spellState(20, "Noxious Vapor", 4, 2);
  v.acts = findActs(20, [["sleep:Noxious Vapor", 0, true], ["sleep:Noxious Vapor", 1, false]]);
  const vRng = fakeRng([2, 3, 5, ...PAD(10)]);
  castSpell(v, IDX["Noxious Vapor"], vRng, []);
  assert.equal(v.combat.foes[0].asleep, 0);
  assert.equal(v.combat.foes[0].resisted, "sleep");
  assert.equal(v.combat.foes[1].asleep, 6); // d6 5 + 2 = 7, one visit spent

  const i = spellState(20, "Insane", 2, 1);
  i.acts = findActs(20, [["sleep:Insane", 0, true]]);
  castSpell(i, IDX.Insane, fakeRng([4, 2, ...PAD(10)]), []);
  assert.equal(i.combat.foes[0].asleep, 0);
  assert.equal(i.combat.foes[0].resisted, "sleep");

  const j = spellState(20, "Insane", 2, 1);
  j.acts = findActs(20, [["sleep:Insane", 0, false]]);
  castSpell(j, IDX.Insane, fakeRng([4, 2, ...PAD(10)]), []);
  assert.equal(j.combat.foes[0].asleep, 1);
});

test("main-draw parity: for every control spell on floor 20, a resisted and a landed cast from the same main sequence take the same main draws", () => {
  // [scenario key, purpose, foe idx list] — every affected foe resists in one
  // run and none in the other (Freeze: resisted vs held). The last column is
  // the cast's own main draws in the pre-plan code (Freeze: to-hit + damage,
  // before any kill; Stun: d6 + a d4 per foe; Vapor: d6 + a d6 per foe; ...).
  // User rulings 2026-09-28 (re-pinned): Freeze's cast now takes 3 main
  // draws either way — to-hit, damage and the hold's d4 (drawn resisted or
  // not, like Doze's d4).
  const CASES = [
    ["Freeze", "freeze:Freeze", [0], 3],
    ["Doze", "sleep:Doze", [0], 1],
    ["Stun", "sleep:Stun", [0, 1, 2], 4],
    ["Weaken", "weaken:Weaken", [0], 1],
    ["Stupidity", "stupid:Stupidity", [0], 0],
    ["Blind", "blind:Blind", [0], 0],
    ["Shrink", "shrink:Shrink", [0, 1, 2], 1],
    ["Petrify", "stone:Petrify", [0], 0],
    ["Vapor", "sleep:Noxious Vapor", [0, 1], 3],
    ["Insane", "sleep:Insane", [0], 2],
  ];
  for (const [key, purpose, idxs, castDraws] of CASES) {
    const marks = [true, false].map((resisted) => {
      const [name, level, nFoes, seq] = SPELL_SCENARIOS[key];
      const s = spellState(20, name, level, nFoes);
      s.c.regen = true;
      s.c.wp = 20;
      s.acts = findActs(20, idxs.map((i) => [purpose, i, resisted]));
      const rng = fakeRng([...seq, ...PAD(20)]);
      const events = markingEvents(rng, "regenerated");
      castSpell(s, IDX[name], rng, events);
      assert.equal(events.some((e) => e.type === "controlResisted"), resisted, `${key} resisted=${resisted}`);
      assert.equal(events.marks.length, 1, `${key}: the regen marker fired once`);
      return events.marks[0];
    });
    assert.equal(marks[0], marks[1], `${key}: the main rng stands at the same draw either way`);
    assert.equal(marks[0], castDraws + 1,`${key}: exactly the pre-plan cast's own draws, then the regen d8`);
  }
});

test("a scroll of Freeze read in combat on floor 20 meets the same rule (castSpell's own branch)", () => {
  const s = spellState(20, "Freeze", 1, 1);
  s.c.scrolls = 1;
  s.acts = findActs(20, [["freeze:Freeze", 0, false]]);
  // User rulings 2026-09-28: plus the hold's d4 (3).
  const rng = { ...fakeRng([1, 4, 3]), pick: (arr) => arr.find((sp) => sp.n === "Freeze") };
  const events = readScroll(s, rng, []);
  assert.ok(events.some((e) => e.type === "scrollCast" && e.spell === "Freeze"));
  assert.ok(events.some((e) => e.type === "controlHeld" && e.kind === "frozen" && e.rounds === 3));
  assert.equal(s.combat.foes[0].alive, true);
  assert.equal(events.some((e) => e.type === "foeKilled"), false);
});

test("the held dial is what the spells read: controlHoldRoundsFor(20) is CONTROL_AT_DEPTH.holdRounds, and 0 through floor 12", () => {
  assert.equal(controlHoldRoundsFor(20), DIALS.CONTROL_AT_DEPTH.holdRounds);
  for (let d = 1; d <= DIALS.CONTROL_AT_DEPTH.kneeDepth; d++) assert.equal(controlHoldRoundsFor(d), 0);
});

// ---------------------------------------------------------------------------
// Task 2: the control items (engine/items.js#useItem) and the honest texts.
// ---------------------------------------------------------------------------

/** The five item scenarios: [item, foes]. Staves are wielded (RULES-13);
 * the Amulet of Stone is a legacy bag use (no `c.worn`). */
const ITEM_SCENARIOS = {
  Birch: [() => ({ kind: "staff", n: "Birch Staff", use: "freeze", charges: 2 }), 3],
  Cedar: [() => ({ kind: "staff", n: "Cedar Staff", use: "gas", charges: 1 }), 3],
  Oak: [() => ({ kind: "staff", n: "Oak Staff", use: "stone", charges: 1 }), 3],
  Walnut: [() => ({ kind: "staff", n: "Walnut Staff", use: "weaken", charges: 2 }), 2],
  Amulet: [() => ({ n: "Amulet of Stone", use: "stone", every: 100, aoe: 4 }), 5],
};

function useScenario(key, depth, acts = quietActs(ITEM_SCENARIOS[key][0]().n), seq = PAD(40)) {
  const [make, nFoes] = ITEM_SCENARIOS[key];
  const it = make();
  const s = spellState(depth, "Doze", 1, nFoes);
  s.acts = acts;
  if (it.kind === "staff") {
    s.c.weapon = it.n;
    s.c.staff = it;
  } else {
    s.c.items = [it];
  }
  const rng = fakeRng(seq);
  const events = useItem(s, it.kind === "staff" ? { slot: "weapon" } : 0, rng, [], () => 0);
  return { s, rng, events };
}

// Pre-plan engine (base 15d08ab), floor 12 — see the header.
// User rulings 2026-09-28 (declared): the Birch Staff's freeze follows the
// Freeze spell (a d4-round hold at every depth, never asleep 99), so its
// floor-12 row is gone from this pre-plan table; freeze-rule.test.js pins it.
const PRE_PLAN_ITEMS_FLOOR_12 = {
  Cedar: { n: 0, ev: ["itemUsed"], cast: [], foes: [{ wp: 30, maxWP: 30, alive: true, asleep: 99 }, { wp: 30, maxWP: 30, alive: true, asleep: 99 }, { wp: 30, maxWP: 30, alive: true, asleep: 99 }], weakened: false, timers: ["charges:Cedar Staff"] },
  Oak: { n: 8, ev: ["itemUsed", "foeStoned", "foeKilled", "goldGained", "cooked", "foeKilled", "goldGained", "cooked"], cast: [{ type: "foeStoned", names: ["F1", "F2"] }], foes: [{ wp: 0, maxWP: 30, alive: false, asleep: 0 }, { wp: 0, maxWP: 30, alive: false, asleep: 0 }, { wp: 30, maxWP: 30, alive: true, asleep: 0 }], weakened: false, timers: ["charges:Oak Staff"] },
  Walnut: { n: 0, ev: ["itemUsed"], cast: [], foes: [{ wp: 30, maxWP: 30, alive: true, asleep: 0 }, { wp: 30, maxWP: 30, alive: true, asleep: 0 }], weakened: true, timers: ["charges:Walnut Staff"] },
  Amulet: { n: 16, ev: ["itemUsed", "foeStoned", "foeKilled", "goldGained", "cooked", "foeKilled", "goldGained", "cooked", "foeKilled", "goldGained", "cooked", "foeKilled", "goldGained", "cooked"], cast: [{ type: "foeStoned", names: ["F1", "F2", "F3", "F4"] }], foes: [{ wp: 0, maxWP: 30, alive: false, asleep: 0 }, { wp: 0, maxWP: 30, alive: false, asleep: 0 }, { wp: 0, maxWP: 30, alive: false, asleep: 0 }, { wp: 0, maxWP: 30, alive: false, asleep: 0 }, { wp: 30, maxWP: 30, alive: true, asleep: 0 }], weakened: false, timers: ["item:Amulet of Stone"] },
};

test("floor 12: every control item (the Birch Staff excepted, user rulings 2026-09-28) matches the pre-plan engine exactly (events, foes, draws)", () => {
  for (const key of Object.keys(ITEM_SCENARIOS)) {
    if (key === "Birch") continue; // moved by the 2026-09-28 rulings: freeze-rule.test.js
    const { s, rng, events } = useScenario(key, 12);
    assert.deepEqual(digest(s, events, rng), PRE_PLAN_ITEMS_FLOOR_12[key], key);
  }
});

// User rulings 2026-09-28 (re-pinned): the staff's freeze is a frozen hold
// for a rolled d4 (one main draw per foe reached, resisted or not), never a
// 99-round (or 3-round) sleep.
test("Birch Staff (C4) floor 20: the first target resists (awake, Unmoved, not held), the second is frozen for its d4 (3); one d4 per foe reached", () => {
  const acts = findActs(20, [["freeze:Birch Staff", 0, true], ["freeze:Birch Staff", 1, false]]);
  const { s, rng, events } = useScenario("Birch", 20, acts, [2, 3, ...PAD(40)]);
  const [f1, f2, f3] = s.combat.foes;
  assert.equal(f1.asleep, 0);
  assert.equal(f1.resisted, "freeze");
  assert.equal("held" in f1, false);
  assert.equal(f2.asleep, 0);
  assert.equal(events.find((e) => e.type === "controlHeld" && e.target === "F2").rounds, 3);
  assert.equal(f3.asleep, 0, "outside the staff's two squares");
  assert.equal("held" in f3, false, "outside the staff's two squares");
  assert.equal(events.filter((e) => e.type === "controlResisted").length, 1);
  assert.equal(rng.count(), 2);
});

test("Cedar Staff (C12) floor 20: every non-resisting foe sleeps 3 (not 99); a resisting one stays awake", () => {
  const acts = findActs(20, [["sleep:Cedar Staff", 0, false], ["sleep:Cedar Staff", 1, true], ["sleep:Cedar Staff", 2, false]]);
  const { s, rng } = useScenario("Cedar", 20, acts);
  assert.deepEqual(s.combat.foes.map((f) => f.asleep), [3, 0, 3]);
  assert.equal(s.combat.foes[1].resisted, "sleep");
  assert.equal(rng.count(), 0);
});

test("Oak Staff and Amulet of Stone (C6) floor 20: a non-resisting target is held as stone and alive, and foeStoned never names it", () => {
  const acts = findActs(20, [["stone:Oak Staff", 0, false], ["stone:Oak Staff", 1, true]]);
  const { s, rng, events } = useScenario("Oak", 20, acts);
  const [f1, f2] = s.combat.foes;
  assert.equal(f1.alive, true);
  assert.deepEqual(f1.held, { kind: "stone", left: 3 }, "an item is a free action: no foe turn spends the hold yet");
  assert.equal(f2.alive, true);
  assert.equal(f2.resisted, "stone");
  assert.equal(events.some((e) => e.type === "foeStoned"), false);
  assert.equal(events.some((e) => e.type === "foeKilled"), false);
  assert.equal(rng.count(), 0, "nothing died, so none of killFoe's draws");

  const actsA = findActs(20, [0, 1, 2, 3].map((i) => ["stone:Amulet of Stone", i, false]));
  const a = useScenario("Amulet", 20, actsA);
  assert.deepEqual(a.s.combat.foes.map((f) => f.held?.kind ?? null), ["stone", "stone", "stone", "stone", null]);
  assert.equal(a.s.combat.foes.every((f) => f.alive), true);
  assert.equal(a.events.filter((e) => e.type === "controlHeld").length, 4);
  assert.equal(a.events.some((e) => e.type === "foeStoned"), false);
});

test("Walnut Staff (C16): floor 20 resisted -> no weakened flag, every live foe Unmoved; landed -> a 3-round spell:weaken timer that clears the flag; floor 12 -> the fight, no timer", () => {
  const actsR = findActs(20, [["weaken:Walnut Staff", 0, true]]);
  const r = useScenario("Walnut", 20, actsR);
  assert.equal(!!r.s.combat.weakened, false);
  assert.deepEqual(r.s.combat.foes.map((f) => f.resisted), ["weaken", "weaken"]);
  assert.equal(r.s.c.timers["spell:weaken"], undefined);

  const actsL = findActs(20, [["weaken:Walnut Staff", 0, false]]);
  const l = useScenario("Walnut", 20, actsL);
  assert.equal(l.s.combat.weakened, true);
  assert.equal(l.s.c.timers["spell:weaken"].left, 3);
  const rng = fakeRng(PAD(40));
  const ticks = [1, 2, 3].map(() => {
    const ev = foeTurn(l.s, rng, []);
    return { weakened: !!l.s.combat.weakened, faded: ev.some((e) => e.type === "weakenFaded") };
  });
  assert.deepEqual(ticks, [
    { weakened: true, faded: false },
    { weakened: true, faded: false },
    { weakened: false, faded: true },
  ]);

  const t = useScenario("Walnut", 12);
  assert.equal(t.s.combat.weakened, true);
  assert.equal(t.s.c.timers["spell:weaken"], undefined, "at or below the knee the weaken lasts the fight");
});

// User rulings 2026-09-28 (re-pinned): Freeze left this list — it never
// kills outright at any depth now (freeze-rule.test.js).
test("floors 1-12: a Petrify and an Oak Staff stone are today's kill / removal on every floor — no resist roll, no hold", () => {
  for (let depth = 1; depth <= 12; depth++) {
    const pe = castScenario("Petrify", depth);
    assert.equal(pe.s.combat.foes[0].alive, false, `Petrify depth ${depth}`);
    assert.ok(pe.events.some((e) => e.type === "petrified"), `Petrify depth ${depth}`);
    const oak = useScenario("Oak", depth);
    assert.deepEqual(oak.events.find((e) => e.type === "foeStoned").names, ["F1", "F2"], `Oak depth ${depth}`);
    for (const run of [pe, oak]) {
      assert.equal(run.events.some((e) => e.type === "controlResisted" || e.type === "controlHeld"), false, `depth ${depth}`);
      assert.equal(run.s.combat?.foes.some((f) => "held" in f || "resisted" in f) ?? false, false, `depth ${depth}`);
    }
    const probe = { getState: () => 0 };
    const r = controlResistCheck({ floor: { depth }, acts: 0, combat: { round: 1 } }, probe, "freeze:Freeze", 0);
    assert.equal(r.rolled, false, `no resist roll at depth ${depth}`);
  }
});

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

test("texts: every spell and item whose promise changes past the knee names floor kneeDepth and holdRounds (as a word), from the dial itself", () => {
  const { kneeDepth, holdRounds } = DIALS.CONTROL_AT_DEPTH;
  const floorWords = `past floor ${kneeDepth}`;
  const roundWords = `${NUMBER_WORDS[holdRounds]} rounds`;
  // Quick 260928-tsx (user ruling 2026-09-28): Freeze no longer kills at any
  // depth (d6 damage, then a d4-round freeze unless the foe resists), so its
  // text carries no past-the-knee clause; authored-ranges.test.js pins it.
  for (const n of ["Ice", "Stupidity", "Blind", "Petrify"]) {
    const sp = SPELLS.find((x) => x.n === n);
    assert.ok(sp.txt.includes(floorWords), `${n}: "${sp.txt}" names ${floorWords}`);
    assert.ok(sp.txt.includes(roundWords), `${n}: "${sp.txt}" names ${roundWords}`);
  }
  // The Walnut Staff's text ("all hits on the weakened do double damage")
  // never promised a duration, so it carries no clause (its timed weaken
  // past the knee is taught by the weakenFaded line in play).
  // User rulings 2026-09-28: the Birch Staff's freeze is a d4 hold at every
  // depth (its text says so), so it left this list.
  const items = [...STAVES.filter((s) => ["Oak Staff", "Cedar Staff"].includes(s.n)), JEWELRY.find((j) => j.n === "Amulet of Stone")];
  assert.equal(items.length, 3);
  for (const it of items) {
    assert.ok(it.txt.includes(floorWords), `${it.n}: "${it.txt}" names ${floorWords}`);
    assert.ok(it.txt.includes(roundWords), `${it.n}: "${it.txt}" names ${roundWords}`);
  }
});
