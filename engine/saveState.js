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
import { clearRoundTimers, startEffect, startCooldown, endEffectEarly } from "./effects.js";
import {
  reconcileWorn,
  activationFor,
  activationKeyFor,
  itemTimerId,
  carriedItems,
  WORN_SLOTS,
  clampCarry,
  freeWornKey,
  canonItemText,
  effectSourceOf,
  sourceSlotItem,
  SOURCE_SLOTS,
  schoolAllowed,
} from "./derived.js";
import { ensureAbilities } from "./character.js";
import { DIRV } from "./movement.js";
import { STORE_EFFECTS } from "./economy.js";
import { endSourceEffects } from "./items.js";
import { ACTIVATION_OF, SLOT_OF, SPELLS, MU_CHART, STAFF_NAMES, BESTIARY, TOOLS } from "../content/index.js";

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
 * isPlainObject(v) — module-private: a non-null, non-array object (the same
 * check engine/effects.js keeps privately). Used by the resume sanitizers.
 */
function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/**
 * clearFoeEffect(c, fightSurvives) — Phase 19 FID-04 (D-14 / RESEARCH
 * Pitfall 5): `c.foeEffect` is a combat-scoped debuff slot written only by
 * engine/foeAbilities.js (`{ kind, rounds }`).
 *
 * SAV-06 (Phase 76): the debuff survives a load exactly when the fight it
 * belongs to does. With a surviving fight (`fightSurvives` true), a genuine
 * `{ kind: string, rounds: number }` is kept (a relaunch must never clear a
 * debuff in the hero's favour) and anything else present is nulled. With no
 * surviving fight, a present value is nulled, as before — a stale
 * `weakened`/`dazed` value (or a tampered non-object) would otherwise
 * silently nerf the hero forever with no fight left to tick it down.
 *
 * When the `"foeEffect"` key is ABSENT this does NOTHING — a v1.0 save and a
 * fresh run must not gain a new key (the round-trip test is
 * deepStrictEqual). Per-foe `abilities`/`cd`/`uses` and
 * `combat.pendingFoes` need no handling here: they ride the combat, which is
 * resumed wholesale or dropped whole (sanitizeCombat). Mutates and returns
 * the passed `c`.
 */
function clearFoeEffect(c, fightSurvives = false) {
  if (c && typeof c === "object" && !Array.isArray(c) && "foeEffect" in c) {
    const fe = c.foeEffect;
    const genuine = isPlainObject(fe) && typeof fe.kind === "string" && typeof fe.rounds === "number";
    if (!(fightSurvives && genuine)) c.foeEffect = null;
  }
  return c;
}

/**
 * sanitizePhobiaFields(c) — Phase 41 (TERR-04/05) load-tolerance for
 * `c.phobiaState`/`c.fearArmed` (engine/phobias.js), mirroring clearFoeEffect
 * immediately above's "present-but-tampered is neutralised, absent is never
 * injected" discipline:
 * - `"phobiaState" in c` and the value is not a plain (non-null, non-array)
 *   object -> the key is DELETED outright (a tampered `"x"`/`[]`/`null`/`7`).
 * - a genuine `c.phobiaState` object has every entry whose value is neither
 *   a `boolean` NOR a `string` deleted (the Heights tile-key entry is a
 *   string; every other entry is a boolean) — a tampered `Death: 7` or
 *   `Heights: {}` is dropped, a genuine `Death: true`/`Heights: "3,4"`
 *   survives.
 * - `"fearArmed" in c` and the value is not a plain object with a string
 *   `phobia` AND a string `trigger` -> the key is DELETED outright.
 * When either key is ABSENT this does NOTHING — a save that never had
 * either field must not gain one (this function NEVER injects — only
 * engine/phobias.js's own trigger functions ever create the keys). Mutates
 * and returns the passed `c`.
 */
function sanitizePhobiaFields(c) {
  if (!c || typeof c !== "object" || Array.isArray(c)) return c;
  if ("phobiaState" in c) {
    if (!c.phobiaState || typeof c.phobiaState !== "object" || Array.isArray(c.phobiaState)) {
      delete c.phobiaState;
    } else {
      for (const key of Object.keys(c.phobiaState)) {
        const v = c.phobiaState[key];
        if (typeof v !== "boolean" && typeof v !== "string") delete c.phobiaState[key];
      }
    }
  }
  if ("fearArmed" in c) {
    const fa = c.fearArmed;
    const valid = fa && typeof fa === "object" && !Array.isArray(fa) && typeof fa.phobia === "string" && typeof fa.trigger === "string";
    if (!valid) delete c.fearArmed;
  }
  return c;
}

/**
 * clearStaleTimers(c, fightSurvives) — Phase 36 (BAL foundation) load-
 * tolerance for `c.timers` (engine/effects.js), mirroring clearFoeEffect
 * immediately above: when `c` is a non-null, non-array object AND the
 * `"timers"` key is PRESENT, a non-plain-object value (a tampered
 * string/array/number) is deleted outright, fight or no fight.
 *
 * SAV-06 (Phase 76): a genuine map keeps its rounds-cadence records when
 * the fight survives this load (`fightSurvives` true) — a relaunch must
 * never clear an in-fight effect or cooldown in either side's favour. With
 * no surviving fight, the rounds-cadence records are cleared via
 * clearRoundTimers as before (a combat-scoped rounds record must not
 * outlive its fight, exactly clearFoeEffect's reasoning). Squares-cadence
 * records persist either way. When the key is ABSENT this does NOTHING — a
 * save that never had `c.timers` must not gain one (mirrors clearFoeEffect's
 * additive-with-default discipline). Mutates and returns the passed `c`.
 */
function clearStaleTimers(c, fightSurvives = false) {
  if (c && typeof c === "object" && !Array.isArray(c) && "timers" in c) {
    if (!c.timers || typeof c.timers !== "object" || Array.isArray(c.timers)) {
      delete c.timers;
    } else if (!fightSurvives) {
      clearRoundTimers(c);
    }
  }
  return c;
}

/**
 * clampRevealWindow(c) — Plan 76-06 (user ruling 2026-09-26: Map the Floor
 * lasts only until you move). A tolerant load that applies the until-you-
 * move rule to a window saved before it: when `c.timers["spell:reveal"]` is
 * a plain-object record with phase "effect", cadence "squares" and a finite
 * `left` above 1 (an old 40-square window), `left` becomes 1, so the first
 * step after the load ends it. Anything else — no timers, a cooldown or
 * spent record, a non-object or tampered record — is left exactly as it is
 * for clearStaleTimers / clearStaleSpellSeen to handle. A no-op for every
 * state the new engine produces (its windows are already one square). No
 * event, no narration; never throws, never creates a key. Mutates and
 * returns the passed `c`.
 */
function clampRevealWindow(c) {
  if (!isPlainObject(c) || !isPlainObject(c.timers)) return c;
  const rec = c.timers["spell:reveal"];
  if (isPlainObject(rec) && rec.phase === "effect" && rec.cadence === "squares" && Number.isFinite(rec.left) && rec.left > 1) {
    rec.left = 1;
  }
  return c;
}

// ─── SAV-06/SAV-07 (Phase 76): the resume sanitizers ────────────────────────
//
// A DECLARED CANON DIVERGENCE from the 1994 prototype's load(), which never
// resumed a fight, a store or any pending decision (CONTEXT: "What survives
// a relaunch"). Each sanitizer returns the RAW value itself when it is sound
// (wholesale: no key is ever copied selectively or deleted, so every combat,
// foe, ally and stock-line field — present or future — survives without
// per-field code) or `null` when it is not, and never throws. The depth is
// chosen so the NEXT action cannot throw on a structurally broken value:
// src/browser/engineAdapter.js#dispatch's catch replaces the WHOLE run on a
// throw, so a shallow check would turn a bad stored fight into a lost
// character (T-76-01).

/** A foe the next combat action can dereference: name, wp, maxWP, alive. */
function isSoundFoe(f) {
  return isPlainObject(f) && typeof f.name === "string" && Number.isFinite(f.wp) && Number.isFinite(f.maxWP) && typeof f.alive === "boolean";
}

