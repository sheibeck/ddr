// test/unit/scroll-read.test.js
//
// RULES-10 (Phase 75.1) — dedicated coverage for readScroll's new
// intelligence-read rule: scrollReaderOf/scrollReadBands/scrollReadOutcome
// (engine/derived.js), scrollReadRng/readScroll (engine/magic.js), the
// in-combat fumble hand-off to engine/scrollFumble.js#resolveScrollFumble,
// and the Pilfer's own read under the same rule. `canRead` is gone — the
// ONLY scrollRefused reasons left are "noScrolls" and the pending-fight
// "notFought" (see test/unit/magic.test.js for the byte-identical Magic
// User path this plan does not touch, and test/parity/magic-parity.test.js's
// seed-7 fixture for the frozen-prototype proof of that same path).
//
// Every forced outcome below searches state.acts (bounded, 0..5000) with a
// REAL makeRng main rng until the actual scrollReadRng/rollCheck/
// scrollReadOutcome path lands the wanted outcome — never a mocked
// derivedRng (RULES-10's own interfaces note forbids it).

import test from "node:test";
import assert from "node:assert/strict";

import { readScroll, castSpell, scrollReadRng } from "../../engine/magic.js";
import { scrollReaderOf, scrollReadBands, scrollReadOutcome } from "../../engine/derived.js";
import { rollCheck } from "../../engine/dice.js";
import { makeRng } from "../../engine/rng.js";
import { SPELLS } from "../../content/index.js";
import { GW, GH } from "../../engine/maze.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { LINE_FOR } from "../../src/browser/narrationLines.js";

/** fakeRng(seq) — ports test/unit/magic.test.js's own helper verbatim. */
function fakeRng(seq, { pick = (arr) => arr[0] } = {}) {
  let i = 0;
  return {
    d(_sides) {
      if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick,
    shuffle: (a) => a,
  };
}

function fixedFloor(overrides = {}) {
  const g = [];
  for (let y = 0; y < GH; y++) {
    g.push([]);
    for (let x = 0; x < GW; x++) g[y].push({ wall: false, dark: false, seen: false, feat: null });
  }
  return { g, px: 1, py: 1, depth: 1, ...overrides };
}

function fixedChar(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
    maxWP: 40, wp: 40, skills: {}, vp: 0, intel: 10,
    weapon: "Dagger", prof: 0, magicWpn: 0,
    armor: "Cloth", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 4, rations: 4, gold: 50, scrolls: 1,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Reader",
    ...overrides,
  };
}

function fixedState(overrides = {}) {
  const { c: cOverrides, floor: floorOverrides, ...rest } = overrides;
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedChar(cOverrides),
    floor: fixedFloor(floorOverrides),
    day: 1, steps: 0, combat: null, store: null, beats: null,
    dead: false, deathNote: "", epitaph: "",
    ...rest,
  };
}

function fixedFoe(overrides = {}) {
  return { name: "Target", type: "Beasts", lvl: 1, size: "S", intel: 1, wp: 10, maxWP: 10, alive: true, asleep: 0, sp: {}, lives: 1, ...overrides };
}
function fixedCombat(foes, overrides = {}) {
  return { foes, type: foes[0]?.type || "Beasts", round: 1, target: 0, spellOpen: false, tracked: false, ...overrides };
}

// depth 1 -> min(5, depth+1) = 2, mirroring readScroll's own filter exactly.
const OPTIONS_DEPTH1 = SPELLS.filter((sp) => sp.lvl <= Math.min(5, 1 + 1));

/**
 * forceOutcome(seed, intel, wantOutcome) — searches state.acts (0..5000,
 * bounded) for the first value whose scroll-stream d20 (via the REAL
 * scrollReadRng/rollCheck/scrollReadOutcome path) lands `wantOutcome` for a
 * reader with this intel, off the cursor a fresh makeRng(seed) leaves after
 * readScroll's own one rng.pick(options) draw (the SAME single draw, in the
 * SAME position, readScroll itself makes before ever building the stream).
 * Returns { acts, roll, atLeast, dieN, fumbleAtLeast }. Never mocks
 * derivedRng — every draw here is the real thing.
 */
