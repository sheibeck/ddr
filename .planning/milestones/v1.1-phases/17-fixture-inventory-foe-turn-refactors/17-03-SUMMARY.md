---
phase: 17-fixture-inventory-foe-turn-refactors
plan: 03
subsystem: testing
tags: [parity, determinism, rng, draw-count, regression, foe-turn, node-test]

# Dependency graph
requires:
  - phase: 17-01
    provides: "test/parity/FIXTURE-INVENTORY.md's generated roster block + Draw-count baseline (FID-02) placeholder heading this plan fills in"
  - phase: 17-02
    provides: "pickFoeTarget/applyFoeDamageToPlayer extracted from foeTurn — this plan's full-fight pins prove that extraction is draw-for-draw identical to the pre-refactor inline code"
provides:
  - "countingRng(inner) — test-local helper wrapping any rng (fakeRng or makeRng), counting d/pick/next draws and max(0,len-1) per shuffle, verified against mulberry32's own cursor arithmetic"
  - "test/unit/foe-turn-draw-count.test.js — 17 pinned tests: 1 wrapper self-test + 6 per-foeTurn micro pins (0/1/2/2/3/6 draws) + 5 full fixture-seeded fight pins (12/101/111/66/32 draws for seeds 3/14/17/303/8)"
  - "FIXTURE-INVENTORY.md's '## Draw-count baseline (FID-02)' section: pinned tables + the Phase 19 contract (an ability-less foe, or one with abilities:[], must reproduce every pinned number unchanged)"
