---
phase: 73-engine-roll-high-mirror
plan: 08
subsystem: engine
tags: [dice, roll-high, combat, flee, parley, foe-ai, loot, oracle, roll-05]

# Dependency graph
requires:
  - phase: 73-01
    provides: "engine/dice.js#rollCheck/atLeastFor/rollFields/isBestFace — the ONE roll-high check helper; the build-failing guard"
  - phase: 73-03
    provides: "src/browser/rollRange.js (rangeText/rollVsText) and docs/ROLL-LEDGER.md's Phase 73 mirror verdicts"
  - phase: 73-07
    provides: "engine/combat.js's foe-swing/pursuit/soak sites fully converted; the invariant covering 20 event types"
provides:
  - "engine/combat.js#flee on rollCheck's arithmetic (already-high, no mirror): fleeRolled { roll, atLeast, dieN: 20, mods }, total/need retired"
  - "engine/combat.js#parley on rollCheck(rng, 20, atLeastFor(faces, 20)): parleyRolled { roll, atLeast, dieN, fluency }"
  - "engine/combat.js#startCombat: the tier-bleed d4, Con Artist weak-foe flee (d6) and Court Mage boredom (d12) on rollCheck; foeFled/foeBored carry the triple when their die was drawn"
  - "engine/combat.js#fight: the Hardiness phobia shrug (d2) on rollCheck; phobiaAfraid carries the triple when the die was drawn (and failed)"
  - "engine/combat.js#killFoe: the loot-drop gate and the bag-upgrade swap on rollCheck; offerLoot's optional 4th argument carries the roll-high triple(s) onto lootDropped, including a nested bag triple"
  - "engine/combat.js#foeTurn's ability gate (d6) on rollCheck; resolveFoeAbility's optional gate argument spreads onto foeCast"
  - "content/bags.js BAG_DROP_FACES (renamed from BAG_DROP_UNDER, same value 3, never persisted)"
  - "engine/items.js#offerLoot gains an optional roll-check argument"
  - "Every remaining draw in engine/combat.js and engine/foeAbilities.js tagged; both files join the roll-high guard's ENFORCED list with zero violations"
  - "test/parity/roll-high-invariant.test.js's OUTCOME table covers 27 event types; COMPLETE stays false until 73-09"
affects: [73-09, 73-10, 74]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "flee is the one already-high check this plan converts WITHOUT rollCheck's mirror: the raw d20 IS the roll (roll:already-high tag), and the modifier bonus folds into the threshold (atLeast = need - bonus) — algebraically identical to the old `roll + bonus >= need`, so no draw or outcome moves"
    - "A short-circuited gate whose die is drawn only under a preceding condition (Con Artist weak-foe flee, Court Mage boredom, the Hardiness phobia shrug, the foe ability cast policy) restructures from an inline `&&`-chained comparison into: compute the condition first (pure), draw exactly one rollCheck only when the condition holds, then branch on `.ok` — same draw count, same position, same short-circuit, with the roll-high triple spread onto the resulting event only when the die was actually drawn"
    - "offerLoot/resolveFoeAbility's optional trailing roll-check argument (defaulting to {}/null) lets a producer spread a roll-high triple onto its event only when it has one to report, keeping every other caller (and every plain/no-roll-check call) byte-identical to before"

key-files:
  created: []
  modified:
    - engine/combat.js
    - engine/foeAbilities.js
    - engine/items.js
    - content/bags.js
    - src/browser/eventNarration.js
    - src/browser/narrationLines.js
    - docs/FLEE.md
    - test/unit/roll-high-guard.test.js
    - test/parity/roll-high-invariant.test.js
    - test/unit/flee-retune.test.js
    - test/unit/parley.test.js
    - test/unit/linesForAction.test.js
    - test/unit/loot-pile.test.js
    - test/unit/bag-cap-gate.test.js
    - test/unit/combat.test.js
    - test/unit/foe-abilities.test.js
    - test/unit/fight-gate.test.js
    - test/unit/gear-axes.test.js

