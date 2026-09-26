// test/difficulty/fit-difficulty-cli.test.js
//
// Phase 80 (TOOL-01) — the real-CLI proof the library-level test in
// test/unit/fit-resume.test.js cannot give: this file spawns the actual
// tools/fit-difficulty.mjs CLI (argument parsing, worker threads, the real
// engine, real file I/O) with a tiny, fast configuration on the default
// SURVIVAL objective, and proves a fit resumed across two blocks from its
// JSONL log retraces the live walk exactly — including through a forced
// +Infinity (rejected/infeasible) candidate — and that its per-block stdout
// transcript is appended, never truncated.
//
// WHY THE --force-infeasible SEAM EXISTS: classConstraints (tools/lib/
// fit-score.mjs) treats any class pool with fewer than CLASS_POOL_MIN_N (20)
// runs as unconstrained, so no search cheap enough to run inside `npm test`
// can ever produce a REAL infeasible (rejected) candidate — with --seeds=2
// every class pool is far below 20. --force-infeasible is a test-only seam
// (refused outside --search) that marks a specific candidate number
// rejected, using the exact same rejection shape a real class-fairness
// rejection would produce, so this test can exercise the real Infinity ->
// null (on disk) -> Infinity (rehydrated) round trip end to end.
//
// Lives in test/difficulty/ (run by `npm test`, NOT `npm run test:quick`)
// because it spawns the real engine for about a dozen tiny evaluations —
// per the user's 2026-09-26 ruling, no bot balance run happens mid-
// milestone; this is a correctness proof at the smallest possible scale,
// never a balance/tuning readout.

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import url from "node:url";

import { DIALS } from "../../engine/difficulty.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const CLI = path.join(REPO_ROOT, "tools", "fit-difficulty.mjs");

// --search walks SEARCH_PLAN's coordinates directly on the raw --start
// object (tools/lib/fit-score.mjs#applyStep indexes into it by path) — every
// real fit run supplies a full dial snapshot via --start=fit/start.json (see
// this CLI's own header "Run:" examples), never the bare `{}` identity
// --search itself defaults to. A real DIALS snapshot (read-only import —
// this file never modifies engine/difficulty.js) covers every SEARCH_PLAN
// coordinate path this test's tiny search will walk.
const START_DIALS_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "fit-difficulty-cli-start-")), "start.json");
fs.writeFileSync(START_DIALS_PATH, JSON.stringify(DIALS));

/** run(args) — spawns the real CLI as a subprocess; { status, stdout, stderr }. */
function run(args) {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    timeout: 240000,
  });
  return { status: result.status, stdout: result.stdout || "", stderr: result.stderr || "" };
}

