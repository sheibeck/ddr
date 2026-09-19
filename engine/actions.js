// engine/actions.js
//
// The Action vocabulary and input validation for the single engine chokepoint
// (ENG-01; Security Domain V5). Every `action` reaching applyAction is
// untrusted — a presentation-layer bug (or, later, a network peer) must never
// throw or corrupt GameState. validateAction checks the action is a non-null
// object, its `type` is known, and the per-type field shapes are well-formed;
// applyAction no-ops (empty events, unchanged state) on anything that fails.

import { WORN_SLOTS } from "./derived.js";

export const ACTION_TYPES = new Set([
  "move",
  // CMB-01 (Phase 31): the FIGHT step, split from startCombat's ENCOUNTER
  // step. No payload; no validate case needed (mirrors `camp`).
  "fight",
  "attack",
  "castSpell",
  "drinkPotion",
  "flee",
  "parley",
  "sing",
  "readScroll",
  "buyItem",
  "leaveStore",
  "useItem",
  "camp",
  "newGame",
  // Device-review Pass B1 item 3: "ABANDON THIS CHARACTER" (mazeworld.html's
  // HERO tab) — a voluntary, non-combat run termination routed through the
  // same applyAction()/rngState seam as every other death, rather than
  // presentation code touching GameState.rngState off-band. No extra fields;
  // see engine/engine.js's "abandon" case.
  "abandon",
  // PARTY-01 (Phase 9): accept/decline a pending Joiner recruitment stashed by
  // encounters.js#meetJoiner. Pure (no rng); carries a boolean `accept`.
  "resolveJoiner",
  // Phase 36 (JOIN-01): send a party member away from the Company panel;
  // pure, no rng; optional non-negative integer `i` (default 0).
  "dismissJoiner",
  // ECON-03/04/05 (Phase 13): the player-choice inventory actions. All pure
  // (no rng). takeFind/leaveFind accept/decline the pending find stashed by a
  // find caller (encounters.js#offerFind); dropItem/equipItem carry a
  // non-negative item index `i`; unequipSlot carries a `slot` ("weapon"/"armor").
  "takeFind",
  "leaveFind",
  "dropItem",
  "equipItem",
  "unequipSlot",
  // ECON-06 (Phase 14): sell carried item `i` at a store. Pure (no rng); carries
  // a non-negative item index `i`, same contract as dropItem/useItem.
  "sellItem",
  // Phase 29 (LOOT-01/02/06): the pending end-of-combat loot pile. All pure
  // (no rng). takeLoot carries a non-negative index `i` and an OPTIONAL
  // boolean `equip` (direct-swap equip-now vs stow); leaveLoot carries `i`;
  // takeAllLoot/leaveAllLoot carry no payload (same shape as takeFind/leaveFind).
  "takeLoot",
  "leaveLoot",
  "takeAllLoot",
  "leaveAllLoot",
  // Phase 38 (ABIL-01/04): the ABILITIES submenu's action — carries a
  // catalog id `key`. On cooldown/unowned/out-of-combat, useAbility itself
  // yields a named abilityRefused event rather than being rejected here —
  // this validator only guards the wire shape (a non-empty string).
  "useAbility",
  // Phase 39 (GEAR-05): spend a pending hazard's tool — the ladder/rope
  // half of the pre-roll decision card (`state.pendingHazard`). The torch
  // goes through the existing `useItem` action instead (it is a
  // useItem-activatable consumable, not a movement-tile tool).
  "useTool",
]);

const DIRS = new Set(["N", "S", "E", "W"]);
const EQUIP_SLOTS = new Set(["weapon", "armor"]);

const isInt = (v) => typeof v === "number" && Number.isInteger(v);

