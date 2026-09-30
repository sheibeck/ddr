// test/unit/leaderboardView.test.js
//
// Phase 84 (BOARD-18..25, BOARD-27), Plan 05. Covers
// src/browser/leaderboardView.js: Task 1's shared pieces (ported avatar/
// initials/ordinal helpers, handleInitials) and the YOUR DEAD view (mine
// mode) — ranking, filters, counts, rows, the expanded row's date line,
// sheets, header box and dock. Task 2 covers LEADERBOARD (board mode) —
// every board state, board rows, YOU, the pinned best, the standing card,
// the season line, the stale line's age phrases and its sheets. Purity
// (source pins) closes both tasks.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { stripJs } from "../../tools/ident-sweep.mjs";
import {
  leaderboardView,
  handleInitials,
  initialsOf,
  avatarColour,
  ordinal,
  AVATAR_PALETTE,
} from "../../src/browser/leaderboardView.js";
import { LEADERBOARD_COPY } from "../../content/boards.js";
import { SEASON, SEASON_NAMES } from "../../content/season.js";
import { rankKeyOf } from "../../src/browser/runDoc.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const MODULE_PATH = path.join(REPO_ROOT, "src", "browser", "leaderboardView.js");
const MODULE_SRC = fs.readFileSync(MODULE_PATH, "utf8").replace(/\r\n/g, "\n");
const STRIPPED = stripJs(MODULE_SRC);

const C = LEADERBOARD_COPY;

// ─── fixtures ────────────────────────────────────────────────────────────

function historyRun(overrides = {}) {
  return {
    hash: "00000001",
    name: "Hilda Ferrow",
    race: "Human",
    cls: "Fighter",
    sub: "Knight",
    level: 1,
    floor: 5,
    day: 3,
    steps: 500,
    kills: 10,
    gold: 100,
    sp: 50,
    cause: "combat",
    note: "cut down by a Rat King",
    epitaph: "Two floors, one rat, no prayers answered.",
    when: Date.UTC(2026, 8, 28, 20, 0),
    version: "2.1.0 (11)",
    season: SEASON,
    ...overrides,
  };
}

function boardDoc(overrides = {}) {
  return {
    id: "doc1",
    uid: "uid1",
    handle: "@lanternjaw",
    name: "Hilda Ferrow",
    race: "Human",
    sub: "Knight",
    cls: "Fighter",
    level: 1,
    floor: 5,
    day: 3,
    steps: 500,
    kills: 10,
    gold: 100,
    sp: 50,
    cause: "combat",
    note: "cut down by a Werebeast",
    epitaph: "An epitaph.",
    when: Date.UTC(2026, 8, 28, 20, 0),
    version: "2.1.0 (11)",
    createdAt: "2026-09-28T20:00:00.000Z",
    ...overrides,
  };
}

function makeHistory(n, mapFn) {
  return Array.from({ length: n }, (_, i) => mapFn(i));
}

// ─── ported helpers ──────────────────────────────────────────────────────

test("AVATAR_PALETTE has six mock colours; avatarColour/initialsOf/ordinal match the mock formulas", () => {
  assert.equal(AVATAR_PALETTE.length, 6);
  assert.ok(AVATAR_PALETTE.includes(avatarColour("@lanternjaw")));
  assert.equal(initialsOf("@quenchless"), "QU");
  assert.equal(initialsOf(""), "?");
  assert.equal(ordinal(1), "1ST");
  assert.equal(ordinal(2), "2ND");
  assert.equal(ordinal(3), "3RD");
  assert.equal(ordinal(4), "4TH");
  assert.equal(ordinal(11), "11TH");
  assert.equal(ordinal(21), "21ST");
});

test("avatarColour is deterministic and non-throwing on non-string keys", () => {
  assert.equal(avatarColour("@lanternjaw"), avatarColour("@lanternjaw"));
  assert.doesNotThrow(() => avatarColour(null));
  assert.doesNotThrow(() => avatarColour(undefined));
  assert.doesNotThrow(() => avatarColour(42));
});

test("handleInitials: one initial per handle word, falls back on a non-splitting handle, '' -> '?'", () => {
  assert.equal(handleInitials("@lanternjaw"), "LJ");
  assert.equal(handleInitials("@gravepouch"), "GP");
  assert.equal(handleInitials(""), "?");
  assert.equal(handleInitials("@zzzzz"), "ZZ"); // no known split -> first two letters
  assert.doesNotThrow(() => handleInitials(null));
  assert.doesNotThrow(() => handleInitials(undefined));
});

// ─── Task 1: YOUR DEAD (mine mode) ────────────────────────────────────────

