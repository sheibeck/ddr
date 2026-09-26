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
} from "../../engine/combat.js";
import { targetStrikeFaces, controlResistRoll, controlResistCheck } from "../../engine/derived.js";
import {
  DIALS,
  setDialsForTuning,
  controlResistFacesFor,
  controlHoldRoundsFor,
  controlCapRounds,
} from "../../engine/difficulty.js";

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
  holdFoe(state, foe, "frozen", "Freeze", events);
  assert.deepEqual(foe.held, { kind: "frozen", left: 3 });
  const ev = events.find((e) => e.type === "controlHeld");
  assert.deepEqual(ev, { type: "controlHeld", target: "Target", kind: "frozen", rounds: 3, source: "Freeze" });
});

test("held skip: foeTurn skips a held foe for exactly 3 visits (foeStillHeld 2, 1, then foeHoldBroken); it acts on the 4th", () => {
  const foe = fixedFoe({ wp: 30, maxWP: 30 });
  const state = fixedState({ floor: { depth: 20 } });
  state.combat = fixedCombat([foe]);
  const events = [];
  holdFoe(state, foe, "frozen", "Freeze", events);
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

test("Joiner Freeze (C2): floor 20, a hit that leaves the foe standing and is not resisted holds it — no killFoe, no kill draws", () => {
  const foe = fixedFoe({ type: "Humans", wp: 30, maxWP: 30, intel: 1 });
  const state = fixedState({ party: [muMember({ grimoire: ["Freeze"] })], floor: { depth: 20 } });
  state.acts = forceControlResist("freeze:Freeze", 0, 20, 1, 0, false);
  state.combat = fixedCombat([foe], { allies: [fixedAlly()] });
  // check roll (d10, raw 5 -> mirrored 6, hits need 6 with school+3), dmg (d6, raw 4).
  const events = alliesTurn(state, fakeRng([5, 4]), []);
  assert.equal(foe.alive, true);
  assert.deepEqual(foe.held, { kind: "frozen", left: 3 });
  assert.equal(events.some((e) => e.type === "foeKilled"), false);
  const hit = events.find((e) => e.type === "allySpellHit");
  assert.equal(hit.effect, "damage");
  assert.ok(events.some((e) => e.type === "controlHeld"));
});

test("Joiner Freeze (C2): floor 20, a resisted hit leaves the foe standing, damaged, with no hold", () => {
  const foe = fixedFoe({ type: "Humans", wp: 30, maxWP: 30, intel: 1 });
  const state = fixedState({ party: [muMember({ grimoire: ["Freeze"] })], floor: { depth: 20 } });
  state.acts = forceControlResist("freeze:Freeze", 0, 20, 1, 0, true);
  state.combat = fixedCombat([foe], { allies: [fixedAlly()] });
  const events = alliesTurn(state, fakeRng([5, 4]), []);
  assert.equal(foe.alive, true);
  assert.equal("held" in foe, false);
  assert.equal(foe.resisted, "freeze");
  assert.ok(events.some((e) => e.type === "controlResisted"));
  const hit = events.find((e) => e.type === "allySpellHit");
  assert.equal(hit.effect, "damage");
});

test("Joiner Freeze (C2): a hit that drops the foe to 0 hp kills it exactly as today, on floor 20 and floor 12 alike", () => {
  for (const depth of [12, 20]) {
    const foe = fixedFoe({ type: "Humans", wp: 3, maxWP: 30, intel: 1 });
    const state = fixedState({ party: [muMember({ grimoire: ["Freeze"] })], floor: { depth } });
    state.combat = fixedCombat([foe], { allies: [fixedAlly()] });
    const events = alliesTurn(state, fakeRng([5, 4, 4, 1, 20]), []);
    assert.equal(foe.alive, false, `depth ${depth}`);
    const hit = events.find((e) => e.type === "allySpellHit");
    assert.equal(hit.effect, "frozen", `depth ${depth}`);
    assert.ok(events.some((e) => e.type === "foeKilled"), `depth ${depth}`);
  }
});

test("Joiner Freeze (C2): floor 12, a standing hit is frozen-solid killed exactly as today (no resist roll, no hold)", () => {
  const foe = fixedFoe({ type: "Humans", wp: 30, maxWP: 30, intel: 1 });
  const state = fixedState({ party: [muMember({ grimoire: ["Freeze"] })], floor: { depth: 12 } });
  state.combat = fixedCombat([foe], { allies: [fixedAlly()] });
  const events = alliesTurn(state, fakeRng([5, 4, ...PAD(10)]), []);
  assert.equal(foe.alive, false);
  assert.equal("held" in foe, false);
  assert.equal(events.some((e) => e.type === "controlResisted" || e.type === "controlHeld"), false);
});

// --- C9: allyCast status/stun (Doze/Stun) and weaken (a Joiner's) ----------

test("Joiner Doze (C9): floor 20, the d4 is drawn whether or not the foe resists; a landed sleep lasts its rolled d4 (not capped)", () => {
  const foeR = fixedFoe({ type: "Humans", wp: 30, maxWP: 30, intel: 1 });
  const stateR = fixedState({ party: [muMember({ grimoire: ["Doze"] })], floor: { depth: 20 } });
  stateR.acts = forceControlResist("sleep:Doze", 0, 20, 1, 0, true);
  stateR.combat = fixedCombat([foeR], { allies: [fixedAlly()] });
  const eventsR = alliesTurn(stateR, fakeRng([3]), []); // d4 raw draw -> 3
  assert.equal(foeR.asleep, 0);
  assert.equal(foeR.resisted, "sleep");
  assert.ok(eventsR.some((e) => e.type === "controlResisted"));

  const foeL = fixedFoe({ type: "Humans", wp: 30, maxWP: 30, intel: 1 });
  const stateL = fixedState({ party: [muMember({ grimoire: ["Doze"] })], floor: { depth: 20 } });
  stateL.acts = forceControlResist("sleep:Doze", 0, 20, 1, 0, false);
  stateL.combat = fixedCombat([foeL], { allies: [fixedAlly()] });
  const eventsL = alliesTurn(stateL, fakeRng([3]), []);
  assert.equal(foeL.asleep, 3, "the d4's own rolled duration, never capped");
  assert.equal("resisted" in foeL, false);
  const hit = eventsL.find((e) => e.type === "allySpellHit");
  assert.equal(hit.rounds, 3);
});

test("Joiner Doze (C9): draw parity — the main rng cursor after a resisted cast equals a landed one, for the same scripted main sequence", () => {
  const cursorAtCall = 1; // resistRoll: 0 draws (intel 1); the d4 "rolled" draw: 1
  const actsResisted = forceControlResist("sleep:Doze", 0, 20, 1, cursorAtCall, true);
  const actsLanded = forceControlResist("sleep:Doze", 0, 20, 1, cursorAtCall, false);

  const foe1 = fixedFoe({ type: "Humans", wp: 30, maxWP: 30, intel: 1 });
  const state1 = fixedState({ party: [muMember({ grimoire: ["Doze"] })], floor: { depth: 20 } });
  state1.acts = actsResisted;
  state1.combat = fixedCombat([foe1], { allies: [fixedAlly()] });
  const rng1 = trackingRng([3]);
  alliesTurn(state1, rng1, []);

  const foe2 = fixedFoe({ type: "Humans", wp: 30, maxWP: 30, intel: 1 });
  const state2 = fixedState({ party: [muMember({ grimoire: ["Doze"] })], floor: { depth: 20 } });
  state2.acts = actsLanded;
  state2.combat = fixedCombat([foe2], { allies: [fixedAlly()] });
  const rng2 = trackingRng([3]);
  alliesTurn(state2, rng2, []);

  assert.equal(foe1.resisted, "sleep");
  assert.ok(foe2.asleep > 0);
  assert.equal(rng1.getState(), rng2.getState(), "the main cursor advances identically regardless of the resist outcome");
});

test("Joiner Weaken (C15): floor 20, the d4+1 is always drawn; resisted means no weakened flag and every live foe marked; landed means today's d4+1 timer", () => {
  const foeR1 = fixedFoe({ name: "R1", type: "Humans", wp: 30, maxWP: 30, intel: 1 });
  const foeR2 = fixedFoe({ name: "R2", type: "Humans", wp: 30, maxWP: 30, intel: 1 });
  const stateR = fixedState({ party: [muMember({ grimoire: ["Weaken"] })], floor: { depth: 20 } });
  stateR.acts = forceControlResist("weaken:Weaken", 0, 20, 1, 0, true);
  stateR.combat = fixedCombat([foeR1, foeR2], { allies: [fixedAlly()] });
  const eventsR = alliesTurn(stateR, fakeRng([3]), []);
  assert.equal(stateR.combat.weakened, undefined);
  assert.equal(foeR1.resisted, "weaken");
  assert.equal(foeR2.resisted, "weaken", "every live foe is marked, not just the aimed-at target");
  assert.equal(eventsR.some((e) => e.type === "allySpellHit"), false);

  const foeL = fixedFoe({ type: "Humans", wp: 30, maxWP: 30, intel: 1 });
  const stateL = fixedState({ party: [muMember({ grimoire: ["Weaken"] })], floor: { depth: 20 } });
  stateL.acts = forceControlResist("weaken:Weaken", 0, 20, 1, 0, false);
  stateL.combat = fixedCombat([foeL], { allies: [fixedAlly()] });
  const eventsL = alliesTurn(stateL, fakeRng([3]), []);
  assert.equal(stateL.combat.weakened, true);
  assert.equal(stateL.combat.foeToHitPenalty, 3);
  const hit = eventsL.find((e) => e.type === "allySpellHit");
  assert.equal(hit.effect, "weakened");
  assert.equal(hit.rounds, 4); // d4 raw 3 -> +1 = 4
});

// --- C3: foeTurn's Ice payoff -----------------------------------------------

test("Ice's last tick (C3): floor 20, a resisted foe takes its turn as normal", () => {
  const foe = fixedFoe({ wp: 30, maxWP: 30, dot: { left: 1, dmg: { n: 1, sides: 6, bonus: 0 }, by: "ice" } });
  const state = fixedState({ floor: { depth: 20 } });
  state.acts = forceControlResist("freeze:Ice", 0, 20, 1, 0, true);
  state.combat = fixedCombat([foe]);
  const events = foeTurn(state, fakeRng([3, ...PAD(5)]), []);
  assert.equal(foe.alive, true);
  assert.equal("held" in foe, false);
  assert.equal(foe.resisted, "freeze");
  assert.equal(events.some((e) => e.type === "frozenSolid"), false);
  assert.ok(events.some((e) => e.type === "controlResisted"));
});

test("Ice's last tick (C3): floor 20, a held foe skips this turn and the next two (3 skips total, holdRounds)", () => {
  const foe = fixedFoe({ wp: 30, maxWP: 30, dot: { left: 1, dmg: { n: 1, sides: 6, bonus: 0 }, by: "ice" } });
  const state = fixedState({ floor: { depth: 20 } });
  state.acts = forceControlResist("freeze:Ice", 0, 20, 1, 0, false);
  state.combat = fixedCombat([foe]);
  // The SAME foeTurn call that sets the hold falls through into the held-
  // skip block below it (no `continue` between holdFoe and the skip check),
  // so "this turn" is already the first of the 3 skips: left 3 -> 2.
  const events = foeTurn(state, fakeRng([3, ...PAD(5)]), []);
  assert.deepEqual(foe.held, { kind: "frozen", left: 2 });
  assert.ok(events.some((e) => e.type === "controlHeld"));
  assert.ok(events.some((e) => e.type === "foeStillHeld" && e.left === 2));
  assert.equal(events.some((e) => e.type === "frozenSolid"), false);

  foeTurn(state, fakeRng(PAD(5)), []);
  assert.deepEqual(foe.held, { kind: "frozen", left: 1 });

  const e3 = foeTurn(state, fakeRng(PAD(5)), []);
  assert.equal("held" in foe, false);
  assert.ok(e3.some((e) => e.type === "foeHoldBroken"));
});

test("Ice's last tick (C3): floor 12, it freezes and dies as today", () => {
  const foe = fixedFoe({ wp: 30, maxWP: 30, dot: { left: 1, dmg: { n: 1, sides: 6, bonus: 0 }, by: "ice" } });
  const state = fixedState({ floor: { depth: 12 } });
  state.combat = fixedCombat([foe]);
  const events = foeTurn(state, fakeRng([3, ...PAD(5)]), []);
  assert.equal(foe.alive, false);
  assert.ok(events.some((e) => e.type === "frozenSolid"));
  assert.equal(events.some((e) => e.type === "controlResisted" || e.type === "controlHeld"), false);
});

// --- C13: sing() Lullaby and Thunder ----------------------------------------

test("Bard Lullaby (C13): floor 20, each eligible foe either resists (marked, awake) or sleeps 3 (not 24); ineligible foes are untouched", () => {
  const eligibleResist = fixedFoe({ name: "ER", lvl: 1, wp: 30, maxWP: 30 });
  const eligibleLand = fixedFoe({ name: "EL", lvl: 1, wp: 30, maxWP: 30 });
  const ineligible = fixedFoe({ name: "IN", lvl: 99, wp: 30, maxWP: 30 });
  const state = fixedState({ c: { sub: "Bard", level: 3 }, floor: { depth: 20 } });
  state.combat = fixedCombat([eligibleResist, eligibleLand, ineligible]);
  // n = rng.d(6) draws first; force it to 3 so all three foes are in scope.
  state.acts = forceControlResist("sleep:Lullaby", 0, 20, 1, 0, true);
  const events = sing(state, fakeRng([3, ...PAD(20)]), []);
  assert.equal(eligibleResist.resisted, "sleep");
  assert.equal(eligibleResist.asleep, 0);
  assert.equal("resisted" in ineligible, false);
  assert.equal(ineligible.asleep, 0);
  assert.ok(events.some((e) => e.type === "lullabyRolled"));
  assert.ok(events.some((e) => e.type === "controlResisted"));
});

test("Bard Lullaby (C13): a landed sleep caps at controlHoldRoundsFor(depth), not the full 24", () => {
  const foe = fixedFoe({ lvl: 1, wp: 30, maxWP: 30 });
  const state = fixedState({ c: { sub: "Bard", level: 3 }, floor: { depth: 20 } });
  state.combat = fixedCombat([foe]);
  state.acts = forceControlResist("sleep:Lullaby", 0, 20, 1, 0, false);
  sing(state, fakeRng([1, ...PAD(20)]), []);
  // 3 (the hold cap) minus 1 (foeTurn's own asleep-decrement, same action —
  // see test/unit/combat.test.js's own "24 -> 23" precedent).
  assert.equal(foe.asleep, 2);
});

test("Bard Lullaby (C13): floor 12, the full 24 lands exactly as today (no resist roll)", () => {
  const foe = fixedFoe({ lvl: 1, wp: 30, maxWP: 30 });
  const state = fixedState({ c: { sub: "Bard", level: 3 }, floor: { depth: 12 } });
  state.combat = fixedCombat([foe]);
  const events = sing(state, fakeRng([1, ...PAD(20)]), []);
  assert.equal(foe.asleep, 23); // 24 minus the same-action foeTurn decrement
  assert.equal(events.some((e) => e.type === "controlResisted" || e.type === "controlHeld"), false);
});

test("Bard Thunder (C13): floor 20, eligible foes resist or keep their rolled sleep; ineligible foes roll nothing", () => {
  const eligible = fixedFoe({ lvl: 1, wp: 30, maxWP: 30 });
  const ineligible = fixedFoe({ lvl: 99, wp: 30, maxWP: 30 });
  const state = fixedState({ c: { sub: "Bard", level: 4 }, floor: { depth: 20 } });
  state.combat = fixedCombat([eligible, ineligible]);
  // n = rng.d(12), r = rng.d(8) draw first, in that order.
  state.acts = forceControlResist("sleep:Cry of Thunder", 0, 20, 1, 0, false);
  const events = sing(state, fakeRng([1, 4, ...PAD(20)]), []);
  assert.ok(eligible.asleep > 0, "a landed Thunder keeps its own rolled duration");
  assert.equal("resisted" in ineligible, false);
  assert.equal(ineligible.asleep, 0);
  assert.ok(events.some((e) => e.type === "thunderRolled"));
});
