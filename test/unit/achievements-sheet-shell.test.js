// test/unit/achievements-sheet-shell.test.js
//
// Phase 100 (AUI-02/03), Plan 03 — pins the ACHIEVEMENTS sheet's wiring in
// mazeworld.html's markup, CSS and module script, the ☰ row that opens it,
// and a behaviour harness for open, expand, close, refresh and the count.
// Source-level, using the house sliceBetween/stripComments helpers
// (test/unit/notes-sheet-shell.test.js's own precedent), since mazeworld.html
// has no ESM surface a test could import directly. The behaviour harness
// extracts the sheet's functions from the comment-stripped module script and
// runs them over a fake document, a fake panelMotion and a fake record.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { ACHIEVEMENTS } from "../../content/achievements.js";
import { sanitizeRecord } from "../../src/browser/achievementRecord.js";
import { buildAchievementsView, menuCountText } from "../../src/browser/achievementsSheet.js";

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

// The flat CSS rules (selector, body) whose selector names an achievements
// class or id. Nested at-rule wrappers are skipped, which is fine: this
// sheet's block declares none.
function achRules() {
  const out = [];
  for (const m of STYLE.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].trim();
    if (/mw-ach/.test(selector)) out.push({ selector, body: m[2] });
  }
  return out;
}

const SHEET_BLOCK = sliceBetween(MODULE, "const achExpanded = new Set();", '\n  document.getElementById("mw-menu-achievements")?.addEventListener');

// ═══════════════════════ (A) the markup ════════════════════════════════════

test("(A1) SOURCE: #mw-achievements-sheet is the legend-sheet chrome with the scrim, a labelled dialog, the title (tabindex -1), Close and the body; Close is its only text node", () => {
  const markup = sliceBetween(MARKUP, '<div id="mw-achievements-sheet"', '<div class="mw-fade"');
  assert.match(markup, /^<div id="mw-achievements-sheet" class="mw-legend-sheet mw-achievements-sheet" hidden>$/m);
  assert.match(markup, /<div class="mw-legend-scrim" id="mw-achievements-scrim"><\/div>/);
  assert.match(markup, /<div class="mw-legend-panel" role="dialog" aria-modal="true" aria-labelledby="mw-achievements-title">/);
  assert.match(
    markup,
    /<div class="mw-legend-head"><span id="mw-achievements-title" tabindex="-1"><\/span><button type="button" class="mw-legend-close" id="mw-achievements-close" aria-label="Close">Close<\/button><\/div>/,
  );
  assert.match(markup, /<div class="mw-achievements-body" id="mw-achievements-body"><\/div>/);
  const texts = (markup.match(/>[^<]+</g) ?? []).map((t) => t.slice(1, -1)).filter((t) => t.trim() !== "");
  assert.deepEqual(texts, ["Close"]);
});

test("(A2) SOURCE: the sheet appears once, after the PATCH NOTES sheet and before the stairs fade layer", () => {
  assert.equal(occurrences(HTML, 'id="mw-achievements-sheet"'), 1);
  const notes = HTML.indexOf('<div id="mw-notes-sheet"');
  const sheet = HTML.indexOf('<div id="mw-achievements-sheet"');
  const fade = HTML.indexOf('class="mw-fade"');
  assert.ok(notes !== -1 && sheet !== -1 && fade !== -1);
  assert.ok(notes < sheet && sheet < fade, "notes sheet, then the achievements sheet, then the fade layer");
});

test("(A3) SOURCE: the ☰ row sits after MARKS and before SETTINGS with a glyph, the label and the count span", () => {
  const marks = MARKUP.indexOf('id="mw-chip-marks"');
  const row = MARKUP.indexOf('id="mw-menu-achievements"');
  const gear = MARKUP.indexOf('id="mw-gear-btn"');
  assert.ok(marks !== -1 && row !== -1 && gear !== -1 && marks < row && row < gear);
  assert.match(
    MARKUP,
    /<button type="button" role="menuitem" class="mw-hud-menu-item" id="mw-menu-achievements"><span class="mw-hud-menu-glyph" data-glyph="achievements" aria-hidden="true">&#9733;<\/span><span class="mw-hud-menu-label">ACHIEVEMENTS<\/span><span class="mw-hud-menu-count" id="mw-menu-achievements-count"><\/span><\/button>/,
  );
});

// ═══════════════════════ (B) the CSS ════════════════════════════════════════

