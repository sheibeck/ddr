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
const AFTER_PATH = path.join(REPO_ROOT, "docs", "economy", "econ-after-1000.json");

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
  "## After the retune (92-03)",
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

test("econ ledger: once the Status reads 'target confirmed', the Ruling carries the fixed block", () => {
  const status = doc.match(/^\*\*Status:\*\* (.+)$/m)[1];
  if (!/^(target confirmed|retuned|no retune)/.test(status)) return; // still open: the placeholder is enough
  const ruling = section(H2_ORDER[6]);
  for (const label of ["Target", "Shape", "Lever", "First candidate", "Stop rule"]) {
    assert.ok(ruling.split("\n").some((l) => l.startsWith(`**${label}:** `) && l.length > label.length + 6), `Ruling lacks **${label}:**`);
  }
  assert.match(status, /\d{4}-\d{2}-\d{2}/, "the Status line carries the confirmation date");
});

// --- Phase 92 plan 03 (ECON-12): the After section and its stored proof run ---

test("econ ledger (92-03): the After section exists once the Status reads 'retuned'", () => {
  const status = doc.match(/^\*\*Status:\*\* (.+)$/m)[1];
  assert.match(status, /^retuned \d{4}-\d{2}-\d{2}/, "92-03 retuned the economy: the Status says so with its date");
  assert.ok(section(H2_ORDER[7]).trim().length > 0);
});

test("econ ledger (92-03): the stored after-report is 1,000 seeds on the shipped dials and its commit is named in the After section", () => {
  const after = JSON.parse(read(AFTER_PATH));
  assert.equal(after.meta.tool, "tune-economy");
  assert.equal(after.meta.seeds, 1000);
  assert.equal(after.meta.seedList, "i*7919+1");
  assert.ok(after.meta.dials === "shipped" || (after.meta.dials && Object.keys(after.meta.dials).length === 0), "the proof run is on the shipped dials, no --dials override");
  assert.match(after.meta.commit, /^[0-9a-f]{7,40}$/);
  assert.equal(after.readout.depths.length, 12);
  assert.ok(section(H2_ORDER[7]).includes(after.meta.commit), `the After section does not name ${after.meta.commit}`);
});

test("econ ledger (92-03): the After section carries the affordability and income tables verbatim from the stored after-report", () => {
  const after = JSON.parse(read(AFTER_PATH));
  const md = formatEconomyMarkdown(after.readout, after.projections);
  const text = section(H2_ORDER[7]);
  assert.ok(text.includes(md.affordability), "after affordability tables differ from the stored JSON");
  assert.ok(text.includes(md.sources), "after income tables differ from the stored JSON");
});

test("econ ledger (92-03): the verdict line is PASS only when the stored depth-7 median is inside the ruled 33-50% band and floors 1-4 did not rise", () => {
  const after = JSON.parse(read(AFTER_PATH));
  const text = section(H2_ORDER[7]);
  const share7 = after.readout.depths[6].arrivals.shareWithSalesP50;
  assert.ok(share7 >= 0.33 && share7 <= 0.5, `depth-7 arrival share (gold plus bag) ${share7} is outside 33-50%`);
  for (let i = 0; i < 4; i++) {
    const a = after.readout.depths[i].arrivals;
    const b = report.readout.depths[i].arrivals;
    assert.equal(a.shareP50, b.shareP50, `floor ${i + 1}: gold-held share must be identical (the bot never sells)`);
    assert.ok(a.shareWithSalesP50 <= b.shareWithSalesP50 + 1e-9, `floor ${i + 1}: with-bag share must not rise`);
  }
  assert.ok(text.split("\n").some((l) => l.startsWith("**ECON-12 verdict:** PASS")), "no **ECON-12 verdict:** PASS line");
});
