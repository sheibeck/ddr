---
phase: 35-map-screen-rebuild
plan: 03
subsystem: ui
tags: [vanilla-js, hud, condition-chips, canvas-palette, mark-glyphs, marks-sheet, camp-sheet, viewport-chips, source-assertion-tests]

# Dependency graph
requires:
  - phase: 35-01
    provides: "src/browser/mapMarks.js (MAP_PALETTE/MARK_GLYPHS/MARK_SCALE/ONEWAY_ROTATION_DEG/MARKS_LEGEND/markForCell/legendFor) — the pure canvas-palette module this plan wires into draw()/the legend sheet"
  - phase: 35-02
    provides: "#mw-rail's window.mzRailLine one-shot entry point (chip explanations), railLocked()/railPulse() (the camp sheet's ruling-3 refusal), guardTap/armEncounterButtons, the static tab bar layout this plan builds directly against"
provides:
  - "The rebuilt HUD strip: FLOOR (gold) / DAY / SQUARES / RATIONS left, x/y WP over a threshold bar right, DEV chip + gear — the DR13 name/class/hp character line is retired outright"
  - "The condition-chip strip (.mw-cond-strip) — its own strip beneath the HUD (ruling 5), one guarded <button> per conditionsOf(S) descriptor, CONDITION_TONE/CONDITION_EXPLAIN, tap → explanation in the rail"
  - "The viewport chrome: MARKS/CENTRE top-left, MAKE CAMP top-right (.mw-map-chips), replacing the Phase 33 chip row; the Phase 25.1 flash element retired"
  - "draw() reads its palette + coloured mark glyphs from src/browser/mapMarks.js via window.__mzMapMarks (decision 3) instead of the Phase-4 PNG icon pipeline — raised wall blocks with a light/dark bevel, a floor inset, the 6px outer border, every feature glyph incl. the rotated one-way door, and the party dot"
  - "#mw-party-pulse + positionPartyPulse() — a DOM ring pulsing over the party's canvas cell (mwglow, reduced-motion safe), not a canvas rAF loop"
  - "The MARKS legend sheet's rows are glyph/name/description built from mapMarks.js — the classic PNG <img> row table is retired"
  - "The MAKE CAMP bottom sheet (#mw-camp-sheet, MAP_COPY, openCampSheet()/closeCampSheet()) — SLEEP dispatches the existing camp bridge; refusal/result reach the rail through the existing dispatchWithToasts fold"
