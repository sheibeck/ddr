// ENG-05 movement parity: the extracted engine's move/newDay/teleport/
// descend match the frozen prototype's, action for action, for the
// same seed and the same ordered script. Both sides consume the SAME
// mulberry32 stream (the sandbox seeds Math.random with it; the engine reads
// it via makeRng), so a faithful port produces byte-identical state after
// every move: legality, one-way doors, reveal, the day-100 upkeep tick, and
// the exit-triggered descend to floor 2.
//
// `beats` is excluded from the comparison on both sides. It is the
// prototype's narration-log grouping (mazeworld.html's S.beats/newBeat()) —
// a presentation artifact, not a gameplay outcome. The extracted engine
// deliberately never populates it (engine/saveState.js's rehydrate already
// always resets it to null, per 01-06); the engine's equivalent narration
// channel is the structured `events` array returned by applyAction, which
// this test asserts loosely (event `type` sequence only), per
// 01-RESEARCH.md Open Question 1: assert state strictly, events loosely.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { newRun, applyAction } from "../../engine/engine.js";
import { loadPrototypeSandbox } from "./harness/sandboxPrototype.js";
import { diffState } from "./harness/diffState.js";
import { reconcilePendingFight, chargenShiftOf, stripChargenShift, chargenShiftDiffs, stripSpellSeen, stripWaterField, stripCloakArmorTxt, dropEmptyWorn, actionPathDivergenceOf, skipsByteDiffAt, declaredEndDiffs } from "./harness/comparables.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const FIXTURE = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "fixtures", "action-script.movement.json"), "utf8"),
);

/**
 * comparable(state) — strips fields that are either presentation-only
 * (`beats`, the prototype's narration-log grouping — see header comment) or
 * engine-only bookkeeping the prototype's `S` never carried (`seed`,
 * `rngState`, `version` — added by engine/state.js's newRun for
 * serialize/rehydrate, ENG-04). Both are out of the movement-parity surface;
 * strip them from both sides before every diffState call.
 */
function comparable(state) {
  // PARTY-02 (Phase 7): `state.party` is a brand-new top-level roster field
  // (engine/state.js's newRun) with no prototype-side equivalent — strip it the
  // same way test/parity/harness/comparables.js's movementComparable does,
  // since this file defines its own local comparable() rather than importing
  // the shared one. Top-level analog of the darkFor/flight `c.*` strip below.
  // PARTY-01 (Phase 9): strip the new top-level `state.pendingJoiner` too —
  // second top-level analog of `party`, mirroring harness movementComparable.
  // ECON-02 (Phase 12): strip the new top-level `state.pendingFind` too — third
  // top-level analog of `party`/`pendingJoiner`, mirroring harness movementComparable.
  // Phase 21 (TUNE-04, D-14): strip the new top-level `state.dev` too — a
  // fourth analog of party/pendingJoiner/pendingFind, mirroring harness
  // movementComparable, since this file defines its own local comparable().
  // Phase 29 (LOOT-01/06): strip the new top-level `state.pendingLoot` too —
  // the movement fixture never fights (RESEARCH "LOOT-05 guard safety"), so
  // it is always empty here — a plain strip (no reconcile) suffices.
  // CMB-01 (Phase 31): reconcile a pending combat FIRST — before the
  // destructure below, since it needs the live rng cursor (a no-op here:
  // this fixture's 101 moves never produce a non-null state.combat, per the
  // pending-fight-audit test). See reconcilePendingFight's own JSDoc
  // (harness/comparables.js).
  // Phase 33 (STORE-01): strip `state.storeRoll` too — a sixth analog of party/pendingJoiner/pendingFind/pendingLoot/dev, mirroring harness movementComparable,
  // since this file defines its own local comparable(); always false on a fixture; a plain strip (no reconcile — `store` is transient).
  // Phase 39 (GEAR-05): strip `state.pendingHazard` too — a seventh analog,
  // mirroring harness movementComparable; always null on this fixture (no
  // fixture hero carries a rope/ladder, so the pre-check never fires).
  // Phase 46 (DEAD-04): strip the prototype-side win flag too — see
  // harness/comparables.js's Phase 46 rationale (a retired-field carve-out,
  // stripRetiredCounterFields precedent).
  // RULES-12 (Phase 75): strip `state.pendingTile` too — an eighth analog,
  // mirroring harness movementComparable; always null on this fixture (no
  // replay site here emits wanderingMonster while stepping onto a feature).
  state = reconcilePendingFight(state);
  // Phase 65 (RUN-01): strip `state.acts` too, the run's validated-action
  // counter (engine/engine.js#applyAction). Engine-only bookkeeping with no
  // prototype-side equivalent, and a plain strip (no reconcile).
  const { beats, seed, rngState, version, won, party, pendingJoiner, pendingFind, pendingLoot, dev, storeRoll, pendingHazard, pendingTile, acts, ...rest } = state;
  // Phase 40 (SPELL-05, Plan 04): strip the new engine-only spellSeen
  // provenance flag too (see harness stripSpellSeen) — mirrored here
  // because this file keeps its own local comparable(). No movement
  // fixture ever casts Map the Floor, so this is a no-op today.
  // Phase 41 (TERR-01): strip the new engine-only water flag too (see
  // harness stripWaterField) — mirrored here for the same reason. Water
  // lands on every floor (no run flag), so this is a genuine no-op-ONLY-
  // because-it's-stripped, not a "never happens" case like spellSeen above.
  if (rest.floor) rest.floor = stripWaterField(stripSpellSeen(rest.floor));
  // PHOBIA-01 (04.1-05): c.darkFor is a brand-new engine-only field (see
  // engine/character.js's rollCharacter) with no prototype-side equivalent
  // at all — strip it the same way test/parity/harness/comparables.js's
  // movementComparable does, since this file defines its own local
  // comparable() rather than importing the shared one.
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
    // declared on the script's chargenDivergence, not stripped here —
    // mirrored here because this file keeps its own local comparable().
    // Phase 38 (ABIL-01/02/03): strip the new engine-only c.abilities array
    // too (see harness stripAbilitiesField) — mirrored here because this
    // file keeps its own local comparable().
    // Phase 39 (GEAR-02): strip the retired haste/invis/ether/acute counters too.
    // Phase 41 (TERR-04/05): strip the new engine-only phobiaState/fearArmed
    // fields too (see harness stripPhobiaFields) — mirrored here because
    // this file keeps its own local comparable().
    const { name, darkFor, flightLeft, flightCooldown, bag, timers, abilities, haste, invis, ether, acute, phobiaState, fearArmed, ...cRest } = rest.c;
    // Phase 43 (CLAR-01 HP-not-WP sweep): strip the REWORDED_TXT_ITEMS'
    // reworded `txt` unit word too (see harness stripCloakArmorTxt) —
    // mirrored here because this file keeps its own local comparable().
    // Seed 256 rolls a Cloak of Healing into the starting bag.
    rest.c = stripCloakArmorTxt(dropEmptyWorn(cRest));
  }
  return rest;
}

