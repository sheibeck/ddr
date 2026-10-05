---
phase: 97-large-screen-support
plan: 02
subsystem: ui
tags: [layout, breakpoints, canvas, settings, large-screen]
requires: []
provides:
  - src/browser/layoutClass.js (size classes, media strings, side/readable widths)
  - cellScaleForWindow / cellPxFor in src/browser/canvasSizing.js
  - settings key `screen` ("portrait" | "rotate")
affects: [97-03, 97-04, 97-05, 97-06]
tech-stack:
  added: []
  patterns: [pure node-importable modules, one constant source shared by CSS and JS]
key-files:
  created:
    - src/browser/layoutClass.js
    - test/unit/layout-class.test.js
  modified:
    - src/browser/canvasSizing.js
    - test/unit/canvasSizing.test.js
    - src/browser/settings.js
    - test/unit/settings.test.js
    - test/unit/shell-gear-toolbar.test.js
key-decisions:
  - "479.98/599.98/839.98 max-* thresholds so fractional CSS px never falls between classes"
  - "Cell scale follows the shorter side: 1 + (shorter - 412) / 800, capped 1.5, cell capped 144"
  - "screen setting appended as the fourteenth field, default portrait"
requirements-completed: [SCREEN-02, SCREEN-03, SCREEN-04]
status: complete
duration: ~20 min
completed: 2026-10-04
---

# Phase 97 Plan 02: Size classes, cell scale and the Screen preference Summary

Pure, pinned modules for the large-screen layout: four size classes with one shared set of media strings, a capped map-cell scale that leaves every phone byte-for-byte unchanged, and the `screen` Portrait/Rotate preference.

## What was built

- `src/browser/layoutClass.js` (new): `LAYOUT_BREAKPOINTS`, `LAYOUT_MEDIA` (short, compact, medium, expanded, side), `LAYOUT_SIDE_WIDTH` (short "45%", expanded "clamp(360px, 40%, 560px)"), `LAYOUT_READABLE_MAX_PX` 640, `layoutClassFor`, `currentLayoutClass`, `railBesideMap`, `mapStaysUp`. No imports, no DOM.
- `src/browser/canvasSizing.js`: `WINDOW_CELL_BASE_PX` 412, `WINDOW_CELL_SLOPE_PX` 800, `WINDOW_CELL_SCALE_MAX` 1.5, `CELL_MAX_PX` 144, `cellScaleForWindow(w, h)`, `cellPxFor(baseCell, zoom, windowScale)`. `computeCanvasBacking` and `cellSizeForTextScale` untouched.
- `src/browser/settings.js`: `screen` ("portrait" | "rotate", default "portrait") appended after `alwaysRules`; header, JSDoc and field counts updated to fourteen.

## Commits

- e6ee8e2f feat(97-02): add screen size classes (layoutClass.js)
- a9325c2c feat(97-02): add screen cell scale with a 144 px cap
- a6f5c760 feat(97-02): add the screen preference (Portrait / Rotate) to settings

## Tests run (targeted only)

- `node --test test/unit/layout-class.test.js`: 9 pass, 0 fail
- `node --test test/unit/canvasSizing.test.js`: 13 pass, 0 fail (pre-existing tests unedited)
- `node --test test/unit/settings.test.js test/unit/shell-gear-toolbar.test.js test/unit/sfx-settings.test.js test/unit/retire-sweep.test.js`: 84 pass, 0 fail
- The three `node -e` acceptance one-liners print ok.
- `git diff a5fbd87f -- engine test/parity test/determinism` prints nothing.
- Declared re-pins (each carries a "Phase 97 (SCREEN-02): declared re-pin" comment): settings.test.js (defaults title and assertion, round-trip deepEqual, ordered key list, length 14) and shell-gear-toolbar.test.js (ordered key list, title 14 fields). No fixtures regenerated.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Plan inconsistency] 0.02 px sliver excluded from the agreement grid test**
- **Found during:** Task 1
- **Issue:** The plan pins `layoutClassFor(900, 479.99)` expanded and `(599.99, 900)` medium, and also asks the media strings to agree with the function at every boundary value. The media strings (`min-height: 480px`, `min-width: 600px`) cannot match inside the 0.02 px sliver under each whole-number threshold (479.98 < h < 480, 599.98 < w < 600, 839.98 < w < 840), so a matcher falls through to compact there.
- **Fix:** Kept the function exactly as specified (the explicit behavior bullets win) and the media strings byte-exact. The agreement test skips only the sliver values, and the header comment documents it. No real screen reports a size in that band; CSS default (compact) applies there.
- **Files modified:** test/unit/layout-class.test.js, src/browser/layoutClass.js (header comment)
- **Commit:** e6ee8e2f

**2. [Rule 3 - Source pin] No lowercase "window" or "document" in comments**
- canvasSizing.test.js and layout-class.test.js pin `\bwindow\b` absent from source text, so the comments say "screen" and "shell's layout global" instead of the plan's "window.__mzLayout" wording. Identifiers `cellScaleForWindow` / `windowScale` are unaffected.

Otherwise: plan executed as written.

## Known Stubs

None.

## Threat Flags

None. No network, auth, storage-key or schema surface added; `screen` lives in the existing `ddr.settings.v1` blob.

## Deferred human verification

- 10" tablet and Chromebook window: the map's squares read larger than on the Pixel 7 and are easy to tap; pinching still zooms. (Not wirable until 97-03 calls `cellPxFor` from `fit()`.)

## Self-Check: PASSED

All created files exist, all three commits are in `git log`, engine/parity/determinism diff is empty.
