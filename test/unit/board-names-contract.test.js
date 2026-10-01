// test/unit/board-names-contract.test.js
//
// Phase 91.2-03 Task 2. The guard on the fake board server's hand-written
// boardName emulation (T-91.2-11): one scenario table is run through
//   A  the REAL function core (functions/board-names/core.js), pointed at the
//      fake as its Google (Identity Toolkit, Firestore REST, OAuth, Games API)
//      with FAKE_ADMIN_TOKEN as its service-account token,
//   B  a raw POST to the fake's own BOARD_NAME_FN.url endpoint,
//   C  the same endpoint through createNameClient (the shipped client), and
//   D  the real HTTP handler (functions/board-names/index.js#createHandler)
//      over the core, through createNameClient,
// each on a fresh, identically-seeded fake. A and B must give the same status,
// body and stored state (names, overrides, every run document); C and D must
// give the client the same answer. Any divergence between the emulation and the
// core fails here; update both together.

import test from "node:test";
import assert from "node:assert/strict";

import { BOARD_NAME_FN, FIREBASE_CONFIG } from "../../src/browser/firebaseConfig.js";
import { IDENTITY_BASE, firestoreUrl } from "../../src/browser/firestoreRest.js";
import { runDocId } from "../../src/browser/runDoc.js";
import { createNameClient } from "../../src/browser/nameClient.js";
import { FAKE_ADMIN_TOKEN, createFakeBoardFetch } from "../../src/browser/fakeBoardServer.js";
import { createBoardNameCore } from "../../functions/board-names/core.js";
import { createHandler } from "../../functions/board-names/index.js";

const PROVIDER = "playgames.google.com";
const NOW_MS = Date.parse("2026-10-01T12:00:00.000Z");
const FIRST_UID = "fakeuid000001";
const OLD_STAMP = "2020-01-01T00:00:00.000Z";

/* ---------------- fake-side helpers ---------------- */

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

async function post(fake, url, body) {
  const res = await fake.fetchFn(url, jsonInit("POST", body));
  return { status: res.status, json: await res.json() };
}

async function anonymous(fake) {
  const r = await post(fake, idUrl("signUp"), { returnSecureToken: true });
  return { uid: r.json.localId, idToken: r.json.idToken };
}

async function linked(fake, playerId, displayName, n = 1, extra = {}) {
  const r = await post(fake, idUrl("signInWithIdp"), {
    requestUri: "http://localhost",
    postBody: `code=${encodeURIComponent(code(playerId, displayName, n))}&providerId=${PROVIDER}`,
    returnSecureToken: true,
    returnIdpCredential: true,
    ...extra,
  });
  assert.equal(r.status, 200, `sign-in as ${playerId}`);
  return { uid: r.json.localId, idToken: r.json.idToken };
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
    // the shipped 2.2.0 formula, so a recomputed deepKey visibly differs
    deepKey: floor * 1000000 + (999999 - steps),
    daysKey: 4003,
    killsKey: 9003,
    goldKey: 77,
    createdAt: "2026-09-20T10:00:00.000Z",
    ...over,
  };
  return { id: runDocId(uid, hash), doc };
}

async function adminPatch(fake, collection, uid, fields) {
  const res = await fake.fetchFn(firestoreUrl(FIREBASE_CONFIG, `/${collection}/${uid}`), jsonInit("PATCH", { fields }, FAKE_ADMIN_TOKEN));
  assert.equal(res.status, 200);
}

async function adminList(fake, collection) {
  const res = await fake.fetchFn(firestoreUrl(FIREBASE_CONFIG, `/${collection}`), jsonInit("GET", undefined, FAKE_ADMIN_TOKEN));
  const json = await res.json();
  const docs = Array.isArray(json.documents) ? json.documents : [];
  return docs.map((d) => ({ name: d.name, fields: d.fields })).sort((a, b) => (a.name < b.name ? -1 : 1));
}

// Everything the function is allowed to change, as plain data.
async function snapshot(fake) {
  const runs = [...fake.docs()].sort((a, b) => (a.id < b.id ? -1 : 1));
  return { names: await adminList(fake, "names"), overrides: await adminList(fake, "nameOverrides"), runs };
}

/* ---------------- the four paths ---------------- */

