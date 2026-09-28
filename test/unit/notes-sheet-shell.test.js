// test/unit/notes-sheet-shell.test.js
//
// Phase 79.3 (NOTES-02; D-20, D-21), Plan 07 Task 1 — pins the PATCH NOTES
// sheet's wiring in mazeworld.html's markup, CSS and module script, plus a
// behaviour test of the once-per-update title-only auto-show. Source-level,
// using the house sliceBetween/stripComments helpers (test/unit/
// report-sheet-shell.test.js's own precedent), since mazeworld.html has no
// ESM surface a test could import directly.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const RAW_HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
const HTML = RAW_HTML.replace(/\r\n/g, "\n");

// ─── comment stripping (line comments first, THEN block comments) ─────────
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
const MODULE = CODE.slice(CODE.indexOf('<script type="module">'));
const MARKUP = HTML.replace(/<!--[\s\S]*?-->/g, "");
const STYLE = [...HTML.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
  .map((m) => m[1])
  .join("\n")
  .replace(/\/\*[\s\S]*?\*\//g, "");

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

// The mw-pn-* classes renderPatchNotes (src/browser/patchNotes.js) emits.
const PATCH_NOTES_RENDER_CLASSES = ["mw-pn", "mw-pn-h1", "mw-pn-h2", "mw-pn-h3", "mw-pn-p", "mw-pn-ul", "mw-pn-li", "mw-pn-b", "mw-pn-a"];

// ═══════════════════════ (A) the markup ════════════════════════════════════

test("(A1) SOURCE: #mw-notes-sheet's markup is byte-for-byte the shipped legend-sheet chrome, with Close as the only text node", () => {
  const markup = sliceBetween(MARKUP, '<div id="mw-notes-sheet"', '<div class="mw-fade"');
  assert.match(markup, /^<div id="mw-notes-sheet" class="mw-legend-sheet mw-notes-sheet" hidden>$/m);
  assert.match(markup, /<div class="mw-legend-scrim" id="mw-notes-scrim"><\/div>/);
  assert.match(markup, /<div class="mw-legend-panel" role="dialog" aria-modal="true" aria-labelledby="mw-notes-title">/);
  assert.match(
    markup,
    /<div class="mw-legend-head"><span id="mw-notes-title"><\/span><button type="button" class="mw-legend-close" id="mw-notes-close" aria-label="Close">Close<\/button><\/div>/,
  );
  assert.match(markup, /<div class="mw-notes-body" id="mw-notes-body"><\/div>/);
  assert.match(markup, /<p class="mw-notes-past"><a class="mw-notes-past-link" id="mw-notes-past" target="_blank" rel="noreferrer"><\/a><\/p>/);
  // The only text node in the block is the Close button's label.
  const texts = (markup.match(/>[^<]+</g) ?? []).map((t) => t.slice(1, -1)).filter((t) => t.trim() !== "");
  assert.deepEqual(texts, ["Close"]);
  // No href on the past-versions anchor — the module sets it.
  assert.doesNotMatch(markup, /id="mw-notes-past"[^>]*\shref=/);
});

test("(A2) SOURCE: the sheet sits after #mw-report-sheet and before the mw-fade layer, exactly once", () => {
  assert.equal(occurrences(HTML, 'id="mw-notes-sheet"'), 1);
  const reportEnd = HTML.indexOf('<button type="button" class="mw-report-btn" id="mw-report-send"></button>');
  const notesStart = HTML.indexOf('<div id="mw-notes-sheet"');
  const fadeStart = HTML.indexOf('class="mw-fade"');
  assert.ok(reportEnd !== -1 && notesStart !== -1 && fadeStart !== -1);
  assert.ok(reportEnd < notesStart && notesStart < fadeStart, "the sheet sits between the report sheet and the fade layer");
});

// ═══════════════════════ (B) the CSS ════════════════════════════════════════

test("(B1) CSS: #mw-notes-sheet stacks at z-index 55", () => {
  assert.match(STYLE, /#mw-notes-sheet\{z-index:55\}/);
});

test("(B2) CSS: every mw-pn-* class renderPatchNotes emits, plus the notes-only classes, has a rule", () => {
  for (const cls of [...PATCH_NOTES_RENDER_CLASSES, "mw-notes-body", "mw-notes-past", "mw-notes-past-link"]) {
    assert.match(STYLE, new RegExp(`\\.${cls}[{,:.\\[]`), `.${cls} has a CSS rule`);
  }
});

// ═══════════════════════ (C) module imports ═════════════════════════════════

test("(C1) SOURCE: the two Phase 79.3 patch-notes import lines appear exactly once each, right after the report imports", () => {
  assert.equal(occurrences(HTML, 'import { PATCH_NOTES } from "./src/browser/patchNotesData.js";'), 1);
  assert.equal(
    occurrences(
      HTML,
      'import { parsePatchNotes, renderPatchNotes, readNotesLaunch, markNotesSeen, PATCH_NOTES_COPY, PATCH_NOTES_RELEASES_URL } from "./src/browser/patchNotes.js";',
    ),
    1,
  );
  const reportSheetIdx = MODULE.indexOf('from "./src/browser/reportSheet.js";');
  const patchNotesDataIdx = MODULE.indexOf('from "./src/browser/patchNotesData.js";');
  assert.ok(reportSheetIdx !== -1 && patchNotesDataIdx !== -1 && reportSheetIdx < patchNotesDataIdx, "the notes imports follow the report imports");
});

// ═══════════════════════ (D) the module functions and listeners ════════════

test("(D1) SOURCE: closeMenuThen(openNotesSheet) occurs exactly once", () => {
  assert.equal(occurrences(MODULE, "closeMenuThen(openNotesSheet)"), 1);
  assert.match(MODULE, /document\.getElementById\("mw-menu-notes"\)\?\.addEventListener\("click", closeMenuThen\(openNotesSheet\)\);/);
});

test("(D2) SOURCE: hasOpenModal includes notesSheetOpen()", () => {
  const ctx = sliceBetween(MODULE, "getGameContext: () => ({", "navigateBack: () => {");
  const hasOpenModal = ctx.slice(ctx.indexOf("hasOpenModal:"), ctx.indexOf("hasLiveRun:"));
  assert.match(hasOpenModal, /notesSheetOpen\(\)/);
});

test("(D3) SOURCE: closeModal's index order is the ☰ escape, the report branch, the notes branch, then finalSheetOpen, before window.__mzStair is cleared", () => {
  const closeModal = sliceBetween(MODULE, "closeModal: () => {", "\n        navigateBack: () => {");
  const menu = closeModal.indexOf('if (hudMenuIsOpen()) { hudMenuEvent("escape"); return; }');
  const report = closeModal.indexOf("if (reportSheetOpen()) { closeReportSheet(); return; }");
  const notes = closeModal.indexOf("if (notesSheetOpen()) { closeNotesSheet(); return; }");
  const final = closeModal.indexOf("if (finalSheetOpen())");
  const stair = closeModal.indexOf("window.__mzStair = null;");
  assert.ok(menu !== -1 && report !== -1 && notes !== -1 && final !== -1 && stair !== -1, "expected every marker present");
  assert.ok(menu < report && report < notes && notes < final && final < stair, "the ☰ escape, the report branch, the notes branch, then final, before window.__mzStair clears");
});

test("(D4) SOURCE: readNotesLaunch(window.mzStorage, PATCH_NOTES occurs once, after the initTitleScreen IIFE's end and before account.boot().catch(", () => {
  assert.equal(occurrences(MODULE, "readNotesLaunch(window.mzStorage, PATCH_NOTES"), 1);
  const iifeEnd = MODULE.indexOf("refreshTitleDead();\n  })();");
  const readIdx = MODULE.indexOf("readNotesLaunch(window.mzStorage, PATCH_NOTES");
  const bootIdx = MODULE.indexOf("account.boot().catch(");
  assert.ok(iifeEnd !== -1 && readIdx !== -1 && bootIdx !== -1);
  assert.ok(iifeEnd < readIdx && readIdx < bootIdx, "the auto-show read must sit after initTitleScreen and before account.boot().catch(");
});

test("(D5) SOURCE: showNotesOnTitle's body calls titleScreenUp() before markNotesSeen( and markNotesSeen( before openNotesSheet(", () => {
  const fn = sliceBetween(MODULE, "function showNotesOnTitle() {", "\n  }");
  const titleIdx = fn.indexOf("titleScreenUp()");
  const markIdx = fn.indexOf("markNotesSeen(");
  const openIdx = fn.indexOf("openNotesSheet(");
  assert.ok(titleIdx !== -1 && markIdx !== -1 && openIdx !== -1);
  assert.ok(titleIdx < markIdx && markIdx < openIdx, "titleScreenUp() before markNotesSeen( before openNotesSheet(");
});

test("(D6) SOURCE: notesSheetOpen checks #mw-notes-sheet's hidden flag", () => {
  const fn = sliceBetween(MODULE, "function notesSheetOpen() {", "\n  }");
  assert.match(fn, /document\.getElementById\("mw-notes-sheet"\)/);
  assert.match(fn, /!sheet\.hidden/);
});

test("(D7) SOURCE: the notes block writes no S, no dispatch, no persist, no localStorage, no innerHTML assignment and no window.__mz assignment", () => {
  const region = sliceBetween(MODULE, "let notesAutoPending = false;", '\n  document.getElementById("mw-notes-close")?.addEventListener("click", closeNotesSheet);');
  for (const bad of [/\bS\.\w+\s*=/, /__mzState\.set/, /\bdispatch\(/, /\bpersist\(/, /localStorage/, /innerHTML\s*=/, /window\.__mz\w*\s*=/]) {
    assert.doesNotMatch(region, bad, `notes block must not match ${bad}`);
  }
});

test("(D8) SOURCE: the comment-stripped shell has no global fetch call, XMLHttpRequest, WebSocket, EventSource or sendBeacon", () => {
  for (const bad of [/(?<![.\w])fetch\(/, /XMLHttpRequest/, /WebSocket/, /EventSource/, /sendBeacon/]) {
    assert.doesNotMatch(CODE, bad);
  }
});

// ═══════════════════════ (E) the once-per-update auto-show behaviour ═══════

function buildHarness({ titleHidden }) {
  // sliceBetween's end index is exclusive of the marker itself, so the
  // extracted body is missing its own closing brace — append it back for a
  // syntactically valid function declaration.
  const titleBody = `${sliceBetween(MODULE, "function titleScreenUp() {", "\n  }")}\n  }`;
  const showBody = `${sliceBetween(MODULE, "function showNotesOnTitle() {", "\n  }")}\n  }`;
  const calls = [];
  const fakeTitle = { hidden: titleHidden };
  const fakeDocument = {
    getElementById: (id) => (id === "mw-title-screen" ? fakeTitle : null),
  };
  const fakeStorage = { fake: true };
  const fakeWindow = { mzStorage: fakeStorage };
  const markNotesSeen = (storage, version) => calls.push(["mark", storage, version]);
  const openNotesSheet = () => calls.push(["open"]);
  const PATCH_NOTES = { version: "2.1.0" };
  const factory = new Function(
    "document",
    "window",
    "markNotesSeen",
    "openNotesSheet",
    "PATCH_NOTES",
    `
    let notesAutoPending = false;
    ${titleBody}
    ${showBody}
    return {
      run: () => showNotesOnTitle(),
      pending: () => notesAutoPending,
    };
    `,
  );
  const harness = factory(fakeDocument, fakeWindow, markNotesSeen, openNotesSheet, PATCH_NOTES);
  return { harness, calls, fakeTitle, fakeStorage };
}

test("(E1) BEHAVIOUR: with the title up, showNotesOnTitle marks the version seen through the injected storage, opens once, and clears pending", () => {
  const { harness, calls, fakeStorage } = buildHarness({ titleHidden: false });
  harness.run();
  assert.deepEqual(calls, [["mark", fakeStorage, "2.1.0"], ["open"]]);
  assert.equal(harness.pending(), false);
});

test("(E2) BEHAVIOUR: with the title hidden, showNotesOnTitle makes no call and sets pending; once the title appears, calling it again opens", () => {
  const { harness, calls, fakeTitle, fakeStorage } = buildHarness({ titleHidden: true });
  harness.run();
  assert.deepEqual(calls, []);
  assert.equal(harness.pending(), true);
  fakeTitle.hidden = false;
  harness.run();
  assert.deepEqual(calls, [["mark", fakeStorage, "2.1.0"], ["open"]]);
  assert.equal(harness.pending(), false);
});
