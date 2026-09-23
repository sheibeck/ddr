// test/unit/boardsPanel.test.js
//
// Phase 66 (BOARD-01..08, D-13/D-14), Plan 03 Task 2 — controller tests:
// entry modes, board memory, scope toggle, row toggle, back routing, rail
// centring. Drives createBoardsPanel against createRecordingDocument(), a
// recording fake buildView (returns a small valid view so the rendered
// chip/row/dock onclicks exist to drive), and fake prefs/onRoute/
// reducedMotion.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { createRecordingDocument } from "./harness/recordingDom.js";
import { createBoardsPanel, BOARDS_LAST_KEY } from "../../src/browser/boardsPanel.js";
import { BOARD_IDS } from "../../engine/records.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const MODULE_SRC = fs.readFileSync(path.join(__dirname, "..", "..", "src", "browser", "boardsPanel.js"), "utf8");

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

// A minimal, valid view — enough for renderBoardsPanel to draw without
// throwing, and for its own onclick handlers to exist so tests can drive
// them. buildView spy records every input it receives.
function makeBuildView() {
  const fn = spy();
  fn.mockImplementation = (input) => {
    fn.calls.push([input]);
    return {
      header: { title: "LEADERBOARDS", scopeLine: "x", interred: 0, interredLabel: "INTERRED", back: input.entry === "title", backLabel: "Back" },
      strip: null,
      rail: BOARD_IDS.map((id) => ({ id, tab: id.toUpperCase(), on: id === input.board, col: "#d3c49f" })),
      board: { id: input.board, mark: "▼", col: "#d3c49f", title: "T", rule: "R" },
      body: { kind: "empty", line: "empty" },
      standing: { label: "NO ENTRY", place: "—", note: "n" },
      footnote: "f",
      dock: input.entry === "title" ? [{ id: "dungeon", label: "BACK TO THE DUNGEON", primary: true }, { id: "roll", label: "ROLL", primary: false }] : null,
    };
  };
  const wrapped = (input) => fn.mockImplementation(input);
  wrapped.calls = fn.calls;
  return wrapped;
}

function setup(overrides = {}) {
  const doc = createRecordingDocument();
  const host = doc.document.getElementById("screen-boards");
  const buildView = overrides.buildView || makeBuildView();
  const readData = overrides.readData || (() => ({ bests: null, graves: [], total: 0 }));
  const prefs = overrides.prefs === undefined ? fakePrefs() : overrides.prefs;
  const onRoute = overrides.onRoute || spy();
  const reducedMotion = overrides.reducedMotion || (() => false);
  const panel = createBoardsPanel({ host, buildView, readData, prefs, reducedMotion, onRoute });
  return { doc, host, buildView, readData, prefs, onRoute, reducedMotion, panel };
}

// ─── entry modes ────────────────────────────────────────────────────────

test("openFromTab(): prefs null opens deep; a stored known id opens that board; an unknown stored id opens deep; a throwing prefs opens deep without throwing", () => {
  {
    const { panel } = setup({ prefs: null });
    panel.openFromTab();
    assert.equal(panel.state().board, "deep");
  }
  {
    const { panel } = setup({ prefs: fakePrefs({ [BOARDS_LAST_KEY]: "kills" }) });
    panel.openFromTab();
    assert.equal(panel.state().board, "kills");
  }
  {
    const { panel } = setup({ prefs: fakePrefs({ [BOARDS_LAST_KEY]: "not-a-board" }) });
    panel.openFromTab();
    assert.equal(panel.state().board, "deep");
  }
  {
    const { panel } = setup({ prefs: throwingPrefs() });
    assert.doesNotThrow(() => panel.openFromTab());
    assert.equal(panel.state().board, "deep");
  }
});

test("openFromTab(): entry is tab, scope local, open null, and it clears the title marker", () => {
  const { doc, host, panel } = setup();
  doc.document.body.dataset.boardsEntry = "title";
  panel.openFromTab();
  const s = panel.state();
  assert.equal(s.entry, "tab");
  assert.equal(s.scope, "local");
  assert.equal(s.open, null);
  assert.equal(doc.document.body.dataset.boardsEntry, undefined);
});

