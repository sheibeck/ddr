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
import { clearRoundTimers } from "./effects.js";
import { reconcileWorn } from "./derived.js";
import { ensureAbilities } from "./character.js";

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
 * ensureCharacterAbilities(c, seed) — Phase 38 (ABIL-02) tolerant-load entry
 * point for the hero's own sheet: `ensureAbilities(c, String(seed))`. A
 * no-op when `c.abilities` is already an array (every save this phase
 * itself writes); rebuilds it deterministically (migrateLegacySkills +
 * splitTableAbilities + grantLevelAbilities up to `c.level`) for a
 * pre-phase save that lacks the field, or a tampered non-array value.
 */
function ensureCharacterAbilities(c, seed) {
  return ensureAbilities(c, String(seed));
}

/**
 * ensurePartyAbilities(party) — Phase 38 (ABIL-05) tolerant-load entry point
 * for the persistent roster, mirroring ensureCharacterAbilities above: each
 * member is keyed `joiner:<name>:0` (depth 0 — the roster is not
 * depth-scoped, unlike a live meetJoiner roll), matching the derived-stream
 * key format the tolerant-load ledger documents. A no-op member whose
 * `abilities` is already an array.
 */
function ensurePartyAbilities(party) {
  return party.map((m) => ensureAbilities(m, `joiner:${m.name}:0`));
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
 * clearStaleTimers(c) — Phase 36 (BAL foundation) load-tolerance for
 * `c.timers` (engine/effects.js), mirroring clearFoeEffect immediately
 * above: when `c` is a non-null, non-array object AND the `"timers"` key is
 * PRESENT, a non-plain-object value (a tampered string/array/number) is
 * deleted outright, and a genuine map has its rounds-cadence records
 * cleared via clearRoundTimers — combat is always reset to null on load
 * (see rehydrate below), so a combat-scoped rounds record must not survive
 * a load either, exactly clearFoeEffect's reasoning. Squares-cadence
 * records persist. When the key is ABSENT this does NOTHING — a save that
 * never had `c.timers` must not gain one (mirrors clearFoeEffect's
 * additive-with-default discipline). Mutates and returns the passed `c`.
 */
function clearStaleTimers(c) {
  if (c && typeof c === "object" && !Array.isArray(c) && "timers" in c) {
    if (!c.timers || typeof c.timers !== "object" || Array.isArray(c.timers)) {
      delete c.timers;
    } else {
      clearRoundTimers(c);
    }
  }
  return c;
}

/**
 * sanitizeWorn(c) — Phase 37 (GEAR-04, T-37-07) load-tolerance for
 * `c.worn`, mirroring clearStaleTimers/clearFoeEffect immediately above:
 * when `c` is a non-null, non-array object AND the `"worn"` key is PRESENT,
 * a non-plain-object value (a tampered `"999"`, `[]`, `null`, `7`) becomes
 * `{}`; inside a genuine map, every entry whose value is not a non-null,
 * non-array object is deleted (a tampered `worn.ring = "not an object"` is
 * dropped, a genuine `worn.cloak = {...}` survives). When the key is ABSENT
 * this does NOTHING — a save that never had `c.worn` must not gain one here
 * (this is what keeps `sanitizeWorn` from ever injecting the key on a
 * no-option load; the option-gated `reconcileWorn` below is the only thing
 * that creates it). Runs on BOTH load chains (validateSave/rehydrate)
 * BEFORE any rule reads `c.worn` — `combat` is always reset to null on load,
 * but `c.worn` is persistent run state, so a tampered value must be
 * neutralised, not merely combat-scoped like `foeEffect`. Mutates and
 * returns the passed `c`.
 */
function sanitizeWorn(c) {
  if (c && typeof c === "object" && !Array.isArray(c) && "worn" in c) {
    if (!c.worn || typeof c.worn !== "object" || Array.isArray(c.worn)) {
      c.worn = {};
    } else {
      for (const slot of Object.keys(c.worn)) {
        const it = c.worn[slot];
        if (!it || typeof it !== "object" || Array.isArray(it)) delete c.worn[slot];
      }
    }
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
 * `options.wornSlots` (Phase 37, GEAR-04) is a second option, OFF by
 * default: when `true` (only `engineAdapter#boot` passes it, in the real
 * shell load path), a save whose `c` lacks an own `worn` key is migrated via
 * `reconcileWorn(value.c)` — the first item of each slot type (in bag order)
 * is worn, every later copy stays bagged; this can never overflow the bag
 * (bag -> worn only frees slots). A save that already carries `c.worn` is
 * NEVER re-migrated (reconcileWorn is itself a no-op on a `c` that already
 * has the key). The reconciliation is returned as `wornReport` — a NEW,
 * additive return-value key, never a serialized field — attached ONLY when
 * the migration actually ran (`wornSlots: true`); it is `[]`, not omitted,
 * when nothing was wearable. Without the option (every fixture, bot, tools
 * caller, and test that calls `validateSave` today) `c.worn` is NEVER
 * injected — `sanitizeWorn` above only neutralises a key that is already
 * present, it does not create one.
 *
 * @param {string|object} raw
 * @param {{ freshSeed?: number, wornSlots?: boolean }} [options]
 * @returns {{ ok: true, value: object, wornReport?: Array } | { ok: false, reason: string }}
 */
export function validateSave(raw, options = {}) {
  const freshSeed = typeof options.freshSeed === "number" ? options.freshSeed : 1;
  const wornSlots = options.wornSlots === true;

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
    // Phase 36 (BAL foundation): clear a present-but-stale c.timers rounds
    // record / drop a tampered value (see clearStaleTimers); never injected.
    // Phase 37 (GEAR-04): neutralise a present-but-tampered c.worn (see
    // sanitizeWorn) before the option-gated reconcileWorn below ever reads
    // it. pendingFind is transient (like combat/store) — not carried through
    // validateSave's value; rehydrate() nulls it below. Phase 38 (ABIL-02):
    // ensureCharacterAbilities is the tolerant-load rebuild for c.abilities
    // (a no-op once the field is already an array) — runs LAST in the chain
    // so it sees c.skills already migrated/sanitized by everything before it.
    c: ensureCharacterAbilities(sanitizeWorn(clearStaleTimers(clearFoeEffect(migrateCarry(obj.c)))), seed),
    floor: obj.floor,
    day,
    steps,
    // Phase 38 (ABIL-05): each party member gets the same tolerant-load
    // rebuild, keyed joiner:<name>:0 (see ensurePartyAbilities's JSDoc).
    party: ensurePartyAbilities(sanitizeParty(obj.party)),
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

  // Phase 37 (GEAR-04): the ONE option-gated call site that ever CREATES
  // c.worn on load. reconcileWorn(value.c) is itself a no-op (returns null)
  // when value.c already carries an own `worn` key — a save this migrated
  // last time, or a fresh { wornSlots: true } run's save, round-trips
  // through validateSave byte-identical, never re-migrated. `wornReport` is
  // attached to the return value (NEVER a serialized field) only when the
  // migration ran at all — `[]` when nothing was wearable, an array of
  // `{ slot, worn, bagged }` entries when at least one slot was reconciled.
  // Without `wornSlots: true` (every fixture/bot/tools/test caller today),
  // this branch never runs and `wornReport` is never a key on the result.
  const wornReport = wornSlots ? reconcileWorn(value.c) : null;
  return wornReport ? { ok: true, value, wornReport } : { ok: true, value };
}

/**
 * rehydrate(obj, options) — turns a validated save (`validateSave(...).value`,
 * or an equally-shaped `serializeRun` output) into a GameState ready for
 * `applyAction`: combat/store/beats always reset to null (the prototype's
 * load() never resumed mid-combat or mid-store either).
 *
 * `options.wornSlots` (Phase 37, GEAR-04) mirrors validateSave's own option:
 * OFF by default (every fixture/bot/tools/test caller), so `c.worn` is never
 * injected on a save that lacks it. `engineAdapter#boot` passes `true` after
 * its own `validateSave(raw, { wornSlots: true })` call — reconcileWorn is a
 * no-op on a `c` that already has `worn` (validateSave's own migration, if it
 * ran, already created the key), so calling both in sequence never
 * double-migrates; a caller that reaches `rehydrate` directly with the
 * option (bypassing validateSave, e.g. a test) still gets the same one-shot
 * migration. The report is discarded here — `boot()` reads it from
 * `validateSave`'s own return value instead (Plan 03/04's
 * `takeBootWornReport`).
 *
 * @param {object} obj
 * @param {{ wornSlots?: boolean }} [options]
 */
export function rehydrate(obj, options = {}) {
  const state = {
    version: STATE_VERSION,
    seed: obj.seed,
    rngState: obj.rngState,
    // ECON-01 (Phase 12): default a missing c.bag by class (migrateCarry),
    // mirroring the validateSave side so a save loaded through either entry
    // point lands with a bag. Phase 19 FID-04: null a present-but-stale
    // c.foeEffect (see clearFoeEffect) — combat is already reset to null
    // below, so a mid-combat debuff must not survive either. Phase 36 (BAL
    // foundation): clear a present-but-stale c.timers rounds record / drop a
    // tampered value (see clearStaleTimers); never injected. Phase 37
    // (GEAR-04): neutralise a present-but-tampered c.worn (see sanitizeWorn)
    // before the option-gated reconcileWorn below ever reads it. Phase 38
    // (ABIL-02): ensureCharacterAbilities mirrors validateSave's own call —
    // a no-op once c.abilities is already an array.
    c: ensureCharacterAbilities(sanitizeWorn(clearStaleTimers(clearFoeEffect(migrateCarry(obj.c)))), obj.seed),
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
    // Phase 38 (ABIL-05): ensurePartyAbilities mirrors validateSave's own call.
    party: ensurePartyAbilities(sanitizeParty(obj.party)),
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
  // Phase 37 (GEAR-04): option-gated migration, mirroring validateSave's own
  // call above — a no-op (reconcileWorn returns null and touches nothing)
  // when state.c already carries an own `worn` key, so a save validateSave
  // already migrated (or a fresh { wornSlots: true } run's save) is never
  // re-migrated here. The report is discarded — a caller that needs it uses
  // validateSave directly (Plan 03/04's engineAdapter#boot does exactly that).
  if (options.wornSlots === true) reconcileWorn(state.c);
  return state;
}
