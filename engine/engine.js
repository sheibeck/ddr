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
import { fight, playerStrike, flee, parley, sing } from "./combat.js";
import { castSpell, drinkPotion, readScroll } from "./magic.js";
import { useItem, takeFind, leaveFind, dropItem, equipItem, unequipSlot, takeLoot, leaveLoot, takeAllLoot, leaveAllLoot } from "./items.js";
import { buyFrom, leaveStore, sellItem } from "./economy.js";
import { resolveJoiner, dismissJoiner } from "./encounters.js";
import { die } from "./death.js";

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
    case "fight":
      // CMB-01 (Phase 31): the FIGHT step — initiative onward, moved out of
      // startCombat. A no-op on a null/already-joined combat (fight itself
      // guards `!C.pending`).
      fight(next, rng, events);
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
    case "castSpell":
      castSpell(next, action.idx, rng, events);
      break;
    case "drinkPotion":
      drinkPotion(next, rng, events);
      break;
    case "readScroll":
      readScroll(next, rng, events);
      break;
    case "buyItem":
      buyFrom(next, action.idx, events);
      break;
    case "leaveStore":
      leaveStore(next, events);
      break;
    case "sellItem":
      // ECON-06 (Phase 14): sell carried item `i` at a store. Pure (no rng):
      // frees the slot, credits gold (bag wilmst-cap clamped), pushes itemSold.
      sellItem(next, action.i, events);
      break;
    case "useItem":
      // Phase 37 (GEAR-03): the slot address form ({ type: "useItem", slot })
      // maps onto useItem's `{ slot }` ref; the original bag-index form is
      // untouched.
      useItem(next, action.slot !== undefined ? { slot: action.slot } : action.i, rng, events);
      break;
    case "abandon":
      // Device-review Pass B1 item 3: "ABANDON THIS CHARACTER" — a voluntary,
      // non-combat run termination. Reuses death.js#die() (the SAME
      // terminator every other death in the game calls) so it goes through
      // this ONE rngState-persisting seam rather than presentation code
      // rolling its own epitaph off-band. A no-op if the run is already
      // over (dead/won) — nothing left to abandon.
      if (!next.dead && !next.won) die(next, "abandon", null, rng, events);
      break;
    case "resolveJoiner":
      // PARTY-01 (Phase 9): accept/decline the pending Joiner meetJoiner stashed.
      // Pure data mutation (no rng): appends to state.party under PARTY_CAP on
      // accept, else declines; always clears state.pendingJoiner.
      resolveJoiner(next, action.accept, events);
      break;
    case "dismissJoiner":
      // Phase 36 (JOIN-01): send a party member away from the Company panel.
      // Pure data mutation, no rng; refuses in combat / with no party / on a
      // bad index.
      dismissJoiner(next, action.i ?? 0, events);
      break;
    case "takeFind":
      // ECON-03 (Phase 13): accept state.pendingFind into the bag (or bagFull).
      // Pure (no rng).
      takeFind(next, events);
      break;
    case "leaveFind":
      // ECON-03 (Phase 13): decline state.pendingFind. Pure (no rng).
      leaveFind(next, events);
      break;
    case "dropItem":
      // ECON-04 (Phase 13): drop carried item `i`, freeing a slot. Pure (no rng).
      dropItem(next, action.i, events);
      break;
    case "equipItem":
      // ECON-05 (Phase 13): equip carried weapon/armor `i` (direct swap; illegal
      // combos rejected). Pure (no rng).
      equipItem(next, action.i, events);
      break;
    case "unequipSlot":
      // ECON-05 (Phase 13): return the equipped weapon/armor to the bag. Pure (no rng).
      unequipSlot(next, action.slot, events);
      break;
    case "takeLoot":
      // Phase 29 (LOOT-02): accept pending drop `i` (stow, or equip-now when
      // `equip` is true). Pure (no rng).
      takeLoot(next, action.i, !!action.equip, events);
      break;
    case "leaveLoot":
      // Phase 29 (LOOT-02): decline pending drop `i`. Pure (no rng).
      leaveLoot(next, action.i, events);
      break;
    case "takeAllLoot":
      // Phase 29 (LOOT-02): take every pending drop that fits. Pure (no rng).
      takeAllLoot(next, events);
      break;
    case "leaveAllLoot":
      // Phase 29 (LOOT-02): decline every pending drop. Pure (no rng).
      leaveAllLoot(next, events);
      break;
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
