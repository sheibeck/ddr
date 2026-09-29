// test/unit/firestoreRest.test.js
//
// Phase 83, Plan 01 Task 1 — the shared Firebase config module and the one
// Firestore REST helper module (encoder moved from bugReport.js, decoder,
// URL builders, a never-throwing timedFetch, readJson, restError). Every
// behavior bullet from the plan gets its own assertion.

import test from "node:test";
import assert from "node:assert/strict";

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { FIREBASE_CONFIG, firebaseConfigured } from "../../src/browser/firebaseConfig.js";
import {
  FIRESTORE_BASE,
  IDENTITY_BASE,
  SECURETOKEN_BASE,
  REQUEST_TIMEOUT_MS,
  toFirestoreFields,
  fromFirestoreValue,
  fromFirestoreFields,
  documentsPath,
  firestoreUrl,
  docName,
  timedFetch,
  readJson,
  restError,
} from "../../src/browser/firestoreRest.js";
import { BUG_REPORT_CONFIG } from "../../src/browser/bugReportConfig.js";
import { toFirestoreFields as bugReportToFirestoreFields } from "../../src/browser/bugReport.js";
import { stripJs } from "../../tools/ident-sweep.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const FIREBASE_CONFIG_SRC = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "firebaseConfig.js"), "utf8").replace(/\r\n/g, "\n");
const FIRESTORE_REST_SRC = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "firestoreRest.js"), "utf8").replace(/\r\n/g, "\n");

/* ---------------- encode/decode round trip ---------------- */

test("toFirestoreFields/fromFirestoreFields: round trip returns an equal object", () => {
  const original = { s: "x", i: 7, d: 1.5, b: true, n: null, m: { k: "v" }, a: [1, "two"] };
  const encoded = toFirestoreFields(original);
  const decoded = fromFirestoreFields(encoded);
  assert.deepEqual(decoded, original);
});

test("fromFirestoreValue: a large integerValue decodes to a number", () => {
  assert.equal(fromFirestoreValue({ integerValue: "1790000000000" }), 1790000000000);
});

test("fromFirestoreFields: an empty mapValue decodes to {}", () => {
  const decoded = fromFirestoreValue({ mapValue: {} });
  assert.deepEqual(decoded, {});
});

test("fromFirestoreValue: an arrayValue with no values decodes to []", () => {
  const decoded = fromFirestoreValue({ arrayValue: {} });
  assert.deepEqual(decoded, []);
});

/* ---------------- same-reference encoder ---------------- */

test("toFirestoreFields imported from bugReport.js is the same function reference as firestoreRest.js's", () => {
  assert.equal(bugReportToFirestoreFields, toFirestoreFields);
});

/* ---------------- shared config ---------------- */

test("BUG_REPORT_CONFIG deep-equals the shared FIREBASE_CONFIG plus the bugReports collection", () => {
  assert.deepEqual(BUG_REPORT_CONFIG, {
    projectId: FIREBASE_CONFIG.projectId,
    apiKey: FIREBASE_CONFIG.apiKey,
    collection: "bugReports",
  });
});

test("FIREBASE_CONFIG.projectId is the shipped project id", () => {
  assert.equal(FIREBASE_CONFIG.projectId, "delve-die-repeat-6ba5f");
});

test("firebaseConfigured: true for FIREBASE_CONFIG, false for an empty key or a short project id", () => {
  assert.equal(firebaseConfigured(FIREBASE_CONFIG), true);
  assert.equal(firebaseConfigured({ ...FIREBASE_CONFIG, apiKey: "" }), false);
  assert.equal(firebaseConfigured({ ...FIREBASE_CONFIG, projectId: "abc" }), false);
});

/* ---------------- URL builders ---------------- */

test("firestoreUrl: the exact runQuery REST URL", () => {
  assert.equal(
    firestoreUrl(FIREBASE_CONFIG, ":runQuery"),
    `https://firestore.googleapis.com/v1/projects/delve-die-repeat-6ba5f/databases/(default)/documents:runQuery?key=${encodeURIComponent(FIREBASE_CONFIG.apiKey)}`
  );
});

test("docName: the exact document name for runs/u_1", () => {
  assert.equal(docName(FIREBASE_CONFIG, "runs", "u_1"), "projects/delve-die-repeat-6ba5f/databases/(default)/documents/runs/u_1");
});

test("documentsPath and the base URL constants", () => {
  assert.equal(documentsPath(FIREBASE_CONFIG), "projects/delve-die-repeat-6ba5f/databases/(default)/documents");
  assert.equal(FIRESTORE_BASE, "https://firestore.googleapis.com/v1");
  assert.equal(IDENTITY_BASE, "https://identitytoolkit.googleapis.com/v1");
  assert.equal(SECURETOKEN_BASE, "https://securetoken.googleapis.com/v1");
  assert.equal(REQUEST_TIMEOUT_MS, 15000);
});

