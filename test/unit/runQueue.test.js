// test/unit/runQueue.test.js
//
// Phase 83 Plan 06 Task 2. Covers createRunQueue: dev/off/invalid refusals,
// persist-before-network, duplicates, single-flight, offline and backoff
// (with force), refusal drop with its log line, exists acknowledgement,
// order + a transient stop, relaunch, corrupt load, purge, overflow and
// enqueueMany. Uses the fake server + the real identity + the real
// boardWrites for the full-stack cases, and a stub `writes` object where a
// precise sequence of outcomes must be forced.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { stripJs } from "../../tools/ident-sweep.mjs";
import { SEASON } from "../../content/season.js";
import { runHash } from "../../engine/records.js";
import { createFakeBoardFetch } from "../../src/browser/fakeBoardServer.js";
import { createIdentity } from "../../src/browser/firebaseAuth.js";
import { createBoardWrites } from "../../src/browser/boardWrites.js";
import {
  RUN_QUEUE_KEY,
  QUEUE_MAX,
  SETTLED_MAX,
  BACKOFF_BASE_MS,
  BACKOFF_MAX_MS,
  backoffMs,
  sanitizeQueue,
  createRunQueue,
} from "../../src/browser/runQueue.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const RUN_QUEUE_SRC = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "runQueue.js"), "utf8").replace(/\r\n/g, "\n");

const VALID_CONFIG = Object.freeze({ projectId: "delve-die-repeat-6ba5f", apiKey: `AIza${"A".repeat(35)}` });

/* ---------------- helpers ---------------- */

function makeStorage() {
  const map = new Map();
  const calls = { getItem: 0, setItem: 0, removeItem: 0 };
  return {
    map,
    calls,
    async getItem(key) {
      calls.getItem++;
      return map.has(key) ? map.get(key) : null;
    },
    async setItem(key, value) {
      calls.setItem++;
      map.set(key, String(value));
    },
    async removeItem(key) {
      calls.removeItem++;
      map.delete(key);
    },
  };
}

function clockBox(start = 1000000) {
  let t = start;
  const now = () => t;
  now.set = (v) => {
    t = v;
  };
  return now;
}

function makeLog() {
  const lines = [];
  const log = (line) => lines.push(line);
  log.lines = lines;
  return log;
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
  if (!("hash" in overrides)) s.hash = runHash(s);
  return s;
}

/** stubWrites(sequence) — sequence[i] (or the last entry, once exhausted) answers the i-th submitRun call. */
function stubWrites(sequence) {
  const calls = [];
  return {
    calls,
    async submitRun(summary, opts) {
      calls.push({ summary, opts });
      const i = calls.length - 1;
      const item = sequence[Math.min(i, sequence.length - 1)];
      return typeof item === "function" ? item(summary, opts) : item;
    },
  };
}

function makeFullStack({ competeOn = true, online = true, fakeOpts = {} } = {}) {
  const clock = clockBox();
  const fake = createFakeBoardFetch({ config: VALID_CONFIG, now: clock, ...fakeOpts });
  const idStorage = makeStorage();
  let competing = competeOn;
  const identity = createIdentity({
    storage: idStorage,
    fetchFn: fake.fetchFn,
    config: VALID_CONFIG,
    competeOn: () => competing,
    now: clock,
    random: () => 0.42,
  });
  const writes = createBoardWrites({ fetchFn: fake.fetchFn, identity, config: VALID_CONFIG });
  return { clock, fake, identity, writes, setCompeting: (v) => (competing = v) };
}

/* ================================================================
   constants + backoffMs
   ================================================================ */

test("constants: RUN_QUEUE_KEY, QUEUE_MAX, SETTLED_MAX, BACKOFF_BASE_MS, BACKOFF_MAX_MS", () => {
  assert.equal(RUN_QUEUE_KEY, "ddr.runQueue.v1");
  assert.equal(QUEUE_MAX, 200);
  assert.equal(SETTLED_MAX, 500);
  assert.equal(BACKOFF_BASE_MS, 30000);
  assert.equal(BACKOFF_MAX_MS, 1800000);
});

