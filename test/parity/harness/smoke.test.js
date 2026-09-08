// test/parity/harness/smoke.test.js
//
// Proves the prototype-parity harness works end-to-end — sandbox boot,
// newGame(), one move(), and a wall-clock-safe JSON round-trip — with no
// dependency on any engine slice existing yet (per-slice parity tests land
// in plans 01-05 through 01-10 once engine/applyAction exists).

import test from "node:test";
import assert from "node:assert/strict";
import { loadPrototypeSandbox } from "./sandboxPrototype.js";
import { stripVolatileFields } from "./diffState.js";

test("sandboxed prototype boots, runs newGame + a move, and its state JSON-round-trips", () => {
  const ctx = loadPrototypeSandbox({ seed: 20260907 });

  // newGame() already ran during module load (mazeworld.html's boot section
  // calls it directly if there's no save to restore) — assert it produced a
  // coherent character and floor.
  assert.ok(ctx.S, "S should be populated after boot");
  assert.ok(ctx.S.c, "S.c (character) should be populated");
  assert.ok(ctx.S.floor, "S.floor should be populated");
  assert.equal(ctx.S.floor.depth, 1, "a fresh game starts on floor 1");
  assert.equal(typeof ctx.S.c.name, "string");
  assert.ok(ctx.S.c.name.length > 0, "character should have a generated name");

  // Run one legal move (the starting cell always has at least one open exit;
  // try all four directions and accept the first that doesn't throw and
  // actually changes position, which confirms move() executed the rules).
  const before = { px: ctx.S.floor.px, py: ctx.S.floor.py };
  let moved = false;
  for (const dir of ["N", "S", "E", "W"]) {
    ctx.move(dir);
    if (ctx.S.floor.px !== before.px || ctx.S.floor.py !== before.py) {
      moved = true;
      break;
    }
  }
  assert.ok(moved, "at least one of N/S/E/W should be a legal move from the start");

  // The state must be JSON-serializable once volatile (wall-clock) fields are
  // stripped — this is the same shape guarantee ENG-04's round-trip test will
  // rely on, proven here against the ORIGINAL prototype's state shape.
  const stripped = stripVolatileFields(ctx.S);
  const json = JSON.stringify(stripped);
  assert.equal(typeof json, "string");
  const rehydrated = JSON.parse(json);
  assert.deepStrictEqual(rehydrated, stripped, "stripped state must round-trip through JSON");
});

test("loadPrototypeSandbox({seed}) is deterministic: same seed -> same character and floor", () => {
  const ctxA = loadPrototypeSandbox({ seed: 555 });
  const ctxB = loadPrototypeSandbox({ seed: 555 });

  assert.deepStrictEqual(
    stripVolatileFields(ctxA.S.c),
    stripVolatileFields(ctxB.S.c),
    "same seed must produce the same rolled character",
  );
  assert.deepStrictEqual(
    stripVolatileFields(ctxA.S.floor),
    stripVolatileFields(ctxB.S.floor),
    "same seed must produce the same generated floor",
  );
});
