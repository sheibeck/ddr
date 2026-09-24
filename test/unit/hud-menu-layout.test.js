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
import { HUD_MENU_ITEMS } from "../../src/browser/hudMenu.js";
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
  // Phase 67 (ACCT-01, D-05): the account chip sits between the counters
  // and the menu wrap (immediately left of the ☰), never inside the
  // counters' clipping box.
  const chipIdx = band2Slice.indexOf('id="mw-acct-chip"');
  const lastCounterIdx = band2Slice.indexOf('id="m-rations"');
  assert.ok(chipIdx !== -1, "#mw-acct-chip must sit on band 2");
  assert.ok(lastCounterIdx < chipIdx && chipIdx < wrapIdx, "#mw-acct-chip sits after the counters and before the menu wrap");
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
  // Phase 67 (ACCT-01): the account chip joins both id lists.
  for (const id of ["mw-hud-menu-btn", "mw-hud-menu", "mw-hud-menu-scrim", "mw-chip-marks", "mw-chip-centre", "btn-camp", "mw-gear-btn", "mw-acct-chip"]) {
    assert.doesNotMatch(viewportRegion, new RegExp(`id="${id}"`), `#${id} must not appear inside the viewport`);
  }
  const mainIdx = HTML.indexOf('<main class="mw-screens"');
  for (const id of ["mw-hud-menu-btn", "mw-hud-menu", "mw-hud-menu-scrim", "mw-acct-chip"]) {
    const idx = HTML.indexOf(`id="${id}"`);
    assert.ok(idx !== -1 && idx < mainIdx, `#${id} must precede <main class="mw-screens">`);
  }
  const region = sliceBetween(CODE, "(function initMazeViewportControls() {", "\n})();");
  const getByIdCalls = (region.match(/getElementById\("mw-maze-viewport"\)/g) || []).length;
  assert.equal(getByIdCalls, 1, 'expected exactly one getElementById("mw-maze-viewport") call inside initMazeViewportControls');
  assert.match(region, /vp\.addEventListener\("pointerdown"/, "the pointerdown listener is attached to vp, the viewport local");
});

// ─── (5) the z-ladder ────────────────────────────────────────────────────

test("(5) the z-ladder: rail (4) < scrim (5) < menu wrap (6) < overlay (8); .mw-hud, .mw-hud-band2 and .mw-stage declare no z-index and no transform", () => {
  const railRule = ruleFor("\\.mw-rail");
  const scrimRule = ruleFor("\\.mw-hud-menu-scrim");
  const wrapRule = ruleFor("\\.mw-hud-menu-wrap");
  const overlayRule = ruleFor("\\.mw-overlay");
  const zOf = (rule, name) => {
    const m = rule.match(/z-index:(\d+)/);
    assert.ok(m, `${name} must declare a z-index`);
    return Number(m[1]);
  };
  const rail = zOf(railRule, ".mw-rail");
  const scrim = zOf(scrimRule, ".mw-hud-menu-scrim");
  const wrap = zOf(wrapRule, ".mw-hud-menu-wrap");
  const overlay = zOf(overlayRule, ".mw-overlay");
  assert.ok(rail < scrim && scrim < wrap && wrap < overlay, `expected rail(${rail}) < scrim(${scrim}) < wrap(${wrap}) < overlay(${overlay})`);
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
  // guarded on active; the keydown escape branch precedes the listener's
  // hasActiveEncounter() branch; showTab calls hudMenuEvent("tab") before
  // its keep-in-view call.
  const encRegion = fnRegion("function renderEncounter() {");
  assert.match(encRegion, /if \(active\) hudMenuEvent\("encounter"\);/);
  const keydownRegion = sliceBetween(CODE, 'addEventListener("keydown"', 'addEventListener("resize"');
  const escapeIdx = keydownRegion.indexOf('hudMenuEvent("escape")');
  const hasActiveIdx = keydownRegion.indexOf("hasActiveEncounter()");
  assert.ok(escapeIdx !== -1 && hasActiveIdx !== -1 && escapeIdx < hasActiveIdx, "the Escape branch must precede the listener's hasActiveEncounter() branch");
  const showTabRegion = sliceBetween(CODE, "function showTab(name) {", "for (const btn of tabs) btn.addEventListener");
  const tabEventIdx = showTabRegion.indexOf('hudMenuEvent("tab")');
  const keepInViewIdx = showTabRegion.indexOf("window.mzKeepPartyInView?.()");
  assert.ok(tabEventIdx !== -1 && keepInViewIdx !== -1 && tabEventIdx < keepInViewIdx, 'hudMenuEvent("tab") must run before the keep-in-view call');
});

// ─── (10) BEHAVIOUR: cannot open during an encounter ─────────────────────

test("(10) BEHAVIOUR: while window.__mzStair is truthy (hasActiveEncounter() true), the ☰ onclick leaves the menu closed", () => {
  const { doc, sandbox } = freshSandbox(states.thief);
  sandbox.context.window.__mzStair = { dir: "N" };
  menuBtn(doc).onclick();
  assert.ok(isClosed(doc), "the menu must not open while an encounter is active");
});

