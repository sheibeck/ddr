// test/unit/storeScreen.test.js
//
// Phase 47 (SHELL-03), Plan 05 — src/browser/storeScreen.js's own source-pin
// suite: the module's exports/no-globals/id-containment contract, plus the
// mount pin on mazeworld.html's classic renderEncounter() and the module
// script's final window.__mzTabs shape. Mirrors test/unit/gearTab.test.js /
// heroTab.test.js's classic/module region-split pattern and
// tools/ident-sweep.mjs's own stripJs (imported, never reimplemented).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { stripJs } from "../../tools/ident-sweep.mjs";
import { BANNED, ALLOWLIST } from "../../content/safety-wordlist.js";
import * as storeScreen from "../../src/browser/storeScreen.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const STORE_PATH = path.join(REPO_ROOT, "src", "browser", "storeScreen.js");
const HTML_PATH = path.join(REPO_ROOT, "mazeworld.html");

const STORE_RAW = fs.readFileSync(STORE_PATH, "utf8").replace(/\r\n/g, "\n");
const STORE_STRIPPED = stripJs(STORE_RAW);
const HTML_RAW = fs.readFileSync(HTML_PATH, "utf8").replace(/\r\n/g, "\n");

// ─── comment stripping for mazeworld.html (line comments first, THEN block
// comments — same order-sensitive approach as every sibling shell-*.test.js
// file) ──────────────────────────────────────────────────────────────────
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

// ─── classic <script> / <script type="module"> region split — both tag
// lines sit at column 0, one per line (test/unit/shell-no-content-copies.
// test.js's own precedent) ─────────────────────────────────────────────
function extractScriptRegions(raw) {
  const classicStart = raw.indexOf("\n<script>\n");
  assert.ok(classicStart !== -1, "column-0 <script> tag not found");
  const classicEnd = raw.indexOf("\n</script>\n", classicStart + 1);
  assert.ok(classicEnd !== -1, "classic </script> tag not found");
  const modStart = raw.indexOf('\n<script type="module">\n', classicEnd);
  assert.ok(modStart !== -1, 'column-0 <script type="module"> tag not found');
  const modEnd = raw.indexOf("\n</script>\n", modStart + 1);
  assert.ok(modEnd !== -1, "module </script> tag not found");
  return {
    classic: raw.slice(classicStart + 1, classicEnd),
    mod: raw.slice(modStart + 1, modEnd),
  };
}

const { classic: CLASSIC_RAW, mod: MOD_RAW } = extractScriptRegions(HTML_RAW);
const CLASSIC = stripComments(CLASSIC_RAW);
const MOD = stripComments(MOD_RAW);
// The whole-file comment-stripped source — renderEncounter() is a classic
// function, but its own conventional end marker (the next top-level
// function, noteCombat) now lives in the module script, so this pin (and
// its siblings across the shell-*.test.js suite) reads the whole file
// rather than the CLASSIC-only slice.
const CODE = stripComments(HTML_RAW);

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start === -1 ? 0 : start);
  assert.ok(start !== -1, `start marker not found: ${startMarker}`);
  assert.ok(end !== -1 && end > start, `end marker not found after start: ${endMarker}`);
  return source.slice(start, end);
}

// ─── (1) exports ────────────────────────────────────────────────────────

test("storeScreen.js exports renderStoreScreen and STORE_ROLL_COPY", () => {
  assert.ok("renderStoreScreen" in storeScreen, "expected storeScreen.js to export renderStoreScreen");
  assert.ok("STORE_ROLL_COPY" in storeScreen, "expected storeScreen.js to export STORE_ROLL_COPY");
  assert.equal(typeof storeScreen.renderStoreScreen, "function");
  assert.equal(typeof storeScreen.STORE_ROLL_COPY, "string");
});

