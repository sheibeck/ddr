---
phase: 78-hud-dead-state-climb-decisions
plan: 05
subsystem: browser-hud-narration
status: complete
tags: [hud, rail, narration, spell-charges, rules-15, hud-01]
requires:
  - 78-01 (hazard narration merged first)
  - 77-02 (event-order fold, default-fold corpus)
  - 77-05 (stampScrollCopyNotes, the stamp precedent)
provides:
  - "hudBands.js#identityParts/identityLine in the Race Sub-class · Lvl N form"
  - "eventNarration.js#stampBookRefill(events, before, after, maxOf)"
  - "narrationLines.js#bookRefillText(books) and LINE_FOR.spellChargeRecovered"
  - "--mw-font-hud-ident capped at 1.1 (band 1 follows band 2's cap)"
affects:
  - the rail (move/camp) and THE FIGHT SO FAR lead-in
  - band 1 of the HUD
tech-stack:
  added: []
  patterns:
    - "presentation-only stamp in engineAdapter.js#dispatch (before/after states, engine helper injected)"
key-files:
  created:
    - test/unit/book-refill-lines.test.js
  modified:
    - src/browser/hudBands.js
    - src/browser/narrationLines.js
    - src/browser/eventNarration.js
    - src/browser/engineAdapter.js
    - mazeworld.html (one HUD font-token line only)
    - test/unit/hudBands.test.js
    - test/unit/engineAdapter.test.js
    - test/unit/text-scale.test.js
    - test/unit/shell-map-hud.test.js
    - test/unit/fixtures/event-order/default-fold-corpus.json (declared regeneration)
decisions:
  - "Band 1 = race + (sub || cls) + ' · Lvl N'; falsy parts dropped; 'Lvl N' alone when none"
  - "stampBookRefill takes an optional 4th arg maxOf (engineAdapter passes engine/movement.js#maxCharges) because eventNarration.js never imports engine/"
  - "The refill rides rationsEaten (already a LINE_FOR line, before the wander check), so it reaches a same-step fight's lead-in; dayBegan stays ORACLE_ONLY"
  - "--mw-font-hud-ident capped at 1.1 like band 2 (orchestrator note from 78-02); the cap alone does not keep 'Lvl N' visible at L for most characters, see Deferred Issues"
metrics:
  duration: "about 55 min"
  completed: 2026-09-26
  tasks: 2
  commits: 4
---

# Phase 78 Plan 05: Band-1 identity line, regained-charge and book-refill rail lines Summary

Band 1 now reads "Dwarf Pickpocket · Lvl 3" (race and sub-class, no parent class, no parentheses). A regained spell charge gets a rail line again with its count ("(9/12)"). A fed new day that refills a spent book says "A new day. Your book is full again (12/12)." on the rail and in the Oracle, and names each member whose book refilled. The counts come from a pure stamp in `engineAdapter.js#dispatch`. The engine and content are untouched.

**Plan base SHA:** `c6de10dba86725e0c64e03aab460be96cf5bc3b6`

## Tasks

| # | Task | Commits | Files |
|---|------|---------|-------|
| 1 | Band 1 reads "Race Sub-class · Lvl N" (HUD-01) | f6749826 (RED), 105c2597 (GREEN) | hudBands.js, hudBands.test.js, mazeworld.html (token), text-scale.test.js, shell-map-hud.test.js |
| 2 | A regained charge and a refilled book get rail lines | 2c53668b (RED), a45819c7 (GREEN) | narrationLines.js, eventNarration.js, engineAdapter.js, book-refill-lines.test.js, engineAdapter.test.js, default-fold-corpus.json |

## What was built

**HUD-01 (hudBands.js).** `identityParts(c).line` is `[race, sub || cls]` with falsy parts dropped and joined by one space, then ` · Lvl N`. With none of the three, the line is just `Lvl N`. A falsy level reads Lvl 1, and a missing name or character keeps "Nameless". The functions never throw. The Hero tab still shows the full tag. `hud-bands-layout.test.js` needed no change because it derives its expected values from `identityParts`.

