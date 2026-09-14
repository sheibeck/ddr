---
phase: 21-consolidated-difficulty-retune
plan: 04
subsystem: engine
tags: [difficulty-curve, tuning-harness, retune, node-test, ledger, background-readout]

requires:
  - phase: 21-consolidated-difficulty-retune (plan 01)
    provides: "the shared bot module (tools/lib/tuning-bot.mjs), --party flag, and the frozen BEFORE half of docs/DIFFICULTY-RETUNE.md"
  - phase: 21-consolidated-difficulty-retune (plan 02)
    provides: "the identity-valued combat-scaling knobs (foeCap/foeBonus/foeLvlBias/foePower/abilityThreat) wired into startCombat/foeAbilities.js, proven inert at every depth"
provides:
  - "engine/difficulty.js: FOE_CAP_MAX 3->5, FOE_POWER_MAX 1.0->1.6, ABILITY_THREAT_MAX 1.0->2.0 (iteration 1); FOE_POWER_SOFT_K 25->35, ABILITY_THREAT_SOFT_K 20->30 (iteration 2, D-11's directed median/p90 fix); a DELIBERATE RULES CHANGE (Phase 21, TUNE-03) block naming the ledger"
  - "test/unit/combat-scaling.test.js: retuned constant pins, depth-6 first-divergence test, cap-reached test, startCombat multi-foe-at-depth-30 test (15 tests total)"
  - "test/unit/combat.test.js: [Rule 1 fix] the pre-existing high-depth foe-count regression's stale <=3 ceiling updated to <=FOE_CAP_MAX"
  - "docs/DIFFICULTY-RETUNE.md: complete change table, two-iteration log, six verbatim AFTER transcripts (3 per iteration), Comparison vs D-09 with per-target verdicts, Not-changed-and-why — the 21-04 half of the ledger, finalized"
affects: [21-05]

tech-stack:
  added: []
  patterns:
    - "D-11's two-iteration cap as a genuine stopping discipline: iteration 2 applied the plan's own directed knob (raise SOFT_K), confirmed it had no effect via a real re-run (not assumed), and recorded the honest reading rather than chasing a third iteration"
    - "Deviation-as-technical-finding: when a plan's own 'what to turn' guidance (lower ENCOUNTER_DOT_CAP) would risk fixture regeneration for zero structural benefit, the finding is written into the ledger as 'assessed and declined' with the concrete math, not silently skipped"

key-files:
  created: []
  modified:
    - engine/difficulty.js
    - test/unit/combat-scaling.test.js
    - test/unit/combat.test.js
    - docs/DIFFICULTY-RETUNE.md

key-decisions:
  - "Iteration 1 landed the three MAX dials at the RESEARCH.md-illustrative values (FOE_CAP_MAX=5/k=20, FOE_POWER_MAX=1.6/k=25, ABILITY_THREAT_MAX=2.0/k=20) unchanged from 21-02's example — the readout gave no signal to deviate from them"
  - "Iteration 2 raised FOE_POWER_SOFT_K (25->35) and ABILITY_THREAT_SOFT_K (20->30) per the plan's own 'median<8/p90<25 -> raise SOFT_K before lowering a MAX' guidance; the re-run readout was byte-for-byte unchanged from iteration 1 (within seed-level noise), confirming rather than refuting the iteration-1 reading"
  - "ENCOUNTER_DOT_CAP (the plan's 'actions-per-floor>80' candidate fix) was assessed and explicitly NOT applied: it is not identity-gated at depth<=5 the way the new combat fields are, and lowering it (e.g. 24->20) was verified numerically to change dots(3) from 12 to 11 — which would shift which depth-1..5 cells receive dot/tele/chest/trap/climb/gorge features, risking exactly the fixture regeneration this plan prohibits, for a metric (median actions/floor) that is provably dominated by depth<=5 runs a depth>5 knob cannot move anyway"
  - "Neither conditional counterweight fired in either iteration: tune-economy peakGold p50 stayed at 249 (trigger is >5000); --party death-depth p50 (3) never exceeded 1.5x solo p50 (4.5) (trigger is >1.5x). lootDepth and memberUpkeepScale were therefore never added — engine/encounters.js, engine/combat.js, and engine/movement.js are byte-unchanged since BASE"
  - "[Rule 1 - Bug] test/unit/combat.test.js's pre-existing 03-02-era high-depth regression test hard-coded foes.length<=3, which the iteration-1 constant change (FOE_CAP_MAX=5) directly broke (a depth-1000 encounter can now legitimately build 5 foes) — fixed by importing FOE_CAP_MAX and asserting <=FOE_CAP_MAX instead of the stale literal, plus rewording the now-inaccurate 'combat.js is intentionally UNMODIFIED' comment"

requirements-completed: [TUNE-03]

