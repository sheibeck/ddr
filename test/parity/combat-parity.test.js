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
import { startCombat, fight } from "../../engine/combat.js";
import { makeRng } from "../../engine/rng.js";
import { loadPrototypeSandbox } from "./harness/sandboxPrototype.js";
import { diffState } from "./harness/diffState.js";
import {
  stripParleyDivergence,
  actionPathDivergenceOf,
  skipsByteDiffAt,
  declaredEndDiffs,
  stripCloakArmorTxt,
  stripReauthoredEveryField,
  stripSpellSeen,
  stripWaterField,
  reconcilePendingLoot,
  reconcilePendingFight,
  chargenShiftOf,
  stripChargenShift,
  chargenShiftDiffs,
  dropEmptyWorn,
} from "./harness/comparables.js";

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
  // Phase 29 (LOOT-01/06): strip + reconcile the new top-level
  // `state.pendingLoot` too — this file's `lose` scenario (seed 14) is
  // EXACTLY the fixture RESEARCH identified as rolling a mid-fight drop (a
  // jewel), so this local comparable() needs the real reconcile, not just a
  // strip (mirroring harness combatComparable via the shared, exported
  // reconcilePendingLoot).
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
  // RULES-12 (Phase 75): strip `state.pendingTile` too — an eighth analog,
  // mirroring harness combatComparable; always null on a fixture.
  state = reconcilePendingFight(state);
  // Phase 65 (RUN-01): strip `state.acts` too, the run's validated-action
  // counter (engine/engine.js#applyAction). Engine-only bookkeeping with no
  // prototype-side equivalent, and a plain strip (no reconcile).
  const { beats, seed, rngState, version, won, lastExchange, exchangeN, party, pendingJoiner, pendingFind, pendingLoot, dev, storeRoll, pendingHazard, pendingTile, acts, ...state0 } = state;
  const rest = reconcilePendingLoot(state0, pendingLoot);
  if (rest.combat) {
    const { initNote, round, ...combatRest } = rest.combat; // round: deliberate divergence (round-count fix 2026-09-09, one-per-cycle) — excluded from parity, its only mechanical use (round===1) is preserved+verified via effects
    rest.combat = stripFoeDamageClosures(combatRest);
  }
  // Phase 40 (SPELL-05, Plan 04): strip the new engine-only spellSeen
  // provenance flag too (see harness stripSpellSeen) — mirrored here
  // because this file keeps its own local comparable().
  // Phase 41 (TERR-01): strip the new engine-only water flag too (see
  // harness stripWaterField) — mirrored here for the same reason.
  if (rest.floor) rest.floor = stripWaterField(stripSpellSeen(rest.floor));
  // PHOBIA-01 (04.1-05): c.darkFor is a brand-new engine-only field with no
  // prototype-side equivalent — strip it the same way test/parity/harness/
  // comparables.js's combatComparable does (this file predates that shared
  // helper and keeps its own local comparable()).
  // audit-batch1 (2026-09-09, A2): same treatment for c.flightLeft/
  // c.flightCooldown — see test/parity/harness/comparables.js's
  // stripFlightFields for the full rationale.
  // DR-name-generator (2026-09-09): c.name is now a generative first × surname
  // build — a deliberate cosmetic divergence made with the SAME single rng draw,
  // so every other field stays byte-identical; strip it like darkFor above (see
  // harness/comparables.js's stripNameField for the full rationale).
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
    // Phase 39 (GEAR-02): strip the retired haste/invis/ether/acute counters
    // too (see harness stripRetiredCounterFields) — the frozen prototype
    // still carries these at 0/whatever value it never raised further, the
    // engine no longer builds them at all; mirrored here because this file
    // keeps its own local comparable().
    // Phase 41 (TERR-04/05): strip the new engine-only phobiaState/fearArmed
    // fields too (see harness stripPhobiaFields) — mirrored here because
    // this file keeps its own local comparable().
    const { name, darkFor, flightLeft, flightCooldown, bag, timers, abilities, haste, invis, ether, acute, phobiaState, fearArmed, ...cRest } = rest.c;
    // Phase 28 (ARMOR-04): the Cloak of Armor's rewritten `txt` is a purely
    // cosmetic content divergence (see harness/comparables.js's
    // stripCloakArmorTxt) — the `flee` scenario's seed 17 rolls this cloak
    // into the bag at chargen, so strip it here too since this file keeps
    // its own local comparable().
    // Phase 39 (GEAR-02, once-a-day rule): strip the three re-authored
    // treasure rows' `every` value too — win/lose-plain/parley's seeds
    // (3/1119/303) each independently roll a Thief starting with a Cloak of
    // Ether; see harness/comparables.js's stripReauthoredEveryField.
    rest.c = stripReauthoredEveryField(stripCloakArmorTxt(dropEmptyWorn(cRest)));
  }
  return rest;
}

