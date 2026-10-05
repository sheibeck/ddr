// src/browser/achievementRecord.js
//
// Phase 99 (TRACK-02). The lifetime stats record behind the 77 achievements
// in content/achievements.js: the one value stored under ACHIEVEMENTS_KEY
// (ddr.achievements.v1), kept apart from the run save (ddr.delve.v1). The
// record is a single JSON value, so a counter and the unlock it earns always
// travel together in one write and can never be split across writes.
//
// What it holds (every key is always present):
//   v                 RECORD_VERSION (1)
//   counters          deaths (abandons excluded), joinersAccepted,
//                     joinersFallen, parleysWon, trapsSurvived
//   kills             one count per BESTIARY family key, in BESTIARY order
//   bests             depth, days, wilmstHeld, fleesWon (single-run bests),
//                     depthByRace and depthByClass (best depth per RACES key
//                     and per parent CLASSES key)
//   flags             diseaseLeftOnOneHp, poisonLeftOnOneHp (lifetime)
//   subClassesDelved  distinct sub-class names a delve was started with, in
//                     first-seen order
//   unlocked          catalog id -> unlock time (integer epoch milliseconds)
//   revealed          ids of Hidden catalog entries, in reveal order
//   run               null, or the current-run progress tagged to its run:
//                     { tag, seen, stepped, naked, teetotal, fleesWon }
//
// Loading is tolerant and greenfield: a missing, empty, corrupt, non-object
// or older-shape (v not 1) value loads as all zeros. There is no legacy path
// and no credit from the graveyard or the bests history; a fresh 2.5.0 starts
// at zero. A v1 record with some bad fields keeps every valid field and
// zeroes only the bad ones. An unlock is never dropped: a catalog id with a
// bad time keeps its unlock at time 0.
//
// Every record this module returns is deep-frozen, so a caller can never
// mutate it. Pure and DOM-free: no storage, no clock, no random source. The
// engine adapter (plan 99-03) owns reading and writing the key through
// src/browser/storage.js.

import { ACHIEVEMENTS } from "../../content/achievements.js";
import { BESTIARY } from "../../content/bestiary.js";
import { RACES } from "../../content/races.js";
import { CLASSES } from "../../content/classes.js";

export const ACHIEVEMENTS_KEY = "ddr.achievements.v1";
export const RECORD_VERSION = 1;

const COUNTER_KEYS = Object.freeze(["deaths", "joinersAccepted", "joinersFallen", "parleysWon", "trapsSurvived"]);
const BEST_KEYS = Object.freeze(["depth", "days", "wilmstHeld", "fleesWon"]);
const FLAG_KEYS = Object.freeze(["diseaseLeftOnOneHp", "poisonLeftOnOneHp"]);
const KILL_KEYS = Object.freeze(Object.keys(BESTIARY));
const RACE_KEYS = Object.freeze(Object.keys(RACES));
const CLASS_KEYS = Object.freeze(Object.keys(CLASSES));
const SUB_CLASS_NAMES = new Set(Object.values(CLASSES).flatMap((cls) => (Array.isArray(cls.subs) ? cls.subs : [])));

// Catalog order is the canonical key order of `unlocked`, so a serialized
// record is byte-stable whichever order the unlocks were earned in.
const CATALOG = Object.freeze([...ACHIEVEMENTS].sort((a, b) => a.listOrder - b.listOrder || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)));
const HIDDEN_IDS = new Set(CATALOG.filter((a) => a.initialState === "Hidden").map((a) => a.id));

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** num(v) — the numeric rule: a finite number at least 0, floored and capped at MAX_SAFE_INTEGER; anything else is 0. */
function num(v) {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return 0;
  return Math.min(Math.floor(v), Number.MAX_SAFE_INTEGER);
}

function deepFreeze(value) {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}

function zeroMap(keys) {
  const out = {};
  for (const k of keys) out[k] = 0;
  return out;
}

