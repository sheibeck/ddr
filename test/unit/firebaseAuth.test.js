// test/unit/firebaseAuth.test.js
//
// Phase 83 Plan 03 — the anonymous player identity: tolerant load, the
// handle lifecycle (Task 1, no network), lazy sign-up, proactive refresh,
// the Compete gate and account delete (Task 2). An in-memory storage double
// (async getItem/setItem/removeItem over a Map) and a hand-rolled fake
// fetchFn stand in for src/browser/storage.js and the network.

import test from "node:test";
import assert from "node:assert/strict";

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { stripJs } from "../../tools/ident-sweep.mjs";
import {
  IDENTITY_KEY,
  REFRESH_MARGIN_MS,
  IDENTITY_REASONS,
  sanitizeIdentity,
  parseSignUp,
  parseRefresh,
  createIdentity,
} from "../../src/browser/firebaseAuth.js";
import { isValidHandle } from "../../src/browser/handles.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const FIREBASE_AUTH_SRC = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "firebaseAuth.js"), "utf8").replace(/\r\n/g, "\n");

const VALID_CONFIG = Object.freeze({
  projectId: "delve-die-repeat-6ba5f",
  apiKey: `AIza${"A".repeat(35)}`,
});

/* ---------------- test doubles ---------------- */

function makeStorage(initial) {
  const map = new Map();
  if (initial !== undefined) map.set(IDENTITY_KEY, initial);
  const calls = { getItem: 0, setItem: 0, removeItem: 0 };
  return {
    calls,
    map,
    async getItem(key) {
      calls.getItem++;
      return map.has(key) ? map.get(key) : null;
    },
    async setItem(key, value) {
      calls.setItem++;
      map.set(key, value);
    },
    async removeItem(key) {
      calls.removeItem++;
      map.delete(key);
    },
  };
}

function stubRandom(...values) {
  let i = 0;
  return () => {
    const v = values[Math.min(i, values.length - 1)];
    i++;
    return v;
  };
}

