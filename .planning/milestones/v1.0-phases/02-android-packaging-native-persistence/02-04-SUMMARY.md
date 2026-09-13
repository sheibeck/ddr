---
phase: 02-android-packaging-native-persistence
plan: 04
subsystem: infra
tags: [capacitor, android, splash-screen, status-bar, screen-orientation, launcher-icon, self-hosted-fonts, gradle, aab, apk]

# Dependency graph
requires:
  - phase: 02-android-packaging-native-persistence (02-02)
    provides: "Capacitor 8 Android project + Node-builtins-only webDir build script (tools/build-www.mjs) + a proven-working assembleDebug toolchain (Temurin 21 pinned via tools/pin-jdk.mjs)"
  - phase: 02-android-packaging-native-persistence (02-03)
    provides: "src/browser/nativeChrome.js's registerNativeChrome, with splash-hide/status-bar/portrait calls stubbed pending this plan's real config"
provides:
  - "Branded splash (5-density drawable-*/splash_screen.webp) wired through capacitor.config.json's SplashScreen plugin block (androidSplashResourceName, launchAutoHide:false, backgroundColor #EFE7D6)"
  - "Two-layer portrait lock: AndroidManifest.xml android:screenOrientation=\"portrait\" (manifest-level, pre-JS) + nativeChrome's ScreenOrientation.lock('portrait') runtime backstop"
  - "Parchment status bar (StatusBar.setStyle LIGHT + setBackgroundColor #EFE7D6) — fixed a Rule-1 bug where 02-03's stub used the wrong Style constant"
  - "Android launcher icon (legacy + adaptive mipmaps, 5 densities) generated from assets/mazeworld-google-play-icon-512.png via a dependency-free System.Drawing/PowerShell resize, after npx @capacitor/assets proved broken in this environment"
  - "Self-hosted fonts: repo-root fonts/*.woff2 (Special Elite 400; Crimson Pro 400/600 normal + 400 italic; IBM Plex Mono 400/500/600), local @font-face rules in mazeworld.html, tools/build-www.mjs copies fonts/ into www/fonts/ — zero network font requests"
  - "PLT-01 fully closed: ./gradlew assembleDebug AND bundleDebug both BUILD SUCCESSFUL — app-debug.apk (6.7MB) and app-debug.aab (6.2MB) both present"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Build-machine tooling gaps (here: a broken @capacitor/assets 3.0.5 npx install — missing chevrotain transitive dep) fall back to a dependency-free System.Drawing PowerShell script rather than adding a new npm devDependency, consistent with 02-02's own pattern of avoiding package-manager installs for build-machine-only concerns."
    - "Self-hosted web fonts follow the same webDir-source-of-truth pattern as engine/content/src: a repo-root fonts/ directory is the single source, copied into www/fonts/ by tools/build-www.mjs's copyFonts() step; mazeworld.html's local @font-face rules use a relative ./fonts/... path that resolves identically whether the file is mazeworld.html (dev loop) or www/index.html (built bundle), since each sits one directory level above its own fonts/ folder."
    - "A Google Fonts variable-font instance (Crimson Pro's normal style) is requested once with Chrome's own UA string and, when the returned URL is identical for two requested weights, downloaded once and declared with a font-weight:400 600 CSS range — avoids shipping a duplicate file for what is the same underlying variable font."

key-files:
  created:
    - fonts/special-elite-400.woff2
    - fonts/crimson-pro-normal.woff2
    - fonts/crimson-pro-italic-400.woff2
    - fonts/ibm-plex-mono-400.woff2
    - fonts/ibm-plex-mono-500.woff2
    - fonts/ibm-plex-mono-600.woff2
    - android/app/src/main/res/drawable-mdpi/splash_screen.webp
    - android/app/src/main/res/drawable-hdpi/splash_screen.webp
    - android/app/src/main/res/drawable-xhdpi/splash_screen.webp
    - android/app/src/main/res/drawable-xxhdpi/splash_screen.webp
    - android/app/src/main/res/drawable-xxxhdpi/splash_screen.webp
  modified:
    - capacitor.config.json
    - android/app/src/main/AndroidManifest.xml
    - android/app/src/main/res/mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/ic_launcher.png
    - android/app/src/main/res/mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/ic_launcher_round.png
    - android/app/src/main/res/mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/ic_launcher_foreground.png
    - android/app/src/main/res/values/ic_launcher_background.xml
    - src/browser/nativeChrome.js
    - mazeworld.html
    - tools/build-www.mjs

