// test/unit/book-refill-lines.test.js
//
// Phase 78, Plan 05 — two CONTEXT decisions from the user's 2026-09-25
// device reports:
//
//   1. "we're no longer getting a rail update when a spell charge is
//      regained" — `spellChargeRecovered` leaves ORACLE_ONLY and gets a
//      LINE_FOR rail line with the count (have/max). A minor event: a rail
//      line, never a decision card.
//   2. "I had 1 charge left ... then when combat started I had 12 charges" —
//      not an engine bug: a fed new day refills the book (Phase 75 RULES-15)
//      and nothing on screen said so. The fed day's `rationsEaten` line now
//      names the refill with the count ("A new day. Your book is full again
//      (12/12)."), and each party member whose book refilled. That line sits
//      before any wandering monster in the same step's events, so a fight
//      the same step brings shows it in THE FIGHT SO FAR's lead-in.
//
// Agreement with RULES-15: the refill is named ONLY when the engine's own
// `rationsEaten.refilled` is set AND a sheet's spent charges actually went to
// zero. An unfed day keeps wentHungry's "Book stays empty." and never claims
// a refill; a fed day with no spent book says nothing about books.
//
// Presentation only: the counts come from the pure stamp
// eventNarration.js#stampBookRefill(events, before, after, maxOf), applied in
// engineAdapter.js#dispatch after stampScrollCopyNotes. Every case below runs
// the REAL engine (newRun + applyAction), never hand-built events, except the
// stamp's own purity pins.

import test from "node:test";
import assert from "node:assert/strict";

import { newRun } from "../../engine/state.js";
import { applyAction } from "../../engine/engine.js";
import { maxCharges } from "../../engine/movement.js";
import { stampBookRefill, narrateEvent } from "../../src/browser/eventNarration.js";
import { linesForAction, narrativeLineText, ORACLE_ONLY, LINE_FOR } from "../../src/browser/narrationLines.js";
import { railCardFor } from "../../src/browser/rail.js";
import { fightLogLinesFor } from "../../src/browser/fightLog.js";

const DIRV = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };

/** firstOpenPlainDir(state) — an open, feature-free neighbour of the hero. */
function firstOpenPlainDir(state) {
  const f = state.floor;
  for (const [d, [dx, dy]] of Object.entries(DIRV)) {
    const cell = f.g[f.py + dy]?.[f.px + dx];
    if (cell && !cell.wall && !cell.feat && !cell.water) return d;
  }
  return null;
}

/**
 * dayEdgeRun(seed, opts) — a real run one square short of the 100-square day,
 * with the hero forced to `cls`, at `level`, `spent` charges used and
 * `rations` in the pack. Returns null when the start tile has no plain exit.
 */
function dayEdgeRun(seed, { cls = "Magic User", level = 5, spent = 0, rations = 10 } = {}) {
  const s = newRun(seed, [], { force: { cls } });
  s.c.level = level;
  s.c.wp = s.c.maxWP;
  if (cls === "Magic User") s.c.spellsUsed = spent;
  s.c.rations = rations;
  s.steps = 99;
  const dir = firstOpenPlainDir(s);
  return dir ? { s, dir } : null;
}

/** memberSheet(seed, name, spent) — a real rolled Magic User sheet as a party member. */
function memberSheet(seed, name, spent) {
  const m = newRun(seed, [], { force: { cls: "Magic User" } }).c;
  m.name = name;
  m.spellsUsed = spent;
  return m;
}

/** step(before, dir) — the real engine move, then the adapter's stamp. */
function step(before, dir) {
  const { state, events } = applyAction(before, { type: "move", dir });
  return { state, events, stamped: stampBookRefill(events, before, state, maxCharges) };
}

/** railLines(events) — the rail card's lines for a move, exactly as the shell builds them. */
function railLines(events) {
  const ctx = { narrate: narrateEvent };
  const folded = linesForAction("move", events, ctx, { limit: Infinity, withIdx: true });
  const card = railCardFor("move", events, folded, ctx);
  return card ? card.lines.map((l) => l.text) : [];
}

/** firstRun(pred, opts) — the first seed whose day-edge run exists and whose step satisfies pred. */
function firstRun(pred, opts, extra = () => {}) {
  for (let seed = 1; seed <= 400; seed++) {
    const run = dayEdgeRun(seed, opts);
    if (!run) continue;
    extra(run.s, seed);
    const out = step(run.s, run.dir);
    if (pred(out)) return { ...run, ...out, seed };
  }
  return null;
}

const quietFedDay = ({ events }) =>
  events.some((e) => e.type === "rationsEaten") && !events.some((e) => e.type === "wanderingMonster" || e.type === "died");

