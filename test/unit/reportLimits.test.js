// test/unit/reportLimits.test.js
//
// Phase 83 (SRV-09), Plan 02 Task 2. Covers the report-limit constants,
// utcDayMs, every nextLimitState branch at its boundary, validateLimitStep's
// fail ids and its agreement grid with nextLimitState, decodeLimitDoc,
// randomDocId, the exact two-Write report+limit commit, and the local
// record helpers.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { FIREBASE_CONFIG } from "../../src/browser/firebaseConfig.js";
import { docName, toFirestoreFields } from "../../src/browser/firestoreRest.js";
import {
  REPORT_COOLDOWN_MINUTES,
  REPORT_COOLDOWN_MS,
  REPORT_DAILY_CAP,
  LIMIT_FIELDS,
  REPORT_LIMITS_COLLECTION,
  LOCAL_LIMIT_KEY,
  utcDayMs,
  nextLimitState,
  validateLimitStep,
  decodeLimitDoc,
  randomDocId,
  buildReportCommit,
  sanitizeLocalLimit,
  checkLocalLimit,
  recordLocalSend,
} from "../../src/browser/reportLimits.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

// --- constants -----------------------------------------------------------

test("constants", () => {
  assert.equal(REPORT_COOLDOWN_MINUTES, 2);
  assert.equal(REPORT_COOLDOWN_MS, 120000);
  assert.equal(REPORT_DAILY_CAP, 5);
  assert.deepEqual([...LIMIT_FIELDS], ["last", "day", "count"]);
  assert.equal(REPORT_LIMITS_COLLECTION, "reportLimits");
  assert.equal(LOCAL_LIMIT_KEY, "ddr.reportLimit.v1");
});

// --- utcDayMs --------------------------------------------------------------

test("utcDayMs: the UTC midnight of ms", () => {
  const ms = Date.UTC(2026, 8, 28, 23, 59, 59, 999); // 2026-09-28T23:59:59.999Z
  assert.equal(utcDayMs(ms), Date.UTC(2026, 8, 28, 0, 0, 0, 0));
  const midnight = Date.UTC(2026, 8, 29, 0, 0, 0, 0);
  assert.equal(utcDayMs(midnight), midnight);
});

// --- nextLimitState ----------------------------------------------------

test("nextLimitState: null before is a fresh create", () => {
  const now = Date.UTC(2026, 8, 28, 12, 0, 0, 0);
  assert.deepEqual(nextLimitState(null, now), { ok: true, create: true, dayMs: utcDayMs(now), count: 1 });
});

test("nextLimitState: cooldown boundary at exactly REPORT_COOLDOWN_MS proceeds, one ms short is refused", () => {
  const now = Date.UTC(2026, 8, 28, 12, 0, 0, 0);
  const justInside = { lastMs: now - (REPORT_COOLDOWN_MS - 1), dayMs: utcDayMs(now), count: 1 };
  assert.deepEqual(nextLimitState(justInside, now), { ok: false, reason: "cooldown", waitMs: 1 });

  const exact = { lastMs: now - REPORT_COOLDOWN_MS, dayMs: utcDayMs(now), count: 1 };
  const result = nextLimitState(exact, now);
  assert.equal(result.ok, true);
});

test("nextLimitState: same UTC day, under the cap, increments count", () => {
  const now = Date.UTC(2026, 8, 28, 12, 0, 0, 0);
  const before = { lastMs: now - REPORT_COOLDOWN_MS - 1, dayMs: utcDayMs(now), count: 4 };
  assert.deepEqual(nextLimitState(before, now), { ok: true, create: false, dayMs: before.dayMs, count: 5 });
});

test("nextLimitState: same UTC day, at the cap, refused as daily", () => {
  const now = Date.UTC(2026, 8, 28, 12, 0, 0, 0);
  const before = { lastMs: now - REPORT_COOLDOWN_MS - 1, dayMs: utcDayMs(now), count: 5 };
  const nextMidnight = utcDayMs(now) + 24 * 60 * 60 * 1000;
  assert.deepEqual(nextLimitState(before, now), { ok: false, reason: "daily", waitMs: nextMidnight - now });
});

