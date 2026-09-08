// test/parity/harness/comparables.js
//
// Shared `comparable(state)` transforms and internal-(non-validated)-action
// dispatch helpers for the prototype-parity test suite. Factored out of the
// individual per-domain parity test files (movement-parity.test.js,
// combat-parity.test.js, magic-parity.test.js, economy-parity.test.js) so
// test/parity/full-suite.test.js (ENG-05's phase gate) can reuse the exact
// same closure-vs-data carve-out rules without re-defining them — and,
// critically, WITHOUT importing another `*.test.js` file as a module (which
// would re-execute that file's own top-level `test(...)` registrations a
// second time under node:test).
//
// Every stripping rule here has its rationale documented at length in the
// test file that originally introduced it; see combat-parity.test.js's
// header comment for the BESTIARY `sp.dmg`/`acid.dmg` closure carve-out, and
// economy-parity.test.js's header comment for the store-stock / affliction
// `loss` carve-outs.

import { makeRng } from "../../../engine/rng.js";
import { startCombat } from "../../../engine/combat.js";
import { openStore } from "../../../engine/economy.js";
import { springTrap, openChest, encounterDot } from "../../../engine/encounters.js";
import { descend } from "../../../engine/movement.js";
import { applyAction } from "../../../engine/engine.js";

/** movementComparable(state) — strips engine-only bookkeeping and the
 * prototype's presentation-only `beats`. No domain-specific closures to
 * strip (movement never touches combat/store/affliction sub-state). */
export function movementComparable(state) {
  const { beats, seed, rngState, version, ...rest } = state;
  return rest;
}

/** stripFoeDamageClosures(combat) — BESTIARY's `sp.dmg`/`acid.dmg` are live
 * closures on the frozen prototype and plain dice-notation on the engine;
 * strip the un-comparable "recipe" field from both sides (the mechanical
 * result — resulting `wp` values — is still fully compared). */
export function stripFoeDamageClosures(combat) {
  if (!combat || !Array.isArray(combat.foes)) return combat;
  const foes = combat.foes.map((f) => {
    const next = { ...f };
    if (next.sp && "dmg" in next.sp) {
      const { dmg, ...spRest } = next.sp;
      next.sp = spRest;
    }
    if (next.acid && "dmg" in next.acid) {
      const { dmg, ...acidRest } = next.acid;
      next.acid = acidRest;
    }
    return next;
  });
  return { ...combat, foes };
}

/** combatComparable(state) — combat/magic-parity's shared comparable(). */
export function combatComparable(state) {
  const { beats, seed, rngState, version, lastExchange, exchangeN, ...rest } = state;
  if (rest.combat) {
    const { initNote, ...combatRest } = rest.combat;
    rest.combat = stripFoeDamageClosures(combatRest);
  }
  return rest;
}

/** applyStartCombat(state, wandering, forced) — the engine-side equivalent
 * of applyAction for the internal (non-validated) startCombat call: clone,
 * rebuild rng from the persisted cursor, run startCombat, persist the rng
 * cursor. Mirrors engine/engine.js's applyAction shape exactly. */
export function applyStartCombat(state, wandering, forced) {
  const next = structuredClone(state);
  const rng = makeRng(next.rngState);
  const events = [];
  startCombat(next, wandering, forced, rng, events);
  next.rngState = rng.getState();
  return { state: next, events };
}

/** stripStoreClosures(store) — see this module's header + economy-parity's
 * rationale: a live `buy` closure on the prototype can never structurally
 * equal the engine's plain `{effectId, effectParams}` descriptor. */
export function stripStoreClosures(store) {
  if (!store) return store;
  const stock = store.stock.map((s) => ({ n: s.n, sub: s.sub ?? null, cost: s.cost, sold: !!s.sold }));
  return { ...store, stock };
}

/** stripAfflictionLoss(c) — an affliction's `loss` is a closure on the
 * prototype (AFFLICTIONS' `loss:()=>D(n)`) and plain dice-notation on the
 * engine; strip it the same way as the foe-damage carve-out above. */
function stripAfflictionLoss(c) {
  if (!c || !c.affliction || !("loss" in c.affliction)) return c;
  const { loss, ...afRest } = c.affliction;
  return { ...c, affliction: afRest };
}

/** economyComparable(state) — economy/encounters-parity's shared comparable(). */
export function economyComparable(state) {
  const { beats, seed, rngState, version, lastExchange, exchangeN, ...rest } = state;
  if (rest.store) rest.store = stripStoreClosures(rest.store);
  if (rest.c) rest.c = stripAfflictionLoss(rest.c);
  return rest;
}

/** applyInternal(state, fn) — the shared clone/rng-rehydrate/persist shape
 * for every internal (non-validated) function a fixture drives directly. */
function applyInternal(state, fn) {
  const next = structuredClone(state);
  const rng = makeRng(next.rngState);
  const events = [];
  fn(next, rng, events);
  next.rngState = rng.getState();
  return { state: next, events };
}

const INTERNAL_FNS = { openStore, springTrap, openChest, encounterDot, descend };

/**
 * runEconomyAction(ctx, engineState, action) — dispatches one economy/
 * encounters fixture action against BOTH the prototype sandbox (`ctx`) and
 * the engine, returning the engine's `{state, events}`. Handles the
 * internal-call action types (openStore/springTrap/openChest/encounterDot/
 * descend) plus the validated buyItem/leaveStore actions.
 */
export function runEconomyAction(ctx, engineState, action) {
  if (action.type in INTERNAL_FNS) {
    ctx[action.type]();
    return applyInternal(engineState, INTERNAL_FNS[action.type]);
  }
  if (action.type === "buyItem" || action.type === "leaveStore") {
    ctx[action.type === "buyItem" ? "buyFrom" : "leaveStore"](action.idx);
    return applyAction(engineState, action);
  }
  throw new Error(`unhandled economy/encounters fixture action type: ${action.type}`);
}
