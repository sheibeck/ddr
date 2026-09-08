---
phase: 02-android-packaging-native-persistence
verified: 2026-09-08T16:39:45Z
status: human_needed
score: 4/4 must-haves verified (code/build tier); 5 items deferred to device UAT (expected per 02-VALIDATION.md three-tier model)
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Install android/app/build/outputs/apk/debug/app-debug.apk on an emulator/device, launch it"
    expected: "App installs, launches, shows the branded splash screen, is portrait-locked, status bar matches the parchment theme, launcher icon renders correctly"
    why_human: "Real WebView compositing, real OS orientation enforcement, and visual rendering cannot be exercised headlessly under node --test or a Gradle build"
  - test: "Press the Android hardware/gesture back button mid-run on device"
    expected: "First press shows confirm-before-quit (or closes a modal / navigates back if one is open); the run is never silently ended by a single back press"
    why_human: "Real @capacitor/app backButton event dispatch and real hardware/gesture input cannot be exercised headlessly; decideBackAction's pure decision logic is unit-proven (test/persistence/back-button-logic.test.js), but the actual native event wiring needs a device"
  - test: "Background the app, force-stop it, and reopen it mid-run"
    expected: "The run resumes exactly where the player left off (same floor, HP, inventory, position)"
    why_human: "Real OS lifecycle timing (pause/appStateChange dispatch, process suspension/kill) cannot be exercised headlessly; flushOnBackground's awaited-flush guarantee is unit-proven (test/persistence/lifecycle.test.js), but real OS suspension timing needs a device"
  - test: "Play a run, restart the app (not just background — a full app restart), confirm run state, best depth, and graveyard are all still present"
    expected: "All three survive the restart, read from durable native Preferences storage (not evictable localStorage)"
    why_human: "Real native Preferences plugin durability and Android storage-eviction behavior cannot be exercised headlessly; the storage abstraction's backend-selection, versioning, and integrity-check logic is unit-proven (test/persistence/storage.test.js, storage-migration.test.js), but actual on-device durability needs a device"
  - test: "Enable airplane mode, cold-launch the app, confirm fonts render correctly (Special Elite / Crimson Pro / IBM Plex Mono, not a system-font fallback) and the game is playable with zero network"
    expected: "Fonts load from the self-hosted www/fonts/*.woff2 bundle with no network requests; no visual fallback-font flash"
    why_human: "Real network isolation and font-rendering fidelity cannot be verified by grep alone; the absence of any fonts.googleapis.com/fonts.gstatic.com reference is grep-verified above (necessary but not sufficient for visual proof)"
---

# Phase 2: Android Packaging & Native Persistence Verification Report

**Phase Goal:** The game runs as an installable native Android app (via Capacitor) that autosaves durably and resumes exactly where the player left off, surfacing signing/storage/lifecycle problems early while there is still schedule slack.
**Verified:** 2026-09-08T16:39:45Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Verification Model

This phase's own validation strategy (`02-VALIDATION.md`) defines three tiers, and this report follows that model rather than treating deferred device UAT as a gap:

1. **Unit-testable logic** — the Storage abstraction, migration, dual-write convergence, back-button decision function, lifecycle-flush await — verified via `node --test`.
2. **Build-gate (compile proof)** — a real headless Gradle build produces `app-debug.apk` and `app-debug.aab`.
3. **Deferred device UAT** — native/OS behavior (real WebView rendering, real hardware back-press, real OS backgrounding/kill, real Preferences durability, real airplane-mode isolation) that genuinely cannot be exercised without an emulator/device. These are NOT failures — they are the expected, explicitly-scoped output of this phase per 02-VALIDATION.md and are listed below as human-verification items.

## Goal Achievement

### Observable Truths

