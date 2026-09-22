// test/unit/panel-motion.test.js
//
// Phase 58 (MOTION-02), Plan 04 — the automated proof for every D-05
// surface's open/close motion: the rail, the three bottom sheets (MARKS
// legend, Settings, camp), the ☰ menu, the encounter overlay and tab
// switches. One named test per must_haves claim:
//
//   1. CSS/JS agreement — every open/close transition or animation duration
//      and easing keyword on a D-05 surface equals src/browser/motion.js's
//      pinned constants (OPEN_MS/MENU_OPEN_MS/CLOSE_MS, ease-out/ease-in).
//   2. The rail's `[hidden]` rule finally restores `display:block!important`
//      — beating the global `[hidden]{display:none!important}` reset that
//      silently defeated 57-02's slide (57-VERIFICATION.md's override).
//   3. Keyframe hygiene — mwrise stays exactly once; the three new
//      keyframes (mwsheetin/mwsheetout/mwfadeout) each exactly once; the
//      ☰ menu rules reference no keyframe.
//   4-5. Sandbox, motion on with a fake clock — closeMarksLegend()/
//      closeCampSheet() animate the close and cancel on a mid-close
//      re-open.
//   6. renderEncounter's overlay close/cancel, under the same fake clock.
//   7. showTab's cross-fade: the outgoing screen is pinned with a
//      translateY offset by .mw-screens' own scrollTop and cancels on a
//      mid-leave re-select.
//   8. Rail retention — an idle re-render keeps the departing card's
//      content on screen; the rise class re-triggers only card-replaces-
//      card, never hidden-to-shown.
//   9. Pointer-inertness — the closing sheet panel and the closing overlay
//      are pointer-inert; the closing scrim is NOT (it absorbs taps).
//
// Every animated-path test drives test/unit/harness/shellSandbox.js's
// `loadShellSandbox({ doc, reducedMotion: false, clock })` — a real engine
// state from engine/state.js#newRun and test/unit/harness/fakeClock.js's
// deterministic `advance(ms)`, never a real sleep.

import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { createRecordingDocument } from "./harness/recordingDom.js";
import { loadShellSandbox } from "./harness/shellSandbox.js";
import { createFakeClock } from "./harness/fakeClock.js";
import { newRun } from "../../engine/state.js";
import { OPEN_MS, MENU_OPEN_MS, CLOSE_MS, CLOSE_SLACK_MS, EASE_OUT_CSS, EASE_IN_CSS } from "../../src/browser/motion.js";
import { RAIL_COPY, holdForCard, railDismissKind, emptyRail } from "../../src/browser/rail.js";
import { stripHtml } from "../../tools/ident-sweep.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const RAW_HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
const HTML = RAW_HTML.replace(/\r\n/g, "\n");
const CODE = stripHtml(HTML);

// cssSeconds(ms) — the exact CSS-source spelling this codebase uses for a
// millisecond duration (no leading zero — ".18s", never "0.18s").
function cssSeconds(ms) {
  const s = (ms / 1000).toString();
  return (s.startsWith("0.") ? s.slice(1) : s) + "s";
}
const OPEN_S = cssSeconds(OPEN_MS); // .18s
const MENU_OPEN_S = cssSeconds(MENU_OPEN_MS); // .16s
const CLOSE_S = cssSeconds(CLOSE_MS); // .12s

function ruleFor(selectorSource) {
  const re = new RegExp(`^${selectorSource}\\{([^}]*)\\}`, "m");
  const m = HTML.match(re);
  assert.ok(m, `expected to find a rule for /^${selectorSource}\\{/m`);
  return m[1];
}

// ─── (1) CSS/JS agreement ───────────────────────────────────────────────

