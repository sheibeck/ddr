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
import { startCombat, fight } from "../../engine/combat.js";
import { makeRng } from "../../engine/rng.js";
import { loadPrototypeSandbox } from "./harness/sandboxPrototype.js";
import { diffState } from "./harness/diffState.js";
import {
  stripScenarioDivergence,
  actionPathDivergenceOf,
  skipsByteDiffAt,
  declaredEndDiffs,
  stripSpellSeen,
  stripWaterField,
  reconcilePendingFight,
  chargenShiftOf,
  stripChargenShift,
  chargenShiftDiffs,
  dropEmptyWorn,
} from "./harness/comparables.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const FIXTURE = JSON.parse(fs.readFileSync(path.resolve(__dirname, "fixtures", "action-script.magic.json"), "utf8"));

/**
 * applyFloorFeatureShift(state, floorShift) — Phase 54-07 (USER RULING G
 * cycle 3, BAND-02): a LOCAL copy (test/parity/harness/comparables.js is
 * never edited — the engine gate) of movement-parity.test.js's /
 * combat-parity.test.js's identically-named helper; see either file's own
 * header comment for the ENCOUNTER_DOTS-remap mechanism this declares.
 */
function applyFloorFeatureShift(state, floorShift) {
  const cells = floorShift?.cells?.[state?.floor?.depth];
  if (!cells || !state.floor) return state;
  const g = state.floor.g.map((row) => row.map((cell) => ({ ...cell })));
  for (const { x, y, before } of cells) {
    if (g[y] && g[y][x]) g[y][x] = { ...g[y][x], feat: before };
  }
  return { ...state, floor: { ...state.floor, g } };
}

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
  // Phase 29 (LOOT-01/06): strip the new top-level `state.pendingLoot` too —
  // no magic fixture ever rolls a drop (RESEARCH's Parity Risk Enumeration),
  // so a plain strip (no reconcile) suffices here, unlike combat-parity's
  // "lose" scenario.
  // CMB-01 (Phase 31): reconcile a pending combat FIRST — before the
  // destructure below, since it needs the live rng cursor. See
  // reconcilePendingFight's own JSDoc (harness/comparables.js).
  // Phase 33 (STORE-01): strip `state.storeRoll` too — a sixth analog of party/pendingJoiner/pendingFind/pendingLoot/dev, mirroring harness combatComparable,
  // since this file defines its own local comparable(); always false on a fixture; a plain strip (no reconcile — `store` is transient).
  // Phase 39 (GEAR-05): strip `state.pendingHazard` too — a seventh analog,
  // mirroring harness combatComparable; always null on a fixture.
  // Phase 46 (DEAD-04): strip the prototype-side win flag too — see
  // harness/comparables.js's Phase 46 rationale (a retired-field carve-out,
  // stripRetiredCounterFields precedent).
  state = reconcilePendingFight(state);
  // Phase 65 (RUN-01): strip `state.acts` too, the run's validated-action
  // counter (engine/engine.js#applyAction). Engine-only bookkeeping with no
  // prototype-side equivalent, and a plain strip (no reconcile).
  const { beats, seed, rngState, version, won, lastExchange, exchangeN, party, pendingJoiner, pendingFind, pendingLoot, dev, storeRoll, pendingHazard, acts, ...rest } = state;
  if (rest.combat) {
    const { initNote, round, ...combatRest } = rest.combat; // round: deliberate divergence (round-count fix 2026-09-09, one-per-cycle) — excluded from parity, its only mechanical use (round===1) is preserved+verified via effects
    rest.combat = stripFoeDamageClosures(combatRest);
  }
  // Phase 40 (SPELL-05, Plan 04): strip the new engine-only spellSeen
  // provenance flag too (see harness stripSpellSeen) — mirrored here
  // because this file keeps its own local comparable(). No magic fixture
  // ever casts Map the Floor, so this is a no-op today.
  // Phase 41 (TERR-01): strip the new engine-only water flag too (see
  // harness stripWaterField) — mirrored here for the same reason.
  if (rest.floor) rest.floor = stripWaterField(stripSpellSeen(rest.floor));
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
    // Phase 36 (BAL foundation): strip the new engine-only lazily-created
    // c.timers map too (see harness stripTimersField) — same treatment as
    // name/darkFor/flight/bag, mirrored here because this file keeps its own
    // local comparable().
    // Phase 45 (HEDGE-01/03): drop an empty c.worn map (the engine's
    // spelling of the prototype's "no worn model"); a populated one is
    // declared on the scenario's chargenDivergence, not stripped here —
    // mirrored here because this file keeps its own local comparable().
    // Phase 38 (ABIL-01/02/03): strip the new engine-only c.abilities array
    // too (see harness stripAbilitiesField) — mirrored here because this
    // file keeps its own local comparable().
    // Phase 39 (GEAR-02): strip the retired haste/invis/ether/acute counters too.
    // Phase 41 (TERR-04/05): strip the new engine-only phobiaState/fearArmed
    // fields too (see harness stripPhobiaFields) — mirrored here because
    // this file keeps its own local comparable().
    const { name, darkFor, flightLeft, flightCooldown, bag, timers, abilities, haste, invis, ether, acute, phobiaState, fearArmed, ...cRest } = rest.c;
    rest.c = dropEmptyWorn(cRest);
  }
  return rest;
}

