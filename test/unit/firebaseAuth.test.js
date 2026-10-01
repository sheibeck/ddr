// test/unit/firebaseAuth.test.js
//
// Phase 83 Plan 03 (the anonymous token paths) + Phase 91.2 Plan 05 (identity
// v2): tolerant load and the v1 -> v2 migration, lazy anonymous sign-up,
// proactive refresh, the Compete gate, and the Play Games board session
// (sign in, link or adopt, claim, rename, account switch) driven against the
// shared rig (test/unit/harness/boardHarness.js): the fake board server, the
// fake Play Games seam and the real identity.

import test from "node:test";
import assert from "node:assert/strict";

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { stripJs } from "../../tools/ident-sweep.mjs";
import { SEASON } from "../../content/season.js";
import {
  IDENTITY_KEY,
  LEGACY_IDENTITY_KEY,
  REFRESH_MARGIN_MS,
  IDENTITY_REASONS,
  sanitizeIdentity,
  parseSignUp,
  parseRefresh,
  parseIdpSignIn,
  createIdentity,
} from "../../src/browser/firebaseAuth.js";
import { createNameClient } from "../../src/browser/nameClient.js";
import { RUN_CLIENT_FIELDS, rankKeys, runDocId } from "../../src/browser/runDoc.js";
import { makeBoardRig, makeIdentity, makeMemoryStorage, TEST_PLAY_CONFIG } from "./harness/boardHarness.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const FIREBASE_AUTH_SRC = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "firebaseAuth.js"), "utf8").replace(/\r\n/g, "\n");

const VALID_CONFIG = Object.freeze({
  projectId: "delve-die-repeat-6ba5f",
  apiKey: `AIza${"A".repeat(35)}`,
});

/* ---------------- test doubles ---------------- */

function makeStorage(initial) {
  const store = makeMemoryStorage();
  if (initial !== undefined) store.map.set(IDENTITY_KEY, initial);
  return store;
}

