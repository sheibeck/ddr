// src/browser/globalBoards.js
//
// Phase 68 (PGS-05, D-05..D-07, D-09) — the global and friends boards'
// fetch-and-cache controller over the injected Play Games provider
// (src/browser/playGames.js, 68-02). The Leaderboards panel (68-06's
// boardsView) asks view({ board, scope, season }) at any time and gets an
// immediate, honest snapshot back; the fetch runs behind it and onChange
// tells the panel to redraw.
//
// The snapshot contract (68-06 consumes it exactly as stated here):
//
//   GlobalSnapshot = frozen {
//     status: "loading" | "ready" | "unreachable" | "consent" | "closed",
//     board: "deep" | "days" | "kills" | "purse",
//     scope: "all" | "friends",
//     season: number,
//     entries: GlobalEntry[]   (ranked order as returned; [] unless status is "ready"),
//     you: GlobalEntry | null  (the player's own score on this board and scope),
//     total: number | null     (the collection's score count when Play Games reports it),
//     stale: boolean           (a cached result shown after a failed refresh)
//   }
//
// Phase 81 (BOARD-13): LINEAGE ("combo") is retired from this module — it is
// a ME-only board (engine/records.js ME_ONLY_BOARDS) and never reaches
// view(); the signed-in DEEPEST-sample filtering and the `sampled` field are
// gone.
//
// Phase 81 (BOARD-09, R-09/R-10): YOU comes from the signed-in player's own
// leaderboard score record (the loadPlayerScore result for this same board,
// collection and all-time span, passed to toGlobalEntry as `mine`) — see
// isOwnRecord below. The account id (meId) is only the fallback used when no
// own record came back at all. A listed row's scoreHolder is an OPTIONAL
// field the plugin omits whenever Play Games reports none — including for
// the player's own row — so matching on playerId alone (the pre-Phase-81
// behavior) silently missed the player's own entry.
//   GlobalEntry = frozen { key, rank, handle, playerId, you, friend, rawScore, run }
//
// An entry's key is "g:" + (playerId or "anon") + ":" + its index; the
// player's own entry's key is "g:you". Rows decode their displayed values
// from the score tag (D-16) — run is decodeTag(tag) or null, and a row with
// a malformed tag still exists. Entries keep the order Play Games returned
// (rank ascending, ties as returned) and are never re-sorted.
//
// No DOM, no storage, no clock of its own (now is injected) and no network
// except through the provider. While the player is signed out or Compete is
// OFF (isActive() false) nothing here calls the provider at all (D-07), and
// friends consent is only ever requested by requestFriendsAccess() (D-06).
// The cache lives in memory only; nothing is persisted.

import { decodeTag } from "./scoreTag.js";
import { leaderboardId } from "./boardScores.js";

/** How long a fetched snapshot is served before a background refresh (D-07: about 5 minutes). */
export const GLOBAL_TTL_MS = 300000;

/** How long after a failed fetch the next view() may retry (Claude's discretion under D-07). */
export const GLOBAL_RETRY_MS = 30000;

/** Rows fetched for ALL and FRIENDS (D-05, D-06). */
export const TOP_N = 10;

/** rankOf(n) — an integer rank >= 1, else null. */
function rankOf(n) {
  return Number.isSafeInteger(n) && n >= 1 ? n : null;
}

/** countOf(n) — a non-negative safe integer, else null. */
function countOf(n) {
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}

/** str(x) — x when it is a string, else "". */
function str(x) {
  return typeof x === "string" ? x : "";
}

/**
 * isOwnRecord(score, mine, meId) — Phase 81 (BOARD-09, R-09): true when the
 * listed `score` is the signed-in player's own leaderboard record, per the
 * confirmed assumption_delta_decision (81-DEBUG.md's "## Assumption delta"):
 * the player's own leaderboard score record (`mine`, loadPlayerScore's
 * result for this same board/collection/allTime span) decides — by id when
 * both `score` and `mine` carry a non-empty playerId, else by an exact
 * rank + rawScore + tag match. `meId` (the signed-in account id) is only the
 * fallback used when no own record came back at all (`mine` is not an
 * object). Never throws.
 */
export function isOwnRecord(score, mine, meId) {
  const s = score && typeof score === "object" ? score : {};
  if (mine && typeof mine === "object") {
    const sId = str(s.playerId);
    const mId = str(mine.playerId);
    if (sId !== "" && mId !== "") return sId === mId;
    return (
      rankOf(s.rank) !== null &&
      rankOf(s.rank) === rankOf(mine.rank) &&
      s.rawScore === mine.rawScore &&
      str(s.tag) === str(mine.tag)
    );
  }
  return str(s.playerId) !== "" && s.playerId === str(meId);
}

/**
 * toGlobalEntry(score, index, { meId, mine, scope }) — one normalized Play
 * Games score ({ rank, rawScore, tag, handle, playerId, friend }) as a
 * frozen GlobalEntry. `you` is isOwnRecord(score, mine, meId) (Phase 81,
 * BOARD-09); in the friends scope every non-you row is a friend. Remote
 * values are untrusted (T-68-07): the rank must be an integer from 1, the
 * raw score a finite number, the handle a string, and the tag goes through
 * the never-throw decodeTag.
 */
