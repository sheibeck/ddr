---
phase: 84-leaderboards-panel-v3
plan: 03
subsystem: persistence
tags: [run-history, leaderboards, engine-adapter, storage, backfill]

# Dependency graph
requires:
  - phase: 84-leaderboards-panel-v3
    provides: "84-01: src/browser/runDoc.js's rankKeyOf(stat, run)/BOARD_STATS, the shared rank-key function this plan's newBestsAgainst reuses"
  - phase: 83-leaderboard-server
    provides: "83-12: src/browser/runBackfill.js's BACKFILL_SINCE_MS/BACKFILL_VERSION/collectBackfillRuns, the same 2.1.0-cutoff import machinery this plan reuses for the local history"
provides:
  - "src/browser/runHistory.js — the pure per-run history model: RUN_HISTORY_KEY/RUN_HISTORY_CAP/RUN_HISTORY_FIELDS/IMPORT_VERSION, historyRecordOf, sanitizeHistory, appendRun, mergeHistories, importLegacy, newBestsAgainst, serializeHistory"
  - "engineAdapter.js: loadRunHistory()/getRunHistory()/setAppVersion() — boot-time load + once-only 2.1.0-cutoff import, the synchronous per-death append, and merge-on-write persistence"
  - "the death report (takeDeathRecord) moved onto the per-run history (newBestsAgainst) instead of the bests record's boards"
affects: [84-05, 84-06, 84-07, 84-08, 84-09, 85]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A THIRD adapter-owned cross-run storage key (ddr.runs.v1), alongside ddr.graveyard.v1 and ddr.bests.v1, written in the same persistGrave() back-to-back batch — never GameState"
    - "merge-on-write: every write to ddr.runs.v1 first re-reads whatever is currently stored and unions it with the in-memory copy (mergeHistories) before writing — the stored history can only ever grow, even across a read failure isolated to that one key (safeGetItem)"
    - "a once-only per-device import (importLegacy, mirroring runBackfill.js's own once-only ddr.boardBackfill.v1 marker pattern) gated on a stored `imported: true` flag rather than a separate marker key"

key-files:
  created:
    - src/browser/runHistory.js
    - test/unit/runHistory.test.js
    - test/unit/runHistory-adapter.test.js
  modified:
    - src/browser/engineAdapter.js
    - mazeworld.html
    - test/unit/bests-adapter.test.js
    - test/unit/adapter-run-listener.test.js

key-decisions:
  - "recordDeath()'s bests fold (updateBests) still runs unconditionally, exactly as before — ddr.bests.v1 is left byte-identical in shape and write timing — but it no longer sets deathRecord; the death panel's 'new personal best?' answer (deathRecord) now comes solely from the history branch (historyRecordOf + newBestsAgainst + appendRun)"
  - "persistGrave()'s RUN_HISTORY_KEY read is isolated behind a private safeGetItem() wrapper (try/catch -> null) so a failure reading THAT one key can never abort the Promise.all that also reads the three graveyard keys — the graveyard/bests writes must survive even if the history read fails"
  - "storage.js's own getItem()/setItem() already fail safe to null/no-op on any underlying exception (documented in its own header comment), so a genuine thrown rejection can never reach engineAdapter.js in production; loadRunHistory()'s own outer try/catch and persistGrave()'s safeGetItem() are deliberate defense-in-depth for that contract rather than reachable production paths — verified instead via a fully-blocked-storage boot (mirroring bests-adapter.test.js's own 'blocked storage' test) for the merge-on-write guarantee"
  - "engine/records.js is only ever read (isValidHash/runHash, by way of runBackfill.js's collectBackfillRuns) — no edits to the engine gate"

requirements-completed: []  # BOARD-26 is in this plan's frontmatter `requirements` field but is NOT marked complete in REQUIREMENTS.md — the phase source audit table (84-01-PLAN.md) shows BOARD-26 also needs 84-08 (VIEW THE DEAD's title-gate wiring off the history). This plan delivers the full storage/model/adapter layer BOARD-26 needs; the remaining UI-surface plan is still pending. See "Requirement Coverage" below.