function forceOutcome(seed, intel, wantOutcome) {
  const bands = scrollReadBands(intel);
  for (let acts = 0; acts <= 5000; acts++) {
    const probe = makeRng(seed);
    probe.pick(OPTIONS_DEPTH1);
    const stream = scrollReadRng({ acts }, probe);
    const check = rollCheck(stream, bands.dieN, bands.atLeast);
    if (scrollReadOutcome(check, bands) === wantOutcome) {
      return { acts, roll: check.roll, atLeast: check.atLeast, dieN: check.dieN, fumbleAtLeast: bands.fumbleAtLeast };
    }
  }
  throw new Error(`forceOutcome: no acts within bound produced "${wantOutcome}" for intel ${intel}, seed ${seed}`);
}

// --- scrollReaderOf ---------------------------------------------------------

test("scrollReaderOf: Wizard/Summoner/Apprentice are magicUser; a Fighter with Runes/Signs is runes; a Fighter/Thief/Pilfer without it are intel", () => {
  assert.equal(scrollReaderOf({ cls: "Magic User", sub: "Wizard" }), "magicUser");
  assert.equal(scrollReaderOf({ cls: "Magic User", sub: "Summoner" }), "magicUser");
  assert.equal(scrollReaderOf({ cls: "Magic User", sub: "Apprentice" }), "magicUser");
  assert.equal(scrollReaderOf({ cls: "Fighter", sub: "Soldier", skills: { "Runes/Signs": 1 } }), "runes");
  assert.equal(scrollReaderOf({ cls: "Fighter", sub: "Soldier", skills: {} }), "intel");
  assert.equal(scrollReaderOf({ cls: "Thief", sub: "Cat Burglar", skills: {} }), "intel");
  assert.equal(scrollReaderOf({ cls: "Thief", sub: "Pilfer", skills: {} }), "intel");
});

// --- scrollReadBands ---------------------------------------------------------

test("scrollReadBands: worked examples pin atLeast/fumbleAtLeast/dieN; a higher intel never has a higher atLeast", () => {
  assert.deepEqual(scrollReadBands(14), { atLeast: 8, fumbleAtLeast: 4, dieN: 20 });
  assert.deepEqual(scrollReadBands(13), { atLeast: 9, fumbleAtLeast: 5, dieN: 20 });
  assert.deepEqual(scrollReadBands(20), { atLeast: 2, fumbleAtLeast: 1, dieN: 20 });
  assert.deepEqual(scrollReadBands(1), { atLeast: 21, fumbleAtLeast: 11, dieN: 20 });
  assert.deepEqual(scrollReadBands(undefined), { atLeast: 22, fumbleAtLeast: 11, dieN: 20 });

  let prevAtLeast = Infinity;
  for (let intel = 1; intel <= 20; intel++) {
    const { atLeast, dieN } = scrollReadBands(intel);
    assert.equal(dieN, 20);
    assert.ok(atLeast <= prevAtLeast, `intel ${intel}: atLeast ${atLeast} should not exceed the previous intel's ${prevAtLeast}`);
    prevAtLeast = atLeast;
  }
});

// --- scrollReadOutcome -------------------------------------------------------

test("scrollReadOutcome: bands(14) reads on 8/20, garbles on 4/7, fumbles on 1/3; bands(13) garbles on 5 and fumbles on 4 (exact-half rounding)", () => {
  const b14 = scrollReadBands(14);
  const mk = (roll, bands) => ({ roll, atLeast: bands.atLeast, dieN: bands.dieN, ok: roll >= bands.atLeast });
  assert.equal(scrollReadOutcome(mk(8, b14), b14), "read");
  assert.equal(scrollReadOutcome(mk(20, b14), b14), "read");
  assert.equal(scrollReadOutcome(mk(4, b14), b14), "garbled");
  assert.equal(scrollReadOutcome(mk(7, b14), b14), "garbled");
  assert.equal(scrollReadOutcome(mk(1, b14), b14), "fumbled");
  assert.equal(scrollReadOutcome(mk(3, b14), b14), "fumbled");

  const b13 = scrollReadBands(13);
  assert.equal(scrollReadOutcome(mk(5, b13), b13), "garbled");
  assert.equal(scrollReadOutcome(mk(4, b13), b13), "fumbled");
});

