#!/usr/bin/env node
// tools/bug-reports/send-test-report.mjs
//
// Phase 79.3 (D-17) / Phase 83 (SRV-09, the todo "Bug report per-player
// limit and automatic Firestore cleanup"): the orchestrator's one-command
// test report and live rules probe. It runs the exact client code the app
// ships (src/browser/bugReport.js, src/browser/firebaseAuth.js) against the
// live Firestore project, so the live check proves what players' devices
// will actually do, not a re-implementation of it.
//
// Modes:
//   (no flag)      signs a fresh anonymous identity in (competeOn () =>
//                  true) and sends one clearly-marked [TEST] report through
//                  sendBugReport, prints {ok, id} as JSON, then deletes that
//                  anonymous account. Exit 0 on ok, 1 on a send failure, 2
//                  while reporting is unavailable (an empty or malformed
//                  apiKey).
//   --dry-run      prints the masked :commit endpoint (the key replaced by
//                  <key>) and the pretty-printed two-write commit body
//                  (report + limit step) with "<uid>"/"<id>" placeholders,
//                  without signing in or sending. Exit 0 even with an empty
//                  key.
//   --probe-rules  signs in two anonymous identities (a, b) and runs the
//                  ten probes buildProbes() describes, each expected
//                  refused with HTTP 403:
//                    list-read        a list read on bugReports
//                    extra-field      an authenticated commit whose report
//                                     carries a field the rules don't allow
//                    wrong-status     an authenticated commit whose report
//                                     status isn't "new"
//                    no-auth          the old-style plain unauthenticated
//                                     create (no legacy path — vc11 and
//                                     older are refused by design)
//                    no-limit-write   an authenticated create with no
//                                     same-commit reportLimits step
//                    cooldown         a second report inside the 2-minute
//                                     cooldown (a's reportLimits/{uid} is
//                                     seeded first)
//                    forged-count     a count that jumps past what the
//                                     cooldown-cleared step should be
//                    sixth-today      a 6th report in one UTC day (past
//                                     REPORT_DAILY_CAP)
//                    other-limit-doc  a's report commit whose limit write
//                                     targets b's reportLimits/{uid}
//                    list-limits      a list read on reportLimits
//                  Seeded probes (cooldown/forged-count/sixth-today) need
//                  the developer's own `gcloud` login — the admin token is
//                  obtained via `gcloud auth print-access-token` and every
//                  admin-authenticated request carries an
//                  X-Goog-User-Project header for the project's quota.
//                  Prints one "PASS name (403)" or "FAIL name (status)"
//                  line per probe (plus "created <id>, deleted" when an
//                  unexpected success needed best-effort cleanup), deletes
//                  both anonymous accounts, and exits 0 only when all ten
//                  passed. Exits 2 without a working gcloud admin token, or
//                  while reporting is unavailable.
//   anything else  prints usage and exits 2.
//
// Never prints the API key, an id token or a refresh token. Node built-ins
// and in-repo modules only — no network call happens merely by importing
// this file.

import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import { buildReportPayload, validateReport, reportingAvailable, sendBugReport } from "../../src/browser/bugReport.js";
import { BUG_REPORT_CONFIG } from "../../src/browser/bugReportConfig.js";
import { createIdentity } from "../../src/browser/firebaseAuth.js";
import { firestoreUrl, toFirestoreFields, docName } from "../../src/browser/firestoreRest.js";
import { REPORT_LIMITS_COLLECTION, buildReportCommit, utcDayMs } from "../../src/browser/reportLimits.js";

const UNAVAILABLE_MESSAGE = "reporting unavailable: set apiKey in src/browser/firebaseConfig.js";
const BUG_REPORTS_COLLECTION = "bugReports";

/** testReportInputs(now) — buildReportPayload inputs for one clearly-marked [TEST] report. */
export function testReportInputs(now = new Date()) {
  return {
    text: `[TEST] Phase 83 live end-to-end check. Safe to close. ${now.toISOString()}`,
    oracleEntries: [
      '[TEST] <span class="roll">d20: 20</span> the probe roll landed clean.',
      "[TEST] the live rules probe began.",
    ],
    version: "test",
    platform: "node",
    userAgent: `node ${process.version} (${process.platform})`,
    state: null,
    now,
  };
}

