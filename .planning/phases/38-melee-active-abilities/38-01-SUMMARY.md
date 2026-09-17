---
phase: 38-melee-active-abilities
plan: 01
subsystem: engine
tags: [content, abilities-catalog, table-reshape, free-skill, derived-rng, level-pool, tolerant-load, parity-declared-divergences]

# Dependency graph
requires: []
provides:
  - "content/abilities.js: 20-entry ABILITIES catalog, ABILITY_BY_ID, ABILITY_POOL, ONCE_A_FIGHT"
  - "content/skills.js: reshaped FIGHTER_SKILLS/THIEF_SKILLS with active markers, positions/costs preserved"
  - "content/kit.js: FREE_SKILL repointed to same-position replacement keys"
  - "engine/rng.js: hashString/derivedRng — the derived rng stream for level-pool rolls"
  - "engine/character.js: c.abilities, migrateLegacySkills, splitTableAbilities, rollPoolAbility, grantLevelAbilities, ensureAbilities, abilityLearned event"
  - "engine/state.js newRun / engine/encounters.js meetJoiner: level-pool roll wiring"
  - "engine/saveState.js: tolerant-load ensureAbilities wiring (validateSave/rehydrate)"
  - "abilityLearned narration (eventNarration/toasts/rail)"
  - "test/parity/harness/comparables.js: stripAbilitiesField, chargenShiftOf, stripChargenShift, chargenShiftDiffs"
  - "20 measured chargenDivergence/divergences fixture records; docs/ABILITIES.md phase ledger"
affects: [38-02-melee-hooks, 38-03-melee-dispatcher, 38-04-melee-joiners, 38-05-melee-shell]

tech-stack:
  added: []
  patterns:
    - "Derived rng stream (makeRng(hashString(key))) for new rolls that must not reorder an existing seeded draw sequence"
    - "Positional table reshape: preserve object-literal key order + per-position cost so a shuffle's outcome-by-index survives a semantic rename"
    - "chargenDivergence: the scenario/script-level analog of a chargen fixture's divergences map, for a fixture whose hero's chargen-time c.skills a later change moves"

key-files:
  created:
    - content/abilities.js
    - test/unit/abilities-catalog.test.js
    - test/unit/ability-pool.test.js
    - docs/ABILITIES.md
  modified:
    - content/skills.js
    - content/kit.js
    - content/index.js
    - engine/rng.js
    - engine/character.js
    - engine/state.js
    - engine/encounters.js
    - engine/saveState.js
    - src/browser/eventNarration.js
    - src/browser/toasts.js
    - src/browser/rail.js
    - test/voice/safety-scan.test.js
    - test/unit/save-validation.test.js
    - test/parity/harness/comparables.js
    - test/parity/chargen-parity.test.js
    - test/parity/combat-parity.test.js
    - test/parity/magic-parity.test.js
    - test/parity/movement-parity.test.js
    - test/parity/economy-parity.test.js
    - test/parity/full-suite.test.js
    - test/parity/fixtures/action-script.chargen.json
    - test/parity/fixtures/action-script.combat.json
    - test/parity/fixtures/action-script.magic.json
    - test/parity/fixtures/action-script.economy.json
    - test/parity/fixtures/action-script.encounters.json
    - test/parity/fixtures/action-script.movement.json
    - test/parity/fixtures/action-script.schema.md
    - test/parity/FIXTURE-INVENTORY.md

key-decisions:
  - "FREE_SKILL is repointed to the key at the OLD free key's EXACT table position (not just any still-valid key) — the shuffle-exclusion is positional, so a different position would permute a different draw outcome per seed"
  - "Every level-pool roll (level-1 guarantee, per-level-up, Joiner) uses a fresh derivedRng instance keyed by seed/level (or name+depth+level), never the main rng — zero draws off any existing seeded cursor"
  - "c.abilities is a plain [] literal on every character (including Magic Users), split from c.skills via splitTableAbilities immediately after rollCharacter's literal — carved out of every parity comparable structurally, like c.worn/c.timers before it"
  - "20 declared, measured chargenDivergence/divergences records (never a blanket regeneration) reconcile the parity suite; a new chargenShiftOf/stripChargenShift/chargenShiftDiffs helper trio extends the Phase 23 divergence mechanism to scenario/script-level fixtures"

requirements-completed: [ABIL-02, ABIL-03]

