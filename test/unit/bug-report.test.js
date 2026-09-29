// test/unit/bug-report.test.js
//
// Phase 79.3 (BUG-02), Plan 01 Task 1 — the pure client half of REPORT A
// BUG: Oracle extraction, payload building, the rules mirror, the Firestore
// typed-value encoder and the injected-fetch sender. Every behavior bullet
// from the plan gets its own assertion; the Thief-state cases build a real
// engine state the same way test/unit/final-sheet.test.js does.

import test from "node:test";
import assert from "node:assert/strict";

import { newRun } from "../../engine/state.js";
import { stripJs } from "../../tools/ident-sweep.mjs";
import {
  REPORT_SCHEMA,
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
  SEND_TIMEOUT_MS,
  REPORT_REASONS,
  FIRESTORE_BASE,
  oracleTextFromHtml,
  runContextFrom,
  buildReportPayload,
  validateReport,
  toFirestoreFields,
  reportingAvailable,
  reportsEndpoint,
  reportIdFromName,
  sendBugReport,
} from "../../src/browser/bugReport.js";
import { BUG_REPORT_CONFIG } from "../../src/browser/bugReportConfig.js";
import { firestoreUrl } from "../../src/browser/firestoreRest.js";
import {
  REPORT_COOLDOWN_MS,
  REPORT_DAILY_CAP,
  REPORT_LIMITS_COLLECTION,
  nextLimitState,
  utcDayMs,
} from "../../src/browser/reportLimits.js";
import { createFakeBoardFetch, FAKE_ADMIN_TOKEN } from "../../src/browser/fakeBoardServer.js";
import { createIdentity } from "../../src/browser/firebaseAuth.js";

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const BUG_REPORT_SRC = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "bugReport.js"), "utf8").replace(/\r\n/g, "\n");
const BUG_REPORT_CONFIG_SRC = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "bugReportConfig.js"), "utf8").replace(/\r\n/g, "\n");

const VALID_CONFIG = Object.freeze({
  projectId: "delve-die-repeat-6ba5f",
  apiKey: `AIza${"A".repeat(35)}`,
  collection: "bugReports",
});

function thiefState() {
  return newRun(7, [], { force: { cls: "Thief" } });
}

/* ---------------- oracleTextFromHtml ---------------- */

test("oracleTextFromHtml: DOM order (newest first) becomes plain text oldest first, tags stripped", () => {
  const { text, lines } = oracleTextFromHtml(['<span class="roll">d20: 17</span> You hit the rat.', "Floor 1."]);
  assert.equal(text, "Floor 1.\nd20: 17 You hit the rat.");
  assert.equal(lines, 2);
});

test("oracleTextFromHtml: <br> becomes a space", () => {
  const { text } = oracleTextFromHtml(["Line one.<br>Line two."]);
  assert.equal(text, "Line one. Line two.");
});

test("oracleTextFromHtml: named, decimal and hex entities decode", () => {
  const entries = [
    "&amp; &lt; &gt; &quot; &#39; &apos; &nbsp;end",
    "&mdash; &ndash; &hellip; &minus; &times; &middot;",
    "&#8722; &#x2013;",
  ];
  const { text } = oracleTextFromHtml(entries);
  const byLine = text.split("\n");
  assert.equal(byLine[0], "− –");
  assert.equal(byLine[1], "— – … − × ·");
  assert.equal(byLine[2], "& < > \" ' ' end");
});

test("oracleTextFromHtml: whitespace collapses and empty entries drop; non-array gives empty", () => {
  const { text, lines } = oracleTextFromHtml(["  spaced   out  ", "   ", "<b></b>", "kept"]);
  assert.equal(text, "kept\nspaced out");
  assert.equal(lines, 2);
  assert.deepEqual(oracleTextFromHtml(null), { text: "", lines: 0 });
  assert.deepEqual(oracleTextFromHtml("nope"), { text: "", lines: 0 });
  assert.deepEqual(oracleTextFromHtml(undefined), { text: "", lines: 0 });
});

