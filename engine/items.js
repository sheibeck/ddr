// engine/items.js
//
// Pure, RNG-injected item/treasure helpers (ENG-01, ENG-03). Ports the
// prototype's carried-treasure section (mazeworld.html lines 1872-1997):
// eff/giveItem/gainWilmst/hasPicks, the rollJewel/rollCloak/rollStaff/
// rollBlade/rollMailPiece/rollTreasureItem treasure rollers, takeItem's
// weapon/armor equip-swap, itemReady, and useItem. Every `D()`/`pick()` call
// is replaced by the injected engine rng; every `say()`/`evt()` narration
// call becomes a plain `{type, ...}` event pushed onto the caller-supplied
// `events` array. Everything written onto `state.c.items` or returned by a
// roller is plain JSON — the structuredClone in applyAction (01-05) throws
// immediately if a function leaf ever sneaks back in.
//
// `eff` already lives in engine/derived.js (other derived numbers depend on
// it) — re-exported here so item-domain callers have one place to import
// item/treasure helpers from, without duplicating the implementation.

import {
  eff,
  skill,
  slotItems,
  takesBagSlot,
  afraidDamage,
  slotFor,
  WORN_SLOTS,
  WORN_KEYS_OF,
  freeWornKey,
  expectedStrike,
  activationFor,
  itemTimerId,
  chargesTimerId,
  carriedItems,
  hasTool,
  inDark,
  wieldedStaff,
  heroSize,
  SIZE_DAMAGE_PER_STEP,
  SOURCE_SLOTS,
  PARTY_WIDE_ITEM_EFFECTS,
  sourceSlotItem,
  effectSourceOf,
  liveItemEffects,
  healTicksDue,
  healTicksLeft,
} from "./derived.js";
import { rollDice, rollCheck, atLeastFor, rollFields } from "./dice.js";
import { startEffect, startCooldown, isReady, remaining, endEffectEarly } from "./effects.js";
import { die } from "./death.js";
import { derivedRng } from "./rng.js";
// Circular with engine/combat.js (combat.js imports takeItem/gainWilmst/
// rollTreasureItem/LOOT_DIVISOR from here) is safe: both modules only touch
// each other's bindings from inside function bodies invoked at RUNTIME,
// never at module-evaluation time, and every export on both sides is a
// hoisted `function` declaration — by the time useItem()/killFoe() actually
// run, the whole module graph has finished loading. This closes the gap
// 01-06 deliberately left open (its useItem did minimal wp/alive/kills
// bookkeeping for stone/fire since killFoe didn't exist yet); now that
// combat.js owns the real killFoe, useItem calls it for full parity (loot,
// skill points, checkLevel) instead of the old bookkeeping-only stand-in.
// Phase 88 (ITEM-02): items.js <-> movement.js is the same runtime-only shape
// (movement.js imports narrateTimerTransitions/toolIndex from here; items.js
// calls resolveEtherEnd only inside endSourceEffects, never at module
// evaluation time).
import { resolveEtherEnd } from "./movement.js";
import { killFoe, refuseIfPending, liveFoes, endCombat, resistControl, holdFoe, foeResistsSpell, roomWeakenResists, freezeFoe } from "./combat.js";
// RULES-18 (Phase 75.3): the control-at-depth dials the freeze / gas / stone /
// weaken cases below read (difficulty.js imports nothing from engine/).
import { controlHoldRoundsFor, controlCapRounds } from "./difficulty.js";
// Phase 18 (D-09/CANON-01): the fire effect below routes through the shared
// foe-damage seam. This edge is NOT part of the circular-import concern
// above — engine/foeDamage.js imports only ../content/index.js, never
// ./combat.js or ./items.js, so no cycle is introduced.
import { damageFoe } from "./foeDamage.js";
import {
  JEWELRY,
  CLOAKS,
  STAVES,
  BLADE_NAMES,
  WEAPONS,
  WEAPON_MAX,
  ARMORS,
  MAGIC_ARMOR_TABLE,
  WEAPON_BONUS_TABLE,
  RACES,
  BAGS,
  BAG_ORDER,
  BAG_FLOORS,
  BAG_ITEMS,
  TREASURE_ACTIVATION_OF,
  ACTIVATION_OF,
  TOOLS,
  TOOL_ORDER,
  TOOL_LOOT_WEIGHTS,
} from "../content/index.js";

export { eff, slotItems };

/* ---------------- carried treasure ---------------- */

/**
 * giveItem(state, it, quiet, events) — adds `it` to the character's carried
 * items, applying any flat `wp` effect immediately. Ports mazeworld.html
 * giveItem() (lines 1877-1882).
 */
export function giveItem(state, it, quiet, events = []) {
  const c = state.c;
  c.items = c.items || [];
  c.items.push(it);
  if (it.eff && it.eff.wp) {
    c.maxWP += it.eff.wp;
    c.wp += it.eff.wp;
  }
  if (!quiet) events.push({ type: "itemGiven", item: it });
  return events;
}

/* The book's prices are modest (a long sword 500, leather 500, a healing
   potion 150) and its starting purses match them. The loot numbers were
   mine and ran ten times too rich, so found coin is divided by ten. Amounts
   the book states outright are left alone. Exported so engine/combat.js's
   killFoe can share the exact same divisor rather than duplicating it. */
export const LOOT_DIVISOR = 10;

/**
 * gainWilmst(state, n, why, rng, events) — adds gold, scaled by the
 * character's `greed` item effects, with a Pickpocket's extra take rolled
 * via the injected rng. Ports mazeworld.html gainWilmst() (lines 1887-1898).
 */
export function gainWilmst(state, n, why, rng, events = []) {
  const c = state.c;
  let amt = Math.round(n * (1 + 0.5 * eff(c, "greed")));
  if (c.sub === "Pickpocket") {
    const extra = Math.round(((rng.d(10) + rng.d(10)) * 10 * state.floor.depth) / LOOT_DIVISOR) + rng.d(4); // roll:amount
    amt += extra;
    events.push({ type: "goldGained", amount: extra, why: "pickpocket" });
  }
  c.gold += amt;
  events.push({ type: "goldGained", amount: amt, why: why || null });
  return amt;
}

/** hasPicks(c) — does the character already carry lockpicks? */
export function hasPicks(c) {
  return (c.items || []).some((i) => i.kind === "picks");
}

/* ---------------- treasure rollers ---------------- */

export function rollJewel(rng) {
  return Object.assign({ kind: "jewel" }, JEWELRY[rng.d(8) - 1]); // roll:selection
}

export function rollCloak(rng) {
  // 260918-w4n: the dropped healing cloak leaves CLOAKS at 7 rows — this
  // draws rng.d(CLOAKS.length) (still ONE gen.next() draw, rng cursor
  // unchanged) instead of the old literal d8. rollJewel/rollStaff are left at
  // their literal 8 — their own tables are still 8 rows.
  return Object.assign({ kind: "cloak" }, CLOAKS[rng.d(CLOAKS.length) - 1]); // roll:selection
}

export function rollStaff(rng) {
  const row = STAVES[rng.d(8) - 1]; // roll:selection
  // Phase 39 (GEAR-02): the old every-250-squares cooldown field is retired
  // — a staff now carries a charge pool (`charges`), looked up by name from
  // the content declaration; the same single `rng.d(8)` draw as before.
  return Object.assign({ kind: "staff", charges: TREASURE_ACTIVATION_OF[row.n].charges }, row);
}

/** Magical Weapons, p.48: the weapon table, then d6 on the bonus table. */
export function rollBlade(rng, depth, magical) {
  const base = rng.pick(Object.keys(WEAPONS));
  if (!magical) return { kind: "weapon", n: base, base, bonus: 0, txt: WEAPONS[base].lab };
  const b = rollDice(rng, WEAPON_BONUS_TABLE[rng.d(6) - 1]); // roll:selection
  return {
    kind: "weapon",
    n: `${rng.pick(BLADE_NAMES)}, a ${base.toLowerCase()}`,
    base,
    bonus: b,
    txt: `${WEAPONS[base].lab} +${b}`,
  };
}

/** Magic Armor, p.48: the armour table, then d6 for the AR and WP bonus. */
export function rollMailPiece(rng) {
  const a = rng.pick(ARMORS);
  const m = MAGIC_ARMOR_TABLE[rng.d(6) - 1]; // roll:selection
  return {
    kind: "armor",
    n: `Warded ${a.name.toLowerCase()}`,
    armor: a.name,
    ar: a.ar + m.ar,
    wp: a.wp + m.wp,
    min: a.min,
    cls: a.cls,
    txt: `AR ${a.ar + m.ar}, ${a.wp + m.wp} hp`,
  };
}

/**
 * toolItem(key) — Phase 39 (GEAR-05): a FRESH `kind:"tool"` bag item for
 * `key` ("torch"|"rope"|"ladder"), built from content/tools.js#TOOLS. Never
 * carries `cost`/`fromTier`/`feat`/`act` (store/loot/engine-gate-only
 * content fields) — only `n`/`txt` and, for the torch, `use` (its useItem
 * activation kind; rope/ladder have none — they are spent through
 * engine/movement.js#useTool, never useItem).
 */
export function toolItem(key) {
  const t = TOOLS[key];
  const it = { kind: "tool", tool: key, n: t.n, txt: t.txt };
  if (t.use) it.use = t.use;
  return it;
}

/** toolIndex(c, tool) — the bag index of `c`'s `tool` item, or -1. Pure. */
export function toolIndex(c, tool) {
  return (c.items || []).findIndex((it) => it && it.kind === "tool" && it.tool === tool);
}

/**
 * pickLootTool(toolRng, depth, c) — Phase 39 (GEAR-05), module-private: the
 * weighted tool pick for rollTreasureItem's derived-stream loot row below.
 * NEVER consults the main rng — `toolRng` is the caller's own separate
 * `derivedRng` instance. Candidates: TOOL_ORDER filtered to depth-legal (a
 * Ladder only from depth 2, `depth >= 2 || key !== "ladder"`) and not
 * already carried (`!hasTool(c, key)`); a weighted pick via
 * `toolRng.d(totalWeight)` walking cumulative TOOL_LOOT_WEIGHTS; `null` when
 * no candidate remains (every eligible tool already carried).
 */
function pickLootTool(toolRng, depth, c) {
  const candidates = TOOL_ORDER.filter((key) => (depth >= 2 || key !== "ladder") && !hasTool(c, key));
  if (!candidates.length) return null;
  const totalWeight = candidates.reduce((sum, key) => sum + TOOL_LOOT_WEIGHTS[key], 0);
  let r = toolRng.d(totalWeight); // roll:selection
  for (const key of candidates) {
    r -= TOOL_LOOT_WEIGHTS[key];
    if (r <= 0) return key; // roll:selection
  }
  return candidates[candidates.length - 1]; // defensive: unreachable given totalWeight's derivation
}

/**
 * rollTreasureItem(rng, depth, c) — the depth-scaled treasure roll. `c` is
 * the OPTIONAL carrying character, consulted for the "already has lockpicks"
 * gate (ports mazeworld.html's `!hasPicks()` global read) and the tool
 * haveOne gate below; a caller with no character in hand (as the acceptance
 * test does) is treated as carrying neither, matching the prototype's
 * fresh-character case. Ports mazeworld.html rollTreasureItem() (lines
 * 1919-1927).
 *
 * Phase 39 (GEAR-05): immediately after the lockpick gate and BEFORE the
 * `rng.d(10)` table roll, a derived rng stream (STATE.md engine-gate
 * amendment) decides the tool loot row — keyed by the MAIN cursor
 * (`rng.getState()`) so it is deterministic per replay, but the stream
 * itself is a fully separate `derivedRng` instance: it NEVER draws from the
 * caller's `rng`. The no-tool-fires path therefore advances the main rng by
 * EXACTLY the same number of draws as before this plan; when it fires, the
 * main rng advances by exactly the one lockpick d12 draw above (the `d(8)`
 * and any weighted pick both run on `toolRng`, not `rng`). Both real
 * production callers (engine/combat.js#killFoe, engine/encounters.js's find
 * handlers) always thread a real `makeRng(state.rngState)` instance, which
 * always implements `getState`; the `typeof` guard below only ever matters
 * for a pre-existing bare `{d,pick,shuffle}` test double passed directly by
 * an unrelated unit test — such a double never had a tool-loot cursor to
 * key from, so this mechanic is a structural no-op for it (byte-identical
 * to the pre-plan behavior), never a crash.
 */