test("nextLimitState: a new UTC day resets to count 1", () => {
  const now = Date.UTC(2026, 8, 28, 12, 0, 0, 0);
  const before = { lastMs: now - REPORT_COOLDOWN_MS - 1, dayMs: utcDayMs(now) - 24 * 60 * 60 * 1000, count: 5 };
  assert.deepEqual(nextLimitState(before, now), { ok: true, create: false, dayMs: utcDayMs(now), count: 1 });
});

// --- validateLimitStep ------------------------------------------------

test("validateLimitStep: missing/extra keys yields keys", () => {
  const now = Date.UTC(2026, 8, 28, 12, 0, 0, 0);
  assert.deepEqual(validateLimitStep(null, { last: 1 }, now), ["keys"]);
  assert.deepEqual(validateLimitStep(null, { lastMs: now, dayMs: utcDayMs(now), count: 1, extra: 1 }, now), ["keys"]);
  assert.deepEqual(validateLimitStep(null, null, now), ["keys"]);
});

test("validateLimitStep: a create step built from nextLimitState validates", () => {
  const now = Date.UTC(2026, 8, 28, 12, 0, 0, 0);
  const next = nextLimitState(null, now);
  const after = { lastMs: now, dayMs: next.dayMs, count: next.count };
  assert.deepEqual(validateLimitStep(null, after, now), []);
});

test("validateLimitStep: an update step built from nextLimitState validates", () => {
  const now = Date.UTC(2026, 8, 28, 12, 0, 0, 0);
  const before = { lastMs: now - REPORT_COOLDOWN_MS - 1, dayMs: utcDayMs(now), count: 3 };
  const next = nextLimitState(before, now);
  const after = { lastMs: now, dayMs: next.dayMs, count: next.count };
  assert.deepEqual(validateLimitStep(before, after, now), []);
});

test("validateLimitStep: wrong last, count or day fail their own id", () => {
  const now = Date.UTC(2026, 8, 28, 12, 0, 0, 0);
  const next = nextLimitState(null, now);
  const valid = { lastMs: now, dayMs: next.dayMs, count: next.count };
  assert.deepEqual(validateLimitStep(null, { ...valid, lastMs: now - 1 }, now), ["last"]);
  assert.deepEqual(validateLimitStep(null, { ...valid, count: 2 }, now), ["count"]);
  assert.deepEqual(validateLimitStep(null, { ...valid, dayMs: valid.dayMs + 1 }, now), ["day"]);
});

test("validateLimitStep: cooldown breach fails cooldown; no after can satisfy it", () => {
  const now = Date.UTC(2026, 8, 28, 12, 0, 0, 0);
  const before = { lastMs: now - (REPORT_COOLDOWN_MS - 1), dayMs: utcDayMs(now), count: 1 };
  const attempts = [
    { lastMs: now, dayMs: utcDayMs(now), count: 2 },
    { lastMs: now, dayMs: utcDayMs(now) + 1, count: 99 },
  ];
  for (const after of attempts) {
    const fails = validateLimitStep(before, after, now);
    assert.ok(fails.includes("cooldown"), JSON.stringify(fails));
  }
});

test("validateLimitStep: daily cap breach fails count; no after can satisfy it", () => {
  const now = Date.UTC(2026, 8, 28, 12, 0, 0, 0);
  const before = { lastMs: now - REPORT_COOLDOWN_MS - 1, dayMs: utcDayMs(now), count: REPORT_DAILY_CAP };
  const attempts = [
    { lastMs: now, dayMs: utcDayMs(now), count: REPORT_DAILY_CAP + 1 },
    { lastMs: now, dayMs: utcDayMs(now), count: 1 },
  ];
  for (const after of attempts) {
    const fails = validateLimitStep(before, after, now);
    assert.ok(fails.includes("count"), JSON.stringify(fails));
  }
});

