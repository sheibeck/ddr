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
import { clearRoundTimers, startEffect, startCooldown } from "./effects.js";
import {
  reconcileWorn,
  activationFor,
  activationKeyFor,
  itemTimerId,
  carriedItems,
  WORN_SLOTS,
  clampCarry,
  freeWornKey,
} from "./derived.js";
import { ensureAbilities } from "./character.js";
import { ACTIVATION_OF } from "../content/index.js";

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
 * BEFORE any rule reads `c.worn` — `combat` is always reset to null on load,
 * but `c.worn` is persistent run state, so a tampered value must be
 * neutralised, not merely combat-scoped like `foeEffect`.
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
 * no-op without `c.bag`. No dual path: every load runs this, whether or not
 * the save ever had `c.worn` (the whole block is itself gated on `"worn" in
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
      if (c.worn.staff) {
        c.items = Array.isArray(c.items) ? c.items : [];
        c.items.push(c.worn.staff);
        delete c.worn.staff;
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
          }
        }
        delete c.worn[legacyKey];
      }
      for (const slot of Object.keys(c.worn)) {
        if (!WORN_SLOTS.includes(slot)) delete c.worn[slot];
      }
      clampCarry(c);
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
 * RETIRED_SPELL_NAMES — Phase 40 (SPELL-05): the one rename this migration
 * ever needs to know about — "Detect Magic" became "Map the Floor". A
 * frozen, single-entry map so a FUTURE rename can extend it without
 * touching migrateSpellNames itself.
 */
const RETIRED_SPELL_NAMES = Object.freeze({ "Detect Magic": "Map the Floor" });

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
 */
function migrateSpellNames(c) {
  if (!c || typeof c !== "object" || Array.isArray(c) || !Array.isArray(c.grimoire)) return c;
  if (!c.grimoire.some((n) => Object.prototype.hasOwnProperty.call(RETIRED_SPELL_NAMES, n))) return c;
  const seen = new Set();
  const next = [];
  for (const n of c.grimoire) {
    const renamed = Object.prototype.hasOwnProperty.call(RETIRED_SPELL_NAMES, n) ? RETIRED_SPELL_NAMES[n] : n;
    if (seen.has(renamed)) continue;
    seen.add(renamed);
    next.push(renamed);
  }
  c.grimoire = next;
  return c;
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
  const migratedC = foldLegacyCounters(
    ensureCharacterAbilities(sanitizeWorn(clearStaleTimers(sanitizePhobiaFields(clearFoeEffect(migrateCarry(migrateSpellNames(obj.c)))))), seed),
    steps,
  );

  const value = {
    version: STATE_VERSION,
    seed,
    rngState,
    // ECON-01 (Phase 12): default a missing c.bag by class (see migrateCarry).
    // Phase 19 FID-04: null a present-but-stale c.foeEffect (see clearFoeEffect).
    // Phase 36 (BAL foundation): clear a present-but-stale c.timers rounds
    // record / drop a tampered value (see clearStaleTimers); never injected.
    // Phase 37 (GEAR-04): neutralise a present-but-tampered c.worn (see
    // sanitizeWorn) before reconcileWorn below ever reads it. pendingFind
    // is transient (like combat/store) — not carried through
    // validateSave's value; rehydrate() nulls it below. Phase 38 (ABIL-02):
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
    floor: sanitizeWaterCells(clearStaleSpellSeen(obj.floor, migratedC)),
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
    // Phase 39 (GEAR-05): pendingHazard is transient run state — always
    // reset to null (rehydrate below mirrors this), exactly like
    // pendingFind above; a tampered/stale save-side value is never trusted
    // (T-39-11) — the engine re-derives the decision on the next step.
    pendingHazard: null,
    deathNote: obj.deathNote || "",
    epitaph: obj.epitaph || "",
  };
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
  return { ok: true, value, wornReport };
}

/**
 * rehydrate(obj) — turns a validated save (`validateSave(...).value`,
 * or an equally-shaped `serializeRun` output) into a GameState ready for
 * `applyAction`: combat/store/beats always reset to null (the prototype's
 * load() never resumed mid-combat or mid-store either).
 *
 * Reconciles `c.worn` unconditionally since Phase 45 (HEDGE-02) — a no-op
 * after `validateSave`'s own call (reconcileWorn returns null on a `c` that
 * already has `worn`), one-shot for a direct caller (bypassing validateSave,
 * e.g. a test). The report is discarded — `boot()` reads it from
 * `validateSave`'s own return value instead (`takeBootWornReport`).
 *
 * @param {object} obj
 */
export function rehydrate(obj) {
  // Phase 40 (SPELL-05, Plan 04): mirrors validateSave's own migratedC local
  // (see its comment there) — rehydrate() is exercised standalone against a
  // raw serialized state in tests (and is idempotent on an already-migrated
  // one, since boot()'s real path always calls it on validateSave's OWN
  // output), so it needs the identical migrateSpellNames/clearStaleSpellSeen
  // treatment to stay consistent between the two entry points.
  const migratedC = foldLegacyCounters(
    ensureCharacterAbilities(sanitizeWorn(clearStaleTimers(sanitizePhobiaFields(clearFoeEffect(migrateCarry(migrateSpellNames(obj.c)))))), obj.seed),
    obj.steps ?? 0,
  );
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
    // before reconcileWorn below ever reads it. Phase 38
    // (ABIL-02): ensureCharacterAbilities mirrors validateSave's own call —
    // a no-op once c.abilities is already an array. Phase 39 (GEAR-02):
    // foldLegacyCounters mirrors validateSave's own call, LAST in the chain.
    // Phase 40 (SPELL-05, Plan 04): migrateSpellNames/clearStaleSpellSeen
    // mirror validateSave's own calls too — see migratedC above.
    c: migratedC,
    // Phase 41 (TERR-01): sanitizeWaterCells mirrors validateSave's own call
    // above — see its comment there.
    floor: sanitizeWaterCells(clearStaleSpellSeen(obj.floor, migratedC)),
    day: obj.day ?? 1,
    steps: obj.steps ?? 0,
    combat: null,
    store: null,
    beats: null,
    // ECON-02 (Phase 12): pendingFind is transient run state — always reset to
    // null on load, exactly like combat/store above (the prototype's load()
    // never resumed a mid-find prompt either). Defaults a missing field to null.
    pendingFind: null,
    // Phase 39 (GEAR-05): pendingHazard is transient run state — always
    // reset to null on load, exactly like pendingFind just above (mirrors
    // validateSave's own reset above).
    pendingHazard: null,
    // Phase 29 (LOOT-06): pendingLoot is PERSISTENT run state (unlike
    // pendingFind just above) — the player must still get their loot screen
    // back on resume, so it is carried through here, never reset.
    pendingLoot: sanitizeLoot(obj.pendingLoot),
    // PARTY-02 (Phase 7): whitelist the persistent roster, mirroring dead
    // above. sanitizeParty fail-opens a missing party (pre-Phase-7 save) to []
    // and drops malformed members, so old saves load with `party: []` and zero
    // other data loss. serializeRun's state spread already persists it; this is
    // the explicit read-back side. combat is still nulled (roster is persistent,
    // combat sub-state is transient), so the party correctly survives reload.
    // Phase 38 (ABIL-05): ensurePartyAbilities mirrors validateSave's own call.
    party: ensurePartyAbilities(sanitizeParty(obj.party)),
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
  // Phase 45 (HEDGE-02): unconditional, mirroring validateSave's own call
  // above — a no-op (reconcileWorn returns null and touches nothing) when
  // state.c already carries an own `worn` key, so a save validateSave
  // already migrated (or a fresh newRun's save) is never re-migrated here.
  // The report is discarded — a caller that needs it uses validateSave
  // directly (engineAdapter#boot does exactly that).
  reconcileWorn(state.c);
  return state;
}