**Band-1 text-size cap (orchestrator note from 78-02).** `--mw-font-hud-ident` is now `calc(0.8125rem * min(var(--mw-text-scale), 1.1))`, the same cap 78-02 put on band 2. I modelled the fit over 2,000 rolled characters: 13px Courier Prime at 0.6em advance, 412px minus 28px padding and two 8px gaps, with the name and HP text left whole. The share of characters whose full line fits:

| Size | px/glyph | Full line fits |
|------|----------|----------------|
| S (0.85) | 6.63 | 99.7% |
| M (1.0) | 7.80 | 72.4% |
| L capped (1.1) | 8.58 | 29.3% |
| L uncapped (1.25) | 9.75 | 4.2% |

The cap is pinned in `test/unit/text-scale.test.js` (new "HUD-01 band-1 cap" test, which logs 8.58 against 9.75 uncapped) and in `shell-map-hud.test.js` (c).

**Spell-charge rail line.** `spellChargeRecovered` left ORACLE_ONLY. `LINE_FOR.spellChargeRecovered` is a minor rail line (tone magic, priority other; not a decision card). The Oracle sentence, which a move's rail line uses once the tags are stripped, now reads the count as have/max.

**Book-refill stamp.** `stampBookRefill(events, before, after, maxOf)` returns a new array. Each `rationsEaten` that carries the engine's own `refilled` flag gets `books: [{ who: "you" | memberIndex, name, have, max }]`. An entry goes in for the hero, then for each member (matched by index and the same name), only when spent charges were above 0 before and are 0 after. Every other element is the same object and the input is never mutated. `dispatch` captures `before = currentState` ahead of `applyAction`, which clones, and applies the stamp after `stampScrollCopyNotes`.

**Refill lines.** `bookRefillText(books)` is shared by both lines:
- The rail line (`LINE_FOR.rationsEaten`) becomes `A new day. <refill> Rations: −N (M left).`, with tone magic when a refill is present. With no refill it is unchanged.
- The Oracle line (`EVENT_NARRATION.rationsEaten`) becomes `<hit>A new day. <refill></hit> <beat>Rations: …</beat> … left.`. With no refill it is unchanged.
- `wentHungry` is unchanged, so "Book stays empty." survives on unfed days.

## ORACLE_ONLY audit

| Entry | Reason (now) | Kept/changed |
|-------|--------------|--------------|
| moved | a plain step is silent by design | kept |
| dayBegan | band 2's Day counter; the rail's DAY card reads it directly (RAIL_DIRECT) | kept, reason made accurate |
| floorChanged | band 2's Depth counter; the rail's FLOOR card reads it directly (RAIL_DIRECT) | kept, reason fixed (the old "depth banner" is now a band-2 counter) |
| spellChargeRecovered | old reason "the grimoire/HUD charge display already shows this" was stale: the HUD has no charge count | **removed**, now a LINE_FOR rail line |
| spGained | pure XP bookkeeping | kept |
| combatEnded | the combat screen closing is the signal | kept |
| died | the dedicated death screen | kept |
| storeLeft | the store screen closing is the signal | kept |
| encounterRolled | internal table-roll bookkeeping | kept |
| findOffered | the Take it/Leave it prompt is the UI | kept |
| hazardChoice | the pre-roll wall/crevice card is the UI (78-01) | kept |
| findTaken | prompt is the UI; the rail's TAKEN card reads it directly (RAIL_DIRECT) | kept, reason made accurate |
| findLeft | prompt is the UI; the rail's LEFT IT card reads it directly (RAIL_DIRECT) | kept, reason made accurate |
| joinerMet, faerieMet, grimoireSold, itemConsumed, allyCast, fightResumed, storeResumed | unchanged, still true | kept |

## New strings (voice record)

- Band 1: `Dwarf Pickpocket · Lvl 3` (the format)
- Rail: `A spell charge wanders back (9/12).`
- Oracle: `Twenty quiet squares, and a spell charge is ready again (9/12). The dungeon keeps no such courtesy for you.` (the count was `— 9 of 12 in reserve`)
- Rail: `A new day. Your book is full again (12/12). Rations: −1 (3 left).`
- Rail/Oracle member form: `Mira's book is full again (6/6).`
- Oracle: `A new day. Your book is full again (12/12). Rations: you eat 1. −1 ration, 3 left.`

