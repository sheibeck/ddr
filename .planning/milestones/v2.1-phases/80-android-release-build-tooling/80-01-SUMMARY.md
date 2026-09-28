---
phase: 80-android-release-build-tooling
plan: 01
subsystem: android-release-tooling
status: complete
tags: [android, r8, proguard, release, tooling, dexdump, docs]
requires: []
provides:
  - "R8 minify + resource shrinking on the release build type (AGP 8.13.0), statically pinned"
  - "Defensive proguard-rules.pro mirror and keep.xml for the name-loaded splash drawable"
  - "tools/android-api-scan.mjs: the deprecated window/system-UI API scanner 80-04 runs on the single release build"
  - "docs/RELEASING.md R8 / mapping / verification recipe / Pixel 7 smoke sections"
affects:
  - 80-04 (runs the verification recipe and the scanner against the one release build)
  - 80-05 (device and emulator pass on that build)
tech-stack:
  added: []
  patterns:
    - "Entry-script guard (resolved argv[1] vs import.meta file path) so node:test imports the tool's pure functions"
    - "dexdump streamed through node:readline; every external call bounded by a timeout; temp dir removed on every exit path"
key-files:
  created:
    - android/app/src/main/res/raw/keep.xml
    - test/unit/android-r8.test.js
    - tools/android-api-scan.mjs
    - test/unit/android-api-scan.test.js
  modified:
    - android/app/build.gradle
    - android/app/proguard-rules.pro
    - docs/RELEASING.md
decisions:
  - "Scanner test fixtures are verbatim dexdump -d excerpts from the Sep-24 debug APK (classes2.dex StatusBar, classes.dex EdgeToEdgeApi28), not the javac/d8 fallback"
  - "Library APIs R8 can rename (androidx WindowCompat.setDecorFitsSystemWindows) are also matched through their mapping alias (expandApisWithMapping)"
  - "Unresolved (still-obfuscated) callers are reported, not failed on; 80-04 requires the count to be 0"
  - "Added --jar / --dexdump overrides and an Android Studio default SDK fallback (%LOCALAPPDATA%/Android/Sdk) because worktrees lack android/local.properties and ANDROID_HOME is unset on this machine"
metrics:
  duration: "~25 min (Tasks 2-3 and SUMMARY, this executor)"
  completed: 2026-09-26
  tasks: 3
  files: 7
---

# Phase 80 Plan 01: R8 release config, deprecated-API scanner and release runbook Summary

The release build type now runs R8 (minify, obfuscate, resource shrinking) on AGP 8.13.0. It has a defensive keep-rule mirror and a keep.xml for the splash drawable, and a static test pins the configuration. The plan also adds a dependency-free dexdump-based scanner that caught the old status-bar plugin's `Window.setStatusBarColor` call, and a RELEASING.md runbook for the mapping and the single-build verification recipe. No build of any kind ran.

## Execution history

**Task 1 came from a previous executor.** That executor committed Task 1 as `d46d77ce`, then stalled for more than 45 minutes, most likely inside Task 2's dexdump step. The orchestrator stopped it. This executor took `d46d77ce` as landed and did not redo it. It only re-ran the pinning test (`node --test test/unit/android-r8.test.js`: 23/23 pass), then carried out Tasks 2 and 3. That commit message records a RED run before the config change and GREEN after. This executor did not see that RED run.

To avoid the same stall, every jar and dexdump call in this run had a timeout bound, and large dexdump output went to temp files, never to stdout. The scanner itself streams dexdump through readline with a 300 s kill timer per dex file.

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Configure R8 for release, keep rules, keep.xml, static test | d46d77ce (previous executor) | android/app/build.gradle, android/app/proguard-rules.pro, android/app/src/main/res/raw/keep.xml, test/unit/android-r8.test.js |
| 2 | Deprecated window-API scanner with tests on a real dexdump excerpt | 875464c6 | tools/android-api-scan.mjs, test/unit/android-api-scan.test.js |
| 3 | RELEASING.md: R8, mapping, verification recipe, Pixel 7 smoke; full suite | 3274ff92 | docs/RELEASING.md |

## RED / GREEN

- **Task 1:** red and green are recorded in `d46d77ce` by the previous executor. This executor re-ran the test: 23/23 pass.
- **Task 2, RED:** the test was written first, then `node --test test/unit/android-api-scan.test.js` was run. It failed with `ERR_MODULE_NOT_FOUND` because `tools/android-api-scan.mjs` did not exist yet.
- **Task 2, GREEN:** the same command then passed 16/16.
- **Task 3:** the plan's doc check printed `releasing ok`. The full `npm test` run exited 0: 6602 tests, 6602 pass, 0 fail, about 218 s.

## Fixture source (Task 2)

The primary path was used, so the javac/d8 fallback was not needed. The dex files were unpacked from the existing debug APK, `C:/projects/mazeworld/android/app/build/outputs/apk/debug/app-debug.apk` (built 2026-09-24), with the pinned JDK's `jar.exe`. They were then dumped with `build-tools/36.0.0/dexdump.exe -d` into files in the session scratchpad. Two verbatim excerpts are embedded in the test:

- **`classes2.dex`, 42 lines:** `com.capacitorjs.plugins.statusbar.StatusBar`
  - `#setStatusBarColorDeprecated` calls `Landroid/view/Window;.setStatusBarColor:(I)V`.
  - `#setSystemUiVisibilityDeprecated` calls `View.setSystemUiVisibility`.
  - The unrelated `getWindow` invoke and the `activity` field read in the same lines must be ignored.
- **`classes.dex`, 19 lines:** `androidx.activity.EdgeToEdgeApi28#adjustLayoutInDisplayCutoutMode`
  - It has an `iput` to `WindowManager$LayoutParams;.layoutInDisplayCutoutMode:I`.
  - The unrelated `Intrinsics.checkNotNullParameter` and `getAttributes` invokes must be ignored.

The test's mapping.txt lines are written by hand in R8's documented format: headers, class lines, ranged and overloaded methods, and a field. 80-04 checks the parser against the real mapping; zero unresolved callers is the target.

## Scanner smoke (Task 2)

```
node tools/android-api-scan.mjs --apk C:/projects/mazeworld/android/app/build/outputs/apk/debug/app-debug.apk --mapping none --fail-on com.capacitorjs.plugins.statusbar
exit=1   (18.9 s, 9 dex files)
Totals: 45 call site(s) in 27 caller method(s); unresolved (still obfuscated): 0
--fail-on com.capacitorjs.plugins.statusbar: FAIL (4 matching row(s))
  - com.capacitorjs.plugins.statusbar.StatusBar#getSystemUiVisibilityDeprecated -> View.getSystemUiVisibility
  - com.capacitorjs.plugins.statusbar.StatusBar#setSystemUiVisibilityDeprecated -> View.setSystemUiVisibility
  - com.capacitorjs.plugins.statusbar.StatusBar#getStatusBarColorDeprecated -> Window.getStatusBarColor
  - com.capacitorjs.plugins.statusbar.StatusBar#setStatusBarColorDeprecated -> Window.setStatusBarColor
```

Other callers in that old debug APK:

| Owner | Rows | Where |
|---|---|---|
| androidx | 36 | EdgeToEdgeApi*, WindowCompat, WindowInsetsControllerCompat, core-splashscreen |
| Capacitor plugin: splashscreen | 5 | `legacyFullscreen`, `legacyImmersive` (the research's open question), and `WindowCompat.setDecorFitsSystemWindows` in `show` lambdas and `tearDown` |
| other | 1 | `org.apache.cordova.CordovaActivity#setImmersiveUiVisibility` |
| app | 0 | none |

80-04 compares this table against the single release build, where 80-02 has already removed the status-bar plugin. The other paths checked:

- A missing archive exits 2.
- No `mw-api-scan-*` temp directories were left in `os.tmpdir()` afterwards.
- The plan's import grep (`import .* from "[^n.]`) counts 0.

## No build ran

This plan ran no Gradle task, no `npm run android:*`, no `npm run play:release`, no `npm run version:bump` and no `cap sync`. The only Android artifact touched was the existing Sep-24 debug APK, read-only, by unpacking it to a temp directory. `git diff --quiet -- android/build.gradle android/version.properties android/gradle.properties` is clean, and no keystore file was staged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] SDK and JDK resolution fallback**

- **Found during:** Task 2
- **Issue:** The worktree has no `android/local.properties` (it is git-ignored), and `ANDROID_HOME` / `ANDROID_SDK_ROOT` are unset on this machine. With only the plan's SDK sources, the tool could not find dexdump when run from a worktree.
- **Fix:** Added two things:
  - `%LOCALAPPDATA%/Android/Sdk` (the Android Studio default) as the last SDK fallback.
  - `--jar <path>` and `--dexdump <path>` overrides.
- **Files modified:** tools/android-api-scan.mjs
- **Commit:** 875464c6

**2. [Rule 2 - Correctness] Renamed library APIs**

- **Found during:** Task 2
- **Issue:** In a release build R8 can rename androidx's `WindowCompat`. A plain descriptor match on `Landroidx/core/view/WindowCompat;.setDecorFitsSystemWindows` would then miss the calls.
- **Fix:** `expandApisWithMapping` adds the renamed class and member as an alias, taken from mapping.txt, for library entries. A unit test covers it.
- **Files modified:** tools/android-api-scan.mjs, test/unit/android-api-scan.test.js
- **Commit:** 875464c6

No other deviations. Task 3 made additions only to RELEASING.md: 86 lines added, 0 removed, and nothing inside "Next Play push: release notes".

## Known Stubs

None.

## Human verification (milestone close)

These are batched into the milestone-close Pixel 7 checklist under the deferred-UAT protocol. They come from RELEASING.md, "First release after R8". Install a release-signed build of the single 80-04 build, after uninstalling the Play-installed build (different signer; its Preferences data is lost), then check:

1. Boot to the title screen, splash included.
2. Start a run, SAVE & QUIT, relaunch and resume.
3. Back closes a sheet and asks before quitting a live run.
4. Sound effects and the title music play.
5. Haptics on a hit.
6. Play Games sign-in works.
7. The global boards load (ME / ALL / FRIENDS).

The build-output checks (identity lines in the mapping, embedded proguard.map, aapt2 resources, packed assets, the scan exiting 0) belong to 80-04, which runs them against the single release build.

## Self-Check: PASSED

All five created/modified files exist, and commits d46d77ce, 875464c6 and 3274ff92 are on the branch.
