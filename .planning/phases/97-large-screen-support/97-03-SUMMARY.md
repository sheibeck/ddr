---
phase: 97-large-screen-support
plan: 03
subsystem: ui-shell
tags: [layout, settings, orientation, dvh, safe-area, resize-observer, large-screen]
requires: [97-01, 97-02]
provides:
  - Settings Screen row (#mw-screen-row, data-setting="screen"), phone only
  - smallestScreenWidth(), isPhoneDevice(), syncLayout() in the module script
  - window.__mzLayout { current(), railBeside(), mapStaysUp() } and html[data-mw-layout]
  - "<style id=\"mw-layout\"> (BEGIN/END markers) replacing the Phase 80 letterbox"
  - window.__mzCanvasSizing carries cellScaleForWindow and cellPxFor
affects: [97-04, 97-05, 97-06]
tech-stack:
  added: []
  patterns: [one media-query source shared by CSS and JS, dvh as an @supports upgrade over vh fallbacks, ResizeObserver instead of a second resize listener]
key-files:
  created:
    - test/unit/layout-shell.test.js
  modified:
    - mazeworld.html
    - src/browser/bridge.js
    - docs/SHELL-MODULES.md
    - test/unit/android-system-bars.test.js
    - test/unit/shell-map-viewport.test.js
    - test/unit/shell-map-store-polish.test.js
    - tools/lib/voice-corpus.mjs
requirements-completed: [SCREEN-02, SCREEN-04, SCREEN-05, SCREEN-06]
status: complete
completed: 2026-10-04
---

# Phase 97 Plan 03: Shell half of the rotation foundation Summary

The phone Screen choice reaches the player, the 480 px letterbox is gone in favour of one `mw-layout` style block (dvh, side insets, one media source), the shell tracks its size class, the map keeps the party in view across any reflow, and tablets get larger cells.

## What was built

- **Task 1, Screen row:** `#mw-screen-row` (hidden until `renderSettingsSheet` decides the device is a phone; `isPhoneDevice()` compares the smaller of `screen.width`/`screen.height` to `PHONE_SMALLEST_WIDTH_LIMIT`). A `screen` write calls `syncOrientationLock()` at once. `registerNativeChrome` now receives `getScreenPref` and `getSmallestWidth`; the waitForPending/onBackground/onForeground lines are untouched.
- **Task 2, mw-layout block:** the letterbox element is replaced by `<style id="mw-layout">` as the last `<style>` in `<head>`. It holds an `@supports (height: 100dvh)` group with the six dvh twins (app, HUD menu, legend panel, Oracle log, find shelf, report text), the left/right safe-area inset rules (HUD bands, condition strip, tab bar, `#mw-stage`, `#mw-rail`, sheet panels, title body and account chip, roller), and the compact-query stacked dossier notes. Every rule inside is indented two spaces.
- **Task 3, watcher:** `syncLayout()` writes `html[data-mw-layout]`, pokes `mzSyncArrowPad` on a class change and always calls `syncOrientationLock()` last; `matchMedia` change listeners on LAYOUT_MEDIA short/medium/expanded plus a ResizeObserver on `document.documentElement`. A second ResizeObserver on `#mw-maze-viewport` calls `mzKeepPartyInView`. `fit()` sizes cells with `cellPxFor(baseCell, zoom, cellScaleForWindow(innerWidth, innerHeight))`, with the old math as the fallback. The classic `addEventListener("resize", ...)` line is byte-identical and still the only resize listener. Bridge registry entry `__mzLayout` added and the SHELL-MODULES table regenerated.

## Removed from mazeworld.html (listed here, not in comments)

The `mw-letterbox` block (min-width 481 query, body max-width 480, contain:layout on body, `:root` gutter background); the dead desk grid (`.desk`, `.col-sheet`, `.col-maze`, `.col-doss`, `.col-right`) with its max-width 1080 query; the redundant `.dossier` 1080 query; the `.vitals` rule with its 1080 block and the `.v-*` bar rules (no element used them); the max-width 700 dossier query (moved under the compact LAYOUT_MEDIA string).

## Commits

- 3c3a00df feat(97-03): Screen setting row and live orientation wiring
- 22392761 feat(97-03): replace the letterbox with the mw-layout block (dvh, side insets, one media source)
- 63e9b35a feat(97-03): layout watcher, keep-in-view across reflow, window-scaled cells
- a79e6ee8 fix(97-03): register layoutClass.js CSS exports as non-copy in the voice corpus

## Tests run (targeted only)

- Task 1 set (layout-shell, settings-volume-shell, dressing-shell, shell-arrow-pad, title-music-shell, shell-board, account-layout): 112 pass, 0 fail.
- Task 2 set (layout-shell, android-system-bars, rail-overlay, hud-menu-layout, hud-bands-layout, text-scale, report-sheet-shell, shell-arrow-pad, shell-tab-snapshots): 132 pass, 0 fail; plus leaderboard-css, party-sprite-shell, reduced-motion, round-summary-band, shell-board, shell-map-hud, shell-stairs-fade: 138 pass, 0 fail.
- Task 3 set (layout-shell, bridge-registry, shell-map-viewport, shell-arrow-pad, dead-lockdown, shell-input-guards, canvasSizing, shell-tab-snapshots, rail-overlay, hud-menu-layout, android-system-bars, shell-map-hud, shell-board, title-music-shell): 270 pass, 0 fail.
- Wider sweeps of every test reading mazeworld.html: `test/unit/shell-*.test.js` 673 tests (one failure fixed, see deviation 1, re-run `shell-map-store-polish` 15 pass); the other 86 files that read mazeworld.html 1584 tests, 2 failures from 97-02 (fixed, deviation 2; `voice-corpus.test.js` 29 pass).
- `node tools/bridge-doc.mjs --check` exits 0. `git diff a5fbd87f -- engine test/parity test/determinism` is empty. `git status --short test/unit/fixtures` is empty (no fixture moved). No full suite, bots, sims or Android build were run.

## Deviations from Plan

**1. [Rule 3 - Blocking pin] mzKeepPartyInView call-site count 12 -> 13**
- **Found during:** Task 3 (a `shell-*` sweep, then Task 3's own verify set).
- **Issue:** the plan's map-viewport ResizeObserver adds one `window.mzKeepPartyInView?.()` literal; two source pins count the literal.
- **Fix:** re-pinned in `shell-map-viewport.test.js` (f) and `shell-map-store-polish.test.js` with "Phase 97 (SCREEN-05): declared re-pin" comments.

**2. [Rule 3 - Wave 1 miss] voice-corpus completeness guard**
- **Found during:** a sweep of all tests that read mazeworld.html.
- **Issue:** 97-02's `LAYOUT_MEDIA` and `LAYOUT_SIDE_WIDTH` exports (CSS strings) are copy-like to the corpus completeness guard, so `test/unit/voice-corpus.test.js` failed (2 tests) since 97-02.
- **Fix:** two `nonCopy` entries with reasons in `tools/lib/voice-corpus.mjs` (the file's header says "not edited after 79-01", but later phases already add entries the same way). No corpus output changed.

**3. [Rule 2 - small addition] fight-log sheet panel side insets**
- `#mw-fightlog-sheet .mw-legend-panel` overrides the legend panel's padding with higher specificity (padding:0 0 ...), so the generic panel inset rule would not reach it; one extra indented rule applies only the left/right insets there.

**4. Test-side choices:** the (g) media-query pin and the CSS pins run on comment-stripped CSS (a base comment says "@media override"). The (h) vh pin asserts the exact multiset of the six base fallbacks. An extra test (i2) pins that every rule inside mw-layout is indented.

Otherwise the plan was executed as written; `android-system-bars.test.js` carries the declared SCREEN-06 extension comment.

## Known Stubs

None. (The `mzSyncArrowPad` call on a class change is a no-op until 97-04 makes the pad read the class; documented in the code comment.)

## Notes for 97-04 / 97-05

- Add side-layout and short rules inside `<style id="mw-layout">`, indented two spaces, using only the exact LAYOUT_MEDIA strings (`@media` with another string fails layout-shell test (g)).
- Body has no `contain:layout` any more: fixed overlays (title, roller, sheets, HUD menu scrim) size against the window, and big windows now show them full width until 97-04/97-05 cap and centre their panels.
- `window.__mzLayout.current()` is already "compact" wherever matchMedia is absent (the shell sandbox).
- Adding any new `window.mzKeepPartyInView?.()` literal means re-pinning the count (now 13) in `shell-map-viewport.test.js` and `shell-map-store-polish.test.js`.
- The map-viewport ResizeObserver already re-centres on any map box change, so a side panel opening needs no extra call.

## Deferred human verification

- Pixel 7, landscape with the camera cutout on the left, then on the right: the HUD text, the tab rail and the map clear the cutout; gesture and 3-button navigation both.
- Settings on a 10" tablet emulator: no Screen row. On the Pixel 7: the row shows, and flipping it takes effect without a restart.
- 10" tablet or Chromebook window: the map's squares read larger than on the Pixel 7, and pinch zoom still works.

## Self-Check: PASSED

layout-shell.test.js exists; commits 3c3a00df, 22392761, 63e9b35a, a79e6ee8 are in `git log`; engine/parity/determinism diff and fixture status are empty.
