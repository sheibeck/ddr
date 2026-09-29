// test/unit/bug-report-tool.test.js
//
// Phase 79.3 (D-17), Plan 01 Task 3 / Phase 83 (SRV-09), Plan 09 Task 3 —
// tools/bug-reports/send-test-report.mjs. No live network call here: the
// CLI's --dry-run and bad-argument paths are driven through spawnSync,
// which never reaches the network while argument validation short-circuits
// first; buildProbes/runProbes/sendOnce/runProbeRules are exercised
// directly against src/browser/fakeBoardServer.js (createFakeBoardFetch,
// FAKE_ADMIN_TOKEN) and a permissive stub fetchFn, never gcloud or a real
// project.

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import url from "node:url";

import { buildReportPayload, validateReport, reportingAvailable } from "../../src/browser/bugReport.js";
import { BUG_REPORT_CONFIG } from "../../src/browser/bugReportConfig.js";
import { REPORT_LIMITS_COLLECTION } from "../../src/browser/reportLimits.js";
import { createFakeBoardFetch, FAKE_ADMIN_TOKEN } from "../../src/browser/fakeBoardServer.js";
import { testReportInputs, buildProbes, runProbes, sendOnce, runProbeRules } from "../../tools/bug-reports/send-test-report.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TOOL_PATH = path.join(REPO_ROOT, "tools", "bug-reports", "send-test-report.mjs");

const VALID_CONFIG = Object.freeze({ projectId: "delve-die-repeat-6ba5f", apiKey: `AIza${"A".repeat(35)}`, collection: "bugReports" });

function runTool(args) {
  return spawnSync(process.execPath, [TOOL_PATH, ...args], { cwd: REPO_ROOT, encoding: "utf8" });
}

const PROBE_NAMES = [
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

/** permissiveFetch — every request resolves 200 (the "rules would allow everything" stand-in). */
async function permissiveFetch(url_, init) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ name: "projects/p/databases/(default)/documents/bugReports/permissive-id" }),
    text: async () => "{}",
  };
}

test("testReportInputs: builds an ok, valid, clearly-marked [TEST] report", () => {
  const now = new Date("2026-09-28T12:00:00.000Z");
  const { ok, report } = buildReportPayload(testReportInputs(now));
  assert.ok(ok);
  assert.deepEqual(validateReport(report), []);
  assert.match(report.text, /^\[TEST\]/);
});

/* ---------------- buildProbes ---------------- */

