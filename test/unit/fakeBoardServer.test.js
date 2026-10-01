// test/unit/fakeBoardServer.test.js
//
// Phase 83 Plan 04 Task 1. Covers createFakeBoardFetch: auth, the API-key
// check, offline, run create/exists (all three existsResponse modes),
// handle update (including the multi-run re-roll commit), delete, atomic
// commits, query filters/order/limit/cursor, count, admin bypass, the
// report + limit commit (first report, cooldown, forged count, sixth
// report, other uid, missing limit write, no auth), reportLimits owner get
// and refused list/delete, admin limit seeding, and the inspectors.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { stripJs } from "../../tools/ident-sweep.mjs";
import { rollHandle } from "../../src/browser/handles.js";
import { SEASON } from "../../content/season.js";
import {
  IDENTITY_BASE,
  SECURETOKEN_BASE,
  firestoreUrl,
  docName,
} from "../../src/browser/firestoreRest.js";
import {
  RUN_COLLECTION,
  RUN_CLIENT_FIELDS,
  WHEN_SKEW_MS,
  rankKeys,
  deepKeyOf,
  legacyDeepKeyOf,
  runDocId,
  createRunCommit,
  handleUpdateCommit,
  deleteCommit,
  topTenQuery,
  countQuery,
  ownRunsQuery,
} from "../../src/browser/runDoc.js";
import {
  REPORT_LIMITS_COLLECTION,
  buildReportCommit,
  nextLimitState,
} from "../../src/browser/reportLimits.js";
import { FAKE_ADMIN_TOKEN, createFakeBoardFetch } from "../../src/browser/fakeBoardServer.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const FAKE_SERVER_SRC = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "fakeBoardServer.js"), "utf8").replace(/\r\n/g, "\n");

const VALID_CONFIG = Object.freeze({ projectId: "delve-die-repeat-6ba5f", apiKey: `AIza${"A".repeat(35)}` });

/* ---------------- helpers ---------------- */

function validHandle(seed = 0.15) {
  return rollHandle(() => seed, null);
}

function baseValidPartial(overrides = {}) {
  return {
    uid: "u1",
    handle: validHandle(),
    season: SEASON,
    name: "Test Hero",
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
    note: "cut down by a Rat",
    epitaph: "",
    when: 0,
    hash: "0a1b2c3d",
    version: "2.2.0 (12)",
    seed: 12345,
    acts: 10,
    ...overrides,
  };
}

function docFrom(overrides = {}) {
  const merged = baseValidPartial(overrides);
  const keys = rankKeys(merged);
  const doc = {};
  for (const f of RUN_CLIENT_FIELDS) doc[f] = f in keys ? keys[f] : merged[f];
  return doc;
}

function seed(overrides = {}) {
  const doc = docFrom(overrides);
  return { id: runDocId(doc.uid, doc.hash), doc };
}

function jsonInit(method, bodyObj, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const init = { method, headers };
  if (bodyObj !== undefined) init.body = JSON.stringify(bodyObj);
  return init;
}

function authInit(method, token) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return { method, headers };
}

async function postQuery(server, body) {
  const res = await server.fetchFn(firestoreUrl(VALID_CONFIG, ":runQuery"), jsonInit("POST", body));
  return res.json();
}

async function postAggregation(server, body) {
  const res = await server.fetchFn(firestoreUrl(VALID_CONFIG, ":runAggregationQuery"), jsonInit("POST", body));
  return res.json();
}

async function postCommit(server, body, token) {
  const res = await server.fetchFn(firestoreUrl(VALID_CONFIG, ":commit"), jsonInit("POST", body, token));
  return { status: res.status, ok: res.ok, json: await res.json() };
}

async function signUp(server) {
  const res = await server.fetchFn(`${IDENTITY_BASE}/accounts:signUp?key=${encodeURIComponent(VALID_CONFIG.apiKey)}`, jsonInit("POST", { returnSecureToken: true }));
  return { status: res.status, ok: res.ok, json: await res.json() };
}

async function refresh(server, refreshToken) {
  const body = `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`;
  const res = await server.fetchFn(`${SECURETOKEN_BASE}/token?key=${encodeURIComponent(VALID_CONFIG.apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  return { status: res.status, ok: res.ok, json: await res.json() };
}

async function deleteAccount(server, idToken) {
  const res = await server.fetchFn(`${IDENTITY_BASE}/accounts:delete?key=${encodeURIComponent(VALID_CONFIG.apiKey)}`, jsonInit("POST", { idToken }));
  return { status: res.status, ok: res.ok, json: await res.json() };
}

async function newUser(server) {
  const su = await signUp(server);
  return { uid: su.json.localId, idToken: su.json.idToken, refreshToken: su.json.refreshToken };
}

function seedDocs(n, uid) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const hash = i.toString(16).padStart(8, "0");
    out.push(seed({ uid, hash, floor: 1 + (i % 50), steps: i }));
  }
  return out;
}

/* ================================================================
   constants
   ================================================================ */

test("constants: FAKE_ADMIN_TOKEN, createFakeBoardFetch exported", () => {
  assert.equal(FAKE_ADMIN_TOKEN, "fake-admin-token");
  assert.equal(typeof createFakeBoardFetch, "function");
});

/* ================================================================
   key check, offline, unknown route
   ================================================================ */

test("key check: no key and no admin bearer -> 400 INVALID_ARGUMENT; admin bearer bypasses", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true });
  const res = await server.fetchFn(firestoreUrl({ ...VALID_CONFIG, apiKey: "wrong-key" }, "/runs/abc"), { method: "GET" });
  assert.equal(res.status, 400);
  const json = await res.json();
  assert.equal(json.error.status, "INVALID_ARGUMENT");

  const adminRes = await server.fetchFn(
    `https://firestore.googleapis.com/v1/${"projects/" + VALID_CONFIG.projectId + "/databases/(default)/documents"}/runs/nope`,
    authInit("GET", FAKE_ADMIN_TOKEN),
  );
  assert.equal(adminRes.status, 404); // no key needed, reaches the route (doc not found)
});

test("offline: setOnline(false) makes fetchFn reject with a TypeError", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true });
  server.setOnline(false);
  await assert.rejects(() => server.fetchFn(firestoreUrl(VALID_CONFIG, ":runQuery"), jsonInit("POST", {})), TypeError);
  server.setOnline(true);
  const res = await server.fetchFn(firestoreUrl(VALID_CONFIG, ":runQuery"), jsonInit("POST", { structuredQuery: { from: [{ collectionId: "runs" }], limit: 10 } }));
  assert.equal(res.status, 200);
});

test("unknown route returns 404", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true });
  const res = await server.fetchFn(`https://example.com/nope?key=${encodeURIComponent(VALID_CONFIG.apiKey)}`, { method: "GET" });
  assert.equal(res.status, 404);
});

/* ================================================================
   identity: signUp, delete, refresh
   ================================================================ */

