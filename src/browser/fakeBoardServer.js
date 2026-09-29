// src/browser/fakeBoardServer.js
//
// Phase 83 (SRV-03, SRV-09), Plan 04 Task 1. The browser dev loop's
// in-memory stand-in for the live board — the Firestore/Identity Toolkit/
// Secure Token REST surfaces this project's three services expose
// (anonymous sign-up/refresh/delete, Firestore runQuery/runAggregationQuery/
// commit/document get/delete/patch), enforcing exactly the contract
// firebase/firestore.rules deploys through the same JS mirrors the rules
// are kept equal to: src/browser/runDoc.js's validateRunDoc (runs),
// src/browser/bugReport.js's validateReport and src/browser/reportLimits.js's
// validateLimitStep (bugReports/reportLimits). The shell selects this fake
// only in the browser dev loop (non-native); Android debug and release
// builds both talk to the live project — the shell makes that choice in
// Phases 84/85, not here. This module must be updated together with
// firebase/firestore.rules whenever the rules change (test/unit/
// firestore-rules.test.js is the contract that keeps the rules and their JS
// mirrors equal; this file is a third, hand-written mirror of the same
// contract, exercised by test/unit/fakeBoardServer.test.js instead).
//
// Phase 84 (BOARD-20, BOARD-22): a run create's `note`/`when` fields are
// enforced the same way here as by the live rules — commitRunCreate passes
// this factory's own injected `now()` into validateRunDoc so the fake's
// `when` upper bound tracks its own clock, not the live server's.
//
// `existsResponse` exists because the live answer to a duplicate run create
// (400 FAILED_PRECONDITION, 403 PERMISSION_DENIED or 409 ALREADY_EXISTS) is
// unverified until 83-08's live smoke test confirms which one Firestore
// actually returns; every later module that reads this fake's answer should
// treat all three as "already there, acknowledged".
//
// Pure, DOM-free: never calls a bare global fetch and never reads window,
// document, navigator or localStorage. The only side effects are in-memory
// (this module's own closures) and the injected `now()` clock.

import { RUN_COLLECTION, validateRunDoc, runDocId, LIST_LIMIT_MAX } from "./runDoc.js";
import { validateReport } from "./bugReport.js";
import { REPORT_LIMITS_COLLECTION, validateLimitStep, decodeLimitDoc } from "./reportLimits.js";
import { isValidHandle } from "./handles.js";
import {
  FIRESTORE_BASE,
  IDENTITY_BASE,
  SECURETOKEN_BASE,
  documentsPath,
  docName,
  toFirestoreFields,
  fromFirestoreFields,
  fromFirestoreValue,
} from "./firestoreRest.js";
import { FIREBASE_CONFIG } from "./firebaseConfig.js";

export const FAKE_ADMIN_TOKEN = "fake-admin-token";

const BUG_REPORTS_COLLECTION = "bugReports";
const BANNED_COLLECTION = "banned";

function errorBody(code, status) {
  return { error: { code, message: status, status } };
}

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) };
}

function parseUrl(rawUrl) {
  const qIndex = rawUrl.indexOf("?");
  const path = qIndex === -1 ? rawUrl : rawUrl.slice(0, qIndex);
  const query = new URLSearchParams(qIndex === -1 ? "" : rawUrl.slice(qIndex + 1));
  return { path, query };
}

function parseJsonBody(bodyStr) {
  if (typeof bodyStr !== "string") return null;
  try {
    return JSON.parse(bodyStr);
  } catch {
    return null;
  }
}

function findAuthHeader(init) {
  const headers = (init && init.headers) || {};
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === "authorization") return headers[key];
  }
  return undefined;
}

function splitName(name) {
  const parts = String(name).split("/");
  return { collection: parts[parts.length - 2], id: parts[parts.length - 1] };
}

function hasTransform(write, fieldPath) {
  return Array.isArray(write.updateTransforms) && write.updateTransforms.some((t) => t.fieldPath === fieldPath);
}

