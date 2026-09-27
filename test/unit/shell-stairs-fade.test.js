// test/unit/shell-stairs-fade.test.js
//
// Phase 78 (HUD-06), Plan 08, Task 2 — the stairs descent's fade wired into
// mazeworld.html (source pins plus node:vm runs of the real shipped code):
//   (a) the #mw-fade overlay: body-level, black, aria-hidden, idle at rest,
//       takes taps only while a phase runs; the one reduced-motion query
//   (b) dispatchWithNarration: a floorChanged dispatch starts the fade after
//       the stairs clip and before the rail card; a plain step, a teleport
//       and a reduced-motion descent never show black
//   (c) the input lock: window.move refuses while the fade runs
//   (d) classic draw() holds the old floor while darkening
//   (e) classic renderRail keeps every card hidden until the fade-in ends,
//       and the card's hold counts from the reveal
//   (f) scope: hasActiveEncounter untouched; dev start and boot never fade;
//       stepWith centres only on a teleport

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import vm from "node:vm";

import { createStairsFade, STAIRS_FADE_MS } from "../../src/browser/stairsFade.js";
import { createFakeClock } from "./harness/fakeClock.js";
import { createRecordingDocument } from "./harness/recordingDom.js";
import { createRecordingContext } from "./harness/recordingCanvas.js";
import { loadShellSandbox } from "./harness/shellSandbox.js";
import { newRun } from "../../engine/state.js";
import { railPush, emptyRail, RAIL_HOLD, holdForCard } from "../../src/browser/rail.js";
import { stripJs } from "../../tools/ident-sweep.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8").replace(/\r\n/g, "\n");
const CODE = stripJs(HTML);
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
  return source.slice(start, end);
}
const count = (source, literal) => source.split(literal).length - 1;

// ─── (a) the overlay ────────────────────────────────────────────────────────

test("(a) #mw-fade: one body-level overlay, before #app, aria-hidden, idle at rest", () => {
  assert.equal(count(MARKUP, 'id="mw-fade"'), 1);
  assert.match(MARKUP, /<div class="mw-fade" id="mw-fade" data-phase="idle" aria-hidden="true"><\/div>\s*<div id="app" class="mw-app">/);
});

test("(a) CSS: fixed, full screen, black, above every sheet; taps pass at rest and are swallowed while out or in; 0.6s out, 0.4s in", () => {
  const rest = STYLE.match(/\.mw-fade\{([^}]*)\}/);
  assert.ok(rest, ".mw-fade rule not found");
  assert.match(rest[1], /position:fixed/);
  assert.match(rest[1], /inset:0/);
  assert.match(rest[1], /background:#000/);
  assert.match(rest[1], /opacity:0/);
  assert.match(rest[1], /pointer-events:none/);
  const z = Number(rest[1].match(/z-index:(\d+)/)[1]);
  const others = [...STYLE.matchAll(/z-index:(\d+)/g)].map((m) => Number(m[1])).filter((n) => n !== z);
  assert.ok(others.every((n) => n < z), `the fade (${z}) sits above every other layer (max ${Math.max(...others)})`);
  const out = STYLE.match(/\.mw-fade\[data-phase="out"\]\{([^}]*)\}/)[1];
  assert.match(out, /opacity:1/);
  assert.match(out, /pointer-events:auto/);
  assert.match(out, new RegExp(`transition:opacity \\.${STAIRS_FADE_MS.out / 100}s`));
  const inn = STYLE.match(/\.mw-fade\[data-phase="in"\]\{([^}]*)\}/)[1];
  assert.match(inn, /opacity:0/);
  assert.match(inn, /pointer-events:auto/);
  assert.match(inn, new RegExp(`transition:opacity \\.${STAIRS_FADE_MS.in / 100}s`));
});

test("(a) still exactly one prefers-reduced-motion media query in the file (the controller, not CSS, makes the instant cut)", () => {
  assert.equal(count(STYLE, "@media (prefers-reduced-motion"), 1);
});

