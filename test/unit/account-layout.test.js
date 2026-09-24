// test/unit/account-layout.test.js
//
// Phase 67 (ACCT-01/ACCT-02), Plan 05: the shell's home for the Play Games
// account chip and its bottom sheet. Markup and CSS only; 67-07's
// src/browser/accountChip.js renders into these elements and 67-08 wires
// them. Phase 70 (POLISH-02, D-03, superseding Phase 67 D-05) retired the
// band-2 chip: the ☰ button wears the account face and its dropdown carries
// the ACCOUNT block (pinned in hud-menu-layout.test.js (16)). This file pins:
//   - band 2 carries no account chip and no actions wrapper (D-03);
//   - the title chip in #mw-title-screen's corner (D-06);
//   - the title chip's attributes and its static "nobody" first paint (D-07);
//   - the account sheet in the mw-legend-sheet family (D-09);
//   - the hidden dev option that seeds the browser fake (D-12);
//   - the CSS: 44×44 targets, the faces, the title placement, the sheets'
//     z-order above the title and roller screens, and one rule per class in
//     the renderer's class contract (ACCOUNT_CLASSES).
//
// mazeworld.html has no ESM module surface, so this reads the file with
// CRLF normalized, as the sibling shell/layout tests do.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8").replace(/\r\n/g, "\n");

function sliceBetween(source, startMarker, endMarker, fromIndex = 0) {
  const start = source.indexOf(startMarker, fromIndex);
  assert.ok(start !== -1, `start marker not found: ${startMarker}`);
  const end = source.indexOf(endMarker, start);
  assert.ok(end !== -1 && end > start, `end marker not found after start: ${endMarker}`);
  return source.slice(start, end);
}

function ruleFor(selectorSource) {
  const re = new RegExp(`^${selectorSource}\\{([^}]*)\\}`, "m");
  const m = HTML.match(re);
  assert.ok(m, `expected to find a rule for /^${selectorSource}\\{/m`);
  return m[1];
}

const CHIP_FACE = '<span class="mw-acct-face" data-state="nobody" aria-hidden="true"><span class="mw-acct-glyph">?</span></span>';

// ─── markup ──────────────────────────────────────────────────────────────

test("(1) Phase 70 D-03: band 2 carries no account chip and no actions wrapper (the ☰ wrap follows the counters); the title chip is intact", () => {
  const band2 = sliceBetween(HTML, '<div class="mw-hud-band2">', "</header>");
  for (const token of ['id="mw-acct-chip"', 'class="mw-hud-actions"', "mw-acct-face"]) {
    assert.equal(band2.indexOf(token), -1, `band 2 must carry no ${token}`);
  }
  assert.equal((HTML.match(/class="mw-hud-actions"/g) || []).length, 0, "no .mw-hud-actions group anywhere");
  const countersIdx = band2.indexOf('class="mw-hud-counters"');
  const wrapIdx = band2.indexOf('class="mw-hud-menu-wrap"');
  assert.ok(countersIdx !== -1 && wrapIdx !== -1 && countersIdx < wrapIdx, "the counters, then the ☰ wrap");
  assert.equal((HTML.match(/id="mw-title-acct-chip"/g) || []).length, 1, "the title chip is intact");
});

test("(2) the title chip carries the button type, the aria contract and the static nobody face; the retired band-2 chip id appears nowhere", () => {
  assert.equal((HTML.match(/id="mw-acct-chip"/g) || []).length, 0, "the band-2 chip is retired (Phase 70 D-03)");
  assert.equal((HTML.match(/id="mw-title-acct-chip"/g) || []).length, 1);
  assert.ok(
    HTML.includes(`<button type="button" class="mw-acct-chip mw-title-acct" id="mw-title-acct-chip" aria-haspopup="dialog" aria-controls="mw-acct-sheet" aria-label="Play Games account">${CHIP_FACE}</button>`),
    "title chip markup",
  );
});

test("(3) the title chip sits inside #mw-title-screen, after .mw-title-scrim and before .mw-title-body", () => {
  const title = sliceBetween(HTML, '<div id="mw-title-screen" class="mw-title-screen">', '<div class="mw-title-body">');
  const scrimIdx = title.indexOf('class="mw-title-scrim"');
  const chipIdx = title.indexOf('id="mw-title-acct-chip"');
  assert.ok(scrimIdx !== -1 && chipIdx !== -1 && scrimIdx < chipIdx, "the title chip follows the scrim, inside the title screen, before its body");
});

