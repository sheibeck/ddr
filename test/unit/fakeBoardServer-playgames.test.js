// test/unit/fakeBoardServer-playgames.test.js
//
// Phase 91.2-03 Task 1. The fake board server's Play Games identity mirror:
// accounts:signInWithIdp / accounts:lookup / accounts:update, the account
// bookkeeping (unlink, delete frees the player), the admin-only names and
// nameOverrides collections, and admin :runQuery / :commit over runs without
// client rules. Every option models one spike gate (G2, G3, G4) offline.

import test from "node:test";
import assert from "node:assert/strict";

import { FIREBASE_CONFIG } from "../../src/browser/firebaseConfig.js";
import { IDENTITY_BASE, firestoreUrl, docName, toFirestoreFields, fromFirestoreFields } from "../../src/browser/firestoreRest.js";
import { runDocId } from "../../src/browser/runDoc.js";
import { createFakePlayIdentity } from "../../src/browser/playIdentity.js";
import { FAKE_ADMIN_TOKEN, createFakeBoardFetch } from "../../src/browser/fakeBoardServer.js";

const PROVIDER = "playgames.google.com";
const NOW_MS = Date.parse("2026-10-01T12:00:00.000Z");

/* ---------------- helpers ---------------- */

const idUrl = (op) => `${IDENTITY_BASE}/accounts:${op}?key=${FIREBASE_CONFIG.apiKey}`;

function code(playerId, displayName, n = 1) {
  return `fake:${encodeURIComponent(playerId)}:${encodeURIComponent(displayName)}:${n}`;
}

function jsonInit(method, bodyObj, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const init = { method, headers };
  if (bodyObj !== undefined) init.body = JSON.stringify(bodyObj);
  return init;
}

async function call(server, url, init) {
  const res = await server.fetchFn(url, init);
  return { status: res.status, json: await res.json() };
}

async function signUp(server) {
  const r = await call(server, idUrl("signUp"), jsonInit("POST", { returnSecureToken: true }));
  assert.equal(r.status, 200);
  return { uid: r.json.localId, idToken: r.json.idToken, refreshToken: r.json.refreshToken };
}

async function idp(server, authCode, extra = {}) {
  return call(
    server,
    idUrl("signInWithIdp"),
    jsonInit("POST", {
      requestUri: "http://localhost",
      postBody: `code=${encodeURIComponent(authCode)}&providerId=${PROVIDER}`,
      returnSecureToken: true,
      returnIdpCredential: true,
      ...extra,
    }),
  );
}

const lookup = (server, idToken) => call(server, idUrl("lookup"), jsonInit("POST", { idToken }));
const update = (server, body) => call(server, idUrl("update"), jsonInit("POST", body));

function makeServer(opts = {}) {
  return createFakeBoardFetch({ now: () => NOW_MS, ...opts });
}

function runSeed(uid, hash, over = {}) {
  const floor = over.floor ?? 3;
  const steps = over.steps ?? 120;
  const doc = {
    uid,
    handle: "@old handle",
    season: 1,
    name: "Aldric Vane",
    race: "Human",
    sub: "Knight",
    cls: "Fighter",
    level: 2,
    floor,
    day: 4,
    steps,
    kills: 9,
    gold: 77,
    sp: 5,
    cause: "combat",
    note: "cut down by a Rat",
    epitaph: "",
    when: 1790000000000,
    hash,
    version: "2.2.0 (12)",
    seed: 1001,
    acts: 10,
    deepKey: floor * 1000000 + steps,
    daysKey: 4003,
    killsKey: 9003,
    goldKey: 77,
    ...over,
  };
  return { id: runDocId(uid, hash), doc };
}

const docUrl = (collection, id) => firestoreUrl(FIREBASE_CONFIG, `/${collection}/${id}`);
const fsAdmin = (server, method, collection, id, body) =>
  call(server, docUrl(collection, id), jsonInit(method, body, FAKE_ADMIN_TOKEN));

/* ---------------- signInWithIdp ---------------- */

