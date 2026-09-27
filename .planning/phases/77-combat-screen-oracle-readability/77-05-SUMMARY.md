---
phase: 77-combat-screen-oracle-readability
plan: 05
subsystem: ui
status: complete
tags: [combat, oracle, fight-log, rail, narration, scrolls, CMBUI-11]
requires:
  - 77-02 (event-order fold and its contiguity rule)
provides:
  - "narrationLines.js#scrollCopyChain: a scroll's cast and its copy note as one line, in both orders"
  - "eventNarration.js#stampScrollCopyNotes: the Oracle's presentation stamp"
  - "engineAdapter.js#dispatch applies the stamp after decorateMisses"
  - "test/unit/scroll-cast-copy-note.test.js"
affects:
  - src/browser/narrationLines.js
  - src/browser/eventNarration.js
  - src/browser/engineAdapter.js
  - src/browser/rail.js
tech-stack:
  added: []
  patterns:
    - "A presentation-only stamp in dispatch (after decorateMisses), so every consumer of the returned events reads the same reading"
    - "An adjacency-keyed two-event chain that merges the same way in the priority and the event order"
key-files:
  created:
    - test/unit/scroll-cast-copy-note.test.js
  modified:
    - src/browser/narrationLines.js
    - src/browser/eventNarration.js
    - src/browser/engineAdapter.js
    - src/browser/rail.js
    - test/unit/narrationLinesTable.test.js
    - test/unit/rail.test.js
    - test/unit/engineAdapter.test.js
decisions:
  - "CMBUI-11: a scroll that cast is never narrated as a refusal. The copy limit is said once, after the cast, as 'too advanced to copy into your book'"
  - "Presentation only. The engine still pushes scrollTooAdvanced before scrollCast. The Oracle gets the reading from stampScrollCopyNotes, and the fold from scrollCopyChain"
  - "The chain is keyed on adjacency in both orders: the next line event must be a scrollCast of the same spell. The stamp uses strict i+1 adjacency, which the engine always produces"
  - "The rail family for scrollTooAdvanced is now NOT FOR THE BOOK, tone odd (was TOO ADVANCED, tone dull)"
metrics:
  duration: "~40 min"
  completed: 2026-09-26
  tasks: 2
  files: 8
---

# Phase 77 Plan 05: Scroll cast, then the copy note (CMBUI-11) Summary

When a scroll's spell is too advanced to copy into a Magic User's grimoire, every surface now says the cast first and then the copy note. Before, the Oracle, the fight log and the rail all opened on "Fireball needs level 3; you are 1." for a scroll that had just cast. That was the user's 2026-09-21 device report: "I got a message saying it was a level 3 spell so I couldn't use it, but it actually successfully used the scroll." The engine is byte-identical.

**Plan base:** `2a5bf9569b560303c452fecee0d9d6d54e2d35f4`

## What changed

- **src/browser/narrationLines.js**
  - New `scrollCopyChain(events, consumed)`. It runs in both orders, right after `chestChain`. A `scrollTooAdvanced` whose next line event (`nextLineIdx`) is a `scrollCast` of the same spell becomes one line: `${LINE_FOR.scrollCast(cast).text} Too advanced to copy into your book.` The line has tone magic and priority `PRIORITY.you`, and sits at the scrollTooAdvanced's idx (its earliest event, per 77-02's contiguity rule).
  - `LINE_FOR.scrollTooAdvanced` is reworded as the standalone plain note, tone magic (was tone miss).
- **src/browser/eventNarration.js**
  - New export `stampScrollCopyNotes(events)`, a pure function modelled on `decorateMisses`. It returns a new array. A scrollTooAdvanced directly followed by its scrollCast becomes `{ ...e, castFollows: true }`, and that cast becomes `{ ...cast, tooAdvanced: { need, have } }`. Every other element keeps its identity, the input is never mutated, and non-array input gives `[]`.
  - `EVENT_NARRATION.scrollTooAdvanced` returns `""` when `castFollows` is set, so formatEvent drops it. Otherwise it returns the plain note.
  - `EVENT_NARRATION.scrollCast` adds the note after the cast when `tooAdvanced` is set.
- **src/browser/engineAdapter.js#dispatch**: calls `stampScrollCopyNotes(decorated)` right after `decorateMisses`. It returns the stamped events and formats `html` from them. The JSDoc names CMBUI-11.
- **src/browser/rail.js**: `RAIL_FAMILY.scrollTooAdvanced` changed from `{ "▪", "TOO ADVANCED", dull }` to `{ "▪", "NOT FOR THE BOOK", odd }`, with a CMBUI-11 comment.

## New lines, verbatim (for the Phase 79 narrative pass)

| Surface | Case | Text |
|---|---|---|
| Fold (fight log, round strip, beats, rail) | chained | `The scroll casts: {spell}. Too advanced to copy into your book.` |
| Fold | standalone `LINE_FOR.scrollTooAdvanced` | `{spell}: too advanced to copy into your book.` (a bare call reads `It: ...`) |
| Oracle | `scrollCast` stamped `tooAdvanced` | `The scroll casts itself: {spell}. <span class="beat">Too advanced to copy into your book. The scroll crumbles, having made its point.</span>` |
| Oracle | `scrollTooAdvanced` stamped `castFollows` | `""` (dropped) |
| Oracle | standalone `scrollTooAdvanced` | `<span class="beat">{spell}: too advanced to copy into your book.</span>` |
| Rail family | `scrollTooAdvanced` | icon `▪`, title `NOT FOR THE BOOK`, tone `odd` (was `TOO ADVANCED`, `dull`) |

