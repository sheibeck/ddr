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
  // ECON-02 (Phase 12): pendingFind is transient run state — reset to null on
  // load, exactly like combat/store/beats above.
  assert.equal(state.pendingFind, null);
  // Phase 29 (LOOT-06): pendingLoot has no prototype-side equivalent at all,
  // so an old-shape save with no field defaults to [] (contrast: pendingFind
  // above is reset because it EXISTED as transient state; pendingLoot is
  // additive-with-default, like c.bag via migrateCarry).
  assert.deepStrictEqual(state.pendingLoot, []);
  // ECON-01 (Phase 12): an old save with no c.bag migrates to the class-derived
  // default (Fighter => "medium"); every OTHER field is preserved verbatim.
  assert.equal(state.c.bag, "medium");
  // Phase 38 (ABIL-02): an old save with no c.abilities gets one deterministically
  // rebuilt via ensureAbilities (migrateLegacySkills/splitTableAbilities are
  // no-ops here — an empty c.skills has nothing to rename/split — then
  // grantLevelAbilities(c, "777", 2) rolls the level-1 and level-2 picks off
  // the derived stream); every OTHER field is still preserved verbatim.
  assert.deepStrictEqual(state.c, { ...oldSave.c, bag: "medium", abilities: ["brace", "lastStand"] });
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

// MD-02 regression: validateSave never inspected obj.version, so a save
// claiming a version newer than this build's STATE_VERSION would be
// silently re-stamped and validated against today's shape rules instead of
// being rejected/migrated — the intended extension point for a future
// schema bump. A version <= STATE_VERSION (or missing entirely, a
// pre-refactor save) must still validate normally.
test("MD-02: validateSave rejects a save claiming a version newer than STATE_VERSION", () => {
  const validChar = { wp: 10, maxWP: 10, level: 1, skills: {} };
  const validFloor = { g: [[{ wall: false }]], px: 0, py: 0, depth: 1 };
  const check = validateSave(JSON.stringify({ version: 999, c: validChar, floor: validFloor }));
  assert.equal(check.ok, false);
  assert.match(check.reason, /version/i);
});

