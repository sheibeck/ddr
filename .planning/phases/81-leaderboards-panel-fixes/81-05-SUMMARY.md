---
phase: 81-leaderboards-panel-fixes
plan: 05
subsystem: infra
tags: [leaderboards, bests-record, boot-reconciliation, board-15, engine, engineAdapter]

# Dependency graph
requires:
  - phase: 81-01
    provides: "81-DEBUG.md's R-15 root-cause write-up (verdict DEVICE-ONLY, leading hypothesis H-15f) and test/unit/board-death-paths.test.js's passing six-death-path harness"
  - phase: 81-04
    provides: "the restructured BOARD_IDS/ME_ONLY_BOARDS rail this plan's records.js changes build on"
provides:
  - "engine/records.js#reconcileBests(record, graves): pure, non-mutating, never-throwing fold of missing graveyard stones into a bests record, with `last` restored"
  - "src/browser/engineAdapter.js#loadBests(): boot-time reconciliation against ddr.graveyard.v1, rewriting ddr.bests.v1 only when reconciliation actually changed the record"
affects: [81-06-global-board-fixes, milestone-close-two-device-checklist]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Boot-time self-healing reconciliation: a pure fold that repairs a durable record against a second, independently-written durable store on every load, writing back only on an actual change"

key-files:
  created: []
  modified:
    - engine/records.js
    - src/browser/engineAdapter.js
    - test/unit/records.test.js
    - test/unit/bests-adapter.test.js

key-decisions:
  - "Task 1 implemented reconcileBests(record, graves) exactly per the plan's interfaces block: starts from sanitizeBests(record), remembers last, folds oldest-first through normalizeStone, skips already-held hashes, restores last, never throws (caught failure falls back to sanitizeBests(record))."
  - "Wired into loadBests()'s already-parsed-JSON branch only, per the interface note that the backfill path already folds every stone via backfillBests and needs no separate pass. The record is rewritten to storage only when JSON.stringify differs from before reconciliation."
  - "Task 2: R-15's own 81-DEBUG.md verdict is DEVICE-ONLY, not CONFIRMED-at-the-code-layer — every hypothesis except H-15f was RULED OUT, and H-15f is device-only to trigger (an OS process suspension mid-write) with its fix already being reconcileBests itself. Per the plan's own contingency clause ('if 81-DEBUG.md recorded R-15 as RULED OUT ... this task makes no further production change'), Task 2 made zero additional file changes: test/unit/board-death-paths.test.js already carried no `todo: \"R-15` markers (81-01's session found no reproducible local-layer defect), so there was nothing to turn green beyond Task 1's already-implemented backstop."
  - "Updated one PRE-EXISTING test in bests-adapter.test.js ('boot with an existing valid ddr.bests.v1 loads it via sanitizeBests; graveyard stones are NOT re-folded') whose assertion directly encoded the OLD contract Task 1 deliberately overturns. Renamed and rewritten to assert the new, intentional contract: a missing graveyard stone IS folded in by boot reconciliation, while an already-held stone is never duplicated."

requirements-completed: [BOARD-15]

coverage:
  - id: D1
    description: "engine/records.js exports a pure, non-mutating, never-throwing reconcileBests(record, graves) that folds oldest-first through normalizeStone, skips hashes already held, and restores the input record's own `last`"
    requirement: BOARD-15
    verification:
      - kind: unit
        ref: "test/unit/records.test.js '--- reconcileBests (Phase 81, BOARD-15) ---' block (7 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "src/browser/engineAdapter.js#loadBests() reconciles the parsed ddr.bests.v1 record against the stored ddr.graveyard.v1 stones on every boot, rewriting storage only when reconciliation changed the record, and never announcing a new-best or submitting a score for a boot-reconciled run"
    requirement: BOARD-15
    verification:
      - kind: unit
        ref: "test/unit/bests-adapter.test.js 'boot reconciliation: a graveyard stone missing from ddr.bests.v1 is folded in before getBests() is ever exposed, silently' and 'boot reconciliation: already-consistent stores perform no ddr.bests.v1 write'"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every R-15 death path (combat, trap, starvation, abandon, resumed save, relaunch after death) plus replay-dedup and the exact device sequence still ranks a depth-10 run above a depth-9 run on every board it beats; the recovery scenario (a stored ddr.bests.v1 missing a depth-10 run whose stone is still in ddr.graveyard.v1) surfaces the depth-10 run at DEEPEST #1 after boot()"
    requirement: BOARD-15
    verification:
      - kind: unit
        ref: "test/unit/board-death-paths.test.js (8 tests, all pass, 0 todo); test/unit/bests-adapter.test.js's new boot-reconciliation test covers the exact device recovery scenario"
        status: pass
    human_judgment: false
  - id: D4
    description: "Engine gate: reconcileBests adds no new import to engine/records.js (still zero-import, DOM/render/storage/Math.random-free); no parity fixture moves; prototype-master.js.txt is untouched"
    requirement: BOARD-15
    verification:
      - kind: unit
        ref: "test/unit/engine-purity.test.js (9 tests, pass); node --test \"test/parity/**/*.test.js\" (49 tests, pass); git diff --name-only -- test/parity/prototype-master.js.txt (empty)"
        status: pass
    human_judgment: false

