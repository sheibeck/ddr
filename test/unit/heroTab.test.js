// test/unit/heroTab.test.js
//
// Phase 47 (SHELL-02), Plan 04 — src/browser/heroTab.js's own source-pin
// suite: the module's exports/no-globals/id-containment/dead-code-deletion
// contract, plus the mount pins on mazeworld.html's classic paint() and
// module script. Mirrors test/unit/gearTab.test.js's classic/module
// region-split pattern and tools/ident-sweep.mjs's own stripJs (imported,
// never reimplemented).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { stripJs } from "../../tools/ident-sweep.mjs";
import { BANNED } from "../../content/safety-wordlist.js";
import * as heroTab from "../../src/browser/heroTab.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const HERO_PATH = path.join(REPO_ROOT, "src", "browser", "heroTab.js");
const HTML_PATH = path.join(REPO_ROOT, "mazeworld.html");

const HERO_RAW = fs.readFileSync(HERO_PATH, "utf8").replace(/\r\n/g, "\n");
const HERO_STRIPPED = stripJs(HERO_RAW);
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

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start === -1 ? 0 : start);
  assert.ok(start !== -1, `start marker not found: ${startMarker}`);
  assert.ok(end !== -1 && end > start, `end marker not found after start: ${endMarker}`);
  return source.slice(start, end);
}

// ─── (1) exports ────────────────────────────────────────────────────────

test("heroTab.js exports renderHeroTab and the six view models", () => {
  for (const name of ["renderHeroTab", "characterSheetViewModel", "ABILITY_VIEW_COPY", "RATIONS_COPY", "eatsLineFor", "rationsViewModel", "grimoireViewModel"]) {
    assert.ok(name in heroTab, `expected heroTab.js to export ${name}`);
  }
  assert.equal(typeof heroTab.renderHeroTab, "function");
  assert.equal(typeof heroTab.characterSheetViewModel, "function");
  assert.equal(typeof heroTab.eatsLineFor, "function");
  assert.equal(typeof heroTab.rationsViewModel, "function");
  assert.equal(typeof heroTab.grimoireViewModel, "function");
  assert.equal(typeof heroTab.ABILITY_VIEW_COPY, "object");
  assert.equal(typeof heroTab.RATIONS_COPY, "object");
});

// ─── (2) no window/document globals ──────────────────────────────────────

test("heroTab.js reads no window/document global — host, host.ownerDocument and deps only", () => {
  assert.doesNotMatch(HERO_STRIPPED, /\bwindow\./);
  assert.doesNotMatch(HERO_STRIPPED, /\bdocument\./);
  assert.ok((HERO_STRIPPED.match(/ownerDocument/g) || []).length >= 1, "expected at least one ownerDocument read");
});

// ─── (3) every id heroTab.js writes lives inside #screen-hero ────────────

function heroScreenMarkup() {
  const start = HTML_RAW.indexOf('<section class="mw-screen" id="screen-hero"');
  assert.ok(start !== -1, "#screen-hero section not found");
  // #screen-hero nests its own <section class="panel" ...> children, so the
  // FIRST "</section>" closes its own first child panel, not the outer
  // screen — slice to the next mw-screen sibling (screen-gear) instead.
  const end = HTML_RAW.indexOf('<section class="mw-screen" id="screen-gear"', start);
  assert.ok(end !== -1 && end > start, "#screen-hero section close not found");
  return HTML_RAW.slice(start, end);
}

