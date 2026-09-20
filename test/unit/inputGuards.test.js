// test/unit/inputGuards.test.js
//
// Phase 32 Plan 01 (CMBUI-04/05) — pins the pure tap-safety timing guards
// module (src/browser/inputGuards.js) that a decision button's tap-safety
// (32-03) and window.move's dismiss-settle check will run on. This
// file proves the module BEFORE any button is wired against it:
//   1. the two constants (ARM_DELAY_MS / DISMISS_SETTLE_MS = 250)
//   2. isArmed/isSettled boundary-exact behavior (armed/settled AT the
//      threshold, not one ms under)
//   3. fail-open on a missing/non-finite stamp (undefined/NaN -> treated as
//      stamp 0, so a fresh page or a never-rendered button is never locked)
//   4. purity: the module never reads a clock itself, touches the DOM, or
//      even mentions a transition/animation event name (the blanket
//      prefers-reduced-motion rule at mazeworld.html ~L773 zeroes every CSS
//      transition/animation, so these guards MUST be plain millisecond
//      comparisons, never CSS)
//   5. the mazeworld.html bridge line (Task 2, appended below)
//
// Mirrors test/unit/controls.test.js's "exports pure constants" shape and
// test/unit/narrationLinesCoverage.test.js's purity-scan style (comment-
// stripped source, forbidden-pattern list) without adding this module to
// that file's own PURE_MODULE_FILES list (this file is the standing guard
// for inputGuards.js specifically).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { ARM_DELAY_MS, DISMISS_SETTLE_MS, isArmed, isSettled } from "../../src/browser/inputGuards.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

// ─── comment stripping (same order-sensitive approach as
// shell-loot-screen.test.js/shell-narration-wiring.test.js — line comments
// are stripped BEFORE block comments) ─────────────────────────────────────
function stripComments(source) {
  const noLineComments = source
    .split("\n")
    .map((line) => {
      const i = line.indexOf("//");
      return i === -1 ? line : line.slice(0, i);
    })
    .join("\n");
  return noLineComments.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""));
}

// ─── 1. constants ────────────────────────────────────────────────────────

test("inputGuards.js: exports the two pure timing constants", () => {
  assert.equal(ARM_DELAY_MS, 250);
  assert.equal(DISMISS_SETTLE_MS, 250);
  assert.equal(typeof ARM_DELAY_MS, "number");
  assert.equal(typeof DISMISS_SETTLE_MS, "number");
});

// ─── 2. isArmed boundary behavior ───────────────────────────────────────

test("isArmed: false one ms under the arm delay, true exactly at and past it", () => {
  assert.equal(isArmed(1000, 1249), false);
  assert.equal(isArmed(1000, 1250), true);
  assert.equal(isArmed(1000, 5000), true);
});

test("isArmed: a stamp of 0 at time 0 is inside the window (not armed)", () => {
  assert.equal(isArmed(0, 0), false);
});

// ─── 3. isSettled boundary behavior ─────────────────────────────────────

test("isSettled: false one ms under the settle window, true exactly at and past it", () => {
  assert.equal(isSettled(1000, 1249), false);
  assert.equal(isSettled(1000, 1250), true);
});

test("isSettled: the same boundary holds when lastDismissAt is 0", () => {
  assert.equal(isSettled(0, 249), false);
  assert.equal(isSettled(0, 250), true);
});

// ─── 4. fail-open on non-finite / missing stamps ────────────────────────

test("isArmed/isSettled: a missing or non-finite first argument coerces to stamp 0 (fail-open)", () => {
  assert.equal(isArmed(undefined, 100), true);
  assert.equal(isArmed(NaN, 100), true);
  assert.equal(isSettled(undefined, 100), true);
  assert.equal(isSettled(NaN, 100), true);
});

// ─── 5. purity tripwire ─────────────────────────────────────────────────
//
// Forbidden patterns include the global clock-read call. Build that pattern
// from fragments (mirroring shell-narration-wiring.test.js's OLD_SWITCH_NAME
// trick) so this test file itself never carries the literal string, which
// would otherwise defeat the purpose of scanning the module for it.
const CLOCK_READ = ["Date", ".", "now"].join("");

const IMPURITY_PATTERNS = [
  /Math\.random/,
  new RegExp(CLOCK_READ.replace(".", "\\.")),
  /\bdocument\./,
  /\bwindow\./,
  /\bglobalThis\./,
  /\blocalStorage\b/,
  /\bsetTimeout\b/,
  /\brequestAnimationFrame\b/,
  /from\s+["'][^"']*engine\//,
  /transition/i,
  /animation/i,
];

test("inputGuards.js is pure: no clock read, no DOM, no transition/animation reference, no engine import", () => {
  const full = path.join(REPO_ROOT, "src", "browser", "inputGuards.js");
  const stripped = stripComments(fs.readFileSync(full, "utf8"));
  const lines = stripped.split("\n");
  const offenses = [];
  lines.forEach((line, i) => {
    for (const pattern of IMPURITY_PATTERNS) {
      if (pattern.test(line)) {
        offenses.push(`${i + 1}: ${line.trim()} (matched ${pattern})`);
        break;
      }
    }
  });
  assert.deepStrictEqual(offenses, [], `Found impurity in inputGuards.js:\n${offenses.join("\n")}`);
});

test("inputGuards.js has no import statements at all (mirrors controls.js)", () => {
  const full = path.join(REPO_ROOT, "src", "browser", "inputGuards.js");
  const stripped = stripComments(fs.readFileSync(full, "utf8"));
  assert.equal(/^import /m.test(stripped), false);
});

// ─── 6. mazeworld.html bridge pin ────────────────────────────────────────

test("mazeworld.html: imports inputGuards.js and bridges it onto window.__mzInputGuards", () => {
  const RAW_HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
  const HTML = RAW_HTML.replace(/\r\n/g, "\n");
  const CODE = stripComments(HTML);

  const importLine = 'import { ARM_DELAY_MS, DISMISS_SETTLE_MS, isArmed, isSettled } from "./src/browser/inputGuards.js";';
  const bridgeLine = "window.__mzInputGuards = { ARM_DELAY_MS, DISMISS_SETTLE_MS, isArmed, isSettled };";

  const importMatches = CODE.split(importLine).length - 1;
  const bridgeMatches = CODE.split(bridgeLine).length - 1;
  assert.equal(importMatches, 1, "expected exactly one inputGuards.js import line");
  assert.equal(bridgeMatches, 1, "expected exactly one window.__mzInputGuards bridge line");

  const moduleScriptIdx = CODE.indexOf('<script type="module">');
  const bridgeIdx = CODE.indexOf(bridgeLine);
  assert.ok(moduleScriptIdx !== -1, "expected to find the module script tag");
  assert.ok(bridgeIdx > moduleScriptIdx, "the bridge assignment must sit inside the module script");
});
