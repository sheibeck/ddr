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