test("oracleTextFromHtml: over ORACLE_MAX_CHARS drops the oldest lines first, then clamps the newest alone", () => {
  const filler = "x".repeat(ORACLE_MAX_CHARS - 10);
  const { text, lines } = oracleTextFromHtml([filler, "oldest line dropped"]);
  assert.ok(text.length <= ORACLE_MAX_CHARS);
  assert.equal(lines, 1);
  assert.equal(text, filler);

  const oneHuge = "y".repeat(ORACLE_MAX_CHARS + 500);
  const single = oracleTextFromHtml([oneHuge]);
  assert.equal(single.text.length, ORACLE_MAX_CHARS);
  assert.equal(single.lines, 1);
});

/* ---------------- buildReportPayload / text ---------------- */

test("buildReportPayload: blank or whitespace-only text is rejected as empty", () => {
  assert.deepEqual(buildReportPayload({ text: "" }), { ok: false, reason: "empty" });
  assert.deepEqual(buildReportPayload({ text: "   \n\t  " }), { ok: false, reason: "empty" });
  assert.deepEqual(buildReportPayload({}), { ok: false, reason: "empty" });
});

test("buildReportPayload: text over TEXT_MAX_CHARS clamps with no trailing lone surrogate", () => {
  const longText = "a".repeat(2500);
  const { ok, report } = buildReportPayload({ text: longText });
  assert.ok(ok);
  assert.equal(report.text.length, TEXT_MAX_CHARS);

  const withSurrogatePair = "b".repeat(TEXT_MAX_CHARS - 1) + "😀"; // ends with a full surrogate pair (emoji)
  const clamped = buildReportPayload({ text: withSurrogatePair }).report.text;
  assert.ok(clamped.length <= TEXT_MAX_CHARS);
  const lastCode = clamped.charCodeAt(clamped.length - 1);
  assert.ok(lastCode < 0xd800 || lastCode > 0xdbff, "must not end on a lone high surrogate");
});

/* ---------------- buildReportPayload / keys with and without a hero ---------------- */

test("buildReportPayload: with no hero, the keys equal REQUIRED_REPORT_FIELDS", () => {
  const withNullState = buildReportPayload({ text: "bug" , state: null });
  assert.deepEqual(Object.keys(withNullState.report).sort(), [...REQUIRED_REPORT_FIELDS].sort());

  const withNoCState = buildReportPayload({ text: "bug", state: { floor: { depth: 1 } } });
  assert.deepEqual(Object.keys(withNoCState.report).sort(), [...REQUIRED_REPORT_FIELDS].sort());
});

test("buildReportPayload: with the Thief state, the keys equal REPORT_FIELDS and run is read from the state", () => {
  const s = thiefState();
  const { report } = buildReportPayload({ text: "bug", state: s });
  assert.deepEqual(Object.keys(report).sort(), [...REPORT_FIELDS].sort());
  assert.deepEqual(report.run, {
    depth: s.floor.depth,
    cls: s.c.cls,
    sub: s.c.sub,
    race: s.c.race,
    level: s.c.level,
    steps: s.steps,
    day: s.day,
    dead: s.dead === true,
  });
  assert.equal(typeof report.run.dead, "boolean");
});

test("buildReportPayload: the state is never mutated", () => {
  const s = thiefState();
  const before = JSON.stringify(s);
  buildReportPayload({ text: "bug", state: s });
  assert.equal(JSON.stringify(s), before);
});

test("buildReportPayload: a state whose getters throw gives a report without run, and nothing throws", () => {
  const throwing = {};
  Object.defineProperty(throwing, "c", {
    get() {
      throw new Error("boom");
    },
  });
  assert.doesNotThrow(() => {
    const { ok, report } = buildReportPayload({ text: "bug", state: throwing });
    assert.ok(ok);
    assert.ok(!("run" in report));
  });
});

/* ---------------- runContextFrom boundary cases ---------------- */

test("runContextFrom: integers truncate and clamp to 0..RUN_INT_MAX, strings clamp to 40, dead is strict", () => {
  const fake = {
    floor: { depth: -5 },
    c: { cls: "X".repeat(60), sub: "Y", race: "Z", level: RUN_INT_MAX + 999 },
    steps: 3.9,
    day: Number.NaN,
    dead: "true",
  };
  const run = runContextFrom(fake);
  assert.equal(run.depth, 0);
  assert.equal(run.cls.length, RUN_STRING_MAX_CHARS);
  assert.equal(run.level, RUN_INT_MAX);
  assert.equal(run.steps, 3);
  assert.equal(run.day, 0);
  assert.equal(run.dead, false);
  assert.deepEqual(Object.keys(run), [...RUN_FIELDS]);
  assert.ok(Object.isFrozen(run));
});

