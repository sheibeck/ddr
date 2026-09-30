// test/unit/leaderboardPanel.test.js
//
// Phase 84 (BOARD-18, BOARD-19, BOARD-20, BOARD-22, BOARD-23, BOARD-25),
// Plan 07 — controller tests for src/browser/leaderboardPanel.js's
// createLeaderboardPanel: opening/views, stat memory, filters, sheets,
// rows, routing (Task 1) and cached-first board loading, race-safe
// redraws and refresh()'s Compete transitions (Task 2). Drives the real
// createRecordingDocument() + the REAL src/browser/leaderboardView.js as
// buildView (so stat memory, filters, sheets and body states behave
// exactly as the shipped view does) against a fake board seam whose
// cached()/load() calls are recorded and whose load() promises are
// resolved/rejected under test control (deferred promises), mirroring
// test/unit/boardsPanel.test.js's own controller-test style.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { createRecordingDocument } from "./harness/recordingDom.js";
import { stripJs } from "../../tools/ident-sweep.mjs";
import { createLeaderboardPanel, BOARDS_LAST_KEY } from "../../src/browser/leaderboardPanel.js";
import { leaderboardView } from "../../src/browser/leaderboardView.js";
import { LEADERBOARD_COPY } from "../../content/boards.js";
import { SEASON } from "../../content/season.js";
import { BOARD_STATS } from "../../src/browser/runDoc.js";
import { RACES } from "../../content/races.js";
import { CLASSES } from "../../content/classes.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const MODULE_PATH = path.join(REPO_ROOT, "src", "browser", "leaderboardPanel.js");
const MODULE_SRC = fs.readFileSync(MODULE_PATH, "utf8").replace(/\r\n/g, "\n");
const STRIPPED = stripJs(MODULE_SRC);

const C = LEADERBOARD_COPY;
const NOW = Date.UTC(2026, 8, 29, 12, 0);

// ─── content-order id lists (test-only; leaderboardPanel.js itself never
// imports content/ directly — see its own header comment) ─────────────────

const RACE_IDS = Object.keys(RACES);
const CLASS_IDS = Object.keys(CLASSES);
const SUB_IDS = CLASS_IDS.flatMap((cls) => CLASSES[cls].subs);

function raceOptIndex(id) {
  return id === null ? 0 : 1 + RACE_IDS.indexOf(id);
}
function subOptIndex(id) {
  return id === null ? 0 : 1 + SUB_IDS.indexOf(id);
}
function statOptIndex(id) {
  return BOARD_STATS.indexOf(id);
}

// ─── fixtures (mirrors test/unit/leaderboardView.test.js's own builders) ──

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
    when: NOW - 60000,
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
    when: NOW - 60000,
    version: "2.1.0 (11)",
    createdAt: "2026-09-28T20:00:00.000Z",
    ...overrides,
  };
}

function readySnapshot(rows, overrides = {}) {
  return {
    status: "ready",
    reason: null,
    stale: false,
    fetchedAt: NOW,
    rows,
    total: rows.length,
    filteredTotal: rows.length,
    you: null,
    youKnown: true,
    uid: null,
    ...overrides,
  };
}

// ─── fakes ──────────────────────────────────────────────────────────────

function spy() {
  const fn = (...args) => {
    fn.calls.push(args);
    return fn.ret;
  };
  fn.calls = [];
  fn.ret = undefined;
  return fn;
}

function fakePrefs(initial = {}) {
  const store = { ...initial };
  return {
    store,
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => {
      store[k] = v;
    },
  };
}

function throwingPrefs() {
  return {
    getItem: () => {
      throw new Error("boom");
    },
    setItem: () => {
      throw new Error("boom");
    },
  };
}

/**
 * makeBoard() — a fake board seam recording every cached()/load() call.
 * cached() answers via setCached(fn) (defaults to always null — no cache).
 * load() never resolves on its own: it returns a promise held open in
 * `pendings`, resolved/rejected by the test under deferred-promise control
 * (mirrors src/browser/boardFeed.js's own async shape without depending on
 * it, so a query's resolution order can be driven deliberately).
 */
function makeBoard() {
  let cachedImpl = () => null;
  const loadCalls = [];
  const cachedCalls = [];
  const pendings = [];
  return {
    loadCalls,
    cachedCalls,
    pendings,
    setCached(fn) {
      cachedImpl = fn;
    },
    cached(query) {
      cachedCalls.push(query);
      return cachedImpl(query);
    },
    load(query) {
      loadCalls.push(query);
      let resolve, reject;
      const p = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
      });
      pendings.push({ query, resolve, reject });
      return p;
    },
  };
}

function throwingBoard() {
  return {
    cached() {
      throw new Error("boom");
    },
    load() {
      throw new Error("boom");
    },
  };
}