test("accounts:signUp: 200 with fresh uid, tokens, expiresIn '3600'", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true });
  const a = await signUp(server);
  assert.equal(a.status, 200);
  assert.equal(typeof a.json.idToken, "string");
  assert.equal(typeof a.json.refreshToken, "string");
  assert.equal(a.json.expiresIn, "3600");
  assert.equal(typeof a.json.localId, "string");
  const b = await signUp(server);
  assert.notEqual(a.json.localId, b.json.localId);
});

test("accounts:signUp: anonymousEnabled false -> 400 OPERATION_NOT_ALLOWED", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true, anonymousEnabled: false });
  const a = await signUp(server);
  assert.equal(a.status, 400);
  assert.equal(a.json.error.message, "OPERATION_NOT_ALLOWED");
});

test("securetoken:token: known refresh token -> 200 snake_case tokens; unknown -> 400 INVALID_REFRESH_TOKEN", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true });
  const u = await newUser(server);
  const r = await refresh(server, u.refreshToken);
  assert.equal(r.status, 200);
  assert.equal(r.json.user_id, u.uid);
  assert.equal(typeof r.json.id_token, "string");
  assert.equal(r.json.expires_in, "3600");

  const bad = await refresh(server, "not-a-real-token");
  assert.equal(bad.status, 400);
  assert.equal(bad.json.error.message, "INVALID_REFRESH_TOKEN");
});

test("accounts:delete: a valid idToken removes the user and its tokens", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true });
  const u = await newUser(server);
  assert.ok(server.users().includes(u.uid));
  const del = await deleteAccount(server, u.idToken);
  assert.equal(del.status, 200);
  assert.ok(!server.users().includes(u.uid));
  const r = await refresh(server, u.refreshToken);
  assert.equal(r.status, 400);
});

/* ================================================================
   commit: run create
   ================================================================ */

test("commit run create: valid token + valid doc + matching id -> 200, stored", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true, now: () => 1000000 });
  const u = await newUser(server);
  const doc = docFrom({ uid: u.uid });
  const id = runDocId(u.uid, doc.hash);
  const res = await postCommit(server, createRunCommit(VALID_CONFIG, id, doc), u.idToken);
  assert.equal(res.status, 200);
  const stored = server.docs().find((d) => d.id === id);
  assert.ok(stored);
  assert.equal(stored.uid, u.uid);
  assert.equal(stored.createdAt, new Date(1000000).toISOString());
});

test("commit run create: no Authorization header -> 403 PERMISSION_DENIED", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true });
  const doc = docFrom();
  const id = runDocId(doc.uid, doc.hash);
  const res = await postCommit(server, createRunCommit(VALID_CONFIG, id, doc));
  assert.equal(res.status, 403);
  assert.equal(res.json.error.status, "PERMISSION_DENIED");
});

test("commit run create: expired token -> 401 UNAUTHENTICATED", async () => {
  let nowMs = 0;
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true, now: () => nowMs, tokenTtlMs: 1000 });
  const u = await newUser(server);
  nowMs = 5000; // well past tokenTtlMs
  const doc = docFrom({ uid: u.uid });
  const id = runDocId(u.uid, doc.hash);
  const res = await postCommit(server, createRunCommit(VALID_CONFIG, id, doc), u.idToken);
  assert.equal(res.status, 401);
  assert.equal(res.json.error.status, "UNAUTHENTICATED");
});

test("commit run create: doc uid not the caller -> 403", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true });
  const u = await newUser(server);
  const doc = docFrom({ uid: "someone-else" });
  const id = runDocId("someone-else", doc.hash);
  const res = await postCommit(server, createRunCommit(VALID_CONFIG, id, doc), u.idToken);
  assert.equal(res.status, 403);
});

test("commit run create: mismatched id -> 403", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true });
  const u = await newUser(server);
  const doc = docFrom({ uid: u.uid });
  const res = await postCommit(server, createRunCommit(VALID_CONFIG, "wrong_id", doc), u.idToken);
  assert.equal(res.status, 403);
});

test("commit run create: banned uid -> 403", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true });
  const u = await newUser(server);
  server.ban(u.uid);
  const doc = docFrom({ uid: u.uid });
  const id = runDocId(u.uid, doc.hash);
  const res = await postCommit(server, createRunCommit(VALID_CONFIG, id, doc), u.idToken);
  assert.equal(res.status, 403);
});

test("commit run create: invalid doc (fails validateRunDoc) -> 403", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true });
  const u = await newUser(server);
  const doc = docFrom({ uid: u.uid, floor: 99999 }); // out of bounds
  const id = runDocId(u.uid, doc.hash);
  const res = await postCommit(server, createRunCommit(VALID_CONFIG, id, doc), u.idToken);
  assert.equal(res.status, 403);
});

test("commit run create: existing id -> 400 FAILED_PRECONDITION (default), 403 (denied), 409 (conflict)", async () => {
  for (const [mode, expectStatus, expectText] of [
    ["precondition", 400, "FAILED_PRECONDITION"],
    ["denied", 403, "PERMISSION_DENIED"],
    ["conflict", 409, "ALREADY_EXISTS"],
  ]) {
    const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true, existsResponse: mode });
    const u = await newUser(server);
    const doc = docFrom({ uid: u.uid });
    const id = runDocId(u.uid, doc.hash);
    const first = await postCommit(server, createRunCommit(VALID_CONFIG, id, doc), u.idToken);
    assert.equal(first.status, 200);
    const second = await postCommit(server, createRunCommit(VALID_CONFIG, id, doc), u.idToken);
    assert.equal(second.status, expectStatus, mode);
    assert.equal(second.json.error.status, expectText, mode);
  }
});

test("commit run create: admin bypasses ownership/banned checks (still validates shape)", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true });
  const doc = docFrom({ uid: "any-uid" });
  const id = runDocId("any-uid", doc.hash);
  const res = await postCommit(server, createRunCommit(VALID_CONFIG, id, doc), FAKE_ADMIN_TOKEN);
  assert.equal(res.status, 200);
});

test("commit run create: when bound uses the fake's own clock — one ms past now()+WHEN_SKEW_MS is denied, exactly at the bound is accepted", async () => {
  const NOW_MS = 1000000;
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true, now: () => NOW_MS });
  const u = await newUser(server);

  const atBound = docFrom({ uid: u.uid, when: NOW_MS + WHEN_SKEW_MS, hash: "0a1b2c3d" });
  const idAt = runDocId(u.uid, atBound.hash);
  const resAt = await postCommit(server, createRunCommit(VALID_CONFIG, idAt, atBound), u.idToken);
  assert.equal(resAt.status, 200);

  const overBound = docFrom({ uid: u.uid, when: NOW_MS + WHEN_SKEW_MS + 1, hash: "0a1b2c3e" });
  const idOver = runDocId(u.uid, overBound.hash);
  const resOver = await postCommit(server, createRunCommit(VALID_CONFIG, idOver, overBound), u.idToken);
  assert.equal(resOver.status, 403);
});