key-decisions:
  - "npx @capacitor/assets generate --android failed at the CLI-load stage (Cannot find module 'chevrotain', a transitive dep of @xml-tools/parser) before ever touching the project — confirmed 02-RESEARCH.md's flagged staleness risk was real, not hypothetical. Fell back to a hand-rolled PowerShell script using .NET's built-in System.Drawing to resize the 512x512 source into all 5 density buckets' legacy (ic_launcher/ic_launcher_round) and adaptive-foreground (ic_launcher_foreground) PNGs — zero new npm dependency, matches 02-02's own pattern of using official/built-in tooling over an unverified package install."
  - "Recolored the adaptive icon's flat background layer (ic_launcher_background) from Capacitor's stock white to #14100E (dark stone) — the source icon is full-bleed dark archway artwork with no padding, so any launcher mask that clips outside the safe zone would otherwise show a jarring white ring; the dark tone blends with the artwork's own edges instead."
  - "Fixed a Rule-1 bug carried over from 02-03's stub: StatusBar.setStyle used Style.Dark (\"DARK\" = light text for dark backgrounds) against a light parchment (#EFE7D6) status bar — that combination renders invisible white-on-cream text. Corrected to Style.Light (\"LIGHT\" = dark text for light backgrounds) and added the paired setBackgroundColor(#EFE7D6) call the RESEARCH doc specified but 02-03 had not yet wired."
  - "Self-hosted fonts as a new repo-root fonts/ directory (not inside src/ or www/) — mirrors engine/content/src's existing pattern of a committed source directory that tools/build-www.mjs copies verbatim into www/, and keeps mazeworld.html's own relative ./fonts/... reference valid in both the plain browser dev loop and the built bundle without any path rewriting."
  - "Downloaded only the 'latin' Unicode-range subset for each font face/weight (not the vietnamese/latin-ext/cyrillic subsets Google Fonts' CSS also serves) — the game's UI text is English-only; this keeps the self-hosted footprint to 6 files (~166KB total) instead of the full multi-subset set Google's CDN would have lazily fetched per-visitor."
  - "Task 3 (final build gate) required no new file changes — tools/build-www.mjs was already modified and committed in Task 2, and the gate itself is a verification step (cap:sync + pin-jdk + assembleDebug + bundleDebug + node --test), so there is no Task-3-specific commit; this is recorded explicitly rather than fabricating an empty commit."

requirements-completed: [PLT-01, PLT-04]

