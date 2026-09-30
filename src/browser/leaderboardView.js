// src/browser/leaderboardView.js
//
// Phase 84 (BOARD-18..25, BOARD-27), Plan 05. The Leaderboards panel v3's
// pure view model: one function, leaderboardView(input), turns the local
// per-run history (84-03's runHistory.js), a BoardSnapshot (84-04's
// boardFeed.js) and the panel's own picker/sheet state into everything the
// renderer (84-06) draws, for both views — LEADERBOARD (board mode, Compete
// ON) and YOUR DEAD (mine mode; Compete OFF always forces mine mode). No
// DOM, storage, clock or randomness anywhere in this module — `now` and
// `tzOffsetMinutes` are supplied inputs, never read from the system clock.
// Every word of copy comes from content/boards.js#LEADERBOARD_COPY and
// content/season.js#SEASON_NAMES; this module holds no player-facing
// literal of its own. No network, and it imports nothing from the retired
// v2.0 leaderboard modules — those retired in 84-09 and were deleted
// outright in Phase 85 (RETIRE-02).
//
// Mock-to-canon mapping (design/Mazeworld Boards Panel v3.dc.html is the
// UX/visual spec only): the mock's toy races/classes map to the 6 canon
// races (content/races.js) and 3 classes x 8 sub-classes = 24
// (content/classes.js, class order); squares -> steps, WILMST -> gold,
// EXP -> sp, level -> ROMAN (content/misc-tables.js; a level past V renders
// as its plain number, since ROMAN only names I..V).
//
// Ranking (CONTEXT area 4, "one shared rank-key function"): both views rank
// by src/browser/runDoc.js#rankKeyOf(stat, run), which already applies the
// capped-DAYS anti-farming rule (daysKeyOf). Counts, and dimmed zero-count
// sheet options, appear on YOUR DEAD only, computed locally from the
// history array — LEADERBOARD's RACE/SUB-CLASS sheets carry no counts
// (CONTEXT area 2, "No per-option counts on LEADERBOARD").
//
// Avatar initials: YOUR DEAD rows (hero names) use the ported mock rule
// (initialsOf); LEADERBOARD rows (handles) use handleInitials, which splits
// the handle against content/handles.js's HANDLE_FIRST/HANDLE_SECOND tables
// (one initial per handle word), falling back to the first two letters when
// a handle does not split.
//
// Phase 87 (BOARD-29): every row also carries `who` (the expanded detail's
// plain-text "Dwarven · Wizard (Magic User)"), `race` / `sub` (a known
// content id or null — never untrusted text) and `filterLabel` (the FILTER
// LIKE THIS button's label, "" when the row has nothing to filter by). The
// "row" sheet is the long-press menu: input.sheet "row" plus input.menu
// { race, sub } builds FILTER BY race / sub-class / both and CANCEL from the
// validated values only.

import { LEADERBOARD_COPY } from "../../content/boards.js";
import { SEASON, SEASON_NAMES } from "../../content/season.js";
import { RACES } from "../../content/races.js";
import { CLASSES } from "../../content/classes.js";
import { ROMAN } from "../../content/misc-tables.js";
import { CAUSE_TEXT } from "../../content/epitaphs.js";
import { HANDLE_FIRST, HANDLE_SECOND } from "../../content/handles.js";
import { rankKeyOf, BOARD_STATS } from "./runDoc.js";

const C = LEADERBOARD_COPY;

// ─── ported mock helpers (avatar/initials/ordinal — port, don't reinvent) ──

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
 * no second word; upper-cased. Returns "?" when there are no words.
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

/**
 * handleInitials(handle) — one initial per handle word (CONTEXT area 4):
 * strips a leading "@", then tries every split point against
 * content/handles.js's HANDLE_FIRST/HANDLE_SECOND tables (the first split
 * whose two halves are both known words wins) and returns their first
 * letters upper-cased. A handle that does not split this way falls back to
 * its own first two letters, upper-cased. "" -> "?". Never throws.
 */