test("(B1) CSS: the sheet stacks at z-index 55; the panel is a non-scrolling flex column up to 960px", () => {
  assert.match(STYLE, /#mw-achievements-sheet\{z-index:55\}/);
  const panel = STYLE.match(/#mw-achievements-sheet \.mw-legend-panel\{([^}]*)\}/);
  assert.ok(panel, "the id-scoped panel rule exists");
  assert.match(panel[1], /display:flex/);
  assert.match(panel[1], /flex-direction:column/);
  assert.match(panel[1], /overflow:hidden/);
  assert.match(panel[1], /max-width:960px/);
});

test("(B2) CSS: the body owns the scrolling (overflow-y auto, overflow-x hidden, min-height 0) and the list is a grid auto-fill with a min(100%,300px) column", () => {
  const body = STYLE.match(/\.mw-achievements-body\{([^}]*)\}/);
  assert.ok(body, "the body rule exists");
  assert.match(body[1], /overflow-y:auto/);
  assert.match(body[1], /overflow-x:hidden/);
  assert.match(body[1], /min-height:0/);
  assert.match(body[1], /flex:1 1 auto/);
  const list = STYLE.match(/\.mw-ach-list\{([^}]*)\}/);
  assert.ok(list, "the list rule exists");
  assert.match(list[1], /display:grid/);
  assert.match(list[1], /grid-template-columns:repeat\(auto-fill,minmax\(min\(100%,300px\),1fr\)\)/);
});

test("(B3) CSS: no rule naming mw-ach or mw-achievements declares an animation or a transition, and every font-size goes through --mw-text-scale", () => {
  const rules = achRules();
  assert.ok(rules.length > 15, "the achievements rules were found");
  for (const { selector, body } of rules) {
    assert.doesNotMatch(body, /\banimation\b|\btransition\b/, `${selector} declares no motion`);
    for (const m of body.matchAll(/font-size:([^;]*)/g)) {
      assert.match(m[1], /--mw-text-scale/, `${selector} font-size goes through --mw-text-scale`);
    }
  }
});

