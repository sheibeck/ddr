// test/unit/shell-resume-line.test.js
//
// SAV-06/SAV-07 (Phase 76, plan 76-05): the Oracle's resume line at boot.
//
// A relaunch into a live fight or an open store (engine/saveState.js resumes
// both, 76-03) is narrated once, on the Oracle, right under the existing
// "Delve resumed." banner and hero line. The events come from
// engineAdapter.js#takeBootResumeEvents() (76-04, one-shot) and are formatted
// by formatEvents() through EVENT_NARRATION's fightResumed / storeResumed
// entries. Oracle only: a relaunch is a minor event (the card-vs-rail ruling),
// and the fight or store screen itself comes back through paint() ->
// renderEncounter() from the rehydrated S.
//
// These are source pins over the stripped page (the style of
// test/persistence/resume-mid-encounter.test.js) plus direct formatting checks.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { formatEvents } from "../../src/browser/engineAdapter.js";
import { BANNED, ALLOWLIST } from "../../content/safety-wordlist.js";
import { stripHtml } from "../../tools/ident-sweep.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const RAW_HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8").replace(/\r\n/g, "\n");
const CODE = stripHtml(RAW_HTML);

const PINNED_IMPORT = 'import { boot, dispatch, startNewRun, waitForPending, takeBootWornReport } from "./src/browser/engineAdapter.js";';
const RESUME_IMPORT = 'import { takeBootResumeEvents, formatEvents } from "./src/browser/engineAdapter.js";';

function occurrences(haystack, needle) {
  let n = 0;
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    n++;
    i = haystack.indexOf(needle, i + needle.length);
  }
  return n;
}

// The module script's `if (hadSaveAtLaunch) {` block at boot, from its opening
// brace up to the first paint after it.
function resumeBlock() {
  const start = CODE.indexOf("if (hadSaveAtLaunch) {");
  assert.ok(start !== -1, "the boot-time `if (hadSaveAtLaunch) {` block is missing");
  const paintAt = CODE.indexOf("window.paint();", start);
  assert.ok(paintAt > start, "no window.paint() after the hadSaveAtLaunch block");
  return { start, paintAt, body: CODE.slice(start, paintAt) };
}

const ALLOW = new Set(ALLOWLIST.map((w) => w.toLowerCase()));
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const MATCHERS = BANNED.map((term) => ({ term, re: new RegExp("\\b" + escapeRegExp(term) + "\\b", "i") }));
function findBannedTerms(text) {
  const hits = [];
  for (const { term, re } of MATCHERS) {
    const m = text.match(re);
    if (m && !ALLOW.has(m[0].toLowerCase())) hits.push({ term, match: m[0] });
  }
  return hits;
}
const plain = (html) => html.replace(/<[^>]*>/g, "").trim();

// ─── imports ────────────────────────────────────────────────────────────────

test("SOURCE: the resume import line appears exactly once, and the pinned boot/dispatch import line is byte-identical and still once", () => {
  assert.equal(occurrences(RAW_HTML, RESUME_IMPORT), 1);
  assert.equal(occurrences(RAW_HTML, PINNED_IMPORT), 1);
});

// ─── the boot wiring ────────────────────────────────────────────────────────

test("SOURCE: the hadSaveAtLaunch block reads takeBootResumeEvents() once, after the banner and the hero line, and before window.paint()", () => {
  const { body } = resumeBlock();
  const banner = body.indexOf("Delve resumed.");
  const hero = body.indexOf("skill level ${ROMAN[engineState.c.level - 1]}");
  const take = body.indexOf("takeBootResumeEvents()");
  assert.ok(banner !== -1, "the Delve resumed. banner is in the block");
  assert.ok(hero > banner, "the hero line follows the banner");
  assert.ok(take > hero, "the resume events are read after the hero line");
  assert.equal(occurrences(body, "takeBootResumeEvents()"), 1, "read exactly once");
  // The whole page reads it only here: a second read would get null anyway,
  // but a stray one elsewhere would be a wiring mistake.
  assert.equal(occurrences(CODE, "takeBootResumeEvents()"), 1);
});

test("SOURCE: the resume events go through formatEvents and every line through window.logLine", () => {
  const { body } = resumeBlock();
  assert.match(body, /formatEvents\(takeBootResumeEvents\(\) \|\| \[\]\)/);
  const fmt = body.indexOf("formatEvents(takeBootResumeEvents");
  const tail = body.slice(fmt);
  assert.match(tail, /window\.logLine\(/, "each formatted line is logged on the Oracle");
});

test("SOURCE: the resume block raises no rail line and no card (Oracle only, per the card-vs-rail ruling)", () => {
  const { body } = resumeBlock();
  for (const banned of ["mzRailLine", "mzConditionCard", "mzBeatCard", "showCard", "Card(", "railLine"]) {
    assert.equal(body.includes(banned), false, `the resume block must not call ${banned}`);
  }
});

// ─── the formatted lines ────────────────────────────────────────────────────

test("formatEvents: a fight under way, a pending fight and an open store each give one non-empty line, the two fight lines differ, and all are clean", () => {
  const underWay = formatEvents([{ type: "fightResumed", round: 3, pending: false, foes: 2 }]);
  const pending = formatEvents([{ type: "fightResumed", round: 1, pending: true, foes: 2 }]);
  const store = formatEvents([{ type: "storeResumed" }]);
  for (const [label, lines] of [["under way", underWay], ["pending", pending], ["store", store]]) {
    assert.equal(lines.length, 1, `${label}: exactly one line`);
    assert.ok(plain(lines[0]).length > 0, `${label}: the line is not empty`);
    assert.deepStrictEqual(findBannedTerms(plain(lines[0])), [], `${label}: banned copy in "${lines[0]}"`);
  }
  assert.notEqual(underWay[0], pending[0], "the pending fight reads differently from one under way");
  assert.match(plain(underWay[0]), /Round 3/, "a fight under way names its round");
});

test("formatEvents: a quiet save (an empty list) and a fresh boot (null folded to []) log nothing", () => {
  assert.deepStrictEqual(formatEvents([]), []);
  assert.deepStrictEqual(formatEvents(null || []), []);
});
