---
created: 2026-09-25T00:00:00.000Z
title: Heal and gain lines narrate the raw roll, not the HP actually gained
area: narration
resolves_phase: 79
files:
  - src/browser/eventNarration.js (heal / regen / potion gain lines)
  - src/browser/narrationLines.js (the rail twins)
  - engine events whose gain payload carries the pre-clamp roll rather than the Math.min(maxWP, …) delta
---

## Problem

Found by plan 75-08 (2026-09-25), while it calibrated its HP-readout guard: most engine GAIN events carry and narrate the raw heal roll, not the HP actually restored after the clamp to max HP. A hero 3 HP below max who drinks a potion rolling 8 reads "You heal 8" but gains 3. This is the mirror image of RULES-06's under-narrated losses. It isn't dangerous, but it is dishonest in the same way. The guard in `test/unit/trap-death-repro.test.js` is scoped to loss-only actions because of this.

## Solution

Every gain line prints the HP actually gained. It can say "(8 rolled, 3 to full)" or read "back to full" when the gain was capped. Either add an additive `gained` field to the gain events, or compute the gain from the before and after wp in narration. Then extend the 75-08 engine sweep so gains are checked too. Voice: family-friendly deadpan, and HP not WP.

## Resolution

Resolved by Phase 79, plan 79-02 (2026-09-27). Every hero or member HP gain event carries an additive `gained` (the HP actually added after the clamp; 0 at full): healed, potionDrunk, regenerated, foodFound, cloakRegenerated, secondWindHealed, memberSecondWind (plus `rolled`), cooked, rested, floorRegen, leveled, faerieBoon, and a store meal's `bought` (plus `meal`). The Oracle and rail lines lead with it. A capped gain names its roll and says "back to full", and a gain at full says so instead of printing +0. A source guard in `test/unit/honest-gains.test.js` fails on a new clamp site without `gained`. The trap-death sweep (`test/unit/trap-death-repro.test.js`) now sums the gains too: 268 gain-bearing actions are checked. Zero rng draws and zero fixtures moved.