function matchesFilter(doc, where) {
  if (!where) return true;
  if (where.compositeFilter) {
    return where.compositeFilter.filters.every((f) => matchesFilter(doc, f));
  }
  if (where.fieldFilter) {
    const { field, op, value } = where.fieldFilter;
    const fieldPath = field.fieldPath;
    const have = doc[fieldPath];
    const want = fromFirestoreValue(value);
    if (op === "EQUAL") return have === want;
    if (op === "GREATER_THAN") return typeof have === "number" && typeof want === "number" && have > want;
    return false;
  }
  return false;
}

function sortRecords(records, orderBy) {
  const list = [...records];
  const hasNameOrder = orderBy.some((o) => o.field?.fieldPath === "__name__");
  list.sort((a, b) => {
    for (const o of orderBy) {
      const fp = o.field.fieldPath;
      const dir = o.direction === "DESCENDING" ? -1 : 1;
      const av = fp === "__name__" ? a.name : a.doc[fp];
      const bv = fp === "__name__" ? b.name : b.doc[fp];
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
    }
    if (!hasNameOrder) {
      if (a.name < b.name) return -1;
      if (a.name > b.name) return 1;
    }
    return 0;
  });
  return list;
}

/**
 * createFakeBoardFetch({ config, now, online, existsResponse,
 * anonymousEnabled, runs, tokenTtlMs }) — the in-memory fetchFn factory.
 * Returns { fetchFn, calls, docs, reports, limits, users, banned, setOnline,
 * ban, unban }. Never throws.
 */
