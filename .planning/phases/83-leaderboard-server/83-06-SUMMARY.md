---
phase: 83-leaderboard-server
plan: 06
subsystem: infra
tags: [firestore, firebase, rest-api, leaderboard-write, submission-queue, idempotency]

# Dependency graph
requires:
  - "83-01: src/browser/firebaseConfig.js, src/browser/firestoreRest.js (timedFetch/readJson/restError/firestoreUrl)"
  - "83-02: src/browser/runDoc.js (buildRunDoc/createRunCommit/handleUpdateCommit/deleteCommit/ownRunsQuery/LIST_LIMIT_MAX/RUN_COLLECTION)"
  - "83-03: src/browser/firebaseAuth.js (createIdentity: getToken/forceRefresh/snapshot/deleteAccount/drop)"
  - "83-04: src/browser/fakeBoardServer.js (createFakeBoardFetch), src/browser/boardClient.js (decodeRunDocument)"
provides:
  - "src/browser/boardWrites.js: WRITE_REASONS, classifyWrite, createBoardWrites({fetchFn, identity, config}) -> {submitRun, rewriteHandle, eraseMyRuns}"
  - "src/browser/runQueue.js: RUN_QUEUE_KEY, QUEUE_MAX, SETTLED_MAX, BACKOFF_BASE_MS, BACKOFF_MAX_MS, backoffMs, sanitizeQueue, createRunQueue({storage, writes, competeOn, online, now, log, onAck}) -> {enqueue, enqueueMany, flush, purge, snapshot}"
