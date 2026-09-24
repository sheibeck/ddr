---
phase: 68-global-boards-submissions-you-placed-x
plan: 04
subsystem: play-games-submissions
status: complete
tags: [pgs, leaderboards, submission-queue, durability, dedupe, backoff, adapter-hook]
requires:
  - 68-01 src/browser/scoreTag.js (encodeTag), src/browser/boardScores.js (boardScores, SUBMIT_BOARDS, leaderboardId)
  - 68-02 provider.submitScore / provider.loadStanding and createFakePlayGames (submissions, setOnline, calls)
  - engine/records.js isValidHash
provides:
  - src/browser/engineAdapter.js setRunRecordedListener(fn)
  - src/browser/pgsQueue.js (PGS_QUEUE_KEY, QUEUE_CAP, DONE_CAP, BACKOFF_BASE_MS, BACKOFF_MAX_MS, emptyQueue, sanitizeQueue, queueEntryFor, enqueueEntry, ackBoard, settleQueue, dropStaleSeasons, backoffDelay, createSubmissionQueue)
affects: [68-07 shell wiring (listener -> queue.enqueue, Compete OFF -> purge, sign-in/reconnect -> flush force, onFlushed -> rank line/card, onSeasonDrop -> Oracle line)]
tech-stack:
  added: []
  patterns:
    - "enqueue-then-flush: the entry is durable before any submission"
    - "ack per (run hash, board) persisted before the next submit; done ledger blocks re-enqueue"
    - "generation counter bumped synchronously by purge() so an in-flight flush aborts and cannot write back"
    - "single flight + one follow-up; track()/waitForPending() drain loop mirrored from engineAdapter.js"
key-files:
  created:
    - src/browser/pgsQueue.js
    - test/unit/adapter-run-listener.test.js
    - test/unit/pgsQueue.test.js
    - test/unit/pgsQueue-flush.test.js
  modified:
    - src/browser/engineAdapter.js
decisions:
  - "The run-recorded listener also swallows an async rejection (a returned rejected promise), not only a sync throw"
  - "purge() bumps the generation synchronously at call time, before awaiting load, so no submission can start after the call"
  - "A flush pass snapshots the entry hashes at its start; an entry enqueued mid-flush is sent by the single follow-up flush"
  - "The shared in-flight promise also awaits the follow-up flush, so awaiting flush() covers everything requested meanwhile"
  - "An abort (purge, Compete OFF or sign-out mid-flush) is not a failure: no backoff, failures unchanged"
  - "A D-14 placeholder skip is not a failure; a pass with only skips still resets failures to 0"
metrics:
  duration: "~35 min"
  completed: 2026-09-24
  tasks: 3
  files: 5
---

# Phase 68 Plan 04: Submission Queue and Death Hook Summary

This plan adds a durable, deduped, single-flight Play Games submission queue in `ddr.pgsqueue.v1`. It is fed by a new run-recorded listener at the adapter's death choke point. Every non-dev Compete-ON death is written to storage before anything is sent. Each board is then submitted once to the current season's ID, and its ack is stored before the next board goes. Stale seasons are dropped and reported once, placeholder IDs are skipped, and Compete OFF is honoured by refusing new entries and purging pending ones.

## What shipped

**Task 1: adapter run-recorded listener** (`51545f9` RED, `54d0042` GREEN)
- `setRunRecordedListener(fn)` stores `fn` when it is a function. Anything else, including null, clears it.
- In `dispatch()`'s non-dev death branch, directly after `recordDeath(...)` and before `track(persistGrave(...))`, `notifyRunRecorded(summary)` calls the listener with `Object.freeze({ ...summary })`. The call is inside a try/catch, and a returned promise gets a `.catch`. The dev branch is unchanged. The change only adds exports, so the shell's pinned import line stays valid.
- 9 tests, one per behaviour in the plan:
  - the lazy path, where bests were never loaded (runs first in its own process)
  - exactly once, with a frozen copy equal to `takeDeathRecord().summary`
  - no second call on later actions
  - a dev start-at-depth death never calls it
  - a throwing listener leaves the dead state, the died event, the stored tombstone and the stored bests unchanged
  - an async-rejecting listener
  - null or a non-function unregisters
  - re-registration replaces
  - mutating the received object leaves `getGraveyard()`/`getBests()` unchanged

