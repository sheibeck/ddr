// test/unit/boardWrites.test.js
//
// Phase 83 Plan 06 Task 1. Covers createBoardWrites against
// createFakeBoardFetch (83-04) with the real createIdentity (83-03): the
// idempotent submitRun (created / exists under all three existsResponse
// modes / refused / invalid / 401 refresh-and-retry / offline / server /
// off), rewriteHandle (paging, zero-call cases) and eraseMyRuns (success,
// mid-way failure).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { stripJs } from "../../tools/ident-sweep.mjs";
import { SEASON } from "../../content/season.js";
import { runHash } from "../../engine/records.js";
import { rollHandle, isValidHandle } from "../../src/browser/handles.js";
import { RUN_CLIENT_FIELDS, rankKeys, runDocId } from "../../src/browser/runDoc.js";
import { createFakeBoardFetch } from "../../src/browser/fakeBoardServer.js";
import { createIdentity } from "../../src/browser/firebaseAuth.js";
import { WRITE_REASONS, classifyWrite, createBoardWrites } from "../../src/browser/boardWrites.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const BOARD_WRITES_SRC = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "boardWrites.js"), "utf8").replace(/\r\n/g, "\n");

const VALID_CONFIG = Object.freeze({ projectId: "delve-die-repeat-6ba5f", apiKey: `AIza${"A".repeat(35)}` });

/* ---------------- helpers ---------------- */

function makeStorage() {
  const map = new Map();
  return {
    map,
    async getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    async setItem(key, value) {
      map.set(key, String(value));
    },
    async removeItem(key) {
      map.delete(key);
    },
  };
}

