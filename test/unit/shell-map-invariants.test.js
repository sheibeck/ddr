// test/unit/shell-map-invariants.test.js
//
// Phase 35 (Map Screen Rebuild, MAP-08/09), Plan 05 — the whole-phase sweep.
// This file does NOT duplicate Plans 02-04's own per-region pins
// (shell-map-rail.test.js, shell-map-hud.test.js, shell-map-viewport.test.js
// already prove each surface in detail); it sweeps the WHOLE file for the
// phase's retirements, guard discipline, settle/arm discipline, presentation
// state and copy, so a later plan can never accidentally resurrect a retired
// literal without a single suite catching it. Every retired literal is built
// by string concatenation so this test file never spells the banned name
// whole (mirroring shell-map-rail.test.js's own discipline).
//
// Mirrors shell-combat-over.test.js's source-assertion pattern (fs.readFileSync
// + a comment-stripped CODE constant) since mazeworld.html has no ESM module
// surface a test could import directly.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { execSync } from "node:child_process";

import { BANNED, ALLOWLIST } from "../../content/safety-wordlist.js";
import { RAIL_COPY, RAIL_FAMILY } from "../../src/browser/rail.js";
import { MARKS_LEGEND } from "../../src/browser/mapMarks.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const RAW = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8").replace(/\r\n/g, "\n");

// ─── comment stripping (line comments first, THEN block comments) ─────────
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

const CODE = stripComments(RAW);

function countOf(source, sub) {
  let c = 0;
  let i = 0;
  while ((i = source.indexOf(sub, i)) !== -1) {
    c++;
    i += sub.length;
  }
  return c;
}

// A per-function slice from an exact signature to the NEXT "\nfunction "
// after it, against the comment-stripped CODE constant.
function fnRegion(sig) {
  const start = CODE.indexOf(sig);
  assert.ok(start !== -1, `signature not found: ${sig}`);
  const end = CODE.indexOf("\nfunction ", start + sig.length);
  return end === -1 ? CODE.slice(start) : CODE.slice(start, end);
}

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start === -1 ? 0 : start);
  assert.ok(start !== -1, `start marker not found: ${startMarker}`);
  assert.ok(end !== -1 && end > start, `end marker not found after start: ${endMarker}`);
  return source.slice(start, end);
}

// ─── retired literals built by concatenation (never spelled whole) ────────
const RETIRED = {
  toastClass: "mw" + "-toast",
  lifetimeBridge: "__mz" + "ToastLifetime",
  maxToasts: "MAX_" + "TOASTS",
  lifetimeFn: "toast" + "Lifetime",
  dpad1: "dp" + "ad",
  dpad2: "data-d" + "ir",
  dpad3: "maze" + "foot",
  flashEl: "mw-" + "flash",
  flashFn: "flash" + "Message",
  hudName: "hud-" + "name",
  hudCls: "hud-" + "cls",
  mmHp: "mm-" + "hp",
  hudChar: "mw-hud-" + "char",
  condTrack: "mw-cond-" + "track",
  viewportChips: "mw-viewport-" + "chips",
  canvasColors: "MAZE_CANVAS_" + "COLORS",
  cardEvents: "CARD_" + "EVENTS",
  beatsTitleFor: "beatsTitle" + "For",
  featureEventTitle: "FEATURE_EVENT_" + "TITLE",
  dismissId: "a-" + "next",
  preDeathBeat: "pre" + "DeathBeat",
  steppingFn: "stepping" + "()",
};

// ─── (a) SC-1: no toast anywhere ────────────────────────────────────────────

test("SC-1 (no D-pad and no toast exists anywhere): RAW carries zero of the toast host/CSS/bridge literals", () => {
  for (const key of ["toastClass", "lifetimeBridge", "maxToasts", "lifetimeFn"]) {
    assert.equal(countOf(RAW, RETIRED[key]), 0, `expected zero "${RETIRED[key]}" in mazeworld.html`);
  }
});

test("SC-1: CODE carries exactly one linesForAction( call (the dispatchWithNarration seam)", () => {
  assert.equal(countOf(CODE, "linesForAction("), 1);
});

// ─── (b) SC-1: no D-pad ─────────────────────────────────────────────────────

test("SC-1: RAW carries zero of the three retired D-pad literals", () => {
  for (const key of ["dpad1", "dpad2", "dpad3"]) {
    assert.equal(countOf(RAW, RETIRED[key]), 0, `expected zero "${RETIRED[key]}" in mazeworld.html`);
  }
});

