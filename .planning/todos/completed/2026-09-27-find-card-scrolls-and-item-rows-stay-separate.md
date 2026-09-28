---
created: 2026-09-28T00:20:00.000Z
title: The Something Worth Taking card scrolls, and its item rows stay separate
area: ui
files:
  - src/browser/rail.js:189-195 (RAIL_COPY.find, the SOMETHING WORTH TAKING card)
  - mazeworld.html (#mw-rail / #mw-rail-actions ~:5610; the 78-08 height-capped find-card column)
  - src/browser/gearSheet.js / viewModels.js / itemRowState.js (the item descriptions 79-09 expanded)
supersedes: .planning/todos/pending/2026-09-25-full-bag-find-card-hides-the-item-being-looted.md (Phase 78's HUD-09 part-fix; moved to completed)
---

## Problem

User (2026-09-27, Pixel 7, debug build a5af69ee): "the Something Worth Taking rail needs to be scrollable. And with the expanded equipment descriptions, the equipment is running together on that rail."

Two issues on the find card (the full-bag loot decision):
1. **It doesn't scroll enough on the device.** Phase 78-08 (HUD-09) made the card a height-capped column where only the drop list shrinks and scrolls. On the device, the card still needs to scroll: the found item's details, or the list, run past what's visible.
2. **Rows run together.** Since Phase 79 (79-09) lengthened the item description and comparison lines, the drop-choice rows have no clear separation. One item's text runs into the next, so you can't tell where each item starts and ends.

## Solution

- Make the card's content scroll reliably on the device: a bounded scroll region with touch scrolling (`overflow-y:auto`, `-webkit-overflow-scrolling`, `overscroll-behavior:contain`), with TAKE IT NOW / LEAVE IT always visible. Check what the 78-08 cap does at text sizes S, M and L on a 412x915 viewport with the largest bag, full.
- Give each drop row a clear separation: a divider or spacing, the item name as a bold first line, and the stat or description line under it, clamped to about 2 lines with the full text on tap if needed. Keep the rows compact enough that several fit.
- The found item stays pinned at the top: name, stats, description.
- Pin it with a shell test at the largest bag and text size L: the list scrolls, the found item and the buttons stay in view, and rows have a separator. Add a human check on the Pixel 7.
