// test/unit/dead-lockdown.test.js
//
// Phase 78 (HUD-02), Plan 06 — the dead-state lockdown. The user's words
// (78-CONTEXT): "once the hero is dead, only the Oracle, the DEAD/
// Leaderboards screen and the ☰ menu (Settings, the way back to the title;
// the account rows stay in ☰ per the standing ruling) accept input. Map
// taps, the other tabs, camp, marks and centre-map are inert." Amended by
// the user's 2026-09-26 ruling: "after death the MAP tab stays VIEWABLE but
// read-only. You can look at the map where you died, but every map tap,
// mark and camp action is inert."
//
// Every case runs mazeworld.html's classic script in the shell sandbox with
// a REAL engine state (newRun, then engine/death.js#die). The viewport's
// pointer listeners are captured by pre-creating #mw-maze-viewport with a
// recording addEventListener before the classic script runs; top-level
// classic `let`s (cam, zoom, mwActiveTab) are read with vm.runInContext.

import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { newRun } from "../../engine/state.js";
import { die } from "../../engine/death.js";
import { makeRng } from "../../engine/rng.js";
import { createRecordingDocument } from "./harness/recordingDom.js";
import { loadShellSandbox } from "./harness/shellSandbox.js";
import { stripJs } from "../../tools/ident-sweep.mjs";
import { finalSheetViewModel, renderFinalSheet, FINAL_SHEET_CLASSES } from "../../src/browser/finalSheet.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8").replace(/\r\n/g, "\n");
const CODE = stripJs(HTML);

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start !== -1, `start marker not found: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end !== -1, `end marker not found after start: ${endMarker}`);
  return source.slice(start, end);
}

function liveState() {
  const s = newRun(11, [], { force: { cls: "Fighter" } });
  s.c.wp = s.c.maxWP;
  return s;
}
function deadState() {
  const s = liveState();
  die(s, "combat", "a rat", makeRng(4), [], () => 1);
  return s;
}

/** boot(state) — a sandbox whose viewport records its pointer listeners. */
function boot(state) {
  const doc = createRecordingDocument();
  const vp = doc.document.getElementById("mw-maze-viewport");
  const handlers = {};
  vp.addEventListener = (type, fn) => {
    (handlers[type] ||= []).push(fn);
  };
  const sandbox = loadShellSandbox({ doc });
  const w = sandbox.context.window;
  const moves = [];
  w.move = (dir) => moves.push(dir);
  const railLines = [];
  w.mzRailLine = (...args) => railLines.push(args);
  sandbox.setState(state);
  sandbox.paint();
  const fire = (type, e) => {
    for (const fn of handlers[type] || []) fn({ type, preventDefault() {}, ...e });
  };
  const read = (expr) => vm.runInContext(expr, sandbox.context);
  const el = (id) => doc.document.getElementById(id);
  return { doc, sandbox, w, fire, read, el, moves, railLines, handlers };
}

function isDisabled(node) {
  return node.disabled === true && node.getAttribute("aria-disabled") === "true";
}
function isLive(node) {
  return node.disabled !== true && node.getAttribute("aria-disabled") === null;
}

// ─── the tabs ─────────────────────────────────────────────────────────────

test("HUD-02 markup: the five tab buttons carry ids the lock can reach (mw-tab-maze/hero/gear/oracle/dead)", () => {
  for (const name of ["maze", "hero", "gear", "oracle", "dead"]) {
    assert.match(HTML, new RegExp(`<button type="button" class="mw-tab[^"]*" id="mw-tab-${name}" data-tab="${name}"`), name);
  }
});

test("HUD-02: while dead, HERO and GEAR are disabled and aria-disabled; MAP, ORACLE and DEAD are not; a live run re-enables all five", () => {
  const r = boot(deadState());
  for (const name of ["hero", "gear"]) assert.ok(isDisabled(r.el(`mw-tab-${name}`)), `${name} locked while dead`);
  for (const name of ["maze", "oracle", "dead"]) assert.ok(isLive(r.el(`mw-tab-${name}`)), `${name} live while dead`);
  r.sandbox.setState(liveState());
  r.sandbox.paint();
  for (const name of ["maze", "hero", "gear", "oracle", "dead"]) assert.ok(isLive(r.el(`mw-tab-${name}`)), `${name} live for a live run`);
});

