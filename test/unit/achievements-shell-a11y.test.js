// test/unit/achievements-shell-a11y.test.js
//
// Phase 100 (AUI-01..03), plan 05 task 3: reduced motion, text scale, dialog
// semantics, the accessibility tree and size-only layout, pinned over the
// shell's own source (mazeworld.html's markup, CSS and the two Phase 100 module
// blocks), plus the Phase 100 sections of docs/SHELL-MODULES.md.
//
// Source-level, like notes-sheet-shell.test.js (mazeworld.html has no ESM
// surface a test could import); the accessibility-tree test renders a real
// record through the recording DOM.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { LAYOUT_MEDIA } from "../../src/browser/layoutClass.js";
import { sanitizeRecord } from "../../src/browser/achievementRecord.js";
import { buildAchievementsView, renderAchievementsSheet } from "../../src/browser/achievementsSheet.js";
import { createRecordingDocument } from "./harness/recordingDom.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8").replace(/\r\n/g, "\n");
const DOCS = fs.readFileSync(path.join(REPO_ROOT, "docs", "SHELL-MODULES.md"), "utf8").replace(/\r\n/g, "\n");

// Line comments first, THEN block comments (notes-sheet-shell.test.js).
function stripComments(source) {
  const noLine = source
    .split("\n")
    .map((line) => {
      const i = line.indexOf("//");
      return i === -1 ? line : line.slice(0, i);
    })
    .join("\n");
  return noLine.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""));
}