// ─── the stamp itself ────────────────────────────────────────────────────

test("stampBookRefill: non-array input gives []; the input array and its events are never mutated", () => {
  assert.deepEqual(stampBookRefill(undefined, {}, {}), []);
  assert.deepEqual(stampBookRefill(null, {}, {}), []);
  const ev = { type: "rationsEaten", eats: 1, left: 3, eaters: [], refilled: true };
  const other = { type: "dayBegan", day: 2 };
  const input = [other, ev];
  const before = { c: { name: "Ada", cls: "Magic User", level: 5, spellsUsed: 4 }, party: [] };
  const after = { c: { name: "Ada", cls: "Magic User", level: 5, spellsUsed: 0 }, party: [] };
  const out = stampBookRefill(input, before, after, () => 12);
  assert.notEqual(out, input, "a new array");
  assert.equal(out[0], other, "every other element is the same object");
  assert.notEqual(out[1], ev);
  assert.equal("books" in ev, false, "the engine's event is untouched");
  assert.deepEqual(out[1].books, [{ who: "you", name: "Ada", have: 12, max: 12 }]);
});

test("stampBookRefill: no `refilled` flag, or no sheet whose spent charges reached zero, means no `books`", () => {
  const before = { c: { name: "Ada", spellsUsed: 4 }, party: [] };
  const after = { c: { name: "Ada", spellsUsed: 0 }, party: [] };
  const noFlag = [{ type: "rationsEaten", eats: 1, left: 3, eaters: [] }];
  assert.equal(stampBookRefill(noFlag, before, after, () => 12)[0], noFlag[0], "no flag: the same object");
  const stillSpent = [{ type: "rationsEaten", eats: 1, left: 3, eaters: [], refilled: true }];
  const out = stampBookRefill(stillSpent, before, { c: { name: "Ada", spellsUsed: 2 }, party: [] }, () => 12);
  assert.equal(out[0], stillSpent[0], "charges that did not reach zero claim nothing");
});

// ─── the fed refill, through the real engine ─────────────────────────────

test("fed day: a Magic User at 11 of 12 spent crosses the day; rail and Oracle both say the book is full again (12/12)", () => {
  const run = firstRun(quietFedDay, { level: 5, spent: 11 });
  assert.ok(run, "a seed with a plain step and a quiet fed day");
  assert.equal(maxCharges(run.s.c), 12, "level 5 with no item bonus is a 12-charge book");
  assert.equal(run.state.c.spellsUsed, 0, "the engine refilled the book");
  const ra = run.stamped.find((e) => e.type === "rationsEaten");
  assert.equal(ra.refilled, true);
  assert.deepEqual(ra.books, [{ who: "you", name: run.s.c.name, have: 12, max: 12 }]);

  const oracle = narrativeLineText(narrateEvent(ra));
  assert.match(oracle, /A new day\. Your book is full again \(12\/12\)\./);
  assert.match(oracle, /Rations:/, "the rations clause is kept");

  const table = LINE_FOR.rationsEaten(ra).text;
  assert.match(table, /^A new day\. Your book is full again \(12\/12\)\. Rations: −\d+ \(\d+ left\)\.$/);

  const rail = railLines(run.stamped);
  assert.ok(rail.some((t) => /Your book is full again \(12\/12\)/.test(t)), `the rail names the refill: ${JSON.stringify(rail)}`);
});

test("unfed day: the same spent Magic User with no rations gets no refill claim; the hunger line keeps 'Book stays empty.'", () => {
  const run = firstRun(
    ({ events }) => events.some((e) => e.type === "wentHungry") && !events.some((e) => e.type === "wanderingMonster" || e.type === "died"),
    { level: 5, spent: 11, rations: 0 },
  );
  assert.ok(run, "a seed with a plain step and a quiet unfed day");
  assert.ok(run.state.c.spellsUsed > 0, "the engine left the book spent");
  assert.equal(run.stamped.some((e) => e.type === "rationsEaten"), false);
  const hungry = run.stamped.find((e) => e.type === "wentHungry");
  assert.equal(hungry.booksKept, true);
  assert.match(LINE_FOR.wentHungry(hungry).text, /Book stays empty\./);
  const all = [...railLines(run.stamped), ...run.stamped.map((e) => narrativeLineText(narrateEvent(e)))].join(" | ");
  assert.doesNotMatch(all, /full again/, "no refill claimed on an unfed day");
  assert.match(all, /Your book stays empty/);
});