function readJsonlRaw(logPath) {
  if (!fs.existsSync(logPath)) return [];
  return fs
    .readFileSync(logPath, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function rowsByN(entries) {
  const map = new Map();
  for (const entry of entries) {
    if (typeof entry.n === "number") map.set(entry.n, entry);
  }
  return map;
}

function bestLines(stdout) {
  return stdout.split("\n").filter((line) => line.startsWith("BEST"));
}

function headerLines(text) {
  return text.split("\n").filter((line) => line.startsWith("== fit-difficulty block"));
}

function rowLines(text) {
  return text.split("\n").filter((line) => /^#\d+ /.test(line));
}

// Shared flags for every test in this file: a tiny, fast survival evaluation
// (default objective) with the test-only infeasibility seam forcing the
// SECOND candidate ever evaluated (n=2) rejected. All logs/transcripts live
// in a fresh os.tmpdir() directory — nothing is written inside the repo, and
// no test in this file passes --out.
const SHARED_FLAGS = ["--search", `--start=${START_DIALS_PATH}`, "--seeds=2", "--workers=1", "--max-actions=300", "--force-infeasible=2"];

test(
  "a fit resumed across two blocks (with a forced-infeasible n=2) retraces the live walk exactly, and per-block stdout is appended not truncated",
  { timeout: 300000 },
  () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fit-difficulty-cli-"));
    const liveLog = path.join(tmpDir, "live.jsonl");
    const liveTranscript = path.join(tmpDir, "live-transcript.txt");
    const resumedLog = path.join(tmpDir, "resumed.jsonl");
    const resumedTranscript = path.join(tmpDir, "resumed-transcript.txt");

    // The live run: one shot straight to budget 6.
    const live = run([...SHARED_FLAGS, "--budget=6", `--log=${liveLog}`, `--transcript=${liveTranscript}`]);
    assert.equal(live.status, 0, `live run failed: ${live.stderr}`);

    // Block 1: budget 3 — snapshot the transcript right after this block.
    const block1 = run([...SHARED_FLAGS, "--budget=3", `--log=${resumedLog}`, `--transcript=${resumedTranscript}`]);
    assert.equal(block1.status, 0, `block 1 failed: ${block1.stderr}`);
    const block1TranscriptSnapshot = fs.readFileSync(resumedTranscript, "utf8");

    // Block 2: budget 6, against the SAME --log and --transcript (the real resume path).
    const block2 = run([...SHARED_FLAGS, "--budget=6", `--log=${resumedLog}`, `--transcript=${resumedTranscript}`]);
    assert.equal(block2.status, 0, `block 2 failed: ${block2.stderr}`);

    // --- both logs hold rows n=1..6 exactly once each, agreeing row for row ---
    const liveEntries = readJsonlRaw(liveLog);
    const resumedEntries = readJsonlRaw(resumedLog);
    const liveRows = rowsByN(liveEntries);
    const resumedRows = rowsByN(resumedEntries);

    assert.deepEqual([...liveRows.keys()].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6], "the live log must hold rows n=1..6 exactly once each");
    assert.deepEqual([...resumedRows.keys()].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6], "the resumed log must hold rows n=1..6 exactly once each");

    for (let n = 1; n <= 6; n++) {
      const liveRow = liveRows.get(n);
      const resumedRow = resumedRows.get(n);
      assert.deepEqual(resumedRow.dials, liveRow.dials, `n=${n} dials must match between the live and resumed logs`);
      assert.equal(resumedRow.score, liveRow.score, `n=${n} score must match between the live and resumed logs`);
      assert.equal(resumedRow.verdict, liveRow.verdict, `n=${n} verdict must match between the live and resumed logs`);
      assert.equal(resumedRow.constraints.ok, liveRow.constraints.ok, `n=${n} constraints.ok must match between the live and resumed logs`);
      assert.deepEqual(resumedRow.floors, liveRow.floors, `n=${n} floors must match between the live and resumed logs`);
    }

    // --- row 2 is the forced-infeasible candidate in both logs ---
    assert.equal(liveRows.get(2).score, null, "sanity: the live n=2 row's +Infinity score must serialize as null on disk");
    assert.equal(resumedRows.get(2).score, null, "sanity: the resumed n=2 row's +Infinity score must serialize as null on disk");
    assert.equal(liveRows.get(2).constraints.ok, false, "the live n=2 row must be rejected");
    assert.equal(resumedRows.get(2).constraints.ok, false, "the resumed n=2 row must be rejected");
    assert.match(liveRows.get(2).reason || "", /force-infeasible/i, "the live n=2 row's reason must name the seam");
    assert.match(resumedRows.get(2).reason || "", /force-infeasible/i, "the resumed n=2 row's reason must name the seam");

    // --- exactly one resumed marker, fromN 3, sitting between rows 3 and 4 ---
    const markers = resumedEntries.filter((entry) => entry.resumed === true);
    assert.equal(markers.length, 1, "the resumed log must hold exactly one {resumed:true} marker");
    assert.equal(markers[0].fromN, 3, "the marker's fromN must be 3 (block 1's last logged row)");
    const row3Idx = resumedEntries.findIndex((entry) => entry.n === 3);
    const markerIdx = resumedEntries.findIndex((entry) => entry.resumed === true);
    const row4Idx = resumedEntries.findIndex((entry) => entry.n === 4);
    assert.ok(row3Idx >= 0 && markerIdx > row3Idx && row4Idx > markerIdx, "the resumed marker must sit between the row-3 and row-4 log lines");

    // --- stdout: the live run prints the forced-infeasible line; the final BEST line matches across live vs. resumed ---
    assert.match(live.stdout, /#2 score=\+Infinity/, "the live stdout must print the forced-infeasible n=2 row");
    const liveBest = bestLines(live.stdout).pop();
    const block2Best = bestLines(block2.stdout).pop();
    assert.ok(liveBest, "the live run must print at least one BEST line");
    assert.equal(block2Best, liveBest, "block 2's final BEST line must equal the live run's final BEST line");

    // --- block 2 never re-prints rows 1-3 (reused from the log, never re-evaluated) ---
    for (const n of [1, 2, 3]) {
      assert.ok(!new RegExp(`^#${n} `, "m").test(block2.stdout), `block 2's stdout must not print a #${n} row line`);
    }

    // --- transcripts: append-only by construction across the two blocks ---
    const resumedTranscriptAfterBlock2 = fs.readFileSync(resumedTranscript, "utf8");
    assert.ok(
      resumedTranscriptAfterBlock2.startsWith(block1TranscriptSnapshot),
      "after block 2 the resumed transcript must start with block 1's exact content"
    );
    assert.ok(resumedTranscriptAfterBlock2.length > block1TranscriptSnapshot.length, "the resumed transcript must be strictly longer after block 2");
    assert.equal(headerLines(resumedTranscriptAfterBlock2).length, 2, "the resumed transcript must hold exactly two block header lines");
    assert.deepEqual(
      rowLines(resumedTranscriptAfterBlock2),
      rowLines(fs.readFileSync(liveTranscript, "utf8")),
      "the resumed transcript's #n row lines, in order, must equal the live transcript's #n row lines"
    );
  }
);

test("--search without --force-infeasible has no seam reason and a finite score at n=2 (exit 0)", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fit-difficulty-cli-"));
  const log = path.join(tmpDir, "seam-off.jsonl");
  const result = run(["--search", `--start=${START_DIALS_PATH}`, "--seeds=2", "--workers=1", "--max-actions=300", "--budget=2", `--log=${log}`]);
  assert.equal(result.status, 0, `run without --force-infeasible failed: ${result.stderr}`);
  const row2 = rowsByN(readJsonlRaw(log)).get(2);
  assert.ok(row2, "n=2 must be logged");
  assert.equal(typeof row2.score, "number", "without the seam, n=2's score must be a real number, not null/Infinity");
  assert.ok(Number.isFinite(row2.score), "without the seam, n=2's score must be finite");
  assert.ok(!("reason" in row2) || !/force-infeasible/i.test(row2.reason), "without the seam, no row carries a force-infeasible reason");
});

test("--force-infeasible without --search exits 2", () => {
  const result = run(["--force-infeasible=2", "--seeds=2", "--workers=1", "--max-actions=300"]);
  assert.equal(result.status, 2, "--force-infeasible must be refused (exit 2) outside --search");
});
