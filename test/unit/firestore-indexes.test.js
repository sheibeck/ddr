// test/unit/firestore-indexes.test.js
//
// Phase 83 (SRV-03, SRV-11), Plan 02 Task 3. firebase/firestore.indexes.json
// declares the 16 runs indexes (4 rank keys x none/race/sub/race+sub shapes)
// and the 3 bugReports cleanup indexes (status+filedAt,
// status+oracleTrimmed+filedAt, status+failedAt); firebase.json points the
// CLI at it.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { RANK_FIELD } from "../../src/browser/runDoc.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const INDEXES_PATH = path.join(REPO_ROOT, "firebase", "firestore.indexes.json");
const INDEXES = JSON.parse(fs.readFileSync(INDEXES_PATH, "utf8"));

test("fieldOverrides is an empty array", () => {
  assert.deepEqual(INDEXES.fieldOverrides, []);
});

test("exactly 19 indexes total", () => {
  assert.equal(INDEXES.indexes.length, 19);
});

test("16 runs indexes: every RANK_FIELD value x none/race/sub/race+sub shape, in that order", () => {
  const runsIndexes = INDEXES.indexes.filter((i) => i.collectionGroup === "runs");
  assert.equal(runsIndexes.length, 16);

  const rankFields = Object.values(RANK_FIELD); // [deepKey, daysKey, killsKey, goldKey], stat-declaration order
  const shapes = [[], ["race"], ["sub"], ["race", "sub"]];

  let idx = 0;
  for (const rankField of rankFields) {
    for (const shape of shapes) {
      const index = runsIndexes[idx];
      assert.equal(index.queryScope, "COLLECTION");
      const expectedFields = [{ fieldPath: "season", order: "ASCENDING" }];
      for (const f of shape) expectedFields.push({ fieldPath: f, order: "ASCENDING" });
      expectedFields.push({ fieldPath: rankField, order: "DESCENDING" });
      assert.deepEqual(index.fields, expectedFields, `runs index ${idx} (${rankField}, shape ${JSON.stringify(shape)})`);
      idx++;
    }
  }
});

test("3 bugReports cleanup indexes: status+filedAt, status+oracleTrimmed+filedAt, status+failedAt", () => {
  const bugReportsIndexes = INDEXES.indexes.filter((i) => i.collectionGroup === "bugReports");
  assert.equal(bugReportsIndexes.length, 3);
  for (const index of bugReportsIndexes) assert.equal(index.queryScope, "COLLECTION");

  assert.deepEqual(bugReportsIndexes[0].fields, [
    { fieldPath: "status", order: "ASCENDING" },
    { fieldPath: "filedAt", order: "ASCENDING" },
  ]);
  assert.deepEqual(bugReportsIndexes[1].fields, [
    { fieldPath: "status", order: "ASCENDING" },
    { fieldPath: "oracleTrimmed", order: "ASCENDING" },
    { fieldPath: "filedAt", order: "ASCENDING" },
  ]);
  assert.deepEqual(bugReportsIndexes[2].fields, [
    { fieldPath: "status", order: "ASCENDING" },
    { fieldPath: "failedAt", order: "ASCENDING" },
  ]);
});

test("no duplicate index definitions", () => {
  const seen = new Set();
  for (const index of INDEXES.indexes) {
    const key = JSON.stringify({ collectionGroup: index.collectionGroup, fields: index.fields });
    assert.ok(!seen.has(key), `duplicate index: ${key}`);
    seen.add(key);
  }
});

test("firebase.json's firestore.indexes points at firebase/firestore.indexes.json, and the file exists", () => {
  const firebaseJson = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "firebase.json"), "utf8"));
  assert.equal(firebaseJson.firestore.indexes, "firebase/firestore.indexes.json");
  assert.equal(firebaseJson.firestore.rules, "firebase/firestore.rules");
  assert.ok(fs.existsSync(INDEXES_PATH));
});