test("(1) CSS/JS agreement: every D-05 surface's open transition/animation is OPEN_MS (the menu: MENU_OPEN_MS) ease-out, and every close is CLOSE_MS ease-in — read straight from src/browser/motion.js's own exported constants", () => {
  assert.equal(EASE_OUT_CSS, "ease-out");
  assert.equal(EASE_IN_CSS, "ease-in");

  // Rail: base rule (close) + [data-shown="1"] (open).
  const railBase = ruleFor("\\.mw-rail");
  assert.match(railBase, new RegExp(`transition:transform ${esc(CLOSE_S)} ${EASE_IN_CSS},visibility 0s ${esc(CLOSE_S)}`));
  const railShown = ruleFor('\\.mw-rail\\[data-shown="1"\\]');
  assert.match(railShown, new RegExp(`transition:transform ${esc(OPEN_S)} ${EASE_OUT_CSS},visibility 0s`));

  // ☰ menu: resting (close) + [data-open="1"] (open, MENU_OPEN_MS).
  const menuRest = ruleFor("\\.mw-hud-menu(?!-)");
  assert.match(menuRest, new RegExp(`transition:opacity ${esc(CLOSE_S)} ${EASE_IN_CSS},transform ${esc(CLOSE_S)} ${EASE_IN_CSS},visibility 0s ${esc(CLOSE_S)}`));
  const menuOpen = ruleFor('\\.mw-hud-menu\\[data-open="1"\\]');
  assert.match(menuOpen, new RegExp(`transition:opacity ${esc(MENU_OPEN_S)} ${EASE_OUT_CSS},transform ${esc(MENU_OPEN_S)} ${EASE_OUT_CSS},visibility 0s`));

  // Sheets: scrim/panel open (mwfade/mwsheetin, OPEN_MS ease-out) + closing (mwfadeout/mwsheetout, CLOSE_MS ease-in).
  const scrimOpen = ruleFor("\\.mw-legend-scrim(?!\\[)(?!\\s)");
  assert.match(scrimOpen, new RegExp(`animation:mwfade ${esc(OPEN_S)} ${EASE_OUT_CSS}`));
  const panelOpen = HTML.match(/\.mw-legend-panel\{([^}]*)\}/s)[1];
  assert.match(panelOpen, new RegExp(`animation:mwsheetin ${esc(OPEN_S)} ${EASE_OUT_CSS}`));
  const scrimClosing = ruleFor('\\.mw-legend-sheet\\[data-motion="closing"\\] \\.mw-legend-scrim');
  assert.match(scrimClosing, new RegExp(`animation:mwfadeout ${esc(CLOSE_S)} ${EASE_IN_CSS} forwards`));
  const panelClosing = ruleFor('\\.mw-legend-sheet\\[data-motion="closing"\\] \\.mw-legend-panel');
  assert.match(panelClosing, new RegExp(`animation:mwsheetout ${esc(CLOSE_S)} ${EASE_IN_CSS} forwards`));

  // Encounter overlay: open (mwfade, OPEN_MS ease-out) + closing (mwfadeout, CLOSE_MS ease-in).
  const overlayOpen = HTML.match(/\.mw-overlay\{([^}]*)\}/s)[1];
  assert.match(overlayOpen, new RegExp(`animation:mwfade ${esc(OPEN_S)} ${EASE_OUT_CSS}`));
  const overlayClosing = ruleFor('\\.mw-overlay\\[data-motion="closing"\\]');
  assert.match(overlayClosing, new RegExp(`animation:mwfadeout ${esc(CLOSE_S)} ${EASE_IN_CSS} forwards`));

  // Tabs: open (mwfade, OPEN_MS ease-out) + closing (mwfadeout, CLOSE_MS ease-in).
  const tabOpen = ruleFor("\\.mw-screens > \\.mw-screen(?!\\[)");
  assert.match(tabOpen, new RegExp(`animation:mwfade ${esc(OPEN_S)} ${EASE_OUT_CSS}`));
  const tabClosing = ruleFor('\\.mw-screens > \\.mw-screen\\[data-motion="closing"\\]');
  assert.match(tabClosing, new RegExp(`animation:mwfadeout ${esc(CLOSE_S)} ${EASE_IN_CSS} forwards`));
});

function esc(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── (2) the rail's !important hidden fix ───────────────────────────────

test('(2) the rail\'s hidden rule starts with display:block!important — needed because the global [hidden]{display:none!important} reset (this file\'s first style line) always wins over a non-important declaration regardless of specificity, so a hidden rail could never lay out (and therefore could never animate) without this', () => {
  assert.match(HTML, /^\.mw-rail\[hidden\]\{display:block!important;/m);
  assert.match(HTML, /\*\{box-sizing:border-box\}html\{color-scheme:dark\}body\{margin:0\}\[hidden\]\{display:none!important\}/);
});

// ─── (3) keyframe hygiene ────────────────────────────────────────────────

test("(3) keyframe hygiene: @keyframes mwrise stays exactly once; mwsheetin/mwsheetout/mwfadeout each appear exactly once; the ☰ menu rules reference no keyframe (no `animation` property anywhere in its rule set)", () => {
  assert.equal((CODE.match(/@keyframes mwrise\b/g) || []).length, 1);
  for (const kf of ["mwsheetin", "mwsheetout", "mwfadeout"]) {
    assert.equal((CODE.match(new RegExp(`@keyframes ${kf}\\b`, "g")) || []).length, 1, `@keyframes ${kf} must be defined exactly once`);
  }
  for (const selector of [
    "\\.mw-hud-menu(?!-)",
    '\\.mw-hud-menu\\[data-open="1"\\]',
    "\\.mw-hud-menu-scrim(?!-)",
    '\\.mw-hud-menu-scrim\\[data-open="1"\\]',
  ]) {
    assert.doesNotMatch(ruleFor(selector), /animation/i, `${selector} must reference no keyframe`);
  }
});

// ─── sandbox scenario builder ───────────────────────────────────────────

function buildScenario({ reducedMotion = false, clock = null } = {}) {
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc, reducedMotion, clock });
  const state = newRun(1);
  sandbox.setState(state);
  return { sandbox, state, doc, context: sandbox.context };
}

