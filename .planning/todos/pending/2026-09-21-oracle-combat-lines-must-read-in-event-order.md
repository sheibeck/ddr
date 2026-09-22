---
created: 2026-09-21T21:50:00.000Z
title: Oracle combat lines must read in event order, not priority order
area: ui
files:
  - src/browser/narrationLines.js:63-67 (PRIORITY — block 0 / you 1 / them 2 / feature 3 / other 4)
  - src/browser/narrationLines.js:966 (the fold sorts lines by priority, then idx — time order is the tiebreak, not the key)
  - src/browser/narrationLines.js:360-380 (the fold pipeline: enemyRound / yourRound grouping, "×N" collapsing, killFold)
  - src/browser/eventNarration.js (the Oracle's per-event HTML lines)
  - mazeworld.html:1713-1723 (Oracle opens at newest — the list is newest-first)
  - engine/combat.js:2485-2580 (riposte: foe miss → "pays" → foeKilled emission order within the foe turn)
---

## Problem

Reported on the Pixel 7 (2026-09-21, build `dbcdd66`), user's words: "Notice that the order of events just reads stranger. A Ned falls, then 2 Neds miss, then I riposted. Let's make sure the Oracle reads in order." The pasted log (newest-first, so chronologically bottom to top):

```
Ned, Ned, Ned · a Samurai never strikes first
Armour takes 6 · wear 6
Ned misses you 2 times
Initiative — Samurai honour — they go first.
Ned falls (+10 XP). ×2            ← the kills appear BEFORE…
Ned hits you 1 of 3 (2)
Ned misses, and pays 20 for it. ×2  ← …the misses that triggered the riposte…
You call Riposte.                   ← …which appears after the kills it caused
Every miss is an invitation.
+2 wilmst ×2
Dropped: Birch Staff. It will keep.
```

Cause: the Oracle reuses the RAIL/toast fold, which (a) sorts an action's lines by PRIORITY (refusals, then YOUR outcome, then THEIR outcome, then features, then other) with time (`idx`) only as the tiebreak, and (b) groups identical lines into one "×N" line placed at one position, pulling events from different moments together. That is right for a one-card summary and wrong for a chronological log. (Also worth checking: within a foe turn the engine's event order for riposte — foeMissed → riposte "pays" → foeKilled — and whether "Initiative" is emitted before the first swings it governs.)

## Solution

Give the Oracle its own ordering: keep every event line in `idx` (emission) order — no priority sort — and fold only ADJACENT identical lines ("×2" stays when two identical events are consecutive, never across an intervening event). The rail/toast summary keeps the priority fold. Newest-first stays (v1.3 ruling: opens at newest) but each action's block must read top-down in time when the reader flips it, so within one action's block write lines oldest→newest too (verify what the user expects: a newest-first list whose per-action blocks are chronological is the standard game-log shape). Add a unit test with this exact event sequence (riposte kills after the misses, Initiative before the swings). Verify the engine emits initiative before the foe swings it explains; if not, that is an engine event-order fix, declared (no draw change). UI quick task between phases, never mid-wave. Pixel 7 check: replay a riposte fight; the Oracle reads Initiative → misses → pays → falls.
