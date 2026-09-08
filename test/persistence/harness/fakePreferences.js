// test/persistence/harness/fakePreferences.js
//
// Shared async fake-Preferences mock + install/restore helpers for a fake
// `window.Capacitor` (native-platform detection) and a synchronous fake
// `localStorage`, used by test/persistence/storage.test.js and
// test/persistence/storage-migration.test.js (02-01 Task 1). Mirrors
// test/unit/engineAdapter.test.js's `withFakeLocalStorage` install/restore
// discipline so nothing leaks between test files — each test process runs
// isolated under `node --test`, but every helper here restores in a
// `finally` regardless, matching that established pattern.
//
// src/browser/storage.js's native branch reaches the real
// `@capacitor/preferences` plugin via a guarded dynamic `import()` that is
// never resolvable under `node --test` (the package isn't installed until
// 02-02, and this project stays zero-runtime-dep — .claude/CLAUDE.md). To
// let these tests exercise that branch's queueing/JSON/fail-safe behavior
// without ever resolving a `@capacitor/*` specifier, storage.js checks a
// test-only override hook (`window.__mzPreferencesOverride`) BEFORE
// attempting the real dynamic import. `installFakeCapacitor()` below installs
// that hook alongside the fake `window.Capacitor`. Production code never sets
// this hook, so real native launches always fall through to the real import.
//
// CR-01 (02-REVIEW.md): storage.js now memoizes its native-vs-browser
// backend decision for the module's lifetime (so an intermittently-throwing
// isNativePlatform() can't split reads/writes across two different
// backends). `installFakeCapacitor()`/its `restore()` both clear that cache
// via storage.js's test-only `__resetNativeDetectionForTests()` so each test
// case starts from a fresh undetermined state regardless of what an earlier
// test in the same file/process decided.

import { __resetNativeDetectionForTests } from "../../../src/browser/storage.js";

/**
 * makeFakePreferences() — an in-memory async fake matching
 * `@capacitor/preferences`'s Preferences API: `get({key})`, `set({key,value})`,
 * `remove({key})`, `keys()`, `clear()`. Every method resolves on a microtask
 * (via `await Promise.resolve()` before touching the backing Map) rather than
 * synchronously, so write-ordering races are actually observable in tests.
 */
export function makeFakePreferences() {
  const store = new Map();
  return {
    async get({ key }) {
      await Promise.resolve();
      return { value: store.has(key) ? store.get(key) : null };
    },
    async set({ key, value }) {
      await Promise.resolve();
      store.set(key, value);
    },
    async remove({ key }) {
      await Promise.resolve();
      store.delete(key);
    },
    async keys() {
      await Promise.resolve();
      return { keys: [...store.keys()] };
    },
    async clear() {
      await Promise.resolve();
      store.clear();
    },
    // Test-only convenience (not part of the real Preferences API) so tests
    // can inspect the backing store directly without going through storage.js.
    _raw: store,
  };
}

/**
 * installFakeCapacitor({ isNative, preferences }) — installs a fake
 * `window.Capacitor` (`isNativePlatform()` returns the caller-chosen
 * boolean) and, when `preferences` is supplied, the test-only
 * `window.__mzPreferencesOverride` hook storage.js's native branch checks in
 * place of a real dynamic `import('@capacitor/preferences')`. Creates
 * `globalThis.window` (aliased to `globalThis` itself, matching real
 * browsers where `window === globalThis`) if it doesn't already exist.
 * Returns a `restore()` function that puts back whatever was there before
 * (undefined -> delete), matching `withFakeLocalStorage`'s discipline.
 */
export function installFakeCapacitor({ isNative = false, preferences = null } = {}) {
  const hadWindow = typeof globalThis.window !== "undefined";
  if (!hadWindow) globalThis.window = globalThis;

  const previousCapacitor = globalThis.window.Capacitor;
  const previousOverride = globalThis.window.__mzPreferencesOverride;

  globalThis.window.Capacitor = { isNativePlatform: () => !!isNative };
  if (preferences) {
    globalThis.window.__mzPreferencesOverride = preferences;
  } else {
    delete globalThis.window.__mzPreferencesOverride;
  }
  __resetNativeDetectionForTests();

  return function restore() {
    if (previousCapacitor === undefined) delete globalThis.window.Capacitor;
    else globalThis.window.Capacitor = previousCapacitor;
    if (previousOverride === undefined) delete globalThis.window.__mzPreferencesOverride;
    else globalThis.window.__mzPreferencesOverride = previousOverride;
    if (!hadWindow) delete globalThis.window;
    __resetNativeDetectionForTests();
  };
}

/**
 * installFakeLocalStorage() — a minimal synchronous in-memory localStorage
 * stub (mirrors test/unit/engineAdapter.test.js's `withFakeLocalStorage`).
 * Returns `{ store, restore }` so callers can both seed/inspect the backing
 * Map directly and clean up afterward.
 */
export function installFakeLocalStorage() {
  const store = new Map();
  const previous = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  return {
    store,
    restore() {
      if (previous === undefined) delete globalThis.localStorage;
      else globalThis.localStorage = previous;
    },
  };
}
