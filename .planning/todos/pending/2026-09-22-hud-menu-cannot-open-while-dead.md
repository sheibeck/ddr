---
created: 2026-09-22T23:40:00.000Z
title: The ☰ HUD menu cannot be opened while dead
area: ui
files:
  - mazeworld.html hudMenuEvent (~L4814) — passes `{ encounter: hasActiveEncounter() }` to __mzHudMenu.next
  - src/browser/hudMenu.js hudMenuNext — `toggle` refuses to open while ctx.encounter is truthy (57-05, T-57-17)
  - mazeworld.html hasActiveEncounter — true while the death overlay is up
---

## Problem

Reported on the Pixel 7 (2026-09-22, v1.8 device session), user's words: "Also, the hamburger menu doesn't work when I'm dead."

Diagnosis (orchestrator, read at HEAD): 57-05 made the ☰ menu refuse to open while an encounter is active (so MAKE CAMP / CENTRE MAP can't act over a fight — T-57-17). `hudMenuEvent` computes `encounter` from `hasActiveEncounter()`, which is also true while the DEATH overlay is up — so once dead, the menu (and with it SETTINGS) is locked out.

## Solution

Distinguish the death screen from a live encounter in the menu's open gate: while `S.dead` (death overlay), the menu should open — at minimum SETTINGS must work; decide per row whether MARKS / CENTRE MAP / MAKE CAMP are shown, disabled or refused with a line (MAKE CAMP when dead should refuse in voice). Keep the live-encounter refusal intact. Re-pin hud-menu-layout.test.js's encounter tests and add a dead-state test. Presentation-only; post-milestone quick task.
