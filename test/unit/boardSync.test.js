// test/unit/boardSync.test.js
//
// Phase 85 Plan 02 Task 2. End-to-end proof of createBoardSync against
// src/browser/fakeBoardServer.js, a real createIdentity (83-03) and a real
// createBoardClient (83-04): death-time submission, flush (coalesced,
// serialized, with the pending handle rewrite applied first), the offline
// re-roll retry, erase-keeps-the-handle, boot's retired-key drop and
// bounded backfill, placement reports, and waitForPending.

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
import { createBoardClient } from "../../src/browser/boardClient.js";
import { BACKFILL_SINCE_MS } from "../../src/browser/runBackfill.js";
import { RETIRED_KEYS, HANDLE_REWRITE_KEY, createBoardSync } from "../../src/browser/boardSync.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const BOARD_SYNC_SRC = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "boardSync.js"), "utf8").replace(/\r\n/g, "\n");

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

function clockBox(start = BACKFILL_SINCE_MS + 500000) {
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
    when: BACKFILL_SINCE_MS + 500000,
    season: SEASON,
    seed: 12345,
    acts: 10,
    ...overrides,
  };
  if (!("hash" in overrides)) s.hash = runHash(s);
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

function hexHash(n) {
  return n.toString(16).padStart(8, "0");
}

function commitCalls(fake) {
  return fake.calls().filter((c) => c.method === "POST" && c.url.includes(":commit"));
}

/** wrapAfterNCalls(fn, n) — the first `n` calls pass through; every call after that rejects like a dropped connection. */
function wrapAfterNCalls(fn, n) {
  let count = 0;
  return async (u, init) => {
    count += 1;
    if (count > n) throw new TypeError("Failed to fetch");
    return fn(u, init);
  };
}

/**
 * makeStack({competeOn, online, fakeOpts, version, liveHash}) — builds a
 * fake board, a real identity, a real client and a boardSync all sharing
 * one storage/fetchFn/config, mirroring the shell's own wiring.
 */
function makeStack({
  competeOn = true,
  online = true,
  fakeOpts = {},
  version = () => "2.2.0 (12)",
  liveHash = () => null,
} = {}) {
  const clock = clockBox();
  const fake = createFakeBoardFetch({ config: VALID_CONFIG, transition: true, now: clock, ...fakeOpts });
  const idStorage = makeStorage();
  const syncStorage = makeStorage();
  let competing = competeOn;
  let onlineFlag = online;

  const identity = createIdentity({
    storage: idStorage,
    fetchFn: fake.fetchFn,
    config: VALID_CONFIG,
    competeOn: () => competing,
    now: clock,
    random: () => 0.42,
  });
  const client = createBoardClient({ fetchFn: fake.fetchFn, config: VALID_CONFIG, competeOn: () => competing, now: clock });

  const calls = { onAcked: [], onPlacement: [], onChange: 0 };
  const sync = createBoardSync({
    storage: syncStorage,
    fetchFn: fake.fetchFn,
    identity,
    client,
    config: VALID_CONFIG,
    competeOn: () => competing,
    online: () => onlineFlag,
    version,
    liveHash,
    now: clock,
    onAcked: (n) => calls.onAcked.push(n),
    onPlacement: (p) => calls.onPlacement.push(p),
    onChange: () => {
      calls.onChange += 1;
    },
  });

  return {
    clock,
    fake,
    identity,
    client,
    sync,
    storage: syncStorage,
    idStorage,
    calls,
    setCompeting: (v) => {
      competing = v;
    },
    setOnline: (v) => {
      onlineFlag = v;
    },
  };
}

/* ================================================================
   constants
   ================================================================ */

test("constants: RETIRED_KEYS holds exactly one retired key; HANDLE_REWRITE_KEY", () => {
  assert.deepEqual(RETIRED_KEYS, ["ddr.pgsqueue.v1"]);
  assert.ok(Object.isFrozen(RETIRED_KEYS));
  assert.equal(HANDLE_REWRITE_KEY, "ddr.handleRewrite.v1");
});

test("createBoardSync returns a frozen API", () => {
  const stack = makeStack();
  const api = stack.sync;
  assert.ok(Object.isFrozen(api));
  assert.deepEqual(Object.keys(api).sort(), ["boot", "erase", "flush", "purge", "record", "reroll", "waitForPending"].sort());
});

/* ================================================================
   record()
   ================================================================ */

