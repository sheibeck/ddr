// src/browser/gearTab.js
//
// Phase 47 (SHELL-01), Plan 03 — the GEAR tab: ON YOU / ALSO ON YOU / BAG
// rendering, the shared carried-item list with its drop/swap confirms, and
// the Gear view models. Contract: renderGearTab(host, state, deps) — see
// docs/SHELL-MODULES.md. No window/document globals: host.ownerDocument +
// deps only.
//
// Task 1 (this commit): a pure move of the five Gear-only view models out
// of viewModels.js (bagUsage, GEAR_COPY, emptySlotRows, ITEM_STATE_COPY,
// itemRowState) — bodies and doc comments unchanged. Task 2 lands
// renderGearTab/renderCarriedList and the classic-script carve.

import { WORN_SLOTS, activationFor, itemTimerId, chargesTimerId } from "../../engine/derived.js";
import { isReady, remaining } from "../../engine/effects.js";
import { bagCap, canStow, slotItems } from "../../engine/items.js";
import { armorDisplay } from "./viewModels.js";

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
 */
export const GEAR_COPY = Object.freeze({
  onYou: "ON YOU",
  wielded: "WIELDED",
  worn: "WORN",
  alsoOnYou: "ALSO ON YOU",
  bag: "BAG",
  freeRide: "potions & scrolls ride free",
  empty: Object.freeze({
    armor: "armor — nothing. The wind is your armor, and the wind is not on your side.",
    jewelry1: "jewelry — nothing. Ten fingers, one neck, zero commitments.",
    jewelry2: "jewelry — nothing. Room for one more bad decision.",
    cloak: "cloak — nothing. Cold and unmagical, in that order.",
  }),
});

/**
 * emptySlotRows(c) — Phase 43 (CLAR-04) + 260918-w4n (staff amendment) +
 * 260918-wy1 (jewelry-merge): one in-voice row per EMPTY worn KEY — armor
 * (via `armorDisplay(c)`, only when neither worn nor the Cloak of Armor's
 * magic plate) followed by the three `WORN_SLOTS` keys (jewelry1, jewelry2,
 * cloak), in that fixed order — so Plan 04's ON YOU panel can render these
 * between the existing wornRow/wornSlotRow rows. A bare hero shows three
 * rows (two jewelry, one cloak). A legacy `c` with no `worn` map yields all
 * three key rows (every `c.worn?.[slot]` read is falsy). A staff is a bag
 * item — it has no worn slot and therefore no empty-slot row at all. No
 * code change needed for the jewelry merge — this loop already reads
 * `WORN_SLOTS` (now three keys) and `GEAR_COPY.empty[slot]` (now keyed by
 * jewelry1/jewelry2/cloak) generically. Pure, no rng, no mutation.
 */
export function emptySlotRows(c) {
  if (!c || typeof c !== "object") return [];
  const rows = [];
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
