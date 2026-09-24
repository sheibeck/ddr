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
// Phase 47 (SHELL-01), Plan 03, Task 2: renderCarriedList (and the GEAR
// tab's carried/on-you rendering) moved into src/browser/gearTab.js.
const GEAR_SRC = stripComments(fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "gearTab.js"), "utf8").replace(/\r\n/g, "\n"));
// Phase 47 (SHELL-03), Plan 05, Task 2: the whole S.store branch moved into
// src/browser/storeScreen.js.
const STORE_SRC = stripComments(fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "storeScreen.js"), "utf8").replace(/\r\n/g, "\n"));

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start === -1 ? 0 : start);
  assert.ok(start !== -1, `start marker not found: ${startMarker}`);
  assert.ok(end !== -1 && end > start, `end marker not found after start: ${endMarker}`);
  return source.slice(start, end);
}

function renderCarriedListRegion() {
  return sliceBetween(GEAR_SRC, "export function renderCarriedList(", "export function renderGearTab(");
}

// Phase 47 (SHELL-03), Plan 05: the store's whole render body is
// storeScreen.js#renderStoreScreen — no region-slicing needed, STORE_SRC IS
// the region.
function storeRegion() {
  return STORE_SRC;
}

function chipsMarkup() {
  // Phase 57 (LAYOUT-04/05), Plan 05 re-pin (USER MOCK RULING 2026-09-22):
  // the chip band is retired outright — the four controls now live as rows
  // inside the ☰ HUD menu on band 2, sliced from the menu wrap through
  // the header's own close.
  return sliceBetween(HTML, '<div class="mw-hud-menu-wrap">', "</header>");
}

// ─── UIF-01: the GEAR action row + inline two-tap Drop confirm ───────────

test("UIF-01: DROP_CONFIRM_MS is declared once, directly above renderCarriedList (src/browser/gearTab.js)", () => {
  assert.equal((CODE.match(/const DROP_CONFIRM_MS = 3000;/g) || []).length, 0);
  assert.equal((GEAR_SRC.match(/const DROP_CONFIRM_MS = 3000;/g) || []).length, 1);
  const idx = GEAR_SRC.indexOf("const DROP_CONFIRM_MS = 3000;");
  const fnIdx = GEAR_SRC.indexOf("export function renderCarriedList(");
  assert.ok(idx !== -1 && fnIdx !== -1 && idx < fnIdx, "DROP_CONFIRM_MS is declared above renderCarriedList");
  assert.equal((GEAR_SRC.match(/function revertDropConfirm\(\)/g) || []).length, 1);
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
  // Phase 47 (SHELL-01), Plan 03: document. -> doc. (container.ownerDocument).
  assert.equal((region.match(/doc\.addEventListener\("pointerdown", onAnyTap, true\)/g) || []).length, 1);
  assert.equal((region.match(/doc\.removeEventListener\("pointerdown", onAnyTap, true\)/g) || []).length, 1);
  assert.match(region, /wrap\.isConnected/);
  assert.ok((region.match(/opts\.gearRow/g) || []).length >= 2, "opts.gearRow checked at least twice (drop branch + wrap block)");
});

test("UIF-01: non-gear Drop and the Phase 32 guard ternary are untouched inside the region", () => {
  const region = renderCarriedListRegion();
  // Phase 47 (SHELL-01), Plan 03: window.mzDropItem?./guardTap -> deps.dropItem?./deps.guardTap.
  assert.match(region, /li\.appendChild\(mkBtn\("Drop", \(\) => deps\.dropItem\?\.\(i\)\)\)/);
  assert.match(region, /opts\.guard \? deps\.guardTap\(bt, onClick\) : \(bt\.onclick = onClick\)/);
});

test("UIF-01: Yes dispatches through the existing dropItem dep (no new engine action)", () => {
  const region = renderCarriedListRegion();
  assert.ok((region.match(/deps\.dropItem\?\.\(i\)/g) || []).length >= 2, "gear Yes + the non-gear Drop button both call deps.dropItem");
});

// Phase 63 (GSCR-07/08/10), Plan 05: the GEAR tab's per-card harvest through
// renderCarriedList (the only gearRow:true call site) is retired — every
// WORN row and BAG card opens the bottom action sheet instead, so
// gearRow:true no longer appears anywhere in the shipped source.
test("UIF-01: gearRow:true is retired (Phase 63) — it appears zero times anywhere, including renderGearTab's own region", () => {
  assert.equal((CODE.match(/gearRow: true/g) || []).length, 0);
  assert.equal((GEAR_SRC.match(/gearRow: true/g) || []).length, 0);
  const store = storeRegion();
  assert.doesNotMatch(store, /gearRow/);
});

test("Phase 34: guard:true occurs exactly once (Phase 34 folded the combat use-list into the ITEMS submenu)", () => {
  assert.equal((CODE.match(/guard: true/g) || []).length, 1);
});

