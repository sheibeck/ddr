// test/unit/boardsPanel-dom.test.js
//
// Phase 66 (BOARD-01..08, D-13/D-14), Plan 03 Task 1 — recordingDom tests of
// renderBoardsPanel/railScrollTarget against hand-built views. Mirrors
// gear-tab-dom.test.js's own createRecordingDocument() + comment-stripped
// source-pin approach (stripJs from tools/ident-sweep.mjs).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { createRecordingDocument } from "./harness/recordingDom.js";
import { stripJs } from "../../tools/ident-sweep.mjs";
import { renderBoardsPanel, railScrollTarget, BOARDS_CLASSES } from "../../src/browser/boardsPanel.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const MODULE_PATH = path.join(REPO_ROOT, "src", "browser", "boardsPanel.js");
const MODULE_SRC = fs.readFileSync(MODULE_PATH, "utf8").replace(/\r\n/g, "\n");
const STRIPPED = stripJs(MODULE_SRC);

function spy() {
  const fn = (...args) => fn.calls.push(args);
  fn.calls = [];
  return fn;
}

// makeView(overrides) — a full view exercising every optional part: the
// chevron, the strip, a divider, a tag, a name line, an open row (with its
// six stats) and the dock. Individual tests override specific parts to
// exercise the "off" branches (no chevron, no strip, empty/note body, no
// dock).
function makeView(overrides = {}) {
  const base = {
    header: {
      title: "LEADERBOARDS",
      scopeLine: "Your dead only. The world has not been told.",
      interred: 42,
      interredLabel: "INTERRED",
      back: true,
      backLabel: "Back to the title",
    },
    strip: {
      glyph: "?",
      label: "PLAY GAMES · SIGNED OUT",
      source: "Your dead only",
      scopes: [
        { id: "all", label: "ALL", on: false, dim: true },
        { id: "friends", label: "FRIENDS", on: false, dim: true },
      ],
    },
    rail: [
      { id: "deep", tab: "DEEPEST", on: true, col: "#d3c49f" },
      { id: "lean", tab: "LEANEST", on: false, col: "#e8c97a" },
      { id: "combo", tab: "LINEAGE", on: false, col: "#b9a4ef" },
      { id: "days", tab: "LONGEST", on: false, col: "#8fb08a" },
      { id: "kills", tab: "BUTCHERY", on: false, col: "#e07260" },
      { id: "purse", tab: "PURSE", on: false, col: "#e8c97a" },
      { id: "yard", tab: "GRAVEYARD", on: false, col: "#c9bda0" },
    ],
    board: { id: "deep", mark: "▼", col: "#d3c49f", title: "DEEPEST DESCENT", rule: "Lowest floor reached before dying." },
    body: {
      kind: "rows",
      rows: [
        {
          key: "hero-a",
          rank: "1",
          top: true,
          podium: true,
          you: false,
          divider: "",
          avatar: { initials: "HF", bg: "#6b5c3c" },
          headline: "HILDA FERROW",
          tag: "",
          name: "",
          line: "DWARVEN THIEF · LVL I",
          barPct: 100,
          val: "6",
          unit: "FLOOR",
          open: false,
          detail: "",
          stats: [],
        },
        {
          key: "hero-b",
          rank: "",
          top: false,
          podium: false,
          you: true,
          divider: "NOT IN THE TOP TEN · YOUR BEST RUN",
          avatar: { initials: "OB", bg: "#4a5c6b" },
          headline: "ODO BELL",
          tag: "YOU",
          name: "Odo Bell the Unready",
          line: "HALFLING CLERIC · LVL I",
          barPct: 3,
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
        },
      ],
    },
    standing: { label: "ODO BELL · FLOOR", place: "4TH", note: "of 37 of yours worldwide. Holding the top ten, for now." },
    footnote: "Top ten only. Boards count the dead.",
    dock: [
      { id: "dungeon", label: "BACK TO THE DUNGEON", primary: true },
      { id: "roll", label: "ROLL A NEW HERO", primary: false },
    ],
  };
  return { ...base, ...overrides };
}

