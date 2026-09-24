---
created: 2026-09-24T19:07:39.855Z
title: Last row of the full fight log cannot be tapped to reveal its roll
area: ui
resolves_phase: 77
files:
  - mazeworld.html:1767-1788
  - mazeworld.html:2056-2075
  - mazeworld.html:3848-3915
  - mazeworld.html:5473-5520
  - src/browser/fightLog.js
---

## Problem

Device report (2026-09-24, v2.0 build): in THE FIGHT SO FAR (the full-log sheet, #mw-fightlog-sheet,
Phase 71 D-07/R-22), the entry nearest the bottom of the screen cannot be tapped. It does not expand
to show its dice roll. The other rows work. The log is newest-first, so this is the oldest entry
(ROUND 1) when you scroll to the bottom.

renderFightLog (mazeworld.html ~3856) adds the same onclick to every row that has a roll, so the
handler is probably fine. More likely, something covers the bottom of the sheet or the row cannot
get above it. Suspects:
- `.mw-legend-panel` is capped at `max-height:74%` with bottom padding only for the safe area. The
  Android gesture/nav bar, or a fixed layer from the combat screen (the #cb-act action bar, the rail,
  a toast), may sit above the bottom of the panel and take the tap.
- `.mw-fl-rows` has only 30px of bottom padding, so the last row cannot scroll clear of whatever
  covers the bottom edge.
- When the row expands, the roll line may open below the visible area, which looks like nothing
  happened.

## Solution

TBD. Reproduce on the Pixel 7 with a long fight so the list scrolls. Use elementFromPoint at the
last row's position to find what takes the tap. Then make sure no fixed combat layer sits over the
sheet (z-index), give `.mw-fl-rows` more bottom padding (for example the safe area plus a row
height), and scrollIntoView the revealed roll line when a row near the bottom expands.
