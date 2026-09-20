// test/unit/gearTab.test.js
//
// Phase 47 (SHELL-01), Plan 03 — src/browser/gearTab.js's own source-pin
// suite: the module's exports/no-globals/id-containment/dead-code-deletion
// contract, plus the mount pins on mazeworld.html's classic paint() and
// module script. Mirrors test/unit/shell-no-content-copies.test.js's
// classic/module region-split pattern and tools/ident-sweep.mjs's own
// stripJs (imported, never reimplemented).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { stripJs } from "../../tools/ident-sweep.mjs";
import { BANNED } from "../../content/safety-wordlist.js";
import * as gearTab from "../../src/browser/gearTab.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const GEAR_PATH = path.join(REPO_ROOT, "src", "browser", "gearTab.js");
const HTML_PATH = path.join(REPO_ROOT, "mazeworld.html");

const GEAR_RAW = fs.readFileSync(GEAR_PATH, "utf8").replace(/\r\n/g, "\n");
const GEAR_STRIPPED = stripJs(GEAR_RAW);
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

test("gearTab.js exports renderGearTab, renderCarriedList and the five view models", () => {
  for (const name of ["renderGearTab", "renderCarriedList", "bagUsage", "GEAR_COPY", "emptySlotRows", "ITEM_STATE_COPY", "itemRowState"]) {
    assert.ok(name in gearTab, `expected gearTab.js to export ${name}`);
  }
  assert.equal(typeof gearTab.renderGearTab, "function");
  assert.equal(typeof gearTab.renderCarriedList, "function");
  assert.equal(typeof gearTab.bagUsage, "function");
  assert.equal(typeof gearTab.emptySlotRows, "function");
  assert.equal(typeof gearTab.itemRowState, "function");
  assert.equal(typeof gearTab.GEAR_COPY, "object");
  assert.equal(typeof gearTab.ITEM_STATE_COPY, "object");
});

// ─── (2) no window/document globals ──────────────────────────────────────

test("gearTab.js reads no window/document global — host, host.ownerDocument and deps only", () => {
  assert.doesNotMatch(GEAR_STRIPPED, /\bwindow\./);
  assert.doesNotMatch(GEAR_STRIPPED, /\bdocument\./);
  assert.ok((GEAR_STRIPPED.match(/ownerDocument/g) || []).length >= 1, "expected at least one ownerDocument read");
});

// ─── (3) every id gearTab.js writes lives inside #screen-gear ────────────

function gearScreenMarkup() {
  const start = HTML_RAW.indexOf('<section class="mw-screen" id="screen-gear"');
  assert.ok(start !== -1, "#screen-gear section not found");
  // #screen-gear nests its own <section class="panel" ...> children, so the
  // FIRST "</section>" closes onyou-panel, not the outer screen — slice to
  // the next mw-screen sibling (screen-oracle) instead.
  const end = HTML_RAW.indexOf('<section class="mw-screen" id="screen-oracle"', start);
  assert.ok(end !== -1 && end > start, "#screen-gear section close not found");
  return HTML_RAW.slice(start, end);
}

