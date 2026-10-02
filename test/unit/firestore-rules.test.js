// test/unit/firestore-rules.test.js
//
// Phase 79.3 (BUG-03), Plan 01 Task 2 — the contract test that keeps
// firebase/firestore.rules equal to src/browser/bugReport.js's field lists
// and size constants (D-13). A drift between the two fails here, not in
// production.
//
// Phase 83 (SRV-01..03, SRV-09), Plan 02 Task 3 — extends the same contract
// to runs/banned/reportLimits and the now-limited bugReports create, while
// pinning the untouched report-shape region (isValidRun/isValidReport) byte
// for byte against its Phase 79.3 sha256.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import crypto from "node:crypto";

import {
  REPORT_FIELDS,
  REQUIRED_REPORT_FIELDS,
  RUN_FIELDS,
  TEXT_MAX_CHARS,
  ORACLE_MAX_CHARS,
  ORACLE_LINES_MAX,
  VERSION_MAX_CHARS as REPORT_VERSION_MAX_CHARS,
  PLATFORM_MAX_CHARS,
  DEVICE_MAX_CHARS,
  CLIENT_TIME_MAX_CHARS,
  RUN_STRING_MAX_CHARS,
  RUN_INT_MAX,
} from "../../src/browser/bugReport.js";
import { BUG_REPORT_CONFIG } from "../../src/browser/bugReportConfig.js";
import { FIREBASE_CONFIG } from "../../src/browser/firebaseConfig.js";
import { BOARD_NAME_MAX_CHARS } from "../../src/browser/boardName.js";
import {
  RUN_DOC_FIELDS,
  UID_MAX_CHARS,
  NAME_MAX_CHARS,
  LEVEL_MIN,
  LEVEL_MAX,
  FLOOR_MIN,
  FLOOR_MAX,
  STEPS_MAX,
  DAY_CAMP_ALLOWANCE,
  GOLD_MAX,
  SP_MAX,
  EPITAPH_MAX_CHARS,
  VERSION_MAX_CHARS,
  SEED_MAX,
  ACTS_MAX,
  HASH_PATTERN,
  NOTE_MAX_CHARS,
  WHEN_SKEW_MS,
  deepKeyOf,
  daysKeyOf,
  killsKeyOf,
  goldKeyOf,
} from "../../src/browser/runDoc.js";
import { LIMIT_FIELDS, REPORT_COOLDOWN_MINUTES, REPORT_DAILY_CAP } from "../../src/browser/reportLimits.js";
import { RACES } from "../../content/races.js";
import { CLASSES } from "../../content/classes.js";
import { CAUSE_TEXT } from "../../content/epitaphs.js";
import { SEASON } from "../../content/season.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const RULES_PATH = path.join(REPO_ROOT, "firebase", "firestore.rules");
const RULES_RAW = fs.readFileSync(RULES_PATH, "utf8").replace(/\r\n/g, "\n");
const RULES = RULES_RAW.replace(/\/\/.*$/gm, "");

/** functionBody(text, name) — the brace-balanced body of `function name(...) { ... }`. */
function functionBody(text, name) {
  const sig = new RegExp(`function\\s+${name}\\s*\\([^)]*\\)\\s*\\{`);
  const m = sig.exec(text);
  assert.ok(m, `function ${name} must exist in the rules`);
  const start = m.index + m[0].length;
  let depth = 1;
  let i = start;
  while (depth > 0 && i < text.length) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") depth--;
    i++;
  }
  return text.slice(start, i - 1);
}

/** blockBody(text, sigRegex) — the brace-balanced body of a `match ... { ... }` (or any braced) block. */
function blockBody(text, sigRegex) {
  const m = sigRegex.exec(text);
  assert.ok(m, `block matching ${sigRegex} must exist`);
  const start = m.index + m[0].length;
  let depth = 1;
  let i = start;
  while (depth > 0 && i < text.length) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") depth--;
    i++;
  }
  return text.slice(start, i - 1);
}

