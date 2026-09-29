---
created: 2026-09-29T03:02:34.000Z
title: ☰ menu — drop CENTRE MAP, MAKE CAMP first
area: shell
files:
  - mazeworld.html:2489-2505
  - test/unit/hud-menu-layout.test.js
  - test/unit/hudMenu.test.js
  - test/unit/shell-gear-toolbar.test.js
  - test/unit/shell-map-hud.test.js
---

## Problem

(User, 2026-09-28.) "remove the center map link from the player drop down, and move make camp to the top of that list."

The ☰ dropdown (`#mw-hud-menu`, mazeworld.html ~2489) lists, under the account block: MARKS, CENTRE MAP (`#mw-chip-centre`), MAKE CAMP (`#btn-camp`), SETTINGS, REPORT A BUG, PATCH NOTES, SAVE & QUIT, ABANDON THIS CHARACTER.

## Solution

- Delete the CENTRE MAP row (`#mw-chip-centre`) and its wiring (the click handler and the row re-sync that enables/disables it). Keep `centerMap()` itself and `window.mzCenterMap`: other code (floor entry, stairs, the pan-to-party paths) still calls them.
- Move MAKE CAMP (`#btn-camp`) to the first row under the account block, above MARKS. Its disabled state (Phase 70 D-08: combat, dead hero, no rations) is unchanged.
- The account block stays at the head of the dropdown (memory: account in ☰). Resulting order: account block, MAKE CAMP, MARKS, SETTINGS, REPORT A BUG, PATCH NOTES, SAVE & QUIT, ABANDON.
- Update the menu tests that pin the row list/order (hud-menu-layout, hudMenu, shell-gear-toolbar, shell-map-hud) and any keyboard/arrow-key focus order through the rows.
- Shell only (no engine). Device check: the ☰ menu on the Pixel 7.
- Timing: plan 83-09 is editing mazeworld.html now. Fits Phase 85 (it rebuilds the ☰ account block anyway) or a quick task after Phase 83.

Shipped in 85-01.
