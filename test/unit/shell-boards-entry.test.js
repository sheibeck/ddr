// test/unit/shell-boards-entry.test.js
//
// Phase 66 (BOARD-01, D-01/D-03/D-04/D-14, D-16), Plan 07 — pins the title's
// VIEW THE DEAD entry (opens the Leaderboards panel in TITLE mode, D-01/
// D-04), the Android back button's mirror of the chevron on a title-opened
// panel (D-03), and the classic graveyard loader/saver/harness retirement
// (D-14). Uses the comment-stripping and region-extraction technique from
// test/unit/shell-boards-panel.test.js (itself borrowed from
// test/unit/shell-combat-over.test.js — mazeworld.html has no ESM surface a
// test could import directly) for every SOURCE pin, and drives a REAL
// createBoardsPanel + the REAL boardsView (never a stub) over
// createRecordingDocument() for the routing BEHAVIOUR tests.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { createRecordingDocument } from "./harness/recordingDom.js";
import { createBoardsPanel } from "../../src/browser/boardsPanel.js";
import { boardsView } from "../../src/browser/boardsView.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const RAW_HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
const HTML = RAW_HTML.replace(/\r\n/g, "\n");

// ─── comment stripping (line comments first, THEN block comments — order
// matters, see test/unit/shell-combat-over.test.js's own header note)
// ───────────────────────────────────────────────────────────────────────
function stripComments(source) {
  const noLineComments = source
    .split("\n")
    .map((line) => {
      const i = line.indexOf("//");
      return i === -1 ? line : line.slice(0, i);
    })
    .join("\n");
  return noLineComments.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""));
}
const CODE = stripComments(HTML);

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start === -1 ? 0 : start);
  assert.ok(start !== -1, `start marker not found: ${startMarker}`);
  assert.ok(end !== -1 && end > start, `end marker not found after start: ${endMarker}`);
  return source.slice(start, end);
}

function occurrences(source, literal) {
  return source.split(literal).length - 1;
}

// ═══════════════════════ (A) region pins — title entry (D-01/D-04) ═════════

test("(A1) SOURCE: the title's #mw-title-dead onclick opens the panel in title mode before switching the tab, exactly once", () => {
  assert.equal(occurrences(HTML, "boardsPanel.openFromTitle({ hasHero: resumeIntent });"), 1);
  const region = sliceBetween(CODE, 'const deadBtn = document.getElementById("mw-title-dead");', "refreshTitleDead();\n  })();");
  const openIdx = region.indexOf("boardsPanel.openFromTitle({ hasHero: resumeIntent });");
  const hideIdx = region.indexOf("hideTitleScreen();");
  const showTabIdx = region.indexOf('window.__mzShowTab?.("dead");');
  assert.ok(hideIdx !== -1 && openIdx !== -1 && showTabIdx !== -1, "expected all three calls inside the deadBtn.onclick region");
  assert.ok(hideIdx < openIdx, "hideTitleScreen() must run before openFromTitle()");
  assert.ok(openIdx < showTabIdx, "openFromTitle() must run before the tab switch, so onDeadTab() only re-centres");
});

// ═══════════════════════ (B) region pin — Android back mirror (D-03) ═══════

test("(B1) SOURCE: getGameContext's hasOpenModal includes boardsPanel.isTitleOpen(), and closeModal's FIRST statement mirrors the chevron, exactly once each", () => {
  assert.equal(occurrences(HTML, "if (boardsPanel.isTitleOpen()) { boardsPanel.back(); return; }"), 1);
  assert.match(CODE, /hasOpenModal: boardsPanel\.isTitleOpen\(\) \|\|/);
  const closeModalRegion = sliceBetween(CODE, "closeModal: () => {", "\n        navigateBack: () => {");
  const guardIdx = closeModalRegion.indexOf("if (boardsPanel.isTitleOpen()) { boardsPanel.back(); return; }");
  const escapeIdx = closeModalRegion.indexOf('hudMenuEvent("escape");');
  assert.ok(guardIdx !== -1 && escapeIdx !== -1, "expected both the title-open guard and the ☰ escape inside closeModal");
  assert.ok(guardIdx < escapeIdx, "the title-open guard must be closeModal's FIRST statement, before the ☰ escape");
});

test("(B2) SOURCE: src/browser/nativeChrome.js is untouched by this plan (still exports decideBackAction unchanged)", () => {
  const nativeChromeSrc = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "nativeChrome.js"), "utf8");
  assert.match(nativeChromeSrc, /export function decideBackAction\(/);
  assert.doesNotMatch(nativeChromeSrc, /boardsPanel/);
});

// ═══════════════════ (C) the extracted closeModal guard, evaluated ═════════

/**
 * closeModalFactory() — extracts closeModal's exact shipped source (the
 * arrow function assigned to the getGameContext() object's `closeModal`
 * property) and returns a Function taking (boardsPanel, S) and yielding the
 * live closure. Deliberately does NOT thread through window/document/
 * hudMenuEvent/gearSheetTarget/closeGearSheet/closeCampSheet/
 * closeMarksLegend — with a title-open boardsPanel, the guard must return
 * before any of those are ever referenced, so their absence from this
 * factory's scope is itself part of the proof: a regression that moved the
 * guard below any of those calls would throw a ReferenceError here instead
 * of silently mutating S.
 */