export function handleInitials(handle) {
  const s = String(handle ?? "").replace(/^@/, "");
  if (s.length === 0) return "?";
  for (let i = 1; i < s.length; i++) {
    const first = s.slice(0, i);
    const second = s.slice(i);
    if (HANDLE_FIRST.includes(first) && HANDLE_SECOND.includes(second)) {
      return (first[0] + second[0]).toUpperCase();
    }
  }
  return (s[0] + (s[1] || "")).toUpperCase();
}

// ─── content-order lists ─────────────────────────────────────────────────────
//
// RACE_IDS/SUB_IDS are exported (Phase 84, Plan 07) so leaderboardPanel.js's
// controller can validate a RACE/SUB-CLASS sheet pick without importing
// content/races.js or content/classes.js directly — leaderboardPanel.js's
// own source-pin test (84-06) forbids any direct `/content/` import in that
// file, since board rows there carry untrusted text and the pin keeps that
// file's import surface auditable at a glance.

export const RACE_IDS = Object.freeze(Object.keys(RACES));
const CLASS_IDS = Object.keys(CLASSES);
export const SUB_IDS = Object.freeze(CLASS_IDS.flatMap((cls) => CLASSES[cls].subs));
const SUB_CLASS_OF = Object.freeze(
  CLASS_IDS.reduce((acc, cls) => {
    for (const sub of CLASSES[cls].subs) acc[sub] = cls;
    return acc;
  }, {})
);

// ─── module-private helpers ─────────────────────────────────────────────────

/** num(x) — a finite number, else 0. Never throws. */
function num(x) {
  return typeof x === "number" && Number.isFinite(x) ? x : 0;
}

/** fill(template, vars) — replaces every {token} with String(vars[token]), or "" when absent. */
function fill(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : ""
  );
}

