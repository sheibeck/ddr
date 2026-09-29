// src/browser/firebaseAuth.js
//
// Phase 83 (SRV-04, SRV-05, the identity half of SRV-09). The anonymous
// player identity: a pure, DOM-free module that lazily signs up an
// anonymous Firebase user over plain REST (no SDK), keeps uid and tokens in
// durable storage under `ddr.identity.v1` (separate from settings), through
// injected storage (the shell passes src/browser/storage.js in Phase 85),
// refreshes the id token ahead of expiry, and owns the rolled @handle (roll,
// re-roll — CONTEXT "Identity & the @handle"). The identity is created
// lazily on the first Compete-ON submission; board reads are public and
// need no auth.
//
// This module never reads the network while Compete is OFF: getToken(),
// forceRefresh() and deleteAccount() all check competeOn() before touching
// storage or fetchFn, unless the caller passes { explicit: true } — the one
// exception, reserved for a player-tapped Send on the bug-report sheet
// (SRV-09), so a player's first report creates the shared identity even
// with Compete OFF. The board modules (boardWrites.js/runQueue.js, Phase
// 85) never pass explicit.
//
// Record shape (ddr.identity.v1, JSON): { v: 1, handle, uid, refreshToken,
// idToken, expiresAtMs }. handle/uid/refreshToken/idToken are strings or
// null; expiresAtMs is an absolute epoch-ms number (0 when unknown) computed
// from the injected clock, never a bare Date.now() (Pitfall 6, clock skew).
//
// Nothing in this module logs. A failure result carries only a reason id
// (from IDENTITY_REASONS) and an optional short status string (e.g.
// "OPERATION_NOT_ALLOWED") — never a token.
//
// Phase 85 adds setHandle(handle) so erasing your runs keeps your handle
// (85-CONTEXT group 3, user choice): the board-side erase drops the whole
// identity record (uid, tokens, handle), and setHandle re-seeds it with the
// SAME handle and no uid, so the next Compete-ON run signs up a fresh
// anonymous account under the player's existing @handle. Local only, no
// Compete gate (like ensureHandle/rerollHandle) — it never touches the
// network.

import { IDENTITY_BASE, SECURETOKEN_BASE, timedFetch, readJson, restError } from "./firestoreRest.js";
import { FIREBASE_CONFIG, firebaseConfigured } from "./firebaseConfig.js";
import { rollHandle, isValidHandle } from "./handles.js";

export const IDENTITY_KEY = "ddr.identity.v1";
export const REFRESH_MARGIN_MS = 300000;
export const IDENTITY_REASONS = Object.freeze(["off", "offline", "server", "refused", "unavailable"]);

const EMPTY_RECORD = Object.freeze({ v: 1, handle: null, uid: null, refreshToken: null, idToken: null, expiresAtMs: 0 });

// A terminal refresh error means the refresh token is no longer accepted —
// the identity is restarted (new anonymous sign-up, same handle) rather
// than surfaced as a retryable failure.
const TERMINAL_REFRESH_MESSAGES = Object.freeze([
  "TOKEN_EXPIRED",
  "USER_DISABLED",
  "USER_NOT_FOUND",
  "INVALID_REFRESH_TOKEN",
  "INVALID_GRANT_TYPE",
  "MISSING_REFRESH_TOKEN",
]);

function emptyRecord() {
  return { ...EMPTY_RECORD };
}

/**
 * sanitizeIdentity(raw) — a frozen {v:1, handle, uid, refreshToken, idToken,
 * expiresAtMs} read tolerantly from `raw`. A non-object input returns the
 * empty record. An invalid handle becomes null. A non-string or empty uid
 * (or one longer than 128 chars) becomes null and clears refreshToken,
 * idToken and expiresAtMs along with it. A non-string token becomes null. A
 * non-finite expiresAtMs becomes 0. Never throws.
 */
export function sanitizeIdentity(raw) {
  if (typeof raw !== "object" || raw === null) return EMPTY_RECORD;
  const handle = isValidHandle(raw.handle) ? raw.handle : null;
  let uid = typeof raw.uid === "string" && raw.uid.length > 0 && raw.uid.length <= 128 ? raw.uid : null;
  let refreshToken = typeof raw.refreshToken === "string" ? raw.refreshToken : null;
  let idToken = typeof raw.idToken === "string" ? raw.idToken : null;
  let expiresAtMs = Number.isFinite(raw.expiresAtMs) ? raw.expiresAtMs : 0;
  if (uid === null) {
    refreshToken = null;
    idToken = null;
    expiresAtMs = 0;
  }
  return Object.freeze({ v: 1, handle, uid, refreshToken, idToken, expiresAtMs });
}

