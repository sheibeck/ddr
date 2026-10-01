// test/unit/nameClient.test.js
//
// Phase 91.2-02 Task 2 (BOARD-31, D-01, D-06). src/browser/nameClient.js: the
// browser side of the boardName function over plain fetch, mapping every
// answer to a reason id and never surfacing a token. Also pins the client's
// sanitizeBoardName (src/browser/boardName.js) equal to the function's
// sanitizeName, so the two copies of the name rule cannot drift.

import test from "node:test";
import assert from "node:assert/strict";

import { createNameClient, NAME_CLIENT_REASONS } from "../../src/browser/nameClient.js";
import { BOARD_NAME_MAX_CHARS, sanitizeBoardName } from "../../src/browser/boardName.js";
import { BOARD_NAME_FN } from "../../src/browser/firebaseConfig.js";
import { createBoardNameCore, sanitizeName, BOARD_NAME_MAX_CHARS as CORE_MAX } from "../../functions/board-names/core.js";
import { createHandler } from "../../functions/board-names/index.js";
import { createUpstreamStub, field } from "./harness/boardNameStub.js";

const PG = "playgames.google.com";

function mockRes() {
  const r = {
    statusCode: null,
    headers: {},
    body: undefined,
    status(n) {
      r.statusCode = n;
      return r;
    },
    set(k, v) {
      r.headers[k] = v;
      return r;
    },
    send(b) {
      r.body = b;
      return r;
    },
  };
  return r;
}

// A fetchFn that routes BOARD_NAME_FN.url into the real handler.
function handlerFetch(handler, seen = []) {
  return async (u, init) => {
    seen.push({ u, init });
    assert.equal(u, BOARD_NAME_FN.url);
    const headers = {};
    for (const [k, v] of Object.entries(init.headers ?? {})) headers[k.toLowerCase()] = v;
    const req = { method: init.method, headers, body: init.body === undefined ? undefined : JSON.parse(init.body) };
    const res = mockRes();
    await handler(req, res);
    return new Response(res.statusCode === 204 || res.body === undefined ? null : res.body, { status: res.statusCode });
  };
}

function liveClient() {
  const stub = createUpstreamStub({ projectId: "proj" });
  stub.seedUser("tokA", { localId: "uA", providers: [{ providerId: PG, rawId: "p1", displayName: "Moss Knuckle" }] });
  stub.seedUser("tokAnon", { localId: "uAnon", providers: [] });
  stub.seedRun("uA", "aaaa0001");
  stub.seedRun("uAnon", "bbbb0001");
  const core = createBoardNameCore({ fetchFn: stub.fetchFn, getAdminToken: async () => "admin", projectId: "proj", apiKey: "KEY", now: () => 0 });
  const seen = [];
  const client = createNameClient({ fetchFn: handlerFetch(createHandler({ core }), seen) });
  return { stub, client, seen };
}

function answering(status, body) {
  return async () => new Response(body === undefined ? null : JSON.stringify(body), { status });
}

test("NAME_CLIENT_REASONS is the frozen closed set", () => {
  assert.deepEqual([...NAME_CLIENT_REASONS], ["offline", "server", "auth", "refused", "needsCode", "unavailable"]);
  assert.ok(Object.isFrozen(NAME_CLIENT_REASONS));
});

test("claim through the real handler and core resolves name, overridden, stamped and adopted", async () => {
  const { stub, client, seen } = liveClient();
  const r = await client.claim({ idToken: "tokA", adoptIdToken: "tokAnon", gamesAuthCode: "unused" });
  assert.deepEqual({ ...r }, { ok: true, name: "Moss Knuckle", overridden: false, stamped: 1, adopted: 1 });
  assert.equal(field(stub.getDoc("runs/uA_bbbb0001"), "handle"), "Moss Knuckle");

  assert.equal(seen[0].init.method, "POST");
  assert.equal(seen[0].init.headers.Authorization, "Bearer tokA");
  const body = JSON.parse(seen[0].init.body);
  assert.deepEqual(body, { op: "claim", adoptIdToken: "tokAnon", gamesAuthCode: "unused" });
  assert.equal(JSON.stringify(body).includes("tokA\""), false, "the ID token is only in the Authorization header");
  assert.ok(Object.isFrozen(client));
});

