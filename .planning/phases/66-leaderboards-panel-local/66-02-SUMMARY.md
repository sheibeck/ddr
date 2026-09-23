---
phase: 66-leaderboards-panel-local
plan: 02
subsystem: content
tags: [content-only, voice, family-friendly-scan, leaderboards, pure-data]

# Dependency graph
requires:
  - phase: 65-run-record-personal-bests
    provides: "content/boards.js BOARD_COPY (tab/title/rule/unit/unitOne) and engine/records.js BOARD_IDS"
provides:
  - "BOARD_COPY extended with mark/col/unitLabel per board, and the mock's rule lines (LEANEST re-voiced)"
  - "BOARD_FOOTNOTES (ranked/yard verbatim footnotes)"
  - "BOARDS_PANEL_COPY (head/scope/strip/chips/note/empty/divider/standing/stats/lineage/level/sep/dock)"
  - "STANDING_LINES quip bank (first/ten/rest)"
  - "test/unit/boards-copy.test.js pinning all of the above verbatim/shape"
  - "safety-scan.test.js and hp-not-wp.test.js registration for the three new exports"
affects: [66-04-boards-view-model, 66-03-boards-panel-renderer]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "content/ pure-data copy banks stay Object.freeze()'d nested objects with {token} placeholders, filled only by the view model (never functions in content/)"
    - "New content exports are registered into safety-scan.test.js's collectAuthoredStrings walk and hp-not-wp.test.js's presentation-COPY bank walk on the same recursive string-leaf pattern as GEAR_COPY/BOARD_COPY"

key-files:
  created: [test/unit/boards-copy.test.js]
  modified: [content/boards.js, test/voice/safety-scan.test.js, test/unit/hp-not-wp.test.js]

key-decisions:
  - "LEANEST's rule line re-voiced to 'Squares walked per floor descended. Efficiency, of a sort.' per D-09/CONTEXT, replacing the mock's ordering-duplicate line"
  - "BOARDS_PANEL_COPY and STANDING_LINES are deep-frozen (Object.freeze on every nested object/array) to make the pure-data contract structurally enforced, not just conventional"

patterns-established:
  - "New content/ copy tables register themselves into both the safety-scan walk and the hp-not-wp walk in the same commit that adds them, never as a follow-up"

requirements-completed: [BOARD-02, BOARD-03, BOARD-07, BOARD-08]

coverage:
  - id: D1
    description: "BOARD_COPY carries mark/col/unitLabel per board and adopts the mock's rule lines verbatim (LEANEST re-voiced); tab/title/unit/unitOne untouched"
    requirement: "BOARD-03"
    verification:
      - kind: unit
        ref: "test/unit/boards-copy.test.js#Every board's mark and col match the mock verbatim (D-11)"
        status: pass
      - kind: unit
        ref: "test/unit/boards-copy.test.js#The six non-LEANEST rule lines equal the mock strings verbatim"
        status: pass
      - kind: unit
        ref: "test/unit/boards-copy.test.js#LEANEST's rule is the re-voice, not the mock's old duplicated-ordering line, and mentions per-floor"
        status: pass
      - kind: unit
        ref: "test/unit/newBest.test.js#BOARD_COPY key order matches the mock tab order used for row ordering"
        status: pass
    human_judgment: false
  - id: D2
    description: "BOARD_FOOTNOTES (ranked + yard) exist verbatim from the mock"
    requirement: "BOARD-07"
    verification:
      - kind: unit
        ref: "test/unit/boards-copy.test.js#BOARD_FOOTNOTES.ranked and .yard equal the mock verbatim"
        status: pass
    human_judgment: false
  - id: D3
    description: "BOARDS_PANEL_COPY carries the signed-out strip/chips/notes and the empty/standing/divider/dock copy (D-01, D-06, D-07, D-12), deep-frozen with a closed {token} vocabulary"
    requirement: "BOARD-08"
    verification:
      - kind: unit
        ref: "test/unit/boards-copy.test.js#BOARDS_PANEL_COPY carries the D-01/D-06/D-07/D-12 fields the plan specifies"
        status: pass
      - kind: unit
        ref: "test/unit/boards-copy.test.js#BOARDS_PANEL_COPY is deep-frozen"
        status: pass
      - kind: unit
        ref: "test/unit/boards-copy.test.js#Every BOARDS_PANEL_COPY template's tokens are only from {n,name,floor,steps,epitaph}"
        status: pass
    human_judgment: false
  - id: D4
    description: "STANDING_LINES quip bank (first/ten/rest, at least 6 lines total) exists with no pin/worldwide/friends/handle wording"
    requirement: "BOARD-02"
    verification:
      - kind: unit
        ref: "test/unit/boards-copy.test.js#STANDING_LINES has first/ten/rest arrays of at least 2 each and at least 6 lines total"
        status: pass
      - kind: unit
        ref: "test/unit/boards-copy.test.js#No STANDING_LINES entry mentions a pin, worldwide, friends, or another player"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every new string passes the family-friendly safety scan and the player-facing HP-not-WP scan"
    verification:
      - kind: unit
        ref: "test/voice/safety-scan.test.js#Flavor banks: all remaining authored player-facing copy is family-friendly"
        status: pass
      - kind: unit
        ref: "test/unit/hp-not-wp.test.js#Presentation COPY objects: every string leaf is free of a standalone wp/WP token"
        status: pass
    human_judgment: false
  - id: D6
    description: "The panel's voice reads correctly on-device (tone/taste, deferred to the Phase 69 UAT batch)"
    verification: []
    human_judgment: true
    rationale: "Tone is a taste call the automated safety/HP/verbatim scans cannot make; deferred per the project's deferred-UAT protocol to one batched device read-through at milestone close."