key-decisions:
  - "engine/combat.js's diff spans all three tasks (flee/parley, the gates/drops, and the file-wide tagging), so its full cumulative diff is committed with Task 3 (the commit that brings the file under full guard enforcement) rather than split hunk-by-hunk across three commits — Task 1 and Task 2 commits carry every file that is cleanly exclusive to their own scope; documented here rather than attempted as a risky manual patch split"
  - "Con Artist/Court Mage startCombat gates and the Hardiness phobia shrug restructure from inline `&&`-chained rng.d() comparisons into a compute-condition-then-gated-rollCheck shape (plan's own 'equivalent restructure' allowance) — draw count, draw position and short-circuit semantics are unchanged, proven algebraically by rollCheck's roll = dieN+1-r identity (raw <= faces ⟺ mirrored roll >= atLeastFor(faces, dieN) for every dieN/faces/raw)"
  - "BAG_DROP_UNDER's rename comment deliberately never spells out the old literal name (writes 'the old name' instead) so the acceptance criterion's `git grep -c BAG_DROP_UNDER` stays literally zero across content/engine/src/test/tools, per the plan's own acceptance gate"

requirements-completed: [ROLL-05]

coverage:
  - id: D1
    description: "flee and parley read roll-high through rollCheck (parley) and a bonus-folded threshold (flee, already-high); fleeRolled/parleyRolled carry the roll-high triple; the Oracle/rail/fight-log lines print the 'roll vs lo-hi (mods)' shape"
    requirement: "ROLL-05"
    verification:
      - kind: unit
        ref: "node --test test/unit/flee-retune.test.js test/unit/parley.test.js test/unit/linesForAction.test.js test/unit/rollDirection-checks.test.js test/unit/roll-high-state-pins.test.js (146/146 pass)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The Con Artist/Court Mage startCombat gates, the Hardiness phobia shrug, the kill-drop and bag-upgrade drops, and the foe ability cast gate all read roll-high through rollCheck, drawn under exactly the old short-circuited conditions; BAG_DROP_UNDER renamed to BAG_DROP_FACES with zero remaining literal references"
    requirement: "ROLL-05"
    verification:
      - kind: unit
        ref: "node --test test/unit/loot-pile.test.js test/unit/bag-cap-gate.test.js test/unit/combat.test.js test/unit/foe-abilities.test.js test/unit/phobia-triggers.test.js test/unit/rollDirection.test.js test/unit/rollDirection-checks.test.js test/unit/roll-high-state-pins.test.js test/unit/roll-high-save-compat.test.js (383/383 pass); node --test test/unit/identity-combat.test.js test/unit/identity-contract.test.js (89/89 pass)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every remaining draw in engine/combat.js and engine/foeAbilities.js is tagged; both files are enforced by the roll-high guard with zero violations; the parity invariant's OUTCOME table covers the 7 new event types this plan converts (27 total); the full parity suite and npm test hold with zero fixture moves"
    requirement: "ROLL-05"
    verification:
      - kind: unit
        ref: 'node --test test/unit/roll-high-guard.test.js "test/parity/**/*.test.js" (63/63 pass, zero fixture moves) && npm test (5751 total, 5744 pass, 7 known worktree-only CRLF failures unrelated to this plan)'
        status: pass
    human_judgment: false

# Metrics
duration: ~75min
completed: 2026-09-25
status: complete
---

# Phase 73 Plan 08: Engine Roll-High Mirror — Flee, Parley, the Combat Gates and Kill Drops Summary

**Flee (already-high, bonus folded into the threshold), parley, the Con Artist/Court Mage/Hardiness gates, the kill and bag-upgrade drops, and the foe ability cast gate all now read roll-high through `rollCheck` — every remaining raw draw in `engine/combat.js` and `engine/foeAbilities.js` is tagged, both files join the roll-high guard, and the parity invariant covers 27 converted event types with zero fixture moves.**

## Performance

