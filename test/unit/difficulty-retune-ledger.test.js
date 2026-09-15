// test/unit/difficulty-retune-ledger.test.js
//
// Phase 27 (TUNE-05) — the standing structural guard for
// docs/DIFFICULTY-RETUNE.md's `## v1.2 retune (Phase 27)` section: heading
// placement, the band table's numbers, the D-09 superseded marker, the
// verbatim v1.1 verdict quote, the Phase 26 Bot lines, and the fixed
// sub-heading order. This test asserts STRUCTURE AND PROVENANCE ONLY — it
// never asserts a balance/AFTER outcome (no retuned mean depth, no landed
// constant value), so it stays a sanity floor, not a gate on tuning
// decisions (mirrors test/unit/class-pass-ledger.test.js's own discipline).
// 27-03 extends this file with the retune AFTER JSON provenance checks; it
// does NOT assert the absence of "(filled by plan ...)" placeholders —
// 27-02/27-03/27-04 fill them in over the life of the phase.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const DOC_PATH = path.join(REPO_ROOT, "docs", "DIFFICULTY-RETUNE.md");
// Normalise CRLF to LF before matching — the file itself is CRLF
// (core.autocrlf=true) and is never rewritten by this plan or this test.
const doc = fs.readFileSync(DOC_PATH, "utf8").replace(/\r\n/g, "\n");

// --- doc-parsing helpers (mirrors test/unit/class-pass-ledger.test.js) ---

/** h2s(doc) -> the list of `## ` heading lines, in document order. */
function h2s(text) {
  return [...text.matchAll(/^## .+$/gm)].map((m) => m[0]);
}

/**
 * section(doc, headingRegex) -> the text from the first line matching
 * headingRegex through (but not including) the next `## ` heading, or EOF.
 * Throws when no line matches headingRegex.
 */
function section(text, headingRegex) {
  const lines = text.split("\n");
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (headingRegex.test(lines[i])) {
      start = i;
      break;
    }
  }
  if (start === -1) throw new Error(`section: no heading matches ${headingRegex}`);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

const v1_2 = section(doc, /^## v1\.2 retune \(Phase 27\)/);

// --- (1) v1.2 section: exactly once, last H2 -----------------------------

test('v1.2 section: the H2 "## v1.2 retune (Phase 27)" appears exactly once and is the LAST H2 of the ledger', () => {
  const headings = h2s(doc);
  const matches = headings.filter((h) => h.startsWith("## v1.2 retune (Phase 27)"));
  assert.equal(matches.length, 1, `expected exactly one v1.2 H2 heading, found ${matches.length}: ${matches.join(" | ")}`);
  assert.equal(headings[headings.length - 1], matches[0], `the v1.2 section must be the LAST H2 in the ledger, last H2 was: ${headings[headings.length - 1]}`);
});

// --- (2) band table: the measure rows and their target numbers ----------

test("band table: the seven measure rows are present with their target numbers", () => {
  const expectedStrings = [
    "5-6",
    "1.0-2.0",
    "3.0-5.0",
    "p50 >= 1",
    "Reach >= 20",
    "10-20",
    "hard gate",
    "rollups.pooled.p50Depth",
    "rollups.pooled.reach20",
    "rollups.pooled.meanEncountersSurvived",
    "rollups.pooled.p50FloorsGained",
    "--start-depth=35",
    "--start-depth=50",
    "class-pass-diff.mjs --gate",
  ];
  for (const s of expectedStrings) {
    assert.ok(v1_2.includes(s), `v1.2 section is missing band-table string: ${JSON.stringify(s)}`);
  }
});

// --- (3) D-09 superseded --------------------------------------------------

test("D-09 is marked superseded inside the v1.2 section", () => {
  assert.ok(v1_2.includes("SUPERSEDED"), "v1.2 section is missing the SUPERSEDED marker");
  assert.ok(v1_2.includes("D-09"), "v1.2 section does not reference D-09");
});

// --- (4) verbatim v1.1 verdict --------------------------------------------

test("the v1.1 verdict is quoted verbatim", () => {
  assert.ok(
    v1_2.includes("\"Level 20, way overtuned. It's instant death on any combat.\""),
    "v1.2 section is missing the verbatim v1.1 verdict quote",
  );
});

// --- (5) sub-headings present in the fixed order --------------------------

test("sub-headings present in the fixed order", () => {
  const expectedOrder = [
    /^### Why again/,
    /^### Standing rules/,
    /^### Target band \(TUNE-05\)/,
    /^### Bot proxy and parameters/,
    /^### BEFORE — by reference/,
    /^### Levers and the Dante decision/,
    /^### Iteration protocol/,
    /^### Dante demotion — landed \(27-02\)/,
    /^### Change table \(27-02 \/ 27-03\)/,
    /^### Iteration log/,
    /^### AFTER readouts — retuned engine/,
    /^### Comparison vs band/,
    /^### Counterweight triggers/,
    /^### Not changed, and why/,
    /^### DR checklist — TUNE-07/,
    /^### Verdict \(TUNE-07\)/,
  ];

  const h3Lines = [...v1_2.matchAll(/^### .+$/gm)].map((m) => m[0]);
  assert.equal(h3Lines.length, expectedOrder.length, `expected ${expectedOrder.length} H3 sub-headings in the v1.2 section, found ${h3Lines.length}: ${h3Lines.join(" | ")}`);

  expectedOrder.forEach((re, i) => {
    assert.ok(re.test(h3Lines[i]), `sub-heading ${i} ("${h3Lines[i]}") should match ${re}`);
  });
});

// --- (6) the two Phase 26 Bot lines, verbatim ------------------------------

test("the two Phase 26 Bot lines are quoted verbatim", () => {
  const natural = "Bot: exploreBudget=50  maxActions=5000  party=off  flee=0.3/0.5(caster)  potion<0.5  camp<0.5  seeds=40  workers=4  startDepth=1";
  const deep = "Bot: exploreBudget=50  maxActions=5000  party=off  flee=0.3/0.5(caster)  potion<0.5  camp<0.5  seeds=10  workers=4  startDepth=20";
  assert.ok(v1_2.includes(natural), "v1.2 section is missing the natural (startDepth=1) Bot line verbatim");
  assert.ok(v1_2.includes(deep), "v1.2 section is missing the depth-20 (startDepth=20) Bot line verbatim");
});
