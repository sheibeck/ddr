// test/unit/leaderboardPanel-dom.test.js
//
// Phase 84 (BOARD-18..25), Plan 06 Task 1 — recordingDom tests of
// renderLeaderboardPanel/LEADERBOARD_CLASSES against hand-built views in the
// 84-05 leaderboardView.js shape. Mirrors boardsPanel-dom.test.js's own
// createRecordingDocument() + comment-stripped source-pin approach
// (stripJs from tools/ident-sweep.mjs).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { createRecordingDocument } from "./harness/recordingDom.js";
import { stripJs } from "../../tools/ident-sweep.mjs";
import { renderLeaderboardPanel, LEADERBOARD_CLASSES } from "../../src/browser/leaderboardPanel.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const MODULE_PATH = path.join(REPO_ROOT, "src", "browser", "leaderboardPanel.js");
const MODULE_SRC = fs.readFileSync(MODULE_PATH, "utf8").replace(/\r\n/g, "\n");
const STRIPPED = stripJs(MODULE_SRC);

function spy() {
  const fn = (...args) => fn.calls.push(args);
  fn.calls = [];
  return fn;
}

// ─── fixtures ────────────────────────────────────────────────────────────

function makeRow(overrides = {}) {
  return {
    key: "hero-a",
    rank: "1",
    top: true,
    podium: true,
    you: false,
    divider: "",
    headline: "HILDA FERROW",
    tag: "",
    line: "DWARVEN THIEF · I",
    val: "6",
    unit: "FLOOR",
    open: false,
    detail: "",
    stats: [],
    dateLine: "",
    avatar: { initials: "HF", bg: "#6b5c3c", on: false },
    ...overrides,
  };
}

function makeOpenRow(overrides = {}) {
  return makeRow({
    key: "hero-b",
    rank: "",
    top: false,
    podium: false,
    you: true,
    divider: "NOT IN THE TOP TEN · YOUR BEST",
    headline: "@lanternjaw",
    tag: "YOU",
    line: "ODO BELL · HALFLING CLERIC · I",
    val: "654321",
    unit: "FLOOR",
    open: true,
    detail: "Cut down by a Rat King. Two floors, one rat, no prayers answered.",
    stats: [
      { k: "FLOOR", v: "2" },
      { k: "DAYS", v: "3" },
      { k: "SQUARES", v: "88" },
      { k: "KILLS", v: "1" },
      { k: "EXP", v: "90" },
      { k: "WILMST", v: "420" },
    ],
    dateLine: "Died 28 Sep 2026 · 2.1.0 (11)",
    avatar: { initials: "OB", bg: "#4a5c6b", on: true },
    ...overrides,
  });
}

// makeView(overrides) — a full board-mode view exercising every optional
// part: the back chevron, the season line, an open row with a divider, tag,
// detail/stats/date line, the standing card and the dock. Individual tests
// override specific parts to exercise the "off" branches.
function makeView(overrides = {}) {
  const base = {
    mode: "board",
    entry: "title",
    stat: "deep",
    col: "#d3c49f",
    header: {
      title: "LEADERBOARD",
      scopeLine: "Everyone's dead. Top ten shown.",
      seasonLine: "SEASON OF THE ALPHA",
      back: true,
      backLabel: "Back to the title",
      box: { n: "12", label: "YOURS ›", action: "mine" },
    },
    pickers: [
      { id: "stat", label: "RANK BY", value: "DEPTH", col: "#d3c49f", active: true },
      { id: "race", label: "RACE", value: "ANY", col: "", active: false },
      { id: "sub", label: "SUB-CLASS", value: "ANY", col: "", active: false },
    ],
    body: { kind: "rows", rows: [makeRow(), makeOpenRow()] },
    staleLine: "",
    standing: { note: "@lanternjaw's best, of 37 interred as any race, any sub-class.", place: "4TH" },
    sheet: null,
    dock: [
      { id: "dungeon", label: "BACK TO THE DUNGEON", primary: true },
      { id: "roll", label: "ROLL A NEW HERO", primary: false },
    ],
  };
  return { ...base, ...overrides };
}

