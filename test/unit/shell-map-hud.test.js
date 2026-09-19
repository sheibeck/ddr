// test/unit/shell-map-hud.test.js
//
// Phase 35 (Map Screen Rebuild, MAP-01/06/07/08), Plan 03 — mazeworld.html
// has no module surface a test could import directly (it is not an ESM
// module the test runner can load), so — mirroring shell-map-rail.test.js's
// own source-assertion pattern — this file reads the real shipped source
// with fs.readFileSync and asserts against it directly: the rebuilt HUD
// strip (FLOOR/DAY/SQUARES/RATIONS + the x/y WP bar, the DR13 character
// line retired), the condition-chip strip (now its own strip, each chip a
// guarded button explaining itself in the rail), the viewport chrome
// (MARKS/CENTRE/MAKE CAMP chips, the pulsing party ring — 2026-09-17 UAT:
// composited to only opacity/transform, and paused/hidden whenever the
// encounter panel covers the map), the canvas palette from mapMarks.js and
// the v1.3 PNG icon pipeline for marks/party (restored 2026-09-16 UAT), the
// MARKS legend's PNG <img> rows, and the MAKE CAMP sheet. A final BEHAVIOUR
// section proves the real mapMarks.js mapping/rotation table inspectAt()'s
// legend lookups still read.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { BANNED, ALLOWLIST } from "../../content/safety-wordlist.js";
import { markForCell, ONEWAY_ROTATION_DEG } from "../../src/browser/mapMarks.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const RAW_HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
const HTML = RAW_HTML.replace(/\r\n/g, "\n");

// ─── comment stripping (line comments first, THEN block comments — see
// shell-map-rail.test.js's own doc comment for why the order matters) ──────
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

function fnRegion(sig) {
  const start = CODE.indexOf(sig);
  assert.ok(start !== -1, `signature not found: ${sig}`);
  const end = CODE.indexOf("\nfunction ", start + sig.length);
  assert.ok(end !== -1 && end > start, `no following function boundary after: ${sig}`);
  return CODE.slice(start, end);
}

function paintConditionsRegion() {
  return fnRegion("function paintConditions(c)");
}
function paintRegion() {
  return fnRegion("function paint()");
}
function drawRegion() {
  // The end marker is itself a block comment (stripped from CODE), so this
  // slices the RAW file and drops only // line comments — mirrors the
  // plan's own acceptance-criteria script verbatim.
  const a = HTML.indexOf("function draw()");
  const b = HTML.indexOf("/* ---------------- log", a);
  assert.ok(a !== -1 && b !== -1 && b > a, "draw() region markers found");
  return HTML.slice(a, b).replace(/\/\/[^\n]*/g, "");
}
function renderMarksLegendRegion() {
  return fnRegion("function renderMarksLegend()");
}
function openCampSheetRegion() {
  return fnRegion("function openCampSheet()");
}
function styleBlock() {
  const start = HTML.indexOf("<style>");
  const end = HTML.lastIndexOf("</style>") + "</style>".length;
  return HTML.slice(start, end);
}

// ─── (a) HUD markup ─────────────────────────────────────────────────────

