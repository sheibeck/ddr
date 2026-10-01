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
//
// Phase 89 plan 08 (ITEM-01, docs/ITEM-AUDIT.md Q1 and Q6, user 2026-09-30):
// the floor-12 special effects are gone from every ITEM effect and from the two
// combat.js tails the items share with spells (freezeFoe, roomWeakenResists):
// one depth-rising resist (derived.js#risingResistFaces, rolled by
// combat.js#foeResistsEffect), no separate control resist, no three-round cap,
// no hold. The rows this file pinned for Freeze (C1), Weaken (C14), the main-
// draw parity of both, the scroll of Freeze, and the Birch (C4), Cedar (C12),
// Oak / Amulet (C6) and Walnut (C16) items at floor 20 are re-pinned below to
// the new rule (each says so). Every floor-12 digest row is UNCHANGED: at or
// below floor 12 the rising resist IS the half-intel resist, byte for byte.
// Their forced outcomes are found against the REAL foeRisingResistCheck
// (`findRisingActs`), the way the RULES-18 rows were found against
// controlResistCheck.

// Phase 90 plan 04 (SPELL-12, user 2026-09-30, "rising resists ... should apply
// to ALL spells ... remove the floor-12 special effects only"): the same rule now
// holds for every SPELL. The rows this file pinned for Doze (C7), Stun (C8),
// Stupidity (C17), Blind (C18), Shrink (C19), Petrify (C5), Noxious Vapor (C10) and
// Insane (C11), the main-draw parity row, the held-dial row and the texts row are
// re-pinned below to the new rule (each says so): one depth-rising resist
// (`findRisingActs`), no controlResisted, no Unmoved mark, no hold, no blindFor,
// and a resisted foe draws nothing for the effect (the resist comes first).
// test/unit/spell-depth-resist.test.js and test/unit/petrify-blind-stupidity.test.js
// pin the rule and the three reworks in full. The floor-12 digest rows are
// unchanged except Stupidity, Blind's and Petrify's (declared there).

import test from "node:test";
import assert from "node:assert/strict";

import { castSpell, readScroll } from "../../engine/magic.js";
import { useItem } from "../../engine/items.js";
import { foeTurn } from "../../engine/combat.js";
import { controlResistCheck, foeSpellResistCheck, foeRisingResistCheck, risingResistFaces } from "../../engine/derived.js";
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

/** findRisingActs(depth, wants) — Phase 89 plan 08: the first state.acts
 * (0..5000) whose REAL derived.js#foeRisingResistCheck (the one depth-rising
 * resist, intel-1 foes) gives every `[source, idx, resisted]` in `wants`, off
 * cursor 0, round 1, caster "you". */
