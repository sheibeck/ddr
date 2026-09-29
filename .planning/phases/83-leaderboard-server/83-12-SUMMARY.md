---
phase: 83-leaderboard-server
plan: 12
subsystem: infra
tags: [firestore, leaderboard-write, submission-queue, backfill, idempotency]

# Dependency graph
requires:
  - "83-06: src/browser/runQueue.js (createRunQueue -> enqueueMany/flush), src/browser/boardWrites.js (submitRun)"
  - "83-04: src/browser/fakeBoardServer.js (createFakeBoardFetch), src/browser/firebaseAuth.js (createIdentity)"
  - "engine/records.js: sanitizeBests, runHash, isValidHash, emptyBests, updateBests"
provides:
  - "src/browser/runBackfill.js: BACKFILL_KEY, BACKFILL_VERSION, BACKFILL_SINCE_MS, collectBackfillRuns({bests, graves, season, since}), runBackfill({storage, queue, competeOn})"
affects: ["Phase 85 (calls runBackfill() at boot when Compete is ON)", "Phase 84 (YOUR DEAD run-history import reuses BACKFILL_SINCE_MS)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A once-only device-side migration marker (ddr.boardBackfill.v1: {v:1, done:true, count}) written unconditionally at the end of the first run — even when the collected run set was empty or a local store was corrupt — so a device with nothing to backfill never re-checks on every boot"
    - "collectBackfillRuns treats a run's integrity hash (runHash, excludes `when`) as the sole tamper gate, while the cutoff comparison reads the (unhashed) `when` field directly — a forged `when` is honored as moving a real run across the cutoff rather than rejected, matching the plan's threat-model note that `when` sits outside RUN_HASH_FIELDS by design"

key-files:
  created:
    - src/browser/runBackfill.js
    - test/unit/runBackfill.test.js
  modified:
    - src/browser/runQueue.js

key-decisions:
  - "runBackfill() calls queue.enqueueMany(runs, {version: BACKFILL_VERSION}) then starts queue.flush() WITHOUT awaiting it before marking ddr.boardBackfill.v1 done — mirrors runQueue.js#enqueue's own fire-and-continue posture after its internal auto-flush, and keeps the once-only marker write from blocking on network conditions"
  - "The done marker is written even when collectBackfillRuns returns zero runs (corrupt/missing bests or graveyard stores) — there is nothing more this device could ever backfill, so re-checking on every boot would be pure overhead"
  - "No new bookkeeping for 'already queued/settled' runs: runQueue.js#enqueueMany's own alreadyKnown() dedupe (queued entries + the settled ledger) already guarantees a run submitted through the normal death-time path is never queued a second time by the backfill"

patterns-established:
  - "The runBackfill.js module shape (pure, DOM-free, injected storage+queue+competeOn, never throws) is the template Phase 84's YOUR DEAD import and Phase 85's boot wiring should read BACKFILL_SINCE_MS from directly, rather than re-deriving the cutoff timestamp"

requirements-completed: [SRV-06]

coverage:
  - id: D1
    description: "collectBackfillRuns({bests, graves, season, since}) unions sanitizeBests(bests).runs values and graveyard stones, keeping only plain objects whose season equals SEASON, whose `when` is a finite number >= BACKFILL_SINCE_MS, and whose hash is valid and equals runHash(run); deduplicated by hash, sorted `when` ascending then hash; frozen output, never mutates inputs"
    requirement: SRV-06
    verification:
      - kind: unit
        ref: "test/unit/runBackfill.test.js#collectBackfillRuns: cutoff boundary (at vs one ms before), another-season drop, season-0 stone + non-numeric `when` ignored, tampered field drops the run, a forged `when` is honored (not rejected as tampering), non-array graves + garbage bests never throw, dedupe+sort, never-mutates+frozen"
        status: pass
    human_judgment: false
  - id: D2
    description: "runBackfill({storage, queue, competeOn}): Compete OFF resolves {ok:false, reason:'off'} with zero storage reads/writes and zero queue calls; the first Compete-ON call reads ddr.bests.v1/ddr.graveyard.v1, enqueues eligible runs oldest-first stamped BACKFILL_VERSION '2.1.0 (11)', starts queue.flush(), and stores ddr.boardBackfill.v1 as {v:1, done:true, count}; a second call resolves {ok:true, skipped:true} and enqueues nothing; corrupt/missing local stores enqueue nothing but still mark done; a run already settled in the queue via the normal death-time path is not queued again; never throws even when storage/queue methods throw"
    requirement: SRV-06
    verification:
      - kind: unit
        ref: "test/unit/runBackfill.test.js#runBackfill: Compete-OFF zero-call cases (stub queue and the real fake-board stack), first-call enqueue against createFakeBoardFetch (docs stamped '2.1.0 (11)', pre-cutoff run absent, ddr.boardBackfill.v1 stored), second-call skip, corrupt/missing stores still mark done, already-settled run not re-queued, never-throws"
        status: pass
    human_judgment: false

duration: ~15min
completed: 2026-09-28
status: complete
---

# Phase 83 Plan 12: Runs From the 2.1.0 Release On (Cutoff Backfill) Summary

**`src/browser/runBackfill.js` — a once-only, device-side backfill that enqueues the player's locally recorded runs from the 2.1.0 (versionCode 11) release on ("2.1.0 (11)") onto the new leaderboard, and nothing earlier, gated on a timestamp cutoff since local records carry no app version.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 1 of 1 planned
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- `src/browser/runBackfill.js` exports `BACKFILL_KEY` ("ddr.boardBackfill.v1"), `BACKFILL_VERSION` ("2.1.0 (11)"), `BACKFILL_SINCE_MS` (`Date.UTC(2026, 8, 28, 19, 41, 1)` — the `v2.1.0-play11` tag time), `collectBackfillRuns` and `runBackfill`.
- `collectBackfillRuns({bests, graves, season, since})` unions `sanitizeBests(bests).runs` values with the raw graveyard stones array, keeping only plain objects whose `season` equals the current `content/season.js#SEASON`, whose `when` is a finite number at or after `since`, and whose `hash` is a valid 8-hex hash that equals a freshly recomputed `runHash(run)` — a tampered field (any of the 15 `RUN_HASH_FIELDS`) drops the run, while a forged `when` (deliberately outside the hashed fields, per the plan's threat model T-83-24) is honored as moving a real run across the cutoff rather than rejected. Results are deduplicated by hash (first occurrence wins), sorted `when` ascending then hash ascending, and the returned array plus every run in it are frozen; the function never mutates `bests` or `graves`.
- `runBackfill({storage, queue, competeOn})`: with Compete OFF resolves `{ok:false, reason:"off"}` making zero storage reads/writes and zero queue calls. On the first Compete-ON call it reads `ddr.bests.v1`/`ddr.graveyard.v1` (tolerant JSON parse, corrupt/missing resolves to nothing), collects eligible runs, enqueues them oldest-first through `queue.enqueueMany(runs, {version: BACKFILL_VERSION})`, starts `queue.flush()` (not awaited), and stores `ddr.boardBackfill.v1` as `{v:1, done:true, count}` where `count` is the number newly queued. A second call short-circuits to `{ok:true, skipped:true}` and touches neither the local stores' bests/graveyard reads nor the queue. Corrupt or missing local stores still mark the backfill done — there is nothing more that device could ever backfill. A run already queued or settled through the normal death-time submission path is never re-queued, via `runQueue.js#enqueueMany`'s own dedupe (no extra bookkeeping needed here). The module never throws, even when the injected `storage`/`queue` methods throw.
- `runQueue.js`'s header comment is updated: it previously asserted "this milestone ships with no one-time backfill of runs recorded before boards existed" (from 83-06's Task-3 removal); it now points at `runBackfill.js` as the once-only backfill caller of `enqueueMany()`.
- TDD gate sequence: a RED commit (`5067cebe`, test-only, confirmed failing via a moved-aside `runBackfill.js` — `ERR_MODULE_NOT_FOUND`) followed by a GREEN commit (`308c368d`, implementation + the runQueue.js header edit) with all 17 of the new file's tests, plus the full `runQueue.js`/`boardWrites.js`/`voice-corpus.js` suites (89 total), passing.

## Task Commits

Each task was committed atomically (TDD RED/GREEN):

1. **Task 1 (RED): test/unit/runBackfill.test.js** - `5067cebe` (test)
2. **Task 1 (GREEN): src/browser/runBackfill.js + runQueue.js header note** - `308c368d` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `src/browser/runBackfill.js` - `BACKFILL_KEY`, `BACKFILL_VERSION`, `BACKFILL_SINCE_MS`, `collectBackfillRuns`, `runBackfill`
- `test/unit/runBackfill.test.js` - cutoff boundary, season/hash filters, dedupe+sort, frozen/never-mutates, Compete gate, first-call enqueue against the fake board server, second-call skip, corrupt/missing stores, already-settled dedupe, never-throws, purity
- `src/browser/runQueue.js` - header comment updated to point at `runBackfill.js` as `enqueueMany()`'s once-only backfill caller (the only change outside `files_modified`, as authorized by the plan)

## Decisions Made

- `runBackfill()` starts `queue.flush()` but does not await it before writing the `ddr.boardBackfill.v1` done marker — matches `runQueue.js#enqueue`'s own fire-and-continue pattern, and keeps the once-only marker from blocking on network/backoff conditions. Callers (Phase 85) can still await the returned `flushed` promise when they need the flush outcome.
- The done marker is written unconditionally at the end of the first run, including when zero runs were collected (corrupt/missing local stores) — there's nothing more that device could ever backfill, so a future boot should never re-attempt.
- No extra "already queued/settled" bookkeeping in `runBackfill.js` itself: `runQueue.js#enqueueMany`'s existing `alreadyKnown()` dedupe (checks both pending entries and the settled ledger) already gives the "a run already submitted through the normal death-time path is never double-queued" guarantee the plan calls for.

## Deviations from Plan

None - plan executed exactly as written. The single authorized out-of-scope change (updating `runQueue.js`'s header comment, explicitly permitted by the plan's task action) was made.

## Issues Encountered

None. TDD RED was confirmed by temporarily moving `src/browser/runBackfill.js` aside (git working tree only, never committed in that state) and observing `ERR_MODULE_NOT_FOUND` across all 17 tests in the new file; the file was restored before the GREEN commit.

## User Setup Required

None - no external service configuration required. This plan is pure client code, exercised entirely against 83-04's fake `fetchFn`/`fakeBoardServer.js`, never the live project (per the run notes: "Do NOT touch the live Firebase project in this plan").

## Next Phase Readiness

- `runBackfill({storage, queue, competeOn})` is ready for Phase 85's boot wiring: call it once per boot when Compete is ON, after `storage`/`queue` are constructed the same way `queue.enqueue()` is wired at death.
- `BACKFILL_SINCE_MS` is importable from `src/browser/runBackfill.js` for Phase 84's YOUR DEAD run-history import to reuse the identical cutoff.
- No blockers.

**Verification run (this plan's scope):** `node --test test/unit/runBackfill.test.js test/unit/runQueue.test.js test/unit/boardWrites.test.js test/unit/voice-corpus.test.js` — 89 pass, 0 fail.
**Full suite (`npm test`, once at plan close):** 8258 pass, 0 fail, 2 skipped (pre-existing) — exit code 0.
**Engine gate:** `git status --porcelain -- engine test/parity content` is empty.
**Acceptance-criteria greps:** `grep -c "ddr.boardBackfill.v1" src/browser/runBackfill.js` = 3; `grep -c "2.1.0 (11)" src/browser/runBackfill.js` = 3.

**Human verification (deferred to end of run):** None — this plan ships no device-testable surface (pure client modules exercised entirely against a hand-rolled fake `fetchFn`, no UI, nothing deployed).

---
*Phase: 83-leaderboard-server*
*Completed: 2026-09-28*

## Self-Check: PASSED

All created files found on disk (`src/browser/runBackfill.js`, `test/unit/runBackfill.test.js`, `.planning/phases/83-leaderboard-server/83-12-SUMMARY.md`); both task commits (`5067cebe`, `308c368d`) found in git log.