test("MD-02: validateSave accepts a save with no version field (pre-refactor save) or version <= STATE_VERSION", () => {
  const validChar = { wp: 10, maxWP: 10, level: 1, skills: {} };
  const validFloor = { g: [[{ wall: false }]], px: 0, py: 0, depth: 1 };
  assert.equal(validateSave(JSON.stringify({ c: validChar, floor: validFloor })).ok, true, "no version field");
  assert.equal(
    validateSave(JSON.stringify({ version: 1, c: validChar, floor: validFloor })).ok,
    true,
    "version === STATE_VERSION",
  );
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

// --- Phase 19 FID-04: new serialized fields never survive a load; old saves untouched ---

test("FID-04: a v1.0-shaped save (no foeEffect / pendingFoes / abilities) loads with c preserved verbatim and no new keys", () => {
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
  const state = rehydrate(check.value);
  // Phase 38 (ABIL-02): see the identical "an old-shape save" test above —
  // ensureAbilities deterministically rebuilds c.abilities from a save that
  // lacks it (freshSeed 777, level 2: the level-1 + level-2 derived-stream picks).
  assert.deepStrictEqual(state.c, { ...oldSave.c, bag: "medium", abilities: ["brace", "lastStand"] });
  assert.equal(Object.hasOwn(state.c, "foeEffect"), false, "a v1.0 save must not gain a foeEffect key");
});

test("FID-04: a mid-combat save carrying every new field rehydrates with combat null and c.foeEffect null", () => {
  const original = newRun(5);
  const withNewFields = structuredClone(original);
  withNewFields.c.foeEffect = { kind: "weakened", rounds: 1 };
  withNewFields.combat = {
    foes: [
      {
        name: "Vampire", type: "Walking Dead", lvl: 5, size: "H", intel: 12,
        wp: 71, maxWP: 71, alive: true, asleep: 0, sp: { atk: 2 }, lives: 1,
        abilities: ["vampireDrain"], cd: { vampireSummon: 3 }, uses: {},
      },
    ],
    pendingFoes: [{ by: "Vampire", foe: { name: "Skeleton" } }],
    type: "Walking Dead", round: 4, target: 0, spellOpen: false, tracked: false,
  };

  const json = JSON.stringify(serializeRun(withNewFields));
  const check = validateSave(json);
  assert.equal(check.ok, true);
  const state = rehydrate(check.value);

  assert.equal(state.combat, null, "combat is always nulled on load");
  assert.equal(state.c.foeEffect, null, "a mid-combat debuff never survives a load");
  assert.equal(Object.hasOwn(state.c, "foeEffect"), true, "the key itself is preserved (present but null)");
  // Every other c field is untouched.
  const { foeEffect: _fe1, ...restOriginal } = original.c;
  const { foeEffect: _fe2, ...restLoaded } = state.c;
  assert.deepStrictEqual(restLoaded, restOriginal);
});

test("FID-04: tampered foeEffect values ('999', -1, [], 0-round object) all become null; validateSave does not mutate its input", () => {
  const validFloor = { g: [[{ wall: false }]], px: 0, py: 0, depth: 1 };
  for (const tampered of ["999", -1, [], { kind: "weakened", rounds: 0 }]) {
    const save = {
      c: { wp: 10, maxWP: 10, level: 1, skills: {}, cls: "Fighter", foeEffect: tampered },
      floor: validFloor,
    };
    const check = validateSave(JSON.stringify(save));
    assert.equal(check.ok, true);
    assert.equal(check.value.c.foeEffect, null, `tampered foeEffect ${JSON.stringify(tampered)} must become null`);
  }

  // validateSave must not mutate the caller's own object in place (only the
  // freshly-parsed clone from JSON.parse — a caller passing an OBJECT
  // directly, not a string, gets structural mutation via migrateCarry/
  // clearFoeEffect today; document that contract explicitly here rather
  // than assert a stronger guarantee validateSave doesn't actually make).
  const inputObj = {
    c: { wp: 10, maxWP: 10, level: 1, skills: {}, cls: "Fighter", bag: "medium", foeEffect: { kind: "dazed", rounds: 3 } },
    floor: validFloor,
  };
  const clonedBefore = structuredClone(inputObj);
  const jsonInput = JSON.stringify(inputObj);
  validateSave(jsonInput);
  // Passing a JSON STRING means validateSave parses its OWN fresh object
  // internally (JSON.parse) — the caller's original object is never touched.
  assert.deepStrictEqual(inputObj, clonedBefore, "validateSave must not mutate a caller's object when given a JSON string");
});

test("FID-04: rehydrate is idempotent on the fixtures above", () => {
  const original = newRun(6);
  const withEffect = structuredClone(original);
  withEffect.c.foeEffect = { kind: "dazed", rounds: 2 };
  withEffect.combat = { foes: [], type: "Beasts", round: 1, target: 0, spellOpen: false, tracked: false };

  const once = rehydrate(withEffect);
  const twice = rehydrate(rehydrate(withEffect));
  assert.deepStrictEqual(twice, once);
});

// --- Phase 21 (TUNE-04, D-14/D-23): the `dev` flag ---

test("D-14/D-23: a pre-Phase-21 save with no dev key loads with dev === false", () => {
  const obj = serializeRun(newRun(5));
  delete obj.dev;
  const check = validateSave(JSON.stringify(obj));
  assert.equal(check.ok, true);
  assert.equal(check.value.dev, false, "a save missing the dev key validates to dev: false");
  assert.equal(rehydrate(check.value).dev, false, "rehydrate also defaults the missing key to false");
});

test("D-14: dev: true survives serializeRun -> JSON -> validateSave -> rehydrate", () => {
  const state = newRun(5, [], { startDepth: 20 });
  const json = JSON.stringify(serializeRun(state));
  const check = validateSave(json);
  assert.equal(check.ok, true);
  const rehydrated = rehydrate(check.value);
  assert.equal(rehydrated.dev, true);
  assert.equal(rehydrated.floor.depth, 20);
  assert.equal(rehydrated.c.level, 5);
});

test("D-23: dev is coerced to a strict boolean", () => {
  const validFloor = { g: [[{ wall: false }]], px: 0, py: 0, depth: 1 };
  const validChar = { wp: 10, maxWP: 10, level: 1, skills: {} };
  for (const [raw, expected] of [["yes", true], [1, true], [0, false], [null, false]]) {
    const save = { c: validChar, floor: validFloor, dev: raw };
    const check = validateSave(JSON.stringify(save));
    assert.equal(check.ok, true);
    assert.equal(check.value.dev, expected, `dev: ${JSON.stringify(raw)} must coerce to ${expected} via validateSave`);
    assert.equal(rehydrate({ ...check.value, dev: raw }).dev, expected, `dev: ${JSON.stringify(raw)} must coerce to ${expected} via rehydrate`);
  }
});

test("Phase 29 (LOOT-06): a non-empty pendingLoot survives serializeRun -> validateSave -> rehydrate in order, and a tampered value degrades to []", () => {
  const validFloor = { g: [[{ wall: false }]], px: 0, py: 0, depth: 1 };
  const validChar = { wp: 10, maxWP: 10, level: 1, skills: {} };
  const pile = [{ kind: "jewel", n: "A" }, { kind: "jewel", n: "B" }];
  const check = validateSave(JSON.stringify({ c: validChar, floor: validFloor, pendingLoot: pile }));
  assert.equal(check.ok, true);
  assert.deepStrictEqual(check.value.pendingLoot, pile);
  assert.deepStrictEqual(rehydrate(check.value).pendingLoot, pile);

  for (const bad of ["x", 42, {}]) {
    const tampered = validateSave(JSON.stringify({ c: validChar, floor: validFloor, pendingLoot: bad }));
    assert.deepStrictEqual(tampered.value.pendingLoot, []);
  }
});

// --- Phase 33 (STORE-01): the `storeRoll` flag ---

test("STORE-01: a pre-Phase-33 save with no storeRoll key loads with storeRoll === false", () => {
  const obj = serializeRun(newRun(5));
  delete obj.storeRoll;
  const check = validateSave(JSON.stringify(obj));
  assert.equal(check.ok, true);
  assert.equal(check.value.storeRoll, false, "a save missing the storeRoll key validates to storeRoll: false");
  assert.equal(rehydrate(check.value).storeRoll, false, "rehydrate also defaults the missing key to false");
});

test("STORE-01: storeRoll: true survives serializeRun -> JSON -> validateSave -> rehydrate", () => {
  const state = newRun(5, [], { storeRoll: true });
  const json = JSON.stringify(serializeRun(state));
  const check = validateSave(json);
  assert.equal(check.ok, true);
  const rehydrated = rehydrate(check.value);
  assert.equal(rehydrated.storeRoll, true);
});

test("STORE-01: storeRoll is coerced to a strict boolean", () => {
  const validFloor = { g: [[{ wall: false }]], px: 0, py: 0, depth: 1 };
  const validChar = { wp: 10, maxWP: 10, level: 1, skills: {} };
  for (const [raw, expected] of [["yes", true], [1, true], [0, false], [null, false], [undefined, false]]) {
    const save = { c: validChar, floor: validFloor, storeRoll: raw };
    const check = validateSave(JSON.stringify(save));
    assert.equal(check.ok, true);
    assert.equal(check.value.storeRoll, expected, `storeRoll: ${JSON.stringify(raw)} must coerce to ${expected} via validateSave`);
    assert.equal(rehydrate({ ...check.value, storeRoll: raw }).storeRoll, expected, `storeRoll: ${JSON.stringify(raw)} must coerce to ${expected} via rehydrate`);
  }
});

// --- Phase 40 (SPELL-05, Plan 04): clearStaleSpellSeen / migrateSpellNames ---

/** A fresh 1x3 floor with two cells carrying a stale spellSeen flag (one
 * seen, one not — the flag never implies seen) and one plain already-
 * graduated cell, for the clearStaleSpellSeen tests below. Freshly built
 * per call so validateSave/rehydrate calls in the same test never share a
 * mutated object. */
function makeFlaggedFloor() {
  return {
    g: [
      [
        { wall: false, seen: true, spellSeen: true },
        { wall: false, seen: false, spellSeen: true },
        { wall: false, seen: true },
      ],
    ],
    px: 0,
    py: 0,
    depth: 1,
  };
}

test("clearStaleSpellSeen (validateSave/rehydrate): stale spellSeen flags with NO live spell:reveal record are removed; seen is left exactly as saved", () => {
  const validChar = { wp: 10, maxWP: 10, level: 1, skills: {} };
  const check = validateSave(JSON.stringify({ c: validChar, floor: makeFlaggedFloor() }));
  assert.equal(check.ok, true);
  assert.deepStrictEqual(
    check.value.floor.g[0].map((c) => ({ seen: c.seen, hasFlag: "spellSeen" in c })),
    [
      { seen: true, hasFlag: false },
      { seen: false, hasFlag: false },
      { seen: true, hasFlag: false },
    ],
    "every flag removed, seen values untouched",
  );

  const rehydrated = rehydrate({ c: { ...validChar }, floor: makeFlaggedFloor(), seed: 1, rngState: 1 });
  assert.deepStrictEqual(
    rehydrated.floor.g[0].map((c) => ({ seen: c.seen, hasFlag: "spellSeen" in c })),
    [
      { seen: true, hasFlag: false },
      { seen: false, hasFlag: false },
      { seen: true, hasFlag: false },
    ],
    "rehydrate mirrors validateSave's own stale-flag clearing",
  );
});

test("clearStaleSpellSeen: a LIVE spell:reveal record (phase effect, left > 0) leaves every spellSeen flag untouched", () => {
  const validChar = {
    wp: 10, maxWP: 10, level: 1, skills: {},
    timers: { "spell:reveal": { cadence: "squares", left: 12, phase: "effect" } },
  };
  const check = validateSave(JSON.stringify({ c: validChar, floor: makeFlaggedFloor() }));
  assert.equal(check.ok, true);
  assert.equal(check.value.floor.g[0][0].spellSeen, true, "a live record leaves the flag alone");
  assert.equal(check.value.floor.g[0][1].spellSeen, true);
});

test("clearStaleSpellSeen: a cooldown-phase or exhausted (left <= 0) spell:reveal record is NOT live — flags are still cleared", () => {
  for (const rec of [
    { cadence: "squares", left: 5, phase: "cooldown" },
    { cadence: "squares", left: 0, phase: "effect" },
  ]) {
    const validChar = { wp: 10, maxWP: 10, level: 1, skills: {}, timers: { "spell:reveal": rec } };
    const check = validateSave(JSON.stringify({ c: validChar, floor: makeFlaggedFloor() }));
    assert.equal(check.ok, true);
    assert.equal("spellSeen" in check.value.floor.g[0][0], false, `record ${JSON.stringify(rec)}: flags must still clear`);
  }
});

test("clearStaleSpellSeen: never injects a spellSeen key onto a floor that never carried one", () => {
  const validFloor = { g: [[{ wall: false, seen: false }]], px: 0, py: 0, depth: 1 };
  const validChar = { wp: 10, maxWP: 10, level: 1, skills: {} };
  const check = validateSave(JSON.stringify({ c: validChar, floor: validFloor }));
  assert.equal(check.ok, true);
  assert.equal("spellSeen" in check.value.floor.g[0][0], false);
});

test("migrateSpellNames (validateSave/rehydrate): a grimoire entry named 'Detect Magic' is rewritten to 'Map the Floor' in place — no card, no narration, no rng", () => {
  const validFloor = { g: [[{ wall: false }]], px: 0, py: 0, depth: 1 };
  const validChar = { wp: 10, maxWP: 10, level: 1, skills: {}, grimoire: ["Heal", "Detect Magic", "Shield"] };
  const check = validateSave(JSON.stringify({ c: validChar, floor: validFloor }));
  assert.equal(check.ok, true);
  assert.deepStrictEqual(check.value.c.grimoire, ["Heal", "Map the Floor", "Shield"], "position preserved");

  const rehydrated = rehydrate({ c: { ...validChar }, floor: validFloor, seed: 1, rngState: 1 });
  assert.deepStrictEqual(rehydrated.c.grimoire, ["Heal", "Map the Floor", "Shield"], "rehydrate mirrors validateSave's own rename");
});

test("migrateSpellNames: dedupes when both the retired and current names are present, keeping the first occurrence; every other name is untouched", () => {
  const validFloor = { g: [[{ wall: false }]], px: 0, py: 0, depth: 1 };
  const validChar = { wp: 10, maxWP: 10, level: 1, skills: {}, grimoire: ["Detect Magic", "Heal", "Map the Floor"] };
  const check = validateSave(JSON.stringify({ c: validChar, floor: validFloor }));
  assert.equal(check.ok, true);
  assert.deepStrictEqual(check.value.c.grimoire, ["Map the Floor", "Heal"], "the later duplicate is dropped, not the earlier rename");
});

test("migrateSpellNames: a grimoire with no retired name, or no grimoire at all, is left completely untouched", () => {
  const validFloor = { g: [[{ wall: false }]], px: 0, py: 0, depth: 1 };
  const untouchedGrimoire = { wp: 10, maxWP: 10, level: 1, skills: {}, grimoire: ["Heal", "Shield"] };
  const check1 = validateSave(JSON.stringify({ c: untouchedGrimoire, floor: validFloor }));
  assert.deepStrictEqual(check1.value.c.grimoire, ["Heal", "Shield"]);

  const noGrimoire = { wp: 10, maxWP: 10, level: 1, skills: {} };
  const check2 = validateSave(JSON.stringify({ c: noGrimoire, floor: validFloor }));
  assert.equal("grimoire" in check2.value.c, false, "no grimoire key is ever injected");
});

// --- Phase 41 (TERR-01): sanitizeWaterCells ---

test("sanitizeWaterCells (validateSave/rehydrate): a pre-Phase-41 save (no cell ever carried a water key) round-trips through serializeRun -> JSON -> validateSave -> rehydrate with zero water cells and no injected key", () => {
  const original = newRun(2026);
  for (const row of original.floor.g) for (const cell of row) delete cell.water;
  const json = JSON.stringify(serializeRun(original));

  const check = validateSave(json);
  assert.equal(check.ok, true);
  for (const row of check.value.floor.g) for (const cell of row) assert.equal("water" in cell, false, "validateSave must never inject a water key");

  const rehydrated = rehydrate(check.value);
  for (const row of rehydrated.floor.g) for (const cell of row) assert.equal("water" in cell, false, "rehydrate must never inject a water key");
});

test("sanitizeWaterCells: a tampered non-true water value ('yes', 1, false) is dropped", () => {
  for (const tampered of ["yes", 1, false, null]) {
    const validFloor = { g: [[{ wall: false, water: tampered }]], px: 0, py: 0, depth: 1 };
    const validChar = { wp: 10, maxWP: 10, level: 1, skills: {} };
    const check = validateSave(JSON.stringify({ c: validChar, floor: validFloor }));
    assert.equal(check.ok, true);
    assert.equal("water" in check.value.floor.g[0][0], false, `tampered water ${JSON.stringify(tampered)} must be dropped`);

    const rehydrated = rehydrate({ c: { ...validChar }, floor: { g: [[{ wall: false, water: tampered }]], px: 0, py: 0, depth: 1 }, seed: 1, rngState: 1 });
    assert.equal("water" in rehydrated.floor.g[0][0], false, "rehydrate mirrors validateSave's own tampered-value drop");
  }
});

test("sanitizeWaterCells: a genuine water: true cell survives both load chains", () => {
  const validFloor = { g: [[{ wall: false, water: true }, { wall: false }]], px: 0, py: 0, depth: 1 };
  const validChar = { wp: 10, maxWP: 10, level: 1, skills: {} };
  const check = validateSave(JSON.stringify({ c: validChar, floor: validFloor }));
  assert.equal(check.ok, true);
  assert.equal(check.value.floor.g[0][0].water, true);
  assert.equal("water" in check.value.floor.g[0][1], false);

  const rehydrated = rehydrate({ c: { ...validChar }, floor: validFloor, seed: 1, rngState: 1 });
  assert.equal(rehydrated.floor.g[0][0].water, true);
});
