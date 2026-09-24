---
phase: 68-global-boards-submissions-you-placed-x
plan: 06
subsystem: leaderboards-panel
status: complete
tags: [leaderboards, play-games, global-boards, seasons, view-model, panel]
requires:
  - 68-01 (scoreTag decodeTag, boardScores scoreFallback)
  - 68-03 (BOARDS_PANEL_COPY.global, GLOBAL_STANDING_LINES)
  - 68-05 snapshot contract (GlobalSnapshot / GlobalEntry, consumed as plain data)
  - 67-04 (identity() seam, signed-in strip)
provides:
  - boardsView inputs global / season / seasons; header.season { label, picker }; body kind "consent"; nullable standing
  - buildGlobalRows, buildGlobalLineageRows, buildGlobalStanding, globalCause (boardsView internals)
  - createBoardsPanel seams global({ board, scope, season }), seasons() -> { current, all }, onFriendsConsent()
  - BOARDS_CLASSES + CSS for mw-bd-season, mw-bd-seasons, mw-bd-season-chip, mw-bd-consent
affects:
  - 68-07 (wires global: globalBoards.view, seasons: knownSeasons, onFriendsConsent: requestFriendsAccess)
tech-stack:
  added: []
  patterns:
    - injected snapshot seam (no import of the fetch controller from the view or panel)
    - snapshot guard (anything malformed reads as unreachable)
key-files:
  created: []
  modified:
    - content/boards.js
    - src/browser/boardsView.js
    - src/browser/boardsPanel.js
    - mazeworld.html
    - test/unit/boardsView.test.js
    - test/unit/boards-copy.test.js
    - test/unit/boardsPanel.test.js
    - test/unit/boardsPanel-dom.test.js
    - test/unit/boards-css.test.js
decisions:
  - "The pinned YOU row appears only when the snapshot has at least one entry and no listed entry is the player's; an empty ready board shows the empty note (the standing card still shows the player's rank if `you` is set)"
  - "Standing falls back to the listed entry marked you when snapshot.you is null (68-05 ships you null when only the player-score call failed)"
  - "The total in 'of N interred worldwide' is max(total or entry count, the player's rank), grouped en-US"
  - "LINEAGE global rows are keyed 'combo:' + 'race cls' and ranked by group position; the footnote uses snapshot.sampled (entry count when missing)"
  - "A non-ready global view (loading/unreachable/closed/consent) keeps the ranked footnote and draws no standing card"
metrics:
  duration: "~30 min"
  completed: 2026-09-24
  tasks: 2
  files: 9
---

# Phase 68 Plan 06: Global board views, season picker and consent button Summary

The Leaderboards panel's ALL and FRIENDS views now render a Play Games snapshot. They show handle rows decoded from the score tag, YOU/FRIEND tags, the player's best run pinned under "NOT IN THE TOP TEN · YOUR BEST RUN", and a standing card with the real rank and a banded quip. There is an in-panel consent note with a SHOW MY FRIENDS button, LINEAGE grouped from the DEEPEST sample with an honest footnote, and a SEASON label with an older-season picker. Signed out or Compete OFF, every view stays the local Phase 66 view.

## What shipped

**Task 1: boardsView (`src/browser/boardsView.js`) and the copy cleanup (`content/boards.js`)**
- New inputs: `global` (a GlobalSnapshot or null), `season` (a positive integer, default 1) and `seasons` (default `[season]`).
- The body is chosen in this order: GRAVEYARD uses the local stones; the local scope uses the local rows; signed out on ALL/FRIENDS uses the Phase 66 note; signed in uses `buildGlobalView`.
- Global rows go through the Phase 66 row shape. Each row has the handle as the headline (the anon line when the handle is empty), an initials avatar from the handle (never an image), the YOU or FRIEND tag, and the decoded name. It also has the `RACE SUB · LVL n` line, the board value and unit, the six stat chips, and the cause line with `{foe}` filled as "foe" (no epitaph). Rows keep snapshot order. The rank is the one Play Games reported, or the list position when it is missing.
- When a tag does not decode, the row is a minimal row built from `scoreFallback`: DEEPEST shows the floor, LONGEST the days, BUTCHERY the kills, PURSE the grouped gold, and LEANEST the rate to one decimal in `SQ / FLOOR`. A rejected raw score shows "—".
- Each status maps to one body:
  - loading, unreachable and closed show a note, with a null standing
  - consent shows `{ kind: "consent", line, action: { id: "friendsConsent", label: "SHOW MY FRIENDS" } }`
  - ready with no entries shows the empty note with NO ENTRY
  - a stale ready snapshot renders its rows normally
  - a null or malformed snapshot shows the unreachable note
