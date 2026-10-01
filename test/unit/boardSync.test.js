// test/unit/boardSync.test.js
//
// Phase 85 Plan 02 Task 2, moved to the named flow by Phase 91.2 Plan 05.
// End-to-end proof of createBoardSync on the shared rig
// (test/unit/harness/boardHarness.js: the fake board server under the FINAL
// rules, a fake Play Games player, the real identity) plus a real
// createBoardClient: death-time submission under the verified name, flush
// (coalesced, serialized), erase (runs, name, account, queue; nothing
// re-seeded), boot's retired-key drops and bounded backfill, placement
// reports, and waitForPending. There is no re-roll any more (D-11).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { stripJs } from "../../tools/ident-sweep.mjs";
import { SEASON } from "../../content/season.js";
import { runHash } from "../../engine/records.js";
import { RUN_CLIENT_FIELDS, rankKeys, runDocId } from "../../src/browser/runDoc.js";
import { IDENTITY_KEY } from "../../src/browser/firebaseAuth.js";
import { createBoardClient } from "../../src/browser/boardClient.js";
import { BACKFILL_SINCE_MS } from "../../src/browser/runBackfill.js";
import * as boardSyncModule from "../../src/browser/boardSync.js";
import { makeBoardRig, makeMemoryStorage } from "./harness/boardHarness.js";

const { RETIRED_KEYS, createBoardSync } = boardSyncModule;

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const BOARD_SYNC_SRC = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "boardSync.js"), "utf8").replace(/\r\n/g, "\n");

const PLAYER_NAME = "Dev Delver"; // the fake Play Games player's default name

/* ---------------- helpers ---------------- */

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

