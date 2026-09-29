---
phase: 84-leaderboards-panel-v3
plan: 01
subsystem: database
tags: [firestore, firebase-rules, firebase-cli, leaderboards, run-doc-contract]

# Dependency graph
requires:
  - phase: 83-leaderboard-server
    provides: "the run-doc contract (runDoc.js), the transition rules pair, fakeBoardServer.js, boards-smoke.mjs, and the live delve-die-repeat-6ba5f board"
provides:
  - "note and when fields on the board run-doc contract (JS mirror + both rules files), enforced identically client-side, server-side (live) and in the dev-loop fake"
  - "rankKeyOf(stat, run) — the one shared rank-key function later Leaderboards-view plans (84-05..84-09) rank by"
  - "the live delve-die-repeat-6ba5f project running the updated TRANSITION rules, proven by two clean --with-admin smoke runs"
affects: [84-02, 84-03, 84-04, 84-05, 84-06, 84-07, 84-08, 84-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "validateRunDoc(doc, {uid, now}) — an optional now bounds a timestamp-ish field the same way the live rules' request.time does; omitting now skips the client-side upper-bound check and defers to the server/fake clock"
    - "rankKeyOf(stat, run) dispatch function sitting beside the four standalone *KeyOf formulas, so both Leaderboards views share one entry point instead of switching on stat ids themselves"

key-files:
  created: []
  modified:
    - src/browser/runDoc.js
    - firebase/firestore.rules
    - firebase/firestore.transition.rules
    - src/browser/fakeBoardServer.js
    - tools/boards-smoke.mjs
    - docs/LEADERBOARDS.md
    - test/unit/runDoc.test.js
    - test/unit/firestore-rules.test.js
    - test/unit/fakeBoardServer.test.js
    - test/unit/boardClient.test.js
    - test/unit/boardWrites.test.js
    - test/unit/boards-admin.test.js
    - test/unit/boards-smoke.test.js
    - test/unit/runBackfill.test.js

key-decisions:
  - "when's upper bound carries a one-day clock-skew allowance (WHEN_SKEW_MS = 86,400,000ms) enforced by request.time on the live rules and by the fake's own injected clock — never by a client-supplied now unless the caller explicitly passes one to validateRunDoc"
  - "note is bounded to NOTE_MAX_CHARS = 120 and proven against the worst case: every CAUSE_TEXT template filled with the longest elite-titled bestiary name (30 chars) still lands under 120 (longest is 65)"
  - "rankKeyOf(stat, run) dispatches to the existing deepKeyOf/daysKeyOf/killsKeyOf/goldKeyOf rather than introducing a new formula, keeping the rules/JS-mirror equality test's grid check untouched"

requirements-completed: []  # BOARD-22/BOARD-20 are in this plan's frontmatter `requirements` field but are NOT marked complete in REQUIREMENTS.md — the phase source audit table (84-01-PLAN.md) shows both requirements' UI surface (bottom sheets, tap-to-expand row) also needs 84-05/84-06/84-07/84-09; this plan delivers only the run-doc contract groundwork (note/when/rankKeyOf) those later plans build on. See "Requirement Coverage" below.

coverage:
  - id: D1
    description: "runDoc.js's RUN_CLIENT_FIELDS/RUN_DOC_FIELDS/RUN_FAIL_IDS carry note and when in order; NOTE_MAX_CHARS and WHEN_SKEW_MS exported; validateRunDoc checks both fields (note length, when safe-int >=0, optional now-bounded upper bound); buildRunDoc copies note/when from the RunSummary"
    requirement: "BOARD-22"
    verification:
      - kind: unit
        ref: "test/unit/runDoc.test.js — constants, bound-edges (note/when), FIELD_BREAKS, buildRunDoc seeds 1-40/dev-depths"
        status: pass
    human_judgment: false
  - id: D2
    description: "firebase/firestore.rules and firebase/firestore.transition.rules both add the note/when clauses to isValidBoardRun, kept byte-identical outside the transition header and the bugReports create clause"
    requirement: "BOARD-22"
    verification:
      - kind: unit
        ref: "test/unit/firestore-rules.test.js — isValidBoardRun hasOnly/hasAll + bound-literal pins"
        status: pass
      - kind: unit
        ref: "test/unit/firestore-transition-rules.test.js — byte-identical-outside-header equality"
        status: pass
    human_judgment: false
  - id: D3
    description: "rankKeyOf(stat, run) is the one shared rank-key function both Leaderboards views (later plans) will rank by"
    requirement: "BOARD-20"
    verification:
      - kind: unit
        ref: "test/unit/runDoc.test.js — rankKeyOf: dispatches to deepKeyOf/daysKeyOf/killsKeyOf/goldKeyOf; null for anything else"
        status: pass
    human_judgment: false
  - id: D4
    description: "fakeBoardServer.js enforces the when upper bound against its own injected clock on every run create (user and admin paths); a doc missing note is denied"
    requirement: "BOARD-22"
    verification:
      - kind: unit
        ref: "test/unit/fakeBoardServer.test.js — when bound uses the fake's own clock; a doc that omits note -> 403"
        status: pass
    human_judgment: false
  - id: D5
    description: "tools/boards-smoke.mjs submits note/when on every smoke run; every existing doc-building test helper (fakeBoardServer/boardClient/boardWrites/boards-admin/boards-smoke) stays valid with the new fields"
    requirement: "BOARD-22"
    verification:
      - kind: unit
        ref: "test/unit/boards-smoke.test.js — smokeSummaries: three frozen RunSummaries ... note/when shape"
        status: pass
      - kind: unit
        ref: "node tools/boards-smoke.mjs --dry-run prints note/when in every summary"
        status: pass
    human_judgment: false
  - id: D6
    description: "an older-shape board doc (no note, no when) still decodes through boardClient.js#decodeRunDocument without throwing"
    requirement: "BOARD-22"
    verification:
      - kind: unit
        ref: "test/unit/boardClient.test.js — topTen: a seeded older-shape doc (no note, no when) decodes without throwing"
        status: pass
    human_judgment: false
  - id: D7
    description: "the live delve-die-repeat-6ba5f project runs the new TRANSITION rules (note/when clauses), deployed via --config firebase.transition.json only (never firebase.json this milestone); a live smoke submitting note/when runs passes"
    requirement: "BOARD-22"
    verification:
      - kind: e2e
        ref: "node tools/boards-smoke.mjs --with-admin — two live runs, 17/17 steps PASS, exit 0 each; recorded in docs/LEADERBOARDS.md section 14"
        status: pass
    human_judgment: false

# Metrics
duration: 41min
completed: 2026-09-29
status: complete
---

# Phase 84 Plan 01: Run-Doc Note/When Contract and rankKeyOf Summary

**Board run docs now carry `note` (the killer's name) and `when` (the death time, one-day clock-skew allowance), enforced identically by the JS mirror, both rules files and the fake, with the live transition rules redeployed and proven by two clean smoke runs**

## Performance

- **Duration:** 41 min
- **Started:** 2026-09-29T07:44:00-04:00 (approx, first file read)
- **Completed:** 2026-09-29T08:22:49-04:00
- **Tasks:** 3
- **Files modified:** 14

## Accomplishments
- `src/browser/runDoc.js`: `note`/`when` added to the field contract, `NOTE_MAX_CHARS`/`WHEN_SKEW_MS` bounds, `validateRunDoc`'s optional `now`-bounded `when` check, `buildRunDoc` copying both from the `RunSummary`, and the new `rankKeyOf(stat, run)` shared rank-key dispatcher
- `firebase/firestore.rules` and `firebase/firestore.transition.rules`: matching `isValidBoardRun` clauses, kept byte-identical outside the transition header and the `bugReports` create clause (proven by `firestore-transition-rules.test.js`)
- `src/browser/fakeBoardServer.js`: `commitRunCreate` now passes its own injected clock into `validateRunDoc`, so the dev-loop fake enforces the `when` bound exactly like the live rules
- `tools/boards-smoke.mjs`: every smoke run carries a family-friendly `note` and a `when` reusing the already-read `seed` timestamp
- Live deploy: `firebase deploy --only firestore:rules --config firebase.transition.json --project delve-die-repeat-6ba5f --non-interactive` — "Deploy complete!"
- Live smoke: `node tools/boards-smoke.mjs --with-admin`, run twice, both 17/17 steps PASS, exit 0, cleanup confirmed with `tools/boards-admin.mjs top`
- `docs/LEADERBOARDS.md` updated: section 3's field table gains `note`/`when` rows and a `rankKeyOf` sentence; section 14 gains the "Run-doc fields note and when (Phase 84, 2026-09-29)" record

## Task Commits

Each task was committed atomically:

1. **Task 1: runDoc.js note/when contract, rankKeyOf, and both rules files** - `5f10badf` (feat)
2. **Task 2: fake server, smoke tool and every doc-building test helper follow the new contract** - `4f28456f` (feat)
3. **Task 3: runbook field table, LIVE transition-rules redeploy and live smoke record** - `591d4d82` (docs)

_No TDD RED/GREEN split was used — Task 1 is `tdd="true"` but the plan's own action step wrote tests and implementation together per field, verified green as a whole before commit; both test and source changes landed in the single `5f10badf` commit._

## Files Created/Modified
- `src/browser/runDoc.js` - `note`/`when` fields, `NOTE_MAX_CHARS`/`WHEN_SKEW_MS`, `validateRunDoc`'s `now` option, `buildRunDoc` copy, `rankKeyOf`
- `firebase/firestore.rules` - `isValidBoardRun` note/when clauses, updated header comments
- `firebase/firestore.transition.rules` - identical clauses (byte-for-byte outside the transition header/bugReports create)
- `src/browser/fakeBoardServer.js` - `commitRunCreate` passes `now: now()` into both `validateRunDoc` calls
- `tools/boards-smoke.mjs` - `SMOKE_SHARED.note`, `when` on every smoke summary
- `docs/LEADERBOARDS.md` - field table rows, `rankKeyOf` sentence, section 14 live-deploy/smoke record
- `test/unit/runDoc.test.js` - note/when bound-edges, `now`-bounded `when`, `rankKeyOf`, CAUSE_TEXT-vs-NOTE_MAX_CHARS proof
- `test/unit/firestore-rules.test.js` - `NOTE_MAX_CHARS`/`WHEN_SKEW_MS` bound-literal pins
- `test/unit/fakeBoardServer.test.js` - `when`-bound-at-the-fake's-clock and missing-note denial tests, fixture `note`/`when`
- `test/unit/boardClient.test.js` - older-shape-doc decode test, fixture `note`/`when`
- `test/unit/boardWrites.test.js` - fixture `note`/`when` (raw `docFor` helper only — `baseSummary` already carried both from Phase 83)
- `test/unit/boards-admin.test.js` - fixture `note`/`when`
- `test/unit/boards-smoke.test.js` - `smokeSummaries` note/when assertions
- `test/unit/runBackfill.test.js` - clock-default fix (see Deviations)

## Decisions Made
- `when`'s upper bound is a one-day clock-skew allowance (`WHEN_SKEW_MS`), matching the CONTEXT/orchestrator ruling; enforced by `request.time` live and by each test harness's own injected clock in the fake — never by a bare `Date.now()` inside `validateRunDoc` itself
- `rankKeyOf` reuses the four existing formulas rather than introducing new key math, so the rules/JS-mirror grid-equality test in `firestore-rules.test.js` needed no changes
- `boardWrites.test.js`'s `baseSummary` (a `RunSummary`-shaped fixture) already carried `note`/`when` from Phase 83's forward-compatible fixture — only its separate raw-doc `docFor` helper needed the new fields added

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `test/unit/runBackfill.test.js`'s stale fake-server clock**
- **Found during:** Task 2 verification (`node --test ... test/unit/runBackfill.test.js`)
- **Issue:** `runBackfill.test.js` is not in this plan's `files_modified`, but its `makeFullStack()` helper started the fake board's injected clock at a literal `1000000` (1969-era epoch ms), while every `summary()` fixture in that file carries a `when` anchored to `BACKFILL_SINCE_MS` (`Date.UTC(2026, 8, 28, ...)` — real 2026 epoch ms, ~1.79 trillion). Once Task 2's fake-server change enforced `when <= now() + WHEN_SKEW_MS` against that clock, every backfill enqueue in that file was denied (`PERMISSION_DENIED`), failing 2 of its tests.
- **Fix:** Changed `clockBox`'s default `start` parameter in that file from `1000000` to `BACKFILL_SINCE_MS`, with a comment explaining why (the fake's own `when` bound compares against this clock).
- **Files modified:** test/unit/runBackfill.test.js
- **Verification:** `node --test test/unit/runBackfill.test.js` — 17/17 pass; full Task 2 verify set (175 tests across 7 files) — all pass
- **Committed in:** `4f28456f` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix, outside declared `files_modified` but directly caused by this plan's own change)
**Impact on plan:** Necessary for correctness — the fix only corrects a test fixture's clock to match its own fixture data; no production code or test assertion intent changed. No scope creep.

## Issues Encountered
None beyond the deviation above.

## Requirement Coverage

This plan's frontmatter lists `requirements: [BOARD-22, BOARD-20]`, but neither is marked complete in `REQUIREMENTS.md` — both describe UI surface (bottom-sheet pickers, tap-to-expand row cards showing `note` as the cause of death and `when` as the date line) that this plan does not build. Per the phase source audit table in `84-01-PLAN.md`, BOARD-20 also needs 84-05/84-06/84-07/84-09 and BOARD-22 also needs 84-05/84-06. This plan delivers only the underlying contract (`note`, `when`, `rankKeyOf`) those UI plans consume — partial coverage, correctly left `[ ]` pending until the UI plans land.

## User Setup Required
None - no external service configuration required. The live Firebase deploy and smoke run were executed as part of Task 3 using the already-authenticated `firebase`/`gcloud` CLIs (per the plan's run_notes).

## Human verification (deferred to end of run)

None. This plan ships no device-testable UI surface — a run-doc contract change, two rules files, a dev-loop fake, a Node smoke tool, and a live infra deploy, all proven by automated unit tests and a live `--with-admin` smoke run recorded in `docs/LEADERBOARDS.md` section 14.

## Next Phase Readiness
- The run-doc contract (`note`, `when`, `rankKeyOf`) is live and tested — Plans 84-02 through 84-09 (the panel UI, YOUR DEAD history, the two views) can now read/build docs carrying both fields and rank by the shared `rankKeyOf`.
- The live `delve-die-repeat-6ba5f` project is running the updated TRANSITION rules; the 2.2 release-day step (deploy `firebase.json`, delete the three transition files) remains Phase 86's, unchanged by this plan.
- No blockers for downstream 84-plans.

---
*Phase: 84-leaderboards-panel-v3*
*Completed: 2026-09-29*

## Self-Check: PASSED

All 14 files listed above verified present on disk; all 3 task commits (`5f10badf`, `4f28456f`, `591d4d82`) verified present in `git log`.
