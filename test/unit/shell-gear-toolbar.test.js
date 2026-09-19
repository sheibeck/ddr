// test/unit/shell-gear-toolbar.test.js
//
// Phase 33 (UIF-01, UIF-05), Plan 02 — mazeworld.html has no module surface
// a test could import directly (it is not an ESM module the test runner can
// load), so — mirroring test/unit/shell-party-camp.test.js / shell-input-
// guards.test.js's own source-assertion pattern — this file reads the real
// shipped source with fs.readFileSync and asserts against it directly:
//   1. UIF-01: the GEAR row's action row (`.mw-gear-actions`) and the
//      inline two-tap Drop confirm (`.mw-drop-confirm`, DROP_CONFIRM_MS,
//      the outside-tap revert) exist exactly once each, `gearRow: true` is
//      passed at exactly the GEAR call site, every pre-existing pinned
//      literal (the non-gear Drop button, the Phase 32 guard ternary,
//      `guard: true`'s two call sites) is untouched, and no new engine
//      action was introduced (Drop still dispatches the existing
//      `dropItem`).
//   2. UIF-05: MAKE CAMP is the last chip of the Marks/Centre row, and every
//      trace of the former handed-layout option (markup, CSS, applySettings,
//      settings.js) is gone. Phase 35 Plan 04 retired the control bar
//      itself outright (test/unit/shell-map-viewport.test.js owns that pin
//      now) — this file dropped its own now-stale mazefoot assertions.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const RAW_HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
const HTML = RAW_HTML.replace(/\r\n/g, "\n");

// ─── comment stripping (same order-sensitive approach as
// shell-party-camp.test.js / shell-input-guards.test.js — line comments are
// stripped BEFORE block comments) ──────────────────────────────────────────
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

function renderCarriedListRegion() {
  return sliceBetween(CODE, "function renderCarriedList(", "function renderDropShelf(");
}

function paintCarryRegion() {
  return sliceBetween(CODE, 'const carry = document.getElementById("s-carry");', 'document.getElementById("doss-who")');
}

function storeRegion() {
  return sliceBetween(CODE, "if (S.store) {", 'document.getElementById("a-leave").onclick');
}

function chipsMarkup() {
  // Phase 35 (MAP-02/06): the chip row now ends at the viewport's closing
  // </div> — sliced through <section class="mw-overlay" (the next markup
  // landmark), which also covers the party-pulse ring; the control bar
  // (the former .mazefoot/D-pad markup) is retired outright by Plan 04 —
  // test/unit/shell-map-viewport.test.js owns its zero-occurrence pin now.
  return sliceBetween(HTML, '<div class="mw-map-chips"', '<section class="mw-overlay"');
}

// ─── UIF-01: the GEAR action row + inline two-tap Drop confirm ───────────

test("UIF-01: DROP_CONFIRM_MS is declared once, directly above renderCarriedList", () => {
  assert.equal((CODE.match(/const DROP_CONFIRM_MS = 3000;/g) || []).length, 1);
  const idx = CODE.indexOf("const DROP_CONFIRM_MS = 3000;");
  const fnIdx = CODE.indexOf("function renderCarriedList(");
  assert.ok(idx !== -1 && fnIdx !== -1 && idx < fnIdx, "DROP_CONFIRM_MS is declared above renderCarriedList");
  assert.equal((CODE.match(/function revertDropConfirm\(\)/g) || []).length, 1);
});

test("UIF-01: the setTimeout revert lives inside the renderCarriedList region, once", () => {
  const region = renderCarriedListRegion();
  assert.equal((region.match(/setTimeout\(revertDropConfirm, DROP_CONFIRM_MS\)/g) || []).length, 1);
});

