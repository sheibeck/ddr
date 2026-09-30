// test/unit/leaderboard-copy.test.js
//
// Phase 84 (BOARD-18, BOARD-24, BOARD-25, BOARD-27), Task 1 — pins
// content/boards.js's LEADERBOARD_COPY and content/season.js's SEASON_NAMES
// verbatim against the v3 mock (design/Mazeworld Boards Panel v3.dc.html)
// and the 84-02-PLAN.md Task 1 <action> list, and proves the bank's shape
// (deep-frozen, every leaf a non-empty string, tokens from the closed set
// only, no markup/WP/handle marker).
//
// TDD RED: written before content/boards.js exports LEADERBOARD_COPY and
// content/season.js exports SEASON_NAMES; assertions pinned to the plan's
// <behavior> and <action> bullets.

import test from "node:test";
import assert from "node:assert/strict";

import { LEADERBOARD_COPY } from "../../content/boards.js";
import { SEASON, SEASON_NAMES } from "../../content/season.js";
import { BOARD_STATS } from "../../src/browser/runDoc.js";

const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

// Only these leaf paths may carry a {token}; every other leaf must be
// token-free. Keyed by dotted leaf path (array indices as `[i]`).
const TOKEN_PATHS = new Set([
  "empty.board", "empty.mine",
  "standing.best",
  "line.both",
  "sheet.asSub", "sheet.classRace",
  "state.stale", "state.ageMinutes", "state.ageHours",
  "died",
  "seasonFallback",
  "who",
  "rowMenu.race", "rowMenu.sub", "rowMenu.both",
  "rowMenu.raceLine", "rowMenu.subLine",
]);

/** Every `{token}` in a string, without the braces. */
function tokensIn(s) {
  const out = [];
  const re = /\{([a-zA-Z]+)\}/g;
  let m;
  while ((m = re.exec(s))) out.push(m[1]);
  return out;
}

/** Recursively collect [path, value] for every leaf in a plain object/array tree. */
function collectLeaves(obj, pathLabel = "") {
  const leaves = [];
  if (typeof obj === "string" || typeof obj === "number" || typeof obj === "boolean") {
    leaves.push([pathLabel, obj]);
    return leaves;
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => leaves.push(...collectLeaves(v, `${pathLabel}[${i}]`)));
    return leaves;
  }
  if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      leaves.push(...collectLeaves(v, pathLabel ? `${pathLabel}.${k}` : k));
    }
  }
  return leaves;
}

// ─── Shape: deep-frozen, every leaf a non-empty string ──────────────────────

test("LEADERBOARD_COPY is deep-frozen and every leaf is a non-empty string", () => {
  (function walk(obj) {
    if (obj && typeof obj === "object") {
      assert.ok(Object.isFrozen(obj), "every nested object/array in LEADERBOARD_COPY must be frozen");
      for (const v of Object.values(obj)) walk(v);
    }
  })(LEADERBOARD_COPY);
  for (const [path, value] of collectLeaves(LEADERBOARD_COPY)) {
    assert.equal(typeof value, "string", `${path} should be a string`);
    assert.ok(value.length > 0, `${path} should be non-empty`);
  }
});

test("LEADERBOARD_COPY.months is a frozen array of 12 non-empty strings", () => {
  assert.ok(Array.isArray(LEADERBOARD_COPY.months));
  assert.ok(Object.isFrozen(LEADERBOARD_COPY.months));
  assert.equal(LEADERBOARD_COPY.months.length, 12);
  for (const m of LEADERBOARD_COPY.months) {
    assert.equal(typeof m, "string");
    assert.ok(m.length > 0);
  }
});

// ─── Verbatim mock string pins ───────────────────────────────────────────────

