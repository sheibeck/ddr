---
phase: 83-leaderboard-server
plan: 04
subsystem: infra
tags: [firestore, firebase, rest-api, leaderboard-client, in-memory-fake, caching]

# Dependency graph
requires:
  - "83-01: src/browser/firebaseConfig.js (FIREBASE_CONFIG, firebaseConfigured), src/browser/firestoreRest.js (FIRESTORE_BASE/IDENTITY_BASE/SECURETOKEN_BASE/timedFetch/readJson/restError/toFirestoreFields/fromFirestoreFields/documentsPath/docName/firestoreUrl), content/handles.js (isValidHandle via src/browser/handles.js)"
  - "83-02: src/browser/runDoc.js (RUN_COLLECTION/RUN_CLIENT_FIELDS/validateRunDoc/runDocId/LIST_LIMIT_MAX/isBoardStat/RANK_FIELD/topTenQuery/countQuery/ownRunsQuery/createRunCommit/handleUpdateCommit/deleteCommit), src/browser/reportLimits.js (REPORT_LIMITS_COLLECTION/validateLimitStep/decodeLimitDoc/buildReportCommit), firebase/firestore.rules (the runs/banned/reportLimits/bugReports contract this fake mirrors)"
provides:
  - "src/browser/fakeBoardServer.js: FAKE_ADMIN_TOKEN, createFakeBoardFetch({config, now, online, existsResponse, anonymousEnabled, runs, tokenTtlMs}) -> {fetchFn, calls, docs, reports, limits, users, banned, setOnline, ban, unban} — the browser dev loop's in-memory model of the whole live board (Identity Toolkit sign-up/delete, Secure Token refresh, Firestore runQuery/runAggregationQuery/commit, and the runs/banned/reportLimits/bugReports document endpoints), enforcing the same contract as firebase/firestore.rules through validateRunDoc/validateReport/validateLimitStep"
  - "src/browser/boardClient.js: BOARD_CACHE_TTL_MS, BOARD_REASONS, decodeRunDocument(doc), createBoardClient({fetchFn, config, competeOn, now, ttlMs, season, timeoutMs, setTimer, clearTimer, AbortCtl}) -> {topTen, total, rankOf, clear} — the pure board read client Phase 84's panel and Phase 85's 'you placed X' will consume unchanged"
