---
phase: 99-engine-facts-lifetime-stats-tracker
plan: 02
subsystem: achievements
tags: [achievements, tracker, lifetime-record, headless-tests]
requires:
  - phase: 98
    provides: content/achievements.js catalog (77 entries, TRIGGER_VOCABULARY)
provides:
  - src/browser/achievementRecord.js (ACHIEVEMENTS_KEY, RECORD_VERSION, emptyRecord, sanitizeRecord, parseRecord, serializeRecord)
  - src/browser/achievementTracker.js (beginRun, foldAction, progressFor, runTagOf, filledSlotCount)
  - test/unit/harness/achievementState.js (mkState, ev, seedRecord, deepFreeze)
affects: [99-03 adapter wiring, 100 unlock banner and list, 101 Play mirror]
tech-stack:
  added: []
  patterns: [pure shell module with tolerant sanitize, fold returns { record, unlocks, reveals, progress, changed }, deep-frozen records]
key-files:
  created:
    - src/browser/achievementRecord.js
    - src/browser/achievementTracker.js
    - test/unit/harness/achievementState.js
    - test/unit/achievement-record.test.js
    - test/unit/achievement-tracker.test.js
    - test/unit/achievement-tracker-runs.test.js
    - test/unit/achievement-tracker-sweep.test.js
  modified: []
key-decisions:
  - "The tracker mutates a JSON clone of the input record and returns sanitizeRecord(clone), so every returned record is canonical, deep-frozen and byte-stable; changed compares serialized forms"
  - "unlocked keys are written in catalog list order by sanitize, so serialization does not depend on the order unlocks were earned"
  - "beginRun does not touch bests (the shared evaluation only, per the spec); bests move on foldAction"
  - "A died event with a non-string cause counts as a real death with an empty cause (any-death Special Snowflake can match it; no cause-listed entry can)"
requirements-completed: [TRACK-02, TRACK-03, TRACK-04, TRACK-05]
status: complete
duration: ~1h
completed: 2026-10-05
---

# Phase 99 Plan 02: Lifetime stats record and pure achievement tracker Summary

**A deep-frozen, tolerant-loading lifetime record (ddr.achievements.v1) and a pure, headless tracker whose sweep test drives all 77 catalog achievements from one short of the threshold to exactly the threshold.**

## What was built

- `src/browser/achievementRecord.js`: record shape per the plan's record_spec (`v`, `counters`, `kills`, `bests`, `flags`, `subClassesDelved`, `unlocked`, `revealed`, `run`). Key sets (BESTIARY, RACES, CLASSES, sub-classes, Hidden ids) are derived from content/. Anything unreadable, non-object or not `v: 1` loads as `emptyRecord()`; a v1 record with bad fields keeps the valid ones. An unlock with a bad date is kept at 0; an unlocked Hidden id is always also in `revealed`.
- `src/browser/achievementTracker.js`: `beginRun(record, state, options)` and `foldAction(record, events, before, after, options)` return `{ record, unlocks, reveals, progress, changed }` (all frozen; unchanged results return the very record passed in). Imports: achievements, bestiary, classes and achievementRecord only. Dev runs return the same record with empty lists.
- Run section `{ tag, seen, stepped, naked, teetotal, fleesWon }` is tagged by `runTagOf` (seed|race|sub|name); beginRun resets it, a mismatched or missing tag becomes an unseen run (no Naked Ambition or Teetotaler), relaunch keeps it.
- Harness `test/unit/harness/achievementState.js`: `mkState`, `ev`, `seedRecord`, `deepFreeze`.

## Task commits

1. Task 1, record module, harness and record tests: `24b0e7b6`
2. Task 2, tracker (counts, bests, deaths, flags, Tourist, reveals, progress) and the 73-entry sweep: `d7928234`
3. Task 3, run-scoped rules (Chicken, Naked Ambition, Teetotaler, Fully Dressed), run tests, sweep extended to 77: `e224eaad`

## Tests (targeted only; no full suite, no bots)

| File | Tests |
|------|-------|
| test/unit/achievement-record.test.js | 18 |
| test/unit/achievement-tracker.test.js | 34 |
| test/unit/achievement-tracker-runs.test.js | 21 |
| test/unit/achievement-tracker-sweep.test.js | 4 (one drives all 77 ids, each unlocked exactly once) |

Total 77, all passing. Together with test/unit/stale-terms.test.js and test/determinism/content-is-pure-data.test.js the verify command ran 84 tests, 84 passing. A mutation check (Chicken counting any fled reason) failed the runs test as expected.

## Interpretation calls

- Events are matched by exact `type`; a `died` event whose `cause` is not a string still counts as a real death (empty cause).
- `afflictionTick` always counts toward Terminal Condition when `wp === 1` (no `first` gate); `afflictionCaught` needs `first > 0` and `wp === 1`. The kind strings are the content's `Disease` and `Poison`.
- The first step is detected from a `moved` event or `after.steps > before.steps`, and judged on `before.c` (falling back to `after.c`).
- Same-action ordering: events (including a `potionDrunk`) apply before the evaluation, so drinking in the action that reaches floor 5 blocks Teetotaler.
- The tracker does not import `content/races.js` (it only needs key existence in the record's own best maps); the purity test allows the five specified modules.

## Deviations from Plan

None. The plan executed as written; no engine, adapter, storage, content or planning-state files were touched.

## Known Stubs

None.

## Threat Flags

None. The modules have no network, storage, analytics or Play call; they only return values.

## Self-Check: PASSED

- Files exist: achievementRecord.js, achievementTracker.js, harness/achievementState.js and the four test files.
- Commits exist: 24b0e7b6, d7928234, e224eaad.
