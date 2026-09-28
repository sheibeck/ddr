---
phase: 77-combat-screen-oracle-readability
plan: 06
subsystem: combat-screen
status: complete
tags: [combat-ui, foe-card, fight-log, oracle, CMBUI-09, CMBUI-12]
requires:
  - 77-01 (combat submenu CSS, merged)
  - 77-02 (event-order fold; fightLogLinesFor passes order "event", merged)
provides:
  - "combatPanel.js#foeFamily(foe) and each foe card's `family` field"
  - "the .cb-foe-family span on the foe card's name line"
  - "fightLog.js#fightLogLinesFor: an encounter-start line carries its action's encounter-table dice"
  - "the fight-log sheet's bottom room and reveal scroll"
affects:
  - 77-08 (YOUR LOT chips; also edits combatPanel.js)
tech-stack:
  added: []
  patterns:
    - "one shared predicate (ENC_TYPES.includes(type)) for the foe card family and foe details' FAMILY UNKNOWN"
    - "a line's roll falls back to its own action's bookkeeping dice only for a named event type, never across actions (R-23)"
key-files:
  created:
    - test/unit/foe-family-card.test.js
    - test/unit/fight-log-oldest-row.test.js
  modified:
    - src/browser/combatPanel.js
    - src/browser/fightLog.js
    - mazeworld.html
    - test/unit/combatPanel.test.js
decisions:
  - "Foe family wording is the bestiary key, plural, upper-cased (ZIT · BEASTS); unknown type shows the name alone"
  - "CMBUI-12 root cause: the encounter-start row's own event has no roll span, its dice sit on the ORACLE_ONLY encounterRolled, so the row got no tap handler"
  - "An encounter-start line takes the encounterRolled dice of the same action that precede it (after any earlier encounterStarted), joined with ' · '; a wandering (camp) start stays plain"
  - "Dice-less rows stay plain (R-23): in a camp ambush the oldest row is the rations line, which has no dice and gets no handler"
metrics:
  duration: "~35 min"
  completed: 2026-09-26
  tasks: 2
  files: 6
---

# Phase 77 Plan 06: Foe family on the card and the oldest fight-log row's dice (Summary)

Each foe card now reads "NAME · FAMILY", with the family taken from the foe's own bestiary `type` and hidden exactly where foe details says FAMILY UNKNOWN. The oldest row of THE FIGHT SO FAR (the encounter start of a fight raised on a tile) now reveals the encounter-table dice that raised the fight. The sheet also keeps extra bottom room so the last row clears the gesture bar.

**Plan base:** `2a5bf9569b560303c452fecee0d9d6d54e2d35f4`

## What was built

### Task 1: the foe's family after its name (CMBUI-09)
- `src/browser/combatPanel.js`: `export function foeFamily(foe)` returns the upper-cased `type` when it is an `ENC_TYPES` key (for example "LAIR BEASTS" or "WALKING DEAD"). It returns null for a missing, non-string or unknown type, reads a hostile getter as unknown and never throws. It uses the same test as `foeDetails.js#familyLine`. Each card in `foeListViewModel` now carries `family` right after `name`. Nothing else on the card changed.
- `mazeworld.html#renderFoeCards`: when `c.family` is set, a `<span class="cb-foe-family">` with the text ` · FAMILY` is appended inside `.cb-foe-name`, after the name text. It is built with createElement and textContent. New CSS: `.cb-foe-family{font-size:7px;color:#a89c82}`, which is the meta line's muted colour at a size below the 8px name. The span is inline, so it wraps with the name.

### Task 2: the oldest fight-log row reveals its roll (CMBUI-12)
- `src/browser/fightLog.js`: `fightLogLinesFor` now uses a new helper, `encounterStartRoll(events, idx)`, when a line's own earliest event gives no roll. The helper only applies when `events[idx]` is an `encounterStarted`. It collects the Oracle detail of the same action's `encounterRolled` events that come before it, stopping at any earlier `encounterStarted`, and joins them in order with " · ". Otherwise the roll stays null.
- `mazeworld.html`:
  - `.mw-fl-rows` gains `padding-bottom:calc(72px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)))`.
  - `renderFightLog`'s reveal handler calls `roll.scrollIntoView?.({ block: "nearest" })` when the roll opens.

## CMBUI-12 reproduction evidence and confirmed cause

The reproduction is `test/unit/fight-log-oldest-row.test.js` (a). It runs the real engine with the real shell sheet in the sandbox. The hero steps onto a dot, the dispatch routing from `dispatchWithNarration` is mirrored, then the test taps Fight! and plays two attack rounds before opening the sheet.

