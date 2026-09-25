// test/unit/pgsQueue.test.js
//
// Phase 68 (PGS-04, D-02/D-03/D-04): the durable submission queue's pure
// record operations — the ddr.pgsqueue.v1 shape, entry building, dedupe,
// acks, settling into the done ledger, the stale-season drop, the backoff
// curve and the never-throw sanitizer.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import {
  PGS_QUEUE_KEY,
  QUEUE_CAP,
  DONE_CAP,
  BACKOFF_BASE_MS,
  BACKOFF_MAX_MS,
  emptyQueue,
  sanitizeQueue,
  queueEntryFor,
  enqueueEntry,
  ackBoard,
  settleQueue,
  dropStaleSeasons,
  backoffDelay,
} from "../../src/browser/pgsQueue.js";
import { encodeTag } from "../../src/browser/scoreTag.js";
import { boardScores, SUBMIT_BOARDS } from "../../src/browser/boardScores.js";
import { runHash } from "../../engine/records.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, "..", "..", "src", "browser", "pgsQueue.js");

function summary(overrides = {}) {
  const s = {
    name: "Hilda Ferrow", race: "Dwarf", sub: "Soldier", cls: "Fighter",
    level: 3, sp: 1180, floor: 7, day: 22, steps: 431, gold: 4688, kills: 19,
    cause: "combat", note: "died", epitaph: "SECRET EPITAPH TEXT", when: 111,
    season: 1, seed: 999, acts: 10,
    ...overrides,
  };
  if (!("hash" in overrides)) s.hash = runHash(s);
  return s;
}

/** hashN(n) — a distinct valid 8-hex hash per n. */
function hashN(n) {
  return n.toString(16).padStart(8, "0");
}

function entry(n, overrides = {}) {
  return {
    hash: hashN(n),
    season: 1,
    tag: "v1.2.8.3.0.7.22.431.19.4688.1180.Hilda_Ferrow",
    scores: { deep: 6999569, days: 22007, kills: 19007, purse: 4688 },
    acked: [],
    fails: 0,
    ...overrides,
  };
}

function queueOf(entries = [], done = []) {
  return { v: 1, entries, done };
}

function deepClone(x) {
  return JSON.parse(JSON.stringify(x));
}

// --- constants ----------------------------------------------------------------

test("constants and emptyQueue()", () => {
  assert.equal(PGS_QUEUE_KEY, "ddr.pgsqueue.v1");
  assert.equal(QUEUE_CAP, 50);
  assert.equal(DONE_CAP, 100);
  assert.equal(BACKOFF_BASE_MS, 30000);
  assert.equal(BACKOFF_MAX_MS, 600000);
  assert.deepStrictEqual(emptyQueue(), { v: 1, entries: [], done: [] });
  assert.notEqual(emptyQueue(), emptyQueue(), "a fresh object each call");
});

// --- queueEntryFor --------------------------------------------------------------

test("queueEntryFor builds { hash, season, tag, scores, acked: [], fails: 0 } from the summary", () => {
  const s = summary();
  const e = queueEntryFor(s);
  assert.deepStrictEqual(e, {
    hash: s.hash,
    season: 1,
    tag: encodeTag(s),
    scores: { ...boardScores(s) },
    acked: [],
    fails: 0,
  });
});

test("queueEntryFor is null for a missing or invalid hash or a bad season", () => {
  assert.equal(queueEntryFor(null), null);
  assert.equal(queueEntryFor("x"), null);
  assert.equal(queueEntryFor(summary({ hash: undefined })), null);
  assert.equal(queueEntryFor(summary({ hash: "ABCDEF12" })), null);
  assert.equal(queueEntryFor(summary({ hash: "abc" })), null);
  const h = hashN(5);
  assert.equal(queueEntryFor(summary({ hash: h, season: 0 })), null);
  assert.equal(queueEntryFor(summary({ hash: h, season: 1.5 })), null);
  assert.equal(queueEntryFor(summary({ hash: h, season: "1" })), null);
  assert.equal(queueEntryFor(summary({ hash: h, season: undefined })), null);
  assert.ok(queueEntryFor(summary({ hash: h, season: 2 })));
});

