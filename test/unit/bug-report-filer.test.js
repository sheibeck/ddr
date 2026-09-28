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
  signServiceAccountJwt,
  getAccessToken,
  runFiler,
} from "../../tools/bug-reports/file-issues.mjs";
import { issueTitle, issueBody, markerFor } from "../../tools/bug-reports/issue-format.mjs";

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

function makeDoc(id, createTime, updateTime, extraFields = {}) {
  return {
    id,
    createTime,
    updateTime,
    fields: encodeFields({ ...REPORT_FIELDS, ...extraFields }),
  };
}

function fromBase64url(str) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  return Buffer.from(b64 + pad, "base64");
}

function jsonResponse(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}

/** A routing fake fetch. Records every call as { method, url, body } and
 * answers token / runQuery / labels / issues / Firestore-PATCH requests
 * from the given fixtures. */
function buildFakeFetch({
  newDocs = [],
  filingDocs = [],
  labelStatus = 201,
  issuePostHandler = null,
  recentIssues = [],
  patchHandler = null,
  accessToken = "FAKE_ACCESS_TOKEN",
} = {}) {
  const calls = [];
  const fetchFn = async (inputUrl, opts = {}) => {
    const method = opts.method || "GET";
    const body = opts.body;
    const u = String(inputUrl);
    calls.push({ method, url: u, body });

    if (u === "https://oauth2.googleapis.com/token") {
      return jsonResponse(200, { access_token: accessToken, expires_in: 3600 });
    }

    if (u.endsWith(":runQuery")) {
      const parsed = JSON.parse(body);
      const status = parsed.structuredQuery.where.fieldFilter.value.stringValue;
      const docs = status === "new" ? newDocs : status === "filing" ? filingDocs : [];
      const rows = docs.map((d) => ({
        document: {
          name: `projects/p/databases/(default)/documents/bugReports/${d.id}`,
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

    if (u.includes("/documents/bugReports/") && method === "PATCH") {
      if (patchHandler) {
        const custom = patchHandler(u, method, body);
        if (custom) return custom;
      }
      return jsonResponse(200, { name: "ok" });
    }

    throw new Error(`no fake route for ${method} ${u}`);
  };
  fetchFn.calls = calls;
  return fetchFn;
}

function classifyCall(call) {
  const u = call.url;
  if (u === "https://oauth2.googleapis.com/token") return "token";
  if (u.endsWith(":runQuery")) {
    const status = JSON.parse(call.body).structuredQuery.where.fieldFilter.value.stringValue;
    return `runQuery:${status}`;
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
  return `unknown:${u}`;
}

// ---------------------------------------------------------------------------
// JWT signing
// ---------------------------------------------------------------------------

test("signServiceAccountJwt returns a valid, verifiable RS256 JWT", () => {
  const jwt = signServiceAccountJwt(FAKE_SA, 1_700_000_000_000);
  const parts = jwt.split(".");
  assert.equal(parts.length, 3);

  const header = JSON.parse(fromBase64url(parts[0]).toString("utf8"));
  assert.deepEqual(header, { alg: "RS256", typ: "JWT", kid: FAKE_SA.private_key_id });

  const claims = JSON.parse(fromBase64url(parts[1]).toString("utf8"));
  assert.deepEqual(claims, {
    iss: FAKE_SA.client_email,
    sub: FAKE_SA.client_email,
    aud: "https://oauth2.googleapis.com/token",
    scope: "https://www.googleapis.com/auth/datastore",
    iat: 1700000000,
    exp: 1700003600,
  });

  const signingInput = `${parts[0]}.${parts[1]}`;
  const signature = fromBase64url(parts[2]);
  const verified = crypto.verify(
    "RSA-SHA256",
    Buffer.from(signingInput, "utf8"),
    publicKey,
    signature,
  );
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

test("runFiler happy path: files one new doc in the documented call order", async () => {
  const doc = makeDoc("doc1", "2026-09-28T17:00:00.000Z", "2026-09-28T17:00:00.000Z");
  const fetchFn = buildFakeFetch({ newDocs: [doc], filingDocs: [] });
  const result = await runFiler({ env: BASE_ENV, fetchFn, now: () => 1_700_000_100_000 });

  assert.equal(result.exitCode, 0);
  assert.deepEqual(result.filed, ["doc1"]);

  const kinds = fetchFn.calls.map(classifyCall);
  assert.deepEqual(kinds, ["token", "runQuery:new", "runQuery:filing", "lockPatch", "label", "issuePost", "filedPatch"]);

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
});

test("the label POST returning 422 is ignored; the issue is still created", async () => {
  const doc = makeDoc("doc1", "2026-09-28T17:00:00.000Z", "2026-09-28T17:00:00.000Z");
  const fetchFn = buildFakeFetch({ newDocs: [doc], filingDocs: [], labelStatus: 422 });
  const result = await runFiler({ env: BASE_ENV, fetchFn, now: () => 1_700_000_100_000 });
  assert.equal(result.exitCode, 0);
  assert.deepEqual(result.filed, ["doc1"]);
});

test("the label POST happens at most once per run, and only when there is work", async () => {
  const docs = [
    makeDoc("doc1", "2026-09-28T17:00:00.000Z", "2026-09-28T17:00:00.000Z"),
    makeDoc("doc2", "2026-09-28T17:01:00.000Z", "2026-09-28T17:01:00.000Z"),
  ];
  const fetchFn = buildFakeFetch({ newDocs: docs, filingDocs: [] });
  const result = await runFiler({ env: BASE_ENV, fetchFn, now: () => 1_700_000_200_000 });
  assert.equal(result.filed.length, 2);
  const labelCalls = fetchFn.calls.filter((c) => c.url.includes("/labels"));
  assert.equal(labelCalls.length, 1);
});

test("the label POST is never made when there is nothing to file", async () => {
  const fetchFn = buildFakeFetch({ newDocs: [], filingDocs: [] });
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
      newDocs: [doc],
      filingDocs: [],
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
    newDocs: [doc],
    filingDocs: [],
    issuePostHandler: () => jsonResponse(502, { message: "bad gateway" }),
  });
  const result = await runFiler({ env: BASE_ENV, fetchFn, now: () => 1_700_000_500_000 });
  assert.deepEqual(result.failed, ["doc1"]);
  assert.equal(result.exitCode, 1);
  const patchCalls = fetchFn.calls.filter((c) => c.method === "PATCH");
  assert.equal(patchCalls.length, 1, "only the lock PATCH should have run, no revert/filed patch");
  assert.equal(JSON.parse(patchCalls[0].body).fields.status.stringValue, "filing");
});

test("an issue POST that rejects also leaves the doc in filing, listed failed, exit code 1", async () => {
  const doc = makeDoc("doc1", "2026-09-28T17:00:00.000Z", "2026-09-28T17:00:00.000Z");
  const fetchFn = buildFakeFetch({
    newDocs: [doc],
    filingDocs: [],
    issuePostHandler: () => {
      throw new Error("network down");
    },
  });
  const result = await runFiler({ env: BASE_ENV, fetchFn, now: () => 1_700_000_500_000 });
  assert.deepEqual(result.failed, ["doc1"]);
  assert.equal(result.exitCode, 1);
});

// ---------------------------------------------------------------------------
// Per-run cap and ordering
// ---------------------------------------------------------------------------

test("with 25 new docs, only the oldest 20 by createTime are filed, even when runQuery returns them shuffled", async () => {
  const docs = [];
  for (let i = 0; i < 25; i++) {
    const t = new Date(1_700_000_000_000 + i * 1000).toISOString();
    docs.push(makeDoc(`doc${i}`, t, t));
  }
  const shuffled = docs.slice().sort((a, b) => (a.id < b.id ? 1 : -1));
  const fetchFn = buildFakeFetch({ newDocs: shuffled, filingDocs: [] });
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

test("a stale filing doc whose marker is on a listed issue is reconciled, no issue POST", async () => {
  const doc = makeDoc("doc1", ELEVEN_MIN_AGO, ELEVEN_MIN_AGO, { attempts: 1 });
  const fetchFn = buildFakeFetch({
    newDocs: [],
    filingDocs: [doc],
    recentIssues: [
      { number: 55, html_url: "https://github.com/sheibeck/ddr/issues/55", body: `${markerFor("doc1")}\nsomething` },
    ],
  });
  const result = await runFiler({ env: BASE_ENV, fetchFn, now: () => NOW_MS });
  assert.deepEqual(result.reconciled, ["doc1"]);
  const issuePosts = fetchFn.calls.filter((c) => c.url.includes("/issues") && c.method === "POST");
  assert.equal(issuePosts.length, 0);
  const patchCalls = fetchFn.calls.filter((c) => c.method === "PATCH");
  assert.equal(patchCalls.length, 1);
  const body = JSON.parse(patchCalls[0].body);
  assert.equal(body.fields.status.stringValue, "filed");
  assert.equal(body.fields.issueNumber.integerValue, "55");
  assert.equal(body.fields.issueUrl.stringValue, "https://github.com/sheibeck/ddr/issues/55");
  assert.doesNotMatch(patchCalls[0].url, /currentDocument\.updateTime=/);
});

test("a stale filing doc with no marker and attempts 1 is re-locked (attempts 2), filed, and patched", async () => {
  const doc = makeDoc("doc1", ELEVEN_MIN_AGO, ELEVEN_MIN_AGO, { attempts: 1 });
  const fetchFn = buildFakeFetch({ newDocs: [], filingDocs: [doc], recentIssues: [] });
  const result = await runFiler({ env: BASE_ENV, fetchFn, now: () => NOW_MS });
  assert.deepEqual(result.filed, ["doc1"]);
  const lockCalls = fetchFn.calls.filter(
    (c) => c.method === "PATCH" && JSON.parse(c.body).fields.status?.stringValue === "filing",
  );
  assert.equal(lockCalls.length, 1);
  assert.equal(JSON.parse(lockCalls[0].body).fields.attempts.integerValue, "2");
  assert.match(lockCalls[0].url, /currentDocument\.updateTime=/);
});

test(`a stale filing doc with no marker at MAX_ATTEMPTS (${MAX_ATTEMPTS}) is marked failed, not filed`, async () => {
  const doc = makeDoc("doc1", ELEVEN_MIN_AGO, ELEVEN_MIN_AGO, { attempts: MAX_ATTEMPTS });
  const fetchFn = buildFakeFetch({ newDocs: [], filingDocs: [doc], recentIssues: [] });
  const result = await runFiler({ env: BASE_ENV, fetchFn, now: () => NOW_MS });
  assert.deepEqual(result.failed, ["doc1"]);
  assert.deepEqual(result.filed, []);
  const issuePosts = fetchFn.calls.filter((c) => c.url.includes("/issues") && c.method === "POST");
  assert.equal(issuePosts.length, 0);
  const patchCalls = fetchFn.calls.filter((c) => c.method === "PATCH");
  assert.equal(patchCalls.length, 1);
  assert.equal(JSON.parse(patchCalls[0].body).fields.status.stringValue, "failed");
});

test("a filing doc updated 5 minutes ago is left untouched", async () => {
  const doc = makeDoc("doc1", FIVE_MIN_AGO, FIVE_MIN_AGO, { attempts: 1 });
  assert.ok(NOW_MS - Date.parse(FIVE_MIN_AGO) < STALE_FILING_MS);
  const fetchFn = buildFakeFetch({ newDocs: [], filingDocs: [doc] });
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
// Dry run
// ---------------------------------------------------------------------------

test("dry run makes zero Firestore PATCH and zero GitHub POST calls, and logs a would-file line", async () => {
  const doc = makeDoc("doc1", "2026-09-28T17:00:00.000Z", "2026-09-28T17:00:00.000Z");
  const fetchFn = buildFakeFetch({ newDocs: [doc], filingDocs: [] });
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
  const githubPosts = fetchFn.calls.filter((c) => c.method === "POST" && c.url.includes("api.github.com"));
  assert.equal(githubPosts.length, 0);

  const expectedTitle = issueTitle(REPORT_FIELDS);
  const expectedBody = issueBody(REPORT_FIELDS, { docId: "doc1", createTime: doc.createTime });
  const expectedLine = `would file doc1: ${expectedTitle} (${expectedBody.length} chars)`;
  assert.ok(logs.includes(expectedLine), `expected ${JSON.stringify(expectedLine)}, got ${JSON.stringify(logs)}`);
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
  const fetchFn = buildFakeFetch({ newDocs: [doc], filingDocs: [], accessToken: "SUPER_SECRET_ACCESS_TOKEN" });
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
// Task 3: the workflow file
// ---------------------------------------------------------------------------

test("bug-reports.yml: the scheduled/manual workflow is shaped as documented, with no npm install and no unsafe run: interpolation", () => {
  const yaml = fs.readFileSync(WORKFLOW_PATH, "utf8");

  for (const needle of [
    "*/15 * * * *",
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
});
