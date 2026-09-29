// src/browser/boardWrites.js
//
// Phase 83 (SRV-01, the client half of "each run stored once; resubmitting
// never duplicates"). The board write client: submitRun (idempotent run
// create), rewriteHandle (a handle re-roll rewritten onto every one of the
// player's existing runs) and eraseMyRuns (owner delete-everything, then
// drop the local identity). CONTEXT "The run document" / "Identity & the
// @handle". Pure, DOM-free: no window/document/navigator/localStorage, no
// bare global fetch — the network is reached only through the injected
// fetchFn, and durable identity state lives entirely behind the injected
// `identity` (src/browser/firebaseAuth.js#createIdentity, Phase 83-03).
//
// The idempotence argument (RESEARCH Pitfall 1 / Assumption A3): a run
// create always carries the currentDocument.exists:false precondition
// (runDoc.js#createRunCommit) on doc id `{uid}_{hash}`. The live project's
// exact answer to "already there" is unverified until 83-08's live smoke
// test — it could be a 400 FAILED_PRECONDITION, a 403 PERMISSION_DENIED or a
// 409 ALREADY_EXISTS. classifyWrite() below treats all three the same way,
// as "ambiguous", and submitRun resolves the ambiguity with exactly ONE
// public GET (no Authorization) of runs/{id}: a 200 whose decoded uid
// matches the caller's own uid means the run is already on the board
// (acknowledged, status "exists"); a 404 means the create was genuinely
// refused (the doc never landed — e.g. a banned uid) and the ORIGINAL
// create response's error status is what the caller sees. This makes a
// resubmit of the same run idempotent no matter which of the three answers
// the live project actually returns.
//
// rewriteHandle rewrites `handle` on every one of the caller's own runs,
// paged by runDoc.js#LIST_LIMIT_MAX (the rules' own list-read cap), using
// handle-only commits (runDoc.js#handleUpdateCommit) — the rules allow the
// owner to update ONLY the `handle` field of their own runs.
//
// eraseMyRuns deletes every one of the caller's own runs (paged the same
// way, oldest page repeated since each delete round shrinks the set), then
// deletes the anonymous account best-effort (so no orphaned anonymous
// account remains — CONTEXT "Claude's Discretion"), then drops
// ddr.identity.v1. A failure before that last drop leaves the identity
// stored, so a retry can pick up where it left off.
//
// A 401 (or a REST UNAUTHENTICATED status) on any request forces exactly
// one identity.forceRefresh() and one retry, shared across a whole
// submitRun/rewriteHandle/eraseMyRuns call — never a second retry.

import { FIREBASE_CONFIG } from "./firebaseConfig.js";
import { firestoreUrl, timedFetch, readJson, restError } from "./firestoreRest.js";
import { buildRunDoc, createRunCommit, handleUpdateCommit, deleteCommit, ownRunsQuery, RUN_COLLECTION, LIST_LIMIT_MAX } from "./runDoc.js";
import { decodeRunDocument } from "./boardClient.js";
import { isValidHandle } from "./handles.js";

export const WRITE_REASONS = Object.freeze(["off", "offline", "server", "refused", "invalid", "auth", "unavailable"]);

const ERASE_PAGE_GUARD = 200;

/**
 * classifyWrite(status, json) — the REST-status classifier every write path
 * shares: "ok" (2xx), "auth" (401, or a REST error whose `.status` is
 * UNAUTHENTICATED), "server" (429 or >=500), "ambiguous" (400, 403 or 409 —
 * the three possible "already there" answers on a run create) or "refused"
 * (anything else). Never throws.
 */
export function classifyWrite(status, json) {
  if (typeof status === "number" && status >= 200 && status < 300) return "ok";
  const { status: errStatus } = restError(json);
  if (status === 401 || errStatus === "UNAUTHENTICATED") return "auth";
  if (status === 429 || (typeof status === "number" && status >= 500)) return "server";
  if (status === 400 || status === 403 || status === 409) return "ambiguous";
  return "refused";
}

/**
 * nonCreateReason(status, json) — module-private: the failure result for a
 * non-create write (handle update, delete, own-runs query) whose response
 * classified as "ambiguous" or "refused" — both map to plain "refused" here,
 * since neither has a create's GET-settled idempotence meaning. "server"
 * passes through unchanged. Always carries the REST error's `.status` when
 * present.
 */
function nonCreateReason(status, json) {
  const cls = classifyWrite(status, json);
  const { status: errStatus } = restError(json);
  if (cls === "server") return { reason: "server" };
  return errStatus ? { reason: "refused", status: errStatus } : { reason: "refused" };
}