test("UIF-01: the gear action row + drop-confirm building blocks are all present, once each", () => {
  const region = renderCarriedListRegion();
  assert.equal((region.match(/className = "mw-gear-actions"/g) || []).length, 1);
  assert.equal((region.match(/className = "mw-drop-confirm"/g) || []).length, 1);
  assert.match(region, /"Drop it\?"/);
  assert.match(region, /mkBtn\("Yes"/);
  assert.match(region, /mkBtn\("No"/);
  assert.equal((region.match(/document\.addEventListener\("pointerdown", onAnyTap, true\)/g) || []).length, 1);
  assert.equal((region.match(/document\.removeEventListener\("pointerdown", onAnyTap, true\)/g) || []).length, 1);
  assert.match(region, /wrap\.isConnected/);
  assert.ok((region.match(/opts\.gearRow/g) || []).length >= 2, "opts.gearRow checked at least twice (drop branch + wrap block)");
});

test("UIF-01: non-gear Drop and the Phase 32 guard ternary are untouched inside the region", () => {
  const region = renderCarriedListRegion();
  assert.match(region, /li\.appendChild\(mkBtn\("Drop", \(\) => window\.mzDropItem\?\.\(i\)\)\)/);
  assert.match(region, /opts\.guard \? guardTap\(bt, onClick\) : \(bt\.onclick = onClick\)/);
});

test("UIF-01: Yes dispatches through the existing mzDropItem bridge (no new engine action)", () => {
  const region = renderCarriedListRegion();
  assert.ok((region.match(/window\.mzDropItem\?\.\(i\)/g) || []).length >= 2, "gear Yes + the non-gear Drop button both call mzDropItem");
});

test("UIF-01: gearRow:true is passed at exactly the GEAR call site", () => {
  assert.equal((CODE.match(/gearRow: true/g) || []).length, 1);
  const carryRegion = paintCarryRegion();
  assert.match(carryRegion, /gearRow: true/);
  const store = storeRegion();
  assert.doesNotMatch(store, /gearRow/);
});

test("Phase 34: guard:true occurs exactly once (Phase 34 folded the combat use-list into the ITEMS submenu)", () => {
  assert.equal((CODE.match(/guard: true/g) || []).length, 1);
});

test("UIF-01: the Use-button pin (every activatable item) is untouched", () => {
  // 260918-w4n (use-activated-only): the gate moved from a raw `it.use`
  // string to the ONE row-state rule (st.kind !== "none").
  assert.equal((CODE.match(/st\.kind !== "none"\) li\.appendChild\(mkBtn\("Use"/g) || []).length, 1);
});

test("UIF-01: .mw-gear-actions carries display:flex, width:100% and touch-action:manipulation; no transition/animation token anywhere in the two new CSS rules", () => {
  const ruleMatch = HTML.match(/^\.mw-gear-actions\{[^}]*\}/m);
  assert.ok(ruleMatch, ".mw-gear-actions rule found");
  const gearActionsRule = ruleMatch[0];
  assert.match(gearActionsRule, /display:flex/);
  assert.match(gearActionsRule, /width:100%/);
  assert.match(gearActionsRule, /touch-action:manipulation/);

  const dropConfirmRules = HTML.match(/^\.mw-drop-confirm[^{]*\{[^}]*\}/gm) || [];
  assert.ok(dropConfirmRules.length >= 1, "at least one .mw-drop-confirm rule found");

  for (const rule of [gearActionsRule, ...dropConfirmRules]) {
    assert.doesNotMatch(rule, /transition/i);
    assert.doesNotMatch(rule, /animation/i);
  }
});

test("UIF-01: engine/actions.js still whitelists dropItem (no new engine action added)", () => {
  const actionsSrc = fs.readFileSync(path.join(REPO_ROOT, "engine", "actions.js"), "utf8");
  assert.match(actionsSrc, /"dropItem"/);
});

// ─── UIF-05: Make Camp joins the Marks/Centre row; handedness is gone ────

test("the chip row holds Marks, Centre, the camp chip, then the settings gear, in that order (2026-09-16 UAT)", () => {
  const markup = chipsMarkup();
  const marksIdx = markup.indexOf('id="mw-chip-marks"');
  const centreIdx = markup.indexOf('id="mw-chip-centre"');
  const campIdx = markup.indexOf('id="btn-camp"');
  const gearIdx = markup.indexOf('id="mw-gear-btn"');
  assert.ok(marksIdx !== -1 && centreIdx !== -1 && campIdx !== -1 && gearIdx !== -1, "all four chips found in the row");
  assert.ok(marksIdx < centreIdx && centreIdx < campIdx && campIdx < gearIdx, "Marks, then Centre, then the camp chip, then the settings gear");

  const campButtonMatch = markup.match(/<button[^>]*id="btn-camp"[^>]*>/);
  assert.ok(campButtonMatch, "camp button tag found in the chip row");
  assert.match(campButtonMatch[0], /class="mw-map-chip camp"/);
});

test("UIF-05: no trace of the former handed-layout option remains in the shell", () => {
  assert.doesNotMatch(HTML, /handedness/i);
  assert.doesNotMatch(HTML, /data-setting="handedness"/);
  assert.doesNotMatch(RAW_HTML, /#app\[data-/);
});

test("UIF-05/Phase 35 (MAP-06): the chip row spans the viewport width and pins the camp chip to the far right via the gap span", () => {
  const chipsRuleMatch = HTML.match(/^\.mw-map-chips\{[^}]*\}/m);
  assert.ok(chipsRuleMatch, ".mw-map-chips rule found");
  assert.match(chipsRuleMatch[0], /left:10px/);
  assert.match(chipsRuleMatch[0], /right:10px/);
  assert.match(HTML, /^\.mw-map-chips-gap\{flex:1\}$/m);
  assert.doesNotMatch(HTML, /#btn-camp:hover/);
  assert.doesNotMatch(HTML, /#btn-camp:active/);
  assert.match(HTML, /#btn-camp\[data-short="1"\]\{/);
});

test("UIF-05: the camp button's onclick wiring and short-state read stay singular (untouched)", () => {
  assert.equal((CODE.match(/document\.getElementById\("btn-camp"\)\.onclick/g) || []).length, 1);
  assert.equal((CODE.match(/const campBtn = document\.getElementById\("btn-camp"\);/g) || []).length, 1);
});

test("UIF-05: settings.js has no trace of handedness and exposes exactly 4 fields, in order", async () => {
  const settingsPath = path.join(REPO_ROOT, "src", "browser", "settings.js");
  const settingsSrc = fs.readFileSync(settingsPath, "utf8");
  assert.doesNotMatch(settingsSrc, /handedness/i);

  const mod = await import(url.pathToFileURL(settingsPath).href);
  assert.deepStrictEqual(Object.keys(mod.SETTINGS_DEFAULTS), [
    "sound",
    "haptics",
    "textSize",
    "confirmBeforeQuit",
  ]);
});
