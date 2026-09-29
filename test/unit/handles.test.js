// test/unit/handles.test.js
//
// Phase 83, Plan 01 Task 2 — the rolled @handle: table shape, the
// by-construction safety proof (every combination, word-boundary scan plus
// a cross-boundary substring check), roll/re-roll and the pattern string
// the deployed rules (83-02) embed.

import test from "node:test";
import assert from "node:assert/strict";

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { HANDLE_FIRST, HANDLE_SECOND } from "../../content/handles.js";
import { HANDLE_PREFIX, HANDLE_MAX_CHARS, handlePatternSource, isValidHandle, rollHandle } from "../../src/browser/handles.js";
import { scanSafety } from "../../tools/lib/voice-checks.mjs";
import { BANNED } from "../../content/safety-wordlist.js";
import { stripJs } from "../../tools/ident-sweep.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const HANDLES_SRC = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "handles.js"), "utf8").replace(/\r\n/g, "\n");

/* ---------------- table shape ---------------- */

test("HANDLE_FIRST and HANDLE_SECOND: 24-40 unique lowercase words, 3-8 letters, no overlap", () => {
  for (const [name, table] of [["HANDLE_FIRST", HANDLE_FIRST], ["HANDLE_SECOND", HANDLE_SECOND]]) {
    assert.ok(table.length >= 24 && table.length <= 40, `${name} should have 24-40 words, has ${table.length}`);
    assert.equal(new Set(table).size, table.length, `${name} has a duplicate word`);
    for (const w of table) assert.match(w, /^[a-z]{3,8}$/, `${name} word "${w}" must match /^[a-z]{3,8}$/`);
  }
  const overlap = HANDLE_FIRST.filter((w) => HANDLE_SECOND.includes(w));
  assert.deepEqual(overlap, [], `words must not appear in both tables: ${overlap.join(", ")}`);
});

/* ---------------- by-construction safety proof ---------------- */

test("every HANDLE_FIRST x HANDLE_SECOND combination clears the safety wordlist (joined, spaced, and each single word)", () => {
  const entries = [];
  for (const first of HANDLE_FIRST) {
    entries.push({ key: `word:${first}`, texts: [first], owner: "83-01", surface: "boards" });
  }
  for (const second of HANDLE_SECOND) {
    entries.push({ key: `word:${second}`, texts: [second], owner: "83-01", surface: "boards" });
  }
  for (const first of HANDLE_FIRST) {
    for (const second of HANDLE_SECOND) {
      entries.push({
        key: `handle:${first}${second}`,
        texts: [`${first}${second}`, `${first} ${second}`],
        owner: "83-01",
        surface: "boards",
      });
    }
  }
  const corpus = { entries };
  const hits = scanSafety(corpus);
  assert.deepEqual(hits, [], `unsafe handle combination(s):\n${JSON.stringify(hits, null, 1)}`);
});

test("cross-boundary check: no banned term straddles the join between the two words, for every pair", () => {
  const bannedLetters = [...new Set(BANNED.map((t) => t.toLowerCase().replace(/[^a-z]/g, "")))].filter((t) => t.length >= 3);
  const offenders = [];
  for (const first of HANDLE_FIRST) {
    for (const second of HANDLE_SECOND) {
      const joined = first + second;
      const boundary = first.length;
      for (const term of bannedLetters) {
        let from = 0;
        let idx;
        while ((idx = joined.indexOf(term, from)) !== -1) {
          const end = idx + term.length;
          // Spans the boundary: starts strictly before it and ends strictly after it.
          if (idx < boundary && end > boundary) {
            offenders.push({ first, second, term, joined });
          }
          from = idx + 1;
        }
      }
    }
  }
  assert.deepEqual(offenders, [], `banned term(s) straddling a handle join:\n${JSON.stringify(offenders, null, 1)}`);
});

/* ---------------- roll / re-roll ---------------- */

test("rollHandle: a fixed random(0) gives the first word of each table; random(0.9999999) gives the last", () => {
  assert.equal(rollHandle(() => 0), HANDLE_PREFIX + HANDLE_FIRST[0] + HANDLE_SECOND[0]);
  assert.equal(rollHandle(() => 0.9999999), HANDLE_PREFIX + HANDLE_FIRST[HANDLE_FIRST.length - 1] + HANDLE_SECOND[HANDLE_SECOND.length - 1]);
});

test("rollHandle: re-rolling with the same random function never returns the previous handle", () => {
  const previous = HANDLE_PREFIX + HANDLE_FIRST[0] + HANDLE_SECOND[0];
  const rerolled = rollHandle(() => 0, previous);
  assert.notEqual(rerolled, previous);
  assert.equal(isValidHandle(rerolled), true);
});

test("rollHandle: 1,000 rolls with Math.random are all valid handles", () => {
  for (let i = 0; i < 1000; i++) {
    assert.equal(isValidHandle(rollHandle()), true);
  }
});

/* ---------------- isValidHandle ---------------- */

test("isValidHandle: rejects a missing @, uppercase, an out-of-table word, a trailing character, a non-string, and '@' alone", () => {
  const valid = HANDLE_PREFIX + HANDLE_FIRST[0] + HANDLE_SECOND[0];
  assert.equal(isValidHandle(valid), true);
  assert.equal(isValidHandle(valid.slice(1)), false);
  assert.equal(isValidHandle(valid.toUpperCase()), false);
  assert.equal(isValidHandle(HANDLE_PREFIX + "xyzxyzxyz" + HANDLE_SECOND[0]), false);
  assert.equal(isValidHandle(valid + "x"), false);
  assert.equal(isValidHandle(42), false);
  assert.equal(isValidHandle(null), false);
  assert.equal(isValidHandle("@"), false);
});

/* ---------------- pattern / constants ---------------- */

test("handlePatternSource: the exact anchored alternation, no whitespace", () => {
  assert.equal(handlePatternSource(), `^@(${HANDLE_FIRST.join("|")})(${HANDLE_SECOND.join("|")})$`);
  assert.doesNotMatch(handlePatternSource(), /\s/);
});

test("HANDLE_MAX_CHARS: 1 plus the longest word in each table", () => {
  const longestFirst = HANDLE_FIRST.reduce((max, w) => Math.max(max, w.length), 0);
  const longestSecond = HANDLE_SECOND.reduce((max, w) => Math.max(max, w.length), 0);
  assert.equal(HANDLE_MAX_CHARS, 1 + longestFirst + longestSecond);
});

/* ---------------- purity: never imports the engine rng ---------------- */

test("src/browser/handles.js never imports from engine/", () => {
  assert.doesNotMatch(stripJs(HANDLES_SRC), /from\s+["'][^"']*engine\//);
});
