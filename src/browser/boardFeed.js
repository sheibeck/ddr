// src/browser/boardFeed.js
//
// Phase 84 (BOARD-19, BOARD-23, BOARD-25), Plan 04 Task 2. The LEADERBOARD
// view's data source: one async call per query that turns Phase 83's board
// client reads (topTen/total/ownRuns/rankOf) into a single frozen
// BoardSnapshot the pure view (84-05) can draw directly — the EVERYONE
// count (unfiltered total()), the standing card's filtered N (total()
// under race/sub), and "your best" with its real rank (your own runs on
// the board, picked locally with runDoc.js#rankKeyOf, then rankOf when it
// sits outside the top ten). CONTEXT area 2 "Board data and counts": no
// count reads beyond total() and rankOf — no per-option counts.
//
// The count-read budget per load() is at most four network reads: topTen,
// one unfiltered total() (always asked with stat "deep" — total() is
// stat-independent, so every RANK BY switch shares one cache entry), one
// filtered total() only when a race/sub filter is set, and rankOf only
// when your best exists and sits outside the top ten. ownRuns is read only
// when a uid is present.
//
// The feed reads the player's uid only through identity().snapshot() (the
// injected identity factory) — it never creates an identity, never touches
// storage directly, and makes zero ownRuns calls when no uid is available.
//
// Pure, DOM-free, never throws (every client call is wrapped so a throwing
// client can never reject load()): no window/document/navigator/
// localStorage, no bare global fetch.

import { SEASON } from "../../content/season.js";
import { rankKeyOf } from "./runDoc.js";

const DEFAULT_TTL_MS = 300000;

function normalizeFilter(v) {
  return v === null || v === undefined ? null : v;
}

function queryKey(stat, race, sub) {
  return `${stat}|${race ?? "*"}|${sub ?? "*"}`;
}