test("record: Compete ON queues, submits, acks once, and reports a live placement", async () => {
  const s = baseSummary();
  const stack = makeStack({ liveHash: () => s.hash });
  const res = await stack.sync.record(s);
  assert.equal(res.ok, true);

  const docs = stack.fake.docs();
  assert.equal(docs.length, 1);
  assert.equal(docs[0].hash, s.hash);
  assert.equal(docs[0].version, "2.2.0 (12)");
  assert.ok(isValidHandle(docs[0].handle));

  assert.deepEqual(stack.calls.onAcked, [1]);
  assert.equal(stack.calls.onPlacement.length, 1);
  const { live, rest } = stack.calls.onPlacement[0];
  assert.deepEqual(live, { hash: s.hash, rank: 1, total: 1 });
  assert.equal(rest, null);
});

test("record: Compete OFF makes zero calls, stores nothing, fires no callback", async () => {
  const stack = makeStack({ competeOn: false });
  const s = baseSummary();
  const before = stack.fake.calls().length;

  const res = await stack.sync.record(s);
  assert.equal(res.ok, false);
  assert.equal(res.reason, "off");
  assert.equal(stack.fake.calls().length, before);
  assert.equal(stack.storage.map.has("ddr.runQueue.v1"), false);
  assert.equal(stack.calls.onAcked.length, 0);
  assert.equal(stack.calls.onPlacement.length, 0);
});

test("record: offline stays queued with no ack; a later forced flush submits it and reports it in `rest`", async () => {
  const s = baseSummary();
  const stack = makeStack({ online: false, liveHash: () => "ffffffff" });

  const res = await stack.sync.record(s);
  assert.equal(res.ok, true);
  assert.equal(res.queued, true);
  assert.equal(stack.calls.onAcked.length, 0);
  assert.equal(stack.fake.docs().length, 0);

  stack.setOnline(true);
  const flushRes = await stack.sync.flush({ force: true });
  assert.equal(flushRes.ok, true);
  assert.equal(stack.fake.docs().length, 1);
  assert.deepEqual(stack.calls.onAcked, [1]);
  assert.equal(stack.calls.onPlacement.length, 1);
  const { live, rest } = stack.calls.onPlacement[0];
  assert.equal(live, null);
  assert.deepEqual(rest, { count: 1, hash: s.hash, rank: 1, total: 1 });
});

test("flush: two runs acknowledged together report rest.count 2 with the deeper (better-ranked) run", async () => {
  const a = baseSummary({ floor: 3, steps: 501 });
  const b = baseSummary({ floor: 7, steps: 502 });
  const stack = makeStack({ online: false, liveHash: () => "ffffffff" });

  await stack.sync.record(a);
  await stack.sync.record(b);
  assert.equal(stack.fake.docs().length, 0);

  stack.setOnline(true);
  const flushRes = await stack.sync.flush({ force: true });
  assert.equal(flushRes.ok, true);
  assert.equal(stack.fake.docs().length, 2);
  assert.deepEqual(stack.calls.onAcked, [2]);
  assert.equal(stack.calls.onPlacement.length, 1);
  const { live, rest } = stack.calls.onPlacement[0];
  assert.equal(live, null);
  assert.equal(rest.count, 2);
  assert.equal(rest.hash, b.hash, "the deeper of the two carries the better rank");
  assert.equal(rest.rank, 1);
});

test("settleAcks: a failed rank read reports null; onPlacement never fires when both parts are null", async () => {
  const s = baseSummary();
  const clock = clockBox();
  const fake = createFakeBoardFetch({ config: VALID_CONFIG, transition: true, now: clock });
  const idStorage = makeStorage();
  const identity = createIdentity({ storage: idStorage, fetchFn: fake.fetchFn, config: VALID_CONFIG, competeOn: () => true, now: clock, random: () => 0.42 });
  const failingClient = {
    rankOf: async () => ({ ok: false, reason: "offline" }),
    total: async () => ({ ok: false, reason: "offline" }),
    clear() {},
  };
  let acked = 0;
  let placementCalls = 0;
  const sync = createBoardSync({
    storage: makeStorage(),
    fetchFn: fake.fetchFn,
    identity,
    client: failingClient,
    config: VALID_CONFIG,
    competeOn: () => true,
    online: () => true,
    version: () => "2.2.0 (12)",
    liveHash: () => s.hash,
    now: clock,
    onAcked: () => {
      acked += 1;
    },
    onPlacement: () => {
      placementCalls += 1;
    },
  });

  const res = await sync.record(s);
  assert.equal(res.ok, true);
  assert.equal(acked, 1);
  assert.equal(placementCalls, 0);
});

/* ================================================================
   flush()
   ================================================================ */

test("flush: Compete OFF makes zero calls", async () => {
  const stack = makeStack({ competeOn: false });
  const before = stack.fake.calls().length;
  const res = await stack.sync.flush({});
  assert.deepEqual(res, { ok: false, reason: "off" });
  assert.equal(stack.fake.calls().length, before);
});

