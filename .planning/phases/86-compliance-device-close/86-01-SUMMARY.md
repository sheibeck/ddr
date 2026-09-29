---
phase: 86-compliance-device-close
plan: 01
subsystem: build
tags: [android, capacitor, patch-notes, gradle, debug-apk, release-audit]

# Dependency graph
requires:
  - phase: 85-play-games-out-our-board-in
    provides: "Play Games fully removed (RETIRE-01..03), our own board and account layer (ACCT-03..06) — the code this debug APK ships"
  - phase: 84-leaderboards-panel-v3
    provides: "the v3 Leaderboards panel (BOARD-18..27) — the other half of what 2.2.0's notes describe"
provides:
  - "android/version.properties stamped 2.2.0 (versionCode 12)"
  - "docs/patch-notes/2.2.0.md — DRAFT, unagreed notes describing Phases 84/85"
  - "regenerated src/browser/patchNotesData.js for 2.2.0"
  - "one debug APK (android/app/build/outputs/apk/debug/app-debug.apk), its identity recorded below"
  - "the build-level audit facts 86-04 needs for store-listing/LISTING.md"
affects: [86-04-store-listing-audit, 86-05-uat-v2.2, release-checklist]

# Tech tracking
tech-stack:
  added: []
  patterns: ["patch-notes DRAFT-paragraph-before-first-## convention (validator-transparent, in-game-visible)"]

key-files:
  created:
    - docs/patch-notes/2.2.0.md
  modified:
    - android/version.properties
    - src/browser/patchNotesData.js
    - test/unit/patch-notes-pipeline.test.js

key-decisions:
  - "docs/patch-notes/2.2.0.md carries only Headline and Interface categories — no player-visible bug was fixed in Phases 84/85 (only dev-doc index re-keying, not player-facing), so Bug fixes is correctly dropped per the README's empty-category rule."
  - "Fixed a second, previously-unnoticed hardcoded-2.1.0 assertion in test/unit/patch-notes-pipeline.test.js (the --site CLI default-version test at the old line 358-365) that the version bump broke, beyond the single release-gate test the plan named at lines 225-230; Rule 1 auto-fix, same file already in scope."
  - "Widened the www/ network-API audit beyond the plan's literal grep\\(fetch\\(\\) to also catch fetch.bind( call sites, because the board/identity/bug-report code deliberately never calls fetch( directly (dependency-injected fetchFn) — the literal command finds zero hits for the real Firestore/Identity-Toolkit traffic; recorded both results below for 86-04's accuracy."

requirements-completed: [COMP-04]

coverage:
  - id: D1
    description: "android/version.properties reads versionCode=12, versionName=2.2.0"
    requirement: "COMP-04"
    verification:
      - kind: unit
        ref: "grep -c '^versionCode=12$' android/version.properties; grep -c '^versionName=2.2.0$' android/version.properties"
        status: pass
    human_judgment: false
  - id: D2
    description: "docs/patch-notes/2.2.0.md exists, valid, DRAFT-marked, no Play Games name or sign-on wording"
    requirement: "COMP-04"
    verification:
      - kind: unit
        ref: "node tools/patch-notes.mjs --check (exit 0); node --test test/unit/patch-notes-pipeline.test.js"
        status: pass
    human_judgment: false
  - id: D3
    description: "One debug APK built via npm run android:debug, stamped 2.2.0 (12), identity recorded (path, size, sha256, build commit)"
    requirement: "COMP-04"
    verification:
      - kind: other
        ref: "aapt2 dump badging android/app/build/outputs/apk/debug/app-debug.apk (versionCode=12 versionName=2.2.0); sha256sum"
        status: pass
    human_judgment: false
  - id: D4
    description: "Build-level audit facts (dependency tree, merged manifest, capacitor.plugins.json, www/ network APIs, runtime packages) recorded for 86-04"
    verification:
      - kind: other
        ref: "node tools/gradle.mjs :app:dependencies --configuration releaseRuntimeClasspath; grep of merged debug manifest; capacitor.plugins.json read"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-09-29
status: complete
---

# Phase 86 Plan 01: Debug APK 2.2.0 (12) + DRAFT Patch Notes Summary

