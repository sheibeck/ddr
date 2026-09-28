---
phase: 79-content-narrative-pass
plan: 10
subsystem: map-and-shell-copy
status: complete
tags: [VOX-05, ROLL-04, narrative-pass, map, legend, settings, camp]
requirements: [VOX-05, ROLL-04]
dependency_graph:
  requires: [79-01, 79-03, 79-07, 79-09]
  provides:
    - "the LOCKED BOX and TRAP legend rows, roll-high and pinned to engine/encounters.js#openChest/#springTrap"
    - "the MAKE CAMP sheet's live ration count (window.__mzNightlyEats)"
    - "docs/narrative-pass/why/79-10.json (8 rows)"
  affects: [79-11, 79-12, 79-13]
tech_stack:
  added: []
  patterns:
    - "a legend range is read from the engine's own check event (chestLockRolled / trapAvoided) and formatted with facesRangeText, so the copy cannot drift from the rule"
    - "a count in static copy is a {token} filled from the same helper the engine's gate uses"
key_files:
  created:
    - docs/narrative-pass/why/79-10.json
  modified:
    - src/browser/mapMarks.js
    - mazeworld.html
    - src/browser/hudMenu.js
    - docs/SHELL-MODULES.md
    - test/unit/mapMarks.test.js
    - test/unit/shell-map-hud.test.js
    - test/unit/typed-text.test.js
decisions:
  - "LOCKED BOX states both lock paths: 6–10 on a d10 with lockpicks or Locks, 13–20 on a d20 bare-handed; a failure keeps the box shut for good (its square is cleared before the roll) and never costs a pick"
  - "TRAP states the d20 dodge (16–20, 13–20 for an Acrobat) and the table's spread (a d6 of darts to a spike pit's d10×5)"
  - "The camp sheet's ration count is filled from window.__mzNightlyEats, the camp gate's own helper"
  - "The Settings row 'Confirm before quit' is now 'Confirm abandon': it only arms the ☰ Abandon row"
metrics:
  duration: "about 50 minutes"
  completed: 2026-09-27
  tasks: 2
  files: 8
---

# Phase 79 Plan 10: Map, camp and shell copy Summary

The MARKS legend's LOCKED BOX row now reads roll-high, and its ranges are pinned to the engine's own lock check. The TRAP row now describes the real dodge roll and damage spread. The camp sheet, the stair overlay, the back-button Oracle line and one Settings label now say what the game actually does. Every other string 79-10 owns passed the rubric and is unchanged.

**Plan base:** `018d9a63`

## Commits

| Task | Commit | What |
|---|---|---|
| 1 (RED) | `608969d5` | test: pin the LOCKED BOX and TRAP rows to openChest's and springTrap's own events |
| 1 (GREEN) | `045c56e4` | feat: the two legend rows rewritten; the move-verbatim pin re-pinned |
| 2 | `2548b6a3` | feat: camp, stair, back-button and Settings copy; re-pins; the new ration-fill test; the ledger |

## Every changed string (before → after)

| Key | Before | After | Why |
|---|---|---|---|
| bank:MARKS_LEGEND.4.desc (LOCKED BOX) | 1–5 on a d10 opens it. The rest costs you a pick. | With lockpicks or the Locks skill, 6–10 on a d10 opens it (more faces with practice or wits); bare hands need 13–20 on a d20. Fail and it stays shut for good. | The range was roll-under, and the bare-handed d20 path was missing. A failure never costs a pick: openChest stops at chestLocked, and resolveFeature has already cleared the square |
| bank:MARKS_LEGEND.3.desc (TRAP) | A d6 out of you, before you knew it was there. | Step on it and a d20 decides: 16–20 dodges it (13–20 for an Acrobat). Fail and it goes off, anything from a d6 of darts to a spike pit's d10×5. Going around is free. | The mark is drawn only on a square you can already see, there is a d20 dodge first, and trap damage runs from d6 to d10×5 |
| raw:mazeworld.html#MAP_COPY (camp.copy) | … One ration buys the sleep and a full spell book. … | … Supper is {rations}: it buys the sleep, some HP back and a full spell book. … | A Troll eats two rations and Joiners eat more (nightlyEats), and a fed night also heals |
| raw:mazeworld.html#MAP_COPY (camp.sleep) | SLEEP 1 RATION | SLEEP {rations} | Same reason: the button now shows the real count |
| raw:mazeworld.html#MAP_COPY (stair.line) | Floor {n} is colder, longer, and considerably less forgiving. Nobody has asked you to do this. | Floor {n} is below, and there is no stair back up. It only gets meaner from here. Nobody has asked you to do this. | Every floor is 21×21 (engine/maze.js GW/GH), so "longer" was false. The fact that matters is that the trip is one way |
| raw:mazeworld.html#openCampSheet (new) | (none) | "1 ration" / "2 rations" (the {rations} fill) | Comes from window.__mzNightlyEats, the camp gate's own helper |
| raw:mazeworld.html#top | Press back again to abandon this delve. | Press back again to close the game. This delve is saved for later. | A second press runs exitApp. The run is already persisted on every dispatch and resumes from ENTER, so nothing is abandoned |
| raw:mazeworld.html#markup | Confirm before quit | Confirm abandon | The setting only arms the ☰ ABANDON THIS CHARACTER row. SAVE & QUIT never asks for confirmation, and the back button always asks once |

