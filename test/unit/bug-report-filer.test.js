// test/unit/bug-report-filer.test.js
//
// Phase 79.3 (BUG-04) Plan 02 Task 2 — pins tools/bug-reports/file-issues.mjs:
// JWT auth (RS256 via node:crypto), the runQuery/lock/file/reconcile state
// machine, the per-run cap, the label-exists 422, the retry cap, dry run,
// and credential hygiene. Every Firestore/GitHub/OAuth call goes through a
// routing fake fetch; the clock is injected. No network, no real key.
//
// Task 3 appends the workflow-YAML text assertions at the bottom of this
// file (see the "bug-reports.yml" describe block).
//
// Phase 83 Plan 10 (SRV-11) extends the fake into a small in-memory
// Firestore: bugReports and reportLimits documents live in one `store`,
// and a generic structuredQuery evaluator (EQUAL/LESS_THAN fieldFilters,
// an AND compositeFilter, one orderBy, a limit) answers every `:runQuery`
// the filer sends — both the existing status == "new"/"filing" polling and
// the four SRV-11 cleanup sweeps. PATCH merges into the store (honouring
// `currentDocument.updateTime`); DELETE removes from the store.

import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { spawnSync } from "node:child_process";

import {
  LABEL,
  MAX_PER_RUN,
  STALE_FILING_MS,
  MAX_ATTEMPTS,
  DEFAULT_PROJECT_ID,
  REPORT_RETENTION_DAYS,
  LIMIT_RETENTION_DAYS,
  REPORT_RETENTION_MS,
  LIMIT_RETENTION_MS,
  MAX_DELETES_PER_RUN,
  signServiceAccountJwt,
  getAccessToken,
  runFiler,
} from "../../tools/bug-reports/file-issues.mjs";
import { issueTitle, issueBodyInfo, markerFor, decodeFirestoreValue } from "../../tools/bug-reports/issue-format.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const FILER_PATH = path.resolve(__dirname, "..", "..", "tools", "bug-reports", "file-issues.mjs");
const WORKFLOW_PATH = path.resolve(__dirname, "..", "..", ".github", "workflows", "bug-reports.yml");

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

const FAKE_SA = {
  type: "service_account",
  project_id: DEFAULT_PROJECT_ID,
  private_key_id: "fake-key-id-123",
  private_key: privateKey,
  client_email: "ddr-bug-reports@delve-die-repeat-6ba5f.iam.gserviceaccount.com",
};

const BASE_ENV = {
  FIREBASE_BUG_REPORTS_SA: JSON.stringify(FAKE_SA),
  GITHUB_TOKEN: "gh-token-under-test",
  GITHUB_REPOSITORY: "sheibeck/ddr",
};

const REPORT_FIELDS = {
  schema: 1,
  status: "new",
  text: "The rat ate my torch",
  oracle: "line one\nline two",
  oracleLines: 2,
  version: "2.1.0 (11)",
  platform: "android",
  device: "Pixel 7",
  clientTime: "2026-09-28T16:59:00.000Z",
};

// A ~120,000-char Oracle, guaranteed to trim under issueBodyInfo/GITHUB_BODY_MAX.
function bigOracle() {
  const lines = [];
  for (let i = 0; i < 3000; i++) lines.push(`line ${String(i).padStart(4, "0")} ${"x".repeat(33)}`);
  return lines.join("\n");
}

function encodeValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encodeValue) } };
  if (typeof v === "object") return { mapValue: { fields: encodeFields(v) } };
  return { stringValue: String(v) };
}
function encodeFields(obj) {
  const fields = {};
  for (const [k, val] of Object.entries(obj)) fields[k] = encodeValue(val);
  return fields;
}

/** A bugReports fixture doc: `raw.status` defaults to "new" (REPORT_FIELDS).
 * Pass `{ status: "filing", attempts: 1 }`, `{ status: "filed", oracleTrimmed:
 * ..., filedAt: ... }` or `{ status: "failed", failedAt: ... }` to build the
 * other states cleanup/reconcile tests need. */
function makeDoc(id, createTime, updateTime, extraFields = {}) {
  const raw = { ...REPORT_FIELDS, ...extraFields };
  return { id, createTime, updateTime, raw, fields: encodeFields(raw) };
}

/** A reportLimits/{uid} fixture doc. last/day are Firestore timestamps
 * (ISO strings), unlike bugReports' plain string filedAt/failedAt. */
function makeLimitDoc(uid, { last, day, count = 1 } = {}) {
  const raw = { last, day: day || last, count };
  return {
    id: uid,
    createTime: last,
    updateTime: last,
    raw,
    fields: {
      last: { timestampValue: raw.last },
      day: { timestampValue: raw.day },
      count: { integerValue: String(count) },
    },
  };
}

function jsonResponse(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}

function matchesFilter(raw, filter) {
  if (filter.fieldFilter) {
    const { field, op, value } = filter.fieldFilter;
    const actual = raw[field.fieldPath];
    const expected = decodeFirestoreValue(value);
    if (op === "EQUAL") return actual === expected;
    if (op === "LESS_THAN") return actual !== undefined && actual !== null && actual < expected;
    return false;
  }
  if (filter.compositeFilter) {
    return filter.compositeFilter.filters.every((f) => matchesFilter(raw, f));
  }
  return false;
}

/** Evaluates one structuredQuery against the fake's in-memory store:
 * EQUAL/LESS_THAN fieldFilters (optionally ANDed), one orderBy, a limit.
 * Generic enough to answer the status == "new"/"filing" polling queries and
 * all four SRV-11 cleanup sweeps identically. */
function evaluateStructuredQuery(store, sq) {
  const collectionId = sq.from[0].collectionId;
  let docs = Object.values(store[collectionId] || {}).map((d) => ({ ...d, collectionId }));
  if (sq.where) docs = docs.filter((d) => matchesFilter(d.raw, sq.where));
  if (sq.orderBy && sq.orderBy[0]) {
    const { field, direction } = sq.orderBy[0];
    const p = field.fieldPath;
    docs = docs.slice().sort((a, b) => {
      const av = a.raw[p];
      const bv = b.raw[p];
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return direction === "DESCENDING" ? -cmp : cmp;
    });
  }
  if (sq.limit) docs = docs.slice(0, sq.limit);
  return docs;
}