coverage:
  - id: D1
    description: "Branded splash screen wired: 5-density splash_screen.webp assets present under android/app/src/main/res/, capacitor.config.json's SplashScreen plugin configured to match (androidSplashResourceName, launchAutoHide:false, backgroundColor #EFE7D6)"
    requirement: "PLT-04"
    verification:
      - kind: other
        ref: "for d in mdpi hdpi xhdpi xxhdpi xxxhdpi; do test -f android/app/src/main/res/drawable-$d/splash_screen.webp; done -> SPLASH_DRAWABLES_OK"
        status: pass
      - kind: other
        ref: "grep -q 'splash_screen' capacitor.config.json && grep -q 'splash_screen' android/app/src/main/assets/capacitor.config.json (post cap:sync) -> CHROME_CONFIG_OK / SYNCED_CONFIG_OK"
        status: pass
    human_judgment: false
  - id: D2
    description: "Portrait lock at both layers: AndroidManifest.xml android:screenOrientation=\"portrait\" on the main activity, plus nativeChrome's ScreenOrientation.lock('portrait') runtime backstop"
    requirement: "PLT-04"
    verification:
      - kind: other
        ref: "grep -q 'android:screenOrientation=\"portrait\"' android/app/src/main/AndroidManifest.xml -> CHROME_CONFIG_OK"
        status: pass
    human_judgment: false
  - id: D3
    description: "Parchment status bar (Style.Light dark-text-on-light + backgroundColor #EFE7D6) and launcher icon generated from the provided 512x512 source across all 5 mipmap densities (legacy + adaptive foreground)"
    requirement: "PLT-04"
    verification:
      - kind: other
        ref: "PowerShell System.Drawing resize script output: generated mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi} (legacy + foreground sizes) -> DONE; node --test 363/363 green after the nativeChrome.js edit"
        status: pass
    human_judgment: false
  - id: D4
    description: "Zero network font requests: the three font families (Special Elite, Crimson Pro, IBM Plex Mono) load from local self-hosted www/fonts/*.woff2, not fonts.googleapis.com/fonts.gstatic.com"
    requirement: "PLT-01"
    verification:
      - kind: other
        ref: "grep -riE 'fonts\\.(googleapis|gstatic)\\.com' mazeworld.html -> NO_CDN_FONT_REF"
        status: pass
      - kind: other
        ref: "npm run build:www && ls www/fonts/*.woff2 && grep -riE 'fonts\\.(googleapis|gstatic)\\.com' www/index.html -> FONTS_PRESENT / WWW_FONTS_LOCAL_OK"
        status: pass
    human_judgment: false
  - id: D5
    description: "The final headless build is green for BOTH the APK (assembleDebug) and the AAB (bundleDebug), closing PLT-01's \"produces an Android App Bundle\" wording"
    requirement: "PLT-01"
    verification:
      - kind: other
        ref: "JAVA_HOME=<temurin21> ./gradlew assembleDebug bundleDebug -> BUILD SUCCESSFUL in 1m 26s (251 actionable tasks); test -f app/build/outputs/apk/debug/app-debug.apk (6.7MB) && test -f app/build/outputs/bundle/debug/app-debug.aab (6.2MB) -> both present"
        status: pass
      - kind: unit
        ref: "node --test (full suite) -> 363/363 pass, run after every task in this plan"
        status: pass
    human_judgment: false
  - id: D6
    description: "On-device visual/feel proof: branded splash shows, app is portrait-locked, status bar matches theme, launcher icon renders correctly, app runs correctly in airplane mode with local fonts, back button and lifecycle-resume behave correctly"
    verification: []
    human_judgment: true
    rationale: "Native rendering (real WebView compositing of the splash/status-bar/mipmap resources, real OS orientation enforcement, real airplane-mode network isolation) cannot be exercised headlessly under node --test or a Gradle build. Explicitly deferred to end-of-milestone device UAT per 02-VALIDATION.md's three-tier verification architecture — every interface-level config/wiring decision behind this behavior (capacitor.config.json, AndroidManifest.xml, nativeChrome.js, the font @font-face rules) is asset-presence- and grep-verified above."

duration: ~20min
completed: 2026-09-08
status: complete
---

# Phase 02 Plan 04: Native Chrome + Self-Hosted Fonts + Final Build Gate Summary

**Branded splash/status-bar/portrait-lock/launcher-icon native chrome wired through capacitor.config.json + AndroidManifest.xml + nativeChrome.js, the three Google Fonts families self-hosted as local `.woff2` (zero network font requests), and the phase's final green build gate closed: `./gradlew assembleDebug` AND `bundleDebug` both `BUILD SUCCESSFUL`, producing `app-debug.apk` and `app-debug.aab`.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-09-08T12:19:00Z (approx., after 02-02's metadata commit)
- **Completed:** 2026-09-08T12:34:00Z (approx., after the final `node --test` run)
- **Tasks:** 3 (Task 3 produced no new file changes — see Decisions)
- **Files modified:** 22 (11 created: 5 splash webp + 6 font woff2; 11 modified: capacitor.config.json, AndroidManifest.xml, 15 mipmap PNGs across 5 densities counted as one bullet each below, ic_launcher_background.xml, nativeChrome.js, mazeworld.html, build-www.mjs)

## Accomplishments

