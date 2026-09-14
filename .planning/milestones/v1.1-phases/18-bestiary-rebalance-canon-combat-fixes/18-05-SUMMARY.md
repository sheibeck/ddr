---
phase: 18-bestiary-rebalance-canon-combat-fixes
plan: 05
subsystem: content
tags: [bestiary, balance, content-table, node-test, parity]

requires:
  - phase: 18-bestiary-rebalance-canon-combat-fixes
    provides: "18-01: bestiary-yardstick.mjs, BESTIARY-REBALANCE.md review verdicts and pre-ability discount plan (the exact numbers this plan applies)"
  - phase: 18-bestiary-rebalance-canon-combat-fixes
    provides: "18-02: engine/foeDamage.js seam, content/damage-multipliers.js, foeArmorSoaked"
provides:
  - "content/bestiary.js: ten rebalanced entries (Djinni x2, Krupke, Drudge x2, Vampire, Stalka Beast at -25% wp + one dice-step lower melee; Drake and Werebeast D-18 outlier fixes)"
  - "content/bestiary.js header comment referencing BESTIARY-REBALANCE.md and FIXTURE-INVENTORY.md (D-04)"
  - "test/unit/content-tables.test.js: 10 new Phase 18 pins (changed rows, Sterling unchanged, fixture-exposed rows verbatim, tier-shape guard)"
affects: [18-06]

tech-stack:
  added: []
  patterns: ["DELIBERATE RULES CHANGE (Phase 18, ...) inline comment above every changed bestiary entry naming the decision and before->after value"]

key-files:
  created: []
  modified:
    - content/bestiary.js
    - test/unit/content-tables.test.js

key-decisions:
  - "Drake wp 135 -> 38 (D-18): the largest value keeping Drake strictly the tankiest tier-4 body (Herman 36) while landing at 2.05x the tier-4 TTK median"
  - "Werebeast keeps atk:2 and the d10, drops only the flat +5 bonus to 0 (bonus 2 still left it at 2.46x lethal per 18-RESEARCH; bonus 0 lands at 1.94x); its note text updated from 'two attacks at d10+5' to 'two attacks at d10' so it no longer contradicts the stat"
  - "Five caster foes (Djinni x2, Krupke, Drudge x2, Vampire, Stalka Beast) get -25% wp via Math.round(old*0.75) and, where they had no existing sp.dmg, a new sp.dmg {n:1,sides:4,bonus:0} implementing 'one dice-step lower than the engine's d6 fallback'; Drudge gets the HP cut only (never melees per canon)"
  - "Sterling (D-19), Cave Bear, Herman, and the four fixture-exposed creatures (Bat/Rat, Shriek, Viper, Dante) are untouched by construction — proven by a byte-identical deepStrictEqual snapshot pin, not just by inspection"

requirements-completed: [BEST-01, BEST-02, BEST-03, FID-05]

