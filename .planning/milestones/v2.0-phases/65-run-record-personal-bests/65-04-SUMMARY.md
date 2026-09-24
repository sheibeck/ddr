---
phase: 65-run-record-personal-bests
plan: 04
subsystem: engine
tags: [run-summary, fnv1a32-hash, personal-bests, adapter-persistence, death-report]

# Dependency graph
requires:
  - phase: 65-run-record-personal-bests (Plan 01)
    provides: "state.acts, a non-negative integer on every GameState"
  - phase: 65-run-record-personal-bests (Plan 02)
    provides: "engine/records.js — runHash, the shared board table, emptyBests/sanitizeBests/updateBests/backfillBests"
  - phase: 65-run-record-personal-bests (Plan 03)
    provides: "content/boards.js BOARD_COPY, src/browser/newBest.js's report-shaped view model"
provides:
  - "content/season.js SEASON = 1, re-exported via content/index.js"
  - "engine/death.js#buildRunSummary, now exported, carrying season/seed/acts/hash"
  - "ddr.best.v1 retired outright: no adapter reader/writer remains; storage.js's LEGACY_KEYS migration still copies the on-disk value unchanged"
  - "GRAVE_CAP restored to 60 in src/browser/engineAdapter.js"
  - "ddr.bests.v1 (BESTS_KEY): loadBests()/getBests()/takeDeathRecord() exported from engineAdapter.js; loaded/backfilled at boot(), folded synchronously at every non-dev death, persisted back-to-back with the graveyard write"
affects: [65-05-death-panel-wiring, 66-leaderboards-panel, 68-pgs-submission]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "buildRunSummary's hash is computed once, at construction, via engine/records.js#runHash — no caller recomputes it"
    - "recordDeath() (synchronous, in-memory) always runs before persistGrave() (async, storage-routed) at the SAME died-event choke point, so the death panel can read a synchronous answer while the durable write still happens off the critical path"
    - "persistGrave()'s lazy-load fallback: a death that reaches persistGrave() before bests was ever loaded this session calls loadBests() itself rather than writing a fresh empty record over a stored one"

key-files:
  created:
    - content/season.js
    - test/unit/run-summary.test.js
    - test/unit/bests-adapter.test.js
  modified:
    - content/index.js
    - engine/death.js
    - src/browser/engineAdapter.js
    - src/browser/storage.js
    - src/browser/settings.js
    - test/unit/engineAdapter.test.js
    - test/unit/new-run-loop.test.js

key-decisions:
  - "buildRunSummary's seed field is null (not left undefined) when the input state has no numeric seed (a hand-built state, as death.test.js's own fixedState() constructs). An explicit `seed: undefined` object property is dropped by JSON.stringify but stays present on the in-memory object, which broke death.test.js's pre-existing byte-for-byte round-trip assertion — a Rule 1 fix, not a behavior change for any real GameState (newRun always sets a numeric seed)."
  - "GRAVE_CAP's comment explains the Phase 65 reversal of audit-batch E12 part 1 in place, rather than leaving a stale '5 most recent' comment beside a 60 constant."
  - "recordDeath() is synchronous and wrapped in its own try/catch so a bug in the bests fold can never surface through dispatch()'s fail-closed catch and replace the dead run with a fresh one — the graveyard write and the death panel's report must both survive it."

patterns-established:
  - "Cross-run adapter state that needs a 'fresh per session, no invented values' contract (bests, deathRecord) is set to null at the top of initRun(), exactly like bootWornReport's existing one-shot posture."

requirements-completed: [RUN-01, RUN-02, RUN-03, RUN-04]

