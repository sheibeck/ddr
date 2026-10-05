---
phase: 96-fantasy-flavour-ii-races-sub-classes-abilities-chips-the-rev
plan: 06
subsystem: ui
tags: [flavour, abilities, skills, rules-layer, combat-menu, hero-tab, final-sheet, snapshots]

requires:
  - phase: 96-03
    provides: flavorOfAbility and flavorOfSkill (31 lines)
  - phase: 96-05
    provides: the identity-surface pattern (flavour, then a RULES toggle holding the exact text)
  - phase: 95-02
    provides: mountRules, wrapRow, withFlavor and the Always show the rules switch
provides:
  - the combat ABILITIES rows and the Bard's SING row reading flavour in the description slot, state label untouched, ability txt behind RULES
  - the Hero tab ability list and passive special-skill list reading flavour with RULES
  - the Final Sheet's WHAT THEY COULD DO rows reading flavour, exact text only with Always show the rules on (no control)
  - surface cases (c), (v), (w), (x), (y) in rules-surfaces.test.js
affects: [96-07, 96-08]

tech-stack:
  added: []
  patterns:
    - "An ability row is withFlavor(row, { lead, rules, rulesId }) with the state label left in the cost slot"
    - "A read-only surface shows flavour and mounts the exact text only when alwaysRules() is true (mountRules then adds a visible body and never a button)"

key-files:
  created: []
  modified:
    - src/browser/combatMenu.js
    - src/browser/heroTab.js
    - src/browser/finalSheet.js
    - test/unit/combatMenu.test.js
    - test/unit/final-sheet.test.js
    - test/unit/rules-surfaces.test.js
    - test/unit/shell-ability-states.test.js
    - test/unit/shell-tab-snapshots.test.js
    - test/unit/fixtures/shell-snapshots/fighter.abilities-states.txt
    - test/unit/fixtures/shell-snapshots/fighter.hero-in-combat.txt
    - test/unit/fixtures/shell-snapshots/thief.hero.txt

key-decisions:
  - "abilitiesViewFor's key set stays byte-identical (ability-state-view.test.js pins it and must stay unedited), so the Hero renderer and the Final Sheet read flavorOfAbility by name instead of the plan's additive `flavor` field on ability rows; skills rows do carry an additive `flavor`"
  - "The Final Sheet maps skills and abilities separately so an active skill (no skill flavour) never borrows its twin ability's line"

patterns-established:
  - "Lock rule for RULES on the combat ABILITIES list is the existing #cb-act[data-locked] .mw-rules-btn pointer-events:none rule; pinned by a source assertion plus a locked-render check"

requirements-completed: [FLAVOR-04]

coverage:
  - id: D1
    description: "Combat ABILITIES and SING rows: flavour in the desc slot, state label byte for byte in the cost slot, txt behind a sibling RULES toggle; a RULES tap never acts"
    requirement: FLAVOR-04
    verification:
      - kind: unit
        ref: "test/unit/combatMenu.test.js; test/unit/rules-surfaces.test.js (c); test/unit/shell-ability-states.test.js; ability-state-copy/view/a11y unedited"
        status: pass
    human_judgment: false
  - id: D2
    description: "Hero tab ability and passive-skill lists: flavour, RULES with the exact txt (txt2 at level two), tolerant fallback"
    requirement: FLAVOR-04
    verification:
      - kind: unit
        ref: "test/unit/rules-surfaces.test.js (v) (w) (y); test/unit/heroTab.test.js; test/unit/shell-tab-snapshots.test.js"
        status: pass
    human_judgment: false
  - id: D3
    description: "Final Sheet: flavour shown, exact text only with Always on, no button or handler ever"
    requirement: FLAVOR-04
    verification:
      - kind: unit
        ref: "test/unit/final-sheet.test.js (HUD-03 pins unedited); test/unit/rules-surfaces.test.js (x)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Layout of the new description line and RULES column in the 206 px ABILITIES list at large text size"
    requirement: FLAVOR-04
    verification: []
    human_judgment: true
    rationale: "Touch targets and text fit are device judgments; deferred to the end-of-run walk"

duration: 40min
completed: 2026-10-04
status: complete
---

# Phase 96 Plan 06: Ability and skill flavour on screen Summary