// ─── (11) BEHAVIOUR: fail closed without the bridge ──────────────────────

test("(11) BEHAVIOUR: with __mzHudMenu deleted from the sandbox window, the ☰ onclick leaves the menu closed and nothing throws", () => {
  const { doc, sandbox } = freshSandbox(states.thief);
  delete sandbox.context.window.__mzHudMenu;
  assert.doesNotThrow(() => menuBtn(doc).onclick());
  assert.ok(isClosed(doc), "a missing bridge must fail closed");
});

// ─── (12) accessibility ───────────────────────────────────────────────────

test("(12) accessibility: the ☰ carries aria-haspopup=menu/aria-controls/aria-label; the dropdown is role=menu; every row is role=menuitem; aria-expanded mirrors data-open across open and close", () => {
  assert.match(HTML, /id="mw-hud-menu-btn" aria-haspopup="menu" aria-controls="mw-hud-menu" aria-expanded="false" aria-label="Menu"/);
  assert.match(HTML, /<div class="mw-hud-menu" id="mw-hud-menu" role="menu" aria-label="Map menu" data-open="0">/);
  const menuSlice = sliceBetween(HTML, '<div class="mw-hud-menu" id="mw-hud-menu"', "</header>");
  assert.equal((menuSlice.match(/role="menuitem"/g) || []).length, 4, "all four rows must be role=menuitem");

  const { doc } = freshSandbox(states.thief);
  menuBtn(doc).onclick();
  assert.equal(menuBtn(doc).getAttribute("aria-expanded"), "true");
  assert.equal(menuEl(doc).dataset.open, "1");
  menuBtn(doc).onclick();
  assert.equal(menuBtn(doc).getAttribute("aria-expanded"), "false");
  assert.equal(menuEl(doc).dataset.open, "0");
});

// ─── (13) BEHAVIOUR: the HUD is off-tab on Dead ──────────────────────────

test("(13) BEHAVIOUR + structural: window.__mzShowTab(\"dead\") writes data-offtab \"1\" on #mw-hud and #mm-conditions (each of maze/hero/gear/oracle writes \"0\"); the [data-offtab=\"1\"] rules exist for .mw-hud and .mw-cond-strip, and #screen-dead carries the safe-area top padding", () => {
  const { doc, sandbox } = freshSandbox(states.thief);
  sandbox.context.window.__mzShowTab("dead");
  assert.equal(doc.elementsById.get("mw-hud").dataset.offtab, "1");
  assert.equal(doc.elementsById.get("mm-conditions").dataset.offtab, "1");
  for (const tab of ["maze", "hero", "gear", "oracle"]) {
    sandbox.context.window.__mzShowTab(tab);
    assert.equal(doc.elementsById.get("mw-hud").dataset.offtab, "0", `#mw-hud must be "0" on ${tab}`);
    assert.equal(doc.elementsById.get("mm-conditions").dataset.offtab, "0", `#mm-conditions must be "0" on ${tab}`);
  }

  assert.match(HTML, /^\.mw-hud\[data-offtab="1"\]\{display:none\}$/m);
  assert.match(HTML, /^\.mw-cond-strip\[data-offtab="1"\]\{display:none\}$/m);
  assert.match(HTML, /^#screen-dead\{padding-top:calc\(14px \+ var\(--safe-area-inset-top, env\(safe-area-inset-top, 0px\)\)\)\}$/m);
});

// ─── (14) the width budget at text size M fits a 411px Pixel 7 ──────────

test("(14) the width budget at text size M fits a 411px Pixel 7 (band-2 padding/gap, counters gap, item gap, the ☰'s width minus its negative inline-end margin, COUNTER_SLOT_CH's per-id slots)", () => {
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
    return (
      labelsTotalPx * scale +
      numbersTotalPx * scale +
      labelNumberGaps * scale +
      itemGaps +
      bandHPadding +
      bandGap +
      btnFootprint
    );
  }

  const totalM = totalAt(1);
  assert.ok(totalM <= 411, `band 2's width budget at M (${totalM.toFixed(1)}px) must fit a 411px Pixel 7`);

  const totalL = totalAt(1.25);
  // eslint-disable-next-line no-console
  console.log(`hud-menu-layout (14): band 2 at L (×1.25) computes to ${totalL.toFixed(1)}px — logged only, the deferred device check.`);
});

// ─── (15) BEHAVIOUR: band 1 through the bridge ───────────────────────────

test("(15) BEHAVIOUR: paint() writes identityParts(c).name into #mw-hud-name, identityParts(c).line into #mw-hud-line, and identityLine(c) into #mw-hud-line's title", () => {
  const { doc } = freshSandbox(states.thief);
  const parts = identityParts(states.thief.c);
  assert.equal(doc.elementsById.get("mw-hud-name").textContent, parts.name);
  assert.equal(doc.elementsById.get("mw-hud-line").textContent, parts.line);
  assert.equal(doc.elementsById.get("mw-hud-line").title, identityLine(states.thief.c));
});
