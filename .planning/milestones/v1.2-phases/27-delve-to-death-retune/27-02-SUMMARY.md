---
phase: 27-delve-to-death-retune
plan: 02
subsystem: difficulty-tuning
tags: [bestiary, dante, canon-deviation, parity-divergence, action-path-record, fixture-inventory, difficulty-curve, early-floor-levers, foe-grace, hazard-ramp, darkness-hold, iteration-0, ledger]

# Dependency graph
requires:
  - phase: 27-delve-to-death-retune
    plan: 01
    provides: "the v1.2 retune band, the Dante decision rule + calibration table, and the iteration protocol recorded in docs/DIFFICULTY-RETUNE.md before any constant/bestiary change existed in the tree"
provides:
  - "content/bestiary.js: Dante demoted to tier 2 (byte-identical stats/note), Ned added as the new tier-1 Humans row — the first deliberate canon deviation (TUNE-06), decision rule met (14.73% <= 25.72% Demons reference)"
  - "test/parity/fixtures/action-script.combat.json + FIXTURE-INVENTORY.md: the seed-303 parley scenario's declared action-path divergence record (Dante -> Ned), machine-checked at both existing replay sites with zero harness edits; a new '## Phase 27 early-floor divergences' section pre-enumerating four escalation records for 27-03"
  - "engine/difficulty.js: DENSITY_CANON_THROUGH_DEPTH, FOE_GRACE_AT_1/AT_2/CANON_FROM_DEPTH, HAZARD_FROM_DEPTH/SCALE_AT_START/FLAT_THROUGH_DEPTH/CANON_FROM_DEPTH fields; restructured dots/darkness (floors 1-2 canon by construction); a new scaleHazard() helper consumed post-draw by engine/movement.js and engine/encounters.js"
  - "test/unit/combat-scaling.test.js's PHASE_27_PINS object — the one place 27-03 edits Phase 27 dial numbers per iteration"
  - "docs/DIFFICULTY-RETUNE.md: '### Dante demotion — landed (27-02)' and Iteration 0 (constants, curve table, smoke readout, planner calibration table, escalation order) filled in"
affects: [27-03-combat-dials-and-after, 27-04-dr-round]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Structural-identity soft-cap restructuring: a canon formula is rewritten as base-plus-soft-cap-over-a-clamped-'over'-term so it is byte-identical to the old formula through a named depth threshold (DENSITY_CANON_THROUGH_DEPTH, DARK_HOLD_THROUGH_DEPTH) — the same technique COMBAT_SCALE_FROM_DEPTH already used, now applied to non-combat knobs"
    - "Post-draw hazard scaling: a new curve field (hazardScale) consumed AFTER a canon dice roll by two independent consumers (movement fall damage, encounters trap damage), with a strict `=== 1` fast path so identity is structural, not incidental"
    - "Declared action-path divergence (FID-07-style, reused unmodified): a bestiary change that moves WHICH creature a fixture rolls is handled via a `kind: action-path` record on the scenario object, checked by the pre-existing actionPathDivergenceOf/skipsByteDiffAt/declaredEndDiffs helpers at both replay sites — zero comparables.js edits"

key-files:
  created: []
  modified:
    - content/bestiary.js
    - content/BESTIARY-REBALANCE.md
    - test/unit/content-tables.test.js
    - test/unit/bestiary-yardstick.test.js
    - test/unit/foe-turn-draw-count.test.js
    - test/unit/parley.test.js
    - test/parity/fixture-inventory.test.js
    - test/determinism/foe-abilities.test.js
    - test/parity/fixtures/action-script.combat.json
    - test/parity/FIXTURE-INVENTORY.md
    - engine/difficulty.js
    - engine/combat.js
    - engine/movement.js
    - engine/encounters.js
    - test/difficulty/difficulty.test.js
    - test/unit/combat-scaling.test.js
    - test/unit/maze.test.js
    - test/unit/encounters.test.js
    - test/unit/movement.test.js
    - docs/DIFFICULTY-RETUNE.md