/** flush() — drains the microtask queue enough for a resolved/rejected load()'s .then/.catch chain to run. */
async function flush() {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

/** wrappedBuildView(mutate) — the real leaderboardView, then mutate(view, input) before returning (injects an otherwise-unreachable option/dock entry so a genuinely-unknown value can be clicked through real DOM, mirroring boardsPanel.test.js's own onLineage "unknown kind" test). */
function wrappedBuildView(mutate) {
  return (input) => {
    const view = leaderboardView(input);
    if (typeof mutate === "function") mutate(view, input);
    return view;
  };
}

function setup(overrides = {}) {
  const doc = createRecordingDocument();
  const host = doc.document.getElementById("screen-dead");
  const historyArr = overrides.historyArr || [];
  const history = overrides.history || (() => historyArr);
  const board = overrides.board || makeBoard();
  let compete = overrides.compete === undefined ? true : overrides.compete;
  const competeOn = overrides.competeOn || (() => compete);
  const prefs = overrides.prefs === undefined ? fakePrefs() : overrides.prefs;
  const onRoute = overrides.onRoute || spy();
  const buildView = overrides.buildView || leaderboardView;
  const now = overrides.now || (() => NOW);
  const tzOffset = overrides.tzOffset || (() => 0);
  const season = overrides.season === undefined ? SEASON : overrides.season;
  const panel = createLeaderboardPanel({
    host,
    buildView,
    history,
    board,
    competeOn,
    prefs,
    now,
    tzOffset,
    season,
    onRoute,
  });
  return {
    doc,
    host,
    historyArr,
    board,
    onRoute,
    prefs,
    setCompete: (v) => {
      compete = v;
    },
    panel,
  };
}

// ─── DOM lookups (drive the panel exactly like a tap would) ───────────────

function pickerButton(host, id) {
  return host.querySelectorAll(".mw-lb-picker").find((b) => b.dataset.picker === id);
}
function rowButton(host, key) {
  return host.querySelectorAll(".mw-lb-row").find((r) => r.dataset.key === key);
}
function optButtons(host) {
  return host.querySelectorAll(".mw-lb-opt");
}
function dockButton(host, id) {
  return host.querySelectorAll(".mw-lb-dock-btn").find((b) => b.dataset.action === id);
}

// ═══════════════════ Task 1: opening, views, stat memory, ═════════════════
// ═══════════════════ filters, sheets, rows and routing ════════════════════

test("openFromTab(): Compete on opens LEADERBOARD (board mode); Compete off opens YOUR DEAD and never touches the board seam", () => {
  {
    const { host, panel } = setup({ compete: true });
    panel.openFromTab({ dead: false });
    assert.equal(panel.state().mode, "board");
    assert.equal(host.querySelector(".mw-lb").dataset.mode, "board");
  }
  {
    const { host, panel, board } = setup({ compete: false });
    panel.openFromTab({ dead: false });
    assert.equal(panel.state().mode, "mine");
    assert.equal(host.querySelector(".mw-lb").dataset.mode, "mine");
    assert.equal(board.loadCalls.length, 0);
    assert.equal(board.cachedCalls.length, 0);
  }
});

test("openFromTitle({hasHero}) sets body[data-boards-entry='title'] and the title dock, isTitleOpen() true; openFromTab clears the marker", () => {
  const { doc, host, panel } = setup({ compete: false });
  panel.openFromTitle({ hasHero: false });
  assert.equal(doc.document.body.dataset.boardsEntry, "title");
  assert.equal(panel.isTitleOpen(), true);
  const ids = host
    .querySelectorAll(".mw-lb-dock-btn")
    .map((b) => b.dataset.action)
    .sort();
  assert.deepEqual(ids, ["roll", "title"]);

  panel.openFromTab({ dead: false });
  assert.equal(doc.document.body.dataset.boardsEntry, undefined);
  assert.equal(panel.isTitleOpen(), false);
});

test("openFromTitle({hasHero:true}) docks BACK TO THE DUNGEON only", () => {
  const { host, panel } = setup({ compete: false });
  panel.openFromTitle({ hasHero: true });
  const ids = host.querySelectorAll(".mw-lb-dock-btn").map((b) => b.dataset.action);
  assert.deepEqual(ids, ["dungeon"]);
});

test("stat memory: picking KILLS stores it; a later open starts on KILLS", () => {
  const prefs = fakePrefs();
  const { panel, host } = setup({ prefs, compete: false });
  panel.openFromTab({});
  assert.equal(panel.state().stat, "deep");
  pickerButton(host, "stat").onclick();
  optButtons(host)[statOptIndex("kills")].onclick();
  assert.equal(panel.state().stat, "kills");
  assert.equal(prefs.store[BOARDS_LAST_KEY], "kills");

  panel.openFromTab({});
  assert.equal(panel.state().stat, "kills");
});

test("stat memory: a stored combo/yard/lean/garbage id, or a throwing getItem, falls back to DEPTH", () => {
  for (const bad of ["combo", "yard", "lean", "garbage"]) {
    const { panel } = setup({ prefs: fakePrefs({ [BOARDS_LAST_KEY]: bad }), compete: false });
    panel.openFromTab({});
    assert.equal(panel.state().stat, "deep", `stored "${bad}" must fall back to deep`);
  }
  const { panel } = setup({ prefs: throwingPrefs(), compete: false });
  assert.doesNotThrow(() => panel.openFromTab({}));
  assert.equal(panel.state().stat, "deep");
});

test("a throwing prefs.setItem never breaks the stat pick", () => {
  const prefs = fakePrefs();
  prefs.setItem = () => {
    throw new Error("boom");
  };
  const { panel, host } = setup({ prefs, compete: false });
  panel.openFromTab({});
  pickerButton(host, "stat").onclick();
  assert.doesNotThrow(() => optButtons(host)[statOptIndex("kills")].onclick());
  assert.equal(panel.state().stat, "kills");
});

test("RACE and SUB-CLASS filters are null after every open, even when they were set before", () => {
  const { panel, host } = setup({ compete: false, historyArr: [historyRun()] });
  panel.openFromTab({});
  pickerButton(host, "race").onclick();
  optButtons(host)[raceOptIndex("Human")].onclick();
  pickerButton(host, "sub").onclick();
  optButtons(host)[subOptIndex("Knight")].onclick();
  assert.equal(panel.state().race, "Human");
  assert.equal(panel.state().sub, "Knight");

  panel.openFromTab({});
  assert.equal(panel.state().race, null);
  assert.equal(panel.state().sub, null);
});

test("RACE sheet: opening renders it; picking a value sets the filter, closes the sheet and resets the body scroll; picking null clears it; onSheetClose closes without changing anything", () => {
  const { panel, host } = setup({ compete: false, historyArr: [historyRun()] });
  panel.openFromTab({});
  assert.equal(host.querySelector(".mw-lb-sheet").hidden, true);

  pickerButton(host, "race").onclick();
  assert.equal(host.querySelector(".mw-lb-sheet").hidden, false);
  assert.equal(panel.state().sheet, "race");
  host.querySelector(".mw-lb-body").scrollTop = 40;

  optButtons(host)[raceOptIndex("Human")].onclick();
  assert.equal(panel.state().race, "Human");
  assert.equal(panel.state().sheet, null);
  assert.equal(host.querySelector(".mw-lb-sheet").hidden, true);
  assert.equal(host.querySelector(".mw-lb-body").scrollTop, 0);

  pickerButton(host, "race").onclick();
  optButtons(host)[raceOptIndex(null)].onclick();
  assert.equal(panel.state().race, null);

  pickerButton(host, "race").onclick();
  const before = { ...panel.state() };
  host.querySelector(".mw-lb-scrim").onclick();
  const after = panel.state();
  assert.equal(after.sheet, null);
  assert.equal(after.race, before.race);
  assert.equal(after.stat, before.stat);
});

test("onSheetPick: an unknown race/sub/stat value is ignored (nothing changes, the sheet stays open)", () => {
  const bogusOpt = { value: "not-a-real-id", label: "BOGUS", sub: "", n: "", dim: false, on: false, col: "" };
  const buildView = wrappedBuildView((view) => {
    if (view.sheet) view.sheet = { ...view.sheet, opts: [...view.sheet.opts, bogusOpt] };
  });
  const { panel, host } = setup({ compete: false, buildView, historyArr: [historyRun()] });
  panel.openFromTab({});

  for (const id of ["race", "sub", "stat"]) {
    pickerButton(host, id).onclick();
    const before = panel.state();
    const opts = optButtons(host);
    opts[opts.length - 1].onclick(); // the injected bogus option is always appended last
    assert.deepEqual(panel.state(), before, `an unknown ${id} value must be ignored`);
    assert.equal(panel.state().sheet, id, "the sheet stays open on an ignored pick");
    host.querySelector(".mw-lb-scrim").onclick();
  }
});

test("onSheetPick: an unknown sheetId is ignored", () => {
  const buildView = wrappedBuildView((view) => {
    if (view.sheet) view.sheet = { ...view.sheet, id: "bogus" };
  });
  const { panel, host } = setup({ compete: false, buildView });
  panel.openFromTab({});
  pickerButton(host, "stat").onclick();
  const before = panel.state();
  optButtons(host)[0].onclick();
  assert.deepEqual(panel.state(), before);
});

test("onRow(key) toggles one open row without resetting scroll; opening another row closes the first", () => {
  const rows = [historyRun({ hash: "aaaaaaa1", floor: 9 }), historyRun({ hash: "aaaaaaa2", floor: 4 })];
  const { panel, host } = setup({ compete: false, historyArr: rows });
  panel.openFromTab({});
  host.querySelector(".mw-lb-body").scrollTop = 30;

  rowButton(host, "aaaaaaa2").onclick(); // rank-1 (deepest floor) is aaaaaaa2 under DEPTH
  assert.equal(panel.state().open, "aaaaaaa2");
  assert.equal(host.querySelector(".mw-lb-body").scrollTop, 30, "a row toggle must not reset scroll");

  rowButton(host, "aaaaaaa1").onclick();
  assert.equal(panel.state().open, "aaaaaaa1");

  rowButton(host, "aaaaaaa1").onclick();
  assert.equal(panel.state().open, null);
});

test("onClear() clears race and sub but keeps the stat", () => {
  const rows = [historyRun({ hash: "bbbbbbb1", race: "Human", sub: "Knight" })];
  const { panel, host } = setup({ compete: false, historyArr: rows });
  panel.openFromTab({});
  pickerButton(host, "stat").onclick();
  optButtons(host)[statOptIndex("kills")].onclick();
  pickerButton(host, "race").onclick();
  optButtons(host)[raceOptIndex("Elven")].onclick(); // matches nothing -> empty state with CLEAR FILTERS
  assert.equal(panel.state().race, "Elven");
  assert.equal(panel.state().stat, "kills");

  const clearBtn = host.querySelector(".mw-lb-clear");
  assert.ok(clearBtn);
  clearBtn.onclick();
  assert.equal(panel.state().race, null);
  assert.equal(panel.state().sub, null);
  assert.equal(panel.state().stat, "kills", "CLEAR FILTERS keeps the stat");
});

test("onBox('mine') shows YOUR DEAD; onBox('board') returns to LEADERBOARD", () => {
  const { panel, host, board } = setup({ compete: true });
  board.setCached(() => readySnapshot([boardDoc()]));
  panel.openFromTab({});
  assert.equal(panel.state().mode, "board");

  host.querySelector(".mw-lb-box").onclick(); // data-action "mine"
  assert.equal(panel.state().mode, "mine");

  host.querySelector(".mw-lb-box").onclick(); // now data-action "board"
  assert.equal(panel.state().mode, "board");
});

test("onSeeMine() (the SEE YOUR DEAD note button) switches to YOUR DEAD", async () => {
  const { panel, host, board } = setup({ compete: true });
  panel.openFromTab({});
  board.pendings[0].reject(new Error("nope"));
  await flush();
  const btn = host.querySelector(".mw-lb-note-btn");
  assert.ok(btn);
  btn.onclick();
  assert.equal(panel.state().mode, "mine");
});

// ─── Phase 87 (BOARD-29): the row filter menu ────────────────────────────────

/** trackFocus(doc) — every element made from now on records focus() calls as its data-picker value. */
function trackFocus(doc) {
  const focused = [];
  const make = doc.document.createElement.bind(doc.document);
  doc.document.createElement = (tag) => {
    const e = make(tag);
    e.focus = () => focused.push(e.dataset.picker ?? null);
    return e;
  };
  return focused;
}

function menuSetup(overrides = {}) {
  const rows = [historyRun({ hash: "aaaaaaa1", race: "Dwarven", sub: "Wizard", cls: "Magic User", floor: 9 })];
  const ctx = setup({ compete: false, historyArr: rows, ...overrides });
  const focused = trackFocus(ctx.doc);
  ctx.panel.openFromTab({});
  rowButton(ctx.host, "aaaaaaa1").onclick();
  return { ...ctx, focused };
}

function optLabels(host) {
  return optButtons(host).map((b) => b.querySelectorAll(".mw-lb-opt-label")[0].textContent);
}

test("openRowMenu(key): opens the row sheet with the validated race and sub; unknown key, closed panel or nothing valid change nothing", () => {
  const { panel, host } = menuSetup();
  assert.equal(panel.openRowMenu("aaaaaaa1"), true);
  assert.equal(panel.state().sheet, "row");
  assert.deepEqual(panel.state().menu, { key: "aaaaaaa1", race: "Dwarven", sub: "Wizard" });
  assert.equal(host.querySelector(".mw-lb-sheet").hidden, false);
  assert.deepEqual(optLabels(host), ["FILTER BY DWARVEN", "FILTER BY WIZARD", "FILTER BY DWARVEN WIZARD", "CANCEL"]);

  panel.back();
  const before = panel.state();
  assert.equal(panel.openRowMenu("nope"), false);
  assert.deepEqual(panel.state(), before);

  const closed = setup({ compete: false, historyArr: [historyRun()] });
  assert.equal(closed.panel.openRowMenu("00000001"), false);

  const junk = setup({ compete: false, historyArr: [historyRun({ race: "Blorp", sub: "Nope" })] });
  junk.panel.openFromTab({});
  assert.equal(junk.panel.openRowMenu("00000001"), false);
  assert.equal(junk.panel.state().sheet, null);
});

test("openRowMenu works on LEADERBOARD rows too", () => {
  const board = makeBoard();
  board.setCached(() => readySnapshot([boardDoc({ id: "d1", race: "Troll", sub: "Cleric", cls: "Magic User" })]));
  const { panel } = setup({ compete: true, board });
  panel.openFromTab({});
  assert.equal(panel.openRowMenu("d1"), true);
  assert.deepEqual(panel.state().menu, { key: "d1", race: "Troll", sub: "Cleric" });
});

test("row menu picks: race, sub, both set the filters like a sheet pick, close the sheet, reset scroll and move focus to the changed picker", () => {
  for (const [value, wantRace, wantSub, wantFocus] of [
    ["race", "Dwarven", null, "race"],
    ["sub", null, "Wizard", "sub"],
    ["both", "Dwarven", "Wizard", "race"],
  ]) {
    const { panel, host, focused } = menuSetup();
    panel.openRowMenu("aaaaaaa1");
    host.querySelector(".mw-lb-body").scrollTop = 40;
    optButtons(host)[["race", "sub", "both", "cancel"].indexOf(value)].onclick();
    const st = panel.state();
    assert.equal(st.race, wantRace, value);
    assert.equal(st.sub, wantSub, value);
    assert.equal(st.sheet, null);
    assert.equal(st.menu, null);
    assert.equal(host.querySelector(".mw-lb-body").scrollTop, 0);
    assert.equal(focused[focused.length - 1], wantFocus, `${value} focuses the ${wantFocus} picker`);
  }
});

test("row menu CANCEL only closes; a value the menu does not carry changes nothing", () => {
  const { panel, host } = menuSetup();
  panel.openRowMenu("aaaaaaa1");
  optButtons(host)[3].onclick();
  assert.equal(panel.state().sheet, null);
  assert.equal(panel.state().race, null);
  assert.equal(panel.state().sub, null);

  // a race-only menu (the sub is not a content id): forged "sub" / "both" / unknown picks are ignored
  const forge = wrappedBuildView((view) => {
    if (view.sheet && view.sheet.id === "row") {
      const o = view.sheet.opts[0];
      view.sheet = { ...view.sheet, opts: [{ ...o, value: "sub" }, { ...o, value: "both" }, { ...o, value: "zzz" }] };
    }
  });
  const f = setup({ compete: false, historyArr: [historyRun({ hash: "bbbbbbb1", race: "Dwarven", sub: "Nope" })], buildView: forge });
  f.panel.openFromTab({});
  rowButton(f.host, "bbbbbbb1").onclick();
  f.panel.openRowMenu("bbbbbbb1");
  assert.deepEqual(f.panel.state().menu, { key: "bbbbbbb1", race: "Dwarven", sub: null });
  for (const i of [0, 1, 2]) {
    optButtons(f.host)[i].onclick();
    assert.equal(f.panel.state().race, null);
    assert.equal(f.panel.state().sub, null);
    assert.equal(f.panel.state().sheet, "row");
  }
});

test("row menu pick on LEADERBOARD re-queries the board with the new filters", () => {
  const board = makeBoard();
  board.setCached((q) => (q.race === null && q.sub === null ? readySnapshot([boardDoc({ id: "d1", race: "Troll", sub: "Cleric", cls: "Magic User" })]) : null));
  const { panel, host } = setup({ compete: true, board });
  panel.openFromTab({});
  rowButton(host, "d1").onclick();
  panel.openRowMenu("d1");
  optButtons(host)[2].onclick();
  assert.deepEqual(board.loadCalls[board.loadCalls.length - 1], { stat: "deep", race: "Troll", sub: "Cleric" });
  assert.equal(panel.state().race, "Troll");
  assert.equal(panel.state().sub, "Cleric");
});

test("RACE and SUB-CLASS sheet picks also move focus to the changed picker; a focus that throws never breaks the pick", () => {
  const { host, focused } = menuSetup();
  pickerButton(host, "race").onclick();
  optButtons(host)[raceOptIndex("Dwarven")].onclick();
  assert.equal(focused[focused.length - 1], "race");
  pickerButton(host, "sub").onclick();
  optButtons(host)[subOptIndex("Wizard")].onclick();
  assert.equal(focused[focused.length - 1], "sub");

  const ctx = setup({ compete: false, historyArr: [historyRun()] });
  const make = ctx.doc.document.createElement.bind(ctx.doc.document);
  ctx.doc.document.createElement = (tag) => {
    const e = make(tag);
    e.focus = () => {
      throw new Error("boom");
    };
    return e;
  };
  ctx.panel.openFromTab({});
  pickerButton(ctx.host, "race").onclick();
  assert.doesNotThrow(() => optButtons(ctx.host)[raceOptIndex("Human")].onclick());
  assert.equal(ctx.panel.state().race, "Human");
});

test("row menu: back() and the scrim close it, and every open resets it", () => {
  const { panel, host } = menuSetup();
  panel.openRowMenu("aaaaaaa1");
  assert.equal(panel.back(), true);
  assert.equal(panel.state().sheet, null);
  assert.equal(panel.state().menu, null);

  panel.openRowMenu("aaaaaaa1");
  host.querySelector(".mw-lb-scrim").onclick();
  assert.equal(panel.state().sheet, null);
  assert.equal(panel.state().menu, null);

  panel.openRowMenu("aaaaaaa1");
  panel.openFromTab({});
  assert.equal(panel.state().sheet, null);
  assert.equal(panel.state().menu, null);
  assert.equal(panel.state().race, null);
});

test("the FILTER LIKE THIS button in the open detail opens the same menu and leaves the row open", () => {
  const { panel, host } = menuSetup();
  const btn = host.querySelectorAll(".mw-lb-detail-filter")[0];
  assert.ok(btn);
  btn.onclick({ stopPropagation() {} });
  assert.equal(panel.state().sheet, "row");
  assert.equal(panel.state().open, "aaaaaaa1");
});

test("back(): a sheet open closes it and returns true", () => {
  const { panel, host } = setup({ compete: false });
  panel.openFromTab({});
  pickerButton(host, "race").onclick();
  assert.equal(panel.back(), true);
  assert.equal(panel.state().sheet, null);
});

test("back(): in YOUR DEAD with Compete on returns to LEADERBOARD and returns true", () => {
  const { panel, host, board } = setup({ compete: true });
  board.setCached(() => readySnapshot([boardDoc()]));
  panel.openFromTab({});
  host.querySelector(".mw-lb-box").onclick(); // -> mine
  assert.equal(panel.state().mode, "mine");
  assert.equal(panel.back(), true);
  assert.equal(panel.state().mode, "board");
});

test("back(): a title open routes dungeon (a live hero) or title (no hero), clears the marker and closes title mode", () => {
  {
    const { panel, doc, onRoute } = setup({ compete: false });
    panel.openFromTitle({ hasHero: true });
    assert.equal(panel.back(), true);
    assert.deepEqual(onRoute.calls[onRoute.calls.length - 1], ["dungeon", { hasHero: true }]);
    assert.equal(panel.isTitleOpen(), false);
    assert.equal(doc.document.body.dataset.boardsEntry, undefined);
  }
  {
    const { panel, onRoute } = setup({ compete: false });
    panel.openFromTitle({ hasHero: false });
    assert.equal(panel.back(), true);
    assert.deepEqual(onRoute.calls[onRoute.calls.length - 1], ["title", { hasHero: false }]);
  }
});

test("back(): a tab open with nothing to close returns false; back() before any open returns false", () => {
  {
    const { panel } = setup({ compete: false });
    panel.openFromTab({});
    assert.equal(panel.back(), false);
  }
  {
    const { panel } = setup({ compete: false });
    assert.equal(panel.back(), false);
  }
});

test("onDock: FINAL SHEET keeps the panel's entry; BURY THEM clears it; TITLE/ROLL/DUNGEON route", () => {
  {
    const { panel, host, onRoute } = setup({ compete: false });
    panel.openFromTab({ dead: true });
    dockButton(host, "finalSheet").onclick();
    assert.deepEqual(onRoute.calls[onRoute.calls.length - 1], ["finalSheet", { hasHero: false }]);
    assert.equal(panel.state().entry, "tab", "FINAL SHEET keeps the panel open");
  }
  {
    const { panel, host, onRoute } = setup({ compete: false });
    panel.openFromTab({ dead: true });
    dockButton(host, "bury").onclick();
    assert.deepEqual(onRoute.calls[onRoute.calls.length - 1], ["bury", { hasHero: false }]);
    assert.equal(panel.state().entry, null);
  }
  {
    const { panel, host, onRoute } = setup({ compete: false });
    panel.openFromTitle({ hasHero: true });
    dockButton(host, "dungeon").onclick();
    assert.deepEqual(onRoute.calls[onRoute.calls.length - 1], ["dungeon", { hasHero: true }]);
  }
  {
    const { panel, host, onRoute } = setup({ compete: false });
    panel.openFromTitle({ hasHero: false });
    dockButton(host, "roll").onclick();
    assert.deepEqual(onRoute.calls[onRoute.calls.length - 1], ["roll", { hasHero: false }]);
  }
  {
    const { panel, host, onRoute } = setup({ compete: false });
    panel.openFromTitle({ hasHero: false });
    dockButton(host, "title").onclick();
    assert.deepEqual(onRoute.calls[onRoute.calls.length - 1], ["title", { hasHero: false }]);
  }
});

test("onDock: an unknown id does nothing", () => {
  const buildView = wrappedBuildView((view) => {
    if (view.dock) view.dock = [...view.dock, { id: "bogus", label: "BOGUS", primary: false }];
  });
  const { panel, host, onRoute } = setup({ compete: false, buildView });
  panel.openFromTab({ dead: true });
  const before = { ...panel.state() };
  const btn = dockButton(host, "bogus");
  assert.ok(btn);
  btn.onclick();
  assert.equal(onRoute.calls.length, 0);
  assert.deepEqual(panel.state(), before);
});

test("onDeadTab({dead:true}) opens with the dead-hero dock in tab mode; a title-opened panel is left unchanged", () => {
  const { panel, host } = setup({ compete: false });
  panel.onDeadTab({ dead: true });
  assert.equal(panel.state().entry, "tab");
  assert.equal(panel.state().dead, true);
  assert.ok(dockButton(host, "finalSheet"));
  assert.ok(dockButton(host, "bury"));

  panel.openFromTitle({ hasHero: false });
  const before = panel.state();
  panel.onDeadTab({ dead: true });
  assert.deepEqual(panel.state(), before);
});

test("a throwing history(), buildView or board seam never throws out of any controller method", () => {
  {
    const { panel } = setup({ compete: false, history: () => { throw new Error("boom"); } });
    assert.doesNotThrow(() => panel.openFromTab({}));
  }
  {
    const { panel } = setup({
      compete: false,
      buildView: () => {
        throw new Error("boom");
      },
    });
    assert.doesNotThrow(() => panel.openFromTab({}));
    assert.doesNotThrow(() => panel.refresh());
  }
  {
    const { panel } = setup({ compete: true, board: throwingBoard() });
    assert.doesNotThrow(() => panel.openFromTab({}));
    assert.doesNotThrow(() => panel.refresh());
  }
});

// ══════════════ Task 2: board loading — cached first, loading note, ═══════
// ══════════════ race-safe redraws, refresh on Compete changes ═════════════

test("LEADERBOARD open with a fresh cached snapshot renders rows immediately and never calls load", () => {
  const { panel, host, board } = setup({ compete: true });
  board.setCached(() => readySnapshot([boardDoc({ id: "d1" }), boardDoc({ id: "d2", handle: "@other", uid: "uid2" })]));
  panel.openFromTab({});
  assert.equal(board.loadCalls.length, 0);
  assert.equal(host.querySelectorAll(".mw-lb-row").length, 2);
});

test("LEADERBOARD open with no cache renders the loading note and calls board.load exactly once with {stat, race:null, sub:null}; resolving draws rows without resetting scroll", async () => {
  const { panel, host, board } = setup({ compete: true });
  panel.openFromTab({});
  assert.ok(host.querySelector(".mw-lb-note"));
  assert.equal(board.loadCalls.length, 1);
  assert.deepEqual(board.loadCalls[0], { stat: "deep", race: null, sub: null });

  host.querySelector(".mw-lb-body").scrollTop = 22;
  board.pendings[0].resolve(readySnapshot([boardDoc()]));
  await flush();

  assert.equal(host.querySelectorAll(".mw-lb-row").length, 1);
  assert.equal(host.querySelector(".mw-lb-body").scrollTop, 22, "a resolved load never resets scroll");
});

test("two queries in a row resolving in reverse order end up showing the later query's snapshot", async () => {
  const { panel, host, board } = setup({ compete: true });
  panel.openFromTab({}); // DEPTH -> load #1
  pickerButton(host, "stat").onclick();
  optButtons(host)[statOptIndex("days")].onclick(); // DAYS -> load #2
  assert.equal(board.pendings.length, 2);

  board.pendings[1].resolve(readySnapshot([boardDoc({ id: "days-row" })]));
  await flush();
  board.pendings[0].resolve(readySnapshot([boardDoc({ id: "depth-row" })]));
  await flush();

  const rows = host.querySelectorAll(".mw-lb-row");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].dataset.key, "days-row");
});

