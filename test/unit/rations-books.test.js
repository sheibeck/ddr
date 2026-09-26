// test/unit/rations-books.test.js
//
// RULES-15 (Phase 75, user 2026-09-25, DECLARED CANON DIVERGENCE): a day
// refills the hero's (and every live member's) spell book ONLY inside the
// fed branch of engine/movement.js#newDay, beside the rest heal. An unfed
// day (camping is refused without enough rations, so this only ever
// happens on the automatic 100-square day) refills NOTHING, and says why
// via `wentHungry`'s additive `booksKept` flag when there was a spent book
// to keep empty and the hero survives the hunger. The Magic User's own
// 20-square trickle (engine/movement.js#move) is UNCHANGED by this rule —
// pinned here too, alongside movement.test.js's own pin, as this file's own
// "the trickle is untouched" proof.
//
// Helper functions mirror test/unit/movement.test.js's own fixedFighter/
// fixedState/wallGrid/open/fakeRng precedent (an independent copy per that
// file's own convention — no cross-file import of test helpers).

import test from "node:test";
import assert from "node:assert/strict";

import { newDay, move, maxCharges } from "../../engine/movement.js";
import { GW, GH } from "../../engine/maze.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { LINE_FOR } from "../../src/browser/narrationLines.js";
import { setIdentityDials } from "./harness/identityDials.js";

// Phase 54-07: this file pins canon-mechanic numbers (a d10 heal, the
// wander-check face count), not the Phase 54 difficulty fit — run under the
// explicit identity override, mirroring movement.test.js's own top-of-file call.
setIdentityDials();

/** fakeRng(seq) — pops `.d()` values off `seq` in order; throws on underflow
 * (doubles as a "no more draws expected" assertion). `.pick` defaults to
 * `arr[0]`. */
function fakeRng(seq) {
  let i = 0;
  return {
    d(_sides) {
      if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick: (arr) => arr[0],
    shuffle: (a) => a,
  };
}

/** A minimal, fully-open 21x21 grid so `inStone(state)` (the wandering-
 * monster check's stone guard) always reads false. */
function openGrid() {
  const g = [];
  for (let y = 0; y < GH; y++) {
    g.push([]);
    for (let x = 0; x < GW; x++) g[y].push({ wall: false, seen: false, feat: null });
  }
  return g;
}

function fixedMagicUser(overrides = {}) {
  return {
    cls: "Magic User", sub: "Wizard", race: "Human", level: 1, sp: 0,
    maxWP: 30, wp: 30, skills: {}, vp: 0,
    weapon: "Fists", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 1, rations: 6, gold: 50, scrolls: 0,
    affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Mage",
    darkFor: 0,
    ...overrides,
  };
}

/** fixedState(overrides) — `overrides.c` merges onto fixedMagicUser();
 * `overrides.party` (an array of plain member sheets) is a top-level sibling. */
function fixedState(overrides = {}) {
  const { c: cOverrides, party, ...rest } = overrides;
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedMagicUser(cOverrides),
    floor: { g: openGrid(), px: 5, py: 5, depth: 1 },
    day: 1, steps: 0, combat: null, store: null, beats: null,
    dead: false, deathNote: "", epitaph: "",
    party: party ?? [],
    ...rest,
  };
}

/** A member sheet minimal enough for newDay's upkeep/refill loop — mirrors
 * a Magic User Joiner's shape (has its own `spellsUsed`). */
function fixedMember(overrides = {}) {
  return { name: "Grix", race: "Human", cls: "Magic User", sub: "Wizard", spellsUsed: 0, ...overrides };
}

// heal d10=5, then 8 quiet wander checks (all >= wakeOn(1)+1 = 2, so no hit) —
// the "fed, nothing wanders" sequence every fed-branch test below reuses.
const FED_QUIET_SEQ = [5, 2, 2, 2, 2, 2, 2, 2, 2];
// 8 quiet wander checks only — the unfed branch never draws the heal d10.
const UNFED_QUIET_SEQ = [2, 2, 2, 2, 2, 2, 2, 2];

// --- fed branch: refill ----------------------------------------------------

test("newDay (fed): a Magic User with 3 spent charges wakes with 0 spent; rationsEaten carries refilled: true", () => {
  const state = fixedState({ c: { spellsUsed: 3 } });
  const events = newDay(state, false, fakeRng(FED_QUIET_SEQ), []);
  assert.equal(state.c.spellsUsed, 0);
  const ra = events.find((e) => e.type === "rationsEaten");
  assert.ok(ra);
  assert.equal(ra.refilled, true);
});

test("newDay (fed): a Magic User with 0 spent charges gets no refilled key on rationsEaten", () => {
  const state = fixedState({ c: { spellsUsed: 0 } });
  const events = newDay(state, false, fakeRng(FED_QUIET_SEQ), []);
  assert.equal(state.c.spellsUsed, 0);
  const ra = events.find((e) => e.type === "rationsEaten");
  assert.ok(ra);
  assert.equal("refilled" in ra, false);
});

// --- unfed branch: no refill, and it says why ------------------------------

test("newDay (unfed): a Magic User with 3 spent charges keeps them; wentHungry carries booksKept: true", () => {
  const state = fixedState({ c: { spellsUsed: 3, rations: 0, wp: 30 } }); // Human upkeep cost is 4, survives
  const events = newDay(state, false, fakeRng(UNFED_QUIET_SEQ), []);
  assert.equal(state.c.spellsUsed, 3, "the unfed branch never refills");
  const wh = events.find((e) => e.type === "wentHungry");
  assert.ok(wh);
  assert.equal(wh.booksKept, true);
  assert.equal(state.dead, false);
});