test("LEADERBOARD_COPY.title / scope / box / pick pin the mock strings verbatim", () => {
  assert.equal(LEADERBOARD_COPY.title.board, "LEADERBOARD");
  assert.equal(LEADERBOARD_COPY.title.mine, "YOUR DEAD");

  assert.equal(LEADERBOARD_COPY.scope.board, "Everyone’s dead. Top ten shown.");
  assert.equal(LEADERBOARD_COPY.scope.mine, "Only your heroes. Nobody else’s business.");
  assert.equal(LEADERBOARD_COPY.scope.off, "Compete is off. Only your heroes.");

  assert.equal(LEADERBOARD_COPY.box.yours, "YOURS ›");
  assert.equal(LEADERBOARD_COPY.box.everyone, "EVERYONE ›");
  assert.equal(LEADERBOARD_COPY.box.interred, "INTERRED");
  assert.equal(LEADERBOARD_COPY.box.unknown, "—");

  assert.equal(LEADERBOARD_COPY.pick.stat, "RANK BY");
  assert.equal(LEADERBOARD_COPY.pick.race, "RACE");
  assert.equal(LEADERBOARD_COPY.pick.sub, "SUB-CLASS");
  assert.equal(LEADERBOARD_COPY.pick.any, "ANY");
});

test("LEADERBOARD_COPY.empty / divider / standing pin the mock strings verbatim", () => {
  assert.equal(LEADERBOARD_COPY.empty.title, "NOBODY YET");
  assert.equal(LEADERBOARD_COPY.empty.board, "Nobody has died as {line}.");
  assert.equal(LEADERBOARD_COPY.empty.mine, "You haven’t lost a hero as {line}.");
  assert.equal(LEADERBOARD_COPY.empty.clear, "CLEAR FILTERS");
  assert.equal(LEADERBOARD_COPY.empty.boardAll, "Nobody has died yet this season. Somebody has to go first.");
  assert.equal(LEADERBOARD_COPY.empty.mineAll, "You haven’t lost a hero yet. Give it time.");

  assert.equal(LEADERBOARD_COPY.divider, "NOT IN THE TOP TEN · YOUR BEST");

  assert.equal(LEADERBOARD_COPY.standing.best, "{handle}’s best, of {n} interred as {line}.");
  assert.equal(LEADERBOARD_COPY.standing.none, "None of yours on this board yet.");
  assert.equal(LEADERBOARD_COPY.standing.noPlace, "—");
});

test("LEADERBOARD_COPY.sheet / line pin the mock strings verbatim", () => {
  assert.equal(LEADERBOARD_COPY.sheet.done, "DONE");
  assert.equal(LEADERBOARD_COPY.sheet.anyRace, "ANY RACE");
  assert.equal(LEADERBOARD_COPY.sheet.everyRace, "Every race");
  assert.equal(LEADERBOARD_COPY.sheet.anySub, "ANY SUB-CLASS");
  assert.equal(LEADERBOARD_COPY.sheet.everySub, "Every sub-class");
  assert.equal(LEADERBOARD_COPY.sheet.anySubLine, "Any sub-class");
  assert.equal(LEADERBOARD_COPY.sheet.asSub, "as {sub}");
  assert.equal(LEADERBOARD_COPY.sheet.classRace, "{cls} · {race}");

  assert.equal(LEADERBOARD_COPY.line.anyRace, "any race");
  assert.equal(LEADERBOARD_COPY.line.anySub, "any sub-class");
  assert.equal(LEADERBOARD_COPY.line.both, "{race}, {sub}");
});

test("LEADERBOARD_COPY.you, back, seasonFallback, sep, foe pin verbatim", () => {
  assert.equal(LEADERBOARD_COPY.you, "YOU");
  assert.equal(LEADERBOARD_COPY.back, "Back");
  assert.equal(LEADERBOARD_COPY.seasonFallback, "Season {n}");
  assert.equal(LEADERBOARD_COPY.sep, " · ");
  assert.equal(LEADERBOARD_COPY.foe, "foe");
  assert.equal(LEADERBOARD_COPY.died, "Died {date}");
});

test("LEADERBOARD_COPY.state pins the CONTEXT area-1 in-voice notes verbatim", () => {
  assert.equal(LEADERBOARD_COPY.state.loading, "Counting the dead. They are in no hurry.");
  assert.equal(LEADERBOARD_COPY.state.unreachable, "The board isn’t answering. Your own dead never leave.");
  assert.equal(LEADERBOARD_COPY.state.seeMine, "SEE YOUR DEAD");
  assert.equal(LEADERBOARD_COPY.state.stale, "Counted {age} ago. The board has stopped answering.");
  assert.equal(LEADERBOARD_COPY.state.ageMoment, "moments");
  assert.equal(LEADERBOARD_COPY.state.ageMinute, "a minute");
  assert.equal(LEADERBOARD_COPY.state.ageMinutes, "{n} minutes");
  assert.equal(LEADERBOARD_COPY.state.ageHour, "an hour");
  assert.equal(LEADERBOARD_COPY.state.ageHours, "{n} hours");
});