test("claim without optional fields sends only the op; release resolves { ok: true }", async () => {
  const { client, seen, stub } = liveClient();
  stub.seedDoc("names/uA", { name: "Moss Knuckle", updatedAt: "x" });
  const c = await client.claim({ idToken: "tokA" });
  assert.equal(c.ok, true);
  assert.deepEqual(JSON.parse(seen[0].init.body), { op: "claim" });
  const r = await client.release({ idToken: "tokA" });
  assert.deepEqual({ ...r }, { ok: true });
  assert.equal(stub.getDoc("names/uA"), null);
  assert.deepEqual(JSON.parse(seen[1].init.body), { op: "release" });
});

test("a rejected fetch or a timeout is offline", async () => {
  const rejecting = createNameClient({ fetchFn: async () => { throw new Error("net"); } });
  assert.deepEqual({ ...(await rejecting.claim({ idToken: "t" })) }, { ok: false, reason: "offline" });
  assert.deepEqual({ ...(await rejecting.release({ idToken: "t" })) }, { ok: false, reason: "offline" });
  class Ctl {
    constructor() {
      this.signal = {};
    }
    abort() {}
  }
  const hanging = createNameClient({ fetchFn: () => new Promise(() => {}), timeoutMs: 5, setTimer: (fn) => { fn(); return 1; }, clearTimer: () => {}, AbortCtl: Ctl });
  assert.deepEqual({ ...(await hanging.claim({ idToken: "t" })) }, { ok: false, reason: "offline" });
});

test("401 is auth; 409 NEEDS_GAMES_CODE is needsCode", async () => {
  const mk = (status, body) => createNameClient({ fetchFn: answering(status, body) });
  assert.deepEqual({ ...(await mk(401, { ok: false, error: "UNAUTHENTICATED" }).claim({ idToken: "t" })) }, { ok: false, reason: "auth" });
  assert.deepEqual({ ...(await mk(409, { ok: false, error: "NEEDS_GAMES_CODE" }).claim({ idToken: "t" })) }, { ok: false, reason: "needsCode" });
});

test("403, 400 and 422 are refused with the server's code", async () => {
  const mk = (status, error) => createNameClient({ fetchFn: answering(status, { ok: false, error }) });
  assert.deepEqual({ ...(await mk(403, "NOT_LINKED").claim({ idToken: "t" })) }, { ok: false, reason: "refused", code: "NOT_LINKED" });
  assert.deepEqual({ ...(await mk(403, "ADOPT_REFUSED").claim({ idToken: "t" })) }, { ok: false, reason: "refused", code: "ADOPT_REFUSED" });
  assert.deepEqual({ ...(await mk(403, "GAMES_MISMATCH").claim({ idToken: "t" })) }, { ok: false, reason: "refused", code: "GAMES_MISMATCH" });
  assert.deepEqual({ ...(await mk(422, "NO_NAME").claim({ idToken: "t" })) }, { ok: false, reason: "refused", code: "NO_NAME" });
  assert.deepEqual({ ...(await mk(400, "BAD_REQUEST").claim({ idToken: "t" })) }, { ok: false, reason: "refused", code: "BAD_REQUEST" });
});

test("a refusal with a missing or odd code carries no code, never the raw body", async () => {
  const odd = createNameClient({ fetchFn: answering(403, { ok: false, error: "<script>alert(1)</script>" }) });
  const r = await odd.claim({ idToken: "t" });
  assert.equal(r.reason, "refused");
  assert.equal(r.code, undefined);
  const none = createNameClient({ fetchFn: async () => new Response("not json", { status: 403 }) });
  assert.deepEqual({ ...(await none.claim({ idToken: "t" })) }, { ok: false, reason: "refused" });
});

test("429 and 5xx are server", async () => {
  for (const status of [429, 500, 502, 503]) {
    const c = createNameClient({ fetchFn: answering(status, { ok: false, error: "UPSTREAM" }) });
    assert.deepEqual({ ...(await c.claim({ idToken: "t" })) }, { ok: false, reason: "server" }, String(status));
    assert.deepEqual({ ...(await c.release({ idToken: "t" })) }, { ok: false, reason: "server" }, String(status));
  }
});

