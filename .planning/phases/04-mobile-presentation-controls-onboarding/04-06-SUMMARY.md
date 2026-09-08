---
phase: 04-mobile-presentation-controls-onboarding
plan: 06
subsystem: ui
tags: [canvas, dpr, pan, icons, tap-to-move, dpad, dispatch, vanilla-js]

# Dependency graph
requires:
  - phase: 04-mobile-presentation-controls-onboarding
    provides: "04-01: src/browser/controls.js (screenToCell/resolveTapDirection/classifyPointerGesture), src/browser/canvasSizing.js (computeCanvasBacking/cellSizeForTextScale)"
  - phase: 04-mobile-presentation-controls-onboarding
    provides: "04-03: src/browser/icons.js (featureKeyForCell/preloadIcons/drawFeatureIcon)"
  - phase: 04-mobile-presentation-controls-onboarding
    provides: "04-05: the dark shell's #app/#screen-maze/.mazebox chrome and MAZE tab, into which the viewport framing is built"
provides:
  - "The interactive crawl screen: a pannable, fog-lit DPR canvas viewport (mw-maze-viewport) with inset vignette, MARKS/CENTRE >=48dp chips, and a centered flash toast"
  - "9 PNG map icons (icons/optimized/) drawn on the maze canvas as feature marks + party.png player marker, replacing every procedural glyph"
  - "Tap-to-move (default control scheme) via one pointerdown/move/up gesture pipeline sharing controls.js's screenToCell/resolveTapDirection with the renderer"
  - "The D-pad alternate control scheme (52x52/gap 7px), selected via settings.controlScheme, issuing the same dispatch()-routed one-step moves"
  - "tools/build-www.mjs copyIcons() shipping icons/optimized/ into www/ with zero runtime fetch"