export function createFakeBoardFetch(opts = {}) {
  const {
    config = FIREBASE_CONFIG,
    now = Date.now,
    online: initialOnline = true,
    existsResponse = "precondition",
    anonymousEnabled = true,
    runs: seedRuns = [],
    tokenTtlMs = 3600000,
  } = opts;

  let online = initialOnline !== false;

  const runStore = new Map(); // id -> { id, doc, createdAtIso, name, createTimeIso, updateTimeIso }
  const reports = new Map(); // id -> report fields (no uid)
  const limits = new Map(); // uid -> { lastMs, dayMs, count }
  const banned = new Set();
  const users = new Set();
  const idTokens = new Map(); // idToken -> { uid, issuedAtMs }
  const refreshTokens = new Map(); // refreshToken -> uid
  const calls = [];

  let uidCounter = 0;
  let tokenCounter = 0;

  function nowIso() {
    return new Date(now()).toISOString();
  }

  function nextUid() {
    uidCounter += 1;
    return `fakeuid${String(uidCounter).padStart(6, "0")}`;
  }

  function nextToken(prefix) {
    tokenCounter += 1;
    return `${prefix}${String(tokenCounter).padStart(8, "0")}`;
  }

  function denied() {
    return { status: 403, body: errorBody(403, "PERMISSION_DENIED") };
  }

  function notFound() {
    return { status: 404, body: errorBody(404, "NOT_FOUND") };
  }

  function existsError() {
    if (existsResponse === "denied") return { status: 403, body: errorBody(403, "PERMISSION_DENIED") };
    if (existsResponse === "conflict") return { status: 409, body: errorBody(409, "ALREADY_EXISTS") };
    return { status: 400, body: errorBody(400, "FAILED_PRECONDITION") };
  }

  function storeRun(id, clientDoc, createdAtIso) {
    runStore.set(id, {
      id,
      doc: Object.freeze({ ...clientDoc }),
      createdAtIso,
      name: docName(config, RUN_COLLECTION, id),
      createTimeIso: createdAtIso,
      updateTimeIso: createdAtIso,
    });
  }

  // Seed runs are inserted exactly as given (id + doc, matching
  // buildRunDoc's return shape), with no validation.
  for (const seed of Array.isArray(seedRuns) ? seedRuns : []) {
    if (!seed || typeof seed !== "object" || typeof seed.id !== "string") continue;
    const raw = seed.doc && typeof seed.doc === "object" ? seed.doc : {};
    const { createdAt, ...clientDoc } = raw;
    storeRun(seed.id, clientDoc, typeof createdAt === "string" ? createdAt : nowIso());
  }

  function encodeRunDocFields(clientDoc, createdAtIso) {
    return { ...toFirestoreFields(clientDoc), createdAt: { timestampValue: createdAtIso } };
  }

  function commitOkBody(n, timeIso) {
    return { writeResults: Array.from({ length: n }, () => ({ updateTime: timeIso })), commitTime: timeIso };
  }

  // --- auth --------------------------------------------------------------

  function authInfo(init, nowMs) {
    const header = findAuthHeader(init);
    if (typeof header !== "string") return { kind: "none" };
    const m = /^Bearer\s+(.+)$/.exec(header);
    if (!m) return { kind: "none" };
    const token = m[1];
    if (token === FAKE_ADMIN_TOKEN) return { kind: "admin" };
    const rec = idTokens.get(token);
    if (!rec) return { kind: "invalid" };
    if (nowMs > rec.issuedAtMs + tokenTtlMs) return { kind: "expired" };
    return { kind: "user", uid: rec.uid };
  }

  // --- identity: accounts:signUp / accounts:delete, securetoken:token ----

  function handleSignUp() {
    if (anonymousEnabled === false) return { status: 400, body: errorBody(400, "OPERATION_NOT_ALLOWED") };
    const uid = nextUid();
    const idToken = nextToken("idtok");
    const refreshToken = nextToken("rtok");
    idTokens.set(idToken, { uid, issuedAtMs: now() });
    refreshTokens.set(refreshToken, uid);
    users.add(uid);
    return { status: 200, body: { idToken, refreshToken, expiresIn: "3600", localId: uid } };
  }

  function handleAccountDelete(init) {
    const body = parseJsonBody(init.body);
    const idToken = body?.idToken;
    const rec = typeof idToken === "string" ? idTokens.get(idToken) : undefined;
    if (!rec) return { status: 400, body: errorBody(400, "INVALID_ID_TOKEN") };
    const { uid } = rec;
    for (const [tok, r] of [...idTokens]) if (r.uid === uid) idTokens.delete(tok);
    for (const [tok, u] of [...refreshTokens]) if (u === uid) refreshTokens.delete(tok);
    users.delete(uid);
    return { status: 200, body: {} };
  }

  function handleRefresh(init) {
    const params = new URLSearchParams(typeof init.body === "string" ? init.body : "");
    const refreshToken = params.get("refresh_token");
    const uid = refreshToken ? refreshTokens.get(refreshToken) : undefined;
    if (!uid) return { status: 400, body: errorBody(400, "INVALID_REFRESH_TOKEN") };
    const idToken = nextToken("idtok");
    idTokens.set(idToken, { uid, issuedAtMs: now() });
    return {
      status: 200,
      body: {
        access_token: idToken,
        id_token: idToken,
        refresh_token: refreshToken,
        expires_in: "3600",
        token_type: "Bearer",
        user_id: uid,
        project_id: config.projectId,
      },
    };
  }

  // --- runQuery / runAggregationQuery -------------------------------------

  function runQueryExec(structuredQuery, authKind) {
    if (!structuredQuery) return denied();
    const { from, where, orderBy = [], limit, startAt } = structuredQuery;
    const collectionId = from?.[0]?.collectionId;
    if (collectionId !== RUN_COLLECTION) return denied();
    if (authKind !== "admin") {
      if (!Number.isInteger(limit) || limit > LIST_LIMIT_MAX) return denied();
    }
    let records = [...runStore.values()];
    if (where) records = records.filter((r) => matchesFilter(r.doc, where));
    records = sortRecords(records, orderBy);
    if (startAt) {
      const cursorName = startAt.values?.[0]?.referenceValue;
      records = records.filter((r) => r.name > cursorName);
    }
    if (Number.isInteger(limit)) records = records.slice(0, limit);
    const hits = records.map((r) => ({
      document: { name: r.name, fields: encodeRunDocFields(r.doc, r.createdAtIso), createTime: r.createTimeIso, updateTime: r.updateTimeIso },
      readTime: nowIso(),
    }));
    return { status: 200, body: hits.length ? hits : [{ readTime: nowIso() }] };
  }

  function aggregationQueryExec(saq, authKind) {
    if (!saq) return denied();
    const { aggregations, structuredQuery } = saq;
    const collectionId = structuredQuery?.from?.[0]?.collectionId;
    if (collectionId !== RUN_COLLECTION) return denied();
    let records = [...runStore.values()];
    if (structuredQuery.where) records = records.filter((r) => matchesFilter(r.doc, structuredQuery.where));
    const alias = aggregations?.[0]?.alias || "count";
    return { status: 200, body: [{ result: { aggregateFields: { [alias]: { integerValue: String(records.length) } } }, readTime: nowIso() }] };
  }

  // --- :commit -------------------------------------------------------------
  //
  // Multi-write commits: handleUpdateCommit and deleteCommit can each carry
  // N writes for the SAME collection (the "re-roll rewrites handle on all
  // of the player's existing runs" flow, CONTEXT "Identity & the @handle").
  // These are validated as a batch (every write must be individually valid)
  // and applied only once every write in the batch passes — one failing
  // write changes nothing.

  function classifyWrite(write) {
    if (write.delete) {
      const { collection, id } = splitName(write.delete);
      return { kind: "delete", collection, id, write };
    }
    if (write.update) {
      const { collection, id } = splitName(write.update.name);
      if (write.updateMask) return { kind: "handleUpdate", collection, id, write };
      if (hasTransform(write, "createdAt")) return { kind: "runCreate", collection, id, write };
      if (hasTransform(write, "last")) return { kind: "limitWrite", collection, id, write };
      if (write.currentDocument?.exists === false && !(write.updateTransforms?.length > 0)) return { kind: "reportCreate", collection, id, write };
    }
    return { kind: "unknown", collection: null, id: null, write };
  }

  function validateRunDeleteWrite(c, authKind, authUid) {
    const rec = runStore.get(c.id);
    if (!rec || authKind !== "user" || rec.doc.uid !== authUid) return null;
    return { apply: () => runStore.delete(c.id) };
  }

  function validateHandleUpdateWrite(c, authKind, authUid) {
    const rec = runStore.get(c.id);
    const fieldPaths = c.write.updateMask?.fieldPaths;
    const validMask = Array.isArray(fieldPaths) && fieldPaths.length === 1 && fieldPaths[0] === "handle";
    const fields = fromFirestoreFields(c.write.update.fields);
    const ownerOk = !!rec && authKind === "user" && rec.doc.uid === authUid;
    const handleOk = isValidHandle(fields.handle);
    if (!validMask || !ownerOk || !handleOk) return null;
    return {
      apply: () => {
        const updateTimeIso = nowIso();
        runStore.set(c.id, { ...rec, doc: Object.freeze({ ...rec.doc, handle: fields.handle }), updateTimeIso });
      },
    };
  }

  function applyAtomic(classified, validate) {
    const applies = [];
    for (const c of classified) {
      const v = validate(c);
      if (!v) return denied();
      applies.push(v.apply);
    }
    for (const apply of applies) apply();
    return { status: 200, body: commitOkBody(classified.length, nowIso()) };
  }

  function commitRunCreate(id, write, authKind, authUid) {
    const clientDoc = fromFirestoreFields(write.update.fields);
    if (authKind === "user") {
      if (clientDoc.uid !== authUid) return denied();
      if (id !== runDocId(authUid, clientDoc.hash)) return denied();
      if (banned.has(authUid)) return denied();
      if (validateRunDoc(clientDoc, { uid: authUid, now: now() }).length > 0) return denied();
    } else if (authKind === "admin") {
      if (validateRunDoc(clientDoc, { now: now() }).length > 0) return denied();
    } else {
      return denied();
    }
    if (runStore.has(id)) return existsError();
    const createdAtIso = nowIso();
    storeRun(id, clientDoc, createdAtIso);
    return { status: 200, body: commitOkBody(1, createdAtIso) };
  }

  function commitLimitOnly(uid, write, authKind, authUid) {
    if (!(authKind === "user" && authUid === uid)) return denied();
    const before = limits.has(uid) ? limits.get(uid) : null;
    const fields = fromFirestoreFields(write.update.fields);
    const nowMs = now();
    const after = { lastMs: nowMs, dayMs: Date.parse(fields.day), count: fields.count };
    const create = !limits.has(uid);
    const wantExists = write.currentDocument?.exists;
    if (create && wantExists !== false) return denied();
    if (!create && wantExists !== true) return denied();
    if (validateLimitStep(before, after, nowMs).length > 0) return denied();
    limits.set(uid, after);
    return { status: 200, body: commitOkBody(1, nowIso()) };
  }

  function commitReportPlusLimit(reportId, reportWrite, uid, limitWrite, authKind, authUid) {
    if (authKind !== "user" || authUid !== uid) return denied();
    if (reports.has(reportId)) return denied();
    const report = fromFirestoreFields(reportWrite.update.fields);
    if (validateReport(report).length > 0) return denied();
    const before = limits.has(uid) ? limits.get(uid) : null;
    const limitFields = fromFirestoreFields(limitWrite.update.fields);
    const nowMs = now();
    const after = { lastMs: nowMs, dayMs: Date.parse(limitFields.day), count: limitFields.count };
    const create = !limits.has(uid);
    const wantExists = limitWrite.currentDocument?.exists;
    if (create && wantExists !== false) return denied();
    if (!create && wantExists !== true) return denied();
    if (validateLimitStep(before, after, nowMs).length > 0) return denied();
    reports.set(reportId, Object.freeze({ ...report }));
    limits.set(uid, after);
    return { status: 200, body: commitOkBody(2, nowIso()) };
  }

  function commitDispatch(body, authKind, authUid) {
    const writes = Array.isArray(body?.writes) ? body.writes : [];
    if (writes.length === 0) return denied();
    const classified = writes.map(classifyWrite);

    if (classified.every((c) => c.kind === "delete" && c.collection === RUN_COLLECTION)) {
      return applyAtomic(classified, (c) => validateRunDeleteWrite(c, authKind, authUid));
    }
    if (classified.every((c) => c.kind === "handleUpdate" && c.collection === RUN_COLLECTION)) {
      return applyAtomic(classified, (c) => validateHandleUpdateWrite(c, authKind, authUid));
    }
    if (writes.length === 1 && classified[0].kind === "runCreate" && classified[0].collection === RUN_COLLECTION) {
      return commitRunCreate(classified[0].id, classified[0].write, authKind, authUid);
    }
    if (writes.length === 1 && classified[0].kind === "limitWrite" && classified[0].collection === REPORT_LIMITS_COLLECTION) {
      return commitLimitOnly(classified[0].id, classified[0].write, authKind, authUid);
    }
    if (
      writes.length === 2 &&
      classified[0].kind === "reportCreate" &&
      classified[0].collection === BUG_REPORTS_COLLECTION &&
      classified[1].kind === "limitWrite" &&
      classified[1].collection === REPORT_LIMITS_COLLECTION
    ) {
      return commitReportPlusLimit(classified[0].id, classified[0].write, classified[1].id, classified[1].write, authKind, authUid);
    }
    return denied();
  }

  // --- document get/delete/patch: runs, banned, reportLimits, bugReports --

  function handleRunGet(id) {
    const rec = runStore.get(id);
    if (!rec) return notFound();
    return { status: 200, body: { name: rec.name, fields: encodeRunDocFields(rec.doc, rec.createdAtIso), createTime: rec.createTimeIso, updateTime: rec.updateTimeIso } };
  }

  function handleRunDeleteDoc(id, authKind) {
    if (authKind !== "admin") return denied();
    runStore.delete(id);
    return { status: 200, body: {} };
  }

  function encodeLimitFields(rec) {
    return {
      last: { timestampValue: new Date(rec.lastMs).toISOString() },
      day: { timestampValue: new Date(rec.dayMs).toISOString() },
      count: { integerValue: String(rec.count) },
    };
  }

  function handleLimitGet(uid, authKind, authUid) {
    const allowed = (authKind === "user" && authUid === uid) || authKind === "admin";
    if (!allowed) return denied();
    const rec = limits.get(uid);
    if (!rec) return notFound();
    const timeIso = new Date(rec.lastMs).toISOString();
    return { status: 200, body: { name: docName(config, REPORT_LIMITS_COLLECTION, uid), fields: encodeLimitFields(rec), createTime: timeIso, updateTime: timeIso } };
  }

  function handleLimitPatch(uid, init, authKind) {
    if (authKind !== "admin") return denied();
    const body = parseJsonBody(init.body);
    const decoded = decodeLimitDoc(body?.fields);
    if (!decoded) return { status: 400, body: errorBody(400, "INVALID_ARGUMENT") };
    limits.set(uid, decoded);
    return { status: 200, body: {} };
  }

  function handleLimitDelete(uid, authKind) {
    if (authKind !== "admin") return denied();
    limits.delete(uid);
    return { status: 200, body: {} };
  }

  function handleBannedPatch(uid, authKind) {
    if (authKind !== "admin") return denied();
    banned.add(uid);
    return { status: 200, body: {} };
  }

  function handleBannedDelete(uid, authKind) {
    if (authKind !== "admin") return denied();
    banned.delete(uid);
    return { status: 200, body: {} };
  }

  function handleBugReportGet(id, authKind) {
    if (authKind !== "admin") return denied();
    const rec = reports.get(id);
    if (!rec) return notFound();
    const timeIso = nowIso();
    return { status: 200, body: { name: docName(config, BUG_REPORTS_COLLECTION, id), fields: toFirestoreFields(rec), createTime: timeIso, updateTime: timeIso } };
  }

  // --- routing --------------------------------------------------------------

  function route(path, method, init, auth) {
    if (path === `${IDENTITY_BASE}/accounts:signUp` && method === "POST") return handleSignUp();
    if (path === `${IDENTITY_BASE}/accounts:delete` && method === "POST") return handleAccountDelete(init);
    if (path === `${SECURETOKEN_BASE}/token` && method === "POST") return handleRefresh(init);

    const firestorePrefix = `${FIRESTORE_BASE}/${documentsPath(config)}`;
    if (path.startsWith(firestorePrefix)) {
      const suffix = path.slice(firestorePrefix.length);

      if (suffix === ":runQuery" && method === "POST") {
        const body = parseJsonBody(init.body);
        return runQueryExec(body?.structuredQuery, auth.kind);
      }
      if (suffix === ":runAggregationQuery" && method === "POST") {
        const body = parseJsonBody(init.body);
        return aggregationQueryExec(body?.structuredAggregationQuery, auth.kind);
      }
      if (suffix === ":commit" && method === "POST") {
        if (auth.kind === "invalid" || auth.kind === "expired") return { status: 401, body: errorBody(401, "UNAUTHENTICATED") };
        const body = parseJsonBody(init.body);
        return commitDispatch(body, auth.kind, auth.uid);
      }
      // A bare collection-level GET (no document id) is a list attempt.
      // bugReports and reportLimits both deny list unconditionally in
      // firebase/firestore.rules ("list: if false") — modeled here (Phase
      // 83-09) so tools/bug-reports/send-test-report.mjs's list-read and
      // list-limits probes can prove the same deny against this fake.
      if (method === "GET" && (suffix === `/${BUG_REPORTS_COLLECTION}` || suffix === `/${REPORT_LIMITS_COLLECTION}`)) {
        return denied();
      }
      if (suffix.startsWith("/runs/")) {
        const id = suffix.slice("/runs/".length);
        if (method === "GET") return handleRunGet(id);
        if (method === "DELETE") return handleRunDeleteDoc(id, auth.kind);
      }
      if (suffix.startsWith(`/${BANNED_COLLECTION}/`)) {
        const uid = suffix.slice(BANNED_COLLECTION.length + 2);
        if (method === "PATCH") return handleBannedPatch(uid, auth.kind);
        if (method === "DELETE") return handleBannedDelete(uid, auth.kind);
      }
      if (suffix.startsWith(`/${REPORT_LIMITS_COLLECTION}/`)) {
        const uid = suffix.slice(REPORT_LIMITS_COLLECTION.length + 2);
        if (method === "GET") return handleLimitGet(uid, auth.kind, auth.uid);
        if (method === "PATCH") return handleLimitPatch(uid, init, auth.kind);
        if (method === "DELETE") return handleLimitDelete(uid, auth.kind);
      }
      if (suffix.startsWith(`/${BUG_REPORTS_COLLECTION}/`)) {
        const id = suffix.slice(BUG_REPORTS_COLLECTION.length + 2);
        if (method === "GET") return handleBugReportGet(id, auth.kind);
      }
    }

    return notFound();
  }

  function fetchFn(rawUrl, init = {}) {
    return new Promise((resolve, reject) => {
      if (!online) {
        reject(new TypeError("Failed to fetch"));
        return;
      }
      try {
        const method = (init.method || "GET").toUpperCase();
        const nowMs = now();
        const auth = authInfo(init, nowMs);
        calls.push(Object.freeze({ method, url: rawUrl, auth: auth.kind === "admin" ? "admin" : auth.kind === "user" ? "user" : "none" }));

        const { path, query } = parseUrl(rawUrl);
        if (auth.kind !== "admin" && query.get("key") !== config.apiKey) {
          resolve(jsonResponse(400, errorBody(400, "INVALID_ARGUMENT")));
          return;
        }

        const result = route(path, method, init, auth);
        resolve(jsonResponse(result.status, result.body));
      } catch (err) {
        resolve(jsonResponse(500, errorBody(500, "INTERNAL")));
      }
    });
  }

  // --- inspectors -----------------------------------------------------------

  function callsInspector() {
    return Object.freeze([...calls]);
  }

  function docsInspector() {
    return Object.freeze([...runStore.values()].map((r) => Object.freeze({ id: r.id, ...r.doc, createdAt: r.createdAtIso })));
  }

  function reportsInspector() {
    return Object.freeze([...reports.entries()].map(([id, rep]) => Object.freeze({ id, ...rep })));
  }

  function limitsInspector() {
    return Object.freeze([...limits.entries()].map(([uid, rec]) => Object.freeze({ uid, lastMs: rec.lastMs, dayMs: rec.dayMs, count: rec.count })));
  }

  function usersInspector() {
    return Object.freeze([...users]);
  }

  function bannedInspector() {
    return Object.freeze([...banned]);
  }

  function setOnline(value) {
    online = value === true;
  }

  function ban(uid) {
    banned.add(uid);
  }

  function unban(uid) {
    banned.delete(uid);
  }

  return Object.freeze({
    fetchFn,
    calls: callsInspector,
    docs: docsInspector,
    reports: reportsInspector,
    limits: limitsInspector,
    users: usersInspector,
    banned: bannedInspector,
    setOnline,
    ban,
    unban,
  });
}
