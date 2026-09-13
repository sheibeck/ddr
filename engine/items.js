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

import { eff, skill } from "./derived.js";
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
} from "../content/index.js";

export { eff };

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
    txt: `AR ${a.ar + m.ar}, ${a.wp + m.wp} wp`,
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
 * canEquipArmor(c, it) — ECON-05 (Phase 13): is armor item `it` LEGAL for `c`
 * to wear? The race/class gate ONLY (not the strictly-better AR check). A
 * noArmor race (RACES[c.race].noArmor, e.g. a form that cannot wear armor) can
 * wear nothing; otherwise the class must be listed in `it.cls`, OR the wearer
 * is a Thief with the Heft skill and the piece is light enough (AR ≤ 12).
 * Extracted verbatim from takeItem's armor gate. Pure, no rng, no mutation.
 */
export function canEquipArmor(c, it) {
  if (RACES[c.race].noArmor) return false;
  return !!(it.cls.includes(classLetter(c)) || (c.cls === "Thief" && skill(c, "Heft") && it.ar <= 12));
}

/* ---------------- equip / consume ---------------- */

/**
 * takeItem(state, it, events) — the weapon/armor equip-swap (only takes a
 * strictly-better item; staves require a Magic User; everything else goes
 * through giveItem). Ports mazeworld.html takeItem() (lines 1929-1955).
 * Re-pointed at the canEquipWeapon/canEquipArmor legality predicates above
 * (ECON-05) so its class/race gate is byte-identical to equipItem's — the
 * strictly-better AR/damage gate stays takeItem's own (the store's
 * buy=auto-equip convenience keeps it; equipItem deliberately drops it).
 */
export function takeItem(state, it, events = []) {
  const c = state.c;

  if (it.kind === "weapon") {
    const now = (WEAPON_MAX[c.weapon] || 0) + c.prof + c.magicWpn;
    const then = (WEAPON_MAX[it.base] || 0) + it.bonus;
    if (!canEquipWeapon(c, it)) {
      events.push({ type: "itemRejected", item: it, reason: "wrongClass" });
      return events;
    }
    if (then <= now) {
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
    if (RACES[c.race].noArmor) {
      events.push({ type: "itemRejected", item: it, reason: "noArmor" });
      return events;
    }
    if (!canEquipArmor(c, it)) {
      events.push({ type: "itemRejected", item: it, reason: "tooHeavy" });
      return events;
    }
    if (it.ar <= c.ar) {
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
 * clampCarry gate in engine/derived.js). */
function bagCap(c) {
  return c.bag && BAGS[c.bag] ? BAGS[c.bag].slots : Infinity;
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
 * ("Nothing"/AR 0). Like takeItem, only the base armor type + scalar AR/max
 * are retained on the character, so the reconstructed piece carries the base
 * name and its full (undamaged) max — re-equipping repairs it, matching
 * takeItem's own always-full-on-equip semantics. */
function wornArmorItem(c) {
  if (!c.armor || c.armor === "Nothing" || !(c.ar > 0)) return null;
  const base = ARMORS.find((a) => a.name === c.armor);
  return {
    kind: "armor",
    n: c.armor,
    armor: c.armor,
    ar: c.ar,
    wp: c.armorMax,
    min: c.armorMin,
    cls: base ? base.cls : "FTM",
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
  const c = state.c;
  const it = state.pendingFind;
  if (!it) return events;
  if ((c.items || []).length >= bagCap(c)) {
    events.push({ type: "bagFull", item: it });
    return events; // keep pending — the player must drop something first
  }
  giveItem(state, it, true, events); // quiet bag-add + eff.wp application
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
 */
export function equipItem(state, i, events = []) {
  const c = state.c;
  const it = (c.items || [])[i];
  if (!it) return events;

  if (it.kind === "weapon") {
    if (!canEquipWeapon(c, it)) {
      events.push({ type: "equipRejected", item: it, reason: "wrongClass" });
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
    if (RACES[c.race].noArmor) {
      events.push({ type: "equipRejected", item: it, reason: "noArmor" });
      return events;
    }
    if (!canEquipArmor(c, it)) {
      events.push({ type: "equipRejected", item: it, reason: "tooHeavy" });
      return events;
    }
    const worn = wornArmorItem(c);
    c.armor = it.armor;
    c.ar = it.ar;
    c.armorMin = it.min;
    c.armorMax = it.wp;
    c.armorWP = it.wp;
    c.patches = 0;
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
 */
export function unequipSlot(state, slot, events = []) {
  const c = state.c;
  const worn = slot === "weapon" ? wornWeaponItem(c) : slot === "armor" ? wornArmorItem(c) : null;
  if (!worn) return events; // nothing equipped in that slot (or unknown slot)
  if ((c.items || []).length >= bagCap(c)) {
    events.push({ type: "bagFull", item: worn });
    return events;
  }
  c.items = c.items || [];
  c.items.push(worn);
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

  it.usedAt = state.steps;
  events.push({ type: "itemUsed", item: it });

  const kind = it.kind === "potion" ? it.eff2 : it.use;
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
        t.wp -= dmg;
        tot += dmg;
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