test("openFromTitle({ hasHero }): opens yard regardless of prefs, sets body.dataset.boardsEntry='title', isTitleOpen() true, entry/hasHero passed to buildView", () => {
  const buildView = makeBuildView();
  const { doc, panel } = setup({ prefs: fakePrefs({ [BOARDS_LAST_KEY]: "kills" }), buildView });
  panel.openFromTitle({ hasHero: false });
  const s = panel.state();
  assert.equal(s.board, "yard");
  assert.equal(s.entry, "title");
  assert.equal(s.hasHero, false);
  assert.equal(doc.document.body.dataset.boardsEntry, "title");
  assert.equal(panel.isTitleOpen(), true);
  const lastInput = buildView.calls[buildView.calls.length - 1][0];
  assert.equal(lastInput.entry, "title");
  assert.equal(lastInput.hasHero, false);
});

test("every open passes scope local, open null and signedIn false to buildView", () => {
  const buildView = makeBuildView();
  const { panel } = setup({ buildView });
  panel.openFromTab();
  let lastInput = buildView.calls[buildView.calls.length - 1][0];
  assert.equal(lastInput.scope, "local");
  assert.equal(lastInput.open, null);
  assert.equal(lastInput.signedIn, false);

  panel.openFromTitle({ hasHero: true });
  lastInput = buildView.calls[buildView.calls.length - 1][0];
  assert.equal(lastInput.scope, "local");
  assert.equal(lastInput.open, null);
  assert.equal(lastInput.signedIn, false);
});

// ─── board memory / rail chip ───────────────────────────────────────────

test("a chip's onclick switches board, stores it via prefs.setItem (a throwing setItem is swallowed), closes any open row and resets scrollTop", () => {
  const { host, panel, prefs } = setup();
  panel.openFromTab();
  const bodyEl = host.querySelector(".mw-bd-body");
  bodyEl.scrollTop = 99;

  const railEl = host.querySelector(".mw-bd-rail");
  const chip = railEl.children.find((c) => c.dataset.board === "kills");
  chip.onclick();

  assert.equal(panel.state().board, "kills");
  assert.equal(prefs.store[BOARDS_LAST_KEY], "kills");
  assert.equal(host.querySelector(".mw-bd-body").scrollTop, 0);
});

test("a chip's onclick with a throwing prefs.setItem does not throw and still switches board", () => {
  const { host, panel } = setup({ prefs: throwingPrefs() });
  panel.openFromTab();
  const railEl = host.querySelector(".mw-bd-rail");
  const chip = railEl.children.find((c) => c.dataset.board === "purse");
  assert.doesNotThrow(() => chip.onclick());
  assert.equal(panel.state().board, "purse");
});

test("an unknown board id is ignored by onBoard (an out-of-range chip click leaves state untouched)", () => {
  // Exercise the internal onBoard guard directly through a buildView whose
  // rail carries a bogus id, proving BOARD_IDS.includes(id) gates it.
  const buildView = (input) => ({
    header: { title: "L", scopeLine: "x", interred: 0, interredLabel: "I", back: false, backLabel: "" },
    strip: null,
    rail: [{ id: "not-a-real-board", tab: "X", on: true, col: "#fff" }],
    board: { id: input.board, mark: "▼", col: "#d3c49f", title: "T", rule: "R" },
    body: { kind: "empty", line: "empty" },
    standing: { label: "NO ENTRY", place: "—", note: "n" },
    footnote: "f",
    dock: null,
  });
  const { host, panel } = setup({ buildView });
  panel.openFromTab();
  const before = panel.state().board;
  const railEl = host.querySelector(".mw-bd-rail");
  railEl.children[0].onclick();
  assert.equal(panel.state().board, before);
});

// ─── row toggle (needs a rows-capable buildView) ───────────────────────