/**
 * sanitizeCombat(raw, party, partyIntact) — the stored `combat`, or null.
 * Sound means: a plain object; a non-empty `foes` array of sound foes
 * (isSoundFoe); at least one living foe or a non-empty `pendingFoes` (endCombat
 * nulls a finished fight, so a live one always has one or the other); an
 * integer `round` of at least 1; an integer `target` indexing `foes`; a
 * `type` that is a BESTIARY key; `pending` absent or boolean; `ally` absent,
 * null or a plain object; `pendingFoes` absent, null or an array whose every
 * entry is a plain object carrying a sound `foe` (foeTurn pushes `p.foe`
 * straight into `foes`); `allies` absent, or an array of plain objects with a
 * finite `wp` whose integer `partyIdx` indexes the loaded `party` — and only
 * when the tolerant party load dropped no member (`partyIntact`), since a
 * dropped member shifts every later index onto the wrong sheet.
 */
function sanitizeCombat(raw, party, partyIntact) {
  const C = raw;
  if (!isPlainObject(C)) return null;
  if (!Array.isArray(C.foes) || C.foes.length === 0 || !C.foes.every(isSoundFoe)) return null;
  if (C.pendingFoes !== undefined && C.pendingFoes !== null) {
    if (!Array.isArray(C.pendingFoes) || !C.pendingFoes.every((p) => isPlainObject(p) && isSoundFoe(p.foe))) return null;
  }
  const queued = Array.isArray(C.pendingFoes) && C.pendingFoes.length > 0;
  if (!C.foes.some((f) => f.alive) && !queued) return null;
  if (!Number.isInteger(C.round) || C.round < 1) return null;
  if (!Number.isInteger(C.target) || C.target < 0 || C.target >= C.foes.length) return null;
  if (typeof C.type !== "string" || !Object.prototype.hasOwnProperty.call(BESTIARY, C.type)) return null;
  if (C.pending !== undefined && typeof C.pending !== "boolean") return null;
  if (C.ally !== undefined && C.ally !== null && !isPlainObject(C.ally)) return null;
  if (C.allies !== undefined) {
    if (!partyIntact || !Array.isArray(C.allies)) return null;
    const sound = C.allies.every(
      (a) => isPlainObject(a) && Number.isFinite(a.wp) && Number.isInteger(a.partyIdx) && a.partyIdx >= 0 && a.partyIdx < party.length,
    );
    if (!sound) return null;
  }
  return C;
}

/**
 * sanitizeStore(raw) — the stored `store`, or null. Sound means: a plain
 * object; a non-empty `stock` array of plain-object lines, each with a string
 * `n`, a finite `cost` of at least 0, an `effectId` that is a STORE_EFFECTS
 * key (buyFrom looks it up), a boolean `sold`, and `effectParams` null or a
 * plain object whose `item`, when present, is a plain object; a finite
 * `haggle` in (0, 1]; a string `race`.
 */
function sanitizeStore(raw) {
  if (!isPlainObject(raw)) return null;
  const { stock, haggle, race } = raw;
  if (!Array.isArray(stock) || stock.length === 0) return null;
  const soundLine = (x) =>
    isPlainObject(x) &&
    typeof x.n === "string" &&
    Number.isFinite(x.cost) &&
    x.cost >= 0 &&
    typeof x.effectId === "string" &&
    Object.prototype.hasOwnProperty.call(STORE_EFFECTS, x.effectId) &&
    typeof x.sold === "boolean" &&
    (x.effectParams === null || (isPlainObject(x.effectParams) && (x.effectParams.item === undefined || isPlainObject(x.effectParams.item))));
  if (!stock.every(soundLine)) return null;
  if (!Number.isFinite(haggle) || haggle <= 0 || haggle > 1) return null;
  if (typeof race !== "string") return null;
  return raw;
}

/** sanitizePendingFind(raw) — a plain-object find with a string `n` (it is narrated), or null. */
function sanitizePendingFind(raw) {
  return isPlainObject(raw) && typeof raw.n === "string" ? raw : null;
}

/**
 * sanitizePendingHazard(raw, floor) — Phase 78 (CLIMB-01/02): the pre-roll
 * wall/crevice decision `{ feat, dir, tool }` with `feat` "climb" or
 * "gorge", a DIRV key `dir`, `tool` the feat's matching TOOLS key (a ladder
 * for a climb, a rope for a gorge), AND the cell one step in `dir` from the
 * party still carrying that `feat` (engine/movement.js#resolveHazard commits
 * against it), or null. Carried wholesale: an old save's record with the
 * retired `declined` retry flag still loads (the flag is ignored), and since
 * the pause drew no die, the relaunched decision is the same decision.
 */
function sanitizePendingHazard(raw, floor) {
  if (!isPlainObject(raw)) return null;
  if (raw.feat !== "climb" && raw.feat !== "gorge") return null;
  if (typeof raw.dir !== "string" || !Object.prototype.hasOwnProperty.call(DIRV, raw.dir)) return null;
  if (typeof raw.tool !== "string" || !Object.prototype.hasOwnProperty.call(TOOLS, raw.tool)) return null;
  if (TOOLS[raw.tool].feat !== raw.feat) return null;
  const [dx, dy] = DIRV[raw.dir];
  const row = floor && Array.isArray(floor.g) ? floor.g[floor.py + dy] : undefined;
  const cell = Array.isArray(row) ? row[floor.px + dx] : undefined;
  return isPlainObject(cell) && cell.feat === raw.feat ? raw : null;
}

/**
 * sanitizePendingTile(raw, floor) — `{ x, y, depth }` with integer fields,
 * `depth` equal to the loaded floor's depth and an existing cell at `(x, y)`,
 * or null. engine/movement.js#resolvePendingTile re-checks the position and
 * the feature itself, so shape and depth are all the load needs.
 */
function sanitizePendingTile(raw, floor) {
  if (!isPlainObject(raw)) return null;
  if (!Number.isInteger(raw.x) || !Number.isInteger(raw.y) || !Number.isInteger(raw.depth)) return null;
  if (!floor || raw.depth !== floor.depth || !Array.isArray(floor.g)) return null;
  const row = floor.g[raw.y];
  return Array.isArray(row) && isPlainObject(row[raw.x]) ? raw : null;
}

/**
 * sanitizePendingJoiner(raw) — a Joiner offer with the minimal character
 * shape the party load already demands (isValidCharacter) and a string
 * `name`, carried wholesale (never re-rolled), or null. Phase 90 plan 06: its
 * grimoire gets the same tolerant spell load as a party member's.
 */
function sanitizePendingJoiner(raw) {
  return isValidCharacter(raw) && typeof raw.name === "string" ? migrateSpellNames(raw) : null;
}

/**
 * resumedSubState(obj, combat, floor) — the ONE builder both load chains use
 * for what a relaunch resumes (SAV-06/SAV-07): `{ combat, store, pendingFind,
 * pendingHazard, pendingTile }`, plus `pendingJoiner` ONLY when the raw save
 * carries that key (newRun never writes it, so a fresh run must not gain it).
 * `combat` is the already-sanitized fight (the caller computes it first so
 * the `c` chain knows whether a fight survives). A store never opens mid-
 * fight, so a surviving fight drops the store. `floor` is the sanitized
 * floor the hazard and tile checks read.
 */
function resumedSubState(obj, combat, floor) {
  const sub = {
    combat,
    store: combat ? null : sanitizeStore(obj.store),
    pendingFind: sanitizePendingFind(obj.pendingFind),
    pendingHazard: sanitizePendingHazard(obj.pendingHazard, floor),
    pendingTile: sanitizePendingTile(obj.pendingTile, floor),
  };
  if ("pendingJoiner" in obj) sub.pendingJoiner = sanitizePendingJoiner(obj.pendingJoiner);
  return sub;
}

/**
 * resumeEventsFor(state) — SAV-06/SAV-07 (Phase 76): the Oracle's resume
 * beat for a freshly loaded state. Pure: zero rng, never mutates `state`.
 * `[{ type: "fightResumed", round, pending, foes }]` for a live combat
 * (`foes` = the living foe count; `pending` true while the fight is not yet
 * joined), `[{ type: "storeResumed" }]` for an open store, `[]` otherwise.
 */
