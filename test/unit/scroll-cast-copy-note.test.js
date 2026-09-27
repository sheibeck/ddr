// test/unit/scroll-cast-copy-note.test.js
//
// CMBUI-11 (Phase 77, Plan 05) — a scroll read that casts its spell never
// narrates a refusal. The user's 2026-09-21 device report: "I used a scroll
// in combat and I got a message saying it was a level 3 spell so I couldn't
// use it, but it actually successfully used the scroll." CONTEXT: "At most,
// AFTER the cast, it says 'too advanced to copy into your book'."
//
// The engine is untouched (presentation only): engine/magic.js#readScroll
// still pushes scrollTooAdvanced BEFORE scrollCast for a Magic User whose
// scroll spell is not yet scribable. Every surface reorders that into ONE
// reading — the cast, then the copy note:
//   - the fold (narrationLines.js, both orders): the scroll copy chain;
//   - the ORACLE tab (engineAdapter.js#dispatch html): the
//     eventNarration.js#stampScrollCopyNotes presentation stamp;
//   - the fight log / round strip / beats (event order) and the
//     out-of-combat rail card (priority order): the same chain.
//
// Every scenario is driven through the REAL engine (engine/engine.js
// #applyAction) with a real makeRng stream, searching run seeds (bounded)
// until the wanted reader path lands — the rng is never mocked.

import test from "node:test";
import assert from "node:assert/strict";

import { newRun, applyAction } from "../../engine/engine.js";
import { startCombat } from "../../engine/combat.js";
import { makeRng } from "../../engine/rng.js";
import { linesForAction, LINE_FOR, PRIORITY } from "../../src/browser/narrationLines.js";
import { fightLogLinesFor } from "../../src/browser/fightLog.js";
import { railCardFor, railFamilyFor } from "../../src/browser/rail.js";

const NOTE = "too advanced to copy into your book";
// The pinned refusal phrase list: none may appear on any surface for a scroll
// that cast.
const REFUSAL_PHRASES = ["needs level", "you are ", "stays rolled", "cannot read", "refuse"];

const WIZARD = { cls: "Magic User", sub: "Wizard" };
const RUNES_FIGHTER = { cls: "Fighter", sub: "Soldier", skills: { "Runes/Signs": 1 } };
const INTEL_FIGHTER = { cls: "Fighter", sub: "Soldier", skills: {}, intel: 14 };

/**
 * readerRun(over, accept, opts) — the first run seed (1..maxSeed) whose real
 * readScroll dispatch satisfies `accept(events)`. The hero is a level-1
 * reader built from `over`, with one scroll and a deep hp pool (so a foe
 * swing never ends the probe); depth 4 widens the scroll's spell pick to
 * level-3 spells. `inCombat` starts a fight and joins it (the real "fight"
 * action) before the read. Returns { seed, before, events } where `before`
 * is the state the read was applied to.
 */
function readerRun(over, accept, { inCombat = true, maxSeed = 600 } = {}) {
  for (let seed = 1; seed <= maxSeed; seed++) {
    let s = newRun(seed);
    Object.assign(s.c, { wp: 999, maxWP: 999, scrolls: 1, grimoire: [], level: 1, ...over });
    s.floor.depth = 4;
    if (inCombat) {
      startCombat(s, false, null, makeRng(s.rngState));
      if (!s.combat) continue;
      ({ state: s } = applyAction(s, { type: "fight" }));
      if (!s.combat || s.dead || s.combat.heroOut) continue;
    }
    const { events } = applyAction(s, { type: "readScroll" });
    if (accept(events)) return { seed, before: s, events };
  }
  throw new Error(`readerRun: no seed in 1..${maxSeed} satisfied the probe`);
}

const types = (events) => events.map((e) => e.type);
const hasTooAdvanced = (events) => types(events).includes("scrollTooAdvanced");

function assertNoRefusal(texts, where) {
  for (const t of texts) {
    for (const p of REFUSAL_PHRASES) {
      assert.ok(!String(t).toLowerCase().includes(p), `${where}: "${t}" contains the refusal phrase "${p}"`);
    }
  }
}