affects: ["19 (foe abilities/spellcasting resolver's ability-attempt gate must re-run this file's pinned numbers unchanged for any foe lacking a non-empty abilities kit)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "countingRng(inner) draw-counting wrapper: increments a counter on every d()/pick()/next() call and by max(0, arr.length-1) per shuffle(arr), matching engine/rng.js's Fisher-Yates loop exactly; passes getState/setState through when the inner rng provides them"
    - "Cursor cross-check: (start + Math.imul(draws, 0x6d2b79f5)) | 0 === rng.getState() | 0 — ties every pinned draw count to mulberry32's actual internal state, so a miscounted wrapper (or a shuffle-counted-wrong bug) fails loudly rather than silently under/over-counting"

key-files:
  created:
    - test/unit/foe-turn-draw-count.test.js
  modified:
    - test/parity/FIXTURE-INVENTORY.md

key-decisions:
  - "Pinned integers were measured by actually running the counting wrapper against the post-17-02 engine (not hand-traced), matching the plan's given values exactly (12/101/111/66/32 full-fight draws; 0/1/2/2/3/6 micro draws) — this simultaneously satisfies FID-02's baseline and confirms 17-02's extraction changed nothing"
  - "Full-fight helper drives startCombat + a bounded playerStrike loop (cap 200 attacks) over ONE shared countingRng object, mirroring how engine/engine.js#applyAction threads a single rng through a real run — not a per-action rehydration, since the test isn't going through applyAction's action-dispatch seam"

patterns-established:
  - "Any future draw-count regression test (e.g. Phase 19's ability-gate baseline) should copy countingRng verbatim rather than re-deriving a wrapper or a modular-inverse cursor calculation"

requirements-completed: [FID-02]

coverage:
  - id: D1
    description: "countingRng(inner) wrapper + 6 pinned per-foeTurn micro draw counts (0/1/2/2/3/6) for foes without an abilities field, each cross-checked against fakeRng's exact sequence"
    requirement: "FID-02"
    verification:
      - kind: unit
        ref: "test/unit/foe-turn-draw-count.test.js (7 tests: wrapper self-test + 6 micro pins)"
        status: pass
    human_judgment: false
  - id: D2
    description: "5 pinned full fixture-seeded fight draw counts (12/101/111/66/32 for seeds 3/14/17/303/8), each verified against the mulberry32 cursor via Math.imul cross-check"
    requirement: "FID-02"
    verification:
      - kind: unit
        ref: "test/unit/foe-turn-draw-count.test.js (5 full-fight tests, table-driven, one per seed)"
        status: pass
    human_judgment: false
  - id: D3
    description: "FIXTURE-INVENTORY.md's Draw-count baseline (FID-02) section documents the pinned totals and the Phase 19 contract beneath the untouched generated roster block"
    requirement: "FID-02"
    verification:
      - kind: unit
        ref: "test/parity/fixture-inventory.test.js (generated-block-only comparison, unaffected by this plan's edit below the markers)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Full phase gate: npm test green with all Phase 17 tests, parity suite byte-identical, and no commit in this phase touched the frozen master/fixtures/comparables/package manifest"
    requirement: "FID-02"
    verification:
      - kind: unit
        ref: "npm test (724/724 passing)"
        status: pass
      - kind: other
        ref: "git log --oneline c5fc219..HEAD -- test/parity/prototype-master.js.txt test/parity/fixtures test/parity/harness/comparables.js package.json package-lock.json (0 lines)"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-09-13
status: complete
---

# Phase 17 Plan 03: FID-02 Draw-Count Regression Baseline Summary

**Pinned RNG-draw regression test (countingRng wrapper, 6 micro cases + 5 full fixture fights, cursor-cross-checked) proving ability-less foes draw exactly today's counts — the numeric "before" baseline Phase 19's ability-attempt gate must reproduce**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-09-13
- **Tasks:** 2/2
- **Files modified:** 2 (1 new, 1 modified)

## Accomplishments
- `countingRng(inner)` wraps ANY rng object (a local `fakeRng` or the real `makeRng`) and counts every draw-producing call — `d`/`pick`/`next` count 1 each, `shuffle(arr)` counts `max(0, arr.length-1)` — matching `engine/rng.js`'s internal Fisher-Yates loop exactly.
- 6 per-foeTurn micro pins via `fakeRng`, for foes with no `abilities` field: asleep (0 draws), one miss (1), one hit on an unarmoured hero (2, `wp` drops to 50), a Bat/Rat-shaped foe's two flat-damage swings (2 draws total, zero damage dice, `dmg: 2` each), a hit on an armoured hero (3, to-hit + d6 + d20 soak), and two Dante-shaped foes' six all-miss swings (6).
- 5 full fixture-seeded fight pins via `makeRng`, running `startCombat` then a bounded `playerStrike` loop to resolution: seed 3/Beasts (Shriek, 1 attack, 12 draws, won), seed 14/Beasts (Bat/Rat+Shriek, 10 attacks, 101 draws, died), seed 17/Beasts (Viper+Shriek, 11 attacks, 111 draws, won), seed 303/Humans (Dante×2, 6 attacks, 66 draws, won), seed 8/Beasts (Shriek, 4 attacks, 32 draws, won) — every number matches the plan's PRE-Phase-17 measurements exactly, which independently proves 17-02's extraction is draw-for-draw identical to the code it replaced.
- Every fight and micro case cross-checks the draw counter against mulberry32's own cursor arithmetic (`(start + Math.imul(draws, 0x6d2b79f5)) | 0 === rng.getState() | 0`), so a wrapper miscount or a missed-method bug would fail loudly.
- `FIXTURE-INVENTORY.md`'s `## Draw-count baseline (FID-02)` section now documents the pinned full-fight table, the per-foeTurn micro-pin table, and the Phase 19 contract (an ability-less foe, or one with `abilities: []`, must reproduce every number here unchanged; only a non-empty ability kit may add draws, gated per FID-04) — appended entirely below `fixture-inventory.test.js`'s marker-delimited generated block, which stays untouched.
- Full phase gate green: `npm test` 724/724 (up from 712 pre-plan: +12 from this plan), `node --test "test/parity/**/*.test.js"` 30/30 byte-identical, `node tools/fixture-inventory.mjs` output matches the doc's embedded table verbatim, and `git log c5fc219..HEAD` on the frozen master/fixtures/comparables/package manifest is empty.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write test/unit/foe-turn-draw-count.test.js with countingRng, micro pins, and full-fight pins** - `0e53533` (test)
2. **Task 2: Append the draw-count baseline to FIXTURE-INVENTORY.md and run the phase gate** - `3f512d2` (docs)

_No plan-metadata commit yet — STATE.md/ROADMAP.md updates follow this SUMMARY per the execute-plan protocol._

## Files Created/Modified
- `test/unit/foe-turn-draw-count.test.js` - `countingRng(inner)` helper, local `fakeRng`/`fixedFighter`/`fixedFloor`/`fixedState`/`fixedFoe`/`fixedCombat`/`assertNoAbilities` fixtures (mirroring `test/unit/party-combat.test.js`), a wrapper self-test, 6 per-foeTurn micro pins, and a table-driven set of 5 full-fixture-fight pins
- `test/parity/FIXTURE-INVENTORY.md` - replaced the plan-17-03 placeholder under `## Draw-count baseline (FID-02)` with the pinned full-fight table, the per-foeTurn micro-pin table, and the `### Phase 19 contract` paragraph

## Decisions Made
- Measured every pinned integer by actually running the counting wrapper against the current (post-17-02) engine rather than trusting the plan's numbers blindly — they matched exactly on the first run, which is itself evidence the 17-02 extraction preserved draw order/count byte-for-byte.
- `runFullFight`'s loop drives `startCombat` + `playerStrike` directly (not via `engine/engine.js#applyAction`'s per-action rehydration), reusing ONE `countingRng(makeRng(start))` object across the whole fight — the same "single rng object across the full sequence" shape `applyAction` achieves internally by persisting `rng.getState()` between calls, adapted here since the test isn't going through the action-dispatch seam.

## Deviations from Plan

None — plan executed exactly as written. All pinned draw counts, attack counts, and outcomes matched the plan's specified PRE-Phase-17 measurements on the first run against the post-17-02 engine.

## Issues Encountered

None specific to this plan. (The same environment quirk noted in 17-01/17-02's summaries — a bare `node --test test/parity` directory argument doesn't resolve on this Windows/Git-Bash environment — was again worked around with `node --test "test/parity/**/*.test.js"`, per the plan's own verification commands.)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 17 is complete: FID-01 (fixture inventory), FID-03 (foe-turn helper extraction), and FID-02 (this plan's draw-count baseline) are all delivered, tested, and documented.
- Phase 18 (Bestiary Rebalance) can consult `FIXTURE-INVENTORY.md`'s exposed-surface analysis before touching any creature's stats.
- Phase 19 (Foe Abilities/Spellcasting) has its exact "before" numeric baseline in `test/unit/foe-turn-draw-count.test.js` — its ability-attempt gate must re-run this file unchanged for any foe lacking a non-empty `abilities` kit, and can reuse `countingRng` verbatim for its own zero-draw proof.
- No blockers.

---
*Phase: 17-fixture-inventory-foe-turn-refactors*
*Completed: 2026-09-13*

## Self-Check: PASSED

All created/modified files verified present on disk with expected content; both task commits (`0e53533`, `3f512d2`) verified present in `git log`.
