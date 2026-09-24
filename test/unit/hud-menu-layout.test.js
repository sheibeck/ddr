// test/unit/hud-menu-layout.test.js
//
// Phase 57 (LAYOUT-04/05), Plan 05 — the structural and behavioural proof
// for the 2026-09-22 mock: the map chip strip is retired, its four controls
// live in a ☰ dropdown on band 2, the outside tap that closes it is
// structurally consumed (never reaching tapStep()), the menu can never be
// open over an encounter, opening/closing never moves the viewport, no
// motion was added, and band 2 still fits a 411px Pixel 7 at text size M.
//
// mazeworld.html has no ESM module surface a test could import directly —
// mirrors rail-overlay.test.js's own house style (stripHtml from
// tools/ident-sweep.mjs for every count-shaped check) for the structural
// tests, and shell-tab-snapshots.test.js's shellSandbox/recordingDom
// pattern (real classic script under node:vm, real bridges, onclick
// invocation) for the BEHAVIOUR tests.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { stripHtml } from "../../tools/ident-sweep.mjs";
import { HUD_MENU_ITEMS, HUD_MENU_GLYPH, HUD_MENU_QUIT_COPY } from "../../src/browser/hudMenu.js";
import { textScaleForSize } from "../../src/browser/settings.js";
import { ACCOUNT_COPY } from "../../content/account.js";
import { COUNTER_SLOT_CH, identityParts, identityLine } from "../../src/browser/hudBands.js";
import { createRecordingDocument } from "./harness/recordingDom.js";
import { loadShellSandbox, fixedStates } from "./harness/shellSandbox.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const RAW_HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
const HTML = RAW_HTML.replace(/\r\n/g, "\n");
const CODE = stripHtml(HTML);

function sliceBetween(source, startMarker, endMarker, fromIndex = 0) {
  const start = source.indexOf(startMarker, fromIndex);
  const end = source.indexOf(endMarker, start === -1 ? 0 : start);
  assert.ok(start !== -1, `start marker not found: ${startMarker}`);
  assert.ok(end !== -1 && end > start, `end marker not found after start: ${endMarker}`);
  return source.slice(start, end);
}

function ruleFor(selectorSource) {
  const re = new RegExp(`^${selectorSource}\\{([^}]*)\\}`, "m");
  const m = HTML.match(re);
  assert.ok(m, `expected to find a rule for /^${selectorSource}\\{/m`);
  return m[1];
}

function fnRegion(sig) {
  const start = CODE.indexOf(sig);
  assert.ok(start !== -1, `signature not found: ${sig}`);
  const end = CODE.indexOf("\nfunction ", start + sig.length);
  assert.ok(end !== -1 && end > start, `no following function boundary after: ${sig}`);
  return CODE.slice(start, end);
}

// ─── (1) the chip strip is retired ──────────────────────────────────────

test("(1) the chip strip is retired: the stripped shell carries no chip-band token, and #screen-maze opens onto .mazebox", () => {
  assert.doesNotMatch(CODE, /mw-map-chip/, "no mw-map-chip token anywhere in the stripped shell");
  const screenMazeIdx = HTML.indexOf('<section class="mw-screen" id="screen-maze"');
  const mazeboxIdx = HTML.indexOf('<div class="mazebox">');
  assert.ok(screenMazeIdx !== -1 && mazeboxIdx !== -1 && mazeboxIdx > screenMazeIdx);
  const stripped = HTML.slice(screenMazeIdx, mazeboxIdx).replace(/<!--[\s\S]*?-->/g, "").trim();
  assert.equal(stripped, '<section class="mw-screen" id="screen-maze" data-screen="maze">');
});

// ─── (2) the ☰ sits on band 2, outside the counters' clipping box ──────

test("(2) the ☰ sits on band 2, outside .mw-hud-counters' clipping box: the band-2 slice is counters, then the menu wrap, then the ☰ button, and the counters-only sub-slice carries all four ids and no mw-hud-menu token", () => {
  const band2Slice = sliceBetween(HTML, '<div class="mw-hud-band2">', "</header>");
  const countersIdx = band2Slice.indexOf('class="mw-hud-counters"');
  const wrapIdx = band2Slice.indexOf('class="mw-hud-menu-wrap"');
  const btnIdx = band2Slice.indexOf('id="mw-hud-menu-btn"');
  assert.ok(countersIdx !== -1 && wrapIdx !== -1 && btnIdx !== -1);
  assert.ok(countersIdx < wrapIdx && wrapIdx < btnIdx, "counters, then the menu wrap, then the ☰ button");
  const countersOnly = band2Slice.slice(countersIdx, wrapIdx);
  for (const id of ["m-floor", "m-day", "m-steps", "m-rations"]) {
    assert.match(countersOnly, new RegExp(`id="${id}"`), `#${id} must sit inside the counters-only slice`);
  }
  assert.doesNotMatch(countersOnly, /mw-hud-menu/, "the counters slice must carry no mw-hud-menu token");
  // Phase 70 (POLISH-02, D-03, superseding Phase 67 D-05): the band-2
  // account chip and its actions wrapper are retired. The ☰ wrap directly
  // follows the counters again (the Phase 57 shape): between the counters'
  // closing tag and the wrap there is only whitespace and comments.
  const stripped = band2Slice.replace(/<!--[\s\S]*?-->/g, "");
  assert.match(stripped, /<\/div>\s*<div class="mw-hud-menu-wrap">/, "the menu wrap directly follows the counters' closing tag");
  const countersBlock = stripped.slice(stripped.indexOf('class="mw-hud-counters"'), stripped.indexOf('class="mw-hud-menu-wrap"'));
  assert.equal((countersBlock.match(/<div\b/g) || []).length, (countersBlock.match(/<\/div>/g) || []).length, "no extra wrapper opens between the counters and the ☰ wrap");
  for (const token of ["mw-acct-chip", "mw-hud-actions", "mw-acct-face"]) {
    assert.doesNotMatch(stripped, new RegExp(token), `band 2 carries no ${token} token`);
  }
});

// ─── (3) the four menu rows match HUD_MENU_ITEMS in order ───────────────

