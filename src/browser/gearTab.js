// src/browser/gearTab.js
//
// Phase 47 (SHELL-01), Plan 03 — the GEAR tab: ON YOU / ALSO ON YOU / BAG
// rendering, the shared carried-item list with its drop/swap confirms, and
// the Gear view models. Contract: renderGearTab(host, state, deps) — see
// docs/SHELL-MODULES.md. No window/document globals: host.ownerDocument +
// deps only.
//
// Task 1: a pure move of the five Gear-only view models out of
// viewModels.js (bagUsage, GEAR_COPY, emptySlotRows, ITEM_STATE_COPY,
// itemRowState) — bodies and doc comments unchanged.
// Task 2 (this commit): renderGearTab/renderCarriedList land here verbatim
// from the classic script's paint()/renderCarriedList, with window/document
// globals replaced by host.ownerDocument + deps, and the retired
// window.__mz* bridges (itemRowState/bagArmorText/slotFor/WORN_KEYS_OF/
// sellPriceFor/lootCompare) replaced by direct imports.

import { WORN_SLOTS, WORN_KEYS_OF, activationFor, itemTimerId, chargesTimerId, slotFor } from "../../engine/derived.js";
import { isReady, remaining } from "../../engine/effects.js";
import { bagCap, canStow, slotItems } from "../../engine/items.js";
import { canRead } from "../../engine/magic.js";
import { maxCharges } from "../../engine/movement.js";
import { sellPriceFor } from "../../engine/economy.js";
import { WEAPONS } from "../../content/index.js";
import { armorDisplay, bagArmorText, lootCompare, usableBy, dropShelfItems } from "./viewModels.js";
// Phase 62 (GSCR-06) — gearConsumablesModel's SCROLLS row reads the engine's
// own scroll refusal line (never a restated reason string); a separate
// import line so it never collides with the pinned derived.js import above.
import { LINE_FOR } from "./narrationLines.js";

/**
 * bagUsage(c) — Phase 29 (LOOT-04): the ONE "used / slots" readout the
 * gear panel, find card, loot screen and store display all read (Plan 03
 * bridges it as window.__mzBagUsage). Pure, no rng.
 */
export function bagUsage(c) {
  const have = slotItems(c).length;
  const cap = bagCap(c);
  const slots = cap === Infinity ? null : cap;
  return { have, slots, full: !canStow(c), text: slots ? `${have} / ${slots}` : have ? `${have}` : "" };
}

/**
 * GEAR_COPY — Phase 43 (CLAR-04): every player-facing string the Gear tab's
 * ON YOU panel (`emptySlotRows` below) and Plan 04's shell wiring build
 * from — a frozen object like ITEM_STATE_COPY/RATIONS_COPY elsewhere in this
 * module, so the voice scan and the hp-not-wp guard can both walk it as a
 * single leaf group. `empty` is nested and frozen too. The worn-slot empty
 * states read as SLOTS, in voice (CONTEXT §CLAR-04: "ring — nothing"), never
 * a bare dash. 260918-w4n (staff amendment): a staff is a bag item now, so
 * it carries no empty-slot row at all. 260918-wy1 (jewelry-merge): the four
 * former sub-slot leaves (ring/bracelet/amulet/helm) are replaced by TWO
 * key-named leaves, `jewelry1`/`jewelry2` — `WORN_SLOTS` is now the three
 * keys jewelry1/jewelry2/cloak, so `empty` has exactly the leaves armor,
 * jewelry1, jewelry2, cloak.
 *
 * Phase 62 (GSCR-01..06): extended for the rebuilt Gear tab's slim header,
 * five-row WORN list, USE cell, bag meter, bag cards, CONSUMABLES and ALSO
 * ON YOU (kit) sections — every new string the Plan 01 view models
 * (gearHeaderModel/gearUseCell/gearWornModel/gearBagMeterModel/
 * gearBagCardsModel/gearConsumablesModel/gearKitRows) build from lives here
 * too, so the voice scan and the hp-not-wp guard keep walking ONE object.
 * `empty.weapon` is new (a bare-fisted weapon slot now gets its own in-voice
 * empty line, same as the other four). Every nested group stays frozen.
 */
export const GEAR_COPY = Object.freeze({
  onYou: "ON YOU",
  wielded: "WIELDED",
  worn: "WORN",
  alsoOnYou: "ALSO ON YOU",
  bag: "BAG",
  freeRide: "potions & scrolls ride free",
  empty: Object.freeze({
    weapon: "fists — nothing in hand. Free, always with you, and not very good.",
    armor: "armor — nothing. The wind is your armor, and the wind is not on your side.",
    jewelry1: "jewelry — nothing. Ten fingers, one neck, zero commitments.",
    jewelry2: "jewelry — nothing. Room for one more bad decision.",
    cloak: "cloak — nothing. Cold and unmagical, in that order.",
  }),
  armorRating: "ARMOR RATING",
  wilmst: "WILMST",
  consumables: "CONSUMABLES",
  count: "{n} / {max}",
  held: "{n} HELD",
  slot: Object.freeze({
    weapon: "WEAPON",
    armor: "ARMOR",
    cloak: "CLOAK",
    jewelry1: "JEWELRY 1",
    jewelry2: "JEWELRY 2",
  }),
  family: Object.freeze({
    weapon: "WEAPON",
    armor: "ARMOR",
    cloak: "CLOAK",
    jewelry: "JEWELRY",
  }),
  swap: " · SWAP",
  emptyName: "empty",
  noValue: "—",
  chevron: "›",
  weaponMagic: "+{n} magic. Somebody cared, once.",
  weaponMundane: "no enchantment. Just you and the swing.",
  magicPlate: "magic plate",
  armorWear: "{current}/{max} hp",
  armorDestroyed: "destroyed",
  bagFull: "BAG FULL · DROP OR USE SOMETHING",
  bagEmptyHead: "NOTHING LEFT TO CARRY",
  bagEmptyBody: "You used it all. That was the plan, technically.",
  use: Object.freeze({
    use: "USE",
    active: "ACTIVE",
    cooling: "COOLING",
    read: "READ",
  }),
  healingPotion: "HEALING POTION",
  healingDesc: "Heals. Wasted at full health.",
  scrolls: "SCROLLS",
  scrollDesc: "A random spell, read aloud. No refunds.",
  qty: "×{n}",
  kit: Object.freeze({
    rations: "Rations",
    rationsValue: "{n} days",
    spellCharges: "Spell charges",
    spellChargesValue: "{k} / {max}",
    wardValue: "{pool} hp left · {rounds} rds",
    strength: "Strength",
    strengthValue: "+{n} damage",
    regen: "Regeneration",
    regenValue: "d8 a round",
    mirror: "Mirror Self",
    mirrorValue: "{n} rds",
    senses: "Sense Presence",
    sensesValue: "till the fight ends",
    foresight: "Sense Danger",
    foresightValue: "armed",
    reveal: "Map the Floor",
    revealValue: "{n} sq",
    kills: "Kills",
  }),
  act: Object.freeze({
    unequip: "Unequip",
    bagFull: "Bag full",
  }),
});

