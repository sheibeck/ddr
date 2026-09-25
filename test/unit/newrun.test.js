// RUN-01 coverage (03-03 Task 2): newRun(seed) must produce a 100%
// dice-rolled character with ZERO player-choice inputs — the caller
// supplies only a seed — revealed on a fresh floor 1. This proves the
// engine-level precondition the (Phase 4) character-sheet reveal UI will
// render from; the sheet itself is out of scope here.

import test from "node:test";
import assert from "node:assert/strict";

import { newRun } from "../../engine/engine.js";
import { DEV_START_DEPTH_MAX } from "../../engine/state.js";
import { THRESHOLDS, CLASSES } from "../../content/index.js";
import { eff } from "../../engine/derived.js";

test("newRun(seed) takes only a seed — a single-argument, choice-free entry point", () => {
  // Arity proves the factory accepts no player-choice parameters beyond the
  // seed (rollCharacter/genFloor inside it are the ONLY dice rolled).
  assert.equal(newRun.length, 1, "newRun's declared arity is exactly one parameter (seed)");
});

test("newRun(seed) produces a valid dice-rolled character at level 1", () => {
  const state = newRun(12345);
  const c = state.c;
  assert.equal(typeof c.name, "string");
  assert.ok(c.name.length > 0, "character has a non-empty rolled name");
  assert.equal(c.level, 1, "a fresh character starts at level 1");
  assert.ok(["Magic User", "Fighter", "Thief"].includes(c.cls), "cls is drawn from the content class table");
  assert.equal(typeof c.sub, "string");
  assert.ok(c.sub.length > 0, "subclass is populated from the content table");
  assert.equal(typeof c.race, "string");
  assert.ok(c.race.length > 0, "race is populated from the content table");
});

test("newRun(seed) starts on a fresh floor 1", () => {
  const state = newRun(12345);
  assert.equal(state.floor.depth, 1, "a fresh run starts on floor 1");
  assert.equal(state.dead, false);
  assert.ok(!("won" in state), "the run carries no won flag");
});

test("newRun(seed) reveals the spawn cell and its neighbors", () => {
  const state = newRun(12345);
  const f = state.floor;
  const spawn = f.g[f.py][f.px];
  assert.equal(spawn.seen, true, "the spawn cell itself has been revealed");

  // At least one in-bounds neighbor of the spawn cell must also be revealed
  // — reveal() marks a radius around the player, not just the single cell.
  const neighbors = [
    [f.px, f.py - 1],
    [f.px, f.py + 1],
    [f.px - 1, f.py],
    [f.px + 1, f.py],
  ];
  const anyNeighborSeen = neighbors.some(([x, y]) => f.g[y] && f.g[y][x] && f.g[y][x].seen);
  assert.ok(anyNeighborSeen, "reveal() marked at least one neighboring cell as seen, not just the spawn tile");
});

test("newRun is seed-driven: two different seeds produce different characters", () => {
  const a = newRun(1).c;
  const b = newRun(2).c;
  const different =
    a.name !== b.name || a.cls !== b.cls || a.sub !== b.sub || a.race !== b.race;
  assert.ok(different, "two distinct seeds should not roll the identical character every field");
});

test("newRun is deterministic: the same seed reproduces the same character", () => {
  const a = newRun(777);
  const b = newRun(777);
  assert.deepStrictEqual(a.c, b.c, "the same seed rolls the identical character — 100% dice, zero randomness outside the seed");
});

// --- Phase 21 (TUNE-04, D-13/D-14): dev-only start-at-depth ---

test("D-14: newRun(seed) === newRun(seed, [], { startDepth: 1 }) deep-equal, dev false, arity still 1", () => {
  for (const seed of [1, 42, 303]) {
    const a = newRun(seed);
    const b = newRun(seed, [], { startDepth: 1 });
    assert.deepStrictEqual(a, b, `seed ${seed}: newRun(seed) must equal newRun(seed, [], { startDepth: 1 }), including rngState`);
    assert.equal(a.dev, false, "a default run is never flagged dev");
  }
  assert.equal(newRun.length, 1, "newRun's declared arity is still exactly one parameter (seed)");
});