test("mine mode, Compete OFF: title/scope/box/back/seasonLine", () => {
  const history = makeHistory(3, (i) => historyRun({ hash: (i + 1).toString(16).padStart(8, "0") }));
  const view = leaderboardView({ compete: false, mode: "board", entry: "tab", history });
  assert.equal(view.mode, "mine");
  assert.equal(view.header.title, C.title.mine);
  assert.equal(view.header.scopeLine, C.scope.off);
  assert.deepEqual(view.header.box, { n: "3", label: C.box.interred, action: null });
  assert.equal(view.header.back, false);
  assert.equal(view.header.seasonLine, "");
  assert.equal(view.header.backLabel, C.back);
});

test("mine mode, Compete ON: scope/back true; box EVERYONE from the board total (known and unknown)", () => {
  const history = makeHistory(2, (i) => historyRun({ hash: (i + 1).toString(16).padStart(8, "0") }));
  const withBoard = leaderboardView({
    compete: true,
    mode: "mine",
    entry: "tab",
    history,
    board: { status: "ready", total: 1234, rows: [], you: null, youKnown: true, uid: null, stale: false, fetchedAt: null, filteredTotal: 1234 },
  });
  assert.equal(withBoard.header.scopeLine, C.scope.mine);
  assert.equal(withBoard.header.back, true);
  assert.deepEqual(withBoard.header.box, { n: (1234).toLocaleString("en-US"), label: C.box.everyone, action: "board" });

  const withoutBoard = leaderboardView({ compete: true, mode: "mine", entry: "tab", history, board: null });
  assert.deepEqual(withoutBoard.header.box, { n: C.box.unknown, label: C.box.everyone, action: "board" });
  assert.equal(withoutBoard.header.back, true, "back is true whenever Compete is on in mine mode, regardless of entry");
});

test("mine mode: entry normalises to 'tab' for anything but 'title'", () => {
  assert.equal(leaderboardView({ entry: "title" }).entry, "title");
  assert.equal(leaderboardView({ entry: "tab" }).entry, "tab");
  assert.equal(leaderboardView({ entry: "bogus" }).entry, "tab");
  assert.equal(leaderboardView({}).entry, "tab");
});

test("pickers: RANK BY shows the stat label+colour; RACE/SUB-CLASS show ANY (inactive) or the upper-cased choice (active)", () => {
  const view = leaderboardView({ stat: "kills", race: "Troll", sub: null });
  assert.deepEqual(view.pickers[0], { id: "stat", label: C.pick.stat, value: C.stats.kills.label, col: C.stats.kills.col, active: true });
  assert.deepEqual(view.pickers[1], { id: "race", label: C.pick.race, value: "TROLL", active: true });
  assert.deepEqual(view.pickers[2], { id: "sub", label: C.pick.sub, value: C.pick.any, active: false });
  assert.equal(view.col, C.stats.kills.col);
});

test("mode/stat/race/sub fall back on bad input; unknown race/sub ids read as null", () => {
  const view = leaderboardView({ compete: true, mode: "bogus", stat: "bogus", race: "Nonsense", sub: "Nonsense" });
  assert.equal(view.mode, "mine");
  assert.equal(view.stat, "deep");
  assert.equal(view.pickers[1].value, C.pick.any);
  assert.equal(view.pickers[2].value, C.pick.any);
});

test("YOUR DEAD ranking: DEPTH (floor desc, more steps; Phase 87 BOARD-28), DAYS (capped), KILLS, WILMST — rank strings, top/podium, no you/tag", () => {
  const history = [
    historyRun({ hash: "0000000a", name: "A", floor: 6, steps: 100, day: 20, kills: 1, gold: 10 }),
    historyRun({ hash: "0000000b", name: "B", floor: 6, steps: 50, day: 5, kills: 20, gold: 20 }),
    historyRun({ hash: "0000000c", name: "C", floor: 1, steps: 10, day: 50, kills: 5, gold: 5000 }),
  ];
  const deep = leaderboardView({ stat: "deep", history });
  assert.deepEqual(
    deep.body.rows.map((r) => r.headline),
    ["A", "B", "C"] // floor 6/steps 100 beats floor 6/steps 50 beats floor 1
  );
  assert.equal(deep.body.rows[0].rank, "1");
  assert.equal(deep.body.rows[0].top, true);
  assert.equal(deep.body.rows[0].podium, true);
  assert.equal(deep.body.rows[0].you, false);
  assert.equal(deep.body.rows[0].tag, "");
  assert.equal(deep.body.rows[0].divider, "");

  // DAYS anti-farming cap: A (floor 6, day 20, capped 20 -> key 20006) beats
  // C (floor 1, day 50, capped to 10*1=10 -> key 10001), which beats
  // B (floor 6, day 5, capped 5 -> key 5006) — C's own uncapped day count
  // (50) would otherwise have topped every other run.
  const days = leaderboardView({ stat: "days", history });
  assert.equal(rankKeyOf("days", history[2]), 10 * 1000 + 1); // min(50, 10*1) = 10
  assert.deepEqual(
    days.body.rows.map((r) => r.headline),
    ["A", "C", "B"]
  );

  const kills = leaderboardView({ stat: "kills", history });
  assert.equal(kills.body.rows[0].headline, "B");

  const purse = leaderboardView({ stat: "purse", history });
  assert.equal(purse.body.rows[0].headline, "C");
});

