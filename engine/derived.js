// engine/derived.js
//
// Pure, state-scoped derived character numbers (ENG-01). Ports the prototype's
// strikeDie/toHit/weaponDamage/upkeep/foeDie/foeToHitVs/inDark/levelFromSP/eff/
// skill helpers (mazeworld.html lines 1444-1498, 628-629, 1872-1876) and the
// Magic-User school gate helpers (lines 879-887), replacing every global `S.c`
// read with an explicit passed `c` (character) or `state` parameter. No global
// S, no DOM, no Math.random — only pure reads and arithmetic.

import { CLASSES, RACES, WEAPONS, STRIKE_DICE, THRESHOLDS, MU_CHART, ARMORS, BAGS, SPELLS, SPELL_LEVEL_OVERRIDES, SLOT_OF } from "../content/index.js";
import { rollDice } from "./dice.js";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// WR-02 (19-REVIEW.md): the single source of truth for the Death-phobia
// near-death panic threshold — a character at/below this fraction of their
// own maxWP counts as "near death" for both the combat-freeze check
// (engine/combat.js#startCombat) and this module's own phobia chip
// (conditionsOf below). Previously duplicated as two independent literals
// that had to be kept in sync by hand; exported here (the leaf module) and
// imported by engine/combat.js so a future balance tweak only ever touches
// one place.
export const DEATH_PANIC_THRESHOLD = 0.25; // near-death: at/below 25% of maxWP

// TUNING KNOBS — Afraid (Phase 31, user ruling 2026-09-16: "Phobia should be
// penalties, never a no actions state"). A triggered phobia
// (engine/combat.js#fight) sets `combat.afraid = AFRAID_ROUNDS`: for that
// many ROUNDS (ticked once per foeTurn call at the foeTurn tail, cleared
// unconditionally when the combat ends at endCombat), the player's strike
// to-hit RANGE SHRINKS by AFRAID_TO_HIT_PENALTY — the game's to-hit is a LOW
// range (a strike lands on roll <= need), so a SMALLER need is HARDER to hit;
// see afraidNeed below, floor 1, and an untouchable (need 0) foe is never
// made hittable by fear — and the player's already-rolled weapon damage is
// halved (AFRAID_DMG_DIV, Math.ceil, floor 1; see afraidDamage below). Every
// other action stays fully available while afraid — nothing is ever refused
// for fear (see refuseIfPending in engine/combat.js, which never fires on an
// afraid character, only a pending one).
export const AFRAID_ROUNDS = 2;
export const AFRAID_TO_HIT_PENALTY = 3;
export const AFRAID_DMG_DIV = 2;

// --- skills (state-scoped, not global) -------------------------------------

/** skill(c, name) — does the character have skill `name` at all? */
export const skill = (c, n) => !!(c.skills && c.skills[n]);

/** skillTier(c, name) — 0 (none), 1, or 2 (raised). */
export const skillTier = (c, n) => (c.skills && c.skills[n]) || 0;

/**
 * eff(c, key) — sum of the named effect across the character's items.
 *
 * Phase 37 (GEAR-03/eff-refactor): TWO-PATH. When `c` carries an own `worn`
 * key (the new one-per-slot model, `c.worn = { ring?, bracelet?, amulet?,
 * helm?, cloak?, staff? }`, lazily created by reconcileWorn/newRun's
 * `wornSlots` option), only the populated `c.worn` entries are summed — a
 * bag copy of a worn item's type is NEVER counted (this is the whole point
 * of the model: one-per-slot, not sum-of-every-carried-copy). When `c`
 * carries NO `worn` key (every existing fixture, bot run, and un-migrated
 * save — the legacy path), this is the BYTE-IDENTICAL prototype rule:
 * sum over every item in `c.items`, exactly as before this phase. Pure, no
 * rng, no mutation.
 */
export function eff(c, key) {
  if ("worn" in c) {
    let t = 0;
    const worn = c.worn && typeof c.worn === "object" ? c.worn : {};
    for (const it of Object.values(worn)) if (it && it.eff && it.eff[key]) t += it.eff[key];
    return t;
  }
  let t = 0;
  for (const it of c.items || []) if (it.eff && it.eff[key]) t += it.eff[key];
  return t;
}

/**
 * slotItems(c) — LOOT-04 user rule (2026-09-15): only gear and treasure
 * consume bag slots. Healing potions (`c.potions`) and scrolls (`c.scrolls`)
 * are already scalars; SPECIAL potions (`kind:"potion"`, e.g. Acuteness) live
 * in `c.items` but are exempt from the slot count. This is THE capacity count
 * every engine and shell site must read instead of a raw `c.items.length`.
 * Defensive against null/undefined entries and a missing/non-array `c.items`
 * (returns `[]`); never mutates.
 */
export function slotItems(c) {
  return (c && Array.isArray(c.items) ? c.items : []).filter((it) => it && it.kind !== "potion");
}

/**
 * WORN_SLOTS — Phase 37 (GEAR-03): the six worn-slot keys, in a fixed
 * display/report order. Frozen. `c.worn = { ring?, bracelet?, amulet?,
 * helm?, cloak?, staff? }` is the one-per-slot map these keys address.
 */
export const WORN_SLOTS = Object.freeze(["ring", "bracelet", "amulet", "helm", "cloak", "staff"]);

/**
 * slotFor(it) — Phase 37 (GEAR-03): which worn slot item `it` belongs to, or
 * `null` if it is not a slot item at all (weapon/armor/potion/scroll/picks/
 * bag/etc). Resolution order: `it.slot` when the item itself carries a
 * string `slot` (forward-compat — no current construction site spreads one,
 * see content/treasure-tables.js's header comment, but a future one might);
 * else `SLOT_OF[it.n]` (content/treasure-tables.js's name-keyed taxonomy,
 * covering every current JEWELRY/CLOAKS/STAVES row); else a `kind` fallback
 * for a cloak/staff rolled under a name SLOT_OF doesn't recognize (e.g. a
 * save from before this taxonomy existed, or test fixtures). Null-safe: a
 * non-object `it` returns null. Pure, no rng, no mutation.
 */