test("queueEntryFor never reads or copies the epitaph", () => {
  const e = queueEntryFor(summary());
  assert.ok(!JSON.stringify(e).includes("SECRET"), "no epitaph text in the entry");
  assert.ok(!("epitaph" in e) && !("note" in e) && !("name" in e));
  const code = fs.readFileSync(SRC, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.ok(!/epitaph/.test(code), "the module's code never names the epitaph");
});

// --- enqueueEntry ----------------------------------------------------------------

test("enqueueEntry appends a new entry and reports added: true without mutating the input", () => {
  const q = queueOf([entry(1)]);
  const before = deepClone(q);
  const r = enqueueEntry(q, entry(2));
  assert.equal(r.added, true);
  assert.deepStrictEqual(r.queue.entries.map((e) => e.hash), [hashN(1), hashN(2)]);
  assert.deepStrictEqual(q, before, "input untouched");
});

test("enqueueEntry refuses a hash already queued, returning q unchanged", () => {
  const q = queueOf([entry(1)]);
  const r = enqueueEntry(q, entry(1));
  assert.equal(r.added, false);
  assert.equal(r.queue, q);
});

test("enqueueEntry refuses a hash already in the done ledger (D-02: never twice)", () => {
  const q = queueOf([], [hashN(7)]);
  const r = enqueueEntry(q, entry(7));
  assert.equal(r.added, false);
  assert.equal(r.queue, q);
});

test("enqueueEntry refuses a null entry", () => {
  const q = emptyQueue();
  const r = enqueueEntry(q, null);
  assert.equal(r.added, false);
  assert.equal(r.queue, q);
});

test("PGS-04 boundary: the 51st entry evicts the oldest; 50 fit exactly", () => {
  let q = emptyQueue();
  for (let i = 1; i <= QUEUE_CAP; i++) q = enqueueEntry(q, entry(i)).queue;
  assert.equal(q.entries.length, 50);
  assert.equal(q.entries[0].hash, hashN(1));
  const r = enqueueEntry(q, entry(51));
  assert.equal(r.added, true);
  assert.equal(r.queue.entries.length, 50);
  assert.equal(r.queue.entries[0].hash, hashN(2), "the oldest was evicted");
  assert.equal(r.queue.entries[49].hash, hashN(51));
  assert.equal(q.entries.length, 50, "the input queue kept its 50");
});

// --- ackBoard --------------------------------------------------------------------

test("ackBoard adds a board once to that entry's acked list", () => {
  const q = queueOf([entry(1), entry(2)]);
  const before = deepClone(q);
  const a = ackBoard(q, hashN(2), "deep");
  assert.deepStrictEqual(a.entries[1].acked, ["deep"]);
  assert.deepStrictEqual(a.entries[0].acked, []);
  assert.deepStrictEqual(q, before, "input untouched");
  const b = ackBoard(a, hashN(2), "deep");
  assert.equal(b, a, "acking twice changes nothing");
  assert.deepStrictEqual(b.entries[1].acked, ["deep"]);
});

test("ackBoard with an unknown hash or a board outside SUBMIT_BOARDS returns q unchanged", () => {
  const q = queueOf([entry(1)]);
  assert.equal(ackBoard(q, hashN(9), "deep"), q);
  assert.equal(ackBoard(q, hashN(1), "combo"), q);
  assert.equal(ackBoard(q, hashN(1), "yard"), q);
  assert.equal(ackBoard(q, hashN(1), "bogus"), q);
});

test("ackBoard resets that entry's fails count to 0 on a successful ack (Phase 81, BOARD-16, R-16a)", () => {
  const q = queueOf([entry(1, { fails: 5 }), entry(2, { fails: 2 })]);
  const a = ackBoard(q, hashN(1), "deep");
  assert.equal(a.entries[0].fails, 0);
  assert.equal(a.entries[1].fails, 2, "an unrelated entry's fails is untouched");
});

// --- sanitizeEntry's `fails` field (Phase 81, BOARD-16, R-16a) -------------------

test("sanitizeQueue: a missing fails count sanitizes to 0, a non-negative safe integer survives, and garbage sanitizes to 0", () => {
  const raw = queueOf([
    entry(1, { fails: undefined }),
    entry(2, { fails: 7 }),
    entry(3, { fails: -1 }),
    entry(4, { fails: 1.5 }),
    entry(5, { fails: "3" }),
    entry(6, { fails: null }),
  ]);
  delete raw.entries[0].fails; // a stored entry with no fails key at all (pre-Phase-81 shape)
  const out = sanitizeQueue(raw);
  assert.deepStrictEqual(
    out.entries.map((e) => [e.hash, e.fails]),
    [
      [hashN(1), 0],
      [hashN(2), 7],
      [hashN(3), 0],
      [hashN(4), 0],
      [hashN(5), 0],
      [hashN(6), 0],
    ],
  );
});

// --- settleQueue -----------------------------------------------------------------

test("settleQueue moves fully acked entries into done (newest last) and keeps the rest in order", () => {
  const all = [...SUBMIT_BOARDS];
  const q = queueOf(
    [entry(1, { acked: all }), entry(2, { acked: ["deep"] }), entry(3, { acked: [...all].reverse() }), entry(4)],
    [hashN(90)],
  );
  const before = deepClone(q);
  const s = settleQueue(q);
  assert.deepStrictEqual(s.entries.map((e) => e.hash), [hashN(2), hashN(4)]);
  assert.deepStrictEqual(s.done, [hashN(90), hashN(1), hashN(3)]);
  assert.deepStrictEqual(q, before, "input untouched");
});

test("settleQueue returns q itself when nothing is complete", () => {
  const q = queueOf([entry(1, { acked: ["deep", "lean", "days", "kills"] })]);
  assert.equal(settleQueue(q), q);
});

test("PGS-04 boundary: the done ledger caps at 100 by dropping the oldest", () => {
  const done = Array.from({ length: DONE_CAP }, (_, i) => hashN(1000 + i));
  const q = queueOf([entry(1, { acked: [...SUBMIT_BOARDS] })], done);
  const s = settleQueue(q);
  assert.equal(s.done.length, 100);
  assert.equal(s.done[0], hashN(1001), "the oldest done hash fell off");
  assert.equal(s.done[99], hashN(1));
});

// --- dropStaleSeasons --------------------------------------------------------------

test("dropStaleSeasons removes every entry not in the current season and counts them", () => {
  const q = queueOf([entry(1, { season: 1 }), entry(2, { season: 2 }), entry(3, { season: 1 }), entry(4, { season: 3 })]);
  const before = deepClone(q);
  const r = dropStaleSeasons(q, 2);
  assert.equal(r.dropped, 3);
  assert.deepStrictEqual(r.queue.entries.map((e) => e.hash), [hashN(2)]);
  assert.deepStrictEqual(q, before);
});

test("dropStaleSeasons with nothing to drop reports 0 and returns q", () => {
  const q = queueOf([entry(1, { season: 2 })]);
  const r = dropStaleSeasons(q, 2);
  assert.equal(r.dropped, 0);
  assert.equal(r.queue, q);
});

// --- backoffDelay ----------------------------------------------------------------

test("PGS-04 boundary: backoff 30 s doubling to a 10-minute cap", () => {
  assert.equal(backoffDelay(1), 30000);
  assert.equal(backoffDelay(2), 60000);
  assert.equal(backoffDelay(3), 120000);
  assert.equal(backoffDelay(4), 240000);
  assert.equal(backoffDelay(5), 480000);
  assert.equal(backoffDelay(6), 600000);
  assert.equal(backoffDelay(20), 600000);
  assert.equal(backoffDelay(5000), 600000);
  assert.equal(backoffDelay(0), 0);
  assert.equal(backoffDelay(-3), 0);
  assert.equal(backoffDelay(NaN), 0);
  assert.equal(backoffDelay(undefined), 0);
});

// --- sanitizeQueue ----------------------------------------------------------------

test("sanitizeQueue returns emptyQueue() for garbage and never throws", () => {
  for (const raw of [null, undefined, 0, 1, "x", [], true, { v: 2, entries: [], done: [] }, { v: "1" }, { entries: [] }]) {
    let out;
    assert.doesNotThrow(() => {
      out = sanitizeQueue(raw);
    });
    assert.deepStrictEqual(out, emptyQueue(), `garbage ${JSON.stringify(raw)}`);
  }
  const hostile = { v: 1 };
  Object.defineProperty(hostile, "entries", {
    get() {
      throw new Error("boom");
    },
  });
  assert.doesNotThrow(() => sanitizeQueue(hostile));
  assert.deepStrictEqual(sanitizeQueue(hostile), emptyQueue());
});

test("sanitizeQueue keeps a valid queue, and non-array entries/done become empty", () => {
  const q = queueOf([entry(1, { acked: ["deep"] }), entry(2)], [hashN(9)]);
  assert.deepStrictEqual(sanitizeQueue(deepClone(q)), q);
  assert.deepStrictEqual(sanitizeQueue({ v: 1, entries: "nope", done: {} }), emptyQueue());
});

test("sanitizeQueue drops entries with a bad hash or season", () => {
  const good = entry(1);
  const bad = [
    null, "x", [],
    entry(2, { hash: "ABCDEF12" }), entry(3, { hash: 12345678 }), entry(4, { hash: undefined }),
    entry(5, { season: 0 }), entry(6, { season: 1.5 }), entry(7, { season: "1" }), entry(8, { season: -1 }),
  ];
  assert.deepStrictEqual(sanitizeQueue(queueOf([...bad, good])).entries, [good]);
});

test("sanitizeQueue drops entries with a malformed tag", () => {
  const good = entry(1);
  const bad = [
    entry(2, { tag: "" }),
    entry(3, { tag: "x".repeat(65) }),
    entry(4, { tag: "has space" }),
    entry(5, { tag: "slash/bad" }),
    entry(6, { tag: 42 }),
    entry(7, { tag: undefined }),
  ];
  assert.deepStrictEqual(sanitizeQueue(queueOf([...bad, good])).entries, [good]);
  assert.equal(sanitizeQueue(queueOf([entry(8, { tag: "a".repeat(64) })])).entries.length, 1, "64 characters is fine");
  assert.equal(sanitizeQueue(queueOf([entry(9, { tag: "A-z_0.9~" })])).entries.length, 1, "the unreserved set is fine");
});

test("sanitizeQueue drops entries with a malformed scores object", () => {
  const s = entry(1).scores;
  const good = entry(1);
  const { purse, ...missing } = s;
  void purse;
  const bad = [
    entry(2, { scores: null }),
    entry(3, { scores: missing }),
    entry(4, { scores: { ...s, deep: -1 } }),
    entry(5, { scores: { ...s, deep: 1.5 } }),
    entry(6, { scores: { ...s, days: Number.MAX_SAFE_INTEGER + 1 } }),
    entry(7, { scores: { ...s, kills: "19007" } }),
    entry(8, { scores: { ...s, purse: NaN } }),
    entry(9, { scores: [1, 2, 3, 4, 5] }),
  ];
  assert.deepStrictEqual(sanitizeQueue(queueOf([...bad, good])).entries, [good]);
  const extra = sanitizeQueue(queueOf([entry(10, { scores: { ...s, combo: 5 } })])).entries[0];
  assert.deepStrictEqual(extra.scores, s, "extra score keys are stripped");
  // BOARD-17: an old stored score for the retired lean id is dropped tolerantly, not rejected.
  const retiredScore = sanitizeQueue(queueOf([entry(11, { scores: { ...s, lean: 61571 } })])).entries[0];
  assert.deepStrictEqual(retiredScore.scores, s, "a retired-board score is dropped, the entry is kept");
});

test("sanitizeQueue drops an entry whose acked list has an unknown board, and dedupes duplicates", () => {
  const out = sanitizeQueue(
    queueOf([entry(1, { acked: ["deep", "combo"] }), entry(2, { acked: "deep" }), entry(3, { acked: ["deep", "days", "deep"] })]),
  );
  assert.deepStrictEqual(out.entries.map((e) => e.hash), [hashN(3)]);
  assert.deepStrictEqual(out.entries[0].acked, ["deep", "days"]);
});

test("sanitizeQueue keeps the first of two entries with one hash", () => {
  const out = sanitizeQueue(queueOf([entry(1, { acked: ["deep"] }), entry(2), entry(1, { acked: [] })]));
  assert.deepStrictEqual(out.entries.map((e) => e.hash), [hashN(1), hashN(2)]);
  assert.deepStrictEqual(out.entries[0].acked, ["deep"]);
});

test("sanitizeQueue keeps only valid, unique hashes in done, capped at 100 (newest kept)", () => {
  const raw = queueOf([], ["nothex!!", hashN(1), 5, null, hashN(1), "ABCDEF12", hashN(2)]);
  assert.deepStrictEqual(sanitizeQueue(raw).done, [hashN(1), hashN(2)]);
  const many = Array.from({ length: 130 }, (_, i) => hashN(i + 1));
  const capped = sanitizeQueue(queueOf([], many)).done;
  assert.equal(capped.length, DONE_CAP);
  assert.equal(capped[0], hashN(31));
  assert.equal(capped[99], hashN(130));
});

test("sanitizeQueue caps entries at 50, keeping the newest", () => {
  const many = Array.from({ length: 60 }, (_, i) => entry(i + 1));
  const out = sanitizeQueue(queueOf(many)).entries;
  assert.equal(out.length, QUEUE_CAP);
  assert.equal(out[0].hash, hashN(11));
  assert.equal(out[49].hash, hashN(60));
});

test("PGS-04 precision: scores up to 999,999,999,999 survive the JSON round trip exactly, in insertion order", () => {
  let q = emptyQueue();
  const big = { deep: 999999999999, days: 999999999999, kills: 123456789012, purse: 999999999 };
  q = enqueueEntry(q, entry(3, { scores: big })).queue;
  q = enqueueEntry(q, entry(1)).queue;
  q = enqueueEntry(q, entry(2, { acked: ["days", "deep"] })).queue;
  q = { ...q, done: [hashN(40), hashN(41)] };
  const back = sanitizeQueue(JSON.parse(JSON.stringify(q)));
  assert.deepStrictEqual(back, q);
  assert.deepStrictEqual(back.entries.map((e) => e.hash), [hashN(3), hashN(1), hashN(2)], "insertion order, no timestamp");
  for (const e of back.entries) {
    for (const b of SUBMIT_BOARDS) assert.ok(Number.isSafeInteger(e.scores[b]) && e.scores[b] >= 0);
  }
});

test("a real summary's entry survives the JSON round trip through sanitizeQueue", () => {
  const q = enqueueEntry(emptyQueue(), queueEntryFor(summary({ floor: 999, steps: 99999, day: 9999, kills: 9999, gold: 999999 }))).queue;
  assert.deepStrictEqual(sanitizeQueue(JSON.parse(JSON.stringify(q))), q);
});

// --- BOARD-17: LEANEST retired — an old queued entry loads tolerantly ------------------

test("BOARD-17 (a): a stored lean score and an acked [deep, lean] sanitize to four scores and acked [deep]", () => {
  const raw = entry(1, { scores: { ...entry(1).scores, lean: 61571 }, acked: ["deep", "lean"] });
  const out = sanitizeQueue(queueOf([raw])).entries[0];
  assert.deepStrictEqual(out.scores, { deep: 6999569, days: 22007, kills: 19007, purse: 4688 });
  assert.deepStrictEqual(out.acked, ["deep"]);
});

test("BOARD-17 (b): an entry acked on every current board plus lean settles as done through settleQueue(sanitizeQueue(raw))", () => {
  const raw = entry(1, { acked: [...SUBMIT_BOARDS, "lean"] });
  const settled = settleQueue(sanitizeQueue(queueOf([raw])));
  assert.deepStrictEqual(settled.entries, []);
  assert.deepStrictEqual(settled.done, [hashN(1)]);
});

test("BOARD-17 (c): an acked garbage id that is neither current nor retired still drops the whole entry", () => {
  const raw = entry(1, { acked: ["deep", "not-a-real-board"] });
  const out = sanitizeQueue(queueOf([raw]));
  assert.deepStrictEqual(out.entries, []);
});

test("BOARD-17 (d): sanitizeQueue is idempotent over an old lean-carrying record", () => {
  const raw = queueOf([
    entry(1, { scores: { ...entry(1).scores, lean: 61571 }, acked: ["deep", "lean"] }),
    entry(2, { acked: [...SUBMIT_BOARDS, "lean"] }),
  ]);
  const once = sanitizeQueue(raw);
  const twice = sanitizeQueue(once);
  assert.deepStrictEqual(once, twice);
});

test("source pin: the storage key appears once; no DOM, clock or randomness in the pure operations", () => {
  const src = fs.readFileSync(SRC, "utf8");
  assert.equal(src.split("ddr.pgsqueue.v1").length - 1, 1);
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.ok(!/\bwindow\.|\bdocument\.|Math\.random|localStorage/.test(code));
});
