// Task 2 (TDD) — death, graveyard & epitaph filling (ENG-01, ENG-03).
//
// Proves: epitaphFor is deterministic and fills every token; die() sets
// dead/deathNote/epitaph, returns a JSON-round-trippable RunSummary, and
// writes deathAt only via the injected now(); bury() produces a capped,
// plain graveyard array; the module references no DOM/localStorage and a
// fixed now() makes the whole result deterministic.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { makeRng } from "../../engine/rng.js";
import { die, bury, epitaphFor, epitaphCtx } from "../../engine/death.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

function fixedCharacter(overrides = {}) {
  return {
    name: "Test Delver", race: "Human", sub: "Soldier", cls: "Fighter",
    level: 2, sp: 250.4, gold: 1234, kills: 3, motive: "Money",
    wp: 40, maxWP: 55, ward: null, regen: false, mirror: 0,
    ...overrides,
  };
}

function fixedState(overrides = {}) {
  const { c: cOverrides, ...rest } = overrides;
  return {
    c: fixedCharacter(cOverrides),
    floor: { depth: 3 },
    day: 7,
    steps: 500,
    combat: { foo: "bar" },
    beats: null,
    dead: false,
    deathNote: "",
    epitaph: "",
    ...rest,
  };
}

// --- epitaphFor / epitaphCtx --------------------------------------------

test("epitaphFor is deterministic for a given (cause, ctx, seed) and fills every token", () => {
  const ctx = {
    name: "Test Delver", foe: "goblin", sub: "Soldier", race: "Human",
    floor: 3, day: 7, sp: 250, gold: "1,234", motive: "money", lvl: "II",
  };
  const a = epitaphFor("combat", ctx, makeRng(11));
  const b = epitaphFor("combat", ctx, makeRng(11));
  assert.equal(a, b);
  assert.ok(!/\{(\w+)\}/.test(a), `epitaph should have no unfilled tokens: "${a}"`);
});

test("epitaphFor falls back to the maze bank for an unknown cause", () => {
  const s = epitaphFor("no-such-cause", { name: "X" }, makeRng(1));
  assert.equal(typeof s, "string");
  assert.ok(s.length > 0);
});

test("epitaphCtx builds the token object from state.c/floor/day", () => {
  const state = fixedState();
  const ctx = epitaphCtx(state, "a goblin");
  assert.equal(ctx.name, "Test Delver");
  assert.equal(ctx.foe, "a goblin");
  assert.equal(ctx.floor, 3);
  assert.equal(ctx.day, 7);
  assert.equal(ctx.sp, 250);
  assert.equal(ctx.gold, "1,234");
  assert.equal(ctx.motive, "money");
  assert.equal(ctx.lvl, "II");
});

test("epitaphCtx defaults foe to 'creature' when no detail is given", () => {
  const ctx = epitaphCtx(fixedState(), undefined);
  assert.equal(ctx.foe, "creature");
});

// MD-03 regression: epitaphCtx() must format `gold` with a locale PINNED to
// "en-US", not the JS runtime's default locale/ICU data -- state.epitaph is
// persisted GameState compared byte-for-byte by the round-trip/determinism/
// parity suites, so a bare `toLocaleString()` would make the same seed +
// actions produce a different byte-identical result on a host with a
// different default locale. Spy on Number.prototype.toLocaleString rather
// than relying on this test machine's own locale happening to be en-US.
test("MD-03: epitaphCtx formats gold via toLocaleString('en-US') explicitly, not the runtime default", () => {
  const original = Number.prototype.toLocaleString;
  const calls = [];
  Number.prototype.toLocaleString = function (...args) {
    calls.push(args);
    return original.apply(this, args);
  };
  try {
    epitaphCtx(fixedState(), "a goblin");
  } finally {
    Number.prototype.toLocaleString = original;
  }
  assert.equal(calls.length, 1, "toLocaleString must be called exactly once for gold");
  assert.equal(calls[0][0], "en-US", "the locale argument must be explicitly pinned to en-US");
});

test("MD-03: epitaphCtx's gold formatting is locale-stable regardless of the host's default locale", () => {
  // Large enough to expose thousands-grouping; en-US always groups with
  // commas regardless of what the host runtime's own default locale is.
  const ctx = epitaphCtx(fixedState({ c: { gold: 1234567 } }), "a goblin");
  assert.equal(ctx.gold, "1,234,567");
});

// --- die() ---------------------------------------------------------------