duration: 25min
completed: 2026-09-23
status: complete
---

# Phase 66 Plan 02: Leaderboards Panel Copy Summary

**Extended `content/boards.js` with the mock's marks/colours/rule lines/footnotes, a new `BOARDS_PANEL_COPY` panel-copy bank, and a `STANDING_LINES` quip bank — all pure data, all pinned verbatim against the mock and registered with the safety/HP scans.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-23T23:19:00Z (approx, per worktree HEAD assertion)
- **Completed:** 2026-09-23T23:43:28Z
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- `content/boards.js`: every board in `BOARD_COPY` now carries its mock `mark`/`col`/`unitLabel`, and every rule line is the mock's verbatim text except LEANEST's deliberate re-voice ("Squares walked per floor descended. Efficiency, of a sort.") for the Phase 66 squares-per-floor re-rank (engine change lands in a later plan). `tab`/`title`/`unit`/`unitOne` are byte-identical to Phase 65, so `src/browser/newBest.js`'s death-panel announcement is untouched.
- Added `BOARD_FOOTNOTES` (ranked + yard, verbatim mock text including the curly-apostrophe GRAVEYARD line).
- Added `BOARDS_PANEL_COPY`, a deep-frozen nested copy bank covering the header, scope lines, signed-out identity strip, ALL/FRIENDS chips and notes, empty state, "NOT IN THE TOP TEN" divider, standing card (including the offline `NO ENTRY`/`ofYours`/`ofCombos`/`yardNote` variants), stat chip labels, LINEAGE templates, and the D-01 bottom-dock labels.
- Added `STANDING_LINES`, a deep-frozen three-bank quip table (first/ten/rest, 3 lines each) with no line claiming a pin, a global rank, or friends.
- New `test/unit/boards-copy.test.js` (14 tests) pins every one of the above verbatim/shape rules, including the deep-freeze check and a closed `{token}` vocabulary check.
- `test/voice/safety-scan.test.js` and `test/unit/hp-not-wp.test.js` both register `BOARD_FOOTNOTES`/`BOARDS_PANEL_COPY`/`STANDING_LINES` through the existing recursive string-leaf walk pattern, so they participate in the standing family-friendly and HP-not-WP tripwires going forward.

## Task Commits

Each task was committed atomically:

1. **Task 1: extend BOARD_COPY and add BOARD_FOOTNOTES, BOARDS_PANEL_COPY and STANDING_LINES** - `0a8ace1` (feat)
2. **Task 2: pin the copy verbatim and register it with the safety and HP scans** - `0fdc2b7` (test)

