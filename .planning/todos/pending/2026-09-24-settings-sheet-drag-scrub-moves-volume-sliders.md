---
created: 2026-09-24T19:07:39.855Z
title: Dragging the settings sheet scrubs a volume slider under the finger
area: ui
resolves_phase: 78
files:
  - mazeworld.html:1647-1665
  - mazeworld.html:1939-1960
  - mazeworld.html:6598-6612
  - src/browser/settings.js
---

## Problem

Device report (2026-09-24, v2.0 build): when you drag/scroll the settings sheet and the drag
starts on one of the Phase 71 MASTER / MUSIC / EFFECTS volume sliders, the slider moves
along with the finger. Trying to scroll the sheet changes the volume.

The `.mw-vol-range` inputs are native `<input type="range">` with a 44px touch box, full width
(`width:100%`) and `touch-action:pan-y` (mazeworld.html ~1659). `pan-y` was meant to let a vertical
drag scroll the sheet, but the Android WebView still gives the gesture to the range input, so any
touchstart on the track moves the thumb. Because the three sliders span the full width, most drags
through the lower part of the sheet land on one.

## Solution

TBD. Options:
- Only move the value on a clearly horizontal gesture: track pointerdown/pointermove on the
  sliders, and when the first movement is mostly vertical, restore the start value and let the sheet
  scroll (or scroll it by hand). Commit on horizontal intent only.
- Or move only by grabbing the thumb, not by tapping or dragging on the track. Could use a custom
  slider instead of a native range input.
- Also check the same issue on any other range input or drag target inside a scrolling sheet.
Keep the Phase 71 R-02 rule: apply live during a drag, persist on release. A cancelled vertical drag
must not persist or play a preview sound.