test("(4) the account sheet: legend-sheet family classes, hidden by default, scrim, role=dialog panel labelled by #mw-acct-title, a Close button, and the rows host", () => {
  assert.equal((HTML.match(/id="mw-acct-sheet"/g) || []).length, 1);
  const sheet = sliceBetween(HTML, '<div id="mw-acct-sheet"', "<!-- ============", 0);
  assert.match(sheet, /^<div id="mw-acct-sheet" class="mw-legend-sheet mw-acct-sheet" hidden>/);
  assert.match(sheet, /<div class="mw-legend-scrim" id="mw-acct-scrim"><\/div>/);
  assert.match(sheet, /<div class="mw-legend-panel" role="dialog" aria-labelledby="mw-acct-title">/);
  assert.match(sheet, /<div class="mw-legend-head"><span class="mw-acct-title" id="mw-acct-title"><\/span><button type="button" class="mw-legend-close" id="mw-acct-close" aria-label="Close">Close<\/button><\/div>/);
  assert.match(sheet, /<div class="mw-acct-rows" id="mw-acct-rows"><\/div>/);
  // The sheet follows the settings sheet (its stacking sibling).
  assert.ok(HTML.indexOf('id="mw-settings-sheet"') < HTML.indexOf('id="mw-acct-sheet"'));
});

test("(5) the dev option: a pgsDevSignedIn group with false/true values inside the hidden #mw-dev-row", () => {
  assert.equal((HTML.match(/data-setting="pgsDevSignedIn"/g) || []).length, 1);
  const devRow = sliceBetween(HTML, 'id="mw-dev-row" hidden>', 'id="mw-dev-perf"');
  const group = sliceBetween(devRow, 'data-setting="pgsDevSignedIn"', "</div>");
  const values = [...group.matchAll(/class="mw-settings-opt" data-value="([^"]+)"/g)].map((m) => m[1]);
  assert.deepStrictEqual(values, ["false", "true"]);
  assert.ok(devRow.indexOf('id="mw-dev-start-btn"') < devRow.indexOf('data-setting="pgsDevSignedIn"'), "the dev group follows the start-depth options");
});

test("(6) the title chip and the sheet sit outside .mw-maze-viewport's hit path", () => {
  const viewport = sliceBetween(HTML, '<div class="mw-maze-viewport" id="mw-maze-viewport">', "<!-- DR5: the encounter/feature-event panel");
  for (const id of ["mw-title-acct-chip", "mw-acct-sheet", "mw-acct-scrim", "mw-acct-rows", "mw-acct-close"]) {
    assert.doesNotMatch(viewport, new RegExp(`id="${id}"`), `#${id} must not appear inside the viewport`);
  }
});

// ─── CSS ─────────────────────────────────────────────────────────────────

