// test/unit/layout-shell.test.js
//
// Phase 97 (SCREEN-02..06): source pins for the size-class shell. Successor to
// the retired DROID-03 letterbox pins (android-large-screen.test.js, 97-01).
//
// Comment-stripped scans of mazeworld.html (tools/ident-sweep.mjs's stripJs /
// stripHtml, the strippers the other shell pin tests trust).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { stripJs, stripHtml } from "../../tools/ident-sweep.mjs";
import { LAYOUT_MEDIA } from "../../src/browser/layoutClass.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8").replace(/\r\n/g, "\n");
const CODE = stripJs(HTML);
const MARKUP = stripHtml(HTML);

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start !== -1, `start marker not found: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end !== -1, `end marker not found after start: ${endMarker}`);
  return source.slice(start, end);
}
const count = (source, literal) => source.split(literal).length - 1;

// ─── (a)-(e) the Settings Screen row and its orientation wiring (SCREEN-02) ──

test("(a) Settings: one Screen group (Portrait / Rotate) in a hidden mw-screen-row, between the Pad row and Confirm abandon", () => {
  assert.equal(count(MARKUP, 'data-setting="screen"'), 1);
  const row = sliceBetween(MARKUP, 'id="mw-screen-row"', "</div>\n      </div>");
  assert.match(MARKUP.slice(MARKUP.indexOf('id="mw-screen-row"') - 40, MARKUP.indexOf('id="mw-screen-row"') + 40), /class="mw-settings-row" id="mw-screen-row" hidden/);
  assert.match(row, /<button type="button" class="mw-settings-opt" data-value="portrait">Portrait<\/button>/);
  assert.match(row, /<button type="button" class="mw-settings-opt" data-value="rotate">Rotate<\/button>/);
  assert.equal(count(row, 'class="mw-settings-opt"'), 2);
  const pad = MARKUP.indexOf('id="mw-pad-side-row"');
  const screen = MARKUP.indexOf('id="mw-screen-row"');
  const confirm = MARKUP.indexOf('data-setting="confirmBeforeQuit"');
  assert.ok(pad !== -1 && pad < screen && screen < confirm);
});

test("(b) renderSettingsSheet hides the Screen row unless the device is a phone", () => {
  const render = sliceBetween(CODE, "function renderSettingsSheet()", "function openSettingsSheet()");
  assert.match(render, /getElementById\("mw-screen-row"\)/);
  assert.match(render, /screenRow\.hidden = !isPhoneDevice\(\)/);
});

test("(c) the settings click handler re-applies the orientation rule when Screen is written", () => {
  const handler = sliceBetween(CODE, 'document.getElementById("mw-settings-rows")?.addEventListener("click"', "function volSliderValue(");
  assert.match(handler, /if \(key === "screen"\) syncOrientationLock\(\);/);
});

test("(d) registerNativeChrome receives the saved Screen choice and the smallest width", () => {
  const call = sliceBetween(CODE, "registerNativeChrome({", "getGameContext:");
  assert.match(call, /getScreenPref: \(\) => window\.__mzSettings\?\.screen,/);
  assert.match(call, /getSmallestWidth: \(\) => smallestScreenWidth\(\),/);
  // The older arguments stay byte-identical (title-music-shell, shell-board).
  assert.match(call, /waitForPending: \(\) => Promise\.all\(\[waitForPending\(\), boardSync\.waitForPending\(\)\]\),/);
  assert.match(call, /onBackground: \(\) => setAppActive\(false\),/);
  assert.match(call, /onForeground: \(\) => setAppActive\(true\),/);
});

test("(e) isPhoneDevice compares the smallest side against the imported PHONE_SMALLEST_WIDTH_LIMIT", () => {
  assert.match(CODE, /import \{ registerNativeChrome, PHONE_SMALLEST_WIDTH_LIMIT, syncOrientationLock \} from "\.\/src\/browser\/nativeChrome\.js";/);
  assert.match(CODE, /function smallestScreenWidth\(\) \{\s*return Math\.min\(Number\(window\.screen\?\.width\), Number\(window\.screen\?\.height\)\);\s*\}/);
  assert.match(CODE, /function isPhoneDevice\(\) \{\s*return !\(smallestScreenWidth\(\) >= PHONE_SMALLEST_WIDTH_LIMIT\);\s*\}/);
});


// ─── (f)-(j) the mw-layout block (SCREEN-03..06) ─────────────────────────────

const HEAD = HTML.match(/<head>([\s\S]*?)<\/head>/)[1];
const STYLE_ELEMENTS = [...HEAD.matchAll(/<style([^>]*)>([\s\S]*?)<\/style>/g)];
const noComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const ALL_CSS = noComments(STYLE_ELEMENTS.map((m) => m[2]).join("\n"));
const LAYOUT_STYLE = STYLE_ELEMENTS.find((m) => /id="mw-layout"/.test(m[1]));
const LAYOUT_CSS = LAYOUT_STYLE ? noComments(LAYOUT_STYLE[2]) : "";

test("(f) one mw-layout style block, last in <head>, with BEGIN/END markers; no letterbox column, body max-width or contain:layout", () => {
  assert.equal(count(HTML, '<style id="mw-layout">'), 1);
  assert.ok(LAYOUT_STYLE, "the mw-layout element exists in <head>");
  assert.equal(STYLE_ELEMENTS[STYLE_ELEMENTS.length - 1], LAYOUT_STYLE, "mw-layout is the last <style> in <head>");
  assert.match(LAYOUT_STYLE[2], /\/\* BEGIN mw-layout \(Phase 97, SCREEN-03\.\.06\)/);
  assert.match(LAYOUT_STYLE[2], /\/\* END mw-layout \*\//);
  assert.equal(count(HTML, "mw-letterbox"), 0);
  assert.doesNotMatch(ALL_CSS, /(?<![\w-])body(?![\w-])[^{]*\{[^}]*max-width/i, "no rule sets max-width on body");
  assert.doesNotMatch(ALL_CSS, /(?<![\w-])body(?![\w-])[^{]*\{[^}]*contain\s*:\s*layout/i, "no rule sets contain:layout on body");
});

test("(g) every @media query is a LAYOUT_MEDIA string, (hover: hover) or (prefers-reduced-motion:reduce)", () => {
  const allowed = new Set([...Object.values(LAYOUT_MEDIA), "(hover: hover)", "(prefers-reduced-motion:reduce)"]);
  const queries = [...ALL_CSS.matchAll(/@media ([^{]*)\{/g)].map((m) => m[1].trim());
  assert.ok(queries.length >= 3, "the stylesheet still has its media queries");
  for (const q of queries) assert.ok(allowed.has(q), `@media query not from the one source: ${q}`);
  assert.ok(queries.includes(LAYOUT_MEDIA.compact), "the compact query is used (the stacked dossier)");
});

const DVH_RULES = [
  "#app.mw-app{height:100dvh}",
  ".mw-hud-menu{max-height:calc(100dvh - 180px - var(--safe-area-inset-top, env(safe-area-inset-top, 0px)) - var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)))}",
  ".mw-legend-panel{max-height:78dvh}",
  ".log{max-height:min(44dvh,440px)}",
  ".mw-find-drop{max-height:min(34dvh, calc(15rem * var(--mw-text-scale)))}",
  ".mw-report-text{max-height:40dvh}",
];

test("(h) the dvh group holds the six twins; vh survives only as the six base fallbacks", () => {
  const group = sliceBetween(LAYOUT_CSS, "@supports (height: 100dvh) {", "\n}");
  const squash = (s) => s.replace(/\s+/g, " ");
  for (const rule of DVH_RULES) assert.ok(squash(group).includes(squash(rule)), `dvh twin missing: ${rule}`);
  const outside = ALL_CSS.replace(group, "");
  assert.doesNotMatch(outside, /(?<![\w-])\d*\.?\d+dvh/, "dvh appears only inside the @supports group");
  const vhLengths = [...outside.matchAll(/(?<![\w-])\d*\.?\d+vh\b/g)].map((m) => m[0]);
  assert.deepEqual(vhLengths.sort(), ["100vh", "100vh", "34vh", "40vh", "44vh", "78vh"]);
});

test("(i) the side insets pad the HUD bands, strip, tab bar, stage, rail, sheets, title and roller", () => {
  const L = "var(--safe-area-inset-left, env(safe-area-inset-left, 0px))";
  const R = "var(--safe-area-inset-right, env(safe-area-inset-right, 0px))";
  const both = (sel, base) =>
    assert.ok(
      LAYOUT_CSS.includes(`  ${sel}{padding-left:calc(${base}px + ${L});padding-right:calc(${base}px + ${R})}`),
      `inset rule missing: ${sel}`
    );
  both(".mw-hud-identity", 14);
  both(".mw-hud-band2", 14);
  both(".mw-cond-strip", 14);
  both("#mw-rail", 16);
  both(".mw-legend-panel", 18);
  both(".mw-title-body", 24);
  both(".mw-roller-screen", 20);
  assert.ok(LAYOUT_CSS.includes(`  .mw-tabbar{padding-left:${L};padding-right:${R}}`));
  assert.ok(LAYOUT_CSS.includes(`  #mw-stage{padding-left:${L};padding-right:${R}}`));
  assert.ok(LAYOUT_CSS.includes(`  .mw-title-acct{right:calc(12px + ${R})}`));
  assert.ok(LAYOUT_CSS.includes(`  #mw-fightlog-sheet .mw-legend-panel{padding-left:${L};padding-right:${R}}`));
});

