// src/browser/achievementsSheet.js
//
// Phase 100 (AUI-02, AUI-03): the pure core of the hamburger menu's
// ACHIEVEMENTS list. A copy bank, the block and track structure, date and
// progress formatting, the counts, the view model that turns a lifetime
// record into rows, and a DOM renderer that reads correctly under TalkBack.
// No window, no storage, no clock, no timers: plan 100-03 mounts it.
//
// Rulings from Phase 100 CONTEXT ("The achievements list") implemented here:
//   - one row per TRACK, grouped under the seven catalog blocks (The descent,
//     Dressing for it, Who you are, Staying alive, Company, Body counts,
//     Dying). A tiered track shows the icon of the highest tier earned (tier I
//     greyed when none), an I to IV ladder and the next rung's progress such
//     as "37 / 50 kills"; the depth ladder and Unicorn! read as ONE track of
//     four rungs (TRACK_JOINS);
//   - locked rows are greyed and show the Play description plus progress where
//     the entry has some (incremental entries only, via progressFor in
//     achievementTracker.js); unlocked rows show the sarcastic line and the
//     date earned;
//   - the single-run tracks (depth, days, wilmst held) read as the best run so
//     far ("best: floor 7 / 10"), the same value Play's set-steps will show;
//   - a Hidden entry is a "Secret" row (teaser line, its own icon as a
//     silhouette) until it is unlocked or revealed, and the header counts the
//     secrets still undiscovered. A secret row exposes nothing of the real
//     achievement: row keys are opaque "t{listOrder}" strings, never ids;
//   - no fact rides on colour, a greyed icon or a glyph alone: the same fact
//     is always in the row's text, and the icons are decorative.
//
// 35 rows, not 36: CONTEXT says 36 rows but also says "the depth ladder and
// Unicorn! read as one track of four rungs". The catalog derives 35 tracks
// (13 four-tier tracks, the depth-and-Unicorn! track and 21 single
// achievements), and the structural rule wins. The row count is computed from
// the catalog and never hard-coded.
//
// Read-only: the view model and the renderer never write, reset, re-lock,
// back-fill or repair anything in the record, and nothing here reaches storage.
// The renderer builds DOM only through host.ownerDocument with createElement,
// createTextNode, textContent and setAttribute.

import { ACHIEVEMENTS } from "../../content/achievements.js";
import { progressFor } from "./achievementTracker.js";
import { emptyRecord, sanitizeRecord } from "./achievementRecord.js";
import { achievementIconSrc } from "./achievementCard.js";

function deepFreeze(value) {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}

/**
 * ACHIEVEMENTS_SHEET_COPY — every chrome string this module owns, in one
 * nested object literal so the voice scan (test/voice/safety-scan.test.js) and
 * the voice corpus (tools/lib/voice-corpus.mjs) can walk it recursively.
 * British spelling; the player's words (wilmst, floor, Joiner, parleys).
 */
export const ACHIEVEMENTS_SHEET_COPY = deepFreeze({
  title: "ACHIEVEMENTS",
  earned: "{n} of {total} earned",
  menuCount: "{n} / {total}",
  secrets: {
    none: "No secrets left. Thorough, in a slightly worrying way.",
    one: "1 secret still hiding",
    many: "{n} secrets still hiding",
  },
  blocks: {
    descent: "The descent",
    dressing: "Dressing for it",
    who: "Who you are",
    alive: "Staying alive",
    company: "Company",
    bodies: "Body counts",
    dying: "Dying",
  },
  state: {
    earned: "Earned {date}",
    earnedNoDate: "Earned. Nobody wrote down when.",
    locked: "Locked",
    partial: "{n} of {total} tiers earned",
    complete: "All {total} tiers earned",
  },
  secret: {
    name: "Secret",
    line: "Some achievements are shy. This one will introduce itself when it is good and ready.",
  },
  tier: {
    label: "Tier {tier}",
    next: "Next: tier {tier}",
  },
  progress: {
    count: "{value} / {steps} {unit}",
    bestFloor: "best: floor {value} / {steps}",
    best: "best: {value} / {steps} {unit}",
  },
  units: {
    kills: "kills",
    deaths: "deaths",
    joinersAccepted: "Joiners",
    joinersFallen: "Joiners fallen",
    parleysWon: "parleys won",
    trapsSurvived: "traps survived",
    days: "days",
    wilmstHeld: "wilmst held",
    subClasses: "sub-classes",
  },
  expand: "Tap for every tier",
  collapse: "Tap to fold it away",
});

/** The tier numerals of a ladder. Not copy: they are labels, not sentences. */
export const TIER_NUMERALS = Object.freeze(["I", "II", "III", "IV"]);

// Month abbreviations for formatEarnedDate. Not copy: they are not sentences.
const MONTHS = Object.freeze(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]);

/**
 * ACHIEVEMENT_BLOCKS — the seven Phase 98 list blocks, by catalog listOrder
 * range. `id` is also the key into the bank's `blocks`.
 */
export const ACHIEVEMENT_BLOCKS = Object.freeze(
  [
    { id: "descent", firstOrder: 10, lastOrder: 60 },
    { id: "dressing", firstOrder: 70, lastOrder: 100 },
    { id: "who", firstOrder: 110, lastOrder: 200 },
    { id: "alive", firstOrder: 210, lastOrder: 340 },
    { id: "company", firstOrder: 350, lastOrder: 470 },
    { id: "bodies", firstOrder: 480, lastOrder: 710 },
    { id: "dying", firstOrder: 720, lastOrder: 770 },
  ].map((b) => Object.freeze(b)),
);

