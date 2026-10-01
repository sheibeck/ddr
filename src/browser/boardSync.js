// src/browser/boardSync.js
//
// Phase 85 (ACCT-04, ACCT-05, ACCT-06, RETIRE-03; 85-CONTEXT groups 1-3) +
// Phase 91.2 (BOARD-31, D-06, D-11). The board-side engine room the shell
// (85-04/85-05) only has to wire up: death-time submission through the
// durable queue, flushing, erase, the bounded one-time 2.1.0 backfill at boot,
// the retired-key drop (RETIRE-03), and the DEPTH-rank placement report split
// into the live death and the rest.
//
// Phase 91.2 removed the rolled handle from this module (D-11): there is no
// re-roll, no pending-rewrite mark and no handle kept across an erase. A run's
// name is whatever the Play Games session verified (boardWrites.js asks
// identity.boardSession()).
//
// Phase 91.2-06 (D-03, D-05, D-06): session() and signIn() are the shell's
// handles on the Play Games board session. Each maps the identity's answer to
// one frozen info { state, name } (signedIn | signedOut | unavailable | offline
// | error | off), reports it through onSession, and on signedIn runs the D-05
// re-post (once per device) and then a forced flush. A run that reaches the
// queue while the player is signed out is HELD by runQueue (reason "signin",
// no backoff, nothing dropped); a flush or record that hits that hold reports
// { state: "signedOut" } through onSession so the account block can offer SIGN
// IN. boot() with Compete ON runs session() instead of a bare flush.
//
// The D-05 re-post: a 2.2.0 client that was refused after the final-rules
// cutover settled (dropped) runs that never reached the board. The first named
// session on a device reads the two local run stores tolerantly (the same
// parsing runBackfill uses), keeps only runs whose hash is in the queue's
// settled ledger, drops the ones client.ownRuns(uid) already lists, and
// requeues the rest with the version the local history first recorded them
// with. The settled ledger only ever held Compete-ON runs (the queue enqueues
// nothing else), so the re-post cannot upload a run played with Compete OFF;
// a run already on the board is skipped by its hash, and a duplicate would
// answer "exists" anyway. The once-only marker (REPOST_KEY) is written only after a
// successful board read, so a failed read retries at the next session and a
// success never repeats.
//
// Claude's-discretion choices from 85-CONTEXT / this plan's objective:
// - erase drops the whole identity (runs, name record, account, local
//   record) and re-seeds nothing: the next Compete-ON run signs in to Play
//   Games again and claims the player's name afresh.
// - unsent runs at erase: the queue is purged only AFTER a successful
//   erase, so no run of the erased account posts moments later under the
//   new account; a failed erase changes nothing.
//
// Every board call is Compete-gated (T-85-01) — including a player-tapped
// erase, which still needs Compete ON (ACCT-06; Phase 83's deleteAccount
// carries no explicit bypass). A record() started while erase() is running
// is refused ("off") rather than queued under the about-to-be-dropped
// identity — the queue's own Compete gate reads this module's `erasing`
// flag, not just competeOn().
//
// The orchestrator's 2026-09-29 amendment (85-02-PLAN.md): the once-only
// 2.1.0 backfill is decided at the FIRST 2.2 launch, not the first
// Compete-ON launch. 2.1.0-era runs carry no per-run Compete flag, and a
// run played with Compete OFF is never uploaded (user ruling, 2026-09-29)
// — so the Compete setting at that very first boot stands in for it. A
// device whose first 2.2 launch has Compete OFF writes the backfill's own
// "done" marker here as skipped (a local storage write, zero network),
// so a LATER Compete-ON launch's runBackfill() call sees the marker
// already set and enqueues nothing from the backfill.
//
// Pure, DOM-free: storage, fetchFn, identity and client are all injected —
// every DOM/browser global (the window object, the document object, the
// navigator object, the browser's own key-value storage) is off limits, and
// so is a bare global fetch call. No method here ever throws or rejects.

import { createBoardWrites } from "./boardWrites.js";
import { createRunQueue } from "./runQueue.js";
import { runBackfill, preReleaseHashes, collectBackfillRuns, BACKFILL_KEY } from "./runBackfill.js";
import { deepKeyOf } from "./runDoc.js";

// The local run stores the D-05 re-post reads (the same keys, and the same
// tolerant parsing through collectBackfillRuns, runBackfill.js uses).
const BESTS_KEY = "ddr.bests.v1";
const GRAVE_KEY = "ddr.graveyard.v1";
/** REPOST_KEY — the once-per-device D-05 re-post marker: { v: 1, done: true, count }. */
const REPOST_KEY = "ddr.boardRepost.v1";