test("commit run create: a doc that omits note -> 403", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true });
  const u = await newUser(server);
  const doc = docFrom({ uid: u.uid });
  const { note, ...withoutNote } = doc;
  const id = runDocId(u.uid, doc.hash);
  const res = await postCommit(server, createRunCommit(VALID_CONFIG, id, withoutNote), u.idToken);
  assert.equal(res.status, 403);
});

/* ================================================================
   commit: handle update (single + multi-id re-roll)
   ================================================================ */

test("commit handle update: owner + valid handle -> 200, doc updated", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true });
  const u = await newUser(server);
  const doc = docFrom({ uid: u.uid });
  const id = runDocId(u.uid, doc.hash);
  await postCommit(server, createRunCommit(VALID_CONFIG, id, doc), u.idToken);
  const newHandle = validHandle(0.85);
  const res = await postCommit(server, handleUpdateCommit(VALID_CONFIG, id, newHandle), u.idToken);
  assert.equal(res.status, 200);
  assert.equal(server.docs().find((d) => d.id === id).handle, newHandle);
});

test("commit handle update: another user's doc -> 403; invalid handle -> 403", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true });
  const owner = await newUser(server);
  const other = await newUser(server);
  const doc = docFrom({ uid: owner.uid });
  const id = runDocId(owner.uid, doc.hash);
  await postCommit(server, createRunCommit(VALID_CONFIG, id, doc), owner.idToken);

  const otherRes = await postCommit(server, handleUpdateCommit(VALID_CONFIG, id, validHandle(0.85)), other.idToken);
  assert.equal(otherRes.status, 403);

  const badHandleRes = await postCommit(server, handleUpdateCommit(VALID_CONFIG, id, "@not-a-valid-handle"), owner.idToken);
  assert.equal(badHandleRes.status, 403);
});

test("commit handle update: any other mask -> 403", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true });
  const u = await newUser(server);
  const doc = docFrom({ uid: u.uid });
  const id = runDocId(u.uid, doc.hash);
  await postCommit(server, createRunCommit(VALID_CONFIG, id, doc), u.idToken);
  const body = {
    writes: [
      {
        update: { name: docName(VALID_CONFIG, RUN_COLLECTION, id), fields: { gold: { integerValue: "999999" } } },
        updateMask: { fieldPaths: ["gold"] },
        currentDocument: { exists: true },
      },
    ],
  };
  const res = await postCommit(server, body, u.idToken);
  assert.equal(res.status, 403);
});

test("commit handle update: N-run re-roll is atomic (all-or-nothing)", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true });
  const u = await newUser(server);
  const doc1 = docFrom({ uid: u.uid, hash: "00000001" });
  const doc2 = docFrom({ uid: u.uid, hash: "00000002" });
  const id1 = runDocId(u.uid, doc1.hash);
  const id2 = runDocId(u.uid, doc2.hash);
  await postCommit(server, createRunCommit(VALID_CONFIG, id1, doc1), u.idToken);
  await postCommit(server, createRunCommit(VALID_CONFIG, id2, doc2), u.idToken);

  const newHandle = validHandle(0.9);
  const ok = await postCommit(server, handleUpdateCommit(VALID_CONFIG, [id1, id2], newHandle), u.idToken);
  assert.equal(ok.status, 200);
  assert.equal(server.docs().find((d) => d.id === id1).handle, newHandle);
  assert.equal(server.docs().find((d) => d.id === id2).handle, newHandle);

  // one failing write (a nonexistent third id) rolls back the whole batch
  const before1 = server.docs().find((d) => d.id === id1).handle;
  const anotherHandle = validHandle(0.4);
  const bad = await postCommit(server, handleUpdateCommit(VALID_CONFIG, [id1, "nope_00000000"], anotherHandle), u.idToken);
  assert.equal(bad.status, 403);
  assert.equal(server.docs().find((d) => d.id === id1).handle, before1);
});

/* ================================================================
   commit: delete
   ================================================================ */

test("commit delete: succeeds only for the owner", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true });
  const owner = await newUser(server);
  const other = await newUser(server);
  const doc = docFrom({ uid: owner.uid });
  const id = runDocId(owner.uid, doc.hash);
  await postCommit(server, createRunCommit(VALID_CONFIG, id, doc), owner.idToken);

  const otherRes = await postCommit(server, deleteCommit(VALID_CONFIG, id), other.idToken);
  assert.equal(otherRes.status, 403);
  assert.ok(server.docs().some((d) => d.id === id));

  const ownRes = await postCommit(server, deleteCommit(VALID_CONFIG, id), owner.idToken);
  assert.equal(ownRes.status, 200);
  assert.ok(!server.docs().some((d) => d.id === id));
});

test("commit delete: multi-id batch is atomic", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true });
  const owner = await newUser(server);
  const doc1 = docFrom({ uid: owner.uid, hash: "00000011" });
  const doc2 = docFrom({ uid: owner.uid, hash: "00000012" });
  const id1 = runDocId(owner.uid, doc1.hash);
  const id2 = runDocId(owner.uid, doc2.hash);
  await postCommit(server, createRunCommit(VALID_CONFIG, id1, doc1), owner.idToken);
  await postCommit(server, createRunCommit(VALID_CONFIG, id2, doc2), owner.idToken);

  const bad = await postCommit(server, deleteCommit(VALID_CONFIG, [id1, "not_owned_id"]), owner.idToken);
  assert.equal(bad.status, 403);
  assert.ok(server.docs().some((d) => d.id === id1));

  const ok = await postCommit(server, deleteCommit(VALID_CONFIG, [id1, id2]), owner.idToken);
  assert.equal(ok.status, 200);
  assert.equal(server.docs().length, 0);
});

/* ================================================================
   runQuery: filters, order, limit, cursor, admin bypass
   ================================================================ */

test("runQuery: filters/order/limit and non-admin limit gate (missing/over LIST_LIMIT_MAX -> 403)", async () => {
  const seeds = [
    seed({ uid: "q1", hash: "00000001", race: "Human", sub: "Knight", floor: 3, steps: 100 }),
    seed({ uid: "q1", hash: "00000002", race: "Elven", sub: "Wizard", cls: "Magic User", floor: 5, steps: 200 }),
    seed({ uid: "q1", hash: "00000003", race: "Human", sub: "Knight", floor: 10, steps: 50 }),
  ];
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true, runs: seeds });

  const noLimit = await server.fetchFn(firestoreUrl(VALID_CONFIG, ":runQuery"), jsonInit("POST", { structuredQuery: { from: [{ collectionId: "runs" }] } }));
  assert.equal(noLimit.status, 403);

  const overLimitRes = await server.fetchFn(firestoreUrl(VALID_CONFIG, ":runQuery"), jsonInit("POST", topTenQuery({ stat: "deep", season: SEASON, limit: 51 })));
  assert.equal(overLimitRes.status, 403);

  const hits = await postQuery(server, topTenQuery({ stat: "deep", season: SEASON }));
  assert.ok(Array.isArray(hits));
  assert.equal(hits.length, 3);
  // deep = floor desc, then more steps (Phase 87 BOARD-28): floor 10 first, floor 5, floor 3
  const floors = hits.map((h) => Number(h.document.fields.floor.integerValue));
  assert.deepEqual(floors, [10, 5, 3]);

  const raceFiltered = await postQuery(server, topTenQuery({ stat: "deep", season: SEASON, race: "Human" }));
  assert.equal(raceFiltered.length, 2);
});