coverage:
  - id: D1
    description: "Special Skills tables reshaped positionally (12 Fighter / 9 Thief keys, same order/cost) with 11 active markers; FREE_SKILL repointed to the same-position replacement keys"
    requirement: "ABIL-02"
    verification:
      - kind: unit
        ref: "test/unit/abilities-catalog.test.js"
        status: pass
      - kind: unit
        ref: "test/unit/chargen-rng-pin.test.js (unchanged, proves the shuffle draw count/outcome is untouched)"
        status: pass
    human_judgment: false
  - id: D2
    description: "20-entry ability catalog (content/abilities.js) with canon names/txt, ABILITY_POOL, ONCE_A_FIGHT"
    requirement: "ABIL-02"
    verification:
      - kind: unit
        ref: "test/unit/abilities-catalog.test.js"
        status: pass
    human_judgment: false
  - id: D3
    description: "c.abilities on every character; level-1 guarantee (SC-3), per-level-up roll with abilityLearned event, Joiner roll — all via a derived rng stream with zero main-rng draws"
    requirement: "ABIL-03"
    verification:
      - kind: unit
        ref: "test/unit/ability-pool.test.js"
        status: pass
      - kind: unit
        ref: "test/unit/chargen-rng-pin.test.js (newRun rngState pins unchanged)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Tolerant load: a pre-phase save's c.abilities/legacy skill names are rebuilt deterministically for the hero and every party member"
    requirement: "ABIL-02"
    verification:
      - kind: unit
        ref: "test/unit/ability-pool.test.js (validateSave/rehydrate tolerant-load tests)"
        status: pass
      - kind: unit
        ref: "test/unit/save-validation.test.js"
        status: pass
    human_judgment: false
  - id: D5
    description: "Parity carve-out (stripAbilitiesField) + 20 measured chargenDivergence/divergences records reconcile the reshape against the frozen prototype; master untouched"
    verification:
      - kind: unit
        ref: "test/parity/*.test.js (37/37)"
        status: pass
      - kind: unit
        ref: "npm test (2413/2413, # fail 0)"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-09-17
status: complete
---

# Phase 38 Plan 01: Special Skills Reshape + Ability Catalog + Level Pool Summary

**Reshaped the Fighter/Thief Special Skills tables into 11 active abilities + 10 kept passives, added a 20-entry ability catalog with a per-class level-pool rolled from a derived rng stream (zero main-rng draws), wired `c.abilities` through chargen/level-up/Joiner/tolerant-load, and reconciled the entire parity suite with 20 measured, declared divergence records.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 3
- **Files modified:** 28 (4 new, 24 modified)

## Accomplishments

- `content/skills.js` reshaped positionally: FIGHTER_SKILLS (12) and THIEF_SKILLS (9) keep every key's object-literal position and per-position cost; 7 Fighter + 4 Thief entries now carry an `active` marker; 5 passives per class survive verbatim; Language/Tracking/Climbing/Leaping dropped.
- `content/kit.js`'s FREE_SKILL repointed to the SAME-POSITION replacement key (Cat Burglar→Dirty Trick, Acrobat→Smoke, Ninja→Silent Step) in the same commit as the reshape, preserving the chargen shuffle-exclusion-by-index for every seed.
- `content/abilities.js` (new): the 20-entry canon catalog (`ABILITIES`, `ABILITY_BY_ID`, `ABILITY_POOL`, `ONCE_A_FIGHT`), voice-scanned.
- `engine/rng.js#hashString`/`derivedRng`: the pure, keyed rng stream every new roll in this plan uses — never touches the run's main `rngState`.
- `engine/character.js`: `c.abilities` on every character (split from `c.skills` via `splitTableAbilities`); `grantLevelAbilities`/`rollPoolAbility` (the level-pool mechanism); `migrateLegacySkills`/`ensureAbilities` (tolerant load); `checkLevel` pushes `abilityLearned` per level-up.
- `engine/state.js#newRun` (SC-3 level-1 guarantee) and `engine/encounters.js#meetJoiner` (Joiner roll) wired to the same derived stream.
- `engine/saveState.js`: `ensureCharacterAbilities`/`ensurePartyAbilities` wired into both load chains.
- `abilityLearned` narration added to `eventNarration.js`/`toasts.js`/`rail.js` (coverage guards + voice scan green).
- Parity suite fully reconciled: `stripAbilitiesField` carved out of all three comparables; `chargenShiftOf`/`stripChargenShift`/`chargenShiftDiffs` extend the Phase 23 divergence mechanism to scenario/script-level fixtures; 20 measured before/after records added across 6 fixture files; `docs/ABILITIES.md` and `test/parity/FIXTURE-INVENTORY.md`'s Phase 38 section document the ledger.

## Task Commits

1. **Task 1: Reshaped skills tables + FREE_SKILL repoint + abilities catalog + derived rng** - `67aeccd` (feat)
2. **Task 2: c.abilities + split + pool rolls + tolerant load + narration** - `8f1bd6c` (feat)
3. **Task 3: Parity carve-out + 20 measured divergence records + docs** - `f1b2f70` (test)

**Plan metadata:** (this commit, immediately following)

## Files Created/Modified

- `content/abilities.js` - the 20-entry ability catalog
- `content/skills.js` - reshaped Fighter/Thief Special Skills tables
- `content/kit.js` - FREE_SKILL same-position repoint
- `content/index.js` - barrel export for abilities.js
- `engine/rng.js` - hashString/derivedRng
- `engine/character.js` - c.abilities machinery + checkLevel's abilityLearned
- `engine/state.js` - newRun's level-1 guarantee
- `engine/encounters.js` - meetJoiner's level-pool roll
- `engine/saveState.js` - tolerant-load wiring
- `src/browser/eventNarration.js`, `toasts.js`, `rail.js` - abilityLearned narration
- `test/unit/abilities-catalog.test.js`, `test/unit/ability-pool.test.js` - TDD pins (new)
- `test/voice/safety-scan.test.js`, `test/unit/save-validation.test.js` - extended/updated pins
- `test/parity/harness/comparables.js` + 5 per-domain parity test files + `full-suite.test.js` - carve-out + chargenDivergence wiring
- `test/parity/fixtures/*.json` (6 files) - 20 measured divergence records
- `test/parity/fixtures/action-script.schema.md`, `test/parity/FIXTURE-INVENTORY.md` - documentation
- `docs/ABILITIES.md` (new) - the phase ledger