// Every <style> block's text, comments stripped.
const CSS = [...HTML.matchAll(/<style>([\s\S]*?)<\/style>/g)]
  .map((m) => m[1])
  .join("\n")
  .replace(/\/\*[\s\S]*?\*\//g, "");

function pxOf(rule, prop) {
  const m = rule.match(new RegExp(`(?:^|;|\\s)${prop}:(-?\\d+(?:\\.\\d+)?)px`));
  assert.ok(m, `expected ${prop} in px`);
  return Number(m[1]);
}

function zOf(rule, name) {
  const m = rule.match(/z-index:(\d+)/);
  assert.ok(m, `${name} must declare a z-index`);
  return Number(m[1]);
}

test("(7) the title chip's hit box (.mw-acct-chip, now the title chip's only user) is at least 44×44 (width, height and min-height), with the generic button press neutralised", () => {
  const chip = ruleFor("\\.mw-acct-chip");
  assert.match(HTML, /^\.mw-acct-chip\{width:44px;height:44px/m);
  assert.ok(pxOf(chip, "width") >= 44, "width ≥ 44");
  assert.ok(pxOf(chip, "height") >= 44, "height ≥ 44");
  assert.ok(pxOf(chip, "min-height") >= 44, "min-height ≥ 44 (overrides the generic 48px floor without shrinking the target)");
  const active = ruleFor("\\.mw-acct-chip:active:not\\(:disabled\\)");
  assert.match(active, /transform:none/);
  assert.match(active, /box-shadow:none/);
});

test("(8) the title chip is absolutely positioned top-right, clear of the safe-area inset; .mw-acct-chip declares margin:0 itself (Phase 70 D-03: no band-2 overlap margins left to cancel)", () => {
  const rule = ruleFor("\\.mw-title-acct");
  assert.match(rule, /position:absolute/);
  assert.match(rule, /top:calc\(12px \+ var\(--safe-area-inset-top, env\(safe-area-inset-top, 0px\)\)\)/);
  assert.match(rule, /right:12px/);
  assert.doesNotMatch(rule, /(?:^|;)margin:/, ".mw-title-acct needs no margin override");
  assert.match(ruleFor("\\.mw-acct-chip"), /(?:^|;)margin:0(?:;|$)/);
  // It sits above .mw-title-body's own z-index.
  assert.ok(zOf(rule, ".mw-title-acct") > zOf(ruleFor("\\.mw-title-body"), ".mw-title-body"));
  // .mw-title-acct follows .mw-acct-chip in source, so its own rules win at equal specificity.
  assert.ok(HTML.indexOf("\n.mw-title-acct{") > HTML.indexOf("\n.mw-acct-chip{"));
});

test("(9) both sheets stack above the title screen and the roller (parsed z-indexes)", () => {
  assert.equal((HTML.match(/#mw-acct-sheet,#mw-settings-sheet\{z-index:55\}/g) || []).length, 1);
  const sheets = zOf(ruleFor("#mw-acct-sheet,#mw-settings-sheet"), "the account/settings sheets");
  const title = zOf(ruleFor("\\.mw-title-screen"), ".mw-title-screen");
  const roller = zOf(ruleFor("\\.mw-roller-screen"), ".mw-roller-screen");
  const legend = zOf(ruleFor("\\.mw-legend-sheet"), ".mw-legend-sheet");
  assert.ok(sheets > title && sheets > roller, `sheets (${sheets}) must exceed the title (${title}) and roller (${roller})`);
  assert.ok(sheets > legend, "the id rule lifts the two sheets above the family's base z-index");
});

test("(10) the faces: nobody is a hollow square with a dim ?, pending is the nobody look dimmed, avatar carries the gold on-ring; the face is 34×34", () => {
  const face = ruleFor("\\.mw-acct-face");
  assert.equal(pxOf(face, "width"), 34);
  assert.equal(pxOf(face, "height"), 34);
  assert.match(face, /box-sizing:border-box/);
  const nobody = ruleFor('\\.mw-acct-face\\[data-state="nobody"\\]');
  assert.match(nobody, /background:transparent/);
  assert.match(nobody, /border:2px solid #6b5c3c/);
  assert.match(nobody, /box-shadow:none/);
  const pending = ruleFor('\\.mw-acct-face\\[data-state="pending"\\]');
  assert.match(pending, /border:2px solid #6b5c3c/);
  assert.match(pending, /opacity:\.55/);
  const avatar = ruleFor('\\.mw-acct-face\\[data-state="avatar"\\]');
  assert.match(avatar, /box-shadow:inset 0 0 0 1px rgba\(0,0,0,\.5\),0 0 0 1px #e8c97a/);
  const glyph = ruleFor("\\.mw-acct-glyph");
  assert.match(glyph, /color:#6b5c3c/);
  assert.match(glyph, /font-family:var\(--mono\)/);
});

// The class contract. 67-07's renderer (src/browser/accountChip.js) exports
// ACCOUNT_CLASSES with exactly the first list; the second is this plan's own
// static markup. Pinned literally so either side drifting fails here.
const RENDERER_CLASSES = [
  "mw-acct-face", "mw-acct-initials", "mw-acct-glyph", "mw-acct-id", "mw-acct-id-text",
  "mw-acct-name", "mw-acct-status", "mw-acct-action", "mw-acct-help", "mw-acct-row",
  "mw-acct-label", "mw-acct-options", "mw-acct-opt", "mw-acct-settings",
];
// Phase 70 (D-03/D-04): the band-2 wrapper is retired; the ☰ dropdown's
// ACCOUNT host joins the static markup.
const STATIC_CLASSES = ["mw-hud-menu-acct", "mw-acct-chip", "mw-title-acct", "mw-acct-sheet", "mw-acct-title", "mw-acct-rows"];

test("(12) every class in the renderer contract and the static markup has at least one rule in the style blocks", () => {
  for (const cls of [...RENDERER_CLASSES, ...STATIC_CLASSES]) {
    const re = new RegExp(`\\.${cls}(?![\\w-])[^{};]*\\{`);
    assert.match(CSS, re, `.${cls} must have at least one CSS rule`);
  }
});

test("(13) sheet rows keep 44px+ tap height and buttons a 48px floor; the settings rules themselves are untouched", () => {
  assert.ok(pxOf(ruleFor("\\.mw-acct-id"), "min-height") >= 44);
  for (const sel of ["\\.mw-acct-action", "\\.mw-acct-opt", "\\.mw-acct-settings"]) {
    assert.ok(pxOf(ruleFor(sel), "min-height") >= 48, `${sel} min-height ≥ 48`);
  }
  assert.match(HTML, /^\.mw-settings-row\{padding:14px 0;border-bottom:2px solid #241f16\}$/m);
  assert.match(HTML, /^\.mw-acct-row\{padding:14px 0;border-bottom:2px solid #241f16\}$/m);
});