- Copied the provided 5-density `splash_screen.webp` set into new `android/app/src/main/res/drawable-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/` directories and configured `capacitor.config.json`'s `SplashScreen` plugin block to match (`androidSplashResourceName: "splash_screen"`, `launchAutoHide: false`, `backgroundColor: "#EFE7D6"`).
- Locked portrait at both layers: `AndroidManifest.xml`'s main activity now has `android:screenOrientation="portrait"` (pre-JS, manifest-level), backstopped by `nativeChrome.js`'s existing `ScreenOrientation.lock('portrait')` runtime call.
- Generated Android launcher-icon mipmaps (legacy `ic_launcher`/`ic_launcher_round` + adaptive `ic_launcher_foreground`, all 5 densities) from `assets/mazeworld-google-play-icon-512.png` using a dependency-free PowerShell/`System.Drawing` resize script, after `npx @capacitor/assets generate --android` failed outright (missing `chevrotain` transitive dependency — confirming 02-RESEARCH.md's flagged staleness risk). Recolored the adaptive icon's background layer from stock white to a dark stone tone matching the source artwork.
- Fixed a Rule-1 bug in `nativeChrome.js`'s status-bar wiring: 02-03's stub used `Style.Dark` (light text) against the light parchment background, which would render invisible; corrected to `Style.Light` + added the paired `setBackgroundColor("#EFE7D6")` call.
- Self-hosted all three Google Fonts families as `.woff2` in a new repo-root `fonts/` directory (Special Elite 400; Crimson Pro 400/600 normal + 400 italic; IBM Plex Mono 400/500/600), replaced `mazeworld.html`'s CDN `<link>` with local `@font-face` rules, and extended `tools/build-www.mjs` to copy `fonts/` into `www/fonts/`. Verified zero remaining `fonts.googleapis.com`/`fonts.gstatic.com` references in both `mazeworld.html` and the built `www/index.html`.
- Closed PLT-01's outstanding AAB requirement: `JAVA_HOME=<temurin21> ./gradlew assembleDebug bundleDebug` → `BUILD SUCCESSFUL in 1m 26s`; `app-debug.apk` (6.7MB) and `app-debug.aab` (6.2MB) both present under `android/app/build/outputs/`.
- `node --test` full suite verified green (363/363) after every task in this plan — no regression from any native-chrome, font, or build-tooling change.

## Task Commits

Each task was committed atomically:

1. **Task 1: Native chrome — splash, status bar, portrait lock, launcher icon** - `3a62e42` (feat)
2. **Task 2: Self-host the Google Fonts (true offline)** - `f2a66eb` (feat)
3. **Task 3: Final green build gate — assembleDebug (APK) + bundleDebug (AAB)** - no commit (verification-only task; the one file it touches, `tools/build-www.mjs`, was already committed in Task 2 — see Decisions)

**Plan metadata:** (this commit)

## Files Created/Modified

- `capacitor.config.json` - added `plugins.SplashScreen` block (androidSplashResourceName, launchAutoHide, backgroundColor)
- `android/app/src/main/AndroidManifest.xml` - `android:screenOrientation="portrait"` on the main activity
- `android/app/src/main/res/drawable-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/splash_screen.webp` - the provided branded splash, per density
- `android/app/src/main/res/mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/{ic_launcher,ic_launcher_round,ic_launcher_foreground}.png` - generated launcher icon mipmaps from the 512x512 source
- `android/app/src/main/res/values/ic_launcher_background.xml` - adaptive-icon flat background recolored to match the source artwork
- `src/browser/nativeChrome.js` - fixed StatusBar style (Light not Dark) + added setBackgroundColor
- `mazeworld.html` - Google Fonts CDN `<link>` replaced with local `@font-face` rules
- `tools/build-www.mjs` - new `copyFonts()` step (`fonts/` → `www/fonts/`)
- `fonts/*.woff2` (6 files) - self-hosted font faces, source of truth

## Decisions Made

See `key-decisions` in frontmatter for full rationale. Summary:
- `@capacitor/assets` 3.0.5 is genuinely broken in this environment (`chevrotain` module not found at CLI load) — used a dependency-free `System.Drawing`/PowerShell resize instead of adding an unverified npm devDependency.
- Recolored the adaptive icon background from white to dark stone (#14100E) to match the source artwork's full-bleed dark design.
- Fixed the inherited status-bar `Style.Dark`→`Style.Light` bug (light text on light background is a real, easily-missed correctness bug, not a style preference).
- Fonts self-hosted from a new repo-root `fonts/` directory, mirroring the existing `engine/content/src` → `www/` copy pattern; only the `latin` Unicode subset was downloaded per face/weight (English-only UI).
- Task 3 produced no new commit since its only declared file (`tools/build-www.mjs`) was already modified and committed as part of Task 2's font work — recorded explicitly rather than an empty/fabricated commit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking, environment] `npx @capacitor/assets generate --android` fails to even load (`Cannot find module 'chevrotain'`)**
- **Found during:** Task 1 (launcher icon generation)
- **Issue:** 02-RESEARCH.md flagged this package's unusually old last-publish date as a risk to verify before relying on it. A dry run (`npx @capacitor/assets --help`) confirmed the risk was real: the CLI crashes at load time because a transitive dependency (`@xml-tools/parser` → `chevrotain`, pulled in via `@trapezedev/project`) is missing from its own dependency tree — this is a broken published package, not a Capacitor-8-incompatibility to work around.
- **Fix:** Per the plan's own explicitly-stated fallback ("if it is incompatible with Capacitor 8, fall back to dropping generated mipmaps into res/mipmap-*"), wrote a small PowerShell script using .NET's built-in `System.Drawing` (`Add-Type -AssemblyName System.Drawing`) to resize `assets/mazeworld-google-play-icon-512.png` into all 5 densities' legacy (`ic_launcher`/`ic_launcher_round`) and adaptive-foreground (`ic_launcher_foreground`) PNGs at the exact pixel dimensions Capacitor's own stock template used (48/72/96/144/192px legacy, 108/162/216/324/432px foreground). No new npm dependency added; the script was a scratch file, deleted after use (not committed).
- **Files modified:** `android/app/src/main/res/mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/*.png`, `android/app/src/main/res/values/ic_launcher_background.xml`
- **Verification:** Script output confirmed correct dimensions per density; `node --test` green; visual correctness deferred to device UAT (D6) since PNG pixel content can't be meaningfully asserted headlessly.
- **Committed in:** `3a62e42` (Task 1 commit)

**2. [Rule 1 - Bug] `nativeChrome.js`'s `StatusBar.setStyle` used the wrong `Style` constant**
- **Found during:** Task 1 (finalizing nativeChrome's status-bar call against the real config)
- **Issue:** 02-03's stub called `StatusBar.setStyle({ style: "DARK" })`. Per `@capacitor/status-bar`'s own type definitions, `Style.Dark` = "light text for dark backgrounds" — the opposite of what a light parchment (`#EFE7D6`) status bar needs. Left as-is, this would render near-invisible light/white status-bar icons and clock text against the light background.
- **Fix:** Changed to `StatusBar.setStyle({ style: "LIGHT" })` (`Style.Light` = "dark text for light backgrounds," the correct choice here) and added the paired `StatusBar.setBackgroundColor({ color: "#EFE7D6" })` call the RESEARCH doc's illustrative snippet specified but 02-03 had not yet wired (it was scoped to 02-04).
- **Files modified:** `src/browser/nativeChrome.js`
- **Verification:** No test in `test/persistence/lifecycle.test.js` hardcodes the style string (confirmed via grep before changing), so this was a safe correction; `node --test` stayed green (363/363).
- **Committed in:** `3a62e42` (Task 1 commit)

**3. [Rule 1 - Bug, self-correcting] Comment in `mazeworld.html` initially named the CDN hosts the offline-verify greps for the absence of**
- **Found during:** Task 2 (self-hosting fonts) — caught by re-running the plan's own verify step before committing
- **Issue:** The plan explicitly warns: "Do NOT leave a comment that names those CDN hosts in mazeworld.html — the offline verify greps for their ABSENCE." My first draft of the `@font-face` block's explanatory comment named `fonts.gstatic.com` directly, which self-triggered the `grep -riE "fonts\.(googleapis|gstatic)\.com" mazeworld.html` verify check.
- **Fix:** Reworded the comment to describe the change without naming the CDN hostnames (referencing "a networked build machine" and pointing to this SUMMARY for the source instead).
- **Files modified:** `mazeworld.html`
- **Verification:** Re-ran the verify grep — `NO_CDN_FONT_REF`.
- **Committed in:** `f2a66eb` (Task 2 commit) — caught before commit, never landed in a prior commit.

---

**Total deviations:** 3 auto-fixed (1 blocking/environment — broken npm package, 1 correctness bug — inverted status-bar style, 1 self-caught authoring slip before commit)
**Impact on plan:** All three were necessary to reach the plan's stated guarantees (a correctly-generated launcher icon, a legible status bar, and an offline-verify-clean font comment) without scope creep. No architectural changes; no new runtime dependencies added.

## Issues Encountered

None beyond the deviations above. The build-machine toolchain (Temurin 21 pinned via `tools/pin-jdk.mjs`, proven in 02-02) worked unchanged for this plan's `assembleDebug`/`bundleDebug` run — no new toolchain issues. The plan's own text says "confirm `./gradlew -version` reports JVM 17," which is stale relative to 02-02's discovered JDK-21 requirement (`capacitor-android`'s own `build.gradle` pins Java 21); confirmed JVM 21 instead, consistent with 02-02's already-proven pin.

## User Setup Required

None for continued headless development — the same Temurin 21 JDK / Android SDK toolchain 02-02 installed (user-writable locations, no admin rights) built this plan's changes without modification. Font downloads happened once during this execution session (this build machine has network access); no ongoing external service is required — the fonts are now committed, static repo files.

## Next Phase Readiness

- Phase 02 (android-packaging-native-persistence) is now fully executed: 4/4 plans complete. `android/` is a real, compiling Capacitor 8 Android project with branded native chrome, self-hosted fonts, and both `assembleDebug` (APK) and `bundleDebug` (AAB) proven green.
- Deferred to end-of-milestone device UAT (per the autonomous-run decision in STATE.md and 02-VALIDATION.md's three-tier verification architecture) — see the `## Deferred Device UAT` table below. None of these block phase completion; every interface-level decision behind them is unit- or grep-verified above.
- No blockers remaining. Full `node --test` suite green (363/363); no Google Fonts CDN reference in `mazeworld.html` or built `www/index.html`; `app-debug.apk` and `app-debug.aab` both present.

## Deferred Device UAT (end-of-phase, user runs the emulator/device)

| Behavior | Requirement | Instructions |
|----------|-------------|---------------|
| App installs, launches, shows the branded splash, is portrait-locked, status bar matches theme, launcher icon renders correctly | PLT-01/04 | Install `android/app/build/outputs/apk/debug/app-debug.apk` on an emulator/device, launch |
| Back button confirms-before-quit; never silently ends a run | PLT-02 | Press back mid-run on device (logic unit-proven in 02-03) |
| Background/force-stop/reopen resumes exactly where left off | PLT-03/SAV-02 | Background & force-stop mid-run, reopen (logic unit-proven in 02-03) |
| Saves / graveyard / best-depth survive an app restart on device | SAV-03/04/05 | Play, restart app, confirm persistence (logic unit-proven in 02-01/02-03) |
| App runs in airplane mode with correct self-hosted fonts (no network) | offline/PLT-01 | Enable airplane mode, cold-launch, confirm fonts render (Special Elite/Crimson Pro/IBM Plex Mono, not a system-font fallback) and play |

---
*Phase: 02-android-packaging-native-persistence*
*Completed: 2026-09-08*

## Self-Check: PASSED

- FOUND: fonts/special-elite-400.woff2
- FOUND: fonts/crimson-pro-normal.woff2
- FOUND: fonts/crimson-pro-italic-400.woff2
- FOUND: fonts/ibm-plex-mono-400.woff2
- FOUND: fonts/ibm-plex-mono-500.woff2
- FOUND: fonts/ibm-plex-mono-600.woff2
- FOUND: android/app/src/main/res/drawable-mdpi/splash_screen.webp
- FOUND: android/app/src/main/res/drawable-hdpi/splash_screen.webp
- FOUND: android/app/src/main/res/drawable-xhdpi/splash_screen.webp
- FOUND: android/app/src/main/res/drawable-xxhdpi/splash_screen.webp
- FOUND: android/app/src/main/res/drawable-xxxhdpi/splash_screen.webp
- FOUND: android/app/build/outputs/apk/debug/app-debug.apk
- FOUND: android/app/build/outputs/bundle/debug/app-debug.aab
- FOUND commit: 3a62e42 (Task 1, feat)
- FOUND commit: f2a66eb (Task 2, feat)