function clockBox(start = 0) {
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

function baseSummary(overrides = {}) {
  const s = {
    name: "Test Hero",
    race: "Human",
    sub: "Knight",
    cls: "Fighter",
    level: 1,
    sp: 40,
    floor: 5,
    day: 3,
    steps: 500,
    gold: 100,
    kills: 10,
    cause: "combat",
    note: "died",
    epitaph: "",
    when: 1000,
    season: SEASON,
    seed: 12345,
    acts: 10,
    ...overrides,
  };
  s.hash = runHash(s);
  return s;
}

function validHandle(seed = 0.15) {
  return rollHandle(() => seed, null);
}

function docFor(overrides = {}) {
  const merged = {
    uid: "fakeuid000001",
    handle: validHandle(0.15),
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
    epitaph: "",
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

function hexHash(n) {
  return n.toString(16).padStart(8, "0");
}

function makeSetup({ competeOn = true, fakeOpts = {}, identityOpts = {} } = {}) {
  const clock = clockBox(0);
  const fake = createFakeBoardFetch({ config: VALID_CONFIG, now: clock, ...fakeOpts });
  const storage = makeStorage();
  let competing = competeOn;
  const identity = createIdentity({
    storage,
    fetchFn: fake.fetchFn,
    config: VALID_CONFIG,
    competeOn: () => competing,
    now: clock,
    random: () => 0.42,
    ...identityOpts,
  });
  const writes = createBoardWrites({ fetchFn: fake.fetchFn, identity, config: VALID_CONFIG });
  return {
    fake,
    storage,
    clock,
    identity,
    writes,
    setCompeting: (v) => {
      competing = v;
    },
  };
}

function commitCalls(fake) {
  return fake.calls().filter((c) => c.method === "POST" && c.url.includes(":commit"));
}

function getRunCalls(fake) {
  return fake.calls().filter((c) => c.method === "GET" && /\/runs\//.test(c.url));
}

/* ================================================================
   constants
   ================================================================ */

test("constants: WRITE_REASONS", () => {
  assert.deepEqual(WRITE_REASONS, ["off", "offline", "server", "refused", "invalid", "auth", "unavailable"]);
  assert.ok(Object.isFrozen(WRITE_REASONS));
});

/* ================================================================
   classifyWrite
   ================================================================ */

test("classifyWrite: 2xx is ok, 401/UNAUTHENTICATED is auth, 429/5xx is server, 400/403/409 is ambiguous, else refused", () => {
  assert.equal(classifyWrite(200, {}), "ok");
  assert.equal(classifyWrite(401, {}), "auth");
  assert.equal(classifyWrite(403, { error: { status: "UNAUTHENTICATED" } }), "auth");
  assert.equal(classifyWrite(429, {}), "server");
  assert.equal(classifyWrite(503, {}), "server");
  assert.equal(classifyWrite(400, {}), "ambiguous");
  assert.equal(classifyWrite(403, {}), "ambiguous");
  assert.equal(classifyWrite(409, {}), "ambiguous");
  assert.equal(classifyWrite(418, {}), "refused");
});

/* ================================================================
   submitRun
   ================================================================ */

test("submitRun: a fresh identity signs up and creates the run", async () => {
  const { fake, writes } = makeSetup();
  const summary = baseSummary();
  const res = await writes.submitRun(summary, { version: "2.2.0 (12)" });
  assert.equal(res.ok, true);
  assert.equal(res.status, "created");
  const docs = fake.docs();
  assert.equal(docs.length, 1);
  assert.equal(docs[0].hash, summary.hash);
  assert.ok(isValidHandle(docs[0].handle));
  assert.equal(typeof docs[0].createdAt, "string");
});

for (const mode of ["precondition", "denied", "conflict"]) {
  test(`submitRun: a duplicate is acknowledged as exists (existsResponse=${mode})`, async () => {
    const setup = makeSetup({ fakeOpts: { existsResponse: mode } });
    const summary = baseSummary();
    const first = await setup.writes.submitRun(summary, { version: "1" });
    assert.equal(first.ok, true);
    assert.equal(first.status, "created");

    const before = getRunCalls(setup.fake).length;
    const second = await setup.writes.submitRun(summary, { version: "1" });
    assert.equal(second.ok, true);
    assert.equal(second.status, "exists");
    assert.equal(second.id, first.id);
    assert.equal(getRunCalls(setup.fake).length, before + 1, "exactly one public GET settles the ambiguity");
    assert.equal(fake_docsCount(setup.fake), 1);
  });
}

function fake_docsCount(fake) {
  return fake.docs().length;
}

test("submitRun: a create refused for a doc that does not exist (banned uid) resolves refused", async () => {
  const { fake, identity, writes } = makeSetup();
  const token = await identity.getToken();
  assert.equal(token.ok, true);
  fake.ban(token.uid);

  const res = await writes.submitRun(baseSummary(), { version: "1" });
  assert.equal(res.ok, false);
  assert.equal(res.reason, "refused");
  assert.equal(res.status, "PERMISSION_DENIED");
  assert.equal(fake.docs().length, 0);
});

test("submitRun: a summary the JS mirror refuses resolves invalid with no :commit request", async () => {
  const { fake, writes } = makeSetup();
  const bad = baseSummary({ kills: 999999 }); // kills > steps fails the mirror
  const before = commitCalls(fake).length;
  const res = await writes.submitRun(bad, { version: "1" });
  assert.equal(res.ok, false);
  assert.equal(res.reason, "invalid");
  assert.ok(Array.isArray(res.fails) && res.fails.includes("kills"));
  assert.equal(commitCalls(fake).length, before);
});

test("submitRun: a 401 forces one forceRefresh and one retry, then resolves created", async () => {
  const setup = makeSetup({ fakeOpts: { tokenTtlMs: 100 } });
  await setup.identity.getToken(); // sign up at t=0
  setup.clock.set(150); // past the fake's own tokenTtlMs, well within the JWT's own margin

  const res = await setup.writes.submitRun(baseSummary(), { version: "1" });
  assert.equal(res.ok, true);
  assert.equal(res.status, "created");
});

test("submitRun: a second 401 (forceRefresh does not help) resolves reason auth", async () => {
  const setup = makeSetup({ fakeOpts: { tokenTtlMs: -1 } }); // every token is immediately expired
  const res = await setup.writes.submitRun(baseSummary(), { version: "1" });
  assert.equal(res.ok, false);
  assert.equal(res.reason, "auth");
});

test("submitRun: offline resolves offline", async () => {
  const setup = makeSetup();
  await setup.identity.getToken(); // sign up while online
  setup.fake.setOnline(false);
  const res = await setup.writes.submitRun(baseSummary(), { version: "1" });
  assert.equal(res.ok, false);
  assert.equal(res.reason, "offline");
});

test("submitRun: a stub 503 resolves server", async () => {
  const setup = makeSetup();
  await setup.identity.getToken();
  const real = setup.fake.fetchFn;
  const stub503 = async (u, init) => {
    if (typeof u === "string" && u.includes(":commit")) {
      return { ok: false, status: 503, json: async () => ({ error: { code: 503, status: "UNAVAILABLE", message: "UNAVAILABLE" } }) };
    }
    return real(u, init);
  };
  const writes2 = createBoardWrites({ fetchFn: stub503, identity: setup.identity, config: VALID_CONFIG });
  const res = await writes2.submitRun(baseSummary(), { version: "1" });
  assert.equal(res.ok, false);
  assert.equal(res.reason, "server");
});

test("submitRun: Compete OFF resolves off with zero requests", async () => {
  const setup = makeSetup({ competeOn: false });
  const before = setup.fake.calls().length;
  const res = await setup.writes.submitRun(baseSummary(), { version: "1" });
  assert.equal(res.ok, false);
  assert.equal(res.reason, "off");
  assert.equal(setup.fake.calls().length, before);
});

/* ================================================================
   rewriteHandle
   ================================================================ */

test("rewriteHandle: with no uid yet resolves updated:0 with zero requests", async () => {
  const setup = makeSetup();
  const before = setup.fake.calls().length;
  const res = await setup.writes.rewriteHandle(validHandle(0.9));
  assert.deepEqual(res, { ok: true, updated: 0 });
  assert.equal(setup.fake.calls().length, before);
});

test("rewriteHandle: an invalid handle resolves invalid with zero requests", async () => {
  const setup = makeSetup();
  const before = setup.fake.calls().length;
  const res = await setup.writes.rewriteHandle("not-a-handle");
  assert.equal(res.ok, false);
  assert.equal(res.reason, "invalid");
  assert.equal(setup.fake.calls().length, before);
});

test("rewriteHandle: updates exactly the player's 120 runs (paged, handle-only), leaves another player's 5", async () => {
  const oldHandle = validHandle(0.1);
  const newHandle = validHandle(0.77);
  const mine = [];
  for (let i = 0; i < 120; i++) mine.push(seedFor({ uid: "fakeuid000001", hash: hexHash(i + 1), handle: oldHandle, floor: 2 + (i % 10) }));
  const theirs = [];
  for (let i = 0; i < 5; i++) theirs.push(seedFor({ uid: "otheruid", hash: hexHash(1000 + i), handle: oldHandle, floor: 3 }));

  const setup = makeSetup({ fakeOpts: { runs: [...mine, ...theirs] } });
  await setup.identity.getToken(); // signs up as fakeuid000001 (the fake's fresh-instance first uid)

  const res = await setup.writes.rewriteHandle(newHandle);
  assert.equal(res.ok, true);
  assert.equal(res.updated, 120);

  const docs = setup.fake.docs();
  const mineDocs = docs.filter((d) => d.uid === "fakeuid000001");
  const theirDocs = docs.filter((d) => d.uid === "otheruid");
  assert.equal(mineDocs.length, 120);
  assert.ok(mineDocs.every((d) => d.handle === newHandle));
  assert.equal(theirDocs.length, 5);
  assert.ok(theirDocs.every((d) => d.handle === oldHandle));

  const commits = commitCalls(setup.fake);
  assert.ok(commits.length >= 3, "120 runs at 50/page needs at least 3 handle-update commits");
});

/* ================================================================
   eraseMyRuns
   ================================================================ */

test("eraseMyRuns: with no identity yet drops nothing but resolves ok with zero deletes", async () => {
  const setup = makeSetup();
  const res = await setup.writes.eraseMyRuns();
  assert.deepEqual(res, { ok: true, deleted: 0, dropped: true, accountDeleted: false });
});

test("eraseMyRuns: deletes all 120 of the player's runs, leaves the other player's 5, deletes the account, drops the identity", async () => {
  const mine = [];
  for (let i = 0; i < 120; i++) mine.push(seedFor({ uid: "fakeuid000001", hash: hexHash(i + 1) }));
  const theirs = [];
  for (let i = 0; i < 5; i++) theirs.push(seedFor({ uid: "otheruid", hash: hexHash(1000 + i) }));

  const setup = makeSetup({ fakeOpts: { runs: [...mine, ...theirs] } });
  await setup.identity.getToken();

  const res = await setup.writes.eraseMyRuns();
  assert.equal(res.ok, true);
  assert.equal(res.deleted, 120);
  assert.equal(res.dropped, true);
  assert.equal(res.accountDeleted, true);

  const docs = setup.fake.docs();
  assert.equal(docs.filter((d) => d.uid === "fakeuid000001").length, 0);
  assert.equal(docs.filter((d) => d.uid === "otheruid").length, 5);
  assert.ok(!setup.fake.users().includes("fakeuid000001"));
  assert.equal(setup.storage.map.has("ddr.identity.v1"), false);
});

test("eraseMyRuns: a mid-way network failure resolves ok:false with the partial deleted count, and keeps the identity stored", async () => {
  const mine = [];
  for (let i = 0; i < 60; i++) mine.push(seedFor({ uid: "fakeuid000001", hash: hexHash(i + 1) }));

  const setup = makeSetup({ fakeOpts: { runs: mine } });
  await setup.identity.getToken();

  let callCount = 0;
  const real = setup.fake.fetchFn;
  const wrapped = async (u, init) => {
    callCount += 1;
    if (callCount === 4) setup.fake.setOnline(false); // after signUp(1)+query(2)+commit(3), fail the 2nd page's query
    return real(u, init);
  };
  const writes2 = createBoardWrites({ fetchFn: wrapped, identity: setup.identity, config: VALID_CONFIG });

  const res = await writes2.eraseMyRuns();
  assert.equal(res.ok, false);
  assert.equal(res.reason, "offline");
  assert.equal(res.deleted, 50);
  assert.equal(setup.storage.map.has("ddr.identity.v1"), true);
});

/* ================================================================
   purity
   ================================================================ */

test("purity: boardWrites.js never touches DOM globals and never calls the bare global fetch", () => {
  const code = stripJs(BOARD_WRITES_SRC);
  for (const banned of [/\bwindow\b/, /\bnavigator\b/, /\blocalStorage\b/, /\bsessionStorage\b/]) {
    assert.doesNotMatch(code, banned, `must not use ${banned}`);
  }
  assert.doesNotMatch(code, /(?<!\.)\bdocument\b(?!\s*:)/, "must not use the DOM global `document`");
  assert.doesNotMatch(code, /(?<!\w)fetch\(/, "must never call the global fetch directly");
});

test("purity: exports createBoardWrites exactly once, and uses createRunCommit", () => {
  assert.equal((BOARD_WRITES_SRC.match(/export function createBoardWrites/g) || []).length, 1);
  assert.match(BOARD_WRITES_SRC, /createRunCommit/);
});
