// test/unit/report-sheet-shell.test.js
//
// Phase 79.3 (BUG-01/02; D-06, D-09, D-10, D-12), Plan 05 Task 2 — pins the
// REPORT A BUG sheet's wiring in mazeworld.html's markup, CSS, module script
// and the classic keydown guard. Source-level, using the house
// sliceBetween/stripComments/extractScriptRegions helpers
// (test/unit/shell-account.test.js's own precedent), since mazeworld.html
// has no ESM surface a test could import directly.

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

// ═══════════════════════ (A) the markup ════════════════════════════════════

test("(A1) SOURCE: #mw-report-sheet's markup is byte-for-byte the shipped legend-sheet chrome, with no aria-label/title/placeholder attribute and no non-whitespace text between tags", () => {
  // Phase 79.3 (NOTES-02): the PATCH NOTES sheet (79.3-07) now sits between
  // the report sheet and the fade layer, so the end marker is the notes
  // sheet's own opening div rather than the fade layer.
  const markup = sliceBetween(MARKUP, '<div id="mw-report-sheet"', '<div id="mw-notes-sheet"');
  assert.match(markup, /^<div id="mw-report-sheet" class="mw-legend-sheet mw-report-sheet" hidden>$/m);
  assert.match(markup, /<div class="mw-legend-scrim" id="mw-report-scrim"><\/div>/);
  assert.match(markup, /<div class="mw-legend-panel" role="dialog" aria-modal="true" aria-labelledby="mw-report-title">/);
  assert.match(markup, /<div class="mw-legend-head"><span id="mw-report-title"><\/span><\/div>/);
  assert.match(markup, /<p class="mw-report-notice" id="mw-report-notice"><\/p>/);
  assert.match(
    markup,
    /<textarea class="mw-report-text" id="mw-report-text" maxlength="2000" rows="6" autocapitalize="sentences" aria-labelledby="mw-report-title" aria-describedby="mw-report-notice"><\/textarea>/,
  );
  assert.match(markup, /<p class="mw-report-count" id="mw-report-count" hidden><\/p>/);
  assert.match(markup, /<p class="mw-report-status" id="mw-report-status" role="status" aria-live="polite"><\/p>/);
  assert.match(markup, /<div class="mw-report-actions">/);
  assert.match(markup, /<button type="button" class="mw-report-btn secondary" id="mw-report-cancel"><\/button>/);
  assert.match(markup, /<button type="button" class="mw-report-btn" id="mw-report-send"><\/button>/);
  // No aria-label, title or placeholder attribute anywhere in the block.
  assert.doesNotMatch(markup, /\saria-label=/);
  assert.doesNotMatch(markup, /\stitle=/);
  assert.doesNotMatch(markup, /\splaceholder=/);
  // No non-whitespace text node between any two tags.
  for (const text of markup.match(/>[^<]+</g) ?? []) {
    assert.match(text.slice(1, -1), /^\s*$/, `unexpected text node: ${JSON.stringify(text)}`);
  }
});

test("(A2) SOURCE: the sheet sits after #mw-fightlog-sheet and before the mw-fade layer, exactly once", () => {
  assert.equal(occurrences(HTML, 'id="mw-report-sheet"'), 1);
  const fightLogEnd = HTML.indexOf('<div class="mw-fl-rows" id="mw-fightlog-sheet-rows"></div>');
  const reportStart = HTML.indexOf('<div id="mw-report-sheet"');
  const fadeStart = HTML.indexOf('class="mw-fade"');
  assert.ok(fightLogEnd !== -1 && reportStart !== -1 && fadeStart !== -1);
  assert.ok(fightLogEnd < reportStart && reportStart < fadeStart, "the sheet sits between the fight-log sheet and the fade layer");
});

// ═══════════════════════ (B) the CSS ════════════════════════════════════════

