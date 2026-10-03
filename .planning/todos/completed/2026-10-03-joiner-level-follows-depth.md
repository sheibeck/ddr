---
created: 2026-10-03T20:38:18.567Z
title: Joiner level follows depth (one level per three floors, 1 to 5)
area: engine
resolves_phase: 94.1
files:
  - engine/encounters.js:605 (lvl = min(SPELL_LEVEL_TABLE[d10 - 1], depth))
  - engine/encounters.js:616-635 (grantLevelAbilities, c.joiner, joinerMet, pendingJoiner use lvl)
---

## Problem

User, 2026-10-03: "We need to update Joiner level rules. I want Joiner level to be dictated by depth based on the average level of a character. For instance, I find that i'm usually still level 1 by the time I reach floor 4-ish. So, Joiners should be at most depth/3 minimum 1 for level. I.e. from level 1-3 you'll find level 1s. 4-6 level 2s. 7-9 level 3s. 10-12 level 4s, and 13+ level 5s."

Today a Joiner's level is a d10 roll on SPELL_LEVEL_TABLE, capped only at the floor depth (`engine/encounters.js:605`). So a depth-4 Joiner can be level 4 while the hero is still level 1.

## Solution

The level band comes from the floor: ceil(depth / 3), at least 1 and at most 5. That gives:
- floors 1–3: level 1
- floors 4–6: level 2
- floors 7–9: level 3
- floors 10–12: level 4
- floor 13 and deeper: level 5

Decide in discuss-phase which of these the user means:
- (a) the band is the level exactly; or
- (b) the band is a cap on today's roll ("at most depth/3"), so the result is min(roll, band).

Engine gate: if (a) drops the d10 draw, the main rng sequence moves for every Joiner encounter. Measure, declare and regenerate the moved fixtures, or keep the draw and ignore its value. Also update the fair bot's expectations if they read Joiner levels, the Joiner text (joinerMet lines), and the patch notes.

Added to milestone v2.4 by the user, 2026-10-03.