export function slotFor(it) {
  if (!it || typeof it !== "object") return null;
  if (typeof it.slot === "string") return it.slot;
  if (SLOT_OF[it.n] !== undefined) return SLOT_OF[it.n];
  if (it.kind === "cloak") return "cloak";
  if (it.kind === "staff") return "staff";
  return null;
}

/**
 * carriedItems(c) — Phase 37 (GEAR-03): bag ∪ worn — every item the
 * character has on their person, whether in `c.items` or a populated
 * `c.worn` slot. This is what `hasItemNamed` (and therefore `isFlying`,
 * `conditionsOf`'s item-backed chips, and engine/movement.js's climb block)
 * routes through, so a worn Bracelet of Flight / Cloak of Flying / Helm of
 * Knowledge is seen exactly as it was when it lived in the bag. Returns a
 * NEW array (`c.items` first, in order, then the truthy `c.worn` values);
 * never mutates `c`. Defensive: a missing/non-array `c.items` and a
 * missing/non-object `c.worn` both contribute nothing rather than throwing.
 */
export function carriedItems(c) {
  const items = c && Array.isArray(c.items) ? c.items : [];
  const worn = c && c.worn && typeof c.worn === "object" ? Object.values(c.worn).filter(Boolean) : [];
  return [...items, ...worn];
}

/**
 * clampCarry(c) — ECON-01 (Phase 12, Economy A): enforce the carry caps of the
 * character's bag tier (content/bags.js BAGS[c.bag]) by clamping, in place:
 *   - `c.items.length` down to `slots` (dropping the OVERFLOW off the end),
 *   - `c.gold` down to the `wilmst` cap,
 *   - `c.rations` down to the `rations` cap.
 *
 * GATED: a COMPLETE no-op when `!c.bag` (returns immediately, mutating
 * nothing). This is what keeps every FROZEN parity fixture byte-identical —
 * those characters carry no `c.bag` (stripped by the comparators), so the
 * clamp never runs on them. Each clamp is ALSO one-directional (only ever
 * shrinks an over-cap value, `if (x > cap)`), so it never PADS c.items to a
 * longer length or bumps an under-cap value — a fresh, under-cap character is
 * left byte-identical.
 *
 * THIS PHASE is data-model only: clampCarry exists and is unit-tested, and is
 * called only where it is provably a no-op (end of chargen — a fresh character
 * is always under caps). It is deliberately NOT retrofitted into the ported
 * giveItem/gainWilmst/takeItem paths (that would change frozen-fixture
 * behavior); Phase 13's new gated find/keep/drop action handlers call it.
 *
 * Pure w.r.t. rng (no draw); mutates and returns the passed `c`.
 *
 * Phase 29 (LOOT-04, Pitfall 2): the slot trim is keyed on `slotItems(c)`
 * (gear/treasure only) against the cap, not the raw item-list length — a
 * naive length truncation would drop a trailing special potion instead of
 * trailing gear. Overflow slot-consuming entries are dropped off the end,
 * in original relative order; every `kind:"potion"` entry is exempt and
 * always survives regardless of position.
 */
export function clampCarry(c) {
  if (!c || !c.bag) return c; // GATED no-op — no bag, nothing to clamp
  const cap = BAGS[c.bag];
  if (!cap) return c; // unknown bag key — leave untouched rather than crash
  if (Array.isArray(c.items) && slotItems(c).length > cap.slots) {
    let kept = 0;
    c.items = c.items.filter((it) => {
      if (it && it.kind === "potion") return true; // exempt — never trimmed
      if (kept < cap.slots) {
        kept++;
        return true;
      }
      return false; // overflow gear/treasure — dropped off the end
    });
  }
  if (typeof c.gold === "number" && c.gold > cap.wilmst) c.gold = cap.wilmst;
  if (typeof c.rations === "number" && c.rations > cap.rations) c.rations = cap.rations;
  return c;
}

/**
 * reconcileWorn(c) — Phase 37 (GEAR-04): the load-time / newRun-option
 * migration that creates the worn-slot model on a character that lacks it.
 * A COMPLETE no-op — returns `null` — unless `c` is a non-null, non-array
 * object WITHOUT an own `worn` key (never re-migrates a `c` that already
 * has one, even an empty `{}`). Otherwise: sets `c.worn = {}`, then walks
 * `c.items` in bag order — for each item with a non-null `slotFor(it)`
 * whose slot is still empty in `c.worn` (and, for a staff, only when
 * `c.cls === "Magic User"` — a staff stays bagged for every other class,
 * exactly like `equipItem`'s existing staff-class gate), moves it (the SAME
 * object, not a copy) into `c.worn[slot]`; every later item of an
 * already-populated slot stays in the bag. Rebuilds `c.items` from the
 * items that stayed bagged, in their original relative order (only when
 * `c.items` was itself an array).
 *
 * Returns a reconciliation report — one `{ slot, worn, bagged }` entry per
 * populated slot, in WORN_SLOTS order (`worn` = the display name now worn;
 * `bagged` = the display names of any later same-slot items left behind) —
 * or `[]` when nothing was worn. Report objects use only `slot`/`worn`/
 * `bagged` keys (never `type` — test/unit/toastsCoverage.test.js's
 * event-vocabulary scanner greps every `type:` key across engine/*.js).
 *
 * Moving bag -> worn only ever FREES bag slots (items leave the bag, none
 * are added), so this can never overflow a bag-cap. Adds NO rng draw — pure
 * reads/reassignment. The ONLY callers are Plan 03's `newRun(seed, exclude,
 * { wornSlots: true })` option (shell-only, mirroring the `storeRoll`
 * precedent) and the option-gated save-load path (`validateSave`/
 * `rehydrate`) — nothing in THIS plan calls it, so no fixture/bot/newRun(seed)
 * caller in this plan ever creates `c.worn`.
 */
