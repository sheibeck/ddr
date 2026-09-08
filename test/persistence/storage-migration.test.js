// test/persistence/storage-migration.test.js
//
// Wave-0 coverage for src/browser/storage.js's migrateLegacyKeys() (02-01
// Task 1, RED until Task 3). Covers the one-time, idempotent,
// non-destructive localStorage->Preferences copy-if-empty for the three
// legacy keys (mazeworld.delve.v1 / mazeworld.best.v1 /
// mazeworld.graveyard.v1), including fail-closed validation of a migrated
// run save via engine/saveState.js's validateSave. Never imports
// `@capacitor/preferences` — the native backend is the same injected fake
// Preferences used by storage.test.js.

import test from "node:test";
import assert from "node:assert/strict";

import { migrateLegacyKeys, getItem } from "../../src/browser/storage.js";
import { newRun } from "../../engine/engine.js";
import { serializeRun } from "../../engine/saveState.js";
import {
  makeFakePreferences,
  installFakeCapacitor,
  installFakeLocalStorage,
} from "./harness/fakePreferences.js";

const SAVE_KEY = "mazeworld.delve.v1";
const BEST_KEY = "mazeworld.best.v1";
const GRAVE_KEY = "mazeworld.graveyard.v1";

test("migrateLegacyKeys copies all three legacy localStorage keys into Preferences when Preferences is empty", async () => {
  const preferences = makeFakePreferences();
  const restoreCap = installFakeCapacitor({ isNative: true, preferences });
  const { store: lsStore, restore: restoreLS } = installFakeLocalStorage();
  try {
    const run = newRun(101);
    const runSave = JSON.stringify(serializeRun(run));
    const graves = JSON.stringify([{ name: "Alice", cause: "starve" }]);
    lsStore.set(SAVE_KEY, runSave);
    lsStore.set(BEST_KEY, "5");
    lsStore.set(GRAVE_KEY, graves);

    await migrateLegacyKeys();

    assert.equal(await getItem(SAVE_KEY), runSave, "run save migrated into Preferences");
    assert.equal(await getItem(BEST_KEY), "5", "best depth migrated into Preferences");
    assert.equal(await getItem(GRAVE_KEY), graves, "graveyard migrated into Preferences");
  } finally {
    restoreCap();
    restoreLS();
  }
});

test("migrateLegacyKeys never removes the localStorage source", async () => {
  const preferences = makeFakePreferences();
  const restoreCap = installFakeCapacitor({ isNative: true, preferences });
  const { store: lsStore, restore: restoreLS } = installFakeLocalStorage();
  try {
    const run = newRun(202);
    const runSave = JSON.stringify(serializeRun(run));
    lsStore.set(SAVE_KEY, runSave);
    lsStore.set(BEST_KEY, "3");

    await migrateLegacyKeys();

    assert.equal(lsStore.get(SAVE_KEY), runSave, "localStorage run save left untouched");
    assert.equal(lsStore.get(BEST_KEY), "3", "localStorage best depth left untouched");
  } finally {
    restoreCap();
    restoreLS();
  }
});

test("migrateLegacyKeys is idempotent: a second run copies nothing and overwrites nothing already migrated", async () => {
  const preferences = makeFakePreferences();
  const restoreCap = installFakeCapacitor({ isNative: true, preferences });
  const { store: lsStore, restore: restoreLS } = installFakeLocalStorage();
  try {
    const firstRunSave = JSON.stringify(serializeRun(newRun(303)));
    lsStore.set(SAVE_KEY, firstRunSave);

    await migrateLegacyKeys();
    assert.equal(await getItem(SAVE_KEY), firstRunSave);

    // Mutate the localStorage source AFTER the first migration to prove a
    // second pass does not re-copy/overwrite the already-migrated Preferences
    // value (idempotent, copy-if-empty only).
    const secondRunSave = JSON.stringify(serializeRun(newRun(999)));
    lsStore.set(SAVE_KEY, secondRunSave);

    await migrateLegacyKeys();

    assert.equal(
      await getItem(SAVE_KEY),
      firstRunSave,
      "the already-migrated Preferences value was not overwritten by a second migration pass"
    );
  } finally {
    restoreCap();
    restoreLS();
  }
});

test("migrateLegacyKeys validates the run save via engine/saveState.js validateSave and skips migrating a corrupt one (fail-closed)", async () => {
  const preferences = makeFakePreferences();
  const restoreCap = installFakeCapacitor({ isNative: true, preferences });
  const { store: lsStore, restore: restoreLS } = installFakeLocalStorage();
  try {
    lsStore.set(SAVE_KEY, "{not valid json at all");

    await migrateLegacyKeys();

    assert.equal(await getItem(SAVE_KEY), null, "a corrupt/tampered run save was not migrated");
  } finally {
    restoreCap();
    restoreLS();
  }
});

test("migrateLegacyKeys still migrates best-depth and graveyard even when the run save is corrupt (per-key independence)", async () => {
  const preferences = makeFakePreferences();
  const restoreCap = installFakeCapacitor({ isNative: true, preferences });
  const { store: lsStore, restore: restoreLS } = installFakeLocalStorage();
  try {
    lsStore.set(SAVE_KEY, "{not valid json at all");
    lsStore.set(BEST_KEY, "12");

    await migrateLegacyKeys();

    assert.equal(await getItem(SAVE_KEY), null, "corrupt run save still rejected");
    assert.equal(await getItem(BEST_KEY), "12", "best depth still migrated independently");
  } finally {
    restoreCap();
    restoreLS();
  }
});

test("migrateLegacyKeys is a no-op when localStorage is empty (true first install)", async () => {
  const preferences = makeFakePreferences();
  const restoreCap = installFakeCapacitor({ isNative: true, preferences });
  const { restore: restoreLS } = installFakeLocalStorage();
  try {
    await migrateLegacyKeys();

    assert.equal(await getItem(SAVE_KEY), null);
    assert.equal(await getItem(BEST_KEY), null);
    assert.equal(await getItem(GRAVE_KEY), null);
  } finally {
    restoreCap();
    restoreLS();
  }
});
