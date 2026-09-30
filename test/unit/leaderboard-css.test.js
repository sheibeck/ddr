// test/unit/leaderboard-css.test.js
//
// Phase 84 (BOARD-18..25), Plan 06 Task 2 — the v3 Leaderboards panel's CSS
// pins. Mirrors boards-css.test.js's own style-block extraction (mazeworld
// .html's <head> holds several separate <style> tags, so this file
// concatenates every <style> block found before </head> rather than
// assuming a single block).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { LEADERBOARD_CLASSES } from "../../src/browser/leaderboardPanel.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const HTML_PATH = path.join(REPO_ROOT, "mazeworld.html");
const HTML_RAW = fs.readFileSync(HTML_PATH, "utf8").replace(/\r\n/g, "\n");

function styleBlock() {
  const headEnd = HTML_RAW.indexOf("</head>");
  assert.ok(headEnd !== -1, "</head> not found");
  const head = HTML_RAW.slice(0, headEnd);
  const blocks = [...head.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
  assert.ok(blocks.length >= 2, `expected at least 2 <style> blocks in <head>, found ${blocks.length}`);
  return blocks.join("\n");
}

const STYLE_BLOCK = styleBlock();

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Every .mw-lb* rule the renderer's classes could appear in is written as a
// single physical line in this file's convention (one selector/declaration
// block per line) — filter the style block down to just those lines.
function leaderboardStyleLines() {
  return STYLE_BLOCK.split("\n").filter((line) => line.trim().startsWith(".mw-lb"));
}

// Finds the exact single-line rule for a bare selector (e.g. ".mw-lb-body{")
// and returns its declaration body, or null if not found.
function findRuleBody(selector) {
  const re = new RegExp("^" + escapeRegExp(selector) + "\\{([^}]*)\\}", "m");
  const m = STYLE_BLOCK.match(re);
  return m ? m[1] : null;
}

// ─── (1): every LEADERBOARD_CLASSES entry appears as a selector ───────────

test("CSS: every LEADERBOARD_CLASSES entry appears as a selector in mazeworld.html", () => {
  assert.ok(LEADERBOARD_CLASSES.length > 0, "expected a non-empty LEADERBOARD_CLASSES");
  for (const name of LEADERBOARD_CLASSES) {
    const re = new RegExp("\\." + escapeRegExp(name) + "[{,:\\[ .]");
    assert.match(STYLE_BLOCK, re, `expected a selector for .${name}`);
  }
});

// ─── (2): at least 40 .mw-lb* physical lines, and every font-size scales ──

test("CSS: at least 40 .mw-lb* style lines exist", () => {
  const lines = leaderboardStyleLines();
  assert.ok(lines.length >= 40, `expected at least 40 .mw-lb style lines, found ${lines.length}`);
});

test("CSS: every .mw-lb* font-size declaration scales with var(--mw-text-scale)", () => {
  const lines = leaderboardStyleLines();
  let fontSizeCount = 0;
  for (const line of lines) {
    for (const m of line.matchAll(/font-size:([^;}]+)[;}]/g)) {
      fontSizeCount++;
      assert.match(m[1], /var\(--mw-text-scale\)/, `expected ${line.trim()} to scale with var(--mw-text-scale)`);
    }
  }
  assert.ok(fontSizeCount >= 30, `expected at least 30 font-size declarations, found ${fontSizeCount}`);
});

// ─── (3): structural layout rules ──────────────────────────────────────────

test("CSS: .mw-lb is a full-height flex column and the positioning root for .mw-lb-sheet", () => {
  const body = findRuleBody(".mw-lb");
  assert.ok(body, "expected an exact .mw-lb{...} rule");
  assert.match(body, /display:flex/);
  assert.match(body, /flex-direction:column/);
  assert.match(body, /height:100%/);
  assert.match(body, /position:relative/);
});

test("CSS: .mw-lb-body scrolls independently (overflow-y:auto, min-height:0)", () => {
  const body = findRuleBody(".mw-lb-body");
  assert.ok(body, "expected an exact .mw-lb-body{...} rule");
  assert.match(body, /overflow-y:auto/);
  assert.match(body, /min-height:0/);
});

test("CSS: .mw-lb-sheet-opts scrolls independently", () => {
  const body = findRuleBody(".mw-lb-sheet-opts");
  assert.ok(body, "expected an exact .mw-lb-sheet-opts{...} rule");
  assert.match(body, /overflow-y:auto/);
});

test("CSS: .mw-lb-sheet positions absolutely, over .mw-lb", () => {
  const body = findRuleBody(".mw-lb-sheet");
  assert.ok(body, "expected an exact .mw-lb-sheet{...} rule");
  assert.match(body, /position:absolute/);
  assert.match(body, /inset:0/);
});

test("CSS: .mw-lb-sheet-panel sits above .mw-lb-scrim (both positioned, panel after scrim in DOM/markup order)", () => {
  const scrim = findRuleBody(".mw-lb-scrim");
  assert.ok(scrim, "expected an exact .mw-lb-scrim{...} rule");
  assert.match(scrim, /position:absolute/);
  const panel = findRuleBody(".mw-lb-sheet-panel");
  assert.ok(panel, "expected an exact .mw-lb-sheet-panel{...} rule");
  assert.match(panel, /position:relative/);
});