affects: ["Phase 85 (submission at death, ☰ handle re-roll / erase-your-runs, purge on Compete OFF)", "83-08 (live smoke test)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The GET-settled idempotence argument: a run create always carries createRunCommit's exists=false precondition; boardWrites.js#classifyWrite treats every possible 'already there' answer (400/403/409) as one 'ambiguous' class, resolved by exactly one public GET of runs/{id} — a 200 whose decoded uid matches is acknowledged as exists, a 404 is the ORIGINAL create response's own refusal (e.g. PERMISSION_DENIED for a banned uid, not a synthesized 404 reason)"
    - "A single shared one-retry-on-auth budget per outer call (a tokenBox {idToken, uid, retried} mutated in place across however many paged requests one rewriteHandle()/eraseMyRuns() call makes), rather than one retry per HTTP request — matches the plan's singular 'retries once' wording"
    - "Record-level (not per-entry) backoff in runQueue.js: `failures`/`retryAt` live on the queue record itself, advance on ANY transient outcome, and reset only on a fully-drained flush — a single stuck entry cannot wedge the whole record forever without the flush stopping there anyway (order is preserved, the entry stays at the front for the next attempt)"
    - "flush() single-flight via a synchronously-assigned closure promise (`flushPromise = runFlush(opts).finally(...)`, matching firebaseAuth.js's signUp()/refresh() in-flight pattern): two flush() calls issued in the same tick return the literal same Promise reference, guaranteeing one submitRun call per entry even under concurrent callers"

key-files:
  created:
    - src/browser/boardWrites.js
    - test/unit/boardWrites.test.js
    - src/browser/runQueue.js
    - test/unit/runQueue.test.js
  modified: []

key-decisions:
  - "The ambiguous-create GET resolution always reports the ORIGINAL create response's error status (e.g. PERMISSION_DENIED), not the GET's own 404 — so a banned uid's refused create reads the same whichever of the three live Firestore duplicate-create answers (400/403/409) turns out to be real, closing RESEARCH Pitfall 1 / Assumption A3 exactly as specified"
  - "Non-create writes (handle-update, delete, the own-runs list query) collapse both 'ambiguous' and 'refused' REST classifications into a single 'refused' outcome — there is no create-time idempotence question for those endpoints, so the extra GET round-trip classifyWrite performs for submitRun would be meaningless overhead here"
  - "runQueue.js's transient-failure branch treats a missing/unrecognized submitRun reason the same as 'server' (`reason || 'server'`) rather than throwing or silently dropping the entry — a defensive default that keeps a future boardWrites reason id from ever wedging or losing a queued entry"
  - "eraseMyRuns() always re-queries the FIRST page of the caller's own runs on every loop iteration (never advances a cursor) since each successful delete round shrinks the live result set from the front; rewriteHandle() instead advances afterName because updates don't remove documents from the page ordering"

patterns-established:
  - "boardWrites.js's requestWithRetry/tokenBox shape is the template runQueue.js and any later Phase 83+ paged, bearer-authorized write path should reuse for its own one-retry-on-auth budget"
  - "runQueue.js's persist-before-network / single-flight-flush / record-level-backoff shape mirrors src/browser/pgsQueue.js's own established durable-queue pattern (Phase 68), adapted to REST submitRun instead of a Play Games provider — Phase 85's shell wiring (enqueue at death, flush on resume/online, purge on Compete OFF) can lean on this queue exactly the way it already leans on pgsQueue.js today"

requirements-completed: [SRV-06]

coverage:
  - id: D1
    description: "boardWrites.js#submitRun creates runs/{uid}_{hash} through one :commit POST with the exists=false precondition; a duplicate create's ambiguous 400/403/409 answer (all three fake existsResponse modes) is resolved by exactly one public GET and acknowledged as 'exists'; a create genuinely refused (banned uid, doc never landed) resolves 'refused' with the original REST status; a summary the JS mirror refuses never reaches :commit; a 401 forces one forceRefresh + one retry (a second 401 resolves 'auth'); offline/a stub 503/Compete-OFF resolve offline/server/off with the documented zero-call gates"
    requirement: SRV-01
    verification:
      - kind: unit
        ref: "test/unit/boardWrites.test.js#submitRun: created, exists (all 3 existsResponse modes, exactly one GET), refused (banned uid), invalid (no :commit), 401 retry-once (success and a second 401), offline, stub 503, Compete OFF"
        status: pass
    human_judgment: false
    note: "SRV-01 names the LIVE Firestore project (delve-die-repeat-6ba5f) explicitly; this plan proves the full client-side idempotence contract against the fake board server (83-04), which mirrors the live rules contract byte-for-byte, but has never made a real network call. REQUIREMENTS.md's SRV-01 checkbox is intentionally left unchecked — live proof is 83-08's job."
  - id: D2
    description: "rewriteHandle(handle) pages the caller's own runs (LIST_LIMIT_MAX=50/page) and rewrites handle via handle-only commits, updating exactly the caller's own runs and leaving another player's untouched; a missing uid or an invalid handle short-circuits to zero requests. eraseMyRuns() deletes every one of the caller's own runs (paged, re-queried from the front each round), deletes the anonymous account best-effort, then drops ddr.identity.v1; a mid-way network failure leaves the identity stored with a partial deleted count"
    requirement: SRV-05
    verification:
      - kind: unit
        ref: "test/unit/boardWrites.test.js#rewriteHandle: 120+5 seeded runs update exactly the 120, zero-call no-uid/invalid-handle cases"
        status: pass
      - kind: unit
        ref: "test/unit/boardWrites.test.js#eraseMyRuns: deletes all 120, leaves another player's 5, deletes the account, drops the identity; a mid-way offline failure keeps the identity stored with the partial count"
        status: pass
    human_judgment: false
    note: "CONTEXT 'Identity & the @handle': a re-roll rewrites handle on every one of the player's existing runs, and erase = owner deletes all runs then drops ddr.identity.v1 — both delivered here. SRV-05 was already checked by 83-01/83-03; this plan's contribution is the network-side implementation those decisions required."
  - id: D3
    description: "runQueue.js's ddr.runQueue.v1 record accepts only non-dev, Compete-ON, current-season, valid-hash entries; persists before any network call; flush() is single-flight, drains entries in enqueue order through writes.submitRun, settles created/exists (onAck fires) and refused/invalid (logged and dropped) entries, and stops on any transient outcome (offline/server/auth/unavailable) leaving the rest queued in order; record-level backoff (30 s doubling to a 30-minute cap) governs unforced retries, flush({force:true}) ignores it; a corrupt or absent store loads empty; a relaunch (a fresh createRunQueue over the same storage) picks the pending entries back up; purge() discards the queue; more than 200 entries drops the oldest with a logged line; enqueueMany queues a whole batch in one persist with zero requests"
    requirement: SRV-06
    verification:
      - kind: unit
        ref: "test/unit/runQueue.test.js#enqueue: dev/off/invalid refusals with zero storage writes and zero submitRun calls"
        status: pass
      - kind: unit
        ref: "test/unit/runQueue.test.js#enqueue: persists before any network call, flushes, settles, calls onAck once; duplicate (queued or settled) causes no second create"
        status: pass
      - kind: unit
        ref: "test/unit/runQueue.test.js#flush: two calls share one in-flight promise; online() false is a zero-request offline; a transient failure sets failures/retryAt (30000, then 60000 after a forced retry), an unforced flush inside the window is a zero-request backoff"
        status: pass
      - kind: unit
        ref: "test/unit/runQueue.test.js#flush: a refused (banned-uid) entry is dropped with a '[runQueue] dropped ... refused' log line and the next entry still runs in the same flush; an already-existing doc is acknowledged and removed, a later transient failure stops the flush with the rest kept in order"
        status: pass
      - kind: unit
        ref: "test/unit/runQueue.test.js#relaunch: a fresh createRunQueue over the same storage loads and flushes pending entries; a corrupt stored record loads empty; purge() removes the key and zeroes the record; QUEUE_MAX+5 entries drops the 5 oldest with an 'overflow' log line; enqueueMany queues a whole batch in one persist with zero requests, and gates on Compete OFF"
        status: pass
      - kind: unit
        ref: "test/unit/runQueue.test.js#backoffMs(1)=30000, backoffMs(2)=60000, backoffMs(20)=1800000; sanitizeQueue tolerant-load coverage; purity (both files)"
        status: pass
    human_judgment: false

duration: 55min
completed: 2026-09-28
status: complete
---

# Phase 83 Plan 06: Board Write Client and the Durable Submission Queue Summary

**boardWrites.js (idempotent submitRun via a GET-settled create-precondition, paged rewriteHandle, and erase-then-drop-identity) plus runQueue.js (a durable, single-flight, record-level-backoff ddr.runQueue.v1 submission queue) — the backfill module (originally Task 3) was removed by user direction: leaderboards start fresh, with no one-time upload of runs recorded before boards existed.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 2 of 3 planned (Task 3 removed by user direction — see Deviations)
- **Files modified:** 4 (all created)

## Accomplishments

- `src/browser/boardWrites.js`'s `createBoardWrites()` returns `submitRun`/`rewriteHandle`/`eraseMyRuns`. `submitRun` POSTs one `:commit` create carrying `runDoc.js#createRunCommit`'s `exists:false` precondition; `classifyWrite()` maps every possible "already there" REST answer (400 FAILED_PRECONDITION, 403 PERMISSION_DENIED, 409 ALREADY_EXISTS) to one `"ambiguous"` class, resolved by exactly one public GET of `runs/{id}` — a 200 whose decoded `uid` matches is acknowledged as `"exists"`; a 404 (the create genuinely never landed, e.g. a banned uid) surfaces the ORIGINAL create response's own error status, not a synthesized one. A 401 forces exactly one `identity.forceRefresh()` and one retry across the whole call; a second 401 resolves `"auth"`.
- `rewriteHandle(handle)` pages the caller's own runs (`LIST_LIMIT_MAX`=50/page, ordered by document name) and rewrites `handle` via handle-only commits for exactly the ids that differ — proven against 120 of the caller's own seeded runs plus 5 of another player's, all 120 updated and the other player's 5 untouched. `eraseMyRuns()` deletes every one of the caller's own runs (re-querying the first page each round, since each delete shrinks the live set from the front), deletes the anonymous account best-effort, then drops `ddr.identity.v1`; a mid-way network failure leaves the identity stored with the partial `deleted` count so a retry can resume.
- `src/browser/runQueue.js`'s `createRunQueue()` returns `enqueue`/`enqueueMany`/`flush`/`purge`/`snapshot` over the durable `ddr.runQueue.v1` record (`{v, entries, settled, failures, retryAt}`). `enqueue` gates on `dev`, `competeOn()` and entry validity (a valid 8-hex hash, the current season, a 1–64 char version) before persisting — always BEFORE any network call — then starts an unforced `flush()`.
- `flush()` is single-flight (two calls issued together return the literal same in-flight promise, proven via reference equality) and drains entries in enqueue order through `writes.submitRun`: `created`/`exists` settle the hash and fire `onAck` once; `refused`/`invalid` settle the hash and log one `"[runQueue] dropped <hash>: <reason> <status>"` line, then the flush continues to the next entry in the SAME call; any transient outcome (offline/server/auth/unavailable) advances the record-level `failures`/`retryAt` (30 s doubling to a 30-minute cap via `backoffMs`) and stops the flush, leaving the rest of the queue in order for the next attempt. `flush({force:true})` ignores `retryAt`.
- The queue survives relaunch (a fresh `createRunQueue` over the same storage picks up pending entries via a tolerant `sanitizeQueue` load; corrupt JSON loads empty), is discarded wholesale by `purge()`, caps at `QUEUE_MAX`=200 entries (dropping the oldest with a logged `"overflow"` line), and never double-submits a hash already queued or settled (`enqueue` resolves `{duplicate:true}` with zero network calls). `enqueueMany(list, {version})` queues a whole batch of valid, unseen runs in one persist with zero network calls.
- Both modules are pure and DOM-free: no `window`/`document`/`navigator`/`localStorage`, no bare global `fetch` — proven by a purity test in each file, over the comment-stripped source, matching the established pattern from 83-03/83-04.

## Task Commits

Each task was committed atomically:

1. **Task 1: src/browser/boardWrites.js — idempotent submit, handle rewrite, erase** - `3cb4a9a4` (feat)
2. **Task 2: src/browser/runQueue.js — the durable ddr.runQueue.v1 submission queue** - `4e68074d` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `src/browser/boardWrites.js` - `WRITE_REASONS`, `classifyWrite`, `createBoardWrites` (`submitRun`/`rewriteHandle`/`eraseMyRuns`)
- `test/unit/boardWrites.test.js` - created/exists (all 3 existsResponse modes)/refused/invalid/401-retry/offline/stub-503/off, rewriteHandle paging + zero-call cases, eraseMyRuns success + mid-way failure, purity
- `src/browser/runQueue.js` - `RUN_QUEUE_KEY`, `QUEUE_MAX`, `SETTLED_MAX`, `BACKOFF_BASE_MS`, `BACKOFF_MAX_MS`, `backoffMs`, `sanitizeQueue`, `createRunQueue` (`enqueue`/`enqueueMany`/`flush`/`purge`/`snapshot`)
- `test/unit/runQueue.test.js` - dev/off/invalid, persist-before-network, duplicates, single-flight, offline/backoff+force, refusal-drop-with-log, exists-ack + order + transient-stop, relaunch, corrupt-load, purge, overflow, enqueueMany, purity

## Decisions Made

- The ambiguous-create GET resolution always reports the ORIGINAL create response's error status, never the GET's own 404 — closes RESEARCH Pitfall 1 / Assumption A3 exactly as specified: a banned uid's refused create reads identically whichever of the three live Firestore duplicate-create answers turns out to be real.
- Non-create writes (handle-update, delete, the own-runs list query) collapse both "ambiguous" and "refused" classifications into a single "refused" outcome — there is no create-time idempotence question for those endpoints, so submitRun's extra GET round-trip would be meaningless overhead there.
- runQueue.js's transient-failure branch defaults a missing/unrecognized submitRun reason to `"server"` rather than throwing or silently dropping the entry, so a future boardWrites reason id can never wedge or lose a queued entry.
- eraseMyRuns() always re-queries the FIRST page of the caller's own runs on every loop iteration (never advances a cursor), since each delete round shrinks the live result set from the front; rewriteHandle() instead advances `afterName`, since updates don't remove documents from the page ordering.
- The one-retry-on-auth budget in both `submitRun` and `rewriteHandle`/`eraseMyRuns` is spent once per OUTER call (a shared `tokenBox`/local `retried` flag across however many paged requests one call makes), not once per individual HTTP request — matching the plan's singular "retries once" wording.

## Deviations from Plan

**1. [User direction, 2026-09-28] Task 3 (src/browser/runBackfill.js) removed entirely**

The orchestrator relayed a mid-execution scope change from the user: *"Let's start these leaderboards fresh. No one time upload of recorded runs before leader boards existed."* Task 3 — the once-only backfill module that would have enqueued the player's locally recorded `ddr.bests.v1`/`ddr.graveyard.v1` season runs on the first Compete-ON launch — was skipped entirely per that direction:

- `src/browser/runBackfill.js` and `test/unit/runBackfill.test.js` were never created.
- No `ddr.boardBackfill.v1` key, `BACKFILL_KEY`, `BACKFILL_VERSION`, or `collectBackfillRuns`/`runBackfill` exports exist anywhere in the codebase.
- `runQueue.js`'s `enqueueMany` (originally specified partly for the backfill's one-persist-per-batch call) was kept as written and tested in Task 2 — it is general-purpose queue API with its own standalone value (batch-enqueue with one persist, zero requests) independent of any backfill caller, and Task 2 was already committed with its own passing tests before this scope change arrived. `runQueue.js`'s header comment was adjusted to note explicitly that this milestone ships with no backfill, so a future reader does not go looking for a caller that was never built.
- This plan's own frontmatter `requirements: [SRV-01, SRV-06]` did not name a backfill-specific requirement ID, so no REQUIREMENTS.md checkbox is affected by this removal.
- Per the orchestrator's instruction, the CONTEXT.md, ops runbook and ROADMAP.md plan line are left for the orchestrator to update — not touched here.

