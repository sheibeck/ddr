---
phase: 94-ability-states-you-can-tell-apart
plan: 04
subsystem: ui
tags: [abilities, combat-menu, hero-tab, view-model, ASTATE-01, ASTATE-02, ASTATE-03, ASTATE-04]
requires:
  - phase: 94-01
    provides: "abilityState(state, sheet, key), singState(state)"
  - phase: 94-02
    provides: "the cbRow data-state hook and ul.skills li[data-state] rules"
  - phase: 94-03
    provides: "ABILITY_STATE_COPY, abilityStateLabel(st, meta)"
provides:
  - "combat ABILITIES rows and the SING row built from abilityState / singState, carrying state"
  - "Hero tab in-combat ability rows with the same words plus stateKind, li.dataset.state"
  - "ten COMBAT_MENU_COPY and three ABILITY_VIEW_COPY state keys retired, named as removed lines"
affects: [94-05]
tech-stack:
  added: []
  patterns: ["the view derives nothing: one engine read, one shared word module, row.state drives the edge"]
key-files:
  created:
    - test/unit/ability-state-view.test.js
    - docs/narrative-pass/why/x-94-04.json
  modified:
    - src/browser/combatMenu.js
    - src/browser/heroTab.js
    - test/unit/combatMenu.test.js
    - test/unit/once-per-fight-copy.test.js
    - test/unit/value-abilities.test.js
    - test/unit/bard-song.test.js
    - test/unit/value-identity.test.js
    - test/unit/class-trims-nrf-copy.test.js
    - test/unit/characterSheetViewModel.test.js
    - test/unit/shell-abilities.test.js
    - docs/NARRATIVE-PASS.md
    - docs/narrative-pass/review.html
key-decisions:
  - "enabled is state === ready; dispatch is never nulled, so every row is tappable and the engine's refusal is the reason the row names"
  - "Hero rows keep state as the TEXT and gain stateKind in a fight only; out of a fight the row object is unchanged"
requirements-completed: []
status: complete
duration: ~40 min
completed: 2026-10-03
---

# Phase 94 Plan 04: The view stops guessing Summary