test("a load resolving after the panel was routed away does not redraw", async () => {
  const { panel, host, board } = setup({ compete: true });
  panel.openFromTitle({ hasHero: true });
  assert.equal(board.pendings.length, 1);

  panel.back(); // routes to dungeon; entry -> null
  assert.equal(panel.state().entry, null);

  board.pendings[0].resolve(readySnapshot([boardDoc()]));
  await flush();
  assert.equal(host.querySelectorAll(".mw-lb-row").length, 0, "no redraw after routing away");
});

test("a filter change on LEADERBOARD loads the new query; a filter change on YOUR DEAD never calls the board", () => {
  {
    const { panel, host, board } = setup({ compete: true });
    board.setCached((q) => (q.race === null && q.sub === null ? readySnapshot([boardDoc()]) : null));
    panel.openFromTab({});
    assert.equal(board.loadCalls.length, 0, "the open itself is a cache hit");

    pickerButton(host, "race").onclick();
    optButtons(host)[raceOptIndex("Elven")].onclick();
    assert.equal(board.loadCalls.length, 1);
    assert.deepEqual(board.loadCalls[0], { stat: "deep", race: "Elven", sub: null });
  }
  {
    const { panel, host, board } = setup({ compete: false, historyArr: [historyRun()] });
    panel.openFromTab({});
    pickerButton(host, "race").onclick();
    optButtons(host)[raceOptIndex("Human")].onclick();
    assert.equal(board.loadCalls.length, 0);
    assert.equal(board.cachedCalls.length, 0);
  }
});