test("member only: a Fighter hero with a spent Magic User member names the member's book and count, not the hero's", () => {
  let member;
  const run = firstRun(quietFedDay, { cls: "Fighter", level: 3 }, (s, seed) => {
    member = memberSheet(seed + 1000, "Mira", 3);
    s.party = [member];
  });
  assert.ok(run, "a seed with a plain step and a quiet fed day");
  const max = maxCharges(member);
  assert.equal(run.state.party[0].spellsUsed, 0, "the engine refilled the member's book");
  const ra = run.stamped.find((e) => e.type === "rationsEaten");
  assert.deepEqual(ra.books, [{ who: 0, name: "Mira", have: max, max }]);
  const table = LINE_FOR.rationsEaten(ra).text;
  assert.match(table, new RegExp(`^A new day\\. Mira's book is full again \\(${max}/${max}\\)\\. Rations:`));
  assert.doesNotMatch(table, /Your book/);
  const oracle = narrativeLineText(narrateEvent(ra));
  assert.match(oracle, new RegExp(`Mira's book is full again \\(${max}/${max}\\)`));
  assert.doesNotMatch(oracle, /Your book/);
});

test("hero and member both spent: the hero's book comes first, then the member's", () => {
  let member;
  const run = firstRun(quietFedDay, { level: 5, spent: 2 }, (s, seed) => {
    member = memberSheet(seed + 2000, "Mira", 1);
    s.party = [member];
  });
  assert.ok(run);
  const max = maxCharges(member);
  const table = LINE_FOR.rationsEaten(run.stamped.find((e) => e.type === "rationsEaten")).text;
  assert.match(table, new RegExp(`^A new day\\. Your book is full again \\(12/12\\)\\. Mira's book is full again \\(${max}/${max}\\)\\. Rations:`));
});

test("full book: a Magic User whose book was already full on a fed day gets no book clause", () => {
  const run = firstRun(quietFedDay, { level: 5, spent: 0 });
  assert.ok(run);
  const ra = run.stamped.find((e) => e.type === "rationsEaten");
  assert.equal("refilled" in ra, false);
  assert.equal("books" in ra, false);
  assert.doesNotMatch(LINE_FOR.rationsEaten(ra).text, /book/i);
  assert.doesNotMatch(narrativeLineText(narrateEvent(ra)), /book/i);
});

// ─── the 20-square trickle ───────────────────────────────────────────────

test("trickle: a regained spell charge is no longer ORACLE_ONLY and gets a rail line with have/max", () => {
  assert.equal(ORACLE_ONLY.has("spellChargeRecovered"), false);
  assert.equal(typeof LINE_FOR.spellChargeRecovered, "function");
  let run = null;
  for (let seed = 1; seed <= 400 && !run; seed++) {
    const s = newRun(seed, [], { force: { cls: "Magic User" } });
    s.c.level = 5;
    s.c.spellsUsed = 4;
    s.steps = 19;
    const dir = firstOpenPlainDir(s);
    if (!dir) continue;
    const out = step(s, dir);
    if (out.events.some((e) => e.type === "spellChargeRecovered") && !out.state.combat) run = out;
  }
  assert.ok(run, "a seed whose twentieth square is a plain step");
  const e = run.stamped.find((x) => x.type === "spellChargeRecovered");
  assert.equal(e.charges, 9);
  assert.equal(e.max, 12);
  const line = LINE_FOR.spellChargeRecovered(e);
  assert.match(line.text, /\(9\/12\)/);
  assert.equal(line.tone, "magic");
  const rail = railLines(run.stamped);
  assert.ok(rail.some((t) => /spell charge/i.test(t) && /\(9\/12\)/.test(t)), `the rail reports the charge: ${JSON.stringify(rail)}`);
});

// ─── the same-step wanderer ──────────────────────────────────────────────

test("same-step wanderer: THE FIGHT SO FAR shows the refill line before the wandering monster's lines", () => {
  const run = firstRun(
    ({ events, state }) => events.some((e) => e.type === "rationsEaten" && e.refilled) && events.some((e) => e.type === "wanderingMonster") && !!state.combat,
    { level: 5, spent: 11 },
  );
  assert.ok(run, "a seed whose fed refill day brings a wandering monster the same step");
  const lines = fightLogLinesFor("move", run.stamped, { narrate: narrateEvent }).map((l) => l.text);
  const refill = lines.findIndex((t) => /Your book is full again \(12\/12\)/.test(t));
  const wander = lines.findIndex((t) => /Something in the dark|Camp disturbed/.test(t));
  assert.ok(refill >= 0, `the lead-in names the refill: ${JSON.stringify(lines)}`);
  assert.ok(wander > refill, `the refill comes before the wanderer: ${JSON.stringify(lines)}`);
});