function rowsBuildView() {
  return (input) => ({
    header: { title: "L", scopeLine: "x", interred: 0, interredLabel: "I", back: input.entry === "title", backLabel: "Back" },
    strip: null,
    rail: BOARD_IDS.map((id) => ({ id, tab: id, on: id === input.board, col: "#d3c49f" })),
    board: { id: input.board, mark: "▼", col: "#d3c49f", title: "T", rule: "R" },
    body: {
      kind: "rows",
      rows: [
        { key: "a", rank: "1", top: true, podium: true, you: false, divider: "", avatar: { initials: "AA", bg: "#000" }, headline: "A", tag: "", name: "", line: "L", barPct: 100, val: "1", unit: "U", open: input.open === "a", detail: "d", stats: [{ k: "K", v: "1" }] },
        { key: "b", rank: "2", top: false, podium: false, you: false, divider: "", avatar: { initials: "BB", bg: "#000" }, headline: "B", tag: "", name: "", line: "L", barPct: 50, val: "2", unit: "U", open: input.open === "b", detail: "d", stats: [{ k: "K", v: "2" }] },
      ],
    },
    standing: { label: "NO ENTRY", place: "—", note: "n" },
    footnote: "f",
    dock: input.entry === "title" ? [{ id: "dungeon", label: "D", primary: true }, { id: "roll", label: "R", primary: false }] : null,
  });
}

test("a row's onclick opens it; another row's onclick opens that one instead; the first row's onclick again closes it; scrollTop is left untouched", () => {
  const { host, panel } = setup({ buildView: rowsBuildView() });
  panel.openFromTab();
  const bodyEl = host.querySelector(".mw-bd-body");
  bodyEl.scrollTop = 42;

  let rows = host.querySelectorAll(".mw-bd-row");
  rows[0].onclick(); // opens "a"
  assert.equal(panel.state().open, "a");
  assert.equal(host.querySelector(".mw-bd-body").scrollTop, 42, "row toggle must not reset scrollTop");

  rows = host.querySelectorAll(".mw-bd-row");
  rows[1].onclick(); // opens "b" instead
  assert.equal(panel.state().open, "b");

  rows = host.querySelectorAll(".mw-bd-row");
  rows[1].onclick(); // closes "b"
  assert.equal(panel.state().open, null);
  assert.equal(host.querySelector(".mw-bd-body").scrollTop, 42);
});

// ─── scope toggle ───────────────────────────────────────────────────────

function scopeCapableBuildView() {
  return (input) => ({
    header: { title: "L", scopeLine: "x", interred: 0, interredLabel: "I", back: false, backLabel: "" },
    strip: {
      glyph: "?",
      label: "L",
      source: "S",
      scopes: [
        { id: "all", label: "ALL", on: input.scope === "all", dim: true },
        { id: "friends", label: "FRIENDS", on: input.scope === "friends", dim: true },
      ],
    },
    rail: BOARD_IDS.map((id) => ({ id, tab: id, on: id === input.board, col: "#d3c49f" })),
    board: { id: input.board, mark: "▼", col: "#d3c49f", title: "T", rule: "R" },
    body: { kind: "note", line: "Nobody out there can see you yet." },
    standing: { label: "NO ENTRY", place: "—", note: "n" },
    footnote: "f",
    dock: null,
  });
}

test("the ALL chip's onclick sets scope all; again returns to local; ALL then FRIENDS gives friends; a board switch keeps the current scope; a scope change resets scrollTop", () => {
  const { host, panel } = setup({ buildView: scopeCapableBuildView() });
  panel.openFromTab();
  const bodyEl = host.querySelector(".mw-bd-body");
  bodyEl.scrollTop = 10;

  const allChip = () => host.querySelector(".mw-bd-scopes").querySelectorAll(".mw-bd-scope-chip").find((c) => c.dataset.scope === "all");
  const friendsChip = () => host.querySelector(".mw-bd-scopes").querySelectorAll(".mw-bd-scope-chip").find((c) => c.dataset.scope === "friends");

  allChip().onclick();
  assert.equal(panel.state().scope, "all");
  assert.equal(host.querySelector(".mw-bd-body").scrollTop, 0, "a scope change resets scrollTop");

  host.querySelector(".mw-bd-body").scrollTop = 5;
  allChip().onclick();
  assert.equal(panel.state().scope, "local");

  allChip().onclick();
  assert.equal(panel.state().scope, "all");
  friendsChip().onclick();
  assert.equal(panel.state().scope, "friends");

  const railEl = host.querySelector(".mw-bd-rail");
  railEl.children.find((c) => c.dataset.board === "lean").onclick();
  assert.equal(panel.state().scope, "friends", "a board switch must keep the current scope");
});