test("HUD-02: showTab refuses HERO and GEAR while dead; MAP, ORACLE and DEAD switch", () => {
  const r = boot(deadState());
  assert.equal(r.read("mwActiveTab"), "maze");
  r.w.__mzShowTab("gear");
  assert.equal(r.read("mwActiveTab"), "maze", "GEAR refused");
  r.w.__mzShowTab("hero");
  assert.equal(r.read("mwActiveTab"), "maze", "HERO refused");
  assert.equal(r.el("screen-gear").hidden, true);
  assert.equal(r.el("screen-hero").hidden, true);
  for (const name of ["oracle", "dead", "maze"]) {
    r.w.__mzShowTab(name);
    assert.equal(r.read("mwActiveTab"), name, `${name} switches`);
  }
});

test("HUD-02: a live run's showTab still reaches HERO and GEAR", () => {
  const r = boot(liveState());
  r.w.__mzShowTab("gear");
  assert.equal(r.read("mwActiveTab"), "gear");
  r.w.__mzShowTab("hero");
  assert.equal(r.read("mwActiveTab"), "hero");
});

test("HUD-02: dying while the Gear tab is showing switches to the map so the death card is seen", () => {
  const r = boot(liveState());
  r.w.__mzShowTab("gear");
  assert.equal(r.read("mwActiveTab"), "gear");
  r.sandbox.setState(deadState());
  r.sandbox.paint();
  assert.equal(r.read("mwActiveTab"), "maze");
  assert.equal(r.el("enc-panel").hidden, false, "the death card shows over the map");
  assert.ok(r.doc.elementsById.get("btn-death-confirm"), "THAT IS THAT's BURY THEM is on screen");
});

// ─── the read-only dead map ──────────────────────────────────────────────
//
// Quick task 260928-dcm (the user's 2026-09-27 ruling, superseding the
// put-aside part of the 2026-09-26 one): "after dying, if i leave the map and
// come back to it, the rail with our death message is gone, and i just see
// the map. Make sure that the map still shows the death message with the
// three buttons on it." Whenever the MAP tab shows while the hero is dead,
// the death card (THAT IS THAT) is up with REVIEW THE ORACLE, FINAL SHEET
// and BURY THEM — just died, back from another tab, or relaunched. The map
// under it stays read-only: a drag or a pinch moves only the camera.

/** deathCardUp(r, why) — THAT IS THAT is showing over the map with its three
 * buttons, in order, each one live: past the arm window a tap routes. */
function assertDeathCardUp(r, why) {
  const panel = r.el("enc-panel");
  assert.equal(r.read("mwActiveTab"), "maze", `${why}: the MAP tab is showing`);
  assert.equal(panel.hidden, false, `${why}: the death card is up`);
  assert.equal(panel.dataset.mode, "dark", `${why}: the over-panel`);
  const over = r.el("enc-body").querySelector(".cb-over");
  assert.ok(over, `${why}: THAT IS THAT's block is in the panel`);
  assert.equal(over.querySelector(".cb-over-title").textContent, "THAT IS THAT", why);
  const actions = over.querySelector(".cb-over-actions");
  assert.deepStrictEqual(
    actions.children.map((b) => [b.id, b.textContent]),
    [["btn-death-oracle", "REVIEW THE ORACLE"], ["btn-death-sheet", "FINAL SHEET"], ["btn-death-confirm", "BURY THEM"]],
    `${why}: the three buttons, in order`,
  );
  // Live: each button carries its guarded handler, and past the arm window
  // (encRenderedAt pushed back) a tap does what the button says.
  for (const b of actions.children) assert.equal(typeof b.onclick, "function", `${why}: ${b.id} is wired`);
  const routed = [];
  r.w.mzOpenFinalSheet = () => routed.push("sheet");
  r.w.mzReturnToTitle = () => routed.push("bury");
  r.read("encRenderedAt = 0");
  r.el("btn-death-sheet").onclick();
  r.el("btn-death-confirm").onclick();
  assert.deepStrictEqual(routed, ["sheet", "bury"], `${why}: FINAL SHEET and BURY THEM route`);
  r.el("btn-death-oracle").onclick();
  assert.equal(r.read("mwActiveTab"), "oracle", `${why}: REVIEW THE ORACLE opens the Oracle`);
  r.w.__mzShowTab("maze");
  assert.equal(panel.hidden, false, `${why}: and back again, the card is still up`);
}

test("HUD-02 (ruling 2026-09-27, quick 260928-dcm): the death card is up the moment the hero dies, with THAT IS THAT and three live buttons", () => {
  const r = boot(deadState());
  assertDeathCardUp(r, "just died");
  assert.equal(r.sandbox.context.hasActiveEncounter(), true, "every input gate stays shut");
});

