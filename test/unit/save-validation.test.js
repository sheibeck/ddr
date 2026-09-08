// Task 3 — save serialization + fail-closed load validation (ENG-04,
// save-tampering control T-01-06a).
//
// Proves: serializeRun -> validateSave -> rehydrate round-trips a fresh run
// deepStrictEqual; broken JSON and a shape-missing-c/floor save both fail
// closed (`{ok:false}`, never throw); an old-shape save (no seed/rngState)
// rehydrates with safe defaults; saveState.js references no
// localStorage/document.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { newRun } from "../../engine/state.js";
import { serializeRun, validateSave, rehydrate } from "../../engine/saveState.js";
import { die } from "../../engine/death.js";
import { makeRng } from "../../engine/rng.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

test("serializeRun -> JSON -> validateSave -> rehydrate round-trips a fresh run deepStrictEqual", () => {
  for (const seed of [1, 42, 12345]) {
    const original = newRun(seed);
    const json = JSON.stringify(serializeRun(original));
    const check = validateSave(json);
    assert.equal(check.ok, true);
    const rehydrated = rehydrate(check.value);
    assert.deepStrictEqual(rehydrated, original, `seed ${seed} must round-trip losslessly`);
  }
});

test("validateSave never throws on broken JSON and fails closed", () => {
  assert.doesNotThrow(() => validateSave("{"));
  assert.equal(validateSave("{").ok, false);

  assert.doesNotThrow(() => validateSave("not json at all"));
  assert.equal(validateSave("not json at all").ok, false);
});

test("validateSave rejects a save missing c or floor", () => {
  assert.equal(validateSave("{}").ok, false);
  assert.equal(validateSave(JSON.stringify({ c: {} })).ok, false, "missing floor");
  assert.equal(validateSave(JSON.stringify({ floor: {} })).ok, false, "missing c");
});

// CR-01 regression: a structurally-shallow save (present-but-empty `c`/
// `floor` objects) used to pass validation, rehydrate unchanged, and crash
// the very next `move` action with an uncaught TypeError (floor.g/px/py all
// undefined). validateSave must now deep-validate the minimal shape the
// engine's rule modules actually dereference and reject anything short of
// it, fail-closed, before it ever reaches rehydrate()/applyAction.
test("CR-01: validateSave rejects a structurally-shallow save ({c:{}, floor:{}}) instead of accepting it", () => {
  const check = validateSave(JSON.stringify({ c: {}, floor: {} }));
  assert.equal(check.ok, false, "an empty c/floor must be rejected, not silently accepted");
});

test("CR-01: validateSave rejects a character missing required fields (wp/maxWP/level/skills)", () => {
  const validFloor = { g: [[{ wall: false }]], px: 0, py: 0, depth: 1 };
  assert.equal(validateSave(JSON.stringify({ c: {}, floor: validFloor })).ok, false, "empty c");
  assert.equal(
    validateSave(JSON.stringify({ c: { wp: 10, maxWP: 10, level: 1 }, floor: validFloor })).ok,
    false,
    "c missing skills",
  );
  assert.equal(
    validateSave(JSON.stringify({ c: { wp: 10, maxWP: 10, skills: {} }, floor: validFloor })).ok,
    false,
    "c missing level",
  );
});

test("CR-01: validateSave rejects a floor missing required fields (g/px/py/depth)", () => {
  const validChar = { wp: 10, maxWP: 10, level: 1, skills: {} };
  assert.equal(validateSave(JSON.stringify({ c: validChar, floor: {} })).ok, false, "empty floor");
  assert.equal(
    validateSave(JSON.stringify({ c: validChar, floor: { px: 0, py: 0, depth: 1 } })).ok,
    false,
    "floor missing g",
  );
  assert.equal(
    validateSave(JSON.stringify({ c: validChar, floor: { g: [[{ wall: false }]], depth: 1 } })).ok,
    false,
    "floor missing px/py",
  );
});

test("CR-01: validateSave accepts a minimally-shaped, well-formed save", () => {
  const validChar = { wp: 10, maxWP: 10, level: 1, skills: {} };
  const validFloor = { g: [[{ wall: false }]], px: 0, py: 0, depth: 1 };
  const check = validateSave(JSON.stringify({ c: validChar, floor: validFloor }));
  assert.equal(check.ok, true);
});

