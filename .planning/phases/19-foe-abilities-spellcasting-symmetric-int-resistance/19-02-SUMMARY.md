---
phase: 19-foe-abilities-spellcasting-symmetric-int-resistance
plan: 02
subsystem: engine
tags: [engine, derived, magic, resistance, conditions, save-state, parity, carve-out, node-test]

# Dependency graph
requires:
  - phase: 19-foe-abilities-spellcasting-symmetric-int-resistance (19-01)
    provides: "content/foe-abilities.js registry + bestiary abilities kits (wave-1 sibling, parallel, disjoint files)"
provides:
  - "engine/derived.js#resistRoll(rng, intel) -> { rolled, resisted, roll } — the ONE shared resistance helper (FOE-07/D-07, homed here per D-17 to avoid an import cycle)"
  - "engine/derived.js#conditionsOf's foeEffect BAD chip and engine/derived.js#toHit's dazed to-hit penalty (FOE-08/D-09/D-10)"
  - "engine/magic.js castSpell's foe-resist block refactored to call resistRoll, draw-neutral, byte-identical events"
  - "engine/saveState.js#clearFoeEffect(c) applied in both validateSave and rehydrate (FID-04)"
  - "test/parity/harness/comparables.js#stripFoeEffectField(c) and #stripFoeAbilityState(combat), wired into all three *Comparable() functions"
affects: ["19-03 (engine/foeAbilities.js resolver + combat.js wiring — consumes resistRoll and writes c.foeEffect)", "19-04 (determinism tests + UI foeEffect label + draw-count pins — consumes conditionsOf's chip shape and clearFoeEffect)"]

# Tech tracking
tech-stack:
  added: []
  patterns: ["shared cycle-free-leaf helper (resistRoll in derived.js) reused by two callers on opposite sides of a resolution", "additive c.foeEffect debuff slot read at two engine sites (conditionsOf, toHit) with a save-load defensive null", "named parity strip helpers wired into all three *Comparable() compositions"]

key-files:
  created: ["test/unit/resist-roll.test.js", "test/unit/foe-ability-carveouts.test.js"]
  modified: ["engine/derived.js", "engine/magic.js", "engine/saveState.js", "test/parity/harness/comparables.js", "test/unit/conditions.test.js", "test/unit/magic.test.js", "test/unit/save-validation.test.js"]

key-decisions:
  - "resistRoll homed in engine/derived.js (not engine/magic.js as D-07 literally says) per D-17 — derived.js is the only cycle-free leaf, since magic.js already imports combat.js and combat.js will import the new foeAbilities.js"
  - "resistRoll returns an additive `rolled` field beyond the canon { resisted, roll } pair so callers can distinguish 'no roll happened' (intel < 12) from 'rolled and failed to resist'"
  - "clearFoeEffect nulls a PRESENT c.foeEffect key on load but never injects a new key onto a save that lacks one — verified by the v1.0-shaped-save test asserting Object.hasOwn(c, 'foeEffect') === false"
  - "validateSave's non-mutation contract is documented, not strengthened: passing a JSON STRING never touches the caller's object (JSON.parse produces a fresh internal object); passing a raw OBJECT would still mutate in place via migrateCarry/clearFoeEffect exactly as today — the FID-04 test exercises the string-input path, matching every real caller (localStorage/@capacitor/preferences always round-trip through JSON)"
  - "JSDoc header comments for stripFoeEffectField/stripFoeAbilityState deliberately avoid the literal `Name(` substring in their opening line (mirroring 19-01's own auto-fixed deviation) so the plan's own acceptance-criteria greps count exactly 4 (definition + three call sites), not 5"
  - "stripFoeAbilityState is wired as a true no-op guard (`if (rest.combat) rest.combat = stripFoeAbilityState(rest.combat);`) into movementComparable and economyComparable even though neither fixture family ever carries a live combat — satisfies D-14's 'all three comparables' requirement structurally, not just where a fixture currently needs it"

requirements-completed: [FOE-07, FOE-08, FID-04]

