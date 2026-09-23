// RUN-05 coverage (03-03 Task 2): from a dead run, ONE adapter call
// (startNewRun()) must yield a brand-new, valid, dice-rolled run — the
// one-tap "new run" loop. 02-03 routes this through src/browser/storage.js's
// shared async abstraction (SAV-04) rather than a raw localStorage stand-in,
// so startNewRun() is async — see engineAdapter.js's own doc comments for
// why. Phase 65 (RUN-02/RUN-03, D-09, greenfield ruling): the single
// best-depth key (ddr.best.v1) is retired — startNewRun() no longer writes
// it at all; a stored value from before this phase stays on disk untouched.

import test from "node:test";
import assert from "node:assert/strict";

import { initRun, getState, startNewRun } from "../../src/browser/engineAdapter.js";

async function withFakeLocalStorage(fn) {
  const store = new Map();
  const previous = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  try {
    return await fn(globalThis.localStorage);
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
}

test("startNewRun() from a dead run yields a fresh, valid, dice-rolled run in a single call", async () => {
  await withFakeLocalStorage(async () => {
    const dying = initRun(1234);
    const dyingSeed = dying.seed;
    // Drive the run to a dead state on a deep floor, exactly as a real death
    // would leave it (state.dead + a deep floor.depth = the run's score).
    dying.floor.depth = 9;
    dying.dead = true;

    const fresh = await startNewRun();

    assert.equal(fresh.floor.depth, 1, "the new run starts on floor 1");
    assert.equal(fresh.c.level, 1, "the new run's character starts at level 1");
    assert.equal(fresh.dead, false, "the new run is alive");
    assert.notEqual(fresh.seed, dyingSeed, "startNewRun() without an explicit seed rolls a new one");
    assert.equal(getState(), fresh, "the adapter's current state is now the fresh run");
  });
});

test("startNewRun() never writes the retired best-depth key", async () => {
  await withFakeLocalStorage(async (store) => {
    store.setItem("ddr.best.v1", "7");
    const dying = initRun(1);
    dying.floor.depth = 12;
    dying.dead = true;

    await startNewRun();

    assert.equal(store.getItem("ddr.best.v1"), "7", "a pre-existing best-depth value is left untouched");
  });

  await withFakeLocalStorage(async (store) => {
    const dying = initRun(2);
    dying.floor.depth = 8;
    dying.dead = true;

    await startNewRun();

    assert.equal(store.getItem("ddr.best.v1"), null, "no best-depth key is ever written from a fresh store");
  });
});

test("startNewRun() with an explicit seed produces that exact deterministic run", async () => {
  await withFakeLocalStorage(async () => {
    const dying = initRun(1);
    dying.floor.depth = 5;
    dying.dead = true;

    const fresh = await startNewRun(99);
    assert.equal(fresh.seed, 99, "an explicit seed is honored");
    assert.equal(fresh.dead, false);
  });
});
