---
created: 2026-09-21T20:05:00.000Z
title: Map chip strip is a reserved band above the map, not an overlay
area: ui
resolves_phase: 57
files:
  - mazeworld.html:338-342 (.mw-map-chips absolute overlay, z-index 3 over the viewport)
  - mazeworld.html:1415-1420 (MARKS / CENTRE / gap / MAKE CAMP / settings gear chips inside the viewport)
  - mazeworld.html:3982-3983 (keep-in-view nudge uses rect.width/height of the full viewport)
  - src/browser/controls.js:135 (keepInViewAxis — span is the whole viewport, the chip band is not subtracted)
---

## Problem

Reported on the Pixel 7 (2026-09-21, identity-model build `dbcdd66`), user's words: "clicking on marks, center, make camp or settings moves the party on the map. Plus, we're not accounting for that space when we adjust the map as we get too close. Can we make that space a reserved space that is outside the map, like a secondary header just under the chits."

Two symptoms, one cause — the chip strip (`.mw-map-chips`: MARKS, CENTRE, MAKE CAMP, the settings gear) is an absolutely-positioned overlay INSIDE `.mw-maze-viewport`, painted over the canvas:

1. A tap on a chip also reaches the canvas's tap-to-move handling — the party moves toward the cell under the chip as well as (or instead of) the chip firing. (Phase 33/35 chrome: the chips sit at `top:10px` over live map cells.)
2. The keep-in-view nudge (`keepInViewAxis(cam, party, rect/CELL)`) measures the whole viewport, so the "within 2 cells of an edge" rule counts cells hidden under the chip band as visible — the party can walk up under the chips before the camera nudges.

## Solution

Make the chip strip a real layout band, not an overlay: a secondary header row directly under the tab chits (`.mw-map-heading-row` area), outside `.mw-maze-viewport`, so the canvas starts below it. Then (a) chip taps never overlap canvas cells (no hit-test special-casing needed), and (b) `rect` in the keep-in-view call is the true visible map, so the nudge threshold is honest at the top edge. Keep the Phase 35 chip look (`.mw-map-chip`) and the MAKE CAMP / gear placement (gear stays right of MAKE CAMP per the v1.4 ruling); drop `position:absolute` / `z-index:3` on `.mw-map-chips`. Check the rail overlay todo (2026-09-19) for the same "overlay vs layout" decision so both land consistently. Quick task between phases — never mid-wave (executors edit `mazeworld.html`). Pixel 7 check: tap each chip with the party 1–2 cells below it, confirm no movement; walk the party to the top edge, confirm the nudge fires with the strip fully clear of the map.

## Resolved

Resolved by Phase 57 plan 01 (the chip strip carved out of `.mw-maze-viewport` into its own layout band).
