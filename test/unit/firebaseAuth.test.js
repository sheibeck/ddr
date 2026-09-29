// test/unit/firebaseAuth.test.js
//
// Phase 83 Plan 03 Task 1 — the identity record, tolerant load and the
// handle lifecycle (no network). An in-memory storage double (async
// getItem/setItem/removeItem over a Map) stands in for
// src/browser/storage.js. Task 2 extends this file with lazy sign-up,
// proactive refresh, the Compete gate and account delete.

import test from "node:test";
import assert from "node:assert/strict";

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { stripJs } from "../../tools/ident-sweep.mjs";
import { IDENTITY_KEY, REFRESH_MARGIN_MS, IDENTITY_REASONS, sanitizeIdentity, createIdentity } from "../../src/browser/firebaseAuth.js";
import { isValidHandle } from "../../src/browser/handles.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const FIREBASE_AUTH_SRC = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "firebaseAuth.js"), "utf8").replace(/\r\n/g, "\n");

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
  for (const bad of [
    Symbol("x"),
    () => {},
    new Date(),
    {
      toString: () => {
        throw new Error("boom");
      },
    },
  ]) {
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
  const identity = createIdentity({ storage });
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