/** applyStartCombat(state, wandering, forced) — the same non-validated-action
 * shape test/parity/combat-parity.test.js uses.
 *
 * CMB-01 (Phase 31): `fight` is chained on the SAME rng (a REAL state
 * advance) so the scenario-scripted "startCombat" action advances exactly
 * as far as the prototype's single call did — the "cast-damage" scenario's
 * castSpell action assumes an active, joined combat. */
function applyStartCombat(state, wandering, forced) {
  const next = structuredClone(state);
  const rng = makeRng(next.rngState);
  const events = [];
  startCombat(next, wandering, forced, rng, events);
  fight(next, rng, events);
  next.rngState = rng.getState();
  return { state: next, events };
}

for (const scenario of FIXTURE.scenarios) {
  test(`magic parity (${scenario.name}): engine matches the frozen prototype after every action`, () => {
    // FID-06 (Phase 23, "Freeze pays out") / CMB-01 (Phase 31): the
    // `cast-damage` scenario (seed 8) carries a declared, measured
    // `divergence` record. Phase 31 replaced its Phase 23 kind-less shape
    // with an "action-path" record (the compared combat object itself
    // differs from action 0 — the prototype's freeze flag vs the engine's
    // afraid counter) — mirror combat-parity's own selection: an
    // action-path record uses the BARE comparable (its per-action byte diff
    // is skipped instead, see skipsByteDiffAt below); a kind-less record
    // (no fixture uses one today, but the shape stays supported) still
    // selects the scenario-scoped stripper. Every other scenario keeps
    // comparing on the bare `comparable()`.
    const pathDiv = actionPathDivergenceOf(scenario);
    // Phase 54-07 (USER RULING G cycle 3, BAND-02): apply this scenario's
    // declared floorFeatureShift before every other strip.
    const floorCmp = (s) => comparable(applyFloorFeatureShift(s, scenario.floorFeatureShift));
    let cmp = pathDiv ? floorCmp : scenario.divergence ? (s) => stripScenarioDivergence(floorCmp(s), scenario.divergence) : floorCmp;
    // Phase 38 (ABIL-02): the "potion" scenario (seed 1) carries a declared
    // chargenDivergence — wrap outermost, on top of pathDiv/scenario.divergence.
    const shift = chargenShiftOf(scenario);
    if (shift) { const inner = cmp; cmp = (s) => stripChargenShift(inner(s), shift); }

    const ctx = loadPrototypeSandbox({ seed: scenario.seed });
    let engineState = newRun(scenario.seed);

    if (shift) {
      const shiftDiffs = chargenShiftDiffs(ctx.S.c, engineState.c, shift);
      assert.equal(shiftDiffs.before, null, `scenario ${scenario.name}: prototype chargen shift != declared before at ${shiftDiffs.before}`);
      assert.equal(shiftDiffs.after, null, `scenario ${scenario.name}: engine chargen shift != declared after at ${shiftDiffs.after}`);
    }

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

      // FID-07 (Phase 24) / CMB-01 (Phase 31): skip the per-action byte diff
      // only when a declared action-path record says the path diverges from
      // this index on.
      if (!skipsByteDiffAt(pathDiv, i)) {
        const divergence = diffState(cmp(ctx.S), cmp(engineState));
        assert.equal(
          divergence,
          null,
          `scenario ${scenario.name}, action ${i} (${JSON.stringify(action)}): state diverges at ${divergence}`,
        );
      }
    });

    if (pathDiv) {
      // FID-07: an action-path record's end state is machine-checked
      // (declaredEndDiffs), not merely stripped — both sides must equal the
      // record's own before/after.
      const ends = declaredEndDiffs(ctx.S, engineState, pathDiv);
      assert.equal(ends.before, null, `scenario ${scenario.name}: prototype end-state != declared before at ${ends.before}`);
      assert.equal(ends.after, null, `scenario ${scenario.name}: engine end-state != declared after at ${ends.after}`);
    } else if (scenario.divergence) {
      // A kind-less (Phase 23-shaped) record: keep the hand-rolled fields
      // loop. No fixture uses this shape today (cast-damage moved to
      // action-path in Phase 31), but the shape stays supported.
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
      // Phase 31 (CMB-01, user ruling 2026-09-16): the seed-8 Illusionist's
      // Beasts phobia triggers Afraid at Fight! — never a lost action. The
      // afraid caster still casts (spellThrown) and Freeze still pays out;
      // nothing is EVER refused for fear (no castRefused/strikeRefused).
      assert.ok(allEventTypes.includes("phobiaAfraid"), "the Illusionist's Beasts phobia triggered Afraid");
      assert.ok(allEventTypes.includes("spellThrown"), "the afraid caster still casts");
      assert.ok(allEventTypes.includes("frozenSolid"), "the frozen foe was narrated");
      assert.ok(allEventTypes.includes("foeKilled"), "the Freeze kill paid out via killFoe");
      assert.ok(!allEventTypes.includes("castRefused"), "nothing is ever refused for fear");
      assert.ok(!allEventTypes.includes("strikeRefused"), "nothing is ever refused for fear");
      assert.equal(engineState.combat, null);
    } else if (scenario.name === "heal") {
      assert.ok(allEventTypes.includes("healed"));
    } else if (scenario.name === "potion") {
      assert.ok(allEventTypes.includes("potionDrunk"));
    } else if (scenario.name === "scroll") {
      assert.ok(allEventTypes.includes("scrollRead") || allEventTypes.includes("scrollCopiedToGrimoire"));
    }
  });
}