function findRisingActs(depth, wants) {
  const probe = { getState: () => 0 };
  for (let acts = 0; acts <= 20000; acts++) {
    const ok = wants.every(([source, idx, resisted]) => foeRisingResistCheck({ floor: { depth }, acts, combat: { round: 1 } }, probe, source, idx, 1).resisted === resisted);
    if (ok) return acts;
  }
  throw new Error(`findRisingActs: nothing for ${JSON.stringify(wants)} at depth ${depth}`);
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
const CAST = new Set(["dozed", "dozeFailed", "weakened", "stupefied", "blinded", "shrunk", "petrified", "vaporRolled", "insaneRolled", "spellHit", "frozenSolid", "foeStoned", "controlResisted", "controlHeld"]);
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
  Doze: ["Doze", 1, 1, [1, 3, ...PAD(20)]], // Phase 90 plan 05: the d4 reach (1) first, then the sleeper's own d4 (3)
  Stun: ["Stun", 1, 3, [3, ...PAD(20)]], // Phase 90 plan 05: one foe held for its d4 (3)
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
  // Phase 90 plan 05 (SPELL-11, declared): Doze draws its d4 reach first (n 1 -> 2: the reach, then the sleeper's d4; the sleep itself is unchanged: dozed rounds 3, asleep 2 after one visit).
  Doze: { n: 2, ev: ["dozed", "foeSlept"], cast: [{ type: "dozed", target: "F1", rounds: 3 }], foes: [{ wp: 30, maxWP: 30, alive: true, asleep: 2 }], weakened: false, timers: [] },
  // Phase 90 plan 05 (SPELL-11, declared): Stun holds ONE foe (the aimed F1) for its d4 (3): a controlHeld "stunned" line instead of the "N foes asleep" count line, one d4 instead of a d6 and a d4 per foe (n 4 -> 3: the d4, then the two other foes' to-hit draws); F1 skips its turn (held left 2) while F2 and F3 swing instead of sleeping.
  Stun: { n: 3, ev: ["controlHeld", "foeStillHeld", "foeMissed", "foeMissed"], cast: [{ type: "controlHeld", target: "F1", kind: "stunned", rounds: 3, source: "Stun" }], foes: [{ wp: 30, maxWP: 30, alive: true, asleep: 0, held: { kind: "stunned", left: 2 } }, { wp: 30, maxWP: 30, alive: true, asleep: 0 }, { wp: 30, maxWP: 30, alive: true, asleep: 0 }], weakened: false, timers: [] },
  Weaken: { n: 3, ev: ["weakened", "foeMissed", "foeMissed"], cast: [{ type: "weakened", rounds: 4 }], foes: [{ wp: 30, maxWP: 30, alive: true, asleep: 0 }, { wp: 30, maxWP: 30, alive: true, asleep: 0 }], weakened: true, timers: ["spell:weaken"] },
  // Phase 90 plan 04 (SPELL-12, declared): Stupidity no longer skips the foe's turns (it acts: foeMissed, one to-hit draw) and its line carries `intel` 1 and `was`.
  Stupidity: { n: 1, ev: ["stupefied", "foeMissed"], cast: [{ type: "stupefied", target: "F1", intel: 1, was: 1 }], foes: [{ wp: 30, maxWP: 30, alive: true, asleep: 0, stupid: true }], weakened: false, timers: [] },
  Blind: { n: 1, ev: ["blinded", "foeMissed"], cast: [{ type: "blinded", target: "F1" }], foes: [{ wp: 30, maxWP: 30, alive: true, asleep: 0, blind: true }], weakened: false, timers: [] },
  Shrink: { n: 4, ev: ["shrunk", "foeMissed", "foeMissed", "foeMissed"], cast: [{ type: "shrunk", count: 3 }], foes: [{ wp: 15, maxWP: 15, alive: true, asleep: 0, shrunk: true }, { wp: 15, maxWP: 15, alive: true, asleep: 0, shrunk: true }, { wp: 15, maxWP: 15, alive: true, asleep: 0, shrunk: true }], weakened: false, timers: [] },
  // Phase 90 plan 04 (SPELL-12, Q2 A, declared): Petrify kills through killFoe with spoils off: petrified, then foeKilled (experience paid), and only the experience d6 is drawn, then the other foe's to-hit.
  Petrify: { n: 2, ev: ["petrified", "foeKilled", "foeMissed"], cast: [{ type: "petrified", target: "F1" }], foes: [{ wp: 0, maxWP: 30, alive: false, asleep: 0, frozen: true }, { wp: 30, maxWP: 30, alive: true, asleep: 0 }], weakened: false, timers: [] },
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
    // Stun's own rolled d4 hold is its landed effect (Phase 90 plan 05); no other control line is a hold.
    assert.equal(events.some((e) => e.type === "controlResisted" || (e.type === "controlHeld" && key !== "Stun")), false, key);
  }
});

