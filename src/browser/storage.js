// src/browser/storage.js
//
// The single shared async Storage abstraction (SAV-01..05; 02-RESEARCH.md
// "Persistence Abstraction"). Every later plan writes through this module —
// it is the durable-persistence foundation the whole phase's autosave/resume
// capability rests on. Selects its backend at RUNTIME:
//
//   - native (window.Capacitor?.isNativePlatform() === true): the real
//     `@capacitor/preferences` plugin, reached ONLY via a guarded dynamic
//     import() inside the native branch — never a top-level import — so
//     `node --test` and the plain browser dev loop (which never bootstraps
//     Capacitor) never attempt to resolve the '@capacitor/preferences'
//     specifier. This plan (02-01) installs no Capacitor package at all;
//     that's 02-02's job. `.claude/CLAUDE.md` requires the GAME stay
//     zero-runtime-dep, so this module must never fail to import in an
//     environment without Capacitor installed.
//   - browser/dev/test (isNativePlatform() false/absent): localStorage,
//     wrapped so callers see one uniform async surface.
//
// Every read/write is wrapped to fail safe (never throw, never leave an
// unhandled rejection) — mirrors src/browser/engineAdapter.js's existing
// persist()/boot() posture (a private window, storage quota, or a
// native plugin error all just mean the value doesn't round-trip this time).
//
// CR-01 (02-REVIEW.md): "fail safe" specifically means degrading to a
// WORKING backend, not degrading to a silent no-op. If the native branch
// itself is broken — isNativePlatform() throws, or the
// '@capacitor/preferences' dynamic import (or the plugin call itself)
// throws/rejects at runtime — getItem()/setItem()/removeItem() fall through
// to localStorage rather than returning null / dropping the write forever.
// That decision is memoized for the rest of the session so an
// intermittently-throwing native bridge can't split reads and writes across
// two different backends call-to-call.
//
// A per-key promise-chain write queue serializes writes to the SAME key so a
// burst of rapid same-key setItem() calls (autosave on every action) can
// never let an earlier write settle after a later one and clobber the most
// recent value (02-RESEARCH.md "Async-safe autosave call sites"). flush()
// awaits every outstanding per-key chain so a lifecycle pause/background
// handler (wired in 02-03) can await a full drain before the OS potentially
// suspends the process.
//
// Exposed as window.mzStorage (guarded: only when `window` exists) so the
// non-module classic <script> in mazeworld.html can also reach it — 02-03
// converged both persistence paths onto this one module, closing the
// dual-write hazard 02-RESEARCH.md documents. Phase 44 (DEAD-01/DEAD-03)
// retired the classic script's own save()/load(); Phase 66 (D-14) retired
// its saveGraves()/loadGraves() the same way — engineAdapter.js's
// persist()/boot()/persistGrave()/loadGraveyard() is now the ONE
// run-save-and-graveyard path, and this module is the ONE storage
// abstraction underneath it.

import { validateSave } from "../../engine/saveState.js";

// The three legacy localStorage keys this module's callers converge on
// (src/browser/engineAdapter.js SAVE_KEY/GRAVE_KEY, plus this module's own
// BEST_KEY — ddr.best.v1 is retired in Phase 65: never written or read into
// the bests record, but this migration keeps copying it unchanged — and
// mazeworld.html's own duplicated SAVE_KEY/GRAVE_KEY literals). Defined once
// here so migrateLegacyKeys() below has a single source of truth for which
// keys are in scope for the one-time migration.
const RUN_SAVE_KEY = "ddr.delve.v1";
const BEST_KEY = "ddr.best.v1";
const GRAVE_KEY = "ddr.graveyard.v1";
const LEGACY_KEYS = [RUN_SAVE_KEY, BEST_KEY, GRAVE_KEY];

// key -> a promise chain of already-queued (and always-settled) writes/
// removes for that key. Module-level by design: one write queue per key,
// shared across every caller for the lifetime of the page/process.
const writeQueues = new Map();

// CR-01: once the native-vs-browser backend decision is determined, it is
// cached for the rest of the session (module lifetime) so an
// intermittently-throwing isNativePlatform() can't split reads/writes across
// two different backends call-to-call (a read right after a transient throw
// would otherwise silently look at localStorage while an earlier write went
// to Preferences, or vice versa). Downgraded to `false` permanently the
// moment the native backend proves broken (isNativePlatform() throws, OR a
// later getItem/setItem/removeItem's native branch itself throws/rejects —
// see getItem/setItem/removeItem below) so the module degrades to a working
// backend rather than the previous silent-no-op failure mode. `null` means
// "not yet determined".
let cachedIsNative = null;

function isNative() {
  if (cachedIsNative !== null) return cachedIsNative;
  try {
    cachedIsNative = typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.();
  } catch {
    // isNativePlatform() itself threw — the native bridge is broken. Degrade
    // to localStorage rather than propagating the throw into a silent
    // total-persistence-failure no-op (CR-01).
    cachedIsNative = false;
  }
  return cachedIsNative;
}

