// src/browser/boardWrites.js
//
// Phase 83 (SRV-01, the client half of "each run stored once; resubmitting
// never duplicates") + Phase 91.2 (BOARD-31, D-06, D-11). The board write
// client: submitRun (idempotent run create under the player's verified Play
// Games name) and eraseMyRuns (owner delete-everything, release the name,
// drop the local identity). Pure, DOM-free: no window/document/navigator/
// localStorage, no bare global fetch. The network is reached only through the
// injected fetchFn, and durable identity state lives entirely behind the
// injected `identity` (src/browser/firebaseAuth.js#createIdentity).
//
// THE NAME COMES FROM THE SESSION. submitRun asks identity.boardSession() for
// { uid, idToken, name } and builds the run with that name as its handle. The
// client never chooses a name: the session got it from the boardName function,
// and the rules accept a create only when the handle equals names/{uid}.name.
// There is no rename path and no handle-only commit any more (D-11): the
// function stamps a changed name onto a player's runs itself. Without a Play
// Games session the result is the session's own reason ("signin" when the
// player is not signed in, "off" with Compete OFF) and nothing is requested
// from Firestore, so the run queue simply holds the run (D-06).
//
// A STALE NAME. A name cached in the session can go stale (an admin override,
// a rename the session has not seen yet): the create is then refused. After
// the idempotence check below shows the refusal is genuine, submitRun asks
// identity.refreshName() once; when that returns a different name the run is
// rebuilt and retried exactly once. A second refusal is returned as refused, so
// there is no loop.
//
// The idempotence argument (RESEARCH Pitfall 1 / Assumption A3): a run
// create always carries the currentDocument.exists:false precondition
// (runDoc.js#createRunCommit) on doc id `{uid}_{hash}`. The live project's
// exact answer to "already there" is unverified until 83-08's live smoke
// test: it could be a 400 FAILED_PRECONDITION, a 403 PERMISSION_DENIED or a
// 409 ALREADY_EXISTS. classifyWrite() below treats all three the same way,
// as "ambiguous", and submitRun resolves the ambiguity with exactly ONE
// public GET (no Authorization) of runs/{id}: a 200 whose decoded uid
// matches the caller's own uid means the run is already on the board
// (acknowledged, status "exists"); a 404 means the create was genuinely
// refused (the doc never landed, e.g. a banned uid or a wrong name) and the
// ORIGINAL create response's error status is what the caller sees. This makes
// a resubmit of the same run idempotent no matter which of the three answers
// the live project actually returns.
//
// eraseMyRuns deletes every one of the caller's own runs (paged by
// runDoc.js#LIST_LIMIT_MAX, the rules' own list-read cap, oldest page repeated
// since each delete round shrinks the set), then identity.deleteAccount()
// releases the name through the function, deletes the account best-effort (so
// no orphaned account remains) and the identity record is dropped. A failure
// before that last drop leaves the identity stored, so a retry can pick up
// where it left off.
//
// A 401 (or a REST UNAUTHENTICATED status) on any request forces exactly
// one identity.forceRefresh() and one retry, shared across a whole
// submitRun/eraseMyRuns call, never a second retry.

import { FIREBASE_CONFIG } from "./firebaseConfig.js";
import { firestoreUrl, timedFetch, readJson, restError } from "./firestoreRest.js";
import { buildRunDoc, createRunCommit, deleteCommit, ownRunsQuery, RUN_COLLECTION } from "./runDoc.js";
import { decodeRunDocument } from "./boardClient.js";

export const WRITE_REASONS = Object.freeze(["off", "offline", "server", "refused", "invalid", "auth", "unavailable", "signin"]);

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
 * non-create write (delete, own-runs query) whose response classified as
 * "ambiguous" or "refused" — both map to plain "refused" here, since neither
 * has a create's GET-settled idempotence meaning. "server" passes through
 * unchanged. Always carries the REST error's `.status` when present.
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
 * { submitRun, eraseMyRuns }. `identity` is the object returned by
 * src/browser/firebaseAuth.js#createIdentity (boardSession, refreshName,
 * getToken, forceRefresh, snapshot, deleteAccount, drop). Never throws.
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
   * submitRun(summary, { version }) — see the module header for the name and
   * the idempotence argument. Resolves { ok: true, status: "created" |
   * "exists", id } or { ok: false, reason, ... }.
   */
  async function submitRun(summary, opts2 = {}) {
    const { version } = opts2 && typeof opts2 === "object" ? opts2 : {};
    const session = await identity.boardSession();
    if (!session.ok) return { ok: false, reason: session.reason };

    const url = firestoreUrl(config, ":commit");
    let idToken = session.idToken;
    let uid = session.uid;
    let name = session.name;
    let authRetried = false;
    let renamed = false;

    for (;;) {
      const built = buildRunDoc(summary, { uid, handle: name, version });
      if (!built.ok) return built;
      const commitBody = createRunCommit(config, built.id, built.doc);

      const attempt = await request(url, bearerInit(commitBody, idToken));
      if (attempt.kind === "offline") return { ok: false, reason: "offline" };
      if (attempt.ok) return { ok: true, status: "created", id: built.id };

      const cls = classifyWrite(attempt.status, attempt.json);
      if (cls === "auth") {
        if (authRetried) return { ok: false, reason: "auth" };
        const refreshed = await identity.forceRefresh();
        if (!refreshed.ok) return { ok: false, reason: refreshed.reason };
        idToken = refreshed.idToken;
        uid = refreshed.uid;
        authRetried = true;
        continue;
      }
      if (cls === "server") return { ok: false, reason: "server" };
      if (cls === "ambiguous") {
        const { status: errStatus } = restError(attempt.json);
        const settled = await resolveAmbiguousCreate(built.id, uid, errStatus);
        if (settled.ok === false && settled.reason === "refused" && !renamed) {
          // A genuine refusal: the stored name may have gone stale. Claim again, and retry once if it moved.
          renamed = true;
          const fresh = await identity.refreshName();
          if (fresh.ok && fresh.name !== name) {
            const again = await identity.boardSession();
            if (!again.ok) return { ok: false, reason: again.reason };
            idToken = again.idToken;
            uid = again.uid;
            name = again.name;
            continue;
          }
        }
        return settled;
      }
      const { status: errStatus2 } = restError(attempt.json);
      return errStatus2 ? { ok: false, reason: "refused", status: errStatus2 } : { ok: false, reason: "refused" };
    }
  }

  /**
   * eraseMyRuns() — deletes every one of the caller's own runs, then
   * releases the name and deletes the account (identity.deleteAccount, best
   * effort), then drops the identity record. Resolves { ok: true, deleted,
   * dropped: true, accountDeleted } or, on a failure before the identity is
   * dropped, { ok: false, reason, deleted } (the identity stays stored).
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

  return Object.freeze({ submitRun, eraseMyRuns });
}
