---
phase: 81-leaderboards-panel-fixes
plan: 03
subsystem: docs
tags: [play-games-services, leaderboards, data-safety, release-process]

# Dependency graph
requires:
  - phase: 81-leaderboards-panel-fixes (plan 02)
    provides: "the four-board code end state (RANKED_BOARDS, SUBMIT_BOARDS, content/leaderboards.js) this plan's docs describe"
provides:
  - "docs/PLAY-GAMES-SETUP.md describing the four live Season-1 boards and a new §13 Retired boards for the Season-1 LEANEST board"
  - "docs/RELEASING.md's tester-facing release notes and post-push console checklist for the next Play push"
  - "store-listing/LISTING.md's Data safety Other actions row listing the four submitted scores"
  - "docs/SHELL-MODULES.md's Phase 68 encodings paragraph updated to four submitted scores"
affects: [81-leaderboards-panel-fixes (orchestrator merge; the eventual Play push described here)]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - docs/PLAY-GAMES-SETUP.md
    - docs/RELEASING.md
    - store-listing/LISTING.md
    - docs/SHELL-MODULES.md
    - test/unit/play-games-runbook.test.js

key-decisions:
  - "§13 Retired boards is the single source of truth for the LEANEST deletion step; docs/RELEASING.md's after-push checklist cites it by section number rather than restating the path"
  - "Removed 'Smaller is better' from the runbook test's REQUIRED list since no section still uses the phrase once the LEANEST table row and 'The LEANEST limit' paragraph were deleted"
  - "store-listing.test.js needed no changes — it pins no five-score-list phrase, so the LISTING.md edit only needed the LEANEST-no-longer-submitted sentence added underneath the table"

requirements-completed: [BOARD-17]

coverage:
  - id: D1
    description: "docs/PLAY-GAMES-SETUP.md describes four Season-1 boards (DEEPEST, LONGEST, BUTCHERY, PURSE) with no LEANEST row, restated 70-board-cap arithmetic (65 left, 16 more seasons of four), and a new §13 Retired boards naming LEANEST's id, why it was retired, and the delete-after-ship instruction"
    requirement: BOARD-17
    verification:
      - kind: unit
        ref: "test/unit/play-games-runbook.test.js (41 tests, includes the four-row ordering check and the new §13 pin test)"
        status: pass
    human_judgment: false
  - id: D2
    description: "docs/RELEASING.md gains '## Next Play push: release notes' (tester-facing ME|ALL|FRIENDS/YOU-tag/LEANEST-GRAVEYARD-gone copy) and '## After the push: console checklist' (delete LEANEST per §13, two-device ALL-board confirmation)"
    requirement: BOARD-17
    verification:
      - kind: other
        ref: "grep -c \"^## Next Play push: release notes\" docs/RELEASING.md; grep -c \"^## After the push: console checklist\" docs/RELEASING.md; grep -c CgkIlvbN0YYPEAIQAw docs/RELEASING.md — all equal/at-least 1"
        status: pass
    human_judgment: false
  - id: D3
    description: "store-listing/LISTING.md's Data safety Other actions row lists the four submitted scores (DEEPEST, LONGEST, BUTCHERY, PURSE) with the Yes/No answers unchanged, and docs/SHELL-MODULES.md's Phase 68 paragraph matches"
    requirement: BOARD-17
    verification:
      - kind: unit
        ref: "test/unit/store-listing.test.js (57 tests total across the suite run) and test/unit/bridge-registry.test.js"
        status: pass
    human_judgment: false

# Metrics
duration: 7min
completed: 2026-09-25
status: complete
---

# Phase 81 Plan 03: Play Games Runbook, Release Notes and the Retired LEANEST Board Summary

**Rewrote the Play Games runbook, release notes and Data Safety listing for the four-board (post-LEANEST) leaderboards end state, adding a §13 Retired boards section as the single source of truth for the Season-1 LEANEST deletion step**

## Performance

