// test/unit/rail-overlay.test.js
//
// Phase 57 (Map & HUD Layout Band), Plan 02 — LAYOUT-01. mazeworld.html has
// no module surface a test could import directly, so — mirroring shell-map-
// rail.test.js's own house style — this file reads the real shipped source
// with fs.readFileSync and asserts against it directly, using stripHtml
// (tools/ident-sweep.mjs, the same single-pass comment stripper bridge-
// registry.test.js already reuses) for every count-shaped/body-slice check.
//
// The seven tests below are the automated half of LAYOUT-01's must_haves:
// the rail is out of #app's flex flow (1), #mw-stage is its positioning
// parent and clips the resting overlay (2), visibility is transform-driven
// rather than display-driven (3), the flex chain that gives
// .mw-maze-viewport a definite height survives the wrapper (4), renderRail()
// still calls neither fit() nor the keep-in-view nudge (5), the rail is
// still a sibling of the screens rather than a child of one (6), and no
// motion was added this phase (7). The other half — the map does not
// visibly jump on a real Pixel 7 — is a deferred device check (Phase 60).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { stripHtml } from "../../tools/ident-sweep.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const RAW_HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
const HTML = RAW_HTML.replace(/\r\n/g, "\n");
const CODE = stripHtml(HTML);

function ruleFor(selectorSource) {
  const re = new RegExp(`^${selectorSource}\\{([^}]*)\\}`, "m");
  const m = HTML.match(re);
  assert.ok(m, `expected to find a rule for /^${selectorSource}\\{/m`);
  return m[1];
}

// A per-function slice from an exact signature to the NEXT "\nfunction "
// after it, on the comment-stripped source — mirrors shell-map-rail.test.js's
// own fnRegion helper so renderRail()'s guard can be sliced without pulling
// in its neighbours.
function fnRegion(sig) {
  const start = CODE.indexOf(sig);
  assert.ok(start !== -1, `signature not found: ${sig}`);
  const end = CODE.indexOf("\nfunction ", start + sig.length);
  assert.ok(end !== -1 && end > start, `no following function boundary after: ${sig}`);
  return CODE.slice(start, end);
}

// ─── (1) the rail is out of #app's flex flow ──────────────────────────────

test("(1) the rail is out of #app's flex flow: .mw-rail declares absolute positioning and neither a flex value nor a fixed min-height, so a show or hide cannot consume height from .mw-screens and therefore cannot change .mw-maze-viewport's box (device half of this claim: Phase 60 Pixel 7 session)", () => {
  const rule = ruleFor("\\.mw-rail");
  assert.match(rule, /position:absolute/);
  assert.doesNotMatch(rule, /flex:/);
  assert.doesNotMatch(rule, /min-height:/);
});

// ─── (2) the stage is the positioning parent and clips the translated-out rail ──

test("(2) the stage is the positioning parent and clips the translated-out rail: #mw-stage is relative/flex:1/min-height:0/a flex column/overflow:hidden, and it encloses both #mw-screens and #mw-rail while .mw-tabbar stays outside it", () => {
  const stageRule = ruleFor("\\.mw-stage");
  assert.match(stageRule, /position:relative/);
  assert.match(stageRule, /flex:1/);
  assert.match(stageRule, /min-height:0/);
  assert.match(stageRule, /display:flex/);
  assert.match(stageRule, /flex-direction:column/);
  assert.match(stageRule, /overflow:hidden/);

  const stageOpenIdx = HTML.indexOf('id="mw-stage"');
  const screensIdx = HTML.indexOf('id="mw-screens"');
  const railIdx = HTML.indexOf('id="mw-rail"');
  const tabbarIdx = HTML.indexOf('id="mw-tabbar"');
  assert.ok([stageOpenIdx, screensIdx, railIdx, tabbarIdx].every((i) => i !== -1), "all four anchors must exist");
  const stageCloseIdx = HTML.indexOf("</div>", railIdx);
  assert.ok(stageCloseIdx !== -1, "#mw-stage's closing </div> must exist after #mw-rail");
  assert.ok(stageOpenIdx < screensIdx && screensIdx < railIdx, "#mw-screens and #mw-rail must both sit after #mw-stage opens");
  assert.ok(railIdx < stageCloseIdx, "#mw-rail must sit before #mw-stage closes");
  assert.ok(stageCloseIdx < tabbarIdx, "#mw-tabbar must sit after #mw-stage closes (outside the wrapper)");
});

// ─── (3) visibility is transform-driven, not display-driven ──────────────

