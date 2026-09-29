---
phase: 84-leaderboards-panel-v3
plan: 06
subsystem: ui
tags: [dom-renderer, css, leaderboards, boards-v3]

# Dependency graph
requires:
  - phase: 84-leaderboards-panel-v3
    provides: "84-05: src/browser/leaderboardView.js's leaderboardView(input) — the exact view shape (header, pickers, body, staleLine, standing, sheet, dock, row fields) this renderer draws"
provides:
  - "src/browser/leaderboardPanel.js — LEADERBOARD_CLASSES, renderLeaderboardPanel(host, view, handlers), the pure DOM renderer for the whole v3 Leaderboards panel"
  - "the .mw-lb-* CSS block in mazeworld.html (after the old .mw-bd-* block), giving the panel the mock's full look"
  - "test/unit/leaderboardPanel-dom.test.js and test/unit/leaderboard-css.test.js"
affects: [84-07, 84-08, 84-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "renderLeaderboardPanel follows boardsPanel.js's ensureSkeleton/el() pattern exactly: a second render on the same host reuses the .mw-lb root and its five section elements (head/pickers/body/dock/sheet), replacing only their CHILDREN, so the body's scroll position survives a row tap or picker change"
    - "the ▼ picker caret and the ◆ selected-option mark are CSS shapes (a border-triangle and a rotated currentColor square) — the JS only ever writes an empty span with an optional inline `color`, never a glyph or an HTML string; the ◀ back button stays a literal glyph, matching boardsPanel.js's own convention"
    - "the .mw-lb-* CSS block is additive alongside .mw-bd-* (new mw-lb- prefix), so the old panel keeps building and testing green until 84-08 switches the shell and 84-09 retires the old block"

key-files:
  created:
    - src/browser/leaderboardPanel.js
    - test/unit/leaderboardPanel-dom.test.js
    - test/unit/leaderboard-css.test.js
  modified:
    - mazeworld.html
    - tools/lib/voice-corpus.mjs

key-decisions:
  - "The RANK BY sheet's per-option colour (the mock's opt() col argument) is expressed only on the diamond mark (inline `style.color` when the option carries a `col` and is `on`), not on the option row's own left-edge bar — the row bar uses one CSS-driven gold bar for every `[data-on=\"1\"]` option, matching Task 1's already-tested `<behavior>` contract (which only pins the mark's colour) rather than inventing an untested inline box-shadow. The mark alone still carries the correct per-row stat colour."
  - "Tap-target sizing: `.mw-lb-picker` needed an explicit `min-height:44px` (its mock padding alone doesn't reliably clear 44px at every text-scale setting) — added during Task 2's CSS-test authoring, before any commit, so it isn't a separate deviation."
  - "`.mw-lb-sheet-panel` is `position:relative` (and painted after `.mw-lb-scrim`, which is `position:absolute`) so the panel visually sits above the scrim purely from CSS positioning + DOM order — no z-index arms race needed between the two."

requirements-completed: [BOARD-21, BOARD-22, BOARD-24]  # BOARD-18, BOARD-20 and BOARD-25 are also in this plan's frontmatter `requirements` field but this plan is NOT their last deliverer per the 84-01-PLAN.md phase source-audit table — see "Requirement Coverage" below.

coverage:
  - id: D1
    description: "renderLeaderboardPanel(host, view, handlers) draws the whole v3 panel from a view object alone (head, pickers, body, dock, sheet), reaching the page only through host.ownerDocument, building DOM only with createElement/textContent/dataset/style/hidden/onclick/appendChild/replaceChildren — never an HTML string — so a hostile handle/name/note/epitaph from another player's board doc renders verbatim as text"
    requirement: "BOARD-22"
    verification:
      - kind: unit
        ref: "test/unit/leaderboardPanel-dom.test.js — hostile-handle purity test, source pins (no document./window./globalThis., no .innerHTML=, no content/ import, no network identifier)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Rows show rank, the initials avatar (gold on-ring for your rows via avatar.on), the handle/hero name, the YOU tag (rendered only when non-empty), the line and the value with its unit; the top row wears the stat colour on rank/value/left-stripe, your own row a gold left bar; an open row adds the detail text, six stat chips and the Died date line (omitted when empty); a divider row renders before its row"
    requirement: "BOARD-22"
    verification:
      - kind: unit
        ref: "test/unit/leaderboardPanel-dom.test.js — row data-attrs/role/aria tests, top-row inline colour test, divider test, tag-only-when-non-empty test, open-row detail/six-chips/date-line test, date-line-omitted-when-empty test"
        status: pass
    human_judgment: false
  - id: D3
    description: "The header draws the ◀ back button only when view.header.back, the title/scope/season line (season hidden only when empty), and the header box as a button with data-action when it has one or a static element with data-static otherwise, wired to onBack/onBox"
    requirement: "BOARD-21"
    verification:
      - kind: unit
        ref: "test/unit/leaderboardPanel-dom.test.js — back-button/aria-label/onBack test, box-as-button/data-action/onBox test, box-as-static/data-static test, season-hidden-when-empty test"
        status: pass
    human_judgment: false
  - id: D4
    description: "Each of the three pickers is a button with data-picker/data-active, its label, its coloured value and an empty CSS-shaped caret span, calling onPicker(id); the empty/note body states, the standing card, the dock (dead-hero and title variants) and the bottom sheet (scrim, DONE, one option per entry with a CSS-shaped diamond mark, label/sub/count, dimming on zero-count options) all draw from the view alone and wire their handlers"
    requirement: "BOARD-24"
    verification:
      - kind: unit
        ref: "test/unit/leaderboardPanel-dom.test.js — picker tests, empty/note/stale/standing tests, dock tests (default + dead-hero variant), sheet tests (scrim/DONE/options/dim/on-colour/empty-n)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every class LEADERBOARD_CLASSES lists has a single-line CSS rule in mazeworld.html's head styles (84 .mw-lb* physical lines), every font-size scales with var(--mw-text-scale), every tappable surface is at least 44px, the caret is a CSS border-triangle and the option mark is a CSS rotated-square diamond (no glyph, no new PNG), and a re-render on the same host reuses the root/sections so the body's scroll survives a row tap"
    requirement: "BOARD-24"
    verification:
      - kind: unit
        ref: "test/unit/leaderboard-css.test.js (18 tests: selector coverage, font-size scaling, touch targets, caret/diamond shapes, row/option state rules, reduced motion, old-block-untouched) and test/unit/leaderboardPanel-dom.test.js's skeleton-reuse test"
        status: pass
    human_judgment: false

# Metrics
duration: ~50min
completed: 2026-09-29
status: complete
---

# Phase 84 Plan 06: Leaderboards Panel v3's DOM Renderer Summary

**renderLeaderboardPanel(host, view, handlers) — the pure DOM renderer that draws leaderboardView.js's output (head, pickers, rows, empty/note states, standing card, dock, bottom sheet) with a fully additive .mw-lb-* CSS block in mazeworld.html, the ▼ caret and ◆ selected-option mark drawn as CSS shapes**

## Performance

- **Duration:** ~50 min
- **Started:** 2026-09-29T10:28:00-04:00 (prior plan's close)
- **Completed:** 2026-09-29T11:18:00-04:00
- **Tasks:** 2
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments

- `src/browser/leaderboardPanel.js`: `renderLeaderboardPanel(host, view, handlers = {})` and `LEADERBOARD_CLASSES` (62 class names) — draws the head (back/title/scope/season/box), the three pickers, the body (stale line, rows with divider/tag/detail/six-stat-chips/date-line, empty state with CLEAR FILTERS, note state with SEE YOUR DEAD, standing card), the dock and the bottom sheet (scrim, DONE, options with a diamond mark, label/sub/count, dim/on states) — following `boardsPanel.js`'s `el()`/`ensureSkeleton()` skeleton-reuse pattern so a row tap or picker change never resets the body's scroll position
- `test/unit/leaderboardPanel-dom.test.js`: 32 recordingDom tests over hand-built views in the 84-05 shape — skeleton identity/reuse, every head/picker/row/body/dock/sheet behavior in the plan's `<behavior>` list, a hostile-handle purity test (`<img src=x onerror=...>` renders verbatim as text, no `<img>` element created), and source pins (no `document.`/`window.`/`globalThis.`, no `.innerHTML=`, no `content/` import, no network identifier, exports present exactly once)
- `mazeworld.html`: the `.mw-lb-*` CSS block (84 physical `.mw-lb` lines) added directly after the last `.mw-bd-*` rule, ported from `design/Mazeworld Boards Panel v3.dc.html`'s inline styles — every font-size `calc(<mock px / 16>rem * var(--mw-text-scale))`, the ▼ caret as a CSS border-triangle, the ◆ mark as a CSS rotated `currentColor` square, every tappable surface at least 44px, `.mw-lb-sheet` positioned absolutely over `.mw-lb` (`position:relative`), motion limited to `.mw-lb-detail`/`.mw-lb-sheet`/`.mw-lb-sheet-panel` reusing the existing `mwrise`/`mwfade` keyframes under the blanket reduced-motion rule
- `test/unit/leaderboard-css.test.js`: 18 tests — every `LEADERBOARD_CLASSES` selector exists, font-size scaling, structural layout, 44px touch targets across every tappable class, the caret/diamond CSS-shape pins, the your-row gold bar and sheet-option dim/selected-state pins, reduced-motion scoping, and that the old `.mw-bd-*` block is untouched
- `tools/lib/voice-corpus.mjs`: `src/browser/leaderboardPanel.js` registered in the boards `RAW_SURFACES` entry and the 79-09 ownership rule's `modules` list
- `node --test test/unit/leaderboardPanel-dom.test.js test/unit/voice-corpus.test.js`: 93/93 pass; `node --test test/unit/leaderboard-css.test.js test/unit/boards-css.test.js test/unit/hud-menu-layout.test.js`: 58/58 pass; full `npm test`: 8489 pass / 2 skipped (pre-existing) / 0 fail; `git status --porcelain -- engine test/parity content` empty

## Task Commits

Each task was committed atomically:

1. **Task 1: renderLeaderboardPanel and LEADERBOARD_CLASSES** - `9ac753db` (feat)
2. **Task 2: the .mw-lb-* CSS block and test/unit/leaderboard-css.test.js** - `4562df70` (feat)

_Task 1 is `tdd="true"`: `test/unit/leaderboardPanel-dom.test.js` was written and run first (confirmed RED — `Cannot find module '...leaderboardPanel.js'`), then `src/browser/leaderboardPanel.js` and the `tools/lib/voice-corpus.mjs` registration landed together with the already-written test, all green, in one `9ac753db` commit (GREEN), matching this plan set's established precedent (84-02 through 84-05). Task 2 is not `tdd="true"`; its CSS and its test were authored and verified together before the single `4562df70` commit._

## Files Created/Modified

- `src/browser/leaderboardPanel.js` - the pure DOM renderer (new)
- `test/unit/leaderboardPanel-dom.test.js` - 32 tests (new)
- `mazeworld.html` - the `.mw-lb-*` CSS block appended after `.mw-bd-*`
- `test/unit/leaderboard-css.test.js` - 18 tests (new)
- `tools/lib/voice-corpus.mjs` - `leaderboardPanel.js` added to the boards `RAW_SURFACES` entry and the 79-09 ownership rule's `modules` list

## Decisions Made

- The RANK BY sheet's per-option stat colour is expressed only on the diamond mark, not on the option row's own left bar (which stays a single CSS-driven gold bar for every selected option) — this matches Task 1's own tested `<behavior>` contract (only the mark's inline colour is pinned) rather than adding an untested inline box-shadow to satisfy the interfaces block's supplementary mock-fidelity note; the mark alone still carries the distinguishing colour
- `.mw-lb-picker` needed an explicit `min-height:44px` (discovered while writing the CSS test, before any commit — not a deviation, just authoring-time correction)
- `.mw-lb-sheet-panel` is `position:relative` so it paints above the `position:absolute` `.mw-lb-scrim` purely from CSS positioning rules + DOM order, with no z-index needed between the two

## Deviations from Plan

None — plan executed exactly as written. No Rule 1/2/3 auto-fixes were needed. The CSS test file was authored after the CSS block rather than strictly before it (Task 2 is not `tdd="true"`, so no RED/GREEN gate applies); both were verified together before the single Task 2 commit.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Requirement Coverage

This plan's frontmatter lists `requirements: [BOARD-18, BOARD-20, BOARD-21, BOARD-22, BOARD-24, BOARD-25]`. Per the phase source-audit table in `84-01-PLAN.md`, this plan is the **last deliverer for BOARD-21, BOARD-22 and BOARD-24** — marked complete in `REQUIREMENTS.md`. The other three still need a later plan:

- BOARD-18: needs 84-08 (last deliverer — the shell wiring)
- BOARD-20: needs 84-09 (last deliverer — the old-panel retirement pass)
- BOARD-25: needs 84-08 (last deliverer — the shell wiring)

This plan delivers the full DOM-rendering surface every one of those requirements' remaining UI-wiring plans consumes — partial coverage, correctly left `[ ]` pending in `REQUIREMENTS.md` for all three.

## Human verification (deferred to end of run)

None for this plan on its own — the panel is not yet wired into the shell (no controller, no live host). The renderer is proven entirely by `test/unit/leaderboardPanel-dom.test.js`'s recordingDom coverage and `test/unit/leaderboard-css.test.js`'s CSS pins. The panel's device checks (visual look, tap targets, sheet overlay, reduced motion) land in the batched Pixel 7 checklist once 84-08's shell wiring makes it reachable in-app, per this plan's own `<output>` instruction.

## Next Phase Readiness

- `src/browser/leaderboardPanel.js`'s full API (`renderLeaderboardPanel`, `LEADERBOARD_CLASSES`) is ready for 84-07's stateful controller to call on every change (open/board/picker/sheet/row state), following `createBoardsPanel`'s existing seams (`openFromTab`, `openFromTitle`, `onDeadTab`, `back`, `refresh`).
- The `.mw-lb-*` CSS block is fully additive — the old `.mw-bd-*` block and its own tests (`boards-css.test.js`, `boardsPanel-dom.test.js`) are untouched and still green, so 84-07/84-08 can wire the new panel without breaking the old one until 84-09's retirement pass.
- No blockers for 84-07 through 84-09.

---
*Phase: 84-leaderboards-panel-v3*
*Completed: 2026-09-29*

## Self-Check: PASSED

All 5 created/modified files verified present on disk (`src/browser/leaderboardPanel.js`, `test/unit/leaderboardPanel-dom.test.js`, `mazeworld.html`, `test/unit/leaderboard-css.test.js`, `tools/lib/voice-corpus.mjs`); both task commits (`9ac753db`, `4562df70`) verified present in `git log`.