// --- readScroll: the refusal edges (unchanged by this plan) ----------------

test("readScroll: no scrolls refuses, zero draws, nothing consumed", () => {
  const state = fixedState({ c: { scrolls: 0 } });
  const events = readScroll(state, fakeRng([]), []);
  assert.deepEqual(events, [{ type: "scrollRefused", reason: "noScrolls" }]);
  assert.equal(state.c.scrolls, 0);
});

test("readScroll: a pending fight refuses before anything else, zero draws, nothing consumed", () => {
  const state = fixedState({ c: { scrolls: 1 } });
  state.combat = fixedCombat([fixedFoe()], { pending: true });
  const events = readScroll(state, fakeRng([]), []);
  assert.deepEqual(events, [{ type: "scrollRefused", reason: "notFought" }]);
  assert.equal(state.c.scrolls, 1);
});

// --- readScroll: the magicUser / runes readers -----------------------------

test("readScroll: a Wizard's read carries reader 'magicUser' on scrollRead — the grimoire copy or scrollTooAdvanced, then the free cast, exactly as before this phase", () => {
  const state = fixedState({ c: { cls: "Magic User", sub: "Wizard", intel: 14, level: 5, grimoire: ["Heal"], scrolls: 1, wp: 10, maxWP: 40 } });
  const events = readScroll(state, fakeRng([10], { pick: (arr) => arr.find((sp) => sp.n === "Heal") }), []);
  assert.equal(state.c.scrolls, 0);
  assert.ok(events.some((e) => e.type === "scrollRead" && e.reader === "magicUser"));
  assert.ok(events.some((e) => e.type === "scrollCast"));
  assert.ok(events.some((e) => e.type === "healed"));
  assert.equal(events.some((e) => e.type === "scrollDeciphered" || e.type === "scrollGarbled" || e.type === "scrollFumbled"), false, "a magicUser reader never rolls");
});

test("readScroll: a Runes/Signs Fighter reads automatically — scrollRead then scrollCast, no grimoire copy, no roll", () => {
  const state = fixedState({ c: { cls: "Fighter", sub: "Soldier", skills: { "Runes/Signs": 1 }, intel: 14, scrolls: 1, grimoire: [], wp: 10, maxWP: 40 } });
  const events = readScroll(state, fakeRng([10], { pick: (arr) => arr.find((sp) => sp.n === "Heal") }), []);
  assert.equal(state.c.scrolls, 0);
  assert.ok(events.some((e) => e.type === "scrollRead" && e.reader === "runes"));
  assert.ok(events.some((e) => e.type === "scrollCast"));
  assert.ok(events.some((e) => e.type === "healed"));
  assert.equal(events.some((e) => e.type === "scrollCopiedToGrimoire" || e.type === "scrollTooAdvanced"), false, "no grimoire copy for a non-Magic-User");
  assert.equal(events.some((e) => e.type === "scrollDeciphered" || e.type === "scrollGarbled" || e.type === "scrollFumbled"), false, "a runes reader never rolls");
  assert.deepEqual(state.c.grimoire, [], "the grimoire stays Magic-User-only");
});

// --- readScroll: the intel reader, every forced outcome --------------------

test("readScroll: an intel reader with one scroll (forced 'read') decrypts and casts free", () => {
  const seed = 7;
  const intel = 14;
  const { acts, roll, atLeast, dieN } = forceOutcome(seed, intel, "read");
  const state = fixedState({ acts, c: { cls: "Fighter", sub: "Soldier", skills: {}, intel, scrolls: 1, grimoire: [] } });
  const events = readScroll(state, makeRng(seed), []);
  assert.equal(state.c.scrolls, 0);
  assert.ok(events.some((e) => e.type === "scrollRead" && e.reader === "intel"));
  const deciphered = events.find((e) => e.type === "scrollDeciphered");
  assert.ok(deciphered, "expected a scrollDeciphered event");
  assert.equal(deciphered.roll, roll);
  assert.equal(deciphered.atLeast, atLeast);
  assert.equal(deciphered.dieN, dieN);
  assert.equal(deciphered.intel, intel);
  assert.ok(events.some((e) => e.type === "scrollCast"), "the spell's own events follow");
  assert.equal(events.some((e) => e.type === "scrollGarbled" || e.type === "scrollFumbled"), false);
});