function renderFresh(view, handlers = {}) {
  const doc = createRecordingDocument();
  const host = doc.document.getElementById("screen-boards");
  const root = renderBoardsPanel(host, view, handlers);
  return { doc, host, root };
}

function walkAll(node, out = []) {
  out.push(node);
  for (const child of node.children || []) walkAll(child, out);
  return out;
}

// ─── skeleton identity ──────────────────────────────────────────────────

test("skeleton: first render creates exactly one .mw-bd root with the six sections in order; a second render reuses root/rail/body", () => {
  const view = makeView();
  const { doc, host, root } = renderFresh(view);
  assert.equal(host.children.filter((c) => c.className === "mw-bd").length, 1);
  const classes = root.children.map((c) => c.className);
  assert.deepStrictEqual(classes, ["mw-bd-head", "mw-bd-strip", "mw-bd-rail", "mw-bd-boardhead", "mw-bd-body", "mw-bd-dock"]);

  const rail1 = root.querySelector(".mw-bd-rail");
  const body1 = root.querySelector(".mw-bd-body");
  rail1.scrollLeft = 77;
  body1.scrollTop = 55;

  const root2 = renderBoardsPanel(host, view, {});
  assert.equal(root2, root);
  const rail2 = root2.querySelector(".mw-bd-rail");
  const body2 = root2.querySelector(".mw-bd-body");
  assert.equal(rail2, rail1);
  assert.equal(body2, body1);
  assert.equal(rail2.scrollLeft, 77, "rail scroll position must survive a re-render");
  assert.equal(body2.scrollTop, 55, "body scroll position must survive a re-render");
  assert.equal(doc.document.getElementById("screen-boards").children.length, 1, "no duplicate root created");
});

// ─── header ─────────────────────────────────────────────────────────────

test("header: back=true renders .mw-bd-back with backLabel/onclick; back=false renders none", () => {
  const view = makeView();
  const { root } = renderFresh(view);
  const back = root.querySelector(".mw-bd-back");
  assert.ok(back);
  assert.equal(back.getAttribute("aria-label"), view.header.backLabel);
  const onBack = spy();
  back.onclick();
  // no handler wired here; re-render with a handler to prove wiring below.
  const { root: root2 } = renderFresh(view, { onBack });
  root2.querySelector(".mw-bd-back").onclick();
  assert.equal(onBack.calls.length, 1);

  const noBackView = makeView({ header: { ...view.header, back: false } });
  const { root: root3 } = renderFresh(noBackView);
  assert.equal(root3.querySelector(".mw-bd-back"), null);
});

test("header: .mw-bd-interred-n is String(interred); scope line and title come from the view; root data-board/data-entry are set", () => {
  const view = makeView();
  const { root } = renderFresh(view);
  const n = root.querySelector(".mw-bd-interred-n");
  assert.equal(n.textContent, String(view.header.interred));
  const label = root.querySelector(".mw-bd-interred-label");
  assert.equal(label.textContent, view.header.interredLabel);
  const title = root.querySelector(".mw-bd-title");
  assert.equal(title.textContent, view.header.title);
  const scope = root.querySelector(".mw-bd-scope");
  assert.equal(scope.textContent, view.header.scopeLine);
  assert.equal(root.dataset.board, view.board.id);
  assert.equal(root.dataset.entry, "title");

  const tabView = makeView({ header: { ...view.header, back: false } });
  const { root: tabRoot } = renderFresh(tabView);
  assert.equal(tabRoot.dataset.entry, "tab");
});

// ─── strip ──────────────────────────────────────────────────────────────

