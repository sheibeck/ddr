---
phase: 65-run-record-personal-bests
plan: 05
subsystem: ui
tags: [death-panel, presentation-bridge, tdd, voice]

# Dependency graph
requires:
  - phase: 65-run-record-personal-bests (Plan 03)
    provides: "content/boards.js BOARD_COPY/NEW_BEST_HEAD/NEW_BEST_LINES/FIRST_DEATH_LINES, src/browser/newBest.js#newBestView(report)"
  - phase: 65-run-record-personal-bests (Plan 04)
    provides: "src/browser/engineAdapter.js#takeDeathRecord(), the one-shot { first, newBests, summary } death report"
provides:
  - "window.__mzDeathRecord — a presentation-only bridge parcel (registered in src/browser/bridge.js, documented in docs/SHELL-MODULES.md) parked on a died event and cleared on the title screen"
  - "renderNewBestBlock(host, view) — the classic THAT IS THAT gold NEW PERSONAL BEST block, and its wiring into renderCombatOver's dead branch"
  - ".cb-over-best/-head/-row/-quip CSS on the dark over-panel palette"
affects: [66-leaderboards-panel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Death-panel presentation parcels follow the window.__mzFightEnd precedent: set once at the shell's single dispatch call site (dispatchWithNarration) on the relevant event, reset at the title screen, never a field on S/state"

key-files:
  created:
    - test/unit/shell-new-best.test.js
  modified:
    - mazeworld.html
    - src/browser/bridge.js
    - docs/SHELL-MODULES.md

key-decisions:
  - "The module-side function-region test helper (fnRegion, borrowed from shell-combat-over.test.js) only matches zero-indent \"\\nfunction \" boundaries, which the classic script uses but the indented <script type=\"module\"> body does not. Added a second helper (indentedFnRegion) using /\\n[ \\t]*function / for dispatchWithNarration/showTitleScreen region pins, rather than forcing the existing helper to serve both scripts."
  - "The graveyard block's three stale comments (GRAVE_TOTAL_KEY, renderGraves' count comment, and the 'Defensive' comment) were reworded per the plan's Task 2 step 4 to state the adapter now stores up to 60 stones (Phase 65, D-05) and this Dead tab still renders the newest 5 until Phase 66 — comment-only, renderGraves' behavior and copy are byte-identical."

requirements-completed: [RUN-04]

coverage:
  - id: D1
    description: "window.__mzDeathRecord is set to newBestView(takeDeathRecord()) on every non-dev died event (dispatchWithNarration, the shell's one dispatch call site) and reset to null on showTitleScreen (BURY THEM/abandon/save-and-quit), registered in src/browser/bridge.js and docs/SHELL-MODULES.md"
    requirement: RUN-04
    verification:
      - kind: unit
        ref: "test/unit/bridge-registry.test.js, test/unit/stale-terms.test.js, test/unit/shell-no-content-copies.test.js, node tools/bridge-doc.mjs --check"
        status: pass
      - kind: unit
        ref: "test/unit/shell-new-best.test.js#dispatchWithNarration parks newBestView(takeDeathRecord()) on a died event / showTitleScreen resets window.__mzDeathRecord to null"
        status: pass
    human_judgment: false
  - id: D2
    description: "renderNewBestBlock(host, view) renders a gold .cb-over-best block (optional head, ordered rows, one quip) using createElement/textContent/appendChild only, called from renderCombatOver's dead branch after the line and before the buttons, reading window.__mzDeathRecord; the rail stays hidden while S.dead"
    requirement: RUN-04
    verification:
      - kind: unit
        ref: "test/unit/shell-new-best.test.js (11 tests: 3 fake-DOM behaviour, region pins, no-innerHTML, CSS, rail-hidden pin, no-S-field pin, 2 Task-1 wiring pins)"
        status: pass
      - kind: unit
        ref: "test/unit/shell-combat-over.test.js, test/unit/shell-tab-snapshots.test.js, test/unit/stale-terms.test.js (unedited, still green)"
        status: pass
      - kind: unit
        ref: "npm test (4290/4297; the 7 failures are the pre-existing CRLF doc-ledger issue tracked in STATE.md, unrelated to this plan)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Voice/visual UAT: the block's real-device appearance (gold accent, placement above the buttons at large text scale) and its idempotency across REVIEW THE ORACLE re-renders"
    verification: []
    human_judgment: true
    rationale: "Visual/device UAT is deferred to the Phase 69 Pixel 7 batch per project_notes (deferred-UAT protocol); listed verbatim in Human verification below"

# Metrics
duration: ~20min
completed: 2026-09-23
status: complete
---

# Phase 65 Plan 05: Death-Panel New-Best Announcement Summary

**THAT IS THAT now shows a gold NEW PERSONAL BEST block (or a single first-death line) via a presentation-only `window.__mzDeathRecord` parcel set once per died event and rendered by a new `renderNewBestBlock`, closing out RUN-04.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-09-23T18:28:00-04:00 (approx, first read of mazeworld.html import/bridge regions)
- **Completed:** 2026-09-23T18:41:55-04:00
- **Tasks:** 2 (Task 2 is `tdd="true"`: RED then GREEN)
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- `window.__mzDeathRecord`: the module script's presentation-only parcel, set to `newBestView(takeDeathRecord())` on every non-dev died event inside `dispatchWithNarration` (the shell's one dispatch call site — covers move, combat, and abandon death paths), reset to `null` as `showTitleScreen`'s first statement. Registered alphabetically in `src/browser/bridge.js` between `__mzDarkness` and `__mzDescend`; `docs/SHELL-MODULES.md`'s bridge table regenerated via `node tools/bridge-doc.mjs --write`.
- `renderNewBestBlock(host, view)`: a new classic-script function directly after `renderCombatOver`'s closing brace. Builds `div.cb-over-best` with an optional `.cb-over-best-head`, zero or more `.cb-over-best-row` paragraphs, and an optional `.cb-over-best-quip` paragraph — `createElement`/`className`/`id`/`textContent`/`appendChild` only, no `innerHTML`, no copy literals of its own.
- `renderCombatOver`'s dead branch calls `renderNewBestBlock(over, window.__mzDeathRecord)` directly after `over.appendChild(line)` and before the `cb-over-actions` block, so the block sits under "The maze keeps the rest." and above REVIEW THE ORACLE / BURY THEM.
- CSS: `.cb-over-best` (gold `#e8c97a` border on the dark `#1d180f` panel), `.cb-over-best-head`, `.cb-over-best-row`, `.cb-over-best-quip`.
- Comment-only reword of three stale graveyard-block comments (GRAVE_TOTAL_KEY, renderGraves' count comment, the "Defensive" comment) to state the adapter now stores up to 60 stones (Phase 65, D-05) and the Dead tab still renders only the newest 5 until Phase 66's Leaderboards panel — `renderGraves`' behavior and copy are byte-identical.
- `test/unit/shell-new-best.test.js`: 11 tests — 3 fake-DOM behaviour tests (null view, several-boards view with head+2 rows+quip in order, first-death view with quip only) evaluating the real extracted `renderNewBestBlock` source via `new Function` against a minimal fake document; region pins for the call site's position and no-innerHTML; CSS pins; the rail-stays-hidden-while-dead pin; the no-GameState-field pin; and two pins for Task 1's module wiring.

## Task Commits

Each task was committed atomically (Task 2 is `tdd="true"`, so it has two commits: RED then GREEN):

1. **Task 1: the module-side parcel (import, set on died, reset on title, register bridge)** - `c22ba6f` (feat)
2. **Task 2 (RED): failing tests for the NEW PERSONAL BEST block** - `f735b21` (test)
2. **Task 2 (GREEN): renderNewBestBlock, its call site, CSS, and the graveyard comment reword** - `9c4cb69` (feat)

## Files Created/Modified

- `mazeworld.html` — two new module import lines, `window.__mzDeathRecord` resting value, `dispatchWithNarration`'s died-event parcel set, `showTitleScreen`'s reset, `renderNewBestBlock` function, `renderCombatOver`'s dead-branch call site, four new CSS rules, three reworded graveyard comments
- `src/browser/bridge.js` — `__mzDeathRecord` entry, alphabetically between `__mzDarkness` and `__mzDescend`
- `docs/SHELL-MODULES.md` — regenerated bridge table (57 rows)
- `test/unit/shell-new-best.test.js` — new, 11 tests

## Decisions Made

- Added a second module-region test helper (`indentedFnRegion`, matching `/\n[ \t]*function /`) alongside shell-combat-over.test.js's existing zero-indent `fnRegion`, because `dispatchWithNarration`/`showTitleScreen` live inside the indented `<script type="module">` body where the classic-script helper's exact boundary pattern never matches. This is a test-only addition — no production code path is affected.
- Reworded three stale graveyard-block comments (not required by the acceptance criteria's greps, but specified in the plan's Task 2 step 4) rather than leaving them claiming a 5-stone adapter cap that Plan 65-04 already reverted to 60.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' acceptance criteria pass verbatim: every grep-based check in Task 1 and Task 2's `<acceptance_criteria>` blocks returns the expected count, `node tools/bridge-doc.mjs --check` exits 0, and every named verification command is green.

## Issues Encountered

- `npm test` reports 4290/4297, with the same 7 pre-existing failures documented in this phase's Plan 01–04 SUMMARYs (Windows CRLF checkout of `docs/CLASS-PASS.md`/`docs/FLEE.md` breaking `$`-anchored doc-ledger guard tests in `test/unit/flee-ledger.test.js`, `test/unit/class-pass-ledger.test.js`, and a parley-flee-retune modifier-table test) — this is the standing `.gitattributes eol=lf pin` follow-up tracked in STATE.md, confirmed unrelated to this plan's files (none of the failing test files or their subject docs were touched). `deferred-items.md` (already present from an earlier plan in this phase) was NOT created or appended, per project_notes. `node --test test/parity/*.test.js` is 46/46 green.

## Human verification (deferred to end of run)

For the Phase 69 Pixel 7 UAT batch (`docs/UAT-v2.0.md`), not run now:
1. On a fresh install, the first death shows the gold block with one first-death line.
2. A later death deeper than any before shows NEW PERSONAL BEST with DEEPEST DESCENT and DEEPEST, FEWEST STEPS rows plus one quip, sitting above REVIEW THE ORACLE / BURY THEM without pushing the buttons off-screen at the largest text scale.
3. A shallower death shows no block.
4. REVIEW THE ORACLE then back to the map shows the same block and the same quip.
5. BURY THEM, then a new run, then an early death shows no stale block.
6. The rail never appears over the death panel.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- RUN-04 is fully implemented: a new #1 on any board is announced in voice, inside the death panel's own space, as a distinct gold block; anything short of a new #1 stays silent; the first-ever death gets its own line; no GameState field was added.
- This closes out Phase 65 (RUN-01 through RUN-04 all complete across Plans 01–05). Phase 66 (the Leaderboards panel) can read `getBests()` directly and reuse `content/boards.js#BOARD_COPY` for its own rendering; it also owns retiring the classic Dead tab's 5-stone view in favor of the full Leaderboards panel.
- No blockers. The 7 pre-existing CRLF-related test failures remain tracked in STATE.md's standing `.gitattributes eol=lf pin` follow-up; they do not affect this plan's deliverables.

---
*Phase: 65-run-record-personal-bests*
*Completed: 2026-09-23*

## Self-Check: PASSED

- FOUND: mazeworld.html
- FOUND: src/browser/bridge.js
- FOUND: docs/SHELL-MODULES.md
- FOUND: test/unit/shell-new-best.test.js
- FOUND: .planning/phases/65-run-record-personal-bests/65-05-SUMMARY.md
- FOUND commit: c22ba6f (Task 1: module-side parcel, bridge registry entry)
- FOUND commit: f735b21 (Task 2 RED: failing tests)
- FOUND commit: 9c4cb69 (Task 2 GREEN: renderNewBestBlock implementation)
