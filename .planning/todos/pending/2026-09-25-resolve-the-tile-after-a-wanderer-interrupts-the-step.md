---
created: 2026-09-25T00:00:00.000Z
title: Resolve the stepped-on icon after a wandering monster interrupts the step
area: engine
resolves_phase: 75
files:
  - engine/movement.js:508 (crossings(100) → newDay → the 8-hour wandering check can startCombat on this step)
  - engine/movement.js:523 (`if (state.combat) return events;` — returns BEFORE the cell.feat dispatch; the feat is left on the tile, unresolved)
  - engine/movement.js:524-540+ (feature dispatch: dot / trap / chest / tele / …)
  - engine/combat.js (endCombat — where a deferred tile resolution would fire)
---

## Problem

User, 2026-09-25: "if a wandering monster check triggers when you step on an icon, we need to resolve the icon after combat ends."

**Scouted:**
- On the step that crosses a 100-square boundary, `newDay` runs the wandering-monster check, which can `startCombat`.
- The step then hits `if (state.combat) return events;` (movement.js:523) BEFORE the feature dispatch. The tile's `feat` (Table-4 dot, trap, chest, teleporter, …) stays on the map under the hero, unresolved.
- After the fight the hero stands on it, but nothing triggers until they step off and back on.
- The prototype behaves the same (canon), so this is a deliberate rules change.

## Solution

- **Engine:** when a wanderer pre-empts a step onto a feature tile, record a pending tile resolution (e.g. `state.pendingTile = { x, y }`, the Phase 29 pendingLoot/pendingFind pattern). When combat ends with the hero alive and still on that tile (won, or the foes fled or were parleyed), resolve the feature exactly as the step would have, through the same dispatch.
  - Fled: the hero isn't on the tile any more, so leave the feature for later. That fork needs a ruling; recommend "still resolves if you're standing on it".
  - Died: nothing.
- **Order after victory:** loot/find first, then the tile. Narrate it ("With that settled, the chest.").
- **Engine gate:**
  - Measure fixtures where a wanderer fires on a feature step, declare and regenerate them. Never edit the master.
  - Carve the new `pendingTile` field out of the comparables, or reconcile it the way pendingFight is.
  - Phase 76's relaunch persistence carries `pendingTile` like the other pending states.
- **Tests:**
  - A wanderer on a chest step: after the win the chest opens.
  - On a trap step: after the win the trap springs.
  - Death: nothing further.
  - A relaunch mid-fight still resolves the tile after the fight (with Phase 76).

**Pixel 7 check:** hard to force on the device. Rely on the tests and note it in the checklist as covered.
