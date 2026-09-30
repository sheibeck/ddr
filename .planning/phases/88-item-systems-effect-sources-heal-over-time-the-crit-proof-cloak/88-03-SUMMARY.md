---
phase: 88-item-systems-effect-sources-heal-over-time-the-crit-proof-cloak
plan: 03
subsystem: tests
tags: [items, cloak-of-strength, crit-ward, ITEM-04, test-only]
requires:
  - phase: 88-01
    provides: "src { slot, n } on timer records, endSourceEffects, the itemEffectEnded event"
provides:
  - "every ITEM-04 clause pinned by a named test in test/unit/cloak-crit-ward.test.js, with a clause-to-test map in the file header"
  - "the Cloak of Strength ward pinned to end through the 88-01 source link (hero take-off and swaps, Joiner sheet through the helper)"
affects: [88-04, 89]
tech-stack:
  added: []
  patterns:
    - "fakeRng-driven foe top-face swings assert 37 (crit) versus 31 (warded) for the same two draws"
key-files:
  created: []
  modified:
    - test/unit/cloak-crit-ward.test.js
key-decisions:
  - "Test-only plan: no engine, content, shell or fixture change; every new pin passed on first run, so there was no ITEM-04 bug to fix."
requirements-completed: [ITEM-04]
duration: ~15 min
completed: 2026-09-30
status: complete
---

# Phase 88 Plan 03: pin the Cloak of Strength's crit ward (ITEM-04 close) Summary

**`test/unit/cloak-crit-ward.test.js` grows from 14 to 23 tests: the ward's ending through 88-01's source link (hero take-off, two swaps, Joiner sheet, narration), a Joiner's own crits, the Crit-proof chip set against the Fighter's Bracing, exact-name identity and the empty edge, with a header that maps every ITEM-04 clause to its test.**

No engine change. All nine new pins passed on their first run, so no ITEM-04 bug was found and nothing was loosened.

## Accomplishments

- **The ward ends with the cloak.**
  - Hero take-off: `unequipSlot` emits `itemUnequipped` then `itemEffectEnded { item: "Cloak of Strength", kind: "critWard", slot: "cloak", why: "off", left: 50, ready: 100 }`. `critWardOf` reads null, the Crit-proof chip is gone, an `itemCooldown` chip names the cloak, the record is `{ cadence: "squares", left: 100, phase: "cooldown" }` (50 effect squares unwalked + 50 cooldown), and the next foe top face crits for 37 with no `critWarded` event.
  - Hero swaps: a different cloak and an identical Cloak of Strength copy each end it (`why: "swap"`); the identical copy is refused with `useRefused { reason: "cooldown", left: 100 }`.
  - Joiner sheet: `endSourceEffects(state, ada, [], { slots: ["cloak"], why: "off" })` pushes one `itemEffectEnded` with `member: "Ada"`, `critWardOf(ada)` is null, the hero is untouched, the next foe crit on Ada lands (37), and a second call is a no-op.
  - Narration: the Oracle line reads "Your Cloak of Strength comes off ... critical hits can find you again. Ready again in 100 squares"; the rail line "Cloak of Strength off: crits can land again"; the Joiner variants name Ada and never say "you".