test("(a) HUD markup: FLOOR/DAY/SQUARES/RATIONS in order with their kept ids, the WP block ids, DEV chip still inside .mw-hud-top, the gear gone from the HUD, zero character-line ids", () => {
  const hudStart = HTML.indexOf('<header class="mw-hud" id="mw-hud">');
  const hudEnd = HTML.indexOf("</header>", hudStart);
  assert.ok(hudStart !== -1 && hudEnd !== -1 && hudEnd > hudStart, "the HUD header region must be found");
  const region = HTML.slice(hudStart, hudEnd);

  const floorIdx = region.indexOf('mw-hud-item mw-hud-floor">Floor<b id="m-floor">');
  const dayIdx = region.indexOf('Day<b id="m-day">');
  const sqIdx = region.indexOf('Squares<b id="m-steps">');
  const ratIdx = region.indexOf('Rations<b id="m-rations">');
  assert.ok(floorIdx !== -1 && dayIdx !== -1 && sqIdx !== -1 && ratIdx !== -1, "all four stat items found");
  assert.ok(floorIdx < dayIdx && dayIdx < sqIdx && sqIdx < ratIdx, "FLOOR, DAY, SQUARES, RATIONS in that order");
  assert.doesNotMatch(region, />Moves</, "the old Moves label text is gone");

  assert.equal((region.match(/id="mw-hud-wp"/g) || []).length, 1);
  assert.equal((region.match(/id="mw-hud-wpfill"/g) || []).length, 1);
  assert.match(region, /class="mw-hud-wp"><span class="mw-hud-wp-text" id="mw-hud-wp">0\/0 HP<\/span>/);

  const devIdx = region.indexOf('id="mw-dev-chip"');
  const topStart = region.indexOf('<div class="mw-hud-top">');
  // .mw-hud-top is the header's ONE child now (the character line/condition
  // strip/party rail all moved out) — so the DEV chip appearing after it
  // opens proves it stayed inside it.
  assert.ok(topStart !== -1 && topStart < devIdx, "the DEV chip after .mw-hud-top opens");
  assert.equal((region.match(/id="mw-gear-btn"/g) || []).length, 0, "the settings gear left the HUD (2026-09-16 UAT)");

  const retired = ["hud-name", "hud-cls", "mm-hp\"", "mm-hpmax", "mm-hpfill", "mw-hud-char"].join("|");
  assert.doesNotMatch(region, new RegExp(retired));
});

test("(a) raw file: zero occurrences of every retired character-line/chip-track identifier, code or comment", () => {
  const forbidden = ["hud-name", "hud-cls", "mm-hp", "mw-hud-char", "mw-cond-track"];
  for (const literal of forbidden) {
    const hits = HTML.match(new RegExp(literal, "g")) || [];
    assert.equal(hits.length, 0, `expected zero occurrences of "${literal}" anywhere in mazeworld.html, found ${hits.length}`);
  }
});

// ─── (b) layout: the condition strip sits between </header> and <main>; the retired party strip is gone ──

test('(b) layout: mw-cond-strip sits directly after </header> and before <main>; the retired party strip is gone from the map column (2026-09-17 UAT)', () => {
  const h = HTML.indexOf("</header>");
  const c = HTML.indexOf('class="mw-cond-strip" id="mm-conditions"');
  const m = HTML.indexOf('<main class="mw-screens"');
  assert.ok(h !== -1 && c !== -1 && m !== -1, "all three anchors found");
  assert.ok(h < c && c < m, "</header> < mw-cond-strip < <main>");
  assert.equal((HTML.match(new RegExp('id="' + 'mw-party-' + 'rail"', "g")) || []).length, 0);
});

// ─── (c) HUD CSS ────────────────────────────────────────────────────────