export function resumeEventsFor(state) {
  const C = state && state.combat;
  if (C) {
    const foes = Array.isArray(C.foes) ? C.foes.filter((f) => f && f.alive).length : 0;
    return [{ type: "fightResumed", round: C.round, pending: !!C.pending, foes }];
  }
  if (state && state.store) return [{ type: "storeResumed" }];
  return [];
}

/**
 * sanitizeWard(c) — RULES-14 (Phase 75, user 2026-09-25) load-tolerance for
 * `c.ward`, mirroring clearStaleTimers/sanitizePhobiaFields's discipline: a
 * pre-Phase-75 save's reflecting ward (`{ pool, rounds, reflect: true, name
 * }` — set only by casting Bubble or channeling the Rowan Staff dome before
 * this phase) becomes the new armed-mirror shape (`{ name, mirror: true,
 * pool: 0, popPool, rounds: null }`), with `popPool` read from the LIVE
 * SPELLS Bubble row (never hard-coded) so a future retune never needs a
 * second tolerant-load edit. Any other present ward (Shield, an already-
 * mirrored/popped Bubble) simply loses a stray `reflect` key — no ward ever
 * carries one again. When `c.ward` is absent/null this does NOTHING — a save
 * that never had a ward must not gain one. Mutates and returns the passed
 * `c`.
 */
function sanitizeWard(c) {
  if (!c || typeof c !== "object" || Array.isArray(c)) return c;
  const w = c.ward;
  if (!w || typeof w !== "object" || Array.isArray(w)) return c;
  if (w.reflect) {
    const bubble = SPELLS.find((sp) => sp.n === "Bubble");
    c.ward = { name: w.name || "Bubble", mirror: true, pool: 0, popPool: (bubble && bubble.popPool) || 25, rounds: null };
  } else if ("reflect" in w) {
    delete w.reflect;
  }
  return c;
}

/**
 * sanitizeStaff(c) — RULES-13 (Phase 75, user 2026-09-25) load-tolerance for
 * the wielded-staff pair `c.weapon`/`c.staff`, mirroring sanitizeWard's exact
 * discipline immediately above. `c.staff` is kept ONLY when it is a plain
 * object of `kind: "staff"` whose display name (`.n`) is both a genuine
 * STAFF_NAMES entry AND equal to `c.weapon` — any other present value (a
 * tampered shape, a mismatched name, a stale object left over from a
 * mid-migration save) is dropped outright. When `c.weapon` itself NAMES a
 * staff (a STAFF_NAMES entry) but no valid `c.staff` survives that check,
 * the weapon slot resets to bare hands (`"Fists"`, prof 0, magicWpn 0) — a
 * wielded staff's name and its charge-bearing object must always travel
 * together, never a name with nothing behind it. Deliberately never touches
 * a BAGGED staff (`c.items`) — a tolerant load must never change a
 * character's loadout, only repair the worn weapon-slot pair itself. When
 * `c.staff` is absent AND `c.weapon` is not a staff name, this does
 * NOTHING. Mutates and returns the passed `c`.
 */
function sanitizeStaff(c) {
  if (!c || typeof c !== "object" || Array.isArray(c)) return c;
  const s = c.staff;
  const validStaff =
    !!s && typeof s === "object" && !Array.isArray(s) && s.kind === "staff" && typeof s.n === "string" && STAFF_NAMES.includes(s.n) && s.n === c.weapon;
  if ("staff" in c && !validStaff) delete c.staff;
  if (STAFF_NAMES.includes(c.weapon) && !validStaff) {
    c.weapon = "Fists";
    c.prof = 0;
    c.magicWpn = 0;
  }
  return c;
}

/**
 * reconcileItemSources(sheet) — Phase 88 (ITEM-02): THE one load-time
 * reconciliation of the effect-source link (CONTEXT: "one mechanism: a single
 * engine helper ends the effects linked to a slot, called from every gear-change
 * path, plus one load-time reconciliation"). Runs on the hero's sheet and on
 * every Joiner sheet, AFTER `reconcileWorn` (a legacy save's worn map is built
 * there) and after `sanitizeStaff` (which un-wields a stale staff), so both see
 * the settled gear.
 *
 * The old-save rule (CONTEXT): "on load, a live item effect with no recorded
 * source is linked to the matching worn item if one is there; otherwise it ends
 * quietly (tolerant load, no event)." A LIVE (`phase: "effect"`, `left > 0`)
 * `item:<key>` record whose key is a source-slot item (a worn-family row in
 * SLOT_OF, or a staff name) and whose `src` is missing, malformed (a string, an
 * array, an unknown slot, an empty name: effectSourceOf reads it as none) or
 * names another item is linked to the FIRST SOURCE_SLOTS key (jewelry1,
 * jewelry2, cloak, weapon) whose current item has that activation key. When no
 * slot holds it the record ends through effects.js#endEffectEarly: the spent
 * use (`left + cd` as a cooldown, so a load never hands an item back sooner than
 * play would), or, for the Crystal Staff's cd-less record, removal (its charges
 * and its `charges:` recharge record are never touched). A wielded Crystal Staff
 * (the weapon slot, user 2026-09-30) links the same way, so its party-wide read
 * follows. Then engine/items.js#endSourceEffects ends, quietly, every linked
 * record whose recorded slot no longer holds that item (a tampered or stale
 * source, a staff `sanitizeStaff` un-wielded): the same slot rule as play, no
 * second one.
 *
 * Phase 89 (ITEM-06): it also reconciles the Pendant of Fortitude's armed charge
 * (`halfNext`), see the comment in the body: a legacy `true` links to the first
 * worn Pendant or is quietly disarmed, junk is disarmed, and the sweep above
 * disarms a linked charge whose slot no longer holds the Pendant. This runs on a
 * sheet with no `timers` too.
 *
 * Potions, the Torch and every cooldown-phase record are never touched. It only
 * ever links or removes, never grants, extends or revives an effect. Pushes no
 * event, draws no rng, is idempotent, never throws on a hostile value, and never
 * creates `timers` or `worn`. Mutates and returns `sheet`.
 */
export function reconcileItemSources(sheet) {
  const plain = (v) => !!v && typeof v === "object" && !Array.isArray(v);
  if (!plain(sheet)) return sheet;
  // Phase 89 (ITEM-06): the Pendant of Fortitude's armed charge is linked like
  // a timer record, `halfNext = { slot, n }`. An old save's armed Pendant is the
  // boolean `true`: it links to the FIRST worn key holding a Pendant (an item
  // whose activation kind is "half"), else it is quietly disarmed. A charge
  // with no source the engine can read (a string, a number, an array, an object
  // with no name) is disarmed too; a well-formed object is kept and judged by the
  // same slot rule below (a stale one is swept).
  const armed = sheet.halfNext;
  if (armed === true) {
    const slot = WORN_SLOTS.find((s) => ACTIVATION_OF[activationKeyFor(sourceSlotItem(sheet, s))]?.kind === "half");
    sheet.halfNext = slot ? { slot, n: sourceSlotItem(sheet, slot).n } : false;
  } else if (armed && !(plain(armed) && typeof armed.n === "string" && armed.n.length > 0 && (armed.slot === null || SOURCE_SLOTS.includes(armed.slot)))) {
    sheet.halfNext = false;
  }
  if (plain(sheet.timers)) {
    for (const id of Object.keys(sheet.timers)) {
      if (!id.startsWith("item:")) continue;
      const rec = sheet.timers[id];
      if (!plain(rec) || rec.phase !== "effect" || !(rec.left > 0)) continue;
      const key = id.slice("item:".length);
      if (SLOT_OF[key] === undefined && !STAFF_NAMES.includes(key)) continue;
      const src = effectSourceOf(rec);
      if (src && src.n === key) continue;
      delete rec.src;
      const slot = SOURCE_SLOTS.find((s) => activationKeyFor(sourceSlotItem(sheet, s)) === key);
      if (slot) rec.src = { slot, n: key };
      else endEffectEarly(sheet, id);
    }
  }
  endSourceEffects(null, sheet, [], { quiet: true });
  return sheet;
}

