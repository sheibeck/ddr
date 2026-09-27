// test/unit/shell-hearing.test.js
//
// Phase 78 (HUD-07), plan 78-09 — the shell half of Acute Hearing's "hear
// the next room" (user ruling 2026-09-26, option A). The engine read
// (engine/derived.js#heardSquares) is covered by heard-squares.test.js; this
// file runs mazeworld.html's REAL classic draw() and inspectAt() in the shell
// sandbox over a recording canvas and proves:
//
//   1. a hero with Acute Hearing and an unseen dot 3 squares away gets the
//      ripple (three stroked P.heard arcs) centred on that cell, and nothing
//      else draws there (no glyph, no icon);
//   2. no ripple without the skill, and none on a dot the map shows;
//   3. the ripple is gone on the next paint once the square is revealed or
//      its encounter resolves;
//   4. a hold on a heard square reports the HEARD card and names nothing
//      (no mark glyph, no feature row);
//   5. the MARKS sheet's HEARD row draws the CSS ripple swatch, not a PNG;
//   6. source pins: the separate import line, the bridge, and draw() reading
//      heardSquares through window.__mzMapView.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { createRecordingDocument } from "./harness/recordingDom.js";
import { loadShellSandbox } from "./harness/shellSandbox.js";
import { createRecordingContext } from "./harness/recordingCanvas.js";
import { newRun } from "../../engine/state.js";
import { GW, GH } from "../../engine/maze.js";
import { inspectCell } from "../../src/browser/tapStep.js";
import { RAIL_COPY } from "../../src/browser/rail.js";
import { MAP_PALETTE } from "../../src/browser/mapMarks.js";
import { stripJs } from "../../tools/ident-sweep.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8").replace(/\r\n/g, "\n");
const CODE = stripJs(HTML);

const CELL = 28; // the classic script's declared default — fit() never runs here
const PX = 10, PY = 10;

/** A real newRun state on a cleared floor: open, unseen, featureless ground,
 * the party at (10,10) with the 3x3 around it seen, lit. */
function hearingState({ hearing = true } = {}) {
  const s = newRun(7);
  s.c.skills = { ...(s.c.skills || {}) };
  if (hearing) s.c.skills["Acute Hearing"] = 1;
  else delete s.c.skills["Acute Hearing"];
  s.c.darkFor = 0;
  const g = s.floor.g;
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) g[y][x] = { wall: false, seen: false, feat: null, dark: false };
  s.floor.px = PX;
  s.floor.py = PY;
  for (let y = PY - 1; y <= PY + 1; y++) for (let x = PX - 1; x <= PX + 1; x++) g[y][x].seen = true;
  return s;
}

function boot(state) {
  const doc = createRecordingDocument();
  const ctx = createRecordingContext();
  const sandbox = loadShellSandbox({ doc, reducedMotion: true, stubDraw: false, canvasContext: ctx });
  const w = sandbox.context.window;
  const railLines = [];
  w.mzRailLine = (...args) => railLines.push(args);
  sandbox.setState(state);
  const paint = () => {
    ctx.calls.length = 0;
    sandbox.context.draw();
    return ctx.calls;
  };
  return { sandbox, ctx, w, doc, railLines, paint };
}

/** The arc calls centred on cell (x, y). */
function arcsAt(calls, x, y) {
  const cx = x * CELL + CELL / 2, cy = y * CELL + CELL / 2;
  return calls.filter((c) => c.op === "arc" && c.args[0] === cx && c.args[1] === cy);
}
const allArcs = (calls) => calls.filter((c) => c.op === "arc");

