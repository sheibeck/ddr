---
created: 2026-09-28T03:20:00.000Z
title: Freeze never kills outright - damage, then frozen for 1d4 rounds
area: rules
files:
  - engine/magic.js (~L598-670, the thrown branch: the onHit "freeze" frozenSolid kill at or below the knee, and the controlHoldRoundsFor hold past it)
  - engine/combat.js (allyCast Freeze), engine/items.js (the Birch Staff freeze power)
  - content/spells.js:87 (Freeze txt)
---

## Problem / ruling

User (2026-09-28), after learning that Freeze's "d6" is its damage die: "Oh, then freeze should never kill out right. It should deal its damage and freeze an enemy for 1d4 rounds."

## Solution

- A Freeze hit deals its damage. If that damage kills, it's a normal kill; otherwise the foe is frozen (held) for 1d4 rounds (a new d4 draw), at every depth.
- The frozen-solid instant kill is removed.
- The 2026-09-27 intel resist runs first (a resisted Freeze does nothing), and the RULES-18 past-the-knee control resist still applies to the freeze part.
- This covers the hero, Joiners, scrolls and the Birch Staff.
- The engine change is folded into Plan 79.2-01 before its START measurement; the text is in quick 260928-tsx.

## Refinement (user, 2026-09-28)
- "if it hits and resists, deal damage, but no freeze." For Freeze only, the intel resist (and the past-the-knee control resist) blocks the FREEZE, not the damage.
- The order is to-hit → damage → (survivor) intel resist → depth resist → frozen 1d4.
- Every other spell keeps "a resist means no effect".