test("YOUR DEAD ranking ties: earlier `when` then hash ascending", () => {
  const history = [
    historyRun({ hash: "0000000b", name: "Later", floor: 5, steps: 100, when: 2000 }),
    historyRun({ hash: "0000000a", name: "Earlier", floor: 5, steps: 100, when: 1000 }),
  ];
  const view = leaderboardView({ stat: "deep", history });
  assert.deepEqual(view.body.rows.map((r) => r.headline), ["Earlier", "Later"]);
});

test("YOUR DEAD row shape: headline/avatar/line/val/unit; ties by hash break a `when` tie", () => {
  const run = historyRun({ hash: "00000001", name: "Hilda Ferrow", race: "Dwarven", sub: "Pickpocket", level: 1, floor: 1, steps: 118 });
  const view = leaderboardView({ stat: "deep", history: [run] });
  const row = view.body.rows[0];
  assert.equal(row.headline, "Hilda Ferrow");
  assert.deepEqual(row.avatar, { initials: initialsOf("Hilda Ferrow"), bg: avatarColour("Hilda Ferrow"), on: false });
  assert.equal(row.line, `DWARVEN PICKPOCKET${C.sep}I`);
  assert.equal(row.val, `1${C.sep}118`);
  assert.equal(row.unit, C.stats.deep.unit);
});

test("YOUR DEAD row: level 6 renders as its number, not a ROMAN numeral", () => {
  const run = historyRun({ level: 6 });
  const view = leaderboardView({ history: [run] });
  assert.match(view.body.rows[0].line, /· 6$/);
});

test("open row: detail from note + epitaph, six chips, dateLine 'Died 28 Sep 2026 · 2.1.0 (11)'; tz shifts the day", () => {
  const run = historyRun({
    hash: "00000001",
    note: "cut down by a Werebeast",
    epitaph: "The stone reads exactly this.",
    when: Date.UTC(2026, 8, 28, 20, 0),
    version: "2.1.0 (11)",
  });
  const view = leaderboardView({ history: [run], open: "00000001", tzOffsetMinutes: 0 });
  const row = view.body.rows[0];
  assert.equal(row.open, true);
  assert.equal(row.detail, "Cut down by a Werebeast. The stone reads exactly this.");
  assert.equal(row.dateLine, `Died 28 Sep 2026${C.sep}2.1.0 (11)`);
  assert.deepEqual(
    row.stats.map((s) => s.k),
    [C.chips.floor, C.chips.days, C.chips.squares, C.chips.kills, C.chips.exp, C.chips.wilmst]
  );

  // A doc without note falls back to the cause text with the generic foe.
  const noNote = historyRun({ hash: "00000002", note: "", cause: "combat" });
  const view2 = leaderboardView({ history: [noNote] });
  assert.equal(view2.body.rows[0].detail, `Cut down by a ${C.foe}. ${noNote.epitaph}`);

  // 03:00 UTC minus a 300-minute (5h) offset moves the date to the previous day.
  const earlyRun = historyRun({ hash: "00000003", when: Date.UTC(2026, 8, 28, 3, 0) });
  const shifted = leaderboardView({ history: [earlyRun], tzOffsetMinutes: 300 });
  assert.match(shifted.body.rows[0].dateLine, /^Died 27 Sep 2026/);

  const noTime = historyRun({ hash: "00000004", when: NaN });
  // historyRecordOf would never produce this, but the view must still degrade.
  const untimedView = leaderboardView({ history: [{ ...noTime }] });
  assert.equal(untimedView.body.rows[0].dateLine, "");
});

test("RACE filter with no matching runs -> empty w/ CLEAR FILTERS; unfiltered empty history -> mineAll note, no clear", () => {
  const history = [historyRun({ hash: "00000001", race: "Human", sub: "Knight" })];
  const filtered = leaderboardView({ history, race: "Troll", sub: "Ninja" });
  assert.equal(filtered.body.kind, "empty");
  assert.equal(filtered.body.title, C.empty.title);
  assert.equal(filtered.body.note, "You haven’t lost a hero as Troll, Ninja.");
  assert.deepEqual(filtered.body.clear, { id: "clearFilters", label: C.empty.clear });

  const empty = leaderboardView({ history: [] });
  assert.equal(empty.body.kind, "empty");
  assert.equal(empty.body.note, C.empty.mineAll);
  assert.equal(empty.body.clear, null);
});

