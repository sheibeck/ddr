// test/unit/pgsQueue-flush.test.js
//
// Phase 68 (PGS-03, PGS-04, PGS-06; D-01, D-02, D-03, D-04, D-10, D-14):
// createSubmissionQueue, the flush controller, over the fake Play Games
// provider and a recording in-memory storage. Covers the enqueue-first
// durability, per-(run, board) acks written before the next submission,
// single-flight flushing with one follow-up, the backoff boundary, the
// stale-season drop, the placeholder skip, Compete OFF / purge and the
// DEEPEST standing report.

import test from "node:test";
import assert from "node:assert/strict";

import {
  PGS_QUEUE_KEY,
  createSubmissionQueue,
  queueEntryFor,
  emptyQueue,
} from "../../src/browser/pgsQueue.js";
import { createFakePlayGames } from "../../src/browser/playGames.js";
import { SUBMIT_BOARDS, boardScores, scoreOrdersFor } from "../../src/browser/boardScores.js";
import { encodeTag } from "../../src/browser/scoreTag.js";
import { runHash } from "../../engine/records.js";

// --- helpers -------------------------------------------------------------------

function summary(n = 1, overrides = {}) {
  const s = {
    name: `Hero ${n}`, race: "Dwarf", sub: "Soldier", cls: "Fighter",
    level: 3, sp: 100 + n, floor: 3 + n, day: 10 + n, steps: 200 + n, gold: 50 * n, kills: n,
    cause: "combat", note: "died", epitaph: "Rest.", when: 1000 + n,
    season: 1, seed: 7000 + n, acts: 20 + n,
    ...overrides,
  };
  s.hash = runHash(s);
  return s;
}

/** idsFor(seasons) — a dev-style id map for the given seasons. */
function idsFor(seasons = [1]) {
  const out = {};
  for (const season of seasons) {
    out[season] = {};
    for (const b of SUBMIT_BOARDS) out[season][b] = `dev_${b}_s${season}`;
  }
  return out;
}

const BOARD_OF = (id) => id.split("_")[1];

/** recordingStorage() — a Map-backed getItem/setItem that logs every call. */
function recordingStorage({ initial = null } = {}) {
  const map = new Map();
  if (initial !== null) map.set(PGS_QUEUE_KEY, typeof initial === "string" ? initial : JSON.stringify(initial));
  const log = [];
  const ctl = {
    rejectGet: false,
    rejectSet: false,
    getGate: null,
    setDelay: 0,
    issued: 0,
    settled: 0,
  };
  const storage = {
    async getItem(k) {
      log.push(["get", k]);
      if (ctl.getGate) await ctl.getGate;
      if (ctl.rejectGet) throw new Error("get rejected");
      return map.has(k) ? map.get(k) : null;
    },
    setItem(k, v) {
      log.push(["set", k, v]);
      ctl.issued += 1;
      if (ctl.rejectSet) {
        ctl.settled += 1;
        return Promise.reject(new Error("set rejected"));
      }
      map.set(k, v);
      if (ctl.setDelay > 0) {
        return new Promise((resolve) =>
          setTimeout(() => {
            ctl.settled += 1;
            resolve();
          }, ctl.setDelay),
        );
      }
      ctl.settled += 1;
      return Promise.resolve();
    },
  };
  const stored = () => (map.has(PGS_QUEUE_KEY) ? JSON.parse(map.get(PGS_QUEUE_KEY)) : null);
  return { storage, log, ctl, stored, map };
}

/**
 * wrapProvider(fake) — the fake with a hookable submitScore: `hold` gates
 * every submit until open(); `before(opts)` runs as each submit starts;
 * `after(opts, result)` runs when it returns.
 */
function wrapProvider(fake) {
  let release = null;
  let gate = null;
  const started = [];
  const w = {
    before: null,
    after: null,
    started,
    hold() {
      gate = new Promise((r) => {
        release = r;
      });
    },
    open() {
      const r = release;
      gate = null;
      release = null;
      if (r) r();
    },
  };
  const provider = {
    ...fake,
    async submitScore(opts) {
      started.push(opts);
      if (w.before) w.before(opts);
      if (gate) await gate;
      const res = await fake.submitScore(opts);
      if (w.after) w.after(opts, res);
      return res;
    },
  };
  return { provider, w };
}