function newFake(scenario) {
  return createFakeBoardFetch({ now: () => NOW_MS, runs: scenario.runs ?? [], ...(scenario.options ?? {}) });
}

function newCore(fake, scenario) {
  return createBoardNameCore({
    fetchFn: fake.fetchFn,
    getAdminToken: async () => FAKE_ADMIN_TOKEN,
    projectId: FIREBASE_CONFIG.projectId,
    apiKey: FIREBASE_CONFIG.apiKey,
    nameSource: scenario.options?.nameSource === "games" ? "games" : "provider",
    pgsClientId: "fake-client-id",
    pgsClientSecret: "fake-client-secret",
    now: () => NOW_MS,
  });
}

// An Express-shaped (req, res) harness around createHandler, as a fetchFn.
function handlerFetch(handler) {
  return async (_url, init = {}) => {
    const headers = {};
    for (const [k, v] of Object.entries(init.headers ?? {})) headers[k.toLowerCase()] = v;
    const out = { code: 200, headers: {}, body: "" };
    const res = {
      status(c) {
        out.code = c;
        return res;
      },
      set(k, v) {
        out.headers[k.toLowerCase()] = v;
        return res;
      },
      send(b) {
        out.body = b;
      },
    };
    await handler({ method: init.method ?? "GET", headers, body: init.body }, res);
    return {
      ok: out.code >= 200 && out.code < 300,
      status: out.code,
      headers: { get: (k) => out.headers[String(k).toLowerCase()] ?? null },
      json: async () => JSON.parse(out.body),
      text: async () => out.body,
    };
  };
}

function bodyFor(op, ctx) {
  const body = { op };
  if (ctx.adoptIdToken !== undefined) body.adoptIdToken = ctx.adoptIdToken;
  if (ctx.gamesAuthCode !== undefined) body.gamesAuthCode = ctx.gamesAuthCode;
  return body;
}

// A: the real core against the fake.
async function pathCore(scenario) {
  const fake = newFake(scenario);
  const ctx = await scenario.setup(fake);
  const core = newCore(fake, scenario);
  const op = scenario.op ?? "claim";
  const r = op === "release" ? await core.release({ idToken: ctx.idToken }) : await core.claim({ idToken: ctx.idToken, adoptIdToken: ctx.adoptIdToken, gamesAuthCode: ctx.gamesAuthCode });
  return { status: r.status, body: r.body, state: await snapshot(fake) };
}

// B: a raw POST to the fake's endpoint.
async function pathEndpoint(scenario) {
  const fake = newFake(scenario);
  const ctx = await scenario.setup(fake);
  const res = await fake.fetchFn(BOARD_NAME_FN.url, jsonInit("POST", bodyFor(scenario.op ?? "claim", ctx), ctx.idToken));
  return { status: res.status, body: await res.json(), state: await snapshot(fake) };
}

async function clientCall(client, scenario, ctx) {
  const op = scenario.op ?? "claim";
  return op === "release" ? client.release({ idToken: ctx.idToken }) : client.claim({ idToken: ctx.idToken, adoptIdToken: ctx.adoptIdToken, gamesAuthCode: ctx.gamesAuthCode });
}

// C: the shipped client over the fake's endpoint.
async function pathClientOnFake(scenario) {
  const fake = newFake(scenario);
  const ctx = await scenario.setup(fake);
  const client = createNameClient({ fetchFn: fake.fetchFn, fn: BOARD_NAME_FN });
  return { result: await clientCall(client, scenario, ctx), state: await snapshot(fake) };
}

// D: the shipped client over the real handler and core.
async function pathClientOnHandler(scenario) {
  const fake = newFake(scenario);
  const ctx = await scenario.setup(fake);
  const handler = createHandler({ core: newCore(fake, scenario) });
  const client = createNameClient({ fetchFn: handlerFetch(handler), fn: BOARD_NAME_FN });
  return { result: await clientCall(client, scenario, ctx), state: await snapshot(fake) };
}

/* ---------------- the scenario table ---------------- */

const twoOldRuns = [runSeed(FIRST_UID, "aaaa1111"), runSeed(FIRST_UID, "bbbb2222", { floor: 5, steps: 300 })];

