// test/unit/compliance-docs.test.js
//
// Phase 86 (COMP-03, ROADMAP criterion 5) pinned the retirement of
// docs/PLAY-GAMES-SETUP.md, the Play Console cleanup section of
// docs/LEADERBOARDS.md and the one ordered 2.2.0 release checklist in
// RELEASING.md (which the release-day probe results subsection in
// BUG-REPORTS.md feeds).
//
// Phase 91.2 (BOARD-33, D-09, D-13, D-14) reverses the first two: Play Games
// sign-in is back, so docs/PLAY-GAMES-SETUP.md is a LIVE runbook again (sign-in
// only; path A reuses configuration 517177834262, path B is the fallback),
// LEADERBOARDS.md section 16 says the configuration is in use and must NOT be
// removed (the Season-1 boards stay listed and optional to delete), and
// RELEASING.md carries one ordered "Release 2.3.0" checklist: the transition
// deploy and the boardName function before the Compete-ON device test, the
// release-day steps, the final rules, then the transition clean-up.

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

const RUNBOOK_PATH = "docs/PLAY-GAMES-SETUP.md";
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

/** The Release 2.3.0 ordered checklist's own text, up to the next "## " heading. */
function release23Section() {
  const doc = read(RELEASING_PATH);
  const heading = "## Release 2.3.0: the ordered checklist";
  const start = doc.indexOf(heading);
  assert.ok(start >= 0, `RELEASING.md has "${heading}"`);
  const rest = doc.slice(start);
  const nextHeadingOffset = rest.slice(1).search(/\n## /);
  return nextHeadingOffset >= 0 ? rest.slice(0, nextHeadingOffset + 1) : rest;
}

// ─── docs/PLAY-GAMES-SETUP.md: the live sign-in runbook (Phase 91.2) ────────

test("docs/PLAY-GAMES-SETUP.md is a live runbook again: path A, path B, the Game server credential, both SHA-1 kinds, the provider enable", () => {
  const doc = read(RUNBOOK_PATH);
  assert.doesNotMatch(doc, /^# Play Games Services setup \(retired\)/m, "no longer the retirement notice");
  assert.ok(doc.includes("517177834262"), "names the reused configuration (D-09)");
  assert.match(doc, /Path A/);
  assert.match(doc, /Path B/);
  assert.ok(doc.includes("Game server"), "the Game server credential");
  assert.match(doc, /Play App Signing key's\*{0,2} SHA-1/, "the Play App Signing key's SHA-1");
  assert.match(doc, /debug keystore's\*{0,2} SHA-1/, "the debug keystore's SHA-1");
  assert.ok(doc.includes("defaultSupportedIdpConfigs"), "the provider enable");
  assert.ok(doc.includes("playgames.google.com"), "the provider id");
  assert.ok(doc.includes("delve-die-repeat-6ba5f"), "path B links the Firebase project");
  assert.ok(doc.includes("games-ids.xml") && doc.includes("PLAY_GAMES_CONFIG"), "path B changes both APP_ID copies");
  assert.ok(doc.includes("tools/board-names/deploy.mjs"), "what Claude runs: the function deploy");
  assert.match(doc, /Do not remove the Play Games configuration/i);
});

test("docs/PLAY-GAMES-SETUP.md keeps the secret out of the repo and still points at the former runbook's git commit", () => {
  const doc = read(RUNBOOK_PATH);
  assert.match(doc, /outside the repo/i);
  assert.match(doc, /a217d032/);
  assert.match(doc, /PROFILE or EMAIL/);
});

// ─── docs/LEADERBOARDS.md: the Play Games configuration stays, and the rules cutover ───

test("docs/LEADERBOARDS.md section 16 keeps the Play Games configuration and still lists all five Season-1 board IDs", () => {
  const doc = read(LEADERBOARDS_PATH);
  const start = doc.indexOf("## 16. The Play Games configuration and the Season-1 boards");
  assert.ok(start >= 0, "LEADERBOARDS.md has the section 16 heading");
  const section = doc.slice(start);
  assert.match(section, /Do NOT remove the Play Games Services configuration/);
  assert.ok(section.includes("517177834262"));
  assert.doesNotMatch(doc, /Retiring Google Play Games \(Play Console cleanup\)/, "the old cleanup heading is gone");
  assert.doesNotMatch(section, /\*\*Remove the Play Games Services configuration/, "no step tells the user to remove it");
  for (const id of SEASON_1_BOARD_IDS) {
    assert.ok(doc.includes(id), `LEADERBOARDS.md mentions board id ${id}`);
  }
});

test("docs/LEADERBOARDS.md describes the names gate, the boardName function, identity v2, the sign-in hold and moderation", () => {
  const doc = read(LEADERBOARDS_PATH);
  for (const needle of [
    "names/{uid}",
    "boardName",
    "board-names/deploy.mjs",
    "ddr.identity.v2",
    "boardSession",
    "FEDERATED_USER_ID_ALREADY_LINKED",
    "ddr.boardRepost.v1",
    "signin",
    "names --flagged",
    "name-override",
    "name-clear",
    "delete-run",
    "Blaze",
  ]) {
    assert.ok(doc.includes(needle), `LEADERBOARDS.md mentions "${needle}"`);
  }
  assert.doesNotMatch(doc, /content\/handles\.js/, "no table row for the deleted handle module");
  assert.doesNotMatch(doc, /RE-ROLL HANDLE is unlimited/, "the re-roll paragraph is gone");
});

test("docs/LEADERBOARDS.md section 6 keeps the transition history, and the transition files are gone", () => {
  const doc = read(LEADERBOARDS_PATH);
  assert.ok(doc.includes("### The transition periods (both over)"));
  assert.ok(doc.includes("The 2.1.0 period (over, 2026-09-29)"));
  assert.ok(doc.includes("The 2.2.0 to 2.3.0 period (over, 2026-10-02)"));
  assert.ok(!doc.includes("Until the 2.3 cutover"), "no live transition instructions remain");
  // Release 2.3.0 step 4 deleted the transition artefacts and the 2.2.0 helpers.
  for (const gone of ["firebase.transition.json", "firebase/firestore.transition.rules", "test/unit/firestore-transition-rules.test.js"]) {
    assert.ok(!fs.existsSync(path.join(REPO_ROOT, gone)), `${gone} is gone`);
  }
  const runDoc = read("src/browser/runDoc.js");
  for (const name of ["LEGACY_HANDLE_PATTERN", "isLegacyHandle", "legacyDeepKeyOf", "legacyHandleUpdateCommit"]) {
    assert.ok(!runDoc.includes(name), `runDoc.js no longer defines ${name}`);
  }
});

test("docs/LEADERBOARDS.md section 14 carries the Release 2.3.0 live record", () => {
  const doc = read(LEADERBOARDS_PATH);
  const at = doc.indexOf("### Release 2.3.0 live record (2026-10-02)");
  assert.ok(at >= 0, "the live record subsection exists");
  const record = doc.slice(at);
  assert.ok(record.includes("be6716a7"), "the transition fix commit is named");
  const flat = record.replace(/\s+/g, " ");
  assert.ok(flat.includes("8/8 PASS"), "the transition smoke result");
  assert.ok(flat.includes("passed **every step**"), "the plain smoke at the cutover");
  assert.ok(flat.includes("moved **21** runs"), "the re-key moved 21 runs");
  assert.ok(flat.includes("**22 of 22 runs on the new key and 0 on the old**"), "the census");
});

test("the docs name no deleted handle module or flag", () => {
  const shell = read("docs/SHELL-MODULES.md");
  assert.doesNotMatch(shell, /handles\.js/);
  assert.doesNotMatch(shell, /rerollHandle|ensureHandle\(\)/);
  assert.doesNotMatch(read(RELEASING_PATH), /--with-admin|acceptLegacyDeepKey/);
});

// ─── docs/RELEASING.md: no stale runbook link, one ordered checklist ────────

test("docs/RELEASING.md points at the live sign-in runbook and cancels the old Play Console cleanup step", () => {
  const doc = read(RELEASING_PATH);
  assert.ok(doc.includes("PLAY-GAMES-SETUP"), "the 2.3.0 console batch is the runbook");
  assert.match(doc, /Play Console cleanup of the old game service: CANCELLED/);
  assert.ok(!/^\s*\d+\.\s+\*\*Remove the Play Games Services configuration/im.test(doc), "no step tells the user to remove the configuration");
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

test("docs/RELEASING.md's Release 2.3.0 checklist keeps its steps in hard order (BOARD-28, BOARD-31..33)", () => {
  const section = release23Section();
  const orderedMarkers = [
    "PLAY-GAMES-SETUP",
    "defaultSupportedIdpConfigs",
    "board-names/deploy.mjs --setup --yes",
    "board-names/deploy.mjs --yes",
    "--config firebase.transition.json",
    "boards-smoke.mjs --transition",
    "boards-smoke.mjs --function",
    "PLAY GAMES PROBE",
    "--name-source games",
    "patch notes",
    "android-api-scan.mjs",
    "releaseRuntimeClasspath",
    "rekey-deep",
    "rekey-deep --yes",
    "Publish the Play Games configuration",
    "npm run deploy",
    "Data safety form",
    "users interact",
    "firestore:rules,firestore:indexes --project delve-die-repeat-6ba5f",
    "rekey-deep --yes",
    "Delete the transition artefacts",
    "LEGACY_HANDLE_PATTERN",
  ];
  let pos = 0;
  for (const marker of orderedMarkers) {
    const idx = section.indexOf(marker, pos);
    assert.ok(idx >= 0, `Release 2.3.0 checklist contains "${marker}" after the previous marker`);
    pos = idx + marker.length;
  }
  assert.match(section, /2\.2\.0\s+client's run is refused/);
  assert.ok(section.includes("517177834262"), "path A reuses the existing configuration");
  assert.ok(section.includes("boardName"), "the function is named");
});

test("docs/RELEASING.md: the transition deploy, the final-rules deploy and the transition clean-up appear in increasing line order", () => {
  const lines = read(RELEASING_PATH).split("\n");
  const section0 = lines.findIndex((l) => l.startsWith("## Release 2.3.0: the ordered checklist"));
  assert.ok(section0 >= 0);
  const find = (re, from) => {
    const i = lines.findIndex((l, n) => n >= from && re.test(l));
    assert.ok(i >= 0, `a line matching ${re} after line ${from + 1}`);
    return i;
  };
  const transition = find(/--config firebase\.transition\.json/, section0);
  const finalRules = find(/^3\. \*\*When 2\.3 reaches testers/, transition);
  const cleanup = find(/^4\. \*\*Delete the transition artefacts/, finalRules);
  assert.ok(transition < finalRules && finalRules < cleanup);
});

test("docs/RELEASING.md's 2.3.0 checklist asks the user before every live step", () => {
  const section = release23Section();
  assert.match(section, /user's go first/);
  assert.match(section, /Confirm it with the user before deploying/);
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