async function until(cond, tries = 200) {
  for (let i = 0; i < tries; i++) {
    if (cond()) return;
    await new Promise((r) => setImmediate(r));
  }
  throw new Error("until: condition never became true");
}

/**
 * harness(opts) — a queue over a recording storage and a (wrapped) fake.
 * Returns the queue plus the switches and recorders a test drives.
 */
function harness({
  season = 1,
  seasons = [season],
  ids = null,
  signedIn = true,
  competing = true,
  online = true,
  initial = null,
  t = 1000,
} = {}) {
  const map = ids || idsFor(seasons);
  const fake = createFakePlayGames({ signedIn: true, orders: scoreOrdersFor(map), online });
  const { provider, w } = wrapProvider(fake);
  const store = recordingStorage({ initial });
  const sw = { competing, signedIn, t };
  const flushed = [];
  const drops = [];
  const q = createSubmissionQueue({
    storage: store.storage,
    provider,
    ids: map,
    season,
    isCompeting: () => sw.competing,
    isSignedIn: () => sw.signedIn,
    onFlushed: (r) => flushed.push(r),
    onSeasonDrop: (n) => drops.push(n),
    now: () => sw.t,
  });
  const providerCalls = () => fake.calls().filter((c) => c === "submitScore" || c === "loadStanding");
  return { q, fake, w, store, sw, flushed, drops, providerCalls, ids: map };
}

function storedEntryQueue(entries, done = []) {
  return { v: 1, entries, done };
}

// --- load -------------------------------------------------------------------------

test("load() reads the key once and sanitizes it", async () => {
  const e = queueEntryFor(summary(1));
  const h = harness({ initial: storedEntryQueue([e, { junk: true }]), signedIn: false });
  await h.q.load();
  await h.q.load();
  assert.equal(h.store.log.filter((c) => c[0] === "get").length, 1);
  assert.deepStrictEqual(h.q.state().pending, [e.hash]);
  assert.equal(h.q.state().size, 1);
});

test("load() with garbage or a rejecting getItem gives an empty queue", async () => {
  const g = harness({ initial: "{not json" });
  await g.q.load();
  assert.equal(g.q.state().size, 0);

  const r = harness();
  r.store.ctl.rejectGet = true;
  await assert.doesNotReject(() => r.q.load());
  assert.equal(r.q.state().size, 0);
});

test("enqueue before load finishes waits for it and keeps the stored entries", async () => {
  const old = queueEntryFor(summary(1));
  const h = harness({ initial: storedEntryQueue([old]), signedIn: false });
  let open;
  h.store.ctl.getGate = new Promise((r) => {
    open = r;
  });
  const p = h.q.enqueue(summary(2));
  await new Promise((r) => setImmediate(r));
  assert.equal(h.store.log.filter((c) => c[0] === "set").length, 0, "nothing written while the load is pending");
  open();
  assert.equal(await p, true);
  await h.q.waitForPending();
  assert.deepStrictEqual(h.store.stored().entries.map((e) => e.hash), [old.hash, summary(2).hash]);
});

// --- Compete OFF --------------------------------------------------------------------

test("enqueue with Compete OFF resolves false, touches no storage and calls no provider method", async () => {
  const h = harness({ competing: false });
  assert.equal(await h.q.enqueue(summary(1)), false);
  await h.q.waitForPending();
  assert.equal(h.store.log.length, 0);
  assert.equal(h.fake.calls().length, 0);
});

test("flush with Compete OFF makes no provider call", async () => {
  const h = harness({ competing: false, initial: storedEntryQueue([queueEntryFor(summary(1))]) });
  await h.q.flush({ force: true });
  assert.equal(h.fake.calls().length, 0);
});

// --- the happy path ---------------------------------------------------------------