coverage:
  - id: D1
    description: "src/browser/runHistory.js: RUN_HISTORY_KEY/RUN_HISTORY_CAP(500)/RUN_HISTORY_FIELDS/IMPORT_VERSION; historyRecordOf validates+builds a frozen 18-field record or null; sanitizeHistory tolerant-loads any input to a deduped/sorted/capped {v,imported,runs}; appendRun/mergeHistories/importLegacy/newBestsAgainst/serializeHistory — all pure, never throw, never mutate inputs"
    requirement: "BOARD-26"
    verification:
      - kind: unit
        ref: "test/unit/runHistory.test.js — 28 tests: field validation edges, dedupe/sort/cap, the 501st-run cap, mergeHistories' never-shrinks union, importLegacy's cutoff boundary + version preservation, newBestsAgainst (including the capped DAYS rule), serializeHistory, purity"
        status: pass
    human_judgment: false
  - id: D2
    description: "engineAdapter.js: boot() loads (and once-only imports) the history right after the graveyard; loadRunHistory()/getRunHistory()/setAppVersion() exported; a non-dev death appends synchronously with the stamped app version and deathAt; a dev death never touches it; persistGrave's lazy path + merge-on-write means the stored history can only grow"
    requirement: "BOARD-26"
    verification:
      - kind: unit
        ref: "test/unit/runHistory-adapter.test.js — 12 tests: before-any-load empty array, the lazy path (fresh module state), first-launch cutoff import with old-store byte-identity, second-boot no-reimport, corrupt-JSON tolerance, non-dev death append + setAppVersion fallback rule, dev-run exclusion, merge-on-write under blocked storage"
        status: pass
      - kind: unit
        ref: "test/unit/bests-adapter.test.js, test/unit/adapter-run-listener.test.js — the takeDeathRecord assertions (first-ever death, deeper/shallower, throwing-storage boot report, new-run-clears) now await loadRunHistory() and read newBestsAgainst semantics; every bests-record storage assertion unchanged"
        status: pass
      - kind: unit
        ref: "full verification set (runHistory-adapter, bests-adapter, adapter-run-listener, graveyard-adapter, shell-new-best, shell-pgs) — 107/107 pass"
        status: pass
    human_judgment: false
  - id: D3
    description: "mazeworld.html stamps setAppVersion(#mw-app-version text) before boot(), via its own import line — the pinned `import { boot, dispatch, startNewRun, waitForPending, takeBootWornReport }` line stays byte-identical"
    requirement: "BOARD-26"
    verification:
      - kind: unit
        ref: "test/unit/shell-pgs.test.js (S1) — the pinned engineAdapter import line assertion, unchanged and still passing"
        status: pass
    human_judgment: false

# Metrics
duration: ~35min
completed: 2026-09-29
status: complete
---

# Phase 84 Plan 03: Per-Run History (YOUR DEAD) and History-Based New Personal Best Summary

**YOUR DEAD gets its own 500-run local history (`ddr.runs.v1`) seeded once from the 2.1.0 release on, written alongside every non-dev death, and NEW PERSONAL BEST now compares against it instead of the old bests boards**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-09-29T08:40:00-04:00 (approx, first file read)
- **Completed:** 2026-09-29T09:15:51-04:00
- **Tasks:** 2
- **Files modified:** 7 (3 created, 4 modified)

## Accomplishments
- `src/browser/runHistory.js`: a pure, DOM-free per-run history model — `historyRecordOf`/`sanitizeHistory`/`appendRun`/`mergeHistories`/`importLegacy`/`newBestsAgainst`/`serializeHistory` — capped at 500 runs, deduplicated by hash, sorted newest-first, and never throwing on any input shape
- The once-only 2.1.0-cutoff import (`importLegacy`) reuses `src/browser/runBackfill.js`'s own `BACKFILL_SINCE_MS`/`BACKFILL_VERSION`/`collectBackfillRuns` — the exact same cutoff and tamper-hash gate the board's own backfill uses, so a run one ms before the cutoff never appears and one exactly at it always does
- `engineAdapter.js`: `boot()` now loads (and, on a first launch, imports) the history right after the graveyard; every non-dev death appends into it inside `persistGrave`'s existing write batch; `recordDeath`'s death-panel report (`deathRecord`) moved off the bests boards onto `newBestsAgainst` against the history — the old `ddr.bests.v1` store keeps being written exactly as before for any later cleanup
- `persistGrave`'s merge-on-write: every write to `ddr.runs.v1` re-reads whatever is actually stored and unions it with the in-memory copy before writing, so the stored history can only ever grow — proven under a fully-blocked-storage boot
- `mazeworld.html`: one new import line for `setAppVersion`, called with `#mw-app-version`'s text right before `boot()` — the pinned `boot`/`dispatch` import line stays byte-identical (locked by `shell-pgs.test.js`)
- Full verification set (`runHistory-adapter`, `bests-adapter`, `adapter-run-listener`, `graveyard-adapter`, `shell-new-best`, `shell-pgs`): 107/107 pass. Full `npm test`: 8373 pass, 0 fail, 2 skipped (pre-existing), exit 0. Engine gate (`engine/`, `test/parity/`, `content/`): clean.