test("backoffMs: 0 for n<=0, doubles from the base, caps at BACKOFF_MAX_MS", () => {
  assert.equal(backoffMs(0), 0);
  assert.equal(backoffMs(-3), 0);
  assert.equal(backoffMs(1), 30000);
  assert.equal(backoffMs(2), 60000);
  assert.equal(backoffMs(3), 120000);
  assert.equal(backoffMs(20), 1800000);
});

/* ================================================================
   sanitizeQueue
   ================================================================ */

test("sanitizeQueue: garbage input gives an empty queue", () => {
  for (const bad of [null, undefined, 42, "x", [], { v: 2 }]) {
    assert.deepEqual(sanitizeQueue(bad), { v: 1, entries: [], settled: [], failures: 0, retryAt: 0 });
  }
});

test("sanitizeQueue: drops a bad hash/summary/version, dedupes hashes, dedupes+caps settled, sanitizes failures/retryAt", () => {
  const s = baseSummary();
  const raw = {
    v: 1,
    entries: [
      { hash: s.hash, summary: s, version: "1.0" },
      { hash: "not-a-hash", summary: s, version: "1.0" },
      { hash: s.hash, summary: s, version: "1.0" }, // duplicate hash dropped
      { hash: "aaaaaaaa", summary: "not-an-object", version: "1.0" },
      { hash: "bbbbbbbb", summary: s, version: "" }, // bad version
      { hash: "cccccccc", summary: s, version: "x".repeat(65) }, // too long
    ],
    settled: ["dddddddd", "dddddddd", "not-valid", "eeeeeeee"],
    failures: 3,
    retryAt: 12345,
  };
  const out = sanitizeQueue(raw);
  assert.equal(out.entries.length, 1);
  assert.equal(out.entries[0].hash, s.hash);
  assert.deepEqual(out.settled, ["dddddddd", "eeeeeeee"]);
  assert.equal(out.failures, 3);
  assert.equal(out.retryAt, 12345);
});

/* ================================================================
   enqueue: dev / off / invalid
   ================================================================ */

test("enqueue: dev:true resolves reason dev and stores nothing", async () => {
  const storage = makeStorage();
  const writes = stubWrites([{ ok: true, status: "created" }]);
  const queue = createRunQueue({ storage, writes, competeOn: () => true, online: () => true });
  const res = await queue.enqueue(baseSummary(), { dev: true, version: "1" });
  assert.deepEqual(res, { ok: false, reason: "dev" });
  assert.equal(storage.calls.setItem, 0);
  assert.equal(writes.calls.length, 0);
});

test("enqueue: Compete OFF resolves reason off and stores nothing", async () => {
  const storage = makeStorage();
  const writes = stubWrites([{ ok: true, status: "created" }]);
  const queue = createRunQueue({ storage, writes, competeOn: () => false, online: () => true });
  const res = await queue.enqueue(baseSummary(), { version: "1" });
  assert.deepEqual(res, { ok: false, reason: "off" });
  assert.equal(storage.calls.setItem, 0);
  assert.equal(writes.calls.length, 0);
});

test("enqueue: an invalid hash, another season, or an out-of-bounds version resolves invalid", async () => {
  const storage = makeStorage();
  const writes = stubWrites([{ ok: true, status: "created" }]);
  const queue = createRunQueue({ storage, writes, competeOn: () => true, online: () => true });

  const badHash = await queue.enqueue(baseSummary({ hash: "not-valid" }), { version: "1" });
  assert.deepEqual(badHash, { ok: false, reason: "invalid" });

  const otherSeason = baseSummary({ season: SEASON + 1 });
  const badSeason = await queue.enqueue(otherSeason, { version: "1" });
  assert.deepEqual(badSeason, { ok: false, reason: "invalid" });

  const badVersion = await queue.enqueue(baseSummary(), { version: "" });
  assert.deepEqual(badVersion, { ok: false, reason: "invalid" });

  assert.equal(storage.calls.setItem, 0);
  assert.equal(writes.calls.length, 0);
});

/* ================================================================
   enqueue: the happy path (full stack), duplicates
   ================================================================ */

