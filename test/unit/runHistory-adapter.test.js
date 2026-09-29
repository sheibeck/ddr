// test/unit/runHistory-adapter.test.js
//
// Phase 84 (BOARD-26): src/browser/engineAdapter.js's wiring of the per-run
// history (src/browser/runHistory.js) — boot()'s once-only 2.1.0-cutoff
// import, loadRunHistory()/getRunHistory()/setAppVersion(), the
// synchronous in-memory fold at the died-event choke point (recordDeath,
// mirroring the bests fold), persistGrave()'s lazy path and merge-on-write
// (the stored history can only ever grow), and the dev-run exclusion.
//
// The FIRST TWO tests below run before any loadRunHistory()/boot() call
// this process — node --test gives each file its own process, so module
// state (`runHistory`, `bests`, `currentState`) is fresh here. Every test
// after them explicitly loads the history (via boot() or loadRunHistory())
// at the top of its own withFakeLocalStorage() block.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import {
  boot,
  initRun,
  getState,
  dispatch,
  startNewRun,
  loadRunHistory,
  getRunHistory,
  setAppVersion,
  takeDeathRecord,
  waitForPending,
} from "../../src/browser/engineAdapter.js";
import { flush as flushStorage } from "../../src/browser/storage.js";
import { runHash, emptyBests, updateBests } from "../../engine/records.js";
import { SEASON } from "../../content/season.js";
import { BACKFILL_SINCE_MS } from "../../src/browser/runBackfill.js";
import { RUN_HISTORY_KEY, IMPORT_VERSION, historyRecordOf, sanitizeHistory, serializeHistory } from "../../src/browser/runHistory.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const GRAVE_KEY = "ddr.graveyard.v1";
const GRAVE_TOTAL_KEY = "ddr.graveyard.total.v1";
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
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
}

/** summary(overrides) — a RunSummary-shaped fixture, hashed via
 * engine/records.js#runHash unless the caller supplies its own `hash`. */
function summary(overrides = {}) {
  const s = {
    name: "Test Hero", race: "Human", sub: "Knight", cls: "Fighter",
    level: 1, sp: 40, floor: 5, day: 3, steps: 500, gold: 100, kills: 10,
    cause: "combat", note: "died", epitaph: "", when: BACKFILL_SINCE_MS,
    season: SEASON, seed: 12345, acts: 10,
    ...overrides,
  };
  if (!("hash" in overrides)) s.hash = runHash(s);
  return s;
}

function foldBests(summaries) {
  let rec = emptyBests();
  for (const s of summaries) rec = updateBests(rec, s).record;
  return rec;
}

// --- before any load (FIRST TWO tests — fresh module state) ---------------

test("getRunHistory(): before any load this session, returns an empty frozen array", () => {
  const runs = getRunHistory();
  assert.deepStrictEqual(runs, []);
  assert.ok(Object.isFrozen(runs));
});

test("a death before loadRunHistory()/boot() is ever called this session: takeDeathRecord() returns null, but persistGrave()'s lazy path still appends the run", async () => {
  await withFakeLocalStorage(async (store) => {
    initRun(77);
    dispatch({ type: "abandon" });

    assert.equal(
      takeDeathRecord(),
      null,
      "the lazy path defers folding until persistGrave() runs; nothing is available synchronously this time"
    );

    await waitForPending();
    await flushStorage();

    const stored = JSON.parse(store.getItem(RUN_HISTORY_KEY));
    assert.equal(stored.imported, true, "the lazy path's own loadRunHistory() ran the once-only import too");
    assert.equal(stored.runs.length, 1, "persistGrave's lazy path appended this death");
  });
});

// --- boot: once-only 2.1.0-cutoff import -----------------------------------

