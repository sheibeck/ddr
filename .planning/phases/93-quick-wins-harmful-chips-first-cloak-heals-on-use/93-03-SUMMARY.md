---
phase: 93-quick-wins-harmful-chips-first-cloak-heals-on-use
plan: 03
subsystem: narration-and-docs
tags: [items, cloak, narration, patch-notes, item-audit, guard-test]
requires: [93-01, 93-02]
provides:
  - "Oracle and rail knit start lines (hero and Joiner) read itemEffectStarted.now: 'a d6 hp back now, then every 10 squares you walk, 3 more times'"
  - "CONDITION_EXPLAIN.knit says the first d6 came back the moment the cloak was used"
  - "docs/ITEM-AUDIT.md cloak row restated (ruled 2026-10-03) plus a dated ITEM-08 Rulings entry"
  - "docs/patch-notes/2.4.0.md DRAFT with the cloak line (Items & gear) and the harmful-chips line (Interface)"
  - "test/unit/cloak-one-rule.test.js: one-rule-everywhere guard"
affects: []
tech-stack:
  added: []
  patterns: ["start line reads the event's own now/every/ticks/heal; the instant heal is the existing healTick line, no new event type"]
key-files:
  created:
    - docs/patch-notes/2.4.0.md
    - test/unit/cloak-one-rule.test.js
  modified:
    - src/browser/eventNarration.js
    - src/browser/narrationLines.js
    - mazeworld.html
    - src/browser/heroConditions.js
    - test/unit/heal-over-time-lines.test.js
    - docs/ITEM-AUDIT.md
    - docs/GEAR-BALANCE.md
    - docs/USABLE-FEATURES-AUDIT.md
    - docs/DIFFICULTY-RETUNE.md
key-decisions:
  - "No new event type, no EVENT_NARRATION or LINE_FOR key: the instant heal stays the existing healTick ('Tick 1 of 4' / '(1/4)')"
  - "Without now the 2.3.0 start lines are byte-identical; a bare payload with now falls back to the plain line"
  - "The ITEM-AUDIT pin for the renamed use test is the unique prefix 'use: heals a d6 at once from the healTick stream (tick 1 of 4)' because the full title contains '; ' (the pin separator)"
requirements-completed: [ITEM-08, CHIP-01]
duration: 40min
completed: 2026-10-03
status: complete
---

# Phase 93 Plan 03: The cloak's words, the ledgers and the 2.4.0 draft Summary

**The cloak's start lines, chip explanation, ITEM-AUDIT row, ledgers and 2.4.0 DRAFT notes all state one rule (a d6 at once, then three more every ten squares walked), and a guard test fails the day any surface or the engine's instant tick drifts from it.**

## Tasks

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | Start lines say "now, then 3 more"; chip explanation says the same | aef8bc32 |
| 2 | ITEM-AUDIT row and ruling, 2.4.0 DRAFT notes, one-rule guard test | 8293eb63 |
| 3 | Item ledgers restate the cloak; final gates | 53a6035f |

## What was built

- `src/browser/eventNarration.js`, `src/browser/narrationLines.js`: an `e.now === true` branch in the hero and Joiner `knit` start lines. Hero Oracle: "30 squares of knitting: a d6 hp back now, then every 10 squares you walk, 3 more times. Fights do not count for the rest. Only walking does." Rail: "30 squares of knitting: a d6 hp now, then every 10 squares walked, 3 more times." Joiner twins read "is knitting for 30 squares: ...". One follow-up reads "once more". The `healTick` builders are untouched, so the next line reads "Tick 1 of 4" / "(1/4)", also in the fight log.
- `mazeworld.html`: `CONDITION_EXPLAIN.knit` = "The first d6 of hp came back the moment you used the cloak. Another comes back every ten squares you walk, three more times. Standing still and fighting do not count for those. ..." The chip itself (3, 2, 1) is unchanged. `src/browser/heroConditions.js`: comment only.
- `docs/ITEM-AUDIT.md`: the cloak row's Text cell equals the item txt; Engine, Canon and Verdict (`ruled (2026-10-03)`) state ruling B; two new pins; a `- ITEM-08 (2026-10-03, Phase 93)` bullet in `## Rulings` (does not start with `- Q`); header count 119 to 121 distinct pins.
- `docs/patch-notes/2.4.0.md`: DRAFT, Headline, Items & gear (cloak, old to new with the arrow), Interface (harmful chips first). `validatePatchNotes(md, "2.4.0")` returns no problems. 2.3.0.md, patchNotesData.js and version.properties untouched; `--write-module` not run.
- `docs/GEAR-BALANCE.md`, `docs/USABLE-FEATURES-AUDIT.md`, `docs/DIFFICULTY-RETUNE.md`: the cloak's current rule restated, history kept, price stated unchanged (1,400; `engine/economy.js` untouched).
- `test/unit/cloak-one-rule.test.js` (6 tests): content and card line, ITEM-AUDIT row and Rulings, chip copy in the shell sandbox, 2.4.0 notes (DRAFT, validates, bullet), engine (real `useItem`, throwing rng: start with `now` then `healTick` tick 1 of 4; `healTicksTotal` is `started.ticks + 1`; Oracle and fight-log lines), and the combined "one rule everywhere" test.
- `test/unit/heal-over-time-lines.test.js`: 5 new "knit start (now)" tests and a stronger chip-copy test.

## Test results and gates

- Full `npm test`: 10,213 tests, 10,205 pass, 0 fail, 8 skipped (93-02 baseline 10,202 / 10,194 / 0 / 8; this plan added 11 tests).
- `node tools/narrative-review.mjs --check`: pages in sync. `node tools/patch-notes.mjs --check`: `patch notes 2.3.0: OK (Play cut 474/500)`. `node tools/stale-terms.mjs`: allow-list rot (none).
- `node tools/fixture-inventory.mjs --json`: no parity or fixture file touched by this plan, so unchanged from 93-02.
- `grep -rn "Regeneration" store-listing`: no match (the directory exists; no store text states the cloak rule, so nothing for the user to edit).
- `"Cloak of Regeneration": 1400` still present in `engine/economy.js`; `test/parity/prototype-master.js.txt` untouched.

## Deviations from Plan

None - plan executed as written. (Tooling note: edits were made with scripts that preserve each file's own line endings; commit stats are small. The two new files commit as LF per autocrlf.)

## Known Stubs

None.

## Threat Flags

None. Text, docs and tests only; no new endpoint, storage key or schema.

## Human verification (end of phase, batched)

1. Use the Cloak of Regeneration: the Oracle reads the start line ("... a d6 hp back now, then every 10 squares you walk, 3 more times ...") then "Tick 1 of 4"; the rail shows "(1/4)".
2. Tap the Regenerating chip: the explanation says the first d6 came the moment you used the cloak.
3. Open the cloak's Gear card, a store's cloak line and a found cloak: each reads "a d6 hp back at once, and again every ten squares you walk, three more times".
4. The user reads docs/patch-notes/2.4.0.md (DRAFT) and agrees or edits it at release time.

## Self-Check: PASSED

- Files present: docs/patch-notes/2.4.0.md, test/unit/cloak-one-rule.test.js, 93-03-SUMMARY.md.
- Commits aef8bc32, 8293eb63, 53a6035f exist in `git log`.