// ─── (4) closeMarksLegend()/openMarksLegend(): animated close + cancel ──

test("(4) closeMarksLegend() leaves the sheet un-hidden with data-motion=\"closing\" (and has already stamped lastDismissAt); advancing CLOSE_MS+slack hides it and clears data-motion; openMarksLegend() mid-close cancels (still shown, no data-motion, and advancing hides nothing)", () => {
  const clock = createFakeClock();
  const scn = buildScenario({ reducedMotion: false, clock });
  const sheet = scn.doc.document.getElementById("mw-legend-sheet");

  scn.context.openMarksLegend();
  assert.equal(sheet.hidden, false);

  scn.context.closeMarksLegend();
  assert.equal(sheet.hidden, false, "must stay un-hidden through the animated close");
  assert.equal(sheet.dataset.motion, "closing");
  // lastDismissAt is a lexical classic-script `let`, not directly readable
  // from here — encounterSettled() is the one existing reader of it, so a
  // false answer right after the call proves the stamp landed at CALL
  // time (still inside DISMISS_SETTLE_MS), not on some future timer.
  assert.equal(scn.context.encounterSettled(), false, "lastDismissAt must be stamped at call time");

  clock.advance(CLOSE_MS + CLOSE_SLACK_MS);
  assert.equal(sheet.hidden, true);
  assert.equal(sheet.dataset.motion, undefined);

  // Cancel mid-close: open() while a close is pending.
  scn.context.openMarksLegend();
  scn.context.closeMarksLegend();
  assert.equal(sheet.dataset.motion, "closing");
  scn.context.openMarksLegend();
  assert.equal(sheet.hidden, false, "re-opening mid-close must cancel the pending hide");
  assert.equal(sheet.dataset.motion, undefined);
  clock.advance(CLOSE_MS + CLOSE_SLACK_MS);
  assert.equal(sheet.hidden, false, "no stray timer may fire after the cancel");
});

// ─── (5) closeCampSheet()/openCampSheet(): the same close/cancel behaviour ──

test("(5) closeCampSheet() leaves the camp sheet un-hidden with data-motion=\"closing\" (and has already stamped lastDismissAt); advancing CLOSE_MS+slack hides it; openCampSheet() mid-close cancels", () => {
  const clock = createFakeClock();
  const scn = buildScenario({ reducedMotion: false, clock });
  const sheet = scn.doc.document.getElementById("mw-camp-sheet");

  scn.context.openCampSheet();
  assert.equal(sheet.hidden, false);

  scn.context.closeCampSheet();
  assert.equal(sheet.hidden, false);
  assert.equal(sheet.dataset.motion, "closing");
  assert.equal(scn.context.encounterSettled(), false, "lastDismissAt must be stamped at call time");

  clock.advance(CLOSE_MS + CLOSE_SLACK_MS);
  assert.equal(sheet.hidden, true);
  assert.equal(sheet.dataset.motion, undefined);

  scn.context.openCampSheet();
  scn.context.closeCampSheet();
  assert.equal(sheet.dataset.motion, "closing");
  scn.context.openCampSheet();
  assert.equal(sheet.hidden, false, "re-opening mid-close must cancel the pending hide");
  assert.equal(sheet.dataset.motion, undefined);
  clock.advance(CLOSE_MS + CLOSE_SLACK_MS);
  assert.equal(sheet.hidden, false);
});

// ─── (6) renderEncounter: the overlay's animated close + cancel ─────────