/** A routing fake fetch backed by an in-memory Firestore-shaped `store`
 * (`fetchFn.store`). Records every call as `{ method, url, body }` and
 * answers token / runQuery / labels / issues / Firestore PATCH+DELETE
 * requests from the given fixtures. */
function buildFakeFetch({
  bugReports = [],
  reportLimits = [],
  labelStatus = 201,
  issuePostHandler = null,
  recentIssues = [],
  patchHandler = null,
  accessToken = "FAKE_ACCESS_TOKEN",
} = {}) {
  const store = { bugReports: {}, reportLimits: {} };
  for (const d of bugReports) store.bugReports[d.id] = d;
  for (const d of reportLimits) store.reportLimits[d.id] = d;

  const calls = [];
  const fetchFn = async (inputUrl, opts = {}) => {
    const method = opts.method || "GET";
    const body = opts.body;
    const u = String(inputUrl);
    calls.push({ method, url: u, body });

    if (u === "https://oauth2.googleapis.com/token") {
      return jsonResponse(200, { access_token: accessToken, expires_in: 3600 });
    }

    if (u.endsWith(":runQuery") && method === "POST") {
      const parsed = JSON.parse(body);
      const docs = evaluateStructuredQuery(store, parsed.structuredQuery);
      const rows = docs.map((d) => ({
        document: {
          name: `projects/p/databases/(default)/documents/${d.collectionId}/${d.id}`,
          fields: d.fields,
          createTime: d.createTime,
          updateTime: d.updateTime,
        },
        readTime: "2026-09-28T17:10:00.000Z",
      }));
      return jsonResponse(200, rows);
    }

    if (u.includes("/labels") && method === "POST") {
      return jsonResponse(labelStatus, labelStatus === 422 ? { message: "already_exists" } : { name: LABEL });
    }

    if (u.includes("/issues") && method === "GET") {
      return jsonResponse(200, recentIssues);
    }

    if (u.includes("/issues") && method === "POST") {
      if (issuePostHandler) return issuePostHandler(JSON.parse(body));
      return jsonResponse(201, { number: 101, html_url: "https://github.com/sheibeck/ddr/issues/101" });
    }

    const patchMatch = /\/documents\/bugReports\/([^/?]+)\?/.exec(u);
    if (patchMatch && method === "PATCH") {
      if (patchHandler) {
        const custom = patchHandler(u, method, body);
        if (custom) return custom;
      }
      const id = patchMatch[1];
      const preconditionMatch = /currentDocument\.updateTime=([^&]+)/.exec(u);
      const doc = store.bugReports[id];
      if (preconditionMatch && doc && decodeURIComponent(preconditionMatch[1]) !== doc.updateTime) {
        return jsonResponse(400, { error: { status: "FAILED_PRECONDITION", message: "lost the lock" } });
      }
      if (doc) {
        const patched = JSON.parse(body).fields;
        for (const [k, v] of Object.entries(patched)) {
          doc.raw[k] = decodeFirestoreValue(v);
          doc.fields[k] = v;
        }
      }
      return jsonResponse(200, { name: "ok" });
    }

    const deleteMatch = /\/documents\/(bugReports|reportLimits)\/([^/?]+)$/.exec(u);
    if (deleteMatch && method === "DELETE") {
      const [, collectionId, id] = deleteMatch;
      delete store[collectionId][id];
      return jsonResponse(200, {});
    }

    throw new Error(`no fake route for ${method} ${u}`);
  };
  fetchFn.calls = calls;
  fetchFn.store = store;
  return fetchFn;
}

function classifyCall(call) {
  const u = call.url;
  if (u === "https://oauth2.googleapis.com/token") return "token";
  if (u.endsWith(":runQuery")) {
    const sq = JSON.parse(call.body).structuredQuery;
    const collectionId = sq.from[0].collectionId;
    const where = sq.where;
    if (where && where.fieldFilter && where.fieldFilter.field.fieldPath === "status" && where.fieldFilter.op === "EQUAL") {
      return `runQuery:${where.fieldFilter.value.stringValue}`;
    }
    return `runQuery:cleanup:${collectionId}`;
  }
  if (u.includes("/labels")) return "label";
  if (u.includes("/issues") && call.method === "GET") return "issuesGet";
  if (u.includes("/issues") && call.method === "POST") return "issuePost";
  if (u.includes("/documents/bugReports/") && call.method === "PATCH") {
    const status = JSON.parse(call.body).fields.status?.stringValue;
    if (status === "filing") return "lockPatch";
    if (status === "filed") return "filedPatch";
    if (status === "failed") return "failedPatch";
  }
  if (call.method === "DELETE") {
    const m = /\/documents\/(bugReports|reportLimits)\/([^/?]+)$/.exec(u);
    if (m) return `delete:${m[1]}`;
  }
  return `unknown:${u}`;
}

// ---------------------------------------------------------------------------
// JWT signing
// ---------------------------------------------------------------------------

test("signServiceAccountJwt returns a valid, verifiable RS256 JWT", () => {
  const jwt = signServiceAccountJwt(FAKE_SA, 1_700_000_000_000);
  const parts = jwt.split(".");
  assert.equal(parts.length, 3);

  const header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  assert.deepEqual(header, { alg: "RS256", typ: "JWT", kid: FAKE_SA.private_key_id });

  const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  assert.deepEqual(claims, {
    iss: FAKE_SA.client_email,
    sub: FAKE_SA.client_email,
    aud: "https://oauth2.googleapis.com/token",
    scope: "https://www.googleapis.com/auth/datastore",
    iat: 1700000000,
    exp: 1700003600,
  });

  const signingInput = `${parts[0]}.${parts[1]}`;
  const signature = Buffer.from(parts[2], "base64url");
  const verified = crypto.verify("RSA-SHA256", Buffer.from(signingInput, "utf8"), publicKey, signature);
  assert.equal(verified, true);
});

