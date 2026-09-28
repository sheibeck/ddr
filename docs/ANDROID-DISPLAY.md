# Android display: edge-to-edge, system bars and large screens

This doc records the Phase 80 (Android Release Build & Tooling) decisions for how the app
behaves on modern Android displays: edge-to-edge rendering, deprecated window APIs, and
large-screen (tablet / foldable / Chromebook) layout. It exists to close the three warnings
Play Console's pre-launch report raised against the 1.9.0 / vc8 build, quoted verbatim below
(`.planning/ROADMAP.md` backlog 999.9).

**The three warnings, verbatim from Play Console:**

1. *"From Android 15, apps targeting SDK 35 will display edge-to-edge by default. Apps
   targeting SDK 35 should handle insets to make sure that their app displays correctly on
   Android 15 and later. Investigate this issue and allow time to test edge-to-edge and make
   the required updates. Alternatively, call enableEdgeToEdge() for Kotlin or
   EdgeToEdge.enable() for Java for backward compatibility."*
2. *"One or more of the APIs you use or parameters that you set for edge-to-edge and window
   display have been deprecated in Android 15. To fix this, migrate away from these APIs or
   parameters."*
3. *"Your game doesn't support all display configurations, and uses resizability and
   orientation restrictions that may lead to layout issues for your users."*

**Which section owns which warning:**

- Warning 3 (display configurations / orientation) — this plan (80-03), in "Large screens
  (DROID-03)" below.
- Warnings 1 and 2 (edge-to-edge default, deprecated window APIs) — the edge-to-edge and
  audit sections 80-04 adds after the one release build this milestone makes.
- The emulator tablet/foldable pass and the Pixel 7 verification results — the verification
  section 80-05 adds after that build is installed.

This doc is written incrementally: each plan writes only the sections it owns, and later
plans append rather than pre-declaring empty headings.

## Large screens (DROID-03)

**Decision:** one centred 480 CSS px portrait column over `#080705` gutters (with a thin
rule down each side) on anything wider than a phone. Phones (480 CSS px and narrower) are
completely unchanged — no column, no gutters, no containing-block change. There is no
landscape layout and no second layout mode; the app stays a single portrait experience
everywhere.

**The mechanism, corrected:** Android 16 (targetSdk 36) ignores orientation, resizability
and aspect-ratio restrictions on displays with smallest width >= 600dp — apps are made to
fill the entire display window regardless of a locked orientation or aspect ratio — **except
apps declared as games** via the manifest's `android:appCategory="game"` attribute, which are
exempt from that ignore-rule and keep their orientation lock honoured. This app now declares
that category on `<application>` in `android/app/src/main/AndroidManifest.xml`, so both the
manifest's `android:screenOrientation="portrait"` (on `.MainActivity`) and the JS-side
`ScreenOrientation.lock({ orientation: "portrait" })` in `src/browser/nativeChrome.js` stay
honoured on tablets, foldables and Chromebooks, exactly as they already are on phones.

This is a correction from the phase's own context-gathering: `80-CONTEXT.md` originally
described the opposite reading — "declare the app a game… and let large screens rotate and
resize around the column, Android 16 ignores orientation locks there anyway." Research
against the current, authoritative Android developer documentation
(`developer.android.com/about/versions/16/behavior-changes-16` and
`developer.android.com/develop/adaptive-apps/guides/app-orientation-aspect-ratio-resizability`)
found the exemption runs the other way: declaring the game category is what keeps the lock
in force. The corrected reading is recorded in `80-03-PLAN.md`'s own "Research correction"
section and here.

**Why the column still matters:** the game-category declaration only prevents *rotation and
resizing* — it says nothing about the *width* of the portrait window itself. A tablet,
unfolded foldable or Chromebook window in portrait is commonly 700-1200 CSS px wide, versus a
phone's roughly 360-430px. Nothing in the orientation-lock mechanism narrows that window back
down to a phone-shaped column, so without a deliberate layout decision the shell would simply
stretch every panel, sheet and HUD element across the full width. The letterboxed column is
the fix for that width problem, independent of (and unaffected by) the orientation fix.