coverage:
  - id: D1
    description: "buildRunSummary (exported) carries season 1, the run's seed, its validated-action count (acts) and an 8-hex FNV-1a hash that is the run's stable id — immune to epitaph/note copy edits and the wall clock, sensitive to the seed and action sequence"
    requirement: "RUN-01"
    verification:
      - kind: unit
        ref: "test/unit/run-summary.test.js (9 tests, including the 'hash is the run id' invariants)"
        status: pass
      - kind: unit
        ref: "test/unit/death.test.js (unedited, still green)"
        status: pass
    human_judgment: false
  - id: D2
    description: "ddr.best.v1 retired outright: getBest()/recordBest() removed, startNewRun() never writes it, storage.js's LEGACY_KEYS migration still copies an existing on-disk value unchanged; the stored graveyard reverts from 5 to 60 stones (matching engine/death.js#bury's own cap)"
    requirement: "RUN-02"
    verification:
      - kind: unit
        ref: "test/unit/engineAdapter.test.js (re-pinned E12 cap tests + new 62-death trim test)"
        status: pass
      - kind: unit
        ref: "test/unit/new-run-loop.test.js#startNewRun() never writes the retired best-depth key"
        status: pass
    human_judgment: false
  - id: D3
    description: "ddr.bests.v1 is loaded (or backfilled from the legacy graveyard) before boot() resolves, folds every non-dev death synchronously so getBests()/takeDeathRecord() reflect it before dispatch() returns, and persists back-to-back with the graveyard write; a lazy-load fallback handles a death that races ahead of boot(); legacy keys, corrupt JSON, old saves with no acts, and blocked storage all load/persist tolerantly"
    requirement: "RUN-03"
    verification:
      - kind: unit
        ref: "test/unit/bests-adapter.test.js (17 tests: lazy path first, boot backfill/legacy tolerance, synchronous fold, 60-stone trim survival, back-to-back deaths, waitForPending-only persistence, blocked storage, dev exclusion, shared-table guard)"
        status: pass
    human_judgment: false
  - id: D4
    description: "takeDeathRecord() hands the death panel a one-shot { first, newBests, summary } report, consumed on read and cleared by initRun()/startNewRun(); a dev run's death never produces one"
    requirement: "RUN-04"
    verification:
      - kind: unit
        ref: "test/unit/bests-adapter.test.js#first-ever death / getBests() reflects a new death synchronously / a deeper run announces new bests / starting a new run clears any pending one-shot death report"
        status: pass
    human_judgment: false

# Metrics
duration: ~90min (includes one mid-plan session interruption/reauth between Task 1 and Task 2)
completed: 2026-09-23
status: complete
---

# Phase 65 Plan 04: Run Record & Personal Bests — Summary and Adapter Wiring Summary

**Every death now carries a season-tagged, hash-identified RunSummary and folds into a durable, all-time `ddr.bests.v1` personal-bests record loaded at boot and updated synchronously at the moment of death — `ddr.best.v1` is retired, the graveyard reverts to 60 stones, and the death panel has a one-shot `takeDeathRecord()` report ready to consume.**

## Performance

- **Duration:** ~90 min (Task 1 completed, then a login-expiry interruption; Tasks 2-3 resumed in the same worktree with no lost work)
- **Started:** 2026-09-23T20:51:13Z (worktree base commit)
- **Completed:** 2026-09-23T22:26:41Z
- **Tasks:** 3
- **Files modified:** 10 (3 new, 7 modified)

## Accomplishments

- `content/season.js` exports `SEASON = 1` with a hand-bumped changelog comment; re-exported through `content/index.js`
- `engine/death.js#buildRunSummary` is now exported and carries `season`, `seed` (or `null` on a hand-built state with none), `acts` (tolerant-coerced to 0), and `hash` — an 8-hex FNV-1a id (`engine/records.js#runHash`) that is the run's stable identity: immune to epitaph/note edits and the wall clock, sensitive to the seed and action sequence. `die()` and `bury()` call it unchanged and always agree on a hash for the same post-death state
- `src/browser/engineAdapter.js`: `BEST_KEY`/`getBest()`/`recordBest()` removed outright (greenfield ruling, D-09); `startNewRun()` no longer records a best-depth at all. `GRAVE_CAP` reverts from 5 to 60, matching `engine/death.js#bury`'s own cap
- `ddr.bests.v1` (`BESTS_KEY`): `loadBests()`/`getBests()`/`takeDeathRecord()` exported. `boot()` loads (or backfills from the just-migrated graveyard) the record before it resolves. A module-private `recordDeath()` synchronously folds every non-dev death into the in-memory record at dispatch()'s died-event choke point — `getBests()`/`takeDeathRecord()` already reflect a death the instant `dispatch()` returns, before any await. `persistGrave()` enqueues the `ddr.bests.v1` write back-to-back with the three existing graveyard writes in one `Promise.all`, and falls back to loading (or backfilling) the record itself if a death ever reaches it before `bests` was loaded this session (never overwriting a stored record with a fresh empty one)
- 39 new tests across `test/unit/run-summary.test.js` (9), `test/unit/bests-adapter.test.js` (17), plus re-pinned/added tests in `test/unit/engineAdapter.test.js` and `test/unit/new-run-loop.test.js`

