---
created: 2026-09-25T00:00:00.000Z
title: Setting to choose tap-to-move or an on-screen arrow pad (bottom-left or bottom-right)
area: ui
resolves_phase: 78
files:
  - src/browser/settings.js (settings schema, e.g. textSize S/M/L at ~L78/L101 — add movement + pad-side keys)
  - mazeworld.html:5657-5706 (keepPartyInView — the "stationary camera" edge rule; must treat the pad's rect as a visible edge)
  - mazeworld.html:~7697 (stepNow(dir) — the one-step move entry the pad would call)
  - mazeworld.html (map tap handler — disabled entirely in arrow mode)
---

## Problem

User, 2026-09-25: "let's look at adding a setting to choose between click to move and arrow key movement. When choosing arrow key movement show choosing whether the arrows show in the bottom left or bottom right of the map. When arrow keys are enabled, click to move should be entirely disabled. It's ok for the arrow keys to fit over the map, we just need to make sure that as the party approaches the arrow keys we include their position when determining to auto scroll the map."

This reverses the standing "tap-to-move only, no D-pad" ruling (v1.4/v1.5) for an opt-in mode. Tap-to-move stays the default.

## Solution

- **Settings:** a Movement choice, TAP TO MOVE (default) or ARROWS. When ARROWS is picked, a second choice appears: pad on the BOTTOM LEFT or BOTTOM RIGHT of the map.
  - Both are stored in the settings record with a tolerant load; an unknown value falls back to tap-to-move.
- **Arrow mode:**
  - A 4-way on-screen arrow pad overlays the map in the chosen bottom corner.
  - Each press takes one step through the same `stepNow(dir)` path a tap step uses, so there's no second movement path.
  - Map taps no longer move the party at all: tap-to-move is ENTIRELY disabled. Map marks and other non-movement map taps keep working unless they conflict.
  - Reduced motion and haptics follow existing conventions. It's operable by TalkBack, with labels like "Step north".
- **Auto-scroll:** `keepPartyInView()` counts the pad's on-screen rect as an edge. When the party nears the pad it scrolls as if the pad were the map's border, so the party is never hidden under the pad. The pad may overlap the map otherwise.
- The dead state (HUD-02), the combat screen and open sheets disable the pad the same way they disable map taps.
- This is presentation/shell only: the engine already takes one-step moves, so there are no fixture moves.

**Open for the phase discuss:**
- Pad size at text sizes S/M/L.
- Hold-to-repeat vs one step per press (recommend one step per press, for tap-to-move parity).
- Whether hardware keyboard arrows also work (useful on Chromebooks; Phase 80's large-screen work).

**Pixel 7 checks:**
- Switching modes live.
- The pad in each corner.
- Tapping the map does nothing in arrow mode.
- Walking toward the pad scrolls the map before the party slips under it.
