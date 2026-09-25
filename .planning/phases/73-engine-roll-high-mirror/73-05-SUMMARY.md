---
phase: 73-engine-roll-high-mirror
plan: 05
subsystem: engine
tags: [dice, roll-high, combat, magic, party, event-narration, oracle, roll-05]

# Dependency graph
requires:
  - phase: 73-01
    provides: "engine/dice.js#rollCheck/atLeastFor/rollFields — the ONE roll-high check helper; the build-failing guard"
  - phase: 73-02
    provides: "The baselines, readout-compare tool, state pins, pre-switch save and the runtime invariant test shell"
  - phase: 73-03
    provides: "src/browser/rollRange.js (rangeText/rollVsText) and docs/ROLL-LEDGER.md's Phase 73 mirror verdicts"
  - phase: 73-04
    provides: "engine/combat.js#playerStrike/foeDamage.js on rollCheck; the transitional shatterIfBest shim and the Phase-73-transitional marker this plan removes"
provides:
  - "engine/combat.js#allyTurn (summoned ally), alliesTurn's legacy branch, and memberStrike — every party-side melee strike on rollCheck; Philly's slow keeps the higher of two mirrored faces"
  - "engine/dice.js#isBestFace flipped to roll === dieN — the die's top face is the roller's best face everywhere; the Phase-73-transitional shatterIfBest shim in playerStrike is gone"
  - "engine/magic.js#castSpell (thrown) and engine/combat.js#allyCast (thrown) on rollCheck — the school/throw bonuses fold into the threshold via atLeastFor(target + bonus, dieN)"
  - "allyStruck/allyMissed/allyCast/spellThrown/foeShattered carry the { roll, atLeast, dieN } triple (plus auto/critAtLeast/soak/mods where applicable); the old need/bonus fields are retired from these five event types"
  - "src/browser/eventNarration.js's allyMissed/allyCast/spellThrown lines on the roll-high '<roll> vs lo-hi (mods)' shape via rangeText/modsClause"
  - "test/parity/roll-high-invariant.test.js's OUTCOME table covers allyStruck/allyMissed/foeShattered/spellThrown/allyCast; all 31 replay sites + the bot sweep pass I1-I6 with zero violations"
