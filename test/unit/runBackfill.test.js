// test/unit/runBackfill.test.js
//
// Phase 83 plan 12. Covers collectBackfillRuns (the cutoff boundary, season
// and hash filters, dedupe + sort, purity of its inputs) and runBackfill
// (the Compete gate, the first-call enqueue against the fake board server,
// the once-only ddr.boardBackfill.v1 marker, corrupt/missing local stores,
// and never double-queuing a run the queue already settled).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { stripJs } from "../../tools/ident-sweep.mjs";
import { SEASON } from "../../content/season.js";
import { runHash, emptyBests, updateBests } from "../../engine/records.js";
import { createFakeBoardFetch } from "../../src/browser/fakeBoardServer.js";
import { createIdentity } from "../../src/browser/firebaseAuth.js";
import { createBoardWrites } from "../../src/browser/boardWrites.js";
import { createRunQueue } from "../../src/browser/runQueue.js";
import {
  BACKFILL_KEY,
  BACKFILL_VERSION,
  BACKFILL_SINCE_MS,
  collectBackfillRuns,
  runBackfill,
} from "../../src/browser/runBackfill.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const RUN_BACKFILL_SRC = fs
  .readFileSync(path.join(REPO_ROOT, "src", "browser", "runBackfill.js"), "utf8")
  .replace(/\r\n/g, "\n");

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

// Phase 84 (BOARD-20, BOARD-22): the fake board's own `when` bound compares
// against this clock, so it must sit at or after BACKFILL_SINCE_MS — every
// summary() fixture below carries a `when` at or shortly past that cutoff.
function clockBox(start = BACKFILL_SINCE_MS) {
  let t = start;
  const now = () => t;
  now.set = (v) => {
    t = v;
  };
  return now;
}

function summary(overrides = {}) {
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
    when: BACKFILL_SINCE_MS,
    season: SEASON,
    seed: 12345,
    acts: 10,
    ...overrides,
  };
  if (!("hash" in overrides)) s.hash = runHash(s);
  return s;
}

function foldBests(summaries) {
  let rec = emptyBests();
  for (const s of summaries) rec = updateBests(rec, s).record;
  return rec;
}