test("first launch: imports only 2.1.0-era graveyard+bests runs, stamps IMPORT_VERSION, writes ddr.runs.v1 imported:true, and leaves the old stores byte-identical", async () => {
  await withFakeLocalStorage(async (store) => {
    const atCutoff = summary({ when: BACKFILL_SINCE_MS, steps: 900, name: "AtCutoff" });
    const before = summary({ when: BACKFILL_SINCE_MS - 1, steps: 901, name: "Before" });
    // Both runs are already folded into ddr.bests.v1 so boot()'s own Phase
    // 81 (BOARD-15) reconciliation against the graveyard (a DIFFERENT,
    // pre-existing boot-time behavior) finds nothing new to fold in and
    // never rewrites ddr.bests.v1 — keeping this test's byte-identical
    // assertion below about the 2.1.0-cutoff import specifically, not
    // about reconciliation.
    const bests = foldBests([atCutoff, before]);
    store.setItem(BESTS_KEY, JSON.stringify(bests));
    store.setItem(GRAVE_KEY, JSON.stringify([before]));
    store.setItem(GRAVE_TOTAL_KEY, "1");
    const gravesBefore = store.getItem(GRAVE_KEY);
    const bestsBefore = store.getItem(BESTS_KEY);
    const totalBefore = store.getItem(GRAVE_TOTAL_KEY);

    await boot(1);

    const runs = getRunHistory();
    assert.equal(runs.length, 1, "only the at-cutoff run is imported — the pre-cutoff stone is dropped");
    assert.equal(runs[0].hash, atCutoff.hash);
    assert.equal(runs[0].version, IMPORT_VERSION);
    assert.equal(IMPORT_VERSION, "2.1.0 (11)");

    await waitForPending();
    await flushStorage();

    const stored = JSON.parse(store.getItem(RUN_HISTORY_KEY));
    assert.equal(stored.imported, true);
    assert.equal(stored.runs.length, 1);

    assert.equal(store.getItem(GRAVE_KEY), gravesBefore, "ddr.graveyard.v1 is byte-identical to before the import");
    assert.equal(store.getItem(BESTS_KEY), bestsBefore, "ddr.bests.v1 is byte-identical to before the import");
    assert.equal(store.getItem(GRAVE_TOTAL_KEY), totalBefore, "ddr.graveyard.total.v1 is byte-identical to before the import");
  });
});

test("second boot does not import again — a stone added to the old graveyard after the first import never appears", async () => {
  await withFakeLocalStorage(async (store) => {
    const atCutoff = summary({ when: BACKFILL_SINCE_MS, steps: 950 });
    store.setItem(GRAVE_KEY, JSON.stringify([atCutoff]));

    await boot(1);
    await waitForPending();
    await flushStorage();
    assert.equal(getRunHistory().length, 1);

    const later = summary({ when: BACKFILL_SINCE_MS + 5000, steps: 951 });
    store.setItem(GRAVE_KEY, JSON.stringify([later, atCutoff]));

    await boot(2);
    assert.equal(getRunHistory().length, 1, "the stone added after the first import never appears");
    assert.equal(getRunHistory()[0].hash, atCutoff.hash);
  });
});

test("corrupt JSON in ddr.runs.v1 boots without throwing, imports the 2.1.0-era runs, and keeps going", async () => {
  await withFakeLocalStorage(async (store) => {
    store.setItem(RUN_HISTORY_KEY, "{not json");
    const atCutoff = summary({ when: BACKFILL_SINCE_MS, steps: 700 });
    store.setItem(GRAVE_KEY, JSON.stringify([atCutoff]));

    await assert.doesNotReject(() => boot(1));
    assert.equal(getRunHistory().length, 1);
    assert.equal(getRunHistory()[0].hash, atCutoff.hash);
  });
});

test("source: boot() calls loadRunHistory() after loadGraveyard()", () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "engineAdapter.js"), "utf8");
  const bootBody = src.slice(src.indexOf("export async function boot("));
  const gIdx = bootBody.indexOf("loadGraveyard()");
  const hIdx = bootBody.indexOf("loadRunHistory()");
  assert.ok(gIdx > -1 && hIdx > -1 && hIdx > gIdx, "loadRunHistory() is called after loadGraveyard() inside boot()");
});

// --- a non-dev death appends a record ---------------------------------------

test("a non-dev death appends one record with the version from setAppVersion and when=deathAt; getRunHistory() reflects it synchronously", async () => {
  await withFakeLocalStorage(async (store) => {
    await boot(1);
    setAppVersion("2.2.0 (12)");
    await startNewRun(555);
    dispatch({ type: "abandon" }); // deliberately not awaited

    const runs = getRunHistory();
    assert.equal(runs.length, 1);
    assert.equal(runs[0].version, "2.2.0 (12)");
    assert.equal(runs[0].when, getState().deathAt);

    await waitForPending();
    await flushStorage();
    const stored = JSON.parse(store.getItem(RUN_HISTORY_KEY));
    assert.equal(stored.runs.length, 1);
    assert.equal(stored.runs[0].version, "2.2.0 (12)");
  });
});

test("setAppVersion: default 'dev'; a non-string, empty, or over-64-char value falls back to 'dev'", async () => {
  await withFakeLocalStorage(async (store) => {
    await boot(1);

    setAppVersion("dev"); // explicit, for isolation from any earlier test's stamp
    await startNewRun(1);
    dispatch({ type: "abandon" });
    assert.equal(getRunHistory()[0].version, "dev");

    setAppVersion(123);
    await startNewRun(2);
    dispatch({ type: "abandon" });
    assert.equal(getRunHistory()[0].version, "dev", "a non-string falls back to dev");

    setAppVersion("");
    await startNewRun(3);
    dispatch({ type: "abandon" });
    assert.equal(getRunHistory()[0].version, "dev", "an empty string falls back to dev");

    setAppVersion("x".repeat(65));
    await startNewRun(4);
    dispatch({ type: "abandon" });
    assert.equal(getRunHistory()[0].version, "dev", "over 64 chars falls back to dev");

    setAppVersion("x".repeat(64));
    await startNewRun(5);
    dispatch({ type: "abandon" });
    assert.equal(getRunHistory()[0].version, "x".repeat(64), "exactly 64 chars is accepted");

    await waitForPending();
    await flushStorage();
  });
});

