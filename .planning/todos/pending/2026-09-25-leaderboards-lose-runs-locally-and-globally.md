---
created: 2026-09-25T01:10:00.000Z
title: Leaderboards lose runs — a depth-10 run missing from my own DEEPEST board, a friend's depth-11 score missing from the global board
area: ui
resolves_phase: 81
files:
  - engine/records.js:315 (updateBests — the local bests record each ME board lists from)
  - engine/records.js:398 (backfillBests), :420 (sortGraveyard)
  - src/browser/engineAdapter.js:415, :457 (the two updateBests call sites — death path(s))
  - src/browser/pgsQueue.js:386 (submit queue → provider.submitScore)
  - src/browser/playGames.js:344 (submitScore wrapper), loadTopScores
  - src/browser/globalBoards.js:80 (the `you` playerId match — see BOARD-09)
  - src/browser/boardsView.js (standing card / "not in the top ten")
---

## Problem

Device reports from the user and a friend (2026-09-25, published 2.0.0 build), in the user's words: "My friend got to depth 11 and it still showed him as not in the top 10, even though the only other person on the board was me at depth 9. This was the deepest board. He saw my entry on the board, but I couldn't see his, and he should have been ranked 1. Then I finished another run where I got to depth 10, and that character of my own didn't even show up on my own boards anywhere but the graveyard. It didn't show up at all on the DEEPEST board. So, something isn't working right with recording and viewing the leaderboards."

There are three symptoms, and they may share a cause:

1. **A LOCAL recording gap.** The user's depth-10 run appears in the Graveyard but not on their own local DEEPEST board, where it should be #1 above the depth-9 run. So the run history (graves) was written, but `updateBests` either didn't run on that death path or didn't rank the run. Possible causes: a death path that skips `updateBests` (the two call sites in engineAdapter.js ~L415/L457), a run-hash dedupe collision, a summary field that fails to validate, or a prune/sort bug.
2. **A GLOBAL submission or visibility gap.** The friend's depth-11 score never appears on the user's ALL DEEPEST board, while the friend does see the user's depth-9 entry. Either the friend's submission never reached Play Games (the queue in pgsQueue.js, a Compete/sign-in state, a placeholder or wrong-season leaderboard ID, a rejected score encoding) or the user's client shows a stale cached snapshot.
3. **The "not in the top ten" card.** On the friend's device it says he isn't in the top ten even though he'd be #1 of two. This is probably the BOARD-09/10 `you`/`playerId` matching bug; it also fits symptom 2 if his score never landed.

## Solution

Treat it as a `/gsd-debug` investigation at the start of Phase 81, before any fix:

- **Local:** replay the exact death path of a depth-10 run through the real `engineAdapter` and storage, and assert it lands on every ME board it qualifies for. Pin that with a test for every death path (combat death, trap death, starvation, Abandon, Save & quit then death).
- **Global:** trace a submission end to end (queue → `submitScore` → the Play Games response, logged) and a fetch (`loadTopScores` for the public collection, the time span and the cache/stale policy). Check the Season-1 leaderboard IDs the build carries and the score encoding's `scoreOrder`. Verify with two signed-in accounts on real devices; this is a deferred-UAT device check.
- **Standing card:** fixed under BOARD-09/10. Re-check it against this report.
