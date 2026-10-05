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
import vm from "node:vm";

import { newRun } from "../../engine/state.js";
import { die } from "../../engine/death.js";
import { makeRng } from "../../engine/rng.js";
import { createRecordingDocument } from "./harness/recordingDom.js";
import { loadShellSandbox } from "./harness/shellSandbox.js";

import { stripJs, stripHtml } from "../../tools/ident-sweep.mjs";
import { LAYOUT_MEDIA, LAYOUT_SIDE_WIDTH, LAYOUT_READABLE_MAX_PX } from "../../src/browser/layoutClass.js";

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
  // Phase 97 (SCREEN-04): declared re-pin. The expanded group (97-05) holds body[data-boards-entry="title"] #screen-dead{max-width:640px...}, a rule for a descendant of body; the pin now matches only rules whose subject is body itself (body, html>body, body[attr]).
  assert.doesNotMatch(ALL_CSS, /(?<![\w-])body(?:\[[^\]]*\])*\s*\{[^}]*max-width/i, "no rule sets max-width on body");
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
  // Phase 97 (SCREEN-03): declared re-pin — the SHORT group (97-04) carries two
  // vh-fallback + dvh pairs of its own (the ☰ dropdown and the sheet panel),
  // each vh declaration immediately followed by its dvh twin; they are checked
  // here and taken out of the scan below.
  const shortGroup = mediaGroup(ALL_CSS, LAYOUT_MEDIA.short);
  assert.deepEqual([...shortGroup.matchAll(/(?<![\w-])\d*\.?\d+dvh\b/g)].map((m) => m[0]), ["100dvh", "100dvh"]);
  assert.deepEqual([...shortGroup.matchAll(/(?<![\w-])\d*\.?\d+vh\b/g)].map((m) => m[0]), ["100vh", "100vh"]);
  assert.equal([...shortGroup.matchAll(/max-height:calc\(100vh - ([^;]*)\);max-height:calc\(100dvh - \1\)/g)].length, 2, "each vh fallback is followed by its dvh twin");
  const outside = ALL_CSS.replace(group, "").replace(shortGroup, "");
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

// ─── (n)-(p) the tab and panel attributes, and the pad's card rule (SCREEN-03) ─

test("(n) showTab writes data-tab on #mw-stage right after mwActiveTab = name;", () => {
  assert.equal(count(CODE, "mwActiveTab = name;"), 1);
  const at = CODE.indexOf("mwActiveTab = name;");
  const after = CODE.slice(at + "mwActiveTab = name;".length).trimStart();
  assert.ok(after.startsWith('document.getElementById("mw-stage")?.setAttribute("data-tab", name);'), "the stage attribute follows the tab write");
});

