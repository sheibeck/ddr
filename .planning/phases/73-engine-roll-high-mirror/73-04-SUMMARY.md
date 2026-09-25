---
phase: 73-engine-roll-high-mirror
plan: 04
subsystem: engine
tags: [dice, roll-high, combat, foe-damage, event-narration, rail, roll-05]

# Dependency graph
requires:
  - phase: 73-01
    provides: "engine/dice.js#rollCheck/atLeastFor/rollFields — the ONE roll-high check helper; the build-failing guard"
  - phase: 73-02
    provides: "The baselines, readout-compare tool, state pins, pre-switch save and the runtime invariant test shell"
  - phase: 73-03
    provides: "src/browser/rollRange.js (rangeText/rollVsText) and docs/ROLL-LEDGER.md's Phase 73 mirror verdicts"
provides:
  - "engine/combat.js#playerStrike — the hero's strike die, Philly's slow (keep the higher mirrored face), the frenzy trigger, and the weapon/Stealth/Ninja crits all on rollCheck"
  - "engine/foeDamage.js#damageFoe — the foe's natural-armor soak on rollCheck, with the failed-soak triple riding on a landed struck event's `soak` field"
  - "The new struck/strikeMissed/frenzy/foeArmorSoaked event shape ({ roll, atLeast, dieN, mods?, critAtLeast?, auto?, soak? }) with `need`/`needMods` retired from these four event types"
  - "src/browser/eventNarration.js's strikeMissed/struck lines and src/browser/rail.js's rollLineFor on the roll-high '<roll> vs lo–hi (mods)' shape"
  - "engine/foeDamage.js enrolled in the roll-high guard's ENFORCED list; test/parity/roll-high-invariant.test.js's OUTCOME table covers all four converted event types"
affects: [73-05, 73-06, 73-07, 73-08, 73-09, 73-10, 74]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The need chain (a pure, zero-draw arithmetic block) now sits ABOVE the strike draw so atLeastFor(faces, dieN) is ready before rollCheck fires; locals renamed need->faces, needMods->mods"
    - "critAtLeast tracks the lowest winning face for a die-driven crit (roll/stealth/ninja) only — backstab/cutthroat/a forced crit carry no threshold"
    - "A transitional shim (dieN + 1 - roll) feeds shatterIfBest until 73-05 flips isBestFace to the roll-high reading"
    - "damageFoe's soak now returns a `soak: { roll, atLeast, dieN }` triple on a landed blow whose armor die was drawn and failed, additive to the existing { applied, soaked, mult } shape"

key-files:
  created: []
  modified:
    - engine/combat.js
    - engine/foeDamage.js
    - src/browser/eventNarration.js
    - src/browser/rail.js
    - test/unit/roll-high-guard.test.js
    - test/parity/roll-high-invariant.test.js
    - test/unit/combat.test.js
    - test/unit/afraid.test.js
    - test/unit/ability-strike.test.js
    - test/unit/feedback-payload.test.js
    - test/unit/fightLog.test.js
    - test/unit/rail.test.js
    - test/unit/foe-damage.test.js
    - test/unit/abilities.test.js
    - test/unit/foe-turn-draw-count.test.js
    - test/unit/spell-mechanics.test.js

key-decisions:
  - "The soak spread onto struck (`...(landed.soak ? { soak: landed.soak } : {})`) was written in Task 1's commit but left dormant (foeDamage.js didn't yet produce the field) — Task 2's foeDamage.js edit is what actually populates it, keeping each task's commit scoped to its own file per the plan's task-file assignments"
  - "critAtLeast is explicitly reset to `undefined` on every non-die-driven crit path (backstab, cutthroat, a forced crit) so a later crit assignment in the same attack can't leak a stale threshold from an earlier branch"
  - "modsClause(mods) is a NEW helper distinct from the retained needModsClause(mods, need) — the roll-high line no longer repeats '(needs N: ...)' since the range already states the threshold; needModsClause stays untouched for the foe-side/thrown lines 73-05/73-07 still own"

requirements-completed: [ROLL-05]

