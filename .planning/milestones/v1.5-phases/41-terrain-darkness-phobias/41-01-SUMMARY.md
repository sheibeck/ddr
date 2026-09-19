---
phase: 41-terrain-darkness-phobias
plan: 01
subsystem: engine
tags: [terrain, water, floor-generation, derived-rng, parity-carve-out, tolerant-load]

# Dependency graph
requires:
  - phase: 40-spell-rework plan 04
    provides: "the spellSeen structural carve-out precedent (stripSpellSeen at six sites) this plan's stripWaterField mirrors exactly, plus the clearStaleSpellSeen/migrateSpellNames tolerant-load chain sanitizeWaterCells slots into"
  - phase: 38-melee-active-abilities plan 01
    provides: "derivedRng(...parts) (engine/rng.js) — the keyed rng stream this plan's placeWater reuses for water placement"
provides:
  - "engine/maze.js#placeWater(g, depth, rng) — exported, derived-stream water pool placement, called LAST in genFloor"
  - "engine/difficulty.js: WATER_POOL_MIN/CAP/GROWTH_EVERY/SIZE_MIN/SIZE_MAX + difficultyCurve(depth).waterPools"
  - "engine/saveState.js#sanitizeWaterCells(floor) — tolerant load, wired into validateSave and rehydrate"
  - "test/parity/harness/comparables.js#stripWaterField(floor) — structural carve-out, wired into all three exported comparables + the three local duplicates"
  - "tools/terrain-fixture-scan.mjs — the live fixture-roster water-hit scan (measured WATER HITS: 0)"
  - "test/unit/floor-gen-rng-pin.test.js — the pre-Phase-41 draw-count/rng-state pin"
  - "test/unit/terrain.test.js — 7 tests covering placement, eligibility, contiguity, determinism, the curve table, draw order, and the main-rng zero-draw proof"
  - "docs/TERRAIN.md — the Phase 41 ledger (Plan 01 sections filled; Plan 02/03/04 placeholders)"
affects: [41-02-water-cost, 41-03-phobia-regions, 41-04-darkness-shell-close]

tech-stack:
  added: []
  patterns:
    - "Derived-stream, post-generation content placement (Phase 38/39/40 precedent) reused verbatim: placeWater reads derivedRng(rng.getState(), \"terrain\", dc.depth) AFTER every existing genFloor draw, so the main seeded cursor never moves — proven by a pin test committed BEFORE the engine edit, not assumed after."
    - "Structural parity carve-out for a brand-new, orthogonal field (the spellSeen precedent): stripWaterField wired at the SAME six sites stripSpellSeen already occupies, since cell.water has no prototype-side equivalent and is compared nowhere."
    - "Live fixture-roster measurement over assumption (research Pitfall 1): a dedicated scan tool actually replays the movement fixture's 101 scripted moves through the real engine rather than trusting the eligibility rules alone to keep every fixture's path dry."

key-files:
  created:
    - test/unit/floor-gen-rng-pin.test.js
    - test/unit/terrain.test.js
    - tools/terrain-fixture-scan.mjs
    - docs/TERRAIN.md
  modified:
    - engine/maze.js
    - engine/difficulty.js
    - engine/saveState.js
    - test/parity/harness/comparables.js
    - test/parity/movement-parity.test.js
    - test/parity/combat-parity.test.js
    - test/parity/magic-parity.test.js
    - test/unit/save-validation.test.js
    - test/parity/FIXTURE-INVENTORY.md

key-decisions:
  - "Greenfield ruling applied literally (CONTEXT.md, 2026-09-17): water is placed for every run via a derived rng stream — no state.terrainRoll run flag, no dual path, the bot and every fixture play the new rules."
  - "waterPools mirrors the codebase's REAL breather cadence (BREATHER_EVERY=5, first breather at depth 6, per engine/difficulty.js#isBreather), not the plan's own literal acceptance-criteria table, which assumed breathers at depth 5/10/15/20 — see Deviations."
  - "The live fixture scan measured WATER HITS: 0 — no scripted fixture action ever lands on a water cell, so this plan declares zero action-path divergences; Plan 02 (the move cost) inherits a clean slate."

requirements-completed: []

