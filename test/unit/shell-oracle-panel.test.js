// test/unit/shell-oracle-panel.test.js
//
// Phase 25.1 (Device Feedback Batch), Plan 01 (DFB-03) — mazeworld.html has
// no module surface a test could import, so — mirroring test/unit/shell-
// toast-wiring.test.js's own source-assertion pattern — this file reads the
// real shipped source with fs.readFileSync and asserts against it directly:
// the Oracle screen fills its container as a flex column, the log panel
// grows to the available height and the list scrolls inside it, a "↑ newer"
// pill exists and starts hidden, opening the Oracle tab scrolls to the
// newest line, the pill toggles on scroll past a 24px threshold and taps
// back to the top, and the fixed toast host / tab bar are untouched by the
// layout change.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const RAW_HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
const HTML = RAW_HTML.replace(/\r\n/g, "\n");

// ─── comment stripping (line comments first — see shell-toast-wiring.test.js
// for why this order is safe for this file) ─────────────────────────────
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

test("DFB-03: #screen-oracle fills its screen as a flex column", () => {
  assert.match(HTML, /#screen-oracle\{display:flex;flex-direction:column;height:100%;min-height:0\}/);
});

test("DFB-03: #log-panel grows (flex:1 / min-height:0) and anchors the pill (position:relative)", () => {
  assert.match(
    HTML,
    /#log-panel\{flex:1;min-height:0;display:flex;flex-direction:column;position:relative\}/,
  );
});

test("DFB-03: the log list scrolls inside the panel", () => {
  assert.match(HTML, /#log-panel \.log\{flex:1;min-height:0;max-height:none;overflow-y:auto\}/);
});

test("DFB-03: the newer pill exists, starts hidden, and has a hidden rule", () => {
  assert.match(HTML, /<button type="button" class="mw-log-newer" id="log-newer" hidden>/);
  assert.match(HTML, /\.mw-log-newer\[hidden\]\{display:none\}/);
});

test("DFB-03: opening the Oracle tab scrolls to the newest line", () => {
  assert.match(CODE, /if \(name === "oracle"\) window\.__mzOracleToNewest\?\.\(\);/);
  assert.match(CODE, /window\.__mzOracleToNewest = \(\) => \{ log\.scrollTop = 0; sync\(\); \};/);
});

test("DFB-03: the pill toggles on scroll past 24 px and taps back to the top", () => {
  assert.match(CODE, /const NEWER_THRESHOLD_PX = 24;/);
  assert.match(CODE, /log\.addEventListener\("scroll", sync, \{ passive: true \}\)/);
  assert.match(CODE, /pill\.addEventListener\("click"/);
  assert.match(CODE, /pill\.hidden = log\.scrollTop <= NEWER_THRESHOLD_PX;/);
});

test("DFB-03: logLine still prepends (the newest line is the top)", () => {
  assert.match(CODE, /logEl\.insertBefore\(p, logEl\.firstChild\);/);
});

test("Phase 35 (MAP-03/04): the toast host rule is gone and the tab bar is a static flex child (below the RAIL) — untouched by the Oracle layout", () => {
  // literal built by concatenation so this pin can't itself be satisfied by
  // a stray comment mentioning the retired rule.
  const hostSelector = [".mw-toast", "-host{"].join("");
  assert.ok(!HTML.includes(hostSelector), `${hostSelector} rule must no longer exist`);

  const tabbarRule = HTML.match(/\.mw-tabbar\{([^}]*)\}/);
  assert.ok(tabbarRule, ".mw-tabbar{...} rule must exist");
  assert.match(tabbarRule[1], /flex:none/);
  assert.doesNotMatch(tabbarRule[1], /position:fixed/);
});