test("runContextFrom: null for a non-object state or a state without c", () => {
  assert.equal(runContextFrom(null), null);
  assert.equal(runContextFrom("nope"), null);
  assert.equal(runContextFrom({ floor: {} }), null);
});

test("runContextFrom: absent cls/sub/race become empty strings, never the literal undefined", () => {
  const run = runContextFrom({ c: {}, floor: {}, steps: 0, day: 1, dead: false });
  assert.equal(run.cls, "");
  assert.equal(run.sub, "");
  assert.equal(run.race, "");
});

/* ---------------- field normalisation ---------------- */

test("buildReportPayload: version/platform/device/clientTime normalise, with unknown fallbacks", () => {
  const now = new Date("2026-09-28T12:00:00.000Z");
  const r1 = buildReportPayload({ text: "bug", version: "", platform: "", userAgent: "", now }).report;
  assert.equal(r1.version, "unknown");
  assert.equal(r1.platform, "unknown");
  assert.equal(r1.device, "unknown");
  assert.equal(r1.clientTime, now.toISOString());

  const r2 = buildReportPayload({ text: "bug", version: "2.1.0", platform: "ANDROID", userAgent: "  a   weird   \n ua  " }).report;
  assert.equal(r2.version, "2.1.0");
  assert.equal(r2.platform, "android");
  assert.equal(r2.device, "a weird ua");

  const r3 = buildReportPayload({ text: "bug", now: "not a date" }).report;
  assert.equal(r3.clientTime, "unknown");
  const r4 = buildReportPayload({ text: "bug", now: new Date(Number.NaN) }).report;
  assert.equal(r4.clientTime, "unknown");
  const r5 = buildReportPayload({ text: "bug" }).report;
  assert.equal(r5.clientTime, "unknown");
});

/* ---------------- validateReport ---------------- */

test("validateReport: a built report gives []", () => {
  const s = thiefState();
  const { report } = buildReportPayload({ text: "bug", state: s });
  assert.deepEqual(validateReport(report), []);
});

test("validateReport: an extra top-level key gives an array containing keys", () => {
  const { report } = buildReportPayload({ text: "bug" });
  const withExtra = { ...report, extra: "nope" };
  assert.ok(validateReport(withExtra).includes("keys"));
});

test("validateReport: status filed gives one containing status", () => {
  const { report } = buildReportPayload({ text: "bug" });
  const bad = { ...report, status: "filed" };
  assert.ok(validateReport(bad).includes("status"));
});

test("validateReport: text \"\" gives one containing text", () => {
  const { report } = buildReportPayload({ text: "bug" });
  const bad = { ...report, text: "" };
  assert.ok(validateReport(bad).includes("text"));
});

test("validateReport: a run with an extra key gives one containing run", () => {
  const s = thiefState();
  const { report } = buildReportPayload({ text: "bug", state: s });
  const bad = { ...report, run: { ...report.run, extra: 1 } };
  assert.ok(validateReport(bad).includes("run"));
});

test("validateReport: schema 2 gives one containing schema", () => {
  const { report } = buildReportPayload({ text: "bug" });
  const bad = { ...report, schema: 2 };
  assert.ok(validateReport(bad).includes("schema"));
});

/* ---------------- toFirestoreFields ---------------- */

test("toFirestoreFields: the typed-value encoding table", () => {
  const fields = toFirestoreFields({ s: "a", i: 12, d: 1.5, b: true, n: null, m: { x: 1 }, a: ["y"] });
  assert.deepEqual(fields, {
    s: { stringValue: "a" },
    i: { integerValue: "12" },
    d: { doubleValue: 1.5 },
    b: { booleanValue: true },
    n: { nullValue: null },
    m: { mapValue: { fields: { x: { integerValue: "1" } } } },
    a: { arrayValue: { values: [{ stringValue: "y" }] } },
  });
});

