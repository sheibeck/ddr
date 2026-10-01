// test/unit/board-names-http.test.js
//
// Phase 91.2-02 Task 2 (BOARD-31, D-01). functions/board-names/index.js: the
// HTTP surface in front of the core (CORS preflight, the method gate, Bearer
// extraction, JSON body parsing, op routing) and the zero-dependency package.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { createHandler, DEFAULT_PROJECT_ID, DEFAULT_API_KEY } from "../../functions/board-names/index.js";
import { FIREBASE_CONFIG } from "../../src/browser/firebaseConfig.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const FN_DIR = path.resolve(__dirname, "..", "..", "functions", "board-names");

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

function fakeCore() {
  const seen = [];
  return {
    seen,
    claim: async (a) => {
      seen.push(["claim", a]);
      return { status: 200, body: { ok: true, name: "Moss Knuckle", overridden: false, stamped: 1, adopted: 0 } };
    },
    release: async (a) => {
      seen.push(["release", a]);
      return { status: 200, body: { ok: true, released: true } };
    },
  };
}

async function run(req, core = fakeCore()) {
  const res = mockRes();
  await createHandler({ core })(req, res);
  return { res, core, json: res.body ? JSON.parse(res.body) : null };
}

const post = (body, headers = { authorization: "Bearer tok-1" }) => ({ method: "POST", headers, body });

test("OPTIONS answers 204 with the four CORS headers and no body", async () => {
  const { res } = await run({ method: "OPTIONS", headers: {} });
  assert.equal(res.statusCode, 204);
  assert.equal(res.headers["Access-Control-Allow-Origin"], "*");
  assert.equal(res.headers["Access-Control-Allow-Headers"], "Authorization, Content-Type");
  assert.equal(res.headers["Access-Control-Allow-Methods"], "POST, OPTIONS");
  assert.equal(res.headers["Access-Control-Max-Age"], "3600");
  assert.ok(res.body === undefined || res.body === "");
});

test("GET, PUT and DELETE are 405, and carry the allow-origin header", async () => {
  for (const method of ["GET", "PUT", "DELETE", "PATCH"]) {
    const { res, json } = await run({ method, headers: { authorization: "Bearer t" } });
    assert.equal(res.statusCode, 405, method);
    assert.equal(res.headers["Access-Control-Allow-Origin"], "*");
    assert.equal(json.ok, false);
  }
});

test("a POST without a Bearer token is 401 UNAUTHENTICATED and never reaches the core", async () => {
  for (const headers of [{}, { authorization: "" }, { authorization: "Basic abc" }, { authorization: "Bearer " }]) {
    const { res, json, core } = await run(post({ op: "claim" }, headers));
    assert.equal(res.statusCode, 401, JSON.stringify(headers));
    assert.deepEqual(json, { ok: false, error: "UNAUTHENTICATED" });
    assert.equal(core.seen.length, 0);
  }
});

test("the Authorization header is read case-insensitively", async () => {
  const { core, res } = await run(post({ op: "claim" }, { Authorization: "bearer tok-9" }));
  assert.equal(res.statusCode, 200);
  assert.equal(core.seen[0][1].idToken, "tok-9");
});

test("a body that is not JSON, or an op other than claim/release, is 400 BAD_REQUEST", async () => {
  for (const body of ["not json", "", "[1,2]", "null", { op: "ban" }, { op: 7 }, {}, [], null, undefined, { op: "claim", adoptIdToken: 5 }, { op: "claim", gamesAuthCode: {} }]) {
    const { res, json, core } = await run(post(body));
    assert.equal(res.statusCode, 400, JSON.stringify(body));
    assert.deepEqual(json, { ok: false, error: "BAD_REQUEST" });
    assert.equal(core.seen.length, 0);
  }
});

test("a string or Buffer body is parsed as JSON", async () => {
  const a = await run(post(JSON.stringify({ op: "claim", gamesAuthCode: "gc" })));
  assert.equal(a.res.statusCode, 200);
  assert.equal(a.core.seen[0][1].gamesAuthCode, "gc");
  const b = await run(post(Buffer.from(JSON.stringify({ op: "release" }))));
  assert.equal(b.res.statusCode, 200);
  assert.equal(b.core.seen[0][0], "release");
});

test("claim and release forward to the core and write its status and body; the name is never taken from the request", async () => {
  const a = await run(post({ op: "claim", adoptIdToken: "anon-tok", gamesAuthCode: "gc", name: "Evil", handle: "Evil" }));
  assert.equal(a.res.statusCode, 200);
  assert.deepEqual(a.json, { ok: true, name: "Moss Knuckle", overridden: false, stamped: 1, adopted: 0 });
  assert.deepEqual(a.core.seen[0], ["claim", { idToken: "tok-1", adoptIdToken: "anon-tok", gamesAuthCode: "gc" }]);
  assert.equal(a.res.headers["Access-Control-Allow-Origin"], "*");
  assert.match(a.res.headers["Content-Type"], /application\/json/);

  const r = await run(post({ op: "release" }));
  assert.deepEqual(r.json, { ok: true, released: true });
  assert.deepEqual(r.core.seen[0], ["release", { idToken: "tok-1" }]);
});

test("a core error status and body pass through unchanged", async () => {
  const core = { claim: async () => ({ status: 403, body: { ok: false, error: "NOT_LINKED" } }), release: async () => ({ status: 401, body: { ok: false, error: "UNAUTHENTICATED" } }) };
  const a = await run(post({ op: "claim" }), core);
  assert.equal(a.res.statusCode, 403);
  assert.equal(a.json.error, "NOT_LINKED");
  const b = await run(post({ op: "release" }), core);
  assert.equal(b.res.statusCode, 401);
});

test("a core that throws is 500 INTERNAL, never an unhandled rejection", async () => {
  const core = { claim: async () => { throw new Error("boom with a secret"); }, release: async () => ({ status: 200, body: {} }) };
  const { res, json } = await run(post({ op: "claim" }), core);
  assert.equal(res.statusCode, 500);
  assert.deepEqual(json, { ok: false, error: "INTERNAL" });
  assert.equal(res.body.includes("secret"), false);
});

test("the boardName export exists and loading the module makes no network call", async () => {
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    throw new Error("network");
  };
  try {
    const mod = await import(`../../functions/board-names/index.js?fresh=${Date.now()}`);
    assert.equal(typeof mod.boardName, "function");
    assert.equal(typeof mod.createHandler, "function");
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("the defaults in index.js equal FIREBASE_CONFIG", () => {
  assert.equal(DEFAULT_PROJECT_ID, FIREBASE_CONFIG.projectId);
  assert.equal(DEFAULT_API_KEY, FIREBASE_CONFIG.apiKey);
});

test("package.json: type module, main index.js, engines node 22, no dependencies of any kind", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(FN_DIR, "package.json"), "utf8"));
  assert.equal(pkg.name, "board-names");
  assert.equal(pkg.private, true);
  assert.equal(pkg.type, "module");
  assert.equal(pkg.main, "index.js");
  assert.equal(pkg.engines.node, "22");
  for (const key of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
    assert.equal(key in pkg, false, key);
  }
});

test("index.js imports only its own directory", () => {
  const src = fs.readFileSync(path.join(FN_DIR, "index.js"), "utf8").replace(/\r\n/g, "\n");
  for (const line of src.split("\n").filter((l) => /^\s*import\b/.test(l))) {
    assert.match(line, /from\s+["'](node:[a-z/:_-]+|\.\/[^"']+)["']/, line);
  }
});
