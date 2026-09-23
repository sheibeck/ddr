---
phase: 65-run-record-personal-bests
plan: 01
subsystem: engine
tags: [game-state, save-validation, parity-harness, action-counter]

# Dependency graph
requires: []
provides:
  - "state.acts: a non-negative integer on every GameState, incremented once per validated action inside applyAction"
  - "acts whitelisted (tolerant-coerced) at both saveState.js entry points (validateSave, rehydrate)"
  - "acts carved out of all six parity comparables (3 harness + 3 test-local), so the engine gate holds with zero fixture movement"
  - "test/unit/acts-counter.test.js — the standing behavior + carve-out guard for RUN-01's action count"
  - "test/parity/FIXTURE-INVENTORY.md Phase 65 section — the measured-zero declaration"
affects: [65-04-run-summary-and-integrity-hash, 65-02, 65-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "New top-level GameState field: plain assignment in newRun, whitelisted at both saveState.js sites with the same non-negative-integer coercion, carved out of every *Comparable() function — the storeRoll/pendingHazard precedent, applied to a field 65-04 will read"

key-files:
  created:
    - test/unit/acts-counter.test.js
  modified:
    - engine/state.js
    - engine/engine.js
    - engine/saveState.js
    - test/parity/harness/comparables.js
    - test/parity/movement-parity.test.js
    - test/parity/combat-parity.test.js
    - test/parity/magic-parity.test.js
    - test/parity/FIXTURE-INVENTORY.md
    - test/unit/fight-gate.test.js
    - test/unit/dismiss-joiner.test.js

key-decisions:
  - "acts increments once per VALIDATED action (post-validateAction), whatever the handler then does — including a refused move, a refused camp, and every notFought/dismissRefused refusal — per CONTEXT D-02"
  - "Two pre-existing 'mutates nothing' unit tests (fight-gate.test.js, dismiss-joiner.test.js) were updated to expect acts+1 on a refused-but-validated action, since D-02 deliberately makes that assumption stale"

patterns-established:
  - "acts uses the exact same non-negative-integer coercion at three independent sites (the increment in applyAction, validateSave's value literal, rehydrate's state literal) so a hand-built, tampered, or pre-Phase-65 state always counts from 0"

requirements-completed: [RUN-01]

coverage:
  - id: D1
    description: "state.acts exists on every fresh GameState (default, dev start-at-depth, forced-chargen), starts at 0"
    requirement: "RUN-01"
    verification:
      - kind: unit
        ref: "test/unit/acts-counter.test.js#newRun(seed).acts === 0 for a default run, a dev start-at-depth run and a forced-chargen run alike"
        status: pass
    human_judgment: false
  - id: D2
    description: "applyAction increments acts by exactly 1 per validated action, including one the handler then refuses"
    requirement: "RUN-01"
    verification:
      - kind: unit
        ref: "test/unit/acts-counter.test.js#applyAction increments acts by exactly 1 per validated action, even when the handler refuses"
        status: pass
      - kind: unit
        ref: "test/unit/fight-gate.test.js#(f) while combat.pending, ... refuses with exactly one notFought event and mutates nothing"
        status: pass
      - kind: unit
        ref: "test/unit/dismiss-joiner.test.js#applyAction with an empty party returns dismissRefused noParty and an otherwise deepStrictEqual state"
        status: pass
    human_judgment: false
  - id: D3
    description: "An action that fails validateAction returns the SAME state object with acts unchanged"
    requirement: "RUN-01"
    verification:
      - kind: unit
        ref: "test/unit/acts-counter.test.js#an action that fails validateAction returns the SAME state object with acts unchanged"
        status: pass
    human_judgment: false
  - id: D4
    description: "acts is tolerant-coerced to 0 before the increment (absent/negative/fractional/NaN/string) and at both saveState.js whitelist sites; acts 57 round-trips unchanged"
    requirement: "RUN-01"
    verification:
      - kind: unit
        ref: "test/unit/acts-counter.test.js#acts is coerced to 0 before the increment when absent, negative, fractional, NaN or a string"
        status: pass
      - kind: unit
        ref: "test/unit/acts-counter.test.js#validateSave/rehydrate tolerant-load acts: absent, tampered and a valid round-trip"
        status: pass
      - kind: unit
        ref: "test/unit/acts-counter.test.js#acts 57 survives serializeRun -> JSON.stringify -> validateSave -> rehydrate unchanged"
        status: pass
    human_judgment: false
  - id: D5
    description: "The counter adds zero rng draws (12-action fixed-list pin) and is carved out of all six parity comparables with zero fixture movement"
    requirement: "RUN-01"
    verification:
      - kind: unit
        ref: "test/unit/acts-counter.test.js#the counter adds zero rng draws: a fixed 12-action list gives identical rngState and states (acts aside) with or without a starting acts field"
        status: pass
      - kind: unit
        ref: "test/unit/acts-counter.test.js#acts is carved out of the three harness comparables: acts 999 compares equal to acts 0"
        status: pass
      - kind: integration
        ref: "node --test test/parity/*.test.js (46 tests, 46 pass, 0 fail)"
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-09-23
status: complete
---

# Phase 65 Plan 01: state.acts Action Counter Summary

**A new `state.acts` GameState field, incremented once per validated action inside `applyAction`, whitelisted tolerantly at both save-load sites, and carved out of all six parity comparables with a measured-zero fixture footprint.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-09-23T16:14:19-04:00 (worktree base commit)
- **Completed:** 2026-09-23T16:43:55-04:00
- **Tasks:** 2
- **Files modified:** 10 (1 new, 9 modified)

## Accomplishments

- `newRun`'s fresh GameState now carries `acts: 0` (default run, dev start-at-depth run, forced-chargen run — all three verified equal to 0)
- `applyAction` increments `next.acts` by exactly 1 once `validateAction` passes, whatever the handler then does (a refused move into a wall, a refused camp with no rations, every `notFought`/`dismissRefused` refusal); an invalid action still returns the SAME state object with `acts` untouched
- `validateSave`/`rehydrate` both whitelist `acts` with the same non-negative-integer coercion, defaulting a missing or tampered value (negative, fractional, NaN, string, null) to 0; `acts: 57` round-trips `serializeRun -> JSON -> validateSave -> rehydrate` unchanged
- `acts` is carved out of all six parity comparables (`movementComparable`/`combatComparable`/`economyComparable` in `test/parity/harness/comparables.js`, plus the test-local `comparable()` in `movement-parity.test.js`/`combat-parity.test.js`/`magic-parity.test.js`) — measured before (24/46 parity tests pass, 22 fail — the leaked `acts` key) and after (46/46 pass) the carve-out landed
- `test/parity/FIXTURE-INVENTORY.md` records the Phase 65 measured-zero section with all four live-scan results (parity pass count, fixture diff, master hash, both fixture-scan tools) plus the tune-difficulty bot's byte-identical output, provable by construction since `tools/tune-difficulty.mjs` never imports `test/parity/`
- `test/unit/acts-counter.test.js` (9 tests) pins every behavior bullet plus the comparable carve-out guard

## Task Commits

Each task was committed atomically:

1. **Task 1: state.acts — the fresh-run field, the per-validated-action increment, and the tolerant save whitelist** - `109bce7` (feat)
2. **Task 2: carve acts out of all six parity comparables and declare the measured zero** - `f1d8eb2` (test)

## Files Created/Modified

- `engine/state.js` - `newRun` literal gains `acts: 0`
- `engine/engine.js` - `applyAction` increments `next.acts` right after `structuredClone`, before rng rehydration
- `engine/saveState.js` - `acts` whitelisted (tolerant-coerced) at both `validateSave`'s `value` literal and `rehydrate`'s `state` literal
- `test/parity/harness/comparables.js` - `acts` destructured out of `movementComparable`, `combatComparable`, `economyComparable`
- `test/parity/movement-parity.test.js`, `test/parity/combat-parity.test.js`, `test/parity/magic-parity.test.js` - `acts` destructured out of each file's local `comparable()`
- `test/parity/FIXTURE-INVENTORY.md` - new "Phase 65: the run record's action counter (RUN-01) — measured zero" section
- `test/unit/acts-counter.test.js` - new file, 9 tests covering every `<behavior>` bullet plus the Task 2 comparable guard
- `test/unit/fight-gate.test.js` - the eight `notFought` refusal-case tests now assert `acts` moved by exactly 1 (Rule 1 fix)
- `test/unit/dismiss-joiner.test.js` - the empty-party `dismissRefused` test now asserts `acts` moved by exactly 1 (Rule 1 fix)
- `.planning/phases/65-run-record-personal-bests/deferred-items.md` - new file, logs 7 pre-existing unrelated `npm test` failures out of scope

## Decisions Made

- `acts` counts every VALIDATED action, whatever the handler then does — per CONTEXT D-02, this is a deliberate scope-widening beyond "successful moves only," since the plan's own behavior bullets require a refused move/camp to still increment.
- Where that decision made a pre-existing "mutates nothing" unit-test assumption stale (fight-gate.test.js, dismiss-joiner.test.js), the assertions were updated to expect `acts + 1` rather than weakened or removed — the rest of each state is still asserted byte-for-byte untouched.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two pre-existing "mutates nothing" tests broken by the new acts increment**
- **Found during:** Task 2 (`npm test` full-suite verification)
- **Issue:** `test/unit/fight-gate.test.js`'s eight `(f) while combat.pending, ... refuses with exactly one notFought event and mutates nothing` tests, and `test/unit/dismiss-joiner.test.js`'s empty-party `dismissRefused` test, all asserted `assert.deepStrictEqual(next, before)` for a refused-but-VALIDATED action. Task 1's `acts` increment (deliberately, per D-02) now moves `next.acts` to `before.acts + 1` in exactly these cases, so all nine tests failed.
- **Fix:** Each assertion now separately checks `next.acts === (coerced before.acts) + 1`, then compares the rest of the state (`acts` stripped from both sides) `deepStrictEqual`, using the identical non-negative-integer coercion `validateSave` uses — consistent with this plan's own tolerant-load contract.
- **Files modified:** `test/unit/fight-gate.test.js`, `test/unit/dismiss-joiner.test.js`
- **Verification:** `node --test test/unit/fight-gate.test.js test/unit/dismiss-joiner.test.js` — 38 tests, 38 pass, 0 fail
- **Committed in:** `f1d8eb2` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1, spanning 9 individual test cases across 2 files)
**Impact on plan:** Necessary correctness fix for a deliberate, planned behavior change (D-02). No scope creep — both files stay outside `test/parity/` and move zero fixtures.

