---
phase: 70-device-round-polish
plan: 02
subsystem: leaderboards
status: complete
tags: [vanilla-js, presentation-only, records, leaderboards, lineage, milestone-v2.0]
requirements: [POLISH-04]
requires:
  - engine/records.js bests record (Phase 65/66)
  - src/browser/globalBoards.js cached combo snapshot (68-05, not edited)
provides:
  - lineageKey = race + sub; lineageRuns (the single per-lineage order)
  - prune keeps every lineage's top ten in ddr.bests.v1
  - LINEAGE_RACES / LINEAGE_SUBS / resolveLineage and view.picker
  - the .mw-bd-lineage RACE / SUB-CLASS picker and the hero seam
affects:
  - engine/records.js consumers (engineAdapter, boardScores, pgsQueue, death.js) — signatures unchanged
  - NEW PERSONAL BEST LINEAGE line (newBest.js)
tech-stack:
  added: []
  patterns:
    - "the view and prune rank a lineage with the same lineageRuns order"
    - "picker rows found by a dataset.kind children walk, reused so a row keeps its scroll"
key-files:
  created: []
  modified:
    - engine/records.js
    - src/browser/boardsView.js
    - src/browser/boardsPanel.js
    - src/browser/newBest.js
    - content/boards.js
    - mazeworld.html
    - test/unit/records.test.js
    - test/unit/bests-adapter.test.js
    - test/unit/boardsView.test.js
    - test/unit/boards-copy.test.js
    - test/unit/newBest.test.js
    - test/unit/boardsPanel.test.js
    - test/unit/boardsPanel-dom.test.js
    - test/unit/boards-css.test.js
    - test/unit/shell-boards-panel.test.js
decisions:
  - "Lineage = race + sub-class (D-10); lineageKey never throws (canon/field reads)"
  - "prune keeps each lineage's top BOARD_TOP_N by lineageRuns; the Phase 65 lineage map is dropped on load, no version bump (D-12)"
  - "LINEAGE new-best = strict beat of the best held run of the same race + sub (65 D-14 kept)"
  - "Global LINEAGE filters the cached 25-entry DEEPEST sample; a snap.you of this lineage with no you-marked sample entry is pinned unranked (D-13)"
  - "centreIn walks children through Array.from, so the rail and picker centring also work on a real HTMLCollection"
metrics:
  duration: "~45 min"
  completed: 2026-09-24
  tasks: 3
  files: 15
---

# Phase 70 Plan 02: LINEAGE race + sub-class selector and per-lineage top ten Summary

LINEAGE now shows one lineage at a time. RACE and SUB-CLASS chip rows (44px chips that scroll sideways) sit above the list. By default they select the living hero's race + sub-class, falling back to the most recent run's lineage and then Human + Wizard. Locally the list is that lineage's ten deepest runs, and `ddr.bests.v1` prune now keeps those ten for every lineage. Signed in, the list is the cached 25-entry DEEPEST sample filtered to the lineage, with a footnote saying so.

## What shipped

**Task 1: records (engine/records.js).**
- `lineageKey` is `"{race} {sub}"`, and a null or partial run never throws.
- New export `lineageRuns(runs, key)` filters to one lineage and orders by `compareRuns("combo")`, then by run hash ascending. prune and the view share this one comparator.
- prune keeps every ranked-board hash plus each lineage's top 10.
- The Phase 65 `lineage {count, best}` map is gone from `emptyBests` and `sanitizeBests`. A legacy record still loads (its map is ignored) and stays at `v: 1`.
- `updateBests` announces `combo` only when the run strictly beats the previously held best of the same race + sub.

**Task 2: view model and copy (boardsView.js, content/boards.js, newBest.js).**
- New exports `LINEAGE_RACES` (6) and `LINEAGE_SUBS` (24), both in content order.
- `resolveLineage` picks the lineage in this order:
  1. the picker selection, checked race and sub separately;
  2. the hero;
  3. the most recent run (the `recentHash` run, then the newest grave, then `bests.last`);
  4. Human + Wizard.
- `view.picker` appears on LINEAGE only.
- Local LINEAGE:
  - builds its rows with the Phase 66 row builder (`buildRunRows`, split out of `buildRankedRows`) over graves ∪ bests, deduped;
  - an empty lineage shows the in-voice note naming it;
  - the standing card places the lineage's most recent run among its runs.
- Global LINEAGE:
  - keeps sample order, ranks rows 1..n and cuts at ten;
  - pins the player's YOUR BEST RUN row under the divider when it isn't shown;
  - its standing card covers three cases: no entry, the player's entry is another lineage, or a placed/dash card;
  - its footnote reads "Filtered from the top n deepest…".
- Copy was re-voiced per the plan. NEW PERSONAL BEST now reads "Race Sub · floor n".

