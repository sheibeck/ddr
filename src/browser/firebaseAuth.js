// src/browser/firebaseAuth.js
//
// Phase 83 (SRV-04, SRV-05, SRV-09) + Phase 91.2 (BOARD-31, BOARD-32, BOARD-33;
// D-06, D-10, D-12). The player identity, REST only (no SDK), pure and DOM-free.
// Identity v2: the board names a player by their Google Play Games name, which
// the client never chooses. The client signs in through the PlayIdentity seam
// (src/browser/playIdentity.js), relays a fresh server auth code to Identity
// Toolkit (accounts:signInWithIdp), and asks the boardName Cloud Function
// (src/browser/nameClient.js) for the verified name. The function reads the
// name from the Google-written provider record and writes names/{uid}; the
// rules then accept a run only under that exact name. That is the trust
// argument: a rooted device can tamper with its stored record, but a wrong
// local name is simply refused by the rules and re-claimed.
//
// THE BOARD SESSION. boardSession() is the one entry the board uses: Compete
// gate, config and seams, Play Games status (signIn only when interactive),
// account-switch check, link (or sign in), a fresh token, the claim, then the
// rename check. Per D-06 a session is complete only once a claim returned a
// name; until then nothing posts. Per D-12 a player who is not signed in to
// Play Games gets reason "signin" and no network call at all.
//
//  - LINK / ADOPT (BOARD-32). A 2.2.0 anonymous account is linked in place
//    (signInWithIdp with its idToken), keeping its uid when Google allows. When
//    the link answers FEDERATED_USER_ID_ALREADY_LINKED, or returns a different
//    uid, the session ends on the player's linked uid, remembers the anonymous
//    uid and its refresh token as `adoptFrom`, and the claim carries that
//    account's token so the function moves its runs; the client then deletes
//    the anonymous account. An interrupted adopt keeps `adoptFrom` and
//    finishes on the next session.
//  - RENAME (G2). When the local Play Games name differs from the claimed one
//    (and an admin did not override it), the session signs in again with a
//    fresh code and claims again; if the claimed name is still the old one the
//    provider is unlinked and relinked, once per launch per target name.
//  - NEEDS_GAMES_CODE (G1/A4 fallback). The function may ask for a fresh code;
//    the claim is retried once with one.
//  - ACCOUNT SWITCH. A different Play Games account on the device drops the
//    stored board session locally. It never adopts the other player's runs.
//
// Every server auth code is used once, right after it is fetched; a retry
// always fetches a fresh one. Compete OFF never touches Play Games and never
// reads the network: boardSession(), signIn(), refreshName() and
// deleteAccount() all check competeOn() first. getToken() and forceRefresh()
// are gated the same way except for { explicit: true }, reserved for a
// player-tapped Send on the bug-report sheet (SRV-09): that path stays on the
// anonymous (or already linked) account and never calls Play Games.
//
// Record (ddr.identity.v2, JSON): { v: 2, uid, refreshToken, idToken,
// expiresAtMs, linked, playerId, name, overridden, adoptFrom }. adoptFrom is
// null or { uid, refreshToken }. expiresAtMs is an absolute epoch-ms number (0
// when unknown) from the injected clock. A 2.2.0 record at ddr.identity.v1 is
// migrated on first load: uid and tokens are kept (so the anonymous account can
// be linked), the rolled handle is dropped, and the v1 key is removed.
//
// Nothing in this module logs. A failure result carries only a reason id (from
// IDENTITY_REASONS) and an optional short status string (for example
// "OPERATION_NOT_ALLOWED"), never a token.

import { IDENTITY_BASE, SECURETOKEN_BASE, timedFetch, readJson, restError } from "./firestoreRest.js";
import { FIREBASE_CONFIG, PLAY_GAMES_CONFIG, firebaseConfigured, playGamesConfigured } from "./firebaseConfig.js";
import { createNameClient } from "./nameClient.js";
import { sanitizeBoardName } from "./boardName.js";

export const IDENTITY_KEY = "ddr.identity.v2";
export const LEGACY_IDENTITY_KEY = "ddr.identity.v1";
export const REFRESH_MARGIN_MS = 300000;
export const IDENTITY_REASONS = Object.freeze(["off", "offline", "server", "refused", "unavailable", "signin"]);

