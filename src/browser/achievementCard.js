// src/browser/achievementCard.js
//
// Phase 100 (AUI-01): the pure core of the unlock banner. An achievement unlock
// is ONE rail card of the new "achievement" kind: the in-game icon, the title
// ACHIEVEMENT, the achievement's name and its sarcastic line. This module
// builds that card and the many-at-once summary card, and (below the card
// builders) owns the pending queue that decides when a card may be shown.
//
// Rulings from Phase 100 CONTEXT that this module implements:
//   - the rail is the one feedback surface; an achievement card is dismissible
//     and is NEVER a decision: no action row, never locked, so a body tap on it
//     classifies "dismissible" (railDismissKind) and it holds long
//     (RAIL_HOLD.level, the celebratory family; holdForCard adds per-line time);
//   - it carries the in-game icon path (achievements/ingame/ach_{id}.png) as
//     plain data; the shell draws it and writes every name and line with
//     textContent, never as markup;
//   - names, lines, order and icon paths come only from the catalog
//     (content/achievements.js); ids are matched by exact string equality, with
//     no trimming and no case folding.
//
// No DOM, no window, no timers, no storage, no network, no clock. Nothing here
// touches rail.js state: it only reads RAIL_HOLD.

import { ACHIEVEMENTS } from "../../content/achievements.js";
import { RAIL_HOLD } from "./rail.js";

/**
 * ACHIEVEMENT_CARD_COPY — every chrome string this module owns, in one nested
 * object literal so the voice scan (test/voice/safety-scan.test.js) and the
 * voice corpus (tools/lib/voice-corpus.mjs) can walk it recursively.
 */
export const ACHIEVEMENT_CARD_COPY = deepFreeze({
  title: "ACHIEVEMENT",
  many: {
    title: "ACHIEVEMENTS",
    lead: "{n} at once. The dungeon keeps score and has run out of fingers.",
    hint: "Tap for the full ledger.",
  },
  strip: {
    label: "EARNED, POSTHUMOUSLY",
  },
});

/** More than this many pending at once collapse into one summary card. */
export const ACHIEVEMENT_COLLAPSE_OVER = 3;

/** Where the shell resolves an entry's `icon.ingame` path from, relative to the page. */
export const ACHIEVEMENT_ICON_DIR = "achievements/";

function deepFreeze(obj) {
  for (const v of Object.values(obj)) {
    if (v && typeof v === "object") deepFreeze(v);
  }
  return Object.freeze(obj);
}

// The catalog, resolved once: exact-string id -> entry. ACHIEVEMENTS is already
// in list order; `rank` is the position in that order, which is what every sort
// below uses (listOrder first, ties broken by id).
const BY_ID = new Map();
const RANK = new Map();
[...ACHIEVEMENTS]
  .sort((a, b) => a.listOrder - b.listOrder || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  .forEach((entry, i) => {
    BY_ID.set(entry.id, entry);
    RANK.set(entry.id, i);
  });

function resolve(entryOrId) {
  if (typeof entryOrId === "string") return BY_ID.get(entryOrId) || null;
  if (entryOrId && typeof entryOrId === "object" && typeof entryOrId.id === "string") {
    return BY_ID.get(entryOrId.id) || null;
  }
  return null;
}

function inListOrder(a, b) {
  return RANK.get(a.id) - RANK.get(b.id);
}

/**
 * achievementIconSrc(entryOrId) — ACHIEVEMENT_ICON_DIR plus the entry's
 * `icon.ingame` path, or null for an unknown entry.
 */
export function achievementIconSrc(entryOrId) {
  const entry = resolve(entryOrId);
  return entry ? ACHIEVEMENT_ICON_DIR + entry.icon.ingame : null;
}

/**
 * achievementCardFor(entryOrId) — the frozen single-unlock rail card, or null
 * for an unknown entry. Lines are [name, line] as plain text.
 */
export function achievementCardFor(entryOrId) {
  const entry = resolve(entryOrId);
  if (!entry) return null;
  return Object.freeze({
    kind: "achievement",
    icon: "★",
    iconKey: null,
    iconSrc: achievementIconSrc(entry),
    title: ACHIEVEMENT_CARD_COPY.title,
    lines: Object.freeze([
      Object.freeze({ text: entry.name, roll: null }),
      Object.freeze({ text: entry.line, roll: null }),
    ]),
    tone: "good",
    hold: RAIL_HOLD.level,
    achievementId: entry.id,
  });
}

/**
 * achievementSummaryCard(idsOrEntries) — the frozen many-at-once card: a lead
 * line, one line per name in catalog order, and a hint that a tap opens the
 * list. Duplicates collapse to one; null for fewer than 2 resolved entries.
 */
export function achievementSummaryCard(idsOrEntries) {
  if (!Array.isArray(idsOrEntries)) return null;
  const seen = new Set();
  const entries = [];
  for (const item of idsOrEntries) {
    const entry = resolve(item);
    if (entry && !seen.has(entry.id)) {
      seen.add(entry.id);
      entries.push(entry);
    }
  }
  if (entries.length < 2) return null;
  entries.sort(inListOrder);
  const { many } = ACHIEVEMENT_CARD_COPY;
  const texts = [many.lead.replace("{n}", String(entries.length)), ...entries.map((e) => e.name), many.hint];
  return Object.freeze({
    kind: "achievement-many",
    icon: "★",
    iconKey: null,
    iconSrc: achievementIconSrc(entries[0]),
    title: many.title,
    lines: Object.freeze(texts.map((text) => Object.freeze({ text, roll: null }))),
    tone: "good",
    hold: RAIL_HOLD.level,
    opensList: true,
    achievementIds: Object.freeze(entries.map((e) => e.id)),
  });
}