test("(3) the four menu rows match HUD_MENU_ITEMS in order: id, label and glyph (decoded from the numeric character reference), and the [data-glyph] rule's colour/size", () => {
  const menuSlice = sliceBetween(HTML, '<div class="mw-hud-menu" id="mw-hud-menu"', "</header>");
  const rowRe = /<button type="button" role="menuitem" class="mw-hud-menu-item" id="([^"]+)"><span class="mw-hud-menu-glyph" data-glyph="([^"]+)" aria-hidden="true">&#(\d+);<\/span><span class="mw-hud-menu-label">([^<]+)<\/span><\/button>/g;
  const rows = [...menuSlice.matchAll(rowRe)].map((m) => ({ id: m[1], key: m[2], glyph: String.fromCodePoint(Number(m[3])), label: m[4] }));
  assert.equal(rows.length, 4, "expected exactly four menu rows");
  assert.deepStrictEqual(
    rows.map((r) => ({ id: r.id, key: r.key, glyph: r.glyph, label: r.label })),
    HUD_MENU_ITEMS.map((r) => ({ id: r.id, key: r.key, glyph: r.glyph, label: r.label })),
  );
  for (const item of HUD_MENU_ITEMS) {
    const glyphRule = ruleFor(`\\.mw-hud-menu-glyph\\[data-glyph="${item.key}"\\]`);
    assert.match(glyphRule, new RegExp(`color:${item.color}`), `[data-glyph="${item.key}"] colour must equal HUD_MENU_ITEMS' ${item.color}`);
    assert.match(glyphRule, new RegExp(`font-size:${item.size}px`), `[data-glyph="${item.key}"] size must equal HUD_MENU_ITEMS' ${item.size}px`);
  }
});

// ─── (4) the menu/☰/scrim are outside the viewport's hit path ──────────