test("D-13: startDepth 20 -> floor 20, level 5, sp 1501, dev true, purse +2000, rngState advanced (RULES-02, Phase 75: WILMST_CACHE_PER_DEPTH 300 -> 100)", () => {
  const base = newRun(42);
  const dev = newRun(42, [], { startDepth: 20 });
  assert.equal(dev.floor.depth, 20);
  assert.equal(dev.c.level, 5);
  assert.equal(dev.c.sp, THRESHOLDS[4]);
  assert.equal(dev.dev, true);
  assert.ok(dev.c.maxWP > base.c.maxWP, "the dev run leveled up, gaining maxWP");
  assert.ok(dev.c.gold >= base.c.gold + 2000, "the dev run's purse gained at least the flat 2000 wilmst-cache amount (100 * startDepth 20)");
  if (base.c.sub !== "Pickpocket") {
    const expectedGain = Math.round(2000 * (1 + 0.5 * eff(base.c, "greed")));
    assert.equal(dev.c.gold, base.c.gold + expectedGain, "non-Pickpocket dev purse is exactly the greed-scaled wilmst-cache grant");
  }
  assert.notEqual(dev.rngState, base.rngState, "the dev branch's extra draws advance rngState past the default run's cursor");
  assert.deepStrictEqual(JSON.parse(JSON.stringify(dev)), dev, "a dev state is still fully JSON-serializable");
});

test("D-13: chargen is untouched -- the dev run rolls the SAME adventurer", () => {
  for (const seed of [1, 42, 303]) {
    const base = newRun(seed).c;
    const dev = newRun(seed, [], { startDepth: 20 }).c;
    assert.equal(dev.name, base.name);
    assert.equal(dev.race, base.race);
    assert.equal(dev.temperament, base.temperament);
    assert.equal(dev.motive, base.motive);
    assert.equal(dev.phobia, base.phobia);
    assert.equal(dev.cls, base.cls);
    if (base.sub !== "Soldier" && base.sub !== "Apprentice") {
      assert.equal(dev.sub, base.sub, "a non-promoting subclass must be identical between the default and dev rolls");
    } else {
      assert.ok(CLASSES[base.cls].subs.includes(dev.sub), "a Soldier/Apprentice promotion still lands on a valid CLASSES sub for the rolled class");
    }
  }
});

test("D-13: startDepth 3 -> level 3 / sp 501 / floor 3; startDepth 50 -> level 5 / sp 1501 / floor 50 / purse +5000 (RULES-02, Phase 75: WILMST_CACHE_PER_DEPTH 300 -> 100)", () => {
  const base3 = newRun(9);
  const dev3 = newRun(9, [], { startDepth: 3 });
  assert.equal(dev3.floor.depth, 3);
  assert.equal(dev3.c.level, 3);
  assert.equal(dev3.c.sp, THRESHOLDS[2]);

  const base50 = newRun(9);
  const dev50 = newRun(9, [], { startDepth: 50 });
  assert.equal(dev50.floor.depth, 50);
  assert.equal(dev50.c.level, 5);
  assert.equal(dev50.c.sp, THRESHOLDS[4]);
  assert.ok(dev50.c.gold >= base50.c.gold + 5000, "startDepth 50's purse grants at least the flat 5000 wilmst-cache amount (100 * startDepth 50)");
});

test("sanitisation: 0, -3, NaN, 1.5, Infinity, 'abc', undefined all equal newRun(seed); 5000 clamps to DEV_START_DEPTH_MAX", () => {
  for (const v of [0, -3, NaN, 1.5, Infinity, "abc", undefined]) {
    assert.deepStrictEqual(newRun(7, [], { startDepth: v }), newRun(7), `startDepth ${v} must sanitize to a plain newRun(seed)`);
  }
  const clamped = newRun(7, [], { startDepth: 5000 });
  assert.equal(clamped.floor.depth, DEV_START_DEPTH_MAX);
  assert.equal(clamped.dev, true);
});

test("purity: a dev run reads no wall clock and is reproducible", () => {
  const a = newRun(9, [], { startDepth: 12 });
  const b = newRun(9, [], { startDepth: 12 });
  assert.deepStrictEqual(a, b);
});

// --- Phase 33 (STORE-01): storeRoll run flag ---

test("STORE-01: newRun(seed).storeRoll is false; newRun(seed, [], { storeRoll: true }) differs ONLY in that field", () => {
  for (const seed of [1, 42, 303]) {
    const a = newRun(seed);
    const b = newRun(seed, [], { storeRoll: true });
    assert.equal(a.storeRoll, false, `seed ${seed}: a default run is never flagged storeRoll`);
    assert.equal(b.storeRoll, true, `seed ${seed}: storeRoll: true is forwarded through`);
    assert.deepStrictEqual({ ...a, storeRoll: true }, b, `seed ${seed}: storeRoll: true must not consume any rng or change any other field (same rngState, c, floor)`);
  }
  assert.equal(newRun.length, 1, "newRun's declared arity is still exactly one parameter (seed)");
});