test("race sheet (mine): 7 options, counted+dimmed, sub-lines Every race / Any sub-class / as {sub}", () => {
  const history = [
    historyRun({ hash: "00000001", race: "Troll", sub: "Ninja" }),
    historyRun({ hash: "00000002", race: "Troll", sub: "Ninja" }),
    historyRun({ hash: "00000003", race: "Human", sub: "Knight" }),
  ];
  const noSubFilter = leaderboardView({ history, sheet: "race", race: "Troll", sub: null });
  const sheet = noSubFilter.sheet;
  assert.equal(sheet.id, "race");
  assert.equal(sheet.title, C.pick.race);
  assert.equal(sheet.done, C.sheet.done);
  assert.equal(sheet.opts.length, 7);
  const any = sheet.opts[0];
  assert.deepEqual(any, { value: null, label: C.sheet.anyRace, sub: C.sheet.everyRace, n: "3", dim: false, on: false, col: "" });
  const troll = sheet.opts.find((o) => o.value === "Troll");
  assert.deepEqual(troll, { value: "Troll", label: "TROLL", sub: C.sheet.anySubLine, n: "2", dim: false, on: true, col: "" });
  const elven = sheet.opts.find((o) => o.value === "Elven");
  assert.equal(elven.n, "0");
  assert.equal(elven.dim, true);

  const withSubFilter = leaderboardView({ history, sheet: "race", race: null, sub: "Ninja" });
  const trollWithSub = withSubFilter.sheet.opts.find((o) => o.value === "Troll");
  assert.equal(trollWithSub.sub, "as Ninja");
  assert.equal(trollWithSub.n, "2");
});

test("sub-class sheet (mine): 25 options, sub-lines Class / Class · Race, counts under the current race", () => {
  const history = [
    historyRun({ hash: "00000001", race: "Troll", sub: "Ninja" }),
    historyRun({ hash: "00000002", race: "Human", sub: "Ninja" }),
  ];
  const view = leaderboardView({ history, sheet: "sub", race: null, sub: null });
  const sheet = view.sheet;
  assert.equal(sheet.id, "sub");
  assert.equal(sheet.opts.length, 25);
  const any = sheet.opts[0];
  assert.deepEqual(any, { value: null, label: C.sheet.anySub, sub: C.sheet.everySub, n: "2", dim: false, on: true, col: "" });
  const ninja = sheet.opts.find((o) => o.value === "Ninja");
  assert.equal(ninja.label, "NINJA");
  assert.equal(ninja.sub, "Thief");
  assert.equal(ninja.n, "2");
  assert.equal(ninja.dim, false);
  const wizard = sheet.opts.find((o) => o.value === "Wizard");
  assert.equal(wizard.n, "0");
  assert.equal(wizard.dim, true);

  const withRace = leaderboardView({ history, sheet: "sub", race: "Troll", sub: null });
  const ninjaWithRace = withRace.sheet.opts.find((o) => o.value === "Ninja");
  assert.equal(ninjaWithRace.sub, "Thief · Troll");
  assert.equal(ninjaWithRace.n, "1");
});

test("stat sheet: 4 options, each with the stat's rule as the sub-line, n '', col set", () => {
  const view = leaderboardView({ sheet: "stat", stat: "days" });
  const sheet = view.sheet;
  assert.equal(sheet.id, "stat");
  assert.equal(sheet.opts.length, 4);
  for (const opt of sheet.opts) {
    assert.equal(opt.n, "");
    assert.equal(opt.col, C.stats[opt.value].col);
    assert.equal(opt.sub, C.stats[opt.value].rule);
    assert.equal(opt.dim, false);
  }
  const daysOpt = sheet.opts.find((o) => o.value === "days");
  assert.equal(daysOpt.on, true);
});

test("no sheet is open -> sheet is null", () => {
  assert.equal(leaderboardView({ sheet: null }).sheet, null);
  assert.equal(leaderboardView({ sheet: "bogus" }).sheet, null);
  assert.equal(leaderboardView({}).sheet, null);
});

