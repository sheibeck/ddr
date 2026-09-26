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