/**
 * createBoardWrites({ fetchFn, identity, config = FIREBASE_CONFIG,
 * timeoutMs, setTimer, clearTimer, AbortCtl }) — returns frozen
 * { submitRun, rewriteHandle, eraseMyRuns }. `identity` is the object
 * returned by src/browser/firebaseAuth.js#createIdentity (getToken,
 * forceRefresh, snapshot, deleteAccount, drop). Never throws.
 */
export function createBoardWrites(opts = {}) {
  const { fetchFn, identity, config = FIREBASE_CONFIG, timeoutMs, setTimer, clearTimer, AbortCtl } = opts;

  function timedOpts() {
    const o = {};
    if (timeoutMs !== undefined) o.timeoutMs = timeoutMs;
    if (setTimer !== undefined) o.setTimer = setTimer;
    if (clearTimer !== undefined) o.clearTimer = clearTimer;
    if (AbortCtl !== undefined) o.AbortCtl = AbortCtl;
    return o;
  }

  // request(url, init) — the shared timed-fetch-and-decode step. Resolves
  // { kind: "offline" } or { kind: "response", ok, status, json }.
  async function request(url, init) {
    const raced = await timedFetch(fetchFn, url, init, timedOpts());
    if (!raced.ok) return { kind: "offline" };
    const res = raced.res;
    const json = await readJson(res);
    return { kind: "response", ok: res.ok, status: res.status, json };
  }

  function bearerInit(body, idToken) {
    return {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify(body),
    };
  }

  // requestWithRetry(url, makeInit, tokenBox) — a bearer-authorized request
  // with the shared one-retry-on-auth budget (tokenBox.retried, mutated in
  // place so the budget is spent once per outer call, not once per page).
  // Resolves { ok: true, json } or { ok: false, reason, status? }.
  async function requestWithRetry(url, makeInit, tokenBox) {
    let attempt = await request(url, makeInit(tokenBox.idToken));
    if (attempt.kind === "offline") return { ok: false, reason: "offline" };
    if (attempt.ok) return { ok: true, json: attempt.json };

    const cls = classifyWrite(attempt.status, attempt.json);
    if (cls === "auth" && !tokenBox.retried) {
      const refreshed = await identity.forceRefresh();
      if (!refreshed.ok) return { ok: false, reason: refreshed.reason };
      tokenBox.idToken = refreshed.idToken;
      tokenBox.uid = refreshed.uid;
      tokenBox.retried = true;
      attempt = await request(url, makeInit(tokenBox.idToken));
      if (attempt.kind === "offline") return { ok: false, reason: "offline" };
      if (attempt.ok) return { ok: true, json: attempt.json };
    }
    return { ok: false, ...nonCreateReason(attempt.status, attempt.json) };
  }

  // resolveAmbiguousCreate — the GET-settled idempotence argument (see the
  // module header). No Authorization header: board reads are public.
  async function resolveAmbiguousCreate(id, uid, originalStatus) {
    const url = firestoreUrl(config, `/${RUN_COLLECTION}/${id}`);
    const attempt = await request(url, { method: "GET" });
    if (attempt.kind === "offline") return { ok: false, reason: "offline" };
    if (attempt.status === 404) return { ok: false, reason: "refused", status: originalStatus };
    if (attempt.ok) {
      const decoded = decodeRunDocument(attempt.json);
      if (decoded.uid === uid) return { ok: true, status: "exists", id };
      return { ok: false, reason: "refused", status: originalStatus };
    }
    if (attempt.status === 429 || attempt.status >= 500) return { ok: false, reason: "server" };
    return { ok: false, reason: "refused", status: originalStatus };
  }

  /**
   * submitRun(summary, { version }) — see the module header for the full
   * idempotence argument. Resolves { ok: true, status: "created" | "exists",
   * id } or { ok: false, reason, ... }.
   */
  async function submitRun(summary, opts2 = {}) {
    const { version } = opts2 && typeof opts2 === "object" ? opts2 : {};
    const token = await identity.getToken();
    if (!token.ok) return { ok: false, reason: token.reason };

    const built = buildRunDoc(summary, { uid: token.uid, handle: token.handle, version });
    if (!built.ok) return built;

    const url = firestoreUrl(config, ":commit");
    const commitBody = createRunCommit(config, built.id, built.doc);
    const makeInit = (idToken) => bearerInit(commitBody, idToken);

    let idToken = token.idToken;
    let uid = token.uid;
    let retried = false;

    for (;;) {
      const attempt = await request(url, makeInit(idToken));
      if (attempt.kind === "offline") return { ok: false, reason: "offline" };
      if (attempt.ok) return { ok: true, status: "created", id: built.id };

      const cls = classifyWrite(attempt.status, attempt.json);
      if (cls === "auth") {
        if (retried) return { ok: false, reason: "auth" };
        const refreshed = await identity.forceRefresh();
        if (!refreshed.ok) return { ok: false, reason: refreshed.reason };
        idToken = refreshed.idToken;
        uid = refreshed.uid;
        retried = true;
        continue;
      }
      if (cls === "server") return { ok: false, reason: "server" };
      if (cls === "ambiguous") {
        const { status: errStatus } = restError(attempt.json);
        return resolveAmbiguousCreate(built.id, uid, errStatus);
      }
      const { status: errStatus2 } = restError(attempt.json);
      return errStatus2 ? { ok: false, reason: "refused", status: errStatus2 } : { ok: false, reason: "refused" };
    }
  }

  /**
   * rewriteHandle(handle) — pages the caller's own runs (LIST_LIMIT_MAX at a
   * time, ordered by document name) and POSTs a handle-only commit for the
   * ids whose handle differs. Resolves { ok: true, updated } or
   * { ok: false, reason, ... }.
   */
  async function rewriteHandle(handle) {
    if (!isValidHandle(handle)) return { ok: false, reason: "invalid" };

    const snap = await identity.snapshot();
    if (!snap.uid) return { ok: true, updated: 0 };

    const token = await identity.getToken();
    if (!token.ok) return { ok: false, reason: token.reason };

    const tokenBox = { idToken: token.idToken, uid: token.uid, retried: false };
    const queryUrl = firestoreUrl(config, ":runQuery");
    const commitUrl = firestoreUrl(config, ":commit");

    let updated = 0;
    let afterName = null;

    for (;;) {
      const queryBody = ownRunsQuery({ uid: snap.uid, afterName });
      const makeQueryInit = (idToken) => bearerInit(queryBody, idToken);
      const queryResult = await requestWithRetry(queryUrl, makeQueryInit, tokenBox);
      if (!queryResult.ok) return queryResult;

      const hits = Array.isArray(queryResult.json) ? queryResult.json : [];
      const page = hits.filter((h) => h && h.document).map((h) => ({ name: h.document.name, doc: decodeRunDocument(h.document) }));
      const ids = page.filter((p) => p.doc.handle !== handle).map((p) => p.doc.id);

      if (ids.length > 0) {
        const commitBody = handleUpdateCommit(config, ids, handle);
        const makeCommitInit = (idToken) => bearerInit(commitBody, idToken);
        const commitResult = await requestWithRetry(commitUrl, makeCommitInit, tokenBox);
        if (!commitResult.ok) return commitResult;
        updated += ids.length;
      }

      if (page.length < LIST_LIMIT_MAX) break;
      afterName = page[page.length - 1].name;
    }

    return { ok: true, updated };
  }

  /**
   * eraseMyRuns() — deletes every one of the caller's own runs, then
   * deletes the anonymous account best-effort, then drops ddr.identity.v1.
   * Resolves { ok: true, deleted, dropped: true, accountDeleted } or, on a
   * failure before the identity is dropped, { ok: false, reason, deleted }
   * (the identity stays stored).
   */
  async function eraseMyRuns() {
    const snap = await identity.snapshot();
    if (!snap.uid) {
      await identity.drop();
      return { ok: true, deleted: 0, dropped: true, accountDeleted: false };
    }

    const token = await identity.getToken();
    if (!token.ok) return { ok: false, reason: token.reason, deleted: 0 };

    const tokenBox = { idToken: token.idToken, uid: token.uid, retried: false };
    const queryUrl = firestoreUrl(config, ":runQuery");
    const commitUrl = firestoreUrl(config, ":commit");

    let deleted = 0;

    for (let page = 0; page < ERASE_PAGE_GUARD; page++) {
      const queryBody = ownRunsQuery({ uid: snap.uid });
      const makeQueryInit = (idToken) => bearerInit(queryBody, idToken);
      const queryResult = await requestWithRetry(queryUrl, makeQueryInit, tokenBox);
      if (!queryResult.ok) return { ok: false, reason: queryResult.reason, status: queryResult.status, deleted };

      const hits = Array.isArray(queryResult.json) ? queryResult.json : [];
      const docs = hits.filter((h) => h && h.document).map((h) => decodeRunDocument(h.document));
      if (docs.length === 0) break;

      const ids = docs.map((d) => d.id);
      const commitBody = deleteCommit(config, ids);
      const makeCommitInit = (idToken) => bearerInit(commitBody, idToken);
      const commitResult = await requestWithRetry(commitUrl, makeCommitInit, tokenBox);
      if (!commitResult.ok) return { ok: false, reason: commitResult.reason, status: commitResult.status, deleted };

      deleted += ids.length;
    }

    const delResult = await identity.deleteAccount();
    const accountDeleted = !!(delResult && delResult.ok === true && delResult.deleted === true);
    await identity.drop();
    return { ok: true, deleted, dropped: true, accountDeleted };
  }

  return Object.freeze({ submitRun, rewriteHandle, eraseMyRuns });
}
