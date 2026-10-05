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

// ─── (f)-(j) the mw-layout block ─────────────────────────────────────────────
// (appended by the next task)
void LAYOUT_MEDIA;
