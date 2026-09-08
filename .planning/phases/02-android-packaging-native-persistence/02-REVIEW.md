---
phase: 02-android-packaging-native-persistence
reviewed: 2026-09-08T00:00:00Z
depth: deep
files_reviewed: 8
files_reviewed_list:
  - src/browser/storage.js
  - src/browser/nativeChrome.js
  - src/browser/engineAdapter.js
  - mazeworld.html
  - tools/build-www.mjs
  - tools/pin-jdk.mjs
  - capacitor.config.json
  - engine/saveState.js
findings:
  critical: 3
  high: 0
  medium: 2
  low: 3
  total: 8
status: findings
fixed_at: 2026-09-08T17:30:00Z
fix_status: partial
fixed: 7
not_fixed: 1
---

## Fix Disposition (2026-09-08)

Applied by the gsd-code-fixer, one atomic commit per finding, on branch
`gsd-reviewfix/02-<pid>` (fast-forwarded onto `master`). `node --test` was
363 passing before any fix and is 372 passing after all fixes (9 new
regression tests: 2 for CR-01, 2 for CR-02, 3 for CR-03, 1 for WR-02, 1 for
IN-02).

| ID | Disposition | Commit |
|----|-------------|--------|
| CR-01 | **fixed** — `storage.js` now falls back to `localStorage` when `isNativePlatform()` throws or the native Preferences backend throws/rejects, memoized per session via a test-only reset hook. 2 regression tests added (`storage.test.js`). | `c9a29d9` |
| CR-02 | **fixed** — `flush()` now loops until `writeQueues` is stable (catches a same-key write chained in mid-flush); `engineAdapter.js` adds `track()`/`waitForPending()` so a write still in its pre-`setItem()` read phase (`persistGrave()`) is also caught; `nativeChrome.js`'s `flushOnBackground()`/`registerNativeChrome()` await `waitForPending` alongside `storage.flush()`; wired at the `mazeworld.html` call site. 2 regression tests added (new `test/persistence/flush-drain.test.js`). | `c1cfa10` |
| CR-03 | **fixed** — splash-hide/status-bar/orientation chrome now runs BEFORE the `@capacitor/app` import in `registerNativeChrome()`; the import itself is guarded the same way as the other three plugins (returns early on failure rather than throwing); the `mazeworld.html` call site adds a defense-in-depth `.catch()`. 3 regression tests added (`lifecycle.test.js`). | `c9ba389` |
| WR-01 | **fixed** — `tools/pin-jdk.mjs`'s `JAVA_HOME`-unset error message now says Temurin 21 (matching the file's own header) instead of the superseded Temurin 17 / 02-RESEARCH.md reference. No test (message-only, no existing coverage of this file). | `f621204` |
| WR-02 | **fixed** — `registerNativeChrome()` now guards against a second invocation in the same process registering a duplicate listener set, via a module-level idempotency flag plus a test-only reset hook wired into `lifecycle.test.js`'s `beforeEach`. 1 regression test added. | `6121a4e` |
| IN-01 | **fixed** — added a one-line comment on the `confirmTimer.unref` dead-code branch clarifying it's `node --test`-runner-only. No behavioral test needed (comment-only). | `531d603` |
| IN-02 | **fixed** — `storage.js#setItem(key, undefined)` is now a defensive `Promise.resolve()` no-op instead of coercing to the literal string `"undefined"`. 1 regression test added. | `531d603` |
| IN-03 | **not fixed** — `tools/build-www.mjs`'s `vendorCapacitorPackages()` still copies each `@capacitor/*` package's whole `dist`/`dist/esm` directory rather than just the referenced ESM subtree. The review itself scopes this as a packaging-size concern, "Not required for this phase" — restricting the copy correctly requires resolving each package's actual `module`/`exports` target per-package (risk of under-copying and breaking the runtime import map if done hastily) rather than a small, safe, mechanical change; deferred to a dedicated pass rather than rushed into this fix session. Build gate (below) confirms the current (unoptimized) vendoring still produces a working APK. | not fixed |

### Test suite

`node --test` (full suite): 363 passing before any fix -> **372 passing**
after all fixes (9 new regression tests, 0 removed, 0 skipped).

### Build gate (re-run after all fixes)