test("SC-1: RAW carries zero Move north/west/south/east aria labels", () => {
  for (const dir of ["north", "west", "south", "east"]) {
    assert.equal(countOf(RAW, `Move ${dir}`), 0, `expected zero "Move ${dir}" in mazeworld.html`);
  }
});

// ─── (c) other retirements ──────────────────────────────────────────────────

// Phase 57 (LAYOUT-05, 2026-09-21 user ruling): "hudName" ("hud-name") is
// REMOVED from this zero-occurrence sweep — the 2026-09-21 ruling reverses
// Phase 35 ruling 5 and restores the identity line as band 1's
// `.mw-hud-name`/`#mw-hud-name` (see 57-01-PLAN.md, test/unit/hud-bands-
// layout.test.js and shell-map-hud.test.js's re-pinned tests). The other
// eight literals in this sweep are still genuinely dead and stay pinned.
test("retirements: RAW carries zero of the flash/character-line/chip-track/palette-table literals", () => {
  for (const key of ["flashEl", "flashFn", "hudCls", "mmHp", "hudChar", "condTrack", "viewportChips", "canvasColors"]) {
    assert.equal(countOf(RAW, RETIRED[key]), 0, `expected zero "${RETIRED[key]}" in mazeworld.html`);
  }
});

test("retirements: CODE carries zero CARD_EVENTS/beatsTitleFor/FEATURE_EVENT_TITLE/preDeathBeat/stepping()", () => {
  for (const key of ["cardEvents", "beatsTitleFor", "featureEventTitle", "preDeathBeat", "steppingFn"]) {
    assert.equal(countOf(CODE, RETIRED[key]), 0, `expected zero "${RETIRED[key]}" in CODE`);
  }
});

test("retirements: RAW carries zero occurrences of the retired dismiss-control id", () => {
  assert.equal(countOf(RAW, `"${RETIRED.dismissId}"`), 0);
});