test("getAccessToken exchanges the signed JWT for a datastore access token", async () => {
  const fetchFn = buildFakeFetch({});
  const token = await getAccessToken({ sa: FAKE_SA, fetchFn, now: () => 1_700_000_000_000 });
  assert.equal(token, "FAKE_ACCESS_TOKEN");
  assert.equal(fetchFn.calls.length, 1);
  assert.equal(fetchFn.calls[0].method, "POST");
  assert.match(fetchFn.calls[0].body, /grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer/);
  assert.match(fetchFn.calls[0].body, /assertion=/);
});

// ---------------------------------------------------------------------------
// Happy path and call order
// ---------------------------------------------------------------------------

test("runFiler happy path: files one new doc whose Oracle fits, then deletes it, in the documented call order", async () => {
  const doc = makeDoc("doc1", "2026-09-28T17:00:00.000Z", "2026-09-28T17:00:00.000Z");
  const fetchFn = buildFakeFetch({ bugReports: [doc] });
  const result = await runFiler({ env: BASE_ENV, fetchFn, now: () => 1_700_000_100_000 });

  assert.equal(result.exitCode, 0);
  assert.deepEqual(result.filed, ["doc1"]);

  const kinds = fetchFn.calls.map(classifyCall);
  assert.deepEqual(kinds, [
    "token",
    "runQuery:new",
    "runQuery:filing",
    "lockPatch",
    "label",
    "issuePost",
    "filedPatch",
    "delete:bugReports",
    "runQuery:cleanup:bugReports",
    "runQuery:cleanup:bugReports",
    "runQuery:cleanup:bugReports",
    "runQuery:cleanup:reportLimits",
  ]);

  const lockCall = fetchFn.calls[3];
  assert.match(lockCall.url, /updateMask\.fieldPaths=status/);
  assert.match(lockCall.url, /updateMask\.fieldPaths=attempts/);
  assert.match(lockCall.url, /currentDocument\.updateTime=/);
  const lockBody = JSON.parse(lockCall.body);
  assert.equal(lockBody.fields.status.stringValue, "filing");
  assert.equal(lockBody.fields.attempts.integerValue, "1");

  const issuePostCall = fetchFn.calls[5];
  const issuePayload = JSON.parse(issuePostCall.body);
  assert.equal(issuePayload.title, issueTitle(REPORT_FIELDS));
  assert.deepEqual(issuePayload.labels, [LABEL]);
  assert.ok(issuePayload.body.startsWith(markerFor("doc1")));

  const filedPatchCall = fetchFn.calls[6];
  assert.doesNotMatch(filedPatchCall.url, /currentDocument\.updateTime=/);
  const filedBody = JSON.parse(filedPatchCall.body);
  assert.equal(filedBody.fields.status.stringValue, "filed");
  assert.equal(filedBody.fields.issueNumber.integerValue, "101");
  assert.equal(filedBody.fields.issueUrl.stringValue, "https://github.com/sheibeck/ddr/issues/101");
  assert.equal(filedBody.fields.filedAt.stringValue, new Date(1_700_000_100_000).toISOString());
  assert.equal(filedBody.fields.oracleTrimmed.booleanValue, false);

  const deleteCall = fetchFn.calls[7];
  assert.match(deleteCall.url, /\/documents\/bugReports\/doc1$/);
  assert.deepEqual(result.deleted, ["doc1 (filed-full)"]);
  assert.equal(fetchFn.store.bugReports.doc1, undefined);
});

test("filing a report whose Oracle is trimmed writes oracleTrimmed true, names the until-date, and is never deleted", async () => {
  const doc = makeDoc("doc1", "2026-09-28T17:00:00.000Z", "2026-09-28T17:00:00.000Z", { oracle: bigOracle() });
  const fetchFn = buildFakeFetch({ bugReports: [doc] });
  const nowMs = 1_700_000_100_000;
  const result = await runFiler({ env: BASE_ENV, fetchFn, now: () => nowMs });

  assert.deepEqual(result.filed, ["doc1"]);
  assert.deepEqual(result.deleted, []);
  assert.ok(fetchFn.store.bugReports.doc1, "the trimmed report's document must still exist");

  const issuePostCall = fetchFn.calls.find((c) => c.url.includes("/issues") && c.method === "POST");
  const issueBody = JSON.parse(issuePostCall.body).body;
  const expectedUntil = new Date(nowMs + REPORT_RETENTION_MS).toISOString().slice(0, 10);
  assert.match(issueBody, new RegExp(`until ${expectedUntil}`));

  const filedPatchCall = fetchFn.calls.find((c) => {
    if (c.method !== "PATCH") return false;
    const parsed = JSON.parse(c.body);
    return parsed.fields.status?.stringValue === "filed";
  });
  assert.equal(JSON.parse(filedPatchCall.body).fields.oracleTrimmed.booleanValue, true);

  const deleteCalls = fetchFn.calls.filter((c) => c.method === "DELETE");
  assert.equal(deleteCalls.length, 0);
});

test("the label POST returning 422 is ignored; the issue is still created", async () => {
  const doc = makeDoc("doc1", "2026-09-28T17:00:00.000Z", "2026-09-28T17:00:00.000Z");
  const fetchFn = buildFakeFetch({ bugReports: [doc], labelStatus: 422 });
  const result = await runFiler({ env: BASE_ENV, fetchFn, now: () => 1_700_000_100_000 });
  assert.equal(result.exitCode, 0);
  assert.deepEqual(result.filed, ["doc1"]);
});