## Task Commits

Each task was committed atomically:

1. **Task 1: SEASON and the run summary's season, seed, acts and hash fields** - `e366d8c` (feat)
2. **Task 2: retire the single best-depth key and restore the 60-stone graveyard, re-pinning the tests that encoded the old rules** - `d6e5054` (feat)
3. **Task 3: the ddr.bests.v1 record (boot load and backfill, synchronous fold at death, tracked persist) and the one-shot death report** - `47414d1` (feat)

## Files Created/Modified

- `content/season.js` - `SEASON = 1`, hand-bumped changelog
- `content/index.js` - re-exports `content/season.js`
- `engine/death.js` - `buildRunSummary` exported; gains `season`/`seed`/`acts`/`hash`
- `test/unit/run-summary.test.js` - 9 tests: SEASON, the four new fields, the "hash is the run id" invariants, die()/bury() hash agreement, no-mutation, a hand-built state with no acts/seed
- `src/browser/engineAdapter.js` - `BEST_KEY`/`getBest()`/`recordBest()` removed; `GRAVE_CAP` 60; `BESTS_KEY`/`loadBests()`/`getBests()`/`takeDeathRecord()`/`recordDeath()` added; `boot()`/`initRun()`/`dispatch()`/`persistGrave()` updated
- `src/browser/storage.js` - comment-only edits removing references to the retired `getBest()`/`recordBest()`; `BEST_KEY`/`LEGACY_KEYS` executable code untouched
- `src/browser/settings.js` - comment-only edit removing a `getBest()` reference
- `test/unit/engineAdapter.test.js` - removed the 3 best-depth tests + the D-13 best-depth test; re-pinned both E12 cap tests to 60; added a 62-death trim test
- `test/unit/new-run-loop.test.js` - replaced the best-depth test with one proving `startNewRun()` never writes `ddr.best.v1`
- `test/unit/bests-adapter.test.js` - 17 tests covering the full Task 3 behavior list

## Decisions Made

- `buildRunSummary`'s `seed` field is coerced to `null` (not left as an explicit `undefined` property) when `state.seed` isn't a number — a hand-built state, exactly like `death.test.js`'s own `fixedState()` helper, has no `seed` at all. An explicit `seed: undefined` object key survives on the in-memory summary but is silently dropped by `JSON.stringify`, which would have broken `death.test.js`'s pre-existing "RunSummary JSON round-trips losslessly" assertion (`roundTripped` vs `summary` would then differ by one key). Every real `GameState` (from `newRun`) always has a numeric `seed`, so this is a defensive fallback for the synthetic-state test path, not a behavior change for any actual run.
- `recordDeath()` runs strictly before `persistGrave()` and is fully synchronous — this is what makes `getBests()`/`takeDeathRecord()` answer correctly the instant `dispatch()` returns, without the death panel ever awaiting a storage round-trip.
- `persistGrave()`'s lazy-load fallback (triggered when `summary` is present but `bestsJson` is `null`) reuses `loadBests()` itself rather than a bespoke read, so the "never overwrite a stored record with a fresh empty one" guarantee lives in exactly one place.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `buildRunSummary`'s `seed` field broke `death.test.js`'s existing JSON round-trip assertion**
- **Found during:** Task 1, while writing `test/unit/run-summary.test.js` and cross-checking `test/unit/death.test.js` for the "passes unedited" requirement
- **Issue:** The plan's action text specified `seed: state.seed` verbatim. `death.test.js`'s `fixedState()` helper (used across many pre-existing tests) never sets a `seed` field, so `state.seed` is `undefined` there. Assigning `seed: undefined` in the summary object literal creates an own enumerable property with an `undefined` value; `JSON.stringify` drops that key entirely, so `JSON.parse(JSON.stringify(summary))` no longer has a `seed` key at all, while `summary` itself still does — `assert.deepStrictEqual(roundTripped, summary)` in `death.test.js`'s existing "die returns a RunSummary that JSON round-trips" test would then fail (confirmed with a standalone Node repro before deciding on the fix).
- **Fix:** `seed: typeof state.seed === "number" ? state.seed : null`. `null` round-trips through JSON losslessly and `engine/records.js#runHash`'s `canon()` helper already treats `null`/`undefined` identically (both map to `""`), so the hash is unaffected either way.
- **Files modified:** `engine/death.js`
- **Verification:** `node --test test/unit/run-summary.test.js test/unit/death.test.js` — 37/37 pass, including the pre-existing JSON round-trip test, unedited
- **Committed in:** `e366d8c` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1)
**Impact on plan:** Necessary correctness fix, invisible to any real run (every `GameState` from `newRun` has a numeric seed). No scope creep — confined to `buildRunSummary`'s field assignment.