export function rollTreasureItem(rng, depth, c) {
  if (!hasPicks(c || {}) && rng.d(12) === 1) { // roll:selection
    return { kind: "picks", n: "Lockpicks", txt: "6–10 on d10 against any lock" };
  }
  if (typeof rng.getState === "function") {
    const toolRng = derivedRng(rng.getState(), "tool", depth);
    if (toolRng.d(8) === 1) { // roll:selection
      const key = pickLootTool(toolRng, depth, c || {});
      if (key) return toolItem(key);
    }
  }
  const r = rng.d(10); // roll:selection
  if (r <= 3) return rollBlade(rng, depth, true); // roll:selection
  if (r <= 5) return rollMailPiece(rng); // roll:selection
  if (r <= 7) return rollJewel(rng); // roll:selection
  if (r <= 9) return rollCloak(rng); // roll:selection
  return rollStaff(rng);
}

/* ---------------- equip legality (ECON-05) ---------------- */

/**
 * classLetter(c) — the F/T/M weapon/armor class letter for `c`. The prototype
 * derived this inline in three separate places (takeItem's weapon gate, its
 * armor gate, and openStore's stock build); factored out here so the equip
 * legality predicates below and the store buy path (via takeItem) all read the
 * exact same rule.
 */
function classLetter(c) {
  return c.cls === "Fighter" ? "F" : c.cls === "Thief" ? "T" : "M";
}

/**
 * canEquipWeapon(c, it) — ECON-05 (Phase 13): is weapon item `it` LEGAL for
 * `c` to wield? The class/subclass gate ONLY (does NOT consider whether it is
 * a strictly-better upgrade — that is a separate takeItem concern the deliberate
 * equipItem change drops). Extracted verbatim from takeItem's weapon gate so
 * `equipItem` and the store buy path (buyWeapon → takeItem) share ONE source of
 * truth: the character's class must be listed in WEAPONS[it.base].cls, and an
 * Acrobat may wield only a Dagger. Pure, no rng, no mutation.
 */
export function canEquipWeapon(c, it) {
  return !!(
    WEAPONS[it.base] &&
    WEAPONS[it.base].cls.includes(classLetter(c)) &&
    (c.sub !== "Acrobat" || it.base === "Dagger")
  );
}

/**
 * weaponRefusalReason(c, it) — Phase 25 (FEED-02): the single source of
 * truth for WHY weapon item `it` is illegal for `c` to wield, mirroring
 * armorRefusalReason's shape (`null` when legal). Checked in order: `null`
 * when canEquipWeapon(c, it) is already true; otherwise `"acrobat"` when the
 * ONLY failing clause is the Acrobat dagger-only rule (the character's class
 * letter IS listed in WEAPONS[it.base].cls, but c.sub is Acrobat and it.base
 * is not Dagger); else `"wrongClass"` (the class letter itself is not
 * listed — an Acrobat is always Thief-classed, so this is the general
 * class-gate failure for every OTHER sub/class combination). Pure, no rng,
 * no mutation.
 */
export function weaponRefusalReason(c, it) {
  if (canEquipWeapon(c, it)) return null;
  const classOk = !!(WEAPONS[it.base] && WEAPONS[it.base].cls.includes(classLetter(c)));
  if (classOk && c.sub === "Acrobat" && it.base !== "Dagger") return "acrobat";
  return "wrongClass";
}

/**
 * armorRefusalReason(c, it) — ECON-05 (Phase 13) + DELIBERATE RULES CHANGE
 * (Phase 24, 2026-09-14, IDENT-07): the single source of truth for WHY armor
 * item `it` is illegal for `c` to wear/be sold, or `null` if it is legal.
 * Checked in order: `"noArmor"` (a noArmor race, e.g. Fridgian, can wear
 * nothing), `"woodsman"` (a Woodsman's "no mail, no plate" bad — anything
 * heavier than Studded, i.e. `it.ar > 10`, is refused even though a Fighter
 * would otherwise be class-legal for it), then `"tooHeavy"` (the existing
 * class/Heft rule fails), else `null`. `canEquipArmor` below is now a thin
 * wrapper so takeItem/equipItem/the store filter all read this ONE rule.
 * Pure, no rng, no mutation.
 */
export function armorRefusalReason(c, it) {
  if (RACES[c.race].noArmor) return "noArmor";
  if (c.sub === "Woodsman" && it.ar > 10) return "woodsman";
  const legal = it.cls.includes(classLetter(c)) || (c.cls === "Thief" && skill(c, "Heft") && it.ar <= 12);
  return legal ? null : "tooHeavy";
}

/**
 * canEquipArmor(c, it) — ECON-05 (Phase 13): is armor item `it` LEGAL for `c`
 * to wear? The race/class/sub gate ONLY (not the strictly-better AR check).
 * Delegates entirely to armorRefusalReason above (byte-identical behaviour
 * for everyone but a Woodsman offered Mail/Plate). Pure, no rng, no mutation.
 */
export function canEquipArmor(c, it) {
  return armorRefusalReason(c, it) === null;
}

/* ---------------- equip / consume ---------------- */

/**
 * weaponUpgradeDelta(c, it) — how much MORE expected damage-per-swing weapon
 * item `it` would give `c` than the currently-wielded weapon (may be <= 0).
 * The exact rule takeItem's weapon branch uses to decide "is this better" —
 * extracted here (Phase 29, LOOT-03) so the shell's lootCompare view-model
 * and the tuning bot can read the SAME arithmetic instead of restating it.
 *
 * Phase 39 (GEAR-01): re-based on engine/derived.js#expectedStrike — under
 * the need/crit axes, a weapon's raw max damage no longer tells you whether
 * it is actually better (a heavy weapon with a lower to-hit need can lose to
 * a light weapon's higher crit chance). This is now the ONE "is this weapon
 * better" rule takeItem, lootCompare, and the tuning bot all share. Rounded
 * to 2 decimals (expectedStrike's own fractional-probability output is
 * otherwise a noisy float). Pure, no rng.
 */
export function weaponUpgradeDelta(c, it) {
  const candidate = expectedStrike(c, it.base, it.bonus || 0, 0);
  const current = expectedStrike(c, c.weapon, c.magicWpn || 0, c.prof || 0);
  return Math.round((candidate - current) * 100) / 100;
}

/**
 * armorUpgradeDelta(c, it) — how much MORE AR armor item `it` would give `c`
 * than the currently-worn armor (may be <= 0). Mirrors weaponUpgradeDelta
 * above for the armor branch. Pure, no rng.
 */
export function armorUpgradeDelta(c, it) {
  return it.ar - c.ar;
}

/**
 * autoWearSlot(state, it) — Phase 37 (GEAR-03), rewritten 260918-wy1
 * (jewelry-merge): pure predicate — does `it` auto-wear into an EMPTY key
 * right now? Returns the concrete KEY it would auto-wear into when yes
 * (the first free key of its family, via `freeWornKey`), or `null` when no:
 * `state.c` carries no own `worn` key (a legacy state — never auto-wears),
 * `it` is not an object, `slotFor(it)` is null (not a slot item at all —
 * 260918-w4n: a staff is ALWAYS null here, `slotFor` never resolves one), or
 * every key of its family is already occupied (both jewelry keys full, or
 * the cloak key full). Pure, no rng, no mutation.
 */
export function autoWearSlot(state, it) {
  const c = state && state.c;
  if (!c || typeof c !== "object" || !("worn" in c) || !c.worn || typeof c.worn !== "object") return null;
  if (!it || typeof it !== "object") return null;
  const family = slotFor(it);
  if (!family) return null;
  return freeWornKey(c, family);
}

/**
 * gearLockReason(state) — Phase 61 (GRULE-01): the combat gear lock's ONE
 * read-only predicate. Returns the string `"combat"` while a fight is up —
 * `state.combat` set, the pending Fight! preview (`combat.pending`)
 * INCLUDED — or `null` otherwise. Once a foe is in front of you, you fight
 * with what you walked in with; loot is unaffected because `state.combat`
 * is cleared before the Victory loot card (engine/combat.js#endCombat).
 * Phase 63's action sheet reads this SAME predicate to grey its EQUIP/SWAP/
 * UNEQUIP rows with the engine's own reason, rather than re-deriving the
 * rule. Pure, no rng, no mutation.
 */
export function gearLockReason(state) {
  return state && state.combat ? "combat" : null;
}

/**
 * refuseGear(state, verb, extra, events) — Phase 61 (GRULE-01), module-
 * private: when `gearLockReason(state)` is non-null, pushes
 * `{ type: "gearRefused", verb, reason, ...extra }` (extra keys included
 * only when their value is not undefined/null, mirroring itemEquipped's
 * additive `replaced` precedent) and returns `true`; otherwise returns
 * `false` and pushes nothing. Every gated verb below calls this FIRST
 * (before any mutation), so a refused gear change is always a pure no-op
 * plus exactly one event, and never burns an rng draw.
 */
function refuseGear(state, verb, extra, events) {
  const reason = gearLockReason(state);
  if (!reason) return false;
  const evt = { type: "gearRefused", verb, reason };
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value !== undefined && value !== null) evt[key] = value;
    }
  }
  events.push(evt);
  return true;
}

/**
 * endSourceEffects(state, sheet, events, opts) — Phase 88 (ITEM-02): THE one
 * early-end mechanism for a timed item effect. Every gear-change path (take
 * off, swap, the Pilfer fumble, and dropItem/sellItem's sweep) calls this
 * rather than carrying a check of its own.
 *
 * A live item effect is linked to the slot it was started from (the record's
 * `src: { slot, n }`, stamped by applyActivation). This ends every live linked
 * record on `sheet` whose slot is in `opts.slots` (the slots THIS gear change
 * touched: an identical copy swapped into the slot still ends the effect, and
 * wearing an item into the OTHER jewelry slot does not) OR whose slot no
 * longer holds an item named `src.n` (the sweep: `dropItem`/`sellItem` pass no
 * slots and only ever catch a record whose item has already left). The hit
 * record goes through effects.js#endEffectEarly: the use is spent (effect
 * left + cd becomes the cooldown, so taking it off is never a free reset); a
 * charged staff's record has no cd, so it is removed, and the charge it cost
 * stays spent (this function never touches `it.charges` or a `charges:`
 * record). One `itemEffectEnded { item, kind, slot, why, left, ready,
 * party?, member? }` is pushed per ended record, in `sheet.timers` insertion
 * order, AFTER the caller's own gear event. `why` is `opts.why` for a touched
 * slot, "gone" for a sweep find. `party: true` marks a PARTY_WIDE_ITEM_EFFECTS
 * item (the Crystal Staff); `member` is the sheet's name when it is not the
 * hero (`state.c`).
 *
 * Phase 89 (ITEM-06): the helper also ends a LINKED ARMED CHARGE, the Pendant
 * of Fortitude's `sheet.halfNext = { slot, n }`, after the timers walk and by
 * the same rule (slot touched, or the slot no longer holds an item named `n`):
 * `halfNext` becomes false and one `itemEffectEnded { item, kind: "half", slot,
 * why, left: 0, ready, member? }` is pushed (`ready` is the Pendant's own
 * cooldown, read and never touched, so the use stays spent). A sheet with no
 * `timers` still reaches this pass.
 *
 * When an ended record was the hero's Cloak of Ether, the entombment rule
 * runs through movement.js#resolveEtherEnd (itemEffectEnded, then entombed,
 * then died); out of rock that is a no-op. `opts.rng` is the caller's main
 * rng (only an entombment's epitaph pick draws from it); with none a derived
 * stream is used. A Joiner's sheet never entombs anyone.
 *
 * `opts.quiet` ends records without events or entombment (88-02's load-time
 * reconciliation). Works on ANY character sheet; a null sheet, a sheet with
 * no timers, an empty slot or a record with no `src` is a silent no-op that
 * never throws and never creates `sheet.timers`. Idempotent: a second call
 * finds nothing live to end. Never draws on the main rng except as above.
 */
