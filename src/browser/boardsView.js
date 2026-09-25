// src/browser/boardsView.js
//
// Phase 66 (BOARD-02..08, D-15) — the Leaderboards panel's pure view model.
// One function, boardsView(input), turns the bests record, the stored
// graveyard and the lifetime total into the exact view object
// src/browser/boardsPanel.js draws (66-03). No DOM, storage, clock or
// randomness anywhere in this module. Every ordering comes from
// engine/records.js and every word of copy comes from content/boards.js —
// this module holds no player-facing literal of its own except the
// structural separator (BOARDS_PANEL_COPY.sep). No network. Phase 67 (D-08)
// adds the signed-in strip from the signedIn/player inputs.
//
// Phase 68 (PGS-05, PGS-06; D-05..D-09, D-16, D-17) adds the global source at
// this same seam: the `global` input is a GlobalSnapshot as 68-05's
// src/browser/globalBoards.js produces it (status loading | ready |
// unreachable | consent | closed, board, scope, season, entries, you, total,
// stale), consumed here as plain data — this module never imports or calls
// the controller. Global rows decode their values from the score tag
// (D-16), falling back to scoreFallback on the raw score when a tag does not
// decode, and never carry an epitaph (67 D-18). `season`/`seasons` add the
// SEASON label and the older-season picker (D-08). Signed out (which is also
// Compete OFF) every view is the local Phase 66 view.
//
// Phase 70 (POLISH-04; D-09..D-11): LINEAGE is one race + sub-class at a
// time. The `lineage` input is the panel's picker selection and `hero` the
// active hero's { race, sub } (already gated by the controller);
// resolveLineage turns them, the most recent run and the content order into
// the selected lineage (D-11). LINEAGE lists that lineage's ten deepest runs
// by engine/records.js lineageRuns — the same order prune keeps them by
// (D-12). The view carries `picker` (the RACE and SUB-CLASS chip rows) on
// LINEAGE only.
//
// Phase 81 (BOARD-11..BOARD-14): three scope chips, ME | ALL | FRIENDS, show
// on every board (GRAVEYARD included); the scope defaults to ALL when signed
// in, ME otherwise. LINEAGE and GRAVEYARD are ME-only boards (the
// engine/records.js ME_ONLY_BOARDS list) at the rail's end — a ME-only board
// requested with a non-local scope resolves to DEEPEST before this module's
// body/standing/global logic ever runs, so LINEAGE never reads a global
// sample (retired: signed-in filtering of the cached DEEPEST sample, and the
// `sampled` field) and GRAVEYARD (whose removal was reversed by the user's
// ruling of 2026-09-25) never asks the global controller.

import {
  compareRuns,
  normalizeStone,
  sortGraveyard,
  sanitizeBests,
  lineageKey,
  lineageRuns,
  BOARD_IDS,
  ME_ONLY_BOARDS,
} from "../../engine/records.js";
import {
  BOARD_COPY,
  BOARD_FOOTNOTES,
  BOARDS_PANEL_COPY,
  STANDING_LINES,
  GLOBAL_STANDING_LINES,
} from "../../content/boards.js";
import { ROMAN } from "../../content/index.js";
import { CAUSE_TEXT } from "../../content/epitaphs.js";
import { RACES } from "../../content/races.js";
import { CLASSES } from "../../content/classes.js";
import { scoreFallback } from "./boardScores.js";

const HASH_RE = /^[0-9a-f]{8}$/;

/** LINEAGE_RACES — the six races in content order (Phase 70, D-09). */
export const LINEAGE_RACES = Object.freeze(Object.keys(RACES));

/** LINEAGE_SUBS — every sub-class in content order: each class (CLASSES key order), its subs in order (Phase 70, D-09). */
export const LINEAGE_SUBS = Object.freeze(
  Object.keys(CLASSES).flatMap((cls) => (Array.isArray(CLASSES[cls].subs) ? CLASSES[cls].subs : []))
);

// ─── ported mock helpers (D-05: port, don't reinvent) ──────────────────────

/** AVATAR_PALETTE — the mock's six avatar colours, in mock order. */
export const AVATAR_PALETTE = Object.freeze(["#6b5c3c", "#4a5c6b", "#5c4a6b", "#4a6b52", "#6b4a4a", "#5c5c4a"]);

/**
 * avatarColour(key) — the mock's AVATAR hash (start at 7, for each UTF-16
 * code unit a = (a * 31 + code) >>> 0, then palette[hash % 6]) over
 * String(key ?? ""). A non-string key never throws.
 */
