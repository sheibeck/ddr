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
    // Quick 261005-vn5: the death screen line on the death that reveals a death-revealed secret.
    // It points at floor 1 and never names the achievement.
    hint: "Somewhere up there, a hero died on floor 1 and got a prize for it. You went deeper. Nobody gave you anything.",
  },
});

/** More than this many pending at once collapse into one summary card. */
export const ACHIEVEMENT_COLLAPSE_OVER = 3;

/** Where the shell resolves an entry's `icon.ingame` path from, relative to the page. */
export const ACHIEVEMENT_ICON_DIR = "achievements/";

/** Where the 320 px large-view exports live, relative to the page (quick 261005-vhn). */
export const ACHIEVEMENT_LARGE_DIR = "achievements/large/";

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
 * achievementLargeSrc(entryOrId) — ACHIEVEMENT_LARGE_DIR plus the stem of the
 * entry's `icon.ingame` file (the same ach_<id>.png name, 320 x 320), or null
 * for an unknown entry. Quick 261005-vhn: the sharp art the list's large view
 * shows for an earned entry.
 */
export function achievementLargeSrc(entryOrId) {
  const entry = resolve(entryOrId);
  return entry ? ACHIEVEMENT_LARGE_DIR + entry.icon.ingame.split("/").pop() : null;
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

// ---------------------------------------------------------------------------
// The pending queue and the drain gate
//
// The adapter hands the shell an unlock payload whenever an action earns
// something. The shell enqueues the ids here and asks `bannerNext` for a card
// each time the rail may take one. The queue only dedupes what is PENDING: it
// is the Phase 99 tracker that guarantees an unlock fires once, so an id that
// was already shown and cleared is never offered again by the tracker.
// Everything returned is frozen and the inputs are never mutated.
// ---------------------------------------------------------------------------

const EMPTY_QUEUE = Object.freeze({ pending: Object.freeze([]) });

/** emptyBannerQueue() — the frozen zero queue: nothing pending. */
export function emptyBannerQueue() {
  return EMPTY_QUEUE;
}

function pendingOf(queue) {
  if (!queue || typeof queue !== "object" || !Array.isArray(queue.pending)) return null;
  return queue.pending;
}

function makeQueue(ids) {
  return Object.freeze({ pending: Object.freeze(ids) });
}

/**
 * bannerEnqueue(queue, unlocks) — a frozen queue holding the old pending ids
 * plus every `unlocks[i].id` that is a catalog id and not already pending,
 * in catalog list order. Only the `unlocks` array is read: a reveal never
 * reaches this function, so a secret can never be named before it is earned.
 * Returns the very same queue object when nothing is added; a null or
 * malformed queue reads as the empty queue.
 */
export function bannerEnqueue(queue, unlocks) {
  const base = pendingOf(queue);
  const have = new Set(base ? base.filter((id) => typeof id === "string" && BY_ID.has(id)) : []);
  const before = have.size;
  if (Array.isArray(unlocks)) {
    for (const item of unlocks) {
      if (item && typeof item === "object" && typeof item.id === "string" && BY_ID.has(item.id)) have.add(item.id);
    }
  }
  if (have.size === before) return base ? queue : EMPTY_QUEUE;
  return makeQueue([...have].sort((a, b) => RANK.get(a) - RANK.get(b)));
}

function isTrue(v) {
  return v === true;
}

/**
 * earnedStripView(ids) — the death screen's Earned strip: null when no id
 * resolves, otherwise a frozen { label, items: [{ id, name, iconSrc }] } in
 * catalog list order (duplicates collapse to one).
 */
export function earnedStripView(ids) {
  if (!Array.isArray(ids)) return null;
  const seen = new Set();
  const entries = [];
  for (const id of ids) {
    const entry = resolve(id);
    if (entry && !seen.has(entry.id)) {
      seen.add(entry.id);
      entries.push(entry);
    }
  }
  if (entries.length === 0) return null;
  entries.sort(inListOrder);
  return Object.freeze({
    label: ACHIEVEMENT_CARD_COPY.strip.label,
    items: Object.freeze(
      entries.map((e) => Object.freeze({ id: e.id, name: e.name, iconSrc: achievementIconSrc(e) })),
    ),
  });
}

/**
 * deathHintFor(payload) — the death screen hint line (ACHIEVEMENT_CARD_COPY.strip.hint) when this
 * action's payload ({ unlocks, reveals }) reveals a Hidden entry whose catalog `revealOn` is
 * { kind: "realDeath" } WITHOUT unlocking it (a death that earns it shows it in the Earned strip
 * instead). Null otherwise. Total: a malformed payload reads as nothing. Quick 261005-vn5.
 */
export function deathHintFor(payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  const earned = new Set((Array.isArray(p.unlocks) ? p.unlocks : []).map((u) => (u && typeof u === "object" ? u.id : null)));
  for (const id of Array.isArray(p.reveals) ? p.reveals : []) {
    const entry = typeof id === "string" ? BY_ID.get(id) : null;
    if (entry && entry.initialState === "Hidden" && entry.revealOn && entry.revealOn.kind === "realDeath" && !earned.has(id)) {
      return ACHIEVEMENT_CARD_COPY.strip.hint;
    }
  }
  return null;
}

/**
 * bannerNext(queue, ctx) — what may be shown now. Returns a frozen
 * { queue, card, strip }. ctx fields are booleans and only a strict `true`
 * counts for each: `ready` (a hero is loaded and the dungeon is visible),
 * `fighting`, `dead`, `fade` (the stairs fade), `decision` (a decision is
 * pending) and `railBusy` (a rail card is up). A missing or non-object ctx has
 * `ready` false, which blocks: the safe default is to show nothing. A store or
 * loot screen is NOT a blocker, so the card behaves there as the rail does.
 *
 * Rules, in this order:
 *   1. dead: no card; the strip holds everything pending; the queue empties
 *      (this wins over every other flag, a fight still showing included);
 *   2. not ready, or fighting, fade, decision or railBusy, or nothing
 *      pending: no card, no strip, the same queue object;
 *   3. more than ACHIEVEMENT_COLLAPSE_OVER pending: one summary card, the
 *      queue empties;
 *   4. otherwise: the first pending id as a card, the rest stay queued.
 */
export function bannerNext(queue, ctx) {
  const pending = pendingOf(queue);
  const ids = pending ? pending.filter((id) => typeof id === "string" && BY_ID.has(id)) : [];
  const c = ctx && typeof ctx === "object" ? ctx : {};
  const same = pending ? queue : EMPTY_QUEUE;

  if (isTrue(c.dead)) {
    return Object.freeze({ queue: EMPTY_QUEUE, card: null, strip: earnedStripView(ids) });
  }
  if (!isTrue(c.ready) || isTrue(c.fighting) || isTrue(c.fade) || isTrue(c.decision) || isTrue(c.railBusy) || ids.length === 0) {
    return Object.freeze({ queue: same, card: null, strip: null });
  }
  if (ids.length > ACHIEVEMENT_COLLAPSE_OVER) {
    return Object.freeze({ queue: EMPTY_QUEUE, card: achievementSummaryCard(ids), strip: null });
  }
  return Object.freeze({ queue: makeQueue(ids.slice(1)), card: achievementCardFor(ids[0]), strip: null });
}