test("UIF-01: the Use-button pin (every activatable item) is untouched", () => {
  // 260918-w4n (use-activated-only): the gate moved from a raw `it.use`
  // string to the ONE row-state rule (st.kind !== "none"). Phase 47
  // (SHELL-01), Plan 03: this now lives in src/browser/gearTab.js.
  assert.equal((CODE.match(/st\.kind !== "none"\) li\.appendChild\(mkBtn\("Use"/g) || []).length, 0);
  assert.equal((GEAR_SRC.match(/st\.kind !== "none"\) li\.appendChild\(mkBtn\("Use"/g) || []).length, 1);
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

test("the ☰ menu holds MARKS, CENTRE MAP, MAKE CAMP, then SETTINGS, in that order (2026-09-16 UAT chip order, carried into the Phase 57 Plan 05 menu)", () => {
  const markup = chipsMarkup();
  const marksIdx = markup.indexOf('id="mw-chip-marks"');
  const centreIdx = markup.indexOf('id="mw-chip-centre"');
  const campIdx = markup.indexOf('id="btn-camp"');
  const gearIdx = markup.indexOf('id="mw-gear-btn"');
  assert.ok(marksIdx !== -1 && centreIdx !== -1 && campIdx !== -1 && gearIdx !== -1, "all four rows found in the menu");
  assert.ok(marksIdx < centreIdx && centreIdx < campIdx && campIdx < gearIdx, "Marks, then Centre Map, then Make Camp, then Settings");

  const campButtonMatch = markup.match(/<button[^>]*id="btn-camp"[^>]*>/);
  assert.ok(campButtonMatch, "camp button tag found in the menu");
  assert.match(campButtonMatch[0], /role="menuitem" class="mw-hud-menu-item"/);
});

test("UIF-05: no trace of the former handed-layout option remains in the shell", () => {
  assert.doesNotMatch(HTML, /handedness/i);
  assert.doesNotMatch(HTML, /data-setting="handedness"/);
  assert.doesNotMatch(RAW_HTML, /#app\[data-/);
});

test("UIF-05/Phase 57 (LAYOUT-04/05), Plan 05: the chip band is retired outright and the ☰ wrapper (.mw-hud-menu-wrap) is the only positioned HUD element", () => {
  assert.doesNotMatch(HTML, /\.mw-map-chips\{/, "the chip band rule is retired");
  assert.doesNotMatch(HTML, /\.mw-map-chips-gap\{/, "the chip gap rule is retired");
  const wrapRuleMatch = HTML.match(/^\.mw-hud-menu-wrap\{[^}]*\}/m);
  assert.ok(wrapRuleMatch, ".mw-hud-menu-wrap rule found");
  assert.match(wrapRuleMatch[0], /position:relative/);
  // Phase 70 D-08: the ☰ wrap sits above the encounter overlay (z 8) and
  // its own scrim (z 9), so the dropdown opens over combat and death.
  assert.match(wrapRuleMatch[0], /z-index:10/);
  // No other HUD-family rule (.mw-hud/.mw-hud-band2/.mw-hud-counters) may
  // declare a position — the menu wrap is the ONE positioned HUD element.
  for (const selector of [".mw-hud", ".mw-hud-band2", ".mw-hud-counters"]) {
    const escaped = selector.replace(/\./g, "\\.");
    const rule = HTML.match(new RegExp(`^${escaped}\\{[^}]*\\}`, "m"));
    assert.ok(rule, `${selector} rule found`);
    assert.doesNotMatch(rule[0], /position:/, `${selector} must declare no position`);
  }
  assert.doesNotMatch(HTML, /#btn-camp:hover/);
  assert.doesNotMatch(HTML, /#btn-camp:active/);
  assert.match(HTML, /#btn-camp\[data-short="1"\]\{/);
});

test("UIF-05: the camp button's onclick wiring and short-state read stay singular (untouched)", () => {
  assert.equal((CODE.match(/document\.getElementById\("btn-camp"\)\.onclick/g) || []).length, 1);
  assert.equal((CODE.match(/const campBtn = document\.getElementById\("btn-camp"\);/g) || []).length, 1);
});

test("UIF-05: settings.js has no trace of handedness and exposes exactly 8 fields, in order", async () => {
  const settingsPath = path.join(REPO_ROOT, "src", "browser", "settings.js");
  const settingsSrc = fs.readFileSync(settingsPath, "utf8");
  assert.doesNotMatch(settingsSrc, /handedness/i);

  const mod = await import(url.pathToFileURL(settingsPath).href);
  // Phase 59 (DRESS-05): `dressing` is the fifth field, appended last.
  assert.deepStrictEqual(Object.keys(mod.SETTINGS_DEFAULTS), [
    "sound",
    "haptics",
    "textSize",
    "confirmBeforeQuit",
    "dressing",
    // Phase 67 (PGS-02): Compete (D-01), the first-sign-in flag (D-04) and
    // the dev simulate-signed-in flag (D-12), appended in this order.
    "compete",
    "pgsWelcomed",
    "pgsDevSignedIn",
  ]);
});