function numMap(keys, raw) {
  const src = isPlainObject(raw) ? raw : {};
  const out = {};
  for (const k of keys) out[k] = num(src[k]);
  return out;
}

function buildEmpty() {
  return {
    v: RECORD_VERSION,
    counters: zeroMap(COUNTER_KEYS),
    kills: zeroMap(KILL_KEYS),
    bests: {
      depth: 0,
      days: 0,
      wilmstHeld: 0,
      fleesWon: 0,
      depthByRace: zeroMap(RACE_KEYS),
      depthByClass: zeroMap(CLASS_KEYS),
    },
    flags: { diseaseLeftOnOneHp: false, poisonLeftOnOneHp: false },
    subClassesDelved: [],
    unlocked: {},
    revealed: [],
    run: null,
  };
}

/** emptyRecord() — the all-zeros record (every key present), deep-frozen. */
export function emptyRecord() {
  return deepFreeze(buildEmpty());
}

/**
 * sanitizeRecord(raw) — any value in, a complete deep-frozen v1 record out.
 * A non-object or a `v` other than 1 is the empty record; otherwise every
 * field is kept or zeroed on its own.
 */
export function sanitizeRecord(raw) {
  if (!isPlainObject(raw) || raw.v !== RECORD_VERSION) return emptyRecord();

  const counters = numMap(COUNTER_KEYS, raw.counters);
  const kills = numMap(KILL_KEYS, raw.kills);
  const rawBests = isPlainObject(raw.bests) ? raw.bests : {};
  const bests = {
    ...numMap(BEST_KEYS, rawBests),
    depthByRace: numMap(RACE_KEYS, rawBests.depthByRace),
    depthByClass: numMap(CLASS_KEYS, rawBests.depthByClass),
  };
  const rawFlags = isPlainObject(raw.flags) ? raw.flags : {};
  const flags = {};
  for (const k of FLAG_KEYS) flags[k] = rawFlags[k] === true;

  const subClassesDelved = [];
  if (Array.isArray(raw.subClassesDelved)) {
    for (const name of raw.subClassesDelved) {
      if (typeof name === "string" && SUB_CLASS_NAMES.has(name) && !subClassesDelved.includes(name)) subClassesDelved.push(name);
    }
  }

  const unlocked = {};
  const rawUnlocked = isPlainObject(raw.unlocked) ? raw.unlocked : {};
  for (const entry of CATALOG) {
    if (Object.prototype.hasOwnProperty.call(rawUnlocked, entry.id)) unlocked[entry.id] = num(rawUnlocked[entry.id]);
  }

  const revealed = [];
  if (Array.isArray(raw.revealed)) {
    for (const id of raw.revealed) {
      if (typeof id === "string" && HIDDEN_IDS.has(id) && !revealed.includes(id)) revealed.push(id);
    }
  }
  // An unlocked Hidden entry is always revealed.
  for (const entry of CATALOG) {
    if (HIDDEN_IDS.has(entry.id) && Object.prototype.hasOwnProperty.call(unlocked, entry.id) && !revealed.includes(entry.id)) revealed.push(entry.id);
  }

  let run = null;
  if (isPlainObject(raw.run) && typeof raw.run.tag === "string" && raw.run.tag.length > 0) {
    run = {
      tag: raw.run.tag,
      seen: raw.run.seen === true,
      stepped: raw.run.stepped === true,
      naked: raw.run.naked === true,
      teetotal: raw.run.teetotal === true,
      fleesWon: num(raw.run.fleesWon),
    };
  }

  return deepFreeze({ v: RECORD_VERSION, counters, kills, bests, flags, subClassesDelved, unlocked, revealed, run });
}

/** parseRecord(text) — the stored string to a record; anything unreadable is the empty record. */
export function parseRecord(text) {
  if (typeof text !== "string" || text.length === 0) return emptyRecord();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return emptyRecord();
  }
  return sanitizeRecord(parsed);
}

/** serializeRecord(record) — the string stored under ACHIEVEMENTS_KEY. */
export function serializeRecord(record) {
  return JSON.stringify(record);
}
