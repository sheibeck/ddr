---
phase: 66-leaderboards-panel-local
plan: 01
subsystem: engine
tags: [records, bests, graveyard, leaderboards, storage-seam]

# Dependency graph
requires:
  - phase: 65-run-record-personal-bests
    provides: "engine/records.js's runHash/compareRuns/sanitizeBests/updateBests/backfillBests and src/browser/engineAdapter.js's loadBests/getBests/recordDeath/persistGrave"
provides:
  - "compareRuns('lean', ...) as a dedicated squares-per-floor comparator, distinct from DEEPEST"
  - "leanRate(run) — the LEANEST metric, exported for the panel's value bar and Phase 68's submission"
  - "normalizeStone(stone) — shared legacy-stone normalization (backfillBests + the graveyard read seam hash identically)"
  - "sanitizeBests re-ranking every stored board list by its current comparator before the top-ten cut"
  - "src/browser/engineAdapter.js#loadGraveyard()/getGraveyard() — a synchronous { graves, total } snapshot read at boot and folded at every non-dev death"
affects: [66-02-content-boards, 66-03-boardsPanel-view-model, 66-04-boardsPanel-shell, 67-play-games-integration, 68-global-boards-submission]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Comparator-per-board branch in compareRuns, with a dedicated cross-multiplied rate compare for LEANEST (no floating-point division ever decides an order)"
    - "sanitizeBests as the one re-ranking choke point: any stored board list re-sorts by its board's current comparator on every load, making a comparator change retroactive without a record version bump"
    - "Adapter-owned, replace-never-mutate module snapshots (graveyard mirrors bests's existing posture): null until loaded, folded synchronously at the one death choke point in dispatch(), never touched by initRun()/startNewRun()"

key-files:
  created:
    - test/unit/graveyard-adapter.test.js
  modified:
    - engine/records.js
    - test/unit/records.test.js
    - src/browser/engineAdapter.js

key-decisions:
  - "LEANEST's tie-break order is rate asc, then floor desc, then steps asc — an equal cross-multiplied rate always favors the deeper run, so a legitimate 1/3-vs-2/6 tie never gets decided by floating-point rounding"
  - "loadGraveyard()'s total fallback uses the uncapped filtered stone count (not the GRAVE_CAP-sliced array length) as its 'stone count' baseline, mirroring persistGrave()'s own prevGraves.length convention — so total is never short-changed by the 60-stone display cap"
  - "normalizeStone was extracted verbatim from backfillBests's prior inline logic (no behavior change) so the future graveyard seam can hash a legacy stone identically to its backfilled bests entry"

requirements-completed: [BOARD-02, BOARD-03, BOARD-08]

coverage:
  - id: D1
    description: "LEANEST ranks by squares per floor (cross-multiplied, no rounding), with deterministic tie-breaks (deeper floor, then fewer steps) and an unplaced run always ranking last"
    requirement: "BOARD-03"
    verification:
      - kind: unit
        ref: "test/unit/records.test.js#compareRuns lean: squares per floor asc — a lower rate wins even at a shallower floor"
        status: pass
      - kind: unit
        ref: "test/unit/records.test.js#compareRuns lean: an equal rate (cross-multiplied, no rounding) ties to the deeper floor, then fewer steps"
        status: pass
      - kind: unit
        ref: "test/unit/records.test.js#compareRuns lean: a full tie returns 0, and 200 generated pairs (including missing/NaN/Infinity fields) never return NaN"
        status: pass
    human_judgment: false
  - id: D2
    description: "sanitizeBests re-ranks every stored board list by its board's current comparator before the top-ten cut, so an older record's LEANEST list (stored in the retired depth order) loads re-ranked, and the operation is idempotent"
    requirement: "BOARD-08"
    verification:
      - kind: unit
        ref: "test/unit/records.test.js#sanitizeBests re-ranks a hand-built boards.lean list stored in the retired depth order"
        status: pass
      - kind: unit
        ref: "test/unit/records.test.js#sanitizeBests is idempotent over its own output, and leaves an updateBests-produced record unchanged"
        status: pass
      - kind: unit
        ref: "test/unit/records.test.js#sanitizeBests keeps stored order for two runs tied on every ordering key"
        status: pass
    human_judgment: false
  - id: D3
    description: "normalizeStone(stone) shared by backfillBests, so a legacy stone hashes identically whether backfilled into bests or read by the graveyard seam"
    requirement: "BOARD-02"
    verification:
      - kind: unit
        ref: "test/unit/records.test.js#normalizeStone(legacyStone).hash equals the key backfillBests([legacyStone]).runs holds for it"
        status: pass
      - kind: unit
        ref: "test/unit/records.test.js#normalizeStone never mutates its input"
        status: pass
    human_judgment: false
  - id: D4
    description: "loadGraveyard()/getGraveyard(): a synchronous, lifetime-accurate { graves, total } snapshot loaded at boot and updated at every non-dev death, through storage.js only, never rejecting"
    requirement: "BOARD-02"
    verification:
      - kind: unit
        ref: "test/unit/graveyard-adapter.test.js (16 tests: both-keys-missing, total fallback rules, corrupt/non-object filtering, 70-to-60 cap, storage-throws, boot() load, synchronous death fold, 60-stone cap, dev exclusion, initRun/startNewRun non-reset, persistence agreement)"
        status: pass
      - kind: unit
        ref: "test/unit/bests-adapter.test.js, test/unit/engineAdapter.test.js, test/persistence/dual-write-convergence.test.js"
        status: pass
    human_judgment: false
  - id: D5
    description: "Engine gate held: comparator-only change to engine/records.js, no GameState field, no rng draw, zero parity fixtures moved"
    verification:
      - kind: unit
        ref: "test/parity/ (48/48), test/unit/engine-purity.test.js"
        status: pass
      - kind: other
        ref: "git diff --stat -- test/parity/fixtures/ test/parity/prototype-master.js.txt test/parity/FIXTURE-INVENTORY.md (empty output)"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-09-23