test("buildProbes: the ten named probes in order, with the right shapes", () => {
  const { report } = buildReportPayload(testReportInputs());
  const probes = buildProbes({
    config: VALID_CONFIG,
    report,
    now: 5000000,
    a: { uid: "auid000001", idToken: "atok000001" },
    b: { uid: "buid000002" },
  });
  assert.deepEqual(probes.map((p) => p.name), PROBE_NAMES);

  const listRead = probes.find((p) => p.name === "list-read");
  assert.equal(listRead.init.method, "GET");
  assert.ok(listRead.url.includes("/bugReports"));

  const listLimits = probes.find((p) => p.name === "list-limits");
  assert.equal(listLimits.init.method, "GET");
  assert.ok(listLimits.url.includes(`/${REPORT_LIMITS_COLLECTION}`));

  const extraField = probes.find((p) => p.name === "extra-field");
  const extraBody = JSON.parse(extraField.init.body);
  assert.ok("extra" in extraBody.writes[0].update.fields);
  assert.equal(extraField.init.headers.Authorization, "Bearer atok000001");

  const wrongStatus = probes.find((p) => p.name === "wrong-status");
  const wrongBody = JSON.parse(wrongStatus.init.body);
  assert.equal(wrongBody.writes[0].update.fields.status.stringValue, "filed");

  const noAuth = probes.find((p) => p.name === "no-auth");
  assert.ok(!("Authorization" in noAuth.init.headers));
  const noAuthBody = JSON.parse(noAuth.init.body);
  assert.equal(noAuthBody.writes.length, 1);

  const noLimitWrite = probes.find((p) => p.name === "no-limit-write");
  assert.equal(noLimitWrite.init.headers.Authorization, "Bearer atok000001");
  const noLimitBody = JSON.parse(noLimitWrite.init.body);
  assert.equal(noLimitBody.writes.length, 1);

  const cooldown = probes.find((p) => p.name === "cooldown");
  assert.deepEqual(cooldown.seed, { uid: "auid000001", lastMs: 5000000 - 30000, dayMs: cooldown.seed.dayMs, count: 1 });
  const cooldownBody = JSON.parse(cooldown.init.body);
  assert.equal(cooldownBody.writes.length, 2);
  assert.equal(cooldownBody.writes[1].update.fields.count.integerValue, "2");

  const forgedCount = probes.find((p) => p.name === "forged-count");
  assert.equal(forgedCount.seed.count, 2);
  const forgedBody = JSON.parse(forgedCount.init.body);
  assert.equal(forgedBody.writes[1].update.fields.count.integerValue, "5");

  const sixthToday = probes.find((p) => p.name === "sixth-today");
  assert.equal(sixthToday.seed.count, 5);
  const sixthBody = JSON.parse(sixthToday.init.body);
  assert.equal(sixthBody.writes[1].update.fields.count.integerValue, "6");

  const otherLimitDoc = probes.find((p) => p.name === "other-limit-doc");
  assert.equal(otherLimitDoc.init.headers.Authorization, "Bearer atok000001");
  const otherBody = JSON.parse(otherLimitDoc.init.body);
  assert.match(otherBody.writes[1].update.name, /reportLimits\/buid000002$/);

  // no probe's request body or URL leaks a raw token string beyond the deliberate Authorization header
  for (const probe of probes) {
    const raw = JSON.stringify(probe.init);
    const bearerCount = (raw.match(/Bearer /g) || []).length;
    assert.ok(bearerCount <= 1, `${probe.name}: at most one Authorization header`);
  }
});

/* ---------------- runProbes ---------------- */

test("runProbes: every probe PASSes (403) against createFakeBoardFetch", async () => {
  const fake = createFakeBoardFetch({ config: VALID_CONFIG });
  const { report } = buildReportPayload(testReportInputs());
  const now = Date.now();
  const uidA = await signUp(fake, VALID_CONFIG);
  const uidB = await signUp(fake, VALID_CONFIG);
  const probes = buildProbes({ config: VALID_CONFIG, report, now, a: uidA, b: { uid: uidB.uid } });
  const results = await runProbes({ fetchFn: fake.fetchFn, admin: { token: FAKE_ADMIN_TOKEN, config: VALID_CONFIG }, probes });
  assert.equal(results.length, PROBE_NAMES.length);
  for (const r of results) {
    assert.equal(r.ok, true, `${r.name}: expected PASS (403), got ${r.status}`);
    assert.equal(r.status, 403);
  }
  // the seeded limit doc is cleaned up afterward
  assert.ok(!fake.limits().some((l) => l.uid === uidA.uid));
});

test("runProbes: every probe FAILs against a permissive stub that answers 200 to everything", async () => {
  const { report } = buildReportPayload(testReportInputs());
  const probes = buildProbes({
    config: VALID_CONFIG,
    report,
    now: Date.now(),
    a: { uid: "auid1", idToken: "atok1" },
    b: { uid: "buid2" },
  });
  const results = await runProbes({ fetchFn: permissiveFetch, admin: { token: "admintok", config: VALID_CONFIG }, probes });
  assert.equal(results.length, PROBE_NAMES.length);
  for (const r of results) {
    assert.equal(r.ok, false, `${r.name}: expected FAIL against the permissive stub`);
  }
  // an unexpected 200 on a report-creating probe attempts best-effort cleanup
  const extraFieldProbe = probes.find((p) => p.name === "extra-field");
  const extraFieldResult = results.find((r) => r.name === "extra-field");
  assert.equal(extraFieldResult.created, extraFieldProbe.reportId);
  assert.equal(extraFieldResult.cleaned, true);
  // list-read/list-limits are GET-only reads with no reportId: no cleanup attempted
  const listRead = results.find((r) => r.name === "list-read");
  assert.equal(listRead.created, undefined);
});

