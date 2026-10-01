// test/unit/shell-teleport-pick.test.js
//
// Phase 91 (IDENT-14), plan 91-04: the shell half of the Illusionist's
// teleport pick. Report #3: "I have a deserved illusionist. It says I choose
// where teleports takes me, but when I stepped on a teleport I didn't get to
// choose." The engine (91-03) holds a pending pick; this file runs
// mazeworld.html's REAL classic tapStep(), railLocked(), renderRail() and
// draw() in the shell sandbox over real engine states, plus the module
// script's own window.move and window.mzTeleportPick bodies (sliced out of the
// shipped source and evaluated in the sandbox, because the module script
// itself cannot run headless), and proves:
//
//   1. a map tap on a glowing square dispatches { type: "teleportPick", x, y }
//      in ARROWS mode and in TAP TO MOVE alike (the arrow-pad default never
//      blocks the pick), and the engine then lands the party there;
//   2. a tap on any other square (an unexplored one, the hero's own, a far
//      one) dispatches nothing and re-shows the card (railPulse), in both modes;
//   3. the pad and the keys (window.move) move nothing while the pick is open
//      and pulse the card; the engine's hold agrees;
//   4. LET IT CHOOSE dispatches { type: "teleportPick", auto: true } and
//      answers only a live pick (a second tap dispatches nothing);
//   5. railLocked() covers the pick, so the card is "locked", never body-tap
//      dismissible, and it comes back after a relaunch;
//   6. draw() lights exactly the squares teleportTargets lists (explored
//      squares only: fog stays fog), and nothing once the pick commits;
//   7. source pins for the wiring.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import vm from "node:vm";

import { applyAction } from "../../engine/engine.js";
import { newRun } from "../../engine/state.js";
import { GW, GH } from "../../engine/maze.js";
import { serializeRun, validateSave, rehydrate } from "../../engine/saveState.js";
import { teleportTargets } from "../../engine/movement.js";
import { screenToCell } from "../../src/browser/controls.js";
import { resolveStep, inspectCell, HOLD_MS, TAP_MAX_TRAVEL_PX, DIR_VECTORS } from "../../src/browser/tapStep.js";
import { MAP_PALETTE, MARK_GLYPHS } from "../../src/browser/mapMarks.js";
import { TELEPORT_CARD_COPY, teleportPickAction } from "../../src/browser/teleportCard.js";
import { stripJs } from "../../tools/ident-sweep.mjs";
import { createRecordingDocument } from "./harness/recordingDom.js";
import { createRecordingContext } from "./harness/recordingCanvas.js";
import { loadShellSandbox } from "./harness/shellSandbox.js";
import { setIdentityDials } from "./harness/identityDials.js";

setIdentityDials();

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8").replace(/\r\n/g, "\n");
const CODE = stripJs(HTML);

// ---------------------------------------------------------------- helpers

const wallGrid = () => Array.from({ length: GH }, () => Array.from({ length: GW }, () => ({ wall: true, seen: false, feat: null })));
const openCell = (g, x, y, extra = {}) => {
  g[y][x] = { wall: false, seen: false, feat: null, ...extra };
};

/** A real engine state with an Illusionist's pick OPEN: stepped onto a teleport square through applyAction. */
function pickOpen({ px = 7, py = 10, seed = 3 } = {}) {
  const state = newRun(seed, [], { force: { cls: "Magic User", sub: "Illusionist" } });
  const g = wallGrid();
  for (let y = 1; y <= GH - 2; y++) for (let x = 1; x <= GW - 2; x++) openCell(g, x, y, { seen: true });
  state.floor = { g, px, py, depth: 1 };
  state.combat = null;
  openCell(g, px, py - 1, { feat: "tele", seen: true });
  const out = applyAction(state, { type: "move", dir: "N" });
  assert.ok(out.state.pendingTeleport, "the engine opened a pick");
  return out.state;
}