/**
 * emptySlotRows(c) — Phase 43 (CLAR-04) + 260918-w4n (staff amendment) +
 * 260918-wy1 (jewelry-merge) + Phase 62 (GSCR-02, weapon row): one in-voice
 * row per EMPTY worn KEY, in this fixed order — weapon (only when `c.weapon`
 * is bare: "Fists", "", undefined or any name not in `WEAPONS`), armor (via
 * `armorDisplay(c)`, only when neither worn nor the Cloak of Armor's magic
 * plate), then the three `WORN_SLOTS` keys (jewelry1, jewelry2, cloak) — so
 * Plan 04's ON YOU panel (and Plan 02's rebuilt WORN list) can render these
 * between the existing wornRow/wornSlotRow rows. A bare hero shows four rows
 * (weapon, armor, two jewelry, one cloak — five with a bare cloak slot too).
 * A legacy `c` with no `worn` map yields all three key rows (every
 * `c.worn?.[slot]` read is falsy). A staff is a bag item — it has no worn
 * slot and therefore no empty-slot row at all. No code change needed for the
 * jewelry merge — this loop already reads `WORN_SLOTS` (now three keys) and
 * `GEAR_COPY.empty[slot]` (now keyed by jewelry1/jewelry2/cloak) generically.
 * Pure, no rng, no mutation.
 */
export function emptySlotRows(c) {
  if (!c || typeof c !== "object") return [];
  const rows = [];
  if (!(c.weapon && WEAPONS[c.weapon])) rows.push({ slot: "weapon", text: GEAR_COPY.empty.weapon });
  const armor = armorDisplay(c);
  if (!armor.worn && !armor.magic) rows.push({ slot: "armor", text: GEAR_COPY.empty.armor });
  for (const slot of WORN_SLOTS) {
    if (c.worn && c.worn[slot]) continue;
    const text = GEAR_COPY.empty[slot];
    rows.push({ slot, text });
  }
  return rows;
}

/**
 * ITEM_STATE_COPY — Phase 39 (GEAR-02/GEAR-05): every literal itemRowState
 * (below) emits — a frozen object like COMBAT_MENU_COPY/RAIL_COPY elsewhere
 * in this codebase, so the voice scan can walk it as a single leaf group.
 */
export const ITEM_STATE_COPY = Object.freeze({
  ready: "READY",
  squares: "{n} SQ",
  square: "1 SQ",
  cooling: "cd {n} SQ",
  charges: "{k}/{max} · {n} SQ",
});

/**
 * itemRowState(state, it) — Phase 39 (GEAR-02/GEAR-05) + 260918-w4n
 * (use-activated-only): the ONE row-state rule for every carried/worn item —
 * the Gear tab's worn/carried rows and the ITEMS submenu (combatMenu.js)
 * both read it, mirroring the Phase 38 ability-row precedent (READY/N
 * ROUNDS/ONCE A FIGHT · USED lives in exactly one place). Returns
 * `{ text, kind, remaining? }`:
 *   - not activatable at all (`activationFor` returns null — a weapon/
 *     armor/rope/ladder/picks/bag): `{ text: "", kind: "none" }`
 *   - a potion, or a `kind: "tool"` activatable (the torch): a one-shot
 *     consumable, `{ text: "", kind: "consumable" }`
 *   - a staff (`act.charges` defined): READY when its current charge count
 *     is at the pool max AND no recharge record is counting down; otherwise
 *     `"{k}/{max} · {n} SQ"` (k may be 0) via the `charges:<key>` record
 *   - everything else (every JEWELRY/CLOAKS row — ALL are act-only now, no
 *     more "no activation -> READY" fallback): READY with no `item:<key>`
 *     record; `"{n} SQ"` (singular `"1 SQ"`) mid-effect; `"cd {n} SQ"` while
 *     cooling
 * Reads `state.c.timers` ONLY through `engine/effects.js#remaining`/`isReady`
 * and the item's own activation via `engine/derived.js#activationFor` —
 * NEVER the retired counter-based item cooldown fields, and NEVER an `it.use`
 * string. Pure, no rng, no mutation, never throws on a legacy `c` with no
 * `timers` map.
 */
export function itemRowState(state, it) {
  const c = (state && state.c) || {};
  if (!it) return { text: "", kind: "none" };
  if (it.kind === "potion") return { text: "", kind: "consumable" };

  const act = activationFor(it);
  if (!act) return { text: "", kind: "none" };
  if (it.kind === "tool") return { text: "", kind: "consumable" };

  if (act.charges !== undefined) {
    const max = act.charges;
    const charges = Number.isInteger(it.charges) ? it.charges : max;
    const left = remaining(c, chargesTimerId(it));
    if (charges >= max || left <= 0) return { text: ITEM_STATE_COPY.ready, kind: "ready" };
    const text = ITEM_STATE_COPY.charges.replace("{k}", charges).replace("{max}", max).replace("{n}", left);
    return { text, kind: "charges", remaining: left };
  }

  const id = itemTimerId(it);
  if (isReady(c, id)) return { text: ITEM_STATE_COPY.ready, kind: "ready" };
  const rec = c.timers && c.timers[id];
  const left = remaining(c, id);
  if (rec && rec.phase === "effect") {
    const text = left === 1 ? ITEM_STATE_COPY.square : ITEM_STATE_COPY.squares.replace("{n}", left);
    return { text, kind: "effect", remaining: left };
  }
  return { text: ITEM_STATE_COPY.cooling.replace("{n}", left), kind: "cooldown", remaining: left };
}

/**
 * GEAR_WORN_ORDER — Phase 62 (GSCR-02): the rebuilt WORN list's fixed
 * five-row display order (the mock's order, from `62-CONTEXT.md`) — weapon,
 * armor, cloak, jewelry1, jewelry2. This is a DISPLAY order only; the
 * engine's own `WORN_SLOTS` address-space order (jewelry1, jewelry2, cloak)
 * is unchanged and untouched by this constant.
 */