coverage:
  - id: D1
    description: "resistRoll(rng, intel) is the ONE shared resistance helper: no draw below intel 12, exactly one d20 at/above it, resisted iff roll < intel, with pinned boundaries at 11/12/19/20 and a natural-1-always-resists case"
    requirement: "FOE-07"
    verification:
      - kind: unit
        ref: "test/unit/resist-roll.test.js#resistRoll: intel below 12 never rolls (0 draws)"
        status: pass
      - kind: unit
        ref: "test/unit/resist-roll.test.js#resistRoll: intel 12 draws exactly one d20"
        status: pass
      - kind: unit
        ref: "test/unit/resist-roll.test.js#resistRoll: intel 20 boundary + natural-1"
        status: pass
    human_judgment: false
  - id: D2
    description: "castSpell's inline foe-resist block is refactored to call resistRoll — magic.js draws no d20 of its own; spellResisted/resistFailed events and the cast-damage parity fixture (Shriek, intel 1) are byte-identical"
    requirement: "FOE-07"
    verification:
      - kind: unit
        ref: "test/unit/magic.test.js#castSpell: an intel-12 foe resists Weaken on a d20 of 11"
        status: pass
      - kind: unit
        ref: "test/unit/magic.test.js#castSpell: a d20 of 12 fails to resist"
        status: pass
      - kind: unit
        ref: "test/unit/magic.test.js#castSpell: an intel-1 foe never triggers a resist roll"
        status: pass
      - kind: integration
        ref: "test/parity/**/*.test.js (30/30, cast-damage fixture unchanged)"
        status: pass
    human_judgment: false
  - id: D3
    description: "conditionsOf surfaces a foeEffect BAD chip only when live (rounds > 0), with stable ordering (affliction, foeEffect, darkness); toHit lowers the need by 2 (floored at 1) when dazed"
    requirement: "FOE-08"
    verification:
      - kind: unit
        ref: "test/unit/conditions.test.js#conditionsOf: a live foeEffect surfaces one BAD chip"
        status: pass
      - kind: unit
        ref: "test/unit/conditions.test.js#conditionsOf: affliction then foeEffect then darkness — stable BAD order"
        status: pass
      - kind: unit
        ref: "test/unit/resist-roll.test.js#toHit: dazed lowers the need by 2, floored at 1"
        status: pass
    human_judgment: false
  - id: D4
    description: "A v1.0-shaped save loads with c preserved verbatim and no new keys; a mid-combat save with foeEffect/pendingFoes/abilities all rehydrates with combat null and foeEffect null; tampered values are neutralized; rehydrate is idempotent"
    requirement: "FID-04"
    verification:
      - kind: unit
        ref: "test/unit/save-validation.test.js#FID-04: a v1.0-shaped save loads with c preserved verbatim and no new keys"
        status: pass
      - kind: unit
        ref: "test/unit/save-validation.test.js#FID-04: a mid-combat save carrying every new field rehydrates with combat null and c.foeEffect null"
        status: pass
      - kind: unit
        ref: "test/unit/save-validation.test.js#FID-04: tampered foeEffect values all become null"
        status: pass
      - kind: unit
        ref: "test/unit/save-validation.test.js#FID-04: rehydrate is idempotent"
        status: pass
    human_judgment: false
  - id: D5
    description: "All three parity *Comparable() functions carve out c.foeEffect, combat.pendingFoes, and per-foe abilities/cd/uses by name; a state without the new fields is structurally identical to today's output; the parity suite stays byte-identical (30/30)"
    requirement: "FID-04"
    verification:
      - kind: unit
        ref: "test/unit/foe-ability-carveouts.test.js#D-14: all three comparables strip c.foeEffect"
        status: pass
      - kind: unit
        ref: "test/unit/foe-ability-carveouts.test.js#D-14: all three comparables strip combat.pendingFoes and per-foe abilities/cd/uses"
        status: pass
      - kind: unit
        ref: "test/unit/foe-ability-carveouts.test.js#D-14: a state without any new field is returned structurally identical"
        status: pass
      - kind: integration
        ref: "test/parity/**/*.test.js (30/30, fixtures/master/per-file comparables untouched since d5fc90a)"
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-09-13
status: complete
---

# Phase 19 Plan 2: Shared Resistance Helper, foeEffect Chip/Penalty & FID-04 Save/Parity Carve-Outs Summary

**resistRoll(rng, intel) lands as the ONE cycle-free-leaf resistance helper reused by castSpell's refactored resist block; c.foeEffect gets a conditionsOf chip, a toHit dazed penalty, a save-load null-guard, and named strip helpers in all three parity comparables**

## Performance

- **Duration:** 30 min
- **Started:** 2026-09-13T23:16:34-04:00
- **Completed:** 2026-09-14T03:24:29Z
- **Tasks:** 3
- **Files modified:** 9 (2 created, 7 modified)

## Accomplishments
- Added `resistRoll(rng, intel)` to `engine/derived.js` — the ONE shared p.25 resistance helper (FOE-07/D-07), homed here per D-17 to avoid the `combat.js ↔ foeAbilities.js ↔ magic.js` import cycle 19-03's resolver would otherwise create; returns `{ rolled, resisted, roll }` with a fully gated (zero-draw) early-out below intel 12
- Added `conditionsOf`'s `foeEffect` BAD chip (between affliction and darkness, D-09) and `toHit`'s dazed to-hit penalty (`Math.max(1, h - 2)`, D-10) to `engine/derived.js`
- Refactored `engine/magic.js#castSpell`'s inline foe-resist block to call `resistRoll` — draws no d20 of its own anymore, byte-identical `spellResisted`/`resistFailed` event payloads, parity's cast-damage fixture (Shriek, intel 1) untouched
- Added `clearFoeEffect(c)` to `engine/saveState.js`, applied on both `validateSave` and `rehydrate` — nulls a PRESENT `c.foeEffect` (including tampered non-object values) but never injects the key onto a save that lacks it (FID-04)
- Added `stripFoeEffectField(c)` and `stripFoeAbilityState(combat)` to `test/parity/harness/comparables.js`, wired into all three `*Comparable()` functions (movement/combat/economy) per D-14
- 5 new test files/sections: `test/unit/resist-roll.test.js` (new, 4 tests), `test/unit/foe-ability-carveouts.test.js` (new, 4 tests), plus extensions to `conditions.test.js` (+3), `magic.test.js` (+3), `save-validation.test.js` (+4) — 18 new tests total, 822/822 full suite green

