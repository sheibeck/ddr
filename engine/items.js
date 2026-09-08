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
   the book states outright are left alone. */
const LOOT_DIVISOR = 10;

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

/* ---------------- equip / consume ---------------- */

/**
 * takeItem(state, it, events) — the weapon/armor equip-swap (only takes a
 * strictly-better item; staves require a Magic User; everything else goes
 * through giveItem). Ports mazeworld.html takeItem() (lines 1929-1955).
 */
export function takeItem(state, it, events = []) {
  const c = state.c;

  if (it.kind === "weapon") {
    const letter = c.cls === "Fighter" ? "F" : c.cls === "Thief" ? "T" : "M";
    const legal =
      WEAPONS[it.base] && WEAPONS[it.base].cls.includes(letter) && (c.sub !== "Acrobat" || it.base === "Dagger");
    const now = (WEAPON_MAX[c.weapon] || 0) + c.prof + c.magicWpn;
    const then = (WEAPON_MAX[it.base] || 0) + it.bonus;
    if (!legal) {
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
    const letter = c.cls === "Fighter" ? "F" : c.cls === "Thief" ? "T" : "M";
    const allowed = it.cls.includes(letter) || (c.cls === "Thief" && skill(c, "Heft") && it.ar <= 12);
    if (!allowed) {
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
      foes.slice(0, 2).forEach((f) => (f.asleep = 99));
      break;
    }
    case "weaken": {
      if (combat) combat.weakened = true;
      break;
    }
    case "stone": {
      foes.slice(0, 2).forEach((f) => {
        f.wp = 0;
        f.alive = false;
        c.kills = (c.kills || 0) + 1;
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
        if (t.wp <= 0) {
          t.alive = false;
          c.kills = (c.kills || 0) + 1;
        }
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