function manyRuns(uid, n) {
  return Array.from({ length: n }, (_, i) => runSeed(uid, `h${String(i).padStart(4, "0")}`, { floor: 1 + (i % 7), steps: 100 + i }));
}

const SCENARIOS = [
  {
    id: "first claim stamps both seeded @handle runs",
    runs: twoOldRuns,
    setup: async (fake) => ({ idToken: (await linked(fake, "p-1", "Gamer One")).idToken }),
    expect: { status: 200, body: { ok: true, name: "Gamer One", overridden: false, stamped: 2, adopted: 0 } },
  },
  {
    id: "repeat claim: names untouched, only the stale run is stamped",
    runs: [runSeed(FIRST_UID, "aaaa1111", { handle: "Gamer One" }), runSeed(FIRST_UID, "bbbb2222", { handle: "Gamer One" }), runSeed(FIRST_UID, "cccc3333", { handle: "@stale" })],
    setup: async (fake) => {
      const who = await linked(fake, "p-1", "Gamer One");
      await adminPatch(fake, "names", who.uid, { name: { stringValue: "Gamer One" }, updatedAt: { timestampValue: OLD_STAMP } });
      return { idToken: who.idToken };
    },
    expect: { status: 200, body: { ok: true, name: "Gamer One", overridden: false, stamped: 1, adopted: 0 } },
  },
  {
    id: "repeat claim with nothing to stamp writes nothing",
    runs: [runSeed(FIRST_UID, "aaaa1111", { handle: "Gamer One" })],
    setup: async (fake) => {
      const who = await linked(fake, "p-1", "Gamer One");
      await adminPatch(fake, "names", who.uid, { name: { stringValue: "Gamer One" }, updatedAt: { timestampValue: OLD_STAMP } });
      return { idToken: who.idToken };
    },
    expect: { status: 200, body: { ok: true, name: "Gamer One", overridden: false, stamped: 0, adopted: 0 } },
  },
  {
    id: "a changed provider name rewrites the name and restamps",
    runs: [runSeed(FIRST_UID, "aaaa1111", { handle: "Old Name" })],
    setup: async (fake) => {
      const who = await linked(fake, "p-1", "New Name");
      await adminPatch(fake, "names", who.uid, { name: { stringValue: "Old Name" }, updatedAt: { timestampValue: OLD_STAMP } });
      return { idToken: who.idToken };
    },
    expect: { status: 200, body: { ok: true, name: "New Name", overridden: false, stamped: 1, adopted: 0 } },
  },
  {
    id: "an anonymous caller is NOT_LINKED and nothing is written",
    runs: twoOldRuns,
    setup: async (fake) => ({ idToken: (await anonymous(fake)).idToken }),
    expect: { status: 403, body: { ok: false, error: "NOT_LINKED" } },
  },
  {
    id: "an invalid token is UNAUTHENTICATED",
    runs: twoOldRuns,
    setup: async () => ({ idToken: "not-a-token" }),
    expect: { status: 401, body: { ok: false, error: "UNAUTHENTICATED" } },
  },
  {
    id: "an override wins and is the stamped name",
    runs: twoOldRuns,
    setup: async (fake) => {
      const who = await linked(fake, "p-1", "Gamer One");
      fake.setOverride(who.uid, "Sir Override");
      return { idToken: who.idToken };
    },
    expect: { status: 200, body: { ok: true, name: "Sir Override", overridden: true, stamped: 2, adopted: 0 } },
  },
  {
    id: "an override that cleans to nothing falls back to the provider name",
    runs: twoOldRuns,
    setup: async (fake) => {
      const who = await linked(fake, "p-1", "Gamer One");
      fake.setOverride(who.uid, "   ");
      return { idToken: who.idToken };
    },
    expect: { status: 200, body: { ok: true, name: "Gamer One", overridden: false, stamped: 2, adopted: 0 } },
  },
  {
    id: "a whitespace-only provider name is NO_NAME",
    runs: twoOldRuns,
    setup: async (fake) => ({ idToken: (await linked(fake, "p-1", "   ")).idToken }),
    expect: { status: 422, body: { ok: false, error: "NO_NAME" } },
  },
  {
    id: "the provider name is sanitized (format characters, whitespace runs)",
    runs: twoOldRuns,
    setup: async (fake) => ({ idToken: (await linked(fake, "p-1", "  Zoë​   The \t Great  ")).idToken }),
    expect: { status: 200, body: { ok: true, name: "Zoë The Great", overridden: false, stamped: 2, adopted: 0 } },
  },
  {
    id: "a long name is cut to 64 without splitting a surrogate pair",
    runs: [runSeed(FIRST_UID, "aaaa1111")],
    setup: async (fake) => ({ idToken: (await linked(fake, "p-1", `${"x".repeat(63)}\u{1F600}tail`)).idToken }),
    expect: { status: 200, body: { ok: true, name: "x".repeat(63), overridden: false, stamped: 1, adopted: 0 } },
  },
  {
    id: "adopt moves three anonymous runs onto the linked uid",
    runs: [runSeed(FIRST_UID, "aaaa1111"), runSeed(FIRST_UID, "bbbb2222", { floor: 5, steps: 300 }), runSeed(FIRST_UID, "cccc3333", { floor: 9, steps: 4 }), runSeed("someone-else", "dddd4444")],
    setup: async (fake) => {
      const anon = await anonymous(fake);
      const who = await linked(fake, "p-1", "Gamer One");
      return { idToken: who.idToken, adoptIdToken: anon.idToken };
    },
    expect: { status: 200, body: { ok: true, name: "Gamer One", overridden: false, stamped: 0, adopted: 3 } },
  },
  {
    id: "adopt across the core's query pages (301 runs: two pages, two commits)",
    runs: manyRuns(FIRST_UID, 301),
    setup: async (fake) => {
      const anon = await anonymous(fake);
      const who = await linked(fake, "p-1", "Gamer One");
      return { idToken: who.idToken, adoptIdToken: anon.idToken };
    },
    expect: { status: 200, body: { ok: true, name: "Gamer One", overridden: false, stamped: 0, adopted: 301 } },
  },
  {
    id: "adopt skips a run whose hash is malformed and leaves it where it was",
    runs: [runSeed(FIRST_UID, "aaaa1111"), runSeed(FIRST_UID, "bad-hash!")],
    setup: async (fake) => {
      const anon = await anonymous(fake);
      const who = await linked(fake, "p-1", "Gamer One");
      return { idToken: who.idToken, adoptIdToken: anon.idToken };
    },
    expect: { status: 200, body: { ok: true, name: "Gamer One", overridden: false, stamped: 0, adopted: 1 } },
  },
  {
    id: "adopt with the caller's own token is refused",
    runs: twoOldRuns,
    setup: async (fake) => {
      const who = await linked(fake, "p-1", "Gamer One");
      return { idToken: who.idToken, adoptIdToken: who.idToken };
    },
    expect: { status: 403, body: { ok: false, error: "ADOPT_REFUSED" } },
  },
  {
    id: "adopt from a linked source is refused",
    runs: twoOldRuns,
    setup: async (fake) => {
      const source = await linked(fake, "p-2", "Other Gamer");
      const who = await linked(fake, "p-1", "Gamer One");
      return { idToken: who.idToken, adoptIdToken: source.idToken };
    },
    expect: { status: 403, body: { ok: false, error: "ADOPT_REFUSED" } },
  },
  {
    id: "adopt with an invalid source token is refused",
    runs: twoOldRuns,
    setup: async (fake) => {
      const who = await linked(fake, "p-1", "Gamer One");
      return { idToken: who.idToken, adoptIdToken: "not-a-token" };
    },
    expect: { status: 403, body: { ok: false, error: "ADOPT_REFUSED" } },
  },
  {
    id: "release deletes the names doc",
    op: "release",
    runs: twoOldRuns,
    setup: async (fake) => {
      const who = await linked(fake, "p-1", "Gamer One");
      fake.setName(who.uid, "Gamer One");
      fake.setOverride(who.uid, "Kept Override");
      return { idToken: who.idToken };
    },
    expect: { status: 200, body: { ok: true, released: true } },
  },
  {
    id: "release works for an anonymous caller with no names doc",
    op: "release",
    setup: async (fake) => ({ idToken: (await anonymous(fake)).idToken }),
    expect: { status: 200, body: { ok: true, released: true } },
  },
  {
    id: "release with an invalid token is UNAUTHENTICATED",
    op: "release",
    setup: async () => ({ idToken: "not-a-token" }),
    expect: { status: 401, body: { ok: false, error: "UNAUTHENTICATED" } },
  },
  {
    id: "games source without a code is NEEDS_GAMES_CODE",
    options: { nameSource: "games" },
    runs: twoOldRuns,
    setup: async (fake) => ({ idToken: (await linked(fake, "p-1", "Provider Name", 1)).idToken }),
    expect: { status: 409, body: { ok: false, error: "NEEDS_GAMES_CODE" } },
  },
  {
    id: "games source with a matching code takes the name from the Games API",
    options: { nameSource: "games" },
    runs: twoOldRuns,
    setup: async (fake) => {
      const who = await linked(fake, "p-1", "Real Name Leak", 1);
      return { idToken: who.idToken, gamesAuthCode: code("p-1", "True Gamer Tag", 2) };
    },
    expect: { status: 200, body: { ok: true, name: "True Gamer Tag", overridden: false, stamped: 2, adopted: 0 } },
  },
  {
    id: "games source with another player's code is GAMES_MISMATCH",
    options: { nameSource: "games" },
    runs: twoOldRuns,
    setup: async (fake) => {
      const who = await linked(fake, "p-1", "Real Name Leak", 1);
      return { idToken: who.idToken, gamesAuthCode: code("p-9", "Someone Else", 2) };
    },
    expect: { status: 403, body: { ok: false, error: "GAMES_MISMATCH" } },
  },
  {
    id: "games source with a spent code is NEEDS_GAMES_CODE",
    options: { nameSource: "games" },
    runs: twoOldRuns,
    setup: async (fake) => {
      const who = await linked(fake, "p-1", "Real Name Leak", 1);
      // the sign-in already spent code number 1
      return { idToken: who.idToken, gamesAuthCode: code("p-1", "Real Name Leak", 1) };
    },
    expect: { status: 409, body: { ok: false, error: "NEEDS_GAMES_CODE" } },
  },
  {
    id: "games source with a code that is not a code is NEEDS_GAMES_CODE",
    options: { nameSource: "games" },
    setup: async (fake) => ({ idToken: (await linked(fake, "p-1", "Provider Name", 1)).idToken, gamesAuthCode: "4/not-a-fake-code" }),
    expect: { status: 409, body: { ok: false, error: "NEEDS_GAMES_CODE" } },
  },
  {
    id: "games source: an override needs no code",
    options: { nameSource: "games" },
    runs: twoOldRuns,
    setup: async (fake) => {
      const who = await linked(fake, "p-1", "Provider Name", 1);
      fake.setOverride(who.uid, "Sir Override");
      return { idToken: who.idToken };
    },
    expect: { status: 200, body: { ok: true, name: "Sir Override", overridden: true, stamped: 2, adopted: 0 } },
  },
  {
    id: "games source with a code whose Games name cleans to nothing is NO_NAME",
    options: { nameSource: "games" },
    setup: async (fake) => {
      const who = await linked(fake, "p-1", "Provider Name", 1);
      return { idToken: who.idToken, gamesAuthCode: code("p-1", "  ", 2) };
    },
    expect: { status: 422, body: { ok: false, error: "NO_NAME" } },
  },
];