test("flush: coalesced and serialized — three concurrent calls apply a pending handle rewrite at most once", async () => {
  const stack = makeStack();
  const s = baseSummary();
  await stack.sync.record(s);
  assert.equal(stack.fake.docs().length, 1);

  // Change the handle directly (bypassing boardSync.reroll()'s own
  // fire-and-forget flush) so there is something for the rewrite to do,
  // then set the pending mark by hand.
  await stack.identity.rerollHandle();
  await stack.storage.setItem(HANDLE_REWRITE_KEY, "1");
  const before = commitCalls(stack.fake).length;

  const results = await Promise.all([stack.sync.flush({}), stack.sync.flush({}), stack.sync.flush({})]);
  for (const r of results) assert.equal(r.ok, true);

  const after = commitCalls(stack.fake).length;
  assert.equal(after - before, 1, "exactly one rewrite commit, never three");
  assert.equal(stack.storage.map.has(HANDLE_REWRITE_KEY), false);
});

/* ================================================================
   reroll()
   ================================================================ */

test("reroll: with Compete OFF resolves {handle, previous}, makes zero fetch calls, and stores the rewrite mark", async () => {
  const stack = makeStack({ competeOn: false });
  const before = stack.fake.calls().length;
  const res = await stack.sync.reroll();
  assert.ok(isValidHandle(res.handle));
  assert.notEqual(res.handle, res.previous);
  assert.equal(stack.fake.calls().length, before);
  await stack.sync.waitForPending();
  assert.equal(stack.storage.map.has(HANDLE_REWRITE_KEY), true);
});

test("reroll: rewrites the handle on every one of the player's board runs, leaves another player's untouched, and clears the mark", async () => {
  const otherRun = seedFor({ uid: "otheruid", hash: "0000ff01", handle: validHandle(0.11) });
  const stack = makeStack({ fakeOpts: { runs: [otherRun] } });

  const a = baseSummary({ steps: 501 });
  const b = baseSummary({ steps: 502 });
  await stack.sync.record(a);
  await stack.sync.record(b);
  assert.equal(stack.fake.docs().length, 3);

  const before = await stack.identity.snapshot();
  const oldHandle = before.handle;

  const rerollRes = await stack.sync.reroll();
  assert.notEqual(rerollRes.handle, oldHandle);
  await stack.sync.waitForPending();
  assert.equal(stack.storage.map.has(HANDLE_REWRITE_KEY), true);

  const flushRes = await stack.sync.flush({ force: true });
  assert.equal(flushRes.ok, true);

  const docs = stack.fake.docs();
  const mine = docs.filter((d) => d.uid !== "otheruid");
  const theirs = docs.filter((d) => d.uid === "otheruid");
  assert.equal(mine.length, 2);
  assert.ok(mine.every((d) => d.handle === rerollRes.handle));
  assert.equal(theirs.length, 1);
  assert.equal(theirs[0].handle, otherRun.doc.handle);

  assert.equal(stack.storage.map.has(HANDLE_REWRITE_KEY), false);
});

test("reroll: a rewrite attempt that fails offline keeps the mark", async () => {
  const stack = makeStack();
  const s = baseSummary();
  await stack.sync.record(s);

  await stack.sync.reroll();
  await stack.sync.waitForPending();
  assert.equal(stack.storage.map.has(HANDLE_REWRITE_KEY), true);

  stack.fake.setOnline(false);
  await stack.sync.flush({ force: true });
  assert.equal(stack.storage.map.has(HANDLE_REWRITE_KEY), true, "the mark survives a failed rewrite attempt");
});

/* ================================================================
   erase()
   ================================================================ */

test("erase: Compete OFF resolves {ok:false, reason:'off'} with zero calls", async () => {
  const stack = makeStack({ competeOn: false });
  const before = stack.fake.calls().length;
  const res = await stack.sync.erase();
  assert.deepEqual(res, { ok: false, reason: "off" });
  assert.equal(stack.fake.calls().length, before);
});

