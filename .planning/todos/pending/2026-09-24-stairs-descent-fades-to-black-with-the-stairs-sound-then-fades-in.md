---
created: 2026-09-24T19:08:42.196Z
title: Stairs descent fades to black with the stairs sound, then fades in on the new floor
area: ui
resolves_phase: 78
files:
  - mazeworld.html:7691
  - mazeworld.html:7791-7806
  - src/browser/sfx.js:185
  - src/browser/rail.js:292
  - src/browser/rail.js:401-414
  - src/browser/motion.js
  - sfx/stairs.mp3
---

## Problem

User request (2026-09-24): taking the stairs down should feel like a descent, not a hard cut.
Today a stairs step (engine/movement.js#move emits `floorChanged`) redraws the new floor right away.
stepWith (mazeworld.html ~7691) snaps the camera with mzCenterMap and skips the marker glide
(~7800), the `stairs` clip plays through the sfx map (src/browser/sfx.js:185 `floorChanged: "stairs"`),
and the rail shows its FLOOR n card (rail.js:292, RAIL_DIRECT). None of that has a transition.
The user wants the screen to fade to black while the stairs sound plays, then fade in on the new
level.

## Solution

TBD. Sketch:
- A full-screen black overlay over the map/HUD, shell-only. The engine is not involved: `S` is
  already on the new floor, so this is presentation only.
- On a `floorChanged` event: start the stairs clip and fade to black at the same time (match the
  clip length, about 0.4–0.6s out). Swap to the new floor's draw and mzCenterMap while the screen is
  black. Then fade in (about 0.4s).
- Block taps and moves while the transition runs (the same guard idea as the combat "lock actions
  while a round plays" work), so a queued tap-to-move path does not keep walking on the new floor
  while the screen is dark.
- Decide how the FLOOR n rail card and any card or combat that starts on arrival fit in. They
  should show after the fade-in, not under the black overlay.
- Reduced motion: follow the motion.js prefersReducedMotion rule. Skip the fade (or use a short
  dim), still play the sound, and keep the blanket reduced-motion CSS rule in mind (mazeworld.html
  ~1031).
- Decide whether teleports (`teleported`, the other jump event at ~7800) get the same treatment or a
  different one. The user only asked about stairs.
- Also check the dev start-at-depth path and a save resume, which should not fade.