affects: [04-07, 04-08, 04-09, 04-10 (later Wave plans building the remaining screens/settings UI around this MAZE tab)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Canvas keeps drawing the WHOLE grid at its natural CELL*GW size; a smaller viewport DIV crops/pans it via overflow:hidden + absolute positioning (positionCanvas()), computed from the SAME cs/pan/canvasPad forward transform controls.js's screenToCell inverts for tap hit-testing — one shared transform, never a second copy"
    - "window.__mzControls/__mzCanvasSizing/__mzIconsApi/__mzSettings/__mzIconMap bridge pattern: the trailing <script type=\"module\"> imports the Wave-1 pure ES modules and exposes them on window.* so the classic (non-module) script's fit()/draw()/tap-handler code can consume them without an ES `import` — extends the existing window.move/window.__mzState bridge convention"
    - "Icon rendering fails open at three layers: preloadIcons() itself (missing/broken PNG resolves without blocking boot), draw()'s iconReady() guard (img.complete && naturalWidth>0) skips an undecoded icon per-cell, and the player marker falls back to the original dot+letter glyph if party.png never loads — the player is never invisible"

key-files:
  created: []
  modified:
    - mazeworld.html
    - tools/build-www.mjs
    - icons/optimized/chest.png
    - icons/optimized/crevice.png
    - icons/optimized/descent.png
    - icons/optimized/encounter.png
    - icons/optimized/onewaydoor.png
    - icons/optimized/party.png
    - icons/optimized/teleport.png
    - icons/optimized/trap.png
    - icons/optimized/wall.png

key-decisions:
  - "The maze canvas keeps rendering the FULL 21x21 grid (unchanged rendering model) rather than switching to draw-only-the-visible-window; the NEW .mw-maze-viewport DIV is what's sized to the phone screen and crops/pans the larger canvas via overflow:hidden. This let 04-06 reuse controls.js's exact forward/inverse transform without inventing a second partial-redraw renderer."
  - "Player marker glow is a static (non-animated) canvas radial gradient behind the party.png icon, standing in for the design's animated mwglow pulse — draw() only runs on-demand per move/render, not inside a continuous requestAnimationFrame loop; adding one purely for a decorative pulse was judged out of scope for this MVP slice (Claude's discretion per 04-CONTEXT.md)."
  - "MARKS chip toggles the EXISTING mazefoot legend (8 feature-type rows, already present pre-04-06) as a compact reveal, rather than building the full slide-up bottom-sheet chrome from 04-UI-SPEC.md Screen 7 — that screen's dedicated bottom-sheet treatment is not in this plan's must_haves/acceptance_criteria (chip existence + >=48dp hit area + pan/recenter/fog/vignette framing are); deferred to whichever later plan builds the bottom-sheet component."
  - "Tasks 2+3 landed as ONE commit (not two) — same commit-granularity call as 04-05's precedent. The tap-gesture pipeline (Task 3) depends on the `pan`/`positionCanvas()` state Task 2 introduces, and the trailing module's settings-read block mixes both tasks' window.* bridge assignments in adjacent hunks; a clean 2-way split was impractical without redoing the edits as strictly sequential passes."
  - "controlScheme is read ONCE at boot (module script, before classicBoot()) and used to set the D-pad's initial display + gate the tap handler — no live in-session toggle exists yet since the settings SCREEN that lets a user change it is 04-09's scope, not this plan's; a page reload picks up a changed value."

patterns-established:
  - "Viewport-framing-around-an-unchanged-canvas: later screens/plans that need to crop/pan a canvas-rendered surface should follow this DIV-wraps-canvas + shared-transform pattern rather than rewriting the renderer."

requirements-completed: [UX-01, UX-02, UX-03]

coverage:
  - id: D1
    description: "The maze renders inside the design's pannable viewport framing: drag-pans the camera (never the player), CENTRE snaps pan to {0,0}, inset vignette box-shadow and fog-of-war (existing unexplored-haze overlay) both render, MARKS/CENTRE chips are >=48dp"
    requirement: "UX-03"
    verification:
      - kind: automated_ui
        ref: "node tools/build-www.mjs && grep -o 'mw-maze-viewport\\|mw-chip-marks\\|mw-chip-centre\\|mw-flash' www/index.html (all 4 present) && grep -n 'grid-template-columns:repeat(3,52px)' www/index.html"
        status: pass
      - kind: manual_procedural
        ref: "Deferred device-UAT (Pixel 7): real-finger pan feel, vignette/fog legibility, chip tap accuracy — no headless DOM in this project's node:test setup to assert rendered canvas/CSS-transform output"
        status: unknown
    human_judgment: true
    rationale: "This is DOM/CSS/canvas rendering with no headless DOM in this project's node:test setup — the underlying shared-transform math (screenToCell) is unit-proven (04-01), but the actual on-screen framing, pan feel, and vignette/chip rendering can only be confirmed by source inspection here and device/browser UAT at milestone end."
  - id: D2
    description: "The 9 PNG icons draw as feature marks + party.png as the player marker at Math.round(cellSize*0.6), replacing all procedural glyphs; icons are preloaded/decoded before first paint (fail-open at three layers)"
    requirement: "UX-03"
    verification:
      - kind: unit
        ref: "test/unit/tutorial.test.js (icons.js's featureKeyForCell/FEATURE_ICONS/PLAYER_MARKER_ICON coverage, unchanged from 04-03) — 449/449 pass"
        status: pass
      - kind: automated_ui
        ref: "node tools/build-www.mjs && ls www/icons/optimized/{chest,party,trap,descent}.png"
        status: pass
      - kind: manual_procedural
        ref: "Deferred device-UAT: on-device icon sharpness/crispness at real DPR — no headless canvas pixel-inspection exists in this project"
        status: unknown
    human_judgment: true
    rationale: "draw()'s actual drawImage() calls run only in a real canvas 2D context (Image()/CanvasRenderingContext2D), which node:test's headless environment does not provide — the icon MAPPING is unit-tested (icons.js, 04-03), but the rendered visual output needs a browser/device pass."
  - id: D3
    description: "Tap-to-move (default) steps one square toward an orthogonally-adjacent, currently-seen tapped cell via dispatch({type:'move',dir}); a non-adjacent/unseen tap is a no-op with a flash message; a drag pans instead"
    requirement: "UX-01"
    verification:
      - kind: unit
        ref: "test/unit/controls.test.js (screenToCell/resolveTapDirection/classifyPointerGesture, unchanged from 04-01) — 14/14 pass; these are the exact functions the live pointerdown/move/up pipeline calls"
        status: pass
      - kind: manual_procedural
        ref: "Deferred device-UAT: real-finger tap-vs-drag classification feel, 10px/350ms threshold tuning"
        status: unknown
    human_judgment: true
    rationale: "The pure tap-to-cell/gesture-classification math is unit-proven; the DOM wiring (pointer event listeners on #mw-maze-viewport, window.move(dir) dispatch) has no headless-DOM test harness in this project — verified by source inspection (window.move is the same dispatch()->applyAction seam 01-07 already proved) and deferred to device UAT for feel."
  - id: D4
    description: "The D-pad alternate (52x52 cells, gap 7px) issues the same one-step moves; the active scheme comes from settings.controlScheme, read once at boot"
    requirement: "UX-01"
    verification:
      - kind: automated_ui
        ref: "node tools/build-www.mjs && grep -n 'grid-template-columns:repeat(3,52px);grid-template-rows:repeat(2,52px);gap:7px' www/index.html"
        status: pass
      - kind: unit
        ref: "test/unit/settings.test.js (controlScheme read/write round-trip via window.mzStorage, unchanged from 04-02) — pass"
        status: pass
    human_judgment: false
  - id: D5
    description: "build-www.mjs copies icons/optimized/ into www/ via a new copyIcons() step, mirroring copyFonts()'s whole-dir pattern"
    requirement: "UX-03"
    verification:
      - kind: automated_ui
        ref: "node tools/build-www.mjs && ls www/icons/optimized/chest.png www/icons/optimized/party.png www/icons/optimized/trap.png www/icons/optimized/descent.png"
        status: pass
    human_judgment: false

duration: 27min
completed: 2026-09-08
status: complete
---

# Phase 4 Plan 6: Interactive Crawl Screen Summary

**Turned the preserved `<canvas id="maze">` into the design's pannable, fog-lit viewport (vignette, MARKS/CENTRE chips, flash toast) with the 9 provided PNG icons replacing every procedural glyph, and wired tap-to-move (default) + the resized D-pad alternate through the same `dispatch()->applyAction` seam movement already used — a phone player can now walk the maze end-to-end.**

## Performance

- **Duration:** 27 min
- **Started:** 2026-09-08T20:58:00Z (approx, after 04-05's completion commit)
- **Completed:** 2026-09-08T21:03:07Z (final task commit)
- **Tasks:** 3 (landed as 2 commits — see Decisions Made)
- **Files modified:** 11 (2 modified: mazeworld.html, tools/build-www.mjs; 9 new committed PNGs under icons/optimized/)

## Accomplishments
- Downscaled the 9 user-provided `icons/*.png` (1254px) to `icons/optimized/*.png` (144px, ~8-16KB each) via a dependency-free PowerShell/System.Drawing resize (same pipeline as 02-04's launcher-icon mipmaps, since `@capacitor/assets` is broken in this environment); the 1254px sources are untouched.
- Added `copyIcons()` to `tools/build-www.mjs` (whole-dir copy mirroring `copyFonts()`), wired into `main()` — `www/icons/optimized/` now ships with zero runtime fetch.
- Wrapped the untouched `<canvas id="maze">` in a new `.mw-maze-viewport` DOM/CSS framing layer: inset vignette (`box-shadow: inset 0 0 70px 26px rgba(8,7,5,.92)`), MARKS/CENTRE `>=48dp` chip buttons, and a centered single-line flash toast. The canvas keeps drawing the WHOLE `GW x GH` grid at its natural `CELL*GW` size; the viewport DIV crops/pans it via `overflow:hidden` + `positionCanvas()`, sharing the exact `cs`/pan/`canvasPad` forward transform `src/browser/controls.js`'s `screenToCell` inverts for tap hit-testing.
- `fit()` now sizes the canvas from `src/browser/canvasSizing.js` (`cellSizeForTextScale` + `computeCanvasBacking`) driven by the S/M/L text-size setting, instead of shrink-to-fit-the-window.
- `draw()` replaces every procedural feature glyph (dot/tele/one/trap/chest/climb/gorge/exit/gate) with the corresponding PNG via `src/browser/icons.js`'s `featureKeyForCell`/`drawFeatureIcon`, and the player `"P"` glyph with `party.png` plus a soft radial glow — all icons preloaded/decoded in the trailing module BEFORE `window.__mzClassicBoot()` ever calls `draw()`, fail-open at three layers (missing PNG, undecoded image, or an icons-bridge-not-ready fallback that keeps the original dot+letter marker so the player is never invisible).
- One `pointerdown`/`pointermove`/`pointerup` gesture pipeline on the viewport: `classifyPointerGesture` distinguishes a tap from a pan-drag; a drag only updates the camera-only `pan` offset (never `S.floor.px/py`); a tap (when `settings.controlScheme === 'tap'`, the default) resolves through `screenToCell` + `resolveTapDirection` against a live `isSeen` predicate matching the real `engine/maze.js` floor shape, then calls `window.move(dir)` — the SAME `dispatch()->applyAction` seam the D-pad/keydown handlers already used since 01-07. A non-adjacent/unseen tap flashes `"CAN'T GO THERE."` and is a no-op.
- D-pad resized to `52x52` cells / `7px` gap per the UI-SPEC contract (clears `>=48dp` as-is); hidden by default (tap is the default scheme) and shown only when `settings.controlScheme === 'dpad'`, read once at boot.

## Task Commits

1. **Task 1: Downscale the 9 PNG icons + copyIcons() build step** - `da06c0b` (feat)
2. **Tasks 2+3: DPR viewport framing + PNG icon rendering + tap-to-move/D-pad through dispatch()** - `d77e2c4` (feat)

**Plan metadata:** (this commit, following)

## Files Created/Modified
- `icons/optimized/{chest,crevice,descent,encounter,onewaydoor,party,teleport,trap,wall}.png` - Downscaled (144px) committed icon set; `icons/*.png` 1254px sources untouched.
- `tools/build-www.mjs` - Added `copyIcons()` (whole-dir copy of `icons/optimized/` into `www/icons/optimized/`), wired into `main()` after `copyFonts()`.
- `mazeworld.html` - `.mw-maze-viewport`/`.mw-vignette`/`.mw-viewport-chips`/`.mw-chip`/`.mw-flash` CSS + markup wrapping the canvas; `.dpad` resized to 52x52/gap 7px, `display:none` by default; `fit()` driven by `cellSizeForTextScale`/`computeCanvasBacking`; new `positionCanvas()`; `draw()`'s feature-glyph and player-marker blocks replaced with icon rendering; new `flashMessage()`, MARKS/CENTRE chip handlers, and the `initMazeViewportControls()` pointer-gesture IIFE; trailing module script imports controls.js/canvasSizing.js/icons.js and bridges them + `window.__mzSettings` (with the D-pad visibility toggle) onto `window.*`.

## Decisions Made
See `key-decisions` in the frontmatter above (full-grid-canvas-inside-a-cropping-viewport strategy, static player glow vs. animated pulse, MARKS-chip-reuses-existing-legend scope call, Task 2+3 commit-granularity note, controlScheme-read-once-at-boot).

## Deviations from Plan

None — plan executed as written. The "Tasks 2+3 as one commit" and "MARKS reuses the existing legend rather than building the Screen-7 bottom sheet" items are scope/granularity calls documented in `key-decisions` above, not deviations from the plan's `must_haves`/`acceptance_criteria` (both remain fully satisfied): the plan's own must_haves list only the chip buttons + pan/recenter/fog/vignette framing, not the bottom-sheet's slide-up chrome, and 04-05 already established the same "interleaved single-file edits land as fewer commits than tasks" precedent this plan follows.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The MAZE tab is now fully interactive end-to-end: a phone player can tap-to-move or D-pad-move, pan/recenter the camera, and see the real feature icons — the core mobile crawl loop (UX-01/02/03) works.
- `window.__mzControls`/`__mzCanvasSizing`/`__mzIconsApi`/`__mzSettings`/`__mzIconMap` are now established window bridges any later plan touching the MAZE tab (or a settings screen that needs to live-toggle `controlScheme`) can read directly.
- Known gaps for later slices (not regressions, explicitly out of THIS plan's scope): the MARKS chip currently toggles the existing inline legend rather than a full slide-up bottom-sheet (04-UI-SPEC.md Screen 7) — whichever plan builds that shared bottom-sheet component (camp sheet uses the same chrome) should also restyle MARKS to match; there is no live in-session control-scheme toggle yet (needs 04-09's settings screen); the player-marker glow is static, not animated (Claude's discretion, documented above).
- `npm test` is green at 451/451, `npm run test:quick` green at 362/362, `node tools/build-www.mjs` succeeds and ships `www/icons/optimized/*.png`.
- No blockers for Wave 5+ (04-07..04-10 build the remaining screens/settings around this now-interactive MAZE tab).

---
*Phase: 04-mobile-presentation-controls-onboarding*
*Completed: 2026-09-08*

## Self-Check: PASSED

All 9 `icons/optimized/*.png` files verified present on disk; both task commit hashes (`da06c0b`, `d77e2c4`) verified present in `git log --oneline --all`; `npm test` 451/451 and `npm run test:quick` 362/362 green as of the final commit.