/** capitalize(s) — the first letter upper-cased; "" stays "". */
function capitalize(s) {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

/** normRace(v) / normSub(v) — a known content id, else null. */
function normRace(v) {
  return typeof v === "string" && RACE_IDS.includes(v) ? v : null;
}
function normSub(v) {
  return typeof v === "string" && SUB_IDS.includes(v) ? v : null;
}

/** lineNameOf(race, sub) — "{race}, {sub}" with the any-race/any-sub words filled in. */
function lineNameOf(race, sub) {
  return fill(C.line.both, { race: race === null ? C.line.anyRace : race, sub: sub === null ? C.line.anySub : sub });
}

/**
 * whoOf(run) — the expanded row's plain-text race and sub-class line
 * ("Dwarven · Wizard (Magic User)"), from content-validated ids only: an
 * unknown race or sub-class (an untrusted board doc) is left out, "" when
 * neither is known. Phase 87 (BOARD-29).
 */
function whoOf(run) {
  const race = normRace(run.race);
  const sub = normSub(run.sub);
  if (race !== null && sub !== null) return fill(C.who, { race, sub, cls: SUB_CLASS_OF[sub] });
  if (sub !== null) return `${sub} (${SUB_CLASS_OF[sub]})`;
  if (race !== null) return race;
  return "";
}

/** filterLabelOf(run) — the FILTER LIKE THIS button's label, "" when the row has nothing to filter by. */
function filterLabelOf(run) {
  return normRace(run.race) !== null || normSub(run.sub) !== null ? C.rowMenu.open : "";
}

/** levelPart(run) — "RACE SUB · ROMAN" upper-cased; a level past ROMAN's range renders as its number. */
function levelPart(run) {
  const race = String(run.race ?? "").toUpperCase();
  const sub = String(run.sub ?? "").toUpperCase();
  const level = num(run.level);
  const roman = ROMAN[level - 1] || String(level);
  return `${race} ${sub}${C.sep}${roman}`;
}

/** boardLine(run) — "NAME · RACE SUB · ROMAN" upper-cased (LEADERBOARD rows). */
function boardLine(run) {
  return `${String(run.name ?? "").toUpperCase()}${C.sep}${levelPart(run)}`;
}

/** causeTextFallback(cause) — CAUSE_TEXT with {foe} as the generic foe; "" for an unknown cause. */
function causeTextFallback(cause) {
  const template = CAUSE_TEXT[cause];
  if (typeof template !== "string") return "";
  return fill(template, { foe: C.foe });
}

/**
 * detailOf(run) — the expanded row's detail line: the death note
 * ("Cut down by a Werebeast.") when present, else the cause text with the
 * generic foe ("Cut down by a foe."), followed by the epitaph.
 */
function detailOf(run) {
  const note = typeof run.note === "string" && run.note.length > 0 ? run.note : causeTextFallback(run.cause);
  const epitaph = typeof run.epitaph === "string" ? run.epitaph : "";
  return `${capitalize(note)}. ${epitaph}`;
}

/** statChips(run) — the six FLOOR/DAYS/SQUARES/KILLS/EXP/WILMST chips, en-US grouping for WILMST. */
function statChips(run) {
  return [
    { k: C.chips.floor, v: String(num(run.floor)) },
    { k: C.chips.days, v: String(num(run.day)) },
    { k: C.chips.squares, v: String(num(run.steps)) },
    { k: C.chips.kills, v: String(num(run.kills)) },
    { k: C.chips.exp, v: String(num(run.sp)) },
    { k: C.chips.wilmst, v: num(run.gold).toLocaleString("en-US") },
  ];
}

/** valueText(stat, run) — the value half of a ranked row (deep/days/kills/purse). */
function valueText(stat, run) {
  switch (stat) {
    case "deep":
      return `${num(run.floor)}${C.sep}${num(run.steps)}`;
    case "days":
      return String(num(run.day));
    case "kills":
      return String(num(run.kills));
    case "purse":
      return num(run.gold).toLocaleString("en-US");
    default:
      return "";
  }
}

/**
 * dateStrOf(ms, tzOffsetMinutes) — "D Mon YYYY", reading UTC getters on
 * `ms` minus `tzOffsetMinutes` minutes (Date#getTimezoneOffset convention:
 * local = utc - offset).
 */
function dateStrOf(ms, tzOffsetMinutes) {
  const shifted = new Date(ms - num(tzOffsetMinutes) * 60000);
  const day = shifted.getUTCDate();
  const month = C.months[shifted.getUTCMonth()];
  const year = shifted.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * dateLineOf(run, tzOffsetMinutes) — "Died {date} · {version}", using
 * `run.when` when it is a finite number, else `run.createdAt` parsed as a
 * date (board docs written before Phase 84 lack `when`). "" when neither
 * yields a finite time.
 */
function dateLineOf(run, tzOffsetMinutes) {
  let ms;
  if (typeof run.when === "number" && Number.isFinite(run.when)) {
    ms = run.when;
  } else {
    const parsed = typeof run.createdAt === "string" ? Date.parse(run.createdAt) : NaN;
    ms = Number.isFinite(parsed) ? parsed : NaN;
  }
  if (!Number.isFinite(ms)) return "";
  const dateLine = fill(C.died, { date: dateStrOf(ms, tzOffsetMinutes) });
  const version = typeof run.version === "string" && run.version.length > 0 ? run.version : "";
  return version ? `${dateLine}${C.sep}${version}` : dateLine;
}

/**
 * ageWords(ms) — the stale line's age phrase: under a minute -> "moments";
 * exactly one minute -> "a minute"; under an hour -> "{n} minutes"; under
 * two hours (floor) -> "an hour"; else -> "{n} hours" (hours floored).
 */
function ageWords(ms) {
  const totalMinutes = Math.floor(num(ms) / 60000);
  if (totalMinutes < 1) return C.state.ageMoment;
  if (totalMinutes === 1) return C.state.ageMinute;
  if (totalMinutes < 60) return fill(C.state.ageMinutes, { n: totalMinutes });
  const hours = Math.floor(totalMinutes / 60);
  if (hours === 1) return C.state.ageHour;
  return fill(C.state.ageHours, { n: hours });
}

/** seasonLineOf(season) — SEASON_NAMES[season] upper-cased, else the seasonFallback template upper-cased. */
function seasonLineOf(season) {
  const named = SEASON_NAMES[season];
  const text = typeof named === "string" ? named : fill(C.seasonFallback, { n: season });
  return text.toUpperCase();
}

// ─── history filter/sort/rows (YOUR DEAD) ───────────────────────────────────

/** filterHistory(history, race, sub) — only the runs matching both filters (null = ANY). */
function filterHistory(history, race, sub) {
  return history.filter((r) => (race === null || r.race === race) && (sub === null || r.sub === sub));
}

/** sortHistory(stat, list) — rankKeyOf desc, ties by earlier `when` then hash ascending. */
function sortHistory(stat, list) {
  return [...list].sort((a, b) => {
    const ka = rankKeyOf(stat, a);
    const kb = rankKeyOf(stat, b);
    if (ka !== kb) return kb - ka;
    if (a.when !== b.when) return a.when - b.when;
    return a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0;
  });
}

/** buildMineRow(run, i, stat, openKey, tzOffsetMinutes) — one YOUR DEAD row. */
function buildMineRow(run, i, stat, openKey, tzOffsetMinutes) {
  return {
    key: run.hash,
    rank: String(i + 1),
    top: i === 0,
    podium: i < 3,
    you: false,
    divider: "",
    headline: run.name,
    tag: "",
    line: levelPart(run),
    val: valueText(stat, run),
    unit: C.stats[stat].unit,
    open: run.hash === openKey,
    detail: detailOf(run),
    who: whoOf(run),
    race: normRace(run.race),
    sub: normSub(run.sub),
    filterLabel: filterLabelOf(run),
    stats: statChips(run),
    dateLine: dateLineOf(run, tzOffsetMinutes),
    avatar: { initials: initialsOf(run.name), bg: avatarColour(run.name), on: false },
  };
}

/** emptyBody(mode, filtered, lineName) — the "NOBODY YET" empty state, either filtered or all-time. */
function emptyBody(mode, filtered, lineName) {
  const note = filtered
    ? fill(mode === "board" ? C.empty.board : C.empty.mine, { line: lineName })
    : mode === "board"
      ? C.empty.boardAll
      : C.empty.mineAll;
  return {
    kind: "empty",
    title: C.empty.title,
    note,
    clear: filtered ? { id: "clearFilters", label: C.empty.clear } : null,
  };
}

/** buildMineBody({history, stat, race, sub, openKey, tzOffsetMinutes}) — YOUR DEAD's body (never a standing card). */
function buildMineBody({ history, stat, race, sub, openKey, tzOffsetMinutes }) {
  const filtered = filterHistory(history, race, sub);
  const sorted = sortHistory(stat, filtered);
  const top10 = sorted.slice(0, 10);
  const rows = top10.map((run, i) => buildMineRow(run, i, stat, openKey, tzOffsetMinutes));
  const hasFilter = race !== null || sub !== null;
  const body = rows.length ? { kind: "rows", rows } : emptyBody("mine", hasFilter, lineNameOf(race, sub));
  return { body, standing: null, staleLine: "" };
}

// ─── board rows/standing (LEADERBOARD) ──────────────────────────────────────

/** buildBoardRow(doc, index, isPinned, uid, stat, openKey, pinnedRank, tzOffsetMinutes) — one LEADERBOARD row. */
function buildBoardRow(doc, index, isPinned, uid, stat, openKey, pinnedRank, tzOffsetMinutes) {
  const you = isPinned ? true : doc.uid === uid;
  return {
    key: doc.id,
    rank: isPinned ? String(pinnedRank) : String(index + 1),
    top: !isPinned && index === 0,
    podium: !isPinned && index < 3,
    you,
    divider: isPinned ? C.divider : "",
    headline: doc.handle,
    tag: you ? C.you : "",
    line: boardLine(doc),
    val: valueText(stat, doc),
    unit: C.stats[stat].unit,
    open: doc.id === openKey,
    detail: detailOf(doc),
    who: whoOf(doc),
    race: normRace(doc.race),
    sub: normSub(doc.sub),
    filterLabel: filterLabelOf(doc),
    stats: statChips(doc),
    dateLine: dateLineOf(doc, tzOffsetMinutes),
    avatar: { initials: handleInitials(doc.handle), bg: avatarColour(doc.handle), on: you },
  };
}

/** buildBoardStanding(board, docsLen, race, sub) — the real-rank standing card; null with nothing to show. */
function buildBoardStanding(board, docsLen, race, sub) {
  if (docsLen === 0) return null;
  if (board.youKnown !== true) return null;
  if (!board.you) return { place: C.standing.noPlace, note: C.standing.none };
  const handle = board.you.run ? board.you.run.handle : "";
  const total = Number.isInteger(board.filteredTotal)
    ? board.filteredTotal
    : Number.isInteger(board.total)
      ? board.total
      : docsLen;
  const note = fill(C.standing.best, { handle, n: total.toLocaleString("en-US"), line: lineNameOf(race, sub) });
  return { place: ordinal(board.you.rank), note };
}

/** buildBoardBody({board, stat, race, sub, openKey, now, tzOffsetMinutes}) — LEADERBOARD's body/standing/staleLine. */
function buildBoardBody({ board, stat, race, sub, openKey, now, tzOffsetMinutes }) {
  if (!board || board.status === "loading") {
    return { body: { kind: "note", line: C.state.loading, action: null }, standing: null, staleLine: "" };
  }
  if (board.status !== "ready") {
    return {
      body: { kind: "note", line: C.state.unreachable, action: { id: "seeMine", label: C.state.seeMine } },
      standing: null,
      staleLine: "",
    };
  }

  const docs = Array.isArray(board.rows) ? board.rows : [];
  const rows = docs.map((doc, i) => buildBoardRow(doc, i, false, board.uid, stat, openKey, null, tzOffsetMinutes));
  if (board.you && board.you.listed !== true) {
    rows.push(buildBoardRow(board.you.run, null, true, board.uid, stat, openKey, board.you.rank, tzOffsetMinutes));
  }

  const hasFilter = race !== null || sub !== null;
  const body = rows.length ? { kind: "rows", rows } : emptyBody("board", hasFilter, lineNameOf(race, sub));
  const standing = buildBoardStanding(board, docs.length, race, sub);

  let staleLine = "";
  if (board.stale === true && typeof now === "number" && Number.isFinite(board.fetchedAt)) {
    staleLine = fill(C.state.stale, { age: ageWords(now - board.fetchedAt) });
  }

  return { body, standing, staleLine };
}

// ─── header, pickers, sheets, dock ───────────────────────────────────────────

/** buildHeader({mode, compete, entry, historyLen, board, season}) — title/scope/season/back/box. */
function buildHeader({ mode, compete, entry, historyLen, board, season }) {
  const title = mode === "board" ? C.title.board : C.title.mine;
  const scopeLine = mode === "board" ? C.scope.board : compete ? C.scope.mine : C.scope.off;

  let box;
  if (mode === "board") {
    box = { n: String(historyLen), label: C.box.yours, action: "mine" };
  } else if (compete) {
    const total = board && board.status === "ready" && Number.isInteger(board.total) ? board.total : null;
    box = { n: total !== null ? total.toLocaleString("en-US") : C.box.unknown, label: C.box.everyone, action: "board" };
  } else {
    box = { n: String(historyLen), label: C.box.interred, action: null };
  }

  const back = mode === "board" ? entry === "title" : compete || entry === "title";
  const seasonLine = mode === "board" ? seasonLineOf(season) : "";

  return { title, scopeLine, seasonLine, back, backLabel: C.back, box };
}

/** buildPickers(stat, race, sub) — RANK BY / RACE / SUB-CLASS chip rows. */
function buildPickers(stat, race, sub) {
  const s = C.stats[stat];
  return [
    { id: "stat", label: C.pick.stat, value: s.label, col: s.col, active: true },
    { id: "race", label: C.pick.race, value: race === null ? C.pick.any : race.toUpperCase(), active: race !== null },
    { id: "sub", label: C.pick.sub, value: sub === null ? C.pick.any : sub.toUpperCase(), active: sub !== null },
  ];
}

/** filterCount(history, raceFilter, subFilter) — runs matching both (null = ANY). */
function filterCount(history, raceFilter, subFilter) {
  return history.filter((r) => (raceFilter === null || r.race === raceFilter) && (subFilter === null || r.sub === subFilter))
    .length;
}

/** raceSheetOptions(mode, history, race, sub) — ANY RACE + the six races, counted on YOUR DEAD only. */
function raceSheetOptions(mode, history, race, sub) {
  const counted = mode === "mine";
  const ids = [null, ...RACE_IDS];
  return ids.map((id) => {
    const isAny = id === null;
    const n = counted ? String(filterCount(history, id, sub)) : "";
    return {
      value: id,
      label: isAny ? C.sheet.anyRace : id.toUpperCase(),
      sub: isAny ? C.sheet.everyRace : sub === null ? C.sheet.anySubLine : fill(C.sheet.asSub, { sub }),
      n,
      dim: counted && n === "0",
      on: race === id,
      col: "",
    };
  });
}

/** subSheetOptions(mode, history, race, sub) — ANY SUB-CLASS + the 24 subs, counted on YOUR DEAD only. */
function subSheetOptions(mode, history, race, sub) {
  const counted = mode === "mine";
  const ids = [null, ...SUB_IDS];
  return ids.map((id) => {
    const isAny = id === null;
    const n = counted ? String(filterCount(history, race, id)) : "";
    const cls = isAny ? "" : SUB_CLASS_OF[id];
    return {
      value: id,
      label: isAny ? C.sheet.anySub : id.toUpperCase(),
      sub: isAny ? C.sheet.everySub : race === null ? cls : fill(C.sheet.classRace, { cls, race }),
      n,
      dim: counted && n === "0",
      on: sub === id,
      col: "",
    };
  });
}

/** statSheetOptions(stat) — the four RANK BY options, each with its rule as the sub-line. */
function statSheetOptions(stat) {
  return BOARD_STATS.map((id) => {
    const s = C.stats[id];
    return { value: id, label: s.label, sub: s.rule, n: "", dim: false, on: stat === id, col: s.col };
  });
}

/**
 * rowMenuOptions(menu) — the long-press menu's options in the order race,
 * sub, both, cancel. Race is offered only when menu.race is a known race id,
 * sub only when menu.sub is a known sub-class id, both only when both are;
 * CANCEL always. Labels are upper-cased from the copy templates.
 */
function rowMenuOptions(menu) {
  const race = normRace(menu.race);
  const sub = normSub(menu.sub);
  const M = C.rowMenu;
  const opt = (value, label, line) => ({ value, label: label.toUpperCase(), sub: line, n: "", dim: false, on: false, col: "" });
  const opts = [];
  if (race !== null) opts.push(opt("race", fill(M.race, { race }), fill(M.raceLine, { race })));
  if (sub !== null) opts.push(opt("sub", fill(M.sub, { sub }), fill(M.subLine, { sub })));
  if (race !== null && sub !== null) opts.push(opt("both", fill(M.both, { race, sub }), M.bothLine));
  opts.push(opt("cancel", M.cancel, M.cancelLine));
  return opts;
}

/** buildSheet(sheetId, mode, history, race, sub, stat, menu) — null when no sheet is open. */
function buildSheet(sheetId, mode, history, race, sub, stat, menu) {
  if (sheetId === "row") {
    if (menu === null || (normRace(menu.race) === null && normSub(menu.sub) === null)) return null;
    return { id: "row", title: C.rowMenu.title, done: C.rowMenu.cancel, opts: rowMenuOptions(menu) };
  }
  if (sheetId === "stat") return { id: "stat", title: C.pick.stat, done: C.sheet.done, opts: statSheetOptions(stat) };
  if (sheetId === "race")
    return { id: "race", title: C.pick.race, done: C.sheet.done, opts: raceSheetOptions(mode, history, race, sub) };
  if (sheetId === "sub")
    return { id: "sub", title: C.pick.sub, done: C.sheet.done, opts: subSheetOptions(mode, history, race, sub) };
  return null;
}

/**
 * buildDock(entry, hasHero, dead) — the dead-hero dock (FINAL SHEET, BURY
 * THEM) and the title footers, ported verbatim from boardsView.js#buildDock.
 */
function buildDock(entry, hasHero, dead) {
  if (entry === "tab" && dead) {
    return [
      { id: "finalSheet", label: C.dock.finalSheet, primary: false },
      { id: "bury", label: C.dock.bury, primary: true },
    ];
  }
  if (entry !== "title") return null;
  if (hasHero) return [{ id: "dungeon", label: C.dock.dungeon, primary: true }];
  return [
    { id: "title", label: C.dock.title, primary: false },
    { id: "roll", label: C.dock.roll, primary: true },
  ];
}

// ─── leaderboardView (Task 1 + Task 2) ──────────────────────────────────────

/**
 * leaderboardView(input) — the pure view of the whole v3 Leaderboards panel
 * (header, pickers, body, stale line, standing card, bottom sheet, dock),
 * for both LEADERBOARD (board mode, Compete ON) and YOUR DEAD (mine mode;
 * Compete OFF always forces mine mode). Every field is optional; bad values
 * fall back per src/browser/leaderboardView.js's own <interfaces> block
 * (84-05-PLAN.md). Never mutates `input`, never throws, no DOM/clock/random.
 */
export function leaderboardView(input = {}) {
  const raw = input && typeof input === "object" ? input : {};

  const compete = raw.compete === true;
  const mode = compete && raw.mode === "board" ? "board" : "mine";
  const entry = raw.entry === "title" ? "title" : "tab";
  const hasHero = raw.hasHero === true;
  const dead = raw.dead === true;

  const stat = C.stats[raw.stat] ? raw.stat : "deep";
  const race = normRace(raw.race);
  const sub = normSub(raw.sub);
  const openKey = raw.open ?? null;
  const sheetId = ["stat", "race", "sub", "row"].includes(raw.sheet) ? raw.sheet : null;
  const menu = raw.menu && typeof raw.menu === "object" ? raw.menu : null;

  const history = Array.isArray(raw.history) ? raw.history : [];
  const board = raw.board && typeof raw.board === "object" ? raw.board : null;

  const now = typeof raw.now === "number" && Number.isFinite(raw.now) ? raw.now : null;
  const tzOffsetMinutes = typeof raw.tzOffsetMinutes === "number" && Number.isFinite(raw.tzOffsetMinutes) ? raw.tzOffsetMinutes : 0;
  const season = Number.isInteger(raw.season) && raw.season > 0 ? raw.season : SEASON;

  const header = buildHeader({ mode, compete, entry, historyLen: history.length, board, season });
  const pickers = buildPickers(stat, race, sub);
  const dock = buildDock(entry, hasHero, dead);
  const sheet = buildSheet(sheetId, mode, history, race, sub, stat, menu);

  const result =
    mode === "mine"
      ? buildMineBody({ history, stat, race, sub, openKey, tzOffsetMinutes })
      : buildBoardBody({ board, stat, race, sub, openKey, now, tzOffsetMinutes });

  return {
    mode,
    entry,
    stat,
    col: C.stats[stat].col,
    header,
    pickers,
    body: result.body,
    staleLine: result.staleLine,
    standing: result.standing,
    sheet,
    dock,
  };
}
