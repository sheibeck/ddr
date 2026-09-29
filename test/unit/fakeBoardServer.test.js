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
  rankKeys,
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
    epitaph: "",
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
  const server = createFakeBoardFetch({ config: VALID_CONFIG });
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
  const server = createFakeBoardFetch({ config: VALID_CONFIG });
  server.setOnline(false);
  await assert.rejects(() => server.fetchFn(firestoreUrl(VALID_CONFIG, ":runQuery"), jsonInit("POST", {})), TypeError);
  server.setOnline(true);
  const res = await server.fetchFn(firestoreUrl(VALID_CONFIG, ":runQuery"), jsonInit("POST", { structuredQuery: { from: [{ collectionId: "runs" }], limit: 10 } }));
  assert.equal(res.status, 200);
});

test("unknown route returns 404", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG });
  const res = await server.fetchFn(`https://example.com/nope?key=${encodeURIComponent(VALID_CONFIG.apiKey)}`, { method: "GET" });
  assert.equal(res.status, 404);
});

/* ================================================================
   identity: signUp, delete, refresh
   ================================================================ */

test("accounts:signUp: 200 with fresh uid, tokens, expiresIn '3600'", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG });
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
  const server = createFakeBoardFetch({ config: VALID_CONFIG, anonymousEnabled: false });
  const a = await signUp(server);
  assert.equal(a.status, 400);
  assert.equal(a.json.error.message, "OPERATION_NOT_ALLOWED");
});

test("securetoken:token: known refresh token -> 200 snake_case tokens; unknown -> 400 INVALID_REFRESH_TOKEN", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG });
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
  const server = createFakeBoardFetch({ config: VALID_CONFIG });
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
  const server = createFakeBoardFetch({ config: VALID_CONFIG, now: () => 1000000 });
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
  const server = createFakeBoardFetch({ config: VALID_CONFIG });
  const doc = docFrom();
  const id = runDocId(doc.uid, doc.hash);
  const res = await postCommit(server, createRunCommit(VALID_CONFIG, id, doc));
  assert.equal(res.status, 403);
  assert.equal(res.json.error.status, "PERMISSION_DENIED");
});

test("commit run create: expired token -> 401 UNAUTHENTICATED", async () => {
  let nowMs = 0;
  const server = createFakeBoardFetch({ config: VALID_CONFIG, now: () => nowMs, tokenTtlMs: 1000 });
  const u = await newUser(server);
  nowMs = 5000; // well past tokenTtlMs
  const doc = docFrom({ uid: u.uid });
  const id = runDocId(u.uid, doc.hash);
  const res = await postCommit(server, createRunCommit(VALID_CONFIG, id, doc), u.idToken);
  assert.equal(res.status, 401);
  assert.equal(res.json.error.status, "UNAUTHENTICATED");
});

test("commit run create: doc uid not the caller -> 403", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG });
  const u = await newUser(server);
  const doc = docFrom({ uid: "someone-else" });
  const id = runDocId("someone-else", doc.hash);
  const res = await postCommit(server, createRunCommit(VALID_CONFIG, id, doc), u.idToken);
  assert.equal(res.status, 403);
});

test("commit run create: mismatched id -> 403", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG });
  const u = await newUser(server);
  const doc = docFrom({ uid: u.uid });
  const res = await postCommit(server, createRunCommit(VALID_CONFIG, "wrong_id", doc), u.idToken);
  assert.equal(res.status, 403);
});

test("commit run create: banned uid -> 403", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG });
  const u = await newUser(server);
  server.ban(u.uid);
  const doc = docFrom({ uid: u.uid });
  const id = runDocId(u.uid, doc.hash);
  const res = await postCommit(server, createRunCommit(VALID_CONFIG, id, doc), u.idToken);
  assert.equal(res.status, 403);
});

test("commit run create: invalid doc (fails validateRunDoc) -> 403", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG });
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
    const server = createFakeBoardFetch({ config: VALID_CONFIG, existsResponse: mode });
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
  const server = createFakeBoardFetch({ config: VALID_CONFIG });
  const doc = docFrom({ uid: "any-uid" });
  const id = runDocId("any-uid", doc.hash);
  const res = await postCommit(server, createRunCommit(VALID_CONFIG, id, doc), FAKE_ADMIN_TOKEN);
  assert.equal(res.status, 200);
});

/* ================================================================
   commit: handle update (single + multi-id re-roll)
   ================================================================ */