test("enqueue: persists before any network call, flushes, settles, and calls onAck once", async () => {
  const stack = makeFullStack();
  const storage = makeStorage();
  const log = makeLog();
  let ackCalls = 0;
  const queue = createRunQueue({
    storage,
    writes: stack.writes,
    competeOn: () => true,
    online: () => true,
    now: stack.clock,
    log,
    onAck: () => {
      ackCalls += 1;
    },
  });

  const summary = baseSummary();
  const res = await queue.enqueue(summary, { version: "1" });
  assert.equal(res.ok, true);
  assert.equal(res.queued, true);
  assert.equal(typeof res.flushed.then, "function");

  const flushResult = await res.flushed;
  assert.equal(flushResult.ok, true);
  assert.equal(flushResult.sent, 1);

  assert.equal(stack.fake.docs().length, 1);
  assert.equal(stack.fake.docs()[0].hash, summary.hash);

  const snap = await queue.snapshot();
  assert.equal(snap.entries.length, 0);
  assert.deepEqual(snap.settled, [summary.hash]);
  assert.equal(ackCalls, 1);
});

test("enqueue: the same hash again (queued or settled) resolves duplicate:true and causes no second create", async () => {
  const stack = makeFullStack();
  const storage = makeStorage();
  const queue = createRunQueue({ storage, writes: stack.writes, competeOn: () => true, online: () => true, now: stack.clock });

  const summary = baseSummary();
  const first = await queue.enqueue(summary, { version: "1" });
  await first.flushed;

  const dupAfterSettle = await queue.enqueue(summary, { version: "1" });
  assert.deepEqual(dupAfterSettle, { ok: true, duplicate: true });
  assert.equal(stack.fake.docs().length, 1);

  // and a duplicate while still queued (Compete stays ON, but flush is
  // starved by taking the queue offline before the auto-flush runs)
  const summary2 = baseSummary({ steps: 600 });
  const offlineQueue = createRunQueue({ storage: makeStorage(), writes: stack.writes, competeOn: () => true, online: () => false, now: stack.clock });
  const enqueued = await offlineQueue.enqueue(summary2, { version: "1" });
  assert.equal(enqueued.queued, true);
  await enqueued.flushed; // resolves { ok:false, reason:"offline" } — nothing sent
  const dupWhileQueued = await offlineQueue.enqueue(summary2, { version: "1" });
  assert.deepEqual(dupWhileQueued, { ok: true, duplicate: true });
});

/* ================================================================
   flush: single-flight, offline gate, backoff + force
   ================================================================ */

test("flush: two calls started together share one run", async () => {
  const storage = makeStorage();
  const writes = stubWrites([{ ok: true, status: "created" }]);
  const queue = createRunQueue({ storage, writes, competeOn: () => true, online: () => true });
  await queue.enqueueMany([baseSummary()], { version: "1" });

  const p1 = queue.flush();
  const p2 = queue.flush();
  assert.equal(p1, p2, "a concurrent flush() call must return the SAME in-flight promise");
  await p1;
  assert.equal(writes.calls.length, 1, "exactly one submitRun call for the one queued entry");
});

test("flush: online() false resolves offline with zero requests", async () => {
  const storage = makeStorage();
  const writes = stubWrites([{ ok: true, status: "created" }]);
  const queue = createRunQueue({ storage, writes, competeOn: () => true, online: () => false });
  await queue.enqueueMany([baseSummary()], { version: "1" });
  const res = await queue.flush();
  assert.deepEqual(res, { ok: false, reason: "offline" });
  assert.equal(writes.calls.length, 0);
});

