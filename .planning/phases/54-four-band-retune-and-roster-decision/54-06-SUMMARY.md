---
phase: 54-four-band-retune-and-roster-decision
plan: 06
subsystem: difficulty-model
tags: [economy-dials, loot-scale, store-tier, class-mitigation, foe-accuracy, dot-mix, wander-rate, exposed-dials, fit-tool, coordinate-search, core-10, class-fairness, user-ruling-d]

# Dependency graph
requires:
  - phase: 54-four-band-retune-and-roster-decision
    plan: 05
    provides: "the global DIALS object (28 dials, at identity), setDialsForTuning, difficultyCurve, and every hero/foe-side helper this plan's economy/class/late-dial hooks and the fit tool build on"
provides:
  - "engine/difficulty.js — lootFor, foeAccuracyFor, classEvasionFor, classTrapAvoidFor, classKillSpeedFor, classArmorMulFor, spellPowerFor, spellDamageFor, fleeNeedModFor, parleyNeedModFor, startingGoldFor, startingPotionsFor, DOT_MIX_FAMILIES, conversionTableFor, remapEncounterResult, wanderWakeFacesFor — every 54-06 dial's engine hook, at identity"
  - "engine/combat.js/derived.js/encounters.js/economy.js/character.js/magic.js/movement.js rewired through the new helpers — LOOT_SCALE (4 coin sites), STORE_TIER's storeTier(depth) consumer, CLASS_MITIGATION (7 hooks), FOE_ACCURACY, FLEE/PARLEY_NEED_MOD, STARTING_GOLD/POTION_BONUS, DOT_MIX/FIGHT_SHARE's post-roll encounter remap, WANDER_RATE's wake-face count — zero new rng draws anywhere, zero fixture movers (measured)"
  - "tools/lib/fit-score.mjs (pure, no engine import) — scoreSurvival, classConstraints, SEARCH_PLAN (the core 10), HELD_DIALS, applyStep, evalRow, formatEvalLine"
  - "tools/fit-difficulty.mjs — the in-process, worker-threaded, deterministic, resumable evaluator + bounded coordinate search CLI"
  - ".planning/phases/54-four-band-retune-and-roster-decision/fit/start.json — the planner's complete starting dial set"
  - "test/unit/class-mitigation.test.js, test/unit/dot-mix.test.js, test/unit/fit-score.test.js (all new) + re-pinned/extended store-roll/feedback-payload/flee-retune/magic/movement tests"