/* ---------------- timedFetch ---------------- */

test("timedFetch: resolves { ok: true, res } on a resolving fetchFn, and clears its timer once", async () => {
  let cleared = 0;
  const fakeRes = { ok: true };
  const fetchFn = async () => fakeRes;
  const result = await timedFetch(fetchFn, "https://example.test/x", {}, {
    setTimer: (fn, ms) => "timer-1",
    clearTimer: (id) => {
      cleared += 1;
    },
  });
  assert.deepEqual(result, { ok: true, res: fakeRes });
  assert.equal(cleared, 1);
});

test("timedFetch: resolves { ok: false, reason: 'offline' } on a rejecting fetchFn, and clears its timer once", async () => {
  let cleared = 0;
  const fetchFn = async () => {
    throw new Error("network down");
  };
  const result = await timedFetch(fetchFn, "https://example.test/x", {}, {
    setTimer: (fn, ms) => "timer-2",
    clearTimer: () => {
      cleared += 1;
    },
  });
  assert.deepEqual(result, { ok: false, reason: "offline" });
  assert.equal(cleared, 1);
});

test("timedFetch: resolves { ok: false, reason: 'offline' } on a throwing fetchFn, and clears its timer once", async () => {
  let cleared = 0;
  const fetchFn = () => {
    throw new Error("boom");
  };
  const result = await timedFetch(fetchFn, "https://example.test/x", {}, {
    setTimer: (fn, ms) => "timer-3",
    clearTimer: () => {
      cleared += 1;
    },
  });
  assert.deepEqual(result, { ok: false, reason: "offline" });
  assert.equal(cleared, 1);
});

test("timedFetch: a timer that fires first aborts the controller, resolves offline, and clears its timer once", async () => {
  let cleared = 0;
  let aborted = false;
  let firedTimeout;
  class FakeAbortController {
    constructor() {
      this.signal = {};
    }
    abort() {
      aborted = true;
    }
  }
  // fetchFn never resolves on its own — only the fired timer settles the race.
  const fetchFn = () => new Promise(() => {});
  const resultPromise = timedFetch(fetchFn, "https://example.test/x", {}, {
    setTimer: (fn) => {
      firedTimeout = fn;
      return "timer-4";
    },
    clearTimer: () => {
      cleared += 1;
    },
    AbortCtl: FakeAbortController,
  });
  firedTimeout();
  const result = await resultPromise;
  assert.deepEqual(result, { ok: false, reason: "offline" });
  assert.equal(aborted, true);
  assert.equal(cleared, 1);
});

test("timedFetch never rejects, even with no fetchFn", async () => {
  const result = await timedFetch(undefined, "https://example.test/x", {}, {
    setTimer: () => "t",
    clearTimer: () => {},
  });
  assert.deepEqual(result, { ok: false, reason: "offline" });
});

/* ---------------- readJson / restError ---------------- */

test("readJson: never throws — a res whose json() rejects gives null", async () => {
  const res = { json: async () => { throw new Error("bad body"); } };
  assert.equal(await readJson(res), null);
});

test("readJson: resolves the parsed body on success", async () => {
  const res = { json: async () => ({ name: "x" }) };
  assert.deepEqual(await readJson(res), { name: "x" });
});

test("restError: reads { status, message } from an {error:{...}} body", () => {
  const result = restError({ error: { status: "FAILED_PRECONDITION", message: "already exists" } });
  assert.deepEqual(result, { status: "FAILED_PRECONDITION", message: "already exists" });
});

test("restError: reads { status, message } from a [{error:{...}}] body", () => {
  const result = restError([{ error: { status: "INVALID_ARGUMENT", message: "bad field" } }]);
  assert.deepEqual(result, { status: "INVALID_ARGUMENT", message: "bad field" });
});

test("restError: empty strings for a body with no error", () => {
  assert.deepEqual(restError({}), { status: "", message: "" });
  assert.deepEqual(restError(null), { status: "", message: "" });
  assert.deepEqual(restError([]), { status: "", message: "" });
});

/* ---------------- purity ---------------- */

test("purity: neither firebaseConfig.js nor firestoreRest.js reads window/document/navigator/storage, and only an injected fetchFn is ever called", () => {
  const noFetchFnRe = /(?<!\w)fetch\(/;
  for (const code of [stripJs(FIREBASE_CONFIG_SRC), stripJs(FIRESTORE_REST_SRC)]) {
    for (const banned of [/\bwindow\b/, /\bdocument\b/, /\bnavigator\b/, /\blocalStorage\b/, /\bsessionStorage\b/, /\bXMLHttpRequest\b/, /\bWebSocket\b/, /\bsendBeacon\b/]) {
      assert.doesNotMatch(code, banned, `must not use ${banned}`);
    }
    assert.doesNotMatch(code, noFetchFnRe, "must never call the global fetch directly");
  }
});
