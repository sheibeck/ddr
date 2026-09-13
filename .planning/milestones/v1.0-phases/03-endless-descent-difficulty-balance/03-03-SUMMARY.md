---
phase: 03-endless-descent-difficulty-balance
plan: 03
subsystem: engine-adapter
tags: [run-loop, permadeath, best-depth, engineAdapter, localStorage, node-test]
status: complete

# Dependency graph
requires:
  - phase: 03-endless-descent-difficulty-balance
    plan: 02
    provides: "engine/maze.js genFloor consumes difficultyCurve with endless descent (no Gate, always 'exit'); engine/movement.js permadeath (die()) as the sole run terminator, winGame() retired"
provides:
  - "src/browser/engineAdapter.js: BEST_KEY/getBest()/recordBest(depth)/startNewRun(seed) — one-tap new-run entry point that records the ending run's floor.depth as best-depth (localStorage dev-loop stand-in), then calls initRun with a guarded integer seed"
  - "mazeworld.html: window.newGame overwritten in the module script to route the death-card 'Roll another delver' button through engineAdapter.startNewRun(), mirroring the existing window.move override — closes the run loop in the dev harness"
  - "test/unit/newrun.test.js: RUN-01 — newRun(seed) is a single-argument, choice-free entry point producing a valid dice-rolled level-1 character on a revealed floor 1, deterministic per seed"
  - "test/unit/permadeath.test.js: RUN-04 — die() is the sole terminator; a dead run stays dead (move()/applyAction()/unknown action types are all no-ops on state.dead)"
  - "test/unit/new-run-loop.test.js: RUN-05 — a single engineAdapter.startNewRun() call from a dead run yields a fresh, valid run and records the ended run's deepest floor as the best-depth"
affects:
  - "Phase 2 (SAV-04): mazeworld.best.v1 is the documented seam to relocate to durable @capacitor/preferences storage"
  - "Phase 4: the polished mobile death screen / score display consumes engineAdapter.getBest() and the same window.newGame wiring this plan establishes"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Adapter-side dev-loop persistence seam: a value that belongs in durable storage but not in GameState (best-depth) gets its OWN localStorage key (BEST_KEY, separate from SAVE_KEY) with a fail-open-to-0/never-throw contract identical to boot()/persist() — keeps GameState's save round-trip/parity comparables untouched while still giving the later native-storage phase a minimal, documented seam to swap."
    - "Classic-script global override for adapter routing: `function newGame(){...}` in mazeworld.html's classic <script> creates a mutable `window.newGame` property; the death-card's bare `newGame()` onclick call resolves that property at click time, so overwriting `window.newGame` in the module script reroutes an EXISTING DOM affordance through the engine adapter with zero changes to markup or adapter-internal DOM code — same pattern window.move already established for the dpad."

key-files:
  created:
    - test/unit/newrun.test.js
    - test/unit/permadeath.test.js
    - test/unit/new-run-loop.test.js
  modified:
    - src/browser/engineAdapter.js
    - mazeworld.html
    - test/unit/engineAdapter.test.js

key-decisions:
  - "Best-depth stays adapter-side in localStorage (mazeworld.best.v1), never folded into GameState, per 03-CONTEXT.md's locked decision — this preserves the save round-trip/parity comparables the difficulty-balance work depends on."
  - "startNewRun(seed) is optional; omitting it falls back to Date.now(), matching the death-card button's zero-argument onclick call while still allowing tests to pass an explicit seed for determinism."

patterns-established:
  - "Any future adapter-only dev-loop persistence value (not part of GameState) should follow the BEST_KEY pattern: its own localStorage key, a getter that never throws and fails open to a safe default, and an internal writer guarded the same way persist() already is."

requirements-completed: [RUN-01, RUN-04, RUN-05]