coverage:
  - id: D1
    description: "playerStrike's strike die, Philly's slow, the frenzy trigger, and the weapon/Stealth/Ninja crits all read roll-high through rollCheck with byte-identical outcomes"
    requirement: "ROLL-05"
    verification:
      - kind: unit
        ref: "node --test test/unit/combat.test.js test/unit/afraid.test.js test/unit/ability-strike.test.js test/unit/rollDirection.test.js test/unit/rollDirection-checks.test.js test/unit/skeleton-shatter.test.js test/unit/roll-high-state-pins.test.js (325/325 pass)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The foe's natural-armor soak reads roll-high through rollCheck, foeArmorSoaked carries the triple, a landed blow reports a failed soak on `soak`, and engine/foeDamage.js is enforced by the guard with exactly one rollCheck draw"
    requirement: "ROLL-05"
    verification:
      - kind: unit
        ref: "node --test test/unit/roll-high-guard.test.js test/unit/rollDirection-checks.test.js test/unit/feedback-payload.test.js test/unit/roll-high-state-pins.test.js test/unit/foe-damage.test.js test/unit/combat.test.js (241/241 pass)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The Oracle's strike lines and rail's generic dice line print the roll-high range via rollRange.js; the runtime invariant's OUTCOME table covers struck/strikeMissed/frenzy/foeArmorSoaked; all five plan proof gates hold"
    requirement: "ROLL-05"
    verification:
      - kind: unit
        ref: 'node --test "test/parity/**/*.test.js" (52/52 pass, zero fixture moves)'
        status: pass
      - kind: other
        ref: "npm test (5751 total, 5744 pass, 7 known worktree-only CRLF failures unrelated to this plan); node tools/initiative-fixture-scan.mjs and worn-fixture-scan.mjs both diff clean against their recorded output"
        status: pass
    human_judgment: false

# Metrics
duration: 40min
completed: 2026-09-25
status: complete
---

# Phase 73 Plan 04: Engine Roll-High Mirror — The Hero's Offense Summary

**Converted the hero's own strike/crits/frenzy (engine/combat.js#playerStrike) and the foe's natural-armor soak (engine/foeDamage.js) to roll-high through the one rollCheck helper, carried the new roll/atLeast/dieN/critAtLeast/soak triple onto struck/strikeMissed/frenzy/foeArmorSoaked, and updated the Oracle strike lines and rail's dice line to the "<roll> vs lo–hi (mods)" shape — byte-identical outcomes proven by the full parity suite, the Phase 72 direction tests, the state pins, the pre-switch save, and a new runtime invariant covering all four converted event types.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-09-25T12:35:00Z (approx, worktree base cf59943)
- **Completed:** 2026-09-25T12:58:59Z
- **Tasks:** 3
- **Files modified:** 16 (4 engine/src, 12 test)

## Accomplishments

- `engine/combat.js#playerStrike`: the strike die, Philly's `slow` (now "keep the higher of two mirrored faces" — byte-identical to the old "keep the lower raw face"), the frenzy trigger (`rollCheck(rng, 8, atLeastFor(5, 8))`), and the weapon/Stealth/Ninja crits (`roll >= atLeastFor(N, dieN)`) all read through `rollCheck`. The need chain moved above the draw and its locals renamed to the roll-high reading (`faces`, `mods`). The transitional `shatterIfBest(state, t, dieN + 1 - roll, dieN, ...)` call keeps `isBestFace`'s old roll-under reading intact until 73-05 flips it.
- `struck`/`strikeMissed` now carry `{ roll, atLeast, dieN, mods?, critAtLeast?, auto?, soak? }` with `need`/`needMods` fully retired from these two event types; `frenzy` carries the same triple.
- `engine/foeDamage.js#damageFoe`'s natural-armor soak draw reads through `rollCheck(rng, 20, atLeastFor(foe.sp.ar, 20))`; `foeArmorSoaked` carries the triple, and a landed blow whose soak die was drawn and failed now reports `soak: { roll, atLeast, dieN }` (only `struck`'s soak-bag wiring — the other `damageFoe` callers ignore the new key until their own plans). `engine/foeDamage.js` joined the roll-high guard's `ENFORCED` list with exactly one `rollCheck` draw and zero raw draws.
- `src/browser/eventNarration.js`: `needModsText` renamed to `modsText`; a new `modsClause(mods)` (no "(needs N: ...)" repeat, since the range already states the threshold) backs the rewritten `strikeMissed`/`struck` lines: `"<roll> vs lo–hi (mods). ..."`, via `rollRange.js#rangeText`. `needModsClause` (the old "(needs N: ...)" shape) is kept unchanged for the foe-side/thrown lines 73-05/73-07 still own.
- `src/browser/rail.js#rollLineFor`'s generic dice-line branch drops the old `need` clause entirely and appends the roll-high range (`vs lo–hi`) when `event.atLeast`/`event.dieN` are both numbers.
- `test/parity/roll-high-invariant.test.js`'s `OUTCOME` table gained `struck` (success), `strikeMissed` (failure), `frenzy` (success) and `foeArmorSoaked` (success) rows; the invariant now validates all 31 replay sites plus the 4-run bot sweep (well over 2,000 events) against the new event shapes with zero I1-I6 violations.
- All five plan proof gates hold: the full parity suite (52/52, zero fixture moves), the Phase 72 direction tests/pins/fixtures/prototype master byte-identical to commit `d274925`, the state pins/save-compat/guard tests green, both fixture-scan tools diff clean, and `npm test` showing only the 7 known worktree-only CRLF doc-ledger failures (`docs/CLASS-PASS.md`, `docs/FLEE.md`) with the total test count unchanged at 5751.

