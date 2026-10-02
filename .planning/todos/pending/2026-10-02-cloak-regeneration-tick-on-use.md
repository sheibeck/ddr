---
created: 2026-10-02T13:20:00.000Z
title: Cloak of Regeneration heals one tick on use, then every N squares
area: content
files:
  - content/treasure-tables.js:207-213 (Cloak of Regeneration txt + act { kind: "knit", effect: 30, cd: 50, hot: { every: 10, ticks: 3, heal: 1d6 } })
  - engine/items.js:1552-1600 (tickHealOverTime), ~2140 (the `knit` case in applyActivation: "No instant heal and no main-rng draw on use")
---

## Problem

User, 2026-10-02, on 2.3.0: "Cloak of Regeneration should do one tick of healing on activation, then after every x steps."

Since Phase 88 (ITEM-03), using the cloak only starts a 30-square heal-over-time window: a d6 at 10, 20 and 30 squares, then a 50-square cooldown. Nothing happens at the moment of use, so it feels like a dead tap, especially in a pinch.

## Solution

On use, apply one heal tick at once: a d6 drawn from the same derived heal-over-time stream, NOT the main rng, so main-rng fixtures stay put. Then continue the every-10-squares ticks.

**Decision for the user:** is the immediate tick
- (A) **one of the three:** use, 10, 20, then done, with the same total heal; or
- (B) **a fourth:** use, 10, 20, 30, more total heal, a small buff.

Also:
- Update the item `txt`, the chip, the narration (an EVENT_NARRATION entry plus a rail twin for the immediate heal), ITEM-AUDIT row and the patch notes.
- Joiners using the cloak follow the same rule.
- Update the fair bot's cloak model in tools/lib/tuning-bot.mjs (92-01 taught it heal-over-time).
- Declare any moved fixtures.