/**
 * __resetNativeDetectionForTests() — test-only: clears the memoized
 * native-vs-browser backend decision so each `node --test` case (which
 * installs its own fake `window.Capacitor` via
 * test/persistence/harness/fakePreferences.js's installFakeCapacitor()) starts
 * from a fresh undetermined state rather than inheriting a decision cached by
 * an earlier test sharing this module instance within the same test-file
 * process. Production code never calls this.
 */
export function __resetNativeDetectionForTests() {
  cachedIsNative = null;
}

/**
 * loadNativePreferences() — resolves the native Preferences plugin object
 * (an object with async get/set/remove matching @capacitor/preferences'
 * API). Checks a test-only override hook (`window.__mzPreferencesOverride`,
 * installed by test/persistence/harness/fakePreferences.js) FIRST, so
 * `node --test` can exercise this branch's queueing/JSON/fail-safe behavior
 * without the real `@capacitor/preferences` package installed (it isn't,
 * until 02-02) or any bare `@capacitor/*` specifier ever being resolved by
 * Node. Production code never sets this hook, so a real native launch
 * always falls through to the real dynamic import below.
 */
async function loadNativePreferences() {
  if (typeof window !== "undefined" && window.__mzPreferencesOverride) {
    return { Preferences: window.__mzPreferencesOverride };
  }
  const mod = await import("@capacitor/preferences");
  // CRITICAL: return the plugin wrapped in a plain (non-thenable) object, and
  // destructure it at the call sites — NEVER `return mod.Preferences` from an
  // async function, and never `await` the plugin object directly.
  // `mod.Preferences` is a Capacitor `registerPlugin` Proxy that traps EVERY
  // property access, including `then`. Returning it from an async function (or
  // awaiting it) makes JS Promise adoption invoke `Preferences.then(...)`,
  // which the proxy forwards to the native bridge as a plugin method call →
  // "Preferences.then() is not implemented on android", an uncaught native
  // rejection that fires during boot (device-UAT-found). A plain object
  // wrapper is not a thenable, so it passes through `await` untouched and the
  // real proxy is only ever reached via explicit method calls (.get/.set/...).
  return { Preferences: mod.Preferences };
}

/**
 * enqueue(key, fn) — chains `fn` behind any earlier still-in-flight write/
 * remove for the SAME key, so per-key ordering is preserved regardless of
 * how the underlying async backend actually settles. Swallows a thrown/
 * rejected `fn` so the chain itself never rejects (a failed write just means
 * that write didn't persist — the fail-safe posture this whole module keeps).
 */
function enqueue(key, fn) {
  const prior = writeQueues.get(key) || Promise.resolve();
  const next = prior.then(fn).catch(() => {});
  writeQueues.set(key, next);
  return next;
}

/**
 * getItem(key) — resolves the stored string for `key`, or null if missing,
 * the backend threw/rejected, or (native only) the backend returned a
 * non-string result (defense-in-depth: Preferences' documented contract
 * already guarantees string-or-null, but a caller like
 * engine/saveState.js's validateSave should never be handed a non-string).
 * Reads are NOT queued behind writes — callers that need read-after-write
 * ordering should await the setItem()/removeItem() promise first.
 */
export async function getItem(key) {
  try {
    if (isNative()) {
      try {
        const { Preferences } = await loadNativePreferences();
        const { value } = await Preferences.get({ key });
        return typeof value === "string" ? value : null;
      } catch {
        // CR-01: the native backend just proved broken (the
        // '@capacitor/preferences' dynamic import rejected, or the plugin
        // call itself threw) — degrade to localStorage for the rest of the
        // session and fall through below, rather than returning null forever
        // (a silent, permanent, session-long persistence failure).
        cachedIsNative = false;
      }
    }
    const value = localStorage.getItem(key);
    return typeof value === "string" ? value : null;
  } catch {
    return null;
  }
}

/**
 * setItem(key, value) — queues a write to `key` behind any earlier
 * still-in-flight write/remove to the SAME key. `value` is coerced to a
 * string (Preferences stores strings only; callers JSON.stringify at the
 * boundary, matching engineAdapter.js's existing pattern). Returns the
 * queued promise (always resolves, never rejects) so a caller that needs
 * ordering (e.g. flush(), or a test awaiting the write before reading back)
 * can await it.
 *
 * IN-02: `value === undefined` is a defensive no-op rather than coercing to
 * the literal string `"undefined"`. Every current caller already
 * JSON.stringify()s its payload first (so this isn't reachable today), but a
 * future caller that forgets that step would otherwise silently persist a
 * value indistinguishable from a real save until read back.
 */