- **Duration:** ~75 min
- **Completed:** 2026-09-25
- **Tasks:** 3
- **Files modified:** 18

## Accomplishments

- `engine/combat.js#flee` stays already-high (no mirror — the raw d20 IS the roll, tagged `roll:already-high`); `fleeBreakdown(c)`'s bonus now folds into the threshold (`atLeast = need - bonus`), byte-identical to the old `roll + bonus >= need`; `fleeRolled` carries `{ roll, atLeast, dieN: 20, mods }`, retiring `total`/`need`.
- `engine/combat.js#parley` draws through `rollCheck(rng, 20, atLeastFor(faces, 20))` at the exact old draw position (`faces` is the same number the old `need` was); `parleyRolled` carries `{ roll, atLeast, dieN, fluency }`.
- `src/browser/eventNarration.js`/`narrationLines.js`'s `fleeRolled`/`parleyRolled`/`fleeChain`/`parleyChain` print the roll-high "roll vs lo–hi (mods)" shape via `src/browser/rollRange.js`'s `rangeText`/`rollVsText` (now imported into `narrationLines.js`); `docs/FLEE.md`'s Event payload section rewritten to the new shape.
- `startCombat`'s tier-bleed d4, Con Artist weak-foe flee (d6) and Court Mage boredom kill (d12) convert to `rollCheck`, restructured from inline `&&`-chained comparisons into compute-then-gated-draw (same short-circuit, same draw count/position); `foeFled`/`foeBored` carry the triple when their die was drawn.
- `fight()`'s Hardiness phobia shrug (d2) converts the same way; `phobiaAfraid` carries the triple only when the die was drawn (and it failed — a successful shrug never pushes the event at all).
- `killFoe`'s loot-drop gate (`rollCheck(rng, 20, atLeastFor(2 + f.lvl, 20))`) and the bag-upgrade swap (`rollCheck(rng, 20, atLeastFor(BAG_DROP_FACES, 20))`, drawn only when a tier is available) convert; `offerLoot` gains an optional 4th argument spread onto `lootDropped`, including a nested `bag` triple when the bag die was drawn.
- `foeTurn`'s ability cast-policy gate (d6, drawn only when not `never_melee`) converts; `resolveFoeAbility` gains an optional trailing `gate` argument spread onto `foeCast`.
- `content/bags.js`'s `BAG_DROP_UNDER` is renamed to `BAG_DROP_FACES` (same value, 3, never persisted) — zero remaining literal references across `content/engine/src/test/tools`.
- Every remaining raw draw in `engine/combat.js` and `engine/foeAbilities.js` (initiative, the foe count/pickFoeTarget selections, every damage/count/duration amount, the already-high cooking/Humans-payout gates) carries its `roll:<kind>` tag; both files join the guard's `ENFORCED` list with live `DRAW_INVENTORY` counts and zero tag/shape/mirror violations.
- `test/parity/roll-high-invariant.test.js`'s `OUTCOME` table gains `fleeRolled`, `parleyRolled`, `foeFled`, `foeBored`, `phobiaAfraid`, `lootDropped` and `foeCast` — 27 converted event types validated end to end (I1–I6) across all 31 replay sites plus the bot sweep, with zero fixture moves.
- All proof gates hold: the full parity suite (63/63, zero fixture moves), the Phase 72 direction tests/state pins/guard tests green, and `npm test` at 5744/5751 (only the 7 known worktree-only CRLF doc-ledger failures, unrelated to this plan and present before it).

## Task Commits

Each task was committed atomically (see "Deviations" below for one intentional grouping adjustment):

1. **Task 1: Flee and parley, their events, lines and chains** - `0594513` (feat)
2. **Task 2: The combat gates, the kill drops and the foe ability gate** - `c1d45d1` (feat)
3. **Task 3: Tag the rest of combat.js and foeAbilities.js, enforce both, the invariant rows, and the proof gates** - `05a70f1` (feat)