test("HUD-07 draw(): a hero with Acute Hearing and an unseen dot 3 squares away draws three faint rings centred on that cell, and no icon there", () => {
  const s = hearingState();
  s.floor.g[PY - 3][PX + 3].feat = "dot";
  const r = boot(s);
  const calls = r.paint();
  const arcs = arcsAt(calls, PX + 3, PY - 3);
  assert.equal(arcs.length, 3, "three rings");
  const radii = arcs.map((a) => a.args[2]);
  assert.ok(radii[0] < radii[1] && radii[1] < radii[2], "concentric, growing");
  assert.ok(radii[2] < CELL / 2, "the rings stay inside the cell");
  for (const a of arcs) assert.ok(a.alpha > 0 && a.alpha < 0.5, `faint: alpha ${a.alpha}`);
  assert.equal(allArcs(calls).length, 3, "no ring anywhere else");
  const iconAt = r.ctx.imageDraws().filter((d) => d.x >= (PX + 3) * CELL && d.x < (PX + 4) * CELL && d.y >= (PY - 3) * CELL && d.y < (PY - 2) * CELL);
  assert.deepEqual(iconAt, [], "the encounter icon never draws on a heard square");
  assert.equal(calls.filter((c) => c.op === "fillText").length, 0, "no glyph");
  // the context is restored, so later paints are not faded
  const saves = calls.filter((c) => c.op === "save").length;
  const restores = calls.filter((c) => c.op === "restore").length;
  assert.equal(saves, restores);
});

test("HUD-07 draw(): the rings stroke the parchment MAP_PALETTE.heard tone", () => {
  const s = hearingState();
  s.floor.g[PY][PX + 2].feat = "dot";
  const r = boot(s);
  // the recording context keeps strokeStyle as plain state; capture it at each stroke
  const seen = [];
  const stroke = r.ctx.stroke;
  r.ctx.stroke = (...a) => { seen.push(r.ctx.strokeStyle); return stroke(...a); };
  r.paint();
  assert.equal(seen.length, 3);
  for (const style of seen) assert.equal(style, MAP_PALETTE.heard);
});

test("HUD-07 draw(): no ripple without the skill, none on a dot the map shows, none on a trap or chest", () => {
  const without = hearingState({ hearing: false });
  without.floor.g[PY][PX + 3].feat = "dot";
  assert.equal(allArcs(boot(without).paint()).length, 0, "no skill, no ripple");

  const shown = hearingState();
  shown.floor.g[PY][PX + 2].feat = "dot";
  shown.floor.g[PY][PX + 2].seen = true;
  assert.equal(allArcs(boot(shown).paint()).length, 0, "a shown dot is not heard");

  const silent = hearingState();
  silent.floor.g[PY][PX + 2].feat = "trap";
  silent.floor.g[PY + 2][PX].feat = "chest";
  assert.equal(allArcs(boot(silent).paint()).length, 0, "traps and chests are silent");
});

test("HUD-07 draw(): the ripple is gone on the next paint once the square is revealed, or once its encounter resolves", () => {
  const s = hearingState();
  s.floor.g[PY + 3][PX - 2].feat = "dot";
  const r = boot(s);
  assert.equal(arcsAt(r.paint(), PX - 2, PY + 3).length, 3);
  s.floor.g[PY + 3][PX - 2].seen = true;
  assert.equal(allArcs(r.paint()).length, 0, "revealed");
  s.floor.g[PY + 3][PX - 2].seen = false;
  assert.equal(arcsAt(r.paint(), PX - 2, PY + 3).length, 3, "back in the fog, heard again");
  s.floor.g[PY + 3][PX - 2].feat = null;
  assert.equal(allArcs(r.paint()).length, 0, "resolved");
});

test("HUD-07 draw(): a missing bridge (or one without heardSquares) draws no ripple and never throws", () => {
  const s = hearingState();
  s.floor.g[PY][PX + 3].feat = "dot";
  const r = boot(s);
  r.w.__mzMapView = { mapViewRadius: () => Infinity, inViewWindow: () => true };
  assert.equal(allArcs(r.paint()).length, 0);
  r.w.__mzMapView = null;
  assert.equal(allArcs(r.paint()).length, 0);
});

test("HUD-07 draw() never touches the state", () => {
  const s = hearingState();
  s.floor.g[PY][PX + 3].feat = "dot";
  const r = boot(s);
  const before = JSON.stringify(r.w.__mzState.get());
  r.paint();
  assert.equal(JSON.stringify(r.w.__mzState.get()), before);
});

// ─── the hold ─────────────────────────────────────────────────────────────

function holdOn(r, x, y) {
  r.w.__mzControls = { screenToCell: () => ({ x, y }) };
  r.w.__mzTapStep = { inspectCell };
  r.railLines.length = 0;
  r.sandbox.context.inspectAt(0, 0);
  assert.equal(r.railLines.length, 1, "one hold card");
  return r.railLines[0];
}

