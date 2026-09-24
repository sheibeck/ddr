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
// The record operations below are pure: every function returns new objects,
// never mutates its input and never throws.

import { encodeTag } from "./scoreTag.js";
import { boardScores, SUBMIT_BOARDS } from "./boardScores.js";
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
