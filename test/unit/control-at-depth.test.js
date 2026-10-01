// test/unit/control-at-depth.test.js
//
// Phase 75.3, Plan 04 (RULES-18) — "Control spells at depth": from floor 13
// (the knee), a foe increasingly SHAKES OFF Freeze, Stone, Doze/Sleep,
// Weaken and Stupid on a derived-stream, roll-high d20, and an "indefinite"
// control (a Freeze/Stone kill, Stupidity, Blind, the Walnut Staff's weaken,
// the Birch/Cedar staves' 99-round sleep, the Lullaby's 24) holds the foe for
// a few rounds instead — see this plan's own PLAN.md "control audit" table
// for the full id list (C1-C19, X1-X7). This file covers audit ids C2, C3,
// C9, C13, C15 (every combat.js control site) plus the shared dial helpers
// (engine/difficulty.js), the resist check (engine/derived.js) and the
// narration/chip surfaces (src/browser/eventNarration.js, narrationLines.js,
// foeConditions.js) — 75.3-05 covers the hero's own spells and items. Task 1
// (below) proves the dial helpers and the resist check in isolation; Task 2
// grows this file with the held mechanics and every combat.js control site;
// Task 3 adds narration/chip coverage.
//
// Runs under the SHIPPED (fitted) DIALS, not identity — CONTROL_AT_DEPTH's
// own behaviour numbers in this plan's <behavior> block (floor 20 -> 8
// faces, floor 13 -> hold 3, ...) are the FITTED start values, not the
// identity ({0,0,0}) ones test/unit/harness/identityDials.js carries.
//
// Determinism idiom: every forced resist/hold outcome in this file is found
// by searching state.acts (0..5000, bounded) against the REAL
// engine/derived.js#controlResistCheck — never a mocked derivedRng — mirroring
// test/unit/scroll-read.test.js#forceOutcome and 75.1-01's own precedent.

import test from "node:test";
import assert from "node:assert/strict";

import {
  resistControl,
  holdFoe,
  foeTurn,
  alliesTurn,
  sing,
  songPool,
} from "../../engine/combat.js";
import { derivedRng } from "../../engine/rng.js";
import { targetStrikeFaces, controlResistRoll, controlResistCheck, foeRisingResistCheck } from "../../engine/derived.js";
import {
  DIALS,
  setDialsForTuning,
  controlResistFacesFor,
  controlHoldRoundsFor,
  controlCapRounds,
} from "../../engine/difficulty.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { LINE_FOR } from "../../src/browser/narrationLines.js";
import { foeConditionChips } from "../../src/browser/foeConditions.js";

/** fakeRng(seq) — `.d()` pops the next value off `seq`; throws on underflow.
 * `getState` is a FIXED stub (default 0) — deliberately NOT a real cursor —
 * so a test can pick any known cursor value for controlResistCheck's derived
 * stream independent of how many `.d()` calls the surrounding code makes. */
