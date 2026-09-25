# Phase 81: Leaderboards Panel Fixes - Context

**Gathered:** 2026-09-25 (rulings 2026-09-24/25 from roadmap approval and captures; order and hunt accepted 2026-09-25)
**Status:** Ready for planning

**RUN ORDER (user accepted 2026-09-25):** Phase 81 runs NEXT, right after Phase 72 closes and ahead of the roll-high track (73–80). It depends on nothing, and it fixes live Play bugs hurting players now. The autonomous run then resumes at Phase 73 in numeric order.

<domain>
## Phase Boundary

The Leaderboards panel shows the signed-in player accurately, filters every board by ME | ALL | FRIENDS, drops the boards Play Games cannot back honestly (GRAVEYARD, LEANEST; LINEAGE becomes ME-only), and never loses a run locally or globally. This covers BOARD-09..17.

It is shell-only, apart from `engine/records.js`'s board list and bests (no parity fixtures carry them; confirm with the fixture scan).

**Not in scope:**
- Per-sub-class global boards and a global LINEAGE (backlog 999.11, to be promoted as its own milestone).
</domain>

<decisions>
## Implementation Decisions

### Scopes, tags and defaults (user rulings 2026-09-24)
- **BOARD-12:** three scope chips, **ME | ALL | FRIENDS**, and every board can be viewed under each. ME is the player's own local runs (today's hidden `"local"` scope). Signed out or Compete OFF: ALL and FRIENDS show today's sign-in note, and ME is the default.
- **BOARD-11:** signed in with Compete ON, the panel opens on **ALL** (today `boardsView.js:911` defaults to `"local"`).
- **BOARD-09:** on ALL and FRIENDS the signed-in player's own score is tagged **YOU**, never FRIEND. ROOT-CAUSE the `playerId` mismatch (`globalBoards.js:80`: `you = playerId !== "" && playerId === me`) rather than papering over it, e.g. by comparing display names.
- **BOARD-10:** the "not in the top ten / your best run" standing card appears ONLY when the player is ranked but off the visible list. It never appears when their row is already shown (device: sole entry, rank #1, shown twice).
- **BOARD-13:** LINEAGE is ME-only. Its tab shows only while ME is selected, it moves to the END of the board rail, and it never reads the global DEEPEST sample. (Play Games keeps one best score per player per board, so a global lineage view can't be honest.)
- **BOARD-14:** remove GRAVEYARD (tab, copy, view branch), because ME covers it. ME rows keep each run's tap-to-expand details, epitaph included. The stored run history still feeds ME and LINEAGE, and old saves load tolerantly.
- **BOARD-17:** remove LEANEST everywhere:
  - `engine/records.js` (`BOARD_IDS`, `RANKED_BOARDS`, `compareRuns`, bests);
  - `src/browser/boardScores.js` (`SUBMIT_BOARDS`, `SCORE_ORDER`, `boardScore`, `scoreFallback`);
  - `content/leaderboards.js`, `content/boards.js`, the rail, and `docs/PLAY-GAMES-SETUP.md` §7.
  - An old `ddr.bests.v1` with a `lean` list, and queued `pgsQueue` entries with a `lean` score, load tolerantly with the `lean` part DROPPED and never submitted.
  - After the update ships, the user deletes the Season-1 LEANEST board (`CgkIlvbN0YYPEAIQAw`) in Play Console. Add it to the release notes and checklist.

### The live-bug hunt — BOARD-15/16 (user accepted 2026-09-25)
- **Plan 1 is a root-cause session (debug first, fix after):**
  - **BOARD-15, runs lost locally:** trace every death path into `updateBests`: combat, trap, starvation, abandon, a resumed save and a relaunch-after-death. The call sites are `engine/records.js:315` `updateBests`, `backfillBests` :398, `sortGraveyard` :420, and `src/browser/engineAdapter.js:415/457`. The device report: a depth-10 run showed in the Graveyard but NOT on the player's own DEEPEST board above their depth-9 run. A test pins each death path.
  - **BOARD-16, scores lost globally:** trace submit → Play Games → fetch end to end. The submit side is the `pgsQueue` queue/flush (`pgsQueue.js:386`), the provider response, the leaderboard ID, the score encoding and tag (`scoreTag.js`), and `playGames.js:344` `submitScore`. The fetch side is `loadTopScores`: the collection (PUBLIC vs FRIENDS), time span (ALL_TIME), and cache staleness/force-refresh. The device report: the friend's depth-11 DEEPEST never showed on the user's ALL board, while the friend saw the user's depth-9 entry.
  - If device logs (logcat) are ESSENTIAL to pin BOARD-16, the plan asks the user for ONE short adb session (re-pair recipe in memory). That is the only allowed pause. Otherwise it's code trace plus unit and integration tests.
- The fix plans depend on the confirmed root causes. BOARD-16's fix is confirmed with TWO signed-in devices (the user + a friend) in the milestone-close checklist.
- **Shipping:** as soon as Phase 81 lands, OFFER a Play internal-testing push of a versionCode-bumped signed AAB (standing ask-first rule), so the user and a friend can re-test on real accounts before milestone close.

### Claude's Discretion
- The chip visuals (within the parchment UI), the offline handling for ALL/FRIENDS when signed in but offline, the migration shape for removed boards, and plan split. The debug plan comes first; the UI scope/LINEAGE/GRAVEYARD/LEANEST work can run in parallel with it.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/browser/boardsView.js` (scope default L911; the standing card), `src/browser/boardsPanel.js`, `src/browser/globalBoards.js` (L80 the `you` match), `src/browser/boardScores.js`, `src/browser/pgsQueue.js` (L386), `src/browser/playGames.js` (L344 `submitScore`, `loadTopScores`), `src/browser/scoreTag.js` (`TAG_SUBS`, `classOfSub`).
- `content/boards.js`, `content/leaderboards.js`.
- `engine/records.js` (`BOARD_IDS = ["deep","lean","combo","days","kills","purse","yard"]`, `updateBests` :315, `backfillBests` :398, `sortGraveyard` :420).
- `src/browser/engineAdapter.js` (:415/:457 `updateBests` call sites).
- The todo: `.planning/todos/pending/2026-09-25-leaderboards-lose-runs-locally-and-globally.md`.

### Established Patterns
- Play Games keeps one best score per player per leaderboard, and a score tag can't be filtered server-side.
- The account lives in the ☰ button (standing ruling). Old saves load tolerantly.

### Integration Points
- `docs/PLAY-GAMES-SETUP.md` §7 and `docs/RELEASING.md` for the push.
- The milestone-close checklist (two-device confirmation).
</code_context>

<specifics>
## Specific Ideas

- The user's device reports (2026-09-24/25):
  - "shows 'Friend' as the label on the leaderboard, then shows my entry again beneath the 'not in the top ten your best run'";
  - "when we are connected … default to 'All'";
  - "My friend got to depth 11 and it still showed him as not in the top 10 … He saw my entry on the board, but I couldn't see his";
  - "that character of my own didn't even show up on my own boards anywhere but the graveyard".
</specifics>

<deferred>
## Deferred Ideas

- Per-sub-class global DEEPEST boards (24 boards, created by script) and a global LINEAGE → backlog 999.11, its own milestone.
</deferred>
