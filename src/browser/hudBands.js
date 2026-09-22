// src/browser/hudBands.js
//
// Phase 57 (LAYOUT-05) — the pure identity/counter formatters behind the
// stacked HUD bands. This module owns the band-1 identity string and the
// band-2 fixed-width counter slots; the four band ids below are the
// 2026-09-21 user ruling's order, and that ruling SUPERSEDES Phase 35
// (MAP-01) ruling 5's single-row HUD (see mazeworld.html's own comment
// above `.mw-hud` for the reversal note).
//
// USER MOCK RULING 2026-09-22 (Plan 05, amending the 2026-09-21 order
// above): band 4 (the map chip strip) is retired into a ☰ menu on band
// 2 (see src/browser/hudMenu.js), and the HP text/bar move to their own
// strip directly under band 1. `identityParts` below is this plan's split
// of `identityLine`'s single string into the name segment (never truncated)
// and the race/class/level segment (which does truncate) — mazeworld.html's
// band-1 markup renders them as two separate spans so neither can collide
// with the x/y HP text. `COUNTER_SLOT_CH` is this plan's reconciliation of
// D-08's unbounded-Squares slot with band 2 now also carrying the ☰
// button (see discovery D in 57-05-PLAN.md).
//
// Pure, DOM-free, timer-free, storage-free — same house shape as
// src/browser/viewModels.js. No engine import either: this module only
// formats strings/records from plain values the caller already has (the
// character record, the run's counters). Bridged onto the shell's classic
// script under the name `__mzHudBands` (src/browser/bridge.js), consumed
// by paint()'s HUD writes.

/**
 * HUD_BAND_ANCHORS — the band anchors, in the ruled top-to-bottom order, as
 * the exact literal substrings their markup carries in mazeworld.html: the
 * band-1 identity element, the HP strip directly under it, the band-2
 * counters element, the condition-chip strip host. This is the SINGLE place
 * the order is written down — test/unit/hud-bands-layout.test.js asserts
 * these four substrings appear in mazeworld.html in this exact order, so
 * the constant and the markup can never drift apart.
 *
 * USER MOCK RULING 2026-09-22 (Plan 05): the former fourth anchor
 * (`id="mw-map-chips"`, the map chip band) is retired — that band is gone
 * outright, folded into the ☰ HUD menu on band 2 (src/browser/hudMenu.js).
 * The HP strip (`class="mw-hud-wptrack"`) takes its place in the anchor
 * list, between band 1 and band 2, matching its new position in the
 * markup.
 */
export const HUD_BAND_ANCHORS = Object.freeze([
  'id="mw-hud-name"',
  'class="mw-hud-wptrack"',
  'class="mw-hud-counters"',
  'id="mm-conditions"',
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
 * identityParts(c) -> frozen { name, line }
 *
 * Phase 57 (LAYOUT-05), Plan 05 — the band-1 split: `name` is exactly the
 * name segment identityLine() renders (the existing IDENTITY_PLACEHOLDER
 * stand-in when missing) — this is the mock's never-truncated gold span.
 * `line` is exactly the text identityLine() renders AFTER its em-dash
 * separator ("Race Class (Sub) · Lvl N", with the same sub-omission and
 * level-1 rules) — this is the mock's dimmed, ellipsis-truncating span. A
 * null/missing `c` yields the stand-in name and an empty line (never
 * throws).
 */
export function identityParts(c) {
  if (!c) return Object.freeze({ name: IDENTITY_PLACEHOLDER, line: "" });
  const name = c.name || IDENTITY_PLACEHOLDER;
  const race = c.race || "";
  const cls = c.cls || "";
  const subGroup = c.sub ? ` (${c.sub})` : "";
  const level = c.level || 1;
  const raceClass = [race, cls].filter(Boolean).join(" ");
  return Object.freeze({ name, line: `${raceClass}${subGroup} · Lvl ${level}` });
}

/**
 * identityLine(c) -> "Name — Race Class (Sub) · Lvl N"
 *
 * Composes from identityParts(c) (Phase 57, Plan 05) — every existing
 * output stays byte-identical to the pre-split formatter, guarded by the
 * seven pre-existing tests in test/unit/hudBands.test.js.
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
  const { name, line } = identityParts(c);
  return `${name} — ${line}`;
}

/**
 * COUNTER_SLOT_CH — a frozen map from the four counter ids to their fixed
 * numeral slot widths in ch, keyed and ordered exactly as counterSlots()'
 * four records. Phase 57, Plan 05, discovery D: four 5ch slots (D-08's
 * COUNTER_DIGIT_SLOT) plus the new ☰ button overflow a Pixel 7's 411px
 * CSS width at text size M (145 + 192 + 8 + 24 + 28 + 10 + 40 = 445px). Only
 * `m-steps` (Squares) is genuinely unbounded — the steps counter that
 * motivated D-08's 5-digit slot in the first place — so it alone keeps
 * COUNTER_DIGIT_SLOT. The other three are sized to their real bounds: Depth
 * 3 (runs end around depth 20 in play; the dev start-at-depth input caps at
 * 999), Day 3 (the low hundreds at most), Rations 2 (content/bags.js's
 * largest bag caps rations at 60). That reconciled total is 377.8px, fitting
 * 411 with about 33px to spare. counterSlots()' own overflow clamp
 * (COUNTER_OVERFLOW, still 5 digits) is unchanged for every counter — a
 * narrower CSS slot only affects the column's resting width, never the
 * digit-count math above.
 */
export const COUNTER_SLOT_CH = Object.freeze({
  "m-floor": 3,
  "m-day": 3,
  "m-steps": COUNTER_DIGIT_SLOT,
  "m-rations": 2,
});

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
