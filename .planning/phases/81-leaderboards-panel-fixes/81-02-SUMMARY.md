---
phase: 81-leaderboards-panel-fixes
plan: 02
subsystem: ui
tags: [leaderboards, play-games, engine-records, boards-panel]

# Dependency graph
requires: []
provides:
  - "LEANEST removed everywhere in code: engine/records.js (BOARD_IDS, RANKED_BOARDS, compareRuns, boardValue, leanRate, the bests record), src/browser/boardScores.js (RETIRED_BOARDS, SUBMIT_BOARDS, SCORE_ORDER, boardScore, scoreFallback), src/browser/pgsQueue.js (sanitizeEntry), content/leaderboards.js, content/boards.js, src/browser/newBest.js, src/browser/globalBoards.js, src/browser/boardsView.js"
  - "RETIRED_BOARDS pattern: a frozen list of ids once submitted and now retired, subtracted from SUBMIT_BOARDS and consulted by pgsQueue's sanitizeEntry so an old queued entry's retired-board score/ack loads tolerantly and is never resubmitted"
  - "Tolerant sanitizeBests: a legacy ddr.bests.v1's lean list is silently dropped (no version bump); a run held only by it is pruned unless another ranked list or its lineage's ten best still hold it"
affects: [81-04, 81-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RETIRED_BOARDS = Object.freeze([...]) subtracted from a live board list (RANKED_BOARDS.filter) rather than hand-maintaining two lists in sync"

key-files:
  created: []
  modified:
    - src/browser/boardScores.js
    - src/browser/pgsQueue.js
    - content/leaderboards.js
    - engine/records.js
    - src/browser/newBest.js
    - src/browser/globalBoards.js
    - src/browser/boardsView.js
    - content/boards.js
    - test/unit/boardScores.test.js
    - test/unit/pgsQueue.test.js
    - test/unit/pgsQueue-flush.test.js
    - test/unit/records.test.js
    - test/unit/newBest.test.js
    - test/unit/bests-adapter.test.js
    - test/unit/globalBoards.test.js
    - test/unit/boardsView.test.js
    - test/unit/boards-copy.test.js
    - test/unit/boardsPanel.test.js
    - test/unit/boardsPanel-dom.test.js
    - test/unit/shell-boards-panel.test.js

key-decisions:
  - "SUBMIT_BOARDS is derived (RANKED_BOARDS.filter(b => !RETIRED_BOARDS.includes(b))) rather than hand-listed, so it stays correct across Task 1 (RANKED_BOARDS still 5-wide) and Task 2 (RANKED_BOARDS narrowed to 4) without a second edit"
  - "pgsQueue sanitizeEntry treats a RETIRED_BOARDS ack as a tolerant skip but any other unknown ack id still rejects the whole entry (fail-closed on garbage, fail-open only on a known-retired id)"
  - "engine/records.js sanitizeBests reads only RANKED_BOARDS keys from raw.boards, so a legacy lean list is never even inspected — dropped by omission, not by an explicit branch, with no version bump"

requirements-completed: [BOARD-17]

coverage:
  - id: D1
    description: "LEANEST is gone from the Play Games submission path: SUBMIT_BOARDS/SCORE_ORDER/boardScore/scoreFallback have no lean case, and no SUBMIT_BOARDS id maps to the retired Season-1 console id"
    requirement: "BOARD-17"
    verification:
      - kind: unit
        ref: "test/unit/boardScores.test.js#BOARD-17 concurrency: no SUBMIT_BOARDS id maps through leaderboardId to the retired Season-1 console id"
        status: pass
    human_judgment: false
  - id: D2
    description: "An old queued pgsQueue entry with a lean score/ack loads tolerantly (score dropped, ack skipped) and still submits its other boards"
    requirement: "BOARD-17"
    verification:
      - kind: unit
        ref: "test/unit/pgsQueue.test.js#BOARD-17 (a)/(b)/(c)/(d)"
        status: pass
      - kind: unit
        ref: "test/unit/pgsQueue-flush.test.js#BOARD-17: an old stored entry with a lean score and a lean ack submits the remaining boards, never a lean id"
        status: pass
    human_judgment: false
  - id: D3
    description: "LEANEST is gone from engine/records.js (BOARD_IDS, RANKED_BOARDS, compareRuns, boardValue, leanRate, emptyBests/sanitizeBests); an old ddr.bests.v1 lean list loads tolerantly and prunes a lean-only run"
    requirement: "BOARD-17"
    verification:
      - kind: unit
        ref: "test/unit/records.test.js#BOARD-17 boundary/empty/idempotency/precision + 'a run held only by the old lean list...is pruned'"
        status: pass
    human_judgment: false
  - id: D4
    description: "LEANEST is gone from the panel and global controller: no rail chip, BOARD_COPY entry, value/metric branch, global fallback cell or leanRateUnit copy remains"
    requirement: "BOARD-17"
    verification:
      - kind: unit
        ref: "test/unit/boardsView.test.js, test/unit/boards-copy.test.js, test/unit/boardsPanel-dom.test.js#rail: six .mw-bd-chip buttons"
        status: pass
    human_judgment: false
  - id: D5
    description: "Full suite green apart from the 7 known worktree-only CRLF doc-ledger failures; parity suite green with no fixture moved"
    verification:
      - kind: unit
        ref: "npm test (5652/5659 pass, 7 known CRLF failures in test/unit/class-pass-ledger.test.js and test/unit/flee-ledger.test.js)"
        status: pass
      - kind: unit
        ref: "node --test \"test/parity/**/*.test.js\" (49/49 pass)"
        status: pass
    human_judgment: false

duration: 40min
completed: 2026-09-25
status: complete
---

# Phase 81 Plan 02: Retire LEANEST (BOARD-17) Summary

**LEANEST (squares-per-floor) removed from every layer — Play Games submission, local records, the panel and the global controller — with old queued/stored data loading tolerantly and never resubmitting the retired board.**

## Performance

- **Duration:** 40 min
- **Tasks:** 2
- **Files modified:** 20

## Accomplishments
- `src/browser/boardScores.js` gained `RETIRED_BOARDS` (frozen, holding the one retired `lean` id) and `SUBMIT_BOARDS` is now derived as `RANKED_BOARDS` filtered by `RETIRED_BOARDS`, so it stays correct through both tasks without a second edit.
- `src/browser/pgsQueue.js#sanitizeEntry` drops a stored retired-board score (by only copying `SUBMIT_BOARDS` keys) and skips a retired-board ack tolerantly, while still rejecting any other unknown ack id.
- `content/leaderboards.js` lost the `lean` Season-1 console id — the one sanctioned edit to an older season's entry — so nothing can ever resolve to it via `leaderboardId`.
- `engine/records.js` narrowed `RANKED_BOARDS`/`BOARD_IDS`, deleted `leanRate` and the `lean` cases of `compareRuns`/`boardValue`, and `sanitizeBests` now silently ignores a legacy `boards.lean` list (no version bump) while `prune` releases any run held only by it.
- `src/browser/newBest.js`, `globalBoards.js` and `boardsView.js` lost every `lean` case (death-panel value text, the global board list, ranked-row value/metric, the global fallback cell) and the `leanRate` import.
- `content/boards.js` lost `BOARD_COPY.lean` and `BOARDS_PANEL_COPY.global.leanRateUnit`; the board rail now renders six chips instead of seven.

## Task Commits

Each task was committed atomically:

1. **Task 1: LEANEST out of the Play Games submission path, with tolerant loading of old queued entries** - `e61d170` (feat)
2. **Task 2: LEANEST out of the local records, the death panel's new-best line, the global controller and the panel** - `0ce3d09` (feat)

_Note: this SUMMARY.md and STATE.md are committed separately by the orchestrator after the wave completes (worktree execution)._

## Files Created/Modified
- `src/browser/boardScores.js` - `RETIRED_BOARDS`, derived `SUBMIT_BOARDS`, four-board `SCORE_ORDER`/`boardScore`/`scoreFallback`
- `src/browser/pgsQueue.js` - `sanitizeEntry` drops a retired-board score and skips a retired-board ack tolerantly
- `content/leaderboards.js` - `LEADERBOARD_IDS[1]` down to the four submitted boards
- `engine/records.js` - `RANKED_BOARDS`/`BOARD_IDS` narrowed, `leanRate` deleted, `compareRuns`/`boardValue`/`emptyBests`/`sanitizeBests` lose their `lean` case
- `src/browser/newBest.js` - `newBestValueText` loses its `lean` case
- `src/browser/globalBoards.js` - `GLOBAL_BOARDS` and the snapshot contract comment drop `lean`
- `src/browser/boardsView.js` - `valueText`/`metricFor`/`fallbackCell` lose their `lean` case, `leanRate` import removed
- `content/boards.js` - `BOARD_COPY.lean` and `BOARDS_PANEL_COPY.global.leanRateUnit` removed
- `test/unit/boardScores.test.js`, `pgsQueue.test.js`, `pgsQueue-flush.test.js`, `records.test.js`, `newBest.test.js`, `bests-adapter.test.js`, `globalBoards.test.js`, `boardsView.test.js`, `boards-copy.test.js`, `boardsPanel.test.js`, `boardsPanel-dom.test.js`, `shell-boards-panel.test.js` - four/six-board expectations throughout, new `RETIRED_BOARDS`/tolerant-load/boundary/idempotency tests

## Decisions Made
- `SUBMIT_BOARDS` derived from `RANKED_BOARDS.filter(b => !RETIRED_BOARDS.includes(b))` instead of a hand-written four-item list, so it read correctly as four boards in Task 1 even while `engine/records.js` still listed five (the plan's stated invariant).
- `sanitizeBests` drops a legacy `lean` list by simply never reading it (the per-board loop only iterates `RANKED_BOARDS`), not via an explicit delete branch — the minimal, least-surface tolerant-load implementation.
- One shell test (`shell-boards-panel.test.js` A2, not explicitly named in the plan's task list) also asserted a seven-chip rail; found and fixed as part of the same Rule 1 sweep since it directly regressed from the `BOARD_IDS` change.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a stale seven-chip rail assertion in shell-boards-panel.test.js**
- **Found during:** Task 2 (running the full `npm test` verification)
- **Issue:** `test("(A2) BEHAVIOUR: the rail carries all seven chips...")` asserted `chips.length === 7`, which regressed to a real failure once `BOARD_IDS` dropped to six entries. This test was not named in the plan's Task 2 file list or acceptance criteria, but it directly exercises the same `BOARD_IDS`-driven rail the plan's other rail tests cover.
- **Fix:** Updated the assertion to `chips.length === 6` and renamed the test to note LEANEST's retirement (BOARD-17).
- **Files modified:** test/unit/shell-boards-panel.test.js
- **Verification:** `node --test test/unit/shell-boards-panel.test.js` — 23/23 pass
- **Committed in:** 0ce3d09 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug)
**Impact on plan:** The fix keeps the shell's rail test suite honest with the panel's new six-board list; no scope creep beyond aligning one incidental assertion the code change already broke.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 81's remaining plans (81-01 debug, 81-03 docs, 81-04 panel restructure, 81-05 reconciliation, 81-06 global boards fixes) are unaffected by this plan's scope; 81-03 still owns updating `docs/PLAY-GAMES-SETUP.md` §13, `docs/RELEASING.md` and `store-listing/LISTING.md` for the LEANEST retirement, and 81-04 finalizes `BOARD_IDS`'s tab order (deep, days, kills, purse, combo) on top of this plan's six-board list.
- No blockers: the engine gate holds (parity suite green, no fixture moved, no file owned by Phase 72's in-flight plan touched), and no code path can submit to or read the retired LEANEST id.

---
*Phase: 81-leaderboards-panel-fixes*
*Completed: 2026-09-25*

## Self-Check: PASSED

- FOUND: src/browser/boardScores.js
- FOUND: engine/records.js
- FOUND: .planning/phases/81-leaderboards-panel-fixes/81-02-SUMMARY.md
- FOUND: commit e61d170 (Task 1)
- FOUND: commit 0ce3d09 (Task 2)
- FOUND: commit 1d8bd01 (SUMMARY.md)
