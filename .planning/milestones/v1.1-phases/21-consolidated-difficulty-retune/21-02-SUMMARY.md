---
phase: 21-consolidated-difficulty-retune
plan: 02
subsystem: engine
tags: [engine, difficulty-curve, combat, foe-abilities, parity-safe, identity-band, node-test]

requires:
  - phase: 19-foe-abilities-spellcasting-symmetric-int-resistance
    provides: "foeTurn step order (tick -> firstReadyAbility -> cast-or-melee), tickAbilityCooldowns/firstReadyAbility/resolveFoeAbility contracts, f.abilities structural zero-draw gate"
provides:
  - "engine/difficulty.js: COMBAT_SCALE_FROM_DEPTH/FOE_CAP/FOE_POWER/ABILITY_THREAT constants + FOE_LVL_BIAS (all identity: MAX === BASE), softCapFloat (non-rounding), 5 new difficultyCurve fields (foeCap/foeBonus/foeLvlBias/foePower/abilityThreat), 4 pure helpers (foeCountFor/foeWpFor/foeDmgBonusFor/abilityCadenceFor)"
  - "engine/combat.js: startCombat reads difficultyCurve once (foeLvlBias in the maxLvl clamp, foeCountFor after the canon d4/d4 roll, foeWpFor + conditional dmgBonus per foe); three melee sites (pursuitStrike, member branch, hero branch) add (f.dmgBonus || 0)/(pursuer.dmgBonus || 0); foeTurn calls tickAbilityCooldowns(state, f)"
  - "engine/foeAbilities.js: tickAbilityCooldowns(state, f) signature (arity 2); firstReadyAbility's uses check and resolveFoeAbility's cooldown reset/uses decrement read abilityCadenceFor(a, curve)"
  - "test/unit/combat-scaling.test.js: 12 tests (identity pins 1..5, constant identity pins, cap/monotone bounds, non-finite tolerance, synthetic-curve helper pins, startCombat wiring identity, draw-shape equality, wandering no-count-draw, dmgBonus melee arithmetic, cadence lazy-init/countdown, D-15/FID-02 untouched guard)"
affects: [21-03, 21-04, 21-05]

tech-stack:
  added: []
  patterns:
    - "softCapFloat(base, cap, over, k) as the non-rounding sibling of softCap — exact identity at over===0 by construction (Math.exp(-0)===1), used for fractional multiplier fields instead of the integer-rounding softCap"
    - "zero-new-draw additive scaling: a depth-derived bonus/multiplier applied AFTER a canon dice roll or AT copy time, never inserted as a new rng draw on a fixture-exposed path"
    - "curve-consuming helpers take the already-computed curve object (not depth) so their arithmetic is testable with a synthetic curve, independent of the real difficultyCurve constants"

key-files:
  created:
    - test/unit/combat-scaling.test.js
  modified:
    - engine/difficulty.js
    - engine/combat.js
    - engine/foeAbilities.js

key-decisions:
  - "All eleven new constants land at identity (every *_MAX === its *_BASE) in this plan — COMBAT_SCALE_FROM_DEPTH=6, FOE_CAP_BASE=FOE_CAP_MAX=3 (FOE_CAP_SOFT_K=20), FOE_POWER_BASE=FOE_POWER_MAX=1.0 (FOE_POWER_SOFT_K=25), ABILITY_THREAT_BASE=ABILITY_THREAT_MAX=1.0 (ABILITY_THREAT_SOFT_K=20), FOE_LVL_BIAS=0 — so difficultyCurve(depth) returns foeCap:3/foeBonus:0/foeLvlBias:0/foePower:1/abilityThreat:1 at EVERY depth (not just <=5) until 21-04 moves a MAX above its BASE"
  - "foeCountFor is applied as Math.min(curve.foeCap, canonCount + curve.foeBonus) where canonCount is the prototype's own Math.min(cap, d4-ternary) result — the d4/d4 short-circuit shape is untouched, the bonus is purely additive arithmetic on an already-drawn value (D-17)"
  - "foeDmgBonusFor scales the lvl*lvl base term of a foe's melee swing (never the sp.dmg dice) — resolved per CONTEXT.md's Claude's-Discretion note, keeping damageFoe the one foe-wp decrement seam and adding zero new draws"
  - "The Djinni summon literal in foeAbilities.js's resolveFoeAbility (heal/summon dispatch) is deliberately NOT routed through foeWpFor — reinforcements are already tier-limited weak foes; scaling them is a 21-04-only option if the DR round asks (documented inline, without naming the helper, per the plan's own no-carve-out wording)"