test("LEADERBOARD_COPY.dock pins the mock's dead-hero dock verbatim", () => {
  assert.equal(LEADERBOARD_COPY.dock.title, "BACK TO TITLE");
  assert.equal(LEADERBOARD_COPY.dock.roll, "ROLL A NEW HERO");
  assert.equal(LEADERBOARD_COPY.dock.dungeon, "BACK TO THE DUNGEON");
  assert.equal(LEADERBOARD_COPY.dock.finalSheet, "FINAL SHEET");
  assert.equal(LEADERBOARD_COPY.dock.bury, "BURY THEM");
  assert.deepStrictEqual(Object.keys(LEADERBOARD_COPY.dock), ["title", "roll", "dungeon", "finalSheet", "bury"]);
});

// ─── stats: exact key order equal to runDoc.js#BOARD_STATS, verbatim values ─

test("LEADERBOARD_COPY.stats has exactly deep/days/kills/purse in BOARD_STATS order", () => {
  assert.deepStrictEqual(Object.keys(LEADERBOARD_COPY.stats), BOARD_STATS);
  assert.deepStrictEqual(Object.keys(LEADERBOARD_COPY.stats), ["deep", "days", "kills", "purse"]);
});

// Phase 87 (BOARD-28, report #9) reversed the DEPTH tie-break: most steps first.
test("LEADERBOARD_COPY.stats each pins label/unit/col/rule verbatim from the mock", () => {
  const pins = {
    deep: { label: "DEPTH", unit: "FLOOR · SQ", col: "#d3c49f", rule: "Lowest floor reached. Ties go to more squares walked." },
    days: { label: "DAYS", unit: "DAYS", col: "#8fb08a", rule: "Days survived underground." },
    kills: { label: "KILLS", unit: "KILLS", col: "#e07260", rule: "Things killed before being killed." },
    purse: { label: "WILMST", unit: "WILMST", col: "#e8c97a", rule: "Carried at the moment of death. All of it still down there." },
  };
  for (const [id, fields] of Object.entries(pins)) {
    for (const [field, value] of Object.entries(fields)) {
      assert.equal(LEADERBOARD_COPY.stats[id][field], value, `stats.${id}.${field}`);
    }
    assert.match(LEADERBOARD_COPY.stats[id].col, HEX_COLOR_RE, `stats.${id}.col`);
  }
});

// ─── chips ───────────────────────────────────────────────────────────────────

test("LEADERBOARD_COPY.chips has exactly floor/days/squares/kills/exp/wilmst, mock values", () => {
  assert.deepStrictEqual(Object.keys(LEADERBOARD_COPY.chips), ["floor", "days", "squares", "kills", "exp", "wilmst"]);
  assert.equal(LEADERBOARD_COPY.chips.floor, "FLOOR");
  assert.equal(LEADERBOARD_COPY.chips.days, "DAYS");
  assert.equal(LEADERBOARD_COPY.chips.squares, "SQUARES");
  assert.equal(LEADERBOARD_COPY.chips.kills, "KILLS");
  assert.equal(LEADERBOARD_COPY.chips.exp, "EXP");
  assert.equal(LEADERBOARD_COPY.chips.wilmst, "WILMST");
});

// ─── Phase 87 (BOARD-29): the row detail's who line and the long-press menu ───

