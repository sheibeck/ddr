---
phase: 23-casters-can-act-wizard-summoner-illusionist-guaranteed-attack-spell
plan: 02
subsystem: engine
tags: [engine, chargen, grimoire, guaranteed-attack, parity, fixture-divergence, fid-06]

# Dependency graph
requires:
  - phase: 23-casters-can-act-wizard-summoner-illusionist-guaranteed-attack-spell
    provides: "Plan 01: spellLevelFor, ATTACK_SPELL_KINDS/isAttackSpell/castableAttackSpells (engine/derived.js), SPELL_LEVEL_OVERRIDES (content), the pre-Phase-23 chargen rng-pin test"
provides:
  - "engine/character.js#rollGrimoire — zero-draw guaranteed day-one ATTACK spell for every non-Summoner Magic User (IDENT-02); usableNow routed through spellLevelFor for the ready-count only, spare pool predicate frozen"
  - "test/unit/guaranteed-attack-spell.test.js — >=200 forced seeds x 8 subs: guarantee, Summoner exemption, no duplicates, old-vs-new adjacency bound, zero-draw proof"
  - "test/parity/fixtures/action-script.chargen.json — divergences block (seeds 15, 24) with measured before/after grimoire + rationale"
  - "test/parity/harness/comparables.js — chargenDivergenceFor/stripDeclaredFields (the seed-scoped, field-scoped FID-06 divergence pattern)"
  - "test/parity/fixtures/action-script.schema.md — divergences/divergence documented"
affects: [23-03-wizard-melee-rule, 23-04-freeze-pays-out]

tech-stack:
  added: []
  patterns:
    - "Seed-scoped, field-scoped fixture divergence records (chargenDivergenceFor/stripDeclaredFields), modelled on stripParleyDivergence's precedent, for a SEED-SET fixture rather than a single scenario"
    - "diffState (not assert.deepStrictEqual) for any before/after assertion that compares a vm-sandboxed prototype value against a plain JS value — deepStrictEqual fails on cross-realm array/object reference-equality checks even when structurally identical"

key-files:
  created:
    - test/unit/guaranteed-attack-spell.test.js
  modified:
    - engine/character.js
    - test/parity/fixtures/action-script.chargen.json
    - test/parity/fixtures/action-script.schema.md
    - test/parity/harness/comparables.js
    - test/parity/chargen-parity.test.js
    - test/parity/full-suite.test.js

key-decisions:
  - "rollGrimoire keeps two distinct predicates: `dayOnePool` (byte-identical to the pre-Phase-23 `usableNow`, drives the `spare` array's length/shuffle) and an override-aware `usableNow` (routed through spellLevelFor, drives only the ready() count and the attack top-up) — never merged, per the planner's measured constraint that letting spellLevelFor widen `spare` shifts the rng cursor for seeds 8 and 15."
  - "The attack top-up walks the SAME already-shuffled `spare` array with no new rng call; the `sub !== \"Summoner\"` guard is belt-and-braces since a Summoner's `spare` (built from the frozen dayOnePool) never contains an attack-kind spell anyway (offense gated to level 3)."
  - "Cross-realm comparison bug found and fixed during Task 3: `assert.deepStrictEqual` against a vm-sandboxed prototype array fails Node's reference-equality check even when the values are structurally identical (different Array.prototype per realm). Switched to `diffState` (which strips via structuredClone first) for both chargen replay sites' before/after divergence assertions — the same fix as an inline Rule 1 auto-fix, not a plan change."

requirements-completed: [IDENT-02, IDENT-03, FID-06]

