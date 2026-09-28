---
phase: 81-leaderboards-panel-fixes
status: passed
verified: 2026-09-25
verifier: orchestrator (deferred-UAT protocol; gsd-verifier disabled in config)
score: 9/9 requirements
human_verification:
  - "Signed in with Compete ON, the Leaderboards panel opens on ALL; the ME | ALL | FRIENDS chips switch every board; signed out or Compete OFF it opens on ME and ALL/FRIENDS show the sign-in note"
  - "On ALL and FRIENDS your own score reads YOU, never FRIEND, and appears once — no duplicate under the 'not in the top ten' divider when you are already listed"
  - "The standing card appears only when you are ranked but off the visible list; when Play Games hides your score (gameplay activity not shared publicly) the panel says so honestly"
  - "Two signed-in devices (you + a friend): after a run and reopening the panel, each sees the other's score on ALL, and each own row reads YOU (BOARD-16 backstop truth)"
  - "Under ME the rail ends LINEAGE, GRAVEYARD; neither appears under ALL/FRIENDS; GRAVEYARD lists every stored run (newest 60) with tap-to-expand epitaphs; VIEW THE DEAD opens GRAVEYARD"
  - "LEANEST is gone from the rail; an old save with LEANEST bests and queued runs loads cleanly and nothing is submitted to it"
  - "A new deeper run lands on ME DEEPEST above older ones (a depth-10 run tops a depth-9); if the earlier missing depth-10 run's gravestone is still stored, it reappears on ME DEEPEST after the update's first launch"
  - "After the update ships: delete the Season-1 LEANEST board (CgkIlvbN0YYPEAIQAw) in Play Console per docs/PLAY-GAMES-SETUP.md §13 (leave it if the console refuses)"
---

# Phase 81: Leaderboards Panel Fixes: Verification

**Verdict:** passed on automated evidence. The device checks above need a signed-in Play Games build, so they're batched for the post-phase internal-testing push and the milestone-close checklist.

## Requirement coverage

| Req | Evidence (plans) | Status |
|-----|------------------|--------|
| BOARD-09 | 81-01 root cause: the plugin omits `scoreHolder`, so a playerId-only match never resolves. 81-06 `isOwnRecord` keys YOU on the player's own leaderboard record | ✓ (device deferred) |
| BOARD-10 | 81-06 pin rule: pinned only when the own rank exceeds every listed rank. R-10 pin green | ✓ (device deferred) |
| BOARD-11 | 81-04 `defaultScope()` / `scopePicked`: ALL when signed in with Compete ON | ✓ |
| BOARD-12 | 81-04 ME / ALL / FRIENDS chips on every board | ✓ |
| BOARD-13 | 81-04 LINEAGE is ME-only at the rail's end; global LINEAGE view deleted | ✓ |
| BOARD-14 | Reversed by the user (2026-09-25): GRAVEYARD kept as a ME-only board beside LINEAGE (`ME_ONLY_BOARDS`), with docs corrected | ✓ |
| BOARD-15 | 81-01 six death paths pinned; verdict DEVICE-ONLY (non-atomic `persistGrave` writes). 81-05 `reconcileBests` boot backstop | ✓ (device deferred) |
| BOARD-16 | 81-01 confirmed R-16a/b/c. 81-06 `forceReload` + `invalidate()` on flush and panel open, queue un-wedge, honest hidden-score note | ✓ (two-device check deferred) |
| BOARD-17 | 81-02 `RETIRED_BOARDS`, four-board records/submission, tolerant load. 81-03 docs and §13 | ✓ |

## Automated gates

- Full `npm test` on master after the final merge (1576cad): **5706/5706 pass, 0 fail, 0 todo**. All seven 81-01 bug pins are green.
- `npm run boot:check`: PASS (no-uncaught, painted, graves, title).
- Engine gate: the parity suite is green and no fixture moved; `prototype-master.js.txt` is untouched.
- Deviations are documented in the SUMMARYs:
  - 81-04 landed its three tasks in one code commit.
  - 81-06 rewrote four draft pins to test the confirmed defect.
  - Two wave-merge conflicts were resolved in REQUIREMENTS.md.
