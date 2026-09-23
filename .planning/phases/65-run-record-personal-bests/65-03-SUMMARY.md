---
phase: 65-run-record-personal-bests
plan: 03
subsystem: content
tags: [voice, presentation, view-model, safety-scan]

# Dependency graph
requires: []
provides:
  - "content/boards.js — BOARD_COPY (voice half of the shared board table), NEW_BEST_HEAD, NEW_BEST_LINES, FIRST_DEATH_LINES"
  - "src/browser/newBest.js — newBestView(report), newBestValueText(board, summary), the pure death-panel view model"
affects: [65-04, 65-05, 66-leaderboards-panel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "content/boards.js is a direct import (not in content/index.js), following src/browser/*.js and engine/difficulty.js precedent — Plan 65-04 owns the barrel"
    - "Deterministic quip rotation keyed by the run's 8-hex-char hash (parseInt/>>>0 % bank.length), mirroring missLines.js's caller-supplied-counter rotation but keyed off a stable hash instead of a sequence counter"

key-files:
  created:
    - content/boards.js
    - src/browser/newBest.js
    - test/unit/newBest.test.js
  modified:
    - test/voice/safety-scan.test.js

key-decisions:
  - "BOARD_COPY key order (deep, lean, combo, days, kills, purse, yard) doubles as the row-ordering source for newBestView — Object.keys(BOARD_COPY) drives both the mock's tab order and the announcement's row order, so there is exactly one place that order lives"
  - "A missing/malformed summary.hash (not /^[0-9a-f]{8}$/) picks bank index 0 rather than throwing or defaulting to a random pick, per the plan's <action> spec"

requirements-completed: [RUN-04]

coverage:
  - id: D1
    description: "content/boards.js exports BOARD_COPY (7 boards, tab/title/rule/unit/unitOne), NEW_BEST_HEAD, 8 NEW_BEST_LINES and 3 FIRST_DEATH_LINES as pure data, wired into the safety scan"
    requirement: RUN-04
    verification:
      - kind: unit
        ref: "node --test test/voice/safety-scan.test.js test/determinism/content-is-pure-data.test.js"
        status: pass
    human_judgment: false
  - id: D2
    description: "newBestView(report) turns a death report into null (silence), a first-death line, or a NEW PERSONAL BEST block with ordered rows and one deterministic quip; newBestValueText formats every board's value column"
    requirement: RUN-04
    verification:
      - kind: unit
        ref: "test/unit/newBest.test.js (13 test() calls covering every <behavior> bullet, TDD RED 87f9dd5 -> GREEN 74308c0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Voice read-through of BOARD_COPY rule lines and both quip banks (tone/taste, not a correctness check)"
    verification: []
    human_judgment: true
    rationale: "Deadpan-voice fit is a taste call the safety scan and unit tests cannot make; deferred to the end-of-run UAT batch per project_notes"

# Metrics
duration: 25min
completed: 2026-09-23
status: complete
---

# Phase 65 Plan 03: New-Best Announcement Voice & View Model Summary

**The board copy half of the shared board table plus a pure, hash-deterministic view model that turns a death report into a silent no-op, a first-death line, or an ordered NEW PERSONAL BEST block — all safety-scanned before any shell wiring exists.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-09-23T20:03:00Z
- **Completed:** 2026-09-23T20:28:23Z
- **Tasks:** 2
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments
- `content/boards.js`: `BOARD_COPY` (deep/lean/combo/days/kills/purse/yard, each with `tab`/`title`/`rule`/`unit`[/`unitOne`]), `NEW_BEST_HEAD`, 8 `NEW_BEST_LINES`, 3 `FIRST_DEATH_LINES` — pure data, not in the `content/index.js` barrel (Plan 65-04 owns that)
- `test/voice/safety-scan.test.js` wired to scan every new string via a recursive `BOARD_COPY` walk plus the two quip banks, participating in both allowlist meta-tests
- `src/browser/newBest.js`: `newBestView(report)` and `newBestValueText(board, summary)`, a pure ES module with exactly one import (`content/boards.js`), no `Math.random`, no `document`
- `test/unit/newBest.test.js`: 13 tests covering every `<behavior>` bullet (null/silence cases, first-death, several-boards ordering, value formatting per board, unknown-id skipping, malformed-hash fallback, determinism, no-WP scan, purity source-scan)
- TDD RED→GREEN followed exactly: `test(65-03)` commit with a module-not-found failure, then `feat(65-03)` implementing the module to green

## Final Copy (verbatim, for voice review)

### BOARD_COPY

| id | tab | title | rule | unit | unitOne |
|---|---|---|---|---|---|
| deep | DEEPEST | DEEPEST DESCENT | Deepest floor reached. Ties go to whoever wasted fewer squares getting there. | floor | — |
| lean | LEANEST | DEEPEST, FEWEST STEPS | Deepest floor for the fewest squares walked. Efficient, right up to the end. | sq | — |
| combo | LINEAGE | BY RACE & CLASS | Your best run for each race and class. Every lineage ends; some end lower. | floor | — |
| days | LONGEST | LONGEST HELD OUT | Most days survived. Endurance is just losing slowly. | days | day |
| kills | BUTCHERY | MOST KILLS | Most monsters put down before the dungeon returned the favor. | kills | kill |
| purse | PURSE | RICHEST CORPSE | Most wilmst on the body at the end. You cannot take it with you. You tried. | wilmst | — |
| yard | GRAVEYARD | YOUR GRAVEYARD | Everyone you have rolled and lost, deepest first. Not ranked. Nobody here won. | floor | — |

### NEW_BEST_HEAD

> NEW PERSONAL BEST

### NEW_BEST_LINES (8)

1. New personal best. The dungeon has adjusted its expectations of you, slightly.
2. A record. It goes on the stone, just under the part where you died.
3. Your finest failure yet. The bar was low, and you cleared it lying down.
4. Personal best. The previous record holder was also you, and also dead.
5. Congratulations. You have never lost this well before.
6. The ledger notes an improvement. It is not impressed, but it notes it.
7. A new high in a long career of lows. Frame it.
8. Best run yet. Your next adventurer now has something to fall short of.

### FIRST_DEATH_LINES (3)

1. First corpse on the books. Every record is yours, for now.
2. The ledger opens with you. Someone had to go first.
3. One death, one entry, every record. Enjoy the top of a very short list.

## Task Commits

Each task was committed atomically (Task 2 is `tdd="true"`, so it has two commits: RED then GREEN):

1. **Task 1: content/boards.js, the board copy and quip banks, wired into the safety scan** - `d45fb19` (feat)
2. **Task 2 (RED): failing tests for the new-best view model** - `87f9dd5` (test)
2. **Task 2 (GREEN): implement the new-best death-panel view model** - `74308c0` (feat)

## Files Created/Modified
- `content/boards.js` - pure board-copy table plus new-best/first-death quip banks
- `test/voice/safety-scan.test.js` - imports + recursive walk so `BOARD_COPY`/`NEW_BEST_HEAD`/`NEW_BEST_LINES`/`FIRST_DEATH_LINES` are scanned and counted in the completeness/load-bearing meta-tests
- `src/browser/newBest.js` - `newBestView(report)`, `newBestValueText(board, summary)`
- `test/unit/newBest.test.js` - 13 tests pinning the view model's contract

## Decisions Made
- Row order for a several-boards announcement is derived from `Object.keys(BOARD_COPY)` (the mock's tab order) rather than the report's `newBests` array order, matching the plan's worked example exactly (`kills, deep, lean` input → `deep, lean, kills` output).
- `newBestValueText` returns `""` for any id it does not recognize (including `"yard"`, which the caller never actually requests since GRAVEYARD never announces) rather than throwing, keeping the formatter total.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' acceptance criteria pass verbatim, including the exact key order, line counts, import-count greps, and the `content/index.js` untouched check.

## Issues Encountered

`npm test` (the full suite) surfaced 7 pre-existing failures unrelated to this plan's files (`test/unit/flee-ledger.test.js`, `test/unit/class-pass-ledger.test.js`) — traced to `docs/FLEE.md`/`docs/CLASS-PASS.md` being checked out with CRLF line endings on this Windows worktree, which breaks the two tests' `$`-anchored regex line matching after a naive `split("\n")`. This is the same class of issue STATE.md's Deferred Items already track under the open "`.gitattributes eol=lf pin`" follow-up (recorded at the v1.8 and v1.9 closeouts) — not caused by this plan's changes. Per the Scope Boundary rule, these were left unfixed and logged to `deferred-items.md` in this phase directory rather than touched. Every test this plan's own `<verification>` block names is green, and `node --test test/parity/*.test.js` is 46/46 green.

## Human verification (deferred to end of run)

Voice read-through of `BOARD_COPY` rule lines and both quip banks (user taste call, listed verbatim above); Phase 66 reconciles rule lines and adds `mark` from the mock.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `content/boards.js` and `src/browser/newBest.js` are ready for Plan 65-04 (`takeDeathRecord()`, `engine/records.js` cross-check that `BOARD_COPY`'s keys equal `BOARD_IDS`) and Plan 65-05 (the shell wiring into `renderCombatOver`'s dead block).
- No blockers. The 7 pre-existing CRLF-related test failures are tracked in `deferred-items.md` and STATE.md's existing eol-pin follow-up; they do not affect this plan's deliverables.

---
*Phase: 65-run-record-personal-bests*
*Completed: 2026-09-23*

## Self-Check: PASSED

- FOUND: content/boards.js
- FOUND: src/browser/newBest.js
- FOUND: test/unit/newBest.test.js
- FOUND: .planning/phases/65-run-record-personal-bests/65-03-SUMMARY.md
- FOUND: .planning/phases/65-run-record-personal-bests/deferred-items.md
- FOUND commit: d45fb19 (feat: board copy and quip banks)
- FOUND commit: 87f9dd5 (test: RED, failing newBest tests)
- FOUND commit: 74308c0 (feat: GREEN, newBest.js implementation)
