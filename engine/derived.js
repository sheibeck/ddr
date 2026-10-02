// engine/derived.js
//
// Pure, state-scoped derived character numbers (ENG-01). Ports the prototype's
// strikeDie/toHit/weaponDamage/upkeep/foeDie/foeToHitVs/inDark/levelFromSP/eff/
// skill helpers (mazeworld.html lines 1444-1498, 628-629, 1872-1876) and the
// Magic-User school gate helpers (lines 879-887), replacing every global `S.c`
// read with an explicit passed `c` (character) or `state` parameter. No global
// S, no DOM, no Math.random — only pure reads and arithmetic.

import { CLASSES, RACES, WEAPONS, STRIKE_DICE, THRESHOLDS, MU_CHART, MU_SPELL_EXCEPTIONS, ARMORS, BAGS, SPELLS, SPELL_LEVEL_OVERRIDES, SLOT_OF, POTIONS, JEWELRY, CLOAKS, STAVES, TOOLS, ACTIVATION_OF, FLEE_NEED, FLEE_THIEF_BONUS, FLEE_CLASS_MOD, FLEE_RACE_MOD, STAFF_WEAPON, STAFF_NAMES, SIZE_STEP_OF, SIZE_NAMES, SIZE_NAME_ORIGIN } from "../content/index.js";
import { rollDice, rollCheck, atLeastFor } from "./dice.js";
import { foeAccuracyFor, classEvasionFor, classArmorMulFor, fleeNeedModFor, controlResistFacesFor } from "./difficulty.js";
import { derivedRng } from "./rng.js";
// 260918-w4n: `remaining`/`isReady` are no longer read here — isFlying and
// conditionsOf's flight chip now read purely through itemEffectActive/
// liveItemEffects (this module's own timer-only model); item readiness
// itself is engine/items.js#itemReady's concern.

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
// to-hit RANGE SHRINKS by AFRAID_TO_HIT_PENALTY — a to-hit "need" is a count
// of winning faces on the strike die (Phase 73, ROLL-05: the engine reads the
// check roll-high, a strike lands on roll >= atLeastFor(need, dieN)), so a
// SMALLER need is FEWER winning faces, HARDER to hit; see afraidNeed below,
// floor 1, and an untouchable (need 0) foe is never made hittable by fear —
// and the player's already-rolled weapon damage is
// halved (AFRAID_DMG_DIV, Math.ceil, floor 1; see afraidDamage below). Every
// other action stays fully available while afraid — nothing is ever refused
// for fear (see refuseIfPending in engine/combat.js, which never fires on an
// afraid character, only a pending one).
export const AFRAID_ROUNDS = 2;
export const AFRAID_TO_HIT_PENALTY = 3;
export const AFRAID_DMG_DIV = 2;

// Phase 19 D-10: while dazed (a foe's daze on the hero, `c.foeEffect.kind ===
// "dazed"`), toHit takes this many winning faces away (floor 1). CMBUI-13
// (Phase 77, plan 77-07): named so the foeDebuffed payload and the strike
// `mods` state the engine's own number instead of copy typing it by hand.
export const DAZED_TO_HIT_PENALTY = 2;

// TUNING KNOBS — Size (Phase 75.2, RULES-11, user ruling 2026-09-25, "Hero
// Size Matters"): a character's size is now a real stat — the total step is
// race base (content/races.js's SIZE_STEP_OF, keyed by the row's own `size`
// string) plus any live item size effect (`eff(c, "size")`). Each step UP
// adds SIZE_DAMAGE_PER_STEP damage to every strike and SIZE_FACES_PER_STEP
// winning face to every foe trying to land a blow on that body; each step
// DOWN subtracts the same (floored elsewhere: weaponDamage/expectedStrike's
// existing Math.max(1, ...), foeToHitVs/foeToHitBreakdown's existing
// Math.max(1, ...)). Race signatures survive size (user ruling, "Race
// signatures and Joiners"): a race's OWN base step is dropped on whichever
// axis that race's own defining trait already pushes the opposite way (see
// content/races.js's `sizeAxes` and sizeAxisStep below) — the size step then
// only adds, it never cancels a race's defining trait. Item size steps are
// NEVER masked: they always apply in full on both axes. A Joiner gets size
// from its own race, by the same rule (sizeAxisStep(memberSheet, axis)).
export const SIZE_DAMAGE_PER_STEP = 2;
export const SIZE_FACES_PER_STEP = 1;

/**
 * raceSizeStep(sheet) — RULES-11 (Phase 75.2): a character's race's BASE
 * size step — SIZE_STEP_OF of the race row's own `size` string. 0 for an
 * unknown race, a race row with no `size`, or an unrecognized `size` string
 * (never throws on a tampered save). The ONLY `SIZE_STEP_OF` read in this
 * engine. Pure, no rng.
 */
export function raceSizeStep(sheet) {
  const R = sheet && RACES[sheet.race];
  const size = R && R.size;
  return (size && SIZE_STEP_OF[size]) || 0;
}

/**
 * itemSizeStep(sheet) — RULES-11 (Phase 75.2): the sum of every currently
 * LIVE item size effect (`eff(sheet, "size")`, e.g. a used Gauntlet of the
 * Giant) — the ONLY size `eff` call in this engine. 0 with no live
 * size-stepping item. Pure, no rng.
 */
export function itemSizeStep(sheet) {
  return eff(sheet, "size");
}

/**
 * sizeStepOf(sheet) — RULES-11 (Phase 75.2): the character's TOTAL size
 * step — race base plus items, used only for the displayed size NAME
 * (sizeName below, heroSize's `step`) — never itself an axis-masked value
 * (the mask only matters for damage/to-hit, not for naming the size). Pure,
 * no rng.
 */
export function sizeStepOf(sheet) {
  return raceSizeStep(sheet) + itemSizeStep(sheet);
}

/**
 * sizeAxisStep(sheet, axis) — RULES-11 (Phase 75.2), the signature rule
 * (user ruling 2026-09-25, "Race signatures and Joiners"): the size step
 * that actually applies to `axis` ("dmg" or "face") right now — the race's
 * OWN base step UNLESS the race row's own `sizeAxes[axis] === false` (that
 * axis is masked because the race's own defining trait on that axis already
 * pushes the opposite way — content/races.js's SIZE_AXIS_TRAITS/`sizeAxes`),
 * plus the item step (never masked). The ONLY `sizeAxes` read in this
 * engine — a signature is read from content data, never a race-name check.
 * Tolerant of a missing race, race row, or `sizeAxes` (unmasked) and an
 * unknown `axis` key (masked reads false, contributing 0 from the base).
 * Pure, no rng.
 */
export function sizeAxisStep(sheet, axis) {
  const R = sheet && RACES[sheet.race];
  const masked = !!(R && R.sizeAxes && R.sizeAxes[axis] === false);
  const base = masked ? 0 : raceSizeStep(sheet);
  return base + itemSizeStep(sheet);
}

/**
 * sizeName(step) — RULES-11 (Phase 75.2): the displayed size name for a
 * total step — SIZE_NAMES at SIZE_NAME_ORIGIN + step, clamped to the
 * array's own ends for a step beyond either extreme (e.g. a Troll using
 * both the Gauntlet and Enlarge reads "Giant", clamped, not an out-of-range
 * index). Pure, no rng.
 */
export function sizeName(step) {
  const idx = clamp(SIZE_NAME_ORIGIN + (step || 0), 0, SIZE_NAMES.length - 1);
  return SIZE_NAMES[idx];
}

/**
 * heroSize(c) — RULES-11 (Phase 75.2): a character's full size readout —
 * `step` (total, race + items), `base` (race only), `name`
 * (sizeName(step)), `baseName` (sizeName(base)), `dmgStep`
 * (sizeAxisStep(c, "dmg")), `faceStep` (sizeAxisStep(c, "face")). Pure, no
 * rng.
 */
export function heroSize(c) {
  const base = raceSizeStep(c);
  const step = sizeStepOf(c);
  return {
    step,
    base,
    name: sizeName(step),
    baseName: sizeName(base),
    dmgStep: sizeAxisStep(c, "dmg"),
    faceStep: sizeAxisStep(c, "face"),
  };
}

/**
 * sizeDamage(c) — RULES-11 (Phase 75.2): the flat damage term a
 * character's current size contributes to a strike — SIZE_DAMAGE_PER_STEP
 * times the DAMAGE axis's own resolved step (sizeAxisStep(c, "dmg"), the
 * signature mask already applied). Read by weaponDamage/expectedStrike in
 * place of the old Gauntlet-only flat size line (Phase 15, ECON-08); the same
 * function serves a Joiner's own member view (weaponDamage(memberView(sheet,
 * ally), rng)) since it reads only the passed-in sheet's own race/timers.
 * Pure, no rng.
 */
export function sizeDamage(c) {
  return SIZE_DAMAGE_PER_STEP * sizeAxisStep(c, "dmg");
}

// --- skills (state-scoped, not global) -------------------------------------

/** skill(c, name) — does the character have skill `name` at all? */
export const skill = (c, n) => !!(c.skills && c.skills[n]);

/** skillTier(c, name) — 0 (none), 1, or 2 (raised). */
export const skillTier = (c, n) => (c.skills && c.skills[n]) || 0;

/**
 * abilityEffectActive(c, key) — Phase 38 (ABIL-02): true only when the
 * character carries a live `ability:<key>` timers record (Phase 36's
 * `c.timers`) currently in the "effect" phase with rounds remaining. A
 * record that has rolled over into "cooldown" phase (the effect has worn
 * off, only the cooldown remains) reads false, as does a missing record or
 * any other shape. Pure read; no rng, no mutation.
 */
export function abilityEffectActive(c, key) {
  const rec = c && c.timers && c.timers[`ability:${key}`];
  return !!(rec && rec.phase === "effect" && rec.left > 0);
}

/**
 * partyEffectActive(state, key) — Phase 38 (ABIL-05): true when ANY live
 * party member's own persistent sheet carries a live `ability:<key>` effect
 * (Battle Roar's "covers the whole side" term — a member's Battle Roar
 * shifts the hero's own to-hit too, and vice versa). Scans
 * `state.combat.allies` (wp > 0) against `state.party[a.partyIdx]`, reusing
 * `abilityEffectActive`'s exact live-effect check per member. False on
 * every fixture (no fixture carries a party) and on a `state` with no
 * combat/party/allies at all. Pure read, no rng, no mutation.
 */
export function partyEffectActive(state, key) {
  return !!(
    Array.isArray(state.party) &&
    state.combat &&
    Array.isArray(state.combat.allies) &&
    state.combat.allies.some((a) => a.wp > 0 && abilityEffectActive(state.party[a.partyIdx], key))
  );
}

/**
 * eff(c, key) — sum of the named effect across the character's currently
 * LIVE item timer records (and, since Phase 90, live spell-sourced timed
 * effects: a `spell:<name>` record whose SPELLS row carries an `act`).
 *
 * 260918-w4n (use-activated-only, user ruling 2026-09-18: "Nothing works
 * without using it, which triggers its cooldown"): rewritten as a SINGLE
 * timer-only path — an effect exists ONLY while its own `item:<name>`
 * c.timers record is live (`liveItemEffects`, defined below), started by
 * `useItem` on a WORN item. This function no longer reads `c.items`, `c.worn`,
 * or any item object's own `eff` map at all: a bagged or worn-but-unused
 * magic item (Cloak of Armor, Ring of Power, an unused Amulet of Light, …)
 * contributes nothing, whether carried in the bag or sitting worn and idle.
 * The `eff` map now lives only as data on `content/treasure-tables.js`'s
 * authored rows, copied onto the item's own `item:<name>` timer record as
 * `act.eff` (content/treasure-tables.js#buildActivation) — this function
 * sums THAT payload across every currently-live record.
 *
 * Pure, no rng, no mutation. (`liveItemEffects` is declared further down this
 * module; hoisting makes it available here.)
 */
export function eff(c, key) {
  let t = 0;
  for (const { act } of liveItemEffects(c)) {
    if (act.eff && typeof act.eff === "object" && typeof act.eff[key] === "number") t += act.eff[key];
  }
  return t;
}

/**
 * critWardOf(c) — quick 260928-cos (user-approved fix 2026-09-28): the name
 * of the live item (or, since Phase 90, the live spell effect) whose `critWard` payload protects `c` (the Cloak of
 * Strength: "no critical damage lands on you"), or null. While it returns a
 * name, a foe's critical against `c` lands as an ordinary hit — engine/
 * combat.js reads it at every foe-crit site (foeTurn's hero branch and member
 * branch, pursuitStrike). It is protection only: it never touches `c`'s OWN
 * crits (that is the Guard/Soldier/dark ban, noCritFor and playerStrike).
 * Reads the timer records only, like eff(), so a bagged or worn-but-unused
 * cloak grants nothing, and it serves a Joiner's own sheet the same way (its
 * own `timers`). An old save's worn cloak still carries the retired
 * `eff: { noCrit: 1 }` on the item object; that copy is inert (eff reads the
 * content payload through ACTIVATION_OF), so it loads and wards unchanged.
 * Pure, no rng, never throws on a missing/odd `c`.
 */
export function critWardOf(c) {
  for (const { key, act } of liveItemEffects(c)) {
    if (act.eff && typeof act.eff === "object" && typeof act.eff.critWard === "number" && act.eff.critWard > 0) return key;
  }
  return null;
}

/**
 * BAG_FREE_KINDS — the closed list of item `kind`s that never consume a bag
 * slot: `"potion"` (LOOT-04 user rule, 2026-09-15 — special potions live in
 * `c.items` but are exempt), `"scroll"` (quick 260918-vvt, 2026-09-18 scope
 * amendment — scrolls are the `c.scrolls` scalar today and never enter
 * `c.items`; listed defensively so a future scroll ITEM is exempt by
 * construction), and `"bag"` (a `kind:"bag"` upgrade is applied in place by
 * `engine/items.js#stowItem` and never itself stowed). THE bag-free
 * predicate lives here as `takesBagSlot` below — `slotItems`,
 * `engine/items.js#stowItem`, `src/browser/viewModels.js#dropShelfItems` and
 * mazeworld.html's find card / loot `needsSlot` all read it and nothing else
 * may re-derive the rule from `it.kind`.
 */
export const BAG_FREE_KINDS = new Set(["potion", "scroll", "bag"]);

/**
 * takesBagSlot(it) — true if `it` would consume a bag slot (anything except
 * a `BAG_FREE_KINDS` kind); false for a bag-free kind AND for any non-object
 * (null/undefined/string/number). Pure, no rng, no mutation.
 */
export function takesBagSlot(it) {
  return !!it && typeof it === "object" && !BAG_FREE_KINDS.has(it.kind);
}

/**
 * slotItems(c) — LOOT-04 user rule (2026-09-15): only gear and treasure
 * consume bag slots. Healing potions (`c.potions`) and scrolls (`c.scrolls`)
 * are already scalars; SPECIAL potions (`kind:"potion"`, e.g. Acuteness) live
 * in `c.items` but are exempt from the slot count, per `takesBagSlot`
 * (potions, scrolls, bags). This is THE capacity count every engine and
 * shell site must read instead of a raw `c.items.length`. Defensive against
 * null/undefined entries and a missing/non-array `c.items` (returns `[]`);
 * never mutates.
 */
export function slotItems(c) {
  return (c && Array.isArray(c.items) ? c.items : []).filter(takesBagSlot);
}

/**
 * SLOT_FAMILIES / WORN_KEYS_OF / WORN_FAMILY_OF / WORN_SLOTS — 260918-wy1
 * (jewelry-merge ruling, user 2026-09-18: "We should not have ring/bracelet/
 * amulet as separate equipment slots. We should have jewelry as a slot.
 * Let's allow us to slot up to 2 pieces of jewelry: any combination of
 * rings, bracelets, amulets, and helms."): the four former sub-slots (ring/
 * bracelet/amulet/helm) collapse into ONE family, `jewelry`, holding up to
 * TWO pieces at once (any combination, including two of the same former
 * sub-kind); the cloak keeps its own single-key family, unchanged.
 *
 * `SLOT_FAMILIES` is the frozen ordered list of families (`slotFor` below
 * returns one of these, or null). `WORN_KEYS_OF` is the frozen family ->
 * concrete-worn-keys table (`jewelry` maps to TWO keys; `cloak` to one;
 * each inner array is itself frozen). `WORN_FAMILY_OF` is its inverse
 * (concrete key -> family), built once, below. `WORN_SLOTS` stays the
 * flat, ordered list of concrete KEYS — the address space every action
 * (`useItem`/`unequipSlot`/`equipItem`), the `c.worn` map itself, and every
 * display/report order (Gear tab, combat submenu, reconcileWorn) all read —
 * kept as the literal `["jewelry1", "jewelry2", "cloak"]` (not derived via
 * the flatMap at the call sites) so this is the one obvious place the grep
 * gates and the docs point at; a test pins it equal to
 * `SLOT_FAMILIES.flatMap(f => WORN_KEYS_OF[f])` to prove the two never
 * drift apart. `c.worn = { jewelry1?, jewelry2?, cloak? }` is the flat
 * key -> item-object map these keys address (never an array, never a
 * family-keyed map) — see the plan's "Worn shape" decision for why a flat
 * two-key form was chosen over an array.
 */
export const SLOT_FAMILIES = Object.freeze(["jewelry", "cloak"]);

export const WORN_KEYS_OF = Object.freeze({
  jewelry: Object.freeze(["jewelry1", "jewelry2"]),
  cloak: Object.freeze(["cloak"]),
});

export const WORN_FAMILY_OF = Object.freeze(
  Object.fromEntries(
    SLOT_FAMILIES.flatMap((family) => WORN_KEYS_OF[family].map((key) => [key, family])),
  ),
);

export const WORN_SLOTS = Object.freeze(["jewelry1", "jewelry2", "cloak"]);

/**
 * freeWornKey(c, family) — 260918-wy1: the ONE first-free-key rule for a
 * worn family — the first key of `WORN_KEYS_OF[family]` with no item
 * currently worn there, or `null` when every key of that family is
 * occupied (or `family` is not a known family). Every reader that needs to
 * know "which concrete key would this family item wear into next" —
 * `engine/items.js#autoWearSlot`/`equipItem`, `reconcileWorn` below, and
 * `engine/saveState.js#sanitizeWorn`'s legacy fold — reads THIS function,
 * never re-derives the rule. Pure read: never creates `c.worn` (a `c` with
 * no worn map yet is treated as if every key were free, so the first key of
 * the family comes back) and never mutates anything. Null-safe.
 */
export function freeWornKey(c, family) {
  const keys = WORN_KEYS_OF[family];
  if (!keys) return null;
  const worn = c && c.worn && typeof c.worn === "object" ? c.worn : {};
  return keys.find((k) => !worn[k]) ?? null;
}

/**
 * slotFor(it) — Phase 37 (GEAR-03), rewritten 260918-wy1 (jewelry-merge):
 * which worn slot FAMILY item `it` belongs to, or `null` if it is not a
 * slot item at all (weapon/armor/potion/scroll/picks/bag/staff/etc).
 * Resolution order: `it.slot` when the item itself carries a string `slot`
 * (forward-compat — no current construction site spreads one, see
 * content/treasure-tables.js's header comment, but a future one might; every
 * JEWELRY_ROWS entry now authors `slot: "jewelry"`, the family, not a
 * concrete key); else `SLOT_OF[it.n]` (content/treasure-tables.js's
 * name-keyed taxonomy, covering every current JEWELRY/CLOAKS row — values
 * are only `jewelry`/`cloak`); else a `kind` fallback for an item rolled
 * under a name SLOT_OF doesn't recognize (e.g. a save from before this
 * taxonomy existed, or test fixtures) — `kind === "jewel"` -> `jewelry`
 * (260918-wy1: new, mirrors the pre-existing cloak fallback so a jewel rolled
 * under an unknown name still has a home), `kind === "cloak"` -> `cloak`.
 * 260918-w4n: a staff is NOT a slot item — it resolves to `null` here
 * unconditionally; it is a bag item used by index. Null-safe: a non-object
 * `it` returns null. Pure, no rng, no mutation.
 */
export function slotFor(it) {
  if (!it || typeof it !== "object") return null;
  if (typeof it.slot === "string") return it.slot;
  if (SLOT_OF[it.n] !== undefined) return SLOT_OF[it.n];
  if (it.kind === "jewel") return "jewelry";
  if (it.kind === "cloak") return "cloak";
  return null;
}