for (const scenario of SCENARIOS) {
  test(`contract: ${scenario.id}`, async () => {
    const a = await pathCore(scenario);
    assert.equal(a.status, scenario.expect.status, "the core's own status (sanity of the scenario)");
    assert.deepEqual(a.body, scenario.expect.body, "the core's own body (sanity of the scenario)");

    // the fake endpoint equals the core: status, body, stored state
    const b = await pathEndpoint(scenario);
    assert.equal(b.status, a.status, "endpoint status");
    assert.deepEqual(b.body, a.body, "endpoint body");
    assert.deepEqual(b.state, a.state, "endpoint stored state");

    // the shipped client reads the fake endpoint exactly as it reads the real handler
    const c = await pathClientOnFake(scenario);
    const d = await pathClientOnHandler(scenario);
    assert.deepEqual(c.result, d.result, "client result");
    assert.deepEqual(c.state, d.state, "client-path stored state");
    assert.deepEqual(c.state, a.state, "client-path state equals the core's");
  });
}

test("contract: the scenario table covers every error code of the HTTP contract the core can answer", () => {
  const seen = new Set(SCENARIOS.map((s) => s.expect.body.error).filter(Boolean));
  for (const want of ["NOT_LINKED", "UNAUTHENTICATED", "NO_NAME", "ADOPT_REFUSED", "NEEDS_GAMES_CODE", "GAMES_MISMATCH"]) {
    assert.ok(seen.has(want), `a scenario answers ${want}`);
  }
});

