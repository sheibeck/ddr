---
phase: 84-leaderboards-panel-v3
plan: 02
subsystem: content
tags: [content-bank, voice-corpus, safety-scan, hp-not-wp, leaderboards]

# Dependency graph
requires:
  - phase: 84-leaderboards-panel-v3 (84-01)
    provides: "the note/when run-doc contract and rankKeyOf(stat, run) — LEADERBOARD_COPY.stats keys mirror runDoc.js#BOARD_STATS order"
provides:
  - "LEADERBOARD_COPY (content/boards.js) — every word the v3 Leaderboards panel shows, deep-frozen, verbatim-pinned to the mock plus the CONTEXT area-1 in-voice loading/stale/unreachable notes"
  - "SEASON_NAMES (content/season.js) — {1: \"Season of the Alpha\"}, SEASON stays the integer key"
  - "test/unit/leaderboard-copy.test.js — the pin suite (shape, verbatim strings, stat key order, token allowlist, no markup/WP/handle marker)"
  - "both banks registered in the voice-corpus BANK_REGISTRY, the safety-scan authored-string walk and the hp-not-wp content-bank walk"
affects: [84-05, 84-06, 84-07, 84-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "LEADERBOARD_COPY is additive alongside the retiring old-panel banks (BOARD_COPY/BOARDS_PANEL_COPY/etc.) in the same content/boards.js file, so both panels build and test green until 84-08 switches the shell and 84-09 retires the old exports"

key-files:
  created:
    - test/unit/leaderboard-copy.test.js
  modified:
    - content/boards.js
    - content/season.js
    - tools/lib/voice-corpus.mjs
    - test/voice/safety-scan.test.js
    - test/unit/hp-not-wp.test.js

key-decisions:
  - "The mock has no loading/stale/unreachable states and no unfiltered ('this season') empty lines — those nine LEADERBOARD_COPY.state.* and two LEADERBOARD_COPY.empty.*All strings are Claude's Discretion per CONTEXT area 1, written in house voice and proved against the same voice-corpus/safety-scan/hp-not-wp tests as every mock-verbatim string"
  - "LEADERBOARD_COPY.stats key order (deep, days, kills, purse) is pinned equal to src/browser/runDoc.js#BOARD_STATS (84-01's rankKeyOf dispatch order), not re-derived, so the two banks can never drift apart silently"
  - "back: \"Back\" is an accessibility label the mock renders only as a ◀ glyph (&#9664;) — kept because the plan's <action> names it explicitly as part of the copy bank"

requirements-completed: []  # BOARD-18/24/25/27 are in this plan's frontmatter `requirements` field but NONE are marked complete in REQUIREMENTS.md — per the 84-01-PLAN.md phase source-audit table, this plan is not the last deliverer for any of the four (BOARD-18 needs 84-08, BOARD-24 needs 84-06, BOARD-25 needs 84-08, BOARD-27 needs 84-08). See "Requirement Coverage" below.

coverage:
  - id: D1
    description: "LEADERBOARD_COPY exports every word the v3 panel shows (title/scope/box/back/seasonFallback/pick/stats/sheet/line/empty/divider/you/standing/state/chips/died/months/foe/sep/dock), deep-frozen with every leaf a non-empty string, pinned verbatim to the mock where the mock has copy"
    requirement: "BOARD-18"
    verification:
      - kind: unit
        ref: "test/unit/leaderboard-copy.test.js — shape (deep-frozen, non-empty leaves), months array, verbatim mock pins for title/scope/box/pick/empty/divider/standing/sheet/line/you/back/seasonFallback/sep/foe/died/dock, no markup/WP/handle marker"
        status: pass
    human_judgment: false
  - id: D2
    description: "LEADERBOARD_COPY.stats carries the four ranked-board stat labels/units/colours/rule lines (deep/days/kills/purse) in the exact order runDoc.js#BOARD_STATS uses"
    requirement: "BOARD-24"
    verification:
      - kind: unit
        ref: "test/unit/leaderboard-copy.test.js — stats key-order-equals-BOARD_STATS test, per-stat label/unit/col/rule pin test"
        status: pass
    human_judgment: false
  - id: D3
    description: "The nine CONTEXT-area-1 in-voice LEADERBOARD states (loading, unreachable + SEE YOUR DEAD, stale + four age-phrase leaves) and the two unfiltered empty-board/empty-mine lines are written and pinned"
    requirement: "BOARD-25"
    verification:
      - kind: unit
        ref: "test/unit/leaderboard-copy.test.js — state.* and empty.boardAll/mineAll verbatim pin test"
        status: pass
    human_judgment: false
  - id: D4
    description: "SEASON_NAMES exports {1: \"Season of the Alpha\"} next to SEASON in content/season.js; SEASON stays the integer 1; LEADERBOARD_COPY.seasonFallback provides the {n}-token fallback for an unnamed season id"
    requirement: "BOARD-27"
    verification:
      - kind: unit
        ref: "test/unit/leaderboard-copy.test.js — SEASON_NAMES frozen/value/SEASON test"
        status: pass
    human_judgment: false
  - id: D5
    description: "LEADERBOARD_COPY and SEASON_NAMES are registered in the voice-corpus BANK_REGISTRY, the safety-scan authored-string walk and the hp-not-wp content-bank walk, so the new copy is part of the audited corpus going forward"
    verification:
      - kind: unit
        ref: "node --test test/unit/voice-corpus.test.js test/voice/safety-scan.test.js test/unit/hp-not-wp.test.js — 52/52 pass"
        status: pass
    human_judgment: false

# Metrics
duration: 22min
completed: 2026-09-29
status: complete
---

# Phase 84 Plan 02: LEADERBOARD_COPY and SEASON_NAMES Summary

**Every word the Leaderboards panel v3 shows — title/scope/box/pickers/four ranked stats/sheets/empty states/standing card/in-voice loading-stale-unreachable notes/chips/dock — now lives as one deep-frozen content bank (LEADERBOARD_COPY), plus the season-name table (SEASON_NAMES) under the LEADERBOARD title, both wired into the voice/safety/HP-not-WP audit corpus**

## Performance

- **Duration:** 22 min
- **Started:** 2026-09-29T08:25:00-04:00 (approx, first file read)
- **Completed:** 2026-09-29T08:47:00-04:00
- **Tasks:** 2
- **Files modified:** 6 (1 created, 5 modified)

## Accomplishments
- `content/boards.js`: `LEADERBOARD_COPY` appended after the old-panel banks — deep-frozen, every leaf a non-empty string, verbatim-pinned to the v3 mock (`design/Mazeworld Boards Panel v3.dc.html`) for title/scope/box/pickers/the four `stats` (deep/days/kills/purse, ordered to match `runDoc.js#BOARD_STATS`)/sheet labels/empty states/divider/standing card/dock, plus the CONTEXT area-1 in-voice loading/stale/unreachable notes as Claude's Discretion
- `content/season.js`: `SEASON_NAMES = Object.freeze({1: "Season of the Alpha"})` added next to `SEASON`, which stays the integer key everywhere else
- `test/unit/leaderboard-copy.test.js`: 16 tests pinning shape, every verbatim mock string, the `stats` key order against `runDoc.js#BOARD_STATS`, the closed token-carrying-leaf allowlist, and the no-markup/no-WP/no-@ guard
- `tools/lib/voice-corpus.mjs`, `test/voice/safety-scan.test.js`, `test/unit/hp-not-wp.test.js`: both new banks registered/walked the same way every other `content/boards.js` bank is
- `npm test`: 8333 pass / 2 skipped / 0 fail; `engine/` and `test/parity/` untouched (`git status --porcelain` empty)

## Task Commits

Each task was committed atomically:

1. **Task 1: LEADERBOARD_COPY and SEASON_NAMES, pinned by test/unit/leaderboard-copy.test.js** - `2926f76e` (feat)
2. **Task 2: register the new banks in the voice corpus, the safety scan and the HP-not-WP walk** - `ad7d165b` (feat)

_No TDD RED/GREEN split commit boundary — Task 1 is `tdd="true"`; the RED test file (test/unit/leaderboard-copy.test.js) was written and run first (confirmed failing: `LEADERBOARD_COPY` export did not exist), then the GREEN implementation (content/boards.js, content/season.js) landed together with the already-written test in a single `2926f76e` commit, matching 84-01's precedent for this plan set._

## Files Created/Modified
- `content/boards.js` - `LEADERBOARD_COPY` bank appended; old exports (`BOARD_COPY`, `BOARDS_PANEL_COPY`, `STANDING_LINES`, `GLOBAL_STANDING_LINES`, `NEW_BEST_*`, `BOARD_FOOTNOTES`, `FIRST_DEATH_LINES`) byte-identical
- `content/season.js` - `SEASON_NAMES` added; `SEASON` unchanged
- `test/unit/leaderboard-copy.test.js` - new pin suite (16 tests)
- `tools/lib/voice-corpus.mjs` - two new `BANK_REGISTRY` rows (surface `"boards"`)
- `test/voice/safety-scan.test.js` - `LEADERBOARD_COPY`/`SEASON_NAMES` join the authored-string walk
- `test/unit/hp-not-wp.test.js` - `LEADERBOARD_COPY`/`SEASON_NAMES` join the content-bank walk

## Decisions Made
- The nine `state.*` in-voice notes and the two `empty.*All` lines are Claude's Discretion (the mock has no loading/stale/unreachable states and no unfiltered empty line) — written in house voice, verified by the same corpus tests as every mock-verbatim string, not called out separately since they carry no lower bar
- `stats` key order is pinned equal to `src/browser/runDoc.js#BOARD_STATS` (not independently authored), so the copy bank and the rank-key dispatcher from 84-01 can never silently diverge
- `back: "Back"` is included as an accessibility label even though the mock only renders a `◀` glyph, per the plan's explicit `<action>` key list

## Deviations from Plan
None - plan executed exactly as written. Both tasks' acceptance criteria (grep pins, test exit codes, `npm test`, engine/parity untouched) passed on first implementation with no auto-fixes needed.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Human verification (deferred to end of run)

None. This plan ships content data only (no UI surface reads it yet — that is 84-05/84-06); all claims are proven by automated unit tests (`node --test test/unit/leaderboard-copy.test.js test/unit/boards-copy.test.js test/determinism/content-is-pure-data.test.js test/unit/voice-corpus.test.js test/voice/safety-scan.test.js test/unit/hp-not-wp.test.js`) and a full `npm test` run (8333/8335, 2 pre-existing skips).

## Requirement Coverage

This plan's frontmatter lists `requirements: [BOARD-18, BOARD-24, BOARD-25, BOARD-27]`, but none are marked complete in `REQUIREMENTS.md`. Per the phase source-audit table in `84-01-PLAN.md`, this plan is not the last deliverer for any of the four: BOARD-18 also needs 84-05/84-06/84-07/84-08, BOARD-24 also needs 84-05/84-06, BOARD-25 also needs 84-04/84-05/84-07/84-08, BOARD-27 also needs 84-05/84-08. This plan delivers the copy layer (`LEADERBOARD_COPY`, `SEASON_NAMES`) those later UI plans consume — partial coverage, correctly left `[ ]` pending.

## Next Phase Readiness
- `LEADERBOARD_COPY` and `SEASON_NAMES` are live, tested and audit-registered — 84-05 (the pure view model) and 84-06 (the renderer) can now import every string they need with zero copy of their own.
- The old panel's exports are untouched, so the old panel keeps building and passing its own tests until 84-08 switches the shell.
- No blockers for 84-03 through 84-09.

---
*Phase: 84-leaderboards-panel-v3*
*Completed: 2026-09-29*

## Self-Check: PASSED

All 6 modified/created files verified present on disk (content/boards.js, content/season.js, test/unit/leaderboard-copy.test.js, tools/lib/voice-corpus.mjs, test/voice/safety-scan.test.js, test/unit/hp-not-wp.test.js); both task commits (`2926f76e`, `ad7d165b`) verified present in `git log`.
