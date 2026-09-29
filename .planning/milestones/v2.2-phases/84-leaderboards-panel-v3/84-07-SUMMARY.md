---
phase: 84-leaderboards-panel-v3
plan: 07
subsystem: ui
tags: [dom-controller, leaderboards, boards-v3, state-machine, caching]

# Dependency graph
requires:
  - phase: 84-leaderboards-panel-v3
    provides: "84-04: src/browser/boardFeed.js's {load, cached, clear} — the LEADERBOARD data source this controller calls as its injected `board` seam"
  - phase: 84-leaderboards-panel-v3
    provides: "84-05: src/browser/leaderboardView.js's leaderboardView(input) — the pure view this controller calls as its injected `buildView` seam"
  - phase: 84-leaderboards-panel-v3
    provides: "84-06: src/browser/leaderboardPanel.js's renderLeaderboardPanel(host, view, handlers) — the DOM renderer this controller's render() calls directly (same file, module-private call, not an injected seam)"
provides:
  - "src/browser/leaderboardPanel.js — BOARDS_LAST_KEY, createLeaderboardPanel({host, buildView, history, board, competeOn, prefs, now, tzOffset, season, reducedMotion, onRoute}) -> {openFromTab, openFromTitle, onDeadTab, back, isTitleOpen, refresh, state}, the v3 panel's stateful controller with createBoardsPanel's exact seam names"
  - "src/browser/leaderboardView.js — RACE_IDS/SUB_IDS now exported (were module-private) so the controller can validate a RACE/SUB-CLASS sheet pick without importing content/ directly"