test("dock: tab+dead -> FINAL SHEET/BURY THEM; title+no hero -> BACK TO TITLE/ROLL A NEW HERO; title+hero -> BACK TO THE DUNGEON; tab+alive -> null", () => {
  assert.deepEqual(leaderboardView({ entry: "tab", dead: true }).dock, [
    { id: "finalSheet", label: C.dock.finalSheet, primary: false },
    { id: "bury", label: C.dock.bury, primary: true },
  ]);
  assert.deepEqual(leaderboardView({ entry: "title", hasHero: false }).dock, [
    { id: "title", label: C.dock.title, primary: false },
    { id: "roll", label: C.dock.roll, primary: true },
  ]);
  assert.deepEqual(leaderboardView({ entry: "title", hasHero: true }).dock, [{ id: "dungeon", label: C.dock.dungeon, primary: true }]);
  assert.equal(leaderboardView({ entry: "tab", dead: false }).dock, null);
});

test("mine mode never carries a standing card", () => {
  const history = [historyRun({ hash: "00000001" })];
  assert.equal(leaderboardView({ history }).standing, null);
  assert.equal(leaderboardView({ history: [] }).standing, null);
});

// ─── Task 2: LEADERBOARD (board mode) ─────────────────────────────────────

test("board mode, loading (null or {status:'loading'}): note body, season line, standing null, staleLine ''", () => {
  const forNull = leaderboardView({ compete: true, mode: "board", board: null, season: 1 });
  assert.equal(forNull.mode, "board");
  assert.equal(forNull.header.title, C.title.board);
  assert.equal(forNull.header.scopeLine, C.scope.board);
  assert.equal(forNull.header.seasonLine, "SEASON OF THE ALPHA");
  assert.deepEqual(forNull.body, { kind: "note", line: C.state.loading, action: null });
  assert.equal(forNull.standing, null);
  assert.equal(forNull.staleLine, "");

  const forLoading = leaderboardView({ compete: true, mode: "board", board: { status: "loading" }, season: 1 });
  assert.deepEqual(forLoading.body, { kind: "note", line: C.state.loading, action: null });

  const unnamedSeason = leaderboardView({ compete: true, mode: "board", board: null, season: 2 });
  assert.equal(unnamedSeason.header.seasonLine, "SEASON 2");
});

test("board mode, status unreachable/off: note body with SEE YOUR DEAD, standing null", () => {
  for (const status of ["unreachable", "off"]) {
    const view = leaderboardView({ compete: true, mode: "board", board: { status } });
    assert.deepEqual(view.body, { kind: "note", line: C.state.unreachable, action: { id: "seeMine", label: C.state.seeMine } });
    assert.equal(view.standing, null);
  }
});

test("board mode, ready with ten rows: server order, keys=doc ids, YOU tag/avatar-on, top", () => {
  const docs = Array.from({ length: 10 }, (_, i) =>
    boardDoc({ id: `d${i}`, uid: i === 3 ? "me" : `other${i}`, handle: i === 3 ? "@lanternjaw" : `@other${i}gloom`, name: `Hero${i}` })
  );
  const board = { status: "ready", rows: docs, total: 10, filteredTotal: 10, you: null, youKnown: true, uid: "me", stale: false, fetchedAt: null };
  const view = leaderboardView({ compete: true, mode: "board", board, stat: "deep" });
  assert.equal(view.body.kind, "rows");
  assert.equal(view.body.rows.length, 10);
  assert.deepEqual(view.body.rows.map((r) => r.key), docs.map((d) => d.id));
  assert.equal(view.body.rows[0].top, true);
  assert.equal(view.body.rows[0].podium, true);
  const meRow = view.body.rows[3];
  assert.equal(meRow.you, true);
  assert.equal(meRow.tag, C.you);
  assert.equal(meRow.avatar.on, true);
  assert.equal(meRow.headline, "@lanternjaw");
  assert.equal(meRow.avatar.initials, "LJ");
  assert.equal(meRow.line, `HERO3${C.sep}HUMAN KNIGHT${C.sep}I`);
  const otherRow = view.body.rows[0];
  assert.equal(otherRow.you, false);
  assert.equal(otherRow.tag, "");
  assert.equal(otherRow.avatar.on, false);
});

test("board mode header box: YOURS with the history count; back false on tab entry, true on title entry", () => {
  const history = [historyRun({ hash: "00000001" }), historyRun({ hash: "00000002" })];
  const board = { status: "ready", rows: [], total: 0, filteredTotal: 0, you: null, youKnown: true, uid: null, stale: false, fetchedAt: null };
  const tabView = leaderboardView({ compete: true, mode: "board", entry: "tab", history, board });
  assert.deepEqual(tabView.header.box, { n: "2", label: C.box.yours, action: "mine" });
  assert.equal(tabView.header.back, false);
  const titleView = leaderboardView({ compete: true, mode: "board", entry: "title", history, board });
  assert.equal(titleView.header.back, true);
});