function docFor(overrides = {}) {
  const merged = {
    uid: "fakeuid000001",
    handle: PLAYER_NAME,
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
    version: "2.3.0 (13)",
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

/** A sync-side storage that also lists every key it was asked to read. */
function makeSyncStorage() {
  const store = makeMemoryStorage();
  const reads = [];
  const inner = store.getItem;
  store.getItem = async (key) => {
    reads.push(key);
    return inner(key);
  };
  store.reads = reads;
  return store;
}

/**
 * makeStack({competeOn, online, fakeOpts, version, liveHash}) — the shared rig
 * (fake board in final mode, a signed-in fake player, the real identity), a
 * real client and a boardSync, all on one clock, mirroring the shell's wiring.
 */
function makeStack({
  competeOn = true,
  online = true,
  fakeOpts = {},
  play = {},
  version = () => "2.3.0 (13)",
  liveHash = () => null,
  wrapClient = (c) => c,
  identityOverride = null,
} = {}) {
  const clock = clockBox();
  let competing = competeOn;
  let onlineFlag = online;
  const rig = makeBoardRig({ now: clock, fakeOpts, play, competeOn: () => competing });
  const syncStorage = makeSyncStorage();
  const client = createBoardClient({ fetchFn: rig.fetchFn, config: rig.config, competeOn: () => competing, now: clock });

  const calls = { onAcked: [], onPlacement: [], onChange: 0, onSession: [] };
  const sync = createBoardSync({
    storage: syncStorage,
    fetchFn: rig.fetchFn,
    identity: identityOverride || rig.identity,
    client: wrapClient(client),
    onSession: (info) => calls.onSession.push(info),
    config: rig.config,
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
    rig,
    fake: rig.fake,
    identity: rig.identity,
    client,
    sync,
    storage: syncStorage,
    idStorage: rig.storage,
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

test("constants: RETIRED_KEYS is exactly the pre-2.2 queue key and the 2.2 re-roll mark (D-11)", () => {
  assert.deepEqual(RETIRED_KEYS, ["ddr.pgsqueue.v1", "ddr.handleRewrite.v1"]);
  assert.ok(Object.isFrozen(RETIRED_KEYS));
  assert.equal("HANDLE_REWRITE_KEY" in boardSyncModule, false, "the rewrite-mark constant is gone");
});

test("createBoardSync returns a frozen API with the session methods and no reroll", () => {
  const stack = makeStack();
  const api = stack.sync;
  assert.ok(Object.isFrozen(api));
  assert.deepEqual(Object.keys(api).sort(), ["boot", "erase", "flush", "purge", "record", "session", "signIn", "waitForPending"].sort());
});

/* ================================================================
   record()
   ================================================================ */

test("record: Compete ON queues, submits under the verified name, acks once, and reports a live placement", async () => {
  const s = baseSummary();
  const stack = makeStack({ liveHash: () => s.hash, play: { playerId: "p-ann", displayName: "Ann the Bold" } });
  const res = await stack.sync.record(s);
  assert.equal(res.ok, true);

  const docs = stack.fake.docs();
  assert.equal(docs.length, 1);
  assert.equal(docs[0].hash, s.hash);
  assert.equal(docs[0].version, "2.3.0 (13)");
  assert.equal(docs[0].handle, "Ann the Bold");

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
  assert.equal(stack.rig.play.calls().length, 0);
  assert.equal(stack.storage.map.has("ddr.runQueue.v1"), false);
  assert.equal(stack.calls.onAcked.length, 0);
  assert.equal(stack.calls.onPlacement.length, 0);
});

test("record: a player who is not signed in to Play Games posts nothing and keeps the run queued", async () => {
  const s = baseSummary();
  const stack = makeStack({ play: { signedIn: false, interactive: false } });
  const res = await stack.sync.record(s);
  assert.equal(res.ok, true);
  assert.equal(res.queued, true);
  assert.equal(stack.fake.docs().length, 0);
  assert.equal(stack.calls.onAcked.length, 0);
  const stored = JSON.parse(stack.storage.map.get("ddr.runQueue.v1"));
  assert.equal(stored.entries.length, 1, "the run waits in the queue");
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
  const rig = makeBoardRig({ now: clock });
  const failingClient = {
    rankOf: async () => ({ ok: false, reason: "offline" }),
    total: async () => ({ ok: false, reason: "offline" }),
    clear() {},
  };
  let acked = 0;
  let placementCalls = 0;
  const sync = createBoardSync({
    storage: makeMemoryStorage(),
    fetchFn: rig.fetchFn,
    identity: rig.identity,
    client: failingClient,
    config: rig.config,
    competeOn: () => true,
    online: () => true,
    version: () => "2.3.0 (13)",
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

test("flush: coalesced and serialized: three concurrent calls post each queued run once", async () => {
  const stack = makeStack({ online: false });
  await stack.sync.record(baseSummary({ steps: 501 }));
  await stack.sync.record(baseSummary({ steps: 502 }));
  assert.equal(stack.fake.docs().length, 0);

  stack.setOnline(true);
  const before = commitCalls(stack.fake).length;
  const results = await Promise.all([stack.sync.flush({ force: true }), stack.sync.flush({ force: true }), stack.sync.flush({ force: true })]);
  for (const r of results) assert.equal(r.ok, true);

  assert.equal(stack.fake.docs().length, 2);
  assert.equal(commitCalls(stack.fake).length - before, 2, "one create per run, never one per flush call");
});

test("flush: no longer reads or writes any rewrite mark (D-11)", async () => {
  const stack = makeStack();
  await stack.sync.record(baseSummary());
  await stack.storage.setItem("ddr.handleRewrite.v1", "1");
  stack.storage.reads.length = 0;

  const res = await stack.sync.flush({ force: true });
  assert.equal(res.ok, true);
  assert.equal(stack.storage.reads.includes("ddr.handleRewrite.v1"), false, "flush never looks at the mark");
  assert.equal(stack.storage.map.get("ddr.handleRewrite.v1"), "1", "and never clears it");
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

test("erase: deletes every board run, releases the name, deletes the account, purges the queue, re-seeds nothing, fires onChange; a later record() signs in afresh", async () => {
  const stack = makeStack();
  const a = baseSummary({ steps: 501 });
  const b = baseSummary({ steps: 502 });
  const c = baseSummary({ steps: 503 });
  await stack.sync.record(a);
  await stack.sync.record(b);
  await stack.sync.record(c);
  assert.equal(stack.fake.docs().length, 3);
  assert.equal(stack.fake.names().length, 1);

  const oldUid = (await stack.identity.snapshot()).uid;

  const res = await stack.sync.erase();
  assert.equal(res.ok, true);
  assert.equal(res.deleted, 3);
  assert.equal(stack.fake.docs().length, 0);
  assert.equal(stack.fake.names().length, 0, "the name record is released");
  assert.ok(!stack.fake.users().includes(oldUid), "the account is deleted");

  assert.deepEqual({ ...(await stack.identity.snapshot()) }, { uid: null, name: null, linked: false, playerId: null }, "nothing is re-seeded");
  assert.equal(stack.idStorage.map.has(IDENTITY_KEY), false);

  assert.ok(stack.calls.onChange > 0);

  const queueRaw = stack.storage.map.get("ddr.runQueue.v1");
  const queueSnap = queueRaw ? JSON.parse(queueRaw) : null;
  assert.ok(queueSnap === null || queueSnap.entries.length === 0);

  const d = baseSummary({ steps: 504 });
  await stack.sync.record(d);
  assert.equal(stack.fake.docs().length, 1);
  const doc = stack.fake.docs()[0];
  assert.notEqual(doc.uid, oldUid, "a new account");
  assert.equal(doc.handle, PLAYER_NAME, "claimed afresh from Play Games");
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

test("erase: a mid-way network failure resolves {ok:false, reason:'offline', deleted}, leaving the identity, the name and the queue untouched", async () => {
  const mine = [];
  for (let i = 0; i < 60; i++) mine.push(seedFor({ uid: "fakeuid000001", hash: hexHash(i + 1) }));
  const clock = clockBox();
  const rig = makeBoardRig({ now: clock, fakeOpts: { runs: mine } });
  const session = await rig.identity.boardSession(); // signs in as fakeuid000001 and claims; not counted below
  assert.equal(session.uid, "fakeuid000001");

  const client = createBoardClient({ fetchFn: rig.fetchFn, config: rig.config, competeOn: () => true, now: clock });
  const syncStorage = makeMemoryStorage();
  const wrappedFetch = wrapAfterNCalls(rig.fetchFn, 2); // the query + the first page's delete commit

  const sync = createBoardSync({
    storage: syncStorage,
    fetchFn: wrappedFetch,
    identity: rig.identity,
    client,
    config: rig.config,
    competeOn: () => true,
    online: () => true,
    now: clock,
  });

  const res = await sync.erase();
  assert.equal(res.ok, false);
  assert.equal(res.reason, "offline");
  assert.equal(res.deleted, 50);

  assert.equal(rig.storage.map.has(IDENTITY_KEY), true);
  assert.equal((await rig.identity.snapshot()).uid, "fakeuid000001");
  assert.equal(rig.fake.names().length, 1, "the name is released only with the account");
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

test("boot: removes every RETIRED_KEYS entry silently (Compete ON and OFF), zero fetch calls with OFF", async () => {
  for (const competeOn of [true, false]) {
    const stack = makeStack({ competeOn });
    for (const key of RETIRED_KEYS) await stack.storage.setItem(key, "leftover");
    const before = stack.fake.calls().length;
    const res = await stack.sync.boot({ history: [] });
    assert.equal(res.ok, true);
    for (const key of RETIRED_KEYS) assert.equal(stack.storage.map.has(key), false, `${key} is dropped`);
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
  assert.equal(docs[0].handle, PLAYER_NAME, "the backfilled run carries the verified name too");
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
   session() / signIn() / onSession (91.2-06: D-03, D-06)
   ================================================================ */

test("session: a signed-in player is reported signedIn with the verified name, and held runs flush", async () => {
  const stack = makeStack({ play: { signedIn: false, interactive: false } });
  const s = baseSummary({ steps: 801 });
  await stack.sync.record(s);
  assert.equal(stack.fake.docs().length, 0);

  stack.rig.play.setSignedIn(true);
  stack.calls.onSession.length = 0;
  const info = await stack.sync.session();
  assert.deepEqual({ ...info }, { state: "signedIn", name: PLAYER_NAME });
  assert.ok(Object.isFrozen(info));
  assert.deepEqual(stack.calls.onSession, [info]);
  assert.equal(stack.fake.docs().length, 1, "the held run posted");
  assert.equal(stack.fake.docs()[0].handle, PLAYER_NAME);
});

test("session: a signed-out player is reported signedOut and nothing posts", async () => {
  const stack = makeStack({ play: { signedIn: false, interactive: true } });
  await stack.sync.record(baseSummary({ steps: 802 }));
  stack.calls.onSession.length = 0;

  const info = await stack.sync.session();
  assert.deepEqual({ ...info }, { state: "signedOut", name: null });
  assert.deepEqual(stack.calls.onSession.map((i) => ({ ...i })), [{ state: "signedOut", name: null }]);
  assert.equal(stack.fake.docs().length, 0);
  assert.equal(stack.rig.play.calls().some((c) => c.method === "signIn"), false, "the quiet session never prompts");
});

test("signIn: an interactive sign-in succeeds, reports signedIn and posts the held runs", async () => {
  const stack = makeStack({ play: { signedIn: false, interactive: true } });
  await stack.sync.record(baseSummary({ steps: 803 }));
  await stack.sync.record(baseSummary({ steps: 804 }));
  assert.equal(stack.fake.docs().length, 0);

  stack.calls.onSession.length = 0;
  const info = await stack.sync.signIn();
  assert.equal(info.state, "signedIn");
  assert.equal(info.name, PLAYER_NAME);
  assert.deepEqual(stack.calls.onSession.map((i) => i.state), ["signedIn"]);
  assert.equal(stack.fake.docs().length, 2);
});

test("signIn: a player who declines stays signedOut and keeps the runs queued", async () => {
  const stack = makeStack({ play: { signedIn: false, interactive: false } });
  await stack.sync.record(baseSummary({ steps: 805 }));
  const info = await stack.sync.signIn();
  assert.equal(info.state, "signedOut");
  assert.equal(stack.fake.docs().length, 0);
  const stored = JSON.parse(stack.storage.map.get("ddr.runQueue.v1"));
  assert.equal(stored.entries.length, 1);
  assert.equal(stored.entries[0].attempts, 0);
  assert.equal(stored.failures, 0);
});

test("session and signIn: Compete OFF resolve state off with zero network and zero Play Games calls", async () => {
  const stack = makeStack({ competeOn: false });
  const before = stack.fake.calls().length;
  for (const info of [await stack.sync.session(), await stack.sync.signIn()]) {
    assert.deepEqual({ ...info }, { state: "off", name: null });
  }
  assert.equal(stack.fake.calls().length, before);
  assert.equal(stack.rig.play.calls().length, 0);
});

test("session: every identity outcome maps to a state and never throws", async () => {
  const cases = [
    [{ ok: false, reason: "signin" }, "signedOut"],
    [{ ok: false, reason: "unavailable" }, "unavailable"],
    [{ ok: false, reason: "offline" }, "offline"],
    [{ ok: false, reason: "server" }, "error"],
    [{ ok: false, reason: "refused" }, "error"],
    [{ ok: false, reason: "off" }, "off"],
    [null, "error"],
  ];
  for (const [answer, state] of cases) {
    const stack = makeStack({ identityOverride: { boardSession: async () => answer, signIn: async () => answer } });
    const quiet = await stack.sync.session();
    const loud = await stack.sync.signIn();
    assert.equal(quiet.state, state, `session ${JSON.stringify(answer)}`);
    assert.equal(loud.state, state, `signIn ${JSON.stringify(answer)}`);
    assert.equal(quiet.name, null);
  }
  const throwing = makeStack({
    identityOverride: {
      boardSession: async () => {
        throw new Error("boom");
      },
    },
  });
  assert.equal((await throwing.sync.session()).state, "error");
});

test("flush: hitting the sign-in hold reports signedOut once through onSession", async () => {
  const stack = makeStack({ play: { signedIn: false, interactive: false } });
  await stack.sync.record(baseSummary({ steps: 806 }));
  stack.calls.onSession.length = 0;

  const res = await stack.sync.flush({ force: true });
  assert.equal(res.reason, "signin");
  assert.deepEqual(stack.calls.onSession.map((i) => ({ ...i })), [{ state: "signedOut", name: null }]);
});

test("record: a death while signed out reports signedOut and queues the run", async () => {
  const stack = makeStack({ play: { signedIn: false, interactive: false } });
  const res = await stack.sync.record(baseSummary({ steps: 807 }));
  assert.equal(res.queued, true);
  assert.deepEqual(stack.calls.onSession.map((i) => i.state), ["signedOut"]);
});

test("boot: Compete ON runs session() once instead of a bare flush; Compete OFF never touches the network", async () => {
  const on = makeStack();
  await on.sync.boot({ history: [] });
  assert.deepEqual(on.calls.onSession.map((i) => ({ ...i })), [{ state: "signedIn", name: PLAYER_NAME }]);

  const off = makeStack({ competeOn: false });
  const before = off.fake.calls().length;
  await off.sync.boot({ history: [] });
  assert.equal(off.fake.calls().length, before);
  assert.equal(off.rig.play.calls().length, 0);
  assert.equal(off.calls.onSession.length, 0);
});

/* ================================================================
   D-05: the once-only re-post of settled runs missing from the board
   ================================================================ */

const FIRST_UID = "fakeuid000001"; // the rig's first signed-in player

function repostRuns() {
  return {
    onBoard: baseSummary({ steps: 901 }),
    missingA: baseSummary({ steps: 902 }),
    missingB: baseSummary({ steps: 903 }),
    competeOff: baseSummary({ steps: 904 }), // stored locally, never enqueued: not in the settled ledger
  };
}

async function seedRepost(stack, runs, { settled } = {}) {
  await stack.storage.setItem("ddr.graveyard.v1", JSON.stringify([runs.onBoard, runs.missingA, runs.competeOff]));
  await stack.storage.setItem("ddr.bests.v1", JSON.stringify({ v: 1, runs: { [runs.missingB.hash]: runs.missingB } }));
  const hashes = settled || [runs.onBoard.hash, runs.missingA.hash, runs.missingB.hash];
  await stack.storage.setItem("ddr.runQueue.v1", JSON.stringify({ v: 1, entries: [], settled: hashes, failures: 0, retryAt: 0 }));
}

function countingClient(counter) {
  return (c) => ({
    ...c,
    ownRuns: (uid) => {
      counter.n += 1;
      return c.ownRuns(uid);
    },
  });
}

test("D-05: the first signedIn session re-posts exactly the settled runs missing from the board, with the history's versions, once", async () => {
  const runs = repostRuns();
  const counter = { n: 0 };
  const stack = makeStack({
    fakeOpts: { runs: [seedFor({ uid: FIRST_UID, hash: runs.onBoard.hash })] },
    wrapClient: countingClient(counter),
  });
  await seedRepost(stack, runs);
  await stack.sync.boot({
    history: [
      { hash: runs.missingA.hash, version: "2.2.0 (12)" },
      { hash: runs.onBoard.hash, version: "2.2.0 (12)" },
    ],
  });

  const docs = stack.fake.docs();
  const byHash = Object.fromEntries(docs.map((d) => [d.hash, d]));
  assert.equal(docs.length, 3, "the seeded board run plus the two re-posted");
  assert.equal(byHash[runs.missingA.hash].version, "2.2.0 (12)", "the version it was first recorded with");
  assert.equal(byHash[runs.missingB.hash].version, "2.3.0 (13)", "no history record: the current version");
  assert.equal(byHash[runs.missingA.hash].uid, FIRST_UID);
  assert.equal(byHash[runs.competeOff.hash], undefined, "a run outside the settled ledger is never posted");
  assert.deepEqual(JSON.parse(stack.storage.map.get("ddr.boardRepost.v1")), { v: 1, done: true, count: 2 });
  assert.equal(counter.n, 1);

  // a second session re-posts nothing and does not even re-read the board
  const commitsBefore = commitCalls(stack.fake).length;
  await stack.sync.session();
  assert.equal(commitCalls(stack.fake).length, commitsBefore);
  assert.equal(counter.n, 1);
});

test("D-05: a Compete-OFF run (stored locally, hash not in the settled ledger) is never posted", async () => {
  const runs = repostRuns();
  const stack = makeStack();
  await seedRepost(stack, runs, { settled: [] });
  await stack.sync.session();
  assert.equal(stack.fake.docs().length, 0);
  assert.equal(JSON.parse(stack.storage.map.get("ddr.boardRepost.v1")).count, 0);
});

test("D-05: when ownRuns fails nothing is re-posted and the marker stays unset, so the next session retries", async () => {
  const runs = repostRuns();
  let failing = true;
  const stack = makeStack({
    wrapClient: (c) => ({
      ...c,
      ownRuns: (uid) => (failing ? Promise.resolve({ ok: false, reason: "offline" }) : c.ownRuns(uid)),
    }),
  });
  await seedRepost(stack, runs);

  await stack.sync.session();
  assert.equal(stack.fake.docs().length, 0);
  assert.equal(stack.storage.map.has("ddr.boardRepost.v1"), false);

  failing = false;
  await stack.sync.session();
  assert.equal(stack.fake.docs().length, 3, "all three settled runs were missing from this empty board");
  assert.equal(JSON.parse(stack.storage.map.get("ddr.boardRepost.v1")).done, true);
});

test("D-05: a signed-out session re-posts nothing and leaves the marker unset", async () => {
  const runs = repostRuns();
  const stack = makeStack({ play: { signedIn: false, interactive: false } });
  await seedRepost(stack, runs);
  await stack.sync.session();
  assert.equal(stack.fake.docs().length, 0);
  assert.equal(stack.storage.map.has("ddr.boardRepost.v1"), false);
});

test("D-05: Compete OFF never reads the stores for a re-post and writes no marker", async () => {
  const runs = repostRuns();
  const stack = makeStack({ competeOn: false });
  await seedRepost(stack, runs);
  await stack.sync.session();
  assert.equal(stack.storage.map.has("ddr.boardRepost.v1"), false);
  assert.equal(stack.fake.docs().length, 0);
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

test("purity: exports createBoardSync exactly once; the retired-key literals appear once each; no handle or re-roll code is left", () => {
  assert.equal((BOARD_SYNC_SRC.match(/export function createBoardSync/g) || []).length, 1);
  assert.equal((BOARD_SYNC_SRC.match(/ddr\.pgsqueue\.v1/g) || []).length, 1);
  assert.equal((BOARD_SYNC_SRC.match(/ddr\.handleRewrite\.v1/g) || []).length, 1);
  assert.equal((BOARD_SYNC_SRC.match(/ddr\.boardRepost\.v1/g) || []).length, 1, "the re-post marker literal appears once");
  assert.ok((BOARD_SYNC_SRC.match(/preReleaseHashes\(/g) || []).length >= 1);
  for (const gone of ["reroll", "HANDLE_REWRITE_KEY", "setHandle", "ensureHandle", "rewriteHandle", "handles.js"]) {
    assert.equal(BOARD_SYNC_SRC.includes(gone), false, `${gone} is gone from boardSync.js`);
  }
});