test("toFirestoreFields: undefined-valued keys are skipped", () => {
  const fields = toFirestoreFields({ present: "x", missing: undefined });
  assert.deepEqual(Object.keys(fields), ["present"]);
});

/* ---------------- reportingAvailable / reportsEndpoint / reportIdFromName ---------------- */

test("reportingAvailable: an empty, malformed or mismatched-shape key/project id reads unavailable", () => {
  assert.equal(reportingAvailable({ apiKey: "", projectId: "delve-die-repeat-6ba5f" }), false);
  assert.equal(reportingAvailable({ apiKey: "not-a-key", projectId: "delve-die-repeat-6ba5f" }), false);
  assert.equal(reportingAvailable({ apiKey: VALID_CONFIG.apiKey, projectId: "x" }), false);
  assert.equal(reportingAvailable(VALID_CONFIG), true);
});

test("BUG_REPORT_CONFIG: the shipped project id and collection, and an empty or valid key", () => {
  assert.equal(BUG_REPORT_CONFIG.projectId, "delve-die-repeat-6ba5f");
  assert.equal(BUG_REPORT_CONFIG.collection, "bugReports");
  assert.ok(BUG_REPORT_CONFIG.apiKey === "" || /^AIza[0-9A-Za-z_-]{35}$/.test(BUG_REPORT_CONFIG.apiKey));
  assert.ok(Object.isFrozen(BUG_REPORT_CONFIG));
});

test("reportsEndpoint: the exact Firestore REST create URL", () => {
  assert.equal(
    reportsEndpoint(VALID_CONFIG),
    `${FIRESTORE_BASE}/projects/delve-die-repeat-6ba5f/databases/(default)/documents/bugReports?key=${encodeURIComponent(VALID_CONFIG.apiKey)}`,
  );
});

test("reportIdFromName: the last slash segment, else null", () => {
  assert.equal(reportIdFromName("projects/p/databases/(default)/documents/bugReports/abc123"), "abc123");
  assert.equal(reportIdFromName("noslash"), "noslash");
  assert.equal(reportIdFromName(""), null);
  assert.equal(reportIdFromName(undefined), null);
  assert.equal(reportIdFromName(null), null);
});

/* ---------------- sendBugReport ---------------- */
//
// Phase 83 (SRV-09): sendBugReport now signs the report through the shared
// anonymous identity, reads the player's own reportLimits/{uid} via a GET,
// and writes the report + limit step in one documents:commit
// (reportLimits.js#buildReportCommit). The plain unauthenticated create
// tested above (79.3) no longer exists — old builds up to 2.1.0/vc11 that
// still post it are refused by the live rules by design (no legacy path).

function validReport() {
  return buildReportPayload({ text: "bug report body" }).report;
}

function makeRecordingFetch(sequence) {
  const calls = [];
  const remaining = [...sequence];
  const fetchFn = async (url, init) => {
    calls.push({ url, init });
    const next = remaining.shift();
    if (typeof next === "function") return next();
    return next;
  };
  return { fetchFn, calls };
}

/** stubIdentity — a hand-rolled identity object (not the real createIdentity) for status-code-mapping tests that don't need the fake board server. */
function stubIdentity({ uid = "u1", idToken = "tok1", handle = "@handle", getToken, forceRefresh } = {}) {
  const calls = { getToken: [], forceRefresh: [] };
  return {
    calls,
    getToken:
      getToken ??
      (async (opts) => {
        calls.getToken.push(opts);
        return { ok: true, uid, idToken, handle };
      }),
    forceRefresh:
      forceRefresh ??
      (async (opts) => {
        calls.forceRefresh.push(opts);
        return { ok: true, uid, idToken: `${idToken}-refreshed`, handle };
      }),
  };
}

function clockBox(start = 0) {
  let t = start;
  const now = () => t;
  now.advance = (d) => {
    t += d;
  };
  return now;
}

