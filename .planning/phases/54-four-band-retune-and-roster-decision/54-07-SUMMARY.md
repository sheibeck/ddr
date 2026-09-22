---
phase: 54-four-band-retune-and-roster-decision
plan: 07
subsystem: difficulty-model
tags: [fit, coordinate-search, after-readout, per-floor-survival, change-table, miss-table, round-damage-ceiling, roster, damage-curve-audit, bestiary-addendum, parity-declared, ledger, user-ruling-g, cycle-3]

# Dependency graph
requires:
  - phase: 54-four-band-retune-and-roster-decision
    plan: 06
    provides: "the fit tool (tools/fit-difficulty.mjs, tools/lib/fit-score.mjs), fit/start.json, every dial's engine hook"
provides:
  - "engine/difficulty.js#DIALS at the fitted, evaluated values (fit/fit-log.jsonl #13, score 2.7113, PASS) — every searched key cites the log line, every held key marked 'held (available)'"
  - "engine/difficulty.js#DOT_HP_BASE — the Table-4 HP-dot compounding fix (USER RULING G): a flat canon table scaled once by HERO_HP_SCALE, replacing 54-05's DOT_HP_FRACTION"
  - "tools/lib/fit-resume.mjs — the pure, engine-free replay/resume machinery (readLog/appendLog/makeResumableEvaluate/walkCoordinate/runSearch), fixing the Infinity/null replay bug"
  - "tools/lib/fit-score.mjs — classConstraints loosened (p50 2.0 floors, reach5 20 points); SEARCH_PLAN back to the core 10 (spellPower dropped, proved a no-op)"
  - "test/unit/harness/identityDials.js — the shared IDENTITY_DIALS literal + setIdentityDials()/withIdentity() every non-difficulty-curve unit test file now uses, since DIALS itself ships fitted, not identity"
  - "the fitted parity set: 31 chargenDivergence + 17 floorFeatureShift (new record kind) + 9 action-path divergence holders, declared and regenerated across all six fixture files"
  - "tools/damage-curve-audit.mjs re-keyed to the global model (hitScaleForBand/tierReachableFloors replace the retired flat dmgBonusForBand; critMax clamped by roundDamageCapFor)"
  - "the roster-under-the-ceiling decision (TUNE-08): Herman/Drarl/Vampire/Djinni/Drake all stay, capped by ROUND_DAMAGE_CEILING; no bestiary.js edit"
  - "docs/DIFFICULTY-RETUNE.md's Phase 54 ledger close-out (Fit/AFTER/Tail/Change table/Miss table/Roster/Depth-20 slice/Parity)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "a shared IDENTITY_DIALS test harness (test/unit/harness/identityDials.js) lets every pre-existing unit test that pins a canon/identity numeric outcome for an engine mechanic run under an EXPLICIT setDialsForTuning override, since DIALS itself now ships fitted rather than identity — setDialsForTuning's own restore() always resets to (fitted) DIALS, never to a previous override, so any file combining a module-level identity default with its own further override must use withIdentity() (which resets to IDENTITY_DIALS) rather than the raw returned restore()"
    - "a NEW parity record kind, floorFeatureShift, declares a deterministic feature-CELL remap (never new randomness) that a difficulty-curve dial can cause in genFloor's feature-scatter loop — applied identically (and locally, per test file, to keep test/parity/harness/comparables.js untouched) on both sides of a comparison before every diffState call"
    - "the fit tool's replay/resume logic (walkCoordinate/runSearch/readLog/appendLog/rehydrateRow) lives in a PURE, engine-free tools/lib/fit-resume.mjs so it is unit-testable without worker_threads or the engine — the CLI (tools/fit-difficulty.mjs) wires it against the real worker-threaded evaluator"