test("runQuery: admin bypasses the list limit", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true, runs: [seed({ uid: "q2", hash: "00000001" })] });
  const res = await server.fetchFn(
    firestoreUrl(VALID_CONFIG, ":runQuery"),
    jsonInit("POST", { structuredQuery: { from: [{ collectionId: "runs" }] } }, FAKE_ADMIN_TOKEN),
  );
  assert.equal(res.status, 200);
});

test("runQuery: cursor pagination over 120 seeded docs for one uid", async () => {
  const uid = "cursoruid";
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true, runs: seedDocs(120, uid) });
  const page1 = await postQuery(server, ownRunsQuery({ uid, limit: 50 }));
  assert.equal(page1.length, 50);
  const page2 = await postQuery(server, ownRunsQuery({ uid, limit: 50, afterName: page1[49].document.name }));
  assert.equal(page2.length, 50);
  const page3 = await postQuery(server, ownRunsQuery({ uid, limit: 50, afterName: page2[49].document.name }));
  assert.equal(page3.length, 20);
  const allNames = [...page1, ...page2, ...page3].map((h) => h.document.name);
  assert.equal(new Set(allNames).size, 120);
});

test("runQuery: no hits resolves [{readTime}]", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true });
  const hits = await postQuery(server, topTenQuery({ stat: "deep", season: SEASON }));
  assert.deepEqual(Object.keys(hits[0]), ["readTime"]);
});

test("runAggregationQuery: count needs no limit, returns the filtered count under the alias", async () => {
  const seeds = [
    seed({ uid: "c1", hash: "00000001", race: "Human" }),
    seed({ uid: "c1", hash: "00000002", race: "Elven" }),
  ];
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true, runs: seeds });
  const result = await postAggregation(server, countQuery({ stat: "deep", season: SEASON }));
  assert.equal(result[0].result.aggregateFields.count.integerValue, "2");
  const filtered = await postAggregation(server, countQuery({ stat: "deep", season: SEASON, race: "Human" }));
  assert.equal(filtered[0].result.aggregateFields.count.integerValue, "1");
});

/* ================================================================
   GET/DELETE runs/{id}
   ================================================================ */

test("GET runs/{id}: public, 200 or 404", async () => {
  const s = seed({ uid: "g1", hash: "00000001" });
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true, runs: [s] });
  const found = await server.fetchFn(firestoreUrl(VALID_CONFIG, `/runs/${s.id}`), { method: "GET" });
  assert.equal(found.status, 200);
  const missing = await server.fetchFn(firestoreUrl(VALID_CONFIG, `/runs/nope_00000000`), { method: "GET" });
  assert.equal(missing.status, 404);
});

test("DELETE runs/{id}: admin only", async () => {
  const s = seed({ uid: "g2", hash: "00000001" });
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true, runs: [s] });
  const notAdmin = await server.fetchFn(firestoreUrl(VALID_CONFIG, `/runs/${s.id}`), authInit("DELETE"));
  assert.equal(notAdmin.status, 403);
  const admin = await server.fetchFn(firestoreUrl(VALID_CONFIG, `/runs/${s.id}`), authInit("DELETE", FAKE_ADMIN_TOKEN));
  assert.equal(admin.status, 200);
  assert.ok(!server.docs().some((d) => d.id === s.id));
});

/* ================================================================
   banned/{uid}: PATCH/DELETE admin only
   ================================================================ */

test("PATCH/DELETE banned/{uid}: admin only", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true });
  const notAdmin = await server.fetchFn(firestoreUrl(VALID_CONFIG, "/banned/u1"), authInit("PATCH"));
  assert.equal(notAdmin.status, 403);
  const admin = await server.fetchFn(firestoreUrl(VALID_CONFIG, "/banned/u1"), authInit("PATCH", FAKE_ADMIN_TOKEN));
  assert.equal(admin.status, 200);
  assert.ok(server.banned().includes("u1"));
  const del = await server.fetchFn(firestoreUrl(VALID_CONFIG, "/banned/u1"), authInit("DELETE", FAKE_ADMIN_TOKEN));
  assert.equal(del.status, 200);
  assert.ok(!server.banned().includes("u1"));
});

/* ================================================================
   bug report + limit commit (buildReportCommit)
   ================================================================ */

function validReport(overrides = {}) {
  return {
    schema: 1,
    status: "new",
    text: "Something broke",
    oracle: "",
    oracleLines: 0,
    version: "2.2.0 (12)",
    platform: "android",
    device: "Pixel 7",
    clientTime: new Date(0).toISOString(),
    ...overrides,
  };
}

test("report + limit commit: first report succeeds for a signed-in user", async () => {
  let nowMs = 1000000;
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true, now: () => nowMs });
  const u = await newUser(server);
  const step = nextLimitState(null, nowMs);
  const reportId = "report00000000000001";
  const res = await postCommit(server, buildReportCommit(VALID_CONFIG, reportId, validReport(), u.uid, step), u.idToken);
  assert.equal(res.status, 200);
  assert.equal(server.reports().length, 1);
  assert.equal(Object.prototype.hasOwnProperty.call(server.reports()[0], "uid"), false);
  assert.equal(server.limits().find((l) => l.uid === u.uid).count, 1);
});

test("report + limit commit: 403 with no Authorization header", async () => {
  let nowMs = 1000000;
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true, now: () => nowMs });
  const step = nextLimitState(null, nowMs);
  const res = await postCommit(server, buildReportCommit(VALID_CONFIG, "reportidnoauth00001a", validReport(), "someuid", step));
  assert.equal(res.status, 403);
});

