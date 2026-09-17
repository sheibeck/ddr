---
created: 2026-09-17T20:39:45.077Z
title: Stand up the "Shell Debt & Dead Code" cleanup milestone after v1.5
area: planning
files:
  - .planning/proposed-milestone-shell-cleanup.md
  - mazeworld.html:1-7971
  - src/browser/toasts.js:40-99
  - engine/derived.js:64
  - engine/state.js
  - src/browser/tutorial.js
---

## Problem

The shell (`mazeworld.html`, 7,971 lines) still defines the entire pre-extraction prototype engine (16 dead mirrors: `castSpell`, `parley`, `startCombat`, `genFloor`, `rollCharacter`, `descend`, `killFoe`, `foeTurn`, …) beside the real `engine/`, plus a drifted duplicate content table (`SUB_NOTE`, 13 rows out of sync with `content/flavor.js`). `src/browser/toasts.js` keeps a misleading name and dead lifetime exports after toasts were retired as a UI concept (Phase 35); `winGame`/`state.won` are unreachable; `tutorial.js` is unreferenced. Phase 37 added two dual-path hedges (`wornSlots` run option, two-path `eff()`) that the 2026-09-17 greenfield ruling now says should collapse to one path.

## Solution

Full write-up in `.planning/proposed-milestone-shell-cleanup.md` (5 candidate phases: retire the classic engine → rename/dead exports → collapse the Phase 37 hedges → shell modularisation → measure-first perf pass). Stand it up with `/gsd-new-milestone` after v1.5 closes and its Pixel 7 UAT batch is done, before the UX-06 tutorial / production-launch tail. No research pass needed.