test("HUD-02 (ruling 2026-09-27): leaving the MAP for ORACLE or DEAD and coming back shows the death card again, and a repaint keeps it", () => {
  for (const away of ["oracle", "dead"]) {
    const r = boot(deadState());
    r.w.__mzShowTab(away);
    assert.equal(r.read("mwActiveTab"), away);
    r.w.__mzShowTab("maze");
    assertDeathCardUp(r, `back from ${away.toUpperCase()}`);
    r.sandbox.paint();
    assertDeathCardUp(r, `back from ${away.toUpperCase()}, then a repaint`);
    assert.equal(r.sandbox.context.hasActiveEncounter(), true, "every input gate stays shut");
  }
});

test("HUD-02 (ruling 2026-09-27): opening and closing the ☰ over the dead map, or from the ORACLE tab, leaves the death card up", () => {
  const r = boot(deadState());
  r.el("mw-hud-menu-btn").onclick();
  assert.equal(r.sandbox.context.hudMenuIsOpen(), true, "the ☰ opens while dead");
  r.el("mw-hud-menu-btn").onclick();
  assert.equal(r.sandbox.context.hudMenuIsOpen(), false);
  assertDeathCardUp(r, "after the ☰ on the map");

  r.w.__mzShowTab("oracle");
  r.el("mw-hud-menu-btn").onclick();
  r.sandbox.context.hudMenuEvent("escape");
  assert.equal(r.sandbox.context.hudMenuIsOpen(), false);
  r.w.__mzShowTab("maze");
  assertDeathCardUp(r, "after the ☰ on the ORACLE tab");
});

test("HUD-02 (ruling 2026-09-27): a relaunch while dead shows the death card on the map", () => {
  // A relaunch is a fresh shell over the saved (JSON round-tripped) state.
  const saved = JSON.parse(JSON.stringify(deadState()));
  assert.equal(saved.dead, true);
  const r = boot(saved);
  assertDeathCardUp(r, "relaunched while dead");
});

test("HUD-02 (ruling 2026-09-27): the put-aside flag is gone; the death card has no hidden state of its own and none reaches S", () => {
  assert.doesNotMatch(CODE, /mwDeadMapAside/, "no put-aside flag in the shell");
  const r = boot(deadState());
  assert.equal(r.read("typeof mwDeadMapAside"), "undefined");
  r.w.__mzShowTab("oracle");
  r.w.__mzShowTab("maze");
  assert.equal(JSON.stringify(r.w.__mzState.get()).includes("Aside"), false);
});

test("HUD-02 (ruling 2026-09-27): with the death card up, a drag moves the camera and a pinch changes the zoom; neither touches the state", () => {
  for (const visitAway of [false, true]) {
    const r = boot(deadState());
    if (visitAway) {
      r.w.__mzShowTab("oracle");
      r.w.__mzShowTab("maze");
    }
    const why = visitAway ? "back from ORACLE" : "just died";
    assert.equal(r.el("enc-panel").hidden, false, `${why}: the card is up`);
    const before = JSON.stringify(r.w.__mzState.get());
    const cam0 = r.read("({ ...cam })");
    r.fire("pointerdown", { pointerId: 1, clientX: 100, clientY: 100 });
    r.fire("pointermove", { pointerId: 1, clientX: 180, clientY: 140 });
    r.fire("pointerup", { pointerId: 1, clientX: 180, clientY: 140 });
    assert.notDeepStrictEqual(r.read("({ ...cam })"), cam0, `${why}: the drag moved the camera`);

    const zoom0 = r.read("zoom");
    r.fire("pointerdown", { pointerId: 2, clientX: 100, clientY: 100 });
    r.fire("pointerdown", { pointerId: 3, clientX: 200, clientY: 100 });
    r.fire("pointermove", { pointerId: 3, clientX: 260, clientY: 100 });
    r.fire("pointerup", { pointerId: 3, clientX: 260, clientY: 100 });
    r.fire("pointerup", { pointerId: 2, clientX: 100, clientY: 100 });
    assert.notEqual(r.read("zoom"), zoom0, `${why}: the pinch changed the zoom`);

    assert.equal(JSON.stringify(r.w.__mzState.get()), before, `${why}: looking never touches S`);
    assert.deepStrictEqual(r.moves, []);
    assert.equal(r.el("enc-panel").hidden, false, `${why}: the card is still up`);
  }
});

