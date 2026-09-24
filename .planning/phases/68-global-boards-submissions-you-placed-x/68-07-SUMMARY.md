---
phase: 68-global-boards-submissions-you-placed-x
plan: 07
subsystem: browser-shell / Play Games leaderboards wiring
status: complete
tags: [pgs, leaderboards, submission-queue, placement, rail, shell, bridge]
requires:
  - 68-01 boardScores.js (leaderboardIdsFor, knownSeasons, scoreOrdersFor), content/leaderboards.js
  - 68-02 playGames.js leaderboard methods and the fake's orders option
  - 68-03 placement.js (placementLine, deferredPlacementCard, seasonDropLine)
  - 68-04 engineAdapter.js setRunRecordedListener, pgsQueue.js createSubmissionQueue
  - 68-05 globalBoards.js createGlobalBoards
  - 68-06 createBoardsPanel global / seasons / onFriendsConsent seams
  - 67-08 account controller, parkAccountCard / flushAccountCard, registerNativeChrome wiring
provides:
  - the running shell's Phase 68 wiring (queue, death listener, flush triggers, placement routing, card parking, Oracle season-drop line, panel global seams)
  - classic renderRankLine(host, placement) and the .cb-over-rank / mwrankin CSS
  - window.__mzPlacement bridge (registered in src/browser/bridge.js)
  - docs/SHELL-MODULES.md "Global boards, submissions and placement (Phase 68)" section
  - test/unit/shell-pgs.test.js
affects:
  - Phase 69 (the device batch in docs/UAT-v2.0.md; real leaderboard IDs light up the native path)
tech-stack:
  added: []
  patterns:
    - module-scope lets declared before the panel instance (TDZ-safe seams, as 67-08)
    - one rail card at a time: the second parked card follows the first by a timer after its hold
    - presentation-only bridge parcel with a fresh flag that the renderer clears after the first draw
key-files:
  created:
    - test/unit/shell-pgs.test.js
  modified:
    - mazeworld.html
    - src/browser/bridge.js
    - docs/SHELL-MODULES.md
    - test/unit/shell-account.test.js
decisions:
  - "The placement rail card also waits while the party is dead: the rail is hidden under THAT IS THAT, so a card delivered then would expire unseen. It lands at the next map landing (hideTitleScreen / roller commit / routeFromBoards flush)"
  - "showTitleScreen also resets liveDeathHash, so a rank that returns after the run is buried becomes the rail card and never draws on a later (e.g. dev) death panel"
  - "The card's newBest is true when any folded run was a new best, false only when every one was explicitly false, else null (the rank's own band), matching placementLine's null semantics"
  - "While the placement card's timer is pending, later flushAccountCard calls do not deliver it early (no card on top of the account card)"
  - "Compete OFF from signed in clears the global cache once (not once for Compete and again for the status change)"
metrics:
  duration: ~40 min
  completed: 2026-09-24
  tasks: 3
  files: 5
---

# Phase 68 Plan 07: Wire the global boards, submissions and placement into the shell Summary

A Compete-ON death now reaches the world, and the answer comes back without blocking anything. The adapter's run-recorded listener feeds the durable `ddr.pgsqueue.v1` queue. The queue flushes on sign-in, on reconnect and when the app is visible again. The DEEPEST rank fades in under the NEW PERSONAL BEST block on THAT IS THAT; runs placed by a later flush arrive as one parked rail card. The Leaderboards panel's ALL, FRIENDS and LINEAGE views read the global-boards controller.

## What shipped

**Task 1: the rank line (commits 08a6555 RED, e63ae77 GREEN)**
- Classic `renderRankLine(host, placement)`, placed right after `renderNewBestBlock`:
  - It removes any existing `#cb-over-rank`. A valid placement then gets a `p#cb-over-rank.cb-over-rank` (textContent only), inserted before `.cb-over-actions`, or appended when there is none.
  - A fresh placement gets `data-fresh="1"`, and `window.__mzPlacement` becomes the same parcel with `fresh: false`, so it fades in only once.
  - A null placement, a non-string line or an empty line adds nothing. A null host is a no-op.
- `renderCombatOver` has `if (kind === "dead") renderRankLine(over, window.__mzPlacement);` on the line directly after the renderNewBestBlock call.
- CSS:
  - `.cb-over-rank` uses the quip's mono type, colour #e8c97a and margin-top 10px.
  - `.cb-over-rank[data-fresh="1"]` uses `animation: mwrankin 600ms ease-out`, with one `@keyframes mwrankin` (opacity 0 to 1).
  - The existing blanket reduced-motion rule removes the fade. No second rule was added.
- The module sets `window.__mzPlacement = null` in the bridge init block and in `showTitleScreen`.
- `src/browser/bridge.js` registers `__mzPlacement` in alphabetical order, and the bridge table was regenerated.

