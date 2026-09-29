// test/unit/firestore-transition-rules.test.js
//
// Phase 83 Plan 08 (Transition amendment, user ruling 2026-09-29). Proves
// firebase/firestore.transition.rules is byte-for-byte
// firebase/firestore.rules with EXACTLY the bugReports/{reportId} match
// block's `allow create` clause swapped for the legacy unauthenticated
// clause, and nothing else — the transition header comment excluded — so
// the two files can never silently drift apart while the transition rules
// stay deployed to keep the shipped 2.1.0 build's unauthenticated report
// create working.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const FINAL_PATH = path.join(REPO_ROOT, "firebase", "firestore.rules");
const TRANSITION_PATH = path.join(REPO_ROOT, "firebase", "firestore.transition.rules");
const TRANSITION_JSON_PATH = path.join(REPO_ROOT, "firebase.transition.json");

function normalize(text) {
  return text.replace(/\r\n/g, "\n");
}

/** stripTransitionHeader(text) — removes the "=== TRANSITION HEADER BEGIN/END ===" comment block, inclusive. */
function stripTransitionHeader(text) {
  const beginMarker = "// === TRANSITION HEADER BEGIN ===";
  const endMarker = "// === TRANSITION HEADER END ===";
  const beginIdx = text.indexOf(beginMarker);
  const endIdx = text.indexOf(endMarker);
  assert.ok(beginIdx >= 0, "transition file must contain the header BEGIN marker");
  assert.ok(endIdx >= 0, "transition file must contain the header END marker");
  const before = text.slice(0, beginIdx);
  const after = text.slice(endIdx + endMarker.length);
  // `before` already ends in the blank line that precedes the header
  // (mirroring the blank line between `rules_version = '2';` and the
  // original top-of-file comment in firestore.rules), so drop every
  // newline immediately following the END marker rather than just one.
  return before + after.replace(/^\n+/, "");
}

const FINAL_CREATE_CLAUSE = `      allow create: if request.auth != null
                    && isValidReport(request.resource.data)
                    && isValidLimitStep(
                         exists(limitPath(request.auth.uid)) ? get(limitPath(request.auth.uid)).data : null,
                         getAfter(limitPath(request.auth.uid)).data
                       );`;

const TRANSITION_CREATE_CLAUSE = `      allow create: if isValidReport(request.resource.data);`;

test("firestore.transition.rules equals firestore.rules with exactly the bugReports create clause swapped", () => {
  const finalText = normalize(fs.readFileSync(FINAL_PATH, "utf8"));
  const transitionTextRaw = normalize(fs.readFileSync(TRANSITION_PATH, "utf8"));
  const transitionText = stripTransitionHeader(transitionTextRaw);

  assert.ok(
    finalText.includes(FINAL_CREATE_CLAUSE),
    "firebase/firestore.rules must contain the exact expected bugReports create clause (this pin needs updating if that clause changed)"
  );
  assert.ok(
    transitionTextRaw.includes(TRANSITION_CREATE_CLAUSE),
    "firebase/firestore.transition.rules must contain the exact legacy unauthenticated create clause"
  );

  const expectedTransition = finalText.replace(FINAL_CREATE_CLAUSE, TRANSITION_CREATE_CLAUSE);
  assert.equal(
    transitionText,
    expectedTransition,
    "firestore.transition.rules (header stripped) must be byte-identical to firestore.rules with only the create clause swapped"
  );
});

test("firestore.transition.rules keeps the legacy report create unauthenticated (no request.auth check)", () => {
  const raw = fs.readFileSync(TRANSITION_PATH, "utf8");
  const blockOpen = raw.indexOf("match /bugReports/{reportId} {");
  assert.ok(blockOpen >= 0);
  const bodyStart = blockOpen + "match /bugReports/{reportId} {".length;
  const clauseEnd = raw.indexOf("}", bodyStart);
  const block = raw.slice(blockOpen, clauseEnd + 1);
  assert.ok(block.includes("allow create: if isValidReport(request.resource.data);"));
  assert.ok(!block.includes("request.auth"));
  assert.ok(!block.includes("isValidLimitStep"));
});

test("firestore.transition.rules keeps runs/banned/reportLimits identical to the final rules (only bugReports create differs)", () => {
  const finalText = normalize(fs.readFileSync(FINAL_PATH, "utf8"));
  const transitionText = stripTransitionHeader(normalize(fs.readFileSync(TRANSITION_PATH, "utf8")));
  for (const marker of [
    "match /runs/{runId} {",
    "match /banned/{uid} {",
    "match /reportLimits/{uid} {",
    "function isValidBoardRun(d)",
    "function deepKeyOf(d)",
    "function daysKeyOf(d)",
    "function killsKeyOf(d)",
    "function goldKeyOf(d)",
    "function isSubOfClass(cls, sub)",
    "function isValidLimitStep(before, after)",
  ]) {
    const finalIdx = finalText.indexOf(marker);
    const transIdx = transitionText.indexOf(marker);
    assert.ok(finalIdx >= 0, `firestore.rules must contain ${marker}`);
    assert.ok(transIdx >= 0, `firestore.transition.rules must contain ${marker}`);
  }
});

test("firebase.transition.json points at firebase/firestore.transition.rules and the same indexes file as firebase.json", () => {
  const transitionJson = JSON.parse(fs.readFileSync(TRANSITION_JSON_PATH, "utf8"));
  const finalJson = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "firebase.json"), "utf8"));
  assert.equal(transitionJson.firestore.rules, "firebase/firestore.transition.rules");
  assert.equal(transitionJson.firestore.indexes, finalJson.firestore.indexes);
  assert.ok(fs.existsSync(TRANSITION_PATH));
});
