---
phase: 35-map-screen-rebuild
plan: 01
subsystem: ui
tags: [vanilla-js, pure-modules, rail-view-model, tap-to-step, map-marks, voice-scan, tdd]

# Dependency graph
requires:
  - phase: 34-combat-screen-rebuild
    provides: "fightLog.js's fold-then-bridge pattern (toastsForAction withIdx) this plan mirrors for the RAIL"
provides:
  - "src/browser/rail.js — the RAIL view-model (family table, generic roll line, one card per dispatch, seq push/announce)"
  - "src/browser/tapStep.js — tap-to-step direction resolution (dominant axis + fallback) and hold-inspect cards"
  - "src/browser/mapMarks.js — the canvas palette, coloured mark glyphs, and the 9-row marks legend"
affects: [35-02-shell-map-rail, 35-03-shell-map-hud, 35-04-shell-map-viewport, 35-05-executor-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "rail.js is the out-of-combat twin of fightLog.js: both fold toastsForAction(..., {limit: Infinity, withIdx: true}) — one dispatch, two destinations (rail or fight log), the Phase 32 partition invariant re-read"
    - "tapStep.js extends, never re-derives, controls.js's tap/cell math: a new dominant-axis-then-fallback resolver, controls.js's screenToCell/resolveTapDirection left untouched"
    - "mapMarks.js imports only the pure featureKeyForCell mapper from icons.js — the PNG preload/draw pipeline stays on disk, unreferenced, no asset deletion"

key-files:
  created:
    - src/browser/rail.js
    - src/browser/tapStep.js
    - src/browser/mapMarks.js
    - test/unit/rail.test.js
    - test/unit/tapStep.test.js
    - test/unit/mapMarks.test.js
  modified: []

key-decisions:
  - "Orchestrator decision 1 (climb dice, RESEARCH OQ1) applied as planned: no engine change; rollLineFor returns null for fellClimbing/fellInGorge/climbedOver/leaptOver today (no roll/need field on those events) and is written generically (narration roll span, else numeric event.roll/need/hurt) so a later additive payload lights climb dice up with zero shell change."
  - "Orchestrator decision 4 (no PICK THE LOCK) applied as planned: chest families (chestOpened/chestLockRolled/scrollFound/chestLocked) are auto-clearing rail cards with no action row; the only real decision on a chest tile is the pre-existing find prompt, owned by Plan 02."
  - "Orchestrator decision 3 (colored glyph marks, 2026-09-16) applied as planned: mapMarks.js's MARK_GLYPHS/MARKS_LEGEND replace icons.js's PNG pipeline for the map renderer and legend; icons.js itself is untouched and its image assets stay on disk unused by this module."
  - "railCardFor keeps a lines-array with an internal (non-exported) `tone` field so the head's family lookup can read the original toastsForAction tone even though the final {text, roll} line shape drops it — needed for the fallback branch to classify an unlisted event type correctly."

requirements-completed: [MAP-02, MAP-03, MAP-04, MAP-07]

coverage:
  - id: D1
    description: "rail.js: railFamilyFor covers every TOAST_FOR key (explicit family or block/tone fallback) with a non-empty title, a tone in RAIL_TONES, and a hold in [2200, 6000]"
    requirement: "MAP-03"
    verification:
      - kind: unit
        ref: "test/unit/rail.test.js#coverage: every TOAST_FOR key resolves to a family..."
        status: pass
    human_judgment: false
  - id: D2
    description: "rail.js: rollLineFor never fabricates a roll/need the event payload doesn't carry (hurt alone yields null); the narration roll span wins when present"
    requirement: "MAP-03"
    verification:
      - kind: unit
        ref: "test/unit/rail.test.js#rollLineFor: narration roll span first, else numeric event.roll(+need)(+hurt), else null"
        status: pass
    human_judgment: false
  - id: D3
    description: "rail.js: railCardFor folds one out-of-combat dispatch (toastsForAction withIdx output + RAIL_DIRECT events) into ONE card, lines stacked newest-first, head picks icon/title/tone, hold is the max family hold"
    requirement: "MAP-03"
    verification:
      - kind: unit
        ref: "test/unit/rail.test.js#railCardFor: a trap + level-up move dispatch folds to one card..."
        status: pass
      - kind: unit
        ref: "test/unit/rail.test.js#railCardFor: a floorChanged-only dispatch builds a card straight from RAIL_DIRECT..."
        status: pass
    human_judgment: false
  - id: D4
    description: "rail.js: RAIL_DIRECT (floorChanged/dayBegan/findTaken/findLeft) is a strict subset of ORACLE_ONLY and disjoint from TOAST_FOR's keys — the retired Move-on card's floor arrival/level-up and the find outcome still reach the rail from the Oracle narration"
    requirement: "MAP-04"
    verification:
      - kind: unit
        ref: "test/unit/rail.test.js#RAIL_DIRECT is a strict subset of ORACLE_ONLY and disjoint from TOAST_FOR's keys"
        status: pass
    human_judgment: false
  - id: D5
    description: "rail.js: railPush/railClear/railAnnouncement give the rail its seq discipline (aria-live announces a new card once, seq-gated) and its pending-decision slot (emptyRail)"
    requirement: "MAP-04"
    verification:
      - kind: unit
        ref: "test/unit/rail.test.js#emptyRail/railPush/railClear: seq discipline, pending preserved, never mutates the input"
        status: pass
      - kind: unit
        ref: "test/unit/rail.test.js#railAnnouncement: seq-gated, joins title + line text; null/stale card announces nothing"
        status: pass
    human_judgment: false
  - id: D6
    description: "tapStep.js: resolveStep resolves one adjacent step toward any tapped cell (dominant axis first, fallback axis only when its delta is non-zero, both-blocked case), never a diagonal, never the raw tap coordinate, never throws on bad input"
    requirement: "MAP-02"
    verification:
      - kind: unit
        ref: "test/unit/tapStep.test.js#resolveStep: dominant axis resolves the correct direction..."
        status: pass
      - kind: unit
        ref: "test/unit/tapStep.test.js#resolveStep: falls back to the other axis when the dominant-axis candidate is blocked"
        status: pass
      - kind: unit
        ref: "test/unit/tapStep.test.js#resolveStep: blocked (no fallback) when the dominant candidate fails and the other axis has zero delta"
        status: pass
      - kind: unit
        ref: "test/unit/tapStep.test.js#resolveStep: NaN/undefined pos or target never throws and always resolves to blocked"
        status: pass
    human_judgment: false
  - id: D7
    description: "tapStep.js: inspectCell returns the four hold-inspect cards (UNWALKED checked before SOLID ROCK so fog never reveals rock; mark legend row; EMPTY CORRIDOR) from a plain cell + legendFor"
    requirement: "MAP-02"
    verification:
      - kind: unit
        ref: "test/unit/tapStep.test.js#inspectCell: an unseen cell is UNWALKED — checked before the wall test so fog never reveals rock"
        status: pass
      - kind: unit
        ref: "test/unit/tapStep.test.js#inspectCell: a seen, non-wall cell with a legend-mapped feat shows the mark's legend row..."
        status: pass
    human_judgment: false
  - id: D8
    description: "mapMarks.js: MARK_GLYPHS carries the seven CONTEXT glyph/colour pairs plus wall and party; MARKS_LEGEND's nine rows are byte-identical to the retired mazeworld.html table"
    requirement: "MAP-07"
    verification:
      - kind: unit
        ref: "test/unit/mapMarks.test.js#MARK_GLYPHS: exactly the nine expected keys, each with the CONTEXT-spec'd glyph and colour"
        status: pass
      - kind: unit
        ref: "test/unit/mapMarks.test.js#MARKS_LEGEND: 9 rows, in order, byte-identical name/desc to the old mazeworld.html table"
        status: pass
    human_judgment: false
  - id: D9
    description: "mapMarks.js: markForCell/legendFor map every engine feat (dot/tele/one/trap/chest/climb/gorge/exit/gate) to its glyph/legend row via the pure featureKeyForCell import, no PNG pipeline reference"
    requirement: "MAP-07"
    verification:
      - kind: unit
        ref: "test/unit/mapMarks.test.js#markForCell: maps every engine feat to its glyph/colour..."
        status: pass
      - kind: unit
        ref: "test/unit/mapMarks.test.js#mapMarks.js is pure and imports ONLY featureKeyForCell from icons.js (no preload/draw pipeline)"
        status: pass
    human_judgment: false
  - id: D10
    description: "Every new player-facing string (RAIL_COPY, RAIL_FAMILY titles, MARKS_LEGEND names/descs) passes the BANNED voice scan"
    verification:
      - kind: unit
        ref: "test/unit/rail.test.js#voice scan: every RAIL_COPY and RAIL_FAMILY string leaf is non-empty and clear of BANNED"
        status: pass
      - kind: unit
        ref: "test/unit/mapMarks.test.js#voice scan: every MARKS_LEGEND name/desc is non-empty and clear of BANNED"
        status: pass
    human_judgment: false

# Metrics
duration: ~25min
completed: 2026-09-17
status: complete
---

# Phase 35 Plan 01: RAIL, Tap-to-Step, and Map Marks Modules Summary

**Three pure presentation modules — `rail.js`'s event-family fold, `tapStep.js`'s dominant-axis step resolver, and `mapMarks.js`'s coloured-glyph palette — ready for the Wave 2-4 shell wiring, with 39 new tests and zero engine/content/parity/toasts.js/controls.js/icons.js edits.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-17T01:00:00Z (approx.)
- **Completed:** 2026-09-17T01:20:56Z
- **Tasks:** 2
- **Files modified:** 6 (all new: 3 modules, 3 test files)

## Accomplishments
- `src/browser/rail.js` — `railFamilyFor` covers every `TOAST_FOR` key (explicit icon/title/tone/hold family or the block/tone fallback), `rollLineFor` implements the generic roll-line rule (never fabricates dice), `railCardFor` folds any out-of-combat dispatch into one stacked card, and `emptyRail`/`railPush`/`railClear`/`railAnnouncement` give the rail its seq discipline and pending-decision slot.
- `src/browser/tapStep.js` — `resolveStep` is the "step toward a distant tap" function `controls.js` never had (dominant axis first, fallback axis, never a diagonal); `inspectCell` builds the four hold-inspect cards.
- `src/browser/mapMarks.js` — the canvas chrome palette, the seven CONTEXT glyph/colour pairs (plus wall/party), and the nine-row marks legend moved verbatim from `mazeworld.html`, proven byte-identical by test.
- 39 new tests across the three suites (15 + 24, exceeding every plan-specified minimum), all pure/`node --test`-only, no DOM.

## Task Commits

Each task was committed atomically:

1. **Task 1: `src/browser/rail.js` + `rail.test.js`** - `6f07aaf` (feat)
2. **Task 2: `src/browser/tapStep.js` + `src/browser/mapMarks.js` + their tests** - `d74bf92` (feat)

**Plan metadata:** (this commit) `docs: complete 35-01 plan`

## Files Created/Modified
- `src/browser/rail.js` - RAIL_TONES/RAIL_HOLD/RAIL_COPY/RAIL_FAMILY/RAIL_DIRECT + railFamilyFor/rollLineFor/railCardFor/railLineCard/emptyRail/railPush/railClear/railAnnouncement
- `src/browser/tapStep.js` - DIR_VECTORS/TAP_MAX_TRAVEL_PX/HOLD_MS + resolveStep/inspectCell
- `src/browser/mapMarks.js` - MAP_PALETTE/MARK_GLYPHS/MARK_SCALE/ONEWAY_ROTATION_DEG/MARKS_LEGEND + markForCell/legendFor
- `test/unit/rail.test.js` - 15 tests: family coverage over every TOAST_FOR key, RAIL_DIRECT subset proof, roll-line precedence, stacking/head/hold rules, push/clear/announcement seq, voice scan, purity
- `test/unit/tapStep.test.js` - 16 tests: here/step/blocked incl. dominant-axis/fallback/ties/out-of-grid, inspectCell's four cards, purity
- `test/unit/mapMarks.test.js` - 8 tests: glyph table completeness, legend move-verbatim proof, markForCell mapping for every engine feat, rotation table, voice scan, import-contract purity

## Decisions Made
- Orchestrator decisions 1, 3, and 4 (climb dice = no engine change / colored glyphs replace PNG marks / no PICK THE LOCK action) were implemented exactly as the plan specified — no deviation, no new open question.
- `railCardFor`'s internal line representation keeps an unexported `tone` field alongside `{text, roll, idx, priority, type}` so the head-line's family lookup can classify an event with no `RAIL_FAMILY` entry by its original toast tone; the exported `lines` array still strips down to `{text, roll}` per the plan's exact contract. This is an implementation detail needed to satisfy the plan's own "toneOf reads the folded entry's toast tone" requirement — not a scope change.

## Deviations from Plan

None - plan executed exactly as written. Every RAIL_FAMILY mapping, fallback rule, rollLineFor precedence case, resolveStep tie/fallback/blocked case, and mapMarks glyph/legend value matches the plan's behavior bullets and acceptance-criteria scripts verbatim (re-verified by running the plan's own `node -e` acceptance snippets against the finished modules).

