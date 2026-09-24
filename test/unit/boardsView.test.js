// test/unit/boardsView.test.js
//
// Phase 66 (BOARD-02..08, D-15), Plan 04 — unit tests for the Leaderboards
// panel's pure view model, src/browser/boardsView.js. Task 1 covers the
// ported mock helpers (avatarColour/initialsOf/ordinal), runPool, cutTopTen
// and every board's row content. Task 2 covers boardsView's header, strip,
// rail, body, standing card, footnote, dock and its purity/source pins.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { stripJs } from "../../tools/ident-sweep.mjs";
import {
  boardsView,
  runPool,
  cutTopTen,
  avatarColour,
  initialsOf,
  ordinal,
  AVATAR_PALETTE,
} from "../../src/browser/boardsView.js";
import { emptyBests, updateBests, runHash, normalizeStone, BOARD_IDS } from "../../engine/records.js";
import { BOARD_COPY, BOARD_FOOTNOTES, BOARDS_PANEL_COPY, GLOBAL_STANDING_LINES } from "../../content/boards.js";
import { encodeTag, decodeTag } from "../../src/browser/scoreTag.js";
import { boardScore } from "../../src/browser/boardScores.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const MODULE_PATH = path.join(REPO_ROOT, "src", "browser", "boardsView.js");
const MODULE_SRC = fs.readFileSync(MODULE_PATH, "utf8").replace(/\r\n/g, "\n");
const STRIPPED = stripJs(MODULE_SRC);

// ─── fixtures ────────────────────────────────────────────────────────────

/** makeSummary(overrides) — a full RunSummary with a correctly computed hash. */
function makeSummary(overrides = {}) {
  const base = {
    season: 1,
    seed: 1,
    acts: 10,
    floor: 5,
    steps: 500,
    day: 3,
    kills: 2,
    gold: 100,
    sp: 50,
    level: 2,
    race: "Human",
    sub: "Soldier",
    cls: "Fighter",
    name: "Anna",
    cause: "combat",
    note: "died to a rat",
    epitaph: "The rat remembers.",
    ...overrides,
  };
  return { ...base, hash: runHash(base) };
}

/** legacyStone(overrides) — a pre-ledger graveyard tombstone (no season/seed/acts/hash). */
function legacyStone(overrides = {}) {
  return {
    name: "Old One",
    race: "Human",
    sub: "Soldier",
    cls: "Fighter",
    level: 3,
    sp: 88,
    floor: 4,
    day: 6,
    steps: 300,
    gold: 50,
    kills: 2,
    note: "died",
    epitaph: "RIP",
    when: 1000,
    ...overrides,
  };
}

/** deepFreeze(obj) — recursive Object.freeze, used to prove no-mutation. */
function deepFreeze(obj) {
  if (obj && typeof obj === "object" && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    for (const key of Object.keys(obj)) deepFreeze(obj[key]);
  }
  return obj;
}

/** recordWith(summaries) — folds summaries in order into a fresh BestsRecord. */
function recordWith(summaries) {
  let rec = emptyBests();
  for (const s of summaries) rec = updateBests(rec, s).record;
  return rec;
}

/** collectStrings(node, out) — every string leaf in a view, for the offline/voice sweeps. */
function collectStrings(node, out = []) {
  if (typeof node === "string") {
    out.push(node);
  } else if (Array.isArray(node)) {
    for (const item of node) collectStrings(item, out);
  } else if (node && typeof node === "object") {
    for (const key of Object.keys(node)) collectStrings(node[key], out);
  }
  return out;
}

// =============================================================================
// Task 1 — avatarColour, initialsOf, ordinal, runPool, cutTopTen, row builders
// =============================================================================

test("avatarColour: pinned vectors match the mock's AVATAR hash", () => {
  assert.equal(avatarColour("Hilda Ferrow"), "#5c4a6b");
  assert.equal(avatarColour("Pip Alderwey"), "#4a5c6b");
  assert.equal(avatarColour("Odo"), "#4a6b52");
  assert.equal(avatarColour("Marta Quen"), "#5c5c4a");
});

test("avatarColour: every colour comes from AVATAR_PALETTE, and a non-string key never throws", () => {
  assert.deepStrictEqual(AVATAR_PALETTE, ["#6b5c3c", "#4a5c6b", "#5c4a6b", "#4a6b52", "#6b4a4a", "#5c5c4a"]);
  assert.doesNotThrow(() => avatarColour(null));
  assert.doesNotThrow(() => avatarColour(undefined));
  assert.doesNotThrow(() => avatarColour(42));
  assert.doesNotThrow(() => avatarColour({}));
  assert.ok(AVATAR_PALETTE.includes(avatarColour(42)));
});

test("initialsOf: pinned vectors, including the no-second-word and no-words cases", () => {
  assert.equal(initialsOf("Hilda Ferrow"), "HF");
  assert.equal(initialsOf("Odo"), "OD");
  assert.equal(initialsOf(""), "?");
  assert.equal(initialsOf(null), "?");
  assert.equal(initialsOf(undefined), "?");
});

test("ordinal: pinned vectors including the 11-13 exception band", () => {
  const cases = {
    1: "1ST",
    2: "2ND",
    3: "3RD",
    4: "4TH",
    11: "11TH",
    12: "12TH",
    13: "13TH",
    21: "21ST",
    22: "22ND",
    23: "23RD",
    24: "24TH",
    101: "101ST",
    111: "111TH",
    112: "112TH",
  };
  for (const [n, expected] of Object.entries(cases)) {
    assert.equal(ordinal(Number(n)), expected, `ordinal(${n})`);
  }
});

test("runPool: dedupes bests.runs and normalized stones by hash, stones in stored order first", () => {
  const s1 = makeSummary({ floor: 5, name: "Anna" });
  const rec = recordWith([s1]);
  const graves = [legacyStone({ name: "Zed", floor: 1 }), legacyStone({ name: "Yara", floor: 9 })];

  const pool = runPool(rec, graves);
  assert.equal(pool.length, 3);
  assert.equal(pool[0].name, "Zed");
  assert.equal(pool[1].name, "Yara");
  assert.equal(pool[2].hash, s1.hash);
});

test("runPool: a legacy stone already backfilled into bests.runs counts once", () => {
  const stone = legacyStone({ name: "Old One", floor: 4 });
  const normalized = normalizeStone(stone);
  const rec = recordWith([normalized]);
  const pool = runPool(rec, [stone]);
  assert.equal(pool.length, 1);
  assert.equal(pool[0].hash, normalized.hash);
});

test("cutTopTen: 9 or fewer entries come back unchanged (as copies)", () => {
  const entries = Array.from({ length: 9 }, (_, i) => ({ key: `k${i}` }));
  const out = cutTopTen(entries);
  assert.deepStrictEqual(out, entries);
  assert.notEqual(out, entries);
  assert.notEqual(out[0], entries[0]);
});

test("cutTopTen: 12 entries with a you entry at index 4 give the first ten, no divider", () => {
  const entries = Array.from({ length: 12 }, (_, i) => ({ key: `k${i}`, you: i === 4 }));
  const out = cutTopTen(entries);
  assert.equal(out.length, 10);
  assert.ok(out.every((e) => !e.divider));
});

test("cutTopTen: 12 entries with the only you entry at index 11 give the first ten plus that entry marked divider", () => {
  const entries = Array.from({ length: 12 }, (_, i) => ({ key: `k${i}`, you: i === 11 }));
  const out = cutTopTen(entries);
  assert.equal(out.length, 11);
  assert.equal(out[10].key, "k11");
  assert.equal(out[10].divider, BOARDS_PANEL_COPY.divider);
});