test("(6) renderEncounter: an encounter -> non-encounter transition leaves #enc-panel closing, then hidden after CLOSE_MS+slack; re-entering an encounter mid-close cancels the hide", () => {
  const clock = createFakeClock();
  const scn = buildScenario({ reducedMotion: false, clock });
  const panel = scn.doc.document.getElementById("enc-panel");

  scn.context.window.__mzStair = {};
  scn.context.renderEncounter();
  assert.equal(panel.hidden, false);

  scn.context.window.__mzStair = null;
  scn.context.renderEncounter();
  assert.equal(panel.hidden, false, "must not hide synchronously — it is animating out");
  assert.equal(panel.dataset.motion, "closing");

  clock.advance(CLOSE_MS + CLOSE_SLACK_MS);
  assert.equal(panel.hidden, true);
  assert.equal(panel.dataset.motion, undefined);

  // Re-entering mid-close cancels the hide.
  scn.context.window.__mzStair = {};
  scn.context.renderEncounter();
  scn.context.window.__mzStair = null;
  scn.context.renderEncounter();
  assert.equal(panel.dataset.motion, "closing");
  clock.advance(50); // partway through the close
  scn.context.window.__mzStair = {};
  scn.context.renderEncounter();
  assert.equal(panel.hidden, false, "cancelling must reopen it instantly");
  assert.equal(panel.dataset.motion, undefined, "the pending close must be cancelled");
  clock.advance(CLOSE_MS + CLOSE_SLACK_MS);
  assert.equal(panel.hidden, false, "no stray timer may fire after the cancel");
});

// ─── (7) showTab's cross-fade ────────────────────────────────────────────

test("(7) showTab(\"hero\") from the map: #screen-maze gets data-motion=\"closing\" and a translateY equal to minus .mw-screens' own scrollTop (37 in this test); #screen-hero is shown at once; after the close #screen-maze is hidden with an empty transform; showTab(\"maze\") mid-leave cancels it", () => {
  const clock = createFakeClock();
  const scn = buildScenario({ reducedMotion: false, clock });
  const screensEl = scn.doc.document.getElementById("mw-screens");
  screensEl.scrollTop = 37;
  const maze = scn.doc.document.getElementById("screen-maze");
  const hero = scn.doc.document.getElementById("screen-hero");
  assert.equal(maze.hidden, false);
  assert.equal(hero.hidden, true);

  scn.context.window.__mzShowTab("hero");
  assert.equal(hero.hidden, false, "the incoming screen must show at once");
  assert.equal(maze.hidden, false, "the outgoing screen must not hide synchronously — it is animating out");
  assert.equal(maze.dataset.motion, "closing");
  assert.equal(maze.style.transform, "translateY(-37px)");

  clock.advance(CLOSE_MS + CLOSE_SLACK_MS);
  assert.equal(maze.hidden, true, "the close must finish to hidden");
  assert.equal(maze.style.transform, "", "the leaving transform must be cleared once hidden");
  assert.equal(maze.dataset.motion, undefined);

  // A mid-leave re-select cancels it: switch back to gear, then re-select
  // gear again before its own leave finishes.
  scn.context.window.__mzShowTab("gear");
  const gear = scn.doc.document.getElementById("screen-gear");
  assert.equal(gear.hidden, false);
  assert.equal(hero.dataset.motion, "closing", "hero must now be the one leaving");

  scn.context.window.__mzShowTab("hero"); // mid-leave re-select cancels hero's own pending close
  assert.equal(hero.hidden, false, "cancelling must reopen it instantly");
  assert.equal(hero.dataset.motion, undefined, "the pending close must be cancelled");
  assert.equal(hero.style.transform, "", "the reselected screen must carry no stray leaving transform");
  clock.advance(CLOSE_MS + CLOSE_SLACK_MS);
  assert.equal(hero.hidden, false, "no stray timer may fire after the cancel");
});

// ─── (8) rail retention ──────────────────────────────────────────────────
//
// test/unit/harness/shellSandbox.js's own loadShellSandbox() stubs
// renderRail() to a no-op AFTER the classic script runs (it serves the
// Gear/Hero/Store snapshot surfaces, which never reach for the rail) — so
// this test needs the REAL renderRail(), never the stub. Mirrors
// test/unit/rail-dismiss.test.js's own "deliberate sibling loader" pattern
// (that file's own header comment explains why a second vm.runInContext
// call in the same context is not an option): the SAME classic script, the
// minimal bridge set renderRail() itself reads (window.__mzRailVM.copy/
// holdForCard, window.__mzState), never draw()/renderRail() stubbed.