test("validateSave rejects non-object and null/array inputs without throwing", () => {
  for (const bad of [null, 42, "null", "[]", JSON.stringify(null)]) {
    assert.doesNotThrow(() => validateSave(bad));
    assert.equal(validateSave(bad).ok, false, `expected ok:false for ${JSON.stringify(bad)}`);
  }
});

test("an old-shape save (no seed/rngState) rehydrates with safe defaults", () => {
  // Mirrors mazeworld.html's pre-refactor save shape:
  // {c, floor, day, steps, dead, won, deathNote, epitaph} — no seed/rngState.
  // (c/floor still carry the full real shape a pre-refactor save always had —
  // only seed/rngState are the "old" part being defaulted here; see CR-01's
  // deep-shape validation, which now requires this much of c/floor regardless
  // of save vintage.)
  const oldSave = {
    c: { name: "Old Save Delver", cls: "Fighter", wp: 12, maxWP: 20, level: 2, skills: {} },
    floor: { depth: 2, g: [[{ wall: false }]], px: 1, py: 1 },
    day: 4,
    steps: 88,
    dead: false,
    won: false,
    deathNote: "",
    epitaph: "",
  };
  const check = validateSave(JSON.stringify(oldSave), { freshSeed: 777 });
  assert.equal(check.ok, true);
  assert.equal(check.value.seed, 777);
  assert.equal(typeof check.value.rngState, "number");

  const state = rehydrate(check.value);
  assert.equal(state.day, 4);
  assert.equal(state.steps, 88);
  assert.equal(state.combat, null);
  assert.equal(state.store, null);
  assert.equal(state.beats, null);
  assert.deepStrictEqual(state.c, oldSave.c);
});

// MD-01 regression: die()/winGame() set state.deathAt/lastWords on a
// terminal run, and serializeRun() preserves them (it spreads the full
// state) — but the save/load round-trip (validateSave -> rehydrate) used to
// silently drop both. A reload of a dead run's save must keep its
// time-of-death and "last words".
test("MD-01: a dead run's deathAt/lastWords survive serializeRun -> validateSave -> rehydrate", () => {
  const state = newRun(1);
  const rng = makeRng(state.rngState);
  die(state, "starve", null, rng, [], () => 998877);
  state.rngState = rng.getState();

  const json = JSON.stringify(serializeRun(state));
  const check = validateSave(json);
  assert.equal(check.ok, true);

  const rehydrated = rehydrate(check.value);
  assert.equal(rehydrated.deathAt, 998877);
  assert.deepStrictEqual(rehydrated.lastWords, state.lastWords);
});

test("MD-01: a fresh (non-terminal) run's rehydrated state carries no spurious deathAt/lastWords keys", () => {
  const original = newRun(2);
  const check = validateSave(JSON.stringify(serializeRun(original)));
  const rehydrated = rehydrate(check.value);
  assert.ok(!("deathAt" in rehydrated), "a fresh run must not gain a deathAt key");
  assert.ok(!("lastWords" in rehydrated), "a fresh run must not gain a lastWords key");
});

test("validateSave defaults day/steps when missing or non-numeric", () => {
  const validChar = { wp: 10, maxWP: 10, level: 1, skills: {} };
  const validFloor = { g: [[{ wall: false }]], px: 0, py: 0, depth: 1 };

  const check = validateSave(JSON.stringify({ c: validChar, floor: validFloor }));
  assert.equal(check.value.day, 1);
  assert.equal(check.value.steps, 0);

  const check2 = validateSave(
    JSON.stringify({ c: validChar, floor: validFloor, day: "four", steps: null }),
  );
  assert.equal(check2.value.day, 1);
  assert.equal(check2.value.steps, 0);
});

test("rehydrate always resets combat/store/beats to null even if present in the input", () => {
  const state = rehydrate({ seed: 1, rngState: 2, c: {}, floor: {}, day: 1, steps: 0, combat: { x: 1 }, store: { y: 2 }, beats: { z: 3 } });
  assert.equal(state.combat, null);
  assert.equal(state.store, null);
  assert.equal(state.beats, null);
});

/** Strip block + line comments before scanning source for forbidden refs. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

test("saveState.js references no localStorage/document", () => {
  const src = stripComments(fs.readFileSync(path.join(REPO_ROOT, "engine", "saveState.js"), "utf8"));
  assert.ok(!/\blocalStorage\b/.test(src));
  assert.ok(!/\bdocument\b/.test(src));
});