test("Phase 71 (D-04): storeScreen.js exports storeItemStats, and the row reads it (the one formatter, never the engine sub, for an item line)", () => {
  assert.equal(typeof storeScreen.storeItemStats, "function");
  assert.match(STORE_STRIPPED, /itemStatLines\(/);
  assert.match(STORE_STRIPPED, /storeItemStats\(item, c, rs\.showUsable\)/);
});

// ─── (2) no window/document globals ──────────────────────────────────────

test("storeScreen.js reads no window/document global — host, host.ownerDocument and deps only", () => {
  assert.doesNotMatch(STORE_STRIPPED, /\bwindow\./);
  assert.doesNotMatch(STORE_STRIPPED, /\bdocument\./);
  assert.ok((STORE_STRIPPED.match(/ownerDocument/g) || []).length >= 1, "expected at least one ownerDocument read");
});

// ─── (3) every getElementById id also appears as an id= in the module's
// own template string ─────────────────────────────────────────────────────

test('every getElementById("<id>") call in storeScreen.js targets an id declared in the module\'s own template string', () => {
  const ids = [...STORE_STRIPPED.matchAll(/getElementById\("([^"]+)"\)/g)].map((m) => m[1]);
  assert.ok(ids.length >= 4, `expected at least 4 getElementById calls, found ${ids.length}`);
  for (const id of ["shelf", "sell-head", "sell-list", "a-leave"]) {
    assert.ok(ids.includes(id), `expected storeScreen.js to read getElementById("${id}")`);
    assert.ok(STORE_STRIPPED.includes(`id="${id}"`), `expected storeScreen.js's own template to declare id="${id}"`);
  }
});

// ─── (4) renderEncounter() mounts through exactly one
// window.__mzTabs.store(...) call, no leftover store literal ─────────────

function renderEncounterRegion() {
  return sliceBetween(CODE, "function renderEncounter() {", "function noteCombat(");
}

test("renderEncounter() contains exactly one window.__mzTabs.store(body, S, tabDeps()); call inside an if (S.store) { block, and no leftover store literal", () => {
  const region = renderEncounterRegion();
  assert.equal((region.match(/window\.__mzTabs\.store\(body, S, tabDeps\(\)\);/g) || []).length, 1);
  // Phase 58 (MOTION-03): the store branch condition now also carries the
  // beat's `!bv && ` gate (D-09/D-11) — re-pinned to the landed string.
  const ifIdx = region.indexOf("if (!bv && S.store) {");
  const callIdx = region.indexOf("window.__mzTabs.store(");
  assert.ok(ifIdx !== -1 && callIdx !== -1 && callIdx > ifIdx, "the mount call sits inside the if (!bv && S.store) { block");
  // Scoped to the STORE's own id literals (id="shelf"/getElementById("shelf")
  // etc.) — a bare `/"shelf"/` substring match would also false-positive on
  // the UNRELATED loot branch's `class="shelf" id="loot-drop-shelf"` card,
  // which legitimately stays in the shell (Plan 05 never touches it).
  for (const id of ["shelf", "sell-list", "sell-head", "a-leave"]) {
    assert.doesNotMatch(region, new RegExp(`id="${id}"`), `no leftover id="${id}" literal in renderEncounter()`);
    assert.doesNotMatch(region, new RegExp(`getElementById\\("${id}"\\)`), `no leftover getElementById("${id}") call in renderEncounter()`);
  }
  assert.equal((region.match(/STORE_ROLL_COPY/g) || []).length, 0, "no leftover STORE_ROLL_COPY reference in renderEncounter()");
});

// ─── (5) the module script assigns the final window.__mzTabs shape before
// the first boot() ─────────────────────────────────────────────────────────

test("the module script assigns window.__mzTabs = Object.freeze({ gear: renderGearTab, hero: renderHeroTab, store: renderStoreScreen }); before await boot(", () => {
  const bridgeIdx = MOD.indexOf("window.__mzTabs = Object.freeze({ gear: renderGearTab, hero: renderHeroTab, store: renderStoreScreen });");
  const bootIdx = MOD.indexOf("await boot(");
  assert.ok(bridgeIdx !== -1, "window.__mzTabs assignment not found");
  assert.ok(bootIdx !== -1, "await boot( call not found");
  assert.ok(bridgeIdx < bootIdx, "window.__mzTabs must be assigned before the first await boot(");
});

// ─── (6) storeScreen.js imports from gearTab.js and viewModels.js, never
// re-deriving what an import already gives it ─────────────────────────────

test("storeScreen.js imports renderCarriedList/bagUsage from ./gearTab.js and armorDisplay/usableBy/storeRowState from ./viewModels.js", () => {
  // Phase 61 (STORE-02/03): storeRowState joins this import line.
  // Phase 71 (D-04): itemStatLines joins it too — an item row's stats come
  // from the ONE formatter the Gear sheet also reads.
  assert.match(STORE_RAW, /import \{ armorDisplay, usableBy, storeRowState, itemStatLines \} from "\.\/viewModels\.js";/);
  assert.match(STORE_RAW, /import \{ bagUsage, renderCarriedList \} from "\.\/gearTab\.js";/);
});

// ─── (7) voice safety ─────────────────────────────────────────────────────

const ALLOW = new Set(ALLOWLIST.map((w) => w.toLowerCase()));
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const MATCHERS = BANNED.map((term) => new RegExp("\\b" + escapeRegExp(term) + "\\b", "i"));

test("Voice: STORE_ROLL_COPY and the template's player-facing strings clear the family-friendly safety wordlist", () => {
  for (const phrase of [
    storeScreen.STORE_ROLL_COPY,
    "A store",
    "Your gear",
    "Leave",
    "Bag full",
    "Potions and scrolls still ride free.",
  ]) {
    for (const re of MATCHERS) {
      const hit = phrase.match(re);
      assert.ok(!hit || ALLOW.has(hit[0].toLowerCase()), `banned term found in "${phrase}"`);
    }
  }
});

// ─── (8) SHELL-03 idempotency cross-pin ──────────────────────────────────
//
// The real idempotency proof lives in test/unit/shell-tab-snapshots.test.js
// (the store fixture rendered twice, byte-equal). This cross-pin only
// asserts that standing test still exists and still carries its idempotency
// title, so the truth this module's SHELL-03 claim rests on can never be
// silently dropped from the suite.

test("SHELL-03 idempotency is covered by shell-tab-snapshots.test.js's own idempotency test", () => {
  const snapshotTestPath = path.join(REPO_ROOT, "test", "unit", "shell-tab-snapshots.test.js");
  const snapshotSrc = fs.readFileSync(snapshotTestPath, "utf8");
  assert.match(
    snapshotSrc,
    /rendering the store twice from the same state serializes byte-equal \(no duplicate rows\)/,
    "expected shell-tab-snapshots.test.js to still carry its SHELL-03 idempotency test title",
  );
});