coverage:
  - id: D1
    description: "engineAdapter.startNewRun(seed) is the one-tap new-run entry point: records the ending run's best-depth, then starts a fresh dice-rolled run from a guarded seed"
    requirement: "RUN-05"
    verification:
      - kind: unit
        ref: "test/unit/engineAdapter.test.js#startNewRun(seed) after a prior run returns a fresh state and swaps it in as currentState"
        status: pass
      - kind: unit
        ref: "test/unit/engineAdapter.test.js#startNewRun(seed) records the ending run's floor.depth into getBest()"
        status: pass
      - kind: unit
        ref: "test/unit/engineAdapter.test.js#startNewRun(seed) keeps the higher of two recorded bests"
        status: pass
      - kind: unit
        ref: "test/unit/new-run-loop.test.js#startNewRun() from a dead run yields a fresh, valid, dice-rolled run in a single call"
        status: pass
    human_judgment: false
  - id: D2
    description: "getBest() persists best-depth across runs in the dev loop and never throws (fails open to 0)"
    requirement: "RUN-05"
    verification:
      - kind: unit
        ref: "test/unit/engineAdapter.test.js#getBest() returns 0 when nothing is stored and never throws when storage is blocked"
        status: pass
      - kind: unit
        ref: "test/unit/new-run-loop.test.js#startNewRun() records the ended run's deepest floor as the best-depth"
        status: pass
    human_judgment: false
  - id: D3
    description: "mazeworld.html's existing death-card 'Roll another delver' button routes through the engine adapter via a window.newGame override, closing the one-tap run loop in the dev harness"
    verification: []
    human_judgment: true
    rationale: "DOM button-click wiring requires a browser to exercise; unit tests cover the adapter call it now routes through (startNewRun), but the click-through itself is manual UAT (deferred per plan's own <verification> Manual note — open mazeworld.html, die, tap 'Roll another delver')."
  - id: D4
    description: "newRun(seed) produces a 100%-dice-rolled, choice-free character at level 1 on a revealed floor 1, deterministic per seed"
    requirement: "RUN-01"
    verification:
      - kind: unit
        ref: "test/unit/newrun.test.js (6 tests: arity, valid character, fresh floor 1, spawn-area reveal, seed-driven variance, seed-driven determinism)"
        status: pass
    human_judgment: false
  - id: D5
    description: "die() is the sole run terminator; death is permanent with no revive/undo/continue path anywhere in the engine"
    requirement: "RUN-04"
    verification:
      - kind: unit
        ref: "test/unit/permadeath.test.js (5 tests: state.dead set, died event pushed with won staying false, move() no-op on dead state, applyAction(move) no-op through the full dispatcher, no revive/undo/continue action type can flip state.dead)"
        status: pass
    human_judgment: false

metrics:
  duration_min: 20
  completed: 2026-09-08
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 3

status: complete
---

# Phase 03 Plan 03: Close the One-Tap New-Run Loop + Best-Depth Tracking Summary

Added `engineAdapter.startNewRun(seed)`/`getBest()` so a single adapter call from a dead run
records the ended run's deepest floor as a localStorage-backed best-depth and starts a fresh
dice-rolled run, wired `mazeworld.html`'s existing death-card "Roll another delver" button
through it via a `window.newGame` override (mirroring the existing `window.move` override), and
added RUN-01/04/05 coverage proving dice-rolled chargen, permadeath as the sole terminator, and
the one-tap loop itself — closing out the phase with the full suite at 317/317 green.

## Tasks Completed

1. **Task 1: Adapter one-tap new-run + best-depth tracking; wire mazeworld.html death card** — `de7afe8` (feat)
2. **Task 2: RUN-01/04/05 coverage tests — dice-rolled chargen, permadeath, one-tap loop** — `ae5979d` (test)

## Files Created/Modified

