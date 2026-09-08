// ENG-05 movement parity: the extracted engine's move/newDay/teleport/
// descend/winGame match the frozen prototype's, action for action, for the
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
  const { beats, seed, rngState, version, ...rest } = state;
  return rest;
}

test("engine matches the frozen prototype after every action in the movement fixture", () => {
  const ctx = loadPrototypeSandbox({ seed: FIXTURE.seed });
  let engineState = newRun(FIXTURE.seed);

  // Sanity: both sides must start from the identical rolled character/floor
  // before any action runs (chargen-parity already proves this in general;
  // this is a fast, local re-confirmation for this specific seed).
  const initialDivergence = diffState(comparable(ctx.S), comparable(engineState));
  assert.equal(initialDivergence, null, `seed ${FIXTURE.seed}: initial boot state diverges at ${initialDivergence}`);

  const allEventTypes = [];
  FIXTURE.actions.forEach((action, i) => {
    assert.equal(action.type, "move", "the movement fixture only carries move actions");
    ctx.move(action.dir);
    const { state, events } = applyAction(engineState, action);
    engineState = state;
    allEventTypes.push(...events.map((e) => e.type));

    const divergence = diffState(comparable(ctx.S), comparable(engineState));
    assert.equal(divergence, null, `action ${i} (${JSON.stringify(action)}): state diverges at ${divergence}`);
  });

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