test("(o) renderEncounter writes data-panel-up on #mw-stage right after encWasActive = active; and nothing on #enc-panel", () => {
  assert.equal(count(CODE, "encWasActive = active;"), 1);
  const at = CODE.indexOf("encWasActive = active;");
  const after = CODE.slice(at + "encWasActive = active;".length).trimStart();
  assert.ok(after.startsWith('document.getElementById("mw-stage")?.setAttribute("data-panel-up", active ? "1" : "0");'));
  // #enc-panel is a store snapshot root: no data-* attribute is ever written on it by this plan.
  assert.equal(count(CODE, 'setAttribute("data-panel-up"'), 1);
  assert.doesNotMatch(CODE, /"enc-panel"\)\??\.setAttribute\("data-/);
  assert.doesNotMatch(MARKUP, /id="enc-panel"[^>]*data-panel-up/);
});

test("(p) syncArrowPad's railUp expression reads window.__mzLayout?.railBeside?.()", () => {
  assert.ok(CODE.includes('pad.dataset.railUp = model.visible && !window.__mzLayout?.railBeside?.() && railEl && railEl.dataset.shown === "1" ? "1" : "0";'));
});

// ─── (q) the SIDE block (SCREEN-03/06) ──────────────────────────────────────

// The body of the @media group whose header is `@media ${query}{`, brace-matched.
function mediaGroup(css, query) {
  const header = `@media ${query}{`;
  const at = css.indexOf(header);
  assert.ok(at !== -1, `media group not found: ${header}`);
  let depth = 1;
  let i = at + header.length;
  for (; i < css.length && depth > 0; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") depth--;
  }
  assert.equal(depth, 0, "the media group closes");
  return css.slice(at + header.length, i - 1);
}
const T_INSET = "var(--safe-area-inset-top, env(safe-area-inset-top, 0px))";
const B_INSET = "var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px))";
const L_INSET = "var(--safe-area-inset-left, env(safe-area-inset-left, 0px))";
const R_INSET = "var(--safe-area-inset-right, env(safe-area-inset-right, 0px))";
const SIDE_W = "var(--mw-side-w, 45%)";

test("(q) exactly one SIDE media group (LAYOUT_MEDIA.side) holds the ten rule groups: nav rail, side panel, docked camp", () => {
  assert.equal(count(LAYOUT_CSS, `@media ${LAYOUT_MEDIA.side}{`), 1);
  assert.equal(count(HTML, `@media ${LAYOUT_MEDIA.side}{`), 1);
  const side = mediaGroup(LAYOUT_CSS, LAYOUT_MEDIA.side);
  const has = (rule) => assert.ok(side.includes(`  ${rule}\n`), `side rule missing: ${rule}`);
  // 1. the app grid
  has('#app.mw-app{display:grid;grid-template-columns:auto minmax(0,1fr);grid-template-rows:auto auto minmax(0,1fr);grid-template-areas:"nav hud" "nav cond" "nav stage"}');
  has("#mw-tabbar{grid-area:nav}");
  has("#mw-hud{grid-area:hud}");
  has("#mm-conditions{grid-area:cond}");
  has(`#mw-stage{grid-area:stage;flex-direction:row;padding-left:0;padding-bottom:${B_INSET}}`);
  // 2. the navigation rail
  has(`.mw-tabbar{flex-direction:column;border-top:0;border-right:2px solid var(--rule);padding:${T_INSET} 0 ${B_INSET} ${L_INSET}}`);
  has(".mw-tab{flex:1 1 0;min-height:48px;min-width:76px;padding:8px 6px;border-top:0;border-left:3px solid transparent}");
  has(".mw-tab.active{border-left-color:var(--ditto)}");
  // 3 + 4. screens beside the rail, the map box as a row
  has("#mw-screens{flex:1 1 0;min-width:0}");
  has(".mazebox{flex-direction:row}");
  has(".mw-maze-viewport{flex:1 1 0;width:auto;min-width:0;min-height:0}");
  // 5. the encounter panel as the right-hand column
  has(`#enc-panel{position:relative;top:auto;right:auto;bottom:auto;left:auto;flex:0 0 ${SIDE_W};width:${SIDE_W};min-width:0;align-self:stretch;border-left:3px solid #3a3226}`);
  // 6. the party stays visible beside the panel
  has(".mw-party-pulse.covered{visibility:visible;animation-play-state:running}");
  has(".mw-party-pulse.covered ~ .mw-party-sprite{visibility:visible}");
  has(".mw-party-pulse.covered ~ .mw-party-sprite .mw-party-frame{animation-play-state:running}");
  // 7. the arrow pad (the stage already pads the side insets)
  has('.mw-arrow-pad[data-side="right"]{right:12px}');
  has('.mw-arrow-pad[data-side="left"]{left:12px}');
  // 8. the rail card overlays by default; an empty rail takes no space
  has(`#mw-rail{top:auto;right:${R_INSET};bottom:${B_INSET};left:auto;width:${SIDE_W};max-height:70%;overflow-y:auto;padding-left:16px;padding-right:16px;transform:none}`);
  has("#mw-rail[hidden]{display:none!important}");
  // 9. the rail card as a column on the MAP tab (verbatim selector)
  has(`#mw-stage[data-tab="maze"]:not([data-panel-up="1"]) > #mw-rail:not([data-over]){position:relative;top:auto;right:auto;bottom:auto;flex:0 0 ${SIDE_W};width:${SIDE_W};max-height:none;align-self:stretch;border-top:0;border-left:3px solid var(--rail-edge)}`);
  // 10. Make Camp docked right, still modal
  has("#mw-camp-sheet{justify-content:flex-end;align-items:stretch}");
  has("#mw-camp-sheet .mw-legend-scrim{background:rgba(8,7,5,.35)}");
  has(`#mw-camp-sheet .mw-legend-panel{width:${SIDE_W};max-width:none;max-height:none;height:100%;margin:0;overflow-y:auto;border-top:0;border-left:3px solid #6b5c3c;padding-top:calc(18px + ${T_INSET});padding-right:calc(18px + ${R_INSET})}`);
  // every rule line inside the group is indented
  for (const line of side.split("\n").filter((l) => l.trim() !== "")) assert.match(line, /^ {2}\S/, `unindented side rule: ${line.slice(0, 60)}`);
});

test("(q2) the SIDE group sits after the global rules, and after the compact notes group, inside mw-layout", () => {
  const sideAt = LAYOUT_CSS.indexOf(`@media ${LAYOUT_MEDIA.side}{`);
  assert.ok(sideAt > LAYOUT_CSS.indexOf("  .mw-roller-screen{padding-left:"), "after the side-inset rules");
  assert.ok(sideAt > LAYOUT_CSS.indexOf("@supports (height: 100dvh) {"), "after the dvh group");
});

// ─── (r) the SHORT block (SCREEN-03) ─────────────────────────────────────────

test("(r) exactly one SHORT media group (LAYOUT_MEDIA.short), after the side group, holding the landscape-only rules", () => {
  assert.equal(count(LAYOUT_CSS, `@media ${LAYOUT_MEDIA.short}{`), 1);
  assert.ok(LAYOUT_CSS.indexOf(`@media ${LAYOUT_MEDIA.short}{`) > LAYOUT_CSS.indexOf(`@media ${LAYOUT_MEDIA.side}{`), "the short block follows the side block");
  const short = mediaGroup(LAYOUT_CSS, LAYOUT_MEDIA.short);
  const has = (rule) => assert.ok(short.includes(`  ${rule}\n`), `short rule missing: ${rule}`);
  // 1. the side-panel width equals LAYOUT_SIDE_WIDTH.short
  has(`:root{--mw-side-w:${LAYOUT_SIDE_WIDTH.short}}`);
  assert.equal(LAYOUT_SIDE_WIDTH.short, "45%");
  // 2. the one-row HUD
  has('.mw-hud{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"ident band2" "track track";align-items:center}');
  has(`.mw-hud-identity{grid-area:ident;padding-top:calc(6px + ${T_INSET});padding-bottom:6px;padding-right:8px}`);
  // Phase 97 (SCREEN-03): declared re-pin. 97-06's layout check found the 48 px menu button
  // reaching 3 px above the window in the one-row HUD, so band 2's top padding went 4px -> 7px.
  has(`.mw-hud-band2{grid-area:band2;padding-top:calc(7px + ${T_INSET});padding-bottom:4px;padding-left:0}`);
  has(".mw-hud-wptrack{grid-area:track}");
  has(".mw-cond-strip{padding-top:4px;padding-bottom:5px}");
  // 3. the dropdown fits the short window
  has(`.mw-hud-menu{max-height:calc(100vh - 64px - ${T_INSET} - ${B_INSET});max-height:calc(100dvh - 64px - ${T_INSET} - ${B_INSET})}`);
  // 4. the centred columns: the readable width is the shared constant
  assert.equal(LAYOUT_READABLE_MAX_PX, 640);
  has(`#screen-oracle,#screen-dead{max-width:${LAYOUT_READABLE_MAX_PX}px;margin-left:auto;margin-right:auto;width:100%}`);
  has("#screen-hero,#screen-gear{max-width:960px;margin-left:auto;margin-right:auto}");
  // 5. Hero in two columns
  has("#screen-hero{column-width:300px;column-count:2;column-gap:14px}");
  has("#screen-hero > .panel{break-inside:avoid;margin:0 0 14px}");
  // 6. Gear: worn left, the rest right
  has("#screen-gear{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:18px;align-items:start}");
  has("#screen-gear .mw-gear-stats{grid-column:1 / -1}");
  has("#gear-worn-sec{grid-column:1;grid-row:2 / span 3}");
  has("#gear-bag-sec,#gear-cons-sec,#gear-kit-sec{grid-column:2}");
  has("#gear-bag-sec{margin-top:0}");
  // 7. sheets centred at the readable width, allowed the full height
  has(`.mw-legend-panel{max-width:${LAYOUT_READABLE_MAX_PX}px;margin-left:auto;margin-right:auto;max-height:calc(100vh - ${T_INSET});max-height:calc(100dvh - ${T_INSET})}`);
  // 8. combat that fits
  has(".cb-head{padding:7px 12px 6px}");
  has(".cb-sum-body{height:44px}");
  has(".cb-act{padding:7px 10px 10px}");
  for (const line of short.split("\n").filter((l) => l.trim() !== "")) assert.match(line, /^ {2}\S/, `unindented short rule: ${line.slice(0, 60)}`);
});

test("(r2) the base rules the short block overrides are untouched: the hud-menu, the legend panel and the combat panel keep their base declarations", () => {
  // The short rules sit only inside the media group; the line-start base rules still read as before.
  assert.ok(ALL_CSS.includes(".cb-sum-body{display:flex;flex-direction:column;justify-content:flex-end;gap:5px;margin-top:7px;height:78px;"));
  assert.ok(ALL_CSS.includes(".cb-act{flex:none;border-top:3px solid #3a3226;background:#1b170f;padding:10px 12px 26px}"));
  assert.ok(ALL_CSS.includes(".cb-head{flex:none;display:flex;justify-content:space-between;align-items:center;padding:10px 14px 9px;"));
});

// ─── (s)(t) the MEDIUM and EXPANDED blocks (SCREEN-04/05) ────────────────────

test("(s) exactly one MEDIUM media group (LAYOUT_MEDIA.medium), after the short group, centring the text surfaces at the readable width", () => {
  assert.equal(count(LAYOUT_CSS, `@media ${LAYOUT_MEDIA.medium}{`), 1);
  assert.equal(count(HTML, `@media ${LAYOUT_MEDIA.medium}{`), 1);
  assert.ok(LAYOUT_CSS.indexOf(`@media ${LAYOUT_MEDIA.medium}{`) > LAYOUT_CSS.indexOf(`@media ${LAYOUT_MEDIA.short}{`), "medium follows short");
  const medium = mediaGroup(LAYOUT_CSS, LAYOUT_MEDIA.medium);
  const has = (rule) => assert.ok(medium.includes(`  ${rule}\n`), `medium rule missing: ${rule}`);
  assert.equal(LAYOUT_READABLE_MAX_PX, 640);
  const W = `${LAYOUT_READABLE_MAX_PX}px`;
  // A1. the tab screens
  has(`#screen-hero,#screen-gear,#screen-oracle,#screen-dead{max-width:${W};margin-left:auto;margin-right:auto;width:100%}`);
  // A2. the sheets
  has(`.mw-legend-panel{max-width:${W};margin-left:auto;margin-right:auto}`);
  // A3. the encounter overlay keeps covering the map, its content centred
  has(`#enc-panel{padding-left:max(15px, calc((100% - ${W}) / 2));padding-right:max(15px, calc((100% - ${W}) / 2))}`);
  has(`#enc-panel[data-mode="dark"]{padding-left:max(0px, calc((100% - ${W}) / 2));padding-right:max(0px, calc((100% - ${W}) / 2))}`);
  // A4. the bottom rail card centred, its slide transform untouched
  has(`#mw-rail{left:max(0px, calc((100% - ${W}) / 2));right:max(0px, calc((100% - ${W}) / 2))}`);
  assert.doesNotMatch(medium, /transform/, "the rail's slide transform is not touched");
  for (const line of medium.split("\n").filter((l) => l.trim() !== "")) assert.match(line, /^ {2}\S/, `unindented medium rule: ${line.slice(0, 60)}`);
});

test("(t) exactly one EXPANDED media group (LAYOUT_MEDIA.expanded), after the medium group: the map plus a persistent right pane", () => {
  assert.equal(count(LAYOUT_CSS, `@media ${LAYOUT_MEDIA.expanded}{`), 1);
  assert.equal(count(HTML, `@media ${LAYOUT_MEDIA.expanded}{`), 1);
  const at = LAYOUT_CSS.indexOf(`@media ${LAYOUT_MEDIA.expanded}{`);
  assert.ok(at > LAYOUT_CSS.indexOf(`@media ${LAYOUT_MEDIA.medium}{`), "expanded follows medium");
  assert.ok(LAYOUT_CSS.indexOf(`@media ${LAYOUT_MEDIA.medium}{`) > LAYOUT_CSS.indexOf(`@media ${LAYOUT_MEDIA.short}{`) && LAYOUT_CSS.indexOf(`@media ${LAYOUT_MEDIA.short}{`) > LAYOUT_CSS.indexOf(`@media ${LAYOUT_MEDIA.side}{`), "source order SIDE < SHORT < MEDIUM < EXPANDED");
  const expanded = mediaGroup(LAYOUT_CSS, LAYOUT_MEDIA.expanded);
  const has = (rule) => assert.ok(expanded.includes(`  ${rule}\n`), `expanded rule missing: ${rule}`);
  // B1. the pane width is the shared constant
  has(`:root{--mw-side-w:${LAYOUT_SIDE_WIDTH.expanded}}`);
  assert.equal(LAYOUT_SIDE_WIDTH.expanded, "clamp(360px, 40%, 560px)");
  // B2. the screens as a grid; a second column on every tab but the map
  has("#mw-screens{display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr);overflow:hidden}");
  has(`#mw-stage:not([data-tab="maze"]) > #mw-screens{grid-template-columns:minmax(0,1fr) ${SIDE_W}}`);
  // B3. the map is always visible on the left, never faded on a tab switch
  has("#screen-maze{grid-column:1;grid-row:1;min-width:0}");
  has("#screen-maze[hidden]{display:flex!important}");
  has('#screen-maze[data-motion="closing"]{position:relative;top:auto;right:auto;bottom:auto;left:auto;animation:none;pointer-events:auto;transform:none!important}');
  // B4. the persistent right pane
  has("#screen-hero,#screen-gear,#screen-oracle,#screen-dead{grid-column:2;grid-row:1;min-width:0;min-height:0;overflow-y:auto;border-left:3px solid #3a3226}");
  has(`.mw-screens > .mw-screen[data-motion="closing"]{left:auto;width:${SIDE_W}}`);
  // B5. the encounter panel belongs to the MAP tab, as on a phone
  has('#mw-stage:not([data-tab="maze"]) #enc-panel{display:none!important}');
  // B6. sheets centred
  has(`.mw-legend-panel{max-width:${LAYOUT_READABLE_MAX_PX}px;margin-left:auto;margin-right:auto}`);
  // B7. the title-opened leaderboards own the window
  has('body[data-boards-entry="title"] #screen-maze{display:none!important}');
  has('body[data-boards-entry="title"] #mw-stage > #mw-screens{grid-template-columns:minmax(0,1fr)}');
  has(`body[data-boards-entry="title"] #screen-dead{grid-column:1;max-width:${LAYOUT_READABLE_MAX_PX}px;width:100%;margin-left:auto;margin-right:auto;border-left:0}`);
  // B8. the Hero dossier stacks in the pane, as on a compact phone
  has(".doss section + section{border-left:0;padding-left:0;border-top:1px dotted var(--rule);padding-top:14px}");
  for (const line of expanded.split("\n").filter((l) => l.trim() !== "")) assert.match(line, /^ {2}\S/, `unindented expanded rule: ${line.slice(0, 60)}`);
  // Prohibitions: no three columns (the encounter panel hides off the MAP tab), and no new rule outside the two
  // size-class queries (compact stays as it was): nothing follows the expanded group but the END marker.
  const after = LAYOUT_CSS.slice(at + `@media ${LAYOUT_MEDIA.expanded}{`.length + expanded.length + 1);
  assert.equal(after.trim(), "", "the expanded group is the last thing in mw-layout");
  const medAt = LAYOUT_CSS.indexOf(`@media ${LAYOUT_MEDIA.medium}{`);
  const shortEnd = LAYOUT_CSS.indexOf(`@media ${LAYOUT_MEDIA.short}{`) + `@media ${LAYOUT_MEDIA.short}{`.length + mediaGroup(LAYOUT_CSS, LAYOUT_MEDIA.short).length + 1;
  assert.equal(LAYOUT_CSS.slice(shortEnd, medAt).trim(), "", "only the two new groups follow the short group");
});

// ─── (u)(v) a fight that starts in expanded takes the pane (SCREEN-04) ───────

function sandboxBoot() {
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc });
  const w = sandbox.context.window;
  const state = newRun(11, [], { force: { cls: "Fighter" } });
  state.c.wp = state.c.maxWP;
  sandbox.setState(state);
  sandbox.paint();
  const calls = [];
  const realShowTab = w.__mzShowTab;
  w.__mzShowTab = (name) => {
    calls.push(name);
    return realShowTab(name);
  };
  const read = (expr) => vm.runInContext(expr, sandbox.context);
  const withCombat = () => {
    const s = structuredClone(state);
    s.combat = {
      foes: [{ name: "Limp Wolf", type: "Beasts", lvl: 1, size: "S", intel: 1, wp: 10, maxWP: 10, alive: true, asleep: 0, sp: {}, lives: 1 }],
      type: "Beasts", round: 1, target: 0, spellOpen: false, tracked: false, first: "you",
    };
    return s;
  };
  return { doc, sandbox, w, calls, read, withCombat, realShowTab };
}