/** Fogs every square, then explores exactly the listed [x, y] pairs. */
function exploreOnly(state, squares) {
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) state.floor.g[y][x].seen = false;
  for (const [x, y] of squares) state.floor.g[y][x].seen = true;
}

/**
 * boot(state, opts) — the REAL classic shell over `state`, the camera on the
 * party, the viewport 400x600. `settings` is the Movement bridge
 * ({ movement: "arrows" | "tap" }). `pulses` counts railPulse() calls;
 * `picks` records every window.mzTeleportPick call.
 */
function boot(state, { settings, stubDraw = true, canvasContext = null, stubRail = false } = {}) {
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc, reducedMotion: true, stubDraw, canvasContext, stubRail });
  const ctx = sandbox.context;
  const w = ctx.window;
  w.__mzControls = { screenToCell };
  w.__mzTapStep = { resolveStep, inspectCell, HOLD_MS, TAP_MAX_TRAVEL_PX, DIR_VECTORS };
  if (settings !== undefined) w.__mzSettings = settings;
  const pulses = [];
  const picks = [];
  const moves = [];
  ctx.railPulse = () => pulses.push("railPulse");
  w.mzTeleportPick = (pick) => picks.push(pick);
  w.move = (dir) => moves.push(dir);
  w.mzRailLine = () => {};
  sandbox.setState(state);
  doc.document.getElementById("mw-maze-viewport").getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 600, right: 400, bottom: 600, x: 0, y: 0 });
  ctx.centerMap();
  const CELL = vm.runInContext("CELL", ctx);
  /** The screen point at the centre of the cell `dx`, `dy` squares from the party. */
  const at = (dx, dy) => [200 + dx * CELL, 300 + dy * CELL];
  return { doc, sandbox, ctx, w, pulses, picks, moves, at, CELL };
}

/** A realm-neutral copy (objects built inside the vm sandbox carry the sandbox's own prototypes). */
const plain = (v) => JSON.parse(JSON.stringify(v));

/** Slices source text from `start` through the next "\n  };" (a module-script arrow/function body). */
function sliceFn(start) {
  const i = HTML.indexOf(start);
  assert.ok(i >= 0, `found: ${start}`);
  const j = HTML.indexOf("\n  };", i);
  assert.ok(j > i);
  return HTML.slice(i, j + "\n  };".length);
}

/**
 * Evaluates the SHIPPED window.mzTeleportPick body in the sandbox, with
 * stepWith replaced by `onStep` (the module's stepWith itself needs the whole
 * module script) and the pure teleportPickAction wired as the module imports it.
 */
function wireRealPick(r, onStep) {
  r.ctx.teleportPickAction = teleportPickAction;
  r.ctx.stepWith = onStep;
  vm.runInContext(sliceFn("window.mzTeleportPick = (pick) => {"), r.ctx);
}

/** Evaluates the SHIPPED window.move body (the one choke point the pad and the keys use). */
function wireRealMove(r, steps) {
  r.ctx.stepNow = (dir) => steps.push(dir);
  r.ctx.stepTargetsExit = () => false;
  vm.runInContext(sliceFn("window.move = function engineMove(dir) {"), r.ctx);
}

const MODES = [
  ["ARROWS", { movement: "arrows", padSide: "right" }],
  ["TAP TO MOVE", { movement: "tap", padSide: "right" }],
  ["unset (the tap default)", undefined],
];

// ---------------------------------------------------------------- 1. the map tap picks

