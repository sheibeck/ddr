// test/persistence/dual-write-convergence.test.js
//
// 02-RESEARCH.md "The dual-write hazard": mazeworld.html's classic
// (non-module) <script> and src/browser/engineAdapter.js's ES module BOTH
// currently read/write mazeworld.delve.v1 / mazeworld.graveyard.v1
// independently via raw localStorage (a duplicated-literal, no shared
// backend). This file proves the 02-03 fix: BOTH paths converge on the SAME
// `window.mzStorage` instance — literally the SAME storage.js module-level
// state (write queues, backend selection) — so there are no longer two
// backends racing on the same key. engineAdapter.js is not yet refactored to
// use storage.js and mazeworld.html has no extraction markers yet — this
// file is written RED-first (Wave-0 Task 1).

import test from "node:test";
import assert from "node:assert/strict";
import * as storage from "../../src/browser/storage.js";
import { boot, dispatch, getState } from "../../src/browser/engineAdapter.js";
import { rehydrate } from "../../engine/saveState.js";
import { installFakeCapacitor, installFakeLocalStorage } from "./harness/fakePreferences.js";
import { loadClassicPersistenceSandbox } from "./harness/sandboxClassicPersistence.js";

const SAVE_KEY = "mazeworld.delve.v1";
const GRAVE_KEY = "mazeworld.graveyard.v1";

/**
 * withConvergedStorage(fn) — installs a fake browser backend (isNative:
 * false) and hands `fn` the SAME literal storage.js function references as
 * `window.mzStorage`, so engineAdapter.js (which will import storage.js
 * directly) and the classic-script sandbox (which is handed this exact
 * object) share the identical module-level write-queue state — the strongest
 * possible proof there is exactly ONE backend, not two independently
 * evolving ones.
 */
async function withConvergedStorage(fn) {
  const restoreCapacitor = installFakeCapacitor({ isNative: false });
  const { store, restore: restoreLocalStorage } = installFakeLocalStorage();
  window.mzStorage = {
    getItem: storage.getItem,
    setItem: storage.setItem,
    removeItem: storage.removeItem,
    flush: storage.flush,
    migrateLegacyKeys: storage.migrateLegacyKeys,
  };
  try {
    await fn(store);
  } finally {
    delete window.mzStorage;
    restoreLocalStorage();
    restoreCapacitor();
  }
}

test("engineAdapter's boot()/dispatch() persist the run save through the storage abstraction, and it reads back an equal GameState (SAV-02)", async () => {
  await withConvergedStorage(async (store) => {
    await boot(4242);
    const { state } = dispatch({ type: "move", dir: "N" });
    await storage.flush();

    const raw = store.get(SAVE_KEY);
    assert.ok(raw, "dispatch()'s persist landed in the shared backend under mazeworld.delve.v1");

    const rehydrated = rehydrate(JSON.parse(raw));
    assert.deepStrictEqual(rehydrated.c, state.c, "the save read back through the abstraction rehydrates to an equal GameState");
    assert.deepStrictEqual(rehydrated.floor.depth, state.floor.depth);
  });
});

test("engineAdapter and a direct storage.getItem() read see the IDENTICAL value — proving one shared backend, not two", async () => {
  await withConvergedStorage(async () => {
    await boot(1);
    dispatch({ type: "move", dir: "N" });
    await storage.flush();

    const viaAbstraction = await storage.getItem(SAVE_KEY);
    assert.ok(viaAbstraction, "a value was written");
    const viaWindow = await window.mzStorage.getItem(SAVE_KEY);
    assert.equal(viaAbstraction, viaWindow, "storage.getItem and window.mzStorage.getItem resolve the identical value");
  });
});

test("mazeworld.html's OWN extracted save()/load() functions (not a reimplementation) read/write through window.mzStorage", async () => {
  await withConvergedStorage(async (store) => {
    const classic = loadClassicPersistenceSandbox({ mzStorage: window.mzStorage });
    classic.S = { c: { name: "Classic" }, floor: { depth: 3 }, day: 2, steps: 5, dead: false, won: false, deathNote: "", epitaph: "" };
    await classic.save();

    const raw = store.get(SAVE_KEY);
    assert.ok(raw, "the classic script's own save() wrote through window.mzStorage into the shared backend");
    assert.equal(JSON.parse(raw).c.name, "Classic");

    const loaded = await classic.load();
    assert.equal(loaded.c.name, "Classic", "the classic script's own load() reads back through window.mzStorage");
    assert.equal(loaded.floor.depth, 3);
  });
});

test("dual-write convergence: engineAdapter's write and the classic script's write land in the SAME backend/key — no two independent stores (the core hazard this file exists to close)", async () => {
  await withConvergedStorage(async (store) => {
    // 1. Write through engineAdapter first.
    await boot(99);
    dispatch({ type: "move", dir: "N" });
    await storage.flush();
    const afterEngine = store.get(SAVE_KEY);
    assert.ok(afterEngine, "engineAdapter wrote a save");

    // 2. Now write through the classic script's OWN extracted save(). If it
    // used a second, independent backend, this write would land somewhere
    // else entirely and the shared `store` Map (representing the ONE real
    // backend) would still show engineAdapter's stale value.
    const classic = loadClassicPersistenceSandbox({ mzStorage: window.mzStorage });
    classic.S = { c: { name: "OverwroteViaClassic" }, floor: { depth: 9 }, day: 1, steps: 0, dead: false, won: false, deathNote: "", epitaph: "" };
    await classic.save();
    const afterClassic = store.get(SAVE_KEY);
    assert.notEqual(afterClassic, afterEngine, "the classic script's write actually changed the ONE shared backend's value");
    assert.equal(JSON.parse(afterClassic).c.name, "OverwroteViaClassic");

    // 3. Reading back through the abstraction (as engineAdapter's own boot()
    // would on the next launch) sees the classic script's write, not a stale
    // engine-only copy — there is exactly one backend both paths converge on.
    const viaAbstraction = await storage.getItem(SAVE_KEY);
    assert.equal(viaAbstraction, afterClassic, "reading via the abstraction sees the classic script's write — one shared backend");
  });
});

test("the classic script's OWN extracted loadGraves()/saveGraves() also route through window.mzStorage under mazeworld.graveyard.v1", async () => {
  await withConvergedStorage(async (store) => {
    const classic = loadClassicPersistenceSandbox({ mzStorage: window.mzStorage });
    classic.graves = [{ name: "Bones", cause: "starve" }];
    await classic.saveGraves();

    const raw = store.get(GRAVE_KEY);
    assert.ok(raw, "the classic script's own saveGraves() wrote through window.mzStorage");
    assert.deepStrictEqual(JSON.parse(raw), [{ name: "Bones", cause: "starve" }]);

    classic.graves = [];
    await classic.loadGraves();
    assert.deepStrictEqual(classic.graves, [{ name: "Bones", cause: "starve" }], "loadGraves() read back through window.mzStorage");
  });
});

test("regression guard: engineAdapter.js contains no raw localStorage.*Item calls (comments excluded) — everything routes through storage.js", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");
  const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
  const src = fs.readFileSync(path.join(__dirname, "..", "..", "src", "browser", "engineAdapter.js"), "utf8");
  const withoutComments = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const rawCalls = withoutComments.match(/localStorage\.(get|set|remove)Item/g) || [];
  assert.deepStrictEqual(rawCalls, [], "engineAdapter.js must not call localStorage directly — route through storage.js");
});