test("(i2) every style rule inside mw-layout is indented, so the line-start CSS pin tests keep reading the base rules", () => {
  const lines = LAYOUT_CSS.split("\n").filter((l) => l.trim() !== "");
  for (const line of lines) {
    if (/^@(supports|media)\b/.test(line) || line === "}") continue;
    assert.match(line, /^ {2}\S/, `unindented rule in mw-layout: ${line.slice(0, 60)}`);
  }
});

test("(j) the dead desk grid, the vitals strip and the 1080/700 queries are gone", () => {
  assert.doesNotMatch(ALL_CSS, /\.desk\{/);
  assert.doesNotMatch(ALL_CSS, /\.col-right/);
  assert.doesNotMatch(ALL_CSS, /\.vitals\{/);
  assert.equal(count(HTML, "(max-width:1080px)"), 0);
  assert.equal(count(HTML, "(max-width:700px)"), 0);
});

// ─── (k)-(m) the layout watcher, keep-in-view, window-scaled cells ──────────

test("(k) the module imports layoutClass.js, assigns window.__mzLayout once, and syncs the class, the lock and the observers", () => {
  assert.match(CODE, /import \{ LAYOUT_MEDIA, currentLayoutClass, railBesideMap, mapStaysUp \} from "\.\/src\/browser\/layoutClass\.js";/);
  assert.equal(count(CODE, "window.__mzLayout ="), 1);
  const bridge = sliceBetween(CODE, "window.__mzLayout = Object.freeze({", "});");
  assert.match(bridge, /current: \(\) => layoutCls,/);
  assert.match(bridge, /railBeside: \(\) => railBesideMap\(layoutCls\),/);
  assert.match(bridge, /mapStaysUp: \(\) => mapStaysUp\(layoutCls\),/);
  const sync = sliceBetween(CODE, "function syncLayout() {", "window.__mzLayout =");
  assert.match(sync, /document\.documentElement\.dataset\.mwLayout = next;/);
  assert.match(sync, /syncOrientationLock\(\);\s*\}\s*$/, "syncOrientationLock runs last");
  assert.match(sync, /window\.mzSyncArrowPad\?\.\(\)/);
  const watch = sliceBetween(CODE, "syncLayout();\n", "mazeVp) new ResizeObserver");
  assert.match(watch, /\[LAYOUT_MEDIA\.short, LAYOUT_MEDIA\.medium, LAYOUT_MEDIA\.expanded\]/);
  assert.match(watch, /window\.matchMedia\?\.\(q\)\?\.addEventListener\?\.\("change", syncLayout\)/);
  assert.match(watch, /typeof ResizeObserver === "function"/);
  assert.match(watch, /new ResizeObserver\(\(\) => syncLayout\(\)\)\.observe\(document\.documentElement\)/);
  assert.match(CODE, /document\.getElementById\("mw-maze-viewport"\);\s*if \(mazeVp\) new ResizeObserver\(\(\) => window\.mzKeepPartyInView\?\.\(\)\)\.observe\(mazeVp\);/);
});

test("(l) fit() sizes cells through cellScaleForWindow / cellPxFor on the canvasSizing bridge, keeping the old math as the fallback", () => {
  const fit = sliceBetween(CODE, "function fit() {", "function positionCanvas()");
  assert.match(fit, /sizing\.cellScaleForWindow\(window\.innerWidth, window\.innerHeight\)/);
  assert.match(fit, /sizing\.cellPxFor\(baseCell, zoom, winScale\)/);
  assert.match(fit, /Math\.max\(6, Math\.round\(baseCell \* zoom\)\)/);
  assert.match(CODE, /window\.__mzCanvasSizing = \{ computeCanvasBacking, cellSizeForTextScale, cellScaleForWindow, cellPxFor \};/);
  assert.match(CODE, /import \{ computeCanvasBacking, cellSizeForTextScale, cellScaleForWindow, cellPxFor \} from "\.\/src\/browser\/canvasSizing\.js";/);
});

test("(m) the classic resize listener is the only window resize listener, byte-identical", () => {
  assert.equal(count(CODE, 'addEventListener("resize"'), 1);
  assert.ok(CODE.includes('addEventListener("resize", () => { fit(); window.mzKeepPartyInView?.(); renderEncounter(); });'));
});