test("YOUR DEAD reached from LEADERBOARD shows EVERYONE with the last ready snapshot's total (en-US grouped); unknown before any snapshot is ready", () => {
  {
    const { panel, host } = setup({ compete: true }); // no cache -> still loading
    panel.openFromTab({});
    host.querySelector(".mw-lb-box").onclick(); // -> mine
    assert.equal(host.querySelector(".mw-lb-box-n").textContent, C.box.unknown);
  }
  {
    const { panel, host, board } = setup({ compete: true });
    board.setCached(() => readySnapshot([boardDoc()], { total: 1234 }));
    panel.openFromTab({});
    host.querySelector(".mw-lb-box").onclick(); // -> mine
    assert.equal(host.querySelector(".mw-lb-box-n").textContent, "1,234");
    assert.equal(board.loadCalls.length, 0, "switching to YOUR DEAD never calls the board");
  }
});

test("refresh(): LEADERBOARD switches to YOUR DEAD (INTERRED box) when Compete turns off, without calling the board", () => {
  const { panel, host, board, setCompete } = setup({ compete: true });
  board.setCached(() => readySnapshot([boardDoc()]));
  panel.openFromTab({});
  assert.equal(panel.state().mode, "board");
  const callsBefore = board.loadCalls.length + board.cachedCalls.length;

  setCompete(false);
  panel.refresh();
  assert.equal(panel.state().mode, "mine");
  assert.equal(host.querySelector(".mw-lb-box-label").textContent, C.box.interred);
  assert.equal(board.loadCalls.length + board.cachedCalls.length, callsBefore, "no new board calls");
});