**Bumped to 2.2.0 (versionCode 12), drafted the unagreed 2.2.0 patch notes covering the new own-board Leaderboards panel and Play Games removal, then built and identified the milestone's one debug APK plus the build-level audit facts 86-04 needs.**

## Performance

- **Duration:** ~45 min (incl. one 3m38s Gradle build)
- **Started:** 2026-09-29T18:35:00Z
- **Completed:** 2026-09-29T18:46:44Z
- **Tasks:** 2
- **Files modified:** 4 (3 tracked commits + 1 new file; the APK is a git-ignored build output)

## Accomplishments
- `android/version.properties` bumped 11/2.1.0 → 12/2.2.0 via `node tools/bump-version.mjs --name 2.2.0`.
- `docs/patch-notes/2.2.0.md` drafted in house style: title, a single DRAFT paragraph before the first `## `, `## Headline` (382/500-character Play cut) and `## Interface` describing the v3 Leaderboards panel, the ☰/title-chip account block (@handle, RE-ROLL HANDLE, ERASE MY RUNS, COMPETE ON/OFF), "You placed Nth of M.", Compete-OFF runs staying off the board for good, REPORT A BUG's cooldown/cap, the ☰ CENTRE MAP removal, and YOUR DEAD's 2.1.0 cutoff — with no Play Games product name and no sign-on wording anywhere in the file.
- `src/browser/patchNotesData.js` regenerated for 2.2.0; `node tools/patch-notes.mjs --check` exits 0.
- `test/unit/patch-notes-pipeline.test.js`'s release-gate pin moved to 2.2.0; a second CLI default-version test the version bump also broke was fixed (see Deviations).
- One debug APK built (`npm run android:debug`): `android/app/build/outputs/apk/debug/app-debug.apk`, stamped 2.2.0 (12).
- Build-level audit facts for 86-04 collected and recorded below (dependency tree, merged manifest, `capacitor.plugins.json`, `www/` network APIs, runtime package list).

## Task Commits

Each task was committed atomically:

1. **Task 1: Gate on Phase 85, bump to 2.2.0 (12), draft the DRAFT 2.2.0 notes and regenerate the notes module** - `61617177` (feat)
2. **Task 2: Build the debug APK and record its identity plus the build-level audit facts** - no tracked-file commit (the APK is a git-ignored build output; `git status --porcelain` was empty after the build)

**Plan metadata:** (this commit, following)

## Files Created/Modified
- `android/version.properties` - versionCode 11→12, versionName 2.1.0→2.2.0
- `docs/patch-notes/2.2.0.md` - new DRAFT patch notes (Headline + Interface)
- `src/browser/patchNotesData.js` - regenerated for 2.2.0
- `test/unit/patch-notes-pipeline.test.js` - release-gate pin + CLI default-version test moved to 2.2.0
- `android/app/build/outputs/apk/debug/app-debug.apk` - the debug APK (git-ignored, not committed)

