// src/browser/placement.js
//
// Phase 85 (ACCT-04, 85-CONTEXT group 2): the DEPTH rank line on the THAT
// IS THAT death panel ("You placed 12th of 340."), the one deferred rail
// card that covers every run a flush delivered after the panel was already
// gone, and placementOutcome, the one rule that decides which of the two a
// boardSync placement report ({ live, rest }) becomes. The words live in
// content/placement.js.
//
// Pure, deterministic, never throws: no DOM, no storage, no randomness. The
// line/card is picked by the run's own hash (the same rule as
// src/browser/newBest.js), so re-renders are stable. Anything incomplete
// returns null, so a rank that is still loading, or a request that failed,
// shows nothing at all. Numbers use en-US digit grouping to match the
// panel's PURSE values.

import { PLACEMENT_LINES, PLACEMENT_CARD } from "../../content/placement.js";

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

/** validReport(r) — module-private: a plain object carrying a valid
 * rank/total pair (a live or rest half of a boardSync placement report). */
function validReport(r) {
  return !!r && typeof r === "object" && validRank(r.rank, r.total);
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
 * placementLine({ rank, total, hash }) — the death panel's DEPTH rank line,
 * or null unless rank is an integer of at least 1 and total an integer of
 * at least rank. Every run has its own rank, so the band always follows
 * the rank itself; any other field on the input (e.g. a caller-supplied
 * newBest) is ignored.
 */
export function placementLine(input) {
  if (!input || typeof input !== "object") return null;
  const { rank, total, hash } = input;
  if (!validRank(rank, total)) return null;
  return fill(pick(PLACEMENT_LINES[placementBand(rank)], hash), {
    rank: ordinalText(rank),
    total: group(total),
    ahead: group(rank - 1),
  });
}

/**
 * deferredPlacementCard({ count, rank, total, hash }) — one frozen rail
 * card { title, line, tone, hold } for every run a flush delivered after
 * the death panel was already gone: one line for a single run, many for
 * several folded together. Null unless count is an integer of at least 1
 * and the rank is complete.
 */
export function deferredPlacementCard(input) {
  if (!input || typeof input !== "object") return null;
  const { count, rank, total, hash } = input;
  if (!isCount(count) || !validRank(rank, total)) return null;
  const variant = count === 1 ? "one" : "many";
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
 * placementOutcome({ live, rest, liveHash, panelUp }) — the one rule that
 * turns a boardSync placement report into either the death panel's fading
 * rank line or one deferred rail card, and never both for the same run.
 * `live` and `rest` are boardSync's report halves: live = { hash, rank,
 * total } | null for the run whose hash equals liveHash at settle time;
 * rest = { count, hash, rank, total } | null folding every other
 * acknowledged run (the best-ranked one's hash/rank/total). `liveHash` is
 * the death panel's own liveDeathHash; `panelUp` is whether that panel is
 * currently shown.
 *
 * A valid live run whose hash still matches liveHash, read while the panel
 * is up, draws the line — and any valid rest still parks its own card. In
 * every other case (the panel already gone, the hashes no longer matching,
 * or simply no live run) a valid live folds into the card: count is rest's
 * count plus one, and the reported rank is whichever of live/rest is
 * better (the smaller rank). With no valid live, a valid rest parks its
 * own card unchanged. Nothing valid gives { line: null, card: null}.
 * Never throws on garbage.
 */
export function placementOutcome(input) {
  try {
    const { live, rest, liveHash, panelUp } = input && typeof input === "object" ? input : {};
    const liveValid = validReport(live);
    const restValid = validReport(rest);

    if (liveValid && panelUp === true && typeof liveHash === "string" && live.hash === liveHash) {
      const line = placementLine({ rank: live.rank, total: live.total, hash: live.hash });
      const card = restValid
        ? deferredPlacementCard({ count: rest.count, rank: rest.rank, total: rest.total, hash: rest.hash })
        : null;
      return { line: line ? { hash: live.hash, line } : null, card };
    }

    if (liveValid) {
      const restCount = restValid && isCount(rest.count) ? rest.count : 0;
      const best = restValid && rest.rank < live.rank
        ? { rank: rest.rank, total: rest.total, hash: rest.hash }
        : { rank: live.rank, total: live.total, hash: live.hash };
      const card = deferredPlacementCard({ count: restCount + 1, ...best });
      return { line: null, card };
    }

    if (restValid) {
      const card = deferredPlacementCard({ count: rest.count, rank: rest.rank, total: rest.total, hash: rest.hash });
      return { line: null, card };
    }

    return { line: null, card: null };
  } catch {
    return { line: null, card: null };
  }
}