function closeModalFactory() {
  const region = sliceBetween(CODE, "closeModal: () => {", "\n        navigateBack: () => {");
  const src = region.replace(/^closeModal: \(\) => \{/, "function closeModal() {").replace(/,\s*$/, "");
  return new Function("boardsPanel", "S", src + "\nreturn closeModal;");
}

test("(C1) BEHAVIOUR: with a title-open boardsPanel, the extracted closeModal calls back() exactly once and leaves S.beats/S.store untouched", () => {
  const calls = [];
  const fakeBoardsPanel = {
    isTitleOpen: () => true,
    back: () => {
      calls.push("back");
      return true;
    },
  };
  const beats = { groups: [{ id: "x" }] };
  const store = { open: true };
  const fakeS = { beats, store };
  const closeModal = closeModalFactory()(fakeBoardsPanel, fakeS);
  assert.doesNotThrow(() => closeModal());
  assert.deepStrictEqual(calls, ["back"]);
  assert.equal(fakeS.beats, beats, "S.beats must be the SAME object — never nulled or replaced");
  assert.equal(fakeS.store, store, "S.store must be the SAME object — never nulled or replaced");
});

test("(C2) BEHAVIOUR: with a tab-open (isTitleOpen false) boardsPanel, the extracted closeModal does NOT return early — reaching the un-threaded hudMenuEvent() throws (proving the guard is skipped for a tab-opened panel)", () => {
  const fakeBoardsPanel = { isTitleOpen: () => false, back: () => true };
  const closeModal = closeModalFactory()(fakeBoardsPanel, { beats: null, store: null });
  assert.throws(() => closeModal(), /hudMenuEvent is not defined/);
});

// ═══════════════════ (D) real-controller routing (D-01/D-03) ═══════════════

/** openBoardsPanel(routeCalls) — a fresh createRecordingDocument()-backed panel over #screen-boards, the REAL boardsView, empty adapter data, and onRoute pushing into routeCalls. */
function openBoardsPanel(routeCalls) {
  const doc = createRecordingDocument();
  const host = doc.document.getElementById("screen-boards");
  const panel = createBoardsPanel({
    host,
    buildView: boardsView,
    readData: () => ({ bests: null, graves: [], total: 0 }),
    prefs: null,
    reducedMotion: () => true,
    onRoute: (action, opts) => routeCalls.push({ action, ...opts }),
  });
  return { doc, host, panel };
}

test("(D1) BEHAVIOUR: openFromTitle({ hasHero: false }) opens on GRAVEYARD with the chevron, two dock buttons (title, roll) and the title-entry body marker", () => {
  const { doc, host, panel } = openBoardsPanel([]);
  panel.openFromTitle({ hasHero: false });

  const root = host.querySelector(".mw-bd");
  assert.equal(root.dataset.board, "yard");
  assert.equal(root.dataset.entry, "title");
  assert.equal(host.querySelectorAll(".mw-bd-back").length, 1);
  const dockBtns = host.querySelector(".mw-bd-dock").querySelectorAll(".mw-bd-dock-btn");
  assert.deepStrictEqual(
    dockBtns.map((b) => b.dataset.action),
    ["title", "roll"],
  );
  assert.equal(doc.document.body.dataset.boardsEntry, "title");
  assert.equal(panel.isTitleOpen(), true);
});

test("(D2) BEHAVIOUR: the chevron's onclick routes (\"title\", { hasHero: false }) and deletes the title-entry marker", () => {
  const routeCalls = [];
  const { doc, host, panel } = openBoardsPanel(routeCalls);
  panel.openFromTitle({ hasHero: false });

  host.querySelector(".mw-bd-back").onclick();

  assert.deepStrictEqual(routeCalls, [{ action: "title", hasHero: false }]);
  assert.equal(doc.document.body.dataset.boardsEntry, undefined);
});

test("(D3) BEHAVIOUR: openFromTitle({ hasHero: true }) renders exactly one dock button (dungeon), and back() routes (\"dungeon\", { hasHero: true }) and returns true", () => {
  const routeCalls = [];
  const { host, panel } = openBoardsPanel(routeCalls);
  panel.openFromTitle({ hasHero: true });

  const dockBtns = host.querySelector(".mw-bd-dock").querySelectorAll(".mw-bd-dock-btn");
  assert.deepStrictEqual(
    dockBtns.map((b) => b.dataset.action),
    ["dungeon"],
  );

  assert.equal(panel.back(), true);
  assert.deepStrictEqual(routeCalls, [{ action: "dungeon", hasHero: true }]);
});

test("(D4) BEHAVIOUR: after either exit, isTitleOpen() is false and a later onDeadTab() opens TAB mode (no chevron, dock hidden)", () => {
  {
    const { host, panel } = openBoardsPanel([]);
    panel.openFromTitle({ hasHero: false });
    host.querySelector(".mw-bd-back").onclick();
    assert.equal(panel.isTitleOpen(), false);

    panel.onDeadTab();
    const root = host.querySelector(".mw-bd");
    assert.equal(root.dataset.entry, "tab");
    assert.equal(host.querySelectorAll(".mw-bd-back").length, 0);
    assert.equal(host.querySelector(".mw-bd-dock").hidden, true);
  }
  {
    const { host, panel } = openBoardsPanel([]);
    panel.openFromTitle({ hasHero: true });
    panel.back();
    assert.equal(panel.isTitleOpen(), false);

    panel.onDeadTab();
    const root = host.querySelector(".mw-bd");
    assert.equal(root.dataset.entry, "tab");
    assert.equal(host.querySelectorAll(".mw-bd-back").length, 0);
    assert.equal(host.querySelector(".mw-bd-dock").hidden, true);
  }
});

// ═══════════════════ (E) classic graveyard retirement pins (D-14) ══════════
// Task 2 appends this section once the sentinel block and its harness are
// actually deleted — see this file's git history for that commit.
