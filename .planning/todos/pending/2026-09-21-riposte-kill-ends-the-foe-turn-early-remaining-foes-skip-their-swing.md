---
created: 2026-09-21T23:15:00.000Z
title: Riposte kill ends the foe turn early — remaining foes skip their swing
area: engine
files:
  - engine/combat.js:2578-2588 (foeTurn, hero branch — `if (f.wp <= 0) { killFoe(...); break; }` after a riposte kill)
  - engine/combat.js:2485-2494 (the member-riposte twin — same `break`)
  - engine/combat.js:2270 (foeTurn), 1728 (the `foesNow.slice()` iteration — safe to `continue` over)
  - engine/combat.js:1741-1742 (useAbility "riposte" → riposteReady rounds:1)
---

## Problem

Reported on the Pixel 7 (2026-09-21, build `dbcdd66`, floor 13, Human Samurai), user's words: "a log file from the Oracle. This was an encounter. Analyze for errors so we can make sure combat is actually weighing correctly." The log (chronological):

```
An encounter. Cave Bear, Rast, Rast
Initiative — you 14, them 12. Samurai honour — they go first.
Your phobia has you shaking … Still rattled from the dark.
Cave Bear swings, 8 vs 5, and misses.
Rast swings, 7 vs 5, and misses.
4 vs 5. Rast hits you for 15 hp.
You call Riposte.  /  Every miss is an invitation.
Cave Bear swings, 7 vs 5, and misses.
Cave Bear misses, and pays 37 for it.
Cave Bear falls. +20 XP.
+1 wilmst.  /  Cedar Staff.  /  +1 ration.
```

Round 1 is correct (one swing per foe — the Phase 52 cadence fix holds; roll-under-5 consistent; the Samurai's "they go first" overrides a won initiative by design). Round 2 is not: after the riposte kills the Cave Bear, the two Rasts never swing. Cause: `foeTurn`'s hero branch `break`s out of the foe loop on a riposte kill (and the member branch does the same), so every foe after the killed one loses its attack that round. A riposte kill is therefore worth a free round from the rest of the pack — a hidden hero advantage that also sits inside the tuning bot's runs (Samurai/riposte carriers), and one that the fit is unknowingly compensating for.

Everything else in the log reads right; the economy note (+1 wilmst for a Cave Bear vs 300 × depth for a red-dot cache) is already the wilmst-cache todo.

## Solution

`break` → `continue` at both sites (the loop already iterates a `slice()` copy, so mutation is safe), guarded by an `if (!liveFoes(state).length) break;` so a kill that ENDS the fight still stops the turn. Phase 38's own comment says `abilityEffectActive` is false on every fixture, so the expected moved set is zero — measure with the fixture scan anyway and declare. Unit test: three foes, riposte up, the first misses and dies → the other two still roll their swings that round. Engine quick task (rules correction, BAND-02-adjacent); like the HP-dot fix it changes the bot's ground — sequence it as a USER RULING F engine adjustment before the next fit cycle if the user agrees, otherwise right after 54-07. Pixel 7 check: replay a riposte kill in a 3-foe fight; the survivors still swing.