// 260918-wy1 (jewelry-merge, tolerant load): the four pre-wy1 jewelry
// worn-slot keys, in fold order — ring, then bracelet, then amulet, then
// helm. This is the ONE place in engine/ those four strings may still
// appear as `c.worn` keys; every other engine/content/shell/bot file speaks
// only the three current worn keys (two jewelry, one cloak) or the
// `jewelry`/`cloak` families.
const LEGACY_JEWELRY_KEYS = Object.freeze(["ring", "bracelet", "amulet", "helm"]);

/**
 * sanitizeWorn(c) — Phase 37 (GEAR-04, T-37-07) load-tolerance for
 * `c.worn`, mirroring clearStaleTimers/clearFoeEffect immediately above:
 * when `c` is a non-null, non-array object AND the `"worn"` key is PRESENT,
 * a non-plain-object value (a tampered `"999"`, `[]`, `null`, `7`) becomes
 * `{}`; inside a genuine map, every entry whose value is not a non-null,
 * non-array object is deleted (a tampered `worn.ring = "not an object"` is
 * dropped, a genuine `worn.cloak = {...}` survives). When the key is ABSENT
 * this does NOTHING — creation is `reconcileWorn`'s job, which both load
 * chains run unconditionally since Phase 45 (HEDGE-02). Runs on BOTH load
 * chains (validateSave/rehydrate)
 * BEFORE any rule reads `c.worn` — `c.worn` is persistent run state, not
 * combat-scoped like `foeEffect` (which lives or dies with the resumed fight,
 * SAV-06), so a tampered value must always be neutralised.
 *
 * 260918-w4n (staff amendment, tolerant load): a v1.5 save's `c.worn.staff`
 * is folded back into the bag — a staff has no worn slot any more. After the
 * per-slot object check above (which would otherwise leave a legacy staff
 * object sitting harmlessly in `c.worn.staff`), a SURVIVING `c.worn.staff`
 * object is appended to `c.items` (creating the array if needed) and deleted
 * from `c.worn`.
 *
 * 260918-wy1 (jewelry-merge, tolerant load, T-wy1-01): immediately after the
 * staff fold and BEFORE the generic strip of any key outside `WORN_SLOTS` —
 * ORDER IS LOAD-BEARING, or a legacy piece would be deleted by the strip
 * instead of migrated — each `LEGACY_JEWELRY_KEYS` key (ring, bracelet,
 * amulet, helm, in that order) holding a surviving non-null, non-array
 * object is folded: `freeWornKey(c, "jewelry")` gives the first free
 * jewelry key; when one exists, the piece moves there; when both jewelry
 * keys are already occupied, the piece is instead APPENDED to `c.items`
 * (creating the array if needed) — the same spillover-to-bag shape as the
 * staff fold, so `clampCarry` below is the only thing that can discard it
 * on an over-cap bag. The legacy key is deleted from `c.worn` either way. A
 * save carrying the w4n-interim five-key shape (worn staff already folded)
 * migrates exactly the same way. Any OTHER key on `c.worn` outside
 * `WORN_SLOTS` is also dropped by the generic strip below (defensive — no
 * current content authors one, but the same discipline as before).
 * `clampCarry(c)` runs immediately after the fold so an over-cap bag drops
 * the appended overflow pieces exactly like any other overflow item — a
 * no-op without `c.bag`. SAV-06/SAV-07 (Phase 76): it runs ONLY when a fold
 * appended a piece to the bag, so a save with nothing to fold keeps its
 * gold and rations exactly as saved. No dual path: every load runs this,
 * whether or not the save ever had `c.worn` (the whole block is itself gated on `"worn" in
 * c`, so a save with no `c.worn` at all is untouched, exactly as before).
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
      // SAV-06/SAV-07 (Phase 76, plan 76-04): `spilled` records whether a
      // fold below actually appended a piece to the bag. Only then does the
      // clamp run, so a current save (nothing to fold) loads its gold and
      // rations exactly as saved. Live play never clamps gold on a gain
      // (items.js#gainWilmst; only sellItem clamps), so an unconditional
      // clamp here cut a deep hero's over-cap purse on every relaunch.
      let spilled = false;
      if (c.worn.staff) {
        c.items = Array.isArray(c.items) ? c.items : [];
        c.items.push(c.worn.staff);
        delete c.worn.staff;
        spilled = true;
      }
      for (const legacyKey of LEGACY_JEWELRY_KEYS) {
        const it = c.worn[legacyKey];
        if (it && typeof it === "object" && !Array.isArray(it)) {
          const to = freeWornKey(c, "jewelry");
          if (to) {
            c.worn[to] = it;
          } else {
            c.items = Array.isArray(c.items) ? c.items : [];
            c.items.push(it);
            spilled = true;
          }
        }
        delete c.worn[legacyKey];
      }
      for (const slot of Object.keys(c.worn)) {
        if (!WORN_SLOTS.includes(slot)) delete c.worn[slot];
      }
      if (spilled) clampCarry(c);
    }
  }
  return c;
}

/**
 * clearStaleSpellSeen(floor, c) — Phase 40 (SPELL-05, Plan 04) load-
 * tolerance for `cell.spellSeen` (engine/maze.js#reveal/refogSpellSeen),
 * mirroring clearStaleTimers's exact discipline (T-40-07): a floor whose
 * grid carries stale provenance flags with NO live `spell:reveal` record on
 * `c` (the window already expired, or the record was tampered/removed) has
 * every flag stripped — `seen` is left exactly as saved, only the flag is
 * removed, so a cell the player genuinely walked (seen but unflagged, or
 * seen and stale-flagged) is never re-fogged by this tolerant load; worst
 * case is a cell the player never walked staying lit one load longer than
 * it should, which the NEXT live sweep or the next cast's own marking
 * corrects. A floor with a LIVE record (`phase: "effect", left > 0`) is left
 * completely untouched — its flags simply keep counting down toward their
 * own eventual sweep, exactly as if the save had never round-tripped.
 * Never adds a `spellSeen` key to any cell; walks `floor.g` only when it is
 * a genuine array of arrays (a malformed floor has already failed
 * `isValidFloor` upstream in validateSave, so this never needs to guard
 * against a non-array `g` in practice — guarded anyway, additive-with-
 * default discipline). Mutates and returns the passed `floor`.
 */
function clearStaleSpellSeen(floor, c) {
  if (!floor || typeof floor !== "object" || !Array.isArray(floor.g)) return floor;
  const rec = c && c.timers && c.timers["spell:reveal"];
  const live = !!(rec && rec.phase === "effect" && rec.left > 0);
  if (live) return floor;
  for (const row of floor.g) {
    if (!Array.isArray(row)) continue;
    for (const cell of row) {
      if (cell && typeof cell === "object" && "spellSeen" in cell) delete cell.spellSeen;
    }
  }
  return floor;
}

/**
 * sanitizeWaterCells(floor) — Phase 41 (TERR-01) load-tolerance for
 * `cell.water`, mirroring clearStaleTimers/sanitizeWorn's exact discipline:
 * when `floor.g` is a genuine array of arrays, every cell whose own
 * `"water"` key is PRESENT but whose value is not exactly `true` (a
 * tampered `"yes"`, `1`, `false`, `null`) has the key deleted outright. A
 * cell that never carried the key is left completely untouched — this
 * function NEVER adds a `water` key, so a pre-Phase-41 save (no cell has the
 * key at all) round-trips with zero water cells and stays waterless until
 * its next descent (no card, no migration — the ratified greenfield tolerant
 * -load ruling). A genuine `water: true` cell always survives. Runs on BOTH
 * load chains (validateSave/rehydrate), mirroring clearStaleSpellSeen's own
 * placement. Mutates and returns the passed `floor`.
 */
function sanitizeWaterCells(floor) {
  if (!floor || typeof floor !== "object" || !Array.isArray(floor.g)) return floor;
  for (const row of floor.g) {
    if (!Array.isArray(row)) continue;
    for (const cell of row) {
      if (cell && typeof cell === "object" && "water" in cell && cell.water !== true) {
        delete cell.water;
      }
    }
  }
  return floor;
}

