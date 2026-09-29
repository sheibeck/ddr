// src/browser/runHistory.js
//
// Phase 84 (BOARD-26, CONTEXT area 3). YOUR DEAD's own per-run history.
//
// The old stores (ddr.graveyard.v1, capped at 60 stones, and ddr.bests.v1,
// a per-board top-ten record) were never built to answer "show me every run
// I've played" — the graveyard trims, and bests only remembers the handful
// of runs that ever led a board. YOUR DEAD needs every run (up to
// RUN_HISTORY_CAP), so this module owns a THIRD adapter-side key,
// ddr.runs.v1, written by src/browser/engineAdapter.js alongside
// persistGrave's existing write batch (never inside GameState — the same
// adapter-owned, cross-run posture as GRAVE_KEY/BESTS_KEY). A dev
// start-at-depth run never enters it, exactly like the other two stores.
//
// The history starts with the 2.1.0 release, not "always": on first launch
// it imports the graveyard stones and ddr.bests.v1 runs at or after
// BACKFILL_SINCE_MS (src/browser/runBackfill.js's own cutoff, user ruling
// 2026-09-28 — "any runs from the current version that we released just
// today should show up on the new leaderboard, but nothing prior to that").
// Nothing older is shown, ever; the imported runs are stamped
// IMPORT_VERSION ("2.1.0 (11)", the same label the board upload uses).
// INTERRED (the panel's death count) is this history's length, not the old
// lifetime total.
//
// NEW PERSONAL BEST also moves onto this history (bests restart with the
// new boards): newBestsAgainst compares a fresh death against every run
// already in the history, using runDoc.js#rankKeyOf so YOUR DEAD's ranking
// and the death panel's "new best?" question read the exact same math the
// board itself uses. engine/records.js is only ever READ here (runHash/
// isValidHash by way of runBackfill.js's collectBackfillRuns) — its bests
// logic is not touched by this module.
//
// Pure, DOM-free: no window, document, navigator, localStorage or bare
// global fetch. Every export here never throws and never mutates its
// inputs — engineAdapter.js is the only place this module's storage key is
// actually read/written.

import { SEASON } from "../../content/season.js";
import { rankKeyOf, BOARD_STATS } from "./runDoc.js";
import { collectBackfillRuns, BACKFILL_VERSION } from "./runBackfill.js";

export const RUN_HISTORY_KEY = "ddr.runs.v1";
export const RUN_HISTORY_CAP = 500;

/** RUN_HISTORY_FIELDS — every field one stored run record carries, in order. */
export const RUN_HISTORY_FIELDS = Object.freeze([
  "hash", "name", "race", "cls", "sub", "level", "floor", "day", "steps",
  "kills", "gold", "sp", "cause", "note", "epitaph", "when", "version", "season",
]);

/** IMPORT_VERSION — the label stamped on every run pulled in by importLegacy. */
export const IMPORT_VERSION = BACKFILL_VERSION;

const HASH_RE = /^[0-9a-f]{8}$/;

function isNonEmptyString(v) {
  return typeof v === "string" && v.length > 0;
}

function isNonNegInt(v) {
  return Number.isInteger(v) && v >= 0;
}

function asString(v) {
  return typeof v === "string" ? v : "";
}

/**
 * byWhenDescThenHashAsc — the history's stored order: newest first, ties
 * broken by hash ascending (a stable, deterministic order with no reliance
 * on insertion order).
 */
function byWhenDescThenHashAsc(a, b) {
  if (a.when !== b.when) return b.when - a.when;
  return a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0;
}

/**
 * historyRecordOf(summary, version) — builds one frozen RUN_HISTORY_FIELDS
 * record from a RunSummary-shaped object (buildRunSummary's own field
 * names — see engine/death.js), or returns null when the run cannot be
 * trusted: `hash` is not 8 lowercase hex, `when` is not a finite integer, a
 * name/race/cls/sub is not a non-empty string, or level/floor/day/steps/
 * kills/gold/sp is not a non-negative integer. `note`, `epitaph`, `cause`
 * and `version` (the function's own parameter, not read from `summary`)
 * fall back to "" when not a string. `season` defaults to SEASON when
 * `summary.season` is not an integer. Never throws.
 */
