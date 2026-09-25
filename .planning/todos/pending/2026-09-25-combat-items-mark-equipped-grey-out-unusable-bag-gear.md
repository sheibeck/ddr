---
created: 2026-09-25T00:00:00.000Z
title: Combat ITEMS - mark equipped gear, grey out bag gear that can't be used in a fight
area: ui
resolves_phase: 77
files:
  - src/browser/combatMenu.js:254-326 (slot 3 ITEMS submenu — carriedRows/wornRows both `enabled: true`)
  - src/browser/gearTab.js (itemRowState — the gear-tab status text reused as the row cost)
---

## Problem

User, 2026-09-25: "when looking at gear in combat window, show equipped on gear that is equipped, grey out unequipped gear that isn't usable during combat."

**Scouted:**
- In `combatMenu.js`, `carriedRows` lists every BAG item that is a potion or has an activation, always `enabled: true`.
- Worn-activation gear (jewelry, cloaks, staves) only works while worn (Phase 37 GEAR-03, 260918-w4n "use-activated-only"). So a bagged ring or cloak is offered as usable in a fight when it isn't.
- `wornRows` (equipped activatables) carry no "EQUIPPED" marker, so the two look alike.

## Solution

- Worn rows show an **EQUIPPED** tag in the row, e.g. "EQUIPPED · READY" via the cost/status slot or a badge, and stay enabled when usable.
- Bag rows that need to be worn to work render **disabled (greyed)**, with the reason in the row ("NOT EQUIPPED · can't swap mid-fight"). Bag potions and consumables that work from the bag stay enabled.
- The header count ("N USABLE") counts only rows that are actually enabled.
- If equipping mid-combat is ever allowed, revisit this. Today it isn't.
- Presentation only: no engine change, no fixture moves. Update `combatMenu`'s unit tests and snapshots.

**Pixel 7 check:** in a fight with a ring worn and a cloak in the bag, the ring row reads EQUIPPED and is usable, and the cloak row is greyed with its reason.
