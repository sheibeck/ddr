---
phase: 97-large-screen-support
plan: 01
subsystem: android-shell
tags: [android, manifest, screen-orientation, large-screen, capacitor]
requires: []
provides:
  - PHONE_SMALLEST_WIDTH_LIMIT (600), decideOrientationLock, syncOrientationLock exported from src/browser/nativeChrome.js
  - registerNativeChrome params getScreenPref, getSmallestWidth
  - AndroidManifest.xml without the orientation restriction
affects: [97-03]
tech-stack:
  added: []
  patterns: [pure decision function plus idempotent sync, injected getters read at call time]
key-files:
  created:
    - test/unit/screen-orientation.test.js
  modified:
    - src/browser/nativeChrome.js
    - android/app/src/main/AndroidManifest.xml
    - test/unit/android-large-screen.test.js
key-decisions:
  - "Phone = smallest width below 600 CSS px; missing, non-finite, zero or negative width counts as a phone"
  - "A failed plugin call clears the remembered decision so the next sync retries"
requirements-completed: [SCREEN-01, SCREEN-02, SCREEN-05]
status: complete
duration: ~15 min
completed: 2026-10-04
---

# Phase 97 Plan 01: Rotation foundation Summary

The manifest no longer restricts orientation, and the runtime lock is a pure, idempotent, phone-only rule driven by a Screen preference (Portrait locks, Rotate unlocks, tablets, foldables and Chromebooks always follow the device).

## What was built

- `android/app/src/main/AndroidManifest.xml`: removed `android:screenOrientation="portrait"` from `.MainActivity`. Kept `android:appCategory="game"`, the exact `configChanges` list and `launchMode="singleTask"`. Rewrote the comment block above `<application>`.
- `src/browser/nativeChrome.js`: added `PHONE_SMALLEST_WIDTH_LIMIT`, pure `decideOrientationLock({ screenPref, smallestWidth })`, and `syncOrientationLock()` (idempotent, never throws, returns null before registration). `registerNativeChrome` takes `getScreenPref` and `getSmallestWidth` and applies the rule through `syncOrientationLock`; the plugin resolution line and the CR-03 ordering are untouched. `__resetNativeChromeRegistrationForTests` also resets the orientation state.
- `test/unit/screen-orientation.test.js` (new, 15 tests): every behavior bullet, written red first.
- `test/unit/android-large-screen.test.js` rewritten: manifest pins (game category, no orientation/resizability/aspect/layout, configChanges and singleTask intact), the single-lock-site pin in nativeChrome, and the large-screen behaviour check. The three `mw-letterbox` tests were removed (successors are 97-03's job).

The shell wiring (Settings row, getters, resync on resize) is 97-03.

## Commits

- 63a77fc9 feat(97-01): phone-only, preference-driven orientation rule in nativeChrome
- c4d5e1a9 feat(97-01): drop the manifest orientation lock and re-pin DROID-03

## Tests run (targeted, per plan)

`node --test test/unit/android-large-screen.test.js test/unit/android-system-bars.test.js test/unit/screen-orientation.test.js test/persistence/lifecycle.test.js test/persistence/flush-drain.test.js`: 58 tests, 58 pass, 0 fail. No existing lifecycle, flush-drain or system-bars test was edited. Plan's manifest and `decideOrientationLock` one-liners print `ok`. Engine gate `git diff a5fbd87f -- engine test/parity test/determinism` is empty; `git diff --stat a5fbd87f -- android` lists only AndroidManifest.xml. No full suite, bots, sims or Android build were run.

## Declared re-pins

`test/unit/android-large-screen.test.js` carries `Phase 97 (SCREEN-01/SCREEN-02): declared re-pin` comments on each changed assertion (portrait attribute gone, restriction list widened, single lock site moved into `syncOrientationLock`).

## Deviations from Plan

None - plan executed exactly as written. (Files in the repo are CRLF; CRLF was preserved on edits.)

## Known Stubs

None.

## Deferred human verification

- Build gate, merged manifest of the release build (`aapt2 dump xmltree` on the APK): no screenOrientation on MainActivity, appCategory game kept, configChanges intact.
- Next Play upload: the "orientation and resizability restrictions" large-screen notice no longer fires.
- Pixel 7: Settings > Screen Portrait keeps the game upright when the phone turns; Rotate lets it turn; the choice survives a relaunch (needs 97-03's row).

## Self-Check: PASSED

Files exist (screen-orientation.test.js, edited manifest, nativeChrome.js, rewritten android-large-screen.test.js); commits 63a77fc9 and c4d5e1a9 present.
