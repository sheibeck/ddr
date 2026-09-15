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
//
// 27-03: the AFTER section embeds VERBATIM tool transcripts (tune-classes,
// class-pass-diff --section after) inside fenced code blocks — some of that
// tool output itself contains lines starting with "### " (the class-pass-diff
// renderer's own "### By class" etc. sub-headings). Those are NOT real
// document headings (a markdown renderer never treats fenced content as
// headings); `stripFences()` below removes fenced-block content BEFORE any
// heading-counting test walks the text, so this file's own regex-based
// heading scan agrees with what a renderer would show.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { metaParity, cannotActCells } from "../../tools/class-pass-diff.mjs";

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

/**
 * stripFences(text) -> text with every fenced code block's BODY (the lines
 * strictly between a pair of ``` fence lines) blanked out, fence lines
 * themselves kept so line numbers/structure stay stable. Verbatim tool
 * transcripts pasted into the ledger can legitimately contain lines that
 * start with "### " (e.g. class-pass-diff's own sub-headings) — those must
 * never be mistaken for real document headings by this file's heading scans.
 */
function stripFences(text) {
  const lines = text.split("\n");
  let inFence = false;
  return lines
    .map((line) => {
      if (/^```/.test(line)) {
        inFence = !inFence;
        return line;
      }
      return inFence ? "" : line;
    })
    .join("\n");
}

const v1_2 = section(doc, /^## v1\.2 retune \(Phase 27\)/);
const v1_2NoFences = stripFences(v1_2);

/**
 * subsection(text, headingRegex) -> the text from the first line matching
 * headingRegex through (but not including) the next `## ` OR `### ` heading,
 * or EOF. Stricter than section() (which only stops at `## `) — used where a
 * test needs ONE H3 sub-section's own content, not everything through the
 * end of the enclosing H2.
 */
function subsection(text, headingRegex) {
  const lines = text.split("\n");
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (headingRegex.test(lines[i])) {
      start = i;
      break;
    }
  }
  if (start === -1) throw new Error(`subsection: no heading matches ${headingRegex}`);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^#{2,3} /.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

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

  const h3Lines = [...v1_2NoFences.matchAll(/^### .+$/gm)].map((m) => m[0]);
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

// --- 27-03: retune AFTER provenance (7)-(13) -------------------------------
//
// These checks re-derive their expectation through tools/class-pass-diff.mjs's
// own exported helpers (metaParity, cannotActCells) rather than hand-deriving
// a second copy of the rules — same discipline as
// test/unit/class-pass-ledger.test.js. None of them assert a balance number
// (no mean depth, no landed constant value) — only existence, parity and
// zero-cannot-act, matching this file's own "sanity floor, not a tuning
// gate" charter stated at the top of this file.

const CLASS_PASS_DIR = path.join(REPO_ROOT, "docs", "class-pass");
const retuneAfter = JSON.parse(fs.readFileSync(path.join(CLASS_PASS_DIR, "retune-after.json"), "utf8"));
const retuneAfterDeep = JSON.parse(fs.readFileSync(path.join(CLASS_PASS_DIR, "retune-after-depth20.json"), "utf8"));
const phase26After = JSON.parse(fs.readFileSync(path.join(CLASS_PASS_DIR, "after.json"), "utf8"));
const phase26AfterDeep = JSON.parse(fs.readFileSync(path.join(CLASS_PASS_DIR, "after-depth20.json"), "utf8"));

test("(7) retune AFTER JSONs exist and carry Phase 26's Bot lines byte-for-byte (metaParity modulo commit, natural and depth-20 pairs)", () => {
  assert.ok(fs.existsSync(path.join(CLASS_PASS_DIR, "retune-after.json")), "docs/class-pass/retune-after.json must exist");
  assert.ok(fs.existsSync(path.join(CLASS_PASS_DIR, "retune-after-depth20.json")), "docs/class-pass/retune-after-depth20.json must exist");
  const natParity = metaParity(phase26After.meta, retuneAfter.meta);
  assert.ok(natParity.ok, `natural meta parity mismatches (modulo commit): ${natParity.mismatches.join(", ")}`);
  const deepParity = metaParity(phase26AfterDeep.meta, retuneAfterDeep.meta);
  assert.ok(deepParity.ok, `depth-20 meta parity mismatches (modulo commit): ${deepParity.mismatches.join(", ")}`);
  assert.equal(retuneAfter.meta.bot, phase26After.meta.bot, "natural Bot line must be byte-identical to Phase 26's");
  assert.equal(retuneAfterDeep.meta.bot, phase26AfterDeep.meta.bot, "depth-20 Bot line must be byte-identical to Phase 26's");
});

test("(8) retune AFTER meta.commit (both files) equals the pin named in the AFTER heading", () => {
  const m = v1_2.match(/### AFTER readouts — retuned engine — commit ([0-9a-f]{7,})/);
  assert.ok(m, "v1.2 section is missing the pinned AFTER heading");
  const pin7 = m[1].slice(0, retuneAfter.meta.commit.length);
  assert.equal(retuneAfter.meta.commit, pin7, "retune-after.json meta.commit must equal the AFTER heading's pin");
  assert.equal(retuneAfterDeep.meta.commit, pin7, "retune-after-depth20.json meta.commit must equal the AFTER heading's pin");
});

test("(9) ZERO cannot-act cells in retune-after.json (hard)", () => {
  const cells = cannotActCells(retuneAfter);
  assert.deepEqual(cells, [], `retune-after.json must have zero cannot-act cells, found: ${JSON.stringify(cells)}`);
});

test("(10) Phase 26 artifacts untouched: after.json / after-depth20.json meta.commit are d1e3235 and their cell key sets equal the retune files' (143)", () => {
  assert.equal(phase26After.meta.commit, "d1e3235", "docs/class-pass/after.json meta.commit must stay d1e3235");
  assert.equal(phase26AfterDeep.meta.commit, "d1e3235", "docs/class-pass/after-depth20.json meta.commit must stay d1e3235");
  const keySet = (report) => new Set(report.cells.map((c) => `${c.cls}|${c.sub}|${c.race}`));
  assert.deepEqual(keySet(phase26After), keySet(retuneAfter), "natural cell key sets must match between Phase 26 and the retune");
  assert.deepEqual(keySet(phase26AfterDeep), keySet(retuneAfterDeep), "depth-20 cell key sets must match between Phase 26 and the retune");
  assert.equal(phase26After.cells.length, 143);
  assert.equal(retuneAfter.cells.length, 143);
});

test("(11) no 27-02 / 27-03 placeholder line remains in the v1.2 section", () => {
  assert.doesNotMatch(v1_2, /\(filled by plan 27-0[23]\)/, "a 27-02/27-03 placeholder line still remains in the v1.2 section");
});

test("(12) the Comparison vs band table has one row per JSON path named in the Target band table", () => {
  const comparison = subsection(v1_2NoFences, /^### Comparison vs band/);
  const bandTable = subsection(v1_2NoFences, /^### Target band \(TUNE-05\)/);
  const paths = ["rollups.pooled.p50Depth", "rollups.pooled.reach20", "rollups.pooled.meanEncountersSurvived", "rollups.pooled.p50FloorsGained", "rollups.pooled.meanFloorsGained"];
  for (const p of paths) {
    assert.ok(bandTable.includes(p), `Target band table is missing JSON path ${p} (sanity check on the fixture, not the fix)`);
    assert.ok(comparison.includes(p), `Comparison vs band section is missing a row for JSON path ${p}`);
  }
});

test("(13) every early-floor constant appears in the change table", () => {
  const changeTable = subsection(v1_2NoFences, /^### Change table \(27-02 \/ 27-03\)/);
  for (const name of ["FOE_GRACE_AT_2", "HAZARD_FROM_DEPTH", "STARTING_RATIONS_BONUS", "FOE_GRACE_AT_1"]) {
    assert.ok(changeTable.includes(name), `Change table is missing early-floor constant ${name}`);
  }
});
