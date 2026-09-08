// ENG-05 magic parity: the extracted engine's magic domain (castSpell across
// spell kinds, drinkPotion, readScroll) matches the frozen prototype, action
// for action, across four independent scenarios (a damage spell in a forced
// encounter, a heal, drinking a potion, and reading a scroll — see the
// fixture's `_note` for how the seeds were found). Both sides consume the
// SAME mulberry32 stream (the sandbox seeds Math.random with it; the engine
// reads it via makeRng), so a faithful port produces byte-identical state
// after every action.
//
// `startCombat` is not a validated engine action (engine/actions.js's
// ACTION_TYPES) — mirrors test/parity/combat-parity.test.js's special-casing
// for the "cast-damage" scenario, which needs an active encounter before
// castSpell can target a foe. `castSpell`/`drinkPotion`/`readScroll` ARE
// validated actions and go through the real `applyAction`.

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
const FIXTURE = JSON.parse(fs.readFileSync(path.resolve(__dirname, "fixtures", "action-script.magic.json"), "utf8"));

/**
 * comparable(state) — strips fields that are either presentation-only or
 * engine-only bookkeeping, exactly mirroring test/parity/combat-parity.test.js's
 * comparable() (the "cast-damage" scenario enters an active combat sub-state,
 * so the same BESTIARY damage-closure-vs-data carve-out applies here too —
 * see that file's header comment for the full rationale).
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

/** applyStartCombat(state, wandering, forced) — the same non-validated-action
 * shape test/parity/combat-parity.test.js uses. */
function applyStartCombat(state, wandering, forced) {
  const next = structuredClone(state);
  const rng = makeRng(next.rngState);
  const events = [];
  startCombat(next, wandering, forced, rng, events);
  next.rngState = rng.getState();
  return { state: next, events };
}

for (const scenario of FIXTURE.scenarios) {
  test(`magic parity (${scenario.name}): engine matches the frozen prototype after every action`, () => {
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
      } else if (action.type === "castSpell") {
        ctx.castSpell(action.idx);
        const { state, events } = applyAction(engineState, { type: "castSpell", idx: action.idx });
        engineState = state;
        allEventTypes.push(...events.map((e) => e.type));
      } else if (action.type === "drinkPotion") {
        ctx.drinkPotion();
        const { state, events } = applyAction(engineState, { type: "drinkPotion" });
        engineState = state;
        allEventTypes.push(...events.map((e) => e.type));
      } else if (action.type === "readScroll") {
        ctx.readScroll();
        const { state, events } = applyAction(engineState, { type: "readScroll" });
        engineState = state;
        allEventTypes.push(...events.map((e) => e.type));
      } else {
        assert.fail(`unhandled magic fixture action type: ${action.type}`);
      }

      const divergence = diffState(comparable(ctx.S), comparable(engineState));
      assert.equal(
        divergence,
        null,
        `scenario ${scenario.name}, action ${i} (${JSON.stringify(action)}): state diverges at ${divergence}`,
      );
    });

    if (scenario.name === "cast-damage") {
      assert.ok(
        allEventTypes.some((t) => t === "spellHit" || t === "spellMissed" || t === "frozenSolid" || t === "foeKilled"),
        "the damage spell resolved one way or another",
      );
    } else if (scenario.name === "heal") {
      assert.ok(allEventTypes.includes("healed"));
    } else if (scenario.name === "potion") {
      assert.ok(allEventTypes.includes("potionDrunk"));
    } else if (scenario.name === "scroll") {
      assert.ok(allEventTypes.includes("scrollRead") || allEventTypes.includes("scrollCopiedToGrimoire"));
    }
  });
}