**Task 3: panel and shell (boardsPanel.js, mazeworld.html).**
- The skeleton now has a seventh section, `.mw-bd-lineage`, placed between the board head and the body.
- Picker rows and their chip containers are reused across renders, and only the chips are rebuilt.
- New `onLineage(kind, id)` handler. The selection is null on every open, is taken from each rendered `view.picker`, and is included in `state()`.
- New `hero()` seam. It is not asked in title mode without a resumable hero, and a throwing or malformed answer is treated as null.
- On reset renders, the picker rows centre on their on chip, sharing the rail's centring code (`centreIn`).
- The `global()` request shape is unchanged.
- mazeworld.html has two hunks: the one-line `hero:` seam in the `createBoardsPanel` options block, and the `.mw-bd-lineage` / `.mw-bd-pick*` CSS after `.mw-bd-chip`.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 (RED) | c48089c | test(70-02): add failing records tests for race + sub-class lineage and per-lineage prune |
| 1 (GREEN) | 028f845 | feat(70-02): lineage is race + sub-class; prune keeps every lineage's top ten |
| 2 | 3a6a1e1 | feat(70-02): per-lineage LINEAGE view — race + sub-class picker model, default chain, filtered global sample |
| 3 | 7db887d | feat(70-02): LINEAGE RACE / SUB-CLASS chip rows in the panel, the hero seam and the picker CSS |

## Verification

- Each task's `node --test` set passes. The Task 3 set (boardsPanel, boardsPanel-dom, boards-css, shell-boards-panel, shell-pgs, title-music-shell) ran 164/164.
- `test/voice/safety-scan.test.js` and `test/unit/hp-not-wp.test.js` pass over the new strings without edits. They pin only kept keys (`global.scope.all`, `global.sampledFoot`).
- `npm test`: 5144 tests, 5137 pass, 7 fail. The 7 are exactly the known worktree CRLF doc-ledger failures (class-pass-ledger / flee-ledger).
- In `engine/`, only `engine/records.js` changed. `engine/death.js`, `test/parity/` and `prototype-master.js.txt` are untouched, and no fixtures moved.
- The `mazeworld.html` diff is two hunks: the CSS block (line ~1180) and the `createBoardsPanel` options block (line ~5827).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] centreRail walked `railEl.children.find(...)`**
- **Found during:** Task 3
- **Issue:** A real DOM `HTMLCollection` has no `.find`. Only the recording DOM's array children have one.
- **Fix:** The shared `centreIn` / `centrePicker` helpers walk children through `Array.from` (`childList`), so rail and picker centring work in the WebView too.
- **Files modified:** src/browser/boardsPanel.js
- **Commit:** 7db887d

**2. [Test scope] The G2 shell BEHAVIOUR case evaluates the extracted `hero:` seam instead of driving it through the sandbox**
- **Found during:** Task 3
- **Issue:** `test/unit/harness/shellSandbox.js` builds its own `createBoardsPanel` without a hero seam and leaves `S` null. The sandbox therefore cannot exercise the shipped seam, and the harness is outside this plan's files.
- **Fix:**
  - G2 extracts the shipped `hero:` line from the options block and evaluates it over fake windows: a live hero, a dead hero, `S` null, a heroless `S`, and no `__mzState`.
  - G3 drives the real DEAD tab in the sandbox: the picker appears, the newest grave's lineage is on, a chip tap re-lists the board, and an unplayed lineage shows the empty note.
- **Files modified:** test/unit/shell-boards-panel.test.js

**3. [Test fixture] The global LINEAGE test's `snap.you` has no you-marked sample entry**
- **Found during:** Task 2
- **Issue:** Under D-13 that entry is pinned unranked when the lineage matches.
- **Fix:** The test asserts the pin (rank "", divider). The standing card for this case is the dash with "of n of this lineage in the sample."

TDD note: the Task 1 RED commit preceded GREEN. For Tasks 2 and 3, the implementation and test rewrites were written in the same pass and committed together (one `feat` commit each). Every behaviour-list case is covered by a passing test.

## Known Stubs

None.

## Human verification (deferred to end of run)

These are Pixel 7 checks for docs/UAT-v2.0.md (plan 70-04 folds them in). They are not blocking checkpoints:

1. The RACE and SUB-CLASS picker rows fit and scroll sideways at text size S, M and L on the 411px Pixel 7. Every chip is easy to tap, and the on chip is lavender.
2. The default selection:
   - with a live hero: that hero's race + sub-class;
   - after death: the dead run's lineage;
   - from the title with a resumable hero: that hero;
   - from the title with no resumable hero: the most recent run's lineage, or Human + Wizard on a fresh install.
3. A chip tap re-lists the board. The selection survives switching boards and scopes, and resets on reopening the panel.
4. An unplayed lineage shows "No {Race Sub} of yours has died yet. The dungeon is patient." and a NO ENTRY card.
5. Signed in:
   - ALL and FRIENDS list only that lineage from the top 25 deepest, ranked 1..n;
   - your own entry is pinned under NOT IN THE TOP TEN · YOUR BEST RUN when it isn't shown;
   - the footnote reads "Filtered from the top 25 deepest corpses in the world…".
6. A deeper death of an existing race + sub-class announces LINEAGE on NEW PERSONAL BEST as "Race Sub · floor n". The first death of a new lineage does not.

## Self-Check: PASSED

- FOUND: engine/records.js, src/browser/boardsView.js, src/browser/boardsPanel.js, content/boards.js, src/browser/newBest.js, mazeworld.html
- FOUND commits: c48089c, 028f845, 3a6a1e1, 7db887d
