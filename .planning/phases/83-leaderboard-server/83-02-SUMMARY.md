---
phase: 83-leaderboard-server
plan: 02
subsystem: infra
tags: [firestore, firebase-rules, leaderboard, rank-keys, bug-reports, rate-limit]

# Dependency graph
requires:
  - "83-01: src/browser/firebaseConfig.js (FIREBASE_CONFIG), src/browser/firestoreRest.js (toFirestoreFields/docName/timedFetch), src/browser/handles.js (isValidHandle/handlePatternSource)"
provides:
  - "src/browser/runDoc.js: the run document contract — RUN_CLIENT_FIELDS/RUN_DOC_FIELDS, every bound constant, the four rank-key formulas (deepKeyOf/daysKeyOf/killsKeyOf/goldKeyOf), buildRunDoc/validateRunDoc (the isValidBoardRun JS mirror), createRunCommit/handleUpdateCommit/deleteCommit, and topTenQuery/countQuery/ownRunsQuery"
  - "src/browser/reportLimits.js: the per-player bug-report limit — REPORT_COOLDOWN_MINUTES/REPORT_DAILY_CAP/LIMIT_FIELDS, nextLimitState/validateLimitStep (the isValidLimitStep JS mirror), decodeLimitDoc, randomDocId, buildReportCommit (the two-Write report+limit commit), and the local record helpers"
  - "firebase/firestore.rules: runs/banned/reportLimits collections plus the now-limited bugReports create, all deployed together"
  - "firebase/firestore.indexes.json: the 19 composite indexes (16 runs + 3 bugReports cleanup)"
