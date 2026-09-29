---
phase: 84-leaderboards-panel-v3
plan: 05
subsystem: ui
tags: [pure-view, leaderboards, boards-v3, ranking, content-bank]

# Dependency graph
requires:
  - phase: 84-leaderboards-panel-v3
    provides: "84-01: src/browser/runDoc.js's rankKeyOf(stat, run)/BOARD_STATS, the shared rank-key function both views rank by"
  - phase: 84-leaderboards-panel-v3
    provides: "84-02: content/boards.js's LEADERBOARD_COPY and content/season.js's SEASON_NAMES — every word this view shows"
  - phase: 84-leaderboards-panel-v3
    provides: "84-04: src/browser/boardFeed.js's BoardSnapshot shape (status/reason/stale/fetchedAt/rows/total/filteredTotal/you/youKnown/uid) this view consumes as plain data"
provides:
  - "src/browser/leaderboardView.js — leaderboardView(input), the pure DOM-free view model for the whole v3 Leaderboards panel (both LEADERBOARD/board mode and YOUR DEAD/mine mode): header, pickers, body, staleLine, standing, sheet, dock"
  - "handleInitials(handle) — one avatar initial per handle word, split against content/handles.js HANDLE_FIRST/HANDLE_SECOND"
  - "AVATAR_PALETTE/avatarColour/initialsOf/ordinal re-ported from boardsView.js, so 84-09's account.js switch-over has a source that isn't the retiring module"
