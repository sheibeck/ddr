// ENG-05 combat parity: the extracted engine's combat domain (startCombat,
// playerStrike/attack, flee, parley, foeTurn, killFoe) matches the frozen
// prototype, action for action, across four independent scenarios (win,
// lose/death, flee, parley) — each its own seed + forced encounter type so
// every outcome is deterministic (see the fixture's `_note` for how the
// seeds were found). Both sides consume the SAME mulberry32 stream (the
// sandbox seeds Math.random with it; the engine reads it via makeRng), so a
// faithful port produces byte-identical state after every action.
//
// `startCombat` is not a validated engine action (engine/actions.js's
// ACTION_TYPES) — it's an internal function other rule domains (movement's
// wandering-monster check, and eventually the encounters domain's dot tile)
// call directly. This test therefore special-cases the fixture's
// `startCombat` entries: on the engine side it clones state, rebuilds the
// rng from state.rngState, calls combat.js's startCombat, and persists the
// rng cursor — the exact same shape applyAction itself uses; on the
// prototype side it calls `ctx.startCombat(wandering, forced)` directly.
// Every other action type (attack/flee/parley) IS a validated action and
// goes through the real `applyAction`.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { newRun, applyAction } from "../../engine/engine.js";
import { startCombat } from "../../engine/combat.js";
import { makeRng } from "../../engine/rng.js";
import { loadPrototypeSandbox } from "./harness/sandboxPrototype.js";
import { diffState } from "./harness/diffState.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const FIXTURE = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "fixtures", "action-script.combat.json"), "utf8"),
);

/**
 * comparable(state) — strips fields that are either presentation-only or
 * engine-only bookkeeping, out of the combat-parity surface (mirroring
 * test/parity/movement-parity.test.js's comparable()):
 *   - `beats` — the prototype's narration-log grouping (never populated by
 *     the engine).
 *   - `seed`/`rngState`/`version` — engine-only save/replay bookkeeping the
 *     prototype's `S` never carried.
 *   - `lastExchange`/`exchangeN` — set only by the prototype's `act()`
 *     presentation wrapper, which this test deliberately does not call
 *     (calling combat functions directly, like movement-parity.test.js
 *     does for `move()`); the engine has no equivalent fields at all.
 *   - `combat.initNote` — a narration string the prototype stores directly
 *     on `S.combat` (a real, persistent field, not a `say()` call) purely
 *     for display; engine/events.js's "no HTML/copy in engine state"
 *     contract deliberately omits it. Nothing else ever reads this field
 *     for gameplay logic (grep-verified against mazeworld.html).
 *   - `combat.foes[].sp.dmg` / `combat.foes[].acid.dmg` — the frozen
 *     prototype's BESTIARY stores a creature's damage as a live CLOSURE
 *     (`dmg: () => D(8)`, mazeworld.html ~line 751-813); content/bestiary.js
 *     deliberately ports this to plain dice notation (`{n,sides,bonus}`,
 *     per its own header comment) so the engine's foe objects stay 100%
 *     JSON-serializable (ENG-04). A live function value on the prototype
 *     side makes `structuredClone` (stripVolatileFields's cloning strategy)
 *     throw outright the moment ANY encountered foe's roster entry has a
 *     `dmg` field — this is why some seeds in this fixture "happened" to
 *     pass before this stripping was added (whichever foe they rolled
 *     lacked a `dmg` field) while others didn't. The two representations
 *     (closure vs. data) can never be structurally compared anyway; the
 *     MECHANICAL result of calling/resolving either one every round (the
 *     resulting `wp` values) is still fully compared as plain numbers, so
 *     stripping the un-comparable "recipe" field from both sides loses no
 *     real parity coverage.
 */
function stripFoeDamageClosures(combat) {
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

function comparable(state) {
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
function applyStartCombat(state, wandering, forced) {
  const next = structuredClone(state);
  const rng = makeRng(next.rngState);
  const events = [];
  startCombat(next, wandering, forced, rng, events);
  next.rngState = rng.getState();
  return { state: next, events };
}

for (const scenario of FIXTURE.scenarios) {
  test(`combat parity (${scenario.name}): engine matches the frozen prototype after every action`, () => {
    const ctx = loadPrototypeSandbox({ seed: scenario.seed });
    let engineState = newRun(scenario.seed);

    const initialDivergence = diffState(comparable(ctx.S), comparable(engineState));
    assert.equal(
      initialDivergence,
      null,
      `scenario ${scenario.name}, seed ${scenario.seed}: initial boot state diverges at ${initialDivergence}`,
    );

    const allEventTypes = [];
    scenario.actions.forEach((action, i) => {
      if (action.type === "startCombat") {
        ctx.startCombat(action.wandering, action.forced);
        const { state, events } = applyStartCombat(engineState, action.wandering, action.forced);
        engineState = state;
        allEventTypes.push(...events.map((e) => e.type));
      } else if (action.type === "attack") {
        ctx.playerStrike();
        const { state, events } = applyAction(engineState, { type: "attack" });
        engineState = state;
        allEventTypes.push(...events.map((e) => e.type));
      } else if (action.type === "flee") {
        ctx.flee();
        const { state, events } = applyAction(engineState, { type: "flee" });
        engineState = state;
        allEventTypes.push(...events.map((e) => e.type));
      } else if (action.type === "parley") {
        ctx.parley();
        const { state, events } = applyAction(engineState, { type: "parley" });
        engineState = state;
        allEventTypes.push(...events.map((e) => e.type));
      } else {
        assert.fail(`unhandled combat fixture action type: ${action.type}`);
      }

      const divergence = diffState(comparable(ctx.S), comparable(engineState));
      assert.equal(
        divergence,
        null,
        `scenario ${scenario.name}, action ${i} (${JSON.stringify(action)}): state diverges at ${divergence}`,
      );
    });

    if (scenario.name === "win") {
      assert.equal(engineState.dead, false);
      assert.equal(engineState.combat, null, "the encounter cleared");
      assert.ok(allEventTypes.includes("foeKilled"));
      assert.ok(allEventTypes.includes("encounterCleared"));
    } else if (scenario.name === "lose") {
      assert.equal(engineState.dead, true);
      assert.ok(allEventTypes.includes("died"));
    } else if (scenario.name === "flee") {
      assert.equal(engineState.combat, null, "fleeing ends combat");
      assert.ok(allEventTypes.includes("fled"));
    } else if (scenario.name === "parley") {
      assert.equal(engineState.combat, null, "a successful parley ends combat");
      assert.ok(allEventTypes.includes("spGained"));
    }
  });
}