test("readScroll: a forced garble outside combat crumbles the scroll and casts nothing; no afterPlayerAction", () => {
  const seed = 11;
  const intel = 14;
  const { acts, roll, fumbleAtLeast } = forceOutcome(seed, intel, "garbled");
  const state = fixedState({ acts, c: { cls: "Fighter", sub: "Soldier", skills: {}, intel, scrolls: 1 } });
  const events = readScroll(state, makeRng(seed), []);
  assert.equal(state.c.scrolls, 0);
  const garbled = events.find((e) => e.type === "scrollGarbled");
  assert.ok(garbled);
  assert.equal(garbled.roll, roll);
  assert.equal(garbled.fumbleAtLeast, fumbleAtLeast);
  assert.equal(events.some((e) => e.type === "scrollCast"), false, "nothing casts");
  assert.equal(events.length, 2, "exactly scrollRead + scrollGarbled — no afterPlayerAction outside combat");
});

test("readScroll: a forced garble in combat still spends the reader's turn — the foes act", () => {
  const seed = 11;
  const intel = 14;
  const { acts } = forceOutcome(seed, intel, "garbled");
  const state = fixedState({ acts, c: { cls: "Fighter", sub: "Soldier", skills: {}, intel, scrolls: 1, wp: 999, maxWP: 999 } });
  state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })]);
  const events = readScroll(state, makeRng(seed), []);
  assert.ok(events.some((e) => e.type === "scrollGarbled"));
  assert.equal(events.some((e) => e.type === "scrollCast"), false);
  assert.ok(state.combat && state.combat.round > 1, "the round advanced — afterPlayerAction ran the foes' turn");
});

test("readScroll: a forced fumble outside combat fizzles — no resolver, no state change beyond the scroll count", () => {
  const seed = 5;
  const intel = 14;
  const { acts, roll, fumbleAtLeast } = forceOutcome(seed, intel, "fumbled");
  const state = fixedState({ acts, c: { cls: "Fighter", sub: "Soldier", skills: {}, intel, scrolls: 1, wp: 40, maxWP: 40 } });
  const events = readScroll(state, makeRng(seed), []);
  assert.equal(state.c.scrolls, 0);
  assert.equal(state.c.wp, 40, "no hp lost outside combat");
  const fumbled = events.find((e) => e.type === "scrollFumbled");
  assert.ok(fumbled);
  assert.equal(fumbled.fizzled, true);
  assert.equal(fumbled.roll, roll);
  assert.equal(fumbled.fumbleAtLeast, fumbleAtLeast);
  assert.equal(events.some((e) => e.type.startsWith("fumbleOn")), false, "the resolver never ran outside combat");
  assert.equal(events.length, 2, "exactly scrollRead + scrollFumbled");
});

test("readScroll: a forced fumble in combat hands off to resolveScrollFumble, then the foes act (unless the reader died)", () => {
  const seed = 5;
  const intel = 14;
  const { acts } = forceOutcome(seed, intel, "fumbled");
  const state = fixedState({ acts, c: { cls: "Fighter", sub: "Soldier", skills: {}, intel, scrolls: 1, wp: 999, maxWP: 999 } });
  state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })]);
  const events = readScroll(state, makeRng(seed), []);
  const fumbled = events.find((e) => e.type === "scrollFumbled");
  assert.ok(fumbled);
  assert.equal(fumbled.fizzled, undefined, "fizzled is only additive outside combat");
  assert.ok(events.some((e) => e.type.startsWith("fumbleOn")), "resolveScrollFumble ran");
  assert.ok(state.dead || (state.combat && state.combat.round > 1), "the reader's turn spent — the foes acted, or the reader died");
});