test("Map tap: a tap on a glowing square dispatches { type: teleportPick, x, y } in ARROWS mode, in TAP TO MOVE and with no setting, and the engine lands the party there", () => {
  for (const [name, settings] of MODES) {
    const state = pickOpen();
    const r = boot(state, { settings });
    const target = teleportTargets(state).find((t) => t.dir === "E" && t.dist === 3);
    assert.ok(target, "a square three east is lit");
    const dispatched = [];
    wireRealPick(r, (action) => {
      dispatched.push(action);
      const out = applyAction(r.w.__mzState.get(), action);
      r.sandbox.setState(out.state);
    });
    // The real tapStep calls window.mzTeleportPick, which is the shipped body now.
    r.ctx.tapStep(...r.at(target.x - state.floor.px, target.y - state.floor.py));
    assert.deepStrictEqual(dispatched, [{ type: "teleportPick", x: target.x, y: target.y }], `${name}: one pick with the tapped square`);
    assert.deepStrictEqual(r.moves, [], `${name}: no plain move`);
    assert.deepStrictEqual(r.pulses, [], `${name}: no pulse on a real pick`);
    const after = r.w.__mzState.get();
    assert.equal(after.pendingTeleport, undefined, `${name}: the pick is committed`);
    assert.deepStrictEqual({ x: after.floor.px, y: after.floor.py }, { x: target.x, y: target.y }, `${name}: the party landed on the tapped square`);
  }
});

test("Map tap: the picked square is handed to window.mzTeleportPick as plain { x, y } (the spy sees exactly the lit square)", () => {
  for (const [name, settings] of MODES) {
    const state = pickOpen();
    const r = boot(state, { settings });
    const t = teleportTargets(state).find((q) => q.dir === "SE" && q.dist === 2);
    r.ctx.tapStep(...r.at(t.x - state.floor.px, t.y - state.floor.py));
    assert.deepStrictEqual(plain(r.picks), [{ x: t.x, y: t.y }], name);
    assert.equal(r.pulses.length, 0, name);
  }
});

// ---------------------------------------------------------------- 2. a stray tap never picks

test("Stray tap: a tap on an unexplored square, the hero's own square or a far one dispatches nothing and re-shows the card, in both movement modes", () => {
  for (const [name, settings] of MODES) {
    const state = pickOpen();
    // Fog one square that WOULD be in reach: raw reach has it, the pick does not (explored squares only).
    const fogged = { x: state.floor.px + 4, y: state.floor.py };
    state.floor.g[fogged.y][fogged.x].seen = false;
    assert.equal(teleportTargets(state).some((t) => t.x === fogged.x && t.y === fogged.y), false);
    const r = boot(state, { settings });
    const dx = (sq) => sq.x - state.floor.px;
    const dy = (sq) => sq.y - state.floor.py;
    r.ctx.tapStep(...r.at(dx(fogged), dy(fogged))); // fogged, in reach
    r.ctx.tapStep(...r.at(0, 0)); // the hero's own square
    r.ctx.tapStep(...r.at(13, 0)); // past the 12-square reach
    r.ctx.tapStep(...r.at(1, 2)); // off every ray: neither straight nor diagonal
    assert.deepStrictEqual(r.picks, [], `${name}: nothing dispatched`);
    assert.deepStrictEqual(r.moves, [], `${name}: no plain move`);
    assert.equal(r.pulses.length, 4, `${name}: each stray tap pulses the card`);
    assert.deepStrictEqual(r.w.__mzState.get().pendingTeleport, state.pendingTeleport, `${name}: the pick is still open`);
  }
});

test("Stray tap: with NO pick open a map tap behaves exactly as before (ARROWS: nothing; TAP: a step)", () => {
  const state = pickOpen();
  const committed = applyAction(state, { type: "teleportPick", auto: true }).state;
  assert.equal(committed.pendingTeleport, undefined);
  for (const [movement, expectMoves] of [["arrows", 0], ["tap", 1]]) {
    const r = boot(structuredClone(committed), { settings: { movement, padSide: "left" } });
    const f = r.w.__mzState.get().floor;
    // Make the east neighbour a seen floor square so tap mode steps.
    f.g[f.py][f.px + 1].wall = false;
    f.g[f.py][f.px + 1].seen = true;
    r.ctx.tapStep(...r.at(1, 0));
    assert.equal(r.moves.length, expectMoves, movement);
    assert.deepStrictEqual(r.picks, [], movement);
  }
});