test("contract: a scenario's adopt really moved runs (deepKey recomputed, createdAt kept, sources gone)", async () => {
  const scenario = SCENARIOS.find((s) => s.id.startsWith("adopt moves three"));
  const before = newFake(scenario);
  await scenario.setup(before);
  const after = await pathEndpoint(scenario);
  const names = after.state.runs.map((r) => r.id);
  assert.ok(names.every((id) => !id.startsWith(`${FIRST_UID}_`)), "the anonymous uid's runs are gone");
  const moved = after.state.runs.filter((r) => r.uid === "fakeuid000002");
  assert.equal(moved.length, 3);
  for (const r of moved) {
    assert.equal(r.handle, "Gamer One");
    assert.equal(r.deepKey, r.floor * 1000000 + r.steps);
    assert.equal(r.createdAt, "2026-09-20T10:00:00.000Z");
  }
  assert.equal(after.state.runs.filter((r) => r.uid === "someone-else").length, 1);
});

/* ---------------- the HTTP surface ---------------- */

// A fresh fake plus the real handler over the core on its own fake: same request, same answer.
async function httpPair(sendRaw) {
  const scenario = { setup: async (fake) => ({ idToken: (await linked(fake, "p-1", "Gamer One")).idToken }), runs: twoOldRuns };
  const fakeB = newFake(scenario);
  const ctxB = await scenario.setup(fakeB);
  const fakeD = newFake(scenario);
  const ctxD = await scenario.setup(fakeD);
  const handlerFetchFn = handlerFetch(createHandler({ core: newCore(fakeD, scenario) }));
  const b = await sendRaw(fakeB.fetchFn, ctxB.idToken);
  const d = await sendRaw(handlerFetchFn, ctxD.idToken);
  return { b, d, fakeB, fakeD };
}