test("(B4) CSS: every class the renderer emits has a rule, and the count and glyph rules exist", () => {
  const classes = [
    "mw-ach",
    "mw-ach-summary",
    "mw-ach-count",
    "mw-ach-secrets",
    "mw-ach-block-title",
    "mw-ach-list",
    "mw-ach-row",
    "mw-ach-head",
    "mw-ach-icon",
    "mw-ach-icon-dim",
    "mw-ach-icon-silhouette",
    "mw-ach-text",
    "mw-ach-name",
    "mw-ach-state",
    "mw-ach-detail",
    "mw-ach-progress",
    "mw-ach-hint",
    "mw-ach-ladder",
    "mw-ach-pip",
    "mw-ach-rungs",
    "mw-ach-rung",
    "mw-ach-rung-name",
    "mw-ach-rung-progress",
    "mw-hud-menu-count",
  ];
  for (const cls of classes) assert.match(STYLE, new RegExp(`\\.${cls}[{,:.\\[ >]`), `.${cls} has a CSS rule`);
  assert.match(STYLE, /\.mw-hud-menu-glyph\[data-glyph="achievements"\]\{color:#e0b84a;font-size:15px\}/);
  assert.match(STYLE, /\.mw-hud-menu-count\{[^}]*margin-left:auto/);
  assert.match(STYLE, /\.mw-ach-icon\{[^}]*width:48px;height:48px/);
});

test("(B5) CSS: the sheet picks columns by the window alone, so its block has no media query and no device test", () => {
  const block = sliceBetween(HTML, "/* ---------- ACHIEVEMENTS sheet (Phase 100", "/* ---------- MAKE CAMP bottom sheet");
  assert.doesNotMatch(block.replace(/\/\*[\s\S]*?\*\//g, ""), /@media/);
  assert.doesNotMatch(block.replace(/\/\*[\s\S]*?\*\//g, ""), /userAgent|navigator|isTablet|device/i);
});

// ═══════════════════════ (C) the module wiring ══════════════════════════════

test("(C1) SOURCE: the two new imports are on their own lines; the pinned adapter import line is byte-identical", () => {
  assert.equal(occurrences(HTML, 'import { buildAchievementsView, renderAchievementsSheet, menuCountText } from "./src/browser/achievementsSheet.js";'), 1);
  assert.equal(occurrences(HTML, 'import { getAchievementRecord } from "./src/browser/engineAdapter.js";'), 1);
  assert.equal(occurrences(HTML, 'import { boot, dispatch, startNewRun, waitForPending, takeBootWornReport } from "./src/browser/engineAdapter.js";'), 1);
});

test("(C2) SOURCE: closeMenuThen(openAchievementsSheet) occurs exactly once and is bound to mw-menu-achievements; the scrim and Close close the sheet", () => {
  assert.equal(occurrences(MODULE, "closeMenuThen(openAchievementsSheet)"), 1);
  assert.match(MODULE, /document\.getElementById\("mw-menu-achievements"\)\?\.addEventListener\("click", closeMenuThen\(openAchievementsSheet\)\);/);
  assert.match(MODULE, /document\.getElementById\("mw-achievements-scrim"\)\?\.addEventListener\("click", closeAchievementsSheet\);/);
  assert.match(MODULE, /document\.getElementById\("mw-achievements-close"\)\?\.addEventListener\("click", closeAchievementsSheet\);/);
});

test("(C3) SOURCE: hasOpenModal includes achievementsSheetOpen(); closeModal closes it strictly after the notes line and before the Final Sheet's", () => {
  const ctx = sliceBetween(MODULE, "getGameContext: () => ({", "navigateBack: () => {");
  const hasOpenModal = ctx.slice(ctx.indexOf("hasOpenModal:"), ctx.indexOf("hasLiveRun:"));
  assert.match(hasOpenModal, /achievementsSheetOpen\(\)/);
  const closeModal = sliceBetween(MODULE, "closeModal: () => {", "\n        navigateBack: () => {");
  const notes = closeModal.indexOf("if (notesSheetOpen()) { closeNotesSheet(); return; }");
  const ach = closeModal.indexOf("if (achievementsSheetOpen()) { closeAchievementsSheet(); return; }");
  const final = closeModal.indexOf("if (finalSheetOpen())");
  const stair = closeModal.indexOf("window.__mzStair = null;");
  assert.ok(notes !== -1 && ach !== -1 && final !== -1 && stair !== -1, "expected every marker present");
  assert.equal(occurrences(closeModal, "achievementsSheetOpen()"), 1);
  assert.ok(notes < ach && ach < final && final < stair, "notes, then achievements, then final, before window.__mzStair clears");
});

test("(C4) SOURCE: the open and close functions never call mzKeepPartyInView, and the block adds no window.__mz name, storage, dispatch or write", () => {
  assert.doesNotMatch(SHEET_BLOCK, /mzKeepPartyInView/);
  for (const bad of [/\bS\.\w+\s*=/, /__mzState\.set/, /\bdispatch\(/, /\bpersist\(/, /localStorage/, /mzStorage/, /innerHTML\s*=/, /window\.__mz\w*\s*=/, /\bfetch\(/, /setItem|Preferences/]) {
    assert.doesNotMatch(SHEET_BLOCK, bad, `the sheet block must not match ${bad}`);
  }
  assert.equal(occurrences(MODULE, "window.__mzAchievements"), 0);
  assert.equal(occurrences(MODULE, "getAchievementRecord("), 2, "only the sheet render and its count read the record here");
});

test("(C5) SOURCE: the three window names are plain (not __mz) and the camera-keep call-site pins are untouched", () => {
  assert.match(MODULE, /window\.mzOpenAchievements = openAchievementsSheet;/);
  assert.match(MODULE, /window\.mzRefreshAchievementsSheet = \(\) => \{ if \(achievementsSheetOpen\(\)\) renderAchievementsSheetNow\(\); \};/);
  assert.match(MODULE, /window\.mzSyncAchievementsCount = syncAchievementsCount;/);
  assert.equal(occurrences(MODULE, "window.__mzOpenAchievements"), 0);
  assert.equal(occurrences(MODULE, "window.__mzRefreshAchievementsSheet"), 0);
});

test("(C6) SOURCE: syncHudMenuRows ends by calling window.mzSyncAchievementsCount?.()", () => {
  const fn = sliceBetween(CODE, "function syncHudMenuRows() {", "\n}\n");
  assert.match(fn, /window\.mzSyncAchievementsCount\?\.\(\);\s*$/);
});

// ═══════════════════════ (D) behaviour ══════════════════════════════════════

function rec(over) {
  return sanitizeRecord({ v: 1, ...over });
}

function buildHarness({ record = null } = {}) {
  const calls = [];
  let current = record;
  const sheet = { hidden: true };
  const title = { textContent: "", focus: (opts) => calls.push(["focus-title", opts]) };
  const rowHead = { focus: (opts) => calls.push(["focus-head", opts]) };
  const body = {
    scrollTop: 0,
    rows: [],
    buttons: [],
    querySelectorAll: (sel) => (sel === ".mw-ach-large-open" ? body.buttons : body.rows),
  };
  // Quick 261005-vhn: the large-view overlay and its four fields.
  const large = { hidden: true, focus: (opts) => calls.push(["focus-large", opts]) };
  const largeImg = { src: null, setAttribute: (n, v) => (largeImg[n] = v) };
  const largeName = { textContent: "" };
  const largeLine = { textContent: "" };
  const largeDate = { textContent: "" };
  const count = { textContent: "" };
  const els = {
    "mw-achievements-sheet": sheet,
    "mw-achievements-title": title,
    "mw-achievements-body": body,
    "mw-menu-achievements-count": count,
    "mw-achievements-large": large,
    "mw-ach-large-img": largeImg,
    "mw-ach-large-name": largeName,
    "mw-ach-large-line": largeLine,
    "mw-ach-large-date": largeDate,
  };
  const fakeDocument = { getElementById: (id) => els[id] || null };
  const panelMotion = {
    open: (el) => {
      calls.push(["open"]);
      el.hidden = false;
    },
    close: (el) => {
      calls.push(["close"]);
      el.hidden = true;
    },
  };
  const renders = [];
  const renderAchievementsSheet = (host, view, opts) => {
    renders.push({ host, view, opts });
    // A real render replaces the children, which resets the scroll offset.
    host.scrollTop = 0;
    return {};
  };
  const getAchievementRecord = () => current;
  const factory = new Function(
    "document",
    "panelMotion",
    "buildAchievementsView",
    "renderAchievementsSheet",
    "menuCountText",
    "getAchievementRecord",
    `
    ${SHEET_BLOCK}
    return {
      expanded: achExpanded,
      isOpen: achievementsSheetOpen,
      open: openAchievementsSheet,
      close: closeAchievementsSheet,
      sync: syncAchievementsCount,
      refresh: () => { if (achievementsSheetOpen()) renderAchievementsSheetNow(); },
      largeOpen: achievementLargeOpen,
      openLarge: openAchievementLarge,
      closeLarge: closeAchievementLarge,
    };
    `,
  );
  const api = factory(fakeDocument, panelMotion, buildAchievementsView, renderAchievementsSheet, menuCountText, getAchievementRecord);
  return { api, calls, renders, sheet, title, body, rowHead, count, large, largeImg, largeName, largeLine, largeDate, setRecord: (r) => (current = r) };
}

test("(D1) BEHAVIOUR: open renders the list into the body, writes the title from the view, opens through panelMotion once and focuses the title", () => {
  const h = buildHarness();
  h.api.open();
  assert.equal(h.renders.length, 1);
  assert.equal(h.renders[0].host, h.body);
  assert.equal(h.title.textContent, "ACHIEVEMENTS");
  assert.equal(h.renders[0].view.title, "ACHIEVEMENTS");
  assert.equal(h.renders[0].opts.expanded, h.api.expanded);
  assert.equal(typeof h.renders[0].opts.onToggle, "function");
  assert.deepEqual(h.calls, [["open"], ["focus-title", { preventScroll: true }]]);
  assert.equal(h.api.isOpen(), true);
});

test("(D2) BEHAVIOUR: opening before the record exists (null) renders the all-zero list and never throws", () => {
  const h = buildHarness({ record: null });
  assert.doesNotThrow(() => h.api.open());
  assert.equal(h.renders[0].view.earned, 0);
  assert.equal(h.renders[0].view.total, ACHIEVEMENTS.length);
});

test("(D3) BEHAVIOUR: a track's onToggle adds then removes its key, re-renders each time, keeps the body's scrollTop and re-focuses the toggled row", () => {
  const h = buildHarness();
  h.api.open();
  h.calls.length = 0;
  h.body.scrollTop = 250;
  h.body.rows = [{ getAttribute: () => "t999", querySelector: () => null }, { getAttribute: (n) => (n === "data-key" ? "t10" : null), querySelector: () => h.rowHead }];
  const onToggle = h.renders[0].opts.onToggle;

  onToggle("t10");
  assert.equal(h.api.expanded.has("t10"), true);
  assert.equal(h.renders.length, 2);
  assert.equal(h.body.scrollTop, 250, "the scroll offset survives the re-render");
  assert.deepEqual(h.calls, [["focus-head", { preventScroll: true }]]);

  h.body.scrollTop = 410;
  h.renders[1].opts.onToggle("t10");
  assert.equal(h.api.expanded.has("t10"), false);
  assert.equal(h.renders.length, 3);
  assert.equal(h.body.scrollTop, 410);
  assert.equal(h.renders[2].opts.expanded, h.api.expanded);
});

test("(D4) BEHAVIOUR: close on an open sheet calls panelMotion.close once; close on a hidden sheet calls nothing", () => {
  const h = buildHarness();
  h.api.open();
  h.calls.length = 0;
  h.api.close();
  assert.deepEqual(h.calls, [["close"]]);
  assert.equal(h.api.isOpen(), false);
  h.calls.length = 0;
  h.api.close();
  h.api.close();
  assert.deepEqual(h.calls, [], "closing an already-closed sheet is a no-op");
});

test("(D5) BEHAVIOUR: the expanded set is the only state that survives closing", () => {
  const h = buildHarness();
  h.api.open();
  h.renders[0].opts.onToggle("t20");
  h.api.close();
  h.api.open();
  assert.equal(h.api.expanded.has("t20"), true);
  assert.equal(h.renders[h.renders.length - 1].opts.expanded.has("t20"), true);
});

test("(D6) BEHAVIOUR: mzRefreshAchievementsSheet re-renders only while the sheet is open, and picks up a changed record", () => {
  const h = buildHarness();
  h.api.refresh();
  assert.equal(h.renders.length, 0, "closed: no render");
  h.api.open();
  assert.equal(h.renders.length, 1);
  assert.equal(h.renders[0].view.earned, 0);
  const two = {};
  for (const e of ACHIEVEMENTS.slice(0, 2)) two[e.id] = 1700000000000;
  h.setRecord(rec({ unlocked: two }));
  h.api.refresh();
  assert.equal(h.renders.length, 2);
  assert.equal(h.renders[1].view.earned, 2);
  h.api.close();
  h.api.refresh();
  assert.equal(h.renders.length, 2, "closed again: no render");
});

test("(D7) BEHAVIOUR: syncAchievementsCount writes '0 / 77' for a null record and '2 / 77' for a record with two unlocks", () => {
  const h = buildHarness({ record: null });
  h.api.sync();
  assert.equal(h.count.textContent, `0 / ${ACHIEVEMENTS.length}`);
  assert.equal(h.count.textContent, "0 / 77");
  const two = {};
  for (const e of ACHIEVEMENTS.slice(0, 2)) two[e.id] = 1700000000000;
  h.setRecord(rec({ unlocked: two }));
  h.api.sync();
  assert.equal(h.count.textContent, "2 / 77");
});

test("(D8) BEHAVIOUR: a missing count element or body is a no-op, never a throw", () => {
  const h = buildHarness();
  h.count.textContent = "keep";
  const bare = new Function(
    "document",
    "panelMotion",
    "buildAchievementsView",
    "renderAchievementsSheet",
    "menuCountText",
    "getAchievementRecord",
    `${SHEET_BLOCK}
     return { open: openAchievementsSheet, close: closeAchievementsSheet, sync: syncAchievementsCount, refresh: () => { if (achievementsSheetOpen()) renderAchievementsSheetNow(); } };`,
  )({ getElementById: () => null }, { open() {}, close() {} }, buildAchievementsView, () => null, menuCountText, () => null);
  assert.doesNotThrow(() => {
    bare.open();
    bare.close();
    bare.sync();
    bare.refresh();
  });
});

// ═══════════════════════ (E) the large view (quick 261005-vhn) ═════════════

const LARGE_INFO = {
  key: "row:t10",
  src: "achievements/large/ach_depth_t1.png",
  name: "Depth",
  line: "A line.",
  stateText: "Earned 5 Oct 2026",
  label: "Depth, view larger",
};

test("(E1) SOURCE: the overlay is one hidden dialog inside the sheet with the art and three empty text elements, no words of its own", () => {
  const markup = sliceBetween(MARKUP, '<div id="mw-achievements-sheet"', '<div class="mw-fade"');
  assert.match(markup, /<div id="mw-achievements-large" class="mw-ach-large" role="dialog" aria-modal="true" aria-labelledby="mw-ach-large-name" tabindex="-1" hidden>/);
  assert.match(markup, /<img id="mw-ach-large-img" alt="" aria-hidden="true">/);
  for (const id of ["mw-ach-large-name", "mw-ach-large-line", "mw-ach-large-date"]) {
    assert.match(markup, new RegExp(`<p class="[^"]*" id="${id}"></p>`));
  }
  assert.equal(occurrences(HTML, 'id="mw-achievements-large"'), 1);
  const texts = (markup.match(/>[^<]+</g) ?? []).map((t) => t.slice(1, -1)).filter((t) => t.trim() !== "");
  assert.deepEqual(texts, ["Close"], "the overlay adds no player copy to the markup");
});

test("(E2) CSS: the overlay covers the sheet, shrinks its art to fit (no vh or dvh), and the icon buttons are laid over the 48 px icons", () => {
  const rule = STYLE.match(/\.mw-ach-large\{([^}]*)\}/);
  assert.ok(rule, "the overlay rule exists");
  assert.match(rule[1], /position:absolute/);
  assert.match(rule[1], /inset:0/);
  assert.match(rule[1], /overflow-y:auto/);
  assert.match(STYLE, /\.mw-ach-large\[hidden\]\{display:none\}/);
  const art = STYLE.match(/\.mw-ach-large-art\{([^}]*)\}/);
  assert.ok(art);
  assert.match(art[1], /flex:0 1 240px/);
  assert.match(art[1], /max-width:100%/);
  assert.doesNotMatch(rule[1] + art[1], /\d(vh|dvh)\b/);
  assert.match(STYLE, /\.mw-ach-head-open\{[^}]*width:48px;height:48px/);
  assert.match(STYLE, /\.mw-ach-row\{position:relative/);
});

test("(E3) BEHAVIOUR: opening the large view fills the four fields from the tapped entry, shows the overlay and focuses it", () => {
  const h = buildHarness();
  h.api.open();
  h.calls.length = 0;
  assert.equal(h.api.largeOpen(), false);
  h.renders[0].opts.onLarge(LARGE_INFO, {});
  assert.equal(h.api.largeOpen(), true);
  assert.equal(h.largeImg.src, LARGE_INFO.src);
  assert.equal(h.largeName.textContent, "Depth");
  assert.equal(h.largeLine.textContent, "A line.");
  assert.equal(h.largeDate.textContent, "Earned 5 Oct 2026");
  assert.deepEqual(h.calls, [["focus-large", { preventScroll: true }]]);
  assert.equal(h.api.isOpen(), true, "the sheet stays open under the overlay");
});

test("(E4) BEHAVIOUR: closing the overlay hides only it and returns focus to the icon button that opened it, found again by key", () => {
  const h = buildHarness();
  h.api.open();
  h.renders[0].opts.onLarge(LARGE_INFO, {});
  h.calls.length = 0;
  const stale = { getAttribute: () => "rung:other", focus: () => h.calls.push(["focus-other"]) };
  const fresh = { getAttribute: (n) => (n === "data-large" ? "row:t10" : null), focus: (o) => h.calls.push(["focus-button", o]) };
  h.body.buttons = [stale, fresh];
  h.api.closeLarge();
  assert.equal(h.api.largeOpen(), false);
  assert.equal(h.api.isOpen(), true, "the sheet is still open after closing the overlay");
  assert.deepEqual(h.calls, [["focus-button", { preventScroll: true }]]);
  h.calls.length = 0;
  h.api.closeLarge();
  assert.deepEqual(h.calls, [], "closing a closed overlay is a no-op");
});

test("(E5) BEHAVIOUR: closing the whole sheet also hides the overlay; a re-draw while it is up leaves it up", () => {
  const h = buildHarness();
  h.api.open();
  h.renders[0].opts.onLarge(LARGE_INFO, {});
  h.api.refresh();
  assert.equal(h.api.largeOpen(), true, "a list re-draw does not close the overlay");
  h.api.close();
  assert.equal(h.api.largeOpen(), false);
  assert.equal(h.api.isOpen(), false);
});

test("(E6) SOURCE: Android back closes only the overlay: its line sits right before the sheet's own, and the list render passes onLarge", () => {
  const closeModal = sliceBetween(MODULE, "closeModal: () => {", "\n        navigateBack: () => {");
  const large = closeModal.indexOf("if (achievementLargeOpen()) { closeAchievementLarge(); return; }");
  const ach = closeModal.indexOf("if (achievementsSheetOpen()) { closeAchievementsSheet(); return; }");
  assert.ok(large !== -1 && ach !== -1 && large < ach, "overlay first, then the sheet");
  assert.equal(occurrences(closeModal, "achievementLargeOpen()"), 1);
  assert.match(SHEET_BLOCK, /onLarge: openAchievementLarge/);
  assert.match(MODULE, /document\.getElementById\("mw-achievements-large"\)\?\.addEventListener\("click", closeAchievementLarge\);/);
});