test("(3) visibility is transform-driven, not display-driven: the resting, shown and hidden-attribute rules each carry transform + visibility, the hidden-attribute rule restores a block display first, and pointer-events flips with visibility (T-57-04)", () => {
  const restingRule = ruleFor("\\.mw-rail");
  assert.match(restingRule, /transform:translateY\(100%\)/);
  assert.match(restingRule, /visibility:hidden/);
  assert.match(restingRule, /pointer-events:none/);

  const hiddenRule = ruleFor('\\.mw-rail\\[hidden\\]');
  assert.match(hiddenRule, /^display:block/, "the hidden-attribute rule's FIRST declaration must restore block display");
  assert.match(hiddenRule, /transform:translateY\(100%\)/);
  assert.match(hiddenRule, /visibility:hidden/);
  assert.match(hiddenRule, /pointer-events:none/);

  const shownRule = ruleFor('\\.mw-rail\\[data-shown="1"\\]');
  assert.match(shownRule, /transform:translateY\(0\)/);
  assert.match(shownRule, /visibility:visible/);
  assert.match(shownRule, /pointer-events:auto/);
});

// ─── (4) the flex chain that gives .mw-maze-viewport a definite height is unbroken ──

test("(4) the flex chain that gives .mw-maze-viewport a definite height is unbroken: #app.mw-app -> .mw-stage -> .mw-screens -> #screen-maze -> .mazebox -> .mw-maze-viewport", () => {
  const appRule = ruleFor("#app\\.mw-app");
  assert.match(appRule, /display:flex/);
  assert.match(appRule, /flex-direction:column/);
  assert.match(appRule, /height:100vh/, "#app must have a DEFINITE height for the chain to size against");

  const stageRule = ruleFor("\\.mw-stage");
  assert.match(stageRule, /flex:1/);
  assert.match(stageRule, /min-height:0/);

  const screensRule = ruleFor("\\.mw-screens");
  assert.match(screensRule, /flex:1/);
  assert.match(screensRule, /min-height:0/);

  // #screen-maze has two rules (a base structural one + a padding override);
  // the structural one carries the flex-column/min-height:0 declarations.
  const screenMazeRules = [...HTML.matchAll(/^#screen-maze\{([^}]*)\}/gm)].map((m) => m[1]);
  assert.ok(screenMazeRules.length >= 1, "#screen-maze rule must exist");
  const screenMazeStructural = screenMazeRules.find((r) => r.includes("display:flex"));
  assert.ok(screenMazeStructural, "#screen-maze must have a flex-column rule");
  assert.match(screenMazeStructural, /flex-direction:column/);
  assert.match(screenMazeStructural, /min-height:0/);

  const mazeboxRule = ruleFor("\\.mazebox");
  assert.match(mazeboxRule, /flex:1/);
  assert.match(mazeboxRule, /min-height:0/);

  const viewportRule = ruleFor("\\.mw-maze-viewport");
  assert.match(viewportRule, /flex:1/);
});

// ─── (5) renderRail() neither refits the canvas nor nudges the camera ────

test("(5) renderRail() neither refits the canvas nor nudges the camera: the standing guard (zero fit(, zero KeepPartyInView) holds against the comment-stripped function body", () => {
  const region = fnRegion("function renderRail()");
  assert.equal((region.match(/fit\(/g) || []).length, 0);
  assert.equal((region.match(/KeepPartyInView/g) || []).length, 0);
  // The dataset.shown write introduced in this plan's Task 2 lives here too —
  // confirm it is present and written from the same hidden predicate.
  assert.equal((region.match(/railEl\.hidden =/g) || []).length, 1);
  assert.equal((region.match(/railEl\.dataset\.shown/g) || []).length, 1);
  assert.ok(region.indexOf("railEl.hidden =") < region.indexOf("railEl.dataset.shown"));
});

// ─── (6) the rail is still a sibling of the screens, not a child of one ──

test("(6) the rail is still a sibling of the screens, not a child of one: id=\"mw-rail\" does not appear inside <main class=\"mw-screens\"> … </main> (the 2026-09-17 every-tab ruling still holds)", () => {
  const mainStart = HTML.indexOf('<main class="mw-screens"');
  const mainEnd = HTML.indexOf("</main>", mainStart);
  assert.ok(mainStart !== -1 && mainEnd !== -1 && mainEnd > mainStart);
  const mainSlice = HTML.slice(mainStart, mainEnd);
  assert.doesNotMatch(mainSlice, /id="mw-rail"/);
});

// ─── (7) no transition, duration or easing was added ──────────────────────

test("(7) no transition, duration or easing was added: the three rail visibility rules carry no transition declaration (Phase 58 owns the motion)", () => {
  const restingRule = ruleFor("\\.mw-rail");
  const hiddenRule = ruleFor('\\.mw-rail\\[hidden\\]');
  const shownRule = ruleFor('\\.mw-rail\\[data-shown="1"\\]');
  for (const rule of [restingRule, hiddenRule, shownRule]) {
    assert.doesNotMatch(rule, /transition/);
  }
});
