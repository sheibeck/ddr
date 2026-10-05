# Android display: edge-to-edge, system bars and large screens

This doc records the Phase 80 (Android Release Build & Tooling) decisions for how the app
behaves on modern Android displays: edge-to-edge rendering, deprecated window APIs, and
large-screen (tablet / foldable / Chromebook) layout. Phase 97 (Large-Screen Support) later
replaced the large-screen decision. It exists to close the three warnings
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

- Warning 3 (display configurations / orientation) — Phase 80 (80-03) first, superseded by
  Phase 97 (SCREEN-01..06) in "Large screens (DROID-03, SCREEN-01..06)" below.
- Warnings 1 and 2 (edge-to-edge default, deprecated window APIs) — the edge-to-edge and
  audit sections 80-04 adds after the one release build this milestone makes.
- The emulator tablet/foldable pass and the Pixel 7 verification results — absorbed by Phase
  97: the layout check runs in-repo (`npm run layout:check`), and the emulator pass runs at
  the v2.4 build gate.

This doc is written incrementally: each plan writes only the sections it owns, and later
plans append rather than pre-declaring empty headings.

## Large screens (DROID-03, SCREEN-01..06)

**Decision (Phase 97, user rulings 2026-10-04):** the manifest carries no orientation,
resizability or aspect-ratio restriction, and the layout follows the window, not the device.
`android/app/src/main/AndroidManifest.xml` has no `android:screenOrientation`, no
`resizeableActivity="false"`, no `maxAspectRatio` and no `<layout>` element (a test pins all
four). That is why Play's large-screen notice clears: the notice is about restrictions, and
the restrictions are gone.

- `android:appCategory="game"` stays on `<application>`. It is the honest category for the
  app. It no longer carries an orientation lock, because there is no lock for it to protect.
- `android:configChanges` stays exactly as it was, ten entries:
  `orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode|navigation|density`.
  Rotation, fold, unfold, resize and multi-window therefore never recreate the activity or
  the WebView. The run, a fight, an open store, the active tab, the camera and an open sheet
  all survive, because the DOM and the module variables that hold them are never torn down.
  The saved state (`S`, written on every dispatch and flushed on pause) is the second net for
  the cases where Android kills the process anyway.

**Phones choose, everything else follows.** Settings, Screen has two options: Portrait (the
default) and Rotate. It applies only when `Math.min(screen.width, screen.height)` is below
600 CSS px (`PHONE_SMALLEST_WIDTH_LIMIT`, `decideOrientationLock` and `syncOrientationLock`
in `src/browser/nativeChrome.js`). Portrait locks the screen at runtime with
`ScreenOrientation.lock`; Rotate unlocks it. The decision is re-applied when the setting
changes and on every layout sync, so folding a foldable re-locks its cover screen and
unfolding releases it. Tablets, unfolded foldables and Chromebooks always follow the device;
they never get the lock and never show the Settings row.

**Window size classes.** `src/browser/layoutClass.js` is the one source. The stylesheet
uses the exact `LAYOUT_MEDIA` strings; script reads the same strings through `matchMedia`
and publishes the result as `window.__mzLayout` and `html[data-mw-layout]`, so CSS and JS
cannot disagree. Classes are evaluated in the order of this table, and a screen that is both
short and wide is short.

| Class | Rule | Layout |
|---|---|---|
| short | height under 480 | The landscape layout, a phone on its side. A navigation rail down the left edge, a one-row HUD across the top, and the map filling the rest. A right-hand panel (about 45% wide, scrolling) holds the rail card, a fight, the store, loot, the stairs, the death card or Make Camp, and takes width only while one of them is up. Hero, Gear, the Oracle, Dead, the leaderboards and the sheets sit in a centred column of at most 640 px at full height; Hero and Gear flow into two columns. |
| compact | under 600 wide | Today's phone portrait stack: two-band HUD, the map, the rail card over its bottom, the tab bar along the bottom. Unchanged apart from `dvh`. |
| medium | 600 to 839 wide | The compact stack, widened. The map fills the width with scaled cells; Hero, Gear, the Oracle, Dead, the sheets, the encounter content and the rail card centre at 640 px. The tab bar stays along the bottom. |
| expanded | 840 or more wide and 480 or more tall | Two panes. The map stays on the left on every tab. A persistent right pane (`clamp(360px, 40%, 560px)`) holds Hero, Gear, the Oracle or Dead; on the map tab it holds the rail card or the fight, store or encounter panel. Tabs sit in the left navigation rail. A fight that starts while the pane shows something else switches to the map tab once, so the fight takes the pane. |

The thresholds are written 479.98, 599.98 and 839.98 in the `max-*` queries because a
fractional CSS pixel size (a 2.625 density phone reports 411.43 px wide) must never fall
between two classes. The only gap is the 0.02 px sliver under each whole-number threshold,
which no real screen reports; compact is the default there.