key-files:
  created:
    - tools/lib/fit-resume.mjs
    - test/unit/fit-resume.test.js
    - test/unit/harness/identityDials.js
    - .planning/phases/54-four-band-retune-and-roster-decision/fit/fit-log.jsonl
    - .planning/phases/54-four-band-retune-and-roster-decision/fit/fit-log.md
    - .planning/phases/54-four-band-retune-and-roster-decision/fit/best.json
    - .planning/phases/54-four-band-retune-and-roster-decision/fit/fit-log-block3.jsonl
    - .planning/phases/54-four-band-retune-and-roster-decision/fit/best-block3.json
    - .planning/phases/54-four-band-retune-and-roster-decision/fit/search-stdout-block3.txt
    - .planning/phases/54-four-band-retune-and-roster-decision/readouts/global-after-solo.txt
    - .planning/phases/54-four-band-retune-and-roster-decision/readouts/global-after-party.txt
    - .planning/phases/54-four-band-retune-and-roster-decision/readouts/global-after-start-depth-20.txt
    - .planning/phases/54-four-band-retune-and-roster-decision/readouts/global-after-solo-1000.txt
    - .planning/phases/54-four-band-retune-and-roster-decision/readouts/global-after-start-depth-10.txt
    - .planning/phases/54-four-band-retune-and-roster-decision/readouts/global-after-smoke.txt
    - docs/class-pass/v17-p54-global-after-smoke.json
  modified:
    - engine/difficulty.js
    - engine/encounters.js
    - tools/lib/fit-score.mjs
    - tools/fit-difficulty.mjs
    - tools/damage-curve-audit.mjs
    - tools/damage-curve-audit-output.txt
    - test/difficulty/difficulty.test.js
    - test/unit/encounters.test.js
    - test/unit/bot-tactics.test.js
    - test/unit/fit-score.test.js
    - test/unit/combat-scaling.test.js
    - test/unit/store-roll.test.js
    - test/unit/class-mitigation.test.js
    - test/unit/movement.test.js
    - test/unit/chargen-rng-pin.test.js
    - test/unit/foe-turn-draw-count.test.js
    - test/determinism/foe-abilities.test.js
    - test/determinism/same-seed-same-result.test.js
    - "18 more test/unit/*.test.js files (combat, abilities, characterSheetViewModel, fluency, foe-crit-curve, freeze-pays-out, gear-axes, identity-contract, item-wiring, loot-pile, maze, parley, party-abilities, party-combat, rations-audit, shell-tab-snapshots, spell-mechanics, tuning-bot) — each gains a single setIdentityDials() call at module load, no assertion changes"
    - test/parity/fixtures/action-script.chargen.json
    - test/parity/fixtures/action-script.combat.json
    - test/parity/fixtures/action-script.magic.json
    - test/parity/fixtures/action-script.movement.json
    - test/parity/fixtures/action-script.economy.json
    - test/parity/fixtures/action-script.encounters.json
    - test/parity/divergence-records.test.js
    - test/parity/chargen-parity.test.js
    - test/parity/movement-parity.test.js
    - test/parity/combat-parity.test.js
    - test/parity/magic-parity.test.js
    - test/parity/economy-parity.test.js
    - test/parity/full-suite.test.js
    - test/parity/fixture-inventory.test.js
    - test/parity/FIXTURE-INVENTORY.md
    - tools/initiative-fixture-scan-output.txt
    - content/BESTIARY-REBALANCE.md
    - docs/DIFFICULTY-RETUNE.md

key-decisions:
  - "Cycle 3's block-1 search (budget 10, fresh from fit/start-block3.json = the cycle-2 best) converged with ZERO class-fairness rejections (vs cycle 1's 22/25, cycle 2's 7/9) once USER RULING G's Adjustment 2 (the engine fix) and Adjustment 3 (the loosened guardrails) landed — confirming the ORIGINAL diagnosis (a real engine bug plus over-tight tolerances, not a fundamentally infeasible search space)"
  - "The fit stops at the FIRST PASS+ok candidate (evaluation #13, score 2.7113) rather than running the full budget, per the tool's own design (runSearch returns immediately on a PASS) — 10 of block 2's 20-budget went unused; this is the intended 'run out the budget only when converging... print it out' behavior from USER RULING F, satisfied here by an early clean PASS rather than a budget exhaustion"
  - "test/parity/harness/comparables.js is a HARD engine-gate file (per 54-CONTEXT.md's own 'comparables.js untouched' clause) — the applyFloorFeatureShift helper needed by 5 parity test files is therefore duplicated LOCALLY in each file (movement-parity.test.js, combat-parity.test.js, magic-parity.test.js, economy-parity.test.js, full-suite.test.js) rather than added once to the shared harness; an earlier attempt that added it to comparables.js was caught by the gate check and reverted before committing"
  - "The ~100 pre-existing unit-test failures caused by DIALS shipping fitted (not identity) values are NOT re-pinned to the fitted numbers — they are run under an explicit test/unit/harness/identityDials.js override instead, preserving every existing pin's original intent (these files test canon MECHANICS — chest gold, trap damage, kill XP splits — orthogonal to the difficulty-curve fit, not the fit itself)"
  - "damage-curve-audit.mjs's roster-table tier selection: Herman/Drarl/Vampire/Djinni are recorded at TIER 5 (Vampire has no tier-4 row; the other three are identical stat blocks at both tiers, and USER RULING B's own crit-% figures referenced tier 5), Drake at its only tier (4) — 'first floor' is the earliest floor where foeLevelFor(d) equals the tier or tier+1 (the d4 bleed), read off the FITTED FOE_LEVEL map, never a hand-picked number"

requirements-completed: [BAND-01, BAND-02, BAND-03, TUNE-08]

