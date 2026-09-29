// test/unit/devBoardSeed.test.js
//
// Phase 84 Plan 08 Task 1. Covers devBoardSeed.js#devBoardRuns: shape,
// determinism, validity against runDoc.js#validateRunDoc, id uniqueness,
// race/sub-class variety, dev-uid sharing, and the source pin (no network/
// storage/DOM import).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { validateRunDoc } from "../../src/browser/runDoc.js";
import { devBoardRuns } from "../../src/browser/devBoardSeed.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const SRC = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "devBoardSeed.js"), "utf8").replace(/\r\n/g, "\n");

test("devBoardRuns: returns at least 12 frozen entries, each {id, doc} frozen", () => {
  const runs = devBoardRuns();
  assert.ok(Array.isArray(runs));
  assert.ok(runs.length >= 12, `expected >= 12 entries, got ${runs.length}`);
  assert.ok(Object.isFrozen(runs));
  for (const entry of runs) {
    assert.ok(Object.isFrozen(entry));
    assert.equal(typeof entry.id, "string");
    assert.ok(entry.id.length > 0);
    assert.equal(typeof entry.doc, "object");
  }
});

test("devBoardRuns: identical on every call", () => {
  const a = devBoardRuns();
  const b = devBoardRuns();
  assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
});

test("devBoardRuns: every doc passes validateRunDoc(doc, {})", () => {
  const runs = devBoardRuns();
  for (const { doc } of runs) {
    const fails = validateRunDoc(doc, {});
    assert.deepEqual(fails, [], `doc ${JSON.stringify(doc)} failed: ${fails.join(",")}`);
  }
});

test("devBoardRuns: every doc carries a non-empty note and a numeric when", () => {
  const runs = devBoardRuns();
  for (const { doc } of runs) {
    assert.equal(typeof doc.note, "string");
    assert.ok(doc.note.length > 0);
    assert.equal(typeof doc.when, "number");
    assert.ok(Number.isFinite(doc.when));
  }
});

test("devBoardRuns: ids are unique", () => {
  const runs = devBoardRuns();
  const ids = new Set(runs.map((r) => r.id));
  assert.equal(ids.size, runs.length);
});

test("devBoardRuns: at least four races and six sub-classes appear", () => {
  const runs = devBoardRuns();
  const races = new Set(runs.map((r) => r.doc.race));
  const subs = new Set(runs.map((r) => r.doc.sub));
  assert.ok(races.size >= 4, `expected >= 4 races, got ${races.size}`);
  assert.ok(subs.size >= 6, `expected >= 6 sub-classes, got ${subs.size}`);
});

test("devBoardRuns: several docs share one dev uid", () => {
  const runs = devBoardRuns();
  const byUid = new Map();
  for (const { doc } of runs) {
    byUid.set(doc.uid, (byUid.get(doc.uid) || 0) + 1);
  }
  const sharedUids = [...byUid.values()].filter((n) => n >= 2);
  assert.ok(sharedUids.length >= 1, "expected at least one dev uid shared by >= 2 runs");
});

test("devBoardRuns: respects an injected now()", () => {
  const fixedNow = () => 1700000000000;
  const runs = devBoardRuns({ now: fixedNow });
  for (const { doc } of runs) {
    assert.ok(doc.when <= fixedNow());
  }
});

test("source pin: devBoardSeed.js imports nothing that touches the network, storage or the DOM", () => {
  assert.ok(!/\bwindow\./.test(SRC), "must not reference window.");
  assert.ok(!/\bdocument\./.test(SRC), "must not reference document.");
  assert.ok(!/\blocalStorage\b/.test(SRC), "must not reference localStorage");
  assert.ok(!/\bfetch\(/.test(SRC), "must not call fetch(");
  assert.ok(!/from ["']\.\/storage\.js["']/.test(SRC), "must not import storage.js");
  assert.ok(!/from ["'].*firestoreRest\.js["']/.test(SRC), "must not import firestoreRest.js");
  assert.ok(!/from ["'].*firebaseConfig\.js["']/.test(SRC), "must not import firebaseConfig.js");
});

test("source pin: devBoardSeed.js exports devBoardRuns exactly once", () => {
  const matches = SRC.match(/export function devBoardRuns/g) || [];
  assert.equal(matches.length, 1);
});