/**
 * carriedItems(c) — Phase 37 (GEAR-03): bag ∪ worn — every item the
 * character has on their person, whether in `c.items` or a populated
 * `c.worn` slot. 260918-w4n: `hasItemNamed` (the old name-identity check
 * `isFlying`/`conditionsOf` used to tell the Bracelet of Flight and the
 * Cloak of Flying apart) is retired — both items' flight is now read purely
 * through their own LIVE `item:<name>` timer record (`itemEffectActive`),
 * which already carries its own identity via the record's key, so no
 * separate name lookup is needed. `carriedItems` itself is still needed by
 * the staffCharges condition chip and `narrateTimerTransitions` (their
 * `carriedItems(c).find((x) => x.n === key)` lookup must find a WIELDED
 * staff's recharge record too, not just a bagged one). Returns a NEW array
 * (`c.items` first, in order, then the truthy `c.worn` values, then —
 * RULES-13, Phase 75 — the wielded staff via `wieldedStaff(c)`, when one is
 * held; never duplicated, since a wielded staff is never ALSO in `c.items`);
 * never mutates `c`. Defensive: a missing/non-array `c.items` and a missing/
 * non-object `c.worn` both contribute nothing rather than throwing.
 * 260918-wy1 (jewelry-merge): shape-agnostic by construction —
 * `Object.values(c.worn)` reads whichever concrete keys are populated
 * (jewelry1/jewelry2/cloak) without caring which family they belong to, so
 * this needed no change.
 */
export function carriedItems(c) {
  const items = c && Array.isArray(c.items) ? c.items : [];
  const worn = c && c.worn && typeof c.worn === "object" ? Object.values(c.worn).filter(Boolean) : [];
  const staff = wieldedStaff(c);
  return staff ? [...items, ...worn, staff] : [...items, ...worn];
}

/**
 * weaponRow(name) — RULES-13 (Phase 75, user 2026-09-25): the ONE row lookup
 * that resolves a weapon-slot NAME (c.weapon, or a candidate item's `base`)
 * to its combat-stats row — `WEAPONS[name]` for an ordinary weapon, or
 * `STAFF_WEAPON` when `name` is one of the eight `STAFF_NAMES` (a wielded
 * magic staff fights as a flat d8 melee weapon, plus the hero's usual damage
 * modifiers). `null` for "Fists", an unrecognized name, or a missing/
 * undefined name — never throws on a tampered `c.weapon`. Every engine read
 * of "what weapon am I holding" — weaponNeedMod, weaponCrit, weaponDamage,
 * expectedStrike, gearCompareParts's `have` side, and combat.js's WEAPON_MAX
 * read — goes through this ONE lookup, so a wielded staff behaves like a d8
 * weapon everywhere without restating the staff branch five times. Pure, no
 * rng.
 */
export function weaponRow(name) {
  if (WEAPONS[name]) return WEAPONS[name];
  if (STAFF_NAMES.includes(name)) return STAFF_WEAPON;
  return null;
}

/**
 * wieldedStaff(c) — RULES-13 (Phase 75, user 2026-09-25): the currently-
 * WIELDED staff object (with its live charges), or `null` when none is
 * wielded. `c.staff` and `c.weapon` must agree (`c.staff.n === c.weapon`) —
 * a mismatch (a tampered or stale save mid-migration) reads as "no staff
 * wielded" here; engine/saveState.js's own tolerant load is what actually
 * repairs a mismatch on disk. Pure, no rng, never mutates `c`.
 */
