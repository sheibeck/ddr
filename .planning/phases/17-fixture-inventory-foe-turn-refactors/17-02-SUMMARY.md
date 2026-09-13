---
phase: 17-fixture-inventory-foe-turn-refactors
plan: 02
subsystem: engine
tags: [combat, refactor, foe-turn, determinism, parity, node-test]

# Dependency graph
requires:
  - phase: 17-01
    provides: "test/parity/harness/fixtureRoster.js and FIXTURE-INVENTORY.md — read-only context, no file overlap with this plan"
provides:
  - "pickFoeTarget(state, rng) — exported engine/combat.js helper; chooses null (hero) or a live C.allies member with a single gated rng.d() draw"
  - "applyFoeDamageToPlayer(state, foe, rng, events, { dmg, roll, need }) — exported engine/combat.js helper; the Hardiness-onward hero-damage pipeline (halfNext, ward absorb/reflect/shatter, armor soak, struckByFoe, die()) returning { died, onArmour }"
  - "foeTurn re-wired to call both helpers; the member-damage branch stays untouched and separate"
affects: ["19 (foe abilities/spellcasting resolver imports pickFoeTarget + applyFoeDamageToPlayer from engine/combat.js instead of duplicating targeting/damage logic)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Result-object signaling ({ died, onArmour }) so an extracted helper can communicate a caller's required early-return without itself controlling the caller's loop/return flow"
    - "died is set ONLY at the c.wp<=0 branch, never at a ward-reflect f.wp<=0 branch, so a foe's own reflect-death cannot be conflated with the hero's death (Pitfall 1)"
    - "The caller's first and only statement after the helper call on any path is `if (hit.died) return events;` — no state.combat/C reads after a death signal, since die() has already nulled state.combat (Pitfall 2)"

key-files:
  created: []
  modified:
    - engine/combat.js
    - test/unit/party-combat.test.js
    - test/unit/combat.test.js

key-decisions:
  - "Options-object signature (state, foe, rng, events, { dmg, roll, need }) per CONTEXT.md's small-rng-explicit-signature preference, superseding RESEARCH.md's positional-args draft signature — locked by the plan's Assumption A1 resolution"
  - "Internal alias `const f = foe` was NOT used inside applyFoeDamageToPlayer (unlike foeTurn's own `f` convention) — every reference uses the `foe` parameter directly, so the helper's killFoe/die call sites read literally as `killFoe(state, foe, rng, events)` / `die(state, \"combat\", foe.name, rng, events)`, matching the plan's acceptance-criteria greps verbatim"
  - "The simplified member-damage branch (foeTurn's `if (member) { ... }` block) is deliberately left untouched and NOT routed through applyFoeDamageToPlayer — confirmed via a diff-emptiness check against the phase-start commit"

patterns-established:
  - "Any future foe-turn-adjacent extraction (e.g. Phase 19's ability-attempt gate) should follow the same result-object contract rather than having the new code `return` from foeTurn directly"

requirements-completed: [FID-03]

coverage:
  - id: D1
    description: "pickFoeTarget(state, rng) extracted from foeTurn's inline target-pool block as a named, documented export with the same zero-draw gate"
    requirement: "FID-03"
    verification:
      - kind: unit
        ref: "test/unit/party-combat.test.js (6 new tests: zero-draw on absent/empty/all-downed allies, pick->target mapping, downed exclusion, pool die size)"
        status: pass
      - kind: unit
        ref: "test/unit/party-combat.test.js + test/unit/combat.test.js pre-existing foeTurn/target-pool tests, unmodified"
        status: pass
    human_judgment: false
  - id: D2
    description: "applyFoeDamageToPlayer(state, foe, rng, events, { dmg, roll, need }) extracted (Hardiness onward) with a { died, onArmour } return contract; foeTurn's hero branch re-wired to to-hit + raw damage + one helper call + the died early-return"
    requirement: "FID-03"
    verification:
      - kind: unit
        ref: "test/unit/combat.test.js (13 new direct helper tests + 4 new foeTurn control-flow tests: plain hit/key-order, Hardiness floor, halfNext, Hardiness-before-halfNext, ward absorb/shatter/reflect-kill, armor soak/miss/destroyed, noArmor skip, lethal died:true, critical passthrough, plus foeTurn-level ward-reflect-continue, hero-death-early-return, partial-ward-shatter, Hardiness-then-halfNext)"
        status: pass
      - kind: unit
        ref: "test/unit/combat.test.js pre-existing foeTurn tests (crit-lethal, armor soak, Cloak of Armor E8 pair, sleeping foe), unmodified"
        status: pass
    human_judgment: false
  - id: D3
    description: "Full parity suite stays byte-identical to the frozen prototype master with zero fixture/harness/master edits; npm test green"
    requirement: "FID-03"
    verification:
      - kind: unit
        ref: "node --test \"test/parity/**/*.test.js\" (30/30 passing, git status --porcelain test/parity empty)"
        status: pass
      - kind: unit
        ref: "npm test (712/712 passing)"
        status: pass
    human_judgment: false
duration: 20min
completed: 2026-09-13
status: complete
---

# Phase 17 Plan 02: Foe-Turn Refactors Summary

**Extracted pickFoeTarget and applyFoeDamageToPlayer (Hardiness onward, { died, onArmour } contract) from foeTurn's hero-damage branch in engine/combat.js, behavior-preserving with 23 new unit tests and a byte-identical parity suite**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-09-13T20:17:42Z
- **Tasks:** 2/2
- **Files modified:** 3 (engine/combat.js, test/unit/party-combat.test.js, test/unit/combat.test.js)

## Accomplishments
- `pickFoeTarget(state, rng)` is now an exported, documented helper in `engine/combat.js` — a pure extraction of the inline live-member target-pool block (Phase 8 PARTY-04/05) with the exact same zero-draw gate (no `rng.d()` call unless at least one live `C.allies` member exists).
- `applyFoeDamageToPlayer(state, foe, rng, events, { dmg, roll, need })` is now an exported, documented helper carrying the entire Hardiness-onward hero-damage pipeline: Hardiness reduction, the Pendant of Fortitude's `halfNext`, ward absorb/reflect/shatter (a reflect-kill of the foe correctly signals `{ died: false }`), the `rng.d(20)` armor-soak roll via `armorSoak(c)`, the `struckByFoe` event, and `die()` on lethal — returning `{ died, onArmour }` so `foeTurn` preserves its exact early-return-on-death control flow.
- `foeTurn`'s hero branch shrank to: to-hit roll, raw damage computation (weakened halving, critical doubling — both stay inline since they're swing-scoped, not part of the damage-pipeline boundary), one call to `applyFoeDamageToPlayer`, and `if (hit.died) return events;`.
- The simplified member-damage branch (no ward/armor/Hardiness/die) is confirmed untouched by a diff-emptiness check against the phase-start commit — the deliberate asymmetry between the hero and member paths is preserved, not unified.
- 6 new `pickFoeTarget` unit tests (party-combat.test.js) and 17 new `applyFoeDamageToPlayer`/foeTurn-control-flow unit tests (combat.test.js) pin the zero-draw gates, the pick->target mapping, downed-member exclusion, the pipeline order (Hardiness before halfNext), the ward-reflect non-death signal (Pitfall 1), the death early-return contract (Pitfall 2), armor-soak/miss/destroyed/noArmor paths, and the critical-flag passthrough.
- Every pre-existing unit test (48 in combat.test.js, 61 in party-combat.test.js) passes unmodified; the full parity suite (30 tests) stays byte-identical to the frozen prototype master with zero fixture/harness/master edits; `npm test` is 712/712 green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract pickFoeTarget and re-wire foeTurn's target selection; add direct unit coverage** - `d084400` (feat)
2. **Task 2: Extract applyFoeDamageToPlayer (Hardiness onward) with the { died, onArmour } signal; add helper + foeTurn control-flow tests** - `95303d1` (feat)