## Decisions Made
- Dropped the "Bug fixes" category from the 2.2.0 notes: Phases 84/85 shipped no player-visible bug fix (the only "fix" on record, 85-01, corrected an internal narrative-pass doc-ledger index, not player-facing behavior), so the README's empty-category rule applies.
- Widened the www/ network-API audit beyond the plan's literal `fetch\(` grep to also list `fetch.bind(` call sites (see Audit facts below) — the board/identity/bug-report wiring deliberately injects `fetchFn` rather than calling `fetch(` directly, so the literal command alone would have under-reported the real Firestore/Identity-Toolkit traffic to 86-04.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A second hardcoded-2.1.0 test broke on the version bump, outside the plan's named line range**
- **Found during:** Task 1 (running the required `node --test` suite after the bump)
- **Issue:** `test/unit/patch-notes-pipeline.test.js`'s `"CLI: --site <dir> validates, writes the file under the site dir, and prints its path"` test invokes the `patch-notes.mjs` CLI with no `--version` flag, so it defaults to `readVersionName(REPO_ROOT)` — the real, now-bumped `android/version.properties`. The test's own assertions still hardcoded `"2.1.0"`, so it failed once the live version became 2.2.0. The plan named only the release-gate test at the old lines 225-230 for this kind of fix; this second test was an oversight in that scope, but it is directly caused by this task's own version bump.
- **Fix:** Updated both hardcoded `"2.1.0"` occurrences in that test to `"2.2.0"`, matching the pattern already applied to the release-gate test.
- **Files modified:** `test/unit/patch-notes-pipeline.test.js` (already in the plan's `files_modified` list)
- **Verification:** `node --test test/unit/patch-notes-pipeline.test.js test/unit/patch-notes.test.js test/unit/notes-sheet-shell.test.js test/unit/stale-terms.test.js test/unit/voice-corpus.test.js test/unit/retire-sweep.test.js` — 118/118 pass, 0 fail.
- **Committed in:** `61617177` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary for the required test suite to pass after the version bump; no scope creep — same file the plan already had in `files_modified`.

## Issues Encountered
- The plan's exact `grep -rlE "fetch\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource" www/` command reports only `www/src/browser/sfx.js` and the Capacitor core vendor files — it misses the real board/identity/bug-report Firestore traffic because that code path deliberately never calls `fetch(` directly (dependency-injected `fetchFn`, by design per `firestoreRest.js`'s own header comment: "this module never calls a global fetch... only through an injected fetchFn"). Resolved by also searching for `fetch.bind(` and reading the wiring sites in `www/index.html`; both result sets are recorded below so 86-04 has the complete picture, not just the literal grep's under-count.

## User Setup Required

None - no external service configuration required.

## Human verification (deferred to end of run)

None build-specific beyond the standard install: the orchestrator installs this debug APK (2.2.0, versionCode 12, sha256 below) on the Pixel 7 next; nothing in this plan changed device-facing behavior that needs its own check beyond what 86-05's batched UAT-v2.2 already covers for Phases 84/85.

## Next Phase Readiness
- 86-02 (darktier-studio site pages) and 86-03 (docs retirement, UAT-v2.2 build header) can both cite this plan's version stamp (2.2.0, versionCode 12) and this SUMMARY's audit facts.
- 86-04 has everything it needs to refresh `store-listing/LISTING.md`'s source- and build-level audits without a second Gradle run: the dependency-tree term counts (all zero), the merged debug manifest's permission list and the confirmed absence of `com.google.android.gms.games.APP_ID`, the `capacitor.plugins.json` list, and the classified `www/` network-API file list (literal + widened).
- No release build, bundle, Play upload, rules deploy or website deploy happened in this plan, as required.

---

## Debug APK