test("signInWithIdp: a fresh code and no idToken creates a linked account; the same player signs in to the same uid", async () => {
  const server = makeServer();
  const first = await idp(server, code("p-1", "Gamer One", 1));
  assert.equal(first.status, 200);
  assert.equal(first.json.isNewUser, true);
  assert.equal(first.json.providerId, PROVIDER);
  assert.equal(first.json.federatedId, "p-1");
  assert.equal(first.json.displayName, "Gamer One");
  assert.equal(first.json.expiresIn, "3600");
  for (const k of ["localId", "idToken", "refreshToken"]) assert.equal(typeof first.json[k], "string");
  assert.ok(server.users().includes(first.json.localId));

  const again = await idp(server, code("p-1", "Gamer One", 2));
  assert.equal(again.status, 200);
  assert.equal(again.json.isNewUser, false);
  assert.equal(again.json.localId, first.json.localId);
  assert.notEqual(again.json.idToken, first.json.idToken);

  // The minted tokens work for refresh like any other account's.
  const refreshed = await server.fetchFn(
    `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_CONFIG.apiKey}`,
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: `grant_type=refresh_token&refresh_token=${again.json.refreshToken}` },
  );
  assert.equal(refreshed.status, 200);
  assert.equal((await refreshed.json()).user_id, first.json.localId);
});

test("signInWithIdp: the code works with the fake PlayIdentity's serverAuthCode", async () => {
  const server = makeServer();
  const play = createFakePlayIdentity({ playerId: "pid/9", displayName: "Zoë & Co" });
  const c = await play.serverAuthCode({ serverClientId: "x" });
  const r = await idp(server, c.authCode);
  assert.equal(r.status, 200);
  assert.equal(r.json.federatedId, "pid/9");
  assert.equal(r.json.displayName, "Zoë & Co");
});

test("signInWithIdp: with the idToken of an anonymous account the player is linked and the uid is kept", async () => {
  const server = makeServer();
  const anon = await signUp(server);
  const r = await idp(server, code("p-2", "Linked Soul"), { idToken: anon.idToken });
  assert.equal(r.status, 200);
  assert.equal(r.json.localId, anon.uid);
  assert.equal(r.json.isNewUser, false);
  const looked = await lookup(server, r.json.idToken);
  assert.equal(looked.json.users[0].providerUserInfo[0].providerId, PROVIDER);
});

test("signInWithIdp: linkKeepsUid false returns a new uid instead (spike gate G3 failing)", async () => {
  const server = makeServer({ linkKeepsUid: false });
  const anon = await signUp(server);
  const r = await idp(server, code("p-2", "Linked Soul"), { idToken: anon.idToken });
  assert.equal(r.status, 200);
  assert.notEqual(r.json.localId, anon.uid);
  assert.deepEqual(server.providers(anon.uid), []);
  assert.equal(server.providers(r.json.localId).length, 1);
});

test("signInWithIdp: linked to another uid answers FEDERATED_USER_ID_ALREADY_LINKED, 200 with returnIdpCredential and no tokens", async () => {
  const server = makeServer();
  const home = await idp(server, code("p-3", "Home Base", 1));
  const anon = await signUp(server);
  const r = await idp(server, code("p-3", "Home Base", 2), { idToken: anon.idToken });
  assert.equal(r.status, 200);
  assert.equal(r.json.errorMessage, "FEDERATED_USER_ID_ALREADY_LINKED");
  assert.equal(r.json.providerId, PROVIDER);
  assert.equal(r.json.federatedId, "p-3");
  assert.equal(r.json.idToken, undefined);
  assert.equal(r.json.refreshToken, undefined);
  assert.equal(r.json.localId, undefined);
  // The anonymous account stays unlinked; the home account is untouched.
  assert.deepEqual(server.providers(anon.uid), []);
  assert.equal(server.providers(home.json.localId).length, 1);
});

test("signInWithIdp: ALREADY_LINKED without returnIdpCredential is a 400 with that message", async () => {
  const server = makeServer();
  await idp(server, code("p-3", "Home Base", 1));
  const anon = await signUp(server);
  const r = await idp(server, code("p-3", "Home Base", 2), { idToken: anon.idToken, returnIdpCredential: false });
  assert.equal(r.status, 400);
  assert.equal(r.json.error.message, "FEDERATED_USER_ID_ALREADY_LINKED");
});

