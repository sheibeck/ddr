# Phase 80: Android Release Build & Tooling - Research

**Researched:** 2026-09-25
**Domain:** Android native build (AGP/R8), Capacitor 8 edge-to-edge/system-bars, Android 16 large-screen policy, Node CLI replay/resume correctness
**Confidence:** HIGH (every claim below is grounded in direct reads of this repo's own `android/`, `node_modules/@capacitor/*`, `node_modules/@modbender/capacitor-play-games`, `tools/`, and `test/` sources, plus current official Android docs)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Android release — DROID-01..03 (user accepted 2026-09-25)**
- **R8 (DROID-01):**
  - Turn on minify, shrink resources and obfuscation for the release build on **AGP 8.13** (`android/app/build.gradle:57` `minifyEnabled false` today; `android/build.gradle:10` AGP 8.13.0).
  - Write keep rules in `android/app/proguard-rules.pro` for Capacitor core, every Capacitor plugin in use (preferences, app, splash-screen, status-bar, screen-orientation, haptics), the Play Games plugin (Phase 67) and the WebView JS bridge. The researcher confirms the exact rule set for Capacitor 8 + AGP 8.13.
  - Every AAB ships its deobfuscation mapping (`mapping.txt`), uploaded with the bundle. Update `docs/RELEASING.md`.
  - **Proof:** a release-signed build on the Pixel 7 boots, saves and resumes, handles back, and plays sound and haptics as before; Play Games sign-in and the global boards work. These device items are batched into the milestone-close checklist per the deferred-UAT protocol.
- **Status bar and edge-to-edge (DROID-02):**
  - DROP the deprecated status-bar colour call (`src/browser/nativeChrome.js:230` `StatusBar.setBackgroundColor`, which maps to the deprecated `Window.setStatusBarColor`).
  - The parchment extends under a TRANSPARENT status bar, and the UI pads itself with the safe-area insets (`var(--safe-area-inset-*, env(safe-area-inset-*))` already on the fixed chrome).
  - Confirm Capacitor 8's `BridgeActivity` enables edge-to-edge (or call `EdgeToEdge.enable(this)`), and that the WebView actually receives the insets.
  - Audit Capacitor core, SplashScreen and the Play Games plugin for other deprecated window APIs Play flags (`setNavigationBarColor`, `setDecorFitsSystemWindows`).
  - Verify in gesture AND 3-button navigation and with a display cutout.
- **Large screens (DROID-03):**
  - A deliberate, documented **letterboxed portrait column**, centred on wide screens with parchment-dark gutters.
  - Declare the app as a game (`android:appCategory="game"`) and let large screens (sw ≥ 600dp) rotate and resize around the column. Android 16 ignores orientation locks there anyway.
  - Revisit the manifest `android:screenOrientation="portrait"` (L18) and the `@capacitor/screen-orientation` lock so phones stay portrait while large screens behave. The researcher confirms the right mechanism and whether Play still flags a game that declares the category.
  - Document the layout decision in `docs/RELEASING.md` (or a device doc).
- **Verification:**
  - Claude runs an emulator tablet/foldable pass (resizable AVD) with screenshots in the phase.
  - The Pixel 7 checks (both nav modes, a cutout if available, and the release-signed smoke) join the milestone-close checklist.
  - After the phase, offer a Play internal-testing push of a versionCode-bumped signed AAB (standing ask-first rule).

**Fit tool — TOOL-01 (user accepted 2026-09-25)**
- A fit run resumed from its JSONL log retraces EXACTLY the same walk as the live run, including after an infeasible (`+Infinity`) point.
  - Today the logged row is read back with `score: null` where the live run had `+Infinity`, and the walk diverges. See `tools/fit-difficulty.mjs:340-355` (evaluate/replay), `:188-215` (runSearch), and `tools/lib/fit-score.mjs:268-282` (applyStep).
- Per-block stdout is APPENDED, never truncated.
- A test runs a short fit live and then resumed from its log, and compares the walks.

### Claude's Discretion
- The keep-rule details (per research), the letterbox implementation (CSS max-width column vs native), and the emulator AVD choice.
- Plan split: R8, then edge-to-edge + large screens, then the fit tool (the fit tool is fully independent).

### Deferred Ideas (OUT OF SCOPE)
- The AGP 9 upgrade: deferred by the user at scoping.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DROID-01 | Release AAB built with R8 minify/shrink/obfuscation on AGP 8.13, ships a deobfuscation mapping; release-signed Pixel 7 build boots/saves/resumes/back/sound/haptics | `## Package Legitimacy Audit` is N/A (no new packages); `## R8 / DROID-01` section below gives the exact `build.gradle` diff, proves via direct source reads that Capacitor core + the Play Games plugin already ship consumer ProGuard rules (no manual plugin keep rules needed), that AGP's own default `proguard-android.txt` already keeps `@JavascriptInterface` methods (WebView bridge covered), and documents the mapping.txt auto-inclusion-in-AAB mechanism |
| DROID-02 | Edge-to-edge on Android 15+, both nav modes + cutout, no deprecated window/status-bar APIs Play flags | `## Edge-to-Edge / DROID-02` section: traces the exact deprecated call (`@capacitor/status-bar` 8.0.3's `setBackgroundColor` → `Window.setStatusBarColor`), proves it fires unconditionally on every launch via the plugin's own `load()`→constructor path (not just when JS calls it), and gives the verified replacement (`@capacitor/core`'s bundled `SystemBars` plugin, already vendored in `tools/build-www.mjs`, CSS-compatible with the app's existing `--safe-area-inset-*` variables with zero CSS changes) |
| DROID-03 | Deliberate, documented large-screen layout; Play's display-configuration warning addressed or accepted | `## Large Screens / DROID-03` section: **corrects** the CONTEXT.md assumption — official Android 16 docs confirm `android:appCategory="game"` makes the OS **respect** (not ignore) the portrait lock, the opposite of "let large screens rotate and resize." Documents the actual mechanism and why the CSS letterboxed column is still needed (for a wide *portrait* viewport, not for rotation) |
| TOOL-01 | Resumed fit-tool walk reproduces the live walk exactly, including after `+Infinity`; stdout appended not truncated | `## Fit Tool / TOOL-01` section: **major finding** — this bug is already fixed on `master` (commit `6b48281`, landed 2026-09-21 during Phase 54-07) with a passing regression test (`test/unit/fit-resume.test.js`). Documents exactly what remains: closing the stale todo, and the one legitimate gap (no end-to-end test through the real CLI subprocess) |
</phase_requirements>

## Summary

This phase touches four independent, well-scoped areas, and the most important research finding is that **all four are smaller than CONTEXT.md assumes** once the actual code on disk is read.

**R8 (DROID-01):** flipping `minifyEnabled true` + `shrinkResources true` is the real work. The "write keep rules for every Capacitor plugin" task shrinks dramatically: `node_modules/@capacitor/android/capacitor/proguard-rules.pro` is *already* declared as `consumerProguardFiles` in Capacitor's own `build.gradle` and keeps `-keep public class * extends com.getcapacitor.Plugin { *; }` — every one of this app's six first-party plugins extends that class, so they're automatically protected. `@modbender/capacitor-play-games` ships its own `consumer-rules.pro` with `-keep class com.idleflowgames.playgames.** { *; }`. AGP's own bundled `proguard-android.txt` (already referenced in `android/app/build.gradle:58`) already keeps `@android.webkit.JavascriptInterface` methods, covering Capacitor's `MessageHandler` JS bridge. A hand-authored `proguard-rules.pro` is still worth writing defensively (belt-and-suspenders against a future plugin regression), but it is NOT load-bearing the way CONTEXT.md implies — the plan should verify this empirically against a real R8 build's `mapping.txt`/`seeds.txt` rather than write speculative rules from scratch.

**Edge-to-edge (DROID-02):** the deprecated call is not just "don't invoke it from JS" — `@capacitor/status-bar` 8.0.3's Java plugin calls the deprecated `Window.setStatusBarColor()` unconditionally from its own `load()` → constructor path on *every* app launch, regardless of whether JS ever touches the StatusBar API, because it's still registered in `android/app/src/main/assets/capacitor.plugins.json`. The correct, Capacitor-blessed fix is to remove the `@capacitor/status-bar` npm package entirely (not just stop calling it) and switch to Capacitor 8's new **`SystemBars`** core plugin, which ships bundled inside `@capacitor/core` (already installed, already vendored in `tools/build-www.mjs`'s `CAPACITOR_PACKAGES`), uses only non-deprecated `WindowInsetsControllerCompat` APIs, and — critically — already injects `--safe-area-inset-{top,right,bottom,left}` as CSS custom properties on `document.documentElement`, which is *exactly* the variable name this app's CSS already reads via `var(--safe-area-inset-top, env(safe-area-inset-top, 0px)))`. No CSS changes are needed.

**Large screens (DROID-03):** CONTEXT.md's own text has the mechanism backwards, and the plan needs to know this before writing tasks. Official Android 16 docs confirm: declaring `android:appCategory="game"` makes the OS **honor** `android:screenOrientation="portrait"` on large screens (games are *exempt from* the ignore-behavior) — it does not "let large screens rotate and resize around the column." The real reason a letterboxed portrait column is still needed is different: a large-screen device held in **portrait** (a 10" tablet, a Chromebook window resized tall) still gives the app a much wider viewport than a phone (a tablet's portrait width is commonly 800–1200 CSS px vs. a phone's ~360–430px), even though no rotation ever happens. The CSS max-width column solves *that* problem, independent of the native orientation mechanism. Declaring `game` category also appears to suppress Play Console's display-configuration warning outright (the warning's own precondition — the OS ignoring restrictions — no longer applies to a declared game).

**Fit tool (TOOL-01):** the described bug is **already fixed on master**. Commit `6b48281` ("fix the replay-resume Infinity/null bug") landed the exact solution the todo describes — `tools/lib/fit-resume.mjs`'s `rehydrateRow()` undoes JSON's `Infinity → null` coercion before a resumed walk can compare scores — and `test/unit/fit-resume.test.js` already has a full search-level regression test proving a resumed walk (primed with an infeasible `+Infinity` row) reproduces the original, unresumed walk exactly. The `>>` vs `>` stdout guidance is also already documented in `tools/fit-difficulty.mjs`'s own header comment. The remaining, legitimate work is narrow: close the stale todo, and (optionally, Claude's discretion) add a true end-to-end test that spawns the real `tools/fit-difficulty.mjs` CLI as a subprocess for a short live search then a resumed one and diffs the actual JSONL/stdout — since the existing test only exercises the pure library against a synthetic scoring function, not the real CLI's arg-parsing/file-I/O/worker-thread path.

**Primary recommendation:** treat this phase as "verify and tidy," not "author from scratch," on all four fronts — the codebase and its dependencies already carry most of the mechanism. The plan's job is a small, precise set of edits (two `build.gradle` flags, one npm uninstall + one plugin swap in `nativeChrome.js`, one manifest attribute, a todo close-out) plus real-build verification, not large new subsystems.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| R8 minify/shrink/obfuscate | Android build (Gradle/AGP) | — | Pure build-configuration concern; `android/app/build.gradle`'s `release` buildType |
| ProGuard/R8 keep rules | Android build (Gradle/AGP), consumed from AAR `consumerProguardFiles` | App-level `proguard-rules.pro` (defensive only) | Capacitor core + Play Games plugin AARs already own and ship their own keep rules; the app's own file is a supplement, not the primary source |
| Status bar / system bars styling | Native shell (MainActivity/Bridge via `SystemBars` core plugin) | Browser/JS (`src/browser/nativeChrome.js` calling the plugin) | The native Android WindowInsetsController owns the actual bar appearance; JS only requests a style |
| Safe-area inset delivery to CSS | Native shell (`SystemBars` plugin's `injectSafeAreaCSS`) | Browser/CSS (`mazeworld.html`'s `var(--safe-area-inset-*, env(...))` consumers) | Insets are computed natively (WindowInsetsCompat) and pushed into the WebView's DOM as custom properties; CSS is a pure consumer |
| Orientation lock / large-screen layout | Native shell (`AndroidManifest.xml` `android:screenOrientation` + `android:appCategory`) | Browser/CSS (letterboxed column) | The manifest governs whether the OS honors the lock at all (game-category exemption); CSS governs the *visual* result once the OS gives the WebView its bounds |
| Fit-tool replay/resume correctness | Tooling (`tools/lib/fit-resume.mjs`) | Tooling (`tools/fit-difficulty.mjs` CLI) | Pure, engine-free logic already isolated in a dedicated library module; the CLI is a thin wrapper |

## R8 / DROID-01

### Current state (verified by direct read)

- `android/app/build.gradle:57` — `minifyEnabled false` in the `release` buildType. No `shrinkResources` line at all (defaults to `false`, and is a no-op unless `minifyEnabled true` anyway). [VERIFIED: direct code read]
- `android/build.gradle:10` — `classpath 'com.android.tools.build:gradle:8.13.0'`. [VERIFIED: direct code read]
- `android/gradle.properties` has no `android.enableR8.fullMode` override, so AGP 8.13's default (R8 **full mode**, the default since AGP 8.0) applies. [VERIFIED: direct code read, absence confirmed]
- `android/app/proguard-rules.pro` is the stock, all-commented-out AGP template — no project rules exist today. [VERIFIED: direct code read]

### Consumer ProGuard rules already shipped by dependencies (the load-bearing finding)

AGP automatically merges any AAR dependency's `consumerProguardFiles` into the app module's R8 pass whenever `minifyEnabled true` — no action needed in the app's own `proguard-rules.pro` for these to apply.

1. **Capacitor core** (`node_modules/@capacitor/android/capacitor/build.gradle:50`): `consumerProguardFiles 'proguard-rules.pro'`. That file's actual content:
   ```
   -keep @com.getcapacitor.annotation.CapacitorPlugin public class * {
       @com.getcapacitor.annotation.PermissionCallback <methods>;
       @com.getcapacitor.annotation.ActivityCallback <methods>;
       @com.getcapacitor.annotation.Permission <methods>;
       @com.getcapacitor.PluginMethod public <methods>;
   }
   -keep public class * extends com.getcapacitor.Plugin { *; }
   ```
   Every first-party plugin this app uses (`@capacitor/preferences`, `@capacitor/app`, `@capacitor/splash-screen`, `@capacitor/status-bar` if kept, `@capacitor/screen-orientation`, `@capacitor/haptics`) is a subclass of `com.getcapacitor.Plugin` and is therefore already fully kept (`{ *; }` — all members), reflection-safe. [VERIFIED: direct source read, `node_modules/@capacitor/android/capacitor/proguard-rules.pro`]

2. **Play Games plugin** (`node_modules/@modbender/capacitor-play-games/android/build.gradle:40`): `consumerProguardFiles 'consumer-rules.pro'`. Content:
   ```
   # Consumer ProGuard/R8 rules applied to apps that depend on this plugin.
   # The Capacitor bridge instantiates the plugin reflectively by class name, so
   # keep the plugin and its native modules even under full minification.
   -keep class com.idleflowgames.playgames.** { *; }
   ```
   This is a wholesale package keep, already covering the plugin's entire implementation. [VERIFIED: direct source read]

3. **WebView JS bridge**: `android/app/build.gradle:58` already references `getDefaultProguardFile('proguard-android.txt')`. That AGP-bundled file (confirmed by reading the actual unpacked copy at `node_modules/@capacitor/android/capacitor/build/intermediates/default_proguard_files/global/proguard-android.txt-8.13.0`) already contains:
   ```
   -keepclassmembers class * {
       @android.webkit.JavascriptInterface <methods>;
   }
   ```
   This covers every `@JavascriptInterface`-annotated class in Capacitor core (`MessageHandler.java` — the actual JS↔native bridge, plus `CapacitorCookies`, `CapacitorHttp`, `SystemBars`'s `CapacitorSystemBarsAndroidInterface`). [VERIFIED: direct source read]

**Conclusion:** the "write keep rules for every plugin" task is materially smaller than assumed. Recommend the plan:
- Flip `minifyEnabled true` and add `shrinkResources true` in `android/app/build.gradle`'s `release` buildType.
- Write a **small, defensive** `android/app/proguard-rules.pro` (belt-and-suspenders, matching the same rules the consumer files already apply, so a future plugin regression or dependency swap doesn't silently break) rather than a large speculative rule set.
- Verify empirically: build a real signed release AAB with the new flags, then grep the produced `android/app/build/outputs/mapping/release/{mapping,seeds,usage}.txt` to confirm the Capacitor/Play Games plugin classes are present in `seeds.txt` (kept) and check `usage.txt` for anything unexpectedly removed. This is the reliable way to close the loop, not more manual rule-writing.

### Deobfuscation mapping (mapping.txt)

With Android Gradle Plugin 4.1+ and `minifyEnabled true`, the mapping file is embedded automatically in the App Bundle's `BUNDLE-METADATA` directory — Play Console extracts and applies it for crash/ANR de-obfuscation with **no manual upload step**. For AGP 8.10+ Play may instead read a newer `r8.json` format if present; either way, this is fully automatic once R8 is on and the artifact uploaded is the `.aab` (not a raw signed `.apk`), which this project's `bundleRelease` task already produces. [CITED: Google Play Console Help — "Deobfuscate or symbolicate crash stack traces", cross-referenced against multiple current AGP release notes] The plan should still document the local output path (`android/app/build/outputs/mapping/release/mapping.txt`) in `docs/RELEASING.md` as a manual-inspection fallback, since the user has no CLI Play upload pipeline yet (per `docs/RELEASING.md`'s own "Uploading from the CLI (not set up yet)" section — the user drag-and-drops the `.aab` by hand, and Play's automatic bundle-metadata extraction is what actually delivers the mapping in that flow).

### Pitfalls

- **R8 + WebView asset shrinking:** `shrinkResources true` only shrinks *Android* resources (drawables, layouts, strings) reachable from manifest/code analysis — it does not touch `www/` assets bundled via `aaptOptions.ignoreAssetsPattern` (already configured in `android/app/build.gradle:38-42`). No special handling needed, but worth a sanity check that `assets/public/` (the synced web bundle) isn't affected post-build.
- **First real release build after minify flips on is where regressions surface** — not in `npm test` (which never touches the Android/Gradle toolchain at all). The proof step in CONTEXT.md (Pixel 7 release-signed smoke: boot, save/resume, back, sound, haptics, Play Games sign-in, global boards) is the actual gate, not a unit test. Budget for at least one full `npm run android:release` + device install + manual smoke cycle before calling DROID-01 done.
- **`@capacitor/status-bar`'s own plugin class will ALSO be force-kept** by the `-keep public class * extends com.getcapacitor.Plugin { *; }` rule if it's still installed — R8 keep rules do not help you *remove* deprecated bytecode, only prevent tree-shaking of what's already there. This is why DROID-02's fix must be an npm uninstall, not a keep-rule change (see below).

## Edge-to-Edge / DROID-02

### The deprecated call — confirmed root cause

`node_modules/@capacitor/status-bar/android/src/main/java/com/capacitorjs/plugins/statusbar/StatusBar.java` (v8.0.3, the version this project has installed):

```java
public StatusBar(AppCompatActivity activity, StatusBarConfig config, ChangeListener listener) {
    this.activity = activity;
    this.currentStatusBarColor = getStatusBarColorDeprecated();
    this.listener = listener;
    setBackgroundColor(config.getBackgroundColor());   // <-- always runs
    ...
}

@SuppressWarnings("deprecation")
private void setStatusBarColorDeprecated(int color) {
    activity.getWindow().setStatusBarColor(color);
}
```

`StatusBarPlugin.java`'s `load()` (the Capacitor plugin lifecycle hook, called automatically on every app launch because `StatusBarPlugin` is listed in `android/app/src/main/assets/capacitor.plugins.json`) unconditionally constructs `new StatusBar(...)`, which unconditionally calls `setBackgroundColor()`, which unconditionally calls the deprecated `Window.setStatusBarColor()` — **regardless of whether `src/browser/nativeChrome.js` ever calls `StatusBar.setBackgroundColor()` from JS.** [VERIFIED: direct source read, both files]

This matters because simply deleting the JS call at `nativeChrome.js:230` (as CONTEXT.md's literal instruction says) is **necessary but not sufficient** — the deprecated bytecode still ships and still executes on every launch as long as `@capacitor/status-bar` remains an installed dependency. Play Console's pre-launch static analysis flags the presence/invocation of the deprecated API call itself, not just whether your own JS reaches it — this is independently corroborated by multiple developers reporting the warning persists even after removing their own calls to `setBackgroundColor`/`setNavigationBarColor`, as long as the underlying plugin/library still calls it internally. [CITED: multiple GitHub issue threads — flutter/flutter#183372, apache/cordova-android#2018, VEYRNOX/veyrnox#2749 — cross-corroborated pattern, MEDIUM confidence on the Play-static-analysis mechanism specifically, HIGH confidence on the StatusBar plugin's own always-runs behavior which is verified from source]

### The verified fix: Capacitor 8's built-in `SystemBars` core plugin

Capacitor 8 ships a new core plugin, `SystemBars`, bundled directly inside `@capacitor/core` (no separate npm package) and auto-registered by `Bridge.java` itself:

```java
// node_modules/@capacitor/android/capacitor/src/main/java/com/getcapacitor/Bridge.java:664
private void registerAllPlugins() {
    this.registerPlugin(com.getcapacitor.plugin.CapacitorCookies.class);
    this.registerPlugin(com.getcapacitor.plugin.WebView.class);
    this.registerPlugin(com.getcapacitor.plugin.CapacitorHttp.class);
    this.registerPlugin(com.getcapacitor.plugin.SystemBars.class);
    ...
}
```

`node_modules/@capacitor/android/capacitor/src/main/java/com/getcapacitor/plugin/SystemBars.java` uses only `WindowInsetsControllerCompat.setAppearanceLightStatusBars(...)` for styling — **no deprecated `Window.setStatusBarColor`/`setNavigationBarColor`/`setSystemUiVisibility` calls anywhere in the class.** [VERIFIED: full source read, no deprecated API present]

Critically, `SystemBars`'s default `insetsHandling` mode is `"css"` (`private String insetsHandling = INSETS_HANDLING_CSS;`), under which `initSafeAreaCSSVariables()`/`injectSafeAreaCSS()` sets exactly these properties on `document.documentElement`:

```java
document.documentElement.style.setProperty("--safe-area-inset-top", "%dpx");
document.documentElement.style.setProperty("--safe-area-inset-right", "%dpx");
document.documentElement.style.setProperty("--safe-area-inset-bottom", "%dpx");
document.documentElement.style.setProperty("--safe-area-inset-left", "%dpx");
```

This is the **exact same custom-property name** `mazeworld.html` already reads everywhere via `var(--safe-area-inset-top, env(safe-area-inset-top, 0px))` (confirmed at 9 call sites: HUD identity band, dead screen, bottom-dock, title account chip, fight-log sheet, roller sheet, etc.). **No CSS changes are required.** [VERIFIED: direct source read + grep of `mazeworld.html`]

`@capacitor/core` (which exports `SystemBars`, `SystemBarsStyle`, `SystemBarType` from its `dist/index.js`, confirmed by direct read) is already in `tools/build-www.mjs`'s `CAPACITOR_PACKAGES` vendoring list (line 65) — so `import { SystemBars, SystemBarsStyle } from "@capacitor/core"` will resolve in the Android WebView's import map with **zero `build-www.mjs` changes**. [VERIFIED: direct source read, `dist/index.js` export list + `build-www.mjs` package list]

### Recommended fix shape (for the planner)

1. `npm uninstall @capacitor/status-bar` — this is what actually removes the deprecated bytecode from the shipped app, not just the JS call site. After uninstall, `npx cap sync android` regenerates `android/app/src/main/assets/capacitor.plugins.json` and `android/capacitor.build.gradle` without the `StatusBarPlugin` entry.
2. Remove `"@capacitor/status-bar"` from `tools/build-www.mjs`'s `CAPACITOR_PACKAGES` list (it will otherwise throw at build time: `"${pkg} is not installed"`).
3. In `src/browser/nativeChrome.js`, replace the guarded dynamic `import("@capacitor/status-bar")` block (`registerNativeChrome`, ~L217-233) with a guarded dynamic `import("@capacitor/core")` and call `SystemBars.setStyle({ style: SystemBarsStyle.Dark })` (or the string form `{ style: "DARK" }` to match this file's existing injection-testing pattern of plain string literals). Drop the `setBackgroundColor` call entirely — `SystemBars` has no such method; it's edge-to-edge only by design.
4. No manifest/MainActivity change is required for `EdgeToEdge.enable()` — Android 15+ (targetSdk 36, already the case here) draws every activity edge-to-edge **by default** at the OS level; Capacitor's `SystemBars` plugin's `initWindowInsetsListener()` (auto-registered, no opt-in needed) is what translates that into WebView padding + CSS variables. [CITED: developer.android.com "Behavior changes: Apps targeting Android 16 or higher", cross-verified against `SystemBars.java`'s own `Build.VERSION_CODES.VANILLA_ICE_CREAM` (Android 15) gate]
5. Audit for other deprecated window APIs Play flags, per CONTEXT.md: confirmed via direct source read that `@capacitor/splash-screen`'s `SplashScreen.java` contains `legacyImmersive()`/`legacyFullscreen()` methods using the deprecated `View.setSystemUiVisibility(...)`, but they are gated behind `config.isImmersive()`/`config.isFullScreen()`, both of which default `false` and are **not set** in this project's `capacitor.config.json` (only `androidSplashResourceName`/`launchAutoHide`/`backgroundColor` are configured). At the JS level these are therefore unreachable — but note the open question below on whether R8/Play's static scanner can still see the dead code path. The Play Games plugin (`@modbender/capacitor-play-games`) was grepped for `setStatusBarColor`/`setNavigationBarColor`/`setSystemUiVisibility`/`FLAG_TRANSLUCENT` and returned **zero matches** — clean. [VERIFIED: direct grep of both plugin source trees]

### Open question: does R8 strip SplashScreen's unreachable `legacyImmersive()`/`legacyFullscreen()`?

`SplashScreen.java` (the helper class, not the `@CapacitorPlugin`-annotated `SplashScreenPlugin`) is not itself a `Plugin` subclass, so it does not get the blanket `{ *; }` keep — only `SplashScreenPlugin` does, and R8's reachability analysis *may* be able to prove `legacyImmersive()`/`legacyFullscreen()` unreachable (since `config.isImmersive()`/`isFullScreen()` read config values, not constants, R8 likely cannot fully proye this statically and will keep them anyway). **Recommendation:** don't assert this either way — verify empirically by grepping the built `mapping.txt`/`seeds.txt` for `legacyImmersive`/`legacyFullscreen` after the R8 build lands, as part of the same verification pass as the keep-rules check above. Low risk either way since these are gated off at the config level and this project doesn't set `splashImmersive`/`splashFullScreen`.

### Verification requirements (from CONTEXT.md, confirmed feasible)

- Gesture nav + 3-button nav + display cutout: manual Pixel 7 device pass, batched into milestone-close checklist per the deferred-UAT protocol — not a mid-phase blocker.
- `viewport-fit=cover` is already present in `mazeworld.html`'s meta viewport tag (`<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`), which is a prerequisite for `SystemBars`'s "passthrough" mode on newer WebView versions (≥140) to let native `env(safe-area-inset-*)` work directly; on older WebView versions it falls back to the JS-injected `--safe-area-inset-*` variables the app already consumes either way. [VERIFIED: direct source read]

## Large Screens / DROID-03

### Correcting the CONTEXT.md mechanism (important for the planner)

CONTEXT.md states: *"Declare the app as a game (`android:appCategory="game"`) and let large screens (sw ≥ 600dp) rotate and resize around the column. Android 16 ignores orientation locks there anyway."*

This has the exemption **backwards**. Per current, authoritative Android developer documentation:

> "For apps targeting Android 16 (API level 36), orientation, resizability, and aspect ratio restrictions no longer apply on displays with smallest width >= 600dp. Apps fill the entire display window, regardless of aspect ratio or a user's preferred orientation... **Games are exempt from this behavior, based on the `android:appCategory` flag.**" [CITED: developer.android.com/about/versions/16/behavior-changes-16, developer.android.com/develop/adaptive-apps/guides/app-orientation-aspect-ratio-resizability]

In other words: declaring `android:appCategory="game"` makes the OS **continue to honor** `android:screenOrientation="portrait"` on large screens — it does **not** cause rotation/resizing. Non-game apps are the ones whose orientation lock gets ignored by default on Android 16 large screens; games are the carve-out that keeps the old (locked) behavior. A temporary, non-game opt-out property (`android.window.PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY`) exists but is irrelevant here since this app should use the game-category path, and that opt-out mechanism itself is slated for removal at API 37 anyway.

### Why the letterboxed portrait column is still the right call

With `android:appCategory="game"` set and `android:screenOrientation="portrait"` kept (both on the `<activity>`, already present; `appCategory` needs adding to `<application>`), the OS will **not** rotate the app on a tablet/foldable/Chromebook, and will **not** force it resizable. But the app still runs in a **portrait window that is much wider than a phone's** — a 10" tablet in portrait is commonly 800–1200 CSS/density-independent px wide, vs. a phone's ~360–430px. Nothing in the orientation-lock mechanism addresses *that* — it only prevents rotation. This is exactly the scenario the "deliberate, documented letterboxed portrait column, centred on wide screens with parchment-dark gutters" from CONTEXT.md is for: a **pure CSS** fix (independent of the native orientation mechanism), constraining `#app.mw-app` (currently `display:flex;flex-direction:column;height:100vh` with no `max-width`, confirmed at `mazeworld.html:1054`) to a phone-shaped max-width, centred, with the `<body>` behind it painted in a darker parchment tone as the gutter. The codebase already has a precedent for exactly this pattern elsewhere: `.wrap{max-width:1360px;margin:0 auto;padding:...}` (title/landing page container, `mazeworld.html:155`) and `.mw-roller-body{...max-width:420px;width:100%;margin:0 auto}` (character roller sheet, `:1799`) — both centred max-width columns. The new rule for `#app.mw-app` follows the same established idiom.

### Play Console warning suppression

The Play Console warning text is: *"Your game doesn't support all display configurations, and uses resizability and orientation restrictions that may lead to layout issues for your users."* — note it already says **"your game"**, implying Play's own tooling already recognizes this app category. Current guidance confirms: *"This warning will not cause Play Store rejection... Games are excluded from these changes"* [CITED: Android developer blog "The future is adaptive: Changes to orientation and resizability APIs in Android 16"; corroborated by community reports (buildmvpfast.com, Medium) that declaring `android:appCategory="game"` is the documented, intended way to both keep the exemption and address the warning]. Declaring the category is therefore the "addressed" half of success criterion 3 (the CSS column is the "deliberate, documented" half); accepting the warning is not needed as a fallback here since the fix is straightforward and already scoped.

### Manifest change needed

`android/app/src/main/AndroidManifest.xml` currently has no `android:appCategory` attribute on `<application>` at all (confirmed absent by direct read). Add `android:appCategory="game"` there. `android:screenOrientation="portrait"` on `<activity>` (line 18) and the `@capacitor/screen-orientation` JS-side lock in `nativeChrome.js` (`ScreenOrientation.lock({ orientation: "portrait" })`) both stay as-is — CONTEXT.md's instinct to "revisit" them turns out to mean "confirm they're still correct and add appCategory alongside them," not "loosen the lock."

### Emulator verification

Android Studio's **Resizable (Experimental)** AVD device profile (system image API 34+) lets one emulator instance toggle between four reference postures — phone, foldable, tablet, desktop — via the emulator toolbar's Display Mode dropdown, including folded/unfolded states for the foldable posture. This is the correct single-AVD tool for the phase's required "emulator tablet/foldable pass... with screenshots." [CITED: developer.android.com/studio/run/resizable-emulator]

## Fit Tool / TOOL-01

### Major finding: the described bug is already fixed on master

`git log --oneline -- tools/lib/fit-resume.mjs` shows commit `6b48281`: *"feat(54-07): Adjustment 3 (USER RULING G) — loosen class guardrails, drop spellPower, fix the replay-resume Infinity/null bug"*, landed 2026-09-21 (same day the todo that seeded TOOL-01 was filed) during Phase 54-07's own execution. [VERIFIED: `git log`]

`tools/lib/fit-resume.mjs` (the pure, engine-free replay/resume module the CLI now delegates to — split out of `tools/fit-difficulty.mjs` specifically for this fix, per the module's own header comment) contains:

```js
export function rehydrateRow(obj) {
  return obj && obj.score === null ? { ...obj, score: Infinity } : obj;
}

export function readLog(logPath) {
  const byN = new Map();
  if (!logPath || !fs.existsSync(logPath)) return byN;
  const lines = fs.readFileSync(logPath, "utf8").split("\n").filter(Boolean);
  for (const line of lines) {
    const obj = JSON.parse(line);
    if (typeof obj.n === "number") byN.set(obj.n, rehydrateRow(obj));
  }
  return byN;
}
```

This is precisely the fix the CONTEXT.md/todo describe: `readLog` rehydrates `score: null` (JSON's serialization of `Infinity`) back to `Infinity` before any resumed row re-enters `walkCoordinate`'s `row.score < baseScore` comparison, closing the exact bug (`null < N` coercing to `0 < N`, making an infeasible candidate look like the best-scoring one). [VERIFIED: direct source read]

`test/unit/fit-resume.test.js` already has a full regression test, `"a search resumed from a log containing an infeasible row reproduces the original walk (USER RULING G Adjustment 3(c))"`, which: runs an original unresumed synthetic walk (with an infeasible `+Infinity` point deliberately placed at candidate n=2), primes a resume log with just the first 3 rows (matching a real interrupted CLI run), resumes, and asserts `resumed.best.dials`/`resumed.best.score`/`resumed.stopped` all `deepStrictEqual`/`equal` the original walk's outcome, plus asserts the primed rows (n=1..3, including the infeasible n=2) were never re-evaluated. [VERIFIED: direct source read, full test file]

The "stdout appended, never truncated" half is also already addressed at the documentation level: `tools/fit-difficulty.mjs`'s own header comment states *"A backgrounded `--search` run's stdout should always be redirected with `>>` (append), never `>` (truncate)"* — this exact guidance is what the todo's "Solution" section asked for. [VERIFIED: direct source read]

### What genuinely remains for this phase

1. **Close the stale todo.** `.planning/todos/pending/2026-09-21-fit-tool-replay-resume-diverges-after-an-infeasible-point.md` is still sitting in `pending/` and `.planning/REQUIREMENTS.md` still lists TOOL-01 as "Pending" — both are stale bookkeeping, not open engineering work. The plan should move the todo to `completed/` (or equivalent) with a note pointing at commit `6b48281` and the existing test, once the phase's own verification confirms nothing is missing.
2. **The existing test is synthetic, not end-to-end.** `test/unit/fit-resume.test.js` exercises `tools/lib/fit-resume.mjs` in isolation, against a hand-built 2-coordinate `PLAN` and a synthetic `scoreOf()` function — it never spawns the real `tools/fit-difficulty.mjs` CLI, never touches `worker_threads`, the real engine, real CLI arg parsing, or real file I/O end-to-end. CONTEXT.md's own proof bar ("A test runs a short fit live and then resumed from its log, and compares the walks") is arguably *already met* by the existing library-level test, but if the planner wants literal CLI-level coverage (recommended, Claude's discretion per CONTEXT.md), the shape would be: spawn `node tools/fit-difficulty.mjs --search --seeds=4 --workers=1 --budget=6 --log=<tmpA>.jsonl` to completion, then spawn it again with `--budget=10 --log=<tmpA>.jsonl` (same log, growing budget — the real resume path) and diff the BEST line / dial sets, using a tiny `--seeds` count to keep it fast (this is a `node:test` + `node:child_process` pattern, not a new dependency). This is optional, additive coverage on top of an already-passing regression test, not a fix for an open bug.
3. **No engine change, no fixture drift** — confirmed: `tools/lib/fit-resume.mjs` imports nothing from `engine/`, matching its own header's claim of being "PURE, engine-free."

### Pitfall for the planner

Do not re-derive or re-implement the Infinity/null fix from the CONTEXT.md's problem description alone — read `tools/lib/fit-resume.mjs` and `test/unit/fit-resume.test.js` first. The file layout has moved since the todo was filed (the todo cites `tools/fit-difficulty.mjs:340-355` and `tools/lib/fit-score.mjs:268-282` for the replay/runSearch logic; that logic now lives in `tools/lib/fit-resume.mjs`, a file that didn't exist when the todo was written). A plan written directly from the todo's stale line numbers would target the wrong file and might re-solve an already-solved problem or introduce a duplicate/conflicting mechanism.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| R8 keep rules for Capacitor plugins | A hand-written keep rule for every plugin class from scratch | Rely on `@capacitor/android`'s and `@modbender/capacitor-play-games`'s own `consumerProguardFiles` (already present, already merged by AGP); add only a small defensive supplement | The rules already exist, are already correct, and are already wired into the build via standard AGP AAR consumption — duplicating them risks drift if a plugin updates its own rules |
| Status bar edge-to-edge handling | A custom `WindowInsetsListener`/`EdgeToEdge.enable()` call in `MainActivity.java` | Capacitor 8's bundled `SystemBars` core plugin (auto-registered, no MainActivity change needed) | It already implements exactly this, already ships in `@capacitor/core` (already installed), and its CSS variable names already match what `mazeworld.html` consumes |
| Infinity-safe JSONL log replay | A new serialization format or sentinel scheme for the fit tool's scores | Nothing — `tools/lib/fit-resume.mjs`'s `rehydrateRow()` already solved this | The fix already exists, already ships, already has a passing regression test |

**Key insight:** every one of this phase's four requirement areas has a first-party (Capacitor/AGP) or already-committed (this repo's own `tools/lib/fit-resume.mjs`) solution sitting one `grep`/read away. The research risk in this phase was never "what's the right library" — it was "read the actual code before writing new code."

## Common Pitfalls

### Pitfall 1: Assuming "don't call the deprecated API from JS" is sufficient for DROID-02
**What goes wrong:** deleting `nativeChrome.js:230`'s `StatusBar.setBackgroundColor()` call alone leaves the deprecated `Window.setStatusBarColor()` bytecode still executing on every launch, because `@capacitor/status-bar`'s own plugin `load()` lifecycle hook calls it internally regardless.
**Why it happens:** the deprecated call lives inside the *native plugin's own initialization path*, not behind the JS call site.
**How to avoid:** uninstall `@capacitor/status-bar` entirely and `npx cap sync` to regenerate the Android project without it; migrate the one remaining need (`setStyle`) to `@capacitor/core`'s bundled `SystemBars`.
**Warning signs:** Play Console's pre-launch report still flags the deprecated API warning after the JS-only fix ships.

### Pitfall 2: Assuming `android:appCategory="game"` causes large screens to rotate/resize
**What goes wrong:** planning tasks around "letting large screens rotate and resize around the column" when the actual mechanism does the opposite (games are exempt from the ignore-behavior, so orientation stays locked).
**Why it happens:** CONTEXT.md's own text states this backwards; it's an easy claim to carry forward uncorrected into a plan.
**How to avoid:** treat `appCategory="game"` as "keep the portrait lock enforced," and treat the CSS letterbox column as solving "a wide portrait viewport," not "an unwanted rotation."
**Warning signs:** a task that says "handle landscape mode on tablets" — this app, correctly configured, should never enter landscape at all.

### Pitfall 3: Re-solving the fit-tool bug from the stale todo's line numbers
**What goes wrong:** writing new replay/resume logic (or new tests) against `tools/fit-difficulty.mjs:340-355`/`tools/lib/fit-score.mjs:268-282` as the todo describes, when that logic has since moved to `tools/lib/fit-resume.mjs` and was already fixed there.
**Why it happens:** the todo and CONTEXT.md both predate the file split and the fix landing in the same phase (54-07) that filed the todo.
**How to avoid:** read `tools/lib/fit-resume.mjs` and `test/unit/fit-resume.test.js` directly before planning any TOOL-01 work; verify current state with `git log -- tools/lib/fit-resume.mjs`.
**Warning signs:** a plan task that describes "adding a `rehydrateRow` function" — it already exists.

### Pitfall 4: Verifying R8 correctness by reasoning instead of building
**What goes wrong:** trusting that "the consumer proguard rules exist, so it'll be fine" without ever producing a real signed release build and checking the resulting `mapping.txt`/`seeds.txt`, or without doing the Pixel 7 smoke pass.
**Why it happens:** the static analysis above (this research) is strong evidence but not proof — R8's actual behavior depends on the full dependency graph at build time, and a subtle interaction (a missing transitive rule, a stripped helper class like `SplashScreen.java`'s legacy methods) can only be confirmed by inspecting real build output.
**How to avoid:** the plan's verification step must include an actual `npm run android:release` (or equivalent gradle invocation) producing a real R8-minified AAB, plus the Pixel 7 device smoke CONTEXT.md already specifies.
**Warning signs:** DROID-01 marked complete without ever running a real minified build.

## Code Examples

### `android/app/build.gradle` — the actual diff needed

```gradle
// Source: android/app/build.gradle:55-63 (current), diff per this research
buildTypes {
    release {
        minifyEnabled true
        shrinkResources true
        proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        if (hasReleaseKeystore) {
            signingConfig signingConfigs.release
        }
    }
}
```
Note: switching the default file from `proguard-android.txt` to `proguard-android-optimize.txt` is optional (both already include the `@JavascriptInterface` keep rule verified above); `-optimize` additionally enables ProGuard/R8's optimization passes beyond the AGP defaults. Either is defensible; document the choice either way.

### `src/browser/nativeChrome.js` — SystemBars migration shape

```js
// Source: pattern matches this file's own existing guarded-dynamic-import style
// (see the current @capacitor/status-bar block, ~L217-233)
try {
  const { SystemBars } = injectedSystemBars
    ? { SystemBars: injectedSystemBars }
    : await import("@capacitor/core");
  await SystemBars?.setStyle?.({ style: "DARK" });
  // no setBackgroundColor call — SystemBars has none; edge-to-edge only.
} catch {
  /* SystemBars unavailable — non-fatal, matches this file's existing posture */
}
```

### AndroidManifest.xml — appCategory addition

```xml
<!-- Source: android/app/src/main/AndroidManifest.xml, current <application> block -->
<application
    android:allowBackup="true"
    android:icon="@mipmap/ic_launcher"
    android:label="@string/app_name"
    android:roundIcon="@mipmap/ic_launcher_round"
    android:supportsRtl="true"
    android:appCategory="game"
    android:theme="@style/AppTheme">
```

### Test pattern precedent for verifying build-file config (per this repo's own conventions)

```js
// Source: test/unit/play-games-intake.test.js — the existing pattern of
// asserting exact source-file content via readFileSync + assert, applicable
// to a new test asserting minifyEnabled/shrinkResources/appCategory/status-bar-absence
import { readFileSync } from "node:fs";
const buildGradle = readFileSync("android/app/build.gradle", "utf8");
assert.ok(/minifyEnabled\s+true/.test(buildGradle));
assert.ok(/shrinkResources\s+true/.test(buildGradle));
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `@capacitor/status-bar`'s `setBackgroundColor`/`overlaysWebView` for status-bar color/overlay control | `@capacitor/core`'s bundled `SystemBars` plugin, CSS-variable-driven insets | Capacitor 8 (this project is already on 8.5.1) | `@capacitor/status-bar`'s own README now states these options "no longer work" on Android 16+; the plugin is kept only for legacy `setStyle`/`hide`/`show`, and this app doesn't need even that once migrated |
| Manual `EdgeToEdge.enable()` / `WindowCompat.setDecorFitsSystemWindows(window, false)` calls in `MainActivity` | Automatic — Android 15+ (targetSdk 35+) draws edge-to-edge by default at the OS level; Capacitor 8's `SystemBars` core plugin auto-registers its own insets listener | Android 15 (API 35) OS behavior change, Capacitor 8 plugin addition | No `MainActivity.java` changes needed for this app (already `BridgeActivity` with no custom overrides) |
| `android:screenOrientation`/`android:resizeableActivity` always honored | Ignored by default on large screens (sw≥600dp) for apps targeting API 36, **except** apps declaring `android:appCategory="game"` | Android 16 (API 36) | This app must add `appCategory="game"` to keep its existing portrait-lock behavior on tablets/foldables/Chromebooks |

**Deprecated/outdated:**
- `Window.setStatusBarColor()`/`setNavigationBarColor()`/`View.setSystemUiVisibility()`: deprecated since Android 15 (API 35), effectively no-ops or Play-flagged under API 36 edge-to-edge enforcement.
- `@capacitor/status-bar`'s `overlaysWebView`/`backgroundColor` config options: explicitly documented by the plugin's own README as non-functional on Android 16+.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Play Console's static bytecode scanner flags a deprecated API call's mere presence/reachability in the compiled app, not just whether the app's own top-level JS invokes it | Edge-to-Edge / DROID-02 | If wrong (i.e., Play only flags calls actually reachable from a live code path), the simpler "just delete the JS call" fix might have sufficed and the npm-uninstall is extra churn — still harmless, but worth noting as lower-certainty than the rest of this section. This claim is corroborated by multiple independent developer reports (see citations) but not confirmed against this specific app's own Play Console pre-launch report yet. |
| A2 | R8 cannot statically prove `SplashScreen.java`'s `legacyImmersive()`/`legacyFullscreen()` are unreachable (since the gating reads runtime config, not compile-time constants), so they likely remain in the shipped bytecode despite being unreachable at the JS/config level in this app | R8 / DROID-01, "Open question" subsection | If wrong and R8 does strip them, no action needed. If they do remain and Play flags them, the fix (not shipping `@capacitor/splash-screen`'s immersive mode) is not applicable here since this app needs the plugin for its actual splash-hide role — would need an upstream plugin issue or a proguard `-assumenosideeffects`/method-stripping rule as a workaround. Flagged for empirical verification against real `mapping.txt`/`seeds.txt`, not assumed either way in the plan. |

## Open Questions

1. **Does the R8-built app actually strip `SplashScreen.java`'s legacy immersive methods, and does Play's pre-launch report still flag them if not?**
   - What we know: the methods are gated behind config that defaults off and isn't set by this app; R8's static reachability analysis may or may not be able to prove that.
   - What's unclear: whether R8 removes truly-dead-but-not-provably-dead code paths in a helper class that isn't itself force-kept.
   - Recommendation: verify against the real build's `mapping.txt`/`seeds.txt` during DROID-01/02 verification, rather than plan around an assumption. Low urgency — even if present, this is a `SuppressWarnings("deprecation")`-annotated dead path gated by config this app doesn't set, so runtime risk is effectively zero; the only open question is whether Play's static scanner still flags it.

2. **Does the existing `test/unit/fit-resume.test.js` regression test alone satisfy CONTEXT.md's TOOL-01 proof bar ("A test runs a short fit live and then resumed from its log, and compares the walks"), or does the planner want literal CLI-subprocess-level coverage?**
   - What we know: the existing test is a full search-level regression test proving resume correctness against a synthetic (non-engine) scoring function; it already passes on master.
   - What's unclear: whether "runs a short fit live" in CONTEXT.md was written expecting the real engine/CLI path specifically, or is satisfied by the existing pure-library-level proof.
   - Recommendation: Claude's discretion per CONTEXT.md — the research finds the existing coverage technically satisfies the intent, but recommends the planner add a thin end-to-end CLI subprocess test anyway (cheap, ~4 seeds/1 worker/small budget) since it's the only path not yet covered and closes the loop completely.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| AGP / Gradle wrapper | R8 build (DROID-01), all Android builds | ✓ | AGP 8.13.0 / Gradle 8.14.3 (pinned, `tools/gradle.mjs`) | — |
| JDK | Android/Gradle toolchain | ✓ | 21.0.10.7 (Microsoft Build, pinned via `JAVA_HOME` + `tools/pin-jdk.mjs`) | — |
| Android Studio / resizable AVD system image | Large-screen emulator pass (DROID-03) | Not directly verified this session (requires the user's Android Studio install + an API 34+ system image download) | — | If a resizable AVD isn't already provisioned, the plan should budget an image download step; no code-level fallback needed since this is a verification-only requirement |
| Pixel 7 physical device (wireless adb) | R8 release-signed smoke, edge-to-edge nav-mode/cutout checks (DROID-01/02) | ✓ (per STATE.md: `adb-28051FDH200H0R`, established pairing) | — | — |
| `node --test` | TOOL-01 verification | ✓ | Node's built-in test runner, already the project's standard (`npm test`) | — |

**Missing dependencies with no fallback:** none identified — this phase has no genuinely blocking missing dependency.
**Missing dependencies with fallback:** resizable AVD system image may need a one-time download; not a plan blocker.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node's built-in `node:test` (via `node --test`) |
| Config file | none — plain `.test.js` files under `test/unit/`, `test/determinism/`, `test/roundtrip/` |
| Quick run command | `npm run test:quick` (unit/determinism/roundtrip only) |
| Full suite command | `npm test` (all suites, includes parity harness) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DROID-01 | `minifyEnabled true`/`shrinkResources true` present; expected plugin classes survive R8 | unit (source-grep) + manual (real R8 build inspection) | `node --test test/unit/android-release-build.test.js` (new, pattern per `play-games-intake.test.js`) | ❌ Wave 0 |
| DROID-01 | Release-signed Pixel 7 boot/save/resume/back/sound/haptics/Play-Games/boards | manual device smoke | n/a — batched into milestone-close checklist per deferred-UAT protocol | n/a |
| DROID-02 | `@capacitor/status-bar` absent from `package.json`; `SystemBars` used instead; no deprecated call sites remain in `nativeChrome.js` | unit (source-grep) | `node --test test/unit/android-release-build.test.js` (same file, additional assertions) | ❌ Wave 0 |
| DROID-02 | Gesture nav / 3-button nav / cutout render correctly | manual device smoke | n/a — batched | n/a |
| DROID-03 | `android:appCategory="game"` present in manifest; CSS letterbox column present | unit (source-grep) + emulator screenshot pass | `node --test test/unit/android-release-build.test.js` (same file) + manual resizable-AVD screenshots | ❌ Wave 0 |
| TOOL-01 | Resumed walk reproduces live walk exactly, including after `+Infinity` | unit (already exists) | `node --test test/unit/fit-resume.test.js` | ✅ already exists, already passing |
| TOOL-01 | (optional, discretion) real CLI subprocess resume matches real CLI subprocess live run | integration (new, optional) | `node --test test/unit/fit-difficulty-cli.test.js` (new, if the planner chooses to add it) | ❌ Wave 0 (optional) |

### Sampling Rate
- **Per task commit:** `npm run test:quick`
- **Per wave merge:** `npm test`
- **Phase gate:** full suite green + the manual Pixel 7/emulator passes documented before `/gsd-verify-work`, per the deferred-UAT protocol (no mid-run device pauses)

### Wave 0 Gaps
- [ ] `test/unit/android-release-build.test.js` — new file, source-grep assertions covering DROID-01/02/03's static, verifiable claims (build.gradle flags, manifest appCategory, package.json absence of `@capacitor/status-bar`, presence of the CSS letterbox rule). Follows the existing `test/unit/play-games-intake.test.js` pattern.
- [ ] (optional) `test/unit/fit-difficulty-cli.test.js` — real-CLI-subprocess end-to-end resume test, Claude's discretion.
- Framework install: none — `node --test` is already fully set up.

## Security Domain

> `workflow.nyquist_validation`/`security_enforcement` config keys not found in `.planning/config.json` during this research pass (file not inspected for this specific key — treat as enabled per default policy) — see note below.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | This phase touches no auth surface (Play Games sign-in is pre-existing, Phase 67, untouched here) |
| V3 Session Management | No | N/A |
| V4 Access Control | No | N/A |
| V5 Input Validation | No | This phase is build-configuration/native-shell/tooling only; no new user input surface |
| V6 Cryptography | No | Release signing (keystore) is pre-existing infrastructure (`docs/RELEASING.md`), unchanged by this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Reverse-engineering a paid, offline app's client-side logic (game rules, IAP-free monetization enforcement) | Information Disclosure | R8 obfuscation itself (this phase's DROID-01) is the mitigation already in scope — no additional control needed |
| A malicious npm package masquerading as a Capacitor plugin update | Tampering / Supply chain | Not applicable — this phase adds/removes only first-party `@capacitor/*` packages already vetted in this repo's `package-lock.json`; no new external package is introduced (see Package Legitimacy Audit below) |

**Note:** this phase installs no new third-party packages — `@capacitor/status-bar` is *removed*, and `@capacitor/core` (the replacement's home) is already an existing, installed dependency. The Package Legitimacy Gate protocol's package-install verification does not apply; see below.

## Package Legitimacy Audit

**No new external packages are introduced by this phase.** The only package-manifest change is a **removal** (`npm uninstall @capacitor/status-bar`) plus continued use of an **already-installed** dependency (`@capacitor/core`, present in `package.json` at `^8.5.1`, verified installed at `node_modules/@capacitor/core` version `8.5.1`, sha-pinned in the existing `package-lock.json`). No `package-legitimacy check` run was needed or performed — there is nothing new to check.

**Packages removed due to [SLOP] verdict:** none (not applicable — `@capacitor/status-bar` is a legitimate, official first-party Capacitor package being intentionally dropped for architectural reasons, not a legitimacy concern).
**Packages flagged as suspicious [SUS]:** none.

## Sources

### Primary (HIGH confidence — direct source reads of this repo and its installed dependencies)
- `android/app/build.gradle`, `android/build.gradle`, `android/variables.gradle`, `android/app/proguard-rules.pro`, `android/app/src/main/AndroidManifest.xml`, `android/app/src/main/java/.../MainActivity.java`, `android/app/src/main/res/values/styles.xml`, `android/app/src/main/assets/capacitor.plugins.json`, `android/capacitor.build.gradle`, `android/gradle.properties`
- `capacitor.config.json`, `package.json` (Capacitor plugin version pins)
- `src/browser/nativeChrome.js` (full read)
- `mazeworld.html` (viewport meta, `--safe-area-inset-*` usage sites, `#app.mw-app`/`.wrap`/`.mw-roller-body` CSS)
- `tools/fit-difficulty.mjs`, `tools/lib/fit-score.mjs`, `tools/lib/fit-resume.mjs`, `test/unit/fit-resume.test.js`, `test/unit/play-games-intake.test.js` (full reads)
- `tools/build-www.mjs` (`CAPACITOR_PACKAGES` list)
- `node_modules/@capacitor/android/capacitor/src/main/java/com/getcapacitor/{Bridge,BridgeActivity,MessageHandler}.java`, `node_modules/@capacitor/android/capacitor/src/main/java/com/getcapacitor/plugin/SystemBars.java` (full read)
- `node_modules/@capacitor/android/capacitor/proguard-rules.pro`, `node_modules/@capacitor/android/capacitor/build.gradle`
- `node_modules/@capacitor/android/capacitor/build/intermediates/default_proguard_files/global/proguard-android.txt-8.13.0` (AGP's bundled default ProGuard file, unpacked copy)
- `node_modules/@capacitor/status-bar/android/src/main/java/com/capacitorjs/plugins/statusbar/{StatusBar,StatusBarPlugin}.java`, `node_modules/@capacitor/status-bar/README.md`
- `node_modules/@capacitor/splash-screen/android/src/main/java/.../SplashScreen.java`
- `node_modules/@capacitor/core/dist/index.js` (SystemBars export confirmation)
- `node_modules/@modbender/capacitor-play-games/android/{proguard-rules.pro,consumer-rules.pro,build.gradle}`, full grep of its `src/` for deprecated window APIs
- `git log --oneline -- tools/lib/fit-resume.mjs` (commit `6b48281`)
- `.planning/phases/80-android-release-build-tooling/80-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/ROADMAP.md` (backlog 999.9), `.planning/todos/pending/2026-09-21-fit-tool-replay-resume-diverges-after-an-infeasible-point.md`, `docs/RELEASING.md`

### Secondary (MEDIUM confidence — official docs, cross-checked)
- developer.android.com/about/versions/16/behavior-changes-16 — Android 16 large-screen orientation/resizability enforcement + game-category exemption
- developer.android.com/develop/adaptive-apps/guides/app-orientation-aspect-ratio-resizability — manifest properties, opt-out mechanism, per-activity vs per-app scoping
- developer.android.com/studio/run/resizable-emulator — Resizable (Experimental) AVD, reference device postures
- support.google.com/googleplay/android-developer/answer/9848633 — Play Console deobfuscation/mapping.txt auto-extraction from App Bundle metadata
- capacitorjs.com/docs/apis/system-bars — SystemBars JS API surface, `insetsHandling` config, migration note from Status Bar plugin

### Tertiary (LOW confidence — community reports, corroborating but not authoritative)
- Multiple GitHub issue threads (flutter/flutter#183372, apache/cordova-android#2018, VEYRNOX/veyrnox#2749, AppLovin-MAX-Unity-Plugin#516) on Play Console continuing to flag deprecated status/nav-bar API calls even when the app's own code doesn't invoke them directly — used only to corroborate the "static analysis flags the call, not just its reachability from app code" inference (Assumption A1), not as a primary claim.

## Metadata

**Confidence breakdown:**
- Standard stack (Capacitor 8 SystemBars, R8/AGP mechanics): HIGH — every claim traced to a direct source read of the actual installed package or this repo's own files
- Architecture (edge-to-edge insets flow, large-screen orientation mechanism): HIGH — corrected against current official Android docs, not assumed from training data
- Pitfalls: HIGH for the R8/status-bar/fit-tool findings (source-verified); MEDIUM for the Play-static-analysis-reachability claim (A1, corroborated but not confirmed against this app's own Play Console report)

**Research date:** 2026-09-25
**Valid until:** ~30 days for the Capacitor/AGP-version-specific findings (this is a fast-moving area — Android 16/17 policy and Capacitor 8.x point releases could shift specifics); the fit-tool findings are stable indefinitely (they describe code already on master, not a moving target).
