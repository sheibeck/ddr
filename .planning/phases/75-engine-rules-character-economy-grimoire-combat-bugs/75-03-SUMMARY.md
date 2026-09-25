---
phase: 75-engine-rules-character-economy-grimoire-combat-bugs
plan: 03
subsystem: ui
tags: [combat-menu, grimoire, spells, presentation-only]

# Dependency graph
requires:
  - phase: 74-roll-display-modifier-honesty
    provides: "combatMenu.js's STRIKE/FLEE ranges via rollOdds.js (74-04) — spell rows were untouched by 74"
provides:
  - "the combat SPELLS submenu hides level- and school-locked grimoire spells instead of showing them greyed"
  - "a castable-but-out-of-charges spell still lists, disabled, distinct from a hidden locked spell"
  - "COMBAT_MENU_COPY.noCastable/noCastableDesc for the all-locked-but-nonempty-grimoire case"
affects: [75-05 (Summoner offense-gate removal flows through canCast with no menu edit), 77 (CMBUI-08 level-then-name spell sort)]

# Tech tracking
tech-stack:
  added: []
  patterns: ["combat SPELLS row-building filters on engine/derived.js#canCast before mapping to rows — the ONE legality read, no re-derived level/school formula in presentation code"]

key-files:
  created: []
  modified:
    - src/browser/combatMenu.js
    - test/unit/combatMenu.test.js

key-decisions:
  - "Hide, don't grey, a level/school-locked spell row in combat only (user ruling 2026-09-21); the Hero-tab Grimoire (heroTab.js#grimoireViewModel) is untouched and still lists every spell the book holds"
  - "Split the old combined `canCast(state, sp) && charges > 0` enabled check into a pre-filter (canCast decides visibility) and `enabled: charges > 0` (charges alone decides the disabled/enabled look on a row that already exists)"
  - "The all-locked-but-nonempty-grimoire case gets its own copy (noCastable/noCastableDesc), kept distinct from the existing noSpells/noSpellsDesc empty-grimoire case"

requirements-completed: [RULES-04]

coverage:
  - id: D1
    description: "Combat SPELLS submenu hides a level- or school-locked grimoire spell (no row at all); a castable-but-out-of-charges spell stays listed, disabled"
    requirement: "RULES-04"
    verification:
      - kind: unit
        ref: "test/unit/combatMenu.test.js#Magic User (Wizard): SPELLS sub-line, submenu title, rows in SPELLS order, castable rows only"
        status: pass
      - kind: unit
        ref: "test/unit/combatMenu.test.js#RULES-04: a level-1 Sorcerer's healing school opens at 4 — Heal is hidden, Freeze is listed"
        status: pass
      - kind: unit
        ref: "test/unit/combatMenu.test.js#RULES-04 adjacency: a spell's effective level or school gate equal to the hero's level is listed; one level above either is hidden"
        status: pass
      - kind: unit
        ref: "test/unit/combatMenu.test.js#RULES-04: with every charge spent, a castable spell's row stays listed, disabled"
        status: pass
      - kind: unit
        ref: "test/unit/combatMenu.test.js#RULES-04 ordering: visible rows keep their relative SPELLS order — hiding a row never reorders the others"
        status: pass
      - kind: unit
        ref: "test/unit/combatMenu.test.js#RULES-04 all-locked: a level-1 Sorcerer whose book is only Heal shows one disabled row with the noCastable copy, distinct from noSpells"
        status: pass
      - kind: unit
        ref: "test/unit/combatMenu.test.js#Magic User with an empty grimoire: SPELLS submenu is still the single disabled NOTHING IN THE GRIMOIRE row (today's empty case, unchanged)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The Hero-tab Grimoire keeps listing every spell the book holds, including a spell the combat SPELLS menu now hides"
    requirement: "RULES-04"
    verification:
      - kind: unit
        ref: "test/unit/combatMenu.test.js#RULES-04 scope: the combat SPELLS submenu hides Lightning (above level 1) but the Hero-tab Grimoire (grimoireViewModel) still lists it"
        status: pass
    human_judgment: false

duration: 22min
completed: 2026-09-25
status: complete
---

# Phase 75 Plan 03: Combat SPELLS Menu Hides Locked Spells (RULES-04) Summary