test("signInWithIdp: a reused code, a non-fake code and a bad idToken are refused; a disabled provider is OPERATION_NOT_ALLOWED", async () => {
  const server = makeServer();
  const c = code("p-4", "One Shot", 1);
  assert.equal((await idp(server, c)).status, 200);
  const reused = await idp(server, c);
  assert.equal(reused.status, 400);
  assert.equal(reused.json.error.message, "INVALID_IDP_RESPONSE");
  const junk = await idp(server, "4/0AbCdEf-real-looking-code");
  assert.equal(junk.status, 400);
  assert.equal(junk.json.error.message, "INVALID_IDP_RESPONSE");
  const badToken = await idp(server, code("p-4", "One Shot", 2), { idToken: "nope" });
  assert.equal(badToken.status, 400);
  assert.equal(badToken.json.error.message, "INVALID_ID_TOKEN");

  const off = makeServer({ playGamesEnabled: false });
  const refused = await idp(off, code("p-4", "One Shot", 1));
  assert.equal(refused.status, 400);
  assert.equal(refused.json.error.message, "OPERATION_NOT_ALLOWED");
  assert.deepEqual(off.users(), []);
});

test("signInWithIdp: a re-sign-in with a new displayName refreshes the provider name only when refreshProviderName is true (G2)", async () => {
  for (const refresh of [true, false]) {
    const server = makeServer({ refreshProviderName: refresh });
    const a = await idp(server, code("p-5", "Old Name", 1));
    const b = await idp(server, code("p-5", "New Name", 2));
    assert.equal(b.json.localId, a.json.localId);
    const looked = await lookup(server, b.json.idToken);
    assert.equal(looked.json.users[0].providerUserInfo[0].displayName, refresh ? "New Name" : "Old Name", `refresh=${refresh}`);
  }
});

test("signInWithIdp: an expired idToken answers TOKEN_EXPIRED", async () => {
  let t = NOW_MS;
  const server = createFakeBoardFetch({ now: () => t, tokenTtlMs: 1000 });
  const anon = await signUp(server);
  t += 5000;
  const r = await idp(server, code("p-6", "Late"), { idToken: anon.idToken });
  assert.equal(r.status, 400);
  assert.equal(r.json.error.message, "TOKEN_EXPIRED");
});

test("identity endpoints need the API key like the real ones", async () => {
  const server = makeServer();
  const res = await server.fetchFn(`${IDENTITY_BASE}/accounts:lookup`, jsonInit("POST", { idToken: "x" }));
  assert.equal(res.status, 400);
});

/* ---------------- accounts:lookup ---------------- */

test("accounts:lookup returns providerUserInfo; an anonymous account has an empty list; bad and expired tokens are refused", async () => {
  const server = makeServer();
  const linked = await idp(server, code("p-7", "Lookup Me"));
  const looked = await lookup(server, linked.json.idToken);
  assert.equal(looked.status, 200);
  const user = looked.json.users[0];
  assert.equal(user.localId, linked.json.localId);
  assert.deepEqual(user.providerUserInfo, [
    { providerId: PROVIDER, rawId: "p-7", federatedId: "p-7", displayName: "Lookup Me" },
  ]);

  const anon = await signUp(server);
  const anonLook = await lookup(server, anon.idToken);
  assert.deepEqual(anonLook.json.users[0].providerUserInfo, []);

  const bad = await lookup(server, "nope");
  assert.equal(bad.status, 400);
  assert.equal(bad.json.error.message, "INVALID_ID_TOKEN");

  let t = NOW_MS;
  const slow = createFakeBoardFetch({ now: () => t, tokenTtlMs: 1000 });
  const s = await signUp(slow);
  t += 5000;
  const expired = await lookup(slow, s.idToken);
  assert.equal(expired.status, 400);
  assert.equal(expired.json.error.message, "TOKEN_EXPIRED");
});

/* ---------------- accounts:update / delete ---------------- */

test("accounts:update displayName changes only the top-level displayName, never the provider's", async () => {
  const server = makeServer();
  const linked = await idp(server, code("p-8", "Gamer Name"));
  const r = await update(server, { idToken: linked.json.idToken, displayName: "Real Name" });
  assert.equal(r.status, 200);
  assert.equal(r.json.localId, linked.json.localId);
  assert.equal(r.json.providerUserInfo[0].displayName, "Gamer Name");
  const looked = await lookup(server, linked.json.idToken);
  assert.equal(looked.json.users[0].displayName, "Real Name");
  assert.equal(looked.json.users[0].providerUserInfo[0].displayName, "Gamer Name");

  const cleared = await update(server, { idToken: linked.json.idToken, deleteAttribute: ["DISPLAY_NAME"] });
  assert.equal(cleared.status, 200);
  const after = await lookup(server, linked.json.idToken);
  assert.equal(after.json.users[0].displayName, undefined);
  assert.equal(after.json.users[0].providerUserInfo[0].displayName, "Gamer Name");
});

