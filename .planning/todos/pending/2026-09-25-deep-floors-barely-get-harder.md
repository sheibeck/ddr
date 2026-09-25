---
created: 2026-09-25T00:00:00.000Z
title: Deep floors barely get harder - foe tier caps at depth ~14, HP +1.5%/floor, control spells lock everything
area: engine
resolves_phase: 75.3
files:
  - engine/difficulty.js:79 (FOE_LEVEL base 0.9 + 0.29/depth, clamped to 1..5 in foeLevelFor; the max tier arrives at depth ~14)
  - engine/difficulty.js:95 (FOE_HIT_SCALE base 0.6 + 0.01/depth; ~1.0x at depth 42)
  - engine/difficulty.js:102 (FOE_HP_SCALE base 0.9 + 0.015/depth; ~1.53x at depth 42)
  - engine/difficulty.js:886+ (difficultyCurve)
  - content/spells.js (Freeze "indefinitely", Stone, Doze/Weaken: the control spells)
---

## Problem

User, 2026-09-25: "my friend is at depth 42 with his human sorcerer. His rotation is freeze with the occasional weaken or doze. … we aren't actually making the higher levels more difficult. He said he's also seeing creatures with only 14 or so hit points at that level. This means we need to balance our 12-20 levels and dial those up."

**Scouted:**
- The foe TIER (`foeLevelFor`) clamps at 5 around depth 14, so the roster stops escalating there.
- Foe HP scales +1.5% per floor: about 1.53x at depth 42, so a 9-hp foe has about 14 hp, which matches the report.
- Foe hit scales +1% per floor.
- Control spells (Freeze "indefinitely", Stone, Doze) have no deep-floor counter, so a freeze-lock rotation carries a Sorcerer to depth 42.

Together with the solo-fight issue (RULES-16), the deep floors are a stroll, which breaks the depth-20 unicorn target.

## Solution (user, 2026-09-25: expand Phase 75.3 now)

- **RULES-17, the curve from floor 12:** foe HP and hit scale get a second, steeper slope after floor 12 (a piecewise dial), dialled up through floors 12-20 and continuing beyond them.
  - Either the foe-level cap is lifted, or deep floors add elite variants with a level offset, so the roster keeps escalating.
  - The exact slopes come from 200-seed bot readouts against the depth-20 unicorn / floor 5-7 average target, using the checkpointed fit protocol. Report the numbers to the user; engine-shape changes are the user's call.
- **RULES-18, control spells lose their lock at depth:** from floor 12, foes increasingly resist or shrug off Freeze, Stone, Doze/Sleep, Weaken and Stupid. Options, recommended in this order:
  1. A depth-scaled roll-high resistance roll.
  2. Cap "indefinite" durations to a few rounds.
  3. Diminishing returns when the same foe is controlled again.

  The bot readout must confirm that a control-rotation caster no longer outlasts everyone else.
- The engine gate applies (measure, declare, regenerate; readouts before and after), and everything is written roll-high.