test("strip: null hides .mw-bd-strip; a strip renders the glyph/label/source and one .mw-bd-scope-chip per scope wired to onScope", () => {
  const nullView = makeView({ strip: null });
  const { root: rootNull } = renderFresh(nullView);
  const stripNull = rootNull.querySelector(".mw-bd-strip");
  assert.equal(stripNull.hidden, true);

  const view = makeView();
  const onScope = spy();
  const { root } = renderFresh(view, { onScope });
  const strip = root.querySelector(".mw-bd-strip");
  assert.equal(strip.hidden, false);
  const glyph = strip.querySelector(".mw-bd-av-nobody");
  assert.ok(glyph);
  assert.match(glyph.className, /\bmw-bd-av\b/);
  assert.equal(glyph.textContent, view.strip.glyph);
  assert.equal(glyph.getAttribute("aria-hidden"), "true");
  const label = strip.querySelector(".mw-bd-strip-label");
  assert.equal(label.textContent, view.strip.label);
  const source = strip.querySelector(".mw-bd-strip-source");
  assert.equal(source.textContent, view.strip.source);

  const chips = strip.querySelectorAll(".mw-bd-scope-chip");
  assert.equal(chips.length, 2);
  chips.forEach((chip, i) => {
    const s = view.strip.scopes[i];
    assert.equal(chip.dataset.on, s.on ? "1" : "0");
    assert.equal(chip.dataset.dim, s.dim ? "1" : "0");
    assert.equal(chip.getAttribute("aria-pressed"), s.on ? "true" : "false");
    chip.onclick();
  });
  assert.deepStrictEqual(onScope.calls, [["all"], ["friends"]]);
});

// ─── Phase 67 (D-08): the signed-in avatar strip ────────────────────────

const ON_RING = "inset 0 0 0 1px rgba(0,0,0,.5), 0 0 0 1px #e8c97a";

// makeSignedInView(overrides) — makeView with the signed-in strip shape
// boardsView produces (67-04): no glyph, an initials avatar, the display
// name and PLAY GAMES · SIGNED IN, lit chips.
function makeSignedInView(overrides = {}) {
  return makeView({
    strip: {
      glyph: "",
      avatar: { initials: "LJ", bg: "#4a5c6b" },
      label: "Lanternjaw",
      source: "PLAY GAMES · SIGNED IN",
      scopes: [
        { id: "all", label: "ALL", on: false, dim: false },
        { id: "friends", label: "FRIENDS", on: false, dim: false },
      ],
    },
    ...overrides,
  });
}

test("strip, signed in: one .mw-bd-av without the nobody class, the initials, data-on 1, inline background and the gold on-ring", () => {
  const view = makeSignedInView();
  const onScope = spy();
  const { root } = renderFresh(view, { onScope });
  const strip = root.querySelector(".mw-bd-strip");
  assert.equal(strip.hidden, false);
  assert.equal(strip.querySelector(".mw-bd-av-nobody"), null);
  const avs = strip.children.filter((c) => /\bmw-bd-av\b/.test(c.className || ""));
  assert.equal(avs.length, 1);
  const av = avs[0];
  assert.equal(av.className, "mw-bd-av");
  assert.equal(av.textContent, "LJ");
  assert.equal(av.dataset.on, "1");
  assert.equal(av.getAttribute("aria-hidden"), "true");
  assert.equal(av.style.background, "#4a5c6b");
  assert.equal(av.style.boxShadow, ON_RING);
  assert.equal(strip.querySelector(".mw-bd-strip-label").textContent, "Lanternjaw");
  assert.equal(strip.querySelector(".mw-bd-strip-source").textContent, "PLAY GAMES · SIGNED IN");
  const chips = strip.querySelectorAll(".mw-bd-scope-chip");
  assert.equal(chips.length, 2);
  chips.forEach((chip) => {
    assert.equal(chip.dataset.dim, "0");
    chip.onclick();
  });
  assert.deepStrictEqual(onScope.calls, [["all"], ["friends"]]);
});

test("strip: avatar null, or no avatar key at all, still draws the Phase 66 nobody glyph", () => {
  const base = makeView().strip;
  for (const strip of [{ ...base, avatar: null }, base]) {
    const { root } = renderFresh(makeView({ strip }));
    const glyph = root.querySelector(".mw-bd-strip").querySelector(".mw-bd-av-nobody");
    assert.ok(glyph);
    assert.equal(glyph.className, "mw-bd-av mw-bd-av-nobody");
    assert.equal(glyph.textContent, "?");
    assert.equal(glyph.dataset.on, undefined);
    assert.equal(glyph.style.boxShadow, undefined);
  }
});

