# Phase 97: Large-Screen Support - Context

**Gathered:** 2026-10-04
**Status:** Ready for planning

<domain>
## Phase Boundary

The game installs and plays on every Android screen: phone portrait and landscape, 7" and 10" tablets, foldables folded and unfolded, and a Chromebook window. Rotating, folding or resizing never loses a run (SCREEN-01..06).

This phase covers three things:
- **Android side:** remove the manifest orientation lock and make the runtime lock a phone-only Settings choice.
- **Shell side (`mazeworld.html` CSS/markup plus `src/browser/*`):** replace the 480 px letterbox column with layouts driven by window size classes. These are a landscape side-rail layout for short windows and two panes on expanded windows.
- **Verification:** a Chrome DevTools (CDP) layout check across every screen shape.

It does not change the engine. No rule, number, rng draw or serialized field moves, and `test/parity/prototype-master.js.txt` is never edited. The emulator (AVD) pass and the Pixel 7 perf-baseline refresh run at the post-97 build gate, not inside this phase.

</domain>

<decisions>
## Implementation Decisions

### Rotation and Android plumbing (Area 1, user "Accept all" 2026-10-04)
- **Phone rotation:**
  - A Settings choice "Screen: Portrait / Rotate", default Portrait on phones.
  - The manifest carries no orientation lock: drop `android:screenOrientation="portrait"` at `AndroidManifest.xml:51`.
  - On a phone (smallest width < 600dp) the runtime `ScreenOrientation.lock` in `src/browser/nativeChrome.js:239-240` honours the setting: Portrait locks, Rotate unlocks.
  - Tablets, foldables and Chromebooks always follow the device; the lock never applies there.
  - Play's large-screen notice clears because the restriction leaves the manifest.
- **`appCategory="game"`:** keep it. It is the honest category, and it no longer carries the orientation lock.
- **Activity recreation:** keep every `configChanges` entry, so rotation, fold and resize never recreate the WebView: the open sheet, tab, camera and combat stay put. A test pins the manifest (no `screenOrientation`, no `resizeableActivity="false"`, no `maxAspectRatio`, `configChanges` intact).
- **Viewport units and insets:**
  - Switch `100vh` to `100dvh`: the `#app.mw-app` height, the HUD-menu max-height, and any other `vh` sizing that must track the visible window.
  - Honour the left and right safe-area insets on the HUD, tab bar or side rail, rail card and side panels, for landscape cutouts and side navigation bars.

### Landscape play layout: phone on its side, about 360dp tall (Area 2, user "Accept all")
- **Side-rail layout:**
  - The tab bar becomes a vertical strip on one edge (the navigation-rail pattern).
  - The HUD compresses to one row across the top.
  - The maze viewport fills the rest.
  - The rail card docks in a right-hand side panel instead of covering the bottom of the map.
  - Nothing stacks under the map.
- **Combat, store, camp and the encounter panel:** a right-hand panel beside the map, about 45% of the width and scrolling, so the fight and the map are both visible.
- **Sheets and non-map tabs (Hero, Gear, Oracle, Dead, leaderboards, Settings):** a centred readable column, max about 640px, at full height. Hero and Gear flow into two columns where the content splits naturally: dossier and ability lists, worn and bag.
- **Arrow pad:** stays in its bottom corner per the `padSide` setting, at the same size. With the rail card in the side panel, the pad no longer has to hide whenever a card shows.

### Tablets, foldables and Chromebook windows (Area 3, user "Accept all")
- **Window size classes decide the layout, never the device.** Resizing a Chromebook window or folding a phone is just a re-layout. The classes, evaluated in this order:
  1. Short window (height < 480dp): the landscape side-rail layout above.
  2. Compact width (< 600dp): today's phone portrait stack.
  3. Medium width (600–839dp, e.g. a portrait tablet or an unfolded foldable): the portrait stack, widened.
  4. Expanded (≥ 840dp wide and ≥ 480dp tall): two panes.
- **The 480 px column goes.** The map fills its pane. Text-heavy panels (sheets, store, Hero, Gear) cap at a readable width of about 640px and centre in their pane. `tools/letterbox-check.mjs` becomes a layout check across the size classes.
- **Two panes on expanded windows:** the map stays visible on the left. A persistent right pane shows the rail card, the encounter or combat panel, and whichever of Hero, Gear or Oracle is chosen.
- **Map scale on big screens:** cells scale up with the window, with a cap, on top of the existing text-size scale. A tablet shows the same explored maze, larger and easier to tap. Fog still limits what is seen, so difficulty does not change.