test("(B1) CSS: #mw-report-sheet stacks at z-index 55, and the textarea allows text selection", () => {
  assert.match(STYLE, /#mw-report-sheet\{z-index:55\}/);
  assert.match(STYLE, /\.mw-report-text\{[^}]*user-select:text/);
});

test("(B2) CSS: the report block sits before the MAKE CAMP block, and every declared class has a rule", () => {
  const campIdx = HTML.indexOf("/* ---------- MAKE CAMP bottom sheet");
  const reportIdx = HTML.indexOf("/* ---------- REPORT A BUG sheet");
  assert.ok(reportIdx !== -1 && campIdx !== -1 && reportIdx < campIdx);
  for (const cls of [
    "mw-report-notice",
    "mw-report-text",
    "mw-report-count",
    "mw-report-status",
    "mw-report-actions",
    "mw-report-btn",
  ]) {
    assert.match(STYLE, new RegExp(`\\.${cls}[{,:.\\[]`), `.${cls} has a CSS rule`);
  }
});

// ═══════════════════════ (C) module imports ═════════════════════════════════

test("(C1) SOURCE: the three Phase 79.3 import lines appear exactly once each, right after the settings.js import", () => {
  assert.equal(occurrences(HTML, 'import { buildReportPayload, sendBugReport } from "./src/browser/bugReport.js";'), 1);
  assert.equal(occurrences(HTML, 'import { BUG_REPORT_CONFIG } from "./src/browser/bugReportConfig.js";'), 1);
  assert.equal(
    occurrences(
      HTML,
      'import { REPORT_SHEET_INITIAL, REPORT_SENT_HOLD_MS, reportSheetNext, reportSheetView } from "./src/browser/reportSheet.js";',
    ),
    1,
  );
  const settingsIdx = MODULE.indexOf('from "./src/browser/settings.js";');
  const bugReportIdx = MODULE.indexOf('from "./src/browser/bugReport.js";');
  assert.ok(settingsIdx !== -1 && bugReportIdx !== -1 && settingsIdx < bugReportIdx, "the report imports follow the settings.js import");
});

test("(C2) SOURCE: Phase 83 (SRV-09) adds createIdentity and the reportLimits.js imports exactly once each, right after the reportSheet.js import", () => {
  assert.equal(occurrences(HTML, 'import { createIdentity } from "./src/browser/firebaseAuth.js";'), 1);
  assert.equal(occurrences(HTML, 'import { LOCAL_LIMIT_KEY, sanitizeLocalLimit, checkLocalLimit } from "./src/browser/reportLimits.js";'), 1);
  const reportSheetIdx = MODULE.indexOf('from "./src/browser/reportSheet.js";');
  const firebaseAuthIdx = MODULE.indexOf('from "./src/browser/firebaseAuth.js";');
  const reportLimitsIdx = MODULE.indexOf('from "./src/browser/reportLimits.js";');
  assert.ok(reportSheetIdx !== -1 && firebaseAuthIdx !== -1 && reportLimitsIdx !== -1);
  assert.ok(reportSheetIdx < firebaseAuthIdx, "createIdentity's import follows the reportSheet.js import");
  assert.ok(firebaseAuthIdx < reportLimitsIdx, "the reportLimits.js import follows the firebaseAuth.js import");
});

// ═══════════════════════ (D) the module functions and listeners ════════════

test("(D1) SOURCE: closeMenuThen(openReportSheet) occurs exactly once", () => {
  assert.equal(occurrences(MODULE, "closeMenuThen(openReportSheet)"), 1);
  assert.match(MODULE, /document\.getElementById\("mw-menu-report"\)\?\.addEventListener\("click", closeMenuThen\(openReportSheet\)\);/);
});

test("(D2) SOURCE: hasOpenModal includes reportSheetOpen()", () => {
  const ctx = sliceBetween(MODULE, "getGameContext: () => ({", "navigateBack: () => {");
  const hasOpenModal = ctx.slice(ctx.indexOf("hasOpenModal:"), ctx.indexOf("hasLiveRun:"));
  assert.match(hasOpenModal, /reportSheetOpen\(\)/);
});

test("(D3) SOURCE: closeModal's index order is the account branch, the ☰ escape, the report branch, then finalSheetOpen, before window.__mzStair is cleared", () => {
  const closeModal = sliceBetween(MODULE, "closeModal: () => {", "\n        navigateBack: () => {");
  const acct = closeModal.indexOf("if (accountSheetOpen())");
  const menu = closeModal.indexOf('if (hudMenuIsOpen()) { hudMenuEvent("escape"); return; }');
  const report = closeModal.indexOf("if (reportSheetOpen()) { closeReportSheet(); return; }");
  const final = closeModal.indexOf("if (finalSheetOpen())");
  const stair = closeModal.indexOf("window.__mzStair = null;");
  assert.ok(acct !== -1 && menu !== -1 && report !== -1 && final !== -1 && stair !== -1, "expected every marker present");
  assert.ok(acct < menu && menu < report && report < final && final < stair, "account, the ☰ escape, the report branch, then final, before window.__mzStair clears");
  const body = closeModal.slice("closeModal: () => {".length).trim();
  assert.ok(body.startsWith("if (accountSheetOpen())"), "closeModal still starts with the account line");
});

test("(D4) SOURCE: sendReportNow's region calls buildReportPayload and sendBugReport with the Oracle, version, device and live state, binding fetch itself", () => {
  const region = sliceBetween(MODULE, "async function sendReportNow() {", "\n  document.getElementById(\"mw-menu-report\")");
  assert.match(region, /buildReportPayload\(/);
  assert.match(region, /sendBugReport\(/);
  assert.match(region, /getElementById\("log"\)/);
  assert.match(region, /\.innerHTML/);
  assert.match(region, /mw-app-version/);
  assert.match(region, /navigator\.onLine/);
  assert.match(region, /globalThis\.fetch\.bind\(globalThis\)/);
  assert.match(region, /BUG_REPORT_CONFIG/);
});

test("(D4b) SOURCE (Phase 83, SRV-09): sendReportNow reads the local limit record through window.mzStorage, checks it with checkLocalLimit before sendBugReport, passes identity: sharedIdentity(), and writes result.limit back", () => {
  const region = sliceBetween(MODULE, "async function sendReportNow() {", "\n  document.getElementById(\"mw-menu-report\")");
  assert.match(region, /LOCAL_LIMIT_KEY/);
  assert.match(region, /window\.mzStorage/);
  assert.match(region, /sanitizeLocalLimit\(/);
  assert.match(region, /checkLocalLimit\(/);
  assert.match(region, /identity:\s*sharedIdentity\(\)/);
  assert.match(region, /result\.limit/);
  const checkIdx = region.indexOf("checkLocalLimit(");
  const sendIdx = region.indexOf("sendBugReport(");
  assert.ok(checkIdx !== -1 && sendIdx !== -1 && checkIdx < sendIdx, "checkLocalLimit runs before sendBugReport");
});

test("(D4c) SOURCE (Phase 83, SRV-09): sharedIdentity() lazily creates one createIdentity instance (window.mzStorage, bound fetch, competeOn () => false) and returns the same instance afterwards", () => {
  assert.equal(occurrences(MODULE, "function sharedIdentity() {"), 1);
  const fn = sliceBetween(MODULE, "function sharedIdentity() {", "\n  }");
  assert.match(fn, /createIdentity\(/);
  assert.match(fn, /storage:\s*window\.mzStorage/);
  assert.match(fn, /globalThis\.fetch\.bind\(globalThis\)/);
  assert.match(fn, /competeOn:\s*\(\)\s*=>\s*false/);
  const region = sliceBetween(MODULE, "let reportModel = REPORT_SHEET_INITIAL;", '\n  document.getElementById("mw-report-text")?.addEventListener("input"');
  assert.match(region, /function sharedIdentity\(\)/);
});

test("(D5) SOURCE: the report block writes no S, no dispatch, no persist, no localStorage, no innerHTML assignment and no window.__mz bridge", () => {
  const region = sliceBetween(MODULE, "let reportModel = REPORT_SHEET_INITIAL;", '\n  document.getElementById("mw-report-text")?.addEventListener("input"');
  for (const bad of [/\bS\.\w+\s*=/, /__mzState\.set/, /\bdispatch\(/, /\bpersist\(/, /localStorage/, /innerHTML\s*=/, /window\.__mz\w*\s*=/]) {
    assert.doesNotMatch(region, bad, `report block must not match ${bad}`);
  }
});

test("(D6) SOURCE: reportSheetOpen checks #mw-report-sheet's hidden flag", () => {
  const fn = sliceBetween(MODULE, "function reportSheetOpen() {", "\n  }");
  assert.match(fn, /document\.getElementById\("mw-report-sheet"\)/);
  assert.match(fn, /!sheet\.hidden/);
});

test("(D7) SOURCE: the comment-stripped shell has no global fetch call, XMLHttpRequest, WebSocket, EventSource or sendBeacon", () => {
  for (const bad of [/(?<![.\w])fetch\(/, /XMLHttpRequest/, /WebSocket/, /EventSource/, /sendBeacon/]) {
    assert.doesNotMatch(CODE, bad);
  }
});

// ═══════════════════════ (E) the keydown guard ══════════════════════════════

test("(E1) SOURCE: the keydown guard sits before fightLogSheetOpen, after the ☰ escape line, and the keydown region still lacks 'movement'", () => {
  const keys = sliceBetween(CODE, 'addEventListener("keydown"', 'addEventListener("resize"');
  const escapeIdx = keys.indexOf('if (k === "escape" && hudMenuIsOpen())');
  const guardIdx = keys.indexOf('document.getElementById("mw-report-sheet")?.hidden === false');
  const fightLogIdx = keys.indexOf("if (fightLogSheetOpen())");
  assert.ok(escapeIdx !== -1 && guardIdx !== -1 && fightLogIdx !== -1);
  assert.ok(escapeIdx < guardIdx && guardIdx < fightLogIdx);
  assert.doesNotMatch(keys, /movement/);
  assert.match(
    keys,
    /if \(document\.getElementById\("mw-report-sheet"\)\?\.hidden === false\) \{ if \(k === "escape"\) \{ e\.preventDefault\(\); document\.getElementById\("mw-report-cancel"\)\?\.click\(\); \} return; \}/,
  );
});