test("(4) the menu, the ☰ and the scrim are outside .mw-maze-viewport's hit path: none of their ids/row ids appear in the viewport slice; all precede <main class=\"mw-screens\">; the gesture tracker still binds pointerdown to its viewport local alone", () => {
  const viewportRegion = sliceBetween(HTML, '<div class="mw-maze-viewport" id="mw-maze-viewport">', "<!-- DR5: the encounter/feature-event panel");
  // Phase 70 (D-04): the ACCOUNT host inside the dropdown joins both id lists.
  for (const id of ["mw-hud-menu-btn", "mw-hud-menu", "mw-hud-menu-scrim", "mw-chip-marks", "mw-chip-centre", "btn-camp", "mw-gear-btn", "mw-hud-menu-acct"]) {
    assert.doesNotMatch(viewportRegion, new RegExp(`id="${id}"`), `#${id} must not appear inside the viewport`);
  }
  const mainIdx = HTML.indexOf('<main class="mw-screens"');
  for (const id of ["mw-hud-menu-btn", "mw-hud-menu", "mw-hud-menu-scrim", "mw-hud-menu-acct"]) {
    const idx = HTML.indexOf(`id="${id}"`);
    assert.ok(idx !== -1 && idx < mainIdx, `#${id} must precede <main class="mw-screens">`);
  }
  const region = sliceBetween(CODE, "(function initMazeViewportControls() {", "\n})();");
  const getByIdCalls = (region.match(/getElementById\("mw-maze-viewport"\)/g) || []).length;
  assert.equal(getByIdCalls, 1, 'expected exactly one getElementById("mw-maze-viewport") call inside initMazeViewportControls');
  assert.match(region, /vp\.addEventListener\("pointerdown"/, "the pointerdown listener is attached to vp, the viewport local");
});

// ─── (5) the z-ladder ────────────────────────────────────────────────────

test("(5) the z-ladder (Phase 70 D-08): rail (4) < overlay (8) < scrim < menu wrap < .mw-legend-sheet (45) < .mw-title-screen (50), so the dropdown and its scrim sit above the encounter overlay and the death panel; .mw-hud, .mw-hud-band2 and .mw-stage declare no z-index and no transform (Phase 70 D-03: the band-2 actions wrapper is retired, so it is no longer listed)", () => {
  const zOf = (rule, name) => {
    const m = rule.match(/z-index:(\d+)/);
    assert.ok(m, `${name} must declare a z-index`);
    return Number(m[1]);
  };
  const rail = zOf(ruleFor("\\.mw-rail"), ".mw-rail");
  const overlay = zOf(ruleFor("\\.mw-overlay"), ".mw-overlay");
  const scrim = zOf(ruleFor("\\.mw-hud-menu-scrim"), ".mw-hud-menu-scrim");
  const wrap = zOf(ruleFor("\\.mw-hud-menu-wrap"), ".mw-hud-menu-wrap");
  const legend = zOf(ruleFor("\\.mw-legend-sheet"), ".mw-legend-sheet");
  const title = zOf(ruleFor("\\.mw-title-screen"), ".mw-title-screen");
  assert.equal(rail, 4);
  assert.equal(overlay, 8);
  assert.equal(legend, 45);
  assert.equal(title, 50);
  assert.ok(
    rail < overlay && overlay < scrim && scrim < wrap && wrap < legend && legend < title,
    `expected rail(${rail}) < overlay(${overlay}) < scrim(${scrim}) < wrap(${wrap}) < legend(${legend}) < title(${title})`,
  );
  for (const [selector, rule] of [
    [".mw-hud", ruleFor("\\.mw-hud")],
    [".mw-hud-band2", ruleFor("\\.mw-hud-band2")],
    [".mw-stage", ruleFor("\\.mw-stage")],
  ]) {
    assert.doesNotMatch(rule, /z-index/, `${selector} must declare no z-index`);
    assert.doesNotMatch(rule, /transform/, `${selector} must declare no transform`);
  }
});

// ─── (6) opening/closing cannot move the viewport ────────────────────────

test("(6) opening/closing cannot move the viewport: the open-state rules declare only visibility/opacity/transform/pointer-events/background/color/transition; the dropdown is absolutely positioned, the scrim is fixed; the menu functions call no camera/positioning function and stamp no lastDismissAt", () => {
  // Phase 58 (MOTION-02) whitelists exactly one more property: `transition`
  // — pure timing metadata, never itself a layout-affecting declaration
  // (it names which properties animate and how fast, not a new value for
  // any of them), so it cannot move the viewport either.
  const ALLOWED = new Set(["visibility", "opacity", "transform", "pointer-events", "background", "color", "transition"]);
  const openMenuRule = ruleFor('\\.mw-hud-menu\\[data-open="1"\\]');
  const openScrimRule = ruleFor('\\.mw-hud-menu-scrim\\[data-open="1"\\]');
  const openFaceRule = ruleFor('\\.mw-hud-menu-btn\\[aria-expanded="true"\\] \\.mw-hud-menu-face');
  for (const [name, rule] of [
    ["open menu", openMenuRule],
    ["open scrim", openScrimRule],
    ["open face", openFaceRule],
  ]) {
    const props = [...rule.matchAll(/([a-z-]+):/g)].map((m) => m[1]);
    assert.ok(props.length > 0, `${name} rule must declare at least one property`);
    for (const p of props) assert.ok(ALLOWED.has(p), `${name} rule declares a disallowed property: ${p}`);
  }
  const menuRule = ruleFor("\\.mw-hud-menu(?!-)");
  assert.match(menuRule, /position:absolute/);
  const scrimRule = ruleFor("\\.mw-hud-menu-scrim(?!-)");
  assert.match(scrimRule, /position:fixed/);

  const forbidden = /fit\(|KeepPartyInView|CenterMap|centerMap\(|positionCanvas|tapStep|lastDismissAt/;
  for (const sig of ["function hudMenuEvent(", "function setHudMenuOpen(", "function hudMenuIsOpen("]) {
    const region = fnRegion(sig);
    assert.doesNotMatch(region, forbidden, `${sig} must call no camera/positioning function and stamp no lastDismissAt`);
  }
});

// ─── (7) motion (Phase 58, MOTION-02) ──────────────────────────────────────

test("(7) motion (Phase 58, MOTION-02): the resting/open menu rules carry the exact close/open transitions pinned to motion.js's constants; every menu rule still declares no animation, and @keyframes mwrise still occurs exactly once (the pre-existing sheet keyframe — the menu transitions between two declared states, never through a keyframe of its own)", () => {
  const restingRule = ruleFor("\\.mw-hud-menu(?!-)");
  assert.match(restingRule, /transition:opacity \.12s ease-in,transform \.12s ease-in,visibility 0s \.12s/);
  const openRule = ruleFor('\\.mw-hud-menu\\[data-open="1"\\]');
  assert.match(openRule, /transition:opacity \.16s ease-out,transform \.16s ease-out,visibility 0s/);

  for (const selector of [
    "\\.mw-hud-menu(?!-)",
    '\\.mw-hud-menu\\[data-open="1"\\]',
    "\\.mw-hud-menu-scrim(?!-)",
    '\\.mw-hud-menu-scrim\\[data-open="1"\\]',
    "\\.mw-hud-menu-btn(?!-)",
    "\\.mw-hud-menu-face",
    "\\.mw-hud-menu-item",
  ]) {
    const rule = ruleFor(selector);
    assert.doesNotMatch(rule, /animation/i, `${selector} must declare no animation`);
  }
  assert.equal((CODE.match(/@keyframes mwrise/g) || []).length, 1, "comment-stripped: exactly the pre-existing sheet keyframe, no new one added for the menu");
});

// ─── BEHAVIOUR harness ────────────────────────────────────────────────────

function freshSandbox(state) {
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc });
  sandbox.setState(state);
  sandbox.paint();
  return { doc, sandbox };
}

function menuBtn(doc) {
  return doc.elementsById.get("mw-hud-menu-btn");
}
function menuEl(doc) {
  return doc.elementsById.get("mw-hud-menu");
}
function scrimEl(doc) {
  return doc.elementsById.get("mw-hud-menu-scrim");
}
function isOpen(doc) {
  return menuEl(doc).dataset.open === "1" && scrimEl(doc).dataset.open === "1" && menuBtn(doc).getAttribute("aria-expanded") === "true";
}
function isClosed(doc) {
  return menuEl(doc).dataset.open !== "1" && scrimEl(doc).dataset.open !== "1" && menuBtn(doc).getAttribute("aria-expanded") !== "true";
}

const states = fixedStates();

// ─── (8) BEHAVIOUR: the outside tap is consumed ──────────────────────────

test("(8) BEHAVIOUR: the ☰ onclick opens the menu, and with the menu open, the scrim's onclick closes it while a counting window.move stub records zero calls", () => {
  const { doc, sandbox } = freshSandbox(states.thief);
  menuBtn(doc).onclick();
  assert.ok(isOpen(doc), "the ☰ onclick must open the menu");

  let moveCalls = 0;
  sandbox.context.window.move = () => {
    moveCalls++;
  };
  scrimEl(doc).onclick();
  assert.ok(isClosed(doc), "the scrim's onclick must close the menu");
  assert.equal(moveCalls, 0, "the outside tap must dispatch zero moves (T-57-15)");
});

// ─── (9) BEHAVIOUR: every close trigger closes ───────────────────────────

test("(9) BEHAVIOUR: every close trigger closes the menu (re-tap, select, a tab switch, an encounter, Escape), plus the stripped-source ordering pins each of those wires to", () => {
  // re-tap (toggle)
  {
    const { doc } = freshSandbox(states.thief);
    menuBtn(doc).onclick();
    assert.ok(isOpen(doc));
    menuBtn(doc).onclick();
    assert.ok(isClosed(doc), "a second ☰ tap must close the menu");
  }
  // select (the dropdown container's own bubble onclick)
  {
    const { doc } = freshSandbox(states.thief);
    menuBtn(doc).onclick();
    assert.ok(isOpen(doc));
    menuEl(doc).onclick();
    assert.ok(isClosed(doc), "selecting a row must close the menu (the container's bubble onclick)");
  }
  // a tab switch
  {
    const { doc, sandbox } = freshSandbox(states.thief);
    menuBtn(doc).onclick();
    assert.ok(isOpen(doc));
    sandbox.context.window.__mzShowTab("hero");
    assert.ok(isClosed(doc), "a tab switch must close the menu");
  }
  // an encounter starting
  {
    const { doc, sandbox } = freshSandbox(states.thief);
    menuBtn(doc).onclick();
    assert.ok(isOpen(doc));
    sandbox.context.hudMenuEvent("encounter");
    assert.ok(isClosed(doc), "an encounter starting must close the menu");
  }
  // Escape / the back button
  {
    const { doc, sandbox } = freshSandbox(states.thief);
    menuBtn(doc).onclick();
    assert.ok(isOpen(doc));
    sandbox.context.hudMenuEvent("escape");
    assert.ok(isClosed(doc), "Escape/the back button must close the menu");
  }
  // stripped-source pins: renderEncounter calls hudMenuEvent("encounter")
  // only on the rising edge (an encounter STARTING, Phase 70 R-D) and
  // re-syncs an open menu's rows; the keydown escape branch precedes the
  // listener's hasActiveEncounter() branch; showTab calls
  // hudMenuEvent("tab") before its keep-in-view call.
  const encRegion = fnRegion("function renderEncounter() {");
  assert.match(encRegion, /if \(active && !encWasActive\) hudMenuEvent\("encounter"\);/);
  assert.doesNotMatch(encRegion, /if \(active\) hudMenuEvent\("encounter"\);/);
  assert.match(encRegion, /if \(hudMenuIsOpen\(\)\) syncHudMenuRows\(\);/);
  const keydownRegion = sliceBetween(CODE, 'addEventListener("keydown"', 'addEventListener("resize"');
  const escapeIdx = keydownRegion.indexOf('hudMenuEvent("escape")');
  const hasActiveIdx = keydownRegion.indexOf("hasActiveEncounter()");
  assert.ok(escapeIdx !== -1 && hasActiveIdx !== -1 && escapeIdx < hasActiveIdx, "the Escape branch must precede the listener's hasActiveEncounter() branch");
  const showTabRegion = sliceBetween(CODE, "function showTab(name) {", "for (const btn of tabs) btn.addEventListener");
  const tabEventIdx = showTabRegion.indexOf('hudMenuEvent("tab")');
  const keepInViewIdx = showTabRegion.indexOf("window.mzKeepPartyInView?.()");
  assert.ok(tabEventIdx !== -1 && keepInViewIdx !== -1 && tabEventIdx < keepInViewIdx, 'hudMenuEvent("tab") must run before the keep-in-view call');
});

// ─── (10) BEHAVIOUR: opens during an encounter, rows disabled by context ──

const ROW_IDS = ["mw-chip-marks", "mw-chip-centre", "btn-camp", "mw-gear-btn", "mw-menu-save-quit", "mw-menu-abandon"];

function rowEl(doc, id) {
  return doc.elementsById.get(id) || doc.document.getElementById(id);
}
function isRowDisabled(doc, id) {
  const el = rowEl(doc, id);
  return el.disabled === true && el.getAttribute("aria-disabled") === "true";
}
function isRowEnabled(doc, id) {
  const el = rowEl(doc, id);
  return el.disabled !== true && el.getAttribute("aria-disabled") === null;
}
function assertRows(doc, disabledIds, label) {
  for (const id of ROW_IDS) {
    if (disabledIds.includes(id)) assert.ok(isRowDisabled(doc, id), `${label}: ${id} must carry disabled + aria-disabled="true"`);
    else assert.ok(isRowEnabled(doc, id), `${label}: ${id} must carry neither disabled nor aria-disabled`);
  }
}

test("(10) BEHAVIOUR (Phase 70 D-08): while window.__mzStair is truthy (hasActiveEncounter() true), the ☰ onclick OPENS the menu; MAKE CAMP and CENTRE MAP carry disabled + aria-disabled=\"true\", the other four rows carry neither, and the ACCOUNT block gets no row-sync writes", () => {
  const { doc, sandbox } = freshSandbox(states.thief);
  sandbox.context.window.__mzStair = { dir: "N" };
  menuBtn(doc).onclick();
  assert.ok(isOpen(doc), "the menu must open over an encounter (D-08)");
  assertRows(doc, ["btn-camp", "mw-chip-centre"], "stair prompt");
  const acct = rowEl(doc, "mw-hud-menu-acct");
  assert.notEqual(acct.disabled, true, "the ACCOUNT host is never disabled by the row sync");
  assert.equal(acct.getAttribute("aria-disabled"), null, "the ACCOUNT host never carries aria-disabled from the row sync");
  const walk = (el) => {
    for (const child of el.children || []) {
      assert.notEqual(child.disabled, true, "an ACCOUNT child is never disabled by the row sync");
      assert.equal(child.getAttribute?.("aria-disabled") ?? null, null, "an ACCOUNT child never carries aria-disabled from the row sync");
      walk(child);
    }
  };
  walk(acct);
  const syncRegion = fnRegion("function syncHudMenuRows(");
  assert.doesNotMatch(syncRegion, /mw-hud-menu-acct/, "syncHudMenuRows never names the ACCOUNT block");
});

// ─── (11) BEHAVIOUR: fail closed without the bridge ──────────────────────

test("(11) BEHAVIOUR: with __mzHudMenu deleted from the sandbox window, the ☰ onclick leaves the menu closed and nothing throws", () => {
  const { doc, sandbox } = freshSandbox(states.thief);
  delete sandbox.context.window.__mzHudMenu;
  assert.doesNotThrow(() => menuBtn(doc).onclick());
  assert.ok(isClosed(doc), "a missing bridge must fail closed");
});

// ─── (12) accessibility ───────────────────────────────────────────────────

test("(12) accessibility: the ☰ carries aria-haspopup=menu/aria-controls/aria-label; the dropdown is role=menu; every row (the four legacy rows plus Phase 70's SAVE & QUIT and ABANDON) is role=menuitem; aria-expanded mirrors data-open across open and close", () => {
  assert.match(HTML, /id="mw-hud-menu-btn" aria-haspopup="menu" aria-controls="mw-hud-menu" aria-expanded="false" aria-label="Menu"/);
  assert.match(HTML, /<div class="mw-hud-menu" id="mw-hud-menu" role="menu" aria-label="Map menu" data-open="0">/);
  const menuSlice = sliceBetween(HTML, '<div class="mw-hud-menu" id="mw-hud-menu"', "</header>");
  assert.equal((menuSlice.match(/role="menuitem"/g) || []).length, 6, "all six rows must be role=menuitem");

  const { doc } = freshSandbox(states.thief);
  menuBtn(doc).onclick();
  assert.equal(menuBtn(doc).getAttribute("aria-expanded"), "true");
  assert.equal(menuEl(doc).dataset.open, "1");
  menuBtn(doc).onclick();
  assert.equal(menuBtn(doc).getAttribute("aria-expanded"), "false");
  assert.equal(menuEl(doc).dataset.open, "0");
});

// ─── (13) BEHAVIOUR: the HUD is off-tab on Dead ──────────────────────────

test("(13) BEHAVIOUR + structural (Phase 70 D-08, ruling R-B): the HUD and condition strip stay on all five in-game tabs including DEAD (no data-offtab \"1\"); only the title-opened Leaderboards panel hides them through body[data-boards-entry=\"title\"]; no [data-offtab rule remains; the in-game #screen-dead sits flush (padding-top 0) and the title-mode panel keeps the safe-area top padding", () => {
  const { doc, sandbox } = freshSandbox(states.thief);
  for (const tab of ["dead", "maze", "hero", "gear", "oracle", "dead"]) {
    sandbox.context.window.__mzShowTab(tab);
    assert.notEqual(doc.elementsById.get("mw-hud")?.dataset?.offtab, "1", `#mw-hud must not go off-tab on ${tab}`);
    assert.notEqual(doc.elementsById.get("mm-conditions")?.dataset?.offtab, "1", `#mm-conditions must not go off-tab on ${tab}`);
  }
  const showTabRegion = sliceBetween(CODE, "function showTab(name) {", "for (const btn of tabs) btn.addEventListener");
  assert.doesNotMatch(showTabRegion, /offtab/, "showTab writes no data-offtab");

  assert.doesNotMatch(HTML, /\[data-offtab/, "no [data-offtab rule remains");
  assert.match(HTML, /^body\[data-boards-entry="title"\] #mw-hud\{display:none\}$/m);
  assert.match(HTML, /^body\[data-boards-entry="title"\] #mm-conditions\{display:none\}$/m);
  assert.match(HTML, /^#screen-dead\{padding-top:0\}$/m);
  assert.match(HTML, /^body\[data-boards-entry="title"\] #screen-dead\{padding-top:calc\(14px \+ var\(--safe-area-inset-top, env\(safe-area-inset-top, 0px\)\)\)\}$/m);
  assert.match(HTML, /^#screen-dead\{padding-left:0;padding-right:0;padding-bottom:0;height:100%\}$/m);
});

// ─── (21) BEHAVIOUR: the ☰ opens on the DEAD tab ─────────────────────────

test("(21) BEHAVIOUR (Phase 70 D-08, ruling R-B): on the in-game DEAD tab the ☰ onclick opens the menu", () => {
  const { doc, sandbox } = freshSandbox(states.thief);
  sandbox.context.window.__mzShowTab("dead");
  menuBtn(doc).onclick();
  assert.ok(isOpen(doc), "the ☰ opens on the DEAD tab");
});

// ─── (14) the width budget at text size M fits a 411px Pixel 7 ──────────

test("(14) the width budget at text sizes S/M/L (band-2 padding/gap, counters gap, item gap, the ☰'s width minus its negative inline-end margin, COUNTER_SLOT_CH's per-id slots): S 336.4 and M 377.8 fit a 411px Pixel 7, L is 446.8 (the pre-Phase-67 figure)", () => {
  const LABELS = ["DEPTH", "DAY", "SQUARES", "RATIONS"];
  const LABEL_ADVANCE_PX = 6.5; // Press Start 2P, 1em advance per glyph
  const NUMBER_ADVANCE_PX = 16 * 0.6; // Courier Prime Bold, 0.6em advance per digit

  const band2Rule = ruleFor("\\.mw-hud-band2");
  const paddingMatch = band2Rule.match(/padding:(\d+)px (\d+)px (\d+)px/);
  assert.ok(paddingMatch, "band-2 padding not found");
  const bandHPadding = Number(paddingMatch[2]) * 2; // left + right (the shorthand's 2nd value)
  const bandGapMatch = band2Rule.match(/gap:(\d+)px/);
  assert.ok(bandGapMatch, "band-2 gap not found");
  const bandGap = Number(bandGapMatch[1]);

  const countersRule = ruleFor("\\.mw-hud-counters");
  const countersGapMatch = countersRule.match(/gap:(\d+)px/);
  assert.ok(countersGapMatch, "counters gap not found");
  const countersGap = Number(countersGapMatch[1]);
  // Phase 70 (D-03): the band-2 account chip is retired, so the counters'
  // gap is back to its pre-Phase-67 8px and the budget has no chip term.
  assert.equal(countersGap, 8, "the counters' gap is back to 8px");

  const itemRule = ruleFor("\\.mw-hud-item");
  const itemGapMatch = itemRule.match(/gap:(\d+)px/);
  assert.ok(itemGapMatch, "item gap not found");
  const itemGap = Number(itemGapMatch[1]);
  const itemNumberRule = ruleFor("\\.mw-hud-item b");

  const btnRule = ruleFor("\\.mw-hud-menu-btn");
  const btnWidthMatch = btnRule.match(/width:(\d+)px/);
  const btnMarginMatch = btnRule.match(/margin:-?\d+px -(\d+)px/);
  assert.ok(btnWidthMatch && btnMarginMatch, "☰ button width/margin not found");
  const btnFootprint = Number(btnWidthMatch[1]) - Number(btnMarginMatch[1]);

  // Slot widths: from COUNTER_SLOT_CH (in ch == digits, at NUMBER_ADVANCE_PX
  // per digit) — the shell's own CSS min-width rules must equal these.
  // Squares (m-steps) keeps the generic 5ch slot on .mw-hud-item b (D-08);
  // the other three get a narrower, id-scoped rule (discovery D).
  const slotIds = ["m-floor", "m-day", "m-steps", "m-rations"];
  assert.match(itemNumberRule, /min-width:5ch/, ".mw-hud-item b must keep the 5ch slot for Squares");
  assert.equal(COUNTER_SLOT_CH["m-steps"], 5);
  for (const id of ["m-floor", "m-day", "m-rations"]) {
    const idRule = HTML.match(new RegExp(`^#${id}\\{min-width:(\\d+)ch\\}$`, "m"));
    assert.ok(idRule, `#${id} min-width rule not found`);
    assert.equal(Number(idRule[1]), COUNTER_SLOT_CH[id], `#${id}'s CSS min-width must equal COUNTER_SLOT_CH[${id}]`);
  }

  const labelsTotalPx = LABELS.reduce((sum, l) => sum + l.length * LABEL_ADVANCE_PX, 0);
  const numbersTotalPx = slotIds.reduce((sum, id) => sum + COUNTER_SLOT_CH[id] * NUMBER_ADVANCE_PX, 0);
  // Label-to-number gap (WITHIN each item, .mw-hud-item's own gap) × 4 items;
  // item-to-item gap (BETWEEN items, .mw-hud-counters' own gap) × 3 gaps.
  const labelNumberGaps = 4 * itemGap;
  const itemGaps = 3 * countersGap;

  function totalAt(scale) {
    return labelsTotalPx * scale + numbersTotalPx * scale + labelNumberGaps * scale + itemGaps + bandHPadding + bandGap + btnFootprint;
  }

  const totalS = totalAt(textScaleForSize("S"));
  const totalM = totalAt(textScaleForSize("M"));
  const totalL = totalAt(textScaleForSize("L"));
  assert.equal(totalS.toFixed(1), "336.4");
  assert.equal(totalM.toFixed(1), "377.8");
  assert.equal(totalL.toFixed(1), "446.8");
  assert.ok(totalS <= 411, `band 2's width budget at S (${totalS.toFixed(1)}px) must fit a 411px Pixel 7`);
  assert.ok(totalM <= 411, `band 2's width budget at M (${totalM.toFixed(1)}px) must fit a 411px Pixel 7`);
  // eslint-disable-next-line no-console
  console.log(`hud-menu-layout (14): band 2 computes to S ${totalS.toFixed(1)}px / M ${totalM.toFixed(1)}px of 411.`);
  // eslint-disable-next-line no-console
  console.log(`hud-menu-layout (14): band 2 at L computes to ${totalL.toFixed(1)}px — the pre-Phase-67 figure, logged and pinned (the device check).`);
});

// ─── (15) BEHAVIOUR: band 1 through the bridge ───────────────────────────

test("(15) BEHAVIOUR: paint() writes identityParts(c).name into #mw-hud-name, identityParts(c).line into #mw-hud-line, and identityLine(c) into #mw-hud-line's title", () => {
  const { doc } = freshSandbox(states.thief);
  const parts = identityParts(states.thief.c);
  assert.equal(doc.elementsById.get("mw-hud-name").textContent, parts.name);
  assert.equal(doc.elementsById.get("mw-hud-line").textContent, parts.line);
  assert.equal(doc.elementsById.get("mw-hud-line").title, identityLine(states.thief.c));
});

// ─── (16) Phase 70 (POLISH-02, D-03/D-04): the account face and block ────

test("(16) the ☰ wears the account face and the dropdown opens on the ACCOUNT block: the host is #mw-hud-menu's first child with its group aria; the static face is the plain ☰ (data-state menu); the avatar-face rule keeps the 34px box; the dropdown is at most 288px wide, fits 411px and scrolls inside itself", () => {
  // The ACCOUNT host is the dropdown's first child.
  const menuOpen = '<div class="mw-hud-menu" id="mw-hud-menu" role="menu" aria-label="Map menu" data-open="0">';
  const menuIdx = HTML.indexOf(menuOpen);
  assert.ok(menuIdx !== -1, "the dropdown's opening tag");
  const afterOpen = HTML.slice(menuIdx + menuOpen.length).replace(/^(\s|<!--[\s\S]*?-->)*/, "");
  assert.ok(
    afterOpen.startsWith('<div class="mw-hud-menu-acct" id="mw-hud-menu-acct" role="group" aria-label="Play Games account"></div>'),
    `the ACCOUNT host must be the dropdown's first child, got: ${afterOpen.slice(0, 120)}`,
  );
  assert.equal((HTML.match(/id="mw-hud-menu-acct"/g) || []).length, 1);

  // The static face: the plain ☰, labelled Menu (the signed-out label).
  const face = HTML.match(/<span class="mw-hud-menu-face" data-state="menu" aria-hidden="true">&#(\d+);<\/span>/);
  assert.ok(face, 'the static ☰ face carries data-state="menu"');
  assert.equal(String.fromCodePoint(Number(face[1])), HUD_MENU_GLYPH);
  assert.match(HTML, /id="mw-hud-menu-btn" aria-haspopup="menu" aria-controls="mw-hud-menu" aria-expanded="false" aria-label="Menu"/);
  assert.equal(ACCOUNT_COPY.menuLabel.plain, "Menu");

  // The avatar face: border:0 and the chip avatar's gold on-ring; the base
  // face stays 34×34 so the button never changes size between faces.
  const avatar = ruleFor('\\.mw-hud-menu-face\\[data-state="avatar"\\]');
  assert.match(avatar, /(?:^|;)border:0(?:;|$)/);
  assert.match(avatar, /box-shadow:inset 0 0 0 1px rgba\(0,0,0,\.5\),0 0 0 1px #e8c97a/);
  const base = ruleFor("\\.mw-hud-menu-face");
  assert.match(base, /(?:^|;)width:34px/);
  assert.match(base, /(?:^|;)height:34px/);

  // The dropdown: min(288px, 100vw - 40px) wide, which at 411px is at most
  // 411 − band 2's 14px right padding − a 12px margin; it scrolls inside
  // itself under a max-height.
  const menuRule = ruleFor("\\.mw-hud-menu(?!-)");
  const width = menuRule.match(/(?:^|;)width:min\((\d+)px,calc\(100vw - (\d+)px\)\)/);
  assert.ok(width, "the dropdown's width is min(<px>, calc(100vw - <px>))");
  assert.equal(Number(width[1]), 288);
  const atPixel7 = Math.min(Number(width[1]), 411 - Number(width[2]));
  assert.ok(atPixel7 <= 411 - 14 - 12, `the dropdown (${atPixel7}px) must fit 385px on a Pixel 7`);
  assert.doesNotMatch(menuRule, /min-width:/, "the fixed width replaces the old min-width");
  assert.match(menuRule, /(?:^|;)max-height:calc\(/);
  assert.match(menuRule, /(?:^|;)overflow-y:auto/);
  assert.match(menuRule, /(?:^|;)overscroll-behavior:contain/);

  // The ACCOUNT block's own inset and divider; no row is :first-child now.
  const acct = ruleFor("\\.mw-hud-menu-acct");
  assert.match(acct, /padding:0 14px/);
  assert.match(acct, /border-bottom:2px solid/);
  assert.doesNotMatch(HTML, /^\.mw-hud-menu-item:first-child\{/m, "the dead :first-child border reset is gone");

  // 44px rows: the ACCOUNT block reuses the sheet's rows.
  const pxOf = (rule, prop) => Number((rule.match(new RegExp(`(?:^|;|\\s)${prop}:(\\d+)px`)) || [])[1]);
  assert.ok(pxOf(ruleFor("\\.mw-acct-id"), "min-height") >= 44);
  assert.ok(pxOf(ruleFor("\\.mw-acct-action"), "min-height") >= 48);
  assert.ok(pxOf(ruleFor("\\.mw-acct-opt"), "min-height") >= 48);
  assert.ok(pxOf(ruleFor("\\.mw-hud-menu-item"), "min-height") >= 48);
});

// ─── (17) Phase 70 (POLISH-03, D-06): the quit rows ─────────────────────

const decodeAmp = (t) => t.replace(/&amp;/g, "&");

test("(17) the dropdown's rows are the ACCOUNT host, the four HUD_MENU_ITEMS rows, SAVE & QUIT, then ABANDON THIS CHARACTER last (danger look, data-armed/data-dead 0, three labels equal to HUD_MENU_QUIT_COPY); the label-switch CSS exists; the HERO tab's Delve panel and its two legacy ids are gone", () => {
  const menuSlice = sliceBetween(HTML, '<div class="mw-hud-menu" id="mw-hud-menu"', '<div class="mw-hud-menu-scrim"');
  const ids =[...menuSlice.replace(/<!--[\s\S]*?-->/g, "").matchAll(/<(?:div|button)\b[^>]*\bid="([^"]+)"/g)].map((m) => m[1]);
  assert.deepStrictEqual(ids, ["mw-hud-menu", "mw-hud-menu-acct", ...HUD_MENU_ITEMS.map((r) => r.id), "mw-menu-save-quit", "mw-menu-abandon"]);

  const save = menuSlice.match(/<button type="button" role="menuitem" class="([^"]+)" id="mw-menu-save-quit">([\s\S]*?)<\/button>/);
  assert.ok(save, "SAVE & QUIT row markup");
  assert.deepStrictEqual(save[1].split(" "), ["mw-hud-menu-item", "mw-hud-menu-quit", "mw-hud-menu-split"]);
  const saveLabels = [...save[2].matchAll(/<span class="mw-hud-menu-label">([^<]+)<\/span>/g)].map((m) => decodeAmp(m[1]));
  assert.deepStrictEqual(saveLabels, [HUD_MENU_QUIT_COPY.saveQuit]);

  const abandon = menuSlice.match(/<button type="button" role="menuitem" class="([^"]+)" id="mw-menu-abandon" data-armed="0" data-dead="0">([\s\S]*?)<\/button>/);
  assert.ok(abandon, "ABANDON row markup with data-armed=\"0\" data-dead=\"0\"");
  assert.deepStrictEqual(abandon[1].split(" "), ["mw-hud-menu-item", "mw-hud-menu-quit", "mw-danger-btn"]);
  const abandonLabels = [...abandon[2].matchAll(/<span class="mw-hud-menu-label" data-when="([^"]+)">([^<]+)<\/span>/g)].map((m) => [m[1], decodeAmp(m[2])]);
  assert.deepStrictEqual(abandonLabels, [
    ["idle", HUD_MENU_QUIT_COPY.abandon],
    ["armed", HUD_MENU_QUIT_COPY.armed],
    ["dead", HUD_MENU_QUIT_COPY.newCharacter],
  ]);
  assert.ok(menuSlice.lastIndexOf("</button>") === menuSlice.indexOf("</button>", menuSlice.indexOf('id="mw-menu-abandon"')), "ABANDON is the last row");

  // The label switch: all three hidden, then exactly one shown by state;
  // only display is declared, and nothing animates.
  assert.match(HTML, /^\.mw-hud-menu-quit \.mw-hud-menu-label\[data-when\]\{display:none\}$/m);
  assert.match(HTML, /^\.mw-hud-menu-quit\[data-dead="0"\]\[data-armed="0"\] \.mw-hud-menu-label\[data-when="idle"\]\{display:inline\}$/m);
  assert.match(HTML, /^\.mw-hud-menu-quit\[data-dead="0"\]\[data-armed="1"\] \.mw-hud-menu-label\[data-when="armed"\]\{display:inline\}$/m);
  assert.match(HTML, /^\.mw-hud-menu-quit\[data-dead="1"\] \.mw-hud-menu-label\[data-when="dead"\]\{display:inline\}$/m);
  assert.match(ruleFor("\\.mw-hud-menu-item\\.mw-hud-menu-quit"), /^padding-left:42px$/);
  assert.match(ruleFor("\\.mw-hud-menu-item\\.mw-hud-menu-split"), /border-top:4px solid/);
  for (const sel of ["\\.mw-hud-menu-item\\.mw-hud-menu-quit", "\\.mw-hud-menu-item\\.mw-hud-menu-split"]) {
    assert.doesNotMatch(ruleFor(sel), /animation|transition|min-height/, `${sel} declares no motion and keeps the 48px row floor`);
  }
  // The danger look outranks the generic menu-item fill on hover and press.
  assert.match(HTML, /^button\.mw-danger-btn\{border-color:var\(--mw-danger-border\);background:var\(--mw-danger-panel\);color:var\(--stamp\)\}$/m);
  assert.match(HTML, /^button\.mw-danger-btn:hover:not\(:disabled\)\{background:#341814\}$/m);
  assert.doesNotMatch(HTML, /^\.mw-hud-menu-item:(?:hover|active)/m, "no menu-item hover/active fill that could outrank the danger look");

  // The HERO tab's Delve panel is gone (no dual path).
  for (const id of ["btn-save-quit", "btn-abandon-character"]) {
    assert.equal(HTML.indexOf(`id="${id}"`), -1, `#${id} is retired`);
    assert.equal(CODE.indexOf(`"${id}"`), -1, `no wiring names ${id}`);
  }
  assert.doesNotMatch(HTML, /<h2>Delve<\/h2>/);
});

// ─── (18) BEHAVIOUR: every close disarms, opening stamps data-dead ──────

test("(18) BEHAVIOUR: an armed ABANDON row reads data-armed \"0\" after every close (scrim, select, escape, tab, encounter); opening stamps data-dead \"1\" for a dead hero and \"0\" for a live one", () => {
  const abandonEl = (doc) => doc.elementsById.get("mw-menu-abandon") || doc.getElementById("mw-menu-abandon");
  const closers = {
    scrim: (doc) => scrimEl(doc).onclick(),
    select: (doc) => menuEl(doc).onclick(),
    escape: (doc, sandbox) => sandbox.context.hudMenuEvent("escape"),
    tab: (doc, sandbox) => sandbox.context.window.__mzShowTab("hero"),
    encounter: (doc, sandbox) => sandbox.context.hudMenuEvent("encounter"),
  };
  for (const [name, close] of Object.entries(closers)) {
    const { doc, sandbox } = freshSandbox(states.thief);
    menuBtn(doc).onclick();
    assert.ok(isOpen(doc), `${name}: opened`);
    abandonEl(doc).dataset.armed = "1";
    close(doc, sandbox);
    assert.ok(isClosed(doc), `${name}: closed`);
    assert.equal(abandonEl(doc).dataset.armed, "0", `${name}: the close disarms the row`);
  }

  {
    const { doc, sandbox } = freshSandbox(states.thief);
    sandbox.setState({ ...states.thief, dead: true });
    sandbox.context.setHudMenuOpen(true);
    assert.equal(abandonEl(doc).dataset.dead, "1", "a dead hero stamps data-dead 1");
    sandbox.context.setHudMenuOpen(false);
    sandbox.setState({ ...states.thief, dead: false });
    sandbox.context.setHudMenuOpen(true);
    assert.equal(abandonEl(doc).dataset.dead, "0", "a live hero stamps data-dead 0");
  }
});

// ─── (19) BEHAVIOUR: the ☰ opens everywhere, rows disabled by context ────
// Phase 70 D-08 (POLISH-03): the ☰ opens on the map, in combat and every
// other encounter, and while dead; MAKE CAMP and CENTRE MAP dim (disabled +
// aria-disabled) when they cannot act, and an open menu re-syncs its rows
// when the encounter state changes under it.

test("(19) BEHAVIOUR (Phase 70 D-08): the ☰ opens in combat and while dead with MAKE CAMP and CENTRE MAP disabled, enables all six rows when idle, re-syncs an open menu, survives an ongoing encounter's re-render, ignores a tap on a disabled row, and a select on a closed menu is a no-op", () => {
  // combat: opens, camp + centre disabled
  {
    const { doc, sandbox } = freshSandbox(states.thief);
    sandbox.setState({ ...states.thief, combat: { round: 1 } });
    menuBtn(doc).onclick();
    assert.ok(isOpen(doc), "combat: the ☰ opens");
    assertRows(doc, ["btn-camp", "mw-chip-centre"], "combat");
  }
  // dead: opens, data-dead "1", camp + centre disabled
  {
    const { doc, sandbox } = freshSandbox(states.thief);
    sandbox.setState({ ...states.thief, dead: true });
    menuBtn(doc).onclick();
    assert.ok(isOpen(doc), "dead: the ☰ opens");
    assert.equal(rowEl(doc, "mw-menu-abandon").dataset.dead, "1", "dead: the last row reads NEW CHARACTER");
    assertRows(doc, ["btn-camp", "mw-chip-centre"], "dead");
  }
  // a live, idle hero: all six enabled
  {
    const { doc } = freshSandbox(states.thief);
    menuBtn(doc).onclick();
    assert.ok(isOpen(doc));
    assertRows(doc, [], "idle");
  }
  // the menu open over the stair prompt re-syncs when the prompt clears
  {
    const { doc, sandbox } = freshSandbox(states.thief);
    sandbox.context.window.__mzStair = { dir: "N" };
    sandbox.renderEncounter();
    menuBtn(doc).onclick();
    assert.ok(isOpen(doc));
    assertRows(doc, ["btn-camp", "mw-chip-centre"], "stair up");
    sandbox.context.window.__mzStair = null;
    sandbox.renderEncounter();
    assert.ok(isOpen(doc), "the encounter ending leaves the menu open");
    assertRows(doc, [], "stair cleared");
  }
  // an ongoing encounter's re-render leaves an open menu alone (R-D)
  {
    const { doc, sandbox } = freshSandbox(states.thief);
    sandbox.context.window.__mzStair = { dir: "N" };
    sandbox.renderEncounter();
    menuBtn(doc).onclick();
    assert.ok(isOpen(doc));
    sandbox.renderEncounter();
    assert.ok(isOpen(doc), "a re-render of an ongoing encounter must not close the menu");
  }
  // an encounter STARTING under an open menu still closes it (R-D)
  {
    const { doc, sandbox } = freshSandbox(states.thief);
    sandbox.renderEncounter();
    menuBtn(doc).onclick();
    assert.ok(isOpen(doc));
    sandbox.context.window.__mzStair = { dir: "N" };
    sandbox.renderEncounter();
    assert.ok(isClosed(doc), "an encounter starting closes the menu");
  }
  // a tap on a disabled row keeps the menu open; a bare onclick() closes it
  {
    const { doc, sandbox } = freshSandbox(states.thief);
    sandbox.context.window.__mzStair = { dir: "N" };
    menuBtn(doc).onclick();
    assert.ok(isOpen(doc));
    const campRow = rowEl(doc, "btn-camp");
    const fakeEvent = { target: { closest: (sel) => (sel === '[aria-disabled="true"]' ? campRow : null) } };
    menuEl(doc).onclick(fakeEvent);
    assert.ok(isOpen(doc), "a tap on a disabled row leaves the menu open");
    const liveEvent = { target: { closest: () => null } };
    menuEl(doc).onclick(liveEvent);
    assert.ok(isClosed(doc), "a tap on an enabled row closes the menu");
    menuBtn(doc).onclick();
    assert.ok(isOpen(doc));
    menuEl(doc).onclick();
    assert.ok(isClosed(doc), "onclick() with no event still closes the menu");
  }
  // select on a closed menu changes nothing
  {
    const { doc, sandbox } = freshSandbox(states.thief);
    assert.ok(isClosed(doc));
    const before = rowEl(doc, "mw-menu-abandon").dataset.armed;
    sandbox.context.hudMenuEvent("select");
    assert.ok(isClosed(doc), "select on a closed menu keeps it closed");
    assert.equal(rowEl(doc, "mw-menu-abandon").dataset.armed, before);
    sandbox.context.syncHudMenuRows();
    sandbox.context.syncHudMenuRows();
    assertRows(doc, [], "a repeated row sync is idempotent");
  }
});

// ─── (20) SOURCE: back closes the menu first, the beat lands first ───────

test("(20) SOURCE (Phase 70 D-08): closeModal's menu-first early return precedes the gear-sheet branch and the S.beats/S.store clears; hudMenuEvent lands a live beat before opening and asks with no encounter context; armEncounterButtons never sweeps the ☰; the disabled-row rule is scoped under #mw-hud-menu and outranks the camp short state", () => {
  const closeRegion = sliceBetween(CODE, "closeModal: () => {", "navigateBack:");
  const menuFirst = closeRegion.indexOf('if (hudMenuIsOpen()) { hudMenuEvent("escape"); return; }');
  const gear = closeRegion.indexOf("if (gearSheetTarget !== null)");
  const beats = closeRegion.indexOf("S.beats = null;");
  const store = closeRegion.indexOf("S.store = null;");
  assert.ok(menuFirst !== -1, "closeModal carries the menu-first early return");
  assert.ok(gear !== -1 && beats !== -1 && store !== -1);
  assert.ok(menuFirst < gear && menuFirst < beats && menuFirst < store, "the menu-first return runs before the gear sheet and the S.beats/S.store clears");
  assert.equal((closeRegion.match(/hudMenuEvent\("escape"\)/g) || []).length, 1, "no unconditional escape remains in closeModal");
  const acct = closeRegion.indexOf("if (accountSheetOpen())");
  const title = closeRegion.indexOf("if (boardsPanel.isTitleOpen())");
  assert.ok(acct !== -1 && title !== -1 && acct < menuFirst && title < menuFirst, "the account-sheet and title-panel returns still come first");

  const eventRegion = fnRegion("function hudMenuEvent(");
  const hurry = eventRegion.indexOf("window.__mzBeat?.hurry?.()");
  const openCall = eventRegion.indexOf("setHudMenuOpen(true)");
  assert.ok(hurry !== -1 && openCall !== -1 && hurry < openCall, "a live beat is landed before the menu opens (R-C)");
  assert.doesNotMatch(eventRegion, /hasActiveEncounter/, "hudMenuEvent asks the policy with no encounter context");

  const openRegion = fnRegion("function setHudMenuOpen(");
  assert.match(openRegion, /syncHudMenuRows\(\)/, "setHudMenuOpen(true) syncs the rows");

  const armRegion = fnRegion("function armEncounterButtons(");
  assert.doesNotMatch(armRegion, /mw-hud-menu/, "the arm sweep never touches the ☰ rows' aria-disabled");

  const disabledRule = HTML.match(/^#mw-hud-menu \.mw-hud-menu-item:disabled\{([^}]*)\}/m);
  assert.ok(disabledRule, "a disabled-row rule is scoped under #mw-hud-menu");
  assert.match(disabledRule[1], /opacity:/);
  assert.doesNotMatch(disabledRule[1], /animation|transition/, "the disabled look carries no motion");
});