### Verification, tooling and phase shape (Area 4, user "Accept all")
- **The deferred 80-05 emulator pass is absorbed in two parts:**
  - **In this phase:** a zero-dependency CDP layout check, adapted from `tools/letterbox-check.mjs`. It renders phone portrait and landscape, 7" and 10" tablets both ways, a foldable folded and unfolded, and a Chromebook window. It asserts no horizontal overflow and no clipped regions, and saves screenshots.
  - **At the post-97 build gate, on the debug APK:** the AVD pass. That covers pixel_7 with gesture and 3-button navigation and a cutout, pixel_tablet rotation, pixel_fold fold and unfold, and a desktop-size window. Its rows join the batched v2.4 Pixel 7 checklist.
- **No phase split.** One phase, planned in waves:
  1. The rotation foundation (Area 1).
  2. The landscape layout.
  3. Size classes and two panes.
  4. Verification.
- **No separate UI-SPEC agent** (`workflow.ui_phase=false`, usage trim). This CONTEXT carries the layout decisions plus the ASCII sketches below.
- **Snapshots and perf baseline:**
  - Shell snapshots: regenerate only the fixtures whose markup moves, each one declared. Restore anything else `MZ_SNAPSHOT_UPDATE=1` rewrites.
  - The perf baseline (`docs/PERF-BASELINE.md`, Pixel 7) is refreshed on the device at the build gate, as a checklist row.

### Layout sketches (one per size class; the planner's design contract)

Compact portrait (width < 600dp, height ≥ 480dp). This is today's stack, unchanged apart from `dvh`:
```
┌────────────────────┐
│ HUD (two bands)    │
├────────────────────┤
│                    │
│   maze viewport    │
│                    │
│             [pad]  │
├────────────────────┤
│ rail card (overlay)│
├────────────────────┤
│ MAP HERO GEAR ORA… │  tab bar
└────────────────────┘
```

Short / landscape (height < 480dp, e.g. a phone on its side):
```
┌────┬──────────────────────────────────────────────┐
│    │ HUD: one row                                 │
│ M  ├──────────────────────────┬───────────────────┤
│ H  │                          │ side panel:       │
│ G  │      maze viewport       │ rail card, or     │
│ O  │                          │ combat / store /  │
│ D  │                   [pad]  │ camp / encounter  │
│    │                          │ (~45%, scrolls)   │
└────┴──────────────────────────┴───────────────────┘
 nav rail
```
On this layout, Hero, Gear, Oracle, Dead, the leaderboards and the sheets fill the area right of the nav rail as a centred column of at most about 640px. Hero and Gear use two columns.

Medium (600–839dp wide, height ≥ 480dp, e.g. a portrait tablet or an unfolded foldable): the compact stack, widened. The map fills the width (cells scaled, capped) and text panels centre at about 640px.

Expanded (≥ 840dp wide and ≥ 480dp tall, e.g. a landscape tablet or a Chromebook window):
```
┌───────────────────────────────────────────────────┐
│ HUD                                               │
├────────────────────────────┬──────────────────────┤
│                            │ persistent pane:     │
│                            │ rail card, encounter │
│   maze viewport (scaled)   │ or combat, store,    │
│                            │ or the chosen        │
│                     [pad]  │ Hero / Gear / Oracle │
├────────────────────────────┴──────────────────────┤
│ tabs (bar or rail: planner's choice)              │
└───────────────────────────────────────────────────┘
```

