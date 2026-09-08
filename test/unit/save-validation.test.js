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
  assert.equal(validateSave(JSON.stringify({ c: {}, floor: {} })).ok, true);
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
  const oldSave = {
    c: { name: "Old Save Delver", cls: "Fighter" },
    floor: { depth: 2 },
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

test("validateSave defaults day/steps when missing or non-numeric", () => {
  const check = validateSave(JSON.stringify({ c: {}, floor: {} }));
  assert.equal(check.value.day, 1);
  assert.equal(check.value.steps, 0);

  const check2 = validateSave(JSON.stringify({ c: {}, floor: {}, day: "four", steps: null }));
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
