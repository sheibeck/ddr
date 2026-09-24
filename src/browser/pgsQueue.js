// src/browser/pgsQueue.js
//
// Phase 68 (PGS-04; D-02, D-03, D-04): the durable Play Games submission
// queue. Every non-dev Compete-ON death becomes one entry that is written to
// storage before any submission starts, then flushed board by board, with the
// acknowledgement for each (run hash, board) stored before the next board is
// sent, so no score is ever submitted twice.
//
// The queue is shell-owned cross-run data kept under PGS_QUEUE_KEY through
// the injected storage (window.mzStorage in the shell), never GameState.
//
// Record: { v: 1, entries: Entry[], done: string[] }
//   Entry = { hash, season, tag, scores: { deep, lean, days, kills, purse }, acked: string[] }
// `done` is the ledger of fully submitted run hashes, so a run that already
// finished can never be enqueued again. Ordering is insertion order only.
//
// The tag is built by scoreTag.js#encodeTag and carries no epitaph (67 D-18).
//
// The record operations are pure: every function returns new objects, never
// mutates its input and never throws. createSubmissionQueue (at the end) is
// the stateful flush controller the shell wires to the adapter's
// run-recorded listener (68-07).

import { encodeTag } from "./scoreTag.js";
import { boardScores, leaderboardId, SUBMIT_BOARDS } from "./boardScores.js";
import { isValidHash } from "../../engine/records.js";

export const PGS_QUEUE_KEY = "ddr.pgsqueue.v1";
/** The most pending entries kept; the next one evicts the oldest. */
export const QUEUE_CAP = 50;
/** The most fully submitted run hashes remembered. */
export const DONE_CAP = 100;
/** The first retry delay after a failed flush. */
export const BACKOFF_BASE_MS = 30000;
/** The longest retry delay. */
export const BACKOFF_MAX_MS = 600000;

const TAG_RE = /^[A-Za-z0-9._~-]{1,64}$/;

function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function isSeason(n) {
  return Number.isSafeInteger(n) && n >= 1;
}

function isScore(n) {
  return Number.isSafeInteger(n) && n >= 0;
}

/** emptyQueue() — a fresh { v: 1, entries: [], done: [] }. */
export function emptyQueue() {
  return { v: 1, entries: [], done: [] };
}

/** withQueue(entries, done) — module-private: a new record. */
function withQueue(entries, done) {
  return { v: 1, entries, done };
}

/**
 * sanitizeEntry(raw) — module-private: a clean copy of one stored entry, or
 * null when any field fails its shape. Duplicate acks are deduped.
 */
function sanitizeEntry(raw) {
  if (!isPlainObject(raw)) return null;
  const { hash, season, tag, scores, acked } = raw;
  if (!isValidHash(hash) || !isSeason(season)) return null;
  if (typeof tag !== "string" || !TAG_RE.test(tag)) return null;
  if (!isPlainObject(scores)) return null;
  const cleanScores = {};
  for (const board of SUBMIT_BOARDS) {
    if (!isScore(scores[board])) return null;
    cleanScores[board] = scores[board];
  }
  if (!Array.isArray(acked)) return null;
  const cleanAcked = [];
  for (const board of acked) {
    if (!SUBMIT_BOARDS.includes(board)) return null;
    if (!cleanAcked.includes(board)) cleanAcked.push(board);
  }
  return { hash, season, tag, scores: cleanScores, acked: cleanAcked };
}

/**
 * sanitizeQueue(raw) — the stored record re-validated field by field (the
 * device copy can be edited or corrupted). Drops any entry with a bad hash,
 * season, tag, scores object or ack list; keeps the first of two entries
 * with one hash; keeps only valid unique hashes in `done`; applies both caps
 * (newest kept). Garbage gives emptyQueue(). Never throws.
 */