**Task 2: pure record operations** (`233b1e9` RED, `02d4f1e` GREEN)
- The record is `{ v: 1, entries, done }`, capped at 50 entries (the oldest is evicted) and 100 done hashes (the oldest is dropped).
- `queueEntryFor` builds `{ hash, season, tag: encodeTag(s), scores: boardScores(s), acked: [] }`. It returns null for a bad hash or season, and it never reads the epitaph (a source pin checks this).
- `enqueueEntry` refuses a hash that is already queued or already done.
- `ackBoard` is idempotent. `settleQueue` moves fully acked entries into `done`. `dropStaleSeasons` returns the count it dropped.
- `backoffDelay` gives 30 s, 60 s, 120 s, 240 s and 480 s, then caps at 600 s. It returns 0 for zero, negative or non-numeric input.
- `sanitizeQueue` rejects these malformed fields:
  - hash
  - season
  - a tag outside `^[A-Za-z0-9._~-]{1,64}$`
  - scores (every board must be a non-negative safe integer; extra keys are stripped)
  - acked (an unknown board drops the entry; duplicates are deduped)

  It also keeps the first entry when two share a hash, keeps only valid unique done hashes, applies both caps, and never throws.
- 29 tests, including the JSON round-trip precision check up to 999,999,999,999 and the insertion-order check.

**Task 3: `createSubmissionQueue` flush controller** (`c3425ac` RED, `b3a4f61` GREEN)
- It returns a frozen `{ load, enqueue, flush, purge, state, waitForPending }`, and no method throws or rejects.
- `load()` reads the key once (memoized) and sanitizes it. `enqueue` refuses while Compete is OFF and touches nothing. Otherwise it waits for the load, re-checks Compete, persists the entry, then starts a forced flush.
- `flush` allows one pass in flight. A flush requested meanwhile sets `again`, and one follow-up pass runs afterwards unless the pass failed.
- A pass first checks gen, Compete and sign-in. It drops stale seasons: `onSeasonDrop(count)` fires once and the drop is persisted. For each entry in the snapshot, and each un-acked board in `SUBMIT_BOARDS` order, it resolves the current season's ID; a null ID is skipped (D-14). It re-checks gen, Compete and sign-in before every submit, and re-checks gen after it. A failure bumps `failures` and sets `nextAllowedAt = now + backoffDelay(failures)`. A success acks the board and persists before the next submit.
- After a pass with at least one DEEPEST success, `loadStanding` is called once and `onFlushed({ submitted: [{ hash, newBest }], standing })` fires.
- `purge()` bumps the generation synchronously, clears `again` and the backoff, empties the entries (keeping `done`) and persists.
- 33 tests. They cover every behaviour in the plan, including the exact backoff boundary (29,999 ms: no call; 30,000 ms: runs) and purge during a gated in-flight submit.

## Verification