- Standing card: the place is `3RD`, and the note is "of 9,044 interred worldwide." (or "of N among friends.") plus a quip. Quips come from GLOBAL_STANDING_LINES in four bands (1 / 2–10 / 11–100 / 101+), picked from the place and the board index. The label is NO ENTRY when the player has no score.
- LINEAGE groups by `race cls`, keeps the first entry for each combination, and skips entries with no decoded race or class. Its footnote is `sampledFoot` with n = sampled. The standing places the player's combination among the groups.
- The header now carries `season: { label: "SEASON n", picker }`. The picker is non-null only with two or more seasons, signed in, on ALL/FRIENDS, and not on GRAVEYARD. Signed in, the scope line reads `global.scope.all` or `global.scope.friends`.
- `BOARDS_PANEL_COPY.note.live` is removed; `note` holds exactly `{ all, friends }`.

**Task 2: boardsPanel (`src/browser/boardsPanel.js`) and CSS (`mazeworld.html`)**
- BOARDS_CLASSES gains four classes. The head text renders `span.mw-bd-season`, plus a `div.mw-bd-seasons` of `button.mw-bd-season-chip` when there is a picker. Each chip sets type, data-season, data-on and aria-pressed, and its click calls `onSeason(n)`.
- The consent body renders `p.mw-bd-note` followed by `button.mw-bd-consent`, whose click calls `onConsent()`. A null standing draws no card.
- `createBoardsPanel` gains three optional seams: `global` (default null), `seasons` (default `() => ({ current: 1, all: [1] })`) and `onFriendsConsent`.
  - `global({ board, scope, season })` is called only when the player is signed in, the scope is not local and the board is not GRAVEYARD. A throw gives null.
  - `season` resets to `seasons().current` on both opens. `onSeason` only switches to a season listed in `seasons().all`; it clears the open row and resets the scroll.
  - `onConsent` wraps `onFriendsConsent` in try/catch.
  - `state()` now includes `season`.
- CSS adds `.mw-bd-season`, `.mw-bd-seasons`, `.mw-bd-season-chip` (44px tall, with an inverted `[data-on="1"]` state) and `.mw-bd-consent` (48px, primary dock-button look). Every font size uses `var(--mw-text-scale)`, and none of the new rules animate.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 (RED) | d7fca7f | test(68-06): add failing tests for the global board views and season header |
| 1 (GREEN) | c10baf7 | feat(68-06): render the global board snapshot in the boards view |
| 2 (RED) | 7996300 | test(68-06): add failing tests for the panel's consent button, season picker and global seams |
| 2 (GREEN) | 3fff74d | feat(68-06): draw the consent button and season picker, and read global snapshots through the panel seams |

## Verification

- `node --test test/unit/boardsView.test.js test/unit/boards-copy.test.js test/voice/safety-scan.test.js test/unit/hp-not-wp.test.js`: pass.
- `node --test test/unit/boardsPanel.test.js test/unit/boardsPanel-dom.test.js test/unit/boards-css.test.js test/unit/boardsView.test.js test/unit/shell-boards-panel.test.js test/unit/bridge-registry.test.js`: 179 pass, 0 fail.
- `npm test`: 4871 tests, 4864 pass, 7 fail. All 7 are the known worktree CRLF doc-ledger failures (class-pass-ledger tests 1048–1050 and 1058; flee-ledger tests 1813–1815). No new failures.
- Acceptance greps:
  - `function buildGlobalRows` appears once in boardsView.js, and `scoreFallback(` appears there at least once.
  - `mw-bd-consent` and `onFriendsConsent` appear in boardsPanel.js.
  - `.mw-bd-season-chip` and `.mw-bd-consent` appear in mazeworld.html.