export function historyRecordOf(summary, version) {
  try {
    const s = summary && typeof summary === "object" ? summary : null;
    if (!s) return null;
    if (!(typeof s.hash === "string" && HASH_RE.test(s.hash))) return null;
    if (!Number.isInteger(s.when)) return null;
    if (!isNonEmptyString(s.name)) return null;
    if (!isNonEmptyString(s.race)) return null;
    if (!isNonEmptyString(s.cls)) return null;
    if (!isNonEmptyString(s.sub)) return null;
    if (!isNonNegInt(s.level)) return null;
    if (!isNonNegInt(s.floor)) return null;
    if (!isNonNegInt(s.day)) return null;
    if (!isNonNegInt(s.steps)) return null;
    if (!isNonNegInt(s.kills)) return null;
    if (!isNonNegInt(s.gold)) return null;
    if (!isNonNegInt(s.sp)) return null;

    const record = {
      hash: s.hash,
      name: s.name,
      race: s.race,
      cls: s.cls,
      sub: s.sub,
      level: s.level,
      floor: s.floor,
      day: s.day,
      steps: s.steps,
      kills: s.kills,
      gold: s.gold,
      sp: s.sp,
      cause: asString(s.cause),
      note: asString(s.note),
      epitaph: asString(s.epitaph),
      when: s.when,
      version: asString(version),
      season: Number.isInteger(s.season) ? s.season : SEASON,
    };
    return Object.freeze(record);
  } catch {
    return null;
  }
}

/** freezeHistory(imported, runs) — module-private: the one frozen history shape. */
function freezeHistory(imported, runs) {
  const frozenRuns = runs.map((r) => (Object.isFrozen(r) ? r : Object.freeze({ ...r })));
  return Object.freeze({ v: 1, imported: imported === true, runs: Object.freeze(frozenRuns) });
}

/**
 * sanitizeHistory(raw) — returns a frozen {v:1, imported, runs} for any
 * input, including null, a string, an array or other garbage. `imported` is
 * true only when `raw.imported === true`. `runs` keeps only the entries
 * historyRecordOf accepts (each re-read through it, keeping its own stored
 * `version`), deduplicated by hash (first occurrence wins), sorted `when`
 * descending then hash ascending, capped at RUN_HISTORY_CAP. Never throws,
 * never mutates `raw`.
 */
export function sanitizeHistory(raw) {
  const r = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const imported = r.imported === true;
  const rawRuns = Array.isArray(r.runs) ? r.runs : [];

  const seen = new Set();
  const kept = [];
  for (const item of rawRuns) {
    if (!item || typeof item !== "object") continue;
    const rec = historyRecordOf(item, item.version);
    if (!rec) continue;
    if (seen.has(rec.hash)) continue;
    seen.add(rec.hash);
    kept.push(rec);
  }
  kept.sort(byWhenDescThenHashAsc);
  return freezeHistory(imported, kept.slice(0, RUN_HISTORY_CAP));
}

/**
 * appendRun(history, record) — returns a new frozen history with `record`
 * added (ignored when its hash is already present, or when it is not a
 * plain object carrying a valid 8-lowercase-hex `hash`), re-sorted and
 * capped at RUN_HISTORY_CAP — a 501st run drops the oldest. Never throws,
 * never mutates its inputs.
 */
export function appendRun(history, record) {
  const base = sanitizeHistory(history);
  const rec =
    record && typeof record === "object" && typeof record.hash === "string" && HASH_RE.test(record.hash)
      ? record
      : null;

  let runs = base.runs;
  if (rec && !runs.some((r) => r.hash === rec.hash)) {
    runs = [...runs, { ...rec }];
  }
  runs = [...runs].sort(byWhenDescThenHashAsc).slice(0, RUN_HISTORY_CAP);
  return freezeHistory(base.imported, runs);
}