test("validateLimitStep agrees with nextLimitState on a grid of before states and times", () => {
  const now = Date.UTC(2026, 8, 28, 12, 0, 0, 0);
  const beforeStates = [
    null,
    { lastMs: now - REPORT_COOLDOWN_MS, dayMs: utcDayMs(now), count: 1 },
    { lastMs: now - REPORT_COOLDOWN_MS - 1, dayMs: utcDayMs(now), count: 1 },
    { lastMs: now - REPORT_COOLDOWN_MS - 1, dayMs: utcDayMs(now), count: REPORT_DAILY_CAP - 1 },
    { lastMs: now - REPORT_COOLDOWN_MS - 1, dayMs: utcDayMs(now), count: REPORT_DAILY_CAP },
    { lastMs: now - REPORT_COOLDOWN_MS - 1, dayMs: utcDayMs(now) - 24 * 60 * 60 * 1000, count: REPORT_DAILY_CAP },
    { lastMs: now - 1, dayMs: utcDayMs(now), count: 1 },
  ];
  const times = [now, now + 1, now + 60000];

  for (const before of beforeStates) {
    for (const t of times) {
      const next = nextLimitState(before, t);
      if (next.ok) {
        const after = { lastMs: t, dayMs: next.dayMs, count: next.count };
        assert.deepEqual(validateLimitStep(before, after, t), [], `ok step should validate: ${JSON.stringify({ before, t })}`);
      } else {
        // No candidate after (several plausible shapes) should ever validate.
        const candidates = [
          { lastMs: t, dayMs: utcDayMs(t), count: 1 },
          { lastMs: t, dayMs: before ? before.dayMs : utcDayMs(t), count: before ? before.count + 1 : 1 },
        ];
        for (const after of candidates) {
          assert.notDeepEqual(validateLimitStep(before, after, t), [], `refused step must have no valid after: ${JSON.stringify({ before, t, after })}`);
        }
      }
    }
  }
});

// --- decodeLimitDoc ----------------------------------------------------

test("decodeLimitDoc: decodes the typed-value fields map, null for anything else", () => {
  const now = Date.UTC(2026, 8, 28, 12, 0, 0, 0);
  const fields = {
    last: { timestampValue: new Date(now).toISOString() },
    day: { timestampValue: new Date(utcDayMs(now)).toISOString() },
    count: { integerValue: "3" },
  };
  assert.deepEqual(decodeLimitDoc(fields), { lastMs: now, dayMs: utcDayMs(now), count: 3 });

  assert.equal(decodeLimitDoc(null), null);
  assert.equal(decodeLimitDoc({}), null);
  assert.equal(decodeLimitDoc({ last: { stringValue: "x" }, day: fields.day, count: fields.count }), null);
  assert.equal(decodeLimitDoc({ last: fields.last, day: fields.day, count: { integerValue: "not-a-number" } }), null);
});

// --- randomDocId ---------------------------------------------------------

test("randomDocId: 20 characters from [A-Za-z0-9], driven only by the injected random", () => {
  let calls = 0;
  const random = () => {
    calls++;
    return 0.5;
  };
  const id = randomDocId(random);
  assert.equal(id.length, 20);
  assert.match(id, /^[A-Za-z0-9]{20}$/);
  assert.equal(calls, 20);

  // A different deterministic random gives a different (deterministic) id.
  let i = 0;
  const seq = [0, 0.1, 0.2, 0.99, 0.5, 0.25, 0.75, 0.33, 0.66, 0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.1, 0.11];
  const id2 = randomDocId(() => seq[i++]);
  assert.equal(id2.length, 20);
  assert.match(id2, /^[A-Za-z0-9]{20}$/);
});

// --- buildReportCommit ---------------------------------------------------

