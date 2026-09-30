---
created: 2026-09-30T01:55:00.000Z
title: Leaderboard RANK BY sheet runs off the bottom of the screen
area: ui
milestone: v2.3
resolves_phase: 87
files:
  - mazeworld.html:1482-1497
  - src/browser/leaderboardView.js:492
  - src/browser/leaderboardPanel.js
---

## Problem

(User, 2026-09-29, on device, for milestone v2.3.) "the Rank By rail goes slightly off the bottom of the screen with the wilmst descriptive text."

The RANK BY bottom sheet (the four stat options from `statSheetOptions(stat)`, `leaderboardView.js:492`, each with its rule as a sub-line) doesn't fit on screen. The last option, WILMST, has its descriptive sub-line cut off below the bottom edge.

The CSS (`mazeworld.html` ~L1482-1497): `.mw-lb-sheet` is `position:absolute; inset:0`, and `.mw-lb-sheet-panel` has `max-height:78%` with a scrolling `.mw-lb-sheet-opts` (`flex:1; min-height:0; overflow-y:auto; padding:0 0 26px`). Nothing in it accounts for the bottom system inset. The app runs edge-to-edge since Phase 80 (SystemBars), so the gesture/navigation bar likely covers the last row. Alternatively the options list isn't actually scrolling because the panel's height is content-driven.

## Solution

TBD at planning. Likely fix:
- Pad the sheet panel (or its option list) bottom by `env(safe-area-inset-bottom)` or the app's existing bottom-inset variable (check how other bottom sheets and the rail handle the inset since Phase 80), so the last option's sub-line clears the navigation bar.
- Check the RACE and SUB-CLASS sheets and every other `.mw-lb-sheet` user the same way, and the Phase 87 long-press filter menu (todo 2026-09-29-leaderboard-race-sub-in-detail-and-long-press-filter-menu) if it reuses the sheet.
- Verify at the smallest supported width/height and with the largest text scale (`--mw-text-scale`): the last option is fully visible or reachable by scrolling. Pin with a CSS/source assertion test. The device check goes in the v2.3 batched UAT.
- Shell-only (CSS). No engine or server changes.
</content>

## Resolution (Phase 87, 2026-09-30)
Closed by v2.3 Phase 87 (BOARD-30, plan 87-10): `.mw-lb-sheet-opts` pads its bottom by the system inset on the title-opened panel (the in-game path is already padded by the tab bar), so WILMST and its rule line clear the navigation bar and the list still scrolls. Device checks are in 87-VERIFICATION.md.
