---
quick_id: 260916-w0c
slug: v1-4-uat-fixes-tap-to-move-bridge-timing
subsystem: ui
tags: [vanilla-js, uat-fix, tap-to-step, bridge-timing, png-icons, marks-legend, rail, settings-gear, source-assertion-tests]

requires:
  - phase: 35-map-screen-rebuild
    provides: tap-to-step/hold-to-inspect viewport controls, mapMarks.js palette bridge, icons.js PNG icon pipeline, the map chip row, the RAIL card system
provides:
  - the tap-to-move bridge is read lazily at call time, fixing the throw that made every tap a no-op on-device
  - the v1.3 PNG map icons and party.png are restored as canon (Phase 35 decision 3 reversed)
  - the settings gear is a viewport chip right of MAKE CAMP instead of a HUD button
  - the bottom RAIL is visible only on the Map tab
affects: [map-screen, hud, settings, rail]

tech-stack:
  added: []
  patterns:
    - "call-time bridge accessor: T() reads window.__mzTapStep lazily instead of capturing it at parse time, avoiding classic-script-before-module-script ordering bugs"

key-files:
  created: []
  modified:
    - mazeworld.html
    - test/unit/shell-map-viewport.test.js
    - test/unit/shell-map-hud.test.js
    - test/unit/shell-map-invariants.test.js
    - test/unit/shell-gear-toolbar.test.js
    - test/unit/shell-map-rail.test.js

key-decisions:
  - "user reversed Phase 35 decision 3 on 2026-09-16 UAT — PNG icons are canon; the glyph experiment is retired"
  - "user ruling 2026-09-16 UAT: \"Move the settings gear into a button and put it on the right of the make camp button.\""
  - "user ruling 2026-09-16 UAT: rail is a map-tab element"

patterns-established:
  - "Module bridges consumed by a classic (non-module) parse-time IIFE must be read through a call-time accessor, never captured as a top-level const, because the module script that assigns the bridge always runs after every classic script."

requirements-completed: [MAP-02, MAP-07, MAP-06, MAP-03]

coverage:
  - id: D1
    description: "A clean tap on the map viewport steps the party one square toward the tap (the pointerdown handler no longer throws on an undefined bridge)"
    requirement: MAP-02
    verification:
      - kind: unit
        ref: "test/unit/shell-map-viewport.test.js#(f) bridge timing (2026-09-16 UAT fix)"
        status: pass
    human_judgment: true
    rationale: "The unit test proves the source no longer captures the bridge at parse time, but only an on-device tap can confirm the gesture actually reaches tapStep() end-to-end."
  - id: D2
    description: "Every seen feature square draws its v1.3 PNG icon and the party draws party.png with the pulsing ring; the MARKS sheet shows the same PNGs"
    requirement: MAP-07
    verification:
      - kind: unit
        ref: "test/unit/shell-map-hud.test.js#(i)/(j), test/unit/shell-map-invariants.test.js#PNG canon"
        status: pass
    human_judgment: true
    rationale: "Source-assertion tests prove the draw()/legend code path is PNG-based, but visual correctness (icon rendering, rotation, scale) needs an on-device look."
  - id: D3
    description: "The settings gear is a chip right of MAKE CAMP and opens Settings; the HUD strip no longer shows a gear"
    requirement: MAP-06
    verification:
      - kind: unit
        ref: "test/unit/shell-map-hud.test.js#(a)/(h), test/unit/shell-gear-toolbar.test.js chip order"
        status: pass
    human_judgment: true
    rationale: "Markup order is pinned by tests; visual placement/tap-target feel needs on-device confirmation."
  - id: D4
    description: "The bottom RAIL is visible only on the Map tab"
    requirement: MAP-03
    verification:
      - kind: unit
        ref: "test/unit/shell-map-rail.test.js#(o) 2026-09-16 UAT ruling"
        status: pass
    human_judgment: true
    rationale: "Source-assertion proves the hide/show logic; a card arriving on another tab and reappearing on return to Map needs a live device check."

duration: 55min
completed: 2026-09-17
status: complete
---

# Quick Task 260916-w0c: v1.4 UAT Fixes (Tap-to-Move Bridge Timing) Summary

**Fixed the tap-to-move bridge-timing bug that broke every tap on-device, and landed three user rulings from the first Pixel 7 UAT round: PNG map icons restored as canon, the settings gear moved into the viewport chip row, and the RAIL made a map-tab-only element.**

## Performance

- **Duration:** 55min
- **Started:** 2026-09-17T02:33:00Z (approx, first read)
- **Completed:** 2026-09-17T03:28:23Z
- **Tasks:** 4 completed
- **Files modified:** 6 (mazeworld.html + 5 test files)

## Accomplishments

- Tap-to-move now works: `initMazeViewportControls` reads the `window.__mzTapStep` bridge through a call-time accessor `T()` instead of capturing it eagerly at parse time (the eager capture was always `undefined` because the module script that assigns the bridge runs after every classic script, so `pointerdown` threw while building the gesture object and no tap was ever recorded).
- The v1.3 PNG map icons and `party.png` are restored as canon in `draw()` and the MARKS legend, reversing Phase 35 decision 3's coloured-text-glyph experiment per the user's explicit UAT feedback.
- The settings gear left the HUD strip and is now the right-most chip in the viewport chip row (MARKS, CENTRE, gap, MAKE CAMP, gear), wired through its existing `openSettingsSheet` listener.
- The bottom RAIL is now a map-tab element: hidden outright on Hero/Gear/Oracle/Dead, and re-derives its visibility (both the combat/dead/won gate and the active-tab gate) on return to the Map tab, so a card that arrived while the player was on another tab is still shown if it's within its hold.

