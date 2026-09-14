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
import { stripScenarioDivergence } from "./harness/comparables.js";

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
    // FID-06 (Phase 23, "Freeze pays out"): the `cast-damage` scenario (seed
    // 8) carries a declared, measured `divergence` record — select the
    // scenario-scoped stripper only for it; every other scenario keeps
    // comparing on the bare `comparable()`.
    const cmp = scenario.divergence ? (s) => stripScenarioDivergence(comparable(s), scenario.divergence) : comparable;

    const ctx = loadPrototypeSandbox({ seed: scenario.seed });
    let engineState = newRun(scenario.seed);

    const initialDivergence = diffState(cmp(ctx.S), cmp(engineState));
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

      const divergence = diffState(cmp(ctx.S), cmp(engineState));
      assert.equal(
        divergence,
        null,
        `scenario ${scenario.name}, action ${i} (${JSON.stringify(action)}): state diverges at ${divergence}`,
      );
    });

    if (scenario.divergence) {
      // The record's own before/after values are machine-checked on BOTH
      // sides — the prototype must still be exactly the declared "before",
      // and the engine must be exactly the declared "after" — before the
      // strip above is trusted to hide anything.
      const protoC = comparable(ctx.S).c;
      const engineC = comparable(engineState).c;
      for (const field of scenario.divergence.fields) {
        assert.equal(
          diffState(protoC[field], scenario.divergence.before[field]),
          null,
          `scenario ${scenario.name}: prototype ${field} does not match the declared "before" value`,
        );
        assert.equal(
          diffState(engineC[field], scenario.divergence.after[field]),
          null,
          `scenario ${scenario.name}: engine ${field} does not match the declared "after" value`,
        );
      }
    }

    if (scenario.name === "cast-damage") {
      // FID-06: Freeze now pays out via killFoe — a hit must show BOTH
      // frozenSolid (the narration) and foeKilled (the payout), not "one way
      // or another" as before this phase.
      assert.ok(allEventTypes.includes("frozenSolid"), "the frozen foe was narrated");
      assert.ok(allEventTypes.includes("foeKilled"), "the Freeze kill paid out via killFoe");
    } else if (scenario.name === "heal") {
      assert.ok(allEventTypes.includes("healed"));
    } else if (scenario.name === "potion") {
      assert.ok(allEventTypes.includes("potionDrunk"));
    } else if (scenario.name === "scroll") {
      assert.ok(allEventTypes.includes("scrollRead") || allEventTypes.includes("scrollCopiedToGrimoire"));
    }
  });
}

test("magic fixture divergence records are narrow and well-formed (FID-06)", () => {
  const withDivergence = FIXTURE.scenarios.filter((s) => s.divergence);
  assert.ok(withDivergence.length <= 1, `expected at most 1 scenario with a divergence record, got ${withDivergence.length}`);
  for (const scenario of withDivergence) {
    const record = scenario.divergence;
    assert.ok(record.phase, `scenario ${scenario.name}: missing phase`);
    assert.ok(Array.isArray(record.fields) && record.fields.length > 0, `scenario ${scenario.name}: fields must be a non-empty array`);
    assert.ok(record.before && typeof record.before === "object", `scenario ${scenario.name}: missing before`);
    assert.ok(record.after && typeof record.after === "object", `scenario ${scenario.name}: missing after`);
    assert.ok(typeof record.rationale === "string" && record.rationale.length > 0, `scenario ${scenario.name}: missing rationale`);
    for (const field of record.fields) {
      assert.notDeepStrictEqual(
        record.before[field],
        record.after[field],
        `scenario ${scenario.name}: field "${field}" has no real before/after difference — this looks like a blanket regeneration, not a declared divergence`,
      );
    }
  }
});