function renderFresh(view, handlers = {}) {
  const doc = createRecordingDocument();
  const host = doc.document.getElementById("screen-dead");
  const root = renderLeaderboardPanel(host, view, handlers);
  return { doc, host, root };
}

function walkAll(node, out = []) {
  out.push(node);
  for (const child of node.children || []) walkAll(child, out);
  return out;
}

function findAll(root, className) {
  return walkAll(root).filter((n) => n.nodeType !== 3 && (n.className || "").split(/\s+/).includes(className));
}

function find(root, className) {
  return findAll(root, className)[0] || null;
}

// ─── skeleton identity ──────────────────────────────────────────────────

test("skeleton: first render creates exactly one .mw-lb root with the five sections in order; a second render reuses root/head/body", () => {
  const view = makeView();
  const { doc, host, root } = renderFresh(view);
  assert.equal(host.children.filter((c) => c.className === "mw-lb").length, 1);
  const classes = root.children.map((c) => c.className);
  assert.deepStrictEqual(classes, ["mw-lb-head", "mw-lb-pickers", "mw-lb-body", "mw-lb-dock", "mw-lb-sheet"]);

  const body1 = root.querySelector(".mw-lb-body");
  body1.scrollTop = 55;

  const root2 = renderLeaderboardPanel(host, view, {});
  assert.equal(root2, root, "second render reuses the same root");
  assert.equal(host.children.filter((c) => c.className === "mw-lb").length, 1, "no duplicate root");
  const body2 = root2.querySelector(".mw-lb-body");
  assert.equal(body2, body1, "body section element reused");
  assert.equal(body2.scrollTop, 55, "scroll position survives the re-render");
});

test("root.dataset.mode and root.dataset.entry carry view.mode and view.entry", () => {
  const { root } = renderFresh(makeView({ mode: "mine", entry: "tab" }));
  assert.equal(root.dataset.mode, "mine");
  assert.equal(root.dataset.entry, "tab");
});

// ─── head ─────────────────────────────────────────────────────────────────

test("head: the back button exists only when view.header.back, shows the chevron glyph with the aria-label, and calls onBack", () => {
  const onBack = spy();
  const { root } = renderFresh(makeView(), { onBack });
  const back = find(root, "mw-lb-back");
  assert.ok(back, "expected a .mw-lb-back button");
  assert.equal(back.textContent, "◀");
  assert.equal(back.getAttribute("aria-label"), "Back to the title");
  back.onclick();
  assert.equal(onBack.calls.length, 1);

  const noBack = renderFresh(makeView({ header: { ...makeView().header, back: false } })).root;
  assert.equal(find(noBack, "mw-lb-back"), null, "no back button when view.header.back is false");
});

test("head: the header box is a button with data-action when the box has an action, and calls onBox(action)", () => {
  const onBox = spy();
  const { root } = renderFresh(makeView(), { onBox });
  const box = find(root, "mw-lb-box");
  assert.equal(box.tagName, "button");
  assert.equal(box.dataset.action, "mine");
  box.onclick();
  assert.deepStrictEqual(onBox.calls, [["mine"]]);
  assert.equal(find(box, "mw-lb-box-n").textContent, "12");
  assert.equal(find(box, "mw-lb-box-label").textContent, "YOURS ›");
});

test("head: the header box is a static element with data-static '1' when the box has no action", () => {
  const view = makeView({ header: { ...makeView().header, box: { n: "5", label: "INTERRED", action: null } } });
  const { root } = renderFresh(view);
  const box = find(root, "mw-lb-box");
  assert.equal(box.tagName, "div");
  assert.equal(box.dataset.static, "1");
  assert.equal(box.dataset.action, undefined);
});

test("head: the season line element always exists and is hidden only when its text is empty", () => {
  const shown = renderFresh(makeView()).root;
  const seasonShown = find(shown, "mw-lb-season");
  assert.ok(seasonShown);
  assert.equal(seasonShown.hidden, false);
  assert.equal(seasonShown.textContent, "SEASON OF THE ALPHA");

  const hidden = renderFresh(makeView({ header: { ...makeView().header, seasonLine: "" } })).root;
  const seasonHidden = find(hidden, "mw-lb-season");
  assert.ok(seasonHidden);
  assert.equal(seasonHidden.hidden, true);
});

