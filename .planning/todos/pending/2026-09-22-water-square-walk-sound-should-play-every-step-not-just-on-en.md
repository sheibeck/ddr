---
created: 2026-09-22T22:52:00.000Z
title: Water square walk sound should play every step, not just on entering
area: audio
files:
  - src/browser/sfx.js:179-185 (groupEntriesForDispatch — the synthesized step
    clip: pushes the "water" group only when a "waded" event is present in
    the dispatch's event list, so it fires on the step that crosses INTO
    water, not on every subsequent step taken while still standing on water)
  - src/browser/sfx.js:59 (the "water" clip group: walk-water1/2/3)
---

## Problem

Reported on the Pixel 7 (2026-09-22, Phase 60 device session), user's words: "When you walk on a water square it should always play a water sound, not just on entering."

The current behaviour plays the walk-water clip only on the step that enters a water square (`groupEntriesForDispatch` pushes the "water" entry only when the dispatch's events include a `"waded"` event, which fires on the crossing step). Every subsequent step taken while still on a water square instead falls through to the ordinary "walk" clip (or no step clip at all, if a `waded` event isn't re-emitted for staying put), so a multi-step walk through a pool only sounds wet on its first splash.

## Solution

Every step whose destination square is water should play the walk-water clip, not just the step that first enters it. The fix likely needs the step-clip synthesis in `groupEntriesForDispatch` (or its caller) to check the character's/party's current-square terrain directly, rather than gating on a one-shot `"waded"` event that only fires on the transition. Confirm the transition step still plays its own splash (either the same water clip, or a distinct "enter water" clip if the design wants a differentiated first-step sound) and that leaving water on the following step correctly falls back to the ordinary walk clip. Post-milestone quick task (audio, presentation-only — no engine change expected, since terrain is already known at dispatch time).
