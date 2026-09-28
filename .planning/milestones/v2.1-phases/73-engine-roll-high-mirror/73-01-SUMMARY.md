---
phase: 73-engine-roll-high-mirror
plan: 01
subsystem: engine
tags: [dice, roll-high, guard, roll-05]

# Dependency graph
requires:
  - phase: 72-roll-direction-sign-audit
    provides: docs/ROLL-LEDGER.md (48-site inventory), test/unit/rollDirection.test.js and rollDirection-checks.test.js (odds-based direction proofs), test/unit/roll-ledger-sync.test.js
provides:
  - "engine/dice.js#rollCheck/atLeastFor/rollFields — the ONE roll-high check helper, proven equivalent to the old roll-under comparison on every face"
  - "test/unit/roll-high-guard.test.js — the build-failing ENFORCED/DRAW_INVENTORY guard, ready for later plans to extend"
  - "// roll:<kind> tags on every raw draw in abilities.js, character.js, economy.js, maze.js, items.js, plus the difficulty.js foe-count dispatch line"
affects: [73-04, 73-05, 73-06, 73-07, 73-08, 73-09, 73-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One roll-high helper (rollCheck) in engine/dice.js; every content face count converts through atLeastFor before the draw"
    - "Trailing // roll:<kind> line comments tag every non-check raw draw, read by a build-failing guard"

key-files:
  created:
    - test/unit/roll-high-helper.test.js
    - test/unit/roll-high-guard.test.js
  modified:
    - engine/dice.js
    - engine/abilities.js
    - engine/character.js
    - engine/economy.js
    - engine/maze.js
    - engine/difficulty.js
    - engine/items.js

key-decisions:
  - "DRAW_INVENTORY counts .d( OCCURRENCES per tagged line, not tagged LINES — a selection-tagged dispatch-ladder comparison with no .d( on it (items.js's r<=3/5/7/9 ladder, difficulty.js's firstRoll<=2) contributes zero to the inventory but still needs the tag to exempt it from the S1-S8 shape scan"
  - "The shapes rule (S1-S8) is skipped only for roll:selection-tagged lines, per <interfaces>; amount/mishap-on-1 tags are still shape-checked (and never trip, since none of those lines carry a roll-under comparison)"
  - "rollCheck has zero callers this plan — conversion of check sites to the helper is deferred to 73-04 through 73-09, exactly as scoped"

requirements-completed: [ROLL-05]

coverage:
  - id: D1
    description: "engine/dice.js#rollCheck/atLeastFor/rollFields exist and are proven equivalent (mirror theorem) to the old roll-under comparison on every face, every die size 2-20"
    requirement: "ROLL-05"
    verification:
      - kind: unit
        ref: "test/unit/roll-high-helper.test.js#mirror theorem: (r <= faces) === rollCheck(stub r, N, atLeastFor(faces, N)).ok, for every N, every faces in -2..N+2, every r in 1..N"
        status: pass
    human_judgment: false
  - id: D2
    description: "A build-failing guard (ENFORCED/DRAW_INVENTORY/tags/shapes/mirror/inventory/transitional rules) enforces 17 of 24 engine files, with a self-test proving every rule fires on known-bad synthetic lines and stays quiet on every allowed roll-high shape"
    requirement: "ROLL-05"
    verification:
      - kind: unit
        ref: "test/unit/roll-high-guard.test.js (11 tests, including 4 self-test cases)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Behaviour is byte-identical: parity suite, Phase 72 direction tests, and the 200-seed bot readout path stay untouched (comment-only tags, zero fixture moves)"
    requirement: "ROLL-05"
    verification:
      - kind: unit
        ref: 'node --test "test/parity/**/*.test.js" (49/49 pass, zero fixture moves)'
        status: pass
      - kind: other
        ref: "node tools/comment-only-diff.mjs d274925 engine/abilities.js engine/character.js engine/economy.js engine/maze.js engine/difficulty.js engine/items.js (exit 0, 6 changed, 0 code-changed)"
        status: pass
    human_judgment: false

duration: 55min
completed: 2026-09-25
status: complete
---

# Phase 73 Plan 01: Engine Roll-High Mirror Foundation Summary

**The ONE roll-high check helper (rollCheck/atLeastFor/rollFields) in engine/dice.js, proven equivalent to every roll-under comparison via a mirror-theorem property test, plus a build-failing guard enforcing 17 of 24 engine files with zero behaviour change.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-09-25T11:24:00Z
- **Completed:** 2026-09-25T12:19:00Z
- **Tasks:** 2
- **Files modified:** 9 (2 created, 7 modified)

## Accomplishments

- `engine/dice.js` gained `rollCheck(rng, dieN, atLeast)`, `atLeastFor(faces, dieN)`, and `rollFields(chk)` — the single place a check die is read roll-high, proven equivalent to the old roll-under comparison on every face of every die size the engine uses (d2 through d20) via a mirror-theorem property test.
- `test/unit/roll-high-guard.test.js` — a build-failing guard with `ENFORCED` (17 paths), `ALL_ENFORCED = false`, a live `DRAW_INVENTORY`, a comment-aware line parser, and five rules (`tags`, `dice`, `shapes` S1-S8, `mirror` M1, `inventory`) plus `transitional` and `enforced` checks. An 11-test suite, including a self-test that fires each shape/mirror/tag-validity rule on known-bad synthetic lines and proves every allowed roll-high shape from the plan's `<interfaces>` block stays quiet.
- Comment-only `// roll:<kind>` tags landed on every raw draw in `engine/abilities.js`, `engine/character.js`, `engine/economy.js`, `engine/maze.js`, and `engine/items.js`, plus the selection-dispatch line in `engine/difficulty.js#foeCountFor` — zero code changes, confirmed by `tools/comment-only-diff.mjs`.

## Task Commits

Each task was committed atomically:

1. **Task 1: The roll-high helper in engine/dice.js** - `c23fe78` (feat)
2. **Task 2: The roll-high guard, and tags on the conversion-free engine files** - `ef20adf` (feat)

_Note: this plan had `tdd="true"` only on Task 1; Task 1's test file was written and run RED (missing exports) before the helper implementation turned it GREEN, but both steps landed in one commit per this plan's single-commit-per-task structure — the RED state was never separately committed._

## Files Created/Modified

- `engine/dice.js` - added `rollCheck`, `atLeastFor`, `rollFields`; tagged `rollDice`'s existing draw `// roll:primitive`
- `test/unit/roll-high-helper.test.js` - the helper's contract and mirror-theorem property test (created)
- `test/unit/roll-high-guard.test.js` - the ENFORCED/DRAW_INVENTORY build-failing guard with its self-test (created)
- `engine/abilities.js` - `// roll:amount` on the two Overhead-Blow-family draws (L228, L234)
- `engine/character.js` - `// roll:amount`/`roll:selection`/`roll:mishap-on-1` on every chargen/level-up/grimoire draw (17 lines)
- `engine/economy.js` - `// roll:selection` on the premium blade-or-mail pick (L411)
- `engine/maze.js` - `// roll:amount` on the water-pool size draw (L342)
- `engine/difficulty.js` - `// roll:selection` on `foeCountFor`'s `firstRoll <= 2` dispatch line (L435), the one comparison-only exemption tag in this file
- `engine/items.js` - `// roll:amount`/`roll:selection` on every treasure/tool/gift/heal draw, including the ladder-dispatch comparison lines (19 lines total)

## Decisions Made

- **DRAW_INVENTORY counts `.d(` occurrences, not tagged lines.** A `roll:selection` tag placed on a pure comparison line (no `.d(` on it, e.g. `if (r <= 3) return rollBlade(...)`) exists solely to exempt that line from the S1-S8 shape scan (`r <=` would otherwise trip S5, and `firstRoll <=` would trip S1 via its `\w*Roll` alternative) — it contributes zero to the inventory's draw counts. This matches the plan's own instruction ("Counts are of `.d(` occurrences by the tag on their line") and was verified against the actual character count during Task 2.
- **Existing trailing comments were relocated, never overwritten.** `character.js#nameFor`'s existing "the ONE and ONLY rng draw" comment was moved to its own line above `let i = rng.d(combos) - 1;` so the trailing `// roll:selection` tag stays parseable by the guard's tag regex (which requires `//` immediately followed by `roll:`, not `// <prose> roll:selection`).
- **`dr.d(...)` derived-stream draws in `character.js#rollGrimoire` (L335, L336, L382) were tagged `roll:selection`** per the plan's explicit interfaces guidance, even though they draw from a `derivedRng` instance, not the main `rng` — the guard's tag grammar covers any `.d(` call, not just `rng.d(`.

## Deviations from Plan

None - plan executed exactly as written. Every task, tag site, and guard rule matches the plan's `<action>` and `<interfaces>` blocks; the guard's self-test passed on the first run with no regex narrowing needed.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `engine/dice.js#rollCheck` exists with zero engine callers — ready for 73-04 through 73-09 to convert combat.js, derived.js, encounters.js, foeAbilities.js, foeDamage.js, magic.js, and movement.js's check sites onto it, adding each to `ENFORCED` and `DRAW_INVENTORY` as they land.
- The guard's `ALL_ENFORCED` flag stays `false` until 73-09 closes the last of the seven not-yet-enforced files.
- No blockers or concerns for the sibling plans in this wave (73-02 baselines, 73-03 `rollRange.js`/`ROLL-LEDGER.md`) — this plan touched only its declared `files_modified` list.

---
*Phase: 73-engine-roll-high-mirror*
*Completed: 2026-09-25*

## Self-Check: PASSED

- FOUND: engine/dice.js
- FOUND: test/unit/roll-high-helper.test.js
- FOUND: test/unit/roll-high-guard.test.js
- FOUND: c23fe78 (Task 1 commit)
- FOUND: ef20adf (Task 2 commit)