## Tests

**New file:** `test/unit/book-refill-lines.test.js` (9 tests, all through the real engine: `newRun` with a forced class, then `applyAction` move at the day edge). It covers:
- stamp purity
- no refill claimed without the flag, or when charges are still spent
- fed 11/12 → (12/12) on the rail and in the Oracle
- unfed → "Book stays empty." and no "full again"
- a spent member with a Fighter hero
- hero then member order
- a full book → no book clause
- the 20-square trickle → (9/12) on the rail
- a same-step wanderer → THE FIGHT SO FAR shows the refill before the wanderer

**Re-pinned and added:**
- `test/unit/hudBands.test.js`: the identityLine cases rewritten to the HUD-01 form, plus fallback cases (sub-class hides the class, missing race, no race/class/sub).
- `test/unit/engineAdapter.test.js`: new dispatch case (events carry `books`, and the html names "(12/12)").
- `test/unit/text-scale.test.js`: `--mw-font-hud-ident` excluded from the "no cap" loop, and the new band-1 cap test added.
- `test/unit/shell-map-hud.test.js` (c): the token regex now expects the 1.1 cap.
- `test/unit/narrationLinesTable.test.js`: no change needed (it never listed spellChargeRecovered).

**DECLARED regeneration:** `test/unit/fixtures/event-order/default-fold-corpus.json`, produced with `MZ_REGEN_EVENT_ORDER_CORPUS=1 node --test test/unit/event-order-fold.test.js`. The diff is +12 lines, all in the hand-built `camp-night` case: its bare `spellChargeRecovered` (no counts, hence `(?/?)`) now produces a line in both the priority and event-order folds. No other line moved.

**Gates:**
- `npm test`: 7,060/7,060 pass.
- Parity: 64/64 pass.
- `git diff --quiet c6de10d -- engine content` exits 0.
- No bot or balance tools were run (user ruling 2026-09-26).
- boot:check not run: this worktree has no node_modules or www/ build, and the orchestrator gates it after the merge.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] stampBookRefill takes an optional 4th argument `maxOf`**
- **Found during:** Task 2
- **Issue:** eventNarration.js never imports from engine/ (its header contract), but the counts need `engine/movement.js#maxCharges`.
- **Fix:** `engineAdapter.js`, which already imports engine/, passes `maxCharges` in. Without it the entries carry no count and the line drops the parenthetical.
- **Commit:** a45819c7

**2. [Orchestrator note] Band-1 font token cap**
- **Found during:** Task 1
- **Issue:** at text size L, the band-1 line truncated early.
- **Fix:** `--mw-font-hud-ident` is capped at 1.1 (only this token line in mazeworld.html changed), and `text-scale.test.js` and `shell-map-hud.test.js` were re-pinned. Neither test is in the plan's file list.
- **Commit:** 105c2597

## Deferred Issues

- **"Lvl N" can still be cut off at M and L.** The line ellipsizes as a single span, so the level (the last part) goes first. Even at M, 27.6% of rolled characters lose it; at capped L, 70.7% do. The real fix is a shell change: split `#mw-hud-line` into a truncating "Race Sub-class" span and a `flex:none` " · Lvl N" span, fed by `identityParts` (for example new `ident`/`lvl` fields beside `line`). That touches markup and paint() in mazeworld.html, which was out of this wave's sanctioned edit area (78-03 owns other regions of the file). Recommended for 78-09 or a quick task.
- A stale comment in mazeworld.html's `.mw-hud` CSS block ("the race/class(sub)/level line") was left untouched for the same reason.

## Known Stubs

None.

## Threat Flags

None. The changes are presentation-only formatting of engine data the shell already had, with no new input surface.

## TDD Gate Compliance

Both tasks followed RED then GREEN: test commits f6749826 and 2c53668b come before feat commits 105c2597 and a45819c7. No refactor commits.

## Self-Check: PASSED

All four commits (f6749826, 105c2597, 2c53668b, a45819c7) are in the branch; test/unit/book-refill-lines.test.js and this SUMMARY exist.
