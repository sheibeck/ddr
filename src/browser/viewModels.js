// src/browser/viewModels.js
//
// DOM-free, pure view-models locking the engine→screen data contract for the
// Wave-5 screens (04-08) before any DOM exists (UX-04, UX-05). Every binding
// reads the REAL GameState.c + engine/derived.js — per 04-RESEARCH.md
// Pitfall 1, never the design mockup's throwaway state-object field names.
// No DOM, no Math.random, no rng draws that touch the live state's rngState.

import { WEAPONS, ARMORS, BAGS, STAFF_WEAPON } from "../../content/index.js";
import { armorSoak, takesBagSlot, gearCompareParts, activationFor, strikeDie, wieldedStaff } from "../../engine/derived.js";
import { weaponRefusalReason, armorRefusalReason, weaponUpgradeDelta, armorUpgradeDelta, bagCap } from "../../engine/items.js";
import { storeBuyRefusal } from "../../engine/economy.js";
import { upgradeWhyText, UPGRADE_WHY_COPY } from "./upgradeWhy.js";

/**
 * armorDisplay(c) — Phase 28 (ARMOR-02/04): the ONE render-ready description
 * of the character's effective armor — the sheet tile, the HUD armor line,
 * the gear worn row and the store repair row all call it (Plan 03 bridges it
 * onto the classic script's global namespace). It reads `armorSoak(c)` (engine/derived.js)
 * so it can never disagree with the combat soak site — the same
 * damageBracket <-> weaponDamage single-source pattern this file already
 * follows. Never reads the DOM, draws no rng. `magic` means the Cloak of
 * Armor is carried — it counts for ANY class, no Fighter gate (user
 * decision, Phase 28). `current`/`max` are always the WORN piece's pool,
 * because the cloak's plate never wears. Returns a plain object:
 * { label, ar, current, max, worn, destroyed, magic, sub, wornSub, under, line }.
 */
export function armorDisplay(c) {
  const av = armorSoak(c);
  const worn = Boolean(c.armor && c.armor !== "Nothing" && c.ar > 0);
  const destroyed = worn && c.armorWP <= 0;
  const current = worn ? c.armorWP : 0;
  const max = worn ? c.armorMax : 0;
  const ar = av.ar;
  const magic = av.magic;
  const label = magic ? "Cloak of Armor" : worn ? c.armor : "Nothing";
  const wornSub = !worn
    ? "AR 0"
    : destroyed
      ? `AR ${c.ar} · destroyed`
      : `AR ${c.ar} · ${current}/${max} hp`;
  const sub = magic ? `AR ${ar} · magic plate, never wears` : wornSub;
  const under = !magic
    ? null
    : !worn
      ? "under the cloak: nothing"
      : destroyed
        ? `under the cloak: ${c.armor}, destroyed`
        : `under the cloak: ${c.armor} ${current}/${max} hp`;
  const line = `${label} · ${sub}`;
  return { label, ar, current, max, worn, destroyed, magic, sub, wornSub, under, line };
}

/**
 * bagArmorText(it) — Phase 28 (ARMOR-03): renders a bag armor row from the
 * item's own remaining durability (`left`, falling back to `wp` for a fresh
 * piece that has never been worn — tolerant of pre-v1.3 saves that carry no
 * `left` field at all).
 */
export function bagArmorText(it) {
  const left = it.left ?? it.wp;
  return left > 0 ? `AR ${it.ar} · ${left}/${it.wp} hp` : `AR ${it.ar} · destroyed`;
}

/** classNames(letters) — Phase 29 (LOOT-03): "FTM"-style class-letter string
 * -> a human-readable class-name list joined with " or " (e.g. "F" ->
 * "Fighter", "FT" -> "Fighter or Thief"). Unknown letters pass through
 * verbatim rather than throwing — defensive for content it can't foresee. */