// --- dev runs never enter the history ---------------------------------------

test("a dev start-at-depth death leaves the history (memory and storage) unchanged", async () => {
  await withFakeLocalStorage(async (store) => {
    await boot(1);
    await waitForPending();
    await flushStorage();
    const before = getRunHistory();
    const storedBefore = store.getItem(RUN_HISTORY_KEY);

    await startNewRun(50, { startDepth: 20 });
    dispatch({ type: "abandon" });

    assert.deepStrictEqual(getRunHistory(), before, "the in-memory history is unchanged");

    await waitForPending();
    await flushStorage();
    assert.equal(store.getItem(RUN_HISTORY_KEY), storedBefore, "the stored history is byte-identical to before the dev death");
  });
});

// --- the death report (takeDeathRecord, history-based) ----------------------

test("takeDeathRecord(): first death (empty history) reports first:true; a deeper death then reports newBests including deep; a shallower death after that reports first:false, newBests:[]", async () => {
  await withFakeLocalStorage(async () => {
    await boot(1);

    await startNewRun(1);
    getState().floor.depth = 3;
    dispatch({ type: "abandon" });
    const first = takeDeathRecord();
    assert.equal(first.first, true);
    assert.deepStrictEqual(first.newBests, []);

    await startNewRun(2);
    getState().floor.depth = 9;
    dispatch({ type: "abandon" });
    const deeper = takeDeathRecord();
    assert.equal(deeper.first, false);
    assert.ok(deeper.newBests.includes("deep"), "a deeper floor beats DEEPEST");

    await startNewRun(3);
    getState().floor.depth = 1;
    dispatch({ type: "abandon" });
    const shallower = takeDeathRecord();
    assert.equal(shallower.first, false);
    assert.deepStrictEqual(shallower.newBests, []);

    await waitForPending();
  });
});

// --- merge-on-write: the stored history can only ever grow ------------------

test("merge-on-write: a boot whose history read throws (blocked storage) leaves the in-memory history empty with no import write; a death right after (once storage recovers) still lands, and the write settles to every previously-stored run plus the new death", async () => {
  const A = historyRecordOf(summary({ when: 1000, steps: 10, name: "A" }), "dev");
  const B = historyRecordOf(summary({ when: 2000, steps: 20, name: "B" }), "dev");
  const seeded = sanitizeHistory({ imported: true, runs: [A, B] });

  // storage.js's own fail-safe contract means engineAdapter.js's calls
  // still resolve (never reject) even when the underlying storage backend
  // throws on every read/write — the once-only import collects nothing
  // (BESTS_KEY/GRAVE_KEY are equally unreadable) and its own "mark done"
  // write never actually lands anywhere real. Mirrors the "blocked
  // storage" pattern in test/unit/bests-adapter.test.js.
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
    await boot(1);
  } finally {
    globalThis.localStorage = previous;
  }
  assert.deepStrictEqual(getRunHistory(), [], "the blocked boot left the in-memory history empty");

  // Storage recovers — a real store, already holding A and B from a
  // previous session (the blocked boot above never actually reached it).
  await withFakeLocalStorage(async (store) => {
    store.setItem(RUN_HISTORY_KEY, serializeHistory(seeded));

    await startNewRun(9);
    dispatch({ type: "abandon" });

    await waitForPending();
    await flushStorage();

    const stored = JSON.parse(store.getItem(RUN_HISTORY_KEY));
    assert.equal(stored.runs.length, 3, "A, B and the new death all landed — merge-on-write never shrinks");
    assert.ok(stored.runs.some((r) => r.hash === A.hash), "A survived");
    assert.ok(stored.runs.some((r) => r.hash === B.hash), "B survived");
  });
});

// --- purity / source guards --------------------------------------------------

test("source: engineAdapter.js exports loadRunHistory/getRunHistory/setAppVersion exactly once each", () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "engineAdapter.js"), "utf8");
  const count = (re) => (src.match(re) || []).length;
  assert.equal(count(/export async function loadRunHistory/g), 1);
  assert.equal(count(/export function getRunHistory/g), 1);
  assert.equal(count(/export function setAppVersion/g), 1);
});
