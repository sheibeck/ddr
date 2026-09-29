// src/browser/firestoreRest.js
//
// Phase 83 (SRV-01..SRV-08). The ONE Firestore/Identity REST helper module
// every later Phase 83 module imports: the typed-value encoder (moved
// verbatim from bugReport.js so there is exactly one — RESEARCH "Don't
// Hand-Roll"), its decoder, the REST URL builders, and a never-throwing
// timedFetch that mirrors bugReport.js#sendBugReport's abort/timeout race.
// Pure, DOM-free: this module never calls a global fetch, and never reads
// window, document, navigator or storage — the network is reached only
// through an injected fetchFn.

export const FIRESTORE_BASE = "https://firestore.googleapis.com/v1";
export const IDENTITY_BASE = "https://identitytoolkit.googleapis.com/v1";
export const SECURETOKEN_BASE = "https://securetoken.googleapis.com/v1";
export const REQUEST_TIMEOUT_MS = 15000;

// ---------------------------------------------------------------------------
// Typed-value encoder (moved verbatim from bugReport.js — the one encoder)
// ---------------------------------------------------------------------------

function toFirestoreValue(v) {
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (v === null) return { nullValue: null };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFirestoreValue) } };
  return { mapValue: { fields: toFirestoreFields(v) } };
}

/** toFirestoreFields(obj) — obj's own keys through the Firestore REST typed-value encoder. Undefined values are skipped. */
export function toFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    fields[k] = toFirestoreValue(v);
  }
  return fields;
}

// ---------------------------------------------------------------------------
// Typed-value decoder
// ---------------------------------------------------------------------------

/** fromFirestoreValue(value) — the inverse of toFirestoreValue's typed-value JSON shape. Unknown shapes decode to null. */
export function fromFirestoreValue(value) {
  if (typeof value !== "object" || value === null) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) {
    const n = Number(value.integerValue);
    return Number.isSafeInteger(n) ? n : value.integerValue;
  }
  if ("doubleValue" in value) return value.doubleValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("nullValue" in value) return null;
  if ("timestampValue" in value) return value.timestampValue;
  if ("referenceValue" in value) return value.referenceValue;
  if ("mapValue" in value) return fromFirestoreFields(value.mapValue?.fields);
  if ("arrayValue" in value) return (value.arrayValue?.values ?? []).map(fromFirestoreValue);
  return null;
}

/** fromFirestoreFields(fields) — a plain object decoded from a Firestore typed-value fields map. Missing fields decode to {}. */
export function fromFirestoreFields(fields) {
  const out = {};
  if (typeof fields !== "object" || fields === null) return out;
  for (const [k, v] of Object.entries(fields)) out[k] = fromFirestoreValue(v);
  return out;
}

// ---------------------------------------------------------------------------
// REST URL builders
// ---------------------------------------------------------------------------

/** documentsPath(config) — projects/{projectId}/databases/(default)/documents. */
export function documentsPath(config) {
  return `projects/${config.projectId}/databases/(default)/documents`;
}

/** firestoreUrl(config, suffix) — FIRESTORE_BASE + "/" + documentsPath + suffix + the API-key query string. */
export function firestoreUrl(config, suffix) {
  return `${FIRESTORE_BASE}/${documentsPath(config)}${suffix}?key=${encodeURIComponent(config.apiKey)}`;
}

/** docName(config, collection, id) — the full Firestore document name for collection/id. */
export function docName(config, collection, id) {
  return `${documentsPath(config)}/${collection}/${id}`;
}

// ---------------------------------------------------------------------------
// timedFetch — a never-throwing, never-rejecting abort/timeout race
// ---------------------------------------------------------------------------

/**
 * timedFetch(fetchFn, url, init, opts) — mirrors bugReport.js#sendBugReport's
 * abort/timeout race exactly: races fetchFn(url, init) against a timer that
 * aborts the injected AbortController and resolves timed-out first. Resolves
 * { ok: true, res } on a resolving fetchFn, or { ok: false, reason: "offline" }
 * on a rejecting/throwing fetchFn or a timeout. Never throws or rejects; the
 * injected clearTimer always runs exactly once.
 */
export function timedFetch(fetchFn, url, init, opts = {}) {
  const {
    timeoutMs = REQUEST_TIMEOUT_MS,
    setTimer = globalThis.setTimeout,
    clearTimer = globalThis.clearTimeout,
    AbortCtl = globalThis.AbortController,
  } = opts;
  return new Promise((resolve) => {
    try {
      if (typeof fetchFn !== "function") {
        resolve({ ok: false, reason: "offline" });
        return;
      }

      let controller = null;
      let signal;
      if (AbortCtl) {
        controller = new AbortCtl();
        signal = controller.signal;
      }
      const reqInit = signal ? { ...(init ?? {}), signal } : { ...(init ?? {}) };

      let timerId = null;
      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        if (timerId !== null) clearTimer(timerId);
        resolve(result);
      };

      timerId = setTimer(() => {
        if (controller) controller.abort();
        finish({ ok: false, reason: "offline" });
      }, timeoutMs);

      Promise.resolve()
        .then(() => fetchFn(url, reqInit))
        .then((res) => finish({ ok: true, res }))
        .catch(() => finish({ ok: false, reason: "offline" }));
    } catch {
      resolve({ ok: false, reason: "offline" });
    }
  });
}

/** readJson(res) — res.json(), or null on any failure. Never throws. */
export async function readJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/** restError(json) — { status, message } strings read from json.error or json[0].error; empty strings otherwise. */
export function restError(json) {
  const err = json && typeof json === "object" ? (Array.isArray(json) ? json[0]?.error : json.error) : null;
  if (!err || typeof err !== "object") return { status: "", message: "" };
  return {
    status: typeof err.status === "string" ? err.status : "",
    message: typeof err.message === "string" ? err.message : "",
  };
}
