// test/unit/roll-high-save-compat.test.js
//
// Phase 73 (ROLL-05, Plan 02): a pre-switch save (test/unit/fixtures/roll-
// high/pre-switch-save.json), written by the pre-switch engine, loads and
// resolves identically. Per CONTEXT Area 2 ("Old saves load as they are"):
// no stored number's meaning ever changes, so the switch keeps this save's
// outcome byte-identical, and no migration exists or is ever needed for it.
//
// A failure here means a Phase 73 check site was flipped wrong, or a
// persisted field's meaning was changed when it should not have been.
// NEVER regenerate this fixture in Phase 73 (`node tools/roll-high-
// baseline.mjs save` is for the pre-switch engine only — the whole point is
// a snapshot from BEFORE the switch to compare against).
//
// RULES-11 (Phase 75.2, Plan 02, 2026-09-26): the fixture's own
// `expected.hash` (ONLY — never `save`/`dispatched`) was re-recorded; see
// the fixture JSON's own `note` field for the full bisection. Root cause:
// dispatched index 192 sets `pendingFind` to an Enlarge potion whose `txt`
// carries content/potions.js's rewritten wording — `pendingFind` is part
// of the serialized/hashed state, so a purely cosmetic content edit moves
// the hash even though the potion is never drunk within this fixture's own
// budget (`dead`/`depth`/`actions` are unchanged: false/4/300).
//
// CLIMB-01 (Phase 78, Plan 01, 2026-09-26): `expected.hash` re-recorded
// again (ONLY — `dead`/`depth`/`actions` still false/4/300). Dispatched
// index 233 is a recorded `move N` into a climbable wall the old engine
// crossed in one step; a step toward a wall now pauses on the pre-roll
// decision with no dice, and the recorded list holds no `resolveHazard`, so
// the continuation plays out from the near side (see the fixture's `note`).
//
// Phase 79 quick fix 79-02b (2026-09-27, user ruling "Joiners use only their
// own defences against foe swings"): `expected` re-recorded (ONLY — never
// `save`/`dispatched`; `dead`/`actions` still false/300, `depth` 4 -> 3). The
// save's hero is an Elven Thief/Acrobat; its Joiner, Denn of Ash Alley, is a
// Wilmsry Magic User/Apprentice. Traced live (base 90fa443 vs the fix): the
// first divergence is dispatched index 98, the foe Drekk's swing at Denn. At
// the base the HERO's Acrobat override (3 faces, atLeast 18) shielded Denn,
// so a 17 missed; now Denn reads his own 5 faces (atLeast 16) and the same
// 17 lands (memberStruck, 4 damage). Same draw, same position.
//
// User rulings 2026-09-28 (plan 79.2-01, "freeze should never kill
// outright"): `expected.hash` re-recorded (ONLY — `dead`/`depth`/`actions`
// still false/3/300). Traced live (base 992b1dfa vs the rule): the first
// divergence is dispatched index 98, the Joiner Denn's Freeze on Drekk; its
// 8 damage kills Drekk, now a normal kill (no up-front intel resist, no
// frozen-solid flag on the dead foe). Same draws, same position.
//
// Phase 79.2 early-floor lock (user ruling 2026-09-27, locked by
// RF-79.2-02-3): `expected.hash` re-recorded (ONLY — `dead`/`depth`/
// `actions` still false/3/300). Traced live on the locked engine: under
// setDialsForTuning(79.2's fit/start.json) the replay reproduces the old
// hash exactly; under the locked DIALS the first divergence is dispatched
// index 27 (move N on floor 3), where a Poltergeist's starting wp reads
// FOE_HP_SCALE (base 0.9 -> 1.2): 9 -> 12. Same draws, same position.

// Phase 89 plan 05 (ITEM-07, 2026-09-30): `expected.hash` re-recorded ONLY
// (`dead`/`depth`/`actions` still false/3/300; `save`/`dispatched` untouched).
// A loaded Joiner is dressed the way a new one is (engine/saveState.js runs
// reconcileWorn on each party member), so the save's Joiner, Denn of Ash
// Alley (no cloak or jewel), gains an empty `worn: {}` from the load on.
// Proven state-only: replaying and deleting that empty map re-hashes to the
// old pin b390924b... exactly. No rule, draw or event moved.

// Phase 90 plan 06 (SPELL-12, 2026-10-01): `expected.hash` re-recorded ONLY
// (`dead`/`depth`/`actions` still false/3/300; `save`/`dispatched` untouched).
// The tolerant load (engine/saveState.js#migrateSpellNames) rewrites a saved
// book's removed spells, and the save's Joiner, Denn of Ash Alley, holds Lesser
// Summon, which loads as Summon. Traced live (an extracted tree of the plan base
// c5017f16 against the plan): all 300 dispatched steps' event lists and the final
// rng cursor are identical; the only state difference is that one book entry.
// Proven: replaying and writing Lesser Summon back over Denn's Summon re-hashes to
// the old pin 0e2cc518... exactly. No rule, draw or event moved.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { loadSave, stateHash, serializeRun, replaySteps } from "./harness/rollHighBaseline.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const FIXTURE_PATH = path.resolve(__dirname, "fixtures/roll-high/pre-switch-save.json");
const FIXTURE = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8"));

test("pre-switch save fixture: baseCommit/rollLogicUnchangedSince are recorded, dispatched has at least 200 entries", () => {
  assert.equal(typeof FIXTURE.baseCommit, "string");
  assert.ok(FIXTURE.baseCommit.length > 0);
  assert.equal(FIXTURE.rollLogicUnchangedSince, "c3513b0");
  assert.ok(FIXTURE.note.includes("c3513b0"));
  assert.ok(Array.isArray(FIXTURE.dispatched));
  assert.ok(FIXTURE.dispatched.length >= 200, `expected >= 200 dispatched entries, got ${FIXTURE.dispatched.length}`);
});

test("the pre-switch save loads through loadSave with no conversion step, and hashes to the value it was saved at", () => {
  const loaded = loadSave(FIXTURE.save);
  // The save was snapshotted at a "quiet" step (no combat/store/pending*),
  // so it should carry no state the load path needs to convert or discard —
  // the loaded hash must equal the hash the generator recorded off the SAME
  // live state at snapshot time (recomputed here via a hash of the raw save
  // itself is not meaningful — `save` IS `serializeRun(liveState)`, so
  // `stateHash(loadSave(save))` is compared against `stateHash(save)`
  // treated as a state directly: serializeRun only adds/overwrites
  // `version`, which loadSave also normalizes to STATE_VERSION, so this
  // comparison is apples-to-apples).
  assert.equal(stateHash(loaded), stateHash(FIXTURE.save));
});

test("idempotency: load -> serializeRun -> load reproduces the same hash", () => {
  const loadedOnce = loadSave(FIXTURE.save);
  const reserialized = serializeRun(loadedOnce);
  const loadedTwice = loadSave(reserialized);
  assert.equal(stateHash(loadedTwice), stateHash(loadedOnce));
});

test("resolution: replaySteps over the loaded state reproduces the fixture's recorded continuation exactly", () => {
  const loaded = loadSave(FIXTURE.save);
  const final = replaySteps(loaded, FIXTURE.dispatched);
  assert.equal(final.dead, FIXTURE.expected.dead);
  assert.equal(final.floor.depth, FIXTURE.expected.depth);
  assert.equal(stateHash(final), FIXTURE.expected.hash);
});
