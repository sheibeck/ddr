// src/browser/placement.js
//
// Phase 68 (PLACE-01/02; D-10..D-13, D-03): the DEEPEST rank quip on the
// THAT IS THAT death panel ("You placed 3,117th of 9,044. The 3,116 ahead of
// you are also dead."), the one deferred rail card that covers every run a
// queued-submission flush delivered later, and the one Oracle line for
// queued deaths dropped at a season bump. DEEPEST is the only ranked quip
// (D-10); the words live in content/placement.js.
//
// Pure, deterministic, never throws: no DOM, no storage, no randomness. The
// quip is picked by the run hash (the same rule as src/browser/newBest.js),
// so re-renders are stable. Anything incomplete returns null, so a rank that
// is still loading, or a request that failed, shows nothing at all (D-11).
// Numbers use en-US digit grouping to match the panel's PURSE values.

import { PLACEMENT_LINES, PLACEMENT_CARD, SEASON_DROP_LINES } from "../../content/placement.js";

const HASH_RE = /^[0-9a-f]{8}$/;

/** isCount(x) — module-private: an integer of at least 1. */
function isCount(x) {
  return Number.isInteger(x) && x >= 1;
}

/** validRank(rank, total) — module-private: rank an integer of at least 1,
 * total an integer of at least rank. */
function validRank(rank, total) {
  return isCount(rank) && Number.isInteger(total) && total >= rank;
}

/** group(n) — module-private: en-US digit grouping ("9,044"). */
function group(n) {
  return n.toLocaleString("en-US");
}

/** pick(bank, hash) — module-private: newBest.js's pickIndex rule. A
 * well-formed 8-hex-char hash maps through parseInt/>>>0 into the bank;
 * anything else picks index 0. */
function pick(bank, hash) {
  if (typeof hash === "string" && HASH_RE.test(hash)) {
    return bank[(parseInt(hash, 16) >>> 0) % bank.length];
  }
  return bank[0];
}

/** fill(template, vars) — module-private: replaces {rank}, {total},
 * {ahead} and {count}. A token with no value is left as-is (the callers
 * always supply every token their bank uses; the tests pin that). */
function fill(template, vars) {
  return template.replace(/\{(rank|total|ahead|count)\}/g, (m, k) => (k in vars ? vars[k] : m));
}

/**
 * ordinalText(n) — "1st", "22nd", "113th", "3,117th". The teens rule is
 * checked on n % 100 first, then the last digit decides. Anything but a
 * non-negative integer gives "" (never throws).
 */
export function ordinalText(n) {
  if (!Number.isInteger(n) || n < 0) return "";
  const mod100 = n % 100;
  const mod10 = n % 10;
  let suffix = "th";
  if (mod100 < 11 || mod100 > 13) {
    if (mod10 === 1) suffix = "st";
    else if (mod10 === 2) suffix = "nd";
    else if (mod10 === 3) suffix = "rd";
  }
  return `${group(n)}${suffix}`;
}

/**
 * placementBand(rank) — the PLACEMENT_LINES bank a rank belongs to:
 * 1 "first", 2..10 "ten", 11..100 "hundred", 101 and up "rest".
 */
export function placementBand(rank) {
  if (rank <= 1) return "first";
  if (rank <= 10) return "ten";
  if (rank <= 100) return "hundred";
  return "rest";
}

/**
 * placementLine({ rank, total, newBest, hash }) — the death panel's DEEPEST
 * rank quip, or null unless rank is an integer of at least 1 and total an
 * integer of at least rank (D-11). newBest === false means this run did not
 * beat the player's best, so the rank is the best run's and the "standing"
 * band says so; true, null or missing uses the rank's own band.
 */
export function placementLine(input) {
  if (!input || typeof input !== "object") return null;
  const { rank, total, newBest, hash } = input;
  if (!validRank(rank, total)) return null;
  const band = newBest === false ? "standing" : placementBand(rank);
  return fill(pick(PLACEMENT_LINES[band], hash), {
    rank: ordinalText(rank),
    total: group(total),
    ahead: group(rank - 1),
  });
}

/**
 * deferredPlacementCard({ count, rank, total, newBest, hash }) — one frozen
 * rail card { title, line, tone, hold } for every run a flush delivered
 * (D-12): one or many, a new best or standing. Null unless count is an
 * integer of at least 1 and the rank is complete.
 */
export function deferredPlacementCard(input) {
  if (!input || typeof input !== "object") return null;
  const { count, rank, total, newBest, hash } = input;
  if (!isCount(count) || !validRank(rank, total)) return null;
  const variant = (count === 1 ? "one" : "many") + (newBest === false ? "Standing" : "");
  const line = fill(pick(PLACEMENT_CARD[variant], hash), {
    rank: ordinalText(rank),
    total: group(total),
    count: group(count),
  });
  return Object.freeze({
    title: PLACEMENT_CARD.title,
    line,
    tone: PLACEMENT_CARD.tone,
    hold: PLACEMENT_CARD.hold,
  });
}

/**
 * seasonDropLine(count) — the one Oracle line for queued deaths dropped at
 * a season bump (D-03), singular or plural; null for anything but an
 * integer of at least 1.
 */
export function seasonDropLine(count) {
  if (!isCount(count)) return null;
  return count === 1 ? SEASON_DROP_LINES.one : fill(SEASON_DROP_LINES.many, { count: group(count) });
}