test("HUD-02: on the dead map a tap and a hold act on nothing (no move, no inspect card)", () => {
  for (const visitAway of [false, true]) {
    const r = boot(deadState());
    if (visitAway) {
      r.w.__mzShowTab("oracle");
      r.w.__mzShowTab("maze");
    }
    const before = JSON.stringify(r.w.__mzState.get());
    r.fire("pointerdown", { pointerId: 1, clientX: 120, clientY: 120 });
    r.fire("pointerup", { pointerId: 1, clientX: 120, clientY: 120 });
    r.sandbox.context.tapStep(120, 120);
    r.sandbox.context.inspectAt(120, 120);
    assert.deepStrictEqual(r.moves, [], "a tap never steps");
    assert.deepStrictEqual(r.railLines, [], "a hold pushes no inspect card");
    assert.equal(JSON.stringify(r.w.__mzState.get()), before);
  }
});

// ─── the FINAL SHEET and the ways back (Task 3) ──────────────────────────

/** finalSheetFns(state) — the module script's own openFinalSheet/closeFinalSheet/
 * finalSheetOpen source, evaluated over a recording document, a fake
 * panelMotion and the REAL finalSheet.js exports (never a stub of the logic). */
function finalSheetFns(state) {
  const region = sliceBetween(CODE, "function finalSheetOpen()", "window.mzOpenFinalSheet = openFinalSheet;");
  const doc = createRecordingDocument();
  const sheet = doc.document.getElementById("mw-final-sheet");
  sheet.hidden = true;
  const panelMotion = { open: (el) => { el.hidden = false; }, close: (el) => { el.hidden = true; } };
  const fakeWindow = { __mzState: { get: () => state } };
  const make = new Function("window", "document", "panelMotion", "renderFinalSheet", "finalSheetViewModel", region + "\nreturn { finalSheetOpen, openFinalSheet, closeFinalSheet };");
  const fns = make(fakeWindow, doc.document, panelMotion, renderFinalSheet, finalSheetViewModel);
  return { ...fns, doc, sheet, body: doc.document.getElementById("mw-final-sheet-body") };
}

test("HUD-03: the FINAL SHEET opens only while the hero is dead, renders the run through finalSheet.js, and closes", () => {
  const live = finalSheetFns(liveState());
  live.openFinalSheet();
  assert.equal(live.finalSheetOpen(), false, "a live hero gets no final sheet");
  assert.equal(live.body.children.length, 0);

  const dead = deadState();
  const f = finalSheetFns(dead);
  f.openFinalSheet();
  assert.equal(f.finalSheetOpen(), true);
  const texts = [];
  const walk = (n) => {
    if (n.nodeType === 3) return;
    assert.notEqual(n.tagName, "button", "no control inside the sheet body");
    assert.equal(n.onclick, null);
    if (n._content.kind === "text") texts.push(n._content.value);
    for (const c of n.children) walk(c);
  };
  walk(f.body);
  assert.ok(texts.includes(dead.c.name));
  assert.ok(texts.includes(dead.epitaph));
  f.closeFinalSheet();
  assert.equal(f.finalSheetOpen(), false);
});

test("HUD-03 markup: #mw-final-sheet's only control is its Close button; the scrim and Close close it; window.mzOpenFinalSheet is its one opener", () => {
  const markup = sliceBetween(HTML, '<div id="mw-final-sheet"', '<div class="mw-final-sheet-body" id="mw-final-sheet-body"></div>');
  assert.equal((markup.match(/<button/g) || []).length, 1);
  assert.match(markup, /<button type="button" class="mw-legend-close" id="mw-final-sheet-close" aria-label="Close">Close<\/button>/);
  assert.match(CODE, /document\.getElementById\("mw-final-sheet-scrim"\)\?\.addEventListener\("click", closeFinalSheet\);/);
  assert.match(CODE, /document\.getElementById\("mw-final-sheet-close"\)\?\.addEventListener\("click", closeFinalSheet\);/);
  assert.equal((CODE.match(/window\.mzOpenFinalSheet = /g) || []).length, 1);
  assert.match(CODE, /import \{ finalSheetViewModel, renderFinalSheet \} from "\.\/src\/browser\/finalSheet\.js";/);
});

