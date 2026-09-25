---
phase: 73-engine-roll-high-mirror
plan: 07
subsystem: engine
tags: [dice, roll-high, combat, foe-ai, oracle, roll-05]

# Dependency graph
requires:
  - phase: 73-01
    provides: "engine/dice.js#rollCheck/atLeastFor/rollFields/isBestFace — the ONE roll-high check helper; the build-failing guard"
  - phase: 73-02
    provides: "The baselines, readout-compare tool, state pins, pre-switch save and the runtime invariant test shell"
  - phase: 73-03
    provides: "src/browser/rollRange.js (rangeText/rollVsText) and docs/ROLL-LEDGER.md's Phase 73 mirror verdicts"
  - phase: 73-06
    provides: "engine/derived.js#resistRoll on rollCheck; magic.js/derived.js fully enforced by the guard; the invariant covering 16 event types"
provides:
  - "engine/combat.js#pursuitStrike and foeTurn's hero branch on rollCheck(rng, dieN, atLeastFor(faces, dieN)) — need/needMods renamed to faces/mods, blind/penalty/insult keep their order (insult last)"
  - "The foe crit rule mirrors to the top face (top two for a Soldier): crit = roll >= atLeastFor(Soldier ? 2 : 1, dieN)"
  - "applyFoeDamageToPlayer's parameter object is { dmg, roll, atLeast, dieN, mods, ignoresArmor, ability }; the armor soak die reads through rollCheck(rng, 20, atLeastFor(soakAr, 20)); armorSoaked carries the soak triple, and a landed struckByFoe carries a nested soak: { roll, atLeast, dieN } triple when the soak die was drawn and failed"
  - "struckByFoe carries { roll, atLeast, dieN }, critical: isBestFace(roll, dieN), soldierCrit for roll === dieN - 1 && Soldier, critAtLeast when either fires, and mods when non-empty; need/needMods are gone"
  - "foeTurn's member branch on rollCheck(rng, mDieN, atLeastFor(mFaces, mDieN)); memberStruck carries { roll, atLeast, dieN, critical: isBestFace(roll, mDieN), critAtLeast: mDieN (only when critical), mods? }"
  - "src/browser/eventNarration.js's memberStruck/foeMissed/struckByFoe on the roll-high '<roll> vs lo-hi (mods)' shape; the old needModsClause '(needs N: ...)' helper deleted"
  - "src/browser/narrationLines.js's LINE_FOR.foeMissed would-have-hit reason on the new fields: wouldHaveHit = negative.length > 0 && roll != null && atLeast != null && roll >= atLeast + negSum"
  - "test/parity/roll-high-invariant.test.js's OUTCOME table covers foeMissed/struckByFoe/memberStruck/armorSoaked; 20 event types total, 52/52 parity green with zero fixture moves"
affects: [73-08, 73-09, 73-10, 74]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The need chain (blind/penalty/insult, or Sidestep/Smoke for the member) is pure arithmetic (zero rng draws) and can be computed either before or after the die draw without changing draw order or count — every foe-side site now computes the chain first (faces/mods), then draws via ONE rollCheck(rng, dieN, atLeastFor(faces, dieN)) call, matching the pattern 73-04/73-05 established in playerStrike/memberStrike/allyCast"
    - "The mirrored crit rule for a die-driven foe swing is crit = roll >= atLeastFor(Soldier ? 2 : 1, dieN) at the to-hit site (drives damage doubling); inside applyFoeDamageToPlayer the SAME roll is independently re-evaluated as critical = isBestFace(roll, dieN) (top face, any class) and soldierCrit = roll === dieN - 1 && Soldier (the Soldier's extra face) — this mirrors the old roll === 1 / roll === 2 && Soldier split exactly, since both computations read the identical passed-in roll"
    - "applyFoeDamageToPlayer's internal armor-soak rollCheck result (soakCheck) is null when the draw is gated off (no armour, or ignoresArmor) and non-null-but-failed when drawn and the blow got through — struckByFoe's optional `soak` field is `soakCheck ? { soak: rollFields(soakCheck) } : {}`, reusing the parity invariant's existing generic `soak` NESTED_CHECKS key with zero new invariant wiring"

