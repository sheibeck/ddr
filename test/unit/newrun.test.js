// RUN-01 coverage (03-03 Task 2): newRun(seed) must produce a 100%
// dice-rolled character with ZERO player-choice inputs — the caller
// supplies only a seed — revealed on a fresh floor 1. This proves the
// engine-level precondition the (Phase 4) character-sheet reveal UI will
// render from; the sheet itself is out of scope here.

import test from "node:test";
import assert from "node:assert/strict";

import { newRun } from "../../engine/engine.js";

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
  assert.equal(state.won, false);
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
