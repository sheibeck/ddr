// test/unit/store-listing.test.js
//
// Phase 86 (COMP-01): pins store-listing/LISTING.md's 2.2.0 Data safety
// answers for our own Firebase leaderboard: an own "User IDs" row for the
// anonymous game ID (collected for app functionality, optional, deletable
// with ERASE MY RUNS), an "Other actions" row covering the rolled @handle
// and every run-document field, the two bug-report rows kept, encrypted in
// transit, not shared (Firebase as service provider), not sold, both
// refreshed source- and build-level audits, and no trace of the retired
// Google Play Games service anywhere in the listing. Also pins the 2.2.0
// full description (an optional public leaderboard, six races) and the
// 2.2.0 privacy record (the darktier-studio commit, the one-small-database
// line).
//
// Phase 69 (COMPLY-02, D-04) and Phase 79.3 (BUG-02, D-16) established this
// file against the 2.0/2.1 Play Games answers; those pins are superseded
// here.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const LISTING_PATH = path.resolve(__dirname, "..", "..", "store-listing", "LISTING.md");
const LISTING = fs.readFileSync(LISTING_PATH, "utf8").replace(/\r\n/g, "\n");

/** The body of a "## " section, up to the next "## " heading. */
function section(heading) {
  const start = LISTING.indexOf(`\n## ${heading}\n`);
  assert.ok(start >= 0, `LISTING.md has a "## ${heading}" section`);
  const body = LISTING.slice(start + heading.length + 5);
  const next = body.search(/\n## /);
  return next >= 0 ? body.slice(0, next) : body;
}

const DATA_SAFETY_REQUIRED = [
  "User IDs",
  "anonymous game ID",
  "App activity",
  "Other actions",
  "App functionality",
  "encrypted in transit",
  "optional",
  "not sold",
  "Shared",
  "service provider",
  "answer/10787469",
  "privacy/delete-data",
  "ERASE MY RUNS",
  "never uploads runs finished while Compete was off",
  "Source-level audit",
  "Build-level audit",
  "Other user-generated content",
  "Diagnostics",
  "REPORT A BUG",
  "posted publicly on GitHub",
  "Firestore",
];

test("Data safety section carries the 2.2.0 answers, the source and both audits", () => {
  const ds = section("Data safety");
  for (const needle of DATA_SAFETY_REQUIRED) {
    assert.ok(ds.includes(needle), `Data safety section mentions "${needle}"`);
  }
});

test("the pre-2.0 collect answer and the unused-INTERNET claim are gone", () => {
  // The old top answer: "... share any of the required user data types?" -> **No.**
  assert.doesNotMatch(LISTING, /required user data types\?"?\s*(?:→|->)\s*\*\*No\.?\*\*/i);
  // The old permission note: INTERNET was a Capacitor default, "unused".
  assert.doesNotMatch(LISTING, /INTERNET[^\n]*\bunused\b/i);
});

test("the whole listing has no trace of the retired Google Play Games service", () => {
  assert.doesNotMatch(LISTING, /play.games|\bpgs\b/i);
});

// Phase 69 (D-03, D-05) and Phase 86 (COMP-01): the privacy record, the
// re-voiced description and Google's metadata limits.

/** The fenced block under "## Full description". */
function fullDescription() {
  const body = section("Full description (≤ 4000)");
  const m = body.match(/```\n([\s\S]*?)\n```/);
  assert.ok(m, "the Full description section has a fenced block");
  return m[1];
}

test("the full description fits Play's 4000-character limit and names the leaderboard", () => {
  const desc = fullDescription();
  assert.ok(desc.length <= 4000, `full description is ${desc.length} characters`);
  assert.ok(desc.includes("An optional public leaderboard, if you want the whole world to see how you died."));
  assert.ok(desc.includes("six races"));
});

test("the preferred short description fits Play's 80-character limit", () => {
  const body = section("Short description (≤ 80)");
  const m = body.match(/`([^`\n]+)`/);
  assert.ok(m, "a backticked preferred short description");
  assert.ok(m[1].length <= 80, `short description is ${m[1].length} characters`);
});

test("the listing never claims that nothing is collected", () => {
  assert.doesNotMatch(
    LISTING,
    /\bno data collected\b|\bcollects? no (user )?data\b|\bnothing is collected\b|\bcollects? nothing\b/i,
  );
});

test("the Privacy section records both URLs, the effective date and the website commit", () => {
  const privacy = section("Privacy policy URL");
  assert.ok(privacy.includes("privacy/apps"));
  assert.ok(privacy.includes("privacy/delete-data"));
  assert.match(
    privacy,
    /\b(January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, 2026\b/,
  );
  assert.match(privacy, /darktier-studio commit [0-9a-f]{7,40}\b/);
});

test("the Privacy section records the one-small-database backend line and drops the 79.3 draft", () => {
  const privacy = section("Privacy policy URL");
  assert.ok(
    privacy.includes(
      "We keep one small database on Google Firebase for the public leaderboard and bug reports, nothing else.",
    ),
  );
  assert.doesNotMatch(LISTING, /Draft for darktierstudios\.com\/privacy\/apps/);
});

test("the Data safety section names Firebase as the service provider and never uploads Compete-off runs", () => {
  const ds = section("Data safety");
  assert.match(ds, /delve-die-repeat-6ba5f/);
  assert.ok(ds.includes("service provider"));
  assert.ok(ds.includes("never uploads runs finished while Compete was off"));
});