// --- readScroll: a Pilfer reads under exactly this rule ---------------------

test("readScroll: a Pilfer reads under the intelligence rule and never emits pilferFumbled", () => {
  const seed = 9;
  const state = fixedState({ c: { cls: "Thief", sub: "Pilfer", skills: {}, intel: 10, scrolls: 1 } });
  const events = readScroll(state, makeRng(seed), []);
  const read = events.find((e) => e.type === "scrollRead");
  assert.equal(read.reader, "intel");
  assert.equal(events.some((e) => e.type === "pilferFumbled"), false);
  assert.equal(state.c.scrolls, 0);
});

// --- readScroll: the roll sits on the scroll stream, not the main rng ------

test("readScroll: an intel reader's own d20 draws from the scroll stream, not the main rng — a garbled read leaves the main cursor exactly at the spell pick", () => {
  const seed = 3;
  const intel = 14;
  const { acts } = forceOutcome(seed, intel, "garbled");
  const state = fixedState({ acts, c: { cls: "Fighter", sub: "Soldier", skills: {}, intel, scrolls: 1 } });
  const rng = makeRng(seed);
  const events = readScroll(state, rng, []);
  assert.ok(events.some((e) => e.type === "scrollGarbled"));
  const cursorAfterRead = rng.getState();

  const replayRng = makeRng(seed);
  replayRng.pick(OPTIONS_DEPTH1);
  assert.equal(cursorAfterRead, replayRng.getState(), "the main rng advanced by exactly the one spell-pick draw — the intel roll sat entirely on the scroll stream");
});

// --- voice: the garbled/fumbled/deciphered lines (Task 2) -------------------

test("voice: the garbled Oracle and rail lines never contain 'refuse', 'cannot' or the spell's name; the reading range is present", () => {
  const e = { type: "scrollGarbled", spell: "Heal", roll: 5, atLeast: 8, dieN: 20, intel: 14, fumbleAtLeast: 4 };
  const oracle = EVENT_NARRATION.scrollGarbled(e);
  const rail = LINE_FOR.scrollGarbled(e).text;
  for (const text of [oracle, rail]) {
    assert.doesNotMatch(text, /refuse/i);
    assert.doesNotMatch(text, /cannot/i);
    assert.doesNotMatch(text, /\bHeal\b/);
  }
  assert.match(oracle, /8.{1,3}20|8–20/);
});

test("voice: the fumbled line names the spell and the fumble band (both surfaces)", () => {
  const e = { type: "scrollFumbled", spell: "Fireball", roll: 2, atLeast: 8, dieN: 20, intel: 14, fumbleAtLeast: 4 };
  const oracle = EVENT_NARRATION.scrollFumbled(e);
  const rail = LINE_FOR.scrollFumbled(e).text;
  for (const text of [oracle, rail]) {
    assert.match(text, /Fireball/);
  }
  // the fumble band is the faces strictly BELOW fumbleAtLeast (bottomRangeText) — 1-3 for fumbleAtLeast 4.
  assert.match(oracle, /1.{1,3}3|1–3/);
});

test("voice: the deciphered line names the reading range", () => {
  const e = { type: "scrollDeciphered", spell: "Heal", roll: 12, atLeast: 8, dieN: 20, intel: 14 };
  const oracle = EVENT_NARRATION.scrollDeciphered(e);
  assert.match(oracle, /8.{1,3}20|8–20/);
});

test("voice: a bare {type} renders a non-empty string for the three new events on both surfaces", () => {
  for (const type of ["scrollDeciphered", "scrollGarbled", "scrollFumbled"]) {
    assert.ok(EVENT_NARRATION[type]({ type }).length > 0, `EVENT_NARRATION.${type} produced no text from a bare {type}`);
    const line = LINE_FOR[type]({ type });
    const text = line && "text" in line ? line.text : line?.toasts?.[0]?.text;
    assert.ok(text && text.length > 0, `LINE_FOR.${type} produced no text from a bare {type}`);
  }
});

test("readScroll: castSpell is still exported and usable directly (sanity import check)", () => {
  assert.equal(typeof castSpell, "function");
});