affects: [84-08, 84-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A load token (bumped on every requestBoard() call) plus an entry===null check on settle: a load's answer is applied only when it is still the most recent request for the currently-open panel — an older query's late answer, or any answer after the panel routed away, never overwrites a newer view"
    - "mode (the panel's own LEADERBOARD/YOUR DEAD selection) is explicit controller state, not re-derived from Compete on every render: refresh() flips it to 'mine' the instant Compete goes off (so a later Compete-on refresh shows YOUR DEAD's EVERYONE box, not an unrequested jump back to LEADERBOARD), while leaderboardView's own compete-gated formula is what actually forces mine mode for headers/box copy on every single render as a second, redundant safety net"
    - "leaderboardPanel.js validates a RACE/SUB-CLASS sheet pick against RACE_IDS/SUB_IDS re-exported from leaderboardView.js — not against content/races.js or content/classes.js directly — so the file's own 84-06 source-pin test (\"no import from content/\", board rows carry untrusted text) keeps holding even though this controller now needs id validation"

key-files:
  created:
    - test/unit/leaderboardPanel.test.js
  modified:
    - src/browser/leaderboardPanel.js
    - src/browser/leaderboardView.js
    - tools/lib/voice-corpus.mjs

key-decisions:
  - "Task 1 (opening/views/stat-memory/filters/sheets/rows/routing) and Task 2 (cached-first board loading, race-safe redraws, refresh() Compete transitions) landed in one commit instead of two: Task 1's own behavior already requires calling the board seam (openFromTab with Compete on, back() returning to LEADERBOARD), so the two tasks share the same requestBoard() function and could not be split into an independently meaningful intermediate diff without inventing a throwaway partial implementation"
  - "requestBoard()'s reset:true/false split mirrors createBoardsPanel's own convention exactly: every state-changing action (open, box switch, filter/stat pick, back-to-LEADERBOARD) resets the body scroll; a resolved/rejected load's own redraw never does, matching the plan's 'without resetting the body scroll' requirement"
  - "onSheetPick validates race/sub/stat values defensively even though every real click originates from an already-valid rendered option (RACE_IDS/SUB_IDS/BOARD_STATS-derived) — a directly-invoked bad value must still be inert, both for defense-in-depth and so an invalid filter can never leak into a board.load() query"

requirements-completed: []  # BOARD-18, BOARD-19, BOARD-20, BOARD-22, BOARD-23, BOARD-25 are in this plan's frontmatter `requirements` field but NONE are marked complete in REQUIREMENTS.md — per the phase source-audit table in 84-01-PLAN.md, this plan is not the last deliverer for any of the six (BOARD-18/19/25 need 84-08; BOARD-20 needs 84-09; BOARD-22/23 are not even listed against 84-07 in the audit table — their last deliverer was already 84-06/84-05). See "Requirement Coverage" below.

coverage:
  - id: D1
    description: "createLeaderboardPanel opens on LEADERBOARD (board mode) when Compete is on and YOUR DEAD (mine mode) when Compete is off, from both the DEAD tab (openFromTab) and the title (openFromTitle, setting body[data-boards-entry=title] and isTitleOpen() true); openFromTab always clears the title marker"
    requirement: "BOARD-18"
    verification:
      - kind: unit
        ref: "test/unit/leaderboardPanel.test.js — openFromTab Compete-on/off mode tests, openFromTitle marker/dock tests"
        status: pass
    human_judgment: false
  - id: D2
    description: "LEADERBOARD's data source is cache-first (board.cached(query) renders at once with zero network calls) or a single board.load(query) behind a loading note; a load token plus an entry-closed check means a stale or out-of-order answer, or an answer arriving after the panel routed away, never overwrites a newer view; a rejecting load resolves to the unreachable note with SEE YOUR DEAD"
    requirement: "BOARD-19"
    verification:
      - kind: unit
        ref: "test/unit/leaderboardPanel.test.js — cached-hit/no-cache-then-load, two-queries-reverse-order, routed-away-no-redraw, and rejecting-load tests"
        status: pass
    human_judgment: false
  - id: D3
    description: "Only the RANK BY stat is remembered between opens under ddr.boards.last.v1 (a retired/garbage id or a throwing prefs.getItem falls back to DEPTH, a throwing setItem never breaks the pick); RACE and SUB-CLASS filters are always null on a fresh open, even when set on a prior open"
    requirement: "BOARD-20"
    verification:
      - kind: unit
        ref: "test/unit/leaderboardPanel.test.js — stat memory tests (store/recall, retired-id/garbage/throw fallback, throwing setItem), filters-reset-on-open test"
        status: pass
    human_judgment: false
  - id: D4
    description: "The header box switches views (onBox/onSeeMine), sheets open/close/pick with scroll-reset semantics matching createBoardsPanel's own convention, row toggling never resets scroll, CLEAR FILTERS keeps the stat, and the dead-hero dock (FINAL SHEET keeps the entry, BURY THEM clears it) plus the title footers route through the injected onRoute seam exactly as createBoardsPanel's onDock did"
    requirement: "BOARD-25"
    verification:
      - kind: unit
        ref: "test/unit/leaderboardPanel.test.js — RACE sheet, onSheetPick unknown-value/unknown-sheetId, onRow, onClear, onBox/onSeeMine, back(), onDock and onDeadTab tests"
        status: pass
    human_judgment: false
  - id: D5
    description: "refresh() does nothing while closed; a Compete-off transition switches LEADERBOARD to YOUR DEAD (INTERRED box) with zero board calls; a Compete-on transition from YOUR DEAD fetches the EVERYONE total exactly once (cache-first, skipped entirely when board.cached already answers) without leaving YOUR DEAD for LEADERBOARD"
    requirement: "BOARD-25"
    verification:
      - kind: unit
        ref: "test/unit/leaderboardPanel.test.js — refresh() Compete-off, Compete-on (load-once and cached-skip variants), and no-open-panel tests"
        status: pass
    human_judgment: false

# Metrics
duration: ~45min
completed: 2026-09-29
status: complete
---

# Phase 84 Plan 07: Leaderboards Panel v3's Controller Summary

**createLeaderboardPanel — the stateful controller wiring leaderboardView (84-05) and boardFeed (84-04) into the v3 renderer (84-06), keeping createBoardsPanel's exact seam names for a drop-in shell swap, with cache-first LEADERBOARD loading and a load token that keeps a stale query's answer from ever overwriting a newer view**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-09-29T14:30:00Z (prior plan's close)
- **Completed:** 2026-09-29T15:15:44Z
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- `src/browser/leaderboardPanel.js`: `BOARDS_LAST_KEY` and `createLeaderboardPanel({host, buildView, history, board, competeOn, prefs, now, tzOffset, season, reducedMotion, onRoute})` returning `{openFromTab, openFromTitle, onDeadTab, back, isTitleOpen, refresh, state}` — the exact seven-method seam `createBoardsPanel` already has, so 84-08's shell swap is a drop-in.
- Opening: Compete decides the starting view (ON -> LEADERBOARD/`board` mode, OFF -> YOUR DEAD/`mine` mode, never touching the board seam at all); `openFromTitle` sets `body[data-boards-entry=title]` and docks the title footers; `openFromTab` always clears the marker. Every open re-derives the remembered `RANK BY` stat from `prefs` under `ddr.boards.last.v1` (tolerant of a retired/garbage id or a throwing `getItem`) and resets `RACE`/`SUB-CLASS` to null.
- LEADERBOARD's data source (`requestBoard()`): `board.cached(query)` answers at once with zero network calls when fresh; otherwise the loading note renders and `board.load(query)` is called exactly once. A load token bumped on every request, plus an `entry === null` check on settle, means a stale or out-of-order answer — or any answer arriving after the panel routed away — never overwrites a newer view. A rejecting `load` resolves to the unreachable note with SEE YOUR DEAD.
- Filters/sheets/rows/routing: `onSheetPick` validates a RACE/SUB-CLASS/RANK BY value against `RACE_IDS`/`SUB_IDS` (now exported from `leaderboardView.js`) and `BOARD_STATS`, ignoring anything invalid; `onRow` toggles without resetting scroll; `onClear` keeps the stat; `onBox`/`onSeeMine` switch views; `back()` closes a sheet, then returns YOUR DEAD to LEADERBOARD while Compete is on, then routes a title-opened panel, else returns false; `onDock` mirrors `createBoardsPanel`'s dead-hero dock exactly (FINAL SHEET keeps the entry, BURY THEM clears it).
- `refresh()`: does nothing while closed; a Compete-off transition flips LEADERBOARD to YOUR DEAD (INTERRED box) with zero board calls; a Compete-on transition from YOUR DEAD fetches the EVERYONE total exactly once (cache-first — skipped when `board.cached` already answers), without leaving YOUR DEAD for LEADERBOARD.
- `node --test test/unit/leaderboardPanel.test.js test/unit/leaderboardPanel-dom.test.js`: 66/66 pass. Full `npm test`: 8523 pass, 0 fail, 2 skipped (pre-existing), exit 0. `git status --porcelain -- engine test/parity content`: empty.

## Task Commits

Task 1 (opening/views/stat-memory/filters/sheets/rows/routing) and Task 2 (cached-first board loading, race-safe redraws, refresh() Compete transitions) landed together in one commit — see "Decisions Made" for why:

1. **Tasks 1+2: createLeaderboardPanel — opening, views, stat memory, filters, sheets, rows, routing and board loading** - `8c2eaa0c` (feat)

_Both tasks' test cases and implementation were written together, verified green, then committed as one unit (RED confirmed by `createLeaderboardPanel`/`BOARDS_LAST_KEY` not existing in `src/browser/leaderboardPanel.js` before this plan — the module only exported `renderLeaderboardPanel`/`LEADERBOARD_CLASSES`, per 84-06)._

## Files Created/Modified

- `src/browser/leaderboardPanel.js` - `BOARDS_LAST_KEY`, `createLeaderboardPanel` (new)
- `test/unit/leaderboardPanel.test.js` - 34 controller tests (new)
- `src/browser/leaderboardView.js` - `RACE_IDS`/`SUB_IDS` exported (were module-private); no behavior change
- `tools/lib/voice-corpus.mjs` - registers `leaderboardView.js`'s newly-exported `SUB_IDS` as a non-copy export

## Decisions Made

- Task 1 and Task 2 landed in one commit instead of two: Task 1's own behavior (`openFromTab` with Compete on, `back()` returning to LEADERBOARD) already requires calling the board seam, so both tasks share `requestBoard()` and could not be split into an independently meaningful intermediate diff.
- `mode` (LEADERBOARD vs. YOUR DEAD) is controller state that `refresh()` explicitly flips to `"mine"` the instant Compete goes off, rather than being silently re-derived from Compete on every render — this is what makes a later Compete-on `refresh()` show YOUR DEAD's EVERYONE box (not an unrequested jump back to LEADERBOARD), matching the plan's own `<behavior>` text precisely. `leaderboardView`'s own compete-gated formula (`mode = compete && raw.mode === "board" ? "board" : "mine"`) still runs on every render as a second, redundant safety net.
- `onSheetPick` validates race/sub/stat picks defensively (against `RACE_IDS`/`SUB_IDS`/`BOARD_STATS`) even though every real tap originates from an already-valid rendered option, so a directly-invoked bad value is provably inert and can never leak into a `board.load()` query.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Exported RACE_IDS/SUB_IDS from leaderboardView.js instead of importing content/ directly into leaderboardPanel.js**
- **Found during:** Task 1 (onSheetPick's RACE/SUB-CLASS validation)
- **Issue:** Validating a RACE/SUB-CLASS sheet pick needs the canon id lists, but importing `content/races.js`/`content/classes.js` directly into `src/browser/leaderboardPanel.js` would have broken that file's own 84-06 source-pin test (`test/unit/leaderboardPanel-dom.test.js`'s "no import from content/" assertion — board rows carry other players' untrusted text, and that pin keeps the file's import surface auditable at a glance).
- **Fix:** Exported the already-computed, already-correct `RACE_IDS`/`SUB_IDS` module-private consts from `src/browser/leaderboardView.js` (zero behavior change to that module) and imported them into `leaderboardPanel.js` from `"./leaderboardView.js"` instead — a sibling `src/browser/` path, not a `/content/` one, so the source-pin test keeps holding.
- **Files modified:** src/browser/leaderboardView.js, src/browser/leaderboardPanel.js
- **Verification:** `node --test test/unit/leaderboardPanel-dom.test.js` still 32/32 pass (the "no import from content/" pin holds); `node --test test/unit/leaderboardView.test.js` still 85/85 pass.
- **Committed in:** `8c2eaa0c` (part of the task commit)

**2. [Rule 3 - Blocking] Registered leaderboardView.js's SUB_IDS in tools/lib/voice-corpus.mjs's non-copy list**
- **Found during:** running `npm test` after the RACE_IDS/SUB_IDS export above
- **Issue:** The newly-exported `SUB_IDS` (containing multi-word sub-class names like "Court Mage") tripped `test/unit/voice-corpus.test.js`'s completeness gate, which requires every copy-bearing export to be registered as a bank, a content table, or a non-copy export with a reason.
- **Fix:** Added `nonCopy("src/browser/leaderboardView.js", "SUB_IDS", ...)` to `tools/lib/voice-corpus.mjs`'s `NON_COPY_EXPORTS`, matching the existing `boardsView.js#LINEAGE_SUBS` precedent (sub-class name ids, not sentences). `RACE_IDS` did not trip the same gate (single-word race names apparently don't match the scanner's sentence-like heuristic).
- **Files modified:** tools/lib/voice-corpus.mjs
- **Verification:** `node --test test/unit/voice-corpus.test.js` 29/29 pass; full `npm test` 8523/8523 pass, 0 fail.
- **Committed in:** `8c2eaa0c` (part of the task commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking, both minimal and backward-compatible)
**Impact on plan:** Neither changes any shipped behavior; both were necessary so the controller's own defensive validation could satisfy two pre-existing test gates (84-06's source-pin test and the voice-corpus completeness gate) without weakening either. No scope creep.

## Issues Encountered

None beyond the two deviations above.

## User Setup Required

None - no external service configuration required.

## Human verification (deferred to end of run)

None for this plan on its own — it ships no new visible UI surface (the controller drives the already-shipped 84-06 renderer through unit tests over a recording DOM, not a live device). The panel is not yet wired into the shell (that is 84-08); the batched Pixel 7 device checklist for the whole v3 Leaderboards panel is deferred to 84-08's SUMMARY per this plan's own `<output>` instruction.

## Requirement Coverage

This plan's frontmatter lists `requirements: [BOARD-18, BOARD-19, BOARD-20, BOARD-22, BOARD-23, BOARD-25]`, but none are marked complete in `REQUIREMENTS.md`. Per the phase source-audit table in `84-01-PLAN.md`:

- BOARD-18: also needs **84-08** (last deliverer — the shell wiring)
- BOARD-19: also needs **84-08** (last deliverer)
- BOARD-20: also needs **84-09** (last deliverer — the old-panel retirement pass)
- BOARD-22: the audit table does not list 84-07 at all — its last deliverer was already **84-06**
- BOARD-23: the audit table does not list 84-07 at all — its last deliverer was already **84-05**
- BOARD-25: also needs **84-08** (last deliverer)

This plan delivers the full controller behavior those later plans need (opening/views/stat-memory/filters/sheets/rows/routing, cache-first board loading, race-safe redraws, refresh() Compete transitions) — partial coverage, correctly left `[ ]` pending until 84-08/84-09 land.

## Next Phase Readiness

- `createLeaderboardPanel`'s full seven-method seam (`openFromTab`, `openFromTitle`, `onDeadTab`, `back`, `isTitleOpen`, `refresh`, `state`) is ready for 84-08 to wire into `mazeworld.html` in place of `createBoardsPanel`, supplying the real `boardFeed` (84-04), `leaderboardView` (84-05), the local run-history reader (84-03), `window.localStorage`/Preferences for `prefs`, and the real Compete setting for `competeOn()`.
- No blockers for 84-08 or 84-09.

---
*Phase: 84-leaderboards-panel-v3*
*Completed: 2026-09-29*

## Self-Check: PASSED

All created/modified files and the task commit hash (`8c2eaa0c`) were verified present on disk and in git log.