function classNames(letters) {
  const NAME = { F: "Fighter", T: "Thief", M: "Magic User" };
  return (letters || "")
    .split("")
    .map((l) => NAME[l] || l)
    .join(" or ");
}

/** refusalText(reason, clsLetters) — Phase 29 (LOOT-03): the loot screen's
 * "can't use (...)" fragment for a weaponRefusalReason/armorRefusalReason
 * code. Mirrors src/browser/narrationLines.js's EQUIP_REJECT_TEXT wording without
 * importing it (that table also covers notEquippable/notBetter, which never
 * reach lootCompare's illegal-gear branch). */
function refusalText(reason, clsLetters) {
  switch (reason) {
    case "wrongClass":
    case "tooHeavy":
      return `${classNames(clsLetters)} only`;
    case "acrobat":
      return "Acrobat: dagger only";
    case "noArmor":
      return "your kind wears no armour";
    case "woodsman":
      return "no mail or plate for a Woodsman";
    default:
      return "not for you";
  }
}

/**
 * USABLE_COPY — Phase 43 (CLAR-02): every player-facing string `usableBy`
 * (below) builds from — a frozen object like ITEM_STATE_COPY/ABILITY_VIEW_COPY
 * elsewhere in this module, so the voice scan and the hp-not-wp guard can
 * both walk it as a single leaf group.
 */
export const USABLE_COPY = Object.freeze({
  F: "Fighters",
  T: "Thieves",
  M: "Magic Users",
  usable: "(usable by {who})",
  notYou: "(usable by {who} — not you)",
  heft: "(usable by {who} — and a Thief with Heft)",
});

/**
 * STORE_ROW_COPY — Phase 61 (STORE-02): the one frozen copy object
 * `storeRowState`'s room-refusal reason text reads from — a leaf-string
 * bank like USABLE_COPY above, walked by the hp-not-wp guard and the voice
 * safety scan. A legality refusal reads `lootCompare`'s own "can't use
 * (…)" line instead (never restated here); a gold shortfall reads nothing
 * (the price column already says it).
 */
export const STORE_ROW_COPY = Object.freeze({
  bagFull: "bag full — sell or drop something first",
});

/**
 * restrictedClasses(it) — Phase 43 (CLAR-02): the raw F/T/M letters string a
 * weapon/armor/staff item is restricted to, or `null` when the item carries
 * no class restriction at all (an "FTM" weapon/armor, or any other kind —
 * cloak/jewel/potion/tool/bag). A staff is Magic User only (mirrors
 * engine/items.js#autoWearSlot's `it.kind === "staff" && c.cls !== "Magic
 * User"` gate — never restated as a separate rule, only the class letter is
 * local here). Null-safe on a sparse/legacy item (no `base`, an unknown
 * `armor` name). Pure, no rng, no mutation.
 */
function restrictedClasses(it) {
  if (!it || typeof it !== "object") return null;
  let letters = null;
  if (it.kind === "weapon") {
    letters = WEAPONS[it.base]?.cls ?? null;
  } else if (it.kind === "armor") {
    letters = it.cls ?? ARMORS.find((a) => a.name === it.armor)?.cls ?? null;
  } else if (it.kind === "staff") {
    letters = "M";
  }
  return letters && letters !== "FTM" ? letters : null;
}

/**
 * usableBy(it, c = null) — Phase 43 (CLAR-02): the ONE "(usable by …)" rule
 * for the FIND card, the victory LOOT screen (via `lootCompare.usable`), and
 * store rows (Plan 04 bridges it as `window.__mzUsableBy`). Legality is the
 * engine's OWN `weaponRefusalReason`/`armorRefusalReason` (engine/items.js)
 * for weapons/armor and the staff Magic-User gate for a staff — never a
 * restated class rule; only the display text lives here. Without a hero
 * (`c === null`) it names who CAN use the item; with one, it additionally
 * says whether THIS hero can — "— not you" when illegal, or "— and a Thief
 * with Heft" for the one case where a Thief with the Heft skill can legally
 * wear armor a letter-only read would call Fighter-only. Returns `""` for an
 * unrestricted item or any kind this rule does not gate. Pure, no rng, no
 * DOM, never throws on a sparse item.
 */