/** mapStorage() — an in-memory storage object matching src/browser/storage.js's async getItem/setItem/removeItem contract. */
function mapStorage() {
  const map = new Map();
  return {
    async getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    async setItem(key, value) {
      map.set(key, String(value));
    },
    async removeItem(key) {
      map.delete(key);
    },
  };
}

/** freshIdentity(fetchFn, config) — one anonymous identity over an in-memory storage, always Compete-ON so getToken() signs up without needing {explicit:true}. */
function freshIdentity(fetchFn, config = BUG_REPORT_CONFIG) {
  return createIdentity({ storage: mapStorage(), fetchFn, config, competeOn: () => true });
}

function bearerJsonInit(body, idToken) {
  const headers = { "Content-Type": "application/json" };
  if (idToken) headers.Authorization = `Bearer ${idToken}`;
  return { method: "POST", headers, body: JSON.stringify(body) };
}

function bearerGetInit(idToken) {
  const headers = {};
  if (idToken) headers.Authorization = `Bearer ${idToken}`;
  return { method: "GET", headers };
}

function reportOnlyWrite(config, id, report) {
  return { update: { name: docName(config, BUG_REPORTS_COLLECTION, id), fields: toFirestoreFields(report) }, currentDocument: { exists: false } };
}

function probeDocId(name, now) {
  return `probe${name.replace(/[^a-zA-Z0-9]/g, "")}${Math.trunc(now)}`.slice(0, 60);
}

/**
 * buildProbes({config, report, now, a, b}) — the ten named requests the
 * live rules must refuse with HTTP 403, in this order: list-read,
 * extra-field, wrong-status, no-auth, no-limit-write, cooldown,
 * forged-count, sixth-today, other-limit-doc, list-limits. `a` is
 * {uid, idToken} (the signed-in probe identity everything but
 * other-limit-doc runs as); `b` is {uid} (a second identity used only as
 * an off-target reportLimits write path). Pure: builds requests only —
 * seeding and cleanup are runProbes' job. Never throws.
 */
export function buildProbes({ config, report, now, a, b }) {
  const today = utcDayMs(now);
  const commitUrl = firestoreUrl(config, ":commit");
  const listUrl = (collection) => firestoreUrl(config, `/${collection}`);
  const freshStep = { create: true, dayMs: today, count: 1 };

  const extraFieldId = probeDocId("extrafield", now);
  const wrongStatusId = probeDocId("wrongstatus", now);
  const noAuthId = probeDocId("noauth", now);
  const noLimitWriteId = probeDocId("nolimitwrite", now);
  const cooldownId = probeDocId("cooldown", now);
  const forgedCountId = probeDocId("forgedcount", now);
  const sixthTodayId = probeDocId("sixthtoday", now);
  const otherLimitDocId = probeDocId("otherlimitdoc", now);

  return [
    { name: "list-read", url: listUrl(BUG_REPORTS_COLLECTION), init: bearerGetInit(a.idToken) },
    {
      name: "extra-field",
      url: commitUrl,
      init: bearerJsonInit(buildReportCommit(config, extraFieldId, { ...report, extra: "x" }, a.uid, freshStep), a.idToken),
      reportId: extraFieldId,
    },
    {
      name: "wrong-status",
      url: commitUrl,
      init: bearerJsonInit(buildReportCommit(config, wrongStatusId, { ...report, status: "filed" }, a.uid, freshStep), a.idToken),
      reportId: wrongStatusId,
    },
    {
      name: "no-auth",
      url: commitUrl,
      init: bearerJsonInit({ writes: [reportOnlyWrite(config, noAuthId, report)] }, undefined),
      reportId: noAuthId,
    },
    {
      name: "no-limit-write",
      url: commitUrl,
      init: bearerJsonInit({ writes: [reportOnlyWrite(config, noLimitWriteId, report)] }, a.idToken),
      reportId: noLimitWriteId,
    },
    {
      name: "cooldown",
      url: commitUrl,
      init: bearerJsonInit(buildReportCommit(config, cooldownId, report, a.uid, { create: false, dayMs: today, count: 2 }), a.idToken),
      reportId: cooldownId,
      seed: { uid: a.uid, lastMs: now - 30 * 1000, dayMs: today, count: 1 },
    },
    {
      name: "forged-count",
      url: commitUrl,
      init: bearerJsonInit(buildReportCommit(config, forgedCountId, report, a.uid, { create: false, dayMs: today, count: 5 }), a.idToken),
      reportId: forgedCountId,
      seed: { uid: a.uid, lastMs: now - 10 * 60 * 1000, dayMs: today, count: 2 },
    },
    {
      name: "sixth-today",
      url: commitUrl,
      init: bearerJsonInit(buildReportCommit(config, sixthTodayId, report, a.uid, { create: false, dayMs: today, count: 6 }), a.idToken),
      reportId: sixthTodayId,
      seed: { uid: a.uid, lastMs: now - 10 * 60 * 1000, dayMs: today, count: 5 },
    },
    {
      name: "other-limit-doc",
      url: commitUrl,
      init: bearerJsonInit(buildReportCommit(config, otherLimitDocId, report, b.uid, { create: true, dayMs: today, count: 1 }), a.idToken),
      reportId: otherLimitDocId,
    },
    { name: "list-limits", url: listUrl(REPORT_LIMITS_COLLECTION), init: bearerGetInit(a.idToken) },
  ];
}

