// src/browser/hudBands.js
//
// Phase 57 (LAYOUT-05) — the pure identity/counter formatters behind the
// four stacked HUD bands. This module owns the band-1 identity string and
// the band-2 fixed-width counter slots; the four band ids below are the
// 2026-09-21 user ruling's order, and that ruling SUPERSEDES Phase 35
// (MAP-01) ruling 5's single-row HUD (see mazeworld.html's own comment
// above `.mw-hud` for the reversal note).
//
// Pure, DOM-free, timer-free, storage-free — same house shape as
// src/browser/viewModels.js. No engine import either: this module only
// formats strings/records from plain values the caller already has (the
// character record, the run's counters). Bridged onto the shell's classic
// script under the name `__mzHudBands` (src/browser/bridge.js), consumed
// by paint()'s HUD writes.

/**
 * HUD_BAND_ANCHORS — the four band anchors, in the ruled top-to-bottom
 * order, as the exact literal substrings their markup carries in
 * mazeworld.html: the band-1 identity element, the band-2 counters
 * element, the condition-chip strip host, the map chip band. This is the
 * SINGLE place the order is written down — test/unit/hud-bands-layout
 * .test.js asserts these four substrings appear in mazeworld.html in this
 * exact order, so the constant and the markup can never drift apart.
 */
export const HUD_BAND_ANCHORS = Object.freeze([
  'id="mw-hud-name"',
  'class="mw-hud-counters"',
  'id="mm-conditions"',
  'id="mw-map-chips"',
]);

/**
 * COUNTER_DIGIT_SLOT — the integer 5. The digit width the band-2 fixed-
 * width numeral slot is sized for (D-08: Squares grows unbounded; a
 * five-digit slot covers 0..99,999 without widening the row).
 */
export const COUNTER_DIGIT_SLOT = 5;

/**
 * COUNTER_OVERFLOW — the string a counter value past the cap renders as:
 * COUNTER_DIGIT_SLOT nines followed by a plus sign (length
 * COUNTER_DIGIT_SLOT + 1). This is the named behaviour past the cap: clamp
 * the glyph count, never widen the row, never wrap, never abbreviate to a
 * "k" form (D-08 forbids abbreviation).
 */
export const COUNTER_OVERFLOW = "9".repeat(COUNTER_DIGIT_SLOT) + "+";

/**
 * IDENTITY_PLACEHOLDER — the non-empty stand-in used when a character (or
 * its name) is missing, so band 1 never collapses to an empty node.
 */
const IDENTITY_PLACEHOLDER = "Nameless";

/**
 * identityLine(c) -> "Name — Race Class (Sub) · Lvl N"
 *
 * Rules:
 * - a missing/null `c` returns the placeholder-only form (IDENTITY_PLACEHOLDER)
 *   and never throws — nothing else about the character is known.
 * - a falsy `c.name` substitutes IDENTITY_PLACEHOLDER for the name segment.
 * - a falsy `c.sub` omits the parenthesised group AND its leading space
 *   entirely (never empty parentheses).
 * - a falsy `c.level` renders "Lvl 1".
 * - the separators are the em dash and the middle dot already used
 *   elsewhere in the shell (heroTab.js's party-line / armor sub-line).
 *
 * Player-facing: no "WP", no banned terms — only HP language exists
 * elsewhere in the HUD (the x/y HP block this line sits beside).
 */
export function identityLine(c) {
  if (!c) return IDENTITY_PLACEHOLDER;
  const name = c.name || IDENTITY_PLACEHOLDER;
  const race = c.race || "";
  const cls = c.cls || "";
  const subGroup = c.sub ? ` (${c.sub})` : "";
  const level = c.level || 1;
  const raceClass = [race, cls].filter(Boolean).join(" ");
  return `${name} — ${raceClass}${subGroup} · Lvl ${level}`;
}

/**
 * counterSlots(state) -> frozen array of four { id, label, text, over }
 * records, in the order Depth, Day, Squares, Rations, with ids m-floor,
 * m-day, m-steps, m-rations — the same ids paint() has always written
 * (D-09's contract). A missing/partial `state` yields zeroes rather than
 * throwing. `text` is the plain numeric string when its digit count is
 * within COUNTER_DIGIT_SLOT, otherwise COUNTER_OVERFLOW; `over` is the
 * corresponding boolean. The band-2 label for `m-floor` is "Depth" per the
 * 2026-09-21 ruling's wording while the element id stays `m-floor`.
 */
export function counterSlots(state) {
  const depth = numberOrZero(state?.floor?.depth);
  const day = numberOrZero(state?.day);
  const steps = numberOrZero(state?.steps);
  const rations = numberOrZero(state?.c?.rations);
  return Object.freeze([
    slot("m-floor", "Depth", depth),
    slot("m-day", "Day", day),
    slot("m-steps", "Squares", steps),
    slot("m-rations", "Rations", rations),
  ]);
}

function numberOrZero(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
}

function slot(id, label, value) {
  const digits = String(value);
  const over = digits.length > COUNTER_DIGIT_SLOT;
  return Object.freeze({ id, label, text: over ? COUNTER_OVERFLOW : digits, over });
}
