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
 * validateSave(raw, options) — defensively parses an untrusted save (a JSON
 * string, or an already-parsed object) and checks its minimal required
 * shape. Never throws: malformed JSON or a save missing `c`/`floor` returns
 * `{ ok: false }` so the caller can fail closed to `newRun` (V12). A save
 * missing the newer `seed`/`rngState` fields (a pre-refactor developer save)
 * is NOT rejected — it gets safe defaults instead, via
 * `options.freshSeed` (a caller-supplied integer; defaults to 1).
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
  if (!obj.c || typeof obj.c !== "object") {
    return { ok: false, reason: "save missing character (c)" };
  }
  if (!obj.floor || typeof obj.floor !== "object") {
    return { ok: false, reason: "save missing floor" };
  }

  const day = typeof obj.day === "number" ? obj.day : 1;
  const steps = typeof obj.steps === "number" ? obj.steps : 0;
  const seed = typeof obj.seed === "number" ? obj.seed : freshSeed;
  const rngState = typeof obj.rngState === "number" ? obj.rngState : makeRng(seed).getState();

  return {
    ok: true,
    value: {
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
    },
  };
}

/**
 * rehydrate(obj) — turns a validated save (`validateSave(...).value`, or an
 * equally-shaped `serializeRun` output) into a GameState ready for
 * `applyAction`: combat/store/beats always reset to null (the prototype's
 * load() never resumed mid-combat or mid-store either).
 */
export function rehydrate(obj) {
  return {
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
}