key-files:
  created: []
  modified:
    - engine/combat.js
    - src/browser/eventNarration.js
    - src/browser/narrationLines.js
    - test/parity/roll-high-invariant.test.js
    - test/unit/combat.test.js
    - test/unit/feedback-payload.test.js
    - test/unit/parley.test.js
    - test/unit/party-abilities.test.js
    - test/unit/narrationLinesTable.test.js
    - test/unit/combat-scaling.test.js

key-decisions:
  - "struckByFoe's new key order (type, name, roll, atLeast, dieN, dmg, ignoresArmor, critical, [soaked], [soak], [mods], [critAtLeast], [soldierCrit]) is Claude's own choice (the plan left the field ORDER unspecified, only the field SET); the plain-hero key-order test in feedback-payload.test.js is re-pinned to this shape"
  - "critAtLeast is computed once per struckByFoe/memberStruck push as atLeastFor(Soldier ? 2 : 1, dieN) (or plain dieN for a member, since a member's crit is always the die's single top face) and only spread onto the event when critical or soldierCrit actually fired — this keeps a plain non-crit hit's event shape byte-identical to before (no critAtLeast key)"
  - "The dynamic-probing pursuitStrike insult test in parley.test.js (previously read probeMiss.need to derive a foe's actual faces count) now reads probeMiss.dieN/atLeast and computes the boundary raw draw as dieN + 2 - atLeast, preserving the test's original intent (works for any foeToHitVs value, not just the hardcoded default) without hardcoding the new mirrored numbers"

requirements-completed: [ROLL-05]

coverage:
  - id: D1
    description: "A foe's swing at the hero, pursuit's parting strike, and the hero's armor soak all read roll-high through rollCheck, with mirrored crit rules (top face any class, top two for a Soldier) and byte-identical outcomes for every raw draw"
    requirement: "ROLL-05"
    verification:
      - kind: unit
        ref: "node --test test/unit/combat.test.js test/unit/parley.test.js test/unit/armor-durability.test.js test/unit/rollDirection.test.js test/unit/rollDirection-checks.test.js test/unit/roll-high-state-pins.test.js test/unit/feedback-payload.test.js (335/335 pass)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every foe to-hit against a party member reads roll-high through rollCheck; memberStruck/foeMissed(member) carry the roll-high triple and the mirrored member-crit rule"
    requirement: "ROLL-05"
    verification:
      - kind: unit
        ref: "node --test test/unit/party-combat.test.js test/unit/party-abilities.test.js test/unit/feedback-payload.test.js test/unit/rollDirection.test.js (215/215 pass)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The Oracle's foe-swing lines (memberStruck/foeMissed/struckByFoe) print the roll-high 'roll vs lo-hi (mods)' shape; the would-have-hit reason reads the new fields; the runtime invariant covers all four new event types; the full parity suite and npm test hold with zero fixture moves"
    requirement: "ROLL-05"
    verification:
      - kind: unit
        ref: 'node --test "test/parity/**/*.test.js" (52/52 pass, zero fixture moves) && npm test (5751 total, 5744 pass, 7 known worktree-only CRLF failures unrelated to this plan)'
        status: pass
    human_judgment: false

# Metrics
duration: ~35min
completed: 2026-09-25
status: complete
---

# Phase 73 Plan 07: Engine Roll-High Mirror — Foe Swings, Pursuit and the Hero Soak Summary

