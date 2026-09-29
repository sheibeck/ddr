---
phase: 83-leaderboard-server
plan: 01
subsystem: infra
tags: [firestore, firebase, rest-api, content-bank, safety-scan]

# Dependency graph
requires: []
provides:
  - "src/browser/firebaseConfig.js: FIREBASE_CONFIG {projectId, apiKey} and firebaseConfigured(config), the single source of the Firebase project id and public API key"
  - "src/browser/firestoreRest.js: the one Firestore typed-value encoder (moved from bugReport.js), a decoder, URL builders (documentsPath/firestoreUrl/docName), and a never-throwing timedFetch/readJson/restError"
  - "content/handles.js: HANDLE_FIRST/HANDLE_SECOND word tables, proven clean against content/safety-wordlist.js for every combination"
  - "src/browser/handles.js: HANDLE_PREFIX, HANDLE_MAX_CHARS, handlePatternSource(), isValidHandle(h), rollHandle(random, previous)"
affects: [83-02, 83-03, 83-04, 83-06, 83-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One shared Firestore typed-value encoder (firestoreRest.js), reused by bugReport.js via re-export so every later board module and bug reports never drift apart"
    - "timedFetch(fetchFn, url, init, opts) — a never-throwing/never-rejecting fetch-vs-timeout race with an injectable AbortController, setTimer and clearTimer, mirroring the bugReport.js#sendBugReport pattern for reuse by boardClient.js/runQueue.js/firebaseAuth.js in later plans"
    - "By-construction safety proof: a content word-table's full cross-product is scanned via scanSafety plus a hand-written cross-boundary substring check, rather than hand-reviewing word choices"

key-files:
  created:
    - src/browser/firebaseConfig.js
    - src/browser/firestoreRest.js
    - content/handles.js
    - src/browser/handles.js
    - test/unit/firestoreRest.test.js
    - test/unit/handles.test.js
  modified:
    - src/browser/bugReportConfig.js
    - src/browser/bugReport.js

key-decisions:
  - "timedFetch is a non-async function returning `new Promise(...)` (not `async function`) so its export line reads exactly `export function timedFetch`, matching the plan's literal grep acceptance criterion while keeping the same never-throwing abort/timeout race as sendBugReport"
  - "HANDLE_FIRST/HANDLE_SECOND ship 30 words each (within the 24-40 range), chosen conservatively to clear both the word-boundary safety scan and the cross-boundary substring check on the first pass"
  - "rollHandle advances only the second-word index by one (wrapping) on a re-roll collision, per CONTEXT's unlimited-re-roll rule, rather than re-drawing from `random` again"

patterns-established:
  - "Firestore REST helpers live in firestoreRest.js; every later Phase 83 module (runDoc.js, boardClient.js, runQueue.js, firebaseAuth.js) imports FIRESTORE_BASE/IDENTITY_BASE/SECURETOKEN_BASE/timedFetch/toFirestoreFields/fromFirestoreFields from here rather than re-implementing"
  - "content/handles.js is append-only once the rules (83-02) embed its pattern — words are added, never removed or reordered"

requirements-completed: [SRV-04, SRV-05]

coverage:
  - id: D1
    description: "One shared Firebase config module (firebaseConfig.js) holds the project id and public API key; bugReportConfig.js/bugReport.js now build BUG_REPORT_CONFIG from it and re-export the moved encoder, with every existing bug-report test passing unchanged"
    requirement: SRV-04
    verification:
      - kind: unit
        ref: "test/unit/firestoreRest.test.js#BUG_REPORT_CONFIG deep-equals the shared FIREBASE_CONFIG plus the bugReports collection"
        status: pass
      - kind: unit
        ref: "test/unit/bug-report.test.js (all, unedited)"
        status: pass
      - kind: unit
        ref: "test/unit/firestore-rules.test.js#.firebaserc's projects.default equals BUG_REPORT_CONFIG.projectId"
        status: pass
    human_judgment: false
  - id: D2
    description: "firestoreRest.js provides the one typed-value encoder (same function reference as bugReport.js's), a decoder, URL builders and a never-throwing timedFetch/readJson/restError for every later Phase 83 module to import"
    requirement: SRV-04
    verification:
      - kind: unit
        ref: "test/unit/firestoreRest.test.js#toFirestoreFields imported from bugReport.js is the same function reference as firestoreRest.js's"
        status: pass
      - kind: unit
        ref: "test/unit/firestoreRest.test.js#toFirestoreFields/fromFirestoreFields: round trip returns an equal object"
        status: pass
      - kind: unit
        ref: "test/unit/firestoreRest.test.js (timedFetch abort/timeout race, readJson, restError, purity — all)"
        status: pass
    human_judgment: false
  - id: D3
    description: "content/handles.js's two word tables (30 words each) and src/browser/handles.js's roll/validate module exist; every HANDLE_FIRST x HANDLE_SECOND combination is proven clean against content/safety-wordlist.js by construction, including a cross-boundary substring check"
    requirement: SRV-05
    verification:
      - kind: unit
        ref: "test/unit/handles.test.js#every HANDLE_FIRST x HANDLE_SECOND combination clears the safety wordlist (joined, spaced, and each single word)"
        status: pass
      - kind: unit
        ref: "test/unit/handles.test.js#cross-boundary check: no banned term straddles the join between the two words, for every pair"
        status: pass
      - kind: unit
        ref: "test/unit/handles.test.js (roll/re-roll, isValidHandle, handlePatternSource, HANDLE_MAX_CHARS, no engine/ import — all)"
        status: pass
      - kind: unit
        ref: "test/determinism/content-is-pure-data.test.js and test/unit/voice-corpus.test.js#completeness (both)"
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-09-28
status: complete
---

# Phase 83 Plan 01: Shared Firebase Config, Firestore REST Helpers & the Rolled @Handle Summary

**One shared Firebase config module, one moved-and-reused Firestore typed-value encoder plus a new decoder/URL-builders/timedFetch, and a by-construction-safe @handle word bank + roll/validate module — the foundation every later Phase 83 plan imports.**

## Performance

- **Duration:** ~30 min
- **Tasks:** 2
- **Files modified:** 8 (6 created, 2 edited)

## Accomplishments
- `src/browser/firebaseConfig.js` is now the single source of the Firebase project id and public API key; `bugReportConfig.js` builds `BUG_REPORT_CONFIG` from it instead of duplicating the values.
- `src/browser/firestoreRest.js` holds the one Firestore typed-value encoder (moved verbatim from `bugReport.js`, which now imports and re-exports it — proven same-reference by test), plus a decoder, `documentsPath`/`firestoreUrl`/`docName` URL builders, and a never-throwing `timedFetch`/`readJson`/`restError` that mirrors `sendBugReport`'s abort/timeout race for reuse by later modules (`runQueue.js`, `boardClient.js`, `firebaseAuth.js`).
- `content/handles.js` ships two 30-word tables (`HANDLE_FIRST` grim dungeon adjectives/nouns, `HANDLE_SECOND` comic body parts/garb/kitchen things); every one of the 900 combinations is proven clean against `content/safety-wordlist.js` by a word-boundary scan (joined, spaced, and each single word) plus a purpose-built cross-boundary substring check that catches a banned term straddling the word join — a case the word-boundary scan alone cannot see.
- `src/browser/handles.js` exports `handlePatternSource()` (the exact regex string the Firestore rules will embed in 83-02), `isValidHandle`, and `rollHandle(random, previous)` — rolled only from an injected random function, never the engine rng, with unlimited re-roll guaranteed to change the handle.

## Task Commits

Each task was committed atomically:

1. **Task 1: Shared Firebase config and Firestore REST helpers (encoder moved, decoder, URLs, timedFetch)** - `7afc5a6a` (feat)
2. **Task 2: The rolled @handle — content word tables, roll/validate module, by-construction safety proof** - `a2e32be0` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/browser/firebaseConfig.js` - `FIREBASE_CONFIG` frozen `{projectId, apiKey}` and `firebaseConfigured(config)`
- `src/browser/firestoreRest.js` - the moved typed-value encoder, decoder, URL builders, `timedFetch`, `readJson`, `restError`
- `src/browser/bugReportConfig.js` - now builds `BUG_REPORT_CONFIG` from `FIREBASE_CONFIG`
- `src/browser/bugReport.js` - imports/re-exports `FIRESTORE_BASE`/`toFirestoreFields` from `firestoreRest.js`; local encoder/`FIRESTORE_BASE` removed
- `content/handles.js` - `HANDLE_FIRST`/`HANDLE_SECOND` pure-data word tables
- `src/browser/handles.js` - `HANDLE_PREFIX`, `HANDLE_MAX_CHARS`, `handlePatternSource`, `isValidHandle`, `rollHandle`
- `test/unit/firestoreRest.test.js` - encode/decode round trip, same-reference encoder, config/URL builders, timedFetch race, readJson/restError, purity
- `test/unit/handles.test.js` - table shape, by-construction safety proof (scan + cross-boundary check), roll/re-roll, isValidHandle, handlePatternSource

## Decisions Made
- `timedFetch` is written as a plain (non-`async`) function returning `new Promise(...)` so its declaration line is the literal substring `export function timedFetch` the plan's acceptance-criteria grep requires, while still implementing the exact same abort/timeout race as `sendBugReport` (internal `finish()` helper guarantees `clearTimer` runs exactly once regardless of which branch settles first).
- `HANDLE_FIRST`/`HANDLE_SECOND` were drafted conservatively (avoiding word endings/beginnings that could combine into banned-term fragments) so the by-construction safety test suite passed on the first run with no rewrites needed.
- A re-roll collision advances only the second word's index by one (wrapping), rather than re-invoking `random` — matches the plan's exact spec and keeps the function's output deterministic for a fixed `random`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. (Live Firebase/API-key configuration is 83-08's job; this plan is pure client code.)

## Next Phase Readiness

- `firestoreRest.js`'s `IDENTITY_BASE`/`SECURETOKEN_BASE`/`timedFetch` are ready for 83-03's `firebaseAuth.js`.
- `firestoreRest.js`'s encoder/decoder/URL builders are ready for 83-02's `runDoc.js` and 83-04's `boardClient.js`.
- `handles.js#handlePatternSource()` is ready for 83-02's rules to embed.
- No blockers.

**Verification run (this plan's scope):** `node --test test/unit/firestoreRest.test.js test/unit/handles.test.js test/unit/bug-report.test.js test/unit/bug-report-tool.test.js test/unit/firestore-rules.test.js test/unit/voice-corpus.test.js` — 112 pass, 0 fail, 2 skipped (pre-existing).
**Full suite (`npm test`, once at plan close):** 7989 pass, 0 fail, 2 skipped (pre-existing) — exit code 0.
**Engine gate:** `git status --porcelain -- engine test/parity` is empty; `git status --porcelain -- content` lists only `content/handles.js`.

**Human verification (deferred to end of run):** None — this plan ships no device-testable surface (config/data modules only, no UI).

---
*Phase: 83-leaderboard-server*
*Completed: 2026-09-28*

## Self-Check: PASSED

All created files found on disk; both task commits (`7afc5a6a`, `a2e32be0`) found in git log.
