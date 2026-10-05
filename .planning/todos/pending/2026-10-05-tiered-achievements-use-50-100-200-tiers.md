---
created: 2026-10-05T15:13:21.035Z
title: Tiered achievements use 50/100/200 tiers
area: planning
files:
  - .planning/ROADMAP.md:469
  - .planning/ROADMAP.md:533-539
  - .planning/phases/999.12-achievements-track/ICON-BRIEF.md
  - achievements/build_achievements.py
  - achievements/manifest.json
---

## Problem

User ruling (2026-10-05) for the achievements milestone (backlog 999.12, aimed at 2.5.0):
**"for tiered achievements, I want 50/100/200 as the tier structure."**

This replaces the earlier 4-rung ladder in the 999.12 design principle (ROADMAP.md:469,
"deaths 50 / 100 / 200 / 500") and settles the open "Tier counts" decision
(ROADMAP.md:537). Tiered tracks get three tiers: 50, then 100, then 200.

Knock-on effects:

- **Icons:** the drawn set has 4 tiers per tiered track (`_t1`…`_t4`) for frequent_flier,
  survivor, hoarder, party_animal, human_shields and disposable_help. Under three tiers the
  six `_t4` icons (and the mythic tier frame) go unused. Files are named by tier number, so
  `_t1/_t2/_t3` map straight onto 50/100/200 with no new art. The icon count drops from
  50 to 44.
- **Play Games points:** fewer tiers means more of the 1,000-point budget per achievement.
- **Kill counts:** currently one achievement each at 100 kills (untiered). Tiering them
  at 50/100/200 would add 2 icon files per group (12 total), using the same base art.

## Solution

Apply at `/gsd-new-milestone` / discuss for the achievements milestone:

1. Record 50/100/200 as the tier ladder in the 999.12 entry and requirements.
2. Confirm with the user which tracks it covers. Raw 50/100/200 fits deaths (Frequent
   Flier), Joiners and fallen helpers. It may not fit every counter literally: Depth is its
   own 5/10/15 ladder, Hoarder (coin) and Survivor (days) may need scaled thresholds with
   the same three-tier shape. Ask whether "50/100/200" is the exact count for every track
   or the three-tier shape.
3. Decide whether kill counts become tiered (50/100/200) or stay a single 100-kill unlock.
4. Drop the `_t4` icons and mythic frame from the manifest/export (or keep them unused).
