---
phase: 84-leaderboards-panel-v3
plan: 08
subsystem: ui
tags: [shell-wiring, leaderboards, boards-v3, board-client, dev-loop-fixtures]

# Dependency graph
requires:
  - phase: 84-leaderboards-panel-v3
    provides: "84-03: engineAdapter.js's getRunHistory() — the per-run local history this plan reads for YOUR DEAD and the VIEW THE DEAD gate"
  - phase: 84-leaderboards-panel-v3
    provides: "84-04: src/browser/boardFeed.js's createBoardFeed — the LEADERBOARD data source this plan wires as the panel's board seam"
  - phase: 84-leaderboards-panel-v3
    provides: "84-07: src/browser/leaderboardPanel.js's createLeaderboardPanel({host, buildView, history, board, competeOn, prefs, now, tzOffset, season, reducedMotion, onRoute}) — the exact seven-method seam this plan swaps into the shell in place of createBoardsPanel"
provides:
  - "src/browser/devBoardSeed.js — devBoardRuns(), a frozen deterministic dev-loop board seed (12 runs, 6 races, 12 sub-classes, 6 dev uids) built from real engine newRun()/die() output"
  - "mazeworld.html — the shell now runs the v3 Leaderboards panel: createBoardClient + createBoardFeed wired over boardFetchFn() (live fetch on a native platform, the seeded fake in the browser dev loop) and competeIsOn() (currentSettings.compete); createLeaderboardPanel replaces createBoardsPanel with history/board/competeOn/season seams and none of the Play Games seams; refreshTitleDead's VIEW THE DEAD gate is getRunHistory().length > 0 || competeIsOn(), re-checked on every account-controller change"
  - "test/unit/harness/shellSandbox.js — loadShellSandbox's boards option is now {history, compete, board}, wiring the REAL v3 panel for every shell test"