/**
 * RETIRED_SPELL_NAMES — the renames and removals this migration knows about:
 * "Detect Magic" became "Map the Floor" (Phase 40, SPELL-05); and Phase 90 plan
 * 06 (SPELL-12) removed two spells — "Lesser Summon" becomes "Summon" (the
 * Summoner now casts Summon from level 1) and "Phantom Host" maps to `null`
 * (dropped: no spell stands in for it). A frozen map so a FUTURE rename can
 * extend it without touching migrateSpellNames itself. These are the ONLY
 * places the removed names appear anywhere in engine/ or content/.
 */
const RETIRED_SPELL_NAMES = Object.freeze({ "Detect Magic": "Map the Floor", "Lesser Summon": "Summon", "Phantom Host": null });

/**
 * migrateSpellNames(c) — Phase 40 (SPELL-05, Plan 04) tolerant-load rename
 * for `c.grimoire`: an old save's grimoire entry for a retired spell name
 * (RETIRED_SPELL_NAMES) is rewritten to its current name IN PLACE (position
 * preserved), with first-occurrence dedupe — if both the old and new name
 * were somehow present (never happens on a genuine save, only a hand-
 * tampered one), only the FIRST occurrence survives the rewrite and any
 * later duplicate of the resulting name is dropped, so the grimoire never
 * gains a second copy of the same spell. No card, no narration, no rng — a
 * silent, additive rewrite exactly like clearFoeEffect/clearStaleTimers
 * above. A `c` with no grimoire, or a grimoire with no retired name at all,
 * is returned completely untouched (a genuine no-op, not merely a no-op on
 * the RETURNED value — `c.grimoire` itself is never reassigned unless a
 * rewrite is needed). Mutates and returns the passed `c`.
 *
 * Phase 90 plan 06 (SPELL-12, SPELL-10) widens it: an entry mapped to `null`
 * (Phantom Host) is dropped; so is any name no SPELLS row carries (a tampered
 * or non-string entry); and so is any spell whose school the sheet's sub-class
 * can NEVER learn (a Wizard's Mirror Self), judged only when `c.sub` names a
 * MU_CHART row (a sheet with no chart row keeps every real spell). The
 * surviving names keep their saved order, first occurrence wins a duplicate
 * (so a Lesser Summon before a Summon becomes the one Summon at its place, and
 * one after it is dropped). Run for the hero's sheet and every Joiner's
 * (migratePartySpellNames), by both load chains.
 */
function migrateSpellNames(c) {
  if (!c || typeof c !== "object" || Array.isArray(c) || !Array.isArray(c.grimoire)) return c;
  const charted = Object.prototype.hasOwnProperty.call(MU_CHART, c.sub);
  const resolve = (n) => (Object.prototype.hasOwnProperty.call(RETIRED_SPELL_NAMES, n) ? RETIRED_SPELL_NAMES[n] : n);
  const keep = (n) => {
    if (typeof n !== "string") return null;
    const name = resolve(n);
    const row = name === null ? undefined : SPELLS.find((sp) => sp.n === name);
    if (!row) return null;
    if (charted && !schoolAllowed(c.sub, row.s)) return null;
    return name;
  };
  // A book that needs no change is left completely untouched (not reassigned).
  const seenCheck = new Set();
  const clean = c.grimoire.every((n) => {
    const name = keep(n);
    if (name !== n || seenCheck.has(name)) return false;
    seenCheck.add(name);
    return true;
  });
  if (clean) return c;
  const seen = new Set();
  const next = [];
  for (const n of c.grimoire) {
    const name = keep(n);
    if (name === null || seen.has(name)) continue;
    seen.add(name);
    next.push(name);
  }
  c.grimoire = next;
  return c;
}

/**
 * migratePartySpellNames(party) — Phase 90 plan 06 (SPELL-12): the same
 * tolerant grimoire load for every Joiner sheet in the roster. Mutates each
 * sheet in place; returns the same array.
 */
function migratePartySpellNames(party) {
  for (const m of party) migrateSpellNames(m);
  return party;
}

/**
 * retireStrengthBoost(sheet) — Phase 90 (SPELL-09) tolerant load: the old
 * Strength spell doubled maximum hit points and recorded the amount it added
 * in a `strengthBoost` field (on the hero, and on a foe a fumbled scroll
 * strengthened). That field is retired. A positive number is subtracted from
 * `maxWP` (never below 1), `wp` is clamped into [1, maxWP] when it was above
 * the new maximum, and the field is deleted; any other value (zero, a string,
 * a tampered object) is simply deleted. A sheet without it is returned
 * byte-identical (a genuine no-op). Silent: no rng, no event. Mutates and
 * returns the passed `sheet`; never throws on a non-object.
 */
function retireStrengthBoost(sheet) {
  if (!sheet || typeof sheet !== "object" || Array.isArray(sheet) || !("strengthBoost" in sheet)) return sheet;
  const gain = sheet.strengthBoost;
  delete sheet.strengthBoost;
  if (typeof gain === "number" && Number.isFinite(gain) && gain > 0 && typeof sheet.maxWP === "number" && Number.isFinite(sheet.maxWP)) {
    sheet.maxWP = Math.max(1, sheet.maxWP - gain);
    if (typeof sheet.wp === "number" && sheet.wp > sheet.maxWP) sheet.wp = Math.max(1, sheet.maxWP);
  }
  return sheet;
}

/**
 * retireStrengthBoostInFight(combat) — Phase 90 (SPELL-09): the same
 * tolerant-load step for every foe of a resumed fight (a fumbled Strength
 * scroll could double a foe's hit points). A null or foe-less fight is
 * returned untouched. Mutates and returns `combat`.
 */
function retireStrengthBoostInFight(combat) {
  if (combat && typeof combat === "object" && Array.isArray(combat.foes)) {
    for (const f of combat.foes) retireStrengthBoost(f);
  }
  return combat;
}

// Phase 39 (GEAR-02): the retired scattered counters -> the ONE c.timers
// representation. `fallback` is the ACTIVATION_OF key used when NO carried
// item's own activation matches the counter's `kind` (a plain potion dose
// with no matching cloak/staff in the bag) — Speed/Invisible/Acuteness are
// the potion rows; ether has no potion source, so its fallback IS the cloak.
const LEGACY_COUNTER_META = {
  haste: { kind: "haste", fallback: "Speed", cadence: "squares" },
  invis: { kind: "invis", fallback: "Invisible", cadence: "squares" },
  ether: { kind: "ether", fallback: "Cloak of Ether", cadence: "squares" },
  acute: { kind: "acute", fallback: "Acuteness", cadence: "rounds" },
};

/**
 * foldItemActivation(c, it, steps) — module-private, Phase 39 (GEAR-02): the
 * ITEM half of foldLegacyCounters' migration, called once per carried item
 * (bag ∪ worn) BEFORE the counter half. Always strips a present `it.usedAt`.
 * A staff ALSO loses its legacy `it.every` outright (staves never had a real
 * per-use cooldown under the old model) and gets its `it.charges` clamped
 * into `[0, max]`, defaulting to a FULL pool when missing or a tampered
 * non-integer (T-39-06) — never reconstructed into a c.timers record. Every
 * other activatable item with a captured `usedAt` reconstructs a COOLDOWN
 * record (a saved elapsed-since-use time cannot tell an effect phase from a
 * cooldown phase apart, and the scattered-counter fold below is the more
 * trustworthy effect-duration signal anyway) — only when the reconstructed
 * cooldown still has time left; an item with no activation at all, or whose
 * activation carries no `cd`, is untouched beyond the `usedAt` strip.
 */
function foldItemActivation(c, it, steps) {
  if (!it || typeof it !== "object" || Array.isArray(it)) return;
  const usedAt = it.usedAt;
  delete it.usedAt;
  if (it.kind === "staff") {
    delete it.every;
    const act = activationFor(it);
    const max = act ? act.charges : undefined;
    if (max !== undefined) {
      it.charges = Number.isInteger(it.charges) ? Math.max(0, Math.min(max, it.charges)) : max;
    }
    return;
  }
  if (typeof usedAt !== "number" || typeof steps !== "number") return;
  const act = activationFor(it);
  if (!act || act.charges !== undefined || !act.cd) return;
  const left = act.cd - (steps - usedAt);
  if (left > 0) startCooldown(c, itemTimerId(it), { squares: left });
}

