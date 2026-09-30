---
phase: 87-player-report-fixes-joiner-hp-store-rations-depth-ties
plan: 05
subsystem: boards
tags: [leaderboards, firestore-rules, transition, deepKey, BOARD-28]
requires:
  - phase: 87-04
    provides: "local compareRuns deep: floor desc, then steps desc"
provides:
  - "deepKeyOf = floor * 1e6 + steps in the client and the final rules"
  - "legacyDeepKeyOf (2.2.0 formula, transition tooling only)"
  - "firebase/firestore.transition.rules + firebase.transition.json + proof test"
affects: [87-06, 87-07, 87-08]
tech-stack:
  added: []
  patterns: ["one-clause transition rules proven by header-stripped byte equality (v2.2 pattern, recreated)"]
key-files:
  created:
    - firebase/firestore.transition.rules
    - firebase.transition.json
    - test/unit/firestore-transition-rules.test.js
  modified:
    - src/browser/runDoc.js
    - firebase/firestore.rules
    - docs/LEADERBOARDS.md
    - test/unit/runDoc.test.js
    - test/unit/firestore-rules.test.js
    - test/unit/leaderboardView.test.js
    - test/unit/boardFeed.test.js
    - test/unit/compliance-docs.test.js
key-decisions:
  - "deepKey = floor * 1,000,000 + steps; steps <= STEPS_MAX 999,999 so a floor always dominates; index file untouched (same field, same direction)"
  - "Transition rules accept exactly the old or the new formula computed from the doc's own floor and steps, nothing else"
requirements-completed: []
duration: ~30 min
completed: 2026-09-29
status: complete
---

# Phase 87 Plan 05: DEPTH key most-steps formula and transition rules (BOARD-28, server contract) Summary

**The 2.3 client and the final Firestore rules rank DEPTH ties by the most steps (`deepKey = floor * 1,000,000 + steps`), and a one-clause transition rules file accepts either that or the shipped 2.2.0 (vc12) formula and refuses any other value. Nothing was deployed.**

BOARD-28 stays Pending in REQUIREMENTS.md by instruction; it closes with 87-08.

## What changed

- `src/browser/runDoc.js`: `deepKeyOf` returns `floor * 1000000 + steps` (JSDoc and module header updated). New export `legacyDeepKeyOf` returns the 2.2.0 formula `floor * 1000000 + (999999 - steps)`, documented as transition-only and never written by the client. `validateRunDoc` was untouched (its deepkey clause now mirrors the new final rules). All consumers (`rankKeys`, `rankKeyOf`, `buildRunDoc`, boardSync, boardFeed, runHistory, leaderboardView) follow automatically.
- `firebase/firestore.rules`: only `deepKeyOf(d)`'s return and its comment changed. The `isValidBoardRun` deepKey line is byte-identical. `firebase/firestore.indexes.json` and `engine/` untouched.
- `firebase/firestore.transition.rules` (new): final rules plus a TRANSITION HEADER block and the single clause `d.deepKey is int && (d.deepKey == deepKeyOf(d) || d.deepKey == d.floor * 1000000 + (999999 - d.steps))`.
- `firebase.transition.json` (new): points at the transition rules and the same indexes file as `firebase.json`.
- `test/unit/firestore-transition-rules.test.js` (new, 5 tests): header-stripped equality with exactly one clause swapped; header content; the clause evaluated in JS accepts both formulas and refuses 0, +/-1 of each formula and `floor*1e6 - 1` over floors [1,2,5,13,200] x steps [0,1,250,499999,500000,999998,999999]; a vc12-shaped doc (legacy deepKey) fails `validateRunDoc` with exactly `["deepkey"]`, passes the transition clause and differs from the 2.3 doc only in `deepKey`; config check.
- `docs/LEADERBOARDS.md`: section 3 formula text, and section 6 subsection "Until the 2.3 cutover: the DEPTH-key transition config" with the transition deploy command (the 2.2 history subsection is kept, its last sentence no longer claims the plain command is the only one).
- `test/unit/compliance-docs.test.js`: section-6 test renamed and flipped: keeps the 2.2 history match, matches the new subsection heading, asserts the three transition files exist (comment says Release 2.3.0 deletes them and flips it back).