export const GEAR_WORN_ORDER = Object.freeze(["weapon", "armor", "cloak", "jewelry1", "jewelry2"]);

/**
 * gearHeaderModel(state) — Phase 62 (GSCR-01): the Gear tab's slim stat
 * header — ARMOR RATING (the effective value, `armorDisplay(c).ar`, so an
 * active Cloak of Armor is included) and WILMST (`c.gold`, comma-grouped).
 * No name/race/class/floor — the global HUD already names the hero on every
 * tab. Pure, null-safe on a sparse `state`.
 */
export function gearHeaderModel(state) {
  const c = (state && state.c) || {};
  const ar = armorDisplay(c).ar;
  const gold = c.gold || 0;
  return {
    stats: [
      { key: "ar", label: GEAR_COPY.armorRating, value: ar, text: String(ar) },
      { key: "gold", label: GEAR_COPY.wilmst, value: gold, text: gold.toLocaleString() },
    ],
  };
}

/**
 * gearUseCell(state, it) — Phase 62 (GSCR-03): the USE / ACTIVE / COOLING
 * cell every activatable WORN/bag row shows, derived ONLY from
 * `itemRowState(state, it)` — the ONE row-state rule, never a restated timer
 * read. Returns `null` for `kind: "none"` (weapon/armor/rope/ladder/picks —
 * nothing to tap). `phase` always equals `st.kind`. Pure, null-safe.
 */
export function gearUseCell(state, it) {
  const st = itemRowState(state, it);
  if (st.kind === "none") return null;
  const label =
    st.kind === "effect" ? GEAR_COPY.use.active : st.kind === "cooldown" ? GEAR_COPY.use.cooling : GEAR_COPY.use.use;
  let sub;
  if (st.kind === "ready" || st.kind === "consumable") sub = "";
  else if (st.kind === "effect" || st.kind === "charges") sub = st.text;
  else sub = st.remaining === 1 ? ITEM_STATE_COPY.square : ITEM_STATE_COPY.squares.replace("{n}", st.remaining);
  return { phase: st.kind, label, sub, remaining: st.remaining ?? 0 };
}

/**
 * gearWornModel(state) — Phase 62 (GSCR-02): the rebuilt WORN list's five
 * fixed rows, in `GEAR_WORN_ORDER`. Built on `emptySlotRows(c)` (the ONE
 * empty-slot read), `armorDisplay(c)` (the ONE effective-armor read),
 * `bagUsage(c)` (the ONE bag-full read) and `gearUseCell` above — no rule is
 * restated. Returns `{ filled, max: 5, countText, rows }`, each row
 * `{ key, label, filled, name, note, value, use, useRef, unequip }`. Pure,
 * null-safe, never throws on a legacy `c` with no `worn`/`items`/`timers`.
 */
export function gearWornModel(state) {
  const c = (state && state.c) || {};
  const empties = new Set(emptySlotRows(c).map((r) => r.slot));
  const armorD = armorDisplay(c);
  const usage = bagUsage(c);

  const rows = GEAR_WORN_ORDER.map((key) => {
    const label = GEAR_COPY.slot[key];

    if (key === "weapon") {
      if (empties.has("weapon")) {
        return { key, label, filled: false, name: GEAR_COPY.emptyName, note: GEAR_COPY.empty.weapon, value: GEAR_COPY.noValue, use: null, useRef: null, unequip: null };
      }
      const magic = c.magicWpn || 0;
      const value = WEAPONS[c.weapon].lab + (magic ? ` +${magic}` : "");
      const note = magic ? GEAR_COPY.weaponMagic.replace("{n}", magic) : GEAR_COPY.weaponMundane;
      return { key, label, filled: true, name: c.weapon, note, value, use: null, useRef: null, unequip: { slot: "weapon", blocked: usage.full } };
    }

    if (key === "armor") {
      if (armorD.worn) {
        const note = armorD.magic
          ? armorD.under
          : armorD.destroyed
            ? GEAR_COPY.armorDestroyed
            : GEAR_COPY.armorWear.replace("{current}", armorD.current).replace("{max}", armorD.max);
        return { key, label, filled: true, name: c.armor, note, value: `AR ${c.ar}`, use: null, useRef: null, unequip: { slot: "armor", blocked: usage.full && !armorD.destroyed } };
      }
      if (armorD.magic) {
        return { key, label, filled: true, name: GEAR_COPY.magicPlate, note: armorD.under, value: `AR ${armorD.ar}`, use: null, useRef: null, unequip: null };
      }
      return { key, label, filled: false, name: GEAR_COPY.emptyName, note: GEAR_COPY.empty.armor, value: GEAR_COPY.noValue, use: null, useRef: null, unequip: null };
    }

    // cloak / jewelry1 / jewelry2 — the three WORN_SLOTS keys.
    const it = c.worn && c.worn[key];
    if (!it) {
      return { key, label, filled: false, name: GEAR_COPY.emptyName, note: GEAR_COPY.empty[key], value: GEAR_COPY.noValue, use: null, useRef: null, unequip: null };
    }
    const use = gearUseCell(state, it);
    return {
      key,
      label,
      filled: true,
      name: it.n,
      note: it.txt ?? "",
      value: GEAR_COPY.noValue,
      use,
      useRef: use ? { slot: key } : null,
      unequip: { slot: key, blocked: usage.full },
    };
  });

  const filled = rows.filter((r) => r.filled).length;
  const countText = GEAR_COPY.count.replace("{n}", filled).replace("{max}", 5);
  return { filled, max: 5, countText, rows };
}

/**
 * gearBagMeterModel(state) — Phase 62 (GSCR-04): the BAG section's used/cap
 * readout and pips, read ONLY from `bagUsage(c)` — never `bagCap`/`canStow`/
 * `slotItems` directly. `pips` is one bool per slot (the first `have` lit),
 * `[]` for a bag-less character (`slots === null`). `fullLine`/`freeRide`
 * are the CONTEXT-locked sub-lines, shown only when they apply. The
 * `usage.slots !== null ? GEAR_COPY.freeRide : ""` pairing is kept literal —
 * Plan 02 re-points a shell snapshot pin at this exact region. Pure.
 */