**The map scales with the window.** Cells grow with the window's shorter side:
`1 + (shorter - 412) / 800`, capped at 1.5x, and the cell itself is capped at 144 px, today's
largest phone cell (`cellScaleForWindow`, `cellPxFor`, `CELL_MAX_PX` in
`src/browser/canvasSizing.js`). A tablet shows the same explored maze, larger and easier to
tap. Fog still limits what is seen, so difficulty does not move. Phones are unchanged to the
pixel. Taps need no change: `screenToCell` already measures the viewport's own rectangle.

**The letterbox column is retired.** Phase 80 held every wide window to one 480 px portrait
column over dark gutters (`<style id="mw-letterbox">`, with `contain:layout` on `body` to
trap the fixed overlays). It went because the size-class layouts use the screen the player
actually has. `body` no longer carries `contain:layout` or a `max-width`; the title, roller,
sheets and overlays size against the window and centre their own panels at the readable
width. The layout rules live in one delimited block, `<style id="mw-layout">`, in
`mazeworld.html`: global rules, the compact notes, then the side group (short and expanded),
the short group, the medium group and the expanded group, in that source order, every rule
indented two spaces.

**Units and insets.** The app height and the five window-sized maxima (the HUD menu, the
legend panel, the Oracle log, the find shelf and the report text) use `dvh`, with a `vh`
declaration before it as the fallback for WebViews that predate the unit, so the Android
navigation and URL bars never leave a gap or a clipped control. All four safe-area insets
are honoured through `var(--safe-area-inset-*, env(safe-area-inset-*))`:

- Top: the HUD bands and, in the side layouts, the top of the navigation rail and the docked
  Make Camp sheet.
- Bottom: the tab bar in compact and medium, the bottom of the navigation rail and the side
  rail card in the side layouts.
- Left: the HUD bands, the condition strip, the tab bar or navigation rail, the sheet panels,
  the title body and account chip, and the roller, so a landscape camera cutout never covers
  text.
- Right: the same surfaces on the other edge, plus the stage, the side panel and the rail
  card, and the docked Make Camp sheet.

**How to check it:** `npm run layout:check` (`tools/layout-check.mjs`, which replaced
`tools/letterbox-check.mjs`). It is a dependency-free headless-Chrome driver. It renders
twelve profiles across the four classes: phone portrait 412x915, phone landscape 915x412, a
360 dp phone on its side 800x360, a 7-inch tablet in both orientations, a 10-inch tablet in
both, a folded foldable 411x797, an unfolded foldable 841x701 and upright 701x841, and two
Chromebook windows (1366x768 and 683x768). In each it builds the title, roller, map, map with
a rail card, Settings, Hero, Gear, the Oracle, Dead, an encounter, a fight round, the store
and Make Camp from real engine states, plus a rotate-mid-fight and rotate-mid-store round
trip and a set of probes at the class boundaries. A run fails (exit 1) on horizontal
overflow, a clipped control, a page exception, a wrong `data-mw-layout`, or a broken layout
shape (for example the tab bar on the wrong edge, or the expanded pane outside 360 to 560
px). It exits 0 when everything passes and 2 when no browser can be driven. Screenshots go
to `tools/layout-check-output/`, which is gitignored. The check runs with zero insets, so a
cutout is covered by the device pass instead.

The Android emulator pass, absorbing the Phase 80 emulator plan (80-05), runs at the v2.4
build gate on the debug APK: pixel_7 with gesture and 3-button navigation and a cutout,
pixel_tablet rotated both ways, pixel_fold folded and unfolded, and a desktop-size window
dragged across 840 px. Its rows join the batched Pixel 7 checklist.

**Play's warning 3 — verdict:** addressed by removing the restriction rather than by
accepting it. The verdict is **confirmed** once the next upload's pre-launch report runs
against a build carrying this manifest (a milestone-close item, recorded here once known).

**History.** Phase 80 (80-03) first answered warning 3 by keeping the restrictions and
declaring the app a game: its research correction found that Android 16 exempts games from
the large-screen ignore rule, so the portrait lock stayed honoured, and the 480 px column
handled the width. Phase 97 reversed that on the user's ruling: the game now fills the
screen it is on. The Phase 80 screenshots are kept as history only and describe a layout
that no longer exists:
[`80-screens/`](../.planning/phases/80-android-release-build-tooling/80-screens/)
(`browser-{phone,tablet,foldable,chromebook}-{title,app}.png`).

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
because the manifest audit ran alongside this scan against the same build). Phase 97 removed
the orientation attribute; the next build-gate audit records the merged manifest without it.

**Re-run the scan after every release build.** A new caller appearing here — especially one
under `androidx` at a different API level, or any row under `app` or the removed
`com.capacitorjs.plugins.statusbar` prefix — means a dependency (Capacitor core or a plugin;
the app carried no Play Games plugin as of v2.2) changed its own deprecated-API usage and needs
a fresh review before the next upload; it is not something this plan's `--fail-on` list would
silently miss, since it only gates on the two known-bad prefixes, not on every androidx
back-compat row.
