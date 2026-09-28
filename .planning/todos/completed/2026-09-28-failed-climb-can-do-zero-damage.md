---
created: 2026-09-28T03:00:00.000Z
title: A failed climb can do 0 damage - always hurt at least 1
area: rules
files:
  - engine/movement.js:~355-400 (the climb fall loop: each 10 ft segment hurts only on d20 > 2; the !ok path: scaleHazard, then the fellClimbing/fellInGorge event)
  - src/browser/eventNarration.js:243 (fellClimbing: "Fall: the wall had other plans. −N hp.")
---

## Problem

User (2026-09-27, Pixel 7): "this might be handled with making the floors harder, but notice this fall caused 0 damage". The Oracle showed:
> Over, eventually. The wall took its cut on the way.
> Fall: the wall had other plans. −0 hp.

A failed climb rolls each fallen 10 ft segment on a d20. Only 3–20 hurts, so a fail on the first segment has a 10% chance of `hurt = 0`, and `scaleHazard` passes 0 through.

## Solution

USER RULING (2026-09-28): "Always hurt (min 1)". A failed climb or leap always costs at least 1 HP after scaling, with no draw-order change. Folded into Plan 79.2-01 before its START measurement, so the difficulty sweep measures it.
