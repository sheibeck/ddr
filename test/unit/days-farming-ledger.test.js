// test/unit/days-farming-ledger.test.js
//
// Phase 82 (FARM-01/FARM-02) — the standing structural + provenance guard
// for docs/DAYS-FARMING.md and docs/days-farming/days-farm.json: this test
// ties the ledger's pasted numbers and rule line to the STORED measurement
// report, so neither can silently drift from the data. It asserts STRUCTURE
// AND PROVENANCE ONLY (mirrors test/unit/difficulty-retune-ledger.test.js's
// own discipline) — it never plays a bot run itself, so `npm test` stays
// fast; the one full 200-seed measurement is plan 82-02's own one-time
// invocation, already committed as docs/days-farming/days-farm.json.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { buildFarmReport, formatFarmReport, DAYS_RULES } from "../../tools/lib/days-farm.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const REPORT_PATH = path.join(REPO_ROOT, "docs", "days-farming", "days-farm.json");
const DOC_PATH = path.join(REPO_ROOT, "docs", "DAYS-FARMING.md");

// Normalize CRLF to LF before comparing — docs/ is committed CRLF
// (core.autocrlf=true) and is never rewritten by this test.
const reportRaw = fs.readFileSync(REPORT_PATH, "utf8").replace(/\r\n/g, "\n");
const report = JSON.parse(reportRaw);
const doc = fs.readFileSync(DOC_PATH, "utf8").replace(/\r\n/g, "\n");

/** h2s(text) -> the list of `## ` heading lines, in document order. */
function h2s(text) {
  return [...text.matchAll(/^## .+$/gm)].map((m) => m[0]);
}

test("days-farm.json: meta shape", () => {
  assert.equal(report.meta.tool, "days-farm");
  assert.equal(report.meta.seeds, 200);
  assert.deepEqual(report.meta.farmFloors, [1, 2]);
  assert.deepEqual(report.meta.caps, { maxActions: 20000, maxDays: 500 });
});

test("days-farm.json: row counts", () => {
  assert.equal(report.honest.rows.length, 200);
  for (const floorKey of ["1", "2"]) {
    for (const variant of ["noStairs", "hoarder"]) {
      assert.equal(report.farm[floorKey][variant].rows.length, 200, `farm[${floorKey}][${variant}].rows.length`);
    }
  }
});

test("days-farm.json: rebuilding the report from its own stored rows deep-equals the stored report (no hand-edited summary/verdict)", () => {
  const farmRows = {};
  for (const floorKey of Object.keys(report.farm)) {
    farmRows[floorKey] = {};
    for (const variant of Object.keys(report.farm[floorKey])) {
      farmRows[floorKey][variant] = report.farm[floorKey][variant].rows;
    }
  }
  const rebuilt = buildFarmReport({ meta: report.meta, honestRows: report.honest.rows, farmRows });
  assert.deepStrictEqual(rebuilt, report);
});

test("days-farm.json: verdict.branch is one of the three fixed DAYS_RULES keys, and ruleLine matches", () => {
  assert.ok(["mock", "floor2plus", "perFloorCap"].includes(report.verdict.branch), `unexpected branch: ${report.verdict.branch}`);
  assert.equal(report.verdict.ruleLine, DAYS_RULES[report.verdict.branch].ruleLine);
});

test("DAYS-FARMING.md: exactly one '## The DAYS rule' heading, first non-blank line after it equals verdict.ruleLine", () => {
  const lines = doc.split("\n");
  const headingLines = lines.filter((l) => l === "## The DAYS rule");
  assert.equal(headingLines.length, 1);

  const idx = lines.indexOf("## The DAYS rule");
  let j = idx + 1;
  while (j < lines.length && lines[j].trim() === "") j++;
  assert.ok(j < lines.length, "no non-blank line found after '## The DAYS rule'");
  assert.equal(lines[j], report.verdict.ruleLine);
});

test("DAYS-FARMING.md: the pasted report block (between the markers) equals formatFarmReport(report)", () => {
  const startMarker = "<!-- days-farm:report:start -->";
  const endMarker = "<!-- days-farm:report:end -->";
  const startIdx = doc.indexOf(startMarker);
  const endIdx = doc.indexOf(endMarker);
  assert.ok(startIdx !== -1, "missing days-farm:report:start marker");
  assert.ok(endIdx !== -1, "missing days-farm:report:end marker");
  assert.ok(endIdx > startIdx, "end marker must come after start marker");

  const block = doc.slice(startIdx + startMarker.length, endIdx).trim();
  const expected = formatFarmReport(report).trim();
  assert.equal(block, expected);
});

test("DAYS-FARMING.md: contains the exact measurement command", () => {
  assert.ok(doc.includes("node tools/days-farm.mjs --seeds=200 --farm-floor=1,2"), "measurement command not found verbatim in the ledger");
});

test("DAYS-FARMING.md: headings appear in the required order", () => {
  const required = ["## The question", "## Method", "## Commands", "## Results", "## Verdict", "## The DAYS rule", "## For Phase 83 and Phase 84", "## Engine gate"];
  const headings = h2s(doc);
  const positions = required.map((h) => headings.indexOf(h));
  for (let i = 0; i < required.length; i++) {
    assert.notEqual(positions[i], -1, `missing heading: ${required[i]}`);
  }
  for (let i = 1; i < positions.length; i++) {
    assert.ok(positions[i] > positions[i - 1], `heading out of order: "${required[i]}" must come after "${required[i - 1]}"`);
  }
});
