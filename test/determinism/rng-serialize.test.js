import test from "node:test";
import assert from "node:assert/strict";
import { makeRng } from "../../engine/rng.js";

test("RNG cursor serializes to a single integer and rehydrates to resume the exact sequence", () => {
  const rng = makeRng(31337);

  // Advance k calls before snapshotting.
  for (let i = 0; i < 17; i++) rng.next();

  const snapshot = rng.getState();
  assert.equal(typeof snapshot, "number");
  assert.ok(Number.isInteger(snapshot), "getState() must return a single integer");

  // Advance the original further and record the tail sequence it produces.
  const originalTail = [];
  for (let i = 0; i < 500; i++) originalTail.push(rng.next());

  // A fresh generator rehydrated from the snapshot must resume the identical tail.
  const rehydrated = makeRng(snapshot);
  const rehydratedTail = [];
  for (let i = 0; i < 500; i++) rehydratedTail.push(rehydrated.next());

  assert.deepStrictEqual(rehydratedTail, originalTail);
});

test("RNG state round-trips losslessly through JSON.stringify/JSON.parse", () => {
  const rng = makeRng(2468);
  for (let i = 0; i < 5; i++) rng.next();

  const state = rng.getState();
  const roundTripped = JSON.parse(JSON.stringify({ rngState: state })).rngState;
  assert.equal(roundTripped, state);

  const a = makeRng(state);
  const b = makeRng(roundTripped);
  for (let i = 0; i < 100; i++) {
    assert.equal(a.next(), b.next());
  }
});