## Issues Encountered
- Two literal-substring greps in the plan's acceptance criteria (`grep -c 'from "./toasts.js"'` must equal 1, and a separate `engine/` grep must equal 0) initially tripped on a header comment that mentioned `"./toasts.js"` and `window.__mzRail` in prose. Reworded the header comments to describe the import contract without repeating the literal import-string substring, and avoided the literal `engine/` substring anywhere in `rail.js` (including comments) — resolved in the same task, before commit, no separate fix commit needed.

## User Setup Required

None - no external service configuration required.

## Human verification (deferred to end of run)

No device check queued for this plan. Zero `mazeworld.html` lines touched, no DOM produced — `rail.js`, `tapStep.js`, and `mapMarks.js` are pure, `node --test`-importable modules with no browser surface of their own. Every behavior in this plan (family/tone/hold mapping, roll-line generation, card folding/stacking, tap-to-step direction resolution, hold-inspect cards, glyph/legend data) is covered by the 39 unit tests run above — nothing here needs a Pixel 7 pass. The shell wiring that gives these modules a screen (Plans 02-04: the rendered RAIL, the wired tap/hold pointer handlers, the canvas glyph draw path, the ⧗/▲/etc. glyph rendering on a real device) queues its own device-verification items in those plans' SUMMARYs; Plan 05 aggregates the whole phase's checklist for the single end-of-run Pixel 7 batch.

## Next Phase Readiness
- Plan 02 (shell RAIL wiring) can import `rail.js`'s `railCardFor`/`railPush`/`railAnnouncement`/`railLineCard` directly — the module's surface is exactly what the plan's `<artifacts_this_phase_produces>` block specified.
- Plan 03/04 (HUD/chips/canvas, tap-to-step + stair gate) can import `tapStep.js`'s `resolveStep`/`inspectCell`/`HOLD_MS` and `mapMarks.js`'s `MAP_PALETTE`/`MARK_GLYPHS`/`ONEWAY_ROTATION_DEG`/`markForCell` directly.
- No blockers. `npm test` is green at 2086/2086 (2047 baseline + 39 new); `git diff --stat -- engine content test/parity src/browser/toasts.js src/browser/controls.js src/browser/icons.js` is empty; the golden-master hash is confirmed unchanged (`a1f4d0dc29782218d8e5aab65bc5989c33f917f0`).

---
*Phase: 35-map-screen-rebuild*
*Completed: 2026-09-17*

## Self-Check: PASSED

All 7 created files (3 modules, 3 test files, this SUMMARY) confirmed present on disk; both task commits (`6f07aaf`, `d74bf92`) confirmed present in `git log`.
