// test/unit/shell-map-store-polish.test.js
//
// Phase 33 (UIF-02/UIF-03/STORE-01), Plan 03 — mazeworld.html has no module
// surface a test could import directly (it is not an ESM module the test
// runner can load), so — mirroring test/unit/shell-round-card.test.js /
// shell-input-guards.test.js's own source-assertion pattern — this file
// reads the real shipped source with fs.readFileSync and asserts against it
// directly:
//   1. UIF-03: `let zoom = 1.5;` is the default, the literal midpoint of
//      ZOOM_MIN..ZOOM_MAX, and zoom is never persisted (no writeSetting/S/
//      state reference) — session-only.
//   2. UIF-02 site 1: renderEncounter's encWasActive && !active dismissal
//      transition is a braced block carrying both lastDismissAt = Date.now()
//      and window.mzCenterMap?.() (the Phase 32 shell-input-guards pins
//      still match the braced form).
//   3. UIF-02 site 2: showTab's maze branch recenters.
//   4. UIF-02 site 3: closeSettingsSheet recenters; both its scrim/Close
//      callers still route through it.
//   5. UIF-02 pinch: release() captures wasPinch and recenters once on
//      pinch-end; the pointermove handler never recenters (no per-tick
//      reset) while its zoom-scaling math stays intact.
//   6. the centerMap bridge itself is untouched (pan/positionCanvas only,
//      never S.floor).
//   7. STORE-01: the store header's gated roll line — STORE_ROLL_COPY shown
//      only when S.storeRoll === true, else the empty string; storeRoll is
//      read nowhere else in the shell.
//   8. voice safety of STORE_ROLL_COPY against content/safety-wordlist.js
//      BANNED (mirroring shell-round-card.test.js's matcher) and no HTML
//      angle brackets in the interpolated string.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { BANNED, ALLOWLIST } from "../../content/safety-wordlist.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const RAW_HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
const HTML = RAW_HTML.replace(/\r\n/g, "\n");

// ─── comment stripping (same order-sensitive approach as
// shell-round-card.test.js / shell-input-guards.test.js) ──────────────────
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

function renderEncounterRegion() {
  return sliceBetween(CODE, "function renderEncounter()", "function noteCombat(");
}

function showTabRegion() {
  return sliceBetween(CODE, "function showTab(name) {", 'for (const btn of tabs) btn.addEventListener("click"');
}

function closeSettingsSheetRegion() {
  return sliceBetween(CODE, "function closeSettingsSheet() {", 'document.getElementById("mw-gear-btn")');
}

function pointermoveRegion() {
  return sliceBetween(CODE, 'vp.addEventListener("pointermove", e => {', "const release = e => {");
}

function releaseRegion() {
  return sliceBetween(CODE, "const release = e => {", 'vp.addEventListener("pointerup", release)');
}

function storeRegion() {
  return sliceBetween(CODE, "if (S.store) {", 'document.getElementById("a-leave").onclick');
}

// ─── 1. UIF-03: zoom default + session-only persistence ──────────────────

test("UIF-03: let zoom = 1.5 is the default, exactly once, no stray `let zoom = 1;`", () => {
  const matches = CODE.match(/^let zoom = 1\.5;/m);
  assert.ok(matches, "let zoom = 1.5; must be found in mazeworld.html");
  assert.equal((CODE.match(/let zoom = 1\.5;/g) || []).length, 1);
  assert.equal((CODE.match(/let zoom = 1;/g) || []).length, 0, "the old `let zoom = 1;` default must be gone");
});

test("UIF-03: 1.5 is the literal midpoint of ZOOM_MIN..ZOOM_MAX", () => {
  const m = CODE.match(/const ZOOM_MIN = ([\d.]+), ZOOM_MAX = ([\d.]+);/);
  assert.ok(m, "ZOOM_MIN/ZOOM_MAX declaration must be found");
  const min = Number(m[1]);
  const max = Number(m[2]);
  assert.equal(min, 0.6);
  assert.equal(max, 2.4);
  assert.equal((min + max) / 2, 1.5);
});

test("UIF-03: zoom is never persisted — no writeSetting/S.zoom/state.zoom expression", () => {
  assert.ok(!/writeSetting\([^)]*zoom/i.test(CODE), "zoom must never be written through writeSetting");
  assert.ok(!/S\.zoom/.test(CODE), "zoom must never be read/written on the engine state S");
  assert.ok(!/state\.zoom/.test(CODE), "zoom must never be read/written on a `state` object");
});

// ─── 2. UIF-02 site 1: renderEncounter dismissal transition ──────────────

