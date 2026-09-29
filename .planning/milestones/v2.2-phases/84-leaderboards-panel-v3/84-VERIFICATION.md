---
phase: 84-leaderboards-panel-v3
status: passed
verified: 2026-09-29
verifier: orchestrator (verification agents off per project config; deferred-UAT protocol)
score: 5/5
human_verification:
  - "DEAD tab with Compete ON opens LEADERBOARD (\"Everyone's dead. Top ten shown.\", SEASON OF THE ALPHA under the title); Compete OFF opens YOUR DEAD with a static INTERRED count (84-08)"
  - "YOURS › switches to YOUR DEAD (your run count); EVERYONE › and ◀ return to the board, EVERYONE › shows the board total (84-08)"
  - "RANK BY / RACE / SUB-CLASS sheets: CSS ▼ carets and ◆ marks; SUB-CLASS (25 rows) scrolls; YOUR DEAD shows counts and dims zero options (still tappable); LEADERBOARD shows none (84-08)"
  - "Rows: rank, initials avatar (LJ for @lanternjaw), handle or hero name, YOU tag, the name · race sub-class · level line, value + unit; leading row in the stat colour; tap opens killer name, epitaph, six chips and the \"Died 28 Sep 2026 · 2.1.0 (11)\" line; tap again closes (84-08)"
  - "Best run outside the top ten pinned under NOT IN THE TOP TEN · YOUR BEST with its real rank; standing card reads \"{handle}'s best, of N interred as …\" or \"None of yours on this board yet.\" (84-08)"
  - "A filter with no runs shows NOBODY YET + CLEAR FILTERS (the stat stays) (84-08)"
  - "Airplane mode: first LEADERBOARD open shows the unreachable note + SEE YOUR DEAD; after a successful look, offline shows cached rows + the stale line; YOUR DEAD opens instantly offline (84-08)"
  - "Title: no history + Compete OFF hides VIEW THE DEAD; Compete ON shows it; footer BACK TO TITLE / ROLL A NEW HERO or BACK TO THE DUNGEON; Android back mirrors ◀ (84-08)"
  - "A dead hero's DEAD tab still docks FINAL SHEET and BURY THEM (84-08)"
  - "RANK BY survives closing and reopening the panel; RACE and SUB-CLASS reset (84-08)"
  - "First 2.2 launch over a 2.1.0 install: YOUR DEAD holds only runs from 2026-09-28 19:41 UTC on, each reading \"2.1.0 (11)\"; a new death shows the installed version (84-03)"
  - "First death on 2.2 with an empty history shows the first-death line; a deeper later death shows NEW PERSONAL BEST with its board rows (84-03, 84-09)"
  - "☰ face and title chip avatars look unchanged after the helper move (84-09)"
---

# Phase 84: Leaderboards Panel v3 — Verification

**Goal:** The DEAD tab and VIEW THE DEAD show the v3 mock — everyone's dead or just yours, ranked by DEPTH/DAYS/KILLS/WILMST with RACE and SUB-CLASS filters.

## Success criteria

| # | Criterion | Evidence | Status |
|---|-----------|----------|--------|
| 1 | One panel to the v3 mock from the DEAD tab and VIEW THE DEAD; LEADERBOARD with Compete ON, YOUR DEAD with Compete OFF; back/footer routing as the mock | `createLeaderboardPanel` (84-07, the old seven-method seam) wired in `mazeworld.html` (84-08); Compete read from `currentSettings.compete`; routing/footer tests in shell-boards-entry / shell-boards-panel | ✓ |
| 2 | Header box switches views (YOURS › / EVERYONE › / static INTERRED); RANK BY / RACE / SUB-CLASS sheets re-rank; the old rail is gone | `leaderboardView` (84-05) box + sheets (local counts + dimming on YOUR DEAD only, per the amended BOARD-20); old `boardsView`/`boardsPanel`/`.mw-bd-*` deleted (84-09) | ✓ |
| 3 | Rows (rank, avatar, handle/name, YOU, line, value+unit); tap expands cause, epitaph, six chips; tap closes | 84-05 view + 84-06 text-only renderer (hostile-handle test); killer `note` and `when` added to the run doc and live transition rules (84-01); handle initials one per word | ✓ |
| 4 | Best run outside the top ten pinned under NOT IN THE TOP TEN with real rank; NOBODY YET + CLEAR FILTERS | `boardFeed` your-best via `ownRuns` + `rankOf` (84-04); pinned row + standing card (84-05); empty state (84-05/06) | ✓ |
| 5 | In-voice loading / offline / stale states; YOUR DEAD never waits on the network and ranks the local history (2.1.0-cutoff import) | `LEADERBOARD_COPY` states (84-02); feed stale/unreachable (84-04); controller cached-first + load token (84-07); `runHistory.js` / `ddr.runs.v1` cap 500, one-time import with the cutoff, "2.1.0 (11)" label, NEW PERSONAL BEST against the history (84-03); VIEW THE DEAD gate = history or Compete (84-08) | ✓ |

## Requirements

BOARD-18 ✓ · BOARD-19 ✓ · BOARD-20 ✓ (amended: counts on YOUR DEAD only) · BOARD-21 ✓ · BOARD-22 ✓ · BOARD-23 ✓ · BOARD-24 ✓ · BOARD-25 ✓ · BOARD-26 ✓ · BOARD-27 ✓ (SEASON_NAMES: "Season of the Alpha")

## Live changes

- 84-01 redeployed the **transition** rules with the `note`/`when` run-doc fields (one-day clock-skew allowance); live smoke 17/17 PASS twice. `firebase.json` (final rules) untouched — release step.

## Automated checks

- `npm test` at 84-09 close: 8327 pass, 0 fail, 2 skipped (pre-existing); ~187 old-panel tests deleted with the old panel.
- Engine gate: `engine/`, `test/parity/` untouched across all nine plans.

## Notes

- Executors twice rewrote their own final docs commit to add trailers (84-04 amend, 84-05 soft reset); no other commit depended on them and trees were identical. The orchestrator now waits for each hand-back before the next dispatch and requires plain `git commit` with trailers.