/**
 * foldLegacyCounters(c, steps) — Phase 39 (GEAR-02) tolerant-load migration:
 * rehydrates the six retired scattered counters (`haste`/`invis`/`ether`/
 * `acute` on `c`; `flightLeft`/`flightCooldown`) and every carried item's
 * legacy `it.usedAt`/`it.every`-based cooldown gate into the ONE `c.timers`
 * representation, then always deletes the six legacy character keys (when
 * present). Runs LAST in both load chains (after `ensureCharacterAbilities`)
 * so it runs before the unconditional `reconcileWorn`.
 *
 * Order: items FIRST (`foldItemActivation` above, per carried item), then
 * counters SECOND — a POSITIVE legacy counter always starts a fresh EFFECT
 * record (`startEffect` always overwrites, per effects.js), so "an active
 * effect wins over a folded cooldown for the same id" the item pass may have
 * started a moment earlier. The record id is resolved to whichever CARRIED
 * item's own activation shares the counter's `kind` (bag ∪ worn), or the
 * `LEGACY_COUNTER_META` fallback key when none matches. `flightLeft`/
 * `flightCooldown` fold the same way into the ONE `item:Cloak of Flying`
 * record (effect when `flightLeft > 0`, else a cooldown when
 * `flightCooldown > 0`, else nothing — already ready).
 *
 * Never injects `c.timers` (or any record) when nothing actually needs
 * folding — every call site here is additive-with-default, mirroring
 * `clearStaleTimers`/`clearFoeEffect`'s own discipline. Pure w.r.t. rng;
 * mutates and returns the passed `c`.
 */
export function foldLegacyCounters(c, steps) {
  if (!c || typeof c !== "object" || Array.isArray(c)) return c;
  const carried = carriedItems(c);
  for (const it of carried) foldItemActivation(c, it, steps);

  for (const meta of Object.values(LEGACY_COUNTER_META)) {
    const val = c[meta.kind];
    if (typeof val === "number" && val > 0) {
      const source = carried.find((x) => x && activationFor(x)?.kind === meta.kind);
      const key = source ? activationKeyFor(source) : meta.fallback;
      const act = ACTIVATION_OF[key];
      const opts = act && act.cd ? { [meta.cadence]: val, cd: act.cd } : { [meta.cadence]: val };
      startEffect(c, `item:${key}`, opts);
    }
  }

  if (typeof c.flightLeft === "number" && c.flightLeft > 0) {
    const act = ACTIVATION_OF["Cloak of Flying"];
    startEffect(c, "item:Cloak of Flying", { squares: c.flightLeft, cd: act.cd });
  } else if (typeof c.flightCooldown === "number" && c.flightCooldown > 0) {
    startCooldown(c, "item:Cloak of Flying", { squares: c.flightCooldown });
  }

  for (const k of ["haste", "invis", "ether", "acute", "flightLeft", "flightCooldown"]) delete c[k];
  return c;
}

/**
 * refreshItemTexts(state) — Phase 89 plan 09 (TEXT-01): the tolerant-load text
 * refresh. A saved item carries its own `txt`, so a save made before a
 * reworded row would keep the old words on the Gear tab, the store, the loot and
 * find cards. Every item the save holds that has a content row
 * (derived.js#canonItemText) gets that row's current text: the hero's bag, worn
 * slots and wielded staff, each Joiner's bag, worn slots and staff, the pending
 * find, the loot pile, and an open store's lines (an item line's carried item,
 * and a potion line's `sub`, which is the potion's text). WORDS ONLY: it writes
 * `txt` and a potion line's `sub` and nothing else, draws no rng, narrates
 * nothing, and is idempotent. An item with no content row (a weapon, armour,
 * lockpicks, a bag, a scroll, a name no table knows) keeps whatever text it had.
 * Run by both load chains (validateSave and rehydrate) after every other
 * reconcile. Mutates and returns `state`.
 */