export function endSourceEffects(state, sheet, events = [], opts = {}) {
  if (!sheet || typeof sheet !== "object") return events;
  const timers = sheet.timers;
  const hasTimers = !!timers && typeof timers === "object" && !Array.isArray(timers);
  const o = opts && typeof opts === "object" ? opts : {};
  const slots = Array.isArray(o.slots) ? o.slots : [];
  const why = o.why ?? "gone";
  const quiet = o.quiet === true;
  const hero = !!state && sheet === state.c;
  let etherEnded = false;
  for (const id of hasTimers ? Object.keys(timers) : []) {
    if (!id.startsWith("item:")) continue;
    const rec = timers[id];
    if (!rec || rec.phase !== "effect" || !(rec.left > 0)) continue;
    const src = effectSourceOf(rec);
    if (!src) continue;
    const touched = slots.includes(src.slot);
    if (!touched) {
      const held = sourceSlotItem(sheet, src.slot);
      if (held && held.n === src.n) continue;
    }
    const key = id.slice("item:".length);
    const kind = ACTIVATION_OF[key]?.kind ?? null;
    // Phase 88 (ITEM-03): the heal ticks a heal-over-time window still owed,
    // read BEFORE the record is ended (an ended record has no window left).
    const ticksLeft = ACTIVATION_OF[key]?.hot ? healTicksLeft(ACTIVATION_OF[key], rec) : 0;
    const ended = endEffectEarly(sheet, id);
    if (!ended || quiet) continue;
    const evt = { type: "itemEffectEnded", item: key, kind, slot: src.slot, why: touched ? why : "gone", left: ended.left, ready: ended.ready };
    if (ACTIVATION_OF[key]?.hot) evt.ticks = ticksLeft;
    if (PARTY_WIDE_ITEM_EFFECTS.includes(key)) evt.party = true;
    if (state && !hero) evt.member = sheet.name;
    events.push(evt);
    if (kind === "ether") etherEnded = true;
  }
  // Phase 89 (ITEM-06): the Pendant of Fortitude's ARMED half-damage charge is
  // linked like a timer record: `sheet.halfNext = { slot, n }`. It disarms by
  // the same rule (its slot was touched, or no longer holds the Pendant). Only
  // the armed charge goes: the Pendant's 100-square cooldown record is never
  // touched, so the use stays spent and taking it off never readies it sooner.
  const armedHalf = sheet.halfNext;
  if (armedHalf && typeof armedHalf === "object" && !Array.isArray(armedHalf) && SOURCE_SLOTS.includes(armedHalf.slot) && typeof armedHalf.n === "string") {
    const touched = slots.includes(armedHalf.slot);
    const held = sourceSlotItem(sheet, armedHalf.slot);
    if (touched || !held || held.n !== armedHalf.n) {
      sheet.halfNext = false;
      if (!quiet) {
        const evt = { type: "itemEffectEnded", item: armedHalf.n, kind: "half", slot: armedHalf.slot, why: touched ? why : "gone", left: 0, ready: remaining(sheet, `item:${armedHalf.n}`) };
        if (state && !hero) evt.member = sheet.name;
        events.push(evt);
      }
    }
  }
  if (etherEnded && hero) {
    const rng = o.rng ?? derivedRng(Number.isInteger(state.rngState) ? state.rngState : 0, "gearEnd", Number.isInteger(state.acts) ? state.acts : 0);
    resolveEtherEnd(state, rng, events, o.now ?? Date.now);
  }
  return events;
}

/**
 * wearItem(state, it, slot, events) — Phase 37 (GEAR-03): assigns `it`
 * (the SAME object, never cloned) into `c.worn[slot]` and pushes
 * `{ type: "itemEquipped", item: it, slot }`. Deliberately does NOT apply
 * `eff.wp` — no JEWELRY/CLOAKS/STAVES row ever carries a `wp` key (Plan 01's
 * no-slot-row-carries-eff.wp tripwire test), so giveItem's flat-wp-on-pickup
 * rule has nothing to apply here. Adds no rng draw.
 *
 * Phase 61 (GRULE-01): `wearItem` stays an UNGATED internal primitive — it
 * is never dispatched directly by a player action. Every real caller is
 * either combat-gated above it (takeFind/takeLoot/takeAllLoot, via
 * `refuseGear`) or store-only (`takeItem`, which never runs mid-fight — the
 * store screen closes before a fight starts).
 */
export function wearItem(state, it, slot, events = [], rng = null) {
  state.c.worn[slot] = it;
  events.push({ type: "itemEquipped", item: it, slot });
  // Phase 88 (ITEM-02): whatever was linked to this slot ends ("swap").
  endSourceEffects(state, state.c, events, { slots: [slot], why: "swap", rng });
  return events;
}

/**
 * takeItem(state, it, events) — the weapon/armor equip-swap (only takes a
 * strictly-better item; staves require a Magic User; everything else goes
 * through giveItem). Ports mazeworld.html takeItem() (lines 1929-1955).
 * Re-pointed at the canEquipWeapon/canEquipArmor legality predicates above
 * (ECON-05) so its class/race gate is byte-identical to equipItem's — the
 * strictly-better AR/damage gate stays takeItem's own (the store's
 * buy=auto-equip convenience keeps it; equipItem deliberately drops it).
 * Phase 29 (LOOT-03): the "is this better" arithmetic itself now lives in
 * weaponUpgradeDelta/armorUpgradeDelta above so lootCompare can import the
 * exact same rule instead of restating it.
 * Phase 37 (GEAR-03): with `c.worn` present, a cloak/jewelry/staff item that
 * fits into an EMPTY slot auto-wears instead of landing in the bag (fewer
 * taps; mirrors the weapon/armor auto-equip spirit above). Legacy states
 * (no `c.worn`) fall straight through to giveItem, unchanged.
 */
export function takeItem(state, it, events = []) {
  const c = state.c;

  if (it.kind === "weapon") {
    const weaponReason = weaponRefusalReason(c, it);
    if (weaponReason) {
      events.push({ type: "itemRejected", item: it, reason: weaponReason });
      return events;
    }
    const delta = weaponUpgradeDelta(c, it);
    if (delta <= 0) {
      events.push({ type: "itemRejected", item: it, reason: "notBetter" });
      return events;
    }
    // Phase 61 (STORE-02): an additive `replaced` (the traded-in piece) —
    // computed BEFORE the equip mutation below, since wornWeaponItem(c)
    // reads the CURRENT weapon. takeItem's only live caller is the store's
    // deliverGear; the parity harness's legacy auto-take (comparables.js)
    // discards events, so this is a pure narration addition.
    const replaced = wornWeaponItem(c);
    events.push({ type: "itemTaken", item: it, ...(replaced ? { replaced } : {}) });
    c.weapon = it.base;
    c.prof = 0;
    c.magicWpn = it.bonus;
    // RULES-13 (Phase 75): leaving a wielded staff for an ordinary weapon
    // clears its wield state — defensive here, since economy.js#gearUpgrades
    // never treats a weapon as an upgrade while a staff is wielded, so this
    // branch is never actually reached mid-wield in play.
    delete c.staff;
    // Phase 88 (ITEM-02): the weapon slot changed hands.
    endSourceEffects(state, c, events, { slots: ["weapon"], why: "swap" });
    return events;
  }

  if (it.kind === "armor") {
    const armorReason = armorRefusalReason(c, it);
    if (armorReason) {
      events.push({ type: "itemRejected", item: it, reason: armorReason });
      return events;
    }
    if (armorUpgradeDelta(c, it) <= 0) {
      events.push({ type: "itemRejected", item: it, reason: "notBetter" });
      return events;
    }
    // Phase 61 (STORE-02): additive `replaced`, mirroring the weapon branch
    // above — computed before the equip mutation.
    // RULES-08 (Phase 75): additive `discarded`/`destroyed`, computed
    // alongside `replaced`, before the same mutation — wornArmorItem already
    // returns null for a destroyed piece, so `replaced` and `destroyedPiece`
    // are mutually exclusive (never both set on the same event).
    const replaced = wornArmorItem(c);
    const destroyedPiece = destroyedArmorPiece(c);
    events.push({
      type: "itemTaken",
      item: it,
      ...(replaced ? { replaced } : {}),
      ...(destroyedPiece ? { discarded: destroyedPiece, destroyed: true } : {}),
    });
    c.armor = it.armor;
    c.ar = it.ar;
    c.armorMin = it.min;
    c.armorMax = it.wp;
    c.armorWP = it.wp;
    c.patches = 0;
    return events;
  }

  // Phase 39 (GEAR-05): a tool never duplicates — mirrors the Lockpicks
  // `kind:"picks"` precedent (hasPicks/rollTreasureItem's lockpick gate
  // above), just item-keyed instead of kind-keyed since there are three
  // distinct tools.
  if (it.kind === "tool" && hasTool(c, it.tool)) {
    events.push({ type: "itemRejected", item: it, reason: "haveOne" });
    return events;
  }

  if (it.kind === "staff" && c.cls !== "Magic User") {
    events.push({ type: "itemRejected", item: it, reason: "wrongClass" });
    return events;
  }

  const slot = autoWearSlot(state, it);
  if (slot) {
    events.push({ type: "itemGiven", item: it });
    wearItem(state, it, slot, events);
    return events;
  }

  giveItem(state, it, false, events);
  return events;
}

/* ---------------- inventory actions (ECON-03/04/05, Phase 13) ---------------

   PLAYER-CHOICE carried-item management. The find callers
   (engine/encounters.js openChest/findGear/findMisc/meetFaerie) no longer
   auto-take the rolled item — they stash it in state.pendingFind (see
   encounters.js#offerFind) and the player accepts (takeFind) or declines
   (leaveFind) it. equipItem/unequipSlot/dropItem then manage the bag directly.
   All FIVE are PURE (no rng) — plain bookkeeping over c.items and the scalar
   equipped-weapon/armor fields, so they never shift the seeded rng cursor and
   are inherently parity-safe (no fixture drives them). Phase 29's pending
   LOOT pile handlers (offerLoot/takeLoot/leaveLoot/takeAllLoot/leaveAllLoot,
   below) are the same shape and the same PURE guarantee, over
   state.pendingLoot instead of state.pendingFind. The bag-slot cap
   (content/bags.js BAGS[c.bag].slots) is enforced HERE and ONLY here (Phase 12
   deliberately left giveItem/gainWilmst/takeItem uncapped to keep the frozen
   parity fixtures byte-identical).

   Phase 61 (GRULE-01): equipItem/unequipSlot/takeFind/takeLoot/takeAllLoot
   all gate on `refuseGear` FIRST (before any read that could matter) — while
   `state.combat` is set (the pending Fight! preview included), every one of
   them is a pure no-op plus one `gearRefused` event, zero rng, state
   untouched. `leaveFind`/`dropItem`/`leaveLoot`/`leaveAllLoot` stay UNGATED
   (declining or dropping something is never a gear change). */

/** bagCap(c) — the character's bag slot capacity, or Infinity if it carries no
 * bag key (a bag-less parity/test character is never capped — matches the
 * clampCarry gate in engine/derived.js). Exported (Phase 29) so lootCompare's
 * bagUsage view-model reads the same rule. */
export function bagCap(c) {
  return c.bag && BAGS[c.bag] ? BAGS[c.bag].slots : Infinity;
}

/**
 * canStow(c) — Phase 29 (LOOT-04): THE capacity predicate. Every stow path
 * (takeFind/takeLoot/unequipSlot/the store's lockpick buy) and the shell's
 * bag-full readouts all read this one line instead of an ad-hoc
 * `c.items.length` comparison. `slotItems(c)` already excludes potions.
 */
export function canStow(c) {
  return slotItems(c).length < bagCap(c);
}

/**
 * stowItem(state, it, events, quiet) — Phase 29 (LOOT-04): the ONE path that
 * adds to `c.items` from OUTSIDE chargen. A `kind:"bag"` item is never
 * stowed — it upgrades `c.bag` in place (one tier only; a same-or-lower tier
 * is rejected as `notBetter`) and consumes no slot. Anything else is gated by
 * `canStow`: on a full bag it pushes `bagFull {item, have, slots}` and
 * refuses (the item stays wherever the caller's pending state holds it — no
 * gold spent, nothing discarded); otherwise it delegates to `giveItem`
 * (applying eff.wp exactly as giveItem always has). Callers push their own
 * domain event (`findTaken`/`itemUnequipped`/`lootTaken`) after a `true`
 * return. Pure, no rng.
 */
export function stowItem(state, it, events = [], quiet = true) {
  const c = state.c;
  if (it.kind === "bag") {
    const from = c.bag;
    const have = BAG_ORDER.indexOf(from);
    const to = BAG_ORDER.indexOf(it.tier);
    if (to > have) {
      c.bag = it.tier;
      events.push({ type: "bagUpgraded", from, to: it.tier, slots: BAGS[it.tier].slots, item: it });
    } else {
      events.push({ type: "itemRejected", item: it, reason: "notBetter" });
    }
    return true;
  }
  // A bag-free item (potion or scroll, per takesBagSlot) is slot-exempt: it
  // never counts toward capacity AND is never itself refused by the gate,
  // even when the bag's gear/treasure count already sits at cap.
  if (takesBagSlot(it) && !canStow(c)) {
    events.push({ type: "bagFull", item: it, have: slotItems(c).length, slots: bagCap(c) });
    return false;
  }
  giveItem(state, it, quiet, events);
  return true;
}

/**
 * bagUpgradeTier(state) — Phase 29 (LOOT-05): is a bigger bag available to
 * drop right now? Pure read, no rng — Plan 02's killFoe fires its one extra
 * d20 only when this returns non-null. Returns the next tier name when the
 * character's current bag has a next tier in BAG_ORDER, the run's floor
 * depth has reached that tier's BAG_FLOORS entry, and no bag item is already
 * sitting in state.pendingLoot; otherwise null. Every parity fixture fights
 * at depth 1, so this is null on all of them (RESEARCH "LOOT-05 guard
 * safety").
 */
