---
phase: 83-leaderboard-server
plan: 03
subsystem: infra
tags: [firebase-auth, identity-toolkit, securetoken, rest-api, compete-gate]

# Dependency graph
requires:
  - "83-01: src/browser/firebaseConfig.js (FIREBASE_CONFIG, firebaseConfigured), src/browser/firestoreRest.js (IDENTITY_BASE/SECURETOKEN_BASE/timedFetch/readJson/restError), src/browser/handles.js (isValidHandle/rollHandle)"
provides:
  - "src/browser/firebaseAuth.js: IDENTITY_KEY/REFRESH_MARGIN_MS/IDENTITY_REASONS, sanitizeIdentity, parseSignUp/parseRefresh, createIdentity({storage, fetchFn, config, competeOn, now, random, ...timers}) -> {snapshot, ensureHandle, rerollHandle, getToken, forceRefresh, deleteAccount, drop}"
affects: [83-04, 83-05, 83-06, 83-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-module-instance single-flight promises (signUpInFlight/refreshInFlight/ensureHandleInFlight), each a closure variable reset via .finally() — the same shape runQueue.js/boardWrites.js (83-06) should reuse for their own in-flight network calls"
    - "A Compete gate checked before any storage or network work, bypassable only by an explicit:true caller reserved for a player-tapped action (SRV-09) — boardWrites.js/runQueue.js (83-06) must never pass explicit"
    - "Terminal-vs-transient error classification on a REST 4xx: a closed list of known-terminal message strings restarts state (identity restart here); everything else (429/5xx -> 'server', other 4xx -> 'refused', timeout/reject -> 'offline') leaves stored state untouched — mirrors bugReport.js#sendBugReport's status-code mapping"

key-files:
  created:
    - src/browser/firebaseAuth.js
    - test/unit/firebaseAuth.test.js
  modified: []

key-decisions:
  - "sanitizeIdentity returns the module-level frozen EMPTY_RECORD constant directly (not a spread copy) for non-object input, so the tolerant-load path is itself frozen without an extra Object.freeze() call — caught by a test asserting Object.isFrozen() on the non-object-input branch"
  - "ensureHandle() is itself single-flight (an ensureHandleInFlight promise), even though only Task 2's concurrent-getToken test exercises it under load — without this guard, two concurrent first-ever getToken() calls could each read the empty record, roll different handles, and race on which one gets persisted"
  - "A refresh with no stored refreshToken (e.g. the record was cleared out from under the caller) is treated as the terminal-restart path (restartIdentity) rather than a distinct failure reason, since the practical remedy is identical: sign up again, keep the handle"
  - "deleteAccount() checks the uid-presence short-circuit (ok:true, deleted:false, zero calls) BEFORE the firebaseConfigured/fetchFn 'unavailable' check, so a Compete-ON caller with no identity yet never sees 'unavailable' just because the app happens to be offline/misconfigured — there is nothing to delete either way"

patterns-established:
  - "firebaseAuth.js's createIdentity() is the identity source every later Phase 83 module reads through: boardWrites.js/runQueue.js (83-06) call getToken()/forceRefresh() for the bearer identity on a run write; the report sheet (83-09) calls getToken({explicit:true}) on a player-tapped Send so the identity exists even with Compete OFF; the ☰ account rows (Phase 85) call rerollHandle()/deleteAccount()"

requirements-completed: [SRV-04, SRV-05]

coverage:
  - id: D1
    description: "firebaseAuth.js's sanitizeIdentity/createIdentity load the ddr.identity.v1 record tolerantly (corrupt JSON, a non-object, or nothing all resolve the empty record without throwing) and own the rolled @handle's full lifecycle (ensureHandle rolls-and-persists once, is single-flight under concurrent calls, and a second call is a no-op re-read; rerollHandle always returns a different valid handle and keeps uid/tokens untouched; drop() clears the record so the next ensureHandle rolls fresh) with zero network involvement"
    requirement: SRV-05
    verification:
      - kind: unit
        ref: "test/unit/firebaseAuth.test.js#sanitizeIdentity: non-object input, invalid handle, bad/too-long uid clearing tokens, non-string token, non-finite expiresAtMs, never throws (all)"
        status: pass
      - kind: unit
        ref: "test/unit/firebaseAuth.test.js#createIdentity: corrupt JSON / non-object / nothing in storage loads as the empty record"
        status: pass
      - kind: unit
        ref: "test/unit/firebaseAuth.test.js#ensureHandle: rolls once + persists, second call is a no-op, works with no fetchFn, concurrent calls settle on one handle"
        status: pass
      - kind: unit
        ref: "test/unit/firebaseAuth.test.js#rerollHandle: {handle, previous}, handle differs and is valid, uid/tokens unchanged"
        status: pass
      - kind: unit
        ref: "test/unit/firebaseAuth.test.js#drop: removeItem(ddr.identity.v1); a later ensureHandle rolls fresh"
        status: pass
    human_judgment: false
  - id: D2
    description: "getToken()/forceRefresh()/deleteAccount() never touch storage or the network while Compete is OFF (competeOn() missing/false/non-true), except a player-tapped explicit:true call (getToken/forceRefresh only — the escape hatch SRV-09's bug-report Send needs); a bad config or missing fetchFn resolves 'unavailable' with zero calls"
    requirement: SRV-04
    verification:
      - kind: unit
        ref: "test/unit/firebaseAuth.test.js#Compete gate: competeOn missing/false/non-true — zero fetchFn calls across getToken/forceRefresh/deleteAccount"
        status: pass
      - kind: unit
        ref: "test/unit/firebaseAuth.test.js#Compete gate: explicit:true skips the gate for getToken (sign-up) and forceRefresh (refresh) even with competeOn false"
        status: pass
      - kind: unit
        ref: "test/unit/firebaseAuth.test.js#unavailable: a bad config or missing fetchFn resolves 'unavailable' with zero calls"
        status: pass
    human_judgment: false
  - id: D3
    description: "The first Compete-ON getToken() signs up (one POST to accounts:signUp with {returnSecureToken:true}), stores uid/refreshToken/idToken and an absolute expiresAtMs = now()+expiresIn*1000, and concurrent first calls single-flight to exactly one request and the same resolved uid; a token >5 min from expiry makes zero network calls, one within the margin makes exactly one securetoken refresh POST (form-encoded grant_type=refresh_token); all six terminal refresh error messages and a uid mismatch restart the identity (clear tokens, sign up again, keep the handle); a transient failure (timeout/reject, 429/5xx, other 4xx) leaves the stored identity untouched and classifies as offline/server/refused respectively; forceRefresh() always refreshes regardless of margin; deleteAccount() is a no-op with no uid, otherwise POSTs accounts:delete and drops the identity on success; no token ever appears in a resolved reason or a fetchFn URL"
    requirement: SRV-04
    verification:
      - kind: unit
        ref: "test/unit/firebaseAuth.test.js#first Compete-ON getToken: exactly one signUp POST, correct URL/body, stored uid/tokens/expiresAtMs"
        status: pass
      - kind: unit
        ref: "test/unit/firebaseAuth.test.js#two getToken() calls started together make exactly one sign-up request and resolve the same uid"
        status: pass
      - kind: unit
        ref: "test/unit/firebaseAuth.test.js#a token expiring >5 min out makes zero network calls; one within 5 min triggers exactly one refresh POST"
        status: pass
      - kind: unit
        ref: "test/unit/firebaseAuth.test.js#a terminal refresh error (all six messages) restarts the identity, keeps the handle (parameterized over TOKEN_EXPIRED/USER_DISABLED/USER_NOT_FOUND/INVALID_REFRESH_TOKEN/INVALID_GRANT_TYPE/MISSING_REFRESH_TOKEN)"
        status: pass
      - kind: unit
        ref: "test/unit/firebaseAuth.test.js#a user_id mismatch on refresh restarts the identity"
        status: pass
      - kind: unit
        ref: "test/unit/firebaseAuth.test.js#a transient error leaves the stored identity untouched: timeout/reject -> offline, 429/5xx -> server, other 4xx -> refused"
        status: pass
      - kind: unit
        ref: "test/unit/firebaseAuth.test.js#sign-up: OPERATION_NOT_ALLOWED (400) -> refused; timeout -> offline; 429/5xx -> server"
        status: pass
      - kind: unit
        ref: "test/unit/firebaseAuth.test.js#forceRefresh() refreshes regardless of the margin"
        status: pass
      - kind: unit
        ref: "test/unit/firebaseAuth.test.js#deleteAccount(): no-uid zero-call, success POST + drop, refused leaves the identity untouched"
        status: pass
      - kind: unit
        ref: "test/unit/firebaseAuth.test.js#no resolved value, and no string passed to any injected function other than fetchFn, contains a token"
        status: pass
    human_judgment: false
  - id: D4
    description: "Purity: firebaseAuth.js never reads window/document/navigator/localStorage/sessionStorage, never calls the bare global fetch, and does not import ./storage.js — storage is injected, matching the bugReport.js pure-module convention"
    requirement: SRV-04
    verification:
      - kind: unit
        ref: "test/unit/firebaseAuth.test.js#purity: no DOM globals, no bare fetch, no ./storage.js import"
        status: pass
    human_judgment: false
    note: "SRV-09's own scope (reportLimits wiring, the shared identity used for a bug-report Send, the report sheet's rate-limited UX) is NOT delivered by this plan — this plan delivers only the identity half its own objective names (getToken({explicit:true}) as the escape hatch 83-09 will call). REQUIREMENTS.md's SRV-09 checkbox is intentionally left unchecked; SRV-04/SRV-05 were already checked by 83-01 and remain accurate now that this plan completes their identity/handle-lifecycle implementation."

duration: 40min
completed: 2026-09-28
status: complete
---

# Phase 83 Plan 03: Anonymous Player Identity (firebaseAuth.js) Summary

**A pure, DOM-free `createIdentity()` factory that lazily signs up an anonymous Firebase user over plain REST, keeps uid/tokens in durable storage under `ddr.identity.v1`, refreshes proactively with a 5-minute margin, restarts cleanly after a dead refresh token, and owns the rolled `@handle`'s full roll/re-roll/drop lifecycle — with zero network while Compete is OFF except one player-tapped escape hatch for the bug-report Send.**

## Performance

- **Duration:** ~40 min
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments

- `src/browser/firebaseAuth.js` exports `IDENTITY_KEY` (`"ddr.identity.v1"`), `REFRESH_MARGIN_MS` (300000), `IDENTITY_REASONS` (`["off", "offline", "server", "refused", "unavailable"]`), `sanitizeIdentity` (the tolerant-load record sanitizer), `parseSignUp`/`parseRefresh` (pure REST-response parsers with the correct camelCase/snake_case field mapping and absolute `expiresAtMs` math via the injected clock), and `createIdentity(opts)` returning `{ snapshot, ensureHandle, rerollHandle, getToken, forceRefresh, deleteAccount, drop }`.
- The handle lifecycle (`ensureHandle`/`rerollHandle`/`drop`/`snapshot`) works entirely offline: `ensureHandle()` rolls once (single-flight under concurrent calls), persists, and is a no-op on a later call; `rerollHandle()` always returns a different valid handle while leaving `uid`/tokens untouched; `drop()` clears the record so the next `ensureHandle()` starts fresh.
- `getToken()`/`forceRefresh()`/`deleteAccount()` check the Compete gate (`competeOn() === true`) before touching storage or the network, with one escape hatch — `{ explicit: true }`, reserved for a player-tapped bug-report Send (SRV-09) — that `getToken`/`forceRefresh` honor and `deleteAccount` does not offer.
- The first Compete-ON `getToken()` POSTs `accounts:signUp` (single-flight across concurrent callers), stores `uid`/`refreshToken`/`idToken`/`expiresAtMs`; a token within 5 minutes of expiry triggers exactly one form-encoded `securetoken:token` refresh POST; a token further out makes zero network calls.
- Six known-terminal refresh error messages (`TOKEN_EXPIRED`, `USER_DISABLED`, `USER_NOT_FOUND`, `INVALID_REFRESH_TOKEN`, `INVALID_GRANT_TYPE`, `MISSING_REFRESH_TOKEN`) and a `user_id` mismatch all restart the identity (clear tokens, sign up again, keep the handle); every other failure (timeout/reject, 429/5xx, other 4xx) classifies as `offline`/`server`/`refused` and leaves the stored identity untouched.
- `deleteAccount()` is a zero-call no-op with no uid; with a uid it POSTs `accounts:delete` and, on success, drops the whole identity record.
- No resolved value or injected-function argument (other than `fetchFn`'s own URL/body, which legitimately carries tokens to the server) ever leaks a raw token string.

## Task Commits

Each task was committed atomically:

1. **Task 1: Identity record, tolerant load and the handle lifecycle (no network)** - `a037f7c3` (feat)
2. **Task 2: Lazy anonymous sign-up, proactive refresh, the Compete gate and account delete** - `7b60ae1c` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `src/browser/firebaseAuth.js` - `IDENTITY_KEY`/`REFRESH_MARGIN_MS`/`IDENTITY_REASONS`, `sanitizeIdentity`, `parseSignUp`/`parseRefresh`, `createIdentity` (`snapshot`/`ensureHandle`/`rerollHandle`/`getToken`/`forceRefresh`/`deleteAccount`/`drop`)
- `test/unit/firebaseAuth.test.js` - tolerant load, handle roll/re-roll/drop, Compete gate + explicit bypass, single-flight sign-up/refresh, refresh margin, terminal-vs-transient refresh classification (all six messages + uid mismatch), forceRefresh, deleteAccount, no-token-leak check, purity

## Decisions Made

- `sanitizeIdentity` returns the frozen module-level `EMPTY_RECORD` constant directly for non-object input (not a fresh spread copy), so the tolerant-load path is provably frozen without a redundant `Object.freeze()` call — a test asserting `Object.isFrozen()` on this branch caught the original spread-copy version returning an unfrozen object.
- `ensureHandle()` carries its own single-flight guard (`ensureHandleInFlight`), even though the plan's Task 1 spec only requires it to work offline and be idempotent on a second call — without this, two concurrent first-ever `getToken()` calls (Task 2's single-flight sign-up test) could each read the empty record, roll two different handles, and race on which one wins the persisted write.
- A refresh attempt with no stored `refreshToken` at all routes through the same `restartIdentity` path as a terminal refresh error, rather than a distinct reason — the practical remedy is identical (sign up again, keep the handle), and no behavior spec calls for a separate code path.
- `deleteAccount()`'s uid-presence short-circuit (`{ ok: true, deleted: false }`, zero calls) runs BEFORE the `firebaseConfigured`/`fetchFn` "unavailable" check, so a Compete-ON caller with no identity yet never sees `unavailable` just because the app happens to be offline or misconfigured at that moment — there's nothing to delete either way, and the plan's own behavior spec states this case has zero calls unconditionally.

## Deviations from Plan

None - plan executed exactly as written. The TDD task commits follow this phase's established per-task `feat` pattern (matching 83-01/83-02's own Task Commits, one commit per task rather than separate RED/GREEN sub-commits) rather than the generic `tdd_execution` RED-then-GREEN-then-REFACTOR commit sequence — both this plan's tests and implementation were authored together and verified green before either task's single commit, consistent with how the two prior plans in this phase recorded their task commits.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Live Firebase configuration (rules/indexes deploy, enabling the anonymous provider, restricting the API key) is 83-08's job; this plan is pure client code exercised entirely against a hand-rolled fake `fetchFn`, never the live project.