- Local views make zero calls to `global()`. A test pins this: signed out, opening ALL and FRIENDS calls `global` zero times; local scope and GRAVEYARD do not call it either.
- After the orchestrator's note, the snapshot contract was cross-checked against master's shipped `src/browser/globalBoards.js`: toGlobalEntry keys `g:<id|anon>:<i>`, stale is `ready` with `stale: true`, `you` can be null on a ready snapshot, and entries are never re-sorted. The view matches it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Correctness] Standing reads the listed YOU entry when `snapshot.you` is null**
- **Found during:** Task 1, after the orchestrator's note on 68-05's shipped contract (a ready snapshot has `you: null` when only the player-score call failed).
- **Fix:** `buildGlobalStanding` uses `snap.you`, or else the entry marked `you` in the list, so a player listed in the top ten still sees their rank.
- **Files modified:** src/browser/boardsView.js, test/unit/boardsView.test.js
- **Commit:** c10baf7

**2. [Rule 1 - Bug avoidance] No pinned row on an empty board**
- **Issue:** The plan asks for the empty note when a ready board has no entries, but the pin rule would otherwise have appended the YOU row on its own.
- **Fix:** The pin is added only when there is at least one entry.
- **Commit:** c10baf7

**3. [Test hygiene] The Phase 67 class-walk fixture's retired coming-online literal was replaced with the unreachable note** (test/unit/boardsPanel-dom.test.js). It was a hand-built view string, not a copy reference.

The copy was not changed beyond removing `note.live`.

## Known Stubs

None. The panel's `global`, `seasons` and `onFriendsConsent` seams default to inert values (no snapshot, season 1 of [1], no handler) until 68-07 wires them in the shell. That is intended: until then the panel behaves exactly as before.

## Threat Flags

None. Other players' handles and decoded tag text reach the DOM only through createElement/textContent (the existing source pin "no HTML-string assignment" still holds). Avatars are initials only (T-68-10, T-68-11 mitigated as planned).

## Flagged assumptions

- Local views also show the current SEASON label, even though local bests are all-time (carried from the plan's flagged assumption).
- With a missing rank and no listed YOU entry, the standing shows "—" with the worldwide or friends count line and no quip.

## Human verification (deferred to end of run)

For the Phase 69 batch (docs/UAT-v2.0.md). On the Pixel 7, at the default and the largest text sizes:
1. ALL on DEEPEST (signed in, dev or real IDs): rows show handles with initials avatars, the adventurer name, "RACE SUB · LVL n", the value and unit; expanding a row shows the cause line and six stat chips with no epitaph.
2. The YOU tag (gold) and FRIEND tag fit on the id line beside a long handle.
3. A player outside the top ten sees the "NOT IN THE TOP TEN · YOUR BEST RUN" divider row last.
4. The standing card shows e.g. "3RD" with "of 9,044 interred worldwide." and a quip, all fitting without clipping.
5. FRIENDS without consent: the note and the SHOW MY FRIENDS button fit, the button is easy to tap, and tapping it raises the Play Games consent screen; declining leaves the note in place (no modal, no rail card).
6. The SEASON label reads in the header without crowding the INTERRED count; once a second season exists, the season chips wrap cleanly and switching one re-renders read-only.
7. LINEAGE on ALL shows grouped race-and-class rows and the "Sampled from the top N deepest corpses" footnote.
8. Signed out or Compete OFF: ALL/FRIENDS show the Phase 66 notes and nothing else changes.

## Self-Check: PASSED

- FOUND: src/browser/boardsView.js, src/browser/boardsPanel.js, content/boards.js, mazeworld.html, and all five test files
- FOUND commits: d7fca7f, c10baf7, 7996300, 3fff74d