**How it is built:** a single delimited style block, `<style id="mw-letterbox">` in
`mazeworld.html`, inserted as the last `<style>` element in `<head>` with `BEGIN`/`END`
marker comments so future gameplay-phase edits to the file's other style blocks merge around
it cleanly. Its one rule, gated behind `@media (min-width:481px)` so phones are never
affected:

```css
@media (min-width:481px){
  :root{background:#080705}
  html>body{max-width:480px;margin:0 auto;contain:layout;box-shadow:0 0 0 1px var(--rule),0 0 40px rgba(0,0,0,.6)}
}
```

- `contain:layout` on `html>body` makes `body` the containing block for every
  `position:fixed` descendant with `inset:0` — the title screen, the roller screen, the five
  bottom sheets (MARKS legend, Settings, Account, Camp, Gear, Fight-so-far) and the HUD menu
  scrim. Because the containing block is `body` rather than the viewport, every one of those
  overlays (and any fixed overlay a later phase adds) automatically resolves inside the
  480px column with zero per-overlay CSS.
- `:root` and `html>body` (rather than a lone `body{...}` rule folded into an existing block)
  are used because these selectors win regardless of where the file's other `<style>` blocks
  set `body`'s own margin or background — a later edit elsewhere in the file cannot silently
  reorder this rule out of effect.
- Every `vw`-based measurement already existing in the file (`.mw-hud-menu`'s
  `min(288px, calc(100vw - 40px))` width, two font-size `clamp()` calls, and the map's
  `min(62vw, 420px)` intended "big map" sizing) resolves to values comfortably inside 480px
  regardless of viewport, so none needed a change.
- Taps need no change: `src/browser/controls.js#screenToCell` already computes pointer
  coordinates relative to `.mw-maze-viewport`'s own `getBoundingClientRect()`, and that
  viewport is a normal in-flow child of `#app`, so it is carried into the column by the same
  `html>body` constraint with no separate rule.

**Play's warning 3 — verdict:** addressed. Android's own developer documentation states
games are exempt from the large-screen ignore-rule the warning describes, and this app now
declares that exemption. Community reports corroborate that declaring `android:appCategory`
is the documented, intended way to both keep the orientation lock and clear this specific
warning. The verdict is **confirmed** once the next Play pre-launch report runs against a
build carrying this manifest change (80-05 records the result); until then this section's
reasoning is the "consciously accepted" fallback if the warning persists.

**How to check it:** `node tools/letterbox-check.mjs --shots <dir>` — a dependency-free
headless-Chrome CDP driver that measures `#app`, `.mw-maze-viewport` and every
`position:fixed` overlay across five viewports (phone 412x915, phone-max 480x1000 — both
full-width; tablet 800x1280, foldable 700x840, chromebook 1280x800 — all three centred to the
480px column) and exits non-zero on any mismatch. 80-04 re-runs it against the final
milestone code to confirm later gameplay-phase overlays still land inside the column.
The screenshots below were captured by that tool at this plan's HEAD, showing the column
against real 480x1000/phone-max layout math on the tablet/foldable/chromebook widths
(phone-max exists to pin the boundary in the measurement, not for a screenshot pair):

- [`80-screens/browser-phone-title.png`](../.planning/phases/80-android-release-build-tooling/80-screens/browser-phone-title.png) /
  [`80-screens/browser-phone-app.png`](../.planning/phases/80-android-release-build-tooling/80-screens/browser-phone-app.png) —
  412 CSS px: full-width, unchanged.