affects: [73-06, 73-07, 73-08, 73-09, 73-10, 74]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Every remaining party-side strike (allyTurn, alliesTurn's legacy branch, memberStrike) now computes its faces chain (pure, zero-draw) ABOVE the strike draw, then reads rollCheck(rng, dieN, atLeastFor(faces, dieN)) in the exact old draw position — Philly's slow draws a second rollCheck and keeps Math.max of the two mirrored rolls, byte-identical to the old 'two dice, keep the lower raw face' rule"
    - "A thrown attack spell's school + throw bonus is no longer subtracted from the roll post-draw — it folds into the threshold via atLeastFor(faces + bonus, dieN), matching every other per-target to-hit modifier; the bonus surfaces on the event as school/throw mods entries instead of a bare bonus field"
    - "isBestFace(roll, dieN) is now roll === dieN; shatterIfBest's foeShattered push carries the mirrored roll plus atLeast: dieN and dieN, so every shatter event is now roll-carrying like every other check"
  file-scope-caveat: "party-combat.test.js is declared only under Task 1's files_modified, but one of its three fixes (the allyCast/Freeze test) exercises Task 2's allyCast-thrown engine change — landed in the Task 1 commit anyway per the plan's own file-to-task declaration, not split further"

key-files:
  created: []
  modified:
    - engine/combat.js
    - engine/magic.js
    - engine/dice.js
    - src/browser/eventNarration.js
    - test/parity/roll-high-invariant.test.js
    - test/unit/skeleton-shatter.test.js
    - test/unit/party-combat.test.js
    - test/unit/afraid.test.js
    - test/unit/roll-high-helper.test.js

key-decisions:
  - "memberStrike's crit line changed from `roll === 1` to `isBestFace(roll, dieN)` in Task 1's own commit (per the plan's explicit instruction), even though isBestFace itself was not flipped until Task 2 in the SAME plan — the plan's own text anticipates this ('run the full suite only after Task 2'), and both commits land together in this single plan so the intermediate state is never independently shipped"
  - "critAtLeast on memberStrike's allyStruck mirrors playerStrike's own pattern exactly: set to dieN only for the die-driven (isBestFace) crit, and explicitly reset to undefined on every non-die-driven crit path (forceCrit, backstab) so a later crit assignment can never leak a stale threshold"
  - "Thrown-spell mods order is [...afraidMods, ...schoolMod?, ...throwMod?] for both the hero's own cast (magic.js) and a member's cast (combat.js#allyCast) — afraid narrows the target before the caster's own offense bonus widens it, matching the per-target-then-caster ordering used throughout this phase's other strikers"

requirements-completed: [ROLL-05]

coverage:
  - id: D1
    description: "Party-member, legacy-ally and summoned-ally strikes read roll-high through rollCheck with byte-identical outcomes; Philly's slow keeps the higher of two mirrored faces"
    requirement: "ROLL-05"
    verification:
      - kind: unit
        ref: "node --test test/unit/party-combat.test.js test/unit/party-abilities.test.js test/unit/rollDirection.test.js (176/176 pass)"
        status: pass
    human_judgment: false
  - id: D2
    description: "isBestFace flips to roll === dieN; the Phase-73-transitional shatterIfBest shim is gone; thrown attack spells (hero + member) fold the school/throw bonus into the threshold via rollCheck"
    requirement: "ROLL-05"
    verification:
      - kind: unit
        ref: "node --test test/unit/skeleton-shatter.test.js test/unit/afraid.test.js test/unit/spell-mechanics.test.js test/unit/freeze-pays-out.test.js test/unit/rollDirection.test.js test/unit/rollDirection-checks.test.js test/unit/roll-high-state-pins.test.js (227/227 pass)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The Oracle's allyMissed/allyCast/spellThrown lines print the roll-high '<roll> vs lo-hi (mods)' shape; the runtime invariant's OUTCOME table covers allyStruck/allyMissed/foeShattered/spellThrown/allyCast; all proof gates hold"
    requirement: "ROLL-05"
    verification:
      - kind: unit
        ref: 'node --test "test/parity/**/*.test.js" (52/52 pass, zero fixture moves) && npm test (5751 total, 5744 pass, 7 known worktree-only CRLF failures unrelated to this plan)'
        status: pass
      - kind: other
        ref: "tools/initiative-fixture-scan.mjs and tools/worn-fixture-scan.mjs both diff clean (CRLF-insensitive) against their recorded output"
        status: pass
    human_judgment: false

# Metrics
duration: ~25min
completed: 2026-09-25
status: complete
---

# Phase 73 Plan 05: Engine Roll-High Mirror — Party Strikes, Thrown Spells and the isBestFace Flip Summary

**Converted every remaining player-side to-hit check (party-member, legacy-ally and summoned-ally strikes, plus the hero's and members' thrown attack spells) to the roll-high `rollCheck` helper, flipped `isBestFace` to `roll === dieN` so the Skeleton now shatters on the top face for all six strikers, and moved the Oracle's ally/thrown lines to the "<roll> vs lo–hi (mods)" shape — byte-identical outcomes proven by the full parity suite (zero fixture moves), the Phase 72 direction tests, the state pins, and a runtime invariant now covering all nine converted event types.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-09-25T13:29:00Z (approx)
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- `engine/combat.js#allyTurn` (summoned ally), `alliesTurn`'s legacy branch, and `memberStrike` all read their strike die through `rollCheck`: the per-target need chain (`need` renamed `faces`, plus `mod.needShift` in `memberStrike`) is computed above the draw, and Philly's `slow` draws a second `rollCheck` and keeps `Math.max` of the two mirrored rolls — byte-identical to the old "two dice, keep the lower raw face" rule. `memberStrike`'s natural-best crit reads `isBestFace(roll, dieN)` instead of a fixed `roll === 1`. `allyMissed` gains `target` and the `{roll, atLeast, dieN}` triple on the legacy/summon forms (previously bare `{name}`); `allyStruck` carries the triple plus `auto`/`critAtLeast`/`soak` on `memberStrike`'s own push. The old `need` field is retired from all three strikers.
- `engine/dice.js#isBestFace` is now `roll === dieN` — the top face of an N-sided die is the roller's best face. `playerStrike`'s Phase-73-transitional `shatterIfBest(state, t, dieN + 1 - roll, ...)` shim (73-04's bridge) is gone; every `shatterIfBest` caller now passes the mirrored roll directly. `shatterIfBest`'s `foeShattered` push carries `{ roll, atLeast: dieN, dieN, ...extra }`.
- `engine/magic.js#castSpell` (thrown) and `engine/combat.js#allyCast` (thrown) both fold the school/throw bonus into the threshold: `rollCheck(rng, dieN, atLeastFor(target + bonus, dieN))`, byte-identical to the old `roll - bonus <= target`. Both push `spellThrown`/`allyCast` with `...rollFields` and a `mods` array (`school`/`throw` entries, non-zero only, alongside Afraid's existing entry) instead of the old bare `need`/`bonus` fields.
- `src/browser/eventNarration.js`'s `allyMissed`/`allyCast`/`spellThrown` lines move to the roll-high "`<roll> vs lo–hi (mods)`" shape via `rangeText`/`modsClause`, replacing the old `vs ${need}${bonus suffix}` rendering.
- `test/parity/roll-high-invariant.test.js`'s `OUTCOME` table gains `allyStruck` (success), `allyMissed` (failure), `foeShattered` (success; `atLeast = dieN`), `spellThrown` (reads the following `spellHit`/`spellMissed` for the same target before the next `spellThrown`) and `allyCast` (reads the following `allySpellHit`/unresisted `allySpellMissed` before the next `allyCast`) rows. The invariant now validates all 31 replay sites plus the 4-run bot sweep against nine converted event types with zero I1–I6 violations.
- All proof gates hold: the full parity suite (52/52, zero fixture moves), the Phase 72 direction tests/state pins/guard tests green, both fixture-scan tools diff clean (CRLF-insensitive) against their recorded output, and `npm test` showing only the 7 known worktree-only CRLF doc-ledger failures with the total test count unchanged at 5751.

## Task Commits

Each task was committed atomically:

1. **Task 1: Member, legacy and summoned-ally strikes on rollCheck** - `9ee910f` (feat)
2. **Task 2: Thrown attack spells on rollCheck, and the isBestFace flip** - `0d79ef5` (feat)
3. **Task 3: The ally and thrown Oracle lines, the invariant rows, and the proof gates** - `7138252` (feat)

_No plan-metadata commit — this is a parallel worktree plan; the orchestrator handles STATE.md/ROADMAP.md after all wave agents complete._

## Files Created/Modified

- `engine/combat.js` - `allyTurn`/`alliesTurn` legacy branch/`memberStrike` on `rollCheck`; `isBestFace` flip usage (`shatterIfBest`'s docstring/push, `playerStrike`'s shatter call, `memberStrike`'s crit line); `allyCast`'s thrown branch on `rollCheck`
- `engine/magic.js` - `castSpell`'s thrown branch on `rollCheck`; the `rollCheck`/`atLeastFor`/`rollFields` import
- `engine/dice.js` - `isBestFace` flipped to `roll === dieN`
- `src/browser/eventNarration.js` - `allyMissed`/`allyCast`/`spellThrown` on the roll-high line shape
- `test/parity/roll-high-invariant.test.js` - `OUTCOME` rows for `allyStruck`/`allyMissed`/`foeShattered`/`spellThrown`/`allyCast`
- `test/unit/skeleton-shatter.test.js` - the `isBestFace` contract test rewritten to the roll-high reading and retitled
- `test/unit/party-combat.test.js` - mirrored `allyMissed`/`allyStruck`/`allyCast` roll/atLeast/dieN/mods assertions per the test-update rules (includes one Freeze/`allyCast` fix that exercises Task 2's engine change but lands here per the plan's own Task 1 file declaration)
- `test/unit/afraid.test.js` - mirrored thrown-spell (Fireball/Freeze) roll/atLeast/mods assertions
- `test/unit/roll-high-helper.test.js` - the out-of-scope `isBestFace` pin broken by the flip, updated (Rule 1)

## Decisions Made

- `memberStrike`'s crit line change (`roll === 1` -> `isBestFace(roll, dieN)`) landed in Task 1's own commit exactly as the plan specifies, even though `isBestFace` itself wasn't flipped until Task 2's commit in the same plan — the plan's `<action>` text explicitly anticipates this ("It reads correctly once Task 2 flips isBestFace; this task and Task 2 land in the same plan, so run the full suite only after Task 2"), so the intermediate (Task-1-only) state is never independently shipped or verified in isolation.
- `critAtLeast` on `memberStrike`'s `allyStruck` follows the exact pattern 73-04 established for `playerStrike`: set to `dieN` only for the die-driven crit, explicitly reset to `undefined` on every non-die-driven path (`forceCrit`, backstab) so a later assignment in the same call can never leak a stale threshold.
- Thrown-spell `mods` order is `[...afraidMods, ...schoolMod?, ...throwMod?]` for both the hero's cast (`magic.js`) and a member's cast (`combat.js#allyCast`) — Afraid narrows the target before the caster's own offense bonus widens it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `test/unit/roll-high-helper.test.js`'s `isBestFace` pin broke from this plan's own dice.js flip**
- **Found during:** Task 2 (running `npm test` after Task 2's own scoped verification passed)
- **Issue:** `test/unit/roll-high-helper.test.js` (73-01's helper-contract file, not declared in this plan's `files_modified`) pinned `isBestFace(1, 20) === true` — the pre-flip roll-under reading this plan's own Task 2 retires.
- **Fix:** Retitled and rewrote the test to the roll-high reading (`isBestFace(20, 20) === true`, `isBestFace(1, 20) === false`), noting that `test/unit/skeleton-shatter.test.js` now owns the primary `isBestFace` contract test.
- **Files modified:** `test/unit/roll-high-helper.test.js`
- **Verification:** `npm test` after the fix showed zero new failures beyond the 7 known worktree-only CRLF failures
- **Committed in:** `0d79ef5` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed category (1 out-of-scope test file, Rule 1 — a correctness break directly caused by this plan's own `isBestFace` flip)
**Impact on plan:** No scope creep beyond fixing a test broken by this plan's own change; no engine/content behavior was touched to accommodate the fix, and no expected value was loosened.

## Issues Encountered

None beyond the deviation above.

## User Setup Required

None - no external service configuration required.

## Human verification (deferred to end of run)

On the Pixel 7:
- A party member's miss reads "<roll> vs 16–20" in the Oracle (a level-1 Fighter member; 18–20 for a caster member, 17–20 for a thief member).
- A thrown attack spell reads "<roll> vs lo–hi" on its d8 (with "(school +N)" appended for a sub-class carrying an offense bonus).
- A Skeleton shatters on the top face of the striking die, for a hero strike, a party-member strike, a legacy/summoned-ally strike, and a thrown attack spell alike.

## Next Phase Readiness

- Every to-hit site in `engine/combat.js` and `engine/magic.js` that this phase's `docs/ROLL-LEDGER.md` mirror verdicts (rows 20-23, 34, 37) call for now reads through `rollCheck`; `isBestFace` is fully flipped with zero remaining transitional shims anywhere in the codebase (`grep -c "Phase 73 transitional"` across `engine/` is 0).
- `test/parity/roll-high-invariant.test.js`'s `OUTCOME`/`NESTED_CHECKS` now cover nine event types (`struck`, `strikeMissed`, `frenzy`, `foeArmorSoaked` from 73-04; `allyStruck`, `allyMissed`, `foeShattered`, `spellThrown`, `allyCast` from this plan) — ready for 73-06 through 73-09 to extend the remaining families (resistance, magic mishaps, foe swings, hero soak, flee, parley, gates, drops, traps, locks, climbs, cures, wake). `COMPLETE` stays `false` until 73-09.
- `docs/ROLL-LEDGER.md`'s "Phase 73 mirror verdicts" table still shows `Status: planned` for every row this plan converted in substance — 73-10 is the plan that flips each site's row to done, unchanged from 73-04's note.
- No blockers for the sibling wave-2 plans (73-06 resistance/magic mishaps, 73-07 foe swings/hero soak) — this plan touched only `engine/combat.js`'s remaining party-strike/thrown-spell sites and `engine/magic.js`'s thrown branch, leaving every other check site (foe swings vs hero/member, pursuit, flee, parley, resistance, magic mishaps, traps, locks, climbs, cures, wake) exactly as 73-01/73-04 left them.

---
*Phase: 73-engine-roll-high-mirror*
*Completed: 2026-09-25*

## Self-Check: PASSED

- FOUND: engine/combat.js
- FOUND: engine/magic.js
- FOUND: engine/dice.js
- FOUND: src/browser/eventNarration.js
- FOUND: .planning/phases/73-engine-roll-high-mirror/73-05-SUMMARY.md
- FOUND: 9ee910f (Task 1 commit)
- FOUND: 0d79ef5 (Task 2 commit)
- FOUND: 7138252 (Task 3 commit)
