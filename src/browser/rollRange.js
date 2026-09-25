// src/browser/rollRange.js
//
// Phase 73 (ROLL-05): the ONE place a winning range is written. Every
// event-driven roll line the mirror plans (73-04 through 73-09) add to
// eventNarration.js, narrationLines.js and rail.js formats its range
// through rangeText/rollVsText here, so no two surfaces ever write a range
// differently. Phase 74 (ROLL-02/03) extends this module with the
// player-side signed-modifier formatter; the full line shape it builds on
// top of rollVsText is "**17** vs 18–20 (mods)" (74-CONTEXT, user-accepted
// 2026-09-25).
//
// Pure, no DOM, no imports, no Math.random/Date.now — the same import-free
// purity discipline src/browser/upgradeWhy.js holds itself to, so any
// consumer can format the same range without pulling in engine/ or content/.
//
// The range separator is ALWAYS U+2013 (en dash), matching the repo's
// existing "1–2" ranges. It is never the ASCII hyphen-minus, and it is a
// different character from the U+2212 minus sign upgradeWhy.js's
// signedNeed() uses for negative deltas — a range is not a negative number.

/**
 * rangeText(atLeast, dieN) — the winning-face range on a dieN-sided die
 * whose lowest winning face is atLeast, written the one way every surface
 * uses:
 *   - not a finite number for either argument -> "?"
 *   - atLeast > dieN -> "nothing" (no face wins)
 *   - atLeast === dieN -> String(dieN) (a single winning face)
 *   - otherwise -> `${Math.max(1, atLeast)}–${dieN}` (an atLeast at or below
 *     1 reads as the full die, "1–N")
 *
 * Examples: (16, 20) "16–20"; (18, 20) "18–20"; (20, 20) "20";
 * (21, 20) "nothing"; (1, 20) and (-3, 20) "1–20"; (2, 6) "2–6";
 * (2, 2) "2"; (1, 2) "1–2".
 */
export function rangeText(atLeast, dieN) {
  if (!Number.isFinite(atLeast) || !Number.isFinite(dieN)) return "?";
  if (atLeast > dieN) return "nothing";
  if (atLeast === dieN) return String(dieN);
  return `${Math.max(1, atLeast)}–${dieN}`;
}

/**
 * rollVsText(roll, atLeast, dieN) — Phase 74's final roll line core, joining
 * the drawn face and its winning range: "17 vs 18–20". `roll` reads "?" when
 * it is not a finite number (a missing/undefined event field); the range
 * itself still goes through rangeText's own "?"/"nothing" rules.
 */
export function rollVsText(roll, atLeast, dieN) {
  const rollPart = Number.isFinite(roll) ? String(roll) : "?";
  return `${rollPart} vs ${rangeText(atLeast, dieN)}`;
}