test("erase: deletes every board run, keeps the SAME handle with uid null, purges the queue, clears the mark, fires onChange, and a later record() posts under a NEW uid with the SAME handle", async () => {
  const stack = makeStack();
  const a = baseSummary({ steps: 501 });
  const b = baseSummary({ steps: 502 });
  const c = baseSummary({ steps: 503 });
  await stack.sync.record(a);
  await stack.sync.record(b);
  await stack.sync.record(c);
  assert.equal(stack.fake.docs().length, 3);

  const beforeSnap = await stack.identity.snapshot();
  const oldUid = beforeSnap.uid;
  const oldHandle = beforeSnap.handle;

  const res = await stack.sync.erase();
  assert.equal(res.ok, true);
  assert.equal(res.deleted, 3);
  assert.equal(stack.fake.docs().length, 0);

  const afterSnap = await stack.identity.snapshot();
  assert.equal(afterSnap.handle, oldHandle);
  assert.equal(afterSnap.uid, null);

  assert.ok(stack.calls.onChange > 0);

  const queueRaw = stack.storage.map.get("ddr.runQueue.v1");
  const queueSnap = queueRaw ? JSON.parse(queueRaw) : null;
  assert.ok(queueSnap === null || queueSnap.entries.length === 0);
  assert.equal(stack.storage.map.has(HANDLE_REWRITE_KEY), false);

  const d = baseSummary({ steps: 504 });
  await stack.sync.record(d);
  assert.equal(stack.fake.docs().length, 1);
  const doc = stack.fake.docs()[0];
  assert.notEqual(doc.uid, oldUid);
  assert.equal(doc.handle, oldHandle);
});

test("erase: never touches ddr.runs.v1, ddr.graveyard.v1 or ddr.bests.v1", async () => {
  const stack = makeStack();
  await stack.storage.setItem("ddr.runs.v1", "unchanged-runs");
  await stack.storage.setItem("ddr.graveyard.v1", "unchanged-grave");
  await stack.storage.setItem("ddr.bests.v1", "unchanged-bests");

  await stack.sync.record(baseSummary());
  await stack.sync.erase();

  assert.equal(stack.storage.map.get("ddr.runs.v1"), "unchanged-runs");
  assert.equal(stack.storage.map.get("ddr.graveyard.v1"), "unchanged-grave");
  assert.equal(stack.storage.map.get("ddr.bests.v1"), "unchanged-bests");
});

test("erase: a mid-way network failure resolves {ok:false, reason:'offline', deleted}, leaving the identity uid and queue untouched", async () => {
  const mine = [];
  for (let i = 0; i < 60; i++) mine.push(seedFor({ uid: "fakeuid000001", hash: hexHash(i + 1) }));
  const clock = clockBox();
  const fake = createFakeBoardFetch({ config: VALID_CONFIG, transition: true, now: clock, runs: mine });
  const idStorage = makeStorage();
  const identity = createIdentity({ storage: idStorage, fetchFn: fake.fetchFn, config: VALID_CONFIG, competeOn: () => true, now: clock, random: () => 0.42 });
  await identity.getToken(); // signs up as fakeuid000001, caches the token — not counted below

  const client = createBoardClient({ fetchFn: fake.fetchFn, config: VALID_CONFIG, competeOn: () => true, now: clock });
  const syncStorage = makeStorage();
  const wrappedFetch = wrapAfterNCalls(fake.fetchFn, 2); // the query + the first page's delete commit

  const sync = createBoardSync({
    storage: syncStorage,
    fetchFn: wrappedFetch,
    identity,
    client,
    config: VALID_CONFIG,
    competeOn: () => true,
    online: () => true,
    now: clock,
  });

  const res = await sync.erase();
  assert.equal(res.ok, false);
  assert.equal(res.reason, "offline");
  assert.equal(res.deleted, 50);

  assert.equal(idStorage.map.has("ddr.identity.v1"), true);
  const snap = await identity.snapshot();
  assert.equal(snap.uid, "fakeuid000001");
});

test("record: a call started while erase() is running is refused (the gate reads the erasing flag)", async () => {
  const stack = makeStack();
  await stack.sync.record(baseSummary({ steps: 500 }));
  assert.equal(stack.fake.docs().length, 1);

  const erasePromise = stack.sync.erase(); // sets erasing=true synchronously
  const midRecord = await stack.sync.record(baseSummary({ steps: 501 }));
  assert.equal(midRecord.ok, false);
  assert.equal(midRecord.reason, "off");

  const eraseRes = await erasePromise;
  assert.equal(eraseRes.ok, true);
  assert.equal(stack.fake.docs().length, 0, "the mid-erase record never landed on the board");
});

/* ================================================================
   boot()
   ================================================================ */

test("boot: removes RETIRED_KEYS silently (Compete ON and OFF), zero fetch calls with OFF", async () => {
  for (const competeOn of [true, false]) {
    const stack = makeStack({ competeOn });
    await stack.storage.setItem("ddr.pgsqueue.v1", "leftover");
    const before = stack.fake.calls().length;
    const res = await stack.sync.boot({ history: [] });
    assert.equal(res.ok, true);
    assert.equal(stack.storage.map.has("ddr.pgsqueue.v1"), false);
    if (!competeOn) assert.equal(stack.fake.calls().length, before);
  }
});