## Decisions Made

- FREE_SKILL's replacement key is the one at the OLD free key's EXACT position (not merely "a still-valid key") — RESEARCH.md's original framing was wrong for the shuffle outcome; this plan corrected it (documented in the plan's `notes.free_skill_position_rule`).
- Every level-pool roll (level-1, per-level-up, Joiner) draws from a fresh `derivedRng` instance keyed by seed/level or name+depth+level — never the main rng — so `test/unit/chargen-rng-pin.test.js` stays green and UNTOUCHED.
- `c.abilities` is a plain literal (no draw) assigned in `rollCharacter`, split immediately via `splitTableAbilities` before `nameFor` — mirrors the `bag`/`darkFor` precedent for adding a new chargen field with zero rng-order impact.
- 20 fixture divergence records were measured live (never hand-computed) against `loadPrototypeSandbox`/`newRun` and declared with `fields: ["skills"]` only — the new `chargenShiftOf`/`stripChargenShift`/`chargenShiftDiffs` trio extends the existing Phase 23 field-strip-divergence mechanism to scenario/script-level fixtures (previously only chargen-fixture seeds had this).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Header comment in content/skills.js accidentally matched its own `active: "` grep tripwire**
- **Found during:** Task 1
- **Issue:** A doc comment describing the `active` marker used the literal substring `active: "` , making `grep -c 'active: "' content/skills.js` print 12 instead of the required 11.
- **Fix:** Reworded the comment to avoid the exact match while keeping the same meaning.
- **Files modified:** content/skills.js
- **Verification:** `grep -c 'active: "' content/skills.js` now prints 11.
- **Committed in:** 67aeccd (Task 1 commit)

**2. [Rule 1 - Bug] `abilityLearned` comment in eventNarration.js doubled its own coverage-grep count**
- **Found during:** Task 2
- **Issue:** A doc comment mentioning "abilityLearned" caused `grep -c "abilityLearned" src/browser/eventNarration.js` to print 2 instead of the required 1.
- **Fix:** Reworded the comment to avoid repeating the literal event-type string.
- **Files modified:** src/browser/eventNarration.js
- **Verification:** grep now prints 1 for all three narration files.
- **Committed in:** 8f1bd6c (Task 2 commit)

**3. [Rule 1 - Bug] Two pre-existing tolerant-load tests pinned the OLD "no new keys" behavior**
- **Found during:** Task 2 (full `npm test` run after committing)
- **Issue:** `test/unit/save-validation.test.js` had two tests (`"an old-shape save (no seed/rngState) rehydrates with safe defaults"` and `"FID-04: a v1.0-shaped save..."`) asserting `state.c` deep-equals the input plus only `bag` — a direct, deliberate consequence of this plan's `ensureAbilities` (which correctly rebuilds a missing `c.abilities` deterministically) broke both pins.
- **Fix:** Updated both assertions to also expect the deterministically-rolled `c.abilities` array (measured via `ensureAbilities` directly), documenting why in an inline comment.
- **Files modified:** test/unit/save-validation.test.js
- **Verification:** `node --test test/unit/save-validation.test.js` — 27/27 pass.
- **Committed in:** 8f1bd6c (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 — bugs/regressions directly caused by this plan's own changes)
**Impact on plan:** All three fixes were necessary consequences of correctly implementing the plan's specified behavior; no scope creep, no architectural changes.

## Issues Encountered

None beyond the deviations above — the plan's extremely detailed measurement/verification methodology (scratch scripts for draw counts and before/after skills, pinned rng-pin tests) meant every reconciliation step could be checked mechanically before moving on.

## User Setup Required

None - no external service configuration required.

## Human verification (deferred to end of run)

This plan's only player-visible surface is the `abilityLearned` narration line on a level-up (fight log / SKILL LEVEL N rail card); the combat submenu and Hero-tab list are Plan 05's job, so there is nothing else to check on-device yet.

1. Level a fresh Fighter or Thief once (dev start-at-depth, or a kill) and confirm the SKILL LEVEL N rail card / fight log shows a second line reading "New trick: {name} — {txt}".

## Next Phase Readiness

- `c.abilities` and the full catalog/level-pool/tolerant-load machinery are in place and parity-clean; Plan 02 (engine hooks: strike-modifying abilities, derived.js need shifts, the four dropped-skill reads) can now build directly on `c.abilities` and the catalog without touching chargen/parity again.
- `docs/ABILITIES.md` is the living ledger Plans 02-05 append sections to.
- No blockers.

---
*Phase: 38-melee-active-abilities*
*Completed: 2026-09-17*
