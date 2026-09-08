---
phase: 03-endless-descent-difficulty-balance
plan: 01
subsystem: engine
tags: [difficulty-curve, soft-cap, endless-descent, tuning-harness, node-test]

# Dependency graph
requires:
  - phase: 01-engine-extraction-determinism
    provides: "engine/engine.js (applyAction/newRun), engine/rng.js (makeRng), engine/combat.js (canParley), engine/maze.js (genFloor's current 9+depth/depth-1/3+depth formulas this module bounds but does not yet replace), engine/derived.js (the pure-module style this follows), test/unit/maze.test.js (test conventions)"
provides:
  - "engine/difficulty.js: difficultyCurve(depth) + isBreather(depth) + seven named constants (BREATHER_EVERY, ENCOUNTER_DOT_BASE/CAP/SOFT_K, DARK_BLOB_CAP, DARK_RADIUS_BASE/CAP) — a pure, RNG-free, DOM-free bounded soft-cap curve reproducing the prototype's exact 9+depth/depth-1/3+depth values for depths 1-5"
  - "test/difficulty/difficulty.test.js: 8 property tests (cap enforcement to depth 10000, floors-1-5 parity-preservation guard, breather cadence, monotonic-but-bounded growth, NaN/Infinity robustness)"
  - "tools/tune-difficulty.mjs: dev-only, zero-dependency headless auto-play tuning harness (death-depth/action-count distribution + death-cause breakdown), driven entirely through the public applyAction/newRun engine surface"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "engine/difficulty.js follows engine/derived.js's established shape: small exported pure functions of explicit args, no classes, no module-level mutable state, no rng, no DOM. A module-local (unexported) safeDepth() guard clamps NaN/Infinity/non-integer/non-positive depth to a finite positive integer BEFORE any arithmetic runs, so a corrupted save-derived floor.depth (T-03-01) can never poison output with NaN."
    - "The asymptotic soft-cap formula round(base + (cap-base)*(1-exp(-depth/k))) was verified mathematically AND by test to reproduce the prototype's original linear 9+depth formula exactly for depths 1-5 (the 'already-tuned floors'), which is what lets Plan 02 rewire genFloor to consume this module without breaking Phase 1's parity/round-trip/determinism suites."
    - "tools/tune-difficulty.mjs treats the engine as a black box (imports only applyAction/newRun/makeRng from engine.js/rng.js, plus canParley from combat.js for its parley-decision branch — never reaches into maze/movement internals). Its BFS-toward-nearest-unseen-tile exploration policy mirrors movement.js's move() one-way-door approach/departure guard exactly (via a local canStep() helper), which was required to prevent the harness from stalling its entire MAX_ACTIONS budget recommending a direction that silently no-ops."
    - "A harness-local policyRng = makeRng(seed ^ 0x9e3779b9) is a SEPARATE PRNG stream from the engine's own rngState, so the auto-play policy's own dice-rolling (which fallback direction to wander) can never perturb the engine's seeded determinism."

key-files:
  created:
    - engine/difficulty.js
    - test/difficulty/difficulty.test.js
    - tools/tune-difficulty.mjs
    - .planning/phases/03-endless-descent-difficulty-balance/deferred-items.md
  modified: []

key-decisions:
  - "darkRadius is NOT forced to zero on a breather floor (only darkBlobs and dots are overridden per the plan's literal action text) — since darkBlobs is already 0 on a breather, there is no blob to apply a nonzero radius to, so this is a behaviorally-inert simplification, not a fairness gap."
  - "tune-difficulty.mjs's combat policy uses the engine's real exported canParley(state) (engine/combat.js) rather than re-deriving the parley-eligibility rules locally — avoids duplicating race/sub/skill/encounter-type logic that could drift out of sync with the real rules."
  - "The harness's explore policy respects one-way-door directionality (a local canStep() helper mirroring move()'s approach/departure guard) rather than treating every non-wall neighbor as traversable — without this, a naive BFS would recommend the exact same blocked direction forever once it targeted an unseen tile behind a door approached from the wrong side, burning the full 20000-action safety budget on a stall instead of exploring (found and fixed during Task 2's own verification run)."
  - "Logged a pre-existing, unrelated `npm run test:quick` failure (Windows/Node v22.23.2 cannot resolve directory positional args passed to `node --test`) to deferred-items.md rather than fixing it — out of scope per the scope-boundary rule since it touches package.json, which no file in this plan modifies. Confirmed unrelated: bare `node --test` (default discovery, which the plan's own verification block uses) runs the full suite cleanly at 293/293."