coverage:
  - id: D1
    description: "Every non-Summoner Magic User (Wizard/Warlock/Sorcerer/Cleric/Illusionist/Court Mage/Apprentice) has at least one usable-now attack spell (Doze/Freeze/Stun/Weaken) at level 1, over 200 forced seeds each"
    requirement: "IDENT-02"
    verification:
      - kind: unit
        ref: "test/unit/guaranteed-attack-spell.test.js — 'IDENT-02: every non-Summoner Magic User sub has a usable-now attack spell at level 1'"
        status: pass
    human_judgment: false
  - id: D2
    description: "A Summoner is exempt from the attack top-up (no Doze/Freeze/Stun/Weaken added); Summon is castable at level 1 for a Summoner and is its day-one attack"
    requirement: "IDENT-03"
    verification:
      - kind: unit
        ref: "test/unit/guaranteed-attack-spell.test.js — 'IDENT-02/IDENT-03: the Summoner is exempt' + fixture-seed test"
        status: pass
    human_judgment: false
  - id: D3
    description: "rollGrimoire's attack top-up consumes zero new rng draws for every sub-class (rng cursor unchanged vs the pinned pre-Phase-23 values)"
    requirement: "FID-06"
    verification:
      - kind: unit
        ref: "test/unit/chargen-rng-pin.test.js (unedited, all 3 tests) + test/unit/guaranteed-attack-spell.test.js's zero-draw proof test"
        status: pass
    human_judgment: false
  - id: D4
    description: "No duplicate spell names ever appear in a rolled grimoire, across all 8 Magic User subs over 200 seeds"
    verification:
      - kind: unit
        ref: "test/unit/guaranteed-attack-spell.test.js — 'no duplicate spell names in any rolled grimoire'"
        status: pass
    human_judgment: false
  - id: D5
    description: "The new algorithm differs from the old (pre-Phase-23) algorithm by at most one spell, for every sub and seed, with the exact adjacency rules per sub-class group (no-override subs, Summoner, Illusionist)"
    verification:
      - kind: unit
        ref: "test/unit/guaranteed-attack-spell.test.js — 'adjacency: the new algorithm differs from the old by at most one spell'"
        status: pass
    human_judgment: false
  - id: D6
    description: "Exactly the measured changed chargen fixture seeds (15, 24) are declared in a divergences block with before/after grimoire + rationale; every other seed is byte-identical with no carve-out; both chargen parity replay sites assert and strip only the declared fields"
    requirement: "FID-06"
    verification:
      - kind: unit
        ref: "test/parity/chargen-parity.test.js (all 3 tests, including 'divergence records are narrow and well-formed') and test/parity/full-suite.test.js's chargen sub-test"
        status: pass
    human_judgment: false

duration: 13min
completed: 2026-09-14
status: complete
---

# Phase 23 Plan 02: Guaranteed Day-One Attack Spell + FID-06 Chargen Divergence Records Summary

**`rollGrimoire`'s existing first-day top-up now also guarantees a usable-now ATTACK spell (Doze/Freeze/Stun/Weaken) for every non-Summoner Magic User with zero new rng draws, and the two chargen-parity seeds whose grimoire content this measurably changes (15, 24) are declared in the fixture with before/after + rationale rather than silently regenerated.**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-09-14T21:58:59Z (per STATE.md, end of Plan 01)
- **Completed:** 2026-09-14T22:12Z
- **Tasks:** 3
- **Files modified:** 6 modified, 1 created

## Accomplishments

- Extended `rollGrimoire` (engine/character.js) with a zero-draw attack top-up: after the existing "two usable-now spells" loop, every non-Summoner Magic User with no usable-now attack spell gets the first attack-kind spell from the already-shuffled `spare` list appended. The `spare` POOL predicate (`dayOnePool`) stays byte-identical to the pre-Phase-23 code; only the separate ready-count `usableNow` predicate is routed through Plan 01's `spellLevelFor`.
- Measured the exact set of chargen-parity seeds this changes: **seed 15** (Summoner, drops Heal — Summon now counts as usable-now via the override table, so the two-usable-now loop stops one spell earlier) and **seed 24** (Apprentice, gains Freeze — the new top-up). Every other of the 20 rng-pin seeds' grimoire (and rng cursor) is unchanged — confirmed by diffing against the pre-edit engine.
- `test/unit/guaranteed-attack-spell.test.js`: 200 forced seeds x 8 subs proving the IDENT-02 guarantee, the Summoner exemption (IDENT-03), no duplicate spell names, an old-vs-new adjacency bound (at most one spell differs, with per-sub-group rules), and a zero-draw proof restating the Plan 01 pin constants.
- FID-06: added a `divergences` block to `test/parity/fixtures/action-script.chargen.json` (seeds 15/24, `fields: ["grimoire"]`, before/after taken verbatim from the prototype sandbox/engine, one-paragraph rationale each). New `chargenDivergenceFor`/`stripDeclaredFields` helpers in `comparables.js` (modelled on `stripParleyDivergence`); both chargen parity replay sites (`chargen-parity.test.js`, `full-suite.test.js`) now assert the declared before/after values before stripping only the declared field for only the declared seeds. A new "divergence records are narrow and well-formed" test guards against a future blanket regeneration. Schema doc updated.
- `npm test` 1011/1011 (1004 baseline + 7 new tests); `node --test "test/parity/**/*.test.js"` 31/31 (30 + the new well-formedness test); `test/unit/chargen-rng-pin.test.js` green, unedited.