/** lcgRandom(seed) — a tiny deterministic PRNG so repeated calls (randomDocId draws 20 per report) don't collide the way a constant-returning stub does. */
function lcgRandom(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function makeFakeSetup(fakeOpts = {}) {
  const clock = clockBox(0);
  const fake = createFakeBoardFetch({ config: VALID_CONFIG, now: clock, ...fakeOpts });
  const storageMap = new Map();
  const storage = {
    async getItem(key) {
      return storageMap.has(key) ? storageMap.get(key) : null;
    },
    async setItem(key, value) {
      storageMap.set(key, String(value));
    },
    async removeItem(key) {
      storageMap.delete(key);
    },
  };
  const identity = createIdentity({ storage, fetchFn: fake.fetchFn, config: VALID_CONFIG, competeOn: () => false, now: clock, random: () => 0.42 });
  return { fake, storage, clock, identity };
}

test("sendBugReport: unavailable config, missing fetchFn, missing identity, offline and an invalid report never call fetch or identity.getToken", async () => {
  const report = validReport();
  const identity = stubIdentity();

  const r1 = await sendBugReport(report, {
    fetchFn: async () => ({ ok: true, status: 200, json: async () => ({}) }),
    identity,
    config: { apiKey: "", projectId: "delve-die-repeat-6ba5f", collection: "bugReports" },
  });
  assert.deepEqual(r1, { ok: false, reason: "unavailable" });

  const r2 = await sendBugReport(report, { identity, config: VALID_CONFIG });
  assert.deepEqual(r2, { ok: false, reason: "unavailable" });

  const { fetchFn: neverCalled, calls } = makeRecordingFetch([]);
  const r3 = await sendBugReport(report, { fetchFn: neverCalled, config: VALID_CONFIG });
  assert.deepEqual(r3, { ok: false, reason: "unavailable" });
  assert.equal(calls.length, 0);

  const r4 = await sendBugReport(report, { fetchFn: neverCalled, config: VALID_CONFIG, identity, online: false });
  assert.deepEqual(r4, { ok: false, reason: "offline" });
  assert.equal(calls.length, 0);
  assert.equal(identity.calls.getToken.length, 0);

  const r5 = await sendBugReport({ ...report, status: "filed" }, { fetchFn: neverCalled, config: VALID_CONFIG, identity });
  assert.deepEqual(r5, { ok: false, reason: "refused" });
  assert.equal(calls.length, 0);
  assert.equal(identity.calls.getToken.length, 0);
});

test("sendBugReport: identity.getToken's own offline/server/refused pass through unchanged; anything else (including 'off') reads unavailable", async () => {
  for (const reason of ["offline", "server", "refused"]) {
    const identity = stubIdentity({
      getToken: async () => ({ ok: false, reason }),
    });
    const neverCalled = async () => {
      throw new Error("must not be called");
    };
    const result = await sendBugReport(validReport(), { fetchFn: neverCalled, config: VALID_CONFIG, identity });
    assert.deepEqual(result, { ok: false, reason }, `getToken reason ${reason}`);
  }
  for (const reason of ["off", "unavailable", undefined]) {
    const identity = stubIdentity({ getToken: async () => ({ ok: false, reason }) });
    const neverCalled = async () => {
      throw new Error("must not be called");
    };
    const result = await sendBugReport(validReport(), { fetchFn: neverCalled, config: VALID_CONFIG, identity });
    assert.deepEqual(result, { ok: false, reason: "unavailable" }, `getToken reason ${reason}`);
  }
});

test("sendBugReport: getToken is always called with { explicit: true }", async () => {
  const identity = stubIdentity();
  const { fetchFn } = makeRecordingFetch([{ ok: false, status: 404 }, { ok: true, status: 200, json: async () => ({}) }]);
  await sendBugReport(validReport(), { fetchFn, config: VALID_CONFIG, identity, now: () => 1000, random: () => 0.1 });
  assert.deepEqual(identity.calls.getToken, [{ explicit: true }]);
});

test("sendBugReport: a 404 limit GET is a first report; a 2xx commit resolves ok with the built id and the first-report limit", async () => {
  const identity = stubIdentity({ uid: "u1", idToken: "tok1" });
  const { fetchFn, calls } = makeRecordingFetch([{ ok: false, status: 404 }, { ok: true, status: 200, json: async () => ({}) }]);
  const result = await sendBugReport(validReport(), { fetchFn, config: VALID_CONFIG, identity, now: () => 5000, random: () => 0.25 });
  assert.equal(result.ok, true);
  assert.equal(typeof result.id, "string");
  assert.equal(result.id.length, 20);
  assert.deepEqual(result.limit, { lastMs: 5000, dayMs: utcDayMs(5000), count: 1 });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, firestoreUrl(VALID_CONFIG, `/${REPORT_LIMITS_COLLECTION}/u1`));
  assert.equal(calls[0].init.method, "GET");
  assert.equal(calls[0].init.headers.Authorization, "Bearer tok1");
  assert.equal(calls[1].url, firestoreUrl(VALID_CONFIG, ":commit"));
  assert.equal(calls[1].init.method, "POST");
  const body = JSON.parse(calls[1].init.body);
  assert.equal(body.writes.length, 2);
});

