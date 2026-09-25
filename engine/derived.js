// engine/derived.js
//
// Pure, state-scoped derived character numbers (ENG-01). Ports the prototype's
// strikeDie/toHit/weaponDamage/upkeep/foeDie/foeToHitVs/inDark/levelFromSP/eff/
// skill helpers (mazeworld.html lines 1444-1498, 628-629, 1872-1876) and the
// Magic-User school gate helpers (lines 879-887), replacing every global `S.c`
// read with an explicit passed `c` (character) or `state` parameter. No global
// S, no DOM, no Math.random — only pure reads and arithmetic.

import { CLASSES, RACES, WEAPONS, STRIKE_DICE, THRESHOLDS, MU_CHART, ARMORS, BAGS, SPELLS, SPELL_LEVEL_OVERRIDES, SLOT_OF, POTIONS, ACTIVATION_OF, FLEE_NEED, FLEE_THIEF_BONUS, FLEE_CLASS_MOD, FLEE_RACE_MOD } from "../content/index.js";
import { rollDice, rollCheck, atLeastFor } from "./dice.js";
import { foeAccuracyFor, classEvasionFor, classArmorMulFor, fleeNeedModFor } from "./difficulty.js";
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
 * LIVE item timer records.
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
 * the staffCharges condition chip and `narrateTimerTransitions` (a staff is
 * always bagged now, but the union stays harmless). Returns a NEW array
 * (`c.items` first, in order, then the truthy `c.worn` values); never
 * mutates `c`. Defensive: a missing/non-array `c.items` and a missing/non-
 * object `c.worn` both contribute nothing rather than throwing. 260918-wy1
 * (jewelry-merge): shape-agnostic by construction — `Object.values(c.worn)`
 * reads whichever concrete keys are populated (jewelry1/jewelry2/cloak)
 * without caring which family they belong to, so this needed no change.
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
 * liveItemEffects(c) — Phase 39 (GEAR-02): every currently-LIVE item effect
 * on `c` — a `c.timers` record whose id starts with `"item:"`, is in
 * `phase: "effect"` with `left > 0`, and whose key resolves to a known
 * `ACTIVATION_OF` entry (an unknown key — e.g. a stripped item, or a tampered
 * save, T-39-07 — is silently skipped, never thrown). Returns an array of
 * `{ key, act, rec }` in `c.timers`'s own insertion (`Object.keys`) order.
 * Pure read, no rng, no mutation.
 */
export function liveItemEffects(c) {
  const out = [];
  if (!c || !c.timers || typeof c.timers !== "object") return out;
  for (const id of Object.keys(c.timers)) {
    if (!id.startsWith("item:")) continue;
    const rec = c.timers[id];
    if (!rec || rec.phase !== "effect" || !(rec.left > 0)) continue;
    const key = id.slice("item:".length);
    const act = ACTIVATION_OF[key];
    if (!act) continue;
    out.push({ key, act, rec });
  }
  return out;
}

/**
 * itemEffectActive(c, kind) — Phase 39 (GEAR-02): is ANY live item effect of
 * activation `kind` (e.g. `"haste"`, `"invis"`, `"ether"`, `"acute"`, `"fly"`)
 * currently active on `c`? The one read every retired-counter consumer
 * (strikeDie/foeToHitVs/weaponDamage/isFlying/the climb block) re-points to.
 * Pure, no rng.
 */
export function itemEffectActive(c, kind) {
  return liveItemEffects(c).some((e) => e.act.kind === kind);
}

/**
 * potionMight(c) — Phase 39 (GEAR-02): the sum of `act.might` across every
 * live `kind: "might"` item effect on `c` (Strength/Enlarge potions) — the
 * timed replacement for the old never-expiring `c.might += 8/4` write.
 * Pure, no rng.
 */
