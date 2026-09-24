---
created: 2026-09-24T09:45:00.000Z
title: Gear tab item sheet shows the full stat set, like the store does
area: ui
files:
  - src/browser/gearSheet.js (gearSheetModel(state, target) — the one view model behind every gear action sheet; header + ordered actions)
  - src/browser/storeScreen.js (renderStoreScreen — the stock rows with the detailed stats; uses armorDisplay / usableBy / storeRowState from viewModels.js)
  - src/browser/viewModels.js (armorDisplay, lootCompare, usableBy — the shared stat formatters)
  - src/browser/gearTab.js
---

## Problem

From the user's Pixel 7 session on 2.0.0 (2026-09-24): "show the full set of stats on a piece of gear when you open it from the gear tab. I noticed detailed stats on the store, but those didn't show when you tap the item in the gear tab."

The store rows show an item's detailed stats. Tapping the same item on the Gear tab opens the action sheet (`gearSheetModel` → `renderGearSheet`), which shows only its header, legality/upgrade line and actions. The full stat set is missing there.

## Solution

TBD. Hints:
- Find exactly which stat fields the store row renders, and from which `viewModels.js` formatter: armour value / AC, damage, weight/bulk, charges, who can use it, bonuses.
- Add the same stat block to the gear sheet header. Build it from ONE shared formatter so the store and the gear sheet can never drift, and test that both surfaces render the identical stat list for the same item.
- It applies to worn items and bag items alike. The comparison or upgrade line (`lootCompare`) stays where it is.
- Keep the sheet usable at text size L: stats wrap as chips or rows, and the actions stay reachable.
- Presentation only: engine untouched. Watch the existing gear-sheet / store pins, and the HP-never-WP scan for any new labels.