test("accounts:update refuses linkProviderUserInfo with ADMIN_ONLY_OPERATION and changes nothing", async () => {
  const server = makeServer();
  const linked = await idp(server, code("p-8", "Gamer Name"));
  const r = await update(server, {
    idToken: linked.json.idToken,
    linkProviderUserInfo: { providerId: PROVIDER, rawId: "p-8", displayName: "Hacked" },
  });
  assert.equal(r.status, 400);
  assert.equal(r.json.error.message, "ADMIN_ONLY_OPERATION");
  assert.equal(server.providers(linked.json.localId)[0].displayName, "Gamer Name");
  const bad = await update(server, { idToken: "nope", displayName: "x" });
  assert.equal(bad.status, 400);
  assert.equal(bad.json.error.message, "INVALID_ID_TOKEN");
});

test("accounts:update deleteProvider unlinks and frees the player for another link", async () => {
  const server = makeServer();
  const a = await idp(server, code("p-9", "Free Me", 1));
  const unlinked = await update(server, { idToken: a.json.idToken, deleteProvider: [PROVIDER] });
  assert.equal(unlinked.status, 200);
  assert.deepEqual(unlinked.json.providerUserInfo, []);
  assert.deepEqual(server.providers(a.json.localId), []);

  const anon = await signUp(server);
  const relink = await idp(server, code("p-9", "Free Me", 2), { idToken: anon.idToken });
  assert.equal(relink.status, 200);
  assert.equal(relink.json.localId, anon.uid);
});

test("accounts:delete frees the player's link", async () => {
  const server = makeServer();
  const a = await idp(server, code("p-10", "Gone", 1));
  const del = await call(server, idUrl("delete"), jsonInit("POST", { idToken: a.json.idToken }));
  assert.equal(del.status, 200);
  assert.ok(!server.users().includes(a.json.localId));
  const again = await idp(server, code("p-10", "Gone", 2));
  assert.equal(again.status, 200);
  assert.equal(again.json.isNewUser, true);
  assert.notEqual(again.json.localId, a.json.localId);
});

test("providers(uid) is frozen and users() still lists plain uids", async () => {
  const server = makeServer();
  const a = await idp(server, code("p-11", "Frozen"));
  assert.ok(Object.isFrozen(server.providers(a.json.localId)));
  assert.ok(Object.isFrozen(server.users()));
  assert.deepEqual(server.users(), [a.json.localId]);
  assert.deepEqual(server.providers("nobody"), []);
});

/* ---------------- names / nameOverrides ---------------- */

test("names and nameOverrides: admin GET / PATCH / DELETE work and the inspectors reflect the store", async () => {
  const server = makeServer();
  const miss = await fsAdmin(server, "GET", "names", "u1");
  assert.equal(miss.status, 404);

  const put = await fsAdmin(server, "PATCH", "names", "u1", {
    fields: { name: { stringValue: "Gamer One" }, updatedAt: { timestampValue: "2026-10-01T00:00:00.000Z" } },
  });
  assert.equal(put.status, 200);
  const got = await fsAdmin(server, "GET", "names", "u1");
  assert.equal(got.status, 200);
  assert.equal(got.json.name, docName(FIREBASE_CONFIG, "names", "u1"));
  assert.deepEqual(fromFirestoreFields(got.json.fields), { name: "Gamer One", updatedAt: "2026-10-01T00:00:00.000Z" });
  assert.deepEqual(server.names(), [{ uid: "u1", name: "Gamer One" }]);

  await fsAdmin(server, "PATCH", "nameOverrides", "u1", {
    fields: { name: { stringValue: "Sir Override" }, at: { timestampValue: "2026-10-01T00:00:00.000Z" } },
  });
  assert.deepEqual(server.overrides(), [{ uid: "u1", name: "Sir Override" }]);

  assert.equal((await fsAdmin(server, "DELETE", "names", "u1")).status, 200);
  assert.equal((await fsAdmin(server, "DELETE", "nameOverrides", "u1")).status, 200);
  assert.deepEqual(server.names(), []);
  assert.deepEqual(server.overrides(), []);
  assert.equal((await fsAdmin(server, "GET", "nameOverrides", "u1")).status, 404);

  server.setName("u2", "Seeded");
  server.setOverride("u2", "Seeded Over");
  assert.deepEqual(server.names(), [{ uid: "u2", name: "Seeded" }]);
  assert.deepEqual(server.overrides(), [{ uid: "u2", name: "Seeded Over" }]);
  assert.ok(Object.isFrozen(server.names()));
  assert.ok(Object.isFrozen(server.overrides()));
  const seeded = await fsAdmin(server, "GET", "names", "u2");
  assert.equal(fromFirestoreFields(seeded.json.fields).name, "Seeded");
});