test("(a) the module builds the fade with the shared reduced predicate and a data-phase writer, and settleAllMotion cancels it", () => {
  assert.match(CODE, /import \{ createStairsFade \} from "\.\/src\/browser\/stairsFade\.js";/);
  const build = sliceBetween(CODE, "window.__mzStairsFade = createStairsFade({", "});");
  assert.match(build, /document\.getElementById\("mw-fade"\)/);
  assert.match(build, /el\.dataset\.phase = phase/);
  assert.match(build, /reduced: \(\) => prefersReducedMotion\(window\)/);
  const settle = sliceBetween(CODE, "function settleAllMotion() {", "\n  }");
  assert.match(settle, /window\.__mzStairsFade\?\.cancel\?\.\(\);/);
});

// ─── (b) dispatchWithNarration ─────────────────────────────────────────────

/**
 * bootDispatch({ events, reduced }) — runs the REAL dispatchWithNarration
 * source in a vm over stubbed collaborators, with the REAL fade controller
 * on a fake clock. `log` records the order of audio, fade phases, draws,
 * centres, card pushes and rail renders (with the fade's active() at each
 * render).
 */
function bootDispatch({ events, reduced = false }) {
  const src = sliceBetween(CODE, "function dispatchWithNarration(action, opts = {}) {", "\n  function stepTargetsExit(");
  const clock = createFakeClock();
  const log = [];
  let S = { floor: { depth: 1, px: 1, py: 1, g: [] } };
  const next = { floor: { depth: 2, px: 3, py: 3, g: [] } };
  const fade = createStairsFade({
    setPhase: (p) => log.push(`phase:${p}`),
    reduced: () => reduced,
    schedule: clock.setTimeout,
    cancel: clock.clearTimeout,
  });
  const win = {
    __mzState: { get: () => S, set: (v) => { S = v; } },
    __mzStairsFade: fade,
    __mzRail: emptyRail(),
    draw: () => log.push(`draw:${S.floor.depth}`),
    mzCenterMap: () => log.push(`centre:${S.floor.depth}`),
    renderRail: () => log.push(`renderRail:${fade.active() ? "active" : "idle"}`),
  };
  const context = vm.createContext({
    window: win,
    dispatch: () => ({ state: next, events, html: [] }),
    takeDeathRecord: () => null,
    newBestView: (x) => x,
    NARRATIVE_ACTIONS: new Set(["move"]),
    narrateEvent: () => "",
    moveCost: () => 1,
    cuesForDispatch: () => [],
    playForDispatch: (type, evs) => log.push(`audio:${evs.map((e) => e.type).join(",")}`),
    fightLogLinesFor: () => [],
    linesForAction: () => [],
    railCardFor: (type, evs) => (evs.some((e) => e.type === "floorChanged") ? { title: "FLOOR 2", lines: [] } : null),
    railPush: (rail, card) => {
      log.push(`push:${card.title}`);
      return railPush(rail, { icon: "▼", iconKey: null, tone: "odd", hold: RAIL_HOLD.default, ...card });
    },
    appendFightLog: (x) => x,
  });
  vm.runInContext(src + "\nwindow.__dwn = dispatchWithNarration;", context, { filename: "mazeworld.html#dispatchWithNarration" });
  return { run: (action) => win.__dwn(action), log, clock, fade, getS: () => S };
}

test("(b) a floorChanged dispatch: the stairs clip plays, then the fade starts, then the FLOOR card is pushed with the rail still held", () => {
  const r = bootDispatch({ events: [{ type: "moved" }, { type: "floorChanged", depth: 2 }] });
  r.run({ type: "move", dir: "N" });
  assert.deepEqual(r.log, ["audio:moved,floorChanged", "phase:out", "push:FLOOR 2", "renderRail:active"]);
  assert.equal(r.fade.active(), true);
  assert.equal(r.fade.holding(), true);
  assert.equal(r.getS().floor.depth, 2, "S already holds the new state for the dark point");
});

test("(b) the dark point draws and centres the new floor; the fade-in's end re-renders the rail with the fade idle", () => {
  const r = bootDispatch({ events: [{ type: "floorChanged", depth: 2 }] });
  r.run({ type: "move", dir: "N" });
  r.log.length = 0;
  r.clock.advance(STAIRS_FADE_MS.out + 16);
  assert.deepEqual(r.log, ["draw:2", "centre:2", "phase:in"]);
  r.log.length = 0;
  r.clock.advance(STAIRS_FADE_MS.in + 16);
  assert.deepEqual(r.log, ["phase:idle", "renderRail:idle"]);
  assert.equal(r.fade.active(), false);
});