test("the label POST happens at most once per run, and only when there is work", async () => {
  const docs = [
    makeDoc("doc1", "2026-09-28T17:00:00.000Z", "2026-09-28T17:00:00.000Z"),
    makeDoc("doc2", "2026-09-28T17:01:00.000Z", "2026-09-28T17:01:00.000Z"),
  ];
  const fetchFn = buildFakeFetch({ bugReports: docs });
  const result = await runFiler({ env: BASE_ENV, fetchFn, now: () => 1_700_000_200_000 });
  assert.equal(result.filed.length, 2);
  const labelCalls = fetchFn.calls.filter((c) => c.url.includes("/labels"));
  assert.equal(labelCalls.length, 1);
});

test("the label POST is never made when there is nothing to file", async () => {
  const fetchFn = buildFakeFetch({ bugReports: [] });
  const result = await runFiler({ env: BASE_ENV, fetchFn, now: () => 1_700_000_300_000 });
  assert.equal(result.exitCode, 0);
  const labelCalls = fetchFn.calls.filter((c) => c.url.includes("/labels"));
  assert.equal(labelCalls.length, 0);
});

// ---------------------------------------------------------------------------
// Idempotency: lost lock precondition
// ---------------------------------------------------------------------------

for (const status of [400, 409]) {
  test(`a lock PATCH answered with ${status} (FAILED_PRECONDITION-shaped) skips the doc without filing it`, async () => {
    const doc = makeDoc("doc1", "2026-09-28T17:00:00.000Z", "2026-09-28T17:00:00.000Z");
    const fetchFn = buildFakeFetch({
      bugReports: [doc],
      patchHandler: (patchUrl, method, body) => {
        const parsed = JSON.parse(body);
        if (parsed.fields.status?.stringValue === "filing") {
          return jsonResponse(status, { error: { status: "FAILED_PRECONDITION", message: "lost the lock" } });
        }
        return undefined;
      },
    });
    const result = await runFiler({ env: BASE_ENV, fetchFn, now: () => 1_700_000_400_000 });
    assert.deepEqual(result.skipped, ["doc1"]);
    assert.deepEqual(result.filed, []);
    const issuePosts = fetchFn.calls.filter((c) => c.url.includes("/issues") && c.method === "POST");
    assert.equal(issuePosts.length, 0);
  });
}

// ---------------------------------------------------------------------------
// Issue-creation failure leaves the doc in "filing"
// ---------------------------------------------------------------------------

test("an issue POST failing with 502 leaves the doc in filing (no revert patch), listed failed, exit code 1", async () => {
  const doc = makeDoc("doc1", "2026-09-28T17:00:00.000Z", "2026-09-28T17:00:00.000Z");
  const fetchFn = buildFakeFetch({
    bugReports: [doc],
    issuePostHandler: () => jsonResponse(502, { message: "bad gateway" }),
  });
  const result = await runFiler({ env: BASE_ENV, fetchFn, now: () => 1_700_000_500_000 });
  assert.deepEqual(result.failed, ["doc1"]);
  assert.equal(result.exitCode, 1);
  const patchCalls = fetchFn.calls.filter((c) => c.method === "PATCH");
  assert.equal(patchCalls.length, 1, "only the lock PATCH should have run, no revert/filed patch");
  assert.equal(JSON.parse(patchCalls[0].body).fields.status.stringValue, "filing");
  const deleteCalls = fetchFn.calls.filter((c) => c.method === "DELETE");
  assert.equal(deleteCalls.length, 0);
});

test("an issue POST that rejects also leaves the doc in filing, listed failed, exit code 1", async () => {
  const doc = makeDoc("doc1", "2026-09-28T17:00:00.000Z", "2026-09-28T17:00:00.000Z");
  const fetchFn = buildFakeFetch({
    bugReports: [doc],
    issuePostHandler: () => {
      throw new Error("network down");
    },
  });
  const result = await runFiler({ env: BASE_ENV, fetchFn, now: () => 1_700_000_500_000 });
  assert.deepEqual(result.failed, ["doc1"]);
  assert.equal(result.exitCode, 1);
});

// ---------------------------------------------------------------------------
// Per-run cap and ordering (filing)
// ---------------------------------------------------------------------------

test("with 25 new docs, only the oldest 20 by createTime are filed, even when runQuery returns them shuffled", async () => {
  const docs = [];
  for (let i = 0; i < 25; i++) {
    const t = new Date(1_700_000_000_000 + i * 1000).toISOString();
    docs.push(makeDoc(`doc${i}`, t, t));
  }
  const shuffled = docs.slice().sort((a, b) => (a.id < b.id ? 1 : -1));
  const fetchFn = buildFakeFetch({ bugReports: shuffled });
  const result = await runFiler({ env: BASE_ENV, fetchFn, now: () => 1_700_100_000_000 });
  assert.equal(result.filed.length, MAX_PER_RUN);
  const expectedOldest20 = docs.slice(0, MAX_PER_RUN).map((d) => d.id);
  assert.deepEqual(result.filed.slice().sort(), expectedOldest20.slice().sort());
});

// ---------------------------------------------------------------------------
// Stale-filing reconcile / retry / fail
// ---------------------------------------------------------------------------

const NOW_MS = 1_700_000_000_000;
const ELEVEN_MIN_AGO = new Date(NOW_MS - 11 * 60 * 1000).toISOString();
const FIVE_MIN_AGO = new Date(NOW_MS - 5 * 60 * 1000).toISOString();

