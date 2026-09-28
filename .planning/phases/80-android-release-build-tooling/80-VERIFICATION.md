---
phase: 80-android-release-build-tooling
status: passed
verified: 2026-09-28
verifier: orchestrator (verification agents off)
human_verification:
  - "docs/UAT-v2.1.md §16: the R8 Play build on the Pixel 7 (boot, save and resume, back, sound and haptics, edge-to-edge in gesture and 3-button navigation, the cutout)"
  - "Play's next pre-launch report: the edge-to-edge and deprecated-API warnings are gone, or name only the recorded back-compat rows"
deferred:
  - "80-05, the emulator pass (tablet, foldable, nav modes): cancelled by the user on 2026-09-28 and deferred until the features are in"
---

# Phase 80 verification: Android release build tooling

**Verdict: passed.** The code and the build are verified. The device checks are deferred to the Pixel 7 round, and the emulator pass to a later milestone, by user ruling.

| Req | Evidence | Status |
|-----|----------|--------|
| DROID-01 (R8 release build + mapping) | 80-01 R8 config. 80-04: one release build (BUILD SUCCESSFUL); plugin classes and the bridge member are kept; androidx is obfuscated; the AAB ships proguard.map; the AAB is 11.3% smaller. Play 2.1.0/vc11 was signed from master a897fd9c and uploaded by the user. | passed (the Pixel 7 runtime check is in UAT §16.1–16.4) |
| DROID-02 (edge-to-edge, no deprecated APIs) | 80-02 swapped @capacitor/status-bar for the SystemBars core plugin. 80-04: status-bar is gone from mapping.txt and capacitor.plugins.json; the deprecated-API scan exits 0 with no `--fail-on` matches; the splash-screen legacy calls are unreachable with this config. | passed (nav-mode and cutout checks are in UAT §16.5–16.6) |
| DROID-03 (large-screen layout) | 80-03 letterbox column plus appCategory=game and a portrait lock. 80-04's manifest check: appCategory 0, screenOrientation 1. The browser letterbox passes 5/5 viewports (phone, tablet, foldable, Chromebook, the newer overlays), with screenshots in 80-screens/. | passed (emulator tablet/fold checks deferred with 80-05) |

| TOOL-01 (fit-tool resume retraces) | 80-06: `appendTranscript`, `--transcript`, and the `--force-infeasible` test seam. test/difficulty/fit-difficulty-cli.test.js proves a two-block resume retraces the live search exactly, including through a forced +Infinity point. It is in the full gate (7,902 pass). | passed |

Plans: 80-01, 02, 03, 04 and 06 are complete; 80-05 is deferred (see 80-05-SUMMARY.md).