status: complete
---

# Phase 66 Plan 01: Records comparator + graveyard read seam Summary

**LEANEST re-ranked by squares-per-floor (cross-multiplied, no rounding), sanitizeBests now re-sorts every stored board on load, and a new synchronous `loadGraveyard()`/`getGraveyard()` seam gives the adapter a lifetime-accurate `{ graves, total }` snapshot folded at every non-dev death.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 2 completed
- **Files modified:** 4 (1 created)

## Accomplishments

- `compareRuns("lean", ...)` is now its own branch: squares-per-floor ascending via cross-multiplication (never division), falling through to floor-desc then steps-asc on a genuine tie; an unplaced run (floor below 1) always ranks last.
- New export `leanRate(run)` — the LEANEST metric (`steps/floor`, `Infinity` when unplaced) for the panel's value bar and Phase 68's score submission.
- New export `normalizeStone(stone)` — the legacy-stone normalization extracted verbatim from `backfillBests`'s prior inline logic, now shared so the future graveyard read seam can hash a legacy stone identically to its backfilled bests entry.
- `sanitizeBests` stable-sorts every `RANKED_BOARDS` list by its board's current comparator before the top-ten cut, so an older `ddr.bests.v1` record whose LEANEST list was stored in the retired depth order re-ranks on load — idempotent, and a record already produced by `updateBests` is unchanged.
- New adapter exports `loadGraveyard()`/`getGraveyard()` (`src/browser/engineAdapter.js`): a synchronous `{ graves, total }` snapshot loaded at `boot()` (right after `loadBests()`), folded synchronously into memory at every non-dev death inside `recordDeath()` (before any `await`), and seeded by `persistGrave()`'s lazy path if a death ever races ahead of `boot()`. `total` is the stored lifetime count when it's a valid non-negative integer, otherwise (and always, via `Math.max`) never less than the actual stone count.

## Task Commits

Each task was committed atomically:

1. **Task 1: LEANEST by squares per floor, leanRate, normalizeStone, and a re-ranking sanitizeBests** - `58bd61e` (feat)
2. **Task 2: the adapter's graveyard read seam: loadGraveyard, getGraveyard and the synchronous death fold** - `48342b2` (feat)

_No TDD RED/GREEN split was used — both tasks are `tdd="true"` in the plan but were implemented and verified together per task (behavior + tests written and run as a unit before commit), matching this repo's existing engine/records.js and engineAdapter.js commit conventions from Phase 65._

## Files Created/Modified

- `engine/records.js` - `compareRuns`'s new "lean" branch; new `leanRate`/`normalizeStone` exports; `sanitizeBests` now re-ranks each board list before the top-ten cut; `backfillBests` delegates to `normalizeStone`
- `test/unit/records.test.js` - split the old "compareRuns deep/lean" test into a deep-only test; added LEANEST comparator tests (rate ordering, the 1/3-vs-2/6 rounding trap, placed-vs-unplaced, full-tie/NaN sweep), `leanRate` tests, `updateBests` lean-ordering test, `sanitizeBests` re-rank/idempotency/tie-order tests, and `normalizeStone` tests
- `src/browser/engineAdapter.js` - new module state `graveyard`; `loadGraveyard()`/`getGraveyard()` exports; `boot()` calls `loadGraveyard()` after `loadBests()`; `recordDeath()` folds the death into `graveyard` synchronously before the bests branch; `persistGrave()` seeds `graveyard` when it raced ahead of boot
- `test/unit/graveyard-adapter.test.js` (new) - 16 tests covering every behaviour bullet: both-keys-missing, total fallback rules (missing/invalid/larger-of), corrupt/non-object filtering, the 70-to-60 cap, a throwing storage read, `boot()` population, the synchronous death fold, the 60-stone cap holding while total keeps counting, dev-run exclusion, `initRun`/`startNewRun` never resetting it, and post-flush persistence agreement