coverage:
  - id: SC1
    description: "The Ruling C per-floor survival curve is the live target the fit is scored against"
    requirement: "BAND-01"
    verification:
      - kind: unit
        ref: "tools/lib/fit-score.mjs#scoreSurvival scores floors 1-12 against TARGET_S_1_25 (transcribed from 54-CONTEXT.md's USER RULING C table); test/unit/fit-score.test.js"
        status: pass
      - kind: other
        ref: "fit/fit-log.jsonl #13: verdict PASS, misses: []; the AFTER solo (200-seed) readout's own verdict line: 'all floors 1-12 inside the pass band'; the 1000-seed tail independently confirms all 12 floors PASS"
        status: pass
    human_judgment: false
  - id: SC2
    description: "The global dials ship at the evaluated values, cited to the fit log; every other dial held and marked so; no floor-range constant; no MAZE_SIZE; parity measured and declared"
    requirement: "BAND-02"
    verification:
      - kind: unit
        ref: "test/difficulty/difficulty.test.js: 'DIALS deepStrictEqual the merge of the identity column and fit/best.json' (new pin, reads fit/best.json from disk)"
        status: pass
      - kind: other
        ref: "engine/difficulty.js DIALS JSDoc cites fit/fit-log.jsonl #13 on every one of the three fitted-and-moved keys (FOE_LEVEL, FOE_HIT_SCALE, FOE_HP_SCALE); every held key says 'held (available)'; test/parity/FIXTURE-INVENTORY.md's '### Fitted dials — measured set' section documents all three parity-declaration mechanisms"
        status: pass
    human_judgment: false
  - id: SC3
    description: "The AFTER lands inside the bands or each miss is recorded with its reason and the untaken move; the change table has a row per constant and dial"
    requirement: "BAND-03"
    verification:
      - kind: other
        ref: "docs/DIFFICULTY-RETUNE.md's Phase 54 H3: #### Fit / #### AFTER / #### Tail / #### Change table / #### Miss table sections (all 8 headings present, grep-verified); the Miss table's floors 1-12 row reads 'none — every floor 1-12 inside its band'; test/unit/difficulty-retune-ledger.test.js 33/33"
        status: pass
    human_judgment: false
  - id: SC4
    description: "The roster decision is recorded per creature under the ceiling, the depth-20 slice read as p_L, parity declared"
    requirement: "TUNE-08"
    verification:
      - kind: other
        ref: "content/BESTIARY-REBALANCE.md's Phase 54 addendum + docs/DIFFICULTY-RETUNE.md's #### Roster under the ceiling: 5 'stays — capped by ROUND_DAMAGE_CEILING' rows, the Ruling B supersession line; content/bestiary.js diff empty since 5550002"
        status: pass
    human_judgment: false
  - id: SC5
    description: "No bestiary edit; gates green throughout"
    requirement: "BAND-02/BAND-03"
    verification:
      - kind: other
        ref: "npm test 3479/3479 fail 0 at every commit; npm run build:www exit 0; master hash a1f4d0dc29782218d8e5aab65bc5989c33f917f0 unchanged; git diff --stat 02f394d -- content/bestiary.js tools/lib/tuning-bot.mjs test/parity/harness/comparables.js test/parity/prototype-master.js.txt empty at every commit"
        status: pass
    human_judgment: false

# Metrics
duration: ~9h (including ~100 min of backgrounded bot/search runtime)
completed: 2026-09-22
status: complete
---

# Phase 54 Plan 07: The Fit, the AFTER, the Roster Under the Ceiling (USER RULING G, cycle 3) Summary

**Cycle 3 of the checkpointed fit (USER RULINGS E/F/G) converged: after fixing the Table-4 HP-dot compounding bug and loosening the class-fairness guardrails, a 13-evaluation walk from the cycle-2 best found a full PASS (score 2.7113, every floor 1-12 inside its Ruling C tolerance band, zero class-pool rejections) — DIALS now ships the fitted values, the AFTER readout confirms the PASS at both 200 and 1,000 seeds, the damage-curve audit's 65 Phase-52 flags all clear under the round-damage ceiling, and Herman/Drarl/Vampire/Djinni/Drake all stay — capped, no bestiary edit.**

## Success criteria → proof

| # | Success criterion | Proof |
|---|---|---|
| SC1 (BAND-01) | The Ruling C curve is the live fit target; the AFTER lands PASS | `fit/fit-log.jsonl #13` verdict PASS; `readouts/global-after-solo.txt` verdict line "all floors 1-12 inside the pass band"; the 1000-seed tail independently confirms |
| SC2 (BAND-02) | DIALS ships the evaluated values; parity declared | `test/difficulty/difficulty.test.js`'s new `DIALS deepStrictEqual identity+best.json` pin; `engine/difficulty.js` JSDoc cites the log; `test/parity/FIXTURE-INVENTORY.md`'s Fitted-dials section |
| SC3 (BAND-03) | Change table + Miss table in the ledger | `docs/DIFFICULTY-RETUNE.md`'s 8 close-out H4s, all grep-verified present; `test/unit/difficulty-retune-ledger.test.js` 33/33 |
| SC4 (TUNE-08) | Roster recorded under the ceiling | `content/BESTIARY-REBALANCE.md`'s Phase 54 addendum; 5 `stays — capped` rows; `content/bestiary.js` untouched |
| SC5 (gates) | Green throughout, no forbidden-file edits | `npm test` 3479/3479 fail 0 at every commit; master hash unchanged; `content/bestiary.js`/`tools/lib/tuning-bot.mjs`/`test/parity/harness/comparables.js`/`prototype-master.js.txt` all empty-diffed since `5550002`/`02f394d` |

## The fit