function makeFullStack({ competeOn = true } = {}) {
  const clock = clockBox();
  const fake = createFakeBoardFetch({ config: VALID_CONFIG, now: clock });
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
   constants
   ================================================================ */

test("constants: BACKFILL_KEY, BACKFILL_VERSION, BACKFILL_SINCE_MS", () => {
  assert.equal(BACKFILL_KEY, "ddr.boardBackfill.v1");
  assert.equal(BACKFILL_VERSION, "2.1.0 (11)");
  assert.equal(BACKFILL_SINCE_MS, Date.UTC(2026, 8, 28, 19, 41, 1));
});

/* ================================================================
   collectBackfillRuns
   ================================================================ */

test("collectBackfillRuns: one ms before the cutoff is dropped, exactly at the cutoff is kept", () => {
  const atCutoff = summary({ when: BACKFILL_SINCE_MS, steps: 801 });
  const before = summary({ when: BACKFILL_SINCE_MS - 1, steps: 802 });
  const bests = foldBests([atCutoff, before]);

  const out = collectBackfillRuns({ bests, graves: [] });
  assert.equal(out.length, 1);
  assert.equal(out[0].hash, atCutoff.hash);
});

test("collectBackfillRuns: a run from another season is dropped", () => {
  const wrongSeason = summary({ when: BACKFILL_SINCE_MS + 1000, steps: 803, season: SEASON + 1 });
  const bests = foldBests([wrongSeason]);

  const out = collectBackfillRuns({ bests, graves: [] });
  assert.equal(out.length, 0);
});

test("collectBackfillRuns: a season-0 legacy stone and a non-numeric `when` are ignored", () => {
  const legacyStone = { ...summary({ when: BACKFILL_SINCE_MS + 1000, steps: 804 }), season: 0 };
  const badWhen = summary({ when: "not-a-number", steps: 805 });

  const out = collectBackfillRuns({ bests: null, graves: [legacyStone, badWhen] });
  assert.equal(out.length, 0);
});

test("collectBackfillRuns: a tampered field drops the run (the recomputed hash no longer matches)", () => {
  const good = summary({ when: BACKFILL_SINCE_MS + 1000, steps: 806 });
  const tampered = { ...good, gold: 999999 }; // hash still reflects the original gold

  const out = collectBackfillRuns({ bests: null, graves: [tampered] });
  assert.equal(out.length, 0);
});

test("collectBackfillRuns: a forged `when` (outside RUN_HASH_FIELDS) does not fail the hash check", () => {
  const good = summary({ when: BACKFILL_SINCE_MS + 1000, steps: 8065 });
  const forgedForward = { ...good, when: BACKFILL_SINCE_MS - 999999 }; // hash still valid, `when` moved it below the cutoff

  const out = collectBackfillRuns({ bests: null, graves: [forgedForward] });
  assert.equal(out.length, 0, "the forged `when` is honored (moved below the cutoff), not rejected as tampering");
});

test("collectBackfillRuns: a non-array graves list and a garbage bests record never throw", () => {
  assert.deepEqual(collectBackfillRuns({ bests: "garbage", graves: "also-garbage" }), []);
  assert.deepEqual(collectBackfillRuns({}), []);
  assert.deepEqual(collectBackfillRuns(), []);
});

test("collectBackfillRuns: dedupes by hash (union of bests + graves) and sorts by `when` ascending then hash", () => {
  const t1 = summary({ when: BACKFILL_SINCE_MS + 3000, steps: 807 });
  const t2 = summary({ when: BACKFILL_SINCE_MS + 1000, steps: 808 });
  const t3 = summary({ when: BACKFILL_SINCE_MS + 2000, steps: 809 });
  const bests = foldBests([t1, t2, t3]);

  const out = collectBackfillRuns({ bests, graves: [t2] }); // t2 duplicated into the graveyard too
  assert.equal(out.length, 3);
  assert.deepEqual(
    out.map((r) => r.hash),
    [t2.hash, t3.hash, t1.hash],
  );
});

test("collectBackfillRuns: never mutates its inputs; the result and every run in it are frozen", () => {
  const s = summary({ when: BACKFILL_SINCE_MS + 1000, steps: 810 });
  const bests = foldBests([s]);
  const graves = [summary({ when: BACKFILL_SINCE_MS + 2000, steps: 811 })];
  const bestsSnapshot = JSON.parse(JSON.stringify(bests));
  const gravesSnapshot = JSON.parse(JSON.stringify(graves));

  const out = collectBackfillRuns({ bests, graves });

  assert.deepEqual(JSON.parse(JSON.stringify(bests)), bestsSnapshot);
  assert.deepEqual(JSON.parse(JSON.stringify(graves)), gravesSnapshot);
  assert.ok(Object.isFrozen(out));
  assert.ok(out.every((r) => Object.isFrozen(r)));
});

/* ================================================================
   runBackfill: the Compete gate
   ================================================================ */

test("runBackfill: Compete OFF resolves {ok:false, reason:'off'}, makes zero network calls, writes nothing", async () => {
  const storage = makeStorage();
  let enqueueManyCalls = 0;
  let flushCalls = 0;
  const queue = {
    async enqueueMany() {
      enqueueManyCalls++;
      return { ok: true, queued: 0, skipped: 0 };
    },
    flush() {
      flushCalls++;
      return Promise.resolve({ ok: true });
    },
  };

  const res = await runBackfill({ storage, queue, competeOn: () => false });
  assert.deepEqual(res, { ok: false, reason: "off" });
  assert.equal(storage.calls.getItem, 0);
  assert.equal(storage.calls.setItem, 0);
  assert.equal(enqueueManyCalls, 0);
  assert.equal(flushCalls, 0);
});

test("runBackfill: Compete OFF against the real stack makes zero fetch calls", async () => {
  const stack = makeFullStack();
  const storage = makeStorage();
  const queueStorage = makeStorage();
  const queue = createRunQueue({ storage: queueStorage, writes: stack.writes, competeOn: () => false, online: () => true });

  const res = await runBackfill({ storage, queue, competeOn: () => false });
  assert.deepEqual(res, { ok: false, reason: "off" });
  assert.equal(stack.fake.calls().length, 0);
});

/* ================================================================
   runBackfill: the first Compete-ON call, and the second (skipped) call
   ================================================================ */

test("runBackfill: the first Compete-ON call enqueues eligible runs stamped BACKFILL_VERSION; nothing pre-cutoff reaches the board", async () => {
  const stack = makeFullStack();
  const storage = makeStorage();
  const queueStorage = makeStorage();
  const queue = createRunQueue({
    storage: queueStorage,
    writes: stack.writes,
    competeOn: () => true,
    online: () => true,
    now: stack.clock,
  });

  const before = summary({ when: BACKFILL_SINCE_MS - 1, steps: 601 });
  const atCutoff = summary({ when: BACKFILL_SINCE_MS, steps: 602 });
  const after = summary({ when: BACKFILL_SINCE_MS + 60000, steps: 603 });
  const bests = foldBests([before, atCutoff, after]);
  await storage.setItem("ddr.bests.v1", JSON.stringify(bests));

  const graveOnly = summary({ when: BACKFILL_SINCE_MS + 120000, steps: 604 });
  await storage.setItem("ddr.graveyard.v1", JSON.stringify([graveOnly, before]));

  const res = await runBackfill({ storage, queue, competeOn: () => true });
  assert.equal(res.ok, true);
  assert.equal(res.queued, 3); // atCutoff, after, graveOnly — `before` is dropped
  assert.equal(typeof res.flushed.then, "function");
  await res.flushed;

  const docs = stack.fake.docs();
  assert.equal(docs.length, 3);
  assert.deepEqual(
    docs.map((d) => d.hash).sort(),
    [atCutoff.hash, after.hash, graveOnly.hash].sort(),
  );
  for (const d of docs) assert.equal(d.version, BACKFILL_VERSION);
  assert.ok(!docs.some((d) => d.hash === before.hash));

  const storedRaw = await storage.getItem(BACKFILL_KEY);
  assert.deepEqual(JSON.parse(storedRaw), { v: 1, done: true, count: 3 });

  // a second call is a no-op
  const res2 = await runBackfill({ storage, queue, competeOn: () => true });
  assert.deepEqual(res2, { ok: true, skipped: true });
  assert.equal(stack.fake.docs().length, 3, "the second call enqueued nothing new");
});

test("runBackfill: corrupt or missing local stores enqueue nothing but still mark the backfill done", async () => {
  const storage = makeStorage();
  storage.map.set("ddr.bests.v1", "not json{");
  // ddr.graveyard.v1 is left entirely missing

  const enqueueCalls = [];
  const queue = {
    async enqueueMany(list, opts) {
      enqueueCalls.push({ list, opts });
      return { ok: true, queued: 0, skipped: 0 };
    },
    flush() {
      return Promise.resolve({ ok: true, sent: 0 });
    },
  };

  const res = await runBackfill({ storage, queue, competeOn: () => true });
  assert.equal(res.ok, true);
  assert.equal(res.queued, 0);
  assert.equal(enqueueCalls.length, 1);
  assert.deepEqual(enqueueCalls[0].list, []);
  assert.deepEqual(enqueueCalls[0].opts, { version: BACKFILL_VERSION });

  const stored = JSON.parse(await storage.getItem(BACKFILL_KEY));
  assert.deepEqual(stored, { v: 1, done: true, count: 0 });

  // a second call over the now-marked-done store also skips
  const res2 = await runBackfill({ storage, queue, competeOn: () => true });
  assert.deepEqual(res2, { ok: true, skipped: true });
  assert.equal(enqueueCalls.length, 1, "the second call never called enqueueMany again");
});

test("runBackfill: a run already settled in the queue is not queued again", async () => {
  const stack = makeFullStack();
  const storage = makeStorage();
  const queueStorage = makeStorage();
  const queue = createRunQueue({
    storage: queueStorage,
    writes: stack.writes,
    competeOn: () => true,
    online: () => true,
    now: stack.clock,
  });

  const already = summary({ when: BACKFILL_SINCE_MS + 1000, steps: 701 });
  const fresh = summary({ when: BACKFILL_SINCE_MS + 2000, steps: 702 });

  // `already` goes through the normal death-time queue path first, and settles.
  const enq = await queue.enqueue(already, { version: BACKFILL_VERSION });
  await enq.flushed;
  assert.equal(stack.fake.docs().length, 1);

  const bests = foldBests([already, fresh]);
  await storage.setItem("ddr.bests.v1", JSON.stringify(bests));
  await storage.setItem("ddr.graveyard.v1", JSON.stringify([]));

  const res = await runBackfill({ storage, queue, competeOn: () => true });
  assert.equal(res.ok, true);
  assert.equal(res.queued, 1, "only `fresh` was genuinely new");
  await res.flushed;

  const docs = stack.fake.docs();
  assert.equal(docs.length, 2);
  assert.deepEqual(
    docs.map((d) => d.hash).sort(),
    [already.hash, fresh.hash].sort(),
  );
});

test("runBackfill: never throws even when storage and queue methods throw", async () => {
  const badStorage = {
    async getItem() {
      throw new Error("boom");
    },
    async setItem() {
      throw new Error("boom");
    },
  };
  const badQueue = {
    async enqueueMany() {
      throw new Error("boom");
    },
    flush() {
      throw new Error("boom");
    },
  };

  const res = await runBackfill({ storage: badStorage, queue: badQueue, competeOn: () => true });
  assert.equal(res.ok, true);
  assert.equal(res.queued, 0);
});

/* ================================================================
   purity
   ================================================================ */

test("purity: runBackfill.js never touches DOM globals and never calls the bare global fetch", () => {
  const code = stripJs(RUN_BACKFILL_SRC);
  for (const banned of [/\bwindow\b/, /\bnavigator\b/, /\blocalStorage\b/, /\bsessionStorage\b/]) {
    assert.doesNotMatch(code, banned, `must not use ${banned}`);
  }
  assert.doesNotMatch(code, /(?<!\.)\bdocument\b(?!\s*:)/, "must not use the DOM global `document`");
  assert.doesNotMatch(code, /(?<!\w)fetch\(/, "must never call the global fetch directly");
});

test("purity: exports and required literals match the plan's artifact contract", () => {
  assert.equal((RUN_BACKFILL_SRC.match(/export async function runBackfill/g) || []).length, 1);
  assert.equal((RUN_BACKFILL_SRC.match(/export function collectBackfillRuns/g) || []).length, 1);
  assert.ok((RUN_BACKFILL_SRC.match(/ddr\.boardBackfill\.v1/g) || []).length >= 1);
  assert.ok((RUN_BACKFILL_SRC.match(/2\.1\.0 \(11\)/g) || []).length >= 1);
});
