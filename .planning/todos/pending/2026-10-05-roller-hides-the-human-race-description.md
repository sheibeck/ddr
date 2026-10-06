---
created: 2026-10-05T23:30:00.000Z
title: Roller hides the Human race description
area: ui
target: after 2.5.0 (user, 2026-10-05)
files:
  - src/browser/roller.js:102
---

## Problem

User, 2026-10-05, on the v2.5 debug build: "when rolling a new class, sometimes it's not displaying my race description. Happened twice now. Currently, human bard is showing Bard, but not a human description."

`fillRules` in `src/browser/roller.js` (line ~102) adds the race group only when `footerLines("race", race)` has a `Good:` or `Bad:` line. That gate is a Phase 79 (VOX-04) ruling: "Human's neutral line adds nothing a new player needs at the roll". Human's footer has neither, so a Human hero never shows a race description. Since Phase 97.1 (Flavour Only) the roller shows each identity's flavour line instead of the footer, and Human has its own flavour line, so the old gate now hides real copy. "Sometimes" is likely "whenever the race is Human"; confirm no other race is affected.

## Solution

Show the race group for every race that has a flavour line, Human included: gate on the flavour line existing, not on the footer's Good/Bad lines. Update the roller tests that pin the Human exclusion (declared re-pin) and check the roller layout still fits in the short layout class. Shell-only quick task; no engine change.
