---
created: 2026-09-22T23:40:00.000Z
updated: 2026-09-23
title: A dead character gets only the Oracle and the DEAD screen (the ☰ menu cannot open while dead)
area: ui
resolves_phase: 67
files:
  - mazeworld.html hudMenuEvent (~L4814) — passes `{ encounter: hasActiveEncounter() }` to __mzHudMenu.next
  - src/browser/hudMenu.js hudMenuNext — `toggle` refuses to open while ctx.encounter is truthy (57-05, T-57-17); SETTINGS row is the legacy cog `mw-gear-btn` (L37)
  - mazeworld.html hasActiveEncounter — true while the death overlay is up
---

## Problem

**A. (2026-09-22, Pixel 7, v1.8 device session)** User's words: "Also, the hamburger menu doesn't work when I'm dead."

Diagnosis (orchestrator, read at HEAD): 57-05 made the ☰ menu refuse to open while an encounter is active (so MAKE CAMP / CENTRE MAP can't act over a fight — T-57-17). `hudMenuEvent` computes `encounter` from `hasActiveEncounter()`, which is also true while the DEATH overlay is up — so once dead, the menu (and with it SETTINGS) is locked out.

**B. (2026-09-23, user)** The dead state as a whole is janky and confusing. User's words: "When you are dead, there's some janky interactions that cause some confusion. A. you can't use the hamburger menu. B. the goal of not returning to the main menu right away is so you can explore your character. But, really, we should disable all the interactions. Or, maybe we really do limit a dead character to the just the Oracle and just the Dead screen. That might be the best fix."

The point of staying in the dungeon after death (instead of jumping straight to the title) was to let the player look over their character. In practice the other tabs and HUD controls stay half-live and confuse people.

## Solution

**Direction (user's preferred fix):** once dead, limit the player to the **Oracle** and the **DEAD screen**. Every other tab and interaction is disabled or hidden (map taps, the gear/hero tabs, camp, marks, centre map). The path back to the title stays obvious.

**Milestone tie-in (user, 2026-09-23):** the ☰ HUD menu is being replaced in the current milestone, v2.0 Leaderboards. Phase 67 (ACCT-01/02) turns the settings cog into the account chip, and Phase 66 (BOARD-01) turns the DEAD tab into the Leaderboards panel. So don't patch the old ☰ open gate on its own. Build the dead-state rules into those phases:
- The account chip (sign in/out, Compete, Settings) must open while dead, keeping part A fixed through the replacement. Keep the live-encounter refusal for any map actions that survive.
- The Leaderboards panel is the dead player's main screen, and the Oracle log stays readable. Nothing else is interactive.
- Decide during the phase discuss whether the character's final sheet ("explore your character") becomes a read-only view reachable from the DEAD screen, e.g. the tap-to-expand row of the run just ended, or is dropped.
- Tests: a dead-state test that shows only the Oracle and the DEAD/Leaderboards surface accept input and that the chip's Settings opens. Re-pin the hud-menu-layout.test.js encounter tests if the ☰ menu survives in any form.

Presentation-only (shell / `src/browser/`), with no engine change.