test("head: title and scope text render verbatim from the view", () => {
  const { root } = renderFresh(makeView());
  assert.equal(find(root, "mw-lb-title").textContent, "LEADERBOARD");
  assert.equal(find(root, "mw-lb-scope").textContent, "Everyone's dead. Top ten shown.");
});

// ─── pickers ────────────────────────────────────────────────────────────

test("pickers: each is a button with data-picker/data-active, its label, coloured value and an empty caret span, calling onPicker(id)", () => {
  const onPicker = spy();
  const { root } = renderFresh(makeView(), { onPicker });
  const pickers = findAll(root, "mw-lb-picker");
  assert.equal(pickers.length, 3);

  const statPicker = pickers[0];
  assert.equal(statPicker.dataset.picker, "stat");
  assert.equal(statPicker.dataset.active, "1");
  assert.equal(find(statPicker, "mw-lb-picker-label").textContent, "RANK BY");
  const val = find(statPicker, "mw-lb-picker-val");
  assert.equal(val.textContent, "DEPTH");
  assert.equal(val.style.color, "#d3c49f");
  const caret = find(statPicker, "mw-lb-caret");
  assert.ok(caret);
  assert.equal(caret.textContent, "");
  assert.equal(caret.getAttribute("aria-hidden"), "true");

  statPicker.onclick();
  const racePicker = pickers[1];
  assert.equal(racePicker.dataset.picker, "race");
  assert.equal(racePicker.dataset.active, "0");
  racePicker.onclick();
  const subPicker = pickers[2];
  subPicker.onclick();
  assert.deepStrictEqual(onPicker.calls, [["stat"], ["race"], ["sub"]]);
});

// ─── rows ───────────────────────────────────────────────────────────────