test("names and nameOverrides are closed to every client and to anonymous callers", async () => {
  const server = makeServer();
  server.setName("u1", "Hidden");
  server.setOverride("u1", "Hidden Too");
  const anon = await signUp(server);
  const body = { fields: { name: { stringValue: "Forged" } } };
  for (const collection of ["names", "nameOverrides"]) {
    for (const token of [anon.idToken, undefined]) {
      for (const method of ["GET", "PATCH", "DELETE"]) {
        const r = await call(server, docUrl(collection, "u1"), jsonInit(method, method === "PATCH" ? body : undefined, token));
        assert.equal(r.status, 403, `${collection} ${method} ${token ? "user" : "none"}`);
      }
      const list = await call(server, firestoreUrl(FIREBASE_CONFIG, `/${collection}`), jsonInit("GET", undefined, token));
      assert.equal(list.status, 403);
    }
    // A client query on the collection is denied too.
    const q = await call(
      server,
      firestoreUrl(FIREBASE_CONFIG, ":runQuery"),
      jsonInit("POST", { structuredQuery: { from: [{ collectionId: collection }], limit: 10 } }, anon.idToken),
    );
    assert.equal(q.status, 403);
  }
  assert.deepEqual(server.names(), [{ uid: "u1", name: "Hidden" }]);
  assert.deepEqual(server.overrides(), [{ uid: "u1", name: "Hidden Too" }]);
});

test("names: a client :commit cannot write them either", async () => {
  const server = makeServer();
  const anon = await signUp(server);
  const r = await call(
    server,
    firestoreUrl(FIREBASE_CONFIG, ":commit"),
    jsonInit("POST", { writes: [{ update: { name: docName(FIREBASE_CONFIG, "names", anon.uid), fields: { name: { stringValue: "Forged" } } } }] }, anon.idToken),
  );
  assert.equal(r.status, 403);
  assert.deepEqual(server.names(), []);
});

/* ---------------- admin runQuery over runs and names ---------------- */

async function adminQuery(server, structuredQuery) {
  const r = await call(server, firestoreUrl(FIREBASE_CONFIG, ":runQuery"), jsonInit("POST", { structuredQuery }, FAKE_ADMIN_TOKEN));
  assert.equal(r.status, 200);
  return r.json.filter((row) => row.document).map((row) => row.document);
}

const uidFilter = (uid) => ({ fieldFilter: { field: { fieldPath: "uid" }, op: "EQUAL", value: { stringValue: uid } } });

test("admin :runQuery over runs: uid == filter, __name__ order, a startAt cursor and no client limit", async () => {
  const runs = [];
  for (let i = 0; i < 5; i++) runs.push(runSeed("uidA", `h${i}`));
  runs.push(runSeed("uidB", "hz"));
  const server = makeServer({ runs });
  const all = await adminQuery(server, {
    from: [{ collectionId: "runs" }],
    where: uidFilter("uidA"),
    orderBy: [{ field: { fieldPath: "__name__" }, direction: "ASCENDING" }],
  });
  assert.equal(all.length, 5);
  const names = all.map((d) => d.name);
  assert.deepEqual(names, [...names].sort());

  const page = await adminQuery(server, {
    from: [{ collectionId: "runs" }],
    where: uidFilter("uidA"),
    orderBy: [{ field: { fieldPath: "__name__" }, direction: "ASCENDING" }],
    limit: 2,
  });
  assert.equal(page.length, 2);
  const next = await adminQuery(server, {
    from: [{ collectionId: "runs" }],
    where: uidFilter("uidA"),
    orderBy: [{ field: { fieldPath: "__name__" }, direction: "ASCENDING" }],
    startAt: { values: [{ referenceValue: page[1].name }], before: false },
    limit: 2,
  });
  assert.deepEqual(next.map((d) => d.name), names.slice(2, 4));
});

