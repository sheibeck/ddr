// test/unit/graveyard-adapter.test.js
//
// Phase 66 (BOARD-02, D-08/D-15): the adapter's graveyard read seam —
// loadGraveyard()/getGraveyard() and the synchronous in-memory fold at every
// non-dev death, mirroring bests-adapter.test.js's own patterns for the
// personal-bests record.
//
// The FIRST test below runs before any loadGraveyard()/boot() call this
// process — node --test runs each file in its own process, so module state
// (`graveyard`) is fresh here. Every later test explicitly calls
// loadGraveyard() (or boot()) at the top of its own withFakeLocalStorage()
// block, resetting module state for that test.

import test from "node:test";
import assert from "node:assert/strict";

import {
  boot,
  initRun,
  dispatch,
  startNewRun,
  loadGraveyard,
  getGraveyard,
  waitForPending,
} from "../../src/browser/engineAdapter.js";
import { flush as flushStorage } from "../../src/browser/storage.js";

const GRAVE_KEY = "ddr.graveyard.v1";
const GRAVE_TOTAL_KEY = "ddr.graveyard.total.v1";

/** withFakeLocalStorage(fn) — a fresh in-memory localStorage per call, copied
 * from bests-adapter.test.js's own helper (deliberately not imported — each
 * test file owns its harness). */
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

/** legacyStone(overrides) — a pre-Phase-65 buildRunSummary shape, copied from
 * bests-adapter.test.js's own helper shape. */
function legacyStone(overrides = {}) {
  return {
    name: "Legacy", race: "Human", sub: "Soldier", cls: "Fighter",
    level: 1, sp: 10, floor: 2, day: 1, steps: 50, gold: 5, kills: 0,
    cause: "combat", note: "died", epitaph: "Rest.", when: 1,
    ...overrides,
  };
}

// --- getGraveyard() before any load (FIRST test — fresh module state) ------

test("getGraveyard() is null before any load this session", () => {
  assert.equal(getGraveyard(), null);
});

// --- loadGraveyard(): both keys missing -------------------------------------

test("loadGraveyard(): both keys missing resolves { graves: [], total: 0 }, and getGraveyard() returns the same object", async () => {
  await withFakeLocalStorage(async () => {
    const result = await loadGraveyard();
    assert.deepStrictEqual(result, { graves: [], total: 0 });
    assert.deepStrictEqual(getGraveyard(), { graves: [], total: 0 });
  });
});

// --- total fallback rules ----------------------------------------------------

test("total: three stones and no total key falls back to the stone count (3)", async () => {
  await withFakeLocalStorage(async (store) => {
    store.setItem(GRAVE_KEY, JSON.stringify([legacyStone(), legacyStone(), legacyStone()]));
    const result = await loadGraveyard();
    assert.equal(result.total, 3);
  });
});

test("total: a stored total of 200 with 60 stones stays 200", async () => {
  await withFakeLocalStorage(async (store) => {
    const stones = Array.from({ length: 60 }, (_, i) => legacyStone({ name: `Stone${i}` }));
    store.setItem(GRAVE_KEY, JSON.stringify(stones));
    store.setItem(GRAVE_TOTAL_KEY, "200");
    const result = await loadGraveyard();
    assert.equal(result.total, 200);
  });
});

test("total: a stored total of 2 with 5 stones takes the larger of the two (5)", async () => {
  await withFakeLocalStorage(async (store) => {
    const stones = Array.from({ length: 5 }, (_, i) => legacyStone({ name: `Stone${i}` }));
    store.setItem(GRAVE_KEY, JSON.stringify(stones));
    store.setItem(GRAVE_TOTAL_KEY, "2");
    const result = await loadGraveyard();
    assert.equal(result.total, 5);
  });
});

test("total: 'abc', '-4', '2.5' and 'Infinity' each fall back to the stone count", async () => {
  for (const bad of ["abc", "-4", "2.5", "Infinity"]) {
    await withFakeLocalStorage(async (store) => {
      store.setItem(GRAVE_KEY, JSON.stringify([legacyStone(), legacyStone()]));
      store.setItem(GRAVE_TOTAL_KEY, bad);
      const result = await loadGraveyard();
      assert.equal(result.total, 2, `total key "${bad}" did not fall back to the stone count`);
    });
  }
});

// --- graves array shape --------------------------------------------------------

test("corrupt graves JSON, and a non-array graves value, both give []", async () => {
  await withFakeLocalStorage(async (store) => {
    store.setItem(GRAVE_KEY, "{not json");
    const result = await loadGraveyard();
    assert.deepStrictEqual(result.graves, []);
  });

  await withFakeLocalStorage(async (store) => {
    store.setItem(GRAVE_KEY, JSON.stringify({ not: "an array" }));
    const result = await loadGraveyard();
    assert.deepStrictEqual(result.graves, []);
  });
});