**Delivered: 2 of 2 remaining tasks (Tasks 1–2).** Task 3 removed by user direction, not a plan failure.

## Issues Encountered

None beyond the expected TDD iteration: two test-authoring bugs were caught and fixed before their respective task commits — a `baseSummary()` test helper originally recomputed `hash` unconditionally even when a test explicitly overrode it (masking an "invalid hash" test case), fixed to only recompute when the caller didn't supply one; and an early `enqueueMany` test's expected `queued`/`skipped` counts were wrong given that same bug. Both were caught by the first `node --test` run of `runQueue.test.js`, fixed, and re-verified green before the Task 2 commit — no implementation code was affected.

## User Setup Required

None - no external service configuration required. Live Firebase configuration (rules/indexes deploy, anonymous sign-in, API key restriction, the live smoke test) is 83-08's job; this plan is pure client code exercised entirely against 83-04's fake `fetchFn`, never the live project.

## Next Phase Readiness

- `boardWrites.js`'s `createBoardWrites()` and `runQueue.js`'s `createRunQueue()` are ready for Phase 85's shell wiring: `queue.enqueue(summary, {dev, version})` at death, `queue.flush()` on resume and on `online` (with `{force:true}` on the `online` event per CONTEXT), `queue.purge()` on Compete turning OFF, and `writes.rewriteHandle()`/`writes.eraseMyRuns()` behind the ☰ account rows.
- 83-07 (`tools/boards-smoke.mjs`) and 83-08 (live deploy + smoke test) can now exercise the full write path — `submitRun`/`rewriteHandle`/`eraseMyRuns` — against the real project; nothing in this plan touched it.
- No blockers. No backfill module exists in this milestone (removed per user direction, see Deviations) — any future revival of that idea is a new, separately-scoped feature, not a resumption of this plan's Task 3.

**Verification run (this plan's scope):** `node --test test/unit/boardWrites.test.js test/unit/runQueue.test.js test/unit/voice-corpus.test.js` — 72 pass, 0 fail.
**Full suite (`npm test`, once at plan close):** 8241 pass, 0 fail, 2 skipped (pre-existing) — exit code 0.
**Engine gate:** `git status --porcelain -- engine test/parity content` is empty.

**Human verification (deferred to end of run):** None — this plan ships no device-testable surface (pure client modules exercised entirely against a hand-rolled fake `fetchFn`, no UI, nothing deployed).

---
*Phase: 83-leaderboard-server*
*Completed: 2026-09-28*

## Self-Check: PASSED

All created files found on disk (`src/browser/boardWrites.js`, `test/unit/boardWrites.test.js`, `src/browser/runQueue.js`, `test/unit/runQueue.test.js`, `.planning/phases/83-leaderboard-server/83-06-SUMMARY.md`); both task commits (`3cb4a9a4`, `4e68074d`) found in git log.