- `node --test test/unit/adapter-run-listener.test.js test/unit/bests-adapter.test.js test/unit/engineAdapter.test.js`: 62/62 pass.
- `node --test test/unit/pgsQueue-flush.test.js test/unit/pgsQueue.test.js test/unit/playGames.test.js`: 131/131 pass (run 3 times, stable).
- Adapter neighbours (graveyard-adapter, shell-account, shell-boards-panel, persistence/*, acts-counter, new-run-loop): 114/114 pass.
- `npm test`: 4861 tests, 4854 pass, 7 fail. All 7 are the known CRLF doc-ledger artifacts (class-pass-ledger 1013/1014/1015/1023, flee-ledger 1778/1779/1780). The failing set did not grow.
- Acceptance greps: `export function setRunRecordedListener` 1; `ddr.pgsqueue.v1` 1; `export function sanitizeQueue` 1; `export function createSubmissionQueue` 1.
- `git diff --stat 963dcd4 HEAD -- engine/ test/parity/` is empty. No fixture moved.
- No Android build, APK or device step.

## TDD Gate Compliance

Each task has a `test(68-04)` RED commit before its `feat(68-04)` GREEN commit: 51545f9 → 54d0042, 233b1e9 → 02d4f1e, c3425ac → b3a4f61. No refactor commits were needed.

## Deviations from Plan

**1. [Rule 2 - Robustness] The listener's async rejection is swallowed too**
- **Found during:** Task 1
- **Issue:** The plan's try/catch only covers a synchronous throw. An `async` listener, which is likely because the queue's `enqueue` is async, would surface as an unhandled rejection.
- **Fix:** A returned thenable gets `.catch(() => {})`. The same helper, `callSafely`, guards `onFlushed`/`onSeasonDrop` in the queue.
- **Files:** src/browser/engineAdapter.js, src/browser/pgsQueue.js
- **Commits:** 54d0042, b3a4f61

**2. [Rule 2 - Correctness] purge() bumps the generation synchronously; enqueue re-checks Compete after load**
- **Found during:** Task 3
- **Issue:** The plan orders purge as "await load(); gen++". A gated submit that resolves in the microtask gap could then start one more submission after `purge()` was called. Separately, an enqueue waiting on the initial load could add an entry after Compete was turned OFF.
- **Fix:** `gen`, `again`, `failures` and `nextAllowedAt` are reset at call time, and the entries are emptied after the load. `enqueue` checks `isCompeting()` again after awaiting the load.
- **Files:** src/browser/pgsQueue.js
- **Commit:** b3a4f61

The remaining choices were within the plan's discretion and are listed under decisions in the frontmatter:
- The snapshot of hashes per pass.
- The shared promise that covers the follow-up.
- Aborts are not failures.
- `load()` resolves to `state()`.
- The pass also skips an entry whose season is not current (a second guard after `dropStaleSeasons`).

## Known Stubs

None. The queue is complete; 68-07 wires it into the shell (the listener, Compete toggles, sign-in and reconnect triggers, and the rank line and Oracle copy).

## Threat Flags

None beyond the plan's threat model. The new storage key `ddr.pgsqueue.v1` is T-68-04, mitigated by `sanitizeQueue`. The submissions are T-68-05, mitigated by the Compete gate, `purge()` and the generation abort. No new network surface: every call goes through the 68-02 provider seam.

## Notes for 68-07

- Wire `setRunRecordedListener((s) => queue.enqueue(s))`. `enqueue` already refuses while Compete is OFF, so the listener needs no gate of its own.
- On Compete OFF, call `queue.purge()` after the setting is saved, so `isCompeting()` already reads false for any flush in flight.
- On sign-in success, app resume or reconnect, call `queue.flush({ force: true })`. On boot, call `queue.load()` and then `queue.flush()`. The unforced flush respects the backoff.
- Include `queue.waitForPending()` in `nativeChrome.js`'s flushOnBackground alongside `adapter.waitForPending()`.
- `onFlushed` fires only when at least one DEEPEST submission succeeded. `standing` is null when the read failed (D-11: show nothing).

## Human verification (deferred to end of run)

For the Phase 69 batch (`docs/UAT-v2.0.md`, Pixel 7). Do not pause for these:

1. Signed in with Compete ON, turn on airplane mode, die, then force-close the app. Turn airplane mode off and relaunch. The run appears on the DEEPEST board (and the other four) exactly once, with its tag.
2. With Compete ON, die while offline so the death stays queued. Turn Compete OFF, go back online, and turn Compete back ON. Confirm nothing from that queued death is ever submitted to the boards.
3. (Optional) With Compete ON but signed out, die, then sign in. The queued run submits right after sign-in.

## Self-Check: PASSED

- FOUND: src/browser/engineAdapter.js, src/browser/pgsQueue.js, test/unit/adapter-run-listener.test.js, test/unit/pgsQueue.test.js, test/unit/pgsQueue-flush.test.js
- FOUND commits: 51545f9, 54d0042, 233b1e9, 02d4f1e, c3425ac, b3a4f61