/** The one line carrying the copy note: starts with the cast, ends with the note. */
function assertCastThenNote(lines, spell, where) {
  const withNote = lines.filter((l) => l.text.toLowerCase().includes(NOTE));
  assert.equal(withNote.length, 1, `${where}: exactly one line carries the copy note`);
  const line = withNote[0].text;
  assert.ok(line.startsWith(`The scroll casts: ${spell}.`), `${where}: the note's line opens on the cast — got "${line}"`);
  assert.ok(line.toLowerCase().indexOf(spell.toLowerCase()) < line.toLowerCase().indexOf(NOTE), `${where}: the cast comes before the note`);
  return withNote[0];
}

// ─── Task 1: the fold ───────────────────────────────────────────────────────

test("CMBUI-11: the engine still pushes scrollTooAdvanced directly before its scrollCast (the stamp/chain's adjacency premise; engine untouched)", () => {
  const { events } = readerRun(WIZARD, hasTooAdvanced);
  const i = types(events).indexOf("scrollTooAdvanced");
  assert.equal(events[i + 1].type, "scrollCast");
  assert.equal(events[i + 1].spell, events[i].spell);
  assert.equal(events[i - 1].type, "scrollRead");
});

for (const order of ["priority", "event"]) {
  test(`CMBUI-11 (${order} order): a Wizard's too-advanced read in a fight folds to the scrollRead line, then ONE cast-then-note line, then the spell; no refusal wording`, () => {
    const { events } = readerRun(WIZARD, hasTooAdvanced);
    const spell = events.find((e) => e.type === "scrollTooAdvanced").spell;
    const lines = linesForAction("readScroll", events, {}, { limit: Infinity, withIdx: true, order });
    assertNoRefusal(lines.map((l) => l.text), `fold (${order})`);
    const chained = assertCastThenNote(lines, spell, `fold (${order})`);
    assert.equal(chained.tone, "magic");
    assert.equal(chained.priority, PRIORITY.you);
    const tooIdx = types(events).indexOf("scrollTooAdvanced");
    assert.equal(chained.idx, tooIdx, "the merged line takes its earliest event's idx (77-02's contiguity rule)");
    assert.equal(lines.filter((l) => l.text.startsWith("The scroll casts")).length, 1, "the cast is said once");
    if (order === "event") {
      const readPos = lines.findIndex((l) => l.text.startsWith("You unroll"));
      const castPos = lines.indexOf(chained);
      assert.ok(readPos !== -1 && readPos < castPos, "event order: the scrollRead line comes first");
      assert.ok(lines.slice(castPos + 1).every((l) => l.idx > tooIdx + 1), "the spell's own lines follow the cast");
    }
  });
}

test("CMBUI-11: the fight log (event order) reads the cast, then the note, on one row; its roll reveal is never a refusal", () => {
  const { events } = readerRun(WIZARD, hasTooAdvanced);
  const spell = events.find((e) => e.type === "scrollTooAdvanced").spell;
  const log = fightLogLinesFor("readScroll", events);
  assertNoRefusal(log.map((l) => l.text), "fight log");
  assertNoRefusal(log.map((l) => l.roll ?? ""), "fight log roll");
  assertCastThenNote(log, spell, "fight log");
});

