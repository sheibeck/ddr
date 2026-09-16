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
 * sanitizeParty(raw) — fail-open normalization of an untrusted `party` field
 * (PARTY-02 migration). A missing or non-array `party` (a pre-Phase-7 save, or
 * a tampered `party:"x"`) becomes `[]`; individual members that don't meet the
 * same minimal character shape `isValidCharacter` demands (e.g. `party:[null]`)
 * are DROPPED rather than accepted. This never throws and never rejects the
 * whole save — a malformed roster degrades to an empty/partial party instead of
 * nuking an otherwise-loadable in-progress run (research SUMMARY: "fail-open on
 * malformed party data ... never nuke an in-progress run"). Additive-with-
 * default, so no STATE_VERSION bump is required.
 */
function sanitizeParty(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter((m) => isValidCharacter(m));
}

/**
 * defaultBagForClass(cls) — the chargen bag tier a class is issued (rulebook
 * p.10), the single migration default: Fighter = "medium", everything else
 * (Magic User, Thief, or an UNKNOWN/missing class) = "small". Mirrors the
 * plain class-derived assignment in engine/character.js's rollCharacter.
 */
function defaultBagForClass(cls) {
  return cls === "Fighter" ? "medium" : "small";
}

/**
 * sanitizeLoot(raw) — Phase 29 (LOOT-06): fail-open normalization of an
 * untrusted `pendingLoot` field, mirroring sanitizeParty's precedent above.
 * A pre-v1.3 save has no field at all (or a tampered non-array value like
 * `"x"`/`42`/`{}`) — that degrades to `[]` rather than rejecting the whole
 * save. Malformed entries (`null`, a non-object, an array) inside an
 * otherwise-valid array are dropped, never crash the load. No STATE_VERSION
 * bump — purely additive.
 */
function sanitizeLoot(raw) {
  return Array.isArray(raw) ? raw.filter((it) => it && typeof it === "object" && !Array.isArray(it)) : [];
}

/**
 * migrateCarry(c) — ECON-01 (Phase 12) additive-with-default migration,
 * mirroring the sanitizeParty precedent (PARTY-02): a pre-Phase-12 save has no
 * `c.bag`, so default it by class (Fighter=medium, else small; "small" if the
 * class is unknown). Only fills a MISSING bag — a save that already carries a
 * valid `c.bag` is left untouched. Never throws; requires NO STATE_VERSION bump
 * (purely additive default). Mutates and returns the passed `c`.
 */
function migrateCarry(c) {
  if (c && typeof c === "object" && !Array.isArray(c) && !c.bag) {
    c.bag = defaultBagForClass(c.cls);
  }
  return c;
}

/**
 * clearFoeEffect(c) — Phase 19 FID-04 (D-14 / RESEARCH Pitfall 5): `c.foeEffect`
 * is a combat-scoped debuff slot written only by engine/foeAbilities.js.
 * Since load always nulls `combat` (see rehydrate below), a debuff must
 * never survive a load either — a stale `weakened`/`dazed` value (or a
 * tampered non-object) would otherwise silently nerf the hero forever with
 * no fight left to tick it down.
 *
 * When `c` is a non-null, non-array object AND the `"foeEffect"` key is
 * PRESENT, this sets `c.foeEffect = null` (this also neutralises a
 * tampered non-object value like `"999"`, `-1`, or `[]`). When the key is
 * ABSENT this does NOTHING — a v1.0 save and a fresh run must not gain a
 * new key (the round-trip test is deepStrictEqual). Per-foe `abilities`/
 * `cd`/`uses` and `combat.pendingFoes` need no handling here because
 * `combat` is already unconditionally reset to null on every load. Mutates
 * and returns the passed `c`.
 */
function clearFoeEffect(c) {
  if (c && typeof c === "object" && !Array.isArray(c) && "foeEffect" in c) {
    c.foeEffect = null;
  }
  return c;
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
    // ECON-01 (Phase 12): default a missing c.bag by class (see migrateCarry).
    // Phase 19 FID-04: null a present-but-stale c.foeEffect (see clearFoeEffect).
    // pendingFind is transient (like combat/store) — not carried through
    // validateSave's value; rehydrate() nulls it below.
    c: clearFoeEffect(migrateCarry(obj.c)),
    floor: obj.floor,
    day,
    steps,
    party: sanitizeParty(obj.party),
    // Phase 29 (LOOT-06): pendingLoot is PERSISTENT run state (the player
    // must still get their loot screen on resume) — carried through here,
    // unlike pendingFind (transient, nulled by rehydrate below).
    pendingLoot: sanitizeLoot(obj.pendingLoot),
    dead: !!obj.dead,
    won: !!obj.won,
    // Phase 21 (D-14/D-23): boolean-coerced like dead/won; absent on a
    // pre-Phase-21 save → false.
    dev: !!obj.dev,
    // Phase 33 (STORE-01): boolean-coerced like dev/dead/won; absent on a
    // pre-Phase-33 save → false, so an old save keeps today's fixed store
    // stock and never gains the new draws mid-run.
    storeRoll: !!obj.storeRoll,
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
    // ECON-01 (Phase 12): default a missing c.bag by class (migrateCarry),
    // mirroring the validateSave side so a save loaded through either entry
    // point lands with a bag. Phase 19 FID-04: null a present-but-stale
    // c.foeEffect (see clearFoeEffect) — combat is already reset to null
    // below, so a mid-combat debuff must not survive either.
    c: clearFoeEffect(migrateCarry(obj.c)),
    floor: obj.floor,
    day: obj.day ?? 1,
    steps: obj.steps ?? 0,
    combat: null,
    store: null,
    beats: null,
    // ECON-02 (Phase 12): pendingFind is transient run state — always reset to
    // null on load, exactly like combat/store above (the prototype's load()
    // never resumed a mid-find prompt either). Defaults a missing field to null.
    pendingFind: null,
    // Phase 29 (LOOT-06): pendingLoot is PERSISTENT run state (unlike
    // pendingFind just above) — the player must still get their loot screen
    // back on resume, so it is carried through here, never reset.
    pendingLoot: sanitizeLoot(obj.pendingLoot),
    // PARTY-02 (Phase 7): whitelist the persistent roster, mirroring dead/won
    // above. sanitizeParty fail-opens a missing party (pre-Phase-7 save) to []
    // and drops malformed members, so old saves load with `party: []` and zero
    // other data loss. serializeRun's state spread already persists it; this is
    // the explicit read-back side. combat is still nulled (roster is persistent,
    // combat sub-state is transient), so the party correctly survives reload.
    party: sanitizeParty(obj.party),
    dead: !!obj.dead,
    won: !!obj.won,
    // Phase 21 (D-14/D-23): boolean-coerced like dead/won; absent on a
    // pre-Phase-21 save → false.
    dev: !!obj.dev,
    // Phase 33 (STORE-01): boolean-coerced like dev/dead/won; absent on a
    // pre-Phase-33 save → false, so an old save keeps today's fixed store
    // stock and never gains the new draws mid-run.
    storeRoll: !!obj.storeRoll,
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