### Claude's Discretion
- **Breakpoint mechanics:** CSS media queries against the window (`width`, `height`) are preferred over JS measurement. JS reads the same thresholds only where behaviour must change (the rotation lock, the pad's card-hiding rule, panel routing). Use one shared constant source, so CSS and JS agree.
- **Landscape side panel:** decide whether it reserves its width permanently or appears only while a card, fight, store, camp or encounter is up. The default leans to "only while up", matching the standing ruling that the rail shows only with a card. The map must keep the party in view across the reflow (`mzKeepPartyInView`).
- **Expanded tab chrome:** a bottom bar or a navigation rail.
- **Where Dead and the leaderboards open on expanded:** the right pane or a full-width centred column.
- **Settings key and row:** the key name for the Screen preference (`ddr.settings.v1`) and whether its row hides or reads "follows the device" on tablets.
- **Smallest-width detection:** how the phone-only rule detects smallest width (e.g. `Math.min(screen.width, screen.height) < 600` in CSS px).
- **Cell scaling:** the scale curve and its cap.
- **Pad placement:** exact pad and rail-card positions inside the side panel.
- **Layout check:** the tool's file name, profile list and the shape of its pass/fail report.

</decisions>

<code_context>
## Existing Code Insights

All file:line facts come from the 2026-10-04 scout.

### Reusable Assets
- `tools/letterbox-check.mjs`:
  - Already drives CDP `Emulation.setDeviceMetricsOverride` over phone 412x915, phone-max 480x1000, tablet 800x1280, foldable 700x840 and chromebook 1280x800 (`--shots`).
  - It hard-codes 480/481, so it is the base for the size-class layout check.
  - `tools/roller-repro.mjs` shows the working CDP pattern. `tools/shell-boot-check.mjs`'s raw `--headless=new --dump-dom` is environment-blocked on this machine (STATE, Phase 50), so do not build on that path.
- **Settings plumbing** (`src/browser/settings.js`):
  - `SETTINGS_STORAGE_KEY="ddr.settings.v1"` `:83`, `SETTINGS_DEFAULTS` `:110-124`, `ALLOWED_VALUES` `:136-149`, `readSettings` `:202`, `writeSetting` `:257` (unknown keys are rejected; old blobs get defaults).
  - The sheet rows live in `#mw-settings-rows` `mazeworld.html:2285`, each a `<div class="mw-settings-options" data-setting="KEY">` with `.mw-settings-opt[data-value]` options (e.g. `alwaysRules` `:2376-2383`, `textSize` `:2291`, `movement` `:2305`, `padSide` `:2312`).
  - The click handler at `:8587-8620` runs writeSetting → applySettings → renderSettingsSheet `:8060`, then the per-key side effects; `applySettings` is at about `:7966`.
  - A new preference needs a default, an ALLOWED_VALUES entry, a markup row, a side effect and an applySettings read.
- **Persistence already survives a relaunch:**
  - `src/browser/engineAdapter.js:886-889` `persist()` writes SAVE_KEY on every dispatch.
  - `src/browser/storage.js` sits over Preferences; `nativeChrome.js:318-328` flushes on pause.
  - `engine/saveState.js` `sanitizeCombat` `:310`, `sanitizeStore` `:348` and `resumedSubState` `:444` restore a live fight or open store (`fightResumed`/`storeResumed`).
  - The open sheet, active tab and camera live only in the DOM and module vars, which is fine while `configChanges` prevents recreation.
- `src/browser/controls.js#screenToCell` uses the viewport rect, so taps need no change when cells scale.

### Established Patterns
- **Manifest and locks:**
  - `android/app/src/main/AndroidManifest.xml` `.MainActivity` `:46-53`: `screenOrientation="portrait"` `:51`, `appCategory="game"` `:18` (Phase 80 DROID-03).
  - `configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode|navigation|density"`, `launchMode=singleTask`.
  - No `resizeableActivity`, `maxAspectRatio` or `<layout>`.
  - `capacitor.config.json` has SplashScreen and `SystemBars` (`insetsHandling: css`, `style: DARK`).
  - Plugins (`package.json:19-25`): android, app, core, haptics, preferences, screen-orientation, splash-screen (^8).
- **Insets:** `SystemBars` css insets feed the `--safe-area-inset-*` variables with `env()` fallbacks (HUD top `mazeworld.html:1277`, tab bar bottom `:1634-1639`). Only the arrow pad uses left/right today (`:537-538`).
- **Letterbox CSS:**
  - `<style id="mw-letterbox">` at about `mazeworld.html:2140`.
  - Its rule at `:2169` is `@media (min-width:481px){ :root{background:#080705} html>body{max-width:480px;margin:0 auto;contain:layout;box-shadow:...} }`.
  - `contain:layout` makes `body` the containing block for `position:fixed; inset:0` overlays. Removing it changes what fixed overlays size against.
- **Dead desk-layout CSS** to clear or reuse: `@media` at `:205` (max-width 1080), `:1188`, `:1200` (700) and `:1204`; `.desk{grid-template-columns:262px ... 336px}` at `:199`. There is no orientation query and no phone min-width breakpoint today.
- **Heights:**
  - `html,body{height:100%}` `:1239`.
  - `#app.mw-app{display:flex;flex-direction:column;height:100vh}` `:1247`.
  - `.mw-maze-viewport{position:relative;width:100%;flex:1;min-height:220px;overflow:hidden}` `:433`. `min-height:220px` is tight in landscape (about 360dp minus the HUD and the 56px+ tab bar).
  - `.mw-hud-menu` max-height `calc(100vh - 180px - insets)` `:1383`.
  - `.log` max-height `min(44vh,440px)` `:1140`.
- **Resize:**
  - The only listener is `addEventListener("resize", () => { fit(); window.mzKeepPartyInView?.(); renderEncounter(); })` at `mazeworld.html:7148`.
  - `fit()` `:3199` sizes the canvas from `CELL*GW`, the text size and dpr: a fixed grid size, not the viewport size. Cell scaling with the window starts here.
  - A `ResizeObserver` watches only the rail, to resync the pad (`:8050-8052`).
  - No `orientationchange` or `visualViewport` listener exists.
- **Arrow pad:**
  - Hidden while a rail card is up (`data-rail-up`), during encounters, when dead, or while a sheet is open (`syncArrowPad` `:8000+`, `src/browser/arrowPad.js#arrowPadModel`).
  - Positioned `position:absolute; bottom:12px`, left/right 12px plus the inset by `data-side` (`:535-546`). The 3×48px pad covers about 150px.
- **Movement:** defaults to `movement:"arrows"` for new installs (`settings.js:62-71, 154`); tap-to-move stays the other mode, and both must work in every layout.

### Integration Points
- **Regions:**
  - `#app` `:2526`; HUD `<header id="mw-hud">` `:2536` (band 2 counters `:2551`); HUD menu `#mw-hud-menu` `:2580` (Settings `#mw-gear-btn`).
  - `<main id="mw-screens">` `:2633`, holding `#screen-maze` `:2638`, `#screen-hero` `:2736`, `#screen-gear` `:2832`, `#screen-oracle` `:2858` and `#screen-dead` `:2871`.
  - Maze viewport `#mw-maze-viewport` `:2656`; arrow pad `#mw-arrow-pad` `:2694`.
  - Rail `#mw-rail` `:2888` (CSS `:1013`: absolute, left/right/bottom 0, full width).
  - Tab bar `#mw-tabbar` `:2906` (CSS `:1634`; MAP/HERO/GEAR/ORACLE/DEAD, ≥ 56px tall).
  - Sheets `.mw-legend-sheet` (e.g. `#mw-settings-sheet` `:2278`; MARKS, Account, Camp, Gear, Fight-so-far); leaderboards `.mw-lb-*` at about `:1464`.
- **Tests that pin today's lock and letterbox.** These are rewritten, and each change is declared:
  - `test/unit/android-large-screen.test.js` (DROID-03): the manifest keeps the portrait lock; nativeChrome locks portrait; exactly one `mw-letterbox` block with column rules; no other block sets a body max-width.
  - `test/unit/android-system-bars.test.js` (DROID-02): `viewport-fit=cover`, the `--safe-area-inset-top/bottom` variables and no bar-colour call. These stay, and extend to left/right.
- **Other shell tests that may move:**
  - `test/unit/shell-tab-snapshots.test.js` with `test/unit/fixtures/shell-snapshots/`. These are DOM-only with no CSS or viewport, so new CSS does not move them but new markup does.
  - `shell-arrow-pad`, `shell-map-viewport`, `shell-map-hud` and `settings-volume-shell`.
- **Docs:**
  - `docs/ANDROID-DISPLAY.md`'s "Large screens (DROID-03)" section, which describes the 480 column and the orientation lock, is rewritten.
  - `docs/PERF-BASELINE.md` gets its refresh row at the build gate.

</code_context>

<specifics>
## Specific Ideas

- **Standing UI rulings apply in every layout:**
  - The rail is the one feedback surface on every tab and is shown only with a card.
  - Card vs toast: decisions and big updates get a card; minor events are toast-only, linger, and dismiss on tap.
  - The Joiner shows only in YOUR LOT and Hero Company.
  - Account rows live in the ☰ dropdown, with no separate HUD chip.
  - The gear chip sits right of MAKE CAMP.
  - HP, not WP.
- **Both movement modes work everywhere:** arrows is the default, and tap-to-move is the other mode.
- **"A stretched phone column" is the failure ROADMAP criterion 4 names.** The expanded layout must show the map and a pane side by side, not a centred 480 or 640 column with gutters.
- **Order of the milestone (user ruling 2026-10-03):** after 97, the build gate runs before Phase 98 screenshots:
  1. Debug APK on the Pixel 7, the batched v2.4 checklist and the AVD rows.
  2. 2.4.0 patch notes agreed with the user.
  3. The signed AAB (vc14) for the user to upload.

</specifics>

<deferred>
## Deferred Ideas

- **The AVD emulator pass (80-05 profiles):** runs at the post-97 build gate on the debug APK, and its rows join the v2.4 device checklist.
- **The Pixel 7 perf-baseline refresh:** build gate, checklist row.
- **New store screenshots (phone, 7" and 10" tablet):** Phase 98, after the build gate.
- **Achievements:** backlog 999.12, its own milestone. Not in scope.

</deferred>
