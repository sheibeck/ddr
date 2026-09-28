---
created: 2026-09-28T01:10:00.000Z
title: The death card stays on the map after leaving the tab and coming back
area: ui
files:
  - mazeworld.html:~2811-2820 (showTab: leaving the MAP while dead sets mwDeadMapAside = true)
  - mazeworld.html:~2897-2900 (back on the MAP while dead, renderEncounter keeps the put-aside card aside)
  - mazeworld.html:3453 (the dead card copy: THAT IS THAT / REVIEW THE ORACLE / FINAL SHEET / BURY THEM)
---

## Problem

User (2026-09-27, Pixel 7 debug build): "after dying, if i leave the map and come back to it, the rail with our death message is gone, and i just see the map. Make sure that the map still shows the death message with the three buttons on it."

Phase 78 (HUD-02, the 2026-09-26 ruling "the map where you died stays viewable") made leaving the MAP tab while dead put the death card aside (`mwDeadMapAside = true`). Coming back shows the bare map with no card, so the player loses the death message and its three actions: REVIEW THE ORACLE, FINAL SHEET and BURY THEM.

## Solution

- NEW RULING (supersedes that part of HUD-02): whenever the MAP tab shows while the hero is dead, the death card is up with its message and all three buttons. Drop the put-aside behaviour: remove `mwDeadMapAside` and its reads, since greenfield means no dead paths.
- The map stays viewable under the card: the read-only drag and pinch from 78-06 still work around it, and the card doesn't block the dead-state lockdown rules.
- Relaunch while dead: the card shows on the map.
- Tests: re-pin the HUD-02 put-aside tests with the new ruling as the reason. Leaving to ORACLE, DEAD or ☰ and returning shows the card with three live buttons, and a relaunch shows it too.
- Pixel 7 check: die, open ORACLE, return to MAP. The card and its three buttons are there.