export function bagUpgradeTier(state) {
  const c = state.c;
  const idx = BAG_ORDER.indexOf(c && c.bag);
  if (idx < 0) return null;
  const next = BAG_ORDER[idx + 1];
  if (!next) return null;
  if (!(state.floor && state.floor.depth >= BAG_FLOORS[next])) return null;
  if ((state.pendingLoot || []).some((x) => x && x.kind === "bag")) return null;
  return next;
}

/** bagItemFor(tier) — a FRESH copy of the takeable `kind:"bag"` item for
 * `tier` (content/bags.js BAG_ITEMS), so state never aliases content. */
export function bagItemFor(tier) {
  return { ...BAG_ITEMS[tier] };
}

/** wornWeaponItem(c) — reconstruct the CURRENTLY-wielded weapon as a plain bag
 * item (for an equip swap / unequip), or null when the character is bare-handed
 * (an unequip sentinel weapon not in the WEAPONS table). The equipped weapon is
 * stored only as scalar base/prof/magicWpn fields — like takeItem, the magic
 * weapon's flavor name is not retained, so the reconstructed item uses the base
 * name; its magic bonus (c.magicWpn) IS preserved on `bonus`.
 *
 * RULES-13 (Phase 75): when a magic staff is wielded, `wieldedStaff(c)`
 * returns the REAL staff object (its charges must travel with it, unlike an
 * ordinary weapon's scalar-only bookkeeping) — returned directly, ahead of
 * the WEAPONS lookup below (a staff name is never a WEAPONS key). */
function wornWeaponItem(c) {
  const staff = wieldedStaff(c);
  if (staff) return staff;
  if (!c.weapon || !WEAPONS[c.weapon]) return null;
  const bonus = c.magicWpn || 0;
  return {
    kind: "weapon",
    n: c.weapon,
    base: c.weapon,
    bonus,
    txt: WEAPONS[c.weapon].lab + (bonus ? ` +${bonus}` : ""),
  };
}

/** wornArmorItem(c) — reconstruct the CURRENTLY-worn armor as a plain bag item
 * (for an equip swap / unequip), or null when the character wears nothing
 * ("Nothing"/AR 0) OR the worn piece is DESTROYED (c.armorWP <= 0 — rulebook
 * p.44: "permanently destroyed... may not be repaired"). Phase 28 (ARMOR-03,
 * MINIMAL MODEL): the reconstructed piece now carries its REMAINING
 * durability (`left`, sourced from c.armorWP) and patch count (`patches`) — re-equipping
 * does NOT repair it (the old always-full reconstruction was the unequip ->
 * swap -> re-equip full-repair exploit). A destroyed piece (armorWP <= 0)
 * returns null here — it is gone, no bag copy, even though combat's
 * armorDestroyed path (engine/combat.js) deliberately leaves c.ar/c.armor/
 * c.armorMax untouched (assumption A1) — this guard is the ONLY place the
 * "destroyed armor is gone" rule is enforced. */
function wornArmorItem(c) {
  if (!c.armor || c.armor === "Nothing" || !(c.ar > 0) || c.armorWP <= 0) return null;
  const base = ARMORS.find((a) => a.name === c.armor);
  return {
    kind: "armor",
    n: c.armor,
    armor: c.armor,
    ar: c.ar,
    wp: c.armorMax,
    min: c.armorMin,
    cls: base ? base.cls : "FTM",
    left: c.armorWP,
    patches: c.patches || 0,
    txt: `AR ${c.ar}, ${c.armorMax} hp`,
  };
}

/**
 * destroyedArmorPiece(c) — RULES-08 (Phase 75, Phase 25 additive-payload
 * pattern; pairs with unequipSlot's destroyed flag below): the ONE shared
 * descriptor for a worn-but-destroyed armor piece (armor set and not
 * "Nothing", ar > 0, armorWP <= 0 — the same guard wornArmorItem's null
 * branch already enforces). Returns `{ kind: "armor", n, armor, ar, left: 0
 * }`, or null when the worn piece is live (or there is none). MUST be read
 * BEFORE any equip mutation touches c.armor/c.ar/c.armorWP — every caller
 * below reads it in that order. Pure, no rng, no mutation.
 */
function destroyedArmorPiece(c) {
  if (!c.armor || c.armor === "Nothing" || !(c.ar > 0) || c.armorWP > 0) return null;
  return { kind: "armor", n: c.armor, armor: c.armor, ar: c.ar, left: 0 };
}

/**
 * takeFind(state, events) — ACCEPT the pending find (ECON-03). Adds
 * state.pendingFind to the bag if a slot is free; on a FULL bag keeps the item
 * pending and pushes `bagFull` (the UI then offers keep/drop, ECON-04). Found
 * weapons/armor land in the bag like anything else (NO auto-equip — that is the
 * player's separate equipItem choice); the flat `eff.wp` effect (if any) is
 * applied on pickup, exactly as giveItem does. Phase 37 (GEAR-03): with
 * `c.worn` present, a slot item that fits an EMPTY slot auto-wears instead
 * (no bag slot consumed — wearing needs none). Pure, no rng.
 */
export function takeFind(state, events = []) {
  const it = state.pendingFind;
  if (!it) return events;
  if (refuseGear(state, "takeFind", { item: it }, events)) return events;
  const slot = autoWearSlot(state, it);
  if (slot) {
    state.pendingFind = null;
    events.push({ type: "findTaken", item: it });
    wearItem(state, it, slot, events);
    return events;
  }
  if (!stowItem(state, it, events, true)) return events; // keep pending — the player must drop something first
  state.pendingFind = null;
  events.push({ type: "findTaken", item: it });
  return events;
}

/**
 * leaveFind(state, events) — DECLINE the pending find (ECON-03): clear it and
 * push `findLeft`. Pure, no rng.
 */
export function leaveFind(state, events = []) {
  const it = state.pendingFind || null;
  state.pendingFind = null;
  events.push({ type: "findLeft", item: it });
  return events;
}

/**
 * dropItem(state, i, events) — remove carried item `i` from the bag, freeing a
 * slot (ECON-04). No-op on an out-of-range index. Pure, no rng.
 */
export function dropItem(state, i, events = []) {
  const c = state.c;
  const it = (c.items || [])[i];
  if (!it) return events;
  c.items.splice(i, 1);
  events.push({ type: "itemDropped", item: it });
  // Phase 88 (ITEM-02): the sweep (no slots). A drop only ever addresses a bag
  // row, so a slotted source is never touched here; the helper still runs so
  // every gear-change path ends a stale linked effect the same way.
  endSourceEffects(state, c, events);
  return events;
}

/**
 * equipItem(state, i, events, target) — equip carried weapon/armor `i` onto
 * the character (ECON-05), REGARDLESS of whether it is better or worse than
 * the worn piece (the deliberate change vs takeItem's strictly-better gate) —
 * but REJECTING an illegal class/subclass/race combination (`equipRejected`).
 * The equip is a DIRECT SWAP: the previously-worn piece drops back into the
 * freed bag slot (no net slot change); if the character wore nothing, the
 * item is simply removed from the bag (net −1). No-op on an out-of-range
 * index. No rng draw unless an early-ended Cloak of Ether entombs the hero
 * (Phase 88, ITEM-02: a swap into a source slot ends the effect linked to it
 * through endSourceEffects; `rng`/`now` reach an entombment's death).
 *
 * Phase 28 (ARMOR-03): a piece that has been WORN carries `left`/`patches`
 * (set by wornArmorItem above) and comes back at that same durability — a
 * fresh piece (store, foe drop, kit, treasure — no `left` field) equips at
 * full via the `??` tolerant read, which also covers a pre-v1.3 save's bag
 * armor with no `left` at all. When the worn piece being swapped OUT is
 * destroyed, wornArmorItem returns null, so the swap simply removes the
 * newly-equipped item from the bag — the destroyed piece is gone, no bag
 * copy.
 *
 * 260918-wy1 (jewelry-merge): `target` is an OPTIONAL concrete worn key
 * (`"jewelry1"|"jewelry2"|"cloak"`), used only in the cloak/jewelry branch
 * below. It has no effect on the weapon/armor branches above (those stay a
 * single-key direct swap, unchanged).
 */
export function equipItem(state, i, events = [], target = null, rng = null, now = Date.now) {
  const c = state.c;
  const it = (c.items || [])[i];
  if (!it) return events;
  if (refuseGear(state, "equipItem", target != null ? { item: it, slot: target } : { item: it }, events)) return events;

  if (it.kind === "weapon") {
    const weaponReason = weaponRefusalReason(c, it);
    if (weaponReason) {
      events.push({ type: "equipRejected", item: it, reason: weaponReason });
      return events;
    }
    const worn = wornWeaponItem(c);
    c.weapon = it.base;
    c.prof = 0;
    c.magicWpn = it.bonus || 0;
    // RULES-13 (Phase 75): equipping an ordinary weapon over a wielded staff
    // leaves the wield state — `worn` above already returned the staff
    // itself (wornWeaponItem), so it is bagged like any other displaced
    // weapon; the scalar c.staff pointer just needs clearing.
    delete c.staff;
    if (worn) c.items[i] = worn;
    else c.items.splice(i, 1);
    events.push({ type: "itemEquipped", item: it, slot: "weapon" });
    endSourceEffects(state, c, events, { slots: ["weapon"], why: "swap", rng, now });
    return events;
  }

  // RULES-13 (Phase 75, user 2026-09-25 — reverses the 2026-09-18 staff
  // amendment): a magic staff equips into the WEAPON slot, MU-only. Mirrors
  // the weapon branch above exactly (a direct swap, no strictly-better
  // gate) except the equip target is the staff OBJECT itself (c.staff),
  // not a WEAPONS base name — its charges travel with it. `worn` may be an
  // ordinary weapon OR a previously-wielded staff (wornWeaponItem returns
  // either); either way it is bagged into the freed slot. The `replaced`
  // additive names whatever was displaced (Phase 25 additive-payload
  // pattern), mirroring the cloak/jewelry branch below.
  if (it.kind === "staff") {
    if (c.cls !== "Magic User") {
      events.push({ type: "equipRejected", item: it, reason: "wrongClass" });
      return events;
    }
    const worn = wornWeaponItem(c);
    c.staff = it;
    c.weapon = it.n;
    c.prof = 0;
    c.magicWpn = 0;
    if (worn) c.items[i] = worn;
    else c.items.splice(i, 1);
    events.push({ type: "itemEquipped", item: it, slot: "weapon", ...(worn ? { replaced: worn } : {}) });
    endSourceEffects(state, c, events, { slots: ["weapon"], why: "swap", rng, now });
    return events;
  }

  if (it.kind === "armor") {
    const armorReason = armorRefusalReason(c, it);
    if (armorReason) {
      events.push({ type: "equipRejected", item: it, reason: armorReason });
      return events;
    }
    // RULES-08 (Phase 75): read the outgoing piece's destroyed state BEFORE
    // the equip mutation below — additive only, no new event type, no rng.
    const destroyedPiece = destroyedArmorPiece(c);
    const worn = wornArmorItem(c);
    c.armor = it.armor;
    c.ar = it.ar;
    c.armorMin = it.min;
    c.armorMax = it.wp;
    c.armorWP = it.left ?? it.wp;
    c.patches = it.patches ?? 0;
    if (worn) c.items[i] = worn;
    else c.items.splice(i, 1);
    events.push({ type: "itemEquipped", item: it, slot: "armor", ...(destroyedPiece ? { discarded: destroyedPiece, destroyed: true } : {}) });
    return events;
  }

  // cloaks, jewelry — worn slots in the new model (Phase 37, GEAR-03).
  // RULES-13 (Phase 75) REVERSES the 2026-09-18 staff amendment this
  // comment used to describe: a staff is no longer excluded here by
  // reaching this branch at all — it is handled by its OWN branch above,
  // ahead of this one, since a staff is equipped into the WEAPON slot, not
  // a `c.worn` family key (`slotFor(it)` still returns null for a staff —
  // SLOT_OF is still built from JEWELRY_ROWS + CLOAKS_ROWS only — so a
  // staff would still fall through to `notEquippable` here if it ever DID
  // reach this branch, but it never does). Potions, picks, bags — never an
  // equip slot either.
  //
  // 260918-wy1 (jewelry-merge): `slotFor` now returns a FAMILY, not a
  // concrete key. Rule: an explicit `target` wins (validated against the
  // family's own keys, else `wrongSlot`); else the first free key of the
  // family (`freeWornKey`); else — for a single-key family (cloak) — that
  // one key, swapping exactly like before; else (both jewelry keys full,
  // untargeted) the family is full, refuse `jewelryFull` (nothing moves,
  // neither `c.worn` nor `c.items` changes).
  if ((it.kind === "cloak" || it.kind === "jewel") && c.worn && typeof c.worn === "object") {
    const family = slotFor(it);
    if (!family) {
      events.push({ type: "equipRejected", item: it, reason: "notEquippable" });
      return events;
    }
    const keys = WORN_KEYS_OF[family] || [];
    let key;
    if (target !== null && target !== undefined) {
      if (!keys.includes(target)) {
        events.push({ type: "equipRejected", item: it, reason: "wrongSlot" });
        return events;
      }
      key = target;
    } else {
      key = freeWornKey(c, family) ?? (keys.length === 1 ? keys[0] : null);
    }
    if (!key) {
      events.push({ type: "equipRejected", item: it, reason: "jewelryFull" });
      return events;
    }
    const worn = c.worn[key] || null;
    c.worn[key] = it;
    if (worn) c.items[i] = worn;
    else c.items.splice(i, 1);
    const evt = { type: "itemEquipped", item: it, slot: key };
    if (worn) evt.replaced = worn;
    events.push(evt);
    endSourceEffects(state, c, events, { slots: [key], why: "swap", rng, now });
    return events;
  }

  // legacy states (no c.worn) and anything else — not an equip slot
  events.push({ type: "equipRejected", item: it, reason: "notEquippable" });
  return events;
}

