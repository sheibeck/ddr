---
phase: 67-play-games-integration-account-chip
plan: 06
subsystem: native-plugins / Android build wiring
status: complete
tags: [play-games, capacitor-plugin, supply-chain, gradle, d-13, d-15, d-17, d-20, d-21]
requires:
  - 67-01 (Ruling: as-is, reviewed PlayGamesPlugin.kt sha256)
  - 67-AGP9-SPIKE.md (VERDICT: STAY ON AGP 8.13.0)
provides:
  - "@modbender/capacitor-play-games pinned at exactly 0.5.0, lock integrity sha512-GJ7g... committed"
  - the plugin vendored to www/vendor/@modbender/capacitor-play-games/ and import-mapped (for 67-02's playGames.js loader)
  - android string resource game_services_project_id (000000000000 placeholder) + manifest APP_ID meta-data
  - the plugin's Gradle project wired by cap sync (:modbender-capacitor-play-games)
  - test/unit/play-games-intake.test.js (pin, integrity, dynamic-import vendoring coverage, manifest/resource/Gradle pins)
affects: [67-02, 67-07, 67-08, phase-68, phase-69]
tech-stack:
  added:
    - "@modbender/capacitor-play-games 0.5.0 (npm, exact pin)"
    - "com.google.android.gms:play-services-games-v2 22.0.0 (transitive, via the plugin)"
  patterns:
    - "every bare-specifier dynamic import in src/browser must be on build-www's CAPACITOR_PACKAGES (node test)"
key-files:
  created:
    - android/app/src/main/res/values/games-ids.xml
    - test/unit/play-games-intake.test.js
  modified:
    - package.json
    - package-lock.json
    - tools/build-www.mjs
    - android/app/src/main/AndroidManifest.xml
    - android/app/capacitor.build.gradle
    - android/capacitor.settings.gradle
    - docs/RELEASING.md
decisions:
  - "As-is ruling (D-20) followed: plugin installed unmodified, no tools/patch-play-games.mjs; D-02 stands amended (the native SDK initializes at launch even with Compete OFF; the game makes no sign-in/submit/fetch calls)"
  - "D-21 outcome: stay on AGP 8.13.0 / Gradle 8.14.3; the pinned debug build passed with the plugin unmodified, so no Gradle-only buildscript fix was created"
metrics:
  duration: ~35 min
  completed: 2026-09-23
  tasks: 2
  files: 9
requirements: [PGS-01]
---

# Phase 67 Plan 06: Play Games plugin install and Android wiring Summary

`@modbender/capacitor-play-games` is installed at exactly 0.5.0, unmodified (as-is ruling D-20). It is vendored and import-mapped for the WebView, the Play Games APP_ID placeholder is wired through the manifest, and cap sync added its Gradle project. The debug APK builds on the pinned AGP 8.13.0 / Gradle 8.14.3 / JDK 21 toolchain without a Gradle fix (D-21). The release runtime classpath audit found no ads, analytics or crash SDK.

## Ruling followed

- `67-01-PLUGIN-REVIEW.md`: **`Ruling: as-is`** (D-20). No init patch was written: `tools/patch-play-games.mjs` and `test/unit/play-games-patch.test.js` do **not** exist, and `cap:sync` is unchanged.
- The installed `PlayGamesPlugin.kt` sha256 is `0023e880027c8b8160676485ef40655623c3bfdce095ac2754319bed82d7b7ec`, which matches the file 67-01 reviewed. node_modules was not edited.
- **D-02 is amended as the ruling says.** The plugin's `load()` calls `PlayGamesSdk.initialize(context)` on every app start, even with Compete OFF. Compete OFF means the game itself never calls sign-in, submit or fetch. The Compete-OFF cold-boot Logcat/network capture is a **release-blocking** device check in the Phase 69 batch (see Human verification).
- **D-21 outcome: stay on AGP 8.13.0.** `npm run android:debug` passed with the plugin unmodified, so the sha256-guarded, Gradle-only buildscript fix was not needed and was not created. This is recorded in `docs/RELEASING.md` under "Android toolchain pin (AGP 8.13.0, D-21)".
- Review corrections are recorded for downstream plans: the resource is named `game_services_project_id`; `signIn` is silent by default (the Sign in row passes `silent: false`); `getPlayer` rejects when signed out.

## What was done

### Task 1: exact pin and lockfile integrity (commit 5831239)
- Ran `npm ci`, then `npm install --save-exact @modbender/capacitor-play-games@0.5.0`. package.json now has `"@modbender/capacitor-play-games": "0.5.0"`. The lock entry has version 0.5.0 and integrity `sha512-GJ7gzDQICQxzPIzKejqYnG9HXnL2/lq5CenHPeDaedkbaYf2hZndj1Xx+F4TtE0PLHp1Da2Ku5W/AMTw5Znb3w==`. The plugin has no npm dependencies; its only peer is `@capacitor/core`.
- Committed package.json and package-lock.json before running the suite. MAP-09 passes (39/39 in shell-map-invariants).
- `test/unit/play-games-intake.test.js` pins the exact version, the lock integrity, the lock root pin and the fact that the plugin has no npm dependencies.

### Task 2: vendoring, APP_ID, cap sync, build, audit (commit 1a5f9a5)
- `tools/build-www.mjs`: added `@modbender/capacitor-play-games` to `CAPACITOR_PACKAGES`, with a Phase 67 comment. The step log now reads "native plugin packages". The build log shows `@modbender/capacitor-play-games: rewrote relative specifiers in 1 .js file(s)` and `vendored 8 native plugin packages`. www/index.html's import map carries `"@modbender/capacitor-play-games": "./vendor/@modbender/capacitor-play-games/index.js"`.
- New `android/app/src/main/res/values/games-ids.xml` defines `<string name="game_services_project_id" translatable="false">000000000000</string>`. Its comment points at docs/PLAY-GAMES-SETUP.md and describes the graceful failure: nobody chip, one rail card, fully playable.
- `AndroidManifest.xml`: `<meta-data android:name="com.google.android.gms.games.APP_ID" android:value="@string/game_services_project_id" />` is inside `<application>`, after the FileProvider. No permissions were added. The merged debug manifest has the meta-data and still only INTERNET, VIBRATE (haptics) and androidx's DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION; there is no AD_ID permission.
- `npx cap sync` (through `android:debug`) found 7 plugins, including `@modbender/capacitor-play-games@0.5.0`. It regenerated `capacitor.settings.gradle` (`include ':modbender-capacitor-play-games'`, projectDir `../node_modules/@modbender/capacitor-play-games/android`) and `app/capacitor.build.gradle` (`implementation project(':modbender-capacitor-play-games')`).
- The intake test was extended to 14 tests:
  - the vendoring list includes the plugin;
  - a scanner self-test (bare vs relative vs commented specifiers);
  - every bare dynamic `import()` in `src/browser/**/*.js` is on `CAPACITOR_PACKAGES`, scanned after stripJs comment stripping;
  - the manifest APP_ID meta-data is exact and appears once, inside `<application>`;
  - the source manifest has INTERNET as its only permission;
  - games-ids.xml has the non-translatable 12-digit placeholder;
  - both Gradle files carry the plugin's Gradle project.
- `docs/RELEASING.md` has a new "Android toolchain pin (AGP 8.13.0, D-21)" section covering the pin, why no fix is needed, "don't let Studio upgrade", and the re-review/re-audit steps for any plugin bump.

## Debug build (D-13)

`npm run android:debug` (build:www, then cap sync, pin-jdk and assembleDebug), exit 0. Tail:

```
> Task :app:packageDebug
> Task :app:createDebugApkListingFileRedirect
> Task :app:assembleDebug
> Task :modbender-capacitor-play-games:mergeDebugJavaResource
> Task :modbender-capacitor-play-games:syncDebugLibJars
> Task :modbender-capacitor-play-games:bundleDebugAar
> Task :modbender-capacitor-play-games:assembleDebug

BUILD SUCCESSFUL in 2m 5s
304 actionable tasks: 304 executed
```

- Output: `android/app/build/outputs/apk/debug/app-debug.apk` (11,765,511 bytes). It was not installed on a device, and no release or AAB build was made.
- The only plugin-related output was the Kotlin Gradle Plugin's advisory warning: "The used Gradle version (Gradle 8.14.3) is deprecated and will not be supported in future Kotlin Gradle Plugin releases." It is not a failure.
- `git diff --quiet HEAD -- android/gradle.properties android/build.gradle android/variables.gradle android/gradle/wrapper` exits 0, so no toolchain pin was touched and gradle.properties needed no restore.

## Dependency audit (D-13, PGS-01)

Command (output written to the session scratchpad, outside the repo):

```
node tools/gradle.mjs :app:dependencies --configuration releaseRuntimeClasspath
```

It exited 0. The plugin's subtree:

```
\--- project :modbender-capacitor-play-games
     +--- org.jetbrains.kotlin:kotlin-stdlib:2.4.10 (*)
     +--- project :capacitor-android (*)
     +--- androidx.appcompat:appcompat:1.7.1 (*)
     \--- com.google.android.gms:play-services-games-v2:22.0.0
          +--- com.google.android.gms:play-services-base:18.5.0
          |    +--- com.google.android.gms:play-services-basement:18.4.0 -> 18.9.0
          |    \--- com.google.android.gms:play-services-tasks:18.2.0
          +--- com.google.android.gms:play-services-basement:18.9.0 (*)
          \--- com.google.android.gms:play-services-tasks:18.2.0 (*)
```

| Artifact | Resolved version |
|---|---|
| com.google.android.gms:play-services-games-v2 | 22.0.0 |
| com.google.android.gms:play-services-base | 18.5.0 |
| com.google.android.gms:play-services-basement | 18.9.0 (18.4.0 requested) |
| com.google.android.gms:play-services-tasks | 18.2.0 |
| com.google.firebase:* | **none** |
| org.jetbrains.kotlin:kotlin-stdlib | 2.4.10. The plugin requests it directly; the 1.7.10, 1.8.x, 1.9.21 and 2.0.21 requests from androidx all resolve up to 2.4.10 |
| kotlinx-coroutines-core / -android | 1.8.1 (existing androidx transitive) |

- **Forbidden-artifact search:** a case-insensitive `grep -iE` for `firebase|admob|play-services-ads|ads-identifier|analytics|measurement|crashlytics|appsflyer|adjust|facebook|appcenter|sentry|bugsnag` over the full report: **0 hits**.
- **google-services is never applied.** The root `android/build.gradle` has `classpath 'com.google.gms:google-services:4.4.4'` on the buildscript classpath, but `android/app/build.gradle` applies `com.google.gms.google-services` only when `google-services.json` exists. There is no `android/app/google-services.json`, so the plugin is not applied and nothing from it reaches the runtime classpath.

## Verification

- `node --test test/unit/play-games-intake.test.js test/unit/sfx-assets.test.js`: 16/16 pass.
- `node --test test/unit/shell-map-invariants.test.js` (after the Task 1 commit): 39/39 pass (MAP-09).
- `npm test`: 4478 tests, 4471 pass, 7 fail, 0 cancelled. The 7 are the known pre-existing worktree CRLF doc-ledger failures: class-pass-ledger #843/#844/#845/#853 and flee-ledger #1608/#1609/#1610. No new failures. The AUD-06 sfx failure did not appear because there is no untracked sfx/theme.mp3 in this worktree.
- Acceptance greps:
  - `"@modbender/capacitor-play-games": "0.5.0"` appears once in package.json.
  - The integrity string is in package-lock.json.
  - build-www.mjs, AndroidManifest.xml (once), games-ids.xml (once) and capacitor.settings.gradle all carry the plugin.
  - tools/patch-play-games.mjs is absent.
- Scope: engine/, test/parity/prototype-master.js.txt, mazeworld.html and src/browser/playGames.js were not touched. STATE.md, ROADMAP.md and REQUIREMENTS.md were not edited.

## Deviations from Plan

- **docs/RELEASING.md edited** (not in the plan's files_modified). The orchestrator and D-21 require the D-21 outcome to be recorded there. It is documentation only.
- **Dynamic-import scan is recursive** over `src/browser/**` instead of only `src/browser/*.js`. This covers more files, so a vendoring gap in a future subdirectory is also caught.
- **Extra intake pins:** the lock root pin, "no npm dependencies of its own", and "no manifest permission beyond INTERNET". They add coverage and change no behaviour.
- Otherwise the plan ran as written under the as-is branch. No patch tool was created and no toolchain pin changed.

## Threat model outcomes

- T-67-SC (supply chain): mitigated. The exact pin and lock integrity are pinned by a test, and the installed PlayGamesPlugin.kt sha256 matches the 67-01 review.
- T-67-02 (transitive Gradle deps): mitigated. The releaseRuntimeClasspath audit has 0 forbidden hits.
- T-67-03 (WebView module resolution): mitigated. The plugin is vendored and import-mapped, and the dynamic-import coverage test guards the stuck-on-splash bug class.

## Known Stubs

- `game_services_project_id` = `000000000000` in android/app/src/main/res/values/games-ids.xml is an intentional placeholder (D-15). The user replaces it during console setup (docs/PLAY-GAMES-SETUP.md, 67-08). Until then, sign-in fails gracefully.

## Human verification (deferred to end of run)

For the Phase 69 batch in docs/UAT-v2.0.md. Do not pause for these now.

1. **Placeholder APP_ID, Compete ON (D-15):** on a Pixel 7 debug install with the 000000000000 placeholder, cold boot with Compete ON. Expected: the nobody chip, exactly one failure rail card, and a normal game with no crash.
2. **Compete OFF cold boot (release-blocking under the as-is ruling, amended D-02):** cold boot with Compete OFF while capturing `adb logcat` and network activity. Expected: the game makes no Play Games sign-in, submit or fetch calls and there is no leaderboard traffic. Record any Play Games SDK Logcat lines or network traffic caused by the plugin's ambient `PlayGamesSdk.initialize` in `load()`. The Phase 69 privacy text must describe what is actually observed.
3. **After the user's console setup** (real APP_ID in games-ids.xml, Play App Signing SHA-1 linked, tester added): a tester account signs in through the Sign in row (`silent: false`) and the chip shows the player.

## Self-Check: PASSED

- FOUND: android/app/src/main/res/values/games-ids.xml
- FOUND: test/unit/play-games-intake.test.js
- ABSENT (as intended): tools/patch-play-games.mjs, test/unit/play-games-patch.test.js
- FOUND commit 5831239 (Task 1), FOUND commit 1a5f9a5 (Task 2)