## Task Commits

Each task was committed atomically:

1. **Task 1: playerStrike, the frenzy gate and the crits on rollCheck** - `b0c7fe4` (feat)
2. **Task 2: The foe's natural-armor soak on rollCheck, and the guard for foeDamage.js** - `49b6d89` (feat)
3. **Task 3: The strike lines, rail's dice line, the invariant rows, and the remaining tests** - `fe8b62c` (feat)

_No plan-metadata commit — this is a parallel worktree plan; the orchestrator handles STATE.md/ROADMAP.md after all wave agents complete._

## Files Created/Modified

- `engine/combat.js` - `playerStrike`'s strike die/Philly/frenzy/crits on `rollCheck`; the transitional `shatterIfBest` shim; the `struck`/`strikeMissed` new event shape; the `soak` spread
- `engine/foeDamage.js` - the natural-armor soak draw on `rollCheck`; `foeArmorSoaked`'s triple; the failed-soak `soak` field on a landed blow
- `src/browser/eventNarration.js` - `modsText`/`modsClause`; `strikeMissed`/`struck` on the roll-high line shape; `fleeRolled` updated to the renamed helper
- `src/browser/rail.js` - `rollLineFor`'s generic dice line on `atLeast`/`dieN`
- `test/unit/roll-high-guard.test.js` - `engine/foeDamage.js` added to `ENFORCED`/`DRAW_INVENTORY`
- `test/parity/roll-high-invariant.test.js` - `OUTCOME` rows for `struck`/`strikeMissed`/`frenzy`/`foeArmorSoaked`
- `test/unit/combat.test.js`, `test/unit/afraid.test.js`, `test/unit/ability-strike.test.js`, `test/unit/feedback-payload.test.js`, `test/unit/fightLog.test.js`, `test/unit/rail.test.js`, `test/unit/foe-damage.test.js` - mirrored assertions (`need`->`atLeast`+`dieN`, `needMods`->`mods`) per the test-update rules
- `test/unit/abilities.test.js`, `test/unit/foe-turn-draw-count.test.js`, `test/unit/spell-mechanics.test.js` - out-of-plan-scope struct/needMods assertions broken by the same engine change (see Deviations)

## Decisions Made

