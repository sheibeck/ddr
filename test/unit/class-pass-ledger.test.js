// test/unit/class-pass-ledger.test.js
//
// Phase 26 (PLAY-03) — the standing guard for the class-pass ledger
// (docs/CLASS-PASS.md) and its four AFTER/BEFORE JSONs plus
// docs/class-pass/verdicts.json. Asserts STRUCTURE, PROVENANCE and the
// cannot-act INVARIANT — it never asserts a balance number (no mean depth,
// rank, band count, or verdict count is pinned), so this suite stays a
// sanity floor, not a CI gate on balance (26-CONTEXT.md "Established
// Patterns"). If this test fails after an INTENTIONAL ledger change,
// re-render docs/CLASS-PASS.md and docs/class-pass/verdicts.json through
// tools/class-pass-diff.mjs rather than editing an assertion here — a
// weakened assertion is exactly the drift this test exists to catch
// (T-26-23).
//
// Phase 36 Plan 01 (BAL-01) appended a ninth section, "## v1.5 BEFORE",
// additively: the eight v1.2 heading regexes above stay in place at
// indices 0-7 (Handoff to Phase 27 is no longer the LAST heading, just the
// last of the v1.2 set), and three new tests below pin the v1.5 BEFORE
// section's hash/provenance/meta-parity/cell-keys/cannot-act against
// docs/class-pass/v15-before.json and v15-before-depth20.json.
//
// Every check re-derives its expectation through tools/class-pass-diff.mjs's
// own exported helpers (metaParity, cannotActCells, cellKey, buildVerdicts,
// renderMarkdown) rather than hand-deriving a second copy of the rules, so
// the ledger's prose is checked against the script's own logic, not against
// a parallel restatement of it.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { metaParity, cannotActCells, cellKey, buildVerdicts, renderMarkdown } from "../../tools/class-pass-diff.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const DOC_PATH = path.join(REPO_ROOT, "docs", "CLASS-PASS.md");
const doc = fs.readFileSync(DOC_PATH, "utf8").replace(/\r\n/g, "\n"); // CRLF-tolerant: core.autocrlf checkouts

const before = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "docs", "class-pass", "before.json"), "utf8"));
const beforeDeep = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "docs", "class-pass", "before-depth20.json"), "utf8"));
const after = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "docs", "class-pass", "after.json"), "utf8"));
const afterDeep = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "docs", "class-pass", "after-depth20.json"), "utf8"));
const verdicts = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "docs", "class-pass", "verdicts.json"), "utf8"));
const v15Before = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "docs", "class-pass", "v15-before.json"), "utf8"));
const v15BeforeDeep = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "docs", "class-pass", "v15-before-depth20.json"), "utf8"));
const v15After = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "docs", "class-pass", "v15-after.json"), "utf8"));
const v15AfterDeep = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "docs", "class-pass", "v15-after-depth20.json"), "utf8"));
const v15Verdicts = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "docs", "class-pass", "v15-verdicts.json"), "utf8"));

// --- doc-parsing helpers -------------------------------------------------

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

// --- (1) section presence and fixed order -------------------------------

test("sections: exactly ten H2 headings, in the fixed order, v1.5 AFTER last", () => {
  const headings = h2s(doc);
  assert.equal(headings.length, 10, `expected exactly 10 H2 headings, found ${headings.length}: ${headings.join(" | ")}`);

  const expected = [
    /^## Bot proxy/,
    /^## How to reproduce$/,
    /^## BEFORE — commit [0-9a-f]{40} /,
    /^## Outliers \/ Findings \(Phase 22\)$/,
    /^## Rulings \(Phase 24 — PLAY-03\)$/,
    /^## AFTER — commit [0-9a-f]{40} \(Phase 26 — PLAY-02\)$/,
    /^## Outliers \(Phase 26 — revisit list\)$/,
    /^## Handoff to Phase 27$/,
    /^## v1\.5 BEFORE — commit [0-9a-f]{40} \(Phase 36 — BAL-01\)$/,
    /^## v1\.5 AFTER — commit [0-9a-f]{40} \(Phase 42 — BAL-02\)$/,
  ];
  expected.forEach((re, i) => {
    assert.ok(re.test(headings[i]), `heading ${i} ("${headings[i]}") should match ${re}`);
  });
  assert.equal(headings[7], "## Handoff to Phase 27");
  assert.equal(headings[9], headings[headings.length - 1], "v1.5 AFTER must be the last H2 heading");
});