export function gearBagMeterModel(state) {
  const c = (state && state.c) || {};
  const usage = bagUsage(c);
  const pips = usage.slots !== null ? Array.from({ length: usage.slots }, (_, i) => i < usage.have) : [];
  const fullLine = usage.full ? GEAR_COPY.bagFull : "";
  const freeRide = usage.slots !== null ? GEAR_COPY.freeRide : "";
  return { have: usage.have, slots: usage.slots, full: usage.full, countText: usage.text, pips, fullLine, freeRide };
}

/**
 * gearBagCardsModel(state) — Phase 62 (GSCR-05): one card per
 * `dropShelfItems(c)` entry (the ONE bag-slot list, true `c.items` index).
 * `family`/`tag` name the worn-slot family the item fits (weapon/armor/
 * cloak/jewelry via `slotFor`) plus `· SWAP` when every key of that family
 * is already occupied — the same "every key taken" test `renderCarriedList`
 * uses to choose the swap confirm. A bag-only item (no family) carries no
 * tag and gets a USE cell exactly when `gearUseCell` is non-null (equippable
 * gear only works from its worn slot, so a bagged cloak/jewel/weapon/armor
 * never gets one here). `desc` is `it.txt` (`bagArmorText(it)` for armor —
 * Phase 28 ARMOR-03, live durability, never the frozen txt) plus the
 * `usableBy(it, c)` suffix. Pure, null-safe.
 */
export function gearBagCardsModel(state) {
  const c = (state && state.c) || {};
  return dropShelfItems(c).map(({ it, i }) => {
    const family = it.kind === "weapon" ? "weapon" : it.kind === "armor" ? "armor" : slotFor(it);
    let swap = false;
    if (family === "weapon") swap = !!(c.weapon && WEAPONS[c.weapon]);
    else if (family === "armor") swap = armorDisplay(c).worn;
    else if (family) swap = (WORN_KEYS_OF[family] || []).every((k) => c.worn && c.worn[k]);
    const tag = family ? GEAR_COPY.family[family] + (swap ? GEAR_COPY.swap : "") : "";
    const use = family ? null : gearUseCell(state, it);
    const useRef = use ? i : null;
    const base = it.kind === "armor" ? bagArmorText(it) : (it.txt ?? "");
    const usable = usableBy(it, c);
    const desc = usable ? `${base} ${usable}` : base;
    return { i, name: it.n, desc, family, tag, use, useRef };
  });
}

/**
 * gearConsumablesModel(state) — Phase 62 (GSCR-06): the CONSUMABLES block.
 * Row 0 is HEALING POTION, always shown as `×c.potions`, `enabled` exactly
 * the combat ITEMS submenu's own potion-row rule (`(c.potions||0) > 0 &&
 * c.wp < c.maxWP`) — the SAME predicate, so a Gear tap can never waste a
 * potion the combat menu would have refused (GSCR-06 prohibition). Then one
 * row per buff-potion NAME (`kind: "potion"` items in `c.items`, grouped, in
 * first-appearance order), always enabled — the engine's own refusal line
 * explains any tap on the rail. Then SCROLLS when `c.scrolls > 0`, `enabled`
 * === `canRead(state)`, its `reason` the engine's OWN
 * `LINE_FOR.scrollRefused` text (mirrors `engine/magic.js#readScroll`'s own
 * pilfer/noRunes ternary). `heldText` counts potions + buff items + scrolls.
 * Pure, null-safe.
 */
export function gearConsumablesModel(state) {
  const c = (state && state.c) || {};
  const qtyText = (n) => GEAR_COPY.qty.replace("{n}", n);

  const heal = {
    key: "heal",
    name: GEAR_COPY.healingPotion,
    qty: c.potions || 0,
    qtyText: qtyText(c.potions || 0),
    desc: GEAR_COPY.healingDesc,
    verb: GEAR_COPY.use.use,
    enabled: (c.potions || 0) > 0 && c.wp < c.maxWP,
    reason: "",
    dispatch: { type: "drinkPotion" },
  };
  const rows = [heal];

  const buffGroups = [];
  const buffIndexOf = new Map();
  const items = c.items || [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it || it.kind !== "potion") continue;
    if (!buffIndexOf.has(it.n)) {
      buffIndexOf.set(it.n, buffGroups.length);
      buffGroups.push({ name: it.n, count: 0, firstIndex: i, firstTxt: it.txt ?? "" });
    }
    buffGroups[buffIndexOf.get(it.n)].count++;
  }
  for (const g of buffGroups) {
    rows.push({
      key: `potion:${g.name}`,
      name: g.name,
      qty: g.count,
      qtyText: qtyText(g.count),
      desc: g.firstTxt,
      verb: GEAR_COPY.use.use,
      enabled: true,
      reason: "",
      dispatch: { type: "useItem", i: g.firstIndex },
    });
  }

  if (c.scrolls > 0) {
    const readable = canRead(state);
    // Mirrors engine/magic.js#readScroll's own pilfer/noRunes ternary — the
    // reason text is the engine's OWN refusal line, never restated here.
    const reason = readable ? "" : LINE_FOR.scrollRefused({ reason: c.sub === "Pilfer" ? "pilfer" : "noRunes" }).text;
    rows.push({
      key: "scroll",
      name: GEAR_COPY.scrolls,
      qty: c.scrolls,
      qtyText: qtyText(c.scrolls),
      desc: GEAR_COPY.scrollDesc,
      verb: GEAR_COPY.use.read,
      enabled: readable,
      reason,
      dispatch: { type: "readScroll" },
    });
  }

  const buffCount = buffGroups.reduce((sum, g) => sum + g.count, 0);
  const held = (c.potions || 0) + buffCount + (c.scrolls || 0);
  return { held, heldText: GEAR_COPY.held.replace("{n}", held), rows };
}

/**
 * gearKitRows(state) — Phase 62 (GSCR-06): the ALSO ON YOU block's rows, in
 * this fixed order — Rations, Spell charges (Magic User only), every
 * running effect the old `#s-kit` list showed (Shield ward, Strength,
 * Regeneration, Mirror Self, Sense Presence, Sense Danger, Map the Floor),
 * then Kills. Potions, Scrolls and Wilmst are gone — they now live in
 * CONSUMABLES and the header. The conditions are copied verbatim from the
 * retired `renderGearTab` kit block. Every `value` is a string. Pure,
 * null-safe.
 */
