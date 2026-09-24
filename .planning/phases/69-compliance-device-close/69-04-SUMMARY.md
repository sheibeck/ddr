---
phase: 69-compliance-device-close
plan: 04
subsystem: release
tags: [android, play, aab, signing, audit, data-safety, release]
status: complete
requires:
  - phase: 69-01
    provides: Data safety answers and the source-level audit in store-listing/LISTING.md
  - phase: 69-02
    provides: docs/PLAY-GAMES-SETUP.md (console runbook)
  - phase: 69-03
    provides: docs/UAT-v2.0.md with the Build-line placeholder
provides:
  - Signed 2.0.0 (versionCode 9) release AAB for Play closed testing
  - Build-level SDK/dependency audit on the shipped build (LISTING.md)
  - Play build record in docs/UAT-v2.0.md
  - Local lightweight tag v2.0.0-play9
affects: [milestone close (D-08 debug APK), Play closed-testing upload (user)]
tech-stack:
  added: []
  patterns:
    - "Untracked sfx/ files held outside the repo during build-www, restored and sha256-verified"
key-files:
  created:
    - .planning/phases/69-compliance-device-close/69-04-SUMMARY.md
  modified:
    - android/version.properties
    - store-listing/LISTING.md
    - docs/UAT-v2.0.md
decisions:
  - "The two cap-sync-regenerated files (android/app/capacitor.build.gradle, android/capacitor.settings.gradle) came back stat-dirty but byte-identical to HEAD; restored per file with git checkout -- rather than committed"
  - "The UAT Build line names the release commit by its tag (v2.0.0-play9), not a hash, so no amend was needed"
metrics:
  duration: "~12 min (build 185 s wall clock, Gradle 2m 42s)"
  completed: 2026-09-24
---

# Phase 69 Plan 04: v2.0 Release Build (2.0.0 / versionCode 9) Summary

Signed 2.0.0 (versionCode 9) release AAB built with the unchanged `npm run android:release` flow on the pinned AGP 8.13.0 toolchain. It is verified signed with the upload key, carries exactly the 30 delivered sfx clips, and passes the build-level audit: 0 forbidden SDKs, no AD_ID, no google-services. It is recorded in LISTING.md and UAT-v2.0.md, committed as `chore(release)` and tagged `v2.0.0-play9` locally. Nothing was uploaded or pushed.

## Pre-flight (Task 1)

| Check | Result |
|---|---|
| Location | `git rev-parse --show-toplevel` = `C:/projects/mazeworld`, `--git-dir` = `.git` (main checkout, not a worktree) |
| Keystore | `android/keystore.properties` exists; `git check-ignore` exit 0; `grep -cE` over the key names storeFile/storePassword/keyAlias with non-empty values = 3. No value was printed, logged or staged |
| Tree | Clean. Only untracked: `sfx/theme.mp3`, `.claude/worktrees/`. 69-01/02/03 SUMMARY commits all on master (47fbdb3, d4a335b, d53731d) |
| Clip held aside | `sfx/theme.mp3`: 2,318,486 bytes, sha256 `0e3bed0a820e6ed02db5b4be074c69b8f0022cf606622dc3188fb69f79d702d0`, moved to `C:/Users/Dell/AppData/Local/Temp/claude/C--projects-mazeworld/2f8af486-f6d4-4a3b-8aa5-cc423e23203b/scratchpad/theme.mp3`. Untracked-file scan over sfx, src, engine, content, assets, fonts, icons, vendor, mazeworld.html: empty |
| Suite | `npm test`: 5045 tests, **0 failures** (clip held aside, AUD-06 passing) |
| Bump dry-run | `versionCode 8 -> 9, versionName 1.9.0 -> 2.0.0` |
| Bump | `npm run version:bump -- --name 2.0.0`: only the two value lines changed |

## Build (Task 2)