test("sendBugReport: a stub commit answer of 403 resolves limited; 429/503 read as server; 400 reads refused", async () => {
  for (const [status, reason] of [
    [403, "limited"],
    [429, "server"],
    [503, "server"],
    [400, "refused"],
  ]) {
    const identity = stubIdentity();
    const { fetchFn } = makeRecordingFetch([{ ok: false, status: 404 }, { ok: false, status }]);
    const result = await sendBugReport(validReport(), { fetchFn, config: VALID_CONFIG, identity });
    assert.deepEqual(result, { ok: false, reason }, `commit status ${status}`);
  }
});

test("sendBugReport: a 401 on the commit forces exactly one refresh and one retry, then succeeds with the refreshed token", async () => {
  const identity = stubIdentity({ idToken: "tok1" });
  const { fetchFn, calls } = makeRecordingFetch([
    { ok: false, status: 404 },
    { ok: false, status: 401 },
    { ok: true, status: 200, json: async () => ({}) },
  ]);
  const result = await sendBugReport(validReport(), { fetchFn, config: VALID_CONFIG, identity });
  assert.equal(result.ok, true);
  assert.deepEqual(identity.calls.forceRefresh, [{ explicit: true }]);
  assert.equal(calls.length, 3);
  assert.equal(calls[1].init.headers.Authorization, "Bearer tok1");
  assert.equal(calls[2].init.headers.Authorization, "Bearer tok1-refreshed");
});

test("sendBugReport: a second 401 after the one retry resolves refused, with no further retry", async () => {
  const identity = stubIdentity();
  const { fetchFn } = makeRecordingFetch([
    { ok: false, status: 404 },
    { ok: false, status: 401 },
    { ok: false, status: 401 },
  ]);
  const result = await sendBugReport(validReport(), { fetchFn, config: VALID_CONFIG, identity });
  assert.deepEqual(result, { ok: false, reason: "refused" });
  assert.equal(identity.calls.forceRefresh.length, 1);
});

test("sendBugReport: a 401 on the limit GET itself forces one refresh and one retry before the commit", async () => {
  const identity = stubIdentity();
  const { fetchFn, calls } = makeRecordingFetch([
    { ok: false, status: 401 },
    { ok: false, status: 404 },
    { ok: true, status: 200, json: async () => ({}) },
  ]);
  const result = await sendBugReport(validReport(), { fetchFn, config: VALID_CONFIG, identity });
  assert.equal(result.ok, true);
  assert.deepEqual(identity.calls.forceRefresh, [{ explicit: true }]);
  assert.equal(calls.length, 3);
});

test("sendBugReport: a rejecting/throwing fetchFn on either request resolves offline and never throws", async () => {
  const rejecting = async () => {
    throw new Error("network down");
  };
  const r1 = await sendBugReport(validReport(), { fetchFn: rejecting, config: VALID_CONFIG, identity: stubIdentity() });
  assert.deepEqual(r1, { ok: false, reason: "offline" });

  const { fetchFn: rejectsOnCommit } = makeRecordingFetch([
    { ok: false, status: 404 },
    () => {
      throw new Error("boom");
    },
  ]);
  const r2 = await sendBugReport(validReport(), { fetchFn: rejectsOnCommit, config: VALID_CONFIG, identity: stubIdentity() });
  assert.deepEqual(r2, { ok: false, reason: "offline" });
});