export function reconcileWorn(c) {
  if (!c || typeof c !== "object" || Array.isArray(c) || "worn" in c) return null;
  c.worn = {};
  const hadItems = Array.isArray(c.items);
  const source = hadItems ? c.items : [];
  const kept = [];
  const reportBySlot = new Map();
  for (const it of source) {
    const slot = it && slotFor(it);
    const eligible = !!slot && (slot !== "staff" || c.cls === "Magic User");
    if (eligible && !c.worn[slot]) {
      c.worn[slot] = it;
      reportBySlot.set(slot, { slot, worn: it.n, bagged: [] });
    } else {
      if (eligible) reportBySlot.get(slot).bagged.push(it.n);
      kept.push(it);
    }
  }
  if (hadItems) c.items = kept;
  const report = [];
  for (const slot of WORN_SLOTS) if (reportBySlot.has(slot)) report.push(reportBySlot.get(slot));
  return report;
}

/** hasItemNamed(c, name) — does the character currently carry (bag ∪ worn)
 * an item whose exact display name (`.n`) is `name`? Used below to tell the
 * Bracelet of Flight and the Cloak of Flying apart even though both set the
 * identical `eff:{fly:1}` flag (content/treasure-tables.js) — `eff()` alone
 * can only sum that flag, not identify its source. Exported so
 * engine/movement.js's climb/gorge block can reuse the identical name check
 * to decide whether ACTIVATING flight should touch the Cloak's charge
 * counters (never the Bracelet's — it has none).
 *
 * Phase 37 (GEAR-03): routed through `carriedItems(c)` (bag ∪ worn) instead
 * of a raw `c.items` scan, so a Bracelet/Cloak/Helm moved into `c.worn` by
 * the new one-per-slot model is seen exactly as it was in the bag. */
export function hasItemNamed(c, name) {
  return carriedItems(c).some((it) => it && it.n === name);
}

/**
 * isFlying(state) — DELIBERATE RULES CHANGE (audit-batch1, 2026-09-09, A2):
 * `eff(c,"fly")` (set by the Bracelet of Flight and the Cloak of Flying,
 * content/treasure-tables.js:20,31) was read NOWHERE in the engine — flight
 * was flavor text only. Wired here as the single capacity check
 * engine/movement.js's climb/gorge block consults to skip the roll/fall-
 * damage entirely:
 *   - Bracelet of Flight ("walls and crevices are nothing") = unconditional,
 *     always-on flight — no charge, no cooldown, ever.
 *   - Cloak of Flying ("flight for 20 squares, once every 50") = a real
 *     resource, backed by `c.flightLeft`/`c.flightCooldown` (chargen-
 *     initialized to 0 in engine/character.js, ticked once per step by
 *     engine/movement.js's move(), exactly like haste/invis/ether): flying
 *     while an active charge window is still open (`flightLeft > 0`), or the
 *     instant the cooldown has fully elapsed and a fresh window is about to
 *     open (`flightCooldown <= 0`) — movement.js's climb/gorge block is what
 *     actually starts that fresh window (sets `flightLeft`) the moment this
 *     returns true for a Cloak-only character.
 * If a character somehow carries BOTH items, the Bracelet takes precedence
 * unconditionally and the Cloak's counters are left untouched (per the
 * audit's explicit decision) — this is a pure read of already-computed
 * state; no rng, no mutation, so determinism/parity are unaffected for every
 * character without either item.
 */
export function isFlying(state) {
  const c = state.c;
  if (hasItemNamed(c, "Bracelet of Flight")) return true;
  if (!hasItemNamed(c, "Cloak of Flying")) return false;
  return c.flightLeft > 0 || c.flightCooldown <= 0;
}

/**
 * conditionsOf(state) — DR15-B (2026-09-10): a PURE derived enumeration of the
 * character's currently-active status conditions, good AND bad, as DATA ONLY
 * (no labels, no copy, no player-object copy). The UI (mazeworld.html) maps
 * each returned `key` to a short label + a good/bad chip; keeping copy out of
 * the engine keeps this reusable (e.g. a future party-member tracker) and
 * presentation-agnostic.
 *
 * Reads ONLY already-computed `state.c.*` fields (haste/invis/acute/ether/
 * might/flight counters, affliction, darkFor) plus the two flight item-name
 * checks isFlying already consults — NO rng draw, NO mutation of state or c,
 * NO new serialized field. It is therefore a zero-parity-impact read: every
 * frozen fixture round-trips byte-identical because nothing is written.
 *
 * Returns an array of descriptors in a STABLE order (good conditions first,
 * then bad), each `{ key, polarity, ... }`:
 *   - haste  {polarity:"good", remaining:<sq left>}       — double attacks
 *   - invis  {polarity:"good", remaining:<sq left>}       — foes barely see you
 *   - acute  {polarity:"good", remaining:<rounds>}        — strike on a d6
 *   - ether  {polarity:"good", remaining:<sq left>}       — pass through walls
 *   - might  {polarity:"good"}                            — +damage, lasts the day (no count)
 *   - ward   {polarity:"good", pool:<hp>, remaining:<rounds>, name:<spell/item name>} — Phase 31 (CMB-04): the Shield chip, mirroring c.ward's own {pool, rounds, name} shape
 *   - flight {polarity:"good", flight:"always"|"charged"|"cooldown"|"ready", remaining?:<sq>}
 *   - affliction {polarity:"bad", kind:"Poison"|"Disease"|…}
 *   - darkness   {polarity:"bad", remaining:<sq left>}    — the persistent Darkness/phobia state
 *   - afraid     {polarity:"bad", remaining:<rounds>, phobia:<fear name>} — Phase 31 (user ruling 2026-09-16): the Afraid penalty from a triggered phobia in the CURRENT combat, only while combat.afraid > 0 (a Hardiness shrug-off shows nothing)
 *
 * Only currently-active conditions are included; a character with none set
 * yields an empty array. `remaining` is the raw engine counter (squares or
 * rounds) where a countdown is knowable — omitted where the effect has no
 * square/round count (might lasts until the next day; flight "always" from the
 * Bracelet has no charge). The flight `flight` sub-state mirrors isFlying's
 * Bracelet/Cloak logic so the chip can read "Flying" vs "recharging".
 */