**The combat ABILITIES rows and the Bard's SING row, the Hero tab's ability and passive-skill lists, and the Final Sheet's tricks now lead with their flavour line; the exact text is one RULES tap away (Final Sheet: shown only with Always show the rules on, with no control). The Phase 94 state labels are untouched byte for byte.**

## Commits

| Task | Commit | What |
| ---- | ------ | ---- |
| 1 | `e00affc1` | combatMenu abilityRows and SING via withFlavor, declared re-pins, fighter.abilities-states regenerated, (c) cases |
| 2 | `2682a993` | Hero ability and skill lists, thief.hero (second move) and fighter.hero-in-combat regenerated |
| 3 | `c425dc1d` | Final Sheet tricks, final-sheet pin re-pinned, rules-surfaces cases (v) (w) (x) (y) |

## What changed

- **combatMenu.js:** `abilityRows` and the SING row go through `withFlavor` with `lead` = flavour, `rules` = the ability's `txt` (SING: `COMBAT_MENU_COPY.singDesc`), `rulesId` = `combat:ability:<key>` / `combat:ability:sing`. `desc`, `cost`, `state`, `enabled` and `dispatch` are untouched. No shell edit: `renderActionArea` already wraps any row that carries `rules`.
- **heroTab.js:** `renderAbilityRows` shows the flavour in the `<i>` and mounts `hero:ability:<id>` after the state span; the special-skills loop shows the passive skill flavour and mounts `hero:skill:<name>` with the exact text shown today (txt, or txt2 at level two). A row with no flavour (an active skill, an unknown skill) keeps today's markup with no toggle. `characterSheetViewModel` skills rows gain an additive `flavor`.
- **finalSheet.js:** tricks rows are `{ name, description, flavor }`; the note shows the flavour, and only when `alwaysRules()` is true `mountRules` adds a visible `final:trick:<name>` body. No button, no handler, no innerHTML; the HUD-03 pins pass unedited, setting off and on.

## fighter.abilities-states, one row before and after (Kata)

Before:

```
<button id="cb-row-ability-kata" class="cb-row" ... data-state="ready" onclick>
  <div class="cb-row-head"> <span class="cb-row-label"> text="KATA"  <span class="cb-row-cost"> text="READY"
  <div class="cb-row-desc"> text="one perfect form: +3 to hit on this strike, and it adds your level in damage; ready again 4 rounds after you use it"
```

After:

```
<div class="mw-rules-wrap">
  <button id="cb-row-ability-kata" class="cb-row" ... data-state="ready" onclick>
    <div class="cb-row-head"> <span class="cb-row-label"> text="KATA"  <span class="cb-row-cost"> text="READY"
    <div class="cb-row-desc"> text="Years of practice in one tidy motion, so the next blow lands better and bites harder."
  <button class="mw-rules-btn" aria-controls="mw-rules-combat-ability-kata" aria-expanded="false" aria-label="Rules for KATA" ...> text="RULES ▸"
  <div id="mw-rules-combat-ability-kata" class="mw-rules-body" hidden>
    <p class="mw-rules-line"> text="one perfect form: +3 to hit on this strike, and it adds your level in damage; ready again 4 rounds after you use it"
```

The four state words (READY, READY IN 3, SPENT THIS FIGHT, the two gate reasons), ids and data-state values are unchanged in all five rows.

## Declared re-pins

| File | Test | What moved |
| ---- | ---- | ---------- |
| test/unit/combatMenu.test.js | Bard ABILITIES SING test; Fighter kata/brace rows; Bard rows [sing, ...abilities]; Bard no-abilities rows | whole-row deepEqual pins gain `lead`, `rules`, `rulesId`; new import line for `flavorOfAbility` |
| test/unit/rules-surfaces.test.js | case (c) "an ability row is not wrapped" | replaced by three cases: ability rows wrapped (cost = state word, desc = flavour, body = txt), SING wrapped, a RULES tap never acts / repaint / Always on, plus the lock-rule pin |
| test/unit/shell-ability-states.test.js | ASTATE-05 ability list; ASTATE-01 SING | the assertions read the wrapper's first child (`rowButton`), same state and word checks; header paragraphs declare fighter.abilities-states and fighter.hero-in-combat |
| test/unit/shell-tab-snapshots.test.js | header | Phase 96 (FLAVOR-04), Plan 06 paragraph declares the thief.hero second move |
| test/unit/final-sheet.test.js | "skills and abilities carry name and description only" | rows gain `flavor`; keys are `description, flavor, name`; new import line |

