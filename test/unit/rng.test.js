import test from "node:test";
import assert from "node:assert/strict";
import { mulberry32, makeRng } from "../../engine/rng.js";
import { rollDice } from "../../engine/dice.js";

test("mulberry32: two generators with the same seed agree on the first 1000 next() values", () => {
  const a = mulberry32(12345);
  const b = mulberry32(12345);
  for (let i = 0; i < 1000; i++) {
    assert.equal(a.next(), b.next(), `divergence at call ${i}`);
  }
});

test("mulberry32: next() returns a float in [0, 1)", () => {
  const rng = mulberry32(1);
  for (let i = 0; i < 200; i++) {
    const v = rng.next();
    assert.ok(v >= 0 && v < 1, `value ${v} out of range at call ${i}`);
  }
});

test("makeRng(seed): d(sides) matches the prototype's D(n) formula (1 + Math.floor(next()*n))", () => {
  // Two independently-driven generators seeded identically: one via the raw
  // mulberry32 next() reference formula, one via makeRng().d() — they must agree.
  const reference = mulberry32(999);
  const rng = makeRng(999);
  for (let i = 0; i < 100; i++) {
    const sides = 6;
    const expected = 1 + Math.floor(reference.next() * sides);
    const actual = rng.d(sides);
    assert.equal(actual, expected, `d(${sides}) mismatch at call ${i}`);
  }
});

test("makeRng(seed): pick(arr) matches the prototype's pick formula (arr[Math.floor(next()*arr.length)])", () => {
  const reference = mulberry32(42);
  const rng = makeRng(42);
  const arr = ["a", "b", "c", "d", "e"];
  for (let i = 0; i < 50; i++) {
    const expected = arr[Math.floor(reference.next() * arr.length)];
    const actual = rng.pick(arr);
    assert.equal(actual, expected, `pick mismatch at call ${i}`);
  }
});

test("makeRng(seed): shuffle(arr) matches the prototype's Fisher-Yates (j = Math.floor(next()*(i+1)))", () => {
  const reference = mulberry32(7);
  const rng = makeRng(7);

  const expected = [1, 2, 3, 4, 5, 6, 7, 8];
  for (let i = expected.length - 1; i > 0; i--) {
    const j = Math.floor(reference.next() * (i + 1));
    [expected[i], expected[j]] = [expected[j], expected[i]];
  }

  const actual = [1, 2, 3, 4, 5, 6, 7, 8];
  rng.shuffle(actual);

  assert.deepStrictEqual(actual, expected);
});

test("makeRng(seed): getState() returns a Number and setState() restores an exact state", () => {
  const rng = makeRng(2026);
  rng.next();
  rng.next();
  const state = rng.getState();
  assert.equal(typeof state, "number");

  const restored = makeRng(state);
  assert.equal(restored.next(), rng.next());
});

test("rollDice: sums n independent rng.d(sides) plus bonus", () => {
  const reference = makeRng(555);
  const rng = makeRng(555);

  const n = 2, sides = 6, bonus = 1;
  let expected = bonus;
  for (let i = 0; i < n; i++) expected += reference.d(sides);

  const actual = rollDice(rng, { n, sides, bonus });
  assert.equal(actual, expected);
});

test("rollDice: {n:1,sides:6,bonus:0} equals rng.d(6) on an identically-seeded generator", () => {
  const reference = makeRng(9001);
  const rng = makeRng(9001);

  const expected = reference.d(6);
  const actual = rollDice(rng, { n: 1, sides: 6, bonus: 0 });
  assert.equal(actual, expected);
});
