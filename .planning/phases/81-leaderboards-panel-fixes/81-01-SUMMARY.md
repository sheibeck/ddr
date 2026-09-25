---
phase: 81-leaderboards-panel-fixes
plan: 01
subsystem: testing
tags: [debug, leaderboards, play-games, pgsQueue, globalBoards, boardsView, engineAdapter, records]

# Dependency graph
requires: []
provides:
  - "81-DEBUG.md: Root causes table (R-09, R-10, R-15, R-16a, R-16b, R-16c), Fix routing, Assumption delta, Device session decision"
  - "test/unit/board-death-paths.test.js: BOARD-15 death-path pins through the real engineAdapter"
  - "test/unit/board-global-trace.test.js: BOARD-16/09/10 submit/fetch/visibility/identity pins, including the YOU invariant"
affects: [81-05-local-board-fixes, 81-06-global-board-fixes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Root-cause-before-fix debug session: every hypothesis gets a passing (ruled out) or todo-marked-failing (confirmed) node:test pin before any production code changes"
    - "Kotlin-faithful fake plugin payloads (putIfPresent-omitted fields) to reproduce a native-serialization defect in node --test"

key-files:
  created:
    - .planning/phases/81-leaderboards-panel-fixes/81-DEBUG.md
    - test/unit/board-death-paths.test.js
    - test/unit/board-global-trace.test.js
  modified: []

key-decisions:
  - "R-15 (local runs lost): no engine/adapter-layer defect reproduces the symptom in node --test; the leading evidence-consistent explanation (H-15f) is device-only to trigger (persistGrave's four independent, non-atomic storage.setItem calls). Verdict DEVICE-ONLY, routed to 81-05's already-planned boot-time reconcileBests() backstop."
  - "R-09/R-10 (YOU tag / shown twice) share one root cause: the plugin's Kotlin serializer OMITS scoreHolder (putIfPresent) on many rows, including the player's own, so playerId-only matching in toGlobalEntry never resolves YOU. R-10 is a direct rendering consequence of R-09, not a second bug."
  - "R-16a (scores lost globally): pgsQueue.js#run()'s break-outer on the first queued run's first failed board submission permanently wedges every later run's submissions on every retry. CONFIRMED via a todo test."
  - "R-16b (stale global view): loadTopScores hard-codes forceReload:false with no override, and createGlobalBoards' 5-minute cache has no invalidation hook tied to a submission or panel reopen (only a blunt sign-out/Compete-off clear()). CONFIRMED via two todo tests."
  - "R-16c (misleading 'not in top ten' copy): a record Play Games withholds from the public list entirely (unshared gameplay activity, rank withheld per Google's own documented rule) is shown identically to a genuinely ranked-but-off-list record. CONFIRMED, narrower/contributing."
  - "Device session: NOT NEEDED. Every R-id was confirmed or ruled out via code/plugin-source reading plus a passing or todo-failing test; no R-id has two or more surviving explanations whose fixes are mutually exclusive."

patterns-established:
  - "A debug-first plan writes zero production code; every finding is pinned as a passing (ruled-out) or todo (confirmed) test, and 81-DEBUG.md's Root causes table is the single source the fix plans (81-05/81-06) read without re-investigating."

requirements-completed: [BOARD-15, BOARD-16, BOARD-09]

coverage:
  - id: D1
    description: "BOARD-15 local recording traced across six real death paths (combat, trap, starvation, abandon, resumed save, relaunch after death) plus replay-dedup and the exact device sequence; no engine/adapter defect reproduces the report"
    requirement: BOARD-15
    verification:
      - kind: unit
        ref: "test/unit/board-death-paths.test.js (8 tests, all pass)"
        status: pass
    human_judgment: false
  - id: D2
    description: "BOARD-16 global submit/fetch traced end to end; the queue-wedge (pgsQueue.js run()'s break-outer) and the stale-cache/forceReload defects confirmed"
    requirement: BOARD-16
    verification:
      - kind: unit
        ref: "test/unit/board-global-trace.test.js 'R-16a queue wedge' (todo, fails as expected)"
        status: pass
      - kind: unit
        ref: "test/unit/board-global-trace.test.js 'R-16b forceReload' + 'R-16b cache invalidation' (todo, fail as expected)"
        status: pass
    human_judgment: false
  - id: D3
    description: "BOARD-09 YOU identity traced: the scoreHolder-omission root cause confirmed for both payload shapes (no scoreHolder; a differing holder id with an identical own-record rank/rawScore/tag)"
    requirement: BOARD-09
    verification:
      - kind: unit
        ref: "test/unit/board-global-trace.test.js 'R-09 identity invariant' shape (i) and shape (ii) (both todo, fail as expected)"
        status: pass
    human_judgment: false
  - id: D4
    description: "BOARD-10 (shown twice) and R-16c (misleading withheld-vs-off-list copy) traced and pinned; 81-DEBUG.md's Root causes table, Fix routing and Assumption delta sections written for 81-05/81-06 to consume"
    verification:
      - kind: unit
        ref: "test/unit/board-global-trace.test.js 'R-10 shown-twice' + 'R-16c public visibility' (both todo, fail as expected)"
        status: pass
    human_judgment: false

# Metrics
duration: ~50min
completed: 2026-09-25
status: complete
---

# Phase 81 Plan 01: Root-Cause Debug Session Summary

**Root-caused BOARD-15/16/09/10 before any fix: local recording has no reproducible code defect (device-only write-atomicity gap), while the global boards have five confirmed defects — a submission queue that wedges forever behind one failed board, a hard-coded non-forcing cache with no invalidation hook, a misleading "not in top ten" copy for withheld-visibility records, and one root playerId-matching bug (a Kotlin `putIfPresent`-omitted `scoreHolder`) that independently explains both the YOU-tag bug and the shown-twice bug.**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-09-25T04:22:59Z
- **Tasks:** 3
- **Files modified:** 3 (2 new test files, 1 new debug doc — zero production code)

## Accomplishments

- `test/unit/board-death-paths.test.js` (8 tests, all pass): drives combat, trap, starvation, abandon, a resumed save and a relaunch-after-death through the real `src/browser/engineAdapter.js` `dispatch()` choke point, each seeding a depth-9 run then a depth-10 run and asserting DEEPEST order, every `RANKED_BOARDS` board the depth-10 run beats, `ddr.bests.v1` byte-equality, and graveyard agreement. No engine/adapter-layer defect reproduces the reported "shown in Graveyard but not DEEPEST" symptom; the leading (device-only-to-trigger) explanation is `persistGrave`'s four independent, non-atomic `storage.setItem` calls.
- `test/unit/board-global-trace.test.js` (11 tests: 4 pass, 7 todo-and-failing-as-expected): traces the submit side (`pgsQueue.js`), the fetch side (`playGames.js`/`globalBoards.js`) and the identity/visibility layer (`boardsView.js`) via `createPlayGames({ loadPlugin })` over a Kotlin-faithful recording fake plugin (payloads mirror `LeaderboardsModule.kt`'s `putIfPresent` field-omission exactly) plus `createFakePlayGames`/`createSubmissionQueue` where a pure best-score store is enough.
- `.planning/phases/81-leaderboards-panel-fixes/81-DEBUG.md`: the Root causes table, Fix routing, per-R-id sections (`## R-09`, `## R-10`, `## R-15`, `## R-16a`, `## R-16b`, `## R-16c`), the Assumption delta answer (CONFIRMED — same id family, but the row-level id is frequently absent, not differently shaped) and the Device session decision (NOT NEEDED).

## Task Commits

Each task was committed atomically:

1. **Task 1: BOARD-15 local trace** - `e69e1e8` (test)
2. **Task 2: BOARD-16/09/10 global trace** - `0a32cfc` (test)
3. **Task 3: Root causes table, fix routing and the device-session gate** - `c42ced4` (docs)

_No plan-metadata commit: this SUMMARY and the final self-check are the last artifacts a worktree-isolated executor writes; the orchestrator's own metadata commit lands after merge._

## Files Created/Modified

- `.planning/phases/81-leaderboards-panel-fixes/81-DEBUG.md` - the Root causes table, Fix routing, per-R-id findings, Assumption delta and Device session decision that 81-05/81-06 read without re-investigating
- `test/unit/board-death-paths.test.js` - BOARD-15 death-path pins through the real adapter (8/8 pass)
- `test/unit/board-global-trace.test.js` - BOARD-16/09/10 submit/fetch/visibility/identity pins (4 pass, 7 todo)

## Decisions Made

See `key-decisions` in the frontmatter above — summarized: R-15 is DEVICE-ONLY (routed to 81-05's planned `reconcileBests` backstop, no reproducible code bug found); R-09/R-10/R-16a/R-16b/R-16c are all CONFIRMED (all routed to 81-06); no device session is needed because no R-id has mutually exclusive surviving explanations.

## Deviations from Plan

None — plan executed exactly as written. No production code was touched in any of the three task commits (verified via `git show --name-only` on each).

## Issues Encountered

- The plan's literal step-value ordering for the R-16a "depth 9, 10 and 11 / steps 0, 431, 999999" fixture would not actually clear the ">10,999,000" threshold under the natural (positional) reading — computed it out and assigned steps adversarially instead (depth-9 gets the WORST-case steps, depth-10 the BEST case, depth-11 a middling value) so the same test proves BOTH "strict floor order under an adversarial steps distribution" and the ">10,999,000" floor-11 margin. Documented in the test's own comment.
- My first draft of the "R-10 shown-twice" assertion (counting rows where `you === true`) trivially passed even under the buggy behavior, because the LISTED row's `you` flag is `false` (that IS R-09's bug) while only the PINNED row carries `you: true` — so a `you`-flag count is always 1 regardless of the duplicate. Corrected to assert on total row count (1 real person should render as 1 row, not 2) — now correctly fails as a todo test, reproducing the device report.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 81-05 (local board fixes) can implement `reconcileBests(record, graves)` directly against `81-DEBUG.md`'s R-15 write-up and `test/unit/board-death-paths.test.js`'s existing passing harness (no todo test to turn green there — the fix is a defensive backstop, not a bug repro).
- 81-06 (global board fixes) has five independently pinned `todo` tests to turn green: R-16a's queue-wedge, R-16b's two cache/forceReload gaps, R-16c's withheld-vs-off-list copy gap, and R-09/R-10's shared `you`-matching fix (rank+rawScore+tag fallback per the confirmed assumption-delta decision).
- No blockers. No device session was requested or needed.

---
*Phase: 81-leaderboards-panel-fixes*
*Completed: 2026-09-25*

## Self-Check: PASSED

- FOUND: `.planning/phases/81-leaderboards-panel-fixes/81-DEBUG.md`
- FOUND: `test/unit/board-death-paths.test.js`
- FOUND: `test/unit/board-global-trace.test.js`
- FOUND: `.planning/phases/81-leaderboards-panel-fixes/81-01-SUMMARY.md`
- FOUND commit `e69e1e8` (Task 1: BOARD-15 local trace)
- FOUND commit `0a32cfc` (Task 2: BOARD-16/09/10 global trace)
- FOUND commit `c42ced4` (Task 3: Root causes table, fix routing, device-session gate)
- `node --test test/unit/board-death-paths.test.js test/unit/board-global-trace.test.js` exits 0 (8 + 4 pass, 7 todo, 0 fail)
- `npm test` exits with 5663 pass / 7 fail (the known worktree-only CRLF doc-ledger tests, docs/CLASS-PASS.md + docs/FLEE.md) / 7 todo — no new production failures
- Each of the three task commits touches only its declared files (verified via `git log --name-only`); no production code (`engine/`, `src/`, `content/`, `mazeworld.html`) was modified