patterns-established:
  - "Any future engine module needing a depth (or similarly save-derived numeric) input should follow difficulty.js's safeDepth() pattern: floor + Number.isFinite guard BEFORE Math.max, not Math.max(1, Math.floor(x)) alone — the latter still lets NaN propagate silently through Math.max(1, NaN) === NaN."

requirements-completed: [RUN-03]

coverage:
  - id: D1
    description: "difficultyCurve(depth) returns bounded encounter-dot count, dark-blob count, and dark-blob radius that never exceed their documented caps at any sampled depth 1..10000"
    requirement: "RUN-03"
    verification:
      - kind: unit
        ref: "test/difficulty/difficulty.test.js#difficultyCurve never exceeds its documented caps at any sampled depth (1..10000)"
        status: pass
  - id: D2
    description: "The bounded curve reproduces the prototype's exact 9+depth/depth-1/3+depth formula for depths 1-5 (parity-preservation guard) — the load-bearing property that keeps Plan 02's floors-1-5 parity/round-trip/determinism suites green once genFloor is rewired to consume this module"
    requirement: "RUN-03"
    verification:
      - kind: unit
        ref: "test/difficulty/difficulty.test.js#PARITY GUARD: depths 1-5 reproduce the prototype's exact 9+depth/depth-1/3+depth formula"
        status: pass
  - id: D3
    description: "Every BREATHER_EVERY-th floor is a breather with zero dark blobs and the baseline encounter-dot count"
    requirement: "RUN-03"
    verification:
      - kind: unit
        ref: "test/difficulty/difficulty.test.js#isBreather is true exactly for depths 6, 11, 16, 21 (BREATHER_EVERY cadence)"
        status: pass
      - kind: unit
        ref: "test/difficulty/difficulty.test.js#breather floors zero darkBlobs and floor the dot count to the baseline"
        status: pass
  - id: D4
    description: "difficultyCurve tolerates a non-integer or non-positive depth without producing NaN-poisoned output"
    requirement: "RUN-03"
    verification:
      - kind: unit
        ref: "test/difficulty/difficulty.test.js#difficultyCurve tolerates a non-integer or non-positive depth without NaN/Infinity output"
        status: pass
  - id: D5
    description: "A dev-only headless tuning harness auto-plays many seeded runs and prints a death-depth/action-count distribution"
    requirement: "RUN-03"
    verification:
      - kind: manual
        ref: "node tools/tune-difficulty.mjs --seeds=25 — exits 0, prints death-depth/action-count distributions and a death-cause breakdown, no throw"
        status: pass
  - id: D6
    description: "difficultyCurve consumes no RNG and cannot perturb the seeded engine RNG cursor; full test suite remains green (this plan only adds files)"
    requirement: "RUN-03"
    verification:
      - kind: unit
        ref: "test/difficulty/difficulty.test.js#difficultyCurve consumes no rng (pure function of depth only — signature check)"
        status: pass
      - kind: integration
        ref: "full `node --test`: 293/293 passing (285 prior + 8 new), tools/tune-difficulty.mjs correctly excluded from discovery"
        status: pass

duration: ~50min
completed: 2026-09-08
status: complete
---

# Phase 3 Plan 1: Bounded Difficulty-Curve Module Summary

**A pure `engine/difficulty.js` exports `difficultyCurve(depth)` (asymptotic soft-cap, independently-capped dot/darkness knobs, BREATHER_EVERY cadence) that reproduces the prototype's original 9+depth/depth-1/3+depth formulas exactly for depths 1-5, backed by 8 property tests and a dev-only `tools/tune-difficulty.mjs` headless auto-play harness — no consumer wiring yet, that's Plan 02.**

## Performance

- **Duration:** ~50 min across two TDD commits + one feature commit + one docs commit
- **Tasks:** 2 completed (Task 1 was `tdd="true"`: RED test commit, then GREEN implementation commit)
- **Files modified:** 4 created, 0 modified

## Accomplishments