- **Engine events for the move (rngState 1):** `moved, encounterRolled, encounterStarted`.
- **Oldest row text:** "Bat/Rat, Viper, Viper", which is the move's encounter-start line logged under ROUND 1.
- **Unfixed code (commit 6e0e14f3 run against the plan-base fightLog.js):** the oldest entry's `roll` was `null` (the test failed with "expected 'Table 6, roll 1: The dice decide — Beasts.', actual null"). Because of that, `renderFightLog` built no `.cb-log-roll`, set no `onclick` and gave the row no `role="button"` (the R-23 branch). A tap on that row did nothing. A direct probe showed the same thing for rngState 2 ("Ned") and 3 ("Viper"): the encounter-start line always had `roll: null`, while the next line, the Fight! step's initiative line, had its dice.
- **Confirmed cause:** a data problem. `EVENT_NARRATION.encounterStarted` has no `<span class="roll">`. The table dice are on `encounterRolled`, which is in `ORACLE_ONLY` and never gets a line of its own. So the encounter-start row had nothing to reveal and no handler. Nothing else explained the report: every other row in the reproduction had its roll and handler.
- **Layout:** the gesture-area cause can't be reproduced in the sandbox, which has no layout engine. The CSS bottom room and the reveal scroll are hardening against it, and the Pixel 7 check below backstops it.
- **Camp ambush (b):** the events are `dayBegan, rationsEaten, wanderingMonster, encounterStarted`. The lines are "Rations: −1 (5 left)." with no dice, "Camp disturbed." with the dice "1 of 8 night-hours disturbed" and a working tap, and "Wandering: Philly" with no dice, since that action has no `encounterRolled`. **Recorded: in a camp ambush the oldest row is the dice-less rations line, and it stays plain per R-23.** If the user wants every row tappable, for example with "no dice for this one", that is the small follow-up the plan flagged.

## Tests

- New `test/unit/foe-family-card.test.js` (10 tests):
  - foeFamily for every ENC_TYPES key;
  - null for missing, non-string, near-miss, unknown and hostile inputs;
  - the family comes from `type` and never from the name;
  - agreement with foe details for every key, an unknown type and undefined;
  - card `family`, including an elite "DREAD ZIT · BEASTS", same-name foes and a dead foe that keeps DOWN;
  - the card's key order;
  - sandbox render of the span, including the unknown case with no span and no separator, and tap-to-aim unchanged;
  - the CSS.
- New `test/unit/fight-log-oldest-row.test.js` (11 tests):
  - (a) reproduction and fix;
  - (b) camp ambush;
  - (c) no-dice refusal;
  - (d) single row under ROUND 1 toggles only itself;
  - (e) null or empty log: no rows, no hint, no throw;
  - (f) scrollIntoView with `block: "nearest"` on reveal only, and no throw without the method;
  - (g) the bottom-padding CSS;
  - four `fightLogLinesFor` unit cases: preceding roll, nothing invented, a second encounter takes only its own rolls, multiple rolls joined.
- **Re-pinned:** `test/unit/combatPanel.test.js`, where the two `foeListViewModel` deepEqual card pins gain `family` (CMBUI-09 comment). No pin in `fightLog.test.js` or `fight-log-sheet.test.js` moved, so neither was edited. Their CSS test pins only `overflow-y` and `min-height` on `.mw-fl-rows`, and no existing case had an encounter-start line with a preceding `encounterRolled`.
- **Full gate:** `npm test` 6902/6902 pass, 0 fail (base 6881 + 21 new, parity included). `git diff --quiet 2a5bf95 -- engine/` exits 0. No fixtures moved, and FIXTURE-INVENTORY.md is untouched. No bot runs.

## Deviations from Plan

None. The plan was executed as written. There was one small test-harness detail: the scrollIntoView options object is built in the sandbox's own realm, so test (f) compares it by JSON instead of deepEqual.

## Note for 77-08

`src/browser/combatPanel.js` now exports `foeFamily(foe)`, and every `foeListViewModel` card carries `family` (string or null), placed between `name` and `meta`. `test/unit/foe-family-card.test.js` pins the exact card key order. If 77-08 adds card fields, update that key list.

## Human check (Pixel 7, milestone close)

- Every foe card shows its family after its name (for example "ZIT · BEASTS"), readable on the phone. A deep-floor elite reads "DREAD ... · FAMILY".
- In a fight long enough to scroll, open THE FIGHT SO FAR, scroll to the bottom and tap the last (oldest) row. It should reveal its dice ("Table n, roll n: The dice decide — ..."), with the revealed line fully visible above the gesture bar.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: test/unit/foe-family-card.test.js, test/unit/fight-log-oldest-row.test.js, src/browser/combatPanel.js (`export function foeFamily`), src/browser/fightLog.js (`encounterRolled`), mazeworld.html (`cb-foe-family` x2+, `scrollIntoView`)
- FOUND commits: ac3fefec, 837bb5a0, 6e0e14f3, 8f87ff9d
