// test/unit/boards-css.test.js
//
// Phase 66 (BOARD-01..06, D-01/D-13) — the Leaderboards panel's CSS pins.
// Mirrors gear-tab-dom.test.js's own HTML read (CRLF-normalized) and style-
// block extraction, but this file's style rules straddle more than one
// <style> element in mazeworld.html's <head> (the #screen-dead layout reset
// and the .mw-bd-* block sit in a later <style> tag than the :root token
// block), so this file concatenates every <style> block found before
// </head> rather than assuming a single block.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { BOARDS_CLASSES } from "../../src/browser/boardsPanel.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const HTML_PATH = path.join(REPO_ROOT, "mazeworld.html");
const HTML_RAW = fs.readFileSync(HTML_PATH, "utf8").replace(/\r\n/g, "\n");

// ─── style-block extraction: every <style>...</style> region before </head>,
// concatenated (mazeworld.html's <head> holds several separate <style> tags
// with non-style markup — <title>, meta — between some of them). ──────────

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

// Every .mw-bd* rule the renderer's classes could appear in is written as a
// single physical line in this file's convention (one selector/declaration
// block per line) — filter the style block down to just those lines.
function boardsStyleLines() {
  return STYLE_BLOCK.split("\n").filter((line) => line.trim().startsWith(".mw-bd"));
}

// Finds the exact single-line rule for a bare selector (e.g. ".mw-bd-body{")
// and returns its declaration body, or null if not found.
function findRuleBody(selector) {
  const re = new RegExp("^" + escapeRegExp(selector) + "\\{([^}]*)\\}", "m");
  const m = STYLE_BLOCK.match(re);
  return m ? m[1] : null;
}

// ─── (1): every BOARDS_CLASSES name appears as a selector ─────────────────

test("CSS: every BOARDS_CLASSES entry appears as a selector in mazeworld.html", () => {
  assert.ok(BOARDS_CLASSES.length > 0, "expected a non-empty BOARDS_CLASSES");
  for (const name of BOARDS_CLASSES) {
    const re = new RegExp("\\." + escapeRegExp(name) + "[{,:\\[ .]");
    assert.match(STYLE_BLOCK, re, `expected a selector for .${name}`);
  }
});

// ─── (2): every .mw-bd font-size scales with --mw-text-scale ──────────────

test("CSS: every .mw-bd* font-size declaration scales with var(--mw-text-scale)", () => {
  const lines = boardsStyleLines();
  assert.ok(lines.length >= 50, `expected at least 50 .mw-bd style lines, found ${lines.length}`);
  let fontSizeCount = 0;
  for (const line of lines) {
    for (const m of line.matchAll(/font-size:([^;}]+)[;}]/g)) {
      fontSizeCount++;
      assert.match(m[1], /var\(--mw-text-scale\)/, `expected ${line.trim()} to scale with var(--mw-text-scale)`);
    }
  }
  assert.ok(fontSizeCount >= 30, `expected at least 30 font-size declarations, found ${fontSizeCount}`);
});

// ─── (3): the structural layout rules ──────────────────────────────────────

test("CSS: .mw-bd is a full-height flex column", () => {
  const body = findRuleBody(".mw-bd");
  assert.ok(body, "expected an exact .mw-bd{...} rule");
  assert.match(body, /display:flex/);
  assert.match(body, /flex-direction:column/);
  assert.match(body, /height:100%/);
});

test("CSS: .mw-bd-body scrolls independently (overflow-y:auto, min-height:0)", () => {
  const body = findRuleBody(".mw-bd-body");
  assert.ok(body, "expected an exact .mw-bd-body{...} rule");
  assert.match(body, /overflow-y:auto/);
  assert.match(body, /min-height:0/);
});

test("CSS: .mw-bd-rail scrolls horizontally (overflow-x:auto)", () => {
  const body = findRuleBody(".mw-bd-rail");
  assert.ok(body, "expected an exact .mw-bd-rail{...} rule");
  assert.match(body, /overflow-x:auto/);
});

// ─── (4): touch targets ────────────────────────────────────────────────────

test("CSS: .mw-bd-back is a 44x44 target", () => {
  const body = findRuleBody(".mw-bd-back");
  assert.ok(body, "expected an exact .mw-bd-back{...} rule");
  assert.match(body, /width:44px/);
  assert.match(body, /height:44px/);
});

test("CSS: .mw-bd-dock-btn is at least 48px tall", () => {
  const body = findRuleBody(".mw-bd-dock-btn");
  assert.ok(body, "expected an exact .mw-bd-dock-btn{...} rule");
  assert.match(body, /min-height:48px/);
});

test("CSS (Phase 68): .mw-bd-season-chip and .mw-bd-consent declare a min-height of at least 44px", () => {
  for (const selector of [".mw-bd-season-chip", ".mw-bd-consent"]) {
    const body = findRuleBody(selector);
    assert.ok(body, `expected an exact ${selector}{...} rule`);
    const m = body.match(/min-height:(\d+)px/);
    assert.ok(m, `${selector} declares no px min-height`);
    assert.ok(Number(m[1]) >= 44, `${selector} min-height ${m[1]}px is under 44px`);
  }
});