test("strip: re-rendering signed out after signed in swaps the avatar back to the nobody glyph", () => {
  const doc = createRecordingDocument();
  const host = doc.document.getElementById("screen-boards");
  renderBoardsPanel(host, makeSignedInView(), {});
  const root = renderBoardsPanel(host, makeView(), {});
  const strip = root.querySelector(".mw-bd-strip");
  const avs = strip.children.filter((c) => /\bmw-bd-av\b/.test(c.className || ""));
  assert.equal(avs.length, 1);
  assert.equal(avs[0].className, "mw-bd-av mw-bd-av-nobody");
  assert.equal(strip.querySelector(".mw-bd-strip-label").textContent, "PLAY GAMES · SIGNED OUT");
});

// ─── rail ───────────────────────────────────────────────────────────────

test("rail: seven .mw-bd-chip buttons in view order; the on chip alone gets inline colours; onclick calls onBoard(id)", () => {
  const view = makeView();
  const onBoard = spy();
  const { root } = renderFresh(view, { onBoard });
  const rail = root.querySelector(".mw-bd-rail");
  const chips = rail.querySelectorAll(".mw-bd-chip");
  assert.equal(chips.length, 7);
  chips.forEach((chip, i) => {
    const entry = view.rail[i];
    assert.equal(chip.dataset.board, entry.id);
    assert.equal(chip.dataset.on, entry.on ? "1" : "0");
    assert.equal(chip.getAttribute("aria-pressed"), entry.on ? "true" : "false");
    assert.equal(chip.textContent, entry.tab);
    if (entry.on) {
      assert.equal(chip.style.background, entry.col);
      assert.equal(chip.style.color, "#14110c");
      assert.equal(chip.style.boxShadow, "inset 0 0 0 1px " + entry.col);
    } else {
      assert.equal(chip.style.background, undefined);
    }
  });
  chips[2].onclick();
  assert.deepStrictEqual(onBoard.calls, [["combo"]]);
});

// ─── board head ─────────────────────────────────────────────────────────

test("board head: .mw-bd-mark carries the mark and inline colour; title and rule come from the view", () => {
  const view = makeView();
  const { root } = renderFresh(view);
  const mark = root.querySelector(".mw-bd-mark");
  assert.equal(mark.textContent, view.board.mark);
  assert.equal(mark.style.color, view.board.col);
  assert.equal(mark.getAttribute("aria-hidden"), "true");
  const title = root.querySelector(".mw-bd-boardtitle");
  assert.equal(title.textContent, view.board.title);
  const rule = root.querySelector(".mw-bd-rule");
  assert.equal(rule.textContent, view.board.rule);
});

// ─── body: empty / note / rows ──────────────────────────────────────────

test("body: kind empty renders one .mw-bd-empty and no rows; kind note renders one .mw-bd-note and no rows", () => {
  const view = makeView({ body: { kind: "empty", line: "Nobody of yours has qualified for this board yet." } });
  const { root } = renderFresh(view);
  const body = root.querySelector(".mw-bd-body");
  const empty = body.querySelector(".mw-bd-empty");
  assert.ok(empty);
  assert.equal(empty.textContent, view.body.line);
  assert.equal(body.querySelectorAll(".mw-bd-row").length, 0);

  const noteView = makeView({ body: { kind: "note", line: "Nobody out there can see you yet." } });
  const { root: root2 } = renderFresh(noteView);
  const body2 = root2.querySelector(".mw-bd-body");
  const note = body2.querySelector(".mw-bd-note");
  assert.ok(note);
  assert.equal(note.textContent, noteView.body.line);
  assert.equal(body2.querySelectorAll(".mw-bd-row").length, 0);
});