test("commit handle update: owner + valid handle -> 200, doc updated", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG });
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
  const server = createFakeBoardFetch({ config: VALID_CONFIG });
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
  const server = createFakeBoardFetch({ config: VALID_CONFIG });
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
  const server = createFakeBoardFetch({ config: VALID_CONFIG });
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
  const server = createFakeBoardFetch({ config: VALID_CONFIG });
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
  const server = createFakeBoardFetch({ config: VALID_CONFIG });
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
  const server = createFakeBoardFetch({ config: VALID_CONFIG, runs: seeds });

  const noLimit = await server.fetchFn(firestoreUrl(VALID_CONFIG, ":runQuery"), jsonInit("POST", { structuredQuery: { from: [{ collectionId: "runs" }] } }));
  assert.equal(noLimit.status, 403);

  const overLimitRes = await server.fetchFn(firestoreUrl(VALID_CONFIG, ":runQuery"), jsonInit("POST", topTenQuery({ stat: "deep", season: SEASON, limit: 51 })));
  assert.equal(overLimitRes.status, 403);

  const hits = await postQuery(server, topTenQuery({ stat: "deep", season: SEASON }));
  assert.ok(Array.isArray(hits));
  assert.equal(hits.length, 3);
  // deep = floor desc, then fewer steps: floor 10 first, floor 5, floor 3
  const floors = hits.map((h) => Number(h.document.fields.floor.integerValue));
  assert.deepEqual(floors, [10, 5, 3]);

  const raceFiltered = await postQuery(server, topTenQuery({ stat: "deep", season: SEASON, race: "Human" }));
  assert.equal(raceFiltered.length, 2);
});

test("runQuery: admin bypasses the list limit", async () => {
  const server = createFakeBoardFetch({ config: VALID_CONFIG, runs: [seed({ uid: "q2", hash: "00000001" })] });
  const res = await server.fetchFn(
    firestoreUrl(VALID_CONFIG, ":runQuery"),
    jsonInit("POST", { structuredQuery: { from: [{ collectionId: "runs" }] } }, FAKE_ADMIN_TOKEN),
  );
  assert.equal(res.status, 200);
});

test("runQuery: cursor pagination over 120 seeded docs for one uid", async () => {
  const uid = "cursoruid";
  const server = createFakeBoardFetch({ config: VALID_CONFIG, runs: seedDocs(120, uid) });
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
  const server = createFakeBoardFetch({ config: VALID_CONFIG });
  const hits = await postQuery(server, topTenQuery({ stat: "deep", season: SEASON }));
  assert.deepEqual(Object.keys(hits[0]), ["readTime"]);
});

test("runAggregationQuery: count needs no limit, returns the filtered count under the alias", async () => {
  const seeds = [
    seed({ uid: "c1", hash: "00000001", race: "Human" }),
    seed({ uid: "c1", hash: "00000002", race: "Elven" }),
  ];
  const server = createFakeBoardFetch({ config: VALID_CONFIG, runs: seeds });
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
  const server = createFakeBoardFetch({ config: VALID_CONFIG, runs: [s] });
  const found = await server.fetchFn(firestoreUrl(VALID_CONFIG, `/runs/${s.id}`), { method: "GET" });
  assert.equal(found.status, 200);
  const missing = await server.fetchFn(firestoreUrl(VALID_CONFIG, `/runs/nope_00000000`), { method: "GET" });
  assert.equal(missing.status, 404);
});

test("DELETE runs/{id}: admin only", async () => {
  const s = seed({ uid: "g2", hash: "00000001" });
  const server = createFakeBoardFetch({ config: VALID_CONFIG, runs: [s] });
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
  const server = createFakeBoardFetch({ config: VALID_CONFIG });
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
  const server = createFakeBoardFetch({ config: VALID_CONFIG, now: () => nowMs });
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
  const server = createFakeBoardFetch({ config: VALID_CONFIG, now: () => nowMs });
  const step = nextLimitState(null, nowMs);
  const res = await postCommit(server, buildReportCommit(VALID_CONFIG, "reportidnoauth00001a", validReport(), "someuid", step));
  assert.equal(res.status, 403);
});

test("report + limit commit: inside the cooldown -> 403; forged count -> 403; past the daily cap -> 403", async () => {
  let nowMs = 1000000;
  const server = createFakeBoardFetch({ config: VALID_CONFIG, now: () => nowMs });
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
  const server = createFakeBoardFetch({ config: VALID_CONFIG, now: () => nowMs });
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
  const server = createFakeBoardFetch({ config: VALID_CONFIG, now: () => nowMs });
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
  const server = createFakeBoardFetch({ config: VALID_CONFIG, now: () => nowMs });
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
  const server = createFakeBoardFetch({ config: VALID_CONFIG });
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
  const server = createFakeBoardFetch({ config: VALID_CONFIG });
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
  const server = createFakeBoardFetch({ config: VALID_CONFIG });
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
  const server = createFakeBoardFetch({ config: VALID_CONFIG, now: () => nowMs });
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
  const server = createFakeBoardFetch({ config: VALID_CONFIG });
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
  const server = createFakeBoardFetch({ config: VALID_CONFIG, runs: [s] });
  const hits = await postQuery(server, topTenQuery({ stat: "deep", season: SEASON }));
  assert.equal(hits.length, 1);
  assert.equal(hits[0].document.name, docName(VALID_CONFIG, RUN_COLLECTION, s.id));
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