async function raw(fetchFn, init) {
  const res = await fetchFn(BOARD_NAME_FN.url, init);
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json, origin: res.headers.get("access-control-allow-origin"), headers: res.headers };
}

const CASES = [
  ["OPTIONS", () => ({ method: "OPTIONS", headers: {} })],
  ["GET is 405", () => ({ method: "GET", headers: {} })],
  ["PUT is 405", () => ({ method: "PUT", headers: { Authorization: "Bearer x" }, body: "{}" })],
  ["POST without a bearer is 401", () => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "claim" }) })],
  ["POST with a malformed bearer is 401", () => ({ method: "POST", headers: { Authorization: "Token abc" }, body: JSON.stringify({ op: "claim" }) })],
  ["POST with a lower-case bearer scheme works", (t) => ({ method: "POST", headers: { authorization: `bearer ${t}` }, body: JSON.stringify({ op: "claim" }) })],
  ["POST with invalid JSON is 400", (t) => ({ method: "POST", headers: { Authorization: `Bearer ${t}` }, body: "{not json" })],
  ["POST with an array body is 400", (t) => ({ method: "POST", headers: { Authorization: `Bearer ${t}` }, body: "[]" })],
  ["POST with no body is 400", (t) => ({ method: "POST", headers: { Authorization: `Bearer ${t}` } })],
  ["POST with an unknown op is 400", (t) => ({ method: "POST", headers: { Authorization: `Bearer ${t}` }, body: JSON.stringify({ op: "rename", name: "Hax" }) })],
  ["POST with a numeric adoptIdToken is 400", (t) => ({ method: "POST", headers: { Authorization: `Bearer ${t}` }, body: JSON.stringify({ op: "claim", adoptIdToken: 7 }) })],
  ["POST with an oversized gamesAuthCode is 400", (t) => ({ method: "POST", headers: { Authorization: `Bearer ${t}` }, body: JSON.stringify({ op: "claim", gamesAuthCode: "z".repeat(9000) }) })],
  ["POST claim ignores a name in the body", (t) => ({ method: "POST", headers: { Authorization: `Bearer ${t}` }, body: JSON.stringify({ op: "claim", name: "Forged Name" }) })],
  ["POST with an oversized bearer is 401", () => ({ method: "POST", headers: { Authorization: `Bearer ${"t".repeat(9000)}` }, body: JSON.stringify({ op: "claim" }) })],
];