test("rows: one .mw-bd-entry per row; a non-empty divider adds .mw-bd-divider with the label BEFORE the row; role/tabindex/aria-expanded/onclick wired", () => {
  const view = makeView();
  const onRow = spy();
  const { root } = renderFresh(view, { onRow });
  const body = root.querySelector(".mw-bd-body");
  const entries = body.querySelectorAll(".mw-bd-entry");
  assert.equal(entries.length, 2);

  const entryA = entries[0];
  assert.equal(entryA.querySelector(".mw-bd-divider"), null);
  const rowA = entryA.querySelector(".mw-bd-row");
  assert.equal(rowA.dataset.key, "hero-a");

  const entryB = entries[1];
  const dividerB = entryB.querySelector(".mw-bd-divider");
  assert.ok(dividerB);
  assert.equal(dividerB.querySelector(".mw-bd-divider-label").textContent, view.body.rows[1].divider);
  // the divider must precede the row inside the entry.
  assert.equal(entryB.children[0], dividerB);
  const rowB = entryB.children[1];
  assert.equal(rowB.className, "mw-bd-row");

  for (const [row, rowEl] of [[view.body.rows[0], rowA], [view.body.rows[1], rowB]]) {
    assert.equal(rowEl.dataset.key, row.key);
    assert.equal(rowEl.dataset.top, row.top ? "1" : "0");
    assert.equal(rowEl.dataset.podium, row.podium ? "1" : "0");
    assert.equal(rowEl.dataset.you, row.you ? "1" : "0");
    assert.equal(rowEl.dataset.open, row.open ? "1" : "0");
    assert.equal(rowEl.getAttribute("role"), "button");
    assert.equal(rowEl.getAttribute("tabindex"), "0");
    assert.equal(rowEl.getAttribute("aria-expanded"), row.open ? "true" : "false");
    rowEl.onclick();
  }
  assert.deepStrictEqual(onRow.calls, [["hero-a"], ["hero-b"]]);
});

test("rows: the top row's rank/value get the board colour inline and the bar fill gets the board colour; a long value gets data-long 1", () => {
  const view = makeView();
  const { root } = renderFresh(view);
  const rows = root.querySelectorAll(".mw-bd-row");
  const [rowA, rowB] = rows;

  const rankA = rowA.querySelector(".mw-bd-rank");
  assert.equal(rankA.style.color, view.board.col);
  const valA = rowA.querySelector(".mw-bd-val");
  assert.equal(valA.style.color, view.board.col);
  const fillA = rowA.querySelector(".mw-bd-bar-fill");
  assert.equal(fillA.style.background, view.board.col);
  assert.equal(fillA.style.width, "100%");
  assert.equal(valA.dataset.long, "0"); // "6" is 1 char

  const rankB = rowB.querySelector(".mw-bd-rank");
  assert.equal(rankB.style.color, undefined);
  const valB = rowB.querySelector(".mw-bd-val");
  assert.equal(valB.style.color, undefined);
  assert.equal(valB.dataset.long, "1"); // "654321" is > 5 chars
  const fillB = rowB.querySelector(".mw-bd-bar-fill");
  assert.equal(fillB.style.background, undefined);
  assert.equal(fillB.style.width, "3%");
});

test("rows: an empty tag renders no .mw-bd-tag; an empty name renders no .mw-bd-name; a non-empty tag/name renders both", () => {
  const view = makeView();
  const { root } = renderFresh(view);
  const [rowA, rowB] = root.querySelectorAll(".mw-bd-row");
  assert.equal(rowA.querySelector(".mw-bd-tag"), null);
  assert.equal(rowA.querySelector(".mw-bd-name"), null);
  const tagB = rowB.querySelector(".mw-bd-tag");
  assert.equal(tagB.textContent, "YOU");
  const nameB = rowB.querySelector(".mw-bd-name");
  assert.equal(nameB.textContent, "Odo Bell the Unready");
});

test("rows: the avatar renders the initials with an inline background from avatar.bg", () => {
  const view = makeView();
  const { root } = renderFresh(view);
  const [rowA] = root.querySelectorAll(".mw-bd-row");
  const av = rowA.children.find((c) => c.className === "mw-bd-av");
  assert.equal(av.textContent, view.body.rows[0].avatar.initials);
  assert.equal(av.style.background, view.body.rows[0].avatar.bg);
});

