// src/browser/runBackfill.js
//
// Phase 83 plan 12 (SRV-06 addendum). The once-only backfill of local runs
// from the 2.1.0 release on. User ruling (2026-09-28), which REPLACES the
// same-day "start fresh, no backfill" ruling recorded in 83-06-SUMMARY.md:
// "Actually, any runs from the current version that we released just today,
// should show up on the new leaderboard, but nothing prior to that." The
// released build is 2.1.0, versionCode 11, tag `v2.1.0-play11`
// (2026-09-28 15:41:01 -0400 = 19:41:01 UTC) — BACKFILL_SINCE_MS below.
//
// Local run records (ddr.bests.v1 / ddr.graveyard.v1, both written by
// src/browser/engineAdapter.js from engine/death.js#buildRunSummary) carry no
// app version, only `when` (the death wall-clock time in ms — `currentState.
// deathAt`, or Date.now() as engineAdapter.js's own fallback). Because
// there's no version field to filter on, the cutoff has to be a timestamp:
// a run counts only when `when >= BACKFILL_SINCE_MS`. BACKFILL_VERSION is
// stamped as the REAL build string "2.1.0 (11)", not a literal "backfill",
// so tools/boards-admin.mjs's per-build balance export (CONTEXT "The run
// document") reads these rows exactly like any other 2.1.0 (11) submission.
//
// This runs ONCE per device: ddr.boardBackfill.v1 records { v:1, done:true,
// count } the first time it completes (successfully or not — a corrupt or
// missing local store still marks it done, since there is nothing more this
// device could ever backfill). src/browser/boardSync.js#boot calls this at
// launch, once, the first time 2.2 starts with Compete on. Phase 84's YOUR
// DEAD run history import uses the same BACKFILL_SINCE_MS constant
// (imported from this module) to draw its own "since the 2.1.0 release"
// line.
//
// Phase 85 bound (orchestrator decision 2026-09-29): runBackfill only ever
// uploads runs whose hash the local run history (src/browser/runHistory.js,
// ddr.runs.v1) imported as "2.1.0 (11)" — preReleaseHashes(history) below
// gives boardSync.boot the exact allowHashes set. This closes a gap the
// timestamp-only cutoff left open: a 2.2 run played with Compete OFF still
// lands in ddr.graveyard.v1/ddr.bests.v1 with a post-cutoff `when`, so
// collectBackfillRuns alone would have queued it stamped "2.1.0 (11)" the
// first time Compete turned ON — breaking the 2026-09-28 "a run played with
// Compete OFF is never uploaded" ruling. allowHashes closes that gap: only
// the runs the local history already recognizes as pre-2.2 imports can ever
// reach the board through this module.
//
// Pure, DOM-free: no window/document/navigator/localStorage, no bare global
// fetch — the only side effects are the injected `storage` (src/browser/
// storage.js's async getItem/setItem contract) and `queue` (src/browser/
// runQueue.js#createRunQueue's return value; only enqueueMany/flush are
// called). Never throws.

import { sanitizeBests, isValidHash, runHash } from "../../engine/records.js";
import { SEASON } from "../../content/season.js";

export const BACKFILL_KEY = "ddr.boardBackfill.v1";
export const BACKFILL_VERSION = "2.1.0 (11)";
/** BACKFILL_SINCE_MS — the v2.1.0-play11 tag time, 2026-09-28T19:41:01Z. */
export const BACKFILL_SINCE_MS = Date.UTC(2026, 8, 28, 19, 41, 1);

// Matches engineAdapter.js's own BESTS_KEY/GRAVE_KEY exactly — see that
// module's header comments for why each is its own storage key, separate
// from GameState.
const BESTS_KEY = "ddr.bests.v1";
const GRAVE_KEY = "ddr.graveyard.v1";

function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function byWhenThenHash(a, b) {
  if (a.when !== b.when) return a.when - b.when;
  return a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0;
}

/**
 * collectBackfillRuns({ bests, graves, season = SEASON, since =
 * BACKFILL_SINCE_MS }) — the union of sanitizeBests(bests).runs values and
 * the graveyard stones in `graves`, keeping only plain objects whose
 * `season` equals `season`, whose `when` is a finite number >= `since`, and
 * whose `hash` passes isValidHash and equals runHash(run) (a tampered field
 * — including a forged `when`, which sits outside RUN_HASH_FIELDS — drops
 * the run). Deduplicated by hash (first occurrence wins), sorted by `when`
 * ascending then hash ascending. `bests` goes through sanitizeBests first
 * (never throws on a corrupt/missing record); a non-array `graves` (or a
 * missing one) contributes nothing. Season-0 legacy stones (normalizeStone's
 * backfill tag) fail the season check directly. Never mutates its inputs;
 * the returned array, and every run in it, is frozen.
 */
