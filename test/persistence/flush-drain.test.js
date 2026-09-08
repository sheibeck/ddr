// test/persistence/flush-drain.test.js
//
// CR-02 (02-REVIEW.md): storage.js#flush() previously took a single
// point-in-time `Promise.all([...writeQueues.values()])` snapshot, which
// misses two real races:
//
//   1. A write still in its pre-setItem() async phase — concretely,
//      src/browser/engineAdapter.js#persistGrave()'s `await
//      storage.getItem(GRAVE_KEY)` BEFORE its `await
//      storage.setItem(GRAVE_KEY, ...)`. storage.js's writeQueues Map only
//      gets an entry once enqueue() actually runs (inside setItem()), so
//      flush() has no visibility into an operation still awaiting its read.
//   2. A same-key write chained onto writeQueues AFTER flush()'s snapshot is
//      taken but before the snapshotted promise settles.
//
// This file has no prior counterpart — flush() had no dedicated test file at
// all before this fix (02-REVIEW.md CR-02's own observation). Never imports
// `@capacitor/preferences` — the native branch is exercised purely through
// installFakeCapacitor()'s injected fake Preferences, same as every other
// file in test/persistence/.

import test from "node:test";
import assert from "node:assert/strict";

import * as storage from "../../src/browser/storage.js";
import { flush as flushStorage } from "../../src/browser/storage.js";
import { initRun, getState, dispatch, waitForPending } from "../../src/browser/engineAdapter.js";
import { flushOnBackground } from "../../src/browser/nativeChrome.js";
import { installFakeCapacitor } from "./harness/fakePreferences.js";

const SAVE_KEY = "mazeworld.delve.v1";
const GRAVE_KEY = "mazeworld.graveyard.v1";

/** waitUntil(predicate) — polls `predicate()` across microtask ticks rather
 * than hard-coding an exact tick count, so these tests aren't brittle
 * against small changes in how many `await`s a code path takes to reach the
 * point under test. */
async function waitUntil(predicate, maxTicks = 50) {
  for (let i = 0; i < maxTicks; i++) {
    if (predicate()) return;
    await Promise.resolve();
  }
  throw new Error("waitUntil: predicate never became true within " + maxTicks + " microtask ticks");
}

/**
 * makeControllablePreferences() — like
 * test/persistence/harness/fakePreferences.js's makeFakePreferences(), but
 * `get()`'s resolution is held open by the test until `_releaseGet()` is
 * called, and `set()`'s resolution is held open until `_releaseNextSet()` is
 * called — so a test can deterministically observe "this call has started
 * but not yet settled" rather than racing real microtask timing.
 */
function makeControllablePreferences() {
  const store = new Map();
  let getReached = false;
  let releaseGet = null;
  const getGate = new Promise((resolve) => {
    releaseGet = resolve;
  });
  const pendingSets = [];
  return {
    async get({ key }) {
      getReached = true;
      await getGate;
      return { value: store.has(key) ? store.get(key) : null };
    },
    async set({ key, value }) {
      await new Promise((resolve) => pendingSets.push({ key, value, resolve }));
      store.set(key, value);
    },
    async remove({ key }) {
      store.delete(key);
    },
    _store: store,
    _getReached: () => getReached,
    _releaseGet: () => releaseGet(),
    _pendingSetCount: () => pendingSets.length,
    _releaseNextSet: () => {
      const entry = pendingSets.shift();
      if (entry) entry.resolve();
      return entry;
    },
  };
}

/** firstOpenPlainDir(state) — first cardinal direction onto an open,
 * feature-free cell, mirroring test/unit/engineAdapter.test.js's own helper
 * (duplicated locally rather than imported since that file exports nothing
 * — every genFloor() maze guarantees at least one such neighbor). */
function firstOpenPlainDir(state) {
  const f = state.floor;
  const DIRV = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
  for (const [d, [dx, dy]] of Object.entries(DIRV)) {
    const nx = f.px + dx;
    const ny = f.py + dy;
    const cell = f.g[ny] && f.g[ny][nx];
    if (cell && !cell.wall && !cell.feat) return d;
  }
  return null;
}

