// test/unit/adapter-run-listener.test.js
//
// Phase 68 (PGS-03/PGS-04, D-01/D-02): engineAdapter.js#setRunRecordedListener
// — the one hook at dispatch()'s death choke point that hands every non-dev
// death's run summary (a frozen copy) to the submission queue 68-07 wires.
// A dev start-at-depth death never reaches it, and nothing the listener does
// (throwing, mutating what it received) can change the dead state, the
// tombstone write or the bests record.
//
// The FIRST test runs before any loadBests()/boot() call in this process
// (node --test gives each file its own process), so it exercises the lazy
// path where `bests` is still null.

import test from "node:test";
import assert from "node:assert/strict";

import {
  initRun,
  dispatch,
  startNewRun,
  loadBests,
  getBests,
  loadGraveyard,
  getGraveyard,
  takeDeathRecord,
  waitForPending,
  setRunRecordedListener,
} from "../../src/browser/engineAdapter.js";
import { flush as flushStorage } from "../../src/browser/storage.js";

const GRAVE_KEY = "ddr.graveyard.v1";
const BESTS_KEY = "ddr.bests.v1";

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
    setRunRecordedListener(null);
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
}

function recorder() {
  const calls = [];
  const fn = (summary) => {
    calls.push(summary);
  };
  return { fn, calls };
}

// --- lazy path (FIRST test — fresh module state, bests never loaded) --------

test("the listener fires on a death before the bests record was ever loaded (the lazy path)", async () => {
  await withFakeLocalStorage(async () => {
    const r = recorder();
    setRunRecordedListener(r.fn);
    initRun(4242);
    dispatch({ type: "abandon" });
    assert.equal(r.calls.length, 1, "called exactly once");
    assert.match(r.calls[0].hash, /^[0-9a-f]{8}$/);
    assert.equal(r.calls[0].season, 1);
    assert.ok(Object.isFrozen(r.calls[0]), "the listener receives a frozen object");
    await waitForPending();
    await flushStorage();
  });
});

// --- the normal path --------------------------------------------------------

test("a non-dev death calls the listener exactly once with a frozen copy equal to the death record's summary", async () => {
  await withFakeLocalStorage(async () => {
    await loadBests();
    await startNewRun(555);
    const r = recorder();
    setRunRecordedListener(r.fn);
    dispatch({ type: "abandon" });

    assert.equal(r.calls.length, 1);
    const report = takeDeathRecord();
    assert.ok(report && report.summary);
    const got = r.calls[0];
    assert.ok(Object.isFrozen(got));
    assert.notEqual(got, report.summary, "a copy, not the adapter's own object");
    assert.equal(got.hash, report.summary.hash);
    assert.deepStrictEqual({ ...got }, { ...report.summary });
    await waitForPending();
  });
});

test("a later action after the death does not call the listener again", async () => {
  await withFakeLocalStorage(async () => {
    await loadBests();
    await startNewRun(556);
    const r = recorder();
    setRunRecordedListener(r.fn);
    dispatch({ type: "abandon" });
    dispatch({ type: "camp" });
    dispatch({ type: "bogus" });
    assert.equal(r.calls.length, 1);
    await waitForPending();
  });
});

test("a dev start-at-depth death never calls the listener", async () => {
  await withFakeLocalStorage(async () => {
    await loadBests();
    const r = recorder();
    setRunRecordedListener(r.fn);
    await startNewRun(50, { startDepth: 20 });
    dispatch({ type: "abandon" });
    assert.equal(r.calls.length, 0);
    await waitForPending();
  });
});

test("a throwing listener changes nothing: the dead state, the died event, the tombstone and the bests record all land", async () => {
  await withFakeLocalStorage(async (store) => {
    await loadBests();
    await loadGraveyard();
    await startNewRun(9001);
    let calls = 0;
    setRunRecordedListener(() => {
      calls += 1;
      throw new Error("listener exploded");
    });
    let result;
    assert.doesNotThrow(() => {
      result = dispatch({ type: "abandon" });
    });
    assert.equal(calls, 1);
    assert.equal(result.state.dead, true, "did not fall closed to a fresh run");
    assert.ok(result.events.some((e) => e.type === "died"), "the died event is present");

    const report = takeDeathRecord();
    assert.ok(report, "the death report still exists");
    assert.ok(getBests().runs[report.summary.hash], "the bests record folded the death");
    assert.equal(getGraveyard().graves[0].hash, report.summary.hash, "the in-memory graveyard has the stone");

    await waitForPending();
    await flushStorage();
    const graves = JSON.parse(store.getItem(GRAVE_KEY));
    const stored = JSON.parse(store.getItem(BESTS_KEY));
    assert.equal(graves[0].hash, report.summary.hash, "the tombstone write landed");
    assert.deepStrictEqual(graves[0], stored.runs[report.summary.hash], "the stored bests record agrees with the tombstone");
  });
});

test("a listener that rejects asynchronously produces no unhandled failure and no state change", async () => {
  await withFakeLocalStorage(async () => {
    await loadBests();
    await startNewRun(9002);
    setRunRecordedListener(async () => {
      throw new Error("async failure");
    });
    const result = dispatch({ type: "abandon" });
    assert.equal(result.state.dead, true);
    await waitForPending();
    await new Promise((resolve) => setImmediate(resolve));
  });
});

test("setRunRecordedListener(null) or a non-function stops further calls", async () => {
  await withFakeLocalStorage(async () => {
    await loadBests();
    const r = recorder();

    setRunRecordedListener(r.fn);
    await startNewRun(701);
    dispatch({ type: "abandon" });
    assert.equal(r.calls.length, 1);

    setRunRecordedListener(null);
    await startNewRun(702);
    dispatch({ type: "abandon" });
    assert.equal(r.calls.length, 1, "null unregisters");

    setRunRecordedListener(r.fn);
    setRunRecordedListener("not a function");
    await startNewRun(703);
    dispatch({ type: "abandon" });
    assert.equal(r.calls.length, 1, "a non-function unregisters too");
    await waitForPending();
  });
});

test("a second registration replaces the first", async () => {
  await withFakeLocalStorage(async () => {
    await loadBests();
    const first = recorder();
    const second = recorder();
    setRunRecordedListener(first.fn);
    setRunRecordedListener(second.fn);
    await startNewRun(801);
    dispatch({ type: "abandon" });
    assert.equal(first.calls.length, 0);
    assert.equal(second.calls.length, 1);
    await waitForPending();
  });
});

test("mutating the received object cannot change getGraveyard() or getBests()", async () => {
  await withFakeLocalStorage(async () => {
    await loadBests();
    await loadGraveyard();
    await startNewRun(901);
    let got = null;
    setRunRecordedListener((s) => {
      got = s;
      try {
        s.floor = 999;
        s.name = "Tampered";
      } catch {
        // strict-mode assignment to a frozen object throws; fine
      }
    });
    dispatch({ type: "abandon" });
    assert.ok(got);
    const grave = getGraveyard().graves[0];
    const run = getBests().runs[grave.hash];
    assert.notEqual(grave.floor, 999);
    assert.notEqual(grave.name, "Tampered");
    assert.notEqual(run.floor, 999);
    assert.notEqual(run.name, "Tampered");
    assert.equal(got.floor, grave.floor, "the frozen copy kept its own value");
    await waitForPending();
  });
});
