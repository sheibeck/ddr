// test/unit/boards-smoke.test.js
//
// Phase 83 Plan 07. Covers tools/boards-smoke.mjs against
// src/browser/fakeBoardServer.js (83-04) in both client-only and
// --with-admin modes, all three existsResponse duplicate-create answers, a
// failure path with complete cleanup, and the CLI's --dry-run / bad-flag
// paths. No live network call here: the CLI is only ever driven with
// --dry-run or an unrecognized flag, both of which touch nothing — a bare
// invocation would use the REAL FIREBASE_CONFIG and must never run in a
// test (the live run is 83-08's job).

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import url from "node:url";

import { SEASON } from "../../content/season.js";
import { runHash } from "../../engine/records.js";
import { buildRunDoc } from "../../src/browser/runDoc.js";
import { rollHandle } from "../../src/browser/handles.js";
import { createFakeBoardFetch, FAKE_ADMIN_TOKEN } from "../../src/browser/fakeBoardServer.js";
import { resolveAdminAuth, createAdminApi } from "../../tools/boards-admin.mjs";
import { smokeSummaries, runSmoke } from "../../tools/boards-smoke.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TOOL_PATH = path.join(REPO_ROOT, "tools", "boards-smoke.mjs");

const VALID_CONFIG = Object.freeze({ projectId: "delve-die-repeat-6ba5f", apiKey: `AIza${"A".repeat(35)}` });

/* ---------------- helpers ---------------- */

function clockBox(start = 1000000) {
  let t = start;
  const now = () => t;
  now.advance = (d) => {
    t += d;
  };
  return now;
}

function runTool(args) {
  return spawnSync(process.execPath, [TOOL_PATH, ...args], { cwd: REPO_ROOT, encoding: "utf8" });
}

function validHandle(seed = 0.15) {
  return rollHandle(() => seed, null);
}

const NON_ADMIN_STEP_ORDER = [
  "signup", "create-a", "resubmit-a", "create-b", "top-ten", "totals", "ranks",
  "deny-bad-key", "deny-other-id", "deny-no-auth", "deny-non-handle-update", "deny-list-51",
  "handle-rewrite", "erase", "account-deleted",
];

const ADMIN_STEP_ORDER = [
  "signup", "create-a", "resubmit-a", "create-b", "top-ten", "totals", "ranks",
  "deny-bad-key", "deny-other-id", "deny-no-auth", "deny-non-handle-update", "deny-list-51",
  "ban", "admin-delete",
  "handle-rewrite", "erase", "account-deleted",
];

async function makeAdmin(fake) {
  const auth = await resolveAdminAuth({ env: {}, execFn: () => FAKE_ADMIN_TOKEN });
  assert.equal(auth.ok, true);
  const api = createAdminApi({ projectId: VALID_CONFIG.projectId, fetchFn: fake.fetchFn, headers: auth.headers });
  return { api };
}

/* ---------------- smokeSummaries ---------------- */

test("smokeSummaries: three frozen RunSummaries, each with a valid hash, each passing buildRunDoc", () => {
  const clock = clockBox(5000000);
  const { a, b, c } = smokeSummaries(clock);

  for (const s of [a, b, c]) {
    assert.equal(Object.isFrozen(s), true);
    assert.equal(s.race, "Troll");
    assert.equal(s.cls, "Magic User");
    assert.equal(s.sub, "Court Mage");
    assert.equal(s.name, "Smoke Probe");
    assert.equal(s.cause, "combat");
    assert.equal(s.epitaph, "Smoke test run. Safe to delete.");
    assert.equal(s.season, SEASON);
    assert.equal(s.seed, 5000000);
    assert.equal(s.hash, runHash(s));
    assert.equal(typeof s.note, "string");
    assert.ok(s.note.length > 0);
    assert.equal(Number.isInteger(s.when), true);
    assert.equal(s.when, 5000000);
    const built = buildRunDoc(s, { uid: "fakeuid000001", handle: validHandle(), version: s.version });
    assert.equal(built.ok, true, JSON.stringify(built.fails));
  }

  assert.equal(a.floor, 7);
  assert.equal(b.floor, 3);
  assert.equal(c.floor, 2);
  assert.notEqual(a.hash, b.hash);
  assert.notEqual(b.hash, c.hash);
});

test("smokeSummaries: object is frozen and re-calling with the same now() gives the same seed/hash", () => {
  const clock = clockBox(42);
  const first = smokeSummaries(clock);
  const second = smokeSummaries(clock);
  assert.equal(first.a.hash, second.a.hash);
  assert.equal(Object.isFrozen(first), true);
});

/* ---------------- runSmoke: full client-only pass ---------------- */

test("runSmoke: a full client-only pass against a fresh fake resolves ok:true in step order, with facts", async () => {
  const clock = clockBox(2000000);
  const fake = createFakeBoardFetch({ config: VALID_CONFIG, now: clock });
  const logLines = [];
  const result = await runSmoke({ fetchFn: fake.fetchFn, config: VALID_CONFIG, now: clock, log: (l) => logLines.push(l) });

  assert.equal(result.ok, true, JSON.stringify(result.steps.filter((s) => !s.pass)));
  assert.deepEqual(result.steps.map((s) => s.name), NON_ADMIN_STEP_ORDER);
  assert.equal(result.steps.every((s) => s.pass), true);

  assert.equal(result.facts.duplicateStatus, 400);
  assert.equal(result.facts.countUnderListRule, "pass");
  assert.deepEqual(result.facts.missingIndexes, []);
  assert.equal(result.facts.commitShape, "single-write");

  assert.equal(result.cleanup.erased, true);
  assert.equal(result.cleanup.accountDeleted, true);

  // the board is left exactly as it was found
  assert.deepEqual(fake.docs(), []);
  assert.deepEqual(fake.banned(), []);
  assert.deepEqual(fake.users(), []);
});