test("a Compete-ON death is stored before the first submit, then five boards submit in order with the tag", async () => {
  const h = harness();
  const s = summary(1);
  const scores = boardScores(s);
  const tag = encodeTag(s);
  let checkedFirst = false;
  h.w.before = () => {
    if (!checkedFirst) {
      checkedFirst = true;
      const q = h.store.stored();
      assert.ok(q, "the queue was written before the first submission");
      assert.deepStrictEqual(q.entries.map((e) => e.hash), [s.hash]);
      assert.deepStrictEqual(q.entries[0].acked, []);
    }
  };
  assert.equal(await h.q.enqueue(s), true);
  await h.q.waitForPending();
  assert.ok(checkedFirst);
  const subs = h.fake.submissions();
  assert.deepStrictEqual(subs.map((x) => BOARD_OF(x.leaderboardId)), ["deep", "lean", "days", "kills", "purse"]);
  for (const x of subs) {
    const b = BOARD_OF(x.leaderboardId);
    assert.equal(x.leaderboardId, `dev_${b}_s1`);
    assert.equal(x.score, scores[b]);
    assert.equal(x.tag, tag);
  }
  const q = h.store.stored();
  assert.deepStrictEqual(q.entries, []);
  assert.deepStrictEqual(q.done, [s.hash]);
});

test("D-02 ack-before-next: board N's ack is in storage before board N+1's submit starts", async () => {
  const h = harness();
  const s = summary(1);
  const seen = [];
  h.w.before = (opts) => {
    const q = h.store.stored();
    const entry = q.entries.find((e) => e.hash === s.hash);
    seen.push({ board: BOARD_OF(opts.leaderboardId), acked: [...entry.acked] });
  };
  await h.q.enqueue(s);
  await h.q.waitForPending();
  assert.deepStrictEqual(seen, [
    { board: "deep", acked: [] },
    { board: "lean", acked: ["deep"] },
    { board: "days", acked: ["deep", "lean"] },
    { board: "kills", acked: ["deep", "lean", "days"] },
    { board: "purse", acked: ["deep", "lean", "days", "kills"] },
  ]);
});

test("D-10: onFlushed reports the DEEPEST newBest and standing once; loadStanding hits the current DEEPEST id once", async () => {
  const h = harness();
  const s = summary(1);
  await h.q.enqueue(s);
  await h.q.waitForPending();
  assert.equal(h.flushed.length, 1);
  assert.deepStrictEqual(h.flushed[0], { submitted: [{ hash: s.hash, newBest: true }], standing: { rank: 1, total: 1 } });
  assert.equal(h.fake.calls().filter((c) => c === "loadStanding").length, 1);
});

test("a second, worse run reports newBest false", async () => {
  const h = harness();
  await h.q.enqueue(summary(5));
  await h.q.waitForPending();
  const worse = summary(1);
  await h.q.enqueue(worse);
  await h.q.waitForPending();
  assert.equal(h.flushed.length, 2);
  assert.deepStrictEqual(h.flushed[1].submitted, [{ hash: worse.hash, newBest: false }]);
});

test("D-02: enqueuing the same run twice, or after it completed, submits nothing more", async () => {
  const h = harness();
  const s = summary(1);
  const [a, b] = await Promise.all([h.q.enqueue(s), h.q.enqueue(s)]);
  assert.deepStrictEqual([a, b].sort(), [false, true]);
  await h.q.waitForPending();
  assert.equal(h.fake.submissions().length, 5);
  assert.equal(await h.q.enqueue(s), false, "already done");
  await h.q.flush({ force: true });
  await h.q.waitForPending();
  assert.equal(h.fake.submissions().length, 5);
});

test("the done ledger survives a restart: a new queue over the same storage refuses the finished run", async () => {
  const h = harness();
  const s = summary(1);
  await h.q.enqueue(s);
  await h.q.waitForPending();
  const again = createSubmissionQueue({
    storage: h.store.storage,
    provider: h.fake,
    ids: h.ids,
    season: 1,
    isCompeting: () => true,
    isSignedIn: () => true,
  });
  assert.equal(await again.enqueue(s), false);
  await again.waitForPending();
  assert.equal(h.fake.submissions().length, 5);
});

// --- signed out ---------------------------------------------------------------------