function loadRailScenario() {
  const doc = createRecordingDocument();
  const raw = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8").replace(/\r\n/g, "\n");
  const CLASSIC_OPEN = "\n<script>\n";
  const SCRIPT_CLOSE = "\n</script>\n";
  const classicStart = raw.indexOf(CLASSIC_OPEN);
  const classicEnd = raw.indexOf(SCRIPT_CLOSE, classicStart + 1);
  const classic = raw.slice(classicStart + CLASSIC_OPEN.length, classicEnd);

  const fakeStorage = new Map();
  const sandbox = {
    document: doc.document,
    console,
    Math,
    setTimeout: (() => {
      let id = 1;
      return () => id++;
    })(),
    clearTimeout() {},
    addEventListener() {},
    removeEventListener() {},
    requestAnimationFrame() {},
    cancelAnimationFrame() {},
    getComputedStyle() {
      return { getPropertyValue: () => "" };
    },
    matchMedia: (q) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} }),
    localStorage: {
      getItem: (k) => (fakeStorage.has(k) ? fakeStorage.get(k) : null),
      setItem: (k, v) => fakeStorage.set(k, String(v)),
      removeItem: (k) => fakeStorage.delete(k),
    },
    navigator: { userAgent: "node", vibrate() {} },
    performance: { now: () => 0 },
    innerWidth: 400,
    innerHeight: 800,
    devicePixelRatio: 1,
    location: { search: "" },
  };
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(classic, context, { filename: "mazeworld.html#classic (panel-motion rail sandbox)" });
  context.window.__mzRailVM = { copy: RAIL_COPY, holdForCard, dismissKind: railDismissKind };
  context.window.__mzRail = emptyRail();
  context.window.__mzState.set(newRun(1));
  return { context, doc };
}

test("(8) rail retention: clearing a shown card hides the rail (data-shown=\"0\") WITHOUT repainting — the departing card's title/announcer stay intact; the mw-rail-new rise re-triggers only when a card replaces a card while the rail is already shown, never on a hidden-to-shown render", () => {
  const { context, doc } = loadRailScenario();

  const railEl = doc.document.getElementById("mw-rail");
  const titleEl = doc.document.getElementById("mw-rail-title");
  const liveEl = doc.document.getElementById("mw-rail-live");

  // A fresh card on a hidden rail: the rise must NOT fire (hidden -> shown
  // — the CSS slide plays alone).
  context.window.__mzRail = { seq: 1, card: { seq: 1, tone: "info", icon: "◇", iconKey: null, title: "FIRST CARD", lines: [{ text: "one", roll: null }] }, pending: null };
  context.renderRail();
  assert.equal(railEl.hidden, false);
  assert.equal(railEl.dataset.shown, "1");
  assert.equal(railEl.classList.contains("mw-rail-new"), false, "hidden-to-shown must not trigger the rise — the CSS slide plays alone");
  assert.equal(titleEl.textContent, "FIRST CARD");

  // A second, DIFFERENT card while the rail is already shown: the rise
  // DOES fire (card replaces card while up).
  context.window.__mzRail = { seq: 2, card: { seq: 2, tone: "good", icon: "▪", iconKey: null, title: "SECOND CARD", lines: [{ text: "two", roll: null }] }, pending: null };
  context.renderRail();
  assert.equal(railEl.classList.contains("mw-rail-new"), true, "a card replacing a card while the rail is up must re-trigger the rise");
  assert.equal(titleEl.textContent, "SECOND CARD");

  // Clearing the card: the rail hides, but the SECOND CARD's own content
  // is retained — no idle repaint.
  context.window.__mzRail = { seq: 2, card: null, pending: null };
  context.renderRail();
  assert.equal(railEl.hidden, true);
  assert.equal(railEl.dataset.shown, "0");
  assert.equal(titleEl.textContent, "SECOND CARD", "the departing card's title must be retained through its slide-out, not repainted to the idle copy");
  assert.equal(liveEl.textContent, "", "the announcer must clear on the idle transition");
});

// ─── (9) pointer-inertness ───────────────────────────────────────────────

test("(9) the closing sheet panel and the closing overlay declare pointer-events:none; the closing scrim does NOT (it stays tappable to absorb taps and keep a close idempotent — T-58-11/T-58-12)", () => {
  const closingPanel = ruleFor('\\.mw-legend-sheet\\[data-motion="closing"\\] \\.mw-legend-panel');
  assert.match(closingPanel, /pointer-events:none/);
  const closingOverlay = ruleFor('\\.mw-overlay\\[data-motion="closing"\\]');
  assert.match(closingOverlay, /pointer-events:none/);
  const closingScrim = ruleFor('\\.mw-legend-sheet\\[data-motion="closing"\\] \\.mw-legend-scrim');
  assert.doesNotMatch(closingScrim, /pointer-events/);
});
