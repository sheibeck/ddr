// test/unit/compliance-docs.test.js
//
// Phase 86 (COMP-03, ROADMAP criterion 5): pins the retirement of
// docs/PLAY-GAMES-SETUP.md in favour of docs/LEADERBOARDS.md, the Play
// Console cleanup section and release-day rules cutover LEADERBOARDS.md
// carries, and the one ordered 2.2.0 release checklist RELEASING.md
// carries (which the release-day probe results subsection in
// BUG-REPORTS.md feeds). Replaces test/unit/play-games-runbook.test.js,
// which pinned the runbook this plan retires.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

function read(relPath) {
  return fs
    .readFileSync(path.resolve(REPO_ROOT, relPath), "utf8")
    .replace(/\r\n/g, "\n");
}

const RETIRED_RUNBOOK_PATH = "docs/PLAY-GAMES-SETUP.md";
const LEADERBOARDS_PATH = "docs/LEADERBOARDS.md";
const RELEASING_PATH = "docs/RELEASING.md";
const BUG_REPORTS_PATH = "docs/BUG-REPORTS.md";

const SEASON_1_BOARD_IDS = [
  "CgkIlvbN0YYPEAIQAg", // DEEPEST
  "CgkIlvbN0YYPEAIQBA", // LONGEST
  "CgkIlvbN0YYPEAIQBQ", // BUTCHERY
  "CgkIlvbN0YYPEAIQBg", // PURSE
  "CgkIlvbN0YYPEAIQAw", // LEANEST (retired in v2.1)
];

const RELEASE_PROBE_NAMES = [
  "list-read",
  "extra-field",
  "wrong-status",
  "no-auth",
  "no-limit-write",
  "cooldown",
  "forged-count",
  "sixth-today",
  "other-limit-doc",
  "list-limits",
];

/** The checklist section's own text, isolated from every other RELEASING.md heading. */
function releaseChecklistSection() {
  const doc = read(RELEASING_PATH);
  const heading = "## Release 2.2.0: the ordered checklist";
  const start = doc.indexOf(heading);
  assert.ok(start >= 0, `RELEASING.md has "${heading}"`);
  const rest = doc.slice(start);
  const nextHeadingOffset = rest.slice(1).search(/\n## [^R]/);
  return nextHeadingOffset >= 0 ? rest.slice(0, nextHeadingOffset + 1) : rest;
}

// ─── docs/PLAY-GAMES-SETUP.md: the retirement notice ────────────────────────

test("docs/PLAY-GAMES-SETUP.md is at most 20 lines and says it is retired", () => {
  const doc = read(RETIRED_RUNBOOK_PATH);
  const lineCount = doc.split("\n").filter((l, i, arr) => !(i === arr.length - 1 && l === "")).length;
  assert.ok(lineCount <= 20, `expected at most 20 lines, got ${lineCount}`);
  assert.match(doc, /retired/i);
});

test("docs/PLAY-GAMES-SETUP.md points at docs/LEADERBOARDS.md and the former runbook's git commit", () => {
  const doc = read(RETIRED_RUNBOOK_PATH);
  assert.match(doc, /docs\/LEADERBOARDS\.md/);
  assert.match(doc, /a217d032/);
});

// ─── docs/LEADERBOARDS.md: the Play Console cleanup and the rules cutover ───

test("docs/LEADERBOARDS.md carries the Play Console cleanup section and all five Season-1 board IDs", () => {
  const doc = read(LEADERBOARDS_PATH);
  assert.match(doc, /Retiring Google Play Games \(Play Console cleanup\)/);
  for (const id of SEASON_1_BOARD_IDS) {
    assert.ok(doc.includes(id), `LEADERBOARDS.md mentions board id ${id}`);
  }
});

test("docs/LEADERBOARDS.md section 6 keeps the 2.2 transition history, and the 2.3 DEPTH-key transition files exist while it runs", () => {
  const doc = read(LEADERBOARDS_PATH);
  assert.match(doc, /The transition period \(over, 2026-09-29\)/);
  assert.match(doc, /Until the 2\.3 cutover: the DEPTH-key transition config/);
  // Phase 87 recreated these for BOARD-28; the Release 2.3.0 steps delete them
  // again and flip this assertion back to "gone".
  for (const present of ["firebase.transition.json", "firebase/firestore.transition.rules", "test/unit/firestore-transition-rules.test.js"]) {
    assert.ok(fs.existsSync(path.join(REPO_ROOT, present)), `${present} exists until the 2.3 cutover`);
  }
});

// ─── docs/RELEASING.md: no stale runbook link, one ordered checklist ────────

test("docs/RELEASING.md carries no reference to the retired runbook's filename", () => {
  const doc = read(RELEASING_PATH);
  assert.ok(!doc.includes("PLAY-GAMES-SETUP"), "no reference to the retired runbook's filename");
});

test("docs/RELEASING.md's checklist section carries its markers in the release's own order", () => {
  const section = releaseChecklistSection();
  const orderedMarkers = [
    "DRAFT",
    "npm run android:release",
    "--probe-rules",
    "firestore-transition-rules.test.js",
    "npm run deploy",
    "LEADERBOARDS.md",
    "Season 1 reset",
  ];
  let pos = 0;
  for (const marker of orderedMarkers) {
    const idx = section.indexOf(marker, pos);
    assert.ok(idx >= 0, `checklist section contains "${marker}" after the previous marker`);
    pos = idx + marker.length;
  }
});

test("docs/RELEASING.md's checklist names android:release, not play:release, for the 2.2.0 build", () => {
  const section = releaseChecklistSection();
  assert.match(section, /not `npm run play:release`/);
});

// ─── docs/BUG-REPORTS.md: the release-day probe target ──────────────────────

test("docs/BUG-REPORTS.md carries the release-day probe-results subsection with all ten probe names", () => {
  const doc = read(BUG_REPORTS_PATH);
  const heading = "Release-day `--probe-rules` results (2.2.0)";
  assert.match(doc, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  const start = doc.indexOf(heading);
  const nextHeadingOffset = doc.slice(start + 1).search(/\n### /);
  const section = nextHeadingOffset >= 0 ? doc.slice(start, start + 1 + nextHeadingOffset) : doc.slice(start);
  for (const probe of RELEASE_PROBE_NAMES) {
    assert.ok(section.includes(probe), `release-day subsection mentions probe "${probe}"`);
  }
});
