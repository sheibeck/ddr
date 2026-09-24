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
  const params = { host, buildView, readData, prefs, reducedMotion, onRoute };
  // Phase 67 (D-08): identity is only passed when a test supplies one, so
  // every other test exercises createBoardsPanel's signed-out default.
  if (Object.prototype.hasOwnProperty.call(overrides, "identity")) params.identity = overrides.identity;
  // Phase 68: the global/seasons/onFriendsConsent seams, likewise only when given.
  // Phase 70 (D-11): the hero seam, likewise only when given.
  for (const key of ["global", "seasons", "onFriendsConsent", "hero"]) {
    if (Object.prototype.hasOwnProperty.call(overrides, key)) params[key] = overrides[key];
  }
  const panel = createBoardsPanel(params);
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

test("every open passes scope local, open null, signedIn false and player null to buildView (no identity seam given)", () => {
  const buildView = makeBuildView();
  const { panel } = setup({ buildView });
  panel.openFromTab();
  let lastInput = buildView.calls[buildView.calls.length - 1][0];
  assert.equal(lastInput.scope, "local");
  assert.equal(lastInput.open, null);
  assert.equal(lastInput.signedIn, false);
  assert.equal(lastInput.player, null);

  panel.openFromTitle({ hasHero: true });
  lastInput = buildView.calls[buildView.calls.length - 1][0];
  assert.equal(lastInput.scope, "local");
  assert.equal(lastInput.open, null);
  assert.equal(lastInput.signedIn, false);
  assert.equal(lastInput.player, null);
});

// ─── Phase 67 (D-08): the injected identity() seam ──────────────────────

function lastBuildInput(buildView) {
  return buildView.calls[buildView.calls.length - 1][0];
}

test("identity(): a signed-in answer reaches buildView as signedIn true and that player on every render", () => {
  const buildView = makeBuildView();
  const player = { id: "p", displayName: "Lanternjaw" };
  const { host, panel } = setup({ buildView, identity: () => ({ signedIn: true, player }) });
  panel.openFromTab();
  assert.equal(lastBuildInput(buildView).signedIn, true);
  assert.deepStrictEqual(lastBuildInput(buildView).player, player);

  // A board switch re-renders and re-reads the identity.
  host.querySelector(".mw-bd-rail").children.find((c) => c.dataset.board === "kills").onclick();
  assert.equal(lastBuildInput(buildView).board, "kills");
  assert.equal(lastBuildInput(buildView).signedIn, true);
  assert.deepStrictEqual(lastBuildInput(buildView).player, player);

  panel.openFromTitle({ hasHero: false });
  assert.equal(lastBuildInput(buildView).signedIn, true);
  assert.deepStrictEqual(lastBuildInput(buildView).player, player);
});

test("identity(): signed out drops the player; a truthy-but-not-true signedIn is signed out; a missing player is null", () => {
  const cases = [
    [{ signedIn: false, player: { id: "x", displayName: "X" } }, false, null],
    [{ signedIn: "true", player: { id: "x", displayName: "X" } }, false, null],
    [{ signedIn: true }, true, null],
    [{ signedIn: true, player: null }, true, null],
  ];
  for (const [answer, signedIn, player] of cases) {
    const buildView = makeBuildView();
    const { panel } = setup({ buildView, identity: () => answer });
    panel.openFromTab();
    assert.equal(lastBuildInput(buildView).signedIn, signedIn, JSON.stringify(answer));
    assert.equal(lastBuildInput(buildView).player, player, JSON.stringify(answer));
  }
});

test("identity(): a throwing, non-object or non-function identity renders signed out and the panel still renders", () => {
  const variants = [
    () => {
      throw new Error("boom");
    },
    () => null,
    () => "signed-in",
    null,
    "not a function",
  ];
  for (const identity of variants) {
    const buildView = makeBuildView();
    const { host, panel } = setup({ buildView, identity });
    assert.doesNotThrow(() => panel.openFromTab());
    assert.equal(buildView.calls.length, 1);
    assert.equal(lastBuildInput(buildView).signedIn, false);
    assert.equal(lastBuildInput(buildView).player, null);
    assert.ok(host.querySelector(".mw-bd"), "the panel rendered");
  }
});