export function toGlobalEntry(score, index, { meId = "", mine = null, scope = "all" } = {}) {
  const s = score && typeof score === "object" ? score : {};
  const playerId = str(s.playerId);
  const you = isOwnRecord(s, mine, meId);
  return Object.freeze({
    key: `g:${playerId || "anon"}:${index}`,
    rank: rankOf(s.rank),
    handle: str(s.handle),
    playerId,
    you,
    friend: scope === "friends" ? !you : s.friend === true,
    rawScore: typeof s.rawScore === "number" && Number.isFinite(s.rawScore) ? s.rawScore : 0,
    run: decodeTag(s.tag),
  });
}

/**
 * snapshotOf({ status, board, scope, season, entries, you, total, stale }) —
 * a deep-frozen GlobalSnapshot. Defaults: entries [], you null, total null,
 * stale false. Entries are forced to [] unless the status is "ready"; their
 * order is kept exactly.
 */
export function snapshotOf({
  status,
  board,
  scope,
  season,
  entries = [],
  you = null,
  total = null,
  stale = false,
} = {}) {
  const rows = status === "ready" && Array.isArray(entries) ? entries.map((e) => Object.freeze(e)) : [];
  return Object.freeze({
    status,
    board,
    scope,
    season,
    entries: Object.freeze(rows),
    you: you && typeof you === "object" ? Object.freeze(you) : null,
    total: countOf(total),
    stale: stale === true,
  });
}

/**
 * The boards the global panel can show. LINEAGE ("combo") and GRAVEYARD
 * ("yard") are ME-only (Phase 81, BOARD-13/BOARD-14, engine/records.js
 * ME_ONLY_BOARDS) and never reach this module. LEANEST was retired (Phase
 * 81, BOARD-17): it never had a Play Games leaderboard to fetch from, so its
 * removal here is presentation-only.
 */
const GLOBAL_BOARDS = Object.freeze(["deep", "days", "kills", "purse"]);

/** The global scopes ("local" is the Phase 66 view and never reaches here). */
const GLOBAL_SCOPES = Object.freeze(["all", "friends"]);

/**
 * createGlobalBoards({ provider, ids, isActive, playerId, onChange, now }) —
 * the fetch-and-cache controller (D-05..D-07, D-09). `provider` is the
 * Play Games provider (native or fake), `ids` the per-season leaderboard ID
 * map (content/leaderboards.js, or the dev map in the browser loop),
 * `isActive()` is true only while signed in with Compete ON, `playerId()`
 * the signed-in player's id, `onChange()` the panel's redraw hook and
 * `now()` the clock. Returns a frozen { view, requestFriendsAccess, clear }.
 *
 * view({ board, scope, season }) answers synchronously from an in-memory
 * cache keyed by "season|board|scope" and starts at most one fetch per key:
 *   - null while inactive, for a ME-only board (LINEAGE, GRAVEYARD; Phase 81,
 *     BOARD-13/BOARD-14 — neither ever reaches this function), the local
 *     scope or anything unknown;
 *   - "closed" (no call) when the board's id is missing or a placeholder;
 *   - "loading" on the first ask, then "ready" once the fetch settles;
 *   - a cached snapshot for GLOBAL_TTL_MS, after which the next view() still
 *     returns it and starts one background refresh;
 *   - on a failed fetch, the last ready snapshot marked stale, or
 *     "unreachable" with no cache; the next view() after GLOBAL_RETRY_MS
 *     retries;
 *   - FRIENDS first asks friendsAccess silently: "required" caches a
 *     "consent" snapshot with no score call, "unavailable" is a failure.
 * A fetch that settles after clear() or after isActive() turned false writes
 * nothing and calls nothing.
 *
 * requestFriendsAccess() is the only path that shows Play Games' consent
 * screen (D-06); one request at a time. "granted" drops the friends
 * snapshots and calls onChange so the next view() fetches rows.
 */
