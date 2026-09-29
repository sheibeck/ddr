// src/browser/bugReport.js
//
// Phase 79.3 (D-03, D-04, D-07, D-11, D-12, D-13). The pure, DOM-free client
// half of REPORT A BUG. The network is reached only through the injected
// fetchFn passed to sendBugReport — this module never calls the global
// fetch, and never reads window, document, navigator or storage. It holds
// no player copy: every failure reason below is an id from REPORT_REASONS
// that the report sheet (79.3-05) maps to house-voice copy.
//
// buildReportPayload turns plain inputs (the player's text, the Oracle's
// DOM-order HTML entries, the stamped version, the user agent, the
// Capacitor platform, the live state and a clock) into one Firestore
// document shaped exactly like firebase/firestore.rules#isValidReport
// accepts. validateReport is the JS mirror of those rules (kept equal by
// test/unit/firestore-rules.test.js), so buildReportPayload can never
// produce a payload the live rules would refuse. toFirestoreFields encodes
// the plain report into the REST API's typed-value JSON. sendBugReport
// races an injected fetchFn against a timeout and never throws or rejects:
// it resolves ok, or one of REPORT_REASONS.
//
// Phase 83: the typed-value encoder and FIRESTORE_BASE now live in
// firestoreRest.js (the one shared encoder every board module reuses); this
// module imports and re-exports both so every existing caller/test keeps
// working unchanged.

import { BUG_REPORT_CONFIG } from "./bugReportConfig.js";
import { FIRESTORE_BASE, toFirestoreFields } from "./firestoreRest.js";

export { FIRESTORE_BASE, toFirestoreFields };

export const REPORT_SCHEMA = 1;

export const REQUIRED_REPORT_FIELDS = Object.freeze([
  "schema",
  "status",
  "text",
  "oracle",
  "oracleLines",
  "version",
  "platform",
  "device",
  "clientTime",
]);

export const REPORT_FIELDS = Object.freeze([...REQUIRED_REPORT_FIELDS, "run"]);

export const RUN_FIELDS = Object.freeze(["depth", "cls", "sub", "race", "level", "steps", "day", "dead"]);

export const TEXT_MAX_CHARS = 2000;
export const ORACLE_MAX_CHARS = 100000;
export const ORACLE_LINES_MAX = 1000;
export const VERSION_MAX_CHARS = 64;
export const PLATFORM_MAX_CHARS = 16;
export const DEVICE_MAX_CHARS = 400;
export const CLIENT_TIME_MAX_CHARS = 40;
export const RUN_STRING_MAX_CHARS = 40;
export const RUN_INT_MAX = 1000000000;
export const SEND_TIMEOUT_MS = 15000;

export const REPORT_REASONS = Object.freeze(["unavailable", "offline", "refused", "server"]);

const HIGH_SURROGATE_MIN = 0xd800;
const HIGH_SURROGATE_MAX = 0xdbff;

const NAMED_ENTITIES = Object.freeze({
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  minus: "−",
  times: "×",
  middot: "·",
});

const BR_RE = /<br\s*\/?>/gi;
const TAG_RE = /<[^>]*>/g;
const NAMED_ENTITY_RE = /&([a-zA-Z]+);/g;
const DECIMAL_ENTITY_RE = /&#(\d+);/g;
const HEX_ENTITY_RE = /&#x([0-9a-fA-F]+);/g;
const WHITESPACE_RE = /\s+/g;

const API_KEY_RE = /^AIza[0-9A-Za-z_-]{35}$/;
const PROJECT_ID_RE = /^[a-z0-9-]{6,30}$/;

/** clampChars(s, max) — slice to max UTF-16 units, then drop a trailing lone high surrogate. */
function clampChars(s, max) {
  if (s.length <= max) return s;
  let sliced = s.slice(0, max);
  const last = sliced.charCodeAt(sliced.length - 1);
  if (last >= HIGH_SURROGATE_MIN && last <= HIGH_SURROGATE_MAX) sliced = sliced.slice(0, -1);
  return sliced;
}

function decodeEntities(s) {
  let out = s.replace(NAMED_ENTITY_RE, (full, name) => (Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, name) ? NAMED_ENTITIES[name] : full));
  out = out.replace(DECIMAL_ENTITY_RE, (full, d) => {
    try {
      return String.fromCodePoint(Number(d));
    } catch {
      return full;
    }
  });
  out = out.replace(HEX_ENTITY_RE, (full, h) => {
    try {
      return String.fromCodePoint(parseInt(h, 16));
    } catch {
      return full;
    }
  });
  return out;
}

function processOracleEntry(entry) {
  let s = String(entry);
  s = s.replace(BR_RE, " ");
  s = s.replace(TAG_RE, "");
  s = decodeEntities(s);
  s = s.replace(WHITESPACE_RE, " ").trim();
  return s;
}

/**
 * oracleTextFromHtml(entries) — entries is the Oracle's `#log` children in
 * DOM order (newest first). Returns { text, lines }: text is plain, oldest
 * line first, joined with newline, capped at ORACLE_MAX_CHARS by dropping
 * the oldest lines first; lines is the kept line count.
 */