export function conditionsOf(state) {
  const c = (state && state.c) || {};
  const out = [];

  // --- GOOD conditions (in a fixed order for deterministic rendering) -------
  if (c.haste > 0) out.push({ key: "haste", polarity: "good", remaining: c.haste });
  if (c.invis > 0) out.push({ key: "invis", polarity: "good", remaining: c.invis });
  if (c.acute > 0) out.push({ key: "acute", polarity: "good", remaining: c.acute });
  if (c.ether > 0) out.push({ key: "ether", polarity: "good", remaining: c.ether });
  if (c.might > 0) out.push({ key: "might", polarity: "good" });
  // Phase 31 (CMB-04): the Shield chip — c.ward is the same field the
  // engine's absorb/reflect/shatter code (engine/combat.js) already reads;
  // this surfaces it as data only (pool + rounds), never touching the
  // lifecycle events (wardRaised/wardAbsorbed/wardReflected/wardShattered/
  // wardFaded already narrate). Gated on a positive pool so a shattered
  // (pool<=0, about to be nulled) ward never flashes a zero-hp chip.
  if (c.ward && c.ward.pool > 0) {
    out.push({ key: "ward", polarity: "good", pool: c.ward.pool, remaining: c.ward.rounds, name: c.ward.name });
  }

  // Flight mirrors isFlying's item logic: the Bracelet is unconditional; the
  // Cloak of Flying is a real charge/cooldown resource. Surface all knowable
  // sub-states so the chip can read "Flying" vs "recharging".
  if (hasItemNamed(c, "Bracelet of Flight")) {
    out.push({ key: "flight", polarity: "good", flight: "always" });
  } else if (hasItemNamed(c, "Cloak of Flying")) {
    if (c.flightLeft > 0) out.push({ key: "flight", polarity: "good", flight: "charged", remaining: c.flightLeft });
    else if (c.flightCooldown > 0) out.push({ key: "flight", polarity: "good", flight: "cooldown", remaining: c.flightCooldown });
    else out.push({ key: "flight", polarity: "good", flight: "ready" });
  }

  // --- BAD conditions -------------------------------------------------------
  if (c.affliction && c.affliction.kind) {
    out.push({ key: "affliction", polarity: "bad", kind: c.affliction.kind });
  }
  // Phase 19 FOE-08/D-09: a foe-inflicted timed debuff (c.foeEffect), one
  // slot, combat-scoped. The chip renderer maps `kind` to "Weakened"/"Dazed"
  // (D-21, 19-04) — this is a pure data surface, no new UI here.
  if (c.foeEffect && c.foeEffect.rounds > 0) {
    out.push({ key: "foeEffect", polarity: "bad", kind: c.foeEffect.kind, remaining: c.foeEffect.rounds });
  }
  // Persistent Darkness (04.1) — this is ALSO the active-phobia surface DR15-B
  // asks for: show it while darkFor > 0 (actively in effect), not merely
  // because the character has the Darkness phobia.
  if (c.darkFor > 0) out.push({ key: "darkness", polarity: "bad", remaining: c.darkFor });

  // Afraid (Phase 31, user ruling 2026-09-16: "Phobia should be penalties,
  // never a no actions state" — supersedes the old DR17 "phobia" freeze
  // chip). Surfaces as a named BAD chip whenever engine/combat.js#fight's
  // phobia trigger has set state.combat.afraid > 0 in the CURRENT combat —
  // the tracker names it (e.g. "Afraid · N rds") for as long as the penalty
  // holds. A Hardiness shrug-off never sets the counter, so it shows
  // nothing; the chip clears the instant the counter reaches 0 (fearPassed)
  // or the combat ends (endCombat nulls state.combat). Gated on state.combat
  // existing, so it never surfaces outside a fight; a pure read of
  // already-computed state (no rng, no mutation) — zero parity impact,
  // exactly like every other condition above.
  if (state && state.combat && state.combat.afraid > 0) {
    out.push({ key: "afraid", polarity: "bad", remaining: state.combat.afraid, phobia: c.phobia });
  }

  return out;
}

/**
 * armorSoak(c) — DELIBERATE RULES CHANGE (04.2 Bugs B, 2026-09-09, E8): the
 * Cloak of Armor (content/treasure-tables.js, eff:{cloakArmor:1}, "a full suit
 * of plate that weighs nothing") was inert — `cloakArmor` was READ NOWHERE,
 * exactly like eff.fly before the A2 flight wiring. This is the single source
 * the combat soak block (engine/combat.js) consults for the player's EFFECTIVE
 * armour instead of reading c.ar/c.armorWP/c.armorMin/c.armorMax directly.
 *
 * When the character carries the Cloak of Armor (`eff(c,"cloakArmor") > 0`),
 * effective armour operates as PLATE (content/armors.js Plate ar:15/wp:45):
 * take-the-better of the cloak's plate and the worn armour for both the d20
 * soak rating (`ar`) and the durability pool. Because the cloak is a weightless
 * MAGICAL suit, its plate does not wear out — `magic:true` tells the soak site
 * to consume NO worn-armour durability (and never emit armorDestroyed) when the
 * cloak is present. Without the cloak this returns the worn armour verbatim
 * (`magic:false`), so behaviour is byte-identical for every character that
 * lacks the item.
 *
 * Pure read of `c` (uses only eff() + the static Plate constants); no rng, no
 * mutation of `c`, so determinism/parity are unaffected.
 */
export function armorSoak(c) {
  const worn = { ar: c.ar || 0, wp: c.armorWP, min: c.armorMin || 0, max: c.armorMax };
  if (eff(c, "cloakArmor") <= 0) return { ...worn, magic: false };
  const plate = ARMORS.find((a) => a.name === "Plate") || { ar: 15, wp: 45 };
  return {
    ar: Math.max(worn.ar, plate.ar),
    wp: Math.max(worn.wp, plate.wp),
    min: worn.min,
    max: Math.max(worn.max, plate.wp),
    magic: true,
  };
}

