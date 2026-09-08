// test/persistence/storage.test.js
//
// Wave-0 coverage for src/browser/storage.js (02-01 Task 1, RED until Task
// 2). Exercises the shared async Storage abstraction's get/set/remove
// round-trip through BOTH backends (a mocked async native Preferences, and
// sync localStorage), its non-string/fail-safe defenses, and the per-key
// rapid-write ordering guarantee (SAV-01..03). Never imports
// `@capacitor/preferences` or any bare `@capacitor/*` specifier — the native
// backend is exercised purely through the injected `window.Capacitor` +
// the fake Preferences from test/persistence/harness/fakePreferences.js,
// proving the abstraction never needs the real plugin resolvable under node.

import test from "node:test";
import assert from "node:assert/strict";

import { getItem, setItem, removeItem } from "../../src/browser/storage.js";
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

test("getItem/setItem/removeItem round-trip a value through the NATIVE branch (fake Preferences, isNativePlatform()=true)", async () => {
  const preferences = makeFakePreferences();
  const restore = installFakeCapacitor({ isNative: true, preferences });
  try {
    assert.equal(await getItem(SAVE_KEY), null, "missing key returns null before any write");
    await setItem(SAVE_KEY, "hello-native");
    assert.equal(await getItem(SAVE_KEY), "hello-native");
    await removeItem(SAVE_KEY);
    assert.equal(await getItem(SAVE_KEY), null, "removed key reads back as null");
  } finally {
    restore();
  }
});

test("getItem/setItem/removeItem round-trip a value through the BROWSER branch (fake localStorage, isNativePlatform()=false)", async () => {
  const restoreCap = installFakeCapacitor({ isNative: false });
  const { restore: restoreLS } = installFakeLocalStorage();
  try {
    assert.equal(await getItem(SAVE_KEY), null);
    await setItem(SAVE_KEY, "hello-browser");
    assert.equal(await getItem(SAVE_KEY), "hello-browser");
    await removeItem(SAVE_KEY);
    assert.equal(await getItem(SAVE_KEY), null);
  } finally {
    restoreCap();
    restoreLS();
  }
});

test("getItem/setItem/removeItem also work through the BROWSER branch when window.Capacitor is entirely absent (plain dev-loop default)", async () => {
  const { restore } = installFakeLocalStorage();
  try {
    assert.equal(await getItem(BEST_KEY), null);
    await setItem(BEST_KEY, "9");
    assert.equal(await getItem(BEST_KEY), "9");
  } finally {
    restore();
  }
});

test("getItem returns null for a missing key on both backends", async () => {
  const preferences = makeFakePreferences();
  const restoreCap = installFakeCapacitor({ isNative: true, preferences });
  try {
    assert.equal(await getItem("nonexistent-key"), null);
  } finally {
    restoreCap();
  }

  const { restore: restoreLS } = installFakeLocalStorage();
  try {
    assert.equal(await getItem("nonexistent-key"), null);
  } finally {
    restoreLS();
  }
});

test("getItem defends against a non-string native Preferences result (returns null rather than handing a non-string to a parser)", async () => {
  const weirdPreferences = {
    async get() {
      return { value: 12345 };
    },
    async set() {},
    async remove() {},
  };
  const restore = installFakeCapacitor({ isNative: true, preferences: weirdPreferences });
  try {
    assert.equal(await getItem(SAVE_KEY), null);
  } finally {
    restore();
  }
});

test("setItem then getItem after a simulated restart deepStrictEquals a serializeRun(newRun(seed)) value (SAV-02)", async () => {
  const preferences = makeFakePreferences();
  const restore = installFakeCapacitor({ isNative: true, preferences });
  try {
    const original = newRun(4242);
    const serialized = JSON.stringify(serializeRun(original));
    await setItem(SAVE_KEY, serialized);

    // Simulate an app restart: a fresh getItem() call independent of any
    // storage.js-internal decoded-state cache (storage.js holds no such
    // cache — only transient write-queue promises — so this is exactly what
    // a real relaunch's boot()/load() would observe).
    const restored = await getItem(SAVE_KEY);
    assert.deepStrictEqual(JSON.parse(restored), JSON.parse(serialized));
  } finally {
    restore();
  }
});

test("best-depth and graveyard values round-trip the same way as the run save (SAV-04/SAV-05)", async () => {
  const preferences = makeFakePreferences();
  const restore = installFakeCapacitor({ isNative: true, preferences });
  try {
    await setItem(BEST_KEY, "7");
    assert.equal(await getItem(BEST_KEY), "7");

    const graves = JSON.stringify([{ name: "Bob", cause: "starve" }]);
    await setItem(GRAVE_KEY, graves);
    assert.equal(await getItem(GRAVE_KEY), graves);
  } finally {
    restore();
  }
});