const PLAY_GAMES_PROVIDER = "playgames.google.com";

const EMPTY_RECORD = Object.freeze({
  v: 2,
  uid: null,
  refreshToken: null,
  idToken: null,
  expiresAtMs: 0,
  linked: false,
  playerId: null,
  name: null,
  overridden: false,
  adoptFrom: null,
});

// A terminal refresh error means the refresh token is no longer accepted: the
// account is gone, so the identity is restarted rather than surfaced as a
// retryable failure.
const TERMINAL_REFRESH_MESSAGES = Object.freeze([
  "TOKEN_EXPIRED",
  "USER_DISABLED",
  "USER_NOT_FOUND",
  "INVALID_REFRESH_TOKEN",
  "INVALID_GRANT_TYPE",
  "MISSING_REFRESH_TOKEN",
]);

// Identity Toolkit answers meaning "the idToken you sent is no longer a live account".
const DEAD_ID_TOKEN_MESSAGES = Object.freeze(["INVALID_ID_TOKEN", "TOKEN_EXPIRED", "USER_NOT_FOUND", "USER_DISABLED"]);

// PlayIdentity reason ids -> identity reason ids.
const PLAY_REASON = Object.freeze({ config: "unavailable", unavailable: "unavailable", denied: "signin", error: "server" });

function emptyRecord() {
  return { ...EMPTY_RECORD };
}

function cleanString(value, max) {
  return typeof value === "string" && value.length > 0 && value.length <= max ? value : null;
}

function messageHas(message, id) {
  return typeof message === "string" && message.includes(id);
}

function playReason(reason) {
  return PLAY_REASON[reason] ?? "server";
}

/**
 * sanitizeIdentity(raw) — a frozen v2 record read tolerantly from `raw`
 * (a v1 record reads as v2: its uid and tokens survive, its handle does not).
 * A non-object input returns the empty record. A non-string, empty or
 * over-long (128) uid becomes null and clears the tokens, linked, playerId,
 * name and overridden with it. A non-string token becomes null; a non-finite
 * expiresAtMs becomes 0; the name goes through sanitizeBoardName; linked needs
 * a playerId; adoptFrom needs a uid and a refresh token. Never throws.
 */
export function sanitizeIdentity(raw) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return EMPTY_RECORD;
  try {
    const uid = cleanString(raw.uid, 128);
    let refreshToken = typeof raw.refreshToken === "string" ? raw.refreshToken : null;
    let idToken = typeof raw.idToken === "string" ? raw.idToken : null;
    let expiresAtMs = Number.isFinite(raw.expiresAtMs) ? raw.expiresAtMs : 0;
    let playerId = cleanString(raw.playerId, 128);
    let name = sanitizeBoardName(raw.name);
    let linked = raw.linked === true;
    let overridden = raw.overridden === true;
    if (uid === null) {
      refreshToken = null;
      idToken = null;
      expiresAtMs = 0;
      playerId = null;
      name = null;
      linked = false;
      overridden = false;
    }
    if (playerId === null) linked = false;
    if (name === null) overridden = false;
    let adoptFrom = null;
    const from = raw.adoptFrom;
    if (typeof from === "object" && from !== null) {
      const fromUid = cleanString(from.uid, 128);
      const fromToken = cleanString(from.refreshToken, 4096);
      if (fromUid !== null && fromToken !== null) adoptFrom = Object.freeze({ uid: fromUid, refreshToken: fromToken });
    }
    return Object.freeze({ v: 2, uid, refreshToken, idToken, expiresAtMs, linked, playerId, name, overridden, adoptFrom });
  } catch {
    return EMPTY_RECORD;
  }
}

/**
 * parseSignUp(json, nowMs) — { uid, idToken, refreshToken, expiresAtMs } from
 * an accounts:signUp 200 body (idToken, refreshToken, expiresIn (seconds,
 * string), localId), or null when the shape doesn't match. expiresAtMs is
 * nowMs + Number(expiresIn) * 1000 (an absolute value via the injected clock).
 */