patterns-established:
  - "Curve-consuming pure helpers (foeCountFor/foeWpFor/foeDmgBonusFor/abilityCadenceFor) live in engine/difficulty.js next to difficultyCurve, take the curve object as their second/only-curve argument, and are unit-tested with synthetic curve literals independent of the real constants"

requirements-completed: [TUNE-01]

coverage:
  - id: D1
    description: "difficultyCurve(depth) gains foeCap/foeBonus/foeLvlBias/foePower/abilityThreat, computed via the non-rounding softCapFloat over depth past the identity band (<=5); every new constant is identity (MAX===BASE) in this plan"
    requirement: "TUNE-01"
    verification:
      - kind: unit
        ref: "test/unit/combat-scaling.test.js#D-19 identity: difficultyCurve(1..5) deep-equals the exact pre-Phase-21 object plus the identity fields"
        status: pass
      - kind: unit
        ref: "test/unit/combat-scaling.test.js#21-02 constants are identity (MAX === BASE) — the retune (21-04) is the only thing allowed to move them"
        status: pass
      - kind: unit
        ref: "test/unit/combat-scaling.test.js#cap boundaries / monotone / non-finite depth tolerance"
        status: pass
    human_judgment: false
  - id: D2
    description: "startCombat reads the curve once and applies the D-17 zero-draw count bonus and the D-02 copy-time wp/maxWP + conditional dmgBonus scaling, with zero new rng draws and byte-identical output at depth <= 5"
    requirement: "TUNE-01"
    verification:
      - kind: unit
        ref: "test/unit/combat-scaling.test.js#D-19 wiring identity: at depth 1..5 every foe built by startCombat has wp === maxWP === the roster row's wp and NO dmgBonus key"
        status: pass
      - kind: unit
        ref: "test/unit/combat-scaling.test.js#draw-shape equality (D-17/D-19): startCombat draws 8 at depth 1 and at depth 5, and 2 + foeCountFor(2, difficultyCurve(30)) * 2 + 2 at depth 30"
        status: pass
      - kind: unit
        ref: "test/unit/combat-scaling.test.js#wandering encounters still draw no count dice"
        status: pass
    human_judgment: false
  - id: D3
    description: "the three foe melee damage sites add (f.dmgBonus || 0)/(pursuer.dmgBonus || 0) as post-draw arithmetic; tickAbilityCooldowns becomes (state, f) and every cadence read goes through abilityCadenceFor"
    requirement: "TUNE-01"
    verification:
      - kind: unit
        ref: "test/unit/combat-scaling.test.js#dmgBonus is post-draw arithmetic on the hero swing"
        status: pass
      - kind: unit
        ref: "test/unit/combat-scaling.test.js#D-18: tickAbilityCooldowns(state, f) lazily inits from the cadence and counts down; identity at depth 5"
        status: pass
    human_judgment: false
  - id: D4
    description: "parity stays 30/30 with zero new carve-outs; test/determinism/foe-abilities.test.js and test/unit/foe-turn-draw-count.test.js are byte-unchanged; npm test fully green"
    requirement: "TUNE-01"
    verification:
      - kind: unit
        ref: "test/unit/combat-scaling.test.js#the D-15 / FID-02 contract is untouched by Phase 21 wiring"
        status: pass
      - kind: integration
        ref: "node --test \"test/parity/**/*.test.js\" (30/30)"
        status: pass
      - kind: unit
        ref: "npm test (935/935)"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-09-14
