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
const doc = fs.readFileSync(DOC_PATH, "utf8");

const before = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "docs", "class-pass", "before.json"), "utf8"));
const beforeDeep = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "docs", "class-pass", "before-depth20.json"), "utf8"));
const after = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "docs", "class-pass", "after.json"), "utf8"));
const afterDeep = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "docs", "class-pass", "after-depth20.json"), "utf8"));
const verdicts = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "docs", "class-pass", "verdicts.json"), "utf8"));

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

test("sections: exactly eight H2 headings, in the fixed order, Handoff last", () => {
  const headings = h2s(doc);
  assert.equal(headings.length, 8, `expected exactly 8 H2 headings, found ${headings.length}: ${headings.join(" | ")}`);

  const expected = [
    /^## Bot proxy/,
    /^## How to reproduce$/,
    /^## BEFORE — commit [0-9a-f]{40} /,
    /^## Outliers \/ Findings \(Phase 22\)$/,
    /^## Rulings \(Phase 24 — PLAY-03\)$/,
    /^## AFTER — commit [0-9a-f]{40} \(Phase 26 — PLAY-02\)$/,
    /^## Outliers \(Phase 26 — revisit list\)$/,
    /^## Handoff to Phase 27$/,
  ];
  expected.forEach((re, i) => {
    assert.ok(re.test(headings[i]), `heading ${i} ("${headings[i]}") should match ${re}`);
  });
  assert.equal(headings[headings.length - 1], "## Handoff to Phase 27");
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
  assert.equal(allHeadings[allHeadings.length - 1], "## Handoff to Phase 27", "Handoff to Phase 27 must be the last H2 section in the ledger");
});