test("a stale filing doc whose marker is on a listed issue is reconciled, no issue POST, oracleTrimmed(false) written, deleted immediately", async () => {
  const doc = makeDoc("doc1", ELEVEN_MIN_AGO, ELEVEN_MIN_AGO, { status: "filing", attempts: 1 });
  const fetchFn = buildFakeFetch({
    bugReports: [doc],
    recentIssues: [
      { number: 55, html_url: "https://github.com/sheibeck/ddr/issues/55", body: `${markerFor("doc1")}\nsomething` },
    ],
  });
  const result = await runFiler({ env: BASE_ENV, fetchFn, now: () => NOW_MS });
  assert.deepEqual(result.reconciled, ["doc1"]);
  const issuePosts = fetchFn.calls.filter((c) => c.url.includes("/issues") && c.method === "POST");
  assert.equal(issuePosts.length, 0);
  const filedPatchCall = fetchFn.calls.find((c) => c.method === "PATCH" && c.url.includes("bugReports/doc1"));
  const body = JSON.parse(filedPatchCall.body);
  assert.equal(body.fields.status.stringValue, "filed");
  assert.equal(body.fields.issueNumber.integerValue, "55");
  assert.equal(body.fields.issueUrl.stringValue, "https://github.com/sheibeck/ddr/issues/55");
  assert.equal(body.fields.oracleTrimmed.booleanValue, false);
  assert.doesNotMatch(filedPatchCall.url, /currentDocument\.updateTime=/);
  assert.ok(result.deleted.some((s) => s.startsWith("doc1")));
  assert.equal(fetchFn.store.bugReports.doc1, undefined);
});

test("a stale filing doc reconciled with a trimmed Oracle keeps its document (no delete)", async () => {
  const doc = makeDoc("doc1", ELEVEN_MIN_AGO, ELEVEN_MIN_AGO, { status: "filing", attempts: 1, oracle: bigOracle() });
  const fetchFn = buildFakeFetch({
    bugReports: [doc],
    recentIssues: [
      { number: 55, html_url: "https://github.com/sheibeck/ddr/issues/55", body: `${markerFor("doc1")}\nsomething` },
    ],
  });
  const result = await runFiler({ env: BASE_ENV, fetchFn, now: () => NOW_MS });
  assert.deepEqual(result.reconciled, ["doc1"]);
  const filedPatchCall = fetchFn.calls.find((c) => c.method === "PATCH" && c.url.includes("bugReports/doc1"));
  assert.equal(JSON.parse(filedPatchCall.body).fields.oracleTrimmed.booleanValue, true);
  assert.ok(fetchFn.store.bugReports.doc1);
  assert.equal(fetchFn.calls.filter((c) => c.method === "DELETE").length, 0);
});

test("a stale filing doc with no marker and attempts 1 is re-locked (attempts 2), filed, and patched", async () => {
  const doc = makeDoc("doc1", ELEVEN_MIN_AGO, ELEVEN_MIN_AGO, { status: "filing", attempts: 1 });
  const fetchFn = buildFakeFetch({ bugReports: [doc], recentIssues: [] });
  const result = await runFiler({ env: BASE_ENV, fetchFn, now: () => NOW_MS });
  assert.deepEqual(result.filed, ["doc1"]);
  const lockCalls = fetchFn.calls.filter(
    (c) => c.method === "PATCH" && JSON.parse(c.body).fields.status?.stringValue === "filing",
  );
  assert.equal(lockCalls.length, 1);
  assert.equal(JSON.parse(lockCalls[0].body).fields.attempts.integerValue, "2");
  assert.match(lockCalls[0].url, /currentDocument\.updateTime=/);
});

test(`a stale filing doc with no marker at MAX_ATTEMPTS (${MAX_ATTEMPTS}) is marked failed with failedAt, not filed`, async () => {
  const doc = makeDoc("doc1", ELEVEN_MIN_AGO, ELEVEN_MIN_AGO, { status: "filing", attempts: MAX_ATTEMPTS });
  const fetchFn = buildFakeFetch({ bugReports: [doc], recentIssues: [] });
  const result = await runFiler({ env: BASE_ENV, fetchFn, now: () => NOW_MS });
  assert.deepEqual(result.failed, ["doc1"]);
  assert.deepEqual(result.filed, []);
  const issuePosts = fetchFn.calls.filter((c) => c.url.includes("/issues") && c.method === "POST");
  assert.equal(issuePosts.length, 0);
  const failedPatchCall = fetchFn.calls.find((c) => c.method === "PATCH" && c.url.includes("bugReports/doc1"));
  const body = JSON.parse(failedPatchCall.body);
  assert.equal(body.fields.status.stringValue, "failed");
  assert.equal(body.fields.failedAt.stringValue, new Date(NOW_MS).toISOString());
});

test("a filing doc updated 5 minutes ago is left untouched", async () => {
  const doc = makeDoc("doc1", FIVE_MIN_AGO, FIVE_MIN_AGO, { status: "filing", attempts: 1 });
  assert.ok(NOW_MS - Date.parse(FIVE_MIN_AGO) < STALE_FILING_MS);
  const fetchFn = buildFakeFetch({ bugReports: [doc] });
  const result = await runFiler({ env: BASE_ENV, fetchFn, now: () => NOW_MS });
  assert.deepEqual(result.filed, []);
  assert.deepEqual(result.reconciled, []);
  assert.deepEqual(result.skipped, []);
  assert.deepEqual(result.failed, []);
  const patchCalls = fetchFn.calls.filter((c) => c.method === "PATCH");
  assert.equal(patchCalls.length, 0);
  const issuesGetCalls = fetchFn.calls.filter((c) => c.url.includes("/issues") && c.method === "GET");
  assert.equal(issuesGetCalls.length, 0);
});

// ---------------------------------------------------------------------------
// SRV-11 cleanup: retention boundaries
// ---------------------------------------------------------------------------

test("a filed trimmed doc: filedAt 30 days minus 1ms old is kept; 30 days plus 1ms old is deleted", async () => {
  const kept = makeDoc("kept1", "2020-01-01T00:00:00.000Z", "2020-01-01T00:00:00.000Z", {
    status: "filed",
    oracleTrimmed: true,
    filedAt: new Date(NOW_MS - REPORT_RETENTION_MS + 1).toISOString(),
  });
  const gone = makeDoc("gone1", "2020-01-01T00:00:00.000Z", "2020-01-01T00:00:00.000Z", {
    status: "filed",
    oracleTrimmed: true,
    filedAt: new Date(NOW_MS - REPORT_RETENTION_MS - 1).toISOString(),
  });
  const fetchFn = buildFakeFetch({ bugReports: [kept, gone] });
  const result = await runFiler({ env: BASE_ENV, fetchFn, now: () => NOW_MS });
  assert.ok(result.deleted.some((s) => s.startsWith("gone1")));
  assert.ok(!result.deleted.some((s) => s.startsWith("kept1")));
  assert.ok(fetchFn.store.bugReports.kept1);
  assert.equal(fetchFn.store.bugReports.gone1, undefined);
});