export function collectBackfillRuns(opts = {}) {
  const { bests, graves, season = SEASON, since = BACKFILL_SINCE_MS } = opts;

  const candidates = [];
  const sanitized = sanitizeBests(bests);
  for (const run of Object.values(sanitized.runs)) candidates.push(run);
  if (Array.isArray(graves)) {
    for (const stone of graves) candidates.push(stone);
  }

  const seen = new Set();
  const kept = [];
  for (const run of candidates) {
    if (!isPlainObject(run)) continue;
    if (run.season !== season) continue;
    if (typeof run.when !== "number" || !Number.isFinite(run.when)) continue;
    if (run.when < since) continue;
    if (!isValidHash(run.hash)) continue;
    if (runHash(run) !== run.hash) continue;
    if (seen.has(run.hash)) continue;
    seen.add(run.hash);
    kept.push({ ...run });
  }

  kept.sort(byWhenThenHash);
  return Object.freeze(kept.map((r) => Object.freeze(r)));
}

/**
 * preReleaseHashes(history) — the valid, unique hashes of `history`'s own
 * records (src/browser/runHistory.js's runs array shape: objects carrying
 * `hash`/`version`) whose `version` equals BACKFILL_VERSION exactly, in
 * `history`'s own order. A null, non-array or garbage `history` (or any
 * garbage entry within it) contributes nothing. Frozen. Never throws.
 */
export function preReleaseHashes(history) {
  try {
    const list = Array.isArray(history) ? history : [];
    const seen = new Set();
    const out = [];
    for (const rec of list) {
      if (!isPlainObject(rec)) continue;
      if (rec.version !== BACKFILL_VERSION) continue;
      if (!isValidHash(rec.hash)) continue;
      if (seen.has(rec.hash)) continue;
      seen.add(rec.hash);
      out.push(rec.hash);
    }
    return Object.freeze(out);
  } catch {
    return Object.freeze([]);
  }
}

/**
 * toHashSet(allowHashes) — module-private: an array or a Set becomes a Set
 * of hashes; anything else (missing, not iterable, a plain object) becomes
 * an empty Set. Never throws.
 */
function toHashSet(allowHashes) {
  try {
    if (allowHashes instanceof Set) return allowHashes;
    if (Array.isArray(allowHashes)) return new Set(allowHashes);
    return new Set();
  } catch {
    return new Set();
  }
}

async function readJsonStore(storage, key) {
  try {
    const raw = await storage.getItem(key);
    if (typeof raw !== "string") return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function markDone(storage, count) {
  try {
    await storage.setItem(BACKFILL_KEY, JSON.stringify({ v: 1, done: true, count }));
  } catch {
    // best-effort: a failed write here just means a future boot retries —
    // never throws, never blocks the caller.
  }
}

/**
 * runBackfill({ storage, queue, competeOn, allowHashes }) — the once-only
 * backfill entry point. With Compete OFF (`competeOn` missing or not
 * returning true), resolves { ok: false, reason: "off" } and makes zero
 * network calls and writes nothing to storage — this gate order and
 * contract are unchanged from Phase 83. On the first Compete-ON call, reads
 * ddr.bests.v1 and ddr.graveyard.v1, collects the eligible runs (see
 * collectBackfillRuns), keeps only the ones whose hash is in `allowHashes`
 * (an array or a Set; missing or not iterable counts as empty — see
 * preReleaseHashes above, the Phase 85 bound), enqueues the rest
 * oldest-first through `queue.enqueueMany(runs, { version:
 * BACKFILL_VERSION })`, starts `queue.flush()` (not awaited — same
 * fire-and-continue posture runQueue.js#enqueue's own auto-flush uses),
 * stores ddr.boardBackfill.v1 as { v:1, done:true, count }, and resolves
 * { ok:true, queued, flushed } (`flushed` is the flush() promise). A second
 * call resolves { ok:true, skipped:true } and enqueues nothing. Corrupt or
 * missing local stores collect zero runs but still mark the backfill done,
 * so a device with nothing to backfill never re-checks on every boot. A run
 * already queued or settled in `queue` is skipped by queue.enqueueMany's
 * own dedupe — this module does no extra bookkeeping for that. Never
 * throws.
 */
export async function runBackfill(opts = {}) {
  const { storage, queue, competeOn, allowHashes } = opts;

  if (typeof competeOn !== "function" || competeOn() !== true) {
    return { ok: false, reason: "off" };
  }

  const already = await readJsonStore(storage, BACKFILL_KEY);
  if (isPlainObject(already) && already.done === true) {
    return { ok: true, skipped: true };
  }

  const bests = await readJsonStore(storage, BESTS_KEY);
  const gravesRaw = await readJsonStore(storage, GRAVE_KEY);
  const graves = Array.isArray(gravesRaw) ? gravesRaw : [];

  const allowed = toHashSet(allowHashes);
  const runs = collectBackfillRuns({ bests, graves }).filter((r) => allowed.has(r.hash));

  let queued = 0;
  try {
    const res = await queue.enqueueMany(runs, { version: BACKFILL_VERSION });
    if (res && res.ok === true) queued = Number.isInteger(res.queued) ? res.queued : 0;
  } catch {
    // best-effort: still marks done below so this can never retry-loop
  }

  let flushed = null;
  try {
    flushed = queue.flush();
  } catch {
    flushed = null;
  }

  await markDone(storage, queued);

  return { ok: true, queued, flushed };
}