**Task 2: module wiring (commits ebc591f RED, 39455cc GREEN)**
- **Imports.** Six new import lines, each on its own line. The pinned engineAdapter line is byte-identical.
- **Module state.** `let globalBoards / pgsQueue / liveDeathHash / pendingPgsCard = null` sit beside `let account`, before the panel instance.
- **Panel seams.** The panel gets three seams:
  - `global: (q) => (globalBoards ? globalBoards.view(q) : null)`
  - `seasons: () => ({ current: SEASON, all: knownSeasons() })`
  - `onFriendsConsent`, which calls `requestFriendsAccess()` and swallows any rejection.
- **IDs and dev provider.** `const pgsIds = leaderboardIdsFor({ native: pgsNative })` is built once, before the provider. The browser fake gets `orders: scoreOrdersFor(pgsIds)`.
- **Setup, after the account subscribe and before `account.boot()`:**
  - `pgsQueue = createSubmissionQueue({ storage: window.mzStorage, ... })`
  - `globalBoards = createGlobalBoards({ ..., onChange: () => boardsPanel.refresh() })`
  - `pgsQueue.load()` (not awaited)
  - `setRunRecordedListener(onRunRecorded)` and `account.subscribe(onAccountForPgs)`
  - an `online` listener that forces a flush, and a `visibilitychange` listener that runs an unforced flush when the app becomes visible.
- **`onRunRecorded`** sets `liveDeathHash`, clears the placement and enqueues. It adds no gate of its own, because the queue refuses while Compete is OFF.
- **`handlePgsFlush`**:
  - It returns when the standing is null or nothing was submitted.
  - The live entry, while `S.dead`, gets `placementLine` into `window.__mzPlacement` and a direct `renderRankLine` on `#cb-over`.
  - Every other entry folds into one `deferredPlacementCard` (count, the last hash), which goes to `parkPgsCard`.
- **`notePgsSeasonDrop`** writes `<span class="beat">…</span>` through `window.logLine`, and does nothing for a null line.
- **`onAccountForPgs`**:
  - Compete turning OFF purges the queue, clears the global cache and resets the placement, once.
  - Becoming signed in forces a flush, once per transition.
  - Leaving signed in clears the global cache.
- **Card delivery.** `parkPgsCard` works as follows:
  - The latest card wins.
  - `flushAccountCard` delivers the account card first. A placement card waiting behind it goes to a `setTimeout` for the account card's hold plus 600 ms.
  - The placement card waits while the title, the roller or the title-mode panel is up, or while the party is dead.
- **Background flush.** `registerNativeChrome`'s `waitForPending` is now `() => Promise.all([waitForPending(), pgsQueue?.waitForPending()])`.

**Task 3: docs and the full gate (commit 44b8b3d)**
- In `docs/SHELL-MODULES.md`:
  - The intro names the five Phase 68 modules.
  - The Phase 67 section now lists the bound leaderboard methods and `PLUGIN_METHODS_USED`, replacing the retired `RESERVED_LEADERBOARD_METHODS` sentence.
  - The new "### Global boards, submissions and placement (Phase 68)" section covers the encodings, the queue, the global views and panel seams, placement routing, and the dev loop.

## Verification

- `node --test test/unit/shell-pgs.test.js test/unit/shell-account.test.js test/unit/shell-boards-panel.test.js test/unit/shell-boards-entry.test.js test/unit/shell-new-best.test.js test/unit/bridge-registry.test.js test/unit/stale-terms.test.js test/unit/shell-no-content-copies.test.js`: 127/127 pass.
- `test/unit/shell-pgs.test.js` has 40 tests in 699 lines (the plan asks for at least 22 tests and 180 lines).
- `node tools/bridge-doc.mjs --check` exits 0.
- `npm test`: 5024 tests, 5017 pass, 7 fail. All 7 are the known worktree CRLF doc-ledger failures (class-pass-ledger 1057/1058/1059/1067, flee-ledger 1822/1823/1824). The failing set did not grow, and parity is green.
- The module and classic scripts were extracted and parsed with `node --check`, and both pass.
- Acceptance greps all return 1:
  - `renderRankLine(over, window.__mzPlacement);`
  - `function renderRankLine`
  - `setRunRecordedListener(onRunRecorded)`
  - `createSubmissionQueue({`
  - `createGlobalBoards({`
  - `onFriendsConsent:`
  - `function handlePgsFlush`
  - the pinned engineAdapter import line
- `git diff --stat 75d7243 -- engine/ test/parity/` is empty.
- There was no Android build, APK, AAB or device step, as the plan specifies.

## TDD Gate Compliance