test("rows: an open row renders .mw-bd-detail with the detail text and exactly six .mw-bd-stat chips; a closed row renders none", () => {
  const view = makeView();
  const { root } = renderFresh(view);
  const [rowA, rowB] = root.querySelectorAll(".mw-bd-row");
  assert.equal(rowA.querySelector(".mw-bd-detail"), null);

  const detail = rowB.querySelector(".mw-bd-detail");
  assert.ok(detail);
  assert.equal(detail.querySelector(".mw-bd-detail-text").textContent, view.body.rows[1].detail);
  const stats = detail.querySelectorAll(".mw-bd-stat");
  assert.equal(stats.length, 6);
  stats.forEach((stat, i) => {
    assert.equal(stat.querySelector(".mw-bd-stat-k").textContent, view.body.rows[1].stats[i].k);
    assert.equal(stat.querySelector(".mw-bd-stat-v").textContent, view.body.rows[1].stats[i].v);
  });
});

test("body: after rows, the body always holds .mw-bd-standing (label/note/place) then .mw-bd-foot", () => {
  const view = makeView();
  const { root } = renderFresh(view);
  const body = root.querySelector(".mw-bd-body");
  const standing = body.querySelector(".mw-bd-standing");
  assert.ok(standing);
  assert.equal(standing.querySelector(".mw-bd-standing-label").textContent, view.standing.label);
  assert.equal(standing.querySelector(".mw-bd-standing-note").textContent, view.standing.note);
  assert.equal(standing.querySelector(".mw-bd-standing-place").textContent, String(view.standing.place));
  const foot = body.querySelector(".mw-bd-foot");
  assert.ok(foot);
  assert.equal(foot.textContent, view.footnote);
  // order: standing then foot, and both after every entry.
  const idxStanding = body.children.indexOf(standing);
  const idxFoot = body.children.indexOf(foot);
  assert.ok(idxFoot > idxStanding);
  assert.equal(idxFoot, body.children.length - 1);
});

// ─── dock ───────────────────────────────────────────────────────────────

test("dock: null hides .mw-bd-dock; a dock renders one .mw-bd-dock-btn per entry with data-action/data-primary, onclick calling onDock(id)", () => {
  const nullView = makeView({ dock: null });
  const { root: rootNull } = renderFresh(nullView);
  assert.equal(rootNull.querySelector(".mw-bd-dock").hidden, true);

  const view = makeView();
  const onDock = spy();
  const { root } = renderFresh(view, { onDock });
  const dock = root.querySelector(".mw-bd-dock");
  assert.equal(dock.hidden, false);
  const btns = dock.querySelectorAll(".mw-bd-dock-btn");
  assert.equal(btns.length, 2);
  btns.forEach((btn, i) => {
    const entry = view.dock[i];
    assert.equal(btn.dataset.action, entry.id);
    assert.equal(btn.dataset.primary, entry.primary ? "1" : "0");
    assert.equal(btn.textContent, entry.label);
    btn.onclick();
  });
  assert.deepStrictEqual(onDock.calls, [["dungeon"], ["roll"]]);
});

// ─── BOARDS_CLASSES completeness ────────────────────────────────────────

test("BOARDS_CLASSES: every className the renderer emits (across every optional/mutually-exclusive part) is listed, and vice versa", () => {
  // body.kind is a single enum (rows/empty/note), so no one view can render
  // .mw-bd-empty, .mw-bd-note AND row markup at once — union three renders
  // (the full "rows" view plus one each for the empty/note branches) to
  // cover every class BOARDS_CLASSES lists.
  const views = [
    makeView(),
    makeView({ body: { kind: "empty", line: "Nobody of yours has qualified for this board yet." } }),
    makeView({ body: { kind: "note", line: "Nobody out there can see you yet." } }),
    makeGlobalView(),
    makeGlobalView({ body: CONSENT_BODY }),
  ];
  const found = new Set();
  for (const view of views) {
    const { root } = renderFresh(view);
    for (const node of walkAll(root)) {
      if (node.nodeType === 3) continue;
      for (const token of (node.className || "").split(/\s+/).filter(Boolean)) found.add(token);
    }
  }
  const foundSorted = [...found].sort();
  const classesSorted = [...BOARDS_CLASSES].sort();
  assert.deepStrictEqual(foundSorted, classesSorted);
});

