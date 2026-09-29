// src/browser/runQueue.js
//
// Phase 83 (SRV-06). The durable submission queue: every non-dev,
// Compete-ON, current-season death is enqueued and held under
// `ddr.runQueue.v1` until src/browser/boardWrites.js#submitRun acknowledges
// it (created or exists), survives relaunch and offline play, backs off
// exponentially, never double-submits, and is discarded wholesale when
// Compete turns OFF (purge()). CONTEXT "Queue, backfill & live setup" (the
// queue half only — the once-only backfill of runs from the 2.1.0 release on
// lives in src/browser/runBackfill.js, Phase 83 plan 12, which calls
// enqueueMany() below; this milestone's earlier "start fresh, no backfill"
// posture was superseded by the user's same-day 2026-09-28 ruling):
// enqueue on death; flush on enqueue, on app resume and on `online` (the
// shell wires resume/online in Phase 85 — this module only exposes flush());
// a rules rejection drops that entry with a log line; "already exists" is
// acknowledged; never double-submits; purge() for Compete OFF.
//
// Pure record shape, injected side effects (the src/browser/bugReport.js
// pattern): `storage` is the only durable side effect (async
// getItem/setItem/removeItem, src/browser/storage.js's contract), `writes`
// (src/browser/boardWrites.js#createBoardWrites's return value) is the only
// network side effect (through its own injected fetchFn — this module never
// touches fetch). Never throws.
//
// Phase 85's shell awaits waitForPending() in the native pause path; flushes
// are never awaited there (an entry is always persisted before its network
// call, and a resubmit is acknowledged as "exists").
//
// Record: { v: 1, entries: Entry[], settled: string[], failures, retryAt }
//   Entry = { hash, summary, version, enqueuedAt, attempts }
// `settled` is the ledger of acknowledged-or-dropped hashes (capped at
// SETTLED_MAX), so a run already sent (or a run the rules will never accept)
// can never be queued again — the never-double-submit argument, layered on
// top of boardWrites.js#submitRun's own doc-id + exists=false precondition.
//
// Backoff is record-level (CONTEXT "Claude's Discretion"): `failures` counts
// consecutive transient flush failures; `retryAt` = now + backoffMs(failures)
// (30 s doubling to a 30-minute cap); flush({force:true}) ignores retryAt
// (reserved for the shell's `online` event, Phase 85); a fully drained flush
// resets both to zero.

import { isValidHash } from "../../engine/records.js";
import { SEASON } from "../../content/season.js";

export const RUN_QUEUE_KEY = "ddr.runQueue.v1";
export const QUEUE_MAX = 200;
export const SETTLED_MAX = 500;
export const BACKOFF_BASE_MS = 30000;
export const BACKOFF_MAX_MS = 1800000;

/** backoffMs(n) — 30 s doubling to a 30-minute cap; 0 for n <= 0. */
export function backoffMs(n) {
  const k = Number.isFinite(n) ? Math.trunc(n) : 0;
  if (k <= 0) return 0;
  return Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** (k - 1));
}

function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/** emptyQueue() — a fresh { v: 1, entries: [], settled: [], failures: 0, retryAt: 0 }. */
function emptyQueue() {
  return { v: 1, entries: [], settled: [], failures: 0, retryAt: 0 };
}

/**
 * sanitizeQueue(raw) — a tolerant load: drops any entry with a bad hash, a
 * non-object summary or an out-of-bounds version string; dedupes hashes
 * (first kept); keeps only valid unique settled hashes; a non-negative
 * integer `failures`, a non-negative finite `retryAt`; both lists capped
 * (QUEUE_MAX/SETTLED_MAX, newest kept). Garbage gives emptyQueue(). Never
 * throws.
 */
export function sanitizeQueue(raw) {
  try {
    if (!isPlainObject(raw) || raw.v !== 1) return emptyQueue();

    const entries = [];
    const seen = new Set();
    for (const item of Array.isArray(raw.entries) ? raw.entries : []) {
      if (!isPlainObject(item)) continue;
      const { hash, summary, version, enqueuedAt, attempts } = item;
      if (!isValidHash(hash) || seen.has(hash)) continue;
      if (!isPlainObject(summary)) continue;
      if (typeof version !== "string" || version.length < 1 || version.length > 64) continue;
      seen.add(hash);
      entries.push({
        hash,
        summary: { ...summary },
        version,
        enqueuedAt: Number.isFinite(enqueuedAt) ? enqueuedAt : 0,
        attempts: Number.isInteger(attempts) && attempts >= 0 ? attempts : 0,
      });
    }

    const settled = [];
    for (const h of Array.isArray(raw.settled) ? raw.settled : []) {
      if (isValidHash(h) && !settled.includes(h)) settled.push(h);
    }

    const failures = Number.isInteger(raw.failures) && raw.failures >= 0 ? raw.failures : 0;
    const retryAt = Number.isFinite(raw.retryAt) && raw.retryAt >= 0 ? raw.retryAt : 0;

    return {
      v: 1,
      entries: entries.slice(0, QUEUE_MAX),
      settled: settled.slice(-SETTLED_MAX),
      failures,
      retryAt,
    };
  } catch {
    return emptyQueue();
  }
}