test("cutTopTen: never mutates the input array or its entries", () => {
  const entries = Object.freeze(
    Array.from({ length: 12 }, (_, i) => Object.freeze({ key: `k${i}`, you: i === 11 }))
  );
  assert.doesNotThrow(() => cutTopTen(entries));
});

test("Ranked board rows: one per hash in bests.boards[board], in order, keyed by hash", () => {
  const s1 = makeSummary({ floor: 5, name: "Anna" });
  const s2 = makeSummary({ floor: 9, name: "Bob", race: "Dwarf", sub: "Thief", level: 3 });
  const rec = recordWith([s1, s2]);
  const view = boardsView({ bests: rec, graves: [], total: 2, board: "deep", entry: "tab" });
  assert.equal(view.body.kind, "rows");
  assert.deepStrictEqual(
    view.body.rows.map((r) => r.key),
    rec.boards.deep
  );
  const top = view.body.rows[0];
  assert.equal(top.headline, "Bob");
  assert.equal(top.name, "");
  assert.equal(top.line, "DWARF THIEF · LVL III");
  assert.equal(top.val, "9");
  assert.equal(top.unit, "FLOOR");
});

test("Ranked rows: detail is the death note capitalised, '. ', then the epitaph", () => {
  const s1 = makeSummary({ note: "died to a rat", epitaph: "The rat remembers." });
  const rec = recordWith([s1]);
  const view = boardsView({ bests: rec, graves: [], total: 1, board: "deep", entry: "tab" });
  assert.equal(view.body.rows[0].detail, "Died to a rat. The rat remembers.");
});

test("Ranked rows: PURSE value is en-US digit-grouped", () => {
  const s1 = makeSummary({ gold: 4688 });
  const rec = recordWith([s1]);
  const view = boardsView({ bests: rec, graves: [], total: 1, board: "purse", entry: "tab" });
  assert.equal(view.body.rows[0].val, "4,688");
  assert.equal(view.body.rows[0].unit, "WILMST");
});

test("Ranked rows: LEANEST value is 'floor · steps' and unit is FLOOR · SQ", () => {
  const s1 = makeSummary({ floor: 9, steps: 312 });
  const rec = recordWith([s1]);
  const view = boardsView({ bests: rec, graves: [], total: 1, board: "lean", entry: "tab" });
  assert.equal(view.body.rows[0].val, "9 · 312");
  assert.equal(view.body.rows[0].unit, "FLOOR · SQ");
});

test("Stats: exactly FLOOR/DAYS/SQUARES/KILLS/EXP/WILMST with en-US-grouped gold, missing numbers render '0'", () => {
  const s1 = makeSummary({ floor: 5, day: 3, steps: 500, kills: 2, sp: 50, gold: 1234 });
  const rec = recordWith([s1]);
  const view = boardsView({ bests: rec, graves: [], total: 1, board: "deep", open: s1.hash, entry: "tab" });
  const stats = view.body.rows[0].stats;
  assert.deepStrictEqual(
    stats.map((s) => s.k),
    ["FLOOR", "DAYS", "SQUARES", "KILLS", "EXP", "WILMST"]
  );
  assert.deepStrictEqual(
    stats.map((s) => s.v),
    ["5", "3", "500", "2", "50", "1,234"]
  );
});

test("LEANEST order in the rows follows squares per floor: a lean 22-step floor-1 run outranks a 900-step floor-9 run", () => {
  const efficient = makeSummary({ floor: 1, steps: 22, name: "Lean" });
  const grinder = makeSummary({ floor: 9, steps: 900, name: "Grinder" });
  const rec = recordWith([efficient, grinder]);
  const view = boardsView({ bests: rec, graves: [], total: 2, board: "lean", entry: "tab" });
  assert.equal(view.body.rows[0].headline, "Lean");

  const deepView = boardsView({ bests: rec, graves: [], total: 2, board: "deep", entry: "tab" });
  assert.equal(deepView.body.rows[0].headline, "Grinder", "DEEPEST must rank the deeper run first, unlike LEANEST");
});

test("LINEAGE rows: grouped by race+class, ordered by compareRuns('combo'), keyed 'combo:' + lineage key", () => {
  const a1 = makeSummary({ race: "Human", cls: "Fighter", floor: 5, name: "Anna" });
  const a2 = makeSummary({ race: "Human", cls: "Fighter", floor: 8, steps: 10, name: "Zoe", seed: 2 });
  const b1 = makeSummary({ race: "Dwarf", cls: "Thief", floor: 3, name: "Bob", seed: 3 });
  const rec = recordWith([a1, a2, b1]);
  const view = boardsView({ bests: rec, graves: [], total: 3, board: "combo", entry: "tab" });
  assert.deepStrictEqual(
    view.body.rows.map((r) => r.key),
    ["combo:Human Fighter", "combo:Dwarf Thief"]
  );
  const humanFighter = view.body.rows[0];
  assert.equal(humanFighter.headline, "Zoe", "the combo's best run (deepest) is the headline");
  assert.equal(humanFighter.name, "HUMAN FIGHTER");
  assert.equal(humanFighter.line, "2 INTERRED, NO SURVIVORS");
  assert.equal(humanFighter.val, "8");

  const dwarfThief = view.body.rows[1];
  assert.equal(dwarfThief.line, "1 INTERRED");
  assert.match(dwarfThief.detail, /^1 rolled, 1 dead\. Deepest was Bob, floor 3 in \d+ squares\. /);
});

test("GRAVEYARD rows: all normalized stones in sortGraveyard order, unranked, keyed hash + ':' + index", () => {
  const graves = [legacyStone({ name: "Newest", floor: 2, steps: 10 }), legacyStone({ name: "Oldest", floor: 9, steps: 5 })];
  const view = boardsView({ bests: null, graves, total: 2, board: "yard", entry: "tab" });
  assert.equal(view.body.rows.length, 2);
  assert.equal(view.body.rows[0].headline, "Oldest", "deepest first");
  assert.ok(view.body.rows.every((r) => r.rank === "" && r.top === false && r.podium === false));
  const [firstHash] = view.body.rows[0].key.split(":");
  assert.equal(view.body.rows[0].key, `${firstHash}:0`);
  assert.equal(view.body.rows[1].key.endsWith(":1"), true);
});

test("GRAVEYARD row content: headline is the name, name slot is the level line, line is the capitalised note, detail is the epitaph, val is 'floor · steps'", () => {
  const graves = [legacyStone({ name: "Odo", race: "Halfling", sub: "Cleric", level: 1, floor: 2, steps: 88, note: "cut down", epitaph: "No prayers answered." })];
  const view = boardsView({ bests: null, graves, total: 1, board: "yard", entry: "tab" });
  const row = view.body.rows[0];
  assert.equal(row.headline, "Odo");
  assert.equal(row.name, "HALFLING CLERIC · LVL I");
  assert.equal(row.line, "Cut down");
  assert.equal(row.detail, "No prayers answered.");
  assert.equal(row.val, "2 · 88");
  assert.equal(row.unit, "FLOOR · SQ");
});

test("Value bars: min-max over the listed rows, an unplaced LEANEST run gets the minimum 3, negated rate makes the best rate fullest", () => {
  const fast = makeSummary({ floor: 5, steps: 50, name: "Fast" });
  const slow = makeSummary({ floor: 5, steps: 500, name: "Slow", seed: 2 });
  const rec = recordWith([fast, slow]);
  const view = boardsView({ bests: rec, graves: [], total: 2, board: "lean", entry: "tab" });
  assert.equal(view.body.rows[0].headline, "Fast");
  assert.equal(view.body.rows[0].barPct, 100);
  assert.equal(view.body.rows[1].barPct, 3);
});