test("refresh() re-reads identity() while open and does nothing while closed", () => {
  const buildView = makeBuildView();
  let answer = { signedIn: false, player: null };
  const { panel } = setup({ buildView, identity: () => answer });

  answer = { signedIn: true, player: { id: "p", displayName: "Lanternjaw" } };
  panel.refresh();
  assert.equal(buildView.calls.length, 0, "closed: no render");

  panel.openFromTab();
  assert.equal(lastBuildInput(buildView).signedIn, true);

  answer = { signedIn: false, player: { id: "p", displayName: "Lanternjaw" } };
  panel.refresh();
  assert.equal(buildView.calls.length, 2);
  assert.equal(lastBuildInput(buildView).signedIn, false);
  assert.equal(lastBuildInput(buildView).player, null);

  answer = { signedIn: true, player: { id: "q", displayName: "Moss" } };
  panel.refresh();
  assert.equal(lastBuildInput(buildView).signedIn, true);
  assert.equal(lastBuildInput(buildView).player.displayName, "Moss");
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

test("state() returns a frozen snapshot with entry/board/scope/open/hasHero/season/lineage", () => {
  const { panel } = setup();
  panel.openFromTitle({ hasHero: true });
  const s = panel.state();
  assert.deepStrictEqual(s, { entry: "title", board: "yard", scope: "local", open: null, hasHero: true, season: 1, lineage: null });
  assert.ok(Object.isFrozen(s));
});

// ─── Phase 70 (D-09, D-11): the LINEAGE selection and the hero seam ─────

/**
 * lineageBuildView() — a LINEAGE-aware fake view: on "combo" a two-row
 * picker resolved like boardsView (selection per field, else hero, else
 * Human + Wizard), null elsewhere; one openable row keyed "r1".
 */
function lineageBuildView() {
  const calls = [];
  const inner = makeBuildView();
  const fn = (input) => {
    calls.push([input]);
    const view = inner(input);
    view.body = { kind: "rows", rows: [{ key: "r1", rank: "1", top: true, podium: true, you: false, divider: "", avatar: { initials: "AB", bg: "#000" }, headline: "A", tag: "", name: "", line: "l", barPct: 100, val: "1", unit: "FLOOR", open: input.open === "r1", detail: "", stats: [] }] };
    if (input.board === "combo") {
      const race = (input.lineage && input.lineage.race) || (input.hero && input.hero.race) || "Human";
      const sub = (input.lineage && input.lineage.sub) || (input.hero && input.hero.sub) || "Wizard";
      const chips = (ids, on) => ids.map((id) => ({ id, label: id.toUpperCase(), on: id === on }));
      view.picker = {
        race,
        sub,
        rows: [
          { kind: "race", label: "RACE", chips: chips(["Human", "Elven", "Dwarven", "Troll"], race) },
          { kind: "sub", label: "SUB-CLASS", chips: chips(["Wizard", "Knight", "Acrobat"], sub) },
        ],
      };
    } else {
      view.picker = null;
    }
    return view;
  };
  fn.calls = calls;
  return fn;
}

function pickChip(host, kind, id) {
  const row = host.querySelector(".mw-bd-lineage").children.find((r) => r.dataset.kind === kind);
  return row.children[1].children.find((c) => c.dataset.id === id);
}

function pickChips(host, kind) {
  return host.querySelector(".mw-bd-lineage").children.find((r) => r.dataset.kind === kind).children[1];
}

function railChip(host, id) {
  return host.querySelector(".mw-bd-rail").children.find((c) => c.dataset.board === id);
}

test("LINEAGE selection (D-11): every open passes lineage null; the rendered picker is pinned and kept across board, scope, row and refresh renders", () => {
  const buildView = lineageBuildView();
  const { host, panel } = setup({ buildView, prefs: fakePrefs({ [BOARDS_LAST_KEY]: "combo" }) });
  panel.openFromTab();
  assert.equal(lastBuildInput(buildView).lineage, null);
  assert.deepStrictEqual(panel.state().lineage, { race: "Human", sub: "Wizard" });

  pickChip(host, "race", "Troll").onclick();
  assert.deepStrictEqual(lastBuildInput(buildView).lineage, { race: "Troll", sub: "Wizard" });

  railChip(host, "deep").onclick();
  assert.deepStrictEqual(lastBuildInput(buildView).lineage, { race: "Troll", sub: "Wizard" });
  railChip(host, "combo").onclick();
  assert.deepStrictEqual(lastBuildInput(buildView).lineage, { race: "Troll", sub: "Wizard" });
  host.querySelector(".mw-bd-row").onclick();
  assert.deepStrictEqual(lastBuildInput(buildView).lineage, { race: "Troll", sub: "Wizard" });
  panel.refresh();
  assert.deepStrictEqual(lastBuildInput(buildView).lineage, { race: "Troll", sub: "Wizard" });
  assert.deepStrictEqual(panel.state().lineage, { race: "Troll", sub: "Wizard" });
  assert.ok(Object.isFrozen(panel.state().lineage));

  panel.openFromTab();
  assert.equal(lastBuildInput(buildView).lineage, null, "re-defaults on every open");
  pickChip(host, "sub", "Acrobat").onclick();
  panel.openFromTitle({ hasHero: false });
  assert.equal(lastBuildInput(buildView).lineage, null, "the title open re-defaults too");
});

test("onLineage: a sub chip keeps the held race, clears the open row and resets the body's scroll", () => {
  const buildView = lineageBuildView();
  const { host, panel } = setup({ buildView, prefs: fakePrefs({ [BOARDS_LAST_KEY]: "combo" }) });
  panel.openFromTab();
  pickChip(host, "race", "Elven").onclick();
  host.querySelector(".mw-bd-row").onclick();
  assert.equal(lastBuildInput(buildView).open, "r1");
  host.querySelector(".mw-bd-body").scrollTop = 40;

  pickChip(host, "sub", "Knight").onclick();
  const input = lastBuildInput(buildView);
  assert.deepStrictEqual(input.lineage, { race: "Elven", sub: "Knight" });
  assert.equal(input.open, null);
  assert.equal(host.querySelector(".mw-bd-body").scrollTop, 0);
});

test("onLineage: an unknown kind or a non-string id is ignored (no render)", () => {
  const inner = lineageBuildView();
  const buildView = (input) => {
    const view = inner(input);
    if (view.picker) {
      view.picker.rows = [
        { kind: "bogus", label: "X", chips: [{ id: "Troll", label: "TROLL", on: false }] },
        { kind: "race", label: "RACE", chips: [{ id: 5, label: "FIVE", on: false }, { id: null, label: "NULL", on: false }] },
      ];
    }
    return view;
  };
  buildView.calls = inner.calls;
  const { host, panel } = setup({ buildView, prefs: fakePrefs({ [BOARDS_LAST_KEY]: "combo" }) });
  panel.openFromTab();
  const before = inner.calls.length;
  const section = host.querySelector(".mw-bd-lineage");
  for (const row of section.children) for (const chip of row.children[1].children) chip.onclick();
  assert.equal(inner.calls.length, before);
});

test("hero seam (D-11): tab mode passes a fresh { race, sub }; title mode without a resumable hero never asks; with one it passes", () => {
  const hero = spy();
  hero.ret = { race: "Elven", sub: "Knight", level: 3 };
  const buildView = lineageBuildView();
  const { panel } = setup({ buildView, hero });
  panel.openFromTab();
  assert.deepStrictEqual(lastBuildInput(buildView).hero, { race: "Elven", sub: "Knight" });
  assert.ok(hero.calls.length >= 1);

  const asked = hero.calls.length;
  panel.openFromTitle({ hasHero: false });
  assert.equal(lastBuildInput(buildView).hero, null);
  assert.equal(hero.calls.length, asked, "boot's throwaway hero is not live — the seam is not asked");

  panel.openFromTitle({ hasHero: true });
  assert.deepStrictEqual(lastBuildInput(buildView).hero, { race: "Elven", sub: "Knight" });
});

test("hero seam: a throwing, non-function, missing or malformed answer is null and the panel still renders", () => {
  const answers = [
    () => {
      throw new Error("boom");
    },
    5,
    () => null,
    () => "Elven Knight",
    () => ({ race: "Elven" }),
    () => ({ race: 3, sub: "Knight" }),
  ];
  for (const hero of answers) {
    const buildView = lineageBuildView();
    const { host, panel } = setup({ buildView, hero });
    assert.doesNotThrow(() => panel.openFromTab());
    assert.equal(lastBuildInput(buildView).hero, null);
    assert.ok(host.querySelector(".mw-bd"));
  }
  const buildView = lineageBuildView();
  const { panel } = setup({ buildView });
  panel.openFromTab();
  assert.equal(lastBuildInput(buildView).hero, null, "the default seam answers no hero");
});

test("picker centring: reset renders scroll each row toward its on chip ('smooth', or 'auto' under reduced motion, scrollLeft without scrollTo); row toggles do not", () => {
  for (const reduced of [false, true]) {
    const buildView = lineageBuildView();
    const { host, panel } = setup({ buildView, reducedMotion: () => reduced, prefs: fakePrefs({ [BOARDS_LAST_KEY]: "combo" }) });
    panel.openFromTab();
    const subChips = pickChips(host, "sub");
    subChips.clientWidth = 360;
    subChips.scrollWidth = 900;
    subChips.scrollLeft = 200;
    const calls = [];
    subChips.scrollTo = (opts) => calls.push(opts);

    host.querySelector(".mw-bd-row").onclick();
    assert.deepStrictEqual(calls, [], "a row toggle never re-centres the picker");

    pickChip(host, "race", "Dwarven").onclick();
    assert.deepStrictEqual(calls, [{ left: 0, behavior: reduced ? "auto" : "smooth" }]);
  }
  {
    const buildView = lineageBuildView();
    const { host, panel } = setup({ buildView, prefs: fakePrefs({ [BOARDS_LAST_KEY]: "combo" }) });
    panel.openFromTab();
    const raceChips = pickChips(host, "race");
    raceChips.clientWidth = 360;
    raceChips.scrollWidth = 900;
    raceChips.scrollLeft = 120;
    delete raceChips.scrollTo;
    railChip(host, "combo").onclick();
    assert.equal(raceChips.scrollLeft, 0, "no scrollTo: scrollLeft is assigned");
    raceChips.scrollLeft = 1;
    const calls = [];
    raceChips.scrollTo = (opts) => calls.push(opts);
    railChip(host, "combo").onclick();
    assert.deepStrictEqual(calls, [], "within 2px: nothing");
  }
});

test("LINEAGE (D-13): global() is asked exactly { board: 'combo', scope, season } — once per render, nothing new on a chip tap", () => {
  const inner = lineageBuildView();
  const buildView = (input) => {
    const view = inner(input);
    view.strip = {
      glyph: "",
      avatar: null,
      label: "L",
      source: "S",
      scopes: [
        { id: "all", label: "ALL", on: input.scope === "all", dim: false },
        { id: "friends", label: "FRIENDS", on: input.scope === "friends", dim: false },
      ],
    };
    return view;
  };
  buildView.calls = inner.calls;
  const global = spy();
  global.ret = { status: "ready", entries: [] };
  const { host, panel } = setup({ buildView, identity: SIGNED_IN, global, prefs: fakePrefs({ [BOARDS_LAST_KEY]: "combo" }) });
  panel.openFromTab();
  assert.equal(global.calls.length, 0, "the local scope asks nothing");
  scopeChip(host, "all").onclick();
  assert.deepStrictEqual(global.calls, [[{ board: "combo", scope: "all", season: 1 }]]);
  pickChip(host, "sub", "Knight").onclick();
  assert.deepStrictEqual(global.calls, [[{ board: "combo", scope: "all", season: 1 }], [{ board: "combo", scope: "all", season: 1 }]]);
});

// ─── Phase 68 (D-05..D-08): the global, seasons and onFriendsConsent seams ──

const SIGNED_IN = () => ({ signedIn: true, player: { id: "p1", displayName: "Lanternjaw" } });

/** globalBuildView() — scope chips, a season picker from input.seasons, and a consent body on FRIENDS. */
function globalBuildView() {
  const calls = [];
  const fn = (input) => {
    calls.push([input]);
    const view = scopeCapableBuildView()(input);
    view.header.season = {
      label: `SEASON ${input.season}`,
      picker: input.seasons.length >= 2 ? input.seasons.map((n) => ({ n, label: `SEASON ${n}`, on: n === input.season })) : null,
    };
    view.body =
      input.scope === "friends"
        ? { kind: "consent", line: "c", action: { id: "friendsConsent", label: "SHOW MY FRIENDS" } }
        : { kind: "rows", rows: [{ key: "r1", rank: "1", top: true, podium: true, you: false, divider: "", avatar: { initials: "AB", bg: "#000" }, headline: "A", tag: "", name: "", line: "l", barPct: 100, val: "1", unit: "FLOOR", open: input.open === "r1", detail: "", stats: [] }] };
    view.standing = null;
    return view;
  };
  fn.calls = calls;
  return fn;
}

function scopeChip(host, id) {
  return host.querySelector(".mw-bd-scopes").querySelectorAll(".mw-bd-scope-chip").find((c) => c.dataset.scope === id);
}

test("global(): called only when signed in, on ALL/FRIENDS, off GRAVEYARD — its answer reaches buildView as global", () => {
  const buildView = globalBuildView();
  const answer = Object.freeze({ status: "ready", entries: [] });
  const global = spy();
  global.ret = answer;
  const { host, panel } = setup({ buildView, identity: SIGNED_IN, global });

  panel.openFromTab();
  assert.equal(global.calls.length, 0, "local scope asks nothing");
  assert.equal(lastBuildInput(buildView).global, null);

  scopeChip(host, "all").onclick();
  assert.equal(global.calls.length, 1);
  assert.deepStrictEqual(global.calls[0], [{ board: "deep", scope: "all", season: 1 }]);
  assert.equal(lastBuildInput(buildView).global, answer);

  scopeChip(host, "friends").onclick();
  assert.deepStrictEqual(global.calls[1], [{ board: "deep", scope: "friends", season: 1 }]);

  host.querySelector(".mw-bd-rail").children.find((c) => c.dataset.board === "yard").onclick();
  assert.equal(global.calls.length, 2, "GRAVEYARD stays local (D-17)");
  assert.equal(lastBuildInput(buildView).global, null);

  host.querySelector(".mw-bd-rail").children.find((c) => c.dataset.board === "combo").onclick();
  assert.deepStrictEqual(global.calls[2], [{ board: "combo", scope: "friends", season: 1 }]);
});

test("global(): signed out (or Compete OFF), opening ALL and FRIENDS calls global zero times", () => {
  const buildView = globalBuildView();
  const global = spy();
  const { host, panel } = setup({ buildView, identity: () => ({ signedIn: false, player: null }), global });
  panel.openFromTab();
  scopeChip(host, "all").onclick();
  scopeChip(host, "friends").onclick();
  panel.refresh();
  assert.equal(global.calls.length, 0);
  assert.equal(lastBuildInput(buildView).global, null);
});

test("global(): a throwing or non-function global passes null and the panel still renders", () => {
  for (const global of [
    () => {
      throw new Error("boom");
    },
    "not a function",
    null,
  ]) {
    const buildView = globalBuildView();
    const { host, panel } = setup({ buildView, identity: SIGNED_IN, global });
    panel.openFromTab();
    assert.doesNotThrow(() => scopeChip(host, "all").onclick());
    assert.equal(panel.state().scope, "all");
    assert.equal(lastBuildInput(buildView).global, null);
    assert.ok(host.querySelector(".mw-bd-row"), "the panel rendered");
  }
});

test("without the Phase 68 seams, buildView gets global null, season 1 and seasons [1]", () => {
  const buildView = makeBuildView();
  const { panel } = setup({ buildView, identity: SIGNED_IN });
  panel.openFromTab();
  const input = lastBuildInput(buildView);
  assert.equal(input.global, null);
  assert.equal(input.season, 1);
  assert.deepStrictEqual(input.seasons, [1]);
});

test("seasons(): the viewed season starts at current on every open; onSeason switches only to a known season, clears the open row and resets scroll", () => {
  const buildView = globalBuildView();
  const global = spy();
  const { host, panel } = setup({ buildView, identity: SIGNED_IN, global, seasons: () => ({ current: 2, all: [1, 2] }) });
  panel.openFromTab();
  assert.equal(panel.state().season, 2);
  assert.equal(lastBuildInput(buildView).season, 2);
  assert.deepStrictEqual(lastBuildInput(buildView).seasons, [1, 2]);

  scopeChip(host, "all").onclick();
  host.querySelector(".mw-bd-row").onclick();
  assert.equal(panel.state().open, "r1");
  host.querySelector(".mw-bd-body").scrollTop = 40;

  const chip = (n) => host.querySelector(".mw-bd-seasons").querySelectorAll(".mw-bd-season-chip").find((c) => c.dataset.season === String(n));
  chip(1).onclick();
  assert.equal(panel.state().season, 1);
  assert.equal(panel.state().open, null);
  assert.equal(host.querySelector(".mw-bd-body").scrollTop, 0);
  assert.deepStrictEqual(global.calls[global.calls.length - 1], [{ board: "deep", scope: "all", season: 1 }]);

  // refresh() keeps the viewed season.
  panel.refresh();
  assert.equal(panel.state().season, 1);
  assert.equal(lastBuildInput(buildView).season, 1);

  panel.openFromTitle({ hasHero: false });
  assert.equal(panel.state().season, 2, "openFromTitle resets to the current season");
  panel.openFromTab();
  assert.equal(panel.state().season, 2, "openFromTab resets to the current season");
});

test("seasons(): onSeason ignores a season outside seasons().all", () => {
  let seasonsAnswer = { current: 2, all: [1, 2] };
  const buildView = globalBuildView();
  const { host, panel } = setup({ buildView, identity: SIGNED_IN, seasons: () => seasonsAnswer });
  panel.openFromTab();
  scopeChip(host, "all").onclick();
  const chip1 = host.querySelector(".mw-bd-seasons").querySelectorAll(".mw-bd-season-chip").find((c) => c.dataset.season === "1");
  seasonsAnswer = { current: 2, all: [2] }; // season 1 withdrawn between render and tap
  const before = buildView.calls.length;
  chip1.onclick();
  assert.equal(panel.state().season, 2);
  assert.equal(buildView.calls.length, before, "no re-render for an unknown season");
});

test("seasons(): a throwing or malformed seasons() falls back to season 1 of [1]", () => {
  for (const seasons of [
    () => {
      throw new Error("boom");
    },
    () => null,
    () => ({ current: -1, all: "x" }),
    "not a function",
  ]) {
    const buildView = globalBuildView();
    const { panel } = setup({ buildView, identity: SIGNED_IN, seasons });
    assert.doesNotThrow(() => panel.openFromTab());
    assert.equal(panel.state().season, 1);
    assert.equal(lastBuildInput(buildView).season, 1);
    assert.deepStrictEqual(lastBuildInput(buildView).seasons, [1]);
  }
});

test("onConsent: the SHOW MY FRIENDS button calls onFriendsConsent once; a missing or throwing handler never throws", () => {
  const onFriendsConsent = spy();
  {
    const buildView = globalBuildView();
    const { host, panel } = setup({ buildView, identity: SIGNED_IN, onFriendsConsent });
    panel.openFromTab();
    scopeChip(host, "friends").onclick();
    host.querySelector(".mw-bd-consent").onclick();
    assert.equal(onFriendsConsent.calls.length, 1);
  }
  for (const handler of [
    undefined,
    () => {
      throw new Error("boom");
    },
    "not a function",
  ]) {
    const buildView = globalBuildView();
    const overrides = { buildView, identity: SIGNED_IN };
    if (handler !== undefined) overrides.onFriendsConsent = handler;
    const { host, panel } = setup(overrides);
    panel.openFromTab();
    scopeChip(host, "friends").onclick();
    assert.doesNotThrow(() => host.querySelector(".mw-bd-consent").onclick());
  }
});

test("source pins (Phase 68): createBoardsPanel names the global, seasons and onFriendsConsent seams", () => {
  assert.match(MODULE_SRC, /onFriendsConsent/);
  assert.match(MODULE_SRC, /global\(/);
  assert.match(MODULE_SRC, /mw-bd-consent/);
});

// ─── source pins ────────────────────────────────────────────────────────

test("createBoardsPanel is exported exactly once, and BOARDS_LAST_KEY's literal appears exactly once", () => {
  assert.equal((MODULE_SRC.match(/export function createBoardsPanel/g) || []).length, 1);
  assert.equal((MODULE_SRC.match(/ddr\.boards\.last\.v1/g) || []).length, 1);
  assert.equal(BOARDS_LAST_KEY, "ddr.boards.last.v1");
});