test("Stray tap: a missing __mzMapView bridge lights and accepts nothing (a tap re-shows the card)", () => {
  const state = pickOpen();
  const r = boot(state, { settings: { movement: "arrows" } });
  r.w.__mzMapView = null;
  r.ctx.tapStep(...r.at(3, 0));
  assert.deepStrictEqual(r.picks, []);
  assert.equal(r.pulses.length, 1);
});

// ---------------------------------------------------------------- 3. the pad and the keys

test("Pad and keys: window.move (the choke point the pad and every key press funnel through) steps nothing while the pick is open and pulses the card, and without a pick it steps", () => {
  for (const dir of ["N", "E", "S", "W"]) {
    const state = pickOpen();
    const r = boot(state, { settings: { movement: "arrows", padSide: "right" } });
    const steps = [];
    const movePulses = [];
    r.w.mzRailPulse = () => movePulses.push(dir);
    wireRealMove(r, steps);
    r.w.move(dir);
    assert.deepStrictEqual(steps, [], `${dir}: no step while the pick is open`);
    assert.deepStrictEqual(movePulses, [dir], `${dir}: the card pulses`);

    // Control: the same real window.move on the committed state does step.
    const after = applyAction(state, { type: "teleportPick", auto: true }).state;
    r.sandbox.setState(after);
    r.w.move(dir);
    assert.deepStrictEqual(steps, [dir], `${dir}: steps once the pick is committed`);
  }
});

test("Pad and keys: the engine's own hold agrees (every move is the same state, no events, no draw) while the pick is open", () => {
  const state = pickOpen();
  for (const dir of ["N", "E", "S", "W"]) {
    const out = applyAction(state, { type: "move", dir });
    assert.strictEqual(out.state, state, `${dir}: the very same state object`);
    assert.deepStrictEqual(out.events, [], `${dir}: no events`);
  }
});

test("Pad and keys: the keydown path and the arrow pad both reach window.move, which sits behind railLocked (source order)", () => {
  const move = sliceFn("window.move = function engineMove(dir) {");
  assert.ok(move.indexOf("railLocked()") > 0 && move.indexOf("railLocked()") < move.indexOf("stepNow(dir)"), "railLocked() before the dispatch");
  assert.match(CODE, /if \(dirKeys\[k\]\) \{ e\.preventDefault\(\); window\.move\(dirKeys\[k\]\); return; \}/);
  assert.match(CODE, /window\.move\(dir\);/);
});

// ---------------------------------------------------------------- 4. LET IT CHOOSE

test("LET IT CHOOSE: window.mzTeleportPick({ auto: true }) dispatches { type: teleportPick, auto: true }, and a second tap after the landing dispatches nothing", () => {
  const state = pickOpen();
  const r = boot(state);
  const dispatched = [];
  wireRealPick(r, (action) => {
    dispatched.push(action);
    r.sandbox.setState(applyAction(r.w.__mzState.get(), action).state);
  });
  r.w.mzTeleportPick({ auto: true });
  assert.deepStrictEqual(dispatched, [{ type: "teleportPick", auto: true }]);
  assert.equal(r.w.__mzState.get().pendingTeleport, undefined, "the pick is committed");
  r.w.mzTeleportPick({ auto: true });
  r.w.mzTeleportPick({ x: 8, y: 9 });
  assert.equal(dispatched.length, 1, "no pick pending: nothing more dispatched");
});

test("LET IT CHOOSE: junk answers dispatch nothing, and an answer waits while the map is covered (a combat, a store)", () => {
  const state = pickOpen();
  const r = boot(state);
  const dispatched = [];
  wireRealPick(r, (a) => dispatched.push(a));
  for (const junk of [undefined, null, {}, { x: 1 }, { x: "7", y: "8" }, { auto: "yes" }, 5]) r.w.mzTeleportPick(junk);
  assert.deepStrictEqual(dispatched, []);
  r.sandbox.setState({ ...state, store: { stock: [] } });
  r.w.mzTeleportPick({ auto: true });
  assert.deepStrictEqual(dispatched, [], "an open store owns the screen");
});

