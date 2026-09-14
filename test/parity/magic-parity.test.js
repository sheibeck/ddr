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
  // PARTY-02 (Phase 7): strip the new top-level `state.party` roster — no
  // prototype-side equivalent; same carve-out as harness/comparables.js's
  // combatComparable, mirrored here because this file has its own comparable().
  // PARTY-01 (Phase 9): strip the new top-level `state.pendingJoiner` too —
  // second top-level analog of `party`, mirroring harness combatComparable.
  // ECON-02 (Phase 12): strip the new top-level `state.pendingFind` too — third
  // top-level analog of `party`/`pendingJoiner`, mirroring harness combatComparable.
  // Phase 21 (TUNE-04, D-14): strip the new top-level `state.dev` too — a
  // fourth analog of party/pendingJoiner/pendingFind, mirroring harness
  // combatComparable, since this file defines its own local comparable().
  const { beats, seed, rngState, version, lastExchange, exchangeN, party, pendingJoiner, pendingFind, dev, ...rest } = state;
  if (rest.combat) {
    const { initNote, round, ...combatRest } = rest.combat; // round: deliberate divergence (round-count fix 2026-09-09, one-per-cycle) — excluded from parity, its only mechanical use (round===1) is preserved+verified via effects
    rest.combat = stripFoeDamageClosures(combatRest);
  }
  // PHOBIA-01 (04.1-05): c.darkFor is a brand-new engine-only field with no
  // prototype-side equivalent — strip it the same way test/parity/harness/
  // comparables.js's combatComparable does (this file predates that shared
  // helper and keeps its own local comparable(), mirroring combat-parity).
  // audit-batch1 (2026-09-09, A2): same treatment for c.flightLeft/
  // c.flightCooldown — see test/parity/harness/comparables.js's
  // stripFlightFields for the full rationale.
  // DR-name-generator (2026-09-09): c.name is now a generative first × surname
  // build — a deliberate cosmetic divergence made with the SAME single rng draw;
  // strip it like darkFor above (see harness/comparables.js's stripNameField).
  if (rest.c) {
    // ECON-01 (Phase 12): strip the new engine-only c.bag field too (see harness
    // stripBagField) — same treatment as name/darkFor/flight, mirrored here.
    const { name, darkFor, flightLeft, flightCooldown, bag, ...cRest } = rest.c;
    rest.c = cRest;
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