test("runSmoke: existsResponse 'denied' records duplicateStatus 403 and still passes every step", async () => {
  const clock = clockBox(2000000);
  const fake = createFakeBoardFetch({ config: VALID_CONFIG, now: clock, existsResponse: "denied" });
  const result = await runSmoke({ fetchFn: fake.fetchFn, config: VALID_CONFIG, now: clock, log: () => {} });
  assert.equal(result.ok, true, JSON.stringify(result.steps.filter((s) => !s.pass)));
  assert.equal(result.facts.duplicateStatus, 403);
});

test("runSmoke: existsResponse 'conflict' records duplicateStatus 409 and still passes every step", async () => {
  const clock = clockBox(2000000);
  const fake = createFakeBoardFetch({ config: VALID_CONFIG, now: clock, existsResponse: "conflict" });
  const result = await runSmoke({ fetchFn: fake.fetchFn, config: VALID_CONFIG, now: clock, log: () => {} });
  assert.equal(result.ok, true, JSON.stringify(result.steps.filter((s) => !s.pass)));
  assert.equal(result.facts.duplicateStatus, 409);
});

/* ---------------- runSmoke: --with-admin ---------------- */

test("runSmoke: with admin, ban/admin-delete run and the board ends empty", async () => {
  const clock = clockBox(3000000);
  const fake = createFakeBoardFetch({ config: VALID_CONFIG, now: clock });
  const admin = await makeAdmin(fake);
  const result = await runSmoke({ fetchFn: fake.fetchFn, config: VALID_CONFIG, now: clock, log: () => {}, admin });

  assert.equal(result.ok, true, JSON.stringify(result.steps.filter((s) => !s.pass)));
  assert.deepEqual(result.steps.map((s) => s.name), ADMIN_STEP_ORDER);

  assert.deepEqual(fake.docs(), []);
  assert.deepEqual(fake.banned(), []);
  assert.deepEqual(fake.users(), []);
});

/* ---------------- runSmoke: failure path + cleanup ---------------- */

test("runSmoke: a Firestore 503 after sign-up fails at create-a, names the step, and cleanup still runs", async () => {
  const clock = clockBox(4000000);
  const fake = createFakeBoardFetch({ config: VALID_CONFIG, now: clock });
  const flaky = async (rawUrl, init) => {
    if (typeof rawUrl === "string" && rawUrl.startsWith("https://firestore.googleapis.com/")) {
      return { ok: false, status: 503, json: async () => ({ error: { code: 503, message: "UNAVAILABLE", status: "UNAVAILABLE" } }) };
    }
    return fake.fetchFn(rawUrl, init);
  };

  const result = await runSmoke({ fetchFn: flaky, config: VALID_CONFIG, now: clock, log: () => {} });

  assert.equal(result.ok, false);
  assert.deepEqual(result.steps.map((s) => s.name), ["signup", "create-a"]);
  assert.equal(result.steps[0].pass, true);
  assert.equal(result.steps[1].pass, false);

  // no run was ever created, no ban was ever set, and the anonymous account is gone
  assert.deepEqual(fake.docs(), []);
  assert.deepEqual(fake.banned(), []);
  assert.deepEqual(fake.users(), []);
  assert.equal(result.cleanup.accountDeleted, true);
});

/* ---------------- no tokens or the key ever leak ---------------- */

test("runSmoke: no step, log line or fact contains the API key, an id token or a refresh token", async () => {
  const clock = clockBox(6000000);
  const fake = createFakeBoardFetch({ config: VALID_CONFIG, now: clock });
  const logLines = [];
  const result = await runSmoke({ fetchFn: fake.fetchFn, config: VALID_CONFIG, now: clock, log: (l) => logLines.push(l) });

  assert.equal(result.ok, true);
  const blob = `${JSON.stringify(result.steps)}\n${JSON.stringify(result.facts)}\n${logLines.join("\n")}`;
  assert.ok(!blob.includes(VALID_CONFIG.apiKey));
  assert.ok(!/Bearer\s+\S+/.test(blob));
  assert.ok(!/\bidtok\d+/.test(blob));
  assert.ok(!/\brtok\d+/.test(blob));
});

/* ---------------- CLI: --dry-run and a bad flag ---------------- */

test("CLI --dry-run: exits 0, lists every step, prints the three summaries, never the key", () => {
  const res = runTool(["--dry-run"]);
  assert.equal(res.status, 0, res.stderr);
  assert.ok(res.stdout.includes("signup"));
  assert.ok(res.stdout.includes("erase"));
  assert.ok(res.stdout.includes("ban"));
  assert.ok(res.stdout.includes("Smoke Probe"));
  assert.ok(!res.stdout.includes("AIza"));
});

test("CLI --bogus: usage + exit 2, no network", () => {
  const res = runTool(["--bogus"]);
  assert.equal(res.status, 2);
});

test("CLI too many args: usage + exit 2", () => {
  const res = runTool(["--dry-run", "extra"]);
  assert.equal(res.status, 2);
});