**Start:** `fit/start-block3.json` (= the cycle-2 best, candidate #6 of `fit/fit-log-block1.jsonl`, score 10.83 under the pre-Adjustment-2 engine).

**Adjustment 2** (engine, commit `88b081e`): retires `DOT_HP_FRACTION` (a fraction of the hero's own CURRENT `maxWP`, which compounded — a "+25 HP" pull fed its own output into its next input, ≈×4 across three pulls). `dotHpFor(kind)` now reads `DOT_HP_BASE`'s flat canon table (10/15/25), scaled ONCE by `HERO_HP_SCALE`. Re-evaluating the cycle-2 best on this fixed engine (no dial change) moved its score 10.83 → 9.8073.

**Adjustment 3** (search, commit `6b48281`): (a) `classConstraints` tolerances loosened (`p50` 1.0→2.0 floors, `reach5` 12→20 points); (b) `SEARCH_PLAN`'s `spellPower` coordinate (Ruling F's cycle-2 addition) dropped again — proved a structural no-op; (c) the fit-tool replay-resume Infinity/null bug fixed in a new, pure `tools/lib/fit-resume.mjs`, with a dedicated regression test; (d) stdout append (`>>`) documented.

**Cycle 3 walk** (`fit/fit-log.jsonl` = `fit/fit-log-block3.jsonl`, 13 rows, one continuous walk across two `--budget` invocations): block 1 (budget 10) converged with ZERO class-fairness rejections and 10/12 floors in band by its own #2 (score 7.1327, 27% better than the block's own #1). Block 2 (budget 20, resumed) found a full **PASS at evaluation #13, score 2.7113**.

**Winning dials** (vs `fit/start-block3.json`, 3 of the core-10 coordinates moved, 7 unmoved):
```json
{
  "FOE_LEVEL": { "base": 0.9, "perDepth": 0.29 },
  "FOE_HIT_SCALE": { "base": 0.6, "perDepth": 0.01 },
  "FOE_HP_SCALE": { "base": 0.9, "perDepth": 0.015 },
  "HERO_HP_SCALE": 1.25, "HERO_REGEN_PER_FLOOR": 0.25, "HERO_SP_SCALE": 0.28,
  "HAZARD_SCALE": { "base": 0.6, "perDepth": 0.02 }, "ENCOUNTER_DOTS": { "base": 7, "perDepth": 0.3 },
  "ROUND_DAMAGE_CEILING": 0.5, "LOOT_SCALE": 0.8, "FOOD_CLOCK": 1.5, "CAMP_HEAL_FRACTION": 0.2, "FOE_COUNT_SKEW": 1
}
```
**Notches:** none — every cycle-3 candidate satisfied `constraints.ok` without a `CLASS_MITIGATION` adjustment.

## AFTER — key numbers

**Solo (200 seeds):** p50 7 (was 4 BEFORE, Phase 53 AFTER `78572c5`), p90 12 (was 6); reach ≥5 80.5% (was 33.0%), ≥10 23.6% (was 0.0%), ≥20 1.1% (was 0.0%). Verdict: **all floors 1-12 inside the pass band**.

**Per-floor table** (floors 1-12, 200 seeds; floors 13-20, 1000-seed tail, marked `tail`):

| Floor | p_L | S_L | target | dS | verdict/tail |
|---|---|---|---|---|---|
| 1 | 99.5% | 99.5% | 98.8% | +0.7 | PASS |
| 2 | 99.0% | 98.5% | 95.1% | +3.4 | PASS |
| 3 | 91.9% | 90.5% | 88.6% | +1.9 | PASS |
| 4 | 91.6% | 82.9% | 79.7% | +3.2 | PASS |
| 5 | 90.5% | 75.0% | 69.2% | +5.8 | PASS |
| 6 | 85.1% | 63.8% | 58.4% | +5.4 | PASS |
| 7 | 76.3% | 48.7% | 48.0% | +0.7 | PASS |
| 8 | 84.9% | 41.3% | 38.7% | +2.6 | PASS |
| 9 | 69.9% | 28.9% | 30.8% | -1.9 | PASS |
| 10 | 73.5% | 21.2% | 24.3% | -3.1 | PASS |
| 11 | 76.5% | 16.2% | 19.1% | -2.9 | PASS |
| 12 | 88.0% | 14.3% | 15.1% | -0.8 | PASS |
| 13 | 78.9% | 10.0% | 11.9% | -1.9 | tail |
| 14 | 80.9% | 8.1% | 9.5% | -1.4 | tail |
| 15 | 85.2% | 6.9% | 7.6% | -0.7 | tail |
| 16 | 82.6% | 5.7% | 6.2% | -0.5 | tail |
| 17 | 78.9% | 4.5% | 5.0% | -0.5 | tail |
| 18 | 72.4% | 3.3% | 4.2% | -0.9 | tail |
| 19 | 84.2% | 2.7% | 3.5% | -0.8 | tail |
| 20 | 93.3% | 2.6% | 3.0% | -0.4 | tail |

**Reach-20 (1000-seed tail):** 1.5% (vs the 3.0-5.0% band, reported not gated).

**Death-class shares** (200-seed solo, top causes): starved in the dark 10.5%, cut down by a Werebeast 7.5%, undone by a trap 6.0%, cut down by a Dante 4.5%, spent by the dungeon itself 4.5%.

**Class-pool p50s + constraints:** Fighter p50=7 reach5=82.3% (ok); Thief p50=8 reach5=88.7% (ok); Magic User p50=7 reach5=68.0% (ok) — all three satisfy the loosened (2.0-floor/20-point) constraints.

**Spread (recorded, not a target):** Thief p50Depth 4.0 (Pilfer/Elven) – 14.0 (Ninja/Human); Magic User 3.0 (Summoner/Elven) – 17.0 (Court Mage/Fridgian); Fighter 4.0 (Barbarian/Elven) – 11.0 (Master of Arms/Elven).

**Party (200 seeds):** p50 7, p90 12; stuck 51/200.

**Depth-10 slice (200 seeds):** p50 12, p90 17 — informational.

**Depth-20 slice (50 seeds):** p_20 74.0% (vs the Ruling C 84.5% target — measured, not fitted; harder than target, consistent with the tail's own reach-20 undershoot).

**Class smoke:** `docs/class-pass/v17-p54-global-after-smoke.json`, `meta.commit 7db833e`, 143 cells × 5 seeds = 715 runs, pooled mean 7.92, p50 7.0.

**Audit FLAGGED before → after:** `rule=dice` 65 (Phase 52 baseline) → **0** (Phase 54-07 fitted); `rule=whole` 5 (new, informational — `rule=whole` was never Phase 52's own measured rule).

## Change table

See `docs/DIFFICULTY-RETUNE.md`'s `#### Change table (BAND-03)` — one row per removed constant (14 removed, identity-commit history) and one row per DIALS key (26 dials: 7 core-10 fitted, 3 more core-10 unmoved-but-searched, 16 held/available, `MAZE_SIZE` cut). Full table verbatim there; not reproduced here to avoid drift between two copies of the same evidence.

## Miss table

**Floors 1-12: none** — every floor inside its pass band (`fit/fit-log.jsonl #13`'s own `misses: []`).
**Tail (13-20, dS only):** 13:-1.9, 14:-1.4, 15:-0.7, 16:-0.5, 17:-0.5, 18:-0.9, 19:-0.8, 20:-0.4 — all small and same-signed (a mild, consistent undershoot past floor 12, not scored/gated). **Reach-20:** 1.5% vs 3.0-5.0% (tail, reported).

## Roster (TUNE-08)

| Creature | Type / tier | First floor | Raw max/round | foeHitScale | Scaled max | Hero level | Ceiling | Clamped max | Depth-20 deaths (n/50) | Decision |
|---|---|---|---|---|---|---|---|---|---|---|
| Herman | Humans t5 | 13 | 25+12=37 | 0.73 | 27 | 4 | 34 | 27 | 9 | stays — capped by ROUND_DAMAGE_CEILING 0.5 |
| Drarl | Lair Beasts t5 | 13 | 25+12=37 | 0.73 | 27 | 4 | 34 | 27 | 11 | stays — capped by ROUND_DAMAGE_CEILING 0.5 |
| Vampire | Walking Dead t5 | 13 | (25+8)×2=66 | 0.73 | 24×2=48 | 4 | 34 | **34** | 6 | stays — capped by ROUND_DAMAGE_CEILING 0.5 |
| Djinni | Demons t5 | 13 | 25+8=33 | 0.73 | 24 | 4 | 34 | 24 | 6 | stays — capped by ROUND_DAMAGE_CEILING 0.5 |
| Drake | Beasts t4 | 9 | 16+48=64 | 0.69 | 44 | 3 | 31 | **31** | 1 | stays — capped by ROUND_DAMAGE_CEILING 0.5 |

USER RULING B's proposed Drake dice trim (2d10+4 → 2d8+2) is recorded SUPERSEDED — the ceiling bounds it (44 → 31) without a `content/bestiary.js` edit. Vampire's two-attack total (48) and Drake's breath (44) are the two rows the ceiling actually clamps — direct evidence it does real work.

## Re-pin ledger

| File | Test | Old (identity) | New (fitted) | Source |
|---|---|---|---|---|
| `engine/difficulty.js` | `test/difficulty/difficulty.test.js` (new test) | n/a | `DIALS deepStrictEqual identity + fit/best.json` | `fit/best.json` read from disk |
| `engine/difficulty.js` | `test/difficulty/difficulty.test.js` (FITTED_CURVE_PINS, 27 depths) | identity curve (`foeHitScale`/`foeHpScale`/`hazardScale` all 1) | fitted curve (0.61–1.1 / 0.915–1.65 / 0.62–1.6 across depths 2–50) | `node -e` against the landed engine, rounded to 6dp |
| `engine/difficulty.js` | `foeLevelFor` map 1..25 | `1111222223333344444555555` | `1122233344445555555555555` | measured |
| `engine/difficulty.js` | `dots(d)` formula | `9+d` | `round(7+0.3d)` | measured |
| `engine/difficulty.js` | `heroMeanMaxWpFor`/`roundDamageCapFor` | identity values | `[52.08,57.71,62.50,68.13,75.00]` / `26`/`31` at levels 1/3 | measured |
| `engine/encounters.js`, `test/unit/encounters.test.js` | tableFour ±HP dots | fraction-of-maxWP (compounding) | `DOT_HP_BASE` flat × `HERO_HP_SCALE`, no compounding | measured (Adjustment 2) |
| `test/unit/bot-tactics.test.js` | forced Fighter/Knight no-stall cap | 1000 | 2000 | seed 3 legitimately needs 1163 actions post-fix |
| `test/unit/combat-scaling.test.js` | DIALS wiring pins | identity | fitted (`FOE_LEVEL {0.9,0.29}` etc.) | `fit/best.json` |
| `test/parity/fixtures/*.json` (6 files) | `chargenDivergence`/`divergence`/`floorFeatureShift` (57 total records touched) | pre-fit or absent | measured against the fitted engine | replayed live, never hand-typed |
| `test/parity/divergence-records.test.js` | BAND-02 guard EXPECTED | 2 holders (identity commit) | 9 holders (fitted commit) | measured |
| `test/parity/fixture-inventory.test.js` | Ned's pinned wp | 8 | 7 | `round(8*0.915)=7` |
| `~20 other test/unit/*.test.js files` | (no value changes) | implicit identity default | explicit `setIdentityDials()` | test/unit/harness/identityDials.js |

## Parity — measured set

**Scan:** `node tools/initiative-fixture-scan.mjs | diff - tools/initiative-fixture-scan-output.txt` clean (regenerated). **Suite:** `node --test test/parity/*.test.js` green. **EXPECTED (divergence-records.test.js guard):** 9 `kind: "divergence"` holders with `phase` containing `54` — `action-script.combat.json#{flee,lose,lose-apprentice,lose-plain,parley,win}`, `action-script.encounters.json#chest`, `action-script.magic.json#cast-damage`, `action-script.movement.json#script`. **Records by kind:** 31 `chargenDivergence` (HERO_HP_SCALE/FOOD_CLOCK), 17 `floorFeatureShift` (new kind, ENCOUNTER_DOTS remap — 13 cells per depth, deterministic, zero new rng draws), 9 `divergence`/action-path (HERO_SP_SCALE/LOOT_SCALE). Master hash unchanged; `comparables.js` untouched (every `applyFloorFeatureShift` copy lives locally in the 5 test files that need it).

## Gates

`npm test`: 3468 (Adjustment 2 start) → 3468 (Adjustment 3) → 3479 (the fit + parity, +11 new: 6 fit-resume + 2 classConstraints boundary tests + 3 DIALS/curve pins net of retirements) → 3479 (AFTER + audit) → 3479 (ledger), fail 0 throughout. `npm run build:www` exit 0 at every commit. Master hash `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` unchanged. `git diff --stat 02f394d -- content/bestiary.js tools/lib/tuning-bot.mjs test/parity/harness/comparables.js test/parity/prototype-master.js.txt` empty at every commit.

## Schema

No new persisted state key. `HERO_HP_SCALE`/regen/rations/gold/potions touch the same four chargen-or-arrival points as 54-05/06; the maze grid stays 21×21.

## Commits

| Commit | Type | Subject |
|---|---|---|
| `88b081e` | feat | Adjustment 2 (USER RULING G) — fix the Table-4 HP-dot compounding |
| `6b48281` | feat | Adjustment 3 (USER RULING G) — loosen class guardrails, drop spellPower, fix the replay-resume Infinity/null bug |
| `7db833e` | feat | the fit — ship fit/fit-log.jsonl #13 (score 2.7113, PASS) as DIALS; every pin re-measured; the fitted parity set declared + regenerated (**FIT_SHA**) |
| `3e25980` | docs | AFTER readouts + damage-curve audit re-keyed + roster under the ceiling + BESTIARY-REBALANCE addendum (**AFTER_SHA**) |
| `069c700` | docs | ledger close-out (**docs SHA**) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `update-scenario-chargen.mjs`'s "create new record" branch mis-destructured a 2-element tuple, writing an empty `after: {}`**

- **Found during:** magic-parity.test.js's cast-damage scenario (the ONE scenario among 30+ touched by the chargen-update script that had NO pre-existing `chargenDivergence`, so it hit the buggy branch)
- **Issue:** `moved.map(([k, , a]) => [k, a])` destructures a 3rd tuple element that does not exist (`moved` entries are `[key, [before, after]]`, a 2-element array), so `a` was always `undefined`.
- **Fix:** Corrected to `moved.map(([k, [, a]]) => [k, a])` (nested destructure); hand-fixed the one already-written bad record from measured values.
- **Files modified:** the (unstaged, deleted-before-commit) `update-scenario-chargen.mjs` scratch script; `test/parity/fixtures/action-script.magic.json`
- **Verification:** `node --test test/parity/magic-parity.test.js` 5/5 after the fix.
- **Committed in:** `7db833e`

**2. [Rule 2 - Missing critical functionality] `test/parity/harness/comparables.js` is a hard engine-gate file — `applyFloorFeatureShift` was briefly added there, caught by the prohibited-file diff check, and reverted before committing**

- **Found during:** the gate check immediately after Task 1's parity work (`git diff --stat $PRE_FIT -- ... test/parity/harness/comparables.js` was non-empty)
- **Issue:** The natural place for a helper shared by 5 parity test files is the shared harness — but 54-CONTEXT.md and this plan's own ground_rules both name `comparables.js` as untouched, and the fit's own dials moving floor-1 mechanics is exactly the kind of change the engine gate exists to keep honest (no loosening the comparison machinery to paper over a real divergence).
- **Fix:** Reverted the shared-file edit; `applyFloorFeatureShift` is now defined LOCALLY (identical implementation, ~15 lines) in each of the 5 files that need it (`movement-parity.test.js`, `combat-parity.test.js`, `magic-parity.test.js`, `economy-parity.test.js`, `full-suite.test.js`).
- **Files modified:** the 5 parity test files (added); `test/parity/harness/comparables.js` (reverted to untouched)
- **Verification:** `git diff --stat 02f394d -- test/parity/harness/comparables.js` empty at every subsequent commit; all 6 parity test files green.
- **Committed in:** `7db833e`

**3. [Rule 3 - Blocking] DIALS shipping fitted (not identity) broke ~100 pre-existing unit-test assertions across ~20 files unrelated to the difficulty-curve fit**

- **Found during:** the first full `npm test` after shipping fitted DIALS in Task 1 (105 failures, later 100 after the fixture-scoped fixes)
- **Issue:** Chest gold, trap damage, camp heal amounts, kill XP splits, foe hit/HP values, and dozens more pre-existing pins across `test/unit/combat.test.js`, `movement.test.js`, `encounters.test.js`, `class-mitigation.test.js`, `store-roll.test.js`, and ~15 more files assumed `DIALS` defaults to identity (true before this plan, false after) — these tests exercise canon MECHANICS orthogonal to the fit itself, not the fit's own numbers.
- **Fix:** `test/unit/harness/identityDials.js` (new) exports `IDENTITY_DIALS`/`setIdentityDials()`/`withIdentity()`; every affected file gains one `setIdentityDials()` call at module load (files with their own nested `setDialsForTuning(...)`+`restore()` overrides additionally use a local `setDials()` wrapper or `withIdentity()`, since the raw `setDialsForTuning`-returned `restore()` always resets to fitted `DIALS`, never to a previous override). Zero assertion values changed in these files — only the dial context they run under.
- **Files modified:** `test/unit/harness/identityDials.js` (new) + ~20 test files (each a single-line addition, some plus a local wrapper for nested overrides)
- **Verification:** `npm test` 3479/3479 fail 0.
- **Committed in:** `7db833e`

**4. [Rule 2 - Missing critical functionality] genFloor's feature-scatter cell placement shifts under the fitted `ENCOUNTER_DOTS` — a whole new parity-declaration mechanism was needed**

- **Found during:** movement-parity.test.js's initial boot-state check (`floor.g[1][10].feat` diverged: "climb" vs null)
- **Issue:** `ENCOUNTER_DOTS` fitted changes `difficultyCurve(depth).dots`; `genFloor`'s feature-scatter loop assigns the first `dots` array slots (from a rng-shuffled cell list) to the `'dot'` feat before moving on to tele/chest/trap/climb/gorge — a smaller `dots` count shifts every LATER category's starting index, remapping which specific cells get which feat (13 cells per depth, measured to be a structural constant regardless of seed, since the `dots` delta itself is constant). The rng cursor itself never moves (the shuffle runs once regardless of `dots`).
- **Fix:** A new record kind, `floorFeatureShift` (`{ cells: { <depth>: [{x,y,before,after}] } }`), declared on 17 holders across 5 fixture files, applied via a small `applyFloorFeatureShift(state, floorShift)` helper (forces the declared cells to their `before` value on both sides before comparison — side-agnostic). A dedicated regression test in `movement-parity.test.js` proves the declared cells exactly match the measured diff, with no undeclared cell left over.
- **Files modified:** all 6 parity fixture JSON files (5 gained `floorFeatureShift`), the 5 parity test files that compare `floor.g`
- **Verification:** `node --test test/parity/*.test.js` green; the regression test explicitly walks the whole grid and asserts no undeclared cell diverges.
- **Committed in:** `7db833e`

---

**Total deviations:** 4 (1 script bug fixed before commit, 1 engine-gate near-miss caught and reverted before commit, 2 substantial-but-necessary re-pinning mechanisms). None reduced test rigor — every fix either corrects a genuine bug in scratch tooling (never committed with the bug), or adds evidence-based, measured declarations consistent with USER RULING D's "everything that moves is declared" mandate.

**Impact on plan:** The plan's own files_modified list undercounted the true re-pinning scope (naming 9 specific test files; ~29 test files were actually touched, plus the new `test/unit/harness/identityDials.js` and `tools/lib/fit-resume.mjs`) — a consequence of shipping fitted DIALS as the new runtime default across the WHOLE engine, not a scope change to the plan's actual objective (the fit ships, the AFTER lands PASS, the roster closes under the ceiling).

## Issues Encountered

None beyond the four documented deviations above. The background bot/search runtime (~100 min total: two search blocks + four AFTER readouts + two tail runs) ran without incident.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 55 (or the next planned phase): the debug APK should be built from this commit (`069c700`) for the deferred Pixel 7 UAT batch (see below).
- v1.8 content candidates recorded but NOT this phase's work: an Endgame roster expansion (+5-8 tier-5 creatures, ≥1 per type — tier 5 is thin at 7 creatures for the "infinite crawl"), `MAZE_SIZE` (cut from Phase 54 entirely), a ration-buying bot improvement (the bot never buys rations, a real gap in the tuning instrument, not the game).
- The fit's own tail (floors 13-20, reach-20) reads slightly under the Ruling C target consistently (dS -0.4 to -1.9, reach-20 1.5% vs 3.0-5.0%) — recorded, not chased (the fit's objective never scored these floors; releasing a held dial to chase the tail risks re-opening the now-clean floors 1-12). If a future phase wants to close this gap, the Miss table names no specific dial (the tail was never in-scope for automatic release) — a fresh planning pass would need to choose one.
- `docs/class-pass/v17-p54-global-after-smoke.json` and the four/two AFTER/tail readout `.txt` files are the canonical "AFTER" record for this milestone's difficulty model; any future retune phase should diff against these, not Phase 53's.

## Human verification (deferred to end of run)

Owed to the Phase 55 end-of-run Pixel 7 UAT batch (per the deferred-UAT protocol — no device pauses mid-run):

1. **A natural run now dies around floors 6-9**, not floors 3-4 — the bot's own S_6 reads 63.8% (down from the target's 58.4%, i.e. the bot survives Wall-band floors MORE than the Ruling C curve asks, a comfortable margin) and its median death floor is 7 (was 4 pre-fit). On-device this should feel like: floors 1-4 survivable with basic caution, floors 5-8 are where real danger starts, a typical run reaching floor 9-12 before dying feels earned rather than sudden.
2. **Floors 1-3 feel meaningfully safer than before** — S_3 reads 90.5% (target 88.6%); a first-floor death should now be rare (99.5% floor-1 survival).
3. **Table-4's `+25 HP`/`-15 HP`/`+10 HP` dots no longer compound** — repeatedly landing on Table-4 HP rows should feel like a flat, predictable swing (scaled once by the character's own tankiness), never a runaway HP spiral in either direction. The specific Pixel 7 symptom this fixes (a 140-hp "-15 HP" toll on floor 6) should not reproduce.
4. **Foes hit noticeably softer per-swing but the fight roster is a bit tankier** — `FOE_HIT_SCALE` eases the per-hit damage (0.6 base, rising slowly with depth) while `FOE_HP_SCALE` makes foes take slightly longer to kill (0.9 base, rising with depth) — fights should feel like slightly longer, less swingy exchanges rather than either a quick kill or a sudden death.
5. **A rested night and floor-arrival regen should read as a real, felt recovery** — `HERO_REGEN_PER_FLOOR` (0.25) is new: arriving at a fresh floor should visibly restore some HP even without camping.
6. **Herman / Drarl / Vampire / Djinni / Drake should never one-shot** — every one of their crit hits is now bounded by the round-damage ceiling (≈31-34 hp at the levels a hero is likely to meet them); a Drake's fire breath or a Vampire's double-attack should feel dangerous but survivable for a level-appropriate hero, not a run-ending surprise.
7. **The Oracle/rail copy for the descend SP bonus and the Table-4 dot lines** should still read in the game's deadpan voice (no raw-number leakage) — a quick glance at a few floor-transition and Table-4 beats is enough.
8. **The class matrix's recorded spread** (Thief Pilfer/Elven bottoming out around floor 4, Human Ninja/Thief reaching floor 14; Magic User Summoner/Elven near-unplayable past floor 3 vs a Wilmsry Wizard reaching floor 17) is "the hand you're dealt", not a bug — worth a glance to confirm it FEELS like character-build variance, not a broken combo.

## Self-Check: PASSED

- FOUND: engine/difficulty.js
- FOUND: engine/encounters.js
- FOUND: tools/lib/fit-resume.mjs
- FOUND: tools/lib/fit-score.mjs
- FOUND: tools/fit-difficulty.mjs
- FOUND: tools/damage-curve-audit.mjs
- FOUND: test/unit/harness/identityDials.js
- FOUND: test/unit/fit-resume.test.js
- FOUND: .planning/phases/54-four-band-retune-and-roster-decision/fit/fit-log.jsonl
- FOUND: .planning/phases/54-four-band-retune-and-roster-decision/fit/fit-log.md
- FOUND: .planning/phases/54-four-band-retune-and-roster-decision/fit/best.json
- FOUND: .planning/phases/54-four-band-retune-and-roster-decision/readouts/global-after-solo.txt
- FOUND: .planning/phases/54-four-band-retune-and-roster-decision/readouts/global-after-party.txt
- FOUND: .planning/phases/54-four-band-retune-and-roster-decision/readouts/global-after-start-depth-20.txt
- FOUND: .planning/phases/54-four-band-retune-and-roster-decision/readouts/global-after-solo-1000.txt
- FOUND: .planning/phases/54-four-band-retune-and-roster-decision/readouts/global-after-start-depth-10.txt
- FOUND: .planning/phases/54-four-band-retune-and-roster-decision/readouts/global-after-smoke.txt
- FOUND: docs/class-pass/v17-p54-global-after-smoke.json
- FOUND: docs/DIFFICULTY-RETUNE.md
- FOUND: content/BESTIARY-REBALANCE.md
- FOUND commit: 88b081e (Adjustment 2)
- FOUND commit: 6b48281 (Adjustment 3)
- FOUND commit: 7db833e (the fit, FIT_SHA)
- FOUND commit: 3e25980 (the AFTER, AFTER_SHA)
- FOUND commit: 069c700 (the ledger, docs SHA)
