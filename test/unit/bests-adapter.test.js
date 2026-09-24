// test/unit/bests-adapter.test.js
//
// Phase 65 (RUN-02/RUN-03/RUN-04): the adapter-owned, durable ddr.bests.v1
// personal-bests record — loadBests()/getBests()/takeDeathRecord(), the
// boot-time load/backfill, the synchronous in-memory fold at the died-event
// choke point (recordDeath), and persistGrave()'s tracked, back-to-back
// write of the graveyard tombstone AND the bests record.
//
// The FIRST test below runs before any loadBests()/boot() call this
// process — node --test runs each file in its own process, so module state
// (`bests`, `deathRecord`, `currentState`) is fresh here. Every test after
// it explicitly resets `bests` via loadBests() (or boot()) at the top of
// its own withFakeLocalStorage() block.

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
  loadBests,
  getBests,
  takeDeathRecord,
  waitForPending,
} from "../../src/browser/engineAdapter.js";
import { flush as flushStorage } from "../../src/browser/storage.js";
import { newRun } from "../../engine/engine.js";
import { serializeRun } from "../../engine/saveState.js";
import { emptyBests, updateBests, runHash, normalizeStone, BOARD_IDS } from "../../engine/records.js";
import { BOARD_COPY } from "../../content/boards.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const SAVE_KEY = "ddr.delve.v1";
const BEST_KEY = "ddr.best.v1";
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

/** legacyStone(overrides) — a pre-Phase-65 buildRunSummary shape (15 fields,
 * no season/seed/acts/hash), the exact shape a real device's ddr.graveyard.v1
 * holds before this phase. */
function legacyStone(overrides = {}) {
  return {
    name: "Legacy", race: "Human", sub: "Soldier", cls: "Fighter",
    level: 1, sp: 10, floor: 2, day: 1, steps: 50, gold: 5, kills: 0,
    cause: "combat", note: "died", epitaph: "Rest.", when: 1,
    ...overrides,
  };
}

/** makeSummary(overrides) — a fully-formed, hashed Phase 65 RunSummary, for
 * seeding a "this record already existed" fixture via the pure engine
 * functions rather than hand-crafting a hash string. */
function makeSummary(overrides = {}) {
  const s = {
    name: "Seed One", race: "Human", sub: "Soldier", cls: "Fighter",
    level: 3, sp: 40, floor: 6, day: 4, steps: 300, gold: 100, kills: 5,
    cause: "combat", note: "died", epitaph: "Rest.", when: 111,
    season: 1, seed: 999, acts: 10,
    ...overrides,
  };
  s.hash = runHash(s);
  return s;
}

// --- lazy path (FIRST test in the file — fresh module state) --------------

test("lazy path: a death before loadBests()/boot() is ever called folds the legacy graveyard AND this death into the stored record", async () => {
  await withFakeLocalStorage(async (store) => {
    store.setItem(GRAVE_KEY, JSON.stringify([
      legacyStone({ name: "Old One", floor: 3, when: 2 }),
      legacyStone({ name: "Older Two", race: "Elf", cls: "Thief", floor: 2, when: 1 }),
    ]));

    initRun(77);
    dispatch({ type: "abandon" });

    assert.equal(
      takeDeathRecord(),
      null,
      "the lazy path defers folding until persistGrave() runs; nothing is available synchronously this time"
    );

    await waitForPending();
    await flushStorage();

    const stored = JSON.parse(store.getItem(BESTS_KEY));
    assert.equal(Object.keys(stored.runs).length, 3, "2 legacy stones + this death = 3 runs");
    const seasons = Object.values(stored.runs).map((r) => r.season).sort();
    assert.deepStrictEqual(seasons, [0, 0, 1]);
    for (const hash of Object.keys(stored.runs)) {
      assert.equal(stored.runs[hash].hash, hash, "every backfilled run is held under its own hash");
    }
    assert.ok(!("lineage" in stored), "the retired Phase 65 lineage map is never written (Phase 70, D-12)");
  });
});

// --- boot: load, backfill, legacy tolerance --------------------------------