// --- (2) AFTER placeholder replaced, BEFORE/Rulings anchors intact -------

test("AFTER placeholder was replaced in place, BEFORE/Rulings anchors intact", () => {
  assert.ok(!doc.includes("<hash>"), "the ledger still contains a literal <hash> placeholder");
  assert.ok(!doc.includes("Nothing recorded yet"), "the ledger still contains the unfilled placeholder sentence");

  const beforeHeadingMatch = doc.match(/^## BEFORE — commit ([0-9a-f]{40}) /m);
  assert.ok(beforeHeadingMatch, "BEFORE heading with a 40-hex commit hash not found");
  const beforeHash = beforeHeadingMatch[1];
  assert.ok(beforeHash.startsWith(before.meta.commit), "BEFORE heading hash does not start with before.json's meta.commit");
  assert.ok(beforeHash.startsWith(beforeDeep.meta.commit), "BEFORE heading hash does not start with before-depth20.json's meta.commit");

  const beforeSection = section(doc, /^## BEFORE — commit/);
  assert.ok(beforeSection.includes(before.meta.bot), "BEFORE section is missing before.json's verbatim Bot: line");
  assert.ok(beforeSection.includes(beforeDeep.meta.bot), "BEFORE section is missing before-depth20.json's verbatim Bot: line");

  const rulingsSection = section(doc, /^## Rulings \(Phase 24/);
  for (const heading of [
    "### Sub-class rulings",
    "### Race rulings",
    "### Ruling: level-1 Thief dagger (IDENT-10) — KEEP",
    "### Ruling: Freeze pays out",
    "### Good / bad table",
  ]) {
    assert.ok(rulingsSection.includes(heading), `Rulings section is missing "${heading}"`);
  }
  for (const identId of ["IDENT-05", "IDENT-06", "IDENT-07", "IDENT-09", "IDENT-10"]) {
    assert.ok(rulingsSection.includes(identId), `Rulings section does not mention ${identId}`);
  }
});

// --- (3) good/bad table: 30 data rows, present exactly once --------------

test("good/bad table: exactly 30 data rows, present exactly once", () => {
  const headerLine = "| Sub / Race | GOOD | BAD |";
  const occurrences = doc.split(headerLine).length - 1;
  assert.equal(occurrences, 1, `the good/bad table header row should occur exactly once in the ledger, found ${occurrences}`);

  const rulingsSection = section(doc, /^## Rulings \(Phase 24/);
  const rulingsLines = rulingsSection.split("\n");
  const tableStart = rulingsLines.findIndex((l) => l.startsWith("### Good / bad table"));
  assert.ok(tableStart !== -1, "### Good / bad table heading not found in Rulings section");
  let tableEnd = rulingsLines.length;
  for (let i = tableStart + 1; i < rulingsLines.length; i++) {
    if (rulingsLines[i].startsWith("### ")) {
      tableEnd = i;
      break;
    }
  }
  const tableRowLines = rulingsLines.slice(tableStart, tableEnd).filter((l) => l.startsWith("| "));
  // header row + separator row + 30 data rows = 32.
  assert.equal(tableRowLines.length, 32, `good/bad table should have 32 "| "-prefixed lines (header + separator + 30 rows), found ${tableRowLines.length}`);
});

// --- (4) AFTER hash equals after.json / after-depth20.json meta.commit ---

test("AFTER hash equals after.json and after-depth20.json meta.commit", () => {
  const afterHeadingMatch = doc.match(/^## AFTER — commit ([0-9a-f]{40}) \(Phase 26 — PLAY-02\)$/m);
  assert.ok(afterHeadingMatch, "AFTER heading with a 40-hex commit hash not found");
  const afterHash = afterHeadingMatch[1];
  assert.ok(afterHash.startsWith(after.meta.commit), "AFTER heading hash does not start with after.json's meta.commit");
  assert.equal(after.meta.commit, afterDeep.meta.commit, "after.json and after-depth20.json must share the same pin");

  const afterSection = section(doc, /^## AFTER — commit/);
  assert.ok(afterSection.includes(`\`${after.meta.commit}\``), "AFTER section is missing the backticked short commit hash");
  assert.ok(afterSection.includes(after.meta.bot), "AFTER section is missing after.json's verbatim Bot: line");
  assert.ok(afterSection.includes(afterDeep.meta.bot), "AFTER section is missing after-depth20.json's verbatim Bot: line");
  assert.ok(afterSection.includes("### Pin and provenance (Phase 26 capture)"), "AFTER section is missing the pin/provenance sub-heading");

  const transcriptHeadings = [...afterSection.matchAll(/^### AFTER transcript — tune-classes.*$/gm)];
  assert.equal(transcriptHeadings.length, 2, `expected exactly two "### AFTER transcript" sub-headings, found ${transcriptHeadings.length}`);

  const linesAfterHeading = afterSection.split("\n").slice(1);
  const firstNonBlank = linesAfterHeading.find((l) => l.trim() !== "");
  assert.ok(firstNonBlank.startsWith("**Zero cannot-act cells.**"), `AFTER section's first non-blank line should be the zero-cannot-act headline, got: ${firstNonBlank}`);
});

// --- (5) meta parity modulo commit ---------------------------------------

test("meta parity modulo commit (natural pair and depth-20 pair)", () => {
  const naturalParity = metaParity(before.meta, after.meta);
  assert.equal(naturalParity.ok, true, `natural pair parity mismatches: ${naturalParity.mismatches.join(", ")}`);
  const deepParity = metaParity(beforeDeep.meta, afterDeep.meta);
  assert.equal(deepParity.ok, true, `deep pair parity mismatches: ${deepParity.mismatches.join(", ")}`);

  assert.equal(after.meta.bot, before.meta.bot);
  assert.equal(afterDeep.meta.bot, beforeDeep.meta.bot);
  assert.notEqual(before.meta.commit, after.meta.commit, "BEFORE and AFTER must be different pins — a self-diff would be a mistake");
});

// --- (6) identical 143 cell keys ------------------------------------------

test("identical 143 cell keys in every pair", () => {
  const beforeKeys = new Set(before.cells.map(cellKey));
  const afterKeys = new Set(after.cells.map(cellKey));
  assert.deepStrictEqual(beforeKeys, afterKeys, "natural BEFORE/AFTER cell key sets differ");
  assert.equal(beforeKeys.size, 143);

  const beforeDeepKeys = new Set(beforeDeep.cells.map(cellKey));
  const afterDeepKeys = new Set(afterDeep.cells.map(cellKey));
  assert.deepStrictEqual(beforeDeepKeys, afterDeepKeys, "depth-20 BEFORE/AFTER cell key sets differ");
  assert.equal(beforeDeepKeys.size, 143);

  assert.equal(after.meta.cells, 143);
});

// --- (7) ZERO cannot-act cells in after.json (hard) -----------------------

test("ZERO cannot-act cells in after.json (hard)", () => {
  const flagged = cannotActCells(after);
  assert.deepStrictEqual(flagged, [], `cannot-act cells found in after.json: ${JSON.stringify(flagged)}`);

  assert.ok(
    after.cells.every((c) => c.stuck === 0 && c.completed === c.n && c.meanKills !== null && c.meanKills >= 0.5),
    "every after.json cell should have zero stuck runs, all runs completed, and non-null meanKills at or above the cannot-act floor",
  );
  assert.ok(afterDeep.cells.every((c) => c.stuck === 0), "the depth-20 slice should have no stuck runs either");

  const walk = (obj, seen = new Set()) => {
    if (obj === null || typeof obj !== "object" || seen.has(obj)) return;
    seen.add(obj);
    for (const val of Object.values(obj)) {
      if (typeof val === "number") assert.ok(!Number.isNaN(val), "found NaN in an AFTER file");
      walk(val, seen);
    }
  };
  walk(after);
  walk(afterDeep);
});

// --- (8) verdicts.json: schema, commits, editorial rules ------------------

test("verdicts.json: schema, commits, editorial rules", () => {
  assert.equal(verdicts.schema, "class-pass-verdicts/1");
  assert.equal(verdicts.meta.after.commit, after.meta.commit);
  assert.equal(verdicts.meta.before.commit, before.meta.commit);
  assert.equal(verdicts.subs.length, 24);
  assert.equal(verdicts.races.length, 6);
  assert.equal(verdicts.cannotAct.length, 0);
  assert.equal(verdicts.cells.inBand + verdicts.cells.outOfBand.length, 143);

  const validBands = new Set(["fine", "too weak", "too strong", "cannot act"]);
  const allRows = [...verdicts.subs, ...verdicts.races];
  for (const row of allRows) {
    assert.ok(validBands.has(row.band), `row "${row.key}" has an unrecognized band "${row.band}"`);
    assert.notEqual(row.band, "cannot act", `row "${row.key}" carries a cannot-act band — cannotAct.length is asserted zero above`);
    if (row.band !== "fine") {
      assert.ok(["accept", "revisit"].includes(row.verdict), `out-of-band row "${row.key}" must have verdict accept or revisit`);
      assert.ok(row.reason && row.reason.length > 0, `out-of-band row "${row.key}" must have a non-empty reason`);
    }
    if (row.verdict === "revisit") {
      assert.ok(row.lever && row.lever.length > 0, `revisit row "${row.key}" must have a non-empty lever`);
    }
    if (row.band === "fine") {
      assert.notEqual(row.verdict, "revisit", `in-band row "${row.key}" must not be marked revisit`);
    }
  }

  for (const group of [verdicts.deep.byClass, verdicts.deep.bySub, verdicts.deep.byRace]) {
    for (const row of group) {
      assert.ok(!("band" in row), `deep row "${row.key}" must never carry a band`);
      assert.ok(!("verdict" in row), `deep row "${row.key}" must never carry a verdict`);
    }
  }
});

// --- (9) Outliers (Phase 26) lists exactly the revisit rows ---------------

test("Outliers (Phase 26) lists exactly the revisit rows", () => {
  const expected = [...verdicts.subs, ...verdicts.races].filter((r) => r.verdict === "revisit").map((r) => r.key);
  const outliersSection = section(doc, /^## Outliers \(Phase 26 — revisit list\)$/);

  if (expected.length === 0) {
    assert.ok(
      outliersSection.includes("No revisit rows — every out-of-band row was accepted."),
      "with an empty revisit list, the Outliers section must contain the exact sentence",
    );
    const dataRows = outliersSection.split("\n").filter((l) => l.startsWith("| "));
    assert.equal(dataRows.length, 0, "the Outliers section must not contain a table when there are no revisit rows");
  } else {
    const tableLines = outliersSection.split("\n").filter((l) => l.startsWith("| "));
    // drop the header row and the separator row.
    const dataRows = tableLines.slice(2);
    const firstColumns = dataRows.map((l) => l.split("|")[1].trim());
    assert.deepStrictEqual(firstColumns, expected, "Outliers table rows must match verdicts.json's revisit set, in order");
    assert.ok(outliersSection.includes("Suggested lever (v1.3)"), "the Outliers table must carry the suggested-lever column header");
  }
});

// --- (10) AFTER/Outliers/Handoff byte-identical to a fresh render --------

test("AFTER, Outliers and Handoff blocks are byte-identical to a fresh render", () => {
  const rerendered = buildVerdicts({ before, after, beforeDeep, afterDeep, prior: verdicts });
  for (const sec of ["after", "outliers", "handoff"]) {
    const rendered = renderMarkdown(rerendered, sec).trim();
    assert.ok(doc.includes(rendered), `the ${sec} section rendered fresh from the script is not a byte-identical substring of the ledger`);
  }
  assert.equal(JSON.stringify(rerendered), JSON.stringify(verdicts), "docs/class-pass/verdicts.json is not a fixed point of the script's own render");
});

// --- (11) Handoff to Phase 27 carries the yardstick ------------------------

test("Handoff to Phase 27 carries the yardstick", () => {
  const handoffSection = section(doc, /^## Handoff to Phase 27$/);
  for (const heading of [
    "### Yardstick summary",
    "### AFTER natural roll-ups — by class",
    "### AFTER natural roll-ups — by sub-class",
    "### AFTER natural roll-ups — by race",
    "### Depth-20 roll-ups — by class",
    "### Depth-20 roll-ups — by sub-class",
    "### Depth-20 roll-ups — by race",
    "### Accepted-but-strong rows",
    "### Revisit rows",
    "### Caveats",
  ]) {
    assert.ok(handoffSection.includes(heading), `Handoff section is missing "${heading}"`);
  }

  const allHeadings = h2s(doc);
  assert.equal(allHeadings[7], "## Handoff to Phase 27", "Handoff to Phase 27 must be the eighth H2 section (last of the v1.2 set) in the ledger");
});

// --- (12) v1.5 BEFORE hash equals v15-before.json / v15-before-depth20.json meta.commit ---

test("v1.5 BEFORE hash equals v15-before.json and v15-before-depth20.json meta.commit", () => {
  const headingMatch = doc.match(/^## v1\.5 BEFORE — commit ([0-9a-f]{40}) \(Phase 36 — BAL-01\)$/m);
  assert.ok(headingMatch, "v1.5 BEFORE heading with a 40-hex commit hash not found");
  const hash = headingMatch[1];
  assert.ok(hash.startsWith(v15Before.meta.commit), "v1.5 BEFORE heading hash does not start with v15-before.json's meta.commit");
  assert.equal(v15Before.meta.commit, v15BeforeDeep.meta.commit, "v15-before.json and v15-before-depth20.json must share the same pin");

  const v15Section = section(doc, /^## v1\.5 BEFORE — commit/);
  assert.ok(v15Section.includes(`\`${v15Before.meta.commit}\``), "v1.5 BEFORE section is missing the backticked short commit hash");
  assert.ok(v15Section.includes(v15Before.meta.bot), "v1.5 BEFORE section is missing v15-before.json's verbatim Bot: line");
  assert.ok(v15Section.includes(v15BeforeDeep.meta.bot), "v1.5 BEFORE section is missing v15-before-depth20.json's verbatim Bot: line");
  assert.ok(v15Section.includes("### Pin and provenance (Phase 36 capture)"), "v1.5 BEFORE section is missing the pin/provenance sub-heading");

  const transcriptHeadings = [...v15Section.matchAll(/^### v1\.5 BEFORE transcript — tune-classes.*$/gm)];
  assert.equal(transcriptHeadings.length, 2, `expected exactly two "### v1.5 BEFORE transcript" sub-headings, found ${transcriptHeadings.length}`);

  const linesAfterHeading = v15Section.split("\n").slice(1);
  const firstNonBlank = linesAfterHeading.find((l) => l.trim() !== "");
  assert.ok(firstNonBlank.startsWith("**Zero cannot-act cells.**"), `v1.5 BEFORE section's first non-blank line should be the zero-cannot-act headline, got: ${firstNonBlank}`);
});

// --- (13) v1.5 BEFORE meta parity with the v1.2 BEFORE pair (modulo commit) ---

test("v1.5 BEFORE meta parity with the v1.2 BEFORE pair (modulo commit)", () => {
  const naturalParity = metaParity(before.meta, v15Before.meta);
  assert.equal(naturalParity.ok, true, `v1.2 BEFORE vs v1.5 BEFORE natural pair parity mismatches: ${naturalParity.mismatches.join(", ")}`);
  const deepParity = metaParity(beforeDeep.meta, v15BeforeDeep.meta);
  assert.equal(deepParity.ok, true, `v1.2 BEFORE vs v1.5 BEFORE deep pair parity mismatches: ${deepParity.mismatches.join(", ")}`);

  assert.equal(v15Before.meta.bot, before.meta.bot);
  assert.equal(v15BeforeDeep.meta.bot, beforeDeep.meta.bot);
  assert.notEqual(v15Before.meta.commit, after.meta.commit, "v1.5 BEFORE must be a fresh pin, not a copy of the v1.2 AFTER pin");
});

// --- (14) v1.5 BEFORE: identical 143 cell keys and zero cannot-act / zero stuck ---

test("v1.5 BEFORE: identical 143 cell keys and zero cannot-act / zero stuck", () => {
  const beforeKeys = new Set(before.cells.map(cellKey));
  const v15Keys = new Set(v15Before.cells.map(cellKey));
  assert.deepStrictEqual(beforeKeys, v15Keys, "v1.2 BEFORE / v1.5 BEFORE natural cell key sets differ");
  assert.equal(v15Keys.size, 143);

  const beforeDeepKeys = new Set(beforeDeep.cells.map(cellKey));
  const v15DeepKeys = new Set(v15BeforeDeep.cells.map(cellKey));
  assert.deepStrictEqual(beforeDeepKeys, v15DeepKeys, "v1.2 BEFORE / v1.5 BEFORE depth-20 cell key sets differ");
  assert.equal(v15DeepKeys.size, 143);

  const flagged = cannotActCells(v15Before);
  assert.deepStrictEqual(flagged, [], `cannot-act cells found in v15-before.json: ${JSON.stringify(flagged)}`);

  assert.ok(v15Before.cells.every((c) => c.stuck === 0 && c.completed === c.n), "every v15-before.json cell should have zero stuck runs and all runs completed");
  assert.ok(v15BeforeDeep.cells.every((c) => c.stuck === 0), "the v1.5 BEFORE depth-20 slice should have no stuck runs either");

  const walk = (obj, seen = new Set()) => {
    if (obj === null || typeof obj !== "object" || seen.has(obj)) return;
    seen.add(obj);
    for (const val of Object.values(obj)) {
      if (typeof val === "number") assert.ok(!Number.isNaN(val), "found NaN in a v1.5 BEFORE file");
      walk(val, seen);
    }
  };
  walk(v15Before);
  walk(v15BeforeDeep);
});

// --- (15) v1.5 AFTER hash equals v15-after.json / v15-after-depth20.json meta.commit ---

test("v1.5 AFTER hash equals v15-after.json and v15-after-depth20.json meta.commit", () => {
  const afterHeadingMatch = doc.match(/^## v1\.5 AFTER — commit ([0-9a-f]{40}) \(Phase 42 — BAL-02\)$/m);
  assert.ok(afterHeadingMatch, "v1.5 AFTER heading with a 40-hex commit hash not found");
  const afterHash = afterHeadingMatch[1];
  assert.ok(afterHash.startsWith(v15After.meta.commit), "v1.5 AFTER heading hash does not start with v15-after.json's meta.commit");
  assert.equal(v15After.meta.commit, v15AfterDeep.meta.commit, "v15-after.json and v15-after-depth20.json must share the same pin");

  const v15AfterSection = section(doc, /^## v1\.5 AFTER — commit/);
  assert.ok(v15AfterSection.includes(`\`${v15After.meta.commit}\``), "v1.5 AFTER section is missing the backticked short commit hash");
  assert.ok(v15AfterSection.includes(v15After.meta.bot), "v1.5 AFTER section is missing v15-after.json's verbatim Bot: line");
  assert.ok(v15AfterSection.includes(v15AfterDeep.meta.bot), "v1.5 AFTER section is missing v15-after-depth20.json's verbatim Bot: line");
  assert.ok(v15AfterSection.includes("### Pin and provenance (Phase 42 capture)"), "v1.5 AFTER section is missing the pin/provenance sub-heading");
  assert.ok(v15AfterSection.includes("### Depth-20 target verdict"), "v1.5 AFTER section is missing the depth-20 target verdict sub-heading");
  assert.ok(v15AfterSection.includes("### Pick-rates — abilities"), "v1.5 AFTER section is missing the abilities pick-rate sub-heading");

  const transcriptHeadings = [...v15AfterSection.matchAll(/^### v1\.5 AFTER transcript — tune-classes.*$/gm)];
  assert.equal(transcriptHeadings.length, 2, `expected exactly two "### v1.5 AFTER transcript" sub-headings, found ${transcriptHeadings.length}`);

  const linesAfterHeading = v15AfterSection.split("\n").slice(1);
  const firstNonBlank = linesAfterHeading.find((l) => l.trim() !== "");
  assert.ok(firstNonBlank.startsWith("**Zero cannot-act cells.**"), `v1.5 AFTER section's first non-blank line should be the zero-cannot-act headline, got: ${firstNonBlank}`);
});

// --- (16) v1.5 AFTER meta parity with the v1.5 BEFORE pair (modulo commit) ---

test("v1.5 AFTER meta parity with the v1.5 BEFORE pair (modulo commit), runFlags recorded (two-flag era)", () => {
  const naturalParity = metaParity(v15Before.meta, v15After.meta);
  assert.equal(naturalParity.ok, true, `v1.5 BEFORE vs v1.5 AFTER natural pair parity mismatches: ${naturalParity.mismatches.join(", ")}`);
  const deepParity = metaParity(v15BeforeDeep.meta, v15AfterDeep.meta);
  assert.equal(deepParity.ok, true, `v1.5 BEFORE vs v1.5 AFTER deep pair parity mismatches: ${deepParity.mismatches.join(", ")}`);

  assert.equal(v15After.meta.bot, v15Before.meta.bot);
  assert.equal(v15AfterDeep.meta.bot, v15BeforeDeep.meta.bot);
  assert.notEqual(v15Before.meta.commit, v15After.meta.commit, "v1.5 BEFORE and v1.5 AFTER must be different pins — a self-diff would be a mistake");

  // Phase 45 (HEDGE-01): the v1.5 AFTER readouts are frozen history — never
  // regenerated to today's RUN_FLAGS. These assertions stay true of the
  // stored files without spelling the retired Phase 37 run/load option
  // identifier: both readouts still carry storeRoll: true, and both readouts
  // agree with each other (byte-identical runFlags shape), and both still
  // carry exactly the two run flags recorded in their era.
  assert.equal(v15After.meta.runFlags.storeRoll, true);
  assert.equal(v15AfterDeep.meta.runFlags.storeRoll, true);
  assert.deepStrictEqual(v15After.meta.runFlags, v15AfterDeep.meta.runFlags);
  assert.equal(Object.keys(v15After.meta.runFlags).length, 2, "the v1.5 AFTER readouts recorded the two run flags of their era — storeRoll plus the Phase 37 worn-slot option Phase 45 collapsed into the engine's only path; frozen history, never regenerated to today's RUN_FLAGS");
});

// --- (17) v1.5 AFTER: identical 143 cell keys vs v1.5 BEFORE, zero cannot-act / zero stuck ---

test("v1.5 AFTER: identical 143 cell keys vs v1.5 BEFORE, zero cannot-act / zero stuck", () => {
  const v15BeforeKeys = new Set(v15Before.cells.map(cellKey));
  const v15AfterKeys = new Set(v15After.cells.map(cellKey));
  assert.deepStrictEqual(v15BeforeKeys, v15AfterKeys, "v1.5 BEFORE / v1.5 AFTER natural cell key sets differ");
  assert.equal(v15AfterKeys.size, 143);

  const v15BeforeDeepKeys = new Set(v15BeforeDeep.cells.map(cellKey));
  const v15AfterDeepKeys = new Set(v15AfterDeep.cells.map(cellKey));
  assert.deepStrictEqual(v15BeforeDeepKeys, v15AfterDeepKeys, "v1.5 BEFORE / v1.5 AFTER depth-20 cell key sets differ");
  assert.equal(v15AfterDeepKeys.size, 143);

  const flagged = cannotActCells(v15After);
  assert.deepStrictEqual(flagged, [], `cannot-act cells found in v15-after.json: ${JSON.stringify(flagged)}`);

  assert.ok(v15After.cells.every((c) => c.stuck === 0 && c.completed === c.n && c.meanKills !== null && c.meanKills >= 0.5), "every v15-after.json cell should have zero stuck runs, all runs completed, and non-null meanKills at or above the cannot-act floor");
  assert.ok(v15AfterDeep.cells.every((c) => c.stuck === 0), "the v1.5 AFTER depth-20 slice should have no stuck runs either");

  const walk = (obj, seen = new Set()) => {
    if (obj === null || typeof obj !== "object" || seen.has(obj)) return;
    seen.add(obj);
    for (const val of Object.values(obj)) {
      if (typeof val === "number") assert.ok(!Number.isNaN(val), "found NaN in a v1.5 AFTER file");
      walk(val, seen);
    }
  };
  walk(v15After);
  walk(v15AfterDeep);
});

// --- (18) v15-verdicts.json: schema, commits, editorial completeness (CONTEXT Area 2) ---

test("v15-verdicts.json: schema, commits, editorial completeness (CONTEXT Area 2)", () => {
  assert.equal(v15Verdicts.schema, "class-pass-verdicts/1");
  assert.equal(v15Verdicts.meta.after.commit, v15After.meta.commit);
  assert.equal(v15Verdicts.meta.before.commit, v15Before.meta.commit);
  assert.equal(v15Verdicts.meta.parity.natural.ok, true);
  assert.equal(v15Verdicts.meta.parity.deep.ok, true);
  assert.equal(v15Verdicts.subs.length, 24);
  assert.equal(v15Verdicts.races.length, 6);
  assert.equal(v15Verdicts.cannotAct.length, 0);
  assert.equal(v15Verdicts.cells.inBand + v15Verdicts.cells.outOfBand.length, 143);

  const validBands = new Set(["fine", "too weak", "too strong", "cannot act"]);
  const allRows = [...v15Verdicts.subs, ...v15Verdicts.races];
  for (const row of allRows) {
    assert.ok(validBands.has(row.band), `row "${row.key}" has an unrecognized band "${row.band}"`);
    assert.notEqual(row.band, "cannot act", `row "${row.key}" carries a cannot-act band — cannotAct.length is asserted zero above`);
    if (row.band !== "fine") {
      // CONTEXT Area 2: every out-of-band row must carry a verdict AND a
      // non-empty reason — the accept/tune editorial-completeness rule.
      assert.ok(["accept", "revisit"].includes(row.verdict), `out-of-band row "${row.key}" must have verdict accept or revisit`);
      assert.ok(row.reason && row.reason.length > 20, `out-of-band row "${row.key}" must have a substantive (>20 char) reason`);
    }
    if (row.verdict === "revisit") {
      assert.ok(row.lever && row.lever.length > 0, `revisit row "${row.key}" must have a non-empty lever`);
    }
    if (row.band === "fine") {
      assert.notEqual(row.verdict, "revisit", `in-band row "${row.key}" must not be marked revisit`);
    }
  }

  for (const group of [v15Verdicts.deep.byClass, v15Verdicts.deep.bySub, v15Verdicts.deep.byRace]) {
    for (const row of group) {
      assert.ok(!("band" in row), `deep row "${row.key}" must never carry a band`);
      assert.ok(!("verdict" in row), `deep row "${row.key}" must never carry a verdict`);
    }
  }
});

// --- (19) v1.5 AFTER section is byte-identical to a fresh render ---

test("v1.5 AFTER section is byte-identical to a fresh render", () => {
  const rerendered = buildVerdicts({ before: v15Before, after: v15After, beforeDeep: v15BeforeDeep, afterDeep: v15AfterDeep, prior: v15Verdicts });
  const rendered = renderMarkdown(rerendered, "after").trim();
  assert.ok(doc.includes(rendered), "the v1.5 AFTER section rendered fresh from the script is not a byte-identical substring of the ledger");
  assert.equal(JSON.stringify(rerendered), JSON.stringify(v15Verdicts), "docs/class-pass/v15-verdicts.json is not a fixed point of the script's own render");
});

// --- (20) v1.5 AFTER pretune note, only if a pretune pair exists ---

test("v1.5 AFTER pretune note is present only when a pretune JSON pair exists", () => {
  const pretunePath = path.join(REPO_ROOT, "docs", "class-pass", "v15-after-pretune.json");
  const v15AfterSection = section(doc, /^## v1\.5 AFTER — commit/);
  if (fs.existsSync(pretunePath)) {
    const pretune = JSON.parse(fs.readFileSync(pretunePath, "utf8"));
    assert.notEqual(pretune.meta.commit, v15After.meta.commit, "a pretune pair's commit must differ from the final AFTER pair's commit");
    assert.ok(v15AfterSection.includes("v15-after-pretune"), "the ledger must mention v15-after-pretune when a pretune pair exists on disk");
  } else {
    // No one-knob tune ran this plan — every out-of-band row was accepted
    // with reason on the first (and only) AFTER matrix run. The section
    // must not claim a pretune pair exists when none is on disk, and must
    // mention "pretune" (in whatever wrapping) to say so explicitly.
    assert.ok(!v15AfterSection.includes("v15-after-pretune"), "the ledger must not mention v15-after-pretune when no pretune pair exists on disk");
    assert.ok(/pretune/i.test(v15AfterSection), 'with no pretune pair on disk, the ledger should still mention "pretune" to say explicitly that none ran');
  }
});