## Task Commits

Each task was committed atomically:

1. **Task 1: Tap-to-move bridge timing** - `be6d2e3` (fix)
2. **Task 2: Restore the v1.3 PNG map icons + party.png** - `38b4895` (feat)
3. **Task 3: Move the settings gear into a chip right of MAKE CAMP** - `ef8d292` (feat)
4. **Task 4: The RAIL is a map-tab element + full gate + debug APK** - `c0e8032` (feat)

_No TDD tasks in this plan; each task is a single commit (source + its own re-pinned tests together)._

## Files Created/Modified

- `mazeworld.html` - lazy tap-to-move bridge accessor; PNG icon draw()/legend restoration; settings gear chip relocation; map-tab-only RAIL visibility
- `test/unit/shell-map-viewport.test.js` - re-pinned (f) for the call-time bridge accessor, added a new bridge-timing test
- `test/unit/shell-map-hud.test.js` - re-pinned (a)/(h)/(i)/(j)/(m) for PNG canon and the gear's new HUD-absent/chip-present placement
- `test/unit/shell-map-invariants.test.js` - re-pinned retirement/PNG-canon tests, added the fourth (gear) chip listener pin
- `test/unit/shell-gear-toolbar.test.js` - re-pinned the chip-order test to include the gear after MAKE CAMP
- `test/unit/shell-map-rail.test.js` - added test (o) pinning `mwActiveTab`/showTab/renderRail's map-tab-only rail behavior

## Decisions Made

- "user reversed Phase 35 decision 3 on 2026-09-16 UAT — PNG icons are canon; the glyph experiment is retired"
- User ruling 2026-09-16 UAT: "Move the settings gear into a button and put it on the right of the make camp button."
- "user ruling 2026-09-16 UAT: rail is a map-tab element" — supersedes 35-02's planner-discretion placement (rail visible below the Gear list on every tab)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Task 1's own literal comment text broke its own acceptance grep**

- **Found during:** Task 1
- **Issue:** The plan's literal comment text for the lazy accessor named `window.__mzTapStep` a second time in prose ("but window.__mzTapStep is assigned by the trailing module script..."), which made the raw-file occurrence count of `window.__mzTapStep` inside the IIFE region equal 2, failing the plan's own `=== 1` acceptance check (the accessor must be the sole reference).
- **Fix:** Reworded the comment to say "the tapStep bridge" instead of spelling the literal `window.__mzTapStep` a second time, preserving the same explanatory content.
- **Files modified:** mazeworld.html
- **Commit:** be6d2e3

No other deviations — the remaining three tasks executed exactly as written, and every acceptance-criteria grep/node check in the plan passed on the first or (for Task 1) second attempt.

## Gate Results

- `npm test`: **2172/2172 pass, fail 0** (baseline 2170 + 2 new tests: the Task 1 bridge-timing test and the Task 4 rail (o) test)
- `npm run build:www`: **exit 0**
- `git diff --stat -- engine content test/parity`: **empty** (ENGINE GATE untouched)
- `git hash-object test/parity/prototype-master.js.txt`: **a1f4d0dc29782218d8e5aab65bc5989c33f917f0** (unchanged, matches required pin)
- `npm run android:debug`: **exit 0** (BUILD SUCCESSFUL)
- Debug APK: `android/app/build/outputs/apk/debug/app-debug.apk` — **9,475,649 bytes**, mtime **2026-09-16 23:27:46 -0400**
- No `adb` commands were run — the orchestrator installs the APK.

## Self-Check: PASSED

- FOUND: mazeworld.html (modified, all four tasks' changes present)
- FOUND: test/unit/shell-map-viewport.test.js
- FOUND: test/unit/shell-map-hud.test.js
- FOUND: test/unit/shell-map-invariants.test.js
- FOUND: test/unit/shell-gear-toolbar.test.js
- FOUND: test/unit/shell-map-rail.test.js
- FOUND: android/app/build/outputs/apk/debug/app-debug.apk
- FOUND commit be6d2e3 (Task 1)
- FOUND commit 38b4895 (Task 2)
- FOUND commit ef8d292 (Task 3)
- FOUND commit c0e8032 (Task 4)

## Human verification

1. A tap two squares from the party steps the party one square toward it (tap-to-move works; hold still inspects, drag pans, pinch zooms).
2. The map shows the v1.3 PNG icons on every seen feature square and party.png (with the pulsing ring) on the party, and the MARKS sheet rows show the same PNG icons.
3. The gear chip sits right of MAKE CAMP and opens Settings; the HUD strip no longer shows a gear.
4. The rail is absent on the Hero/Gear/Oracle/Dead tabs and present on the Map tab, and a card that arrives while on Gear is visible on returning to Map within its hold.
