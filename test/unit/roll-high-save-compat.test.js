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