export function gearKitRows(state) {
  const c = (state && state.c) || {};
  const rows = [];
  rows.push({ label: GEAR_COPY.kit.rations, value: GEAR_COPY.kit.rationsValue.replace("{n}", c.rations || 0) });
  if (c.cls === "Magic User") {
    const max = maxCharges(c);
    const k = max - (c.spellsUsed || 0);
    rows.push({ label: GEAR_COPY.kit.spellCharges, value: GEAR_COPY.kit.spellChargesValue.replace("{k}", k).replace("{max}", max) });
  }
  if (c.ward) {
    rows.push({ label: c.ward.name, value: GEAR_COPY.kit.wardValue.replace("{pool}", c.ward.pool).replace("{rounds}", c.ward.rounds) });
  }
  if (c.might) {
    rows.push({ label: GEAR_COPY.kit.strength, value: GEAR_COPY.kit.strengthValue.replace("{n}", c.might) });
  }
  if (c.regen) {
    rows.push({ label: GEAR_COPY.kit.regen, value: GEAR_COPY.kit.regenValue });
  }
  if (c.mirror > 0) {
    rows.push({ label: GEAR_COPY.kit.mirror, value: GEAR_COPY.kit.mirrorValue.replace("{n}", c.mirror) });
  }
  if (c.senses) {
    rows.push({ label: GEAR_COPY.kit.senses, value: GEAR_COPY.kit.sensesValue });
  }
  if (c.foresight) {
    rows.push({ label: GEAR_COPY.kit.foresight, value: GEAR_COPY.kit.foresightValue });
  }
  const rev = c.timers && c.timers["spell:reveal"];
  if (rev && rev.phase === "effect" && rev.left > 0) {
    rows.push({ label: GEAR_COPY.kit.reveal, value: GEAR_COPY.kit.revealValue.replace("{n}", rev.left) });
  }
  rows.push({ label: GEAR_COPY.kit.kills, value: String(c.kills || 0) });
  return rows;
}

// Phase 33 (UIF-01, CONTEXT Area 1) — the GEAR tab's inline two-tap Drop
// confirm. DOM-local presentation state, never on S (serializeRun spreads
// S). Exactly one row can be armed; the revert is a setTimeout of
// DROP_CONFIRM_MS (never a CSS transition — reduced-motion safe, and the
// guard rules of Phase 32 never depend on a transition either), and any
// pointerdown outside the confirm reverts it (a document-level capture
// listener registered only while armed). Not an encounter button: no
// guardTap here by design (Phase 32 scope).
const DROP_CONFIRM_MS = 3000;
let dropConfirmRevert = null;
function revertDropConfirm() { if (!dropConfirmRevert) return; const r = dropConfirmRevert; dropConfirmRevert = null; r(); }

// Phase 37 (GEAR-03) — the Gear tab's EQUIP-on-occupied-slot two-tap swap
// confirm. DOM-local presentation state, never on S (serializeRun spreads
// S); exactly one row can be armed at a time; the revert is a setTimeout of
// SWAP_CONFIRM_MS (never a CSS transition), and any pointerdown outside the
// confirm reverts it (a document-level capture listener registered only
// while armed) — mirrors DROP_CONFIRM_MS/dropConfirmRevert/
// revertDropConfirm() above exactly.
const SWAP_CONFIRM_MS = 3000;
let swapConfirmRevert = null;
function revertSwapConfirm() { if (!swapConfirmRevert) return; const r = swapConfirmRevert; swapConfirmRevert = null; r(); }

/* ---------------- shared carried-item list (Phase 14, ECON-06/07) ----------------
   ONE carried-item list renderer, authored once and reused by four hosts: the
   GEAR tab (paint()), the store "Your gear" SELL section, the combat-bar
   USE list, and the Phase 29 loot screen (all three of the latter render from
   renderEncounter()). Each host passes which per-item actions to surface
   (`use`/`equip`/`drop`/`sell`/`lootEquip`/`lootTake`/`lootLeave`) and an
   optional `filter`, so the gear list is never built four times. Every action
   button routes through the deps action closures (deps.useItem/deps.equipItem/
   deps.dropItem/deps.sellItem/deps.takeLoot/deps.leaveLoot — each forwarding to
   the classic script's window.mz* engine bridges) — the pure applyAction() seam —
   so the shell never mutates GameState off-band. `container` is a <ul>; rows
   are <li> with ≥48dp action buttons. Phase 47 (SHELL-01), Plan 03: moved
   verbatim from the classic script's renderCarriedList — `container.ownerDocument`
   replaces the `document` global, `state` replaces the classic S, and direct
   imports/deps closures replace the retired window.__mz* bridges. */
