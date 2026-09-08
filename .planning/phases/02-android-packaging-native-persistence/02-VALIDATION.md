---
phase: 2
slug: android-packaging-native-persistence
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-08
---

# Phase 2 — Validation Strategy

> Three verification tiers: (1) **unit-testable** logic (the Storage abstraction, localStorage→Preferences migration, integrity/versioning) via `node:test`; (2) a **build-succeeds gate** — a real headless Gradle debug build compiles the wrapped app; (3) **deferred device UAT** — emulator/on-device visual, feel, back-button, and lifecycle-resume behavior (the user runs the emulator). Native-bridge behavior (Preferences/App plugins) can't be unit-tested headlessly, so it's covered by the build gate + interface tests + deferred UAT.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Unit framework** | `node:test` + `node:assert/strict` (Node built-ins; established) |
| **Quick run** | `node --test test/unit/` |
| **Full suite** | `node --test` (all prior 324 + new storage/migration tests) |
| **Build gate** | `cd android && ./gradlew.bat assembleDebug` (headless; produces an installable debug APK) — the compile-succeeds proof of PLT-01. Also confirm `bundleDebug` (AAB) task runs (PLT-01 wording). |
| **Env preconditions** | `JAVA_HOME`→Temurin 17; `org.gradle.java.home` in `android/gradle.properties`; `ANDROID_HOME`=`%LOCALAPPDATA%\Android\Sdk`; `platforms;android-36` installed |

---

## Sampling Rate
- After every task commit: `node --test test/unit/`
- After the Capacitor/build tasks: run the build gate (`assembleDebug`)
- Before `/gsd-verify-work`: full unit suite green + build gate succeeds
- Max feedback latency: unit ~15s; build gate minutes (first build downloads Gradle deps)

---

## Per-Requirement Verification Map

| Requirement | Criterion | Tier | Check | Status |
|-------------|-----------|------|-------|--------|
| PLT-01 | Installable native Android app (AAB) via Capacitor; splash/status-bar/portrait configured | build gate + config assert | `assembleDebug` succeeds; capacitor.config + AndroidManifest assert portrait; `@drawable/splash_screen` present | ⬜ |
| PLT-02 | Back button never silently ends a run (confirm-before-quit / nav) | interface unit + deferred UAT | unit-test the back-handler decision fn; real back-press = device UAT | ⬜ |
| PLT-03 | Lifecycle (background/foreground/interruption) persists + resumes | interface unit + deferred UAT | unit-test the pause→save call; real lifecycle = device UAT | ⬜ |
| PLT-04 | Native chrome: splash, status bar, portrait lock configured | config assert | files/config present; visual = deferred UAT | ⬜ |
| SAV-01 | Autosave after every action/beat AND on background | unit | Storage abstraction called on each applyAction + on pause event (mocked) | ⬜ |
| SAV-02 | Close/reopen resumes exactly | unit + deferred UAT | serialize→(store)→rehydrate deepEquals; real relaunch = device UAT | ⬜ |
| SAV-03 | Durable native storage (Preferences), versioned + integrity | unit | Storage abstraction: Preferences backend selected on native; localStorage fallback in browser; version/integrity fail-closed (reuse saveState) | ⬜ |
| SAV-04 | Best depth/high score persists across restarts | unit | best-depth via the abstraction; migration test | ⬜ |
| SAV-05 | Graveyard persists across restarts | unit | graveyard via the abstraction; migration test | ⬜ |

---

## Wave 0 Requirements
- [ ] `test/unit/storage.test.js` — the async Storage abstraction: backend selection (native Preferences mock vs localStorage), get/set/remove, try/catch fail-safe, async-vs-sync reconciliation (no dropped save on rapid writes).
- [ ] `test/unit/storage-migration.test.js` — one-time migration of the 3 keys (`mazeworld.delve.v1`, `mazeworld.graveyard.v1`, `mazeworld.best.v1`) localStorage→Preferences on first native launch; idempotent; integrity-validated (reuse `engine/saveState.js`).
- [ ] `test/unit/dual-write-convergence.test.js` — proves `mazeworld.html`'s classic script and `engineAdapter.js` now use the SAME shared Storage (no two racing backends on the same key).
- [ ] `test/unit/lifecycle-handlers.test.js` — the back-button decision fn and the pause→save handler as pure/mockable units (native plugin mocked).
- [ ] Build gate wired: `android/gradle.properties` has `org.gradle.java.home`; documented `assembleDebug` command.

---

## Manual-Only Verifications (Deferred Device UAT)

| Behavior | Requirement | Why Manual | Instructions |
|----------|-------------|------------|--------------|
| App installs, launches, shows splash, is portrait-locked, playable | PLT-01/04 | Needs an emulator/device | Build debug APK, install on emulator/device, launch |
| Back button confirms-before-quit; never silently ends a run | PLT-02 | Real hardware/gesture back | Press back mid-run on device |
| Background/kill/reopen resumes exactly where left off | PLT-03/SAV-02 | Real OS lifecycle | Background & force-stop mid-run, reopen |
| Saves/graveyard/best-depth survive an app restart on device | SAV-03/04/05 | Real device storage durability | Play, restart app, confirm persistence |

*Deferred to milestone-end UAT (user runs the emulator/device). Logic is unit-tested; the native/OS behavior is confirmed on-device.*

---

## Validation Sign-Off
- [ ] All PLT/SAV reqs map to a unit test, config assert, build gate, or documented device-UAT item
- [ ] Storage abstraction + migration + dual-write convergence unit-tested; integrity fail-closed preserved
- [ ] Headless `assembleDebug` build succeeds (compile proof)
- [ ] Prior 324 tests remain green
- [ ] `nyquist_compliant: true` set

**Approval:** pending