test("report + limit commit: inside the cooldown -> 403; forged count -> 403; past the daily cap -> 403", async () => {
  let nowMs = 1000000;
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true, now: () => nowMs });
  const u = await newUser(server);

  const step1 = nextLimitState(null, nowMs);
  await postCommit(server, buildReportCommit(VALID_CONFIG, "reportid0000000000001", validReport(), u.uid, step1), u.idToken);

  // inside the cooldown (elapsed 1000ms << REPORT_COOLDOWN_MS)
  nowMs += 1000;
  const cooldownStep = nextLimitState({ lastMs: 1000000, dayMs: step1.dayMs, count: 1 }, nowMs);
  assert.equal(cooldownStep.ok, false);
  const cooldownRes = await postCommit(server, buildReportCommit(VALID_CONFIG, "reportid0000000000002", validReport(), u.uid, { create: false, dayMs: step1.dayMs, count: 2 }), u.idToken);
  assert.equal(cooldownRes.status, 403);

  // forged count: jump past cooldown but claim an inflated count
  nowMs += 3 * 60 * 1000;
  const forgedRes = await postCommit(server, buildReportCommit(VALID_CONFIG, "reportid0000000000003", validReport(), u.uid, { create: false, dayMs: step1.dayMs, count: 999 }), u.idToken);
  assert.equal(forgedRes.status, 403);

  // past the daily cap: drive count to 5 for real, then a 6th report same day
  let before = { lastMs: 1000000, dayMs: step1.dayMs, count: 1 };
  for (let i = 2; i <= 5; i++) {
    nowMs += 3 * 60 * 1000;
    const step = nextLimitState(before, nowMs);
    const rid = `reportid00000000000${i}`;
    const res = await postCommit(server, buildReportCommit(VALID_CONFIG, rid, validReport(), u.uid, step), u.idToken);
    assert.equal(res.status, 200, `report ${i}`);
    before = { lastMs: nowMs, dayMs: step.dayMs, count: step.count };
  }
  nowMs += 3 * 60 * 1000;
  const sixthStep = { create: false, dayMs: before.dayMs, count: 6 };
  const sixthRes = await postCommit(server, buildReportCommit(VALID_CONFIG, "reportid000000000006", validReport(), u.uid, sixthStep), u.idToken);
  assert.equal(sixthRes.status, 403);
});

test("report + limit commit: the limit write targets another uid -> 403; without the limit write -> 403", async () => {
  let nowMs = 1000000;
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true, now: () => nowMs });
  const u = await newUser(server);
  const step = nextLimitState(null, nowMs);

  const commit = buildReportCommit(VALID_CONFIG, "reportidotheruid00001", validReport(), "not-my-uid", step);
  const res = await postCommit(server, commit, u.idToken);
  assert.equal(res.status, 403);

  const reportOnly = { writes: [buildReportCommit(VALID_CONFIG, "reportidnolimitwrite1", validReport(), u.uid, step).writes[0]] };
  const res2 = await postCommit(server, reportOnly, u.idToken);
  assert.equal(res2.status, 403);
});

test("a limit write alone that is a valid step succeeds", async () => {
  let nowMs = 1000000;
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true, now: () => nowMs });
  const u = await newUser(server);
  const step = nextLimitState(null, nowMs);
  const commit = buildReportCommit(VALID_CONFIG, "reportidlimitonly0001", validReport(), u.uid, step);
  const limitOnly = { writes: [commit.writes[1]] };
  const res = await postCommit(server, limitOnly, u.idToken);
  assert.equal(res.status, 200);
  assert.equal(server.limits().find((l) => l.uid === u.uid).count, 1);
  assert.equal(server.reports().length, 0);
});

test("reportLimits GET: owner 200/404, admin 200/404, any other caller 403", async () => {
  let nowMs = 1000000;
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true, now: () => nowMs });
  const u = await newUser(server);
  const other = await newUser(server);

  const notYet = await server.fetchFn(firestoreUrl(VALID_CONFIG, `/${REPORT_LIMITS_COLLECTION}/${u.uid}`), authInit("GET", u.idToken));
  assert.equal(notYet.status, 404);

  const step = nextLimitState(null, nowMs);
  await postCommit(server, buildReportCommit(VALID_CONFIG, "reportidgetowner00001", validReport(), u.uid, step), u.idToken);

  const owner = await server.fetchFn(firestoreUrl(VALID_CONFIG, `/${REPORT_LIMITS_COLLECTION}/${u.uid}`), authInit("GET", u.idToken));
  assert.equal(owner.status, 200);

  const otherCaller = await server.fetchFn(firestoreUrl(VALID_CONFIG, `/${REPORT_LIMITS_COLLECTION}/${u.uid}`), authInit("GET", other.idToken));
  assert.equal(otherCaller.status, 403);

  const admin = await server.fetchFn(firestoreUrl(VALID_CONFIG, `/${REPORT_LIMITS_COLLECTION}/${u.uid}`), authInit("GET", FAKE_ADMIN_TOKEN));
  assert.equal(admin.status, 200);
});

test("reportLimits: runQuery and DELETE are 403 for users", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true });
  const u = await newUser(server);
  const q = await server.fetchFn(
    firestoreUrl(VALID_CONFIG, ":runQuery"),
    jsonInit("POST", { structuredQuery: { from: [{ collectionId: REPORT_LIMITS_COLLECTION }], limit: 10 } }, u.idToken),
  );
  assert.equal(q.status, 403);
  const del = await server.fetchFn(firestoreUrl(VALID_CONFIG, `/${REPORT_LIMITS_COLLECTION}/${u.uid}`), authInit("DELETE", u.idToken));
  assert.equal(del.status, 403);
});

test("Phase 83-09: a bare collection GET (no id) on bugReports or reportLimits — a list attempt — is 403, for a user, admin or no auth at all", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true });
  const u = await newUser(server);
  for (const collection of ["bugReports", REPORT_LIMITS_COLLECTION]) {
    const url = firestoreUrl(VALID_CONFIG, `/${collection}`);
    const noAuth = await server.fetchFn(url, { method: "GET" });
    assert.equal(noAuth.status, 403, `${collection}: no auth`);
    const asUser = await server.fetchFn(url, authInit("GET", u.idToken));
    assert.equal(asUser.status, 403, `${collection}: as a signed-in user`);
    const asAdmin = await server.fetchFn(url, authInit("GET", FAKE_ADMIN_TOKEN));
    assert.equal(asAdmin.status, 403, `${collection}: even the admin token`);
  }
});

test("admin PATCH reportLimits/{uid} seeds a limit doc; DELETE removes it", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true });
  const fields = { last: { timestampValue: new Date(1000).toISOString() }, day: { timestampValue: new Date(0).toISOString() }, count: { integerValue: "3" } };
  const patch = await server.fetchFn(firestoreUrl(VALID_CONFIG, "/reportLimits/seeduid"), jsonInit("PATCH", { fields }, FAKE_ADMIN_TOKEN));
  assert.equal(patch.status, 200);
  assert.equal(server.limits().find((l) => l.uid === "seeduid").count, 3);
  const del = await server.fetchFn(firestoreUrl(VALID_CONFIG, "/reportLimits/seeduid"), authInit("DELETE", FAKE_ADMIN_TOKEN));
  assert.equal(del.status, 200);
  assert.ok(!server.limits().some((l) => l.uid === "seeduid"));
});