export function avatarColour(key) {
  const s = String(key ?? "");
  let a = 7;
  for (let i = 0; i < s.length; i++) {
    a = (a * 31 + s.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTE[a % AVATAR_PALETTE.length];
}

/**
 * initialsOf(key) — the mock's INITIALS, ported: strip "@", turn "." and "_"
 * into spaces, split on spaces, drop empties; first letter of word one plus
 * first letter of word two, or the second letter of word one when there is
 * no second word; upper-cased. Returns "?" when there are no words (the
 * mock would throw in that case).
 */
export function initialsOf(key) {
  const s = String(key ?? "")
    .replace("@", "")
    .replace(/[._]/g, " ")
    .split(" ")
    .filter(Boolean);
  if (s.length === 0) return "?";
  const first = s[0][0];
  const second = s[1] ? s[1][0] : s[0][1] || "";
  return (first + second).toUpperCase();
}

/** ordinal(n) — the mock's ORD, verbatim logic. */
export function ordinal(n) {
  return n + (["TH", "ST", "ND", "RD"][n % 100 > 10 && n % 100 < 14 ? 0 : Math.min(n % 10, 4)] || "TH");
}

// ─── module-private helpers ─────────────────────────────────────────────────

/** num(x) — a finite number, else 0. Never throws. */
function num(x) {
  return typeof x === "number" && Number.isFinite(x) ? x : 0;
}

/** rf(run, key) — a safe RunSummary field read; never throws on a non-object. */
function rf(run, key) {
  return run && typeof run === "object" ? run[key] : undefined;
}

/** fill(template, vars) — replaces every {token} with String(vars[token]), or "" when absent. */
function fill(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : ""
  );
}

/** levelLine(run) — "RACE SUB · LVL n" (race/sub upper-cased, Roman level; past V renders as its number). */
function levelLine(run) {
  const race = String(rf(run, "race") ?? "").toUpperCase();
  const sub = String(rf(run, "sub") ?? "").toUpperCase();
  const level = num(rf(run, "level"));
  const roman = ROMAN[level - 1] || level;
  return `${race} ${sub}${BOARDS_PANEL_COPY.sep}${BOARDS_PANEL_COPY.level} ${roman}`;
}

/** causeLine(run) — the death note with its first letter capitalised, "" when missing. */
function causeLine(run) {
  const note = rf(run, "note");
  if (typeof note !== "string" || note.length === 0) return "";
  return note[0].toUpperCase() + note.slice(1);
}

/** statChips(run) — the six FLOOR/DAYS/SQUARES/KILLS/EXP/WILMST chips, en-US grouping for WILMST. */
function statChips(run) {
  return [
    { k: BOARDS_PANEL_COPY.stats.floor, v: String(num(rf(run, "floor"))) },
    { k: BOARDS_PANEL_COPY.stats.days, v: String(num(rf(run, "day"))) },
    { k: BOARDS_PANEL_COPY.stats.squares, v: String(num(rf(run, "steps"))) },
    { k: BOARDS_PANEL_COPY.stats.kills, v: String(num(rf(run, "kills"))) },
    { k: BOARDS_PANEL_COPY.stats.exp, v: String(num(rf(run, "sp"))) },
    { k: BOARDS_PANEL_COPY.stats.wilmst, v: num(rf(run, "gold")).toLocaleString("en-US") },
  ];
}

/** valueText(board, run) — the value half of a ranked row (deep/days/kills/purse). */
function valueText(board, run) {
  switch (board) {
    case "deep":
    case "combo":
      return String(num(rf(run, "floor")));
    case "days":
      return String(num(rf(run, "day")));
    case "kills":
      return String(num(rf(run, "kills")));
    case "purse":
      return num(rf(run, "gold")).toLocaleString("en-US");
    default:
      return "";
  }
}

/** metricFor(board, run) — the bar's ranking metric (D-13's min-max rule). */
function metricFor(board, run) {
  switch (board) {
    case "days":
      return num(rf(run, "day"));
    case "kills":
      return num(rf(run, "kills"));
    case "purse":
      return num(rf(run, "gold"));
    case "deep":
    case "combo":
    case "yard":
    default:
      return num(rf(run, "floor"));
  }
}

// ─── runPool, cutTopTen (Task 1) ────────────────────────────────────────────

/**
 * runPool(bests, graves) — the union of bests.runs and every normalized
 * stone, deduped by hash (a legacy stone and its backfilled entry count
 * once), graves in their stored order first.
 */
export function runPool(bests, graves) {
  const seen = new Set();
  const pool = [];
  const stones = Array.isArray(graves) ? graves : [];
  for (const stone of stones) {
    const n = normalizeStone(stone);
    if (n && !seen.has(n.hash)) {
      seen.add(n.hash);
      pool.push(n);
    }
  }
  const runsMap = bests && typeof bests.runs === "object" && bests.runs ? bests.runs : {};
  for (const hash of Object.keys(runsMap)) {
    if (!seen.has(hash)) {
      seen.add(hash);
      pool.push(runsMap[hash]);
    }
  }
  return pool;
}

/**
 * cutTopTen(entries) — BOARD-05, the mock's cut() generalised: ten or fewer
 * entries come back as copies unchanged; otherwise the first ten, and when
 * none of those is `you === true` but a later entry is, a copy of the first
 * such entry is appended with `divider` set. Never mutates the input.
 */
export function cutTopTen(entries) {
  const list = Array.isArray(entries) ? entries : [];
  if (list.length <= 10) return list.map((e) => ({ ...e }));
  const head = list.slice(0, 10).map((e) => ({ ...e }));
  if (head.some((e) => e.you === true)) return head;
  const pin = list.find((e) => e.you === true);
  if (!pin) return head;
  return head.concat([{ ...pin, divider: BOARDS_PANEL_COPY.divider }]);
}

// ─── per-board row builders (module-private) ────────────────────────────────

/** barPercents(entries) — min-max bar rule: non-finite metric -> 3; equal span -> 100. */
function barPercents(entries) {
  const metrics = entries.map((e) => e.metric);
  const finiteVals = metrics.filter((v) => Number.isFinite(v));
  const max = finiteVals.length ? Math.max(...finiteVals) : 0;
  const min = finiteVals.length ? Math.min(...finiteVals) : 0;
  const span = max - min;
  return entries.map((e, i) => {
    const v = metrics[i];
    if (!Number.isFinite(v)) return { ...e, barPct: 3 };
    if (span === 0) return { ...e, barPct: 100 };
    return { ...e, barPct: Math.max(3, Math.round(((v - min) / span) * 100)) };
  });
}

/**
 * finalize(rawRows, openKey, opts) — applies cutTopTen (unless skipCut), the
 * bar rule, the avatar and `open`, and strips the internal `run`/`metric`/
 * `avatarKey` fields. The avatar is drawn from `avatarKey` when a row sets
 * one (global rows: the Play Games handle), else from the run's name.
 */
function finalize(rawRows, openKey, { skipCut = false } = {}) {
  const cutRows = skipCut ? rawRows.map((r) => ({ ...r })) : cutTopTen(rawRows);
  const withBars = barPercents(cutRows);
  return withBars.map((r) => {
    const avatarName = typeof r.avatarKey === "string" ? r.avatarKey : rf(r.run, "name") || "";
    const { run, metric, avatarKey, ...rest } = r;
    return {
      ...rest,
      avatar: { initials: initialsOf(avatarName), bg: avatarColour(avatarName) },
      open: rest.key === openKey,
    };
  });
}

/** buildRankedRows(board, bests) — one per hash in bests.boards[board], in order. */
function buildRankedRows(board, bests) {
  const hashes = bests && Array.isArray(bests.boards?.[board]) ? bests.boards[board] : [];
  return buildRunRows(
    board,
    hashes.map((hash) => ({ hash, run: (bests.runs && bests.runs[hash]) || {} }))
  );
}

/**
 * buildRunRows(board, items) — the Phase 66 ranked row, one per { hash, run }
 * in the given order, keyed by the run hash. Local LINEAGE (Phase 70, D-09)
 * feeds it a lineage's runs so its rows are exactly the ranked-board rows.
 */
function buildRunRows(board, items) {
  return items.map(({ hash, run }, i) => {
    return {
      key: hash,
      run,
      rank: String(i + 1),
      top: i === 0,
      podium: i < 3,
      you: false,
      divider: "",
      headline: rf(run, "name") || "",
      tag: "",
      name: "",
      line: levelLine(run),
      detail: `${causeLine(run)}. ${rf(run, "epitaph") || ""}`,
      val: valueText(board, run),
      unit: BOARD_COPY[board].unitLabel,
      stats: statChips(run),
      metric: metricFor(board, run),
    };
  });
}

// ─── LINEAGE selection (Phase 70: D-09..D-11) ───────────────────────────────

/** isRace(x) / isSub(x) — a content race / sub-class id. */
function isRace(x) {
  return typeof x === "string" && LINEAGE_RACES.includes(x);
}
function isSub(x) {
  return typeof x === "string" && LINEAGE_SUBS.includes(x);
}

/**
 * resolveLineage({ lineage, hero, recent }) — the selected lineage (D-11).
 * The fallback is the hero when both its race and sub are content ids, else
 * the most recent run when both are, else the first race and first sub-class
 * in content order (Human + Wizard). A `lineage` input (the panel's picker
 * selection) then wins field by field: race and sub are validated
 * independently, so an unknown id falls through to the fallback's. Pure;
 * returns a fresh { race, sub }.
 */
export function resolveLineage({ lineage, hero, recent } = {}) {
  let base = { race: LINEAGE_RACES[0], sub: LINEAGE_SUBS[0] };
  if (isRace(rf(hero, "race")) && isSub(rf(hero, "sub"))) base = { race: hero.race, sub: hero.sub };
  else if (isRace(rf(recent, "race")) && isSub(rf(recent, "sub"))) base = { race: recent.race, sub: recent.sub };
  return {
    race: isRace(rf(lineage, "race")) ? lineage.race : base.race,
    sub: isSub(rf(lineage, "sub")) ? lineage.sub : base.sub,
  };
}

/** lineageName(sel) — the "Race Sub" display name the {lineage} token takes. */
function lineageName(sel) {
  return `${sel.race} ${sel.sub}`;
}

/** buildPicker(sel) — the RACE row then the SUB-CLASS row, one chip per content id, the selection on. */
function buildPicker(sel) {
  const chips = (ids, selected) => ids.map((id) => ({ id, label: id.toUpperCase(), on: id === selected }));
  return {
    race: sel.race,
    sub: sel.sub,
    rows: [
      { kind: "race", label: BOARDS_PANEL_COPY.lineage.race, chips: chips(LINEAGE_RACES, sel.race) },
      { kind: "sub", label: BOARDS_PANEL_COPY.lineage.sub, chips: chips(LINEAGE_SUBS, sel.sub) },
    ],
  };
}

/** lineageEmpty(sel) — the local in-voice empty note naming the lineage. */
function lineageEmpty(sel) {
  return { kind: "empty", line: fill(BOARDS_PANEL_COPY.lineage.empty, { lineage: lineageName(sel) }) };
}

/**
 * buildLineageStanding(sel, runs, bests, normalizedGraves, recentHash) — the
 * local LINEAGE card: the lineage's most recent run (the recentHash run when
 * it is of this lineage, else the newest matching grave, else bests.last when
 * it matches, else the lineage's best) placed among the lineage's runs.
 * NO ENTRY when the lineage has none.
 */
function buildLineageStanding(sel, runs, bests, normalizedGraves, recentHash) {
  if (runs.length === 0) {
    return {
      label: BOARDS_PANEL_COPY.standing.noEntry,
      place: BOARDS_PANEL_COPY.standing.noPlace,
      note: BOARDS_PANEL_COPY.standing.noNote,
    };
  }
  const key = lineageKey(sel);
  const byHash = (h) => (typeof h === "string" ? runs.findIndex((r) => r.hash === h) : -1);
  let idx = byHash(recentHash);
  if (idx === -1) {
    const grave = normalizedGraves.find((g) => lineageKey(g) === key);
    if (grave) idx = byHash(grave.hash);
  }
  if (idx === -1 && bests && typeof bests.last === "string") idx = byHash(bests.last);
  if (idx === -1) idx = 0;
  const run = runs[idx];
  const placeNum = idx + 1;
  return {
    label: String(rf(run, "name") || "").toUpperCase() + BOARDS_PANEL_COPY.sep + BOARD_COPY.combo.unitLabel,
    place: ordinal(placeNum),
    note: fill(BOARDS_PANEL_COPY.standing.ofLineage, { n: runs.length }) + " " + pickQuip(placeNum, "combo", run.hash),
  };
}

/** buildGraveyardRows(graves) — every normalized stone (up to 60) in sortGraveyard order, unranked. */
function buildGraveyardRows(graves) {
  const stones = sortGraveyard(
    (Array.isArray(graves) ? graves : []).map(normalizeStone).filter(Boolean)
  );
  return stones.map((stone, i) => ({
    key: stone.hash + ":" + i,
    run: stone,
    rank: "",
    top: false,
    podium: false,
    you: false,
    divider: "",
    headline: rf(stone, "name") || "",
    tag: "",
    name: levelLine(stone),
    line: causeLine(stone),
    detail: rf(stone, "epitaph") || "",
    val: `${num(rf(stone, "floor"))}${BOARDS_PANEL_COPY.sep}${num(rf(stone, "steps"))}`,
    unit: BOARD_COPY.yard.unitLabel,
    stats: statChips(stone),
    metric: metricFor("yard", stone),
  }));
}

// ─── global views (Phase 68: D-05..D-09, D-16, D-17) ────────────────────────

const G = BOARDS_PANEL_COPY.global;
const GLOBAL_STATUSES = Object.freeze(["loading", "ready", "unreachable", "consent", "closed"]);
const UNREACHABLE = Object.freeze({ status: "unreachable", entries: Object.freeze([]), you: null, total: null });

/** isObj(v) — a non-null, non-array object. */
function isObj(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** globalRankOf(n) — an integer rank >= 1, else null (Phase 81, BOARD-10/R-16c). */
function globalRankOf(n) {
  return Number.isSafeInteger(n) && n >= 1 ? n : null;
}

/**
 * readSnapshot(global) — the snapshot guard. Anything that is not an object
 * with a known status reads as unreachable; entries count only on a ready
 * snapshot, and non-object entries are dropped; a non-object `you` is null;
 * total is a non-negative integer or null. Never mutates.
 */
function readSnapshot(global) {
  if (!isObj(global) || !GLOBAL_STATUSES.includes(global.status)) return UNREACHABLE;
  const ready = global.status === "ready";
  const count = (v) => (Number.isInteger(v) && v >= 0 ? v : null);
  return {
    status: global.status,
    entries: ready && Array.isArray(global.entries) ? global.entries.filter(isObj) : [],
    you: ready && isObj(global.you) ? global.you : null,
    total: count(global.total),
  };
}

/** globalCause(run) — CAUSE_TEXT with {foe} as the generic foe, first letter capitalised; "" for an unknown cause. */
function globalCause(run) {
  const cause = rf(run, "cause");
  if (typeof cause !== "string" || !Object.prototype.hasOwnProperty.call(CAUSE_TEXT, cause)) return "";
  const text = fill(CAUSE_TEXT[cause], { foe: G.foe });
  return text ? text[0].toUpperCase() + text.slice(1) : "";
}

/** globalHandle(entry) — the trimmed Play Games handle, or the nameless-delver line. */
function globalHandle(entry) {
  const h = typeof entry.handle === "string" ? entry.handle.trim() : "";
  return h || G.anon;
}

/** entryRun(entry) — the decoded tag, or null when the tag did not decode. */
function entryRun(entry) {
  return isObj(entry.run) ? entry.run : null;
}

/** globalTag(entry) — "YOU", "FRIEND" or "". */
function globalTag(entry) {
  if (entry.you === true) return G.you;
  if (entry.friend === true) return G.friend;
  return "";
}

/**
 * fallbackCell(board, rawScore) — the minimal row's value (D-16) recovered
 * from the raw score by scoreFallback: DEEPEST the floor, LONGEST the days,
 * BUTCHERY the kills, PURSE the grouped gold. A raw score scoreFallback
 * rejects shows the dash.
 */
function fallbackCell(board, rawScore) {
  const unit = BOARD_COPY[board].unitLabel;
  const fb = scoreFallback(board, rawScore);
  if (!fb) return { val: BOARDS_PANEL_COPY.standing.noPlace, unit, metric: Number.NEGATIVE_INFINITY };
  switch (board) {
    case "deep":
      return { val: String(fb.floor), unit, metric: fb.floor };
    case "days":
      return { val: String(fb.day), unit, metric: fb.day };
    case "kills":
      return { val: String(fb.kills), unit, metric: fb.kills };
    case "purse":
      return { val: fb.gold.toLocaleString("en-US"), unit, metric: fb.gold };
    default:
      return { val: BOARDS_PANEL_COPY.standing.noPlace, unit, metric: Number.NEGATIVE_INFINITY };
  }
}

/**
 * globalRow(board, entry, index) — one ranked global row. `index` is the
 * list position (the rank shown when Play Games reported none); null marks
 * the pinned YOU row under the divider. The avatar is the handle's initials
 * (never a remote image); the detail is the cause line only (no epitaph,
 * 67 D-18); a run-null entry is the minimal row.
 */
function globalRow(board, entry, index) {
  const pinned = index === null;
  const run = entryRun(entry);
  const handle = globalHandle(entry);
  let rank = "";
  if (Number.isInteger(entry.rank) && entry.rank > 0) rank = String(entry.rank);
  else if (!pinned) rank = String(index + 1);
  const base = {
    key: typeof entry.key === "string" && entry.key ? entry.key : pinned ? "g:you" : `g:${index}`,
    run,
    avatarKey: handle,
    rank,
    top: !pinned && index === 0,
    podium: !pinned && index < 3,
    you: pinned || entry.you === true,
    divider: pinned ? BOARDS_PANEL_COPY.divider : "",
    headline: handle,
    tag: pinned ? G.you : globalTag(entry),
  };
  if (run) {
    return {
      ...base,
      name: String(rf(run, "name") ?? ""),
      line: levelLine(run),
      detail: globalCause(run),
      val: valueText(board, run),
      unit: BOARD_COPY[board].unitLabel,
      stats: statChips(run),
      metric: metricFor(board, run),
    };
  }
  const cell = fallbackCell(board, entry.rawScore);
  return { ...base, name: "", line: "", detail: "", val: cell.val, unit: cell.unit, stats: [], metric: cell.metric };
}

/**
 * buildGlobalRows(board, snap, openKey) — the snapshot's entries in the
 * order Play Games returned them (never re-sorted), plus the player's own
 * best pinned last under the divider (D-05).
 *
 * Phase 81 (BOARD-10, R-10): the pin appears only when ALL of — the board
 * has at least one listed row; no listed row is already YOU; the own
 * record's rank is a genuine integer rank (a `null` rank — Play Games
 * withholding the player from the public list, R-16c — is never pinned as
 * though it were merely off-list, see buildGlobalStanding's hidden-score
 * note instead); and that rank is strictly greater than every listed row's
 * integer rank (or the listed count, when none carries one).
 */
function buildGlobalRows(board, snap, openKey) {
  const rows = snap.entries.map((e, i) => globalRow(board, e, i));
  const alreadyListed = snap.entries.some((e) => e.you === true);
  const youRank = snap.you ? globalRankOf(snap.you.rank) : null;
  if (rows.length > 0 && snap.you && !alreadyListed && youRank !== null) {
    const listedRanks = snap.entries.map((e) => globalRankOf(e.rank)).filter((r) => r !== null);
    const threshold = listedRanks.length > 0 ? Math.max(...listedRanks) : snap.entries.length;
    if (youRank > threshold) rows.push(globalRow(board, snap.you, null));
  }
  return finalize(rows, openKey, { skipCut: true });
}

/** globalQuip(place, board) — GLOBAL_STANDING_LINES by band (1 / top 10 / top 100 / the rest), picked from the place and the board index. */
function globalQuip(place, board) {
  const bank =
    place === 1
      ? GLOBAL_STANDING_LINES.first
      : place <= 10
        ? GLOBAL_STANDING_LINES.ten
        : place <= 100
          ? GLOBAL_STANDING_LINES.hundred
          : GLOBAL_STANDING_LINES.rest;
  const boardIdx = BOARD_IDS.indexOf(board);
  return bank[(place + (boardIdx === -1 ? 0 : boardIdx)) % bank.length];
}

/** noGlobalEntry() — the standing card when the player has nothing on this board. */
function noGlobalEntry() {
  return { label: BOARDS_PANEL_COPY.standing.noEntry, place: BOARDS_PANEL_COPY.standing.noPlace, note: G.noEntry };
}

/**
 * buildGlobalStanding(board, scope, snap) — D-05's real-rank card: the
 * player's own score (snap.you, else the listed entry marked you), its
 * reported rank (the list position when missing) out of the board's total
 * (the entry count when unknown), plus a banded quip. NO ENTRY when absent.
 * LINEAGE never reaches this function (Phase 81, BOARD-13: ME-only).
 *
 * Phase 81 (BOARD-10, R-16c): when the player's own record exists, is not
 * one of the listed rows and carries no rank at all (Play Games withheld it
 * from the public list — a different situation from a genuinely ranked but
 * off-list record), the card reads the honest hidden-score note instead of
 * an ordinary "of N interred" line.
 */
function buildGlobalStanding(board, scope, snap) {
  const listed = snap.entries.findIndex((e) => e.you === true);
  const you = snap.you || (listed !== -1 ? snap.entries[listed] : null);
  if (!you) return noGlobalEntry();
  const run = entryRun(you);
  const who = String(rf(run, "name") || globalHandle(you)).toUpperCase();
  const label = who + BOARDS_PANEL_COPY.sep + BOARD_COPY[board].unitLabel;

  if (snap.you && listed === -1 && globalRankOf(snap.you.rank) === null) {
    return { label, place: BOARDS_PANEL_COPY.standing.noPlace, note: G.hiddenYou };
  }

  let place = null;
  if (Number.isInteger(you.rank) && you.rank > 0) place = you.rank;
  else if (listed !== -1) place = listed + 1;
  const total = Math.max(snap.total !== null ? snap.total : snap.entries.length, place || 0);
  const ofLine = fill(scope === "friends" ? G.ofFriends : G.ofWorld, { n: total.toLocaleString("en-US") });
  if (place === null) return { label, place: BOARDS_PANEL_COPY.standing.noPlace, note: ofLine };
  return { label, place: ordinal(place), note: ofLine + " " + globalQuip(place, board) };
}

/**
 * buildGlobalView(board, scope, global, openKey) — the signed-in ALL /
 * FRIENDS body, standing card and footnote from the snapshot's status
 * (D-06, D-07): loading / unreachable / closed are in-panel notes with no
 * card, consent is the note plus the SHOW MY FRIENDS action, ready is the
 * rows (or the empty note) with the real-rank card. Nothing blocks and
 * nothing is a modal or a rail card.
 *
 * Phase 81 (BOARD-13): LINEAGE is ME-only and never reaches this function —
 * a ME-only board with a non-local scope resolves to DEEPEST before
 * boardsView() ever calls this.
 */
function buildGlobalView(board, scope, global, openKey) {
  const snap = readSnapshot(global);
  const note = (line) => ({ body: { kind: "note", line }, standing: null, footnote: BOARD_FOOTNOTES.ranked });
  switch (snap.status) {
    case "loading":
      return note(G.loading);
    case "closed":
      return note(G.closed);
    case "consent":
      return {
        body: { kind: "consent", line: G.consent, action: { id: "friendsConsent", label: G.consentButton } },
        standing: null,
        footnote: BOARD_FOOTNOTES.ranked,
      };
    case "ready": {
      const empty = { kind: "empty", line: G.empty };
      const rows = buildGlobalRows(board, snap, openKey);
      return {
        body: rows.length ? { kind: "rows", rows } : empty,
        standing: buildGlobalStanding(board, scope, snap),
        footnote: BOARD_FOOTNOTES.ranked,
      };
    }
    default:
      return note(G.unreachable);
  }
}

// ─── header/strip/rail/board/footnote/dock builders (Task 2) ───────────────

function computeInterred(total, stoneCount) {
  if (Number.isInteger(total) && total >= 0) return Math.max(total, stoneCount);
  return stoneCount;
}

/** seasonLabel(n) — "SEASON n". */
function seasonLabel(n) {
  return fill(G.season, { n });
}

/**
 * buildHeader(entry, boardId, interredCount, ctx) — the title, scope line
 * (the global scope lines while signed in on ALL / FRIENDS), interred count,
 * back affordance and the D-08 season block: the SEASON label on every view,
 * and a picker only with two or more seasons, signed in, on a global scope,
 * off GRAVEYARD.
 */
function buildHeader(entry, boardId, interredCount, { signedIn, scope, season, seasons }) {
  const globalScope = boardId !== "yard" && signedIn && scope !== "local";
  let scopeLine = boardId === "yard" ? BOARDS_PANEL_COPY.scope.yard : BOARDS_PANEL_COPY.scope.ranked;
  if (globalScope) scopeLine = scope === "friends" ? G.scope.friends : G.scope.all;
  const picker =
    globalScope && seasons.length >= 2 ? seasons.map((n) => ({ n, label: seasonLabel(n), on: n === season })) : null;
  return {
    title: BOARDS_PANEL_COPY.head.title,
    scopeLine,
    interred: interredCount,
    interredLabel: BOARDS_PANEL_COPY.head.interred,
    back: entry === "title",
    backLabel: BOARDS_PANEL_COPY.head.back,
    season: { label: seasonLabel(season), picker },
  };
}

/** isSeason(n) — a positive integer. */
function isSeason(n) {
  return Number.isInteger(n) && n > 0;
}

/** readSeasons(raw, season) — the positive-integer seasons, deduped and ascending; [season] when none. */
function readSeasons(raw, season) {
  const list = Array.isArray(raw) ? [...new Set(raw.filter(isSeason))].sort((a, b) => a - b) : [];
  return list.length ? list : [season];
}

/** playerName(player) — the trimmed display name, or strip.live.unnamed when there is none. */
function playerName(player) {
  const raw = player && typeof player === "object" ? player.displayName : null;
  const name = typeof raw === "string" ? raw.trim() : "";
  return name || BOARDS_PANEL_COPY.strip.live.unnamed;
}

function buildStrip(boardId, scope, signedIn, player) {
  const dim = signedIn !== true;
  let head;
  if (signedIn === true) {
    // Phase 67 (D-08): the live strip — the display name, its initials avatar
    // (the mock's AVATAR, drawn with the gold on-ring) and PLAY GAMES · SIGNED IN.
    const name = playerName(player);
    head = {
      glyph: "",
      avatar: { initials: initialsOf(name), bg: avatarColour(name) },
      label: name,
      source: BOARDS_PANEL_COPY.strip.live.source,
    };
  } else {
    head = {
      glyph: BOARDS_PANEL_COPY.strip.glyph,
      avatar: null,
      label: BOARDS_PANEL_COPY.strip.label,
      source: BOARDS_PANEL_COPY.strip.source,
    };
  }
  return {
    ...head,
    // Phase 81 (BOARD-12): three scope chips, ME | ALL | FRIENDS, on every
    // board (GRAVEYARD included). ME is never dimmed; ALL/FRIENDS dim while
    // signed out or Compete OFF.
    scopes: [
      { id: "local", label: BOARDS_PANEL_COPY.chips.me, on: scope === "local", dim: false },
      { id: "all", label: BOARDS_PANEL_COPY.chips.all, on: scope === "all", dim },
      { id: "friends", label: BOARDS_PANEL_COPY.chips.friends, on: scope === "friends", dim },
    ],
  };
}

/**
 * buildRail(boardId, scope) — BOARD_IDS in rail order, minus the ME-only
 * boards (LINEAGE, GRAVEYARD) unless the scope is local (Phase 81,
 * BOARD-13/BOARD-14).
 */
function buildRail(boardId, scope) {
  const ids = scope === "local" ? BOARD_IDS : BOARD_IDS.filter((id) => !ME_ONLY_BOARDS.includes(id));
  return ids.map((id) => ({ id, tab: BOARD_COPY[id].tab, on: id === boardId, col: BOARD_COPY[id].col }));
}

function buildBoardHead(boardId) {
  const c = BOARD_COPY[boardId];
  return { id: boardId, mark: c.mark, col: c.col, title: c.title, rule: c.rule };
}

function buildFootnote(boardId) {
  return boardId === "yard" ? BOARD_FOOTNOTES.yard : BOARD_FOOTNOTES.ranked;
}

function buildDock(entry, hasHero) {
  if (entry !== "title") return null;
  if (hasHero) return [{ id: "dungeon", label: BOARDS_PANEL_COPY.dock.dungeon, primary: true }];
  return [
    { id: "title", label: BOARDS_PANEL_COPY.dock.title, primary: false },
    { id: "roll", label: BOARDS_PANEL_COPY.dock.roll, primary: true },
  ];
}

// ─── standing card (D-07) ───────────────────────────────────────────────────

/** pickQuip(placeNum, board, hash) — deterministic bank pick from the run's hash and the board. */
function pickQuip(placeNum, board, hash) {
  const bank = placeNum === 1 ? STANDING_LINES.first : placeNum <= 10 ? STANDING_LINES.ten : STANDING_LINES.rest;
  const boardIdx = BOARD_IDS.indexOf(board);
  const validHash = typeof hash === "string" && HASH_RE.test(hash);
  const base = validHash ? parseInt(hash, 16) >>> 0 : 0;
  const idx = (base + (boardIdx === -1 ? 0 : boardIdx)) % bank.length;
  return bank[idx];
}

function findRecentRun(pool, bests, normalizedGraves, recentHash) {
  if (typeof recentHash === "string") {
    const found = pool.find((r) => r.hash === recentHash);
    if (found) return found;
  }
  if (normalizedGraves.length > 0) return normalizedGraves[0];
  if (bests && bests.last && bests.runs && bests.runs[bests.last]) return bests.runs[bests.last];
  return null;
}

function findDeepestForYard(bests, normalizedGraves) {
  const deepHash = bests && Array.isArray(bests.boards?.deep) ? bests.boards.deep[0] : null;
  if (deepHash && bests.runs && bests.runs[deepHash]) return bests.runs[deepHash];
  const sorted = sortGraveyard(normalizedGraves);
  return sorted[0] || null;
}

function buildStanding({ board, bests, pool, recentHash, interredCount, normalizedGraves }) {
  if (pool.length === 0) {
    return {
      label: BOARDS_PANEL_COPY.standing.noEntry,
      place: BOARDS_PANEL_COPY.standing.noPlace,
      note: BOARDS_PANEL_COPY.standing.noNote,
    };
  }

  if (board === "yard") {
    const deepest = findDeepestForYard(bests, normalizedGraves);
    return {
      label: BOARDS_PANEL_COPY.standing.interred,
      place: String(interredCount),
      note: deepest
        ? fill(BOARDS_PANEL_COPY.standing.yardNote, { name: rf(deepest, "name") || "", floor: num(rf(deepest, "floor")) })
        : BOARDS_PANEL_COPY.standing.noNote,
    };
  }

  const recent = findRecentRun(pool, bests, normalizedGraves, recentHash);
  if (!recent) {
    return {
      label: BOARDS_PANEL_COPY.standing.noEntry,
      place: BOARDS_PANEL_COPY.standing.noPlace,
      note: BOARDS_PANEL_COPY.standing.noNote,
    };
  }

  const better = pool.filter((r) => compareRuns(board, r, recent) < 0).length;
  const placeNum = better + 1;
  const label = String(rf(recent, "name") || "").toUpperCase() + BOARDS_PANEL_COPY.sep + BOARD_COPY[board].unitLabel;
  const note = fill(BOARDS_PANEL_COPY.standing.ofYours, { n: pool.length }) + " " + pickQuip(placeNum, board, recent.hash);
  return { label, place: ordinal(placeNum), note };
}

// ─── boardsView (Task 2) ────────────────────────────────────────────────────

const SCOPES = ["local", "all", "friends"];

/**
 * boardsView(input) — the D-15 seam: a pure, deterministic function of
 * { bests, graves, total, board, scope, open, entry, hasHero, signedIn,
 * player, recentHash } producing the whole Leaderboards panel's content. No
 * DOM, no storage, no clock, no randomness, no input mutation. See
 * 66-03-PLAN.md's `<interfaces>` block for the exact view shape this returns.
 * Phase 67 (D-08) supplies signedIn and player ({ id, displayName } or null)
 * at this seam: signed in, the strip carries the display name, its avatar
 * and PLAY GAMES · SIGNED IN. Phase 68 adds `global` (a GlobalSnapshot or
 * null; signed in on ALL / FRIENDS it drives the body, the standing card —
 * null while not ready — and the footnote), `season` (default 1) and
 * `seasons` (default [season]) for header.season { label, picker }, and the
 * body kind "consent" { line, action: { id: "friendsConsent", label } }.
 * Phase 70 (D-09..D-11) adds `lineage` ({ race?, sub? } or null — the
 * panel's picker selection) and `hero` ({ race, sub } or null — the active
 * hero, already gated by the controller), and the output `picker`: null off
 * LINEAGE; on LINEAGE { race, sub, rows: [race row, sub row] }, each row
 * { kind, label, chips: [{ id, label, on }] }. LINEAGE's body, standing and
 * footnote are for that one race + sub-class (Phase 81, BOARD-13: local
 * only — LINEAGE is ME-only and never reads `global`).
 */
export function boardsView(input = {}) {
  const raw = input && typeof input === "object" ? input : {};

  const bests = sanitizeBests(raw.bests);
  const rawGraves = Array.isArray(raw.graves) ? raw.graves : [];
  const entry = raw.entry === "title" ? "title" : "tab";
  const hasHero = raw.hasHero === true;
  const signedIn = raw.signedIn === true;
  // Phase 81 (BOARD-11/BOARD-12): an explicit local/all/friends scope wins;
  // otherwise the default follows sign-in — ALL when signed in, ME (local)
  // when signed out.
  const scope = SCOPES.includes(raw.scope) ? raw.scope : signedIn ? "all" : "local";
  // Phase 81 (BOARD-13/BOARD-14): a ME-only board (LINEAGE, GRAVEYARD)
  // requested with a non-local scope falls back to DEEPEST.
  const board =
    BOARD_IDS.includes(raw.board) && !(ME_ONLY_BOARDS.includes(raw.board) && scope !== "local") ? raw.board : "deep";
  // A player only counts while signedIn is exactly true; anything that is not
  // an object is treated as no player (playerName falls back to the unnamed line).
  const player = signedIn && raw.player && typeof raw.player === "object" ? raw.player : null;
  const openKey = raw.open ?? null;

  const normalizedGraves = rawGraves.map(normalizeStone).filter(Boolean);
  const interredCount = computeInterred(raw.total, normalizedGraves.length);
  const pool = runPool(bests, rawGraves);

  const season = isSeason(raw.season) ? raw.season : 1;
  const seasons = readSeasons(raw.seasons, season);

  // Phase 70 (D-11): LINEAGE's selection — the picker, else the live hero,
  // else the most recent run, else the first race and sub-class in content order.
  const sel =
    board === "combo"
      ? resolveLineage({
          lineage: raw.lineage,
          hero: raw.hero,
          recent: findRecentRun(pool, bests, normalizedGraves, raw.recentHash),
        })
      : null;
  const lineagePool = sel ? lineageRuns(pool, lineageKey(sel)) : [];

  // Body selection (D-07, D-17): GRAVEYARD → the local stones; the local
  // scope → the local rows; signed out (or Compete OFF) on ALL / FRIENDS →
  // the Phase 66 note, asking nothing of the world; signed in → the global
  // snapshot's view.
  let body;
  let globalView = null;
  if (board === "yard") {
    const rows = finalize(buildGraveyardRows(rawGraves), openKey, { skipCut: true });
    body = rows.length ? { kind: "rows", rows } : { kind: "empty", line: BOARDS_PANEL_COPY.empty };
  } else if (scope === "local" && board === "combo") {
    const rows = finalize(
      buildRunRows("combo", lineagePool.map((run) => ({ hash: run.hash, run }))),
      openKey,
      {}
    );
    body = rows.length ? { kind: "rows", rows } : lineageEmpty(sel);
  } else if (scope === "local") {
    const rows = finalize(buildRankedRows(board, bests), openKey, {});
    body = rows.length ? { kind: "rows", rows } : { kind: "empty", line: BOARDS_PANEL_COPY.empty };
  } else if (!signedIn) {
    body = { kind: "note", line: scope === "all" ? BOARDS_PANEL_COPY.note.all : BOARDS_PANEL_COPY.note.friends };
  } else {
    globalView = buildGlobalView(board, scope, raw.global, openKey);
    body = globalView.body;
  }

  let standing;
  if (globalView) standing = globalView.standing;
  else if (board === "combo") standing = buildLineageStanding(sel, lineagePool, bests, normalizedGraves, raw.recentHash);
  else
    standing = buildStanding({
      board,
      bests,
      pool,
      recentHash: raw.recentHash,
      interredCount,
      normalizedGraves,
    });

  return {
    header: buildHeader(entry, board, interredCount, { signedIn, scope, season, seasons }),
    strip: buildStrip(board, scope, signedIn, player),
    rail: buildRail(board, scope),
    board: buildBoardHead(board),
    picker: sel ? buildPicker(sel) : null,
    body,
    standing,
    footnote: globalView ? globalView.footnote : buildFootnote(board),
    dock: buildDock(entry, hasHero),
  };
}
