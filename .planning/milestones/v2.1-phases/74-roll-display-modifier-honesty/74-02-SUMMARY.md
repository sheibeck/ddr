---
phase: 74-roll-display-modifier-honesty
plan: 02
subsystem: ui
tags: [formatter, dice, roll-high, signed-modifier, pure-module]

# Dependency graph
requires:
  - phase: 73-engine-roll-high-mirror
    provides: "src/browser/rollRange.js's rangeText/rollVsText (73-03), the roll-high engine, mods renamed and roller-signed (73-10)"
provides:
  - "src/browser/rollRange.js extended with the ONE player-side signed-modifier formatter: signedText, ROLLERS, playerDelta, MOD_LABEL/modLabel, modText/modsText/modsClause, ROLL_COPY/toHitText, facesRangeText, dieText, hitRangeText"
  - "test/unit/rollRange.test.js pins the full contract: signs by roller, labels, faces-to-range, die names, the U+2212/U+2013 code points, empty/absent cases, purity, no mutation"
affects: [74-03, 74-04, 74-05, 74-06, 74-07, 74-08, 77]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One shared, import-free src/browser formatter owns every signed-modifier and range string; the sign is re-keyed on who rolled at format time, never at the engine/event layer"
    - "facesRangeText re-derives engine/dice.js#atLeastFor's conversion locally rather than importing it, preserving the module's zero-import purity guard"

key-files:
  created: []
  modified:
    - src/browser/rollRange.js
    - test/unit/rollRange.test.js

key-decisions:
  - "playerDelta negates only for roller === 'foe'; 'you', 'ally', and a missing/undefined roller all pass the engine's delta through unchanged (a missing roller reads as 'you', matching the plan's behavior list)"
  - "modLabel uses Object.prototype.hasOwnProperty.call(MOD_LABEL, name) rather than 'in' or bracket truthy checks, so a mod literally named 'constructor' reads back as its own name instead of resolving to Object.prototype.constructor"
  - "hitRangeText's modifier clause only appears when opts.mods is a non-empty array, so a present-but-empty mods list still reads '18–20 (d20)' with no trailing semicolon"

requirements-completed: [ROLL-02, ROLL-03]

coverage:
  - id: D1
    description: "signedText/ROLLERS/playerDelta/MOD_LABEL/modLabel/modText/modsText/modsClause/ROLL_COPY/toHitText: the roller-keyed signed-modifier formatter, matching every example in the plan's Task 1 behavior list"
    requirement: "ROLL-03"
    verification:
      - kind: unit
        ref: "test/unit/rollRange.test.js (26 tests covering signedText, ROLLERS, playerDelta, modLabel, modsText, modsClause, toHitText, purity, no-mutation)"
        status: pass
    human_judgment: false
  - id: D2
    description: "facesRangeText/dieText/hitRangeText: faces-to-range conversion matching atLeastFor, die naming, and the combined range+die+mods clause, matching every example in the plan's Task 2 behavior list"
    requirement: "ROLL-02"
    verification:
      - kind: unit
        ref: "test/unit/rollRange.test.js (8 additional tests covering facesRangeText, dieText, hitRangeText, and the hyphen-minus/percent/digit-plus prohibition scan)"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-09-25
status: complete
---

# Phase 74 Plan 02: Roll Display & Modifier Honesty — Formatter Extension Summary

**Extended src/browser/rollRange.js into the ONE player-side signed-modifier and range formatter — signedText/playerDelta re-sign every engine mod by who rolled, and facesRangeText/hitRangeText turn a winning-faces count into "16–20 (d20)" — with a 34-test contract pinning every sign, label, edge case and purity guarantee.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-09-25T13:50:46-04:00
- **Tasks:** 2
- **Files modified:** 2 (both already existed from Phase 73; no new files)

