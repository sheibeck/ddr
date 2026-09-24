---
phase: 67-play-games-integration-account-chip
plan: 04
subsystem: leaderboards-panel
status: complete
tags: [leaderboards, play-games, identity, view-model, d-08]
requires:
  - Phase 66 Leaderboards panel (content/boards.js, src/browser/boardsView.js, src/browser/boardsPanel.js)
provides:
  - BOARDS_PANEL_COPY.strip.live and BOARDS_PANEL_COPY.note.live
  - boardsView player input and the signed-in strip (avatar, name, PLAY GAMES · SIGNED IN) and live notes
  - createBoardsPanel identity() seam (default signed out)
  - strip.avatar view field ({ initials, bg } signed in, null signed out)
affects:
  - 67-08 (wires identity() from the shell into createBoardsPanel)
  - Phase 68 (global/friends rows replace the live notes behind the same view)
tech-stack:
  added: []
  patterns: [injected seam with a frozen signed-out default, pure view model extended by input]
key-files:
  created: []
  modified:
    - content/boards.js
    - src/browser/boardsView.js
    - src/browser/boardsPanel.js
    - test/unit/boards-copy.test.js
    - test/unit/boardsView.test.js
    - test/unit/boardsPanel-dom.test.js
    - test/unit/boardsPanel.test.js
decisions:
  - "Signed in means signedIn === true exactly; a truthy non-true value or a missing flag is signed out, and the player is dropped"
  - "A signed-in player with no usable display name (null, non-object, empty or whitespace, non-string) shows strip.live.unnamed ('A player with no name') with its own initials avatar"
  - "The signed-in avatar reuses the .mw-bd-av class with data-on 1 and inline styles; no new class name, BOARDS_CLASSES unchanged"
  - "createBoardsPanel re-reads identity() on every render (board switch, scope, row, refresh), so a sign-in/out while open lands on the next refresh()"
metrics:
  duration: ~25 min
  completed: 2026-09-23
  tasks: 2
  files: 7
requirements: [ACCT-01]
---

# Phase 67 Plan 04: The Leaderboards identity strip goes live Summary

Signed in, the Leaderboards strip now shows the Play Games display name, its initials avatar with the mock's gold on-ring and PLAY GAMES · SIGNED IN, with ALL/FRIENDS lit and a deadpan "coming online" note. The panel reads the account through an injected `identity()` seam that defaults to signed out. Signed out (or Compete OFF), the Phase 66 strip is unchanged.

## What shipped

**Task 1: copy and view model (D-08)**
- `content/boards.js`: `BOARDS_PANEL_COPY.strip.live = { source: "PLAY GAMES · SIGNED IN", unnamed: "A player with no name" }` and `BOARDS_PANEL_COPY.note.live = { all: "The world's ledger is still being bound. Your own dead will have to do.", friends: "Your friends' ledger is still at the bindery. Your own dead will have to do for now." }`. Everything is still deep-frozen. The notes give no rank or count, and their wording never says "worldwide" or "among friends".
- `src/browser/boardsView.js`: new `player` input, which counts only while `signedIn === true`. When signed in, the strip is `{ glyph: "", avatar: { initials: initialsOf(name), bg: avatarColour(name) }, label: name, source: strip.live.source }` with chips `dim: false`. The name is the trimmed display name, or the `unnamed` fallback. When signed out, the strip is the Phase 66 strip plus `avatar: null`. On a ranked board, ALL/FRIENDS picks `note.live[scope]` when signed in and `note[scope]` otherwise. Header, rows, standing, footnote, rail, board head and dock are unchanged (a test compares them deepStrictEqual across both states, on all seven boards and both entry modes).

**Task 2: renderer and controller**
- `buildStrip` in `src/browser/boardsPanel.js`: when `strip.avatar` is an object, it draws `div.mw-bd-av` (no nobody class) with the initials, `data-on="1"`, `aria-hidden`, an inline `background` and `boxShadow: "inset 0 0 0 1px rgba(0,0,0,.5), 0 0 0 1px #e8c97a"`. Otherwise it draws the Phase 66 nobody glyph as before.
- `createBoardsPanel({ ..., identity })`: the new optional seam defaults to a frozen signed-out answer. `readIdentity()` wraps the call in try/catch. A throw, a non-function, a non-object or `signedIn !== true` all count as signed out with player null. `render()` now passes `signedIn` and `player` into `buildView`, replacing the hardcoded `signedIn: false`. `refresh()` re-reads the identity only while the panel is open.