test("LET IT CHOOSE: the rail button calls window.mzTeleportPick({ auto: true }) when pressed", () => {
  const state = pickOpen();
  const r = boot(state);
  r.w.__mzPendingNarration = null;
  r.ctx.renderRail();
  const btn = r.doc.document.getElementById("a-teleport-auto");
  assert.ok(btn, "the button is on the rail");
  assert.equal(btn.textContent, "LET IT CHOOSE");
  vm.runInContext("encRenderedAt = 0", r.ctx); // armed: the arm delay is the tap guard's own pin
  btn.onclick();
  assert.deepStrictEqual(plain(r.picks), [{ auto: true }]);
});

// ---------------------------------------------------------------- 5. the lock and the card

function railView(doc) {
  const d = doc.document;
  return {
    title: d.getElementById("mw-rail-title").textContent,
    lines: d.getElementById("mw-rail-lines").children.map((el) => el.textContent),
    buttons: d.getElementById("mw-rail-actions").children.map((b) => ({ id: b.id, label: b.textContent })),
    hidden: d.getElementById("mw-rail").hidden,
  };
}

test("Lock: railLocked() is true while S.pendingTeleport is set (out of a store), the rail's dismiss kind is locked, and it clears with the record", () => {
  const state = pickOpen();
  const r = boot(state);
  assert.equal(r.ctx.railLocked(), true);
  assert.equal(r.w.__mzRailVM.dismissKind(r.ctx.railLocked(), 1), "locked", "a body tap never dismisses the card");
  r.sandbox.setState({ ...state, store: { stock: [] } });
  assert.equal(r.ctx.railLocked(), false, "an open store owns the screen, not the card");
  const cleared = structuredClone(state);
  delete cleared.pendingTeleport;
  r.sandbox.setState(cleared);
  assert.equal(r.ctx.railLocked(), false);
});

test("Card: the real rail shows THE TELEPORT WAITS with the count line, the reach, the LET IT CHOOSE line and one button; the narration (when stashed) is what heads it", () => {
  const state = pickOpen();
  const n = teleportTargets(state).length;
  const r = boot(state);
  r.w.__mzPendingNarration = null;
  r.ctx.renderRail();
  const v = railView(r.doc);
  assert.equal(v.hidden, false);
  assert.equal(v.title, TELEPORT_CARD_COPY.title);
  assert.ok(v.lines[0].startsWith(`${n} squares glow`), v.lines[0]);
  assert.ok(v.lines.includes("Reach: up to 12 squares, straight or diagonal, explored floor only."));
  assert.ok(v.lines.some((t) => t.startsWith("LET IT CHOOSE:")));
  assert.deepStrictEqual(v.buttons, [{ id: "a-teleport-auto", label: "LET IT CHOOSE" }]);
});

test("Card: with no explored square in reach the card still shows, says so, and offers only LET IT CHOOSE", () => {
  const state = pickOpen();
  exploreOnly(state, []);
  assert.equal(teleportTargets(state).length, 0);
  const r = boot(state);
  r.w.__mzPendingNarration = null;
  r.ctx.renderRail();
  const v = railView(r.doc);
  assert.equal(v.lines[0], TELEPORT_CARD_COPY.intro.none);
  assert.deepStrictEqual(v.buttons.map((b) => b.label), ["LET IT CHOOSE"]);
});