test("newDay (unfed): a Magic User with 0 spent charges gets no booksKept key on wentHungry", () => {
  const state = fixedState({ c: { spellsUsed: 0, rations: 0, wp: 30 } });
  const events = newDay(state, false, fakeRng(UNFED_QUIET_SEQ), []);
  assert.equal(state.c.spellsUsed, 0);
  const wh = events.find((e) => e.type === "wentHungry");
  assert.ok(wh);
  assert.equal("booksKept" in wh, false);
});

// --- party: a member's own book follows the same fed/unfed rule -----------

test("newDay (fed, party): a member with 2 spent charges refills on a fed day", () => {
  const state = fixedState({ c: { spellsUsed: 1 }, party: [fixedMember({ spellsUsed: 2 })] });
  newDay(state, false, fakeRng(FED_QUIET_SEQ), []);
  assert.equal(state.c.spellsUsed, 0);
  assert.equal(state.party[0].spellsUsed, 0);
});

test("newDay (unfed, party): an unfed day keeps both the hero's and the member's book exactly as spent", () => {
  const state = fixedState({ c: { spellsUsed: 1, rations: 0, wp: 30 }, party: [fixedMember({ spellsUsed: 2 })] });
  const events = newDay(state, false, fakeRng(UNFED_QUIET_SEQ), []);
  assert.equal(state.c.spellsUsed, 1);
  assert.equal(state.party[0].spellsUsed, 2);
  const wh = events.find((e) => e.type === "wentHungry");
  assert.equal(wh.booksKept, true, "the member's own spent book still counts toward anyBookSpent");
});

test("newDay (unfed, party): a Fighter/Thief member with no spellsUsed field never gains one", () => {
  const member = { name: "Bram", race: "Human", cls: "Fighter", sub: "Soldier" };
  const state = fixedState({ c: { spellsUsed: 0, rations: 0, wp: 30 }, party: [member] });
  newDay(state, false, fakeRng(UNFED_QUIET_SEQ), []);
  assert.equal("spellsUsed" in state.party[0], false);
});

// --- adjacency: exactly enough rations is fed; one short is not -----------

test("newDay: rations exactly equal to nightlyEats count as fed and refill every book", () => {
  const state = fixedState({ c: { spellsUsed: 2, rations: 1 } }); // solo hero eats 1/night (Human)
  const events = newDay(state, false, fakeRng(FED_QUIET_SEQ), []);
  assert.equal(state.c.spellsUsed, 0);
  assert.ok(events.some((e) => e.type === "rationsEaten"));
});

test("newDay: one ration short of nightlyEats refills none", () => {
  const state = fixedState({ c: { spellsUsed: 2, rations: 0, wp: 30 } }); // needs 1, has 0
  const events = newDay(state, false, fakeRng(UNFED_QUIET_SEQ), []);
  assert.equal(state.c.spellsUsed, 2);
  assert.ok(events.some((e) => e.type === "wentHungry"));
});

// --- empty: no spent charges, no book line at all --------------------------

test("newDay (unfed, no caster): a party with no casters and no spent charges prints no book line at all", () => {
  const state = fixedState({ c: { cls: "Fighter", sub: "Soldier", spellsUsed: undefined, rations: 0, wp: 30 } });
  const events = newDay(state, false, fakeRng(UNFED_QUIET_SEQ), []);
  const wh = events.find((e) => e.type === "wentHungry");
  assert.ok(wh);
  assert.equal("booksKept" in wh, false);
});

// --- ordering: a hero who starves to death gets no book line --------------

test("newDay: a hero who starves to death this same tick gets no booksKept line — the die event follows", () => {
  const state = fixedState({ c: { spellsUsed: 3, rations: 0, wp: 1 } }); // Human upkeep 4 > wp 1
  const events = newDay(state, false, fakeRng([]), []); // dies before any wander draw
  assert.equal(state.dead, true);
  const wh = events.find((e) => e.type === "wentHungry");
  assert.ok(wh);
  assert.equal("booksKept" in wh, false, "no book line survives a fatal night");
  const died = events.find((e) => e.type === "died");
  assert.ok(died, "the die event follows wentHungry");
  assert.equal(state.c.spellsUsed, 3, "the book was never touched either way");
});

// --- the 20-square trickle is untouched by this rule -----------------------

test("move: the Magic User 20-square trickle still returns one charge every 20 squares, unrelated to fed/unfed", () => {
  const state = fixedState({ c: { spellsUsed: 1 }, floor: { g: openGrid(), px: 5, py: 5, depth: 1 } });
  state.steps = 19;
  const events = move(state, "N", fakeRng([]), []);
  assert.equal(state.steps, 20);
  assert.equal(state.c.spellsUsed, 0);
  assert.equal(maxCharges(state.c), 2 * 1 + 2 + 0);
  assert.ok(events.some((e) => e.type === "spellChargeRecovered"));
});

// --- narration --------------------------------------------------------------

test("EVENT_NARRATION.wentHungry adds the booksKept clause only when the flag is set", () => {
  const withFlag = EVENT_NARRATION.wentHungry({ cost: 4, need: 1, have: 0, mouths: 1, booksKept: true });
  const withoutFlag = EVENT_NARRATION.wentHungry({ cost: 4, need: 1, have: 0, mouths: 1 });
  assert.match(withFlag, /Your book stays empty/);
  assert.doesNotMatch(withoutFlag, /Your book stays empty/);
});

test("LINE_FOR.wentHungry adds a book-stays-empty rail line only when booksKept is set", () => {
  const withFlag = LINE_FOR.wentHungry({ cost: 4, booksKept: true });
  const withoutFlag = LINE_FOR.wentHungry({ cost: 4 });
  assert.match(withFlag.text, /Book stays empty/);
  assert.doesNotMatch(withoutFlag.text, /Book stays empty/);
});