| # | Truth | Tier | Status | Evidence |
|---|-------|------|--------|----------|
| 1 | Game installs/launches as a native Android app (AAB via Capacitor) with splash/status-bar/portrait configured | build-gate + config | ✓ VERIFIED (compile+config); device-visual DEFERRED | `app-debug.aab` (6,160,112 bytes) and `app-debug.apk` (6,737,568 bytes) present under `android/app/build/outputs/`; `android:screenOrientation="portrait"` in AndroidManifest.xml; `capacitor.config.json` SplashScreen block present; 5-density `drawable-*/splash_screen.webp` present; `mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}` + `mipmap-anydpi-v26` present |
| 2 | Back button never silently ends a run (confirm-before-quit / nav) | unit-testable | ✓ VERIFIED (logic); real hardware-press DEFERRED | `decideBackAction` (src/browser/nativeChrome.js:42-54) read directly — the only paths to `"exit-app"` are `alreadyConfirming===true` or `hasLiveRun===false`; a live unconfirmed run can never reach exit-app in one press. `test/persistence/back-button-logic.test.js` unit-proves this (7 tests, all passing) |
| 3 | Background/force-close/reopen resumes exactly (save every action + on lifecycle interruption) | unit-testable | ✓ VERIFIED (logic); real OS lifecycle DEFERRED | `flushOnBackground` (nativeChrome.js:65-72) awaits `storage.flush()`; `registerNativeChrome` wires it to both `pause` and `appStateChange(inactive)` listeners (nativeChrome.js:151-154); `engineAdapter.js`'s `persist()`/`persistGrave()` enqueue through `storage.js`'s per-key write queue on every `dispatch()`. `test/persistence/lifecycle.test.js` (7 tests) and `test/unit/engineAdapter.test.js` unit-prove this |
| 4 | Run state, best depth, graveyard in durable native storage (Preferences, not localStorage) with versioned schema + integrity; survive restart | unit-testable | ✓ VERIFIED (logic); real device durability DEFERRED | `src/browser/storage.js` selects `@capacitor/preferences` via a guarded dynamic `import()` only inside the native branch (never a top-level/static import — grep-confirmed zero matches for `import.*@capacitor` anywhere under `src/`); `migrateLegacyKeys()` validates the run save through `engine/saveState.js#validateSave` (fail-closed on corrupt data) before migrating; `engineAdapter.js` has zero raw `localStorage.*Item` calls (grep-confirmed); `mazeworld.html`'s classic `save()`/`load()`/`saveGraves()`/`loadGraves()` all route through `window.mzStorage` (lines 3011, 3016, 3262, 3268, 3301). `test/persistence/storage.test.js` (11), `storage-migration.test.js` (6), `dual-write-convergence.test.js` (6) unit-prove this |

