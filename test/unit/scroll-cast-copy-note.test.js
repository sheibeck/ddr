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
import { EVENT_NARRATION, stampScrollCopyNotes } from "../../src/browser/eventNarration.js";
import { boot, dispatch, formatEvents } from "../../src/browser/engineAdapter.js";
import { flush as flushStorage } from "../../src/browser/storage.js";
import { serializeRun } from "../../engine/saveState.js";

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

// ─── Task 2: the ORACLE tab, and every reader path ──────────────────────────

const SAVE_KEY = "ddr.delve.v1";

/** withFakeLocalStorage(fn) — engineAdapter.test.js's in-memory storage stub. */
async function withFakeLocalStorage(fn) {
  const store = new Map();
  const previous = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  try {
    return await fn(globalThis.localStorage);
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
}

/**
 * oracleRead(before) — boots the real adapter on `before` (saved, then
 * loaded through boot()'s own path) and dispatches the read, exactly as the
 * shell does. Returns { events, html } from engineAdapter.dispatch.
 */
async function oracleRead(before) {
  return withFakeLocalStorage(async (store) => {
    store.setItem(SAVE_KEY, JSON.stringify(serializeRun(before)));
    await boot(1);
    const { events, html } = dispatch({ type: "readScroll" });
    await flushStorage();
    return { events, html };
  });
}

const plain = (html) => html.map((h) => h.replace(/<[^>]+>/g, ""));

test("stampScrollCopyNotes: marks the note castFollows and gives its cast the note's data; every other element is the same object; the input is untouched", () => {
  const read = { type: "scrollRead", spell: "Fireball", reader: "magicUser" };
  const note = { type: "scrollTooAdvanced", spell: "Fireball", need: 3, have: 1, school: "offense" };
  const cast = { type: "scrollCast", spell: "Fireball" };
  const hit = { type: "spellHit", target: "Ned", dmg: 9 };
  const input = [read, note, cast, hit];
  const snapshot = structuredClone(input);
  const out = stampScrollCopyNotes(input);
  assert.notEqual(out, input, "a new array");
  assert.deepEqual(input, snapshot, "the input is never mutated");
  assert.equal(out[0], read);
  assert.equal(out[3], hit);
  assert.deepEqual(out[1], { ...note, castFollows: true });
  assert.deepEqual(out[2], { ...cast, tooAdvanced: { need: 3, have: 1 } });
  assert.deepEqual(stampScrollCopyNotes([]), []);
  assert.deepEqual(stampScrollCopyNotes(null), []);
  assert.deepEqual(stampScrollCopyNotes(undefined), []);
});

test("stampScrollCopyNotes: a note not DIRECTLY followed by its own spell's cast is left alone", () => {
  const note = { type: "scrollTooAdvanced", spell: "Fireball", need: 3, have: 1 };
  const other = { type: "scrollCast", spell: "Heal" };
  const out1 = stampScrollCopyNotes([note, other]);
  assert.equal(out1[0], note);
  assert.equal(out1[1], other);
  const potion = { type: "potionDrunk", amount: 4, remaining: 1 };
  const cast = { type: "scrollCast", spell: "Fireball" };
  const out2 = stampScrollCopyNotes([note, potion, cast]);
  assert.equal(out2[0], note);
  assert.equal(out2[2], cast);
  assert.equal(stampScrollCopyNotes([note])[0], note, "a trailing note has no cast to follow");
});

test("EVENT_NARRATION (CMBUI-11): a castFollows note prints nothing; a standalone note is a plain copy note; a stamped cast reads the cast, then the note", () => {
  assert.equal(EVENT_NARRATION.scrollTooAdvanced({ type: "scrollTooAdvanced", spell: "Fireball", need: 3, have: 1, castFollows: true }), "");
  assert.equal(formatEvents([{ type: "scrollTooAdvanced", spell: "Fireball", castFollows: true }]).length, 0, "formatEvent drops the empty line");
  const standalone = EVENT_NARRATION.scrollTooAdvanced({ type: "scrollTooAdvanced", spell: "Fireball", need: 3, have: 1 });
  assert.ok(standalone.toLowerCase().includes(NOTE));
  assertNoRefusal([standalone], "standalone Oracle note");
  const bare = EVENT_NARRATION.scrollTooAdvanced({ type: "scrollTooAdvanced" });
  assert.ok(bare.trim().length > 0);
  assertNoRefusal([bare], "bare Oracle note");
  assert.equal(EVENT_NARRATION.scrollCast({ type: "scrollCast", spell: "Fireball" }), "The scroll casts itself: Fireball.", "an unstamped cast keeps today's line");
  const stamped = EVENT_NARRATION.scrollCast({ type: "scrollCast", spell: "Fireball", tooAdvanced: { need: 3, have: 1 } });
  const text = stamped.replace(/<[^>]+>/g, "");
  assert.ok(text.startsWith("The scroll casts itself: Fireball."), text);
  assert.ok(text.toLowerCase().indexOf(NOTE) > text.indexOf("Fireball"), "the note comes after the cast");
  assertNoRefusal([text], "stamped Oracle cast");
});

test("CMBUI-11: through engineAdapter.dispatch, a Wizard's too-advanced read in a fight reads on the ORACLE tab as the unroll, then ONE cast line ending in the note", async () => {
  const { before } = readerRun(WIZARD, hasTooAdvanced);
  const { events, html } = await oracleRead(before);
  const note = events.find((e) => e.type === "scrollTooAdvanced");
  assert.ok(note, "the probe still rolls a too-advanced spell through boot()");
  assert.equal(note.castFollows, true, "the returned events carry the stamp");
  const cast = events[events.indexOf(note) + 1];
  assert.deepEqual(cast.tooAdvanced, { need: note.need, have: note.have });
  const lines = plain(html);
  assertNoRefusal(lines, "Oracle html");
  const readAt = lines.findIndex((l) => l.startsWith("You unroll a scroll"));
  const withNote = lines.filter((l) => l.toLowerCase().includes(NOTE));
  assert.equal(withNote.length, 1, "the copy note is said once");
  const castAt = lines.indexOf(withNote[0]);
  assert.ok(withNote[0].startsWith(`The scroll casts itself: ${note.spell}.`), withNote[0]);
  assert.ok(readAt !== -1 && readAt < castAt, "the unroll line comes first");
  assert.equal(castAt, readAt + 1, "nothing between the unroll and the cast");
  // The fight log and the priority fold read the same stamped events.
  assertCastThenNote(fightLogLinesFor("readScroll", events), note.spell, "fight log (stamped)");
  assertCastThenNote(linesForAction("readScroll", events, {}, { limit: Infinity }), note.spell, "priority fold (stamped)");
});

// The coherence matrix: reader path x surface (Oracle html, fight log in the
// event order, the rail's priority fold). A read that casts shows the cast
// and no refusal wording anywhere.
const CAST_PATHS = [
  ["a Magic User (too advanced)", WIZARD, hasTooAdvanced],
  ["a Runes/Signs Fighter", RUNES_FIGHTER, (ev) => types(ev).includes("scrollCast")],
  ["an intelligence reader who reads it", INTEL_FIGHTER, (ev) => types(ev).includes("scrollDeciphered") && types(ev).includes("scrollCast")],
];

for (const [label, over, accept] of CAST_PATHS) {
  test(`CMBUI-11 coherence: ${label}: the cast shows on the Oracle, the fight log and the rail fold, with no refusal wording`, async () => {
    const { before } = readerRun(over, accept);
    const { events, html } = await oracleRead(before);
    assert.ok(accept(events), "the probe's path survives boot()");
    const spell = events.find((e) => e.type === "scrollCast").spell;
    const oracle = plain(html);
    const log = fightLogLinesFor("readScroll", events);
    const rail = linesForAction("readScroll", events, {}, { limit: Infinity });
    for (const [where, texts] of [
      ["Oracle", oracle],
      ["fight log", log.map((l) => l.text)],
      ["fight log roll", log.map((l) => l.roll ?? "")],
      ["rail fold", rail.map((l) => l.text)],
    ]) {
      assertNoRefusal(texts, `${label} / ${where}`);
    }
    assert.ok(oracle.some((l) => l.startsWith(`The scroll casts itself: ${spell}.`)), "Oracle: the cast");
    assert.ok(log.some((l) => l.text.startsWith(`The scroll casts: ${spell}.`)), "fight log: the cast");
    assert.ok(rail.some((l) => l.text.startsWith(`The scroll casts: ${spell}.`)), "rail fold: the cast");
  });
}

for (const [label, want, lead] of [
  ["a garbled read", "scrollGarbled", "You squint at runes you can't make out"],
  ["a fumbled read", "scrollFumbled", "You read "],
]) {
  test(`CMBUI-11 coherence: ${label} keeps Phase 75.1's own lines (the stamp passes it through untouched)`, async () => {
    const { before, events: raw } = readerRun(INTEL_FIGHTER, (ev) => types(ev).includes(want));
    const { events, html } = await oracleRead(before);
    assert.deepEqual(events, raw, "the stamp leaves a garbled/fumbled read's events as the engine made them");
    assert.deepEqual(html, formatEvents(raw));
    const e = events.find((x) => x.type === want);
    assert.ok(html.includes(EVENT_NARRATION[want](e)));
    assert.ok(plain([EVENT_NARRATION[want](e)])[0].startsWith(lead));
    assert.ok(LINE_FOR[want](e).text.startsWith(lead));
    assert.equal(events.some((x) => x.type === "scrollCast"), false);
  });
}