These are unchanged: `scrollCast` without the stamp (`The scroll casts itself: {spell}.` / `The scroll casts: {spell}.`), and all of Phase 75.1's lines (`scrollRead`, `scrollDeciphered`, `scrollGarbled`, `scrollFumbled`, the fumble effects).

## Coherence matrix (reader path x surface)

Each cell is driven through the real engine (`applyAction`, seeds searched, rng never mocked). The Oracle column goes through the real `engineAdapter.boot` + `dispatch`. "No refusal" means none of the pinned phrases appear: "needs level", "you are ", "stays rolled", "cannot read", "refuse".

| Reader path | Oracle tab | Fight log (event order) + roll reveal | Rail fold (priority) |
|---|---|---|---|
| Magic User, too advanced | unroll, then ONE cast line ending in the note; no refusal | unroll, then ONE cast-then-note row; no refusal | ONE cast-then-note line; the out-of-combat card heads on a non-refusal family |
| Runes/Signs Fighter | the cast; no refusal | the cast; no refusal | the cast; no refusal |
| Intel reader, read (scrollDeciphered then scrollCast) | the cast; no refusal | the cast; no refusal | the cast; no refusal |
| Intel reader, garbled | 75.1's line; events and html identical to the unstamped engine output | 75.1's line | 75.1's line |
| Intel reader, fumbled | 75.1's lines; events and html identical to the unstamped engine output | 75.1's lines | 75.1's lines |

## Tests

- **test/unit/scroll-cast-copy-note.test.js** (new, 21 tests):
  - the engine's adjacency premise;
  - the fold in both orders on a real Wizard read (one cast-then-note line, tone magic, priority you, idx at the note, cast said once, spell lines after);
  - the fight log;
  - a separated note stays in place;
  - a different spell never merges;
  - a silent event between the pair does not split it;
  - the bare and full LINE_FOR note;
  - the rail family and an out-of-combat rail card;
  - the stamp's unit contract (identity, no mutation, non-array input);
  - the EVENT_NARRATION wording;
  - dispatch through boot;
  - the coherence matrix above.
- **test/unit/narrationLinesTable.test.js**: a locked-wording pin for scrollTooAdvanced (full payload and bare call) and scrollCast.
- **test/unit/rail.test.js**: the family pin, plus a standalone NOT FOR THE BOOK card.
- **test/unit/engineAdapter.test.js**: dispatch stamps the pair, and its html shows the cast and then the note, never "needs level".

## Deviations from Plan

None. The plan was executed as written.

- No fixture moved. `test/unit/fixtures/event-order/default-fold-corpus.json` contains no scrollTooAdvanced events, so it was not regenerated (event-order-fold.test.js is green), and no shell snapshot changed.
- The existing engine pins in cast-refusals.test.js and spell-utility.test.js needed no change.
- test/parity/FIXTURE-INVENTORY.md was not touched.

## Merge notes for the parallel wave

- The narrationLines.js and eventNarration.js edits touch only the scrollTooAdvanced and scrollCast entries, plus two new functions: `scrollCopyChain` before `ENCOUNTER_FOLLOWERS`, and `stampScrollCopyNotes` before `narrateEvent`'s JSDoc.
- linesForAction gains one call line after `chestChain`.
- No neighbouring entry was reformatted or reordered.

## Known Stubs

None.

## TDD Gate Compliance

- Task 1: RED `85712bf8` test(77-05), then GREEN `f8f89089` feat(77-05).
- Task 2: RED `d94fb03c` test(77-05), then GREEN `35362ab3` feat(77-05).

## Verification

- `node --test test/unit/scroll-cast-copy-note.test.js test/unit/narrationLinesTable.test.js test/unit/narrationLinesCoverage.test.js test/unit/rail.test.js test/unit/event-order-fold.test.js`: 97/97 at Task 1.
- `node --test test/unit/scroll-cast-copy-note.test.js test/unit/engineAdapter.test.js test/unit/formatEventsCoverage.test.js test/voice/safety-scan.test.js`: 73/73.
- `npm test`: 6905/6905, 0 failures. Parity: 64/64.
- `git diff --quiet 2a5bf95 -- engine/ prototype-master.js.txt` exits 0.
- `grep -c "export function stampScrollCopyNotes" src/browser/eventNarration.js` returns 1. `grep -c "stampScrollCopyNotes(" src/browser/engineAdapter.js` returns 1. `grep -c CMBUI-11 src/browser/narrationLines.js` returns 4.
- No bot runs and no readout files, per the 2026-09-26 ruling.

## Self-Check: PASSED

- FOUND: test/unit/scroll-cast-copy-note.test.js
- FOUND: commits 85712bf8, f8f89089, d94fb03c, 35362ab3
