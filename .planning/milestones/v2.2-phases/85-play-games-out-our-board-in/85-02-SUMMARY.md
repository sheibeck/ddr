---
phase: 85-play-games-out-our-board-in
plan: 02
subsystem: infra
tags: [firebase-auth, run-queue, run-backfill, board-sync, leaderboard, compete-gate]

# Dependency graph
requires:
  - phase: 83-leaderboard-server
    provides: "identity.js/boardWrites.js/runQueue.js/runBackfill.js/boardClient.js/fakeBoardServer.js — the anonymous identity, idempotent writes, the durable queue, the pre-2.2 timestamp backfill and the board read client this plan builds boardSync.js on top of"
  - phase: 84-leaderboards-panel-v3
    provides: "runHistory.js's ddr.runs.v1 local run history (hash/version-stamped records) and runDoc.js's deepKeyOf/rankKeyOf, which preReleaseHashes(history) and boardSync's placement reports read"
provides:
  - "src/browser/boardSync.js: RETIRED_KEYS, HANDLE_REWRITE_KEY, createBoardSync({storage, fetchFn, identity, client, competeOn, online, version, liveHash, onAcked, onPlacement, onChange, now, log}) -> {boot, record, flush, purge, reroll, erase, waitForPending} — the one board-side engine room 85-04/85-05's shell wiring calls into"
  - "firebaseAuth.js#setHandle(handle) — local-only, no Compete gate, re-seeds the identity record with a chosen handle"
  - "runQueue.js#waitForPending() — resolves once every persist()/purge() storage write has settled, including one started while it waits"
  - "runBackfill.js#preReleaseHashes(history) and the allowHashes bound on runBackfill() — only runs the local run history already imported as \"2.1.0 (11)\" can ever reach the board"
  - "docs/LEADERBOARDS.md sections 7-8 rewritten for boardSync's erase/re-roll/queue/backfill behavior"