export function oracleTextFromHtml(entries) {
  if (!Array.isArray(entries)) return { text: "", lines: 0 };
  const processed = [];
  for (const entry of entries) {
    const text = processOracleEntry(entry);
    if (text) processed.push(text);
  }
  processed.reverse();
  let lines = processed;
  let joined = lines.join("\n");
  while (joined.length > ORACLE_MAX_CHARS && lines.length > 1) {
    lines = lines.slice(1);
    joined = lines.join("\n");
  }
  if (joined.length > ORACLE_MAX_CHARS) joined = clampChars(joined, ORACLE_MAX_CHARS);
  return { text: joined, lines: lines.length };
}

function toRunInt(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  const truncated = Math.trunc(n);
  if (truncated < 0) return 0;
  if (truncated > RUN_INT_MAX) return RUN_INT_MAX;
  return truncated;
}

function runStringField(v) {
  if (v === undefined || v === null) return "";
  return clampChars(String(v), RUN_STRING_MAX_CHARS);
}

/**
 * runContextFrom(state) — a frozen RUN_FIELDS map read from a live
 * GameState, or null when there is no hero yet (a falsy/non-object state,
 * or a state with no `c`) or a getter throws. Never mutates state.
 */
export function runContextFrom(state) {
  try {
    if (typeof state !== "object" || state === null) return null;
    const c = state.c;
    if (typeof c !== "object" || c === null) return null;
    return Object.freeze({
      depth: toRunInt(state.floor?.depth),
      cls: runStringField(c.cls),
      sub: runStringField(c.sub),
      race: runStringField(c.race),
      level: toRunInt(c.level),
      steps: toRunInt(state.steps),
      day: toRunInt(state.day),
      dead: state.dead === true,
    });
  } catch {
    return null;
  }
}

function normalizeVersion(v) {
  const s = typeof v === "string" ? v.trim() : "";
  const clamped = clampChars(s, VERSION_MAX_CHARS);
  return clamped === "" ? "unknown" : clamped;
}

function normalizePlatform(v) {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  const clamped = clampChars(s, PLATFORM_MAX_CHARS);
  return clamped === "" ? "unknown" : clamped;
}

function normalizeDevice(v) {
  const s = typeof v === "string" ? v.replace(WHITESPACE_RE, " ").trim() : "";
  const clamped = clampChars(s, DEVICE_MAX_CHARS);
  return clamped === "" ? "unknown" : clamped;
}

function normalizeClientTime(now) {
  try {
    if (now instanceof Date && !Number.isNaN(now.getTime())) return clampChars(now.toISOString(), CLIENT_TIME_MAX_CHARS);
    return "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * buildReportPayload({ text, oracleEntries, version, userAgent, platform,
 * state, now }) — { ok: false, reason: "empty" } for blank/whitespace-only
 * text, else { ok: true, report } with the REPORT_FIELDS keys in order
 * (`run` present only when the state has a hero). Never reads a global.
 */
export function buildReportPayload({ text, oracleEntries, version, userAgent, platform, state, now } = {}) {
  const trimmedText = typeof text === "string" ? text.trim() : "";
  if (!trimmedText) return { ok: false, reason: "empty" };
  const clampedText = clampChars(trimmedText, TEXT_MAX_CHARS);
  const { text: oracle, lines: oracleLines } = oracleTextFromHtml(oracleEntries);
  const report = {
    schema: REPORT_SCHEMA,
    status: "new",
    text: clampedText,
    oracle,
    oracleLines,
    version: normalizeVersion(version),
    platform: normalizePlatform(platform),
    device: normalizeDevice(userAgent),
    clientTime: normalizeClientTime(now),
  };
  const run = runContextFrom(state);
  if (run) report.run = run;
  return { ok: true, report };
}

function isValidRunShape(run) {
  if (typeof run !== "object" || run === null) return false;
  const keys = Object.keys(run);
  if (!RUN_FIELDS.every((k) => keys.includes(k))) return false;
  if (!keys.every((k) => RUN_FIELDS.includes(k))) return false;
  for (const k of ["depth", "level", "steps", "day"]) {
    if (!(Number.isInteger(run[k]) && run[k] >= 0 && run[k] <= RUN_INT_MAX)) return false;
  }
  for (const k of ["cls", "sub", "race"]) {
    if (!(typeof run[k] === "string" && run[k].length <= RUN_STRING_MAX_CHARS)) return false;
  }
  return typeof run.dead === "boolean";
}

/**
 * validateReport(report) — the JS mirror of firebase/firestore.rules'
 * isValidReport/isValidRun. Returns an array of failing ids (each a single
 * lowercase word); [] means the rules would accept a create with this data.
 */