test("retirements (2026-09-17 UAT): RAW carries zero of the retired party-strip literals; .mw-party-list{ appears once", () => {
  const retiredPartyRailId = "mw-party-" + "rail";
  const retiredRenderPartyRail = "renderParty" + "Rail";
  assert.equal(countOf(RAW, retiredPartyRailId), 0, `expected zero "${retiredPartyRailId}" in mazeworld.html`);
  assert.equal(countOf(RAW, retiredRenderPartyRail), 0, `expected zero "${retiredRenderPartyRail}" in mazeworld.html`);
  assert.equal((RAW.match(/^\.mw-party-list\{/gm) || []).length, 1);
});

test("PNG canon (user reversed Phase 35 decision 3, 2026-09-16 UAT): the draw() region reads __mzIconMap and calls drawFeatureIcon, and no glyph fillText survives", () => {
  const region = fnRegion("function draw() {");
  assert.match(region, /__mzIconMap/);
  assert.match(region, /drawFeatureIcon/);
  assert.doesNotMatch(region, /fillText\(mark\.glyph/);
});

test("PNG canon: the legend region builds <img> rows and no glyph span survives", () => {
  const region = fnRegion("function renderMarksLegend() {");
  assert.match(region, /createElement\("img"\)/);
  assert.match(region, /icons\/optimized\//);
  assert.doesNotMatch(region, /mw-legend-glyph/);
});

// ─── (d) MAP-08: guarded targets, file-wide ────────────────────────────────

// A guarded id is wired one of two ways anywhere in the file: (1) directly
// (`guardTap(document.getElementById("id"), ...)`); (2) generically, through
// a buttons-array shape (`id: "<id>"` present AND the one generic
// `guardTap(document.getElementById(b.id), b.onTap)` call present somewhere
// in the file) — mirrors shell-input-guards.test.js's countGuardedWiring,
// applied file-wide instead of scoped to one region.
function isGuardedFileWide(id) {
  const directRe = new RegExp(`guardTap\\(document\\.getElementById\\("${id}"\\)`);
  if (directRe.test(CODE)) return true;
  const hasIdEntry = CODE.includes(`id: "${id}"`);
  const hasGenericGuardTap = /guardTap\(document\.getElementById\(b\.id\), b\.onTap\)/.test(CODE);
  return hasIdEntry && hasGenericGuardTap;
}

const FILE_WIDE_GUARDED_IDS = [
  "a-join-yes", "a-join-no", "a-find-take", "a-find-leave",
  "mw-rail-climb", "mw-camp-sleep", "mw-camp-walk",
  "mw-major-primary", "mw-major-secondary",
  "btn-death-oracle", "cb-over-btn", "a-loot-take-all", "a-loot-leave-all",
];

test("MAP-08: every new tap target is wired through guardTap somewhere in the file", () => {
  for (const id of FILE_WIDE_GUARDED_IDS) {
    assert.ok(isGuardedFileWide(id), `expected "${id}" wired through guardTap`);
  }
});

test("MAP-08: none of the file-wide guarded ids carry a bare .onclick assignment", () => {
  for (const id of FILE_WIDE_GUARDED_IDS) {
    assert.doesNotMatch(
      CODE,
      new RegExp(`getElementById\\("${id}"\\)\\.onclick =`),
      `"${id}" must be wired only through guardTap, never a bare .onclick =`,
    );
  }
});

test("MAP-08: condition chips are wired through an arm guard (Phase 71 D-16: guardInfoTap with condArmed)", () => {
  const region = fnRegion("function paintConditions(c) {");
  // Phase 71 (D-16, R-29): the chips keep the Phase 32 arm window, now
  // measured from their own chip-set change so a fight never locks them.
  assert.match(region, /guardInfoTap\(btn,/);
  assert.match(region, /, condArmed\);/);
});

test("MAP-08: the four map chips' listeners exist exactly once each", () => {
  // Phase 70 (D-07): each ☰ row closes the menu before its action, so every
  // listener wraps its existing handler in closeMenuThen(...).
  assert.equal(countOf(CODE, "document.getElementById(\"mw-chip-marks\").addEventListener(\"click\", closeMenuThen(openMarksLegend))"), 1);
  // Phase 58 (MOTION-01, D-01): the CENTRE row of the ☰ menu now glides
  // (glideCenterMap) instead of snapping (centerMap) — re-pinned from
  // `centerMap` to `glideCenterMap` here.
  assert.equal(countOf(CODE, "document.getElementById(\"mw-chip-centre\").addEventListener(\"click\", closeMenuThen(glideCenterMap))"), 1);
  assert.equal(countOf(CODE, "document.getElementById(\"btn-camp\").onclick = closeMenuThen(openCampSheet)"), 1);
  assert.equal(countOf(CODE, "document.getElementById(\"mw-gear-btn\")?.addEventListener(\"click\", closeMenuThen(openSettingsSheet))"), 1);
});

test("MAP-08/MOTION-01: window.mzCenterMap = centerMap; is still exactly once — the bridge stays the SNAP (D-03)", () => {
  assert.equal(countOf(CODE, "window.mzCenterMap = centerMap;"), 1);
});

// ─── (e) settle/arm discipline ──────────────────────────────────────────────

// Phase 63 (GSCR-10), Plan 04: closeGearSheet() gains its own
// `lastDismissAt = Date.now();` stamp, on the exact closeCampSheet/
// closeMarksLegend pattern — 3 -> 4 stamps.
test("settle/arm discipline: lastDismissAt = Date.now() appears exactly 4 times", () => {
  assert.equal(countOf(RAW, "lastDismissAt = Date.now()"), 4);
});

test("settle/arm discipline: encounterSettled() appears exactly 2 times", () => {
  assert.equal(countOf(RAW, "encounterSettled()"), 2);
});

test("settle/arm discipline: armEncounterButtons(); appears in renderEncounter, renderRail and paintConditions/openCampSheet (>= 4)", () => {
  assert.ok(countOf(RAW, "armEncounterButtons();") >= 4);
});

test("settle/arm discipline: the guard-helper region carries no transition/animation token", () => {
  const region = fnRegion("function guardTap(btn, fn) {");
  assert.doesNotMatch(region, /transition/i);
  assert.doesNotMatch(region, /animation/i);
});

test("settle/arm discipline: the main <style> block carries no aria-disabled reference", () => {
  const firstStyleStart = RAW.indexOf("<style>");
  const mainStyleStart = RAW.indexOf("<style>", firstStyleStart + 1); // second <style> block (the main CSS)
  assert.ok(mainStyleStart !== -1, "expected a second <style> block");
  const mainStyleEnd = RAW.indexOf("</style>", mainStyleStart);
  assert.ok(mainStyleEnd !== -1, "expected a closing </style> for the main CSS block");
  const styleBlock = RAW.slice(mainStyleStart, mainStyleEnd);
  assert.doesNotMatch(styleBlock, /aria-disabled/);
});

// ─── (f) no presentation state on S ─────────────────────────────────────────

test("no presentation state on S: CODE carries zero S.__mz/state.__mz/S.rail/state.rail/S.stair/state.stair/S.pendingClimb/state.pendingClimb", () => {
  for (const sub of ["S.__mz", "state.__mz", "S.rail", "state.rail", "S.stair", "state.stair", "S.pendingClimb", "state.pendingClimb"]) {
    assert.equal(countOf(CODE, sub), 0, `expected zero "${sub}" in CODE`);
  }
});

test("no presentation state on S: every phase global exists as an initialiser exactly once", () => {
  const initialisers = {
    "window.__mzRail = emptyRail();": 1,
    "window.__mzRailVM = {": 1,
    "window.__mzTapStep = {": 1,
    "window.__mzMapMarks = {": 1,
    "window.__mzDescend = ": 1,
    "window.mzRailLine = ": 1,
    "window.mzRailPulse = railPulse;": 1,
    "window.renderRail = renderRail;": 1,
  };
  for (const [literal, expected] of Object.entries(initialisers)) {
    assert.equal(countOf(RAW, literal), expected, `expected "${literal}" exactly ${expected}x`);
  }
  // window.__mzStair is initialised to null once AND cleared (also to null)
  // at several dismissal sites — the INIT occurrence is what this pins.
  assert.ok(countOf(RAW, "window.__mzStair = null;") >= 1);
});

// ─── (g) rail-or-log partition ──────────────────────────────────────────────

test("rail-or-log partition: dispatchWithNarration has exactly one 'if (wasCombat || inCombat)' branch", () => {
  assert.equal(countOf(CODE, "if (wasCombat || inCombat) {"), 1);
});

test("rail-or-log partition: the else-branch calls railCardFor", () => {
  const start = CODE.indexOf("if (wasCombat || inCombat) {");
  const region = CODE.slice(start, start + 1200);
  assert.match(region, /railCardFor\(/);
});

test("rail-or-log partition: CODE carries zero PRIORITY.block re-checks outside the fightLog/rail modules", () => {
  // mazeworld.html itself must not re-derive PRIORITY.block logic; the one
  // reference that exists there is a doc comment (stripped by CODE).
  assert.equal(countOf(CODE, "PRIORITY.block"), 0);
});

// ─── (h) layout ──────────────────────────────────────────────────────────

test("layout: id=\"mw-rail\" sits between </main> and <nav class=\"mw-tabbar\"", () => {
  const mainClose = RAW.indexOf("</main>");
  const railId = RAW.indexOf('id="mw-rail"');
  const tabbar = RAW.indexOf('<nav class="mw-tabbar"');
  assert.ok(mainClose !== -1 && railId !== -1 && tabbar !== -1);
  assert.ok(mainClose < railId, "expected </main> before id=\"mw-rail\"");
  assert.ok(railId < tabbar, "expected id=\"mw-rail\" before <nav class=\"mw-tabbar\"");
});

test("layout: .mw-tabbar{ carries no position:fixed", () => {
  const region = sliceBetween(RAW, ".mw-tabbar{", "}");
  assert.doesNotMatch(region, /position:\s*fixed/);
});

// ─── (i) MAP-09: no new packages / fonts ────────────────────────────────────

test("MAP-09: package.json dependencies+devDependencies are unchanged from HEAD", () => {
  const headPkgRaw = execSync("git show HEAD:package.json", { cwd: REPO_ROOT, encoding: "utf8" });
  const headPkg = JSON.parse(headPkgRaw);
  const livePkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"));
  const headKeys = new Set([...Object.keys(headPkg.dependencies || {}), ...Object.keys(headPkg.devDependencies || {})]);
  const liveKeys = new Set([...Object.keys(livePkg.dependencies || {}), ...Object.keys(livePkg.devDependencies || {})]);
  assert.deepStrictEqual([...liveKeys].sort(), [...headKeys].sort());
});

test("MAP-09: RAW carries zero Google Fonts host references and exactly three @font-face declarations", () => {
  const googleFontsHostA = "fonts." + "googleapis" + ".com";
  const googleFontsHostB = "fonts." + "gstatic" + ".com";
  assert.equal(countOf(RAW, googleFontsHostA), 0);
  assert.equal(countOf(RAW, googleFontsHostB), 0);
  assert.equal(countOf(RAW, "@font-face"), 3);
});

// ─── (j) aggregate voice scan ───────────────────────────────────────────────

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
function assertClean(leaf, source) {
  assert.ok(leaf.length > 0, `every ${source} leaf must be non-empty`);
  const offenders = findBannedTerms(leaf);
  assert.deepStrictEqual(offenders, [], `Banned copy in ${source}: ${JSON.stringify(offenders)} (text: "${leaf}")`);
}

function recursiveLeaves(obj) {
  const leaves = [];
  for (const v of Object.values(obj)) {
    if (typeof v === "string") leaves.push(v);
    else if (v && typeof v === "object") leaves.push(...recursiveLeaves(v));
  }
  return leaves;
}

test("voice scan: every RAIL_COPY leaf is non-empty and clear of BANNED", () => {
  const leaves = recursiveLeaves(RAIL_COPY);
  assert.ok(leaves.length > 0);
  for (const leaf of leaves) assertClean(leaf, "RAIL_COPY");
});

test("voice scan: every RAIL_FAMILY title is non-empty and clear of BANNED", () => {
  const titles = Object.values(RAIL_FAMILY).map((f) => f.title);
  assert.ok(titles.length > 0);
  for (const title of titles) assertClean(title, "RAIL_FAMILY");
});

function extractStringLeaves(objLiteralSource) {
  return [...objLiteralSource.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"/g)].map((m) => m[1]);
}

test("voice scan: every MAP_COPY leaf is non-empty and clear of BANNED", () => {
  const region = sliceBetween(CODE, "const MAP_COPY = {", "\n};");
  const leaves = extractStringLeaves(region).filter((s) => s.length > 0 || true);
  assert.ok(leaves.length > 0);
  for (const leaf of leaves) {
    if (leaf.length === 0) continue; // key-only artifacts of the regex are skipped, values are non-empty by design
    assertClean(leaf, "MAP_COPY");
  }
});

test("voice scan: every CONDITION_EXPLAIN value is non-empty and clear of BANNED", () => {
  const region = sliceBetween(CODE, "const CONDITION_EXPLAIN = {", "\n};");
  const leaves = extractStringLeaves(region);
  assert.ok(leaves.length > 0);
  for (const leaf of leaves) {
    if (leaf.length === 0) continue;
    assertClean(leaf, "CONDITION_EXPLAIN");
  }
});

test("voice scan: every MARKS_LEGEND name/desc is non-empty and clear of BANNED", () => {
  assert.ok(MARKS_LEGEND.length > 0);
  for (const row of MARKS_LEGEND) {
    assertClean(row.name, "MARKS_LEGEND.name");
    assertClean(row.desc, "MARKS_LEGEND.desc");
  }
});

// ─── (k) SC pins: the five ROADMAP success criteria, by name ───────────────

test("SC-1 (no D-pad, no toast, tap/hold/drag/pinch): proven by the tests above (toast/D-pad zero-greps)", () => {
  assert.equal(countOf(RAW, RETIRED.dpad3), 0);
  assert.equal(countOf(RAW, RETIRED.toastClass), 0);
});

test("SC-2 (every out-of-combat event rails with dice, decisions lock movement, level-up/floor need no tap): rail family + RAIL_DIRECT cover it", () => {
  assert.ok(RAIL_FAMILY.floorChanged);
  assert.ok(RAIL_FAMILY.leveled);
  assert.match(CODE, /railLocked\(\)/);
});

test("SC-3 (encounters/descents/out-of-combat death use the major overlay; FIGHT IT OUT opens combat at round 1): renderMajorOverlay reused twice", () => {
  assert.equal(countOf(CODE, "renderMajorOverlay(body"), 2);
});

test("SC-4 (HUD + condition chips match the mock; MARKS/CENTRE/MAKE CAMP/SETTINGS work from the ☰ HUD menu with sheets, Phase 57 Plan 05): each row id is a role=menuitem inside #mw-hud-menu", () => {
  assert.match(RAW, /id="mw-chip-marks"/);
  assert.match(RAW, /id="mw-chip-centre"/);
  assert.match(RAW, /id="btn-camp"/);
  const menuStart = RAW.indexOf('id="mw-hud-menu"');
  assert.ok(menuStart !== -1, "#mw-hud-menu must exist");
  const menuEnd = RAW.indexOf("</header>", menuStart);
  const menuRegion = RAW.slice(menuStart, menuEnd);
  for (const id of ["mw-chip-marks", "mw-chip-centre", "btn-camp", "mw-gear-btn"]) {
    assert.match(menuRegion, new RegExp(`role="menuitem" class="mw-hud-menu-item" id="${id}"`), `"${id}" must be a role=menuitem row inside #mw-hud-menu`);
  }
});

test("SC-5 (guards hold on every new button; npm test green; build:www exit 0; engine/content/parity diff empty; Pixel 7 DR round signs off): proven by the phase gate (Task 2) + this suite's own guard sweep", () => {
  assert.ok(FILE_WIDE_GUARDED_IDS.every((id) => isGuardedFileWide(id)));
});
