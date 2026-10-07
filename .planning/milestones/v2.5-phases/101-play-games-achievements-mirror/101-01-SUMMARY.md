---
phase: 101-play-games-achievements-mirror
plan: 01
subsystem: android-native, play-games
tags: [play-games, achievements, capacitor-plugin, r8, resources]
requires:
  - phase: 100-achievements-ui
    provides: the ACHIEVEMENTS sheet and the 77-entry catalog the resource names derive from
provides:
  - res/values/games-ids.xml as the Play Console export, with app_id read by the manifest
  - PlayIdentityPlugin.syncAchievements, showAchievements and the achievementsClosed callback
  - playIdentity.js syncAchievements/showAchievements on the native seam and the fake, PLAY_ACHIEVEMENT_REASONS
affects: [101-02, 101-03, 101-04]
tech-stack:
  added: []
  patterns:
    - "Sequential Task chaining through completion listeners (never a loop starting several Tasks)"
    - "Names cross the bridge, IDs stay in Android resources (getIdentifier by name, pattern-checked)"
key-files:
  created:
    - test/unit/play-achievements-native.test.js
  modified:
    - android/app/src/main/res/values/games-ids.xml
    - android/app/src/main/res/values/strings.xml
    - android/app/src/main/AndroidManifest.xml
    - android/app/src/main/res/raw/keep.xml
    - android/app/src/main/java/com/darktierstudios/delvedierepeat/PlayIdentityPlugin.java
    - src/browser/playIdentity.js
    - test/unit/playIdentity.test.js
    - test/unit/dev-build-gate.test.js
    - test/unit/android-system-bars.test.js
    - test/unit/android-r8.test.js
key-decisions:
  - "package_name leaves strings.xml: the Console export defines it with the same value and a duplicate fails the resource merge"
  - "reasonFor returns null for status 26563 (incremental also unlocked) so the batch counts it as success; the show path maps that null to error"
  - "Normalizers receive the call args so a sync answer is filtered to indexes inside the batch that was sent"
requirements-completed: [PGS-07, PGS-10, PGS-11, AUI-04]
status: complete
duration: ~45 min
completed: 2026-10-05
---

# Phase 101 Plan 01: Native achievements plugin, IDs file and JS seam Summary

**The app now ships the Play Console IDs file and PlayIdentityPlugin can mirror a batch of unlocks, reveals and absolute steps by resource name, one op at a time, and open Play's own achievements screen; the JS seam and its fake speak the same contract with a closed reason set.**

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | bc037273 | Console export as res/values/games-ids.xml, manifest `@string/app_id`, package_name removed from strings.xml, `@string/achievement_*` in keep.xml, section A tests |
| 2 | 8de2b9c2 | syncAchievements, showAchievements, achievementsClosed in the plugin; section B source pins; two declared pin updates |
| 3 | b46157fa | playIdentity.js seam + fake; 11 new seam tests; one declared pin update |

## Test counts (targeted only; no full suite, no bots, no Gradle)

| File | Tests | Pass |
|------|-------|------|
| test/unit/play-achievements-native.test.js (new: 6 section A, 8 section B) | 14 | 14 |
| test/unit/playIdentity.test.js | 26 | 26 |
| Plan verification set (the ten files below, together) | 188 | 188 |

Verification set: play-achievements-native, playIdentity, dev-build-gate, android-system-bars, android-r8, compliance-docs, pgsProbe, account-signin-row, boardSync, stale-terms.

## Declared pin updates