test("LEADERBOARD_COPY.who and rowMenu pin the BOARD-29 copy", () => {
  assert.equal(LEADERBOARD_COPY.who, "{race} · {sub} ({cls})");
  assert.deepStrictEqual(tokensIn(LEADERBOARD_COPY.who), ["race", "sub", "cls"]);
  const m = LEADERBOARD_COPY.rowMenu;
  assert.deepStrictEqual(Object.keys(m), [
    "title", "open", "race", "sub", "both", "cancel", "raceLine", "subLine", "bothLine", "cancelLine",
  ]);
  assert.equal(m.title, "FILTER LIKE THIS");
  assert.equal(m.open, "FILTER LIKE THIS");
  assert.equal(m.race, "FILTER BY {race}");
  assert.equal(m.sub, "FILTER BY {sub}");
  assert.equal(m.both, "FILTER BY {race} {sub}");
  assert.equal(m.cancel, "CANCEL");
  assert.deepStrictEqual(tokensIn(m.raceLine), ["race"]);
  assert.deepStrictEqual(tokensIn(m.subLine), ["sub"]);
  assert.deepStrictEqual(tokensIn(m.bothLine), []);
  assert.deepStrictEqual(tokensIn(m.cancelLine), []);
});

// ─── Token rules ─────────────────────────────────────────────────────────────

test("Only the declared LEADERBOARD_COPY leaves carry a {token}; everything else is token-free", () => {
  for (const [path, value] of collectLeaves(LEADERBOARD_COPY)) {
    const toks = tokensIn(value);
    if (TOKEN_PATHS.has(path)) {
      assert.ok(toks.length > 0, `${path} was expected to carry a token`);
    } else {
      assert.deepStrictEqual(toks, [], `${path} should carry no token, found {${toks.join(",")}}`);
    }
  }
});

test("empty.board/empty.mine carry {line}; standing.best carries {handle}{n}{line}; line.both carries {race}{sub}", () => {
  assert.deepStrictEqual(tokensIn(LEADERBOARD_COPY.empty.board), ["line"]);
  assert.deepStrictEqual(tokensIn(LEADERBOARD_COPY.empty.mine), ["line"]);
  assert.deepStrictEqual(tokensIn(LEADERBOARD_COPY.standing.best), ["handle", "n", "line"]);
  assert.deepStrictEqual(tokensIn(LEADERBOARD_COPY.line.both), ["race", "sub"]);
  assert.deepStrictEqual(tokensIn(LEADERBOARD_COPY.sheet.asSub), ["sub"]);
  assert.deepStrictEqual(tokensIn(LEADERBOARD_COPY.sheet.classRace), ["cls", "race"]);
  assert.deepStrictEqual(tokensIn(LEADERBOARD_COPY.state.stale), ["age"]);
  assert.deepStrictEqual(tokensIn(LEADERBOARD_COPY.state.ageMinutes), ["n"]);
  assert.deepStrictEqual(tokensIn(LEADERBOARD_COPY.state.ageHours), ["n"]);
  assert.deepStrictEqual(tokensIn(LEADERBOARD_COPY.died), ["date"]);
  assert.deepStrictEqual(tokensIn(LEADERBOARD_COPY.seasonFallback), ["n"]);
});

// ─── No markup, WP or handle marker ─────────────────────────────────────────

test("No LEADERBOARD_COPY string has a markup character, a standalone WP token, or an @ handle marker", () => {
  for (const [path, value] of collectLeaves(LEADERBOARD_COPY)) {
    assert.doesNotMatch(value, /[<>@]/, `${path} -> "${value}"`);
    assert.doesNotMatch(value, /\bWP\b/i, `${path} -> "${value}"`);
  }
});

// ─── content/ stays pure data ───────────────────────────────────────────────

test("LEADERBOARD_COPY has no function-typed leaves anywhere in its object graph", () => {
  (function walk(obj) {
    if (typeof obj === "function") assert.fail("LEADERBOARD_COPY must hold no functions");
    if (obj && typeof obj === "object") {
      for (const v of Object.values(obj)) walk(v);
    }
  })(LEADERBOARD_COPY);
});

// ─── content/season.js: SEASON_NAMES ────────────────────────────────────────

test("SEASON_NAMES is frozen, SEASON_NAMES[1] is 'Season of the Alpha', SEASON stays 1", () => {
  assert.ok(Object.isFrozen(SEASON_NAMES));
  assert.equal(SEASON_NAMES[1], "Season of the Alpha");
  assert.equal(SEASON, 1);
});
