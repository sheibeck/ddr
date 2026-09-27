---
created: 2026-09-27T00:00:00.000Z
title: No healing at all when going down a floor
area: rules
resolves_phase: 79.1 (must land before its bot pass)
files:
  - engine/difficulty.js:208-214 (HERO_REGEN_PER_FLOOR 0.25, fitted in Phase 54 USER RULING G cycle 3)
  - engine/difficulty.js:734-740 (heroRegenFor)
  - engine/movement.js:1263-1276 (descend: the floorRegen heal on arriving at a new floor)
  - engine/events.js (floorRegen) and its Oracle/rail narration
---

## Problem

User (2026-09-27): "we didn't want to full heal on every floor. We shouldn't heal at all when we go down a floor. I know we added that to make the game easier, but that is definitely too much."

Today `descend` restores `HERO_REGEN_PER_FLOOR × maxHP` (0.25, fitted in Phase 54 to ease the difficulty curve) every time the hero arrives on a new floor. Descending also grants the descend SP bonus, and a level-up adds its HP gain to current HP. Together these feel like a full heal on every floor. The user wants the stairs to heal nothing.

## Solution

- Set HERO_REGEN_PER_FLOOR to its identity, 0 (canon has no per-floor regen), so `descend` restores no HP. Greenfield option: remove the regen block and the `floorRegen` event entirely, if no other surface needs them. Either way, no HP comes back on descent.
- Keep the other heals (camp, rations, potions, spells, Table 4 dots, the level-up HP gain added to current HP) unless the user says otherwise. If level-up healing is part of what feels "too much", flag it to the user rather than changing it.
- Remove or reword any copy that promises healing on the stairs (the Oracle/rail `floorRegen` lines, tutorial or help text, docs/DIFFICULTY-RETUNE notes).
- Re-pin the state pins and fixtures it moves, each with a traced cause; the bot plays the new rule.
- **Phase 79.1:** the milestone bot pass measures the game WITHOUT per-floor regen. Its sweep must NOT re-enable or search over HERO_REGEN_PER_FLOOR; the dial is locked at 0 by user ruling. Record this in 79.1-CONTEXT.
