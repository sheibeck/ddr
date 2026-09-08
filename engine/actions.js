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
]);

const DIRS = new Set(["N", "S", "E", "W"]);

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
      if (!isInt(action.idx)) return { ok: false, reason: "castSpell.idx must be an integer" };
      break;
    case "useItem":
      if (!isInt(action.i)) return { ok: false, reason: "useItem.i must be an integer" };
      break;
    default:
      break;
  }
  return { ok: true };
}
