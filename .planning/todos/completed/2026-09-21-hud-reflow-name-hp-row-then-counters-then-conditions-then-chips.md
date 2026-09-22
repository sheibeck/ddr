---
created: 2026-09-21T23:00:00.000Z
title: HUD reflow — name/class + HP row, then counters, then conditions, then chips
area: ui
resolves_phase: 57
files:
  - mazeworld.html:1365-1385 (.mw-hud markup — Floor / Day / Squares / Rations row with the x/y HP bar floated to the right of the SAME row)
  - mazeworld.html:866-893 (.mw-hud / .mw-hud-top flex row; .mw-hud-row overflow:hidden nowrap; .mw-hud-wp margin-left:auto)
  - mazeworld.html:1386-1391 (.mw-cond-strip — condition chips directly under the HUD, hidden when empty)
  - mazeworld.html:338-342, 1415-1420 (the MARKS / CENTRE / MAKE CAMP / gear chip strip — see the 2026-09-21 "reserved band" todo)
  - .planning/todos/pending/2026-09-21-map-chip-strip-is-a-reserved-band-above-the-map-not-an-overl.md (the companion todo — land together)
---

## Problem

Reported on the Pixel 7 (2026-09-21, build `dbcdd66`), user's words: "once we moved over 1k steps the hit point bar now sits over top of the ratings. I think we need to put the name/class and hit points at the very top. Then steps/days/depth on the next row, then condition chits on the next row, then the buttons from our previous capture."

The HUD is ONE flex row: `Floor · Day · Squares · Rations` on the left (`.mw-hud-row`, `nowrap`, `overflow:hidden`) and the `x/y HP` text + threshold bar floated right (`.mw-hud-wp`, `margin-left:auto`). When Squares reaches four digits the left cluster widens past the row and the HP block lands on top of the Rations readout. Phase 35 (MAP-01, ruling 5) had retired the name/class line from the HUD, so there is no row for it today.

## Solution

Reflow the HUD into four stacked bands, top to bottom (user ruling 2026-09-21 — this supersedes Phase 35 ruling 5's single-row HUD):
1. **Identity + vitals:** `Name — Race Class (Sub) · Lvl N` on the left, `x/y HP` + the threshold bar on the right (the bar gets the full remaining width so it can never collide).
2. **Counters:** `Depth · Day · Squares · Rations` — one row, `flex-wrap:nowrap` but with numerals in a fixed-width mono slot sized for 5 digits (Squares grows unbounded), so nothing overflows.
3. **Condition chips:** the existing `.mw-cond-strip` (hidden when empty).
4. **Map chip strip:** MARKS / CENTRE / MAKE CAMP / gear as a reserved layout band (the companion todo) — outside the map viewport.
Keep `paint()`'s ids (`m-floor`, `m-day`, `m-steps`, `m-rations`, `mw-hud-wp`) and the low/critical threshold classes; safe-area padding stays on band 1. The rail/toast surfaces and the DEV chip are unchanged. Land with the chip-strip todo as one UI quick task between phases, never mid-wave. Pixel 7 check: reach 1,000+ squares — no overlap; the four bands read in that order on the map tab; other tabs unaffected.

## Resolved

Resolved by Phase 57 plan 01 (the four stacked HUD bands, fixed-width counters, the identity line's return).