test("(c) HUD CSS: .mw-hud/.mw-hud-top/.mw-hud-row/.mw-hud-item/.mw-hud-wp* values match the mock", () => {
  assert.match(HTML, /^\.mw-hud\{flex:none;background:#1b170f;border-bottom:3px solid #3a3226;padding:calc\(8px \+ var\(--safe-area-inset-top, env\(safe-area-inset-top, 0px\)\)\) 14px 9px;display:flex;flex-direction:column\}$/m);
  assert.doesNotMatch(HTML, /\.mw-hud\{[^}]*position:sticky/);
  assert.match(HTML, /^\.mw-hud-top\{display:flex;align-items:center;gap:10px\}$/m);
  assert.match(HTML, /^\.mw-hud-row\{display:flex;gap:8px;align-items:baseline;flex:1;min-width:0;overflow:hidden;flex-wrap:nowrap\}$/m);
  assert.equal((HTML.match(/^\.mw-hud-floor b\{color:#e8c97a\}$/gm) || []).length, 1);
  assert.equal((HTML.match(/^\.mw-hud-rations\.warn b\{color:#e05a48\}$/gm) || []).length, 1);
  assert.match(HTML, /^\.mw-hud-wptrack\{width:64px;height:5px;/m);
  assert.equal((HTML.match(/^\.mw-hud-wpfill\.mid\{background:#e8c97a\}$/gm) || []).length, 1);
  assert.equal((HTML.match(/^\.mw-hud-wpfill\.low\{background:#e05a48\}$/gm) || []).length, 1);
  assert.equal((HTML.match(/^\.mw-hud-wp-text\.low\{color:#e05a48\}$/gm) || []).length, 1);
  assert.equal((HTML.match(/--mw-font-hud-label:calc\(0\.40625rem \* var\(--mw-text-scale\)\)/g) || []).length, 1);
  assert.equal((HTML.match(/--mw-font-hud-num:calc\(1rem \* var\(--mw-text-scale\)\)/g) || []).length, 1);
});

// ─── (d) chip CSS + the four condition tone rules ─────────────────────────

test("(d) condition-chip strip CSS: .mw-cond-strip/.mw-cond values and the four tone rules", () => {
  assert.match(HTML, /^\.mw-cond-strip\{flex:none;display:flex;gap:5px;overflow-x:auto;padding:6px 14px 7px;border-bottom:3px solid #3a3226;background:#181409\}$/m);
  assert.match(HTML, /^\.mw-cond-strip\[hidden\]\{display:none\}$/m);
  assert.match(HTML, /^\.mw-cond\{display:flex;align-items:baseline;gap:4px;flex:none;border:1px solid var\(--cond-edge\);background:#1b170f;padding:3px 5px;[^}]*font-size:5\.5px;/m);
  assert.equal((HTML.match(/^\.mw-cond\[data-tone="bad"\]\{--cond-edge:#a63a2c;--cond-ink:#e07260\}$/gm) || []).length, 1);
  assert.equal((HTML.match(/^\.mw-cond\[data-tone="warn"\]\{--cond-edge:#6b5c3c;--cond-ink:#e8c97a\}$/gm) || []).length, 1);
  assert.equal((HTML.match(/^\.mw-cond\[data-tone="odd"\]\{--cond-edge:#5b4a86;--cond-ink:#b9a4ef\}$/gm) || []).length, 1);
  assert.equal((HTML.match(/^\.mw-cond\[data-tone="good"\]\{--cond-edge:#5e7a3c;--cond-ink:#a8cc72\}$/gm) || []).length, 1);
  assert.match(HTML, /^\.mw-cond-detail\{font-family:var\(--mono\);font-weight:700;font-size:10px;color:#8f856f\}$/m);
});

// ─── (e) CONDITION_TONE/CONDITION_EXPLAIN + voice scan ────────────────────

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

function extractObjectLiteral(name) {
  const start = CODE.indexOf(`const ${name} = {`);
  assert.ok(start !== -1, `const ${name} = { not found`);
  const braceStart = CODE.indexOf("{", start);
  let depth = 0;
  let i = braceStart;
  for (; i < CODE.length; i++) {
    if (CODE[i] === "{") depth++;
    else if (CODE[i] === "}") { depth--; if (depth === 0) break; }
  }
  return CODE.slice(braceStart, i + 1);
}

test("(e) CONDITION_TONE keys are a subset of CONDITION_COPY keys plus affliction; CONDITION_EXPLAIN carries every CONDITION_TONE key plus default", () => {
  const toneLiteral = extractObjectLiteral("CONDITION_TONE");
  const toneKeys = [...toneLiteral.matchAll(/(\w+):\s*"(?:good|bad|warn|odd)"/g)].map((m) => m[1]);
  assert.ok(toneKeys.length >= 10, "expected at least 10 CONDITION_TONE entries");

  const copyLiteral = extractObjectLiteral("CONDITION_COPY");
  const copyKeys = [...copyLiteral.matchAll(/(\w+):\s*\{\s*label:/g)].map((m) => m[1]);
  const allowedToneKeys = new Set([...copyKeys, "affliction"]);
  for (const key of toneKeys) {
    assert.ok(allowedToneKeys.has(key), `CONDITION_TONE key "${key}" must be a CONDITION_COPY key or "affliction"`);
  }

  const explainLiteral = extractObjectLiteral("CONDITION_EXPLAIN");
  const explainMatches = [...explainLiteral.matchAll(/(\w+):\s*"([^"\\]*(?:\\.[^"\\]*)*)"/g)];
  const explainKeys = explainMatches.map((m) => m[1]);
  for (const key of toneKeys) {
    assert.ok(explainKeys.includes(key), `CONDITION_EXPLAIN is missing the "${key}" key`);
  }
  assert.ok(explainKeys.includes("default"), "CONDITION_EXPLAIN must carry a default fallback");

  for (const [, leaf] of explainMatches) {
    assert.ok(leaf.length > 0, "every CONDITION_EXPLAIN leaf must be non-empty");
    const offenders = findBannedTerms(leaf);
    assert.deepStrictEqual(offenders, [], `Banned copy in CONDITION_EXPLAIN: ${JSON.stringify(offenders)} (text: "${leaf}")`);
  }
});

test("(e) voice scan: every MAP_COPY string leaf is non-empty and clear of BANNED", () => {
  const literal = extractObjectLiteral("MAP_COPY");
  const leaves = [...literal.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"/g)].map((m) => m[1]);
  assert.ok(leaves.length >= 3, "expected at least the camp copy/sleep/walk leaves");
  for (const leaf of leaves) {
    assert.ok(leaf.length > 0, "every MAP_COPY string leaf must be non-empty");
    const offenders = findBannedTerms(leaf.replace(/\\n/g, " "));
    assert.deepStrictEqual(offenders, [], `Banned copy in MAP_COPY: ${JSON.stringify(offenders)} (text: "${leaf}")`);
  }
});

// ─── (f) paintConditions wiring ────────────────────────────────────────────

test("(f) paintConditions: createElement(button), data-tone from CONDITION_TONE with the polarity fallback, guardTap + mzRailLine wiring, the key gate, the foeEffect/affliction label chain untouched", () => {
  const region = paintConditionsRegion();
  assert.match(region, /document\.createElement\("button"\)/);
  // 260919-00d (Cloak of Ether wall-walking): the tone assignment gained a
  // leading in-stone warn-tone special case for the ether chip; the
  // original CONDITION_TONE-with-polarity-fallback expression survives
  // verbatim as the ternary's else branch.
  assert.match(region, /btn\.dataset\.tone = cn\.key === "ether" && window\.__mzEther\?\.inStone\(S\)/);
  assert.match(region, /CONDITION_TONE\[cn\.key\] \|\| \(cn\.polarity === "bad" \? "bad" : "good"\)/);
  assert.match(region, /guardTap\(btn, \(\) => window\.mzRailLine\?\.\(/);
  // Phase 39 (GEAR-02/GEAR-05), Plan 05: the tap explanation now routes
  // through explainCondition(cn, label) — the item-sourced-chip-aware
  // wrapper around the plain CONDITION_EXPLAIN[cn.key] fallback (which
  // explainCondition itself still reads, just no longer inline here).
  assert.match(region, /explainCondition\(cn, label\)/);
  assert.match(region, /lastCondKeyShown/);
  assert.match(region, /armEncounterButtons\(\);/);
  assert.equal((region.match(/innerHTML/g) || []).length, 2, 'exactly the two innerHTML clears (empty-branch + the "" reset before the loop)');

  // The foeEffect/affliction label chain from foe-effect-chip.test.js stays byte-identical.
  const afflictionIdx = region.indexOf('cn.key === "affliction"');
  const foeEffectIdx = region.indexOf('cn.key === "foeEffect"');
  const fallbackIdx = region.indexOf("(CONDITION_COPY[cn.key]?.label || cn.key)");
  assert.ok(afflictionIdx >= 0 && foeEffectIdx >= 0 && fallbackIdx >= 0, "one of the label-chain anchors is missing");
  assert.ok(foeEffectIdx > afflictionIdx && foeEffectIdx < fallbackIdx, "affliction, then foeEffect, then the generic fallback");
});

// ─── (g) paint() WP writes, no character-line writes ──────────────────────

test("(g) paint(): writes the WP text/fill with the 25/50/22 thresholds, and no character-line writes survive", () => {
  const region = paintRegion();
  assert.match(region, /wpText\.textContent = `\$\{Math\.max\(0, c\.wp\)\}\/\$\{c\.maxWP\} HP`;/);
  assert.match(region, /wpText\.classList\.toggle\("low", pct <= 25\)/);
  assert.match(region, /wpFill\.classList\.toggle\("mid", pct <= 50 && pct > 22\)/);
  assert.match(region, /wpFill\.classList\.toggle\("low", pct <= 22\)/);
  for (const gone of ["hud-name", "hud-cls", "mm-hp"]) {
    assert.doesNotMatch(region, new RegExp(gone));
  }
});

// ─── (h) viewport chrome ────────────────────────────────────────────────

test("(h) chrome: chip ids/order/classes (MARKS, CENTRE, gap, MAKE CAMP, gear), the pulse element, zero retired chip-row/flash literals, .mw-map-chip.camp/.gear colours", () => {
  const chipsStart = HTML.indexOf('<div class="mw-map-chips" id="mw-map-chips">');
  // Phase 35 Plan 04 (MAP-02) re-pin: the control bar (formerly the end
  // marker here) is retired outright — the next markup landmark after the
  // party-pulse ring is the encounter overlay section.
  const chipsEnd = HTML.indexOf('<section class="mw-overlay"');
  assert.ok(chipsStart !== -1 && chipsEnd !== -1 && chipsEnd > chipsStart);
  const region = HTML.slice(chipsStart, chipsEnd);
  const marksIdx = region.indexOf('id="mw-chip-marks"');
  const centreIdx = region.indexOf('id="mw-chip-centre"');
  const gapIdx = region.indexOf('class="mw-map-chips-gap"');
  const campIdx = region.indexOf('id="btn-camp"');
  const gearIdx = region.indexOf('id="mw-gear-btn"');
  assert.ok(marksIdx !== -1 && centreIdx !== -1 && gapIdx !== -1 && campIdx !== -1 && gearIdx !== -1);
  assert.ok(marksIdx < centreIdx && centreIdx < gapIdx && gapIdx < campIdx && campIdx < gearIdx, "MARKS, CENTRE, the gap, MAKE CAMP, then the settings gear");
  assert.match(region, /class="mw-map-chip camp" id="btn-camp"/);
  assert.match(region, /class="mw-map-chip gear" id="mw-gear-btn" aria-label="Settings"/);
  assert.match(region, /id="mw-party-pulse" aria-hidden="true"/);

  for (const literal of ["mw-viewport-chips", "mw-flash", "flashMessage", "MAZE_CANVAS_COLORS"]) {
    assert.equal((HTML.match(new RegExp(escapeRegExp(literal), "g")) || []).length, 0, `expected zero occurrences of "${literal}"`);
  }

  assert.match(HTML, /^\.mw-map-chip\.camp\{background:#241d12;border-color:#6b5c3c\}$/m);
  assert.match(HTML, /^\.mw-map-chip\.gear\{[^}]*font-size:22px[^}]*\}$/m);
  assert.equal((HTML.match(/@keyframes mwglow/g) || []).length, 1);
});

// ─── (h) PERF 2026-09-17: composited party pulse ───────────────────────────

test('(h) PERF 2026-09-17: the party pulse animates only composited properties (static ring shadow, opacity/transform keyframes, will-change)', () => {
  assert.match(HTML, /^\.mw-party-pulse\{[^}]*box-shadow:0 0 0 3px #14110c,0 0 14px 3px rgba\(232,201,122,\.5\)[^}]*will-change:transform,opacity[^}]*animation:mwglow 1\.6s ease-in-out infinite\}$/m);
  const kf = HTML.match(/^@keyframes mwglow\{.*\}\}$/m)[0];
  assert.doesNotMatch(kf, /box-shadow/);
  assert.match(kf, /0%,100%\{opacity:\.55;transform:scale\(1\)\}/);
  assert.match(kf, /50%\{opacity:1;transform:scale\(1\.18\)\}/);
  assert.match(HTML, /^@media \(prefers-reduced-motion:reduce\)\{\*\{transition:none!important;animation:none!important\}\}$/m);
});

test('(h) PERF addendum 2026-09-17: the party pulse is paused/hidden while the encounter panel covers the map (Chromium tile-memory starvation fix)', () => {
  assert.match(HTML, /^\.mw-party-pulse\.covered\{animation-play-state:paused;visibility:hidden\}$/m);
  const a = CODE.indexOf("function renderEncounter() {");
  const b = CODE.indexOf("\nfunction ", a + 1);
  assert.ok(a !== -1 && b !== -1 && b > a, "renderEncounter() region found");
  const region = CODE.slice(a, b);
  assert.match(region, /if \(panel\) panel\.hidden = true;\s*\n\s*document\.getElementById\("mw-party-pulse"\)\?\.classList\.remove\("covered"\);/);
  assert.match(region, /if \(panel\) panel\.hidden = false;\s*\n\s*document\.getElementById\("mw-party-pulse"\)\?\.classList\.add\("covered"\);/);
});

// ─── (i) canvas: draw() region positive/negative pins ─────────────────────

test("(i) draw(): reads the palette from window.__mzMapMarks and the marks/party from the PNG pipeline (v1.3 canon restored 2026-09-16), positionCanvas() last", () => {
  const region = drawRegion();
  for (const needle of [
    "window.__mzMapMarks",
    "P.fog",
    "P.wall",
    "P.wallLight",
    "P.wallDark",
    "P.floor",
    "P.floorDark",
    "P.floorInset",
    "P.border",
    "P.party",
    "strokeRect(3, 3, size - 6, size - 6)",
    "window.__mzIconsApi",
    "window.__mzIconMap",
    "img.complete && img.naturalWidth > 0",
    "iconsApi.featureKeyForCell(c)",
    "iconsApi.drawFeatureIcon(ctx, img, x * CELL, y * CELL, CELL, c.dir, 0.75)",
    "iconMap[iconsApi.PLAYER_MARKER_ICON]",
    "iconsApi.drawFeatureIcon(ctx, partyImg, px * CELL, py * CELL, CELL)",
    "createRadialGradient(",
  ]) {
    assert.ok(region.includes(needle), `draw() region must include "${needle}"`);
  }
  for (const gone of ["getComputedStyle", "globalAlpha", "ctx.fillText(mark.glyph", "MARK_SCALE", "markForCell("]) {
    assert.ok(!region.includes(gone), `draw() region must not include "${gone}"`);
  }
  assert.match(region.trimEnd(), /positionCanvas\(\);\s*\}$/);

  // The preload/bridge lines outside draw() stay untouched — no asset deletion.
  assert.equal((HTML.match(/window\.__mzIconMap = await preloadIcons/g) || []).length, 1);
});

test("(i) positionCanvas() calls positionPartyPulse(rect); positionPartyPulse is defined once", () => {
  assert.equal((CODE.match(/^function positionPartyPulse\(rect\)/gm) || []).length, 1);
  const region = fnRegion("function positionCanvas()");
  assert.match(region, /positionPartyPulse\(rect\)/);
});

// ─── (j) legend: PNG <img> rows (v1.3 canon), zero glyph span ─────────────

test("(j) renderMarksLegend: reads MARKS_LEGEND from the bridge, builds PNG <img> rows (v1.3 canon), zero glyph span", () => {
  const region = renderMarksLegendRegion();
  assert.match(region, /window\.__mzMapMarks/);
  assert.match(region, /MARKS_LEGEND/);
  assert.match(region, /createElement\("img"\)/);
  assert.match(region, /icons\/optimized\/\$\{row\.key\}\.png/);
  assert.match(region, /setAttribute\("aria-hidden", "true"\)/);
  assert.doesNotMatch(region, /mw-legend-glyph/);
  assert.doesNotMatch(region, /MARK_GLYPHS/);
  assert.doesNotMatch(region, /style\.color/);
  assert.equal((HTML.match(/const MARKS_LEGEND = \[/g) || []).length, 0, "the classic table stays retired — data still lives in mapMarks.js");
  assert.match(HTML, /^\.mw-legend-row img\{width:34px;height:34px;object-fit:contain;flex:none\}$/m);
  assert.equal((HTML.match(/mw-legend-glyph/g) || []).length, 0);
});

// ─── (k) camp sheet ─────────────────────────────────────────────────────

test("(k) camp sheet markup: the ids exist, sit inside a .mw-legend-sheet with a scrim", () => {
  for (const id of ["mw-camp-sheet", "mw-camp-scrim", "mw-camp-copy", "mw-camp-sleep", "mw-camp-walk"]) {
    assert.equal((HTML.match(new RegExp(`id="${id}"`, "g")) || []).length, 1, `id="${id}" must appear exactly once`);
  }
  const sheetStart = HTML.indexOf('<div id="mw-camp-sheet"');
  const sheetEnd = HTML.indexOf("</div>\n</div>\n", sheetStart);
  assert.ok(sheetStart !== -1);
  const region = HTML.slice(sheetStart, sheetStart + 900);
  assert.match(region, /class="mw-legend-sheet" hidden/);
  assert.match(region, /class="mw-legend-scrim" id="mw-camp-scrim"/);
});

test("(k) MAP_COPY.camp carries the exact sleep/walk/copy literals", () => {
  assert.equal((HTML.match(/^const MAP_COPY = \{/gm) || []).length, 1);
  const literal = extractObjectLiteral("MAP_COPY");
  assert.match(literal, /sleep: "SLEEP\\n1 RATION"/);
  assert.match(literal, /walk: "WALK\\nON"/);
  assert.match(literal, /copy: "Eight hours asleep/);
});

test("(k) openCampSheet/closeCampSheet: the refusal/lock/arm/guard wiring, both settle stamps, the scrim listener, the onclick wiring", () => {
  const region = openCampSheetRegion();
  assert.match(region, /hasActiveEncounter\(\)/);
  assert.match(region, /railLocked\(\)/);
  assert.match(region, /railPulse\(\);/);
  assert.match(region, /armEncounterButtons\(\);/);
  assert.match(region, /guardTap\(document\.getElementById\("mw-camp-sleep"\)/);
  assert.match(region, /guardTap\(document\.getElementById\("mw-camp-walk"\)/);
  assert.match(region, /window\.mzMakeCamp/);

  const closeCampIdx = CODE.indexOf("function closeCampSheet()");
  const closeMarksIdx = CODE.indexOf("function closeMarksLegend()");
  assert.ok(closeCampIdx !== -1 && closeMarksIdx !== -1);
  const closeCampRegion = CODE.slice(closeCampIdx, closeCampIdx + 200);
  const closeMarksRegion = CODE.slice(closeMarksIdx, closeMarksIdx + 200);
  assert.match(closeCampRegion, /lastDismissAt = Date\.now\(\);/);
  assert.match(closeMarksRegion, /lastDismissAt = Date\.now\(\);/);

  assert.equal((CODE.match(/document\.getElementById\("mw-camp-scrim"\)\.addEventListener\("click", closeCampSheet\);/g) || []).length, 1);
  assert.equal((CODE.match(/document\.getElementById\("btn-camp"\)\.onclick = openCampSheet;/g) || []).length, 1);
});

// ─── (l) settle-stamp / encounterSettled counts ────────────────────────────

test("(l) settle-stamp count is 3 (the dismissal transition + the two sheet closes) and encounterSettled() is unchanged at 2", () => {
  assert.equal((CODE.match(/lastDismissAt = Date\.now\(\)/g) || []).length, 3);
  assert.equal((CODE.match(/encounterSettled\(\)/g) || []).length, 2);
});

// ─── (m) BEHAVIOUR: the real mapMarks.js mapping/rotation table ───────────

test("(m) BEHAVIOUR: markForCell/ONEWAY_ROTATION_DEG stay intact in mapMarks.js for inspectAt's legend lookups (the canvas rotation is drawFeatureIcon's again)", () => {
  const mark = markForCell({ feat: "one", dir: "S" });
  assert.ok(mark, "markForCell must resolve a one-way-door cell");
  assert.equal(mark.key, "onewaydoor");
  assert.equal(ONEWAY_ROTATION_DEG.S, 180);
});

test("(m) BEHAVIOUR: the <style> block still carries no aria-disabled selector (no visual flicker from the new chip buttons)", () => {
  assert.doesNotMatch(styleBlock(), /aria-disabled/);
});