- `npm run android:release` (cap sync, pin-jdk, signed bundleRelease; no bump), started 2026-09-24T06:38:22Z, exit 0, **BUILD SUCCESSFUL in 2m 42s** (185 s wall clock including build:www and cap sync).
- The clip was moved back as soon as the command returned. sha256 after restore: `0e3bed0a820e6ed02db5b4be074c69b8f0022cf606622dc3188fb69f79d702d0` (**matches**). Still untracked, never staged.
- Build noise: `lintVitalAnalyzeRelease` printed the "Module was compiled with an incompatible version of Kotlin (metadata 2.4.0, expected 2.2.0)" lines for the Play Games plugin and kotlin-stdlib 2.4.10. Lint reports these and they do not fail the build. This is the known consequence of the plugin's KGP 2.4.10 against the pinned toolchain (docs/RELEASING.md), and the build completed. Also the usual Gradle 9 deprecation notice.

### AAB

| Fact | Value |
|---|---|
| Path | `android/app/build/outputs/bundle/release/app-release.aab` |
| mtime | 2026-09-24 02:41:26 -0400 (newer than the build start marker) |
| Size | 10,352,033 bytes |
| sha256 | `bcaaa1b30fcf0b4683c2c78236880bb03becafbd9239edcf1ff6366664813f97` |
| Signer (keytool -printcert) | Signer #1, owner `CN=Sterling Heibeck, L=Grand Rapids, ST=MI, C=001` (self-issued), serial 1, valid 2026-09-10 to 2051-09-04, SHA256withRSA |
| Cert SHA-256 | `50:45:7F:A3:B8:D5:5F:D0:EF:89:C5:74:BF:40:B3:F3:02:9F:EC:C4:9F:50:C5:1D:86:B1:AF:DD:5E:02:56:DD` |
| Cert SHA-1 | `1D:B5:C3:4A:0B:27:47:0C:27:9D:5C:90:12:CB:C3:2B:9B:A9:00:46` |
| Entries | 794 total; **30** `.mp3` under `base/assets/public/sfx/`; `theme.mp3` entries: **0**; no .mp3 outside sfx |
| Play Games plugin vendor folder | `base/assets/public/vendor/@modbender/capacitor-play-games/` |

### Merged release manifest

`android/app/build/intermediates/merged_manifests/release/processReleaseManifest/AndroidManifest.xml`: package `com.darktierstudios.delvedierepeat`, `android:versionCode="9"`, `android:versionName="2.0.0"`, `com.google.android.gms.games.APP_ID` meta-data (`@string/game_services_project_id`). Permissions: `android.permission.INTERNET`, `android.permission.VIBRATE`, `com.darktierstudios.delvedierepeat.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`. AD_ID count: 0.

### Toolchain pin

`git diff --quiet -- android/gradle.properties android/build.gradle android/variables.gradle android/gradle/wrapper` exit 0. AGP 8.13.0 / Gradle 8.14.3 / JDK 21 untouched.

### Build-level audit (D-04)

| Check | Result |
|---|---|
| `node tools/gradle.mjs :app:dependencies --configuration releaseRuntimeClasspath` | exit 0, 320-line report (scratchpad) |
| Forbidden grep (firebase, admob, play-services-ads, ads-identifier, analytics, measurement, crashlytics, appsflyer, adjust, facebook, appcenter, sentry, bugsnag) | **0 hits** |
| play-services-games-v2 | 22.0.0 (same as 67-06) |
| play-services-base | 18.5.0 (same) |
| play-services-basement | 18.9.0, 18.4.0 requested (same) |
| play-services-tasks | 18.2.0 (same) |
| kotlin-stdlib | 2.4.10 (same) |
| google-services.json | absent, so the plugin is not applied |
| www/ network-API grep | 7 files: `www/src/browser/sfx.js` + six `www/vendor/@capacitor/core/` files. Identical to 69-01's classified list; `www/sfx/` holds 30 files, no theme |