test("Value bars: when every metric is equal (including a single row) every bar is 100", () => {
  const only = makeSummary({ floor: 5 });
  const rec = recordWith([only]);
  const single = boardsView({ bests: rec, graves: [], total: 1, board: "deep", entry: "tab" });
  assert.equal(single.body.rows[0].barPct, 100);

  const tie1 = makeSummary({ floor: 5, gold: 100, name: "A" });
  const tie2 = makeSummary({ floor: 5, gold: 100, name: "B", seed: 2 });
  const recTie = recordWith([tie1, tie2]);
  const tieView = boardsView({ bests: recTie, graves: [], total: 2, board: "purse", entry: "tab" });
  assert.ok(tieView.body.rows.every((r) => r.barPct === 100));
});

test("Two runs with the same adventurer name get distinct row keys and the same avatar colour and initials", () => {
  const s1 = makeSummary({ name: "Anna", floor: 5 });
  const s2 = makeSummary({ name: "Anna", floor: 9, seed: 2 });
  const rec = recordWith([s1, s2]);
  const view = boardsView({ bests: rec, graves: [], total: 2, board: "deep", entry: "tab" });
  assert.notEqual(view.body.rows[0].key, view.body.rows[1].key);
  assert.equal(view.body.rows[0].avatar.initials, view.body.rows[1].avatar.initials);
  assert.equal(view.body.rows[0].avatar.bg, view.body.rows[1].avatar.bg);
});

// =============================================================================
// Task 2 — boardsView: header, strip/scope, rail, body, standing, footnote, dock
// =============================================================================

test("Input normalization: unknown board -> deep, unknown scope -> local, non-title entry -> tab, null bests, non-array graves", () => {
  const view = boardsView({ bests: null, graves: "not-an-array", board: "nope", scope: "nope", entry: "nope" });
  assert.equal(view.board.id, "deep");
  assert.equal(view.header.back, false);
  assert.equal(view.body.kind, "empty");
});

test("header: title/scopeLine/interred/back/backLabel", () => {
  const view = boardsView({ bests: null, graves: [], total: 5, board: "deep", entry: "title" });
  assert.equal(view.header.title, "LEADERBOARDS");
  assert.equal(view.header.scopeLine, BOARDS_PANEL_COPY.scope.ranked);
  assert.equal(view.header.interred, 5);
  assert.equal(view.header.interredLabel, "INTERRED");
  assert.equal(view.header.back, true);
  assert.equal(view.header.backLabel, "Back");

  const yardView = boardsView({ bests: null, graves: [], total: 5, board: "yard", entry: "tab" });
  assert.equal(yardView.header.scopeLine, BOARDS_PANEL_COPY.scope.yard);
  assert.equal(yardView.header.back, false);
});

test("header interred: raised to the stone count when total is lower, and never negative/non-integer", () => {
  const graves = [legacyStone({ floor: 1 }), legacyStone({ floor: 2 })];
  const low = boardsView({ bests: null, graves, total: 1, board: "deep", entry: "tab" });
  assert.equal(low.header.interred, 2);
  const invalid = boardsView({ bests: null, graves, total: -3, board: "deep", entry: "tab" });
  assert.equal(invalid.header.interred, 2);
  const missing = boardsView({ bests: null, graves, board: "deep", entry: "tab" });
  assert.equal(missing.header.interred, 2);
});

test("strip: null on GRAVEYARD; elsewhere the signed-out glyph/label/source and dimmed ALL/FRIENDS chips", () => {
  const yardView = boardsView({ bests: null, graves: [], board: "yard", entry: "tab" });
  assert.equal(yardView.strip, null);

  const view = boardsView({ bests: null, graves: [], board: "deep", scope: "all", entry: "tab" });
  assert.equal(view.strip.glyph, "?");
  assert.equal(view.strip.label, "PLAY GAMES · SIGNED OUT");
  assert.equal(view.strip.source, "Your dead only");
  assert.deepStrictEqual(
    view.strip.scopes.map((s) => ({ id: s.id, on: s.on, dim: s.dim })),
    [
      { id: "all", on: true, dim: true },
      { id: "friends", on: false, dim: true },
    ]
  );
});

test("body: a ranked board with scope all/friends replaces rows with an in-panel note, even with no data; GRAVEYARD ignores scope", () => {
  const allView = boardsView({ bests: null, graves: [], board: "deep", scope: "all", entry: "tab" });
  assert.deepStrictEqual(allView.body, { kind: "note", line: BOARDS_PANEL_COPY.note.all });

  const friendsView = boardsView({ bests: null, graves: [], board: "deep", scope: "friends", entry: "tab" });
  assert.deepStrictEqual(friendsView.body, { kind: "note", line: BOARDS_PANEL_COPY.note.friends });

  const graves = [legacyStone({ floor: 1 })];
  const yardScopedView = boardsView({ bests: null, graves, board: "yard", scope: "all", entry: "tab" });
  assert.equal(yardScopedView.body.kind, "rows");
});

test("body: row.open reflects view.open by key", () => {
  const s1 = makeSummary({ floor: 5 });
  const rec = recordWith([s1]);
  const view = boardsView({ bests: rec, graves: [], board: "deep", open: s1.hash, entry: "tab" });
  assert.equal(view.body.rows[0].open, true);
  const closedView = boardsView({ bests: rec, graves: [], board: "deep", open: "other", entry: "tab" });
  assert.equal(closedView.body.rows[0].open, false);
});

test("rail: seven entries in BOARD_IDS order with each board's tab/colour, whatever board is active", () => {
  const view = boardsView({ bests: null, graves: [], board: "kills", entry: "tab" });
  assert.deepStrictEqual(
    view.rail.map((r) => r.id),
    BOARD_IDS
  );
  for (const entry of view.rail) {
    assert.equal(entry.tab, BOARD_COPY[entry.id].tab);
    assert.equal(entry.col, BOARD_COPY[entry.id].col);
    assert.equal(entry.on, entry.id === "kills");
  }
});

test("board: id/mark/col/title/rule come from BOARD_COPY", () => {
  const view = boardsView({ bests: null, graves: [], board: "kills", entry: "tab" });
  assert.equal(view.board.id, "kills");
  assert.equal(view.board.mark, BOARD_COPY.kills.mark);
  assert.equal(view.board.col, BOARD_COPY.kills.col);
  assert.equal(view.board.title, BOARD_COPY.kills.title);
  assert.equal(view.board.rule, BOARD_COPY.kills.rule);
});

test("footnote: BOARD_FOOTNOTES.yard on GRAVEYARD, else .ranked", () => {
  const yardView = boardsView({ bests: null, graves: [], board: "yard", entry: "tab" });
  assert.equal(yardView.footnote, BOARD_FOOTNOTES.yard);
  const rankedView = boardsView({ bests: null, graves: [], board: "deep", entry: "tab" });
  assert.equal(rankedView.footnote, BOARD_FOOTNOTES.ranked);
});

