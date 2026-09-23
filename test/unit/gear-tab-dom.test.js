// test/unit/gear-tab-dom.test.js
//
// Phase 62 (GSCR-01..06), Plan 02 — the rebuilt Gear tab's DOM + CSS pin
// suite. Task 1 covers the CSS block (every .mw-gear-*/#gear-* font-size
// scales with --mw-text-scale, no transition/animation, the retired Phase
// 43 rules are gone) and the tabDeps() drinkPotion/readScroll closures.
// Task 2 adds the render section (renderGearTab against the Plan 01 models).
// Mirrors gearTab.test.js's own HTML read (CRLF-normalized) and its
// stripComments/extractScriptRegions helpers.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { createRecordingDocument } from "./harness/recordingDom.js";
import {
  renderGearTab,
  renderCarriedList,
  GEAR_COPY,
  GEAR_WORN_ORDER,
  gearHeaderModel,
  gearUseCell,
  gearWornModel,
  gearBagMeterModel,
  gearBagCardsModel,
  gearConsumablesModel,
  gearKitRows,
} from "../../src/browser/gearTab.js";
import { LINE_FOR } from "../../src/browser/narrationLines.js";
import { newRun } from "../../engine/state.js";
import { stowItem, equipItem as engineEquipItem } from "../../engine/items.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const HTML_PATH = path.join(REPO_ROOT, "mazeworld.html");
const HTML_RAW = fs.readFileSync(HTML_PATH, "utf8").replace(/\r\n/g, "\n");

// ─── comment stripping (same order-sensitive approach as gearTab.test.js:
// line comments first, THEN block comments) ────────────────────────────────
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

function extractScriptRegions(raw) {
  const classicStart = raw.indexOf("\n<script>\n");
  assert.ok(classicStart !== -1, "column-0 <script> tag not found");
  const classicEnd = raw.indexOf("\n</script>\n", classicStart + 1);
  assert.ok(classicEnd !== -1, "classic </script> tag not found");
  return { classic: raw.slice(classicStart + 1, classicEnd) };
}

const { classic: CLASSIC_RAW } = extractScriptRegions(HTML_RAW);
const CLASSIC = stripComments(CLASSIC_RAW);

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start === -1 ? 0 : start);
  assert.ok(start !== -1, `start marker not found: ${startMarker}`);
  assert.ok(end !== -1 && end > start, `end marker not found after start: ${endMarker}`);
  return source.slice(start, end);
}

// The <style> block: everything between the first "<style>" that opens the
// theme's :root token block and its matching "</style>" — this file's own
// pins only care about the :root-token style block (where every .mw-gear-*/
// #gear-* rule lives), never the tiny head-of-file resets.
function styleBlock() {
  const start = HTML_RAW.indexOf(":root{");
  assert.ok(start !== -1, ":root token block not found");
  const end = HTML_RAW.indexOf("</style>", start);
  assert.ok(end !== -1, "</style> not found after :root");
  return HTML_RAW.slice(start, end);
}

// ─── (a)/(b): every .mw-gear-*/#gear- font-size line scales with
// --mw-text-scale, and none carries a transition/animation token ──────────

function gearStyleLines() {
  const block = styleBlock();
  return block
    .split("\n")
    .filter((line) => /^\s*(\.mw-gear-[^{]*|#gear-[^{]*)\{/.test(line));
}

test("CSS: every Gear-tab font-size declaration scales with var(--mw-text-scale)", () => {
  const lines = gearStyleLines();
  assert.ok(lines.length >= 20, `expected at least 20 .mw-gear-/#gear- style lines, found ${lines.length}`);
  let fontSizeCount = 0;
  for (const line of lines) {
    // A font-size declaration is terminated by either ";" (another
    // declaration follows) or "}" (it's the rule's last declaration).
    const m = line.match(/font-size:([^;}]+)[;}]/);
    if (!m) continue;
    fontSizeCount++;
    assert.match(m[1], /var\(--mw-text-scale\)/, `expected ${line.trim()} to scale with var(--mw-text-scale)`);
  }
  assert.ok(fontSizeCount >= 20, `expected at least 20 font-size declarations, found ${fontSizeCount}`);
});

test("CSS: no Gear-tab rule carries a transition or animation token", () => {
  const lines = gearStyleLines();
  for (const line of lines) {
    assert.doesNotMatch(line, /transition/i, `unexpected transition in ${line.trim()}`);
    assert.doesNotMatch(line, /animation/i, `unexpected animation in ${line.trim()}`);
  }
});

// ─── (c): five anchor rules appear exactly once each ──────────────────────

test("CSS: .mw-gear-row{, .mw-gear-card{, .mw-gear-head{, .mw-gear-use-btn{ and .mw-gear-pip{ each appear exactly once", () => {
  const block = styleBlock();
  for (const sel of [".mw-gear-row{", ".mw-gear-card{", ".mw-gear-head{", ".mw-gear-use-btn{", ".mw-gear-pip{"]) {
    const re = new RegExp("^" + sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "m");
    const count = (block.match(new RegExp(re.source, "gm")) || []).length;
    assert.equal(count, 1, `expected exactly one ${sel} rule, found ${count}`);
  }
});

// ─── (d): the three retired Phase 43 rules and .mw-wilmst are gone ────────

test("CSS: the retired Phase 43 gear rules and .mw-wilmst are gone", () => {
  const block = styleBlock();
  for (const sel of [".mw-onyou-head{", ".mw-worn-empty{", ".mw-kit-head{", ".mw-wilmst{"]) {
    const re = new RegExp("^" + sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "m");
    assert.equal((block.match(new RegExp(re.source, "gm")) || []).length, 0, `expected zero ${sel} rules`);
  }
});

// ─── (e): tabDeps names drinkPotion and readScroll ─────────────────────────

test("tabDeps() names drinkPotion and readScroll, mapped to window.mzDrinkPotion?.() / window.mzReadScroll?.()", () => {
  const region = sliceBetween(CLASSIC, "function tabDeps() {", "\nfunction paint() {");
  assert.match(region, /drinkPotion: \(\) => window\.mzDrinkPotion\?\.\(\),/);
  assert.match(region, /readScroll: \(\) => window\.mzReadScroll\?\.\(\),/);
});

// The render section (Task 2) is added below this line.