test("CSS (Phase 68): the season label, picker and consent rules exist and carry no motion", () => {
  for (const selector of [".mw-bd-season", ".mw-bd-seasons", ".mw-bd-season-chip", ".mw-bd-consent"]) {
    const body = findRuleBody(selector);
    assert.ok(body, `expected an exact ${selector}{...} rule`);
    assert.doesNotMatch(body, /animation|transition/);
  }
  assert.match(STYLE_BLOCK, /\.mw-bd-season-chip\[data-on="1"\]\{/);
});

test("CSS (Phase 70, D-09): .mw-bd-pick-chip is a 44px-tall target and each .mw-bd-pick-chips row scrolls horizontally", () => {
  const chip = findRuleBody(".mw-bd-pick-chip");
  assert.ok(chip, "expected an exact .mw-bd-pick-chip{...} rule");
  assert.match(chip, /min-height:44px/);
  assert.match(chip, /white-space:nowrap/);
  const chips = findRuleBody(".mw-bd-pick-chips");
  assert.ok(chips, "expected an exact .mw-bd-pick-chips{...} rule");
  assert.match(chips, /overflow-x:auto/);
  assert.match(chips, /min-width:0/);
});

test("CSS (Phase 70, D-09): the picker rules exist, carry no motion, and the on chip is painted in the LINEAGE colour", () => {
  for (const selector of [".mw-bd-lineage", ".mw-bd-pick", ".mw-bd-pick-label", ".mw-bd-pick-chips", ".mw-bd-pick-chip"]) {
    const body = findRuleBody(selector);
    assert.ok(body, `expected an exact ${selector}{...} rule`);
    assert.doesNotMatch(body, /animation|transition/);
  }
  assert.match(STYLE_BLOCK, /\.mw-bd-pick-chip\[data-on="1"\]\{color:#14110c;background:#b9a4ef;box-shadow:inset 0 0 0 1px #b9a4ef\}/);
});

test("CSS: .mw-bd-row uses touch-action:manipulation", () => {
  const body = findRuleBody(".mw-bd-row");
  assert.ok(body, "expected an exact .mw-bd-row{...} rule");
  assert.match(body, /touch-action:manipulation/);
});

// ─── (5): title-mode chrome rules ───────────────────────────────────────────

test("CSS: the two title-mode chrome rules exist exactly", () => {
  assert.match(STYLE_BLOCK, /body\[data-boards-entry="title"\] #mw-tabbar\{display:none\}/);
  assert.match(STYLE_BLOCK, /body\[data-boards-entry="title"\] #mw-rail\{display:none\}/);
});

// ─── (6): the pinned #screen-dead line, plus the new layout-reset line ────

test("CSS (Phase 70 D-08): the in-game #screen-dead sits flush under the HUD (padding-top 0), the title-opened panel keeps the safe-area top padding, and a separate rule zeroes the side/bottom padding", () => {
  assert.match(STYLE_BLOCK, /(^|\n)#screen-dead\{padding-top:0\}/);
  assert.match(
    STYLE_BLOCK,
    /body\[data-boards-entry="title"\] #screen-dead\{padding-top:calc\(14px \+ var\(--safe-area-inset-top, env\(safe-area-inset-top, 0px\)\)\)\}/
  );
  assert.doesNotMatch(
    STYLE_BLOCK,
    /(^|\n)#screen-dead\{padding-top:calc\(/,
    "the unscoped safe-area padding line is retired (the HUD carries the inset on the in-game tab)"
  );
  assert.match(STYLE_BLOCK, /#screen-dead\{padding-left:0;padding-right:0;padding-bottom:0;height:100%\}/);
});

// ─── (7): reduced motion — only two .mw-bd rules carry any motion ─────────

test("CSS: the blanket prefers-reduced-motion rule still exists", () => {
  assert.match(STYLE_BLOCK, /@media \(prefers-reduced-motion:reduce\)\{\*\{transition:none!important;animation:none!important\}\}/);
});

test("CSS: only .mw-bd-detail and .mw-bd-bar-fill declare animation or transition among the .mw-bd rules", () => {
  const lines = boardsStyleLines();
  const allowed = new Set([".mw-bd-detail", ".mw-bd-bar-fill"]);
  for (const line of lines) {
    if (!/animation:|transition:/.test(line)) continue;
    const selector = line.trim().slice(0, line.indexOf("{"));
    assert.ok(allowed.has(selector), `unexpected motion on ${selector || line.trim()}`);
  }
});

// ─── (8): @keyframes mwrise is not duplicated ─────────────────────────────

test("CSS: @keyframes mwrise is defined exactly once", () => {
  const count = (HTML_RAW.match(/@keyframes mwrise\{/g) || []).length;
  assert.equal(count, 1, `expected exactly one @keyframes mwrise, found ${count}`);
});