coverage:
  - id: D1
    description: "the ONE retune is committed with the change table, <=2 iteration entries, and the three AFTER readouts (solo/--party/economy, 200 seeds, IDENTICAL bot parameters to BEFORE) transcribed verbatim per iteration, followed by a comparison vs the four D-09 targets with a met/missed verdict per target"
    requirement: "TUNE-03"
    verification:
      - kind: other
        ref: "docs/DIFFICULTY-RETUNE.md: Change table, Iteration log (2 entries, 'Iteration 3' absent), six AFTER transcripts, Comparison vs D-09 table"
        status: pass
      - kind: unit
        ref: "grep 'Bot: exploreBudget' docs/DIFFICULTY-RETUNE.md | sort by party=on/off: 6 identical party=off lines, 3 identical party=on lines across BEFORE/AFTER1/AFTER2"
        status: pass
    human_judgment: false
  - id: D2
    description: "FOE_CAP_MAX/FOE_POWER_MAX/ABILITY_THREAT_MAX are strictly above BASE; difficultyCurve(5) is exact identity, difficultyCurve(6) has diverged, difficultyCurve(1..5) deep-equals the identity object, foeCap reaches FOE_CAP_MAX by depth<=100, foeBonus===foeCap-3 everywhere"
    requirement: "TUNE-03"
    verification:
      - kind: unit
        ref: "test/unit/combat-scaling.test.js#depth-6 first divergence (D-19); #the caps are reached; #cap boundaries"
        status: pass
      - kind: other
        ref: "node -e dials-ok one-liner from the plan's own acceptance criteria"
        status: pass
    human_judgment: false
  - id: D3
    description: "every constant change is identity at depth<=5 — D-15 seeds, FID-02 pins, and the parity suite (30/30) pass with ZERO edits; no flat fixture-path constant (LOOT_DIVISOR, purse table, base prices) changes"
    requirement: "TUNE-03"
    verification:
      - kind: integration
        ref: "node --test \"test/parity/**/*.test.js\" (30/30)"
        status: pass
      - kind: unit
        ref: "test/determinism/foe-abilities.test.js, test/unit/foe-turn-draw-count.test.js — byte-unchanged since 04eb229"
        status: pass
      - kind: other
        ref: "git diff --quiet 04eb229 -- test/parity/prototype-master.js.txt test/parity/fixtures test/determinism/foe-abilities.test.js test/unit/foe-turn-draw-count.test.js"
        status: pass
    human_judgment: false
  - id: D4
    description: "the economy trigger (tune-economy peakGold p50 > 5000) and the party trigger (--party p50 > 1.5x solo p50) are checked against real readouts; neither fired in either iteration, so lootDepth and memberUpkeepScale were never added, and this is recorded honestly in the ledger with the numbers"
    requirement: "TUNE-03"
    verification:
      - kind: other
        ref: "docs/DIFFICULTY-RETUNE.md#Not changed, and why — economy peakGold p50=249 (both iterations), party p50=3 vs solo p50=3 (both iterations)"
        status: pass
      - kind: other
        ref: "git diff --quiet BASE -- engine/encounters.js engine/combat.js engine/movement.js (all clean)"
        status: pass
    human_judgment: false
  - id: D5
    description: "npm test fully green (951/951), parity 30/30, frozen files untouched, the 21-03 dev path and tuning tools not modified"
    requirement: "TUNE-03"
    verification:
      - kind: unit
        ref: "npm test (951/951)"
        status: pass
      - kind: other
        ref: "git diff --quiet 80dc513 -- tools content engine/items.js engine/economy.js engine/state.js engine/saveState.js src mazeworld.html test/parity/harness/comparables.js package.json package-lock.json"
        status: pass
    human_judgment: false

duration: 70min
completed: 2026-09-14
status: complete
---

# Phase 21 Plan 4: Consolidated Difficulty Retune (TUNE-03) Summary

**Retuned `engine/difficulty.js`'s combat-scaling dials (`FOE_CAP_MAX=5`, `FOE_POWER_MAX=1.6`, `ABILITY_THREAT_MAX=2.0`) across two harness iterations against six 200-seed background readouts, confirmed the dials work correctly at depth 6-50 but that the upgraded bot's own shallow-survival ceiling (99.5% of runs die by floor 10) prevents the D-09 sanity-floor targets from moving — three of four targets are recorded as honestly missed and handed to the human DR round (21-05), with neither conditional counterweight (economy `lootDepth`, party `memberUpkeepScale`) firing.**

## Performance

- **Duration:** ~70 min (includes ~25 min of bounded-poll waiting across six 200-seed background readouts)
- **Completed:** 2026-09-14
- **Tasks:** 2 completed
- **Files modified:** 4 (`engine/difficulty.js`, `test/unit/combat-scaling.test.js`, `test/unit/combat.test.js`, `docs/DIFFICULTY-RETUNE.md`)