test("signed out with Compete ON: queued with zero provider calls, flushed after sign-in (and across a restart)", async () => {
  const h = harness({ signedIn: false });
  const s = summary(1);
  assert.equal(await h.q.enqueue(s), true);
  await h.q.flush({ force: true });
  await h.q.waitForPending();
  assert.equal(h.fake.calls().length, 0);
  assert.deepStrictEqual(h.store.stored().entries.map((e) => e.hash), [s.hash]);

  // a restart: a fresh controller over the same storage still holds it
  const sw = { signedIn: false };
  const restarted = createSubmissionQueue({
    storage: h.store.storage,
    provider: h.fake,
    ids: h.ids,
    season: 1,
    isCompeting: () => true,
    isSignedIn: () => sw.signedIn,
  });
  await restarted.load();
  assert.deepStrictEqual(restarted.state().pending, [s.hash]);
  sw.signedIn = true;
  await restarted.flush({ force: true });
  await restarted.waitForPending();
  assert.equal(h.fake.submissions().length, 5);
  assert.equal(restarted.state().size, 0);
});

// --- offline and backoff -------------------------------------------------------------

test("offline: the first submit fails, failures 1, nextAllowedAt now + 30 s; the boundary is exact; force ignores it; success resets", async () => {
  const h = harness({ online: false, t: 1000 });
  const s = summary(1);
  await h.q.enqueue(s);
  await h.q.waitForPending();
  assert.equal(h.w.started.length, 1, "one attempt");
  let st = h.q.state();
  assert.equal(st.failures, 1);
  assert.equal(st.nextAllowedAt, 31000);
  assert.deepStrictEqual(h.store.stored().entries[0].acked, []);

  h.sw.t = 30999; // now + 29,999
  await h.q.flush();
  assert.equal(h.w.started.length, 1, "one millisecond early: no provider call");

  h.sw.t = 31000; // exactly nextAllowedAt
  await h.q.flush();
  assert.equal(h.w.started.length, 2, "at exactly nextAllowedAt the flush runs");
  st = h.q.state();
  assert.equal(st.failures, 2);
  assert.equal(st.nextAllowedAt, 31000 + 60000);

  await h.q.flush({ force: true });
  assert.equal(h.w.started.length, 3, "force ignores the backoff");
  assert.equal(h.q.state().failures, 3);

  h.fake.setOnline(true);
  await h.q.flush({ force: true });
  await h.q.waitForPending();
  st = h.q.state();
  assert.equal(st.failures, 0);
  assert.equal(st.nextAllowedAt, 0);
  assert.equal(st.size, 0);
  assert.equal(h.fake.submissions().length, 5);
});

test("PGS-04 boundary: consecutive failures back off 30 s, 60 s, 120 s, 240 s, 480 s, 600 s", async () => {
  const h = harness({ online: false, t: 0 });
  await h.q.enqueue(summary(1));
  await h.q.waitForPending();
  const delays = [h.q.state().nextAllowedAt - h.sw.t];
  for (let i = 0; i < 5; i++) {
    await h.q.flush({ force: true });
    delays.push(h.q.state().nextAllowedAt - h.sw.t);
  }
  assert.deepStrictEqual(delays, [30000, 60000, 120000, 240000, 480000, 600000]);
});

test("a partial failure after deep succeeded keeps deep acked; the retry sends only the remaining boards", async () => {
  const h = harness();
  const s = summary(1);
  h.w.after = (opts) => {
    if (BOARD_OF(opts.leaderboardId) === "deep") h.fake.setOnline(false);
  };
  await h.q.enqueue(s);
  await h.q.waitForPending();
  assert.deepStrictEqual(h.store.stored().entries[0].acked, ["deep"]);
  assert.equal(h.q.state().failures, 1);

  h.w.after = null;
  h.fake.setOnline(true);
  await h.q.flush({ force: true });
  await h.q.waitForPending();
  const subs = h.fake.submissions().map((x) => BOARD_OF(x.leaderboardId));
  assert.deepStrictEqual(subs, ["deep", "lean", "days", "kills", "purse"], "deep was sent exactly once");
  assert.equal(h.q.state().size, 0);
});

