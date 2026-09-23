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
 * deep/combo/yard: floor desc, then steps asc.
 * lean: squares per floor asc (cross-multiplied), then floor desc, then
 * steps asc; an unplaced run (floor below 1) ranks last (Phase 66, D-09 —
 * LEANEST is squares-per-floor, not a DEEPEST duplicate).
 * days: day desc, then floor desc. kills: kills desc, then floor desc.
 * purse: gold desc only. An unknown board id always returns 0.
 */
export function compareRuns(board, a, b) {
  switch (board) {
    case "deep":
    case "combo":
    case "yard":
      return num(field(b, "floor")) - num(field(a, "floor")) || num(field(a, "steps")) - num(field(b, "steps"));
    case "lean": {
      const af = num(field(a, "floor"));
      const bf = num(field(b, "floor"));
      const as = num(field(a, "steps"));
      const bs = num(field(b, "steps"));
      const aPlaced = af >= 1;
      const bPlaced = bf >= 1;
      if (aPlaced !== bPlaced) return aPlaced ? -1 : 1;
      if (aPlaced && bPlaced) {
        // Cross-multiplied rate compare (as/af vs bs/bf) so no division or
        // floating-point rounding ever decides the order — the 1/3 vs 2/6
        // case must not tie by rounding.
        const rate = as * bf - bs * af;
        if (rate !== 0) return rate;
      }
      return bf - af || as - bs;
    }
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

/**
 * leanRate(run) — the LEANEST metric (Phase 66, D-09): squares walked per
 * floor descended (steps / floor), read by the panel's value bar and by
 * Phase 68's submission. Number.POSITIVE_INFINITY when the run has no valid
 * floor (below 1), so an unplaced run never divides by zero. boardValue
 * ("lean") stays the floor — the row still displays "floor · sq".
 */
export function leanRate(run) {
  const floor = num(field(run, "floor"));
  const steps = num(field(run, "steps"));
  return floor >= 1 ? steps / floor : Number.POSITIVE_INFINITY;
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

// --- the bests record (D-04, D-07, D-08, D-14) --------------------------------

const HASH_RE = /^[0-9a-f]{8}$/;

/** isValidHash(hash) — true only for an 8-lowercase-hex string. */
export function isValidHash(hash) {
  return typeof hash === "string" && HASH_RE.test(hash);
}

/** isPlainObject(v) — a non-null, non-array object. */
function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/**
 * prune(record) — deletes every runs key not referenced by a RANKED_BOARDS
 * list or a lineage best. Mutates record.runs in place and returns record.
 */
function prune(record) {
  const keep = new Set();
  for (const board of RANKED_BOARDS) {
    for (const hash of record.boards[board]) keep.add(hash);
  }
  for (const key of Object.keys(record.lineage)) {
    const best = record.lineage[key].best;
    if (best) keep.add(best);
  }
  for (const hash of Object.keys(record.runs)) {
    if (!keep.has(hash)) delete record.runs[hash];
  }
  return record;
}

/** emptyBests() — a fresh, empty BestsRecord. */
export function emptyBests() {
  return {
    v: 1,
    runs: {},
    boards: { deep: [], lean: [], days: [], kills: [], purse: [] },
    lineage: {},
    last: null,
  };
}

/**
 * sanitizeBests(raw) — never throws: coerces any input into a valid, pruned
 * BestsRecord, dropping every entry that fails its own shape check.
 *
 * Phase 66 (D-09): re-ranks every stored list by its board's current
 * comparator, so an older record whose LEANEST list was stored in the
 * retired depth order loads re-ranked; a list already in order is unchanged
 * (Array.prototype.sort is stable), so this is idempotent and needs no
 * record version bump.
 */
export function sanitizeBests(raw) {
  try {
    if (!isPlainObject(raw)) return emptyBests();

    const runs = {};
    if (isPlainObject(raw.runs)) {
      for (const key of Object.keys(raw.runs)) {
        const value = raw.runs[key];
        if (HASH_RE.test(key) && isPlainObject(value) && value.hash === key) {
          runs[key] = { ...value };
        }
      }
    }

    const boards = { deep: [], lean: [], days: [], kills: [], purse: [] };
    if (isPlainObject(raw.boards)) {
      for (const board of RANKED_BOARDS) {
        const list = raw.boards[board];
        if (!Array.isArray(list)) continue;
        const seen = new Set();
        const filtered = [];
        for (const hash of list) {
          if (typeof hash === "string" && runs[hash] && !seen.has(hash)) {
            seen.add(hash);
            filtered.push(hash);
          }
        }
        filtered.sort((x, y) => compareRuns(board, runs[x], runs[y]));
        boards[board] = filtered.slice(0, BOARD_TOP_N);
      }
    }

    const lineage = {};
    if (isPlainObject(raw.lineage)) {
      for (const key of Object.keys(raw.lineage)) {
        const value = raw.lineage[key];
        if (!isPlainObject(value)) continue;
        if (!Number.isInteger(value.count) || value.count < 1) continue;
        const best = typeof value.best === "string" && runs[value.best] ? value.best : null;
        lineage[key] = { count: value.count, best };
      }
    }

    const last = typeof raw.last === "string" && HASH_RE.test(raw.last) ? raw.last : null;

    return prune({ v: 1, runs, boards, lineage, last });
  } catch {
    return emptyBests();
  }
}

/**
 * updateBests(record, summary) — folds one RunSummary into a BestsRecord.
 * Never mutates `record` or `summary`. Returns { record, newBests, first }:
 * newBests is the ordered (per BOARD_IDS) list of boards this run just took
 * #1 on (an exact tie never counts, and a first-of-combo lineage entry is
 * silent). first is true only when the record held no runs at all before
 * this one.
 */
export function updateBests(record, summary) {
  if (!isPlainObject(summary) || !isValidHash(summary.hash)) {
    return { record, newBests: [], first: false };
  }

  const rec = sanitizeBests(record);
  const hash = summary.hash;

  if (rec.last === hash || rec.runs[hash]) {
    return { record: rec, newBests: [], first: false };
  }

  const first = RANKED_BOARDS.every((board) => rec.boards[board].length === 0);

  rec.runs[hash] = { ...summary };

  const newBestsSet = new Set();

  for (const board of RANKED_BOARDS) {
    const list = rec.boards[board];
    const wasNonEmpty = list.length > 0;
    let i = list.length;
    for (let j = 0; j < list.length; j++) {
      if (compareRuns(board, summary, rec.runs[list[j]]) < 0) {
        i = j;
        break;
      }
    }
    if (i < BOARD_TOP_N) {
      list.splice(i, 0, hash);
      if (list.length > BOARD_TOP_N) list.length = BOARD_TOP_N;
    }
    if (i === 0 && wasNonEmpty) newBestsSet.add(board);
  }

  const key = lineageKey(summary);
  const entry = rec.lineage[key];
  if (!entry) {
    rec.lineage[key] = { count: 1, best: hash };
  } else {
    entry.count += 1;
    if (!entry.best || !rec.runs[entry.best]) {
      entry.best = hash;
    } else if (compareRuns("combo", summary, rec.runs[entry.best]) < 0) {
      entry.best = hash;
      newBestsSet.add("combo");
    }
  }

  rec.last = hash;
  prune(rec);

  const newBests = BOARD_IDS.filter((id) => newBestsSet.has(id));

  return { record: rec, newBests, first };
}

/**
 * normalizeStone(stone) — Phase 66 (D-09): the legacy-stone normalization
 * backfillBests folds in, exported so the graveyard read seam can hash a
 * stone the same way its backfilled bests entry was hashed (letting the
 * panel dedupe the graveyard against the bests record). Returns null unless
 * `stone` is a plain object with a finite numeric floor. Otherwise returns a
 * shallow copy: when the copy has no numeric season, it is set to season 0
 * with no seed/acts (absent, not invented) and a freshly computed hash; when
 * it has a numeric season but no valid hash, only the hash is (re)computed.
 * A stone that already carries a numeric season AND a valid hash is returned
 * unchanged (still a shallow copy). Never mutates its input.
 */
export function normalizeStone(stone) {
  if (!isPlainObject(stone) || !Number.isFinite(stone.floor)) return null;

  const s = { ...stone };
  if (typeof s.season !== "number") {
    s.season = 0;
    delete s.seed;
    delete s.acts;
    s.hash = runHash(s);
  } else if (!isValidHash(s.hash)) {
    s.hash = runHash(s);
  }
  return s;
}

/**
 * backfillBests(graves) — seeds a BestsRecord from legacy graveyard stones
 * (newest-first, per the adapter's storage shape). Folds oldest-first so a
 * tie on every ordering key keeps the OLDER stone ranked first. Each stone is
 * normalized through normalizeStone (skipping any it returns null for), so
 * backfill behaviour is byte-identical to before that helper existed.
 */
export function backfillBests(graves) {
  if (!Array.isArray(graves)) return emptyBests();

  let rec = emptyBests();
  const oldestFirst = graves.slice().reverse();

  for (const stone of oldestFirst) {
    const s = normalizeStone(stone);
    if (!s) continue;

    rec = updateBests(rec, s).record;
  }

  return rec;
}

/**
 * sortGraveyard(graves) — every valid stone (a plain object with a finite
 * numeric floor), ordered floor desc then steps asc, never cut to ten. Does
 * not mutate its input; Array.prototype.sort is stable, so ties keep input
 * order.
 */
export function sortGraveyard(graves) {
  if (!Array.isArray(graves)) return [];
  return graves
    .filter((s) => isPlainObject(s) && Number.isFinite(s.floor))
    .sort((a, b) => compareRuns("yard", a, b));
}