affects: [54-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "every 54-06 economy/class/accuracy/mix/wander dial follows 54-05's own discipline: a pure helper in engine/difficulty.js reading `live`, a strict `=== 1`/`=== 0` structural identity fast path, wired at exactly the sites the dial table names"
    - "CLASS_MITIGATION is the ONE manual knob — three rows only (Fighter/Thief/Magic User), never a race or sub-class row; every other 54-06 dial is either core-10 (fit-searched) or held (available, not probed this plan)"
    - "the encounter-table remap (DOT_MIX/FIGHT_SHARE) is post-draw arithmetic on an already-resolved cell string — conversionTableFor is memoised on the live DOT_MIX object's own identity, computed once per dial setting, never per roll"
    - "tools/lib/fit-score.mjs is deliberately engine-free: it scores a caller-supplied `survival`/`classIdentity` object rather than running the bot itself, so it is directly unit-testable without worker_threads or the engine at all; tools/fit-difficulty.mjs is the orchestrator that actually plays the bot in-process across workers and feeds fit-score.mjs's pure functions"

key-files:
  created:
    - tools/lib/fit-score.mjs
    - tools/fit-difficulty.mjs
    - test/unit/class-mitigation.test.js
    - test/unit/dot-mix.test.js
    - test/unit/fit-score.test.js
    - .planning/phases/54-four-band-retune-and-roster-decision/fit/start.json
  modified:
    - engine/difficulty.js
    - engine/combat.js
    - engine/derived.js
    - engine/encounters.js
    - engine/economy.js
    - engine/character.js
    - engine/magic.js
    - engine/movement.js
    - test/unit/store-roll.test.js
    - test/unit/feedback-payload.test.js
    - test/unit/flee-retune.test.js
    - test/unit/magic.test.js
    - test/unit/movement.test.js
    - docs/DIFFICULTY-RETUNE.md

key-decisions:
  - "classConstraints' 'pooled p50/reach5' (the plan's dial table names this comparison point but classConstraints receives only the three-row classIdentity summary, never raw per-run data) is defined as the MEDIAN of the three class pools' own p50/reach5 values (median-of-medians, the same interpolated-median arithmetic every other percentile in this codebase uses) — the smallest, most self-consistent definition derivable from the input this function actually receives; documented in this function's own JSDoc"
  - "the stun spell's affected-foe-count roll (`rng.d(6) * Math.max(1, c.level - sp.lvl)`) is one of spellDamageFor's four wired sites — the plan's read_first quotes this exact formula among 'the offensive spell-damage sites' and the acceptance criterion requires >= 4 call sites in engine/magic.js (quake, volley, and thrown alone are only 3); the count itself is thematically defensible as an MU's offensive spell power scaling how many foes a stun catches, at identity (spellPower 1) it is a pure no-op regardless"
  - "the DOT_MIX conversionTableFor grow/shrink algorithm's tie-break for 'the dominant other family in a row' walks DOT_MIX_FAMILIES's own key order (harm, loot, help, excluding the family being grown) rather than an unspecified rule — deterministic, and verified live against the FIGHT_SHARE 1.2/0.6 test cases cited in the plan (17 and 9 cells respectively, exact match)"
  - "tools/fit-difficulty.mjs's --search resume mechanism trusts DETERMINISM rather than dials-equality bookkeeping: a resumed run replays the SAME candidate-generation sequence from n=1, and for any n already present in the log simply reuses that row (by position, not by re-comparing dials) — verified live with a 3-then-5-budget two-run smoke: the second run's console output shows zero re-evaluation output for n=1-3 and a `{resumed:true, fromN:3}` marker line lands in the log before n=4's real evaluation"
  - "tools/fit-difficulty.mjs spawns a FRESH worker pool per evaluation (never a long-lived pool reused across evaluations) — simpler and provably correct (each worker's setDialsForTuning call is isolated to its own process-local module instance with zero risk of a stale override leaking into the next candidate); the per-evaluation worker spin-up cost is within the plan's own ~25-30s-per-eval budget at --seeds=200"

requirements-completed: [BAND-02]

coverage:
  - id: D1
    description: "LOOT_SCALE (4 coin sites), STORE_TIER's storeTier(depth) consumer, CLASS_MITIGATION (7 hooks across 3 rows), FOE_ACCURACY, FLEE/PARLEY_NEED_MOD, STARTING_GOLD/POTION_BONUS, TIER_SPREAD wired at identity with unchanged draw counts; zero fixture movers"
    requirement: "BAND-02"
    verification:
      - kind: unit
        ref: "test/unit/class-mitigation.test.js (9/9), test/unit/store-roll.test.js (18/18 incl. re-pinned storeTier + setDialsForTuning ladder), test/unit/feedback-payload.test.js (39/39 incl. FOE_ACCURACY x evasion matrix), test/unit/flee-retune.test.js (15/15 incl. FLEE_NEED_MOD), test/unit/magic.test.js (40/40 incl. spellPower)"
        status: pass
      - kind: other
        ref: "SCAN-CLEAN (tools/initiative-fixture-scan.mjs byte-identical); node --test test/parity/full-suite.test.js test/parity/divergence-records.test.js (12/12); git diff --stat 7b03404 -- content/ test/parity/harness/comparables.js test/parity/prototype-master.js.txt empty"
        status: pass
    human_judgment: false
  - id: D2
    description: "DOT_MIX/FIGHT_SHARE (post-roll encounter-table remap, same two draws) and WANDER_RATE (wake faces, same eight d20s) wired at identity; MAZE_SIZE cut entirely (no dial, no grid change)"
    requirement: "BAND-02"
    verification:
      - kind: unit
        ref: "test/unit/dot-mix.test.js (5/5), test/unit/movement.test.js (89/89 incl. wanderWakeFacesFor)"
        status: pass
      - kind: other
        ref: "SCAN-CLEAN; node --test test/parity/full-suite.test.js test/parity/movement-parity.test.js (7/7); git diff --stat on engine/maze.js/mazeworld.html/src/browser//tools/lib/tuning-bot.mjs empty; 'MAZE_SIZE' in DIALS === false, 'mazeSize' in difficultyCurve(1) === false"
        status: pass
    human_judgment: false
  - id: D3
    description: "tools/fit-difficulty.mjs + tools/lib/fit-score.mjs + fit/start.json land with tests; SEARCH_PLAN is the core 10 in the user's order; every other dial held; the objective scores floors 1-12 only"
    requirement: "BAND-02"
    verification:
      - kind: unit
        ref: "test/unit/fit-score.test.js (13/13)"
        status: pass
      - kind: other
        ref: "dry run: '#1 score=161.8442 verdict=MISS ...' (no stack trace); --dials='{}' vs tune-difficulty --json on the same 20 seeds: every reached floor's pL matches exactly (ALL MATCH, programmatically verified); grep -c isMainThread|new Worker( = 4; grep -c setDialsForTuning = 5; grep -c tune-classes = 0; SEARCH_PLAN.map(path) matches the user's order exactly"
        status: pass
    human_judgment: false

# Metrics
duration: ~5h
completed: 2026-09-21
status: complete
---

# Phase 54 Plan 06: Economy, Class, Accuracy, Late Dials + the Fit Tool (USER RULING D) Summary

**Wired every remaining 54-05 dial (LOOT_SCALE, STORE_TIER's consumer, CLASS_MITIGATION's 7 class-identity hooks, FOE_ACCURACY, FLEE/PARLEY_NEED_MOD, STARTING_GOLD/POTION_BONUS, DOT_MIX/FIGHT_SHARE's post-roll encounter remap, WANDER_RATE) at identity with zero fixture movers, then built the complete fit tool — `tools/lib/fit-score.mjs`'s pure scoring library (Ruling C `S_L` objective on floors 1-12, class-pool fairness constraints, the core-10 `SEARCH_PLAN`) and `tools/fit-difficulty.mjs`'s worker-threaded, deterministic, resumable evaluator/search CLI — ready for 54-07's actual fit run.**

## Success criteria → proof

| # | Success criterion | Proof |
|---|---|---|
| SC1 (economy + class + accuracy + exposed dials) | LOOT_SCALE (4 sites), STORE_TIER's consumer, CLASS_MITIGATION (3 rows, 7 hooks), FOE_ACCURACY, FLEE/PARLEY_NEED_MOD, STARTING_GOLD/POTION_BONUS at identity | `test/unit/class-mitigation.test.js` (9/9); acceptance greps (`lootFor` 4, `STORE_TIER_FLOORS` 0, `foeAccuracyFor()`/`classEvasionFor(` each 2 in derived.js, `spellDamageFor(` 4 in magic.js, `classKillSpeedFor(` >=1, `classTrapAvoidFor(` 1, `startingGoldFor()\|startingPotionsFor(` 2) all pass |
| SC2 (STORE_TIER's ladder) | `storeTier(depth)` reads `difficultyCurve(depth).storeTier`, reproducing `011122223333` | `node -e` prints `011122223333` for depths 1..12 |
| SC3 (late dials, unchanged draw counts) | DOT_MIX/FIGHT_SHARE remaps the SAME two draws; WANDER_RATE reads the SAME eight d20s; MAZE_SIZE cut | `test/unit/dot-mix.test.js` (5/5) proves `encounterDot` draws exactly 2 dice before and after the remap; `test/unit/movement.test.js`'s new test proves exactly 9 draws (heal + 8 checks) regardless of WANDER_RATE |
| SC4 (fit tool) | The complete model is evaluable and searchable, deterministically, from a committed starting point, with fairness constraints | `test/unit/fit-score.test.js` (13/13); the dry-run + identity-equivalence proofs below; the `--search` resume smoke |
| SC5 (parity) | Zero movers across both engine-touching commits | `SCAN-CLEAN` both times; parity suite green both times; zero new `test/parity/fixtures/` records |
| SC6 (gates) | `npm test`/`build:www` green at every commit; master hash/prohibited files untouched | `npm test` 3427 -> 3439 -> 3445 -> 3458 (green throughout); `build:www` exit 0 at every commit; master hash `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` unchanged |

## Hooks landed (site → helper → test)

| Dial | Site(s) | Helper | Test |
|---|---|---|---|
| `LOOT_SCALE` | `combat.js#killFoe` (kill purse), `encounters.js#openChest`/`#tableFour`/`#meetFaerie` (chest, wilmst cache, faerie) | `lootFor(coin)` | `class-mitigation.test.js` |
| `STORE_TIER` | `economy.js#storeTier(depth)` | `difficultyCurve(depth).storeTier` (direct read, no new helper) | `store-roll.test.js` |
| `CLASS_MITIGATION.Thief.evasion` | `derived.js#foeToHitVs`/`#foeToHitBreakdown` (`vs==="hero"` only) | `classEvasionFor(c)` | `class-mitigation.test.js`, `feedback-payload.test.js` |
| `CLASS_MITIGATION.Thief.trapAvoid` | `encounters.js#springTrap`'s `nimble` | `classTrapAvoidFor(c)` | `class-mitigation.test.js` |
| `CLASS_MITIGATION.Thief/Fighter.killSpeed` | `combat.js#playerStrike` (post-crit, one call site for both rows) | `classKillSpeedFor(c, {opener})` | `class-mitigation.test.js` |
| `CLASS_MITIGATION.Fighter.hpMul` | `difficulty.js#heroMaxWpFor` (54-05) | (existing) | `combat-scaling.test.js` (54-05) |
| `CLASS_MITIGATION.Fighter.armorMul` | `derived.js#armorSoak`'s `ar` | `classArmorMulFor(c)` | `class-mitigation.test.js` |
| `CLASS_MITIGATION["Magic User"].spellPower` | `magic.js`: stun count, quake/volley/thrown bolt damage (4 sites) | `spellDamageFor(n, c)` via `spellPowerFor(c)` | `class-mitigation.test.js`, `magic.test.js` |
| `FOE_ACCURACY` | `derived.js#foeToHitVs`/`#foeToHitBreakdown` (hero AND member) | `foeAccuracyFor()` | `class-mitigation.test.js`, `feedback-payload.test.js` |
| `FLEE_NEED_MOD` | `derived.js#fleeBreakdown`'s `need` | `fleeNeedModFor()` | `flee-retune.test.js` |
| `PARLEY_NEED_MOD` | `combat.js#parley`'s `need` | `parleyNeedModFor()` | (exercised via `class-mitigation.test.js`'s identity check; direct-hook pin owed if 54-07 releases this dial) |
| `STARTING_GOLD`/`STARTING_POTION_BONUS` | `character.js#rollCharacter` | `startingGoldFor()`/`startingPotionsFor(canon)` | `class-mitigation.test.js` |
| `DOT_MIX`/`FIGHT_SHARE` | `encounters.js#encounterDot` (post both draws) | `remapEncounterResult(t,r,result)` via `conversionTableFor` | `dot-mix.test.js` |
| `WANDER_RATE` | `movement.js#newDay`'s `wakeOn` | `wanderWakeFacesFor(sub)` | `movement.test.js` |

## The fit tool

**`tools/lib/fit-score.mjs`** (pure — no engine import):
- `scoreSurvival(survival)` — `Σ_{1..10} ((S_L-T_L)/8)² + Σ_{11..12} ((S_L-T_L)/3)²` against a LOCAL copy of the Ruling C `S_L` curve (floors 1-25, independent of `band-readout.mjs` — see the module's own header for why); floors 13-20 + reach-20 are `tail`-reported, never scored/verdicted.
- `classConstraints(classIdentity)` — 4 rules, a pool under 20 runs is unconstrained; "pooled" = median-of-medians (see Key Decisions).
- `SEARCH_PLAN` (verbatim from the dial table, in order):

  | # | Coordinate | Step | Bounds |
  |---|---|---|---|
  | 1 | `FOE_LEVEL.perDepth` | 0.03 | [0.12, 0.30] |
  | 2 | `FOE_LEVEL.base` | 0.15 | [0.3, 1.0] |
  | 3 | `HERO_SP_SCALE` | 0.05 | [0.15, 0.6] |
  | 4 | `FOE_HIT_SCALE.base` | 0.08 | [0.4, 1.0] |
  | 5 | `FOE_HIT_SCALE.perDepth` | 0.01 | [0, 0.05] |
  | 6 | `FOE_HP_SCALE.base` | 0.1 | [0.5, 1.2] |
  | 7 | `HERO_HP_SCALE` | 0.15 | [1.0, 1.8] |
  | 8 | `HERO_REGEN_PER_FLOOR` | 0.1 | [0, 0.5] |
  | 9 | `HAZARD_SCALE.base` | 0.1 | [0.3, 1.0] |
  | 10 | `ENCOUNTER_DOTS.base` | 1 | [5, 10] |

- `HELD_DIALS` — every other DIALS key, its held start value, its release note (pinned by test to cover every key not in `SEARCH_PLAN`).
- `applyStep`/`evalRow`/`formatEvalLine` — pure record/formatting helpers.

**`tools/fit-difficulty.mjs`**: `--dials=<json|path>` (one evaluation) / `--search --start=<path> --budget=80` (bounded coordinate descent: PASS 1 full step, PASS 2 half step, each coordinate probing +1 then -1, accepting up to 3 steps while improving); `--seeds`/`--workers`/`--log`/`--out`/`--max-actions`. Worker contract: each worker calls `setDialsForTuning(candidate)` once, plays its own contiguous seed slice through `playRun`, posts plain-object rows; the main thread concatenates in SLICE order for determinism, then scores via `survivalReadout`/`classIdentityReadout`/`paceReadout` + `fit-score.mjs`. `--log` is append-only JSONL, resumable (see Key Decisions). The class smoke is never invoked (`grep -c tune-classes` = 0).

## Parity — measured (Tasks 1 and 2)

Both engine-touching commits: `tools/initiative-fixture-scan.mjs` byte-identical to the committed `tools/initiative-fixture-scan-output.txt` (`SCAN-CLEAN`); `node --test test/parity/*.test.js` green; `git diff --stat` on `test/parity/fixtures/` empty both times — every hook is a structural identity fast path, exactly as the plan required. No divergence record needed.

## Gates

`npm test`: 3427 (start) -> 3439 (Task 1) -> 3445 (Task 2) -> 3458 (Task 3), fail 0 throughout. `npm run build:www` exit 0 at every commit. Master hash `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` unchanged. `git diff --stat 7b03404 -- content/ test/parity/harness/comparables.js test/parity/prototype-master.js.txt` empty at the final commit.

## Schema

No new persisted state key. `STARTING_GOLD`/`STARTING_POTION_BONUS` touch chargen values only (`rollCharacter`); the store tier is computed per visit (`storeTier(depth)`, never stored); the maze grid stays 21x21 (`MAZE_SIZE` cut — no `DIALS.MAZE_SIZE` key, no `mazeSize` curve field).

## Commits

| Commit | Type | Subject |
|---|---|---|
| `720e697` | feat | economy + class + accuracy + exposed dials at identity — LOOT_SCALE, STORE_TIER -> storeTier(depth), CLASS_MITIGATION hooks, FOE_ACCURACY, FLEE/PARLEY_NEED_MOD, STARTING_GOLD/POTION_BONUS, TIER_SPREAD; parity measured (0 movers) |
| `59a81e1` | feat | late dials at identity — DOT_MIX/FIGHT_SHARE post-roll remap, WANDER_RATE wake faces; MAZE_SIZE cut; parity measured (0 movers) |
| (this commit) | feat | the fit tool — tools/fit-difficulty.mjs + tools/lib/fit-score.mjs + fit/start.json; ledger note |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 4-adjacent, planner discretion documented, not an architectural change] `classConstraints`'s "pooled" comparison point is median-of-medians, not a raw-run pool**

- **Found during:** Task 3 (designing `classConstraints`)
- **Issue:** The plan's dial table names the constraint `|p50 − pooled p50| ≤ 1.0` but `classConstraints(classIdentity)` — the function signature the plan itself specifies — receives ONLY the three-row `classIdentityReadout` summary (n/p50/reach5/reach10/dmgTakenPerFight/roundsPerFight per class), never the raw per-run death-depth array a true pooled-interpolated-median would need.
- **Fix:** Defined "pooled" as the median of the three class pools' own p50/reach5 values (median-of-medians) — the smallest, most self-consistent definition derivable from the function's own input, using the SAME interpolated-median arithmetic every other percentile in this codebase already uses. Documented in the function's own JSDoc, not silently assumed.
- **Files modified:** `tools/lib/fit-score.mjs`
- **Verification:** `test/unit/fit-score.test.js`'s `classConstraints` tests (3/3) exercise both the pooled-p50 and pooled-reach5 paths with hand-computed expected medians.
- **Committed in:** this commit (Task 3)

**2. [Rule 3 - Blocking-adjacent, documented interpretation] The stun spell's affected-count roll is wired as a spellPower site**

- **Found during:** Task 1 (`read_first` names an exact formula match that is genuinely the stun spell's affected-foe-count, not a damage roll, but the acceptance criterion requires `spellDamageFor(` >= 4 sites in `engine/magic.js`, and only 3 genuine damage rolls exist — quake, volley, thrown)
- **Issue:** Following the acceptance criterion literally (>= 4 sites) while excluding a non-damage site would be impossible without inventing a 4th damage site that does not exist in this content.
- **Fix:** Wired the stun spell's `n = rng.d(6) * Math.max(1, c.level - sp.lvl)` (the affected-foe count) through `spellDamageFor` as the 4th site — a defensible reading of "spell power" scaling how many foes an MU's stun catches, and matches the plan's read_first's EXACT quoted formula. At identity (spellPower 1) this is a pure no-op regardless of interpretation.
- **Files modified:** `engine/magic.js`
- **Verification:** `test/unit/class-mitigation.test.js`'s spellPower test proves the scaling on Fireball's damage; the stun site's identity fast path is covered by `test/unit/class-mitigation.test.js`'s "at identity every helper returns its input" test (`spellDamageFor(17, {cls: "Magic User"}) === 17`).
- **Committed in:** this commit (Task 1)

---

**Total deviations:** 2 documented interpretations (both at identity this plan — zero gameplay-visible effect; both are the smallest, most literal reading of an underspecified plan detail, not scope creep).
**Impact on plan:** No dial value, roster, or gameplay behavior was invented beyond what the plan's dial table and acceptance criteria specify.

## Issues Encountered

None beyond the two documented deviations above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- 54-07 runs `tools/fit-difficulty.mjs --search --start=fit/start.json --budget=80 --seeds=200 --workers=4 --log=<committed path> --out=<best dial set>`, commits the best set into `engine/difficulty.js#DIALS`, re-pins every affected test from measured output, declares + regenerates the fitted movers (expected non-zero — the fit deliberately leaves identity), and takes the AFTER readout (solo/party/class-smoke/depth-20 slice + the per-floor survival block).
- The fit tool's dry-run + identity-equivalence proofs (this SUMMARY's coverage D3) confirm the pipeline is sound before 54-07 spends real bot time on the full 80-evaluation budget.
- No blockers. `npm test` 3458/3458, `npm run build:www` green, master hash and every prohibited file untouched across all three commits.

## Human verification (deferred to end of run)

Owed to the Phase 55 end-of-run Pixel 7 UAT batch (per the deferred-UAT protocol — no device pauses mid-run):

1. **Nothing player-visible changes this plan** — every dial lands at identity (or held), so floor 1 onward should feel BYTE-IDENTICAL to before 54-05/54-06 on-device. This plan's actual difficulty-FEEL change is 54-07's job (the fit).
2. **The fit tool itself is dev/CI-only** (`tools/fit-difficulty.mjs`, not shipped in `www/`) — nothing to check on a device; confirmed by `tools/build-www.mjs`'s copy list never referencing `tools/`.
3. Once 54-07 lands the fitted dials, the SAME four-band feel questions from 54-05's SUMMARY (climb/leap crossing on a failed roll, table-four dots scaling with the hero's own max HP) remain worth a glance, now at non-identity strength.

## Self-Check: PASSED

- FOUND: engine/difficulty.js
- FOUND: engine/combat.js
- FOUND: engine/derived.js
- FOUND: engine/encounters.js
- FOUND: engine/economy.js
- FOUND: engine/character.js
- FOUND: engine/magic.js
- FOUND: engine/movement.js
- FOUND: tools/lib/fit-score.mjs
- FOUND: tools/fit-difficulty.mjs
- FOUND: test/unit/class-mitigation.test.js
- FOUND: test/unit/dot-mix.test.js
- FOUND: test/unit/fit-score.test.js
- FOUND: .planning/phases/54-four-band-retune-and-roster-decision/fit/start.json
- FOUND commit: 720e697 (Task 1)
- FOUND commit: 59a81e1 (Task 2)