test("flush: a transient failure sets failures/retryAt, backs off, and force retries with the doubled delay", async () => {
  const storage = makeStorage();
  const clock = clockBox(1000000);
  const writes = stubWrites([{ ok: false, reason: "offline" }]);
  const queue = createRunQueue({ storage, writes, competeOn: () => true, online: () => true, now: clock });

  const enq = await queue.enqueue(baseSummary(), { version: "1" });
  const first = await enq.flushed;
  assert.equal(first.ok, false);
  assert.equal(first.reason, "offline");
  assert.equal(first.retryAt, clock() + 30000);
  assert.equal(writes.calls.length, 1);

  const before = await queue.flush(); // unforced, still inside the backoff window
  assert.equal(before.ok, false);
  assert.equal(before.reason, "backoff");
  assert.equal(before.retryAt, clock() + 30000);
  assert.equal(writes.calls.length, 1, "no request while backing off");

  const forced = await queue.flush({ force: true });
  assert.equal(forced.ok, false);
  assert.equal(forced.retryAt, clock() + 60000);
  assert.equal(writes.calls.length, 2);

  const snap = await queue.snapshot();
  assert.equal(snap.failures, 2);
  assert.equal(snap.retryAt, clock() + 60000);
});

/* ================================================================
   flush: refusal drop, exists acknowledgement, order + transient stop
   ================================================================ */

test("flush: a refused entry (banned uid) is dropped with a log line, and the next entry is still attempted", async () => {
  const stack = makeFullStack();
  const storage = makeStorage();
  const log = makeLog();
  const queue = createRunQueue({ storage, writes: stack.writes, competeOn: () => true, online: () => true, now: stack.clock, log });

  const token = await stack.identity.getToken();
  stack.fake.ban(token.uid);

  const a = baseSummary({ steps: 501 });
  const b = baseSummary({ steps: 502 });
  await queue.enqueueMany([a, b], { version: "1" });

  const res = await queue.flush();
  assert.equal(res.ok, true);
  assert.equal(res.dropped, 2);

  const snap = await queue.snapshot();
  assert.equal(snap.entries.length, 0);
  assert.ok(snap.settled.includes(a.hash) && snap.settled.includes(b.hash));

  assert.ok(log.lines.some((l) => l.includes("[runQueue] dropped") && l.includes(a.hash) && l.includes("refused")));
});

test("flush: an already-existing doc is acknowledged and removed; a later transient failure stops the flush, keeping the rest in order", async () => {
  const storage = makeStorage();
  const writes = stubWrites([{ ok: true, status: "exists", id: "x" }, { ok: false, reason: "server" }]);
  const queue = createRunQueue({ storage, writes, competeOn: () => true, online: () => true });

  const a = baseSummary({ steps: 501 });
  const b = baseSummary({ steps: 502 });
  const c = baseSummary({ steps: 503 });
  await queue.enqueueMany([a, b, c], { version: "1" });

  const res = await queue.flush();
  assert.equal(res.ok, false);
  assert.equal(res.reason, "server");
  assert.equal(res.sent, 1);
  assert.equal(writes.calls.length, 2, "the third entry was never attempted");

  const snap = await queue.snapshot();
  assert.equal(snap.entries.length, 2);
  assert.equal(snap.entries[0].hash, b.hash);
  assert.equal(snap.entries[1].hash, c.hash);
  assert.deepEqual(snap.settled, [a.hash]);
});

/* ================================================================
   relaunch, corrupt load, purge, overflow, enqueueMany
   ================================================================ */

test("relaunch: a new createRunQueue over the same storage loads the pending entries and flushes them", async () => {
  const stack = makeFullStack();
  const storage = makeStorage();

  const queue1 = createRunQueue({ storage, writes: stack.writes, competeOn: () => true, online: () => false, now: stack.clock });
  const summary = baseSummary();
  const enq = await queue1.enqueue(summary, { version: "1" });
  await enq.flushed; // offline — stays queued, persisted
  assert.equal(stack.fake.docs().length, 0);

  const queue2 = createRunQueue({ storage, writes: stack.writes, competeOn: () => true, online: () => true, now: stack.clock });
  const res = await queue2.flush();
  assert.equal(res.ok, true);
  assert.equal(res.sent, 1);
  assert.equal(stack.fake.docs().length, 1);

  const snap = await queue2.snapshot();
  assert.equal(snap.entries.length, 0);
  assert.deepEqual(snap.settled, [summary.hash]);
});

