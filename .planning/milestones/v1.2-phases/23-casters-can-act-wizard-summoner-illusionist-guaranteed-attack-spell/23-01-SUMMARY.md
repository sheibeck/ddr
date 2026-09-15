---
phase: 23-casters-can-act-wizard-summoner-illusionist-guaranteed-attack-spell
plan: 01
subsystem: engine
tags: [engine, derived, content, spell-level-override, attack-spell-set, rng-pin, casters-can-act]

# Dependency graph
requires:
  - phase: 22-class-aware-harness-and-before-matrix
    provides: "IDENT-01 finding (Wizard/caster cannot melee with charges but no attack spell), class-aware harness"
provides:
  - "content/spell-level-overrides.js — SPELL_LEVEL_OVERRIDES pure-data table (Summoner/Summon, Illusionist/Phantom Host, both lvl 1)"
  - "engine/derived.js#spellLevelFor(sub, sp) — the one helper canCast and rollGrimoire route the level-gate check through"
  - "engine/derived.js#ATTACK_SPELL_KINDS/isAttackSpell/castableAttackSpells — the one engine-wide definition of 'attack spell' (status/thrown/stun/weaken)"
  - "test/unit/chargen-rng-pin.test.js — pre-Phase-23 rng-order pins (FID-06 proof)"
affects: [23-02-guaranteed-attack-spell, 23-03-wizard-melee-rule, 23-04-freeze-pays-out]

tech-stack:
  added: []
  patterns:
    - "Per-sub-class spell-level override table (data-driven, Phase 24-extensible without engine edits)"
    - "One shared engine-wide 'attack spell' definition consumed by multiple call sites (Plan 02's grimoire top-up, Plan 03's Wizard rule)"

key-files:
  created:
    - content/spell-level-overrides.js
    - test/unit/chargen-rng-pin.test.js
    - test/unit/spell-level-overrides.test.js
  modified:
    - content/index.js
    - engine/derived.js

key-decisions:
  - "spellLevelFor/ATTACK_SPELL_KINDS/isAttackSpell/castableAttackSpells all homed in engine/derived.js (the cycle-free leaf) so Plan 02 (character.js) and Plan 03 (combat.js) can both import them without creating an import cycle."
  - "castableAttackSpells deliberately does NOT check remaining charges (maxCharges/spellsUsed) — that stays at the Wizard-refusal call site in Plan 03, keeping this helper's contract to 'is a legal attack spell known' only."
  - "The rng-pin test (Task 1) was written and committed BEFORE any engine/content edit, per the plan's non-negotiable ordering constraint, and its pinned numbers were independently re-measured against the untouched engine before being written into the test (all 20 rollCharacter cursors, 20 newRun cursors, and 8 rollGrimoire draw counts matched the plan's table exactly)."

patterns-established:
  - "FLAGGED PLANNER ASSUMPTION tests: a canCast diff-walk test (8 MU subs + Knight + Pickpocket x 32 spells x levels 1-5) proves an engine behavior change touches EXACTLY the intended cells and nothing else — a reusable pattern for future narrow rule changes."

requirements-completed: [IDENT-01, IDENT-03, IDENT-04, FID-06]

coverage:
  - id: D1
    description: "Pre-Phase-23 chargen rng-consumption order pinned (20 rollCharacter cursors, 20 newRun cursors, 8 per-sub rollGrimoire draw counts) in a test committed before any engine edit"
    requirement: "FID-06"
    verification:
      - kind: unit
        ref: "test/unit/chargen-rng-pin.test.js — all 3 tests"
        status: pass
    human_judgment: false
  - id: D2
    description: "A level-1 Summoner can cast Summon (canCast === true) via the SPELL_LEVEL_OVERRIDES table, with no content/spells.js edit"
    requirement: "IDENT-03"
    verification:
      - kind: unit
        ref: "test/unit/spell-level-overrides.test.js — spellLevelFor and canCast diff-walk tests"
        status: pass
    human_judgment: false
  - id: D3
    description: "A level-1/2 Illusionist can cast Phantom Host (canCast === true) via the same override table"
    requirement: "IDENT-04"
    verification:
      - kind: unit
        ref: "test/unit/spell-level-overrides.test.js — spellLevelFor and canCast diff-walk tests"
        status: pass
    human_judgment: false
  - id: D4
    description: "canCast is byte-for-byte the old predicate for every (sub, spell, level) triple except the three intended override cells"
    requirement: "IDENT-01"
    verification:
      - kind: unit
        ref: "test/unit/spell-level-overrides.test.js — canCast diff walk (8 subs + Knight/Pickpocket x 32 spells x levels 1-5)"
        status: pass
    human_judgment: false
  - id: D5
    description: "ATTACK_SPELL_KINDS/isAttackSpell/castableAttackSpells exist in engine/derived.js as the one engine-wide 'attack spell' definition, SPELLS-order results, charge-blind"
    verification:
      - kind: unit
        ref: "test/unit/spell-level-overrides.test.js — castableAttackSpells semantics + ATTACK_SPELL_KINDS tests"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-09-14