/**
 * createRunQueue({ storage, writes, competeOn, online = () => true,
 * now = Date.now, log = (line) => console.warn(line), onAck }) — returns
 * frozen { enqueue, enqueueMany, flush, purge, snapshot, waitForPending }.
 * `writes` is the object returned by
 * src/browser/boardWrites.js#createBoardWrites (only `submitRun` is
 * called). Never throws.
 */
export function createRunQueue(opts = {}) {
  const { storage, writes, competeOn, online = () => true, now = Date.now, log = (line) => console.warn(line), onAck } = opts;

  let record = emptyQueue();
  let loadPromise = null;
  let flushPromise = null;
  const pendingWrites = new Set();

  // trackedWrite(run) — every storage write persist()/purge() start is
  // registered here (even when the caller never awaits it), so
  // waitForPending() can await whatever is currently in flight, including a
  // write started while it is already waiting.
  function trackedWrite(run) {
    const p = (async () => {
      try {
        await run();
      } catch {
        // best-effort: the in-memory copy already reflects this session
      }
    })();
    pendingWrites.add(p);
    p.finally(() => pendingWrites.delete(p));
    return p;
  }

  function load() {
    if (loadPromise === null) {
      loadPromise = (async () => {
        try {
          const raw = await storage.getItem(RUN_QUEUE_KEY);
          if (typeof raw !== "string") {
            record = emptyQueue();
            return record;
          }
          let parsed;
          try {
            parsed = JSON.parse(raw);
          } catch {
            record = emptyQueue();
            return record;
          }
          record = sanitizeQueue(parsed);
          return record;
        } catch {
          record = emptyQueue();
          return record;
        }
      })();
    }
    return loadPromise;
  }

  async function persist() {
    loadPromise = Promise.resolve(record);
    await trackedWrite(() => storage.setItem(RUN_QUEUE_KEY, JSON.stringify(record)));
  }

  function competeGateOk() {
    return typeof competeOn === "function" && competeOn() === true;
  }

  function onlineOk() {
    try {
      return typeof online === "function" ? online() === true : true;
    } catch {
      return false;
    }
  }

  function logLine(line) {
    try {
      if (typeof log === "function") log(line);
    } catch {
      // a broken logger never breaks the queue
    }
  }

  function callOnAck(summary, result) {
    if (typeof onAck !== "function") return;
    try {
      const r = onAck(summary, result);
      if (r && typeof r.then === "function") Promise.resolve(r).catch(() => {});
    } catch {
      // a broken callback never breaks the queue
    }
  }

  function isValidEntry(summary, version) {
    return (
      isPlainObject(summary) &&
      isValidHash(summary.hash) &&
      summary.season === SEASON &&
      typeof version === "string" &&
      version.length >= 1 &&
      version.length <= 64
    );
  }

  function alreadyKnown(hash) {
    return record.entries.some((e) => e.hash === hash) || record.settled.includes(hash);
  }

  function pushEntry(hash, summary, version) {
    record.entries.push({ hash, summary: { ...summary }, version, enqueuedAt: now(), attempts: 0 });
    if (record.entries.length > QUEUE_MAX) {
      const overflow = record.entries.length - QUEUE_MAX;
      record.entries.splice(0, overflow);
      logLine(`[runQueue] overflow: dropped ${overflow} oldest entr${overflow === 1 ? "y" : "ies"}`);
    }
  }

  function settle(hash) {
    if (!record.settled.includes(hash)) record.settled.push(hash);
    if (record.settled.length > SETTLED_MAX) record.settled.splice(0, record.settled.length - SETTLED_MAX);
  }

  /**
   * enqueue(summary, { dev, version }) — persists a valid, unseen entry
   * BEFORE any network call, then starts an (unforced) flush(). Resolves
   * { ok: true, queued: true, flushed } (flushed is the flush() promise),
   * { ok: true, duplicate: true } for an already-queued-or-settled hash, or
   * { ok: false, reason } ("dev" | "off" | "invalid") with nothing stored.
   */
  async function enqueue(summary, entryOpts = {}) {
    const { dev = false, version } = entryOpts && typeof entryOpts === "object" ? entryOpts : {};
    if (dev === true) return { ok: false, reason: "dev" };
    if (!competeGateOk()) return { ok: false, reason: "off" };
    if (!isValidEntry(summary, version)) return { ok: false, reason: "invalid" };

    await load();
    if (alreadyKnown(summary.hash)) return { ok: true, duplicate: true };

    pushEntry(summary.hash, summary, version);
    await persist();
    const flushed = flush({});
    return { ok: true, queued: true, flushed };
  }

  /**
   * enqueueMany(list, { version }) — every valid, unseen run in `list` in
   * ONE persist call, no network. Resolves { ok: true, queued, skipped }, or
   * { ok: false, reason: "off" } with nothing stored.
   */
  async function enqueueMany(list, entryOpts = {}) {
    const { version } = entryOpts && typeof entryOpts === "object" ? entryOpts : {};
    if (!competeGateOk()) return { ok: false, reason: "off" };

    await load();
    const items = Array.isArray(list) ? list : [];
    let queued = 0;
    let skipped = 0;
    for (const summary of items) {
      if (!isValidEntry(summary, version) || alreadyKnown(summary.hash)) {
        skipped += 1;
        continue;
      }
      pushEntry(summary.hash, summary, version);
      queued += 1;
    }
    if (queued > 0) await persist();
    return { ok: true, queued, skipped };
  }

  async function runFlush(flushOpts) {
    const force = !!flushOpts && flushOpts.force === true;
    await load();
    if (!competeGateOk()) return { ok: false, reason: "off" };
    if (!onlineOk()) return { ok: false, reason: "offline" };
    if (!force && record.retryAt > 0 && now() < record.retryAt) {
      return { ok: false, reason: "backoff", retryAt: record.retryAt };
    }

    let sent = 0;
    let dropped = 0;

    while (record.entries.length > 0) {
      if (!competeGateOk()) return { ok: false, reason: "off", sent, dropped };
      if (!onlineOk()) return { ok: false, reason: "offline", sent, dropped };

      const entry = record.entries[0];
      let result;
      try {
        result = await writes.submitRun(entry.summary, { version: entry.version });
      } catch {
        result = { ok: false, reason: "server" };
      }

      if (result && result.ok === true) {
        record.entries.shift();
        settle(entry.hash);
        record.failures = 0;
        record.retryAt = 0;
        await persist();
        callOnAck(entry.summary, result);
        sent += 1;
        continue;
      }

      const reason = result && result.reason;

      if (reason === "refused" || reason === "invalid") {
        record.entries.shift();
        settle(entry.hash);
        await persist();
        const statusPart = result && result.status ? ` ${result.status}` : "";
        logLine(`[runQueue] dropped ${entry.hash}: ${reason}${statusPart}`);
        dropped += 1;
        continue;
      }

      if (reason === "off") {
        return { ok: false, reason: "off", sent, dropped };
      }

      // Transient (offline, server, auth, unavailable, or a missing reason):
      // the entry stays queued, the record's backoff advances, and the
      // flush stops here — the rest of the queue keeps its order.
      entry.attempts = (Number.isInteger(entry.attempts) ? entry.attempts : 0) + 1;
      record.failures = (Number.isInteger(record.failures) ? record.failures : 0) + 1;
      record.retryAt = now() + backoffMs(record.failures);
      await persist();
      return { ok: false, reason: reason || "server", retryAt: record.retryAt, sent, dropped };
    }

    record.failures = 0;
    record.retryAt = 0;
    await persist();
    return { ok: true, sent, dropped, remaining: record.entries.length };
  }

  /**
   * flush({ force }) — single-flight: a call started while one is already
   * in flight shares that same promise (one create request per entry, never
   * two concurrent runs). See runFlush for the gate order and per-entry
   * outcomes.
   */
  function flush(flushOpts) {
    if (flushPromise) return flushPromise;
    flushPromise = runFlush(flushOpts).finally(() => {
      flushPromise = null;
    });
    return flushPromise;
  }

  /** purge() — discards every pending entry (the Compete-OFF consent withdrawal) and removes the storage key. */
  async function purge() {
    await load();
    record = emptyQueue();
    loadPromise = Promise.resolve(record);
    await trackedWrite(() => storage.removeItem(RUN_QUEUE_KEY));
  }

  /** snapshot() — a frozen read-only view of the current record. */
  async function snapshot() {
    await load();
    return Object.freeze({
      entries: Object.freeze(record.entries.map((e) => Object.freeze({ ...e }))),
      settled: Object.freeze([...record.settled]),
      failures: record.failures,
      retryAt: record.retryAt,
    });
  }

  /**
   * waitForPending() — resolves once every storage write persist()/purge()
   * started has settled, including one started while this call is still
   * waiting. Never awaits the network (a flush's own writes.submitRun call
   * is not a storage write). Never throws.
   */
  async function waitForPending() {
    let batch = [...pendingWrites];
    while (batch.length > 0) {
      await Promise.allSettled(batch);
      batch = [...pendingWrites];
    }
  }

  return Object.freeze({ enqueue, enqueueMany, flush, purge, snapshot, waitForPending });
}