test("a corrupt stored record loads as an empty queue", async () => {
  const storage = makeStorage();
  storage.map.set(RUN_QUEUE_KEY, "not json{");
  const writes = stubWrites([]);
  const queue = createRunQueue({ storage, writes, competeOn: () => true, online: () => true });
  const snap = await queue.snapshot();
  assert.deepEqual(snap, { entries: [], settled: [], failures: 0, retryAt: 0 });
});

test("purge() removes the storage key and resets the in-memory record", async () => {
  const storage = makeStorage();
  const writes = stubWrites([{ ok: true, status: "created" }]);
  const queue = createRunQueue({ storage, writes, competeOn: () => true, online: () => false });
  await queue.enqueue(baseSummary(), { version: "1" });
  assert.equal(storage.map.has(RUN_QUEUE_KEY), true);

  await queue.purge();
  assert.equal(storage.map.has(RUN_QUEUE_KEY), false);

  const snap = await queue.snapshot();
  assert.deepEqual(snap, { entries: [], settled: [], failures: 0, retryAt: 0 });
});

test("more than QUEUE_MAX entries drops the oldest with a log line containing overflow", async () => {
  const storage = makeStorage();
  const writes = stubWrites([]);
  const log = makeLog();
  const queue = createRunQueue({ storage, writes, competeOn: () => true, online: () => true, log });

  const list = [];
  for (let i = 0; i < QUEUE_MAX + 5; i++) list.push(baseSummary({ steps: 500 + i }));
  const res = await queue.enqueueMany(list, { version: "1" });
  assert.equal(res.ok, true);
  assert.equal(res.queued, QUEUE_MAX + 5);
  assert.equal(res.skipped, 0);

  const snap = await queue.snapshot();
  assert.equal(snap.entries.length, QUEUE_MAX);
  assert.equal(snap.entries[0].hash, list[5].hash, "the 5 oldest entries were dropped");
  assert.ok(log.lines.some((l) => l.includes("overflow")));
});

test("enqueueMany: queues every valid, unseen run in one persist, no requests", async () => {
  const storage = makeStorage();
  const writes = stubWrites([]);
  const queue = createRunQueue({ storage, writes, competeOn: () => true, online: () => true });

  const a = baseSummary({ steps: 501 });
  const b = baseSummary({ steps: 502 });
  const badHash = baseSummary({ hash: "nope" });

  const res = await queue.enqueueMany([a, b, badHash, a], { version: "1" });
  assert.equal(res.ok, true);
  assert.equal(res.queued, 2);
  assert.equal(res.skipped, 2); // the invalid one, and the re-listed duplicate of a
  assert.equal(storage.calls.setItem, 1, "one persist for the whole batch");
  assert.equal(writes.calls.length, 0);
});

test("enqueueMany: Compete OFF resolves off and stores nothing", async () => {
  const storage = makeStorage();
  const writes = stubWrites([]);
  const queue = createRunQueue({ storage, writes, competeOn: () => false, online: () => true });
  const res = await queue.enqueueMany([baseSummary()], { version: "1" });
  assert.deepEqual(res, { ok: false, reason: "off" });
  assert.equal(storage.calls.setItem, 0);
});

/* ================================================================
   purity
   ================================================================ */

test("purity: runQueue.js never touches DOM globals and never calls the bare global fetch", () => {
  const code = stripJs(RUN_QUEUE_SRC);
  for (const banned of [/\bwindow\b/, /\bnavigator\b/, /\blocalStorage\b/, /\bsessionStorage\b/]) {
    assert.doesNotMatch(code, banned, `must not use ${banned}`);
  }
  assert.doesNotMatch(code, /(?<!\.)\bdocument\b(?!\s*:)/, "must not use the DOM global `document`");
  assert.doesNotMatch(code, /(?<!\w)fetch\(/, "must never call the global fetch directly");
});

test("purity: exports createRunQueue exactly once, and RUN_QUEUE_KEY appears", () => {
  assert.equal((RUN_QUEUE_SRC.match(/export function createRunQueue/g) || []).length, 1);
  assert.ok((RUN_QUEUE_SRC.match(/ddr\.runQueue\.v1/g) || []).length >= 1);
});
