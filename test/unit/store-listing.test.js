// test/unit/store-listing.test.js
//
// Phase 91.2 (BOARD-33, D-07): pins store-listing/LISTING.md's 2.3.0 Data
// safety answers. The public board shows each player under their Google Play
// Games name, so: a "Name" row (the gamer name, shown publicly), a reworded
// "User IDs" row (the game's Firebase account ID linked to the Play Games
// player ID, which is never shown), an "Other actions" row naming the Play
// Games name, the Play Games SDK's own collection declared from Google's
// data-collection page (Diagnostics, plus the avatar as Photos), the two
// bug-report rows kept, encrypted in transit, not shared, not sold, and the
// 2.3.0 source-level audit. Also pins the 2.3.0 full description (an
// optional public leaderboard under the Google Play Games name, six races)
// and the privacy record (the darktier-studio commit, the one-small-
// database line).
//
// Phase 86 (COMP-01) pinned the 2.2.0 answers, including "no trace of Google
// Play Games"; that pin is superseded here. Phase 69 (COMPLY-02, D-04) and
// Phase 79.3 (BUG-02, D-16) established this file against the 2.0/2.1 Play
// Games answers.

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
  "Personal info → **Name**",
  "Google Play Games name",
  "shown publicly",
  "User IDs",
  "Firebase Authentication links to your Google Play Games player ID",
  "never shown publicly",
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
  "Source-level audit (2.3.0",
  "play-services-games-v2",
  "Other user-generated content",
  "Diagnostics",
  "REPORT A BUG",
  "posted publicly on GitHub",
  "Firestore",
];

test("Data safety section carries the 2.5.0 answers, the sources and the source-level audit", () => {
  const ds = section("Data safety");
  // Declared pin update (Phase 101, COMP-05): "Answers for 2.3.0" became "Answers for 2.5.0".
  assert.ok(ds.includes("Answers for 2.5.0"), "the section is titled for 2.5.0");
  for (const needle of DATA_SAFETY_REQUIRED) {
    assert.ok(ds.includes(needle), `Data safety section mentions "${needle}"`);
  }
});

test("the Name row declares the gamer name as public, optional, not shared", () => {
  const ds = section("Data safety");
  const row = ds.split("\n").find((l) => l.startsWith("| Personal info → **Name**"));
  assert.ok(row, "a Personal info → Name table row");
  assert.match(row, /Google Play Games name/);
  assert.match(row, /\| Yes \| No \| Yes \(Compete\) \| App functionality \|/);
  assert.match(row, /public/i);
});

test("the User IDs row is reworded: Firebase ID linked to the Play Games player ID, never shown", () => {
  const ds = section("Data safety");
  const row = ds.split("\n").find((l) => l.startsWith("| Personal info → **User IDs**"));
  assert.ok(row, "a Personal info → User IDs table row");
  assert.match(row, /Firebase account ID/);
  assert.match(row, /Google Play Games player ID/);
  assert.match(row, /never shown publicly/);
  assert.doesNotMatch(row, /carrying no name/, "the 2.2.0 anonymous-only wording is gone");
});

test("the Other actions row names the Play Games name, not a rolled handle", () => {
  const ds = section("Data safety");
  const row = ds.split("\n").find((l) => l.startsWith("| App activity → **Other actions**"));
  assert.ok(row, "an App activity → Other actions table row");
  assert.match(row, /Google Play Games name/);
  assert.doesNotMatch(row, /@handle|rolled handle/);
});

test("the Play Games SDK's own collection is declared from Google's data-collection page", () => {
  const ds = section("Data safety");
  assert.ok(ds.includes("(Play Games SDK)"), "rows are marked as the Play Games SDK's");
  assert.match(ds, /App info and performance → \*\*Diagnostics\*\* \(Play Games SDK\)/);
  assert.match(ds, /Photos and videos → \*\*Photos\*\* \(Play Games SDK\)/);
  assert.ok(ds.includes("developer.android.com/games/pgs/data-collection"), "the page relied on is cited");
  assert.match(ds, /fetched 2026-10-01/);
  assert.ok(ds.includes("Gamer Identity (Gamertag, avatar)"));
  assert.ok(ds.includes("Compete off: the SDK never starts the next time you open the game"), "optional because the SDK starts only with Compete on");
  // Phase 92.2 plan 01 (user 2026-10-02): turning Compete off mid-session takes full effect on the next open, said on both SDK rows.
  const clause = "Turning Compete off takes full effect the next time you open the game: Play Games stays signed in until the app closes, and nothing reaches the board";
  assert.equal(ds.split(clause).length - 1, 2, "both Play Games SDK rows carry the mid-session clause");
});

test("Deletion covers the board name and the Play Games link, and points at Play Games settings", () => {
  const ds = section("Data safety").replace(/\s+/g, " ");
  assert.ok(ds.includes("board name record"));
  assert.ok(ds.includes("Google Play Games link"));
  assert.ok(ds.includes("Disconnecting the game in Google Play Games settings"));
});