- **Duration:** 7 min
- **Started:** 2026-09-25T03:58:00Z
- **Completed:** 2026-09-25T04:04:47Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- `docs/PLAY-GAMES-SETUP.md` sections 6, 7, 9, 10 and 11 now describe the four live Season-1 boards (DEEPEST, LONGEST, BUTCHERY, PURSE), state LINEAGE is ME-only since v2.1 with no global lineage view, and restate the 70-board cap for four boards a season (Season 1 counted as five spent, 65 remaining, 16 more seasons of four)
- New `## 13. Retired boards` section names LEANEST, Season 1 (`CgkIlvbN0YYPEAIQAw`), why it was retired (BOARD-17: steps-per-floor let a 1-step death top it, and "deepest floor, then fewest steps" is exactly DEEPEST's ordering), the exact Play Console delete path with the delete-after-ship-only instruction, and the caveat if the console refuses to delete a published leaderboard
- `docs/RELEASING.md` gains `## Next Play push: release notes` (tester-facing, family-friendly-deadpan copy covering ME|ALL|FRIENDS, the YOU tag, board refresh, LEANEST/GRAVEYARD removal and "every finished run lands on your own boards") and `## After the push: console checklist` (delete LEANEST per §13, then confirm a cross-device ALL-board score with a friend), both citing the standing ask-first push rule
- `store-listing/LISTING.md`'s Data safety Other actions row now lists the four submitted scores with a note that LEANEST is no longer submitted and the Yes/No answers are unchanged; `docs/SHELL-MODULES.md`'s Phase 68 encodings paragraph matches
- `test/unit/play-games-runbook.test.js` updated: the LEANEST smaller-is-better ordering test replaced with a four-row check plus a "no LEANEST row" assertion, a new test pins §13's content, and the numbered-sections floor moved from 12 to 13

## Task Commits

Each task was committed atomically:

1. **Task 1: The Play Games runbook describes four boards and adds §13 Retired boards** - `b9ec473` (docs)
2. **Task 2: Release notes, the post-push console checklist, the Data safety text and the module doc** - `cf00525` (docs)

**Plan metadata:** pending (this SUMMARY's commit)

## Files Created/Modified
- `docs/PLAY-GAMES-SETUP.md` - four-board runbook (§6/§7/§9/§10/§11) plus new §13 Retired boards
- `docs/RELEASING.md` - next-push release notes and after-push console checklist
- `store-listing/LISTING.md` - Data safety row lists four scores, LEANEST-retired note added
- `docs/SHELL-MODULES.md` - Phase 68 encodings paragraph updated to four scores
- `test/unit/play-games-runbook.test.js` - four-row ordering test, §13 pin test, numbered-sections floor raised to 13

## Decisions Made
- §13 Retired boards is the single source of truth for the LEANEST deletion step; `docs/RELEASING.md`'s checklist item cites it by section number instead of duplicating the Play Console path, per the plan's `key_links` requirement.
- Removed `"Smaller is better"` from the runbook test's REQUIRED list since, once the LEANEST table row and "The LEANEST limit" paragraph were deleted, no section in the doc uses that phrase any more (every remaining board is Larger is better).
- Left `test/unit/store-listing.test.js` untouched — it pins no five-score-list phrase (confirmed by grep before editing), so only `LISTING.md` itself needed the count and retirement-note changes.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. (The actual Play Console LEANEST deletion and the versionCode-bumped push described in these docs are follow-on actions for the user/orchestrator after this phase merges, per the standing ask-first rule — not performed by this plan.)

## Next Phase Readiness

- The docs half of BOARD-17 is complete and its tests are green (41 in `play-games-runbook.test.js`, 57 across the `store-listing`/`bridge-registry`/`play-games-runbook` verification set).
- No code files were touched by this plan (verified: `git diff --name-only` against the plan's base commit shows only the 4 docs + 1 test file in `files_modified`), so it carries no interaction risk with sibling plans 81-01/81-02/81-04/81-05/81-06 in this wave/phase.
- Once 81-02's code changes (RANKED_BOARDS, SUBMIT_BOARDS, content/leaderboards.js) land, the docs in this plan already describe that end state — no further doc sync expected for BOARD-17.

---
*Phase: 81-leaderboards-panel-fixes*
*Completed: 2026-09-25*

## Self-Check: PASSED

- FOUND: docs/PLAY-GAMES-SETUP.md
- FOUND: docs/RELEASING.md
- FOUND: store-listing/LISTING.md
- FOUND: docs/SHELL-MODULES.md
- FOUND: test/unit/play-games-runbook.test.js
- FOUND commit: b9ec473
- FOUND commit: cf00525