_No plan-metadata commit yet — STATE.md/ROADMAP.md updates follow this SUMMARY per the execute-plan protocol._

## Files Created/Modified
- `engine/combat.js` - added `pickFoeTarget(state, rng)` and `applyFoeDamageToPlayer(state, foe, rng, events, { dmg, roll, need })` as new named exports placed before `foeTurn`; `foeTurn`'s swing loop re-wired to call both; member branch and end-of-turn ward/mirror tick untouched
- `test/unit/party-combat.test.js` - 6 new `pickFoeTarget` tests (67 total, up from 61)
- `test/unit/combat.test.js` - 13 new direct `applyFoeDamageToPlayer` tests + 4 new foeTurn-level control-flow tests (65 total, up from 48)

## Decisions Made
- Locked the options-object signature `(state, foe, rng, events, { dmg, roll, need })` per CONTEXT.md's preference for small, rng-explicit signatures, resolving RESEARCH.md's Open Question 1/Assumption A1 in favor of the options-object form the plan itself specified (rather than RESEARCH.md's earlier positional-args draft).
- Chose NOT to alias `const f = foe` inside `applyFoeDamageToPlayer` (even though `foeTurn` itself uses `f` as its loop variable name) so every internal reference reads as the literal `foe` parameter — this was a deliberate authoring choice to keep the helper's `killFoe(state, foe, rng, events)` and `die(state, "combat", foe.name, rng, events)` call sites textually self-documenting, matching the plan's own written acceptance-criteria greps exactly.
- Kept the simplified member-damage branch completely separate, per the plan's explicit prohibition against unifying it with the hero pipeline — verified via `git diff -U0 <phase-start> -- engine/combat.js | grep -E '^[+-]'` returning zero matches for `mDmg|mRoll|mNeed|memberStruck|downMember(state, member, events)`.

## Deviations from Plan

None — plan executed exactly as written. One self-correction during authoring: my first draft of `applyFoeDamageToPlayer` used an internal `const f = foe` alias (mirroring `foeTurn`'s own style), which caused the acceptance-criteria grep for the literal string `killFoe(state, foe, rng, events)` to return 0 instead of 1. Caught by running the plan's own acceptance-criteria checks before committing; fixed by using the `foe` parameter directly throughout the helper (no behavior change, pure naming) and re-verified all greps and the full test suite before committing Task 2.

## Issues Encountered
- Same environment quirk noted in 17-01's SUMMARY: a bare `node --test test/parity` directory argument doesn't resolve on this Windows/Git-Bash environment. Used `node --test "test/parity/**/*.test.js"` (30/30 passing) and `npm test` (712/712 passing) instead, per the plan's own `<verification>` section and STATE.md's Engine gate.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- FID-03's shared, tested helpers are in place: Phase 19's foe-ability resolver (`engine/foeAbilities.js`) can `import { pickFoeTarget, applyFoeDamageToPlayer } from "./combat.js"` and reuse the melee path's targeting and ward/armour/damage pipeline instead of duplicating it, exactly as scoped.
- No blockers for 17-03 (the draw-count regression baseline) — this plan did not touch `test/parity/FIXTURE-INVENTORY.md`'s placeholder heading or add any new RNG draw to any gated/ungated path; the pre-refactor and post-refactor draw order and count are identical (proven by the byte-identical parity suite and the fakeRng throw-on-underflow unit tests).

---
*Phase: 17-fixture-inventory-foe-turn-refactors*
*Completed: 2026-09-13*

## Self-Check: PASSED

All modified files verified present on disk with the expected exports; both task commits (`d084400`, `95303d1`) verified present in `git log`.
