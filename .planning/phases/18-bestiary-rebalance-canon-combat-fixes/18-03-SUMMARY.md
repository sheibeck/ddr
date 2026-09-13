---
phase: 18-bestiary-rebalance-canon-combat-fixes
plan: 03
subsystem: engine
tags: [engine, combat, damage-seam, slow, determinism, parity, draw-count, node-test]

# Dependency graph
requires:
  - phase: 18-bestiary-rebalance-canon-combat-fixes (18-02)
    provides: "engine/foeDamage.js#damageFoe/multiplierFor seam (multiplier -> halfDmg -> armor-soak -> wp-decrement) and content/damage-multipliers.js, built and tested in isolation, ready for call-site routing"
provides:
  - "engine/combat.js: all five foe-damage sites (playerStrike's weapon hit, allyTurn, alliesTurn, applyFoeDamageToPlayer's ward-reflect bounce, foeTurn's acid tick) route through damageFoe with typed sources (melee/ally/reflect/spell), with every caller-owned kill check left exactly where it was"
  - "playerStrike's slow (Philly) two-dice-keep-lower to-hit roll (CANON-05, D-12), gated on t.sp.slow"
  - "12 new behavioral tests in test/unit/combat.test.js covering soak/soak-fails/crit-bypass/slow-hit/slow-miss/halfDmg/Fighter-vs-Trachea across all five routed sites"
  - "Section 3 of test/unit/foe-turn-draw-count.test.js (D-13): 8 countingRng pins proving the seam's d20 and the slow re-roll are +1-draw-only-when-flagged, halfDmg/multipliers are zero-draw arithmetic, and every existing FID-02 pin is unchanged"
affects: [18-06, 19-foe-abilities-spellcasting-symmetric-int-resistance]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Call-site routing through a shared damage seam: every caller keeps its own event-push (skipped on `hit.soaked`) and its own unchanged kill-check line immediately after the seam call"
    - "Zero-draw structural gating on flags absent from the parity roster (sp.ar, sp.slow) — extended from Phase 17's established pattern to the seam's own d20 and the to-hit re-roll"

key-files:
  created: []
  modified:
    - engine/combat.js
    - test/unit/combat.test.js
    - test/unit/foe-turn-draw-count.test.js

key-decisions:
  - "Reflect damage (applyFoeDamageToPlayer's ward-reflect branch) is routed as kind:\"reflect\" — physical for armor-soak purposes (subject to foe.sp.ar) but never subject to the multiplier table, per 18-RESEARCH.md's A2 recommendation"
  - "Ally and party-member strikes are routed as kind:\"ally\" (not \"melee\") — this structurally guarantees D-20 (no cls on C.allies entries can ever match the Fighter-vs-Trachea melee-only row) without needing a separate class check"
  - "The seam's result variable in playerStrike is named `landed` rather than `hit` to avoid colliding with the existing `const hit = auto || (need > 0 && roll <= need);` to-hit boolean already in scope"

requirements-completed: [CANON-01, CANON-03, CANON-04, CANON-05, FID-05]

