// src/browser/scoreTag.js
//
// Phase 68 (PGS-03, D-01, D-16; 67 D-18): the public 64-character score tag
// every Play Games submission carries. Global rows read their displayed
// values (race, sub-class, level, cause, floor, day, steps, kills, gold, sp
// and the adventurer's name) back out of it, because the leaderboard's raw
// number is only an ordering key.
//
// Format (v1): twelve "."-separated fields in this fixed order —
//   v1.race.sub.lvl.cause.floor.day.steps.kills.gold.sp.name
// race/sub/cause are indices into the literal lists below (unknown values
// use the TAG_UNKNOWN sentinels); the seven numbers are plain decimal,
// truncated and clamped to TAG_FIELD_CAPS; the name is the only free text,
// "_" for spaces, fitted to whatever budget the numeric prefix leaves
// (never under 16 characters): full, else "First L.", else the first name
// cut short. Every character is URL-unreserved (A-Z a-z 0-9 - . _ ~).
// The death-screen stone text never rides here (67 D-18): it stays on the
// player's own device.
//
// Pure and deterministic; never throws. The only import is content data
// (content/classes.js, for classOfSub). The index lists are APPEND-ONLY
// literals, never derived from content key order at runtime, because a
// reorder would silently change what every already-submitted tag means.
// A new race, sub-class or cause is appended at the end; a breaking change
// means a v2 tag decoded side by side with v1.

import { CLASSES } from "../../content/classes.js";

export const TAG_VERSION = "v1";
export const TAG_MAX_LENGTH = 64;

/** Race indices (append-only). */
export const TAG_RACES = Object.freeze([
  "Human", "Elven", "Dwarven", "Wilmsry", "Fridgian", "Troll",
]);

/** Sub-class indices (append-only; the content/flavor.js SUB_NOTE order). */
export const TAG_SUBS = Object.freeze([
  "Knight", "Guard", "Woodsman", "Soldier", "Barbarian", "Master of Arms", "Samurai", "Bard",
  "Pickpocket", "Pilfer", "Cat Burglar", "Cutthroat", "Cloaker", "Ninja", "Con Artist", "Acrobat",
  "Wizard", "Warlock", "Sorcerer", "Court Mage", "Illusionist", "Cleric", "Summoner", "Apprentice",
]);

/** Cause-of-death indices (append-only; the content/epitaphs.js CAUSE_TEXT keys). */
export const TAG_CAUSES = Object.freeze([
  "combat", "starve", "trap", "teleport", "fall", "gorge", "backfire", "summon", "maze",
  "quake", "potion", "insanity", "poison", "abandon", "entombed",
  // RULES-09 (Phase 75.1): appended, never inserted — a Pilfer's magic-item fumble.
  "pilferFumble",
]);

/** The largest value each numeric field carries; anything above encodes the cap. */
export const TAG_FIELD_CAPS = Object.freeze({
  level: 99, floor: 999, day: 9999, steps: 99999, kills: 9999, gold: 999999, sp: 999999,
});

/** The index written for a race, sub-class or cause the lists do not know. */
export const TAG_UNKNOWN = Object.freeze({ race: 9, sub: 99, cause: 99 });

const NUMERIC_FIELDS = Object.freeze(["level", "floor", "day", "steps", "kills", "gold", "sp"]);
const TAG_RE = /^[A-Za-z0-9._~-]{1,64}$/;
const NUM_RE = /^\d{1,6}$/;

/**
 * classOfSub(sub) — the CLASSES key whose subs list includes `sub`, else "".
 * LINEAGE derives a global row's class from the tag's sub-class this way.
 */
export function classOfSub(sub) {
  if (typeof sub !== "string") return "";
  for (const cls of Object.keys(CLASSES)) {
    const subs = CLASSES[cls] && CLASSES[cls].subs;
    if (Array.isArray(subs) && subs.includes(sub)) return cls;
  }
  return "";
}

/**
 * tagName(name) — the name in tag form: NFKD-normalized and trimmed, each
 * whitespace run becomes "_", every character outside A-Z a-z 0-9 _ - is
 * dropped, repeated "_" collapse, and leading/trailing "_" are trimmed.
 */
export function tagName(name) {
  try {
    return String(name ?? "")
      .normalize("NFKD")
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^A-Za-z0-9_-]/g, "")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
  } catch {
    return "";
  }
}