test("GET bugReports/{id}: 403 for users, 200/404 for the admin", async () => {
  let nowMs = 1000000;
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true, now: () => nowMs });
  const u = await newUser(server);
  const step = nextLimitState(null, nowMs);
  const reportId = "reportidbugreports001";
  await postCommit(server, buildReportCommit(VALID_CONFIG, reportId, validReport(), u.uid, step), u.idToken);

  const userRes = await server.fetchFn(firestoreUrl(VALID_CONFIG, `/bugReports/${reportId}`), authInit("GET", u.idToken));
  assert.equal(userRes.status, 403);

  const adminRes = await server.fetchFn(firestoreUrl(VALID_CONFIG, `/bugReports/${reportId}`), authInit("GET", FAKE_ADMIN_TOKEN));
  assert.equal(adminRes.status, 200);

  const adminMissing = await server.fetchFn(firestoreUrl(VALID_CONFIG, "/bugReports/nope"), authInit("GET", FAKE_ADMIN_TOKEN));
  assert.equal(adminMissing.status, 404);
});

/* ================================================================
   inspectors
   ================================================================ */

test("inspectors: calls(), docs(), reports(), limits(), users(), banned() are frozen; ban()/unban()", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true });
  await signUp(server);
  assert.ok(Object.isFrozen(server.calls()));
  assert.ok(Object.isFrozen(server.docs()));
  assert.ok(Object.isFrozen(server.reports()));
  assert.ok(Object.isFrozen(server.limits()));
  assert.ok(Object.isFrozen(server.users()));
  assert.ok(Object.isFrozen(server.banned()));
  assert.ok(server.calls().length >= 1);
  assert.equal(server.calls()[0].auth, "none");

  server.ban("someuid");
  assert.ok(server.banned().includes("someuid"));
  server.unban("someuid");
  assert.ok(!server.banned().includes("someuid"));
});

test("seeded runs appear in queries", async () => {
  const s = seed({ uid: "seed1", hash: "00000001" });
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true, runs: [s] });
  const hits = await postQuery(server, topTenQuery({ stat: "deep", season: SEASON }));
  assert.equal(hits.length, 1);
  assert.equal(hits[0].document.name, docName(VALID_CONFIG, RUN_COLLECTION, s.id));
});

/* ================================================================
   Phase 87 (BOARD-28): the DEPTH key transition mode + admin deepKey patch
   ================================================================ */

async function createWithDeepKey(server, u, deepKeyFor, overrides = {}) {
  const doc = docFrom({ uid: u.uid, ...overrides });
  doc.deepKey = deepKeyFor(doc);
  const id = runDocId(u.uid, doc.hash);
  const res = await postCommit(server, createRunCommit(VALID_CONFIG, id, doc), u.idToken);
  return { res, id };
}

test("BOARD-28 fake: default mirrors the final rules — the legacy deepKey is denied, the new one stored", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG });
  const u = await newUser(server);
  server.setName(u.uid, "Moss Knuckle");
  const legacy = await createWithDeepKey(server, u, legacyDeepKeyOf, { hash: "aaaaaaa1", handle: "Moss Knuckle" });
  assert.equal(legacy.res.status, 403);
  const current = await createWithDeepKey(server, u, deepKeyOf, { hash: "aaaaaaa2", handle: "Moss Knuckle" });
  assert.equal(current.res.status, 200);
  assert.deepEqual(server.docs().map((d) => d.id), [current.id]);
});

test("BOARD-28 fake: transition mirrors the transition rules — old or new formula only, every other clause intact", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true });
  const u = await newUser(server);
  const legacy = await createWithDeepKey(server, u, legacyDeepKeyOf, { hash: "bbbbbbb1" });
  assert.equal(legacy.res.status, 200);
  const current = await createWithDeepKey(server, u, deepKeyOf, { hash: "bbbbbbb2" });
  assert.equal(current.res.status, 200);
  const neither = await createWithDeepKey(server, u, (d) => deepKeyOf(d) + 1, { hash: "bbbbbbb3" });
  assert.equal(neither.res.status, 403);
  const otherClause = await createWithDeepKey(server, u, legacyDeepKeyOf, { hash: "bbbbbbb4", handle: "not a handle" });
  assert.equal(otherClause.res.status, 403);
  assert.equal(server.docs().length, 2);
});

test("BOARD-28 fake: a runQuery by deepKey DESCENDING puts the same-floor run with more steps first", async () => {
  const seeds = [
    seed({ uid: "d1", hash: "00000001", floor: 6, steps: 50 }),
    seed({ uid: "d1", hash: "00000002", floor: 6, steps: 100 }),
  ];
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true, runs: seeds });
  const hits = await postQuery(server, topTenQuery({ stat: "deep", season: SEASON }));
  assert.deepEqual(hits.map((h) => Number(h.document.fields.steps.integerValue)), [100, 50]);
});

function patchDeepKeyUrl(id, mask = "updateMask.fieldPaths=deepKey") {
  return `${firestoreUrl(VALID_CONFIG, `/runs/${id}`)}&${mask}`;
}

function deepKeyBody(value) {
  return { fields: { deepKey: { integerValue: value } } };
}

test("BOARD-28 fake: admin PATCH runs/{id} with mask deepKey sets that field alone and bumps updateTime", async () => {
  let nowMs = Date.parse("2026-09-28T12:00:00.000Z");
  const s = seed({ uid: "p1", hash: "00000001" });
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true, runs: [s], now: () => nowMs });
  const before = server.docs().find((d) => d.id === s.id);
  const getBefore = await (await server.fetchFn(firestoreUrl(VALID_CONFIG, `/runs/${s.id}`), { method: "GET" })).json();
  nowMs += 60000;
  const res = await server.fetchFn(patchDeepKeyUrl(s.id), jsonInit("PATCH", deepKeyBody("5000900"), FAKE_ADMIN_TOKEN));
  assert.equal(res.status, 200);
  const after = server.docs().find((d) => d.id === s.id);
  assert.equal(after.deepKey, 5000900);
  const { deepKey: _b, ...beforeRest } = before;
  const { deepKey: _a, ...afterRest } = after;
  assert.deepEqual(afterRest, beforeRest);
  const getAfter = await (await server.fetchFn(firestoreUrl(VALID_CONFIG, `/runs/${s.id}`), { method: "GET" })).json();
  assert.notEqual(getAfter.updateTime, getBefore.updateTime);
  assert.equal(getAfter.createTime, getBefore.createTime);
});

