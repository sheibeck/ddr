// test/unit/shell-map-viewport.test.js
//
// Phase 35 (Map Screen Rebuild, MAP-02/05/08), Plan 04 — mazeworld.html has
// no module surface a test could import directly (it is not an ESM module
// the test runner can load), so — mirroring shell-map-rail.test.js/shell-
// map-hud.test.js's own source-assertion pattern — this file reads the real
// shipped source with fs.readFileSync and asserts against it directly:
//   (a) the D-pad/control bar are retired without a trace, code or markup
//       or comment, and the encounter overlay markup survives
//   (b) ZOOM_MIN/ZOOM_MAX/the zoom default
//   (c) the tapStep.js import + window.__mzTapStep bridge
//   (d) tapStep() — the guard/lookup/resolve/branch order
//   (e) inspectAt() — the lookup/inspect/report order, zero dispatch
//   (f) the pointer pipeline — the tap/hold gesture tracker alongside the
//       untouched Phase 33 pan/pinch mechanics; the tapStep bridge is read
//       through a call-time accessor (2026-09-16 UAT fix), never captured
//       at parse time
//   (g) the stair-down gate — stepTargetsExit, engineMove's five-statement
//       sequence, __mzDescend, hasActiveEncounter(), the renderEncounter
//       branch order, renderMajorOverlay unmodified
//   (h) keys — the stair block's key mirror, the combat branch untouched,
//       arrows still map through dirKeys
//   (i) the back button's three getGameContext edits
//   (j) the guard-timing invariants (encounterSettled() count, lastDismissAt
//       stamp count, no transition/animation-completion listener)
//   (k) the MAP_COPY.stair voice scan
//   (l) BEHAVIOUR — the real tapStep.js resolveStep/DIR_VECTORS the shell
//       wiring above relies on

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { BANNED, ALLOWLIST } from "../../content/safety-wordlist.js";
import { resolveStep, DIR_VECTORS } from "../../src/browser/tapStep.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const RAW_HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
const HTML = RAW_HTML.replace(/\r\n/g, "\n");

// ─── comment stripping (line comments first, THEN block comments — same
// order-sensitive approach as shell-map-rail.test.js / shell-input-guards.
// test.js) ──────────────────────────────────────────────────────────────
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

function tapStepRegion() {
  return sliceBetween(CODE, "function tapStep(clientX, clientY)", "function inspectAt(clientX, clientY)");
}
function inspectAtRegion() {
  return sliceBetween(CODE, "function inspectAt(clientX, clientY)", "(function initMazeViewportControls()");
}
function viewportRegion() {
  return sliceBetween(CODE, "(function initMazeViewportControls()", 'addEventListener("keydown"');
}
function pointermoveRegion() {
  return sliceBetween(CODE, 'vp.addEventListener("pointermove", e => {', "const release = e => {");
}
function engineMoveRegion() {
  return sliceBetween(CODE, "window.move = function engineMove", "function stepNow(dir)");
}
function renderEncounterRegion() {
  return sliceBetween(CODE, "function renderEncounter()", "function noteCombat(");
}
function renderMajorOverlayRegion() {
  return sliceBetween(CODE, "function renderMajorOverlay(host, spec)", "function renderCombatHeader(host, vm)");
}
function keydownRegion() {
  return sliceBetween(CODE, 'addEventListener("keydown"', 'addEventListener("resize"');
}
function getGameContextRegion() {
  return sliceBetween(CODE, "getGameContext: () => ({", "}).catch(() => {");
}
function hasActiveEncounterRegion() {
  return sliceBetween(CODE, "function hasActiveEncounter()", "function railLocked()");
}

// ─── (a) D-pad / control bar retirement ───────────────────────────────────

test("(a) raw file: zero dpad/data-dir/mazefoot occurrences, code or comments, in the whole file", () => {
  for (const literal of ["dpad", "data-dir", "mazefoot"]) {
    assert.equal((HTML.match(new RegExp(literal, "g")) || []).length, 0, `expected zero occurrences of "${literal}"`);
  }
});