test("boot: leaves ddr.graveyard.v1 and ddr.bests.v1 byte-identical", async () => {
  const stack = makeStack();
  await stack.storage.setItem("ddr.graveyard.v1", "[]");
  await stack.storage.setItem("ddr.bests.v1", "{}");
  await stack.sync.boot({ history: [] });
  assert.equal(stack.storage.map.get("ddr.graveyard.v1"), "[]");
  assert.equal(stack.storage.map.get("ddr.bests.v1"), "{}");
});

test("boot: bounds the backfill to the local history's pre-2.2 imports and flushes it when Compete is ON", async () => {
  const stack = makeStack();
  const legacy = baseSummary({ when: BACKFILL_SINCE_MS + 1000, steps: 701 });
  const laterRun = baseSummary({ when: BACKFILL_SINCE_MS + 2000, steps: 702 });
  await stack.storage.setItem("ddr.graveyard.v1", JSON.stringify([legacy, laterRun]));

  const history = [
    { hash: legacy.hash, version: "2.1.0 (11)" },
    { hash: laterRun.hash, version: "2.2.0 (12)" },
  ];

  const res = await stack.sync.boot({ history });
  assert.equal(res.ok, true);
  await res.backfill.flushed;

  const docs = stack.fake.docs();
  assert.equal(docs.length, 1);
  assert.equal(docs[0].hash, legacy.hash);
  assert.equal(docs[0].version, "2.1.0 (11)");
});

test("boot: a first launch with Compete OFF marks the backfill done-as-skipped; a later Compete-ON boot uploads nothing from it", async () => {
  const stack = makeStack({ competeOn: false });
  const legacy = baseSummary({ when: BACKFILL_SINCE_MS + 1000, steps: 703 });
  await stack.storage.setItem("ddr.graveyard.v1", JSON.stringify([legacy]));
  const history = [{ hash: legacy.hash, version: "2.1.0 (11)" }];

  const firstBoot = await stack.sync.boot({ history });
  assert.equal(firstBoot.ok, true);
  const marker = JSON.parse(stack.storage.map.get("ddr.boardBackfill.v1"));
  assert.deepEqual(marker, { v: 1, done: true, count: 0, skipped: "off" });

  stack.setCompeting(true);
  const secondBoot = await stack.sync.boot({ history });
  assert.equal(secondBoot.ok, true);
  assert.equal(secondBoot.backfill.skipped, true);
  assert.equal(stack.fake.docs().length, 0, "the pre-2.2 run was never uploaded");
});

/* ================================================================
   waitForPending()
   ================================================================ */

test("waitForPending: resolves after the queue's own storage write from an un-awaited record() call settles", async () => {
  const stack = makeStack({ online: false });
  const s = baseSummary();
  const recordPromise = stack.sync.record(s); // fire-and-forget

  await new Promise((r) => setTimeout(r, 0)); // let record()'s internal load()/persist() reach the write
  await stack.sync.waitForPending();

  assert.equal(stack.storage.map.has("ddr.runQueue.v1"), true);
  const stored = JSON.parse(stack.storage.map.get("ddr.runQueue.v1"));
  assert.equal(stored.entries.length, 1);
  await recordPromise;
});

/* ================================================================
   purity
   ================================================================ */

test("purity: boardSync.js never touches DOM globals and never calls the bare global fetch", () => {
  const code = stripJs(BOARD_SYNC_SRC);
  for (const banned of [/\bwindow\b/, /\bnavigator\b/, /\blocalStorage\b/, /\bsessionStorage\b/]) {
    assert.doesNotMatch(code, banned, `must not use ${banned}`);
  }
  assert.doesNotMatch(code, /(?<!\.)\bdocument\b(?!\s*:)/, "must not use the DOM global `document`");
  assert.doesNotMatch(code, /(?<!\w)fetch\(/, "must never call the global fetch directly");
});

test("purity: exports createBoardSync exactly once; RETIRED_KEYS holds exactly the one retired key literal", () => {
  assert.equal((BOARD_SYNC_SRC.match(/export function createBoardSync/g) || []).length, 1);
  assert.equal((BOARD_SYNC_SRC.match(/ddr\.pgsqueue\.v1/g) || []).length, 1);
  assert.ok((BOARD_SYNC_SRC.match(/setHandle/g) || []).length >= 1);
  assert.ok((BOARD_SYNC_SRC.match(/preReleaseHashes\(/g) || []).length >= 1);
});