export function sanitizeQueue(raw) {
  try {
    if (!isPlainObject(raw) || raw.v !== 1) return emptyQueue();
    const entries = [];
    const seen = new Set();
    for (const item of Array.isArray(raw.entries) ? raw.entries : []) {
      const e = sanitizeEntry(item);
      if (!e || seen.has(e.hash)) continue;
      seen.add(e.hash);
      entries.push(e);
    }
    const done = [];
    for (const h of Array.isArray(raw.done) ? raw.done : []) {
      if (isValidHash(h) && !done.includes(h)) done.push(h);
    }
    return withQueue(entries.slice(-QUEUE_CAP), done.slice(-DONE_CAP));
  } catch {
    return emptyQueue();
  }
}

/**
 * queueEntryFor(summary) — one run's entry: its hash and season, the score
 * tag and the five board scores, nothing acked yet. Null for a missing or
 * invalid hash or a season that is not an integer of at least 1.
 */
export function queueEntryFor(summary) {
  try {
    if (!isPlainObject(summary)) return null;
    const { hash, season } = summary;
    if (!isValidHash(hash) || !isSeason(season)) return null;
    return { hash, season, tag: encodeTag(summary), scores: { ...boardScores(summary) }, acked: [] };
  } catch {
    return null;
  }
}

/**
 * enqueueEntry(q, e) — { queue, added }. Appends `e` (evicting the oldest
 * past QUEUE_CAP) unless its hash is already queued or already done, in which
 * case `queue` is `q` itself and `added` is false.
 */
export function enqueueEntry(q, e) {
  if (!e || !isValidHash(e.hash)) return { queue: q, added: false };
  if (q.done.includes(e.hash) || q.entries.some((x) => x.hash === e.hash)) {
    return { queue: q, added: false };
  }
  return { queue: withQueue([...q.entries, e].slice(-QUEUE_CAP), [...q.done]), added: true };
}

/**
 * ackBoard(q, hash, board) — the queue with `board` added once to that
 * entry's acked list. `q` itself for an unknown hash, a board outside
 * SUBMIT_BOARDS, or a board already acked.
 */
export function ackBoard(q, hash, board) {
  if (!SUBMIT_BOARDS.includes(board)) return q;
  const i = q.entries.findIndex((e) => e.hash === hash);
  if (i < 0 || q.entries[i].acked.includes(board)) return q;
  const entries = q.entries.map((e, j) => (j === i ? { ...e, acked: [...e.acked, board] } : e));
  return withQueue(entries, [...q.done]);
}

/**
 * settleQueue(q) — moves every entry acked on all five boards into `done`
 * (newest last, capped at DONE_CAP by dropping the oldest), keeping the rest
 * in order. `q` itself when nothing is complete.
 */
export function settleQueue(q) {
  const complete = (e) => SUBMIT_BOARDS.every((b) => e.acked.includes(b));
  if (!q.entries.some(complete)) return q;
  const done = [...q.done];
  for (const e of q.entries) {
    if (complete(e) && !done.includes(e.hash)) done.push(e.hash);
  }
  return withQueue(q.entries.filter((e) => !complete(e)), done.slice(-DONE_CAP));
}

/**
 * dropStaleSeasons(q, season) — { queue, dropped }: every entry whose season
 * is not `season` removed (D-03: never submitted). With nothing to drop,
 * `queue` is `q` itself and `dropped` is 0.
 */
export function dropStaleSeasons(q, season) {
  const kept = q.entries.filter((e) => e.season === season);
  const dropped = q.entries.length - kept.length;
  if (dropped === 0) return { queue: q, dropped: 0 };
  return { queue: withQueue(kept, [...q.done]), dropped };
}

/**
 * backoffDelay(failures) — the wait before the next unforced flush after
 * `failures` consecutive failures: 30 s doubling to a 10-minute cap; 0 for
 * zero, negative or non-numeric input.
 */
export function backoffDelay(failures) {
  const n = typeof failures === "number" && Number.isFinite(failures) ? Math.trunc(failures) : 0;
  if (n <= 0) return 0;
  return Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.min(n - 1, 30));
}

// --- the flush controller ----------------------------------------------------

/** callSafely(fn, arg) — module-private: calls an optional callback, swallowing sync throws and async rejections. */
function callSafely(fn, arg) {
  if (typeof fn !== "function") return;
  try {
    const r = fn(arg);
    if (r && typeof r.then === "function") Promise.resolve(r).catch(() => {});
  } catch {
    // a callback bug never breaks the queue
  }
}

