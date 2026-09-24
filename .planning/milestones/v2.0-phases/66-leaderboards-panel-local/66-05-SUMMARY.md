---
phase: 66-leaderboards-panel-local
plan: 05
subsystem: ui
tags: [css, dark-theme, leaderboards-panel, text-scale, reduced-motion]

# Dependency graph
requires:
  - phase: 66-leaderboards-panel-local
    provides: "src/browser/boardsPanel.js (66-03): BOARDS_CLASSES (every emitted class name) and the exact data-* attribute contract (data-on/data-dim/data-top/data-podium/data-you/data-open/data-long/data-primary) this CSS pass styles"
provides:
  - "mazeworld.html: the .mw-bd-* CSS block styling every BOARDS_CLASSES selector, ported from design/Mazeworld Boards Panel.dc.html and design/Mazeworld Leaderboards.dc.html onto the dark palette"
  - "mazeworld.html: #screen-dead's edge-to-edge layout reset (side/bottom padding zeroed), the pinned top safe-area padding line untouched"
  - "mazeworld.html: body[data-boards-entry=\"title\"] rules hiding #mw-tabbar and #mw-rail (D-01); no change on tab entry (D-02)"
  - "test/unit/boards-css.test.js: the CSS completeness/text-scale/layout/title-mode/reduced-motion pin suite"
