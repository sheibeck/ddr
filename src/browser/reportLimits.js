// src/browser/reportLimits.js
//
// Phase 83 (SRV-09). The per-player bug-report limit: the JS mirror of
// firebase/firestore.rules#isValidLimitStep, reportCooldownMinutes() and
// reportDailyCap() (kept equal to this module by
// test/unit/firestore-rules.test.js), the exact report + limit commit, and
// the local (pre-network) cooldown/daily-count record the report sheet
// (83-09) checks before ever touching the network.
//
// .planning/todos/pending/2026-09-28-bug-report-per-player-limit-and-
// automatic-firestore-cleanup.md requirements 1-5 and 7: sign-in is required
// to send a report (83-09 wires the shared auth module); the report itself
// never carries a uid (D-07 still holds — the uid appears ONLY as
// reportLimits/{uid}'s path, never inside a bugReports document field); the
// report and its limit-document write are ONE documents:commit (two Writes,
// buildReportCommit below); the limit uses a UTC-midnight day bucket (a
// device clock wrong across UTC midnight can be refused for that one send —
// the sheet then shows the rate-limited message, per the todo); and old
// builds (up to 2.1.0/vc11) that plain-create a report are refused by the
// new rules by design — no legacy path (greenfield-no-legacy-paths).
//
// Pure, DOM-free: no window, document, navigator, localStorage or
// sessionStorage, and no bare global fetch. Never throws. This module never
// reads storage itself — the shell passes stored values in.

import { toFirestoreFields, docName } from "./firestoreRest.js";

export const REPORT_COOLDOWN_MINUTES = 2;
export const REPORT_COOLDOWN_MS = REPORT_COOLDOWN_MINUTES * 60 * 1000;
export const REPORT_DAILY_CAP = 5;
export const LIMIT_FIELDS = Object.freeze(["last", "day", "count"]);
export const REPORT_LIMITS_COLLECTION = "reportLimits";
export const LOCAL_LIMIT_KEY = "ddr.reportLimit.v1";

const DAY_MS = 24 * 60 * 60 * 1000;
const DOC_ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const DOC_ID_LENGTH = 20;

// The JS-side decoded step shape validateLimitStep checks `before`/`after`
// against — distinct from LIMIT_FIELDS (the Firestore document's own field
// names, "last"/"day"/"count", used by decodeLimitDoc's typed-value input
// and the rules' keys().hasOnly/hasAll).
const LIMIT_STEP_FIELDS = ["lastMs", "dayMs", "count"];