/** truthy(fn) — module-private: true only when the getter exists and returns exactly true. */
function truthy(fn) {
  try {
    return typeof fn === "function" && fn() === true;
  } catch {
    return false;
  }
}

/**
 * createSubmissionQueue({ storage, provider, ids, season, isCompeting,
 * isSignedIn, onFlushed, onSeasonDrop, now }) — the durable, single-flight
 * submission queue (D-01, D-02, D-03, D-04, D-10, D-14).
 *
 * - enqueue(summary): refused (false) while Compete is OFF, without touching
 *   storage or the provider (D-04). Otherwise the entry is written to storage
 *   first, then a forced flush starts (D-02). False for a run already queued
 *   or already done.
 * - flush({ force }): at most one in flight; a flush requested meanwhile runs
 *   once after it (unless it failed). An unforced flush waits out the backoff
 *   (30 s doubling to 10 minutes after consecutive failures). Signed out with
 *   Compete ON, entries simply wait (D-04). Stale-season entries are dropped
 *   unsent and reported once through onSeasonDrop(count) (D-03). Each board
 *   is submitted to the CURRENT season's id only; a placeholder or missing
 *   id skips that board silently and leaves it pending (D-14). Each ack is
 *   stored before the next submission starts. After a flush with at least one
 *   DEEPEST submission, the DEEPEST standing is read once and reported through
 *   onFlushed({ submitted: [{ hash, newBest }], standing: { rank, total } | null }) (D-10).
 * - purge(): the Compete-OFF consent withdrawal: pending entries are emptied
 *   (the done ledger is kept) and any flush in flight stops before its next
 *   submission and can never write the purged entries back (D-04).
 * - state(): a frozen { size, pending, failures, nextAllowedAt, busy }.
 * - waitForPending(): resolves once every storage write and flush this queue
 *   started has settled, including ones started while it waits.
 * No method ever throws or rejects.
 */