_No plan-metadata commit — this is a parallel worktree plan; the orchestrator handles STATE.md/ROADMAP.md after all wave agents complete._

## Files Created/Modified

- `engine/combat.js` - flee, parley, startCombat's gates, fight's phobia shrug, killFoe's drops, foeTurn's ability gate converted; every remaining draw tagged
- `engine/foeAbilities.js` - `resolveFoeAbility`'s optional gate spread onto `foeCast`; its one remaining raw draw tagged
- `engine/items.js` - `offerLoot` gains an optional roll-check argument
- `content/bags.js` - `BAG_DROP_UNDER` renamed to `BAG_DROP_FACES`
- `src/browser/eventNarration.js`, `src/browser/narrationLines.js` - fleeRolled/parleyRolled/fleeChain/parleyChain on the roll-high line shape
- `docs/FLEE.md` - Event payload and narration section updated to the new shape/lines
- `test/unit/roll-high-guard.test.js` - `engine/combat.js`/`engine/foeAbilities.js` join `ENFORCED`, live `DRAW_INVENTORY` counts
- `test/parity/roll-high-invariant.test.js` - `OUTCOME` rows for the seven newly-converted event types
- `test/unit/flee-retune.test.js`, `test/unit/parley.test.js`, `test/unit/linesForAction.test.js`, `test/unit/loot-pile.test.js`, `test/unit/bag-cap-gate.test.js`, `test/unit/combat.test.js`, `test/unit/foe-abilities.test.js` - mirrored `roll`/`atLeast`/`dieN` expectations and the `BAG_DROP_FACES` rename per the test-update rule
- `test/unit/fight-gate.test.js`, `test/unit/gear-axes.test.js` - Rule 1 deviations (see below)

## Decisions Made

- `engine/combat.js`'s full cumulative diff (spanning all three tasks) is committed with Task 3, since Task 3 is the task that brings the file under full guard enforcement and its own hunks are deeply interleaved with Tasks 1/2's functional changes across the same file. Tasks 1 and 2's commits carry every file that is cleanly exclusive to their own declared scope (`eventNarration.js`, `narrationLines.js`, `docs/FLEE.md`, `foeAbilities.js`'s functional gate change, `items.js`, `content/bags.js`, and their respective test files). This is documented as a deliberate deviation from strict hunk-by-hunk atomicity, chosen over a risky manual patch split of an already-fully-edited file.
- The Con Artist/Court Mage/Hardiness/ability-gate restructures (inline `&&`-chained comparison → compute-condition-then-gated-`rollCheck`) use the plan's own "equivalent restructure" allowance; correctness is proven algebraically (rollCheck's `roll = dieN + 1 - r` identity makes `raw <= faces ⟺ mirrored roll >= atLeastFor(faces, dieN)` for every dieN/faces/raw), not just spot-checked per test case.
- `content/bags.js`'s rename comment and `test/unit/bag-cap-gate.test.js`'s header both avoid spelling out the literal old name, so the acceptance criterion's `git grep -c "BAG_DROP_UNDER" -- content engine src test tools` returns zero.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a stale `phobiaAfraid` exact-shape assertion in `test/unit/fight-gate.test.js`**
- **Found during:** Task 3 (running the full `npm test` proof gate)
- **Issue:** `test/unit/fight-gate.test.js`'s Hardiness-drawn-but-failed-shrug test asserted `deepStrictEqual(eventsA[afraidIdxA], { type: "phobiaAfraid", rounds: 2 })` — broken by Task 2's Hardiness-shrug conversion, which now spreads the roll-high triple onto `phobiaAfraid` when the shrug die was drawn and failed (raw draw 2 → mirrored roll 1 < atLeast 2), even though this file is not in this plan's `files_modified` list.
- **Fix:** Updated the assertion to include `roll: 1, atLeast: 2, dieN: 2` with a comment explaining the mirror.
- **Files modified:** test/unit/fight-gate.test.js
- **Verification:** `node --test test/unit/fight-gate.test.js` passes; confirmed via the full `npm test` proof gate.
- **Committed in:** 05a70f1 (Task 3 commit)