## Issues Encountered

**7 pre-existing `npm test` failures, unrelated to this plan (out of scope, logged and left untouched):**

`npm test` on this worktree reports **4198 pass, 7 fail** out of 4205 total (4197 baseline + 8 new `acts-counter.test.js` tests). The 7 failures are in `test/unit/class-pass-ledger.test.js` (4) and `test/unit/flee-ledger.test.js` (3) — both static doc-vs-fresh-render guards for `docs/CLASS-PASS.md` and `docs/FLEE.md` respectively. Evidence these are pre-existing and unrelated:
- `git diff --stat adc941e -- <every file either test file or its imports touch>` is EMPTY — this plan changed none of them.
- Neither test file's import graph (`tools/class-pass-diff.mjs`, `content/flee.js`, `content/index.js`) reaches `engine/state.js`, `engine/engine.js`, or `engine/saveState.js` — the only three engine files this plan edited.
- The failure text ("...is not a byte-identical substring of the ledger") matches this project's own documented Windows CRLF artifact (`docs/CLASS-PASS.md` is checked out with CRLF line terminators on this machine while the guard compares against a freshly LF-rendered string) — the same class of issue `test/parity/FIXTURE-INVENTORY.md`'s own Phase 61 Plan 01 section independently documents tripping two other unrelated tests on this machine, and the standing ".gitattributes eol=lf pin" deferred item in `.planning/STATE.md`.