test("admin :runQuery over names lists the stored records", async () => {
  const server = makeServer();
  server.setName("u1", "First");
  server.setName("u2", "Second");
  const docs = await adminQuery(server, {
    from: [{ collectionId: "names" }],
    orderBy: [{ field: { fieldPath: "__name__" }, direction: "ASCENDING" }],
  });
  assert.deepEqual(docs.map((d) => fromFirestoreFields(d.fields).name), ["First", "Second"]);
  assert.equal(docs[0].name, docName(FIREBASE_CONFIG, "names", "u1"));
});

/* ---------------- admin :commit over runs ---------------- */

const commit = (server, writes, token = FAKE_ADMIN_TOKEN) =>
  call(server, firestoreUrl(FIREBASE_CONFIG, ":commit"), jsonInit("POST", { writes }, token));

const runName = (id) => docName(FIREBASE_CONFIG, "runs", id);

test("admin :commit: a masked update changes only the masked field, with the exists precondition", async () => {
  const s = runSeed("uidA", "h1");
  const server = makeServer({ runs: [s] });
  const r = await commit(server, [
    { update: { name: runName(s.id), fields: { handle: { stringValue: "Play Name" } } }, updateMask: { fieldPaths: ["handle"] }, currentDocument: { exists: true } },
  ]);
  assert.equal(r.status, 200);
  const doc = server.docs().find((d) => d.id === s.id);
  assert.equal(doc.handle, "Play Name");
  assert.equal(doc.floor, s.doc.floor);
  assert.equal(doc.deepKey, s.doc.deepKey);

  const missing = await commit(server, [
    { update: { name: runName("nope_h9"), fields: { handle: { stringValue: "X" } } }, updateMask: { fieldPaths: ["handle"] }, currentDocument: { exists: true } },
  ]);
  assert.equal(missing.status, 404);
  assert.equal(server.docs().length, 1);
});

test("admin :commit: an update without a mask plus a delete in one commit is atomic (the adopt shape)", async () => {
  const src = runSeed("uidAnon", "h1");
  const server = makeServer({ runs: [src] });
  const toId = runDocId("uidReal", "h1");
  const fields = { ...toFirestoreFields({ ...src.doc, uid: "uidReal", handle: "Play Name" }), createdAt: { timestampValue: "2026-09-20T10:00:00.000Z" } };
  const ok = await commit(server, [{ update: { name: runName(toId), fields } }, { delete: runName(src.id) }]);
  assert.equal(ok.status, 200);
  const docs = server.docs();
  assert.equal(docs.length, 1);
  assert.equal(docs[0].id, toId);
  assert.equal(docs[0].uid, "uidReal");
  assert.equal(docs[0].handle, "Play Name");
  assert.equal(docs[0].createdAt, "2026-09-20T10:00:00.000Z");

  // A later write that fails (exists precondition on a missing doc) rolls the whole commit back.
  const before = JSON.stringify(server.docs());
  const bad = await commit(server, [
    { delete: runName(toId) },
    { update: { name: runName("ghost_h1"), fields: { handle: { stringValue: "X" } } }, updateMask: { fieldPaths: ["handle"] }, currentDocument: { exists: true } },
  ]);
  assert.equal(bad.status, 404);
  assert.equal(JSON.stringify(server.docs()), before);
});

test("admin :commit: deletes and creates apply without client rules; a client still cannot", async () => {
  const s = runSeed("uidA", "h1");
  const server = makeServer({ runs: [s] });
  const created = runSeed("uidA", "h2", { handle: "Play Name" });
  const r = await commit(server, [
    { update: { name: runName(created.id), fields: toFirestoreFields(created.doc) }, currentDocument: { exists: false } },
    { delete: runName(s.id) },
  ]);
  assert.equal(r.status, 200);
  assert.deepEqual(server.docs().map((d) => d.id), [created.id]);

  const anon = await signUp(server);
  const denied = await commit(
    server,
    [{ update: { name: runName(created.id), fields: { handle: { stringValue: "Stolen" } } }, updateMask: { fieldPaths: ["handle"] } }],
    anon.idToken,
  );
  assert.equal(denied.status, 403);
  assert.equal(server.docs()[0].handle, "Play Name");
});

test("admin :commit refuses more than 500 writes like the real API", async () => {
  const server = makeServer();
  const writes = Array.from({ length: 501 }, (_, i) => ({ delete: runName(`x_${i}`) }));
  const r = await commit(server, writes);
  assert.equal(r.status, 400);
});