export function usableBy(it, c = null) {
  const letters = restrictedClasses(it);
  if (!letters) return "";
  const who = letters
    .split("")
    .map((l) => USABLE_COPY[l] ?? l)
    .join(", ");
  const usable = USABLE_COPY.usable.replace("{who}", who);
  if (!c) return usable;

  let legal;
  if (it.kind === "weapon") legal = weaponRefusalReason(c, it) === null;
  else if (it.kind === "armor") legal = armorRefusalReason(c, it) === null;
  else if (it.kind === "staff") legal = c.cls === "Magic User";
  else legal = true;

  if (!legal) return USABLE_COPY.notYou.replace("{who}", who);
  const heroLetter = c.cls === "Fighter" ? "F" : c.cls === "Thief" ? "T" : "M";
  if (!letters.includes(heroLetter)) return USABLE_COPY.heft.replace("{who}", who);
  return usable;
}

/**
 * ITEM_STAT_COPY — Phase 71 (POLISH-06, D-04): every label and text
 * template `itemStatLines` (below) emits — a frozen leaf-string bank like
 * USABLE_COPY/STORE_ROW_COPY above, walked by the hp-not-wp guard and the
 * voice safety scan. `label` names each stat (for a screen reader or a
 * future labelled layout); `text` holds the display templates. Durability
 * reads "hp", never "WP" (Phase 43 CLAR-01).
 */
export const ITEM_STAT_COPY = Object.freeze({
  label: Object.freeze({
    damage: "Damage",
    ar: "Armour rating",
    wear: "Durability",
    enchanted: "Enchantment",
    effect: "Effect",
    charges: "Charges",
    slots: "Bag slots",
    usable: "Usable by",
    // RULES-13 (Phase 75): a staff's wield line — its own stat, distinct
    // from `effect` (the item's charged power) and shown on both the bag
    // and worn read of the same item (wornItemFor(c, "weapon") returns the
    // wielded staff, so itemStatLines formats it identically either way).
    wield: "Wield",
  }),
  text: Object.freeze({
    bonus: "{lab} +{n}",
    ar: "AR {n}",
    wear: "{left}/{max} hp",
    destroyed: "destroyed",
    enchanted: "enchanted",
    charges: "{n}/{max} charges",
    slots: "{n} slots",
    wield: "Wielded: {lab} weapon; its power works only in hand.",
  }),
});

/** statLine(key, value, text) — one frozen formatter entry. */
function statLine(key, value, text) {
  return Object.freeze({ key, label: ITEM_STAT_COPY.label[key], value, text });
}

/** heroFor(c) — the hero usableBy may judge against, or null. A sparse or
 * missing hero (no class/race) reads as "no hero", so usableBy names who CAN
 * use the item instead of throwing on a missing race row. */
function heroFor(c) {
  return c && typeof c === "object" && c.cls && c.race ? c : null;
}

/**
 * itemStatLines(item, c = null) — Phase 71 (POLISH-06, D-04): the ONE stat
 * formatter the store stock rows (src/browser/storeScreen.js) and the Gear
 * tab's action sheet (src/browser/gearSheet.js) both read, so the two
 * surfaces can never drift. Display text only — it restates no rule:
 * legality stays in `usableBy` (reused here, never restated), the upgrade
 * verdict stays in `lootCompare`, the damage label stays
 * `WEAPONS[base].lab`, and durability reads `bagArmorText`'s own tolerant
 * `left ?? wp` rule. Returns a frozen array of frozen
 * `{ key, label, value, text }` entries in a fixed per-kind order:
 *   - weapon: damage (`lab`, plus " +N" only when bonus > 0 — never "+0"),
 *     enchanted (bonus > 0), usable;
 *   - armor: ar, wear (`left/wp hp`, or "destroyed" at left <= 0),
 *     enchanted (AR or durability above the ARMORS table row — a warded
 *     piece, readable from a worn slot too), usable;
 *   - staff: effect (`txt`), charges (`n/max`, max from the activation
 *     table), usable;
 *   - bag: slots (`BAGS[tier].slots`);
 *   - any other kind with `txt` (cloak, jewel, potion, tool, picks): effect,
 *     then usable (always empty for these today).
 * `null`, a non-object, an unknown kind with no `txt`, a weapon whose base
 * is not in WEAPONS, an armour with no numeric AR, or a bag of an unknown
 * tier returns `[]`. Pure, no rng, never mutates `item` or `c`, never
 * throws.
 */