test("BOARDS_CLASSES (Phase 67): a signed-in view emits no class outside the list, and the union with it is still exactly the list", () => {
  const views = [
    makeView(),
    makeView({ body: { kind: "empty", line: "Nobody of yours has qualified for this board yet." } }),
    makeView({ body: { kind: "note", line: "Nobody out there can see you yet." } }),
    makeSignedInView(),
    makeSignedInView({ body: { kind: "note", line: "The world is unreachable. Your own dead are still here." } }),
    makeGlobalView(),
    makeGlobalView({ body: CONSENT_BODY, standing: null }),
  ];
  const found = new Set();
  views.forEach((view, i) => {
    const { root } = renderFresh(view);
    for (const node of walkAll(root)) {
      if (node.nodeType === 3) continue;
      for (const token of (node.className || "").split(/\s+/).filter(Boolean)) {
        if (i >= 3) assert.ok(BOARDS_CLASSES.includes(token), `signed-in view emitted an unlisted class: ${token}`);
        found.add(token);
      }
    }
  });
  assert.deepStrictEqual([...found].sort(), [...BOARDS_CLASSES].sort());
});

// ─── Phase 68 (D-06, D-08): season label and picker, consent body, null standing ──

const CONSENT_BODY = Object.freeze({
  kind: "consent",
  line: "Play Games will not show us your friends until you say so.",
  action: Object.freeze({ id: "friendsConsent", label: "SHOW MY FRIENDS" }),
});

// makeGlobalView(overrides) — a signed-in ALL view with the SEASON label and
// a two-season picker (season 2 viewed).
function makeGlobalView(overrides = {}) {
  const base = makeSignedInView();
  return {
    ...base,
    header: {
      ...base.header,
      scopeLine: "Global. Every delve this season.",
      season: {
        label: "SEASON 2",
        picker: [
          { n: 1, label: "SEASON 1", on: false },
          { n: 2, label: "SEASON 2", on: true },
        ],
      },
    },
    ...overrides,
  };
}

test("header season: span.mw-bd-season carries the label inside the head text; no picker renders no .mw-bd-seasons", () => {
  const view = makeGlobalView({ header: { ...makeView().header, season: { label: "SEASON 1", picker: null } } });
  const { root } = renderFresh(view);
  const headtext = root.querySelector(".mw-bd-headtext");
  const label = headtext.querySelector(".mw-bd-season");
  assert.ok(label);
  assert.equal(label.tagName.toLowerCase(), "span");
  assert.equal(label.textContent, "SEASON 1");
  assert.equal(root.querySelectorAll(".mw-bd-seasons").length, 0);

  // a view with no header.season at all (the Phase 66/67 shape) renders neither.
  const { root: bare } = renderFresh(makeView());
  assert.equal(bare.querySelectorAll(".mw-bd-season").length, 0);
  assert.equal(bare.querySelectorAll(".mw-bd-seasons").length, 0);
});

test("header season picker: one button.mw-bd-season-chip per season with type/data-season/data-on/aria-pressed, onclick calling onSeason(n)", () => {
  const onSeason = spy();
  const view = makeGlobalView();
  const { root } = renderFresh(view, { onSeason });
  const seasons = root.querySelector(".mw-bd-headtext").querySelector(".mw-bd-seasons");
  assert.ok(seasons, "the picker sits in the head text block");
  const chips = seasons.querySelectorAll(".mw-bd-season-chip");
  assert.equal(chips.length, 2);
  chips.forEach((chip, i) => {
    const s = view.header.season.picker[i];
    assert.equal(chip.tagName.toLowerCase(), "button");
    assert.equal(chip.type, "button");
    assert.equal(chip.dataset.season, String(s.n));
    assert.equal(chip.dataset.on, s.on ? "1" : "0");
    assert.equal(chip.getAttribute("aria-pressed"), s.on ? "true" : "false");
    assert.equal(chip.textContent, s.label);
    chip.onclick();
  });
  assert.deepStrictEqual(onSeason.calls, [[1], [2]]);
});

