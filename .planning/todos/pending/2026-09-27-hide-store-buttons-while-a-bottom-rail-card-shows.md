---
created: 2026-09-27T23:10:07.977Z
title: Hide the store buttons while a bottom rail card shows
area: ui
files:
  - src/browser/storeScreen.js:90 (the store's `.actions` row, e.g. Leave)
  - src/browser/rail.js (the bottom rail card)
  - mazeworld.html (store screen and rail layout CSS)
---

## Problem

User (2026-09-27, Pixel 7 on the debug build from a5af69ee): "the new store buttons are great, but when the rails show up on bottom it pushes the buttons up. Instead, hide the buttons while the bottom rails are visible. Once they are dismissed, the buttons should show again."

When a rail card appears at the bottom of the store screen, the layout makes room for it by pushing the store's bottom buttons up, so the buttons jump.

## Solution

- While a bottom rail card is visible on the store screen, hide the store's bottom buttons (visibility, not layout: nothing should reflow or jump). When the card is dismissed, show them again in the same place.
- Standing ruling: the rail is the one feedback surface, shown only with a card (memory "UI rulings — v1.4 device round"). The buttons must not be tappable while hidden. Dismissing the card must bring them back, and so must a relaunch into an open store (Phase 76 keeps the store open through a relaunch).
- Check whether other screens with bottom action rows have the same push-up (the full-bag find card and the camp sheet). Apply the same rule only where the user would expect it; ask if unclear.
- Pin it with a shell test: rail visible means the buttons are hidden and not tappable; dismissed means they're visible; the button row's position doesn't move either way.