/** keysList(body, method) — the quoted field names inside a .keys().<method>([...]) call, in order. */
function keysList(body, method) {
  const re = new RegExp(`keys\\(\\)\\.${method}\\(\\[([\\s\\S]*?)\\]\\)`);
  const m = re.exec(body);
  assert.ok(m, `keys().${method}([...]) must exist`);
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

/** inListLiteral(body, propExpr) — the quoted values inside `<propExpr> in ['a', 'b', ...]`, in order. */
function inListLiteral(body, propExpr) {
  const re = new RegExp(`${propExpr}\\s+in\\s+\\[([\\s\\S]*?)\\]`);
  const m = re.exec(body);
  assert.ok(m, `${propExpr} in [...] must exist`);
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

/** matchesLiterals(body) — every quoted regex literal inside a `.matches('...')` call, in order. */
function matchesLiterals(body) {
  return [...body.matchAll(/\.matches\('([^']*)'\)/g)].map((x) => x[1]);
}

/** returnExpression(body) — the single expression of a `return <expr>;` function body. */
function returnExpression(body) {
  const m = /return\s+([\s\S]+?);\s*$/.exec(body.trim());
  assert.ok(m, "function body must be a single return statement");
  return m[1];
}

/** assertOnlyIdentifier(expr, allowed) — expr references no bare identifier other than `allowed` (property names after a `.` are ignored). */
function assertOnlyIdentifier(expr, allowed) {
  const stripped = expr.replace(/\.[A-Za-z_]\w*/g, "");
  const idents = stripped.match(/[A-Za-z_]\w*/g) || [];
  for (const id of idents) assert.equal(id, allowed, `unexpected identifier "${id}" in: ${expr}`);
}

/**
 * reportShapeRegion(text) — the LF-normalized text from the line beginning
 * "    // Mirrors src/browser/bugReport.js#RUN_FIELDS" through the "    }\n"
 * that closes function isValidReport (inclusive of that closing line's
 * trailing newline). This is the region CONTEXT/RESEARCH call the "report
 * shape" — it must stay byte-identical to its Phase 79.3 committed form
 * (commit 63cef085) for every future Phase 83 rules edit.
 */
function reportShapeRegion(text) {
  const normalized = text.replace(/\r\n/g, "\n");
  const startMarker = "    // Mirrors src/browser/bugReport.js#RUN_FIELDS";
  const startIdx = normalized.indexOf(startMarker);
  assert.ok(startIdx !== -1, "report-shape region start marker must exist");
  const anchorIdx = normalized.indexOf("isValidRun(d.run)", startIdx);
  assert.ok(anchorIdx !== -1, "isValidRun(d.run) must exist after the start marker");
  const closeIdx = normalized.indexOf("\n    }", anchorIdx);
  assert.ok(closeIdx !== -1, "the closing \"    }\" of isValidReport must exist");
  return normalized.slice(startIdx, closeIdx + "\n    }\n".length);
}

const REPORT_SHAPE_REGION_SHA256 = "7bca2a5dd2711b60706b7aefd8ec0e4d14b8698d036845e2d0e53b8f2367467b";

const isValidRunBody = functionBody(RULES, "isValidRun");
const isValidReportBody = functionBody(RULES, "isValidReport");
const isValidLimitStepBody = functionBody(RULES, "isValidLimitStep");
const isValidBoardRunBody = functionBody(RULES, "isValidBoardRun");
const isSubOfClassBody = functionBody(RULES, "isSubOfClass");
const reportCooldownMinutesBody = functionBody(RULES, "reportCooldownMinutes");
const reportDailyCapBody = functionBody(RULES, "reportDailyCap");

test("rules_version is 2", () => {
  assert.match(RULES_RAW, /rules_version\s*=\s*'2';/);
});

// --- the untouched report shape ------------------------------------------

test("the report-shape region (isValidRun + isValidReport, with their comments) is byte-identical to its Phase 79.3 sha256", () => {
  const region = reportShapeRegion(RULES_RAW);
  const sha = crypto.createHash("sha256").update(region).digest("hex");
  assert.equal(sha, REPORT_SHAPE_REGION_SHA256);
});

test("isValidReport's hasOnly/hasAll lists equal REPORT_FIELDS/REQUIRED_REPORT_FIELDS", () => {
  assert.deepEqual(keysList(isValidReportBody, "hasOnly"), [...REPORT_FIELDS]);
  assert.deepEqual(keysList(isValidReportBody, "hasAll"), [...REQUIRED_REPORT_FIELDS]);
});

test("isValidRun's hasOnly and hasAll lists both equal RUN_FIELDS", () => {
  assert.deepEqual(keysList(isValidRunBody, "hasOnly"), [...RUN_FIELDS]);
  assert.deepEqual(keysList(isValidRunBody, "hasAll"), [...RUN_FIELDS]);
});

test("every numeric bound in the rules equals its bugReport.js constant", () => {
  assert.match(isValidReportBody, new RegExp(`d\\.text\\.size\\(\\)\\s*<=\\s*${TEXT_MAX_CHARS}\\b`));
  assert.match(isValidReportBody, new RegExp(`d\\.oracle\\.size\\(\\)\\s*<=\\s*${ORACLE_MAX_CHARS}\\b`));
  assert.match(isValidReportBody, new RegExp(`d\\.oracleLines\\s*<=\\s*${ORACLE_LINES_MAX}\\b`));
  assert.match(isValidReportBody, new RegExp(`d\\.version\\.size\\(\\)\\s*<=\\s*${REPORT_VERSION_MAX_CHARS}\\b`));
  assert.match(isValidReportBody, new RegExp(`d\\.platform\\.size\\(\\)\\s*<=\\s*${PLATFORM_MAX_CHARS}\\b`));
  assert.match(isValidReportBody, new RegExp(`d\\.device\\.size\\(\\)\\s*<=\\s*${DEVICE_MAX_CHARS}\\b`));
  assert.match(isValidReportBody, new RegExp(`d\\.clientTime\\.size\\(\\)\\s*<=\\s*${CLIENT_TIME_MAX_CHARS}\\b`));
  for (const field of ["cls", "sub", "race"]) {
    assert.match(isValidRunBody, new RegExp(`r\\.${field}\\.size\\(\\)\\s*<=\\s*${RUN_STRING_MAX_CHARS}\\b`));
  }
  for (const field of ["depth", "level", "steps", "day"]) {
    assert.match(isValidRunBody, new RegExp(`r\\.${field}\\s*<=\\s*${RUN_INT_MAX}\\b`));
  }
});

test("schema == 1 and status == 'new' are present", () => {
  assert.match(isValidReportBody, /d\.schema\s*==\s*1\b/);
  assert.match(isValidReportBody, /d\.status\s*==\s*'new'/);
});

// --- the three-create layout ------------------------------------------

test("exactly three allow create: statements exist, one per match block, all before the catch-all", () => {
  const createMatches = RULES.match(/allow create:/g) || [];
  assert.equal(createMatches.length, 3);
  const bugReportsIdx = RULES.indexOf("match /bugReports/{reportId}");
  const reportLimitsIdx = RULES.indexOf("match /reportLimits/{uid}");
  const runsIdx = RULES.indexOf("match /runs/{runId}");
  const catchAllIdx = RULES.indexOf("match /{document=**}");
  assert.ok(bugReportsIdx !== -1 && reportLimitsIdx !== -1 && runsIdx !== -1 && catchAllIdx !== -1);
  assert.ok(bugReportsIdx < catchAllIdx);
  assert.ok(reportLimitsIdx < catchAllIdx);
  assert.ok(runsIdx < catchAllIdx);
});

test("bugReports: create needs auth + isValidReport + isValidLimitStep(getAfter); get/list/update/delete is if false", () => {
  const block = blockBody(RULES, /match\s+\/bugReports\/\{reportId\}\s*\{/);
  assert.match(block, /allow create:\s*if\s+request\.auth\s*!=\s*null/);
  assert.match(block, /isValidReport\(request\.resource\.data\)/);
  assert.match(block, /isValidLimitStep\(/);
  assert.match(block, /getAfter\(limitPath\(request\.auth\.uid\)\)\.data/);
  assert.match(block, /allow get, list, update, delete:\s*if false;/);
});

test("reportLimits: owner get/update are not if false; create is a fresh step; list/delete is if false", () => {
  const block = blockBody(RULES, /match\s+\/reportLimits\/\{uid\}\s*\{/);
  assert.match(block, /allow get:\s*if request\.auth != null && request\.auth\.uid == uid;/);
  assert.match(block, /allow create:\s*if request\.auth != null && request\.auth\.uid == uid[\s\S]*isValidLimitStep\(null, request\.resource\.data\)/);
  assert.match(block, /allow update:\s*if request\.auth != null && request\.auth\.uid == uid[\s\S]*isValidLimitStep\(resource\.data, request\.resource\.data\)/);
  assert.match(block, /allow list, delete:\s*if false;/);
});

test("runs: get is public, list is bounded, create is name-gated, update is refused (D-11), delete is owner-gated", () => {
  const block = blockBody(RULES, /match\s+\/runs\/\{runId\}\s*\{/);
  assert.match(block, /allow get:\s*if true;/);
  assert.match(block, /allow list:\s*if request\.query\.limit == null \|\| request\.query\.limit <= 50;/);
  assert.match(block, /allow update:\s*if false;/);
  assert.equal((block.match(/allow update:/g) || []).length, 1, "exactly one update rule");
  assert.doesNotMatch(block, /affectedKeys/, "no client update path survives (D-11)");
  assert.match(block, /allow delete:\s*if request\.auth != null && resource\.data\.uid == request\.auth\.uid;/);
  assert.doesNotMatch(block, /allow (get|list|delete):\s*if false;/);
});

// --- Phase 91.2 (BOARD-31, D-11, D-13): the names gate -----------------------

test("the names helpers read names/{uid} and nothing else", () => {
  const collapse = (s) => s.replace(/\s+/g, " ").trim();
  assert.equal(collapse(functionBody(RULES, "namePath")), "return /databases/$(database)/documents/names/$(uid);");
  assert.equal(collapse(functionBody(RULES, "isNamed")), "return exists(namePath(uid));");
  assert.equal(collapse(functionBody(RULES, "verifiedName")), "return get(namePath(uid)).data.name;");
});

test("runs create needs the poster's names/{uid} to exist (isNamed first) and handle == verifiedName(auth uid), and keeps the banned check", () => {
  const block = blockBody(RULES, /match\s+\/runs\/\{runId\}\s*\{/);
  const create = /allow create:([\s\S]*?);/.exec(block);
  assert.ok(create, "runs create must exist");
  const expr = create[1].replace(/\s+/g, " ").trim();
  assert.match(expr, /isNamed\(request\.auth\.uid\)/);
  assert.match(expr, /request\.resource\.data\.handle == verifiedName\(request\.auth\.uid\)/);
  assert.ok(expr.indexOf("isNamed(request.auth.uid)") < expr.indexOf("verifiedName(request.auth.uid)"), "isNamed must come before verifiedName");
  // Firestore refuses a request past 1,000 evaluated expressions and isValidBoardRun is most of that budget: keep the cheap guard first
  // (the transition rules carry a second create disjunct; see test/unit/firestore-transition-rules.test.js).
  assert.ok(expr.indexOf("isNamed(request.auth.uid)") < expr.indexOf("isValidBoardRun(request.resource.data)"), "isNamed must come before isValidBoardRun");
  assert.match(expr, /!exists\(\/databases\/\$\(database\)\/documents\/banned\/\$\(request\.auth\.uid\)\)/);
  assert.match(expr, /isValidBoardRun\(request\.resource\.data\)/);
  assert.match(expr, /request\.resource\.data\.uid == request\.auth\.uid/);
  assert.doesNotMatch(expr, /\|\|/, "the final rules have no alternative create branch");
});

test("names and nameOverrides are closed to every client read and write", () => {
  for (const coll of ["names", "nameOverrides"]) {
    const block = blockBody(RULES, new RegExp(`match\\s+\\/${coll}\\/\\{uid\\}\\s*\\{`));
    assert.match(block, /allow read, write:\s*if false;/, coll);
    assert.equal((block.match(/allow /g) || []).length, 1, `${coll} has exactly one allow statement`);
  }
});

test("names and nameOverrides sit before the catch-all", () => {
  const catchAllIdx = RULES.indexOf("match /{document=**}");
  assert.ok(RULES.indexOf("match /names/{uid}") !== -1 && RULES.indexOf("match /names/{uid}") < catchAllIdx);
  assert.ok(RULES.indexOf("match /nameOverrides/{uid}") !== -1 && RULES.indexOf("match /nameOverrides/{uid}") < catchAllIdx);
});

test("the handle clause is a string of 1..BOARD_NAME_MAX_CHARS characters and no @handle regex survives anywhere", () => {
  assert.match(isValidBoardRunBody, new RegExp(`d\\.handle is string && d\\.handle\\.size\\(\\) >= 1 && d\\.handle\\.size\\(\\) <= ${BOARD_NAME_MAX_CHARS}\\b`));
  assert.equal(BOARD_NAME_MAX_CHARS, 64);
  assert.doesNotMatch(RULES, /\^@\(/, "no rolled-handle alternation regex in the final rules");
  assert.doesNotMatch(RULES, /handle\.matches/, "the handle is never regex-matched in the final rules");
  assert.doesNotMatch(RULES, /lantern|mossjaw|knuckle/, "no rolled-handle word list in the final rules");
});

test("banned: read and write are if false", () => {
  const block = blockBody(RULES, /match\s+\/banned\/\{uid\}\s*\{/);
  assert.match(block, /allow read, write:\s*if false;/);
});

test("the catch-all denies read and write, and is the last match block", () => {
  const catchAll = RULES.slice(RULES.indexOf("match /{document=**}"));
  assert.match(catchAll, /allow read, write:\s*if false;/);
  const allMatches = [...RULES.matchAll(/match\s+\//g)];
  const lastMatchIdx = allMatches[allMatches.length - 1].index;
  assert.equal(RULES.indexOf("match /{document=**}"), lastMatchIdx);
});

// --- reportLimits: constants, keys, and the pinned isValidLimitStep body ---

test("reportCooldownMinutes()/reportDailyCap() return REPORT_COOLDOWN_MINUTES/REPORT_DAILY_CAP", () => {
  assert.match(reportCooldownMinutesBody, new RegExp(`return\\s+${REPORT_COOLDOWN_MINUTES}\\s*;`));
  assert.match(reportDailyCapBody, new RegExp(`return\\s+${REPORT_DAILY_CAP}\\s*;`));
});

test("isValidLimitStep's keys().hasOnly/hasAll lists equal LIMIT_FIELDS", () => {
  assert.deepEqual(keysList(isValidLimitStepBody, "hasOnly"), [...LIMIT_FIELDS]);
  assert.deepEqual(keysList(isValidLimitStepBody, "hasAll"), [...LIMIT_FIELDS]);
});

test("isValidLimitStep's body (whitespace-collapsed) is pinned and contains the cooldown/daily-cap/day-bucket logic", () => {
  const collapsed = isValidLimitStepBody.replace(/\s+/g, " ").trim();
  const expected =
    "return after.keys().hasOnly(['last', 'day', 'count']) && after.keys().hasAll(['last', 'day', 'count']) && after.last is timestamp && after.last == request.time && after.day is timestamp && after.count is int && (before == null ? (after.day == request.time.date() && after.count == 1) : (before.last + duration.value(reportCooldownMinutes(), 'm') <= request.time && (before.day == request.time.date() ? (after.day == before.day && after.count == before.count + 1 && after.count <= reportDailyCap()) : (after.day == request.time.date() && after.count == 1))));";
  assert.equal(collapsed, expected);
  assert.match(collapsed, /after\.last == request\.time/);
  assert.match(collapsed, /request\.time\.date\(\)/);
  assert.match(collapsed, /duration\.value\(reportCooldownMinutes\(\), 'm'\)/);
  assert.match(collapsed, /after\.count <= reportDailyCap\(\)/);
});

// --- runs: fields, bounds, lists, regexes, key formulas -----------------

test("isValidBoardRun's hasOnly/hasAll lists equal RUN_DOC_FIELDS", () => {
  assert.deepEqual(keysList(isValidBoardRunBody, "hasOnly"), [...RUN_DOC_FIELDS]);
  assert.deepEqual(keysList(isValidBoardRunBody, "hasAll"), [...RUN_DOC_FIELDS]);
});

test("every bound literal in isValidBoardRun equals its runDoc.js constant", () => {
  assert.match(isValidBoardRunBody, new RegExp(`d\\.uid\\.size\\(\\)\\s*>=\\s*1\\b`));
  assert.match(isValidBoardRunBody, new RegExp(`d\\.uid\\.size\\(\\)\\s*<=\\s*${UID_MAX_CHARS}\\b`));
  assert.match(isValidBoardRunBody, new RegExp(`d\\.season\\s*==\\s*${SEASON}\\b`));
  assert.match(isValidBoardRunBody, new RegExp(`d\\.name\\.size\\(\\)\\s*<=\\s*${NAME_MAX_CHARS}\\b`));
  assert.match(isValidBoardRunBody, new RegExp(`d\\.level\\s*>=\\s*${LEVEL_MIN}\\b`));
  assert.match(isValidBoardRunBody, new RegExp(`d\\.level\\s*<=\\s*${LEVEL_MAX}\\b`));
  assert.match(isValidBoardRunBody, new RegExp(`d\\.floor\\s*>=\\s*${FLOOR_MIN}\\b`));
  assert.match(isValidBoardRunBody, new RegExp(`d\\.floor\\s*<=\\s*${FLOOR_MAX}\\b`));
  assert.match(isValidBoardRunBody, new RegExp(`d\\.steps\\s*<=\\s*${STEPS_MAX}\\b`));
  assert.match(isValidBoardRunBody, new RegExp(`d\\.day \\* 100\\s*<=\\s*d\\.steps \\+ ${DAY_CAMP_ALLOWANCE * 100}\\b`));
  assert.match(isValidBoardRunBody, new RegExp(`d\\.kills\\s*<=\\s*d\\.steps\\b`));
  assert.match(isValidBoardRunBody, new RegExp(`d\\.gold\\s*<=\\s*${GOLD_MAX}\\b`));
  assert.match(isValidBoardRunBody, new RegExp(`d\\.sp\\s*<=\\s*${SP_MAX}\\b`));
  assert.match(isValidBoardRunBody, new RegExp(`d\\.note\\.size\\(\\)\\s*<=\\s*${NOTE_MAX_CHARS}\\b`));
  assert.match(isValidBoardRunBody, new RegExp(`d\\.epitaph\\.size\\(\\)\\s*<=\\s*${EPITAPH_MAX_CHARS}\\b`));
  assert.match(isValidBoardRunBody, new RegExp(`d\\.when\\s*<=\\s*request\\.time\\.toMillis\\(\\)\\s*\\+\\s*${WHEN_SKEW_MS}\\b`));
  assert.match(isValidBoardRunBody, new RegExp(`d\\.version\\.size\\(\\)\\s*<=\\s*${VERSION_MAX_CHARS}\\b`));
  assert.match(isValidBoardRunBody, new RegExp(`d\\.seed\\s*<=\\s*${SEED_MAX}\\b`));
  assert.match(isValidBoardRunBody, new RegExp(`d\\.acts\\s*<=\\s*${ACTS_MAX}\\b`));
});

test("the race list equals Object.keys(RACES)", () => {
  assert.deepEqual(inListLiteral(isValidBoardRunBody, "d\\.race"), Object.keys(RACES));
});

test("the cause list equals Object.keys(CAUSE_TEXT)", () => {
  assert.deepEqual(inListLiteral(isValidBoardRunBody, "d\\.cause"), Object.keys(CAUSE_TEXT));
});

test("isSubOfClass has one clause per class whose list equals CLASSES[cls].subs", () => {
  for (const cls of Object.keys(CLASSES)) {
    const re = new RegExp(`cls == '${cls}' && sub in \\[([\\s\\S]*?)\\]`);
    const m = re.exec(isSubOfClassBody);
    assert.ok(m, `isSubOfClass must have a clause for ${cls}`);
    const list = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    assert.deepEqual(list, CLASSES[cls].subs, `isSubOfClass(${cls}, ...) list`);
  }
});

test("the hash regex equals HASH_PATTERN", () => {
  const literals = matchesLiterals(isValidBoardRunBody);
  assert.ok(literals.includes(HASH_PATTERN), `HASH_PATTERN ${HASH_PATTERN} must appear in isValidBoardRun`);
});

test("deepKeyOf/daysKeyOf/killsKeyOf/goldKeyOf rules functions match runDoc.js's key functions on a grid", () => {
  const deepExpr = returnExpression(functionBody(RULES, "deepKeyOf"));
  const daysExpr = returnExpression(functionBody(RULES, "daysKeyOf"));
  const killsExpr = returnExpression(functionBody(RULES, "killsKeyOf"));
  const goldExpr = returnExpression(functionBody(RULES, "goldKeyOf"));

  for (const expr of [deepExpr, daysExpr, killsExpr, goldExpr]) assertOnlyIdentifier(expr, "d");

  const deepFn = new Function("d", `return (${deepExpr});`);
  const daysFn = new Function("d", `return (${daysExpr});`);
  const killsFn = new Function("d", `return (${killsExpr});`);
  const goldFn = new Function("d", `return (${goldExpr});`);

  // Phase 87 (BOARD-28): the rules' deepKeyOf ranks a same-floor tie by MORE steps.
  assert.ok(deepFn({ floor: 5, steps: 900 }) > deepFn({ floor: 5, steps: 100 }));
  assert.ok(deepFn({ floor: 6, steps: 0 }) > deepFn({ floor: 5, steps: 999999 }));

  const floors = [1, 2, 5, 13, 200];
  const days = [1, 9, 10, 11, 25, 300, 2000];
  const stepsList = [0, 1, 250, 999999];
  const killsList = [0, 1, 50, 999999];
  const goldList = [0, 1, 12345, 10000000];

  for (const floor of floors) {
    for (const day of days) {
      for (const steps of stepsList) {
        for (const kills of killsList) {
          for (const gold of goldList) {
            const d = { floor, day, steps, kills, gold };
            assert.equal(deepFn(d), deepKeyOf(d), JSON.stringify(d));
            assert.equal(daysFn(d), daysKeyOf(d), JSON.stringify(d));
            assert.equal(killsFn(d), killsKeyOf(d), JSON.stringify(d));
            assert.equal(goldFn(d), goldKeyOf(d), JSON.stringify(d));
          }
        }
      }
    }
  }
});

// --- config plumbing -----------------------------------------------------

test("firebase.json points at firebase/firestore.rules, and the file exists", () => {
  const firebaseJson = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "firebase.json"), "utf8"));
  assert.equal(firebaseJson.firestore.rules, "firebase/firestore.rules");
  assert.ok(fs.existsSync(RULES_PATH));
});

test(".firebaserc's projects.default equals FIREBASE_CONFIG.projectId (and BUG_REPORT_CONFIG.projectId)", () => {
  const firebaserc = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, ".firebaserc"), "utf8"));
  assert.equal(firebaserc.projects.default, FIREBASE_CONFIG.projectId);
  assert.equal(firebaserc.projects.default, BUG_REPORT_CONFIG.projectId);
});