test("dock: null for tab entry; title with a live hero gives BACK TO THE DUNGEON alone; without a hero gives BACK TO TITLE + ROLL A NEW HERO", () => {
  const tabView = boardsView({ bests: null, graves: [], board: "deep", entry: "tab" });
  assert.equal(tabView.dock, null);

  const heroView = boardsView({ bests: null, graves: [], board: "deep", entry: "title", hasHero: true });
  assert.deepStrictEqual(heroView.dock, [{ id: "dungeon", label: "BACK TO THE DUNGEON", primary: true }]);

  const noHeroView = boardsView({ bests: null, graves: [], board: "deep", entry: "title", hasHero: false });
  assert.deepStrictEqual(noHeroView.dock, [
    { id: "title", label: "BACK TO TITLE", primary: false },
    { id: "roll", label: "ROLL A NEW HERO", primary: true },
  ]);
});

test("standing, ranked board: place is 1 + strictly-better count, label is name + unit, note carries the pool size", () => {
  const runs = [];
  for (let i = 0; i < 5; i++) runs.push(makeSummary({ floor: 10 - i, name: `R${i}`, seed: i + 1 }));
  const rec = recordWith(runs);
  const recent = runs[3]; // floor 7, the 4th deepest of 5
  const view = boardsView({ bests: rec, graves: [], total: 5, board: "deep", entry: "tab", recentHash: recent.hash });
  assert.equal(view.standing.place, "4TH");
  assert.match(view.standing.note, /^of 5 of yours\. /);
});

test("standing, a tie: three runs tied on every key with the recent one among them all place 1ST", () => {
  const a = makeSummary({ floor: 5, gold: 100, name: "A" });
  const b = makeSummary({ floor: 5, gold: 100, name: "B", seed: 2 });
  const c = makeSummary({ floor: 5, gold: 100, name: "C", seed: 3 });
  const rec = recordWith([a, b, c]);
  const view = boardsView({ bests: rec, graves: [], total: 3, board: "purse", entry: "tab", recentHash: c.hash });
  assert.equal(view.standing.place, "1ST");
});

test("standing, LINEAGE: the recent run's combo rank among all combos, label is COMBO · FLOOR, note counts combinations", () => {
  const a1 = makeSummary({ race: "Human", cls: "Fighter", floor: 8, name: "Zoe" });
  const a2 = makeSummary({ race: "Human", cls: "Fighter", floor: 2, name: "Anna", seed: 2 });
  const b1 = makeSummary({ race: "Dwarf", cls: "Thief", floor: 9, name: "Bob", seed: 3 });
  const rec = recordWith([a1, a2, b1]);
  const view = boardsView({ bests: rec, graves: [], total: 3, board: "combo", entry: "tab", recentHash: a2.hash });
  assert.equal(view.standing.label, "HUMAN FIGHTER · FLOOR");
  assert.match(view.standing.note, /^of 2 combinations\. /);
});

test("standing, GRAVEYARD: label INTERRED, place is the header's interred, note names the deepest run", () => {
  const s1 = makeSummary({ floor: 9, name: "Deepest" });
  const rec = recordWith([s1]);
  const view = boardsView({ bests: rec, graves: [], total: 1, board: "yard", entry: "tab" });
  assert.equal(view.standing.label, "INTERRED");
  assert.equal(view.standing.place, String(view.header.interred));
  assert.equal(view.standing.note, "rolled, delved, and buried. Deepest was Deepest on floor 9.");
});

test("standing, empty (no runs at all): NO ENTRY on every board including GRAVEYARD", () => {
  for (const board of BOARD_IDS) {
    const view = boardsView({ bests: null, graves: [], board, entry: "tab" });
    assert.equal(view.standing.label, "NO ENTRY");
    assert.equal(view.standing.place, "—");
    assert.equal(view.standing.note, BOARDS_PANEL_COPY.standing.noNote);
  }
});

test("standing quip: deterministic — the same hash and board always pick the same quip", () => {
  const s1 = makeSummary({ floor: 9, name: "Only" });
  const rec = recordWith([s1]);
  const view1 = boardsView({ bests: rec, graves: [], total: 1, board: "deep", entry: "tab" });
  const view2 = boardsView({ bests: rec, graves: [], total: 1, board: "deep", entry: "tab" });
  assert.equal(view1.standing.note, view2.standing.note);
});

test("A full run of all seven boards on a 12-run fixture: DEEPEST and LEANEST orders differ, GRAVEYARD holds all unranked, LINEAGE groups by race+class", () => {
  const races = ["Human", "Dwarf", "Elf"];
  const classes = ["Fighter", "Thief"];
  const runs = [];
  for (let i = 0; i < 12; i++) {
    runs.push(
      makeSummary({
        seed: i + 1,
        name: `Delver${i}`,
        race: races[i % races.length],
        cls: classes[Math.floor(i / races.length) % classes.length],
        floor: 1 + (i % 10),
        steps: 20 + i * 37,
        day: 1 + (i % 8),
        kills: i % 5,
        gold: i * 111,
      })
    );
  }
  const rec = recordWith(runs);
  const graves = runs.map((r) => ({ ...r }));

  const deepView = boardsView({ bests: rec, graves, total: 12, board: "deep", entry: "tab" });
  const leanView = boardsView({ bests: rec, graves, total: 12, board: "lean", entry: "tab" });
  assert.notDeepStrictEqual(
    deepView.body.rows.map((r) => r.key),
    leanView.body.rows.map((r) => r.key)
  );

  const yardView = boardsView({ bests: rec, graves, total: 12, board: "yard", entry: "tab" });
  assert.equal(yardView.body.rows.length, 12);
  assert.ok(yardView.body.rows.every((r) => r.rank === ""));

  const comboView = boardsView({ bests: rec, graves, total: 12, board: "combo", entry: "tab" });
  const uniqueCombos = new Set(runs.map((r) => `${r.race} ${r.cls}`));
  assert.equal(comboView.body.rows.length, uniqueCombos.size);

  for (const board of BOARD_IDS) {
    const view = boardsView({ bests: rec, graves, total: 12, board, entry: "tab" });
    assert.equal(view.body.kind, "rows");
  }
});

test("Offline: no row has a non-empty tag, you true or a divider, and no view string mentions worldwide/friends-among/handle", () => {
  const races = ["Human", "Dwarf"];
  const runs = [];
  for (let i = 0; i < 13; i++) {
    runs.push(makeSummary({ seed: i + 1, name: `Delver${i}`, race: races[i % 2], floor: 1 + (i % 10), steps: 20 + i }));
  }
  const rec = recordWith(runs);
  const graves = runs.map((r) => ({ ...r }));

  for (const board of BOARD_IDS) {
    const view = boardsView({ bests: rec, graves, total: 13, board, entry: "tab" });
    if (view.body.kind === "rows") {
      for (const row of view.body.rows) {
        assert.equal(row.you, false);
        assert.equal(row.tag, "");
        assert.equal(row.divider, "");
      }
    }
    const strings = collectStrings(view);
    for (const s of strings) {
      assert.doesNotMatch(s, /worldwide/i);
      assert.doesNotMatch(s, /among friends/i);
      assert.doesNotMatch(s, /@/);
    }
  }
});

test("Purity: boardsView on deep-frozen inputs never throws or mutates, and two calls give deepStrictEqual views", () => {
  const s1 = makeSummary({ floor: 5 });
  const rec = deepFreeze(recordWith([s1]));
  const graves = deepFreeze([legacyStone({ floor: 3 })]);
  const input = deepFreeze({ bests: rec, graves, total: 3, board: "deep", scope: "local", open: null, entry: "tab", hasHero: false, signedIn: false });

  let v1;
  assert.doesNotThrow(() => {
    v1 = boardsView(input);
  });
  const v2 = boardsView(input);
  assert.deepStrictEqual(v1, v2);
});

