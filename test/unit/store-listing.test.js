// test/unit/store-listing.test.js
//
// Phase 69 (COMPLY-02, D-04): pins store-listing/LISTING.md's Data safety
// section to the answers the 2.0 build actually needs: User IDs (the Play
// Games player ID) and App activity (scores plus the score tag's gameplay
// details) are collected, optional (Compete off), for App functionality,
// encrypted in transit, not shared and not sold, with both Google sources
// cited, the delete-data URL named and a dated source-level audit. The
// pre-2.0 "collects nothing" answer and the claim that the INTERNET
// permission is unused must stay gone.

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
  "App activity",
  "App functionality",
  "encrypted in transit",
  "optional",
  "not sold",
  "Shared",
  "developer.android.com/games/pgs/data-collection",
  "answer/10787469",
  "privacy/delete-data",
  "Source-level audit",
];

test("Data safety section carries the 2.0 answers, both sources and the audit", () => {
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
