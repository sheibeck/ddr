---
phase: 17-fixture-inventory-foe-turn-refactors
plan: 01
subsystem: testing
tags: [parity, fixtures, bestiary, inventory, determinism, node-test]

# Dependency graph
requires: []
provides:
  - "test/parity/harness/fixtureRoster.js — enumerateFixtureRoster()/rosterToMarkdown()/FIXTURE_ORDER, a replay-based fixture roster enumeration"
  - "tools/fixture-inventory.mjs — dev CLI to print/regenerate the roster table"
  - "test/parity/FIXTURE-INVENTORY.md — committed FID-01 inventory document (exposed bestiary surface + Phase 18 constraints)"
  - "test/parity/fixture-inventory.test.js — pinned roster + document-consistency regression test"
affects: ["17-02 (foe-turn extraction, reads combat.js unchanged by this plan)", "18 (bestiary rebalance consults FIXTURE-INVENTORY.md before touching any creature)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Replay-based fixture enumeration: reuse test/parity/harness/comparables.js's applyStartCombat/runEconomyAction (never re-implement startCombat/rng rehydration) to answer 'what does this fixture roll' questions"
    - "Null->non-null state.combat transition snapshot, once per script/scenario, to record exactly which foes a fight rolled without re-deriving startCombat's math"

key-files:
  created:
    - test/parity/harness/fixtureRoster.js
    - tools/fixture-inventory.mjs
    - test/parity/FIXTURE-INVENTORY.md
    - test/parity/fixture-inventory.test.js
  modified: []

key-decisions:
  - "Fixture roster rows always emitted in FIXTURE_ORDER (chargen, movement, combat, magic, economy, encounters) then in-file scenario order, per the plan's ordering must_have"
  - "A single generic replayEngineActions() helper handles movement/combat/magic (applyStartCombat + applyAction), and a second replayEconomyLikeActions() helper handles economy/encounters (loadPrototypeSandbox + runEconomyAction with the gold=5000 bump), mirroring full-suite.test.js's own domain split exactly"
  - "foes snapshot taken only on the null->non-null state.combat transition, guarded by a `snapshotted` flag, so a fight persisting across several actions (win/lose/flee/parley) is recorded exactly once"

patterns-established:
  - "Pattern: any future 'what does fixture X roll/exercise' question should extend fixtureRoster.js rather than writing a new one-off enumeration script"

requirements-completed: [FID-01]

coverage:
  - id: D1
    description: "enumerateFixtureRoster()/rosterToMarkdown()/FIXTURE_ORDER exported from test/parity/harness/fixtureRoster.js, replaying every fixture via applyStartCombat/applyAction/runEconomyAction"
    requirement: "FID-01"
    verification:
      - kind: unit
        ref: "test/parity/fixture-inventory.test.js (5 tests)"
        status: pass
      - kind: other
        ref: "node tools/fixture-inventory.mjs / --json (acceptance-criteria shell checks in 17-01-PLAN.md Task 1)"
        status: pass
    human_judgment: false
  - id: D2
    description: "test/parity/FIXTURE-INVENTORY.md committed with the replay-generated table, exposed-surface analysis, and Phase 18 constraints"
    requirement: "FID-01"
    verification:
      - kind: unit
        ref: "test/parity/fixture-inventory.test.js#FID-01: FIXTURE-INVENTORY.md's generated block matches the live replay"
        status: pass
    human_judgment: false
  - id: D3
    description: "Full parity suite and npm test stay green with zero fixture/harness/master file changes"
    requirement: "FID-01"
    verification:
      - kind: unit
        ref: "npm test (689/689 passing)"
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-09-13
status: complete
---

# Phase 17 Plan 01: Fixture Inventory Summary

**Replay-based FID-01 fixture inventory (harness module + CLI + committed doc + pinned test) proving the parity suite exercises exactly 4 bestiary creatures, all level 1**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-09-13T20:06:48Z
- **Tasks:** 2/2
- **Files modified:** 4 (all new)

## Accomplishments
- `test/parity/harness/fixtureRoster.js` replays every parity fixture (chargen/movement/combat/magic/economy/encounters) through the existing harness (`applyStartCombat`, `applyAction`, `runEconomyAction`) and returns an ordered, typed row set — zero hand-derived seed reasoning.
- `tools/fixture-inventory.mjs` is a dev-only CLI (table or `--json`) for regenerating the committed document.
- `test/parity/FIXTURE-INVENTORY.md` documents the exact parity-exposed bestiary surface — Beasts lvl 1 (`Bat/Rat`, `Shriek`, `Viper`) and Humans lvl 1 (`Dante`), all level 1 by the `maxLvl` clamp — plus the Phase 18 carve-out constraints (named `combatComparable` carve-out required for any of the 4 exposed creatures' stats; array length/order of `BESTIARY.Beasts[0]`/`BESTIARY.Humans[0]` is load-bearing).
- `test/parity/fixture-inventory.test.js` pins the 5 fight rows, the exposed-surface set, every "none" row (magic heal/potion/scroll, all 5 encounters scenarios, economy, movement, chargen), verbatim seed precision, and byte-equality between the doc's generated block and the live replay.
- Replay output matches 17-RESEARCH.md's independently-executed enumeration exactly (5 fights, 4 names, all lvl 1, zero wandering-monster starts).

## Task Commits

Each task was committed atomically:

1. **Task 1: Build the replay-based roster enumeration (harness module + CLI)** - `7bb009b` (feat)
2. **Task 2: Commit FIXTURE-INVENTORY.md and the pinned roster + document-consistency test** - `d682ccc` (docs)

_No plan-metadata commit yet — STATE.md/ROADMAP.md updates follow this SUMMARY per the execute-plan protocol._

## Files Created/Modified
- `test/parity/harness/fixtureRoster.js` - `enumerateFixtureRoster()`, `rosterToMarkdown()`, `FIXTURE_ORDER`; two internal replay helpers (`replayEngineActions`, `replayEconomyLikeActions`)
- `tools/fixture-inventory.mjs` - dev CLI printing the table or `--json` rows
- `test/parity/FIXTURE-INVENTORY.md` - committed FID-01 document (generated table + exposed-surface analysis + Phase 18 constraints + a Phase 19/17-03 placeholder heading)
- `test/parity/fixture-inventory.test.js` - 5 pinned `node:test` cases

## Decisions Made
- Used two replay helpers (engine-path vs. sandbox-path) rather than one, mirroring `full-suite.test.js`'s own domain split, instead of forcing every fixture domain through a single generic function — kept the sandbox-only economy/encounters logic isolated from the simpler engine-only movement/combat/magic logic.
- Snapshotted foes on the null→non-null `state.combat` transition (guarded by a `snapshotted` boolean) rather than at the moment a `startCombat` action runs, so the same logic correctly handles both the explicit `startCombat`-triggered fights and a hypothetical wandering-monster transition in movement, with no fixture-specific branching.

## Deviations from Plan

None — plan executed exactly as written. One minor self-correction during authoring: the document's "How to regenerate" prose initially repeated the literal marker strings (`<!-- fixture-inventory:generated:begin/end -->`) in explanatory text, which would have made `grep -c` on those exact strings return 2 instead of the required 1; reworded the prose to describe the markers without repeating them verbatim before running any acceptance check, so this was caught and fixed pre-commit, not a deviation to the shipped commit.

## Issues Encountered
- `node --test test/parity` (a bare directory argument) fails to resolve on this Windows/Git-Bash environment (`Cannot find module '...\test\parity'`) — a pre-existing environment quirk, not something this plan touched. Verified the equivalent full parity suite instead via `node --test "test/parity/**/*.test.js"` (30/30 passing) and `npm test` (689/689 passing, i.e. the project's actual `test` script), both of which are the commands the plan's `<verification>` section and STATE.md's Engine gate actually rely on.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- FID-01 deliverable is complete and self-checking; Phase 18's bestiary rebalance can consult `test/parity/FIXTURE-INVENTORY.md` before touching any creature, and `fixture-inventory.test.js` will fail loudly if a future change silently shifts which creatures are fixture-exposed.
- No blockers for 17-02 (foe-turn extraction) or 17-03 (draw-count baseline, which appends a section to `FIXTURE-INVENTORY.md`'s existing placeholder heading) — neither this plan's files nor `engine/combat.js`/`comparables.js` were touched.

---
*Phase: 17-fixture-inventory-foe-turn-refactors*
*Completed: 2026-09-13*

## Self-Check: PASSED

All created files verified present on disk; both task commits (`7bb009b`, `d682ccc`) verified present in `git log`.