async function signUp(fake, config) {
  const res = await fake.fetchFn(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(config.apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ returnSecureToken: true }),
  });
  const json = await res.json();
  return { uid: json.localId, idToken: json.idToken };
}

/* ---------------- sendOnce ---------------- */

test("sendOnce: sends the [TEST] report through the shipped client code against the fake, then the account can be deleted", async () => {
  const fake = createFakeBoardFetch({ config: VALID_CONFIG });
  const { report } = buildReportPayload(testReportInputs());
  const { result, identity } = await sendOnce({ fetchFn: fake.fetchFn, config: VALID_CONFIG, report });
  assert.equal(result.ok, true);
  assert.equal(typeof result.id, "string");
  assert.equal(fake.users().length, 1);
  assert.equal(fake.reports().length, 1);
  const del = await identity.deleteAccount();
  assert.equal(del.ok, true);
  assert.equal(del.deleted, true);
  assert.equal(fake.users().length, 0);
});

/* ---------------- runProbeRules ---------------- */

test("runProbeRules: against the fake, all ten probes pass and both accounts are deleted", async () => {
  const fake = createFakeBoardFetch({ config: VALID_CONFIG });
  const { report } = buildReportPayload(testReportInputs());
  const { results, allPass, signInFailed } = await runProbeRules({
    fetchFn: fake.fetchFn,
    adminToken: FAKE_ADMIN_TOKEN,
    config: VALID_CONFIG,
    now: Date.now(),
    report,
  });
  assert.equal(signInFailed, false);
  assert.equal(allPass, true);
  assert.equal(results.length, PROBE_NAMES.length);
  assert.equal(fake.users().length, 0, "both probe accounts were deleted");
});

test("runProbeRules: against a permissive stub, allPass is false", async () => {
  const { report } = buildReportPayload(testReportInputs());
  const permissiveWithSignUp = async (u, init) => {
    if (typeof u === "string" && u.includes("accounts:signUp")) {
      return { ok: true, status: 200, json: async () => ({ idToken: "idtok", refreshToken: "rtok", expiresIn: "3600", localId: `uid${Math.random()}` }) };
    }
    if (typeof u === "string" && u.includes("accounts:delete")) {
      return { ok: true, status: 200, json: async () => ({}) };
    }
    return permissiveFetch(u, init);
  };
  const { results, allPass, signInFailed } = await runProbeRules({
    fetchFn: permissiveWithSignUp,
    adminToken: "admintok",
    config: VALID_CONFIG,
    now: Date.now(),
    report,
  });
  assert.equal(signInFailed, false);
  assert.equal(allPass, false);
  assert.equal(results.length, PROBE_NAMES.length);
});

/* ---------------- CLI ---------------- */

test("CLI --dry-run: exits 0, prints [TEST], the masked key, and the reportLimits write; never leaks the real key", () => {
  const result = runTool(["--dry-run"]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /\[TEST\]/);
  assert.match(result.stdout, /<key>/);
  assert.match(result.stdout, /reportLimits/);
  assert.doesNotMatch(result.stdout, /AIza/);
});

test("CLI no flag: while reporting is unavailable, exits 2 and says so", (t) => {
  if (reportingAvailable(BUG_REPORT_CONFIG)) {
    t.skip("BUG_REPORT_CONFIG.apiKey is already filled (83-08 landed) — this unavailable-path assertion no longer applies");
    return;
  }
  const result = runTool([]);
  assert.equal(result.status, 2);
  assert.match(result.stdout, /reporting unavailable/);
});

test("CLI --probe-rules: while reporting is unavailable, exits 2 and says so", (t) => {
  if (reportingAvailable(BUG_REPORT_CONFIG)) {
    t.skip("BUG_REPORT_CONFIG.apiKey is already filled (83-08 landed) — this unavailable-path assertion no longer applies");
    return;
  }
  const result = runTool(["--probe-rules"]);
  assert.equal(result.status, 2);
  assert.match(result.stdout, /reporting unavailable/);
});

test("CLI: an unknown flag exits 2", () => {
  const result = runTool(["--bogus"]);
  assert.equal(result.status, 2);
});

test("CLI: too many arguments exits 2", () => {
  const result = runTool(["--dry-run", "extra"]);
  assert.equal(result.status, 2);
});