- Created `engine/difficulty.js`: a pure, RNG-free, DOM-free module exporting `difficultyCurve(depth)` plus seven named, documented tunable constants (`BREATHER_EVERY=5`, `ENCOUNTER_DOT_BASE=9`, `ENCOUNTER_DOT_CAP=24`, `ENCOUNTER_DOT_SOFT_K=12`, `DARK_BLOB_CAP=6`, `DARK_RADIUS_BASE=3`, `DARK_RADIUS_CAP=9`) and `isBreather(depth)`. The dot-count curve uses an asymptotic soft-cap (`round(base + (cap-base)*(1-exp(-depth/k)))`) verified — both mathematically and by test — to reproduce the prototype's exact linear `9+depth` for depths 1-5, the load-bearing parity-preservation property Plan 02 depends on.
- A module-local `safeDepth()` guard clamps any non-integer/non-positive/NaN/Infinity depth input to a finite positive integer before any arithmetic runs (T-03-01 mitigation from the plan's threat model), so a corrupted save-derived `floor.depth` can never poison output with NaN.
- Wrote `test/difficulty/difficulty.test.js` FIRST (TDD RED), then the module (GREEN): 8 tests covering constant values, cap enforcement at depths [1,5,6,10,20,50,100,200,1000,10000], the floors-1-5 parity guard, breather cadence (depths 6/11/16/21 true, 1/2/3/4/5/7/10 false), monotonic-but-bounded growth across non-breather depths 1-200, NaN/Infinity robustness for depths [0,-3,1.5], and a signature check confirming `difficultyCurve` takes exactly one argument (no RNG parameter).
- Created `tools/tune-difficulty.mjs`: a zero-runtime-dependency Node ESM script that plays N seeded runs to completion (death, `state.won`, or a 20000-action safety stop) via a documented, deterministic heuristic policy — attack in combat unless WP drops below ~30% (then parley via the real `canParley()` gate, else flee), leave any store immediately, otherwise BFS-explore toward the nearest unseen tile. Prints a death-depth distribution (min/p50/p90/max), a death-cause breakdown, and an action-count distribution; supports `--seeds=N` (default 200) and `--json`. Not a `node:test` file — makes no assertions, confirmed excluded from `node --test` discovery.
- Fixed a real stall bug found during Task 2's own verification: the harness's BFS exploration initially ignored one-way-door directionality, so it could recommend approaching a door from the wrong side forever (movement.js's `move()` silently no-ops on a blocked approach/departure, so position never changes and BFS keeps recommending the same blocked step) — burning the entire 20000-action budget on one seed. Fixed with a `canStep()` helper mirroring `move()`'s exact door guard, used by both the BFS and the fallback `legalDirs()`.

## Task Commits

1. **Task 1 (RED): failing property tests for difficultyCurve(depth)** — `5d9ace0` (test)
2. **Task 1 (GREEN): implement difficultyCurve(depth) bounded soft-cap module** — `581d23d` (feat)
3. **Task 2: dev-only headless tuning harness** — `e646de4` (feat)
4. **Deferred-items log (out-of-scope discovery)** — `e0745be` (docs)

## Files Created/Modified

- `engine/difficulty.js` — `difficultyCurve(depth)`, `isBreather(depth)`, seven named constants
- `test/difficulty/difficulty.test.js` — 8 property tests
- `tools/tune-difficulty.mjs` — dev-only headless tuning harness
- `.planning/phases/03-endless-descent-difficulty-balance/deferred-items.md` — logs a pre-existing, unrelated `npm run test:quick` Windows path bug found during verification

## Decisions Made

- `darkRadius` is not forced to zero on a breather floor (only `darkBlobs` and `dots` are overridden, matching the plan's literal action text) — behaviorally inert since `darkBlobs===0` means no blob ever applies that radius.
- The harness imports and reuses `engine/combat.js`'s real `canParley(state)` rather than re-deriving parley eligibility, avoiding a second, driftable copy of that rule.
- The harness's explore policy respects one-way-door approach/departure constraints (mirroring `move()`'s own guard) rather than naive wall-only pathfinding — required to prevent an infinite-stall-shaped bug, not merely a nice-to-have.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Tuning-harness BFS could stall its entire action budget on a one-way-door approach**
- **Found during:** Task 2, running the plan's own verification command (`node tools/tune-difficulty.mjs --seeds=25`), which took ~60s with one seed visibly consuming the full `MAX_ACTIONS=20000` budget.
- **Issue:** The initial `nearestUnseenDir()`/`legalDirs()` implementation only checked `!cell.wall`, ignoring `engine/movement.js`'s `move()` one-way-door approach/departure guard (`there.feat==="one" && there.dir!==dir`, `here.feat==="one" && here.dir!==dir`). If the BFS targeted an unseen tile reachable only by approaching a door from its blocked side, `move()` would silently no-op every call — position never changes, so the exact same blocked direction gets recommended forever.
- **Fix:** Added a `canStep(f, x, y, dir)` helper mirroring `move()`'s guard exactly; both `nearestUnseenDir()`'s BFS and `legalDirs()`'s fallback now use it, so a blocked direction is never recommended.
- **Files modified:** `tools/tune-difficulty.mjs`
- **Verification:** `node tools/tune-difficulty.mjs --seeds=25` now completes in ~1s for the fast majority of seeds (one seed still legitimately hits `MAX_ACTIONS` via the fallback random-walk once a floor is fully seen but the exit tile hasn't been stepped on — expected behavior of a simple heuristic policy, documented as such, not a bug).
- **Committed in:** `e646de4` (fixed before commit, not as a separate follow-up commit — caught during the task's own verification loop before the GREEN state was committed)

---

**Total deviations:** 1 (Rule 1 — a real stall bug in the harness's own pathfinding, found and fixed during the task's own verify step before commit)
**Impact on plan:** No scope change. The fix is entirely internal to `tools/tune-difficulty.mjs`, a file already in this plan's `files_modified` list.

## Known Stubs

None. Both new modules are fully functional as specified — `engine/difficulty.js` has no consumer yet (by design; that's Plan 02), and `tools/tune-difficulty.mjs` is complete and runnable as a standalone dev tool.

## Issues Encountered

- `npm run test:quick` (`node --test test/unit test/determinism test/roundtrip`) fails on this Windows/Node v22.23.2 environment with `MODULE_NOT_FOUND` when passed directory paths as positional args — confirmed pre-existing and unrelated to any file this plan touches (bare `node --test`, which is what the plan's own `<verification>` block specifies, runs cleanly at 293/293). Logged to `deferred-items.md` per the scope-boundary rule rather than fixed, since the fix would touch `package.json`, outside this plan's `files_modified`.

## User Setup Required

None — no external service configuration required. `tools/tune-difficulty.mjs` runs via `node tools/tune-difficulty.mjs` with no installation step (zero runtime dependencies, per `.claude/CLAUDE.md`).

## Next Phase Readiness

- `engine/difficulty.js` is ready for Plan 02 to consume: `genFloor` can replace its inline `nDots = 9 + depth`, `blobs = depth - 1`, and per-blob radius `3 + depth` formulas with `difficultyCurve(depth).dots`/`.darkBlobs`/`.darkRadius`, and the parity-preservation guard test proves this substitution is a no-op for floors 1-5 (Phase 1's existing parity/round-trip/determinism suites should stay green).
- `tools/tune-difficulty.mjs` is ready to use once Plan 02 lands endless descent — today every run still terminates almost immediately at the legacy floor-5 Gate (`state.won`), so the death-depth distribution isn't yet a meaningful signal (documented explicitly in the harness's own header comment and printed as a runtime NOTE whenever any seed wins).
- Carried-forward note (informational, not a defect): the harness's simple random-walk fallback (once a floor is fully "seen" but the exit tile specifically hasn't been stepped on) can occasionally consume the full `MAX_ACTIONS` budget on one seed out of many — acceptable for a documented tuning proxy, not something Plan 02/03 needs to fix.

---
*Phase: 03-endless-descent-difficulty-balance*
*Completed: 2026-09-08*

## Self-Check: PASSED

All 4 created files (`engine/difficulty.js`, `test/difficulty/difficulty.test.js`, `tools/tune-difficulty.mjs`, `.planning/phases/03-endless-descent-difficulty-balance/deferred-items.md`) plus this SUMMARY found on disk; all four commit hashes (`5d9ace0`, `581d23d`, `e646de4`, `e0745be`) found in git log. `node --test test/difficulty/difficulty.test.js`: 8/8 passing. `node tools/tune-difficulty.mjs --seeds=25`: exits 0, prints clean distributions. Full `node --test`: 293/293 passing (285 prior + 8 new).
