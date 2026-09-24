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
// sampled, stale), consumed here as plain data — this module never imports
// or calls the controller. Global rows decode their values from the score
// tag (D-16), falling back to scoreFallback on the raw score when a tag does
// not decode, and never carry an epitaph (67 D-18). `season`/`seasons` add
// the SEASON label and the older-season picker (D-08). Signed out (which is
// also Compete OFF) every view is the local Phase 66 view; GRAVEYARD is local
// in every state (D-17).

import {
  compareRuns,
  leanRate,
  normalizeStone,
  sortGraveyard,
  sanitizeBests,
  lineageKey,
  BOARD_IDS,
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
import { scoreFallback } from "./boardScores.js";

const HASH_RE = /^[0-9a-f]{8}$/;

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

/** valueText(board, run) — the value half of a ranked row (deep/lean/days/kills/purse). */
function valueText(board, run) {
  switch (board) {
    case "deep":
      return String(num(rf(run, "floor")));
    case "lean":
      return `${num(rf(run, "floor"))}${BOARDS_PANEL_COPY.sep}${num(rf(run, "steps"))}`;
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
    case "lean": {
      const rate = leanRate(run);
      return Number.isFinite(rate) ? -rate : Number.NEGATIVE_INFINITY;
    }
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
  return hashes.map((hash, i) => {
    const run = (bests.runs && bests.runs[hash]) || {};
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

/** buildLineageRows(bests) — one per lineage entry whose best run exists, sorted per D-13's LINEAGE order. */
function buildLineageRows(bests) {
  const lineage = bests && typeof bests.lineage === "object" && bests.lineage ? bests.lineage : {};
  const runsMap = bests && typeof bests.runs === "object" && bests.runs ? bests.runs : {};
  const items = [];
  for (const key of Object.keys(lineage)) {
    const entry = lineage[key];
    const best = entry && typeof entry.best === "string" ? entry.best : null;
    const run = best ? runsMap[best] : null;
    if (!run) continue;
    items.push({ key, count: num(entry.count) || entry.count || 0, run });
  }
  items.sort((a, b) => compareRuns("combo", a.run, b.run) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return items.map((item, i) => {
    const count = item.count;
    const lineTemplate = count === 1 ? BOARDS_PANEL_COPY.lineage.one : BOARDS_PANEL_COPY.lineage.many;
    return {
      key: "combo:" + item.key,
      run: item.run,
      rank: String(i + 1),
      top: i === 0,
      podium: i < 3,
      you: false,
      divider: "",
      headline: rf(item.run, "name") || "",
      tag: "",
      name: item.key.toUpperCase(),
      line: fill(lineTemplate, { n: count }),
      detail: fill(BOARDS_PANEL_COPY.lineage.detail, {
        n: count,
        name: rf(item.run, "name") || "",
        floor: num(rf(item.run, "floor")),
        steps: num(rf(item.run, "steps")),
        epitaph: rf(item.run, "epitaph") || "",
      }),
      val: String(num(rf(item.run, "floor"))),
      unit: BOARD_COPY.combo.unitLabel,
      stats: statChips(item.run),
      metric: metricFor("combo", item.run),
    };
  });
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
const UNREACHABLE = Object.freeze({ status: "unreachable", entries: Object.freeze([]), you: null, total: null, sampled: null });

/** isObj(v) — a non-null, non-array object. */
function isObj(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/**
 * readSnapshot(global) — the snapshot guard. Anything that is not an object
 * with a known status reads as unreachable; entries count only on a ready
 * snapshot, and non-object entries are dropped; a non-object `you` is null;
 * total and sampled are non-negative integers or null. Never mutates.
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
    sampled: count(global.sampled),
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
 * BUTCHERY the kills, PURSE the grouped gold, LEANEST the squares-per-floor
 * rate to one decimal. A raw score scoreFallback rejects shows the dash.
 */
function fallbackCell(board, rawScore) {
  const unit = BOARD_COPY[board].unitLabel;
  const fb = scoreFallback(board, rawScore);
  if (!fb) return { val: BOARDS_PANEL_COPY.standing.noPlace, unit, metric: Number.NEGATIVE_INFINITY };
  switch (board) {
    case "deep":
      return { val: String(fb.floor), unit, metric: fb.floor };
    case "lean":
      return { val: fb.rate.toFixed(1), unit: G.leanRateUnit, metric: -fb.rate };
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
 * best pinned last under the divider when no listed entry is theirs (D-05).
 */
function buildGlobalRows(board, snap, openKey) {
  const rows = snap.entries.map((e, i) => globalRow(board, e, i));
  if (rows.length > 0 && snap.you && !snap.entries.some((e) => e.you === true)) {
    rows.push(globalRow(board, snap.you, null));
  }
  return finalize(rows, openKey, { skipCut: true });
}

/**
 * lineageGroups(entries) — D-09 / 67 D-19: the DEEPEST sample grouped by
 * "race cls", keeping the first (best-ranked) entry per combination in
 * sample order; entries without a decoded race and class are skipped.
 */
function lineageGroups(entries) {
  const seen = new Set();
  const groups = [];
  for (const entry of entries) {
    const run = entryRun(entry);
    const race = typeof rf(run, "race") === "string" ? run.race : "";
    const cls = typeof rf(run, "cls") === "string" ? run.cls : "";
    if (!race || !cls) continue;
    const key = `${race} ${cls}`;
    if (seen.has(key)) continue;
    seen.add(key);
    groups.push({ key, entry, run });
  }
  return groups;
}

/** buildGlobalLineageRows(groups, openKey) — one row per race-and-class group, in sample order. */
function buildGlobalLineageRows(groups, openKey) {
  const rows = groups.map((g, i) => {
    const handle = globalHandle(g.entry);
    return {
      key: "combo:" + g.key,
      run: g.run,
      avatarKey: handle,
      rank: String(i + 1),
      top: i === 0,
      podium: i < 3,
      you: g.entry.you === true,
      divider: "",
      headline: handle,
      tag: globalTag(g.entry),
      name: g.key.toUpperCase(),
      line: levelLine(g.run),
      detail: globalCause(g.run),
      val: String(num(rf(g.run, "floor"))),
      unit: BOARD_COPY.combo.unitLabel,
      stats: statChips(g.run),
      metric: metricFor("combo", g.run),
    };
  });
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
 * buildGlobalStanding(board, scope, snap, groups) — D-05's real-rank card:
 * the player's own score (snap.you, else the listed entry marked you), its
 * reported rank (the list position when missing) out of the board's total
 * (the entry count when unknown), plus a banded quip. LINEAGE places the
 * player's combination among the sample's groups. NO ENTRY when absent.
 */
function buildGlobalStanding(board, scope, snap, groups) {
  const listed = snap.entries.findIndex((e) => e.you === true);
  const you = snap.you || (listed !== -1 ? snap.entries[listed] : null);
  if (!you) return noGlobalEntry();
  const run = entryRun(you);

  if (board === "combo") {
    const race = typeof rf(run, "race") === "string" ? run.race : "";
    const cls = typeof rf(run, "cls") === "string" ? run.cls : "";
    const key = race && cls ? `${race} ${cls}` : "";
    const idx = key ? groups.findIndex((g) => g.key === key) : -1;
    if (idx === -1) return noGlobalEntry();
    const place = idx + 1;
    return {
      label: key.toUpperCase() + BOARDS_PANEL_COPY.sep + BOARD_COPY.combo.unitLabel,
      place: ordinal(place),
      note: fill(G.ofSampled, { n: groups.length }) + " " + globalQuip(place, "combo"),
    };
  }

  let place = null;
  if (Number.isInteger(you.rank) && you.rank > 0) place = you.rank;
  else if (listed !== -1) place = listed + 1;
  const who = String(rf(run, "name") || globalHandle(you)).toUpperCase();
  const label = who + BOARDS_PANEL_COPY.sep + BOARD_COPY[board].unitLabel;
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
      if (board === "combo") {
        const groups = lineageGroups(snap.entries);
        const rows = buildGlobalLineageRows(groups, openKey);
        return {
          body: rows.length ? { kind: "rows", rows } : empty,
          standing: buildGlobalStanding("combo", scope, snap, groups),
          footnote: fill(G.sampledFoot, { n: snap.sampled !== null ? snap.sampled : snap.entries.length }),
        };
      }
      const rows = buildGlobalRows(board, snap, openKey);
      return {
        body: rows.length ? { kind: "rows", rows } : empty,
        standing: buildGlobalStanding(board, scope, snap, []),
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
  if (boardId === "yard") return null;
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
    scopes: [
      { id: "all", label: BOARDS_PANEL_COPY.chips.all, on: scope === "all", dim },
      { id: "friends", label: BOARDS_PANEL_COPY.chips.friends, on: scope === "friends", dim },
    ],
  };
}

function buildRail(boardId) {
  return BOARD_IDS.map((id) => ({ id, tab: BOARD_COPY[id].tab, on: id === boardId, col: BOARD_COPY[id].col }));
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

  if (board === "combo") {
    const uncut = buildLineageRows(bests);
    const key = lineageKey(recent);
    const idx = uncut.findIndex((row) => row.key === "combo:" + key);
    const placeNum = idx === -1 ? uncut.length + 1 : idx + 1;
    const label = key.toUpperCase() + BOARDS_PANEL_COPY.sep + BOARD_COPY.combo.unitLabel;
    const note = fill(BOARDS_PANEL_COPY.standing.ofCombos, { n: uncut.length }) + " " + pickQuip(placeNum, "combo", recent.hash);
    return { label, place: ordinal(placeNum), note };
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
 */
export function boardsView(input = {}) {
  const raw = input && typeof input === "object" ? input : {};

  const bests = sanitizeBests(raw.bests);
  const rawGraves = Array.isArray(raw.graves) ? raw.graves : [];
  const board = BOARD_IDS.includes(raw.board) ? raw.board : "deep";
  const scope = SCOPES.includes(raw.scope) ? raw.scope : "local";
  const entry = raw.entry === "title" ? "title" : "tab";
  const hasHero = raw.hasHero === true;
  const signedIn = raw.signedIn === true;
  // A player only counts while signedIn is exactly true; anything that is not
  // an object is treated as no player (playerName falls back to the unnamed line).
  const player = signedIn && raw.player && typeof raw.player === "object" ? raw.player : null;
  const openKey = raw.open ?? null;

  const normalizedGraves = rawGraves.map(normalizeStone).filter(Boolean);
  const interredCount = computeInterred(raw.total, normalizedGraves.length);
  const pool = runPool(bests, rawGraves);

  const season = isSeason(raw.season) ? raw.season : 1;
  const seasons = readSeasons(raw.seasons, season);

  // Body selection (D-07, D-17): GRAVEYARD → the local stones; the local
  // scope → the local rows; signed out (or Compete OFF) on ALL / FRIENDS →
  // the Phase 66 note, asking nothing of the world; signed in → the global
  // snapshot's view.
  let body;
  let globalView = null;
  if (board === "yard") {
    const rows = finalize(buildGraveyardRows(rawGraves), openKey, { skipCut: true });
    body = rows.length ? { kind: "rows", rows } : { kind: "empty", line: BOARDS_PANEL_COPY.empty };
  } else if (scope === "local") {
    const rows =
      board === "combo"
        ? finalize(buildLineageRows(bests), openKey, {})
        : finalize(buildRankedRows(board, bests), openKey, {});
    body = rows.length ? { kind: "rows", rows } : { kind: "empty", line: BOARDS_PANEL_COPY.empty };
  } else if (!signedIn) {
    body = { kind: "note", line: scope === "all" ? BOARDS_PANEL_COPY.note.all : BOARDS_PANEL_COPY.note.friends };
  } else {
    globalView = buildGlobalView(board, scope, raw.global, openKey);
    body = globalView.body;
  }

  const standing = globalView
    ? globalView.standing
    : buildStanding({
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
    rail: buildRail(board),
    board: buildBoardHead(board),
    body,
    standing,
    footnote: globalView ? globalView.footnote : buildFootnote(board),
    dock: buildDock(entry, hasHero),
  };
}