/**
 * RETIRED_KEYS — the retired storage keys, dropped silently at every boot
 * regardless of Compete: the pre-2.2 submission queue (RETIRE-03; 85-06's
 * RETIRE-02 sweep allowlists exactly that one occurrence in this file) and
 * the 2.2 re-roll's pending-rewrite mark (D-11: nothing writes or reads it any
 * more).
 */
export const RETIRED_KEYS = Object.freeze(["ddr.pgsqueue.v1", "ddr.handleRewrite.v1"]);

function safeCall(fn, ...args) {
  if (typeof fn !== "function") return;
  try {
    const r = fn(...args);
    if (r && typeof r.then === "function") Promise.resolve(r).catch(() => {});
  } catch {
    // a broken callback never breaks boardSync
  }
}

function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/** The session states the shell is told about. */
function sessionInfo(state, name = null) {
  return Object.freeze({ state, name });
}
const SIGNED_OUT_INFO = sessionInfo("signedOut");
const OFF_INFO = sessionInfo("off");

/** infoFromSession(res) — the identity's boardSession/signIn answer as a frozen { state, name }. */
function infoFromSession(res) {
  if (!res || typeof res !== "object") return sessionInfo("error");
  if (res.ok === true) return sessionInfo("signedIn", typeof res.name === "string" ? res.name : null);
  switch (res.reason) {
    case "signin":
      return SIGNED_OUT_INFO;
    case "unavailable":
      return sessionInfo("unavailable");
    case "offline":
      return sessionInfo("offline");
    case "off":
      return OFF_INFO;
    default:
      // server, refused, or anything unforeseen
      return sessionInfo("error");
  }
}

/**
 * createBoardSync({ storage, fetchFn, identity, client, config, competeOn,
 * online = () => true, version = () => "dev", liveHash = () => null,
 * onAcked, onPlacement, onChange, onSession, now = Date.now, log }) — returns
 * frozen { boot, record, flush, session, signIn, purge, erase, waitForPending }.
 * `identity` is src/browser/firebaseAuth.js#createIdentity's return value;
 * `client` is src/browser/boardClient.js#createBoardClient's return value
 * (only rankOf/total/ownRuns/clear are called). Never throws.
 */