**Every foe to-hit (hero branch, member branch, pursuit's parting strike), the foe crit rules (top face / top two for a Soldier), and the hero's armor soak now read roll-high through the shared `rollCheck` helper — foeMissed/struckByFoe/memberStruck carry `{ roll, atLeast, dieN }` with `need`/`needMods` retired, and the Oracle's foe-swing lines print the "roll vs lo–hi (mods)" shape.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-09-25
- **Tasks:** 3
- **Files modified:** 10 (4 engine/narration files, 6 test files)

## Accomplishments

- `engine/combat.js#pursuitStrike` and `foeTurn`'s hero branch now read the to-hit die through `rollCheck(rng, dieN, atLeastFor(faces, dieN))`, keeping the exact same draw position and the blind → Weaken-cap → insult (LAST) term order; `need`/`needMods` locals renamed to `faces`/`mods` throughout.
- The foe crit rule mirrors to the top face for any class, and the top TWO faces for a Soldier: `crit = roll >= atLeastFor(Soldier ? 2 : 1, dieN)` — byte-identical to the old `roll === 1 || (roll <= 2 && Soldier)` for every raw draw.
- `applyFoeDamageToPlayer`'s parameter object is now exactly `{ dmg, roll, atLeast, dieN, mods, ignoresArmor, ability }`. The armor soak die reads through `rollCheck(rng, 20, atLeastFor(soakAr, 20))` under the unchanged gate (Taunt's doubling stays inside `soakAr`); `armorSoaked` gains the soak triple via `rollFields(soakCheck)`, and a landed `struckByFoe` gains a nested `soak: { roll, atLeast, dieN }` when the soak die was drawn and failed.
- `struckByFoe` carries `{ roll, atLeast, dieN }`, `critical: isBestFace(roll, dieN)`, `soldierCrit` for `roll === dieN - 1 && Soldier`, `critAtLeast` when either fired, and `mods` when non-empty — `need`/`needMods` are gone.
- `foeTurn`'s member branch reads the to-hit die through `rollCheck(rng, mDieN, atLeastFor(mFaces, mDieN))` — the full chain (blind, penalty, the member's own Sidestep/Smoke, insulted LAST) keeps its order. The member crit mirrors to the top face: `isBestFace(roll, mDieN)`. `memberStruck` now carries `{ roll, atLeast, dieN, critical, critAtLeast: mDieN (only when critical), mods? }`.
- `src/browser/eventNarration.js`'s `memberStruck`/`foeMissed`/`struckByFoe` all print `<span class="roll">${roll}</span> vs ${rangeText(atLeast, dieN)}${modsClause(mods)}` — the old `needModsClause` "(needs N: ...)" helper is deleted (confirmed nothing else calls it).
- `src/browser/narrationLines.js`'s `LINE_FOR.foeMissed` reads the new fields: `wouldHaveHit = negative.length > 0 && roll != null && atLeast != null && roll >= atLeast + negSum` — the roll-high mirror of the old `roll <= need - negSum` reading (without the negative deltas, the foe's lowest winning face would have been `atLeast + negSum`, since `negSum` is itself negative).
- `test/parity/roll-high-invariant.test.js`'s `OUTCOME` table gains `foeMissed` (failure), `struckByFoe`/`memberStruck`/`armorSoaked` (success) — the invariant now validates 20 converted event types across all 31 replay sites plus the bot sweep with zero I1–I6 violations. `struckByFoe`'s nested `soak` field is validated for free by the invariant's existing generic `soak` `NESTED_CHECKS` key (no new wiring needed).
- All proof gates hold: the full parity suite (52/52, zero fixture moves), the Phase 72 direction tests/state pins/guard tests green, and `npm test` at 5744/5751 (only the 7 known worktree-only CRLF doc-ledger failures, unrelated to this plan and present before it).

## Task Commits

Each task was committed atomically:

1. **Task 1: The hero branch, pursuit, the foe crits and the hero soak on rollCheck** - `1a2f05e` (feat)
2. **Task 2: The member branch and the member crit on rollCheck** - `b42e262` (feat)
3. **Task 3: The foe-swing lines, the would-have-hit reason, the invariant rows, and the proof gates** - `ba01cc6` (feat)

_No plan-metadata commit — this is a parallel worktree plan; the orchestrator handles STATE.md/ROADMAP.md after all wave agents complete._

## Files Created/Modified

- `engine/combat.js` - `pursuitStrike`, `foeTurn`'s hero and member branches, and `applyFoeDamageToPlayer` on `rollCheck`; the mirrored crit rules; the new event/parameter shapes
- `src/browser/eventNarration.js` - `memberStruck`/`foeMissed`/`struckByFoe` on the roll-high line shape; `needModsClause` deleted
- `src/browser/narrationLines.js` - `LINE_FOR.foeMissed`'s would-have-hit reason on the new fields
- `test/parity/roll-high-invariant.test.js` - `OUTCOME` rows for the four newly-converted event types
- `test/unit/combat.test.js`, `test/unit/feedback-payload.test.js`, `test/unit/parley.test.js`, `test/unit/party-abilities.test.js`, `test/unit/narrationLinesTable.test.js` - mirrored `roll`/`atLeast`/`dieN`/`mods` expectations per the test-update rule (new roll = 21 − old raw expectation)
- `test/unit/combat-scaling.test.js` - one stale `struck.roll` assertion mirrored (Rule 1 deviation, see below)