test("a throwing submitScore counts as a failure and never rejects", async () => {
  const h = harness();
  h.w.before = () => {
    throw new Error("bridge exploded");
  };
  await assert.doesNotReject(() => h.q.enqueue(summary(1)));
  await assert.doesNotReject(() => h.q.waitForPending());
  assert.equal(h.q.state().failures, 1);
  assert.equal(h.q.state().size, 1);
});

// --- seasons (D-03, PGS-06) ---------------------------------------------------------

test("D-03: a stale-season entry is dropped unsent and reported once", async () => {
  const stale = queueEntryFor(summary(1, { season: 1 }));
  const h = harness({ season: 2, seasons: [1, 2], initial: storedEntryQueue([stale]) });
  await h.q.flush({ force: true });
  await h.q.waitForPending();
  assert.equal(h.w.started.length, 0);
  assert.deepStrictEqual(h.drops, [1]);
  assert.deepStrictEqual(h.store.stored().entries, []);
  await h.q.flush({ force: true });
  await h.q.waitForPending();
  assert.deepStrictEqual(h.drops, [1], "reported only once");
  assert.equal(h.flushed.length, 0);
});

test("PGS-06: with mixed seasons only the current season's ids are ever written", async () => {
  const stale = queueEntryFor(summary(1, { season: 1 }));
  const current = queueEntryFor(summary(2, { season: 2 }));
  const h = harness({ season: 2, seasons: [1, 2], initial: storedEntryQueue([stale, current]) });
  await h.q.flush({ force: true });
  await h.q.waitForPending();
  const subs = h.fake.submissions();
  assert.equal(subs.length, 5);
  for (const x of subs) assert.ok(x.leaderboardId.endsWith("_s2"), x.leaderboardId);
  assert.deepStrictEqual(h.drops, [1]);
  assert.deepStrictEqual(h.store.stored().done, [current.hash]);
});

test("a season-1 death enqueued into a season-2 queue is dropped, never sent", async () => {
  const h = harness({ season: 2, seasons: [1, 2] });
  await h.q.enqueue(summary(1, { season: 1 }));
  await h.q.waitForPending();
  assert.equal(h.w.started.length, 0);
  assert.deepStrictEqual(h.drops, [1]);
});

// --- placeholders (D-14) ------------------------------------------------------------

test("D-14: a placeholder DEEPEST id skips that board silently; the other four submit and the entry stays queued", async () => {
  const ids = idsFor([1]);
  ids[1].deep = "PLACEHOLDER_DEEPEST_S1";
  const h = harness({ ids });
  const s = summary(1);
  await assert.doesNotReject(() => h.q.enqueue(s));
  await h.q.waitForPending();
  assert.deepStrictEqual(h.fake.submissions().map((x) => BOARD_OF(x.leaderboardId)), ["lean", "days", "kills", "purse"]);
  const q = h.store.stored();
  assert.deepStrictEqual(q.entries.map((e) => e.hash), [s.hash]);
  assert.deepStrictEqual(q.entries[0].acked, ["lean", "days", "kills", "purse"]);
  assert.equal(h.flushed.length, 0, "no DEEPEST submission, no report");
  assert.equal(h.fake.calls().filter((c) => c === "loadStanding").length, 0);
  assert.equal(h.q.state().failures, 0, "a skip is not a failure");

  await h.q.flush({ force: true });
  await h.q.waitForPending();
  assert.equal(h.fake.submissions().length, 4, "the acked boards are never resent");
});

test("D-14: a missing season map skips every board without throwing", async () => {
  const h = harness({ ids: {} });
  await assert.doesNotReject(() => h.q.enqueue(summary(1)));
  await h.q.waitForPending();
  assert.equal(h.w.started.length, 0);
  assert.equal(h.q.state().size, 1);
});

// --- single flight -------------------------------------------------------------------