function limitFields({ lastMs, dayMs, count }) {
  return {
    last: { timestampValue: new Date(lastMs).toISOString() },
    day: { timestampValue: new Date(dayMs).toISOString() },
    count: { integerValue: String(count) },
  };
}

function adminHeaders(admin, extra = {}) {
  return { Authorization: `Bearer ${admin.token}`, "X-Goog-User-Project": admin.config.projectId, ...extra };
}

/**
 * runProbes({fetchFn, admin, probes}) — admin is {token, config}. Seeds
 * reportLimits/{seed.uid} via an admin PATCH before any probe that carries
 * a `seed`, sends the probe, records `ok: true` only for an HTTP 403, and —
 * on an unexpected non-403 success — best-effort deletes the bugReports doc
 * the probe created (bugReports/{probe.reportId}, admin DELETE). In
 * `finally`, best-effort deletes every seeded reportLimits/{uid} (admin
 * DELETE), win or lose. Resolves an array of
 * { name, status, ok, created?, cleaned? }. Never throws.
 */
export async function runProbes({ fetchFn, admin, probes }) {
  const results = [];
  const seededUids = new Set();
  try {
    for (const probe of probes) {
      if (probe.seed) {
        seededUids.add(probe.seed.uid);
        try {
          await fetchFn(
            firestoreUrl(admin.config, `/${REPORT_LIMITS_COLLECTION}/${probe.seed.uid}`),
            { method: "PATCH", headers: adminHeaders(admin, { "Content-Type": "application/json" }), body: JSON.stringify({ fields: limitFields(probe.seed) }) },
          );
        } catch {
          // best-effort: the probe below still runs and reports what actually happened
        }
      }
      let outcome;
      try {
        const res = await fetchFn(probe.url, probe.init);
        outcome = { name: probe.name, status: res.status, ok: res.status === 403 };
        if (res.status !== 403 && res.status >= 200 && res.status < 300 && probe.reportId) {
          outcome.created = probe.reportId;
          try {
            await fetchFn(firestoreUrl(admin.config, `/${BUG_REPORTS_COLLECTION}/${probe.reportId}`), { method: "DELETE", headers: adminHeaders(admin) });
            outcome.cleaned = true;
          } catch {
            outcome.cleaned = false;
          }
        }
      } catch (err) {
        outcome = { name: probe.name, status: `error: ${err.message}`, ok: false };
      }
      results.push(outcome);
    }
  } finally {
    for (const uid of seededUids) {
      try {
        await fetchFn(firestoreUrl(admin.config, `/${REPORT_LIMITS_COLLECTION}/${uid}`), { method: "DELETE", headers: adminHeaders(admin) });
      } catch {
        // best-effort
      }
    }
  }
  return results;
}

/**
 * sendOnce({fetchFn, config, report}) — signs a fresh anonymous identity in
 * (competeOn () => true) and sends `report` through sendBugReport. Resolves
 * { result, identity } so the caller can delete the account afterward.
 */
export async function sendOnce({ fetchFn, config = BUG_REPORT_CONFIG, report }) {
  const identity = freshIdentity(fetchFn, config);
  const result = await sendBugReport(report, { fetchFn, config, identity });
  return { result, identity };
}

/**
 * runProbeRules({fetchFn, adminToken, config, now}) — signs in two fresh
 * anonymous identities (a, b), builds and runs the ten buildProbes(), then
 * deletes both accounts. Resolves { results, allPass }.
 */
