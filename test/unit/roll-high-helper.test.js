// test/unit/roll-high-helper.test.js
//
// Phase 73-01 (ROLL-05) — the ONE roll-high check helper. rollCheck draws
// exactly one rng.d(dieN) and reads it mirrored: roll = dieN + 1 - r. This
// file proves the helper's contract and the mirror theorem: for every face
// count and every draw, the new roll-high comparison agrees with the old
// roll-under comparison on every die size the engine uses. No engine caller
// exists yet — that's 73-04 through 73-09.

import test from "node:test";
import assert from "node:assert/strict";

import { rollCheck, atLeastFor, rollFields, rollDice, isBestFace } from "../../engine/dice.js";

/** stubRng(r) — a tiny local rng stub whose d(sides) always returns r and
 * records every `sides` it was asked for, in call order, on `.draws`. */
function stubRng(r) {
  const draws = [];
  return {
    d(sides) {
      draws.push(sides);
      return r;
    },
    draws,
  };
}

const DIE_SIZES = [2, 4, 6, 8, 10, 12, 20];

test("rollCheck mirrors the draw: roll = dieN + 1 - r, for every r in 1..N and every N", () => {
  for (const dieN of DIE_SIZES) {
    for (let r = 1; r <= dieN; r++) {
      const rng = stubRng(r);
      const chk = rollCheck(rng, dieN, 1);
      assert.equal(chk.roll, dieN + 1 - r, `dieN=${dieN} r=${r}`);
    }
  }
});

test("rollCheck consumes exactly one draw, asking for exactly dieN sides", () => {
  for (const dieN of DIE_SIZES) {
    const rng = stubRng(1);
    rollCheck(rng, dieN, 1);
    assert.deepEqual(rng.draws, [dieN]);
  }
});

test("rollCheck.ok is true when roll === atLeast and false when roll === atLeast - 1", () => {
  const dieN = 20;
  // roll = 21 - r. Want roll === atLeast: pick atLeast = 15, roll = 15 -> r = 6.
  const atLeast = 15;
  const rTrue = dieN + 1 - atLeast; // r such that roll === atLeast
  const chkTrue = rollCheck(stubRng(rTrue), dieN, atLeast);
  assert.equal(chkTrue.roll, atLeast);
  assert.equal(chkTrue.ok, true);

  const rFalse = dieN + 1 - (atLeast - 1); // r such that roll === atLeast - 1
  const chkFalse = rollCheck(stubRng(rFalse), dieN, atLeast);
  assert.equal(chkFalse.roll, atLeast - 1);
  assert.equal(chkFalse.ok, false);
});

test("rollCheck returns { roll, atLeast, dieN, ok }", () => {
  const chk = rollCheck(stubRng(5), 20, 16);
  assert.deepEqual(Object.keys(chk).sort(), ["atLeast", "dieN", "ok", "roll"]);
  assert.equal(chk.atLeast, 16);
  assert.equal(chk.dieN, 20);
});

test("atLeastFor(faces, dieN) = dieN + 1 - faces, no clamping", () => {
  assert.equal(atLeastFor(5, 20), 16);
  assert.equal(atLeastFor(5, 6), 2);
  assert.equal(atLeastFor(1, 20), 20);
  assert.equal(atLeastFor(20, 20), 1);
  assert.equal(atLeastFor(0, 20), 21); // 0 faces never wins
  assert.equal(atLeastFor(25, 20), -4); // above dieN always wins (no clamp)
});

test("mirror theorem: (r <= faces) === rollCheck(stub r, N, atLeastFor(faces, N)).ok, for every N, every faces in -2..N+2, every r in 1..N", () => {
  for (const dieN of DIE_SIZES) {
    for (let faces = -2; faces <= dieN + 2; faces++) {
      const atLeast = atLeastFor(faces, dieN);
      for (let r = 1; r <= dieN; r++) {
        const oldWins = r <= faces;
        const chk = rollCheck(stubRng(r), dieN, atLeast);
        assert.equal(
          chk.ok,
          oldWins,
          `dieN=${dieN} faces=${faces} r=${r} atLeast=${atLeast} roll=${chk.roll}`
        );
      }
    }
  }
});

test("rollFields(chk) returns exactly { roll, atLeast, dieN }", () => {
  const chk = rollCheck(stubRng(3), 20, 16);
  const fields = rollFields(chk);
  assert.deepEqual(Object.keys(fields).sort(), ["atLeast", "dieN", "roll"]);
  assert.equal(fields.roll, chk.roll);
  assert.equal(fields.atLeast, chk.atLeast);
  assert.equal(fields.dieN, chk.dieN);
  assert.equal("ok" in fields, false);
});

// --- Untouched existing exports (rollDice, isBestFace) ---------------------

test("rollDice is unchanged: sums n rng.d(sides) draws plus a flat bonus", () => {
  const rng = stubRng(4);
  const total = rollDice(rng, { n: 3, sides: 6, bonus: 2 });
  assert.equal(total, 4 * 3 + 2);
  assert.deepEqual(rng.draws, [6, 6, 6]);
});

test("isBestFace is untouched by this plan: isBestFace(1, 20) is still true", () => {
  assert.equal(isBestFace(1, 20), true);
  assert.equal(isBestFace(20, 20), false);
});