/** TRACK_JOINS — a single entry that joins another track as its last rung. */
export const TRACK_JOINS = Object.freeze({ unicorn: "depth" });

function fill(template, values) {
  return String(template).replace(/\{(\w+)\}/g, (whole, key) => (Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : whole));
}

function byListOrder(a, b) {
  return a.listOrder - b.listOrder || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/**
 * tracksOf(catalog) — the catalog grouped into tracks, sorted by the first
 * entry's listOrder. A tiered entry (tier 1 to 4) belongs to the track named
 * by its id without the _t{tier} suffix; an id in TRACK_JOINS joins the named
 * track as its last rung; every other entry is a one-entry track keyed by its
 * own id. Entries run in tier order, the joined rung last. The catalog's own
 * entries are never altered.
 */
export function tracksOf(catalog = ACHIEVEMENTS) {
  const sorted = [...(Array.isArray(catalog) ? catalog : [])].sort(byListOrder);
  const map = new Map();
  const joins = [];
  for (const entry of sorted) {
    if (Object.prototype.hasOwnProperty.call(TRACK_JOINS, entry.id)) {
      joins.push(entry);
      continue;
    }
    const tiered = Number.isInteger(entry.tier) && entry.tier >= 1 && entry.tier <= 4;
    const key = tiered ? entry.id.replace(new RegExp(`_t${entry.tier}$`), "") : entry.id;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(entry);
  }
  for (const entry of joins) {
    const key = TRACK_JOINS[entry.id];
    if (map.has(key)) map.get(key).push(entry);
    else map.set(entry.id, [entry]);
  }
  const tracks = [...map].map(([key, entries]) => Object.freeze({ key, entries: Object.freeze(entries) }));
  tracks.sort((a, b) => a.entries[0].listOrder - b.entries[0].listOrder);
  return Object.freeze(tracks);
}

/**
 * formatEarnedDate(at, tzOffsetMinutes) — "D Mon YYYY" for an unlock time, or
 * null for a non-finite, zero or negative time. tzOffsetMinutes is what
 * Date.prototype.getTimezoneOffset() returns (minutes the local time is behind
 * UTC); a non-finite offset reads as 0. A pure function of its arguments.
 */
export function formatEarnedDate(at, tzOffsetMinutes) {
  if (typeof at !== "number" || !Number.isFinite(at) || at <= 0) return null;
  const offset = typeof tzOffsetMinutes === "number" && Number.isFinite(tzOffsetMinutes) ? tzOffsetMinutes : 0;
  const d = new Date(at - offset * 60000);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

const BY_ID = new Map(ACHIEVEMENTS.map((e) => [e.id, e]));
const HIDDEN = Object.freeze(ACHIEVEMENTS.filter((e) => e.initialState === "Hidden"));
const DEFAULT_TRACKS = tracksOf(ACHIEVEMENTS);

/** Any value in, a complete record out; a throw while sanitising reads as the empty record. */
function safeRecord(record) {
  try {
    return sanitizeRecord(record);
  } catch {
    return emptyRecord();
  }
}

function has(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

/**
 * progressText(record, entry) — the progress reading for an incremental
 * catalog entry, or null for a standard or unknown entry. The numbers come
 * from progressFor (value clamped to the steps); the units come from the bank.
 */
export function progressText(record, entry) {
  const known = entry && typeof entry === "object" && typeof entry.id === "string" ? BY_ID.get(entry.id) : null;
  if (!known) return null;
  let p;
  try {
    p = progressFor(record, known);
  } catch {
    return null;
  }
  if (!p) return null;
  const P = ACHIEVEMENTS_SHEET_COPY.progress;
  const U = ACHIEVEMENTS_SHEET_COPY.units;
  const t = known.trigger || {};
  const values = { value: p.value, steps: p.steps };
  if (t.kind === "singleRunBest") {
    if (t.metric === "depth") return fill(P.bestFloor, values);
    const unit = t.metric === "days" ? U.days : t.metric === "wilmstHeld" ? U.wilmstHeld : null;
    return unit === null ? null : fill(P.best, { ...values, unit });
  }
  if (t.kind === "lifetimeCounter") {
    const unit = t.counter === "kills" ? U.kills : has(U, t.counter) ? U[t.counter] : null;
    return unit === null ? null : fill(P.count, { ...values, unit });
  }
  if (t.kind === "distinctSetCount") return fill(P.count, { ...values, unit: U.subClasses });
  return null;
}

/** earnedCount(record) — how many catalog ids are in record.unlocked. */
export function earnedCount(record) {
  const rec = safeRecord(record);
  return ACHIEVEMENTS.reduce((n, e) => (has(rec.unlocked, e.id) ? n + 1 : n), 0);
}

/** secretCount(record) — Hidden entries neither unlocked nor revealed. */
export function secretCount(record) {
  const rec = safeRecord(record);
  return HIDDEN.reduce((n, e) => (has(rec.unlocked, e.id) || rec.revealed.includes(e.id) ? n : n + 1), 0);
}

/** menuCountText(record) — the menu row's "12 / 77": earned over the catalog size, from the record only. */
export function menuCountText(record) {
  return fill(ACHIEVEMENTS_SHEET_COPY.menuCount, { n: earnedCount(record), total: ACHIEVEMENTS.length });
}