## Task Commits

Each task was committed atomically (TDD RED/GREEN for Task 1; a single verified-green commit for Task 2's adapter wiring, matching 84-01's own precedent for an interleaved test+implementation task):

1. **Task 1 (RED): test/unit/runHistory.test.js** - `8f708adc` (test)
2. **Task 1 (GREEN): src/browser/runHistory.js** - `04ba0d62` (feat)
3. **Task 2: engineAdapter.js wiring + mazeworld.html + adapter tests** - `7d0d5214` (feat)

_Task 1's RED was confirmed by temporarily moving `src/browser/runHistory.js` aside (working tree only, never committed in that state) and observing `ERR_MODULE_NOT_FOUND` across all 28 tests; the file was restored before the GREEN commit._

## Files Created/Modified
- `src/browser/runHistory.js` - the pure per-run history model (new)
- `test/unit/runHistory.test.js` - 28 tests covering the model (new)
- `test/unit/runHistory-adapter.test.js` - 12 tests covering the adapter wiring (new)
- `src/browser/engineAdapter.js` - `loadRunHistory()`/`getRunHistory()`/`setAppVersion()`; `recordDeath`/`persistGrave` updated to build/append/merge the history; `boot()` loads it after the graveyard
- `mazeworld.html` - one new `setAppVersion` import line + the boot-time stamp call
- `test/unit/bests-adapter.test.js` - the four `takeDeathRecord`-reading tests now `await loadRunHistory()` and follow `newBestsAgainst` semantics
- `test/unit/adapter-run-listener.test.js` - the two `takeDeathRecord`-reading tests now `await loadRunHistory()`

## Decisions Made
- `recordDeath()`'s bests fold (`updateBests`) still runs unconditionally — `ddr.bests.v1` is untouched in shape/timing — but no longer sets `deathRecord`; that now comes solely from the history branch
- `persistGrave()`'s `RUN_HISTORY_KEY` read is isolated behind a private `safeGetItem()` (try/catch → null) so a failure reading that one key can never abort the graveyard keys' own `Promise.all` read
- `storage.js`'s `getItem()`/`setItem()` already fail safe to null/no-op on any underlying exception (its own documented contract), so a genuine thrown rejection can never reach `engineAdapter.js` in production; the defensive try/catch paths in `loadRunHistory()`/`persistGrave()` are deliberate defense-in-depth rather than reachable production paths — the merge-on-write guarantee is instead verified via a fully-blocked-storage boot (mirroring `bests-adapter.test.js`'s own "blocked storage" pattern), the same technique the plan's own "a boot whose history read throws" behavior bullet is proven against
- `engine/records.js` is only ever read (`isValidHash`/`runHash`, via `runBackfill.js#collectBackfillRuns`) — the engine gate stays clean

## Deviations from Plan

None - plan executed exactly as written. The one test-fixture correction below was made entirely within this plan's own new test file, not outside `files_modified`.

### Auto-fixed Issues (within this plan's own new test coverage)