test("(b) a plain step and a teleport never start the fade (a teleport keeps today's snap)", () => {
  for (const events of [[{ type: "moved" }], [{ type: "teleported" }], []]) {
    const r = bootDispatch({ events });
    r.run({ type: "move", dir: "E" });
    assert.ok(!r.log.some((l) => l.startsWith("phase:")), JSON.stringify(r.log));
    assert.equal(r.fade.active(), false);
  }
});

test("(b) reduced motion: an instant cut (never out or in), the new floor drawn and centred at once, and the stairs clip still plays", () => {
  const r = bootDispatch({ events: [{ type: "floorChanged", depth: 2 }], reduced: true });
  r.run({ type: "move", dir: "N" });
  assert.deepEqual(r.log, ["audio:floorChanged", "phase:idle", "draw:2", "centre:2", "renderRail:idle", "push:FLOOR 2", "renderRail:idle"]);
  assert.equal(r.fade.active(), false);
  assert.equal(r.clock.pending(), 0);
});

test("(b) the fade has ONE start site, inside dispatchWithNarration (the shell's only dispatch call site)", () => {
  assert.equal(count(CODE, "__mzStairsFade.start("), 1);
  const body = sliceBetween(CODE, "function dispatchWithNarration(action, opts = {}) {", "\n  function stepTargetsExit(");
  assert.match(body, /__mzStairsFade\.start\(/);
  assert.equal(count(CODE, " dispatch(action)"), 1, "dispatch() is called only from dispatchWithNarration");
});

// ─── (c) the input lock ────────────────────────────────────────────────────

function bootEngineMove({ active }) {
  const src = sliceBetween(CODE, "window.move = function engineMove(dir) {", "\n  window.mzUseTool");
  const calls = [];
  const win = {
    __mzStairsFade: { active: () => active },
    mzRailPulse: () => calls.push("pulse"),
    renderEncounter: () => calls.push("renderEncounter"),
  };
  const context = vm.createContext({
    window: win,
    hasActiveEncounter: () => false,
    encounterSettled: () => true,
    railLocked: () => false,
    stepTargetsExit: () => false,
    stepNow: (dir) => calls.push(`step:${dir}`),
  });
  vm.runInContext(src, context, { filename: "mazeworld.html#engineMove" });
  return { move: win.move, calls };
}

test("(c) window.move refuses every direction while the fade runs (the keyboard, a queued tap-step and the arrow pad all funnel through it)", () => {
  const locked = bootEngineMove({ active: true });
  for (const d of ["N", "E", "S", "W"]) locked.move(d);
  assert.deepEqual(locked.calls, []);
  const free = bootEngineMove({ active: false });
  free.move("N");
  assert.deepEqual(free.calls, ["step:N"]);
});

test("(c) the fade check is window.move's FIRST gate, ahead of the encounter gate", () => {
  const body = sliceBetween(CODE, "window.move = function engineMove(dir) {", "\n  window.mzUseTool");
  const fadeAt = body.indexOf("window.__mzStairsFade?.active?.()");
  assert.ok(fadeAt !== -1);
  assert.ok(fadeAt < body.indexOf("hasActiveEncounter()"));
});

// ─── (d) draw() holds the old floor ────────────────────────────────────────

test("(d) classic draw() paints nothing while the fade is darkening, and paints again once the dark point has passed", () => {
  const clock = createFakeClock();
  const ctx = createRecordingContext();
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc, reducedMotion: false, clock, stubDraw: false, canvasContext: ctx });
  sandbox.setState(newRun(3));
  const fade = sandbox.context.window.__mzStairsFade;
  const drawn = () => ctx.calls.length;

  ctx.calls.length = 0;
  sandbox.context.draw();
  assert.ok(drawn() > 0, "draw() paints normally");

  fade.start(() => {}, () => {});
  assert.equal(fade.holding(), true);
  ctx.calls.length = 0;
  sandbox.context.draw();
  assert.equal(drawn(), 0, "the old floor stays on the canvas while darkening");
  assert.equal(doc.document.getElementById("mw-fade").dataset.phase, "out");

  clock.advance(STAIRS_FADE_MS.out + 16);
  assert.equal(fade.holding(), false);
  ctx.calls.length = 0;
  sandbox.context.draw();
  assert.ok(drawn() > 0, "the fade-in shows the new floor");
  clock.advance(STAIRS_FADE_MS.in + 16);
  assert.equal(doc.document.getElementById("mw-fade").dataset.phase, "idle");
});