export function validateReport(report) {
  const fails = [];
  if (typeof report !== "object" || report === null) return ["keys"];
  const keys = Object.keys(report);
  const hasAllRequired = REQUIRED_REPORT_FIELDS.every((k) => keys.includes(k));
  const onlyAllowed = keys.every((k) => REPORT_FIELDS.includes(k));
  if (!hasAllRequired || !onlyAllowed) fails.push("keys");
  if (!(Number.isInteger(report.schema) && report.schema === REPORT_SCHEMA)) fails.push("schema");
  if (!(typeof report.status === "string" && report.status === "new")) fails.push("status");
  if (!(typeof report.text === "string" && report.text.length >= 1 && report.text.length <= TEXT_MAX_CHARS)) fails.push("text");
  if (!(typeof report.oracle === "string" && report.oracle.length <= ORACLE_MAX_CHARS)) fails.push("oracle");
  if (!(Number.isInteger(report.oracleLines) && report.oracleLines >= 0 && report.oracleLines <= ORACLE_LINES_MAX)) fails.push("oraclelines");
  if (!(typeof report.version === "string" && report.version.length >= 1 && report.version.length <= VERSION_MAX_CHARS)) fails.push("version");
  if (!(typeof report.platform === "string" && report.platform.length >= 1 && report.platform.length <= PLATFORM_MAX_CHARS)) fails.push("platform");
  if (!(typeof report.device === "string" && report.device.length >= 1 && report.device.length <= DEVICE_MAX_CHARS)) fails.push("device");
  if (!(typeof report.clientTime === "string" && report.clientTime.length >= 1 && report.clientTime.length <= CLIENT_TIME_MAX_CHARS)) fails.push("clienttime");
  if ("run" in report && !isValidRunShape(report.run)) fails.push("run");
  return fails;
}

/** reportingAvailable(config) — a restricted-looking key and a plausible project id, both present. */
export function reportingAvailable(config) {
  if (typeof config !== "object" || config === null) return false;
  const keyOk = typeof config.apiKey === "string" && API_KEY_RE.test(config.apiKey);
  const idOk = typeof config.projectId === "string" && PROJECT_ID_RE.test(config.projectId);
  return keyOk && idOk;
}

/** reportsEndpoint(config) — the Firestore REST create URL for config.collection. */
export function reportsEndpoint(config) {
  return `${FIRESTORE_BASE}/projects/${config.projectId}/databases/(default)/documents/${config.collection}?key=${encodeURIComponent(config.apiKey)}`;
}

/** reportIdFromName(name) — the last `/`-segment of a Firestore document name, or null. */
export function reportIdFromName(name) {
  if (typeof name !== "string" || name === "") return null;
  const idx = name.lastIndexOf("/");
  return idx === -1 ? name : name.slice(idx + 1);
}

/**
 * sendBugReport(report, opts) — POSTs report through opts.fetchFn as a
 * Firestore REST create. Never throws or rejects: resolves { ok: true, id }
 * on success, or { ok: false, reason } with reason one of REPORT_REASONS.
 * Checks, in order: config availability, fetchFn presence, online, then
 * validateReport. The abort/timeout race always clears its timer.
 */
export async function sendBugReport(report, opts = {}) {
  const {
    fetchFn,
    config = BUG_REPORT_CONFIG,
    online = true,
    timeoutMs = SEND_TIMEOUT_MS,
    setTimer = globalThis.setTimeout,
    clearTimer = globalThis.clearTimeout,
    AbortCtl = globalThis.AbortController,
  } = opts;
  try {
    if (!reportingAvailable(config)) return { ok: false, reason: "unavailable" };
    if (typeof fetchFn !== "function") return { ok: false, reason: "unavailable" };
    if (online === false) return { ok: false, reason: "offline" };
    if (validateReport(report).length > 0) return { ok: false, reason: "refused" };

    const url = reportsEndpoint(config);
    const body = JSON.stringify({ fields: toFirestoreFields(report) });
    let controller = null;
    let signal;
    if (AbortCtl) {
      controller = new AbortCtl();
      signal = controller.signal;
    }
    const init = { method: "POST", headers: { "Content-Type": "application/json" }, body };
    if (signal) init.signal = signal;

    let timerId = null;
    const timeoutPromise = new Promise((resolve) => {
      timerId = setTimer(() => {
        if (controller) controller.abort();
        resolve({ timedOut: true });
      }, timeoutMs);
    });

    try {
      const raced = await Promise.race([
        fetchFn(url, init).then((res) => ({ timedOut: false, res })).catch((err) => ({ timedOut: false, err })),
        timeoutPromise,
      ]);
      if (raced.timedOut || raced.err) return { ok: false, reason: "offline" };
      const res = raced.res;
      if (res.ok) {
        let json = null;
        try {
          json = await res.json();
        } catch {
          json = null;
        }
        return { ok: true, id: reportIdFromName(json?.name) };
      }
      if (res.status === 429 || res.status >= 500) return { ok: false, reason: "server" };
      if (res.status >= 400) return { ok: false, reason: "refused" };
      return { ok: false, reason: "server" };
    } finally {
      if (timerId !== null) clearTimer(timerId);
    }
  } catch {
    return { ok: false, reason: "offline" };
  }
}
