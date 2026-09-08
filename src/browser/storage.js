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
// persist()/boot()/getBest() posture (a private window, storage quota, or a
// native plugin error all just mean the value doesn't round-trip this time).
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
// converges both persistence paths (the classic script's save()/load()/
// saveGraves()/loadGraves() AND engineAdapter.js's persist()/boot()/
// persistGrave()/getBest()/recordBest()) on this one module, closing the
// dual-write hazard 02-RESEARCH.md documents.

// key -> a promise chain of already-queued (and always-settled) writes/
// removes for that key. Module-level by design: one write queue per key,
// shared across every caller for the lifetime of the page/process.
const writeQueues = new Map();

function isNative() {
  return typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.();
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
    return window.__mzPreferencesOverride;
  }
  const mod = await import("@capacitor/preferences");
  return mod.Preferences;
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
      const Preferences = await loadNativePreferences();
      const { value } = await Preferences.get({ key });
      return typeof value === "string" ? value : null;
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
 */
export function setItem(key, value) {
  return enqueue(key, async () => {
    if (isNative()) {
      const Preferences = await loadNativePreferences();
      await Preferences.set({ key, value: String(value) });
      return;
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
      const Preferences = await loadNativePreferences();
      await Preferences.remove({ key });
      return;
    }
    localStorage.removeItem(key);
  });
}

/**
 * flush() — awaits every outstanding per-key write queue, so a caller (the
 * 02-03 lifecycle pause/background handler) can be sure all in-flight writes
 * have settled before the OS potentially suspends the process. Never
 * throws/rejects (each per-key chain already swallows its own errors).
 */
export async function flush() {
  await Promise.all([...writeQueues.values()]);
}

// migrateLegacyKeys() lands in the next commit (02-01 Task 3) — kept out of
// this one so Task 2's commit is scoped exactly to storage.test.js's GREEN
// (get/set/remove/flush), matching the plan's task-by-task TDD sequence.

if (typeof window !== "undefined") {
  window.mzStorage = { getItem, setItem, removeItem, flush };
}
