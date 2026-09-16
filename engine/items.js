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

import { eff, skill, slotItems } from "./derived.js";
import { rollDice } from "./dice.js";
import { die } from "./death.js";
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
import { killFoe } from "./combat.js";
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
    const extra = Math.round(((rng.d(10) + rng.d(10)) * 10 * state.floor.depth) / LOOT_DIVISOR) + rng.d(4);
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
  return Object.assign({ kind: "jewel" }, JEWELRY[rng.d(8) - 1]);
}

export function rollCloak(rng) {
  return Object.assign({ kind: "cloak" }, CLOAKS[rng.d(8) - 1]);
}

export function rollStaff(rng) {
  return Object.assign({ kind: "staff", every: 250 }, STAVES[rng.d(8) - 1]);
}

/** Magical Weapons, p.48: the weapon table, then d6 on the bonus table. */
export function rollBlade(rng, depth, magical) {
  const base = rng.pick(Object.keys(WEAPONS));
  if (!magical) return { kind: "weapon", n: base, base, bonus: 0, txt: WEAPONS[base].lab };
  const b = rollDice(rng, WEAPON_BONUS_TABLE[rng.d(6) - 1]);
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
  const m = MAGIC_ARMOR_TABLE[rng.d(6) - 1];
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
 * rollTreasureItem(rng, depth, c) — the depth-scaled treasure roll. `c` is
 * the OPTIONAL carrying character, consulted only for the "already has
 * lockpicks" gate (ports mazeworld.html's `!hasPicks()` global read); a
 * caller with no character in hand (as the acceptance test does) is treated
 * as not yet carrying picks, matching the prototype's fresh-character case.
 * Ports mazeworld.html rollTreasureItem() (lines 1919-1927).
 */
export function rollTreasureItem(rng, depth, c) {
  if (!hasPicks(c || {}) && rng.d(12) === 1) {
    return { kind: "picks", n: "Lockpicks", txt: "1–5 on d10 against any lock" };
  }
  const r = rng.d(10);
  if (r <= 3) return rollBlade(rng, depth, true);
  if (r <= 5) return rollMailPiece(rng);
  if (r <= 7) return rollJewel(rng);
  if (r <= 9) return rollCloak(rng);
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
 * weaponUpgradeDelta(c, it) — how much MORE max damage weapon item `it` would
 * give `c` than the currently-wielded weapon (may be <= 0). The exact rule
 * takeItem's weapon branch uses to decide "is this better" — extracted here
 * (Phase 29, LOOT-03) so the shell's lootCompare view-model can read the
 * SAME arithmetic instead of restating it. Pure, no rng.
 */
export function weaponUpgradeDelta(c, it) {
  return (WEAPON_MAX[it.base] || 0) + (it.bonus || 0) - ((WEAPON_MAX[c.weapon] || 0) + (c.prof || 0) + (c.magicWpn || 0));
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
    events.push({ type: "itemTaken", item: it });
    c.weapon = it.base;
    c.prof = 0;
    c.magicWpn = it.bonus;
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
    events.push({ type: "itemTaken", item: it });
    c.armor = it.armor;
    c.ar = it.ar;
    c.armorMin = it.min;
    c.armorMax = it.wp;
    c.armorWP = it.wp;
    c.patches = 0;
    return events;
  }

  if (it.kind === "staff" && c.cls !== "Magic User") {
    events.push({ type: "itemRejected", item: it, reason: "wrongClass" });
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
   are inherently parity-safe (no fixture drives them). The bag-slot cap
   (content/bags.js BAGS[c.bag].slots) is enforced HERE and ONLY here (Phase 12
   deliberately left giveItem/gainWilmst/takeItem uncapped to keep the frozen
   parity fixtures byte-identical). */

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
  // A potion is slot-exempt (LOOT-04): it never counts toward capacity AND
  // is never itself refused by the gate, even when the bag's gear/treasure
  // count already sits at cap.
  if (it.kind !== "potion" && !canStow(c)) {
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
 * name; its magic bonus (c.magicWpn) IS preserved on `bonus`. */
function wornWeaponItem(c) {
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
 * takeFind(state, events) — ACCEPT the pending find (ECON-03). Adds
 * state.pendingFind to the bag if a slot is free; on a FULL bag keeps the item
 * pending and pushes `bagFull` (the UI then offers keep/drop, ECON-04). Found
 * weapons/armor land in the bag like anything else (NO auto-equip — that is the
 * player's separate equipItem choice); the flat `eff.wp` effect (if any) is
 * applied on pickup, exactly as giveItem does. Pure, no rng.
 */
export function takeFind(state, events = []) {
  const it = state.pendingFind;
  if (!it) return events;
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
  return events;
}

/**
 * equipItem(state, i, events) — equip carried weapon/armor `i` onto the
 * character (ECON-05), REGARDLESS of whether it is better or worse than the
 * worn piece (the deliberate change vs takeItem's strictly-better gate) — but
 * REJECTING an illegal class/subclass/race combination (`equipRejected`). The
 * equip is a DIRECT SWAP: the previously-worn piece drops back into the freed
 * bag slot (no net slot change); if the character wore nothing, the item is
 * simply removed from the bag (net −1). No-op on an out-of-range index. Pure,
 * no rng.
 *
 * Phase 28 (ARMOR-03): a piece that has been WORN carries `left`/`patches`
 * (set by wornArmorItem above) and comes back at that same durability — a
 * fresh piece (store, foe drop, kit, treasure — no `left` field) equips at
 * full via the `??` tolerant read, which also covers a pre-v1.3 save's bag
 * armor with no `left` at all. When the worn piece being swapped OUT is
 * destroyed, wornArmorItem returns null, so the swap simply removes the
 * newly-equipped item from the bag — the destroyed piece is gone, no bag
 * copy.
 */
export function equipItem(state, i, events = []) {
  const c = state.c;
  const it = (c.items || [])[i];
  if (!it) return events;

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
    if (worn) c.items[i] = worn;
    else c.items.splice(i, 1);
    events.push({ type: "itemEquipped", item: it, slot: "weapon" });
    return events;
  }

  if (it.kind === "armor") {
    const armorReason = armorRefusalReason(c, it);
    if (armorReason) {
      events.push({ type: "equipRejected", item: it, reason: armorReason });
      return events;
    }
    const worn = wornArmorItem(c);
    c.armor = it.armor;
    c.ar = it.ar;
    c.armorMin = it.min;
    c.armorMax = it.wp;
    c.armorWP = it.left ?? it.wp;
    c.patches = it.patches ?? 0;
    if (worn) c.items[i] = worn;
    else c.items.splice(i, 1);
    events.push({ type: "itemEquipped", item: it, slot: "armor" });
    return events;
  }

  // staves, cloaks, jewelry, potions, picks — not an equip slot
  events.push({ type: "equipRejected", item: it, reason: "notEquippable" });
  return events;
}

/**
 * unequipSlot(state, slot, events) — move the equipped weapon/armor back into
 * the bag (ECON-05), leaving the slot bare (a weapon → bare-handed "Fists",
 * armor → "Nothing"). Needs a free bag slot; on a FULL bag pushes `bagFull` and
 * does nothing. No-op when the slot is already bare. Pure, no rng.
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
export function unequipSlot(state, slot, events = []) {
  const c = state.c;
  const worn = slot === "weapon" ? wornWeaponItem(c) : slot === "armor" ? wornArmorItem(c) : null;
  if (slot === "armor" && !worn && c.armor && c.armor !== "Nothing" && c.ar > 0 && c.armorWP <= 0) {
    const destroyedName = c.armor;
    const destroyedAr = c.ar;
    c.armor = "Nothing";
    c.ar = 0;
    c.armorMin = 0;
    c.armorMax = 0;
    c.armorWP = 0;
    c.patches = 0;
    events.push({
      type: "itemUnequipped",
      item: { kind: "armor", n: destroyedName, armor: destroyedName, ar: destroyedAr, left: 0 },
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
  } else {
    c.armor = "Nothing";
    c.ar = 0;
    c.armorMin = 0;
    c.armorMax = 0;
    c.armorWP = 0;
    c.patches = 0;
  }
  events.push({ type: "itemUnequipped", item: worn, slot });
  return events;
}

/**
 * itemReady(state, it) — is an item off cooldown? Ports mazeworld.html
 * itemReady() (lines 1958-1962). NOTE: unlike the plan artifact's shorthand
 * `itemReady(c,it)`, this needs the run's step counter (`state.steps`) to
 * evaluate an `every`-squares cooldown, which the character alone does not
 * carry — so it takes the full `state`, not just `c` (Rule 1: the
 * documented character-only signature cannot express the prototype's
 * behavior).
 */
export function itemReady(state, it) {
  if (!it.use && it.kind !== "potion") return false;
  if (!it.every) return true;
  return state.steps - (it.usedAt ?? -99999) >= it.every;
}

/**
 * useItem(state, i, rng, events, now) — triggers carried item `i`'s effect.
 * Ports mazeworld.html useItem() (lines 1963-1995). Foe-targeting effects
 * (freeze/weaken/stone/fire/gas) read/write `state.combat.foes` directly;
 * a "kill" here is the minimal bookkeeping (`wp`/`alive`/`kills`) the item
 * itself owns — full combat resolution (loot, victory checks) is wired by
 * the combat slice (01-08) when it calls into a live `state.combat`.
 */
export function useItem(state, i, rng, events = [], now = Date.now) {
  const c = state.c;
  const it = (c.items || [])[i];
  if (!it || !itemReady(state, it)) return events;

  const kind = it.kind === "potion" ? it.eff2 : it.use;

  // DELIBERATE RULES CHANGE (Phase 24, 2026-09-14, IDENT-07): a Pilfer's
  // "cannot use a single magic item that doesn't heal" bad, enforced. Heal-
  // kind is discretionarily scoped to the two wp-restoring potion effects
  // (Healing "heal", Xtra Healing "full") — cures, buffs, staves, cloaks and
  // every other `use:` item are refused BEFORE any side effect, so a refused
  // use leaves usedAt/inventory/rng completely untouched. drinkPotion (the
  // separate generic healing-draught action) and canRead (engine/magic.js)
  // already gate a Pilfer independently and are untouched by this change.
  if (c.sub === "Pilfer" && kind !== "heal" && kind !== "full") {
    events.push({ type: "useRefused", item: it, reason: "pilfer" });
    return events;
  }

  it.usedAt = state.steps;
  events.push({ type: "itemUsed", item: it });

  const combat = state.combat;
  const foes = combat && combat.foes ? combat.foes.filter((f) => f.alive) : [];

  switch (kind) {
    case "heal": {
      const a = rng.d(10) + 2;
      c.wp = Math.min(c.maxWP, c.wp + a);
      events.push({ type: "healed", amount: a });
      break;
    }
    case "full": {
      c.wp = c.maxWP;
      events.push({ type: "healed", amount: c.maxWP });
      break;
    }
    case "poison":
    case "disease": {
      c.affliction = null;
      events.push({ type: "cured", kind });
      break;
    }
    case "strength": {
      c.might = (c.might || 0) + 8;
      break;
    }
    case "enlarge": {
      c.might = (c.might || 0) + 4;
      break;
    }
    case "speed":
    case "haste": {
      c.haste = 50;
      break;
    }
    case "acute": {
      c.acute = rng.d(8);
      break;
    }
    case "invis": {
      c.invis = 100;
      break;
    }
    case "ether": {
      c.ether = 20;
      break;
    }
    case "half": {
      c.halfNext = true;
      break;
    }
    case "death": {
      c.wp = 0;
      die(state, "potion", null, rng, events, now);
      return events;
    }
    case "dome": {
      c.ward = { pool: 100, rounds: 99, reflect: false, name: it.n };
      break;
    }
    case "freeze": {
      // DR16-G / Phase 15 (ECON-08): the AoE target count is now a per-item
      // field, defaulting to 2 (byte-identical to the old hard-coded slice for
      // the Birch Staff and every other freeze source). See the "stone" case
      // below for the full rationale; the Amulet of Stone is the only item that
      // overrides it (aoe:4). NOTE: the item's DISPLAY NAME lives on `.n`, so
      // the count is carried on `.aoe`, NOT `.n` as the CONTEXT shorthand said.
      foes.slice(0, it.aoe ?? 2).forEach((f) => (f.asleep = 99));
      break;
    }
    case "weaken": {
      if (combat) combat.weakened = true;
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
      foes.slice(0, it.aoe ?? 2).forEach((f) => {
        f.wp = 0;
        killFoe(state, f, rng, events);
      });
      break;
    }
    case "fire": {
      const n = rng.d(6);
      let tot = 0;
      for (let k = 0; k < n && foes.length; k++) {
        const t = foes[k % foes.length];
        if (!t.alive) continue;
        const dmg = rng.d(10) + 4;
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
      foes.forEach((f) => (f.asleep = 99));
      break;
    }
    default:
      events.push({ type: "itemFizzled" });
  }

  if (it.kind === "potion" || it.uses === 1) {
    c.items.splice(i, 1);
    events.push({ type: "itemConsumed", item: it });
  }
  return events;
}