test("boot backfill: 3 full legacy stones + one partial stone, ddr.best.v1, graveyard.total, and a pre-Phase-65 save with no acts, all load through boot() without error", async () => {
  await withFakeLocalStorage(async (store) => {
    store.setItem(GRAVE_KEY, JSON.stringify([
      legacyStone({ name: "A", floor: 5, when: 3 }),
      legacyStone({ name: "B", floor: 4, when: 2 }),
      legacyStone({ name: "C", floor: 3, when: 1 }),
      { name: "D", cause: "trap" }, // partial: no finite floor, skipped by backfillBests
    ]));
    store.setItem(BEST_KEY, "7");
    store.setItem(GRAVE_TOTAL_KEY, "12");

    const preSave = serializeRun(newRun(1234));
    delete preSave.acts;
    store.setItem(SAVE_KEY, JSON.stringify(preSave));

    await assert.doesNotReject(() => boot(999));

    assert.equal(getState().acts, 0, "the pre-Phase-65 save's missing acts tolerant-loads as 0");

    const loaded = getBests();
    assert.equal(Object.keys(loaded.runs).length, 3, "the partial stone with no finite floor is skipped");
    for (const hash of Object.keys(loaded.runs)) {
      assert.equal(loaded.runs[hash].season, 0, "backfilled runs are season 0");
      assert.ok(!("seed" in loaded.runs[hash]), "no invented seed on a backfilled run");
      assert.ok(!("acts" in loaded.runs[hash]), "no invented acts on a backfilled run");
    }

    await waitForPending();
    await flushStorage();
    assert.deepStrictEqual(JSON.parse(store.getItem(BESTS_KEY)), loaded);
    assert.equal(store.getItem(BEST_KEY), "7", "ddr.best.v1 is left untouched");
  });
});

test("boot with an existing valid ddr.bests.v1 loads it via sanitizeBests; graveyard stones are NOT re-folded", async () => {
  await withFakeLocalStorage(async (store) => {
    const summary = makeSummary();
    const seeded = updateBests(emptyBests(), summary).record;
    store.setItem(BESTS_KEY, JSON.stringify(seeded));
    // A different lineage's legacy stone in the graveyard — if boot()
    // erroneously re-folded the graveyard, its normalized hash would show
    // up in the loaded runs.
    const other = legacyStone({ name: "Other", race: "Elf", cls: "Thief", floor: 2, when: 9 });
    store.setItem(GRAVE_KEY, JSON.stringify([other]));

    await boot(1234);

    const loaded = getBests();
    assert.ok(!loaded.runs[normalizeStone(other).hash], "the legacy graveyard stone was not re-folded");
    assert.ok(loaded.runs[summary.hash], "the seeded run survived sanitizeBests");
  });
});

test("boot with a corrupt ddr.bests.v1 falls back to backfill from the graveyard, and never throws", async () => {
  await withFakeLocalStorage(async (store) => {
    store.setItem(BESTS_KEY, "{not json");
    store.setItem(GRAVE_KEY, JSON.stringify([
      legacyStone({ name: "Stone", race: "Dwarf", cls: "Fighter", floor: 4, when: 5 }),
    ]));

    await assert.doesNotReject(() => boot(42));

    const loaded = getBests();
    assert.equal(Object.keys(loaded.runs).length, 1, "backfilled from the one graveyard stone");
  });
});

// --- the death report (RUN-04) --------------------------------------------

test("first-ever death: takeDeathRecord() returns { first: true, newBests: [], summary } once, then null", async () => {
  await withFakeLocalStorage(async () => {
    await loadBests();
    await startNewRun(555);
    dispatch({ type: "abandon" });

    const report = takeDeathRecord();
    assert.equal(report.first, true);
    assert.deepStrictEqual(report.newBests, []);
    assert.equal(report.summary.season, 1);
    assert.equal(typeof report.summary.seed, "number");
    assert.equal(typeof report.summary.acts, "number");
    assert.match(report.summary.hash, /^[0-9a-f]{8}$/);

    assert.equal(takeDeathRecord(), null, "one-shot: a second call returns null");
  });
});

