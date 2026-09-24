---
phase: 66-leaderboards-panel-local
plan: 03
subsystem: ui
tags: [dom-renderer, modular-shell, boards-panel, leaderboards, recording-dom]

# Dependency graph
requires:
  - phase: 65-death-records-and-boards
    provides: "engine/records.js BOARD_IDS/RANKED_BOARDS/compareRuns/updateBests and the bests/graveyard adapter seams this panel will read through in 66-06"
provides:
  - "src/browser/boardsPanel.js: renderBoardsPanel (pure DOM renderer over a view object) and createBoardsPanel (stateful controller: entry modes, board memory, scope/row toggles, back routing, rail auto-centring)"
  - "BOARDS_CLASSES (every emitted class, frozen array) for 66-05's CSS completeness test"
  - "BOARDS_LAST_KEY (\"ddr.boards.last.v1\") — the D-04 per-viewer last-board convenience key"
  - "railScrollTarget(dims) — the mock's syncRail formula, clamped"
affects: ["66-04-boards-view-model", "66-05-boards-css", "66-06-boards-wiring", "68-global-boards"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Modular-shell screen module (gearTab.js/roller.js precedent): pure DOM via host.ownerDocument only, no window/document globals, stateful controller as a frozen factory closing over private state"
    - "Persistent-skeleton renderer: the .mw-bd root and its six section elements (head/strip/rail/boardhead/body/dock) are created once and reused via querySelector on every subsequent render call — replaceChildren only touches each section's CHILDREN, so the rail's and body's own scroll positions survive a re-render"

key-files:
  created:
    - src/browser/boardsPanel.js
    - test/unit/boardsPanel-dom.test.js
    - test/unit/boardsPanel.test.js
  modified: []

key-decisions:
  - "Row avatars reuse the plain .mw-bd-av class (no separate row-avatar class); the strip's 'nobody' avatar adds the .mw-bd-av-nobody modifier on top of it — mirrors the mock's single AVATAR() helper feeding both surfaces."
  - "Only the TOP row gets inline board-colour styling (rank, value, bar-fill, box-shadow stripe); podium (2nd/3rd) and YOU highlighting are left to 66-05's CSS keyed on the row's data-podium/data-you attributes, since those colours are fixed tokens, not per-board."
  - "mw-bd-val always carries a literal data-long of '1' or '0' (not only set when true) for consistent dataset-boolean convention with data-on/data-dim elsewhere in the module."
  - "centreRail() runs after every render() call (not just on open) to satisfy the CONTEXT truth that the active chip stays centred after every render, including a scope-note render where the rail is still visible."

requirements-completed: [BOARD-01, BOARD-02, BOARD-03, BOARD-04, BOARD-05, BOARD-06, BOARD-07, BOARD-08]

coverage:
  - id: D1
    description: "renderBoardsPanel draws every part of the mock's panel structure (header, strip, rail, board head, rows/empty/note body, standing card, footnote, dock) from a view object alone, with a persistent skeleton across re-renders"
    requirement: "BOARD-02"
    verification:
      - kind: unit
        ref: "test/unit/boardsPanel-dom.test.js (19 tests, incl. skeleton identity, BOARDS_CLASSES completeness walk)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The renderer is proven global-free, copy-free and network-free (no document/window/globalThis, no innerHTML write, no content/ import, no network identifier)"
    requirement: "BOARD-02"
    verification:
      - kind: unit
        ref: "test/unit/boardsPanel-dom.test.js#source pins: no document./window./globalThis. references..."
        status: pass
    human_judgment: false
  - id: D3
    description: "railScrollTarget implements the mock's syncRail formula, clamped to [0, scrollWidth-clientWidth], never NaN on malformed input"
    requirement: "BOARD-06"
    verification:
      - kind: unit
        ref: "test/unit/boardsPanel-dom.test.js#railScrollTarget: matches the mock's syncRail formula..."
        status: pass
    human_judgment: false
  - id: D4
    description: "createBoardsPanel opens correctly from either entry (tab remembers last board via BOARDS_LAST_KEY with a 'deep' fallback; title always opens GRAVEYARD and marks body.dataset.boardsEntry)"
    requirement: "BOARD-01"
    verification:
      - kind: unit
        ref: "test/unit/boardsPanel.test.js#openFromTab(): prefs null opens deep...; #openFromTitle({ hasHero })..."
        status: pass
    human_judgment: false
  - id: D5
    description: "back() mirrors the chevron exactly (false in tab mode; routes dungeon/title by hasHero in title mode, clearing the title marker); dock buttons route identically"
    requirement: "BOARD-01"
    verification:
      - kind: unit
        ref: "test/unit/boardsPanel.test.js#back() in tab mode...; #the chevron's onclick routes exactly like back()..."
        status: pass
    human_judgment: false
  - id: D6
    description: "One row open at a time; board/scope changes reset scroll and close any open row; a row toggle never touches scroll"
    requirement: "BOARD-06"
    verification:
      - kind: unit
        ref: "test/unit/boardsPanel.test.js#a row's onclick opens it...; #the ALL chip's onclick sets scope all..."
        status: pass
    human_judgment: false
  - id: D7
    description: "The active rail chip auto-centres after every render, instantly under reduced motion, smoothly otherwise, only when off by more than 2px"
    requirement: "BOARD-06"
    verification:
      - kind: unit
        ref: "test/unit/boardsPanel.test.js#centreRail(): calls scrollTo({left, behavior:'auto'})..."
        status: pass
    human_judgment: false
  - id: D8
    description: "A throwing readData or buildView never breaks the tab switch — the panel still renders (with an empty data fallback) or leaves the previous DOM in place"
    requirement: "BOARD-07"
    verification:
      - kind: unit
        ref: "test/unit/boardsPanel.test.js#a readData that throws still renders..."
        status: pass
    human_judgment: false
  - id: D9
    description: "Visual/motion feel on a real device: the active chip glides to centre on a board switch and jumps instantly with the OS reduce-motion setting on; a tap on a row deep in a long GRAVEYARD list opens it without the list jumping to the top"
    human_judgment: true
    rationale: "Requires a real device/browser to observe scroll animation timing and touch feel — unit tests over recordingDom prove the logic (target computation, behavior:'auto' vs 'smooth', scrollTop untouched on row toggle) but cannot observe the rendered motion itself. Deferred to the Phase 69 UAT batch per project convention (verification agents off this run)."

# Metrics
duration: 55min
completed: 2026-09-23
status: complete
---

# Phase 66 Plan 03: Leaderboards Panel Renderer + Controller Summary

**src/browser/boardsPanel.js: a persistent-skeleton DOM renderer (`renderBoardsPanel`) plus a stateful controller (`createBoardsPanel`) for the Leaderboards panel, implementing every mock interaction (rows, tap-expand, rail auto-centring, title/tab entry chrome, back routing, board memory) against an injected view object — zero copy, zero DOM globals, zero network.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-09-23T23:00:00Z (approx.)
- **Completed:** 2026-09-23T23:54:26Z
- **Tasks:** 2
- **Files modified:** 3 (1 created module across both commits, 2 new test files)

## Accomplishments
- `renderBoardsPanel(host, view, handlers)`: draws the full panel (header with optional chevron, identity strip with ALL/FRIENDS chips, seven-chip rail, board head, rows/empty/note body, standing card, footnote, title-mode dock) purely from the view object, reusing a persistent `.mw-bd` skeleton across re-renders so the rail's and body's own scroll positions survive a row tap or board switch.
- `railScrollTarget(dims)`: ports the mock's `syncRail` formula verbatim, clamped to `[0, scrollWidth - clientWidth]`, with finite-coercion on every input so it never throws or returns NaN.
- `BOARDS_CLASSES`: the frozen, exhaustive list of every class the renderer emits, ready for 66-05's CSS completeness test.
- `createBoardsPanel({ host, buildView, readData, prefs, reducedMotion, onRoute })`: the stateful controller implementing D-01 (title vs tab chrome), D-02 (tab bar stays with no chevron), D-03 (back() mirrors the chevron, routing dungeon/title by hasHero), D-04 (GRAVEYARD on title entry; DEEPEST fallback + `BOARDS_LAST_KEY` memory on tab entry), D-06 (scope toggle, always `signedIn: false` this phase) and D-13 (one row open at a time, rail auto-centring with prefers-reduced-motion respected).
- Both `readData()` and `buildView()` failures are contained: a throwing `readData` falls back to `{ bests: null, graves: [], total: 0 }`; the whole render is wrapped in try/catch so a throwing `buildView` leaves the previous DOM exactly as it was, never breaking the tab switch.

## Task Commits

Each task was committed atomically:

1. **Task 1: renderBoardsPanel, railScrollTarget and BOARDS_CLASSES** - `a85cf0a` (feat)
2. **Task 2: createBoardsPanel controller** - `b724b58` (feat)

**Plan metadata:** (this commit) — SUMMARY.md only (STATE.md/ROADMAP.md are owned by the orchestrator, per this plan's worktree instructions)

## Files Created/Modified
- `src/browser/boardsPanel.js` - the panel's pure DOM renderer (Task 1) plus its stateful controller (Task 2); no imports beyond `engine/records.js#BOARD_IDS` for the controller's board-id validation
- `test/unit/boardsPanel-dom.test.js` - 19 tests: skeleton identity, header/strip/rail/board-head/body/dock rendering, row rendering (top-row colour, tag/name, open detail+stats, divider), BOARDS_CLASSES completeness walk, `railScrollTarget` behaviour, and the source pins (no window/document/globalThis, no innerHTML, no content/ import, no network identifier)
- `test/unit/boardsPanel.test.js` - 20 tests: both entry modes and board memory (including a throwing `prefs`), the chip/row/scope toggles and their scroll-reset rules, back routing with/without a hero, the chevron and dock buttons, `onDeadTab`, the reduced-motion rail-centring branch, a throwing `readData`, `refresh()` and `state()`

## Decisions Made
- Row avatars reuse the plain `.mw-bd-av` class (no dedicated row-avatar class); only the strip's "nobody" avatar adds the `.mw-bd-av-nobody` modifier — mirrors the mock's single `AVATAR()` helper feeding both the strip and every row.
- Only the top row gets inline board-colour styling (rank/value/bar-fill/box-shadow stripe); podium and YOU-row highlighting are left entirely to 66-05's CSS via the row's `data-podium`/`data-you` attributes, since the podium/you colours are fixed tokens rather than per-board colours.
- `mw-bd-val` always carries an explicit `data-long` of `"1"` or `"0"` (never omitted when false) to match the module's existing dataset-boolean convention (`data-on`/`data-dim` elsewhere).
- `centreRail()` runs at the end of every `render()` call, not only on open/board-switch, so the active chip stays centred even after a scope toggle that swaps in the in-panel note (satisfies the CONTEXT truth "the active chip is centred in the rail after every render").

## Deviations from Plan

None - plan executed exactly as written. Both tasks' behaviour bullets, action steps and acceptance criteria are implemented and tested verbatim.

## Issues Encountered
- The first draft of the `BOARDS_CLASSES` completeness test asserted exact set-equality against a single "full" view, but `view.body.kind` is a single enum (`rows`/`empty`/`note`) — no one render can emit `.mw-bd-empty`, `.mw-bd-note` AND row markup at once. Fixed by unioning the classes found across three renders (one per body kind) before comparing to `BOARDS_CLASSES`. This is a test-authoring correction only; no renderer code changed.

## Human verification (deferred to end of run)

Per project convention (verification agents off; UAT batched at the Phase 69 milestone close), these device/visual checks are recorded here for that batch rather than gating this plan:
- The active chip glides to the centre of the rail on a board switch, and jumps there instantly with the OS reduce-motion setting turned on.
- A tap on a row deep in a long GRAVEYARD list opens it in place, without the list jumping back to the top.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `renderBoardsPanel`/`createBoardsPanel` are ready for 66-04's `boardsView` to be injected as `buildView` (the view contract is pinned in this plan's `<interfaces>` block and unchanged here).
- `BOARDS_CLASSES` is ready for 66-05's CSS pass to consume for its completeness test.
- `BOARDS_LAST_KEY`/`prefs` seam and `readData`/`onRoute` seams are ready for 66-06's wiring into `mazeworld.html`'s DEAD tab and title screen, and for `src/browser/bridge.js` registration at that point (this plan intentionally registers no bridge — `test/unit/bridge-registry.test.js` and `test/unit/stale-terms.test.js` both pass unchanged against the new module).
- No blockers. The sibling 66-02 plan (content/boards.js, run independently in this wave) and 66-04/66-05/66-06 (later waves) are unaffected by anything in this plan beyond the pinned view contract.

---
*Phase: 66-leaderboards-panel-local*
*Completed: 2026-09-23*

## Self-Check: PASSED

- FOUND: src/browser/boardsPanel.js
- FOUND: test/unit/boardsPanel-dom.test.js
- FOUND: test/unit/boardsPanel.test.js
- FOUND: .planning/phases/66-leaderboards-panel-local/66-03-SUMMARY.md
- FOUND commit: a85cf0a (Task 1)
- FOUND commit: b724b58 (Task 2)
- `npm test`: 4336 tests, 4329 pass, 7 fail — the 7 failures are exactly the pre-existing worktree CRLF doc-ledger failures named in this run's project notes (class-pass-ledger/flee-ledger/parley-flee-retune-adjacent tests), unchanged from the pre-execution baseline. No regressions.