test("Card: a relaunch with the pick open shows the same card (serializeRun, validateSave, rehydrate), and the card is gone once the pick commits", () => {
  const state = pickOpen();
  const first = boot(state);
  first.w.__mzPendingNarration = null;
  first.ctx.renderRail();
  const before = railView(first.doc);
  const json = JSON.stringify(serializeRun(state));
  for (const [name, restored] of [["validateSave", validateSave(json).value], ["rehydrate", rehydrate(JSON.parse(json))]]) {
    const r = boot(restored);
    r.w.__mzPendingNarration = null;
    r.ctx.renderRail();
    assert.deepStrictEqual(railView(r.doc), before, name);
    assert.equal(r.ctx.railLocked(), true, name);
  }
  const after = applyAction(state, { type: "teleportPick", auto: true }).state;
  const r2 = boot(after);
  r2.ctx.renderRail();
  assert.equal(railView(r2.doc).hidden, true, "no card once committed (the idle rail hides)");
  assert.equal(r2.ctx.railLocked(), false);
});

// ---------------------------------------------------------------- 6. the highlight

/** Fill and stroke calls tagged with the colour that was current when they were made. */
function paintTagged(r) {
  const fills = [];
  const strokes = [];
  const fillRect = r.canvas.fillRect;
  const strokeRect = r.canvas.strokeRect;
  r.canvas.fillRect = (...a) => {
    fills.push({ style: r.canvas.fillStyle, alpha: r.canvas.globalAlpha, args: a });
    return fillRect(...a);
  };
  r.canvas.strokeRect = (...a) => {
    strokes.push({ style: r.canvas.strokeStyle, alpha: r.canvas.globalAlpha, args: a });
    return strokeRect(...a);
  };
  r.canvas.calls.length = 0;
  r.ctx.draw();
  r.canvas.fillRect = fillRect;
  r.canvas.strokeRect = strokeRect;
  return {
    glowFills: fills.filter((f) => f.style === MAP_PALETTE.teleport),
    glowRings: strokes.filter((s) => s.style === MAP_PALETTE.teleport),
    calls: r.canvas.calls,
  };
}

function bootDraw(state, opts = {}) {
  const canvas = createRecordingContext();
  const r = boot(state, { ...opts, stubDraw: false, canvasContext: canvas });
  r.canvas = canvas;
  return r;
}

test("Highlight: draw() with a pending pick lights exactly the squares teleportTargets lists, each with one soft fill and one thin ring in the teleport palette, never an icon", () => {
  const state = pickOpen();
  const lit = teleportTargets(state);
  assert.ok(lit.length >= 8);
  const r = bootDraw(state);
  const { glowFills, glowRings, calls } = paintTagged(r);
  const CELL = r.CELL;
  assert.equal(glowFills.length, lit.length);
  assert.equal(glowRings.length, lit.length);
  const cellsOf = (list) => list.map((c) => `${Math.floor(c.args[0] / CELL)},${Math.floor(c.args[1] / CELL)}`).sort();
  const want = lit.map((t) => `${t.x},${t.y}`).sort();
  assert.deepStrictEqual(cellsOf(glowFills), want, "fills sit on the listed squares");
  assert.deepStrictEqual(cellsOf(glowRings), want, "rings sit on the listed squares");
  for (const f of glowFills) assert.ok(f.alpha > 0 && f.alpha < 0.5, `soft glow: alpha ${f.alpha}`);
  for (const s of glowRings) assert.ok(s.alpha > 0.5 && s.alpha <= 1, `ring: alpha ${s.alpha}`);
  const arcs = calls.filter((c) => c.op === "arc").length;
  assert.equal(arcs, 0, "no ripple, no dot: the glow is not an encounter mark");
  assert.equal(calls.filter((c) => c.op === "fillText").length, 0, "no glyph");
  assert.equal(calls.filter((c) => c.op === "save").length, calls.filter((c) => c.op === "restore").length, "the context is restored");
});