// --- die / hit numbers ------------------------------------------------------

/**
 * strikeDie(c) — the die the character strikes on (lower is better). Pure
 * read of the character; ports mazeworld.html strikeDie() (lines 1445-1451).
 */
export function strikeDie(c) {
  let idx = c.level - 1;
  const R = RACES[c.race];
  if (R.strikeStep) idx = Math.min(4, idx + R.strikeStep);
  if (c.sub === "Illusionist" && c.level < 3) idx = 0; // d20 until level three
  if (c.acute > 0) idx = 4; // Potion of Acuteness: strike on a d6
  return STRIKE_DICE[idx];
}

/**
 * inDark(state) — is the player standing on an unlit square? Reads state.floor;
 * ports mazeworld.html inDark() (lines 1463-1466).
 *
 * DELIBERATE RULES CHANGE (04.1-05, 2026-09-09, PHOBIA-01): extended to ALSO
 * return true while the persistent darkness counter (`state.c.darkFor`, set
 * by engine/encounters.js's fallDark and decremented per step by
 * engine/movement.js) is active, regardless of the current tile's own
 * `.dark` flag. This is the single hook every darkness consumer already
 * reads (revealRadius below, toHit's in-dark cap, foeToHitVs's silent-thief
 * clause, combat.js's combatInDark/no-crit-in-dark/Darkness-phobia freeze),
 * so extending it here makes the persistent state flow through all of them
 * for free — and every Night Vision waiver keeps working unchanged, since
 * those checks already wrap inDark() rather than reading tile.dark
 * directly. Pure read of already-computed state; no rng, so
 * determinism/parity are unaffected.
 */
export function inDark(state) {
  const f = state.floor;
  const tileDark = !!(f && f.g[f.py] && f.g[f.py][f.px] && f.g[f.py][f.px].dark);
  return tileDark || !!(state.c && state.c.darkFor > 0);
}

/**
 * revealRadius(state) — the fog-of-war reveal radius for the player's current
 * position: 1 on a dark tile without Night Vision, 2 otherwise, plus any
 * `sight` effect (e.g. the Amulet of Light, `eff: { sight: 1 }`). Ports
 * mazeworld.html reveal()'s radius line verbatim (line 838): `r = ((g[py][px].dark
 * && !skill("Night Vision")) ? 1 : 2) + eff("sight")`. Reads state.floor
 * (via inDark) and state.c; no RNG.
 */
export function revealRadius(state) {
  return (inDark(state) && !skill(state.c, "Night Vision") ? 1 : 2) + eff(state.c, "sight");
}

/**
 * toHit(state) — the die value the player needs to land a blow. Reads state.c,
 * state.combat (inspired) and state.floor (darkness); ports mazeworld.html
 * toHit() (lines 1452-1462).
 */
export function toHit(state) {
  const c = state.c;
  const R = RACES[c.race];
  let h = CLASSES[c.cls].toHit;
  if (R.toHit) h = Math.max(h, R.toHit); // Elves strike at 5 whatever their class
  if (c.sub === "Acrobat") h = 5; // strikes as a fighter with the dagger
  if (c.sub === "Cleric") h = Math.max(h, 4); // Clerics roll 4, not 3
  if (skill(c, "Kata")) h = Math.max(h, c.cls === "Fighter" ? 6 : 5);
  if (state.combat && state.combat.inspired) h += state.combat.inspired;
  h += eff(c, "toHit");
  // Phase 19 D-10: dazed — you need 2 lower to hit, never below 1; the
  // weakened kind is applied at playerStrike's damage line in combat.js, not here.
  if (c.foeEffect && c.foeEffect.kind === "dazed" && c.foeEffect.rounds > 0) h = Math.max(1, h - 2);
  if (inDark(state) && !skill(c, "Night Vision") && !c.senses) h = Math.min(h, 2);
  return h;
}

/**
 * afraidNeed(state, need) — Phase 31 (user ruling 2026-09-16): the Afraid
 * to-hit penalty, applied as the LAST modifier after every other need rule
 * (frenzy/asleep/hard-to-hit/fast/magicOnly/darkness). The game's to-hit is
 * a LOW range (a strike lands on roll <= need), so the penalty SHRINKS the
 * target number — the PENALTY IS SUBTRACTED FROM THE NEED, never added to
 * the die roll. Floor 1; an untouchable foe (need 0, e.g. magicOnly without
 * a magic weapon) is never made hittable by fear (the `need > 0` guard).
 * Pure, zero rng.
 */
export function afraidNeed(state, need) {
  if (!(state.combat && state.combat.afraid > 0 && need > 0)) return need;
  return Math.max(1, need - AFRAID_TO_HIT_PENALTY);
}

/**
 * afraidDamage(state, dmg) — Phase 31 (user ruling 2026-09-16): halves the
 * player's already-rolled weapon damage while Afraid, floor 1 (Math.ceil).
 * Pure, zero rng.
 */
export function afraidDamage(state, dmg) {
  return state.combat && state.combat.afraid > 0 ? Math.max(1, Math.ceil(dmg / AFRAID_DMG_DIV)) : dmg;
}

/**
 * memberToHit(m) — DFB-05 (Phase 25.1): the class/race/sub part of `toHit`
 * for a PARTY MEMBER sheet (`m`), not the hero. Deliberately omits every
 * hero-only term toHit(state) reads (combat.inspired, eff(c,"toHit"), the
 * dazed/darkness overrides) — a member fights on its own sheet's class/race/
 * sub alone. `?? 5` keeps the pre-25.1 "hit on 5" fallback for a sheet with
 * no recognized class (mirrors alliesTurn's legacy path). Pure read, no rng.
 */
export function memberToHit(m) {
  let h = CLASSES[m.cls]?.toHit ?? 5;
  const R = RACES[m.race];
  if (R && R.toHit) h = Math.max(h, R.toHit);
  if (m.sub === "Acrobat") h = 5;
  if (m.sub === "Cleric") h = Math.max(h, 4);
  if (skill(m, "Kata")) h = Math.max(h, m.cls === "Fighter" ? 6 : 5);
  return h;
}

