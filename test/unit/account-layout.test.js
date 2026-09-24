// test/unit/account-layout.test.js
//
// Phase 67 (ACCT-01/ACCT-02), Plan 05: the shell's home for the Play Games
// account chip and its bottom sheet. Markup and CSS only; 67-07's
// src/browser/accountChip.js renders into these elements and 67-08 wires
// them. This file pins:
//   - the band-2 slot: counters, then .mw-hud-actions, then #mw-acct-chip,
//     then the ☰ wrap and button (D-05);
//   - the title chip in #mw-title-screen's corner (D-06);
//   - both chips' attributes and their static "nobody" first paint (D-07);
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

test("(1) band 2 order: counters, then .mw-hud-actions, then #mw-acct-chip, then .mw-hud-menu-wrap, then #mw-hud-menu-btn, all before </header>", () => {
  const band2 = sliceBetween(HTML, '<div class="mw-hud-band2">', "</header>");
  const order = [
    'class="mw-hud-counters"',
    'id="m-rations"',
    'class="mw-hud-actions"',
    'id="mw-acct-chip"',
    'class="mw-hud-menu-wrap"',
    'id="mw-hud-menu-btn"',
  ].map((marker) => {
    const idx = band2.indexOf(marker);
    assert.ok(idx !== -1, `band 2 must carry ${marker}`);
    return idx;
  });
  for (let i = 1; i < order.length; i++) assert.ok(order[i - 1] < order[i], `band-2 marker ${i} out of order`);
  assert.equal((HTML.match(/class="mw-hud-actions"/g) || []).length, 1, "exactly one .mw-hud-actions group");
  // The chip's own markup (from the group's opening tag to the menu wrap)
  // must carry no mw-hud-menu token.
  const chipSlice = band2.slice(band2.indexOf('class="mw-hud-actions"'), band2.indexOf('class="mw-hud-menu-wrap"'));
  assert.doesNotMatch(chipSlice, /mw-hud-menu/, "the chip markup and its comment carry no mw-hud-menu token");
});

test("(2) both chips carry the button type, the aria contract and the static nobody face; each id exists exactly once", () => {
  assert.equal((HTML.match(/id="mw-acct-chip"/g) || []).length, 1);
  assert.equal((HTML.match(/id="mw-title-acct-chip"/g) || []).length, 1);
  assert.ok(
    HTML.includes(`<button type="button" class="mw-acct-chip" id="mw-acct-chip" aria-haspopup="dialog" aria-controls="mw-acct-sheet" aria-label="Play Games account">${CHIP_FACE}</button>`),
    "band-2 chip markup",
  );
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

test("(6) both chips and the sheet sit outside .mw-maze-viewport's hit path", () => {
  const viewport = sliceBetween(HTML, '<div class="mw-maze-viewport" id="mw-maze-viewport">', "<!-- DR5: the encounter/feature-event panel");
  for (const id of ["mw-acct-chip", "mw-title-acct-chip", "mw-acct-sheet", "mw-acct-scrim", "mw-acct-rows", "mw-acct-close"]) {
    assert.doesNotMatch(viewport, new RegExp(`id="${id}"`), `#${id} must not appear inside the viewport`);
  }
});
