---
created: 2026-09-25T00:00:00.000Z
title: Deep floors are full of solo fights - foe count ignores depth
area: engine
resolves_phase: 75.3
files:
  - engine/difficulty.js:434-437 (foeCountFor — `if (firstRoll <= 2) return 1;` at every depth; else FOE_COUNT_TABLE[FOE_COUNT_SKEW])
  - engine/combat.js (startCombat — the d4 first roll, the second draw)
---

## Problem

User, 2026-09-25: "i have a troll summoner on floor 23 right now. Combats at this level should pretty much always be multiple creatures. I end up with a lot of solo fights, and I think this run could easily go to level 30."

**Scouted:** `foeCountFor(firstRoll, drawSecond)` returns 1 foe on a d4 of 1-2 at EVERY depth, so 50% of fights are solo whether on floor 1 or floor 23. Depth only scales foe HP and hit (the curve), never the count.

This undercuts the depth-20 unicorn target: a strong build strolls past 20.

## Solution (user, 2026-09-25: "Solo fights fade with depth"; placed as a new Phase 75.3)

- Floors 1-4: as today (d4 ≤ 2 gives a solo fight, 50%).
- Floors 5-9: solo only on a d4 of 1 (25%). A 2 now draws from the table.
- Floors 10-19: never solo, at least 2 foes (clamp the table result up).
- Floors 20+: at least 3 foes.
- Keep the SAME draws: the first d4 and the second table draw happen as today, and the depth rule reshapes the result. Where the solo branch skipped the second draw, the planner must keep the draw count identical, e.g. by always drawing the second roll only on the paths that drew it before, and clamping otherwise, so unrelated fixtures don't reorder. Declare any moved fixture.
- Wandering monsters and dot and lair encounters all go through the same `foeCountFor`. Forced single encounters (a named solo boss, lairs with fixed rosters) keep their authored counts.
- **Readout:** a 200-seed bot readout before and after (with Phase 75.2's hero size in place), recorded in `docs/DIFFICULTY-RETUNE.md` against the depth-20 unicorn / floor 5-7 average target. If the median moves far below 5, flag it for the user; don't auto-compensate.