export function parseSignUp(json, nowMs) {
  if (typeof json !== "object" || json === null) return null;
  const { idToken, refreshToken, expiresIn, localId } = json;
  if (typeof idToken !== "string" || typeof refreshToken !== "string" || typeof localId !== "string") return null;
  const seconds = Number(expiresIn);
  if (!Number.isFinite(seconds)) return null;
  return { uid: localId, idToken, refreshToken, expiresAtMs: nowMs + seconds * 1000 };
}

/**
 * parseRefresh(json, nowMs) — { uid, idToken, refreshToken, expiresAtMs }
 * from a securetoken:token 200 body (snake_case: id_token, refresh_token,
 * expires_in, user_id), or null when the shape doesn't match.
 */
export function parseRefresh(json, nowMs) {
  if (typeof json !== "object" || json === null) return null;
  const { id_token: idToken, refresh_token: refreshToken, expires_in: expiresIn, user_id: uid } = json;
  if (typeof idToken !== "string" || typeof refreshToken !== "string" || typeof uid !== "string") return null;
  const seconds = Number(expiresIn);
  if (!Number.isFinite(seconds)) return null;
  return { uid, idToken, refreshToken, expiresAtMs: nowMs + seconds * 1000 };
}

/**
 * parseIdpSignIn(json, nowMs) — from an accounts:signInWithIdp 200 body:
 * { uid, idToken, refreshToken, expiresAtMs } when it carries a session,
 * { alreadyLinked: true } when it answers errorMessage
 * FEDERATED_USER_ID_ALREADY_LINKED (a 400 with that message is the caller's
 * to map), or null when the shape does not match.
 */
export function parseIdpSignIn(json, nowMs) {
  if (typeof json !== "object" || json === null) return null;
  if (typeof json.errorMessage === "string" && json.errorMessage.includes("FEDERATED_USER_ID_ALREADY_LINKED")) {
    return { alreadyLinked: true };
  }
  return parseSignUp(json, nowMs);
}

/**
 * createIdentity(opts) — the identity factory. opts: { storage, fetchFn,
 * config = FIREBASE_CONFIG, playConfig = PLAY_GAMES_CONFIG, playIdentity,
 * nameClient, competeOn, now = Date.now, timeoutMs, setTimer, clearTimer,
 * AbortCtl }. Returns frozen { snapshot, getToken, forceRefresh, boardSession,
 * signIn, refreshName, deleteAccount, drop }. `storage` is the only durable
 * side effect (async getItem/setItem/removeItem, per src/browser/storage.js's
 * contract); `fetchFn` is the only network side effect; `playIdentity` is the
 * only way to Play Games. Never throws.
 */