/**
 * applyFloorFeatureShift(state, floorShift) — Phase 54-07 (USER RULING G
 * cycle 3, BAND-02): forces a scenario's declared `floorFeatureShift.cells`
 * (measured, per depth) onto BOTH sides' `floor.g[y][x].feat` before
 * comparison — symmetric and side-agnostic, mirroring
 * movement-parity.test.js's identically-named helper (see that file's own
 * header comment for the ENCOUNTER_DOTS-remap mechanism this declares).
 * A no-op when the scenario carries no `floorFeatureShift` or `state.floor`
 * is absent.
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

/** applyStartCombat(state, wandering, forced) — the engine-side equivalent
 * of applyAction for the internal (non-validated) startCombat call: clone,
 * rebuild rng from the persisted cursor, run startCombat, persist the rng
 * cursor. Mirrors engine/engine.js's applyAction shape exactly.
 *
 * CMB-01 (Phase 31): `fight` is chained on the SAME rng (a REAL state
 * advance) so this scenario-scripted `startCombat` action advances exactly
 * as far as the prototype's single call did — the scripted attack/flee/
 * parley actions that follow assume combat is already past initiative. */
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
  test(`combat parity (${scenario.name}): engine matches the frozen prototype after every action`, () => {
    // D-13/D-18 (Phase 20): the parley scenario carries a deliberate, scenario-
    // scoped divergence (c.sp/c.gold/combat.parleyTried/combat.parleyInsulted);
    // see stripParleyDivergence's JSDoc in ./harness/comparables.js. Every other
    // scenario keeps comparing on the bare comparable().
    // Phase 54-07 (USER RULING G cycle 3, BAND-02): apply this scenario's
    // declared floorFeatureShift (if any) BEFORE every other strip — see
    // applyFloorFeatureShift's own header for the ENCOUNTER_DOTS-remap
    // mechanism.
    const floorShift = scenario.floorFeatureShift;
    const baseCmp = scenario.name === "parley"
      ? (s) => stripParleyDivergence(comparable(applyFloorFeatureShift(s, floorShift)))
      : (s) => comparable(applyFloorFeatureShift(s, floorShift));
    // Phase 38 (ABIL-02): win/lose/lose-plain/flee/parley all carry a
    // declared chargenDivergence (the table reshape moved their chargen
    // c.skills) — wrap the base comparable (including any parley strip)
    // with the shift strip.
    const shift = chargenShiftOf(scenario);
    const cmp = shift ? (s) => stripChargenShift(baseCmp(s), shift) : baseCmp;
    // FID-07 (Phase 24, plan 24-02): a scenario MAY carry a generic
    // "action-path" divergence record — declares that the per-action byte
    // diff is skipped from a given action index on (the action path itself
    // diverges), and that both sides' end-of-scenario c-fields (and optional
    // top-level stateFields) equal the record's before/after, machine-checked
    // via declaredEndDiffs below. `null` for every scenario today (no fixture
    // declares one yet), so this is a no-op until Plan 24-03 declares one.
    const pathDiv = actionPathDivergenceOf(scenario);

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

      // FID-07: skip the per-action byte diff only when a declared
      // action-path record says the path diverges from this index on.
      if (!skipsByteDiffAt(pathDiv, i)) {
        const divergence = diffState(cmp(ctx.S), cmp(engineState));
        assert.equal(
          divergence,
          null,
          `scenario ${scenario.name}, action ${i} (${JSON.stringify(action)}): state diverges at ${divergence}`,
        );
      }
    });

    // FID-07: when an action-path record is declared, both sides' end state
    // must equal the record's own before/after — machine-checked, not merely
    // stripped. No-op (both `ctx`/`engineState` untouched) when pathDiv is null.
    //
    // Phase 51 (INIT-01, 2026-09-20): declared a NEW action-path record on
    // `lose-plain` — every multi-round fight now diverges from the first
    // live-fight round advance by construction (initiative is rolled once,
    // never re-rolled per round), so no multi-round death-path fixture stays
    // byte-identical. Measured, not assumed: this Cutthroat's outcome itself
    // flips (fewer consecutive foe turns -> it now clears the encounter
    // instead of dying) — the record's `stateAfter.dead: false` through
    // `declaredEndDiffs` is what actually pins the outcome now, machine-
    // checked exactly like `lose`/`lose-apprentice` above.
    if (pathDiv) {
      const ends = declaredEndDiffs(ctx.S, engineState, pathDiv);
      assert.equal(ends.before, null, `scenario ${scenario.name}: prototype end-state != declared before at ${ends.before}`);
      assert.equal(ends.after, null, `scenario ${scenario.name}: engine end-state != declared after at ${ends.after}`);
    }

    // A record-bearing scenario's outcome is pinned by the record's own
    // stateFields (asserted above via declaredEndDiffs) instead of these
    // hard-coded per-name checks, which assume the byte-identical outcome.
    if (!pathDiv) {
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
    }
  });
}