affects: [84-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "boardFetchFn() selects the network seam once, at panel-construction time: globalThis.fetch.bind(globalThis) on a native platform, else createFakeBoardFetch({runs: devBoardRuns()}).fetchFn in the browser dev loop — the same platform-detection convention pgsNative already used, now the panel's only network path"
    - "devBoardSeed.js builds its fixture runs the same way as production: real engine newRun()/die() over fixed seeds and forced {race, sub, cls}, with post-roll field overrides (floor/steps/day/kills/gold/level) applied directly to the state before killing it — so note/epitaph come from the real content banks (CAUSE_TEXT/EPITAPHS) exactly as a live death would produce, and buildRunDoc's own validateRunDoc is the proof every entry is board-legal"
    - "the shell sandbox's `boards` option reads `history`/`compete` live through a closure over the caller's own object (never snapshotted at loadShellSandbox() call time), so a test can mutate them and reopen the panel to see the change — mirroring the dressing/canvasContext injection pattern the harness already uses"

key-files:
  created:
    - src/browser/devBoardSeed.js
    - test/unit/devBoardSeed.test.js
  modified:
    - mazeworld.html
    - src/browser/bridge.js
    - test/unit/harness/shellSandbox.js
    - test/unit/shell-boards-panel.test.js
    - test/unit/shell-boards-entry.test.js
    - test/unit/shell-account.test.js
    - test/unit/shell-pgs.test.js

key-decisions:
  - "devBoardRuns() mutates newRun()'s state fields directly (floor.depth/steps/day/c.kills/c.gold/c.level) rather than playing a scripted run, then calls the real engine die() to fill note/epitaph — the fastest way to get board-legal, in-voice fixture docs without inventing a second copy of the death-note/epitaph machinery; buildRunDoc's validateRunDoc(doc, {}) is the proof every entry passes the exact same gate a live submission would"
  - "the RANK BY sheet's option is found by its rendered label text (\"DAYS\"), not by a data-value attribute — recordingDom.js (the shell test harness) only supports #id/.class/tag/:scope>child selectors, no attribute selectors, so every test that needed to select a picker or option by its dataset value uses .find() over a class-selected NodeList instead of an attribute selector"
  - "shell-pgs.test.js's panelSeams() helper and its P1/P2 tests are deleted outright rather than inverted into absence-only assertions — S2 (in the same file) already proves the retired seams are gone from the panel block, so a second, narrower test for the exact same absence would be redundant coverage, not new information"

requirements-completed: [BOARD-18, BOARD-19, BOARD-25, BOARD-26, BOARD-27]  # per the phase source-audit table in 84-01-PLAN.md, this plan is the last deliverer for all five

coverage:
  - id: D1
    description: "The DEAD tab and the title's VIEW THE DEAD open the v3 panel (createLeaderboardPanel over leaderboardView), reading the adapter's run history and the board feed; the old panel, its bests/graveyard read seam and every Play Games seam (global, seasons, onFriendsConsent, hero, onOpen, identity) are gone from the panel wiring"
    requirement: "BOARD-18"
    verification:
      - kind: unit
        ref: "test/unit/shell-boards-panel.test.js — (A1-A7) DEAD tab open/entry/mode, (H1) SOURCE pin for the createLeaderboardPanel seam set and the absence of every retired seam"
        status: pass
      - kind: unit
        ref: "test/unit/shell-boards-entry.test.js — (D1-D5) openFromTitle Compete on/off, chevron routing, dead/live hero dock"
        status: pass
      - kind: unit
        ref: "test/unit/shell-account.test.js — (C1) no identity seam on the panel block"
        status: pass
      - kind: unit
        ref: "test/unit/shell-pgs.test.js — (S2) the retired global/seasons/onFriendsConsent/onOpen seams are absent from the panel block and zero occurrences in the file"
        status: pass
    human_judgment: false
  - id: D2
    description: "The board client is created with the real Compete setting (currentSettings.compete) and FIREBASE_CONFIG: on Android it uses the live fetch against delve-die-repeat-6ba5f; in the browser dev loop it uses the in-memory fake board seeded with deterministic dev runs; with Compete OFF it makes zero network calls"
    requirement: "BOARD-19"
    verification:
      - kind: unit
        ref: "test/unit/shell-boards-panel.test.js — (H2) boardFetchFn SOURCE pin (native-only live fetch, else the seeded fake), (F3) zero-network-call pin over the comment-stripped shell"
        status: pass
      - kind: unit
        ref: "test/unit/devBoardSeed.test.js — devBoardRuns() determinism, validateRunDoc pass, id uniqueness, race/sub-class variety, dev-uid sharing, source pin (no network/storage/DOM import)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The feed reads the player's uid only through the shared identity's snapshot(); nothing creates an identity just to read the board"
    requirement: "BOARD-19"
    verification:
      - kind: unit
        ref: "mazeworld.html — `identity: () => sharedIdentity()` wired into createBoardFeed (grep-pinned; sharedIdentity is the same lazily-created, never-eagerly-touched identity instance bug reports already use)"
        status: pass
    human_judgment: false
  - id: D4
    description: "VIEW THE DEAD shows when the history holds at least one run OR Compete is ON (refreshTitleDead no longer reads the graveyard total), and re-checks on every Compete change"
    requirement: "BOARD-26"
    verification:
      - kind: unit
        ref: "test/unit/shell-boards-panel.test.js — (F2) refreshTitleDead SOURCE pin for getRunHistory().length > 0 || competeIsOn()"
        status: pass
      - kind: unit
        ref: "test/unit/shell-account.test.js — (B2) the account.subscribe callback calls refreshTitleDead() on every change"
        status: pass
    human_judgment: false
  - id: D5
    description: "The Android back button on a title-opened panel still mirrors the ◀ (boardsPanel.isTitleOpen/boardsPanel.back unchanged), routeFromBoards is unchanged, and the body[data-boards-entry=title] marker behaves as before"
    requirement: "BOARD-25"
    verification:
      - kind: unit
        ref: "test/unit/shell-boards-entry.test.js — (B1-B2) unchanged Android-back/hasOpenModal source pins"
        status: pass
      - kind: unit
        ref: "test/unit/shell-boards-panel.test.js — (E1-E7) routeFromBoards dock/back routing, unchanged; (A4) no body marker from a tab open"
        status: pass
    human_judgment: false
  - id: D6
    description: "LEADERBOARD names the current season (SEASON OF THE ALPHA) under the title, board view only"
    requirement: "BOARD-27"
    verification:
      - kind: unit
        ref: "test/unit/shell-boards-panel.test.js — (G3) LEADERBOARD shows the SEASON OF THE ALPHA line; (A1) YOUR DEAD (mode mine) carries no season line"
        status: pass
    human_judgment: false

# Metrics
duration: ~31min
completed: 2026-09-29
status: complete
---

# Phase 84 Plan 08: The Shell Switch to the v3 Leaderboards Panel Summary

**mazeworld.html now opens the v3 Leaderboards panel from the DEAD tab and the title — a real board client/feed over the live board on device or a deterministic dev-loop fixture in the browser, the adapter's per-run history for YOUR DEAD, and VIEW THE DEAD gated on history-or-Compete instead of the old graveyard total**

## Performance

- **Duration:** ~31 min
- **Started:** 2026-09-29T15:17:49Z (prior plan's close)
- **Completed:** 2026-09-29T15:48:42Z
- **Tasks:** 2
- **Files modified:** 9 (2 created, 7 modified)

## Accomplishments

- `src/browser/devBoardSeed.js`: `devBoardRuns({now})` — a frozen array of 12 deterministic `{id, doc}` board runs, built from real `engine/state.js#newRun()` over fixed seeds and forced `{race, sub, cls}` triples, with fixed stat spreads (floor/steps/day/kills/gold/level) applied directly to the rolled state before killing it through the real `engine/death.js#die()` (so `note`/`epitaph` are filled from the real content banks), then turned into board-legal docs via `runDoc.js#buildRunDoc`. Six races, twelve distinct sub-classes, and six dev uids (`devuid0001`..`devuid0006`) each owning two runs so a "your best" pick has a real dev identity to pin against.
- `mazeworld.html`'s module script: the import block swaps `getBests/getGraveyard` + `createBoardsPanel`/`boardsView` for `getRunHistory` + `createLeaderboardPanel`/`leaderboardView`, plus new lines for `createBoardClient`, `createBoardFeed`, `createFakeBoardFetch` and `devBoardRuns`. `readBoardsData()` is deleted; two new functions replace it — `competeIsOn()` (`currentSettings?.compete === true`, read live on every call) and `boardFetchFn()` (the live `fetch` on a native platform, else the seeded fake). `boardClient`/`boardFeed` are constructed once, right before the panel, and `createLeaderboardPanel` replaces `createBoardsPanel` wholesale: `history: () => getRunHistory()`, `board: boardFeed`, `competeOn: competeIsOn`, `season: SEASON`, `now`/`tzOffset`/`reducedMotion`/`onRoute` as before — with **no** identity/global/seasons/onFriendsConsent/hero/onOpen seams (those retire with the old panel in 84-09, or stay for Phase 85's Play Games removal). `window.__mzBoards` stays byte-identical.
- `refreshTitleDead()` moves off `getGraveyard().total` onto `getRunHistory().length > 0 || competeIsOn()` (BOARD-26's history-or-Compete rule) and is now also called from `account.subscribe`'s callback, so a Compete flip anywhere in the app updates the title's VIEW THE DEAD entry at once, not just on the next title return.
- `src/browser/bridge.js`: the `__mzBoards` registry entry's `purpose`/`consumers` text rewritten for the v3 panel (no behavior change — the key set and every other entry are untouched).
- `test/unit/harness/shellSandbox.js`: `loadShellSandbox`'s `boards` option is now `{history, compete, board}` (read live, not snapshotted), wiring the REAL `createLeaderboardPanel` + `leaderboardView` over a default unreachable/offline board seam a test can override.
- All four shell test files rewritten/extended against the v3 panel's `.mw-lb-*` DOM and seam set (see "Files Created/Modified" for the per-file breakdown). `node --test` across all four: 143/143 pass. Full `npm test`: 8535 total, 8533 pass, 0 fail, 2 skipped (pre-existing). `git status --porcelain -- engine test/parity content`: empty.

## Task Commits

1. **Task 1: dev board seed and the shell wiring (client, feed, panel, VIEW THE DEAD gate)** - `60cbd53b` (feat)
2. **Task 2: the shell sandbox and the rewritten shell tests** - `5356b14d` (test)

_Task 1 built `devBoardSeed.js` and its test together (verified against `validateRunDoc` and id-uniqueness before committing), then wired the shell in the same commit — the plan's own acceptance criteria (five grep pins plus the five-file verify set) only prove the wiring end-to-end once both land, matching this plan set's established precedent of landing tightly-coupled test+implementation pairs together. Task 2's sandbox and four shell test files are inseparably coupled (the sandbox change is what the tests exercise), so they landed as one commit._

## Files Created/Modified

- `src/browser/devBoardSeed.js` - `devBoardRuns()`, the dev-loop board fixture (new)
- `test/unit/devBoardSeed.test.js` - 10 tests: shape, determinism, validity, uniqueness, race/sub-class variety, dev-uid sharing, injected-now, source pins (new)
- `mazeworld.html` - import block, `competeIsOn()`/`boardFetchFn()`, `boardClient`/`boardFeed`, the `createLeaderboardPanel` swap, `refreshTitleDead`'s new gate, `account.subscribe`'s `refreshTitleDead()` call, and updated markup/JS comments describing the v3 panel at the `#screen-dead` mount, the DEAD tab's `showTab` branch and the title's VIEW THE DEAD click handler
- `src/browser/bridge.js` - `__mzBoards`'s `purpose`/`consumers` text rewritten for the v3 panel
- `test/unit/harness/shellSandbox.js` - `loadShellSandbox`'s `boards` option and its wiring switched to `createLeaderboardPanel`/`leaderboardView`
- `test/unit/shell-boards-panel.test.js` - A1-A7 (DEAD tab entry), B1-B2 (RANK BY stat memory), C1-C3 (row expand/collapse), D1 (empty state) rewritten for the v3 DOM; E1-E7 (routeFromBoards) and F1, F3 (deletion/zero-network pins) unchanged; F2 rewritten for `getRunHistory()`/`competeIsOn()`; G1-G3 (the retired LINEAGE hero seam) deleted and replaced by three Compete-ON LEADERBOARD tests plus two SOURCE pins (H1-H2) for the panel's seam set and `boardFetchFn`'s native-only gate
- `test/unit/shell-boards-entry.test.js` - D1-D4 rewritten against `createLeaderboardPanel`/`leaderboardView`'s `.mw-lb-*` DOM; D5 added (Compete-ON title open lands on LEADERBOARD); A1, B1-B2, C1-C2, E1-E3 unchanged
- `test/unit/shell-account.test.js` - C1 rewritten (no identity seam on the panel block); B2 extended to match the `refreshTitleDead()` call
- `test/unit/shell-pgs.test.js` - S2 rewritten to assert the absence of the retired global/seasons/onFriendsConsent/onOpen seams; the `panelSeams()` helper and its P1/P2 tests deleted; S3 unchanged

## Decisions Made

- `devBoardRuns()` mutates `newRun()`'s rolled state directly rather than scripting a played-out run, then kills it through the real `die()` — the cheapest way to a board-legal, in-voice fixture set, proven by running every doc back through `validateRunDoc(doc, {})`.
- Every DOM query for a dataset value in the rewritten shell tests goes through `.find()` over a class-selected NodeList rather than an attribute selector — `recordingDom.js` (the shell harness) only supports `#id`/`.class`/tag/`:scope>child` selectors.
- `shell-pgs.test.js`'s `panelSeams()` helper and its P1/P2 tests are deleted outright (not inverted into absence assertions) — S2, in the same file, already proves the exact same absence; a second test would be redundant, not new coverage.

## Deviations from Plan

None — plan executed exactly as written. The plan's line-number references in the `<interfaces>` block (from before 84-06/84-07 landed and grew the file) no longer matched exact line numbers by the time this plan ran; every referenced code region (imports, the panel block, `refreshTitleDead`, `account.subscribe`, the `#screen-dead` mount comment, the DEAD tab's `showTab` branch, the title's VIEW THE DEAD click handler) was located by content search instead and edited as specified — a normal consequence of sequential execution within the phase, not a deviation from the plan's intent.

## Issues Encountered

None beyond the recordingDom attribute-selector limitation noted above (a test-authoring correction, not a code defect).

## User Setup Required

None - no external service configuration required.

## Requirement Coverage

Per the phase source-audit table in `84-01-PLAN.md`, this plan is the **last deliverer for all five requirements** in its frontmatter — each now marked complete in `REQUIREMENTS.md`:

- **BOARD-18** — the v3 panel opens from both the DEAD tab and the title, the old panel/Play Games seams are gone from the wiring
- **BOARD-19** — the board client reads the real Compete setting, selects the live fetch only on a native platform, and the feed reads identity only through `snapshot()`
- **BOARD-25** — the dock/back/routing machinery (routeFromBoards, the Android back mirror, the title-entry body marker) is unchanged and still holds under the v3 panel
- **BOARD-26** — VIEW THE DEAD's gate is history-or-Compete, re-checked on every account change
- **BOARD-27** — LEADERBOARD shows the SEASON OF THE ALPHA line

## Human verification (deferred to end of run)

Batched into the milestone-close Pixel 7 checklist (docs/UAT-v2.2.md, Phase 86), per this plan's own `<output>` instruction:

1. DEAD tab with Compete ON opens LEADERBOARD ("Everyone's dead. Top ten shown.", SEASON OF THE ALPHA under the title); with Compete OFF it opens YOUR DEAD ("Compete is off. Only your heroes.") with a static INTERRED count
2. YOURS › switches to YOUR DEAD (count = your runs); EVERYONE › and the ◀ return to the board; the board total shows on EVERYONE ›
3. RANK BY / RACE / SUB-CLASS open bottom sheets with CSS ▼ carets and ◆ marks; the SUB-CLASS sheet (25 rows) scrolls; YOUR DEAD shows counts and dims zero options (still tappable), LEADERBOARD shows none
4. Rows: rank, initials avatar (LJ for @lanternjaw), handle or hero name, YOU on your board rows, the name · race sub-class · level line, value and unit; the leading row in the stat colour; tapping opens the killer's name, epitaph, six chips and "Died 28 Sep 2026 · 2.1.0 (11)"; tapping again closes it
5. A best run outside the top ten is pinned under NOT IN THE TOP TEN · YOUR BEST with its real rank; the standing card reads "{handle}'s best, of N interred as …" or "None of yours on this board yet."
6. A filter with no runs shows NOBODY YET and CLEAR FILTERS (the stat stays)
7. Airplane mode: first LEADERBOARD open shows the unreachable note and SEE YOUR DEAD; after a successful look, going offline shows the cached rows with the stale line; YOUR DEAD opens instantly offline
8. Title with no history and Compete OFF hides VIEW THE DEAD; turning Compete ON shows it; from the title the footer reads BACK TO TITLE / ROLL A NEW HERO (no hero) or BACK TO THE DUNGEON, and the Android back button mirrors the ◀
9. A dead hero's DEAD tab still docks FINAL SHEET and BURY THEM
10. The RANK BY choice survives closing and reopening the panel; RACE and SUB-CLASS reset

## Next Phase Readiness

- The v3 panel is now the shell's only Leaderboards surface — `src/browser/boardsPanel.js`/`boardsView.js` and their `.mw-bd-*` CSS block are unused but still present (84-09's job to delete, along with the retired shell test coverage that still pins them, if any remains).
- The Play Games queue and `globalBoards` controller stay wired exactly as before — Phase 85 removes them; this plan proved the panel no longer depends on either.
- No blockers for 84-09.

---
*Phase: 84-leaderboards-panel-v3*
*Completed: 2026-09-29*

## Self-Check: PASSED

All 9 created/modified source files plus this SUMMARY.md verified present on disk; both task commits (`60cbd53b`, `5356b14d`) verified present in `git log`.