coverage:
  - id: D1
    description: "Every freshly generated floor at every depth carries at least one contiguous multi-square water pool, drawn from a derived rng stream that consumes zero main-rng draws"
    requirement: "TERR-01"
    verification:
      - kind: unit
        ref: "test/unit/floor-gen-rng-pin.test.js (98-entry draw-count/cursor pin, unchanged since Task 1); test/unit/terrain.test.js (placement/eligibility/contiguity/determinism/draw-order tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "cell.water is a structural harness carve-out across all three exported comparables plus the three local duplicates; zero fixture moves this plan (measured, not assumed, via the live scan)"
    requirement: "TERR-01"
    verification:
      - kind: unit
        ref: "node --test test/parity/*.test.js (37/37 green); tools/terrain-fixture-scan.mjs (WATER HITS: 0); git status --porcelain test/parity/fixtures (empty)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Old saves tolerant-load a waterless floor with no card; a tampered non-boolean water value is dropped on load"
    requirement: "TERR-01"
    verification:
      - kind: unit
        ref: "test/unit/save-validation.test.js (3 new sanitizeWaterCells tests: no-injection round-trip, tampered-value drop, genuine-value survival)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Water painted on the map (blue, with a distinct fogged/remembered shade) — visually confirmable on a Pixel 7"
    verification: []
    human_judgment: true
    rationale: "Map paint is Plan 04's scope (MAP_PALETTE.water lives in src/browser/mapMarks.js, not touched by this plan); deferred to the end-of-run Pixel 7 UAT batch per the standing defer-uat-to-end instruction."

duration: 18min
completed: 2026-09-18
status: complete
---

# Phase 41 Plan 01: Water Pools on a Derived RNG Stream Summary

**`placeWater(g, depth, rng)` places 1-3 contiguous water pools (size 3-8) on every floor via `derivedRng(rng.getState(), "terrain", dc.depth)`, drawing zero main-rng values — proven by a pre-engine-edit pin, structurally carved out of parity, tolerant-loaded on old saves, and measured (WATER HITS: 0) against the live fixture roster.**

## Performance

- **Duration:** ~18 min
- **Tasks:** 3
- **Files modified:** 13 (4 new, 9 modified)

## Accomplishments