## Task Commits

All three tasks were committed together (per the plan's explicit instruction — parity would have been red between Task 1 and Task 3):

1. **Tasks 1-3: guaranteed day-one attack spell + FID-06 chargen divergence records** - `335c4ca` (feat)

**Plan metadata:** (this commit, following this SUMMARY)

## Files Created/Modified

- `engine/character.js` - `rollGrimoire`: `dayOnePool` (frozen spare predicate) vs override-aware `usableNow` (ready-count only), zero-draw attack top-up, Summoner-exempt
- `test/unit/guaranteed-attack-spell.test.js` - guarantee/exemption/no-duplicates/adjacency/zero-draw tests over 200 forced seeds x 8 subs
- `test/parity/fixtures/action-script.chargen.json` - `divergences` block for seeds 15 and 24
- `test/parity/fixtures/action-script.schema.md` - documents `divergences`/`divergence`
- `test/parity/harness/comparables.js` - `chargenDivergenceFor`, `stripDeclaredFields`
- `test/parity/chargen-parity.test.js` - seed-scoped before/after assertion + strip + new well-formedness test
- `test/parity/full-suite.test.js` - same before/after assertion + strip in the chargen sub-test

## Measured Evidence (quoted per the plan's `<output>` requirement)

**20-seed "unchanged" evidence** (measured against the pre-edit engine via `git show HEAD:engine/character.js` loaded as a temp module, then diffed against the post-edit engine — see Deviations below for why this method was used instead of the plan's suggested pre-edit-then-edit script order):

```
1 Fighter Knight [] / 2 Thief Cat Burglar [] / 3 Thief Pickpocket [] / 4 Thief Cat Burglar []
6 Fighter Knight [] / 7 Magic User Wizard ["Sense Presence","Mirror Self","Stun","Heal"]
8 Magic User Illusionist ["Stupidity","Freeze","Acid","Insane","Mirror Self","Summon","Petrify","Phantom Host"]
13 Fighter Woodsman [] / 14 Fighter Soldier [] / 17 Thief Pilfer []
19 Magic User Sorcerer ["Strength","Insane","Turn Walking Dead","Freeze","Fireball"]
29 Magic User Warlock ["Detect Magic","Shield","Strength","Acid","Insane","Freeze","Sense Danger"]
32 Fighter Samurai []
35 Magic User Cleric ["Freeze","Stupidity","Sense Presence","Weaken","Insane","Shield","Heal","Major Heal"]
38 Thief Con Artist [] / 160 Thief Pilfer [] / 256 Thief Cat Burglar [] / 303 Thief Con Artist []
```

All 18 of these are byte-identical before vs. after the edit (Fighter/Thief seeds never enter `rollGrimoire`; the 5 Magic User seeds shown are unchanged). `test/unit/chargen-rng-pin.test.js`'s 20 rollCharacter/newRun cursor pins and 8 per-sub draw-count pins all stay green, unedited.

**Declared seed 15** (Summoner):
- before: `["Stupidity","Stun","Shield","Summon","Heal"]`
- after: `["Stupidity","Stun","Shield","Summon"]`

**Declared seed 24** (Apprentice):
- before: `["Heal","Strength","Stupidity","Detect Magic","Sense Presence"]`
- after: `["Heal","Strength","Stupidity","Detect Magic","Sense Presence","Freeze"]`

**Test counts:** `npm test` 1011/1011; `node --test "test/parity/**/*.test.js"` 31/31; `node --test "test/unit/**/*.test.js" "test/determinism/**/*.test.js" "test/roundtrip/**/*.test.js"` 909/909.

## Decisions Made

- `dayOnePool` and `usableNow` kept as two distinct predicates inside `rollGrimoire` rather than one shared name, matching the plan's explicit non-negotiable constraint that the `spare` pool predicate must never see `spellLevelFor` (measured rng-cursor-shift risk for seeds 8 and 15).
- The attack top-up's `sub !== "Summoner"` guard is retained as belt-and-braces even though the Summoner's `spare` structurally can never contain an attack-kind spell (offense gated to level 3) — matches the plan's explicit instruction to keep the guard for defense-in-depth.
- Fixed a cross-realm `assert.deepStrictEqual` failure during Task 3 (Rule 1 auto-fix): comparing a vm-sandboxed prototype value directly against a plain JSON-parsed value with `assert.deepStrictEqual` fails Node's reference-equality check on arrays even when they are structurally identical (different realm's `Array.prototype`). Switched both chargen replay sites' before/after divergence assertions to `diffState` (which normalizes via `structuredClone` first), matching how every OTHER prototype-vs-engine comparison in this harness already works.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Cross-realm `assert.deepStrictEqual` failure in the new before/after divergence assertions**
- **Found during:** Task 3 (writing the chargen parity replay-site updates)
- **Issue:** `assert.deepStrictEqual(protoCForDiff.grimoire, record.before.grimoire)` failed with "Values have same structure but are not reference-equal" even though the printed arrays were identical — the prototype-side array lives in a `node:vm` sandbox realm (a different `Array.prototype`), which Node's `assert.deepStrictEqual` treats as unequal despite structural equality.
- **Fix:** Replaced both `assert.deepStrictEqual` calls (in `chargen-parity.test.js` and `full-suite.test.js`) with `assert.equal(diffState(...), null, ...)`, reusing the harness's existing `diffState` comparator (which strips via `structuredClone` first, sidestepping the cross-realm issue) — the same tool every other prototype-vs-engine comparison in this suite already uses.
- **Files modified:** test/parity/chargen-parity.test.js, test/parity/full-suite.test.js
- **Verification:** `node --test "test/parity/**/*.test.js"` went from 3 failing to 31/31 passing.
- **Committed in:** `335c4ca` (part of the Task 1-3 commit)

**2. [Rule 3 - Blocking] Bare `node --test test/unit` / `test/parity` directory form fails on this machine**
- **Found during:** Task 1 and Task 3 verification
- **Issue:** `node --test test/unit test/determinism test/roundtrip` and `node --test test/parity` (bare directory forms) fail with `MODULE_NOT_FOUND` on this Node v22.23.2 / Windows Git Bash combination — a pre-existing environment quirk already documented in Plan 01's SUMMARY, not a Phase 23 regression.
- **Fix:** Used the glob form (`node --test "test/unit/**/*.test.js" ...`) for all verification commands in this plan, matching Plan 01's established workaround.
- **Files modified:** none (verification-command-only workaround)
- **Verification:** glob-form commands ran successfully and matched all plan-specified acceptance criteria.

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking/environment workaround)
**Impact on plan:** Both auto-fixes were necessary to get a genuinely green suite; neither changed the plan's intended engine behavior, fixture content, or test coverage. No scope creep.

## Issues Encountered

None beyond the two auto-fixed items above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `rollGrimoire`'s guaranteed-attack top-up and the `usableNow`/`dayOnePool` split are landed and tested; Plan 03 (Wizard melee rule) can rely on `castableAttackSpells`/`canCast` unchanged from Plan 01.
- The `chargenDivergenceFor`/`stripDeclaredFields` pattern (a seed-scoped, field-scoped fixture divergence record) is now precedent for Plan 04's magic-fixture `divergence` record (per-scenario shape, same helpers reusable in spirit).
- `test/unit/chargen-rng-pin.test.js` remains green and unedited — Plans 03-04 must keep it that way.
- No blockers. `npm test` 1011/1011, parity 31/31, no undeclared carve-outs added.

---
*Phase: 23-casters-can-act-wizard-summoner-illusionist-guaranteed-attack-spell*
*Completed: 2026-09-14*

## Self-Check: PASSED

All created/modified files confirmed present; the Task 1-3 commit (`335c4ca`) confirmed in git log.