async function safeCall(fn) {
  try {
    return await fn();
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

function whenOf(run) {
  if (run && typeof run.when === "number" && Number.isFinite(run.when)) return run.when;
  const parsed = run ? Date.parse(run.createdAt) : NaN;
  return Number.isFinite(parsed) ? parsed : Infinity;
}

/** pickBetter(stat, a, b) — the run with the larger rankKeyOf(stat, .); ties: earlier when (falling back to createdAt), then the smaller id. */
function pickBetter(stat, a, b) {
  const ka = rankKeyOf(stat, a);
  const kb = rankKeyOf(stat, b);
  if (ka !== kb) return ka > kb ? a : b;
  const wa = whenOf(a);
  const wb = whenOf(b);
  if (wa !== wb) return wa < wb ? a : b;
  return a.id < b.id ? a : b;
}

/** bestOwnedRun(stat, season, race, sub, rows) — the best of `rows` under stat, restricted to this season and (when set) race/sub. */
function bestOwnedRun(stat, season, race, sub, rows) {
  let best = null;
  for (const run of Array.isArray(rows) ? rows : []) {
    if (!run || run.season !== season) continue;
    if (race !== null && run.race !== race) continue;
    if (sub !== null && run.sub !== sub) continue;
    best = best === null ? run : pickBetter(stat, best, run);
  }
  return best;
}

/**
 * createBoardFeed({client, identity, now = Date.now, ttlMs = 300000,
 * season = SEASON}) — returns frozen {load, cached, clear}. `identity` is a
 * function returning an object with an async snapshot(), or null/undefined
 * (no identity available; "you" is always null, youKnown true, zero ownRuns
 * calls). Never throws.
 */
export function createBoardFeed(opts = {}) {
  const { client, identity, now = Date.now, ttlMs = DEFAULT_TTL_MS, season = SEASON } = opts;

  const store = new Map(); // queryKey -> { snapshot, builtAt }

  async function safeSnapshotUid() {
    if (typeof identity !== "function") return null;
    try {
      const inst = identity();
      if (!inst || typeof inst.snapshot !== "function") return null;
      const snap = await inst.snapshot();
      const uid = snap && typeof snap === "object" ? snap.uid : null;
      return typeof uid === "string" && uid.length > 0 ? uid : null;
    } catch {
      return null;
    }
  }

  async function load(query = {}) {
    const stat = query && query.stat;
    const race = normalizeFilter(query && query.race);
    const sub = normalizeFilter(query && query.sub);
    const hasFilter = race !== null || sub !== null;

    try {
      const uid = await safeSnapshotUid();

      const topTenP = safeCall(() => client.topTen(stat, race, sub));
      const totalP = safeCall(() => client.total("deep"));
      const filteredTotalP = hasFilter ? safeCall(() => client.total("deep", race, sub)) : Promise.resolve(null);
      const ownRunsP = uid ? safeCall(() => client.ownRuns(uid)) : Promise.resolve(null);

      const [topTenRes, totalRes, filteredTotalRes, ownRunsRes] = await Promise.all([topTenP, totalP, filteredTotalP, ownRunsP]);

      const reads = [];
      let status;
      let reason = null;
      let rows = [];

      if (topTenRes && topTenRes.ok) {
        status = "ready";
        rows = Array.isArray(topTenRes.rows) ? topTenRes.rows : [];
        reads.push(topTenRes);
      } else {
        reason = topTenRes ? topTenRes.reason : "unavailable";
        status = reason === "off" ? "off" : "unreachable";
      }

      let total = null;
      if (totalRes && totalRes.ok) {
        total = totalRes.count;
        reads.push(totalRes);
      }

      let filteredTotal = null;
      if (!hasFilter) {
        filteredTotal = total;
      } else if (filteredTotalRes && filteredTotalRes.ok) {
        filteredTotal = filteredTotalRes.count;
        reads.push(filteredTotalRes);
      }

      let you = null;
      let youKnown = true;

      if (uid) {
        if (!ownRunsRes || !ownRunsRes.ok) {
          youKnown = false;
        } else {
          reads.push(ownRunsRes);
          const best = bestOwnedRun(stat, season, race, sub, ownRunsRes.rows);
          if (best) {
            const idx = rows.findIndex((r) => r.id === best.id);
            if (idx !== -1) {
              you = { id: best.id, rank: idx + 1, listed: true, run: best };
            } else {
              const key = rankKeyOf(stat, best);
              const rankRes = await safeCall(() => client.rankOf(stat, key, race, sub));
              if (rankRes && rankRes.ok) {
                reads.push(rankRes);
                you = { id: best.id, rank: rankRes.rank, listed: false, run: best };
              } else {
                youKnown = false;
              }
            }
          }
        }
      }

      const stale = reads.some((r) => r.stale === true);
      const fetchedAtValues = reads.map((r) => r.fetchedAt).filter((v) => typeof v === "number");
      const fetchedAt = fetchedAtValues.length ? Math.min(...fetchedAtValues) : null;

      const snapshot = Object.freeze({
        status,
        reason,
        stale,
        fetchedAt,
        rows: Object.freeze([...rows]),
        total,
        filteredTotal,
        you: you ? Object.freeze({ ...you }) : null,
        youKnown,
        uid,
      });

      if (status === "ready") {
        store.set(queryKey(stat, race, sub), { snapshot, builtAt: now() });
      }

      return snapshot;
    } catch {
      return Object.freeze({
        status: "unreachable",
        reason: "unavailable",
        stale: false,
        fetchedAt: null,
        rows: Object.freeze([]),
        total: null,
        filteredTotal: null,
        you: null,
        youKnown: true,
        uid: null,
      });
    }
  }

  function cached(query = {}) {
    const stat = query && query.stat;
    const race = normalizeFilter(query && query.race);
    const sub = normalizeFilter(query && query.sub);
    const entry = store.get(queryKey(stat, race, sub));
    if (!entry) return null;
    if (entry.snapshot.status !== "ready" || entry.snapshot.stale) return null;
    if (now() - entry.builtAt >= ttlMs) return null;
    return entry.snapshot;
  }

  function clear() {
    store.clear();
    if (client && typeof client.clear === "function") {
      try {
        client.clear();
      } catch {
        // best-effort — never throws
      }
    }
  }

  return Object.freeze({ load, cached, clear });
}