export function itemStatLines(item, c = null) {
  if (!item || typeof item !== "object") return Object.freeze([]);
  const hero = heroFor(c);
  const lines = [];
  const pushUsable = () => {
    const usable = usableBy(item, hero);
    if (usable) lines.push(statLine("usable", usable, usable));
  };

  if (item.kind === "weapon") {
    const w = WEAPONS[item.base];
    if (!w) return Object.freeze([]);
    const bonus = Number.isInteger(item.bonus) && item.bonus > 0 ? item.bonus : 0;
    const damage = bonus ? ITEM_STAT_COPY.text.bonus.replace("{lab}", w.lab).replace("{n}", bonus) : w.lab;
    lines.push(statLine("damage", damage, damage));
    if (bonus) lines.push(statLine("enchanted", bonus, ITEM_STAT_COPY.text.enchanted));
    pushUsable();
    return Object.freeze(lines);
  }

  if (item.kind === "armor") {
    if (typeof item.ar !== "number") return Object.freeze([]);
    lines.push(statLine("ar", item.ar, ITEM_STAT_COPY.text.ar.replace("{n}", item.ar)));
    const left = item.left ?? item.wp;
    if (typeof left === "number") {
      const text = left > 0 ? ITEM_STAT_COPY.text.wear.replace("{left}", left).replace("{max}", item.wp) : ITEM_STAT_COPY.text.destroyed;
      lines.push(statLine("wear", left > 0 ? left : 0, text));
    }
    const base = ARMORS.find((a) => a.name === item.armor);
    if (base && (item.ar > base.ar || (typeof item.wp === "number" && item.wp > base.wp))) {
      lines.push(statLine("enchanted", item.ar - base.ar, ITEM_STAT_COPY.text.enchanted));
    }
    pushUsable();
    return Object.freeze(lines);
  }

  if (item.kind === "bag") {
    const bag = BAGS[item.tier];
    if (!bag) return Object.freeze([]);
    lines.push(statLine("slots", bag.slots, ITEM_STAT_COPY.text.slots.replace("{n}", bag.slots)));
    return Object.freeze(lines);
  }

  // RULES-13 (Phase 75): a staff (bag or wielded — wornItemFor(c, "weapon")
  // returns the wielded object itself) states what wielding does BEFORE its
  // effect and charges, so a bagged staff never reads as if its power
  // already works.
  if (item.kind === "staff") {
    const wield = ITEM_STAT_COPY.text.wield.replace("{lab}", STAFF_WEAPON.lab);
    lines.push(statLine("wield", wield, wield));
  }
  if (typeof item.txt === "string" && item.txt) lines.push(statLine("effect", item.txt, item.txt));
  if (item.kind === "staff") {
    const act = activationFor(item);
    if (act && act.charges !== undefined) {
      const n = Number.isInteger(item.charges) ? item.charges : act.charges;
      lines.push(statLine("charges", n, ITEM_STAT_COPY.text.charges.replace("{n}", n).replace("{max}", act.charges)));
    }
  }
  if (!lines.length) return Object.freeze([]);
  pushUsable();
  return Object.freeze(lines);
}