## Accomplishments
- `signedText(n)` writes every signed number with the U+2212 minus sign ("−2"), never the ASCII hyphen; zero and negative zero both read "0"; a non-finite value reads "?".
- `ROLLERS` (frozen `{you, ally, foe}`) and `playerDelta(delta, roller)` are the ONE place an engine mod's roller-signed delta flips to the player's side: `playerDelta(-2, "foe")` is `2` (a foe penalty reads as a player bonus), while `"you"`/`"ally"`/a missing roller pass the delta through unchanged.
- `MOD_LABEL`/`modLabel(name)` relabel only the two engine names a player can't read ("penalty" → "Weaken", "overhead" → "Overhead Blow"), using an own-property-only lookup so a mod named `"constructor"` doesn't resolve through `Object.prototype`.
- `modText`/`modsText`/`modsClause` compose the per-roller-signed, relabelled, comma-joined modifier list and its leading-space parenthetical clause, with an empty/absent list producing no clause at all (never empty parens).
- `ROLL_COPY`/`toHitText(delta)` fill "{signed} to hit" from an already player-signed delta.
- `facesRangeText(faces, dieN)` converts a winning-faces count into the lo–hi range the same way `engine/dice.js#atLeastFor` does — `(dieN + 1 − faces)–dieN` — re-derived locally (not imported) to keep the module's zero-import purity intact; `dieText(dieN)` names the die ("d20"/"d?"); `hitRangeText(faces, dieN, opts)` joins both plus an optional "; " mods clause: `"17–20 (d20; Sidestep +2, insulted −1)"`.
- Rewrote the module header to state the sign rule, name every consumer plan (74-03 through 74-07, and Phase 77's CMBUI-13 effect indicators), and clarify the U+2013 range-dash vs U+2212 minus-sign distinction.
- `test/unit/rollRange.test.js` grew from 8 to 34 tests, including a source-purity scan (zero imports, no `Math.random`/`Date.now`) and a frozen-copy-bank check, mirroring `upgrade-why.test.js`'s established pattern.

## Task Commits

Each task followed the RED → GREEN TDD cycle per `tdd="true"`:

1. **Task 1 RED: failing test for the roller-keyed signed-modifier formatter** - `ee33c04` (test)
2. **Task 1 GREEN: roller-keyed signed-modifier formatter implementation** - `f2d4a15` (feat)
3. **Task 2 RED: failing test for faces-to-range, die name and full hit-range text** - `59d58bd` (test)
4. **Task 2 GREEN: faces-to-range, die name and full hit-range text implementation** - `1e42a7d` (feat)

_No plan-metadata commit and no STATE.md/ROADMAP.md/REQUIREMENTS.md updates — this is a parallel worktree plan; the orchestrator handles those after all wave agents complete._

## Files Created/Modified
- `src/browser/rollRange.js` - extended with `signedText`, `ROLLERS`, `playerDelta`, `MOD_LABEL`/`modLabel`, `modText`/`modsText`/`modsClause`, `ROLL_COPY`/`toHitText`, `facesRangeText`, `dieText`, `hitRangeText`; still pure and import-free
- `test/unit/rollRange.test.js` - grew from 8 to 34 tests covering every behavior in the plan, plus the purity/frozen-copy source scan

## Decisions Made
- `playerDelta` negates only for `roller === "foe"`; every other roller value (including a missing one) passes the delta through unchanged, matching the plan's behavior list exactly rather than inferring a broader "non-foe negation" rule.
- `modLabel` uses `Object.prototype.hasOwnProperty.call(MOD_LABEL, name)` rather than the `in` operator or a truthy bracket lookup, so a mod literally named `"constructor"` reads back as `"constructor"` instead of accidentally resolving `MOD_LABEL.constructor` (the `Object` constructor function) through the prototype chain.
- `hitRangeText`'s modifier clause only appears when `opts.mods` is a non-empty array — a present-but-empty `mods: []` still reads `"18–20 (d20)"` with no dangling `"; "`.
- Kept the TDD RED/GREEN commit sequence strict per task: the first RED commit for Task 1 only imported what Task 1 needed (trimming the `facesRangeText`/`dieText`/`hitRangeText` imports out of that commit, re-adding them in Task 2's own RED commit) so each task's failing-test commit genuinely fails only on that task's missing exports, not a mix of both tasks'.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. `npm test` is 5778/5778 passing in this worktree (no CRLF or other pre-existing failures observed).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `src/browser/rollRange.js` now exports the complete range-and-signed-modifier contract: `rangeText`, `rollVsText` (73-03), `signedText`, `ROLLERS`, `playerDelta`, `MOD_LABEL`, `modLabel`, `modText`, `modsText`, `modsClause`, `ROLL_COPY`, `toHitText`, `facesRangeText`, `dieText`, `hitRangeText` (74-02).
- 74-03 (Oracle/fight-log/dice-reveal/rail), 74-04 (hero sheet/combat menu), 74-05 (item/loot/store/find comparisons), 74-06 (foe details) and 74-07 (condition chips) can now import and call these directly instead of the duplicate formatters called out in the plan's `<interfaces>` section (`eventNarration.js`'s `modsText`/`modsClause`, `narrationLines.js`/`combatMenu.js`'s flee-modifier helpers, `upgradeWhy.js`'s `signedNeed`/`critRange`) — this plan did not touch those files, leaving their deletion to the consumer plans as scoped.
- 74-08's consistency guard test and copy-bank scans have a stable, fully-tested module surface to guard against divergence.

---
*Phase: 74-roll-display-modifier-honesty*
*Completed: 2026-09-25*

## Self-Check: PASSED

- FOUND: src/browser/rollRange.js
- FOUND: test/unit/rollRange.test.js
- FOUND: .planning/phases/74-roll-display-modifier-honesty/74-02-SUMMARY.md
- FOUND commits: ee33c04, f2d4a15, 59d58bd, 1e42a7d, 0172e50 (all present in `git log`)