test("pinned best: not listed -> eleventh divider row with the real rank; listed -> no extra row", () => {
  const docs = Array.from({ length: 3 }, (_, i) => boardDoc({ id: `d${i}`, uid: `other${i}`, handle: `@other${i}gloom` }));
  const yourRun = boardDoc({ id: "mine", uid: "me", handle: "@lanternjaw", name: "My Hero" });
  const notListedBoard = {
    status: "ready", rows: docs, total: 40, filteredTotal: 40,
    you: { id: "mine", rank: 37, listed: false, run: yourRun },
    youKnown: true, uid: "me", stale: false, fetchedAt: null,
  };
  const view = leaderboardView({ compete: true, mode: "board", board: notListedBoard });
  assert.equal(view.body.rows.length, 4);
  const pinned = view.body.rows[3];
  assert.equal(pinned.divider, C.divider);
  assert.equal(pinned.rank, "37");
  assert.equal(pinned.you, true);
  assert.equal(pinned.top, false);
  assert.equal(pinned.key, "mine");

  const listedBoard = {
    ...notListedBoard,
    you: { id: "d1", rank: 2, listed: true, run: docs[1] },
  };
  const view2 = leaderboardView({ compete: true, mode: "board", board: listedBoard });
  assert.equal(view2.body.rows.length, 3);
});

test("standing card: real rank/note; None of yours yet; youKnown false -> null; zero rows -> null", () => {
  const yourRun = boardDoc({ id: "mine", uid: "me", handle: "@lanternjaw" });
  const withYou = {
    status: "ready", rows: [boardDoc({ id: "d0" })], total: 5000, filteredTotal: 1234,
    you: { id: "mine", rank: 4, listed: false, run: yourRun },
    youKnown: true, uid: "me", stale: false, fetchedAt: null,
  };
  const view = leaderboardView({ compete: true, mode: "board", board: withYou, race: "Troll", sub: null });
  assert.deepEqual(view.standing, { place: "4TH", note: "@lanternjaw’s best, of 1,234 interred as Troll, any sub-class." });

  const noYou = { ...withYou, you: null };
  const view2 = leaderboardView({ compete: true, mode: "board", board: noYou });
  assert.deepEqual(view2.standing, { place: C.standing.noPlace, note: C.standing.none });

  const unknown = { ...withYou, youKnown: false };
  const view3 = leaderboardView({ compete: true, mode: "board", board: unknown });
  assert.equal(view3.standing, null);

  const zeroRows = { ...withYou, rows: [] };
  const view4 = leaderboardView({ compete: true, mode: "board", board: zeroRows });
  assert.equal(view4.standing, null);
});

test("zero rows: filtered -> empty note + CLEAR FILTERS; unfiltered -> boardAll note, no clear", () => {
  const board = { status: "ready", rows: [], total: 0, filteredTotal: 0, you: null, youKnown: true, uid: null, stale: false, fetchedAt: null };
  const filtered = leaderboardView({ compete: true, mode: "board", board, race: "Troll", sub: "Ninja" });
  assert.equal(filtered.body.kind, "empty");
  assert.equal(filtered.body.note, "Nobody has died as Troll, Ninja.");
  assert.deepEqual(filtered.body.clear, { id: "clearFilters", label: C.empty.clear });

  const unfiltered = leaderboardView({ compete: true, mode: "board", board });
  assert.equal(unfiltered.body.note, C.empty.boardAll);
  assert.equal(unfiltered.body.clear, null);
});

test("stale line: age phrases at 30s/1min/12min/90min/3h", () => {
  const now = 10_000_000_000;
  const boardAt = (agoMs) => ({
    status: "ready", rows: [boardDoc()], total: 1, filteredTotal: 1, you: null, youKnown: true, uid: null,
    stale: true, fetchedAt: now - agoMs,
  });
  assert.equal(leaderboardView({ compete: true, mode: "board", board: boardAt(30_000), now }).staleLine, fill(C.state.stale, { age: C.state.ageMoment }));
  assert.equal(leaderboardView({ compete: true, mode: "board", board: boardAt(60_000), now }).staleLine, fill(C.state.stale, { age: C.state.ageMinute }));
  assert.equal(leaderboardView({ compete: true, mode: "board", board: boardAt(12 * 60_000), now }).staleLine, fill(C.state.stale, { age: fill(C.state.ageMinutes, { n: 12 }) }));
  assert.equal(leaderboardView({ compete: true, mode: "board", board: boardAt(90 * 60_000), now }).staleLine, fill(C.state.stale, { age: C.state.ageHour }));
  assert.equal(leaderboardView({ compete: true, mode: "board", board: boardAt(3 * 3600_000), now }).staleLine, fill(C.state.stale, { age: fill(C.state.ageHours, { n: 3 }) }));

  function fill(template, vars) {
    return String(template).replace(/\{(\w+)\}/g, (_, k) => String(vars[k]));
  }
});