export async function runProbeRules({ fetchFn, adminToken, config = BUG_REPORT_CONFIG, now = Date.now(), report }) {
  const identityA = freshIdentity(fetchFn, config);
  const identityB = freshIdentity(fetchFn, config);
  const tokenA = await identityA.getToken();
  const tokenB = await identityB.getToken();
  if (!tokenA.ok || !tokenB.ok) {
    return { results: [], allPass: false, signInFailed: true, reason: !tokenA.ok ? tokenA.reason : tokenB.reason };
  }
  const probes = buildProbes({
    config,
    report,
    now,
    a: { uid: tokenA.uid, idToken: tokenA.idToken },
    b: { uid: tokenB.uid },
  });
  const results = await runProbes({ fetchFn, admin: { token: adminToken, config }, probes });
  await identityA.deleteAccount();
  await identityB.deleteAccount();
  return { results, allPass: results.length === probes.length && results.every((r) => r.ok), signInFailed: false };
}

/**
 * adminAccessToken() — `gcloud auth print-access-token`, or null on any
 * failure. On Windows a Cloud SDK installed from the bash archive ships
 * only the `gcloud` shell script (no gcloud.cmd), which cmd.exe cannot run,
 * so a failed plain run is retried once through Git Bash — the same
 * tools/boards-admin.mjs#execGcloud pattern. Never throws.
 */
function adminAccessToken() {
  const cmd = "gcloud auth print-access-token";
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || null;
  } catch (err) {
    if (process.platform !== "win32") return null;
    try {
      return execSync(cmd, { encoding: "utf8", shell: "bash", stdio: ["ignore", "pipe", "ignore"] }).trim() || null;
    } catch {
      return null;
    }
  }
}

function printUsage() {
  console.log("usage: node tools/bug-reports/send-test-report.mjs [--dry-run | --probe-rules]");
}

async function main(argv) {
  const args = argv.slice(2);
  if (args.length > 1) {
    printUsage();
    return 2;
  }
  const flag = args[0];
  if (flag !== undefined && flag !== "--dry-run" && flag !== "--probe-rules") {
    printUsage();
    return 2;
  }

  const { report } = buildReportPayload(testReportInputs());

  if (flag === "--dry-run") {
    const maskedUrl = firestoreUrl(BUG_REPORT_CONFIG, ":commit").replace(/key=.*/, "key=<key>");
    console.log(maskedUrl);
    const commitBody = buildReportCommit(BUG_REPORT_CONFIG, "<id>", report, "<uid>", { create: true, dayMs: 0, count: 1 });
    console.log(JSON.stringify(commitBody, null, 2));
    return 0;
  }

  if (!reportingAvailable(BUG_REPORT_CONFIG)) {
    console.log(UNAVAILABLE_MESSAGE);
    return 2;
  }

  if (flag === "--probe-rules") {
    const adminToken = adminAccessToken();
    if (!adminToken) {
      console.log("no gcloud admin token available: run `gcloud auth login` and select the delve-die-repeat-6ba5f project first");
      return 2;
    }
    const { results, allPass, signInFailed, reason } = await runProbeRules({
      fetchFn: globalThis.fetch.bind(globalThis),
      adminToken,
      config: BUG_REPORT_CONFIG,
      now: Date.now(),
      report,
    });
    if (signInFailed) {
      console.log(`could not sign in a probe identity: ${reason}`);
      return 2;
    }
    for (const r of results) {
      if (r.ok) {
        console.log(`PASS ${r.name} (403)`);
      } else {
        console.log(`FAIL ${r.name} (${r.status})`);
        if (r.created) console.log(`created ${r.created}, ${r.cleaned ? "deleted" : "cleanup failed"}`);
      }
    }
    return allPass ? 0 : 1;
  }

  // no flag: send through the shipped client code (validateReport just proves the built payload is well-formed before we touch the network)
  if (validateReport(report).length > 0) {
    console.log("built payload failed its own shape check — this is a bug in testReportInputs/buildReportPayload");
    return 1;
  }
  const { result, identity } = await sendOnce({ fetchFn: globalThis.fetch.bind(globalThis), config: BUG_REPORT_CONFIG, report });
  console.log(JSON.stringify({ ok: result.ok, id: result.id ?? null }));
  await identity.deleteAccount();
  return result.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv)
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    });
}