/**
 * parseSignUp(json, nowMs) — { uid, idToken, refreshToken, expiresAtMs } from
 * an accounts:signUp 200 body (idToken, refreshToken, expiresIn (seconds,
 * string), localId), or null when the shape doesn't match. expiresAtMs is
 * nowMs + Number(expiresIn) * 1000 (Pitfall 6 — an absolute value via the
 * injected clock, not a duration).
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
 * createIdentity(opts) — the identity factory. opts: { storage, fetchFn,
 * config = FIREBASE_CONFIG, competeOn, now = Date.now, random = Math.random,
 * timeoutMs, setTimer, clearTimer, AbortCtl }. Returns { snapshot,
 * ensureHandle, rerollHandle, setHandle, getToken, forceRefresh,
 * deleteAccount, drop }.
 * `storage` is the only durable side effect (async getItem/setItem/
 * removeItem, per src/browser/storage.js's contract); `fetchFn` is the only
 * network side effect. Never throws.
 */
export function createIdentity(opts = {}) {
  const { storage, fetchFn, config = FIREBASE_CONFIG, competeOn, now = Date.now, random = Math.random, timeoutMs, setTimer, clearTimer, AbortCtl } = opts;

  let loadPromise = null;
  let ensureHandleInFlight = null;
  let signUpInFlight = null;
  let refreshInFlight = null;

  function timedOpts() {
    const o = {};
    if (timeoutMs !== undefined) o.timeoutMs = timeoutMs;
    if (setTimer !== undefined) o.setTimer = setTimer;
    if (clearTimer !== undefined) o.clearTimer = clearTimer;
    if (AbortCtl !== undefined) o.AbortCtl = AbortCtl;
    return o;
  }

  function load() {
    if (loadPromise === null) {
      loadPromise = (async () => {
        try {
          const raw = await storage.getItem(IDENTITY_KEY);
          if (typeof raw !== "string") return emptyRecord();
          let parsed;
          try {
            parsed = JSON.parse(raw);
          } catch {
            return emptyRecord();
          }
          return sanitizeIdentity(parsed);
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
    } catch {
      // best-effort
    }
  }

  async function snapshot() {
    const rec = await load();
    return Object.freeze({ handle: rec.handle, uid: rec.uid });
  }

  async function ensureHandle() {
    const rec = await load();
    if (rec.handle) return rec.handle;
    if (ensureHandleInFlight === null) {
      ensureHandleInFlight = (async () => {
        const rec2 = await load();
        if (rec2.handle) return rec2.handle;
        const handle = rollHandle(random, null);
        const saved = await persist({ ...rec2, handle });
        return saved.handle;
      })().finally(() => {
        ensureHandleInFlight = null;
      });
    }
    return ensureHandleInFlight;
  }

  async function rerollHandle() {
    const rec = await load();
    const previous = rec.handle;
    const handle = rollHandle(random, previous);
    await persist({ ...rec, handle });
    return { handle, previous };
  }

  /**
   * setHandle(handle) — Phase 85 (erase-keeps-the-handle). With an invalid
   * handle, resolves { ok: false, reason: "invalid" } and writes nothing.
   * Otherwise persists { ...record, handle } (uid/tokens untouched when
   * present) and resolves { ok: true, handle }. No Compete gate, no network.
   */
  async function setHandle(handle) {
    if (!isValidHandle(handle)) return { ok: false, reason: "invalid" };
    const rec = await load();
    await persist({ ...rec, handle });
    return { ok: true, handle };
  }

  function competeGateOk(explicit) {
    if (explicit === true) return true;
    return typeof competeOn === "function" && competeOn() === true;
  }

  async function restartIdentity(handle) {
    const rec = await load();
    await persist({ ...rec, uid: null, refreshToken: null, idToken: null, expiresAtMs: 0, handle });
    return signUp(handle);
  }

  async function doSignUp(handle) {
    const url = `${IDENTITY_BASE}/accounts:signUp?key=${encodeURIComponent(config.apiKey)}`;
    const init = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnSecureToken: true }) };
    const raced = await timedFetch(fetchFn, url, init, timedOpts());
    if (!raced.ok) return { ok: false, reason: "offline" };
    const res = raced.res;
    const json = await readJson(res);
    if (res.ok) {
      const parsed = parseSignUp(json, now());
      if (!parsed) return { ok: false, reason: "server" };
      const rec = await load();
      await persist({ ...rec, uid: parsed.uid, idToken: parsed.idToken, refreshToken: parsed.refreshToken, expiresAtMs: parsed.expiresAtMs, handle });
      return { ok: true, uid: parsed.uid, idToken: parsed.idToken, handle };
    }
    const { message } = restError(json);
    if (res.status === 429 || res.status >= 500) return { ok: false, reason: "server" };
    return message ? { ok: false, reason: "refused", status: message } : { ok: false, reason: "refused" };
  }

  function signUp(handle) {
    if (signUpInFlight === null) {
      signUpInFlight = doSignUp(handle).finally(() => {
        signUpInFlight = null;
      });
    }
    return signUpInFlight;
  }

  async function doRefresh(handle) {
    const rec = await load();
    if (!rec.refreshToken) return restartIdentity(handle);

    const url = `${SECURETOKEN_BASE}/token?key=${encodeURIComponent(config.apiKey)}`;
    const body = `grant_type=refresh_token&refresh_token=${encodeURIComponent(rec.refreshToken)}`;
    const init = { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body };
    const raced = await timedFetch(fetchFn, url, init, timedOpts());
    if (!raced.ok) return { ok: false, reason: "offline" };
    const res = raced.res;
    const json = await readJson(res);
    if (res.ok) {
      const parsed = parseRefresh(json, now());
      if (!parsed) return { ok: false, reason: "server" };
      if (rec.uid && parsed.uid !== rec.uid) return restartIdentity(handle);
      await persist({ ...rec, uid: parsed.uid, idToken: parsed.idToken, refreshToken: parsed.refreshToken, expiresAtMs: parsed.expiresAtMs, handle });
      return { ok: true, uid: parsed.uid, idToken: parsed.idToken, handle };
    }
    const { message } = restError(json);
    if (TERMINAL_REFRESH_MESSAGES.includes(message)) return restartIdentity(handle);
    if (res.status === 429 || res.status >= 500) return { ok: false, reason: "server" };
    return message ? { ok: false, reason: "refused", status: message } : { ok: false, reason: "refused" };
  }

  function refresh(handle) {
    if (refreshInFlight === null) {
      refreshInFlight = doRefresh(handle).finally(() => {
        refreshInFlight = null;
      });
    }
    return refreshInFlight;
  }

  /**
   * getToken({ explicit }) — the gated entry point. explicit exists only for
   * a player-tapped Send (SRV-09, the bug-report sheet); board paths never
   * pass it. Order: the Compete gate, then config/fetchFn availability, then
   * ensureHandle(), then sign-up (no uid) / refresh (near expiry) / the
   * cached token.
   */
  async function getToken({ explicit = false } = {}) {
    if (!competeGateOk(explicit)) return { ok: false, reason: "off" };
    if (!firebaseConfigured(config) || typeof fetchFn !== "function") return { ok: false, reason: "unavailable" };
    const handle = await ensureHandle();
    const rec = await load();
    if (!rec.uid) return signUp(handle);
    if (now() > rec.expiresAtMs - REFRESH_MARGIN_MS) return refresh(handle);
    return { ok: true, uid: rec.uid, idToken: rec.idToken, handle };
  }

  /**
   * forceRefresh({ explicit }) — the same gate rule as getToken, but always
   * refreshes (or signs up when there is no uid yet) regardless of the
   * margin. Used after a 401 by the board writer (83-06).
   */
  async function forceRefresh({ explicit = false } = {}) {
    if (!competeGateOk(explicit)) return { ok: false, reason: "off" };
    if (!firebaseConfigured(config) || typeof fetchFn !== "function") return { ok: false, reason: "unavailable" };
    const handle = await ensureHandle();
    const rec = await load();
    if (!rec.uid) return signUp(handle);
    return refresh(handle);
  }

  /**
   * deleteAccount() — Compete-gated (no explicit option). With no uid,
   * resolves { ok: true, deleted: false } with zero calls. With a uid,
   * POSTs accounts:delete; on 200, drops the identity and resolves
   * { ok: true, deleted: true }.
   */
  async function deleteAccount() {
    if (!competeGateOk(false)) return { ok: false, reason: "off" };
    const rec = await load();
    if (!rec.uid) return { ok: true, deleted: false };
    if (!firebaseConfigured(config) || typeof fetchFn !== "function") return { ok: false, reason: "unavailable" };

    const url = `${IDENTITY_BASE}/accounts:delete?key=${encodeURIComponent(config.apiKey)}`;
    const init = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: rec.idToken }) };
    const raced = await timedFetch(fetchFn, url, init, timedOpts());
    if (!raced.ok) return { ok: false, reason: "offline" };
    const res = raced.res;
    if (res.ok) {
      await drop();
      return { ok: true, deleted: true };
    }
    const json = await readJson(res);
    const { message } = restError(json);
    if (res.status === 429 || res.status >= 500) return { ok: false, reason: "server" };
    return message ? { ok: false, reason: "refused", status: message } : { ok: false, reason: "refused" };
  }

  return { snapshot, ensureHandle, rerollHandle, setHandle, getToken, forceRefresh, deleteAccount, drop };
}