export function renderCarriedList(container, state, items, opts = {}, deps = {}) {
  const doc = container.ownerDocument;
  // `clear` (default true) wipes the container first — the store/combat hosts
  // own their <ul> outright. The GEAR tab passes clear:false so its worn
  // weapon/armor rows (appended before this call) survive.
  if (opts.clear !== false) container.innerHTML = "";
  const rows = (items || [])
    .map((it, i) => ({ it, i }))
    .filter(({ it }) => (opts.filter ? opts.filter(it) : true));
  if (!rows.length) {
    if (opts.emptyHtml) {
      const li = doc.createElement("li");
      li.className = "none mw-empty";
      li.innerHTML = opts.emptyHtml;
      container.appendChild(li);
    }
    return;
  }
  const mkBtn = (label, onClick, disabled) => {
    const bt = doc.createElement("button");
    bt.className = "small";
    bt.textContent = label;
    bt.style.marginTop = "4px"; bt.style.marginRight = "6px"; bt.style.alignSelf = "flex-start";
    // Phase 32 (CMBUI-04): opts.guard opts a caller's rows into the same
    // arm-delay guardTap() every other §6.3 decision button uses — the loot
    // card and the combat use-list pass guard:true; the GEAR tab and the
    // store sell list do not (outside the ratified list).
    if (disabled) bt.disabled = true; else opts.guard ? deps.guardTap(bt, onClick) : (bt.onclick = onClick);
    return bt;
  };
  // Phase 33 (UIF-01) — the GEAR host's inline two-tap Drop confirm. Tapping
  // Drop arms the row: the button is replaced in place with "Drop it?
  // [Yes] [No]"; Yes reverts THEN dispatches the existing dropItem bridge
  // (no new engine action — any bag item, potions included); No, a
  // DROP_CONFIRM_MS timeout, or a pointerdown anywhere outside the confirm
  // reverts it. Only ever one row armed at a time (revertDropConfirm() at
  // the top of arm() disarms any other row first).
  const mkDropConfirm = (i) => {
    const arm = () => {
      revertDropConfirm();
      const wrap = doc.createElement("span");
      wrap.className = "mw-drop-confirm";
      const label = doc.createElement("span");
      label.textContent = "Drop it?";
      const yes = mkBtn("Yes", () => { revertDropConfirm(); deps.dropItem?.(i); });
      const no = mkBtn("No", () => revertDropConfirm());
      yes.style.marginTop = "0"; no.style.marginTop = "0";
      wrap.appendChild(label); wrap.appendChild(yes); wrap.appendChild(no);
      drop.replaceWith(wrap);
      const timer = setTimeout(revertDropConfirm, DROP_CONFIRM_MS);
      const onAnyTap = (e) => { if (!wrap.contains(e.target)) revertDropConfirm(); };
      doc.addEventListener("pointerdown", onAnyTap, true);
      dropConfirmRevert = () => {
        clearTimeout(timer);
        doc.removeEventListener("pointerdown", onAnyTap, true);
        if (wrap.isConnected) wrap.replaceWith(drop);
      };
    };
    const drop = mkBtn("Drop", arm);
    drop.classList.add("mw-gear-drop");
    return drop;
  };
  // Phase 37 (GEAR-03) — the EQUIP-on-occupied-slot two-tap swap confirm;
  // mirrors mkDropConfirm exactly except the swapped copy/class/state names
  // and the Yes action (equipItem — a genuine direct swap, not dropItem).
  // 260918-wy1 (jewelry-merge): generalized from a single wornName string to
  // `choices` — an array of `{ slot, name }`, one per occupied key of the
  // item's family. A single-key family (cloak) still gets the familiar
  // "Swap for {name}?" / one "Yes" button; a full two-key jewelry family
  // gets "Swap for which?" and ONE button per worn piece (labelled with that
  // piece's own name), each targeting its own key via mzEquipItem(i, slot),
  // plus the same No button.
  const mkSwapConfirm = (i, choices) => {
    const arm = () => {
      revertSwapConfirm();
      const wrap = doc.createElement("span");
      wrap.className = "mw-swap-confirm";
      const label = doc.createElement("span");
      label.textContent = choices.length === 1 ? `Swap for ${choices[0].name}?` : "Swap for which?";
      wrap.appendChild(label);
      for (const choice of choices) {
        const btnLabel = choices.length === 1 ? "Yes" : choice.name;
        const btn = mkBtn(btnLabel, () => { revertSwapConfirm(); deps.equipItem?.(i, choice.slot); });
        btn.style.marginTop = "0";
        wrap.appendChild(btn);
      }
      const no = mkBtn("No", () => revertSwapConfirm());
      no.style.marginTop = "0";
      wrap.appendChild(no);
      equip.replaceWith(wrap);
      const timer = setTimeout(revertSwapConfirm, SWAP_CONFIRM_MS);
      const onSwapTap = (e) => { if (!wrap.contains(e.target)) revertSwapConfirm(); };
      doc.addEventListener("pointerdown", onSwapTap, true);
      swapConfirmRevert = () => {
        clearTimeout(timer);
        doc.removeEventListener("pointerdown", onSwapTap, true);
        if (wrap.isConnected) wrap.replaceWith(equip);
      };
    };
    const equip = mkBtn("Equip", arm);
    return equip;
  };
  rows.forEach(({ it, i }) => {
    const li = doc.createElement("li");
    // Phase 39 (GEAR-02/GEAR-05), Plan 05 — the ONE row-state rule
    // (READY / N SQ / cd N SQ / k/max · N SQ) replaces the retired
    // it.every/usedAt cooldown gate here too (this builder is shared by the
    // GEAR tab, the store sell list and the loot card).
    const st = itemRowState(state, it);
    // Phase 28 (ARMOR-03): a stowed armor piece carries `left` — the row
    // must show remaining durability, never the frozen `txt`. Phase 29
    // (LOOT-03): the loot screen instead supplies opts.subFor to show the
    // lootCompare readout — the armor/txt default here is unchanged so
    // every pre-existing host (GEAR tab, store sell list, combat use list)
    // renders byte-identically.
    const sub = typeof opts.subFor === "function" ? opts.subFor(it) : (it.kind === "armor" ? bagArmorText(it) : (it.txt ?? ""));
    // Built via createElement/textContent (T-38-11 — no innerHTML carrying
    // an item name in this region).
    const b = doc.createElement("b");
    b.textContent = it.n + (st.text ? ` · ${st.text}` : "");
    const descEl = doc.createElement("i");
    descEl.textContent = sub;
    li.appendChild(b);
    li.appendChild(descEl);
    for (const a of (opts.actions || [])) {
      if (a === "use") {
        // Phase 31 (CMB-02/CMB-03, Phase 25.1 DFB-06 precedent): never
        // disable silently — an activatable's Use button stays visible even
        // on cooldown (the row title already shows `· N sq` above); a tap
        // dispatches as usual and the engine's own useRefused
        // {reason:"cooldown"|"recharging"|"notWorn"} rail line explains the
        // wait/refusal. 260918-w4n: gated on st.kind !== "none" (the ONE
        // row-state rule) instead of a raw `it.use` string — a bagged
        // cloak/jewel still shows Use (the tap yields the engine's notWorn
        // rail line); a bagged staff's Use tap simply works for a Magic User.
        if (st.kind !== "none") li.appendChild(mkBtn("Use", () => deps.useItem?.(i)));
      } else if (a === "equip") {
        if (it.kind === "weapon" || it.kind === "armor") li.appendChild(mkBtn("Equip", () => deps.equipItem?.(i)));
        // Phase 37 (GEAR-03), rewritten 260918-wy1 (jewelry-merge) — a bag
        // cloak/jewel in the worn model gets Equip (a key of its family is
        // free) or the swap confirm (every key of its family is occupied —
        // one choice for the single-key cloak family, two for a full
        // jewelry family); legacy states (no c.worn) keep today's bag-only
        // behaviour. `slotFor` is always null for a staff, so this branch
        // never fires for one.
        else if (state.c.worn && slotFor(it)) {
          const family = slotFor(it);
          const keys = WORN_KEYS_OF[family] || [];
          const free = keys.find((k) => !state.c.worn[k]);
          if (free) li.appendChild(mkBtn("Equip", () => deps.equipItem?.(i)));
          else li.appendChild(mkSwapConfirm(i, keys.map((k) => ({ slot: k, name: state.c.worn[k].n }))));
        }
      } else if (a === "drop") {
        if (opts.gearRow) li.appendChild(mkDropConfirm(i));
        else li.appendChild(mkBtn("Drop", () => deps.dropItem?.(i)));
      } else if (a === "sell") {
        const price = sellPriceFor(it, state.c.race, state.c.sub);
        li.appendChild(mkBtn(price != null ? `Sell · ${price.toLocaleString()} wm` : "Sell", () => deps.sellItem?.(i)));
      } else if (a === "lootEquip") {
        // Phase 29 (LOOT-03): Equip now — only when it's a legal upgrade
        // (lootCompare's own equipNow verdict, never restated here).
        if ((it.kind === "weapon" || it.kind === "armor") && lootCompare(state.c, it).equipNow) li.appendChild(mkBtn("Equip now", () => deps.takeLoot?.(i, true)));
      } else if (a === "lootTake") {
        li.appendChild(mkBtn(it.kind === "weapon" || it.kind === "armor" ? "Stow" : "Take", () => deps.takeLoot?.(i)));
      } else if (a === "lootLeave") {
        li.appendChild(mkBtn("Leave", () => deps.leaveLoot?.(i)));
      }
    }
    // Phase 33 (UIF-01) — the GEAR host's `[name · detail]` line stays first;
    // its action buttons are re-parented into ONE flex row so Use/Equip sit
    // immediately left of Drop and Drop is pinned to the row's right edge;
    // `ul.skills li` is column-flex (CSS above), which is why appending
    // buttons directly to the li stacks them instead of running side by side.
    if (opts.gearRow) {
      const btns = Array.from(li.querySelectorAll(":scope > button"));
      if (btns.length) {
        const row = doc.createElement("div");
        row.className = "mw-gear-actions";
        for (const b of btns) row.appendChild(b);
        const dropBtn = row.querySelector(".mw-gear-drop");
        if (dropBtn) { dropBtn.style.marginLeft = "auto"; dropBtn.style.marginRight = "0"; }
        li.appendChild(row);
      }
    }
    container.appendChild(li);
  });
}