test("engine matches the frozen prototype after every action in the movement fixture", () => {
  // Phase 38 (ABIL-02): the movement fixture's seed 256 (Thief Cat Burglar)
  // carries a declared chargenDivergence (the table reshape moved its
  // chargen c.skills) at the script's top level.
  const shift = chargenShiftOf(FIXTURE);
  // Phase 54-07 (USER RULING G cycle 3, BAND-02): ENCOUNTER_DOTS fitted
  // remaps genFloor's feature-scatter cell assignment (dots/tele/chest/
  // trap/climb/gorge) at EVERY depth this fixture visits (1 and 2) — see
  // the fixture's own `floorFeatureShift.rationale` for the full mechanism.
  // The rng cursor itself never moves (the shuffle runs once regardless of
  // the dots count), so this is a deterministic, fully-measured remap, not
  // new randomness; the declared cells are forced to the PROTOTYPE's value
  // on BOTH sides before every comparison below (a no-op on the prototype
  // side, since it already carries that value) — symmetric and side-
  // agnostic, exactly like stripChargenShift's field-strip mechanism, just
  // scoped to `floor.g[y][x].feat` instead of `c.*`.
  const floorShift = FIXTURE.floorFeatureShift;
  function applyFloorFeatureShift(state) {
    const cells = floorShift?.cells?.[String(state?.floor?.depth)];
    if (!cells || !state.floor) return state;
    const g = state.floor.g.map((row) => row.map((cell) => ({ ...cell })));
    for (const { x, y, before } of cells) {
      if (g[y] && g[y][x]) g[y][x] = { ...g[y][x], feat: before };
    }
    return { ...state, floor: { ...state.floor, g } };
  }

  const cmp = shift
    ? (s) => stripChargenShift(comparable(applyFloorFeatureShift(s)), shift)
    : (s) => comparable(applyFloorFeatureShift(s));

  const pathDiv = actionPathDivergenceOf(FIXTURE);

  const ctx = loadPrototypeSandbox({ seed: FIXTURE.seed });
  let engineState = newRun(FIXTURE.seed);

  if (shift) {
    const shiftDiffs = chargenShiftDiffs(ctx.S.c, engineState.c, shift);
    assert.equal(shiftDiffs.before, null, `movement fixture: prototype chargen shift != declared before at ${shiftDiffs.before}`);
    assert.equal(shiftDiffs.after, null, `movement fixture: engine chargen shift != declared after at ${shiftDiffs.after}`);
  }

  // Sanity: both sides must start from the identical rolled character/floor
  // before any action runs (chargen-parity already proves this in general;
  // this is a fast, local re-confirmation for this specific seed).
  const initialDivergence = diffState(cmp(ctx.S), cmp(engineState));
  assert.equal(initialDivergence, null, `seed ${FIXTURE.seed}: initial boot state diverges at ${initialDivergence}`);

  const allEventTypes = [];
  FIXTURE.actions.forEach((action, i) => {
    assert.equal(action.type, "move", "the movement fixture only carries move actions");
    ctx.move(action.dir);
    const { state, events } = applyAction(engineState, action);
    engineState = state;
    allEventTypes.push(...events.map((e) => e.type));

    if (!skipsByteDiffAt(pathDiv, i)) {
      const divergence = diffState(cmp(ctx.S), cmp(engineState));
      assert.equal(divergence, null, `action ${i} (${JSON.stringify(action)}): state diverges at ${divergence}`);
    }
  });

  if (pathDiv) {
    const ends = declaredEndDiffs(ctx.S, engineState, pathDiv);
    assert.equal(ends.before, null, `movement fixture: prototype end-state != declared before at ${ends.before}`);
    assert.equal(ends.after, null, `movement fixture: engine end-state != declared after at ${ends.after}`);
  }

  // Loose event-sequence assertions (01-RESEARCH Open Question 1): the
  // fixture is specifically constructed to exercise a one-way door, a
  // descend, and a day-cycle tick — confirm the engine's event stream
  // recorded each of those beats, without pinning exact field contents.
  assert.ok(allEventTypes.includes("floorChanged"), "the descend to floor 2 must emit floorChanged");
  assert.ok(allEventTypes.includes("dayBegan"), "the 100-step tick must emit dayBegan");
  assert.ok(!allEventTypes.includes("wanderingMonster"), "seed 256 was chosen to draw zero wandering-monster hits");
  assert.ok(!allEventTypes.includes("oneWayBlocked"), "the fixture's one-way door is entered from its open side");
  assert.equal(engineState.floor.depth, 2);
  assert.equal(engineState.day, 2);
  assert.equal(engineState.steps, 100);
  assert.equal(engineState.dead, false);
});