test("rows: a plain top row carries data-key/data-top/data-podium/data-you/data-open, role/tabindex/aria-expanded, and the stat colour inline", () => {
  const { root } = renderFresh(makeView());
  const rows = findAll(root, "mw-lb-row");
  assert.equal(rows.length, 2);
  const top = rows[0];
  assert.equal(top.dataset.key, "hero-a");
  assert.equal(top.dataset.top, "1");
  assert.equal(top.dataset.podium, "1");
  assert.equal(top.dataset.you, "0");
  assert.equal(top.dataset.open, "0");
  assert.equal(top.getAttribute("role"), "button");
  assert.equal(top.getAttribute("tabindex"), "0");
  assert.equal(top.getAttribute("aria-expanded"), "false");
  assert.match(top.style.boxShadow, /#d3c49f/);
  assert.equal(find(top, "mw-lb-rank").style.color, "#d3c49f");
  assert.equal(find(top, "mw-lb-val").style.color, "#d3c49f");
  assert.equal(find(top, "mw-lb-tag"), null, "no tag span when row.tag is empty");
});

test("rows: tapping a row calls onRow(key)", () => {
  const onRow = spy();
  const { root } = renderFresh(makeView(), { onRow });
  const rows = findAll(root, "mw-lb-row");
  rows[0].onclick();
  rows[1].onclick();
  assert.deepStrictEqual(onRow.calls, [["hero-a"], ["hero-b"]]);
});

test("rows: a divider row renders .mw-lb-divider (dots + label) immediately before its row", () => {
  const { root } = renderFresh(makeView());
  const entries = findAll(root, "mw-lb-entry");
  assert.equal(entries.length, 2);
  assert.equal(find(entries[0], "mw-lb-divider"), null, "no divider on the first row");
  const divider = find(entries[1], "mw-lb-divider");
  assert.ok(divider);
  assert.equal(find(divider, "mw-lb-divider-dots").textContent, "···");
  assert.equal(find(divider, "mw-lb-divider-label").textContent, "NOT IN THE TOP TEN · YOUR BEST");
});

test("rows: the tag span renders only when row.tag is non-empty", () => {
  const { root } = renderFresh(makeView());
  const rows = findAll(root, "mw-lb-row");
  const tag = find(rows[1], "mw-lb-tag");
  assert.ok(tag);
  assert.equal(tag.textContent, "YOU");
});

test("rows: an open row adds .mw-lb-detail with the detail text, six .mw-lb-stat chips and the date line", () => {
  const { root } = renderFresh(makeView());
  const rows = findAll(root, "mw-lb-row");
  const openRow = rows[1];
  assert.equal(openRow.dataset.open, "1");
  assert.equal(openRow.getAttribute("aria-expanded"), "true");
  const detail = find(openRow, "mw-lb-detail");
  assert.ok(detail);
  assert.equal(find(detail, "mw-lb-detail-text").textContent, "Cut down by a Rat King. Two floors, one rat, no prayers answered.");
  const chips = findAll(detail, "mw-lb-stat");
  assert.equal(chips.length, 6);
  assert.equal(find(chips[0], "mw-lb-stat-k").textContent, "FLOOR");
  assert.equal(find(chips[0], "mw-lb-stat-v").textContent, "2");
  const date = find(detail, "mw-lb-date");
  assert.ok(date);
  assert.equal(date.textContent, "Died 28 Sep 2026 · 2.1.0 (11)");
});

test("BOARD-29 rows: an open row shows the who line first and a FILTER LIKE THIS button that never toggles the row", () => {
  const onRow = spy();
  const onRowMenu = spy();
  const view = makeView({
    body: { kind: "rows", rows: [makeOpenRow({ who: "Dwarven · Wizard (Magic User)", race: "Dwarven", sub: "Wizard", filterLabel: "FILTER LIKE THIS" })] },
  });
  const { root } = renderFresh(view, { onRow, onRowMenu });
  const detail = find(root, "mw-lb-detail");
  const who = find(detail, "mw-lb-detail-who");
  assert.ok(who);
  assert.equal(who.textContent, "Dwarven · Wizard (Magic User)");
  assert.equal(detail.children[0], who, "the who line is the detail's first child");
  const btn = find(detail, "mw-lb-detail-filter");
  assert.ok(btn);
  assert.equal(btn.tagName, "button");
  assert.equal(btn.type, "button");
  assert.equal(btn.textContent, "FILTER LIKE THIS");
  const stop = spy();
  btn.onclick({ stopPropagation: stop });
  assert.equal(onRowMenu.calls.length, 1);
  assert.deepEqual(onRowMenu.calls[0], ["hero-b"]);
  assert.equal(stop.calls.length, 1, "the click never bubbles to the row");
  assert.equal(onRow.calls.length, 0);
  assert.doesNotThrow(() => btn.onclick());
});

test("BOARD-29 rows: a row with no who and no filter label renders neither", () => {
  const view = makeView({ body: { kind: "rows", rows: [makeOpenRow({ who: "", filterLabel: "" })] } });
  const { root } = renderFresh(view);
  assert.equal(find(root, "mw-lb-detail-who"), null);
  assert.equal(find(root, "mw-lb-detail-filter"), null);
});

test("BOARD-29 rows: a hostile who line renders as text only", () => {
  const hostile = "<img src=x onerror=alert(1)>";
  const view = makeView({ body: { kind: "rows", rows: [makeOpenRow({ who: hostile, filterLabel: "" })] } });
  const { root } = renderFresh(view);
  assert.equal(find(root, "mw-lb-detail-who").textContent, hostile);
  assert.equal(findAll(root, "img").length, 0);
});

test("rows: the date line is omitted when dateLine is empty", () => {
  const view = makeView({ body: { kind: "rows", rows: [makeOpenRow({ dateLine: "" })] } });
  const { root } = renderFresh(view);
  const openRow = findAll(root, "mw-lb-row")[0];
  const detail = find(openRow, "mw-lb-detail");
  assert.equal(find(detail, "mw-lb-date"), null);
});

test("rows: a closed row has no .mw-lb-detail at all", () => {
  const { root } = renderFresh(makeView());
  const rows = findAll(root, "mw-lb-row");
  assert.equal(find(rows[0], "mw-lb-detail"), null);
});

test("rows: a hostile handle renders verbatim as text, never as markup", () => {
  const hostile = "<img src=x onerror=alert(1)>";
  const view = makeView({ body: { kind: "rows", rows: [makeRow({ headline: hostile, tag: hostile })] } });
  const { root } = renderFresh(view);
  const row = findAll(root, "mw-lb-row")[0];
  assert.equal(find(row, "mw-lb-handle").textContent, hostile);
  assert.equal(find(row, "mw-lb-tag").textContent, hostile);
  assert.equal(findAll(root, "mw-lb-row")[0].children.some((c) => c.tagName === "img"), false);
});

// ─── body states ────────────────────────────────────────────────────────

test("body empty state: .mw-lb-empty with title/note and a .mw-lb-clear button only when body.clear is set", () => {
  const view = makeView({
    body: { kind: "empty", title: "NOBODY YET", note: "Nobody has died as any race, any sub-class.", clear: { id: "clearFilters", label: "CLEAR FILTERS" } },
    standing: null,
  });
  const onClear = spy();
  const { root } = renderFresh(view, { onClear });
  const empty = find(root, "mw-lb-empty");
  assert.ok(empty);
  assert.equal(find(empty, "mw-lb-empty-title").textContent, "NOBODY YET");
  assert.equal(find(empty, "mw-lb-empty-note").textContent, "Nobody has died as any race, any sub-class.");
  const clear = find(empty, "mw-lb-clear");
  assert.ok(clear);
  clear.onclick();
  assert.equal(onClear.calls.length, 1);

  const noClearView = makeView({
    body: { kind: "empty", title: "NOBODY YET", note: "Nobody has died as anyone at all.", clear: null },
    standing: null,
  });
  const noClear = renderFresh(noClearView).root;
  assert.equal(find(noClear, "mw-lb-clear"), null);
});

test("body note state: .mw-lb-note with the line and a .mw-lb-note-btn only when body.action is set, calling onSeeMine", () => {
  const view = makeView({
    body: { kind: "note", line: "Counting the dead.", action: { id: "seeMine", label: "SEE YOUR DEAD" } },
    standing: null,
  });
  const onSeeMine = spy();
  const { root } = renderFresh(view, { onSeeMine });
  const note = find(root, "mw-lb-note");
  assert.ok(note);
  assert.equal(note.textContent, "Counting the dead.");
  const btn = find(root, "mw-lb-note-btn");
  assert.ok(btn);
  btn.onclick();
  assert.equal(onSeeMine.calls.length, 1);

  const noActionView = makeView({ body: { kind: "note", line: "Counting the dead.", action: null }, standing: null });
  const noAction = renderFresh(noActionView).root;
  assert.equal(find(noAction, "mw-lb-note-btn"), null);
});

test("body: the stale line renders above the rows only when staleLine is non-empty", () => {
  const shown = renderFresh(makeView({ staleLine: "Cached a minute ago." })).root;
  const stale = find(shown, "mw-lb-stale");
  assert.ok(stale);
  assert.equal(stale.textContent, "Cached a minute ago.");

  const hidden = renderFresh(makeView({ staleLine: "" })).root;
  assert.equal(find(hidden, "mw-lb-stale"), null);
});

test("body: the standing card renders only when view.standing is set", () => {
  const shown = renderFresh(makeView()).root;
  const standing = find(shown, "mw-lb-standing");
  assert.ok(standing);
  assert.equal(find(standing, "mw-lb-standing-note").textContent, "@lanternjaw's best, of 37 interred as any race, any sub-class.");
  assert.equal(find(standing, "mw-lb-standing-place").textContent, "4TH");

  const hidden = renderFresh(makeView({ standing: null })).root;
  assert.equal(find(hidden, "mw-lb-standing"), null);
});

// ─── dock ───────────────────────────────────────────────────────────────

test("dock: hidden when view.dock is null; otherwise one .mw-lb-dock-btn per entry with data-action/data-primary, calling onDock(id)", () => {
  const onDock = spy();
  const { root } = renderFresh(makeView(), { onDock });
  const dockEl = find(root, "mw-lb-dock");
  assert.equal(dockEl.hidden, false);
  const btns = findAll(root, "mw-lb-dock-btn");
  assert.equal(btns.length, 2);
  assert.equal(btns[0].dataset.action, "dungeon");
  assert.equal(btns[0].dataset.primary, "1");
  assert.equal(btns[1].dataset.action, "roll");
  assert.equal(btns[1].dataset.primary, "0");
  btns[0].onclick();
  btns[1].onclick();
  assert.deepStrictEqual(onDock.calls, [["dungeon"], ["roll"]]);
});

test("dock: a dead-hero dock (FINAL SHEET / BURY THEM)", () => {
  const view = makeView({ dock: [
    { id: "finalSheet", label: "FINAL SHEET", primary: false },
    { id: "bury", label: "BURY THEM", primary: true },
  ] });
  const { root } = renderFresh(view);
  const btns = findAll(root, "mw-lb-dock-btn");
  assert.deepStrictEqual(btns.map((b) => b.dataset.action), ["finalSheet", "bury"]);
});

test("dock: hidden with an empty dock element when view.dock is null", () => {
  const { root } = renderFresh(makeView({ dock: null }));
  const dockEl = find(root, "mw-lb-dock");
  assert.equal(dockEl.hidden, true);
  assert.equal(dockEl.children.length, 0);
});

// ─── sheet ──────────────────────────────────────────────────────────────

const SHEET_WITH_COUNTS = {
  id: "race",
  title: "RACE",
  done: "DONE",
  opts: [
    { value: null, label: "ANY RACE", sub: "Every race", n: "9", dim: false, on: true, col: "" },
    { value: "dwarven", label: "DWARVEN", sub: "as any sub-class", n: "0", dim: true, on: false, col: "" },
  ],
};

const SHEET_NO_COUNTS = {
  id: "stat",
  title: "RANK BY",
  done: "DONE",
  opts: [
    { value: "deep", label: "DEPTH", sub: "Lowest floor reached.", n: "", dim: false, on: true, col: "#d3c49f" },
    { value: "days", label: "DAYS", sub: "Days survived underground.", n: "", dim: false, on: false, col: "#8fb08a" },
  ],
};

test("sheet: hidden when view.sheet is null", () => {
  const { root } = renderFresh(makeView({ sheet: null }));
  const sheetEl = find(root, "mw-lb-sheet");
  assert.equal(sheetEl.hidden, true);
  assert.equal(sheetEl.children.length, 0);
});

test("sheet: a scrim (calls onSheetClose), the title, a DONE button (calls onSheetClose)", () => {
  const onSheetClose = spy();
  const { root } = renderFresh(makeView({ sheet: SHEET_NO_COUNTS }), { onSheetClose });
  const sheetEl = find(root, "mw-lb-sheet");
  assert.equal(sheetEl.hidden, false);
  const scrim = find(root, "mw-lb-scrim");
  assert.ok(scrim);
  scrim.onclick();
  const title = find(root, "mw-lb-sheet-title");
  assert.equal(title.textContent, "RANK BY");
  const done = find(root, "mw-lb-sheet-done");
  assert.equal(done.textContent, "DONE");
  done.onclick();
  assert.equal(onSheetClose.calls.length, 2);
});

test("sheet: one .mw-lb-opt button per option, with data-on/data-dim, a coloured mark when on, label/sub/count, calling onSheetPick(sheet.id, value)", () => {
  const onSheetPick = spy();
  const { root } = renderFresh(makeView({ sheet: SHEET_WITH_COUNTS }), { onSheetPick });
  const opts = findAll(root, "mw-lb-opt");
  assert.equal(opts.length, 2);

  const on = opts[0];
  assert.equal(on.dataset.on, "1");
  assert.equal(on.dataset.dim, "0");
  const mark = find(on, "mw-lb-opt-mark");
  assert.ok(mark);
  assert.equal(mark.textContent, "");
  assert.equal(mark.getAttribute("aria-hidden"), "true");
  assert.equal(find(on, "mw-lb-opt-label").textContent, "ANY RACE");
  assert.equal(find(on, "mw-lb-opt-sub").textContent, "Every race");
  assert.equal(find(on, "mw-lb-opt-n").textContent, "9");

  const dim = opts[1];
  assert.equal(dim.dataset.on, "0");
  assert.equal(dim.dataset.dim, "1");
  assert.equal(find(dim, "mw-lb-opt-n").textContent, "0");

  on.onclick();
  dim.onclick();
  assert.deepStrictEqual(onSheetPick.calls, [["race", null], ["race", "dwarven"]]);
});

test("sheet: an option's colour is applied inline to its mark when the option carries a col and is on", () => {
  const { root } = renderFresh(makeView({ sheet: SHEET_NO_COUNTS }));
  const opts = findAll(root, "mw-lb-opt");
  const mark = find(opts[0], "mw-lb-opt-mark");
  assert.equal(mark.style.color, "#d3c49f");
});

test("sheet: n renders empty text when n is ''", () => {
  const { root } = renderFresh(makeView({ sheet: SHEET_NO_COUNTS }));
  const opts = findAll(root, "mw-lb-opt");
  assert.equal(find(opts[0], "mw-lb-opt-n").textContent, "");
});

test("sheet: re-renders replace the sheet content", () => {
  const doc = createRecordingDocument();
  const host = doc.document.getElementById("screen-dead");
  renderLeaderboardPanel(host, makeView({ sheet: SHEET_NO_COUNTS }), {});
  const root2 = renderLeaderboardPanel(host, makeView({ sheet: SHEET_WITH_COUNTS }), {});
  const title = find(root2, "mw-lb-sheet-title");
  assert.equal(title.textContent, "RACE");
});

// ─── purity ─────────────────────────────────────────────────────────────

test("source pins: no document./window./globalThis. references, no HTML-string assignment, no import from content/, and no network identifier", () => {
  assert.doesNotMatch(STRIPPED, /\bdocument\./);
  assert.doesNotMatch(STRIPPED, /\bwindow\./);
  assert.doesNotMatch(STRIPPED, /\bglobalThis\./);
  assert.doesNotMatch(STRIPPED, /\.innerHTML\s*=/);
  assert.doesNotMatch(STRIPPED, /from\s+["'][^"']*\/content\//);
  for (const ident of ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "sendBeacon"]) {
    assert.doesNotMatch(STRIPPED, new RegExp(`\\b${ident}\\b`), `unexpected network identifier: ${ident}`);
  }
});

test("source pins: exports are present exactly once", () => {
  assert.equal((MODULE_SRC.match(/export function renderLeaderboardPanel/g) || []).length, 1);
  assert.equal((MODULE_SRC.match(/export const LEADERBOARD_CLASSES/g) || []).length, 1);
});

test("LEADERBOARD_CLASSES is a non-empty frozen array of unique names, and a rendered kitchen-sink view only ever emits classes from it", () => {
  assert.ok(Array.isArray(LEADERBOARD_CLASSES) && LEADERBOARD_CLASSES.length > 0);
  assert.ok(Object.isFrozen(LEADERBOARD_CLASSES));
  assert.equal(new Set(LEADERBOARD_CLASSES).size, LEADERBOARD_CLASSES.length, "no duplicate class names");

  const view = makeView({
    sheet: SHEET_WITH_COUNTS,
    body: { kind: "rows", rows: [makeOpenRow({ who: "Dwarven · Wizard (Magic User)", filterLabel: "FILTER LIKE THIS" })] },
  });
  const { root } = renderFresh(view);
  const seen = new Set();
  for (const node of walkAll(root)) {
    if (node.nodeType === 3) continue;
    for (const cls of (node.className || "").split(/\s+/).filter(Boolean)) seen.add(cls);
  }
  for (const cls of seen) {
    assert.ok(LEADERBOARD_CLASSES.includes(cls), `emitted class .${cls} is missing from LEADERBOARD_CLASSES`);
  }
});