test('every getElementById("<id>") call in heroTab.js targets an id inside the #screen-hero markup section', () => {
  const ids = [...HERO_STRIPPED.matchAll(/getElementById\("([^"]+)"\)/g)].map((m) => m[1]);
  assert.ok(ids.length >= 15, `expected at least 15 getElementById calls, found ${ids.length}`);
  const screenHero = heroScreenMarkup();
  for (const id of ids) {
    assert.ok(screenHero.includes(`id="${id}"`), `expected #screen-hero markup to declare id="${id}"`);
  }
});

// ─── (4) escText/DISMISS trio/renderPartyRoster/renderAbilityRows/
// renderGrimoire live in heroTab.js only ──────────────────────────────────

test("escText, the DISMISS trio, renderPartyRoster, renderAbilityRows and renderGrimoire are declared once each in heroTab.js and zero times in mazeworld.html (both scripts)", () => {
  for (const decl of [
    "const escText = (s) =>",
    "const DISMISS_CONFIRM_MS = 3000;",
    "let dismissConfirmRevert = null;",
    "function revertDismissConfirm()",
    "function renderPartyRoster(doc, state, deps) {",
    "function renderAbilityRows(doc, state) {",
    "function renderGrimoire(doc, state, deps) {",
  ]) {
    const escaped = decl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.equal((HERO_STRIPPED.match(new RegExp(escaped, "g")) || []).length, 1, `expected exactly one ${decl} in heroTab.js`);
    assert.equal((CLASSIC.match(new RegExp(escaped, "g")) || []).length, 0, `expected zero ${decl} in the classic script`);
    assert.equal((MOD.match(new RegExp(escaped, "g")) || []).length, 0, `expected zero ${decl} in the module script`);
  }
});

// ─── (5) paint() mounts through exactly one window.__mzTabs.hero(...) call,
// placed BEFORE the gear mount, with no leftover Hero-tab id literal ──────

function paintRegion() {
  return sliceBetween(CLASSIC, "function paint() {", "\n}");
}

test("paint() contains exactly one window.__mzTabs.hero(...) mount call, before the gear mount, and no Hero-tab id/doss literal", () => {
  const region = paintRegion();
  assert.equal((region.match(/window\.__mzTabs\.hero\(document\.getElementById\("screen-hero"\), S, tabDeps\(\)\);/g) || []).length, 1);
  const iHero = region.indexOf("window.__mzTabs.hero(");
  const iGear = region.indexOf("window.__mzTabs.gear(");
  assert.ok(iHero !== -1 && iGear !== -1 && iHero < iGear, "the hero mount call sits before the gear mount call");
  assert.equal(
    (region.match(/"(s-level|s-name|s-tag|s-wp|s-wpmax|s-wpfill|s-die|s-hit|s-dmg|s-size|s-arm|s-int|s-sp|s-next|s-cost|s-rations|s-rations-n|s-trait|s-vp|s-skills|s-abilities|doss-who|doss)"/g) || []).length,
    0,
    "paint() must carry no leftover Hero-tab id literal",
  );
});

// ─── (6) the module script assigns window.__mzTabs (gear + hero + store,
// the phase's final shape) before the first boot() ───────────────────────

// Phase 47 (SHELL-03), Plan 05: __mzTabs gained the `store` key the same
// commit storeScreen.js landed — re-pointed to the final three-key literal.
test("the module script assigns window.__mzTabs = Object.freeze({ gear: renderGearTab, hero: renderHeroTab, store: renderStoreScreen }); before await boot(", () => {
  const bridgeIdx = MOD.indexOf("window.__mzTabs = Object.freeze({ gear: renderGearTab, hero: renderHeroTab, store: renderStoreScreen });");
  const bootIdx = MOD.indexOf("await boot(");
  assert.ok(bridgeIdx !== -1, "window.__mzTabs assignment not found");
  assert.ok(bootIdx !== -1, "await boot( call not found");
  assert.ok(bridgeIdx < bootIdx, "window.__mzTabs must be assigned before the first await boot(");
});

// ─── (7) every window.__mzTables key has a live classic reader ──────────

test("every key in the window.__mzTables = Object.freeze({ ... }) literal has at least one window.__mzTables.<KEY> read in the classic script", () => {
  const m = /window\.__mzTables = Object\.freeze\(\{\s*([^}]*)\s*\}\);/.exec(MOD);
  assert.ok(m, "window.__mzTables assignment literal not found");
  const keys = m[1].split(",").map((k) => k.trim()).filter(Boolean);
  assert.ok(keys.length >= 1, "expected at least one surviving key");
  for (const key of keys) {
    assert.ok((CLASSIC.match(new RegExp(`window\\.__mzTables\\.${key}\\b`, "g")) || []).length >= 1, `expected at least one window.__mzTables.${key} read in the classic script`);
  }
});

// ─── (8) key literals live in heroTab.js, not the shell ──────────────────

test('the literals "Spells are the trick.", "Send them off?", "DISMISS", "Combat only", "No spells learned yet." live in heroTab.js and not in the shell', () => {
  // Quoted string-literal form ("DISMISS") — a bare substring search would
  // false-positive on the unrelated DISMISS_SETTLE_MS guard-timing constant,
  // which legitimately survives in the module script.
  for (const literal of ['"Spells are the trick."', '"Send them off?"', '"DISMISS"', '"Combat only"', '"No spells learned yet."']) {
    assert.ok(HERO_STRIPPED.includes(literal), `expected heroTab.js to carry the literal ${literal}`);
    assert.ok(!CLASSIC.includes(literal), `expected the classic script to carry zero copies of ${literal}`);
    assert.ok(!MOD.includes(literal), `expected the module script to carry zero copies of ${literal}`);
  }
});

// ─── (9) T-38-11: renderAbilityRows carries no innerHTML ─────────────────

test("renderAbilityRows: createElement/textContent only (no innerHTML in the region)", () => {
  const region = sliceBetween(HERO_STRIPPED, "function renderAbilityRows(doc, state) {", "\nfunction renderGrimoire(");
  assert.doesNotMatch(region, /innerHTML/);
});

// ─── (10) paintConditions( is still called from paint() — the HUD strip
// did not move ─────────────────────────────────────────────────────────

test("paintConditions( is still called from paint() (the HUD condition strip stays in the classic script)", () => {
  const region = paintRegion();
  assert.equal((region.match(/paintConditions\(c\);/g) || []).length, 1);
});

// ─── (11) voice safety of the copy moved into heroTab.js ─────────────────

test("Voice: the moved copy clears the family-friendly safety wordlist", () => {
  const bannedRe = BANNED.map((term) => new RegExp("\\b" + term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i"));
  for (const phrase of ["Spells are the trick.", "Send them off?", "DISMISS", "Combat only", "No spells learned yet."]) {
    for (const re of bannedRe) {
      assert.doesNotMatch(phrase, re, `"${phrase}" must not match banned term ${re}`);
    }
  }
});