export function createIdentity(opts = {}) {
  const {
    storage,
    fetchFn,
    config = FIREBASE_CONFIG,
    playConfig = PLAY_GAMES_CONFIG,
    playIdentity,
    competeOn,
    now = Date.now,
    timeoutMs,
    setTimer,
    clearTimer,
    AbortCtl,
  } = opts;

  const timing = {};
  if (timeoutMs !== undefined) timing.timeoutMs = timeoutMs;
  if (setTimer !== undefined) timing.setTimer = setTimer;
  if (clearTimer !== undefined) timing.clearTimer = clearTimer;
  if (AbortCtl !== undefined) timing.AbortCtl = AbortCtl;

  const nameClient = opts.nameClient ?? createNameClient({ fetchFn, ...timing });

  let loadPromise = null;
  let signUpInFlight = null;
  let refreshInFlight = null;
  let sessionInFlight = null;
  const renameTried = new Set(); // "<playerId>\0<target name>": one unlink-relink attempt per launch

  // --- storage ---------------------------------------------------------------

  function parseRecord(raw) {
    try {
      return sanitizeIdentity(JSON.parse(raw));
    } catch {
      return emptyRecord();
    }
  }

  function load() {
    if (loadPromise === null) {
      loadPromise = (async () => {
        try {
          const raw = await storage.getItem(IDENTITY_KEY);
          if (typeof raw === "string") return parseRecord(raw);
          const legacy = await storage.getItem(LEGACY_IDENTITY_KEY);
          if (typeof legacy !== "string") return emptyRecord();
          // A 2.2.0 record: keep the uid and tokens (the anonymous account is
          // linked later), drop the handle, and remove the v1 key.
          const migrated = parseRecord(legacy);
          try {
            if (migrated.uid !== null) await storage.setItem(IDENTITY_KEY, JSON.stringify(migrated));
            await storage.removeItem(LEGACY_IDENTITY_KEY);
          } catch {
            // best-effort: the migrated copy in memory still serves this launch
          }
          return migrated;
        } catch {
          return emptyRecord();
        }
      })();
    }
    return loadPromise;
  }

  async function persist(record) {
    const sanitized = sanitizeIdentity(record);
    loadPromise = Promise.resolve(sanitized);
    try {
      await storage.setItem(IDENTITY_KEY, JSON.stringify(sanitized));
    } catch {
      // best-effort: the in-memory copy above still reflects this session
    }
    return sanitized;
  }

  async function drop() {
    loadPromise = Promise.resolve(emptyRecord());
    try {
      await storage.removeItem(IDENTITY_KEY);
      await storage.removeItem(LEGACY_IDENTITY_KEY);
    } catch {
      // best-effort
    }
  }

  async function snapshot() {
    const rec = await load();
    return Object.freeze({ uid: rec.uid, name: rec.name, linked: rec.linked, playerId: rec.playerId });
  }

  function competeGateOk(explicit) {
    if (explicit === true) return true;
    return typeof competeOn === "function" && competeOn() === true;
  }

  function networkReady() {
    return firebaseConfigured(config) && typeof fetchFn === "function";
  }

  // The account is gone (or never was): back to nothing, keeping only a pending adopt.
  function clearedOf(rec) {
    return { ...emptyRecord(), adoptFrom: rec.adoptFrom };
  }

  // --- Identity Toolkit / Secure Token ----------------------------------------

  function idUrl(method) {
    return `${IDENTITY_BASE}/accounts:${method}?key=${encodeURIComponent(config.apiKey)}`;
  }

  function jsonInit(body) {
    return { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
  }

  // One timed request: { offline: true } or { offline: false, ok, status, json }.
  async function call(url, init) {
    const raced = await timedFetch(fetchFn, url, init, timing);
    if (!raced.ok) return { offline: true };
    const res = raced.res;
    const json = await readJson(res);
    return { offline: false, ok: res.ok, status: res.status, json };
  }

  // A failed response mapped to a result: 429/5xx -> server, else refused (with the status string).
  function refusedOrServer(r) {
    const { message } = restError(r.json);
    if (r.status === 429 || r.status >= 500) return { ok: false, reason: "server" };
    return message ? { ok: false, reason: "refused", status: message } : { ok: false, reason: "refused" };
  }

  // Anonymous sign-up (bug reports, and the very first token for a player who has no account yet).
  async function doSignUp() {
    const r = await call(idUrl("signUp"), jsonInit({ returnSecureToken: true }));
    if (r.offline) return { ok: false, reason: "offline" };
    if (r.ok) {
      const parsed = parseSignUp(r.json, now());
      if (!parsed) return { ok: false, reason: "server" };
      const rec = await load();
      await persist({ ...rec, uid: parsed.uid, idToken: parsed.idToken, refreshToken: parsed.refreshToken, expiresAtMs: parsed.expiresAtMs });
      return { ok: true, uid: parsed.uid, idToken: parsed.idToken };
    }
    return refusedOrServer(r);
  }

  function signUp() {
    if (signUpInFlight === null) {
      signUpInFlight = doSignUp().finally(() => {
        signUpInFlight = null;
      });
    }
    return signUpInFlight;
  }

  // One securetoken exchange for any refresh token: { ok: true, parsed } |
  // { ok: false, terminal: true } (the token is dead) | { ok: false, reason, status? }.
  async function exchangeRefresh(refreshToken) {
    const url = `${SECURETOKEN_BASE}/token?key=${encodeURIComponent(config.apiKey)}`;
    const body = `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`;
    const r = await call(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
    if (r.offline) return { ok: false, reason: "offline" };
    if (r.ok) {
      const parsed = parseRefresh(r.json, now());
      if (!parsed) return { ok: false, reason: "server" };
      return { ok: true, parsed };
    }
    const { message } = restError(r.json);
    if (TERMINAL_REFRESH_MESSAGES.includes(message)) return { ok: false, terminal: true };
    return refusedOrServer(r);
  }

  // Refresh the stored record's own token: { ok: true, rec } | { ok: false, terminal: true } | { ok: false, reason }.
  async function doRefreshRecord(rec) {
    if (!rec.refreshToken) return { ok: false, terminal: true };
    const r = await exchangeRefresh(rec.refreshToken);
    if (!r.ok) return r;
    const p = r.parsed;
    if (rec.uid && p.uid !== rec.uid) return { ok: false, terminal: true };
    const saved = await persist({ ...rec, uid: p.uid, idToken: p.idToken, refreshToken: p.refreshToken, expiresAtMs: p.expiresAtMs });
    return { ok: true, rec: saved };
  }

  function refreshRecord(rec) {
    if (refreshInFlight === null) {
      refreshInFlight = doRefreshRecord(rec).finally(() => {
        refreshInFlight = null;
      });
    }
    return refreshInFlight;
  }

  // The cached token while it has margin left, else a refresh.
  async function ensureToken(rec) {
    if (rec.uid && rec.idToken && now() <= rec.expiresAtMs - REFRESH_MARGIN_MS) return { ok: true, rec };
    return refreshRecord(rec);
  }

  async function restartIdentity() {
    const rec = await load();
    await persist(clearedOf(rec));
    return signUp();
  }

  // The shared token path of getToken / forceRefresh: refresh, restarting the identity when the account is gone.
  async function refreshForToken() {
    const rec = await load();
    if (!rec.refreshToken) return restartIdentity();
    const r = await refreshRecord(rec);
    if (r.ok) return { ok: true, uid: r.rec.uid, idToken: r.rec.idToken };
    if (r.terminal) return restartIdentity();
    return r;
  }

  /**
   * getToken({ explicit }) — the gated entry point for a bare token. explicit
   * exists only for a player-tapped Send (SRV-09, the bug-report sheet); board
   * paths never pass it and use boardSession(). Order: the Compete gate,
   * config/fetchFn availability, then sign-up (no uid) / refresh (near expiry)
   * / the cached token. Never calls Play Games.
   */
  async function getToken({ explicit = false } = {}) {
    if (!competeGateOk(explicit)) return { ok: false, reason: "off" };
    if (!networkReady()) return { ok: false, reason: "unavailable" };
    const rec = await load();
    if (!rec.uid) return signUp();
    if (now() > rec.expiresAtMs - REFRESH_MARGIN_MS) return refreshForToken();
    return { ok: true, uid: rec.uid, idToken: rec.idToken };
  }

  /**
   * forceRefresh({ explicit }) — the same gate rule as getToken, but always
   * refreshes (or signs up when there is no uid yet) regardless of the margin.
   * Used after a 401 by the board writer.
   */
  async function forceRefresh({ explicit = false } = {}) {
    if (!competeGateOk(explicit)) return { ok: false, reason: "off" };
    if (!networkReady()) return { ok: false, reason: "unavailable" };
    const rec = await load();
    if (!rec.uid) return signUp();
    return refreshForToken();
  }

  // --- Play Games --------------------------------------------------------------

  function seamsReady() {
    return (
      networkReady() &&
      playGamesConfigured(playConfig) &&
      !!playIdentity &&
      typeof playIdentity.status === "function" &&
      typeof playIdentity.signIn === "function" &&
      typeof playIdentity.serverAuthCode === "function"
    );
  }

  // A PlayIdentity call that cannot throw: the seam's answer or { ok: false, reason: "error" }.
  async function playCall(method, args) {
    try {
      const res = await playIdentity[method](args);
      return res && typeof res === "object" ? res : { ok: false, reason: "error" };
    } catch {
      return { ok: false, reason: "error" };
    }
  }

  // A fresh server auth code: { ok: true, code } | { ok: false, reason }. Each code is used once, right away.
  async function fetchCode() {
    const r = await playCall("serverAuthCode", { serverClientId: playConfig.webClientId });
    if (r.ok === true && typeof r.authCode === "string" && r.authCode !== "") return { ok: true, code: r.authCode };
    return { ok: false, reason: playReason(r.reason) };
  }

  // accounts:signInWithIdp with a fresh code (and the caller's idToken when linking).
  // { kind: "ok", parsed } | { kind: "already" } | { kind: "dead" } (the idToken sent is no live account)
  // | { kind: "providerLinked" } | { kind: "fail", reason }.
  async function idpSignIn(idToken) {
    const code = await fetchCode();
    if (!code.ok) return { kind: "fail", reason: code.reason };
    const body = {
      requestUri: "http://localhost",
      postBody: `code=${encodeURIComponent(code.code)}&providerId=${PLAY_GAMES_PROVIDER}`,
      returnSecureToken: true,
      returnIdpCredential: true,
    };
    if (typeof idToken === "string" && idToken !== "") body.idToken = idToken;
    const r = await call(idUrl("signInWithIdp"), jsonInit(body));
    if (r.offline) return { kind: "fail", reason: "offline" };
    if (r.ok) {
      const parsed = parseIdpSignIn(r.json, now());
      if (!parsed) return { kind: "fail", reason: "server" };
      if (parsed.alreadyLinked) return { kind: "already" };
      return { kind: "ok", parsed };
    }
    const { message } = restError(r.json);
    if (messageHas(message, "FEDERATED_USER_ID_ALREADY_LINKED")) return { kind: "already" };
    if (messageHas(message, "OPERATION_NOT_ALLOWED")) return { kind: "fail", reason: "unavailable" };
    if (body.idToken && DEAD_ID_TOKEN_MESSAGES.some((m) => messageHas(message, m))) return { kind: "dead" };
    if (body.idToken && messageHas(message, "PROVIDER_ALREADY_LINKED")) return { kind: "providerLinked" };
    return { kind: "fail", reason: "server" };
  }

  // Best effort: delete an account by its own idToken (the adopted anonymous account).
  async function deleteByToken(idToken) {
    try {
      await call(idUrl("delete"), jsonInit({ idToken }));
    } catch {
      // best-effort
    }
  }

  // Link (or sign in) so the record is a Play Games account: { ok: true, rec } | { ok: false, reason }.
  // A stored anonymous uid is linked in place with its own idToken; a different uid or
  // ALREADY_LINKED leaves it as `adoptFrom` for the claim to move.
  async function linkSession(rec, status) {
    let work = rec;
    let anon = null; // { uid, refreshToken } of the anonymous account being linked
    let idToken = null;
    if (work.uid) {
      const t = await ensureToken(work);
      if (t.ok) {
        work = t.rec;
        idToken = work.idToken;
        anon = { uid: work.uid, refreshToken: work.refreshToken };
      } else if (t.terminal) {
        work = await persist(clearedOf(work));
      } else {
        return { ok: false, reason: t.reason };
      }
    }

    let r = await idpSignIn(idToken);
    if (r.kind === "dead" || r.kind === "providerLinked") {
      // The stored account is gone, or already carries a Play Games link: sign in as the player instead.
      if (r.kind === "dead") work = await persist(clearedOf(work));
      anon = null;
      r = await idpSignIn(null);
    }
    let adopt = null;
    if (r.kind === "already") {
      if (anon) adopt = anon;
      r = await idpSignIn(null);
    }
    if (r.kind === "fail") return { ok: false, reason: r.reason };
    if (r.kind !== "ok") return { ok: false, reason: "server" };

    const p = r.parsed;
    if (adopt === null && anon !== null && p.uid !== anon.uid) adopt = anon;
    const uidChanged = p.uid !== work.uid;
    const saved = await persist({
      ...work,
      uid: p.uid,
      idToken: p.idToken,
      refreshToken: p.refreshToken,
      expiresAtMs: p.expiresAtMs,
      linked: true,
      playerId: status.playerId,
      name: uidChanged ? null : work.name,
      overridden: uidChanged ? false : work.overridden,
      adoptFrom: adopt ?? work.adoptFrom,
    });
    return { ok: true, rec: saved };
  }

  // The D-06 step: ask the function for the verified name (carrying a pending adopt) and keep it.
  // { ok: true, rec } | { ok: false, reason }.
  async function claimName(rec0) {
    let rec = rec0;
    let code = null;
    let codeFetched = false;
    let authRetried = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      let adoptIdToken;
      if (rec.adoptFrom) {
        const a = await exchangeRefresh(rec.adoptFrom.refreshToken);
        if (a.ok) adoptIdToken = a.parsed.idToken;
        else if (a.terminal) rec = await persist({ ...rec, adoptFrom: null });
        else return { ok: false, reason: a.reason };
      }
      const res = await nameClient.claim({ idToken: rec.idToken, adoptIdToken, gamesAuthCode: code ?? undefined });
      code = null; // a code is single-use whatever the answer
      if (res.ok) {
        const saved = await persist({ ...rec, name: res.name, overridden: res.overridden === true, adoptFrom: null });
        if (adoptIdToken) await deleteByToken(adoptIdToken);
        return { ok: true, rec: saved };
      }
      if (res.reason === "needsCode" && !codeFetched) {
        codeFetched = true;
        const c = await fetchCode();
        if (!c.ok) return { ok: false, reason: c.reason };
        code = c.code;
        continue;
      }
      if (res.reason === "auth" && !authRetried) {
        authRetried = true;
        const t = await refreshRecord(rec);
        if (t.ok) {
          rec = t.rec;
          continue;
        }
        if (t.terminal) await persist(clearedOf(rec));
        return { ok: false, reason: t.terminal ? "server" : t.reason };
      }
      if (res.reason === "refused") {
        if (res.code === "NOT_LINKED") {
          await persist({ ...rec, linked: false });
          return { ok: false, reason: "server" };
        }
        if (res.code === "ADOPT_REFUSED" && rec.adoptFrom) {
          rec = await persist({ ...rec, adoptFrom: null });
          continue;
        }
        return { ok: false, reason: "refused" };
      }
      if (res.reason === "offline" || res.reason === "unavailable") return { ok: false, reason: res.reason };
      return { ok: false, reason: "server" };
    }
    return { ok: false, reason: "server" };
  }

  // G2: the local Play Games name moved. Sign in again and claim again; when the
  // claimed name is still the old one, unlink and relink once. Never fails the session.
  async function followRename(rec, status) {
    const target = sanitizeBoardName(status.displayName);
    if (target === null || rec.overridden || target === rec.name) return rec;
    const key = `${rec.playerId}\u0000${target}`;
    if (renameTried.has(key)) return rec;
    renameTried.add(key);

    const before = rec.name;
    let work = rec;
    const s = await idpSignIn(null);
    if (s.kind !== "ok" || s.parsed.uid !== work.uid) return work;
    work = await persist({ ...work, idToken: s.parsed.idToken, refreshToken: s.parsed.refreshToken, expiresAtMs: s.parsed.expiresAtMs });
    const c = await claimName(work);
    if (!c.ok) return work;
    work = c.rec;
    if (work.name !== before || work.overridden) return work;

    // Still the old name: unlink the provider and link it again (the relink refreshes it).
    const u = await call(idUrl("update"), jsonInit({ idToken: work.idToken, deleteProvider: [PLAY_GAMES_PROVIDER] }));
    if (u.offline || !u.ok) return work;
    work = await persist({ ...work, linked: false });
    const l = await linkSession(work, status);
    if (!l.ok) return work;
    const c2 = await claimName(l.rec);
    return c2.ok ? c2.rec : l.rec;
  }

  async function doSession(interactive) {
    if (!competeGateOk(false)) return { ok: false, reason: "off" };
    if (!seamsReady()) return { ok: false, reason: "unavailable" };

    // Phase 92.1: the interactive path (the SIGN IN row, or Compete turned ON
    // mid-session) starts the Play Games SDK first when this launch never did.
    // A Compete-ON cold launch already started it in MainActivity, and the
    // native init is idempotent. A quiet session never calls init: it only
    // runs while Compete is ON, when the SDK is already up.
    if (interactive && typeof playIdentity.init === "function") {
      const started = await playCall("init");
      if (started.ok !== true) return { ok: false, reason: playReason(started.reason) };
    }

    let status = await playCall("status");
    if (status.ok !== true) return { ok: false, reason: playReason(status.reason) };
    if (!status.signedIn) {
      if (!interactive) return { ok: false, reason: "signin" };
      status = await playCall("signIn");
      if (status.ok !== true) return { ok: false, reason: playReason(status.reason) };
      if (!status.signedIn) return { ok: false, reason: "signin" };
    }
    if (typeof status.playerId !== "string" || status.playerId === "") return { ok: false, reason: "server" };

    let rec = await load();
    // Another Play Games account on the device: drop the stored session, never adopt its runs.
    if (rec.playerId !== null && rec.playerId !== status.playerId) rec = await persist(emptyRecord());

    let fresh = false;
    if (!rec.linked) {
      const l = await linkSession(rec, status);
      if (!l.ok) return l;
      rec = l.rec;
      fresh = true;
    }
    if (!fresh) {
      const t = await ensureToken(rec);
      if (t.ok) {
        rec = t.rec;
      } else if (t.terminal) {
        rec = await persist(clearedOf(rec));
        const l = await linkSession(rec, status);
        if (!l.ok) return l;
        rec = l.rec;
      } else {
        return { ok: false, reason: t.reason };
      }
    }

    let claimed = false;
    if (rec.name === null || rec.adoptFrom !== null) {
      const c = await claimName(rec);
      if (!c.ok) return c;
      rec = c.rec;
      claimed = true;
    }
    if (!claimed) rec = await followRename(rec, status);
    if (rec.name === null) return { ok: false, reason: "server" };
    return { ok: true, uid: rec.uid, idToken: rec.idToken, name: rec.name };
  }

  function startSession(interactive) {
    const p = doSession(interactive)
      .catch(() => ({ ok: false, reason: "server" }))
      .finally(() => {
        if (sessionInFlight === p) sessionInFlight = null;
      });
    sessionInFlight = p;
    return p;
  }

  /**
   * boardSession({ interactive }) — the board's session: { ok: true, uid,
   * idToken, name } or { ok: false, reason }, reason in IDENTITY_REASONS.
   * Compete-gated always (never explicit), single-flight. Without a Play
   * Games sign-in it answers "signin" with no network call, unless
   * interactive, which asks the player to sign in once.
   */
  function boardSession({ interactive = false } = {}) {
    if (sessionInFlight !== null) {
      if (interactive !== true) return sessionInFlight;
      return sessionInFlight.then((r) => (r.ok ? r : startSession(true)));
    }
    return startSession(interactive === true);
  }

  /** signIn() — boardSession with the interactive Play Games sign-in allowed. */
  function signIn() {
    return boardSession({ interactive: true });
  }

  /**
   * refreshName() — claim again (after a refused create, an admin override or
   * a changed name): { ok: true, name } | { ok: false, reason }. Needs a
   * linked session ("signin" otherwise). Compete-gated.
   */
  async function refreshName() {
    if (!competeGateOk(false)) return { ok: false, reason: "off" };
    if (!networkReady()) return { ok: false, reason: "unavailable" };
    let rec = await load();
    if (!rec.uid || !rec.linked) return { ok: false, reason: "signin" };
    const t = await ensureToken(rec);
    if (t.ok) rec = t.rec;
    else if (t.terminal) return { ok: false, reason: "signin" };
    else return { ok: false, reason: t.reason };
    const c = await claimName(rec);
    return c.ok ? { ok: true, name: c.rec.name } : { ok: false, reason: c.reason };
  }

  /**
   * deleteAccount() — Compete-gated (no explicit option). With no uid,
   * resolves { ok: true, deleted: false } with zero calls. Otherwise releases
   * the name through the function (best effort), POSTs accounts:delete and,
   * on 200, drops the identity and resolves { ok: true, deleted: true }.
   */
  async function deleteAccount() {
    if (!competeGateOk(false)) return { ok: false, reason: "off" };
    let rec = await load();
    if (!rec.uid) return { ok: true, deleted: false };
    if (!networkReady()) return { ok: false, reason: "unavailable" };

    const t = await ensureToken(rec);
    if (t.ok) rec = t.rec;
    if (rec.linked || rec.name !== null) {
      try {
        await nameClient.release({ idToken: rec.idToken });
      } catch {
        // best-effort: the name record is the function's to drop, never a reason to keep the account
      }
    }

    const r = await call(idUrl("delete"), jsonInit({ idToken: rec.idToken }));
    if (r.offline) return { ok: false, reason: "offline" };
    if (r.ok) {
      await drop();
      return { ok: true, deleted: true };
    }
    return refusedOrServer(r);
  }

  return Object.freeze({ snapshot, getToken, forceRefresh, boardSession, signIn, refreshName, deleteAccount, drop });
}