test("a failed doc: failedAt 30 days minus 1ms old is kept; 30 days plus 1ms old is deleted", async () => {
  const kept = makeDoc("kept2", "2020-01-01T00:00:00.000Z", "2020-01-01T00:00:00.000Z", {
    status: "failed",
    failedAt: new Date(NOW_MS - REPORT_RETENTION_MS + 1).toISOString(),
  });
  const gone = makeDoc("gone2", "2020-01-01T00:00:00.000Z", "2020-01-01T00:00:00.000Z", {
    status: "failed",
    failedAt: new Date(NOW_MS - REPORT_RETENTION_MS - 1).toISOString(),
  });
  const fetchFn = buildFakeFetch({ bugReports: [kept, gone] });
  const result = await runFiler({ env: BASE_ENV, fetchFn, now: () => NOW_MS });
  assert.ok(result.deleted.some((s) => s.startsWith("gone2")));
  assert.ok(!result.deleted.some((s) => s.startsWith("kept2")));
  assert.ok(fetchFn.store.bugReports.kept2);
  assert.equal(fetchFn.store.bugReports.gone2, undefined);
});

test("a reportLimits doc: last 2 days minus 1ms old is kept; 2 days plus 1ms old is deleted, and never appears in a log line", async () => {
  const kept = makeLimitDoc("uidKeepMe", { last: new Date(NOW_MS - LIMIT_RETENTION_MS + 1).toISOString() });
  const gone = makeLimitDoc("uidDeleteMe", { last: new Date(NOW_MS - LIMIT_RETENTION_MS - 1).toISOString() });
  const fetchFn = buildFakeFetch({ reportLimits: [kept, gone] });
  const logs = [];
  const result = await runFiler({ env: BASE_ENV, fetchFn, now: () => NOW_MS, log: (l) => logs.push(l) });
  assert.deepEqual(result.deleted, ["limit"]);
  assert.ok(fetchFn.store.reportLimits.uidKeepMe);
  assert.equal(fetchFn.store.reportLimits.uidDeleteMe, undefined);
  const joined = logs.join("\n");
  assert.doesNotMatch(joined, /uidKeepMe|uidDeleteMe/);
});

test("Q1 deletes a leftover filed doc with oracleTrimmed false (the immediate delete never happened for it)", async () => {
  const leftover = makeDoc("leftover1", "2020-01-01T00:00:00.000Z", "2020-01-01T00:00:00.000Z", {
    status: "filed",
    oracleTrimmed: false,
    filedAt: new Date(NOW_MS - 1000).toISOString(), // recent -- would NOT match Q2's expiry filter
  });
  const fetchFn = buildFakeFetch({ bugReports: [leftover] });
  const result = await runFiler({ env: BASE_ENV, fetchFn, now: () => NOW_MS });
  assert.deepEqual(result.deleted, ["leftover1 (filed-full)"]);
  assert.equal(fetchFn.store.bugReports.leftover1, undefined);
});

test("new and filing documents are never deleted by the cleanup sweeps, however old", async () => {
  // maxPerRun: 0 keeps "new1" unfiled (still status "new"); "filing1"'s
  // updateTime is within STALE_FILING_MS so the reconcile loop leaves it
  // alone too. Neither status is ever matched by the Q1-Q4 cleanup
  // queries (they filter status == "filed"/"failed" only), however old
  // createTime is -- this proves cleanup never touches either by age.
  const ancientNew = makeDoc("new1", "2000-01-01T00:00:00.000Z", "2000-01-01T00:00:00.000Z", { status: "new" });
  const inFlightFiling = makeDoc("filing1", "2000-01-01T00:00:00.000Z", FIVE_MIN_AGO, {
    status: "filing",
    attempts: 1,
  });
  const fetchFn = buildFakeFetch({ bugReports: [ancientNew, inFlightFiling] });
  const result = await runFiler({ env: BASE_ENV, fetchFn, now: () => NOW_MS, maxPerRun: 0 });
  assert.deepEqual(result.deleted, []);
  assert.deepEqual(result.filed, []);
  assert.ok(fetchFn.store.bugReports.new1, "an ancient 'new' document must never be deleted by cleanup");
  assert.ok(fetchFn.store.bugReports.filing1, "an in-flight 'filing' document must never be deleted by cleanup");
});

// ---------------------------------------------------------------------------
// SRV-11 cleanup: the 100-delete cap
// ---------------------------------------------------------------------------

test("with 150 eligible expired filed docs, exactly 100 are deleted (oldest filedAt first) and the rest wait", async () => {
  const docs = [];
  for (let i = 0; i < 150; i++) {
    const filedAt = new Date(NOW_MS - REPORT_RETENTION_MS - (150 - i) * 1000).toISOString();
    docs.push(
      makeDoc(`doc${i}`, "2020-01-01T00:00:00.000Z", "2020-01-01T00:00:00.000Z", {
        status: "filed",
        oracleTrimmed: true,
        filedAt,
      }),
    );
  }
  const fetchFn = buildFakeFetch({ bugReports: docs });
  const result = await runFiler({ env: BASE_ENV, fetchFn, now: () => NOW_MS });
  assert.equal(result.deleted.length, MAX_DELETES_PER_RUN);
  const deletedIds = result.deleted.map((s) => s.split(" ")[0]).sort();
  const expectedOldest100 = Array.from({ length: 100 }, (_, i) => `doc${i}`).sort();
  assert.deepEqual(deletedIds, expectedOldest100);
  assert.equal(Object.keys(fetchFn.store.bugReports).length, 50);
});