coverage:
  - id: D1
    description: "D-18 outlier fixes: Drake wp 135->38 (2.05x tier-4 TTK median), Werebeast dmg bonus 5->0 (1.94x tier-3 lethality) with note text corrected"
    requirement: BEST-01
    verification:
      - kind: unit
        ref: "test/unit/content-tables.test.js#BESTIARY Phase 18 / D-18: Drake wp 38 (was 135), dmg 2d10+4 and every:4 unchanged"
        status: pass
      - kind: unit
        ref: "test/unit/content-tables.test.js#BESTIARY Phase 18 / D-18: Werebeast two attacks at d10 (bonus 5 -> 0), wp 32 unchanged, note matches the dice"
        status: pass
      - kind: other
        ref: "node tools/bestiary-yardstick.mjs --mechanics=prototype (Drake 2.05x, Werebeast lethality 1.94x)"
        status: pass
    human_judgment: false
  - id: D2
    description: "D-03 pre-ability discount: Djinni (T4+T5), Krupke, Drudge (T4+T5), Vampire, Stalka Beast all -25% wp; five of them gain a d4 melee dice step, Drudge gets HP-only"
    requirement: BEST-02
    verification:
      - kind: unit
        ref: "test/unit/content-tables.test.js#BESTIARY Phase 18 / D-03: Djinni (Demons T4 and T5) -25% HP and a d4 melee step"
        status: pass
      - kind: unit
        ref: "test/unit/content-tables.test.js#BESTIARY Phase 18 / D-03: Krupke wp 17, d6+2"
        status: pass
      - kind: unit
        ref: "test/unit/content-tables.test.js#BESTIARY Phase 18 / D-03: Drudge (Magical T4 and T5) wp 9, HP-only — no dmg field"
        status: pass
      - kind: unit
        ref: "test/unit/content-tables.test.js#BESTIARY Phase 18 / D-03: Vampire wp 71 + d4; Stalka Beast wp 94 + d4; both keep atk 2"
        status: pass
    human_judgment: false
  - id: D3
    description: "Zero parity carve-outs: fixture-exposed roster (Bat/Rat, Shriek, Viper, Dante), Sterling, Cave Bear, and Herman unchanged; parity suite byte-identical; no bestiary shape change"
    requirement: BEST-03
    verification:
      - kind: unit
        ref: "test/unit/content-tables.test.js#BESTIARY Phase 18 / D-14 (BEST-03, FID-05): the four fixture-exposed rows are byte-identical to the prototype"
        status: pass
      - kind: unit
        ref: "test/unit/content-tables.test.js#BESTIARY Phase 18 / D-17: no creature added, removed, or reordered — tier lengths per type"
        status: pass
      - kind: integration
        ref: "node --test test/parity/**/*.test.js (30/30 pass, byte-identical vs e01ac46)"
        status: pass
    human_judgment: false
  - id: D4
    description: "No fixture regeneration and no comparables.js/prototype-master.js.txt/engine/difficulty.js drift"
    requirement: FID-05
    verification:
      - kind: other
        ref: "git diff --quiet e01ac46 -- test/parity/fixtures test/parity/harness/comparables.js test/parity/prototype-master.js.txt engine/difficulty.js package.json package-lock.json"
        status: pass
      - kind: unit
        ref: "test/parity/fixture-inventory.test.js"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-09-13
status: complete
---

# Phase 18 Plan 05: Bestiary Rebalance Number Changes Summary

