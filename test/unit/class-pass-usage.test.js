// test/unit/class-pass-usage.test.js
//
// Phase 42 (BAL-02, 42-03-PLAN.md) — CLI byte-stability and error-handling
// pins for tools/class-pass-usage.mjs, mirroring test/unit/class-pass-diff.
// test.js's own CLI-testing structure (execFileSync, a tmp dir for any
// scratch output, a purity scan). Never asserts a real pick-rate number as a
// balance target — docs/class-pass/v15-before.json (a report with NO `usage`
// field at all, predating this plan) is used to prove the renderer degrades
// to an honest all-zero table rather than throwing.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { execFileSync, spawnSync } from "node:child_process";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const SCRIPT = path.join(REPO_ROOT, "tools", "class-pass-usage.mjs");
const BEFORE_PATH = path.join(REPO_ROOT, "docs", "class-pass", "v15-before.json");
const BEFORE_DEEP_PATH = path.join(REPO_ROOT, "docs", "class-pass", "v15-before-depth20.json");

// --- (1) headings -------------------------------------------------------

test("CLI: prints exactly the three 'Pick-rates —' headings for --after alone, plus the fourth 'Top picks' heading", () => {
  const stdout = execFileSync(process.execPath, [SCRIPT, "--after", BEFORE_PATH], { cwd: REPO_ROOT, encoding: "utf8" });
  const pickRateHeadings = [...stdout.matchAll(/^### Pick-rates — .+$/gm)].map((m) => m[0]);
  assert.deepStrictEqual(pickRateHeadings, ["### Pick-rates — abilities", "### Pick-rates — spells", "### Pick-rates — items"]);
  assert.ok(stdout.includes("### Top picks by sub-class"));
});

// --- (2) a report with no `usage` field renders zero tables, never throws --

test("CLI: a report with NO usage field (the v1.5 BEFORE pin) renders every rate as 0.00, never NaN, without throwing", () => {
  const stdout = execFileSync(process.execPath, [SCRIPT, "--after", BEFORE_PATH], { cwd: REPO_ROOT, encoding: "utf8" });
  assert.ok(!stdout.includes("NaN"));
  assert.ok(stdout.includes("| Kata | Fighter | 0 | 0 |"));
  assert.ok(stdout.includes("0.00"));
});

// --- (3) --deep appends the depth-20 slice heading -------------------------

test("CLI: --deep appends a second '## Pick-rates — depth-20 slice' block after the --after block", () => {
  const stdout = execFileSync(process.execPath, [SCRIPT, "--after", BEFORE_PATH, "--deep", BEFORE_DEEP_PATH], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  const afterIdx = stdout.indexOf("### Pick-rates — abilities");
  const deepHeadingIdx = stdout.indexOf("## Pick-rates — depth-20 slice");
  assert.ok(afterIdx !== -1 && deepHeadingIdx !== -1 && deepHeadingIdx > afterIdx);
  // the depth-20 block carries its own full set of three Pick-rates headings too.
  const pickRateHeadings = [...stdout.matchAll(/^### Pick-rates — .+$/gm)].map((m) => m[0]);
  assert.equal(pickRateHeadings.length, 6);
});

// --- (4) CLI determinism ----------------------------------------------------

test("CLI determinism: two runs on the same input are byte-identical stdout", () => {
  const stdout1 = execFileSync(process.execPath, [SCRIPT, "--after", BEFORE_PATH, "--deep", BEFORE_DEEP_PATH], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  const stdout2 = execFileSync(process.execPath, [SCRIPT, "--after", BEFORE_PATH, "--deep", BEFORE_DEEP_PATH], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  assert.equal(stdout1, stdout2);
});

// --- (5) error handling ------------------------------------------------------

test("CLI: a missing --after path exits 2 with a message naming the file; a missing --after flag exits 2 with usage", () => {
  const r1 = spawnSync(process.execPath, [SCRIPT, "--after", path.join(REPO_ROOT, "docs", "class-pass", "does-not-exist.json")], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  assert.equal(r1.status, 2);
  assert.ok(r1.stderr.includes("does-not-exist.json"));

  const r2 = spawnSync(process.execPath, [SCRIPT], { cwd: REPO_ROOT, encoding: "utf8" });
  assert.equal(r2.status, 2);
  assert.ok(r2.stderr.includes("--after is required"));

  const r3 = spawnSync(process.execPath, [SCRIPT, "--bogus", "x"], { cwd: REPO_ROOT, encoding: "utf8" });
  assert.equal(r3.status, 2);
  assert.ok(r3.stderr.includes("Unknown flag"));
});

// --- (6) purity --------------------------------------------------------

test("purity: no Math.random/Date.now/new Date on non-comment lines; imports formatUsageMarkdown from class-matrix.mjs only", () => {
  const src = fs.readFileSync(SCRIPT, "utf8");
  const codeLines = src.split("\n").filter((line) => !/^\s*(\/\/|\/?\*)/.test(line));
  assert.ok(!codeLines.some((line) => /Math\.random|Date\.now|new Date\(/.test(line)));
  assert.ok(src.includes('from "./lib/class-matrix.mjs"'));
});