test("getItem/setItem never throw and getItem resolves null when the native backend throws/rejects (SAV-03 fail-safe)", async () => {
  const throwingPreferences = {
    async get() {
      throw new Error("native boom");
    },
    async set() {
      throw new Error("native boom");
    },
    async remove() {
      throw new Error("native boom");
    },
  };
  const restore = installFakeCapacitor({ isNative: true, preferences: throwingPreferences });
  try {
    await assert.doesNotReject(async () => {
      assert.equal(await getItem(SAVE_KEY), null);
    });
    await assert.doesNotReject(() => setItem(SAVE_KEY, "x"));
    await assert.doesNotReject(() => removeItem(SAVE_KEY));
  } finally {
    restore();
  }
});

test("getItem/setItem never throw when the browser localStorage backend throws (private window/quota)", async () => {
  const restoreCap = installFakeCapacitor({ isNative: false });
  const previous = globalThis.localStorage;
  globalThis.localStorage = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
    removeItem() {
      throw new Error("blocked");
    },
  };
  try {
    await assert.doesNotReject(async () => {
      assert.equal(await getItem(SAVE_KEY), null);
    });
    await assert.doesNotReject(() => setItem(SAVE_KEY, "x"));
    await assert.doesNotReject(() => removeItem(SAVE_KEY));
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
    restoreCap();
  }
});

test("a per-key rapid-write burst settles in order and never drops the last write (SAV-01)", async () => {
  const preferences = makeFakePreferences();
  const restore = installFakeCapacitor({ isNative: true, preferences });
  try {
    const p1 = setItem(SAVE_KEY, "first");
    const p2 = setItem(SAVE_KEY, "second");
    const p3 = setItem(SAVE_KEY, "third");
    await Promise.all([p1, p2, p3]);
    assert.equal(await getItem(SAVE_KEY), "third", "the last of three unawaited same-key writes wins");
  } finally {
    restore();
  }
});

test("a per-key rapid-write burst on the browser backend also never drops the last write", async () => {
  const { restore } = installFakeLocalStorage();
  try {
    const p1 = setItem(BEST_KEY, "1");
    const p2 = setItem(BEST_KEY, "2");
    const p3 = setItem(BEST_KEY, "3");
    await Promise.all([p1, p2, p3]);
    assert.equal(await getItem(BEST_KEY), "3");
  } finally {
    restore();
  }
});

// CR-01 (02-REVIEW.md): the native backend must fail SAFE to a working
// localStorage backend when it is itself broken, not degrade to a silent
// total no-op (every read returning null forever, every write vanishing).

test("CR-01: setItem/getItem fall back to localStorage when isNativePlatform() itself throws, instead of a silent no-op", async () => {
  const restoreCap = installFakeCapacitor({ isNative: false }); // baseline install also resets the memoized backend decision
  const { store: lsStore, restore: restoreLS } = installFakeLocalStorage();
  // Simulate a broken native bridge: isNativePlatform() throws rather than
  // returning a boolean (the exact scenario CR-01 names).
  window.Capacitor = {
    isNativePlatform() {
      throw new Error("native bridge not ready");
    },
  };
  try {
    await setItem(SAVE_KEY, "fallback-write");
    assert.equal(
      lsStore.get(SAVE_KEY),
      "fallback-write",
      "the write actually landed in localStorage rather than being silently dropped"
    );
    assert.equal(
      await getItem(SAVE_KEY),
      "fallback-write",
      "the read comes back via the localStorage fallback, not a silent null"
    );
  } finally {
    restoreCap();
    restoreLS();
  }
});

test("CR-01: setItem/getItem fall back to localStorage when the native Preferences backend throws on every call, and the value actually round-trips (not just non-throwing)", async () => {
  const throwingPreferences = {
    async get() {
      throw new Error("preferences bridge broken");
    },
    async set() {
      throw new Error("preferences bridge broken");
    },
    async remove() {
      throw new Error("preferences bridge broken");
    },
  };
  const restoreCap = installFakeCapacitor({ isNative: true, preferences: throwingPreferences });
  const { store: lsStore, restore: restoreLS } = installFakeLocalStorage();
  try {
    await setItem(SAVE_KEY, "fallback-value");
    assert.equal(
      lsStore.get(SAVE_KEY),
      "fallback-value",
      "setItem's write landed in localStorage, not silently dropped by the broken native backend"
    );
    assert.equal(
      await getItem(SAVE_KEY),
      "fallback-value",
      "getItem reads the fallback value back rather than returning null forever"
    );

    // CR-01's memoization: once the native backend has proven broken, a
    // SECOND operation should not keep re-attempting (and re-failing) the
    // native branch — it should go straight to the already-proven-working
    // localStorage backend.
    await setItem(BEST_KEY, "9");
    assert.equal(lsStore.get(BEST_KEY), "9", "a later write also degrades straight to localStorage");
  } finally {
    restoreCap();
    restoreLS();
  }
});