_Note: Task 2 is a `tdd="true"` task whose test file was authored alongside the already-correct Task 1 content (both were written from the same plan-specified verbatim strings), so RED never separately failed — the single `test(...)` commit covers both the new pin file and the two scan registrations, all of which passed on first run. See "TDD Gate Compliance" below._

## Files Created/Modified

- `content/boards.js` - BOARD_COPY gains mark/col/unitLabel + mock rule lines (LEANEST re-voiced); adds BOARD_FOOTNOTES, BOARDS_PANEL_COPY, STANDING_LINES
- `test/unit/boards-copy.test.js` - new: 14 tests pinning the above verbatim/shape
- `test/voice/safety-scan.test.js` - registers the three new exports in the recursive string-leaf walk
- `test/unit/hp-not-wp.test.js` - registers the three new exports in the presentation-COPY bank walk (section b)

## Decisions Made

- LEANEST's rule line follows CONTEXT's suggested wording exactly ("Squares walked per floor descended. Efficiency, of a sort.") rather than inventing new phrasing, since it was offered as a specific example in 66-CONTEXT.md's `<specifics>`.
- `BOARDS_PANEL_COPY` and `STANDING_LINES` are `Object.freeze()`'d at every nesting level (not just the top-level export) so the pure-data/no-mutation contract is enforced structurally, matching the deep-freeze already implied by `content/`'s "pure data" rule and pinned by its own test.

## Deviations from Plan

None - plan executed exactly as written. All strings, field names, and structure match 66-02-PLAN.md's Task 1 `<action>` list verbatim.

## TDD Gate Compliance

Task 2 is marked `tdd="true"` in the plan. Gate sequence check via git log:

1. `test(66-02): pin panel copy verbatim, register with safety/HP scans` (`0fdc2b7`) exists — the RED/pin commit.
2. No separate `feat(...)` commit follows it, because the GREEN-side content (`content/boards.js`) was already correct and committed in Task 1 (`0a8ace1`, which precedes the test commit).

This is a deliberate ordering inversion from a textbook RED-then-GREEN: Task 1 (content) necessarily had to land first per the plan's task split (Task 1 = content, Task 2 = tests + scan registration), and 66-02-PLAN.md's own Task 2 `<behavior>` list was written to describe exactly what Task 1 produced. Every assertion in `test/unit/boards-copy.test.js` passed on its first run with zero code changes required — there was no red-to-green transition to gate. No test passed unexpectedly against pre-existing (wrong) content; the content did not exist before Task 1's own commit. Flagging this per the plan-level TDD gate note for transparency; not treated as a fail-fast violation since the "feature may already exist" risk this gate protects against does not apply (the feature is new content authored in Task 1 of the same plan, not a stale pre-existing implementation).

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Human verification (deferred to end of run)

- A read-through of the panel's copy in voice on the device (tone is a taste call the safety/HP/verbatim scans cannot make) — batched into the Phase 69 device UAT round per the deferred-UAT protocol.

## Next Phase Readiness

- `content/boards.js` now exports everything 66-04 (the boardsView view model) and 66-03 (the boardsPanel renderer) need: `BOARD_COPY` (extended), `BOARD_FOOTNOTES`, `BOARDS_PANEL_COPY`, `STANDING_LINES`, plus the untouched Phase 65 `NEW_BEST_HEAD`/`NEW_BEST_LINES`/`FIRST_DEATH_LINES`.
- No blockers. `content/index.js` still does not re-export `boards.js` (per the 66-CONTEXT interfaces note, it stays a direct import) — 66-04 should import from `../../content/boards.js` directly, the same way `src/browser/newBest.js` does.
- `npm test`: 4304/4311 pass; the 7 failures are the pre-existing worktree CRLF doc-ledger artifacts (`class-pass-ledger`/`flee-ledger`/`parley-flee-retune`) named in the Phase 65 SUMMARYs and this plan's project notes — unchanged from the base commit, not caused by this plan.

---

*Phase: 66-leaderboards-panel-local*
*Completed: 2026-09-23*

## Self-Check: PASSED

All created/modified files verified present on disk (`content/boards.js`, `test/unit/boards-copy.test.js`, `test/voice/safety-scan.test.js`, `test/unit/hp-not-wp.test.js`, this SUMMARY.md). Both task commits (`0a8ace1`, `0fdc2b7`) verified present in `git log --oneline --all`.