// ─── (4): touch targets — at least 44px on every tappable surface ─────────

test("CSS: the back button, header box, pickers, sheet options, DONE, CLEAR FILTERS, SEE YOUR DEAD and dock buttons declare a min-height of at least 44px", () => {
  const selectors = [
    ".mw-lb-back",
    ".mw-lb-box",
    ".mw-lb-picker",
    ".mw-lb-opt",
    ".mw-lb-sheet-done",
    ".mw-lb-clear",
    ".mw-lb-detail-filter",
    ".mw-lb-note-btn",
    ".mw-lb-dock-btn",
  ];
  for (const selector of selectors) {
    const body = findRuleBody(selector);
    assert.ok(body, `expected an exact ${selector}{...} rule`);
    const heightMatch = body.match(/height:(\d+)px/);
    const minHeightMatch = body.match(/min-height:(\d+)px/);
    const px = minHeightMatch ? Number(minHeightMatch[1]) : heightMatch ? Number(heightMatch[1]) : null;
    assert.ok(px !== null, `${selector} declares no px height/min-height`);
    assert.ok(px >= 44, `${selector} height ${px}px is under 44px`);
  }
});

// ─── (5): the caret and the diamond are CSS shapes ─────────────────────────

test("CSS: .mw-lb-caret is a CSS triangle (width 0, height 0 and border declarations)", () => {
  const body = findRuleBody(".mw-lb-caret");
  assert.ok(body, "expected an exact .mw-lb-caret{...} rule");
  assert.match(body, /width:0/);
  assert.match(body, /height:0/);
  assert.match(body, /border-(left|right|top|bottom):/);
});

test("CSS: .mw-lb-opt-mark is a CSS diamond (a width, a height and transform:rotate(45deg))", () => {
  const body = findRuleBody(".mw-lb-opt-mark");
  assert.ok(body, "expected an exact .mw-lb-opt-mark{...} rule");
  assert.match(body, /width:\d/);
  assert.match(body, /height:\d/);
  assert.match(body, /transform:rotate\(45deg\)/);
});

// ─── (6): row/option state rules ───────────────────────────────────────────

test("CSS: .mw-lb-row[data-you=\"1\"] carries the gold inset bar", () => {
  assert.match(STYLE_BLOCK, /\.mw-lb-row\[data-you="1"\]\{[^}]*inset 3px 0 0 #e8c97a[^}]*\}/);
});

test("CSS: .mw-lb-opt[data-dim=\"1\"] dims both its label and its count", () => {
  assert.match(STYLE_BLOCK, /\.mw-lb-opt\[data-dim="1"\] \.mw-lb-opt-label\{color:#5a5242\}/);
  assert.match(STYLE_BLOCK, /\.mw-lb-opt\[data-dim="1"\] \.mw-lb-opt-n\{color:#4a4032\}/);
});

test("CSS: .mw-lb-opt[data-on=\"1\"] carries the selected background and the gold-or-inline-coloured mark", () => {
  const optOn = findRuleBody('.mw-lb-opt[data-on="1"]');
  assert.ok(optOn, 'expected an exact .mw-lb-opt[data-on="1"]{...} rule');
  assert.match(optOn, /background:#221d13/);
  assert.match(STYLE_BLOCK, /\.mw-lb-opt\[data-on="1"\] \.mw-lb-opt-mark\{color:#e8c97a\}/);
});

// ─── (7): reduced motion — only the rise/fade-in rules carry any motion ───

test("CSS: the blanket prefers-reduced-motion rule still exists", () => {
  assert.match(STYLE_BLOCK, /@media \(prefers-reduced-motion:reduce\)\{\*\{transition:none!important;animation:none!important\}\}/);
});

test("CSS: only .mw-lb-detail, .mw-lb-sheet and .mw-lb-sheet-panel declare animation or transition among the .mw-lb rules", () => {
  const lines = leaderboardStyleLines();
  const allowed = new Set([".mw-lb-detail", ".mw-lb-sheet", ".mw-lb-sheet-panel"]);
  for (const line of lines) {
    if (!/animation:|transition:/.test(line)) continue;
    const selector = line.trim().slice(0, line.indexOf("{"));
    assert.ok(allowed.has(selector), `unexpected motion on ${selector || line.trim()}`);
  }
});

test("CSS: @keyframes mwrise and @keyframes mwfade are each defined exactly once", () => {
  const riseCount = (HTML_RAW.match(/@keyframes mwrise\{/g) || []).length;
  assert.equal(riseCount, 1, `expected exactly one @keyframes mwrise, found ${riseCount}`);
  const fadeCount = (HTML_RAW.match(/@keyframes mwfade\{/g) || []).length;
  assert.equal(fadeCount, 1, `expected exactly one @keyframes mwfade, found ${fadeCount}`);
});

// ─── (8): the old .mw-bd-* block is gone (84-09) ────────────────────────────

test("CSS: the old .mw-bd-* block is gone (84-09 removed it; .mw-lb is the only Leaderboards CSS)", () => {
  const lines = STYLE_BLOCK.split("\n").filter((line) => line.trim().startsWith(".mw-bd"));
  assert.equal(lines.length, 0, `expected zero .mw-bd style lines, found ${lines.length}`);
});