// ─── back routing ───────────────────────────────────────────────────────

test("back() in tab mode returns false and calls no route", () => {
  const onRoute = spy();
  const { panel } = setup({ onRoute });
  panel.openFromTab();
  assert.equal(panel.back(), false);
  assert.deepStrictEqual(onRoute.calls, []);
});

test("back() before any open() returns false and calls no route", () => {
  const onRoute = spy();
  const { panel } = setup({ onRoute });
  assert.equal(panel.back(), false);
  assert.deepStrictEqual(onRoute.calls, []);
});

test("back() in title mode with a live hero routes dungeon, clears the title marker and closes title mode", () => {
  const onRoute = spy();
  const { doc, panel } = setup({ onRoute });
  panel.openFromTitle({ hasHero: true });
  assert.equal(panel.back(), true);
  assert.deepStrictEqual(onRoute.calls, [["dungeon", { hasHero: true }]]);
  assert.equal(doc.document.body.dataset.boardsEntry, undefined);
  assert.equal(panel.isTitleOpen(), false);
});

test("back() in title mode with no hero routes title", () => {
  const onRoute = spy();
  const { panel } = setup({ onRoute });
  panel.openFromTitle({ hasHero: false });
  assert.equal(panel.back(), true);
  assert.deepStrictEqual(onRoute.calls, [["title", { hasHero: false }]]);
});

// ─── chevron + dock ─────────────────────────────────────────────────────

test("the chevron's onclick routes exactly like back(); each dock button's onclick routes onRoute(id, { hasHero })", () => {
  const onRoute = spy();
  const { host, panel } = setup({ onRoute });
  panel.openFromTitle({ hasHero: true });
  const back = host.querySelector(".mw-bd-back");
  back.onclick();
  assert.deepStrictEqual(onRoute.calls, [["dungeon", { hasHero: true }]]);

  onRoute.calls.length = 0;
  const { host: host2, panel: panel2 } = setup({ onRoute });
  panel2.openFromTitle({ hasHero: false });
  const dockBtns = host2.querySelector(".mw-bd-dock").querySelectorAll(".mw-bd-dock-btn");
  dockBtns[1].onclick(); // "roll"
  assert.deepStrictEqual(onRoute.calls, [["roll", { hasHero: false }]]);
});

// ─── onDeadTab ──────────────────────────────────────────────────────────

test("onDeadTab() calls openFromTab() in tab state and before any open; in title mode it only re-centres (buildView is not called again)", () => {
  const buildView = makeBuildView();
  const { panel } = setup({ buildView });
  const before = buildView.calls.length;
  panel.onDeadTab();
  assert.ok(buildView.calls.length > before, "expected onDeadTab() to open (call buildView) before any open");
  assert.equal(panel.state().entry, "tab");

  const buildView2 = makeBuildView();
  const { panel: panel2 } = setup({ buildView: buildView2 });
  panel2.openFromTitle({ hasHero: false });
  const afterOpen = buildView2.calls.length;
  panel2.onDeadTab();
  assert.equal(buildView2.calls.length, afterOpen, "onDeadTab() in title mode must not call buildView again");
});

// ─── centreRail / reduced motion ────────────────────────────────────────

