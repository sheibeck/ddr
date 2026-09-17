// test/unit/shell-party-camp.test.js
//
// Phase 25.1 (DFB-04/DFB-06), Plan 02 — mazeworld.html has no module surface
// a test could import directly (it is not an ESM module the test runner can
// load), so — mirroring test/unit/shell-toast-wiring.test.js's own
// source-assertion pattern — this file reads the real shipped source with
// fs.readFileSync and asserts against it directly:
//   1. the module script bridges nightlyEats (engine/movement.js) and
//      PARTY_CAP (engine/state.js) onto window, read-only;
//   2. the Joiner offer names who would walk, via textContent (never
//      innerHTML, since a name is interpolated);
//   3. paint() derives the camp button's short-on-food state from the SAME
//      bridged helper the engine's makeCamp uses;
//   4. the camp button is never programmatically disabled by the shell (the
//      refusal toast must still be able to fire on a tap).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const RAW_HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
const HTML = RAW_HTML.replace(/\r\n/g, "\n");

// ─── comment stripping (same order-sensitive approach as
// shell-toast-wiring.test.js — see that file's header for why line comments
// are stripped BEFORE block comments) ───────────────────────────────────
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

// ─── 1. module bridges ───────────────────────────────────────────────────

test("DFB-04/06: the module bridges nightlyEats and PARTY_CAP from the engine", () => {
  assert.match(CODE, /import \{ nightlyEats \} from "\.\/engine\/movement\.js";/);
  assert.match(CODE, /import \{ PARTY_CAP \} from "\.\/engine\/state\.js";/);
  assert.match(CODE, /window\.__mzNightlyEats = nightlyEats;/);
  assert.match(CODE, /window\.__mzPartyCap = PARTY_CAP;/);
});

// ─── 2. offer card names who walks ───────────────────────────────────────

function pendingJoinerRegion() {
  const start = CODE.indexOf("if (S.pendingJoiner && !S.combat && !S.store)");
  const end = CODE.indexOf("if (S.pendingFind && !S.combat && !S.store)");
  assert.ok(start !== -1 && end !== -1 && end > start, "pendingJoiner branch bounds found");
  return CODE.slice(start, end);
}

test("DFB-04/Phase 35 (MAP-04): the Joiner rail card names who walks, via a plain headLine const (never innerHTML)", () => {
  const region = pendingJoinerRegion();
  assert.match(region, /const cap = window\.__mzPartyCap \?\? 1;/);
  assert.match(region, /S\.party\[0\]/, "index 0 mirrors engine/state.js#swapPartyMember");
  // Phase 35 (MAP-04): the joiner decision moved from a DOM head element
  // (renderEncounter's own innerHTML-built card) into renderRail's plain
  // headLine const, fed into the card's lines array as {text, roll} — no
  // DOM element, no textContent assignment, no innerHTML at all.
  assert.match(region, /const headLine = walker/);
  assert.match(region, /Take \$\{j\.name \|\| "them"\} along\? \$\{walker\.name \|\| "Your companion"\} walks\.`/);
  assert.doesNotMatch(region, /innerHTML/, "the joiner card must never use innerHTML anywhere in this region");
});

// ─── 3/4. camp button short state, never disabled ────────────────────────

test("DFB-06: paint() derives the camp button's short state from window.__mzNightlyEats", () => {
  assert.match(CODE, /window\.__mzNightlyEats\(S\)/);
  assert.match(CODE, /campBtn\.dataset\.short = short \? "1" : "0";/);
  assert.match(HTML, /#btn-camp\[data-short="1"\]\{/);
  assert.match(CODE, /document\.getElementById\("btn-camp"\)\.onclick/, "the button stays wired to camp");
});

function campBtnPaintRegion() {
  const start = CODE.indexOf('const campBtn = document.getElementById("btn-camp");');
  assert.ok(start !== -1, "campBtn region found in paint()");
  // the region is small — bounded to the immediate if-block below the
  // assignment (through the closing brace of the `if (campBtn) { ... }`).
  const end = CODE.indexOf("\n  }", start) + 4;
  return CODE.slice(start, end);
}

test("DFB-06: the camp button is never disabled by the shell", () => {
  const region = campBtnPaintRegion();
  assert.ok(region.includes("campBtn"), "sanity: region actually contains the campBtn assignment");
  // Assembled from fragments so this test file never spells the forbidden
  // pattern itself (mirrors shell-toast-wiring.test.js's dead-name technique).
  const forbidden = "campBtn" + ".disabled";
  assert.ok(!region.includes(forbidden), "the campBtn region must never set .disabled");
});

// ─── 5. 2026-09-17 UAT ruling: the party roster is a Hero-tab Company panel ─

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start === -1 ? 0 : start);
  assert.ok(start !== -1, `start marker not found: ${startMarker}`);
  assert.ok(end !== -1 && end > start, `end marker not found after start: ${endMarker}`);
  return source.slice(start, end);
}

test('2026-09-17 UAT ruling: the party roster is a Hero-tab Company panel rendered by renderPartyRoster() on the paint() path (never from tab init)', () => {
  assert.equal((HTML.match(/id="hero-party"/g) || []).length, 1);
  assert.equal((HTML.match(/id="hero-party-list"/g) || []).length, 1);

  const heroRegion = HTML.slice(HTML.indexOf('id="screen-hero"'), HTML.indexOf('id="screen-gear"'));
  const a = heroRegion.indexOf('id="s-trait"');
  const b = heroRegion.indexOf('id="hero-party"');
  const c = heroRegion.indexOf('<h2>Company</h2>');
  const d = heroRegion.indexOf('Special skills');
  assert.ok(a !== -1 && b !== -1 && c !== -1 && d !== -1, "all four Hero-tab anchors found");
  assert.ok(a < b && b < c && c < d, "s-trait < hero-party < Company heading < Special skills");

  assert.match(HTML, /Joiner should only show when fighting, and probably on the hero screen\./);

  assert.equal((CODE.match(/^function renderPartyRoster\(\) \{/gm) || []).length, 1);
  const fnStart = CODE.indexOf("function renderPartyRoster() {");
  const fnEnd = CODE.indexOf("\n}\n", fnStart);
  assert.ok(fnStart !== -1 && fnEnd !== -1 && fnEnd > fnStart, "renderPartyRoster() function region found");
  const fnRegion = CODE.slice(fnStart, fnEnd);
  assert.match(fnRegion, /getElementById\("hero-party"\)/);
  assert.match(fnRegion, /getElementById\("hero-party-list"\)/);
  assert.match(fnRegion, /panel\.hidden = party\.length === 0;/);
  assert.match(fnRegion, /mw-map-hptrack/);
  assert.match(fnRegion, /mw-map-hpfill/);
  assert.match(fnRegion, /Downed/);
  const getByIdCalls = fnRegion.match(/getElementById\(/g) || [];
  assert.equal(getByIdCalls.length, 2, "renderPartyRoster reads only #hero-party and #hero-party-list");

  const paintRegion = sliceBetween(CODE, "function paint() {", "\nfunction move(dir)");
  assert.equal((paintRegion.match(/renderPartyRoster\(\);/g) || []).length, 1);

  const initTabsRegion = sliceBetween(CODE, "(function initTabs() {", "window.__mzShowTab = showTab;");
  assert.doesNotMatch(initTabsRegion, /renderPartyRoster/);
});
