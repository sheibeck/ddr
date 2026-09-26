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