test("(u1) expanded (mapStaysUp), HERO shown: a fight that starts brings the MAP tab forward exactly once, and the panel is up", () => {
  const r = sandboxBoot();
  r.w.__mzLayout = { mapStaysUp: () => true, railBeside: () => true };
  r.w.__mzShowTab("hero");
  assert.equal(r.read("mwActiveTab"), "hero");
  r.calls.length = 0;
  r.sandbox.setState(r.withCombat());
  r.sandbox.renderEncounter();
  assert.deepEqual(r.calls, ["maze"]);
  assert.equal(r.read("mwActiveTab"), "maze");
  assert.equal(r.doc.document.getElementById("enc-panel").hidden, false);
  assert.equal(r.doc.document.getElementById("mw-stage").getAttribute("data-panel-up"), "1");
});

test("(u2) not expanded (mapStaysUp false, or no __mzLayout): no switch, the tab stays HERO as today", () => {
  for (const layout of [{ mapStaysUp: () => false, railBeside: () => false }, undefined]) {
    const r = sandboxBoot();
    if (layout) r.w.__mzLayout = layout;
    r.w.__mzShowTab("hero");
    r.calls.length = 0;
    r.sandbox.setState(r.withCombat());
    r.sandbox.renderEncounter();
    assert.deepEqual(r.calls, []);
    assert.equal(r.read("mwActiveTab"), "hero");
  }
});