/**
 * wornItemFor(c, slot) — Phase 71 (POLISH-06, D-04): the item-shaped view
 * of a WORN slot, so a worn piece formats through the SAME
 * `itemStatLines` as a bag item. A worn weapon or armour has no item object
 * on `c` (the engine keeps c.weapon/c.magicWpn and c.armor/c.ar/c.armorMax/
 * c.armorWP instead), so this adapter mirrors the engine's own
 * wornWeaponItem/wornArmorItem shapes (engine/items.js, not exported) —
 * `cls` from the ARMORS row, `left` from c.armorWP — which is exactly the
 * item the engine hands back on an unequip. Equipping therefore never
 * changes a stat list except durability wear. The Cloak of Armor's magic
 * plate is not a worn piece: `armorDisplay(c).worn` decides, so a cloak
 * with nothing under it reads `null`. cloak/jewelry1/jewelry2 return
 * `c.worn[slot]` itself. `null` for an empty slot, an unknown slot or a
 * missing `c`. Pure, never mutates `c`.
 */
export function wornItemFor(c, slot) {
  if (!c || typeof c !== "object") return null;
  if (slot === "weapon") {
    // RULES-13 (Phase 75): a wielded staff (its LIVE charges included) is
    // the weapon slot's real item now — the same object gearBagCardsModel
    // would show if it were bagged instead, so both formatters agree.
    const staff = wieldedStaff(c);
    if (staff) return staff;
    if (!c.weapon || !WEAPONS[c.weapon]) return null;
    return { kind: "weapon", n: c.weapon, base: c.weapon, bonus: c.magicWpn || 0 };
  }
  if (slot === "armor") {
    if (!armorDisplay(c).worn) return null;
    const base = ARMORS.find((a) => a.name === c.armor);
    return {
      kind: "armor",
      n: c.armor,
      armor: c.armor,
      ar: c.ar,
      wp: c.armorMax,
      left: c.armorWP,
      min: c.armorMin,
      cls: base ? base.cls : "FTM",
    };
  }
  if (slot === "cloak" || slot === "jewelry1" || slot === "jewelry2") {
    return (c.worn && c.worn[slot]) || null;
  }
  return null;
}

/**
 * lootCompare(c, it) — Phase 29 (LOOT-03; Phase 61 STORE-03 additive `why`
 * field): the ONE compare-to-equipped verdict for a loot/find item,
 * mirroring armorDisplay's single-source pattern — the verdict is takeItem's
 * own weaponUpgradeDelta/armorUpgradeDelta (engine/items.js), never a
 * restated formula, so the screen can never disagree with what the engine
 * would actually do. `why` (Phase 61) is the explanation of that verdict —
 * `upgradeWhyText(gearCompareParts(c, it))`, built from the SAME derived
 * helpers the verdict already read — advice only, it never disables BUY,
 * TAKE or EQUIP. Returns a plain object `{ kind, legal, reason, delta,
 * upgrade, equipNow, line, sub, why }`; the shell joins `line`/`sub` itself
 * (lootCompare never joins them). Pure, no rng, no mutation.
 */