- [`80-screens/browser-tablet-title.png`](../.planning/phases/80-android-release-build-tooling/80-screens/browser-tablet-title.png) /
  [`80-screens/browser-tablet-app.png`](../.planning/phases/80-android-release-build-tooling/80-screens/browser-tablet-app.png) —
  800 CSS px: the 480px column, centred, with `#080705` gutters either side.
- [`80-screens/browser-foldable-title.png`](../.planning/phases/80-android-release-build-tooling/80-screens/browser-foldable-title.png) /
  [`80-screens/browser-foldable-app.png`](../.planning/phases/80-android-release-build-tooling/80-screens/browser-foldable-app.png) —
  700 CSS px: same column treatment, narrower gutters.
- [`80-screens/browser-chromebook-title.png`](../.planning/phases/80-android-release-build-tooling/80-screens/browser-chromebook-title.png) /
  [`80-screens/browser-chromebook-app.png`](../.planning/phases/80-android-release-build-tooling/80-screens/browser-chromebook-app.png) —
  1280 CSS px: the widest gutters of the five viewports, column still exactly 480px.

## Edge-to-edge and system bars (DROID-02)

**How insets reach the CSS.** `targetSdkVersion 36` (`android/variables.gradle`) means the app
draws edge-to-edge by default on Android 15+ — the WebView's window extends behind the status
and navigation bars unless something opts out, which nothing here does. Capacitor 8's core
`SystemBars` plugin (`node_modules/@capacitor/android/capacitor/.../plugin/SystemBars.java`,
auto-registered, no separate npm package) owns turning those raw insets into CSS the shell can
read, and behaves one of two ways depending on the device's WebView build:

- **WebView 140+ with `viewport-fit=cover`** (mazeworld.html's `<meta name="viewport">` already
  has it): `SystemBars` passes the real system-bar/cutout insets straight through to the
  WebView's own `env(safe-area-inset-*)` CSS environment variables — the standard web platform
  mechanism — and additionally sets `--safe-area-inset-top/right/bottom/left` as a fallback.
- **Older WebView, or `viewport-fit=cover` absent:** `SystemBars` instead pads the WebView's
  parent view by the inset amounts in native code and reports zero insets to the page (so the
  page never double-pads), while still setting the same four `--safe-area-inset-*` custom
  properties from the real inset values it measured.

Either path lands on the same four `--safe-area-inset-*` CSS custom properties, which
mazeworld.html's fixed chrome already reads via
`var(--safe-area-inset-*, env(safe-area-inset-*))` (the HUD band, the dead screen, the bottom
dock, and the title/legend/settings/account/camp/gear/fight-log panels — see 80-CONTEXT.md's
file inventory). No CSS changed for this plan: the fallback pattern was already in place and
simply started receiving real values instead of zeros.

**Why the shell stays a plain `BridgeActivity`.** `MainActivity.java` is
`public class MainActivity extends BridgeActivity {}` — no `EdgeToEdge.enable(this)` call, and
none is added. Edge-to-edge is already the *default* behavior on `targetSdkVersion 36`/Android
15+, so the helper would be redundant on the OS versions that matter here; more importantly,
`androidx.activity.EdgeToEdge`'s own pre-Android-35 compatibility paths (`EdgeToEdgeApi28`/`Api29`,
visible as `androidx` callers in the deprecated-API audit below) call the same
`Window.setStatusBarColor`/cutout-mode APIs Play's warning 2 flags — adding the helper would add
deprecated-API call sites this app does not otherwise reach, for no benefit on the targeted SDK.

**The DARK style, with no bar-colour call anywhere.** `capacitor.config.json`'s
`plugins.SystemBars` block (`{ "insetsHandling": "css", "style": "DARK" }`) sets the icon style
correctly from the very first native frame, before any JS runs. `src/browser/nativeChrome.js`'s
`registerNativeChrome` then calls `SystemBars.setStyle({ style: "DARK" })` once, on top of that —
belt-and-suspenders for any code path where the config value alone might not apply (e.g. a
config change). Neither call site — nor anything else in this codebase — ever calls a
background/bar-*colour* API (`setStatusBarColor`, `setBackgroundColor`, `setNavigationBarColor`,
or their AndroidX equivalents). `SystemBars` styles bar *icons* light-on-dark via
`WindowInsetsControllerCompat#setAppearanceLightStatusBars(false)` /
`setAppearanceLightNavigationBars(false)`, which is not a deprecated API.