**1. [Rule 1 - Bug] Test fixture: a "first launch import" test's `ddr.bests.v1` fixture triggered pre-existing Phase 81 (BOARD-15) boot reconciliation, not a Phase 84 bug**
- **Found during:** Task 2 verification (`test/unit/runHistory-adapter.test.js`, first pass)
- **Issue:** The "first launch: imports only 2.1.0-era ... leaves the old stores byte-identical" test folded only the at-cutoff run into `ddr.bests.v1`, while `ddr.graveyard.v1` held a *different* pre-cutoff stone. `boot()`'s existing `loadBests()` reconciliation (Phase 81, unrelated to this plan) folded that missing graveyard stone into `ddr.bests.v1` during boot, so the "byte-identical" assertion failed — correctly reflecting existing, intended reconciliation behavior, not a defect in this plan's new code.
- **Fix:** Folded both runs into the `ddr.bests.v1` fixture so reconciliation has nothing new to add, isolating the assertion to the 2.1.0-cutoff import specifically.
- **Files modified:** test/unit/runHistory-adapter.test.js (this plan's own new file, committed once, never separately)
- **Verification:** `node --test test/unit/runHistory-adapter.test.js` — 12/12 pass

---

**Total deviations:** 1 (a test-fixture correction inside this plan's own new test file, not a production-code fix and not outside `files_modified`)
**Impact on plan:** None — no scope creep, no production behavior changed.

## Issues Encountered
`storage.js`'s `getItem()` fails safe to `null` on any underlying exception by its own documented contract, so it can never actually reject/throw to `engineAdapter.js`. The plan's "a boot whose history read throws" behavior bullet was verified instead via a fully-blocked-storage boot (every `localStorage` call throws), matching `bests-adapter.test.js`'s own established "blocked storage" test pattern — the production defensive code (`safeGetItem`, `loadRunHistory`'s outer try/catch) is retained as documented defense-in-depth even though it is not reachable through the current `storage.js` contract.

## User Setup Required
None - no external service configuration required.

## Requirement Coverage

This plan's frontmatter lists `requirements: [BOARD-26]`, but it is **not** marked complete in `REQUIREMENTS.md`. Per the phase source audit table in `84-01-PLAN.md`, BOARD-26 also needs `84-08` (VIEW THE DEAD's title-gate wiring — "VIEW THE DEAD shows when you have at least one run in the history OR Compete is ON," `refreshTitleDead` moving off `getGraveyard().total`). This plan delivers the complete storage/model/adapter layer BOARD-26 needs (the history itself, the cutoff import, the per-death write, and the history-based new-best comparison) — partial coverage, correctly left `[ ]` pending until 84-08 lands.

## Human verification (deferred to end of run)

- On the Pixel 7 over an existing 2.1.0 install, the first 2.2 launch shows YOUR DEAD holding only runs from 2026-09-28 19:41 UTC on, each expanded row reading "2.1.0 (11)" (this plan writes the underlying `ddr.runs.v1` history and the version stamp; the YOUR DEAD panel itself that renders these rows ships in a later 84-plan)
- A new death's expanded row shows the installed build's version (via `setAppVersion`)
- The first death on 2.2 with an empty history shows the first-death line, and a deeper later death shows NEW PERSONAL BEST (the death-panel view itself, `newBestView`, is unchanged by this plan — it already reads `takeDeathRecord()`'s `{first, newBests, summary}` shape, which this plan now populates from the history instead of the bests boards)

## Next Phase Readiness
- `src/browser/runHistory.js`'s full pure API (`historyRecordOf`, `sanitizeHistory`, `newBestsAgainst`, etc.) and `engineAdapter.js`'s `getRunHistory()`/`loadRunHistory()` are ready for 84-05/84-06/84-07's YOUR DEAD panel view to read from directly
- 84-08 can now wire `refreshTitleDead`'s VIEW THE DEAD gate off `getRunHistory().length > 0 || Compete ON`, per the CONTEXT ruling
- No blockers for downstream 84-plans.

---
*Phase: 84-leaderboards-panel-v3*
*Completed: 2026-09-29*

## Self-Check: PASSED

All created files verified present on disk (`src/browser/runHistory.js`, `test/unit/runHistory.test.js`, `test/unit/runHistory-adapter.test.js`, `.planning/phases/84-leaderboards-panel-v3/84-03-SUMMARY.md`); all 3 task commits (`8f708adc`, `04ba0d62`, `7d0d5214`) verified present in `git log`.