status: complete
---

# Phase 21 Plan 2: Combat-Scaling Knobs (Identity Wiring) Summary

**Extended `engine/difficulty.js` with five new curve fields (foeCap/foeBonus/foeLvlBias/foePower/abilityThreat) and four pure application helpers, then wired `startCombat`, its three melee-damage sites, and `foeAbilities.js`'s cadence reads onto them — every constant lands at identity (MAX === BASE) so the diff is provably inert at every depth, with parity 30/30 and zero new carve-outs.**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-09-14
- **Tasks:** 2 completed
- **Files modified:** 4 (1 new: `test/unit/combat-scaling.test.js`; 3 modified: `engine/difficulty.js`, `engine/combat.js`, `engine/foeAbilities.js`)

## Accomplishments

- `engine/difficulty.js`: added `COMBAT_SCALE_FROM_DEPTH = 6`, `FOE_CAP_BASE/MAX/SOFT_K = 3/3/20`, `FOE_POWER_BASE/MAX/SOFT_K = 1.0/1.0/25`, `ABILITY_THREAT_BASE/MAX/SOFT_K = 1.0/1.0/20`, `FOE_LVL_BIAS = 0`; the private non-rounding `softCapFloat(base, cap, over, k)`; five new `difficultyCurve` fields computed from `over = Math.max(0, d - (COMBAT_SCALE_FROM_DEPTH - 1))`; four exported pure helpers `foeCountFor`, `foeWpFor`, `foeDmgBonusFor`, `abilityCadenceFor`.
- `engine/combat.js`'s `startCombat`: reads `const curve = difficultyCurve(state.floor.depth);` once; `maxLvl` clamp gains `+ curve.foeLvlBias`; the count line becomes `foeCountFor(Math.min(cap, rng.d(4) <= 2 ? 1 : rng.d(4) <= 3 ? 2 : 3), curve)` (d4/d4 short-circuit untouched); each foe's `wp`/`maxWP` come from `foeWpFor(picked.wp, curve)`, and a `dmgBonus` key is spread in only when `foeDmgBonusFor(lvl, curve) > 0`. The three melee-damage sites (`pursuitStrike` line 562, the member branch line 1295, the hero branch line 1315) add `(f.dmgBonus || 0)` / `(pursuer.dmgBonus || 0)` as a post-draw term. `foeTurn`'s ability gate now calls `tickAbilityCooldowns(state, f)`.
- `engine/foeAbilities.js`: `tickAbilityCooldowns(state, f)` (arity 2) computes the curve once and lazy-inits `f.cd[id]` from `abilityCadenceFor(a, curve).every`; `firstReadyAbility`'s uses-readiness check reads `abilityCadenceFor(a, curve).uses`; `resolveFoeAbility` computes `const cad = abilityCadenceFor(a, difficultyCurve(state.floor.depth));` and uses `cad.every`/`cad.uses` for the cooldown reset and uses decrement. The summon literal's hit points are deliberately not routed through the wp scaler.
- `test/unit/combat-scaling.test.js`: 12 tests — Task 1 (identity pins for depths 1..5, constant-identity pins, cap/monotone bounds across 1..200 including breather floors, non-finite-depth tolerance, synthetic-curve helper pins covering `foeCountFor`/`foeWpFor` (every BESTIARY row)/`foeDmgBonusFor`/`abilityCadenceFor` (every `FOE_ABILITIES` descriptor)) and Task 2 (startCombat wiring identity at depth 1/5, draw-shape equality at depth 1/5/30, wandering no-count-draw, `dmgBonus` melee arithmetic via `foeTurn`, `tickAbilityCooldowns`/`firstReadyAbility` cadence lazy-init and countdown, and a structural guard that `test/determinism/foe-abilities.test.js`/`test/unit/foe-turn-draw-count.test.js` contain no "Phase 21" string).
- `npm test`: 935/935 (923 pre-plan + 12 new). Parity: `node --test "test/parity/**/*.test.js"` 30/30. `test/determinism/foe-abilities.test.js` and `test/unit/foe-turn-draw-count.test.js` byte-unchanged vs `04eb229`. `test/parity/harness/comparables.js`, `content/`, `engine/items.js`, `engine/encounters.js`, `engine/economy.js`, `engine/state.js`, `engine/saveState.js` byte-unchanged vs `bd0ba7c`. `node tools/tune-difficulty.mjs --seeds=3 --json` smoke run succeeds.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend engine/difficulty.js with the combat-scaling constants, softCapFloat, the five curve fields and the four pure application helpers — all identity-valued** - `7a70a6b` (feat)
2. **Task 2: Wire the curve into startCombat, the three melee sites, foeTurn's tick call and foeAbilities' four cadence sites; prove draw-shape equality and the D-15/FID-02 pins untouched** - `3b99519` (feat)

