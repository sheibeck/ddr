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
// forceRefresh() and deleteAccount() (Task 2) all check competeOn() before
// touching storage or fetchFn, unless the caller passes { explicit: true }
// — the one exception, reserved for a player-tapped Send on the bug-report
// sheet (SRV-09), so a player's first report creates the shared identity
// even with Compete OFF. The board modules (boardWrites.js/runQueue.js,
// Phase 85) never pass explicit.
//
// Record shape (ddr.identity.v1, JSON): { v: 1, handle, uid, refreshToken,
// idToken, expiresAtMs }. handle/uid/refreshToken/idToken are strings or
// null; expiresAtMs is an absolute epoch-ms number (0 when unknown) computed
// from the injected clock, never a bare Date.now() (Pitfall 6, clock skew).
//
// Task 1 (this commit): the identity record shape, tolerant load, and the
// handle lifecycle (ensureHandle/rerollHandle/drop/snapshot) — no network.
// Task 2 adds lazy sign-up, proactive refresh, the Compete gate and
// account delete.
//
// Nothing in this module logs. A failure result carries only a reason id
// and an optional short status string (e.g. "OPERATION_NOT_ALLOWED") —
// never a token.

import { isValidHandle, rollHandle } from "./handles.js";

export const IDENTITY_KEY = "ddr.identity.v1";
export const REFRESH_MARGIN_MS = 300000;
export const IDENTITY_REASONS = Object.freeze(["off", "offline", "server", "refused", "unavailable"]);

const EMPTY_RECORD = Object.freeze({ v: 1, handle: null, uid: null, refreshToken: null, idToken: null, expiresAtMs: 0 });

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
 * createIdentity(opts) — the identity factory. opts: { storage, fetchFn,
 * config, competeOn, now = Date.now, random = Math.random, timeoutMs,
 * setTimer, clearTimer, AbortCtl }. Task 1 returns { snapshot, ensureHandle,
 * rerollHandle, drop } (fetchFn/config/timers are unused until Task 2 adds
 * getToken/forceRefresh/deleteAccount). `storage` is the only durable side
 * effect (async getItem/setItem/removeItem, per src/browser/storage.js's
 * contract). Never throws.
 */
export function createIdentity(opts = {}) {
  const { storage, random = Math.random } = opts;

  let loadPromise = null;
  let ensureHandleInFlight = null;

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

  return { snapshot, ensureHandle, rerollHandle, drop };
}