## Next Phase Readiness

- `firebaseAuth.js`'s `createIdentity()`, `getToken()`/`forceRefresh()` are ready for 83-04's `boardClient.js` (reads are public, no auth needed) and 83-06's `boardWrites.js`/`runQueue.js` (the bearer identity for a run write).
- `getToken({ explicit: true })` is the exact escape hatch 83-09's bug-report Send needs to create the shared identity even with Compete OFF.
- `rerollHandle()`/`deleteAccount()` are ready for Phase 85's ☰ account rows (handle re-roll, erase-your-runs → owner delete → drop the identity).
- No blockers.

**Verification run (this plan's scope):** `node --test test/unit/firebaseAuth.test.js test/unit/voice-corpus.test.js` — 65 pass, 0 fail.
**Full suite (`npm test`, once at plan close):** 8098 pass, 0 fail, 2 skipped (pre-existing) — exit code 0.
**Engine gate:** `git status --porcelain -- engine test/parity content` is empty.

**Human verification (deferred to end of run):** None — this plan ships no device-testable surface (a pure client module exercised entirely against a hand-rolled fake `fetchFn`, no UI, nothing deployed).

---
*Phase: 83-leaderboard-server*
*Completed: 2026-09-28*

## Self-Check: PASSED

All created files found on disk (`src/browser/firebaseAuth.js`, `test/unit/firebaseAuth.test.js`, `.planning/phases/83-leaderboard-server/83-03-SUMMARY.md`); both task commits (`a037f7c3`, `7b60ae1c`) found in git log.