**Score:** 4/4 code-tier truths verified with direct evidence (not just SUMMARY claims). 0 behavior-unverified (state-transition invariants — back-button non-silent-exit, awaited-flush-before-resolve — ARE covered by passing unit tests exercising the actual transition, not just presence). 5 device-UAT items remain, all explicitly scoped as deferred by 02-VALIDATION.md.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/browser/storage.js` | Async Storage abstraction, runtime backend selection, write queue, migration | ✓ VERIFIED | Read in full: guarded dynamic import (line 76), per-key write queue (`enqueue`, lines 87-92), `flush()` awaits all outstanding chains, `migrateLegacyKeys()` fail-closed via `validateSave` |
| `src/browser/nativeChrome.js` | `decideBackAction`, `flushOnBackground`, `registerNativeChrome` | ✓ VERIFIED | Read in full: pure decision fn with no silent-exit path; awaited flush; injectable + dynamic-import-guarded plugin wiring for App/SplashScreen/StatusBar/ScreenOrientation |
| `src/browser/engineAdapter.js` | Routes persist/boot/getBest through storage.js, no raw localStorage | ✓ VERIFIED | `import * as storage from "./storage.js"` (line 29); grep for `localStorage\.\w+Item` returns zero matches |
| `mazeworld.html` (classic script) | save/load/saveGraves/loadGraves route through window.mzStorage; migrateLegacyKeys runs at boot | ✓ VERIFIED | Lines 3011/3016 (graveyard), 3262/3268/3301 (save/load), line 3402 (`await window.mzStorage.migrateLegacyKeys()`), line 3459-3460 (`registerNativeChrome({ storage: window.mzStorage, ... })`) |
| `capacitor.config.json` | appId, webDir, SplashScreen plugin config | ✓ VERIFIED | appId `com.darktierstudios.mazeworld`, webDir `www`, `androidScheme: "https"`, SplashScreen block (androidSplashResourceName/launchAutoHide/backgroundColor) present |
| `android/app/src/main/AndroidManifest.xml` | `android:screenOrientation="portrait"` | ✓ VERIFIED | Line 18: `android:screenOrientation="portrait"` |
| `android/app/build/outputs/apk/debug/app-debug.apk` | Compile-proof artifact | ✓ VERIFIED | Exists, 6,737,568 bytes, timestamped 2026-09-08 12:33 |
| `android/app/build/outputs/bundle/debug/app-debug.aab` | AAB compile-proof artifact (PLT-01) | ✓ VERIFIED | Exists, 6,160,112 bytes, timestamped 2026-09-08 12:33 |
| `android/app/src/main/res/drawable-*/splash_screen.webp` | 5-density splash drawables | ✓ VERIFIED | All 5 densities (mdpi/hdpi/xhdpi/xxhdpi/xxxhdpi) confirmed present via direct file test |
| `android/app/src/main/res/mipmap-*/` | Launcher icon mipmaps | ✓ VERIFIED | All 5 density dirs + `mipmap-anydpi-v26` (adaptive icon) present; xxxhdpi confirmed containing ic_launcher.png, ic_launcher_round.png, ic_launcher_foreground.png |
| `fonts/*.woff2` | Self-hosted offline fonts | ✓ VERIFIED | 6 files present: crimson-pro (normal, italic-400), ibm-plex-mono (400/500/600), special-elite-400 |
| `test/persistence/*.test.js` | Wave-0 persistence tests | ✓ VERIFIED | 5 files present (storage, storage-migration, dual-write-convergence, lifecycle, back-button-logic), directly read/spot-checked, not stubs |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `engineAdapter.js` | `storage.js` | `import * as storage` + `persist()/boot()/getBest()` calls | ✓ WIRED | Confirmed by direct source read + zero raw localStorage calls |
| `mazeworld.html` classic script | `window.mzStorage` | direct calls in save/load/saveGraves/loadGraves | ✓ WIRED | Confirmed by line-numbered grep; sentinel-marker-based verbatim extraction test (`sandboxClassicPersistence.js`) proves the REAL function bodies, not a reimplementation |
| `storage.js` | `@capacitor/preferences` | guarded dynamic `import()` inside native branch only | ✓ WIRED, correctly guarded | Zero static/top-level `@capacitor/*` imports anywhere in `src/` (grep-confirmed); test-only override hook bypasses only under `node --test` |
| `nativeChrome.js` | `@capacitor/app` (backButton/pause/appStateChange) | guarded dynamic `import()` + injectable params | ✓ WIRED, correctly guarded | Same pattern; `registerNativeChrome` wired into `mazeworld.html` at line 3459 only inside the native-platform branch |
| `AndroidManifest.xml` | portrait lock | manifest attribute (pre-JS layer) | ✓ WIRED | Confirmed present; backstopped by `ScreenOrientation.lock()` runtime call in nativeChrome.js |
| `capacitor.config.json` | `android/app/src/main/res/drawable-*/splash_screen.webp` | `androidSplashResourceName: "splash_screen"` | ✓ WIRED | Config resource name matches the actual drawable filename across all 5 densities |
| `mazeworld.html` `@font-face` | `fonts/*.woff2` | relative `./fonts/...` path | ✓ WIRED | No CDN reference in either `mazeworld.html` or built `www/index.html`; `tools/build-www.mjs` copies `fonts/` → `www/fonts/` |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full unit suite passes | `node --test` | `# tests 363 / # pass 363 / # fail 0` | ✓ PASS |
| APK compile-proof artifact exists | file existence check | 6,737,568 bytes, present | ✓ PASS |
| AAB compile-proof artifact exists | file existence check | 6,160,112 bytes, present | ✓ PASS |
| No static/top-level @capacitor import anywhere in game code | `grep -n "import.*@capacitor" src/` | 0 matches (only dynamic `import()` calls inside guarded branches) | ✓ PASS |
| No raw localStorage calls in engineAdapter.js | `grep "localStorage\.\w+Item" src/browser/engineAdapter.js` | 0 matches | ✓ PASS |
| No Google Fonts CDN reference (source or built) | `grep -riE "fonts\.(googleapis\|gstatic)\.com"` on both `mazeworld.html` and `www/index.html` | 0 matches in both | ✓ PASS |
| `decideBackAction` never returns silent exit for a live unconfirmed run | direct source read of the pure function's branch logic | Confirmed: only `alreadyConfirming` or `!hasLiveRun` reach `exit-app` | ✓ PASS (logic-level; real hardware press is device UAT) |
| Portrait lock present in manifest | `grep screenOrientation AndroidManifest.xml` | `android:screenOrientation="portrait"` found | ✓ PASS |
| No debt markers (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER) in phase-touched files | grep across storage.js, nativeChrome.js, engineAdapter.js, tools/*.mjs, capacitor.config.json, AndroidManifest.xml | 0 matches | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PLT-01 | 02-02, 02-04 | Installable native Android app (AAB) via Capacitor | ✓ SATISFIED | `app-debug.aab` + `app-debug.apk` both present, both from a real `BUILD SUCCESSFUL` gradlew run |
| PLT-02 | 02-03 | Back button never silently ends a run | ✓ SATISFIED (logic tier); device-press DEFERRED | `decideBackAction` read + unit tests |
| PLT-03 | 02-03 | Lifecycle events persist + resume cleanly | ✓ SATISFIED (logic tier); device-lifecycle DEFERRED | `flushOnBackground`/`registerNativeChrome` read + unit tests |
| PLT-04 | 02-04 | Native chrome: splash, status bar, portrait | ✓ SATISFIED (config tier); device-visual DEFERRED | Manifest, config, drawables, mipmaps all present |
| SAV-01 | 02-01, 02-03 | Autosave after every action + on background | ✓ SATISFIED | Write-queue + flush + dispatch()-routed persist(), unit-tested |
| SAV-02 | 02-01, 02-03 | Close/reopen resumes exactly | ✓ SATISFIED (logic tier); device-relaunch DEFERRED | Round-trip deepEquals tests, boot() rehydration |
| SAV-03 | 02-01 | Durable native storage (Preferences, not localStorage), versioned + integrity | ✓ SATISFIED | Guarded dynamic import confirmed, `validateSave` reuse confirmed, zero static @capacitor import |
| SAV-04 | 02-01, 02-03 | Best depth persists across restarts | ✓ SATISFIED (logic tier); device-restart DEFERRED | Round-trip through same abstraction, unit-tested |
| SAV-05 | 02-01, 02-03 | Graveyard persists across restarts | ✓ SATISFIED (logic tier); device-restart DEFERRED | Same as SAV-04, plus classic-script extraction test |

No orphaned requirements — all 9 (PLT-01..04, SAV-01..05) appear in plan frontmatter and match REQUIREMENTS.md's Phase 2 mapping exactly.

### Anti-Patterns Found

None. Grep scan for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER|not yet implemented|coming soon` across all phase-touched source files (`storage.js`, `nativeChrome.js`, `engineAdapter.js`, `tools/build-www.mjs`, `tools/pin-jdk.mjs`, `capacitor.config.json`, `AndroidManifest.xml`) returned zero matches.

### Human Verification Required

Per `02-VALIDATION.md`'s three-tier verification architecture, the following are genuinely native/OS behaviors that cannot be exercised headlessly and are explicitly scoped as end-of-milestone device UAT — not gaps in this phase's completion:

1. **App install/launch/visual chrome** — Install `app-debug.apk` on an emulator/device, launch it. Expected: branded splash shows, app is portrait-locked, status bar matches the parchment theme, launcher icon renders correctly. Why human: real WebView compositing and OS orientation enforcement can't be exercised headlessly.

2. **Real back-button press** — Press back mid-run on device. Expected: first press confirms-before-quit (or closes modal/navigates), never a silent single-press exit. Why human: real `@capacitor/app` backButton event dispatch and real hardware/gesture input; the decision logic itself is unit-proven.

3. **Real lifecycle resume** — Background/force-stop/reopen mid-run. Expected: resumes exactly where left off. Why human: real OS lifecycle timing (pause/appStateChange dispatch, process suspension) can't be exercised headlessly; the awaited-flush logic itself is unit-proven.

4. **Real storage durability across a full app restart** — Play, restart app, confirm run/best-depth/graveyard survive. Expected: all three persist via Preferences. Why human: real native Preferences plugin durability and Android storage-eviction behavior can't be exercised headlessly; backend-selection/versioning/integrity logic is unit-proven.

5. **Airplane-mode offline correctness** — Enable airplane mode, cold-launch, confirm fonts render (not fallback) and app is playable. Why human: real network isolation and font-rendering fidelity aren't provable by grep alone (grep confirms absence of CDN references, which is necessary but not sufficient).

### Gaps Summary

No code-tier or build-tier gaps found. All 4 ROADMAP success criteria have full evidence at the code/config/build level:
1. AAB+APK build gate green, splash/status-bar/portrait config present — visual confirmation deferred to device.
2. Back-button decision logic proven to have no silent-end path via direct code read + passing unit tests — real hardware confirmation deferred to device.
3. Autosave-on-every-action and awaited-lifecycle-flush both proven wired and unit-tested — real OS timing confirmation deferred to device.
4. Native Preferences backend (not localStorage) selection, versioned/integrity-checked migration, and all three data types (run/best/graveyard) routed through the one shared abstraction — all confirmed via direct source read, zero raw localStorage in engineAdapter.js, zero static @capacitor imports anywhere — real on-device durability confirmation deferred to device.

The 5 deferred items are the expected, explicitly-scoped output of this phase's own validation strategy (02-VALIDATION.md), not overlooked work. Overall status is `human_needed` rather than `passed` because these device-UAT items remain open — per the verification decision tree, any non-empty human-verification list routes to `human_needed` even when every other truth is code-tier VERIFIED.

---

_Verified: 2026-09-08T16:39:45Z_
_Verifier: Claude (gsd-verifier)_