test("Empty data: boardsView({}) returns a complete view with INTERRED 0, an empty body on every board and NO ENTRY", () => {
  const view = boardsView({});
  assert.equal(view.header.interred, 0);
  assert.equal(view.standing.label, "NO ENTRY");
  for (const board of BOARD_IDS) {
    const boardView = boardsView({ board, entry: "tab" });
    assert.equal(boardView.body.kind, "empty");
    assert.equal(boardView.body.line, BOARDS_PANEL_COPY.empty);
  }
});

test("source pins: the comment-stripped module holds no document./window./localStorage/Math.random/Date. reference and no network identifier", () => {
  assert.doesNotMatch(STRIPPED, /\bdocument\./);
  assert.doesNotMatch(STRIPPED, /\bwindow\./);
  assert.doesNotMatch(STRIPPED, /\blocalStorage\b/);
  assert.doesNotMatch(STRIPPED, /Math\.random/);
  assert.doesNotMatch(STRIPPED, /\bDate\./);
  for (const ident of ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "sendBeacon"]) {
    assert.doesNotMatch(STRIPPED, new RegExp(`\\b${ident}\\b`), `unexpected network identifier: ${ident}`);
  }
});

// =============================================================================
// Phase 67 (D-08) — the signed-in strip and the coming-online notes
// =============================================================================

const LIVE_PLAYER = { id: "p1", displayName: "Lanternjaw" };

test("signed in: DEEPEST strip carries the display name, its initials avatar, PLAY GAMES · SIGNED IN and lit chips", () => {
  const view = boardsView({ bests: null, graves: [], board: "deep", scope: "local", entry: "tab", signedIn: true, player: LIVE_PLAYER });
  assert.deepStrictEqual(view.strip, {
    glyph: "",
    avatar: { initials: initialsOf("Lanternjaw"), bg: avatarColour("Lanternjaw") },
    label: "Lanternjaw",
    source: "PLAY GAMES · SIGNED IN",
    scopes: [
      { id: "all", label: "ALL", on: false, dim: false },
      { id: "friends", label: "FRIENDS", on: false, dim: false },
    ],
  });
});

test("signed in: the display name is trimmed", () => {
  const view = boardsView({ board: "deep", entry: "tab", signedIn: true, player: { id: "p", displayName: "  Lanternjaw  " } });
  assert.equal(view.strip.label, "Lanternjaw");
  assert.equal(view.strip.avatar.initials, initialsOf("Lanternjaw"));
});

test("signed in with no usable name: label and avatar fall back to strip.live.unnamed", () => {
  const fallback = BOARDS_PANEL_COPY.strip.live.unnamed;
  for (const player of [null, undefined, { id: "p", displayName: "" }, { id: "p", displayName: "   " }, { id: "p" }, { id: "p", displayName: 42 }, "Lanternjaw", 7]) {
    const view = boardsView({ board: "deep", entry: "tab", signedIn: true, player });
    assert.equal(view.strip.label, fallback, `player ${JSON.stringify(player)}`);
    assert.deepStrictEqual(view.strip.avatar, { initials: initialsOf(fallback), bg: avatarColour(fallback) });
    assert.equal(view.strip.source, BOARDS_PANEL_COPY.strip.live.source);
  }
});

test("signed out (false, missing, or truthy-but-not-true), even with a player: the Phase 66 strip plus avatar null", () => {
  for (const signedIn of [false, undefined, "true", 1]) {
    const view = boardsView({ board: "deep", scope: "all", entry: "tab", signedIn, player: LIVE_PLAYER });
    assert.deepStrictEqual(
      view.strip,
      {
        glyph: "?",
        avatar: null,
        label: "PLAY GAMES · SIGNED OUT",
        source: "Your dead only",
        scopes: [
          { id: "all", label: "ALL", on: true, dim: true },
          { id: "friends", label: "FRIENDS", on: false, dim: true },
        ],
      },
      `signedIn ${JSON.stringify(signedIn)}`
    );
    assert.deepStrictEqual(view.body, { kind: "note", line: BOARDS_PANEL_COPY.note.all });
  }
});

test("signed in: local still lists the player's own rows; all/friends never show local rows (Phase 68 reads the global snapshot)", () => {
  const rec = recordWith([makeSummary({ floor: 5 })]);
  const base = { bests: rec, graves: [], board: "deep", entry: "tab", signedIn: true, player: LIVE_PLAYER };
  assert.equal(boardsView({ ...base, scope: "local" }).body.kind, "rows");
  for (const scope of ["all", "friends"]) {
    for (const board of ["deep", "combo"]) {
      // no global input on a signed-in global view reads as unreachable, never as the local rows.
      assert.deepStrictEqual(boardsView({ ...base, board, scope }).body, { kind: "note", line: BOARDS_PANEL_COPY.global.unreachable });
    }
  }
});

test("GRAVEYARD: strip null and scope ignored, signed in or out", () => {
  const graves = [legacyStone({ floor: 1 })];
  for (const signedIn of [true, false]) {
    const view = boardsView({ bests: null, graves, board: "yard", scope: "friends", entry: "tab", signedIn, player: LIVE_PLAYER });
    assert.equal(view.strip, null);
    assert.equal(view.body.kind, "rows");
  }
});

test("signed in: header, rows, standing, footnote, rail, board and dock equal the signed-out view for the same data", () => {
  const runs = [];
  for (let i = 0; i < 12; i++) runs.push(makeSummary({ seed: i + 1, name: `Delver${i}`, floor: 1 + (i % 9), steps: 30 + i }));
  const rec = recordWith(runs);
  const graves = runs.map((r) => ({ ...r }));
  for (const board of BOARD_IDS) {
    for (const entry of ["tab", "title"]) {
      const common = { bests: rec, graves, total: 12, board, scope: "local", entry, hasHero: false, open: runs[0].hash };
      const { strip: _out, ...outRest } = boardsView({ ...common, signedIn: false });
      const { strip: _in, ...inRest } = boardsView({ ...common, signedIn: true, player: LIVE_PLAYER });
      assert.deepStrictEqual(inRest, outRest, `board ${board} entry ${entry}`);
    }
  }
});

test("signed in on the local scope: no view string mentions worldwide or among friends, on any board", () => {
  const rec = recordWith([makeSummary({ floor: 5 }), makeSummary({ seed: 2, floor: 3 })]);
  for (const board of BOARD_IDS) {
    for (const scope of ["local"]) {
      const view = boardsView({ bests: rec, graves: [], total: 2, board, scope, entry: "tab", signedIn: true, player: LIVE_PLAYER });
      for (const s of collectStrings(view)) {
        assert.doesNotMatch(s, /worldwide/i);
        assert.doesNotMatch(s, /among friends/i);
      }
    }
  }
});

test("Purity with a player: deep-frozen signed-in input is never mutated and two calls are deepStrictEqual", () => {
  const rec = deepFreeze(recordWith([makeSummary({ floor: 5 })]));
  const input = deepFreeze({
    bests: rec,
    graves: [],
    total: 1,
    board: "deep",
    scope: "all",
    entry: "tab",
    signedIn: true,
    player: { id: "p1", displayName: "Lanternjaw" },
  });
  let v1;
  assert.doesNotThrow(() => {
    v1 = boardsView(input);
  });
  assert.deepStrictEqual(boardsView(input), v1);
  assert.equal(input.player.displayName, "Lanternjaw");
});

// =============================================================================
// Phase 68 (PGS-05, PGS-06; D-05..D-09, D-16, D-17) — the global views
// =============================================================================

const G = BOARDS_PANEL_COPY.global;