# Metrics
duration: ~35min
completed: 2026-09-25
status: complete
---

# Phase 81 Plan 05: R-15 Boot-Time Reconciliation Backstop Summary

**`reconcileBests(record, graves)` in `engine/records.js` — a pure, idempotent boot-time fold that repairs `ddr.bests.v1` against every stored `ddr.graveyard.v1` stone it's missing, wired into `engineAdapter.js#loadBests()` so a depth-10 run whose bests write was lost to a device process suspension still surfaces on ME DEEPEST after the next relaunch.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-09-25T05:13:00Z
- **Tasks:** 2
- **Files modified:** 4 (2 production, 2 test)

## Accomplishments

- `engine/records.js#reconcileBests(record, graves)`: exported, pure, never-mutating, never-throwing. Starts from `sanitizeBests(record)`, remembers its `last`, walks `graves` oldest-first through `normalizeStone`, skips a stone whose hash the record already holds, folds the rest via `updateBests`, then restores `last` — so a device relaunch can never move the standing card's "most recent run" out from under a real death.
- `src/browser/engineAdapter.js#loadBests()`: on the already-parsed-JSON path, reads `ddr.graveyard.v1` once and reconciles the loaded record against it before it is ever exposed via `getBests()`. The stored record is rewritten only when reconciliation actually changed it (proven by a spy on `setItem`); the backfill path is untouched, since `backfillBests` already folds every stone.
- Task 2 confirmed R-15's own verdict at the debug layer: DEVICE-ONLY, no reproducible engine/adapter defect beyond H-15f, whose fix IS Task 1's `reconcileBests` backstop. No further production change was needed or made; `test/unit/board-death-paths.test.js` already carried zero R-15 `todo` pins, and the device-recovery scenario the todo file describes ("that character of my own didn't even show up on my own boards anywhere but the graveyard") is now covered by a dedicated adapter test.

## Task Commits

Each task was committed atomically:

1. **Task 1: reconcileBests and the boot reconciliation** - `2922fe4` (feat)
2. **Task 2: apply routed R-15 fixes and turn every R-15 pin green** - no commit; zero production/test changes were required (see Deviations below) — the routed fix IS Task 1's `reconcileBests`, already committed, and `board-death-paths.test.js` already carried no R-15 `todo` pins to turn green.

_No plan-metadata commit: this SUMMARY and the final self-check are the last artifacts a worktree-isolated executor writes; the orchestrator's own metadata commit lands after merge._

## Files Created/Modified

- `engine/records.js` - adds `reconcileBests(record, graves)`, placed after `backfillBests`
- `src/browser/engineAdapter.js` - `loadBests()` now reconciles the parsed record against the stored graveyard on every boot
- `test/unit/records.test.js` - a new `--- reconcileBests (Phase 81, BOARD-15) ---` block (7 tests): missing-stone fold, already-held no-op, prune + idempotent second reconcile, legacy-stone normalization matches `backfillBests`, non-array/malformed `graves` never throws, no-mutation on deep-frozen inputs
- `test/unit/bests-adapter.test.js` - two new adapter-level tests (a missing depth-10 stone is folded in silently with no death-report/listener call; already-consistent stores write nothing) plus one pre-existing test updated (see Deviations)

## Decisions Made