test("die sets dead/deathNote/epitaph and clears combat/wards", () => {
  const state = fixedState({ c: { ward: { pool: 10 }, mirror: 2 } });
  die(state, "combat", "a rat", makeRng(4));
  assert.equal(state.dead, true);
  assert.equal(state.combat, null);
  assert.equal(state.c.wp, 0);
  assert.equal(state.c.ward, null);
  assert.equal(state.c.mirror, 0);
  assert.ok(state.deathNote.includes("rat"));
  assert.ok(state.epitaph.length > 0);
});

test("die writes deathAt only via the injected now(), and only that field is clock-derived", () => {
  const now = () => 999888777;
  const state = fixedState();
  die(state, "trap", null, makeRng(2), [], now);
  assert.equal(state.deathAt, 999888777);

  // Same seed/state/cause/detail/now must produce a byte-identical result.
  const stateA = fixedState();
  const stateB = fixedState();
  const summaryA = die(stateA, "trap", null, makeRng(2), [], now);
  const summaryB = die(stateB, "trap", null, makeRng(2), [], now);
  assert.deepStrictEqual(stateA, stateB);
  assert.deepStrictEqual(summaryA, summaryB);
});

test("die returns a RunSummary that JSON round-trips", () => {
  const state = fixedState();
  const summary = die(state, "starve", null, makeRng(6), [], () => 123);
  const roundTripped = JSON.parse(JSON.stringify(summary));
  assert.deepStrictEqual(roundTripped, summary);
  for (const key of ["name", "race", "sub", "cls", "level", "sp", "floor", "day", "steps", "gold", "kills", "cause", "note", "epitaph", "when"]) {
    assert.ok(key in summary, `RunSummary missing field: ${key}`);
  }
  assert.equal(summary.cause, "starve");
  assert.equal(summary.when, 123);
});

test("die pushes a died event", () => {
  const state = fixedState();
  const events = [];
  die(state, "fall", null, makeRng(1), events, () => 1);
  assert.ok(events.some((e) => e.type === "died" && e.cause === "fall"));
});

test("die captures lastWords from the trailing beat group when present", () => {
  const state = fixedState({
    beats: { groups: [{ lines: ["one", "two", "three", "four", "five"] }] },
  });
  die(state, "combat", "an ooze", makeRng(1));
  assert.deepStrictEqual(state.lastWords, ["two", "three", "four", "five"]);
});

test("die defaults lastWords to an empty array with no beats", () => {
  const state = fixedState({ beats: null });
  die(state, "combat", "an ooze", makeRng(1));
  assert.deepStrictEqual(state.lastWords, []);
});

// --- bury() ----------------------------------------------------------------

test("bury produces a RunSummary with the prototype's fields and caps the graveyard at 60", () => {
  const state = fixedState({ deathNote: "cut down by a rat", epitaph: "Rest in pieces." });
  let graves = [];
  for (let i = 0; i < 65; i++) {
    graves = bury(state, "combat", "a rat", graves, () => i);
  }
  assert.equal(graves.length, 60, "graveyard must stay capped at 60 entries");
  assert.equal(graves[0].when, 64, "the most recent burial is unshifted to the front");
  for (const g of graves) {
    for (const key of ["name", "race", "sub", "cls", "level", "sp", "floor", "day", "steps", "gold", "kills", "cause", "note", "epitaph", "when"]) {
      assert.ok(key in g, `grave entry missing field: ${key}`);
    }
  }
});

test("bury falls back to a plain died note when deathNote is empty", () => {
  const state = fixedState({ deathNote: "", epitaph: "Rest in pieces." });
  const graves = bury(state, "trap", null, [], () => 1);
  assert.equal(graves[0].note, "died");
});

test("graves stay a plain array — JSON round-trips losslessly", () => {
  const state = fixedState({ deathNote: "cut down by a rat", epitaph: "Rest in pieces." });
  const graves = bury(state, "combat", "a rat", [], () => 42);
  const roundTripped = JSON.parse(JSON.stringify(graves));
  assert.deepStrictEqual(roundTripped, graves);
});

// --- purity ------------------------------------------------------------

/** Strip block + line comments before scanning source for forbidden refs. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

test("death.js references no DOM/localStorage", () => {
  const src = stripComments(fs.readFileSync(path.join(REPO_ROOT, "engine", "death.js"), "utf8"));
  assert.ok(!/\bdocument\b/.test(src));
  assert.ok(!/\blocalStorage\b/.test(src));
  assert.ok(!/Math\.random/.test(src));
});
