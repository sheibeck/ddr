// engine/records.js
//
// Phase 65 (RUN-01/RUN-02/RUN-03): the run's integrity hash and the one
// shared board table. Phase 66's panel and Phase 68's submission read this
// table and never redefine it. Cross-run data itself is adapter-owned
// (src/browser/engineAdapter.js), never GameState.
//
// This module has NO imports: no content/, no death.js (death.js will import
// from here in Plan 65-04, so importing back would create a cycle), no Date,
// no Math.random, no DOM, and no `type:` event literals. Every export below
// is a pure, deterministic function of its arguments.

// --- the run's integrity hash (D-03) -----------------------------------------

/**
 * RUN_HASH_FIELDS — the 15 fields that make up a run's stable identity, in
 * this exact order. `when` (wall clock), `note` and `epitaph` (content text)
 * are deliberately excluded so copy edits and wall-clock reads never change
 * a hash.
 */
export const RUN_HASH_FIELDS = Object.freeze([
  "season", "seed", "acts", "floor", "steps", "day", "kills", "gold",
  "sp", "level", "race", "sub", "cls", "name", "cause",
]);

/** HASH_DELIMITER — the ASCII unit separator. No content string carries it. */
export const HASH_DELIMITER = "\u001f";

/**
 * fnv1a32(str) — FNV-1a 32-bit hash over UTF-16 code units. Math.imul is
 * mandatory here: a plain `*` loses precision past 2^53.
 * @returns {number} an unsigned 32-bit integer
 */
export function fnv1a32(str) {
  const s = String(str);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** canon(v) — undefined/null become "", everything else is String(v). */
function canon(v) {
  return v === undefined || v === null ? "" : String(v);
}

/**
 * runHash(run) — the run's stable id: RUN_HASH_FIELDS mapped through canon(),
 * joined by HASH_DELIMITER, then FNV-1a hashed to 8 lowercase hex characters.
 * Never throws: a null or non-object run is treated as {}.
 * @returns {string} exactly 8 lowercase hex characters
 */
export function runHash(run) {
  const r = run && typeof run === "object" ? run : {};
  const parts = RUN_HASH_FIELDS.map((k) => canon(r[k]));
  const joined = parts.join(HASH_DELIMITER);
  return fnv1a32(joined).toString(16).padStart(8, "0");
}

// --- the one shared board table (D-04, D-06) ---------------------------------

/** BOARD_TOP_N — every ranked board keeps at most this many entries. */
export const BOARD_TOP_N = 10;

/** BOARD_IDS — the mock's seven tabs, in tab order. */
export const BOARD_IDS = Object.freeze(["deep", "lean", "combo", "days", "kills", "purse", "yard"]);

/** RANKED_BOARDS — the five boards a bests record keeps a top-ten list for. */
export const RANKED_BOARDS = Object.freeze(["deep", "lean", "days", "kills", "purse"]);

/** num(x) — a finite number, else 0 (missing/NaN/Infinity fields never crash an ordering). */
function num(x) {
  return typeof x === "number" && Number.isFinite(x) ? x : 0;
}

/** field(o, k) — a safe property read that never throws on a non-object. */
function field(o, k) {
  return o && typeof o === "object" ? o[k] : undefined;
}

/**
 * compareRuns(board, a, b) — negative when a ranks above b, 0 on a full tie.
 * deep/lean/combo/yard: floor desc, then steps asc.
 * days: day desc, then floor desc. kills: kills desc, then floor desc.
 * purse: gold desc only. An unknown board id always returns 0.
 */
export function compareRuns(board, a, b) {
  switch (board) {
    case "deep":
    case "lean":
    case "combo":
    case "yard":
      return num(field(b, "floor")) - num(field(a, "floor")) || num(field(a, "steps")) - num(field(b, "steps"));
    case "days":
      return num(field(b, "day")) - num(field(a, "day")) || num(field(b, "floor")) - num(field(a, "floor"));
    case "kills":
      return num(field(b, "kills")) - num(field(a, "kills")) || num(field(b, "floor")) - num(field(a, "floor"));
    case "purse":
      return num(field(b, "gold")) - num(field(a, "gold"));
    default:
      return 0;
  }
}

/** boardValue(board, run) — the headline number a board's row displays. */
export function boardValue(board, run) {
  switch (board) {
    case "deep":
    case "lean":
    case "combo":
    case "yard":
      return num(field(run, "floor"));
    case "days":
      return num(field(run, "day"));
    case "kills":
      return num(field(run, "kills"));
    case "purse":
      return num(field(run, "gold"));
    default:
      return 0;
  }
}

/** lineageKey(run) — the LINEAGE grouping key: "{race} {cls}". */
export function lineageKey(run) {
  return `${run.race} ${run.cls}`;
}