export function refreshItemTexts(state) {
  if (!isPlainObject(state)) return state;
  /** fresh(it) — set the item's text to its row's, returning its text from before (or undefined). */
  const fresh = (it) => {
    if (!isPlainObject(it)) return undefined;
    const before = it.txt;
    const canon = canonItemText(it);
    if (typeof canon === "string" && canon !== before) it.txt = canon;
    return before;
  };
  const sheet = (c) => {
    if (!isPlainObject(c)) return;
    if (Array.isArray(c.items)) c.items.forEach(fresh);
    if (isPlainObject(c.worn)) Object.values(c.worn).forEach(fresh);
    fresh(c.staff);
  };
  sheet(state.c);
  if (Array.isArray(state.party)) state.party.forEach(sheet);
  fresh(state.pendingFind);
  if (Array.isArray(state.pendingLoot)) state.pendingLoot.forEach(fresh);
  if (isPlainObject(state.store) && Array.isArray(state.store.stock)) {
    for (const line of state.store.stock) {
      const item = isPlainObject(line) && isPlainObject(line.effectParams) ? line.effectParams.item : null;
      if (!isPlainObject(item)) continue;
      const before = fresh(item);
      // A potion line prints the potion's text as its `sub`; keep the two the same words.
      if (item.kind === "potion" && typeof line.sub === "string" && line.sub === before) line.sub = item.txt;
    }
  }
  return state;
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
 * Phase 45 (HEDGE-02): the load unconditionally reconciles `c.worn` via
 * `reconcileWorn(value.c)` — the first item of each slot type (in bag order)
 * is worn, every later copy stays bagged; this can never overflow the bag
 * (bag -> worn only frees slots). A save that already carries `c.worn` is
 * NEVER re-migrated (`reconcileWorn` is itself a no-op, returning `null`, on
 * a `c` that already has the key — coalesced to `[]` below). The
 * reconciliation is always returned as `wornReport` — a NEW, additive
 * return-value key, never a serialized field — one shape, never a
 * conditional key: `[]` when nothing was wearable or the save was already
 * migrated, an array of `{ slot, worn, bagged }` entries otherwise.
 *
 * Phase 88 (ITEM-02): right after reconcileWorn, `reconcileItemSources` links
 * (or quietly ends) every live item effect on the hero and each Joiner sheet.
 *
 * @param {string|object} raw
 * @param {{ freshSeed?: number }} [options]
 * @returns {{ ok: true, value: object, wornReport: Array } | { ok: false, reason: string }}
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

  // Phase 40 (SPELL-05, Plan 04): the fully migrated/sanitized c, computed
  // FIRST in a local — migrateSpellNames runs innermost (before
  // migrateCarry/clearFoeEffect/clearStaleTimers/sanitizeWorn/
  // ensureCharacterAbilities/foldLegacyCounters, exactly like every other
  // additive-with-default helper in this chain) so a retired grimoire name
  // is rewritten before anything else ever reads c.grimoire. The floor-side
  // clearStaleSpellSeen below needs this SAME final c (not obj.c) — it must
  // see whatever c.timers looks like AFTER foldLegacyCounters, since that is
  // the only migration step that could ever touch c.timers.
  // RULES-14 (Phase 75): sanitizeWard runs OUTERMOST (matching
  // sanitizeWaterCells' own "newest migration wraps the previous one"
  // convention below) — a pre-Phase-75 reflecting ward becomes the armed
  // mirror after every other migration step has already run. RULES-13
  // (Phase 75): sanitizeStaff runs OUTERMOST of all — after sanitizeWard —
  // repairing/dropping a tampered or stale c.staff/c.weapon pair last, once
  // every other field on `c` has already settled.
  // SAV-06 (Phase 76): the party and the resumed fight are settled FIRST, so
  // the `c` chain below knows whether a fight survives this load
  // (clearFoeEffect/clearStaleTimers keep the fight's hero-side state only
  // then). Phase 38 (ABIL-05): each party member gets the same tolerant-load
  // rebuild, keyed joiner:<name>:0 (see ensurePartyAbilities's JSDoc).
  const party = migratePartySpellNames(ensurePartyAbilities(sanitizeParty(obj.party)));
  const partyIntact = !Array.isArray(obj.party) || party.length === obj.party.length;
  // Phase 90 (SPELL-09): the retired Strength doubling is unwound on the hero
  // and on every foe of a resumed fight.
  const combat = retireStrengthBoostInFight(sanitizeCombat(obj.combat, party, partyIntact));
  const fightSurvives = !!combat;

  const migratedC = sanitizeStaff(
    sanitizeWard(
      foldLegacyCounters(
        ensureCharacterAbilities(
          sanitizeWorn(clampRevealWindow(clearStaleTimers(sanitizePhobiaFields(clearFoeEffect(migrateCarry(retireStrengthBoost(migrateSpellNames(obj.c))), fightSurvives)), fightSurvives))),
          seed,
        ),
        steps,
      ),
    ),
  );
  // Phase 40 (SPELL-05, Plan 04) / Phase 41 (TERR-01): see the floor comment
  // in the value literal below. Computed here so the resumed pending hazard
  // and tile are checked against the SAME sanitized floor the run loads with.
  const floor = sanitizeWaterCells(clearStaleSpellSeen(obj.floor, migratedC));
  const resumed = resumedSubState(obj, combat, floor);

  const value = {
    version: STATE_VERSION,
    seed,
    rngState,
    // ECON-01 (Phase 12): default a missing c.bag by class (see migrateCarry).
    // Phase 19 FID-04: null a present-but-stale c.foeEffect (see clearFoeEffect).
    // Phase 36 (BAL foundation): clear a present-but-stale c.timers rounds
    // record / drop a tampered value (see clearStaleTimers); never injected.
    // Phase 37 (GEAR-04): neutralise a present-but-tampered c.worn (see
    // sanitizeWorn) before reconcileWorn below ever reads it. SAV-06 (Phase
    // 76): clearFoeEffect/clearStaleTimers keep the fight's hero-side state
    // when the fight survives this load. Phase 38 (ABIL-02):
    // ensureCharacterAbilities is the tolerant-load rebuild for c.abilities
    // (a no-op once the field is already an array). Phase 39 (GEAR-02):
    // foldLegacyCounters runs LAST of all — the retired haste/invis/ether/
    // acute/flightLeft/flightCooldown counters and every item's legacy
    // usedAt/every fold into c.timers here, after everything else above has
    // finished migrating/sanitizing c. See migratedC's own comment above for
    // the Phase 40 (SPELL-05) addition to this chain.
    c: migratedC,
    // Phase 40 (SPELL-05, Plan 04): clearStaleSpellSeen strips every stale
    // spellSeen flag when migratedC carries no LIVE spell:reveal record
    // (T-40-07); a live record is left completely untouched. Phase 41
    // (TERR-01): sanitizeWaterCells runs OUTERMOST — it only ever drops a
    // tampered non-true water value, never injects one, so composing it
    // after clearStaleSpellSeen (which never touches `water`) is order-
    // independent in practice, but outermost matches this chain's own
    // "newest migration wraps the previous one" convention.
    floor,
    day,
    steps,
    // Phase 65 (RUN-01): absent on a pre-Phase-65 save, so it loads as 0 and
    // counts from the load point. A tampered value (negative, fractional,
    // NaN, non-number) is never trusted and also loads as 0.
    acts: Number.isInteger(obj.acts) && obj.acts >= 0 ? obj.acts : 0,
    // Phase 38 (ABIL-05): see the party local above.
    party,
    // SAV-06/SAV-07 (Phase 76, DECLARED CANON DIVERGENCE from the 1994
    // load): a live fight, an open store, a pending find, a pending hazard
    // decision and a pending tile are resumed when valid and dropped (null)
    // when not — see resumedSubState and the sanitizers above. A pending
    // Joiner offer rides along only when the save carries the key.
    combat: resumed.combat,
    store: resumed.store,
    pendingFind: resumed.pendingFind,
    // Phase 29 (LOOT-06): pendingLoot is PERSISTENT run state (the player
    // must still get their loot screen on resume) — carried through here.
    pendingLoot: sanitizeLoot(obj.pendingLoot),
    dead: !!obj.dead,
    // Phase 46 (DEAD-04): the retired run-terminator flag is deliberately
    // absent from this whitelist now — a stale save carrying it (any value)
    // loads tolerantly; the key is simply never copied, never rejected.
    // Phase 21 (D-14/D-23): boolean-coerced like dead; absent on a
    // pre-Phase-21 save → false.
    dev: !!obj.dev,
    // Phase 33 (STORE-01): boolean-coerced like dev/dead; absent on a
    // pre-Phase-33 save → false, so an old save keeps today's fixed store
    // stock and never gains the new draws mid-run.
    storeRoll: !!obj.storeRoll,
    // Phase 39 (GEAR-05) / SAV-06 (Phase 76): the hazard pre-roll decision
    // survives a relaunch only while it still matches the cell one step in
    // its direction (sanitizePendingHazard); a tampered/stale value is never
    // trusted (T-39-11) and loads as null — the engine re-derives the
    // decision on the next step.
    pendingHazard: resumed.pendingHazard,
    // RULES-12 (Phase 75) / SAV-06 (Phase 76): the tile a wandering monster
    // interrupted resumes with the fight it was waiting on, when it is on
    // this floor (sanitizePendingTile); resolvePendingTile re-checks the rest.
    pendingTile: resumed.pendingTile,
    deathNote: obj.deathNote || "",
    epitaph: obj.epitaph || "",
  };
  // SAV-06 (Phase 76, user ruling 2026-09-25): the Joiner offer — only when
  // the save carries the key, so a fresh run never gains it.
  if ("pendingJoiner" in resumed) value.pendingJoiner = resumed.pendingJoiner;
  // MD-01: pass deathAt/lastWords through the validated value too, so a
  // terminal (dead) run's real save/load path — validateSave then
  // rehydrate() — doesn't lose them even though rehydrate() alone now
  // preserves them when present on its input.
  if (obj.deathAt !== undefined) value.deathAt = obj.deathAt;
  if (obj.lastWords !== undefined) value.lastWords = obj.lastWords;

  // Phase 45 (HEDGE-02): unconditional since Phase 45 — reconcileWorn is a
  // no-op returning null on a save that already carries `worn` (a save this
  // migrated last time, or a fresh newRun's save, round-trips byte-
  // identical), coalesced to `[]` below. `wornReport` is a return value,
  // never a serialized field — one shape, never a conditional key.
  const wornReport = reconcileWorn(value.c) ?? [];
  // Phase 88 (ITEM-02): after reconcileWorn (a legacy worn map is built there)
  // and sanitizeStaff, link or quietly end every live item effect on the hero
  // and on each Joiner sheet — see reconcileItemSources.
  reconcileItemSources(value.c);
  // Phase 89 (ITEM-07, tolerant load): a saved Joiner is dressed the way a new
  // one is (CONTEXT "Carried gear is worn on joining"): a tampered worn map is
  // neutralised as the hero's is, then a Joiner with no worn map wears the
  // cloak or jewel in its bag (reconcileWorn is a no-op on one that already has
  // a map). Before its effect-source link is reconciled. No event, no rng.
  for (const member of value.party) {
    sanitizeWorn(member);
    reconcileWorn(member);
    reconcileItemSources(member);
  }
  // Phase 89 plan 09 (TEXT-01): last, so every other reconcile has run. Words only.
  refreshItemTexts(value);
  return { ok: true, value, wornReport };
}

/**
 * rehydrate(obj) — turns a validated save (`validateSave(...).value`,
 * or an equally-shaped `serializeRun` output) into a GameState ready for
 * `applyAction`. SAV-06/SAV-07 (Phase 76, a DECLARED CANON DIVERGENCE from
 * the prototype's load(), which never resumed mid-combat or mid-store): a
 * live fight, an open store and the pending find/hazard/tile (plus a Joiner
 * offer when the key is present) are resumed when valid and nulled when not,
 * through the SAME resumedSubState builder validateSave uses. `beats` (UI
 * animation state) is always null after a load.
 *
 * Reconciles `c.worn` unconditionally since Phase 45 (HEDGE-02) — a no-op
 * after `validateSave`'s own call (reconcileWorn returns null on a `c` that
 * already has `worn`), one-shot for a direct caller (bypassing validateSave,
 * e.g. a test). The report is discarded — `boot()` reads it from
 * `validateSave`'s own return value instead (`takeBootWornReport`).
 * Phase 88 (ITEM-02): `reconcileItemSources` then runs on the hero and each
 * Joiner sheet, exactly as in validateSave (idempotent on its own output).
 *
 * @param {object} obj
 */
