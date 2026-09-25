// test/unit/play-games-runbook.test.js
//
// Phase 67 (PGS-01, D-16): pins docs/PLAY-GAMES-SETUP.md, the Play Console
// runbook, to the facts a reader cannot afford to lose: the Play App Signing
// key's SHA-1 (not the upload key's), where the APP_ID goes, the Testers
// allow-list, what Phase 69 completes (the five boards, the 70-board cap) and
// the 64-char score tag. Phase 68 adds the leaderboards table (each board's
// ordering, LEANEST the only smaller-is-better one), where the IDs go
// (content/leaderboards.js), the season-bump process and the tag's name
// rule. It also keeps the doc on the shipping name only. Phase 69 (COMPLY-03,
// D-06) extends the pins: the section 6 order of operations (each checklist
// step in acting order, matched by the section it cites), the section 12
// publishing step (the Publishing path, the up-to-2-hours delay and its
// dated source), the per-row ordering of the leaderboards table, the Data
// safety and privacy pointers, and consecutive section numbering.

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
  "Larger is better",
  "PLACEHOLDER",
  "tamper",
  "First L.",
  // Phase 69 (D-06): the order of operations, publishing, the Data safety
  // pointer with the two privacy URLs, the debug credential, the score
  // format and where the deferred console items are recorded.
  "Order of operations",
  "Publishing",
  "Grow users",
  "2 hours",
  "store-listing/LISTING.md",
  "privacy/apps",
  "privacy/delete-data",
  "debug keystore",
  "Numeric",
  "docs/UAT-v2.0.md",
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

// ---------------------------------------------------------------------
// Phase 69 (D-06): structural pins.
// ---------------------------------------------------------------------

/** The text from the "## " heading whose title matches `titleRe` up to the next "## " heading. */
function section(titleRe) {
  const lines = DOC.split("\n");
  const start = lines.findIndex((l) => l.startsWith("## ") && titleRe.test(l));
  assert.notEqual(start, -1, `no "## " heading matches ${titleRe}`);
  let end = lines.findIndex((l, i) => i > start && l.startsWith("## "));
  if (end === -1) end = lines.length;
  return lines.slice(start, end).join("\n");
}

/**
 * The numbered checklist items of a section: each item starts on a line that
 * begins with a number and a period, and takes its indented continuation
 * lines with it (so a wrapped step still reads as one step).
 */
function checklistItems(text) {
  const items = [];
  for (const line of text.split("\n")) {
    if (/^\d+\. /.test(line)) items.push(line);
    else if (items.length && /^\s+\S/.test(line)) items[items.length - 1] += " " + line.trim();
  }
  return items;
}

test("the leaderboards table has the four live boards, every one larger-is-better, and no LEANEST row", () => {
  const rows = section(/Leaderboards/).split("\n");
  const row = (name) => {
    const found = rows.filter((l) => l.startsWith(`| ${name} `));
    assert.equal(found.length, 1, `exactly one table row for ${name}`);
    return found[0];
  };
  for (const name of ["DEEPEST", "LONGEST", "BUTCHERY", "PURSE"]) {
    assert.match(row(name), /Larger is better/, `${name} is larger-is-better`);
    assert.doesNotMatch(row(name), /Smaller is better/, `${name} is not smaller-is-better`);
  }
  assert.equal(
    rows.some((l) => l.startsWith("| LEANEST ")),
    false,
    "the retired LEANEST board has no row in the §7 table",
  );
});

test("section 13 names the retired board, when to delete it and the cap", () => {
  const s13 = section(/^## 13\. /);
  assert.match(s13, /^## 13\. Retired boards/);
  assert.match(s13, /CgkIlvbN0YYPEAIQAw/);
  assert.match(s13, /\bafter\b/i);
  assert.match(s13, /\b70\b/);
});

test("section 6 is an order of operations whose steps run in acting order", () => {
  const items = checklistItems(section(/Order of operations/));
  assert.ok(items.length >= 9, `expected at least 9 checklist steps, found ${items.length}`);
  // Each step is found by the first checklist item that cites it. The word
  // boundaries keep "section 2" from matching "sections 2" or "section 12".
  const STEPS = [
    ["enable Play Games Services", /\bsection 2\b/],
    ["the SHA-1 credential", /\bsection 3\b/],
    ["the APP_ID", /\bsection 4\b/],
    ["Testers", /\bsection 5\b/],
    ["create the leaderboards", /\bsection 7\b/],
    ["the IDs into content/leaderboards.js", /content\/leaderboards\.js/],
    ["rebuild and upload", /docs\/RELEASING\.md/],
    ["the tester check", /\bsection 11\b/],
    ["publish", /\bsection 12\b/],
    ["the Data safety answers", /store-listing\/LISTING\.md/],
    ["the season bump", /\bsection 9\b/],
  ];
  let prev = -1;
  for (const [label, re] of STEPS) {
    const at = items.findIndex((it) => re.test(it));
    assert.notEqual(at, -1, `the checklist must have a step for ${label} (${re})`);
    assert.ok(at > prev, `the step for ${label} (item ${at + 1}) must come after the previous step (item ${prev + 1})`);
    prev = at;
  }
});

test("section 6 records the console steps as deferred items that never block a milestone", () => {
  const s6 = section(/Order of operations/);
  assert.match(s6, /docs\/UAT-v2\.0\.md/);
  assert.match(s6, /never block/);
});

test("section 12 publishes the configuration, with the path, the delay and its dated source", () => {
  const s12 = section(/^## 12\. /);
  assert.match(s12, /^## 12\. Publish/);
  assert.match(s12, /Grow users/);
  assert.match(s12, /Setup and management/);
  assert.match(s12, /Publishing/);
  assert.match(s12, /2 hours/);
  assert.match(s12, /developer\.android\.com\/games\/pgs\/console\/publish/);
  assert.match(s12, /\d{4}-\d{2}-\d{2}/, "the source carries a date");
});

test("the numbered sections run 1, 2, 3 ... with no gap and no repeat", () => {
  const nums = [...DOC.matchAll(/^## (\d+)\./gm)].map((m) => Number(m[1]));
  assert.ok(nums.length >= 13, `expected at least 13 numbered sections, found ${nums.length}`);
  nums.forEach((n, i) => assert.equal(n, i + 1, `section heading #${i + 1} is numbered ${n}`));
  const headings = DOC.split("\n").filter((l) => l.startsWith("## "));
  assert.equal(headings.length, nums.length, 'every "## " heading is numbered');
});