coverage:
  - id: D1
    description: "playerStrike's weapon hit, allyTurn's and alliesTurn's strikes, applyFoeDamageToPlayer's ward-reflect bounce, and foeTurn's acid tick all route through damageFoe with typed sources; kill checks stay at the call sites; no foe-side direct wp decrement remains in combat.js"
    requirement: "CANON-01"
    verification:
      - kind: unit
        ref: "test/unit/combat.test.js — Phase 18 section (12 tests: soak, soak-fails, crit-bypass, slow-hit, slow-miss, halfDmg, Fighter-vs-Trachea/Thief-control, allyTurn soak/Trachea-control, alliesTurn soak, ward-reflect soak, acid-tick Walking-Dead/halfDmg)"
        status: pass
      - kind: other
        ref: "acceptance-criteria greps (grep -c on import, decrement removal, seam call signatures, killFoe line counts, header text) — all matched exactly"
        status: pass
    human_judgment: false
  - id: D2
    description: "Philly's slow gives the player two strike dice and keeps the lower, gated on t.sp.slow with zero extra draws for any other foe"
    requirement: "CANON-05"
    verification:
      - kind: unit
        ref: "test/unit/combat.test.js#playerStrike: slow tests; test/unit/foe-turn-draw-count.test.js#CANON-05 pins (7 lethal / 5 all-miss vs 6 / 4 baselines)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The seam's armor-soak d20, halfDmg ceil-halving, and the CANON-04 multiplier table apply correctly through every real combat call site, with the seam's d20 firing only when sp.ar is present"
    requirement: "CANON-04"
    verification:
      - kind: unit
        ref: "test/unit/foe-turn-draw-count.test.js Section 3 (8 pins): baseline 6 / ar-fail 7 / ar-soak 6 / slow 7&5 vs 6&4 / halfDmg 5 / Trachea 5 / acid-WD 2-draw zero-gate"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every existing FID-02 pin (6 micro + 5 FULL_FIGHTS) and the full parity suite stay byte-identical after routing"
    requirement: "FID-05"
    verification:
      - kind: unit
        ref: "node --test test/unit/foe-turn-draw-count.test.js (20/20 pass, all pre-existing pins unedited per git diff check); node --test \"test/parity/**/*.test.js\" (30/30 pass); git diff --quiet e01ac46 -- test/parity/fixtures test/parity/harness/comparables.js test/parity/prototype-master.js.txt package.json package-lock.json"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-09-13
status: complete
---

# Phase 18 Plan 03: Combat.js Damage-Seam Routing + Slow Summary

**Routed all five `engine/combat.js` damage-to-foe sites (hero strike, ally/member strikes, ward-reflect, acid tick) through the 18-02 `damageFoe` seam with typed sources, landed Philly's slow two-dice-keep-lower to-hit roll, and pinned the exact gated draw cost of both mechanics — every existing FID-02 draw-count pin and the full parity suite stay byte-identical.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-09-13T23:19:00Z (approx, continuing from 18-02's completion)
- **Completed:** 2026-09-13T23:44:00Z
- **Tasks:** 2 completed
- **Files modified:** 3

## Accomplishments

- Routed `playerStrike`'s weapon hit through `damageFoe` with `{ kind: "melee", casterClass: c.cls, casterSub: c.sub, crit }`, skipping the `struck` event on a soak and reading `dmg: landed.applied` for the actual wp lost.
- Landed Philly's `slow` (CANON-05, D-12): the strike-die roll is now `let roll = rng.d(dieN)`, followed by a second identical draw kept as the lower result only when `t.sp.slow` is truthy — every downstream read (hit, crit, Death-touch, Stealth, the `struck`/`strikeMissed` roll field) sees the kept value with zero additional wiring.
- Routed `allyTurn` and `alliesTurn`'s strikes through `damageFoe` with `{ kind: "ally", crit: false }` — this kind never matches the Fighter-vs-Trachea melee-only multiplier row, structurally enforcing D-20 without a class check.
- Routed `applyFoeDamageToPlayer`'s ward-reflect bounce through `damageFoe` with `{ kind: "reflect", crit: false }` (physical for armor-soak purposes, never multiplier-eligible, per 18-RESEARCH.md A2).
- Routed `foeTurn`'s acid tick through `damageFoe` with `{ kind: "spell", school: "acid", casterSub: c.sub }` — spell damage always bypasses the foe's own armor and is eligible for the any-spell-vs-Walking-Dead multiplier.
- Updated the module header's flavor-only `sp.*` flag enumeration to remove `ar`/`slow`/`halfDmg` and state that Phase 18 gives them mechanical effect via the seam/to-hit roll.
- Added 12 behavioral tests to `test/unit/combat.test.js` and 8 draw-count pins (Section 3, D-13) to `test/unit/foe-turn-draw-count.test.js`, all traced by hand against the actual dice-consumption order before being written.
- Verified zero regression: all 65 pre-existing `combat.test.js` tests, all 12 pre-existing `foe-turn-draw-count.test.js` tests (6 micro + 5 FULL_FIGHTS + the countingRng self-test), and all 30 parity tests pass unmodified; `npm test` is green at 773/773.