affects: [83-03, 83-04, 83-05, 83-06, 83-07, 83-08, 83-09, 83-10, 83-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Rank-key documents (RESEARCH Pattern 1): each run stores four precomputed integer rank keys so every board query is a single orderBy/count — the rules re-derive and check each key against its formula, so a client can never lie about its own rank"
    - "A single Firestore v1 Write carries update + updateTransforms + currentDocument together (CONTEXT's atomic-equivalent instruction) for createRunCommit, rather than RESEARCH's two-Write update+transform form; 83-08 falls back to two Writes only if the live project refuses the combined form"
    - "Rules-contract testing (RESEARCH Don't-Hand-Roll): test/unit/firestore-rules.test.js extracts function bodies via brace-balanced regex slicing and evaluates extracted rank-key expressions with `new Function` against a value grid, keeping firebase/firestore.rules and its two JS mirrors (runDoc.js, reportLimits.js) equal without hand review"
    - "A byte-identical sha256-pinned region (reportShapeRegion) protects the untouched Phase 79.3 report shape from silent drift while the same file grows a second and third collection around it"

key-files:
  created:
    - src/browser/runDoc.js
    - test/unit/runDoc.test.js
    - src/browser/reportLimits.js
    - test/unit/reportLimits.test.js
    - firebase/firestore.indexes.json
    - test/unit/firestore-indexes.test.js
  modified:
    - firebase/firestore.rules
    - firebase.json
    - test/unit/firestore-rules.test.js

key-decisions:
  - "createRunCommit builds ONE Firestore v1 Write (update + updateTransforms + currentDocument.exists:false) rather than two separate Writes — CONTEXT's explicit sizing decision, since Firestore v1's Write message natively carries update_transforms alongside update; 83-08 is the live-project fallback point if this combined form is ever refused"
  - "validateRunDoc's cls/sub check uses a SUB_UNIVERSE fallback (the union of every class's subs) when cls itself is invalid, so breaking cls alone never spuriously also fails sub, and breaking sub alone (with a valid cls) always isolates to exactly ['sub'] — required for the plan's 'breaking one field yields exactly its fail id' behavior spec"
  - "validateLimitStep's JS-side {lastMs, dayMs, count} step shape is deliberately distinct from LIMIT_FIELDS (the Firestore field names 'last'/'day'/'count' used by decodeLimitDoc and the rules' keys().hasOnly/hasAll) — conflating the two shapes was the first implementation bug found and fixed during Task 2's test run"
  - "The report-shape region (isValidRun + isValidReport, with their comments) is proven byte-identical to its Phase 79.3 committed form via a dedicated sha256 pin (reportShapeRegion helper) before any edit, and re-verified after — the region's hash matched RESEARCH/CONTEXT's expected value exactly once the boundary was confirmed to include the closing brace's trailing newline"

patterns-established:
  - "src/browser/runDoc.js and src/browser/reportLimits.js are the single JS-side definitions their respective rules functions mirror — every later Phase 83 module (boardClient.js, runQueue.js, the report sheet) imports from these rather than redefining bounds/formulas"
  - "firebase/firestore.rules stays one file for the whole project (bug reports + leaderboard); a new collection is added alongside the existing ones with its own comment block, never a separate rules file"

requirements-completed: []

coverage:
  - id: D1
    description: "runDoc.js defines the whole run document contract (fields, bounds, the four rank-key formulas, buildRunDoc/validateRunDoc) with no network and no DOM; buildRunDoc succeeds for engine-built RunSummary objects at seeds 1-40 and dev startDepth 2-20"
    requirement: SRV-01
    verification:
      - kind: unit
        ref: "test/unit/runDoc.test.js#buildRunDoc: ok for engine-built summaries at seeds 1-40 / startDepth 2-20"
        status: pass
      - kind: unit
        ref: "test/unit/runDoc.test.js#createRunCommit: one Write — update (no createdAt) + updateTransforms + currentDocument.exists:false"
        status: pass
    human_judgment: false
    note: "This plan defines the document contract and the idempotent create-only commit shape (SRV-01's 'never creates a duplicate' guarantee). Actual submission (the queue, 83-06) and live proof (83-08) land in later plans — this requirement's full scope is not yet exercised end to end."
  - id: D2
    description: "firebase/firestore.rules' isValidBoardRun re-derives every rank key and checks the full field/bound/list contract, kept equal to runDoc.js by test/unit/firestore-rules.test.js (hasOnly/hasAll lists, every bound literal, the race/cause/sub lists, the handle/hash regexes, and the four rank-key formulas evaluated on a grid via new Function)"
    requirement: SRV-02
    verification:
      - kind: unit
        ref: "test/unit/firestore-rules.test.js#isValidBoardRun's hasOnly/hasAll lists equal RUN_DOC_FIELDS"
        status: pass
      - kind: unit
        ref: "test/unit/firestore-rules.test.js#every bound literal in isValidBoardRun equals its runDoc.js constant"
        status: pass
      - kind: unit
        ref: "test/unit/firestore-rules.test.js#deepKeyOf/daysKeyOf/killsKeyOf/goldKeyOf rules functions match runDoc.js's key functions on a grid"
        status: pass
      - kind: unit
        ref: "test/unit/firestore-rules.test.js#runs: get is public, list is bounded, update/delete are owner-gated; none of these four is if false"
        status: pass
    human_judgment: false
    note: "The rules text and its JS mirror are proven equal and unit-correct here. Live deploy and a smoke test against the real project are 83-08's job; this plan does not deploy anything."
  - id: D3
    description: "The 2,000-pair rank-key ordering property (deep/kills/purse against engine/records.js#compareRuns, days against the Phase 82 DAYS rule) and the 16 composite runs indexes (4 rank keys x none/race/sub/race+sub shapes) back every board query shape (topTen orderBy, count equality, rankOf's range filter)"
    requirement: SRV-03
    verification:
      - kind: unit
        ref: "test/unit/runDoc.test.js#2,000 random in-bound pairs: key ordering matches compareRuns (deep/kills/purse) and the DAYS rule (days); every key is a safe integer"
        status: pass
      - kind: unit
        ref: "test/unit/firestore-indexes.test.js#16 runs indexes: every RANK_FIELD value x none/race/sub/race+sub shape, in that order"
        status: pass
    human_judgment: false
    note: "Index declarations are proven correct in shape; live index build and a query against the deployed project (confirming Firestore accepts every shape, RESEARCH Open Question 2) happen in 83-08."
  - id: D4
    description: "reportLimits.js's nextLimitState/validateLimitStep implement the 2-minute cooldown and 5/day UTC-day-bucketed cap; firebase/firestore.rules' isValidLimitStep is proven equal (pinned whitespace-collapsed body, matching LIMIT_FIELDS) and wired into a limited bugReports create (auth required, isValidLimitStep checked via getAfter on the same-commit reportLimits/{uid} write) and a locked-down reportLimits collection (owner get/create/update only, list/delete closed)"
    requirement: SRV-09
    verification:
      - kind: unit
        ref: "test/unit/reportLimits.test.js#validateLimitStep agrees with nextLimitState on a grid of before states and times"
        status: pass
      - kind: unit
        ref: "test/unit/firestore-rules.test.js#isValidLimitStep's body (whitespace-collapsed) is pinned and contains the cooldown/daily-cap/day-bucket logic"
        status: pass
      - kind: unit
        ref: "test/unit/firestore-rules.test.js#bugReports: create needs auth + isValidReport + isValidLimitStep(getAfter); get/list/update/delete is if false"
        status: pass
      - kind: unit
        ref: "test/unit/reportLimits.test.js#buildReportCommit: two Writes — the anonymous report create, and the limit update/create"
        status: pass
    human_judgment: false
    note: "The limit's rules/JS-mirror contract and the report+limit commit shape are complete and unit-proven. Wiring sendBugReport to the shared auth module and the report sheet's local-limit UX are 83-09's job; the live-rules probes and cleanup proof are 83-10/83-11."
  - id: D5
    description: "The three bugReports cleanup indexes (status+filedAt, status+oracleTrimmed+filedAt, status+failedAt) are declared, backing the future Action's retention queries on stored timestamp fields"
    requirement: SRV-11
    verification:
      - kind: unit
        ref: "test/unit/firestore-indexes.test.js#3 bugReports cleanup indexes: status+filedAt, status+oracleTrimmed+filedAt, status+failedAt"
        status: pass
    human_judgment: false
    note: "This plan delivers only the index half of SRV-11, exactly as its own objective states. The Action's actual deletion logic (retention constants, the 100-delete cap, dry run) is 83-10's job; SRV-11 is not fully satisfied until then."

duration: 40min
completed: 2026-09-28
status: complete
---

# Phase 83 Plan 02: Run Document, Report Limit, Firestore Rules & Indexes Summary

**runDoc.js and reportLimits.js define the leaderboard run document and the per-player bug-report limit as pure JS contracts; firebase/firestore.rules grows a byte-identical-report-shape-preserving third and fourth collection (runs/banned/reportLimits) enforcing both, with 19 composite indexes declared and a grid-evaluated rules-contract test keeping everything equal.**

## Performance

- **Duration:** ~40 min
- **Tasks:** 3
- **Files modified:** 9 (6 created, 3 edited)

## Accomplishments

- `src/browser/runDoc.js` is the single definition of the leaderboard run document: `RUN_CLIENT_FIELDS`/`RUN_DOC_FIELDS`, every bound constant (floor/level/day/steps/kills/gold/sp/epitaph/version/uid/seed/acts), the four exact-integer rank-key formulas (`deepKeyOf`/`daysKeyOf`/`killsKeyOf`/`goldKeyOf`, with `daysKeyOf` applying the Phase 82 DAYS rule), `buildRunDoc`/`validateRunDoc` (the JS mirror of the rules' `isValidBoardRun`, returning granular fail ids), and the REST commit/query builders (`createRunCommit` — one Write with `update` + `updateTransforms` + `currentDocument.exists:false`, `handleUpdateCommit`, `deleteCommit`, `topTenQuery`, `countQuery`, `ownRunsQuery`).
- `src/browser/reportLimits.js` is the single definition of the per-player bug-report limit: `REPORT_COOLDOWN_MINUTES`(2)/`REPORT_DAILY_CAP`(5)/`LIMIT_FIELDS`, `utcDayMs`, `nextLimitState` (the cooldown + UTC-day-bucketed daily-cap step logic), `validateLimitStep` (the rules' `isValidLimitStep` mirror, proven to agree with `nextLimitState` on a grid of before-states and times), `decodeLimitDoc`, `randomDocId`, `buildReportCommit` (the two-Write report+limit commit — the report carries no uid anywhere), and the local pre-network record helpers (`sanitizeLocalLimit`/`checkLocalLimit`/`recordLocalSend`).
- `firebase/firestore.rules` grows from one collection (bugReports) to four (bugReports, reportLimits, runs, banned) in a single file, with the Phase 79.3 report-shape region (`isValidRun`/`isValidReport`) kept byte-identical — proven by a dedicated sha256 pin (`7bca2a5d…`) confirmed against the original commit before and after editing. The bugReports create now requires a signed-in uid and a same-commit `reportLimits/{uid}` step (proven via `getAfter`); `reportLimits` allows only the owner's own get/create/update; `runs` allows a public bounded `list`/`get`, an owner-only shape-checked `create` (with a `banned/{uid}` exclusion check), an owner-only handle-only `update`, and an owner-only `delete`; `banned` is closed to every client verb.
- `firebase/firestore.indexes.json` declares the 19 composite indexes 83-08 will deploy: 16 for `runs` (every rank key × none/race/sub/race+sub filter shape) and 3 for `bugReports` cleanup queries (`status+filedAt`, `status+oracleTrimmed+filedAt`, `status+failedAt`); `firebase.json` now points the CLI at both files.
- `test/unit/firestore-rules.test.js` extends its existing brace-balanced function-body extraction pattern to `isValidLimitStep`/`isValidBoardRun`/`isSubOfClass`/the four rank-key functions, including a `new Function`-based grid evaluation (5 floors × 7 days × 4 steps × 4 kills × 4 gold = 2,240 points × 4 formulas) proving the rules' rank-key math matches `runDoc.js`'s functions exactly.

## Task Commits

Each task was committed atomically:

1. **Task 1: src/browser/runDoc.js — the run document, rank keys, JS rules mirror and REST shapes** - `e2db5069` (feat)
2. **Task 2: src/browser/reportLimits.js — the per-player report limit mirror, the report + limit commit and the local record** - `bfbbd74f` (feat)
3. **Task 3: Extend firebase/firestore.rules (runs, banned, reportLimits, the limited bugReports create) and declare the 19 indexes** - `08d7fb56` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `src/browser/runDoc.js` - the run document contract, rank keys, JS rules mirror, REST commit/query builders
- `test/unit/runDoc.test.js` - engine-built summaries at seeds 1-40/depths 2-20, every fail id, every bound edge, the 2,000-pair key-ordering property, exact commit/query shapes
- `src/browser/reportLimits.js` - the per-player report limit mirror, the report+limit commit, local record helpers
- `test/unit/reportLimits.test.js` - every `nextLimitState` boundary, the `validateLimitStep` agreement grid, `decodeLimitDoc`, `randomDocId`, the exact two-Write commit, local record helpers
- `firebase/firestore.rules` - extended: `reportCooldownMinutes`/`reportDailyCap`/`limitPath`/`isValidLimitStep`, the limited `bugReports` create, `reportLimits`, `isValidBoardRun`/`deepKeyOf`/`daysKeyOf`/`killsKeyOf`/`goldKeyOf`/`isSubOfClass`, `runs`, `banned`
- `firebase/firestore.indexes.json` - 19 composite indexes (16 runs + 3 bugReports)
- `firebase.json` - now points `firestore.indexes` at `firebase/firestore.indexes.json`
- `test/unit/firestore-rules.test.js` - the pinned report-shape sha256, the three-create layout, `isValidLimitStep`'s pinned body, `isValidBoardRun`'s fields/bounds/lists/regexes, the rank-key grid evaluation
- `test/unit/firestore-indexes.test.js` - the 19 index shapes, the `firebase.json` path

## Decisions Made

- `createRunCommit` uses ONE Firestore v1 `Write` (carrying `update` + `updateTransforms` + `currentDocument.exists:false` together) rather than RESEARCH's two-`Write` form — CONTEXT's own sizing decision for this plan, since Firestore v1's `Write` message natively supports this combined shape; 83-08 is the documented fallback point if the live project ever refuses it.
- `validateRunDoc`'s `cls`/`sub` check falls back to a `SUB_UNIVERSE` (every class's subs, unioned) when `cls` itself is invalid, so breaking `cls` alone never spuriously also fails `sub` — required to satisfy the plan's "breaking one field yields exactly its fail id" behavior spec, including the explicit "a Fighter with sub Wizard yields sub" case.
- `validateLimitStep`'s JS-side step shape (`{lastMs, dayMs, count}`) is kept deliberately distinct from `LIMIT_FIELDS` (the Firestore document's own field names `'last'`/`'day'`/`'count'`, used by `decodeLimitDoc`'s typed-value input and the rules' `keys().hasOnly`/`hasAll`) — an early implementation draft conflated the two shapes and was caught by the grid-agreement test during Task 2.

## Deviations from Plan

None — plan executed exactly as written. (One implementation bug was caught and fixed during Task 2's own TDD loop — see the `validateLimitStep` shape decision above — well within Rule 1's scope, before the task's commit.)

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. Live Firebase configuration (rules/indexes deploy, anonymous sign-in, API key restriction) is 83-08's job; this plan is pure client code plus the rules/indexes source files, not deployed here.

## Next Phase Readiness

- `runDoc.js`'s `buildRunDoc`/`validateRunDoc`/commit and query builders are ready for 83-04's `boardClient.js` and 83-06's `boardWrites.js`/`runQueue.js`.
- `reportLimits.js`'s `buildReportCommit`/local record helpers are ready for 83-09's `bugReport.js`/`reportSheet.js` wiring.
- `firebase/firestore.rules` and `firebase/firestore.indexes.json` are ready for 83-08's live deploy (rules + indexes together) and smoke test.
- No blockers.

**Verification run (this plan's scope):** `node --test test/unit/runDoc.test.js test/unit/reportLimits.test.js test/unit/firestore-rules.test.js test/unit/firestore-indexes.test.js test/unit/bug-report.test.js test/unit/voice-corpus.test.js` — 146 pass, 0 fail.
**Full suite (`npm test`, once at plan close):** 8062 pass, 0 fail, 2 skipped (pre-existing) — exit code 0.
**Engine gate:** `git status --porcelain -- engine test/parity content` is empty.

**Human verification (deferred to end of run):** None — this plan ships no device-testable surface (data-model/rules/index source files only, no UI, nothing deployed).

## Requirement coverage note

This plan's frontmatter lists `SRV-01, SRV-02, SRV-03, SRV-09, SRV-11` — matching every other Phase 83 plan's frontmatter, these same IDs recur in 83-06 through 83-11 (submission, live deploy, sheet wiring, cleanup logic, live proof). REQUIREMENTS.md checkboxes for these IDs are intentionally left unchecked here; this plan's contribution (the rules/JS-mirror contract, the rank-key math, the commit shapes, the index declarations) is recorded in the `coverage` block above and should be read as partial. `SRV-11` in particular is explicitly only its "index half" per this plan's own objective — the Action's deletion logic is 83-10's job.

---
*Phase: 83-leaderboard-server*
*Completed: 2026-09-28*

## Self-Check: PASSED

All created files found on disk (`src/browser/runDoc.js`, `test/unit/runDoc.test.js`, `src/browser/reportLimits.js`, `test/unit/reportLimits.test.js`, `firebase/firestore.indexes.json`, `test/unit/firestore-indexes.test.js`); all three task commits (`e2db5069`, `bfbbd74f`, `08d7fb56`) found in git log.