test("(a) the viewport markup carries no direction-attribute button; the encounter overlay markup survives once", () => {
  assert.doesNotMatch(HTML, /<button[^>]*data-dir/);
  assert.equal((HTML.match(/class="mw-overlay" id="enc-panel"/g) || []).length, 1);
});

// ─── (b) ZOOM constants ────────────────────────────────────────────────────

test("(b) ZOOM_MIN = 0.6, ZOOM_MAX = 2.0; the 0.8 default is unchanged", () => {
  assert.equal((CODE.match(/const ZOOM_MIN = 0\.6, ZOOM_MAX = 2\.0;/g) || []).length, 1);
  assert.equal((CODE.match(/let zoom = 0\.8;/g) || []).length, 1);
});

// ─── (c) bridges ───────────────────────────────────────────────────────────

test("(c) tapStep.js is imported once and bridged onto window.__mzTapStep with its full pure surface", () => {
  assert.equal((CODE.match(/from "\.\/src\/browser\/tapStep\.js"/g) || []).length, 1);
  assert.match(
    CODE,
    /import \{ resolveStep, inspectCell, HOLD_MS, TAP_MAX_TRAVEL_PX, DIR_VECTORS \} from "\.\/src\/browser\/tapStep\.js";/,
  );
  assert.equal(
    (CODE.match(/window\.__mzTapStep = \{ resolveStep, inspectCell, HOLD_MS, TAP_MAX_TRAVEL_PX, DIR_VECTORS \};/g) || []).length,
    1,
  );
});

// ─── (d) tapStep() ─────────────────────────────────────────────────────────

test("(d) tapStep(): the guard/lookup/resolve/branch order, in that order, matches the plan's contract exactly", () => {
  const region = tapStepRegion();
  const order = [
    "hasActiveEncounter()",
    "railLocked()",
    "railPulse();",
    "window.__mzControls.screenToCell(clientX, clientY, rect, { x: px, y: py }, pan, CELL, CANVAS_PAD)",
    "resolveStep({ x: px, y: py }, cell, isOpen)",
    "copy.here.title",
    "copy.noWay.title",
    "move(res.dir);",
  ];
  let cursor = -1;
  for (const literal of order) {
    const idx = region.indexOf(literal);
    assert.ok(idx !== -1, `missing literal in tapStep(): ${literal}`);
    assert.ok(idx > cursor, `out of order: "${literal}" must appear after the previous literal`);
    cursor = idx;
  }
});