- `test/unit/floor-gen-rng-pin.test.js` — committed FIRST, before any engine edit: a 98-entry `(seed, depth)` table pinning `genFloor`'s exact main-rng draw count and post-generation cursor for 14 seeds x 7 depths, a redundant `newRun(seed).rngState` pin (10 of its 14 seeds match `test/unit/chargen-rng-pin.test.js`'s own `NEW_RUN_PINS` exactly, confirming the measurement), and a purity proof for `derivedRng(cursor, "terrain", depth)`. Stayed green, byte-for-byte unchanged, through every subsequent engine edit — the phase's mechanical proof that water draws zero main-rng values.
- `engine/difficulty.js` gains five depth-curve constants (`WATER_POOL_MIN=1`, `WATER_POOL_CAP=3`, `WATER_POOL_GROWTH_EVERY=4`, `WATER_POOL_SIZE_MIN=3`, `WATER_POOL_SIZE_MAX=8`) and a `waterPools` field on `difficultyCurve(depth)`, mirroring the existing `darkBlobs`/`darkRadius` breather-aware pattern exactly (consumes zero rng).
- `engine/maze.js#placeWater(g, depth, rng)` (exported): per pool, picks a seed cell from the eligible list (open, unfeatured, `dist > 4` from spawn, not exit-adjacent, not already water), draws a target size, then grows via a discovery-order-deduplicated frontier of eligible orthogonal neighbours until the target is reached or the frontier is exhausted. `genFloor` calls it LAST, after every existing draw, via `placeWater(g, dc.depth, derivedRng(rng.getState(), "terrain", dc.depth))`.
- `engine/saveState.js#sanitizeWaterCells(floor)` — tolerant load mirroring `clearStaleTimers`/`clearStaleSpellSeen`'s exact discipline: drops a present-but-non-`true` `water` value, never injects the key. Wired into both `validateSave` and `rehydrate`.
- `test/parity/harness/comparables.js#stripWaterField(floor)` — a structural carve-out (the `stripSpellSeen` precedent), wired into all three exported `*Comparable()` functions plus the three per-domain local `comparable()` duplicates (movement/combat/magic-parity.test.js).
- `test/unit/terrain.test.js` (7 tests): placement bounds across depths 1-30, eligibility-rule compliance, pool contiguity (BFS over each pool's own cells), determinism, the `waterPools` curve table (measured against the live `isBreather()`, not hand-assumed), the exact seed/size/growth draw order (proven against a hand-built corridor grid with a scripted rng), and a main-rng-untouched proof against three pinned `(seed, depth)` keys.
- `docs/TERRAIN.md` — the Phase 41 ledger skeleton: canon change, the pool curve (constants, eligibility rules, draw order), declared divergences (zero fixture moves, the measured scan summary), and four placeholder headings for Plans 02-04.
- `tools/terrain-fixture-scan.mjs` — replays `action-script.movement.json`'s full 101-action script through the real engine, checking every `move`'s destination cell against `cell.water === true`; reports move-action counts and hero phobia for every other fixture. Measured **`WATER HITS: 0`** — no fixture ever steps onto water.
- `test/parity/FIXTURE-INVENTORY.md` gains the "Phase 41: water terrain" section with the scan's verbatim table and the consequence for Plan 02 (nothing to declare).

## Task Commits

1. **Task 1: Pin genFloor's main-rng draw count and post-generation cursor at HEAD (before any engine change)** - `1a2b2cf` (test)
2. **Task 2: placeWater on the derived stream + waterPools depth curve + cell.water carve-out + tolerant load** - `fe8e3e5` (feat)
3. **Task 3: LIVE fixture-roster scan (research Pitfall 1) — measure which scripted moves land on water, record the measurement, run the plan gate** - `85df9e6` (docs)

**Plan metadata:** (this commit, immediately following)

## Files Created/Modified

- `test/unit/floor-gen-rng-pin.test.js` — the pre-Phase-41 draw-count/rng-state pin (new)
- `engine/difficulty.js` — the five water-pool constants + `waterPools` curve field
- `engine/maze.js` — `placeWater` (new export) + the `genFloor` call site
- `engine/saveState.js` — `sanitizeWaterCells` (new), wired into `validateSave`/`rehydrate`
- `test/parity/harness/comparables.js` — `stripWaterField` (new), wired into all three exported comparables
- `test/parity/{movement,combat,magic}-parity.test.js` — `stripWaterField` mirrored into each local `comparable()`
- `test/unit/save-validation.test.js` — 3 new `sanitizeWaterCells` tests
- `test/unit/terrain.test.js` — 7 new tests (new file)
- `tools/terrain-fixture-scan.mjs` — the live fixture scan tool (new)
- `docs/TERRAIN.md` — the Phase 41 ledger (new)
- `test/parity/FIXTURE-INVENTORY.md` — the "Phase 41: water terrain" section

## Decisions Made

See frontmatter `key-decisions`. The one substantive judgment call: implementing `waterPools` consistent with the codebase's real, shared `breather` boolean (first breather at depth 6, not 5) rather than the plan's own literal acceptance-criteria table, which had assumed a 5/10/15/20 breather cadence that doesn't exist anywhere else in `engine/difficulty.js`. Recorded as a Rule 1 deviation below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected the plan's own `waterPools` acceptance table to match the codebase's real breather cadence**

- **Found during:** Task 2, while verifying the plan's literal `node -e` acceptance check (`process.exit(t==='1,1,1,1,1,2,2,2,3,1,3,1,1,3'?0:1)`)
- **Issue:** The plan's action text and acceptance criteria assumed breather floors at depth 5, 10, 15, 20. `engine/difficulty.js#isBreather` (`BREATHER_EVERY = 5`, `isBreatherOfSafeDepth`) actually puts the first breather at depth **6** (then 11, 16, 21, ...) — every other depth-curve knob in the same module (`darkBlobs`, `dots`) already keys off this same, real `breather` boolean. Implementing water's curve against the plan's assumed (wrong) breather list would have made `waterPools` the ONE knob in `difficultyCurve` that disagreed with its own module's breather cadence — a genuine, silent bug, not a stylistic choice.
- **Fix:** Implemented `waterPools` using the same `breather` local `difficultyCurve` already computes (matching CONTEXT.md's explicit "mirror darkBlobs/darkRadius" instruction), and rewrote the verification table (`test/unit/terrain.test.js`'s curve-table test) and the doc table (`docs/TERRAIN.md`) to the live-measured values: `1,1,1,1,2,1,2,2,3,3,1,3,3,3` for depths `[1,2,3,4,5,6,7,8,9,10,11,15,20,50]`.
- **Files modified:** `engine/difficulty.js`, `test/unit/terrain.test.js`, `docs/TERRAIN.md`
- **Verification:** `node -e "..."` re-run with the corrected expected string exits 0; `test/unit/terrain.test.js`'s curve-table test passes against the live `difficultyCurve()`/`isBreather()` output, not a hand-typed assumption.
- **Committed in:** `fe8e3e5` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — the plan's own literal verification table conflicted with the codebase's real breather cadence).
**Impact on plan:** No scope creep, no architectural change. The fix makes `waterPools` consistent with every sibling knob in `difficultyCurve` rather than introducing a one-off divergent breather definition.