export function potionMight(c) {
  let t = 0;
  for (const e of liveItemEffects(c)) if (e.act.kind === "might" && typeof e.act.might === "number") t += e.act.might;
  return t;
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
 *   - haste/invis/acute/ether/might (Phase 39, GEAR-02, one chip per LIVE
 *     `c.timers` item effect, via liveItemEffects): {polarity:"good",
 *     remaining:<left>, cadence:"squares"|"rounds", source:<item display
 *     name>, might?:<amount, "might"-kind only>}
 *   - might  {polarity:"good"}                            — the SPELL's +damage, lasts the day (no count) — distinct from a potion's timed "might" chip above; both may appear together
 *   - ward   {polarity:"good", pool:<hp>, remaining:<rounds>, name:<spell/item name>} — Phase 31 (CMB-04): the Shield chip, mirroring c.ward's own {pool, rounds, name} shape
 *   - mirror {polarity:"good", remaining:<rounds>}         — Phase 40 (SPELL-02): Mirror Self — c.mirror counts down once per foeTurn; cleared at endCombat
 *   - senses {polarity:"good"}                             — Phase 40 (SPELL-02): Sense Presence — a flat 0/1 flag (no count), lasts until endCombat clears it; also waives every forced foe-first initiative rule (see combat.js#rollInitiative)
 *   - regen  {polarity:"good"}                              — Phase 40 (SPELL-02): Regeneration — a flat boolean (no count, the d8/round tick has no duration field), cleared at endCombat
 *   - foresight {polarity:"good"}                           — Phase 40 (SPELL-02): an ARMED Sense Danger, waiting for the next fight (consumed by rollInitiative, which always sets it back to false)
 *   - reveal {polarity:"good", remaining:<sq left>, cadence:"squares"}     — Phase 40 (SPELL-05): Map the Floor's window — the `spell:reveal` c.timers record, while its phase is "effect"
 *   - flight {polarity:"good", flight:"charged", remaining:<sq>, cadence:"squares", source:<item display name>} — 260918-w4n: reported by the SAME generic live-item-effect loop as haste/invis/etc, only while a `fly`-kind record (Cloak of Flying OR Bracelet of Flight) is live; a ready-but-unused flight item yields NO flight chip, and a cooling one reports through the generic itemCooldown chip below like every other item
 *   - itemCooldown (Phase 39, GEAR-02, one per COOLING duration+cooldown item): {polarity:"good", item:<display name>, remaining:<sq left>}
 *   - staffCharges (Phase 39, GEAR-02, one per RECHARGING staff): {polarity:"good", item:<display name>, charges:<current>, max:<pool>, remaining:<sq left>}
 *   - affliction {polarity:"bad", kind:"Poison"|"Disease"|…}
 *   - darkness   {polarity:"bad", remaining:<sq left>}    — the persistent Darkness/phobia state
 *   - fearArmed  {polarity:"bad", phobia, trigger}         — Phase 41 (TERR-05): an ARMED terrain phobia waiting for the next fight; cleared when fight() consumes it
 *   - afraid     {polarity:"bad", remaining:<rounds>, phobia:<fear name>} — Phase 31 (user ruling 2026-09-16): the Afraid penalty from a triggered phobia in the CURRENT combat, only while combat.afraid > 0 (a Hardiness shrug-off shows nothing)
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
  for (const { key, act, rec } of liveItemEffects(c)) {
    if (act.kind === "fly") {
      out.push({ key: "flight", polarity: "good", flight: "charged", remaining: rec.left, cadence: rec.cadence, source: key });
      continue;
    }
    const chip = { key: act.kind, polarity: "good", remaining: rec.left, cadence: rec.cadence, source: key };
    if (act.kind === "might" && typeof act.might === "number") chip.might = act.might;
    out.push(chip);
  }

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
  // c.timers via engine/effects.js#startEffect).
  const rev = c.timers && c.timers["spell:reveal"];
  if (rev && rev.phase === "effect" && rev.left > 0) {
    out.push({ key: "reveal", polarity: "good", remaining: rev.left, cadence: "squares" });
  }

  // Phase 39 (GEAR-02): one `itemCooldown` chip per duration+cooldown item
  // CURRENTLY cooling (an `item:<key>` record in `phase: "cooldown"`),
  // insertion order. 260918-w4n: the Cloak of Flying / Bracelet of Flight
  // exclusion is removed — a cooling flight item is reported here exactly
  // like every other cooling item (no more dedicated flight cooldown chip).
  for (const id of Object.keys(c.timers || {})) {
    if (!id.startsWith("item:")) continue;
    const rec = c.timers[id];
    if (!rec || rec.phase !== "cooldown") continue;
    const key = id.slice("item:".length);
    out.push({ key: "itemCooldown", polarity: "good", item: key, remaining: rec.left });
  }

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
  if (c.sub === "Illusionist" && c.level < 3) idx = 0; // d20 until level three
  // Phase 39 (GEAR-02): the retired c.acute counter — a live "acute" item
  // effect (Potion of Acuteness) reads through c.timers now.
  if (itemEffectActive(c, "acute")) idx = 4; // strike on a d6
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

// Phase 41 (TERR-03) — DARK_VIEW_RADIUS: while standing on a dark square
// without Night Vision, a light effect (e.g. the Amulet of Light) or a lit
// torch, the map shows only the 3x3 window around the party (Chebyshev
// distance <= 1) — a pure RENDER filter, never a mutation of `cell.seen`/
// `cell.spellSeen`. The waiver set is the SAME one revealRadius (Night
// Vision) and engine/movement.js's darkFor-dispel check (`eff(c, "light") >
// 0`) already use, plus a lit torch (`itemEffectActive(c, "lit")`) — "a
// light effect" means one thing everywhere in this codebase.
export const DARK_VIEW_RADIUS = 1;

/**
 * mapViewRadius(state) — TERR-03: `Infinity` (show every already-`seen`
 * cell) unless the player is currently in the dark (`inDark(state)`) and
 * carries none of the three waivers above (Night Vision, a live Amulet of
 * Light, or a lit torch), in which case `DARK_VIEW_RADIUS` (1) — a 3x3
 * window. The shell (`draw()`) re-reads this fresh on EVERY paint — never a
 * stored flag (research Pitfall 4) — so leaving the dark square restores
 * the full explored view for free: nothing was ever taken away from
 * `seen`, only hidden at render time. Map the Floor's `spellSeen` window
 * keeps counting under this filter — it is orthogonal, the filter only
 * HIDES, it never pauses the reveal-window's own squares-cadence countdown
 * (CONTEXT routine decision). Pure, zero rng, mutates nothing.
 */
export function mapViewRadius(state) {
  if (!inDark(state)) return Infinity;
  const c = state.c;
  if (skill(c, "Night Vision")) return Infinity;
  if (eff(c, "light") > 0) return Infinity;
  if (itemEffectActive(c, "lit")) return Infinity;
  return DARK_VIEW_RADIUS;
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
  const w = WEAPONS[base];
  return w ? w.need || 0 : 0;
}

/**
 * weaponCrit(c) — Phase 39 (GEAR-01): the die-roll range (1 or 2) that
 * doubles the character's own weapon damage — `WEAPONS[c.weapon].crit`, or 1
 * for an unrecognized/missing weapon (never throws on a tampered save's
 * `c.weapon` name). Pure, no rng.
 */
export function weaponCrit(c) {
  const w = c && WEAPONS[c.weapon];
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
 * fleeBreakdown(c) — Phase 42 (FLEE-01/FLEE-02): the ONE flee-need rule,
 * mirroring foeToHitBreakdown's `{ name, delta }` shape so every surface
 * (the fight log, the rail, the combat submenu) narrates the SAME
 * modifier list without re-deriving the formula. Flee was ALREADY read
 * roll-high before Phase 73 (`d20 + bonus >= need`) — the mirror leaves this
 * function untouched; its caller folds `bonus` into the threshold the same
 * way every other modifier does. Builds `mods` in this fixed order, pushing
 * an entry ONLY when it is non-zero: Thief (+5, "the whole trade") -> class
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
 * critP = 0 for a noCrit character (Guard/Soldier/eff("noCrit")), else
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
 * `true` for a Guard/Soldier sub or a live `noCrit` effect (e.g. darkness);
 * `false` otherwise. Does NOT read state.floor's in-fight darkness rule —
 * that is engine/combat.js's own separate in-combat noCrit, untouched by
 * this extraction. Pure, no rng.
 */
export function noCritFor(c) {
  return c.sub === "Guard" || c.sub === "Soldier" || eff(c, "noCrit") > 0;
}

export function expectedStrike(c, base, bonus = 0, prof = 0) {
  const w = WEAPONS[base];
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
  flat += 2 * eff(c, "size");
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
    const haveW = WEAPONS[c.weapon];
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
 * (inspired) and state.floor (darkness); ports mazeworld.html toHit() (lines
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
  if (state.combat && state.combat.inspired) h += state.combat.inspired;
  h += eff(c, "toHit");
  h += weaponNeedMod(c);
  h = Math.max(1, h);
  // Phase 19 D-10: dazed — you need 2 lower to hit, never below 1; the
  // weakened kind is applied at playerStrike's damage line in combat.js, not here.
  if (c.foeEffect && c.foeEffect.kind === "dazed" && c.foeEffect.rounds > 0) h = Math.max(1, h - 2);
  if (inDark(state) && !skill(c, "Night Vision") && !c.senses) h = Math.min(h, 2);
  return h;
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
 * (combat.inspired, eff(c,"toHit"), the dazed/darkness overrides) — a member
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
 */
export function foeDie(c, f) {
  const R = RACES[c.race];
  const step = R.foeStrikeStep || 0;
  return Math.max(8, STRIKE_DICE[clamp(f.lvl - 1 + step, 0, 4)]);
}

/**
 * foeToHitVs(state, vs) — the foe's to-hit need against this character: a
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
 * ANY `vs`, since it covers the whole side), Sidestep (-2, `vs === "hero"`
 * only — the hero's own body), and Smoke (an override to `h = 1`, `vs ===
 * "hero"` only). Battle Roar's -2 stacks with the Guard -1 exactly the way
 * Agility used to. `vs` is `"hero"` (default — every pre-Phase-38 caller) or
 * `"member"` (foeTurn's party-member branch — Battle Roar still applies,
 * Sidestep/Smoke do not, since those are the hero's own body).
 *
 * Phase 38 (ABIL-05): Battle Roar's term also honours ANY live party
 * member's own Battle Roar (`partyEffectActive`) — a Joiner's Battle Roar
 * covers the whole side exactly like the hero's. False on every fixture (no
 * fixture carries a party).
 */
export function foeToHitVs(state, vs = "hero") {
  const c = state.c;
  const R = RACES[c.race];
  let h = 5;
  if (R.foeToHit) h += R.foeToHit;
  if (c.sub === "Acrobat") h = 3;
  if (c.sub === "Guard") h -= 1;
  h += eff(c, "foeToHit");
  // Phase 54 (BAND-02, USER RULING D): FOE_ACCURACY (both vs "hero" and
  // "member") + CLASS_MITIGATION.Thief.evasion (vs "hero" only — the hero's
  // own body). Identity 0 for both is a structural no-op.
  h += foeAccuracyFor();
  // CLASS_MITIGATION.Thief.evasion (vs hero only) is SUBTRACTED from the
  // foe's need: a positive evasion makes the Thief harder to hit. Phase 72,
  // ROLL-01 (d), user ruling 2026-09-24; identity 0 is a structural no-op.
  if (vs === "hero" && c.cls === "Thief") h -= classEvasionFor(c);
  if (abilityEffectActive(c, "battleRoar") || partyEffectActive(state, "battleRoar")) h -= 2;
  if (vs === "hero" && abilityEffectActive(c, "sidestep")) h -= 2;
  if (vs === "hero" && abilityEffectActive(c, "smoke")) h = 1;
  if (c.mirror > 0) h = 1; // Mirror Self
  // Phase 39 (GEAR-02): the retired c.invis counter — a live "invis" item
  // effect (Cloak/potion/staff of invisibility) reads through c.timers.
  if (itemEffectActive(c, "invis")) h = 1; // invisible
  return Math.max(1, h);
}

/**
 * foeToHitBreakdown(state, vs) — Phase 25 (FEED-01, additive
 * payload): a narration-only breakdown of foeToHitVs's own arithmetic (the
 * foe's need is a count of winning faces, read roll-high — see foeToHitVs),
 * reproducing every step in the SAME order and recording a `{ name, delta }`
 * entry for every step that actually changed the running value (delta =
 * after − before, so an override such as Acrobat's `h = 3` records `3 -
 * hBefore`, not a raw assignment). Returns `{ need, mods }` where `need`
 * MUST always equal `foeToHitVs(state, vs)` — this function reads exactly
 * the same fields (`c.race`, `c.sub`, skill/eff reads, the three
 * `abilityEffectActive` terms, `c.mirror`, `c.invis`) via the same helpers,
 * so the two can never diverge for any (race, sub, timers, vs) combination;
 * test/unit/feedback-payload.test.js proves this by matrix. Pure (no rng, no
 * mutation) — this is a narration helper, not a second source of truth:
 * foeToHitVs's own body is left untouched (zero risk) rather than delegating
 * to this function.
 */
export function foeToHitBreakdown(state, vs = "hero") {
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
  // Phase 54 (BAND-02, USER RULING D): the SAME accuracy/evasion terms
  // foeToHitVs applies above, recorded only when non-zero.
  const accuracy = foeAccuracyFor();
  if (accuracy) {
    const before = h;
    h += accuracy;
    if (h !== before) mods.push({ name: "accuracy", delta: h - before });
  }
  // CLASS_MITIGATION.Thief.evasion (vs hero only) is SUBTRACTED from the
  // foe's need: a positive evasion makes the Thief harder to hit. Phase 72,
  // ROLL-01 (d), user ruling 2026-09-24; identity 0 is a structural no-op.
  if (vs === "hero" && c.cls === "Thief") {
    const evasion = classEvasionFor(c);
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
  if (vs === "hero" && abilityEffectActive(c, "sidestep")) {
    const before = h;
    h -= 2;
    if (h !== before) mods.push({ name: "Sidestep", delta: h - before });
  }
  if (vs === "hero" && abilityEffectActive(c, "smoke")) {
    const before = h;
    h = 1;
    if (h !== before) mods.push({ name: "Smoke", delta: h - before });
  }
  if (c.mirror > 0) {
    const before = h;
    h = 1; // Mirror Self
    if (h !== before) mods.push({ name: "Mirror Self", delta: h - before });
  }
  // Phase 39 (GEAR-02): the retired c.invis counter — read through c.timers.
  if (itemEffectActive(c, "invis")) {
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
  // Phase 39 (GEAR-02): the retired never-expiring c.might += 8/4 potion
  // write — a live Strength/Enlarge potion effect now reads through
  // c.timers (potionMight), additive alongside the spell's own c.might.
  d += potionMight(c);
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
 * single d20 that resists the effect on 22 − intel through 20 (`intel - 1`
 * winning faces, the top of the die). Below that threshold, NOTHING is
 * rolled at all — this early-out is the DETERMINISM GATE: callers are
 * expected to invoke this only when a resistible spell/ability is actually
 * firing, so the draw stays fully gated (e.g. the cast-damage parity
 * fixture's Shriek has intel 1, so it never enters the `rolled` branch and
 * consumes zero extra rng).
 *
 * Phase 73 (ROLL-05): the draw itself now goes through the ONE roll-high
 * check helper below (`rollCheck` on a d20, threshold `atLeastFor(intel - 1,
 * 20)`) — draws exactly the same single d20, in the same position, as the
 * old `rng.d(20)`; the mirrored `roll` (dieN + 1 − the raw draw) resists at
 * `roll >= atLeast`, which is `raw <= intel - 1`, i.e. `raw < intel` —
 * byte-identical to the old `roll < intel` reading for every possible draw.
 *
 * Returns `{ rolled, resisted, roll, atLeast, dieN }`: `rolled` is an
 * additive field beyond p.25's `{ resisted, roll }` so a caller can tell "no
 * roll happened" (intel < 12) apart from "rolled and failed to resist"
 * (`roll` would otherwise be indistinguishable from `undefined` in an
 * untyped caller); `atLeast`/`dieN` are the roll-high triple every
 * roll-carrying event now spreads (see engine/dice.js#rollFields). Pure
 * w.r.t. everything but the single gated rng.d(20) draw; never mutates its
 * arguments.
 */
export function resistRoll(rng, intel) {
  if ((intel ?? 0) < 12) return { rolled: false, resisted: false, roll: undefined };
  const check = rollCheck(rng, 20, atLeastFor(intel - 1, 20));
  return { rolled: true, resisted: check.ok, roll: check.roll, atLeast: check.atLeast, dieN: check.dieN };
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
 */
export function fluency(c) {
  return eff(c, "tongue") > 0 ? 1 : 0;
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
 * DAMAGE_SPELL_KINDS — Phase 40 (SPELL-04, DELIBERATE RULES CHANGE,
 * 2026-09-18): the day-one guarantee narrows from "any ATTACK_SPELL_KINDS
 * member" (Phase 23) to "a spell that actually deals damage" — the user's
 * own ruling (40-CONTEXT.md Area 3) singled out that a small summon counts
 * as a damage SOURCE, not a damage KIND, so it is carried by dealsDamage's
 * separate `sp.lesser` check below, not folded into this set.
 *
 * Deliberate exclusions, matching the research finding this plan closes:
 *   - Summon / Phantom Host (`kind: "summon"`) do NOT count on their own —
 *     ROADMAP SC-3 says Summoner/Illusionist "additionally qualify" via
 *     their own overrides/grants, not that every summon spell is a damage
 *     spell; a Summoner's Lesser Summon is a GRANT (engine/character.js#
 *     rollGrimoire), not a kind-based inclusion here.
 *   - Doze / Stun / Weaken (`status`/`stun`/`weaken`) do NOT count — they
 *     disable, they never move a foe's wp.
 * ATTACK_SPELL_KINDS above is UNTOUCHED by this addition — it still gates
 * the Wizard melee-refusal rule and member/ally casts, a different
 * question ("is this a combat spell to lean on") from "does this spell
 * deal damage".
 */
export const DAMAGE_SPELL_KINDS = new Set(["thrown", "dot", "acid", "volley", "quake", "death"]);

/**
 * dealsDamage(sp) — does casting this spell deal damage to a foe? True for
 * any DAMAGE_SPELL_KINDS member, OR any spell flagged `lesser: true`
 * (Lesser Summon — the Summoner's small, safe, guaranteed day-one damage
 * source per the user's ruling). Pure read, no rng, no mutation.
 */
export function dealsDamage(sp) {
  return DAMAGE_SPELL_KINDS.has(sp.kind) || sp.lesser === true;
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