/**
 * foeDie(c, foe) — the die a creature of the foe's level strikes on against
 * this character; never lower than a d8 (p.24). Ports mazeworld.html foeDie()
 * (lines 1469-1472).
 */
export function foeDie(c, f) {
  const R = RACES[c.race];
  const step = R.foeStrikeStep || 0;
  return Math.max(8, STRIKE_DICE[clamp(f.lvl - 1 + step, 0, 4)]);
}

/**
 * foeToHitVs(state) — what a creature needs to land on this character. Reads
 * state.c and state.floor; ports mazeworld.html foeToHitVs() (lines 1473-1483).
 *
 * DELIBERATE RULES CHANGE (Phase 24, 2026-09-14, IDENT-06): "the profession
 * is standing there" made real — a Guard is flat-out harder to land a blow
 * on. Stacks with Agility (both -1s apply), still floors at 1 via the
 * Math.max below, and still loses to the dark/mirror/invis overrides (those
 * assign h=1 directly, after this line). Zero draws — pure arithmetic.
 */
export function foeToHitVs(state) {
  const c = state.c;
  const R = RACES[c.race];
  let h = 5;
  if (R.foeToHit) h += R.foeToHit;
  if (c.sub === "Acrobat") h = 3;
  if (skill(c, "Agility")) h -= 1;
  if (c.sub === "Guard") h -= 1;
  h += eff(c, "foeToHit");
  if (inDark(state) && skill(c, "Silence")) h = 1; // a silent thief in the dark
  if (c.mirror > 0) h = 1; // Mirror Self
  if (c.invis > 0) h = 1; // invisible
  return Math.max(1, h);
}

/**
 * foeToHitBreakdown(state) — Phase 25 (FEED-01, additive payload): a
 * narration-only breakdown of foeToHitVs's own arithmetic, reproducing every
 * step in the SAME order and recording a `{ name, delta }` entry for every
 * step that actually changed the running value (delta = after − before, so
 * an override such as Acrobat's `h = 3` records `3 - hBefore`, not a raw
 * assignment). Returns `{ need, mods }` where `need` MUST always equal
 * `foeToHitVs(state)` — this function reads exactly the same fields
 * (`c.race`, `c.sub`, skill/eff reads, `inDark(state)`, `c.mirror`,
 * `c.invis`) via the same helpers, so the two can never diverge for any
 * (race, sub, skill, override) combination; test/unit/feedback-payload.test.js
 * proves this by matrix. Pure (no rng, no mutation) — this is a narration
 * helper, not a second source of truth: foeToHitVs's own body is left
 * untouched (zero risk) rather than delegating to this function.
 */
export function foeToHitBreakdown(state) {
  const c = state.c;
  const R = RACES[c.race];
  const mods = [];
  let h = 5;
  if (R.foeToHit) {
    const before = h;
    h += R.foeToHit;
    if (h !== before) mods.push({ name: c.race, delta: h - before });
  }
  if (c.sub === "Acrobat") {
    const before = h;
    h = 3;
    if (h !== before) mods.push({ name: "Acrobat", delta: h - before });
  }
  if (skill(c, "Agility")) {
    const before = h;
    h -= 1;
    if (h !== before) mods.push({ name: "Agility", delta: h - before });
  }
  if (c.sub === "Guard") {
    const before = h;
    h -= 1;
    if (h !== before) mods.push({ name: "Guard", delta: h - before });
  }
  const gear = eff(c, "foeToHit");
  if (gear) {
    const before = h;
    h += gear;
    if (h !== before) mods.push({ name: "gear", delta: h - before });
  }
  if (inDark(state) && skill(c, "Silence")) {
    const before = h;
    h = 1; // a silent thief in the dark
    if (h !== before) mods.push({ name: "Silence", delta: h - before });
  }
  if (c.mirror > 0) {
    const before = h;
    h = 1; // Mirror Self
    if (h !== before) mods.push({ name: "Mirror Self", delta: h - before });
  }
  if (c.invis > 0) {
    const before = h;
    h = 1; // invisible
    if (h !== before) mods.push({ name: "invisible", delta: h - before });
  }
  const floored = Math.max(1, h);
  if (floored !== h) mods.push({ name: "floor", delta: floored - h });
  return { need: floored, mods };
}

/**
 * weaponDamage(c, rng) — a single strike's damage. The weapon's dice notation
 * is resolved here via the injected rng (the ONLY randomness in this module),
 * so this stays deterministic given (c, rng). Ports mazeworld.html
 * weaponDamage() (lines 1484-1496), with the prototype's `w.d()` closure
 * replaced by the content weapon's `dice`/`halve` notation.
 */
export function weaponDamage(c, rng) {
  const w = WEAPONS[c.weapon] || WEAPONS["Club"];
  const R = RACES[c.race];
  const base = w.halve ? Math.ceil(rollDice(rng, w.dice) / 2) : rollDice(rng, w.dice);
  let d = c.level * c.level + base + c.prof + c.magicWpn;
  if (R.dmg) d += R.dmg;
  if (R.wpnBonus) d += R.wpnBonus;
  if (c.might) d += c.might;
  if (skill(c, "Kata")) d += c.level;
  if (skill(c, "Heft")) d += 2;
  // DELIBERATE RULES CHANGE (04.1-02, 2026-09-09, RULE-02): the Master of
  // Arms subclass blurb (content/flavor.js SUB_NOTE["Master of Arms"]) reads
  // "Plus two with every weapon ever forged" but the +2 weapon-proficiency
  // bonus had NO implementation anywhere in the engine. Wired here as a flat
  // additive, mirroring the existing prof/Heft pattern — no RNG, so this
  // does not change RNG consumption order or affect determinism/parity.
  if (c.sub === "Master of Arms") d += 2;
  d += eff(c, "dmg");
  // DELIBERATE RULES CHANGE (Phase 15 item-wiring, ECON-08): the Gauntlet of
  // the Giant (content/treasure-tables.js, eff:{size:1}, "one size larger")
  // was inert — the player's `size` effect was READ NOWHERE (combat.js:128
  // `size:` is the FOE's size). Wired here as the design-call "small damage
  // benefit" (CONTEXT §8): a giant's reach/mass adds a flat +2 per size step
  // to every strike, mirroring the existing eff("dmg")/Heft additives just
  // above. Pure read of `c` (no rng), so RNG consumption order/parity are
  // unaffected for every character not carrying the Gauntlet (eff size === 0).
  d += 2 * eff(c, "size");
  if (c.sub === "Guard" && c.level < 4) d -= 4 - c.level;
  if (c.sub === "Sorcerer") d = Math.min(d, 9); // a Sorcerer's arm is not the point
  return Math.max(1, d);
}