function recordJson(over = {}) {
  return JSON.stringify({
    v: 2,
    uid: "uid1",
    refreshToken: "rtok1",
    idToken: "idtok1",
    expiresAtMs: 999999999,
    linked: false,
    playerId: null,
    name: null,
    overridden: false,
    adoptFrom: null,
    ...over,
  });
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

function clockBox(start = 1000000) {
  let t = start;
  const now = () => t;
  now.set = (v) => {
    t = v;
  };
  now.advance = (d) => {
    t += d;
  };
  return now;
}

function storedRecord(storage) {
  const raw = storage.map.get(IDENTITY_KEY);
  return typeof raw === "string" ? JSON.parse(raw) : null;
}

function docFor(overrides = {}) {
  const merged = {
    uid: "fakeuid000001",
    handle: "@gloomjaw",
    season: SEASON,
    name: "Hero",
    race: "Human",
    sub: "Knight",
    cls: "Fighter",
    level: 1,
    floor: 5,
    day: 3,
    steps: 500,
    kills: 10,
    gold: 100,
    sp: 40,
    cause: "combat",
    note: "died",
    epitaph: "",
    when: 1000,
    hash: "00000001",
    version: "2.2.0 (12)",
    seed: 1,
    acts: 10,
    ...overrides,
  };
  const keys = rankKeys(merged);
  const doc = {};
  for (const f of RUN_CLIENT_FIELDS) doc[f] = f in keys ? keys[f] : merged[f];
  return doc;
}

function seedFor(overrides = {}) {
  const doc = docFor(overrides);
  return { id: runDocId(doc.uid, doc.hash), doc };
}

// A 2.2.0 player: an anonymous account whose record sits at the v1 key with a
// rolled handle. The rig's first account is fakeuid000001. Returns the uid.
async function seedV1Anonymous(rig) {
  const token = await rig.identity.getToken({ explicit: true });
  assert.equal(token.ok, true);
  const rec = storedRecord(rig.storage);
  rig.storage.map.delete(IDENTITY_KEY);
  rig.storage.map.set(
    LEGACY_IDENTITY_KEY,
    JSON.stringify({ v: 1, handle: "@gloomjaw", uid: rec.uid, refreshToken: rec.refreshToken, idToken: rec.idToken, expiresAtMs: rec.expiresAtMs }),
  );
  rig.identity = makeIdentity(rig);
  return rec.uid;
}

function idpCalls(rig) {
  return rig.sent.filter((c) => c.url.includes("accounts:signInWithIdp"));
}

function claimCalls(rig) {
  return rig.sent.filter((c) => c.url.includes("/boardName") && c.body && c.body.op === "claim");
}

function callsTo(rig, fragment) {
  return rig.sent.filter((c) => c.url.includes(fragment));
}

/* ---------------- constants ---------------- */

test("constants: the v2 key, the legacy key, the margin, the reasons", () => {
  assert.equal(IDENTITY_KEY, "ddr.identity.v2");
  assert.equal(LEGACY_IDENTITY_KEY, "ddr.identity.v1");
  assert.equal(REFRESH_MARGIN_MS, 300000);
  assert.deepEqual(IDENTITY_REASONS, ["off", "offline", "server", "refused", "unavailable", "signin"]);
  assert.ok(Object.isFrozen(IDENTITY_REASONS));
});

/* ---------------- sanitizeIdentity: tolerant load ---------------- */

const EMPTY = { v: 2, uid: null, refreshToken: null, idToken: null, expiresAtMs: 0, linked: false, playerId: null, name: null, overridden: false, adoptFrom: null };

test("sanitizeIdentity: a non-object input returns the frozen empty v2 record", () => {
  for (const bad of [null, undefined, 42, "x", []]) {
    const rec = sanitizeIdentity(bad);
    assert.deepEqual(rec, EMPTY);
    assert.ok(Object.isFrozen(rec));
  }
});

test("sanitizeIdentity: a non-string/empty/too-long uid becomes null and clears tokens, linked, playerId, name and overridden", () => {
  for (const badUid of [42, "", "x".repeat(129), null, undefined, {}]) {
    const rec = sanitizeIdentity({ uid: badUid, refreshToken: "rt", idToken: "it", expiresAtMs: 12345, linked: true, playerId: "p", name: "Ann", overridden: true });
    assert.deepEqual({ ...rec }, EMPTY);
  }
  const okRec = sanitizeIdentity({ uid: "abc123", refreshToken: "rt", idToken: "it", expiresAtMs: 12345 });
  assert.equal(okRec.uid, "abc123");
  assert.equal(okRec.refreshToken, "rt");
  assert.equal(okRec.idToken, "it");
  assert.equal(okRec.expiresAtMs, 12345);
  assert.equal(sanitizeIdentity({ uid: "u".repeat(128), expiresAtMs: 5 }).uid, "u".repeat(128));
});

test("sanitizeIdentity: tokens must be strings, expiresAtMs finite; the name is sanitized; linked needs a playerId", () => {
  const rec = sanitizeIdentity({ uid: "abc", refreshToken: 42, idToken: 99, expiresAtMs: NaN });
  assert.equal(rec.refreshToken, null);
  assert.equal(rec.idToken, null);
  assert.equal(rec.expiresAtMs, 0);

  const named = sanitizeIdentity({ uid: "abc", linked: true, playerId: "p1", name: "  Ann \n  Lee\u0000 ", overridden: true });
  assert.equal(named.name, "Ann Lee");
  assert.equal(named.linked, true);
  assert.equal(named.overridden, true);

  const noPlayer = sanitizeIdentity({ uid: "abc", linked: true, name: "Ann" });
  assert.equal(noPlayer.linked, false);

  const blankName = sanitizeIdentity({ uid: "abc", linked: true, playerId: "p1", name: "   ", overridden: true });
  assert.equal(blankName.name, null);
  assert.equal(blankName.overridden, false);
});

test("sanitizeIdentity: adoptFrom needs a uid and a refresh token, else null", () => {
  assert.deepEqual({ ...sanitizeIdentity({ uid: "u", adoptFrom: { uid: "a1", refreshToken: "r1" } }).adoptFrom }, { uid: "a1", refreshToken: "r1" });
  for (const bad of [null, "x", {}, { uid: "a1" }, { refreshToken: "r" }, { uid: "", refreshToken: "r" }, { uid: "a", refreshToken: 5 }]) {
    assert.equal(sanitizeIdentity({ uid: "u", adoptFrom: bad }).adoptFrom, null);
  }
});

test("sanitizeIdentity: a v1 shaped record reads as v2 with its uid and tokens and no handle", () => {
  const rec = sanitizeIdentity({ v: 1, handle: "@gloomjaw", uid: "u1", refreshToken: "rt", idToken: "it", expiresAtMs: 77 });
  assert.equal(rec.v, 2);
  assert.equal(rec.uid, "u1");
  assert.equal(rec.refreshToken, "rt");
  assert.equal(rec.expiresAtMs, 77);
  assert.equal("handle" in rec, false);
});

test("sanitizeIdentity: never throws on weird input", () => {
  for (const bad of [Symbol("x"), () => {}, new Date(), { toString: () => { throw new Error("boom"); } }, new Proxy({}, { get() { throw new Error("trap"); } })]) {
    assert.doesNotThrow(() => sanitizeIdentity(bad));
  }
});

/* ---------------- the parsers ---------------- */

test("parseSignUp / parseRefresh: absolute expiry from the injected clock, null on a bad shape", () => {
  assert.deepEqual(parseSignUp({ idToken: "i", refreshToken: "r", expiresIn: "3600", localId: "u" }, 5000), { uid: "u", idToken: "i", refreshToken: "r", expiresAtMs: 5000 + 3600000 });
  assert.equal(parseSignUp({ idToken: "i" }, 0), null);
  assert.equal(parseSignUp(null, 0), null);
  assert.deepEqual(parseRefresh({ id_token: "i", refresh_token: "r", expires_in: "60", user_id: "u" }, 1000), { uid: "u", idToken: "i", refreshToken: "r", expiresAtMs: 61000 });
  assert.equal(parseRefresh({ id_token: "i" }, 0), null);
});

test("parseIdpSignIn: a session, the already-linked marker, or null", () => {
  assert.deepEqual(parseIdpSignIn({ localId: "u", idToken: "i", refreshToken: "r", expiresIn: "3600" }, 10), { uid: "u", idToken: "i", refreshToken: "r", expiresAtMs: 3600010 });
  assert.deepEqual(parseIdpSignIn({ errorMessage: "FEDERATED_USER_ID_ALREADY_LINKED", providerId: "playgames.google.com" }, 0), { alreadyLinked: true });
  assert.equal(parseIdpSignIn({ errorMessage: "SOMETHING_ELSE" }, 0), null);
  assert.equal(parseIdpSignIn("nope", 0), null);
  assert.equal(parseIdpSignIn(undefined, 0), null);
});

/* ---------------- storage: tolerant load, the v1 -> v2 migration ---------------- */

test("createIdentity: corrupt JSON, a non-object, or nothing in storage loads as the empty record and never throws", async () => {
  for (const initial of ["{not json", "42", "null", '"a string"', undefined]) {
    const identity = createIdentity({ storage: makeStorage(initial) });
    assert.deepEqual({ ...(await identity.snapshot()) }, { uid: null, name: null, linked: false, playerId: null });
  }
});

test("migration: a v1 record keeps its uid and tokens, loses its handle, and the v1 key is removed", async () => {
  const storage = makeMemoryStorage({ [LEGACY_IDENTITY_KEY]: JSON.stringify({ v: 1, handle: "@grimtoe", uid: "u1", refreshToken: "rt1", idToken: "it1", expiresAtMs: 999 }) });
  const identity = createIdentity({ storage, fetchFn: neverCalled });
  const snap = await identity.snapshot();
  assert.deepEqual({ ...snap }, { uid: "u1", name: null, linked: false, playerId: null });
  assert.equal(storage.map.has(LEGACY_IDENTITY_KEY), false);
  const rec = JSON.parse(storage.map.get(IDENTITY_KEY));
  assert.equal(rec.v, 2);
  assert.equal(rec.uid, "u1");
  assert.equal(rec.refreshToken, "rt1");
  assert.equal(rec.idToken, "it1");
  assert.equal(rec.expiresAtMs, 999);
  assert.equal("handle" in rec, false);
});

test("migration: a v1 record with no uid (just a handle) is removed and nothing is written at v2", async () => {
  const storage = makeMemoryStorage({ [LEGACY_IDENTITY_KEY]: JSON.stringify({ v: 1, handle: "@grimtoe", uid: null, refreshToken: null, idToken: null, expiresAtMs: 0 }) });
  const identity = createIdentity({ storage, fetchFn: neverCalled });
  assert.equal((await identity.snapshot()).uid, null);
  assert.equal(storage.map.has(LEGACY_IDENTITY_KEY), false);
  assert.equal(storage.map.has(IDENTITY_KEY), false);
});

test("migration: a v2 record wins and the v1 key is never read", async () => {
  const storage = makeMemoryStorage({ [IDENTITY_KEY]: recordJson({ uid: "u2" }), [LEGACY_IDENTITY_KEY]: JSON.stringify({ v: 1, uid: "u1", refreshToken: "x", idToken: "y", expiresAtMs: 1 }) });
  const identity = createIdentity({ storage, fetchFn: neverCalled });
  assert.equal((await identity.snapshot()).uid, "u2");
});

test("drop: removes the identity key; a later snapshot is empty", async () => {
  const storage = makeStorage(recordJson());
  const identity = createIdentity({ storage, fetchFn: neverCalled });
  await identity.drop();
  assert.equal(storage.map.has(IDENTITY_KEY), false);
  assert.deepEqual({ ...(await identity.snapshot()) }, { uid: null, name: null, linked: false, playerId: null });
});

test("snapshot: async, a frozen {uid, name, linked, playerId}, never touches the network", async () => {
  const storage = makeStorage(recordJson({ linked: true, playerId: "p1", name: "Ann" }));
  const identity = createIdentity({ storage, fetchFn: neverCalled });
  const snap = await identity.snapshot();
  assert.deepEqual({ ...snap }, { uid: "uid1", name: "Ann", linked: true, playerId: "p1" });
  assert.ok(Object.isFrozen(snap));
});

test("the identity's frozen surface is exactly the v2 methods (no handle methods)", () => {
  const identity = createIdentity({ storage: makeStorage() });
  assert.deepEqual(Object.keys(identity).sort(), ["boardSession", "deleteAccount", "drop", "forceRefresh", "getToken", "refreshName", "signIn", "snapshot"]);
  assert.ok(Object.isFrozen(identity));
});

/* ---------------- purity ---------------- */

test("purity: firebaseAuth.js never touches DOM globals, never calls the bare global fetch, never logs, does not import ./storage.js", () => {
  const code = stripJs(FIREBASE_AUTH_SRC);
  for (const banned of [/\bwindow\b/, /\bdocument\b/, /\bnavigator\b/, /\blocalStorage\b/, /\bsessionStorage\b/, /\bconsole\b/]) {
    assert.doesNotMatch(code, banned, `must not use ${banned}`);
  }
  assert.doesNotMatch(code, /(?<!\w)fetch\(/, "must never call the global fetch directly");
  assert.doesNotMatch(code, /from\s+["']\.\/storage\.js["']/, "storage must be injected, not imported");
});

/* ================================================================
   the anonymous token paths (stub fetch)
   ================================================================ */

/* ---------------- the Compete gate ---------------- */

test("Compete gate: competeOn missing or not true: getToken/forceRefresh/deleteAccount/boardSession/refreshName/signIn resolve 'off' with zero fetchFn calls", async () => {
  for (const competeOn of [undefined, () => false, () => "yes", () => 0, "not-a-fn"]) {
    const fetchFn = makeFetch(() => jsonRes(200, {}));
    const identity = createIdentity({ storage: makeStorage(), fetchFn, config: VALID_CONFIG, competeOn });
    for (const run of [
      () => identity.getToken(),
      () => identity.forceRefresh(),
      () => identity.deleteAccount(),
      () => identity.boardSession(),
      () => identity.signIn(),
      () => identity.refreshName(),
    ]) {
      assert.deepEqual(await run(), { ok: false, reason: "off" });
    }
    assert.equal(fetchFn.calls.length, 0);
  }
});

test("Compete gate: explicit:true skips the gate for getToken (sign-up) and forceRefresh (refresh), even with competeOn false", async () => {
  const fetchFn = makeFetch((url_) => {
    if (url_.includes("accounts:signUp")) return jsonRes(200, { idToken: "idtok1", refreshToken: "rtok1", expiresIn: "3600", localId: "uid1" });
    if (url_.includes("securetoken")) return jsonRes(200, { id_token: "idtok2", refresh_token: "rtok2", expires_in: "3600", user_id: "uid1" });
    return jsonRes(404, {});
  });
  const identity = createIdentity({ storage: makeStorage(), fetchFn, config: VALID_CONFIG, competeOn: () => false, now: () => 1000000 });

  const signUpResult = await identity.getToken({ explicit: true });
  assert.deepEqual(signUpResult, { ok: true, uid: "uid1", idToken: "idtok1" });
  assert.equal(fetchFn.calls.length, 1);

  const forced = await identity.forceRefresh({ explicit: true });
  assert.equal(forced.ok, true);
  assert.equal(forced.uid, "uid1");
  assert.equal(fetchFn.calls.length, 2);
});

test("explicit bug-report token: Compete OFF and no record signs up anonymously and never calls Play Games", async () => {
  const rig = makeBoardRig({ competeOn: () => false });
  const token = await rig.identity.getToken({ explicit: true });
  assert.equal(token.ok, true);
  assert.equal(rig.play.calls().length, 0);
  assert.equal(rig.fake.providers(token.uid).length, 0);
  assert.equal(rig.fake.names().length, 0);
  assert.deepEqual(callsTo(rig, "signInWithIdp"), []);
});

test("unavailable: a bad config or a missing fetchFn resolves reason 'unavailable' with zero calls", async () => {
  const fetchFn = makeFetch(() => jsonRes(200, {}));
  const badConfig = { projectId: "delve-die-repeat-6ba5f", apiKey: "not-a-real-key" };

  const identityBadConfig = createIdentity({ storage: makeStorage(), fetchFn, config: badConfig, competeOn: () => true });
  assert.deepEqual(await identityBadConfig.getToken(), { ok: false, reason: "unavailable" });
  assert.equal(fetchFn.calls.length, 0);

  const identityNoFetch = createIdentity({ storage: makeStorage(), config: VALID_CONFIG, competeOn: () => true });
  assert.deepEqual(await identityNoFetch.getToken(), { ok: false, reason: "unavailable" });
  assert.deepEqual(await identityNoFetch.forceRefresh(), { ok: false, reason: "unavailable" });
});

/* ---------------- sign-up ---------------- */

test("first anonymous getToken: exactly one signUp POST, correct URL/body, stored record uid/tokens/expiresAtMs = now()+3600000, no handle", async () => {
  const storage = makeStorage();
  const fetchFn = makeFetch((url_, init) => {
    assert.equal(url_, `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(VALID_CONFIG.apiKey)}`);
    assert.deepEqual(JSON.parse(init.body), { returnSecureToken: true });
    return jsonRes(200, { idToken: "idtok1", refreshToken: "rtok1", expiresIn: "3600", localId: "uid1" });
  });
  const nowMs = 5000000;
  const identity = createIdentity({ storage, fetchFn, config: VALID_CONFIG, competeOn: () => true, now: () => nowMs });
  const result = await identity.getToken();
  assert.equal(fetchFn.calls.length, 1);
  assert.deepEqual(result, { ok: true, uid: "uid1", idToken: "idtok1" });

  const stored = storedRecord(storage);
  assert.equal(stored.v, 2);
  assert.equal(stored.uid, "uid1");
  assert.equal(stored.refreshToken, "rtok1");
  assert.equal(stored.idToken, "idtok1");
  assert.equal(stored.expiresAtMs, nowMs + 3600000);
  assert.equal(stored.linked, false);
  assert.equal("handle" in stored, false);
});

test("two getToken() calls started together on a fresh identity make exactly one sign-up request and resolve the same uid", async () => {
  const fetchFn = makeFetch(() => jsonRes(200, { idToken: "idtok1", refreshToken: "rtok1", expiresIn: "3600", localId: "uid1" }));
  const identity = createIdentity({ storage: makeStorage(), fetchFn, config: VALID_CONFIG, competeOn: () => true, now: () => 1000 });
  const [r1, r2] = await Promise.all([identity.getToken(), identity.getToken()]);
  assert.equal(fetchFn.calls.length, 1);
  assert.equal(r1.uid, "uid1");
  assert.equal(r2.uid, "uid1");
});

/* ---------------- refresh margin ---------------- */

test("a token expiring more than 5 minutes out makes zero network calls; one within 5 minutes triggers exactly one refresh POST", async () => {
  const nowMs = 10000000;
  const freshStorage = makeStorage(recordJson({ expiresAtMs: nowMs + REFRESH_MARGIN_MS + 60000 }));
  const identityFresh = createIdentity({ storage: freshStorage, fetchFn: neverCalled, config: VALID_CONFIG, competeOn: () => true, now: () => nowMs });
  assert.deepEqual(await identityFresh.getToken(), { ok: true, uid: "uid1", idToken: "idtok1" });

  const nearStorage = makeStorage(recordJson({ expiresAtMs: nowMs + 60000 }));
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
  const stored = storedRecord(nearStorage);
  assert.equal(stored.idToken, "idtok2");
  assert.equal(stored.refreshToken, "rtok2");
  assert.equal(stored.expiresAtMs, nowMs + 3600000);
});

/* ---------------- terminal vs transient refresh ---------------- */

for (const message of ["TOKEN_EXPIRED", "USER_DISABLED", "USER_NOT_FOUND", "INVALID_REFRESH_TOKEN", "INVALID_GRANT_TYPE", "MISSING_REFRESH_TOKEN"]) {
  test(`a terminal refresh error (${message}) clears uid/tokens, signs up once more, and forgets a stale link`, async () => {
    const nowMs = 20000000;
    const storage = makeStorage(recordJson({ expiresAtMs: nowMs + 60000, linked: true, playerId: "p1", name: "Ann" }));
    const fetchFn = makeFetch((url_) => {
      if (url_.includes("securetoken")) return jsonRes(400, { error: { code: 400, message, status: "INVALID_ARGUMENT" } });
      if (url_.includes("accounts:signUp")) return jsonRes(200, { idToken: "idtokNEW", refreshToken: "rtokNEW", expiresIn: "3600", localId: "uid2" });
      throw new Error("unexpected url " + url_);
    });
    const identity = createIdentity({ storage, fetchFn, config: VALID_CONFIG, competeOn: () => true, now: () => nowMs });
    const result = await identity.getToken();
    assert.equal(fetchFn.calls.length, 2);
    assert.equal(result.ok, true);
    assert.equal(result.uid, "uid2");
    const stored = storedRecord(storage);
    assert.equal(stored.uid, "uid2");
    assert.equal(stored.linked, false);
    assert.equal(stored.name, null);
  });
}

test("a user_id mismatch on refresh restarts the identity (signs up again)", async () => {
  const nowMs = 20000000;
  const storage = makeStorage(recordJson({ expiresAtMs: nowMs + 60000 }));
  const fetchFn = makeFetch((url_) => {
    if (url_.includes("securetoken")) return jsonRes(200, { id_token: "idtokX", refresh_token: "rtokX", expires_in: "3600", user_id: "some-other-uid" });
    if (url_.includes("accounts:signUp")) return jsonRes(200, { idToken: "idtokNEW", refreshToken: "rtokNEW", expiresIn: "3600", localId: "uid3" });
    throw new Error("unexpected url " + url_);
  });
  const identity = createIdentity({ storage, fetchFn, config: VALID_CONFIG, competeOn: () => true, now: () => nowMs });
  const result = await identity.getToken();
  assert.equal(result.uid, "uid3");
  assert.equal(fetchFn.calls.length, 2);
});

test("a transient refresh error leaves the stored identity untouched: timeout/reject -> offline, 429/5xx -> server, other 4xx -> refused", async () => {
  const nowMs = 30000000;
  const original = recordJson({ expiresAtMs: nowMs + 60000 });
  const cases = [
    [async () => { throw new Error("network down"); }, { ok: false, reason: "offline" }],
    [() => jsonRes(429, { error: { code: 429, message: "TOO_MANY_ATTEMPTS_TRY_LATER", status: "RESOURCE_EXHAUSTED" } }), { ok: false, reason: "server" }],
    [() => jsonRes(500, { error: { code: 500, message: "INTERNAL", status: "INTERNAL" } }), { ok: false, reason: "server" }],
    [() => jsonRes(403, { error: { code: 403, message: "SOME_OTHER_REASON", status: "PERMISSION_DENIED" } }), { ok: false, reason: "refused", status: "SOME_OTHER_REASON" }],
  ];
  for (const [handler, expected] of cases) {
    const storage = makeStorage(original);
    const identity = createIdentity({ storage, fetchFn: makeFetch(handler), config: VALID_CONFIG, competeOn: () => true, now: () => nowMs });
    assert.deepEqual(await identity.getToken(), expected);
    assert.equal(storage.map.get(IDENTITY_KEY), original);
  }
});

test("sign-up: OPERATION_NOT_ALLOWED (400) resolves 'refused'; timeout resolves 'offline'; 429/5xx resolve 'server'", async () => {
  const make = (handler) => createIdentity({ storage: makeStorage(), fetchFn: makeFetch(handler), config: VALID_CONFIG, competeOn: () => true, now: () => 1 });
  const r1 = await make(() => jsonRes(400, { error: { code: 400, message: "OPERATION_NOT_ALLOWED" } })).getToken();
  assert.equal(r1.ok, false);
  assert.equal(r1.reason, "refused");
  assert.deepEqual(await make(async () => { throw new Error("down"); }).getToken(), { ok: false, reason: "offline" });
  assert.deepEqual(await make(() => jsonRes(503, { error: { code: 503, message: "UNAVAILABLE" } })).getToken(), { ok: false, reason: "server" });
});

test("forceRefresh() refreshes regardless of the margin", async () => {
  const nowMs = 40000000;
  const storage = makeStorage(recordJson({ expiresAtMs: nowMs + 3600000 }));
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

/* ---------------- deleteAccount (stub fetch) ---------------- */

test("deleteAccount(): no uid -> {ok:true, deleted:false} with zero calls", async () => {
  const fetchFn = makeFetch(() => jsonRes(200, {}));
  const identity = createIdentity({ storage: makeStorage(), fetchFn, config: VALID_CONFIG, competeOn: () => true });
  assert.deepEqual(await identity.deleteAccount(), { ok: true, deleted: false });
  assert.equal(fetchFn.calls.length, 0);
});

test("deleteAccount(): an anonymous uid POSTs accounts:delete with {idToken}; on 200 drops the identity and resolves deleted:true", async () => {
  const storage = makeStorage(recordJson());
  const fetchFn = makeFetch((url_, init) => {
    assert.equal(url_, `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${encodeURIComponent(VALID_CONFIG.apiKey)}`);
    assert.deepEqual(JSON.parse(init.body), { idToken: "idtok1" });
    return jsonRes(200, {});
  });
  const identity = createIdentity({ storage, fetchFn, config: VALID_CONFIG, competeOn: () => true, now: () => 1000 });
  assert.deepEqual(await identity.deleteAccount(), { ok: true, deleted: true });
  assert.equal(fetchFn.calls.length, 1, "an anonymous account never asked the name function to release anything");
  assert.equal(storage.map.has(IDENTITY_KEY), false);
});

test("deleteAccount(): a refused delete leaves the stored identity untouched", async () => {
  const original = recordJson();
  const storage = makeStorage(original);
  const fetchFn = makeFetch(() => jsonRes(403, { error: { code: 403, message: "PERMISSION_DENIED" } }));
  const identity = createIdentity({ storage, fetchFn, config: VALID_CONFIG, competeOn: () => true, now: () => 1000 });
  const result = await identity.deleteAccount();
  assert.equal(result.ok, false);
  assert.equal(result.reason, "refused");
  assert.equal(storage.map.get(IDENTITY_KEY), original);
});

/* ================================================================
   the Play Games board session (the shared rig)
   ================================================================ */

test("boardSession: Compete OFF resolves off and calls neither playIdentity nor fetch", async () => {
  const rig = makeBoardRig({ competeOn: () => false });
  assert.deepEqual(await rig.identity.boardSession(), { ok: false, reason: "off" });
  assert.deepEqual(await rig.identity.signIn(), { ok: false, reason: "off" });
  assert.equal(rig.play.calls().length, 0);
  assert.equal(rig.sent.length, 0);
});

test("boardSession: no playIdentity, an unconfigured playConfig or an unconfigured Firebase config resolves unavailable with zero calls", async () => {
  const rig = makeBoardRig();
  const variants = [
    { playIdentity: undefined },
    { playConfig: { appId: TEST_PLAY_CONFIG.appId, webClientId: "" } },
    { config: { projectId: "delve-die-repeat-6ba5f", apiKey: "not-a-real-key" } },
    { fetchFn: undefined },
  ];
  for (const over of variants) {
    const identity = makeIdentity(rig, { storage: makeMemoryStorage(), ...over });
    assert.deepEqual(await identity.boardSession(), { ok: false, reason: "unavailable" });
    assert.deepEqual(await identity.signIn(), { ok: false, reason: "unavailable" });
  }
  assert.equal(rig.play.calls().length, 0);
  assert.equal(rig.sent.length, 0);
});

test("boardSession: PlayIdentity failures map config -> unavailable, denied -> signin, error -> server", async () => {
  const rig = makeBoardRig();
  for (const [reason, expected] of [["config", "unavailable"], ["unavailable", "unavailable"], ["denied", "signin"], ["error", "server"]]) {
    const stub = { status: async () => ({ ok: false, reason }), signIn: async () => ({ ok: false, reason }), serverAuthCode: async () => ({ ok: false, reason }) };
    const identity = makeIdentity(rig, { storage: makeMemoryStorage(), playIdentity: stub });
    assert.deepEqual(await identity.boardSession(), { ok: false, reason: expected });
  }
  const throwing = { status: async () => { throw new Error("boom"); }, signIn: async () => ({ ok: true, signedIn: false }), serverAuthCode: async () => ({ ok: false, reason: "error" }) };
  assert.deepEqual(await makeIdentity(rig, { storage: makeMemoryStorage(), playIdentity: throwing }).boardSession(), { ok: false, reason: "server" });
  assert.equal(rig.sent.length, 0);
});

test("boardSession: a signed-out player resolves signin with no network call; interactive / signIn() asks once and continues", async () => {
  const rig = makeBoardRig({ play: { signedIn: false, interactive: true } });
  assert.deepEqual(await rig.identity.boardSession(), { ok: false, reason: "signin" });
  assert.equal(rig.sent.length, 0);
  assert.deepEqual(rig.play.calls().map((c) => c.method), ["status"]);

  const res = await rig.identity.signIn();
  assert.equal(res.ok, true);
  assert.equal(res.name, "Dev Delver");
  assert.equal(rig.play.calls().filter((c) => c.method === "signIn").length, 1);
});

test("boardSession: a player who dismisses the sign-in prompt stays signin", async () => {
  const rig = makeBoardRig({ play: { signedIn: false, interactive: false } });
  assert.deepEqual(await rig.identity.signIn(), { ok: false, reason: "signin" });
  assert.equal(rig.sent.length, 0);
  assert.equal(rig.play.calls().filter((c) => c.method === "signIn").length, 1);
});

test("boardSession: a fresh install signs in without an idToken, claims, and returns the player's name", async () => {
  const rig = makeBoardRig({ play: { playerId: "p-ann", displayName: "Ann the Bold" } });
  const res = await rig.identity.boardSession();
  assert.equal(res.ok, true);
  assert.equal(res.name, "Ann the Bold");
  assert.equal(typeof res.idToken, "string");

  const idp = idpCalls(rig);
  assert.equal(idp.length, 1);
  assert.equal(idp[0].body.idToken, undefined);
  assert.equal(idp[0].body.requestUri, "http://localhost");
  assert.equal(idp[0].body.returnSecureToken, true);
  assert.equal(idp[0].body.returnIdpCredential, true);
  assert.match(idp[0].body.postBody, /^code=fake%3Ap-ann%3AAnn%2520the%2520Bold%3A1&providerId=playgames\.google\.com$/);
  assert.equal(claimCalls(rig).length, 1);

  assert.deepEqual(rig.fake.names().map((n) => ({ ...n })), [{ uid: res.uid, name: "Ann the Bold" }]);
  const rec = storedRecord(rig.storage);
  assert.equal(rec.linked, true);
  assert.equal(rec.playerId, "p-ann");
  assert.equal(rec.name, "Ann the Bold");
  assert.equal(rec.adoptFrom, null);
  assert.deepEqual({ ...(await rig.identity.snapshot()) }, { uid: res.uid, name: "Ann the Bold", linked: true, playerId: "p-ann" });
});

test("D-06: until the claim returns a name the session is not complete (and the link is kept for the retry)", async () => {
  const rig = makeBoardRig();
  let blockClaim = true;
  const identity = makeIdentity(rig, {
    fetchFn: (u, init) => (blockClaim && u.includes("/boardName") ? Promise.reject(new TypeError("down")) : rig.fetchFn(u, init)),
  });
  assert.deepEqual(await identity.boardSession(), { ok: false, reason: "offline" });
  assert.equal(rig.fake.names().length, 0);
  assert.equal((await identity.snapshot()).name, null);
  assert.equal((await identity.snapshot()).linked, true);

  blockClaim = false;
  const again = await identity.boardSession();
  assert.equal(again.ok, true);
  assert.equal(idpCalls(rig).length, 1, "the link was not repeated");
});

test("boardSession: a later session with a valid cached token and name calls only playIdentity.status", async () => {
  const clock = clockBox();
  const rig = makeBoardRig({ now: clock });
  assert.equal((await rig.identity.boardSession()).ok, true);
  const sentBefore = rig.sent.length;
  const playBefore = rig.play.calls().length;

  const second = await rig.identity.boardSession();
  assert.equal(second.ok, true);
  assert.equal(second.name, "Dev Delver");
  assert.equal(rig.sent.length, sentBefore);
  assert.deepEqual(rig.play.calls().slice(playBefore).map((c) => c.method), ["status"]);
});

test("boardSession: a token near expiry refreshes (securetoken only) without signing in or claiming again", async () => {
  const clock = clockBox();
  const rig = makeBoardRig({ now: clock });
  assert.equal((await rig.identity.boardSession()).ok, true);
  const idpBefore = idpCalls(rig).length;
  const claimsBefore = claimCalls(rig).length;
  clock.advance(3600000 - REFRESH_MARGIN_MS + 1000);

  const res = await rig.identity.boardSession();
  assert.equal(res.ok, true);
  assert.equal(callsTo(rig, "securetoken").length, 1);
  assert.equal(idpCalls(rig).length, idpBefore);
  assert.equal(claimCalls(rig).length, claimsBefore);
});

test("boardSession: concurrent sessions are single-flight", async () => {
  const rig = makeBoardRig();
  const [a, b] = await Promise.all([rig.identity.boardSession(), rig.identity.boardSession()]);
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(a.uid, b.uid);
  assert.equal(idpCalls(rig).length, 1);
  assert.equal(claimCalls(rig).length, 1);
});

test("boardSession: an interactive request queued behind a signin-failed session still gets its prompt", async () => {
  const rig = makeBoardRig({ play: { signedIn: false, interactive: true } });
  const [quiet, loud] = await Promise.all([rig.identity.boardSession(), rig.identity.boardSession({ interactive: true })]);
  assert.deepEqual(quiet, { ok: false, reason: "signin" });
  assert.equal(loud.ok, true);
});

test("boardSession: the server not having the provider enabled resolves unavailable; offline resolves offline; a 5xx resolves server", async () => {
  const off = makeBoardRig({ fakeOpts: { playGamesEnabled: false } });
  assert.deepEqual(await off.identity.boardSession(), { ok: false, reason: "unavailable" });

  const down = makeBoardRig();
  down.fake.setOnline(false);
  assert.deepEqual(await down.identity.boardSession(), { ok: false, reason: "offline" });

  const rig = makeBoardRig();
  const flaky = makeIdentity(rig, { storage: makeMemoryStorage(), fetchFn: async () => jsonRes(503, { error: { message: "UNAVAILABLE" } }) });
  assert.deepEqual(await flaky.boardSession(), { ok: false, reason: "server" });
  const bad4xx = makeIdentity(rig, { storage: makeMemoryStorage(), fetchFn: async () => jsonRes(400, { error: { message: "INVALID_IDP_RESPONSE" } }) });
  assert.deepEqual(await bad4xx.boardSession(), { ok: false, reason: "server" });
});

/* ---------------- BOARD-32: link or adopt ---------------- */

test("2.2.0 upgrade: the v1 anonymous uid is linked and kept, and the claim stamps its @handle runs with the name", async () => {
  const rig = makeBoardRig({
    fakeOpts: {
      runs: [seedFor({ hash: "00000001" }), seedFor({ hash: "00000002", floor: 7 }), seedFor({ uid: "someoneelse", hash: "00000003" })],
    },
    play: { playerId: "p-ann", displayName: "Ann" },
  });
  const anonUid = await seedV1Anonymous(rig);
  assert.equal(anonUid, "fakeuid000001");
  assert.equal(rig.storage.map.has(IDENTITY_KEY), false);

  const res = await rig.identity.boardSession();
  assert.equal(res.ok, true);
  assert.equal(res.uid, anonUid, "the uid is kept");
  assert.equal(res.name, "Ann");
  assert.equal(rig.storage.map.has(LEGACY_IDENTITY_KEY), false, "the v1 key is gone");
  assert.equal(typeof idpCalls(rig).at(-1).body.idToken, "string", "the anonymous idToken rode with the link");

  const mine = rig.fake.docs().filter((d) => d.uid === anonUid);
  assert.equal(mine.length, 2);
  assert.ok(mine.every((d) => d.handle === "Ann"));
  assert.equal(rig.fake.docs().find((d) => d.uid === "someoneelse").handle, "@gloomjaw", "another player's run is untouched");
  assert.equal(rig.fake.providers(anonUid).length, 1);
  assert.equal(storedRecord(rig.storage).adoptFrom, null);
});

test("link answering a different uid (G3 fallback): the anonymous runs move to the linked uid and the anonymous account is deleted", async () => {
  const rig = makeBoardRig({
    fakeOpts: { linkKeepsUid: false, runs: [seedFor({ hash: "0000000a" }), seedFor({ hash: "0000000b", floor: 9 })] },
    play: { playerId: "p-ann", displayName: "Ann" },
  });
  const anonUid = await seedV1Anonymous(rig);

  const res = await rig.identity.boardSession();
  assert.equal(res.ok, true);
  assert.notEqual(res.uid, anonUid);
  assert.equal(res.name, "Ann");

  const docs = rig.fake.docs();
  assert.equal(docs.filter((d) => d.uid === anonUid).length, 0);
  const moved = docs.filter((d) => d.uid === res.uid);
  assert.equal(moved.length, 2);
  assert.ok(moved.every((d) => d.handle === "Ann"));
  assert.ok(!rig.fake.users().includes(anonUid), "the anonymous account is deleted");
  assert.equal(storedRecord(rig.storage).adoptFrom, null);
  assert.equal(typeof claimCalls(rig).at(-1).body.adoptIdToken, "string");
});

test("link answering ALREADY_LINKED: signs in again as the linked uid, adopts the anonymous runs, deletes the anonymous account", async () => {
  // The first device: the player's Play Games account gets uid L (fakeuid000001).
  const rig = makeBoardRig({ play: { playerId: "p-ann", displayName: "Ann" }, fakeOpts: { runs: [seedFor({ uid: "fakeuid000002", hash: "0000000c" }), seedFor({ uid: "fakeuid000002", hash: "0000000d", floor: 3 })] } });
  const first = await rig.identity.boardSession();
  assert.equal(first.uid, "fakeuid000001");

  // The same player on a 2.2.0 install: an anonymous account A (fakeuid000002) with runs.
  const store2 = makeMemoryStorage();
  const second = makeIdentity(rig, { storage: store2 });
  const anon = await second.getToken({ explicit: true });
  assert.equal(anon.uid, "fakeuid000002");
  const before = idpCalls(rig).length;

  const res = await second.boardSession();
  assert.equal(res.ok, true);
  assert.equal(res.uid, "fakeuid000001");
  assert.equal(res.name, "Ann");
  const idp = idpCalls(rig).slice(before);
  assert.equal(idp.length, 2);
  assert.equal(typeof idp[0].body.idToken, "string");
  assert.equal(idp[1].body.idToken, undefined, "the second sign-in carries no idToken");

  const docs = rig.fake.docs();
  assert.equal(docs.filter((d) => d.uid === "fakeuid000002").length, 0);
  assert.equal(docs.filter((d) => d.uid === "fakeuid000001").length, 2);
  assert.ok(docs.every((d) => d.handle === "Ann"));
  assert.ok(!rig.fake.users().includes("fakeuid000002"));
  assert.equal(JSON.parse(store2.map.get(IDENTITY_KEY)).adoptFrom, null);
});

test("an interrupted adopt (the claim fails offline) keeps adoptFrom and finishes on the next session", async () => {
  const rig = makeBoardRig({
    fakeOpts: { linkKeepsUid: false, runs: [seedFor({ hash: "0000000e" })] },
    play: { playerId: "p-ann", displayName: "Ann" },
  });
  const anonUid = await seedV1Anonymous(rig);
  let fail = true;
  const identity = makeIdentity(rig, {
    fetchFn: (u, init) => (fail && u.includes("/boardName") ? Promise.reject(new TypeError("down")) : rig.fetchFn(u, init)),
  });

  const first = await identity.boardSession();
  assert.deepEqual(first, { ok: false, reason: "offline" });
  const pending = storedRecord(rig.storage);
  assert.equal(pending.linked, true);
  assert.equal(pending.name, null);
  assert.equal(pending.adoptFrom.uid, anonUid);
  assert.ok(rig.fake.users().includes(anonUid), "the anonymous account is kept until the runs have moved");

  fail = false;
  const second = await identity.boardSession();
  assert.equal(second.ok, true);
  assert.equal(rig.fake.docs().filter((d) => d.uid === anonUid).length, 0);
  assert.equal(rig.fake.docs().filter((d) => d.uid === second.uid).length, 1);
  assert.ok(!rig.fake.users().includes(anonUid));
  assert.equal(storedRecord(rig.storage).adoptFrom, null);
});

/* ---------------- G2: rename ---------------- */

test("rename: the same player under a new Play Games name re-signs-in, re-claims and returns the new name", async () => {
  const rig = makeBoardRig({ play: { playerId: "p-ann", displayName: "Ann" } });
  const first = await rig.identity.boardSession();
  assert.equal(first.name, "Ann");

  rig.play.setPlayer("p-ann", "Ann Renamed");
  const res = await rig.identity.boardSession();
  assert.equal(res.ok, true);
  assert.equal(res.name, "Ann Renamed");
  assert.equal(res.uid, first.uid);
  assert.deepEqual(rig.fake.names().map((n) => ({ ...n })), [{ uid: first.uid, name: "Ann Renamed" }]);
  assert.equal(callsTo(rig, "accounts:update").length, 0, "no unlink was needed");
  assert.equal(storedRecord(rig.storage).name, "Ann Renamed");
});

test("rename: when the provider keeps the old name the client unlinks and relinks once, then returns the new name", async () => {
  const rig = makeBoardRig({ fakeOpts: { refreshProviderName: false }, play: { playerId: "p-ann", displayName: "Ann" } });
  const first = await rig.identity.boardSession();
  rig.play.setPlayer("p-ann", "Ann Renamed");

  const res = await rig.identity.boardSession();
  assert.equal(res.ok, true);
  assert.equal(res.name, "Ann Renamed");
  assert.equal(res.uid, first.uid, "the uid survived the relink");
  const updates = callsTo(rig, "accounts:update");
  assert.equal(updates.length, 1);
  assert.deepEqual(updates[0].body.deleteProvider, ["playgames.google.com"]);
  assert.equal(rig.fake.providers(first.uid).length, 1);
  assert.equal(storedRecord(rig.storage).linked, true);
});

test("rename: a failed relink never fails the session and is not repeated in the same launch", async () => {
  const rig = makeBoardRig({ fakeOpts: { refreshProviderName: false }, play: { playerId: "p-ann", displayName: "Ann" } });
  let updateAttempts = 0;
  const identity = makeIdentity(rig, {
    fetchFn: (u, init) => {
      if (!u.includes("accounts:update")) return rig.fetchFn(u, init);
      updateAttempts += 1;
      return Promise.resolve(jsonRes(500, { error: { message: "INTERNAL" } }));
    },
  });
  assert.equal((await identity.boardSession()).name, "Ann");
  rig.play.setPlayer("p-ann", "Ann Renamed");

  const second = await identity.boardSession();
  assert.equal(second.ok, true);
  assert.equal(second.name, "Ann", "the session returns the name the server holds");
  const attempts = updateAttempts;
  const idpAfterFirstTry = idpCalls(rig).length;
  assert.equal(attempts, 1);

  const third = await identity.boardSession();
  assert.equal(third.ok, true);
  assert.equal(updateAttempts, attempts, "no second relink in this launch");
  assert.equal(idpCalls(rig).length, idpAfterFirstTry, "and no second re-sign-in either");

  // A new launch tries again.
  const relaunch = makeIdentity(rig, {});
  assert.equal((await relaunch.boardSession()).name, "Ann Renamed");
});

test("rename: an admin-overridden name is never chased", async () => {
  const rig = makeBoardRig({ play: { playerId: "p-ann", displayName: "Ann" } });
  // The uid is fakeuid000001: override it before the first claim.
  rig.fake.setOverride("fakeuid000001", "The Crowned One");
  const first = await rig.identity.boardSession();
  assert.equal(first.name, "The Crowned One");
  assert.equal(storedRecord(rig.storage).overridden, true);
  const sentBefore = rig.sent.length;

  const again = await rig.identity.boardSession();
  assert.equal(again.name, "The Crowned One");
  rig.play.setPlayer("p-ann", "Ann Renamed");
  assert.equal((await rig.identity.boardSession()).name, "The Crowned One");
  assert.equal(rig.sent.length, sentBefore, "no sign-in, claim or unlink for an override");
});

/* ---------------- account switch ---------------- */

test("account switch: the old session is dropped locally (no adopt) and the new player gets their own uid and name", async () => {
  const rig = makeBoardRig({
    play: { playerId: "p-ann", displayName: "Ann" },
    fakeOpts: { runs: [seedFor({ uid: "fakeuid000001", handle: "Ann", hash: "00000011" })] },
  });
  const ann = await rig.identity.boardSession();
  assert.equal(ann.uid, "fakeuid000001");

  rig.play.setPlayer("p-bob", "Bob");
  const bob = await rig.identity.boardSession();
  assert.equal(bob.ok, true);
  assert.notEqual(bob.uid, ann.uid);
  assert.equal(bob.name, "Bob");
  const rec = storedRecord(rig.storage);
  assert.equal(rec.playerId, "p-bob");
  assert.equal(rec.adoptFrom, null);

  const docs = rig.fake.docs();
  assert.equal(docs.filter((d) => d.uid === ann.uid).length, 1, "the old player's run is untouched");
  assert.equal(docs.find((d) => d.uid === ann.uid).handle, "Ann");
  assert.equal(docs.filter((d) => d.uid === bob.uid).length, 0);
  assert.equal(claimCalls(rig).at(-1).body.adoptIdToken, undefined, "never adopts the other player's runs");
  assert.ok(rig.fake.users().includes(ann.uid), "the old account is left alone");

  // And back again: the first player's uid and name return.
  rig.play.setPlayer("p-ann", "Ann");
  const back = await rig.identity.boardSession();
  assert.equal(back.uid, ann.uid);
  assert.equal(back.name, "Ann");
});

test("account switch: an unlinked anonymous record is linked to whoever signs in first (no playerId to mismatch)", async () => {
  const rig = makeBoardRig({ play: { playerId: "p-cat", displayName: "Cat" } });
  const anon = await rig.identity.getToken({ explicit: true });
  const res = await rig.identity.boardSession();
  assert.equal(res.ok, true);
  assert.equal(res.uid, anon.uid);
});

/* ---------------- G1/A4 fallback and claim error handling ---------------- */

test("NEEDS_GAMES_CODE: the claim is retried once with a fresh server auth code", async () => {
  const rig = makeBoardRig({ fakeOpts: { nameSource: "games" }, play: { playerId: "p-ann", displayName: "Ann" } });
  const res = await rig.identity.boardSession();
  assert.equal(res.ok, true);
  assert.equal(res.name, "Ann");
  const claims = claimCalls(rig);
  assert.equal(claims.length, 2);
  assert.equal(claims[0].body.gamesAuthCode, undefined);
  assert.equal(typeof claims[1].body.gamesAuthCode, "string");
  assert.equal(rig.play.calls().filter((c) => c.method === "serverAuthCode").length, 2, "one code for the link, one for the claim");
});

test("NEEDS_GAMES_CODE: a code the function still rejects is not retried again", async () => {
  const rig = makeBoardRig();
  let claims = 0;
  const nameClient = { claim: async () => { claims += 1; return { ok: false, reason: "needsCode" }; }, release: async () => ({ ok: true }) };
  const res = await makeIdentity(rig, { nameClient }).boardSession();
  assert.deepEqual(res, { ok: false, reason: "server" });
  assert.equal(claims, 2);
});

test("a claim answering auth forces one token refresh and retries once", async () => {
  const rig = makeBoardRig();
  const real = createNameClient({ fetchFn: rig.fetchFn });
  let calls = 0;
  const nameClient = { claim: async (a) => (calls++ === 0 ? { ok: false, reason: "auth" } : real.claim(a)), release: real.release };
  const res = await makeIdentity(rig, { nameClient }).boardSession();
  assert.equal(res.ok, true);
  assert.equal(calls, 2);
  assert.equal(callsTo(rig, "securetoken").length, 1);

  const rig2 = makeBoardRig();
  let always = 0;
  const stuck = { claim: async () => { always += 1; return { ok: false, reason: "auth" }; }, release: async () => ({ ok: true }) };
  assert.deepEqual(await makeIdentity(rig2, { nameClient: stuck }).boardSession(), { ok: false, reason: "server" });
  assert.equal(always, 2, "one refresh and one retry, never a loop");
});

test("a claim refused NOT_LINKED marks the record unlinked and returns server; the next session relinks", async () => {
  const rig = makeBoardRig();
  const real = createNameClient({ fetchFn: rig.fetchFn });
  let calls = 0;
  const nameClient = { claim: async (a) => (calls++ === 0 ? { ok: false, reason: "refused", code: "NOT_LINKED" } : real.claim(a)), release: real.release };
  const identity = makeIdentity(rig, { nameClient });

  assert.deepEqual(await identity.boardSession(), { ok: false, reason: "server" });
  assert.equal(storedRecord(rig.storage).linked, false);

  const res = await identity.boardSession();
  assert.equal(res.ok, true);
  assert.equal(storedRecord(rig.storage).linked, true);
  assert.equal(idpCalls(rig).length, 2);
});

test("a claim refused for another reason resolves refused and keeps the link", async () => {
  const rig = makeBoardRig();
  const nameClient = { claim: async () => ({ ok: false, reason: "refused", code: "NO_NAME" }), release: async () => ({ ok: true }) };
  const identity = makeIdentity(rig, { nameClient });
  assert.deepEqual(await identity.boardSession(), { ok: false, reason: "refused" });
  assert.equal(storedRecord(rig.storage).linked, true);
});

/* ---------------- refreshName ---------------- */

test("refreshName: returns the current name after an override on the server", async () => {
  const rig = makeBoardRig({ play: { playerId: "p-ann", displayName: "Ann" } });
  const session = await rig.identity.boardSession();
  rig.fake.setOverride(session.uid, "The Crowned One");

  assert.deepEqual(await rig.identity.refreshName(), { ok: true, name: "The Crowned One" });
  assert.equal((await rig.identity.snapshot()).name, "The Crowned One");
  assert.equal(storedRecord(rig.storage).overridden, true);
});

test("refreshName: without a linked session answers signin and makes no call", async () => {
  const rig = makeBoardRig();
  assert.deepEqual(await rig.identity.refreshName(), { ok: false, reason: "signin" });
  assert.equal(rig.sent.length, 0);
});

/* ---------------- deleteAccount (the session) ---------------- */

test("deleteAccount: releases the name through the function, deletes the account and drops the record", async () => {
  const rig = makeBoardRig();
  const session = await rig.identity.boardSession();
  assert.equal(rig.fake.names().length, 1);

  const res = await rig.identity.deleteAccount();
  assert.deepEqual(res, { ok: true, deleted: true });
  assert.equal(rig.fake.names().length, 0, "the name record is released");
  assert.ok(!rig.fake.users().includes(session.uid));
  assert.equal(rig.storage.map.has(IDENTITY_KEY), false);
  assert.deepEqual({ ...(await rig.identity.snapshot()) }, { uid: null, name: null, linked: false, playerId: null });
});

test("deleteAccount: a failed release never keeps the account", async () => {
  const rig = makeBoardRig();
  await rig.identity.boardSession();
  const nameClient = { claim: async () => ({ ok: false, reason: "server" }), release: async () => { throw new Error("boom"); } };
  const res = await makeIdentity(rig, { nameClient }).deleteAccount();
  assert.deepEqual(res, { ok: true, deleted: true });
});

/* ---------------- no token leaks ---------------- */

test("no failure result or stored-record field leaks a token, and the sources never log", async () => {
  const rig = makeBoardRig({ play: { playerId: "p-ann", displayName: "Ann" } });
  const results = [];
  results.push(await rig.identity.boardSession());
  rig.fake.setOnline(false);
  const identity = makeIdentity(rig, { storage: makeMemoryStorage() });
  results.push(await identity.boardSession());
  results.push(await identity.refreshName());
  results.push(await identity.getToken());
  const failures = results.filter((r) => r.ok === false);
  assert.ok(failures.length >= 2);
  for (const f of failures) assert.doesNotMatch(JSON.stringify(f), /idtok|rtok|gtok|fake:/);
  assert.doesNotMatch(JSON.stringify(await rig.identity.snapshot()), /idtok|rtok/);
  assert.doesNotMatch(stripJs(FIREBASE_AUTH_SRC), /\bconsole\b/);
});

test("each server auth code is used once: every sign-in and claim code is distinct", async () => {
  const rig = makeBoardRig({ fakeOpts: { nameSource: "games", refreshProviderName: false }, play: { playerId: "p-ann", displayName: "Ann" } });
  await rig.identity.boardSession();
  rig.play.setPlayer("p-ann", "Ann Renamed");
  await rig.identity.boardSession();
  const codes = [];
  for (const c of rig.sent) {
    if (c.body && typeof c.body.postBody === "string") codes.push(new URLSearchParams(c.body.postBody).get("code"));
    if (c.body && typeof c.body.gamesAuthCode === "string") codes.push(c.body.gamesAuthCode);
  }
  assert.ok(codes.length >= 4);
  assert.equal(new Set(codes).size, codes.length, "no code was ever sent twice");
});