affects: [35-04-shell-map-viewport, 35-05-executor-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "paintConditions() key-gates armEncounterButtons() on the joined conds key list (kind included) so a repaint after every step doesn't re-arm the chip strip — only a changed chip SET does"
    - "draw() takes window.__mzMapMarks with a literal-object fallback (never throws if the bridge somehow failed to load) — same fail-open discipline the old icons.js bridge used"
    - "openCampSheet() mirrors the joiner/find/climb rail-lock discipline (railLocked() -> railPulse()) even though it is a sheet, not a rail card — ruling 3 (no dispatch past an active decision) applies to every entry point, not just movement"

key-files:
  created:
    - test/unit/shell-map-hud.test.js
  modified:
    - mazeworld.html
    - test/unit/shell-gear-toolbar.test.js

key-decisions:
  - "Decision 3 (marks) applied exactly as planned: draw() and renderMarksLegend() stop referencing icons.js's PNG pipeline; icons.js, icons/*.png, and the boot-time preload/bridge lines are byte-unchanged and still loaded (no asset deletion) — window.__mzIconMap/preloadIcons still run, just unread by the map renderer/legend now."
  - "Ruling 5 (chips in the HUD) applied exactly as planned: the condition-chip strip and the party rail both moved OUT of the HUD header into their own strips directly beneath it; the HUD keeps only the FLOOR/DAY/SQUARES/RATIONS row and the WP readout plus the DEV chip/gear."
  - "The camp chip's onclick was previously a direct window.mzMakeCamp() dispatch (wired in the classic script, pre-existing since Phase 25.1/33) — this plan retargets it to openCampSheet() and deletes the old direct-dispatch assignment outright (not left as dead code) so shell-gear-toolbar's own 'stays singular' pin on the onclick assignment count holds."
  - "positionPartyPulse(rect) reuses positionCanvas()'s own viewport-center-plus-pan transform rather than a second cell-lookup — the party is always drawn at the viewport center (that IS positionCanvas()'s definition), so the ring's CSS position is derived from the same rect/pan positionCanvas() just computed, one shared transform."

requirements-completed: [MAP-01, MAP-06, MAP-07]

coverage:
  - id: D1
    description: "The HUD strip matches the mock: FLOOR (gold)/DAY/SQUARES/RATIONS (red at <=2) left in Press Start 2P 6.5px/Courier 700 16px, x/y WP (red at <=25%) over a 64x5 threshold bar (green >50%, gold >22%, else red) right; the DR13 character line is gone; DEV chip + gear stay in the strip"
    requirement: "MAP-01"
    verification:
      - kind: unit
        ref: "test/unit/shell-map-hud.test.js#(a) HUD markup / (c) HUD CSS / (g) paint()"
        status: pass
    human_judgment: false
  - id: D2
    description: "A condition-chip strip sits directly under the HUD (ruling 5), hidden when empty; one guarded chip per conditionsOf(S) descriptor with CONDITION_TONE colouring and a Courier 700 10px remaining-count suffix; a tap puts CONDITION_EXPLAIN[cn.key] in the rail as an info card"
    requirement: "MAP-01"
    verification:
      - kind: unit
        ref: "test/unit/shell-map-hud.test.js#(b) layout / (d) chip CSS / (e) CONDITION_TONE+EXPLAIN / (f) paintConditions"
        status: pass
    human_judgment: false
  - id: D3
    description: "The canvas renderer paints the mock's palette from mapMarks.js — fog, raised bevelled wall blocks, inset floor, the 6px border — and draws every seen feature as its coloured text glyph at 60% of the cell (the one-way door rotated to its passable direction); the party is a gold dot with a static glow plus a pulsing DOM ring, reduced-motion safe"
    requirement: "MAP-07"
    verification:
      - kind: unit
        ref: "test/unit/shell-map-hud.test.js#(i) draw() / positionPartyPulse / (m) BEHAVIOUR"
        status: pass
    human_judgment: false
  - id: D4
    description: "MARKS opens the glyph-row legend sheet (mapMarks.js's MARKS_LEGEND, no PNG rows); CENTRE recenters; MAKE CAMP opens a guarded sheet (SLEEP/1 RATION, WALK/ON) whose SLEEP dispatches the existing camp bridge and whose refusal/result are rail cards; both sheets close on their scrim and stamp the settle window"
    requirement: "MAP-06"
    verification:
      - kind: unit
        ref: "test/unit/shell-map-hud.test.js#(h) chrome / (j) legend / (k) camp sheet / (l) settle-stamp count"
        status: pass
    human_judgment: false
  - id: D5
    description: "The Phase 33 chip row, the flash element, the HUD character line, and the PNG draw path are fully retired — zero occurrences anywhere in mazeworld.html, code or comments"
    verification:
      - kind: unit
        ref: "test/unit/shell-map-hud.test.js#(a) raw file / (h) chrome retired-literal sweep"
        status: pass
    human_judgment: false
  - id: D6
    description: "Full regression: npm test, npm run build:www, and the engine/content/parity/icons.js/icons diff stay green; the parity golden-master hash is unchanged"
    verification:
      - kind: unit
        ref: "npm test — 2109/2109, 0 fail (2090 baseline + 19 new)"
        status: pass
      - kind: other
        ref: "npm run build:www — exit 0, www/src/browser/mapMarks.js present"
        status: pass
      - kind: other
        ref: "git diff --stat -- engine content test/parity src/browser/icons.js icons — empty; git hash-object test/parity/prototype-master.js.txt == a1f4d0dc29782218d8e5aab65bc5989c33f917f0 (unchanged)"
        status: pass
    human_judgment: false

# Metrics
duration: ~50min
completed: 2026-09-16
status: complete
---

# Phase 35 Plan 03: Map HUD, Condition Chips, Canvas Palette, Marks/Camp Sheets Summary

**The map column's chrome now matches the mock — a two-row HUD (FLOOR/DAY/SQUARES/RATIONS + x/y WP bar) with its own condition-chip strip beneath it, a canvas renderer painting coloured text-glyph marks + a pulsing party ring from `src/browser/mapMarks.js`, and MARKS/MAKE CAMP as guarded bottom sheets — with 19 new source-assertion tests and zero engine/content/parity/icons.js edits.**

## Performance

- **Duration:** ~50 min
- **Started:** 2026-09-16 (approx., immediately after 35-02)
- **Completed:** 2026-09-16T22:16:00-04:00
- **Tasks:** 3
- **Files modified:** 3 (1 core + 1 new test file + 1 re-pinned test file)

## Accomplishments

- **HUD strip** — `.mw-hud` rebuilt to the mock's single-row layout (FLOOR/DAY/SQUARES/RATIONS left, the new `.mw-hud-wp` x/y WP readout + threshold bar right, DEV chip + gear); the DR13 name/subclass/level/hp character line (`hud-name`/`hud-cls`/`mm-hp`/`mm-hpmax`/`mm-hpfill`) is fully retired — `paint()` now writes the WP text/fill with the mock's exact 25%/50%/22% thresholds instead.
- **Condition-chip strip** — moved out of the HUD (ruling 5) into its own `.mw-cond-strip` directly beneath it; `paintConditions()` now builds real `<button>` elements (not innerHTML spans) with `CONDITION_TONE`/`CONDITION_EXPLAIN` and a `guardTap` wired tap that puts the explanation in the rail via `window.mzRailLine`, key-gated so a same-set repaint never re-arms the strip.
- **Viewport chrome** — `.mw-map-chips` (MARKS/CENTRE top-left, MAKE CAMP top-right via a flex gap span) replaces the Phase 33 `.mw-viewport-chips` row; the unused flash element/function is retired outright.
- **Canvas renderer (decision 3)** — `draw()` reads `MAP_PALETTE`/`markForCell`/`MARK_SCALE`/`ONEWAY_ROTATION_DEG` from `src/browser/mapMarks.js` via the new `window.__mzMapMarks` bridge: raised wall blocks with a 2px light/dark bevel, an inset floor, a 6px outer border, and every seen feature drawn as its coloured glyph (the one-way door rotated via `ctx.rotate`) — the old graph-paper grid, ink-edge wall outline, and PNG icon passes are gone. `icons.js`/`icons/*.png` and the boot-time preload stay untouched (no asset deletion).
- **Party pulse** — `#mw-party-pulse` + `positionPartyPulse(rect)` (called from `positionCanvas()`) is a DOM ring, not a canvas rAF loop, so the blanket `prefers-reduced-motion` rule zeroes its `mwglow` animation for reduced-motion users; the canvas keeps its static glow underneath regardless.
- **MARKS legend** — `renderMarksLegend()` builds glyph/name/description rows from `mapMarks.js`'s `MARKS_LEGEND`/`MARK_GLYPHS`, replacing the classic PNG `<img>` row table entirely.
- **MAKE CAMP sheet** — `#mw-camp-sheet` (new bottom sheet, reusing the legend sheet's scrim/rise chrome) with `MAP_COPY.camp` (copy/sleep/walk literals) and `openCampSheet()`/`closeCampSheet()`: refuses via `railLocked()`/`railPulse()` (ruling 3) while a rail decision is pending, SLEEP dispatches the existing `window.mzMakeCamp` bridge (refusal/result reach the rail through the pre-existing `dispatchWithToasts` fold, nothing synthesized here), both sheet closes stamp the settle window.
- 19 new tests in `test/unit/shell-map-hud.test.js` (exceeding the plan's 14-test minimum) plus `shell-gear-toolbar.test.js`'s UIF-05 chip-row tests re-pinned to the new `.mw-map-chips` markup/CSS.

## Task Commits

Each task was committed atomically:

1. **Task 1: HUD strip + condition-chip strip** - `15529ec` (feat)
2. **Task 2: Viewport chrome + canvas palette/glyph renderer + party pulse + MARKS legend glyph rows + MAKE CAMP sheet** - `e5b720c` (feat)
3. **Task 3: shell-map-hud.test.js + re-pin shell-gear-toolbar's UIF-05 chip-row tests** - `8dc49d7` (test)

**Plan metadata:** (this commit) `docs: complete 35-03 plan`

## Files Created/Modified

- `mazeworld.html` - HUD strip (`.mw-hud`/`.mw-hud-top`/`.mw-hud-row`/`.mw-hud-wp*`) rebuild, `.mw-cond-strip`/`.mw-cond[data-tone]` + `CONDITION_TONE`/`CONDITION_EXPLAIN` + guarded `paintConditions()`, `.mw-map-chips`/`.mw-map-chip` viewport chrome, `draw()`'s palette/glyph rewrite reading `window.__mzMapMarks`, `#mw-party-pulse` + `positionPartyPulse()`, `renderMarksLegend()`'s glyph-row rebuild, `#mw-camp-sheet` + `MAP_COPY` + `openCampSheet()`/`closeCampSheet()`, retirement of the Phase 33 chip row / flash element / HUD character line / PNG draw path / `MAZE_CANVAS_COLORS`
- `test/unit/shell-map-hud.test.js` - new, 19 tests: HUD markup/layout/CSS, chip CSS + tone rules, `CONDITION_TONE`/`CONDITION_EXPLAIN` completeness + voice scan, `paintConditions()` wiring, `paint()` WP writes, viewport chrome, `draw()` region positive/negative pins, the legend region, the camp sheet (markup/copy/wiring/settle stamps), settle-stamp/`encounterSettled()` counts, and a BEHAVIOUR check against the real `mapMarks.js` mapping/rotation table
- `test/unit/shell-gear-toolbar.test.js` - `chipsMarkup()` re-pinned to `.mw-map-chips`/`<section class="mw-overlay"`; the chip-order test's camp-button class assertion updated to `mw-map-chip camp`; the chip-row CSS test re-pinned to `.mw-map-chips`/`.mw-map-chips-gap`

## Decisions Made

See `key-decisions` in frontmatter. Decision 3 and ruling 5 landed exactly as the plan specified, with no deviation. One implementation detail beyond the plan's literal text: the camp chip's pre-existing direct `window.mzMakeCamp()` onclick assignment (from Phase 25.1/33, in the classic script's `dpad`-adjacent block) was deleted outright rather than left as dead code, so `shell-gear-toolbar.test.js`'s pre-existing "the camp button's onclick wiring... stays singular" pin (count === 1) continues to hold against the new `openCampSheet` assignment.

## Deviations from Plan

None - plan executed exactly as written. Every CSS literal, markup id/order, `draw()` pass, and sheet-wiring behavior bullet matches the plan's action steps and acceptance-criteria scripts verbatim (re-verified by running the plan's own literal grep/`node -e` acceptance snippets against the finished file).

## Issues Encountered

- Two stray comment references to the retired `.mw-viewport-chips` class survived Task 1/2's markup edits (a `.mazefoot` CSS comment and a doc comment above the new `.mw-map-chips` rule) — caught by the discipline sweep before commit and reworded to describe the retired chrome by role instead of by its banned literal name. Resolved in the same task, no separate fix commit needed.
- The initial `shell-map-hud.test.js` draft sliced `draw()`'s region against the comment-stripped `CODE` constant using the block-comment marker `/* ---------------- log` as the end boundary — that marker is itself inside a block comment and gets blanked by `stripComments()`, so it was never found. Fixed by slicing the RAW `HTML` (not `CODE`) and stripping only `//` line comments, mirroring the plan's own literal `node -e` acceptance script. A second minor test bug (a fragile nested-`indexOf` "end of `.mw-hud-top`" boundary calculation) was simplified to an ordering check, since `.mw-hud-top` is now the header's only child. Both fixed before the Task 3 commit, no separate fix commit needed.

## User Setup Required

None - no external service configuration required.

## Human verification (deferred to end of run)

No device check was run for this plan (per the project's Deferred UAT protocol — autonomous runs batch device checks at milestone close). The following Pixel 7 checks are queued for the end-of-run batch:

1. The HUD reads FLOOR (gold) · DAY · SQUARES · RATIONS on the left in the small Press Start 2P labels, and x/y WP over a thin bar on the right; RATIONS turns red at 2 remaining; the WP bar turns gold under half, red under a quarter, and the WP text itself turns red at or under a quarter; there is no name/class/hp line anywhere in the HUD; the gear icon still opens Settings.
2. Drink a haste potion (or otherwise pick up a tracked condition) — a tone-coloured chip strip appears directly under the HUD with the condition's label and a remaining-count suffix; tapping a chip shows its explanation as a card in the bottom rail; the strip disappears entirely once the condition ends.
3. The maze draws dark fog over unexplored squares, raised dark-brown wall blocks with a visible light/dark bevel, warm-stone floor squares with a thin inset line, and a thick outer border; every mark on a seen tile is a coloured glyph — red ● (encounter), purple ◆ (teleport), green ▲ (door, pointing its passable direction), red ✕ (trap), tan ▪ (chest), tan ⧗ (crevice — confirm this renders as the hourglass glyph and not an empty box/tofu character on-device), tan ▼ (stairs down) — none renders as an empty box; the party is a gold dot with a pulsing gold ring around it; with reduced-motion enabled system-wide, the ring stops pulsing (a static dot/glow only).
4. Tap MARKS — the "WHAT THE MARKS MEAN" sheet opens with a coloured glyph, a name, and a description per row; tapping the scrim closes it; the very next tap-to-step attempt within about a quarter second of closing is silently swallowed (the settle window).
5. Tap CENTRE — the map snaps back so the party is centered in the viewport, even after panning/zooming away.
6. Tap MAKE CAMP — the sheet opens with the "Eight hours asleep..." copy and two buttons, SLEEP / 1 RATION (gold) and WALK / ON (bordered); with rations available, SLEEP produces a CAMP MADE (green) card in the rail with the rest details; with no rations, SLEEP produces a NOTHING TO EAT (red) card in the rail; tapping SLEEP within about a quarter second of the sheet opening does nothing (the arm window); WALK ON closes the sheet with no dispatch; with a Joiner/Find decision pending in the rail, tapping MAKE CAMP only pulses the pending rail card instead of opening the sheet.

## Next Phase Readiness

- Plan 04 (tap-to-step + stair gate) can build directly against this plan's finished chrome: `window.__mzMapMarks` is the one bridge it needs for any further mark-glyph work, `positionCanvas()`/`positionPartyPulse()` already share the one pan/zoom transform, `MAP_COPY` already exists for it to add a `stair` key beside `camp`, and `.mw-maze-viewport`'s `touch-action:none`/`user-select:none` are already in place for the hold-to-inspect gesture.
- No blockers. `npm test` 2109/2109; `npm run build:www` exit 0 (`www/src/browser/mapMarks.js` present); `git diff --stat -- engine content test/parity src/browser/icons.js icons` empty; the parity golden-master hash `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` is unchanged; the D-pad/`.mazefoot`/control bar are byte-identical, still owned by Plan 04.

---
*Phase: 35-map-screen-rebuild*
*Completed: 2026-09-16*

## Self-Check: PASSED

`mazeworld.html`, `test/unit/shell-map-hud.test.js`, and this SUMMARY.md confirmed present on disk. All three task commits (`15529ec`, `e5b720c`, `8dc49d7`) confirmed present in `git log`.
