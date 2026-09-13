// test/unit/carry-model.test.js
//
// ECON-01 / ECON-02 (Phase 12 — Carry Model + Migration, Economy A). The
// carry-capacity DATA MODEL: the BAGS content table, the class-derived `c.bag`
// chargen field (a PLAIN assignment that adds NO rng draw), the new top-level
// `state.pendingFind` stash, the gated clampCarry(c) helper, and the additive
// save migration that defaults a missing bag by class. No behavior change yet —
// clampCarry is only exercised here and at chargen (a no-op there); Phase 13
// wires it into the real find/keep/drop handlers.

import test from "node:test";
import assert from "node:assert/strict";

import { newRun } from "../../engine/state.js";
import { rollCharacter } from "../../engine/character.js";
import { clampCarry } from "../../engine/derived.js";
import { serializeRun, validateSave, rehydrate } from "../../engine/saveState.js";
import { makeRng } from "../../engine/rng.js";
import { BAGS } from "../../content/bags.js";

const bagForClass = (cls) => (cls === "Fighter" ? "medium" : "small");

test("BAGS table carries the four tiers with the documented caps", () => {
  assert.deepStrictEqual(BAGS.small, { slots: 4, wilmst: 2000, rations: 10 });
  assert.deepStrictEqual(BAGS.medium, { slots: 6, wilmst: 5000, rations: 20 });
  assert.deepStrictEqual(BAGS.large, { slots: 8, wilmst: 8000, rations: 40 });
  assert.deepStrictEqual(BAGS.exlarge, { slots: 10, wilmst: 10000, rations: 60 });
});

test("chargen assigns c.bag by class (MU/Thief small, Fighter medium)", () => {
  const seen = new Set();
  // A wide seed sweep exercises all three classes; every character's bag must
  // match the class mapping regardless of race/subclass.
  for (let seed = 1; seed <= 120; seed++) {
    const c = newRun(seed).c;
    seen.add(c.cls);
    assert.equal(
      c.bag,
      bagForClass(c.cls),
      `seed ${seed}: ${c.cls} should carry the ${bagForClass(c.cls)} bag, got ${c.bag}`,
    );
    if (c.cls === "Magic User") assert.equal(c.bag, "small");
    if (c.cls === "Thief") assert.equal(c.bag, "small");
    if (c.cls === "Fighter") assert.equal(c.bag, "medium");
  }
  assert.deepStrictEqual([...seen].sort(), ["Fighter", "Magic User", "Thief"]);
});

test("c.bag is a PLAIN assignment — it adds no rng draw (chargen stays deterministic)", () => {
  // rollCharacter is the sole chargen rng consumer. If `bag` were derived from
  // an rng draw, the post-chargen cursor would depend on it. Rolling the SAME
  // seed twice must land a byte-identical character AND the identical final rng
  // cursor — proving the bag assignment consumed nothing from the stream.
  const rngA = makeRng(4242);
  const a = rollCharacter(rngA);
  const cursorA = rngA.getState();

  const rngB = makeRng(4242);
  const b = rollCharacter(rngB);
  const cursorB = rngB.getState();

  assert.equal(a.bag, bagForClass(a.cls));
  assert.deepStrictEqual(a, b, "same seed must roll a byte-identical character (bag included)");
  assert.equal(cursorA, cursorB, "same seed must leave the rng cursor at the identical position");

  // And the whole run is deterministic seed→state (bag never perturbs it).
  const runA = newRun(4242);
  const runB = newRun(4242);
  assert.deepStrictEqual(runA.c, runB.c);
  assert.equal(runA.rngState, runB.rngState);
});

test("newRun seeds a null top-level pendingFind (sibling of combat/store)", () => {
  const state = newRun(7);
  assert.equal(state.pendingFind, null);
  assert.ok("pendingFind" in state, "pendingFind must be a real top-level field");
});

test("serialization round-trip preserves c.bag and pendingFind (nulled on rehydrate)", () => {
  const original = newRun(99);
  assert.equal(original.c.bag, bagForClass(original.c.cls));

  const check = validateSave(JSON.stringify(serializeRun(original)));
  assert.equal(check.ok, true);
  const state = rehydrate(check.value);

  assert.equal(state.c.bag, original.c.bag, "a saved bag survives the round-trip verbatim");
  assert.equal(state.pendingFind, null, "pendingFind is reset to null on rehydrate");
});

test("a non-null pendingFind is nulled on rehydrate (transient, like combat)", () => {
  const state = newRun(3);
  state.pendingFind = { kind: "cloak", n: "Cloak of Testing" };
  const check = validateSave(JSON.stringify(serializeRun(state)));
  assert.equal(check.ok, true);
  const rehydrated = rehydrate(check.value);
  assert.equal(rehydrated.pendingFind, null);
});

test("an old save missing c.bag migrates to the class-derived default", () => {
  const oldFighter = {
    c: { name: "Vintage Fighter", cls: "Fighter", wp: 12, maxWP: 20, level: 3, skills: {} },
    floor: { depth: 1, g: [[{ wall: false }]], px: 0, py: 0 },
    day: 1,
    steps: 0,
    dead: false,
    won: false,
    deathNote: "",
    epitaph: "",
  };
  const check = validateSave(JSON.stringify(oldFighter), { freshSeed: 1 });
  assert.equal(check.ok, true);
  assert.equal(check.value.c.bag, "medium", "validateSave defaults a Fighter's missing bag to medium");
  const state = rehydrate(check.value);
  assert.equal(state.c.bag, "medium", "rehydrate defaults a Fighter's missing bag to medium");
});

test("an old save with an unknown class defaults to the small bag", () => {
  const oddSave = {
    c: { name: "Mystery", cls: "Bard", wp: 8, maxWP: 8, level: 1, skills: {} },
    floor: { depth: 1, g: [[{ wall: false }]], px: 0, py: 0 },
    day: 1,
    steps: 0,
    dead: false,
    won: false,
    deathNote: "",
    epitaph: "",
  };
  const check = validateSave(JSON.stringify(oddSave));
  assert.equal(check.ok, true);
  assert.equal(check.value.c.bag, "small", "an unknown class falls back to the small bag");
});

test("clampCarry is a complete no-op when the character has no bag", () => {
  const c = { gold: 999999, rations: 999, items: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] };
  const before = JSON.parse(JSON.stringify(c));
  clampCarry(c);
  assert.deepStrictEqual(c, before, "no bag => nothing is clamped");
});

test("clampCarry clamps items/gold/rations down to the bag's caps", () => {
  const c = {
    bag: "small", // slots 4, wilmst 2000, rations 10
    gold: 5000,
    rations: 50,
    items: [{ n: "a" }, { n: "b" }, { n: "c" }, { n: "d" }, { n: "e" }, { n: "f" }],
  };
  clampCarry(c);
  assert.equal(c.gold, 2000, "gold clamps to the wilmst cap");
  assert.equal(c.rations, 10, "rations clamp to the rations cap");
  assert.equal(c.items.length, 4, "items drop overflow down to the slot count");
  // overflow is dropped off the END — the first `slots` items are kept
  assert.deepStrictEqual(c.items.map((i) => i.n), ["a", "b", "c", "d"]);
});

test("clampCarry never PADS an under-cap character or bumps an under-cap value", () => {
  const c = { bag: "large", gold: 10, rations: 2, items: [{ n: "solo" }] }; // large: slots 8
  clampCarry(c);
  assert.equal(c.items.length, 1, "an under-cap item list is never padded to the slot count");
  assert.equal(c.gold, 10, "an under-cap gold value is untouched");
  assert.equal(c.rations, 2, "an under-cap rations value is untouched");
});
