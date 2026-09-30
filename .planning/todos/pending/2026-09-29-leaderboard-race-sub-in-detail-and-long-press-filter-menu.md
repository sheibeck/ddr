---
created: 2026-09-30T01:45:03.876Z
title: Leaderboard: race/sub-class in the row detail, long-press to filter by them
area: ui
milestone: v2.3
files:
  - src/browser/leaderboardPanel.js:227-262
  - src/browser/leaderboardPanel.js:475-720
  - src/browser/leaderboardView.js
  - src/browser/longPress.js
---

## Problem

(User, 2026-09-29, for milestone v2.3.) "It's hard to read the race/sub-class on a smaller device on the leaderboard, can we put race/sub-class in the detail panel too? Also, a long press of the character in the leaderboard should bring up a context menu to 'Filter leaderboard by race/sub-class' options. So, filter by race, by sub-class, by both. This will make it easier to set the dropdowns for race/class."

Two asks:
1. **Race and sub-class in the expanded row detail.** On a small phone the RACE / SUB-CLASS text on a leaderboard row is hard to read. The expanded detail (`.mw-lb-detail`, built at `leaderboardPanel.js` ~L251-262 from `row.detail`, the stats and `row.dateLine`) should state the hero's race and sub-class plainly too.
2. **Long-press a row to filter.** A long press on a hero's row opens a context menu with three options: filter by this race, by this sub-class, or by both. Picking one sets the panel's RACE and/or SUB-CLASS filter (the same `race` / `sub` state the filter sheets set, ~L475-478, ~L685-720) and reloads the board. Today the player has to find the matching value in the RACE and SUB-CLASS sheets by hand.

## Solution

TBD at planning. Outline:
- The detail line gets the race and sub-class (for example "Dwarven · Wizard (Magic User)"), in the view-model (`leaderboardView.js` builds `row.detail`) so the tests pin it.
- The long press reuses `src/browser/longPress.js` (the Phase 71 recognizer: HOLD_MS 450 ms, the move/scroll cancels, the click-suppression contract), so the long press never also toggles the row open.
- The menu is a small bottom sheet or popover in the panel's dark vocabulary: "Filter by Dwarven", "Filter by Wizard", "Filter by Dwarven Wizard", plus a cancel. It validates against `RACE_IDS` / `SUB_IDS` the way the sheet picks do, and does the same thing a sheet pick does (reset paging, re-query, and focus/announce for TalkBack). It also needs a keyboard/accessibility path (for example a context-menu key or an explicit button in the expanded detail), a back-button close and reduced motion.
- Filters still reset on every open (the existing Phase 84 rule).
- Shell-only (no engine, no server). Works on the ME and ALL views alike. Device checks go in the v2.3 batched UAT.
</content>
</invoke>