## Orchestrator carry-over (done)

The "2,000 random in-bound pairs" test in `test/unit/runDoc.test.js` compares the deep key against `compareRuns("deep", a, b)` again. The inline legacy comparator and its comment were removed. The server key and the local order agree, verified over 2,000 random pairs.

## vc12 compatibility (checked against tag v2.2.0 before the transition clause)

- (a) `git show v2.2.0:src/browser/runDoc.js`: `deepKeyOf` returns `floor * 1000000 + (999999 - steps)`, identical to `legacyDeepKeyOf`.
- (b) `RUN_CLIENT_FIELDS` is identical to today's.
- (c) `daysKeyOf`, `killsKeyOf`, `goldKeyOf` are identical to today's.

A vc12 doc therefore differs from a 2.3 doc only in `deepKey`, so the one-clause transition keeps every vc12 submission valid.

## Moved pins (declared; formula: "deepKey formula, Phase 87 BOARD-28")

| Pin | Before | After |
|-----|--------|-------|
| `test/unit/runDoc.test.js` 2,000 random pairs deep line | inline legacy comparator (floor desc, steps asc), interim from 87-04 | `compareRuns("deep", a, b)` |
| `test/unit/leaderboardView.test.js` YOUR DEAD DEPTH | title "fewer steps"; order B(6/50), A(6/100), C | title "more steps; Phase 87 BOARD-28"; order A(6/100), B(6/50), C |
| `test/unit/boardFeed.test.js` load({stat}) you.run.steps | 100 (the owned run with the largest deepKey) | 300 (same floor, more steps now ranks higher) |
| `test/unit/compliance-docs.test.js` section-6 test | transition files must NOT exist | transition files must exist until the 2.3 cutover |

New pins: deepKeyOf values and floor dominance; legacyDeepKeyOf value and never-equal property; legacy doc fails exactly `["deepkey"]`; rules-function tie-order assertion on the grid test; the five transition tests above. No parity fixture moved; `test/parity/prototype-master.js.txt` untouched.

## Test results

Full `npm test`: 8131 tests, 8129 pass, 0 fail, 2 skipped (baseline 8121 pass; +8 new). No bot balance runs.

## Nothing deployed

No `firebase deploy` was run, no live Firestore was read or written, no live smoke. The first transition deploy is the user's go at 87-08.

## Deviations from Plan

**1. [Rule 1 - Moved pin] boardFeed.test.js expectation**
- **Found during:** Task 1 board-suite run (the plan's list omitted nothing; this pin was a legitimate consequence of the new formula).
- **Fix:** expected `you.run.steps` 100 -> 300 with a comment. Commit e2f73f57.

Otherwise the plan executed as written.

## Known Stubs

None.

## Commits

- e2f73f57: feat(87-05): DEPTH key ranks same-floor ties by the most steps (BOARD-28)
- d80f2392: feat(87-05): transition rules accept the old or new DEPTH key (BOARD-28)

All commits carry the required trailers.

## Human verification (deferred to end of run)

Needs the transition rules live (87-08).

- [ ] On the 2.3 debug build, die twice on the same floor with different step counts; the ALL scope DEPTH board lists the run with more squares walked above the other.
- [ ] "You placed #N" after a death matches the run's position on the ALL DEPTH board.

## Self-Check: PASSED

Created files exist (firebase/firestore.transition.rules, firebase.transition.json, test/unit/firestore-transition-rules.test.js); commits e2f73f57 and d80f2392 are in git log; `git diff --stat` over engine/ and firebase/firestore.indexes.json is empty.