- **Path:** `android/app/build/outputs/apk/debug/app-debug.apk`
- **Byte size:** 13,798,019 bytes
- **sha256:** `6d8690884110b0e481a31a7389cdb47c148b409d8caa2934a309fb15a08f5e60`
- **versionCode / versionName:** 12 / 2.2.0 (confirmed via `aapt2 dump badging`, build-tools 36.0.0: `versionCode='12' versionName='2.2.0'`)
- **Build commit:** `616171775dad8cf3b2e0a588babc630f21bdd6ec` (this plan's Task 1 commit; shipped paths — `mazeworld.html`, `src`, `content`, `engine`, `android/app/src`, `android/version.properties`, `docs/patch-notes` — were clean at build time)
- **Build date:** 2026-09-29 (gradle `assembleDebug`, `BUILD SUCCESSFUL in 3m 38s`)
- **www/ stamp confirmed:** `grep -rl "2.2.0 (12)" www/` hits `www/index.html`
- No release bundle was produced: `android/app/build/outputs/bundle/release/app-release.aab` is unchanged from 2026-09-28 (pre-existing, prior milestone's artifact), and no tracked file changed (`git status --porcelain` empty after the build).

## Audit facts for 86-04

**Dependency tree** (`node tools/gradle.mjs :app:dependencies --configuration releaseRuntimeClasspath`, raw output kept in the session scratchpad, not the repo):
- Case-insensitive term counts, all **0 hits**: firebase, admob, play-services-ads, ads-identifier, analytics, measurement, crashlytics, appsflyer, adjust, facebook, appcenter, sentry, bugsnag.
- `play-services-games`: **0 hits**.
- `com.google.android.gms` artifacts remaining: **none** (the prior audit's five-row Google Play services table — `play-services-games-v2`, `play-services-base`, `play-services-basement`, `play-services-tasks`, `kotlin-stdlib` — is now empty; the plugin and its transitive Google Play services dependencies are fully gone from the release runtime classpath).

**Merged debug manifest** (`android/app/build/intermediates/merged_manifests/debug/processDebugManifest/AndroidManifest.xml`):
- `android:versionCode="12"`, `android:versionName="2.2.0"`.
- `uses-permission` entries (3, unchanged from the last-published build): `android.permission.INTERNET`, `android.permission.VIBRATE`, `com.darktierstudios.delvedierepeat.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` (androidx). No `AD_ID`.
- `com.google.android.gms.games.APP_ID` meta-data: **absent** (0 hits) — confirms 85-06's removal survives a live build.

**`android/app/src/main/assets/capacitor.plugins.json`** — 5 entries, Capacitor's own plugins only:
`@capacitor/app`, `@capacitor/haptics`, `@capacitor/preferences`, `@capacitor/screen-orientation`, `@capacitor/splash-screen`.

**Network APIs in the freshly built `www/`:**

Literal `grep -rlE "fetch\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource" www/` (the plan's exact command):

| File hit | Classification |
|---|---|
| `www/src/browser/sfx.js` | Same-origin `fetch(` of a bundled `./sfx/<clip>.mp3` file inside the app; no network |
| `www/vendor/@capacitor/core/{capacitor,index,index.cjs}.js` (+ `.map`) | Capacitor's own `CapacitorHttp` web patch; inert — `capacitor.config.json` does not enable `CapacitorHttp` |

Widened `grep -nE "fetch\.bind|XMLHttpRequest|WebSocket|sendBeacon|EventSource" www/index.html` (see Issues Encountered — the board/identity/bug-report code injects `fetchFn` rather than calling `fetch(` directly, so the literal command above misses it):

| File hit | Classification |
|---|---|
| `www/index.html:7370` `boardFetchFn()` | `globalThis.fetch.bind(globalThis)`, gated on `window.Capacitor?.isNativePlatform?.()` — the live board read/write path against the deployed Firestore REST project on a native (Android) build; in the browser dev loop it uses Phase 83's in-memory fake instead |
| `www/index.html:7851` `sharedIdentity()` | `globalThis.fetch.bind(globalThis)` passed to `createIdentity` — the one anonymous-identity request (Firebase Identity Toolkit / Secure Token) shared by bug reports and, on native, the board account; created lazily, never touched until an explicit player action |
| `www/index.html:7965` `sendBugReport(...)` | `globalThis.fetch.bind(globalThis)` passed as the bug-report POST's `fetchFn` — the REPORT A BUG Send action's one Firestore REST write |

No hit in any other shipped file; no retired Play Games network code remains. **Defect findings: none** — every network call is either inert (Capacitor's unused HTTP patch), same-origin (sfx), or an explicit board/identity/bug-report call gated on Compete or a player's own Send action, matching the 86-CONTEXT decision ("Firebase REST now present, plugin gone, INTERNET now used for our board and bug reports").

**`package.json` dependencies** (7): `@capacitor/android`, `@capacitor/app`, `@capacitor/core`, `@capacitor/haptics`, `@capacitor/preferences`, `@capacitor/screen-orientation`, `@capacitor/splash-screen`. One devDependency: `@capacitor/cli`.

**Lockfile non-dev package entries** (8): the 7 dependencies above plus `tslib`. Down from the pre-85 count of 9 (`@modbender/capacitor-play-games` removed in 85-06; `@capacitor/status-bar` was already removed in Phase 80).

## Self-Check: PASSED

- FOUND: `docs/patch-notes/2.2.0.md`
- FOUND: `src/browser/patchNotesData.js` (regenerated, tracked)
- FOUND: `android/app/build/outputs/apk/debug/app-debug.apk`
- FOUND commit `61617177` in `git log --oneline`

---
*Phase: 86-compliance-device-close*
*Completed: 2026-09-29*