**Why the status-bar plugin was removed, not just stopped calling.** 80-RESEARCH.md found that
the retired `@capacitor/status-bar` plugin's `StatusBarPlugin.load()` called the deprecated
`Window.setStatusBarColor` on *every* native launch, from its own constructor — independent of
whether any JS code ever called the plugin — because Capacitor auto-registers every plugin
listed in `capacitor.plugins.json`. Dropping the JS call alone would not have removed the
deprecated call; 80-02 uninstalled the package outright (`npm uninstall @capacitor/status-bar`,
`cap sync` regenerating the native project without it). This build's `capacitor.plugins.json`
(the Task 3 audit below) confirms the plugin classpath is gone, and the mapping confirms no
`com.capacitorjs.plugins.statusbar` class survived into the shrunk output.

**Android 7-14 (pre-edge-to-edge) path.** `android/app/src/main/res/values/styles.xml`'s
`AppTheme.NoActionBar` sets `colorPrimaryDark` (`#1b170f`) and `android:windowBackground`
(`#14110c`) — both non-deprecated AppCompat/platform theme attributes. `colorPrimaryDark` is
what AppCompat still paints the status bar with on OS versions where edge-to-edge is not forced
(Android 7-14); `android:windowBackground` is the colour the WebView's parent shows behind it on
Android 15+ before/between frames. Neither of the two Android-15-deprecated bar-colour theme
attributes (`android:statusBarColor`, `android:navigationBarColor`) is set anywhere in this
theme — `SystemBars` owns bar appearance exclusively via `WindowInsetsControllerCompat`.

**Play Console warnings 1 and 2, verbatim, with verdicts:**

1. *"From Android 15, apps targeting SDK 35 will display edge-to-edge by default. Apps
   targeting SDK 35 should handle insets to make sure that their app displays correctly on
   Android 15 and later. Investigate this issue and allow time to test edge-to-edge and make
   the required updates. Alternatively, call enableEdgeToEdge() for Kotlin or
   EdgeToEdge.enable() for Java for backward compatibility."*
   **Verdict: addressed.** The app draws edge-to-edge by default (no opt-out), `SystemBars`
   feeds real insets into `--safe-area-inset-*` (verified against this build's config and
   source above), and the existing CSS fallbacks already consume them. Device and emulator
   evidence (both nav modes, a cutout if available, both system themes) is recorded in 80-05's
   verification section, appended to this doc after that pass.
2. *"One or more of the APIs you use or parameters that you set for edge-to-edge and window
   display have been deprecated in Android 15. To fix this, migrate away from these APIs or
   parameters."*
   **Verdict: addressed for this app's own code and the plugin removed; residual library
   back-compat paths remain, tracked below.** Neither `mazeworld.html`/`src/browser/` nor
   `MainActivity.java` calls any deprecated window/system-UI API. The one plugin that did
   (`@capacitor/status-bar`) is uninstalled and confirmed absent from this build's shrunk
   output. The "Deprecated window API audit" section immediately below lists every remaining
   call site this build's scan found (all in AndroidX/Capacitor SplashScreen library
   back-compat code for older OS versions, none reachable through this app's own settings) with
   an owner and a verdict per row. The final verdict — whether Play's own pre-launch analysis
   still flags any of these residual library paths — is only known after the next Play upload
   (milestone-close item, recorded once known).

## Deprecated window API audit

**BUILD_COMMIT:** `acba40ed9259f2a107c5355f5937417c0b256720`
**Date:** 2026-09-28
**Scan command:**

