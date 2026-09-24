---
phase: 68-global-boards-submissions-you-placed-x
plan: 03
subsystem: content + browser view models
status: complete
tags: [leaderboards, placement, copy, voice, play-games]
requires: [content/boards.js (Phase 66 + 67-04)]
provides:
  - content/placement.js (PLACEMENT_LINES, PLACEMENT_CARD, SEASON_DROP_LINES)
  - BOARDS_PANEL_COPY.global and GLOBAL_STANDING_LINES in content/boards.js
  - src/browser/placement.js (ordinalText, placementBand, placementLine, deferredPlacementCard, seasonDropLine)
affects: [68-04..68-07 panel and shell wiring, which consume this copy and view]
tech-stack:
  added: []
  patterns: [hash-picked quip bank (newBest.js pickIndex rule), null-on-incomplete view model, deep-frozen content copy]
key-files:
  created:
    - content/placement.js
    - src/browser/placement.js
    - test/unit/placement-copy.test.js
    - test/unit/placement.test.js
  modified:
    - content/boards.js
    - test/unit/boards-copy.test.js
    - test/voice/safety-scan.test.js
    - test/unit/hp-not-wp.test.js
decisions:
  - "A fifth 'standing' band covers a run that did not beat the player's best: Play Games keeps only the best score, so the rank shown is the best run's and the line says so instead of 'You placed Nth'"
  - "newBest null or missing uses the rank's own band; only an explicit false switches to standing"
  - "ordinalText returns '' for anything but a non-negative integer so the module never throws"
metrics:
  duration: ~25 min
  completed: 2026-09-24
  tasks: 2
  files: 8
---

# Phase 68 Plan 03: Placement copy and rank-quip view model Summary

Every new Phase 68 word now lives in content/, pinned, frozen and scanned: the DEEPEST rank-quip bank (1st / top 10 / top 100 / the rest, plus a standing band for a run that did not beat the best), the deferred rail card, the season-drop Oracle line, and the ALL/FRIENDS panel copy. A pure view model turns a rank into one line or one card, e.g. "You placed 3,117th of 9,044. The 3,116 ahead of you are also dead."

## What shipped

**Task 1: copy (commits d957186 RED, f179ceb GREEN)**
- `content/placement.js`: deep-frozen `PLACEMENT_LINES` (first 3, ten 3, hundred 3, rest 4, standing 3; tokens `{rank}` `{total}` `{ahead}` only), `PLACEMENT_CARD` (title "THE LEDGER CAUGHT UP", tone good, hold 12000, one/many/oneStanding/manyStanding), `SEASON_DROP_LINES` { one, many }. All wording is as the plan specified.
- `content/boards.js`: `BOARDS_PANEL_COPY.global` added right after `note` (scope all/friends, SEASON {n}, loading, unreachable, closed, empty, consent and button, YOU/FRIEND, anon, foe, SQ / FLOOR, noEntry, ofWorld/ofFriends/ofSampled, sampledFoot), plus `GLOBAL_STANDING_LINES` { first, ten, hundred, rest }. No Phase 66/67 key changed.
- Tests: new `test/unit/placement-copy.test.js` (14 tests). `boards-copy.test.js` gains verbatim pins, the key-order check, the token rules and markup/WP/@ guards for the global copy. The safety scan and the HP-not-WP scan now walk `GLOBAL_STANDING_LINES`, `PLACEMENT_LINES`, `PLACEMENT_CARD` and `SEASON_DROP_LINES`. Each scan also has a one-line test showing `BOARDS_PANEL_COPY.global` is covered by the existing walk.

**Task 2: view model (commits cfd1869 RED, 7819085 GREEN)**
- `src/browser/placement.js`: `ordinalText` (teens rule, en-US grouping), `placementBand` (1 / 2-10 / 11-100 / 101+), `placementLine` (null unless rank is an integer of at least 1 and total an integer of at least rank; `newBest === false` uses the standing band), `deferredPlacementCard` (frozen `{ title, line, tone, hold }`, null on a bad count or incomplete rank), `seasonDropLine` (null below 1 or for a non-integer). The pick follows newBest.js's pickIndex rule.
- `test/unit/placement.test.js`: 22 tests, 248 lines. They cover the band boundaries 1/2, 10/11 and 100/101, the D-13 worked example, `{ahead}` filling, the standing band, every null case, the card variants, hash determinism, and a check that no `{token}` is left over.

## Verification

- `node --test test/unit/placement-copy.test.js test/unit/boards-copy.test.js test/voice/safety-scan.test.js test/unit/hp-not-wp.test.js test/determinism/content-is-pure-data.test.js test/unit/stale-terms.test.js`: 64/64 pass (before the Task 2 additions).
- `node --test test/unit/placement.test.js test/unit/placement-copy.test.js`: 36/36 pass.
- `npm test`: 4736 tests, 4729 pass, 7 fail. All 7 are the known pre-existing CRLF doc-ledger failures (class-pass-ledger / flee-ledger). The failing set did not grow.
- Acceptance greps: `export const PLACEMENT_LINES` 1, `export const GLOBAL_STANDING_LINES` 1, `PLACEMENT_LINES` in both scans, `export function placementLine` 1, `export function deferredPlacementCard` 1.
- No engine/ edits and no parity-fixture edits. No Android build.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Robustness] ordinalText guards non-integer input**
- **Found during:** Task 2
- **Issue:** The plan asks for a module that never throws. `ordinalText(undefined)` would throw from `toLocaleString`.
- **Fix:** `ordinalText` returns "" for anything but a non-negative integer. A test pins this.
- **Files modified:** src/browser/placement.js, test/unit/placement.test.js
- **Commit:** 7819085

Everything else was executed exactly as written.

## Known Stubs

None. The copy and view model are complete. The panel and shell wiring that consume them belong to later Phase 68 plans.

## Human verification (deferred to end of run)

For the Phase 69 batch (docs/UAT-v2.0.md). Do not pause for these:
- On the Pixel 7, read the DEEPEST rank quip on THAT IS THAT at the default text size and at the largest text size. Check for no clipping or overflow, and that the voice reads right (deadpan, family-friendly, the joke on the player's own adventurer).
- On the Pixel 7, read the deferred "THE LEDGER CAUGHT UP" rail card (one-run and many-run variants) at the default and largest text sizes. Check for no clipping, and that the card holds about 12 s.
- Read the standing-band line after a run that did not beat the player's best. Check that it does not claim the run placed.
- Read the season-drop Oracle line, and the ALL/FRIENDS panel notes (loading, unreachable, consent, sampled LINEAGE footnote), for voice.

## Self-Check: PASSED

- FOUND: content/placement.js, src/browser/placement.js, test/unit/placement-copy.test.js, test/unit/placement.test.js
- FOUND commits: d957186, f179ceb, cfd1869, 7819085