test("Highlight: explored squares only, fog stays fog: an unexplored square in reach is not lit and nothing is drawn on it", () => {
  const state = pickOpen();
  const fogged = { x: state.floor.px + 3, y: state.floor.py };
  state.floor.g[fogged.y][fogged.x].seen = false;
  const r = bootDraw(state);
  const { glowFills, glowRings } = paintTagged(r);
  const CELL = r.CELL;
  const onFogged = (c) => Math.floor(c.args[0] / CELL) === fogged.x && Math.floor(c.args[1] / CELL) === fogged.y;
  assert.equal(glowFills.filter(onFogged).length, 0);
  assert.equal(glowRings.filter(onFogged).length, 0);
  assert.equal(glowFills.length, teleportTargets(state).length);
  // With nothing explored in reach: no glow anywhere.
  const none = pickOpen();
  exploreOnly(none, []);
  const r2 = bootDraw(none);
  const t2 = paintTagged(r2);
  assert.equal(t2.glowFills.length + t2.glowRings.length, 0);
});

test("Highlight: no pick, no glow; the glow is gone on the first paint after the pick commits; draw() never touches the state", () => {
  const state = pickOpen();
  const r = bootDraw(state);
  assert.ok(paintTagged(r).glowFills.length > 0, "lit while the pick is open");
  const json = JSON.stringify(r.w.__mzState.get());
  paintTagged(r);
  assert.equal(JSON.stringify(r.w.__mzState.get()), json, "draw never mutates");
  const after = applyAction(state, { type: "teleportPick", auto: true }).state;
  r.sandbox.setState(after);
  const t = paintTagged(r);
  assert.equal(t.glowFills.length + t.glowRings.length, 0, "gone on the first paint after the pick commits");
  const plain = bootDraw(after);
  assert.equal(paintTagged(plain).glowFills.length, 0, "a fresh paint of a state with no pick");
});

test("Highlight: a missing bridge (or one without teleportTargets) draws no glow and never throws", () => {
  const state = pickOpen();
  const r = bootDraw(state);
  r.w.__mzMapView = { mapViewRadius: () => Infinity, inViewWindow: () => true };
  assert.equal(paintTagged(r).glowFills.length, 0);
  r.w.__mzMapView = null;
  assert.equal(paintTagged(r).glowFills.length, 0);
});