/** gRun(overrides) — a decoded v1 score tag (the GlobalEntry.run shape 68-05 produces). */
function gRun(overrides = {}) {
  return decodeTag(
    encodeTag({
      race: "Dwarven",
      sub: "Pickpocket",
      level: 3,
      cause: "combat",
      floor: 7,
      day: 4,
      steps: 431,
      kills: 9,
      gold: 12345,
      sp: 77,
      name: "Brom Ironfoot",
      ...overrides,
    })
  );
}

/** gEntry(i, overrides, runOverrides) — a GlobalEntry at list index i (rank i + 1 unless overridden). */
function gEntry(i, overrides = {}, runOverrides = {}) {
  const run = Object.prototype.hasOwnProperty.call(overrides, "run") ? overrides.run : gRun(runOverrides);
  return {
    key: `g:p${i}:${i}`,
    rank: i + 1,
    handle: `Delver${i}`,
    playerId: `p${i}`,
    you: false,
    friend: false,
    rawScore: run ? boardScore("deep", run) : 0,
    run,
    ...overrides,
  };
}

/** snap(overrides) — a deep-frozen GlobalSnapshot (68-05's contract). */
function snap(overrides = {}) {
  return deepFreeze({
    status: "ready",
    board: "deep",
    scope: "all",
    season: 1,
    entries: [],
    you: null,
    total: null,
    sampled: null,
    stale: false,
    ...overrides,
  });
}

/** gView(overrides) — a signed-in ALL view on DEEPEST. */
function gView(overrides = {}) {
  return boardsView({ bests: null, graves: [], board: "deep", scope: "all", entry: "tab", signedIn: true, player: LIVE_PLAYER, ...overrides });
}

test("global ALL rows: handle headline with its initials avatar, FRIEND/YOU tags, decoded name and level line, value, stats, cause detail with no epitaph", () => {
  const e0 = gEntry(0, { handle: "Rival", friend: true });
  const e1 = gEntry(1, { handle: "Lanternjaw", you: true }, { floor: 6, name: "Pell Moss" });
  const e2 = gEntry(2, { handle: "Stranger" }, { floor: 5, cause: "starve" });
  const view = gView({ global: snap({ entries: [e0, e1, e2], you: { ...e1, key: "g:you" }, total: 3 }) });
  assert.equal(view.body.kind, "rows");
  const rows = view.body.rows;
  assert.equal(rows.length, 3, "the player already listed is not pinned again");
  assert.deepStrictEqual(rows[0], {
    key: e0.key,
    rank: "1",
    top: true,
    podium: true,
    you: false,
    divider: "",
    headline: "Rival",
    tag: "FRIEND",
    name: "Brom Ironfoot",
    line: "DWARVEN PICKPOCKET · LVL III",
    detail: "Cut down by a foe",
    val: "7",
    unit: "FLOOR",
    stats: [
      { k: "FLOOR", v: "7" },
      { k: "DAYS", v: "4" },
      { k: "SQUARES", v: "431" },
      { k: "KILLS", v: "9" },
      { k: "EXP", v: "77" },
      { k: "WILMST", v: "12,345" },
    ],
    barPct: 100,
    avatar: { initials: initialsOf("Rival"), bg: avatarColour("Rival") },
    open: false,
  });
  assert.equal(rows[1].tag, "YOU");
  assert.equal(rows[1].you, true);
  assert.equal(rows[1].name, "Pell Moss");
  assert.equal(rows[2].tag, "");
  assert.equal(rows[2].detail, "Starved in the dark");
  assert.equal(rows[2].podium, true);
  for (const row of rows) {
    assert.deepStrictEqual(Object.keys(row.avatar).sort(), ["bg", "initials"], "initials only, never a remote image");
    assert.doesNotMatch(row.detail, /promoted|stone/i);
  }
});

test("global ALL: the player's best outside the top ten is pinned last under the divider with the YOU tag", () => {
  const entries = [];
  for (let i = 0; i < 10; i++) entries.push(gEntry(i, {}, { floor: 20 - i }));
  const you = gEntry(56, { key: "g:you", handle: "Lanternjaw", you: true }, { floor: 4, name: "Pell Moss" });
  const view = gView({ global: snap({ entries, you, total: 9044 }) });
  const rows = view.body.rows;
  assert.equal(rows.length, 11);
  const pinned = rows[10];
  assert.equal(pinned.divider, BOARDS_PANEL_COPY.divider);
  assert.equal(pinned.divider, "NOT IN THE TOP TEN · YOUR BEST RUN");
  assert.equal(pinned.tag, "YOU");
  assert.equal(pinned.you, true);
  assert.equal(pinned.rank, "57");
  assert.equal(pinned.top, false);
  assert.equal(pinned.podium, false);
  assert.equal(pinned.headline, "Lanternjaw");
  for (const row of rows.slice(0, 10)) assert.equal(row.divider, "");
});

test("global rows: LEANEST shows 'floor · steps', PURSE groups digits, both decoded from the tag", () => {
  const e = gEntry(0, {}, { floor: 7, steps: 431, gold: 1234567 });
  const lean = gView({ board: "lean", global: snap({ board: "lean", entries: [e] }) }).body.rows[0];
  assert.equal(lean.val, "7 · 431");
  assert.equal(lean.unit, BOARD_COPY.lean.unitLabel);
  const purse = gView({ board: "purse", global: snap({ board: "purse", entries: [e] }) }).body.rows[0];
  assert.equal(purse.val, "999,999", "gold is capped by the tag's field cap");
  const days = gView({ board: "days", global: snap({ board: "days", entries: [e] }) }).body.rows[0];
  assert.equal(days.val, "4");
  assert.equal(days.unit, BOARD_COPY.days.unitLabel);
  const kills = gView({ board: "kills", global: snap({ board: "kills", entries: [e] }) }).body.rows[0];
  assert.equal(kills.val, "9");
});

test("global rows: a tag that does not decode gives a minimal row from the raw score (D-16)", () => {
  const cases = [
    { board: "deep", rawScore: boardScore("deep", { floor: 6, steps: 250 }), val: "6", unit: "FLOOR" },
    { board: "days", rawScore: boardScore("days", { day: 12, floor: 5 }), val: "12", unit: BOARD_COPY.days.unitLabel },
    { board: "kills", rawScore: boardScore("kills", { kills: 9, floor: 5 }), val: "9", unit: BOARD_COPY.kills.unitLabel },
    { board: "purse", rawScore: 1234567, val: "1,234,567", unit: BOARD_COPY.purse.unitLabel },
    { board: "lean", rawScore: 61571, val: "61.6", unit: G.leanRateUnit },
    { board: "deep", rawScore: -1, val: "—", unit: "FLOOR" },
    { board: "purse", rawScore: 1.5, val: "—", unit: BOARD_COPY.purse.unitLabel },
  ];
  for (const c of cases) {
    const e = gEntry(0, { handle: "Ghost", run: null, rawScore: c.rawScore });
    const row = gView({ board: c.board, global: snap({ board: c.board, entries: [e] }) }).body.rows[0];
    assert.equal(row.headline, "Ghost", c.board);
    assert.equal(row.val, c.val, `${c.board} ${c.rawScore}`);
    assert.equal(row.unit, c.unit, c.board);
    assert.equal(row.name, "");
    assert.equal(row.line, "");
    assert.equal(row.detail, "");
    assert.deepStrictEqual(row.stats, []);
  }
});

test("global rows: an empty handle reads as the nameless delver, avatar included", () => {
  const e = gEntry(0, { handle: "" });
  const row = gView({ global: snap({ entries: [e] }) }).body.rows[0];
  assert.equal(row.headline, G.anon);
  assert.deepStrictEqual(row.avatar, { initials: initialsOf(G.anon), bg: avatarColour(G.anon) });
});