/**
 * unequipSlot(state, slot, events) — move the equipped weapon/armor back into
 * the bag (ECON-05), leaving the slot bare (a weapon → bare-handed "Fists",
 * armor → "Nothing"). Needs a free bag slot; on a FULL bag pushes `bagFull` and
 * does nothing. No-op when the slot is already bare. No rng draw unless the
 * Cloak of Ether comes off in rock (Phase 88, ITEM-02: a source slot
 * (SOURCE_SLOTS, the weapon slot for a wielded staff included) ends the effect
 * linked to it through endSourceEffects, "off"; `rng`/`now` reach the
 * entombment's death).
 *
 * Phase 28 (ARMOR-03): a DESTROYED piece (c.armorWP <= 0) needs no slot and
 * leaves no bag copy — wornArmorItem's null-guard already returns null for
 * it, so `worn` below is null even though c.ar is still > 0 (combat's
 * armorDestroyed path never resets c.ar/c.armor/c.armorMax — assumption A1).
 * That case is handled FIRST, separately from the generic `!worn` no-op: the
 * slot is bared exactly as the normal armor branch below does, but with NO
 * bag-cap check (nothing is being stowed) and an additive `destroyed` flag
 * (set true) on the existing itemUnequipped event (Phase 25 additive-payload
 * pattern — not a new event type) so the Oracle can narrate it.
 */
export function unequipSlot(state, slot, events = [], rng = null, now = Date.now) {
  if (refuseGear(state, "unequipSlot", { slot }, events)) return events;
  const c = state.c;
  const worn =
    slot === "weapon"
      ? wornWeaponItem(c)
      : slot === "armor"
        ? wornArmorItem(c)
        : WORN_SLOTS.includes(slot)
          ? (c.worn && c.worn[slot]) || null
          : null;
  if (slot === "armor" && !worn && c.armor && c.armor !== "Nothing" && c.ar > 0 && c.armorWP <= 0) {
    // RULES-08 (Phase 75): the descriptor now comes from the shared helper —
    // read BEFORE the mutation below, exactly as before; the event stays
    // byte-identical.
    const piece = destroyedArmorPiece(c);
    c.armor = "Nothing";
    c.ar = 0;
    c.armorMin = 0;
    c.armorMax = 0;
    c.armorWP = 0;
    c.patches = 0;
    events.push({
      type: "itemUnequipped",
      item: piece,
      slot: "armor",
      destroyed: true,
    });
    return events;
  }
  if (!worn) return events; // nothing equipped in that slot (or unknown slot)
  if (!stowItem(state, worn, events, true)) return events;
  if (slot === "weapon") {
    c.weapon = "Fists";
    c.prof = 0;
    c.magicWpn = 0;
    // RULES-13 (Phase 75): `worn` above already bagged the staff itself
    // (wornWeaponItem, via stowItem) when one was wielded — clear the
    // scalar pointer alongside the bare-hands reset.
    delete c.staff;
  } else if (slot === "armor") {
    c.armor = "Nothing";
    c.ar = 0;
    c.armorMin = 0;
    c.armorMax = 0;
    c.armorWP = 0;
    c.patches = 0;
  } else {
    // Phase 37 (GEAR-03), 260918-wy1: one of the three worn keys (two
    // jewelry, one cloak) — delete, not null, so `slot in c.worn` reports
    // empty exactly like a never-worn slot.
    delete c.worn[slot];
  }
  events.push({ type: "itemUnequipped", item: worn, slot });
  if (SOURCE_SLOTS.includes(slot)) endSourceEffects(state, c, events, { slots: [slot], why: "off", rng, now });
  return events;
}

/* ---------------- pending loot pile (LOOT-01/02/05/06, Phase 29) ----------

   killFoe (engine/combat.js) no longer auto-takes a treasure drop — it pushes
   the rolled item onto state.pendingLoot via offerLoot, and the player
   decides per item (takeLoot/leaveLoot) or in bulk (takeAllLoot/leaveAllLoot)
   once combat ends. All FIVE handlers below are PURE (no rng), exactly like
   the takeFind/leaveFind/equipItem/unequipSlot family above, and every stow
   routes through stowItem — the one bag-cap gate.

   Phase 61 (GRULE-01): a multi-foe fight can park a kill's drop in
   state.pendingLoot WHILE state.combat is still set (killFoe -> offerLoot,
   before the fight itself ends) — takeLoot/takeAllLoot gate on refuseGear
   for exactly this reason, even though the shell never shows the loot card
   mid-fight and the bot resolves combat first. leaveLoot/leaveAllLoot stay
   UNGATED (declining is never a gear change). */

/**
 * offerLoot(state, it, events, rollInfo) — the ONE producer (killFoe, Task
 * 2): appends `it` to state.pendingLoot and narrates `lootDropped` —
 * replaces the legacy mid-fight auto-take entirely. Never touches c.items.
 * Pure, no rng of its own. Phase 73 (ROLL-05): the optional 4th argument
 * (killFoe's `{ ...rollFields(lootCheck), bag? }`) is spread onto
 * `lootDropped` for the parity invariant/Oracle — absent (`{}`) for a
 * caller with no roll-check to report, so a plain call stays byte-identical.
 */
export function offerLoot(state, it, events = [], rollInfo = {}) {
  state.pendingLoot = state.pendingLoot || [];
  state.pendingLoot.push(it);
  events.push({ type: "lootDropped", name: it.n, kind: it.kind, ...rollInfo });
  return events;
}

/**
 * takeLoot(state, i, equip, events) — take pending drop `i`. Default
 * (`equip` false): stow it via the single gate (`bagFull` refusal keeps it
 * pending). With `equip: true` (CONTEXT §Compare-to-equipped): a DIRECT
 * swap for weapon/armor only — anything else is `equipRejected
 * {reason:"notEquippable"}`. The displaced worn piece (if any) goes through
 * the SAME stow gate, so a slot is needed only when something is displaced
 * (bare-handed/"Nothing"/destroyed worn pieces need none, per
 * wornWeaponItem/wornArmorItem's null guards). A class/race-illegal item is
 * `equipRejected` with the shared refusal reason, pile untouched. Pure, no
 * rng.
 */
export function takeLoot(state, i, equip = false, events = []) {
  const c = state.c;
  const pile = state.pendingLoot || [];
  const it = pile[i];
  if (!it) return events;
  if (refuseGear(state, "takeLoot", { item: it }, events)) return events;

  if (!equip) {
    // Phase 37 (GEAR-03): with c.worn present, an empty-slot item auto-wears
    // instead of stowing. Occupied slot / legacy state -> unchanged.
    const slot = autoWearSlot(state, it);
    if (slot) {
      pile.splice(i, 1);
      events.push({ type: "lootTaken", item: it });
      wearItem(state, it, slot, events);
      return events;
    }
    if (!stowItem(state, it, events, true)) return events; // keep pending — the player must drop something first
    pile.splice(i, 1);
    events.push({ type: "lootTaken", item: it });
    return events;
  }

  // Deliberately unchanged (Phase 43 owns loot-card equip for slot items):
  // the equip:true form is weapon/armor/staff only — every other slot item
  // here still gets notEquippable. RULES-13 (Phase 75): a staff joins
  // weapon/armor here — it equips into the WEAPON slot exactly like a
  // dropped weapon would.
  if (it.kind !== "weapon" && it.kind !== "armor" && it.kind !== "staff") {
    events.push({ type: "equipRejected", item: it, reason: "notEquippable" });
    return events;
  }

  if (it.kind === "weapon") {
    const reason = weaponRefusalReason(c, it);
    if (reason) {
      events.push({ type: "equipRejected", item: it, reason });
      return events;
    }
    const worn = wornWeaponItem(c);
    if (worn && !stowItem(state, worn, events, true)) return events;
    c.weapon = it.base;
    c.prof = 0;
    c.magicWpn = it.bonus || 0;
    delete c.staff;
    pile.splice(i, 1);
    events.push({ type: "itemEquipped", item: it, slot: "weapon" });
    endSourceEffects(state, c, events, { slots: ["weapon"], why: "swap" });
    return events;
  }

  // RULES-13 (Phase 75): mirrors equipItem's staff branch exactly — MU-only,
  // a direct swap into the weapon slot, the displaced piece (weapon or a
  // previously-wielded staff) stowed through the SAME gate the weapon
  // branch above uses (a full bag keeps the loot pending, per this
  // function's own doc).
  if (it.kind === "staff") {
    if (c.cls !== "Magic User") {
      events.push({ type: "equipRejected", item: it, reason: "wrongClass" });
      return events;
    }
    const worn = wornWeaponItem(c);
    if (worn && !stowItem(state, worn, events, true)) return events;
    c.staff = it;
    c.weapon = it.n;
    c.prof = 0;
    c.magicWpn = 0;
    pile.splice(i, 1);
    events.push({ type: "itemEquipped", item: it, slot: "weapon", ...(worn ? { replaced: worn } : {}) });
    endSourceEffects(state, c, events, { slots: ["weapon"], why: "swap" });
    return events;
  }

  // armor
  const reason = armorRefusalReason(c, it);
  if (reason) {
    events.push({ type: "equipRejected", item: it, reason });
    return events;
  }
  // RULES-08 (Phase 75): read the outgoing piece's destroyed state BEFORE the
  // equip mutation below — additive only, no new event type, no rng.
  const destroyedPiece = destroyedArmorPiece(c);
  const worn = wornArmorItem(c);
  if (worn && !stowItem(state, worn, events, true)) return events;
  c.armor = it.armor;
  c.ar = it.ar;
  c.armorMin = it.min;
  c.armorMax = it.wp;
  c.armorWP = it.left ?? it.wp;
  c.patches = it.patches ?? 0;
  pile.splice(i, 1);
  events.push({ type: "itemEquipped", item: it, slot: "armor", ...(destroyedPiece ? { discarded: destroyedPiece, destroyed: true } : {}) });
  return events;
}

/**
 * leaveLoot(state, i, events) — DECLINE pending drop `i`: splice it out and
 * narrate `lootLeft`. No-op on an out-of-range index. Pure, no rng.
 */
export function leaveLoot(state, i, events = []) {
  const pile = state.pendingLoot || [];
  const it = pile[i];
  if (!it) return events;
  pile.splice(i, 1);
  events.push({ type: "lootLeft", item: it });
  return events;
}

/**
 * takeAllLoot(state, events) — take every pending drop that fits, IN PILE
 * ORDER (CONTEXT's locked default, RESEARCH A1): a blocked gear item does
 * not block a later potion/bag behind it. Refused items stay in the pile,
 * in their original relative order; exactly ONE `bagFull` is surfaced (for
 * the FIRST refusal) — never loses an item. Pure, no rng.
 */
export function takeAllLoot(state, events = []) {
  if ((state.pendingLoot || []).length && refuseGear(state, "takeAllLoot", {}, events)) return events;
  const pile = (state.pendingLoot || []).slice();
  const remaining = [];
  let refused = false;
  for (const it of pile) {
    // Phase 37 (GEAR-03): an empty-slot item auto-wears and never consumes a
    // bag slot or trips `refused` — checked BEFORE the stow gate below.
    const slot = autoWearSlot(state, it);
    if (slot) {
      events.push({ type: "lootTaken", item: it });
      wearItem(state, it, slot, events);
      continue;
    }
    const scratch = [];
    if (stowItem(state, it, scratch, true)) {
      events.push(...scratch, { type: "lootTaken", item: it });
    } else {
      remaining.push(it);
      if (!refused) {
        events.push(...scratch); // the bagFull for the FIRST refusal only
        refused = true;
      }
    }
  }
  state.pendingLoot = remaining;
  return events;
}

/**
 * leaveAllLoot(state, events) — DECLINE every pending drop: one `lootLeft`
 * per item, in pile order, then empty the pile. Pure, no rng.
 */