test("refresh(): YOUR DEAD after Compete turns on shows EVERYONE (unknown until ready) and calls board.load exactly once", async () => {
  const { panel, host, board, setCompete } = setup({ compete: false });
  panel.openFromTab({});
  assert.equal(panel.state().mode, "mine");

  setCompete(true);
  panel.refresh();
  assert.equal(panel.state().mode, "mine", "stays on YOUR DEAD, does not jump to LEADERBOARD");
  assert.equal(host.querySelector(".mw-lb-box-n").textContent, C.box.unknown);
  assert.equal(board.loadCalls.length, 1);

  board.pendings[0].resolve(readySnapshot([boardDoc()], { total: 5 }));
  await flush();
  assert.equal(host.querySelector(".mw-lb-box-n").textContent, "5");

  panel.refresh(); // Compete stays on — must not fetch again
  assert.equal(board.loadCalls.length, 1);
});

test("refresh(): the OFF->ON board fetch skips load when board.cached already answers the current query", () => {
  const { panel, host, board, setCompete } = setup({ compete: false });
  board.setCached(() => readySnapshot([boardDoc()], { total: 7 }));
  panel.openFromTab({});
  setCompete(true);
  panel.refresh();
  assert.equal(board.loadCalls.length, 0);
  assert.equal(host.querySelector(".mw-lb-box-n").textContent, "7");
});

