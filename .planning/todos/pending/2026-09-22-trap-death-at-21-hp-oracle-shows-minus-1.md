---
created: 2026-09-22T23:45:00.000Z
title: Trap on floor 2 killed a 21-HP Elven Ninja while the Oracle showed -1 HP
area: engine-or-display (investigate first — /gsd-debug)
resolves_phase: 75
files:
  - mazeworld.html paint() / the 58-06 combat-beat HUD deferral (HUD paint waits for the beat's end)
  - engine trap resolution + its narration (EVENT_NARRATION / eventNarration.js)
---

## Problem

Reported on the Pixel 7 (2026-09-22, v1.8 debug APK d6db678), user's words: "My Elven Ninja walked into a trap with 21 hitpoints to spare, Oracle shows I took -1 hitpoint, but I died. So, -1 hp took 21 hitpoints in actuality." ... "I was only floor 2 for the trap, btw."

## Hypotheses (in order)

1. **Stale HUD HP (possible v1.8 regression).** Plan 58-06 deliberately defers the HUD's paint() until a combat beat ends ("so the top HP bar doesn't give the outcome away"). If that deferred paint is ever skipped (e.g. a beat that ends by hurry/tab switch/flee, or the over-panel path), the HUD keeps showing pre-fight HP. The player would see 21 HP while the true HP was ~1, and the trap's -1 would genuinely be fatal. Check: every path that ends a beat must repaint the HUD; add a test that HUD HP equals state HP after every beat-ending path.
2. **A trap that kills outright but narrates only its HP line** (e.g. a pit/fall or a secondary effect resolving death without its own line) — an engine or narration gap that predates v1.8 (engine is byte-identical to v1.7).
3. **Narration shows the wrong number** (-1 printed for a larger hit).

## Solution

Run /gsd-debug: reproduce with a floor-2 trap at ~21 HP via the dev start-at-depth run; read the engine event stream for the trap step; check the HUD value against state.c.wp after a fight ends by each path (settle, hurry, tab switch, flee, kill). Fix whichever it is; if (1), it is a Phase 58 regression and should be fixed before a Play push.