## Task Commits

Each task was committed atomically:

1. **Task 1: Route playerStrike / allyTurn / alliesTurn / ward-reflect / acid-tick through damageFoe, add the slow re-roll, and add behavioral tests in combat.test.js** - `ba12bf6` (feat)
2. **Task 2: Add the Phase 18 draw-count section (D-13) to foe-turn-draw-count.test.js and run the full gate** - `fce1570` (test)

**Plan metadata:** (this commit)

## Files Created/Modified

- `engine/combat.js` - `damageFoe` import; header comment updated; `playerStrike`'s slow re-roll and seam routing; `allyTurn`/`alliesTurn`/`applyFoeDamageToPlayer`/`foeTurn` seam routing. No foe-side direct `wp -=` remains; the hero's own `c.wp -= dmg` and the member branch's `member.wp -= mDmg` are untouched.
- `test/unit/combat.test.js` - Added `alliesTurn` to the import list; added a 12-test "Phase 18: damageFoe routing + slow" section covering all five routed sites.
- `test/unit/foe-turn-draw-count.test.js` - Added Section 3 (8 tests, D-13) pinning the exact gated draw costs of the seam's d20 and the slow re-roll, plus a restated-unchanged FULL_FIGHTS assertion.

## Decisions Made

- Reflect damage is `kind: "reflect"` — physical for armor-soak purposes but never multiplier-eligible (18-RESEARCH.md A2's recommended reading, locked in this plan).
- Ally/member strikes are `kind: "ally"`, which structurally guarantees D-20 (no `cls` field on `C.allies` entries can ever match the hero-only Fighter-vs-Trachea melee row) without an extra runtime check.
- Renamed the seam's return-value binding in `playerStrike` from the plan's suggested `hit` to `landed`, since `hit` already names the existing to-hit boolean in the same scope — a pure naming fix, zero behavior change.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Renamed playerStrike's damageFoe result variable to avoid a duplicate-declaration syntax error**
- **Found during:** Task 1 (first test run)
- **Issue:** The plan's suggested `const hit = damageFoe(...)` collides with the pre-existing `const hit = auto || (need > 0 && roll <= need);` to-hit boolean in the same block scope, producing a `SyntaxError: Identifier 'hit' has already been declared`.
- **Fix:** Renamed the seam's result binding to `const landed = damageFoe(...)` and updated its two downstream reads (`landed.soaked`, `landed.applied`) accordingly. No change to the seam's call signature, event shape, or any acceptance-criteria grep (all of which match on the call expression, not the variable name).
- **Files modified:** engine/combat.js
- **Verification:** `node --test test/unit/combat.test.js` — all 65 pre-existing + 12 new tests pass.
- **Committed in:** ba12bf6 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Cosmetic naming fix only — no scope creep, no behavior change.

## Issues Encountered

None beyond the variable-naming collision documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `engine/combat.js`'s five damage-to-foe sites are fully routed; `engine/magic.js` (quake/volley/insane/thrown) and `engine/items.js` (fire) remain for 18-04, which runs independently against disjoint files.
- `npm test` is green at 773/773 (753 baseline + 12 combat.test.js + 8 foe-turn-draw-count.test.js); the parity suite (30/30) and all frozen files (`test/parity/fixtures`, `test/parity/harness/comparables.js`, `test/parity/prototype-master.js.txt`, `package.json`, `package-lock.json`) are byte-identical to `e01ac46`.
- No blockers for 18-04/18-05/18-06.

---
*Phase: 18-bestiary-rebalance-canon-combat-fixes*
*Completed: 2026-09-13*

## Self-Check: PASSED

- FOUND: engine/combat.js
- FOUND: test/unit/combat.test.js
- FOUND: test/unit/foe-turn-draw-count.test.js
- FOUND commit: ba12bf6 (Task 1)
- FOUND commit: fce1570 (Task 2)