export function createGlobalBoards({
  provider,
  ids,
  isActive,
  playerId = () => "",
  onChange = null,
  now = () => Date.now(),
} = {}) {
  const cache = new Map();
  let generation = 0;
  let consentAsk = null;

  const active = () => {
    try {
      return typeof isActive === "function" && isActive() === true;
    } catch {
      return false;
    }
  };
  const meId = () => {
    try {
      return typeof playerId === "function" ? str(playerId()) : "";
    } catch {
      return "";
    }
  };
  const changed = () => {
    if (typeof onChange !== "function") return;
    try {
      onChange();
    } catch {
      // A redraw failure never breaks the cache.
    }
  };

  // load(id, req) — one fetch's outcome: { consent: true }, { ok: false } or
  // { ok: true, entries, you, total }. May reject; start() maps a rejection
  // to a failure.
  async function load(id, { scope }) {
    const collection = scope === "friends" ? "friends" : "public";
    if (scope === "friends") {
      const access = await provider.friendsAccess({ request: false });
      if (access === "required") return { consent: true };
      if (access !== "granted") return { ok: false };
    }
    const [top, own] = await Promise.all([
      provider.loadTopScores({ leaderboardId: id, collection, maxResults: TOP_N }),
      provider.loadPlayerScore({ leaderboardId: id, collection }),
    ]);
    if (!top || typeof top !== "object" || top.ok !== true) return { ok: false };
    const mine = own && own.ok === true && own.score && typeof own.score === "object" ? own.score : null;
    const me = meId() || (mine ? str(mine.playerId) : "");
    // Phase 81 (BOARD-09, R-09/R-10): match every row against the player's
    // own record (`mine`), not the account id alone, then keep only the
    // FIRST match as YOU — an adjacency tie on rank+rawScore+tag must never
    // mark two rows YOU (R-10: the same entry rendered once listed, once
    // pinned, is exactly this kind of double-match).
    let seenYou = false;
    const entries = (Array.isArray(top.scores) ? top.scores : []).map((s, i) => {
      const e = toGlobalEntry(s, i, { meId: me, mine, scope });
      if (e.you !== true) return e;
      if (seenYou) return Object.freeze({ ...e, you: false, friend: scope === "friends" ? true : e.friend });
      seenYou = true;
      return e;
    });
    const you = mine ? Object.freeze({ ...toGlobalEntry(mine, 0, { meId: me, scope }), key: "g:you", you: true, friend: false }) : null;
    return { ok: true, entries, you, total: top.total };
  }

  // settle(key, entry, gen, outcome) — writes one fetch's outcome into its
  // cache entry, unless the cache was cleared, the entry replaced, or the
  // player stopped being active in the meantime.
  function settle(key, entry, gen, outcome) {
    if (gen !== generation || cache.get(key) !== entry) return;
    if (!active()) {
      if (entry.snapshot.status === "loading") cache.delete(key);
      else entry.inFlight = false;
      return;
    }
    const { board, scope, season } = entry.req;
    const t = now();
    entry.inFlight = false;
    if (outcome && outcome.consent === true) {
      entry.snapshot = snapshotOf({ status: "consent", board, scope, season });
      entry.fetchedAt = t;
      entry.retryAt = null;
    } else if (outcome && outcome.ok === true) {
      const { entries, you, total } = outcome;
      entry.snapshot = snapshotOf({ status: "ready", board, scope, season, entries, you, total });
      entry.fetchedAt = t;
      entry.retryAt = null;
    } else {
      const last = entry.snapshot;
      entry.snapshot =
        last.status === "ready"
          ? snapshotOf({ ...last, stale: true })
          : snapshotOf({ status: "unreachable", board, scope, season });
      entry.retryAt = t + GLOBAL_RETRY_MS;
    }
    changed();
  }

  // start(key, entry) — begins the one fetch for this key.
  function start(key, entry) {
    entry.inFlight = true;
    const gen = generation;
    load(entry.id, entry.req).then(
      (outcome) => settle(key, entry, gen, outcome),
      () => settle(key, entry, gen, { ok: false }),
    );
  }

  function view(request) {
    const { board, scope, season } = request && typeof request === "object" ? request : {};
    if (!active() || !GLOBAL_SCOPES.includes(scope) || !GLOBAL_BOARDS.includes(board)) return null;
    const key = `${season}|${board}|${scope}`;
    let entry = cache.get(key);
    if (!entry) {
      const req = Object.freeze({ board, scope, season });
      const id = leaderboardId(ids, season, board);
      const status = id === null ? "closed" : "loading";
      entry = { req, id, snapshot: snapshotOf({ status, ...req }), fetchedAt: null, retryAt: null, inFlight: false };
      cache.set(key, entry);
      if (id !== null) start(key, entry);
      return entry.snapshot;
    }
    if (entry.id === null || entry.inFlight) return entry.snapshot;
    const t = now();
    const due = entry.retryAt !== null ? t > entry.retryAt : t - entry.fetchedAt > GLOBAL_TTL_MS;
    if (due) start(key, entry);
    return entry.snapshot;
  }

  function requestFriendsAccess() {
    if (!active()) return Promise.resolve("unavailable");
    if (consentAsk) return consentAsk;
    consentAsk = (async () => {
      let answer;
      try {
        answer = await provider.friendsAccess({ request: true });
      } catch {
        answer = "unavailable";
      }
      if (answer === "granted") {
        for (const [key, entry] of cache) if (entry.req.scope === "friends") cache.delete(key);
        changed();
        return "granted";
      }
      return answer === "required" ? "required" : "unavailable";
    })().finally(() => {
      consentAsk = null;
    });
    return consentAsk;
  }

  function clear() {
    generation++;
    cache.clear();
  }

  return Object.freeze({ view, requestFriendsAccess, clear });
}