export function leaveAllLoot(state, events = []) {
  const pile = state.pendingLoot || [];
  for (const it of pile) events.push({ type: "lootLeft", item: it });
  state.pendingLoot = [];
  return events;
}

/**
 * itemReady(state, it) — is an item off cooldown? Ports mazeworld.html
 * itemReady() (lines 1958-1962), rewritten (Phase 39, GEAR-02) onto the ONE
 * `c.timers`-backed activation model — the retired counter-field-based
 * cooldown is gone. 260918-w4n: readiness is now keyed on `activationFor(it)`
 * rather than a raw `it.use` string, since every JEWELRY/CLOAKS row is
 * act-only now (no `use` key at all) — an item with NO activation at all
 * (`activationFor` returns null — a weapon/rope/ladder) is never usable. A
 * potion is always ready (consumption, not a cooldown, gates re-drinking —
 * an active effect record from an earlier dose of the SAME potion must never
 * refuse a second one). A staff is ready iff it currently holds an integer
 * charge > 0. Everything else (duration+cooldown jewelry/cloaks, the torch)
 * is ready iff its OWN `item:<key>` timer record does not exist (neither an
 * effect nor a cooldown phase).
 */
export function itemReady(state, it) {
  if (it.kind === "potion") return true;
  const act = activationFor(it);
  if (!act) return false;
  if (act.charges !== undefined) return Number.isInteger(it.charges) && it.charges > 0;
  return isReady(state.c, itemTimerId(it));
}

// CMB-03 (Phase 31): the targeted attack kinds — the ones that read
// `state.combat.foes` and do nothing useful (yet still burned their
// cooldown, RESEARCH §4.2) with no active combat. Exported for the
// usable-features audit test (Plan 02, Task 3).
export const TARGETED_KINDS = new Set(["freeze", "weaken", "stone", "fire", "gas"]);

/**
 * applyActivation(state, it, rng, events) — Phase 39 (GEAR-02), module-
 * private: the ONE timer-bookkeeping step every real (non-fizzled) `useItem`
 * call runs AFTER the kind switch resolves its own side effect (fire's
 * damage, stone's kills, dome's ward, …). A no-op when `it` has no
 * activation at all (`activationFor` returns null). Otherwise: for a staff
 * (`act.charges` defined), spends one charge (clamped at 0, tolerant of a
 * tampered non-integer `it.charges`) and, only when no recharge cooldown is
 * ALREADY counting down, starts a fresh one (`charges:<key>`, `act.recharge`
 * squares) — spending a second charge while one is already recharging never
 * restarts the countdown. Then resolves the item's own effect: a numeric
 * `act.effect` is used directly; a dice-notation `act.effect` (the Crystal
 * Staff's `d10+5`) is rolled via the injected rng. A positive `left` starts
 * an `item:<key>` effect record (with `cd` set when the activation also
 * carries a cooldown — a duration+cooldown jewelry/cloak) and pushes
 * `itemEffectStarted`; an instant effect (`left` 0 or absent) with a `cd`
 * (the Pendant's `half`) starts a bare cooldown record instead; an instant
 * effect with NO `cd` (every staff kind except Crystal) starts nothing
 * further — the charge spend above is the item's only c.timers footprint.
 *
 * RULES-11 (Phase 75.2, Plan 02): when the activation's `eff` carries a
 * numeric `size` (the Gauntlet of the Giant, Enlarge, and any future
 * size-stepping item), the started event also carries `size` (the
 * character's own `heroSize(c).name` AFTER the record starts — the
 * resulting total, race + every live item step), `step` (this ITEM's own
 * step, always ±1) and `sizeDmg` (SIZE_DAMAGE_PER_STEP × that item step).
 * Phase 89 (ITEM-05): it also carries `dmgTotal`, the item's whole damage
 * bonus: `sizeDmg` plus the item's own `eff.dmg` bulk (Enlarge: 2 + 9 = 11;
 * the Gauntlet of the Giant carries no bulk, so 2). The narration reads it,
 * never a restated formula.
 *
 * Phase 88 (ITEM-02): `slot` is the source slot the use came through (the
 * ref's `{ slot }`: cloak, jewelry1, jewelry2, or "weapon" for a wielded
 * staff), null for a bag use. A started effect record is stamped with
 * `src: { slot, n }` (endSourceEffects ends it when the item leaves that slot)
 * only when `slot` is a SOURCE_SLOTS key and the item is not used up on use:
 * potions and the Torch are consumed, so their effects run their course.
 */
function applyActivation(state, it, rng, events, slot = null) {
  const c = state.c;
  const act = activationFor(it);
  if (!act) return;
  if (act.charges !== undefined) {
    const current = Number.isInteger(it.charges) ? it.charges : act.charges;
    it.charges = Math.max(0, current - 1);
    if (isReady(c, chargesTimerId(it))) startCooldown(c, chargesTimerId(it), { squares: act.recharge });
  }
  const left = typeof act.effect === "object" && act.effect !== null ? rollDice(rng, act.effect) : act.effect;
  const cadence = act.cadence ?? "squares";
  if (left > 0) {
    const opts = act.cd ? { [cadence]: left, cd: act.cd } : { [cadence]: left };
    const rec = startEffect(c, itemTimerId(it), opts);
    if (rec && SOURCE_SLOTS.includes(slot) && it.kind !== "potion" && it.uses !== 1 && it.kind !== "tool") {
      rec.src = { slot, n: it.n };
    }
    const started = { type: "itemEffectStarted", item: it.n, kind: act.kind, left, cadence };
    if (act.kind === "might" && typeof act.might === "number") started.might = act.might;
    if (act.eff && typeof act.eff.size === "number") {
      started.size = heroSize(c).name;
      started.step = act.eff.size;
      started.sizeDmg = SIZE_DAMAGE_PER_STEP * act.eff.size;
      started.dmgTotal = started.sizeDmg + (typeof act.eff.dmg === "number" ? act.eff.dmg : 0);
    }
    // Phase 88 (ITEM-03): a heal-over-time item states its cadence, count and
    // die so the start line can tell the player what the window will do.
    if (act.hot) {
      started.every = act.hot.every;
      started.ticks = act.hot.ticks;
      started.heal = { ...act.hot.heal };
    }
    events.push(started);
  } else if (act.cd) {
    startCooldown(c, itemTimerId(it), { squares: act.cd });
  }
}

/**
 * narrateTimerTransitions(state, transitions, events) — Phase 39 (GEAR-02):
 * maps a list of engine/effects.js `{ id, from, to }` transitions (as
 * returned by `tickSquares`/`tickRounds`) onto the item-domain events the
 * Oracle/rail/fight log narrate — the ONE place a tick's return value becomes
 * player-visible feedback. `ability:` ids are ignored (Phase 38's abilities
 * narrate nothing on expiry). Pure bookkeeping, zero rng: the ONE exception
 * is a staff's charge refill (a `charges:` id, always a cooldown -> null
 * transition), which mutates `it.charges` on the staff object itself (found
 * via `carriedItems`, bag ∪ worn — a dropped staff's record simply vanishes,
 * no event) and, only when the pool isn't yet full, restarts the recharge
 * cooldown so the NEXT charge keeps counting down.
 */
export function narrateTimerTransitions(state, transitions, events = []) {
  const c = state.c;
  for (const { id, from } of transitions || []) {
    if (id.startsWith("item:")) {
      const key = id.slice("item:".length);
      if (from === "effect") {
        events.push({ type: "itemEffectFaded", item: key, kind: ACTIVATION_OF[key]?.kind ?? null });
      } else if (from === "cooldown") {
        events.push({ type: "itemCooled", item: key });
      }
    } else if (id.startsWith("charges:")) {
      const key = id.slice("charges:".length);
      const act = ACTIVATION_OF[key];
      const max = act ? act.charges : undefined;
      const it = carriedItems(c).find((x) => x && x.n === key);
      if (it) {
        it.charges = (Number.isInteger(it.charges) ? it.charges : 0) + 1;
        events.push({ type: "staffRecharged", item: key, charges: it.charges, max });
        if (it.charges < max) startCooldown(c, id, { squares: act.recharge });
      }
    }
    // ability: ids — Phase 38 narrates nothing on expiry; ignored here.
  }
  return events;
}

/**
 * tickHealOverTime(state, cost, rng, events) — Phase 88 (ITEM-03, user
 * 2026-09-30): the general heal-over-time tick. For every LIVE item effect on
 * the hero whose activation carries `act.hot` (`{ every, ticks, heal }`, e.g.
 * the Cloak of Regeneration), a step of `cost` squares (1, or 2 on water; the
 * same `cost` move hands tickSquares) brings on `healTicksDue(act, rec.left,
 * cost)` ticks, each healing one `heal` die. It reads each record's `left`
 * BEFORE the step's tickSquares, so a tick that lands on the window's last
 * square is told before that same step's "wears off" line, and progress is the
 * record's own `effect - left` (no new serialized field). A tick is exactly
 * once per mark, never skipped or doubled, even for a 2-square step.
 *
 * Each die is rolled from `derivedRng(<main rng cursor>, "healTick", <item>,
 * <tick>, <state.steps>)`: a pure keyed stream, so the passed main `rng` is
 * only READ for its cursor and never advanced (floor generation and existing
 * draws do not reorder). The heal is clamped to maxWP; every tick pushes
 * `healTick { type, item, amount, gained, tick, ticks }` (a full-hp tick has
 * gained 0 and is still spent: it counts as one of the ticks).
 *
 * Hero only (CONTEXT "Wearer only"; Joiner sheets are not ticked). A dead
 * state, a hero at 0 hp, or a sheet with no plain-object `timers` ticks
 * nothing. There are no ticks in a fight: move returns before this runs while
 * `state.combat` is set. Adds no main-rng draw.
 */
export function tickHealOverTime(state, cost, rng, events = []) {
  if (!state || state.dead) return events;
  const c = state.c;
  if (!c || !(c.wp > 0)) return events;
  const timers = c.timers;
  if (!timers || typeof timers !== "object" || Array.isArray(timers)) return events;
  const cursor = typeof rng?.getState === "function" ? rng.getState() : 0;
  for (const { key, act, rec } of liveItemEffects(c)) {
    if (!act.hot) continue;
    for (const k of healTicksDue(act, rec.left, cost)) {
      const amount = rollDice(derivedRng(cursor, "healTick", key, k, state.steps), act.hot.heal);
      const gained = Math.max(0, Math.min(c.maxWP - c.wp, amount));
      c.wp += gained;
      events.push({ type: "healTick", item: key, amount, gained, tick: k, ticks: act.hot.ticks });
    }
  }
  return events;
}

/**
 * PILFER_FUMBLE_KINDS — RULES-09 (Phase 75.1, user 2026-09-24/25): the three
 * use-activated magic-item kinds a Pilfer's fumble risk applies to (jewelry,
 * cloaks, staves). Potions, scrolls and `kind:"tool"` items are NEVER in
 * this set — they never fumble, no matter who uses them. Frozen; exactly
 * these three, nothing more (a test pins the exact contents).
 */
export const PILFER_FUMBLE_KINDS = Object.freeze(["jewel", "cloak", "staff"]);

/**
 * pilferFumbles(c, it) — RULES-09: true only when `c` is a Pilfer AND `it`
 * is one of PILFER_FUMBLE_KINDS. A staff always resolves true here even
 * though a Pilfer (a Thief) can never actually wield one (useItem's
 * wrongClass refusal fires first, before this predicate is ever consulted)
 * — this function answers "does the kind carry fumble risk", not "is this
 * particular use reachable". Pure, no rng.
 */
export function pilferFumbles(c, it) {
  return !!(c && c.sub === "Pilfer" && it && PILFER_FUMBLE_KINDS.includes(it.kind));
}

/**
 * pilferFumbleRng(state, rng, it) — RULES-09: the ONE derived rng stream a
 * Pilfer's fumble check (and, on a fumble, its d10 blast) draws from —
 * `derivedRng(<main rng cursor, or 0 for a test double with no getState>,
 * "pilferFumble", <state.acts when a non-negative integer, else 0>, it.n)`.
 * Never touches the caller's main `rng` — a non-fumbling Pilfer use leaves
 * the main rng cursor exactly where a non-Pilfer's identical use would.
 * Deterministic: the same (cursor, acts, item name) always yields the same
 * first draw, so a test can predict the blast from a fresh call with the
 * same key rather than re-using the live instance.
 */
export function pilferFumbleRng(state, rng, it) {
  const cursor = typeof rng.getState === "function" ? rng.getState() : 0;
  const acts = Number.isInteger(state.acts) && state.acts >= 0 ? state.acts : 0;
  return derivedRng(cursor, "pilferFumble", acts, it.n);
}

