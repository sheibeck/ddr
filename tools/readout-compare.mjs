#!/usr/bin/env node
// tools/readout-compare.mjs
//
// Phase 73 (ROLL-05, Plan 02): two comparison modes over tune-difficulty
// readout text. Dev-only, zero-dependency Node ESM script — NOT shipped,
// NOT a node:test file.
//
// Modes:
//   node tools/readout-compare.mjs --recorded <doc> "<heading prefix>" <file>
//     Extracts the first fenced code block that follows a Markdown heading
//     line starting with `<heading prefix>` in `<doc>`, normalises CRLF,
//     drops blank lines, and checks that every remaining line appears in
//     `<file>`, IN ORDER (a subsequence, not necessarily contiguous). Some
//     recorded blocks are trimmed for length (info-only rows, the Pace
//     table) — the trim note means lines are absent from the RECORDED
//     block, never the reverse, so a subsequence check (not exact equality)
//     is the correct comparison. Prints the first missing line and exits 1
//     on failure; exits 0 on success.
//
//   node tools/readout-compare.mjs --exact <fileA> <fileB>
//     Equal after CRLF normalisation (line-for-line, in order, same count).
//     Prints the first differing line and exits 1 on failure; exits 0 on
//     success.

import fs from "node:fs";

function normalizeLines(text) {
  return text.replace(/\r\n/g, "\n").split("\n");
}

/**
 * extractFencedBlock(docText, headingPrefix) — finds the first Markdown
 * heading line (a line starting with one or more `#` characters followed by
 * a space) whose text (after the `#`s and the space) starts with
 * `headingPrefix`, then returns the contents of the FIRST fenced code block
 * (```...```) found after that heading line. Throws if either the heading
 * or a following fenced block cannot be found.
 */
function extractFencedBlock(docText, headingPrefix) {
  const lines = normalizeLines(docText);
  let headingIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    // Matched against the FULL raw line (including its leading `#`s) — a
    // caller's heading prefix is expected to include the `#` markup, e.g.
    // "### AFTER — commit d2adfd6", exactly as it reads in the .md source.
    if (/^#{1,6}\s+/.test(lines[i]) && lines[i].startsWith(headingPrefix)) {
      headingIdx = i;
      break;
    }
  }
  if (headingIdx === -1) {
    throw new Error(`extractFencedBlock: no heading found starting with ${JSON.stringify(headingPrefix)}`);
  }
  let fenceStart = -1;
  for (let i = headingIdx + 1; i < lines.length; i++) {
    if (lines[i].trim().startsWith("```")) {
      fenceStart = i;
      break;
    }
  }
  if (fenceStart === -1) {
    throw new Error(`extractFencedBlock: no fenced block found after heading ${JSON.stringify(headingPrefix)}`);
  }
  let fenceEnd = -1;
  for (let i = fenceStart + 1; i < lines.length; i++) {
    if (lines[i].trim().startsWith("```")) {
      fenceEnd = i;
      break;
    }
  }
  if (fenceEnd === -1) {
    throw new Error(`extractFencedBlock: unterminated fenced block after heading ${JSON.stringify(headingPrefix)}`);
  }
  return lines.slice(fenceStart + 1, fenceEnd);
}

/**
 * isSubsequence(needleLines, haystackLines) — every non-blank line in
 * `needleLines`, IN ORDER, appears somewhere (not necessarily contiguous)
 * in `haystackLines`. Returns `{ ok, firstMissing }`.
 */
export function isSubsequence(needleLines, haystackLines) {
  const needle = needleLines.filter((l) => l.trim() !== "");
  let hIdx = 0;
  for (const nLine of needle) {
    let found = false;
    while (hIdx < haystackLines.length) {
      if (haystackLines[hIdx] === nLine) {
        found = true;
        hIdx++;
        break;
      }
      hIdx++;
    }
    if (!found) return { ok: false, firstMissing: nLine };
  }
  return { ok: true, firstMissing: null };
}

function runRecorded(docPath, headingPrefix, filePath) {
  const docText = fs.readFileSync(docPath, "utf8");
  const fileText = fs.readFileSync(filePath, "utf8");
  const recordedLines = extractFencedBlock(docText, headingPrefix);
  const fileLines = normalizeLines(fileText);
  const { ok, firstMissing } = isSubsequence(recordedLines, fileLines);
  if (!ok) {
    console.error(`readout-compare --recorded: FAIL — the recorded block's line was not found (in order) in ${filePath}:`);
    console.error(`  missing: ${JSON.stringify(firstMissing)}`);
    process.exit(1);
  }
  console.log(`readout-compare --recorded: OK — every recorded line under ${JSON.stringify(headingPrefix)} appears, in order, in ${filePath}`);
  process.exit(0);
}

function runExact(fileAPath, fileBPath) {
  const a = normalizeLines(fs.readFileSync(fileAPath, "utf8"));
  const b = normalizeLines(fs.readFileSync(fileBPath, "utf8"));
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) {
      console.error(`readout-compare --exact: FAIL — first difference at line ${i + 1}:`);
      console.error(`  ${fileAPath}: ${JSON.stringify(a[i])}`);
      console.error(`  ${fileBPath}: ${JSON.stringify(b[i])}`);
      process.exit(1);
    }
  }
  console.log(`readout-compare --exact: OK — ${fileAPath} and ${fileBPath} are line-for-line identical (CRLF-normalised)`);
  process.exit(0);
}

function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--recorded" && args.length === 4) {
    return runRecorded(args[1], args[2], args[3]);
  }
  if (args[0] === "--exact" && args.length === 3) {
    return runExact(args[1], args[2]);
  }
  console.error('Usage: node tools/readout-compare.mjs --recorded <doc> "<heading prefix>" <file>');
  console.error("       node tools/readout-compare.mjs --exact <fileA> <fileB>");
  process.exit(1);
}

main();