test("the pre-2.0 collect answer and the unused-INTERNET claim are gone", () => {
  // The old top answer: "... share any of the required user data types?" -> **No.**
  assert.doesNotMatch(LISTING, /required user data types\?"?\s*(?:→|->)\s*\*\*No\.?\*\*/i);
  // The old permission note: INTERNET was a Capacitor default, "unused".
  assert.doesNotMatch(LISTING, /INTERNET[^\n]*\bunused\b/i);
});

test("the retired 2.2.0 wording is gone: no rolled @handle, no anonymous-only game ID claim", () => {
  const ds = section("Data safety");
  assert.doesNotMatch(ds, /rolled @handle/);
  assert.doesNotMatch(ds, /An anonymous game ID: a random Firebase account ID/);
  assert.doesNotMatch(LISTING, /RE-ROLL HANDLE/);
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
  assert.ok(desc.includes("under your Google Play Games name."));
  assert.ok(
    desc.includes("An optional public leaderboard, if you want the whole world to see how you died, under your Google Play Games name."),
  );
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

test("the Privacy section records the 2.3.0 reconciliation", () => {
  const privacy = section("Privacy policy URL");
  assert.ok(privacy.includes("Reconciled for 2.3.0"));
  assert.ok(privacy.replace(/\s+/g, " ").includes("Google Play Games name"));
});

test("the Data safety section names Firebase as the service provider and never uploads Compete-off runs", () => {
  const ds = section("Data safety");
  assert.match(ds, /delve-die-repeat-6ba5f/);
  assert.ok(ds.includes("service provider"));
  assert.ok(ds.includes("never uploads runs finished while Compete was off"));
});

// Phase 101 (COMP-05): 2.5.0 adds achievements sent to Google Play Games while
// Compete is on. No new Data safety data type: the Other actions row covers them.

/** How many times `needle` appears in `text`. */
function count(text, needle) {
  return text.split(needle).length - 1;
}

test("the Other actions row also covers achievements sent to Google Play Games", () => {
  const ds = section("Data safety");
  const row = ds.split("\n").find((l) => l.startsWith("| App activity → **Other actions**"));
  assert.ok(row, "an App activity → Other actions table row");
  assert.match(row, /Google Play Games name/);
  assert.match(row, /achievement/i);
  assert.match(row, /Google Play Games/);
  assert.match(row, /progress/i);
  assert.match(row, /earned while Compete was off/);
  assert.equal(count(row, "achievement unlocks"), 1, "the row names achievement unlocks once");
});

test("the 2.3.0 'sign-in only' claim is gone and Unlocked achievements now maps to Other actions", () => {
  const ds = section("Data safety");
  assert.doesNotMatch(ds, /Play Games for sign-in only/);
  assert.doesNotMatch(LISTING, /sign-in only/i);
  assert.ok(ds.includes("Unlocked achievements"), "the mapping bullets name the Unlocked achievements item");
});

test("Why optional covers achievements earned while Compete was off, and still the runs rule", () => {
  const ds = section("Data safety").replace(/\s+/g, " ");
  assert.ok(
    ds.includes(
      "achievements earned while Compete was off stay on the phone and go to Google Play Games only after Compete is turned on and the player is signed in",
    ),
  );
  assert.ok(ds.includes("never uploads runs finished while Compete was off"));
});

test("Deletion says plainly that ERASE MY RUNS does not delete achievements held in Google Play Games", () => {
  const ds = section("Data safety").replace(/\s+/g, " ");
  const sentence = "ERASE MY RUNS does not delete achievements held in Google Play Games";
  assert.equal(count(ds, sentence), 1, "said once");
});

test("the Shared finding says achievements go to Google's own service under the player's account", () => {
  const ds = section("Data safety").replace(/\s+/g, " ");
  assert.ok(ds.includes("achievements go to Google Play Games, Google's own service, under the player's own account"));
});

test("the Notes for the console step carry a 2.5.0 bullet: no new data type, re-read the form", () => {
  const ds = section("Data safety").replace(/\s+/g, " ");
  assert.ok(ds.includes("2.5.0 adds no new data type"));
  assert.equal(count(ds, "2.5.0 adds no new data type"), 1);
  assert.ok(ds.includes("2.5.0 adds no package"));
});

test("the Privacy section records Reconciled for 2.5.0 once, keeps 2.3.0, and names two website commits", () => {
  const privacy = section("Privacy policy URL");
  assert.equal(count(privacy, "Reconciled for 2.5.0"), 1);
  assert.equal(count(privacy, "Reconciled for 2.3.0"), 1);
  const commits = privacy.match(/darktier-studio commit [0-9a-f]{7,40}\b/g) || [];
  assert.equal(commits.length, 2, "the 2.3.0 and the 2.5.0 website commits");
  assert.ok(privacy.includes("darktier-studio commit 7d4ad754c8860f73042e879917b08b219797521f"));
  assert.ok(privacy.includes("October 5, 2026"));
});