/**
 * fitName(tagged, budget) — a tag-form name fitted to `budget` characters:
 * the whole name when it fits; else "First_L." when there are two or more
 * words and that fits; else the first word cut to the budget (no ellipsis).
 */
export function fitName(tagged, budget) {
  const s = typeof tagged === "string" ? tagged : "";
  const b = typeof budget === "number" && Number.isFinite(budget) ? Math.trunc(budget) : 0;
  if (b < 1 || s === "") return "";
  if (s.length <= b) return s;
  const words = s.split("_").filter((w) => w !== "");
  if (words.length >= 2) {
    const short = `${words[0]}_${words[words.length - 1][0]}.`;
    if (short.length <= b) return short;
  }
  return (words[0] || s).slice(0, b);
}

/** num(x, cap) — module-private: a finite number truncated and clamped to 0..cap, else 0. */
function num(x, cap) {
  if (typeof x !== "number" || !Number.isFinite(x)) return 0;
  return Math.min(cap, Math.max(0, Math.trunc(x)));
}

/** indexOr(list, value, unknown) — module-private: the list index of a string, else the sentinel. */
function indexOr(list, value, unknown) {
  const i = typeof value === "string" ? list.indexOf(value) : -1;
  return i >= 0 ? i : unknown;
}

/**
 * encodeTag(summary) — the v1 score tag for a run summary (engine/death.js
 * buildRunSummary's shape). Reads only race, sub, level, cause, floor, day,
 * steps, kills, gold, sp and name. Always at most TAG_MAX_LENGTH characters.
 * @returns {string}
 */
export function encodeTag(summary) {
  const s = summary && typeof summary === "object" ? summary : {};
  const fields = [
    TAG_VERSION,
    indexOr(TAG_RACES, s.race, TAG_UNKNOWN.race),
    indexOr(TAG_SUBS, s.sub, TAG_UNKNOWN.sub),
    num(s.level, TAG_FIELD_CAPS.level),
    indexOr(TAG_CAUSES, s.cause, TAG_UNKNOWN.cause),
    num(s.floor, TAG_FIELD_CAPS.floor),
    num(s.day, TAG_FIELD_CAPS.day),
    num(s.steps, TAG_FIELD_CAPS.steps),
    num(s.kills, TAG_FIELD_CAPS.kills),
    num(s.gold, TAG_FIELD_CAPS.gold),
    num(s.sp, TAG_FIELD_CAPS.sp),
  ];
  const prefix = `${fields.join(".")}.`;
  // The prefix is at most 48 characters (every field at its cap or
  // sentinel width), so the name budget never drops below 16.
  return prefix + fitName(tagName(s.name), TAG_MAX_LENGTH - prefix.length);
}

/**
 * decodeTag(tag) — a frozen { v: 1, race, sub, cls, level, cause, floor,
 * day, steps, kills, gold, sp, name } from a v1 tag, or null for anything
 * that is not one (wrong type, empty, over 64 characters, a character
 * outside the unreserved set, another version, under twelve fields, or a
 * number field that is not 1-6 digits). Out-of-range indices decode to "";
 * numbers are clamped to TAG_FIELD_CAPS. Tags arrive from other players via
 * Google's servers and are treated as untrusted. Never throws.
 */
export function decodeTag(tag) {
  try {
    if (typeof tag !== "string" || !TAG_RE.test(tag)) return null;
    const parts = tag.split(".");
    if (parts.length < 12 || parts[0] !== TAG_VERSION) return null;
    for (let i = 1; i <= 10; i++) {
      if (!NUM_RE.test(parts[i])) return null;
    }
    const at = (i) => Number(parts[i]);
    const race = TAG_RACES[at(1)] ?? "";
    const sub = TAG_SUBS[at(2)] ?? "";
    const cause = TAG_CAUSES[at(4)] ?? "";
    const numbers = {};
    const positions = [3, 5, 6, 7, 8, 9, 10];
    NUMERIC_FIELDS.forEach((k, j) => {
      numbers[k] = Math.min(TAG_FIELD_CAPS[k], at(positions[j]));
    });
    return Object.freeze({
      v: 1,
      race,
      sub,
      cls: classOfSub(sub),
      level: numbers.level,
      cause,
      floor: numbers.floor,
      day: numbers.day,
      steps: numbers.steps,
      kills: numbers.kills,
      gold: numbers.gold,
      sp: numbers.sp,
      name: parts.slice(11).join(".").replace(/_/g, " "),
    });
  } catch {
    return null;
  }
}
