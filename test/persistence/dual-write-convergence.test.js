// test/persistence/dual-write-convergence.test.js
//
// 02-RESEARCH.md "The dual-write hazard": mazeworld.html's classic
// (non-module) <script> and src/browser/engineAdapter.js's ES module BOTH
// used to read/write ddr.delve.v1 / ddr.graveyard.v1 independently via raw
// localStorage (a duplicated-literal, no shared backend). This file proves
// the 02-03 fix: BOTH paths converge on the SAME `window.mzStorage` instance
// — literally the SAME storage.js module-level state (write queues, backend
// selection) — so there are no longer two backends racing on the same key.
//
// Phase 44 (DEAD-01/DEAD-03): the classic script's OWN run-save save()/
// load() are gone (retired along with classic newGame() — the last live
// foothold of the dead engine); engineAdapter.js's persist()/boot() is the
// ONE run-save path now, already covered by the first two cases below and
// by test/unit/engineAdapter.test.js. This file keeps only: (a) the
// engineAdapter-vs-direct-storage.getItem convergence proof, and (b) the
// classic script's OWN extracted saveGraves()/loadGraves() (the graves key,
// which is still live persistence) routing through the same
// window.mzStorage instance.

import test from "node:test";
import assert from "node:assert/strict";
import * as storage from "../../src/browser/storage.js";
import { boot, dispatch, getState } from "../../src/browser/engineAdapter.js";
import { rehydrate } from "../../engine/saveState.js";
import { installFakeCapacitor, installFakeLocalStorage } from "./harness/fakePreferences.js";
import { loadClassicPersistenceSandbox } from "./harness/sandboxClassicPersistence.js";

const SAVE_KEY = "ddr.delve.v1";
const GRAVE_KEY = "ddr.graveyard.v1";

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
    assert.ok(raw, "dispatch()'s persist landed in the shared backend under ddr.delve.v1");

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

test("the classic script's OWN extracted loadGraves()/saveGraves() also route through window.mzStorage under ddr.graveyard.v1", async () => {
  await withConvergedStorage(async (store) => {
    const classic = loadClassicPersistenceSandbox({ mzStorage: window.mzStorage });
    classic.graves = [{ name: "Bones", cause: "starve" }];
    await classic.saveGraves();

    const raw = store.get(GRAVE_KEY);
    assert.ok(raw, "the classic script's own saveGraves() wrote through window.mzStorage");
    assert.deepStrictEqual(JSON.parse(raw), [{ name: "Bones", cause: "starve" }]);

    classic.graves = [];
    await classic.loadGraves();
    // classic.graves is now populated by loadGraves()'s own `JSON.parse(...)`
    // call, evaluated INSIDE the vm sandbox's separate realm — its objects
    // are structurally identical to, but not reference-equal-by-prototype
    // with, this file's own Object/Array (assert.deepStrictEqual treats
    // cross-realm objects as unequal even with identical shape/values).
    // Round-tripping through THIS realm's JSON normalizes that away; the
    // content equality is exactly what this test is verifying.
    assert.deepStrictEqual(
      JSON.parse(JSON.stringify(classic.graves)),
      [{ name: "Bones", cause: "starve" }],
      "loadGraves() read back through window.mzStorage",
    );
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