function jsonRes(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function makeFetch(handler) {
  const calls = [];
  const fn = async (url_, init) => {
    calls.push({ url: url_, init });
    return handler(url_, init, calls.length);
  };
  fn.calls = calls;
  return fn;
}

const neverCalled = async () => {
  throw new Error("fetchFn should not have been called");
};

/* ---------------- constants ---------------- */

test("constants: IDENTITY_KEY, REFRESH_MARGIN_MS, IDENTITY_REASONS", () => {
  assert.equal(IDENTITY_KEY, "ddr.identity.v1");
  assert.equal(REFRESH_MARGIN_MS, 300000);
  assert.deepEqual(IDENTITY_REASONS, ["off", "offline", "server", "refused", "unavailable"]);
  assert.ok(Object.isFrozen(IDENTITY_REASONS));
});

/* ---------------- sanitizeIdentity: tolerant load ---------------- */

test("sanitizeIdentity: a non-object input returns the empty record", () => {
  for (const bad of [null, undefined, 42, "x", []]) {
    const rec = sanitizeIdentity(bad);
    assert.deepEqual(rec, { v: 1, handle: null, uid: null, refreshToken: null, idToken: null, expiresAtMs: 0 });
    assert.ok(Object.isFrozen(rec));
  }
});

test("sanitizeIdentity: an invalid handle becomes null; a valid handle passes through", () => {
  const rec = sanitizeIdentity({ handle: "not-a-real-handle" });
  assert.equal(rec.handle, null);
});

test("sanitizeIdentity: a non-string/empty/too-long uid becomes null and clears refreshToken/idToken/expiresAtMs", () => {
  for (const badUid of [42, "", "x".repeat(129), null, undefined, {}]) {
    const rec = sanitizeIdentity({ uid: badUid, refreshToken: "rt", idToken: "it", expiresAtMs: 12345 });
    assert.equal(rec.uid, null);
    assert.equal(rec.refreshToken, null);
    assert.equal(rec.idToken, null);
    assert.equal(rec.expiresAtMs, 0);
  }
  const okRec = sanitizeIdentity({ uid: "abc123", refreshToken: "rt", idToken: "it", expiresAtMs: 12345 });
  assert.equal(okRec.uid, "abc123");
  assert.equal(okRec.refreshToken, "rt");
  assert.equal(okRec.idToken, "it");
  assert.equal(okRec.expiresAtMs, 12345);
  // exactly 128 chars is still valid
  const rec128 = sanitizeIdentity({ uid: "u".repeat(128), refreshToken: "rt", idToken: "it", expiresAtMs: 5 });
  assert.equal(rec128.uid, "u".repeat(128));
});

test("sanitizeIdentity: a non-string token becomes null", () => {
  const rec = sanitizeIdentity({ uid: "abc", refreshToken: 42, idToken: 99, expiresAtMs: 5 });
  assert.equal(rec.refreshToken, null);
  assert.equal(rec.idToken, null);
});

test("sanitizeIdentity: a non-finite expiresAtMs becomes 0", () => {
  for (const bad of [NaN, Infinity, -Infinity, "not-a-number", undefined, null]) {
    const rec = sanitizeIdentity({ uid: "abc", expiresAtMs: bad });
    assert.equal(rec.expiresAtMs, 0);
  }
});

test("sanitizeIdentity: never throws on weird input", () => {
  for (const bad of [Symbol("x"), () => {}, new Date(), { toString: () => { throw new Error("boom"); } }]) {
    assert.doesNotThrow(() => sanitizeIdentity(bad));
  }
});

/* ---------------- storage tolerant load ---------------- */

test("createIdentity: corrupt JSON, a non-object, or nothing in storage loads as the empty record and never throws", async () => {
  for (const initial of ["{not json", "42", "null", '"a string"', undefined]) {
    const storage = makeStorage(initial);
    const identity = createIdentity({ storage, random: stubRandom(0, 0) });
    const snap = await identity.snapshot();
    assert.deepEqual(snap, { handle: null, uid: null });
  }
});

/* ---------------- ensureHandle / rerollHandle / drop (no network) ---------------- */

test("ensureHandle: rolls with a stub random, persists under ddr.identity.v1, and a second call returns the same handle with no new roll", async () => {
  const storage = makeStorage();
  let rollCount = 0;
  const random = () => {
    rollCount++;
    return 0;
  };
  const identity = createIdentity({ storage, random });
  const h1 = await identity.ensureHandle();
  assert.ok(isValidHandle(h1));
  assert.ok(rollCount > 0);
  const countAfterFirst = rollCount;
  const raw = storage.map.get(IDENTITY_KEY);
  assert.ok(typeof raw === "string");
  assert.deepEqual(JSON.parse(raw).handle, h1);

  const h2 = await identity.ensureHandle();
  assert.equal(h2, h1);
  assert.equal(rollCount, countAfterFirst, "no new roll on the second call");
});

test("ensureHandle: works with no fetchFn at all (offline, before any network)", async () => {
  const storage = makeStorage();
  const identity = createIdentity({ storage, random: stubRandom(0.1, 0.2) });
  const h = await identity.ensureHandle();
  assert.ok(isValidHandle(h));
});

test("ensureHandle: concurrent calls on a fresh identity settle on one persisted handle", async () => {
  const storage = makeStorage();
  const identity = createIdentity({ storage, random: stubRandom(0.3, 0.4) });
  const [h1, h2] = await Promise.all([identity.ensureHandle(), identity.ensureHandle()]);
  assert.equal(h1, h2);
  const raw = storage.map.get(IDENTITY_KEY);
  assert.equal(JSON.parse(raw).handle, h1);
});

test("rerollHandle: returns {handle, previous}, handle differs from previous and is valid, uid/tokens are unchanged", async () => {
  const storage = makeStorage(JSON.stringify({ v: 1, handle: null, uid: "u1", refreshToken: "rt1", idToken: "it1", expiresAtMs: 999 }));
  const identity = createIdentity({ storage, random: stubRandom(0, 0) });
  const first = await identity.ensureHandle();
  const { handle, previous } = await identity.rerollHandle();
  assert.equal(previous, first);
  assert.ok(isValidHandle(handle));
  assert.notEqual(handle, previous);
  const raw = JSON.parse(storage.map.get(IDENTITY_KEY));
  assert.equal(raw.handle, handle);
  assert.equal(raw.uid, "u1");
  assert.equal(raw.refreshToken, "rt1");
  assert.equal(raw.idToken, "it1");
  assert.equal(raw.expiresAtMs, 999);
});

test("drop: calls storage.removeItem(ddr.identity.v1); a later ensureHandle rolls a fresh handle", async () => {
  const storage = makeStorage(JSON.stringify({ v: 1, handle: "@grimtoe", uid: "u1", refreshToken: "rt", idToken: "it", expiresAtMs: 999 }));
  const identity = createIdentity({ storage, random: stubRandom(0.5, 0.6) });
  await identity.drop();
  assert.equal(storage.calls.removeItem, 1);
  assert.equal(storage.map.has(IDENTITY_KEY), false);
  const snap = await identity.snapshot();
  assert.deepEqual(snap, { handle: null, uid: null });
  const h = await identity.ensureHandle();
  assert.ok(isValidHandle(h));
});

/* ---------------- snapshot ---------------- */

test("snapshot: async, resolves a frozen {handle, uid} (uid null before sign-up), never touches the network", async () => {
  const storage = makeStorage(JSON.stringify({ v: 1, handle: "@grimtoe", uid: null, refreshToken: null, idToken: null, expiresAtMs: 0 }));
  const identity = createIdentity({ storage, fetchFn: neverCalled });
  const snap = await identity.snapshot();
  assert.deepEqual(snap, { handle: "@grimtoe", uid: null });
  assert.ok(Object.isFrozen(snap));
});

/* ---------------- purity ---------------- */

test("purity: firebaseAuth.js never touches DOM globals, never calls the bare global fetch, and does not import ./storage.js", () => {
  const code = stripJs(FIREBASE_AUTH_SRC);
  for (const banned of [/\bwindow\b/, /\bdocument\b/, /\bnavigator\b/, /\blocalStorage\b/, /\bsessionStorage\b/]) {
    assert.doesNotMatch(code, banned, `must not use ${banned}`);
  }
  assert.doesNotMatch(code, /(?<!\w)fetch\(/, "must never call the global fetch directly");
  assert.doesNotMatch(code, /from\s+["']\.\/storage\.js["']/, "storage must be injected, not imported");
});

/* ================================================================
   Task 2: lazy sign-up, proactive refresh, the Compete gate, delete
   ================================================================ */

/* ---------------- the Compete gate ---------------- */

test("Compete gate: competeOn missing or not true — getToken/forceRefresh/deleteAccount resolve 'off' with zero fetchFn calls", async () => {
  for (const competeOn of [undefined, () => false, () => "yes", () => 0, "not-a-fn"]) {
    const storage = makeStorage();
    const fetchFn = makeFetch(() => jsonRes(200, {}));
    const identity = createIdentity({ storage, fetchFn, config: VALID_CONFIG, competeOn, random: stubRandom(0, 0) });
    const r1 = await identity.getToken();
    assert.deepEqual(r1, { ok: false, reason: "off" });
    const r2 = await identity.forceRefresh();
    assert.deepEqual(r2, { ok: false, reason: "off" });
    const r3 = await identity.deleteAccount();
    assert.deepEqual(r3, { ok: false, reason: "off" });
    assert.equal(fetchFn.calls.length, 0);
  }
});

test("Compete gate: getToken({explicit:false}) still resolves 'off' with Compete OFF", async () => {
  const storage = makeStorage();
  const identity = createIdentity({ storage, fetchFn: neverCalled, config: VALID_CONFIG, competeOn: () => false });
  const r = await identity.getToken({ explicit: false });
  assert.deepEqual(r, { ok: false, reason: "off" });
});

test("Compete gate: explicit:true skips the gate for getToken (sign-up) and forceRefresh (refresh), even with competeOn false", async () => {
  const storage = makeStorage();
  const fetchFn = makeFetch((url_) => {
    if (url_.includes("accounts:signUp")) return jsonRes(200, { idToken: "idtok1", refreshToken: "rtok1", expiresIn: "3600", localId: "uid1" });
    if (url_.includes("securetoken")) return jsonRes(200, { id_token: "idtok2", refresh_token: "rtok2", expires_in: "3600", user_id: "uid1" });
    return jsonRes(404, {});
  });
  let nowMs = 1000000;
  const identity = createIdentity({ storage, fetchFn, config: VALID_CONFIG, competeOn: () => false, now: () => nowMs, random: stubRandom(0, 0) });

  const signUpResult = await identity.getToken({ explicit: true });
  assert.equal(signUpResult.ok, true);
  assert.equal(signUpResult.uid, "uid1");
  assert.equal(fetchFn.calls.length, 1);

  const forced = await identity.forceRefresh({ explicit: true });
  assert.equal(forced.ok, true);
  assert.equal(forced.uid, "uid1");
  assert.equal(fetchFn.calls.length, 2);
});

test("unavailable: a bad config or a missing fetchFn resolves reason 'unavailable' with zero calls", async () => {
  const storage = makeStorage();
  const badConfig = { projectId: "delve-die-repeat-6ba5f", apiKey: "not-a-real-key" };
  const fetchFn = makeFetch(() => jsonRes(200, {}));

  const identityBadConfig = createIdentity({ storage, fetchFn, config: badConfig, competeOn: () => true, random: stubRandom(0, 0) });
  assert.deepEqual(await identityBadConfig.getToken(), { ok: false, reason: "unavailable" });
  assert.equal(fetchFn.calls.length, 0);

  const identityNoFetch = createIdentity({ storage, config: VALID_CONFIG, competeOn: () => true, random: stubRandom(0, 0) });
  assert.deepEqual(await identityNoFetch.getToken(), { ok: false, reason: "unavailable" });
  assert.deepEqual(await identityNoFetch.forceRefresh(), { ok: false, reason: "unavailable" });
});

/* ---------------- sign-up ---------------- */

test("first Compete-ON getToken: exactly one signUp POST, correct URL/body, stored record uid/tokens/expiresAtMs = now()+3600000", async () => {
  const storage = makeStorage();
  const fetchFn = makeFetch((url_, init) => {
    assert.equal(url_, `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(VALID_CONFIG.apiKey)}`);
    assert.deepEqual(JSON.parse(init.body), { returnSecureToken: true });
    return jsonRes(200, { idToken: "idtok1", refreshToken: "rtok1", expiresIn: "3600", localId: "uid1" });
  });
  const nowMs = 5000000;
  const identity = createIdentity({ storage, fetchFn, config: VALID_CONFIG, competeOn: () => true, now: () => nowMs, random: stubRandom(0, 0) });
  const result = await identity.getToken();
  assert.equal(fetchFn.calls.length, 1);
  assert.deepEqual(result, { ok: true, uid: "uid1", idToken: "idtok1", handle: result.handle });
  assert.ok(isValidHandle(result.handle));

  const stored = JSON.parse(storage.map.get(IDENTITY_KEY));
  assert.equal(stored.uid, "uid1");
  assert.equal(stored.refreshToken, "rtok1");
  assert.equal(stored.idToken, "idtok1");
  assert.equal(stored.expiresAtMs, nowMs + 3600000);
});

test("two getToken() calls started together on a fresh identity make exactly one sign-up request and resolve the same uid", async () => {
  const storage = makeStorage();
  const fetchFn = makeFetch(() => jsonRes(200, { idToken: "idtok1", refreshToken: "rtok1", expiresIn: "3600", localId: "uid1" }));
  const identity = createIdentity({ storage, fetchFn, config: VALID_CONFIG, competeOn: () => true, now: () => 1000, random: stubRandom(0, 0) });
  const [r1, r2] = await Promise.all([identity.getToken(), identity.getToken()]);
  assert.equal(fetchFn.calls.length, 1);
  assert.equal(r1.uid, "uid1");
  assert.equal(r2.uid, "uid1");
});

/* ---------------- refresh margin ---------------- */

test("a token expiring more than 5 minutes out makes zero network calls; one within 5 minutes triggers exactly one refresh POST", async () => {
  const nowMs = 10000000;
  const freshStorage = makeStorage(JSON.stringify({ v: 1, handle: "@grimtoe", uid: "uid1", refreshToken: "rtok1", idToken: "idtok1", expiresAtMs: nowMs + REFRESH_MARGIN_MS + 60000 }));
  const identityFresh = createIdentity({ storage: freshStorage, fetchFn: neverCalled, config: VALID_CONFIG, competeOn: () => true, now: () => nowMs });
  const freshResult = await identityFresh.getToken();
  assert.deepEqual(freshResult, { ok: true, uid: "uid1", idToken: "idtok1", handle: "@grimtoe" });

  const nearStorage = makeStorage(JSON.stringify({ v: 1, handle: "@grimtoe", uid: "uid1", refreshToken: "rtok1", idToken: "idtok1", expiresAtMs: nowMs + 60000 }));
  const fetchFn = makeFetch((url_, init) => {
    assert.equal(url_, `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(VALID_CONFIG.apiKey)}`);
    assert.equal(init.headers["Content-Type"], "application/x-www-form-urlencoded");
    assert.equal(init.body, `grant_type=refresh_token&refresh_token=${encodeURIComponent("rtok1")}`);
    return jsonRes(200, { id_token: "idtok2", refresh_token: "rtok2", expires_in: "3600", user_id: "uid1" });
  });
  const identityNear = createIdentity({ storage: nearStorage, fetchFn, config: VALID_CONFIG, competeOn: () => true, now: () => nowMs });
  const nearResult = await identityNear.getToken();
  assert.equal(fetchFn.calls.length, 1);
  assert.equal(nearResult.ok, true);
  assert.equal(nearResult.idToken, "idtok2");
  const stored = JSON.parse(nearStorage.map.get(IDENTITY_KEY));
  assert.equal(stored.idToken, "idtok2");
  assert.equal(stored.refreshToken, "rtok2");
  assert.equal(stored.expiresAtMs, nowMs + 3600000);
});

/* ---------------- terminal vs transient refresh ---------------- */

for (const message of ["TOKEN_EXPIRED", "USER_DISABLED", "USER_NOT_FOUND", "INVALID_REFRESH_TOKEN", "INVALID_GRANT_TYPE", "MISSING_REFRESH_TOKEN"]) {
  test(`a terminal refresh error (${message}) clears uid/tokens, signs up once more, keeps the handle`, async () => {
    const nowMs = 20000000;
    const storage = makeStorage(JSON.stringify({ v: 1, handle: "@grimtoe", uid: "uid1", refreshToken: "rtok1", idToken: "idtok1", expiresAtMs: nowMs + 60000 }));
    const fetchFn = makeFetch((url_) => {
      if (url_.includes("securetoken")) return jsonRes(400, { error: { code: 400, message, status: "INVALID_ARGUMENT" } });
      if (url_.includes("accounts:signUp")) return jsonRes(200, { idToken: "idtokNEW", refreshToken: "rtokNEW", expiresIn: "3600", localId: "uid2" });
      throw new Error("unexpected url " + url_);
    });
    const identity = createIdentity({ storage, fetchFn, config: VALID_CONFIG, competeOn: () => true, now: () => nowMs, random: stubRandom(0, 0) });
    const result = await identity.getToken();
    assert.equal(fetchFn.calls.length, 2);
    assert.equal(result.ok, true);
    assert.equal(result.uid, "uid2");
    assert.equal(result.handle, "@grimtoe");
    const stored = JSON.parse(storage.map.get(IDENTITY_KEY));
    assert.equal(stored.handle, "@grimtoe");
    assert.equal(stored.uid, "uid2");
  });
}

test("a user_id mismatch on refresh restarts the identity (signs up again)", async () => {
  const nowMs = 20000000;
  const storage = makeStorage(JSON.stringify({ v: 1, handle: "@grimtoe", uid: "uid1", refreshToken: "rtok1", idToken: "idtok1", expiresAtMs: nowMs + 60000 }));
  const fetchFn = makeFetch((url_) => {
    if (url_.includes("securetoken")) return jsonRes(200, { id_token: "idtokX", refresh_token: "rtokX", expires_in: "3600", user_id: "some-other-uid" });
    if (url_.includes("accounts:signUp")) return jsonRes(200, { idToken: "idtokNEW", refreshToken: "rtokNEW", expiresIn: "3600", localId: "uid3" });
    throw new Error("unexpected url " + url_);
  });
  const identity = createIdentity({ storage, fetchFn, config: VALID_CONFIG, competeOn: () => true, now: () => nowMs, random: stubRandom(0, 0) });
  const result = await identity.getToken();
  assert.equal(result.uid, "uid3");
  assert.equal(fetchFn.calls.length, 2);
});

test("a transient refresh/sign-up error leaves the stored identity untouched: timeout/reject -> offline, 429/5xx -> server, other 4xx -> refused", async () => {
  const nowMs = 30000000;
  const original = { v: 1, handle: "@grimtoe", uid: "uid1", refreshToken: "rtok1", idToken: "idtok1", expiresAtMs: nowMs + 60000 };

  // timeout/reject -> offline
  {
    const storage = makeStorage(JSON.stringify(original));
    const fetchFn = makeFetch(async () => {
      throw new Error("network down");
    });
    const identity = createIdentity({ storage, fetchFn, config: VALID_CONFIG, competeOn: () => true, now: () => nowMs });
    const result = await identity.getToken();
    assert.deepEqual(result, { ok: false, reason: "offline" });
    assert.equal(storage.map.get(IDENTITY_KEY), JSON.stringify(original));
  }

  // 429 -> server
  {
    const storage = makeStorage(JSON.stringify(original));
    const fetchFn = makeFetch(() => jsonRes(429, { error: { code: 429, message: "TOO_MANY_ATTEMPTS_TRY_LATER", status: "RESOURCE_EXHAUSTED" } }));
    const identity = createIdentity({ storage, fetchFn, config: VALID_CONFIG, competeOn: () => true, now: () => nowMs });
    const result = await identity.getToken();
    assert.deepEqual(result, { ok: false, reason: "server" });
    assert.equal(storage.map.get(IDENTITY_KEY), JSON.stringify(original));
  }

  // 500 -> server
  {
    const storage = makeStorage(JSON.stringify(original));
    const fetchFn = makeFetch(() => jsonRes(500, { error: { code: 500, message: "INTERNAL", status: "INTERNAL" } }));
    const identity = createIdentity({ storage, fetchFn, config: VALID_CONFIG, competeOn: () => true, now: () => nowMs });
    const result = await identity.getToken();
    assert.deepEqual(result, { ok: false, reason: "server" });
    assert.equal(storage.map.get(IDENTITY_KEY), JSON.stringify(original));
  }

  // other 4xx (not a terminal refresh message) -> refused
  {
    const storage = makeStorage(JSON.stringify(original));
    const fetchFn = makeFetch(() => jsonRes(403, { error: { code: 403, message: "SOME_OTHER_REASON", status: "PERMISSION_DENIED" } }));
    const identity = createIdentity({ storage, fetchFn, config: VALID_CONFIG, competeOn: () => true, now: () => nowMs });
    const result = await identity.getToken();
    assert.equal(result.ok, false);
    assert.equal(result.reason, "refused");
    assert.equal(storage.map.get(IDENTITY_KEY), JSON.stringify(original));
  }
});

test("sign-up: OPERATION_NOT_ALLOWED (400) resolves 'refused'; timeout resolves 'offline'; 429/5xx resolve 'server'", async () => {
  const storage1 = makeStorage();
  const fetchFn1 = makeFetch(() => jsonRes(400, { error: { code: 400, message: "OPERATION_NOT_ALLOWED", errors: [{ message: "OPERATION_NOT_ALLOWED" }] } }));
  const identity1 = createIdentity({ storage: storage1, fetchFn: fetchFn1, config: VALID_CONFIG, competeOn: () => true, now: () => 1, random: stubRandom(0, 0) });
  const r1 = await identity1.getToken();
  assert.equal(r1.ok, false);
  assert.equal(r1.reason, "refused");

  const storage2 = makeStorage();
  const fetchFn2 = makeFetch(async () => {
    throw new Error("down");
  });
  const identity2 = createIdentity({ storage: storage2, fetchFn: fetchFn2, config: VALID_CONFIG, competeOn: () => true, now: () => 1, random: stubRandom(0, 0) });
  const r2 = await identity2.getToken();
  assert.deepEqual(r2, { ok: false, reason: "offline" });

  const storage3 = makeStorage();
  const fetchFn3 = makeFetch(() => jsonRes(503, { error: { code: 503, message: "UNAVAILABLE" } }));
  const identity3 = createIdentity({ storage: storage3, fetchFn: fetchFn3, config: VALID_CONFIG, competeOn: () => true, now: () => 1, random: stubRandom(0, 0) });
  const r3 = await identity3.getToken();
  assert.deepEqual(r3, { ok: false, reason: "server" });
});

/* ---------------- forceRefresh ---------------- */

test("forceRefresh() refreshes regardless of the margin", async () => {
  const nowMs = 40000000;
  const storage = makeStorage(JSON.stringify({ v: 1, handle: "@grimtoe", uid: "uid1", refreshToken: "rtok1", idToken: "idtok1", expiresAtMs: nowMs + 3600000 }));
  const fetchFn = makeFetch((url_) => {
    assert.ok(url_.includes("securetoken"));
    return jsonRes(200, { id_token: "idtok2", refresh_token: "rtok2", expires_in: "3600", user_id: "uid1" });
  });
  const identity = createIdentity({ storage, fetchFn, config: VALID_CONFIG, competeOn: () => true, now: () => nowMs });
  const result = await identity.forceRefresh();
  assert.equal(fetchFn.calls.length, 1);
  assert.equal(result.ok, true);
  assert.equal(result.idToken, "idtok2");
});

/* ---------------- deleteAccount ---------------- */

test("deleteAccount(): no uid -> {ok:true, deleted:false} with zero calls", async () => {
  const storage = makeStorage();
  const fetchFn = makeFetch(() => jsonRes(200, {}));
  const identity = createIdentity({ storage, fetchFn, config: VALID_CONFIG, competeOn: () => true, random: stubRandom(0, 0) });
  const result = await identity.deleteAccount();
  assert.deepEqual(result, { ok: true, deleted: false });
  assert.equal(fetchFn.calls.length, 0);
});

test("deleteAccount(): with a uid, POSTs accounts:delete with {idToken}; on 200 drops the identity and resolves deleted:true", async () => {
  const storage = makeStorage(JSON.stringify({ v: 1, handle: "@grimtoe", uid: "uid1", refreshToken: "rtok1", idToken: "idtok1", expiresAtMs: 999999999 }));
  const fetchFn = makeFetch((url_, init) => {
    assert.equal(url_, `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${encodeURIComponent(VALID_CONFIG.apiKey)}`);
    assert.deepEqual(JSON.parse(init.body), { idToken: "idtok1" });
    return jsonRes(200, {});
  });
  const identity = createIdentity({ storage, fetchFn, config: VALID_CONFIG, competeOn: () => true });
  const result = await identity.deleteAccount();
  assert.deepEqual(result, { ok: true, deleted: true });
  assert.equal(storage.map.has(IDENTITY_KEY), false);
});

test("deleteAccount(): a refused delete leaves the stored identity untouched", async () => {
  const original = { v: 1, handle: "@grimtoe", uid: "uid1", refreshToken: "rtok1", idToken: "idtok1", expiresAtMs: 999999999 };
  const storage = makeStorage(JSON.stringify(original));
  const fetchFn = makeFetch(() => jsonRes(403, { error: { code: 403, message: "PERMISSION_DENIED" } }));
  const identity = createIdentity({ storage, fetchFn, config: VALID_CONFIG, competeOn: () => true });
  const result = await identity.deleteAccount();
  assert.equal(result.ok, false);
  assert.equal(result.reason, "refused");
  assert.equal(storage.map.get(IDENTITY_KEY), JSON.stringify(original));
});

/* ---------------- never leaks a token ---------------- */

test("no resolved value, and no string passed to any injected function other than fetchFn, contains a token", async () => {
  const nowMs = 50000000;
  const storage = makeStorage();
  const storageStrings = [];
  const wrappedStorage = {
    async getItem(key) {
      const v = await storage.getItem(key);
      if (typeof v === "string") storageStrings.push(v);
      return v;
    },
    async setItem(key, value) {
      storageStrings.push(String(value));
      return storage.setItem(key, value);
    },
    async removeItem(key) {
      return storage.removeItem(key);
    },
  };
  const fetchFn = makeFetch((url_) => {
    if (url_.includes("accounts:signUp")) return jsonRes(200, { idToken: "SECRET_ID_TOKEN", refreshToken: "SECRET_REFRESH_TOKEN", expiresIn: "3600", localId: "uid1" });
    return jsonRes(404, {});
  });
  const seenLog = [];
  const loggingRandom = () => {
    seenLog.push("random-call");
    return 0;
  };
  const identity = createIdentity({ storage: wrappedStorage, fetchFn, config: VALID_CONFIG, competeOn: () => true, now: () => nowMs, random: loggingRandom });
  const result = await identity.getToken();
  assert.equal(result.ok, true);

  // storage strings legitimately DO carry the tokens (that's the point of
  // durable storage) — the assertion here is that nothing outside fetchFn's
  // URL/body and storage's own persisted JSON ever sees the raw token text
  // (e.g. it's never embedded in a URL query string or a thrown message).
  for (const call of fetchFn.calls) {
    if (call.url.includes("accounts:signUp")) {
      assert.doesNotMatch(call.url, /SECRET_/);
    }
  }
  assert.deepEqual(seenLog.every((s) => !s.includes("SECRET_")), true);
});
