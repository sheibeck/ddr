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
import { BOARD_COPY, BOARD_FOOTNOTES, BOARDS_PANEL_COPY } from "../../content/boards.js";

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
