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

test("HUD-02 (ruling 2026-09-26): the death card shows first; after a visit to ORACLE (or DEAD) the MAP shows the map where the hero died, and hasActiveEncounter() stays true", () => {
  for (const away of ["oracle", "dead"]) {
    const r = boot(deadState());
    assert.equal(r.el("enc-panel").hidden, false, "the death card shows when the death happens");
    r.w.__mzShowTab(away);
    r.w.__mzShowTab("maze");
    assert.equal(r.el("enc-panel").hidden, true, `after ${away}, the card is put aside`);
    assert.equal(r.sandbox.context.hasActiveEncounter(), true, "every input gate stays shut");
    r.sandbox.paint();
    assert.equal(r.el("enc-panel").hidden, true, "a repaint keeps the card put aside");
  }
});

test("HUD-02: the put-aside flag is presentation-only (never on S) and a live run clears it", () => {
  const r = boot(deadState());
  r.w.__mzShowTab("oracle");
  r.w.__mzShowTab("maze");
  assert.equal(r.read("mwDeadMapAside"), true);
  assert.equal(JSON.stringify(r.w.__mzState.get()).includes("Aside"), false);
  r.sandbox.setState(liveState());
  r.sandbox.paint();
  assert.equal(r.read("mwDeadMapAside"), false);
});

test("HUD-02: on the put-aside dead map, a drag moves the camera and a pinch changes the zoom; neither touches the state", () => {
  const r = boot(deadState());
  r.w.__mzShowTab("oracle");
  r.w.__mzShowTab("maze");
  const before = JSON.stringify(r.w.__mzState.get());
  const cam0 = r.read("({ ...cam })");
  r.fire("pointerdown", { pointerId: 1, clientX: 100, clientY: 100 });
  r.fire("pointermove", { pointerId: 1, clientX: 180, clientY: 140 });
  r.fire("pointerup", { pointerId: 1, clientX: 180, clientY: 140 });
  const cam1 = r.read("({ ...cam })");
  assert.notDeepStrictEqual(cam1, cam0, "the drag moved the camera");

  const zoom0 = r.read("zoom");
  r.fire("pointerdown", { pointerId: 2, clientX: 100, clientY: 100 });
  r.fire("pointerdown", { pointerId: 3, clientX: 200, clientY: 100 });
  r.fire("pointermove", { pointerId: 3, clientX: 260, clientY: 100 });
  r.fire("pointerup", { pointerId: 3, clientX: 260, clientY: 100 });
  r.fire("pointerup", { pointerId: 2, clientX: 100, clientY: 100 });
  assert.notEqual(r.read("zoom"), zoom0, "the pinch changed the zoom");

  assert.equal(JSON.stringify(r.w.__mzState.get()), before, "looking never touches S");
  assert.deepStrictEqual(r.moves, []);
});

test("HUD-02: while the death card covers the map, a drag does nothing (the card is not a map)", () => {
  const r = boot(deadState());
  const cam0 = r.read("({ ...cam })");
  r.fire("pointerdown", { pointerId: 1, clientX: 100, clientY: 100 });
  r.fire("pointermove", { pointerId: 1, clientX: 180, clientY: 140 });
  r.fire("pointerup", { pointerId: 1, clientX: 180, clientY: 140 });
  assert.deepStrictEqual(r.read("({ ...cam })"), cam0);
});

test("HUD-02: on the dead map a tap and a hold act on nothing (no move, no inspect card)", () => {
  const r = boot(deadState());
  r.w.__mzShowTab("oracle");
  r.w.__mzShowTab("maze");
  const before = JSON.stringify(r.w.__mzState.get());
  r.fire("pointerdown", { pointerId: 1, clientX: 120, clientY: 120 });
  r.fire("pointerup", { pointerId: 1, clientX: 120, clientY: 120 });
  r.sandbox.context.tapStep(120, 120);
  r.sandbox.context.inspectAt(120, 120);
  assert.deepStrictEqual(r.moves, [], "a tap never steps");
  assert.deepStrictEqual(r.railLines, [], "a hold pushes no inspect card");
  assert.equal(JSON.stringify(r.w.__mzState.get()), before);
});

test("HUD-02 source pins: tapStep, inspectAt and the keyboard movement path all bail while dead; the viewport lets only a look start on the put-aside dead map", () => {
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
  assert.match(look, /S\.dead && mwDeadMapAside/);
  const engineMove = sliceBetween(CODE, "window.move = function engineMove", "function stepNow(dir)");
  assert.match(engineMove, /if \(hasActiveEncounter\(\)\) return;/);
});