affects: ["66-06-boards-wiring", "69-compliance-device-close"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CSS-only presentation plan ahead of markup wiring: the full .mw-bd-* stylesheet lands and is pinned by test before 66-06 swaps #screen-dead's markup, so that later plan is wiring-only"
    - "Text-scale convention (Gear tab precedent): every .mw-bd font-size is calc(<mock-px / 16>rem * var(--mw-text-scale)) rather than a new custom property per size"

key-files:
  created:
    - test/unit/boards-css.test.js
  modified:
    - mazeworld.html

key-decisions:
  - "Reused the existing @keyframes mwrise (mazeworld.html, translateY(16px)) for .mw-bd-detail's rise-in instead of adding a second mwrise definition at 8px as the plan's literal text suggested — the plan itself says 'if it does not already exist,' and the CSS pin test requires exactly one @keyframes mwrise in the file."
  - "Only .mw-bd-detail (the tap-expand rise) and .mw-bd-bar-fill (the value-bar width) declare animation/transition among the .mw-bd-* rules, so the blanket prefers-reduced-motion rule removes 100% of the panel's own motion; every button-classed element still inherits the global button{} transition, which the same blanket rule already neutralizes."
  - "Podium/YOU row highlighting (rank/handle/name/tag colours, the gold stripe) is pure CSS keyed off data-podium/data-you, matching 66-03's own choice to leave those to this plan; only the per-board TOP-row colour (already inline from boardsPanel.js) stays JS-driven, since it's a per-board hex value, not a fixed token."
  - "test/unit/boards-css.test.js concatenates every <style> block in <head> (mazeworld.html interleaves <title>/<meta> between separate <style> tags) rather than assuming a single contiguous block, since the .mw-bd-* rules and the pinned #screen-dead line live in a later <style> tag than the :root token block gear-tab-dom.test.js anchors on."

requirements-completed: [BOARD-01, BOARD-02, BOARD-03, BOARD-04, BOARD-06]

coverage:
  - id: D1
    description: "Every class in boardsPanel.js's BOARDS_CLASSES has at least one CSS rule in mazeworld.html, ported from the mock's inline styles onto the dark palette"
    requirement: "BOARD-02"
    verification:
      - kind: unit
        ref: "test/unit/boards-css.test.js#CSS: every BOARDS_CLASSES entry appears as a selector in mazeworld.html"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every .mw-bd font size scales with the player's text-size setting via calc(<rem> * var(--mw-text-scale)), matching the Gear tab convention"
    requirement: "BOARD-02"
    verification:
      - kind: unit
        ref: "test/unit/boards-css.test.js#CSS: every .mw-bd* font-size declaration scales with var(--mw-text-scale)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The panel is a full-height column (head/strip/rail/board head/dock fixed, body scrolls on its own); #screen-dead is edge to edge with the pinned top safe-area line untouched"
    requirement: "BOARD-02"
    verification:
      - kind: unit
        ref: "test/unit/boards-css.test.js#CSS: .mw-bd is a full-height flex column; #CSS: .mw-bd-body scrolls independently; #CSS: the pinned #screen-dead padding-top line is untouched, and a separate rule zeroes the side/bottom padding"
        status: pass
    human_judgment: false
  - id: D4
    description: "The board rail scrolls horizontally with a hidden scrollbar and never wraps its chips; the chevron is 44x44, dock buttons are at least 48px tall, and rows/chips use touch-action:manipulation"
    requirement: "BOARD-06"
    verification:
      - kind: unit
        ref: "test/unit/boards-css.test.js#CSS: .mw-bd-rail scrolls horizontally; #CSS: .mw-bd-back is a 44x44 target; #CSS: .mw-bd-dock-btn is at least 48px tall; #CSS: .mw-bd-row uses touch-action:manipulation"
        status: pass
    human_judgment: false
  - id: D5
    description: "While the panel is open from the title, the game tab bar and the rail are hidden (D-01); on tab entry nothing is hidden (D-02)"
    requirement: "BOARD-01"
    verification:
      - kind: unit
        ref: "test/unit/boards-css.test.js#CSS: the two title-mode chrome rules exist exactly"
        status: pass
    human_judgment: false
  - id: D6
    description: "The row-expand rise and the value-bar width change are ordinary CSS animation/transition, removable by the existing blanket prefers-reduced-motion rule; no other .mw-bd rule carries motion"
    requirement: "BOARD-03"
    verification:
      - kind: unit
        ref: "test/unit/boards-css.test.js#CSS: the blanket prefers-reduced-motion rule still exists; #CSS: only .mw-bd-detail and .mw-bd-bar-fill declare animation or transition; #CSS: @keyframes mwrise is defined exactly once"
        status: pass
    human_judgment: false
  - id: D7
    description: "The panel matches the mock's look at text size M and stays usable at the largest text size (header/strip/rail don't crowd the list); chips are comfortable to tap"
    human_judgment: true
    rationale: "Requires a real device/browser render at multiple text-size settings to judge crowding and tap comfort visually — unit tests prove every font-size scales and every touch target meets its minimum, but not the resulting visual layout at the largest scale. Deferred to the Phase 69 UAT batch per project convention (verification agents off this run)."

# Metrics
duration: 35min
completed: 2026-09-23
status: complete
---

# Phase 66 Plan 05: Leaderboards Panel CSS Summary

**Ports the mock's Leaderboards panel styling into mazeworld.html as one `.mw-bd-*` CSS block on the dark palette — every emitted class styled, every font-size text-scale-aware, the title-mode chrome and #screen-dead layout reset in place, and the panel's only motion (the row-detail rise and the value-bar fill) left entirely to the existing blanket reduced-motion rule.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-09-23T23:35:00Z (approx.)
- **Completed:** 2026-09-23T24:10:00Z (approx.)
- **Tasks:** 2
- **Files modified:** 2 (1 modified, 1 created)

## Accomplishments
- Added an 89-line `.mw-bd-*` CSS block directly after the pinned `#screen-dead{padding-top:...}` line: head/strip/rail/board-head/body/dock skeleton layout, the identity strip and its ALL/FRIENDS scope chips (dimmed signed-out state), the seven-chip board rail (hidden scrollbar, never wraps), rows (top/podium/you highlighting, the min-max value bar, tap-expand detail with stat chips), the standing card, the footnote, and the title-mode dock buttons — every colour, padding, gap and box-shadow ported verbatim from `design/Mazeworld Boards Panel.dc.html` / `design/Mazeworld Leaderboards.dc.html`.
- `#screen-dead` gained a second, edge-to-edge layout rule (`padding-left:0;padding-right:0;padding-bottom:0;height:100%`) while the pinned top safe-area padding line stayed byte-identical.
- `body[data-boards-entry="title"] #mw-tabbar{display:none}` and `#mw-rail{display:none}` implement D-01 (title-opened chrome); tab entry sets no such marker, so D-02 holds with zero extra CSS.
- Every panel button (`.mw-bd-back`, `.mw-bd-chip`, `.mw-bd-scope-chip`, `.mw-bd-dock-btn`) resets the global `button{}` defaults explicitly (border, border-radius:0, box-shadow, min-height/padding), the same way `.mw-tab` does.
- Created `test/unit/boards-css.test.js` (13 tests): BOARDS_CLASSES selector-completeness, text-scale scaling on every font-size, the structural layout assertions, the touch-target minimums, the two title-mode rules, the pinned `#screen-dead` line plus its new sibling, the reduced-motion rule and its two-rule motion allowlist, and the single `@keyframes mwrise` definition.

## Task Commits

Each task was committed atomically:

1. **Task 1: the .mw-bd CSS block, the #screen-dead layout reset and the title-mode rules** - `5c5b165` (feat)
2. **Task 2: the panel CSS pin test** - `7334d47` (test)

**Plan metadata:** (this commit) — SUMMARY.md only (STATE.md/ROADMAP.md are owned by the orchestrator, per this plan's worktree instructions)

## Files Created/Modified
- `mazeworld.html` - the `.mw-bd-*` CSS block (89 lines) inserted after the pinned `#screen-dead{padding-top:...}` line; no markup, script or classic-renderer change
- `test/unit/boards-css.test.js` - 13 tests pinning the CSS block's completeness, text-scale, layout, touch targets, title-mode chrome, the pinned line, and reduced motion

## Decisions Made
- Reused the file's existing `@keyframes mwrise` (translateY(16px), already present for the MARKS legend sheet) for `.mw-bd-detail` rather than adding a duplicate at the mock's literal 8px — the plan's own action text says to add it "if it does not already exist," and the pin test requires exactly one definition in the file.
- Podium/YOU row highlighting is pure CSS via `data-podium`/`data-you` attribute selectors (fixed tokens: `#c9bda0` podium rank, `#e8c97a` YOU stripe/handle/tag), matching 66-03's SUMMARY note that only the per-board TOP-row colour needed to stay inline (a variable hex per board, not a fixed token).
- The CSS pin test concatenates every `<style>` block found in `<head>` rather than anchoring on a single block like `gear-tab-dom.test.js` does, since mazeworld.html interleaves `<title>`/`<meta>` tags between several `<style>` elements and the new `.mw-bd-*` rules live in a later block than the `:root` token block.

## Deviations from Plan

None - plan executed exactly as written. The one departure from the plan's literal action text (reusing the existing `@keyframes mwrise` instead of adding a second one at 8px) is explicitly permitted by the plan's own "if it does not already exist" clause and is required to satisfy the plan's own acceptance criterion that `@keyframes mwrise` be defined exactly once.

## Issues Encountered
None.

## Human verification (deferred to end of run)

Per project convention (verification agents off; UAT batched at the Phase 69 milestone close), these device/visual checks are recorded here for that batch rather than gating this plan:
- The panel matches the mock's look at text size M.
- The panel stays usable at the largest text size — the header, strip and rail do not crowd out the list.
- The rail chips and row-tap targets are comfortable to tap on a real device.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The full `.mw-bd-*` stylesheet is in place and pinned by test, ready for 66-06 to wire `boardsPanel.js`'s `renderBoardsPanel`/`createBoardsPanel` into `#screen-dead`'s markup and the title screen as a pure wiring change (no new CSS expected).
- The sibling 66-04 plan (the pure `boardsView` view model, run independently in this wave, touching no shared file) is unaffected by anything in this plan.
- No blockers.

---
*Phase: 66-leaderboards-panel-local*
*Completed: 2026-09-23*

## Self-Check: PASSED

- FOUND: mazeworld.html
- FOUND: test/unit/boards-css.test.js
- FOUND: .planning/phases/66-leaderboards-panel-local/66-05-SUMMARY.md
- FOUND commit: 5c5b165 (Task 1)
- FOUND commit: 7334d47 (Task 2)
- `npm test`: 4393 tests, 4386 pass, 7 fail — the 7 failures are exactly the pre-existing worktree CRLF doc-ledger failures named in this run's project notes (class-pass-ledger/flee-ledger/parley-flee-retune-adjacent tests), unchanged from the pre-execution baseline. No regressions.