test("(u3) expanded, MAP already active: an encounter that starts makes no extra showTab call", () => {
  const r = sandboxBoot();
  r.w.__mzLayout = { mapStaysUp: () => true, railBeside: () => true };
  assert.equal(r.read("mwActiveTab"), "maze");
  r.sandbox.setState(r.withCombat());
  r.sandbox.renderEncounter();
  assert.deepEqual(r.calls, []);
  assert.equal(r.read("mwActiveTab"), "maze");
});

test("(u4) expanded, an encounter already up: opening GEAR mid-fight and re-rendering does not switch back (only the start edge switches)", () => {
  const r = sandboxBoot();
  r.w.__mzLayout = { mapStaysUp: () => true, railBeside: () => true };
  r.w.__mzShowTab("hero");
  r.sandbox.setState(r.withCombat());
  r.sandbox.renderEncounter();
  assert.equal(r.read("mwActiveTab"), "maze");
  r.w.__mzShowTab("gear");
  r.calls.length = 0;
  r.sandbox.renderEncounter();
  r.sandbox.renderEncounter();
  assert.deepEqual(r.calls, []);
  assert.equal(r.read("mwActiveTab"), "gear");
});

test("(v) renderEncounter computes encStarting right after hasActiveEncounter(), and the switch reads window.__mzLayout?.mapStaysUp?.()", () => {
  const render = sliceBetween(CODE, "function renderEncounter()", "\nfunction ");
  const at = render.indexOf("const active = hasActiveEncounter();");
  assert.ok(at !== -1);
  assert.ok(render.slice(at).replace(/^const active = hasActiveEncounter\(\);\s*/, "").startsWith("const encStarting = active && !encWasActive;"), "encStarting follows `active` immediately");
  assert.equal(count(render, "const encStarting = active && !encWasActive;"), 1);
  assert.ok(render.includes('if (encStarting && window.__mzLayout?.mapStaysUp?.() && mwActiveTab !== "maze" && window.__mzShowTab) window.__mzShowTab("maze");'));
  assert.ok(render.indexOf("encWasActive = active;") < render.indexOf("window.__mzLayout?.mapStaysUp?.()"), "the switch follows the encWasActive bookkeeping");
  assert.ok(render.indexOf('setAttribute("data-panel-up"') < render.indexOf("window.__mzLayout?.mapStaysUp?.()"), "the switch follows the data-panel-up line");
});