## Decisions Made

- `struckByFoe`'s new key order (`type, name, roll, atLeast, dieN, dmg, ignoresArmor, critical, [soaked], [soak], [mods], [critAtLeast], [soldierCrit]`) was Claude's own choice — the plan specified the field SET, not the ORDER.
- `critAtLeast` is only spread onto `struckByFoe`/`memberStruck` when `critical || soldierCrit` actually fired, keeping a plain non-crit hit's event shape byte-identical to before.
- The pursuit-insult dynamic-probing test in `parley.test.js` was rewritten to derive its boundary raw draw from `probeMiss.dieN`/`probeMiss.atLeast` (`dieN + 2 - atLeast`) instead of a removed `.need` field — preserves the test's original robustness (works for any `foeToHitVs` value) rather than hardcoding the mirrored numbers.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a stale `struck.roll` assertion in `test/unit/combat-scaling.test.js`**
- **Found during:** Task 3 (running the full `npm test` proof gate)
- **Issue:** `test/unit/combat-scaling.test.js`'s "dmgBonus is retired" test asserted `struck1.roll === 3` (the old raw draw value) — broken by Task 1's hero-branch mirror (raw draw 3 now mirrors to reported roll 18), even though this file is not in this plan's `files_modified` list.
- **Fix:** Updated the assertion to `struck1.roll === 18` with a comment explaining the mirror (`21 - 3 = 18`); no other assertion in this test depends on the raw/mirrored distinction.
- **Files modified:** test/unit/combat-scaling.test.js
- **Verification:** `node --test test/unit/combat-scaling.test.js` passes; confirmed via the full `npm test` proof gate (only the 7 known CRLF failures remain).
- **Committed in:** ba01cc6 (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug fix on a test file outside the plan's declared scope, directly caused by Task 1's conversion)
**Impact on plan:** Necessary for the `npm test` proof gate to hold at the known-good failure count (7). No scope creep — the fix is a single mirrored numeric literal in a test assertion, not a behavior change.

## Issues Encountered

None beyond the deviation above.

## User Setup Required

None - no external service configuration required.

## Human verification (deferred to end of run)

On the Pixel 7 (once this wave's build is installed):
- A foe's miss and hit against the hero both read "**\<roll\>** vs lo–hi" in the Oracle (a `foeMissed`/`struckByFoe` line).
- A foe's swing at a party member reads the same shape with the member's name (`memberStruck`/`foeMissed` with `member` set).
- A smoked-and-insulted hero (Smoke override + `parleyInsulted`) shows "vs 19–20" on a d20 foe-swing line, per the Phase 72 ruling.
- A foe's crit (top face, or top two faces vs a Soldier) still reads "Critical!" in the Oracle exactly as before.

## Next Phase Readiness

- Every check site this plan's `docs/ROLL-LEDGER.md` mirror verdicts call for (rows 15, 16, 24, 26–29) now reads through `rollCheck` or `isBestFace`; `engine/combat.js`'s foe-side sites (hero branch, member branch, pursuit, `applyFoeDamageToPlayer`) are fully converted.
- `test/parity/roll-high-invariant.test.js`'s `OUTCOME`/`NESTED_CHECKS` now cover 20 event types (73-04 through this plan's rows) — ready for 73-08 (flee, parley, gates, drops, the foe ability gate) and 73-09 (traps, locks, climbs, cures, wake) to extend the remaining families. `COMPLETE` stays `false` until 73-09.
- `docs/ROLL-LEDGER.md`'s "Phase 73 mirror verdicts" table still shows `Status: planned` for every row this plan converted in substance — 73-10 is the plan that flips each site's row to done, unchanged from prior plans' note.
- No blockers for sibling wave plans — this plan touched only `engine/combat.js`'s foe-swing/pursuit/soak sites, leaving every other check site (flee, parley, traps, locks, climbs, cures, wake, the foe ability gate) exactly as prior plans left them.
- `engine/foeAbilities.js`'s `applyFoeDamageToPlayer` caller (the ability-bolt path, which passes no `roll`/`atLeast`/`dieN`/`mods`) needed no change — its parameter object only ever carries `{ dmg, ignoresArmor, ability }`, which the new destructuring still accepts unchanged.

---
*Phase: 73-engine-roll-high-mirror*
*Completed: 2026-09-25*