test("getBests() reflects a new death synchronously, before any await (the synchronous fold)", async () => {
  await withFakeLocalStorage(async () => {
    await loadBests();
    await startNewRun(777);
    assert.equal(Object.keys(getBests().runs).length, 0);
    dispatch({ type: "abandon" }); // deliberately not awaited
    assert.equal(Object.keys(getBests().runs).length, 1, "the death folded into getBests() synchronously");
  });
});

test("a deeper run announces new bests on deep and lean; a shallower run after that announces nothing", async () => {
  await withFakeLocalStorage(async () => {
    await loadBests();

    await startNewRun(1);
    getState().floor.depth = 3;
    dispatch({ type: "abandon" });
    takeDeathRecord(); // consume the first-death report

    await startNewRun(2);
    getState().floor.depth = 9; // deeper
    dispatch({ type: "abandon" });
    const deeperReport = takeDeathRecord();
    // A tie on day/kills is itself broken by floor desc (compareRuns), so a
    // deeper run with unchanged day/kills can ALSO take #1 on those boards —
    // the behavior only requires deep/lean to be among the boards beaten.
    assert.ok(deeperReport.newBests.includes("deep"), "deeper floor beats DEEPEST");
    assert.ok(deeperReport.newBests.includes("lean"), "deeper floor beats LEANEST");

    await startNewRun(3);
    getState().floor.depth = 1; // shallower
    dispatch({ type: "abandon" });
    const shallowerReport = takeDeathRecord();
    assert.equal(shallowerReport.first, false);
    assert.deepStrictEqual(shallowerReport.newBests, []);
  });
});

// --- persistence: graveyard/bests agreement, acts, dev exclusion -----------

test("the stored graveyard's newest stone deepStrictEquals its own entry in the stored bests record", async () => {
  await withFakeLocalStorage(async (store) => {
    await loadBests();
    await startNewRun(9);
    dispatch({ type: "abandon" });
    await waitForPending();
    await flushStorage();

    const graves = JSON.parse(store.getItem(GRAVE_KEY));
    const record = JSON.parse(store.getItem(BESTS_KEY));
    assert.match(graves[0].hash, /^[0-9a-f]{8}$/);
    assert.deepStrictEqual(graves[0], record.runs[graves[0].hash]);
    assert.equal(record.runs[graves[0].hash].season, 1);
    assert.equal(typeof record.runs[graves[0].hash].seed, "number");
    assert.equal(typeof record.runs[graves[0].hash].acts, "number");
  });
});

test("acts on the stored stone counts only validated actions through dispatch", async () => {
  await withFakeLocalStorage(async (store) => {
    await loadBests();
    await startNewRun(21);
    dispatch({ type: "bogus" }); // invalid: not counted
    dispatch({ type: "move", dir: "X" }); // invalid dir: not counted
    dispatch({ type: "camp" });
    dispatch({ type: "camp" });
    dispatch({ type: "camp" });
    dispatch({ type: "abandon" });
    await waitForPending();
    await flushStorage();

    const graves = JSON.parse(store.getItem(GRAVE_KEY));
    assert.equal(graves[0].acts, 4, "3 camps + 1 abandon = 4 validated actions");
  });
});

test("a dev run's death never touches the bests record", async () => {
  await withFakeLocalStorage(async (store) => {
    await loadBests();
    await waitForPending();
    await flushStorage();
    const beforeStored = store.getItem(BESTS_KEY);
    const beforeInMemory = getBests();

    await startNewRun(50, { startDepth: 20 });
    dispatch({ type: "abandon" });

    assert.equal(takeDeathRecord(), null, "a dev run's death never produces a death report");
    assert.deepStrictEqual(getBests(), beforeInMemory, "the in-memory record is unchanged");

    await waitForPending();
    await flushStorage();
    assert.equal(store.getItem(BESTS_KEY), beforeStored, "the stored record is byte-identical to before the dev run's death");
  });
});