const MARKUP = HTML.replace(/<!--[\s\S]*?-->/g, "");
const STYLE = [...HTML.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
  .map((m) => m[1])
  .join("\n")
  .replace(/\/\*[\s\S]*?\*\//g, "");

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start !== -1, `start marker not found: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end !== -1, `end marker not found after start: ${endMarker}`);
  return source.slice(start, end + endMarker.length);
}

// The two Phase 100 module blocks, comments stripped.
const GLUE_BLOCK = stripComments(
  sliceBetween(HTML, "// Phase 100 (AUI-01) — the unlock banner glue.", "window.__mzAchBanner = {"),
);
const SHEET_BLOCK = stripComments(
  sliceBetween(HTML, "// Phase 100 (AUI-02/03, plan 100-03): the ACHIEVEMENTS sheet — shell-only;", "window.mzSyncAchievementsCount = syncAchievementsCount;"),
);
const NEW_SCRIPT = GLUE_BLOCK + "\n" + SHEET_BLOCK;

// A small CSS reader: every leaf rule with the @-rule preludes around it.
function cssRules(css) {
  const rules = [];
  const stack = [];
  let prelude = "";
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === "{") {
      stack.push({ prelude: prelude.trim(), leaf: false, bodyStart: i + 1 });
      prelude = "";
    } else if (ch === "}") {
      const top = stack.pop();
      if (top && top.leaf) {
        rules.push({ selector: top.prelude, body: css.slice(top.bodyStart, i), at: stack.map((s) => s.prelude) });
      }
      prelude = "";
    } else {
      prelude += ch;
    }
    if (ch === "{") {
      // A "{" opens a leaf rule when no further "{" appears before its "}".
      const nextOpen = css.indexOf("{", i + 1);
      const nextClose = css.indexOf("}", i + 1);
      stack[stack.length - 1].leaf = nextClose !== -1 && (nextOpen === -1 || nextClose < nextOpen);
    }
  }
  return rules;
}

const RULES = cssRules(STYLE);
const NEW_SELECTOR = /mw-ach|mw-achievements|cb-over-earned|data-card-kind/;
const NEW_RULES = RULES.filter((r) => !r.selector.startsWith("@") && NEW_SELECTOR.test(r.selector));

// ─── dialog semantics ─────────────────────────────────────────────────────

test("a11y: the sheet's panel is a modal dialog labelled by an element that exists once", () => {
  const markup = sliceBetween(MARKUP, '<div id="mw-achievements-sheet"', '<div class="mw-fade"');
  const panel = markup.match(/<div class="mw-legend-panel" role="dialog" aria-modal="true" aria-labelledby="([^"]+)">/);
  assert.ok(panel, "the panel carries role=dialog, aria-modal=true and an aria-labelledby");
  const id = panel[1];
  assert.equal(MARKUP.split(`id="${id}"`).length - 1, 1, `id ${id} appears exactly once in the markup`);
  assert.equal(id, "mw-achievements-title");
});

test("a11y: Close has an aria-label and the title can take script focus (tabindex -1)", () => {
  const markup = sliceBetween(MARKUP, '<div id="mw-achievements-sheet"', '<div class="mw-fade"');
  assert.match(markup, /<button type="button" class="mw-legend-close" id="mw-achievements-close" aria-label="Close">Close<\/button>/);
  assert.match(markup, /<span id="mw-achievements-title" tabindex="-1"><\/span>/);
});

test("a11y: the menu row is a menuitem whose glyph span is aria-hidden", () => {
  const row = MARKUP.match(/<button[^>]*id="mw-menu-achievements"[^>]*>[\s\S]*?<\/button>/);
  assert.ok(row, "the ACHIEVEMENTS row exists");
  assert.match(row[0], /role="menuitem"/);
  assert.match(row[0], /<span class="mw-hud-menu-glyph" data-glyph="achievements" aria-hidden="true">/);
});

// ─── reduced motion ───────────────────────────────────────────────────────

test("reduced motion: no new rule declares an animation or a transition", () => {
  assert.ok(NEW_RULES.length >= 20, `expected the Phase 100 rules to be found, got ${NEW_RULES.length}`);
  for (const r of NEW_RULES) {
    assert.doesNotMatch(r.body, /(^|[;\s])(animation|transition)(-[a-z]+)?\s*:/, `${r.selector} declares motion`);
  }
});

test("reduced motion: the blanket prefers-reduced-motion rule that zeroes animation and transition is still there", () => {
  assert.match(STYLE, /@media \(prefers-reduced-motion:\s*reduce\)\{\*\{transition:none!important;animation:none!important\}\}/);
});

test("reduced motion: the new script blocks add no smooth scroll, frame loop or timer", () => {
  assert.doesNotMatch(NEW_SCRIPT, /behavior\s*:\s*["']smooth["']/);
  assert.doesNotMatch(NEW_SCRIPT, /scrollIntoView/);
  assert.doesNotMatch(NEW_SCRIPT, /requestAnimationFrame/);
  assert.doesNotMatch(NEW_SCRIPT, /\bsetInterval\s*\(/);
  assert.doesNotMatch(NEW_SCRIPT, /\bsetTimeout\s*\(/);
  assert.doesNotMatch(NEW_SCRIPT, /\.style\.[A-Za-z]+\s*=/, "no style written by script");
});

// ─── text scale and targets ───────────────────────────────────────────────

test("text scale: every font-size in the new rules goes through --mw-text-scale", () => {
  let seen = 0;
  for (const r of NEW_RULES) {
    for (const m of r.body.matchAll(/font-size\s*:\s*([^;}]+)/g)) {
      seen++;
      assert.match(m[1], /var\(--mw-text-scale\)/, `${r.selector} font-size ${m[1].trim()}`);
    }
  }
  assert.ok(seen >= 6, `expected the list, strip and card rules to set font sizes, saw ${seen}`);
});

test("targets: a track's head button is at least 48px tall", () => {
  const head = NEW_RULES.find((r) => r.selector === ".mw-ach-head");
  assert.ok(head, "the .mw-ach-head rule exists");
  const m = head.body.match(/min-height\s*:\s*(\d+(?:\.\d+)?)px/);
  assert.ok(m, ".mw-ach-head declares a min-height in px");
  assert.ok(Number(m[1]) >= 48, `min-height ${m[1]}px`);
});

// ─── the accessibility tree ───────────────────────────────────────────────

test("a11y tree: no rule hides a row's text parts", () => {
  const parts = [".mw-ach-name", ".mw-ach-state", ".mw-ach-detail", ".mw-ach-progress", ".mw-ach-hint"];
  for (const r of RULES) {
    if (r.selector.startsWith("@")) continue;
    const touches = r.selector.split(",").some((s) => parts.some((p) => s.trim().endsWith(p) || s.trim().includes(p + " ") || s.trim() === p));
    if (!touches) continue;
    assert.doesNotMatch(r.body, /display\s*:\s*none/, `${r.selector} hides text`);
    assert.doesNotMatch(r.body, /visibility\s*:\s*hidden/, `${r.selector} hides text`);
    assert.doesNotMatch(r.body, /(^|[;\s])clip(-path)?\s*:/, `${r.selector} clips text`);
  }
});

function walkAll(node, fn) {
  fn(node);
  for (const child of node.children || []) walkAll(child, fn);
}

test("a11y tree: on a real render only the icons and the ladder are aria-hidden", () => {
  const now = Date.UTC(2026, 9, 5, 12, 0, 0);
  const record = sanitizeRecord({
    v: 1,
    unlocked: { depth_t1: now, depth_t2: now, special_snowflake: now },
    revealed: [],
    bests: { depth: 7 },
    kills: { Beasts: 12 },
  });
  const view = buildAchievementsView(record, { tzOffset: 0 });
  const { document } = createRecordingDocument();
  const host = document.createElement("div");
  renderAchievementsSheet(host, view, { expanded: new Set([view.blocks[0].rows[0].key]), onToggle() {} });
  let hidden = 0;
  const offenders = [];
  walkAll(host, (n) => {
    if (n.nodeType !== 1 || n.getAttribute("aria-hidden") !== "true") return;
    hidden++;
    const cls = n.className || "";
    const isIcon = n.tagName.toLowerCase() === "img" && /\bmw-ach-icon\b/.test(cls);
    const isLadder = /\bmw-ach-ladder\b/.test(cls);
    if (!isIcon && !isLadder) offenders.push(`${n.tagName} ${cls}`);
  });
  assert.ok(hidden > 0, "the render hides its decorative parts");
  assert.deepEqual(offenders, []);
  // The text parts are in the tree: names, states and details exist and are not hidden.
  let textParts = 0;
  walkAll(host, (n) => {
    if (n.nodeType === 1 && /\bmw-ach-(name|state|detail)\b/.test(n.className || "")) {
      textParts++;
      assert.notEqual(n.getAttribute("aria-hidden"), "true");
    }
  });
  assert.ok(textParts > 10);
});

// ─── size-only layout ─────────────────────────────────────────────────────

test("size-only layout: any @media around a new rule is exactly one of the LAYOUT_MEDIA strings", () => {
  const allowed = new Set(Object.values(LAYOUT_MEDIA).map((s) => s.replace(/\s+/g, "")));
  for (const r of NEW_RULES) {
    for (const at of r.at) {
      if (!at.startsWith("@media")) continue;
      const query = at.slice("@media".length).replace(/\s+/g, "");
      assert.ok(allowed.has(query), `${r.selector} sits in ${at}, not a LAYOUT_MEDIA string`);
    }
  }
});

test("size-only layout: the new module blocks make no device test", () => {
  for (const token of ["userAgent", "platform", "getPlatform", "isNativePlatform", "Capacitor", "pointer: coarse", "pointer:coarse", "maxTouchPoints"]) {
    assert.equal(NEW_SCRIPT.toLowerCase().includes(token.toLowerCase()), false, `the new script blocks must not mention ${token}`);
  }
  for (const r of NEW_RULES) {
    assert.doesNotMatch(r.at.join(" "), /pointer|hover|any-/i, `${r.selector} sits in a device media query`);
  }
});

// ─── documentation ────────────────────────────────────────────────────────

function section(heading) {
  const start = DOCS.indexOf(heading);
  assert.ok(start !== -1, `missing heading ${heading}`);
  const next = DOCS.indexOf("\n## ", start + heading.length);
  const nextH3 = DOCS.indexOf("\n### ", start + heading.length);
  const ends = [next, nextH3].filter((i) => i !== -1);
  return DOCS.slice(start, ends.length ? Math.min(...ends) : DOCS.length);
}

test("docs: the two Phase 100 sections sit after the Phase 99 section and before 'What stays shared'", () => {
  const p99 = DOCS.indexOf("### Achievements tracker (Phase 99)");
  const banner = DOCS.indexOf("### Achievements banner (Phase 100)");
  const list = DOCS.indexOf("### Achievements list (Phase 100)");
  const shared = DOCS.indexOf("## What stays shared");
  assert.ok(p99 !== -1 && banner > p99 && list > banner && shared > list);
});

test("docs: the banner section names the modules, the gate, the collapse rule, the strip and the bridge", () => {
  const text = section("### Achievements banner (Phase 100)");
  for (const needle of ["achievementEvents", "bannerNext", "gate", "more than 3", "Earned strip", "__mzAchBanner", "reveal"]) {
    assert.ok(text.includes(needle), `banner section names ${needle}`);
  }
  assert.match(text, /reveal[^.]*no card|no card[^.]*reveal/i);
});

test("docs: the list section names the row, the sheet, the view, the shape, www bundling and the layout classes", () => {
  const text = section("### Achievements list (Phase 100)");
  for (const needle of ["ACHIEVEMENTS", "mw-achievements-sheet", "buildAchievementsView", "35", "www/achievements/ingame", "layout class"]) {
    assert.ok(text.includes(needle), `list section names ${needle}`);
  }
});

test("docs: the Phase 101 contract is stated, with Play's screen on the sheet's VIEW IN PLAY GAMES button and no ☰ row (the user's ruling)", () => {
  const text = section("### Achievements list (Phase 100)");
  assert.match(text, /For Phase 101/);
  assert.match(text, /achievementEvents\.subscribe/);
  assert.match(text, /never call `setAchievementListener`/);
  assert.match(text, /\{ unlocks, reveals, progress \}/);
  assert.match(text, /getAchievementRecord\(\)/);
  assert.match(text, /not the stream/);
  assert.ok(text.includes("VIEW IN PLAY GAMES button at the top of this sheet"));
  assert.equal(text.includes("Play row sits beside"), false);
});

test("docs: the retired surface word is not used in the new sections", () => {
  const text = section("### Achievements banner (Phase 100)") + section("### Achievements list (Phase 100)");
  const retired = ["to", "ast"].join("");
  assert.equal(text.toLowerCase().includes(retired), false);
});

test("docs: the ☰ menu rows section lists ACHIEVEMENTS after MARKS", () => {
  const text = section("### The ☰ menu rows (Phase 70)");
  const marks = text.indexOf("MARKS");
  const ach = text.indexOf("ACHIEVEMENTS");
  assert.ok(marks !== -1 && ach > marks, "ACHIEVEMENTS follows MARKS in the rows list");
});