/**
 * validateAction(action) — returns `{ ok: true }` for a well-formed action, or
 * `{ ok: false, reason }` describing the first problem. Never throws.
 *
 * @param {*} action
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function validateAction(action) {
  if (action === null || typeof action !== "object" || Array.isArray(action)) {
    return { ok: false, reason: "action must be a non-null object" };
  }
  if (!ACTION_TYPES.has(action.type)) {
    return { ok: false, reason: `unknown action.type: ${String(action.type)}` };
  }
  switch (action.type) {
    case "move":
      if (!DIRS.has(action.dir)) return { ok: false, reason: "move.dir must be one of N/S/E/W" };
      break;
    case "buyItem":
      if (!isInt(action.idx) || action.idx < 0) {
        return { ok: false, reason: "buyItem.idx must be a non-negative integer" };
      }
      break;
    case "castSpell":
      // LO-01: apply the same non-negativity guard buyItem.idx already uses,
      // for a consistent index contract across every action type (harmless
      // today — SPELLS[idx] on a negative idx just returns undefined and
      // castSpell no-ops — but keeps a future indexing change, e.g.
      // Array.prototype.at(-1) semantics, from silently being accepted here).
      if (!isInt(action.idx) || action.idx < 0) {
        return { ok: false, reason: "castSpell.idx must be a non-negative integer" };
      }
      break;
    case "useItem":
      // Phase 37 (GEAR-03): the slot address form — exactly one of `i` or
      // `slot` may be present, never both.
      if (action.slot !== undefined) {
        if (action.i !== undefined || !WORN_SLOTS.includes(action.slot)) {
          return {
            ok: false,
            reason: "useItem.slot must be one of ring, bracelet, amulet, helm, cloak (and excludes i)",
          };
        }
        break;
      }
      // LO-01: see castSpell.idx above — c.items[i] on a negative i safely
      // no-ops today, but the contract should be consistent.
      if (!isInt(action.i) || action.i < 0) {
        return { ok: false, reason: "useItem.i must be a non-negative integer" };
      }
      break;
    case "resolveJoiner":
      // PARTY-01 (Phase 9): the accept/decline flag must be a strict boolean so
      // a malformed presentation/peer payload can never coax an ambiguous
      // truthy/falsy value through the recruitment chokepoint.
      if (typeof action.accept !== "boolean") {
        return { ok: false, reason: "resolveJoiner.accept must be a boolean" };
      }
      break;
    case "dismissJoiner":
      // Phase 36 (JOIN-01): `i` is optional; when present it must be a
      // non-negative integer (same contract as buyItem.idx/useItem.i above).
      if (action.i !== undefined && (!isInt(action.i) || action.i < 0)) {
        return { ok: false, reason: "dismissJoiner.i must be a non-negative integer when present" };
      }
      break;
    case "dropItem":
    case "equipItem":
    case "sellItem":
      // ECON-04/05/06 (Phase 13/14): the carried-item index — same non-negative
      // integer contract as useItem.i above (c.items[i] on a bad index safely
      // no-ops in the handler, but the shape contract stays consistent).
      if (!isInt(action.i) || action.i < 0) {
        return { ok: false, reason: `${action.type}.i must be a non-negative integer` };
      }
      break;
    case "unequipSlot":
      // ECON-05 (Phase 13) + Phase 37 (GEAR-03) + 260918-w4n (staff
      // amendment): the two scalar equip slots PLUS the five worn-model
      // slots — a malformed slot string (including "staff", which has no
      // worn slot any more) can never reach the handler.
      if (!EQUIP_SLOTS.has(action.slot) && !WORN_SLOTS.includes(action.slot)) {
        return {
          ok: false,
          reason: "unequipSlot.slot must be 'weapon', 'armor' or one of ring, bracelet, amulet, helm, cloak",
        };
      }
      break;
    case "takeFind":
    case "leaveFind":
      // ECON-03 (Phase 13): no payload fields — the pending find is read from
      // state.pendingFind, exactly like leaveStore reads state.store.
      break;
    case "takeLoot":
    case "leaveLoot":
      // Phase 29 (LOOT-02): the pending pile index — same non-negative
      // integer contract as dropItem/equipItem/sellItem's `i` above.
      if (!isInt(action.i) || action.i < 0) {
        return { ok: false, reason: `${action.type}.i must be a non-negative integer` };
      }
      if (action.type === "takeLoot" && action.equip !== undefined && typeof action.equip !== "boolean") {
        return { ok: false, reason: "takeLoot.equip must be a boolean when present" };
      }
      break;
    case "takeAllLoot":
    case "leaveAllLoot":
      // Phase 29 (LOOT-02): no payload fields — same shape as takeFind/leaveFind.
      break;
    case "useAbility":
      // Phase 38 (ABIL-01/04): the ONE wire-shape guard — everything else
      // (unowned/on-cooldown/out-of-combat/etc.) is a named engine refusal,
      // not a validation failure.
      if (typeof action.key !== "string" || action.key.length === 0) {
        return { ok: false, reason: "useAbility.key must be a non-empty string" };
      }
      break;
    case "useTool":
      // Phase 39 (GEAR-05): only the two movement-tile tools may be spent
      // this way (the torch is a useItem activatable, not a useTool target)
      // — everything else (not carried, wrong tile) is a named `toolRefused`
      // engine refusal, not a validation failure.
      if (action.tool !== "ladder" && action.tool !== "rope") {
        return { ok: false, reason: "useTool.tool must be ladder or rope" };
      }
      if (!DIRS.has(action.dir)) {
        return { ok: false, reason: "useTool.dir must be one of N/S/E/W" };
      }
      break;
    default:
      break;
  }
  return { ok: true };
}
