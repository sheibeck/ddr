---
created: 2026-10-02T13:00:00.000Z
title: Put harmful condition chips (disease, poison) first, always visible
area: ui
files:
  - src/browser/heroConditions.js:198-215 (chip list built in conditionsOf emit order; `tone` from the condition's polarity)
  - engine/derived.js (conditionsOf emit order)
---

## Problem

User, 2026-10-02, on 2.3.0: "Negative affects like disease/poison should always be on the far left slot for combat condition chits so they don't get pushed off the screen. We want them visible."

Hero combat condition chips render in `conditionsOf`'s emit order, which mixes good and bad effects. With several buffs active (Strength, Shield, cloak heal-over-time and so on), a harmful condition such as Poisoned or Diseased can sit far right and overflow off the screen. That is exactly the one the player most needs to see.

## Solution

Sort the chip list for display:
1. All `tone: "bad"` chips come first (far left).
2. Then the good ones.
3. Keep the existing relative order within each group (a stable sort).

Do it in the view layer (heroConditions.js), not in engine `conditionsOf`, so engine order and fixtures don't move.
- Check whether the Joiner and Company chip rows and the foe chips should follow the same rule.
- Check that an overflowing row truncates on the right (good chips), never the left.
- Add a unit test: given mixed good and bad conditions, every bad chip precedes every good one, and the order within each group is unchanged.
- Update any shell snapshot that moves.