test("global rows: bars follow the min-max rule over the rendered rows", () => {
  const entries = [gEntry(0, {}, { floor: 9 }), gEntry(1, {}, { floor: 7 }), gEntry(2, {}, { floor: 5 })];
  const rows = gView({ global: snap({ entries }) }).body.rows;
  assert.deepStrictEqual(rows.map((r) => r.barPct), [100, 50, 3]);
});

test("PGS-05 ordering: snapshot order is kept, the reported rank is shown (list position when missing), the pinned YOU row is last", () => {
  const entries = [gEntry(0, { rank: 4 }), gEntry(1, { rank: null }), gEntry(2, { rank: 9 }, { floor: 9 })];
  const you = gEntry(3, { key: "g:you", you: true, rank: 120 });
  const rows = gView({ global: snap({ entries, you }) }).body.rows;
  assert.deepStrictEqual(rows.map((r) => r.key), [entries[0].key, entries[1].key, entries[2].key, "g:you"]);
  assert.deepStrictEqual(rows.map((r) => r.rank), ["4", "2", "9", "120"]);
  assert.equal(rows[3].divider, BOARDS_PANEL_COPY.divider);
});

test("PGS-05 adjacency: two entries with equal values keep their snapshot order and both render", () => {
  const entries = [gEntry(0, { handle: "Second" }, { floor: 7 }), gEntry(1, { handle: "First" }, { floor: 7 })];
  const rows = gView({ global: snap({ entries }) }).body.rows;
  assert.deepStrictEqual(rows.map((r) => r.headline), ["Second", "First"]);
  assert.deepStrictEqual(rows.map((r) => r.barPct), [100, 100]);
});

test("global standing: the real rank with worldwide / among-friends counts and a banded quip", () => {
  const you = gEntry(2, { key: "g:you", you: true }, { name: "Brom Ironfoot" });
  const entries = [gEntry(0), gEntry(1), { ...you, key: "g:p2:2" }];
  const all = gView({ global: snap({ entries, you, total: 9044 }) }).standing;
  assert.equal(all.label, "BROM IRONFOOT · FLOOR");
  assert.equal(all.place, "3RD");
  assert.ok(all.note.startsWith("of 9,044 interred worldwide. "), all.note);
  assert.ok(GLOBAL_STANDING_LINES.ten.includes(all.note.slice("of 9,044 interred worldwide. ".length)), all.note);

  const friends = gView({ scope: "friends", global: snap({ scope: "friends", entries, you, total: 12 }) }).standing;
  assert.ok(friends.note.startsWith("of 12 among friends. "), friends.note);

  const noTotal = gView({ global: snap({ entries, you, total: null }) }).standing;
  assert.ok(noTotal.note.startsWith("of 3 interred worldwide. "), noTotal.note);

  const lean = gView({ board: "lean", global: snap({ board: "lean", entries, you, total: 50 }) }).standing;
  assert.equal(lean.label, "BROM IRONFOOT · " + BOARD_COPY.lean.unitLabel);

  const none = gView({ global: snap({ entries, you: null, total: 9044 }) }).standing;
  assert.deepStrictEqual(none, { label: "NO ENTRY", place: "—", note: G.noEntry });
});

test("global standing quip bands switch at ranks 1/2, 10/11 and 100/101, deterministically", () => {
  const bands = [
    [1, "first"],
    [2, "ten"],
    [10, "ten"],
    [11, "hundred"],
    [100, "hundred"],
    [101, "rest"],
    [5000, "rest"],
  ];
  for (const [rank, band] of bands) {
    const you = gEntry(0, { key: "g:you", you: true, rank });
    const input = { global: snap({ entries: [], you, total: 9044 }) };
    const standing = gView(input).standing;
    const quip = standing.note.slice("of 9,044 interred worldwide. ".length);
    assert.ok(GLOBAL_STANDING_LINES[band].includes(quip), `rank ${rank} -> ${quip}`);
    assert.equal(standing.place, ordinal(rank));
    assert.deepStrictEqual(gView(input).standing, standing);
  }
});

test("global status bodies: loading, unreachable, closed, consent and an empty board are in-panel, never blocking", () => {
  const loading = gView({ global: snap({ status: "loading" }) });
  assert.deepStrictEqual(loading.body, { kind: "note", line: G.loading });
  assert.equal(loading.standing, null);
  const unreachable = gView({ global: snap({ status: "unreachable" }) });
  assert.deepStrictEqual(unreachable.body, { kind: "note", line: G.unreachable });
  assert.equal(unreachable.standing, null);
  const closed = gView({ global: snap({ status: "closed" }) });
  assert.deepStrictEqual(closed.body, { kind: "note", line: G.closed });
  assert.equal(closed.standing, null);
  const consent = gView({ scope: "friends", global: snap({ status: "consent", scope: "friends" }) });
  assert.deepStrictEqual(consent.body, { kind: "consent", line: G.consent, action: { id: "friendsConsent", label: "SHOW MY FRIENDS" } });
  assert.equal(consent.standing, null);
  for (const v of [loading, unreachable, closed, consent]) assert.equal(v.footnote, BOARD_FOOTNOTES.ranked);
});

test("PGS-05 empty: a ready board with no entries shows the empty note and NO ENTRY, or the ranked card when the player has a score", () => {
  const empty = gView({ global: snap({ entries: [] }) });
  assert.deepStrictEqual(empty.body, { kind: "empty", line: G.empty });
  assert.deepStrictEqual(empty.standing, { label: "NO ENTRY", place: "—", note: G.noEntry });
  const you = gEntry(0, { key: "g:you", you: true, rank: 14 });
  const mine = gView({ global: snap({ entries: [], you, total: 40 }) });
  assert.equal(mine.body.kind, "empty");
  assert.equal(mine.standing.place, "14TH");
});

test("global: a stale ready snapshot renders its rows normally", () => {
  const view = gView({ global: snap({ entries: [gEntry(0)], stale: true }) });
  assert.equal(view.body.kind, "rows");
  assert.equal(view.body.rows.length, 1);
});

test("PGS-05 empty: a null, undefined or malformed global input on a signed-in global view reads as unreachable, never throws", () => {
  for (const global of [null, undefined, "ready", 7, [], {}, { status: "weird" }, { status: 3 }]) {
    let view;
    assert.doesNotThrow(() => {
      view = gView({ global });
    });
    assert.deepStrictEqual(view.body, { kind: "note", line: G.unreachable }, JSON.stringify(global));
    assert.equal(view.standing, null);
  }
  // A ready snapshot with a malformed entries list or junk entries still renders what it can.
  const junk = gView({ global: { status: "ready", entries: "nope", you: 5 } });
  assert.deepStrictEqual(junk.body, { kind: "empty", line: G.empty });
  const mixed = gView({ global: { status: "ready", entries: [null, 3, gEntry(0)], you: null } });
  assert.equal(mixed.body.rows.length, 1);
});