```
node tools/android-api-scan.mjs \
  --aab C:/projects/mazeworld-build/phase80-acba40ed/app-release.aab \
  --mapping C:/projects/mazeworld-build/phase80-acba40ed/mapping.txt \
  --fail-on com.capacitorjs.plugins.statusbar,com.darktierstudios.delvedierepeat
```

Exit code **0** (clean). 23 call site(s) in 15 caller method(s); **0 unresolved** (still
obfuscated) callers. Re-run against the unsigned APK (`--apk app-release-unsigned.apk`, same
mapping) with `--json`: identical 23 rows, identical totals — the AAB and APK scans agree.

| API | Deprecated in | Owner | Caller | Count | Verdict |
|---|---|---|---|---|---|
| `View.getSystemUiVisibility` | API 30 | androidx | `WindowCompat$Api16Impl#setDecorFitsSystemWindows` | 1 | library back-compat path (pre-API-30 branch of a multi-version dispatcher) |
| `View.getSystemUiVisibility` | API 30 | androidx | `WindowCompat$Api30Impl#setDecorFitsSystemWindows` | 1 | library back-compat path |
| `View.getSystemUiVisibility` | API 30 | androidx | `WindowInsetsControllerCompat$Impl20#setSystemUiFlag` | 1 | library back-compat path (API 20-29 branch) |
| `View.getSystemUiVisibility` | API 30 | androidx | `WindowInsetsControllerCompat$Impl20#unsetSystemUiFlag` | 1 | library back-compat path |
| `View.getSystemUiVisibility` | API 30 | androidx | `WindowInsetsControllerCompat$Impl30#setSystemUiFlag` | 1 | library back-compat path |
| `View.getSystemUiVisibility` | API 30 | androidx | `WindowInsetsControllerCompat$Impl30#unsetSystemUiFlag` | 1 | library back-compat path |
| `View.setSystemUiVisibility` | API 30 | androidx | `CoordinatorLayout#setupForInsets` | 1 | library back-compat path (pre-insets-API device support) |
| `View.setSystemUiVisibility` | API 30 | androidx | `WindowCompat$Api16Impl#setDecorFitsSystemWindows` | 1 | library back-compat path |
| `View.setSystemUiVisibility` | API 30 | androidx | `WindowCompat$Api30Impl#setDecorFitsSystemWindows` | 1 | library back-compat path |
| `View.setSystemUiVisibility` | API 30 | androidx | `WindowInsetsControllerCompat$Impl20#setSystemUiFlag` | 1 | library back-compat path |
| `View.setSystemUiVisibility` | API 30 | androidx | `WindowInsetsControllerCompat$Impl20#unsetSystemUiFlag` | 1 | library back-compat path |
| `View.setSystemUiVisibility` | API 30 | androidx | `WindowInsetsControllerCompat$Impl30#setSystemUiFlag` | 1 | library back-compat path |
| `View.setSystemUiVisibility` | API 30 | androidx | `WindowInsetsControllerCompat$Impl30#unsetSystemUiFlag` | 1 | library back-compat path |
| `Window.setDecorFitsSystemWindows` | API 35 | androidx | `SplashScreen$Impl31$$ExternalSyntheticApiModelOutline2#m` | 1 | unreachable by config (splash-screen `core-splashscreen` back-compat helper; not invoked unless the OS-level splash API is unavailable) |
| `Window.setDecorFitsSystemWindows` | API 35 | androidx | `WindowCompat$Api30Impl#setDecorFitsSystemWindows` | 1 | library back-compat path |
| `Window.setDecorFitsSystemWindows` | API 35 | androidx | `WindowCompat$Api35Impl#setDecorFitsSystemWindows` | 1 | library back-compat path (this app's own `WindowCompat` use goes through the plain, non-deprecated Api35 dispatch branch on a device actually running API 35+; this row is the dispatcher's *own* pre-35 fallback branch, present in the class file regardless of which branch executes at runtime) |
| `Window.setNavigationBarColor` | API 35 | androidx | `SplashScreen$Impl31#applyAppSystemUiTheme` | 1 | unreachable by config (`core-splashscreen`'s theme-attribute-driven bar-colour path; this app's splash theme sets neither `windowSplashScreenBackground`-adjacent bar-colour attribute that would route through this method) |
| `Window.setStatusBarColor` | API 35 | androidx | `SplashScreen$Impl31#applyAppSystemUiTheme` | 1 | unreachable by config (same method as above, status-bar branch) |
| `View.setSystemUiVisibility` | API 30 | Capacitor plugin: splashscreen | `SplashScreen#legacyFullscreen` | 1 | library back-compat path for older OS versions (splash-screen plugin's pre-Android-12 fallback; the splash-screen answer below) |
| `View.setSystemUiVisibility` | API 30 | Capacitor plugin: splashscreen | `SplashScreen#legacyImmersive` | 1 | library back-compat path for older OS versions (same fallback family) |
| `WindowCompat.setDecorFitsSystemWindows` | API 35 | Capacitor plugin: splashscreen | `SplashScreen#lambda$show$5` | 1 | library back-compat path (splash-screen plugin's own show/teardown sequencing, gated on the plugin's own visibility state, not app config) |
| `WindowCompat.setDecorFitsSystemWindows` | API 35 | Capacitor plugin: splashscreen | `SplashScreen#lambda$show$6` | 1 | library back-compat path |
| `WindowCompat.setDecorFitsSystemWindows` | API 35 | Capacitor plugin: splashscreen | `SplashScreen#tearDown` | 1 | library back-compat path |

**Owner summary:** androidx 18 rows (all library back-compat dispatch, none from this app's own
source), Capacitor plugin: splashscreen 5 rows (same back-compat family, scoped to that
plugin's own multi-OS-version support code), **app: 0 rows**, **status-bar plugin: 0 rows** (the
`--fail-on com.capacitorjs.plugins.statusbar` prefix matched nothing).

**The splash-screen legacy-method answer (research assumption A2, resolved from this build):**
`legacyFullscreen` and `legacyImmersive` **do survive** in the
`com.capacitorjs.plugins.splashscreen.SplashScreen` block of `mapping.txt` — R8 keeps them
rather than stripping them as dead code, because the `core-splashscreen` dependency's own
consumer keep rules (not this app's `proguard-rules.pro`) protect the plugin's public API
surface generally, and R8 cannot statically prove which OS-version branch a device will take at
runtime. Their gates (`capacitor.config.json`'s `androidSplashResourceName`/`launchAutoHide`
config, and the plugin's own OS-version checks) mean neither call site fires unless the device
falls back to the pre-Android-12 fullscreen/immersive splash presentation this app's settings do
not request — they are present in the shipped bytecode as dead-at-runtime back-compat, not as
something this app's configuration reaches.

**Manifest confirmation:** the merged manifest in this build's unsigned APK
(`aapt2 dump xmltree --file AndroidManifest.xml`) carries
`android:appCategory(0x01010545)=0` on `<application>` and
`android:screenOrientation(0x0101001e)=1` on `MainActivity` — `0` and `1` are aapt2's resolved
integer values for `"game"` and `"portrait"` respectively (DROID-03, cross-referenced here
because the manifest audit ran alongside this scan against the same build).

**Re-run the scan after every release build.** A new caller appearing here — especially one
under `androidx` at a different API level, or any row under `app` or the removed
`com.capacitorjs.plugins.statusbar` prefix — means a dependency (Capacitor core, a plugin, or
the Play Games plugin) changed its own deprecated-API usage and needs a fresh review before the
next upload; it is not something this plan's `--fail-on` list would silently miss, since it
only gates on the two known-bad prefixes, not on every androidx back-compat row.