affects: ["85-03 (account UI calls reroll/erase)", "85-04 (shell switch wires boot/record/flush/purge to death/resume/online/pause)", "85-05 (death screen reads onPlacement)", "85-06 (RETIRE-02 sweep allowlists boardSync.js's one ddr.pgsqueue.v1 literal)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A module-private pendingWrites Set (registered by every storage write, removed on settle) plus a wait-loop that re-snapshots the set until it drains — runQueue.js#waitForPending and boardSync.js's own waitForOwnPending both use this shape, so a caller can await 'every storage write started so far, including one that started while waiting' without holding a reference to any individual promise"
    - "flush() coalescing at two layers: runQueue.js's own single-flight flushPromise (one submitRun round at a time) wrapped by boardSync's own flushInFlight/flushQueued pair, which also gates the pending handle-rewrite step — a concurrent flush() call joins the in-flight promise and schedules at most one follow-up run, rather than re-running the rewrite-then-flush sequence per caller"
    - "settleAcks() as a serialized promise chain (settleChain = settleChain.then(doSettleOnce, doSettleOnce)) rather than a single-flight share — each call still drains whatever is in ackedRuns AT ITS TURN, so two overlapping settle triggers (e.g. record() and boot() finishing near-simultaneously) never race the same batch or silently drop acks"

key-files:
  created:
    - src/browser/boardSync.js
    - test/unit/boardSync.test.js
  modified:
    - src/browser/firebaseAuth.js
    - src/browser/runQueue.js
    - src/browser/runBackfill.js
    - test/unit/firebaseAuth.test.js
    - test/unit/runQueue.test.js
    - test/unit/runBackfill.test.js
    - docs/LEADERBOARDS.md

key-decisions:
  - "The orchestrator's 2026-09-29 amendment is implemented inside boardSync.js#boot, not runBackfill.js: a boot() call with Compete OFF checks whether the backfill's own ddr.boardBackfill.v1 marker is already set, and if not, writes it done-as-skipped ({v:1,done:true,count:0,skipped:'off'}) itself — a local write, zero network — BEFORE calling runBackfill() (whose own Compete-OFF gate/contract stayed byte-identical to Phase 83, per the plan's explicit instruction). This keeps runBackfill.js's existing tests untouched while making the 'first 2.2 launch decides' rule hold for a later Compete-ON boot"
  - "boardSync.flush()'s coalescing lives ABOVE runQueue's own single-flight flush, specifically because the pending-handle-rewrite step (writes.rewriteHandle) sits outside runQueue.js entirely — without boardSync's own flushInFlight/flushQueued gate, three concurrent flush() calls would each independently read the rewrite mark and could each fire their own rewriteHandle() network call before any of them cleared the mark"
  - "erase() remembers the identity's handle via identity.snapshot() BEFORE calling writes.eraseMyRuns() (which ends by dropping the whole identity record), then re-seeds it afterward with identity.setHandle(handle) — never identity.ensureHandle(), except as a defensive fallback when the remembered handle was somehow empty — so the 'same handle, new uid' guarantee never depends on ensureHandle's own random roll"
  - "record() started while erase() is running is refused (queue.enqueue's own Compete gate reads boardSync's `erasing` flag, not just competeOn()) rather than queued for later — a run finishing in the exact window an erase is in flight is dropped, not silently resurrected under the new identity after the erase completes"

patterns-established:
  - "boardSync.js is the one place a Play-Games-shaped 'account controller' pattern gets replaced: every board-side decision (submit, flush order, re-roll retry, erase-keeps-handle, the bounded backfill, placement reports) lives in one pure, DOM-free, fully-tested module the shell (85-04/85-05) only wires taps and lifecycle events into — no board logic in mazeworld.html itself"

requirements-completed: []  # ACCT-04/ACCT-05/ACCT-06/RETIRE-03 are in this plan's frontmatter `requirements` field but per the 85-01-PLAN.md phase source-audit table, none of the four is fully delivered until a later plan (85-03/85-04/85-05) lands — see "Requirement Coverage" below.

coverage:
  - id: D1
    description: "boardSync.record(summary) queues a non-dev Compete-ON death through the durable queue with the app version and submits it; with Compete OFF it makes zero network calls and stores nothing"
    requirement: "ACCT-04"
    verification:
      - kind: unit
        ref: "test/unit/boardSync.test.js#record: Compete ON queues, submits, acks once, and reports a live placement"
        status: pass
      - kind: unit
        ref: "test/unit/boardSync.test.js#record: Compete OFF makes zero calls, stores nothing, fires no callback"
        status: pass
    human_judgment: false
  - id: D2
    description: "After a flush acknowledges runs, boardSync reports each flush's placements from the board's DEPTH rank (cache cleared first), split into the live death and the rest folded to a count with the best rank"
    requirement: "ACCT-04"
    verification:
      - kind: unit
        ref: "test/unit/boardSync.test.js#record: offline stays queued with no ack; a later forced flush submits it and reports it in `rest`"
        status: pass
      - kind: unit
        ref: "test/unit/boardSync.test.js#flush: two runs acknowledged together report rest.count 2 with the deeper (better-ranked) run"
        status: pass
      - kind: unit
        ref: "test/unit/boardSync.test.js#settleAcks: a failed rank read reports null; onPlacement never fires when both parts are null"
        status: pass
    human_judgment: false
  - id: D3
    description: "reroll() rolls a new handle locally at once (offline and with Compete OFF too) and marks a pending rewrite; the next Compete-ON flush rewrites the handle on every board run and clears the mark; a failed rewrite keeps the mark for the next flush"
    requirement: "ACCT-05"
    verification:
      - kind: unit
        ref: "test/unit/boardSync.test.js#reroll: with Compete OFF resolves {handle, previous}, makes zero fetch calls, and stores the rewrite mark"
        status: pass
      - kind: unit
        ref: "test/unit/boardSync.test.js#reroll: rewrites the handle on every one of the player's board runs, leaves another player's untouched, and clears the mark"
        status: pass
      - kind: unit
        ref: "test/unit/boardSync.test.js#reroll: a rewrite attempt that fails offline keeps the mark"
        status: pass
      - kind: unit
        ref: "test/unit/boardSync.test.js#flush: coalesced and serialized — three concurrent calls apply a pending handle rewrite at most once"
        status: pass
    human_judgment: false
  - id: D4
    description: "erase() (Compete ON only) deletes every board run and the anonymous account, re-seeds the identity with the SAME handle and no uid, purges the unsent queue and clears the pending rewrite; local history/graveyard/bests are never touched; a failed erase leaves the identity and queue exactly as they were"
    requirement: "ACCT-06"
    verification:
      - kind: unit
        ref: "test/unit/boardSync.test.js#erase: Compete OFF resolves {ok:false, reason:'off'} with zero calls"
        status: pass
      - kind: unit
        ref: "test/unit/boardSync.test.js#erase: deletes every board run, keeps the SAME handle with uid null, purges the queue, clears the mark, fires onChange, and a later record() posts under a NEW uid with the SAME handle"
        status: pass
      - kind: unit
        ref: "test/unit/boardSync.test.js#erase: never touches ddr.runs.v1, ddr.graveyard.v1 or ddr.bests.v1"
        status: pass
      - kind: unit
        ref: "test/unit/boardSync.test.js#erase: a mid-way network failure resolves {ok:false, reason:'offline', deleted}, leaving the identity uid and queue untouched"
        status: pass
      - kind: unit
        ref: "test/unit/boardSync.test.js#record: a call started while erase() is running is refused (the gate reads the erasing flag)"
        status: pass
    human_judgment: false
  - id: D5
    description: "boot({history}) drops the retired pre-2.2 submission-queue key silently (zero network, Compete ON or OFF), leaves ddr.graveyard.v1/ddr.bests.v1 byte-identical, runs the bounded one-time 2.1.0 backfill, then flushes when Compete is ON; a device whose first 2.2 launch has Compete OFF marks the backfill done-as-skipped so a later Compete-ON launch never uploads those pre-2.2 runs"
    requirement: "RETIRE-03"
    verification:
      - kind: unit
        ref: "test/unit/boardSync.test.js#boot: removes RETIRED_KEYS silently (Compete ON and OFF), zero fetch calls with OFF"
        status: pass
      - kind: unit
        ref: "test/unit/boardSync.test.js#boot: leaves ddr.graveyard.v1 and ddr.bests.v1 byte-identical"
        status: pass
      - kind: unit
        ref: "test/unit/boardSync.test.js#boot: bounds the backfill to the local history's pre-2.2 imports and flushes it when Compete is ON"
        status: pass
      - kind: unit
        ref: "test/unit/boardSync.test.js#boot: a first launch with Compete OFF marks the backfill done-as-skipped; a later Compete-ON boot uploads nothing from it"
        status: pass
      - kind: unit
        ref: "test/unit/runBackfill.test.js#runBackfill: allowHashes bounds the upload to the local history's pre-2.2 imports — a run not in allowHashes is never queued even though it passes collectBackfillRuns"
        status: pass
      - kind: unit
        ref: "test/unit/runBackfill.test.js#runBackfill: a missing, non-array, non-Set allowHashes counts as empty — nothing is queued"
        status: pass
    human_judgment: false
  - id: D6
    description: "waitForPending() resolves once every storage write the queue and boardSync started has settled (network is never awaited)"
    requirement: null
    verification:
      - kind: unit
        ref: "test/unit/runQueue.test.js#waitForPending: resolves only after the write an enqueue started (not awaited by the caller) has settled"
        status: pass
      - kind: unit
        ref: "test/unit/runQueue.test.js#waitForPending: a write started WHILE it is already waiting is also awaited"
        status: pass
      - kind: unit
        ref: "test/unit/boardSync.test.js#waitForPending: resolves after the queue's own storage write from an un-awaited record() call settles"
        status: pass
    human_judgment: false

# Metrics
duration: 35min
completed: 2026-09-29
status: complete
---

# Phase 85 Plan 02: The Board-Side Engine Room (boardSync.js) Summary

**One pure, DOM-free `src/browser/boardSync.js` module that decides every board-side behaviour Phase 85 needs — death-time submission, coalesced flush with a pending handle rewrite, the offline re-roll retry, erase-that-keeps-the-handle, the once-only 2.1.0 backfill now bounded to the local run history's own pre-2.2 imports, the retired pre-2.2 queue-key drop, and DEPTH-rank placement reports — proved end-to-end against `fakeBoardServer.js`, with zero changes to `mazeworld.html`.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3
- **Files modified:** 9 (2 created, 7 modified)

## Accomplishments

- `src/browser/firebaseAuth.js#setHandle(handle)`: a local-only, no-Compete-gate primitive that re-seeds the identity record with a chosen handle (uid/tokens untouched when present) — the piece `boardSync.js#erase` needed to keep the player's handle across a board-only identity drop.
- `src/browser/runQueue.js#waitForPending()`: tracks every `persist()`/`purge()` storage write in a module-private set and resolves once the set drains, including a write started while it is already waiting — the shell's native pause path awaits this, never a flush.
- `src/browser/runBackfill.js#preReleaseHashes(history)` plus an `allowHashes` bound on `runBackfill()`: the backfill can now only ever upload runs whose hash the local run history already imported and stamped `"2.1.0 (11)"` — closing the gap where a 2.2 run played with Compete OFF could otherwise be queued stamped `"2.1.0 (11)"` the first time Compete turned ON.
- `src/browser/boardSync.js`'s `createBoardSync()` returns `{boot, record, flush, purge, reroll, erase, waitForPending}`:
  - `record(summary)` — Compete ON: queues, submits, acks, reports the run's DEPTH placement. Compete OFF: zero network, zero storage.
  - `flush({force})` — coalesced (three concurrent calls collapse into at most one follow-up run) and serialized; applies any pending handle rewrite before draining the queue, clearing the rewrite mark only on success.
  - `reroll()` — rolls a new handle at once, even offline/Compete OFF, and leaves a pending-rewrite mark a later Compete-ON flush clears.
  - `erase()` — Compete ON only; deletes every board run and the anonymous account, then `identity.setHandle(handle)` re-seeds the SAME handle with no uid; purges the queue only on success; a mid-way failure leaves the identity and queue exactly as they were; a `record()` started mid-erase is refused via an `erasing` flag the queue's own Compete gate reads.
  - `boot({history})` — drops the one retired pre-2.2 submission-queue key silently (Compete ON or OFF); runs the once-only backfill bounded to `preReleaseHashes(history)`; **implements the orchestrator's 2026-09-29 amendment**: a device whose first 2.2 launch has Compete OFF writes the backfill's own "done" marker as skipped right here (a local write, zero network), so a later Compete-ON boot's `runBackfill()` call sees it already done and uploads nothing.
  - `waitForPending()` — the queue's own tracked writes plus boardSync's own (the rewrite mark, the retired-key removal, the skip marker).
- `docs/LEADERBOARDS.md` sections 7-8 rewritten to describe the shipped erase/re-roll/queue/backfill behavior, including the `preReleaseHashes` bound and the first-2.2-launch-decides-Compete ruling.

## Task Commits

Each task was committed atomically:

1. **Task 1: identity.setHandle, the queue's waitForPending, and the backfill bounded to pre-2.2 runs** - `e0fa2791` (feat)
2. **Task 2: src/browser/boardSync.js — submission, flush, re-roll, erase, boot and placement reports** - `2901499a` (feat)
3. **Task 3: docs/LEADERBOARDS.md sections 7 and 8 describe what Phase 85 ships** - `4abd232c` (docs)

## Files Created/Modified

- `src/browser/boardSync.js` - `RETIRED_KEYS`, `HANDLE_REWRITE_KEY`, `createBoardSync` (`boot`/`record`/`flush`/`purge`/`reroll`/`erase`/`waitForPending`)
- `test/unit/boardSync.test.js` - end-to-end proof against `fakeBoardServer.js`, a real `createIdentity`/`createBoardClient`: record/flush/reroll/erase/boot/waitForPending, coalescing, placement reports, purity
- `src/browser/firebaseAuth.js` - `setHandle(handle)` added to `createIdentity`'s returned object
- `src/browser/runQueue.js` - `waitForPending()`; `persist()`/`purge()` now route their storage write through a tracked-write helper
- `src/browser/runBackfill.js` - `preReleaseHashes(history)`; `runBackfill()` takes and applies an `allowHashes` bound
- `test/unit/firebaseAuth.test.js` - `setHandle` tests (empty record, existing uid/tokens preserved, invalid handle, zero fetch calls)
- `test/unit/runQueue.test.js` - `waitForPending` tests (immediate resolve, awaits an un-awaited write, awaits a write started while waiting, tracks `purge()`'s own write)
- `test/unit/runBackfill.test.js` - `preReleaseHashes` tests; every existing Compete-ON test given an explicit `allowHashes`; new allowHashes-bound and missing/non-iterable-allowHashes tests
- `docs/LEADERBOARDS.md` - sections 7 ("Identity") and 8 ("The queue and the backfill") rewritten for the shipped boardSync.js behavior

## Decisions Made

- The orchestrator's 2026-09-29 amendment (backfill decided at the FIRST 2.2 launch, not the first Compete-ON launch) is implemented inside `boardSync.js#boot`, not `runBackfill.js` — `runBackfill()`'s own Compete-OFF gate and contract stayed byte-identical to Phase 83 (per the plan's explicit instruction, keeping its existing tests untouched), while `boot()` itself writes the backfill's `ddr.boardBackfill.v1` marker as `{v:1, done:true, count:0, skipped:"off"}` on a first-ever OFF boot, before ever calling `runBackfill()`.
- `flush()`'s coalescing lives at the boardSync layer, ABOVE `runQueue.js`'s own single-flight flush, specifically because the pending-handle-rewrite step (`writes.rewriteHandle`) sits outside `runQueue.js` entirely — without boardSync's own `flushInFlight`/`flushQueued` gate, three concurrent `flush()` calls could each independently read the rewrite mark and each fire their own `rewriteHandle()` network call before any of them cleared the mark.
- `erase()` remembers the identity's handle via `identity.snapshot()` BEFORE calling `writes.eraseMyRuns()` (which ends by dropping the whole identity record), then re-seeds it afterward with `identity.setHandle(handle)` — `identity.ensureHandle()` is only a defensive fallback for the (unreachable in practice) case where the remembered handle was empty — so the "same handle, new uid" guarantee never depends on a fresh random roll.
- `record()` started while `erase()` is running is refused (`{ok:false, reason:"off"}`) rather than queued for later: `queue.enqueue`'s own Compete gate reads boardSync's private `erasing` flag (via the `gate()` closure passed as `competeOn`), not just `competeOn()` — a run finishing in the exact window an erase is in flight is dropped, not silently resurrected under the new identity afterward.
- `settleAcks()` is a serialized promise chain (`settleChain = settleChain.then(doSettleOnce, doSettleOnce)`), not a single-flight share — each call still drains whatever is in the acked-runs list AT ITS OWN TURN, so two overlapping settle triggers can't race the same batch or silently drop an acknowledgement.

## Deviations from Plan

None - plan executed exactly as written, including the orchestrator's 2026-09-29 amendment at the top of 85-02-PLAN.md (the backfill's Compete decision moved to the first 2.2 launch, implemented as described above).

## Issues Encountered

None beyond the expected TDD iteration: two test-authoring races were caught and fixed before their respective commits — a `waitForPending` test (both in `runQueue.test.js` and `boardSync.test.js`) that called `waitForPending()` in the exact same microtask tick as the fire-and-forget write it was meant to observe, before that write's `await load()` chain had reached the tracked `persist()` call (fixed with a `setTimeout(r, 0)` yield before checking); and a `flush()` coalescing test whose seeded run already carried the player's current handle, so the rewrite-handle step legitimately found nothing to update (`updated: 0`, zero commit calls) — fixed by re-rolling the handle via `identity.rerollHandle()` directly before setting the pending-rewrite mark, so the rewrite had real work to do.

## User Setup Required

None - no external service configuration required. This plan is pure client code, exercised entirely against `src/browser/fakeBoardServer.js`, never the live project.

## Requirement Coverage

This plan's frontmatter lists `requirements: [ACCT-04, ACCT-05, ACCT-06, RETIRE-03]`, but none are marked complete in `REQUIREMENTS.md` here. Per the phase source-audit table in `85-01-PLAN.md`:
- ACCT-04 also needs **85-04, 85-05** (last deliverer)
- ACCT-05 also needs 85-03, **85-04** (last deliverer)
- ACCT-06 also needs **85-04** (last deliverer)
- RETIRE-03 also needs **85-04** (settings keys; last deliverer)

This plan delivers the full board-side engine room those later plans wire into (the record/flush/reroll/erase/boot API this plan's own tests prove end-to-end) — partial coverage, correctly left `[ ]` pending until their respective last-deliverer plans land.

## Next Phase Readiness

- `src/browser/boardSync.js`'s full `{boot, record, flush, purge, reroll, erase, waitForPending}` API is ready for 85-03's account UI (reroll/erase behind ☰ rows) and 85-04's shell switch (death → `record()`, resume/online → `flush()`, Compete OFF → `purge()`, native pause → `waitForPending()`, launch → `boot({history})` with `engineAdapter.js#getRunHistory()`).
- `onPlacement`'s `{live, rest}` shape is ready for 85-05's death-screen "You placed X" rewrite.
- No blockers.

**Verification run (this plan's scope):** `node --test test/unit/boardSync.test.js test/unit/firebaseAuth.test.js test/unit/runQueue.test.js test/unit/runBackfill.test.js` — 112 pass, 0 fail.
**Full suite (`npm test`, once at plan close):** 8383 pass, 0 fail, 2 skipped (pre-existing) — exit code 0.
**Engine gate:** `git status --porcelain -- engine test/parity content` is empty.
**Acceptance-criteria greps:** all Task 1/2/3 greps in 85-02-PLAN.md pass (verified individually during execution).

**Human verification (deferred to end of run):** None — this plan ships no device-testable surface (pure modules exercised entirely against a hand-rolled fake `fetchFn`, no UI, nothing wired into `mazeworld.html`). The device checks for the board-side behaviors this plan powers are listed in 85-04's and 85-05's SUMMARYs.

---
*Phase: 85-play-games-out-our-board-in*
*Completed: 2026-09-29*

## Self-Check: PASSED

All created files found on disk (`src/browser/boardSync.js`, `test/unit/boardSync.test.js`, `.planning/phases/85-play-games-out-our-board-in/85-02-SUMMARY.md`); all three task commits (`e0fa2791`, `2901499a`, `4abd232c`) found in `git log`.
