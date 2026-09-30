---
phase: 87-player-report-fixes-joiner-hp-store-rations-depth-ties
plan: 04
subsystem: engine
tags: [records, boards, leaderboards, depth, ties, BOARD-28]
requires:
  - phase: 87-03
    provides: "clean baseline (8117 pass / 0 fail / 2 skipped)"
provides:
  - "compareRuns deep/combo/yard: floor desc, then steps desc (engine/records.js)"
  - "LEADERBOARD_COPY.stats.deep.rule = 'Lowest floor reached. Ties go to more squares walked.'"
affects: [87-05, 87-08]
tech-stack:
  added: []
  patterns: ["stored local records re-rank through sanitizeBests's existing comparator re-sort on load; no version bump, no migration"]
key-files:
  created: []
  modified:
    - engine/records.js
    - content/boards.js
    - test/unit/records.test.js
    - test/unit/leaderboard-copy.test.js
    - test/unit/runDoc.test.js
key-decisions:
  - "Local DEPTH, LINEAGE and GRAVEYARD all rank floor desc, then MOST steps (report #9), reversing v2.1 BOARD-17"
  - "No migration: sanitizeBests re-sorts every stored list by the current comparator on load (Phase 66 D-09), and reconcileBests re-folds graveyard stones"
requirements-completed: []
duration: ~25 min
completed: 2026-09-29
status: complete
---

# Phase 87 Plan 04: Local DEPTH ties go to the most steps (BOARD-28, local half) Summary

**Every local board (DEPTH, LINEAGE, GRAVEYARD, personal bests) now ranks runs that reached the same floor by the most squares walked, stored records from before the change re-rank on load with no migration, and the DEPTH rule line says so.**

BOARD-28 stays Pending in REQUIREMENTS.md by instruction; it closes with 87-08.

## What changed

- `engine/records.js`: the deep/combo/yard branch of `compareRuns` is now `num(field(b, "floor")) - num(field(a, "floor")) || num(field(b, "steps")) - num(field(a, "steps"))`. days, kills and purse are untouched. JSDoc and comments updated on `compareRuns`, `byLineageOrder`, `lineageRuns`, `sortGraveyard`, the BOARD_IDS block (LEANEST history kept, plus the note that the DEEPEST tie-break itself was reversed in Phase 87), and `sanitizeBests` (one sentence: the existing re-sort is the tolerant re-rank). No record version, no migration, no new field.
- `content/boards.js`: `LEADERBOARD_COPY.stats.deep.rule` is exactly `Lowest floor reached. Ties go to more squares walked.`
- Readers of the comparator (`sanitizeBests`, `updateBests`, `prune`, `lineageRuns`, `sortGraveyard`) needed no code change.

## Engine-vs-server split note (for the orchestrator)

`engine/records.js` is the one BOARD-28 file under `engine/` (a pure bests/graveyard ordering module: no rng, no gameplay), isolated in this plan. No server file was touched: `firebase/`, `src/browser/runDoc.js`, `tools/` and `test/parity/` show an empty `git diff --stat`. The server contract (`deepKeyOf`, the rules) moves in 87-05 with no engine bytes.

## Moved and new pins

Moved (all in `test/unit/records.test.js` unless noted):

| Pin | Before | After | Reason |
|-----|--------|-------|--------|
| "compareRuns deep: floor desc, then steps asc" | floor 5/100 steps ranked above floor 5/200 | renamed "floor desc, then steps desc (Phase 87 BOARD-28, report #9)"; 5/900 ranks above 5/100; floor 6/1 still above 5/999999 | comparator flip |
| "compareRuns combo/yard order like deep" | equality with deep only | also asserts more steps first on combo and yard | comparator flip |
| lineageRuns test title and expected order | `cccccccc, dddddddd, aaaaaaaa, bbbbbbbb` (steps asc) | `cccccccc, aaaaaaaa, bbbbbbbb, dddddddd` (steps desc, hash asc on the 50/50 tie) | comparator flip |
| sortGraveyard and backfillBests titles | "steps asc" | "steps desc" | wording only, assertions hold |
| `test/unit/leaderboard-copy.test.js` deep.rule pin | `...Ties go to fewer squares walked.` | `...Ties go to more squares walked.` (plus a Phase 87 comment) | the DEPTH rule copy |
| `test/unit/runDoc.test.js` "2,000 random in-bound pairs" deep line | `sign(deepB - deepA) === sign(compareRuns("deep", a, b))` | compares against an inline legacy comparator `b.floor - a.floor \|\| a.steps - b.steps`, with a comment | see Deviations |

New: sortGraveyard same-floor more-steps-first; sanitizeBests re-ranks an old-order deep list and is idempotent with no version bump; updateBests flags a same-floor more-steps run as a new deep best and a fewer-steps run as not; days/kills/purse unchanged by the tie-break.

No other suite in the plan's list (bests-adapter, board-death-paths, runBackfill, runHistory, runHistory-adapter, leaderboardView, leaderboardPanel, leaderboardPanel-dom, shell-boards-panel, voice-corpus, safety-scan) needed a pin change. No parity fixture moved.

## Test results

Full `npm test`: 8123 tests, 8121 pass, 0 fail, 2 skipped (baseline 8117 pass; +4 new records tests).

## Deviations from Plan

**1. [Rule 3 - Blocking] runDoc.test.js cross-module parity pin**
- **Found during:** Task 2 full-suite run (1 failure, "deep pair 18").
- **Issue:** the test asserted `deepKeyOf` (server key, `src/browser/runDoc.js`, still fewest-steps) orders like `compareRuns("deep")`. My comparator flip broke that cross-module parity until 87-05 flips `deepKeyOf`. I may not touch `runDoc.js` here, and the suite must end `fail 0`.
- **Fix:** test-only interim pin: the deep assertion compares against an inline legacy comparator (floor desc, steps asc) with a comment. **87-05 must re-point that line back to `compareRuns("deep", a, b)` when `deepKeyOf` flips.**
- **Files modified:** `test/unit/runDoc.test.js`
- **Commit:** 010e02d0

## Known Stubs

None.

## Notes

- Stale copies of the old rule text remain in gitignored build outputs (`www/`, `android/app/**/assets`) and will refresh on the next `cap sync`. `docs/narrative-pass/corpus-base.json` and `design/*.html` mock files carry the older design-time wording; left alone (not shipped copy, voice-corpus test green).
- All commits carry the required trailers.

## Commits

- e8b8d316: feat(87-04): local DEPTH ties go to the most steps (BOARD-28, report #9)
- c8fbbe0f: feat(87-04): DEPTH rule line states the most-steps tie-break (BOARD-28)
- 010e02d0: test(87-04): runDoc deep-key parity pin follows the old server key until 87-05

## Human verification (deferred to end of run)

- [ ] Leaderboards, ME scope, DEPTH: two of your runs that died on the same floor list the one with more squares walked first; the rule line under DEPTH says "Ties go to more squares walked."
- [ ] After updating over a 2.2.0 install, the same ME DEPTH list re-orders on first open without losing a run.

## Self-Check: PASSED

engine/records.js, content/boards.js, the three test files and this SUMMARY exist; commits e8b8d316, c8fbbe0f, 010e02d0 are in git log; `git diff --stat` over firebase/, src/browser/runDoc.js, tools/, test/parity/ is empty.
