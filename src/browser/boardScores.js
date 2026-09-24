// src/browser/boardScores.js
//
// Phase 68 (PGS-03, PGS-06; D-01, D-14, D-16, D-17): the five submitted
// boards' Play Games score encodings and the per-season leaderboard ID
// lookup. Pure: no DOM, no storage, no clock, no randomness; never throws.
//
// Only deep, lean, days, kills and purse are submitted. GRAVEYARD stays local
// (D-17) and LINEAGE is built from a DEEPEST sample (67 D-19), so neither has
// a score here nor an ID in content/leaderboards.js.
//
// A leaderboard score is one integer, so each board folds its tiebreak into
// it (D-16). The raw number is an ordering key only: global rows show the
// values decoded from the score tag (src/browser/scoreTag.js), and
// scoreFallback is the minimal-row fallback for a tag that does not decode.

import { RANKED_BOARDS } from "../../engine/records.js";
import { LEADERBOARD_IDS, LEADERBOARD_PLACEHOLDER_PREFIX } from "../../content/leaderboards.js";

/** The boards submitted to Play Games, in engine/records.js RANKED_BOARDS order. */
export const SUBMIT_BOARDS = Object.freeze([...RANKED_BOARDS]);

/** Each board's Play Games scoreOrder (fixed once a board is published). */
export const SCORE_ORDER = Object.freeze({
  deep: "largerIsBetter",
  lean: "smallerIsBetter",
  days: "largerIsBetter",
  kills: "largerIsBetter",
  purse: "largerIsBetter",
});

/** Every score input is truncated and clamped to 0..SCORE_INPUT_CAP first. */
export const SCORE_INPUT_CAP = 999999999;

const DEEP_STEP_CAP = 999999;
const DEEP_FLOOR_UNIT = 1000000;
const TIEBREAK_FLOOR_CAP = 999;
const TIEBREAK_UNIT = 1000;
const ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

/** int(x) — module-private: a finite number truncated and clamped to 0..SCORE_INPUT_CAP, else 0. */
function int(x) {
  if (typeof x !== "number" || !Number.isFinite(x)) return 0;
  return Math.min(SCORE_INPUT_CAP, Math.max(0, Math.trunc(x)));
}

function isObject(v) {
  return v !== null && typeof v === "object";
}

/**
 * boardScore(board, summary) — the integer submitted to `board` for a run
 * summary (D-16):
 *   deep  = floor x 1,000,000 - steps (steps clamped to 0..999,999; never below 0)
 *   lean  = round(1000 x steps / max(floor, 1)), smaller is better
 *   days  = day x 1000 + min(floor, 999)
 *   kills = kills x 1000 + min(floor, 999)
 *   purse = gold
 * LEANEST's single score cannot also break ties by depth: equal
 * squares-per-floor rates rank equally whatever the floor.
 * @returns {number|null} a non-negative safe integer, or null for combo,
 *   yard and any unknown board
 */
export function boardScore(board, summary) {
  const s = isObject(summary) ? summary : {};
  const floor = int(s.floor);
  switch (board) {
    case "deep": {
      const steps = Math.min(DEEP_STEP_CAP, int(s.steps));
      return Math.max(0, floor * DEEP_FLOOR_UNIT - steps);
    }
    case "lean":
      return Math.round((TIEBREAK_UNIT * int(s.steps)) / Math.max(floor, 1));
    case "days":
      return int(s.day) * TIEBREAK_UNIT + Math.min(floor, TIEBREAK_FLOOR_CAP);
    case "kills":
      return int(s.kills) * TIEBREAK_UNIT + Math.min(floor, TIEBREAK_FLOOR_CAP);
    case "purse":
      return int(s.gold);
    default:
      return null;
  }
}

/** boardScores(summary) — a frozen { deep, lean, days, kills, purse } of boardScore values. */
export function boardScores(summary) {
  const out = {};
  for (const board of SUBMIT_BOARDS) out[board] = boardScore(board, summary);
  return Object.freeze(out);
}

