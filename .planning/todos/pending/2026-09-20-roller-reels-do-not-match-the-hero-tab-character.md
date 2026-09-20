---
created: 2026-09-20T17:30:00.000Z
title: Character roller reels do not match the character that lands on the Hero tab
area: ui
files:
  - mazeworld.html:5160-5249 (window.mzStartRoll — ONE startNewRun() up front, cosmetic Math.random() reel flicker, locks onto characterSheetViewModel(rolledState) at 900/1650/2400 ms, rollerPendingState set at 3050 ms)
  - mazeworld.html:5251+ (roller CTA click handler — commits rollerPendingState and lands on the MAP tab)
  - src/browser/viewModels.js (characterSheetViewModel — the same rng-free view model the HERO tab reads)
  - src/browser/heroTab.js (renderHeroTab — what the player actually sees afterwards)
  - src/browser/engineAdapter.js (startNewRun / the new-run entry points — any second roll on the same path is the prime suspect)
---

## Problem

User report (2026-09-20, asked while reviewing the backlog): the random character
"spinner" (the roller screen's race / class / sub-class reels) settles on one
character, but the character that then appears on the Hero tab is a different
one. Not yet reproduced or root-caused; no earlier todo, audit or UAT row
covers it.

By design (`mzStartRoll`, comments at L5188-5196) the reels are purely
cosmetic and lock, in sequence, onto the REAL sheet of the single
`startNewRun()` result held in `rollerPendingState`, which the CTA commits.
So a mismatch means one of:

1. `startNewRun()` (or another new-run entry: dev row, Play-again on the death
   screen, a back-button / resume path) runs a SECOND time between the reveal
   and the Hero tab render, replacing the state the reels showed;
2. the CTA commits a stale `rollerPendingState` (e.g. `mzStartRoll` was
   re-entered — `clearRollerTimers()` clears timers but a first roll's
   `await startNewRun()` can still resolve and race the second);
3. the reels lock on `sheet.raceLabel / classLabel / subLabel` while the Hero
   tab renders a different label for the same data (a view-model / label
   drift rather than a different character) — cheapest to rule out first.

## Solution

- Reproduce in the browser dev loop with the seed/dev row: roll, note the three
  locked reels + name, tap DESCEND, compare with the Hero tab; repeat with a
  double-tap on the roll trigger and with Play-again from a death.
- Add a source-pin / unit test that the committed state's
  `characterSheetViewModel` labels equal the reel labels shown at reveal
  (make the reel lock and the commit read the same object, e.g. lock on
  `rollerPendingState` rather than a captured `sheet`), and guard re-entry
  (ignore a resolved `startNewRun()` from a superseded roll).
- Shell-only fix; engine untouched; no fixture moves. Land as a quick task
  (`/gsd-quick`) — it is a bug, not tuning, so it sits outside the v1.7
  sequence and can go in between phases.