- **A Joiner's own crits.** A party Knight wearing the cloak with a live linked ward, driven through `alliesTurn`: a top-face member strike is `crit: true` and doubles ((1 + 5) * 2 = 12), draws exactly two dice, emits no `critWarded`, and its events are byte-identical to the same strike with no cloak.
- **The chip's own name.** From the shell: `CONDITION_COPY` labels "Crit-proof" versus "Bracing" (differ, no "brac" in the cloak's), distinct `CONDITION_EXPLAIN` sentences; `HERO_CONDITIONS` critWard has source "item", braced has source "ability" with `sourceName` = `ABILITY_BY_ID.brace.name`; `critWard` is not an ability id (the Fighter's is `brace`); a braced Fighter with a live cloak shows both a `critWard` chip (source "Cloak of Strength") and a `braced` chip (no item source).
- **Identity by exact display name.** Cloaks named "cloak of strength" and "Cloak of Strength " have `activationFor` null, start no effect or record on use, never ward, and a foe top face crits.
- **Empty edge.** No cloak, worn but unused, and used then taken off each take the foe's crit (37), with nothing narrated as warded.
- **Traceability header.** "ITEM-04 clauses -> tests" lists a named test for each clause.

## Clause-to-test map

| ITEM-04 clause | Test |
|---|---|
| Hero ward | "a foe's top-face swing at a wearer with the cloak live lands as an ordinary hit, ..." (existing) |
| Joiner ward | "a Joiner with the cloak's effect live takes a foe's crit as an ordinary hit; ..." (existing) |
| Pursuit strike | "a pursuer's parting crit on a fleeing wearer is warded" (existing) |
| Hero own crits | "the wearer's own crits happen again: ..." (existing) |
| Joiner own crits | "a Joiner wearing the cloak with its ward live still lands its own crits: ..." (new) |
| Guard / Soldier ban | "Guard and Soldier still never crit, cloak or no cloak" (existing) |
| Chip Crit-proof, not Braced | "the chip: the live cloak shows its own Crit-proof chip, never Braced" (existing); "the chip and its name: Crit-proof (item) is never the Fighter's Bracing (ability), ..." (new) |
| Ward ends with the cloak | "take-off (hero): ...", "swap (hero): a different cloak ...", "swap (hero): an identical ... copy", "a Joiner sheet: the one end helper ends the ward ...", "narration: the ended ward names the Cloak of Strength ..." (all new) |
| Identity by exact name | "identity is the exact display name: ..." (new) |
| Empty edge | "empty: with no live ward (no cloak, worn but unused, or used then taken off) ..." (new) |

## Task Commits

1. **Task 1: the ward ending through the source link, hero and Joiner sheet** - `c6031c6e` (test)
2. **Task 2: a Joiner's own crits, the chip's own name, exact-name identity, the empty edge, the clause map** - `8b0cc046` (test)

## Deviations from Plan

None in outcome. Two small notes:

- **Joiner chip assertion dropped.** The plan's Task 1 wording did not ask for it, but my first draft asserted a Crit-proof chip on a Joiner sheet through `memberConditionsOf`. That function only reports live duration abilities and the member's Brace (`liveAbilityChips`, `braced`), never item effects, so a Joiner's live cloak ward has no chip today. That is existing behaviour outside this plan (the ward itself works, and only the hero's chip is pinned as the plan specifies); the assertion was removed rather than the engine changed. Recorded below for Phase 89.
- **Unused import.** None left: `activationFor`, `alliesTurn`, `endSourceEffects`, `equipItem`, `unequipSlot` and `ABILITY_BY_ID` are all used.

## Tests

- `node --test test/unit/cloak-crit-ward.test.js test/unit/hero-conditions.test.js test/unit/status-chit-combat.test.js`: 68 / 68 pass. The file alone: 23 / 23.
- Acceptance greps: `ITEM-04 clauses` x1, `alliesTurn(` present, `cloak of strength` present, `unequipSlot(` / `endSourceEffects(` / `itemEffectEnded` present, `git diff --stat -- engine content src mazeworld.html` empty.
- `npm test` was not run: the plan changed no engine or shell code (rule: a test-only change needs the targeted file plus the guards named). No worktree-only CRLF doc-ledger failures were observed because the full suite was not run.
- No bot balance runs (deferred to Phase 92).

## Findings for Phase 89

- **A Joiner's live item effect has no chip.** `derived.js#memberConditionsOf` reports duration abilities and Brace only, so once Joiners can use items (ITEM-07) their Cloak of Strength ward would work (`critWardOf` reads the sheet's own timers) but show no Crit-proof chip. Worth deciding with ITEM-07.

## Known Stubs

None.

## Threat Flags

None.

## Human verification (deferred to end of run)

- [ ] A Fighter wearing a used Cloak of Strength braces in a fight: the Crit-proof and Bracing chips show side by side with different names.
- [ ] Take the Cloak of Strength off after using it: the Crit-proof chip goes and the Oracle says criticals can land again.

## Self-Check: PASSED

- Commits `c6031c6e` and `8b0cc046` exist; `test/unit/cloak-crit-ward.test.js` is the only file changed by the tasks; the verify command is green.