export function setItem(key, value) {
  if (value === undefined) return Promise.resolve();
  return enqueue(key, async () => {
    if (isNative()) {
      try {
        const { Preferences } = await loadNativePreferences();
        await Preferences.set({ key, value: String(value) });
        return;
      } catch {
        // CR-01: same fail-safe fallback as getItem() above — degrade to
        // localStorage for the rest of the session rather than silently
        // dropping this write (and every write after it) forever.
        cachedIsNative = false;
      }
    }
    localStorage.setItem(key, String(value));
  });
}

/**
 * removeItem(key) — queued the same way as setItem() so a remove issued
 * mid-burst can't race ahead of an in-flight write to the same key.
 */
export function removeItem(key) {
  return enqueue(key, async () => {
    if (isNative()) {
      try {
        const { Preferences } = await loadNativePreferences();
        await Preferences.remove({ key });
        return;
      } catch {
        // CR-01: same fail-safe fallback as getItem()/setItem() above.
        cachedIsNative = false;
      }
    }
    localStorage.removeItem(key);
  });
}

/**
 * flush() — awaits every outstanding per-key write queue, so a caller (the
 * 02-03 lifecycle pause/background handler) can be sure all in-flight writes
 * have settled before the OS potentially suspends the process. Never
 * throws/rejects (each per-key chain already swallows its own errors).
 *
 * CR-02 (02-REVIEW.md): a single `Promise.all([...writeQueues.values()])`
 * snapshot is NOT a real drain — a same-key write chained onto `writeQueues`
 * AFTER the snapshot is taken (but before the snapshotted promise settles)
 * is not part of what that one snapshot awaits, so flush() could resolve
 * while that later write is still in flight. Loop re-snapshotting
 * `writeQueues` until it stops changing (every entry we just awaited is
 * still the current value for its key) so a write enqueued mid-flush is
 * caught by the next iteration rather than missed entirely.
 *
 * This still cannot see a write that hasn't reached setItem()/removeItem()
 * yet at all (e.g. engineAdapter.js#persistGrave()'s `await getItem()`
 * before its `await setItem()`) — writeQueues only has an entry once
 * enqueue() actually runs. Callers with a read-then-write sequence need
 * their own separate pending-operation tracking that a caller like
 * nativeChrome.js's flushOnBackground() also awaits alongside flush() (see
 * engineAdapter.js's `waitForPending()`).
 */
export async function flush() {
  let snapshot;
  do {
    snapshot = [...writeQueues.entries()];
    await Promise.all(snapshot.map(([, p]) => p));
    // Re-check after awaiting: did any entry we just awaited get replaced
    // (a new write chained onto the same key while we were awaiting) or did
    // a brand-new key show up? If so, loop again — the snapshot was stale.
  } while (snapshot.some(([key, p]) => writeQueues.get(key) !== p) || writeQueues.size !== snapshot.length);
}

/**
 * migrateLegacyKeys() — one-time, idempotent, non-destructive copy of the
 * three legacy keys from localStorage into the abstraction's own backend
 * (Preferences on native) ONLY when the abstraction has no value for that
 * key yet. Never deletes/modifies the localStorage source (matches this
 * module's fail-safe, never-throw posture). The run-save key is validated
 * through engine/saveState.js's validateSave before being accepted — a
 * corrupt/tampered legacy run save is NOT migrated (fail-closed); best-depth
 * and graveyard are copied as-is (validated by their own consumers later, as
 * they already are today in engineAdapter.js/mazeworld.html).
 *
 * Scope note (02-RESEARCH.md "Migration on first native launch"): Android
 * WebView storage is sandboxed per-app/per-origin — a true first native
 * install has never had any prior localStorage inside its own WebView, so
 * there is no external website save to "recover." This migration's real
 * value is narrower: it protects only against THIS PROJECT'S OWN earlier
 * dev/test builds (an emulator/device that ran an early debug build still
 * using raw localStorage before this abstraction existed). On a true first
 * install (localStorage empty) and on every subsequent launch after the
 * first successful migration, this is a no-op. Intended to run once at boot,
 * before the adapter's own load path (wired in 02-03).
 */
export async function migrateLegacyKeys() {
  for (const key of LEGACY_KEYS) {
    try {
      let legacyValue = null;
      try {
        legacyValue = localStorage.getItem(key);
      } catch {
        legacyValue = null;
      }
      if (typeof legacyValue !== "string") continue; // nothing to migrate for this key

      const existing = await getItem(key);
      if (existing !== null) continue; // already migrated (or already has a value) — copy-if-empty only

      if (key === RUN_SAVE_KEY) {
        const check = validateSave(legacyValue);
        if (!check.ok) continue; // fail-closed: never migrate a corrupt/tampered run save
      }

      await setItem(key, legacyValue);
    } catch {
      // Never throw — a migration failure for one key just means that key
      // stays un-migrated this launch, matching this module's overall
      // fail-safe posture (mirrors persist()'s try/catch-and-swallow pattern
      // in engineAdapter.js).
    }
  }
}

if (typeof window !== "undefined") {
  window.mzStorage = { getItem, setItem, removeItem, flush, migrateLegacyKeys };
}
