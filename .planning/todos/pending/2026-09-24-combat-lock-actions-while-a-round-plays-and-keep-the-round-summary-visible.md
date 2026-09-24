---
created: 2026-09-24T09:45:00.000Z
title: Combat — lock actions while a round plays out, and keep the round summary visible with many foes
area: ui
files:
  - mazeworld.html (renderEncounter / the combat screen, the round "beats" playback, the STRIKE / action buttons)
  - src/browser/ (combat view / beat-playback module, if split out; Phase 63's action sheet + combat lock)
  - .planning/phases/999.5-* (backlog: "Combat screen & Oracle readability" — related items live there)
---

## Problem

From the user's Pixel 7 session on 2.0.0 (2026-09-24):

1. **Spam-tappable STRIKE:** "while resolving a combat round (when the combat text is rendering) it seems like I'm able to spam the strike button, but it doesn't actually do anything until the current combat round resolves." The buttons look live while the round's beats are still playing, so taps are either swallowed or queued. Neither is signalled.
2. **Round summary pushed below the fold:** "when we're fighting multiple enemies, the combat text is pushed below the fold. I wonder if we can find a way to make the round summary more visible, but not intrusive."

## Solution

TBD. Hints:
- **(1) Input lock:**
  - While beats are playing, the combat actions render visibly disabled: dimmed, `aria-disabled`, no press feedback, and one clear "resolving…" affordance, not a spinner.
  - They re-enable the moment the round settles.
  - Decide whether a tap during playback should fast-forward the round (skip to the result), as a tab switch or the ☰ already does (Phase 70 R-C). That's a common roguelike convention and fits "not intrusive".
  - Make sure no tap is queued and replayed after the round, and pin that with a test.
- **(2) Visibility with many foes:**
  - The foe list grows with the enemy count and pushes the round text off-screen.
  - Options:
    - (a) Collapse the foe cards into a compact multi-foe strip (one line each: name, HP bar, status) above the round text.
    - (b) Pin the latest round summary in a fixed band just above the action buttons, keeping the full log scrollable above it.
    - (c) Auto-scroll the round text into view after each round.
  - (b) is the least intrusive and always visible. Prototype it against the design language, and check at text size L with 3+ foes.
- Presentation only, engine untouched. Check the backlog item 999.5 (Combat screen & Oracle readability) and fold overlapping items together.
- Device check: multi-foe fight on the Pixel 7 at M and L; spam STRIKE during a round.