/**
 * upkeep(c) — wp burned feeding the character each night. Ports mazeworld.html
 * upkeep() (line 1497).
 */
export function upkeep(c) {
  const R = RACES[c.race];
  return Math.max(1, Math.round(R.upkeep * (skill(c, "Heft") ? 0.5 : 1)) + eff(c, "upkeep"));
}

/**
 * intelBonus(c) — DELIBERATE RULES CHANGE (04.1-04, 2026-09-09, RULE-01):
 * Intelligence (`c.intel`, rolled once at chargen as a d20, character.js) was
 * a pure cosmetic orphan — displayed on the sheet, never read by any engine
 * function on the player's OWN character (only a foe's `intel` fed spell
 * resistance, magic.js). Per the phase-04.1 rules audit + user's Option B
 * decision, this exported helper gives Intelligence a small, self-contained
 * mechanical read with NO dependency on foe spellcasting: a modest,
 * documented curve — +1 bonus at intel >= 15, +2 (capped) at intel >= 20 —
 * consumed by openChest's lock-roll SUCCESS THRESHOLD (engine/encounters.js)
 * and mirrored on the character sheet (src/browser/viewModels.js), the same
 * single-source-of-truth pattern damageBracket↔weaponDamage already use.
 * This function does NO rng draw and is a pure read of `c`; callers apply it
 * to a comparison threshold, never to the rng draw itself, so RNG
 * consumption order is unaffected.
 */
export function intelBonus(c) {
  const intel = c.intel || 0;
  return clamp(Math.floor((intel - 10) / 5), 0, 2);
}

/**
 * resistRoll(rng, intel) — p.25's intelligent-target spell/ability
 * resistance, the ONE shared helper for BOTH directions (FOE-07): the
 * player's `castSpell` reads a FOE's `intel` (magic.js), and Phase 19's
 * foe-ability resolver reads the HERO's `c.intel` (engine/foeAbilities.js).
 * Homed here (D-07, relocated by D-17) because `engine/derived.js` is the
 * only cycle-free leaf module — `engine/magic.js` already imports from
 * `engine/combat.js`, and `engine/combat.js` will import
 * `engine/foeAbilities.js`, so a helper living in either `magic.js` or
 * `combat.js` would create an import cycle once both callers exist.
 *
 * Canon rule (p.25): a target with intel >= 12 gets a resistance check — a
 * single d20 that resists the effect on a roll strictly less than its
 * intel. Below that threshold, NOTHING is rolled at all — this early-out is
 * the DETERMINISM GATE: callers are expected to invoke this only when a
 * resistible spell/ability is actually firing, so the draw stays fully
 * gated (e.g. the cast-damage parity fixture's Shriek has intel 1, so it
 * never enters the `rolled` branch and consumes zero extra rng).
 *
 * Returns `{ rolled, resisted, roll }`: `rolled` is an additive field beyond
 * p.25's `{ resisted, roll }` so a caller can tell "no roll happened"
 * (intel < 12) apart from "rolled and failed to resist" (`roll` would
 * otherwise be indistinguishable from `undefined` in an untyped caller).
 * Pure w.r.t. everything but the single gated rng.d(20) draw; never mutates
 * its arguments.
 */
export function resistRoll(rng, intel) {
  if ((intel ?? 0) < 12) return { rolled: false, resisted: false, roll: undefined };
  const roll = rng.d(20);
  return { rolled: true, resisted: roll < intel, roll };
}

/**
 * killSpFor(c, f, roll) — PARLEY-01 (Phase 20, D-01): the ONE kill-skill-
 * point formula shared by `engine/combat.js#killFoe` and `#parley`, so
 * parley's "half the skill points" is STRUCTURALLY half of the same number a
 * kill pays (never a second formula that drifts). Homed here because
 * `derived.js` is the cycle-free leaf (`combat.js` imports it; it imports
 * nothing from `combat.js`). Verbatim two-step raw/mul arithmetic — a
 * re-associated single product could round differently in floating point and
 * break parity, so this must stay the exact expression `killFoe` used
 * inline. Pure: no rng, no mutation — the caller draws the d6 and passes it
 * in as `roll`.
 */
export function killSpFor(c, f, roll) {
  const R = RACES[c.race];
  const raw = roll * f.lvl;
  const mul = 5 * (R.spMul || 1) * (c.sub === "Barbarian" ? 0.5 : 1) * (c.sub === "Apprentice" && c.level < 3 ? 2 : 1);
  return Math.round(raw * mul);
}

/**
 * fluency(c) — LANG-01 (Phase 20, D-09): the single source of truth for
 * language fluency, read by BOTH `engine/combat.js#canParley`'s availability
 * gate and `#parley`'s bonus term (never balanced twice). Returns 0
 * (neither), 1 (the Language skill OR a tongue-effect item such as the Helm
 * of Knowledge), 2 (both) — skill TIER does not matter (a raised Language is
 * still 1). The data keys `Language` (content/skills.js) / `tongue`
 * (content/treasure-tables.js) are unchanged. Pure read (`skill`/`eff`), no
 * rng, no mutation.
 */
export function fluency(c) {
  return (skill(c, "Language") ? 1 : 0) + (eff(c, "tongue") > 0 ? 1 : 0);
}