test("BOARD-28 fake: the deepKey PATCH is refused for a user or no token, a wrong mask, a missing run and a non-integer value", async () => {
  const s = seed({ uid: "p2", hash: "00000001" });
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true, runs: [s] });
  const u = await newUser(server);
  const snapshot = JSON.stringify(server.docs());

  const asUser = await server.fetchFn(patchDeepKeyUrl(s.id), jsonInit("PATCH", deepKeyBody("5000900"), u.idToken));
  assert.equal(asUser.status, 403);
  const noToken = await server.fetchFn(patchDeepKeyUrl(s.id), jsonInit("PATCH", deepKeyBody("5000900")));
  assert.equal(noToken.status, 403);
  const wrongMask = await server.fetchFn(patchDeepKeyUrl(s.id, "updateMask.fieldPaths=floor"), jsonInit("PATCH", deepKeyBody("5000900"), FAKE_ADMIN_TOKEN));
  assert.equal(wrongMask.status, 400);
  const twoMasks = await server.fetchFn(patchDeepKeyUrl(s.id, "updateMask.fieldPaths=deepKey&updateMask.fieldPaths=floor"), jsonInit("PATCH", deepKeyBody("5000900"), FAKE_ADMIN_TOKEN));
  assert.equal(twoMasks.status, 400);
  const noMask = await server.fetchFn(patchDeepKeyUrl(s.id, "x=1"), jsonInit("PATCH", deepKeyBody("5000900"), FAKE_ADMIN_TOKEN));
  assert.equal(noMask.status, 400);
  const missing = await server.fetchFn(patchDeepKeyUrl("nope_00000000"), jsonInit("PATCH", deepKeyBody("5000900"), FAKE_ADMIN_TOKEN));
  assert.equal(missing.status, 404);
  const notInt = await server.fetchFn(patchDeepKeyUrl(s.id), jsonInit("PATCH", { fields: { deepKey: { stringValue: "5000900" } } }, FAKE_ADMIN_TOKEN));
  assert.equal(notInt.status, 400);
  assert.equal(JSON.stringify(server.docs()), snapshot);
});

/* ================================================================
   purity
   ================================================================ */

test("purity: fakeBoardServer.js never touches DOM globals and never calls the bare global fetch", () => {
  const code = stripJs(FAKE_SERVER_SRC);
  for (const banned of [/\bwindow\b/, /\bnavigator\b/, /\blocalStorage\b/, /\bsessionStorage\b/]) {
    assert.doesNotMatch(code, banned, `must not use ${banned}`);
  }
  // "document" appears only as the Firestore REST response shape's object
  // key (`document: { name, fields, ... }`, mirroring the real API) and in
  // `documentsPath` — never as a DOM global reference (`document.<member>`,
  // with no preceding `.` and not an object-literal key).
  assert.doesNotMatch(code, /(?<!\.)\bdocument\b(?!\s*:)/, "must not use the DOM global `document`");
  assert.doesNotMatch(code, /(?<!\w)fetch\(/, "must never call the global fetch directly");
});

test("purity: exports createFakeBoardFetch and mirrors validateRunDoc", () => {
  assert.equal((FAKE_SERVER_SRC.match(/export function createFakeBoardFetch/g) || []).length, 1);
  assert.ok((FAKE_SERVER_SRC.match(/validateRunDoc/g) || []).length >= 1);
});

/* ================================================================
   Phase 91.2 (BOARD-31, BOARD-33, D-11, D-13): the names gate. The default
   fake mirrors firebase/firestore.rules; transition: true mirrors
   firebase/firestore.transition.rules.
   ================================================================ */

const GAMER = "Moss Knuckle";

async function postRun(server, u, overrides = {}) {
  const doc = docFrom({ uid: u.uid, ...overrides });
  const id = runDocId(u.uid, doc.hash);
  const res = await postCommit(server, createRunCommit(VALID_CONFIG, id, doc), u.idToken);
  return { res, id, doc };
}

test("final fake: an anonymous uid with no names entry cannot create a run, even with a well-formed handle", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG });
  const u = await newUser(server);
  assert.equal((await postRun(server, u, { handle: GAMER })).res.status, 403);
  assert.equal((await postRun(server, u, { handle: "@mossjaw", hash: "0a1b2c3e" })).res.status, 403);
  assert.equal(server.docs().length, 0);
});

test("final fake: a named uid's run lands only when its handle equals the name exactly", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG });
  const u = await newUser(server);
  server.setName(u.uid, GAMER);
  const ok = await postRun(server, u, { handle: GAMER, hash: "00000001" });
  assert.equal(ok.res.status, 200);
  assert.equal(server.docs().find((d) => d.id === ok.id).handle, GAMER);
  assert.equal((await postRun(server, u, { handle: "Moss Knuckl", hash: "00000002" })).res.status, 403);
  assert.equal((await postRun(server, u, { handle: "moss knuckle", hash: "00000003" })).res.status, 403);
  assert.equal((await postRun(server, u, { handle: "@mossjaw", hash: "00000004" })).res.status, 403);
  assert.equal(server.docs().length, 1);
});

test("final fake: someone else's name does not help (the gate is the poster's own names entry)", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG });
  const a = await newUser(server);
  const b = await newUser(server);
  server.setName(a.uid, GAMER);
  assert.equal((await postRun(server, b, { handle: GAMER })).res.status, 403);
});

test("final fake: every other create clause stays (shape, id, uid, banned, when bound)", async () => {
  const NOW_MS = 1000000;
  const server = createFakeBoardFetch({ config: VALID_CONFIG, now: () => NOW_MS });
  const u = await newUser(server);
  server.setName(u.uid, GAMER);
  assert.equal((await postRun(server, u, { handle: GAMER, floor: 99999, hash: "00000011" })).res.status, 403);
  assert.equal((await postRun(server, u, { handle: GAMER, when: NOW_MS + WHEN_SKEW_MS + 1, hash: "00000012" })).res.status, 403);
  const wrongId = docFrom({ uid: u.uid, handle: GAMER, hash: "00000013" });
  assert.equal((await postCommit(server, createRunCommit(VALID_CONFIG, "wrong_id", wrongId), u.idToken)).status, 403);
  server.ban(u.uid);
  assert.equal((await postRun(server, u, { handle: GAMER, hash: "00000014" })).res.status, 403);
  server.unban(u.uid);
  assert.equal((await postRun(server, u, { handle: GAMER, hash: "00000014" })).res.status, 200);
});

test("final fake: a name longer than the 64-character bound never lands", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG });
  const u = await newUser(server);
  const long = "x".repeat(65);
  server.setName(u.uid, long);
  assert.equal((await postRun(server, u, { handle: long })).res.status, 403);
});

test("final fake: no client run update at all — not the 2.2.0 re-roll, not a rename to the verified name", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG });
  const u = await newUser(server);
  server.setName(u.uid, GAMER);
  const made = await postRun(server, u, { handle: GAMER });
  assert.equal(made.res.status, 200);
  const before = JSON.stringify(server.docs());
  for (const handle of ["@mossjaw", GAMER, "Other Name"]) {
    const res = await postCommit(server, handleUpdateCommit(VALID_CONFIG, made.id, handle), u.idToken);
    assert.equal(res.status, 403, handle);
  }
  assert.equal(JSON.stringify(server.docs()), before);
});

