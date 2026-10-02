// test/unit/economy-readout-ledger.test.js
//
// Phase 92 (ECON-11, 92-02) -- the structure and provenance guard for
// docs/ECONOMY-READOUT.md and docs/economy/econ-before-1000.json: the doc's
// tables are the renderer's output over the STORED report, never retyped.
// Structure and provenance only (mirrors test/unit/days-farming-ledger.test.js):
// it never plays a run. docs/ is committed CRLF in the main checkout, so both
// files are normalised to LF before comparing.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { formatEconomyMarkdown } from "../../tools/lib/economy-readout.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const REPORT_PATH = path.join(REPO_ROOT, "docs", "economy", "econ-before-1000.json");
const DOC_PATH = path.join(REPO_ROOT, "docs", "ECONOMY-READOUT.md");

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const report = JSON.parse(read(REPORT_PATH));
const doc = read(DOC_PATH);

const H2_ORDER = [
  "## What this measures",
  "## Store affordability by depth (floors 1–12)",
  "## Gold income by source",
  "## What a store holds",
  "## Reading",
  "## Target and levers (for the user)",
  "## Ruling",
];

function h2s(text) {
  return [...text.matchAll(/^## .+$/gm)].map((m) => m[0]);
}

function section(heading) {
  const start = doc.indexOf(`\n${heading}\n`);
  assert.ok(start >= 0, `missing ${heading}`);
  const rest = doc.slice(start + heading.length + 2);
  const next = rest.search(/^## /m);
  return next < 0 ? rest : rest.slice(0, next);
}

test("econ ledger: the stored report's meta (1,000 seeds, seed list, dials, commit)", () => {
  assert.equal(report.meta.tool, "tune-economy");
  assert.equal(report.meta.seeds, 1000);
  assert.equal(report.meta.seedList, "i*7919+1");
  assert.ok(report.meta.dials === "shipped" || (report.meta.dials && Object.keys(report.meta.dials).length === 0), "shipped dials or an empty override");
  assert.match(report.meta.commit, /^[0-9a-f]{7,40}$/);
  assert.equal(report.readout.depths.length, 12);
  assert.equal(report.readout.deeper.L, "13+");
});

test("econ ledger: the doc's H2s appear in order, once each", () => {
  assert.deepEqual(h2s(doc), H2_ORDER);
});

test("econ ledger: the doc carries the affordability, sources and stock tables verbatim from the stored JSON", () => {
  const md = formatEconomyMarkdown(report.readout, report.projections);
  assert.ok(section(H2_ORDER[1]).includes(md.affordability), "affordability tables differ from the stored JSON");
  assert.ok(section(H2_ORDER[2]).includes(md.sources), "income tables differ from the stored JSON");
  assert.ok(section(H2_ORDER[3]).includes(md.stock), "stock table differs from the stored JSON");
  assert.ok(section(H2_ORDER[5]).includes(md.levers), "lever projection tables differ from the stored JSON");
});

test("econ ledger: the Measured line names the stored report's commit and the run's shape", () => {
  const m = doc.match(/^\*\*Measured:\*\* (.+)$/m);
  assert.ok(m, "no **Measured:** line");
  assert.ok(m[1].includes(report.meta.commit), `Measured line does not name ${report.meta.commit}`);
  assert.ok(m[1].includes("--seeds=1000"));
  assert.match(doc, /^\*\*Status:\*\* .+$/m);
  assert.match(doc, /^\*\*Date:\*\* \d{4}-\d{2}-\d{2}/m);
});

test("econ ledger: a Ruling section exists", () => {
  assert.ok(section(H2_ORDER[6]).trim().length > 0);
});