export function lootCompare(c, it) {
  if (it.kind === "weapon") {
    const reason = weaponRefusalReason(c, it);
    const delta = weaponUpgradeDelta(c, it);
    const legal = reason === null;
    const upgrade = delta > 0;
    const equipNow = legal && upgrade;
    // Phase 74 (ROLL-02/03): the die and the wielded weapon's own name so
    // upgradeWhyText can state which way the to-hit change goes ("your
    // Club") and write the crit-range term on the hero's own strike die.
    const haveName = WEAPONS[c.weapon] ? c.weapon : UPGRADE_WHY_COPY.bareHands;
    const why = legal ? upgradeWhyText(gearCompareParts(c, it), { dieN: strikeDie(c), haveName }) : null;
    const line = !legal
      ? `can't use (${refusalText(reason, WEAPONS[it.base]?.cls ?? "")})`
      : `${why}${UPGRADE_WHY_COPY.sep}${upgrade ? UPGRADE_WHY_COPY.upgrade : UPGRADE_WHY_COPY.notUpgrade}`;
    // Phase 43 (CLAR-02, additive field): the same "(usable by …)" suffix
    // the FIND card and store rows show, read from the ONE usableBy rule.
    return { kind: "weapon", legal, reason, delta, upgrade, equipNow, line, sub: it.txt ?? "", why, usable: usableBy(it, c) };
  }

  if (it.kind === "armor") {
    const reason = armorRefusalReason(c, it);
    const delta = armorUpgradeDelta(c, it);
    const legal = reason === null;
    const upgrade = delta > 0;
    const equipNow = legal && upgrade;
    const why = legal ? upgradeWhyText(gearCompareParts(c, it)) : null;
    const line = !legal
      ? `can't use (${refusalText(reason, it.cls ?? "")})`
      : `${why}${UPGRADE_WHY_COPY.sep}${upgrade ? UPGRADE_WHY_COPY.upgrade : UPGRADE_WHY_COPY.notUpgrade}`;
    // The AR is already in `line` above — sub carries only the durability
    // pool (Phase 28's tolerant `left ?? wp` read for a fresh, never-worn drop).
    const left = it.left ?? it.wp;
    const sub = left > 0 ? `${left}/${it.wp} hp` : "destroyed";
    // Phase 43 (CLAR-02, additive field)
    return { kind: "armor", legal, reason, delta, upgrade, equipNow, line, sub, why, usable: usableBy(it, c) };
  }

  if (it.kind === "bag") {
    const line = `${BAGS[it.tier]?.slots ?? "?"} slots — you carry ${bagCap(c) === Infinity ? "no bag" : bagCap(c)}`;
    // sub is deliberately blank — it.txt would just repeat the slot count.
    // Phase 43 (CLAR-02, additive field): a bag is never class-restricted, so usable is always "".
    return { kind: "bag", legal: true, reason: null, delta: null, upgrade: null, equipNow: false, line, sub: "", why: null, usable: usableBy(it, c) };
  }

  // RULES-13 (Phase 75): a staff's own gearSheet/gearTab compare card — the
  // Magic User class gate is its ONLY legality (never a need/crit/weight
  // comparison, since every staff fights identically, flat d8 — there is no
  // "upgrade" verdict to draw), and the line IS the wield explainer
  // (ITEM_STAT_COPY.text.wield), the same text itemStatLines shows, so a
  // legal staff card's "why" line never disagrees with its own stat list.
  if (it.kind === "staff") {
    const legal = c.cls === "Magic User";
    const line = legal
      ? ITEM_STAT_COPY.text.wield.replace("{lab}", STAFF_WEAPON.lab)
      : `can't use (${refusalText("wrongClass", "M")})`;
    return {
      kind: "staff",
      legal,
      reason: legal ? null : "wrongClass",
      delta: null,
      upgrade: null,
      equipNow: false,
      line,
      sub: it.txt ?? "",
      why: null,
      usable: usableBy(it, c),
    };
  }

  // Phase 43 (CLAR-02, additive field): the fallthrough (jewel/cloak/potion/tool/etc) is never class-restricted.
  return { kind: it.kind, legal: true, reason: null, delta: null, upgrade: null, equipNow: false, line: it.txt ?? "", sub: "", why: null, usable: usableBy(it, c) };
}

/**
 * storeRowState(c, line) — Phase 61 (STORE-02/03): the ONE view model a
 * store stock row reads to decide whether BUY is disabled, why (when the
 * row itself carries the reason — a gold shortfall is already named by the
 * price column, so it never repeats here), and the explained
 * upgrade-or-not advice line for a weapon/armor/premium row.
 * `disabled`/`refusal` come from the engine's own `storeBuyRefusal`
 * (engine/economy.js) — the SAME predicate `buyFrom` settles with — so the
 * row can never disagree with what tapping BUY would actually do. The
 * verdict and its explanation come only from `lootCompare` above, never a
 * restated rule; advice (`compareLine`) never feeds `disabled`. Pure —
 * never mutates `c` or `line`; two calls with the same inputs deep-equal.
 * Returns `{ disabled, refusal, reasonText, compareLine, showUsable }`.
 */
