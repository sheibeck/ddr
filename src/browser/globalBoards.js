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
//     board: "deep" | "lean" | "combo" | "days" | "kills" | "purse",
//     scope: "all" | "friends",
//     season: number,
//     entries: GlobalEntry[]   (ranked order as returned; [] unless status is "ready"),
//     you: GlobalEntry | null  (the player's own score on this board and scope),
//     total: number | null     (the collection's score count when Play Games reports it),
//     sampled: number | null   (combo only: how many DEEPEST scores the sample read),
//     stale: boolean           (a cached result shown after a failed refresh)
//   }
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

/** DEEPEST scores read for the LINEAGE sample (D-09; the plugin's per-call ceiling, no paging). */
export const LINEAGE_SAMPLE_N = 25;

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
 * toGlobalEntry(score, index, { meId, scope }) — one normalized Play Games
 * score ({ rank, rawScore, tag, handle, playerId, friend }) as a frozen
 * GlobalEntry. `you` is true when the score's playerId is the signed-in
 * player's (an empty id never matches); in the friends scope every non-you
 * row is a friend. Remote values are untrusted (T-68-07): the rank must be an
 * integer from 1, the raw score a finite number, the handle a string, and
 * the tag goes through the never-throw decodeTag.
 */
export function toGlobalEntry(score, index, { meId = "", scope = "all" } = {}) {
  const s = score && typeof score === "object" ? score : {};
  const playerId = str(s.playerId);
  const me = str(meId);
  const you = playerId !== "" && playerId === me;
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
 * snapshotOf({ status, board, scope, season, entries, you, total, sampled,
 * stale }) — a deep-frozen GlobalSnapshot. Defaults: entries [], you null,
 * total null, sampled null, stale false. Entries are forced to [] unless the
 * status is "ready"; their order is kept exactly.
 */
export function snapshotOf({
  status,
  board,
  scope,
  season,
  entries = [],
  you = null,
  total = null,
  sampled = null,
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
    sampled: countOf(sampled),
    stale: stale === true,
  });
}

/** The boards the global panel can show (GRAVEYARD stays local, D-17). */
const GLOBAL_BOARDS = Object.freeze(["deep", "lean", "combo", "days", "kills", "purse"]);

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
 *   - null while inactive, for GRAVEYARD, the local scope or anything unknown;
 *   - "closed" (no call) when the board's id is missing or a placeholder
 *     (D-14; LINEAGE reads DEEPEST, so a placeholder DEEPEST closes it too);
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
  // { ok: true, entries, you, total, sampled }. May reject; start() maps a
  // rejection to a failure.
  async function load(id, { board, scope }) {
    const collection = scope === "friends" ? "friends" : "public";
    if (scope === "friends") {
      const access = await provider.friendsAccess({ request: false });
      if (access === "required") return { consent: true };
      if (access !== "granted") return { ok: false };
    }
    const combo = board === "combo";
    const [top, own] = await Promise.all([
      provider.loadTopScores({ leaderboardId: id, collection, maxResults: combo ? LINEAGE_SAMPLE_N : TOP_N }),
      provider.loadPlayerScore({ leaderboardId: id, collection }),
    ]);
    if (!top || typeof top !== "object" || top.ok !== true) return { ok: false };
    const mine = own && own.ok === true && own.score && typeof own.score === "object" ? own.score : null;
    const me = meId() || (mine ? str(mine.playerId) : "");
    const entries = (Array.isArray(top.scores) ? top.scores : []).map((s, i) => toGlobalEntry(s, i, { meId: me, scope }));
    const you = mine ? Object.freeze({ ...toGlobalEntry(mine, 0, { meId: me, scope }), key: "g:you", you: true, friend: false }) : null;
    return { ok: true, entries, you, total: top.total, sampled: combo ? entries.length : null };
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
      const { entries, you, total, sampled } = outcome;
      entry.snapshot = snapshotOf({ status: "ready", board, scope, season, entries, you, total, sampled });
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
      const id = leaderboardId(ids, season, board === "combo" ? "deep" : board);
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