key-decisions:
  - "Landed Dante Form C exactly as the plan specified (move to end of Humans tier 2, add Ned at tier 1) rather than any of the smaller forms (A/B/A+B) — Form C is the only one the plan's own calibration showed meets the decision rule (floor-1 Humans death rate <= the Demons reference)."
  - "Followed Task 3's literal explicit dial values (FOE_GRACE_AT_2 = 0.75, HAZARD_SCALE_AT_START = 0.5, DARK_HOLD_THROUGH_DEPTH = 3) even though the plan's own calibration table's 'T2 — strongest parity-clean set' row uses a stronger grace of 0.5, not 0.75. The Task 3 action items and its own automated verify script (which literally asserts `c2.foePower === 0.75`) are unambiguous about the value to land; the calibration table's T2/T3/etc rows are directional/illustrative combinations exploring the ladder, not all of which are the one this task instructs landing. Documented as a deviation below (Rule 2 was not needed — this is simply following the plan's most specific, machine-checked instruction over a looser prose table)."
  - "Normalized foeDmgBonusFor's rounding result with `|| 0` to avoid ever returning `-0` (Math.round(-0.25) = -0 at lvl 1's mild grace) — a strict-equality test (`assert.equal(x, 0)` under node:assert/strict, which uses Object.is) failed on -0 !== 0; the engine-side normalization is the correct fix since a `-0` dmgBonus is a latent footgun for any future consumer, not just this test."

requirements-completed: [TUNE-06]

coverage:
  - id: D1
    description: "Dante demoted to tier 2 (content/bestiary.js), byte-identical stats/note; Ned added as tier-1 Humans row; decision rule met by live 2,000-seed sim (14.73% <= 25.72% Demons reference)"
    requirement: TUNE-06
    verification:
      - kind: unit
        ref: "test/unit/content-tables.test.js, test/unit/bestiary-yardstick.test.js (Dante-at-T2 byte-identical assertion, Ned pins, tier medians unchanged)"
        status: pass
      - kind: other
        ref: "scratch sim (C:/Users/Dell/AppData/Local/Temp/claude/.../scratchpad/dante-sim.mjs, not committed) quoted in content/BESTIARY-REBALANCE.md and docs/DIFFICULTY-RETUNE.md"
        status: pass
    human_judgment: false
  - id: D2
    description: "Seed-303 parley scenario carries the ONE declared parity divergence (Dante -> Ned), machine-checked at both replay sites with zero comparables.js/prototype-master.js.txt edits; FIXTURE-INVENTORY.md's Phase 27 section documents it plus four pre-enumerated escalation records"
    requirement: TUNE-06
    verification:
      - kind: integration
        ref: "node --test \"test/parity/**/*.test.js\" (33/33)"
        status: pass
      - kind: other
        ref: "git diff --quiet 4e4b3e7 -- test/parity/prototype-master.js.txt test/parity/harness/comparables.js"
        status: pass
    human_judgment: false
  - id: D3
    description: "Early-floor levers landed behind draw-free engine/difficulty.js fields (foe grace 2-4, hazard ramp from floor 2, darkness hold through 3, eased dot/dark caps), floors 1-2 canon by construction; PHASE_27_PINS test restructure"
    requirement: TUNE-06
    verification:
      - kind: unit
        ref: "test/difficulty/difficulty.test.js, test/unit/combat-scaling.test.js, test/unit/maze.test.js, test/unit/encounters.test.js, test/unit/movement.test.js, test/determinism/foe-abilities.test.js"
        status: pass
      - kind: integration
        ref: "npm test (1441/1441)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Iteration 0 logged in docs/DIFFICULTY-RETUNE.md: Dante demotion numbers, constants/curve table, smoke readout, planner calibration table, escalation order"
    requirement: TUNE-06
    verification:
      - kind: unit
        ref: "test/unit/difficulty-retune-ledger.test.js"
        status: pass
    human_judgment: false

duration: ~65min
completed: 2026-09-15
status: complete
---

# Phase 27 Plan 2: Dante Demoted, Early-Floor Levers Landed, Iteration 0 Logged Summary

**Landed the phase's first deliberate canon deviation (Dante demoted to Humans tier 2, Ned added at tier 1 — floor-1 Humans death rate 61.57% -> 14.73%) with its single declared parity divergence, plus the parity-clean early-floor lever set (foe grace 2-4, hazard ramp from floor 2, darkness held through 3) behind draw-free `engine/difficulty.js` fields, and logged Iteration 0's smoke readout and calibration table in the retune ledger.**