test("USER RULING G (cycle 3, BAND-02): the declared floorFeatureShift cells actually match measured prototype/engine floor.g feat values at depths 1 and 2 — a regression guard, not just an assumption", () => {
  const floorShift = FIXTURE.floorFeatureShift;
  assert.ok(floorShift && floorShift.cells, "the movement fixture must carry a floorFeatureShift declaration");

  const ctx = loadPrototypeSandbox({ seed: FIXTURE.seed });
  let engineState = newRun(FIXTURE.seed);

  const checkDepth = (depth) => {
    const cells = floorShift.cells[String(depth)];
    assert.ok(Array.isArray(cells) && cells.length > 0, `floorFeatureShift must declare cells for depth ${depth}`);
    for (const { x, y, before, after } of cells) {
      assert.equal(ctx.S.floor.g[y][x].feat ?? null, before, `depth ${depth} (${x},${y}): prototype feat != declared before`);
      assert.equal(engineState.floor.g[y][x].feat ?? null, after, `depth ${depth} (${x},${y}): engine feat != declared after`);
    }
    // No UNDECLARED cell diverges either — the declared set is exhaustive.
    for (let yy = 0; yy < ctx.S.floor.g.length; yy++) {
      for (let xx = 0; xx < ctx.S.floor.g[yy].length; xx++) {
        const pf = ctx.S.floor.g[yy][xx].feat ?? null;
        const ef = engineState.floor.g[yy][xx].feat ?? null;
        if (pf === ef) continue;
        assert.ok(cells.some((c) => c.x === xx && c.y === yy), `depth ${depth} (${xx},${yy}): undeclared feat divergence (${pf} vs ${ef})`);
      }
    }
  };

  checkDepth(1);

  FIXTURE.actions.forEach((action) => {
    ctx.move(action.dir);
    const { state } = applyAction(engineState, action);
    engineState = state;
  });
  checkDepth(2);
});