test("stale is false, or now is missing -> staleLine ''", () => {
  const board = { status: "ready", rows: [boardDoc()], total: 1, filteredTotal: 1, you: null, youKnown: true, uid: null, stale: false, fetchedAt: 100 };
  assert.equal(leaderboardView({ compete: true, mode: "board", board, now: 200 }).staleLine, "");
  const staleNoNow = { ...board, stale: true, fetchedAt: 100 };
  assert.equal(leaderboardView({ compete: true, mode: "board", board: staleNoNow }).staleLine, "");
});

test("board row detail: note used when present; cause fallback with the generic foe otherwise; dateLine uses when else createdAt", () => {
  const withNote = boardDoc({ note: "cut down by a Werebeast", epitaph: "Epitaph text." });
  const board = { status: "ready", rows: [withNote], total: 1, filteredTotal: 1, you: null, youKnown: true, uid: null, stale: false, fetchedAt: null };
  const view = leaderboardView({ compete: true, mode: "board", board });
  assert.equal(view.body.rows[0].detail, "Cut down by a Werebeast. Epitaph text.");

  const noNote = boardDoc({ note: "", cause: "combat", epitaph: "Epitaph text." });
  const board2 = { ...board, rows: [noNote] };
  const view2 = leaderboardView({ compete: true, mode: "board", board: board2 });
  assert.equal(view2.body.rows[0].detail, `Cut down by a ${C.foe}. Epitaph text.`);

  const noWhen = boardDoc({ when: undefined, createdAt: "2026-09-28T20:00:00.000Z", version: "2.1.0 (11)" });
  delete noWhen.when;
  const board3 = { ...board, rows: [noWhen] };
  const view3 = leaderboardView({ compete: true, mode: "board", board: board3, tzOffsetMinutes: 0 });
  assert.equal(view3.body.rows[0].dateLine, `Died 28 Sep 2026${C.sep}2.1.0 (11)`);
});

test("board sheets: race/sub-class options carry n '' and dim false; stat sheet matches mine mode", () => {
  const view = leaderboardView({ compete: true, mode: "board", sheet: "race" });
  for (const o of view.sheet.opts) {
    assert.equal(o.n, "");
    assert.equal(o.dim, false);
  }
  const subView = leaderboardView({ compete: true, mode: "board", sheet: "sub" });
  for (const o of subView.sheet.opts) {
    assert.equal(o.n, "");
    assert.equal(o.dim, false);
  }
  const statView = leaderboardView({ compete: true, mode: "board", sheet: "stat", stat: "purse" });
  const purseOpt = statView.sheet.opts.find((o) => o.value === "purse");
  assert.equal(purseOpt.on, true);
  assert.equal(purseOpt.col, C.stats.purse.col);
});

test("every stat shows its own colour in view.col and on the stat picker", () => {
  for (const stat of Object.keys(C.stats)) {
    const view = leaderboardView({ stat });
    assert.equal(view.col, C.stats[stat].col);
    assert.equal(view.pickers[0].col, C.stats[stat].col);
  }
});

// ─── purity ────────────────────────────────────────────────────────────────

// ─── Phase 87 (BOARD-29): race/sub-class in the detail, and the row filter menu ─

test("BOARD-29: YOUR DEAD and LEADERBOARD rows carry who/race/sub/filterLabel", () => {
  const run = historyRun({ race: "Dwarven", sub: "Wizard", cls: "Magic User" });
  const mine = leaderboardView({ history: [run] }).body.rows[0];
  assert.equal(mine.who, "Dwarven · Wizard (Magic User)");
  assert.equal(mine.race, "Dwarven");
  assert.equal(mine.sub, "Wizard");
  assert.equal(mine.filterLabel, "FILTER LIKE THIS");

  const board = { status: "ready", rows: [boardDoc({ race: "Dwarven", sub: "Wizard", cls: "Magic User" })], total: 1, filteredTotal: 1, you: null, youKnown: true, uid: null, stale: false, fetchedAt: null };
  const row = leaderboardView({ compete: true, mode: "board", board }).body.rows[0];
  assert.equal(row.who, "Dwarven · Wizard (Magic User)");
  assert.equal(row.race, "Dwarven");
  assert.equal(row.sub, "Wizard");
  assert.equal(row.filterLabel, "FILTER LIKE THIS");
});