## Re-pinned Tests (before/after)

Per the plan's instruction to list any test whose assertions encoded "lean orders exactly like deep":

- **`test/unit/records.test.js` — "compareRuns deep/lean: floor desc, then steps asc"** (before: asserted `compareRuns("deep", ...)` and `compareRuns("lean", ...)` agree on both a floor-desc case and a same-floor tie) → **split into "compareRuns deep: floor desc, then steps asc"** (the deep assertions unchanged, the deep/lean cross-comparison assertion removed since lean now has its own rule) **and a new "compareRuns lean: ..." test block** covering the new squares-per-floor rule.
- No other test file needed a re-pin: `test/unit/bests-adapter.test.js`'s "a deeper run announces new bests on deep and lean" test still passes unedited — both runs in that test dispatch `abandon` with zero moves taken (`steps: 0`), so their LEANEST rates tie at 0 and the existing floor-desc tie-break (deeper wins) still produces the same `newBests` outcome the test already asserted. `test/unit/newBest.test.js`'s "lean" usages are display-only (`newBestValueText`/`BOARD_COPY` keys), not order-dependent, and needed no changes.

**Zero parity fixtures moved.** `git diff --stat -- test/parity/fixtures/ test/parity/prototype-master.js.txt test/parity/FIXTURE-INVENTORY.md` produced no output; `test/parity/` (48/48) and `test/unit/engine-purity.test.js` (9/9) both pass unchanged. This is a comparator-only change in `engine/records.js`: no GameState field, no rng draw, no `type:` event literal.

## Decisions Made

- LEANEST's cross-multiplication compare (`a.steps * b.floor - b.steps * a.floor`) replaces any division, so floating-point rounding can never falsely tie or falsely order two rates (proven by the 1/3-vs-2/6 test case).
- `loadGraveyard()`'s total-fallback "stone count" is the uncapped filtered array length (before the `GRAVE_CAP` slice), not the capped `graves.length` — this mirrors `persistGrave()`'s own `prevGraves.length` fallback convention exactly, so a hypothetical corrupt store with more than 60 raw stones still reports an honest total rather than under-counting by the display cap.
- `normalizeStone` was extracted as a byte-for-byte behavior-preserving refactor of `backfillBests`'s prior inline stone normalization — no test needed to change to prove `backfillBests` is unaffected (all pre-existing `backfillBests` tests pass unedited).

## Deviations from Plan

None — plan executed exactly as written. Both tasks' `<behavior>`, `<action>` and `<acceptance_criteria>` blocks were implemented and verified as specified.

## Known Stubs

None — this plan is data-layer only (no UI/rendering); nothing here reaches a screen yet.

## Threat Flags

None — this plan is a pure comparator change plus a read-only, adapter-local in-memory snapshot fed by the same `storage.js` abstraction and `GRAVE_KEY`/`GRAVE_TOTAL_KEY` keys already read/written by the existing `persistGrave()`. No new network surface, auth path, file access pattern, or schema/trust-boundary change.

## Issues Encountered

None.

## Human verification (deferred to end of run)

None new from this plan (data layer only — no screen, no device-visible behavior yet). The panel that will surface `getGraveyard()`/the re-ranked LEANEST board lands in later plans (66-03/66-04) and will carry its own device checks in the milestone-close UAT batch per the deferred-UAT protocol.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `engine/records.js` now exports `leanRate` and `normalizeStone` for 66-04's `boardsView` view-model to consume, and `compareRuns("lean", ...)` is ready to feed the panel's LEANEST board without further comparator changes.
- `src/browser/engineAdapter.js#getGraveyard()` gives 66-04/66-06/66-07 a synchronous read seam for the panel and the title's VIEW THE DEAD gate — no direct storage reads needed anywhere downstream.
- No blockers for 66-02 (content/boards.js marks/colours/footnotes) or 66-03 (boardsPanel.js view model), which run in parallel worktrees against this same base commit.

---
*Phase: 66-leaderboards-panel-local*
*Completed: 2026-09-23*

## Self-Check: PASSED

All created/modified files verified present (engine/records.js, test/unit/records.test.js, src/browser/engineAdapter.js, test/unit/graveyard-adapter.test.js, this SUMMARY.md). Both task commit hashes (58bd61e, 48342b2) verified present in `git log --oneline --all`.