test("refresh() with no open panel does nothing", () => {
  const { panel, board, onRoute } = setup({ compete: true });
  assert.doesNotThrow(() => panel.refresh());
  assert.equal(board.loadCalls.length, 0);
  assert.equal(board.cachedCalls.length, 0);
  assert.equal(onRoute.calls.length, 0);
});

test("a load that rejects renders the unreachable note with SEE YOUR DEAD", async () => {
  const { panel, host, board } = setup({ compete: true });
  panel.openFromTab({});
  board.pendings[0].reject(new Error("nope"));
  await flush();
  assert.ok(host.querySelector(".mw-lb-note"));
  assert.ok(host.querySelector(".mw-lb-note-btn"));
});

// ─── purity / source pins ──────────────────────────────────────────────────

test("source pins: createLeaderboardPanel and BOARDS_LAST_KEY are each present exactly once; no import from content/", () => {
  assert.equal((MODULE_SRC.match(/export function createLeaderboardPanel/g) || []).length, 1);
  assert.equal((MODULE_SRC.match(/export const BOARDS_LAST_KEY/g) || []).length, 1);
  assert.match(MODULE_SRC, /ddr\.boards\.last\.v1/);
  assert.doesNotMatch(STRIPPED, /from\s+["'][^"']*\/content\//);
  assert.doesNotMatch(STRIPPED, /\bdocument\./);
  assert.doesNotMatch(STRIPPED, /\bwindow\./);
  assert.doesNotMatch(STRIPPED, /\bglobalThis\./);
});