**2. [Rule 1 - Bug] Fixed a stale `fleeRolled` exact-field assertion in `test/unit/gear-axes.test.js`**
- **Found during:** Task 3 (running the full `npm test` proof gate)
- **Issue:** `test/unit/gear-axes.test.js`'s armor-bulk flee test asserted `rolled.total === 10` and `rolled.need === 14` — both fields retired by Task 1's flee conversion, even though this file is not in this plan's `files_modified` list.
- **Fix:** Updated the assertions to `rolled.roll === 12`, `rolled.atLeast === 16`, `rolled.dieN === 20` (14 - bonus(-2) = 16), with a comment explaining the fold.
- **Files modified:** test/unit/gear-axes.test.js
- **Verification:** `node --test test/unit/gear-axes.test.js` passes; confirmed via the full `npm test` proof gate.
- **Committed in:** 05a70f1 (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (Rule 1 - bug fixes on test files outside the plan's declared scope, directly caused by Tasks 1/2's conversions)
**Impact on plan:** Necessary for the `npm test` proof gate to hold at the known-good failure count (7). No scope creep — both fixes are mirrored numeric-literal/field-name corrections in test assertions, not behavior changes.

## Issues Encountered

None beyond the deviations above.

## User Setup Required

None - no external service configuration required.

## Human verification (deferred to end of run)

On the Pixel 7 (once this wave's build is installed):
- A Human Thief's flee in light armor reads "Flee: rolled **N** vs 9–20 (Thief +5)" in the Oracle.
- A parley reads "Talk it down: **N** vs lo–hi" in the Oracle, with the fluency bonus clause when applicable.
- A weak-foe Con Artist encounter still shows the foe fleeing; a Court Mage's bored-foe kill still narrates the same as before.
- A Hardiness character's phobia trigger still occasionally shrugs off Afraid with no visible change in feel.
- A kill drop and a bag-upgrade swap still land as before, with no visible change in drop rate/feel.
- A foe with an ability kit still casts roughly as often as before.

## Next Phase Readiness

- Every check site this plan's `docs/ROLL-LEDGER.md` mirror verdicts call for (rows 1, 3, 3b, 4-6, 12-14, 17-19, 25) now reads through `rollCheck` or stays already-high with a tag; `engine/combat.js` and `engine/foeAbilities.js` are fully converted and enforced.
- `test/parity/roll-high-invariant.test.js`'s `OUTCOME`/`NESTED_CHECKS` now cover 27 event types (73-04 through this plan's rows) — ready for 73-09 (traps, locks, climbs, cures, wake) to extend the remaining families and flip `ALL_ENFORCED`/`COMPLETE` to true.
- `docs/ROLL-LEDGER.md`'s "Phase 73 mirror verdicts" table still shows `Status: planned` for every row this plan converted in substance — 73-10 is the plan that flips each site's row to done, unchanged from prior plans' note.
- No blockers for sibling wave plans — this plan touched only `engine/combat.js`/`engine/foeAbilities.js`'s flee/parley/gate/drop sites plus the guard/invariant scaffolding, leaving `engine/encounters.js`/`engine/movement.js` (traps, locks, climbs, cures, wake) exactly as prior plans left them for 73-09.

---
*Phase: 73-engine-roll-high-mirror*
*Completed: 2026-09-25*

## Self-Check: PASSED

- FOUND: engine/combat.js
- FOUND: engine/foeAbilities.js
- FOUND: engine/items.js
- FOUND: content/bags.js
- FOUND: src/browser/eventNarration.js
- FOUND: src/browser/narrationLines.js
- FOUND: docs/FLEE.md
- FOUND: test/unit/roll-high-guard.test.js
- FOUND: test/parity/roll-high-invariant.test.js
- FOUND: 0594513 (Task 1 commit)
- FOUND: c1d45d1 (Task 2 commit)
- FOUND: 05a70f1 (Task 3 commit)