test("(u5) expanded, a death that starts while GEAR fills the pane: the MAP tab comes forward and the death card is up (no double switch)", () => {
  const r = sandboxBoot();
  r.w.__mzLayout = { mapStaysUp: () => true, railBeside: () => true };
  r.w.__mzShowTab("gear");
  r.calls.length = 0;
  const s = newRun(11, [], { force: { cls: "Fighter" } });
  die(s, "combat", "a rat", makeRng(4), [], () => 1);
  r.sandbox.setState(s);
  r.sandbox.renderEncounter();
  assert.equal(r.read("mwActiveTab"), "maze");
  assert.equal(r.doc.document.getElementById("enc-panel").hidden, false);
  assert.equal(r.calls.filter((n) => n === "maze").length, 1, "one switch to MAP");
});

// ─── (w) the compact HUD gaps (SCREEN-06, found by tools/layout-check.mjs) ─────

test("(w) the compact group eases the HUD band 2 gaps so a 360 px phone shows every counter", () => {
  const at = LAYOUT_CSS.indexOf(`@media ${LAYOUT_MEDIA.compact}`);
  assert.ok(at !== -1, "compact group present");
  const end = LAYOUT_CSS.indexOf("@media", at + 10);
  const compact = LAYOUT_CSS.slice(at, end);
  assert.ok(compact.includes(".mw-hud-band2{gap:clamp(6px, calc((100vw - 340px) / 7), 10px)}"));
  assert.ok(compact.includes(".mw-hud-counters{gap:clamp(2px, calc((100vw - 332px) / 10), 8px)}"));
  // the base gaps (10px and 8px) stay as the roomy-window default
  assert.ok(HTML.includes(".mw-hud-band2{display:flex;align-items:center;gap:10px;"));
  assert.ok(HTML.includes(".mw-hud-counters{flex:1;min-width:0;display:flex;gap:8px;"));
});
