// engine/saveState.js
//
// Save serialization + fail-closed load validation (ENG-04, save-tampering
// control T-01-06a). Ports mazeworld.html's save()/load() (lines 3182-3196),
// minus localStorage itself — this module defines WHAT is serializable and
// how untrusted bytes are validated; the browser/native storage adapter that
// actually reads/writes localStorage/@capacitor/preferences lives outside
// the engine (01-RESEARCH.md Architectural Responsibility Map).
//
// Unlike the prototype's save (which excluded seed/rngState and the store's
// closures), the engine's GameState is already 100% plain data end-to-end
// (01-05's applyAction + this plan's item/death extraction), so
// serializeRun keeps the FULL state — nothing needs to be dropped anymore.

import { STATE_VERSION } from "./state.js";
import { makeRng } from "./rng.js";

/**
 * serializeRun(state) — the full, JSON-serializable GameState, stamped with
 * the current STATE_VERSION.
 */
export function serializeRun(state) {
  return { ...state, version: STATE_VERSION };
}

/**
 * isValidCharacter(c) — the minimal shape `applyAction`'s rule modules
 * actually dereference on the very next action (`c.wp`/`c.maxWP` in
 * movement/combat math, `c.level` in strikeDie/level checks, `c.skills` in
 * every `skill()`/`skillTier()` lookup). A save whose `c` doesn't have at
 * least this shape is rejected outright rather than accepted and left to
 * crash `applyAction` later (CR-01).
 */
function isValidCharacter(c) {
  return (
    !!c &&
    typeof c === "object" &&
    !Array.isArray(c) &&
    typeof c.wp === "number" &&
    typeof c.maxWP === "number" &&
    typeof c.level === "number" &&
    !!c.skills &&
    typeof c.skills === "object" &&
    !Array.isArray(c.skills)
  );
}

/**
 * isValidFloor(f) — the minimal shape `move`/`teleport`/`descend` dereference
 * (`f.g[f.py][f.px]` on every step, `f.depth` for descend's bonus math). See
 * isValidCharacter's doc comment (CR-01).
 */
function isValidFloor(f) {
  return (
    !!f &&
    typeof f === "object" &&
    !Array.isArray(f) &&
    Array.isArray(f.g) &&
    typeof f.px === "number" &&
    typeof f.py === "number" &&
    Number.isInteger(f.depth)
  );
}

/**
 * validateSave(raw, options) — defensively parses an untrusted save (a JSON
 * string, or an already-parsed object) and checks its minimal required
 * shape. Never throws: malformed JSON or a save with a malformed/missing
 * `c`/`floor` returns `{ ok: false }` so the caller can fail closed to
 * `newRun` (V12). A save missing the newer `seed`/`rngState` fields (a
 * pre-refactor developer save) is NOT rejected — it gets safe defaults
 * instead, via `options.freshSeed` (a caller-supplied integer; defaults to
 * 1).
 *
 * @param {string|object} raw
 * @param {{ freshSeed?: number }} [options]
 * @returns {{ ok: true, value: object } | { ok: false, reason: string }}
 */
export function validateSave(raw, options = {}) {
  const freshSeed = typeof options.freshSeed === "number" ? options.freshSeed : 1;

  let obj;
  try {
    obj = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch (e) {
    return { ok: false, reason: "malformed JSON" };
  }

  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return { ok: false, reason: "save must be a non-null object" };
  }
  // MD-02: a save claiming a NEWER version than this build understands must
  // be rejected rather than silently re-stamped with the current
  // STATE_VERSION and validated against today's shape rules — that's exactly
  // how a future v1->v2 shape change would slip an incompatible save past
  // this function and into the same crash CR-01 fixed. A save with no
  // `version` at all (a pre-refactor save) or an older/equal version is
  // treated as version 1, today's only version, and validated normally; a
  // real migration step for v1->v2 would be added here once STATE_VERSION
  // bumps past 1.
  const claimedVersion = typeof obj.version === "number" ? obj.version : 1;
  if (claimedVersion > STATE_VERSION) {
    return { ok: false, reason: `save version ${claimedVersion} is newer than supported (${STATE_VERSION})` };
  }
  if (!isValidCharacter(obj.c)) {
    return { ok: false, reason: "save has a malformed character" };
  }
  if (!isValidFloor(obj.floor)) {
    return { ok: false, reason: "save has a malformed floor" };
  }

  const day = typeof obj.day === "number" ? obj.day : 1;
  const steps = typeof obj.steps === "number" ? obj.steps : 0;
  const seed = typeof obj.seed === "number" ? obj.seed : freshSeed;
  const rngState = typeof obj.rngState === "number" ? obj.rngState : makeRng(seed).getState();

  const value = {
    version: STATE_VERSION,
    seed,
    rngState,
    c: obj.c,
    floor: obj.floor,
    day,
    steps,
    dead: !!obj.dead,
    won: !!obj.won,
    deathNote: obj.deathNote || "",
    epitaph: obj.epitaph || "",
  };
  // MD-01: pass deathAt/lastWords through the validated value too, so a
  // terminal (dead/won) run's real save/load path — validateSave then
  // rehydrate() — doesn't lose them even though rehydrate() alone now
  // preserves them when present on its input.
  if (obj.deathAt !== undefined) value.deathAt = obj.deathAt;
  if (obj.lastWords !== undefined) value.lastWords = obj.lastWords;

  return { ok: true, value };
}

/**
 * rehydrate(obj) — turns a validated save (`validateSave(...).value`, or an
 * equally-shaped `serializeRun` output) into a GameState ready for
 * `applyAction`: combat/store/beats always reset to null (the prototype's
 * load() never resumed mid-combat or mid-store either).
 */
export function rehydrate(obj) {
  const state = {
    version: STATE_VERSION,
    seed: obj.seed,
    rngState: obj.rngState,
    c: obj.c,
    floor: obj.floor,
    day: obj.day ?? 1,
    steps: obj.steps ?? 0,
    combat: null,
    store: null,
    beats: null,
    dead: !!obj.dead,
    won: !!obj.won,
    deathNote: obj.deathNote || "",
    epitaph: obj.epitaph || "",
  };
  // MD-01: die()/winGame() also set deathAt/lastWords on a terminal run, and
  // serializeRun() (which spreads the FULL state) preserves them — round-trip
  // them here too rather than silently dropping a dead/won run's time-of-death
  // and "last words" on reload. Only added when present so a save that never
  // reached a terminal state doesn't gain spurious `undefined` fields.
  if (obj.deathAt !== undefined) state.deathAt = obj.deathAt;
  if (obj.lastWords !== undefined) state.lastWords = obj.lastWords;
  return state;
}