The combat ABILITIES submenu (every ability row and the Bard's SING row) and the Hero tab's in-combat ability rows now read the engine's `abilityState` / `singState` and print the shared ABILITY_STATE_COPY words; each combat row carries `state`, which the shell's cbRow hook turns into its edge. The old partial ladder in combatMenu.js, the Sing row's own arithmetic and thirteen retired copy keys are deleted. (ASTATE IDs are left for the orchestrator to mark.)

BASE (HEAD at plan start): `17ecfe4562b672ad4999cc900dd35e3bc8f69d78`.

## Tasks and commits

| Task | Commit | What |
| --- | --- | --- |
| 1 | `01b04205` | `abilityRows` and the Sing row on `abilityState` / `singState` + `abilityStateLabel`; rows carry `state`; `enabled` is `state === "ready"`; grid count reads `state`; ten COMBAT_MENU_COPY keys and five imports dropped; new view test; six pins re-pinned; nine removed-line rows |
| 2 | `bebb3710` | `abilitiesViewFor(c, state)`: in a fight the shared words plus `stateKind`; `renderAbilityRows` sets `li.dataset.state`; ABILITY_VIEW_COPY loses ready, rounds, used; Hero pins re-pinned; three more removed-line rows (twelve total) |

## Moved pins (file: old words to new words)

- `test/unit/combatMenu.test.js`: Bard sung row "SUNG THIS FIGHT" to "SPENT THIS FIGHT"; Bard, Fighter kata/brace and Bard-with-Kata rows gain `state: "ready"` (fight fixtures given one live foe via a new `phase94Foe()` helper); "3 ROUNDS" to "READY IN 3", "1 ROUND" to "READY IN 1", "ONCE PER FIGHT · SPENT" to "SPENT THIS FIGHT", "6 ROUNDS" to "READY IN 6"; "stays enabled on cooldown" became "enabled false, state recharging, dispatch still useAbility". Grid sub "SING · SUNG" and the empty/legacy fallbacks unchanged.
- `test/unit/once-per-fight-copy.test.js`: combat test re-pointed to `ABILITY_STATE_COPY.readyOnce / .ready / .spent`; the spent row is `enabled: false`, `state: "spent"`, dispatch intact; Hero test's `ABILITY_VIEW_COPY.used` line re-pointed to `ABILITY_STATE_COPY.spent`.
- `test/unit/value-abilities.test.js`: combat "2 ROUNDS" to "READY IN 2", "ONCE PER FIGHT · SPENT" to "SPENT THIS FIGHT"; Hero "2 rounds" to "READY IN 2", "once per fight · spent" to "SPENT THIS FIGHT". Out-of-combat `idle.*` lines and the READY / ALREADY ON IT pins unchanged.
- `test/unit/bard-song.test.js`: "AGAIN IN n" to "READY IN n"; title "SUNG THIS FIGHT" to "SPENT THIS FIGHT".
- `test/unit/value-identity.test.js`: `COMBAT_MENU_COPY.singAgain / .singReady / .singSung` to `ABILITY_STATE_COPY.recharging / .ready / .spent`.
- `test/unit/class-trims-nrf-copy.test.js`: `COMBAT_MENU_COPY.abilityTooFewFoes / .abilityReady` to `ABILITY_STATE_COPY.reason.tooFewFoes / .ready`; the literals "NEEDS TWO OR MORE FOES", "1/2 READY", "2/2 READY" kept.
- `test/unit/characterSheetViewModel.test.js`: in-combat fixture has one live foe (was `combat = {}`); ready silentStep "READY" to "READY · ONCE PER FIGHT" (+ `stateKind "ready"`), "2 rounds" to "READY IN 2", "once per fight · spent" to "SPENT THIS FIGHT". The out-of-combat deepEqual is byte-identical.
- `test/unit/shell-abilities.test.js`: the two HERO_SRC import regexes (`abilityRoundsLeft`, `isReady`) became one for `abilityState` from engine/abilities.js and one for `abilityStateLabel` from ./abilityStates.js; the region regexes stay and `li.dataset.state = row.stateKind` was added.

## Visible behaviour changes (for the patch notes, plan 94-05)

- Last Stand now reads NEEDS A QUARTER HP OR LESS above a quarter hp (it always refused; the menu never said so). At or below a quarter it reads READY.
- Hamstring and Mark see past a dead aimed target: with the aim on a dead foe and the next live foe already carrying the effect, the row reads ALREADY ON IT (the old menu read READY and the tap refused).
- Sing reads READY IN N between songs (was AGAIN IN N) and SPENT THIS FIGHT after the second (was SUNG THIS FIGHT).
- A foe ability with no live foe reads NO FOE IN REACH; recharging reads READY IN N (no plural) and spent reads SPENT THIS FIGHT.
- A duration ability reads READY IN N while its effect runs (Active state deferred).
- A pending fight's Hero tab (before FIGHT!) reads FIGHT FIRST (the combat menu never renders while pending).
- The grid sub-line for a Bard stays SING · READY / SING · SUNG.

## abilityAlreadyOn note

`COMBAT_MENU_COPY.abilityAlreadyOn` ("ALREADY ON IT") was deleted, but it has neither a base line nor a ledger row, so it is not among the removed-line rows. Its words live on as `ABILITY_STATE_COPY.reason.alreadyOn`. Of the ten retired COMBAT_MENU_COPY keys nine are named on the review page (all but abilityAlreadyOn), plus the three ABILITY_VIEW_COPY keys: twelve rows in `x-94-04.json`.

## Verification

- Targeted run of both task verify lists: green; `voice-inventory --check-ledgers --plan x-94-04 --after` 0 errors; `narrative-review --check` in sync.
- `git diff 17ecfe45 -- test/unit/fixtures/shell-snapshots` prints nothing (thief.hero.txt and mu.hero.txt did not move).
- Full `npm test`: 10280 tests, 10272 pass, 0 fail, 8 skipped (baseline 10265 / 10257 / 0 / 8; +15 = the new view test file).

## Deviations from Plan

- **TDD split:** the new view test file carries the Hero assertions and the ABILITY_VIEW_COPY retirement check only from Task 2 (they were observed RED there and written together with the Task 1 file); Task 1's commit is green on its own verify list.
- No rule 1-3 fixes were needed. The tap-agrees sweep uses the refusal event's `rounds` field for Sing (`actionRefused songResting`) and `left` for abilities (`abilityRefused cooldown`), as the engine emits them.

## Known Stubs

None.

## Threat Flags

None: view-model and copy changes only; no new endpoint, auth path, file access or schema surface.

## Self-Check: PASSED

- `src/browser/combatMenu.js`, `src/browser/heroTab.js`, `test/unit/ability-state-view.test.js`, `docs/narrative-pass/why/x-94-04.json` exist.
- Commits `01b04205` and `bebb3710` exist and each ends with both trailers.