test("UIF-02 site 1: the encWasActive && !active transition is a braced block with the stamp and the recenter", () => {
  const region = renderEncounterRegion();
  assert.equal((region.match(/if \(encWasActive && !active\) \{/g) || []).length, 1);
  const blockStart = region.indexOf("if (encWasActive && !active) {");
  const blockEnd = region.indexOf("}", blockStart);
  const block = region.slice(blockStart, blockEnd + 1);
  assert.match(block, /lastDismissAt = Date\.now\(\);/);
  assert.match(block, /window\.mzCenterMap\?\.\(\);/);
});

// ─── 3. UIF-02 site 2: showTab ────────────────────────────────────────────

test('UIF-02 site 2: showTab recenters exactly once when name === "maze"', () => {
  const region = showTabRegion();
  const matches = region.match(/if \(name === "maze"\) window\.mzCenterMap\?\.\(\);/g) || [];
  assert.equal(matches.length, 1);
});

// ─── 4. UIF-02 site 3: closeSettingsSheet ─────────────────────────────────

test("UIF-02 site 3: closeSettingsSheet recenters exactly once; both callers still route through it", () => {
  const region = closeSettingsSheetRegion();
  const matches = region.match(/window\.mzCenterMap\?\.\(\);/g) || [];
  assert.equal(matches.length, 1);
  assert.match(CODE, /document\.getElementById\("mw-settings-scrim"\)\?\.addEventListener\("click", closeSettingsSheet\);/);
  assert.match(CODE, /document\.getElementById\("mw-settings-close"\)\?\.addEventListener\("click", closeSettingsSheet\);/);
});

// ─── 5. UIF-02 pinch: release() recenters once; pointermove never does ───

test("UIF-02 pinch: release() captures wasPinch and recenters once on pinch-end", () => {
  const region = releaseRegion();
  assert.match(region, /const wasPinch = !!pinch;/);
  assert.match(region, /if \(wasPinch && pts\.size < 2\) window\.mzCenterMap\?\.\(\);/);
});

test("UIF-02 pinch: the pointermove handler never recenters, and its zoom-scale math is intact", () => {
  const region = pointermoveRegion();
  assert.ok(!/mzCenterMap/.test(region), "pointermove must never call window.mzCenterMap");
  assert.ok(!/centerMap\(/.test(region), "pointermove must never call centerMap() directly either");
  assert.match(region, /zoom = clampZoom\(pinch\.zoom \* \(d \/ pinch\.dist\)\); fit\(\); positionCanvas\(\);/);
});

// ─── 6. the centerMap bridge is untouched ─────────────────────────────────

test("the centerMap bridge itself is untouched: pan/positionCanvas only, never S.floor", () => {
  assert.equal((CODE.match(/function centerMap\(\) \{/g) || []).length, 1);
  assert.equal((CODE.match(/window\.mzCenterMap = centerMap;/g) || []).length, 1);
  const body = sliceBetween(CODE, "function centerMap() {", 'document.getElementById("mw-chip-centre")');
  assert.match(body, /pan = \{ x: 0, y: 0 \};/);
  assert.match(body, /positionCanvas\(\);/);
  assert.ok(!/S\.floor/.test(body), "centerMap must never touch S.floor");
});

test("mzCenterMap total call-site count is 10 (6 pre-existing + the 4 new Phase 33 sites)", () => {
  const matches = CODE.match(/window\.mzCenterMap\?\.\(\)/g) || [];
  assert.equal(matches.length, 10);
});

// ─── 7. STORE-01: the gated header line ───────────────────────────────────

test("STORE-01: STORE_ROLL_COPY constant exists exactly once, non-empty, no angle brackets", () => {
  const m = CODE.match(/const STORE_ROLL_COPY = "([^"]*)";/);
  assert.ok(m, "const STORE_ROLL_COPY = \"...\"; must be found in mazeworld.html");
  const copy = m[1];
  assert.ok(copy.length > 0, "STORE_ROLL_COPY must be non-empty");
  assert.ok(!/[<>]/.test(copy), "STORE_ROLL_COPY must carry no angle brackets (it is interpolated into a template)");
  assert.equal((CODE.match(/const STORE_ROLL_COPY = "/g) || []).length, 1);
});

test("STORE-01: the store header line is gated on S.storeRoll === true with an empty-string else", () => {
  const region = storeRegion();
  assert.equal((region.match(/S\.storeRoll === true/g) || []).length, 1);
  assert.equal((region.match(/STORE_ROLL_COPY/g) || []).length, 1);
  assert.match(region, /S\.storeRoll === true \? `<p class="enc-sub mw-store-roll">\$\{STORE_ROLL_COPY\}<\/p>` : ""/);
});

test("STORE-01: storeRoll is read by the shell only inside the store header region", () => {
  const wholeCount = (CODE.match(/storeRoll/g) || []).length;
  const regionCount = (storeRegion().match(/storeRoll/g) || []).length;
  assert.equal(wholeCount, regionCount, "storeRoll must appear nowhere in the shell outside the store header region");
});

// ─── 8. voice safety of STORE_ROLL_COPY ───────────────────────────────────

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

test("STORE_ROLL_COPY is clear of content/safety-wordlist.js BANNED terms", () => {
  const m = CODE.match(/const STORE_ROLL_COPY = "([^"]*)";/);
  assert.ok(m, "const STORE_ROLL_COPY = \"...\"; must be found in mazeworld.html");
  const copy = m[1];
  const offenders = findBannedTerms(copy);
  assert.deepStrictEqual(offenders, [], `Banned copy in STORE_ROLL_COPY: ${JSON.stringify(offenders)} (text: "${copy}")`);
});