test("62 deaths: the graveyard trims to 60 stones but the deepest run survives as boards.deep[0]", async () => {
  await withFakeLocalStorage(async (store) => {
    await loadBests();

    await startNewRun(9000);
    getState().floor.depth = 9;
    dispatch({ type: "abandon" });
    await waitForPending();
    await flushStorage();
    const firstHash = JSON.parse(store.getItem(GRAVE_KEY))[0].hash;

    for (let i = 0; i < 61; i++) {
      await startNewRun(9001 + i);
      dispatch({ type: "abandon" }); // floor.depth stays at the default (1)
      await waitForPending();
      await flushStorage();
    }

    const graves = JSON.parse(store.getItem(GRAVE_KEY));
    assert.equal(graves.length, 60, "the graveyard trims to the 60-stone cap");
    assert.ok(!graves.some((g) => g.hash === firstHash), "the deepest run's stone has aged out of the visible graveyard");

    const record = JSON.parse(store.getItem(BESTS_KEY));
    assert.equal(record.boards.deep[0], firstHash, "the deepest run is still #1 on DEEPEST despite trimming out of the graveyard");
  });
});

test("back-to-back deaths with no flush in between both land in the stored record", async () => {
  await withFakeLocalStorage(async (store) => {
    await loadBests();

    await startNewRun(201);
    dispatch({ type: "abandon" });
    const hashA = getBests().last;

    await startNewRun(202);
    dispatch({ type: "abandon" });
    const hashB = getBests().last;

    assert.notEqual(hashA, hashB);

    await waitForPending();
    await flushStorage();

    const record = JSON.parse(store.getItem(BESTS_KEY));
    assert.ok(record.runs[hashA], "the first death's run survived");
    assert.ok(record.runs[hashB], "the second death's run survived");
  });
});

test("waitForPending() alone (no explicit storage flush) leaves ddr.bests.v1 written", async () => {
  await withFakeLocalStorage(async (store) => {
    await loadBests();
    await startNewRun(301);
    dispatch({ type: "abandon" });
    await waitForPending();
    // Deliberately no flushStorage() call — the bests write is tracked via
    // track(), and setItem()'s own returned promise (awaited inside
    // persistGrave()'s Promise.all) only resolves once the write actually
    // reaches the fake backing store.
    assert.ok(store.getItem(BESTS_KEY), "ddr.bests.v1 was written without an explicit flush() call");
  });
});

test("blocked storage: boot resolves, a death never throws and never falls closed to a fresh run, and the in-memory report still works", async () => {
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
    await assert.doesNotReject(() => boot(3));
    const name = getState().c.name;
    assert.doesNotThrow(() => dispatch({ type: "abandon" }));
    assert.equal(getState().dead, true);
    assert.equal(getState().c.name, name, "did not fall closed to a fresh run");
    const report = takeDeathRecord();
    assert.ok(report, "the in-memory report still works even though nothing could persist");
    assert.equal(report.first, true);
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
});

test("starting a new run clears any pending one-shot death report", async () => {
  await withFakeLocalStorage(async () => {
    await loadBests();
    await startNewRun(401);
    dispatch({ type: "abandon" });
    await startNewRun(402); // starts a new run, clearing the previous death's report
    assert.equal(takeDeathRecord(), null, "the new run cleared the previous death's pending report");
  });
});

// --- purity / shared-table guards ------------------------------------------

test("source scan: engineAdapter.js has no ddr.best.v1 literal, no removed best-depth identifiers, no raw localStorage, and no Math.random/document", () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "engineAdapter.js"), "utf8");
  const stripped = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.ok(!/ddr\.best\.v1/.test(stripped), "no literal ddr.best.v1 key outside comments");
  assert.ok(!/\bgetBest\b/.test(stripped), "no getBest identifier");
  assert.ok(!/\brecordBest\b/.test(stripped), "no recordBest identifier");
  assert.ok(!/\bBEST_KEY\b/.test(stripped), "no BEST_KEY identifier");
  assert.ok(!/localStorage\.(get|set|remove)Item/.test(stripped), "no raw localStorage calls");
  assert.ok(!/Math\.random/.test(stripped));
  assert.ok(!/\bdocument\b/.test(stripped));
});

test("the shared board table: BOARD_COPY's keys (content/boards.js) deepStrictEqual BOARD_IDS (engine/records.js)", () => {
  assert.deepStrictEqual(Object.keys(BOARD_COPY), [...BOARD_IDS]);
});