export function wieldedStaff(c) {
  return c && c.staff && c.staff.n === c.weapon ? c.staff : null;
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
 * reconcileWorn(c) — Phase 37 (GEAR-04), rewritten 260918-wy1 (jewelry-merge):
 * the load-time / newRun-option migration that creates the worn-slot model
 * on a character that lacks it. A COMPLETE no-op — returns `null` — unless
 * `c` is a non-null, non-array object WITHOUT an own `worn` key (never
 * re-migrates a `c` that already has one, even an empty `{}`). Otherwise:
 * sets `c.worn = {}`, then walks `c.items` in bag order — for each item with
 * a non-null family (`slotFor(it)`), looks up `freeWornKey(c, family)`; when
 * a key is free, moves the item (the SAME object, not a copy) into
 * `c.worn[key]` and records its display name under that FAMILY's `worn`
 * list; when the family is full, the item stays in the bag and its name is
 * recorded under that family's `bagged` list. Rebuilds `c.items` from the
 * items that stayed bagged, in their original relative order (only when
 * `c.items` was itself an array).
 *
 * Returns a reconciliation report — one `{ slot, worn, bagged }` entry PER
 * FAMILY (`slot` is the family name, `jewelry` or `cloak`; `worn` is now an
 * ARRAY of display names — up to two for jewelry; `bagged` is an array of
 * display names left behind), in `SLOT_FAMILIES` order, only for families
 * that wore or bagged at least one item — or `[]` when nothing was worn.
 * Report objects use only `slot`/`worn`/`bagged` keys (never `type` —
 * test/unit/narrationLinesCoverage.test.js's event-vocabulary scanner greps every
 * `type:` key across engine/*.js).
 *
 * Moving bag -> worn only ever FREES bag slots (items leave the bag, none
 * are added), so this can never overflow a bag-cap. Adds NO rng draw — pure
 * reads/reassignment. Callers — `engine/state.js#newRun` on every fresh
 * roll and both load chains (`validateSave`/`rehydrate`), all unconditional
 * since Phase 45 (HEDGE-01/02); returns `null` (touching nothing) when `c`
 * already owns `worn`, which is what makes a second load a no-op.
 *
 * 260918-w4n (staff amendment): a staff is never eligible here — `slotFor`
 * already returns `null` for one, so it always stays bagged.
 */
export function reconcileWorn(c) {
  if (!c || typeof c !== "object" || Array.isArray(c) || "worn" in c) return null;
  c.worn = {};
  const hadItems = Array.isArray(c.items);
  const source = hadItems ? c.items : [];
  const kept = [];
  const reportByFamily = new Map();
  for (const it of source) {
    const family = it && slotFor(it);
    if (!family) {
      kept.push(it);
      continue;
    }
    if (!reportByFamily.has(family)) reportByFamily.set(family, { slot: family, worn: [], bagged: [] });
    const key = freeWornKey(c, family);
    if (key) {
      c.worn[key] = it;
      reportByFamily.get(family).worn.push(it.n);
    } else {
      reportByFamily.get(family).bagged.push(it.n);
      kept.push(it);
    }
  }
  if (hadItems) c.items = kept;
  const report = [];
  for (const family of SLOT_FAMILIES) if (reportByFamily.has(family)) report.push(reportByFamily.get(family));
  return report;
}

/**
 * hasTool(c, tool) — Phase 39 (GEAR-05): does the character currently carry
 * (BAG only — a tool has no worn slot) a `kind:"tool"` item whose `tool` key
 * is `tool` ("torch"|"rope"|"ladder")? The ONE gate engine/movement.js's
 * hazard pre-check and `useTool` consult, and engine/items.js's
 * `rollTreasureItem`/`takeItem` haveOne refusal. False for every parity
 * fixture and the bot (neither carries a tool), so the roll/no-tool
 * movement path stays byte-identical. Pure, no rng, no mutation.
 */
export function hasTool(c, tool) {
  return (c && Array.isArray(c.items) ? c.items : []).some((it) => it && it.kind === "tool" && it.tool === tool);
}

/* ---------------- item activation model (Phase 39, GEAR-02) ---------------
 *
 * ONE activation model for every item that does something when used:
 * duration+cooldown (jewelry/cloaks), charges+recharge (staves),
 * consumable-with-duration (potions) — all as `c.timers` records on Phase
 * 36's engine/effects.js. `content/activations.js#ACTIVATION_OF` is the pure
 * data declaration; these functions are the ONLY engine-side readers.
 */

/**
 * activationKeyFor(it) — Phase 39 (GEAR-02): the `content/activations.js#
 * ACTIVATION_OF` lookup key for carried item `it` — a potion resolves
 * through its `eff2` field (POTIONS[].eff) back to the POTIONS row's OWN
 * display name `n` (a potion item's own `.n` carries a color suffix from a
 * find, or is a plain "<name> potion" from the store — neither matches the
 * POTIONS row name directly); a tool (Plan 04) or any treasure item resolves
 * by its own `.n` directly. Returns `null` for a weapon/armor/picks/bag item,
 * or any item this lookup cannot resolve. Pure, no rng, no mutation.
 */
export function activationKeyFor(it) {
  if (!it || typeof it !== "object") return null;
  if (it.kind === "potion") {
    const p = POTIONS.find((row) => row.eff === it.eff2);
    return p ? p.n : null;
  }
  return typeof it.n === "string" ? it.n : null;
}

/**
 * canonItemText(it) — Phase 89 plan 09 (TEXT-01): the CURRENT content text for
 * a known item, or `null` when the item has no content row of its own. A
 * potion resolves by its `eff2` (the activationKeyFor rule: the store's "X
 * potion" and a find's "X potion (colour)" share one POTIONS row); a jewel, a
 * cloak and a staff resolve by their display name `n` in JEWELRY, CLOAKS and
 * STAVES; a tool by its `tool` key (else its name) in TOOLS. A weapon, an
 * armour, a bag, lockpicks, a scroll or anything unrecognised is `null`: their
 * text is built from live fields, not read from a row. The one place a saved
 * item's words are compared with the game's (engine/saveState.js#
 * refreshItemTexts), so a reworded row reaches an old save. Pure, no rng,
 * never mutates `it`, never throws on a hostile value.
 */
export function canonItemText(it) {
  if (!it || typeof it !== "object" || Array.isArray(it)) return null;
  let row = null;
  switch (it.kind) {
    case "potion":
      row = POTIONS.find((p) => p.eff === it.eff2);
      break;
    case "jewel":
      row = JEWELRY.find((r) => r.n === it.n);
      break;
    case "cloak":
      row = CLOAKS.find((r) => r.n === it.n);
      break;
    case "staff":
      row = STAVES.find((r) => r.n === it.n);
      break;
    case "tool":
      row =
        typeof it.tool === "string" && Object.prototype.hasOwnProperty.call(TOOLS, it.tool)
          ? TOOLS[it.tool]
          : Object.values(TOOLS).find((t) => t.n === it.n);
      break;
    default:
      return null;
  }
  return row && typeof row.txt === "string" ? row.txt : null;
}

/** activationFor(it) — Phase 39 (GEAR-02): the item's own activation record
 * (`ACTIVATION_OF[activationKeyFor(it)]`), or `null` when it has none. Pure. */
export function activationFor(it) {
  const key = activationKeyFor(it);
  return key ? (ACTIVATION_OF[key] ?? null) : null;
}

/** itemTimerId(it) — Phase 39 (GEAR-02): the `c.timers` id for item `it`'s
 * own effect/cooldown record (`"item:<key>"`), or `null` when `it` has no
 * resolvable activation key. Pure. */
export function itemTimerId(it) {
  const key = activationKeyFor(it);
  return key ? `item:${key}` : null;
}

/** chargesTimerId(it) — Phase 39 (GEAR-02): the `c.timers` id for a staff's
 * own recharge-cooldown record (`"charges:<key>"`), or `null`. Pure. */
export function chargesTimerId(it) {
  const key = activationKeyFor(it);
  return key ? `charges:${key}` : null;
}

/**
 * SPELL_ACT_OF — Phase 90 (SPELL-09): spell name -> its `act` record, for every
 * SPELLS row that carries one (Strength today; the SPELL-10 slate's timed
 * spells next). A row with an `act` is a SPELL-SOURCED TIMED EFFECT: casting it
 * starts a `spell:<n>` c.timers record (engine/combat.js#startSpellEffect) and
 * liveItemEffects reads the live record back through this map, so the one
 * activation vocabulary (`act.kind`, `act.eff`, ...) serves items and spells.
 * Built once, frozen. A `spell:` record whose name is not here (the
 * `spell:weaken` and `spell:reveal` windows) is not a spell effect and is
 * ignored by liveItemEffects.
 */
export const SPELL_ACT_OF = Object.freeze(
  Object.fromEntries(SPELLS.filter((sp) => sp.act && typeof sp.act === "object").map((sp) => [sp.n, sp.act])),
);

/**
 * liveItemEffects(c) — Phase 39 (GEAR-02): every currently-LIVE timed effect
 * on `c` — a `c.timers` record in `phase: "effect"` with `left > 0` whose id is
 * either `"item:<key>"` with a known `ACTIVATION_OF` entry (an unknown key —
 * e.g. a stripped item, or a tampered save, T-39-07 — is silently skipped,
 * never thrown) or, since Phase 90 (SPELL-09), `"spell:<name>"` with a known
 * `SPELL_ACT_OF` entry (a spell with an `act` record; `spell:weaken` and
 * `spell:reveal` are not). Returns an array of `{ key, act, rec, source }` in
 * `c.timers`'s own insertion (`Object.keys`) order; `source` is `"item"` or
 * `"spell"`, and `key` is the item's or the spell's name. The item/spell ids
 * never collide (`item:Strength` is the potion, `spell:Strength` the spell).
 * Pure read, no rng, no mutation.
 */
export function liveItemEffects(c) {
  const out = [];
  if (!c || !c.timers || typeof c.timers !== "object") return out;
  for (const id of Object.keys(c.timers)) {
    const isItem = id.startsWith("item:");
    if (!isItem && !id.startsWith("spell:")) continue;
    const rec = c.timers[id];
    if (!rec || rec.phase !== "effect" || !(rec.left > 0)) continue;
    const key = id.slice(isItem ? "item:".length : "spell:".length);
    const act = isItem ? ACTIVATION_OF[key] : Object.prototype.hasOwnProperty.call(SPELL_ACT_OF, key) ? SPELL_ACT_OF[key] : null;
    if (!act) continue;
    out.push({ key, act, rec, source: isItem ? "item" : "spell" });
  }
  return out;
}

/** posInt(v) — a positive safe integer (module-private helper for the hot reads). */
function posInt(v) {
  return Number.isSafeInteger(v) && v > 0;
}

/** validHot(act) — Phase 88 (ITEM-03): does `act` carry a usable heal-over-time
 * record (`hot: { every, ticks }` positive integers) on a positive-integer
 * `effect` window? Module-private. */
function validHot(act) {
  return !!act && typeof act === "object" && !!act.hot && typeof act.hot === "object"
    && posInt(act.hot.every) && posInt(act.hot.ticks) && posInt(act.effect);
}

/**
 * healTicksDue(act, leftBefore, n) — Phase 88 (ITEM-03): the heal-over-time
 * tick numbers (1-based, ascending) a step of `n` squares brings on a live
 * window that has `leftBefore` squares left BEFORE the step. Progress is
 * derived from the record itself (`elapsed = effect - left`), so no new
 * serialized field exists and a saved window resumes exactly. A step moves
 * elapsed from e to min(effect, e + n); the ticks due are every whole
 * multiple of `hot.every` in (e, e + n], capped at `hot.ticks`, so a
 * 2-square water step that crosses a mark ticks exactly once (never skipped,
 * never doubled). Returns [] for a missing/invalid hot, a non-integer
 * `leftBefore`, `leftBefore` outside (0, effect], or an `n` that is not a
 * positive integer. Pure, no rng.
 */
export function healTicksDue(act, leftBefore, n) {
  if (!validHot(act)) return [];
  if (!Number.isInteger(leftBefore) || leftBefore <= 0 || leftBefore > act.effect) return [];
  if (!posInt(n)) return [];
  const { every, ticks } = act.hot;
  const before = act.effect - leftBefore;
  const after = Math.min(act.effect, before + n);
  const out = [];
  for (let k = Math.floor(before / every) + 1; k <= Math.min(ticks, Math.floor(after / every)); k++) out.push(k);
  return out;
}

/**
 * healTicksLeft(act, rec) — Phase 88 (ITEM-03): how many heal ticks a LIVE
 * window still owes: 0 unless `act.hot` is valid and `rec` is a live effect
 * record (an integer `left` in (0, effect]); otherwise
 * `ticks - floor((effect - left) / every)`, clamped to [0, ticks]. Drives the
 * Regenerating chip's "N ticks" and the take-off line's unspent count. Pure.
 */
export function healTicksLeft(act, rec) {
  if (!validHot(act) || !rec || typeof rec !== "object") return 0;
  if (rec.phase !== "effect" || !Number.isInteger(rec.left) || rec.left <= 0 || rec.left > act.effect) return 0;
  const { every, ticks } = act.hot;
  return Math.max(0, Math.min(ticks, ticks - Math.floor((act.effect - rec.left) / every)));
}

/**
 * SOURCE_SLOTS — Phase 88 (ITEM-02): the slots a timed item effect can be
 * started from and is linked to: the three worn keys (WORN_SLOTS) and the
 * weapon slot, where a Magic User wields a staff. Order is the stable one.
 */
export const SOURCE_SLOTS = Object.freeze([...WORN_SLOTS, "weapon"]);

/**
 * sourceSlotItem(sheet, slot) — Phase 88 (ITEM-02): the item a source slot
 * holds RIGHT NOW on any character sheet (hero or Joiner): the wielded staff
 * for "weapon" (wieldedStaff: `c.staff` when it is the wielded weapon), the
 * worn item for a worn key. `null` for an empty slot, a non-source slot or a
 * missing sheet. The one place a slot's current item is read. Pure.
 */
export function sourceSlotItem(sheet, slot) {
  if (!sheet || typeof sheet !== "object") return null;
  if (slot === "weapon") return wieldedStaff(sheet);
  if (!WORN_SLOTS.includes(slot)) return null;
  const w = sheet.worn;
  return w && typeof w === "object" && w[slot] ? w[slot] : null;
}

/**
 * effectSourceOf(rec) — Phase 88 (ITEM-02): the validated `{ slot, n }` link
 * on an item-effect timer record, or `null` (no link, a malformed one, an
 * unknown slot, an empty name). Never throws on a hostile value. Pure.
 */
export function effectSourceOf(rec) {
  const s = rec && typeof rec === "object" ? rec.src : null;
  if (!s || typeof s !== "object" || Array.isArray(s)) return null;
  if (!SOURCE_SLOTS.includes(s.slot)) return null;
  if (typeof s.n !== "string" || s.n.length === 0) return null;
  return { slot: s.slot, n: s.n };
}

/**
 * itemEffectActive(c, kind) — Phase 39 (GEAR-02): is ANY live item effect (or,
 * since Phase 90, spell-sourced timed effect) of activation `kind` (e.g. `"haste"`, `"invis"`, `"ether"`, `"acute"`, `"fly"`)
 * currently active on `c`? The one read every retired-counter consumer
 * (strikeDie/foeToHitVs/weaponDamage/isFlying/the climb block) re-points to.
 * Pure, no rng.
 */
export function itemEffectActive(c, kind) {
  return liveItemEffects(c).some((e) => e.act.kind === kind);
}

/**
 * potionMight(c) — Phase 39 (GEAR-02): the sum of `act.might` across every
 * live `kind: "might"` item effect on `c` (the Strength potion — the ONLY
 * `might`-kind potion since RULES-11, Phase 75.2, Plan 02: Enlarge's
 * separate might payload is gone, replaced by a size step read through
 * `eff(c, "size")`/`sizeDamage` instead) — the timed replacement for the
 * old never-expiring `c.might += 8` write. Pure, no rng.
 */
export function potionMight(c) {
  let t = 0;
  for (const e of liveItemEffects(c)) if (e.act.kind === "might" && typeof e.act.might === "number") t += e.act.might;
  return t;
}

/**
 * strengthRoll(sheet, rng) — Phase 90 (SPELL-09, user 2026-09-30, report #8 and
 * Q1 A): the Strength spell's extra damage die. 0 unless a live effect of act
 * kind `"strength"` is on `sheet` (the `spell:Strength` record, 100 squares
 * from the cast); else the die `act.dice` (a d10) rolled from the DERIVED stream
 * `derivedRng(<rng.getState() when it is a function, else 0>, "strength")`, so
 * the main `rng` is only READ for its cursor and never advances (no existing
 * draw moves). Call it right AFTER a damage roll's own dice are drawn: the
 * cursor has then moved since the previous roll, so each roll (each blow of a
 * double strike, each foe a Lightning bolt reaches, each Fireballs bolt) gets
 * its own d10 and not a repeat. Added to the roll BEFORE every cap, floor,
 * Afraid halving and damage multiplier. One record means one die: a recast
 * restarts the record and never adds a second. A damage-over-time tick never
 * calls it (Q1). Integer, never throws on a missing sheet.
 */
export function strengthRoll(sheet, rng) {
  const dice = strengthDiceOf(sheet);
  if (!dice) return 0;
  const cursor = rng && typeof rng.getState === "function" ? rng.getState() : 0;
  return rollDice(derivedRng(cursor, "strength"), dice); // roll:amount
}

/**
 * spellStrengthParts(sheet, rng) — Phase 92.2 plan 01 (user ruling 2026-10-02:
 * "the Strength potion also boosts spells"): the ONE strength term every hero
 * (and Joiner) damage-spell roll adds, so the Strength spell's d10 and the
 * Strength potion's flat bonus can never drift apart. Returns
 * `{ strength, might, total }`: `strength` is the spell's d10 (strengthRoll,
 * a derived stream, 0 without a live Strength spell), `might` is the potion's
 * flat bonus (potionMight, 0 without a live Strength potion; the potion is the
 * drinker's, so a Joiner reads it from its own sheet only), `total` their sum.
 * The d10 is rolled ONCE here, and the caller reports that same value. The
 * main rng is never advanced. A damage-over-time tick never calls it.
 */
export function spellStrengthParts(sheet, rng) {
  const strength = strengthRoll(sheet, rng);
  const might = potionMight(sheet);
  return { strength, might, total: strength + might };
}

/** spellStrengthBonus(sheet, rng) — the `total` of spellStrengthParts, for a site that reports nothing. */
export function spellStrengthBonus(sheet, rng) {
  return spellStrengthParts(sheet, rng).total;
}

/**
 * strengthDiceOf(sheet) — Phase 90 (SPELL-09), module-private: the live
 * Strength record's die (`{ n, sides, bonus }`), or null. The one read
 * strengthRoll and weaponDamageRange share.
 */
function strengthDiceOf(sheet) {
  const live = liveItemEffects(sheet).find((e) => e.act.kind === "strength" && e.act.dice);
  return live ? live.act.dice : null;
}

// TUNING KNOB — Phase 41 (TERR-02, user-ratified Key Decision 2026-09-18,
// "one tap, two squares of time"): a single step onto a water cell costs
// TWO squares of `state.steps` instead of one — the HUD SQUARES counter and
// every squares-cadence system (item/spell/ability timers, the day/spell-
// charge cadences) advance by the full 2 on that one dispatch, in one tap.
// Phase 42 measures the resulting hunger/depth drift against the v1.5
// BEFORE pin; this knob is not retuned here.
export const WATER_MOVE_COST = 2;

/**
 * moveCost(state, cell) — Phase 41 (TERR-02): the `state.steps`/`tickSquares`
 * cost of a single step onto `cell` — `1` for a normal (or missing/null)
 * cell, `WATER_MOVE_COST` (2) for a genuine water cell. Flight and Ether are
 * exempt from the surcharge ("walls and crevices are nothing" — water too):
 * a LIVE `fly` item effect (a started Cloak of Flying / Bracelet of Flight
 * window) or a LIVE `ether` item effect both pay 1 on water. 260918-w4n
 * (use-activated-only): BOTH flight items are real resources now — there is
 * no more "the Bracelet is always flying" special case. A READY-but-
 * unstarted flight item is deliberately NOT flying here (the old auto-
 * activation on a climb/gorge tile is gone too) — a puddle does not spend
 * the item's cooldown the way a wall/crevice does; the water step simply
 * costs 2 and no effect record is started. Pure, zero rng: reads only
 * `state.c` and the passed cell.
 */
export function moveCost(state, cell) {
  if (!cell || cell.water !== true) return 1;
  const c = state.c;
  if (itemEffectActive(c, "fly")) return 1;
  if (itemEffectActive(c, "ether")) return 1;
  return WATER_MOVE_COST;
}

/**
 * isFlying(state) — 260918-w4n (use-activated-only, user ruling 2026-09-18:
 * "Nothing works without using it"): a character is flying iff a `fly`-kind
 * item effect is CURRENTLY LIVE (`itemEffectActive`) — either the Cloak of
 * Flying or the Bracelet of Flight, whichever was actually used. A
 * READY-but-unstarted flight item (worn or bagged) is NOT flying — the old
 * "ready counts as flying" rule (which let engine/movement.js's climb block
 * self-start a fresh window the instant this returned true) and the old
 * Bracelet-always-flies special case are both retired: only a live record,
 * started by `useItem` on a WORN item, ever grants flight. Pure read of
 * already-computed state; no rng, no mutation.
 */
export function isFlying(state) {
  return itemEffectActive(state.c, "fly");
}

/**
 * conditionsOf(state) — DR15-B (2026-09-10): a PURE derived enumeration of the
 * character's currently-active status conditions, good AND bad, as DATA ONLY
 * (no labels, no copy, no player-object copy). The UI (mazeworld.html) maps
 * each returned `key` to a short label + a good/bad chip; keeping copy out of
 * the engine keeps this reusable (e.g. a future party-member tracker) and
 * presentation-agnostic.
 *
 * Reads ONLY already-computed `state.c.*` fields (`c.timers` item effects/
 * cooldowns/charges, spell `c.might`, `c.ward`, affliction, darkFor) plus the
 * flight item-name checks isFlying already consults — NO rng draw, NO
 * mutation of state or c, NO new serialized field. It is therefore a
 * zero-parity-impact read: every frozen fixture round-trips byte-identical
 * because nothing is written.
 *
 * Returns an array of descriptors in a STABLE order — live item effects
 * (insertion order), the spell-`c.might` chip, ward, mirror, senses, regen,
 * foresight, reveal, flight, item cooldowns, staff charges, THEN the bad
 * block — each `{ key, polarity, ... }`:
 *   - haste/invis/acute/ether/might/enlarge/giant/… (Phase 39, GEAR-02, one
 *     chip per LIVE `c.timers` item effect, via liveItemEffects):
 *     {polarity:"good", remaining:<left>, cadence:"squares"|"rounds",
 *     source:<item display name>, might?:<amount, "might"-kind only>,
 *     step?:<the item's own ±1 size step>, size?:<the hero's CURRENT
 *     size name, heroSize(c).name — RULES-11, Phase 75.2, Plan 02, only
 *     when act.eff carries a numeric `size`, e.g. the Gauntlet of the
 *     Giant or Enlarge, dmgTotal?:<that item's whole damage bonus — the
 *     size step's plus its own eff.dmg bulk; Phase 89, ITEM-05: Enlarge 11,
 *     the Gauntlet 2>}
 *     Phase 88 (ITEM-03): a heal-over-time item (the Cloak of Regeneration, `knit`) adds ticks:<heal ticks still owed, healTicksLeft>
 *   - strength {polarity:"good", remaining:<squares left>, cadence:"squares", source:"Strength"} — Phase 90 (SPELL-09): the Strength SPELL's live `spell:Strength` record, reported by the same generic loop as an item effect (a spell-sourced timed effect, liveItemEffects)
 *   - might  {polarity:"good"}                            — the phobia rage's flat +d10 until the day ends (engine/encounters.js insanityRage is the only writer of c.might since Phase 90) — distinct from a potion's timed "might" chip above; both may appear together
 *   - ward   {polarity:"good", pool:<hp>, remaining?:<rounds>, name:<spell/item name>, mirror?:true} — Phase 31 (CMB-04): the Shield chip, mirroring c.ward's own {pool, rounds, name} shape. RULES-14 (Phase 75): an ARMED Bubble mirror also fires this (pool 0, no `remaining`, `mirror: true`); a popped Bubble pool keeps the plain Shield shape
 *   - mirror {polarity:"good", remaining:<rounds>}         — Phase 40 (SPELL-02): Mirror Self — c.mirror counts down once per foeTurn; cleared at endCombat
 *   - senses {polarity:"good"}                             — Phase 40 (SPELL-02): Sense Presence — a flat 0/1 flag (no count), lasts until endCombat clears it; also waives every forced foe-first initiative rule (see combat.js#rollInitiative)
 *   - regen  {polarity:"good"}                              — Phase 40 (SPELL-02): Regeneration — a flat boolean (no count, the d8/round tick has no duration field), cleared at endCombat
 *   - foresight {polarity:"good"}                           — Phase 40 (SPELL-02): an ARMED Sense Danger, waiting for the next fight (consumed by rollInitiative, which always sets it back to false)
 *   - reveal {polarity:"good"}                              — Phase 40 (SPELL-05): Map the Floor's window — the `spell:reveal` c.timers record, while its phase is "effect"; Plan 76-06: the window lasts until the next step, so the chip carries no countdown
 *   - flight {polarity:"good", flight:"charged", remaining:<sq>, cadence:"squares", source:<item display name>} — 260918-w4n: reported by the SAME generic live-item-effect loop as haste/invis/etc, only while a `fly`-kind record (Cloak of Flying OR Bracelet of Flight) is live; a ready-but-unused flight item yields NO flight chip, and a cooling one reports through the generic itemCooldown chip below like every other item
 *   - itemCooldown (Phase 39, GEAR-02, one per COOLING duration+cooldown item): {polarity:"good", item:<display name>, remaining:<sq left>}
 *   - staffCharges (Phase 39, GEAR-02, one per RECHARGING staff): {polarity:"good", item:<display name>, charges:<current>, max:<pool>, remaining:<sq left>}
 *   - affliction {polarity:"bad", kind:"Poison"|"Disease"|…}
 *   - darkness   {polarity:"bad", remaining:<sq left>}    — the persistent Darkness/phobia state
 *   - fearArmed  {polarity:"bad", phobia, trigger}         — Phase 41 (TERR-05): an ARMED terrain phobia waiting for the next fight; cleared when fight() consumes it
 *   - afraid     {polarity:"bad", remaining:<rounds>, phobia:<fear name>} — Phase 31 (user ruling 2026-09-16): the Afraid penalty from a triggered phobia in the CURRENT combat, only while combat.afraid > 0 (a Hardiness shrug-off shows nothing)
 *   - heroOut/heroBlind/heroShrunk {polarity:"bad"} — RULES-10 (Phase 75.1): a fumbled scroll's effect on the reader (see the block below)
 *
 * CMBUI-13 (Phase 77, the user's "no indication ... that [Smoke]'s active"):
 * every hero effect that changes a roll or the flow of a fight now has a
 * descriptor. Each is APPENDED at a fixed place — no older descriptor gains
 * a field or moves relative to another:
 *   - ability {polarity:"good", ability:<id>, remaining:<rounds>, cadence:"rounds"} — one per live `ability:<id>` c.timers record in phase "effect" with left > 0 (Sidestep, Battle Roar, Riposte, Taunt, Smoke — engine/abilities.js DURATION_ROUNDS), insertion order, right after the live item effects; fight-only (abilityEffectActive's own test)
 *   - braced {polarity:"good"} — Brace's C.braced, until the next landed blow consumes it; fight-only; after reveal
 *   - halfNext {polarity:"good"} — an armed Pendant of Fortitude (engine/items.js), halves the next landed blow; shows anywhere
 *   - nightVision {polarity:"good"} — a fight where inDark holds and Night Vision is the waiver (darkWaiver) holding the dark back; fight-only; ends the good block, before itemCooldown/staffCharges
 *   - fightDark {polarity:"bad"} — a fight on a dark square with toHit's dark cap live (darkLimited and no Sense Presence) and NO darkFor counter running (its `darkness` chip covers that case); fight-only
 *   - insulted {polarity:"bad"} — a failed parley's C.parleyInsulted grudge, the rest of the fight
 *   - selfDot {polarity:"bad", remaining:<rounds>, by:<"acid">, spell:<name>} — a fumbled Acid burning the reader (Ice is an area damage fumble since Phase 90 plan 05) (engine/scrollFumble.js C.selfDot), only while left > 0; ends the bad block
 * A party member's own chips come from the sibling memberConditionsOf, with
 * the same shape (one source; no second enumerator anywhere).
 *
 * Only currently-active conditions are included; a character with none set
 * yields an empty array. 260918-w4n: there is no more dedicated flight
 * block — a live `fly` record (Cloak of Flying or Bracelet of Flight) is
 * reported by the generic live-item-effect loop, and a cooling one by the
 * generic itemCooldown loop, exactly like every other item.
 */
export function conditionsOf(state) {
  const c = (state && state.c) || {};
  const out = [];

  // --- GOOD conditions (in a fixed order for deterministic rendering) -------

  // Phase 39 (GEAR-02): one chip per LIVE c.timers item effect (haste/invis/
  // acute/ether/might/power/giant/glow/unseen/tongue/brace/plate via the
  // timed activation model). 260918-w4n: a live `fly` effect (Cloak of
  // Flying OR Bracelet of Flight) is reported HERE too, as a `flight` chip —
  // there is no more dedicated flight block below; a flight item with NO
  // live record yields no flight chip at all (a ready-but-unused item is not
  // flying), and a COOLING flight item is reported by the generic
  // itemCooldown loop below like every other item.
  for (const chip of liveItemChips(c)) out.push(chip);

  // CMBUI-13 (Phase 77): one chip per LIVE duration ability on the hero
  // (Sidestep, Battle Roar, Riposte, Taunt, Smoke — engine/abilities.js's
  // DURATION_ROUNDS), in c.timers insertion order, only in a fight. The
  // same helper reads a party member's own sheet in memberConditionsOf.
  if (state && state.combat) for (const chip of liveAbilityChips(c.timers)) out.push(chip);

  if (c.might > 0) out.push({ key: "might", polarity: "good" });
  // Phase 31 (CMB-04): the Shield chip — c.ward is the same field the
  // engine's absorb/shatter code (engine/combat.js) already reads; this
  // surfaces it as data only (pool + rounds), never touching the lifecycle
  // events (wardRaised/wardAbsorbed/wardReflected/wardShattered/wardFaded
  // already narrate). Gated on a positive pool so a shattered (pool<=0,
  // about to be nulled) ward never flashes a zero-hp chip.
  //
  // RULES-14 (Phase 75): an ARMED mirror (c.ward.mirror) also fires this
  // gate even though its pool is 0 — the ward is very much "up," just
  // waiting for a blow instead of soaking one. It carries `mirror: true`
  // and NO `remaining` key (its `rounds` is `null`, not a count); a popped
  // pool (or Shield) keeps today's `{pool, remaining, name}` shape exactly.
  if (c.ward && (c.ward.pool > 0 || c.ward.mirror)) {
    out.push({
      key: "ward",
      polarity: "good",
      pool: c.ward.pool,
      name: c.ward.name,
      ...(typeof c.ward.rounds === "number" ? { remaining: c.ward.rounds } : {}),
      ...(c.ward.mirror ? { mirror: true } : {}),
    });
  }

  // Phase 40 (SPELL-02): the three utility spells with a real effect but no
  // prior chip (Mirror Self, Sense Presence, Regeneration), plus an ARMED
  // Sense Danger (foresight, waiting for the next fight) — copying the
  // might/ward precedent above exactly. Fixed order after ward, before
  // flight: mirror -> senses -> regen -> foresight. All four are pure reads
  // of fields the engine already writes (magic.js's senses/foresee/mirror/
  // regen branches; combat.js#foeTurn's per-round mirror countdown;
  // combat.js#endCombat's unconditional resets) — no rng, no mutation, no
  // new serialized field.
  if (c.mirror > 0) out.push({ key: "mirror", polarity: "good", remaining: c.mirror });
  if (c.senses) out.push({ key: "senses", polarity: "good" });
  if (c.regen) out.push({ key: "regen", polarity: "good" });
  if (c.foresight) out.push({ key: "foresight", polarity: "good" });

  // Phase 40 (SPELL-05, Plan 04): Map the Floor's reveal window — a squares-
  // cadence c.timers record read the same way the item-effect chips above
  // read theirs; ONLY while the window is open (phase "effect", left > 0).
  // No rng, no mutation, no new c.* field (the record already lives on
  // c.timers via engine/effects.js#startEffect). Plan 76-06 (user ruling
  // 2026-09-26): the window lasts until the hero's next step, so the chip
  // carries no countdown — the shell shows a fixed "until you move".
  const rev = c.timers && c.timers["spell:reveal"];
  if (rev && rev.phase === "effect" && rev.left > 0) {
    out.push({ key: "reveal", polarity: "good" });
  }

  // CMBUI-13 (Phase 77): the good effects that had no chip, appended in a
  // fixed order before the cooldown/charges chips. braced/
  // nightVision are fight-only (they live on state.combat, or only matter in
  // a fight); halfNext lives on `c` and shows anywhere.
  const inFight = !!(state && state.combat);
  if (inFight && state.combat.braced) out.push({ key: "braced", polarity: "good" });
  if (c.halfNext) out.push({ key: "halfNext", polarity: "good" });
  if (inFight && state.c && inDark(state) && darkWaiver(c) === "nightVision") out.push({ key: "nightVision", polarity: "good" });

  // Phase 39 (GEAR-02): one `itemCooldown` chip per duration+cooldown item
  // CURRENTLY cooling (an `item:<key>` record in `phase: "cooldown"`),
  // insertion order. 260918-w4n: the Cloak of Flying / Bracelet of Flight
  // exclusion is removed — a cooling flight item is reported here exactly
  // like every other cooling item (no more dedicated flight cooldown chip).
  for (const chip of itemCooldownChips(c)) out.push(chip);

  // Phase 39 (GEAR-02): one `staffCharges` chip per RECHARGING staff (a
  // `charges:<key>` record, always a cooldown), insertion order. `charges`
  // reads the staff's own current count off `c` (bag ∪ worn); `max` reads
  // the pool size from the activation declaration — both `undefined` (never
  // thrown) for a staff no longer carried when its record still exists.
  for (const id of Object.keys(c.timers || {})) {
    if (!id.startsWith("charges:")) continue;
    const rec = c.timers[id];
    if (!rec) continue;
    const key = id.slice("charges:".length);
    const act = ACTIVATION_OF[key];
    const it = carriedItems(c).find((x) => x && x.n === key);
    out.push({
      key: "staffCharges",
      polarity: "good",
      item: key,
      charges: it && Number.isInteger(it.charges) ? it.charges : 0,
      max: act ? act.charges : undefined,
      remaining: rec.left,
    });
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

  // fearArmed (Phase 41, TERR-05, user-ratified Key Decision 2026-09-18: "arm
  // Afraid for the next fight"): a terrain phobia trigger (engine/
  // phobias.js) has set `c.fearArmed` since the last fight — this is the
  // WAITING-to-consume state, distinct from `afraid` below (the CURRENT
  // fight's live penalty). Cleared the instant engine/combat.js#fight
  // consumes it (whether or not Hardiness then shrugs off the actual Afraid
  // effect). Pure read of an already-computed field; no rng, no mutation, no
  // new serialized field beyond what engine/phobias.js already writes.
  if (c.fearArmed && typeof c.fearArmed === "object" && typeof c.fearArmed.phobia === "string") {
    out.push({ key: "fearArmed", polarity: "bad", phobia: c.fearArmed.phobia, trigger: c.fearArmed.trigger });
  }

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

  // RULES-10 (Phase 75.1, hero-cannot-act / hero Blind / hero Shrink): a
  // fumbled Doze/Stun/Stupidity/Insane (or Noxious Vapor's sleep) sets
  // C.heroOut; a fumbled Blind/Shrink sets C.heroBlind/C.heroShrunk. All
  // three are combat-scoped — never survive a save (combat is always null on
  // load) — and clear at endCombat like every other combat-only condition
  // above. Pure reads, no rng, no mutation.
  if (state && state.combat && state.combat.heroOut) {
    out.push({ key: "heroOut", polarity: "bad", kind: state.combat.heroOut.kind, remaining: state.combat.heroOut.left });
  }
  if (state && state.combat && state.combat.heroBlind) out.push({ key: "heroBlind", polarity: "bad" });
  if (state && state.combat && state.combat.heroShrunk) out.push({ key: "heroShrunk", polarity: "bad" });

  // CMBUI-13 (Phase 77): the bad fight effects that had no chip. fightDark
  // is emitted only while the darkFor counter is NOT running (its own
  // `darkness` chip already covers the fight then — one cause, one chip) and
  // only while toHit's dark cap is live (darkLimited, and no Sense
  // Presence). All three are fight-only; pure reads.
  if (inFight) {
    const C = state.combat;
    if (!(c.darkFor > 0) && state.c && darkLimited(state) && !c.senses) out.push({ key: "fightDark", polarity: "bad" });
    if (C.parleyInsulted) out.push({ key: "insulted", polarity: "bad" });
    if (C.selfDot && typeof C.selfDot === "object" && C.selfDot.left > 0) {
      out.push({ key: "selfDot", polarity: "bad", remaining: C.selfDot.left, by: C.selfDot.by, spell: C.selfDot.spell });
    }
  }

  return out;
}

/**
 * liveItemChips(sheet) — Phase 89 (ITEM-07, plan 06): the one live-item-chip
 * builder conditionsOf and memberConditionsOf share (one source, no second
 * enumerator). One chip per LIVE `item:<key>` record on `sheet.timers`
 * (liveItemEffects), in insertion order: a `flight` chip for a fly-kind
 * record, otherwise `{ key: <kind>, polarity: "good", remaining, cadence,
 * source }` plus `might` (a might-kind record), `ticks` (a heal-over-time
 * record), and `step`, `size` (the wearer's own size name) and `dmgTotal` (a
 * size item). Moved out of conditionsOf unchanged, so the hero's chips are
 * byte-identical. Pure, no rng.
 */
function liveItemChips(sheet) {
  const out = [];
  for (const { key, act, rec } of liveItemEffects(sheet)) {
    if (act.kind === "fly") {
      out.push({ key: "flight", polarity: "good", flight: "charged", remaining: rec.left, cadence: rec.cadence, source: key });
      continue;
    }
    const chip = { key: act.kind, polarity: "good", remaining: rec.left, cadence: rec.cadence, source: key };
    if (act.kind === "might" && typeof act.might === "number") chip.might = act.might;
    // Phase 88 (ITEM-03): a heal-over-time item's chip carries the ticks it
    // still owes (3, 2, 1) — the Regenerating chip's detail.
    if (act.hot) chip.ticks = healTicksLeft(act, rec);
    // RULES-11 (Phase 75.2, Plan 02): a live size-stepping item (the
    // Gauntlet of the Giant, Enlarge, or any future size item) also
    // carries the item's own step and the hero's CURRENT size name —
    // never masked, read the same way applyActivation's started event is.
    if (act.eff && typeof act.eff.size === "number") {
      chip.step = act.eff.size;
      chip.size = heroSize(sheet).name;
      // Phase 89 (ITEM-05): the item's whole damage bonus, the size step's
      // plus its own `eff.dmg` bulk (Enlarge 11, the Gauntlet 2) — the same
      // formula applyActivation's started event uses.
      chip.dmgTotal = SIZE_DAMAGE_PER_STEP * act.eff.size + (typeof act.eff.dmg === "number" ? act.eff.dmg : 0);
    }
    out.push(chip);
  }
  return out;
}

/**
 * itemCooldownChips(sheet) — Phase 89 (ITEM-07, plan 06): one `itemCooldown`
 * chip per duration+cooldown item CURRENTLY cooling (an `item:<key>` record
 * in `phase: "cooldown"`) on `sheet.timers`, insertion order. Shared by
 * conditionsOf and memberConditionsOf, moved out of conditionsOf unchanged.
 * Pure, no rng.
 */
function itemCooldownChips(sheet) {
  const out = [];
  for (const id of Object.keys(sheet.timers || {})) {
    if (!id.startsWith("item:")) continue;
    const rec = sheet.timers[id];
    if (!rec || rec.phase !== "cooldown") continue;
    const key = id.slice("item:".length);
    out.push({ key: "itemCooldown", polarity: "good", item: key, remaining: rec.left });
  }
  return out;
}

/**
 * liveAbilityChips(timers) — CMBUI-13 (Phase 77): the one ability-chip
 * builder conditionsOf and memberConditionsOf share. One `{ key: "ability",
 * ability, polarity: "good", remaining, cadence: "rounds" }` per
 * `ability:<id>` record in phase "effect" with `left` above 0 (the SAME test
 * abilityEffectActive makes), in insertion order. An immediate ability's
 * plain cooldown, a duration ability's cooldown phase, and a spent record
 * give nothing. A missing or non-object map gives []. Pure.
 */
function liveAbilityChips(timers) {
  const out = [];
  if (!timers || typeof timers !== "object" || Array.isArray(timers)) return out;
  for (const id of Object.keys(timers)) {
    if (!id.startsWith("ability:")) continue;
    const rec = timers[id];
    if (!rec || typeof rec !== "object" || rec.phase !== "effect" || !(rec.left > 0)) continue;
    out.push({ key: "ability", ability: id.slice("ability:".length), polarity: "good", remaining: rec.left, cadence: "rounds" });
  }
  return out;
}

/**
 * memberConditionsOf(state, partyIdx) — CMBUI-13 (Phase 77): the party
 * member's sibling of conditionsOf, with the SAME descriptor shape (ONE
 * source, no parallel chip system: YOUR LOT's member chip row and the Company
 * panel read this and nothing else). Lists, in order:
 *   - the member's live ITEM effects, anywhere (Phase 89, ITEM-07, plan 06:
 *     the same liveItemChips conditionsOf uses — `{ key:<kind>, polarity:"good",
 *     remaining, cadence, source }` plus `might` / `ticks` / `step`, `size` and
 *     `dmgTotal` where the hero's carry them, a `flight` chip for a fly kind),
 *     in `state.party[partyIdx].timers` insertion order;
 *   - in a fight only: ability {polarity:"good", ability:<id>, remaining:<rounds>,
 *     cadence:"rounds"} — one per live duration ability on the same timers
 *     (engine/combat.js#startMemberAbilityTimer), insertion order;
 *   - in a fight only: braced {polarity:"good"} — the member's own Brace, the
 *     `state.combat.allies` entry with this partyIdx carrying `braced`
 *     (engine/combat.js#resolveMemberAbility; consumed by the next landed blow
 *     in foeTurn's member branch);
 *   - halfNext {polarity:"good"} — the member's own armed Pendant of Fortitude,
 *     anywhere;
 *   - itemCooldown {polarity:"good", item, remaining} — one per item of the
 *     member's CURRENTLY cooling, anywhere (itemCooldownChips).
 * Item chips show with or without a fight so the Company panel can read them
 * between fights; ability and Brace chips stay fight-only. A missing member, a
 * bad index, a sheet with no timers and a malformed state give [] and never
 * throw. Pure: no rng, no mutation, no new serialized field.
 */
export function memberConditionsOf(state, partyIdx) {
  try {
    if (!state || typeof state !== "object") return [];
    const party = state.party;
    if (!Array.isArray(party) || !Number.isInteger(partyIdx) || partyIdx < 0 || partyIdx >= party.length) return [];
    const m = party[partyIdx];
    if (!m || typeof m !== "object") return [];
    const out = liveItemChips(m);
    const C = state.combat;
    if (C && typeof C === "object") {
      for (const chip of liveAbilityChips(m.timers)) out.push(chip);
      const entry = Array.isArray(C.allies) ? C.allies.find((a) => a && typeof a === "object" && a.partyIdx === partyIdx) : null;
      if (entry && entry.braced) out.push({ key: "braced", polarity: "good" });
    }
    if (m.halfNext) out.push({ key: "halfNext", polarity: "good" });
    for (const chip of itemCooldownChips(m)) out.push(chip);
    return out;
  } catch {
    return [];
  }
}

/**
 * armorSoak(c) — DELIBERATE RULES CHANGE (04.2 Bugs B, 2026-09-09, E8): the
 * Cloak of Armor (content/treasure-tables.js, eff:{cloakArmor:1}, "a full suit
 * of plate that weighs nothing") was inert — `cloakArmor` was READ NOWHERE,
 * exactly like eff.fly before the A2 flight wiring. This is the single source
 * the combat soak block (engine/combat.js) consults for the player's EFFECTIVE
 * armour instead of reading c.ar/c.armorWP/c.armorMin/c.armorMax directly.
 *
 * While the Cloak of Armor's OWN record is live (`eff(c,"cloakArmor") > 0` —
 * 260918-w4n: worn AND used, not merely carried), effective armour operates
 * as PLATE (content/armors.js Plate ar:15/wp:45): take-the-better of the
 * cloak's plate and the worn armour for both the d20 soak rating (`ar`) and
 * the durability pool. Because the cloak's plate is weightless while its
 * record is live, it does not wear out — `magic:true` tells the soak site to
 * consume NO worn-armour durability (and never emit armorDestroyed) while
 * the record holds. Once the record fades this returns the worn armour
 * verbatim (`magic:false`), so behaviour is byte-identical for every
 * character not currently benefiting from the item.
 *
 * Pure read of `c` (uses only eff() + the static Plate constants); no rng, no
 * mutation of `c`, so determinism/parity are unaffected.
 */
export function armorSoak(c) {
  const worn = { ar: c.ar || 0, wp: c.armorWP, min: c.armorMin || 0, max: c.armorMax };
  // Phase 54 (BAND-02, USER RULING D): CLASS_MITIGATION.Fighter.armorMul
  // scales the soak-roll target number (`ar`) only — identity 1 is a
  // structural no-op for every non-Fighter (and every Fighter at identity).
  const mul = classArmorMulFor(c);
  const scaleAr = mul === 1 ? (ar) => ar : (ar) => Math.round(ar * mul);
  if (eff(c, "cloakArmor") <= 0) return { ...worn, ar: scaleAr(worn.ar), magic: false };
  const plate = ARMORS.find((a) => a.name === "Plate") || { ar: 15, wp: 45 };
  return {
    ar: scaleAr(Math.max(worn.ar, plate.ar)),
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
  // Phase 91.1 plan 03 (V15 B, user 2026-10-01): the Illusionist's d20 no longer cancels the Elf's smaller die:
  // a race with a strike step keeps its own die at levels 1 and 2 (an Elf Illusionist strikes a d12, then a
  // d10, like any Elf); every other Illusionist still strikes a d20 until level three.
  if (c.sub === "Illusionist" && c.level < 3 && !R.strikeStep) idx = 0; // d20 until level three
  // Phase 39 (GEAR-02): the retired c.acute counter — a live "acute" item
  // effect (Potion of Acuteness) reads through c.timers now.
  if (itemEffectActive(c, "acute")) idx = 4; // strike on a d6
  return STRIKE_DICE[idx];
}

/**
 * inDark(state) — is the player standing on an unlit square? Reads state.floor;
 * ports mazeworld.html inDark() (lines 1463-1466). This is PHYSICAL darkness
 * only: it says nothing about whether a light is holding the dark back.
 *
 * DELIBERATE RULES CHANGE (04.1-05, 2026-09-09, PHOBIA-01): extended to ALSO
 * return true while the persistent darkness counter (`state.c.darkFor`, set
 * by engine/encounters.js's fallDark and decremented per step by
 * engine/movement.js) is active, regardless of the current tile's own
 * `.dark` flag. Pure read of already-computed state; no rng.
 *
 * DARK-01 (Phase 76): every hero-side dark PENALTY now reads `darkLimited`
 * below (in the dark AND no light waiver) — revealRadius, mapViewRadius,
 * toHit's dark cap, combat.js's combatInDark / no-crit-in-the-dark / the
 * Darkness phobia's fight-join trigger, and phobias.js#regionActive's
 * Darkness arm. The remaining direct inDark readers are the physical-darkness
 * reads that are not penalties: items.js (a torch used while not dark is
 * refused) and darkLimited itself.
 */
export function inDark(state) {
  const f = state.floor;
  const tileDark = !!(f && f.g[f.py] && f.g[f.py][f.px] && f.g[f.py][f.px].dark);
  return tileDark || !!(state.c && state.c.darkFor > 0);
}

/**
 * inStone(state) — 260919-00d (Cloak of Ether wall-walking): is the party's
 * CURRENT cell solid rock (`g[py][px].wall === true`)? Mirrors `inDark`'s
 * own pure cell read exactly. The ONE "is the party inside rock" read every
 * consumer shares: `engine/movement.js#move`'s feature-dispatch gate and
 * `newDay`'s wandering-monster skip, `resolveEtherEnd` (this module's own
 * sibling in engine/movement.js), and the shell's chip-tone / hold-inspect
 * bridge (`window.__mzEther`). False for a missing `state.floor`/cell (never
 * throws on a tampered/incomplete state). Pure read, no rng, no mutation.
 */
export function inStone(state) {
  const f = state && state.floor;
  return !!(f && f.g[f.py] && f.g[f.py][f.px] && f.g[f.py][f.px].wall);
}

/**
 * DARK_WAIVERS — DARK-01 (Phase 76, user rulings 2026-09-22 and 2026-09-25):
 * the lights that hold the dark back, in the fixed precedence darkWaiver
 * reports them — most-durable-first (the Phase 57 chip-naming rationale):
 * Night Vision is innate and never runs out, the Amulet of Light is a worn
 * 50-square effect, and a lit torch is the shortest-lived. The keys are the
 * shell's own waiver labels (mazeworld.html#WAIVER_LABEL). Frozen.
 */
export const DARK_WAIVERS = Object.freeze(["nightVision", "amuletLight", "litTorch"]);

/**
 * darkWaiver(c) — DARK-01 (Phase 76): the ONE darkness-waiver predicate for
 * the map and the fight. Returns the first live waiver in DARK_WAIVERS order
 * — `"nightVision"` (`skill(c, "Night Vision")`), `"amuletLight"` (a live
 * Amulet of Light, `eff(c, "light") > 0`) or `"litTorch"` (a lit torch,
 * `itemEffectActive(c, "lit")`) — or null when none holds. A cooling torch or
 * Amulet record (cooldown phase, or `left: 0`) is no light. Sense Presence
 * (`c.senses`) is NOT a light: it stays a separate fight-only relief beside
 * this predicate (toHit's cap, combatInDark, the dark crit ban), so it never
 * widens the reveal while walking. A missing or non-object `c` returns null
 * (never throws — `skill` would). Pure, zero rng, mutates nothing.
 */
export function darkWaiver(c) {
  if (!c || typeof c !== "object") return null;
  if (skill(c, "Night Vision")) return "nightVision";
  if (eff(c, "light") > 0) return "amuletLight";
  if (itemEffectActive(c, "lit")) return "litTorch";
  return null;
}

/** darkWaived(c) — DARK-01: is any light holding the dark back? `darkWaiver(c) !== null`. */
export function darkWaived(c) {
  return darkWaiver(c) !== null;
}

/**
 * darkLimited(state) — DARK-01 (Phase 76): is the hero in the dark with no
 * light waiver? `inDark(state) && !darkWaived(state.c)`. Every hero-side dark
 * penalty reads this one rule, so a light means the same thing on the map
 * and in a fight: revealRadius, mapViewRadius (and so inViewWindow), toHit's
 * dark cap, engine/combat.js's combatInDark line, its no-crit-in-the-dark
 * rule and the Darkness phobia's fight-join trigger, and
 * engine/phobias.js#regionActive's Darkness arm. A declared canon divergence:
 * the 1994 reveal line and in-fight dark rules waived only on Night Vision;
 * a lit torch or a live Amulet now lights the way and the fight too. Pure,
 * zero rng, mutates nothing.
 */
export function darkLimited(state) {
  return inDark(state) && !darkWaived(state && state.c);
}

/**
 * revealRadius(state) — the fog-of-war reveal radius for the player's current
 * position: 1 while `darkLimited` (in the dark with no light), 2 otherwise,
 * plus any `sight` effect (e.g. the Amulet of Light, `eff: { sight: 1 }`),
 * which stays a separate additive. Reads state.floor and state.c; no RNG.
 *
 * DARK-01 (Phase 76, user rulings 2026-09-22 and 2026-09-25): a declared
 * canon divergence from mazeworld.html reveal()'s radius line (line 838,
 * `r = ((g[py][px].dark && !skill("Night Vision")) ? 1 : 2) + eff("sight")`),
 * which waived only on Night Vision. A lit torch now reveals 2 squares as you
 * walk and a live Amulet 3 — the SAME waiver mapViewRadius reads, so the two
 * radii can never disagree.
 */
export function revealRadius(state) {
  return (darkLimited(state) ? 1 : 2) + eff(state.c, "sight");
}

// Phase 41 (TERR-03) — DARK_VIEW_RADIUS: while the hero is `darkLimited` (in
// the dark with no light waiver), the map shows only the 3x3 window around
// the party (Chebyshev distance <= 1) — a pure RENDER filter, never a
// mutation of `cell.seen`/`cell.spellSeen`. DARK-01 (Phase 76): the waiver
// set is darkWaiver's (Night Vision, a live Amulet of Light, a lit torch),
// the same one revealRadius and the fight's dark penalties now read. Before
// Phase 76 revealRadius waived only on Night Vision, so a torch widened the
// render window but not the reveal (the 2026-09-21 device report).
export const DARK_VIEW_RADIUS = 1;

/**
 * mapViewRadius(state) — TERR-03: `Infinity` (show every already-`seen`
 * cell) unless the hero is `darkLimited` (in the dark with no light waiver —
 * DARK-01, Phase 76: the one predicate revealRadius shares), in which case
 * `DARK_VIEW_RADIUS` (1) — a 3x3 window. The shell (`draw()`) re-reads this fresh on EVERY paint — never a
 * stored flag (research Pitfall 4) — so leaving the dark square restores
 * the full explored view for free: nothing was ever taken away from
 * `seen`, only hidden at render time. Map the Floor's `spellSeen` window
 * is orthogonal to this filter — the filter only HIDES, and the reveal
 * window still ends on the hero's next step (Plan 76-06) whatever the
 * filter shows (CONTEXT routine decision). Pure, zero rng, mutates nothing.
 */
export function mapViewRadius(state) {
  return darkLimited(state) ? DARK_VIEW_RADIUS : Infinity;
}

/**
 * inViewWindow(state, x, y) — TERR-03: `true` for every cell when
 * `mapViewRadius(state)` is `Infinity`; when it is `DARK_VIEW_RADIUS` (1),
 * `true` only for the 3x3 cells around the party (Chebyshev distance <= 1
 * from `state.floor.px/py`), `false` for every other cell — including a
 * cell already `seen` (the window hides previously-explored cells too, it
 * does not merely gate NEW reveals). Pure, zero rng, mutates nothing.
 */
export function inViewWindow(state, x, y) {
  const r = mapViewRadius(state);
  if (!Number.isFinite(r)) return true;
  const f = state.floor;
  return Math.abs(x - f.px) <= r && Math.abs(y - f.py) <= r;
}

/**
 * HEARING_RANGE — HUD-07 (Phase 78, user ruling 2026-09-26, option A): how
 * far Acute Hearing reaches, as a Chebyshev distance from the party (the
 * same metric engine/maze.js#reveal and inViewWindow use). Walls are
 * ignored: it is hearing, so it works through them.
 */
export const HEARING_RANGE = 3;

/**
 * heardSquares(state) — HUD-07 (Phase 78), Acute Hearing's "hear the next
 * room" (Phase 72 finding F2's replacement, user 2026-09-24; RULED option A
 * by the user 2026-09-26, 78-CONTEXT "Rulings after planning"). Returns
 * `[{ x, y }]`, in row-major order (y, then x), for every cell within
 * HEARING_RANGE of the party (walls ignored) that holds an UNRESOLVED
 * encounter dot (`feat === "dot"`) and that the map is not currently showing
 * (not `seen`, or `seen` but outside the dark view window, inViewWindow).
 * The party's own square is never returned.
 *
 * Why only dots: a dot's contents are not decided until the party steps on
 * it (engine/encounters.js#encounterDot draws its table and row then), so
 * "something alive is there" cannot be known without peeking at the dice.
 * The ruling hears every unresolved dot and never says what it is. Traps,
 * chests, teleporters, climbs, gorges, one-way doors and the exit are
 * silent. The original CONTEXT wording (the four adjacent squares) was
 * unbuildable: those squares are always already revealed.
 *
 * Hero only: a party member's own Acute Hearing adds nothing. A hero without
 * the skill, a dead hero (`state.dead`, or wp at or below 0) or a missing
 * state/floor returns []. Pure: no rng, no mutation, safe on a frozen state.
 */
export function heardSquares(state) {
  const c = state && state.c;
  const f = state && state.floor;
  if (!c || !f || !Array.isArray(f.g)) return [];
  if (state.dead === true || (typeof c.wp === "number" && c.wp <= 0)) return [];
  if (!skill(c, "Acute Hearing")) return [];
  const out = [];
  for (let y = f.py - HEARING_RANGE; y <= f.py + HEARING_RANGE; y++) {
    const row = f.g[y];
    if (!row) continue;
    for (let x = f.px - HEARING_RANGE; x <= f.px + HEARING_RANGE; x++) {
      const cell = row[x];
      if (!cell || cell.feat !== "dot") continue;
      if (x === f.px && y === f.py) continue;
      if (cell.seen && inViewWindow(state, x, y)) continue;
      out.push({ x, y });
    }
  }
  return out;
}

/**
 * classNeed(c) — the class/race/sub part of the player's to-hit need (a
 * count of winning faces on the strike die — Phase 73, ROLL-05, the engine
 * reads the check roll-high via `atLeastFor(need, dieN)`), with NO weapon,
 * combat, or darkness term. Byte-identical arithmetic to toHit(state)'s
 * former first four lines (mazeworld.html toHit(), lines 1452-1462): Fighter
 * 5 / Thief 4 / Magic User 3 base, Elves floor at 5 whatever their class,
 * Acrobat strikes as a fighter with the dagger (5), Cleric floors at 4.
 * Factored out (Phase 39, GEAR-01) so expectedStrike below can compute a
 * weapon's need WITHOUT a live `state` (a fresh character sheet, not yet
 * wielding anything, is enough). Pure, no rng.
 */
export function classNeed(c) {
  const R = RACES[c.race];
  let h = CLASSES[c.cls].toHit;
  if (R.toHit) h = Math.max(h, R.toHit); // Elves strike at 5 whatever their class
  if (c.sub === "Acrobat") h = 5; // strikes as a fighter with the dagger
  if (c.sub === "Cleric") h = Math.max(h, 4); // Clerics roll 4, not 3
  return h;
}

/**
 * weaponNeedMod(x) — Phase 39 (GEAR-01): a weapon's to-hit NEED modifier —
 * `x` is either a weapon base name (string) or a character object (reads
 * `x.weapon`). Returns `WEAPONS[base].need` (an integer in {-2,-1,0,1}), or 0
 * for "Fists"/an unrecognized base — `need` is a count of winning faces on
 * the strike die (Phase 73, ROLL-05: the engine reads the check roll-high,
 * `atLeastFor(need, dieN)` widens or narrows the winning range from the top),
 * so this modifier is added directly to the need: a light weapon's
 * `need: +1` adds a winning face (easier to hit), a heavy weapon's
 * `need: -1`/`-2` removes winning faces (harder to hit) — the SAME
 * direction the Phase 31 `afraidNeed` penalty already shrinks the need in.
 * Pure, no rng.
 */
export function weaponNeedMod(x) {
  const base = typeof x === "string" ? x : x && x.weapon;
  const w = weaponRow(base);
  return w ? w.need || 0 : 0;
}

/**
 * weaponCrit(c) — Phase 39 (GEAR-01): the die-roll range (1 or 2) that
 * doubles the character's own weapon damage — `WEAPONS[c.weapon].crit`, or 1
 * for an unrecognized/missing weapon (never throws on a tampered save's
 * `c.weapon` name). Pure, no rng.
 */
export function weaponCrit(c) {
  const w = c && weaponRow(c.weapon);
  return w ? w.crit || 1 : 1;
}

/**
 * armorBulk(c) — Phase 39 (GEAR-01): the character's currently-worn armor's
 * `bulk` axis (0, 1, or 2) — resolved by `c.armor`'s display NAME against
 * ARMORS, so "Nothing" and a Warded piece (which sets `c.armor` to the base
 * armor's own name via takeItem) both resolve correctly. 0 for an
 * unrecognized/missing armor name (never throws on a tampered save). Added
 * to the climb/leap roll comparison (engine/movement.js), subtracted from
 * the flee roll and gating the Thief Stealth/backstab "heavy armor" checks
 * at `>= 2` (engine/combat.js). Pure, no rng.
 */
export function armorBulk(c) {
  const a = ARMORS.find((x) => x.name === (c && c.armor));
  return a ? a.bulk : 0;
}

/**
 * NEVER_FLEES — Phase 91 plan 05 (IDENT-16): the sub-classes that never leave
 * a live fight by any route. The Samurai ("A Samurai will never run from a
 * combat", rulebook p.14) and the Master of Arms (user ruling 2026-09-30:
 * "never leaves a fight ... fights every battle to the end"; replaces the
 * round-1 withdrawal denial, which cost it nothing).
 */
export const NEVER_FLEES = Object.freeze(["Samurai", "Master of Arms"]);

/**
 * neverFlees(c) — Phase 91 plan 05 (IDENT-16): THE one predicate for "this hero
 * can never leave a fight". `engine/combat.js#fleeRefusal` (which `flee` and
 * the Door Illusion cast read), the combat menu's FLEE row and the tuning bot
 * all read it, so the rule is edited in one place. Pure, zero rng.
 */
export function neverFlees(c) {
  return !!c && NEVER_FLEES.includes(c.sub);
}

/**
 * fleeBreakdown(c) — Phase 42 (FLEE-01/FLEE-02): the ONE flee-need rule,
 * mirroring foeToHitBreakdown's `{ name, delta }` shape so every surface
 * (the fight log, the rail, the combat submenu) narrates the SAME
 * modifier list without re-deriving the formula. Flee was ALREADY read
 * roll-high before Phase 73 (`d20 + bonus >= need`) — the mirror leaves this
 * function untouched; its caller folds `bonus` into the threshold the same
 * way every other modifier does. Builds `mods` in this fixed order, pushing
 * an entry ONLY when it is non-zero: Thief (+3 since quick 260928-nrf,
 * canon +5; "the whole trade") -> class
 * (content/flee.js#FLEE_CLASS_MOD) -> race (content/flee.js#FLEE_RACE_MOD)
 * -> armor (-armorBulk(c), only when bulk > 0). A race/class missing from
 * its table (a tampered save) contributes 0, never throws. `bonus` is the
 * sum of every mods[].delta; `need` is the fixed content/flee.js#FLEE_NEED
 * (the lowest winning roll, already read high). Pure, no rng.
 */
export function fleeBreakdown(c) {
  const mods = [];
  if (c && c.cls === "Thief") mods.push({ name: "Thief", delta: FLEE_THIEF_BONUS });
  const classMod = (c && FLEE_CLASS_MOD[c.cls]) || 0;
  if (classMod) mods.push({ name: c.cls, delta: classMod });
  const raceMod = (c && FLEE_RACE_MOD[c.race]) || 0;
  if (raceMod) mods.push({ name: c.race, delta: raceMod });
  const bulk = armorBulk(c);
  if (bulk > 0) mods.push({ name: c.armor, delta: -bulk });
  const bonus = mods.reduce((sum, m) => sum + m.delta, 0);
  // Phase 54 (BAND-02, USER RULING D): FLEE_NEED_MOD, added to the fixed
  // need itself (never a `mods` entry — this is a difficulty dial, not a
  // character modifier). Identity 0 is a structural no-op.
  const mod = fleeNeedModFor();
  return { need: mod === 0 ? FLEE_NEED : FLEE_NEED + mod, mods, bonus };
}

/**
 * weaponDiceMean(w) — Phase 39 (GEAR-01), module-private: the exact expected
 * value of a weapon's dice notation, halve-aware. For a non-halved weapon
 * this is the closed form `n * (sides + 1) / 2 + bonus` (the standard dN
 * mean). For a halved weapon (Dagger/Whip today — always a single d6 in this
 * content) the halving (`Math.ceil((sum of dice + bonus) / 2)`, exactly what
 * weaponDamage/rollDice apply at roll time) is non-linear, so this
 * enumerates every face combination of the `n` dice and averages the ceiled
 * result — exact, not an approximation (cheap: `sides^n` combinations, and
 * every halve weapon in this content has `n === 1`). Pure, no rng.
 */
function weaponDiceMean(w) {
  if (!w) return 0;
  const { n, sides, bonus = 0 } = w.dice;
  if (!w.halve) return (n * (sides + 1)) / 2 + bonus;
  let total = 0;
  let count = 0;
  const walk = (i, sum) => {
    if (i === n) {
      total += Math.ceil((sum + bonus) / 2);
      count++;
      return;
    }
    for (let f = 1; f <= sides; f++) walk(i + 1, sum + f);
  };
  walk(0, 0);
  return total / count;
}

/**
 * expectedStrike(c, base, bonus, prof) — Phase 39 (GEAR-01): the ONE
 * "how good is this weapon for this character, right now" number — expected
 * damage PER SWING, folding together the chance to hit, the chance to crit,
 * and the average damage roll. This is the shared arithmetic
 * engine/items.js#weaponUpgradeDelta (and, through it, takeItem and
 * src/browser/viewModels.js#lootCompare) reads instead of comparing raw max
 * damage — a heavy weapon's lower hit chance and a light weapon's higher
 * crit chance both show up in this ONE number.
 *
 * `base` is a WEAPONS key (not necessarily `c.weapon` — a candidate item's
 * base name); `bonus`/`prof` are the enchantment/proficiency terms that live
 * on the ITEM/character being evaluated (weaponDamage's `c.magicWpn`/
 * `c.prof`), passed explicitly so this can evaluate a candidate item OR the
 * currently-wielded weapon with the same call shape.
 *
 * need = classNeed(c) + weaponNeedMod(base), floored at 1 (never negative —
 * an already-impossible need cannot go lower). hitP = need/dieN, capped at 1.
 * critP = 0 for a noCrit character (Guard/Soldier, noCritFor), else
 * min(hitP, weaponCrit/dieN) — a crit is never MORE likely than a hit.
 * `flat` mirrors weaponDamage's additive terms EXCEPT the weapon's own dice
 * (folded in separately as `avg`, via weaponDiceMean) and EXCEPT `c.prof`/
 * `c.magicWpn`/`c.might` (those are either passed explicitly as `prof`/
 * `bonus`, or — for might — deliberately omitted, since a temporary Potion
 * of Strength should not make every OTHER weapon look permanently better).
 * Pure, no rng.
 */
/**
 * noCritFor(c) — Phase 61 (STORE-03): the ONE "can this character ever
 * crit" rule expectedStrike already applied inline — extracted verbatim
 * (byte-identical arithmetic, same three clauses) so gearCompareParts below
 * can read the SAME rule expectedStrike uses instead of restating it.
 * `true` for a Guard/Soldier sub; `false` otherwise. Does NOT read
 * state.floor's in-fight darkness rule — that is engine/combat.js's own
 * separate in-combat noCrit, untouched by this extraction. Quick 260928-cos
 * (2026-09-28): the third clause, a live `eff(c, "noCrit")`, is gone — its
 * only source was the Cloak of Strength, whose payload protects the wearer
 * from foe crits (critWardOf) and never banned the wearer's own. Pure, no rng.
 */
export function noCritFor(c) {
  return c.sub === "Guard" || c.sub === "Soldier";
}

export function expectedStrike(c, base, bonus = 0, prof = 0) {
  const w = weaponRow(base);
  if (!w) return 0;
  const R = RACES[c.race];
  const need = Math.max(1, classNeed(c) + weaponNeedMod(base));
  const dieN = strikeDie(c);
  const hitP = Math.min(1, need / dieN);
  const noCrit = noCritFor(c);
  const critP = noCrit ? 0 : Math.min(hitP, w.crit / dieN);
  const avg = weaponDiceMean(w);
  let flat = c.level * c.level;
  if (R.dmg) flat += R.dmg;
  if (R.wpnBonus) flat += R.wpnBonus;
  if (skill(c, "Heft")) flat += 2;
  if (c.sub === "Master of Arms") flat += 2;
  flat += eff(c, "dmg");
  // RULES-11 (Phase 75.2, "Hero Size Matters", user ruling 2026-09-25): the
  // same size term weaponDamage applies (see its own comment below) — the
  // race base's damage axis unless the race's signature masks it, plus any
  // live item step, in full.
  flat += sizeDamage(c);
  if (c.sub === "Guard" && c.level < 4) flat -= 4 - c.level;
  return (hitP + critP) * Math.max(1, flat + avg + bonus + prof);
}

/**
 * gearCompareParts(c, it) — Phase 61 (STORE-03): plain-data PARTS for the
 * "why is this an upgrade / not an upgrade" explanation, read from the SAME
 * derived helpers weaponUpgradeDelta/armorUpgradeDelta (engine/items.js) use
 * to compute the ONE verdict — this function never restates that
 * arithmetic, it only exposes the terms that went into it so
 * src/browser/upgradeWhy.js can format them. Pure, draws no rng, JSON-safe,
 * never mutates `c`/`it`.
 *
 * Weapon (`it.kind === "weapon"` with a recognized `it.base`):
 *   { kind: "weapon", got: {lab, need, crit, strike}, have: {lab, need, crit, strike}, lostProf }
 *   - `got` is the candidate item at bonus 0/prof 0 (a store/loot item is
 *     never pre-enchanted by a proficiency it hasn't earned).
 *   - `have` is the currently-wielded weapon at c.magicWpn/c.prof — UNLESS
 *     c.weapon is bare-handed (no WEAPONS entry, e.g. "Fists"), in which
 *     case `have.lab`/`have.crit` are null (the formatter reads that as
 *     "bare hands" and skips the crit term) while `have.strike` still comes
 *     from the real expectedStrike call (0 for an unrecognized base).
 *   - `lostProf` is c.prof when positive (a weapon switch always resets it
 *     to 0 — engine/items.js#equipItem/takeItem), 0 otherwise.
 *   - The two `strike` calls use exactly weaponUpgradeDelta's own argument
 *     shapes: `expectedStrike(c, it.base, it.bonus || 0, 0)` for got,
 *     `expectedStrike(c, c.weapon, c.magicWpn || 0, c.prof || 0)` for have.
 *
 * Armor (`it.kind === "armor"`): { kind: "armor", got: {ar: it.ar}, have: {ar: c.ar} }.
 *
 * Anything else — including an unrecognized weapon base — returns `null`.
 */
export function gearCompareParts(c, it) {
  if (!it || typeof it !== "object") return null;
  if (it.kind === "weapon") {
    if (!WEAPONS[it.base]) return null;
    const gotW = WEAPONS[it.base];
    const noCrit = noCritFor(c);
    const got = {
      lab: gotW.lab + (it.bonus ? " +" + it.bonus : ""),
      need: weaponNeedMod(it.base),
      crit: noCrit ? 0 : gotW.crit || 1,
      strike: expectedStrike(c, it.base, it.bonus || 0, 0),
    };
    const haveW = weaponRow(c.weapon);
    const have = haveW
      ? {
          lab: haveW.lab + (c.magicWpn ? " +" + c.magicWpn : ""),
          need: weaponNeedMod(c.weapon),
          crit: noCrit ? 0 : weaponCrit(c),
          strike: expectedStrike(c, c.weapon, c.magicWpn || 0, c.prof || 0),
        }
      : { lab: null, need: 0, crit: null, strike: expectedStrike(c, c.weapon, c.magicWpn || 0, c.prof || 0) };
    const lostProf = c.prof > 0 ? c.prof : 0;
    return { kind: "weapon", got, have, lostProf };
  }
  if (it.kind === "armor") {
    return { kind: "armor", got: { ar: it.ar }, have: { ar: c.ar } };
  }
  return null;
}

/**
 * toHit(state) — the player's to-hit NEED: a count of winning faces on the
 * strike die (Phase 73, ROLL-05: the engine reads the check roll-high via
 * `rollCheck(rng, dieN, atLeastFor(need, dieN))` — a bigger need is more
 * winning faces, always better for the roller). Reads state.c, state.combat
 * and state.floor (darkness); ports mazeworld.html toHit() (lines
 * 1452-1462).
 *
 * Phase 39 (GEAR-01): the class/race/sub term is now classNeed(c) (factored
 * out, byte-identical arithmetic); a weapon's own to-hit modifier
 * (weaponNeedMod) is added right after the gear `eff("toHit")` term, then the
 * whole running need is floored at 1 — BEFORE the dazed/dark clamps below,
 * which are kept in their exact original relative order.
 */
export function toHit(state) {
  const c = state.c;
  let h = classNeed(c);
  h += eff(c, "toHit");
  h += weaponNeedMod(c);
  h = Math.max(1, h);
  // Phase 19 D-10: dazed — you need 2 lower to hit, never below 1; the
  // weakened kind is applied at playerStrike's damage line in combat.js, not here.
  if (c.foeEffect && c.foeEffect.kind === "dazed" && c.foeEffect.rounds > 0) h = Math.max(1, h - DAZED_TO_HIT_PENALTY);
  // DARK-01 (Phase 76, user ruling 2026-09-25 "combat too"): the dark cap
  // reads the one darkness waiver (darkLimited: Night Vision, a live Amulet,
  // a lit torch); Sense Presence stays a fight-only relief beside it.
  if (darkLimited(state) && !c.senses) h = Math.min(h, 2);
  // RULES-10 (Phase 75.1, hero Blind): a fumbled Blind on the READER —
  // mirrors a blind FOE's own override (foeSwingVsHero/foeTurn set that
  // foe's swing to exactly 1 winning face) applied to the hero's own weapon
  // to-hit instead. LAST term, so it wins over every other modifier above;
  // heroStrikeFacesVs/rollOdds.heroHitOdds read it here too, so the hero
  // sheet and the combat menu never disagree with what playerStrike rolls
  // against. Thrown spells (castSpell's own to-hit, when any exists), party
  // members and flee are unaffected — none of them call toHit(state).
  if (state.combat && state.combat.heroBlind) h = 1;
  return h;
}

/**
 * toHitBreakdown(state) — CMBUI-13 (Phase 77, plan 77-07, "Dazed honesty",
 * user 2026-09-25: "i was dazed in combat, but it seems like it doesn't do
 * anything"): a narration-only breakdown of toHit's own arithmetic, the
 * foeToHitBreakdown precedent applied to the hero's strike. It reproduces
 * every toHit step in the SAME order and records a `{ name, delta }` entry
 * for each live CONDITION step that actually changed the running value
 * (delta = after − before, so an override records its real change):
 *   - "dazed"    (−DAZED_TO_HIT_PENALTY, floor 1),
 *   - "dark"     (the dark cap: darkLimited and no Sense Presence),
 *   - "blind"    (RULES-10 hero Blind: exactly one face).
 * The sheet terms (class/race/sub, gear, weapon, the floor) are not
 * conditions and are never listed. Each term is itemised as applied, even
 * when a later term overrides it (hero Blind after a daze lists both).
 *
 * Returns `{ need, mods }`; `need` MUST always equal `toHit(state)`
 * (test/unit/condition-roll-mods.test.js proves it by matrix). toHit's own
 * body stays the source of truth and never delegates here. Pure: no rng, no
 * mutation. engine/combat.js#playerStrike prepends `mods` to its strike
 * event's modifier list (payload only; no roll, face or draw changes).
 */
export function toHitBreakdown(state) {
  const c = state.c;
  const mods = [];
  const step = (name, before, after) => {
    if (after !== before) mods.push({ name, delta: after - before });
    return after;
  };
  let h = classNeed(c);
  h += eff(c, "toHit");
  h += weaponNeedMod(c);
  h = Math.max(1, h);
  if (c.foeEffect && c.foeEffect.kind === "dazed" && c.foeEffect.rounds > 0) h = step("dazed", h, Math.max(1, h - DAZED_TO_HIT_PENALTY));
  if (darkLimited(state) && !c.senses) h = step("dark", h, Math.min(h, 2));
  if (state.combat && state.combat.heroBlind) h = step("blind", h, 1);
  return { need: h, mods };
}

/**
 * afraidNeed(state, need) — Phase 31 (user ruling 2026-09-16): the Afraid
 * to-hit penalty, applied as the LAST modifier after every other need rule
 * (frenzy/asleep/hard-to-hit/fast/magicOnly/darkness). `need` is a count of
 * winning faces on the strike die (Phase 73, ROLL-05: the engine reads the
 * check roll-high, `atLeastFor(need, dieN)`), so the penalty SHRINKS the
 * winning range from the top — THE PENALTY IS SUBTRACTED FROM THE FACE
 * COUNT, never added to the die roll. Floor 1; an untouchable foe (need 0,
 * e.g. magicOnly without a magic weapon) is never made hittable by fear (the
 * `need > 0` guard). Pure, zero rng.
 */
export function afraidNeed(state, need) {
  if (!(state.combat && state.combat.afraid > 0 && need > 0)) return need;
  return Math.max(1, need - AFRAID_TO_HIT_PENALTY);
}

/**
 * spellLevelSq(caster) — DELIBERATE RULES CHANGE (quick 260928-sq2, user
 * ruling 2026-09-28: "square spell damage just like we do with weapons
 * damage"). An offensive spell's damage is its dice (plus any flat bonus in
 * its `dmg`) + the CASTER's level squared — the same `levelSq` term
 * weaponDamageTerms gives a strike — in place of canon p.26's
 * max(1, caster level − spell level) multiplier, which now scales only what
 * is not damage (Stun's reach). The caster is the hero, a Joiner's member
 * view (its own level) or a scroll's reader. An area spell adds it to each
 * foe it damages, once per cast; a damage-over-time spell adds it to its
 * first tick. Heals, the Earthquake backlash, an Apprentice's backfire and a
 * fumbled scroll's hurt never add it. Pure, zero rng.
 */
export function spellLevelSq(caster) {
  const level = caster && Number.isFinite(caster.level) ? caster.level : 1;
  return level * level;
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
 * (a count of winning faces on the strike die — Phase 73, ROLL-05, read
 * roll-high via `atLeastFor(need, dieN)`) for a PARTY MEMBER sheet (`m`), not
 * the hero. Deliberately omits every hero-only term toHit(state) reads
 * (eff(c,"toHit"), the dazed/darkness overrides) — a member
 * fights on its own sheet's class/race/sub alone. `?? 5` keeps the pre-25.1
 * "hit on 5" fallback for a sheet with no recognized class (mirrors
 * alliesTurn's legacy path). Pure read, no rng.
 */
export function memberToHit(m) {
  let h = CLASSES[m.cls]?.toHit ?? 5;
  const R = RACES[m.race];
  if (R && R.toHit) h = Math.max(h, R.toHit);
  if (m.sub === "Acrobat") h = 5;
  if (m.sub === "Cleric") h = Math.max(h, 4);
  return h;
}

/**
 * foeDie(c, foe) — the die a creature of the foe's level strikes on against
 * this character; never lower than a d8 (p.24). Ports mazeworld.html foeDie()
 * (lines 1469-1472).
 *
 * Phase 79 (quick fix 79-02b, user ruling 2026-09-27, "Joiners use only
 * their own defences"): `c` is the body being swung at — the hero's sheet
 * on the hero branch, the Joiner's OWN sheet on engine/combat.js#foeTurn's
 * member branch (a Dwarven Joiner draws its own better foe die; a Dwarven
 * hero's die never reaches a Human Joiner). A missing sheet (a Joiner
 * whose sheet is gone from state.party) reads as step 0; a present sheet
 * reads its own race row exactly as before — a race-less sheet still
 * throws, which src/browser/foeDetails.js's safe(…) relies on to drop the
 * odds line for a minimal state. A data read of `foeStrikeStep`, never a
 * race-name check. Pure, zero draws.
 */
export function foeDie(c, f) {
  const step = c ? RACES[c.race].foeStrikeStep || 0 : 0;
  return Math.max(8, STRIKE_DICE[clamp(f.lvl - 1 + step, 0, 4)]);
}

/**
 * PARTY_WIDE_ITEM_EFFECTS — Phase 79 (quick fix 79-02b, user ruling
 * 2026-09-27): the item effects whose content text makes them explicitly
 * party-wide, keyed by their `content/activations.js#ACTIVATION_OF` key
 * (the `item:<key>` timer id). A live one on the HERO's sheet also covers
 * every Joiner; every other hero item effect is the hero's own body only.
 * Today one row: the Crystal Staff (content/treasure-tables.js STAVES,
 * "party invisible d10+5 squares: foes hit only on their die's top
 * face"). The Cloak of
 * Invisibility and the Invisible potion say "you", so they stay personal.
 * test/unit/joiner-defences.test.js pins each key to a real activation
 * whose own text names the party.
 */
export const PARTY_WIDE_ITEM_EFFECTS = Object.freeze(["Crystal Staff"]);

/**
 * partyItemEffectActive(state, kind) — true when the HERO carries a live
 * item effect of activation `kind` from a PARTY_WIDE_ITEM_EFFECTS row (the
 * Crystal Staff's party invisibility). Read only on the member side of
 * foeToHitVs/foeToHitBreakdown — the hero's own reads already see it
 * through itemEffectActive(c, kind). Pure, no rng.
 */
function partyItemEffectActive(state, kind) {
  return liveItemEffects(state && state.c).some((e) => e.act.kind === kind && PARTY_WIDE_ITEM_EFFECTS.includes(e.key));
}

/**
 * defenceBody(state, vs, sheet) — Phase 79 (quick fix 79-02b): the body a
 * foe's swing lands on, whose OWN race, size, class/sub-class, gear and
 * self effects set its to-be-hit terms: the hero's sheet for `vs === "hero"`,
 * else the Joiner's own `sheet` (a missing sheet reads as a blank body — no
 * trait of anyone's, never the hero's). Pure.
 */
function defenceBody(state, vs, sheet) {
  return vs === "hero" ? state.c : sheet || {};
}

/**
 * raceFoeToHit(sheet) — the race's own to-be-hit trait for ANY body the
 * foe swings at: content/races.js's `foeToHit` (the Elven thin-boned +1),
 * 0 for every other race and for a missing sheet/race row. Phase 79 (plan
 * 79-02, todo 2026-09-25 "An Elven Joiner never gets its own thin-boned
 * to-be-hit trait"): the ONE seam for this trait — foeToHitVs/
 * foeToHitBreakdown read it from the body being swung at: the hero's sheet
 * (vs "hero") or, since quick fix 79-02b, the Joiner's OWN sheet (vs
 * "member", passed by engine/combat.js#foeTurn's member branch through
 * foeSwingVsMember), beside that body's own size term (Phase 75.2: "race
 * signatures survive size", "Joiners get size"). Before 79-02, the member branch
 * inherited the HERO's race row, so an Elven Joiner was neutral and a
 * Human Joiner beside an Elven hero was thin-boned. A data read, never a
 * race-name check. Pure, zero draws.
 */
export function raceFoeToHit(sheet) {
  const R = sheet && RACES[sheet.race];
  return (R && R.foeToHit) || 0;
}

/**
 * ACROBAT_FOE_FACES — quick 260928-nrf (user ruling 2026-09-28, "Acrobat:
 * foes hit on top 4"): the winning faces a foe's swing has against an
 * Acrobat, an override like canon's (canon: 3). The 260928-abl audit found
 * the old 3 worth about a floor of mean depth to its owners.
 */
export const ACROBAT_FOE_FACES = 4;

/**
 * foeToHitVs(state, vs, sheet) — the foe's to-hit need against this character: a
 * count of winning faces on the foe's strike die (Phase 73, ROLL-05, read
 * roll-high via `atLeastFor(need, dieN)` — a bigger need is more winning
 * faces, always better for the foe). Reads state.c and state.floor; ports
 * mazeworld.html foeToHitVs() (lines 1473-1483).
 *
 * DELIBERATE RULES CHANGE (Phase 24, 2026-09-14, IDENT-06): "the profession
 * is standing there" made real — a Guard is flat-out harder to land a blow
 * on. Still floors at 1 via the Math.max below, and still loses to the
 * mirror/invis overrides (those assign h=1 directly, after this line). Zero
 * draws — pure arithmetic.
 *
 * Phase 38 (ABIL-02, need-shift spec): the retired Agility passive and the
 * retired Silence-in-the-dark clause are replaced by three timers-driven
 * active terms, read via `abilityEffectActive` — Battle Roar (-2, applies to
 * ANY `vs`, since it covers the whole side), Sidestep (-2, the body's own)
 * and Smoke (an override to `h = 1`, the body's own). Battle Roar's -2
 * stacks with the Guard -1 exactly the way Agility used to. `vs` is `"hero"`
 * (default — every pre-Phase-38 caller) or `"member"` (foeTurn's
 * party-member branch, with the Joiner's own `sheet` — Phase 79, 79-02b).
 *
 * Phase 38 (ABIL-05): Battle Roar's term also honours ANY live party
 * member's own Battle Roar (`partyEffectActive`) — a Joiner's Battle Roar
 * covers the whole side exactly like the hero's. False on every fixture (no
 * fixture carries a party).
 *
 * Phase 75.2 (RULES-11, "Hero Size Matters", user ruling 2026-09-25): size
 * is now a real stat — `vs === "hero"` adds SIZE_FACES_PER_STEP times the
 * FACE axis's own resolved step (sizeAxisStep(c, "face")): the race's own
 * base step (content/races.js's `size`) unless the race's signature masks
 * it (content/races.js's `sizeAxes` — the Elven thin-boned trait survives
 * Small being harder to hit; the Dwarven Small face axis still applies),
 * plus any live item step (the Gauntlet of the Giant, Enlarge), in full.
 * Placed right after Guard, before gear — see foeToHitBreakdown's matching
 * term for the exact ordering this function mirrors silently.
 *
 * Phase 79 (quick fix 79-02b, user ruling 2026-09-27, "Joiners use only
 * their own defences against foe swings"): every personal term reads the
 * BODY being swung at (defenceBody) — the hero's sheet for `vs === "hero"`,
 * the Joiner's own `sheet` for `vs === "member"`: its race trait
 * (raceFoeToHit), its sub-class (the Acrobat override, the Guard −1), its
 * size (sizeAxisStep), its gear (`eff(body, "foeToHit")`), its class
 * evasion (classEvasionFor), its own Sidestep/Smoke, its own Mirror Self and
 * its own invisibility. None of the hero's personal defences reach a Joiner
 * any more (before this, the hero's Acrobat, Guard, gear, Mirror Self and
 * invisibility did). The party-wide terms read the whole side: Battle Roar
 * (the hero's or any live member's, "every foe has two fewer faces that
 * hit anyone on your side") and a PARTY_WIDE_ITEM_EFFECTS invisibility on the
 * hero (the Crystal Staff, "party invisible"). FOE_ACCURACY is the foe's own
 * dial and applies to every target. engine/combat.js#foeTurn's member
 * branch reads a Joiner's odds ONLY through this function (via
 * foeSwingVsMember), so one rule builds both bodies' odds. Data reads (the
 * sub-class checks are the same two the hero always had), zero draws.
 */
export function foeToHitVs(state, vs = "hero", sheet) {
  const c = state.c;
  const body = defenceBody(state, vs, sheet);
  let h = 5;
  // Phase 79 (plan 79-02): the race's to-be-hit trait belongs to the body
  // being swung at (raceFoeToHit, one seam).
  h += raceFoeToHit(body);
  // Quick 260928-nrf (user ruling 2026-09-28, "Acrobat: foes hit on top
  // 4"): ACROBAT_FOE_FACES (was 3). The Acrobat's own strike need (5, "as a
  // fighter with the dagger") is a different rule and is untouched.
  if (body.sub === "Acrobat") h = ACROBAT_FOE_FACES;
  if (body.sub === "Guard") h -= 1;
  // RULES-11 (Phase 75.2, "Hero Size Matters", user ruling 2026-09-25): each
  // applied size step moves a foe's winning faces against the body's OWN
  // size by SIZE_FACES_PER_STEP — the race's own face axis (signature mask
  // applied, sizeAxisStep) plus any live item step, in full. A Joiner's own
  // size never reaches the hero's odds, nor the hero's a Joiner's ("Joiners
  // get size", by the same rule). Zero draws — pure arithmetic.
  h += SIZE_FACES_PER_STEP * sizeAxisStep(body, "face");
  h += eff(body, "foeToHit");
  // Phase 54 (BAND-02, USER RULING D): FOE_ACCURACY is the foe's own dial
  // (every target). Identity 0 is a structural no-op.
  h += foeAccuracyFor();
  // CLASS_MITIGATION.Thief.evasion (the body's own class) is SUBTRACTED from
  // the foe's need: a positive evasion makes a Thief harder to hit. Phase
  // 72, ROLL-01 (d), user ruling 2026-09-24; identity 0 is a structural
  // no-op. Phase 79 (79-02b): a Thief Joiner has its own.
  if (body.cls === "Thief") h -= classEvasionFor(body);
  if (abilityEffectActive(c, "battleRoar") || partyEffectActive(state, "battleRoar")) h -= 2; // party-wide
  if (abilityEffectActive(body, "sidestep")) h -= 2;
  if (abilityEffectActive(body, "smoke")) h = 1;
  if (body.mirror > 0) h = 1; // Mirror Self (the caster's own body: "you")
  // Phase 39 (GEAR-02): the retired c.invis counter — a live "invis" item
  // effect (Cloak/potion/staff of invisibility) reads through the body's own
  // timers; the Crystal Staff's is party-wide (PARTY_WIDE_ITEM_EFFECTS).
  if (itemEffectActive(body, "invis") || (vs !== "hero" && partyItemEffectActive(state, "invis"))) h = 1; // invisible
  return Math.max(1, h);
}

/**
 * foeToHitBreakdown(state, vs) — Phase 25 (FEED-01, additive
 * payload): a narration-only breakdown of foeToHitVs's own arithmetic (the
 * foe's need is a count of winning faces, read roll-high — see foeToHitVs),
 * reproducing every step in the SAME order and recording a `{ name, delta }`
 * entry for every step that actually changed the running value (delta =
 * after − before, so an override such as Acrobat's `h = ACROBAT_FOE_FACES`
 * (4) records `4 - hBefore`, not a raw assignment). Returns `{ need, mods }` where `need`
 * MUST always equal `foeToHitVs(state, vs)` — this function reads exactly
 * the same fields (`c.race`, `c.sub`, skill/eff reads, the three
 * `abilityEffectActive` terms, `c.mirror`, `c.invis`) via the same helpers,
 * so the two can never diverge for any (race, sub, timers, vs) combination;
 * test/unit/feedback-payload.test.js proves this by matrix. Pure (no rng, no
 * mutation) — this is a narration helper, not a second source of truth:
 * foeToHitVs's own body is left untouched (zero risk) rather than delegating
 * to this function.
 *
 * Phase 75.2 (RULES-11, "Hero Size Matters"): the SAME size term
 * foeToHitVs applies (see its own JSDoc) is recorded here as a single
 * `{ name: "size", delta }` entry, right after Guard and before gear,
 * pushed only when the resolved face step is non-zero — an Elf's mods carry
 * no size entry (the signature mask drops the face axis for a race whose
 * base step would otherwise apply), a Troll's read `[..., { name: "size",
 * delta: 1 }]`, a Dwarf's `[..., { name: "size", delta: -1 }]`.
 *
 * Phase 79 (quick fix 79-02b, user ruling 2026-09-27): `sheet` is the
 * Joiner's own sheet for `vs === "member"` — every personal term reads the
 * body being swung at, exactly as foeToHitVs does (see its JSDoc).
 */
export function foeToHitBreakdown(state, vs = "hero", sheet) {
  const c = state.c;
  // Phase 79 (quick fix 79-02b): the SAME body foeToHitVs reads — the hero's
  // sheet for vs "hero", the Joiner's own sheet for vs "member".
  const body = defenceBody(state, vs, sheet);
  const mods = [];
  let h = 5;
  // Phase 79 (plan 79-02): the SAME race term foeToHitVs applies, named by
  // the body's own race.
  const raceTrait = raceFoeToHit(body);
  if (raceTrait) {
    const before = h;
    h += raceTrait;
    if (h !== before) mods.push({ name: body.race, delta: h - before });
  }
  if (body.sub === "Acrobat") {
    const before = h;
    h = ACROBAT_FOE_FACES;
    if (h !== before) mods.push({ name: "Acrobat", delta: h - before });
  }
  if (body.sub === "Guard") {
    const before = h;
    h -= 1;
    if (h !== before) mods.push({ name: "Guard", delta: h - before });
  }
  // RULES-11 (Phase 75.2, "Hero Size Matters", user ruling 2026-09-25): the
  // SAME size term foeToHitVs applies above, recorded as a single "size"
  // entry only when the body's resolved face step is non-zero.
  const sizeDelta = SIZE_FACES_PER_STEP * sizeAxisStep(body, "face");
  if (sizeDelta) {
    const before = h;
    h += sizeDelta;
    if (h !== before) mods.push({ name: "size", delta: h - before });
  }
  const gear = eff(body, "foeToHit");
  if (gear) {
    const before = h;
    h += gear;
    if (h !== before) mods.push({ name: "gear", delta: h - before });
  }
  // Phase 54 (BAND-02, USER RULING D): the SAME accuracy/evasion terms
  // foeToHitVs applies above, recorded only when non-zero.
  const accuracy = foeAccuracyFor();
  if (accuracy) {
    const before = h;
    h += accuracy;
    if (h !== before) mods.push({ name: "accuracy", delta: h - before });
  }
  // CLASS_MITIGATION.Thief.evasion (the body's own class) is SUBTRACTED from
  // the foe's need: a positive evasion makes a Thief harder to hit. Phase
  // 72, ROLL-01 (d), user ruling 2026-09-24; identity 0 is a structural no-op.
  if (body.cls === "Thief") {
    const evasion = classEvasionFor(body);
    if (evasion) {
      const before = h;
      h -= evasion;
      if (h !== before) mods.push({ name: "evasion", delta: h - before });
    }
  }
  if (abilityEffectActive(c, "battleRoar") || partyEffectActive(state, "battleRoar")) {
    const before = h;
    h -= 2;
    if (h !== before) mods.push({ name: "Battle Roar", delta: h - before });
  }
  if (abilityEffectActive(body, "sidestep")) {
    const before = h;
    h -= 2;
    if (h !== before) mods.push({ name: "Sidestep", delta: h - before });
  }
  if (abilityEffectActive(body, "smoke")) {
    const before = h;
    h = 1;
    if (h !== before) mods.push({ name: "Smoke", delta: h - before });
  }
  if (body.mirror > 0) {
    const before = h;
    h = 1; // Mirror Self
    if (h !== before) mods.push({ name: "Mirror Self", delta: h - before });
  }
  // Phase 39 (GEAR-02): the retired c.invis counter — read through the
  // body's own timers, plus the hero's party-wide Crystal Staff for a Joiner.
  if (itemEffectActive(body, "invis") || (vs !== "hero" && partyItemEffectActive(state, "invis"))) {
    const before = h;
    h = 1; // invisible
    if (h !== before) mods.push({ name: "invisible", delta: h - before });
  }
  const floored = Math.max(1, h);
  if (floored !== h) mods.push({ name: "floor", delta: floored - h });
  return { need: floored, mods };
}

/**
 * targetStrikeFaces(c, t, faces) — Phase 74 (ROLL-02): the FIVE per-target
 * terms `engine/combat.js#playerStrike` applies to its base `faces` before
 * Overhead Blow/Afraid, lifted verbatim (same order, same floors) so the
 * display reads the same rule the engine rolls against. `c` is the wielder:
 * this reads only `c.magicWpn` and `c.weapon`, never mutates `c`/`t`.
 *
 * In order: a dozing (`t.asleep > 0`) or held (`t.held`, a Freeze) target
 * floors `faces` at 5 (p.27: 5 winning faces to hit a dozing creature; Phase
 * 90 plan 04, SPELL-12: a Stupid foe is NO LONGER floored — Stupidity now
 * drops its intelligence to 1 and nothing else, so it is no easier to hit);
 * `t.sp.toHit` caps `faces` down (hard to hit); `t.sp.fast`
 * removes one winning face (floor 1); `t.sp.magicOnly` without `c.magicWpn`
 * zeroes `faces` (untouchable without a magic weapon); `t.sp.daggerOnly`
 * without `c.magicWpn` and without `c.weapon === "Dagger"` also zeroes
 * `faces` — Phase 72 (ROLL-01, finding F3, user ruling 2026-09-24):
 * DECLARED CANON DIVERGENCE, the prototype leaves `daggerOnly` inert (no
 * engine site ever read it before Phase 72). Finally (Phase 75.1, RULES-10,
 * foe Mirror Self): a target carrying `mirror > 0` (a fumbled Mirror Self)
 * caps `faces` at 1 — the striker's own top face — but never RAISES an
 * already-zeroed `faces` (a magic-only foe the striker cannot touch stays
 * untouchable; `Math.min(faces, 1)` is `0` when `faces` is already `0`). A
 * plain `t` (no matching `sp` fields, no `mirror`) returns `faces`
 * unchanged. RULES-18 (Phase 75.3): a held foe (`t.held`, engine/combat.js's
 * timed Freeze hold) is hit like a dozing foe, folded into the SAME first line
 * as `asleep`. Pure, zero rng.
 */
export function targetStrikeFaces(c, t, faces) {
  if (t.asleep > 0 || t.held) faces = Math.max(faces, 5); // p.27: 5 winning faces to hit a dozing (or held) creature
  if (t.sp && t.sp.toHit !== undefined) faces = Math.min(faces, t.sp.toHit); // hard to hit
  if (t.sp && t.sp.fast) faces = Math.max(1, faces - 1); // one more winning face to strike
  if (t.sp && t.sp.magicOnly && !c.magicWpn) faces = 0; // only magic touches it
  if (t.sp && t.sp.daggerOnly && !c.magicWpn && c.weapon !== "Dagger") faces = 0; // only a dagger or magic touches it
  if (t.mirror > 0) faces = Math.min(faces, 1); // RULES-10: Mirror Self — the top face only
  return faces;
}

/**
 * heroStrikeFacesVs(state, t) — Phase 74 (ROLL-02): the winning faces of the
 * hero's NORMAL swing against `t` right now — `afraidNeed(state,
 * targetStrikeFaces(state.c, t, toHit(state)))`, exactly the chain
 * `playerStrike` runs for its base (non-frenzy, non-ability) swing. The
 * frenzy swing (Fridgian, second attack) and ability descriptors (Overhead
 * Blow) are deliberately excluded — they apply only to a specific attack,
 * not to "right now" odds a display would show before a swing is chosen.
 * Pure, zero rng.
 */
export function heroStrikeFacesVs(state, t) {
  return afraidNeed(state, targetStrikeFaces(state.c, t, toHit(state)));
}

/**
 * foeSwingVsHero(state, f) — Phase 74 (ROLL-02): the foe `f`'s winning faces
 * and mods list for its swing against the hero, built exactly as
 * `engine/combat.js#pursuitStrike` and `foeTurn`'s hero branch build them —
 * base `foeToHitVs(state)`, mods copied from `foeToHitBreakdown(state).mods`
 * (Phase 75.2, RULES-11: this copy is where a non-zero "size" entry rides
 * along, signed for the foe — a Troll's `+1`, a Dwarf's `-1`, an Elf's
 * absent, its signature mask having dropped the face axis), then the combat's
 * `foeToHitPenalty` cap, the insult (+1, Phase 72 ROLL-01 (a)) and, LAST
 * since Phase 90 plan 04, blind (override to 1: a hard cap) — recording
 * `{ name, delta }` entries named "penalty"/"insulted"/"blind", pushed only
 * when the value actually changed for blind/penalty (insulted always pushes,
 * matching both call sites). Deltas are signed for the FOE (the roller), same convention as
 * `foeToHitBreakdown`. `state.combat` may be missing/null — the two
 * combat-wide terms (penalty, insulted) are then skipped and this never
 * throws. Returns `{ faces, mods }`. Pure, zero rng, never mutates `state`/`f`.
 */
export function foeSwingVsHero(state, f) {
  return foeSwingChain(state, f, foeToHitVs(state), foeToHitBreakdown(state).mods.slice());
}

/**
 * foeSwingVsMember(state, f, sheet) — Phase 79 (quick fix 79-02b, user
 * ruling 2026-09-27, "Joiners use only their own defences"): the foe `f`'s
 * winning faces and mods for its swing at the Joiner whose own sheet is
 * `sheet` — base `foeToHitVs(state, "member", sheet)` and its breakdown
 * (the Joiner's OWN race, size, sub-class, gear, evasion, Sidestep/Smoke,
 * Mirror Self and invisibility, plus the party-wide Battle Roar and Crystal
 * Staff), then the SAME combat-wide chain as the hero (blind, the Weaken
 * `foeToHitPenalty` cap, the insult applied LAST). engine/combat.js#foeTurn's
 * member branch reads this and nothing else, so the hero's and a Joiner's
 * odds are one rule on two bodies. Returns `{ faces, mods }`. Pure, zero
 * rng, never mutates `state`/`f`/`sheet`.
 */
export function foeSwingVsMember(state, f, sheet) {
  return foeSwingChain(state, f, foeToHitVs(state, "member", sheet), foeToHitBreakdown(state, "member", sheet).mods.slice());
}

/**
 * foeSwingVsFoe(state, f) — Phase 90 plan 08 (SPELL-10, Senseless and Duplicate
 * Foe): the winning faces and mods of a MISDIRECTED swing, a foe `f` swinging at
 * a foe (another one, or itself) instead of at your side. The swing rolls the
 * foe's own die (`foeDie(null, f)`, no body's race) against its own base need
 * `5 + FOE_ACCURACY` (the constant foeToHitVs starts from, before any body's
 * race, size, class, gear or effect), with none of a body's defences: the
 * victim is a monster, so no Acrobat, Guard, size, Mirror Self or invisibility
 * of yours ever reaches it. Blind is the one term that stays, as the hard cap
 * every foe swing carries (a blind misdirected foe hits only on its top face).
 * Returns `{ faces, mods }`, the same shape as foeSwingVsHero. Pure, zero rng.
 */
export function foeSwingVsFoe(state, f) {
  let faces = Math.max(1, 5 + foeAccuracyFor());
  const mods = [];
  if (f && f.blind) {
    const before = faces;
    faces = 1;
    if (faces !== before) mods.push({ name: "blind", delta: faces - before });
  }
  return { faces, mods };
}

/**
 * foeSwingChain(state, f, faces, mods) — the combat-wide tail of every foe
 * melee swing (hero or Joiner): the combat's `foeToHitPenalty` cap, the insult
 * (+1), then — LAST — blind (override to 1). See foeSwingVsHero's JSDoc for
 * the sign conventions. Mutates only the `mods` array it was handed (a fresh
 * copy at both callers). Pure, zero rng.
 *
 * Phase 90 plan 04 (SPELL-12, user 2026-09-30: "Blind limits a foe to its
 * to-hit die's maximum roll"): the blind cap is the LAST term, so it is a hard
 * cap that nothing raises. FLAGGED ASSUMPTION for the user's review: "hits only
 * on the maximum roll" is read as absolute, so an insulted party (the +1 that
 * Phase 72 puts last) still faces only the top face of a blind foe. A blind
 * foe never lands a critical either (engine/combat.js's three foe crit sites).
 */
function foeSwingChain(state, f, faces, mods) {
  const C = state.combat;
  // Quick 260927-rsx: a foe that resisted the landed Weaken keeps its faces.
  if (C && C.foeToHitPenalty && !(f && f.weakenResisted)) {
    const before = faces;
    faces = Math.min(faces, C.foeToHitPenalty);
    if (faces !== before) mods.push({ name: "penalty", delta: faces - before });
  }
  // Phase 90 plan 09 (SPELL-10, Size of the Behemoth): a foe that cowers hits
  // only on its die's top three numbers for the rest of the fight. The flag is
  // the FOE's own (`f.cowering`), not the room's Weaken fields, so a later
  // Weaken's expiry (which clears C.foeToHitPenalty) never lifts it.
  if (f && f.cowering) {
    const before = faces;
    faces = Math.min(faces, COWER_FACES);
    if (faces !== before) mods.push({ name: "cowering", delta: faces - before });
  }
  if (C && C.parleyInsulted) {
    const before = faces;
    faces += 1;
    mods.push({ name: "insulted", delta: faces - before });
  }
  if (f && f.blind) {
    const before = faces;
    faces = 1;
    if (faces !== before) mods.push({ name: "blind", delta: faces - before });
  }
  return { faces, mods };
}

/**
 * weaponDamageTerms(c) — Phase 79 (VOX-05, Plan 09; todo 2026-09-25 "hero
 * sheet damage range leaves out bonuses the engine applies"): every term of
 * a strike's damage EXCEPT the weapon's own dice, as plain data. This is the
 * ONE place the damage modifiers live: weaponDamage (below) adds a dice roll
 * to these terms, and weaponDamageRange (below) adds the dice's lowest and
 * highest faces, so the Hero sheet's DAMAGE row and #s-dmg line
 * (src/browser/heroTab.js) can never leave out a bonus a real strike gets.
 * Returns `{ weapon, levelSq, bonus, cap }`: `weapon` is the row whose dice
 * are rolled (weaponRow(c.weapon), else the Club), `levelSq` is level², `bonus`
 * is the sum of every other additive term (negative for a low-level Guard),
 * and `cap` is the Sorcerer's ceiling (9) or null. Pure, no rng, never
 * mutates `c`.
 */
export function weaponDamageTerms(c) {
  const weapon = weaponRow(c.weapon) || WEAPONS["Club"];
  const R = RACES[c.race];
  let bonus = c.prof + c.magicWpn;
  if (R.dmg) bonus += R.dmg;
  if (R.wpnBonus) bonus += R.wpnBonus;
  if (c.might) bonus += c.might;
  // Phase 39 (GEAR-02): the retired never-expiring c.might += 8 potion
  // write — a live Strength potion effect now reads through c.timers
  // (potionMight), additive alongside the spell's own c.might. RULES-11
  // (Phase 75.2, Plan 02): Enlarge is no longer a might-kind payload here —
  // it is a size step, read below through sizeDamage(c). Phase 89 (ITEM-05):
  // its +9 bulk arrives through eff(c, "dmg") (below) and its step through
  // sizeDamage(c), +11 in all.
  bonus += potionMight(c);
  if (skill(c, "Heft")) bonus += 2;
  // DELIBERATE RULES CHANGE (04.1-02, 2026-09-09, RULE-02): the Master of
  // Arms subclass blurb (content/flavor.js SUB_NOTE["Master of Arms"]) reads
  // "Plus two with every weapon ever forged" but the +2 weapon-proficiency
  // bonus had NO implementation anywhere in the engine. Wired here as a flat
  // additive, mirroring the existing prof/Heft pattern — no RNG, so this
  // does not change RNG consumption order or affect determinism/parity.
  if (c.sub === "Master of Arms") bonus += 2;
  bonus += eff(c, "dmg");
  // RULES-11 (Phase 75.2, "Hero Size Matters", user ruling 2026-09-25):
  // size is now a real stat, replacing the Phase 15 (ECON-08) Gauntlet-only
  // line this comment used to sit on. sizeDamage(c) = SIZE_DAMAGE_PER_STEP x
  // the DAMAGE axis's own resolved step: the race's OWN base step (from
  // content/races.js's `size` field) counts here UNLESS the race's
  // signature masks it (content/races.js's `sizeAxes` — the Dwarven +2
  // survives Small's -2, the Elven thin bones survive despite Small's -2
  // applying in full), and any live item size step (the Gauntlet of the
  // Giant, Enlarge) always counts in full on top of the resolved base. A
  // step down is floored by weaponDamage's Math.max(1, d), exactly like the
  // old line. The same function serves a Joiner's own member view
  // (weaponDamage(memberView(sheet, ally), rng), engine/combat.js) — a
  // member's own race/mask sets a member's own size damage, never the
  // hero's. Pure read of `c` (no rng); parity-unaffected for every character
  // whose resolved size axis is 0.
  bonus += sizeDamage(c);
  if (c.sub === "Guard" && c.level < 4) bonus -= 4 - c.level;
  const cap = c.sub === "Sorcerer" ? 9 : null; // a Sorcerer's arm is not the point
  return { weapon, levelSq: c.level * c.level, bonus, cap };
}

/** settleDamage(t, base) — module-private: a dice result plus the terms,
 * capped for a Sorcerer and floored at 1. The ONE settle weaponDamage and
 * weaponDamageRange share. */
function settleDamage(t, base) {
  let d = t.levelSq + base + t.bonus;
  if (t.cap !== null) d = Math.min(d, t.cap);
  return Math.max(1, d);
}

/**
 * weaponDamage(c, rng) — a single strike's damage. The weapon's dice notation
 * is resolved here via the injected rng (the ONLY randomness in this module),
 * so this stays deterministic given (c, rng). Ports mazeworld.html
 * weaponDamage() (lines 1484-1496), with the prototype's `w.d()` closure
 * replaced by the content weapon's `dice`/`halve` notation. Phase 79 (Plan
 * 09): the modifiers now come from weaponDamageTerms(c) above (the same sum,
 * the same single dice draw, the same Sorcerer cap and floor).
 */
export function weaponDamage(c, rng) {
  const t = weaponDamageTerms(c);
  const w = t.weapon;
  let base = w.halve ? Math.ceil(rollDice(rng, w.dice) / 2) : rollDice(rng, w.dice);
  // Phase 90 (SPELL-09): a live Strength spell adds its own d10 to this roll,
  // drawn from a derived stream right after the weapon dice (the main rng
  // never advances for it), before the Sorcerer's cap and the floor of 1.
  base += strengthRoll(c, rng);
  return settleDamage(t, base);
}

/**
 * weaponDamageRange(c) — Phase 79 (Plan 09): the lowest and highest damage
 * weaponDamage(c, rng) can return, as `{ min, max }` — the weapon's dice at
 * their lowest and highest faces (halved first for a halving weapon), then
 * the same terms, cap and floor. The Hero sheet reads this instead of
 * re-deriving the modifier stack. Pure, no rng, never mutates `c`.
 */
export function weaponDamageRange(c) {
  const t = weaponDamageTerms(c);
  const { n, sides } = t.weapon.dice;
  const flat = t.weapon.dice.bonus || 0; // rollDice's own `bonus || 0`
  const lo = n + flat;
  const hi = n * sides + flat;
  const halve = (x) => (t.weapon.halve ? Math.ceil(x / 2) : x);
  // Phase 90 (SPELL-09): a live Strength spell widens the range by its die's
  // lowest and highest faces, the same extra weaponDamage draws.
  const sd = strengthDiceOf(c);
  const sLo = sd ? sd.n + (sd.bonus || 0) : 0;
  const sHi = sd ? sd.n * sd.sides + (sd.bonus || 0) : 0;
  return { min: settleDamage(t, halve(lo) + sLo), max: settleDamage(t, halve(hi) + sHi) };
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
 * SPELL_SELF_KINDS — the spell kinds that never target a foe (the caster's
 * own body, its side, or the map): Summon, Shield/Bubble (ward), Strength
 * (might), Regenerate, Heal, Map the Floor (reveal), Foresee, Mirror Self
 * and Sense Presence (senses). User ruling 2026-09-27 (quick 260927-rsx):
 * every OTHER kind is a spell cast on an enemy, so every foe it targets
 * rolls `resistRoll` (through `foeSpellResistCheck`); these kinds are never
 * resisted.
 */
export const SPELL_SELF_KINDS = Object.freeze(new Set(["summon", "ward", "might", "regen", "heal", "reveal", "foresee", "mirror", "senses", "timed", "tongue"]));

/**
 * spellTargetsFoe(sp) — true when SPELLS row `sp` is cast on an enemy (its
 * kind is not in SPELL_SELF_KINDS). A missing row reads false. Pure.
 */
export function spellTargetsFoe(sp) {
  return !!sp && typeof sp.kind === "string" && !SPELL_SELF_KINDS.has(sp.kind);
}

/**
 * resistFaces(intel) — THE one resist scale, both sides. User ruling
 * 2026-09-27 (quick 260927-rsx, "every spell cast on an enemy should have a
 * chance to be resisted based on their intelligence"; scale: half-intel) set
 * it for a foe resisting a spell cast on it; user ruling 2026-09-28 (quick
 * 260928-hrs, "Use the same half-intel scale for heroes now") put the hero on
 * it too, when a foe's spell or ability lands on the hero. The winning faces
 * on the resistor's d20 are `max(1, round(intel / 2))`: intel 1–2 resists on
 * 1 face (5%), 3 on 2 (10%), 6 on 3 (15%), 10 on 5 (25%), 16 on 8 (40%), 18
 * on 9 (45%), 20 on 10 (50%). There is no gate, so every resistor has at
 * least 5%. A missing or non-finite intel reads as 0 (1 face). THE one
 * number the foe card and the spell rows print, through
 * rollRange.js#facesRangeText. Pure, no rng.
 */
export function resistFaces(intel) {
  const i = Number.isFinite(intel) ? intel : 0;
  return Math.max(1, Math.round(i / 2));
}

/**
 * resistRoll(rng, intel) — the ONE resist roll, both sides (quick
 * 260927-rsx for a foe, quick 260928-hrs for the hero): one roll-high d20
 * through `rollCheck`, `resisted = roll >= 21 - faces`
 * (`atLeastFor(resistFaces(intel), 20)`). Every resistor rolls; there is no
 * gate (canon p.25's intel >= 12 gate and its `intel - 1` faces are
 * retired). Draws exactly one d20 from whatever `rng` it is handed: the
 * hero's resist (engine/foeAbilities.js#heroResist) hands it the MAIN rng,
 * at the position canon's gated d20 always sat; a foe's resist hands it a
 * derived stream (`foeSpellResistCheck` below). Returns `{ rolled: true,
 * resisted, roll, atLeast, dieN, faces }` (`rolled` is always true now, kept
 * so the shape still matches `controlResistRoll`'s). Pure w.r.t. everything
 * but the one draw; never mutates its arguments.
 *
 * Homed here (D-07, relocated by D-17) because `engine/derived.js` is the
 * only cycle-free leaf module: `engine/magic.js` imports from
 * `engine/combat.js`, which imports `engine/foeAbilities.js`.
 */
export function resistRoll(rng, intel) {
  return resistRollFaces(rng, resistFaces(intel));
}

/**
 * resistRollFaces(rng, faces) — the one d20 every resist shares (`resistRoll`
 * above hands it the half-intel faces, `foeRisingResistCheck` below hands it
 * the depth-rising faces): one roll-high `rollCheck`, `resisted = roll >=
 * 21 - faces`. Draws exactly one d20 from `rng`. Pure otherwise.
 */
function resistRollFaces(rng, faces) {
  const check = rollCheck(rng, 20, atLeastFor(faces, 20));
  return { rolled: true, resisted: check.ok, roll: check.roll, atLeast: check.atLeast, dieN: check.dieN, faces };
}

/**
 * foeSpellResistCheck(state, rng, source, idx, intel, caster = "you") — the
 * derived-stream wrapper `engine/combat.js#foeResistsSpell` calls for every
 * foe a spell targets. Draws `resistRoll` from a FRESH keyed stream —
 * `derivedRng(<the main rng's cursor, or 0 for a test double with no
 * getState>, "spellResist", source, caster, <state.acts, or 0>, <the combat
 * round, or 0>, idx)`, the same idiom `controlResistCheck` below uses — never
 * from the caller's `rng`, so the resist itself never moves the main cursor
 * (only what a resisted foe then does NOT take — its own to-hit, damage or
 * duration draws — can). A different `idx` (another foe) or `caster` (the
 * hero "you", or a Joiner's name — so a Joiner casting the hero's spell in
 * the same round never copies the hero's roll) draws independently; the
 * same key always yields the same result. Returns `resistRoll`'s shape.
 */
export function foeSpellResistCheck(state, rng, source, idx, intel, caster = "you") {
  return resistRoll(spellResistStream(state, rng, source, idx, caster), intel);
}

/**
 * spellResistStream(state, rng, source, idx, caster) — the keyed derived
 * stream both foe resists draw from (`foeSpellResistCheck` and
 * `foeRisingResistCheck`): `derivedRng(<the main rng's cursor, or 0 for a test
 * double with no getState>, "spellResist", source, caster, <state.acts, or 0>,
 * <the combat round, or 0>, idx)`. Never the caller's `rng`, so a resist never
 * moves the main cursor. One key for both, so at or below the rising resist's
 * knee (no depth faces) the two give the SAME roll for the same key.
 */
function spellResistStream(state, rng, source, idx, caster) {
  const cursor = typeof rng.getState === "function" ? rng.getState() : 0;
  const acts = Number.isInteger(state.acts) && state.acts >= 0 ? state.acts : 0;
  const round = state.combat && Number.isInteger(state.combat.round) ? state.combat.round : 0;
  return derivedRng(cursor, "spellResist", source, caster, acts, round, idx);
}

/**
 * RISING_RESIST_CEILING — a d20's top face always wins for the caster: no
 * depth, dial or intelligence makes an effect impossible. The same structural
 * 19 `controlResistFacesFor` already holds.
 */
export const RISING_RESIST_CEILING = 19;

/**
 * risingResistFaces(depth, intel) — Phase 89 plan 08 (ITEM-01, user ruling Q1,
 * 2026-09-30, docs/ITEM-AUDIT.md "## Rulings"): THE one depth-rising resist,
 * the shared helper every item and staff effect a foe can resist rolls
 * against, and the rule Phase 90 reuses for spells. "Rising resists on higher
 * floors should apply to ALL spells and spell-like effects ... remove the
 * floor-12 special effects only." So there is ONE resist roll, not a resist
 * plus an extra control resist past floor 12. The foe's winning faces on its
 * d20 fold its two old chances into one: its half-intel faces `a`
 * (`resistFaces`) and the depth faces `c` (`difficulty.js#controlResistFacesFor`:
 * none at or below floor 12, one more per floor past it, capped by the dial at
 * 15). A foe that used to get two independent shots at shrugging an effect off
 * (P = 1 - (1 - a/20)(1 - c/20)) keeps that same overall chance in one d20:
 * `round(a + c - a*c/20)` faces, capped at `RISING_RESIST_CEILING`. So the
 * rise is exactly the curve the game already had; what goes is the floor-12
 * special effects (the second roll, the three-round cap, the hold), not the
 * difficulty of landing an effect on a deep floor. At or below floor 12 (c = 0)
 * this IS `resistFaces(intel)`, byte for byte. A landed effect is the floor-1
 * effect at every depth. Pure, no rng.
 */
export function risingResistFaces(depth, intel) {
  const a = resistFaces(intel);
  const c = controlResistFacesFor(depth);
  return Math.min(RISING_RESIST_CEILING, Math.round(a + c - (a * c) / 20));
}

/**
 * foeRisingResistCheck(state, rng, source, idx, intel, caster = "you") — the
 * derived-stream roll for `risingResistFaces` at `state.floor.depth`, the twin
 * of `foeSpellResistCheck` (same stream key, same single d20, so the main rng
 * never moves). Returns `resistRoll`'s shape plus `depthFaces`, the faces the
 * depth added (0 at or below floor 12), so the Oracle can name the rise.
 * `engine/combat.js#foeResistsEffect` is the gate that calls it.
 */
export function foeRisingResistCheck(state, rng, source, idx, intel, caster = "you") {
  const depth = state.floor?.depth;
  const faces = risingResistFaces(depth, intel);
  const depthFaces = faces - resistFaces(intel);
  return { ...resistRollFaces(spellResistStream(state, rng, source, idx, caster), faces), depthFaces };
}

/**
 * foeWeakened(combat, f) — whether the room's Weaken (`combat.weakened`)
 * reaches foe `f`: every live foe except one that resisted the Weaken cast
 * that landed (`f.weakenResisted`, set by combat.js#roomWeakenResists). Read
 * by every foe-damage halving site and the `foeToHitPenalty` cap. Pure.
 */
export function foeWeakened(combat, f) {
  // Phase 90 plan 09 (SPELL-10, Size of the Behemoth): a cowering foe deals half
  // damage for the rest of the fight, whatever the room's Weaken is doing.
  if (f && f.cowering) return true;
  return !!(combat && combat.weakened && !(f && f.weakenResisted));
}

/**
 * COWER_FACES — Phase 90 plan 09 (SPELL-10, Size of the Behemoth): the winning
 * faces a cowering foe keeps (its die's top three numbers: 6-8 on a d8, 18-20 on
 * a d20), the same cap a landed Weaken puts on the room.
 */
export const COWER_FACES = 3;

/**
 * controlResistRoll(rng, faces) — RULES-18 (Phase 75.3, user ruling
 * 2026-09-25): the ONE resist check a past-the-knee control (Freeze, Stone,
 * Doze/Sleep, Weaken, Stupid) rolls against, roll-high on `rollCheck`'s d20 —
 * `resisted = roll >= 21 - faces` (`atLeastFor(faces, 20)`). At `faces <= 0`
 * (at or below `CONTROL_AT_DEPTH.kneeDepth`, or the identity dial) this draws
 * NOTHING and returns `{ rolled: false, resisted: false, roll: undefined }` —
 * the "no roll at all below the gate" shape canon p.25's intel-12 resist
 * once had (retired by quick 260928-hrs), so a caller can tell "no roll
 * happened" apart from "rolled and failed to resist". Otherwise `{ rolled: true, resisted, roll, atLeast,
 * dieN }` — the SAME roll-high triple `rollFields` spreads. Pure w.r.t.
 * everything but the single gated draw; never mutates `rng`'s caller-visible
 * state beyond that one draw.
 */
export function controlResistRoll(rng, faces) {
  if (!(faces > 0)) return { rolled: false, resisted: false, roll: undefined };
  const check = rollCheck(rng, 20, atLeastFor(faces, 20));
  return { rolled: true, resisted: check.ok, roll: check.roll, atLeast: check.atLeast, dieN: check.dieN };
}

/**
 * controlResistCheck(state, rng, purpose, idx) — RULES-18: the derived-stream
 * wrapper `engine/combat.js#resistControl` calls at every past-the-knee
 * control site. Reads `controlResistFacesFor(state.floor.depth)`; at 0 faces
 * (floor <= `CONTROL_AT_DEPTH.kneeDepth`, or the identity dial) this returns
 * immediately WITHOUT building a derived stream at all — a spy on the main
 * `rng` sees zero calls, and the main cursor (`rng.getState()`) is byte-
 * identical before and after, exactly like `controlResistRoll`'s own 0-faces
 * gate. Otherwise it builds a FRESH, keyed stream — `derivedRng(<the main
 * rng's cursor, or 0 for a test double with no getState>, "controlResist",
 * purpose, <state.acts, or 0>, <the combat round, or 0>, idx)`, the SAME
 * idiom `engine/items.js#pilferFumbleRng` established — and draws
 * `controlResistRoll` from THAT stream, never the caller's `rng`. The same
 * `(state, purpose, idx)` always yields the same result (deterministic,
 * reproducible in a test without re-using the live rng instance); a
 * different `idx` (a different target/foe) draws independently. Returns
 * `{ rolled, resisted, roll, atLeast, dieN, faces }` — `controlResistRoll`'s
 * own shape, plus the resolved `faces` count for narration/testing.
 */
export function controlResistCheck(state, rng, purpose, idx) {
  const faces = controlResistFacesFor(state.floor?.depth);
  if (faces <= 0) return { rolled: false, resisted: false, roll: undefined, faces };
  const cursor = typeof rng.getState === "function" ? rng.getState() : 0;
  const acts = Number.isInteger(state.acts) && state.acts >= 0 ? state.acts : 0;
  const round = (state.combat && Number.isInteger(state.combat.round)) ? state.combat.round : 0;
  const stream = derivedRng(cursor, "controlResist", purpose, acts, round, idx);
  return { ...controlResistRoll(stream, faces), faces };
}

/**
 * scrollReaderOf(c) — RULES-10 (Phase 75.1, user 2026-09-24/25): which of
 * readScroll's three read paths a character takes. A Magic User always
 * reads automatically ("magicUser" — the grimoire-copy/free-cast path,
 * unchanged since Phase 40); a non-Magic-User carrying Runes/Signs also
 * reads automatically, with no grimoire copy ("runes"); everyone else rolls
 * their own intelligence ("intel") — including a Pilfer, whose old blanket
 * refusal (`canRead`, retired by this phase) used to stop it outright. Pure,
 * no rng.
 */
export function scrollReaderOf(c) {
  if (c.cls === "Magic User") return "magicUser";
  if (skill(c, "Runes/Signs")) return "runes";
  return "intel";
}

/**
 * scrollReadBands(intel) — RULES-10: the intelligence-read thresholds for an
 * "intel" reader, on a d20, roll-high (Phase 73, ROLL-05). `atLeast` is the
 * lowest winning face — `atLeastFor(intel - 1, 20)`, i.e. `22 - intel` —
 * exactly `intel - 1` winning faces, mirroring today's `roll < intel`
 * canon shape. There is NO intel-12 floor here (canon p.25's resist gate,
 * retired by quick 260928-hrs, never applied to reading); low intel just
 * means worse odds, all the way down; a scroll reader with intel 1 practically never reads. A fumble
 * is any roll BELOW half the target: `fumbleAtLeast = Math.ceil(atLeast /
 * 2)` — a roll of EXACTLY half the target is a plain failure, never a
 * fumble (the user's own worked example: intel 14 reads 8-20, fails 4-7,
 * fumbles 1-3). `intel` is read as a finite number or 0 (a missing/absent
 * intel reads as the worst possible reader: atLeast 22, fumbleAtLeast 11 —
 * never reads, fumbles on 1-11). Pure, no rng.
 */
export function scrollReadBands(intel) {
  const i = Number.isFinite(intel) ? intel : 0;
  const atLeast = atLeastFor(i - 1, 20);
  return { atLeast, fumbleAtLeast: Math.ceil(atLeast / 2), dieN: 20 };
}

/**
 * scrollReadOutcome(check, bands) — RULES-10: "read" when the check
 * succeeded (`check.ok`, the roll landed at or above `bands.atLeast`); else
 * "garbled" (a plain failure — the scroll crumbles, nothing casts) when the
 * roll is still at or above `bands.fumbleAtLeast`; else "fumbled" (a bad
 * miss — the scroll turns on the reader in combat, or just fizzles outside
 * it). Written roll-high throughout (the Phase 73 shape guard,
 * test/unit/roll-high-guard.test.js, requires it) — every comparison reads
 * `roll >= atLeast`, never `<`/`<=`. Pure, no rng.
 */
export function scrollReadOutcome(check, bands) {
  if (check.ok) return "read";
  return check.roll >= bands.fumbleAtLeast ? "garbled" : "fumbled";
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
 * gate and `#parley`'s bonus term (never balanced twice). Phase 38 (ABIL-02):
 * the Language skill is dropped outright — fluency is now sourced ENTIRELY
 * from a tongue-effect item (the Helm of Knowledge), so the ceiling drops
 * from 2 to 1 (the fluency-2 "Magical parley" tier in canParley is
 * unreachable until a future fluency source exists, documented in
 * docs/ABILITIES.md — canParley's fluency-2 branch is left in place, since
 * it is a data-driven threshold, not a dead read). Returns 0 or 1. Pure read
 * (`eff`), no rng, no mutation.
 *
 * Phase 90 plan 09 (SPELL-10, Chameleon Tongue): a second, fight-scoped source.
 * `combat.tongue` (set by castSpell's tongue branch to the spell's `fluency`, 2)
 * lifts the result to that value for the rest of the fight, so the fluency-2
 * Magical branch of canParley is reachable at last and `parley` adds +4 to its
 * roll. The larger of the two sources wins (they never stack). `combat` is
 * optional: with none, this is the item source alone, as before.
 */
export function fluency(c, combat) {
  const item = eff(c, "tongue") > 0 ? 1 : 0;
  const spell = combat && Number.isInteger(combat.tongue) ? combat.tongue : 0;
  return Math.max(item, spell);
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

/**
 * schoolClosed(sub, school) — Phase 90 plan 06 (SPELL-10): true when `sub` is a
 * Magic User sub-class (it has an MU_CHART row) whose chart can NEVER learn
 * `school`. A sub-class with no chart row is not a Magic User and holds no
 * book, so nothing is "closed" to it (the old behaviour, unchanged: the
 * fixtures that hand a Fighter a book keep working). The one reader behind
 * canCast's school check, castSpell's refusal, the Grimoire row and the
 * tolerant save load.
 */
export function schoolClosed(sub, school) {
  return !!MU_CHART[sub] && !schoolAllowed(sub, school);
}

export function schoolGate(sub, school) {
  const c = MU_CHART[sub];
  return (c && c.gate && c.gate[school]) || 1;
}

export function schoolBonus(sub, school) {
  const c = MU_CHART[sub];
  return c && typeof c[school] === "number" ? c[school] : 0;
}

/**
 * SCHOOL_WARD_HP — Phase 91.1 plan 03 (V18 B, user 2026-10-01): the hit points each point of the caster's
 * protection bonus adds to a Shield's soak pool and to a Bubble's film.
 */
export const SCHOOL_WARD_HP = 5;

/**
 * healBonusFor(sub) — Phase 91.1 plan 03 (V18 B): the extra HP every healing spell the caster casts heals: the
 * chart's healing bonus (Cleric 4, Court Mage 1). Replaces the Cleric's separate +3 rule. A sub-class with no
 * chart row, a never-learned healing school or a 0 bonus reads 0 (never NaN). Pure, no rng.
 */
export function healBonusFor(sub) {
  return schoolBonus(sub, "healing");
}

/**
 * wardBonusFor(sub) — Phase 91.1 plan 03 (V18 B): the extra HP a caster's Shield soaks and Bubble's film holds:
 * the chart's protection bonus times SCHOOL_WARD_HP (Cleric 15, Summoner and Court Mage 10, Sorcerer 5). 0 for
 * everyone else, a Bard and a scroll's non-caster included. Pure, no rng.
 */
export function wardBonusFor(sub) {
  return schoolBonus(sub, "protection") * SCHOOL_WARD_HP;
}

/**
 * spellException(sub, sp) — Phase 91.1 plan 03 (V20 B): true when the chart's named-exception table
 * (content/mu-chart.js#MU_SPELL_EXCEPTIONS) lets `sub` learn the spell `sp` although its school is closed.
 * The one reader behind canLearn and spellClosed; no sub-class name is checked here.
 */
export function spellException(sub, sp) {
  const names = MU_SPELL_EXCEPTIONS[sub];
  return !!(names && sp && names.includes(sp.n));
}

/**
 * spellClosed(sub, sp) — Phase 91.1 plan 03 (V20 B): schoolClosed for one spell: its school is closed to the
 * Magic User sub-class and the chart's named exceptions do not let it in. A sub-class with no chart row is not
 * a Magic User and nothing is closed to it.
 */
export function spellClosed(sub, sp) {
  return schoolClosed(sub, sp.s) && !spellException(sub, sp);
}

/**
 * SCHOOL_STRETCH_SQUARES — Phase 90 plan 07 (SPELL-10; 90-CONTEXT.md "School
 * bonus stretches the new spells", Q6 A in docs/SPELL-AUDIT.md Rulings, user
 * 2026-09-30): the squares each point of the caster's school bonus adds to a
 * square-timed new spell's window. (Under Q6 B it would be 1.) Each such
 * spell's text states it ("+10 squares per school bonus point").
 */
export const SCHOOL_STRETCH_SQUARES = 10;

/**
 * spellEffectSquares(sub, sp) — Phase 90 plan 07 (SPELL-10, Q6 A): the squares
 * a cast of the timed spell `sp` lasts for a caster of sub-class `sub`: its
 * base `act.effect` plus, for a `stretch: "squares"` row, the chart's school
 * bonus for the spell's school times SCHOOL_STRETCH_SQUARES. A Wizard or
 * Apprentice (+0) gets the base, a Sorcerer or Summoner (+1) one step more, an
 * Illusionist (+4) four steps more; a non-Magic-User (a scroll's free cast, no
 * chart row) gets the base, since schoolBonus reads 0 for it. Pure, no rng.
 */
export function spellEffectSquares(sub, sp) {
  const base = sp && sp.act && Number.isInteger(sp.act.effect) ? sp.act.effect : 0;
  return base + (sp && sp.stretch === "squares" ? schoolBonus(sub, sp.s) * SCHOOL_STRETCH_SQUARES : 0);
}

/**
 * spellEffectRounds(sub, sp, base) — Phase 90 plan 07 (SPELL-10, Q6 A): the
 * rounds a round-timed new spell lasts: `base` (the spell's own drawn or fixed
 * rounds) plus, for a `stretch: "rounds"` row, +1 round per school bonus point
 * of the spell's school. A squares-stretched row (and any other) returns
 * `base` unchanged. Used by 90-08's round-timed Illusion and Special spells.
 * Pure, no rng.
 */
export function spellEffectRounds(sub, sp, base) {
  return base + (sp && sp.stretch === "rounds" ? schoolBonus(sub, sp.s) : 0);
}

export function canLearn(sub, sp) {
  return schoolAllowed(sub, sp.s) || spellException(sub, sp);
}

/**
 * healMulFor(sub) — RULES-03 (Phase 75, user 2026-09-25): reads the caster's
 * own healMul chart flag (a data-driven multiplier, never a name check).
 * Only the Summoner row carries one (0.5); every other row — and an
 * unknown/undefined sub — defaults to 1 (no change). A non-finite or
 * non-positive value on the row (should never happen) also falls back to 1.
 */
export function healMulFor(sub) {
  const mul = MU_CHART[sub]?.healMul;
  return Number.isFinite(mul) && mul > 0 ? mul : 1;
}

/**
 * applyCasterHealMul(sub, amount) — RULES-03 (Phase 75): applies healMulFor
 * LAST, after every other modifier (the Cleric +3 bonus, a heal2x race's
 * doubling) has already been folded into `amount`. At mul === 1 the amount
 * passes through unchanged (byte-identical to every non-Summoner caster
 * today). Otherwise floors the product and guarantees a minimum of 1 — a
 * Summoner's own healing spell can never restore zero.
 */
export function applyCasterHealMul(sub, amount) {
  const mul = healMulFor(sub);
  if (mul === 1) return amount;
  return Math.max(1, Math.floor(amount * mul));
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
 * that shares one of those four kinds at a higher level (Fireball/Lightning/
 * Mangle are all `kind: "thrown"`) — and, since Phase 90 plan 05 (SPELL-12),
 * Ice's own kind "blast" (the area form of Freeze; it was a damage-over-time
 * spell before and so was not an attack spell). By deliberate decision, the
 * other disabling/offense kinds (acid, volley, quake, death, blind, shrink,
 * petrify, insane, stupid, vapor) are NOT in this set — they do not count as
 * a "guaranteed attack" for the Wizard melee rule or the grimoire top-up.
 * Consumed by isAttackSpell/castableAttackSpells below, engine/character.js's
 * rollGrimoire top-up, and engine/combat.js's Wizard refusal check — a
 * single shared definition so those three call sites can never drift apart.
 */
export const ATTACK_SPELL_KINDS = new Set(["status", "thrown", "stun", "weaken", "blast"]);

/** isAttackSpell(sp) — does this spell's kind belong to ATTACK_SPELL_KINDS? */
export function isAttackSpell(sp) {
  return ATTACK_SPELL_KINDS.has(sp.kind);
}

/**
 * DAMAGE_SPELL_KINDS — Phase 40 (SPELL-04, DELIBERATE RULES CHANGE,
 * 2026-09-18): the day-one guarantee narrows from "any ATTACK_SPELL_KINDS
 * member" (Phase 23) to "a spell that actually deals damage" — the user's
 * own ruling (40-CONTEXT.md Area 3) singled out that a small summon counts
 * as a damage SOURCE, not a damage KIND. (Phase 90 plan 06, SPELL-12: Lesser
 * Summon, the one spell that was carried as a damage source, is removed; a
 * summon never counts as damage now, and the Summoner's day-one damage
 * guarantee is met by the top-up like every other sub-class's.)
 *
 * Deliberate exclusions, matching the research finding this plan closes:
 *   - Summon (`kind: "summon"`) does NOT count — a summon is a damage
 *     source, never a damage spell on its own.
 *   - Doze / Stun / Weaken (`status`/`stun`/`weaken`) do NOT count — they
 *     disable, they never move a foe's wp.
 * Phase 90 plan 05 (SPELL-12): "blast" (Ice, d10 + level² to every foe) joins
 * the set and "dot" leaves it (no spell row has kind "dot" any more; Poisoned
 * Edge's `f.dot` is an ability record, not a spell kind).
 * ATTACK_SPELL_KINDS above is UNTOUCHED by this addition — it still gates
 * the Wizard melee-refusal rule and member/ally casts, a different
 * question ("is this a combat spell to lean on") from "does this spell
 * deal damage".
 */
export const DAMAGE_SPELL_KINDS = new Set(["thrown", "blast", "acid", "volley", "quake", "death"]);

/**
 * dealsDamage(sp) — does casting this spell deal damage to a foe? True for
 * any DAMAGE_SPELL_KINDS member. Pure read, no rng, no mutation.
 */
export function dealsDamage(sp) {
  return DAMAGE_SPELL_KINDS.has(sp.kind);
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

/**
 * canCast(state, sp) — the ONE castability verdict (the combat menu, the
 * Grimoire view model and engine/magic.js#castSpell all read it): the spell is
 * in the book, the sub-class can ever learn its school (a Magic User sub-class
 * whose chart closes it never casts it, see schoolClosed), the hero is at the
 * spell's effective level and the school's gate is open.
 *
 * Phase 90 plan 06 (SPELL-10, user 2026-09-30: "sub-classes or races that
 * cannot cast [a school] are properly excluded"): a book is gated when it is
 * dealt (engine/character.js#grantableAt), and canCast RE-CHECKS the school
 * (`schoolAllowed`), so an old or tampered book never casts or lists a spell
 * of a school its sub-class can never learn.
 */
export function canCast(state, sp) {
  const c = state.c;
  if (!c.grimoire || !c.grimoire.includes(sp.n)) return false;
  if (spellClosed(c.sub, sp)) return false;
  // DELIBERATE RULES CHANGE (Phase 23, 2026-09-14, IDENT-03/IDENT-04): routed
  // through spellLevelFor so the per-sub override table can lower a spell's
  // effective level (Phase 90 plan 06: the Summoner's Summon); byte-
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