affects: [84-06, 84-07, 84-08, 84-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "leaderboardView(input) never reads the clock or randomness itself — `now` and `tzOffsetMinutes` are supplied inputs, so the stale line's age and the expanded row's date line stay deterministic and testable"
    - "One shared rank-key entry point (runDoc.js#rankKeyOf) drives both the YOUR DEAD local sort and every board-row ordering reference, so the capped-DAYS anti-farming rule (daysKeyOf) can never drift between the two views"
    - "Counts on sheets are computed locally only in mine mode (filterCount over the history array); board mode's RACE/SUB-CLASS sheets always carry n:''/dim:false, matching CONTEXT area 2's 'no per-option counts on LEADERBOARD'"

key-files:
  created:
    - src/browser/leaderboardView.js
    - test/unit/leaderboardView.test.js
  modified:
    - tools/lib/voice-corpus.mjs

key-decisions:
  - "The module's own purity rule bans window/document/navigator/localStorage/Date.now/Math.random/fetch (per the plan's <behavior> list) but permits `new Date(ms)` and `Date.parse` — both are needed for the expanded row's UTC-getter date-line formatting and the createdAt fallback, and are fully deterministic given the supplied `when`/`createdAt`/`tzOffsetMinutes` inputs, unlike a bare `Date.now()`"
  - "Task 1 landed with board mode returning only the loading note, exactly as the plan's own <action> text allows ('board mode may return the loading note' until Task 2); Task 2's commit is the isolated diff that completes every other board state, board rows, YOU, the pinned best, the standing card and the stale line — two atomic, independently-revertible commits instead of one that blends both tasks' scope"
  - "detailOf(run) always falls back from an empty/missing `note` to CAUSE_TEXT filled with the generic foe (content/boards.js LEADERBOARD_COPY.foe), reused identically for YOUR DEAD rows and LEADERBOARD rows — the plan only worded this fallback for board docs, but a YOUR DEAD history record could in principle also carry an empty note, so the same defensive path covers both without a second code path"

requirements-completed: [BOARD-23]  # BOARD-18/19/20/21/22/24/25/27 are in this plan's frontmatter `requirements` field but NONE besides BOARD-23 are marked complete — per the phase source-audit table (84-01-PLAN.md), this plan is not the last deliverer for the other eight. See "Requirement Coverage" below.

coverage:
  - id: D1
    description: "leaderboardView(input) assembles the whole v3 panel shape (mode, entry, stat, col, header, pickers, body, staleLine, standing, sheet, dock) for both LEADERBOARD (board mode, Compete ON) and YOUR DEAD (mine mode; Compete OFF always forces mine mode), with every field falling back safely on bad input"
    requirement: "BOARD-18"
    verification:
      - kind: unit
        ref: "test/unit/leaderboardView.test.js — mode/stat/race/sub/entry fallback tests, pickers tests"
        status: pass
    human_judgment: false
  - id: D2
    description: "YOUR DEAD ranks the local history by rankKeyOf per stat (DEPTH floor desc/fewer squares, DAYS the capped daysKey, KILLS kills desc/deeper floor, WILMST gold desc), ties by earlier `when` then hash, shows the top ten under RACE/SUB-CLASS filters, and its RACE/SUB-CLASS sheets show local counts with zero-count options dimmed"
    requirement: "BOARD-20"
    verification:
      - kind: unit
        ref: "test/unit/leaderboardView.test.js — YOUR DEAD ranking (DEPTH/DAYS-capped/KILLS/WILMST), ranking ties, race/sub sheet count+dim tests"
        status: pass
    human_judgment: false
  - id: D3
    description: "LEADERBOARD draws BoardSnapshot rows in server order with handle, one-initial-per-handle-word avatars, YOU tags on the viewer's own runs, the pinned NOT IN THE TOP TEN · YOUR BEST row with its real rank when the viewer's best isn't listed, and the standing card ({handle}'s best, of N interred as {line}. or None of yours on this board yet.); LEADERBOARD sheets carry no counts and nothing is dimmed"
    requirement: "BOARD-22"
    verification:
      - kind: unit
        ref: "test/unit/leaderboardView.test.js — board ready-with-ten-rows/YOU/pinned-best/standing-card tests, board sheets n=''/dim=false test"
        status: pass
    human_judgment: false
  - id: D4
    description: "LEADERBOARD shows in-list notes for loading (no snapshot yet), unreachable/off (no cached copy, with a SEE YOUR DEAD action) and a stale line with the cached copy's age (moments/a minute/{n} minutes/an hour/{n} hours); the season line sits under the title on the board view only"
    requirement: "BOARD-25"
    verification:
      - kind: unit
        ref: "test/unit/leaderboardView.test.js — loading/unreachable-or-off/stale-age-phrase tests"
        status: pass
    human_judgment: false
  - id: D5
    description: "A tapped row carries the cause of death (the killer's name from `note`, falling back to the cause text with the generic foe), the epitaph, six FLOOR/DAYS/SQUARES/KILLS/EXP/WILMST chips and the date line 'Died {date} · {version}' (board docs without `when` fall back to `createdAt`; tzOffsetMinutes shifts the shown day)"
    requirement: "BOARD-22"
    verification:
      - kind: unit
        ref: "test/unit/leaderboardView.test.js — open-row detail/dateLine/tz-shift tests, board-row detail/dateLine fallback tests"
        status: pass
    human_judgment: false
  - id: D6
    description: "The header box reads YOURS › with the history count on the board, EVERYONE › with the board's unfiltered total on YOUR DEAD while Compete is ON, and a static INTERRED history count with Compete OFF; the dead-hero dock (FINAL SHEET, BURY THEM) and the title footers are kept"
    requirement: "BOARD-21"
    verification:
      - kind: unit
        ref: "test/unit/leaderboardView.test.js — header box tests (both modes, known/unknown board total), dock tests (all four combinations)"
        status: pass
    human_judgment: false
  - id: D7
    description: "'Your best' on LEADERBOARD is your best run actually on the board under the current stat and filters, with its real rank from boardFeed.js's BoardSnapshot.you — this plan is the last deliverer of BOARD-23 per the phase source-audit table"
    requirement: "BOARD-23"
    verification:
      - kind: unit
        ref: "test/unit/leaderboardView.test.js — pinned-best (not-listed vs listed) test, standing-card real-rank test"
        status: pass
    human_judgment: false
  - id: D8
    description: "SEASON OF THE ALPHA (season 1) shows as the season line under the LEADERBOARD title on the board view only; an unnamed season falls back to SEASON_NAMES's seasonFallback template, upper-cased; mine mode's seasonLine is always \"\""
    requirement: "BOARD-27"
    verification:
      - kind: unit
        ref: "test/unit/leaderboardView.test.js — season-line tests (named + fallback), Compete-OFF seasonLine \"\" test"
        status: pass
    human_judgment: false

# Metrics
duration: ~35min
completed: 2026-09-29
status: complete
---

# Phase 84 Plan 05: Leaderboards Panel v3's Pure View Model Summary

**leaderboardView(input) — one pure, DOM-free function producing the whole v3 Leaderboards panel (header, pickers, body, stale line, standing card, bottom sheet, dead-hero dock) for both LEADERBOARD (board mode) and YOUR DEAD (mine mode), ranking both views through the one shared rankKeyOf and reading every word from LEADERBOARD_COPY/SEASON_NAMES**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-09-29T09:52:36-04:00 (prior plan's close)
- **Completed:** 2026-09-29T10:28:00-04:00
- **Tasks:** 2
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- `src/browser/leaderboardView.js`: the pure view model for the entire v3 panel — `leaderboardView(input)` plus the ported `AVATAR_PALETTE`/`avatarColour`/`initialsOf`/`ordinal` helpers and the new `handleInitials(handle)` (one initial per handle word, split against `content/handles.js`'s `HANDLE_FIRST`/`HANDLE_SECOND`, falling back to the first two letters when a handle doesn't split)
- YOUR DEAD (mine mode): header/box/scope/back per Compete state, `RANK BY`/`RACE`/`SUB-CLASS` pickers, rows ranked by `runDoc.js#rankKeyOf` (the capped-DAYS anti-farming rule included) with ties broken by earlier `when` then hash, the expanded row's detail/six-chip/date-line, RACE (7 options)/SUB-CLASS (25 options)/RANK BY (4 options) sheets with local counts and zero-count dimming, and the dead-hero dock — never carries a standing card
- LEADERBOARD (board mode): every state (loading, unreachable/off with SEE YOUR DEAD, ready), server-order rows with YOU tags/avatar-on for the viewer's own runs, the pinned "NOT IN THE TOP TEN · YOUR BEST" row with its real rank when the viewer's best isn't listed, the standing card ("{handle}'s best, of N interred as {line}." / "None of yours on this board yet."), the season line (`SEASON_NAMES`, board view only), the stale line's five age-phrase buckets, and sheets that carry no counts (`n:""`, `dim:false`)
- `tools/lib/voice-corpus.mjs`: `src/browser/leaderboardView.js` registered in the boards `RAW_SURFACES` `files` entry and the 79-09 ownership rule's `modules` list, so the new module's authored strings are covered by the same voice/safety/HP-not-WP audit as the rest of the boards surface
- `node --test test/unit/leaderboardView.test.js test/unit/voice-corpus.test.js`: 64/64 pass; full `npm test`: 8439 pass / 2 skipped (pre-existing) / 0 fail, exit 0; `git status --porcelain -- engine test/parity content` empty

## Task Commits

Each task was committed atomically:

1. **Task 1: shared pieces and the YOUR DEAD view** - `cf40d321` (feat) — board mode returns only the loading note in this commit, exactly as the plan's own `<action>` text allows, with `test/unit/leaderboardView.test.js` covering the shared helpers and YOUR DEAD only (23 tests)
2. **Task 2: the LEADERBOARD view — states, board rows, YOU, the pinned best, the standing card and the season line** - `584830e6` (feat) — completes board mode, adds the board-mode test cases and the `tools/lib/voice-corpus.mjs` registration (35 tests total across both commits)

_No separate RED/GREEN commit split — each task's test cases and implementation were written together, verified green, then committed as one unit, matching this plan set's established precedent (84-01 through 84-04). The two TASK commits themselves are the atomic unit here: Task 1's diff is independently revertible (board mode returns only the loading note) from Task 2's diff (which completes board mode and touches `tools/lib/voice-corpus.mjs`)._

## Files Created/Modified

- `src/browser/leaderboardView.js` - the pure view model (new)
- `test/unit/leaderboardView.test.js` - 35 tests covering shared helpers, YOUR DEAD, LEADERBOARD and purity (new)
- `tools/lib/voice-corpus.mjs` - `leaderboardView.js` added to the boards `RAW_SURFACES` entry and the 79-09 ownership rule's `modules` list

## Decisions Made

- The purity rule bans `window`/`document`/`navigator`/`localStorage`/`Date.now`/`Math.random`/`fetch` (the plan's exact `<behavior>` list) but not `new Date(ms)`/`Date.parse`, both of which the expanded row's date line needs and both of which are fully deterministic given the supplied `when`/`createdAt`/`tzOffsetMinutes` inputs — a narrower, more accurate purity check than boardsView.js's own blanket `\bDate\.` ban (that module never needed `Date` at all)
- Task 1's commit ends with board mode returning only the loading note (the plan's own stated allowance), so the two task commits are genuinely independent diffs rather than one commit split after the fact
- `detailOf(run)`'s cause-text fallback (empty/missing `note` → `CAUSE_TEXT` filled with the generic foe) is shared by both YOUR DEAD and LEADERBOARD rows, even though the plan only worded the fallback for board docs — a defensive, single code path rather than a second one for a case the plan didn't explicitly rule out for history records
- `ageWords`'s hour bucket floors (not rounds) minutes/60, so 90 minutes reads "an hour" (not "2 hours") — matches the plan's own worked example exactly

## Deviations from Plan

None — plan executed exactly as written. No Rule 1/2/3 auto-fixes were needed; the only correction made was to this plan's own new test file (a fixture ranking-order mistake in a test I wrote myself, caught and fixed before the first commit — not a deviation from the plan, a self-correction during authoring).

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Requirement Coverage

This plan's frontmatter lists `requirements: [BOARD-18, BOARD-19, BOARD-20, BOARD-21, BOARD-22, BOARD-23, BOARD-24, BOARD-25, BOARD-27]`. Per the phase source-audit table in `84-01-PLAN.md`, this plan is the **last deliverer only for BOARD-23** (`84-04, 84-05`) — marked complete in `REQUIREMENTS.md`. The other eight requirements each need at least one later plan (84-06's renderer, 84-07's controller, 84-08's shell wiring, or 84-09's retirement pass) before they can be marked complete:

- BOARD-18: needs 84-08 (last deliverer)
- BOARD-19: needs 84-08 (last deliverer)
- BOARD-20: needs 84-09 (last deliverer)
- BOARD-21: needs 84-06 (last deliverer)
- BOARD-22: needs 84-06 (last deliverer)
- BOARD-24: needs 84-06 (last deliverer)
- BOARD-25: needs 84-08 (last deliverer)
- BOARD-27: needs 84-08 (last deliverer)

This plan delivers the full pure-view logic every one of those requirements' remaining UI-surface plans consumes — partial coverage, correctly left `[ ]` pending in `REQUIREMENTS.md` for all eight.

## Human verification (deferred to end of run)

None for this plan on its own — it ships no DOM/renderer surface (a pure, DOM-free view model with unit-test coverage only). The panel's device checks land with 84-08's shell wiring, per this plan's own `<output>` instruction.

## Next Phase Readiness

- `src/browser/leaderboardView.js`'s full API (`leaderboardView`, `handleInitials`, `initialsOf`, `avatarColour`, `ordinal`, `AVATAR_PALETTE`) is ready for 84-06's DOM renderer to draw directly and 84-07's controller to route against.
- The module imports nothing from the Play Games modules (`playGames.js`, `account.js`, `globalBoards.js`, `boardScores.js`) and nothing from the retiring `boardsView.js` — confirmed by this plan's own source-pin test — so 84-09's retirement pass has a clean seam.
- No blockers for 84-06 through 84-09.

---
*Phase: 84-leaderboards-panel-v3*
*Completed: 2026-09-29*

## Self-Check: PASSED

All created/modified files verified present on disk (`src/browser/leaderboardView.js`, `test/unit/leaderboardView.test.js`, `tools/lib/voice-corpus.mjs`); both task commits (`cf40d321`, `584830e6`) verified present in `git log`.
