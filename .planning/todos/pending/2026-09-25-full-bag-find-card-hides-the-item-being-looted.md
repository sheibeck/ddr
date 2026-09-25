---
created: 2026-09-25T00:00:00.000Z
title: Full-bag find card hides the item being looted (large bags overflow the rail)
area: ui
resolves_phase: 78
files:
  - src/browser/rail.js:180-186 (RAIL_COPY.find — title/take/leave/full; the full-bag branch lists the bag's items as drop choices)
  - mazeworld.html:924 (#mw-rail — only the combat-over rail has max-height + overflow-y:auto)
---

## Problem

User, 2026-09-25: "when your bag is full and you find an item, if you have a larger bag, you only see what's in your bag to drop, and you can't scroll the rail back up to see the item you are trying to loot."

**Scouted:**
- With a full bag, the find card ("SOMETHING WORTH TAKING") adds one drop choice per bag item.
- With a bag upgrade (more slots), the card grows past the rail's height. The found item's title and description scroll off the top.
- The map-side rail has no scroll container (only `#mw-rail[data-over="combat"]` gets `max-height` + `overflow-y:auto`), so the player can't see what they're deciding about.

## Solution

- The find card keeps the FOUND ITEM pinned at the top (name, stats line, description) and TAKE / LEAVE always visible.
- The drop list becomes a bounded, scrollable region inside the card (a max-height with its own overflow; the rail itself never scrolls the header away). Alternatively it becomes compact: a 2-column list, or name-only rows with a tap to see stats.
- Each drop row shows enough to compare (name plus the same stat line the Gear tab uses), so dropping is an informed choice.
- The same bounded-list rule applies to any other rail card that can list N bag items (loot piles, store-sell), if any.
- Presentation only. Pin it with a shell test at the largest bag size and text size L: the found item's title stays in view and the list scrolls.

**Pixel 7 check:** with the biggest bag, full, at text size L, find an item. Its name and TAKE / LEAVE stay visible, and the drop list scrolls.