**Applied the ten planned D-03/D-18 number changes to content/bestiary.js (Drake, Werebeast, Djinni x2, Krupke, Drudge x2, Vampire, Stalka Beast) with zero parity carve-outs, pinned via 10 new content-tables.test.js tests.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-09-13
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments
- Fixed the two D-18 outliers: Drake `wp: 135 -> 38` (7.30x -> 2.05x tier-4 TTK median, still the tankiest tier-4 body above Herman's 36) and Werebeast `sp.dmg` bonus `5 -> 0` (2.60x -> 1.94x tier-3 lethality), with its `note` text corrected from "two attacks at d10+5" to "two attacks at d10" so it no longer contradicts the stat.
- Applied the D-03 pre-ability discount (-25% wp via `Math.round(old * 0.75)`, one dice-step lower melee damage) to the five caster foes: Djinni (Demons T4 and T5, wp 86->65, +d4), Krupke (Humans T2, wp 23->17, d8+2->d6+2), Drudge (Magical T4 and T5, wp 12->9, HP-only — never melees), Vampire (Walking Dead T5, wp 95->71, +d4), Stalka Beast (Beasts T5, wp 125->94, +d4).
- Added the `content/bestiary.js` header paragraph referencing `content/BESTIARY-REBALANCE.md` (the before/after stat table, D-04) and `test/parity/FIXTURE-INVENTORY.md` (the fixture-exposed roster that must never carve out).
- Added an inline `// DELIBERATE RULES CHANGE (Phase 18, ...)` comment above every one of the 9 changed lines naming the decision and before -> after value.
- Added 10 pins to `test/unit/content-tables.test.js`: the D-03 discount rows, the D-18 Drake/Werebeast fixes, Sterling's unchanged D-19 disposition, a byte-identical `deepStrictEqual` snapshot of the four fixture-exposed rows (Bat/Rat, Shriek, Viper, Dante), and a tier-length/shape guard (per-type tier lengths `[3,2,5,2,2] / [1,1,1,3,1] / [1,2,2,2,1] / [5,2,1,1,1] / [1,1,1,1,1] / [1,2,2,3,1]`, 53 total rows).
- Verified zero parity impact: `node --test "test/parity/**/*.test.js"` 30/30 green, byte-identical to `e01ac46` on fixtures/comparables.js/prototype-master.js.txt/engine/difficulty.js; `test/parity/fixture-inventory.test.js` and `test/unit/foe-turn-draw-count.test.js` FULL_FIGHTS pins unchanged; `npm test` 791/791 green (781 baseline + 10 new pins).

## Task Commits

Each task was committed atomically:

1. **Task 1: Apply the ten entry changes in content/bestiary.js and add the header reference to BESTIARY-REBALANCE.md** - `c6071bf` (feat)
2. **Task 2: Pin every changed row, every guard row, and the tier shape in content-tables.test.js; run the phase-level parity gate** - `f0f3405` (test)

_Note: no TDD tasks in this plan._

## Files Created/Modified
- `content/bestiary.js` - ten entries changed (Drake, Stalka Beast, Djinni x2, Krupke, Werebeast, Drudge x2, Vampire); header comment references BESTIARY-REBALANCE.md and FIXTURE-INVENTORY.md; no shape/schema change
- `test/unit/content-tables.test.js` - 10 new Phase 18 pins appended; no existing pin edited or removed

## Decisions Made
- Drake's new `wp: 38` was chosen as the largest value that (a) keeps Drake strictly the tankiest tier-4 body above Herman's `wp: 36`, and (b) lands at 2.05x the tier-4 TTK median — inside D-18's "~2x, not the median" target band.
- Werebeast's dice bonus goes to `0` rather than the `+2` 18-RESEARCH originally suggested, because recomputing with `+2` still left lethality at 2.46x (above the 2x band); `+0` lands at 1.94x. `atk: 2` and the d10 die are kept — only the flat bonus moves, per D-18's scope (fix the outlier, don't neuter the "boss").
- The five discount-target creatures without an existing `sp.dmg` field get a new `sp.dmg: {n:1, sides:4, bonus:0}` (a d4) to implement "one dice-step lower than the engine's d6 fallback" — `rollDice` with `n:1` draws exactly one die, identical draw-count behavior to the fallback it replaces, so no FULL_FIGHTS pin needed to move.
- Drudge (both tiers) gets the HP-only discount with no `dmg` field added, since it `never_melee`s per canon — adding an inert dice field would be a no-op that only obscures intent.

## Deviations from Plan

None - plan executed exactly as written. All ten entries, the header reference, the inline rationale comments, and all 10 test pins match the plan's exact specifications verbatim.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
`content/bestiary.js` now carries the Phase 18 numbers 18-06 needs to fill in the AFTER half of `content/BESTIARY-REBALANCE.md` (the `--mechanics=canon` yardstick table and the change ledger) once CANON-01/03/04/05 are wired into the engine (18-03/18-04, already complete on this tree). Zero parity carve-outs were needed — the fixture-exposed roster, Sterling, Cave Bear, and Herman are provably unchanged, so 18-06's invariant test has nothing to reconcile beyond documenting the numbers this plan already applied.

---
*Phase: 18-bestiary-rebalance-canon-combat-fixes*
*Completed: 2026-09-13*

## Self-Check: PASSED

- FOUND: content/bestiary.js
- FOUND: test/unit/content-tables.test.js
- FOUND: .planning/phases/18-bestiary-rebalance-canon-combat-fixes/18-05-SUMMARY.md
- FOUND commit: c6071bf
- FOUND commit: f0f3405