test("CR-02: flush() drains a same-key write chained in DURING an in-flight flush, not just its point-in-time snapshot", async () => {
  const preferences = makeControllablePreferences();
  const restoreCap = installFakeCapacitor({ isNative: true, preferences });
  try {
    const firstWrite = storage.setItem(SAVE_KEY, "first");
    await waitUntil(() => preferences._pendingSetCount() >= 1);

    const flushPromise = flushStorage();

    // Case 2 from CR-02: a SECOND same-key write chained on AFTER flush()'s
    // first snapshot was taken but before that snapshot's promise settles.
    const secondWrite = storage.setItem(SAVE_KEY, "second");

    let flushResolved = false;
    flushPromise.then(() => {
      flushResolved = true;
    });

    // Release the first write's Preferences.set() call.
    preferences._releaseNextSet();
    await firstWrite;
    await Promise.resolve();
    await Promise.resolve();

    assert.equal(
      flushResolved,
      false,
      "flush() must not resolve while a same-key write chained in mid-flush is still pending its own Preferences.set()"
    );

    await waitUntil(() => preferences._pendingSetCount() >= 1);
    preferences._releaseNextSet();
    await secondWrite;
    await flushPromise;

    assert.equal(flushResolved, true, "flush() eventually resolves once the chained-in write also settles");
    assert.equal(preferences._store.get(SAVE_KEY), "second", "the second write actually landed (not clobbered/lost)");
  } finally {
    restoreCap();
  }
});

test("CR-02: flushOnBackground(storage, waitForPending) — what registerNativeChrome's pause/appStateChange handlers actually call — waits for a getItem->setItem write still in its pre-setItem() read phase", async () => {
  const preferences = makeControllablePreferences();
  const restoreCap = installFakeCapacitor({ isNative: true, preferences });
  try {
    initRun(55);
    const state = getState();
    const dir = firstOpenPlainDir(state);
    assert.ok(dir, "seed 55's floor 1 has at least one open, feature-free neighbor from the start tile");
    // Starve the character out so dispatch() below fires a "died" event and
    // (per dispatch()'s own CR-02 wiring) tracks persistGrave() via
    // engineAdapter.js's track()/waitForPending().
    state.c.rations = 0;
    state.c.wp = 1;
    state.steps = 99;

    const { events } = dispatch({ type: "move", dir });
    assert.ok(events.some((e) => e.type === "died"), "the move actually triggered a death this test can observe");

    // dispatch() also fires persist() (an ordinary SAVE_KEY write) in the
    // same synchronous tick — release ITS Preferences.set() call immediately
    // so it can't block the flush()/flushOnBackground() calls below. This
    // test isolates the GRAVE_KEY read-then-write race, not SAVE_KEY's
    // ordinary write.
    await waitUntil(() => preferences._pendingSetCount() >= 1);
    preferences._releaseNextSet();

    // persistGrave()'s FIRST storage call is storage.getItem(GRAVE_KEY) —
    // our controllable fake pauses there until _releaseGet() is called. Wait
    // for it to actually be reached (it's async — dispatch() itself is sync
    // and returns before persistGrave()'s internals run).
    await waitUntil(() => preferences._getReached());

    // The tombstone write has NOT reached setItem() yet, so storage.js's own
    // flush() (used alone) completes WITHOUT it — this is exactly the gap
    // CR-02 identifies flush() cannot close by itself.
    await flushStorage();
    assert.equal(
      preferences._store.has(GRAVE_KEY),
      false,
      "documents the CR-02 gap: storage.js's flush() alone completed before the still-mid-read tombstone write ever reached writeQueues"
    );

    // The REAL guarantee under test: flushOnBackground(storage, waitForPending)
    // — what registerNativeChrome's pause/appStateChange handlers actually
    // call — must NOT resolve until the tombstone write actually completes.
    let backgroundFlushResolved = false;
    const bgFlush = flushOnBackground(storage, waitForPending).then(() => {
      backgroundFlushResolved = true;
    });
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(
      backgroundFlushResolved,
      false,
      "flushOnBackground(storage, waitForPending) must not resolve while persistGrave() is still mid-read"
    );

    preferences._releaseGet();
    // Let persistGrave()'s subsequent setItem(GRAVE_KEY, ...) actually reach
    // Preferences.set() and release it too.
    await waitUntil(() => preferences._pendingSetCount() >= 1);
    preferences._releaseNextSet();
    await bgFlush;

    assert.equal(backgroundFlushResolved, true);
    const graves = JSON.parse(preferences._store.get(GRAVE_KEY));
    assert.equal(graves.length, 1, "the tombstone write actually completed before flushOnBackground resolved — not lost");
    assert.equal(graves[0].cause, "starve");
  } finally {
    restoreCap();
  }
});