export function storeRowState(c, line) {
  const refusal = line.sold ? null : storeBuyRefusal(c, line);
  const disabled = !!line.sold || refusal !== null;
  const it = line.effectParams && line.effectParams.item;
  const gear = !!it && (it.kind === "weapon" || it.kind === "armor");
  const cmp = gear ? lootCompare(c, it) : null;
  const reasonText =
    gear && cmp && !cmp.legal
      ? cmp.line
      : refusal && refusal.reason === "bagFull"
        ? STORE_ROW_COPY.bagFull
        : null;
  const compareLine = !line.sold && gear && cmp.legal ? cmp.line : null;
  const showUsable = !(gear && cmp && !cmp.legal);
  return { disabled, refusal, reasonText, compareLine, showUsable };
}

/**
 * dropShelfItems(c) — Phase 43 (CLAR-04): the bag-full drop prompt's ONE
 * source list — slot-consuming BAG items only (the same bag-free rule as
 * `engine/derived.js#takesBagSlot` — potions, scrolls, bags — kept in
 * lock-step with `slotItems` by test), with the true `c.items` index so
 * `dropItem(i)` addresses the right entry. Never a worn slot item, never the
 * wielded weapon or worn armor (those are not in `c.items` at all). Returns
 * the SAME item references as `c.items` (no clone); never mutates `c`.
 * Defensive against a missing/non-array `c.items` (returns `[]`). Pure, no
 * rng.
 */
export function dropShelfItems(c) {
  return (c && Array.isArray(c.items) ? c.items : [])
    .map((it, i) => ({ it, i }))
    .filter(({ it }) => takesBagSlot(it));
}

// Matches the roll-detail span src/browser/engineAdapter.js's formatEvent()
// already embeds inline (e.g. `<span class="roll">7</span>`).
const ROLL_SPAN_RE = /<span class="roll">([\s\S]*?)<\/span>/;

/**
 * oracleLogViewModel(entries, diceMode) — the ORACLE tab's (and, per
 * 04-UI-SPEC.md, the combat log's) render-ready rows. `entries` is the
 * formatEvents()-shaped array of HTML narration strings, accumulated
 * oldest-first; this returns rows newest-first. Each row is
 * {narration, roll, revealable, revealedByDefault}:
 *   - a line with no roll span: {roll: null, revealable: false, revealedByDefault: false}
 *     under every diceMode (no reveal affordance to show).
 *   - diceMode 'on tap' (default): revealable true, hidden until tapped.
 *   - diceMode 'always': revealable true, revealed by default.
 *   - diceMode 'never': roll omitted (null), not revealable.
 * Pure/DOM-free — no reveal STATE is tracked here, only the gating flags the
 * renderer needs to decide what to show.
 */
export function oracleLogViewModel(entries, diceMode) {
  const rows = entries.map((entry) => {
    const html = typeof entry === "string" ? entry : entry && entry.html;
    const match = ROLL_SPAN_RE.exec(html || "");
    const roll = match ? match[1] : null;
    const narration = match ? (html.slice(0, match.index) + html.slice(match.index + match[0].length)).trim() : (html || "").trim();

    if (roll === null) {
      return { narration, roll: null, revealable: false, revealedByDefault: false };
    }
    if (diceMode === "never") {
      return { narration, roll: null, revealable: false, revealedByDefault: false };
    }
    if (diceMode === "always") {
      return { narration, roll, revealable: true, revealedByDefault: true };
    }
    // diceMode === "on tap" (default): hidden until tapped.
    return { narration, roll, revealable: true, revealedByDefault: false };
  });
  return rows.reverse();
}