## Performance

- **Duration:** ~65 min
- **Tasks:** 4 (all `type="auto"`, no checkpoints)
- **Files modified:** 20 (2 content files, 1 doc, 17 test/engine files)

## Accomplishments

- **Dante demoted (TUNE-06, Task 1):** `content/bestiary.js` moves Dante to the end of Humans tier 2 (byte-identical `sz H, i 12, wp 20, sp.atk 3` and note) and adds a new tier-1 Humans row, `Ned` (`sz H, i 8, wp 8`, one plain swing a round). The decision rule ("<=  the next-deadliest tier-1 type's death rate") is met with room to spare: a live 2,000-seed attack-only sim (`newRun` -> `startCombat` -> `playerStrike` to resolution) measured canon Humans at 61.57%, the landed bestiary at 14.73%, against a Demons reference of 25.72%. Every unit/determinism pin that named the old tier-1 Dante row or the old tier-2 pick was re-measured live and pinned with a Phase 27 comment (content-tables, bestiary-yardstick, foe-turn-draw-count's seed-303 FULL_FIGHTS row, parley Test 14, and the determinism `humans-t2` spec, whose first-Krupke seed moved from 1 to 3 since Dante's tier-2 append changed the `rng.pick` roster).
- **The one parity divergence declared (Task 2):** `test/parity/fixtures/action-script.combat.json`'s `parley` scenario (seed 303) carries a `kind: "action-path"` record (`fromAction: 0`, fields `wp/sp/gold/kills/rations`, measured before/after, `stateFields: ["dead"]`), machine-checked at both existing replay sites (`combat-parity.test.js`, `full-suite.test.js`) via the pre-existing `actionPathDivergenceOf`/`skipsByteDiffAt`/`declaredEndDiffs` helpers — zero edits to `comparables.js` or `prototype-master.js.txt`. `FIXTURE-INVENTORY.md` gained a new "## Phase 27 early-floor divergences (TUNE-06)" section with the measured per-action table and four pre-enumerated escalation records (hazard-from-1, darkness-from-4, rations+N, floor-1-grace) so 27-03 never has to invent a record shape from scratch.
- **Early-floor levers landed (Task 3):** `engine/difficulty.js` gains `DENSITY_CANON_THROUGH_DEPTH` (2), `FOE_GRACE_AT_1`/`AT_2`/`CANON_FROM_DEPTH` (1.0 / 0.75 / 5), and `HAZARD_FROM_DEPTH`/`SCALE_AT_START`/`FLAT_THROUGH_DEPTH`/`CANON_FROM_DEPTH` (2 / 0.5 / 3 / 5) — every field structurally identity outside its own band (floors 1-2 reproduce the prototype's exact `9+depth`/`depth-1`/`3+depth` formulas by construction; `FOE_GRACE_AT_1` and the hazard ramp's start depth keep floor 1 exactly canon). `ENCOUNTER_DOT_CAP` (24->15), `DARK_BLOB_CAP` (6->3), and `DARK_RADIUS_CAP` (9->7) ease the deeper floors. A new `scaleHazard()` helper is consumed post-draw by `engine/movement.js`'s fall damage and `engine/encounters.js`'s `springTrap`, each with a strict `=== 1` fast path. `engine/combat.js`'s `startCombat` now copies a foe's `dmgBonus` key whenever it is `!== 0` (was `> 0`), since a graced floor legitimately produces a negative bonus. Tests were restructured per the plan: `test/unit/combat-scaling.test.js` gained a `PHASE_27_PINS` object (the one place 27-03 edits numbers), `test/difficulty/difficulty.test.js`'s PARITY GUARD split into floors 1-2 (canon) and 3-5 (Phase 27 pins), and `test/unit/maze.test.js`/`encounters.test.js`/`movement.test.js` gained re-measured or new depth-2/5 pins.
- **Iteration 0 logged (Task 4):** ran the smoke harness in the background (`tools/tune-classes.mjs` natural + `--start-depth 20`, 143x3; `tools/tune-difficulty.mjs --seeds=200`) and recorded the pooled readout in `docs/DIFFICULTY-RETUNE.md`: natural pooled `p50Depth` 3, `reach5` 23.3% (up from Phase 26's 17.2%); forced-20 pooled `meanEncountersSurvived` 1.56 (up from 1.32), `meanFloorsGained` 0.37 (up from 0.14). "Cut down by a Dante" no longer appears in the pooled top-3 death causes (it was Phase 26's #1 cause at scale). The planner's per-lever calibration table was copied verbatim into a new `#### Planner calibration` sub-heading, with an honest note that the ladder's ceiling (bot median 4, reach5 ~35%) is not fully reached at this smoke scale and that reaching it is 27-03's job.

## Task Commits

Each task was committed atomically:

1. **Task 1: Demote Dante (Form C), re-measure pins, voice scan** - `5621e89` (feat)
2. **Task 2: Declare seed-303 divergence, regenerate FIXTURE-INVENTORY, parity 33/33** - `bd76a52` (test)
3. **Task 3: Land early-floor lever fields, consumers, restructured tests** - `8e83150` (feat)
4. **Task 4: Iteration-0 smoke and ledger entries** - `cd54255` (docs)

_Note: no separate plan-metadata commit — this SUMMARY plus the final `docs(27-02): ...` commit close out the plan per the orchestrator's final-commit step._

## Files Created/Modified

- `content/bestiary.js` - Dante moved to end of Humans tier 2 (byte-identical); Ned added at tier 1; DELIBERATE RULES CHANGE block with the sim numbers; header comment superseded for Dante
- `content/BESTIARY-REBALANCE.md` - Phase 27 addendum appended to the Change ledger; the `<!-- yardstick:after -->` block regenerated (54 rows)
- `test/unit/content-tables.test.js` - tier lengths/row counts/byte-identical-Dante-at-T2 pins re-measured
- `test/unit/bestiary-yardstick.test.js` - row count, fixture-row filter (Ned, not Dante), Dante@T2 wp assertion
- `test/unit/foe-turn-draw-count.test.js` - seed-303 `FULL_FIGHTS` row (Ned x2), `FIXTURE_NAMES` list
- `test/unit/parley.test.js` - Test 14's foe-name assertion (Ned)
- `test/parity/fixture-inventory.test.js` - roster/name pins updated to Ned (wp 8)
- `test/determinism/foe-abilities.test.js` - `humans-t2` spec seed 1->3; `FULL_FIGHT_PINS`/`PER_VISIT_PINS` re-measured twice (Dante move, then foe grace)
- `test/parity/fixtures/action-script.combat.json` - the seed-303 `parley` scenario's `divergence` record
- `test/parity/FIXTURE-INVENTORY.md` - roster block regenerated; new "## Phase 27 early-floor divergences" section
- `engine/difficulty.js` - the Phase 27 fields, restructured dots/darkness, `scaleHazard()`, `graceFor()`
- `engine/combat.js` - `dmgBonus !== 0` copy condition
- `engine/movement.js` - `scaleHazard` import + fall-damage consumer
- `engine/encounters.js` - `difficultyCurve`/`scaleHazard` import + `springTrap` consumer
- `test/difficulty/difficulty.test.js` - PARITY GUARD split (1-2 canon / 3-5 Phase 27 pins); named constants; hazardScale test
- `test/unit/combat-scaling.test.js` - `PHASE_27_PINS`, floor-1/grace-band/identity-band tests, new helper pins, negative-dmgBonus startCombat test
- `test/unit/maze.test.js` - seed-42 dot counts re-measured for depths 3-5
- `test/unit/encounters.test.js` - depth-2/depth-5 `springTrap` hazard siblings
- `test/unit/movement.test.js` - depth-2/depth-5 climb/gorge-fall hazard siblings
- `docs/DIFFICULTY-RETUNE.md` - "### Dante demotion — landed (27-02)" and "### Iteration log" filled in

## Decisions Made

- **Landed Form C exactly as specified** (the plan's own calibration showed it is the only form meeting the decision rule) rather than exploring the smaller A/B/A+B forms.
- **Followed Task 3's literal dial values** (`FOE_GRACE_AT_2` 0.75, not the calibration table's "T2 — strongest parity-clean set" row's 0.5) since the task's action items and its own automated verify script are unambiguous and machine-checked; the calibration table is directional/illustrative of the ladder, not a set of interchangeable landing instructions.
- **Normalized `foeDmgBonusFor`'s `-0` rounding result to `0`** (via `|| 0`) after a strict-equality test caught `Math.round(-0.25) === -0` — the engine-side fix avoids leaking a negative-zero footgun to any future consumer, not just the failing test.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `foeDmgBonusFor` could return `-0`, breaking strict-equality comparisons**
- **Found during:** Task 3 (writing the new helper-pin tests in `test/unit/combat-scaling.test.js`)
- **Issue:** `Math.round((curve.foePower - 1) * lvl * lvl)` at a mild grace (e.g. `foePower: 0.75`, `lvl: 1`) evaluates to `Math.round(-0.25)`, which is `-0` in JavaScript — `assert.equal(foeDmgBonusFor(1, {foePower:0.75}), 0)` under `node:assert/strict` (which uses `Object.is` semantics) failed even though `-0 !== 0` already correctly gates the `dmgBonus` key out of the foe object in `engine/combat.js`.
- **Fix:** Added `|| 0` to `foeDmgBonusFor`'s return expression, normalizing any `-0` result to plain `0`.
- **Files modified:** `engine/difficulty.js`
- **Verification:** `node --test test/unit/combat-scaling.test.js` (the "synthetic-curve helper pins" test) passes; the `dmgBonus !== 0` copy gate in `engine/combat.js` was already correct either way (unaffected by this fix).
- **Committed in:** `8e83150` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** A one-line engine normalization fix caught by the plan's own newly-written test pins; no scope creep, no content/gameplay-numbers change.

## Issues Encountered

- The plan's Task 3 verify script's grep assertion (`grep -c "scaleHazard(" <file>` expected to print `2` "the import line and the call") does not match reality: the import statement (`import { difficultyCurve, scaleHazard } from "./difficulty.js";`) has no `(` immediately after `scaleHazard`, so the literal grep pattern only matches the one call site, printing `1` in both `engine/movement.js` and `engine/encounters.js`. This is a minor imprecision in the plan's own verify-script wording, not a defect in the landed code — both files correctly import `scaleHazard` once and call it exactly once at the correct consumer site (confirmed via `grep -n "scaleHazard" <file>`, which shows the import line + one call line in each).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `engine/difficulty.js`'s `PHASE_27_PINS` (in `test/unit/combat-scaling.test.js`) is the ONE place 27-03 edits Phase 27 dial numbers per iteration; the four pre-enumerated escalation records in `FIXTURE-INVENTORY.md`'s Phase 27 section give 27-03 the exact record shape and wiring for each rung of the ladder (hazard-from-1, darkness-from-4, rations+N, floor-1-grace) if it ever needs to climb past the parity-clean set landed here.
- **Flag for 27-03:** Iteration 0's smoke (pooled natural `reach5` 23.3%, `tune-difficulty` `p50` 3) has NOT yet reached the amended band's "bot median 4, reach>=5 >= 25%" target at this smoke scale (143x3/200 seeds) — this is expected per the planner's own calibration (the parity-clean set measures ≈23-25% depending on exact combination). 27-03 must confirm this reading at full scale (143x40 natural, 143x10 forced-20) before deciding whether/how far to escalate; per the ledger's own rule, a median miss after the escalation cap is a RECORDED outcome, not a reason for a fifth iteration.
- Deep combat dials (`COMBAT_SCALE_FROM_DEPTH`, `FOE_CAP_MAX`, `FOE_POWER_MAX`, `ABILITY_THREAT_MAX`) are completely untouched by this plan and remain 27-03's to turn for the forced-20 band.
- No engine file outside `engine/difficulty.js`/`combat.js`/`movement.js`/`encounters.js` changed; `engine/character.js`, `content/races.js`, `tools/lib/tuning-bot.mjs`, and `test/parity/prototype-master.js.txt`/`harness/comparables.js` are all byte-identical to their pins (verified via `git diff --quiet` in each task).

---
*Phase: 27-delve-to-death-retune*
*Completed: 2026-09-15*

## Self-Check: PASSED

All 21 files (the 20 listed above plus this SUMMARY) confirmed present on disk; all 4 task commit hashes (5621e89, bd76a52, 8e83150, cd54255) confirmed present in `git log --oneline --all`.