status: complete
---

# Phase 23 Plan 01: Cycle-Free Foundation Summary

**Data-driven per-sub-class spell-level override table (`content/spell-level-overrides.js`) plus one engine-wide `castableAttackSpells`/`ATTACK_SPELL_KINDS` definition in `engine/derived.js`, proven by an rng-order pin test committed before any engine edit and a canCast diff-walk that isolates the change to exactly three (sub, spell, level) cells.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-14T21:49:58Z (per STATE.md)
- **Completed:** 2026-09-14T21:57:15Z
- **Tasks:** 3
- **Files modified:** 5 (2 new content files counted, 1 new test file, content/index.js + engine/derived.js modified, plus 2 more new test files — see Files below)

## Accomplishments

- Pinned the pre-Phase-23 chargen rng-consumption order (20 seeds x rollCharacter + newRun cursors, 8 per-sub rollGrimoire draw counts) in a test committed BEFORE any engine/content edit — the FID-06 ordering proof every later Phase 23 plan must keep green.
- Added `content/spell-level-overrides.js` (`SPELL_LEVEL_OVERRIDES`, exactly two rows: Summoner/Summon and Illusionist/Phantom Host, both effective level 1), barrel-exported via `content/index.js`.
- Routed `engine/derived.js#canCast`'s level check through a single new helper, `spellLevelFor(sub, sp)`, which reads the override table and falls back to `sp.lvl` for every other (sub, spell) pair.
- Added the one engine-wide "attack spell" definition — `ATTACK_SPELL_KINDS` (status/thrown/stun/weaken), `isAttackSpell(sp)`, `castableAttackSpells(state)` — that Plan 02's grimoire top-up and Plan 03's Wizard melee rule will both consume.
- Proved via a canCast diff-walk test (8 Magic User subs + Knight + Pickpocket x 32 spells x levels 1-5 = 1,600 cells) that the override changes EXACTLY `(Summoner, Summon, 1)`, `(Illusionist, Phantom Host, 1)`, `(Illusionist, Phantom Host, 2)` and nothing else.
- `content/spells.js` untouched (Summon stays lvl 2, Phantom Host stays lvl 3 for every other sub); `test/parity/prototype-master.js.txt` untouched; `npm test` 1004/1004; `node --test "test/parity/**/*.test.js"` 30/30 with zero carve-outs.

## Task Commits

Each task was committed atomically:

1. **Task 1: Pin the pre-change chargen rng order (FID-06)** - `7d2f155` (test)
2. **Task 2: Override table + spellLevelFor + attack-spell set** - `103b000` (feat)
3. **Task 3: Tests — override cells, canCast diff walk, castableAttackSpells semantics** - `882dfdd` (test)

**Plan metadata:** (this commit, following this SUMMARY)

## Files Created/Modified

- `test/unit/chargen-rng-pin.test.js` - 20-seed rollCharacter/newRun rng-cursor pins + 8 per-sub rollGrimoire draw-count pins, measured on the untouched pre-Phase-23 engine
- `content/spell-level-overrides.js` - `SPELL_LEVEL_OVERRIDES` pure-data table (2 rows)
- `content/index.js` - barrel re-export of the new override table
- `engine/derived.js` - `spellLevelFor`, `ATTACK_SPELL_KINDS`, `isAttackSpell`, `castableAttackSpells`; `canCast`'s level check routed through `spellLevelFor`
- `test/unit/spell-level-overrides.test.js` - table shape, spellLevelFor cells, canCast diff walk (with an empty-grimoire variant), castableAttackSpells semantics, ATTACK_SPELL_KINDS membership

