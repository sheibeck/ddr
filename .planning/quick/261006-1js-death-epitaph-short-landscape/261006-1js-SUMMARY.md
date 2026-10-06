---
quick_id: 261006-1js
slug: death-epitaph-short-landscape
date: 2026-10-06
status: complete
commits: [9f443b43]
key-files:
  modified:
    - mazeworld.html
    - tools/layout-check.mjs
    - test/unit/layout-check.test.js
---

# Quick 261006-1js: The death screen keeps its epitaph in short landscape windows

**One-liner:** On the death panel `#cb-mid` (the epitaph block) no longer shrinks to zero; it keeps its natural height and `#enc-body` scrolls the whole column (epitaph, Earned strip, hint, buttons).

## Cause

`#enc-body` is a flex column with `overflow:auto`. `.cb-mid` is `flex:1; overflow:auto; min-height:0`, so when the Earned strip, hint and three buttons in `#cb-over` were tall (960 x 540), the flex algorithm shrank `.cb-mid` to 0 and the epitaph, floor line and cause-of-death line vanished.

## What changed

### CSS and markup (`mazeworld.html`)
- `renderCombatOver` adds the class `cb-mid-dead` to `#cb-mid` when `kind === "dead"` (win, soothed and fled panels are untouched).
- New rules next to `.cb-mid`:
  - `.cb-mid.cb-mid-dead{flex:none;overflow:visible;min-height:auto}` gives the epitaph block its natural height and no inner scroller.
  - `#enc-body>.cb-over{flex:none}` stops the lower block shrinking either.
- The Earned strip keeps its own `max-height:9.5em` inner scroll, unchanged. Both buttons are reachable by scrolling `#enc-body`.

### layout-check (`tools/layout-check.mjs`)
- `death-earned` scene (`measureEarned` / `earnedFailures`) now asserts: `#cb-mid` has positive height, the epitaph block is at least 20 px with at least 3 lines (cut-down line, floor line, epitaph/"Cause of death" line), the `.cb-epitaph` line is visible, non-empty and inside the scrolled content, `#cb-mid` is not a nested scroller, `#enc-body` can scroll when it overflows, and the last death button lies inside the scrolled content.
- New profile `tablet7-landscape-short` (960 x 540, class expanded): the 7" landscape tablet window that showed the bug. 13 profiles now (header comment updated).
- The generic "scroller out of window" check now skips a scroller whose own box is horizontally in the window and that sits inside a panel that itself scrolls (the Earned list below the fold of the scrolled death panel). Without this the strip's own scroller was rejected once the panel scrolled as a whole.
- Red check: with the CSS disabled the 960 x 540 scene fails ("#cb-mid collapsed to zero height", "nested scroller"); with the fix it passes.

### Test (`test/unit/layout-check.test.js`)
- Profile pin moved from twelve to thirteen, the new profile and its 960x540 size pinned (declared change).

## Verification
- `LAYOUT_CHECK_BOOT_MS=240000 npm run layout:check`: 13/13 profiles (18/18 scenes each), 7/7 boundary probes.
- 960x540 screenshot `tools/layout-check-output/tablet7-landscape-short-death-earned.png` read: "cut down by a a rat." line, "Floor 1 - day 1 - 0 XP", "Cause of death: ..." epitaph, then THAT IS THAT and the Earned strip. Epitaph shown.
- Targeted tests (achievement-banner-shell, death, death-copy, final-sheet, layout-check, layout-shell, shell-tab-snapshots, reduced-motion, text-scale, permadeath): 169 tests, 169 pass, 0 fail. No snapshot moved.

## Deviations
- [Rule 3] Added the 960x540 profile and loosened the generic out-of-window scroller check (needed so the whole-panel scroll passes); test pin updated accordingly.
- Seen in the screenshot, not touched: the line reads "cut down by a a rat." (double article from the `deathNote` template with the layout-check's foe string "a rat"; the check passes a pre-articled foe). Pre-existing and a check-fixture artifact.

## Device row (deferred)
On a 7" landscape window (emulator): die, read the epitaph, scroll to reach BURY THEM.