heroTab.test.js, shell-abilities.test.js and dead-lockdown.test.js needed no edits (their sweeps stayed green).

New cases: rules-surfaces (c) x3 new, (v) x2, (w), (x) x2, (y): 10 pass under the name filter `Final Sheet|Hero abilities|Hero skills|Tolerant|tolerant`.

## Tests run (targeted only, no full suite, no bot runs)

- Task 1 set (combatMenu, rules-surfaces, shell-ability-states, ability-state-copy/view/a11y/state, once-per-fight-copy, combat-submenu-fit, combat-lock-shell, shell-combat-actions, shell-input-guards, abilities-catalog, value-abilities): 279 tests, 279 pass.
- Task 2 set (heroTab, shell-abilities, shell-ability-states, shell-tab-snapshots, rules-surfaces, ability-state-view/a11y, abilities-catalog, skill-audit, value-abilities, spell-skill-text-engine, feedback-payload): 315 tests, 315 pass.
- Task 3 set (final-sheet, dead-lockdown, rules-surfaces, heroTab, flavor-text, hp-not-wp): 117 tests, 117 pass. Extra guard set (flavor-lines-not-serialized, shell-no-content-copies, bridge-registry, flavor-layer, identity-flavor, rules-layer, combat-submenu-fit): 112 tests, 112 pass.
- `git diff --ignore-cr-at-eol --stat 57ef93c1 -- test/unit/fixtures/shell-snapshots engine test/parity test/determinism src/browser/abilityStates.js` lists exactly fighter.abilities-states, fighter.hero-in-combat and thief.hero. The seven unrelated fixtures `MZ_SNAPSHOT_UPDATE=1` rewrote (line endings only) and the one line-ending-only hero-in-combat rewrite after Task 1 were restored with `git checkout -- <file>`.
- No CRLF-only doc-ledger failures occurred in the files run.

## Deviations from Plan

**1. [Rule 3 - Blocker] Ability rows do not carry an additive `flavor` in abilitiesViewFor.** The plan asked for `flavor` on the `abilitiesViewFor` rows, but `test/unit/ability-state-view.test.js` ("Hero tab out of a fight: byte-identical to today") pins that view-model's exact key set and must stay unedited. The first implementation broke it, so `abilitiesViewFor` was reverted to byte-identical and `renderAbilityRows` and `finalSheetViewModel` read `flavorOfAbility(name)` directly. Skills rows do gain `flavor` (nothing pins their key set). Behaviour on screen is as planned.

**2. Line endings (no behaviour change):** the plan lists some tests as LF; this worktree checks every file out as CRLF (index LF). New lines were written CRLF to keep each working file uniform.

TDD note: as in 96-01 to 96-05, implementation and re-pinned tests landed together per task.

## Known Stubs

None.

## Threat Flags

None. T-96-16: the toggle is a sibling of the row button (wrapRow), a plain onclick that stops propagation; the (c) test asserts the row button never hears the tap and the state is unchanged, and the existing `#cb-act[data-locked] .mw-rules-btn` rule (pinned) keeps it inert mid-round. T-96-17: all new nodes use textContent via mountRules and createElement; the fallback skills markup is the same content-only innerHTML as before. T-96-18: the state label stays in the cost slot byte for byte; ability-state-* tests ran unedited.

## Human verification (deferred to end of run)

Pixel 7 walk:
- Combat ABILITIES list at text size L: the flavour line and the RULES column fit within the 206 px list cap, rows still scroll and read.
- The four states (READY, READY IN N, SPENT THIS FIGHT, gate reasons) still read apart by colour edge and word with the new description line.
- A RULES tap on an ability row never uses the ability or ends the round; the toggle is dead while a round's beats play.
- The Bard's SING row: flavour line, RULES body with the song rules, READY IN N between songs.
- Hero tab: ability list and special-skills list with RULES open and closed, a body stays open after switching tabs; Always show the rules On then Off.
- Final Sheet after a death: the WHAT THEY COULD DO flavour lines read well; with Always show the rules On the exact text sits under each; there is still no button.

## Self-Check: PASSED

- Files found: src/browser/combatMenu.js, src/browser/heroTab.js, src/browser/finalSheet.js, the five test files, the three fixtures.
- Commits found: e00affc1, 2682a993, c425dc1d.
- STATE.md, ROADMAP.md and REQUIREMENTS.md untouched.