Recorded in `store-listing/LISTING.md` under "### Build-level audit (2.0.0, versionCode 9, 2026-09-24)" in the Data safety section. `node --test test/unit/store-listing.test.js`: 6/6 pass (with play-games-runbook: 47/47).

**Defect findings: none.**

## Record, commit, tag (Task 3)

- `docs/UAT-v2.0.md` Build line filled: 2.0.0 (9), the AAB path, size, sha256, cert SHA-256, "the release commit tagged `v2.0.0-play9`", the user uploads it by hand (row 0.3). It also says the placeholder APP_ID (`000000000000`) and `PLACEHOLDER_` board IDs are still in this build, so sign-in fails gracefully and boards are skipped until row 0.2's rebuild. The D-08 debug-APK sentence is kept.
- Commit **8a94af5** `chore(release): 2.0.0 (versionCode 9) — v2.0 Leaderboards for Play closed testing`. It changes exactly android/version.properties, docs/UAT-v2.0.md and store-listing/LISTING.md, staged by name.
- Tag **v2.0.0-play9**: lightweight (`git cat-file -t` = commit, same as v1.9.0-play8), resolves to HEAD 8a94af5. Not pushed; `git ls-remote` not run.
- Final `git status --porcelain`: only `?? .claude/worktrees/` and `?? sfx/theme.mp3`.

## Deviations from Plan

**1. [Rule 3 - Blocking] cap sync left two generated Gradle files stat-dirty**
- **Found during:** Task 2, after the build
- **Issue:** `android/app/capacitor.build.gradle` and `android/capacitor.settings.gradle` showed as ` M`, but `git diff` was empty and a CR-stripped byte compare against HEAD was identical. It was a regeneration and line-ending touch, not a content change.
- **Fix:** `git checkout -- <those two files>` (per file, no content lost), so the release commit holds exactly the three planned files and the final tree is clean.
- **Commit:** none (no content change)

Otherwise the plan ran as written. The full `npm test` was not re-run after the clip was restored, because the only changes after the green run were two docs and the version file (no test reads version.properties). Both doc tests were re-run and pass. With the clip back, AUD-06 fails as known and expected.

## Known Stubs

- Play Games IDs are still the pre-console values (`games-ids.xml` APP_ID `000000000000`, `content/leaderboards.js` `PLACEHOLDER_*_S1`). This is intentional and expected per the plan: this build ships with Play Games inert (graceful sign-in failure, boards skipped) until the user completes the console setup and a versionCode-bumped rebuild (UAT row 0.2).

## Human verification (deferred to end of run)

1. **User, by hand:** upload `android/app/build/outputs/bundle/release/app-release.aab` (2.0.0, versionCode 9, sha256 `bcaaa1b3...813f97`) in Play Console: Delve, Die, Repeat -> Test and release -> Testing -> Closed testing -> Create new release (UAT row 0.3). Claude never uploads.
2. **Orchestrator, at milestone close (D-08):** build the milestone debug APK, record it on the UAT-v2.0.md Build line, and make the Pixel 7 install offer. Warning: the debug APK and the Play build have different signers, so switching between them needs an uninstall, and the uninstall **deletes save data** (current run, graveyard, bests, settings, queued submissions).
3. **Orchestrator, at milestone close:** push master and the local tag `v2.0.0-play9`. It was not pushed here.

## Self-Check: PASSED

- FOUND: android/app/build/outputs/bundle/release/app-release.aab (10,352,033 bytes, sha256 matches the record)
- FOUND: commit 8a94af5, tag v2.0.0-play9 -> 8a94af5
- FOUND: store-listing/LISTING.md contains "releaseRuntimeClasspath" and the AAB sha256
- FOUND: docs/UAT-v2.0.md contains "v2.0.0-play9"
- FOUND: sfx/theme.mp3 restored, sha256 unchanged, untracked
- No keystore value appears in any output, this SUMMARY or git