/**
 * scoreFallback(board, rawScore) — the displayable fields a raw score still
 * carries when its tag does not decode: deep → { floor, steps }, days →
 * { day, floor }, kills → { kills, floor }, purse → { gold }, lean →
 * { rate } (squares per floor). Null for a raw score that is not a
 * non-negative safe integer, and for combo, yard or an unknown board.
 */
export function scoreFallback(board, rawScore) {
  if (!Number.isSafeInteger(rawScore) || rawScore < 0) return null;
  switch (board) {
    case "deep": {
      const floor = Math.ceil(rawScore / DEEP_FLOOR_UNIT);
      return Object.freeze({ floor, steps: floor * DEEP_FLOOR_UNIT - rawScore });
    }
    case "lean":
      return Object.freeze({ rate: rawScore / TIEBREAK_UNIT });
    case "days":
      return Object.freeze({ day: Math.floor(rawScore / TIEBREAK_UNIT), floor: rawScore % TIEBREAK_UNIT });
    case "kills":
      return Object.freeze({ kills: Math.floor(rawScore / TIEBREAK_UNIT), floor: rawScore % TIEBREAK_UNIT });
    case "purse":
      return Object.freeze({ gold: rawScore });
    default:
      return null;
  }
}

/**
 * isRealLeaderboardId(id) — true for a 1..128-character id of A-Z a-z 0-9 _ -
 * that is not a placeholder.
 */
export function isRealLeaderboardId(id) {
  return typeof id === "string" && ID_RE.test(id) && !id.startsWith(LEADERBOARD_PLACEHOLDER_PREFIX);
}

/**
 * leaderboardId(ids, season, board) — the live Play Games id for one board
 * in one season, or null (placeholder, empty, malformed, missing season,
 * LINEAGE/GRAVEYARD, non-object map). A null means the caller skips the
 * board silently (D-14). Writes always pass the current SEASON.
 */
export function leaderboardId(ids, season, board) {
  if (!SUBMIT_BOARDS.includes(board) || !isObject(ids)) return null;
  const entry = ids[season];
  if (!isObject(entry)) return null;
  const id = entry[board];
  return isRealLeaderboardId(id) ? id : null;
}

/** knownSeasons(ids) — the season numbers (integers from 1) with an object entry, ascending. */
export function knownSeasons(ids = LEADERBOARD_IDS) {
  if (!isObject(ids)) return [];
  return Object.keys(ids)
    .filter((k) => /^[1-9]\d*$/.test(k) && isObject(ids[k]))
    .map(Number)
    .sort((a, b) => a - b);
}

/**
 * devLeaderboardIds(ids) — a deep-frozen map of the same seasons with
 * "dev_{board}_s{season}" ids. Used only by the browser dev loop's fake
 * provider, so the global boards work without a console.
 */
export function devLeaderboardIds(ids = LEADERBOARD_IDS) {
  const out = {};
  for (const season of knownSeasons(ids)) {
    const entry = {};
    for (const board of SUBMIT_BOARDS) entry[board] = `dev_${board}_s${season}`;
    out[season] = Object.freeze(entry);
  }
  return Object.freeze(out);
}

/** leaderboardIdsFor({ native }) — the console map on a native build, else the dev map. */
export function leaderboardIdsFor({ native } = {}) {
  return native === true ? LEADERBOARD_IDS : devLeaderboardIds();
}

/**
 * scoreOrdersFor(ids) — a frozen { [id]: scoreOrder } over every season and
 * board whose id is real (placeholders are skipped).
 */
export function scoreOrdersFor(ids) {
  const out = {};
  for (const season of knownSeasons(ids)) {
    for (const board of SUBMIT_BOARDS) {
      const id = leaderboardId(ids, season, board);
      if (id) out[id] = SCORE_ORDER[board];
    }
  }
  return Object.freeze(out);
}