test("LINEAGE global: DEEPEST sample grouped by race and class, first entry kept, honest sampled footnote", () => {
  const entries = [
    gEntry(0, { handle: "Alpha" }, { race: "Dwarven", sub: "Pickpocket", floor: 9 }),
    gEntry(1, { handle: "Bravo" }, { race: "Human", sub: "Soldier", floor: 8 }),
    gEntry(2, { handle: "Charlie" }, { race: "Dwarven", sub: "Cutthroat", floor: 7 }),
    gEntry(3, { handle: "Delta", run: null, rawScore: 6000000 }),
    gEntry(4, { handle: "Echo" }, { race: "Gnome", sub: "Soldier", floor: 6 }),
  ];
  const you = gEntry(1, { key: "g:you", you: true }, { race: "Human", sub: "Soldier", floor: 8 });
  const view = gView({ board: "combo", global: snap({ board: "combo", entries, you, sampled: 5 }) });
  assert.equal(view.body.kind, "rows");
  const rows = view.body.rows;
  assert.deepStrictEqual(rows.map((r) => r.name), ["DWARVEN THIEF", "HUMAN FIGHTER"]);
  assert.deepStrictEqual(rows.map((r) => r.headline), ["Alpha", "Bravo"]);
  assert.deepStrictEqual(rows.map((r) => r.rank), ["1", "2"]);
  assert.equal(rows[0].line, "DWARVEN PICKPOCKET · LVL III");
  assert.equal(rows[0].val, "9");
  assert.equal(rows[0].unit, "FLOOR");
  assert.equal(view.footnote, "Sampled from the top 5 deepest corpses in the world. Rare lineages may be buried further down.");
  assert.equal(view.standing.place, "2ND");
  assert.equal(view.standing.label, "HUMAN FIGHTER · FLOOR");
  assert.ok(view.standing.note.startsWith("of 2 lineages in the sample. "), view.standing.note);
  assert.ok(GLOBAL_STANDING_LINES.ten.includes(view.standing.note.slice("of 2 lineages in the sample. ".length)));

  const absent = gView({
    board: "combo",
    global: snap({ board: "combo", entries, you: gEntry(9, { key: "g:you", you: true }, { race: "Troll", sub: "Wizard" }), sampled: 5 }),
  });
  assert.deepStrictEqual(absent.standing, { label: "NO ENTRY", place: "—", note: G.noEntry });
});

test("PGS-05 adjacency and empty: two LINEAGE entries of one race and class collapse to the first; an empty sample shows the empty note with n 0", () => {
  const entries = [
    gEntry(0, { handle: "Keep" }, { race: "Elven", sub: "Wizard", floor: 5 }),
    gEntry(1, { handle: "Drop" }, { race: "Elven", sub: "Warlock", floor: 5 }),
  ];
  const rows = gView({ board: "combo", global: snap({ board: "combo", entries, sampled: 2 }) }).body.rows;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].headline, "Keep");

  const empty = gView({ board: "combo", global: snap({ board: "combo", entries: [], sampled: 0 }) });
  assert.deepStrictEqual(empty.body, { kind: "empty", line: G.empty });
  assert.equal(empty.footnote, "Sampled from the top 0 deepest corpses in the world. Rare lineages may be buried further down.");
  assert.deepStrictEqual(empty.standing, { label: "NO ENTRY", place: "—", note: G.noEntry });
});

test("header season: 'SEASON n' on every view; the picker shows only with two seasons, signed in, on a global scope off GRAVEYARD", () => {
  assert.deepStrictEqual(boardsView({}).header.season, { label: "SEASON 1", picker: null });
  assert.deepStrictEqual(boardsView({ board: "yard" }).header.season, { label: "SEASON 1", picker: null });
  assert.deepStrictEqual(gView({ seasons: [1] }).header.season, { label: "SEASON 1", picker: null });
  assert.deepStrictEqual(gView({ season: 2, seasons: [1, 2] }).header.season, {
    label: "SEASON 2",
    picker: [
      { n: 1, label: "SEASON 1", on: false },
      { n: 2, label: "SEASON 2", on: true },
    ],
  });
  assert.equal(gView({ season: 2, seasons: [1, 2], board: "yard" }).header.season.picker, null);
  assert.equal(gView({ season: 2, seasons: [1, 2], scope: "local" }).header.season.picker, null);
  assert.equal(gView({ season: 2, seasons: [1, 2], signedIn: false }).header.season.picker, null);
  // a malformed season or seasons input falls back to season 1 / [season].
  assert.deepStrictEqual(gView({ season: -3, seasons: "x" }).header.season, { label: "SEASON 1", picker: null });
  assert.deepStrictEqual(gView({ season: 3 }).header.season, { label: "SEASON 3", picker: null });
});

test("header scope line: signed in, ALL and FRIENDS name the global scopes; otherwise the Phase 66 lines", () => {
  assert.equal(gView({}).header.scopeLine, G.scope.all);
  assert.equal(gView({ scope: "friends" }).header.scopeLine, G.scope.friends);
  assert.equal(gView({ scope: "local" }).header.scopeLine, BOARDS_PANEL_COPY.scope.ranked);
  assert.equal(gView({ board: "yard" }).header.scopeLine, BOARDS_PANEL_COPY.scope.yard);
  assert.equal(gView({ signedIn: false }).header.scopeLine, BOARDS_PANEL_COPY.scope.ranked);
});

test("signed out (D-07): any global input is ignored — the view equals the no-global view, with the Phase 66 notes", () => {
  const rec = recordWith([makeSummary({ floor: 5 })]);
  const global = snap({ entries: [gEntry(0)], you: gEntry(0, { key: "g:you", you: true }), total: 9 });
  for (const board of BOARD_IDS) {
    for (const scope of ["local", "all", "friends"]) {
      const common = { bests: rec, graves: [], total: 1, board, scope, entry: "tab" };
      assert.deepStrictEqual(boardsView({ ...common, global, season: 2, seasons: [1, 2] }), boardsView({ ...common, season: 2, seasons: [1, 2] }), `${board} ${scope}`);
    }
  }
  assert.deepStrictEqual(boardsView({ board: "deep", scope: "all", global }).body, { kind: "note", line: BOARDS_PANEL_COPY.note.all });
  assert.deepStrictEqual(boardsView({ board: "deep", scope: "friends", global }).body, { kind: "note", line: BOARDS_PANEL_COPY.note.friends });
});

test("GRAVEYARD stays local in every state (D-17): signed in with a global snapshot on ALL, it lists the stones", () => {
  const graves = [legacyStone({ floor: 1 })];
  const view = gView({ board: "yard", graves, global: snap({ entries: [gEntry(0)] }) });
  assert.equal(view.body.kind, "rows");
  assert.equal(view.body.rows[0].headline, "Old One");
  assert.equal(view.standing.label, "INTERRED");
  assert.equal(view.footnote, BOARD_FOOTNOTES.yard);
});

test("Purity with a global snapshot: deep-frozen input is never mutated and two calls are deepStrictEqual", () => {
  const you = gEntry(12, { key: "g:you", you: true });
  const input = deepFreeze({
    board: "deep",
    scope: "all",
    entry: "tab",
    signedIn: true,
    player: { id: "p1", displayName: "Lanternjaw" },
    global: snap({ entries: [gEntry(0), gEntry(1)], you, total: 100 }),
    season: 1,
    seasons: [1],
  });
  let v1;
  assert.doesNotThrow(() => {
    v1 = boardsView(input);
  });
  assert.deepStrictEqual(boardsView(input), v1);
  const combo = deepFreeze({ ...input, board: "combo", global: snap({ board: "combo", entries: [gEntry(0), gEntry(1)], sampled: 2 }) });
  assert.deepStrictEqual(boardsView(combo), boardsView(combo));
});

test("source pins: the retired coming-online notes are gone and the minimal row goes through scoreFallback", () => {
  assert.doesNotMatch(STRIPPED, /note\.live/);
  assert.match(STRIPPED, /function buildGlobalRows/);
  assert.match(STRIPPED, /scoreFallback\(/);
  assert.doesNotMatch(STRIPPED, /globalBoards/);
});
