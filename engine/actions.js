// engine/actions.js
//
// The Action vocabulary and input validation for the single engine chokepoint
// (ENG-01; Security Domain V5). Every `action` reaching applyAction is
// untrusted — a presentation-layer bug (or, later, a network peer) must never
// throw or corrupt GameState. validateAction checks the action is a non-null
// object, its `type` is known, and the per-type field shapes are well-formed;
// applyAction no-ops (empty events, unchanged state) on anything that fails.

export const ACTION_TYPES = new Set([
  "move",
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
      // ECON-05 (Phase 13): only the two real equip slots — a malformed slot
      // string can never reach the handler.
      if (!EQUIP_SLOTS.has(action.slot)) {
        return { ok: false, reason: "unequipSlot.slot must be 'weapon' or 'armor'" };
      }
      break;
    case "takeFind":
    case "leaveFind":
      // ECON-03 (Phase 13): no payload fields — the pending find is read from
      // state.pendingFind, exactly like leaveStore reads state.store.
      break;
    default:
      break;
  }
  return { ok: true };
}