test("centreRail(): calls scrollTo({left, behavior:'auto'}) under reduced motion, 'smooth' otherwise; without scrollTo it assigns scrollLeft; within 2px it calls nothing", () => {
  {
    const { host, panel } = setup({ reducedMotion: () => true });
    panel.openFromTab();
    const railEl = host.querySelector(".mw-bd-rail");
    const chip = railEl.children.find((c) => c.dataset.on === "1");
    chip.offsetLeft = 300;
    chip.offsetWidth = 60;
    railEl.clientWidth = 360;
    railEl.scrollWidth = 900;
    railEl.scrollLeft = 0;
    const calls = [];
    railEl.scrollTo = (opts) => calls.push(opts);
    panel.centreRail();
    assert.deepStrictEqual(calls, [{ left: 150, behavior: "auto" }]);
  }
  {
    const { host, panel } = setup({ reducedMotion: () => false });
    panel.openFromTab();
    const railEl = host.querySelector(".mw-bd-rail");
    const chip = railEl.children.find((c) => c.dataset.on === "1");
    chip.offsetLeft = 300;
    chip.offsetWidth = 60;
    railEl.clientWidth = 360;
    railEl.scrollWidth = 900;
    railEl.scrollLeft = 0;
    const calls = [];
    railEl.scrollTo = (opts) => calls.push(opts);
    panel.centreRail();
    assert.deepStrictEqual(calls, [{ left: 150, behavior: "smooth" }]);
  }
  {
    // no scrollTo present — assigns scrollLeft directly.
    const { host, panel } = setup();
    panel.openFromTab();
    const railEl = host.querySelector(".mw-bd-rail");
    const chip = railEl.children.find((c) => c.dataset.on === "1");
    chip.offsetLeft = 300;
    chip.offsetWidth = 60;
    railEl.clientWidth = 360;
    railEl.scrollWidth = 900;
    railEl.scrollLeft = 0;
    delete railEl.scrollTo;
    panel.centreRail();
    assert.equal(railEl.scrollLeft, 150);
  }
  {
    // within 2px — calls nothing.
    const { host, panel } = setup();
    panel.openFromTab();
    const railEl = host.querySelector(".mw-bd-rail");
    const chip = railEl.children.find((c) => c.dataset.on === "1");
    chip.offsetLeft = 300;
    chip.offsetWidth = 60;
    railEl.clientWidth = 360;
    railEl.scrollWidth = 900;
    railEl.scrollLeft = 149;
    const calls = [];
    railEl.scrollTo = (opts) => calls.push(opts);
    panel.centreRail();
    assert.deepStrictEqual(calls, []);
  }
});

// ─── readData failure ───────────────────────────────────────────────────

test("a readData that throws still renders (buildView receives graves [], total 0 and a null bests)", () => {
  const buildView = makeBuildView();
  const readData = () => {
    throw new Error("storage exploded");
  };
  const { host, panel } = setup({ buildView, readData });
  assert.doesNotThrow(() => panel.openFromTab());
  const lastInput = buildView.calls[buildView.calls.length - 1][0];
  assert.equal(lastInput.bests, null);
  assert.deepStrictEqual(lastInput.graves, []);
  assert.equal(lastInput.total, 0);
  assert.ok(host.querySelector(".mw-bd"), "the panel must still render");
});

// ─── refresh / state ────────────────────────────────────────────────────

test("refresh() re-renders only while the panel is open", () => {
  const buildView = makeBuildView();
  const { panel } = setup({ buildView });
  const beforeAnyOpen = buildView.calls.length;
  panel.refresh();
  assert.equal(buildView.calls.length, beforeAnyOpen, "refresh() before any open must not render");

  panel.openFromTab();
  const afterOpen = buildView.calls.length;
  panel.refresh();
  assert.equal(buildView.calls.length, afterOpen + 1);
});

test("state() returns a frozen snapshot with entry/board/scope/open/hasHero", () => {
  const { panel } = setup();
  panel.openFromTitle({ hasHero: true });
  const s = panel.state();
  assert.deepStrictEqual(s, { entry: "title", board: "yard", scope: "local", open: null, hasHero: true });
  assert.ok(Object.isFrozen(s));
});

// ─── source pins ────────────────────────────────────────────────────────

test("createBoardsPanel is exported exactly once, and BOARDS_LAST_KEY's literal appears exactly once", () => {
  assert.equal((MODULE_SRC.match(/export function createBoardsPanel/g) || []).length, 1);
  assert.equal((MODULE_SRC.match(/ddr\.boards\.last\.v1/g) || []).length, 1);
  assert.equal(BOARDS_LAST_KEY, "ddr.boards.last.v1");
});