// ---------------------------------------------------------------------------
// SRV-11 cleanup: DELETE failure doesn't stop the run
// ---------------------------------------------------------------------------

test("a failed DELETE logs a warning with the HTTP status and does not stop the run or the exit code", async () => {
  const gone = makeDoc("gone3", "2020-01-01T00:00:00.000Z", "2020-01-01T00:00:00.000Z", {
    status: "filed",
    oracleTrimmed: true,
    filedAt: new Date(NOW_MS - REPORT_RETENTION_MS - 1).toISOString(),
  });
  const fetchFn = buildFakeFetch({ bugReports: [gone] });
  const originalFetch = fetchFn;
  const failingFetch = async (inputUrl, opts = {}) => {
    if ((opts.method || "GET") === "DELETE") return jsonResponse(500, { message: "internal error" });
    return originalFetch(inputUrl, opts);
  };
  const logs = [];
  const result = await runFiler({ env: BASE_ENV, fetchFn: failingFetch, now: () => NOW_MS, log: (l) => logs.push(l) });
  assert.equal(result.exitCode, 0);
  assert.deepEqual(result.deleted, []);
  assert.ok(logs.some((l) => l.includes("warning: DELETE bugReports/gone3 returned HTTP 500")));
});

// ---------------------------------------------------------------------------
// SRV-11 cleanup: dry run
// ---------------------------------------------------------------------------

test("SRV-11 dry run: zero DELETE calls, one 'would delete <id> (<reason>)' line per planned deletion, limit docs redacted", async () => {
  const goneReport = makeDoc("gone4", "2020-01-01T00:00:00.000Z", "2020-01-01T00:00:00.000Z", {
    status: "filed",
    oracleTrimmed: true,
    filedAt: new Date(NOW_MS - REPORT_RETENTION_MS - 1).toISOString(),
  });
  const goneLimit = makeLimitDoc("uidRedacted", { last: new Date(NOW_MS - LIMIT_RETENTION_MS - 1).toISOString() });
  const fetchFn = buildFakeFetch({ bugReports: [goneReport], reportLimits: [goneLimit] });
  const logs = [];
  const result = await runFiler({
    env: BASE_ENV,
    fetchFn,
    now: () => NOW_MS,
    log: (l) => logs.push(l),
    dryRun: true,
  });
  assert.equal(result.exitCode, 0);
  const deleteCalls = fetchFn.calls.filter((c) => c.method === "DELETE");
  assert.equal(deleteCalls.length, 0);
  assert.ok(fetchFn.store.bugReports.gone4, "dry run must delete nothing");
  assert.ok(fetchFn.store.reportLimits.uidRedacted, "dry run must delete nothing");
  assert.ok(logs.includes("would delete gone4 (filed-expired)"));
  assert.ok(logs.includes("would delete reportLimits/<redacted> (limit-expired)"));
  const joined = logs.join("\n");
  assert.doesNotMatch(joined, /uidRedacted/);
});

// ---------------------------------------------------------------------------
// SRV-11 cleanup: the CLI summary line
// ---------------------------------------------------------------------------

test("CLI source: main()'s summary format includes a 'deleted' line built from result.deleted", () => {
  // main() isn't independently invokable with an injected fetch (it always
  // binds globalThis.fetch), so this pins the source text of its summary
  // block directly rather than spawning a live network call.
  const src = fs.readFileSync(FILER_PATH, "utf8");
  assert.match(src, /summarize\("deleted", result\.deleted\)/);
});

test("summary format: 'deleted N [...]' lists bugReports ids with their reason, and 'limit' for reportLimits", () => {
  // Pins the exact summarize() shape main() uses, against representative
  // runFiler() output (a filed-full delete and a limit-expired delete).
  const deleted = ["a (filed-full)", "limit"];
  const summarize = (label, list) => `${label} ${list.length} [${list.join(", ")}]`;
  assert.equal(summarize("deleted", deleted), "deleted 2 [a (filed-full), limit]");
});

// ---------------------------------------------------------------------------
// Missing secret / malformed input / credential hygiene
// ---------------------------------------------------------------------------

test("no FIREBASE_BUG_REPORTS_SA gives { skipped: 'no-secret' }, exit 0, no fetch call", async () => {
  const fetchFn = buildFakeFetch({});
  const result = await runFiler({ env: {}, fetchFn, now: () => 1_700_000_000_000 });
  assert.equal(result.skipped, "no-secret");
  assert.equal(result.exitCode, 0);
  assert.equal(fetchFn.calls.length, 0);
});

test("a malformed service-account JSON exits 1 with no key material logged", async () => {
  const fetchFn = buildFakeFetch({});
  const logs = [];
  const result = await runFiler({
    env: { FIREBASE_BUG_REPORTS_SA: "{not valid json", GITHUB_REPOSITORY: "sheibeck/ddr" },
    fetchFn,
    now: () => 1_700_000_000_000,
    log: (l) => logs.push(l),
  });
  assert.equal(result.exitCode, 1);
  assert.equal(fetchFn.calls.length, 0);
  const joined = logs.join("\n");
  assert.doesNotMatch(joined, /BEGIN (RSA )?PRIVATE KEY/);
  assert.doesNotMatch(joined, /not valid json/);
});

test("a malformed GITHUB_REPOSITORY exits 1", async () => {
  const fetchFn = buildFakeFetch({});
  const result = await runFiler({
    env: { FIREBASE_BUG_REPORTS_SA: JSON.stringify(FAKE_SA), GITHUB_REPOSITORY: "not-a-valid-repo" },
    fetchFn,
    now: () => 1_700_000_000_000,
  });
  assert.equal(result.exitCode, 1);
});