function fakeRng(seq, { getState = () => 0 } = {}) {
  let i = 0;
  return {
    d(_sides) {
      if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick: (arr) => arr[0],
    shuffle: (a) => a,
    getState,
  };
}

/** trackingRng(seq) — the SAME sequence-popping shape as fakeRng, but
 * `getState()` returns the REAL running draw count, so a test can prove two
 * branches leave the main cursor equally advanced (draw parity). */
function trackingRng(seq) {
  let i = 0;
  return {
    d(_sides) {
      if (i >= seq.length) throw new Error(`trackingRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick: (arr) => arr[0],
    shuffle: (a) => a,
    getState: () => i,
  };
}

const PAD = (n, v = 10) => new Array(n).fill(v);

// --- Task 2 fixtures — mirrors test/unit/combat.test.js / test/unit/party-
// combat.test.js verbatim (same field shapes), so every real combat.js
// function reads them exactly as it reads any other test's fixtures. ---

function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
    maxWP: 55, wp: 55, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 1, rations: 6, gold: 50, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    darkFor: 0,
    ...overrides,
  };
}

function fixedFloor(overrides = {}) {
  const g = [];
  for (let y = 0; y < 3; y++) {
    g.push([]);
    for (let x = 0; x < 3; x++) g[y].push({ wall: false, dark: false, seen: true, feat: null });
  }
  return { g, px: 1, py: 1, depth: 1, ...overrides };
}

function fixedState(overrides = {}) {
  const { c: cOverrides, floor: floorOverrides, ...rest } = overrides;
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedFighter(cOverrides),
    floor: fixedFloor(floorOverrides),
    day: 1, steps: 0, combat: null, store: null, beats: null, party: [],
    dead: false, deathNote: "", epitaph: "",
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

function fixedAlly(overrides = {}) {
  return { partyIdx: 0, name: "Ada", lvl: 1, sub: "Fighter", wp: 20, maxWP: 20, ...overrides };
}

function fixedMember(overrides = {}) {
  return { name: "Ada", level: 1, sub: "Fighter", cls: "Fighter", race: "Human", wp: 20, maxWP: 20, status: "ok", ...overrides };
}

function muMember(overrides = {}) {
  return fixedMember({
    cls: "Magic User", sub: "Wizard", race: "Human", weapon: "Quarter Staff", prof: 0, magicWpn: 0, might: 0,
    items: [], skills: {}, armor: "Nothing", grimoire: [], spellsUsed: 0,
    ...overrides,
  });
}

/**
 * forceControlResist(purpose, idx, depth, round, cursor, wantResisted) —
 * searches state.acts (0..5000, bounded) for the first value whose REAL
 * controlResistCheck (engine/derived.js) resolves to `wantResisted`, off a
 * FIXED cursor (a test's own `getState` stub, or a trackingRng draw count).
 * Never mocks derivedRng — every draw is the real thing.
 */
function forceControlResist(purpose, idx, depth, round, cursor, wantResisted) {
  const probe = { getState: () => cursor };
  for (let acts = 0; acts <= 5000; acts++) {
    const r = controlResistCheck({ floor: { depth }, acts, combat: { round } }, probe, purpose, idx);
    if (r.rolled && r.resisted === wantResisted) return acts;
  }
  throw new Error(`forceControlResist: no acts found for ${purpose}/${idx} depth ${depth} round ${round} cursor ${cursor} want ${wantResisted}`);
}

/**
 * forceRisingResist(source, caster, idx, depth, round, cursor, wantResisted) —
 * Phase 89 plan 08 (ITEM-01, Q1): the twin of forceControlResist for the ONE
 * depth-rising resist (derived.js#foeRisingResistCheck, intel-1 foes) that
 * freezeFoe and roomWeakenResists roll now. Same search over state.acts off a
 * fixed cursor; the REAL check, never a mock.
 */
function forceRisingResist(source, caster, idx, depth, round, cursor, wantResisted) {
  const probe = { getState: () => cursor };
  for (let acts = 0; acts <= 5000; acts++) {
    const r = foeRisingResistCheck({ floor: { depth }, acts, combat: { round } }, probe, source, idx, 1, caster);
    if (r.resisted === wantResisted) return acts;
  }
  throw new Error(`forceRisingResist: no acts found for ${source}/${caster}/${idx} depth ${depth} want ${wantResisted}`);
}

/** forceRisingResistAll — the first acts where EVERY foe idx in `idxs` gets `wantResisted`. */
function forceRisingResistAll(source, caster, idxs, depth, round, cursor, wantResisted) {
  const probe = { getState: () => cursor };
  for (let acts = 0; acts <= 5000; acts++) {
    if (idxs.every((idx) => foeRisingResistCheck({ floor: { depth }, acts, combat: { round } }, probe, source, idx, 1, caster).resisted === wantResisted)) return acts;
  }
  throw new Error(`forceRisingResistAll: no acts found for ${source}/${caster}/${idxs} depth ${depth}`);
}

// ---------------------------------------------------------------------------
// Task 1: CONTROL_AT_DEPTH, controlResistFacesFor/controlHoldRoundsFor/
// controlCapRounds, controlResistRoll, controlResistCheck.
// ---------------------------------------------------------------------------

test("CONTROL_AT_DEPTH ships at { kneeDepth: 12, resistPerDepth: 1, resistCap: 15, holdRounds: 3 }", () => {
  assert.deepEqual(DIALS.CONTROL_AT_DEPTH, { kneeDepth: 12, resistPerDepth: 1, resistCap: 15, holdRounds: 3 });
});

test("controlResistFacesFor: boundary and precision at the shipped dials", () => {
  assert.equal(controlResistFacesFor(1), 0);
  assert.equal(controlResistFacesFor(11), 0);
  assert.equal(controlResistFacesFor(12), 0);
  assert.equal(controlResistFacesFor(13), 1);
  assert.equal(controlResistFacesFor(20), 8);
  assert.equal(controlResistFacesFor(27), 15);
  assert.equal(controlResistFacesFor(40), 15);
  assert.equal(controlResistFacesFor(13.9), 1, "safeDepth floors a non-integer depth");
  assert.equal(controlResistFacesFor(NaN), 0, "safeDepth reads NaN as depth 1");
});

test("controlResistFacesFor: resistPerDepth 0.5 rounds half up; resistCap never exceeds 19", () => {
  const restore = setDialsForTuning({ CONTROL_AT_DEPTH: { kneeDepth: 12, resistPerDepth: 0.5, resistCap: 15, holdRounds: 3 } });
  try {
    assert.equal(controlResistFacesFor(13), 1);
    assert.equal(controlResistFacesFor(14), 1);
    assert.equal(controlResistFacesFor(15), 2);
  } finally {
    restore();
  }
  const restore2 = setDialsForTuning({ CONTROL_AT_DEPTH: { kneeDepth: 12, resistPerDepth: 1, resistCap: 25, holdRounds: 3 } });
  try {
    assert.equal(controlResistFacesFor(60), 19, "a d20's own top face always wins for the controller");
  } finally {
    restore2();
  }
});

test("controlHoldRoundsFor / controlCapRounds: 0 at or below the knee, holdRounds past it", () => {
  assert.equal(controlHoldRoundsFor(12), 0);
  assert.equal(controlHoldRoundsFor(13), 3);
  assert.equal(controlCapRounds(13, 99), 3);
  assert.equal(controlCapRounds(13, 2), 2, "a short rolled duration under the cap is never raised");
  assert.equal(controlCapRounds(12, 99), 99, "no cap at or below the knee");
});

test("identity: resistPerDepth/resistCap/holdRounds all 0 means no resist face and no hold cap at any depth", () => {
  const restore = setDialsForTuning({ CONTROL_AT_DEPTH: { kneeDepth: 12, resistPerDepth: 0, resistCap: 0, holdRounds: 0 } });
  try {
    for (const d of [1, 12, 13, 20, 42]) {
      assert.equal(controlResistFacesFor(d), 0, `depth ${d} faces`);
      assert.equal(controlHoldRoundsFor(d), 0, `depth ${d} hold`);
      assert.equal(controlCapRounds(d, 99), 99, `depth ${d} cap`);
    }
  } finally {
    restore();
  }
});

test("controlResistRoll: resists exactly on rolls 13-20 of a scripted d20 (roll-high, faces 8); 0 faces never draws", () => {
  // rollCheck mirrors raw draw r -> roll = 21 - r; resisted = roll >= atLeast (13).
  // roll 13..20 <=> raw draw 8..1.
  for (let raw = 1; raw <= 8; raw++) {
    const rng = fakeRng([raw]);
    const result = controlResistRoll(rng, 8);
    assert.equal(result.resisted, true, `raw draw ${raw} (roll ${21 - raw}) must resist`);
  }
  for (let raw = 9; raw <= 20; raw++) {
    const rng = fakeRng([raw]);
    const result = controlResistRoll(rng, 8);
    assert.equal(result.resisted, false, `raw draw ${raw} (roll ${21 - raw}) must not resist`);
  }
  const zero = controlResistRoll(fakeRng([]), 0);
  assert.deepEqual(zero, { rolled: false, resisted: false, roll: undefined });
});

test("controlResistCheck: floor 12 draws nothing (a spy on the main rng sees zero calls); floor 20 leaves the main cursor untouched", () => {
  let calls = 0;
  const spy = { d(sides) { calls++; return 1; }, getState: () => 999 };
  const before = controlResistCheck({ floor: { depth: 12 }, acts: 0, combat: { round: 1 } }, spy, "test", 0);
  assert.equal(calls, 0, "no draw at all at or below the knee");
  assert.deepEqual(before, { rolled: false, resisted: false, roll: undefined, faces: 0 });

  const cursorSpy = { getState: () => 12345 };
  const result = controlResistCheck({ floor: { depth: 20 }, acts: 3, combat: { round: 1 } }, cursorSpy, "test", 0);
  assert.equal(result.rolled, true);
  assert.equal(cursorSpy.getState(), 12345, "the main cursor is unchanged by the derived-stream draw");
});

test("controlResistCheck: the same (state, purpose, idx) gives the same result twice; a different idx can differ", () => {
  const probe = { getState: () => 0 };
  const a = controlResistCheck({ floor: { depth: 20 }, acts: 5, combat: { round: 1 } }, probe, "freeze:Freeze", 0);
  const b = controlResistCheck({ floor: { depth: 20 }, acts: 5, combat: { round: 1 } }, probe, "freeze:Freeze", 0);
  assert.deepEqual(a, b);
  const results = new Set();
  for (let idx = 0; idx < 12; idx++) {
    results.add(JSON.stringify(controlResistCheck({ floor: { depth: 20 }, acts: 5, combat: { round: 1 } }, probe, "freeze:Freeze", idx)));
  }
  assert.ok(results.size > 1, "at least one idx must produce a different result");
});

// ---------------------------------------------------------------------------
// Task 2: targetStrikeFaces (held), resistControl/holdFoe, the held skip,
// and every combat.js control site.
// ---------------------------------------------------------------------------

test("targetStrikeFaces: a held foe is hit like a dozing foe (at least 5 faces)", () => {
  const c = { magicWpn: 0, weapon: "Club" };
  assert.equal(targetStrikeFaces(c, { held: { kind: "frozen", left: 2 } }, 3), 5, "raises a low base");
  assert.equal(targetStrikeFaces(c, { held: { kind: "frozen", left: 2 } }, 8), 8, "never lowers an already-high base");
  assert.equal(targetStrikeFaces(c, {}, 3), 3, "a plain target is unaffected");
});

test("resistControl: floor 20 resisted marks foe.resisted and pushes controlResisted with roll/atLeast/dieN/depth", () => {
  const foe = fixedFoe();
  const acts = forceControlResist("freeze:Freeze", 0, 20, 1, 0, true);
  const state = fixedState({ floor: { depth: 20 } });
  state.acts = acts;
  state.combat = fixedCombat([foe]);
  const events = [];
  const result = resistControl(state, foe, "freeze", "Freeze", 0, fakeRng([]), events);
  assert.equal(result, true);
  assert.equal(foe.resisted, "freeze");
  const ev = events.find((e) => e.type === "controlResisted");
  assert.ok(ev, "controlResisted event pushed");
  assert.equal(ev.target, "Target");
  assert.equal(ev.effect, "freeze");
  assert.equal(ev.source, "Freeze");
  assert.equal(ev.dieN, 20);
  assert.equal(ev.depth, 20);
  assert.equal(ev.atLeast, 21 - controlResistFacesFor(20));
  assert.ok(Number.isInteger(ev.roll));
});

test("resistControl: floor 20 a miss returns false and changes nothing", () => {
  const foe = fixedFoe();
  const acts = forceControlResist("freeze:Freeze", 0, 20, 1, 0, false);
  const state = fixedState({ floor: { depth: 20 } });
  state.acts = acts;
  state.combat = fixedCombat([foe]);
  const events = [];
  const result = resistControl(state, foe, "freeze", "Freeze", 0, fakeRng([]), events);
  assert.equal(result, false);
  assert.equal("resisted" in foe, false);
  assert.equal(events.length, 0);
});

test("resistControl: floor 12 returns false with no event and no draw", () => {
  const foe = fixedFoe();
  const state = fixedState({ floor: { depth: 12 } });
  state.combat = fixedCombat([foe]);
  const events = [];
  const result = resistControl(state, foe, "freeze", "Freeze", 0, fakeRng([]), events);
  assert.equal(result, false);
  assert.equal(events.length, 0);
});

test("holdFoe: sets foe.held { kind, left } and pushes controlHeld", () => {
  const foe = fixedFoe();
  const state = fixedState({ floor: { depth: 20 } });
  const events = [];
  // Phase 90 plan 05: opts.rounds is required (the controlHoldRoundsFor depth default is gone; before: no opts, 3 at floor 20).
  holdFoe(state, foe, "frozen", "Freeze", events, { rounds: 3 });
  assert.deepEqual(foe.held, { kind: "frozen", left: 3 });
  const ev = events.find((e) => e.type === "controlHeld");
  assert.deepEqual(ev, { type: "controlHeld", target: "Target", kind: "frozen", rounds: 3, source: "Freeze" });
});

test("held skip: foeTurn skips a held foe for exactly 3 visits (foeStillHeld 2, 1, then foeHoldBroken); it acts on the 4th", () => {
  const foe = fixedFoe({ wp: 30, maxWP: 30 });
  const state = fixedState({ floor: { depth: 20 } });
  state.combat = fixedCombat([foe]);
  const events = [];
  holdFoe(state, foe, "frozen", "Freeze", events, { rounds: 3 });
  assert.deepEqual(foe.held, { kind: "frozen", left: 3 });

  const e1 = foeTurn(state, fakeRng(PAD(5)), []);
  assert.deepEqual(foe.held, { kind: "frozen", left: 2 });
  assert.ok(e1.some((e) => e.type === "foeStillHeld" && e.left === 2));
  assert.equal(e1.some((e) => e.type === "foeHoldBroken"), false);

  const e2 = foeTurn(state, fakeRng(PAD(5)), []);
  assert.deepEqual(foe.held, { kind: "frozen", left: 1 });
  assert.ok(e2.some((e) => e.type === "foeStillHeld" && e.left === 1));

  const e3 = foeTurn(state, fakeRng(PAD(5)), []);
  assert.equal("held" in foe, false, "the hold clears on its last skip");
  assert.ok(e3.some((e) => e.type === "foeHoldBroken"));
  assert.equal(e3.some((e) => e.type === "foeStillHeld"), false);

  // The 4th visit: no held field, the foe acts (attempts its normal swing —
  // any further rng draw proves it was NOT skipped, unlike the three before).
  const e4 = foeTurn(state, fakeRng(PAD(5)), []);
  assert.equal(e4.some((e) => e.type === "foeStillHeld" || e.type === "foeHoldBroken"), false);
});

test("held skip: a held foe's asleep count runs down alongside — asleep 5 reads 2 when the hold breaks", () => {
  const foe = fixedFoe({ wp: 30, maxWP: 30, asleep: 5 });
  const state = fixedState({ floor: { depth: 20 } });
  state.combat = fixedCombat([foe]);
  foe.held = { kind: "frozen", left: 3 };
  foeTurn(state, fakeRng(PAD(5)), []);
  foeTurn(state, fakeRng(PAD(5)), []);
  foeTurn(state, fakeRng(PAD(5)), []);
  assert.equal("held" in foe, false);
  assert.equal(foe.asleep, 2);
});

// --- C2: allyCast thrown Freeze (a Joiner's Freeze) -------------------------

// User rulings 2026-09-28 (re-pinned, plan 79.2-01): "freeze should never
// kill outright. It should deal its damage and freeze an enemy for 1d4
// rounds" — at every depth. A survivor draws the hold's d4 right after the
// damage (resisted or not), then the intel resist, then (past the knee) the
// RULES-18 control resist; a Freeze kill is a normal kill.
test("Joiner Freeze (C2): floor 20, a hit that leaves the foe standing and is not resisted holds it for the rolled d4 — no killFoe, no kill draws", () => {
  const foe = fixedFoe({ type: "Humans", wp: 30, maxWP: 30, intel: 1 });
  const state = fixedState({ party: [muMember({ grimoire: ["Freeze"] })], floor: { depth: 20 } });
  state.acts = forceRisingResist("Freeze", "Ada", 0, 20, 1, 0, false); // Phase 89 plan 08: the one depth-rising resist
  state.combat = fixedCombat([foe], { allies: [fixedAlly()] });
  // check roll (d10, raw 5 -> mirrored 6, hits need 6 with school+3), dmg (d6, raw 4), hold d4 (3).
  const events = alliesTurn(state, fakeRng([5, 4, 3]), []);
  assert.equal(foe.alive, true);
  assert.deepEqual(foe.held, { kind: "frozen", left: 3 });
  assert.equal(events.some((e) => e.type === "foeKilled"), false);
  const hit = events.find((e) => e.type === "allySpellHit");
  assert.equal(hit.effect, "damage");
  assert.ok(events.some((e) => e.type === "controlHeld" && e.freeze === true && e.rounds === 3));
});

// Phase 89 plan 08 (ITEM-01, Q1): re-pinned. The Joiner's floor-20 Freeze has
// one resist (the depth-rising one, freezeFoe's): no controlResisted, no
// Unmoved mark.
test("Joiner Freeze (C2): floor 20, a resisted hit leaves the foe standing, damaged, with no hold (the d4 is drawn either way)", () => {
  const foe = fixedFoe({ type: "Humans", wp: 30, maxWP: 30, intel: 1 });
  const state = fixedState({ party: [muMember({ grimoire: ["Freeze"] })], floor: { depth: 20 } });
  state.acts = forceRisingResist("Freeze", "Ada", 0, 20, 1, 0, true);
  state.combat = fixedCombat([foe], { allies: [fixedAlly()] });
  const events = alliesTurn(state, fakeRng([5, 4, 3]), []);
  assert.equal(foe.alive, true);
  assert.equal(foe.wp, 25, "the damage landed (d6 4 + the level-1 Joiner's level² 1, quick 260928-sq2)");
  assert.equal("held" in foe, false);
  assert.equal("resisted" in foe, false);
  assert.ok(events.some((e) => e.type === "spellResisted" && e.freeze === true && e.by === "Ada"));
  assert.equal(events.some((e) => e.type === "controlResisted"), false);
  const hit = events.find((e) => e.type === "allySpellHit");
  assert.equal(hit.effect, "damage");
});

test("Joiner Freeze (C2): a hit that drops the foe to 0 hp is a normal kill (no frozen-solid), on floor 20 and floor 12 alike", () => {
  for (const depth of [12, 20]) {
    const foe = fixedFoe({ type: "Humans", wp: 3, maxWP: 30, intel: 1 });
    const state = fixedState({ party: [muMember({ grimoire: ["Freeze"] })], floor: { depth } });
    state.combat = fixedCombat([foe], { allies: [fixedAlly()] });
    const events = alliesTurn(state, fakeRng([5, 4, 4, 1, 20]), []);
    assert.equal(foe.alive, false, `depth ${depth}`);
    const hit = events.find((e) => e.type === "allySpellHit");
    assert.equal(hit.effect, "damage", `depth ${depth}`);
    assert.equal("frozen" in foe, false, `depth ${depth}`);
    assert.ok(events.some((e) => e.type === "foeKilled"), `depth ${depth}`);
    assert.equal(events.some((e) => e.type === "frozenSolid" || e.type === "controlHeld"), false, `depth ${depth}`);
  }
});

test("Joiner Freeze (C2): floor 12, a standing hit is frozen for its d4 and survives (no control resist roll at the knee, no kill)", () => {
  const foe = fixedFoe({ type: "Humans", wp: 30, maxWP: 30, intel: 1 });
  const state = fixedState({ party: [muMember({ grimoire: ["Freeze"] })], floor: { depth: 12 } });
  state.combat = fixedCombat([foe], { allies: [fixedAlly()] });
  const events = alliesTurn(state, fakeRng([5, 4, 2, ...PAD(10)]), []);
  assert.equal(foe.alive, true);
  assert.deepEqual(foe.held, { kind: "frozen", left: 2 });
  assert.equal(events.some((e) => e.type === "controlResisted"), false);
  assert.ok(events.some((e) => e.type === "controlHeld" && e.freeze === true && e.rounds === 2));
  assert.equal(events.some((e) => e.type === "foeKilled" || e.type === "frozenSolid"), false);
});

// --- C9: allyCast status/stun (Doze/Stun) and weaken (a Joiner's) ----------

// Phase 90 plan 04 (SPELL-12, user 2026-09-30: one depth-rising resist for every
// spell, no floor-12 extras): re-pinned. A Joiner's Doze rolls ONE resist
// (foeResistsSpell, the depth-rising one, keyed on the Joiner's own name); there
// is no second control resist after the d4, so a resisted Doze ends at once and
// draws NO d4 (before: the d4 was drawn first and the control resist followed),
// and there is no Unmoved mark and no controlResisted line.
test("Joiner Doze (C9): floor 20, one depth-rising resist; a resisted Doze draws no d4 and marks nothing; a landed sleep lasts its rolled d4 (not capped)", () => {
  const foeR = fixedFoe({ type: "Humans", wp: 30, maxWP: 30, intel: 1 });
  const stateR = fixedState({ party: [muMember({ grimoire: ["Doze"] })], floor: { depth: 20 } });
  stateR.acts = forceRisingResist("Doze", "Ada", 0, 20, 1, 1, true);
  stateR.combat = fixedCombat([foeR], { allies: [fixedAlly()] });
  // Phase 90 plan 05: a Joiner's Doze is dozeFoes: the d4 REACH is drawn first (1 here), then the foe's resist
  // (a derived stream); a resisted foe draws no sleeping d4 (the 3 is never taken).
  const rngR = trackingRng([1, 3]);
  const eventsR = alliesTurn(stateR, rngR, []);
  assert.equal(foeR.asleep, 0);
  assert.equal("resisted" in foeR, false, "no Unmoved mark: there is no separate control resist");
  const line = eventsR.find((e) => e.type === "spellResisted");
  assert.ok(line);
  assert.equal(line.by, "Ada");
  assert.equal(line.depthFaces, 8);
  assert.equal(eventsR.some((e) => e.type === "controlResisted"), false);
  assert.equal(rngR.getState(), 1, "only the reach was drawn: the resisted foe took no sleeping d4");

  const foeL = fixedFoe({ type: "Humans", wp: 30, maxWP: 30, intel: 1 });
  const stateL = fixedState({ party: [muMember({ grimoire: ["Doze"] })], floor: { depth: 20 } });
  stateL.acts = forceRisingResist("Doze", "Ada", 0, 20, 1, 1, false);
  stateL.combat = fixedCombat([foeL], { allies: [fixedAlly()] });
  const rngL = trackingRng([1, 3]);
  const eventsL = alliesTurn(stateL, rngL, []);
  assert.equal(foeL.asleep, 3, "the d4's own rolled duration, never capped");
  assert.equal("resisted" in foeL, false);
  const hit = eventsL.find((e) => e.type === "dozed");
  assert.equal(hit.rounds, 3);
  assert.equal(hit.by, "Ada");
  assert.equal(rngL.getState(), 2, "a landed Doze takes its reach d4 and its own sleeping d4");
});

// Phase 89 plan 08 (ITEM-01, Q1): re-pinned. The Joiner's Weaken has no extra
// room resist past floor 12: each live foe rolls its own depth-rising resist;
// when every one resists nothing lands (no Unmoved marks).
test("Joiner Weaken (C15): floor 20, the d4+1 is always drawn; every foe resisting means no weakened flag; a foe failing its resist means today's d4+1 timer", () => {
  const foeR1 = fixedFoe({ name: "R1", type: "Humans", wp: 30, maxWP: 30, intel: 1 });
  const foeR2 = fixedFoe({ name: "R2", type: "Humans", wp: 30, maxWP: 30, intel: 1 });
  const stateR = fixedState({ party: [muMember({ grimoire: ["Weaken"] })], floor: { depth: 20 } });
  stateR.acts = forceRisingResistAll("Weaken", "Ada", [0, 1], 20, 1, 0, true);
  stateR.combat = fixedCombat([foeR1, foeR2], { allies: [fixedAlly()] });
  const eventsR = alliesTurn(stateR, fakeRng([3]), []);
  assert.equal(stateR.combat.weakened, undefined);
  assert.equal("resisted" in foeR1, false);
  assert.equal("resisted" in foeR2, false, "no Unmoved marks: no separate room resist");
  assert.equal(eventsR.filter((e) => e.type === "spellResisted").length, 2);
  assert.equal(eventsR.some((e) => e.type === "allySpellHit"), false);

  const foeL = fixedFoe({ type: "Humans", wp: 30, maxWP: 30, intel: 1 });
  const stateL = fixedState({ party: [muMember({ grimoire: ["Weaken"] })], floor: { depth: 20 } });
  stateL.acts = forceRisingResist("Weaken", "Ada", 0, 20, 1, 0, false);
  stateL.combat = fixedCombat([foeL], { allies: [fixedAlly()] });
  const eventsL = alliesTurn(stateL, fakeRng([3]), []);
  assert.equal(stateL.combat.weakened, true);
  assert.equal(stateL.combat.foeToHitPenalty, 3);
  const hit = eventsL.find((e) => e.type === "allySpellHit");
  assert.equal(hit.effect, "weakened");
  assert.equal(hit.rounds, 4); // d4 raw 3 -> +1 = 4
});

// --- C3: foeTurn's Ice payoff -----------------------------------------------

// Phase 90 plan 04 (SPELL-12, user 2026-09-30: no floor-12 special effects):
// re-pinned. The Ice payoff has no knee branch any more (no control resist, no
// three-round hold): a survivor of the last tick freezes solid and dies at EVERY
// depth, as it did at or below floor 12 (the one resist it rolled was the cast's
// own). Plan 90-05 replaces Ice with its area form. Before: floor 20 resisted ->
// the foe took its turn, marked Unmoved; floor 20 landed -> a 3-round hold.
// Phase 90 plan 05 (SPELL-12, Q5 A): re-pinned again. Ice is the area freeze
// (combat.js#iceStorm), so foeTurn has NO Ice payoff at any depth. Before: Ice's
// last damage-over-time tick froze a survivor solid and killed it (frozenSolid,
// killFoe). After: a stray `by: "ice"` dot record (an old save's foe) is a plain
// tick that just ends, like Poisoned Edge's, and never freezes.
test("Ice's old last tick (C3, retired): a leftover ice dot just ticks and ends at every depth; nothing freezes solid", () => {
  for (const depth of [12, 13, 20]) {
    const foe = fixedFoe({ wp: 30, maxWP: 30, dot: { left: 1, dmg: { n: 1, sides: 6, bonus: 0 }, by: "ice" } });
    const state = fixedState({ floor: { depth } });
    state.combat = fixedCombat([foe]);
    const events = foeTurn(state, fakeRng([3, ...PAD(5)]), []);
    assert.equal(foe.alive, true, `depth ${depth}`);
    assert.equal("dot" in foe, false, `depth ${depth}`);
    assert.equal(events.some((e) => e.type === "frozenSolid" || e.type === "controlHeld" || e.type === "controlResisted"), false, `depth ${depth}`);
  }
});

// --- C13: the Bard's song (retired and replaced) -----------------------------
//
// Phase 91 plan 06 (IDENT-17): the four tests that stood here pinned the old Lullaby
// and Cry of Thunder songs (resistControl x2 and controlCapRounds in sing). SING is now
// one random offense or protection spell cast through castSpell's free mode, so a song
// that reaches a foe rolls the ONE shared depth-rising resist (spellResisted / resistFailed)
// like every spell, with no control resist, no hold and no cap. The replacement pin:

test("Bard song (C13, IDENT-17): at floor 20 a sung Doze rolls the shared rising resist, never resistControl, and caps nothing", () => {
  const foe = fixedFoe({ name: "Target", lvl: 1, intel: 8, wp: 30, maxWP: 30 });
  const state = fixedState({ c: { sub: "Bard", level: 3 }, floor: { depth: 20 } });
  state.combat = fixedCombat([foe]);
  const pool = songPool(3);
  let acts = 0;
  while (pool[derivedRng(0, "song", acts).d(pool.length) - 1].n !== "Doze") acts++;
  state.acts = acts;
  const events = sing(state, fakeRng([...PAD(30)]), []);
  assert.ok(events.some((e) => e.type === "sang" && e.spell === "Doze"));
  assert.ok(events.some((e) => (e.type === "spellResisted" || e.type === "resistFailed") && e.spell === "Doze"), "the one shared resist is rolled and narrated");
  assert.equal(events.some((e) => e.type === "controlResisted" || e.type === "controlHeld"), false, "no second control resist");
  assert.equal("resisted" in foe, false, "resistControl never marks the foe");
});

// ---------------------------------------------------------------------------
// Task 3: narration and chips (fuller coverage lives in test/unit/foe-
// conditions.test.js and the eventNarration/narrationLines coverage suites —
// this section proves the specific behaviour block claims for this plan).
// ---------------------------------------------------------------------------

test("EVENT_NARRATION.controlResisted: names the target and the effect, reads 'shrugs off', prints the roll and range, no percent sign; survives a bare payload", () => {
  const out = EVENT_NARRATION.controlResisted({ target: "Wraith", effect: "freeze", source: "Freeze", roll: 17, atLeast: 13, dieN: 20, depth: 20 });
  assert.ok(out.includes("Wraith"));
  assert.ok(out.includes("frost"));
  assert.ok(out.includes("shrugs off"));
  assert.ok(out.includes("17"));
  assert.ok(out.includes("13–20"));
  assert.equal(out.includes("%"), false);
  for (const type of ["controlResisted", "controlHeld", "foeStillHeld", "foeHoldBroken"]) {
    const bare = EVENT_NARRATION[type]({ type });
    assert.ok(typeof bare === "string" && bare.trim().length > 0, `${type} must survive a bare payload`);
  }
});

test("LINE_FOR: the four events carry their own tones (miss/magic/dodge/hurt)", () => {
  assert.equal(LINE_FOR.controlResisted({ type: "controlResisted" }).tone, "miss");
  assert.equal(LINE_FOR.controlHeld({ type: "controlHeld" }).tone, "magic");
  assert.equal(LINE_FOR.foeStillHeld({ type: "foeStillHeld" }).tone, "dodge");
  assert.equal(LINE_FOR.foeHoldBroken({ type: "foeHoldBroken" }).tone, "hurt");
});

// Phase 90 plan 04 (SPELL-12): re-pinned. A Freeze's hold is the only hold left
// (Petrify kills, Stupidity drops intelligence), so the Held chip reads
// 'Frozen · n'; the 'Stone · n' and 'Stupefied · n' hold chips are gone.
test("chips: a held foe shows 'Frozen · n' (tone good); an unmoved foe shows 'Unmoved' (tone bad) naming the effect", () => {
  const frozenChip = foeConditionChips(fixedFoe({ held: { kind: "frozen", left: 1 } }), fixedState())[0];
  assert.equal(frozenChip.text, "Frozen · 1");
  assert.equal(frozenChip.tone, "good");

  const unmovedChip = foeConditionChips(fixedFoe({ resisted: "weaken" }), fixedState())[0];
  assert.equal(unmovedChip.text, "Unmoved");
  assert.equal(unmovedChip.tone, "bad");
  assert.ok(unmovedChip.desc.includes("weaken"));
});
