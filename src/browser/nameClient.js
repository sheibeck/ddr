// src/browser/nameClient.js
//
// Phase 91.2 (BOARD-31, BOARD-32), D-01 and D-06. The browser side of the
// boardName Cloud Function: the client asks the trusted writer for the
// player's name, it never writes one. claim() presents the player's Firebase
// ID token (in the Authorization header only) and gets back the verified Play
// Games name, which the function has already stamped onto the player's runs;
// release() asks the function to delete the name record on erase.
//
// Plain fetch through firestoreRest.js's timedFetch / readJson: pure,
// DOM-free, nothing throws. Every answer is a reason id, never a token and
// never an upstream body:
//   offline      the request failed or timed out
//   server       a 429/5xx, or an answer that does not fit the contract
//   auth         401: the ID token was refused, refresh and retry
//   refused      400/403/422, with the function's code (NOT_LINKED,
//                ADOPT_REFUSED, GAMES_MISMATCH, NO_NAME, BAD_REQUEST)
//   needsCode    409: the function runs NAME_SOURCE=games and wants a fresh
//                server auth code (the G1/A4 fallback)
//   unavailable  no fetch, or the function URL is not https
//
// Contract: 91.2-CONTEXT.md "boardName Cloud Function"; the server is
// functions/board-names/.

import { BOARD_NAME_FN } from "./firebaseConfig.js";
import { timedFetch, readJson } from "./firestoreRest.js";
import { BOARD_NAME_MAX_CHARS, sanitizeBoardName } from "./boardName.js";

/** The closed set of failure reasons claim() and release() may carry. */
export const NAME_CLIENT_REASONS = Object.freeze(["offline", "server", "auth", "refused", "needsCode", "unavailable"]);

const CODE_RE = /^[A-Z][A-Z_]{1,39}$/;

function fail(reason, code) {
  return Object.freeze(code ? { ok: false, reason, code } : { ok: false, reason });
}

function count(n) {
  return Number.isSafeInteger(n) && n >= 0 ? n : 0;
}

// A 200 claim body that fits the contract, or null.
function readClaim(json) {
  if (!json || typeof json !== "object" || json.ok !== true) return null;
  const name = json.name;
  if (typeof name !== "string" || name.length < 1 || name.length > BOARD_NAME_MAX_CHARS) return null;
  if (sanitizeBoardName(name) !== name) return null;
  return Object.freeze({
    ok: true,
    name,
    overridden: json.overridden === true,
    stamped: count(json.stamped),
    adopted: count(json.adopted),
  });
}

/**
 * createNameClient({ fetchFn, fn, timeoutMs, setTimer, clearTimer, AbortCtl })
 * — a frozen { claim, release }. `fn` is { url } (default BOARD_NAME_FN); the
 * timer and abort seams are timedFetch's.
 */
export function createNameClient({ fetchFn, fn = BOARD_NAME_FN, timeoutMs, setTimer, clearTimer, AbortCtl } = {}) {
  const url = fn && typeof fn.url === "string" ? fn.url : "";
  const timing = {};
  if (timeoutMs !== undefined) timing.timeoutMs = timeoutMs;
  if (setTimer !== undefined) timing.setTimer = setTimer;
  if (clearTimer !== undefined) timing.clearTimer = clearTimer;
  if (AbortCtl !== undefined) timing.AbortCtl = AbortCtl;

  async function post(idToken, payload) {
    if (typeof fetchFn !== "function" || !/^https:\/\//i.test(url)) return { early: fail("unavailable") };
    if (typeof idToken !== "string" || idToken === "") return { early: fail("auth") };
    const sent = await timedFetch(
      fetchFn,
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify(payload),
      },
      timing,
    );
    if (!sent.ok) return { early: fail("offline") };
    const json = await readJson(sent.res);
    return { status: sent.res.status, json };
  }

  // Failure mapping shared by claim and release.
  function failureFor(status, json) {
    if (status === 401) return fail("auth");
    if (status === 409 && json && json.error === "NEEDS_GAMES_CODE") return fail("needsCode");
    if (status === 400 || status === 403 || status === 422) {
      const code = json && typeof json.error === "string" && CODE_RE.test(json.error) ? json.error : undefined;
      return fail("refused", code);
    }
    return fail("server");
  }

  async function claim({ idToken, adoptIdToken, gamesAuthCode } = {}) {
    try {
      const payload = { op: "claim" };
      if (typeof adoptIdToken === "string" && adoptIdToken !== "") payload.adoptIdToken = adoptIdToken;
      if (typeof gamesAuthCode === "string" && gamesAuthCode !== "") payload.gamesAuthCode = gamesAuthCode;
      const r = await post(idToken, payload);
      if (r.early) return r.early;
      if (r.status === 200) return readClaim(r.json) ?? fail("server");
      return failureFor(r.status, r.json);
    } catch {
      return fail("server");
    }
  }

  async function release({ idToken } = {}) {
    try {
      const r = await post(idToken, { op: "release" });
      if (r.early) return r.early;
      if (r.status === 200) return r.json && r.json.ok === true ? Object.freeze({ ok: true }) : fail("server");
      return failureFor(r.status, r.json);
    } catch {
      return fail("server");
    }
  }

  return Object.freeze({ claim, release });
}
