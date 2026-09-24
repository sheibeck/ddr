// test/unit/play-games-runbook.test.js
//
// Phase 67 (PGS-01, D-16): pins docs/PLAY-GAMES-SETUP.md, the Play Console
// runbook, to the facts a reader cannot afford to lose: the Play App Signing
// key's SHA-1 (not the upload key's), where the APP_ID goes, the Testers
// allow-list, what Phase 69 completes (the five boards, the 70-board cap) and
// the 64-char score tag. Phase 68 adds the leaderboards table (each board's
// ordering, LEANEST the only smaller-is-better one), where the IDs go
// (content/leaderboards.js), the season-bump process and the tag's name
// rule. It also keeps the doc on the shipping name only.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const DOC_PATH = path.resolve(__dirname, "..", "..", "docs", "PLAY-GAMES-SETUP.md");
const DOC = fs.readFileSync(DOC_PATH, "utf8").replace(/\r\n/g, "\n");

const REQUIRED = [
  "Play App Signing",
  "SHA-1",
  "upload key",
  "game_services_project_id",
  "android/app/src/main/res/values/games-ids.xml",
  "com.darktierstudios.delvedierepeat",
  "Testers",
  "Phase 69",
  "Phase 68",
  "64",
  "DEEPEST",
  "LEANEST",
  "LONGEST",
  "BUTCHERY",
  "PURSE",
  "70",
  // Phase 68 (D-14, D-15, D-16): the leaderboards table, where the IDs go,
  // the season-bump process and the score-tag name rule.
  "content/leaderboards.js",
  "LEADERBOARD_IDS",
  "content/season.js",
  "Smaller is better",
  "Larger is better",
  "PLACEHOLDER",
  "tamper",
  "First L.",
];

for (const needle of REQUIRED) {
  test(`runbook mentions ${JSON.stringify(needle)}`, () => {
    assert.ok(DOC.includes(needle), `docs/PLAY-GAMES-SETUP.md must mention ${JSON.stringify(needle)}`);
  });
}

test("runbook uses the shipping name, never the old working title", () => {
  assert.ok(DOC.includes("Delve, Die, Repeat"));
  // Built from two halves so this test file itself never spells the old title.
  const OLD_TITLE = "maze" + "world";
  assert.equal(DOC.toLowerCase().includes(OLD_TITLE), false, "the old working title must not appear in the runbook");
});

test("runbook says the upload key's SHA-1 is the wrong one", () => {
  assert.match(DOC, /Not the upload key's SHA-1/);
});