test("sendBugReport: a fetchFn that never settles times out, aborts and clears the timer", async () => {
  let pendingTimer = null;
  const cleared = [];
  const setTimer = (fn) => {
    pendingTimer = fn;
    return "timer-1";
  };
  const clearTimer = (id) => cleared.push(id);
  let aborted = false;
  class FakeAbortController {
    constructor() {
      this.signal = { aborted: false };
    }
    abort() {
      aborted = true;
      this.signal.aborted = true;
    }
  }
  const neverSettles = () => new Promise(() => {});

  const resultPromise = sendBugReport(validReport(), {
    fetchFn: neverSettles,
    config: VALID_CONFIG,
    identity: stubIdentity(),
    setTimer,
    clearTimer,
    AbortCtl: FakeAbortController,
  });
  // sendBugReport awaits identity.getToken() (itself async) before the
  // timedFetch race even starts, so the timer is armed a few microtask
  // ticks in rather than perfectly synchronously — a macrotask tick is
  // enough to guarantee it has run.
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.ok(pendingTimer, "the timer must be armed");
  pendingTimer();
  const result = await resultPromise;
  assert.deepEqual(result, { ok: false, reason: "offline" });
  assert.ok(aborted, "the abort controller's abort must have been called");
  assert.deepEqual(cleared, ["timer-1"]);
});

test("sendBugReport: the timer is cleared on every settled request (limit GET and commit)", async () => {
  const cleared = [];
  const setTimer = (fn, ms) => setTimeout(fn, ms);
  const clearTimer = (id) => {
    cleared.push(id);
    clearTimeout(id);
  };
  const { fetchFn } = makeRecordingFetch([{ ok: false, status: 404 }, { ok: true, status: 200, json: async () => ({}) }]);
  await sendBugReport(validReport(), { fetchFn, config: VALID_CONFIG, identity: stubIdentity(), setTimer, clearTimer });
  assert.equal(cleared.length, 2);
});

/* ---------------- sendBugReport against the fake board server ---------------- */

test("sendBugReport against the fake board: the first send signs up, reads the absent limit doc, and writes the report + limit in one commit with no uid on the report", async () => {
  const { fake, identity } = makeFakeSetup();
  const report = validReport();
  const result = await sendBugReport(report, { fetchFn: fake.fetchFn, config: VALID_CONFIG, identity, now: () => 0, random: () => 0.5 });
  assert.equal(result.ok, true);
  assert.equal(typeof result.id, "string");
  assert.deepEqual(result.limit, { lastMs: 0, dayMs: utcDayMs(0), count: 1 });

  assert.equal(fake.users().length, 1);
  const reports = fake.reports();
  assert.equal(reports.length, 1);
  assert.equal(reports[0].id, result.id);
  const { id, ...storedReport } = reports[0];
  assert.deepEqual(storedReport, report);
  assert.ok(!("uid" in storedReport));

  const commitCalls = fake.calls().filter((c) => c.method === "POST" && c.url.includes(":commit"));
  assert.equal(commitCalls.length, 1);
});

test("sendBugReport against the fake board: cooldown, the daily cap and the next UTC day", async () => {
  const { fake, identity, clock } = makeFakeSetup();
  const report = validReport();
  const random = lcgRandom(7);

  const r1 = await sendBugReport(report, { fetchFn: fake.fetchFn, config: VALID_CONFIG, identity, now: clock, random });
  assert.equal(r1.ok, true);

  clock.advance(60 * 1000); // 1 minute later: still inside the 2-minute cooldown
  const r2 = await sendBugReport(report, { fetchFn: fake.fetchFn, config: VALID_CONFIG, identity, now: clock, random });
  assert.deepEqual(r2, { ok: false, reason: "cooldown", waitMs: 60000, limit: r1.limit });
  assert.equal(fake.calls().filter((c) => c.method === "POST" && c.url.includes(":commit")).length, 1);

  clock.advance(60 * 1000); // total 2 minutes since r1: cooldown clears
  const r3 = await sendBugReport(report, { fetchFn: fake.fetchFn, config: VALID_CONFIG, identity, now: clock, random });
  assert.equal(r3.ok, true);
  assert.equal(r3.limit.count, 2);

  let last = r3;
  for (let i = 0; i < 3; i++) {
    clock.advance(REPORT_COOLDOWN_MS);
    last = await sendBugReport(report, { fetchFn: fake.fetchFn, config: VALID_CONFIG, identity, now: clock, random });
    assert.equal(last.ok, true);
  }
  assert.equal(last.limit.count, REPORT_DAILY_CAP);

  clock.advance(REPORT_COOLDOWN_MS);
  const r6 = await sendBugReport(report, { fetchFn: fake.fetchFn, config: VALID_CONFIG, identity, now: clock, random });
  assert.equal(r6.ok, false);
  assert.equal(r6.reason, "daily");
  assert.deepEqual(r6.limit, last.limit);
  const today = utcDayMs(clock());
  assert.equal(r6.waitMs, today + 24 * 60 * 60 * 1000 - clock());

  const nextDayMs = utcDayMs(clock()) + 24 * 60 * 60 * 1000;
  clock.advance(nextDayMs - clock() + 1000);
  const r7 = await sendBugReport(report, { fetchFn: fake.fetchFn, config: VALID_CONFIG, identity, now: clock, random });
  assert.equal(r7.ok, true);
  assert.equal(r7.limit.count, 1);
});