// ─── (e) the rail waits for the fade-in ────────────────────────────────────

test("(e) a card pushed during the fade stays hidden until the fade-in ends; its full hold counts from the reveal", () => {
  const clock = createFakeClock();
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc, reducedMotion: false, clock, stubRail: false });
  sandbox.setState(newRun(5));
  const w = sandbox.context.window;
  const fade = w.__mzStairsFade;
  const railEl = doc.document.getElementById("mw-rail");

  fade.start(() => {}, () => w.renderRail());
  const card = { icon: "▼", iconKey: null, title: "FLOOR 2", lines: [{ text: "The air gets worse.", roll: null }], tone: "odd", hold: RAIL_HOLD.floor };
  w.__mzRail = railPush(w.__mzRail || emptyRail(), card);
  w.renderRail();
  assert.equal(railEl.hidden, true, "hidden under black");
  assert.equal(railEl.dataset.shown, "0");

  clock.advance(STAIRS_FADE_MS.out + 16);
  w.renderRail(); // a repaint during the fade-in
  assert.equal(railEl.hidden, true, "still hidden while fading in");

  clock.advance(STAIRS_FADE_MS.in + 16);
  assert.equal(fade.active(), false);
  assert.equal(railEl.hidden, false, "revealed by the fade's onDone");
  assert.equal(railEl.dataset.shown, "1");
  assert.equal(doc.document.getElementById("mw-rail-title").textContent, "FLOOR 2");

  // The hold (after the typing) is counted from the reveal, never from the
  // push: the card is still up just short of typing + hold after reveal.
  const hold = holdForCard(w.__mzRail.card);
  const typing = 700; // typewriter.js's per-block cap bounds the typing time
  clock.advance(hold - 50);
  assert.ok(w.__mzRail.card, "still up inside its hold");
  clock.advance(typing + 200);
  assert.equal(w.__mzRail.card, null, "cleared once its hold has run");
});

test("(e) renderRail: the fade joins the ONE hidden predicate; its branch follows the data-shown write and returns before the isNew bookkeeping", () => {
  const body = sliceBetween(CODE, "function renderRail() {", "\nfunction syncRailLive(");
  assert.match(body, /const fadeUp = !!window\.__mzStairsFade\?\.active\?\.\(\);/);
  assert.match(body, /railEl\.hidden = !!\(\(S\.combat && !combatCardUp\) \|\| S\.dead\) \|\| idle \|\| fadeUp;/);
  const shownAt = body.indexOf('railEl.dataset.shown = railEl.hidden ? "0" : "1";');
  const fadeAt = body.indexOf("if (fadeUp) {");
  const isNewAt = body.indexOf("const isNew = key !== lastRailKeyShown;");
  assert.ok(shownAt !== -1 && fadeAt > shownAt && fadeAt < isNewAt);
  const branch = sliceBetween(body, "if (fadeUp) {", "return;");
  assert.match(branch, /lastRailKeyShown = "";/);
  assert.match(branch, /clearTimeout\(railTimer\);/);
});

// ─── (f) scope ─────────────────────────────────────────────────────────────

test("(f) hasActiveEncounter() is untouched (it also decides whether the encounter overlay shows)", () => {
  const body = sliceBetween(CODE, "function hasActiveEncounter() {", "\n}\n");
  assert.doesNotMatch(body, /StairsFade|mw-fade/);
});

test("(f) the dev start-at-depth run, the rolled-run commit and boot never fade (they dispatch no floorChanged)", () => {
  const dev = sliceBetween(CODE, "window.mzDevStartAtDepth = async function devStartAtDepth(depth) {", "\n  };");
  const commit = sliceBetween(CODE, "function commitRolledState(state) {", "\n  }");
  for (const body of [dev, commit]) assert.doesNotMatch(body, /StairsFade|dispatchWithNarration/);
});

test("(f) stepWith centres only on a teleport; a floor change centres at the fade's dark point; neither glides", () => {
  const body = sliceBetween(CODE, "function stepWith(action) {", "\n  function stepNow(");
  assert.match(body, /const descended = events\.some\(\(e\) => e\.type === "floorChanged"\);/);
  assert.match(body, /if \(jumped && !descended\) window\.mzCenterMap\?\.\(\);/);
  assert.match(body, /if \(!jumped && glideFrom/);
});