See `key-decisions` in the frontmatter above — summarized: `reconcileBests` was implemented exactly to the plan's interfaces block; the boot wiring only touches the already-parsed-JSON branch of `loadBests()`; Task 2's routed R-15 fix is Task 1 itself, per 81-DEBUG.md's own DEVICE-ONLY verdict, so no second round of production changes was made.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated a pre-existing test whose assertion encoded the exact contract this plan deliberately overturns**
- **Found during:** Task 1, running the verification command (`node --test test/unit/records.test.js test/unit/bests-adapter.test.js test/unit/engine-purity.test.js`)
- **Issue:** `test/unit/bests-adapter.test.js`'s pre-existing "boot with an existing valid ddr.bests.v1 loads it via sanitizeBests; graveyard stones are NOT re-folded" test asserted `!loaded.runs[normalizeStone(other).hash]` — i.e., that a graveyard stone missing from a loaded `ddr.bests.v1` stays missing after `boot()`. That is precisely the bug this plan's `reconcileBests` boot-time backstop is built to fix (per the plan's own interfaces block: "loadBests() reconciles the loaded ... record against the stored ... stones on every boot"), so the test failed the instant the new wiring landed — not because of a regression, but because the test itself encoded the now-superseded contract.
- **Fix:** Renamed and rewrote the test to assert the new, intentional contract: a graveyard stone missing from the loaded record IS folded in by boot reconciliation (it qualifies for its own lineage's top ten), while the originally-seeded run still survives and no duplicate is produced (`Object.keys(loaded.runs).length === 2`). Added a comment explaining the Phase 81/BOARD-15 contract change so a future reader doesn't mistake this for an accidental assertion flip.
- **Files modified:** `test/unit/bests-adapter.test.js`
- **Verification:** `node --test test/unit/bests-adapter.test.js` — all 19 tests pass (previously 18/19 with this one test failing after the wiring change, before the fix).
- **Committed in:** `2922fe4` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — a pre-existing test asserting the exact behavior this plan's own interfaces block specifies as changing)
**Impact on plan:** Necessary and expected — the plan's own must_haves explicitly change loadBests()'s contract, and this test predates that change. No scope creep; no other test needed touching.

## Issues Encountered

None beyond the pre-existing-test conflict documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- BOARD-15 is closed: every death path (combat, trap, starvation, abandon, resumed save, relaunch after death) plus the exact device-reported recovery scenario (a graveyard stone present, its bests entry lost) is pinned and green.
- 81-06 (global board fixes) is unaffected by this plan's files (`engine/records.js`, `src/browser/engineAdapter.js`) — its own R-09/R-10/R-16a/R-16b/R-16c todo pins in `test/unit/board-global-trace.test.js` remain exactly as 81-01 left them (7 todo, unchanged by this plan's work).
- The milestone-close two-device checklist (`81-DEBUG.md`'s own recommendation) is the right place to confirm the device's actual depth-10 stone now surfaces at ME DEEPEST #1 after the next relaunch — this plan's automated coverage already proves the mechanism; only the real device's specific stored data remains to confirm.
- No blockers.

---
*Phase: 81-leaderboards-panel-fixes*
*Completed: 2026-09-25*

## Self-Check: PASSED

- FOUND: `engine/records.js`
- FOUND: `src/browser/engineAdapter.js`
- FOUND: `test/unit/records.test.js`
- FOUND: `test/unit/bests-adapter.test.js`
- FOUND: `.planning/phases/81-leaderboards-panel-fixes/81-05-SUMMARY.md`
- FOUND commit `2922fe4` (Task 1: reconcileBests and the boot reconciliation)
- `node --test test/unit/records.test.js test/unit/bests-adapter.test.js test/unit/engine-purity.test.js` exits 0 (94 pass, 0 fail, 0 todo)
- `node --test test/unit/board-death-paths.test.js test/unit/bests-adapter.test.js test/parity/fixture-inventory.test.js` exits 0 (32 pass, 0 fail, 0 todo)
- `node --test "test/parity/**/*.test.js"` exits 0 (49 pass, 0 fail, 0 todo)
- `git diff --name-only -- test/parity/prototype-master.js.txt` is empty (untouched)
- `npm test` exits with 5669 pass / 7 fail (the known worktree-only CRLF doc-ledger tests, docs/CLASS-PASS.md + docs/FLEE.md) / 7 todo (81-06's own R-16/R-09/R-10 pins, unchanged) — no new production failures
- `node --input-type=module -e "import fs from 'node:fs'; const s=fs.readFileSync('test/unit/board-death-paths.test.js','utf8'); if (/todo:\s*\"R-15/.test(s)) process.exit(1)"` exits 0
