// test/unit/firestore-rules.test.js
//
// Phase 79.3 (BUG-03), Plan 01 Task 2 — the contract test that keeps
// firebase/firestore.rules equal to src/browser/bugReport.js's field lists
// and size constants (D-13). A drift between the two fails here, not in
// production.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import {
  REPORT_FIELDS,
  REQUIRED_REPORT_FIELDS,
  RUN_FIELDS,
  TEXT_MAX_CHARS,
  ORACLE_MAX_CHARS,
  ORACLE_LINES_MAX,
  VERSION_MAX_CHARS,
  PLATFORM_MAX_CHARS,
  DEVICE_MAX_CHARS,
  CLIENT_TIME_MAX_CHARS,
  RUN_STRING_MAX_CHARS,
  RUN_INT_MAX,
} from "../../src/browser/bugReport.js";
import { BUG_REPORT_CONFIG } from "../../src/browser/bugReportConfig.js";

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

/** keysList(body, method) — the quoted field names inside a .keys().<method>([...]) call, in order. */
function keysList(body, method) {
  const re = new RegExp(`keys\\(\\)\\.${method}\\(\\[([\\s\\S]*?)\\]\\)`);
  const m = re.exec(body);
  assert.ok(m, `keys().${method}([...]) must exist`);
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

const isValidRunBody = functionBody(RULES, "isValidRun");
const isValidReportBody = functionBody(RULES, "isValidReport");

test("rules_version is 2", () => {
  assert.match(RULES_RAW, /rules_version\s*=\s*'2';/);
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
  assert.match(isValidReportBody, new RegExp(`d\\.version\\.size\\(\\)\\s*<=\\s*${VERSION_MAX_CHARS}\\b`));
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

test("exactly one allow create: exists, inside match /bugReports/{reportId}", () => {
  const createMatches = RULES.match(/allow create:/g) || [];
  assert.equal(createMatches.length, 1);
  const bugReportsIdx = RULES.indexOf("match /bugReports/{reportId}");
  const catchAllIdx = RULES.indexOf("match /{document=**}");
  assert.ok(bugReportsIdx !== -1 && catchAllIdx !== -1 && bugReportsIdx < catchAllIdx);
  const createIdx = RULES.indexOf("allow create:");
  assert.ok(createIdx > bugReportsIdx && createIdx < catchAllIdx);
});

test("every other allow statement ends with if false;", () => {
  const allowStatements = [...RULES.matchAll(/allow\s+([a-z, ]+):\s*if\s+([^;]+);/g)];
  assert.ok(allowStatements.length >= 3);
  let nonCreateCount = 0;
  for (const [, verbs, cond] of allowStatements) {
    if (verbs.trim() === "create") continue;
    nonCreateCount++;
    assert.equal(cond.trim(), "false");
  }
  assert.ok(nonCreateCount >= 2);
});

test("the catch-all match denies read and write", () => {
  const catchAll = RULES.slice(RULES.indexOf("match /{document=**}"));
  assert.match(catchAll, /allow read, write:\s*if false;/);
});

test("firebase.json points at firebase/firestore.rules, and the file exists", () => {
  const firebaseJson = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "firebase.json"), "utf8"));
  assert.equal(firebaseJson.firestore.rules, "firebase/firestore.rules");
  assert.ok(fs.existsSync(RULES_PATH));
});

test(".firebaserc's projects.default equals BUG_REPORT_CONFIG.projectId", () => {
  const firebaserc = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, ".firebaserc"), "utf8"));
  assert.equal(firebaserc.projects.default, BUG_REPORT_CONFIG.projectId);
});