/**
 * levelFromSP(sp) — skill level for a given skill-point total. Ports
 * mazeworld.html levelFromSP() (line 1498).
 */
export function levelFromSP(sp) {
  let l = 1;
  for (let i = 4; i >= 0; i--)
    if (sp >= THRESHOLDS[i]) {
      l = i + 1;
      break;
    }
  return l;
}

// --- Magic-User school gates ------------------------------------------------

/** Ports mazeworld.html lines 879-887 (schoolAllowed/Gate/Bonus/canLearn/canCast). */
export function schoolAllowed(sub, school) {
  const c = MU_CHART[sub];
  return !!c && c[school] !== null && c[school] !== undefined;
}

export function schoolGate(sub, school) {
  const c = MU_CHART[sub];
  return (c && c.gate && c.gate[school]) || 1;
}

export function schoolBonus(sub, school) {
  const c = MU_CHART[sub];
  return c && typeof c[school] === "number" ? c[school] : 0;
}

export function canLearn(sub, sp) {
  return schoolAllowed(sub, sp.s);
}

/**
 * spellLevelFor(sub, sp) — DELIBERATE RULES CHANGE (Phase 23, 2026-09-14,
 * IDENT-03/IDENT-04): the EFFECTIVE spell level to use for a (sub, spell)
 * pair's level-gate check, reading content/spell-level-overrides.js's
 * SPELL_LEVEL_OVERRIDES table. Returns the override when one exists for this
 * exact sub-class and spell name (SPELL_LEVEL_OVERRIDES[sub]?.[sp.n]) and it
 * is a number; otherwise falls back to the spell's own printed level
 * (`sp.lvl`) — the byte-identical old behavior for every (sub, spell) pair
 * NOT in the table. Pure read, no rng, no mutation. This is the ONE place
 * canCast (below) and engine/character.js#rollGrimoire consult, so the
 * override table has exactly one consumer.
 */
export function spellLevelFor(sub, sp) {
  const override = SPELL_LEVEL_OVERRIDES[sub]?.[sp.n];
  return typeof override === "number" ? override : sp.lvl;
}

/**
 * ATTACK_SPELL_KINDS — the ONE engine-wide definition of "attack spell"
 * (Phase 23, IDENT-01/IDENT-02, CONTEXT: "What counts as an attack spell").
 * Exactly the four kinds behind the level-1 offense spells Doze (status),
 * Freeze (thrown), Stun (stun), Weaken (weaken) — plus every OTHER spell
 * that shares one of those four kinds at a higher level (Ice/Fireball/
 * Lightning/Mangle are all `kind: "thrown"`). By deliberate decision, the
 * other disabling/offense kinds (acid, volley, quake, death, blind, shrink,
 * petrify, insane, stupid, vapor) are NOT in this set — they do not count as
 * a "guaranteed attack" for the Wizard melee rule or the grimoire top-up.
 * Consumed by isAttackSpell/castableAttackSpells below, engine/character.js's
 * rollGrimoire top-up, and engine/combat.js's Wizard refusal check — a
 * single shared definition so those three call sites can never drift apart.
 */
export const ATTACK_SPELL_KINDS = new Set(["status", "thrown", "stun", "weaken"]);

/** isAttackSpell(sp) — does this spell's kind belong to ATTACK_SPELL_KINDS? */
export function isAttackSpell(sp) {
  return ATTACK_SPELL_KINDS.has(sp.kind);
}

/**
 * castableAttackSpells(state) — every attack-kind spell the current character
 * could cast RIGHT NOW: known (grimoire), level-legal (via spellLevelFor,
 * honoring the override table), and school-legal (canCast's schoolGate
 * check). Returns spell OBJECTS (not names) in SPELLS array order, so the
 * result is fully deterministic — the first element is what
 * engine/combat.js's strikeRefused event names as `spell`. Deliberately does
 * NOT check remaining charges (maxCharges/spellsUsed) — that check stays at
 * the Wizard-refusal call site, so this helper answers only "is there a
 * legal attack spell to cast", not "do you still have a charge for it".
 * Pure read of state; no rng, no mutation.
 */
export function castableAttackSpells(state) {
  return SPELLS.filter((sp) => isAttackSpell(sp) && canCast(state, sp));
}

export function canCast(state, sp) {
  const c = state.c;
  if (!c.grimoire || !c.grimoire.includes(sp.n)) return false;
  // DELIBERATE RULES CHANGE (Phase 23, 2026-09-14, IDENT-03/IDENT-04): routed
  // through spellLevelFor so the per-sub override table can lower a spell's
  // effective level (Summoner/Summon, Illusionist/Phantom Host); byte-
  // identical to the old `sp.lvl > c.level` check for every other pair.
  if (spellLevelFor(c.sub, sp) > c.level) return false;
  return c.level >= schoolGate(c.sub, sp.s);
}

/**
 * bestAttackSpell(state) — DFB-05 (Phase 25.1): of every currently-castable
 * attack spell (`castableAttackSpells(state)`), the one a Magic User party
 * member should cast — the highest EFFECTIVE level (spellLevelFor, honoring
 * the override table), preferring `kind === "thrown"` at an equal level
 * (damage beats a nap at parity), breaking any remaining tie by SPELLS array
 * order (castableAttackSpells already filters SPELLS in that order, so the
 * first candidate found stands unless a later one is a STRICT improvement).
 * Returns the spell object, or `null` when nothing is castable. Pure read,
 * no rng, no mutation — deterministic given `state.c`.
 */
export function bestAttackSpell(state) {
  const options = castableAttackSpells(state);
  let best = null;
  let bestLevel = -1;
  let bestThrown = false;
  for (const sp of options) {
    const lvl = spellLevelFor(state.c.sub, sp);
    const thrown = sp.kind === "thrown";
    if (lvl > bestLevel || (lvl === bestLevel && thrown && !bestThrown)) {
      best = sp;
      bestLevel = lvl;
      bestThrown = thrown;
    }
  }
  return best;
}