- `src/browser/engineAdapter.js` — added `BEST_KEY` ("mazeworld.best.v1"), `getBest()` (fail-open to 0, never throws), module-internal `recordBest(depth)` (writes `max(stored, depth)`), and `startNewRun(seed)` (records the ending run's `floor.depth` as best-depth if a run is live, then calls `initRun` with a guarded integer seed, defaulting to `Date.now()`)
- `mazeworld.html` — the existing `<script type="module">` now also imports `startNewRun` and overwrites `window.newGame`, so the death-card's `btn-again` onclick (which calls the bare `newGame()` identifier) routes through the engine adapter, sets `window.__mzState`, and repaints — no change to the death-card markup or to any DOM code inside `engineAdapter.js`
- `test/unit/engineAdapter.test.js` — added 4 tests: fresh-state swap on `startNewRun`, best-depth recording, keeping the higher of two recorded bests, and `getBest()`'s fail-open-to-0 posture on blocked storage
- `test/unit/newrun.test.js` (new) — RUN-01: 6 tests proving `newRun(seed)`'s single-argument arity, a valid dice-rolled level-1 character, a fresh floor 1, spawn-area reveal, seed-driven variance across seeds, and seed-driven determinism for the same seed
- `test/unit/permadeath.test.js` (new) — RUN-04: 5 tests proving `die()` sets `state.dead`, pushes a `died` event without ever touching `state.won`, and that death is permanent — `move()`, `applyAction()`, and any unrecognized action type (`revive`/`undo`/`continue`/`resurrect`) are all no-ops on a dead state
- `test/unit/new-run-loop.test.js` (new) — RUN-05: 3 tests proving a single `startNewRun()` call from a dead run yields a fresh valid run, records the ended run's deepest floor as the best-depth, and honors an explicit seed when given

## Decisions Made

- Best-depth lives ONLY in adapter-side localStorage (`mazeworld.best.v1`), never in `GameState`, per 03-CONTEXT.md's locked decision — keeps the save round-trip/parity comparables this phase's difficulty work depends on unchanged.
- `startNewRun(seed)` treats `seed` as optional (falls back to `Date.now()` via an `Number.isInteger` guard) so the death-card button's zero-argument call and a test's explicit-seed call both work through the same entry point.

## Deviations from Plan

None — plan executed exactly as written. Both tasks matched their `<action>`/`<done>` sections; no Rule 1-4 auto-fixes were needed.

## Known Stubs

None. `startNewRun`/`getBest` are fully functional; the `window.newGame` override wires an existing, fully-functional death-card button.

## Threat Flags

None. The plan's `<threat_model>` (T-03-05 seed guard, T-03-06 self-tamper accept) is exactly what was implemented — `startNewRun`'s `Number.isInteger(seed)` guard is the only new input-crossing surface, and no new network/auth/file-access surface was introduced.

## Issues Encountered

None.

## User Setup Required

None — zero runtime dependencies, `node --test` only, no external service configuration.

## Next Phase Readiness

- RUN-01 (dice-rolled chargen), RUN-04 (permadeath as sole terminator), and RUN-05 (one-tap new-run loop) are all complete and test-proven at the engine/adapter level.
- The death-card button's actual click-through is manual UAT (deferred, per the plan's own `<verification>` note): open `mazeworld.html`, die, tap "Roll another delver", confirm a fresh dice-rolled run starts. This is the one item in this plan's coverage marked `human_judgment: true` (D3).
- `mazeworld.best.v1` is documented as the seam Phase 2 (SAV-04) relocates to durable `@capacitor/preferences` storage.
- Full `node --test` suite: 317/317 passing (299 baseline from 03-02 + 4 new engineAdapter tests + 14 new RUN-01/04/05 tests = 317; matches `node --test`'s own reported total exactly).
- This closes out Phase 03 (endless-descent-difficulty-balance) — all three plans (01 bounded difficulty curve, 02 genFloor rewire + Gate retirement, 03 the run loop + coverage) are complete.

---
*Phase: 03-endless-descent-difficulty-balance*
*Completed: 2026-09-08*

## Self-Check: PASSED

Both new task-level files confirmed on disk (`test/unit/newrun.test.js`, `test/unit/permadeath.test.js`, `test/unit/new-run-loop.test.js`), plus `src/browser/engineAdapter.js` and `mazeworld.html` modifications confirmed via `git diff --stat`. Both task commit hashes (`de7afe8`, `ae5979d`) found in `git log --oneline`. Full `node --test`: 317/317 passing.