/**
 * mergeHistories(stored, memory) — returns the union of `stored` and
 * `memory` by hash (the memory copy wins on a collision), `imported` true
 * when either input is, sorted and capped at RUN_HISTORY_CAP. Used by
 * persistGrave() so a stored history can only ever grow, never shrink, even
 * when this session's in-memory copy raced ahead or fell behind. Never
 * throws, never mutates its inputs.
 */
export function mergeHistories(stored, memory) {
  const s = sanitizeHistory(stored);
  const m = sanitizeHistory(memory);

  const byHash = new Map();
  for (const r of s.runs) byHash.set(r.hash, r);
  for (const r of m.runs) byHash.set(r.hash, r); // memory wins on a collision
  const runs = [...byHash.values()].sort(byWhenDescThenHashAsc).slice(0, RUN_HISTORY_CAP);
  return freezeHistory(s.imported || m.imported, runs);
}

/**
 * importLegacy(history, {bests, graves}) — the once-only 2.1.0-cutoff
 * import: returns `history` merged with runBackfill.js#collectBackfillRuns
 * ({bests, graves}) (the SAME BACKFILL_SINCE_MS cutoff the board's own
 * backfill uses), each collected run mapped through
 * historyRecordOf(run, IMPORT_VERSION), with `imported` forced true — so a
 * run one ms before the cutoff is never imported, one exactly at it is. A
 * run already present in `history` keeps its own stored `version` rather
 * than being overwritten by the import. Never throws, never mutates its
 * inputs.
 */
export function importLegacy(history, opts = {}) {
  const base = sanitizeHistory(history);
  const { bests, graves } = opts && typeof opts === "object" ? opts : {};

  let collected = [];
  try {
    collected = collectBackfillRuns({ bests, graves });
  } catch {
    collected = [];
  }

  const byHash = new Map();
  for (const run of collected) {
    const rec = historyRecordOf(run, IMPORT_VERSION);
    if (rec) byHash.set(rec.hash, rec);
  }
  // Existing records in `base` are applied AFTER the freshly-imported ones,
  // so a run already in the history keeps its own stored version rather
  // than being overwritten by this import.
  for (const r of base.runs) byHash.set(r.hash, r);

  const runs = [...byHash.values()].sort(byWhenDescThenHashAsc).slice(0, RUN_HISTORY_CAP);
  return freezeHistory(true, runs);
}

/**
 * newBestsAgainst(runs, record) — the history-based "new personal best?"
 * comparison the death panel reads. `runs` is the history's own run list
 * (RUN_HISTORY_FIELDS-shaped, so it carries the same floor/day/steps/kills/
 * gold fields runDoc.js#rankKeyOf reads). Returns {first: true, newBests:
 * []} when `runs` is empty (this death is the very first entry in the
 * history); otherwise {first: false, newBests}, listing — in BOARD_STATS
 * order — every stat whose rankKeyOf(stat, record) is strictly greater than
 * the largest rankKeyOf(stat, r) over every run in `runs` (DAYS uses the
 * capped daysKey — runDoc.js#daysKeyOf — so a floor-1 run with 50 days has
 * daysKey 10001, the same anti-farming cap the board itself uses). Never
 * throws.
 */
export function newBestsAgainst(runs, record) {
  const list = Array.isArray(runs) ? runs : [];
  if (list.length === 0) return { first: true, newBests: [] };

  const newBests = [];
  for (const stat of BOARD_STATS) {
    const key = rankKeyOf(stat, record);
    if (typeof key !== "number") continue;
    let best = -Infinity;
    for (const r of list) {
      const k = rankKeyOf(stat, r);
      if (typeof k === "number" && k > best) best = k;
    }
    if (key > best) newBests.push(stat);
  }
  return { first: false, newBests };
}

/**
 * serializeHistory(history) — JSON.stringify of the sanitized
 * {v:1, imported, runs} shape. Never throws.
 */
export function serializeHistory(history) {
  return JSON.stringify(sanitizeHistory(history));
}