export function createSubmissionQueue({
  storage,
  provider,
  ids,
  season,
  isCompeting,
  isSignedIn,
  onFlushed = null,
  onSeasonDrop = null,
  now = () => Date.now(),
} = {}) {
  let queue = emptyQueue();
  let loadPromise = null;
  let gen = 0;
  let inFlight = null;
  let again = false;
  let failures = 0;
  let nextAllowedAt = 0;

  const pending = new Set();
  function track(promise) {
    const settled = promise.catch(() => {}).finally(() => pending.delete(settled));
    pending.add(settled);
    return promise;
  }

  const competing = () => truthy(isCompeting);
  const signedIn = () => truthy(isSignedIn);
  const clock = () => {
    try {
      const t = now();
      return typeof t === "number" && Number.isFinite(t) ? t : 0;
    } catch {
      return 0;
    }
  };

  function load() {
    if (!loadPromise) {
      loadPromise = track(
        (async () => {
          try {
            const raw = await storage.getItem(PGS_QUEUE_KEY);
            queue = typeof raw === "string" && raw !== "" ? sanitizeQueue(JSON.parse(raw)) : emptyQueue();
          } catch {
            queue = emptyQueue();
          }
        })(),
      );
    }
    return loadPromise.then(() => state());
  }

  // persist() — writes the current queue once; resolves even when the write fails.
  function persist() {
    let write;
    try {
      write = Promise.resolve(storage.setItem(PGS_QUEUE_KEY, JSON.stringify(queue)));
    } catch {
      write = Promise.resolve();
    }
    return track(
      write.then(
        () => {},
        () => {},
      ),
    );
  }

  function enqueue(summary) {
    if (!competing()) return Promise.resolve(false);
    return track(
      (async () => {
        await load();
        if (!competing()) return false;
        const r = enqueueEntry(queue, queueEntryFor(summary));
        if (!r.added) return false;
        queue = r.queue;
        await persist(); // durable before any submission (D-02)
        flush({ force: true });
        return true;
      })().catch(() => false),
    );
  }

  function flush(opts) {
    const force = !!opts && opts.force === true;
    if (inFlight) {
      again = true;
      return inFlight;
    }
    if (!competing()) return Promise.resolve();
    if (!force && clock() < nextAllowedAt) return Promise.resolve();
    const current = (async () => {
      let status = "failed";
      try {
        status = await run();
      } catch {
        status = "failed";
      }
      inFlight = null;
      if (again) {
        again = false;
        if (status !== "failed") await flush({ force: true });
      }
    })();
    inFlight = current;
    track(current);
    return current;
  }

  // run() — one flush pass; resolves "ok", "failed" or "aborted".
  async function run() {
    const myGen = gen;
    await load();
    if (gen !== myGen || !competing() || !signedIn()) return "aborted";

    const drop = dropStaleSeasons(queue, season);
    if (drop.dropped > 0) {
      queue = drop.queue;
      callSafely(onSeasonDrop, drop.dropped);
      await persist();
      if (gen !== myGen) return "aborted";
    }

    // The entries present now; one enqueued mid-flush is left to the follow-up flush.
    const hashes = queue.entries.map((e) => e.hash);
    const submitted = [];
    let status = "ok";

    outer: for (const hash of hashes) {
      for (const board of SUBMIT_BOARDS) {
        const entry = queue.entries.find((e) => e.hash === hash);
        if (!entry || entry.season !== season) continue outer;
        if (entry.acked.includes(board)) continue;
        const id = leaderboardId(ids, season, board);
        if (!id) continue; // D-14: placeholder or missing id; the board stays pending
        if (gen !== myGen || !competing() || !signedIn()) {
          status = "aborted";
          break outer;
        }
        let res = null;
        try {
          res = await provider.submitScore({ leaderboardId: id, score: entry.scores[board], tag: entry.tag });
        } catch {
          res = null;
        }
        if (gen !== myGen) {
          status = "aborted";
          break outer;
        }
        if (!res || res.ok !== true) {
          failures += 1;
          nextAllowedAt = clock() + backoffDelay(failures);
          status = "failed";
          break outer;
        }
        queue = ackBoard(queue, hash, board);
        if (board === "deep") {
          submitted.push(Object.freeze({ hash, newBest: typeof res.newBest === "boolean" ? res.newBest : null }));
        }
        await persist(); // the ack is stored before the next submission (D-02)
        if (gen !== myGen) {
          status = "aborted";
          break outer;
        }
      }
      const settled = settleQueue(queue);
      if (settled !== queue) {
        queue = settled;
        await persist();
        if (gen !== myGen) {
          status = "aborted";
          break;
        }
      }
    }

    if (status === "ok") {
      failures = 0;
      nextAllowedAt = 0;
    }

    if (submitted.length > 0 && gen === myGen) {
      let standing = null;
      const deepId = leaderboardId(ids, season, "deep");
      if (deepId) {
        try {
          const r = await provider.loadStanding({ leaderboardId: deepId });
          if (r && r.ok === true) standing = Object.freeze({ rank: r.rank, total: r.total });
        } catch {
          standing = null;
        }
      }
      if (gen === myGen) {
        callSafely(onFlushed, Object.freeze({ submitted: Object.freeze(submitted), standing }));
      }
    }
    return status;
  }

  function purge() {
    // The generation bumps synchronously, so a flush in flight can never
    // start another submission, or write its entries back, after this call.
    gen += 1;
    again = false;
    failures = 0;
    nextAllowedAt = 0;
    return track(
      (async () => {
        await load();
        queue = withQueue([], [...queue.done]);
        await persist();
      })().catch(() => {}),
    );
  }

  function state() {
    return Object.freeze({
      size: queue.entries.length,
      pending: Object.freeze(queue.entries.map((e) => e.hash)),
      failures,
      nextAllowedAt,
      busy: inFlight !== null,
    });
  }

  async function waitForPending() {
    let snapshot;
    do {
      snapshot = [...pending];
      await Promise.all(snapshot);
    } while ([...pending].some((p) => !snapshot.includes(p)));
  }

  return Object.freeze({ load, enqueue, flush, purge, state, waitForPending });
}