Full detail and the failing-test table: `.planning/phases/65-run-record-personal-bests/deferred-items.md`.

**All Phase-65-scoped tests are 100% green:** `test/unit/acts-counter.test.js` (9/9), `test/parity/*.test.js` (46/46), `test/unit/fight-gate.test.js` + `test/unit/dismiss-joiner.test.js` (38/38), `test/unit/chargen-rng-pin.test.js` (unedited, 3/3 — proves `newRun`'s rngState never moved), `test/parity/fixture-inventory.test.js` (5/5).

## Human verification (deferred to end of run)

None: engine-only, no player-visible change. (Deferred-UAT protocol; the milestone batch is Phase 69's docs/UAT-v2.0.md.)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `state.acts` is ready for Plan 04's `buildRunSummary` to read into the run summary and its integrity hash.
- The engine gate holds: zero fixture edits, master hash unchanged (`a1f4d0dc29782218d8e5aab65bc5989c33f917f0`), both fixture-scan tools clean, tune-difficulty bot output byte-identical before/after.
- Blocker/concern for the orchestrator: the 7 pre-existing, unrelated `npm test` failures (see Issues Encountered) mean this plan cannot report a literal "0 failures" full-suite result, though every test this plan is accountable for is green. Recommend a separate quick task to regenerate `docs/CLASS-PASS.md`/`docs/FLEE.md` with LF line endings (or apply the standing `.gitattributes eol=lf pin`) if a fully green baseline is needed before the next phase.

---
*Phase: 65-run-record-personal-bests*
*Completed: 2026-09-23*

## Self-Check: PASSED

All 13 claimed files verified present on disk; both task commit hashes (`109bce7`, `f1d8eb2`) verified present in `git log`.
