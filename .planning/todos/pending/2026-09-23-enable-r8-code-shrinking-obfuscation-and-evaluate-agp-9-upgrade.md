---
created: 2026-09-23T17:52:30.553Z
title: Enable R8 code shrinking/obfuscation and evaluate AGP 9 upgrade
area: tooling
resolves_phase: 80
files:
  - android/app/build.gradle:55-62
  - android/app/proguard-rules.pro
  - android/build.gradle:10
  - docs/RELEASING.md
---

## Problem

Play Console flags three related Android build-quality items (user, 2026-09-23):

1. **DEX code optimization.** See https://developer.android.com/topic/performance/issues/code-optimization. The release build ships unoptimized DEX: `android/app/build.gradle` has `release { minifyEnabled false }` with the non-optimizing `proguard-android.txt` default, so R8 never shrinks, optimizes or obfuscates.
2. **Obfuscation is at 2%.** This follows from the same setting. With minify off, almost nothing is renamed.
3. **Upgrade to AGP 9.0 and use R8.** The project pins AGP 8.13.0 / Gradle 8.14.3 (`android/build.gradle:10`). STATE.md's ground truth says "AGP 8.13.0 / Gradle 8.14.3 — don't let Studio upgrade", because Capacitor 8's supported toolchain and the `pin-jdk` / `tools/gradle.mjs` build path were tuned around it.

Context: the game is almost entirely JS in the WebView (`www/`). The DEX is only the Capacitor bridge, the plugins (`@capacitor/preferences`, `app`, `splash-screen`, `status-bar`, `haptics`, etc.) and AndroidX. The runtime-performance win is therefore modest (smaller DEX, faster class loading and cold start). The main payoffs are clearing the Play Console recommendations, a smaller AAB, and obfuscation. None of this touches `engine/`, `content/` or parity.

## Solution

Two independent steps. Do R8 first, because it is low-risk and works on AGP 8.13.

**Step 1 — R8 on the current AGP (8.13):**
- In `release`: set `minifyEnabled true` and `shrinkResources true`, and switch to `getDefaultProguardFile('proguard-android-optimize.txt')`.
- Capacitor and its official plugins ship consumer ProGuard rules. Verify that the bridge's reflection-based plugin registration survives: `@CapacitorPlugin`/`@PluginMethod` classes, `com.getcapacitor.**`. Add `-keep` rules in `proguard-rules.pro` only where a release build breaks.
- R8 writes `mapping.txt`, and the AAB bundles it, so Play can deobfuscate crash stack traces. Confirm Play Console shows the deobfuscation file on upload.
- Verify on the Pixel 7 with a **release-signed** build, not the debug APK, because minify only runs on release:
  - boot
  - save/resume through Preferences
  - the back button (`@capacitor/app`)
  - splash, status bar, haptics
  - sound
- Measure AAB size and cold start against the v1.8 baseline (`docs/PERF-BASELINE.md`).
- Record the change in `docs/RELEASING.md`.

**Step 2 — AGP 9.0 (evaluate, don't assume):**
- Check that Capacitor 8.x (`@capacitor/android`) and every installed plugin officially support AGP 9 and the Gradle version it requires. AGP majors drop deprecated DSL, and `minifyEnabled` → `isMinifyEnabled` naming matters in `.kts` only.
- Check the Android Studio version requirement (currently Otter).
- Re-run the whole release chain: `npm run play:release`, `npx cap sync` (which wipes `org.gradle.java.home`; pin-jdk re-applies it), `tools/gradle.mjs`, JDK 21 pin.
- If Capacitor doesn't support AGP 9 yet, defer step 2 and note it. Step 1 alone clears the R8 and obfuscation items.
- This overturns the standing "don't let Studio upgrade" rule, so update STATE.md's Build/env ground truth when it lands.

Good as a quick task or a small infra phase. Worth doing before the Play production launch (STR track).

## Update 2026-09-23 — AGP 9.3.1 spike result (Phase 67, D-21)

`.planning/phases/67-play-games-integration-account-chip/67-AGP9-SPIKE.md` tried the whole-build move to **AGP 9.3.1 / Gradle 9.5.0** and the verdict was to **stay on AGP 8.13.0**. The Play Games plugin (`@modbender/capacitor-play-games@0.5.0`) builds unmodified on 8.13. Its own AGP 9.3.1 buildscript is shadowed by the root classpath.

Three root-config fixes got AGP 9 as far as Kotlin compilation. All three must be threaded through `tools/pin-jdk.mjs`, because `cap sync` rewrites `gradle.properties`:
- `proguard-android-optimize.txt`
- `android.builtInKotlin=false`
- `android.newDsl=false`

The build then **hard-fails inside the plugin's shipped source**: `Pgs.kt:144`, "Returns are prohibited for functions with an expression body". **Step 2 is therefore blocked upstream.** Re-run the spike when the plugin publishes a release that fixes it, or drops its self-applied `org.jetbrains.kotlin.android`. Step 1 (R8 on 8.13) is unaffected and still worth doing.