for (const order of ["priority", "event"]) {
  test(`CMBUI-11 (${order} order): a scrollTooAdvanced NOT followed by its scrollCast keeps its own reworded line, in place`, () => {
    const events = [
      { type: "scrollRead", spell: "Fireball", reader: "magicUser" },
      { type: "scrollTooAdvanced", spell: "Fireball", need: 3, have: 1, school: "offense" },
      { type: "potionDrunk", amount: 5, remaining: 2 },
      { type: "scrollCast", spell: "Fireball" },
    ];
    const lines = linesForAction("readScroll", events, {}, { limit: Infinity, withIdx: true, order });
    const own = lines.find((l) => l.idx === 1);
    assert.ok(own, "the standalone note keeps its own line");
    assert.equal(own.text, LINE_FOR.scrollTooAdvanced(events[1]).text);
    assert.ok(own.text.toLowerCase().includes(NOTE));
    assert.ok(lines.some((l) => l.text === "The scroll casts: Fireball."), "the separated cast keeps its plain line");
    assertNoRefusal(lines.map((l) => l.text), `split fold (${order})`);
  });

  test(`CMBUI-11 (${order} order): a scrollTooAdvanced followed by a scrollCast of a DIFFERENT spell never merges`, () => {
    const events = [
      { type: "scrollTooAdvanced", spell: "Fireball", need: 3, have: 1 },
      { type: "scrollCast", spell: "Heal" },
    ];
    const lines = linesForAction("readScroll", events, {}, { limit: Infinity, order });
    assert.equal(lines.length, 2);
    assert.ok(lines.some((l) => l.text === "The scroll casts: Heal."));
  });
}

test("CMBUI-11: a silent bookkeeping event between the note and its cast does not split the chain (lineEvent contiguity)", () => {
  const events = [
    { type: "scrollTooAdvanced", spell: "Heal", need: 3, have: 1 },
    { type: "moved" },
    { type: "scrollCast", spell: "Heal" },
  ];
  for (const order of ["priority", "event"]) {
    const lines = linesForAction("readScroll", events, {}, { limit: Infinity, order });
    assert.equal(lines.length, 1, `${order}: one line`);
    assert.equal(lines[0].text, `The scroll casts: Heal. Too advanced to copy into your book.`);
  }
});

test("CMBUI-11: LINE_FOR.scrollTooAdvanced is a plain copy note, never a refusal (bare call and full payload)", () => {
  const bare = LINE_FOR.scrollTooAdvanced({ type: "scrollTooAdvanced" });
  assert.ok(bare.text.trim().length > 0);
  assert.ok(bare.text.toLowerCase().includes(NOTE));
  assertNoRefusal([bare.text], "bare LINE_FOR.scrollTooAdvanced");
  const full = LINE_FOR.scrollTooAdvanced({ type: "scrollTooAdvanced", spell: "Fireball", need: 3, have: 1, school: "offense" });
  assert.equal(full.text, "Fireball: too advanced to copy into your book.");
  assert.equal(full.tone, "magic");
  assert.equal(full.priority, PRIORITY.you);
});

test("CMBUI-11: the rail's scrollTooAdvanced family no longer reads as a refusal", () => {
  const fam = railFamilyFor("scrollTooAdvanced", "magic", PRIORITY.you);
  assert.notEqual(fam.title, "TOO ADVANCED");
  assert.notEqual(fam.tone, "dull");
  assert.equal(fam.title, "NOT FOR THE BOOK");
  assert.equal(fam.tone, "odd");
});

test("CMBUI-11: an out-of-combat too-advanced read's rail card heads on a non-refusal family and says the cast, then the note", () => {
  const { events } = readerRun(WIZARD, (ev) => {
    if (!hasTooAdvanced(ev)) return false;
    // A combat-only spell read out here gets castSpell's own genuine
    // combatOnly refusal after the cast (outside CMBUI-11, see the plan's
    // flagged assumptions) — probe a spell that casts cleanly.
    return linesForAction("readScroll", ev, {}, { limit: Infinity }).every((l) => l.priority !== PRIORITY.block);
  }, { inCombat: false });
  const spell = events.find((e) => e.type === "scrollTooAdvanced").spell;
  const folded = linesForAction("readScroll", events, {}, { limit: Infinity, withIdx: true });
  const card = railCardFor("readScroll", events, folded);
  assert.ok(card, "a rail card is built");
  assert.notEqual(card.title, "TOO ADVANCED");
  assert.notEqual(card.title, "NOTHING DOING");
  assert.notEqual(card.tone, "dull");
  assertNoRefusal(card.lines.map((l) => l.text), "rail card");
  assertNoRefusal(card.lines.map((l) => l.roll ?? ""), "rail card roll");
  assertCastThenNote(card.lines, spell, "rail card");
});