## Files Created/Modified

- `engine/difficulty.js` - +11 constants, `softCapFloat`, 5 curve fields, 4 pure helpers (Task 1)
- `test/unit/combat-scaling.test.js` - new, 12 tests (Task 1: 6, Task 2: +6)
- `engine/combat.js` - `startCombat` curve read + count/wp/dmgBonus wiring, three melee sites, `foeTurn`'s tick call (Task 2)
- `engine/foeAbilities.js` - `tickAbilityCooldowns(state, f)` signature + four cadence sites (Task 2)

## Decisions Made

- Every one of the eleven new constants is identity (`MAX === BASE`) in this plan, exactly as the plan's `must_haves` require — `difficultyCurve(depth)` therefore returns `foeCap: 3, foeBonus: 0, foeLvlBias: 0, foePower: 1, abilityThreat: 1` at every depth (not just <= 5), confirmed by the depth-30 cases in tests 3, 4, and 8. 21-04 is the only plan authorized to move a `MAX` above its `BASE`.
- `foeDmgBonusFor` scales the `lvl * lvl` base term of a foe's melee swing rather than `sp.dmg` dice, per the plan's Claude's-Discretion resolution — keeps `damageFoe` the one foe-wp decrement seam and adds zero new draws.
- The Djinni/Vampire/Stalka Beast/Krupke/Drudge/Drake summon literal in `resolveFoeAbility`'s `summon` branch is not routed through `foeWpFor` — documented inline without naming the helper (per the acceptance criteria's `grep -c 'foeWpFor(' engine/foeAbilities.js` === 0 requirement), matching the plan's stated Claude's-Discretion allowance.

## Deviations from Plan

None — plan executed exactly as written. Every acceptance-criteria grep in both tasks was verified directly against the landed code and passed on the first implementation (no back-and-forth needed).

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The wiring and its proofs (identity pins, draw-shape equality, synthetic-curve helper pins) are now in place and parity-safe, exactly as this plan's objective states — 21-04's retune can be a pure constants pass (moving `FOE_CAP_MAX`, `FOE_POWER_MAX`, `ABILITY_THREAT_MAX` and their `*_SOFT_K` values) against wiring that is already proven correct.
- `docs/DIFFICULTY-RETUNE.md`'s BEFORE half (21-01) and this plan's identity-valued combat knobs are both frozen; 21-04's AFTER capture will reuse the same bot/parameters.
- No blockers. `npm test` is green (935/935), parity is byte-identical (30/30), and the D-15/FID-02 files are confirmed byte-unchanged.

---
*Phase: 21-consolidated-difficulty-retune*
*Completed: 2026-09-14*

## Self-Check: PASSED

All created/modified files found on disk (`engine/difficulty.js`, `engine/combat.js`, `engine/foeAbilities.js`, `test/unit/combat-scaling.test.js`, this SUMMARY); both task commit hashes (`7a70a6b`, `3b99519`) found in `git log --oneline --all`.
