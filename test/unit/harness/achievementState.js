// test/unit/harness/achievementState.js
//
// Phase 99 (TRACK-03..05). Test-only, shared on purpose: the minimal state,
// event and record builders that every achievement tracker test in the phase
// uses, so the tests state only what they care about. The state carries just
// the fields src/browser/achievementTracker.js reads (dev, seed, day, steps,
// floor.depth, c.name, c.race, c.cls, c.sub, c.gold, c.weapon, c.armor,
// c.worn); it is not a real GameState and never goes near the engine.

import { emptyRecord, sanitizeRecord, RECORD_VERSION } from "../../../src/browser/achievementRecord.js";

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** deepMerge(base, over) — plain objects merge key by key; arrays and scalars in `over` replace. */
function deepMerge(base, over) {
  if (!isPlainObject(base) || !isPlainObject(over)) return over === undefined ? base : over;
  const out = { ...base };
  for (const key of Object.keys(over)) {
    out[key] = isPlainObject(base[key]) && isPlainObject(over[key]) ? deepMerge(base[key], over[key]) : over[key];
  }
  return out;
}

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

/** mkState(overrides) — a minimal plain state; `overrides.c` and `overrides.floor` merge deeply, other keys replace. */
export function mkState(overrides = {}) {
  const base = {
    seed: 1,
    dev: false,
    day: 1,
    steps: 0,
    floor: { depth: 1 },
    c: {
      name: "Test Delver",
      race: "Human",
      cls: "Fighter",
      sub: "Soldier",
      gold: 0,
      weapon: "Club",
      armor: "Leather",
      worn: {},
    },
  };
  const { c, floor, ...rest } = overrides;
  return {
    ...base,
    ...rest,
    floor: deepMerge(base.floor, floor || {}),
    c: deepMerge(base.c, c || {}),
  };
}

/** ev(type, fields) — one engine event object. */
export function ev(type, fields = {}) {
  return { type, ...fields };
}

/** seedRecord(partial) — a sanitized v1 record: emptyRecord() with `partial` merged in deeply. */
export function seedRecord(partial = {}) {
  const merged = deepMerge(clone(emptyRecord()), { ...partial, v: RECORD_VERSION });
  return sanitizeRecord(merged);
}

/** deepFreeze(value) — freezes recursively and returns the value. */
export function deepFreeze(value) {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}