affects: [83-05, 83-06, 83-07, 83-08, 83-09, 83-11, "Phase 84 (panel)", "Phase 85 (submission/account rows)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Atomic multi-write commit batches: fakeBoardServer's commitDispatch classifies every write in a documents:commit body (classifyWrite) and, for the two shapes that can carry N writes for the same collection (handleUpdateCommit's re-roll-every-run and deleteCommit's multi-id delete), validates every write in the batch BEFORE applying any of them (applyAtomic) — one failing write changes nothing, matching CONTEXT's 'a re-roll rewrites handle on all of the player's existing runs' flow"
    - "Fixed gate order per read (boardClient.js#checkGates): competeOn -> config/fetchFn availability -> argument validation -> cache -> in-flight join -> network, so a combination of failures (e.g. Compete OFF AND an invalid stat) always resolves the earliest-listed reason, not an arbitrary one"
    - "Single-flight via synchronous Promise assignment before the first await: runRead's outer body has no top-level `await`, so `inflight.set(key, promise)` always runs synchronously within the same call, guaranteeing two reads started in the same tick (e.g. Promise.all) always see the shared in-flight promise rather than racing to create two"
    - "Stale-on-failure cache fallback: a failed refresh with an existing cache entry re-returns that entry's own success value with `stale:true` merged in, rather than a fresh reason; only a failure with NO cached copy surfaces the raw offline/server/refused/... reason"

key-files:
  created:
    - src/browser/fakeBoardServer.js
    - test/unit/fakeBoardServer.test.js
    - src/browser/boardClient.js
    - test/unit/boardClient.test.js

key-decisions:
  - "createFakeBoardFetch generalizes commit handling beyond the plan's literal single-write examples to support N-write atomic commits for handle-update and delete (classifyWrite/applyAtomic), because CONTEXT's re-roll rule ('a re-roll rewrites handle on all of the player's existing runs') and a future 'erase your runs' flow both need handleUpdateCommit/deleteCommit called with an array of ids in ONE commit — a single-write-only fake would silently break both future callers"
  - "Admin bypass is scoped per endpoint to match the plan's own wording precisely: admin bypasses ownership/banned/list-limit checks for run CREATE (commit) and for the direct GET is public/DELETE-runs/PATCH-DELETE-banned/PATCH-DELETE-reportLimits document endpoints, but NOT for commit-based handle-update or delete (both 'succeed only for the owner', literally, even for the admin token) — real Firestore's client-vs-IAM distinction has no owner-bypass path through the rules-evaluated commit surface either"
  - "Uid/refresh/id-token counters are deterministic incrementing strings (fakeuidNNNNNN, idtokNNNNNNNN, rtokNNNNNNNN) rather than Math.random-derived, so sign-up/refresh/delete sequences are reproducible across test runs without needing an injected random function in the factory signature (which the plan's own signature omits)"
  - "boardClient.js's decodeRunDocument parameter is named `doc` (not `document`) specifically to avoid a purity-regex collision with the DOM global `document` — the same collision was hit and fixed in fakeBoardServer.js's test via a precise `(?<!\\.)\\bdocument\\b(?!\\s*:)` pattern that excludes property-reads (`h.document`) and object-literal keys (`document: {...}`) while still catching real `document.<member>` usage"

patterns-established:
  - "fakeBoardServer.js is the browser dev loop's board fake, selected by the shell in Phases 84/85; it must be updated together with firebase/firestore.rules (same discipline as runDoc.js/reportLimits.js's rules mirrors) whenever the rules change"
  - "boardClient.js's checkGates/runRead/cacheKey shape is the template later Phase 83 network modules (runQueue.js/boardWrites.js, 83-06) can follow for their own cache/gate/single-flight needs, mirroring firebaseAuth.js's per-instance in-flight promise pattern from 83-03"

requirements-completed: []

coverage:
  - id: D1
    description: "fakeBoardServer.js's createFakeBoardFetch models every REST surface the live board uses (accounts:signUp/delete, securetoken:token, runQuery, runAggregationQuery, commit, and the runs/banned/reportLimits/bugReports document endpoints), enforcing the same shape/ownership/banned/rate-limit contract as firebase/firestore.rules through validateRunDoc, validateReport and validateLimitStep — auth (none/user/admin/expired/invalid), the API-key gate, offline, and an unknown-route 404 are all covered"
    requirement: SRV-03
    verification:
      - kind: unit
        ref: "test/unit/fakeBoardServer.test.js (all 44 tests: signUp/delete/refresh, key check, offline, unknown route, run create incl. all three existsResponse modes, handle update incl. N-run atomic re-roll, delete incl. atomic multi-id, runQuery filters/order/limit/cursor over 120 seeded docs, runAggregationQuery, GET/DELETE runs, PATCH/DELETE banned, the report+limit commit incl. cooldown/forged-count/daily-cap/other-uid/missing-limit-write, reportLimits GET/PATCH/DELETE, bugReports GET, inspectors, purity)"
        status: pass
    human_judgment: false
    note: "This plan delivers the read half of SRV-03 (topTen/total/rankOf, D2 below) plus the fake server every LATER Phase 83 plan (83-05..83-11) tests against. SRV-03's write half (submission, 83-06) and live proof (83-08) are not yet exercised — REQUIREMENTS.md's SRV-03 checkbox is intentionally left unchecked."
  - id: D2
    description: "boardClient.js's createBoardClient answers topTen(stat, race, sub), total(stat, race, sub) and rankOf(stat, key, race, sub) for all four ranked stats (deep/days/kills/purse), always within the current SEASON, over runQuery/runAggregationQuery count, with a 5-minute cache per (op, stat, race, sub[, key]), single-flight in-flight joins, a stale:true fallback when a refresh fails and a cached copy exists, and zero network calls when Compete is OFF or an argument (stat/race/sub/key) is invalid — no request ever carries an Authorization header"
    requirement: SRV-03
    verification:
      - kind: unit
        ref: "test/unit/boardClient.test.js#topTen(deep/days/kills/purse): at most 10 rows in descending rank-key order, excludes season-2 docs (4 parameterized tests)"
        status: pass
      - kind: unit
        ref: "test/unit/boardClient.test.js#topTen: race/sub filter shapes return only matching rows; total(); rankOf(): rank = ahead + 1"
        status: pass
      - kind: unit
        ref: "test/unit/boardClient.test.js#request bodies equal topTenQuery/countQuery; no Authorization header; API key on every URL"
        status: pass
      - kind: unit
        ref: "test/unit/boardClient.test.js#cache: fresh hit, 300000ms expiry, two identical reads share one request; clear() forces a refetch"
        status: pass
      - kind: unit
        ref: "test/unit/boardClient.test.js#stale fallback with a cached copy; no-cache offline/server/refused(+status) mapping; a timed-out request resolves offline"
        status: pass
      - kind: unit
        ref: "test/unit/boardClient.test.js#competeOn not true -> 'off'; invalid stat/race/sub/key -> 'invalid'; bad config/no fetchFn -> 'unavailable' — all zero-call"
        status: pass
      - kind: unit
        ref: "test/unit/boardClient.test.js#decodeRunDocument, purity (all)"
        status: pass
    human_judgment: false
    note: "SRV-03's read half is complete and unit-proven against the fake exactly as it will run against the live project (same request bodies, same REST shapes). Live proof against the deployed project is 83-08's job."

duration: 55min
completed: 2026-09-28
status: complete
---

# Phase 83 Plan 04: Board Read Client & the In-Memory Fake Board Server Summary

**A pure board read client (topTen/total/rankOf, 5-minute cache, stale-on-failure fallback) plus the in-memory fake server every later Phase 83 test and the browser dev loop drive through the exact REST shapes and rules contract the live board enforces.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 2
- **Files modified:** 4 (all created)

## Accomplishments

- `src/browser/fakeBoardServer.js` models the whole live board over three REST surfaces in one `fetchFn`: Identity Toolkit `accounts:signUp`/`accounts:delete`, Secure Token `token` (refresh), and Firestore `runQuery`/`runAggregationQuery`/`commit` plus the `runs`/`banned`/`reportLimits`/`bugReports` document endpoints. It enforces exactly the same contract `firebase/firestore.rules` deploys, through the SAME JS mirrors the rules are kept equal to (`runDoc.js#validateRunDoc`, `bugReport.js#validateReport`, `reportLimits.js#validateLimitStep`) — so the browser dev loop and every later test (board and bug report, 83-05 through 83-11) run the real client modules unchanged.
- Commit batches are validated and applied atomically, including N-write batches: `handleUpdateCommit`'s "re-roll rewrites the handle on all of the player's existing runs" flow and `deleteCommit`'s multi-id delete both go through a classify-then-validate-all-then-apply-all pipeline — one failing write in the batch changes nothing, proven by a dedicated multi-id test for each.
- Admin (`FAKE_ADMIN_TOKEN`) bypasses ownership/banned/list-limit checks for run creates and for the direct `GET`/`DELETE runs/{id}`, `PATCH`/`DELETE banned/{uid}` and `PATCH`/`DELETE reportLimits/{uid}` document endpoints (mirroring IAM-level access), but NOT for commit-based handle-update or delete, which the rules and this fake both restrict to "the owner, period."
- `src/browser/boardClient.js`'s `createBoardClient()` answers `topTen(stat, race, sub)`, `total(stat, race, sub)` and `rankOf(stat, key, race, sub)` for `deep`/`days`/`kills`/`purse`, always scoped to the current `content/season.js` `SEASON`, over `runQuery`/`runAggregationQuery count` — `rank = count(rankKey > key) + 1`. Every read applies a fixed gate order (`competeOn` → config/fetchFn availability → argument validation → cache → in-flight join → network) so a combined failure always resolves the earliest-listed reason.
- Reads are cached per `(op, stat, race, sub[, key])` for 5 minutes with true single-flight joining (two reads started in the same synchronous tick share one network call, proven via `Promise.all`); a failed refresh with an existing cached copy returns that copy flagged `stale: true` instead of surfacing the raw failure reason.
- No board read ever sends an `Authorization` header (board reads are public); every request URL carries the API key. `BOARD_REASONS` (`off`/`offline`/`server`/`refused`/`invalid`/`unavailable`) and `IDENTITY_REASONS`-style zero-network gating (Compete OFF or an invalid `stat`/`race`/`sub`/`key`) make zero network calls.

## Task Commits

Each task was committed atomically:

1. **Task 1: src/browser/fakeBoardServer.js — the in-memory REST model of the live board** - `81e92d2a` (feat)
2. **Task 2: src/browser/boardClient.js — topTen, total and rankOf with a 5-minute cache and stale fallback** - `37c9c0f7` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `src/browser/fakeBoardServer.js` - `FAKE_ADMIN_TOKEN`, `createFakeBoardFetch` (sign-up/delete/refresh, runQuery/runAggregationQuery/commit, runs/banned/reportLimits/bugReports document endpoints, inspectors)
- `test/unit/fakeBoardServer.test.js` - auth, key check, offline, unknown route, run create (all three `existsResponse` modes), handle update (single + atomic multi-id re-roll), delete (single + atomic multi-id), runQuery filters/order/limit/cursor (120-doc cursor paging), runAggregationQuery, admin bypass, the report+limit commit (first report, cooldown, forged count, sixth report, other uid, missing limit write, no auth), reportLimits owner get + refused list/delete, admin limit seeding, bugReports GET, inspectors, purity
- `src/browser/boardClient.js` - `BOARD_CACHE_TTL_MS`, `BOARD_REASONS`, `decodeRunDocument`, `createBoardClient` (`topTen`/`total`/`rankOf`/`clear`)
- `test/unit/boardClient.test.js` - ordering for all four stats, the four filter shapes, season exclusion, total, rankOf, exact request bodies, no Authorization header, cache hit/expiry/single-flight, stale fallback, off/invalid zero-call gates, error mapping (offline/server/refused+status/timeout), purity

## Decisions Made

- `createFakeBoardFetch`'s commit handling was generalized beyond the plan's literal single-write examples to support atomic N-write commits for handle-update and delete — required by CONTEXT's re-roll rule and a future "erase your runs" flow, both of which call `handleUpdateCommit`/`deleteCommit` with an array of ids in one commit.
- Admin bypass is scoped precisely per the plan's own wording: it applies to run creates and to the direct admin-only document endpoints, but commit-based handle-update and delete stay owner-only even for the admin token (matching "succeeds only for the owner," read literally).
- Sign-up/refresh/delete uid and token values are deterministic incrementing strings rather than random, since the plan's factory signature has no injected `random` — this keeps every sign-up sequence reproducible.
- `boardClient.js#decodeRunDocument`'s parameter is named `doc`, not `document`, to sidestep a DOM-global purity-regex collision; the same collision (`h.document`/`document: {...}` in `fakeBoardServer.js`) was resolved with a precise lookaround pattern instead of renaming, since that file's `document` usages ARE the literal Firestore REST field name.

## Deviations from Plan

None — plan executed exactly as written. The N-write atomic commit generalization (handle-update/delete) is a literal reading of the plan's own "a commit is atomic" behavior line and CONTEXT's re-roll rule, not new scope — Rule 2 (missing critical functionality: a single-write-only fake would silently break the re-roll and multi-run-delete flows every later plan needs).

## Issues Encountered

Two test-authoring bugs were caught and fixed during each task's own TDD loop before its commit:
- A purity-check regex (`\bdocument\b`) false-positived on the Firestore REST response shape's own `document` property/key in both test files — resolved with a precise lookaround pattern (fakeBoardServer.test.js) and a parameter rename (boardClient.js, `document` → `doc`).
- A test helper's own default-parameter shorthand (`competeOn = () => true`) silently overrode an explicitly-passed `undefined` in one gate test — fixed by constructing that one client directly instead of through the shared helper.

## User Setup Required

None - no external service configuration required. Live Firebase configuration (rules/indexes deploy, anonymous sign-in, API key restriction) is 83-08's job; this plan is pure client code and an in-memory test double, never the live project.

## Next Phase Readiness

- `fakeBoardServer.js`'s `createFakeBoardFetch()` is ready for 83-05's `tools/boards-admin.mjs` (admin token), 83-06's `boardWrites.js`/`runQueue.js` (run create/handle-update/delete commits), 83-07's `tools/boards-smoke.mjs` offline test, 83-09's bug-report Send wiring, and the browser dev loop the shell selects in Phases 84/85.
- `boardClient.js`'s `createBoardClient()` is ready for Phase 84's board panel (topTen/total) and Phase 85's "you placed X" (rankOf).
- No blockers.

**Verification run (this plan's scope):** `node --test test/unit/fakeBoardServer.test.js test/unit/boardClient.test.js test/unit/voice-corpus.test.js` — 95 pass, 0 fail.
**Full suite (`npm test`, once at plan close):** 8164 pass, 0 fail, 2 skipped (pre-existing) — exit code 0.
**Engine gate:** `git status --porcelain -- engine test/parity content` is empty.

**Human verification (deferred to end of run):** None — this plan ships no device-testable surface (pure client modules and an in-memory test double, no UI, nothing deployed).

## Requirement coverage note

This plan's frontmatter lists `SRV-03, SRV-09` — matching 83-01/83-02/83-03's pattern, these same IDs recur across later Phase 83 plans (submission in 83-06, live deploy in 83-08, sheet wiring in 83-09, live probes in 83-11). REQUIREMENTS.md checkboxes for both are intentionally left unchecked here; this plan's contribution (the board read client's full behavior, and the fake server every later plan tests against) is recorded in the `coverage` block above and should be read as partial. `SRV-09` in particular is only its "offline model" half per this plan's own objective — the report sheet's rate-limited UX and the live rules probes are 83-09/83-10/83-11's jobs.

---
*Phase: 83-leaderboard-server*
*Completed: 2026-09-28*

## Self-Check: PASSED

All created files found on disk (`src/browser/fakeBoardServer.js`, `test/unit/fakeBoardServer.test.js`, `src/browser/boardClient.js`, `test/unit/boardClient.test.js`); both task commits (`81e92d2a`, `37c9c0f7`) found in git log.