test("no logged line ever contains the access token, the private key, or GITHUB_TOKEN", async () => {
  const doc = makeDoc("doc1", "2026-09-28T17:00:00.000Z", "2026-09-28T17:00:00.000Z");
  const fetchFn = buildFakeFetch({ bugReports: [doc], accessToken: "SUPER_SECRET_ACCESS_TOKEN" });
  const logs = [];
  await runFiler({
    env: { ...BASE_ENV, GITHUB_TOKEN: "ghp_super_secret_token_value" },
    fetchFn,
    now: () => 1_700_000_100_000,
    log: (l) => logs.push(l),
    dryRun: true,
  });
  const joined = logs.join("\n");
  assert.doesNotMatch(joined, /ghp_super_secret_token_value/);
  assert.doesNotMatch(joined, /SUPER_SECRET_ACCESS_TOKEN/);
  assert.doesNotMatch(joined, /BEGIN (RSA )?PRIVATE KEY/);
});

// ---------------------------------------------------------------------------
// Dry run (filing preview)
// ---------------------------------------------------------------------------

test("dry run makes zero Firestore PATCH/DELETE and zero GitHub POST calls, and logs a would-file line", async () => {
  const doc = makeDoc("doc1", "2026-09-28T17:00:00.000Z", "2026-09-28T17:00:00.000Z");
  const fetchFn = buildFakeFetch({ bugReports: [doc] });
  const logs = [];
  const result = await runFiler({
    env: BASE_ENV,
    fetchFn,
    now: () => 1_700_000_100_000,
    log: (line) => logs.push(line),
    dryRun: true,
  });
  assert.equal(result.exitCode, 0);
  const patchCalls = fetchFn.calls.filter((c) => c.method === "PATCH");
  assert.equal(patchCalls.length, 0);
  const deleteCalls = fetchFn.calls.filter((c) => c.method === "DELETE");
  assert.equal(deleteCalls.length, 0);
  const githubPosts = fetchFn.calls.filter((c) => c.method === "POST" && c.url.includes("api.github.com"));
  assert.equal(githubPosts.length, 0);

  const expectedTitle = issueTitle(REPORT_FIELDS);
  const keepUntil = new Date(1_700_000_100_000 + REPORT_RETENTION_MS).toISOString().slice(0, 10);
  const expectedInfo = issueBodyInfo(REPORT_FIELDS, { docId: "doc1", createTime: doc.createTime, keepUntil });
  const expectedLine = `would file doc1: ${expectedTitle} (${expectedInfo.body.length} chars)`;
  assert.ok(logs.includes(expectedLine), `expected ${JSON.stringify(expectedLine)}, got ${JSON.stringify(logs)}`);
});

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

test("CLI: running without FIREBASE_BUG_REPORTS_SA prints a warning and exits 0", () => {
  const env = { ...process.env };
  delete env.FIREBASE_BUG_REPORTS_SA;
  delete env.DRY_RUN;
  const res = spawnSync(process.execPath, [FILER_PATH], { env, encoding: "utf8" });
  assert.equal(res.status, 0);
  assert.match(res.stdout, /::warning::FIREBASE_BUG_REPORTS_SA is not set; no reports were read/);
});

test("every import specifier in the filer and the formatter starts with node: or ./", () => {
  for (const p of [
    FILER_PATH,
    path.resolve(__dirname, "..", "..", "tools", "bug-reports", "issue-format.mjs"),
  ]) {
    const src = fs.readFileSync(p, "utf8");
    const specifiers = [...src.matchAll(/^import .* from\s+["']([^"']+)["'];?\s*$/gm)].map((m) => m[1]);
    for (const spec of specifiers) {
      assert.ok(
        spec.startsWith("node:") || spec.startsWith("./"),
        `${p} imports "${spec}", which is neither a node: builtin nor a relative path`,
      );
    }
  }
});

// ---------------------------------------------------------------------------
// Retention constants
// ---------------------------------------------------------------------------

test("retention constants: 30 report days, 2 limit days, and their millisecond derivations", () => {
  assert.equal(REPORT_RETENTION_DAYS, 30);
  assert.equal(LIMIT_RETENTION_DAYS, 2);
  assert.equal(REPORT_RETENTION_MS, 30 * 24 * 60 * 60 * 1000);
  assert.equal(LIMIT_RETENTION_MS, 2 * 24 * 60 * 60 * 1000);
  assert.equal(MAX_DELETES_PER_RUN, 100);
});

// ---------------------------------------------------------------------------
// Task 3: the workflow file
// ---------------------------------------------------------------------------

test("bug-reports.yml: the scheduled/manual workflow is shaped as documented, with no npm install and no unsafe run: interpolation", () => {
  const yaml = fs.readFileSync(WORKFLOW_PATH, "utf8");

  for (const needle of [
    "7,19,33,52 * * * *", // user, 2026-09-28: four off-peak runs an hour
    "workflow_dispatch:",
    "dry_run",
    "issues: write",
    "contents: read",
    "concurrency:",
    'node-version: "22"',
    "node tools/bug-reports/file-issues.mjs",
    "secrets.FIREBASE_BUG_REPORTS_SA",
    "secrets.GITHUB_TOKEN",
  ]) {
    assert.ok(yaml.includes(needle), `bug-reports.yml should contain ${JSON.stringify(needle)}`);
  }

  // No package-manager install subcommand and no package runner.
  assert.doesNotMatch(yaml, /npm (ci|install)/);
  assert.doesNotMatch(yaml, /\bnpx\b/);
  assert.doesNotMatch(yaml, /\byarn\b/);

  // No run: line interpolates a workflow expression (dry_run reaches the
  // script only through env:).
  const runLines = yaml.split("\n").filter((line) => /^\s*run:/.test(line));
  assert.ok(runLines.length > 0, "the workflow should have at least one run: step");
  for (const line of runLines) {
    assert.doesNotMatch(line, /\$\{\{/, `a run: line must not interpolate a workflow expression: ${line}`);
  }

  // Exactly one occurrence of the cron string (the acceptance grep expects 1).
  const occurrences = yaml.split("7,19,33,52 * * * *").length - 1;
  assert.equal(occurrences, 1);
});
