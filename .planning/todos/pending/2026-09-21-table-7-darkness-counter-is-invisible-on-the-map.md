---
created: 2026-09-21T23:25:00.000Z
title: Table-7 Darkness counter is invisible on the map (no dimming, cumulative fog)
area: ui
files:
  - engine/encounters.js:685-712 (fallDark — paints a 4-square radius dark + sets c.darkFor = 30 steps; a lit torch resists)
  - engine/derived.js:794-798 (inDark — tile.dark OR c.darkFor > 0) and 824 (revealRadius — 1 in the dark without Night Vision, +sight)
  - engine/movement.js:353 (reveal(f, revealRadius(state)) — fog is cumulative, never re-hides), 427-447 (darkFor tick; eff("light") dispels it outright — Amulet of Light)
  - mazeworld.html:1981-1985 (draw — only tile.dark dims a cell; nothing reads c.darkFor), 3706-3717 (the torch offer card)
  - mazeworld.html:1386-1391 (.mw-cond-strip — condition chips; no darkness chip today)
---

## Problem

Reported on the Pixel 7 (2026-09-21, build `dbcdd66`, Human Thief Acrobat), user's words: "The dark closes in around you / Table 7, roll 8: Darkness … it's the second time I've seen it come up, but the limited vision that reduces squares seen didn't take effect. When I enter darkened paths though, the limited vision does take effect. … It looks like I'm in the dark, but it's not limiting my vision."

Two things combine:
1. **Gear/skill can cancel it silently** — the Amulet of Light (`eff light`) clears `c.darkFor` on the next step ("darknessDispelled") and its `sight +1` restores radius 2 even on dark tiles; a lit torch resists the roll; Night Vision waives the shrink. (To confirm for this run: does the Acrobat carry any of these? The sub-class itself has no darkness perk.)
2. **Without gear the condition has no visible form.** `fallDark` paints a 4-square patch and sets a 30-step counter; the counter only shrinks the reveal radius from 2 to 1 for NEW cells — fog-of-war is cumulative, so already-seen corridors look identical — and `draw()` dims only `tile.dark` cells, never the counter. Natural dark paths look limited because their tiles are painted dim, not because vision is smaller. Net: a "persistent darkness" the player cannot see or track, only feel in combat (to-hit penalty).

## Solution

Give `c.darkFor` a face: (a) while the counter runs, tighten the map vignette / dim every cell beyond the current reveal radius (so the 1-radius limit reads on screen even in explored corridors) — shell only, reads `inDark(state)`/`revealRadius(state)` via the existing bridge; (b) a condition chip in `.mw-cond-strip` ("DARK · 23 steps", tap → explanation card, torch offer if carried); (c) narrate the cancel cases ("the amulet drinks the dark" already exists as darknessDispelled — make sure it surfaces as a toast). Engine untouched (the rules already work; this is legibility). Decide with the user whether the counter should ALSO re-fog cells beyond radius 1 (a rules change — declare + fixtures) or stay reveal-only. UI quick task between phases, never mid-wave. Pixel 7 check: roll Darkness without light gear — the map visibly closes to radius 1 for 30 steps and the chip counts down; with an Amulet of Light the chip clears on the next step with a line.