test("consent body: p.mw-bd-note with the line, then button.mw-bd-consent (type button, data-action) whose onclick calls onConsent()", () => {
  const onConsent = spy();
  const view = makeGlobalView({ body: CONSENT_BODY });
  const { root } = renderFresh(view, { onConsent });
  const body = root.querySelector(".mw-bd-body");
  const note = body.querySelector(".mw-bd-note");
  assert.equal(note.textContent, CONSENT_BODY.line);
  const btn = body.querySelector(".mw-bd-consent");
  assert.ok(btn);
  assert.equal(btn.tagName.toLowerCase(), "button");
  assert.equal(btn.type, "button");
  assert.equal(btn.dataset.action, "friendsConsent");
  assert.equal(btn.textContent, "SHOW MY FRIENDS");
  assert.ok(body.children.indexOf(btn) > body.children.indexOf(note), "the button sits under the note");
  assert.equal(body.querySelectorAll(".mw-bd-row").length, 0);
  btn.onclick();
  assert.deepStrictEqual(onConsent.calls, [[]]);
  // no handler: the click is a no-op, never a throw.
  const { root: root2 } = renderFresh(view);
  assert.doesNotThrow(() => root2.querySelector(".mw-bd-consent").onclick());
});

test("a null standing renders no .mw-bd-standing; the footnote still renders last", () => {
  const view = makeGlobalView({ body: { kind: "note", line: "Asking the world who died. It keeps records, slowly." }, standing: null });
  const { root } = renderFresh(view);
  const body = root.querySelector(".mw-bd-body");
  assert.equal(body.querySelectorAll(".mw-bd-standing").length, 0);
  const foot = body.querySelector(".mw-bd-foot");
  assert.equal(foot.textContent, view.footnote);
  assert.equal(body.children.indexOf(foot), body.children.length - 1);
});

// ─── railScrollTarget ───────────────────────────────────────────────────

test("railScrollTarget: matches the mock's syncRail formula and clamps to the scrollable range", () => {
  assert.equal(railScrollTarget({ offsetLeft: 300, offsetWidth: 60, clientWidth: 360, scrollWidth: 900 }), 150);
  // left-edge clamp: a chip near the start wants a negative target.
  assert.equal(railScrollTarget({ offsetLeft: 0, offsetWidth: 60, clientWidth: 360, scrollWidth: 900 }), 0);
  // right-edge clamp: a chip near the end wants past scrollWidth - clientWidth.
  assert.equal(railScrollTarget({ offsetLeft: 880, offsetWidth: 60, clientWidth: 360, scrollWidth: 900 }), 540);
});

test("railScrollTarget: non-finite inputs are treated as 0 and it never returns NaN", () => {
  assert.equal(railScrollTarget({}), 0);
  assert.equal(railScrollTarget({ offsetLeft: NaN, offsetWidth: undefined, clientWidth: Infinity, scrollWidth: "900" }), 0);
  assert.equal(railScrollTarget(undefined), 0);
  const r = railScrollTarget({ offsetLeft: -Infinity, offsetWidth: 10, clientWidth: 100, scrollWidth: 200 });
  assert.ok(Number.isFinite(r) && !Number.isNaN(r));
});

// ─── source pins ────────────────────────────────────────────────────────

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
  assert.equal((MODULE_SRC.match(/export function renderBoardsPanel/g) || []).length, 1);
  assert.equal((MODULE_SRC.match(/export function railScrollTarget/g) || []).length, 1);
  assert.equal((MODULE_SRC.match(/export const BOARDS_CLASSES/g) || []).length, 1);
});