/**
 * renderGearTab(host, state, deps) — Phase 47 (SHELL-01), Plan 03: the ONE
 * mount function for the Gear tab (`#screen-gear`) — m-gold, the ALSO ON
 * YOU panel (`#s-kit`), and the ON YOU/BAG panels (`#s-onyou`/`#s-carry`,
 * via renderCarriedList above). Moved verbatim from the classic script's
 * paint() with `host.ownerDocument` replacing `document`, `state`/`state.c`
 * replacing the classic S/c, and direct engine/viewModels imports replacing
 * the retired window.__mz* bridges (canRead/maxCharges/armorDisplay/
 * bagUsage/emptySlotRows). Every id this function writes lives inside the
 * `#screen-gear` markup section. No window/document globals — host,
 * host.ownerDocument and deps only.
 */
export function renderGearTab(host, state, deps = {}) {
  const doc = host.ownerDocument;
  const c = state.c;

  doc.getElementById("m-gold").textContent = c.gold.toLocaleString();

  const kit = doc.getElementById("s-kit");
  kit.innerHTML = "";
  // Phase 43 (CLAR-04): the weapon/armor rows now live in the ON YOU
  // panel's WIELDED/WORN rows (below, in #s-onyou) — no duplicates here.
  const rows = [
    ["Potions", c.potions],
    ...(c.scrolls ? [["Scrolls", `${c.scrolls}${canRead(state) ? "" : " (unreadable)"}`]] : []),
    ["Rations", `${c.rations} days`],
    ["Wilmst", c.gold.toLocaleString()]
  ];
  if (c.cls === "Magic User") rows.push(["Spell charges", `${maxCharges(c) - c.spellsUsed} / ${maxCharges(c)}`]);
  // Phase 40 (SPELL-06): the Shield row now reads BOTH numbers (pool AND
  // rounds), mirroring the map-HUD ward chip's own {pool, remaining} shape —
  // the Hero tab used to show pool only.
  if (c.ward) rows.push([c.ward.name, `${c.ward.pool} hp left · ${c.ward.rounds} rds`]);
  if (c.might) rows.push(["Strength", `+${c.might} damage`]);
  if (c.regen) rows.push(["Regeneration", "d8 a round"]);
  // Phase 40 (SPELL-02/05): the four utility spells that had a real effect
  // but no Hero-tab row — mirroring the condition-chip strip's own copy.
  if (c.mirror > 0) rows.push(["Mirror Self", `${c.mirror} rds`]);
  if (c.senses) rows.push(["Sense Presence", "till the fight ends"]);
  if (c.foresight) rows.push(["Sense Danger", "armed"]);
  const rev = c.timers && c.timers["spell:reveal"];
  if (rev && rev.phase === "effect" && rev.left > 0) rows.push(["Map the Floor", `${rev.left} sq`]);
  rows.push(["Kills", c.kills || 0]);
  // Phase 43 (CLAR-04): the ALSO ON YOU head row — potions/scrolls/rations/
  // wilmst/spell charges/running effects/kills need no bag slot at all.
  const li = doc.createElement("li");
  li.className = "mw-kit-head";
  li.textContent = GEAR_COPY.alsoOnYou;
  kit.appendChild(li);
  for (const [a, b] of rows) {
    const li = doc.createElement("li");
    li.innerHTML = `${a}<span>${b}</span>`;
    kit.appendChild(li);
  }

  // carried treasure (Phase 13, ECON-04/05: the keep/drop/equip UI)
  const carry = doc.getElementById("s-carry");
  // Phase 43 (CLAR-04): ON YOU rows land in #s-onyou; #s-carry is the BAG.
  const onyou = doc.getElementById("s-onyou");
  const items = c.items || [];
  // Phase 29 (LOOT-04): the readout and the full-bag gate read the ONE
  // view-model (bagUsage — potions exempt from the count), never a local
  // count. The engine (stowItem/canStow) alone enforces the cap.
  const usage = bagUsage(c);
  // quick 260918-vvt: GEAR_COPY.freeRide is the one home of this note's
  // copy — shown only for a capped bag; a bag-less dev/test character keeps
  // the bare count.
  doc.getElementById("s-carry-n").textContent =
    usage.slots !== null ? `${usage.text} · ${GEAR_COPY.freeRide}` : usage.text;
  const bagFull = usage.full;
  carry.innerHTML = "";
  onyou.innerHTML = "";
  // Phase 43 (CLAR-04), 260918-wy1 (jewelry-merge): the empty-slot rows
  // (armor + the three WORN_SLOTS keys — jewelry1, jewelry2, cloak —
  // in-voice) come from the ONE emptySlotRows(c) read — never a restated
  // slot list.
  const empties = emptySlotRows(c);
  const emptyFor = (slot) => empties.find((r) => r.slot === slot);
  const headRow = (text) => {
    const li = doc.createElement("li");
    li.className = "none mw-onyou-head";
    li.textContent = text;
    onyou.appendChild(li);
  };
  const emptyRow = (text) => {
    const li = doc.createElement("li");
    li.className = "none mw-worn-empty";
    li.textContent = text;
    onyou.appendChild(li);
  };

  // ≥48dp helper: build a small action button dispatching an engine inventory
  // action closure (never wrapped in the classic act() — the closure owns its
  // own state-swap + repaint), with an optional disabled state.
  const gearBtn = (label, onClick, disabled) => {
    const bt = doc.createElement("button");
    bt.className = "small"; bt.textContent = label;
    bt.style.marginTop = "4px"; bt.style.marginRight = "6px"; bt.style.alignSelf = "flex-start";
    if (disabled) { bt.disabled = true; }
    else bt.onclick = onClick;
    return bt;
  };

  // Equipped weapon/armor rows first, each with an Unequip control (stows the
  // worn piece back into the bag — engine gates on a free slot). A bare-handed
  // "Fists" weapon / "Nothing" armor has nothing to unequip. Phase 28
  // (ARMOR-03): `noSlotNeeded` lets a DESTROYED piece unequip even on a full
  // bag — it is discarded (Plan 01's unequipSlot branch), not stowed.
  const wornRow = (label, sub, slot, canUnequip, noSlotNeeded) => {
    const li = doc.createElement("li");
    li.className = "mw-worn";
    li.innerHTML = `<b>${label} <span class="mw-worn-tag">worn</span></b><i>${sub}</i>`;
    if (canUnequip) li.appendChild(gearBtn(bagFull && !noSlotNeeded ? "Bag full" : "Unequip", () => deps.unequip?.(slot), bagFull && !noSlotNeeded));
    onyou.appendChild(li);
  };
  const w = WEAPONS[c.weapon] || WEAPONS["Club"];
  const armorD = armorDisplay(c);
  headRow(GEAR_COPY.wielded);
  wornRow(c.weapon, `${w.lab}${c.magicWpn ? ` +${c.magicWpn} magic` : ""}`, "weapon", c.weapon && c.weapon !== "Fists" && WEAPONS[c.weapon]);
  // Phase 28 (ARMOR-02/04): the worn-armor row now reads the shared
  // formatter — with the cloak the headline is the cloak (effective armor)
  // and Unequip still stows the piece underneath; a destroyed piece needs no
  // slot, so a full bag never blocks discarding it.
  headRow(GEAR_COPY.worn);
  if (armorD.worn || armorD.magic)
    wornRow(armorD.label, armorD.under ? `${armorD.sub} · ${armorD.under}` : armorD.sub, "armor", armorD.worn, armorD.destroyed);
  else { const r = emptyFor("armor"); if (r) emptyRow(r.text); }

  // Phase 37 (GEAR-03) — one row per populated c.worn[slot], in WORN_SLOTS
  // order, reads like the armor row above (name, cooldown when counting
  // down, txt, a Use button, Unequip dimmed to "Bag full" exactly like
  // weapon/armor). 260918-w4n (use-activated-only): every JEWELRY/CLOAKS row
  // is act-only now — st.kind is never "none" for a worn-slot item, so every
  // worn row gets a Use button (the old `it.use` gate is gone). Does NOT
  // touch wornRow's pinned signature — a slot item is never a weapon/armor,
  // so it gets its own small builder. 260918-wy1 (jewelry-merge): WORN_SLOTS
  // is now the three keys jewelry1, jewelry2, cloak — this loop needed no
  // code change, it already reads WORN_SLOTS generically.
  const wornSlotRow = (slot, it) => {
    const li = doc.createElement("li");
    li.className = "mw-worn";
    // Phase 39 (GEAR-02/GEAR-05), Plan 05 — the ONE row-state rule
    // (READY / N SQ / cd N SQ / k/max · N SQ), never it.every/usedAt; built
    // via createElement/textContent (T-38-11 — no innerHTML carrying an
    // item name in this region).
    const st = itemRowState(state, it);
    const b = doc.createElement("b");
    b.textContent = it.n + (st.text ? ` · ${st.text}` : "");
    b.appendChild(doc.createTextNode(" "));
    const tag = doc.createElement("span");
    tag.className = "mw-worn-tag";
    tag.textContent = "worn";
    b.appendChild(tag);
    const desc = doc.createElement("i");
    desc.textContent = it.txt ?? "";
    li.appendChild(b);
    li.appendChild(desc);
    if (st.kind !== "none") li.appendChild(gearBtn("Use", () => deps.useItem?.({ slot })));
    li.appendChild(gearBtn(bagFull ? "Bag full" : "Unequip", () => deps.unequip?.(slot), bagFull));
    onyou.appendChild(li);
  };
  for (const slot of WORN_SLOTS) { const it = c.worn && c.worn[slot]; if (it) wornSlotRow(slot, it); else { const r = emptyFor(slot); if (r) emptyRow(r.text); } }

  // Phase 14 (ECON-06/07): the carried-item rows now come from the SHARED
  // renderCarriedList component (used identically by the store sell section and
  // the combat use-list). clear:false preserves the worn weapon/armor rows
  // appended just above. Use routes through deps.useItem like Equip/Drop
  // already do.
  // Phase 33 (UIF-01) — gearRow:true is passed HERE ONLY (the store sell
  // list, the combat use-list and the loot card keep the Phase 14/29/32
  // rendering).
  renderCarriedList(carry, state, items, {
    clear: false,
    actions: ["use", "equip", "drop"],
    gearRow: true,
    // 04-UI-SPEC.md Copywriting Contract — GEAR tab's CARRIED empty state.
    emptyHtml: `<b class="mw-empty-head">NOTHING LEFT TO CARRY</b><i class="mw-empty-body">You used it all. That was the plan, technically.</i>`,
  }, deps);
}