/**
 * partyHealBody(state, idx) — Phase 89 (ITEM-01), module-private: the object
 * that holds party member `idx`'s LIVE hit points right now, or null. In a
 * fight that is the member's `state.combat.allies` entry (endCombat syncs its
 * `wp` back to the sheet); outside one it is the sheet. A missing member, one
 * flagged `status: "downed"`, or one with no live fight entry (downMember
 * splices a downed member out of `C.allies`) is null. Pure, no rng.
 */
function partyHealBody(state, idx) {
  const sheet = Array.isArray(state.party) ? state.party[idx] : null;
  if (!sheet || typeof sheet !== "object" || sheet.status === "downed") return null;
  const C = state.combat;
  if (!C) return sheet;
  const ally = Array.isArray(C.allies) ? C.allies.find((a) => a && a.partyIdx === idx) : null;
  return ally && ally.wp > 0 ? ally : null;
}

/**
 * healPartyMember(state, idx, amount) — Phase 89 (ITEM-01, ITEM-06): THE one
 * write for healing a Joiner. Raises party member `idx`'s hit points by
 * `amount`, clamped to its maximum, on its `state.combat.allies` entry in a
 * fight and on its sheet otherwise (see partyHealBody), and returns the hp
 * actually gained (0 for a full body or a non-positive amount). Returns null
 * for a missing, downed or departed member. Pure, no rng. The Poplar Staff
 * uses it today; a Joiner's own potion reuses it (Phase 89 plan 05).
 */
export function healPartyMember(state, idx, amount) {
  const body = partyHealBody(state, idx);
  if (!body) return null;
  const max = Number.isFinite(body.maxWP) ? body.maxWP : Number.isFinite(state.party[idx].maxWP) ? state.party[idx].maxWP : body.wp;
  const before = body.wp;
  body.wp = Math.max(before, Math.min(max, before + (Number.isFinite(amount) && amount > 0 ? amount : 0)));
  return Math.max(0, body.wp - before);
}

/**
 * useItem(state, ref, rng, events, now) — triggers a carried OR worn item's
 * effect. Ports mazeworld.html useItem() (lines 1963-1995). `ref` addresses
 * the item two ways: a non-negative bag index (the original form,
 * `c.items[i]`) or `{ slot }` (Phase 37, GEAR-03 — a worn item,
 * `c.worn[slot]`). Foe-targeting effects (freeze/weaken/stone/fire/gas)
 * read/write `state.combat.foes` directly; a "kill" here is the minimal
 * bookkeeping (`wp`/`alive`/`kills`) the item itself owns — full combat
 * resolution (loot, victory checks) is wired by the combat slice (01-08)
 * when it calls into a live `state.combat`.
 *
 * CMB-02/03 (Phase 31) + Phase 37 (GEAR-03) + RULES-13 (Phase 75): the full
 * refusal ladder, every step BEFORE `itemUsed` fires (so a refused use never
 * burns a cooldown/charge, never consumes the item, never draws): pending
 * fight -> wrongClass (a staff used by a non-caster) -> notWielded (a staff
 * reached by bag index that is not the wielded one — RULES-13, reverses the
 * 2026-09-18 bag-use amendment) -> notWorn (a bagged cloak/jewelry
 * activatable in the worn-slot model — "activatables must be worn to work";
 * 260918-w4n: a staff is NOT a slot item, `slotFor` returns null for one, so
 * this gate never fires for a staff) -> combatOnly (a targeted kind outside
 * combat) -> notDark (the torch) -> cooldown (itemReady). Every reason its
 * own event, never a silent no-op (Phase 25.1 DFB-06). A legacy state (no
 * `c.worn`) never sees `notWorn` — bag-use of a cloak/jewelry stays exactly
 * as today.
 *
 * RULES-09 (Phase 75.1, user 2026-09-24/25): the IDENT-07 Pilfer heal-only
 * refusal that used to sit here is GONE — a Pilfer uses every item under the
 * normal rules. In its place, the LAST step before `itemUsed` fires
 * (`pilferFumbles` below) draws a d20 fumble check for a Pilfer's jewel/
 * cloak/staff use; every refusal above it (including this ladder's own
 * `itemReady`) still refuses first and still draws nothing.
 *
 * 260918-w4n (use-activated-only, user ruling 2026-09-18): `kind` resolves
 * as `it.eff2` for a potion, else `it.use ?? activationFor(it)?.kind` — every
 * act-only JEWELRY/CLOAKS row (no `use` key any more) resolves through its
 * activation record; the torch and the five legacy `use` rows (Pendant/
 * Amulet of Stone/Cloak of Invisibility/Speed/Ether) keep their switch case
 * via `use`, which always equals the activation kind except the torch's
 * light/lit pair (its `use` is "light", its activation `kind` is "lit").
 *
 * RULES-13 (Phase 75): `{ slot: "weapon" }` addresses the WIELDED staff —
 * resolved via `wieldedStaff(c)`, not `c.worn["weapon"]` (a staff is never a
 * `c.worn` entry; it lives on the scalar c.weapon/c.staff pair). With no
 * staff wielded this resolves to `null` and the function returns a SILENT
 * no-op below, exactly like an out-of-range bag index.
 */