test("two flush() calls while one is in flight share one promise; an enqueue meanwhile gets one follow-up flush after it", async () => {
  const first = summary(1);
  const second = summary(2);
  const h = harness({ initial: storedEntryQueue([queueEntryFor(first)]) });
  h.w.hold();
  const p1 = h.q.flush();
  const p2 = h.q.flush();
  assert.equal(p1, p2, "the same promise");
  await until(() => h.w.started.length === 1);
  assert.equal(h.q.state().busy, true);

  await h.q.enqueue(second); // its forced flush joins the in-flight one
  assert.equal(h.w.started.length, 1, "no second flush started while one is in flight");

  h.w.open();
  await p1;
  await h.q.waitForPending();
  const byHash = h.w.started.map((o) => o.tag);
  assert.equal(h.fake.submissions().length, 10);
  assert.deepStrictEqual(byHash.slice(0, 5), Array(5).fill(encodeTag(first)), "the first run's boards all go first");
  assert.deepStrictEqual(byHash.slice(5), Array(5).fill(encodeTag(second)), "then the follow-up flush sends the second");
  assert.equal(h.flushed.length, 2, "two flushes, each reporting its own DEEPEST");
  assert.equal(h.flushed[0].submitted[0].hash, first.hash);
  assert.equal(h.flushed[1].submitted[0].hash, second.hash);
  assert.equal(h.q.state().busy, false);
});

// --- purge and Compete OFF mid-flush (D-04) -----------------------------------------

test("purge() during an in-flight flush: no further submit, storage emptied, not restored, done kept", async () => {
  const a = queueEntryFor(summary(1));
  const b = queueEntryFor(summary(2));
  const doneHash = "0000abcd";
  const h = harness({ initial: storedEntryQueue([a, b], [doneHash]) });
  h.w.hold();
  const p = h.q.flush();
  await until(() => h.w.started.length === 1);
  const purged = h.q.purge();
  h.sw.competing = false; // the shell turns Compete OFF alongside the purge
  h.w.open();
  await purged;
  await p;
  await h.q.waitForPending();
  assert.equal(h.w.started.length, 1, "nothing started after the purge");
  const q = h.store.stored();
  assert.deepStrictEqual(q.entries, []);
  assert.deepStrictEqual(q.done, [doneHash]);
  assert.equal(h.q.state().size, 0);
  assert.equal(h.flushed.length, 0, "a purged flush reports nothing");
});

test("purge() with Compete still ON also stops the in-flight flush (the generation guard alone)", async () => {
  const h = harness({ initial: storedEntryQueue([queueEntryFor(summary(1))]) });
  h.w.hold();
  const p = h.q.flush();
  await until(() => h.w.started.length === 1);
  const purged = h.q.purge();
  h.w.open();
  await Promise.all([purged, p]);
  await h.q.waitForPending();
  assert.equal(h.w.started.length, 1);
  assert.deepStrictEqual(h.store.stored().entries, []);
});

test("purge() clears failures and the backoff", async () => {
  const h = harness({ online: false });
  await h.q.enqueue(summary(1));
  await h.q.waitForPending();
  assert.equal(h.q.state().failures, 1);
  await h.q.purge();
  const st = h.q.state();
  assert.equal(st.failures, 0);
  assert.equal(st.nextAllowedAt, 0);
  assert.equal(st.size, 0);
});

test("Compete turned OFF mid-flush stops before the next submission", async () => {
  const h = harness({ initial: storedEntryQueue([queueEntryFor(summary(1))]) });
  h.w.hold();
  const p = h.q.flush();
  await until(() => h.w.started.length === 1);
  h.sw.competing = false;
  h.w.open();
  await p;
  await h.q.waitForPending();
  assert.equal(h.w.started.length, 1);
});

test("signing out mid-flush stops before the next submission and keeps the entry", async () => {
  const s = summary(1);
  const h = harness({ initial: storedEntryQueue([queueEntryFor(s)]) });
  h.w.hold();
  const p = h.q.flush();
  await until(() => h.w.started.length === 1);
  h.sw.signedIn = false;
  h.w.open();
  await p;
  await h.q.waitForPending();
  assert.equal(h.w.started.length, 1);
  assert.deepStrictEqual(h.store.stored().entries.map((e) => e.hash), [s.hash]);
  assert.equal(h.q.state().failures, 0, "an abort is not a failure");
});

// --- storage failures -----------------------------------------------------------------