## Commits

| Task | Gate | Commit | Message |
|------|------|--------|---------|
| 1 | RED | 004f9ac | test(67-04): add failing tests for the signed-in strip and live notes |
| 1 | GREEN | ce56e77 | feat(67-04): signed-in Leaderboards strip and coming-online notes in the view model |
| 2 | RED | 4d71182 | test(67-04): add failing tests for the avatar strip and the identity() seam |
| 2 | GREEN | 5706128 | feat(67-04): Leaderboards strip draws the signed-in avatar and reads an injected identity() seam |

## Verification

- `node --test test/unit/boardsView.test.js test/unit/boards-copy.test.js test/voice/safety-scan.test.js test/unit/hp-not-wp.test.js test/determinism/content-is-pure-data.test.js`: 88 pass, 0 fail.
- `node --test test/unit/boardsPanel-dom.test.js test/unit/boardsPanel.test.js test/unit/boardsView.test.js test/unit/bridge-registry.test.js test/unit/stale-terms.test.js`: 114 pass, 0 fail.
- `npm test`: 4487 tests, 4480 pass, 7 fail. The 7 failures are the known pre-existing CRLF doc-ledger failures (class-pass-ledger / flee-ledger), not caused by this plan. The failing set did not grow.
- `grep -c "PLAY GAMES · SIGNED IN" content/boards.js` = 1. `grep -c identity src/browser/boardsPanel.js` = 9.
- No network-capable identifier was added. The boardsView and boardsPanel source pins (no fetch/XMLHttpRequest/WebSocket/EventSource/sendBeacon, no document./window.) still pass.
- GRAVEYARD still has no strip in either state (tested).

## TDD Gate Compliance

Both tasks have RED `test(...)` commits followed by GREEN `feat(...)` commits. No refactor commit was needed.

## Deviations from Plan

None. The plan was executed as written. One small addition beyond the plan: a DOM test that re-renders signed out after signed in and checks that the avatar goes back to the nobody glyph.

## Deferred / notes

- `mazeworld.html` is untouched. 67-08 wires `identity()` from the shell (the account identity from 67-03's accountIdentity) into `createBoardsPanel`. Until then the panel behaves exactly as in Phase 66 (signed out).
- The new strings use a straight apostrophe ("world's", "friends'"). Some Phase 66 copy uses a typographic apostrophe (’). Both pass the voice scans. The copy test pins the straight form, so a later typographic pass would need to update that pin as well.

## Known Stubs

None. The live ALL/FRIENDS notes are deliberate D-08 copy that stands in until Phase 68 delivers global and friends rows.

## Human verification (deferred to end of run)

For the Phase 69 batch (docs/UAT-v2.0.md). Do not pause for a device:

1. Signed in to Play Games on the device, open Leaderboards (DEEPEST): the identity strip shows the Play Games display name, a square initials avatar with the gold ring, and PLAY GAMES · SIGNED IN.
2. Still signed in: the ALL and FRIENDS chips are not dimmed. Tapping ALL replaces the rows with "The world's ledger is still being bound. Your own dead will have to do." Tapping FRIENDS shows "Your friends' ledger is still at the bindery. Your own dead will have to do for now." Tapping the same chip again brings the local rows back. Nothing claims a global or friends rank.
3. Turn Compete OFF (or sign out), then reopen Leaderboards: the strip returns to the "?" glyph, PLAY GAMES · SIGNED OUT and "Your dead only", and the chips are dimmed.
4. GRAVEYARD shows no identity strip, signed in or out.

## Self-Check: PASSED

- FOUND: content/boards.js, src/browser/boardsView.js, src/browser/boardsPanel.js and the four test files (modified)
- FOUND commits: 004f9ac, ce56e77, 4d71182, 5706128