test("(d) tapStep(): never mutates S.floor.px/py, never dispatches directly", () => {
  const region = tapStepRegion();
  assert.doesNotMatch(region, /S\.floor\.px =/);
  assert.doesNotMatch(region, /S\.floor\.py =/);
  assert.doesNotMatch(region, /dispatch\(/);
});

// ─── (e) inspectAt() ────────────────────────────────────────────────────────

test("(e) inspectAt(): looks up the cell, builds the hold-inspect card, reports it, never dispatches", () => {
  const region = inspectAtRegion();
  assert.match(region, /window\.__mzControls\.screenToCell\(clientX, clientY, rect, \{ x: px, y: py \}, pan, CELL, CANVAS_PAD\)/);
  assert.match(region, /inspectCell\(c, \(feat\) => M\.legendFor\(feat\)\)/);
  assert.match(
    region,
    /window\.mzRailLine\?\.\(card\.title, card\.line, card\.tone, card\.hold, mark \? mark\.glyph : "[^"]*", mark \? mark\.key : null\);/,
  );
  assert.doesNotMatch(region, /move\(/);
  assert.doesNotMatch(region, /dispatch\(/);
});

// ─── (f) the pointer pipeline ───────────────────────────────────────────────

test("(f) viewport region: the gesture tracker (hold timer, travel cap, multi-finger cancel) is present", () => {
  const region = viewportRegion();
  assert.match(region, /let gesture = null;/);
  assert.doesNotMatch(region, /const T = window\.__mzTapStep;/);
  assert.match(region, /const T = \(\) => window\.__mzTapStep \|\| \{ HOLD_MS: 450, TAP_MAX_TRAVEL_PX: 10 \};/);
  assert.match(region, /holdTimer: setTimeout\(/);
  assert.equal((region.match(/T\(\)\.HOLD_MS/g) || []).length, 1);
  assert.equal((region.match(/T\(\)\.TAP_MAX_TRAVEL_PX/g) || []).length, 3);
  assert.match(region, /gesture\.multi = true/);
  assert.match(region, /gesture\.holdFired = true; inspectAt\(gesture\.x0, gesture\.y0\);/);
  assert.match(region, /clearTimeout\(gesture\.holdTimer\)/);
  assert.match(region, /tapStep\(gst\.x0, gst\.y0\)/);
  assert.match(region, /e\.type === "pointerup"/);
  assert.match(region, /vp\.addEventListener\("contextmenu"/);
});

test("(f) bridge timing (2026-09-16 UAT fix): the viewport IIFE reads the tapStep bridge only through the call-time accessor", () => {
  const region = viewportRegion();
  assert.equal((region.match(/window\.__mzTapStep/g) || []).length, 1, "the accessor is the sole reference to the bridge");
  assert.doesNotMatch(
    region,
    /^\s*(?:const|let|var) \w+ = window\.__mz\w+;/m,
    "no parse-time capture of any module bridge in the IIFE",
  );
});

test("(f) viewport region: the four Phase 33 pan/pinch literals are byte-intact", () => {
  const region = viewportRegion();
  assert.match(region, /vp\.addEventListener\("pointermove", e => \{/);
  assert.match(region, /const release = e => \{/);
  assert.match(region, /vp\.addEventListener\("pointerup", release\)/);
  assert.match(region, /const wasPinch = !!pinch;/);
  assert.match(region, /if \(wasPinch && pts\.size < 2\) window\.mzCenterMap\?\.\(\);/);
  assert.match(region, /zoom = clampZoom\(pinch\.zoom \* \(d \/ pinch\.dist\)\); fit\(\); positionCanvas\(\);/);
});

test("(f) pointermove sub-region never recenters (no per-tick reset)", () => {
  const region = pointermoveRegion();
  assert.doesNotMatch(region, /mzCenterMap/);
});

test("(f) mzCenterMap call-site count stays at 10 (no new recenter site — a step already recentered via the moved event)", () => {
  assert.equal((CODE.match(/window\.mzCenterMap\?\.\(\)/g) || []).length, 10);
});

// ─── (g) the stair-down gate ─────────────────────────────────────────────────

test("(g) stepTargetsExit(dir): a read-only peek, no dispatch, checks feat exit/gate via DIR_VECTORS", () => {
  assert.equal((CODE.match(/function stepTargetsExit\(dir\)/g) || []).length, 1);
  const region = sliceBetween(CODE, "function stepTargetsExit(dir)", "window.move = function engineMove");
  assert.match(region, /DIR_VECTORS\[dir\]/);
  assert.match(region, /c\.feat === "exit" \|\| c\.feat === "gate"/);
  assert.doesNotMatch(region, /dispatch\(/);
});

test("(g) engineMove: the exact five-statement sequence (settle -> lock -> stair -> step)", () => {
  const region = engineMoveRegion().replace(/\s+/g, " ");
  assert.match(
    region,
    /if \(hasActiveEncounter\(\)\) return; if \(!encounterSettled\(\)\) return; if \(railLocked\(\)\) \{ window\.mzRailPulse\?\.\(\); return; \} if \(stepTargetsExit\(dir\)\) \{ window\.__mzStair = \{ dir \}; window\.renderEncounter\(\); return; \} stepNow\(dir\);/,
  );
});

test("(g) window.__mzDescend clears the flag and calls the identical stepNow(dir); window.__mzStair initialised to null", () => {
  assert.equal((CODE.match(/window\.__mzDescend = /g) || []).length, 1);
  const region = sliceBetween(CODE, "window.__mzDescend = ", "function stepNow(dir)");
  assert.match(region, /stepNow\(s\.dir\)/);
  assert.ok((CODE.match(/window\.__mzStair = null;/g) || []).length >= 3, "init, __mzDescend, NOT YET, closeModal");
});

test("(g) hasActiveEncounter() includes the stair flag", () => {
  const region = hasActiveEncounterRegion();
  assert.match(region, /!!window\.__mzStair/);
});

test("(g) renderEncounter: the stair branch is the first branch, before the death branch, and renders the MAP_COPY.stair spec through renderMajorOverlay", () => {
  const region = renderEncounterRegion();
  const stairIdx = region.indexOf("if (window.__mzStair && !S.combat && !S.dead && !S.won) {");
  const deadIdx = region.indexOf("if (S.dead) {");
  assert.ok(stairIdx !== -1, "stair branch not found");
  assert.ok(deadIdx !== -1, "death branch not found");
  assert.ok(stairIdx < deadIdx, "the stair branch must precede the death branch inside renderEncounter");
  const branchEnd = region.indexOf("\n  }\n", stairIdx);
  const branch = region.slice(stairIdx, branchEnd === -1 ? undefined : branchEnd);
  assert.match(branch, /renderMajorOverlay\(body, \{/);
  assert.match(branch, /icon: "▼"/);
  assert.match(branch, /iconKey: "descent",/);
  assert.match(branch, /MAP_COPY\.stair\.title/);
  assert.match(branch, /MAP_COPY\.stair\.line\.replace\("\{n\}", S\.floor\.depth \+ 1\)/);
  assert.match(branch, /window\.__mzDescend\?\.\(\)/);
  assert.match(branch, /window\.__mzStair = null; renderEncounter\(\);/);
});

test("(g) renderMajorOverlay(body call-site count is 2 (the encounter gate + the stair), and its own function body stays content-agnostic (no MAP_COPY)", () => {
  assert.equal((CODE.match(/renderMajorOverlay\(body/g) || []).length, 2);
  assert.equal((CODE.match(/function renderMajorOverlay\(host, spec\)/g) || []).length, 1);
  const body = renderMajorOverlayRegion();
  assert.doesNotMatch(body, /MAP_COPY/, "renderMajorOverlay stays content-agnostic — it never reads MAP_COPY directly");
});

// ─── (h) keys ─────────────────────────────────────────────────────────────

test("(h) keydown: the stair block clicks the two overlay button ids; the combat branch's own first statement is unchanged", () => {
  const region = keydownRegion();
  assert.match(region, /if \(window\.__mzStair\) \{/);
  assert.match(region, /document\.getElementById\("mw-major-primary"\)\?\.click\(\)/);
  assert.match(region, /document\.getElementById\("mw-major-secondary"\)\?\.click\(\)/);
  const combatBlockStart = region.indexOf("if (S.combat) {");
  assert.ok(combatBlockStart !== -1);
  const afterCombatOpen = region.slice(combatBlockStart, combatBlockStart + 400);
  assert.match(afterCombatOpen, /if \(!encArmed\(\)\) return;/);
});

test("(h) keydown: arrows still resolve through dirKeys into move()", () => {
  const region = keydownRegion();
  assert.match(region, /const dirKeys = \{ arrowup:"N", w:"N", arrowdown:"S", s:"S", arrowleft:"W", a:"W", arrowright:"E", d:"E" \};/);
  assert.match(region, /if \(dirKeys\[k\]\) \{ e\.preventDefault\(\); move\(dirKeys\[k\]\); return; \}/);
});

// ─── (i) back button ────────────────────────────────────────────────────────

test("(i) getGameContext: hasOpenModal/isAtRoot/closeModal all honour the stair overlay and the two sheets", () => {
  const region = getGameContextRegion();
  const hasOpenModalLine = sliceBetween(region, "hasOpenModal:", "hasLiveRun:");
  assert.match(hasOpenModalLine, /window\.__mzStair/);
  assert.match(hasOpenModalLine, /mw-camp-sheet/);
  assert.match(hasOpenModalLine, /mw-legend-sheet/);
  const isAtRootLine = sliceBetween(region, "isAtRoot:", "closeModal:");
  assert.match(isAtRootLine, /!window\.__mzStair/);
  const closeModalRegion = sliceBetween(region, "closeModal: () => {", "navigateBack:");
  assert.match(closeModalRegion, /window\.__mzStair = null;/);
  assert.match(closeModalRegion, /closeCampSheet\(\);/);
  assert.match(closeModalRegion, /closeMarksLegend\(\);/);
  assert.doesNotMatch(closeModalRegion, /__mzRail/);
});

// ─── (j) guard-timing invariants ───────────────────────────────────────────

test("(j) encounterSettled() appears exactly twice (its own definition + the one caller in engineMove)", () => {
  assert.equal((CODE.match(/encounterSettled\(\)/g) || []).length, 2);
});

test("(j) no transitionend/animationend listener exists in the viewport or tapStep regions (Date.now() guards only)", () => {
  const regions = [tapStepRegion(), inspectAtRegion(), viewportRegion()];
  for (const region of regions) {
    assert.doesNotMatch(region, /transitionend/);
    assert.doesNotMatch(region, /animationend/);
  }
});

// ─── (k) voice scan ─────────────────────────────────────────────────────────

const ALLOW = new Set(ALLOWLIST.map((w) => w.toLowerCase()));
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const MATCHERS = BANNED.map((term) => ({ term, re: new RegExp("\\b" + escapeRegExp(term) + "\\b", "i") }));
function findBannedTerms(text) {
  const hits = [];
  for (const { term, re } of MATCHERS) {
    const m = text.match(re);
    if (m && !ALLOW.has(m[0].toLowerCase())) hits.push({ term, match: m[0] });
  }
  return hits;
}

test("(k) MAP_COPY.stair is clear of BANNED terms and carries the {n} placeholder in its line", () => {
  const m = CODE.match(/stair: \{\s*title: "([^"]*)",\s*line: "([^"]*)",\s*go: "([^"]*)",\s*stay: "([^"]*)",/);
  assert.ok(m, "MAP_COPY.stair block not found");
  const [, title, line, go, stay] = m;
  assert.ok(line.includes("{n}"), "MAP_COPY.stair.line must carry the {n} floor-number placeholder");
  for (const text of [title, line, go, stay]) {
    const offenders = findBannedTerms(text);
    assert.deepStrictEqual(offenders, [], `Banned copy in MAP_COPY.stair: ${JSON.stringify(offenders)} (text: "${text}")`);
  }
});

// ─── (l) BEHAVIOUR ──────────────────────────────────────────────────────────

test("(l) BEHAVIOUR: resolveStep resolves the exact cases the shell's tapStep() relies on", () => {
  const isOpen = (x, y) => x >= 0 && x < 5 && y >= 0 && y < 5;
  // dominant axis (east, further east than south)
  assert.deepStrictEqual(resolveStep({ x: 0, y: 0 }, { x: 3, y: 1 }, isOpen), { kind: "step", dir: "E" });
  // fallback axis: dominant (east) blocked, fallback (south) open
  const blockedEast = (x, y) => !(x === 1 && y === 0) && isOpen(x, y);
  assert.deepStrictEqual(resolveStep({ x: 0, y: 0 }, { x: 3, y: 1 }, blockedEast), { kind: "step", dir: "S" });
  // both blocked
  assert.deepStrictEqual(resolveStep({ x: 0, y: 0 }, { x: 3, y: 1 }, () => false), { kind: "blocked" });
  // own square
  assert.deepStrictEqual(resolveStep({ x: 2, y: 2 }, { x: 2, y: 2 }, isOpen), { kind: "here" });
});

test("(l) BEHAVIOUR: DIR_VECTORS.E is [1, 0] — the shell's f.px + v[0] read depends on this exact shape", () => {
  assert.deepStrictEqual(DIR_VECTORS.E, [1, 0]);
  assert.deepStrictEqual(DIR_VECTORS.W, [-1, 0]);
  assert.deepStrictEqual(DIR_VECTORS.N, [0, -1]);
  assert.deepStrictEqual(DIR_VECTORS.S, [0, 1]);
});