test("non-object entries (strings, numbers, null, arrays) are dropped from the graves array", async () => {
  await withFakeLocalStorage(async (store) => {
    store.setItem(GRAVE_KEY, JSON.stringify([legacyStone({ name: "Keep" }), "junk", 5, null, ["nope"]]));
    const result = await loadGraveyard();
    assert.equal(result.graves.length, 1);
    assert.equal(result.graves[0].name, "Keep");
  });
});

test("70 stored stones load as the newest 60", async () => {
  await withFakeLocalStorage(async (store) => {
    const stones = Array.from({ length: 70 }, (_, i) => legacyStone({ name: `Stone${i}` }));
    store.setItem(GRAVE_KEY, JSON.stringify(stones));
    const result = await loadGraveyard();
    assert.equal(result.graves.length, 60);
    assert.equal(result.graves[0].name, "Stone0", "the newest-first order is preserved (sliced from the front)");
    assert.equal(result.graves[59].name, "Stone59");
  });
});

// --- fail-safe read ------------------------------------------------------------

test("a storage read that throws resolves { graves: [], total: 0 } and never rejects", async () => {
  const previous = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: () => {
      throw new Error("storage blocked");
    },
    setItem: () => {
      throw new Error("storage blocked");
    },
    removeItem: () => {},
  };
  try {
    await assert.doesNotReject(() => loadGraveyard());
    const result = await loadGraveyard();
    assert.deepStrictEqual(result, { graves: [], total: 0 });
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
});

// --- boot() loads it -----------------------------------------------------------

test("boot() loads the graveyard so getGraveyard() is non-null once it resolves", async () => {
  await withFakeLocalStorage(async (store) => {
    store.setItem(GRAVE_KEY, JSON.stringify([legacyStone()]));
    await boot(1);
    assert.notEqual(getGraveyard(), null);
    assert.equal(getGraveyard().graves.length, 1);
  });
});

// --- the synchronous death fold ----------------------------------------------

test("a non-dev death folds into getGraveyard() synchronously, before any await", async () => {
  await withFakeLocalStorage(async () => {
    await loadGraveyard();
    await startNewRun(1);
    assert.equal(getGraveyard().graves.length, 0);
    assert.equal(getGraveyard().total, 0);

    dispatch({ type: "abandon" }); // deliberately not awaited

    assert.equal(getGraveyard().graves.length, 1, "the death folded into getGraveyard() synchronously");
    assert.equal(getGraveyard().total, 1, "total rose by exactly 1");
    assert.match(getGraveyard().graves[0].hash, /^[0-9a-f]{8}$/);
  });
});

test("a graveyard already holding 60 stones stays at 60 after another death while total keeps counting", async () => {
  await withFakeLocalStorage(async (store) => {
    const stones = Array.from({ length: 60 }, (_, i) => legacyStone({ name: `Stone${i}` }));
    store.setItem(GRAVE_KEY, JSON.stringify(stones));
    store.setItem(GRAVE_TOTAL_KEY, "60");
    await loadGraveyard();
    assert.equal(getGraveyard().graves.length, 60);

    await startNewRun(2);
    dispatch({ type: "abandon" });

    assert.equal(getGraveyard().graves.length, 60, "the graveyard stays capped at 60");
    assert.equal(getGraveyard().total, 61, "total keeps counting past the cap");
  });
});

test("a dev start-at-depth run's death leaves getGraveyard() unchanged", async () => {
  await withFakeLocalStorage(async () => {
    await loadGraveyard();
    const before = getGraveyard();

    await startNewRun(3, { startDepth: 20 });
    dispatch({ type: "abandon" });

    assert.deepStrictEqual(getGraveyard(), before, "a dev run's death never touches the graveyard");
  });
});

// --- initRun()/startNewRun() never reset it ---------------------------------

test("initRun()/startNewRun() never reset getGraveyard()", async () => {
  await withFakeLocalStorage(async () => {
    await loadGraveyard();
    await startNewRun(10);
    dispatch({ type: "abandon" });
    assert.equal(getGraveyard().graves.length, 1);

    initRun(11);
    assert.equal(getGraveyard().graves.length, 1, "initRun() does not clear the graveyard");

    await startNewRun(12);
    assert.equal(getGraveyard().graves.length, 1, "startNewRun() does not clear the graveyard");
  });
});

// --- persistence agreement ---------------------------------------------------

test("after waitForPending() and a storage flush, the stored newest stone and total agree with getGraveyard()", async () => {
  await withFakeLocalStorage(async (store) => {
    await loadGraveyard();
    await startNewRun(20);
    dispatch({ type: "abandon" });
    await waitForPending();
    await flushStorage();

    const storedGraves = JSON.parse(store.getItem(GRAVE_KEY));
    const storedTotal = Number(store.getItem(GRAVE_TOTAL_KEY));
    assert.deepStrictEqual(storedGraves[0], getGraveyard().graves[0]);
    assert.equal(storedTotal, getGraveyard().total);
  });
});