test("magic fixture divergence records are narrow and well-formed (FID-06/CMB-01)", () => {
  const withDivergence = FIXTURE.scenarios.filter((s) => s.divergence);
  assert.ok(withDivergence.length <= 1, `expected at most 1 scenario with a divergence record, got ${withDivergence.length}`);
  for (const scenario of withDivergence) {
    const record = scenario.divergence;
    assert.ok(record.phase, `scenario ${scenario.name}: missing phase`);
    assert.ok(Array.isArray(record.fields) && record.fields.length > 0, `scenario ${scenario.name}: fields must be a non-empty array`);
    assert.ok(record.before && typeof record.before === "object", `scenario ${scenario.name}: missing before`);
    assert.ok(record.after && typeof record.after === "object", `scenario ${scenario.name}: missing after`);
    assert.ok(typeof record.rationale === "string" && record.rationale.length > 0, `scenario ${scenario.name}: missing rationale`);
    // Phase 31 (CMB-01): an action-path record additionally requires an
    // integer fromAction; a kind-less (Phase 23-shaped) record has no
    // `kind` field at all — both shapes are accepted here.
    if (record.kind === "action-path") {
      assert.ok(Number.isInteger(record.fromAction), `scenario ${scenario.name}: action-path record missing integer fromAction`);
    }
    for (const field of record.fields) {
      assert.notDeepStrictEqual(
        record.before[field],
        record.after[field],
        `scenario ${scenario.name}: field "${field}" has no real before/after difference — this looks like a blanket regeneration, not a declared divergence`,
      );
    }
  }
});