test("buildReportCommit: two Writes — the anonymous report create, and the limit update/create", () => {
  const now = Date.UTC(2026, 8, 28, 12, 0, 0, 0);
  const report = { schema: 1, status: "new", text: "bug", oracle: "", oracleLines: 0, version: "2.2.0 (12)", platform: "android", device: "pixel", clientTime: new Date(now).toISOString() };
  const uid = "u1";
  const reportId = "abcdefghijklmnopqrst";

  const createStep = nextLimitState(null, now);
  const commitCreate = buildReportCommit(FIREBASE_CONFIG, reportId, report, uid, createStep);
  assert.equal(commitCreate.writes.length, 2);
  const [w1, w2] = commitCreate.writes;

  assert.equal(w1.update.name, docName(FIREBASE_CONFIG, "bugReports", reportId));
  assert.deepEqual(w1.update.fields, toFirestoreFields(report));
  assert.equal("uid" in w1.update.fields, false);
  assert.equal(JSON.stringify(w1).includes(uid), false);
  assert.deepEqual(w1.currentDocument, { exists: false });

  assert.equal(w2.update.name, docName(FIREBASE_CONFIG, REPORT_LIMITS_COLLECTION, uid));
  assert.deepEqual(w2.update.fields, {
    day: { timestampValue: new Date(createStep.dayMs).toISOString() },
    count: { integerValue: String(createStep.count) },
  });
  assert.deepEqual(w2.updateTransforms, [{ fieldPath: "last", setToServerValue: "REQUEST_TIME" }]);
  assert.deepEqual(w2.currentDocument, { exists: false });

  const before = { lastMs: now - REPORT_COOLDOWN_MS - 1, dayMs: utcDayMs(now), count: 2 };
  const updateStep = nextLimitState(before, now);
  const commitUpdate = buildReportCommit(FIREBASE_CONFIG, reportId, report, uid, updateStep);
  assert.deepEqual(commitUpdate.writes[1].currentDocument, { exists: true });
});

// --- local record helpers -----------------------------------------------

test("sanitizeLocalLimit: tolerant decode, null on garbage", () => {
  assert.deepEqual(sanitizeLocalLimit({ lastMs: 1, dayMs: 2, count: 3 }), { lastMs: 1, dayMs: 2, count: 3 });
  assert.equal(sanitizeLocalLimit(null), null);
  assert.equal(sanitizeLocalLimit("garbage"), null);
  assert.equal(sanitizeLocalLimit({ lastMs: "x", dayMs: 2, count: 3 }), null);
  assert.equal(sanitizeLocalLimit({ lastMs: 1, dayMs: 2, count: 1.5 }), null);
});

test("checkLocalLimit equals nextLimitState", () => {
  const now = Date.UTC(2026, 8, 28, 12, 0, 0, 0);
  const record = { lastMs: now - REPORT_COOLDOWN_MS - 1, dayMs: utcDayMs(now), count: 2 };
  assert.deepEqual(checkLocalLimit(record, now), nextLimitState(record, now));
  assert.deepEqual(checkLocalLimit(null, now), nextLimitState(null, now));
});

test("recordLocalSend: {lastMs: now, dayMs: step.dayMs, count: step.count}", () => {
  const now = Date.UTC(2026, 8, 28, 12, 0, 0, 0);
  const step = { ok: true, create: true, dayMs: utcDayMs(now), count: 1 };
  assert.deepEqual(recordLocalSend(null, now, step), { lastMs: now, dayMs: step.dayMs, count: step.count });
});

// --- purity ------------------------------------------------------------

test("purity: no window/document/navigator/localStorage/sessionStorage and no bare global fetch", () => {
  const raw = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "reportLimits.js"), "utf8");
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  for (const bad of ["window", "document", "navigator", "localStorage", "sessionStorage"]) {
    assert.ok(!new RegExp(`\\b${bad}\\b`).test(src), `must not reference ${bad}`);
  }
  assert.ok(!/(^|[^.\w])fetch\s*\(/.test(src), "must not call a bare global fetch");
});