export function createBoardSync(opts = {}) {
  const {
    storage,
    fetchFn,
    identity,
    client,
    config,
    competeOn,
    online = () => true,
    version = () => "dev",
    liveHash = () => null,
    onAcked,
    onPlacement,
    onChange,
    onSession,
    now = Date.now,
    log,
  } = opts;

  let erasing = false;
  // The boot history (runHistory's records) — kept so the D-05 re-post can
  // look a run's first-recorded version up by hash.
  let bootHistory = [];
  let repostInFlight = null;
  let ackedRuns = [];
  let settleChain = Promise.resolve();
  let flushInFlight = null;
  let flushQueued = false;
  const ownPendingWrites = new Set();

  function gate() {
    return typeof competeOn === "function" && competeOn() === true && !erasing;
  }

  // trackedWrite(run) — every storage write this module itself starts
  // (the retired keys, the skipped-backfill marker) is
  // registered here so waitForPending() can await it alongside the
  // queue's own tracked writes.
  function trackedWrite(run) {
    const p = (async () => {
      try {
        await run();
      } catch {
        // best-effort
      }
    })();
    ownPendingWrites.add(p);
    p.finally(() => ownPendingWrites.delete(p));
    return p;
  }

  const writesOpts = { fetchFn, identity };
  if (config !== undefined) writesOpts.config = config;
  const writes = createBoardWrites(writesOpts);

  const queue = createRunQueue({
    storage,
    writes,
    competeOn: gate,
    online,
    now,
    log,
    onAck: (summary) => {
      ackedRuns.push(summary);
    },
  });

  // --- placement -------------------------------------------------------

  async function rankFor(run) {
    if (!run) return null;
    if (!client || typeof client.rankOf !== "function" || typeof client.total !== "function") return null;
    try {
      const [rankRes, totalRes] = await Promise.all([client.rankOf("deep", deepKeyOf(run)), client.total("deep")]);
      if (!rankRes || rankRes.ok !== true || !totalRes || totalRes.ok !== true) return null;
      const total = Math.max(totalRes.count, rankRes.rank);
      return { hash: run.hash, rank: rankRes.rank, total };
    } catch {
      return null;
    }
  }

  function bestOfRest(runs) {
    if (runs.length === 0) return null;
    let best = runs[0];
    for (const r of runs) {
      if (deepKeyOf(r) > deepKeyOf(best)) best = r;
    }
    return best;
  }

  function readLiveHash() {
    try {
      return typeof liveHash === "function" ? liveHash() : null;
    } catch {
      return null;
    }
  }

  async function doSettleOnce() {
    try {
      const batch = ackedRuns;
      ackedRuns = [];
      if (batch.length === 0) return;

      safeCall(onAcked, batch.length);
      safeCall(onChange);

      if (client && typeof client.clear === "function") {
        try {
          client.clear();
        } catch {
          // ignore
        }
      }

      const liveH = readLiveHash();
      let live = null;
      const rest = [];
      for (const r of batch) {
        if (live === null && liveH !== null && liveH !== undefined && r.hash === liveH) {
          live = r;
        } else {
          rest.push(r);
        }
      }
      const bestRest = bestOfRest(rest);

      const [liveReport, restReport] = await Promise.all([rankFor(live), rankFor(bestRest)]);
      if (liveReport === null && restReport === null) return;

      const liveOut = liveReport ? { hash: liveReport.hash, rank: liveReport.rank, total: liveReport.total } : null;
      const restOut = restReport && rest.length > 0 ? { count: rest.length, hash: restReport.hash, rank: restReport.rank, total: restReport.total } : null;
      if (liveOut === null && restOut === null) return;

      safeCall(onPlacement, { live: liveOut, rest: restOut });
    } catch {
      // never throws
    }
  }

  // settleAcks() — serialized: chains onto whatever settle is already
  // running so two overlapping calls never race the same ackedRuns batch.
  function settleAcks() {
    settleChain = settleChain.then(doSettleOnce, doSettleOnce);
    return settleChain;
  }

  // --- record ------------------------------------------------------------

  async function record(summary) {
    try {
      const res = await queue.enqueue(summary, { dev: false, version: version() });
      if (res && res.ok === true && res.queued === true && res.flushed && typeof res.flushed.then === "function") {
        try {
          const flushRes = await res.flushed;
          if (flushRes && flushRes.reason === "signin") safeCall(onSession, SIGNED_OUT_INFO);
        } catch {
          // ignore — settleAcks() below only reacts to what actually acked
        }
      }
      await settleAcks();
      return res;
    } catch {
      return { ok: false, reason: "server" };
    }
  }

  // --- flush (coalesced + serialized) -------------------------------------

  async function runFlushOnce(flushOpts) {
    try {
      if (!gate()) return { ok: false, reason: "off" };

      const res = await queue.flush(flushOpts);
      await settleAcks();
      if (res && res.reason === "signin") safeCall(onSession, SIGNED_OUT_INFO);
      return res;
    } catch {
      return { ok: false, reason: "server" };
    }
  }

  function flush(flushOpts) {
    if (!gate()) return Promise.resolve({ ok: false, reason: "off" });
    if (flushInFlight) {
      flushQueued = true;
      return flushInFlight;
    }
    flushInFlight = runFlushOnce(flushOpts).finally(() => {
      flushInFlight = null;
      if (flushQueued) {
        flushQueued = false;
        flush(flushOpts);
      }
    });
    return flushInFlight;
  }

  // --- D-05 re-post --------------------------------------------------------

  async function readJson(key) {
    try {
      const raw = await storage.getItem(key);
      if (typeof raw !== "string") return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function versionOfHash(hash) {
    for (const rec of Array.isArray(bootHistory) ? bootHistory : []) {
      if (isPlainObject(rec) && rec.hash === hash && typeof rec.version === "string") return rec.version;
    }
    return undefined;
  }

  async function runRepost(uid) {
    try {
      const marker = await readJson(REPOST_KEY);
      if (isPlainObject(marker) && marker.done === true) return;
      if (!gate()) return;

      const snap = await queue.snapshot();
      const settled = new Set(snap.settled);

      const bests = await readJson(BESTS_KEY);
      const gravesRaw = await readJson(GRAVE_KEY);
      const graves = Array.isArray(gravesRaw) ? gravesRaw : [];
      // since: 0 — every stored run is a candidate by hash; only the settled
      // ledger (Compete-ON enqueues) decides which may go out.
      const candidates = collectBackfillRuns({ bests, graves, since: 0 }).filter((r) => settled.has(r.hash));

      let queued = 0;
      if (candidates.length > 0) {
        if (!client || typeof client.ownRuns !== "function" || typeof uid !== "string" || uid === "") return;
        if (typeof client.clear === "function") {
          try {
            client.clear(); // a fresh board read, not the 5-minute cache
          } catch {
            // ignore
          }
        }
        const own = await client.ownRuns(uid);
        if (!own || own.ok !== true || !Array.isArray(own.rows)) return; // marker stays unset: retry next session

        const onBoard = new Set(own.rows.map((row) => row && row.hash));
        const missing = candidates.filter((r) => !onBoard.has(r.hash));
        if (missing.length > 0) {
          const res = await queue.requeue(missing, { versionOf: versionOfHash, version: version() });
          if (!res || res.ok !== true) return;
          queued = Number.isInteger(res.queued) ? res.queued : 0;
        }
      }

      await trackedWrite(() => storage.setItem(REPOST_KEY, JSON.stringify({ v: 1, done: true, count: queued })));
    } catch {
      // never throws; the marker stays unset so the next session retries
    }
  }

  function repostOnce(uid) {
    if (repostInFlight) return repostInFlight;
    repostInFlight = runRepost(uid).finally(() => {
      repostInFlight = null;
    });
    return repostInFlight;
  }

  // --- session / sign-in ---------------------------------------------------

  async function runSession(interactive) {
    try {
      if (!gate()) {
        safeCall(onSession, OFF_INFO);
        return OFF_INFO;
      }
      const res = interactive ? await identity.signIn() : await identity.boardSession({ interactive: false });
      const info = infoFromSession(res);
      safeCall(onSession, info);
      if (info.state === "signedIn") {
        await repostOnce(res.uid);
        await flush({ force: true });
      }
      return info;
    } catch {
      const info = sessionInfo("error");
      safeCall(onSession, info);
      return info;
    }
  }

  /** session() — the quiet board session: reports and returns { state, name }. */
  function session() {
    return runSession(false);
  }

  /** signIn() — the same, with the interactive Play Games sign-in allowed. */
  function signIn() {
    return runSession(true);
  }

  // --- purge ---------------------------------------------------------------

  async function purge() {
    try {
      await queue.purge();
    } catch {
      // never throws
    }
  }

  // --- erase -----------------------------------------------------------

  async function erase() {
    if (!gate()) return { ok: false, reason: "off" };
    erasing = true;
    try {
      if (flushInFlight) {
        try {
          await flushInFlight;
        } catch {
          // ignore
        }
      }

      // Deletes the runs, releases the name, deletes the account and drops the
      // identity record (boardWrites.eraseMyRuns); nothing is re-seeded.
      const res = await writes.eraseMyRuns();
      if (res && res.ok === true) {
        await queue.purge();
        if (client && typeof client.clear === "function") {
          try {
            client.clear();
          } catch {
            // ignore
          }
        }
        safeCall(onChange);
        return { ok: true, deleted: res.deleted };
      }
      return { ok: false, reason: res && res.reason, deleted: (res && res.deleted) || 0 };
    } catch {
      return { ok: false, reason: "server", deleted: 0 };
    } finally {
      erasing = false;
    }
  }

  // --- boot ------------------------------------------------------------

  async function readBackfillDone() {
    try {
      const raw = await storage.getItem(BACKFILL_KEY);
      if (typeof raw !== "string") return false;
      const parsed = JSON.parse(raw);
      return !!(isPlainObject(parsed) && parsed.done === true);
    } catch {
      return false;
    }
  }

  async function boot(bootOpts = {}) {
    try {
      const { history } = bootOpts && typeof bootOpts === "object" ? bootOpts : {};
      bootHistory = Array.isArray(history) ? history : [];

      for (const key of RETIRED_KEYS) {
        await trackedWrite(() => storage.removeItem(key));
      }

      // The 2026-09-29 orchestrator amendment: a device whose first 2.2
      // launch has Compete OFF marks the backfill done-as-skipped right
      // here (a local write, zero network) so a later Compete-ON launch's
      // runBackfill() call never uploads these pre-2.2 runs.
      if (!gate()) {
        const alreadyDone = await readBackfillDone();
        if (!alreadyDone) {
          await trackedWrite(() => storage.setItem(BACKFILL_KEY, JSON.stringify({ v: 1, done: true, count: 0, skipped: "off" })));
        }
      }

      const allowHashes = preReleaseHashes(history);
      const backfillResult = await runBackfill({ storage, queue, competeOn: gate, allowHashes });
      if (backfillResult && backfillResult.flushed && typeof backfillResult.flushed.then === "function") {
        try {
          await backfillResult.flushed;
        } catch {
          // ignore
        }
      }
      await settleAcks();

      if (gate()) {
        await session();
      }

      return { ok: true, backfill: backfillResult };
    } catch {
      return { ok: true, backfill: null };
    }
  }

  // --- waitForPending ----------------------------------------------------

  async function waitForOwnPending() {
    let batch = [...ownPendingWrites];
    while (batch.length > 0) {
      await Promise.allSettled(batch);
      batch = [...ownPendingWrites];
    }
  }

  async function waitForPending() {
    try {
      await Promise.all([
        typeof queue.waitForPending === "function" ? queue.waitForPending() : Promise.resolve(),
        waitForOwnPending(),
      ]);
    } catch {
      // never throws
    }
  }

  return Object.freeze({ boot, record, flush, session, signIn, purge, erase, waitForPending });
}