test("every getElementById(\"<id>\") call in gearTab.js targets an id inside the #screen-gear markup section", () => {
  const ids = [...GEAR_STRIPPED.matchAll(/getElementById\("([^"]+)"\)/g)].map((m) => m[1]);
  assert.ok(ids.length >= 5, `expected at least 5 getElementById calls, found ${ids.length}`);
  const screenGear = gearScreenMarkup();
  for (const id of ids) {
    assert.ok(screenGear.includes(`id="${id}"`), `expected #screen-gear markup to declare id="${id}"`);
  }
});

// ─── (4) the confirm trios live in gearTab.js only ───────────────────────

test("the Drop/Swap confirm trios are declared once each in gearTab.js and zero times in the classic script", () => {
  for (const decl of [
    "const DROP_CONFIRM_MS = 3000;",
    "let dropConfirmRevert = null;",
    "function revertDropConfirm()",
    "const SWAP_CONFIRM_MS = 3000;",
    "let swapConfirmRevert = null;",
    "function revertSwapConfirm()",
  ]) {
    assert.equal((GEAR_STRIPPED.match(new RegExp(decl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length, 1, `expected exactly one ${decl} in gearTab.js`);
    assert.equal((CLASSIC.match(new RegExp(decl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length, 0, `expected zero ${decl} in the classic script`);
  }
});

// ─── (5) paint() mounts through exactly one window.__mzTabs.gear(...) call ──

function paintRegion() {
  return sliceBetween(CLASSIC, "function paint() {", "\n}");
}

test("paint() contains exactly one window.__mzTabs.gear(...) mount call and no Gear-tab id literal", () => {
  const region = paintRegion();
  assert.equal((region.match(/window\.__mzTabs\.gear\(document\.getElementById\("screen-gear"\), S, tabDeps\(\)\);/g) || []).length, 1);
  assert.equal((region.match(/"(s-onyou|s-carry|s-carry-n|s-kit|m-gold)"/g) || []).length, 0);
});

// ─── (6) the classic script declares no renderCarriedList ────────────────

test("the classic script declares no function renderCarriedList(", () => {
  assert.equal((CLASSIC.match(/function renderCarriedList\(/g) || []).length, 0);
});

// ─── (7) the classic loot card and store sell list reach the shared list
// through window.__mzCarriedList( ─────────────────────────────────────────

test('window.__mzCarriedList( appears in the classic script at least once (the loot card; Plan 05 moves the store call and tightens this to 1)', () => {
  assert.ok((CLASSIC.match(/window\.__mzCarriedList\(/g) || []).length >= 1);
});

// ─── (8) the module script assigns window.__mzTabs before the first boot() ──

test("the module script assigns window.__mzTabs = Object.freeze({ gear: renderGearTab }); before await boot(", () => {
  const bridgeIdx = MOD.indexOf("window.__mzTabs = Object.freeze({ gear: renderGearTab });");
  const bootIdx = MOD.indexOf("await boot(");
  assert.ok(bridgeIdx !== -1, "window.__mzTabs assignment not found");
  assert.ok(bootIdx !== -1, "await boot( call not found");
  assert.ok(bridgeIdx < bootIdx, "window.__mzTabs must be assigned before the first await boot(");
  assert.equal((MOD.match(/window\.__mzTabs = Object\.freeze\(\{ gear: renderGearTab \}\);/g) || []).length, 1);
  assert.equal((MOD.match(/window\.__mzCarriedList = renderCarriedList;/g) || []).length, 1);
});

// ─── (9) tabDeps() names all 12 keys ──────────────────────────────────────

test("function tabDeps() appears once and its body names all 12 deps keys", () => {
  assert.equal((CLASSIC.match(/function tabDeps\(\)/g) || []).length, 1);
  const region = sliceBetween(CLASSIC, "function tabDeps() {", "\nfunction paint() {");
  for (const key of [
    "guardTap",
    "useItem",
    "equipItem",
    "unequip",
    "dropItem",
    "sellItem",
    "takeLoot",
    "leaveLoot",
    "buyItem",
    "leaveStore",
    "dismissJoiner",
    "castSpell",
  ]) {
    assert.match(region, new RegExp(`\\b${key}\\b`), `expected tabDeps() to name ${key}`);
  }
});

// ─── (10) voice: GEAR_COPY/ITEM_STATE_COPY clear the safety wordlist ──────

function collectStringLeaves(obj, pathLabel = "") {
  const leaves = [];
  if (typeof obj === "string") {
    leaves.push([pathLabel, obj]);
    return leaves;
  }
  if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) leaves.push(...collectStringLeaves(v, pathLabel ? `${pathLabel}.${k}` : k));
  }
  return leaves;
}

test("GEAR_COPY/ITEM_STATE_COPY: every string leaf clears the family-friendly safety wordlist", () => {
  const bannedRe = BANNED.map((term) => new RegExp("\\b" + term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i"));
  for (const [bankName, bank] of [["GEAR_COPY", gearTab.GEAR_COPY], ["ITEM_STATE_COPY", gearTab.ITEM_STATE_COPY]]) {
    for (const [leafPath, value] of collectStringLeaves(bank)) {
      for (const re of bannedRe) {
        assert.doesNotMatch(value, re, `${bankName}.${leafPath} -> "${value}" matches banned term ${re}`);
      }
    }
  }
});