## Accomplishments

- **Iteration 1:** Set `FOE_CAP_MAX=5` (D-02: bigger fights deep, ≈4 foes by the mid-teens, ≈5 by the low thirties), `FOE_POWER_MAX=1.6` (D-02: ≈+35% hp/damage at depth 20, ≈+50% at 40), `ABILITY_THREAT_MAX=2.0` (D-03: a caster's `every:2` becomes every-visit from ≈depth 25). Added a "DELIBERATE RULES CHANGE (Phase 21, TUNE-03, D-09/D-11)" block above the constant group naming the ledger. Rewrote `test/unit/combat-scaling.test.js`'s constant pins and added three new tests: depth-6 first-divergence (identity ends exactly at depth 5), cap-reached (foeCap hits FOE_CAP_MAX by depth 100; foePower/abilityThreat within 0.05 of MAX by depth 200), and a `startCombat` test proving a depth-30 encounter with canon roll 3 builds more than 3 foes when `foeBonus >= 1` (15 tests total, all passing).
- Ran the three iteration-1 AFTER readouts (`tune-difficulty --seeds=200`, `--seeds=200 --party`, `tune-economy --seeds=200`) as backgrounded processes with `EXIT=<code>` sentinels, polled in bounded checks. Result: death-depth p50=3/p90=5 (solo), byte-for-byte identical to BEFORE. Reach table: 0.5% of solo runs and 2.0% of `--party` runs ever hit floor 10; 0% ever hit floor 20+.
- **Iteration 2 (final):** Per D-11's own "median<8/p90<25 -> raise SOFT_K before lowering a MAX" guidance, raised `FOE_POWER_SOFT_K` 25->35 and `ABILITY_THREAT_SOFT_K` 20->30 (slower ramp), updated the test pins, re-ran all three readouts. Result: every number unchanged from iteration 1 within normal seed-level noise (party max 15->12; a couple of caster-band sample counts shifted by 1-3 at n<25) — confirming, not refuting, the iteration-1 reading.
- **The structural finding (the ledger's core contribution):** the retuned dials are identity through depth 5 by construction (D-19) and only 0.5-2.0% of runs ever survive to depth 10 — a dial that only diverges from identity past floor 5 cannot move a death-depth distribution whose median/p90 sit at floors 3/5-6. Verified the dials DO work correctly where they can act (`difficultyCurve(30)`: foeCap=4, foePower≈1.38, abilityThreat≈1.71 — all pinned in `test/unit/combat-scaling.test.js`); the gap is bot survivability, not dial inertness.
- **Assessed and declined `ENCOUNTER_DOT_CAP`** (the plan's own "actions-per-floor>80" candidate fix): verified numerically that lowering it (e.g. 24->20) changes `dots(3)` from 12 to 11, which would shift which depth-1..5 cells receive `dot`/`tele`/`chest`/`trap`/`climb`/`gorge` features — risking exactly the fixture regeneration this plan prohibits — for a metric (median actions/floor, dominated by depth<=5 runs) a depth>5 knob structurally cannot move regardless. Documented as a reasoned "assessed and declined" ledger entry rather than silently skipped.
- **Neither conditional counterweight fired:** economy trigger (tune-economy `peakGold p50 > 5000`) — actual p50 stayed at 249 in both iterations. Party trigger (`--party` p50 > 1.5x solo p50) — actual 3 vs. 4.5 required, both iterations. `lootDepth` and `memberUpkeepScale` were never added; `engine/encounters.js`, `engine/combat.js`, and `engine/movement.js` are byte-unchanged since BASE.
- Finalized `docs/DIFFICULTY-RETUNE.md`'s Comparison vs D-09 table (per-target BEFORE/iteration-1/iteration-2 numbers and a met/missed verdict), and the Not-changed-and-why section (store price scaling, hire cost, `LOOT_DIVISOR`/purse table, bestiary base stats, summoned reinforcements, class/race/sub features, the resolved parley-Humans amount, and the declined `ENCOUNTER_DOT_CAP`).

## Task Commits

Each task was committed atomically:

1. **Task 1: Iteration 1 — set the combat dials, update the curve tests, take the three AFTER readouts, record the change table + iteration-1 comparison** - `7363202` (feat)
2. **Task 2: Iteration 2 (final) — raise the directed SOFT_K knob, re-take the readouts, finalize the ledger's Comparison vs D-09 and Not-changed-and-why** - `79e5446` (docs)

## Files Created/Modified

- `engine/difficulty.js` - `FOE_CAP_MAX`/`FOE_POWER_MAX`/`ABILITY_THREAT_MAX` retuned (iteration 1); `FOE_POWER_SOFT_K`/`ABILITY_THREAT_SOFT_K` raised (iteration 2); DELIBERATE RULES CHANGE block
- `test/unit/combat-scaling.test.js` - retuned constant pins, 3 new tests (depth-6 divergence, caps-reached, depth-30 multi-foe), SOFT_K pins updated for iteration 2 (15 tests total)
- `test/unit/combat.test.js` - [Rule 1 fix] the pre-existing high-depth regression's `foes.length<=3` assertion updated to `<=FOE_CAP_MAX`
- `docs/DIFFICULTY-RETUNE.md` - complete change table, two-iteration log, six AFTER transcripts, Comparison vs D-09, Not-changed-and-why

## Decisions Made

- Iteration 1 kept the RESEARCH.md-illustrative dial values (`FOE_CAP_MAX=5`/k=20, `FOE_POWER_MAX=1.6`/k=25, `ABILITY_THREAT_MAX=2.0`/k=20) unchanged — the readout gave no signal to deviate.
- Iteration 2 applied ONLY the plan's own directed "raise SOFT_K" fix for the median/p90 misses (25->35, 20->30) — a safe, identity-preserving, low-risk adjustment — and re-ran the readout to CONFIRM rather than assume its (lack of) effect.
- `ENCOUNTER_DOT_CAP` was deliberately NOT touched: verified it would risk depth-1..5 fixture regeneration for zero structural benefit on the actions-per-floor metric (which is dominated by depth<=5 runs regardless of any depth>5 knob).
- Neither `lootDepth` nor `memberUpkeepScale` was added — both conditional triggers stayed cold in both iterations, confirmed against real numbers, not assumed.
- `test/unit/combat.test.js`'s stale `foes.length<=3` assertion was fixed to `<=FOE_CAP_MAX` (Rule 1) since it directly encoded the pre-retune ceiling this plan deliberately raises.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `test/unit/combat.test.js`'s high-depth regression test hard-coded the pre-retune foe-count ceiling**
- **Found during:** Task 1, running `npm test` after setting `FOE_CAP_MAX=5`
- **Issue:** A pre-existing test from the 03-02 endless-descent phase (`"startCombat: foe tier and count clamps stay bounded at arbitrarily large floor.depth"`) asserted `started.foes.length <= 3` — the OLD canon ceiling. Raising `FOE_CAP_MAX` to 5 (this plan's whole point, D-02) makes a depth-1000 encounter legitimately build up to 5 foes, so the test failed (951 tests, 1 failing) the moment the constant changed.
- **Fix:** Imported `FOE_CAP_MAX` from `engine/difficulty.js` and changed the assertion to `started.foes.length <= FOE_CAP_MAX`, so the test tracks the current (deliberately-changed) ceiling instead of a stale literal. Reworded the test's header comment, which claimed "`engine/combat.js` is intentionally UNMODIFIED this phase" — no longer true since 21-02/21-04.
- **Files modified:** `test/unit/combat.test.js` (import line + one assertion + one comment block)
- **Verification:** `node --test test/unit/combat.test.js` (89/89); `npm test` returned to 951/951.
- **Committed in:** `7363202` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary for `npm test` to stay green after the deliberate constant change this plan makes; outside the plan's declared `files_modified` list, but the breakage was directly caused by Task 1's own edit and is exactly the kind of fix Rule 1 exists for. No scope creep — a one-line assertion and one comment.

## Issues Encountered

The three D-09 targets that missed (median death depth, p90 death depth, median actions per floor) were investigated analytically before committing to a second iteration: since the retuned dials are identity through depth 5 by construction (D-19) and the upgraded bot's own BEFORE readout already showed 99.5%+ of runs dying by floor 10, no depth-6+ knob can move a distribution whose median/p90 sit at floors 3/5. This was CONFIRMED (not assumed) by actually running the directed iteration-2 fix (raising `FOE_POWER_SOFT_K`/`ABILITY_THREAT_SOFT_K`) and observing the readout was unchanged within noise — the honest, plan-compliant way to reach D-11's two-iteration stopping point rather than skip iteration 2 on the strength of the analysis alone.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The retune is complete within its two-iteration budget (D-11): dials landed with rationale, both conditional counterweights checked and declined with real numbers, the ledger's Comparison vs D-09 and Not-changed-and-why sections are honest about the three missed targets, and `npm test` (951/951), parity (30/30), and every frozen-file gate hold.
- **21-05 (the DR round) is unblocked and is exactly where this plan's findings point:** the bot proxy structurally cannot exercise the depth 6-50 scaling because it rarely survives that far — the human DR round via the 21-03 dev start-at-depth toggle (floors 20/35/50) bypasses this ceiling entirely and is the real verdict on whether the retuned dials feel right. If the DR round says "tune again" (D-16), that follow-up edits only these constants plus a ledger addendum — no re-plan.
- No blockers.

---
*Phase: 21-consolidated-difficulty-retune*
*Completed: 2026-09-14*
