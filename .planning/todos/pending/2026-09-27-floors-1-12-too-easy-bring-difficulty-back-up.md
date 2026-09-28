---
created: 2026-09-28T01:00:00.000Z
title: Floors 1-12 are too easy - bring the difficulty back up
area: rules
files:
  - engine/difficulty.js (DIALS: FOE_LEVEL ~L79, FOE_HIT_SCALE ~L95, FOE_HP_SCALE ~L102, the Phase 54 fitted band dials, difficultyCurve ~L886+)
  - tools/fit-difficulty.mjs, tools/lib/fit-score.mjs (SEARCH_PLAN, 9 coordinates after 79-02c), tools/tune-difficulty.mjs (the fair bot)
  - docs/DIFFICULTY-RETUNE.md
---

## Problem

User (2026-09-27, playing the Pixel 7 debug build from a5af69ee, which already has no descent heal): "we need to bring the difficulty back up on floors 1 - 12. Just too easy."

The bot data disagrees with the human. At 79.1-02's START (the shipped dials, with no per-floor heal and Joiner-only defences), the fair bot's fresh p50 death depth is 6, inside the ruled 5-7 band, and floors 1-12 all PASS their band targets. So the band targets are met FOR THE BOT, while a human finds floors 1-12 too easy. Likely causes:
- The fair bot plays far worse than a real player. Its choices, flee, camp, gear and spell use leave a skilled player surviving much deeper, so fitting the dials to the bot under-tunes for people.
- The Phase 54 band fit (the easing that also brought the since-removed per-floor heal) and later user-ruled buffs (the Phase 75 player-side changes) left the early foes soft.

Standing targets (memory "Depth 20 target + floor 5-7 average"): an AVERAGE run ends on floor 5-7, and depth 20 is a rare unicorn ceiling. The user's feel says a real run goes past that.

## Solution

- **Decide the yardstick first** (the user's call at discuss time):
  - a stronger "skilled" bot tier that plays like a competent human (camps and eats sensibly, uses spells and abilities well, flees wisely, equips upgrades), with the band targets refit against it; or
  - move the targets for the fair bot (e.g. its p50 death depth 4-5), so humans land near 5-7; or
  - a play-log calibration from the user's own runs (depth reached, deaths).
- **Levers on floors 1-12:** foe HP and hit scales, the early foe level/tier, encounter density, trap damage, ration and potion supply, gold and store prices. Tune with the checkpointed fit protocol (blocks of 10; failure patterns go back to the orchestrator; engine-shape changes go to the user). Floors 13+ keep the ruled tail targets.
- **Interactions:** the spell-resist change (quick 260927-rsx, every foe-targeted spell resistible) and once-per-fight one-shot strikes (260927-opf) both make the game harder, so measure after they land before tuning.
- Record the before/after in docs/DIFFICULTY-RETUNE.md, with 1,000-seed readouts and a Pixel 7 play check by the user.