test("HUD-07 inspectAt(): a hold on a heard square reports the HEARD card, names no feature and shows no mark glyph", () => {
  const s = hearingState();
  s.floor.g[PY][PX + 3].feat = "dot";
  const r = boot(s);
  const [title, line, tone, , icon, iconKey] = holdOn(r, PX + 3, PY);
  assert.equal(title, RAIL_COPY.heard.title);
  assert.equal(line, RAIL_COPY.heard.line);
  assert.equal(tone, "odd");
  assert.equal(icon, "·");
  assert.equal(iconKey, null);
  assert.doesNotMatch(`${title} ${line}`, /ENCOUNTER|rolled|monster|foe/i);
});

test("HUD-07 inspectAt(): in the dark, a seen dot outside the view window is heard, and its hold names nothing (no ENCOUNTER row, no glyph)", () => {
  const s = hearingState();
  s.floor.g[PY][PX].dark = true;
  s.floor.g[PY + 1][PX + 2].feat = "dot";
  s.floor.g[PY + 1][PX + 2].seen = true;
  const r = boot(s);
  assert.equal(arcsAt(r.paint(), PX + 2, PY + 1).length, 3);
  const [title, , , , icon, iconKey] = holdOn(r, PX + 2, PY + 1);
  assert.equal(title, RAIL_COPY.heard.title);
  assert.equal(icon, "·");
  assert.equal(iconKey, null);
});

test("HUD-07 inspectAt(): an unheard fogged square is still UNWALKED; without the skill a fogged dot is UNWALKED too", () => {
  const s = hearingState();
  s.floor.g[PY][PX + 3].feat = "dot";
  const r = boot(s);
  assert.equal(holdOn(r, PX - 3, PY)[0], RAIL_COPY.unwalked.title);
  const without = hearingState({ hearing: false });
  without.floor.g[PY][PX + 3].feat = "dot";
  const r2 = boot(without);
  assert.equal(holdOn(r2, PX + 3, PY)[0], RAIL_COPY.unwalked.title);
});

// ─── the MARKS sheet ─────────────────────────────────────────────────────

test("HUD-07 renderMarksLegend(): the HEARD row draws the CSS ripple swatch, every other row keeps its PNG icon", () => {
  const r = boot(hearingState());
  r.sandbox.context.renderMarksLegend();
  const rows = r.doc.document.getElementById("mw-legend-rows");
  const kids = rows.children || rows.childNodes;
  assert.equal(kids.length, 10);
  const heardRow = kids[9];
  const swatch = heardRow.children[0];
  assert.equal(swatch.className, "mw-legend-ripple");
  assert.equal(swatch.getAttribute("aria-hidden"), "true");
  assert.equal(heardRow.children[1].textContent, "HEARD");
  for (let i = 0; i < 9; i++) assert.equal(kids[i].children[0].tagName.toLowerCase(), "img", `row ${i} keeps its icon`);
  assert.match(HTML, /^\.mw-legend-ripple\{[^}]*radial-gradient\([^}]*\}$/m, "the ripple swatch is CSS rings");
});

// ─── source pins ─────────────────────────────────────────────────────────

test("HUD-07 source: heardSquares is imported on its own line, bridged on window.__mzMapView, and read by draw() and inspectAt()", () => {
  assert.equal((CODE.match(/import \{ heardSquares \} from "\.\/engine\/derived\.js";/g) || []).length, 1);
  assert.match(CODE, /window\.__mzMapView = \{ mapViewRadius, inViewWindow, heardSquares \};/);
  const draw = CODE.slice(CODE.indexOf("function draw() {"), CODE.indexOf("positionCanvas();\n}", CODE.indexOf("function draw() {")));
  assert.match(draw, /view\.heardSquares\(S\)/);
  assert.match(draw, /ctx\.strokeStyle = P\.heard;/);
  const inspect = CODE.slice(CODE.indexOf("function inspectAt(clientX, clientY)"), CODE.indexOf("(function initMazeViewportControls()"));
  assert.match(inspect, /view\.heardSquares\(S\)/);
});
