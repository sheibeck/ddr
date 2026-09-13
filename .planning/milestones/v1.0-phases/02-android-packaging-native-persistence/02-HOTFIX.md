# 02-HOTFIX — Capacitor plugin ESM boot failure (stuck on splash)

**Found by:** device UAT on a real Pixel 7 (`panther`, wireless adb), app id
`com.darktierstudios.mazeworld`. The debug APK installed and launched but was
**stuck on the splash screen** — the WebView booted but the module script that
calls `SplashScreen.hide()` and boots the game never completed.

## Root causes (two independent boot-time defects)

### 1. Extensionless relative ESM specifiers → MIME `text/html` module-load failure

`tools/build-www.mjs` vendors each `@capacitor/*` plugin's pre-built ESM into
`www/vendor/@capacitor/<pkg>/` and loads it via an import map (no bundler). The
vendored plugin ESM (`dist/esm/*.js`) ships **extensionless** relative
specifiers, e.g. `export * from './definitions'` and
`() => import('./web')`. In the Android WebView a request for
`https://localhost/vendor/@capacitor/preferences/definitions` (no `.js`) misses
on disk, so Capacitor's local server falls back to `index.html`
(MIME `text/html`). The browser rejects the module script:

> Failed to load module script: Expected a JavaScript-or-Wasm module script but
> the server responded with a MIME type of text/html.

That throw aborted boot for every plugin (`preferences`, `splash-screen`,
`status-bar`, `screen-orientation`, `app`). `@capacitor/core/index.js` itself
loaded fine (it is a self-contained bundle with no relative imports); only the
plugins' `./definitions` / `./web` sub-imports failed.

### 2. Awaiting the plugin Proxy → `Preferences.then() is not implemented on android`

After fix #1 resolved the MIME error, a second boot error surfaced on-device:

> Uncaught (in promise) Error: "Preferences.then()" is not implemented on android

`src/browser/storage.js`'s `loadNativePreferences()` was
`async function … { … return mod.Preferences; }`, and the three call sites did
`const Preferences = await loadNativePreferences();`. A Capacitor
`registerPlugin` object is a **Proxy that traps every property access, including
`then`**. Returning it from an `async` function (or `await`-ing it) makes JS
Promise adoption invoke `Preferences.then(resolve, reject)`, which the proxy
forwards to the native bridge as a plugin method call → native "not implemented"
rejection at boot. The `node --test` fake is a plain object (no `then` trap), so
this passed CI but only failed on a real device. The identical latent defect
existed in `src/browser/nativeChrome.js`'s `loadApp()`
(`return (await import('@capacitor/app')).App;` from an `async` fn) — it was
masked by a surrounding `try/catch` but would silently kill back-button /
lifecycle wiring on device.

## Fix

**`tools/build-www.mjs`** — after vendoring each package's full `dist/esm` tree,
walk the vendored `.js` files and rewrite every **relative** import/export
specifier to add an explicit `.js` extension (`./definitions` → `./definitions.js`,
`./web` → `./web.js`). Handles static `import … from`, `export … from`,
side-effect `import '…'`, and dynamic `import('…')`. Bare specifiers
(`@capacitor/core`) are left untouched so they keep resolving through the
document import map (bare specifiers in nested modules resolve against the
document's import map — fine).

**`src/browser/storage.js`** — `loadNativePreferences()` now returns the plugin
wrapped in a plain (non-thenable) object `{ Preferences }`; the three call sites
destructure `const { Preferences } = await loadNativePreferences();`. The proxy
is never itself passed through `await`, so Promise adoption never calls
`.then()` on it — it is only reached via explicit `.get()/.set()/.remove()`.

**`src/browser/nativeChrome.js`** — `loadApp()` returns `{ App }` the same way;
the caller destructures `({ App } = await loadApp(injectedApp));`.

Both changes keep the game **zero-runtime-dependency** (guarded dynamic import,
no bundler, no new npm runtime dep), and the test-only override hooks
(`window.__mzPreferencesOverride`, `globalThis.__mzAppImportOverride`) keep
working unchanged (wrapped internally).

## Device verification (Pixel 7, clean cold boot)

- `npm run build:www` → `npx cap sync android` → `node tools/pin-jdk.mjs` →
  `gradlew.bat assembleDebug`: **BUILD SUCCESSFUL, exit 0**.
- `adb install -r …/app-debug.apk`: **Success**.
- Cold boot logcat:
  - **No** "Failed to load module script … MIME type of text/html" (fix #1).
  - **No** `Preferences.then() is not implemented` (fix #2).
  - `SplashScreen … methodName: hide` — the native splash is dismissed.
  - `Preferences … methodName: get {"key":"mazeworld.delve.v1"}` — the game
    loads its save through the **native** Preferences backend; subsequent
    `Preferences … methodName: set` autosave calls stream continuously =
    live, playing gameplay with durable native persistence.
  - `App … addListener {"eventName":"backButton"}` succeeds — the `loadApp`
    fix restores back-button/lifecycle wiring.
- `node --test`: **372/372 passing** (no regression).

Note: one intermittent, non-fatal early-boot race
(`TypeError: … reading 'triggerEvent'`, from Capacitor's native-bridge event
injection firing before the ESM core finishes wiring `window.Capacitor`) was
observed on one launch and did **not** reproduce on a subsequent clean cold
boot. It does not block boot (the app reaches playable gameplay regardless) and
is unrelated to the two defects fixed here.