export function useItem(state, ref, rng, events = [], now = Date.now) {
  const c = state.c;
  const slot = ref && typeof ref === "object" ? ref.slot : null;
  const i = slot ? null : ref;
  const it = slot === "weapon" ? wieldedStaff(c) : slot ? c.worn && c.worn[slot] : (c.items || [])[i];
  if (!it) return events;
  // CMB-01 (Phase 31): refuseIfPending is the FIRST check, before every
  // refusal below.
  if (refuseIfPending(state, events, "useRefused", { item: it })) return events;

  // Phase 89 (ITEM-01): a STAFF's kind is read from its activation record
  // first. A saved Poplar Staff still carries the pre-Phase-89 `use: "heal"`
  // (the Healing potion's hero-only d10+2); its activation says partyHeal, so
  // the old item heals the party with no migration. Every other staff's `use`
  // equals its activation kind, so nothing else moves. The Torch keeps its
  // light/lit pair because it is not a staff.
  const kind = it.kind === "potion" ? it.eff2 : it.kind === "staff" ? (activationFor(it)?.kind ?? it.use) : (it.use ?? activationFor(it)?.kind);

  // CMB-02 (Phase 31): a staff used by a non-caster — stowItem/takeItem
  // already refuse a staff at ACQUIRE time (itemRejected wrongClass), but a
  // character can still end up carrying one (chargen roster, a save from
  // before that gate existed); refuse the USE too, before any side effect.
  if (it.kind === "staff" && c.cls !== "Magic User") {
    events.push({ type: "useRefused", item: it, reason: "wrongClass" });
    return events;
  }

  // RULES-13 (Phase 75, user 2026-09-25): a staff's charged power works ONLY
  // while it is wielded. Reverses the 2026-09-18 bag-use amendment
  // (260918-w4n) for this one kind — a staff reached by BAG INDEX (`i`, not
  // `{slot:"weapon"}`) is never the wielded staff (`wieldedStaff(c)` reads
  // `c.staff`, which `carriedItems` keeps out of `c.items`); refuse it here,
  // before any side effect, so no charge is spent, no cooldown starts and no
  // die is drawn. Gated on `wieldedStaff(c) !== it` (not merely "addressed by
  // index") per 75-07's own handoff note, so a future resolution change here
  // stays correct by construction rather than by the current item-storage
  // shape alone.
  if (it.kind === "staff" && wieldedStaff(c) !== it) {
    events.push({ type: "useRefused", item: it, reason: "notWielded" });
    return events;
  }

  // Phase 37 (GEAR-03) + 260918-w4n (governing rule, user 2026-09-18:
  // "Items that are equipable must be equipped to be used"): "activatables
  // must be worn to work" — in the worn-slot model a cloak/jewelry addressed
  // by its BAG index (not `{ slot }`) does nothing; a legacy state (no
  // `c.worn`) keeps today's bag-use behaviour untouched. A staff is NOT
  // equipable (`slotFor` always returns null for one), so this gate never
  // fires for it — a bagged staff passes straight through to the
  // wrongClass/pilfer/combatOnly/itemReady ladder below, exactly like a
  // potion/torch/scroll ("Items that are not equipable can be used from the
  // bag").
  if (slot === null && c.worn && typeof c.worn === "object" && slotFor(it)) {
    events.push({ type: "useRefused", item: it, reason: "notWorn" });
    return events;
  }

  // CMB-03 (Phase 31): a targeted attack item used outside combat used to
  // silently fizzle (foes = [], every forEach/for a no-op) while STILL
  // burning its cooldown and, for `fire`, drawing a narratively-invisible
  // rng.d(6) and pushing a misleading `itemBurned {total:0}` (RESEARCH
  // §4.2) — refuse it explicitly instead, before itemUsed fires.
  if (!state.combat && TARGETED_KINDS.has(kind)) {
    events.push({ type: "useRefused", item: it, reason: "combatOnly" });
    return events;
  }

  // Phase 39 (GEAR-05): a torch used while NOT dark is refused before any
  // side effect and NOT consumed — "save it for when it's dark" (CONTEXT
  // Area 1). `inDark` already covers both the current tile's `.dark` flag
  // and the persistent `c.darkFor` counter, exactly the darkness this torch
  // answers; the torch only ever touches `c.darkFor` (Phase 41 owns the
  // tile `.dark` model).
  if (kind === "light" && !inDark(state)) {
    events.push({ type: "useRefused", item: it, reason: "notDark" });
    return events;
  }

  // CMB-02 (Phase 31) + Phase 39 (GEAR-02): itemReady's silent no-op
  // (RESEARCH §3.4) replaced with an explaining refusal naming exactly how
  // many squares remain — only when the item actually carries an activation
  // (`activationFor` non-null); an item with no `use` effect and not a
  // potion (never itemReady, never has an activation) stays the pre-existing
  // silent no-op, since there is nothing to explain. Two named reasons: a
  // staff (`act.charges` defined) is `"recharging"`; every duration+cooldown
  // jewelry/cloak is `"cooldown"`.
  if (!itemReady(state, it)) {
    const act = activationFor(it);
    if (act && act.charges !== undefined) {
      events.push({
        type: "useRefused",
        item: it,
        reason: "recharging",
        left: remaining(c, chargesTimerId(it)),
        charges: Number.isInteger(it.charges) ? it.charges : 0,
        max: act.charges,
      });
    } else if (act) {
      const rec = c.timers && c.timers[itemTimerId(it)];
      events.push({
        type: "useRefused",
        item: it,
        reason: "cooldown",
        left: remaining(c, itemTimerId(it)),
        phase: rec ? rec.phase : "cooldown",
      });
    }
    return events;
  }

  // RULES-09 (Phase 75.1, user 2026-09-24/25): the LAST refusal-ladder step,
  // right before `itemUsed` fires — a Pilfer's use of a jewel/cloak/staff
  // risks a fumble. Both draws come from the SAME derived stream
  // (pilferFumbleRng): the d20 steady-hands check (rollCheck, atLeastFor(19,
  // 20) — only a roll of 1 fails), then, only on a fumble, the d10 blast. A
  // non-fumbling Pilfer use falls straight through unchanged (itemUsed still
  // fires below, the item still works) — the main rng cursor is untouched
  // either way, so a Pilfer's ordinary use costs the SAME main-rng draws a
  // non-Pilfer's identical use would.
  if (pilferFumbles(c, it)) {
    const fumbleRng = pilferFumbleRng(state, rng, it);
    const chk = rollCheck(fumbleRng, 20, atLeastFor(19, 20));
    if (!chk.ok) {
      const dmg = fumbleRng.d(10); // roll:amount
      c.wp -= dmg;
      // The item is gone — dusted, no armor/ward soak (the Apprentice
      // backfire precedent: this is the Pilfer's own hands, not a hit).
      if (slot) delete c.worn[slot];
      else c.items.splice(i, 1);
      events.push({
        type: "pilferFumbled",
        item: it.n,
        ...(slot ? { slot } : { index: i }),
        ...rollFields(chk),
        dmg,
      });
      // Phase 88 (ITEM-02): the destroyed item's linked effect ends with it.
      endSourceEffects(state, c, events, { slots: slot ? [slot] : [], why: "destroyed", rng, now });
      if (c.wp <= 0 && !state.dead) die(state, "pilferFumble", it.n, rng, events, now);
      return events;
    }
  }

  events.push({ type: "itemUsed", item: it });

  const combat = state.combat;
  const foes = combat && combat.foes ? combat.foes.filter((f) => f.alive) : [];
  let fizzled = false;

  switch (kind) {
    case "heal": {
      const a = rng.d(10) + 2; // roll:amount
      const before = c.wp;
      c.wp = Math.min(c.maxWP, c.wp + a);
      // VOX-05 (Phase 79, plan 79-02, todo 2026-09-25): `gained` is the HP
      // actually added after the clamp to max (additive, zero draws).
      events.push({ type: "healed", amount: a, gained: c.wp - before });
      break;
    }
    case "partyHeal": {
      // Phase 89 (ITEM-01, ITEM-06): the Poplar Staff heals the hero and every
      // living Joiner, one heal die each (activation data, 1d20+10), hero
      // first then state.party order. Every die comes from ONE derived stream
      // (the pilferFumbleRng key shape): the main rng is only READ for its
      // cursor, never drawn. A full-hp body gains 0 and is still listed.
      const dice = activationFor(it).heal;
      const healRng = derivedRng(
        typeof rng.getState === "function" ? rng.getState() : 0,
        "partyHeal",
        Number.isInteger(state.acts) && state.acts >= 0 ? state.acts : 0,
        it.n,
      );
      const heroAmount = rollDice(healRng, dice);
      const heroBefore = c.wp;
      c.wp = Math.min(c.maxWP, c.wp + heroAmount);
      const heals = [{ name: c.name, hero: true, amount: heroAmount, gained: c.wp - heroBefore }];
      const party = Array.isArray(state.party) ? state.party : [];
      for (let k = 0; k < party.length; k++) {
        // A downed or departed member is skipped (null) and draws no die.
        if (!partyHealBody(state, k)) continue;
        const amount = rollDice(healRng, dice);
        heals.push({ name: party[k].name, amount, gained: healPartyMember(state, k, amount) });
      }
      events.push({ type: "partyHealed", item: it.n, heals });
      break;
    }
    case "full": {
      const before = c.wp;
      c.wp = c.maxWP;
      // VOX-05 (Phase 79, plan 79-02, todo 2026-09-25): `gained` is the HP
      // actually added after the clamp to max (additive, zero draws).
      events.push({ type: "healed", amount: c.maxWP, gained: c.wp - before });
      break;
    }
    case "poison":
    case "disease": {
      c.affliction = null;
      events.push({ type: "cured", kind });
      break;
    }
    // applyActivation (below, after this switch) starts the item's own
    // c.timers record; this switch writes no character field directly.
    // 260918-w4n: the 7 newly use-activated JEWELRY/CLOAKS kinds join this
    // plain-break list — power (Ring of Power), giant (Gauntlet of the
    // Giant), unseen (Anklet of Invisibility), tongue (Helm of Knowledge),
    // critWard (Cloak of Strength; "brace" until quick 260928-cos),
    // plate (Cloak of Armor), fly (Cloak of
    // Flying / Bracelet of Flight) — each is pure eff-payload data
    // (content/treasure-tables.js), so applyActivation starting the record
    // is the item's entire effect; nothing else fires here.
    // Phase 88 (ITEM-03, user 2026-09-30): `knit` (Cloak of Regeneration) joins
    // the list. It used to heal a d6 at once from the main rng; now using it
    // only starts the 30-square heal-over-time window (act.hot), whose ticks
    // come from tickHealOverTime on later steps, from a derived stream. No
    // instant heal and no main-rng draw on use.
    case "knit":
    case "strength":
    case "enlarge":
    case "speed":
    case "haste":
    case "acute":
    case "invis":
    case "ether":
    case "power":
    case "giant":
    case "unseen":
    case "tongue":
    case "critWard":
    case "plate":
    case "fly": {
      break;
    }
    case "half": {
      // Phase 89 (ITEM-06): the armed charge carries its source like a timer
      // record, `{ slot, n }` (truthy, so every read of `c.halfNext` is
      // unchanged); endSourceEffects disarms it when the Pendant leaves that
      // slot. A bag use, reachable only on a test double with no worn map,
      // carries slot null and is never linked.
      c.halfNext = { slot: slot || null, n: it.n };
      break;
    }
    case "glow": {
      // 260918-w4n: Amulet of Light, use-activated — dispels the persistent
      // darkness counter AT ONCE (mirrors movement.js's old per-step light
      // dispel), then applyActivation starts the 50-square glow effect (the
      // sight/light eff payload lives on the record, read via eff()).
      if (c.darkFor > 0) {
        c.darkFor = 0;
        events.push({ type: "darknessDispelled" });
      }
      break;
    }
    case "light": {
      // Phase 39 (GEAR-05): the torch — refused above (notDark) unless
      // inDark(state) is already true. Clears the persistent counter
      // outright (like the Amulet of Light's `light` eff, movement.js's
      // per-step tick); applyActivation (below, after this switch) starts
      // the 40-square `lit` effect record from TOOL_ACTIVATION_OF.Torch.
      const wasDark = c.darkFor > 0;
      c.darkFor = 0;
      events.push({ type: "torchLit", left: ACTIVATION_OF.Torch.effect, wasDark });
      break;
    }
    case "death": {
      c.wp = 0;
      die(state, "potion", null, rng, events, now);
      return events;
    }
    case "dome": {
      // RULES-14 (Phase 75): the false `reflect` key is dropped — no ward
      // ever carries one again (greenfield).
      c.ward = { pool: 100, rounds: 99, name: it.n };
      break;
    }
    case "freeze": {
      // DR16-G / Phase 15 (ECON-08): the AoE target count is now a per-item
      // field, defaulting to 2 (byte-identical to the old hard-coded slice for
      // the Birch Staff and every other freeze source). See the "stone" case
      // below for the full rationale; the Amulet of Stone is the only item that
      // overrides it (aoe:4). NOTE: the item's DISPLAY NAME lives on `.n`, so
      // the count is carried on `.aoe`, NOT `.n` as the CONTEXT shorthand said.
      // RULES-18 (Phase 75.3, audit C4): past the knee each target gets its
      // own resist, and a landed freeze sleeps controlHoldRoundsFor(depth)
      // rounds instead of 99; at or below the knee exactly as before.
      // Quick 260927-rsx (user ruling 2026-09-27): a staff's freeze is a
      // spell cast on each foe it reaches, so each first rolls its intel
      // resist (foeResistsSpell), then the depth resist above.
      // User rulings 2026-09-28 (Freeze): the staff's freeze follows the
      // Freeze spell — it never locks a foe "indefinitely" (asleep 99) any
      // more. Each foe it reaches goes through combat.js#freezeFoe: a new d4
      // (its rounds, drawn for every foe reached, resisted or not), the intel
      // resist, the RULES-18 control resist past the knee, then a frozen hold
      // for the d4's rounds. The staff has no to-hit and no damage of its
      // own, so a resist means no effect.
      foes.slice(0, it.aoe ?? 2).forEach((f) => {
        freezeFoe(state, f, it.n, rng, events);
      });
      break;
    }
    case "weaken": {
      // RULES-18 (Phase 75.3, audit C16): one resist for the room, keyed on
      // the first live foe; a resist marks every live foe Unmoved and weakens
      // nothing. A landed weaken lasts the fight at or below the knee (exactly
      // as before) and controlHoldRoundsFor(depth) rounds past it, through
      // the same `spell:weaken` timer whose expiry (combat.js#foeTurn's tail)
      // clears the flag and narrates weakenFaded.
      // Quick 260927-rsx: every live foe first rolls its own intel resist
      // (roomWeakenResists); the room's one depth resist follows, keyed on
      // the first live foe as before, and a landed weaken skips the foes
      // that resisted it.
      if (combat) {
        const aimed = foes[0];
        if (roomWeakenResists(state, aimed, it.n, rng, events)) {
          combat.weakened = true;
          const weakenRounds = controlHoldRoundsFor(state.floor?.depth);
          if (weakenRounds > 0) startEffect(c, "spell:weaken", { rounds: weakenRounds });
        }
      }
      break;
    }
    case "stone": {
      // DR16-G / Phase 15 (ECON-08): make the petrify AoE count a per-item
      // field `aoe` (default 2) so the Amulet of Stone can turn "up to 4
      // squares of opponents to stone" (aoe:4, content/treasure-tables.js)
      // while the Oak Staff and every other stone source keep the original 2.
      // The DEFAULT preserves byte-identical behavior for every existing stone
      // source (Oak Staff has no `aoe`, so `?? 2` = the old slice(0,2)); only
      // the Amulet — a treasure find no parity fixture USES — overrides it. The
      // per-foe killFoe rng draws are unchanged in shape; only the number of
      // foes the Amulet hits changes, and it drives no frozen fixture.
      // NOTE: the count is `it.aoe`, not `it.n` (the CONTEXT shorthand) — `.n`
      // is the item's display-name field throughout the codebase.
      const targets = foes.slice(0, it.aoe ?? 2);
      // RULES-18 (Phase 75.3, audit C6): past the knee each target gets its
      // own resist, then a stone HOLD (controlHoldRoundsFor rounds, the foe
      // stays in the fight) instead of the kill; only the foes the stone
      // actually kills are named below. At or below the knee no resist rolls
      // and no hold lands, so `stoned` is every target — exactly as before.
      // Quick 260927-rsx: each target first rolls its intel resist.
      const stoned = targets.filter((f) => {
        if (foeResistsSpell(state, f, it.n, rng, events)) return false;
        if (resistControl(state, f, "stone", it.n, combat.foes.indexOf(f), rng, events)) return false;
        if (controlHoldRoundsFor(state.floor?.depth) > 0) {
          holdFoe(state, f, "stone", it.n, events);
          return false;
        }
        return true;
      });
      // CMB-06 (Phase 31): one foeStoned {names} line naming every stoned foe
      // in target order, pushed BEFORE the per-foe kill loop (Pitfall 5 —
      // never batch the kills themselves; each still pays through its own
      // killFoe call, exactly like a melee kill of the same foe).
      if (stoned.length) events.push({ type: "foeStoned", names: stoned.map((f) => f.name) });
      stoned.forEach((f) => {
        f.wp = 0;
        killFoe(state, f, rng, events);
      });
      break;
    }
    case "fire": {
      const n = rng.d(6); // roll:amount
      // Quick 260927-rsx: the Pine Staff's fireballs are a spell cast on
      // every live foe — each rolls its intel resist once, up front (after
      // the fireball count); a fireball that comes round to a foe that
      // resisted does nothing and draws no damage.
      const shrugged = new Set(foes.filter((f) => foeResistsSpell(state, f, it.n, rng, events)));
      let tot = 0;
      for (let k = 0; k < n && foes.length; k++) {
        const t = foes[k % foes.length];
        if (!t.alive || shrugged.has(t)) continue;
        // Phase 31 Afraid: halves the hero's item-dealt fire damage
        // (post-roll arithmetic, zero rng change; a no-op unless
        // combat.afraid > 0).
        const dmg = afraidDamage(state, rng.d(10) + 4); // roll:amount
        // Item damage is physical (18-RESEARCH A3): soakable by sp.ar,
        // never multiplied (no caster identity applies to an item effect).
        const hit = damageFoe(state, t, dmg, { kind: "item", crit: false }, rng, events);
        tot += hit.applied;
        if (t.wp <= 0) killFoe(state, t, rng, events);
      }
      events.push({ type: "itemBurned", total: tot });
      break;
    }
    case "gas": {
      // RULES-18 (Phase 75.3, audit C12): past the knee each foe gets its own
      // resist, and a landed gas sleeps controlHoldRoundsFor(depth) rounds
      // instead of 99; at or below the knee exactly as before.
      const gasRounds = controlCapRounds(state.floor?.depth, 99);
      // Quick 260927-rsx: each foe first rolls its intel resist.
      foes.forEach((f) => {
        if (foeResistsSpell(state, f, it.n, rng, events)) return;
        if (resistControl(state, f, "sleep", it.n, combat.foes.indexOf(f), rng, events)) return;
        f.asleep = gasRounds;
      });
      break;
    }
    default:
      fizzled = true;
      events.push({ type: "itemFizzled" });
  }

  // Phase 39 (GEAR-02): the ONE timer-bookkeeping step every real
  // (non-fizzled) use runs — spends a staff charge / starts the item's own
  // effect-or-cooldown c.timers record. A fizzled use (the default branch
  // above) skips it entirely — nothing to start for a kind this switch does
  // not recognize.
  if (!fizzled) applyActivation(state, it, rng, events, slot || null);

  if (it.kind === "potion" || it.uses === 1 || it.kind === "tool") {
    if (slot) delete c.worn[slot];
    else c.items.splice(i, 1);
    events.push({ type: "itemConsumed", item: it });
  }

  // CMB-06 (Phase 31): the narrow cleared-check (mirrors combat.js's own
  // pre-emptive-kill guard, combat.js:399-402) — an item kill (stone/fire)
  // that removes the last live foe closes the encounter through the SAME
  // path any other kill does (encounterCleared -> endCombat -> the loot
  // card), instead of leaving state.combat stranded open with zero live
  // foes. Deliberately NOT the full afterPlayerAction (RESEARCH §8.2) — a
  // non-lethal item use never triggers foe retaliation; items stay free
  // actions, so this check only ever fires after a kill.
  if (state.combat && !liveFoes(state).length) {
    events.push({ type: "encounterCleared" });
    endCombat(state, events);
  }
  return events;
}