test("BOARD-29: an unknown race or sub-class is dropped from who and never offered", () => {
  const rowOf = (over) => leaderboardView({ history: [historyRun(over)] }).body.rows[0];
  const noRace = rowOf({ race: "<b>Elf</b>", sub: "Wizard" });
  assert.equal(noRace.race, null);
  assert.equal(noRace.sub, "Wizard");
  assert.equal(noRace.who, "Wizard (Magic User)");
  assert.equal(noRace.filterLabel, "FILTER LIKE THIS");

  const noSub = rowOf({ race: "Dwarven", sub: "Grand Poobah" });
  assert.equal(noSub.race, "Dwarven");
  assert.equal(noSub.sub, null);
  assert.equal(noSub.who, "Dwarven");

  const neither = rowOf({ race: 42, sub: undefined });
  assert.equal(neither.race, null);
  assert.equal(neither.sub, null);
  assert.equal(neither.who, "");
  assert.equal(neither.filterLabel, "");
});

test("BOARD-29: the row sheet has FILTER BY race / sub-class / both and CANCEL", () => {
  const sheet = leaderboardView({ sheet: "row", menu: { race: "Dwarven", sub: "Wizard" } }).sheet;
  assert.equal(sheet.id, "row");
  assert.equal(sheet.title, "FILTER LIKE THIS");
  assert.equal(sheet.done, "CANCEL");
  assert.deepEqual(sheet.opts.map((o) => o.value), ["race", "sub", "both", "cancel"]);
  assert.deepEqual(sheet.opts.map((o) => o.label), ["FILTER BY DWARVEN", "FILTER BY WIZARD", "FILTER BY DWARVEN WIZARD", "CANCEL"]);
  for (const o of sheet.opts) {
    assert.equal(typeof o.sub, "string");
    assert.ok(o.sub.length > 0);
    assert.equal(o.on, false);
    assert.equal(o.dim, false);
  }
});

test("BOARD-29: the row sheet offers only what validates; none when nothing does", () => {
  const raceOnly = leaderboardView({ sheet: "row", menu: { race: "Dwarven", sub: null } }).sheet;
  assert.deepEqual(raceOnly.opts.map((o) => o.value), ["race", "cancel"]);
  const subOnly = leaderboardView({ sheet: "row", menu: { race: "Nope", sub: "Wizard" } }).sheet;
  assert.deepEqual(subOnly.opts.map((o) => o.value), ["sub", "cancel"]);
  assert.equal(leaderboardView({ sheet: "row", menu: { race: null, sub: null } }).sheet, null);
  assert.equal(leaderboardView({ sheet: "row", menu: { race: "<img>", sub: "x" } }).sheet, null);
  assert.equal(leaderboardView({ sheet: "row" }).sheet, null);
  assert.equal(leaderboardView({ sheet: "row", menu: "Dwarven" }).sheet, null);
});

test("BOARD-29: the stat, race and sub sheets are unchanged by a menu input", () => {
  const a = leaderboardView({ sheet: "race", history: [historyRun()] }).sheet;
  const b = leaderboardView({ sheet: "race", history: [historyRun()], menu: { race: "Dwarven", sub: "Wizard" } }).sheet;
  assert.deepEqual(a, b);
});

test("purity: leaderboardView(input) never mutates its input", () => {
  const history = Object.freeze([Object.freeze(historyRun({ hash: "00000001" }))]);
  const board = Object.freeze({
    status: "ready",
    rows: Object.freeze([Object.freeze(boardDoc())]),
    total: 1,
    filteredTotal: 1,
    you: null,
    youKnown: true,
    uid: null,
    stale: false,
    fetchedAt: null,
  });
  const input = Object.freeze({ compete: true, mode: "board", entry: "tab", history, board, stat: "deep" });
  assert.doesNotThrow(() => leaderboardView(input));
});

test("source pins: no window./document./navigator./localStorage/Date.now/Math.random/fetch( in the module", () => {
  assert.doesNotMatch(STRIPPED, /\bwindow\./);
  assert.doesNotMatch(STRIPPED, /\bdocument\./);
  assert.doesNotMatch(STRIPPED, /\bnavigator\./);
  assert.doesNotMatch(STRIPPED, /\blocalStorage\b/);
  assert.doesNotMatch(STRIPPED, /Date\.now/);
  assert.doesNotMatch(STRIPPED, /Math\.random/);
  assert.doesNotMatch(STRIPPED, /\bfetch\(/);
  assert.doesNotMatch(STRIPPED, /playGames|globalBoards|account\.js|boardScores/);
});

test("source pins: exports leaderboardView and handleInitials; uses rankKeyOf and SEASON_NAMES", () => {
  assert.match(MODULE_SRC, /export function leaderboardView/);
  assert.match(MODULE_SRC, /export function handleInitials/);
  assert.match(MODULE_SRC, /rankKeyOf/);
  assert.match(MODULE_SRC, /SEASON_NAMES/);
});