## Issues Encountered

None beyond the item above (found and fixed inline, verified, part of the green suite before commit).

## User Setup Required

None — no external service configuration required.

## Gate (Task 3, plan's own verification — verification agents are off)

- `npm test`: **2826/2826**, `# fail 0`
- `git hash-object test/parity/prototype-master.js.txt`: `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` (unchanged)
- `git status --porcelain test/parity/fixtures`: empty (zero fixture files touched)
- `node --test test/unit/floor-gen-rng-pin.test.js`: green, file unchanged since the Task 1 commit (`git log --oneline -- test/unit/floor-gen-rng-pin.test.js` shows exactly 1 commit)
- `tools/terrain-fixture-scan.mjs`: **`WATER HITS: 0`** — no scripted fixture action lands on water; Plan 02 declares nothing for this scan (re-runs it to confirm once the move cost lands)
- `store-listing/`/`tools/store-screenshots/`: untouched throughout (never staged; `git status --porcelain` never showed them as anything but pre-existing untracked directories, which this plan never touched at all)

## Human verification (deferred to end of run)

Per the standing `defer uat to end` instruction, no device steps were taken this plan. A Pixel 7 tester should check, at the end of the run (batched with the other Phase 41 plans):

1. **A fresh floor shows blue water somewhere on the explored map once Plan 04 paints it** — this plan wires `cell.water` on the engine side only; the map render itself still shows the pre-Phase-41 floor palette until Plan 04 lands `MAP_PALETTE.water`. Expected: no visual change yet.
2. **An old save resumes with a waterless floor and no card** — load a save created before this plan landed; the current floor should show no water tiles (Plan 04's paint aside) and no popup/toast about the change.
3. **The next descent after resuming an old save shows water** — once the player descends to a newly generated floor, that floor should carry water pools (again, invisible until Plan 04's paint lands, but present in save data — verifiable via a dev/debug save inspection if needed).

## Next Phase Readiness

- TERR-01's engine half is fully landed: every floor at every depth carries derived-stream water pools; the field is a structural parity carve-out (all six sites); old/tampered saves tolerate; the fixture roster's water exposure is measured (`WATER HITS: 0`) and written down in both `FIXTURE-INVENTORY.md` and `docs/TERRAIN.md`.
- Plan 02 (water move cost) can proceed with a clean slate: zero declared divergences to carry forward, `WATER_MOVE_COST`/`moveCost(state, cell)` are the only new engine surface it needs to add, and its own re-run of `tools/terrain-fixture-scan.mjs` is a pure confirmation step (water PLACEMENT doesn't move — only the cost of stepping on it, which the scan already proved no fixture ever does).
- No blockers. `npm test`: 2826/2826, `# fail 0`. Master hash unchanged (`a1f4d0dc29782218d8e5aab65bc5989c33f917f0`). Full parity glob green; `git status --porcelain test/parity/fixtures` empty.

---
*Phase: 41-terrain-darkness-phobias*
*Completed: 2026-09-18*

## Self-Check: PASSED

Verified on disk: `test/unit/floor-gen-rng-pin.test.js`, `engine/difficulty.js`, `engine/maze.js`, `engine/saveState.js`, `test/parity/harness/comparables.js`, `test/parity/movement-parity.test.js`, `test/parity/combat-parity.test.js`, `test/parity/magic-parity.test.js`, `test/unit/save-validation.test.js`, `test/unit/terrain.test.js`, `tools/terrain-fixture-scan.mjs`, `docs/TERRAIN.md`, `test/parity/FIXTURE-INVENTORY.md` all exist with the expected content ("## Phase 41: water terrain" and "WATER HITS" present in FIXTURE-INVENTORY.md; the four Plan 02/03/04 placeholders present in TERRAIN.md).
Verified in git log: `1a2b2cf`, `fe8e3e5`, `85df9e6` all present on `master`.