/** utcDayMs(ms) — the UTC midnight of ms (Date.UTC of its UTC year, month, day). */
export function utcDayMs(ms) {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * nextLimitState(before, now) — the JS twin of the rules' step logic.
 * before is {lastMs, dayMs, count} or null/undefined (no prior report).
 * Returns {ok:true, create, dayMs, count} for an allowed step, or
 * {ok:false, reason:"cooldown"|"daily", waitMs} for a refused one. Never
 * throws.
 */
export function nextLimitState(before, now) {
  if (before === null || before === undefined) {
    return { ok: true, create: true, dayMs: utcDayMs(now), count: 1 };
  }
  const elapsed = now - before.lastMs;
  if (elapsed < REPORT_COOLDOWN_MS) {
    return { ok: false, reason: "cooldown", waitMs: REPORT_COOLDOWN_MS - elapsed };
  }
  const today = utcDayMs(now);
  if (before.dayMs === today) {
    if (before.count >= REPORT_DAILY_CAP) {
      return { ok: false, reason: "daily", waitMs: today + DAY_MS - now };
    }
    return { ok: true, create: false, dayMs: before.dayMs, count: before.count + 1 };
  }
  return { ok: true, create: false, dayMs: today, count: 1 };
}

/**
 * validateLimitStep(before, after, t) — the rules mirror of
 * isValidLimitStep(before, after). Returns [] exactly when `after` is the
 * unique valid step from `before` at time t; otherwise one or more of
 * "keys", "last", "cooldown", "count", "day". Agrees with nextLimitState:
 * every ok step (built from nextLimitState's own output) validates, and
 * every refused step has no valid `after` at all, whatever shape it is in.
 * Never throws.
 */
export function validateLimitStep(before, after, t) {
  if (typeof after !== "object" || after === null) return ["keys"];
  const keys = Object.keys(after);
  const hasAll = LIMIT_STEP_FIELDS.every((k) => keys.includes(k));
  const onlyAllowed = keys.every((k) => LIMIT_STEP_FIELDS.includes(k));
  if (!hasAll || !onlyAllowed) return ["keys"];

  const fails = [];
  if (!(typeof after.lastMs === "number" && after.lastMs === t)) fails.push("last");

  const next = nextLimitState(before, t);
  if (!next.ok) {
    fails.push(next.reason === "cooldown" ? "cooldown" : "count");
    return fails;
  }

  if (!(Number.isInteger(after.count) && after.count === next.count)) fails.push("count");
  if (after.dayMs !== next.dayMs) fails.push("day");

  return fails;
}

/** decodeLimitDoc(fields) — {lastMs, dayMs, count} from a reportLimits typed-value fields map, or null. */
export function decodeLimitDoc(fields) {
  if (typeof fields !== "object" || fields === null) return null;
  const last = fields.last;
  const day = fields.day;
  const count = fields.count;
  if (!(last && typeof last.timestampValue === "string")) return null;
  if (!(day && typeof day.timestampValue === "string")) return null;
  if (!(count && typeof count.integerValue === "string")) return null;
  const lastMs = Date.parse(last.timestampValue);
  const dayMs = Date.parse(day.timestampValue);
  const countNum = Number(count.integerValue);
  if (!Number.isFinite(lastMs) || !Number.isFinite(dayMs) || !Number.isInteger(countNum)) return null;
  return { lastMs, dayMs, count: countNum };
}

/** randomDocId(random) — 20 characters from [A-Za-z0-9], drawn only from the injected random (default Math.random). */
export function randomDocId(random = Math.random) {
  let out = "";
  for (let i = 0; i < DOC_ID_LENGTH; i++) {
    const raw = Number(random());
    const n = Number.isFinite(raw) ? raw : 0;
    let idx = Math.floor(n * DOC_ID_ALPHABET.length);
    if (idx < 0) idx = 0;
    if (idx >= DOC_ID_ALPHABET.length) idx = DOC_ID_ALPHABET.length - 1;
    out += DOC_ID_ALPHABET[idx];
  }
  return out;
}

/**
 * buildReportCommit(config, reportId, report, uid, step) — a documents:commit
 * body with TWO Writes: W1 creates bugReports/{reportId} exactly as `report`
 * (no uid anywhere in it — the report stays anonymous, D-07); W2 updates
 * reportLimits/{uid}'s day/count and transforms `last` to the server's
 * REQUEST_TIME, with a create-or-update precondition from step.create.
 */
export function buildReportCommit(config, reportId, report, uid, step) {
  const reportWrite = {
    update: { name: docName(config, "bugReports", reportId), fields: toFirestoreFields(report) },
    currentDocument: { exists: false },
  };
  const limitWrite = {
    update: {
      name: docName(config, REPORT_LIMITS_COLLECTION, uid),
      fields: {
        day: { timestampValue: new Date(step.dayMs).toISOString() },
        count: { integerValue: String(step.count) },
      },
    },
    updateTransforms: [{ fieldPath: "last", setToServerValue: "REQUEST_TIME" }],
    currentDocument: { exists: !step.create },
  };
  return { writes: [reportWrite, limitWrite] };
}

/** sanitizeLocalLimit(raw) — a tolerant {lastMs, dayMs, count} from a stored local record, or null. */
export function sanitizeLocalLimit(raw) {
  if (typeof raw !== "object" || raw === null) return null;
  const lastMs = Number(raw.lastMs);
  const dayMs = Number(raw.dayMs);
  const count = Number(raw.count);
  if (!Number.isFinite(lastMs) || !Number.isFinite(dayMs) || !Number.isInteger(count)) return null;
  return { lastMs, dayMs, count };
}

/** checkLocalLimit(record, now) — nextLimitState(record, now); the report sheet's pre-network check. */
export function checkLocalLimit(record, now) {
  return nextLimitState(record, now);
}

/** recordLocalSend(record, now, step) — the local record to persist after a successful send. */
export function recordLocalSend(record, now, step) {
  return { lastMs: now, dayMs: step.dayMs, count: step.count };
}
