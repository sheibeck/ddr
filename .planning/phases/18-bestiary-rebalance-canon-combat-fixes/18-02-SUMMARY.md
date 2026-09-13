---
phase: 18-bestiary-rebalance-canon-combat-fixes
plan: 02
subsystem: engine
tags: [engine, combat, damage-seam, content-table, narration, determinism, node-test]

# Dependency graph
requires:
  - phase: 18-bestiary-rebalance-canon-combat-fixes (18-01)
    provides: "confirmed fixture-exposed roster and outlier list used to prove this seam is zero parity risk"
provides:
  - "engine/foeDamage.js — damageFoe(state, foe, rawDmg, source, rng, events) and multiplierFor(source, foe), the single foe-damage seam locking multiplier -> halfDmg -> armor-soak -> wp-decrement, returning { applied, soaked, mult }, never calling killFoe"
  - "content/damage-multipliers.js — DAMAGE_MULTIPLIERS pure 3-row table (Cleric spell x2 vs Demons, any spell x2 vs Walking Dead, Fighter melee x2 vs Trachea), barrel-exported and pinned"
  - "foeArmorSoaked { name, amount } event + family-friendly EVENT_NARRATION entry"
  - "test/unit/foe-damage.test.js — 18 dedicated fakeRng tests pinning boundaries, zero-draw gates, bypasses, ceil ladder, multiplier rows, ordering, no-kill contract"
affects: [18-03, 18-04, 18-05, 18-06, 19-foe-abilities-spellcasting-symmetric-int-resistance]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-seam damage routing (engine/foeDamage.js) mirroring the existing applyFoeDamageToPlayer player-side pattern"
    - "Content table with uniform-key wildcard (null) rows, matching function kept out of content/ per the pure-data guard"

key-files:
  created:
    - engine/foeDamage.js
    - content/damage-multipliers.js
    - test/unit/foe-damage.test.js
  modified:
    - content/index.js
    - src/browser/eventNarration.js
    - test/unit/content-tables.test.js

key-decisions:
  - "Implemented damageFoe/multiplierFor exactly per the plan's locked order (multiplier -> halfDmg -> soak) and return shape; no deviation needed"
  - "No call site (combat.js/magic.js/items.js) is routed through the seam yet — that is 18-03/18-04's job; this plan only builds and tests the seam in isolation"

requirements-completed: [CANON-01, CANON-03, CANON-04]

coverage:
  - id: D1
    description: "content/damage-multipliers.js exports the pure 3-row DAMAGE_MULTIPLIERS table, barrel-exported and pinned verbatim in test/unit/content-tables.test.js"
    requirement: "CANON-04"
    verification:
      - kind: unit
        ref: "test/unit/content-tables.test.js#DAMAGE_MULTIPLIERS (CANON-04, D-11): exactly the three canon rows, hero-only Trachea (D-20)"
        status: pass
      - kind: unit
        ref: "test/determinism/content-is-pure-data.test.js#content/*.js exports contain no function-typed leaves (pure data only)"
        status: pass
    human_judgment: false
  - id: D2
    description: "engine/foeDamage.js's damageFoe seam applies multiplier -> halfDmg -> armor-soak -> wp-decrement in that locked order, returns { applied, soaked, mult }, and never calls killFoe/touches foe.alive"
    requirement: "CANON-01"
    verification:
      - kind: unit
        ref: "test/unit/foe-damage.test.js (18 tests: boundaries, zero-draw gates, crit/spell bypass, physical-kinds-soakable, D-09 no-kill, ordering)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Sterling's halfDmg ceil-halving applies to every source kind, running after the multiplier and before the soak"
    requirement: "CANON-03"
    verification:
      - kind: unit
        ref: "test/unit/foe-damage.test.js#D-10 halfDmg ceil ladder across kinds, #ordering: multiplier before halfDmg"
        status: pass
    human_judgment: false
  - id: D4
    description: "foeArmorSoaked event is emitted on a soaked blow and narrated by a family-friendly, deadpan EVENT_NARRATION entry"
    verification:
      - kind: unit
        ref: "test/unit/formatEventsCoverage.test.js, test/voice/safety-scan.test.js (full suite run, both green)"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-09-13
status: complete
---

# Phase 18 Plan 02: Foe-Damage Seam (CANON-01/03/04) Summary

**New `engine/foeDamage.js` seam (`damageFoe`/`multiplierFor`) locking the foe natural-armor d20 soak, Sterling's ceil-halving, and the damage-source x creature-type multiplier table into one function, built and tested in isolation ahead of the 18-03/18-04 call-site routing.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-09-13T23:09:51Z (approx, from prior commit's STATE.md timestamp)
- **Completed:** 2026-09-13T23:17:23Z
- **Tasks:** 2 completed
- **Files modified:** 6 (2 created new, 1 new + 3 modified — see Files Created/Modified)