**Row widths:** "Confirm abandon" is shorter than the old label. "SLEEP / 2 RATIONS" is one character longer than "SLEEP / 1 RATION". The legend rows are wrapped paragraphs of about the same length as the Phase 78 CREVICE and WALL rows. Nothing was added to a fixed-width row.

## Judged and passing (unchanged)

- **Legend rows:** ENCOUNTER, TELEPORT (a d20 of squares matches teleport()), ONE-WAY DOOR, CREVICE, DESCENT, WALL, YOU and HEARD.
- **Camp and stair buttons:** "WALK ON", "THE STAIR DOWN", "GO DOWN" and "NOT YET".
- **☰ menu:** MARKS, CENTRE MAP, MAKE CAMP, SETTINGS, SAVE & QUIT, ABANDON THIS CHARACTER, TAP AGAIN TO BURY THEM and NEW CHARACTER.
- **Arrow pad:** ARROW_PAD_COPY. The Settings order keeps "Tap to move" first, and the pad stays opt-in.
- **Roller:** ROLLER_COPY and "THE TABLES DECIDE" with its subline. The 79-03 footer was not touched.
- **Title screen:** Enter and View the Dead.
- **Settings labels:** Text size, Movement, Pad, Sound, the volume sliders, Haptics, Set dressing (the user's own term from Phase 59) and the dev rows.
- **HUD:** the counters (Depth, Day, Squares, Rations), the hero-sheet headings and the Oracle heading with its "↑ newer" pill.
- **Combat screen:** the static "Encounter" heading and "The fight so far".
- **The combat report:** Victory / They stand down, Felled, Took, Recovered, wilmst, the level-up lines and "Left standing on".
- **renderRail:** the Joiner lines.
- **Other raw literals:** "Delve resumed.", "Floor 1. The entrance seals behind you…", the dev-run line, the Bubble-mirror ward sentence in explainCondition, conditionTapText's waiver sentence, and the paintConditions chip details.
- **No copy of their own:** darknessView.js, settings.js, accountChip.js (its account copy is 79-06's bank), playGames.js (only the dev fake's "Dev Delver") and hudBands.js. The HUD counter labels pass; identityParts is 79-12's by OWNER_RULES.

**Static headings handed on by 79-09:** none were handed on. 79-09 reported none failing.

**Combat-screen static markup handed on by 79-07:** audited. Only "Encounter" and "The fight so far" are there, and both pass.

## Checks

- `node tools/voice-inventory.mjs --owner 79-10 --roll-under --hygiene --safety --count` prints **0**. At base it was 1: the LOCKED BOX low-range. `--surface map --roll-under --count` also prints 0, and `--twins` prints 0.
- `node tools/voice-inventory.mjs --check-ledgers --plan 79-10 --after --coverage` reports 10 ledger files and **0 errors**. `node --test test/unit/voice-corpus.test.js` passes 27 of 27.
- `git diff --quiet 018d9a63 -- engine content test/parity` exits 0.
- Full suite (`node --test`): **7,428 of 7,428 pass**, 0 fail.
- **No fixture moves.** No shell snapshot, event-order corpus or parity fixture contains a changed string, so nothing was regenerated and there is no FIXTURE-INVENTORY subsection. draw() and paint() were not touched, so the reduced-motion hash pins did not move.
- No bot or tuning runs were made (user ruling 2026-09-26).

## Re-pinned and new tests

Each re-pin carries a "VOX-05 (79-10)" comment that quotes the old line.

- `test/unit/mapMarks.test.js`:
  - **Re-pin:** the move-verbatim `OLD_MARKS_LEGEND` for the trap and chest rows.
  - **New (the RED gate):** the LOCKED BOX row must contain `facesRangeText` of openChest's own chestLockRolled event, for picks or Locks I (d10) and for bare hands (d20). A failed roll keeps the picks and never says "costs you a pick", and a source pin shows resolveFeature clears the box's cell before the roll.
  - **New:** the TRAP row must contain springTrap's trapAvoided range for a Knight and an Acrobat, the TRAPS table's smallest die and the spike pit's d10×5.
- `test/unit/shell-map-hud.test.js`:
  - **Re-pin:** MAP_COPY.camp's `sleep` and `copy` literals.
  - **New:** a sandbox test opens the camp sheet for a Human ("1 ration") and a Troll ("2 rations"), then checks the body, the SLEEP button and that no token is left unfilled.
- `test/unit/typed-text.test.js`: the stair overlay's expected line. This test is outside the plan's list but owned by no sibling. It is the same kind of Rule 3 re-pin 79-09 made.
- `test/unit/shell-menu-quit.test.js` needed no edit. Only its test title mentions the setting, and titles are not pins.
- `test/unit/tapStep.test.js` keeps the old TRAP sentence. It is a stub legend object passed into inspectCell, not a pin of the real row.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The TRAP legend row was wrong too**
- **Found during:** Task 1
- **Issue:** the plan named only the lock line, but the TRAP row claimed a flat d6 hit and "before you knew it was there". The mark is drawn only on a seen square, and the dodge roll was missing.
- **Fix:** rewrote the row and pinned its dodge range and damage spread to springTrap and TRAPS.
- **Commits:** 608969d5, 045c56e4

**2. [Rule 1 - Bug] The camp sheet's count was hard-coded**
- **Found during:** Task 2
- **Issue:** "SLEEP / 1 RATION" and "One ration buys…" were wrong for a Troll or a party.
- **Fix:** added a `{rations}` token, which openCampSheet fills from window.__mzNightlyEats.
- **Commit:** 2548b6a3

**3. [Rule 3] Comment and doc references to the renamed setting**
- **Found during:** Task 2
- **Fix:** hudMenu.js comments, two mazeworld.html comments and docs/SHELL-MODULES.md now say "Settings › Confirm abandon". docs/UAT-v2.0.md was left as history.
- **Commit:** 2548b6a3

The plan listed files that needed no change: darknessView.js, hudBands.js, roller.js, settings.js, arrowPad.js, accountChip.js, playGames.js, and the tests dark-surfaces, hudBands, roller, settings, hudMenu, hud-menu-layout, arrow-pad, shell-arrow-pad, shell-hearing, settings-volume-shell and dead-lockdown. They were judged or run, and nothing in them failed.

## Handed on

- **79-12 (or 79-11 after merge), rail.js `RAIL_COPY.quit`:** the line "BACK AGAIN TO QUIT" / "Press back once more and this delve is abandoned. Nobody will write it down." fails rubric 4 in the same way as the Oracle line fixed here. A second back press runs `App.exitApp()`, the run is already saved (engineAdapter.js#persist), and ENTER resumes it. rail.js is 79-11's file, and 79-11 runs in parallel, so it was not edited. Suggested line: "Press back once more to close the game. The delve waits for you." Until it is fixed, the rail card and the Oracle line on the same press disagree.
- **79-12, the hidden `<section class="notes" hidden>` in mazeworld.html** ("Where this prototype departs from the rulebook"): it is never shown, because nothing unhides it, so it is not player-facing and was left alone. It is badly stale:
  - It says sleep heals d10 + 2×level; it now heals a fraction of max HP.
  - It says spells return every 20 squares; since RULES-15, a fed night refills the book.
  - It describes a "smash it for half the coin" fallback that does not exist.
  - It says traps are "dodged on 1–5", which is roll-under; the dodge is 16–20.
  - It says "Five floors and a Gate"; the game now aims at depth 20.
  - It has an empty `<code>` after "breaks away on".

  Decide whether to delete it (greenfield) or bring it up to date.
- **79-12, house spelling:** the Hero sheet's static `<dt>Armor</dt>` belongs with the armor/armour decision that 79-04 and 79-09 already handed on. It was not changed here.

## Known Stubs

None.

## TDD Gate Compliance

Task 1 (`tdd="true"`) has a `test(79-10)` RED commit (608969d5, failing for the right reason: the old desc lacked the engine's ranges), followed by a `feat(79-10)` GREEN commit (045c56e4).

## Self-Check: PASSED

- FOUND: docs/narrative-pass/why/79-10.json
- FOUND: src/browser/mapMarks.js (rewritten trap and chest rows)
- FOUND commits: 608969d5, 045c56e4, 2548b6a3