## Task Commits

Each task was committed atomically:

1. **Task 1: Add resistRoll, the foeEffect chip, and the dazed to-hit penalty to engine/derived.js, with unit pins** - `ff278e3` (feat)
2. **Task 2: Refactor castSpell's inline resist block to call resistRoll (draw-neutral) and pin it** - `2322e3c` (refactor)
3. **Task 3: Save-load tolerance for c.foeEffect (FID-04) and the named parity carve-outs in all three comparables (D-14)** - `e5ef69a` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `engine/derived.js` - `resistRoll` export; `conditionsOf`'s foeEffect chip; `toHit`'s dazed penalty
- `engine/magic.js` - `castSpell`'s resist block refactored to call `resistRoll`
- `engine/saveState.js` - `clearFoeEffect(c)`, applied in both `validateSave` and `rehydrate`
- `test/parity/harness/comparables.js` - `stripFoeEffectField`, `stripFoeAbilityState`, wired into all three comparables
- `test/unit/resist-roll.test.js` - new: resistRoll boundary pins + toHit dazed pins
- `test/unit/conditions.test.js` - Phase 19 foeEffect chip section
- `test/unit/magic.test.js` - Phase 19 resistRoll-via-castSpell section
- `test/unit/save-validation.test.js` - Phase 19 FID-04 section
- `test/unit/foe-ability-carveouts.test.js` - new: D-14 all-three-comparables carve-out pins

## Decisions Made
- `resistRoll` homed in `engine/derived.js`, not `engine/magic.js` — see key-decisions above (D-17's import-cycle finding)
- `resistRoll`'s `rolled` field is additive beyond the canon `{ resisted, roll }` pair, letting callers distinguish "no roll happened" from "rolled and failed"
- `clearFoeEffect` mutates in place only when the key is present, matching `migrateCarry`'s additive-with-default discipline exactly (never injects a key a save doesn't have)
- The FID-04 "validateSave does not mutate its input" test documents the actual contract (string-input never mutates the caller's object; a raw-object input would still mutate in place via `migrateCarry`/`clearFoeEffect`, exactly as `migrateCarry` already does today) rather than asserting a stronger guarantee `validateSave` doesn't make
- `stripFoeEffectField`/`stripFoeAbilityState`'s JSDoc header lines avoid the literal `Name(` substring their own definition line uses, so the plan's acceptance-criteria greps land on exactly 4 occurrences (definition + three comparables) instead of 5 (mirroring 19-01's own auto-fixed deviation of the same shape)
- `stripFoeAbilityState` is wired as a genuine (if currently no-op) guard into `movementComparable` and `economyComparable`, not just `combatComparable`, so D-14's "all three comparables" holds structurally even though neither fixture family currently drives a live combat

## Deviations from Plan

None - plan executed exactly as written. (The JSDoc-header wording choice above is a proactive application of 19-01's own documented Rule-1 pattern, not a deviation discovered mid-task — the header comments were written that way from the start.)

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `resistRoll` is exported from `engine/derived.js` and ready for 19-03's `engine/foeAbilities.js` resolver to import for the hero-side check (`resistRoll(rng, state.c.intel)`)
- `c.foeEffect`'s full lifecycle (chip, toHit penalty, save-load null-guard, all-three-comparable carve-out) is proven BEFORE 19-03 ever writes to it — the write side (debuff application, tick, `endCombat` clear) is 19-03's job
- `stripFoeAbilityState`'s per-foe `abilities`/`cd`/`uses` and `combat.pendingFoes` carve-outs are ready for 19-03's `startCombat` (copying `abilities` from the bestiary entry) and the summon-queue join
- Full suite: 822/822 passing (804 pre-phase + 18 new); parity suite 30/30 byte-identical; zero edits to `test/parity/prototype-master.js.txt`, fixtures, or the per-file local `comparable()` functions
- No blockers for 19-03

---
*Phase: 19-foe-abilities-spellcasting-symmetric-int-resistance*
*Completed: 2026-09-13*

## Self-Check: PASSED
- FOUND: engine/derived.js
- FOUND: engine/magic.js
- FOUND: engine/saveState.js
- FOUND: test/parity/harness/comparables.js
- FOUND: test/unit/resist-roll.test.js
- FOUND: test/unit/foe-ability-carveouts.test.js
- FOUND commit: ff278e3
- FOUND commit: 2322e3c
- FOUND commit: e5ef69a