test("HUD-03 back button: hasOpenModal counts the FINAL SHEET and closeModal closes only it, right after the account sheet, the title panel and the ☰", () => {
  const ctx = sliceBetween(CODE, "getGameContext: () => ({", "navigateBack: () => {");
  const hasOpenModal = ctx.slice(ctx.indexOf("hasOpenModal:"), ctx.indexOf("hasLiveRun:"));
  assert.match(hasOpenModal, /finalSheetOpen\(\)/);
  const closeModal = sliceBetween(CODE, "closeModal: () => {", "\n        navigateBack: () => {");
  const acct = closeModal.indexOf("if (accountSheetOpen())");
  const title = closeModal.indexOf("if (boardsPanel.isTitleOpen())");
  const fs = closeModal.indexOf("if (finalSheetOpen()) { closeFinalSheet(); return; }");
  const menu = closeModal.indexOf('if (hudMenuIsOpen()) { hudMenuEvent("escape"); return; }');
  const gear = closeModal.indexOf("if (gearSheetTarget !== null)");
  assert.ok(acct < title && title < menu && menu < fs && fs < gear, "account, title panel, the ☰, then the final sheet, before anything touches S");
});

test("HUD-03 CSS: every class finalSheet.js emits has a rule, and long lines wrap instead of truncating", () => {
  for (const cls of FINAL_SHEET_CLASSES) assert.match(HTML, new RegExp(`\\.${cls}[{,:]`), `.${cls} has a CSS rule`);
  assert.match(HTML, /\.mw-fs-line,\.mw-fs-note,\.mw-fs-empty,\.mw-fs-epitaph\{[^}]*overflow-wrap:anywhere/);
  assert.doesNotMatch(HTML, /\.mw-fs-[\w-]+\{[^}]*text-overflow:ellipsis/);
});

test("HUD-02 no trap: while dead the death card offers ORACLE, FINAL SHEET and BURY THEM; the ☰ keeps SETTINGS, REPORT A BUG, PATCH NOTES, SAVE & QUIT and NEW CHARACTER live", () => {
  // Phase 79.3 (BUG-01 D-08, NOTES-02 D-20): REPORT A BUG and PATCH NOTES
  // join the always-live set — never disabled, dead or alive.
  const r = boot(deadState());
  for (const id of ["btn-death-oracle", "btn-death-sheet", "btn-death-confirm"]) assert.ok(r.doc.elementsById.get(id), `${id} is on the death card`);
  r.el("mw-hud-menu-btn").onclick();
  for (const id of ["mw-gear-btn", "mw-menu-report", "mw-menu-notes", "mw-menu-save-quit", "mw-menu-abandon"]) assert.ok(isLive(r.el(id)), `${id} live while dead`);
  for (const id of ["mw-chip-marks", "mw-chip-centre", "btn-camp"]) assert.ok(isDisabled(r.el(id)), `${id} inert while dead`);
  const confirm = sliceBetween(CODE, "function wireDeathConfirm()", "function foeStatusBadges(");
  assert.match(confirm, /guardTap\(btn, \(\) => \{\s*window\.mzReturnToTitle\(\);\s*\}\);/);
});

test("HUD-02 source pins: tapStep, inspectAt and the keyboard movement path all bail while dead; the viewport lets only a look start on the dead map (the card up, ruling 2026-09-27)", () => {
  const tap = sliceBetween(CODE, "function tapStep(clientX, clientY)", "function inspectAt(clientX, clientY)");
  assert.match(tap, /if \(!S \|\| hasActiveEncounter\(\)\) return;/);
  const inspect = sliceBetween(CODE, "function inspectAt(clientX, clientY)", "(function initMazeViewportControls()");
  assert.match(inspect, /if \(!S \|\| S\.dead\) return;/);
  const hae = sliceBetween(CODE, "function hasActiveEncounter()", "function railLocked()");
  assert.match(hae, /S\.dead \|\|/);
  const keys = sliceBetween(CODE, 'addEventListener("keydown"', 'addEventListener("resize"');
  const gate = keys.indexOf("if (S && hasActiveEncounter()) {");
  const step = keys.indexOf("if (dirKeys[k]) { e.preventDefault(); window.move(dirKeys[k]); return; }");
  assert.ok(gate !== -1 && step !== -1 && gate < step, "the keyboard's movement line sits after the encounter gate");
  const viewport = sliceBetween(CODE, "(function initMazeViewportControls()", 'addEventListener("keydown"');
  assert.match(viewport, /if \(!S \|\| \(hasActiveEncounter\(\) && !deadMapLookOnly\(\)\)\) return;/);
  const look = sliceBetween(CODE, "function deadMapLookOnly()", "\n}\n");
  assert.match(look, /return !!\(S && S\.dead\);/);
  const engineMove = sliceBetween(CODE, "window.move = function engineMove", "function stepNow(dir)");
  assert.match(engineMove, /if \(hasActiveEncounter\(\)\) return;/);
});
