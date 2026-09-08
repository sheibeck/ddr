// engine/engine.js
//
// THE engine boundary (ENG-01): the single public entry point every rules
// slice plugs into. `applyAction(state, action) → {state, events}` is pure and
// synchronous — it validates the action, deep-clones the state, dispatches by
// action.type to the owning slice's handler, persists the RNG cursor, and
// returns the next state plus a list of structured events. No DOM, no render,
// no localStorage, no Math.random inside — the whole tree under engine/ is
// UI-free and deterministic from a seed.
//
// Slice handlers (move/attack/castSpell/…) are added by their own plans; this
// foundation wires validation, cloning, RNG rehydration and the dispatch
// switch. Unknown or malformed actions are no-ops (unchanged state, empty
// events) — they never throw (Security Domain V5).

import { newRun } from "./state.js";
import { validateAction } from "./actions.js";
import { makeRng } from "./rng.js";
import { move, makeCamp } from "./movement.js";
import { playerStrike, flee, parley, sing } from "./combat.js";

/**
 * applyAction(state, action) — the pure dispatcher.
 *
 * @param {object} state - a GameState (see engine/state.js newRun)
 * @param {object} action - a validated-or-not action object
 * @returns {{ state: object, events: object[] }}
 */
export function applyAction(state, action) {
  const check = validateAction(action);
  if (!check.ok) {
    // Malformed/unknown action: fail safe. Return the state untouched and no
    // events, rather than throwing or corrupting anything.
    return { state, events: [] };
  }

  // structuredClone is deliberately NOT wrapped in try/catch — a stray closure
  // or other non-serializable value entering state should fail fast here
  // (01-RESEARCH.md Pitfall 3 / ENG-04), not be silently shallow-copied around.
  const next = structuredClone(state);

  // Rehydrate the RNG from the persisted cursor so any handler that rolls draws
  // the next values in the run's deterministic stream.
  const rng = makeRng(next.rngState);
  const events = [];

  switch (action.type) {
    case "move":
      move(next, action.dir, rng, events);
      break;
    case "camp":
      makeCamp(next, rng, events);
      break;
    case "attack":
      playerStrike(next, rng, events);
      break;
    case "flee":
      flee(next, rng, events);
      break;
    case "parley":
      parley(next, rng, events);
      break;
    case "sing":
      sing(next, rng, events);
      break;
    // castSpell/drinkPotion/readScroll/buyItem/leaveStore/useItem handlers
    // are added by their slice plans and will dispatch to their module here,
    // each mutating `next` and pushing events.
    default:
      break;
  }

  // Persist the RNG cursor after any handler use (a no-op today for handlers
  // that don't roll, since getState() returns the unchanged cursor).
  next.rngState = rng.getState();
  return { state: next, events };
}

// Re-export the factory so callers have one import for the engine surface.
export { newRun };