**Combat SPELLS submenu now hides level/school-locked grimoire spells via `canCast`; out-of-charges spells stay visible and disabled, and the Hero-tab Grimoire is untouched.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-09-25T19:20:00Z
- **Completed:** 2026-09-25T19:42:11Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `combatMenuViewModelUnlocked`'s caster branch now filters grimoire spells through `engine/derived.js#canCast(state, sp)` before building rows — a locked spell (level or school gate) has no row at all in the combat SPELLS submenu, reversing the old "disabled rows stay visible" reading for combat only
- A castable spell with zero charges left (`spellsUsed` at or past `maxCharges`) still shows its row, `enabled: false` — "no charges" stays visible information, distinct from a hard lock
- Added `COMBAT_MENU_COPY.noCastable` / `noCastableDesc`, a dry family-friendly line for the case where the grimoire holds spells but none survive the `canCast` filter — kept distinct from the existing `noSpells`/`noSpellsDesc` empty-grimoire row
- The Hero-tab Grimoire (`heroTab.js#grimoireViewModel`) reads unchanged — confirmed with a new cross-check test that a spell hidden from combat still lists (locked) on the Hero tab
- Confirmed the standing voice/safety scan (`test/voice/safety-scan.test.js`) and the HP-not-WP guard (`test/unit/hp-not-wp.test.js`) already walk `COMBAT_MENU_COPY`, so the two new strings are covered by the existing standing guards with no new assertion needed

## Task Commits

Each task was committed atomically (both tasks' files overlapped in `test/unit/combatMenu.test.js`, so Task 2's cross-check test landed in the same commit as Task 1's implementation and test rewrite):

1. **Task 1 + Task 2: Hide locked spell rows; keep out-of-charges rows; prove the Hero-tab Grimoire is untouched** - `b8fd729` (feat)

## Files Created/Modified
- `src/browser/combatMenu.js` - the caster branch now pre-filters `SPELLS` by `canCast(state, sp)` before mapping rows; `enabled: charges > 0` replaces the old combined check; two new frozen `COMBAT_MENU_COPY` keys (`noCastable`/`noCastableDesc`)
- `test/unit/combatMenu.test.js` - replaced the retired "incl. an above-level spell" expectation with hide/keep/adjacency/empty/ordering pins for RULES-04, plus a cross-check against `grimoireViewModel`

## Decisions Made
- Combined both tasks' test-file work into the single Task 1 commit since the plan's own files_modified lists overlap on `test/unit/combatMenu.test.js` and splitting the test additions across two commits would have left an intermediate commit with a stale/incomplete test file for no benefit — no plan intent is lost, both tasks' acceptance criteria are met in the final state
- Chose `Acid` (lvl 2, offense, Wizard has no `gate.offense` override) to isolate the spell-level adjacency case, and `Turn Walking Dead` (lvl 2, school `protection`, Illusionist `gate.protection: 3`) to isolate the school-gate adjacency case — both are real `content/spells.js` rows, not invented spell names
- The Hero-tab cross-check test does not pin `grimoireViewModel`'s exact `disabledReason` string for a `combatOnly` spell read out of combat (it names "Combat only" before the level gate, per `heroTab.js`'s existing branch order) — that ordering predates this plan and is out of scope; the test instead asserts the row is present, `castable: false`, and carries a non-empty reason string

## Deviations from Plan

None - plan executed exactly as written. (Two tasks landed in one commit due to overlapping `files_modified`, documented above; no code behavior beyond the plan's spec was added.)

## Issues Encountered
- First draft of the adjacency test asserted `rows.length === 0` for a fully-locked case, but the submenu always renders at least one row (the `noCastable`/`noSpells` placeholder) rather than an empty array — fixed by asserting the specific spell's label is absent from the rendered rows instead of a bare row count.
- First draft of the Hero-tab cross-check test pinned `disabledReason` to `"Needs level 4"` for Lightning, but Lightning is `combatOnly: true`, so `grimoireViewModel` names "Combat only" first (existing branch order, unrelated to this plan) — relaxed the assertion to check presence/castable/non-empty-reason instead of the exact string.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- 75-05 (Summoner offense-gate removal) can proceed with no edit to this file: the combat SPELLS menu reads `canCast` directly, so removing `MU_CHART.Summoner.gate.offense` will surface a level-1 Summoner's offense spells here automatically.
- 77 (CMBUI-08 level-then-name spell sort) can layer on top of the now-hidden-row list; this plan explicitly preserves today's SPELLS-array visible-row order and does not introduce a competing sort.

---
*Phase: 75-engine-rules-character-economy-grimoire-combat-bugs*
*Completed: 2026-09-25*