```
npm run build:www          -> vendored 6 @capacitor/* packages, wrote www/index.html
npx cap sync android       -> found 5 Capacitor plugins, sync finished in 1.7s
node tools/pin-jdk.mjs     -> org.gradle.java.home -> C:/Users/Dell/.jdk/jdk-21.0.12.1+1
cd android && gradlew.bat assembleDebug
  -> BUILD SUCCESSFUL in 1m 32s (243 actionable tasks: 243 executed)
  -> exit code 0
  -> android/app/build/outputs/apk/debug/app-debug.apk present (6,715,765 bytes)
```

App still compiles cleanly with all 3 CRITICAL + 4 of 5 remaining fixes
applied. No emulator was launched (out of scope per fixer instructions).



# Phase 2: Android Packaging & Native Persistence — Code Review Report

**Reviewed:** 2026-09-08
**Depth:** deep (per-file + cross-file async/lifecycle tracing)
**Files Reviewed:** 8
**Status:** findings

## Summary

The persistence abstraction, migration, and lifecycle wiring are well-documented and largely sound: `migrateLegacyKeys()` is genuinely idempotent and fail-closed (verified by direct trace and by `storage-migration.test.js`), the dual-write hazard for *which backend/key* both scripts hit is closed (both `mazeworld.html`'s classic script and `engineAdapter.js` route exclusively through `window.mzStorage` — grep-confirmed zero raw `localStorage.*Item` calls outside `storage.js`), boot ordering correctly sequences migration before both boot paths, and `decideBackAction` is a provably-safe pure function with no silent-exit path.

However, three **critical** gaps survive the unit-test suite because the suite never exercises the specific failure/race conditions that break them, all inside the exact code paths this phase says are the highest-value thing to get right:

1. `storage.js` has **no fallback to `localStorage`** when the native branch itself is broken (native-platform detection throws, or the `@capacitor/preferences` dynamic import rejects) — the module fails to *total silent no-op* instead of degrading to a working backend, meaning every read looks like "no save" and every write silently vanishes for the rest of the session.
2. `flush()` does **not** actually guarantee a full drain of in-flight persistence work — it snapshots the write-queue Map at call time, which misses (a) any write still in its pre-`setItem()` async phase (concretely, `engineAdapter.js#persistGrave()`'s `await getItem()` before its `await setItem()`), and (b) a same-key write chained onto an already-snapshotted promise. Both scenarios can make `flushOnBackground()` resolve "successfully" while the actual write for the player's last action (or death) is still in flight when the OS suspends the process.
3. `registerNativeChrome()`'s `@capacitor/app` import is unguarded — if it rejects, the function throws before ever reaching the `SplashScreen`/`StatusBar`/`ScreenOrientation` setup below it, and (given `launchAutoHide: false`) the splash screen is then **never explicitly hidden**, permanently soft-locking the app on the splash screen even though the WebView underneath is fully loaded and playable. The call site in `mazeworld.html` also doesn't catch this rejection, so it becomes a silent unhandled promise rejection.

None of the three is covered by the existing 363-test suite — each requires simulating a failure mode (a throwing/rejecting dependency, or a specific interleaving) that no test currently constructs. The migration logic, the classic/engine dual-write convergence for the storage *backend*, and the back-button decision logic are all solid and don't need rework.

## Critical Issues

### CR-01: `storage.js` has no fallback path when the native backend itself is broken — silent total persistence failure

**File:** `src/browser/storage.js:57-59, 103-115, 126-150`

**Issue:** `isNative()` is:
```js
function isNative() {
  return typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.();
}
```
Optional chaining (`?.()`) only guards against `window.Capacitor` or `.isNativePlatform` being `null`/`undefined` — it does **not** catch an exception thrown *by* `isNativePlatform()` itself. If that call throws (a real scenario named in this phase's own review scope), or if `loadNativePreferences()`'s `await import("@capacitor/preferences")` rejects (e.g. a broken vendored import-map path, a stale WebView asset cache), the failure propagates into:
- `getItem()` — caught by its outer `try/catch`, but the `catch` unconditionally `return null`, never falling back to `localStorage`.
- `setItem()`/`removeItem()` — the throw happens inside the `async () => {...}` closure passed to `enqueue()`; `enqueue()`'s `.catch(() => {})` swallows it, again with **no fallback**, just a silently-dropped write.

The result is not a crash (good) but also not the documented "fail-safe" behavior — it's **total, silent, permanent persistence failure for the rest of the session**: every `getItem()` call returns `null` (indistinguishable from "no save exists"), so `boot()` will discard the player's real save and start a fresh run on every single launch, and every `setItem()`/`removeItem()` becomes a no-op. There is nothing to alert the player or telemetry — the app just quietly stops persisting, which for a native-storage-is-supposed-to-be-*more*-durable-than-localStorage feature is the worst possible failure mode. `isNative()` is also re-evaluated on every call rather than memoized, so an intermittently-throwing check could even split reads/writes across two different backends over a session.

This exact scenario ("what if `window.Capacitor` exists but `isNativePlatform()` throws or the Preferences import fails at runtime — does it fail-safe to localStorage or hard-crash?") is not covered by any test in `test/persistence/` — `storage.test.js`'s "never throw" tests only exercise a `Preferences.get/set/remove` that throws, never `isNativePlatform()` itself throwing or the dynamic `import()` rejecting.

**Fix:** Wrap the native-branch failure specifically and fall back to the browser branch rather than swallowing to a no-op:
```js
async function isNativeSafe() {
  try {
    return typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.();
  } catch {
    return false; // degrade to localStorage rather than a silent black hole
  }
}

export async function getItem(key) {
  try {
    if (await isNativeSafe()) {
      try {
        const Preferences = await loadNativePreferences();
        const { value } = await Preferences.get({ key });
        return typeof value === "string" ? value : null;
      } catch {
        // native backend broken this call — fall through to localStorage
      }
    }
    const value = localStorage.getItem(key);
    return typeof value === "string" ? value : null;
  } catch {
    return null;
  }
}
```
Apply the same "catch the native branch specifically, then fall through to `localStorage`" pattern in `setItem`/`removeItem`. At minimum, memoize a successful `isNative()` determination once per session so behavior doesn't flap between backends call-to-call.

### CR-02: `flush()` does not guarantee draining all pending writes — the graveyard/last-action write can be lost on backgrounding

**File:** `src/browser/storage.js:158-160`, `src/browser/engineAdapter.js:127-136, 208-231`, `src/browser/nativeChrome.js:65-72, 151-154`

**Issue:** `flush()` is:
```js
export async function flush() {
  await Promise.all([...writeQueues.values()]);
}
```
This is a **point-in-time snapshot**, not a real drain loop. Two concrete ways it fails to await a write that's genuinely still in flight when a backgrounding event fires:

1. **A write that hasn't reached `setItem()` yet is invisible to `flush()`.** `engineAdapter.js#persistGrave()` (called fire-and-forget from `dispatch()` on every `died` event, line 230: `if (diedEvent) persistGrave(currentState, diedEvent.cause);`) does an `await storage.getItem(GRAVE_KEY)` **before** its `await storage.setItem(GRAVE_KEY, ...)`. Only the latter call registers an entry in `writeQueues`. If the OS delivers `pause`/`appStateChange(inactive)` while `persistGrave()` is still awaiting its `getItem()` round-trip (a real Capacitor Preferences bridge call, not instant) — a completely ordinary scenario, since a player who just died is a very plausible moment to background/quit the app — `flush()`'s snapshot contains nothing for `GRAVE_KEY` yet. `flushOnBackground()` resolves "successfully," the OS may then suspend/kill the process, and `persistGrave()`'s in-flight execution is abandoned before it ever calls `setItem()`. **The death tombstone is permanently lost — a direct SAV-05 violation**, and it happens in exactly the moment (right after a death) that this phase's own lifecycle-flush design exists to protect.
2. **A same-key write enqueued while `flush()`'s `Promise.all` is already in flight is not awaited either.** `enqueue()` updates `writeQueues.set(key, next)` synchronously, but `flush()` only awaits the array it captured at call time. If a second `setItem()` to the same key lands after that snapshot but before the snapshotted promise settles, the new promise (chained after the old one) is not part of what `flush()` awaits.

Both scenarios directly contradict `flush()`'s own doc comment ("awaits every outstanding per-key write queue... so a caller can be sure all in-flight writes have settled") and `nativeChrome.js`'s doc comment calling the awaited-flush guarantee "the single most safety-critical async-ordering concern in the whole persistence design." No test in `test/persistence/lifecycle.test.js` or `storage.test.js` constructs either race — `flush()` itself has no dedicated test file at all.

**Fix:** Loop until the snapshot is stable, and/or make the read-then-write callers register their pending operation before the read starts:
```js
export async function flush() {
  let snapshot;
  do {
    snapshot = [...writeQueues.entries()];
    await Promise.all(snapshot.map(([, p]) => p));
  } while (snapshot.some(([k, p]) => writeQueues.get(k) !== p));
}
```
That alone still doesn't fix case 1 (the write hasn't been enqueued at all yet). For `persistGrave()`/similar read-then-write callers, either (a) have `dispatch()` await `persistGrave()` before returning (makes `dispatch()` async — a bigger call-site change), or (b) give `engineAdapter.js` its own tracked-pending-operations set that `nativeChrome.js`'s `flushOnBackground` also awaits alongside `storage.flush()`, e.g.:
```js
// engineAdapter.js
const pending = new Set();
function track(p) { pending.add(p); p.finally(() => pending.delete(p)); return p; }
export async function waitForPending() { await Promise.all(pending); }
// dispatch(): if (diedEvent) track(persistGrave(currentState, diedEvent.cause));
```
and have `registerNativeChrome`'s pause/appStateChange handlers await both `storage.flush()` and `engineAdapter.waitForPending()`.

### CR-03: `registerNativeChrome()`'s unguarded `@capacitor/app` import can permanently soft-lock the app on the splash screen

**File:** `src/browser/nativeChrome.js:101`, `mazeworld.html:3458-3481`

**Issue:**
```js
export async function registerNativeChrome({ App: injectedApp, ... } = {}) {
  const App = injectedApp || (await import("@capacitor/app")).App;   // <-- not wrapped in try/catch
  ...
  App.addListener("backButton", ...);
  App.addListener("pause", ...);
  App.addListener("appStateChange", ...);
  try { const SplashScreen = ... await SplashScreen?.hide?.(); } catch {}
  try { const StatusBar = ... } catch {}
  try { const ScreenOrientation = ... } catch {}
}
```
Every other plugin load in this function (`SplashScreen`, `StatusBar`, `ScreenOrientation`) is individually wrapped in its own `try/catch` specifically so one broken plugin doesn't take down the others. The `@capacitor/app` import at the top is not. If it rejects (broken vendored import-map entry, a WebView asset issue, any runtime failure unrelated to the other three plugins), `registerNativeChrome()` throws immediately and **never reaches** the `SplashScreen.hide()` call below it.

Because `capacitor.config.json` sets `"launchAutoHide": false` (deliberately, so the splash hides only once boot completes rather than on a fixed timer — see `nativeChrome.js`'s own comment), nothing else in the app ever calls `SplashScreen.hide()`. The practical effect: the native splash screen is shown forever, even though the WebView has fully booted and the game is playable underneath it — the app appears completely frozen to the user. The back-button and lifecycle (pause/appStateChange) listeners also never get registered in this failure mode, silently reintroducing PLT-02/PLT-03 regressions.

Compounding this, the call site in `mazeworld.html` doesn't catch the rejection either:
```js
if (window.Capacitor?.isNativePlatform?.()) {
  registerNativeChrome({ storage: window.mzStorage, getGameContext: () => ({...}) });
}
```
No `.catch()`, no `await`/`try` — a rejection here becomes an unhandled promise rejection with no user-visible signal beyond the permanently-visible splash screen.

**Fix:** Wrap the `App` import (and ideally the whole function body) defensively, and make the splash-hide independent of the App plugin's availability:
```js
export async function registerNativeChrome({ App: injectedApp, SplashScreen: injectedSplashScreen, ... } = {}) {
  // Hide the splash and set up chrome FIRST, independent of @capacitor/app.
  try {
    const SplashScreen = injectedSplashScreen || (await import("@capacitor/splash-screen")).SplashScreen;
    await SplashScreen?.hide?.();
  } catch { /* non-fatal */ }
  // ...StatusBar/ScreenOrientation as today...

  let App;
  try {
    App = injectedApp || (await import("@capacitor/app")).App;
  } catch {
    return; // back-button/lifecycle wiring unavailable this launch; chrome above already ran
  }
  App.addListener("backButton", ...);
  App.addListener("pause", ...);
  App.addListener("appStateChange", ...);
}
```
And at the call site in `mazeworld.html`, add a `.catch()` (or wrap in `try { await registerNativeChrome(...) } catch {}`) as defense in depth.

## Warnings

### WR-01: `tools/pin-jdk.mjs`'s error message references the wrong JDK version

**File:** `tools/pin-jdk.mjs:42-43`

**Issue:** The file header documents that the pinned JDK is now **Temurin 21** (a deviation from `02-RESEARCH.md`'s original JDK 17 guidance, because `capacitor-android`'s own `build.gradle` requires Java 21 source/target compatibility). But the thrown error when `JAVA_HOME` is unset still says:
```js
throw new Error(
  "JAVA_HOME is not set — export it to the Temurin 17 install path before running this script " +
    "(see 02-RESEARCH.md \"The JDK 25 incompatibility\")",
);
```
A developer hitting this error (e.g. after a fresh clone, or on CI) would follow this message toward installing/pointing at Temurin 17, which per this same file's own header comment will fail to compile (`capacitor-android`'s release-21 requirement) — sending them down a dead end that the code's own comments already know is wrong.

**Fix:** Update the message to reference Temurin 21 and this file's own header note rather than the (superseded) research doc quote:
```js
throw new Error(
  "JAVA_HOME is not set — export it to the Temurin 21 install path before running this script " +
    "(see this file's header comment: capacitor-android's build.gradle requires Java 21 source/target compatibility)",
);
```

### WR-02: `registerNativeChrome()` has no guard against duplicate registration

**File:** `src/browser/nativeChrome.js:93-183`

**Issue:** If `registerNativeChrome()` were ever invoked a second time in the same page/process lifetime (e.g. a future refactor that re-runs the trailing bootstrap module, or a WebView reload path), it would register a second `backButton`/`pause`/`appStateChange` listener set with its own independent `confirming`/`confirmTimer` closure state, causing every lifecycle event to fire twice (double-flush is harmless, but a double-fired `backButton` handler could show two confirm prompts or call `exitApp()` twice). Today's single call site (`mazeworld.html`, gated by `isNativePlatform()`, executed exactly once per module evaluation) makes this latent rather than active, but nothing in the function itself protects against it.

**Fix:** A cheap idempotency guard, e.g. a module-level flag:
```js
let registered = false;
export async function registerNativeChrome(opts = {}) {
  if (registered) return;
  registered = true;
  ...
}
```

## Info

### IN-01: `confirmTimer.unref` check is dead code in the browser

**File:** `src/browser/nativeChrome.js:135-136`

**Issue:** `if (typeof confirmTimer.unref === "function") confirmTimer.unref();` guards a Node.js-only `Timeout.unref()` API. In a browser/WebView, `setTimeout()` returns a plain numeric ID with no `.unref` method, so this branch is always false at runtime in production and only exists to keep `node --test` from leaving a hanging timer. Harmless, but slightly misleading to a reader unfamiliar with why it's there (no comment explains it's test-runner-only).

**Fix:** Optional — a one-line comment (`// Node's node --test runner only; browsers' setTimeout ids have no .unref`) would remove the ambiguity for a future reader.

### IN-02: `setItem`/`removeItem` silently coerce `undefined` to the string `"undefined"`

**File:** `src/browser/storage.js:126-135`

**Issue:** `setItem(key, value)` does `String(value)` unconditionally. Every current call site already `JSON.stringify()`s its payload first, so this isn't reachable today, but a future caller passing `undefined` directly (e.g. a refactor that forgets the `JSON.stringify` step) would silently persist the literal string `"undefined"` rather than failing loudly — which would then likely pass through `validateSave`'s `JSON.parse` as a parse error (caught, fails closed) rather than crash, so the blast radius is limited, but it's a latent footgun worth a defensive check.

**Fix:** Low priority — could add `if (value === undefined) return Promise.resolve();` as a defensive no-op, or leave as-is given current callers are all correct.

### IN-03: `www/vendor/@capacitor/*` vendors entire `dist`/`dist/esm` directories, not just the referenced entry file

**File:** `tools/build-www.mjs:101-128`

**Issue:** `vendorCapacitorPackages()` recursively copies the whole directory containing each package's `module` entry point (e.g. all of `@capacitor/core`'s `dist/`, which likely includes both ESM and CJS/UMD builds plus `.d.ts` files) into the shipped `www/vendor/` tree, rather than just the ESM subtree actually referenced by the import map. This is explicitly a packaging-size concern, not a correctness one (out of this review's stated performance/size scope), but is worth a note since it means the APK ships more JS than the app ever loads.

**Fix:** Not required for this phase; if revisited, restrict the copy to the specific ESM directory each `module`/`exports` field resolves to rather than its parent.

---

_Reviewed: 2026-09-08_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