| File | Test | Old | New |
|------|------|-----|-----|
| test/unit/playIdentity.test.js | "the APP_ID in games-ids.xml equals PLAY_GAMES_CONFIG.appId (D-09)" | read the `game_services_project_id` string | reads the `app_id` string of the Console export (title names the export and Phase 101) |
| test/unit/playIdentity.test.js | "fake and native expose the same four methods and are frozen" | four methods | "same six Play Games methods" (adds syncAchievements, showAchievements); PLAY_IDENTITY_REASONS still pinned to the original four |
| test/unit/android-r8.test.js | new test beside the unchanged DROID-01 splash test | (none) | "Phase 101 (PGS-10): keep.xml keeps @string/achievement_*" |
| test/unit/dev-build-gate.test.js | "native: buildInfo never initializes the Play Games SDK" | `ensureInit();` count 4 | 6, message names all six methods, re-pin comment added |
| test/unit/android-system-bars.test.js | "91.2-01: PlayIdentityPlugin.java is ..." | methods `[buildInfo, init, status, signIn, serverAuthCode]` | the seven names in order; title says four sign-in methods, two achievement methods and buildInfo; no-reject and no-log assertions unchanged |

## Java: final method list and constants (UNCOMPILED)

`@PluginMethod`s in order: buildInfo, init, status, signIn, serverAuthCode, syncAchievements, showAchievements. One `@ActivityCallback private void achievementsClosed(PluginCall, ActivityResult)`. Private helpers: runAchievementOps, achievementStringId (`@SuppressLint("DiscouragedApi")`), appendAchievementResult, syncAnswer, reasonFor.

Constants (`private static final`): RESOURCE_PATTERN (`^achievement_[a-z0-9_]{1,80}$`), MAX_OPS 20, MIN_STEPS 1, MAX_STEPS 10000, CODE_SIGN_IN_REQUIRED 4, CODE_NETWORK_ERROR 26506, CODE_APP_MISCONFIGURED 26508, CODE_ACHIEVEMENT_UNLOCK_FAILURE 26560, CODE_ACHIEVEMENT_UNKNOWN 26561, CODE_ACHIEVEMENT_NOT_INCREMENTAL 26562, CODE_ACHIEVEMENT_UNLOCKED 26563.

**The Java was not compiled.** By project rule no Gradle or Android build runs in an executor; it is proven by the source pins only. The first debug build at milestone end is its compile.

## Deviations from Plan

None in behavior. Two small notes:

- **[Rule 3 - scoping] Worktree has no node_modules.** The Capacitor Java sources were read from the main checkout's node_modules (read only) to confirm `getArray`, `startActivityForResult(call, intent, name)` and `releaseCall`.
- **Section B "body" pins slice by section.** The sync-body pins (pattern, getIdentifier, isAuthenticated before getAchievementsClient) read the span from `syncAchievements` to `showAchievements`, because the per-op work sits in helpers placed between the two methods. The ordering pin (isAuthenticated before getAchievementsClient) still holds inside the method body itself.

Test-only refinement during Task 2: the "no counting call" pin matches `increment(` / `incrementImmediate(` call forms, because the status-code constant name `CODE_ACHIEVEMENT_NOT_INCREMENTAL` and a comment legitimately contain the word.

## Threat model

All mitigated rows are pinned: T-101-01 (resource pattern before lookup), T-101-02 (kind closed set, n 1 to 10000, batch at most 20, only the at-least call), T-101-03 (no log, no ID literal), T-101-04 (ensureInit count 6, buildInfo still clean, MainActivity untouched), T-101-05 (keep.xml wildcard), T-101-06 (no duplicate string name across res/values). No new threat surface beyond the plan's register.

## Known Stubs

None.

## Human verification (deferred to end of run)

- [ ] The first debug APK build compiles PlayIdentityPlugin (the Java is uncompiled until then).
- [ ] On the release build, open Play's list from the ACHIEVEMENTS sheet and see it fill (the R8 shrinker check for `@string/achievement_*`).
- [ ] `adb logcat` during a sync shows no achievement ID, player ID or name from the app's own process.

## Self-Check: PASSED

- Created and modified files exist (11 files in the diff against base 9d69d2c9, matching the plan's list exactly).
- Commits bc037273, 8de2b9c2, b46157fa exist on branch worktree-agent-aaadd9892910f760a.
- achievements/games-ids.xml unchanged; MainActivity.java, build.gradle and proguard-rules.pro untouched.