test("a missing fetchFn or a non-https function URL is unavailable, with no request made", async () => {
  const none = createNameClient({});
  assert.deepEqual({ ...(await none.claim({ idToken: "t" })) }, { ok: false, reason: "unavailable" });
  let called = 0;
  const http = createNameClient({ fetchFn: async () => { called += 1; return new Response("{}"); }, fn: { url: "http://example.test/boardName" } });
  assert.deepEqual({ ...(await http.release({ idToken: "t" })) }, { ok: false, reason: "unavailable" });
  const empty = createNameClient({ fetchFn: async () => { called += 1; return new Response("{}"); }, fn: { url: "" } });
  assert.deepEqual({ ...(await empty.claim({ idToken: "t" })) }, { ok: false, reason: "unavailable" });
  assert.equal(called, 0);
});

test("an empty ID token is auth without a request", async () => {
  let called = 0;
  const c = createNameClient({ fetchFn: async () => { called += 1; return new Response("{}"); } });
  assert.deepEqual({ ...(await c.claim({ idToken: "" })) }, { ok: false, reason: "auth" });
  assert.deepEqual({ ...(await c.release({})) }, { ok: false, reason: "auth" });
  assert.equal(called, 0);
});

test("a 200 whose name is empty, 65 characters, or unsanitized is server", async () => {
  for (const name of ["", "x".repeat(65), " padded ", 42, undefined]) {
    const c = createNameClient({ fetchFn: answering(200, { ok: true, name, overridden: false, stamped: 0, adopted: 0 }) });
    assert.deepEqual({ ...(await c.claim({ idToken: "t" })) }, { ok: false, reason: "server" }, JSON.stringify(name));
  }
  const fine = createNameClient({ fetchFn: answering(200, { ok: true, name: "x".repeat(64), overridden: true, stamped: 3, adopted: 2 }) });
  const r = await fine.claim({ idToken: "t" });
  assert.equal(r.ok, true);
  assert.equal(r.overridden, true);
  assert.equal(r.stamped, 3);
  assert.equal(r.adopted, 2);
});

test("a 200 release that does not say ok is server", async () => {
  const c = createNameClient({ fetchFn: answering(200, { nope: true }) });
  assert.deepEqual({ ...(await c.release({ idToken: "t" })) }, { ok: false, reason: "server" });
});

test("no result ever carries a token, an auth code or the Authorization value", async () => {
  const secrets = ["tok-SECRET-1", "anon-SECRET-2", "code-SECRET-3"];
  const answers = [
    [200, { ok: true, name: "Fine", overridden: false, stamped: 0, adopted: 0 }],
    [401, { ok: false, error: "UNAUTHENTICATED" }],
    [403, { ok: false, error: "NOT_LINKED" }],
    [409, { ok: false, error: "NEEDS_GAMES_CODE" }],
    [500, { ok: false, error: "INTERNAL" }],
  ];
  for (const [status, body] of answers) {
    const c = createNameClient({ fetchFn: answering(status, body) });
    const text = JSON.stringify(await c.claim({ idToken: secrets[0], adoptIdToken: secrets[1], gamesAuthCode: secrets[2] }));
    for (const s of secrets) assert.equal(text.includes(s), false, `${status} leaked ${s}`);
  }
});

// --- the one name rule, two copies --------------------------------------------

const NAME_TABLE = [
  "Moss Knuckle",
  "  padded  ",
  "tab\tand\nnewline",
  "Mo\u0007ss\u200B Knuckle",
  "\u202Ereversed",
  "A\u00A0\u2003B   C",
  "é",
  "x".repeat(64),
  "x".repeat(65),
  "x".repeat(70),
  "x".repeat(63) + "\u{1F600}tail",
  "x".repeat(62) + "\u{1F600}",
  "x".repeat(63) + " yy",
  "\u{1F600}".repeat(40),
  "",
  "   ",
  "\u200B\u0007",
  null,
  undefined,
  42,
  {},
  [],
  true,
];

test("sanitizeBoardName and the function's sanitizeName agree on one table of inputs", () => {
  assert.equal(BOARD_NAME_MAX_CHARS, 64);
  assert.equal(CORE_MAX, 64);
  assert.equal(BOARD_NAME_MAX_CHARS, CORE_MAX);
  for (const input of NAME_TABLE) {
    assert.equal(sanitizeBoardName(input), sanitizeName(input), JSON.stringify(input));
  }
  assert.equal(sanitizeBoardName("  Moss   Knuckle "), "Moss Knuckle");
  assert.equal(sanitizeBoardName("x".repeat(70)).length, 64);
  assert.equal(sanitizeBoardName(null), null);
});