Both tdd tasks went RED then GREEN: test 08a6555 came before feat e63ae77, and test ebc591f before feat 39455cc. Both RED runs failed on the missing code; Task 2's run had 29 of its 30 new tests failing. No refactor commit was needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The placement card also waits while the party is dead**
- **Found during:** Task 2
- **Issue:** The rail is hidden while `S.dead` (`railEl.hidden = !!(S.combat || S.dead) || idle`). A card for older runs, folded in the same flush as the live death, would have been handed to a hidden rail. It would then expire unseen, breaking D-12's "one rail card at that flush".
- **Fix:** Delivery also requires `window.__mzState.get().dead !== true`. The card stays parked and lands at the next map landing, through the existing flush sites. Test C5 covers this.
- **Commit:** 39455cc

**2. [Rule 1 - Bug] showTitleScreen also resets liveDeathHash**
- **Issue:** Dev deaths never call the run-recorded listener, so a stale live hash could put a buried run's rank on a later dev death panel.
- **Fix:** `liveDeathHash = null` sits beside the `__mzPlacement` reset. A rank that returns after the run is buried becomes the rail card, as PLACE-01's flagged assumption asks.
- **Commit:** 39455cc

**3. [Rule 2 - Robustness] A null card is never parked; the placement timer is never overrun**
- `handlePgsFlush` parks only a non-null `deferredPlacementCard`. For example, a rank of 0 gives no card.
- While the placement card's timer is pending, a later `flushAccountCard` call (for example from hideTitleScreen) does not deliver it on top of the account card.
- **Commit:** 39455cc

**4. [Rule 3 - Blocking] Phase 67 pins moved by the planned wiring** (test/unit/shell-account.test.js, which is not in the plan's file list)
- A2 pins the new provider line, which now includes `orders: scoreOrdersFor(pgsIds)`.
- `cardParking` declares the `pendingPgsCard` slot, because `flushAccountCard` now reads it.
- **Commit:** 39455cc

**5. [Worktree artifact] docs/SHELL-MODULES.md was saved with LF endings**
- After `--write`, the file had mixed CRLF and LF endings. It was normalized to LF, as 67-08 did. The index stays LF.

The plan did not need `test/unit/harness/shellSandbox.js`: it does not require every registered bridge to be wired, and `renderRankLine` returns before building anything when `__mzPlacement` is unset.

## Known Stubs

None. On native, the leaderboard IDs are still the 68-01 placeholders. Every board is therefore skipped silently, and the global views read "closed" until the Phase 69 Play Console setup. This is planned, not a stub.

## Threat Flags

None beyond the plan's threat model:
- T-68-12: the season-drop copy is pinned free of markup, and only a number is filled in.
- T-68-13: the rank line is drawn with textContent only.
- T-68-14: Compete OFF purges the queue and clears the cache.

## Flagged assumptions (carried from the plan)

- A rank that returns after the run's death panel has closed becomes the D-12 rail card and is not dropped.
- A placement card raised during combat is handed to the rail as usual. The dead-party wait (deviation 1) is the only addition.
- The `visibilitychange` flush respects the backoff, and the `online` flush forces one.

## Human verification (deferred to end of run)

For the Phase 69 batch (docs/UAT-v2.0.md, Pixel 7). Do not pause for these:

1. Signed in with real IDs and Compete ON, die. "You placed Nth of M." (plus the quip) appears under the NEW PERSONAL BEST block, or under the panel line when there is none, and fades in once.
2. Repeat with Android's remove-animations (reduced motion) setting on. The line appears without the fade.
3. Die in airplane mode, then relaunch online. One "THE LEDGER CAUGHT UP" rail card appears once the map shows, never over the title or the roller, and after any account card.
4. With Compete OFF, die. There is no rank line, no card, no error and no Play Games leaderboard traffic (capture).
5. On the device, check the Leaderboards panel's ALL view, FRIENDS (the SHOW MY FRIENDS consent button, and declining leaves the note) and LINEAGE, at the default and the largest text sizes.
6. In the browser dev loop, turn on the dev "simulate signed-in" setting (`pgsDevSignedIn`) and relaunch. A death shows the rank line, and ALL shows rows from the dev boards.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 (RED) | 08a6555 | test(68-07): add failing tests for the THAT IS THAT rank line and the __mzPlacement bridge |
| 1 (GREEN) | e63ae77 | feat(68-07): draw the DEEPEST rank line on THAT IS THAT through the __mzPlacement bridge |
| 2 (RED) | ebc591f | test(68-07): add failing tests for the Phase 68 queue, placement and panel wiring |
| 2 (GREEN) | 39455cc | feat(68-07): wire the submission queue, placement routing and global board seams into the shell |
| 3 | 44b8b3d | docs(68-07): document the Phase 68 global boards, submission queue and placement wiring |

## Self-Check: PASSED

- FOUND: test/unit/shell-pgs.test.js, mazeworld.html, src/browser/bridge.js, docs/SHELL-MODULES.md
- FOUND commits: 08a6555, e63ae77, ebc591f, 39455cc, 44b8b3d