## Accomplishments

- Built `content/damage-multipliers.js`: a pure, function-free 3-row `DAMAGE_MULTIPLIERS` table (Cleric spells x2 vs Demons, any spell x2 vs Walking Dead, Fighter melee x2 vs Trachea — hero-only per D-20), barrel-exported from `content/index.js` and pinned verbatim in `test/unit/content-tables.test.js`.
- Built `engine/foeDamage.js`: the single foe-damage seam. `multiplierFor(source, foe)` is the pure lookup (max-not-product across overlapping rows, default 1 on any miss). `damageFoe(state, foe, rawDmg, source, rng, events)` applies, in the plan's locked order, (1) the multiplier, (2) Sterling's `halfDmg` ceil-halving, (3) the natural-armor d20 soak (gated on `physical && !crit && foe.sp.ar > 0` — the module's only rng draw), then (4) the wp decrement, returning `{ applied, soaked, mult }` and never touching `foe.alive`/`killFoe`/`foeKilled` (D-09).
- Added the `foeArmorSoaked { name, amount }` event and its `EVENT_NARRATION` entry ("Your blow rings off ...'s armor. It looks bored."), which passes both the coverage guard and the voice safety scan.
- Wrote 18 dedicated `fakeRng` unit tests in `test/unit/foe-damage.test.js` covering: zero-draw no-flag path, rawDmg <= 0, the ar-12 soak boundary (12 soaks / 13 lands), ar 20 always soaks / ar 0 and absent ar/sp never draw, the D-07 crit bypass, the D-06 spell bypass, all four physical kinds (ally/foe/reflect/item) being soakable, the D-10 ceil ladder (7->4, 8->4, 5->3, 1->1, 2->1, 3->2), the halfDmg+ar interaction reporting the halved soak amount, all three CANON-04 rows plus their negative cases (wrong caster, wrong kind, ally-not-hero for Trachea), max-not-product concurrency, cross-call idempotency, multiplier-before-halfDmg ordering, table-miss fallback to 1, `multiplierFor` called directly, and the D-09 no-kill contract (wp goes negative, `alive` stays true, no events).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add content/damage-multipliers.js, export it from the barrel, and pin it in content-tables.test.js** - `99a4850` (feat)
2. **Task 2: Create engine/foeDamage.js (damageFoe + multiplierFor), the foeArmorSoaked narration entry, and test/unit/foe-damage.test.js** - `f3182aa` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `content/damage-multipliers.js` - New pure-data `DAMAGE_MULTIPLIERS` table (3 rows), no imports, no functions.
- `content/index.js` - Added `export * from "./damage-multipliers.js";` to the barrel.
- `test/unit/content-tables.test.js` - Added `DAMAGE_MULTIPLIERS` to the import list and a `deepStrictEqual` pin test.
- `engine/foeDamage.js` - New seam module: `damageFoe` and `multiplierFor`, exactly one `rng.d(20)` draw site, exactly one emitted event type.
- `src/browser/eventNarration.js` - Added the `foeArmorSoaked` narration entry directly after `armorSoaked`.
- `test/unit/foe-damage.test.js` - New file, 18 tests exercising the seam's full contract via `fakeRng`.

## Decisions Made

- Implemented `damageFoe`/`multiplierFor` exactly to the plan's locked order and return shape — no ambiguity required a judgment call.
- No call site in `engine/combat.js`, `engine/magic.js`, or `engine/items.js` was touched — routing them through the new seam is explicitly out of scope for this plan (18-03/18-04) and verified untouched via `git status --porcelain`.

## Deviations from Plan

None - plan executed exactly as written. All acceptance-criteria greps (export signatures, single rng draw site, zero killFoe/.alive/foeKilled/combat.js references, single emitted event type, ordering via awk, narration content) and all specified test counts passed on the first implementation.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `engine/foeDamage.js` and `content/damage-multipliers.js` are ready for 18-03/18-04 to route the ten scattered foe-wp decrement sites in `combat.js`/`magic.js`/`items.js` through `damageFoe`, and for Phase 19's ability resolver to reuse the same seam.
- `npm test` is green at 753/753 (734 baseline + 1 new content-table test + 18 new foe-damage tests); `test/parity`, `package.json`, and the three not-yet-routed engine files (`combat.js`, `magic.js`, `items.js`) are byte-identical to before this plan.
- No blockers for 18-03/18-04.

---
*Phase: 18-bestiary-rebalance-canon-combat-fixes*
*Completed: 2026-09-13*

## Self-Check: PASSED

- FOUND: content/damage-multipliers.js
- FOUND: engine/foeDamage.js
- FOUND: test/unit/foe-damage.test.js
- FOUND commit: 99a4850 (Task 1)
- FOUND commit: f3182aa (Task 2)