test("sendBugReport against the fake board: an existing server-side limit doc (no prior local record) is read via GET and enforced", async () => {
  const { fake, identity, clock } = makeFakeSetup();
  const token = await identity.getToken({ explicit: true });
  assert.ok(token.ok);
  const seeded = { lastMs: clock() - 60 * 1000, dayMs: utcDayMs(clock()), count: 3 };
  const patchRes = await fake.fetchFn(firestoreUrl(VALID_CONFIG, `/${REPORT_LIMITS_COLLECTION}/${token.uid}`), {
    method: "PATCH",
    headers: { Authorization: `Bearer ${FAKE_ADMIN_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: {
        last: { timestampValue: new Date(seeded.lastMs).toISOString() },
        day: { timestampValue: new Date(seeded.dayMs).toISOString() },
        count: { integerValue: String(seeded.count) },
      },
    }),
  });
  assert.equal(patchRes.status, 200);

  const result = await sendBugReport(validReport(), { fetchFn: fake.fetchFn, config: VALID_CONFIG, identity, now: clock, random: () => 0.6 });
  assert.deepEqual(result, { ok: false, reason: "cooldown", waitMs: REPORT_COOLDOWN_MS - 60000, limit: seeded });
});

/* ---------------- REPORT_REASONS / SEND_TIMEOUT_MS sanity ---------------- */

test("REPORT_REASONS lists the seven reasons; SEND_TIMEOUT_MS matches the plan", () => {
  assert.deepEqual([...REPORT_REASONS].sort(), ["cooldown", "daily", "limited", "offline", "refused", "server", "unavailable"]);
  assert.equal(SEND_TIMEOUT_MS, 15000);
  assert.equal(TEXT_MAX_CHARS, 2000);
  assert.equal(ORACLE_MAX_CHARS, 100000);
  assert.equal(ORACLE_LINES_MAX, 1000);
  assert.equal(VERSION_MAX_CHARS, 64);
  assert.equal(PLATFORM_MAX_CHARS, 16);
  assert.equal(DEVICE_MAX_CHARS, 400);
  assert.equal(CLIENT_TIME_MAX_CHARS, 40);
  assert.equal(RUN_STRING_MAX_CHARS, 40);
  assert.equal(RUN_INT_MAX, 1000000000);
  assert.equal(REPORT_SCHEMA, 1);
});

/* ---------------- purity ---------------- */

test("purity: neither module reads window/document/navigator/storage, and only fetchFn is ever called", () => {
  const noFetchFnRe = /(?<!\w)fetch\(/;
  for (const code of [stripJs(BUG_REPORT_SRC), stripJs(BUG_REPORT_CONFIG_SRC)]) {
    for (const banned of [/\bwindow\b/, /\bdocument\b/, /\bnavigator\b/, /\blocalStorage\b/, /\bsessionStorage\b/, /\bXMLHttpRequest\b/, /\bWebSocket\b/, /\bsendBeacon\b/]) {
      assert.doesNotMatch(code, banned, `must not use ${banned}`);
    }
    assert.doesNotMatch(code, noFetchFnRe, "must never call the global fetch directly");
  }
});
