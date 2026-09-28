---
phase: 80-android-release-build-tooling
plan: "04"
subsystem: infra
tags: [android, r8, release-build, gradle, aab, apk, deprecated-api-scan, capacitor]
requires:
  - phase: 80-android-release-build-tooling (80-01, 80-02, 80-03, 80-06)
    provides: "the R8 config, the scanner, the status-bar removal, appCategory and letterbox, the fit-tool resume"
  - phase: 79.1-milestone-balance-check-deep-floor-tuning
    provides: "the verified milestone code (the precondition gate)"
provides:
  - "Phase 80's ONE unsigned R8 release build, persisted at C:/projects/mazeworld-build/phase80-acba40ed/ with BUILD-INFO.txt and SHA256SUMS.txt, plus a debug-signed copy for the emulator and device"
  - "every build-dependent DROID-01/02/03 check run against that build"
  - "docs/ANDROID-DISPLAY.md: the edge-to-edge/system bars section (DROID-02) and the deprecated window API audit; docs/RELEASING.md: the measured build; store-listing/LISTING.md: the Phase 80 addendum"
requirements-completed: [DROID-01, DROID-02, DROID-03]
duration: "~50min (the build itself 7m 21s)"
completed: 2026-09-28
status: complete
---

# Phase 80 Plan 04: the one release build, persisted and checked (summary)

(The orchestrator wrote this from the executor's returned text. Tasks 1–3 changed no tracked file. Task 4's docs are df1083f0, merged into master.)

BUILD_COMMIT: acba40ed9259f2a107c5355f5937417c0b256720
ARTIFACT_DIR: C:/projects/mazeworld-build/phase80-acba40ed

## Checks (all read-only, against ARTIFACT_DIR; no rebuild)
1. **Gate:** 79.1 is verified; the 80-01/02/03/06 SUMMARYs exist; the tree is clean; there is no keystore.properties. Printed `gate ok`.
2. **The one build:** a single `node tools/gradle.mjs bundleRelease assembleRelease` gave BUILD SUCCESSFUL in 7m 21s, with no missing_rules.txt.
   - It is unsigned (there is no app-release.apk).
   - The cap:sync regeneration is byte-identical to 80-02's commit.
   - The debug-signed copy's certificate is `CN=Android Debug`.
3. **R8 keeps:**
   - All 6 plugin classpaths and SystemBars keep their identity.
   - The `MessageHandler#postMessage` member is unrenamed (the class itself becomes p0).
   - androidx is renamed, so obfuscation is on.
4. **The status-bar plugin is gone** from both mapping.txt and capacitor.plugins.json.
5. **The mapping ships:** the AAB carries `BUNDLE-METADATA/com.android.tools.build.obfuscation/proguard.map`.
6. **Shrink survivors:** splash_screen, game_services_project_id, `assets/public/index.html` and `capacitor.config.json` are all present.
7. **Deprecated-API scan:** exit 0; 23 call sites across 15 caller methods; 0 unresolved; 0 `--fail-on` matches. The AAB and the APK give the same results. The splash-screen `legacyFullscreen`/`legacyImmersive` calls survive through the library's own consumer rules but are unreachable with this app's config.
8. **Manifest:** `appCategory` = 0 (game); `screenOrientation` = 1 (portrait).
9. **Sizes:** the AAB is 11,298,002 bytes and the APK 10,916,555 bytes, 11.3% below the pre-R8 AAB (12,740,741).
10. **Letterbox at the end state:** 5/5 viewports pass, including the four newer overlays (final, report and notes sheets, and fade).

## SHA256 (from SHA256SUMS.txt)
- `app-release.aab` 45c917df209264259cac6f67d0a5428a4d13a9d3fcc65254b0caaa3d73b0f237
- `app-release-unsigned.apk` d3a049568a93bd4625b2f1ee7a0fb5485840a56bc8efe7a26275a1942702fdd8
- `app-release-debugsigned.apk` 9d976a7fd6840724d3baf85df6100bc0d68660c77ead721c61dcf5c97bf1b37e
- `mapping.txt` b7a821e961e9ba4d8de1195ce2a73c58c8d3dadd08db9e1b8479b33313917ff8

## Deviations
None. There was no second Gradle invocation, no version bump and no full npm test. The Gradle daemon was stopped.

## At the milestone close
- Confirm on the Pixel 7 that the release-signed build runs cleanly.
- After the next upload, check that Play's pre-launch report no longer shows warnings 1 and 2, or that it names only the residual androidx and splashscreen back-compat rows recorded in the audit.