test("final fake: a shipped 2.2.0 client's whole flow is refused (anonymous create, then the re-roll update)", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG });
  const u = await newUser(server);
  const create = await postRun(server, u, { handle: "@mossjaw" });
  assert.equal(create.res.status, 403);
  const legacyDoc = docFrom({ uid: u.uid, handle: "@mossjaw", hash: "00000021" });
  legacyDoc.deepKey = legacyDeepKeyOf(legacyDoc);
  const id = runDocId(u.uid, legacyDoc.hash);
  assert.equal((await postCommit(server, createRunCommit(VALID_CONFIG, id, legacyDoc), u.idToken)).status, 403);

  // a 2.2.0 run posted before the cutover (seeded under the first minted uid) cannot be re-rolled either
  const own = seed({ uid: "fakeuid000001", hash: "00000023", handle: "@mossjaw" });
  const held = createFakeBoardFetch({ config: VALID_CONFIG, runs: [own] });
  const w = await newUser(held);
  assert.equal(w.uid, "fakeuid000001");
  const reroll = await postCommit(held, handleUpdateCommit(VALID_CONFIG, own.id, "@gravepouch"), w.idToken);
  assert.equal(reroll.status, 403);
  assert.equal(held.docs().find((d) => d.id === own.id).handle, "@mossjaw");
});

test("final fake: the owner's delete still works for a named and for an unnamed account (ERASE MY RUNS)", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG });
  const u = await newUser(server);
  server.setName(u.uid, GAMER);
  const made = await postRun(server, u, { handle: GAMER });
  assert.equal(made.res.status, 200);
  // an unnamed (anonymous, 2.2.0-era) owner erases too: its run is seeded under the first minted uid
  const held = createFakeBoardFetch({ config: VALID_CONFIG, runs: [seed({ uid: "fakeuid000001", hash: "00000032", handle: "@mossjaw" })] });
  const g = await newUser(held);
  assert.equal(g.uid, "fakeuid000001");
  assert.equal((await postCommit(held, deleteCommit(VALID_CONFIG, runDocId(g.uid, "00000032")), g.idToken)).status, 200);
  assert.equal(held.docs().length, 0);
  assert.equal((await postCommit(server, deleteCommit(VALID_CONFIG, made.id), u.idToken)).status, 200);
  assert.equal(server.docs().length, 0);
});

test("final fake: the admin paths never reach a client rule (create of any shape, deepKey patch, commit over runs)", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG });
  const doc = docFrom({ uid: "any-uid", handle: "@mossjaw" });
  const id = runDocId("any-uid", doc.hash);
  assert.equal((await postCommit(server, createRunCommit(VALID_CONFIG, id, doc), FAKE_ADMIN_TOKEN)).status, 200);
  const patch = await server.fetchFn(patchDeepKeyUrl(id), jsonInit("PATCH", deepKeyBody("5000900"), FAKE_ADMIN_TOKEN));
  assert.equal(patch.status, 200);
  const renamed = await postCommit(server, handleUpdateCommit(VALID_CONFIG, id, GAMER), FAKE_ADMIN_TOKEN);
  assert.equal(renamed.status, 200);
  assert.equal(server.docs().find((d) => d.id === id).handle, GAMER);
});

test("transition fake: an unnamed uid posts a 2.2.0 @handle run with either deepKey formula", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true });
  const u = await newUser(server);
  const oldKey = await createWithDeepKey(server, u, legacyDeepKeyOf, { hash: "00000041", handle: "@mossjaw" });
  assert.equal(oldKey.res.status, 200);
  const newKey = await createWithDeepKey(server, u, deepKeyOf, { hash: "00000042", handle: "@mossjaw" });
  assert.equal(newKey.res.status, 200);
  const third = await createWithDeepKey(server, u, (d) => deepKeyOf(d) + 1, { hash: "00000043", handle: "@mossjaw" });
  assert.equal(third.res.status, 403);
  const notLegacy = await postRun(server, u, { handle: GAMER, hash: "00000044" });
  assert.equal(notLegacy.res.status, 403, "an unnamed uid cannot post a Play Games style name");
  assert.equal(server.docs().length, 2);
});

test("transition fake: an unnamed owner's 2.2.0 handle-only re-roll lands, a non-legacy handle does not", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true });
  const u = await newUser(server);
  const made = await createWithDeepKey(server, u, legacyDeepKeyOf, { hash: "00000051", handle: "@mossjaw" });
  assert.equal(made.res.status, 200);
  assert.equal((await postCommit(server, handleUpdateCommit(VALID_CONFIG, made.id, "@gravepouch"), u.idToken)).status, 200);
  assert.equal(server.docs().find((d) => d.id === made.id).handle, "@gravepouch");
  assert.equal((await postCommit(server, handleUpdateCommit(VALID_CONFIG, made.id, GAMER), u.idToken)).status, 403);
  const other = await newUser(server);
  assert.equal((await postCommit(server, handleUpdateCommit(VALID_CONFIG, made.id, "@mossjaw"), other.idToken)).status, 403);
});

test("transition fake: a named uid can never use a legacy branch (T-91.2-14)", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true });
  const u = await newUser(server);
  const early = await createWithDeepKey(server, u, legacyDeepKeyOf, { hash: "00000061", handle: "@mossjaw" });
  assert.equal(early.res.status, 200, "unnamed: the legacy create lands");
  server.setName(u.uid, GAMER);
  const late = await createWithDeepKey(server, u, legacyDeepKeyOf, { hash: "00000062", handle: "@mossjaw" });
  assert.equal(late.res.status, 403, "named: the legacy @handle create is refused");
  assert.equal((await postCommit(server, handleUpdateCommit(VALID_CONFIG, early.id, "@gravepouch"), u.idToken)).status, 403, "named: the legacy update is refused");
  assert.equal(server.docs().find((d) => d.id === early.id).handle, "@mossjaw");
});

test("transition fake: a named create lands under the verified name, with either deepKey formula; a wrong name is refused", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true });
  const u = await newUser(server);
  server.setName(u.uid, GAMER);
  assert.equal((await createWithDeepKey(server, u, deepKeyOf, { hash: "00000071", handle: GAMER })).res.status, 200);
  assert.equal((await createWithDeepKey(server, u, legacyDeepKeyOf, { hash: "00000072", handle: GAMER })).res.status, 200);
  assert.equal((await createWithDeepKey(server, u, deepKeyOf, { hash: "00000073", handle: "Someone Else" })).res.status, 403);
});

test("transition fake: banned unnamed and named uids are refused on the legacy and the named branch alike", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG, transition: true });
  const u = await newUser(server);
  server.ban(u.uid);
  assert.equal((await postRun(server, u, { handle: "@mossjaw", hash: "00000081" })).res.status, 403);
  server.setName(u.uid, GAMER);
  assert.equal((await postRun(server, u, { handle: GAMER, hash: "00000082" })).res.status, 403);
});

test("the fake keeps no acceptLegacyDeepKey option and no rolled-handle import", () => {
  assert.equal(FAKE_SERVER_SRC.includes("acceptLegacyDeepKey"), false, "the old option name is gone, comments included");
  assert.equal(FAKE_SERVER_SRC.includes("handles.js"), false, "the rolled-handle module is not imported or named");
  assert.ok(/transition\s*=\s*false/.test(FAKE_SERVER_SRC), "transition defaults to false (the final rules)");
});