test("a rejecting setItem never rejects enqueue, flush or purge; the in-memory ack still prevents a resubmission", async () => {
  const h = harness();
  h.store.ctl.rejectSet = true;
  const s = summary(1);
  await assert.doesNotReject(async () => {
    assert.equal(await h.q.enqueue(s), true);
  });
  await assert.doesNotReject(() => h.q.waitForPending());
  assert.equal(h.fake.submissions().length, 5);
  assert.equal(await h.q.enqueue(s), false);
  await assert.doesNotReject(() => h.q.flush({ force: true }));
  await h.q.waitForPending();
  assert.equal(h.fake.submissions().length, 5);
  await assert.doesNotReject(() => h.q.purge());
});

test("a storage without setItem/getItem functions never throws", async () => {
  const fake = createFakePlayGames({ signedIn: true });
  const q = createSubmissionQueue({
    storage: {},
    provider: fake,
    ids: idsFor([1]),
    season: 1,
    isCompeting: () => true,
    isSignedIn: () => true,
  });
  await assert.doesNotReject(() => q.enqueue(summary(1)));
  await assert.doesNotReject(() => q.waitForPending());
  assert.equal(fake.submissions().length, 5);
});

// --- waitForPending ----------------------------------------------------------------

test("waitForPending() waits for the enqueue write, every ack write and a purge write, including work started meanwhile", async () => {
  const h = harness();
  h.store.ctl.setDelay = 3;
  const s = summary(1);
  h.q.enqueue(s); // deliberately not awaited
  await h.q.waitForPending();
  assert.equal(h.store.ctl.settled, h.store.ctl.issued, "every write settled");
  assert.equal(h.fake.submissions().length, 5, "the flush the enqueue started was also awaited");
  assert.ok(h.store.ctl.issued >= 6, "the entry write and five acks");

  h.q.purge(); // not awaited
  await h.q.waitForPending();
  assert.equal(h.store.ctl.settled, h.store.ctl.issued);
  assert.deepStrictEqual(h.store.stored().entries, []);
});

test("state() is a frozen snapshot", async () => {
  const h = harness({ signedIn: false });
  await h.q.enqueue(summary(1));
  await h.q.enqueue(summary(2));
  const st = h.q.state();
  assert.ok(Object.isFrozen(st));
  assert.deepStrictEqual(st.pending, [summary(1).hash, summary(2).hash]);
  assert.equal(st.size, 2);
  assert.equal(st.busy, false);
  assert.ok(Object.isFrozen(h.q));
  assert.deepStrictEqual(Object.keys(h.q).sort(), ["enqueue", "flush", "load", "purge", "state", "waitForPending"]);
});

test("a throwing onFlushed or onSeasonDrop never breaks the flush", async () => {
  const stale = queueEntryFor(summary(1, { season: 1 }));
  const fake = createFakePlayGames({ signedIn: true });
  const store = recordingStorage({ initial: storedEntryQueue([stale]) });
  const q = createSubmissionQueue({
    storage: store.storage,
    provider: fake,
    ids: idsFor([1, 2]),
    season: 2,
    isCompeting: () => true,
    isSignedIn: () => true,
    onFlushed: () => {
      throw new Error("x");
    },
    onSeasonDrop: () => {
      throw new Error("y");
    },
  });
  await assert.doesNotReject(() => q.enqueue(summary(2, { season: 2 })));
  await q.waitForPending();
  assert.equal(fake.submissions().length, 5);
  assert.equal(q.state().size, 0);
});

test("a failed standing read still settles the entries and reports standing null", async () => {
  const h = harness();
  // make loadStanding fail by going offline right after the last submit
  h.w.after = (opts) => {
    if (BOARD_OF(opts.leaderboardId) === "purse") h.fake.setOnline(false);
  };
  const s = summary(1);
  await h.q.enqueue(s);
  await h.q.waitForPending();
  assert.equal(h.q.state().size, 0);
  assert.deepStrictEqual(h.flushed, [{ submitted: [{ hash: s.hash, newBest: true }], standing: null }]);
  assert.deepStrictEqual(emptyQueue().entries, h.store.stored().entries);
});
