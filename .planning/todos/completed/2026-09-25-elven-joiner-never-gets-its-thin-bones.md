---
created: 2026-09-25T00:00:00.000Z
title: An Elven Joiner never gets its own thin-boned to-be-hit trait
area: engine
files:
  - engine/combat.js (foeTurn member branch)
  - engine/derived.js (foeToHitVs; member odds)
---

## Problem

Found by the Phase 75.2 planner (2026-09-25). The Joiner (party member) branch of the foe's swing never applies a Joiner's own race trait for being hit. An Elven Joiner is therefore not thin-boned, although an Elven hero is (Phase 31 ruling). Under the 75.2 race-signature mask, Small's harder-to-hit face is also dropped for Elves, so an Elven Joiner ends up with neither. It is neutral to being hit. This is how the code already behaved before 75.2.

## Solution

Decide whether Joiners carry their race's to-be-hit trait like the hero. If yes, apply the race's `foeToHit` in the member branch through the same derived helper, with a direction test. The parity and fixture gate applies.

## Resolution

Resolved by Phase 79, plan 79-02 (2026-09-27), extra scope. `engine/derived.js#raceFoeToHit(sheet)` is now the one seam for a race's `foeToHit` trait. `foeToHitVs`/`foeToHitBreakdown` apply it for the hero only, and `engine/combat.js#foeTurn`'s member branch applies the Joiner's own, named by its race, before its size term. An Elven Joiner is thin-boned (the foe gets one more winning face), and an Elven hero's trait no longer leaks onto a Human Joiner (measured at the base: 5 and 6 faces; now 6 and 5). This follows the 75.2 rulings ("race signatures survive size", "Joiners get size"). It uses zero draws and a data read only. Measured zero moved parity fixtures and state pins (FIXTURE-INVENTORY.md, Phase 79 / Plan 79-02). Tests: `test/unit/joiner-race-to-be-hit.test.js`. Commits d4609b00 (RED) and 57cb14e5 (fix).