## Measured Pin Values (confirmed against the plan's table)

All three pin categories were independently re-measured on the untouched engine (via `node -e` against `file:///C:/...` absolute imports, since Windows Git Bash's relative-`/tmp` resolution fails for ESM) BEFORE being written into the committed test, and matched the plan's stated numbers exactly:

- 20 `rollCharacter(rng)` post-call `rng.getState()` cursors — exact match.
- 20 `newRun(seed).rngState` cursors — exact match.
- 8 per-sub `rollGrimoire` draw counts (Wizard 39, Warlock 33, Sorcerer 35, Summoner 31, Cleric 34, Illusionist 34, Court Mage 34, Apprentice 38) — exact match, and independently re-derived via the `max(0,low-1) + max(0,high-1) + 1 + max(0,spare-1)` formula, which also matched.

## Diff-Walk Result (exact)

```
[
  ["Summoner", "Summon", 1],
  ["Illusionist", "Phantom Host", 1],
  ["Illusionist", "Phantom Host", 2]
]
```

Every other cell among 8 Magic User subs + Knight + Pickpocket x 32 spells x levels 1-5 is byte-identical between the old (`sp.lvl` bare) and new (`spellLevelFor`-routed) predicate. A second walk with an empty grimoire confirmed the override never bypasses grimoire membership (canCast is false for all 1,600 cells, including the two override cells, when the grimoire is empty).

## Decisions Made

- `spellLevelFor`/`ATTACK_SPELL_KINDS`/`isAttackSpell`/`castableAttackSpells` all homed in `engine/derived.js` (the cycle-free leaf) so Plan 02 (`engine/character.js`) and Plan 03 (`engine/combat.js`) can both import them without creating an import cycle — matches the plan's explicit instruction and the established precedent (`resistRoll`, `killSpFor`, `fluency` all live here for the same reason).
- `castableAttackSpells` deliberately does NOT check remaining charges — that check stays at the Wizard-refusal call site Plan 03 will add, keeping this helper's contract narrow ("is a legal attack spell known", not "do you still have a charge for it").
- The rng-pin test (Task 1) was written and committed strictly before any engine/content edit, per the plan's non-negotiable ordering constraint; `git diff --quiet HEAD -- engine content src` returned `rc=0` at the moment of that commit, confirming the engine was untouched when the pins were taken.

## Deviations from Plan

None - plan executed exactly as written. All acceptance criteria greps, `node -e` inline checks, and test/parity runs matched the plan's expected values on the first attempt; no auto-fixes were needed.

## Issues Encountered

- `node --test test/parity` (bare directory form) fails to resolve on this Node v22.23.2 / Windows Git Bash combination (`Cannot find module '...\test\parity'`) — this is a pre-existing environment quirk, not a Phase 23 regression. Substituted the glob form `node --test "test/parity/**/*.test.js"`, which the plan's own `<context>` doesn't reference directly but is the project's established working form (confirmed 30/30 pass, matching the plan's "parity 30/30 with zero carve-outs" requirement).
- Windows Git Bash's relative `/tmp` path does not resolve for Node ESM imports from a scratch script; used absolute `file:///C:/...` import URLs in a one-off measurement script (in the session scratchpad directory) to independently verify the plan's pinned rng numbers before committing them.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `spellLevelFor`, `ATTACK_SPELL_KINDS`, `isAttackSpell`, `castableAttackSpells` are all exported from `engine/derived.js` and ready for Plan 02 (`rollGrimoire`'s guaranteed-attack-spell top-up) and Plan 03 (the Wizard melee refusal rule) to import.
- The chargen rng-pin test (`test/unit/chargen-rng-pin.test.js`) is committed and green; Plans 02-04 must keep it green as their own FID-06 ordering proof.
- No blockers. `npm test` 1004/1004, parity 30/30, no carve-outs added.

---
*Phase: 23-casters-can-act-wizard-summoner-illusionist-guaranteed-attack-spell*
*Completed: 2026-09-14*

## Self-Check: PASSED

All created/modified files confirmed present; all three task commits (`7d2f155`, `103b000`, `882dfdd`) confirmed in git log.