// User rulings 2026-09-28 (re-pinned): the hold is the rolled d4 at every
// depth (FREEZE_HOLD_DIE), not controlHoldRoundsFor; the d4 is one new main
// draw right after the damage. This row rolls a 3, the old hold's number.
test("Freeze (C1) floor 20: a hit that leaves the foe standing and is not resisted holds it for the rolled d4 (3) — alive, none of killFoe's draws", () => {
  const s = spellState(20, "Freeze", 1, 1);
  s.acts = findRisingActs(20, [["Freeze", 0, false]]); // Phase 89 plan 08: the one depth-rising resist
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

// Phase 89 plan 08 (ITEM-01, Q1): re-pinned. The floor-20 Freeze has ONE resist
// (the depth-rising one, post-damage, `freeze: true`), not a resist plus a
// control resist: a resist leaves the foe damaged and unfrozen, with a
// spellResisted line carrying the floor's extra faces and no controlResisted.
test("Freeze (C1) floor 20: a resisted hit leaves the foe standing and damaged — one rising spellResisted (freeze), no controlResisted, no hold, no kill", () => {
  const s = spellState(20, "Freeze", 1, 1);
  s.acts = findRisingActs(20, [["Freeze", 0, true]]);
  const events = castSpell(s, IDX.Freeze, fakeRng([1, 4, ...PAD(10)]), []);
  const f = s.combat.foes[0];
  assert.equal(f.alive, true);
  assert.equal(f.wp, 25); // d6 4 + level² 1 (quick 260928-sq2)
  assert.equal("resisted" in f, false, "no Unmoved mark: there is no separate control resist any more");
  assert.equal("held" in f, false);
  const r = events.find((e) => e.type === "spellResisted");
  assert.equal(r.spell, "Freeze");
  assert.equal(r.freeze, true);
  assert.equal(r.faces, risingResistFaces(20, 1));
  assert.equal(r.depthFaces, 8);
  assert.equal(events.some((e) => e.type === "controlResisted" || e.type === "controlHeld"), false);
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

// Phase 90 plan 04 (SPELL-12, user 2026-09-30: one depth-rising resist for every
// spell, no floor-12 extras): re-pinned. Doze and Stun roll the one resist
// (`spellResisted` / `resistFailed` with depthFaces), no second control resist, no
// Unmoved mark. The resist now comes BEFORE the d4, so a resisted foe draws no d4
// (before: the d4 was drawn first and a control resist followed it).
test("Doze (C7) floor 20: resisted -> one rising spellResisted, awake, no d4 drawn, no Unmoved mark; landed -> asleep the rolled d4 (never capped)", () => {
  const r = spellState(20, "Doze", 1, 1);
  r.acts = findRisingActs(20, [["Doze", 0, true]]);
  // Phase 90 plan 05: the d4 reach (1) is drawn first, then the sleeper's d4 (3, never taken when it resists).
  const rngR = fakeRng([1, 3, ...PAD(10)]);
  const evR = castSpell(r, IDX.Doze, rngR, []);
  assert.equal(r.combat.foes[0].asleep, 0);
  assert.equal("resisted" in r.combat.foes[0], false);
  assert.equal(evR.some((e) => e.type === "dozed"), false);
  assert.equal(evR.filter((e) => e.type === "dozeFailed").length, 1, "the one closing line");
  assert.equal(evR.filter((e) => e.type === "spellResisted").length, 1);
  assert.equal(evR.find((e) => e.type === "spellResisted").depthFaces, 8);
  assert.equal(evR.some((e) => e.type === "controlResisted"), false);

  const l = spellState(20, "Doze", 1, 1);
  l.acts = findRisingActs(20, [["Doze", 0, false]]);
  const evL = castSpell(l, IDX.Doze, fakeRng([1, 3, ...PAD(10)]), []);
  assert.equal(evL.find((e) => e.type === "dozed").rounds, 3, "the rolled d4, never capped");
  assert.equal(l.combat.foes[0].asleep, 2, "one visit already spent this dispatch");
  assert.equal("resisted" in l.combat.foes[0], false);
});

// Phase 90 plan 05 (SPELL-11, declared): Stun holds ONE foe, the aimed one. Before: the d6 x
// multiplier count of foes asleep d4 each, a resist per foe, a `stunned { count }` line. After:
// the aimed foe's one depth-rising resist up front (a resister draws no d4 and nothing holds), then a
// d4 and a "stunned" hold: the foe skips that many turns and a blow does not end it.
test("Stun (C8) floor 20: one aimed foe; resisted -> awake, no d4, no mark, no hold; landed -> held 'stunned' for the rolled d4 (never capped)", () => {
  const r = spellState(20, "Stun", 1, 3);
  r.acts = findRisingActs(20, [["Stun", 0, true]]);
  const evR = castSpell(r, IDX.Stun, fakeRng([3, ...PAD(10)]), []);
  assert.equal("held" in r.combat.foes[0], false);
  assert.equal("resisted" in r.combat.foes[0], false, "no Unmoved mark");
  assert.equal(evR.filter((e) => e.type === "spellResisted").length, 1, "one resist, on the one foe");
  assert.equal(evR.some((e) => e.type === "controlHeld" || e.type === "controlResisted"), false);

  const l = spellState(20, "Stun", 1, 3);
  l.acts = findRisingActs(20, [["Stun", 0, false]]);
  const evL = castSpell(l, IDX.Stun, fakeRng([3, ...PAD(10)]), []);
  const held = evL.find((e) => e.type === "controlHeld");
  assert.deepEqual({ target: held.target, kind: held.kind, rounds: held.rounds }, { target: "F1", kind: "stunned", rounds: 3 });
  assert.deepEqual(l.combat.foes[0].held, { kind: "stunned", left: 2 }, "one hold turn already spent this dispatch");
  assert.equal(l.combat.foes[1].asleep + l.combat.foes[2].asleep, 0, "nobody else is touched");
  assert.equal(evL.filter((e) => e.type === "spellResisted").length, 0);
  assert.equal(evL.filter((e) => e.type === "resistFailed").length, 1);
});

// Phase 89 plan 08 (ITEM-01, Q1): re-pinned. The room has no extra resist past
// floor 12: each live foe rolls its own depth-rising resist, and when every
// one resists nothing lands (no Unmoved marks, no controlResisted).
test("Weaken (C14) floor 20: every foe resisting -> no weakened flag, no timer; a foe failing its resist -> today's d4+1", () => {
  const r = spellState(20, "Weaken", 1, 2);
  r.acts = findRisingActs(20, [["Weaken", 0, true], ["Weaken", 1, true]]);
  const rngR = fakeRng([3, ...PAD(10)]);
  const evR = castSpell(r, IDX.Weaken, rngR, []);
  assert.equal(!!r.combat.weakened, false);
  assert.equal(r.c.timers && r.c.timers["spell:weaken"], undefined);
  assert.deepEqual(r.combat.foes.map((f) => f.resisted), [undefined, undefined], "no Unmoved marks: no separate room resist");
  assert.equal(evR.some((e) => e.type === "weakened"), false);
  assert.equal(evR.filter((e) => e.type === "spellResisted").length, 2, "each foe's own resist");
  assert.equal(evR.some((e) => e.type === "controlResisted"), false);

  const l = spellState(20, "Weaken", 1, 2);
  l.acts = findRisingActs(20, [["Weaken", 0, false]]);
  const evL = castSpell(l, IDX.Weaken, fakeRng([3, ...PAD(10)]), []);
  assert.equal(l.combat.weakened, true);
  assert.equal(evL.find((e) => e.type === "weakened").rounds, 4);
  assert.ok(l.c.timers["spell:weaken"]);
});

// Phase 90 plan 04 (SPELL-12, user 2026-09-30): re-pinned. Stupidity, Blind and
// Petrify were reworked as ruled (test/unit/petrify-blind-stupidity.test.js
// pins the new rules in full); at floor 20 each is now its floor-1 effect after
// the one depth-rising resist, with no hold, no blindFor and no Unmoved mark.
// Before: Stupidity held 3 rounds, Blind set blindFor 3 and rounds 3 on its line,
// Petrify held the foe in stone for 3 rounds and kept it in the fight.
test("Stupidity (C17): floor 20 landed -> intelligence 1 for the fight, no hold, no extra resist; resisted -> unchanged, no Unmoved mark", () => {
  const s = spellState(20, "Stupidity", 2, 1);
  s.acts = findRisingActs(20, [["Stupidity", 0, false]]);
  const events = castSpell(s, IDX.Stupidity, fakeRng(PAD(10)), []);
  const f = s.combat.foes[0];
  assert.equal(f.stupid, true);
  assert.equal(f.intel, 1);
  assert.equal("held" in f, false);
  assert.equal(events.some((e) => e.type === "controlHeld" || e.type === "controlResisted"), false);

  const r = spellState(20, "Stupidity", 2, 1);
  r.acts = findRisingActs(20, [["Stupidity", 0, true]]);
  castSpell(r, IDX.Stupidity, fakeRng(PAD(10)), []);
  assert.equal("resisted" in r.combat.foes[0], false);
  assert.equal("held" in r.combat.foes[0], false);
  assert.equal("stupid" in r.combat.foes[0], false);

  const { s: t } = castScenario("Stupidity", 12);
  assert.equal(t.combat.foes[0].stupid, true);
});

test("Blind (C18): floor 20 landed -> blind for the fight, no blindFor, no rounds on the line; resisted -> not blind; floor 12 the same", () => {
  const s = spellState(20, "Blind", 3, 1);
  s.acts = findRisingActs(20, [["Blind", 0, false]]);
  const events = castSpell(s, IDX.Blind, fakeRng(PAD(10)), []);
  const f = s.combat.foes[0];
  assert.equal(f.blind, true);
  assert.equal("rounds" in events.find((e) => e.type === "blinded"), false);
  assert.equal("blindFor" in f, false);

  const r = spellState(20, "Blind", 3, 1);
  r.acts = findRisingActs(20, [["Blind", 0, true]]);
  const evR = castSpell(r, IDX.Blind, fakeRng(PAD(10)), []);
  assert.equal(!!r.combat.foes[0].blind, false);
  assert.equal(evR.some((e) => e.type === "blinded"), false);
  assert.equal("resisted" in r.combat.foes[0], false);

  const { s: t, events: evT } = castScenario("Blind", 12);
  assert.equal(t.combat.foes[0].blind, true);
  assert.equal("blindFor" in t.combat.foes[0], false);
  assert.equal("rounds" in evT.find((e) => e.type === "blinded"), false);
});

test("Shrink (C19) floor 20: a resisting foe keeps its hp (no mark); the others halve; shrunk.count counts the halved", () => {
  const s = spellState(20, "Shrink", 3, 3);
  s.acts = findRisingActs(20, [["Shrink", 0, false], ["Shrink", 1, true], ["Shrink", 2, false]]);
  const events = castSpell(s, IDX.Shrink, fakeRng([6, ...PAD(10)]), []);
  const [f1, f2, f3] = s.combat.foes;
  assert.equal(f1.wp, 15);
  assert.equal(f2.wp, 30);
  assert.equal(f2.maxWP, 30);
  assert.equal("shrunk" in f2, false);
  assert.equal("resisted" in f2, false);
  assert.equal(f3.wp, 15);
  assert.equal(events.find((e) => e.type === "shrunk").count, 2);
});

test("Petrify (C5): floor 20 landed -> the foe dies (no stone hold), at floor 12 the same; resisted -> flesh, no mark", () => {
  const s = spellState(20, "Petrify", 5, 2);
  s.acts = findRisingActs(20, [["Petrify", 0, false]]);
  const events = castSpell(s, IDX.Petrify, fakeRng(PAD(10)), []);
  const f = s.combat.foes[0];
  assert.equal(f.alive, false);
  assert.equal("held" in f, false);
  assert.ok(events.some((e) => e.type === "petrified"));
  assert.equal(events.some((e) => e.type === "controlHeld"), false);

  const r = spellState(20, "Petrify", 5, 2);
  r.acts = findRisingActs(20, [["Petrify", 0, true]]);
  castSpell(r, IDX.Petrify, fakeRng(PAD(10)), []);
  assert.equal(r.combat.foes[0].alive, true);
  assert.equal("resisted" in r.combat.foes[0], false);
  assert.equal("held" in r.combat.foes[0], false);

  const { s: t } = castScenario("Petrify", 12);
  assert.equal(t.combat.foes[0].alive, false);
  assert.equal(t.combat.foes[0].frozen, true);
});

// Re-pinned (90-04): the one resist comes before each foe's draws, so a resisting
// foe draws no d6 (before: the d6 was drawn first, the control resist after).
test("Noxious Vapor's sleep (C10) and Insane's nap (C11) floor 20: a resisting foe stays awake and draws nothing; a landed sleep is its own d6+2 / d4", () => {
  const v = spellState(20, "Noxious Vapor", 4, 2);
  v.acts = findRisingActs(20, [["Noxious Vapor", 0, true], ["Noxious Vapor", 1, false]]);
  const vRng = fakeRng([2, 3, 5, ...PAD(10)]);
  castSpell(v, IDX["Noxious Vapor"], vRng, []);
  assert.equal(v.combat.foes[0].asleep, 0);
  assert.equal("resisted" in v.combat.foes[0], false);
  assert.equal(v.combat.foes[1].asleep, 4); // its own d6 3 + 2 = 5, one visit spent

  const i = spellState(20, "Insane", 2, 1);
  i.acts = findRisingActs(20, [["Insane", 0, true]]);
  castSpell(i, IDX.Insane, fakeRng([4, 2, ...PAD(10)]), []);
  assert.equal(i.combat.foes[0].asleep, 0);
  assert.equal("resisted" in i.combat.foes[0], false);

  const j = spellState(20, "Insane", 2, 1);
  j.acts = findRisingActs(20, [["Insane", 0, false]]);
  castSpell(j, IDX.Insane, fakeRng([4, 2, ...PAD(10)]), []);
  assert.equal(j.combat.foes[0].asleep, 1);
});

// Phase 90 plan 04 (SPELL-12): re-pinned. There is ONE resist per foe and it
// comes before that foe's own draws, so a foe that resists draws nothing for the
// spell's effect, and a resisted and a landed cast no longer take the same main
// draws (before, at floor 20, the d4 / d6 was drawn first and a second control
// resist followed, so both took the same draws). Floor 12 and below is unchanged:
// the intel resist already came first there.
test("main draws at floor 20: a foe that resists draws nothing for the spell's effect (the one resist comes first); Freeze and Weaken still draw their d4 / d4+1 either way", () => {
  // [scenario key, spell source, foe idx list, draws when every foe resists,
  // draws when none does] — the cast's own main draws, then the regen d8.
  const CASES = [
    ["Freeze", "Freeze", [0], 3, 3], // to-hit, damage, then the hold's d4 (resisted or not)
    ["Doze", "Doze", [0], 1, 2], // Phase 90 plan 05: the d4 reach first (drawn either way), then a d4 per foe that failed
    ["Stun", "Stun", [0], 0, 1], // Phase 90 plan 05: one aimed foe: its d4 only when it fails its resist
    ["Weaken", "Weaken", [0, 1], 1, 1], // the d4 + 1 is drawn before the room resists
    ["Stupidity", "Stupidity", [0], 0, 0],
    ["Blind", "Blind", [0], 0, 0],
    ["Shrink", "Shrink", [0, 1, 2], 1, 1],
    ["Petrify", "Petrify", [0], 0, 1], // a landed Petrify takes killFoe's experience d6 and nothing more
    ["Vapor", "Noxious Vapor", [0, 1], 1, 3], // the table d6, then a d6 per foe that failed
    ["Insane", "Insane", [0], 0, 2], // the madness d6, then the nap's d4
  ];
  for (const [key, source, idxs, resistedDraws, landedDraws] of CASES) {
    const marks = [true, false].map((resisted) => {
      const [name, level, nFoes, seq] = SPELL_SCENARIOS[key];
      const s = spellState(20, name, level, nFoes);
      s.c.regen = true;
      s.c.wp = 20;
      s.acts = findRisingActs(20, idxs.map((i) => [source, i, resisted]));
      const rng = fakeRng([...seq, ...PAD(20)]);
      const events = markingEvents(rng, "regenerated");
      castSpell(s, IDX[name], rng, events);
      assert.equal(events.some((e) => e.type === "controlResisted"), false, `${key}: no controlResisted`);
      assert.equal(events.marks.length, 1, `${key}: the regen marker fired once`);
      return events.marks[0];
    });
    assert.equal(marks[0], resistedDraws + 1, `${key}: every foe resists, then the regen d8`);
    assert.equal(marks[1], landedDraws + 1, `${key}: no foe resists, then the regen d8`);
  }
});

test("a scroll of Freeze read in combat on floor 20 meets the same rule (castSpell's own branch)", () => {
  const s = spellState(20, "Freeze", 1, 1);
  s.c.scrolls = 1;
  s.acts = findRisingActs(20, [["Freeze", 0, false]]);
  // User rulings 2026-09-28: plus the hold's d4 (3).
  const rng = { ...fakeRng([1, 4, 3]), pick: (arr) => arr.find((sp) => sp.n === "Freeze") };
  const events = readScroll(s, rng, []);
  assert.ok(events.some((e) => e.type === "scrollCast" && e.spell === "Freeze"));
  assert.ok(events.some((e) => e.type === "controlHeld" && e.kind === "frozen" && e.rounds === 3));
  assert.equal(s.combat.foes[0].alive, true);
  assert.equal(events.some((e) => e.type === "foeKilled"), false);
});

// Phase 90 plan 04 (SPELL-12): re-pinned. No spell reads the hold dial any more
// (the Bard's sing is the one caller of the RULES-18 helpers left); the dial
// itself is unchanged, so its own values stay pinned here.
test("the hold dial is untouched (controlHoldRoundsFor(20) is CONTROL_AT_DEPTH.holdRounds, 0 through floor 12), but castSpell never reads it: a landed Blind at floor 20 has no countdown", () => {
  assert.equal(controlHoldRoundsFor(20), DIALS.CONTROL_AT_DEPTH.holdRounds);
  for (let d = 1; d <= DIALS.CONTROL_AT_DEPTH.kneeDepth; d++) assert.equal(controlHoldRoundsFor(d), 0);
  const s = spellState(20, "Blind", 3, 1);
  s.acts = findRisingActs(20, [["Blind", 0, false]]);
  castSpell(s, IDX.Blind, fakeRng(PAD(10)), []);
  assert.equal("blindFor" in s.combat.foes[0], false);
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
// Phase 89 plan 08 (ITEM-01, Q1): re-pinned. The staff's freeze has ONE resist
// (the depth-rising one, inside freezeFoe): a resisting foe is untouched and
// unmarked, the other is frozen for its d4 (3), one d4 per foe reached.
test("Birch Staff (C4) floor 20: the first target resists (awake, not held), the second is frozen for its d4 (3); one d4 per foe reached; no controlResisted", () => {
  const acts = findRisingActs(20, [["Birch Staff", 0, true], ["Birch Staff", 1, false]]);
  const { s, rng, events } = useScenario("Birch", 20, acts, [2, 3, ...PAD(40)]);
  const [f1, f2, f3] = s.combat.foes;
  assert.equal(f1.asleep, 0);
  assert.equal("resisted" in f1, false);
  assert.equal("held" in f1, false);
  assert.equal(f2.asleep, 0);
  assert.equal(events.find((e) => e.type === "controlHeld" && e.target === "F2").rounds, 3);
  assert.equal(f3.asleep, 0, "outside the staff's two squares");
  assert.equal("held" in f3, false, "outside the staff's two squares");
  assert.equal(events.filter((e) => e.type === "spellResisted").length, 1);
  assert.equal(events.some((e) => e.type === "controlResisted"), false);
  assert.equal(rng.count(), 2);
});

// Phase 89 plan 08 (ITEM-01, Q1): re-pinned. A foe that fails the one resist
// sleeps the rest of the fight (99 rounds) at floor 20, never three.
test("Cedar Staff (C12) floor 20: every non-resisting foe sleeps the fight (99, not 3); a resisting one stays awake", () => {
  const acts = findRisingActs(20, [["Cedar Staff", 0, false], ["Cedar Staff", 1, true], ["Cedar Staff", 2, false]]);
  const { s, rng } = useScenario("Cedar", 20, acts);
  assert.deepEqual(s.combat.foes.map((f) => f.asleep), [99, 0, 99]);
  assert.equal("resisted" in s.combat.foes[1], false);
  assert.equal(rng.count(), 0);
});

// Phase 89 plan 08 (ITEM-01, Q1): re-pinned. A stone that lands KILLS at floor
// 20 (foeStoned names it, killFoe pays it); no hold, no extra control resist.
test("Oak Staff and Amulet of Stone (C6) floor 20: a non-resisting target is stoned outright (dead, named by foeStoned), a resisting one is untouched; no hold", () => {
  const acts = findRisingActs(20, [["Oak Staff", 0, false], ["Oak Staff", 1, true]]);
  const { s, events } = useScenario("Oak", 20, acts);
  const [f1, f2] = s.combat.foes;
  assert.equal(f1.alive, false);
  assert.equal("held" in f1, false);
  assert.equal(f2.alive, true);
  assert.equal("held" in f2, false);
  assert.deepEqual(events.find((e) => e.type === "foeStoned").names, ["F1"]);
  assert.equal(events.filter((e) => e.type === "foeKilled").length, 1);
  assert.equal(events.some((e) => e.type === "controlResisted" || e.type === "controlHeld"), false);

  const actsA = findRisingActs(20, [0, 1, 2, 3].map((i) => ["Amulet of Stone", i, false]));
  const a = useScenario("Amulet", 20, actsA);
  assert.deepEqual(a.s.combat.foes.map((f) => f.alive), [false, false, false, false, true]);
  assert.deepEqual(a.events.find((e) => e.type === "foeStoned").names, ["F1", "F2", "F3", "F4"]);
  assert.equal(a.events.some((e) => e.type === "controlHeld"), false);
});

// Phase 89 plan 08 (ITEM-01, Q1 and Q6): re-pinned. The staff casts the full
// Weaken (half damage and the top-three-faces to-hit cap) for the whole fight
// at every depth: no three-round timer past the knee, no Unmoved marks.
test("Walnut Staff (C16): floor 20 every foe resisting -> no weakened flag; a foe failing -> half damage and the top-three cap for the fight (no timer, no fade); floor 12 the same", () => {
  const actsR = findRisingActs(20, [["Walnut Staff", 0, true], ["Walnut Staff", 1, true]]);
  const r = useScenario("Walnut", 20, actsR);
  assert.equal(!!r.s.combat.weakened, false);
  assert.equal(!!r.s.combat.foeToHitPenalty, false);
  assert.deepEqual(r.s.combat.foes.map((f) => f.resisted), [undefined, undefined]);
  assert.equal(r.s.c.timers["spell:weaken"], undefined);

  const actsL = findRisingActs(20, [["Walnut Staff", 0, false]]);
  const l = useScenario("Walnut", 20, actsL);
  assert.equal(l.s.combat.weakened, true);
  assert.equal(l.s.combat.foeToHitPenalty, 3, "the Weaken spell's own cap (Q6)");
  assert.equal(l.s.c.timers["spell:weaken"], undefined, "no three-round timer past floor 12 (Q1)");
  const rng = fakeRng(PAD(40));
  const ticks = [1, 2, 3, 4, 5].map(() => {
    const ev = foeTurn(l.s, rng, []);
    return { weakened: !!l.s.combat.weakened, faded: ev.some((e) => e.type === "weakenFaded") };
  });
  assert.deepEqual(ticks, new Array(5).fill({ weakened: true, faded: false }));

  const t = useScenario("Walnut", 12);
  assert.equal(t.s.combat.weakened, true);
  assert.equal(t.s.combat.foeToHitPenalty, 3);
  assert.equal(t.s.c.timers["spell:weaken"], undefined, "at every depth the weaken lasts the fight");
});

// User rulings 2026-09-28 (re-pinned): Freeze left this list — it never
// kills outright at any depth now (freeze-rule.test.js).
// Phase 90 plan 04 (SPELL-12): Petrify's kill now pays its experience (Q2 A) and
// has no spoils; this test keeps its floors 1-12 reading (a kill on every floor,
// no control resist roll, no hold).
test("floors 1-12: a Petrify and an Oak Staff stone are a kill on every floor — no control resist roll, no hold", () => {
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

test("texts: no spell and no control item names floor kneeDepth or holdRounds (as a word): the floor-12 special effects are gone from every text", () => {
  const { kneeDepth, holdRounds } = DIALS.CONTROL_AT_DEPTH;
  const floorWords = `past floor ${kneeDepth}`;
  const roundWords = `${NUMBER_WORDS[holdRounds]} rounds`;
  // Phase 90 plan 04 (SPELL-12, user 2026-09-30): the SPELL half of this test used
  // to assert that Ice, Stupidity, Blind and Petrify NAME the floor-12 hold; no spell
  // has one now, so it asserts the opposite for every spell (Ice's own text is
  // replaced wholesale by 90-05; its floor-12 clause went with the cap).
  for (const sp of SPELLS) {
    assert.ok(!sp.txt.includes(floorWords) && !sp.txt.includes(roundWords), `${sp.n}: "${sp.txt}" no longer names the floor-12 hold`);
  }
  // Phase 89 plan 09 (89-08 hand-off, docs/ITEM-AUDIT.md Q1): the ITEM half of
  // this test is gone. The Amulet of Stone, the Oak and Cedar Staves no longer
  // have a floor-12 hold, so their texts no longer name floor ${kneeDepth} or a
  // hold of ${holdRounds} rounds; they say each foe may resist and the deeper the
  // floor the likelier it does (pinned by item-text-wording.test.js).
  for (const n of ["Amulet of Stone", "Oak Staff", "Cedar Staff"]) {
    const it = [...STAVES, ...JEWELRY].find((x) => x.n === n);
    assert.ok(!it.txt.includes(floorWords) && !it.txt.includes(roundWords), `${n}: "${it.txt}" no longer names the floor-12 hold`);
  }
});