- The `soak` spread onto `struck` was written during Task 1 but stayed inert until Task 2's `foeDamage.js` edit actually populated `landed.soak` — each task's commit only touches the file(s) that task's own `<files>` block declares, even when a line's *effect* depends on a later task.
- `critAtLeast` is explicitly reset to `undefined` on every non-die-driven crit path (backstab, cutthroat, a forced crit via `AS.forceCrit`) so a later crit assignment in the same attack loop iteration never leaks a stale die-driven threshold from an earlier branch.
- `modsClause(mods)` is new and distinct from the retained `needModsClause(mods, need)` — the roll-high line shape (`"vs 16–20 (mods)"`) never repeats the threshold the range already states, while the still-roll-under foe-side/thrown lines keep their `"(needs N: mods)"` phrasing unchanged until their own conversion plans.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Four test files outside the plan's declared `files_modified` list broke from the same playerStrike/foeDamage.js engine change**
- **Found during:** Task 1 and Task 2 (running the full `npm test` suite after each task's own scoped verification passed)
- **Issue:** `test/unit/abilities.test.js` (`overheadBlow` test asserting `struck.needMods`), `test/unit/foe-turn-draw-count.test.js` (a Philly-slow test asserting `struck.roll === 2`), `test/unit/spell-mechanics.test.js` (a Stupidity test asserting `struck.need === 5`), and `test/unit/foe-damage.test.js` (three `foeArmorSoaked`/soak-shape `deepEqual` assertions) all directly exercise `playerStrike`/`damageFoe` and were not listed in the plan's `files_modified` frontmatter, but broke because the struct/strikeMissed/foeArmorSoaked event shape changed underneath them — a correctness break directly caused by this plan's own engine edits, squarely in scope for Rule 1 even though the files weren't pre-declared.
- **Fix:** Applied the same mirrored-value/field-rename test-update rules used throughout the plan: `needMods` -> `mods`, `need: k` -> `atLeast: N+1-k` + `dieN: N`, a mirrored raw-draw `roll` value, and (for `foe-damage.test.js`) the additive `roll`/`atLeast`/`dieN` triple on `foeArmorSoaked` plus the new `soak` key on a landed-but-soak-attempted blow.
- **Files modified:** `test/unit/abilities.test.js`, `test/unit/foe-turn-draw-count.test.js`, `test/unit/spell-mechanics.test.js` (Task 1 commit `b0c7fe4`); `test/unit/foe-damage.test.js` (Task 2 commit `49b6d89`)
- **Verification:** `npm test` after each task's fix showed zero new failures beyond the 7 known worktree-only CRLF failures
- **Committed in:** `b0c7fe4`, `49b6d89`

---

**Total deviations:** 1 auto-fixed category (4 test files outside the declared list, all Rule 1 — correctness breaks directly caused by this plan's engine edits)
**Impact on plan:** No scope creep beyond fixing tests that broke from this plan's own changes; no engine/content behavior was touched to accommodate these fixes, and no expected value was loosened (every fix mirrors an existing value per the plan's own test-update rules).

## Issues Encountered

None beyond the deviation above.

## User Setup Required

None - no external service configuration required.

## Human verification (deferred to end of run)

On the Pixel 7, swing at a foe and confirm the Oracle reads "<roll> vs 16–20" for a level-1 Fighter (18–20 for a caster, 17–20 for a thief).

## Next Phase Readiness

- `engine/dice.js#rollCheck` now has real callers in `engine/combat.js#playerStrike` and `engine/foeDamage.js#damageFoe`, both enforced by the roll-high guard (`engine/foeDamage.js` newly in `ENFORCED`; `engine/combat.js` stays out of `ENFORCED` until 73-05 converts its remaining check sites — member/ally/foe swings, pursuit, flee, parley — since the guard's shape/mirror rules scan a WHOLE file).
- `docs/ROLL-LEDGER.md`'s "Phase 73 mirror verdicts" table still shows `Status: planned` for every row — 73-10 is the plan that flips each converted site's row to done; this plan converted sites 7-11 and 34 in substance but the ledger status flip itself is out of this plan's scope.
- `test/parity/roll-high-invariant.test.js`'s `OUTCOME`/`NESTED_CHECKS` are ready for 73-05 through 73-09 to extend event type by event type; `COMPLETE` stays `false` until 73-09.
- The transitional `shatterIfBest(state, t, dieN + 1 - roll, dieN, ...)` call in `playerStrike` and the literal phrase `Phase 73 transitional` are 73-05's cue to flip `isBestFace` to `roll === dieN` and pass `roll` directly — this is the only such shim in the codebase (confirmed via the guard's `[transitional]` rule, which only scans `ENFORCED` files and does not yet include `combat.js`).
- No blockers for the sibling wave-2 plans (73-05 member/ally/isBestFace, 73-06 resistance/magic, 73-07 foe swings/hero soak) — this plan touched only `engine/combat.js#playerStrike`+`shatterIfBest`'s one call site and `engine/foeDamage.js`, leaving every other check site (member/ally/foe swings, pursuit, flee, parley, resistance, magic mishaps, traps, locks, climbs, cures, wake) exactly as 73-01 left them.

---
*Phase: 73-engine-roll-high-mirror*
*Completed: 2026-09-25*

## Self-Check: PASSED

- FOUND: engine/combat.js
- FOUND: engine/foeDamage.js
- FOUND: src/browser/eventNarration.js
- FOUND: src/browser/rail.js
- FOUND: .planning/phases/73-engine-roll-high-mirror/73-04-SUMMARY.md
- FOUND: b0c7fe4 (Task 1 commit)
- FOUND: 49b6d89 (Task 2 commit)
- FOUND: fe8b62c (Task 3 commit)