test("Highlight: the palette entry is a hex distinct from the fog, the floor, the encounter mark, the heard ripple, the party and the teleport tile's violet", () => {
  assert.match(MAP_PALETTE.teleport, /^#[0-9a-fA-F]{6}$/);
  assert.equal(Object.isFrozen(MAP_PALETTE), true);
  for (const other of [MAP_PALETTE.fog, MAP_PALETTE.floor, MAP_PALETTE.wall, MAP_PALETTE.water, MAP_PALETTE.heard, MAP_PALETTE.party, MARK_GLYPHS.encounter.color, MARK_GLYPHS.trap.color, MARK_GLYPHS.teleport.color]) {
    assert.notEqual(MAP_PALETTE.teleport.toLowerCase(), other.toLowerCase());
  }
  assert.match(CODE, new RegExp(`teleport: "${MAP_PALETTE.teleport}"`), "draw()'s fallback palette literal carries the same hex");
});

// ---------------------------------------------------------------- 7. source pins

test("Source: tapStep hands a tap to the pick first (right after the encounter gate, before the arrow-mode gate and the rail lock), and the pick calls mzTeleportPick or pulses", () => {
  const tap = CODE.slice(CODE.indexOf("function tapStep(clientX, clientY)"), CODE.indexOf("function inspectAt(clientX, clientY)"));
  const order = ["if (!S || hasActiveEncounter()) return;", "if (S.pendingTeleport) { tapTeleportPick(clientX, clientY); return; }", "if (tapMovementOff()) return;", "railLocked()"];
  let cursor = -1;
  for (const literal of order) {
    const idx = tap.indexOf(literal);
    assert.ok(idx > cursor, `"${literal}" in order`);
    cursor = idx;
  }
  const pick = CODE.slice(CODE.indexOf("function tapTeleportPick(clientX, clientY)"), CODE.indexOf("function tapStep(clientX, clientY)"));
  const pickOrder = ["view.teleportTargets(S)", "window.__mzControls.screenToCell(clientX, clientY, vpRect,", "window.mzTeleportPick({ x: hit.x, y: hit.y })", "else railPulse();"];
  cursor = -1;
  for (const literal of pickOrder) {
    const idx = pick.indexOf(literal);
    assert.ok(idx > cursor, `"${literal}" in order`);
    cursor = idx;
  }
  assert.doesNotMatch(pick, /tapMovementOff|movement|mw-arrow-pad/, "the pick never reads the Movement setting");
});

test("Source: the wiring: imports on their own lines, both bridges, railLocked, renderRail's first branch, the narration stash, draw()'s glow and mzTeleportPick", () => {
  const count = (re) => (CODE.match(re) || []).length;
  assert.equal(count(/import \{ teleportTargets \} from "\.\/engine\/movement\.js";/g), 1);
  assert.equal(count(/import \{ teleportCardViewModel, teleportPickAction \} from "\.\/src\/browser\/teleportCard\.js";/g), 1);
  assert.equal(count(/import \{ nightlyEats \} from "\.\/engine\/movement\.js";/g), 1, "the pinned nightlyEats line is untouched");
  assert.match(CODE, /teleportCard: teleportCardViewModel/);
  const lock = CODE.slice(CODE.indexOf("function railLocked()"), CODE.indexOf("let encRenderedAt = 0;"));
  assert.match(lock, /\(S\.pendingTeleport && !S\.store\)/);
  assert.match(CODE, /const tp = S\.pendingTeleport && vm\.teleportCard \? vm\.teleportCard\(S\) : null;/);
  const tpRegion = CODE.slice(CODE.indexOf("if (tp) {"), CODE.indexOf("} else if (hz) {"));
  assert.match(tpRegion, /key = tp\.key;/);
  assert.match(tpRegion, /\.\.\.tp\.lines/);
  assert.match(tpRegion, /tp\.intro/);
  assert.match(tpRegion, /window\.__mzPendingNarration/);
  assert.match(tpRegion, /onTap: \(\) => window\.mzTeleportPick\(\{ auto: true \}\)/);
  assert.doesNotMatch(tpRegion, /window\.move\(/);
  assert.match(CODE, /state\.pendingJoiner \|\| state\.pendingFind \|\| state\.pendingHazard \|\| state\.pendingTeleport/);
  const draw = CODE.slice(CODE.indexOf("function draw() {"), CODE.indexOf("positionCanvas();\n}", CODE.indexOf("function draw() {")));
  assert.equal(count(/paintTeleportPick\(ctx, P, view\);/g), 1, "draw() calls the glow once");
  assert.match(draw, /paintTeleportPick\(ctx, P, view\);/);
  assert.ok(draw.indexOf("view.heardSquares(S)") < draw.indexOf("paintTeleportPick(ctx, P, view);"), "after the heard ripple");
  const glow = CODE.slice(CODE.indexOf("function paintTeleportPick(ctx, P, view) {"), CODE.indexOf("function draw() {"));
  assert.match(glow, /S\.pendingTeleport && view && typeof view\.teleportTargets === "function" \? view\.teleportTargets\(S\) : \[\]/);
  assert.match(glow, /ctx\.fillStyle = P\.teleport;/);
  assert.match(glow, /ctx\.strokeStyle = P\.teleport;/);
  const pick = sliceFn("window.mzTeleportPick = (pick) => {");
  assert.match(pick, /teleportPickAction\(window\.__mzState\.get\(\), pick\)/);
  assert.match(pick, /if \(!action \|\| hasActiveEncounter\(\)\) return;/);
  assert.match(pick, /stepWith\(action\);/);
  assert.ok(count(/mzTeleportPick/g) >= 3);
  assert.ok(count(/teleportTargets/g) >= 3);
  assert.ok(count(/pendingTeleport/g) >= 4);
});
