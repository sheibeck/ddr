// src/browser/newBest.js
//
// Phase 65 (RUN-04): the THAT IS THAT death panel's new-personal-best block,
// as a view model. The shell (mazeworld.html renderCombatOver, Plan 05)
// renders it with textContent; this module owns the formatting. Pure: no
// DOM, no storage, no randomness. The quip rotates by the run hash, so
// re-renders are stable.

import { BOARD_COPY, NEW_BEST_HEAD, NEW_BEST_LINES, FIRST_DEATH_LINES } from "../../content/boards.js";

const SEP = " · "; // U+00B7 middle dot, one space each side (shell's floor/day separator)
const HASH_RE = /^[0-9a-f]{8}$/;

/** n(x) — module-private: a finite number as-is, else 0. Never throws. */
function n(x) {
  return typeof x === "number" && Number.isFinite(x) ? x : 0;
}

/**
 * newBestValueText(board, summary) — the value half of a new-best row.
 * Returns "" for any board id this module does not know how to format
 * (including "yard", which the caller never passes since GRAVEYARD never
 * announces).
 */
export function newBestValueText(board, summary) {
  const s = summary && typeof summary === "object" ? summary : {};
  switch (board) {
    case "deep":
      return `floor ${n(s.floor)}`;
    case "lean":
      return `floor ${n(s.floor)}${SEP}${n(s.steps)} ${BOARD_COPY.lean.unit}`;
    case "combo":
      // Phase 70 (D-10): a lineage is race + sub-class, the same key LINEAGE ranks by.
      return `${s.race || ""} ${s.sub || ""}${SEP}floor ${n(s.floor)}`;
    case "days": {
      const d = n(s.day);
      return `${d} ${d === 1 ? BOARD_COPY.days.unitOne : BOARD_COPY.days.unit}`;
    }
    case "kills": {
      const k = n(s.kills);
      return `${k} ${k === 1 ? BOARD_COPY.kills.unitOne : BOARD_COPY.kills.unit}`;
    }
    case "purse":
      return `${n(s.gold).toLocaleString("en-US")} ${BOARD_COPY.purse.unit}`;
    default:
      return "";
  }
}

/** pickIndex(hash, bankLength) — module-private: the deterministic bank
 * index a run's hash selects. A well-formed 8-hex-char hash maps through
 * parseInt/>>>0 into [0, bankLength); anything else picks index 0. */
function pickIndex(hash, bankLength) {
  if (typeof hash === "string" && HASH_RE.test(hash)) {
    return (parseInt(hash, 16) >>> 0) % bankLength;
  }
  return 0;
}

/**
 * newBestView(report) — the pure view model. See 65-03-PLAN.md Task 2's
 * <behavior> list for the exact contract. Never throws.
 */
export function newBestView(report) {
  if (!report || typeof report !== "object") return null;

  const summary = report.summary && typeof report.summary === "object" ? report.summary : {};

  if (report.first === true) {
    const pick = pickIndex(summary.hash, FIRST_DEATH_LINES.length);
    return { head: null, rows: [], quip: FIRST_DEATH_LINES[pick] };
  }

  const requested = Array.isArray(report.newBests) ? report.newBests : [];
  const boardKeys = Object.keys(BOARD_COPY);
  const known = new Set(requested);
  const ids = boardKeys.filter((id) => id !== "yard" && known.has(id));

  if (ids.length === 0) return null;

  const pick = pickIndex(summary.hash, NEW_BEST_LINES.length);
  return {
    head: NEW_BEST_HEAD,
    rows: ids.map((id) => `${BOARD_COPY[id].title}${SEP}${newBestValueText(id, summary)}`),
    quip: NEW_BEST_LINES[pick],
  };
}
