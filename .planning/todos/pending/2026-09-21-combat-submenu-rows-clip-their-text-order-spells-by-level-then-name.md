---
created: 2026-09-21T21:00:00.000Z
title: Combat submenu rows clip their text; order spells by level then name
area: ui
files:
  - mazeworld.html:644 (.cb-row — padding:10px 11px, min-height:48px)
  - mazeworld.html:647 (.cb-row-label — font-size 7.5px display font, line-height 1.6, overflow:hidden)
  - mazeworld.html:643 (.cb-sub-list — max-height 206px, overflow auto)
  - mazeworld.html:3171-3200 (renderActionArea — cb-submenu / cb-sub-list markup)
  - src/browser/combatMenu.js:150-166 (spell rows built in SPELLS array order, no sort)
---

## Problem

Reported on the Pixel 7 (2026-09-21), user's words: "the spell and ability buttons when in combat don't have enough padding on the bottom, so the button text runs past the bottom of the button. Also, make sure spells are in level order, then alphabetical."

1. `.cb-row` is `display:block` with symmetric 10px padding; the row's inner `.cb-row-head` + description line overflow the box on the phone (the pixel display font at 7.5px with line-height 1.6 plus the desc line exceeds the 48px min-height, and `overflow:hidden` on the label clips instead of growing) — text visibly runs past the bottom border.
2. Spell rows are emitted in `SPELLS` array order (content order), so a level-3 spell can sit above a level-1 one; the user wants level ascending, then alphabetical.

## Solution

1. Make `.cb-row` size to its content: padding-bottom at least the top padding plus a real inner gap (e.g. `padding:10px 11px 12px`), drop `overflow:hidden` on the label (or keep it on the head line only), let `line-height` fit the pixel font, and verify at the Pixel 7 width with a 2-line desc. Same rule for the ABILITIES submenu rows (same `.cb-row`).
2. In `combatMenu.js`, sort `spellRows` by `spellLevelFor(c.sub, sp)` (the effective level the row's `LVL` label should also show) ascending, then `sp.n` locale-compare; keep dispatch `idx` = `SPELLS.indexOf(sp)`. Unit test the order. Coordinate with the "hide uncastable spells in combat" todo (same file, same rows) — land them together. UI quick task between phases, never mid-wave. Pixel 7 check: open SPELLS and ABILITIES in a fight — no clipped text; spells read LVL 1 A to Z, then LVL 2 …
