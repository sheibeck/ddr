---
phase: 04-mobile-presentation-controls-onboarding
plan: 01
subsystem: ui
tags: [canvas, touch-input, dpr, tap-to-move, node-test, vanilla-js]

# Dependency graph
requires: []
provides:
  - "src/browser/controls.js: screenToCell, resolveTapDirection, classifyPointerGesture (pure tap-to-cell + gesture math)"
  - "src/browser/canvasSizing.js: computeCanvasBacking, cellSizeForTextScale (pure DPR canvas-sizing math)"
affects: [04-06 (maze canvas viewport wiring), 04-02 (control-scheme setting), 04-05 (safe-area/DPR chrome)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure geometry modules under src/browser/ (no DOM/canvas reads, no Math.random) as the SINGLE shared source for math the renderer and input handler both need — eliminates compute-twice drift"
    - "TDD RED/GREEN per task, two commits each (test(...) then feat(...))"

key-files:
  created:
    - src/browser/controls.js
    - src/browser/canvasSizing.js
    - test/unit/controls.test.js
    - test/unit/canvasSizing.test.js
  modified: []

key-decisions:
  - "resolveTapDirection takes an isSeen(x,y) predicate matching the real engine/maze.js floor shape (g[y][x].seen), never a mockup Set — verified with a spy assertion that the predicate is called with (x,y) coordinates"
  - "Reworded two header-comment lines that literally contained the words 'Math.random' and 'window' so the plan's acceptance-criteria greps (which scan the whole file, comments included) pass cleanly without weakening the documentation intent"

patterns-established:
  - "Pattern 1: shared-transform contract — screenToCell/computeCanvasBacking are documented in-file as the ONE source 04-06's draw()/tap-handler must import, never re-derive"

requirements-completed: [UX-01, UX-03]

coverage:
  - id: D1
    description: "screenToCell inverts the renderer's cs/pan/DPR affine transform (center tap, adjacent N/E/S/W taps, pan+canvasPad offset) to resolve a screen point to the correct grid cell"
    requirement: "UX-01"
    verification:
      - kind: unit
        ref: "test/unit/controls.test.js#screenToCell: exact-center tap resolves to the player's own cell"
        status: pass
      - kind: unit
        ref: "test/unit/controls.test.js#screenToCell: adjacent E/W/N/S taps resolve to the correct neighbor cell"
        status: pass
      - kind: unit
        ref: "test/unit/controls.test.js#screenToCell: honors pan offset and canvasPad in the inverse transform"
        status: pass
    human_judgment: false
  - id: D2
    description: "resolveTapDirection returns N/E/S/W only for an orthogonally-adjacent, currently-seen cell (against the real floor.g[y][x].seen shape); every other tap (diagonal, same-cell, distance>1, unseen) is a no-op"
    requirement: "UX-01"
    verification:
      - kind: unit
        ref: "test/unit/controls.test.js#resolveTapDirection: adjacent seen cells resolve N/E/S/W correctly"
        status: pass
      - kind: unit
        ref: "test/unit/controls.test.js#resolveTapDirection: diagonal tap returns null"
        status: pass
      - kind: unit
        ref: "test/unit/controls.test.js#resolveTapDirection: distance-2 tap returns null"
        status: pass
      - kind: unit
        ref: "test/unit/controls.test.js#resolveTapDirection: unseen adjacent cell returns null even though orthogonally adjacent"
        status: pass
      - kind: unit
        ref: "test/unit/controls.test.js#resolveTapDirection: uses the isSeen predicate against real floor.g[y][x].seen shape, not a mockup Set"
        status: pass
    human_judgment: false
  - id: D3
    description: "classifyPointerGesture distinguishes tap from pan-drag by travel threshold (10px) + duration (350ms)"
    requirement: "UX-01"
    verification:
      - kind: unit
        ref: "test/unit/controls.test.js#classifyPointerGesture: below-threshold quick pointer classifies as tap"
        status: pass
      - kind: unit
        ref: "test/unit/controls.test.js#classifyPointerGesture: over-threshold travel classifies as drag"
        status: pass
      - kind: unit
        ref: "test/unit/controls.test.js#classifyPointerGesture: over-duration with low travel classifies as drag (long-press, reserved)"
        status: pass
    human_judgment: false
  - id: D4
    description: "canvas backing-store size equals CSS size x devicePixelRatio for every S/M/L cell size, including fractional DPR (2.625, Pixel 7 class)"
    requirement: "UX-03"
    verification:
      - kind: unit
        ref: "test/unit/canvasSizing.test.js#computeCanvasBacking: backing === style * dpr for dpr=1"
        status: pass
      - kind: unit
        ref: "test/unit/canvasSizing.test.js#computeCanvasBacking: backing === style * dpr for fractional dpr=2.625 (Pixel 7 class device)"
        status: pass
      - kind: unit
        ref: "test/unit/canvasSizing.test.js#cellSizeForTextScale: S -> 28"
        status: pass
      - kind: unit
        ref: "test/unit/canvasSizing.test.js#cellSizeForTextScale: unknown size defaults to M (34)"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-09-08
status: complete
---

# Phase 4 Plan 1: Tap-to-Move + DPR Canvas Math Summary

**Pure, DOM-free `controls.js` (tap-to-cell hit-test + gesture classification) and `canvasSizing.js` (DPR backing-store math), unit-tested headlessly, forming the single shared transform Wave-3's canvas wiring (04-06) must import rather than re-derive.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-08T19:27:00Z
- **Completed:** 2026-09-08T19:39:42Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 4 (all new)

## Accomplishments
- `src/browser/controls.js`: `screenToCell` inverts the renderer's `cs`/pan/DPR affine transform in CSS-px space; `resolveTapDirection` gates moves to orthogonally-adjacent + seen cells using a real-floor-shaped `isSeen(x,y)` predicate; `classifyPointerGesture` separates tap from pan-drag by a 10px/350ms threshold.
- `src/browser/canvasSizing.js`: `computeCanvasBacking` preserves the `fit()` invariant (`backing = style * dpr`) across integer and fractional DPR; `cellSizeForTextScale` maps the UI-SPEC's S/M/L text-size setting to the locked 28/34/40 CSS-px cell sizes.
- 23 new `node:test` unit tests, all green; full suite grew from 372 to 395 passing tests with zero regressions.

## Task Commits

Each task was committed as a RED/GREEN TDD pair:

1. **Task 1: Tap-to-cell + gesture-classification math (controls.js)**
   - `e334467` (test) — RED: 14 failing/unloadable test cases
   - `fe5d4d1` (feat) — GREEN: `src/browser/controls.js` implemented, 14/14 passing
2. **Task 2: DPR canvas-sizing math (canvasSizing.js)**
   - `afb2081` (test) — RED: 9 failing/unloadable test cases
   - `9c26842` (feat) — GREEN: `src/browser/canvasSizing.js` implemented, 9/9 passing

**Plan metadata:** (this commit, see below)

## Files Created/Modified
- `src/browser/controls.js` - Pure tap-to-cell hit-testing + pointer-gesture classification (screenToCell, resolveTapDirection, classifyPointerGesture, TAP_MOVE_THRESHOLD_PX, TAP_MAX_DURATION_MS)
- `src/browser/canvasSizing.js` - Pure DPR canvas-sizing math (computeCanvasBacking, cellSizeForTextScale)
- `test/unit/controls.test.js` - 14 unit tests covering tap-to-cell inversion, adjacency/seen gating, tap-vs-drag classification
- `test/unit/canvasSizing.test.js` - 9 unit tests covering the DPR backing-store invariant and text-scale-to-cell-size mapping

## Decisions Made
- `resolveTapDirection` accepts an `isSeen(x,y)` predicate (not a Set) to match the real `engine/maze.js` floor shape (`g[y][x].seen`) per 04-RESEARCH.md Pitfall 1 — verified with a spy that asserts the predicate is invoked with `(x, y)` coordinates matching the tapped cell, closing the risk of the live 04-06 wiring accidentally binding a mockup-shaped Set instead.
- No new dependencies; both modules are zero-DOM, zero-`Math.random`, matching this project's presentation-layer purity convention already enforced in `engine/*.js`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Header-comment wording tripped the plan's own literal-string acceptance-criteria greps**
- **Found during:** Task 1 and Task 2 (post-implementation acceptance-criteria verification)
- **Issue:** `controls.js`'s header comment explained the "zero DOM, zero Math.random" purity contract using the literal substring "Math.random"; `canvasSizing.js`'s header comment used the literal word "window" (e.g. "window.devicePixelRatio"). The plan's acceptance criteria run `grep -n "Math.random" src/browser/controls.js` (must return nothing) and a test asserts no `window`/`document` reference anywhere in `canvasSizing.js`'s source — both greps match comments as well as code, so the intended-to-be-empty result was non-empty.
- **Fix:** Reworded both comments to convey the same meaning ("zero randomness of any kind", "the device pixel ratio") without the literal trigger substrings. No behavior change — pure documentation wording.
- **Files modified:** src/browser/controls.js, src/browser/canvasSizing.js
- **Verification:** `grep -n "Math.random" src/browser/controls.js` now returns nothing (exit 1); `test/unit/canvasSizing.test.js`'s DOM-purity test passes.
- **Committed in:** fe5d4d1, 9c26842 (part of each task's GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug, minor/cosmetic)
**Impact on plan:** No scope creep — a same-commit wording fix so the plan's own acceptance criteria pass as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `controls.js` and `canvasSizing.js` are ready for 04-06 to import directly for the live maze-canvas wiring (tap handler + `fit()`-equivalent resize) — both document the shared-transform contract in their file headers so 04-06 has no reason to re-derive the math.
- `npm test` is green at 395 (up from 372 baseline), `npm run test:quick` green at 306.
- No blockers for the rest of Wave 1 or downstream waves.

---
*Phase: 04-mobile-presentation-controls-onboarding*
*Completed: 2026-09-08*

## Self-Check: PASSED

All created files verified present on disk; all four task commit hashes (e334467, fe5d4d1, afb2081, 9c26842) verified present in `git log --oneline --all`.