export function rehydrate(obj) {
  // Phase 40 (SPELL-05, Plan 04): mirrors validateSave's own migratedC local
  // (see its comment there) — rehydrate() is exercised standalone against a
  // raw serialized state in tests (and is idempotent on an already-migrated
  // one, since boot()'s real path always calls it on validateSave's OWN
  // output), so it needs the identical migrateSpellNames/clearStaleSpellSeen
  // treatment to stay consistent between the two entry points. RULES-14
  // (Phase 75): sanitizeWard runs OUTERMOST here too, mirroring
  // validateSave's own composition exactly. RULES-13 (Phase 75):
  // sanitizeStaff runs OUTERMOST of all here too, mirroring validateSave.
  // SAV-06 (Phase 76): mirrors validateSave — the party and the resumed fight
  // first, so the `c` chain knows whether a fight survives.
  const party = migratePartySpellNames(ensurePartyAbilities(sanitizeParty(obj.party)));
  const partyIntact = !Array.isArray(obj.party) || party.length === obj.party.length;
  // Phase 90 (SPELL-09): mirrors validateSave's retired-Strength unwinding.
  const combat = retireStrengthBoostInFight(sanitizeCombat(obj.combat, party, partyIntact));
  const fightSurvives = !!combat;
  const migratedC = sanitizeStaff(
    sanitizeWard(
      foldLegacyCounters(
        ensureCharacterAbilities(
          sanitizeWorn(clampRevealWindow(clearStaleTimers(sanitizePhobiaFields(clearFoeEffect(migrateCarry(retireStrengthBoost(migrateSpellNames(obj.c))), fightSurvives)), fightSurvives))),
          obj.seed,
        ),
        obj.steps ?? 0,
      ),
    ),
  );
  // Phase 41 (TERR-01): sanitizeWaterCells mirrors validateSave's own call —
  // see its comment there. Computed before the literal so the resumed
  // pending hazard and tile are checked against this same floor.
  const floor = sanitizeWaterCells(clearStaleSpellSeen(obj.floor, migratedC));
  const resumed = resumedSubState(obj, combat, floor);
  const state = {
    version: STATE_VERSION,
    seed: obj.seed,
    rngState: obj.rngState,
    // ECON-01 (Phase 12): default a missing c.bag by class (migrateCarry),
    // mirroring the validateSave side so a save loaded through either entry
    // point lands with a bag. Phase 19 FID-04: null a present-but-stale
    // c.foeEffect (see clearFoeEffect) — kept only with a surviving fight
    // (SAV-06, Phase 76). Phase 36 (BAL foundation): clear a present-but-
    // stale c.timers rounds record when no fight survives / drop a tampered
    // value (see clearStaleTimers); never injected. Phase 37
    // (GEAR-04): neutralise a present-but-tampered c.worn (see sanitizeWorn)
    // before reconcileWorn below ever reads it. Phase 38
    // (ABIL-02): ensureCharacterAbilities mirrors validateSave's own call —
    // a no-op once c.abilities is already an array. Phase 39 (GEAR-02):
    // foldLegacyCounters mirrors validateSave's own call, LAST in the chain.
    // Phase 40 (SPELL-05, Plan 04): migrateSpellNames/clearStaleSpellSeen
    // mirror validateSave's own calls too — see migratedC above.
    c: migratedC,
    floor,
    day: obj.day ?? 1,
    steps: obj.steps ?? 0,
    // Phase 65 (RUN-01): absent on a pre-Phase-65 save, so it loads as 0 and
    // counts from the load point. A tampered value (negative, fractional,
    // NaN, non-number) is never trusted and also loads as 0.
    acts: Number.isInteger(obj.acts) && obj.acts >= 0 ? obj.acts : 0,
    // SAV-06/SAV-07 (Phase 76): the live fight and open store resume when
    // valid and load as null when not (resumedSubState, shared with
    // validateSave). `beats` is UI animation state and is never restored.
    combat: resumed.combat,
    store: resumed.store,
    beats: null,
    // ECON-02 (Phase 12) / SAV-06 (Phase 76): a pending find prompt resumes
    // when valid (sanitizePendingFind); a missing or broken one loads as null.
    pendingFind: resumed.pendingFind,
    // Phase 39 (GEAR-05) / SAV-06 (Phase 76): the hazard decision resumes
    // while it still matches its neighbour cell (sanitizePendingHazard).
    pendingHazard: resumed.pendingHazard,
    // RULES-12 (Phase 75) / SAV-06 (Phase 76): the interrupted tile resumes
    // with its fight when it is on this floor (sanitizePendingTile).
    pendingTile: resumed.pendingTile,
    // Phase 29 (LOOT-06): pendingLoot is PERSISTENT run state — the player
    // must still get their loot screen back on resume, so it is carried
    // through here, never reset.
    pendingLoot: sanitizeLoot(obj.pendingLoot),
    // PARTY-02 (Phase 7): whitelist the persistent roster, mirroring dead
    // above. sanitizeParty fail-opens a missing party (pre-Phase-7 save) to []
    // and drops malformed members, so old saves load with `party: []` and zero
    // other data loss. serializeRun's state spread already persists it; this is
    // the explicit read-back side. A dropped member also drops a resumed
    // fight that carries allies (sanitizeCombat's partyIntact rule).
    // Phase 38 (ABIL-05): ensurePartyAbilities mirrors validateSave's own call.
    party,
    dead: !!obj.dead,
    // Phase 46 (DEAD-04): the retired run-terminator flag is deliberately
    // absent from this whitelist now — a stale save carrying it (any value)
    // loads tolerantly; the key is simply never copied, never rejected.
    // Phase 21 (D-14/D-23): boolean-coerced like dead; absent on a
    // pre-Phase-21 save → false.
    dev: !!obj.dev,
    // Phase 33 (STORE-01): boolean-coerced like dev/dead; absent on a
    // pre-Phase-33 save → false, so an old save keeps today's fixed store
    // stock and never gains the new draws mid-run.
    storeRoll: !!obj.storeRoll,
    deathNote: obj.deathNote || "",
    epitaph: obj.epitaph || "",
  };
  // MD-01: die() also sets deathAt/lastWords on a terminal run, and
  // serializeRun() (which spreads the FULL state) preserves them — round-trip
  // them here too rather than silently dropping a dead run's time-of-death
  // and "last words" on reload. Only added when present so a save that never
  // reached a terminal state doesn't gain spurious `undefined` fields.
  if (obj.deathAt !== undefined) state.deathAt = obj.deathAt;
  if (obj.lastWords !== undefined) state.lastWords = obj.lastWords;
  // SAV-06 (Phase 76, user ruling 2026-09-25): the Joiner offer — only when
  // the save carries the key (never injected into a fresh run).
  if ("pendingJoiner" in resumed) state.pendingJoiner = resumed.pendingJoiner;
  // Phase 45 (HEDGE-02): unconditional, mirroring validateSave's own call
  // above — a no-op (reconcileWorn returns null and touches nothing) when
  // state.c already carries an own `worn` key, so a save validateSave
  // already migrated (or a fresh newRun's save) is never re-migrated here.
  // The report is discarded — a caller that needs it uses validateSave
  // directly (engineAdapter#boot does exactly that).
  reconcileWorn(state.c);
  // Phase 88 (ITEM-02): mirrors validateSave — the same link-or-quietly-end
  // reconciliation for the hero and every Joiner sheet; idempotent after it.
  reconcileItemSources(state.c);
  // Phase 89 (ITEM-07): mirrors validateSave's Joiner loop (sanitize the worn
  // map, dress a Joiner that has none, then link its effects); a no-op on a
  // Joiner validateSave already dressed.
  for (const member of state.party) {
    sanitizeWorn(member);
    reconcileWorn(member);
    reconcileItemSources(member);
  }
  // Phase 89 plan 09 (TEXT-01): mirrors validateSave's closing call. Idempotent.
  refreshItemTexts(state);
  return state;
}