## Issues Encountered

- A brief mid-plan interruption: the executor's login expired immediately after Task 1's commit (`e366d8c`). On resume, the worktree branch/HEAD assertions were re-verified (HEAD on `worktree-agent-a6895798d27d09556`, exactly `e366d8c` on top of base `0d7a922`, clean working tree) before continuing with Tasks 2-3 in the same worktree — no work was lost or redone.
- `npm test` on this worktree reports the same **7 pre-existing, unrelated failures** documented in this phase's Plan 01/02/03 SUMMARYs (Windows CRLF checkout of `docs/CLASS-PASS.md`/`docs/FLEE.md` breaking two `$`-anchored doc-ledger guard tests) — confirmed by name-for-name comparison across all three `npm test` runs in this plan (after Task 1, Task 2, and Task 3) that the failing-test set never changed and never grew. Every test this plan is accountable for is green: `test/unit/run-summary.test.js` (9/9), `test/unit/bests-adapter.test.js` (17/17), `test/unit/engineAdapter.test.js` (36/36), `test/unit/new-run-loop.test.js`, `test/persistence/*.test.js` (44/44), and the full `test/parity/*.test.js` suite, with `git diff --stat -- test/parity/fixtures/ test/parity/prototype-master.js.txt` empty throughout. Per project instructions, `deferred-items.md` was NOT created or appended for this plan.

## Human verification (deferred to end of run)

None new from this plan (engine/adapter-only, no player-visible UI change — the death panel's new-best block itself is Plan 65-05's job). The Phase 69 Pixel 7 UAT batch should additionally cover, per this plan's `<output>` spec:
1. Install this build OVER an existing install that has graves: the app boots, the Dead tab still lists stones, and there is no crash (backfill).
2. Die twice: the Dead tab count rises, and the app restarts cleanly.
3. With storage cleared in Android settings, a first death works without error.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 65-05 (or Phase 66) can wire `takeDeathRecord()`'s `{ first, newBests, summary }` report straight into `src/browser/newBest.js#newBestView()` (Plan 65-03) to render the death panel's "NEW PERSONAL BEST" block — the report shape already matches what that view model consumes.
- Phase 66's Leaderboards panel can read `getBests()` directly for the seven boards; `content/boards.js#BOARD_COPY`'s keys are verified `deepStrictEqual` to `engine/records.js#BOARD_IDS` by this plan's own test.
- No blockers. The 7 pre-existing CRLF-related test failures are tracked in this phase's earlier SUMMARYs and STATE.md's standing `.gitattributes eol=lf pin` follow-up; they do not affect this plan's deliverables.

---
*Phase: 65-run-record-personal-bests*
*Completed: 2026-09-23*

## Self-Check: PASSED

- FOUND: content/season.js
- FOUND: content/index.js
- FOUND: engine/death.js
- FOUND: test/unit/run-summary.test.js
- FOUND: src/browser/engineAdapter.js
- FOUND: src/browser/storage.js
- FOUND: src/browser/settings.js
- FOUND: test/unit/engineAdapter.test.js
- FOUND: test/unit/new-run-loop.test.js
- FOUND: test/unit/bests-adapter.test.js
- FOUND commit: e366d8c (Task 1)
- FOUND commit: d6e5054 (Task 2)
- FOUND commit: 47414d1 (Task 3)