for (const [label, makeInit] of CASES) {
  test(`http: ${label} matches the real handler`, async () => {
    const { b, d, fakeB, fakeD } = await httpPair((fetchFn, token) => raw(fetchFn, makeInit(token)));
    assert.equal(b.status, d.status);
    assert.deepEqual(b.json, d.json);
    assert.equal(b.origin, "*", "every response carries the allow-origin header");
    for (const h of ["access-control-allow-origin", "access-control-allow-headers", "access-control-allow-methods", "access-control-max-age"]) {
      assert.equal(b.headers.get(h), d.headers.get(h), h);
    }
    assert.deepEqual(await snapshot(fakeB), await snapshot(fakeD));
  });
}

test("http: OPTIONS answers 204 with the four CORS headers", async () => {
  const fake = newFake({});
  const r = await raw(fake.fetchFn, { method: "OPTIONS", headers: {} });
  assert.equal(r.status, 204);
  assert.equal(r.headers.get("Access-Control-Allow-Origin"), "*");
  assert.equal(r.headers.get("Access-Control-Allow-Headers"), "Authorization, Content-Type");
  assert.equal(r.headers.get("Access-Control-Allow-Methods"), "POST, OPTIONS");
  assert.equal(r.headers.get("Access-Control-Max-Age"), "3600");
});

test("http: the endpoint needs no API key and works only at the exact function path", async () => {
  const fake = newFake({ runs: twoOldRuns });
  const who = await linked(fake, "p-1", "Gamer One");
  const init = jsonInit("POST", { op: "claim" }, who.idToken);
  const ok = await fake.fetchFn(BOARD_NAME_FN.url, init);
  assert.equal(ok.status, 200);
  const withQuery = await fake.fetchFn(`${BOARD_NAME_FN.url}?x=1`, init);
  assert.equal(withQuery.status, 200);
  const other = await fake.fetchFn(`${BOARD_NAME_FN.url}2`, init);
  assert.equal(other.status, 400, "any other path falls to the keyless-request refusal like every REST call");
});

test("http: the fake endpoint never answers with a token or a secret", async () => {
  const fake = newFake({ runs: twoOldRuns });
  const who = await linked(fake, "p-1", "Gamer One");
  const res = await fake.fetchFn(BOARD_NAME_FN.url, jsonInit("POST", { op: "claim" }, who.idToken));
  const text = await res.text();
  assert.ok(!text.includes(who.idToken));
  assert.ok(!/idtok|rtok|fake-admin-token/.test(text));
});

test("http: the Games API stand-ins answer only fake codes", async () => {
  const fake = newFake({});
  const bad = await fake.fetchFn("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "code=4%2Fnope&grant_type=authorization_code" });
  assert.equal(bad.status, 400);
  const first = await fake.fetchFn("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: `code=${encodeURIComponent(code("p-5", "Gamer Five", 1))}&grant_type=authorization_code` });
  assert.equal(first.status, 200);
  const { access_token: accessToken } = await first.json();
  const me = await fake.fetchFn("https://games.googleapis.com/games/v1/players/me", { method: "GET", headers: { Authorization: `Bearer ${accessToken}` } });
  assert.equal(me.status, 200);
  const player = await me.json();
  assert.equal(player.playerId, "p-5");
  assert.equal(player.displayName, "Gamer Five");
  const unauth = await fake.fetchFn("https://games.googleapis.com/games/v1/players/me", { method: "GET", headers: { Authorization: "Bearer nope" } });
  assert.equal(unauth.status, 401);
  // the exchange spent the code
  const again = await fake.fetchFn("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: `code=${encodeURIComponent(code("p-5", "Gamer Five", 1))}&grant_type=authorization_code` });
  assert.equal(again.status, 400);
});
