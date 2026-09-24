---
phase: 66-leaderboards-panel-local
plan: 04
subsystem: ui
tags: [view-model, leaderboards, pure-data, records, boards-panel]

# Dependency graph
requires:
  - phase: 66-01-records-comparator-graveyard-seam
    provides: "engine/records.js's compareRuns('lean',...)/leanRate/normalizeStone/sortGraveyard/sanitizeBests/lineageKey/BOARD_IDS"
  - phase: 66-02-leaderboards-panel-copy
    provides: "content/boards.js's BOARD_COPY (mark/col/unitLabel/rule), BOARD_FOOTNOTES, BOARDS_PANEL_COPY, STANDING_LINES"
provides:
  - "boardsView(input) — the D-15 pure view-model seam every board's content, empty state and signed-out chrome comes from"
  - "runPool(bests, graves) — the hash-deduped union used for the standing card's placement math"
  - "cutTopTen(entries) — BOARD-05's top-ten-plus-pinned-best cut, generalised from the mock"
  - "avatarColour/initialsOf/ordinal/AVATAR_PALETTE — the mock's identity helpers, ported verbatim"
affects: [66-06-boards-panel-wiring, 66-07-title-dead-tab-integration, 67-play-games-integration, 68-global-boards-submission]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Row-builder-then-finalize split: module-private per-board builders emit an internal row shape carrying `run`/`metric`; a shared `finalize()` applies cutTopTen (or skips it for GRAVEYARD), the min-max bar rule and the avatar, then strips the internal fields before returning the view's row shape"
    - "content/boards.js templates filled only by this module's `fill(template, vars)` — content/ itself holds no functions, matching the project's pure-data content rule"

key-files:
  created:
    - test/unit/boardsView.test.js
  modified: []

key-decisions:
  - "The bar's min-max metric is computed over the LISTED rows (after cutTopTen), not the full pre-cut pool — a deliberate reading of the plan's 'min-max over the listed rows' text, distinct from the mock's own renderVals (which scales over the uncut pool); in practice the two are identical for every ranked board today since sanitizeBests already caps stored board lists at ten"
  - "LINEAGE's standing-card rank is the recent run's COMBO group's rank (by lineageKey match against the sorted, uncut lineage list), not the recent run's own individual rank within that combo — matches the plan's 'the recent run's combo rank among all combos' wording"
  - "GRAVEYARD's standing 'deepest' run prefers bests.boards.deep[0] over the graveyard's own deepest stone, per the plan's explicit precedence ('the bests DEEPEST #1 run, else the first GRAVEYARD row')"

requirements-completed: [BOARD-02, BOARD-03, BOARD-04, BOARD-05, BOARD-06, BOARD-07, BOARD-08]

coverage:
  - id: D1
    description: "boardsView(input) is a pure, deterministic function of its input: header, strip, rail, board, body, standing, footnote and dock all derive from bests/graves/total/board/scope/open/entry/hasHero/signedIn alone, matching the 66-03 view contract field-for-field"
    requirement: "BOARD-02"
    verification:
      - kind: unit
        ref: "test/unit/boardsView.test.js#Purity: boardsView on deep-frozen inputs never throws or mutates, and two calls give deepStrictEqual views"
        status: pass
      - kind: unit
        ref: "test/unit/boardsView.test.js#Empty data: boardsView({}) returns a complete view with INTERRED 0, an empty body on every board and NO ENTRY"
        status: pass
      - kind: unit
        ref: "test/unit/boardsView.test.js#Input normalization: unknown board -> deep, unknown scope -> local, non-title entry -> tab, null bests, non-array graves"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every ranked board (DEEPEST/LEANEST/LONGEST/BUTCHERY/PURSE) lists the bests record's own top ten in record order, with LEANEST distinctly ordered by squares-per-floor (not a DEEPEST duplicate), correct row content (headline/line/detail/val/unit) and the six FLOOR/DAYS/SQUARES/KILLS/EXP/WILMST stat chips"
    requirement: "BOARD-03"
    verification:
      - kind: unit
        ref: "test/unit/boardsView.test.js#Ranked board rows: one per hash in bests.boards[board], in order, keyed by hash"
        status: pass
      - kind: unit
        ref: "test/unit/boardsView.test.js#LEANEST order in the rows follows squares per floor: a lean 22-step floor-1 run outranks a 900-step floor-9 run"
        status: pass
      - kind: unit
        ref: "test/unit/boardsView.test.js#Ranked rows: PURSE value is en-US digit-grouped"
        status: pass
      - kind: unit
        ref: "test/unit/boardsView.test.js#Stats: exactly FLOOR/DAYS/SQUARES/KILLS/EXP/WILMST with en-US-grouped gold, missing numbers render '0'"
        status: pass
    human_judgment: false
  - id: D3
    description: "LINEAGE groups by race+class from the stored aggregates (best floor then fewer steps), and GRAVEYARD lists every stored stone (up to 60) deepest-first, unranked, with the yard-specific name/line/detail order"
    requirement: "BOARD-04"
    verification:
      - kind: unit
        ref: "test/unit/boardsView.test.js#LINEAGE rows: grouped by race+class, ordered by compareRuns('combo'), keyed 'combo:' + lineage key"
        status: pass
      - kind: unit
        ref: "test/unit/boardsView.test.js#GRAVEYARD rows: all normalized stones in sortGraveyard order, unranked, keyed hash + ':' + index"
        status: pass
      - kind: unit
        ref: "test/unit/boardsView.test.js#GRAVEYARD row content: headline is the name, name slot is the level line, line is the capitalised note, detail is the epitaph, val is 'floor · steps'"
        status: pass
    human_judgment: false
  - id: D4
    description: "cutTopTen implements BOARD-05's pin (top ten, plus a missed personal best pinned below a divider) as a pure, non-mutating, testable function, reachable now and live for Phase 68's global rows"
    requirement: "BOARD-05"
    verification:
      - kind: unit
        ref: "test/unit/boardsView.test.js#cutTopTen: 9 or fewer entries come back unchanged (as copies)"
        status: pass
      - kind: unit
        ref: "test/unit/boardsView.test.js#cutTopTen: 12 entries with the only you entry at index 11 give the first ten plus that entry marked divider"
        status: pass
      - kind: unit
        ref: "test/unit/boardsView.test.js#cutTopTen: never mutates the input array or its entries"
        status: pass
    human_judgment: false
  - id: D5
    description: "An open row's detail carries the cause and epitaph plus exactly six stat chips (BOARD-06), and the row's value bar follows the min-max rule including LEANEST's negated-rate scaling and the unplaced-run/single-row/all-equal edge cases"
    requirement: "BOARD-06"
    verification:
      - kind: unit
        ref: "test/unit/boardsView.test.js#Ranked rows: detail is the death note capitalised, '. ', then the epitaph"
        status: pass
      - kind: unit
        ref: "test/unit/boardsView.test.js#Value bars: min-max over the listed rows, an unplaced LEANEST run gets the minimum 3, negated rate makes the best rate fullest"
        status: pass
      - kind: unit
        ref: "test/unit/boardsView.test.js#Value bars: when every metric is equal (including a single row) every bar is 100"
        status: pass
    human_judgment: false
  - id: D6
    description: "The standing card (D-07) is correct for every board shape: ranked place/'of N of yours', ties, LINEAGE's combo rank/'of N combinations', GRAVEYARD's INTERRED/lifetime-deepest note, the NO ENTRY empty state, and a deterministic hash-and-board-keyed quip"
    requirement: "BOARD-07"
    verification:
      - kind: unit
        ref: "test/unit/boardsView.test.js#standing, ranked board: place is 1 + strictly-better count, label is name + unit, note carries the pool size"
        status: pass
      - kind: unit
        ref: "test/unit/boardsView.test.js#standing, a tie: three runs tied on every key with the recent one among them all place 1ST"
        status: pass
      - kind: unit
        ref: "test/unit/boardsView.test.js#standing, LINEAGE: the recent run's combo rank among all combos, label is COMBO · FLOOR, note counts combinations"
        status: pass
      - kind: unit
        ref: "test/unit/boardsView.test.js#standing, GRAVEYARD: label INTERRED, place is the header's interred, note names the deepest run"
        status: pass
      - kind: unit
        ref: "test/unit/boardsView.test.js#standing, empty (no runs at all): NO ENTRY on every board including GRAVEYARD"
        status: pass
      - kind: unit
        ref: "test/unit/boardsView.test.js#standing quip: deterministic — the same hash and board always pick the same quip"
        status: pass
    human_judgment: false
  - id: D7
    description: "INTERRED is the lifetime total (never fewer than the stones held, D-08), the header/strip/scope-note swap correctly signals signed-out (D-06), and no view string leaks a handle, YOU/FRIEND tag, or 'worldwide'/'among friends' wording while offline"
    requirement: "BOARD-08"
    verification:
      - kind: unit
        ref: "test/unit/boardsView.test.js#header interred: raised to the stone count when total is lower, and never negative/non-integer"
        status: pass
      - kind: unit
        ref: "test/unit/boardsView.test.js#strip: null on GRAVEYARD; elsewhere the signed-out glyph/label/source and dimmed ALL/FRIENDS chips"
        status: pass
      - kind: unit
        ref: "test/unit/boardsView.test.js#body: a ranked board with scope all/friends replaces rows with an in-panel note, even with no data; GRAVEYARD ignores scope"
        status: pass
      - kind: unit
        ref: "test/unit/boardsView.test.js#Offline: no row has a non-empty tag, you true or a divider, and no view string mentions worldwide/friends-among/handle"
        status: pass
    human_judgment: false
  - id: D8
    description: "The panel's voice and the standing card's 'feel' (place/quip pairing after a real death) read correctly on-device (tone/taste, deferred per the deferred-UAT protocol)"
    verification: []
    human_judgment: true
    rationale: "Tone and 'does this read sensibly on a real device after a run' are taste calls the automated unit suite cannot make; deferred to the Phase 69 batched device UAT round per the deferred-UAT protocol."

duration: ~55min
completed: 2026-09-23
status: complete
---

# Phase 66 Plan 04: boardsView pure view model Summary

**One pure function, `boardsView(input)`, produces every board's rows, the standing card, the signed-out strip and every empty/note state the Leaderboards panel renders, proven by 43 unit tests with zero DOM.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 2 completed (implemented and tested together, matching this repo's 66-01/66-02 tdd="true" convention of verifying behavior+tests as one unit before commit)
- **Files modified:** 2 (both created)

## Accomplishments

- New `src/browser/boardsView.js` exporting `boardsView(input)` — the D-15 seam: given `{ bests, graves, total, board, scope, open, entry, hasHero, signedIn, recentHash }`, it returns the exact `{ header, strip, rail, board, body, standing, footnote, dock }` view object 66-03's `renderBoardsPanel`/`createBoardsPanel` already consume (verified directly against 66-03's field names and semantics, since 66-03 landed first in wave 1).
- Ported the mock's `AVATAR`/`INITIALS`/`ORD` helpers verbatim as `avatarColour`/`initialsOf`/`ordinal`, plus `AVATAR_PALETTE` — pinned against four hand-computed name/colour vectors and the mock's full ordinal exception table (11th–13th, 21st–24th, 101st, 111th–112th).
- `runPool(bests, graves)` — the hash-deduped union of `bests.runs` and every `normalizeStone`d stored stone (stones in stored order first), used only by the standing card's placement math (not by the row builders, which read the already-ranked `bests.boards[board]` lists directly).
- `cutTopTen(entries)` — BOARD-05's "top ten, plus your best run pinned below a divider" rule, generalised from the mock's `cut()`; non-mutating; the divider path is exercised with synthetic `you: true` entries here (offline rows never set `you`, so it stays unreachable in production until Phase 68, per the plan's flagged assumption).
- Five ranked-board row builders (DEEPEST/LEANEST/LONGEST/BUTCHERY/PURSE) reading `bests.boards[board]` in stored order; a LINEAGE builder grouping `bests.lineage` entries by `compareRuns("combo")`; a GRAVEYARD builder over `sortGraveyard(normalizeStone(...))`. All three funnel through a shared `finalize()` that applies `cutTopTen` (skipped for GRAVEYARD, which is never cut), the min-max value-bar rule, and the avatar.
- The value-bar rule: min-max over the rows actually listed (post-cut), LEANEST's metric negated so the best (lowest) rate scales fullest, any non-finite metric (an unplaced LEANEST run) pinned to the floor of 3%, and every-equal/single-row boards fully lit at 100%.
- The standing card (D-07) for all four shapes: ranked-board place/`"of N of yours."` + quip, LINEAGE's combo-rank/`"of N combinations."`, GRAVEYARD's `INTERRED`/lifetime-deepest note, and the universal `NO ENTRY` empty state — with a deterministic `(hash, board)`-keyed quip pick from `STANDING_LINES`' first/ten/rest banks.
- Header/strip/rail/board-head/footnote/dock builders draw every word from `BOARD_COPY`/`BOARD_FOOTNOTES`/`BOARDS_PANEL_COPY` (Phase 66-02); `INTERRED` is raised to the stone count whenever the stored lifetime total is lower or invalid (D-08); the identity strip is `null` on GRAVEYARD and dims ALL/FRIENDS while `signedIn !== true` (D-06).

## Task Commits

Both tasks were implemented and verified together as one unit (module + its full test file), then committed atomically:

1. **Tasks 1+2: boardsView module (helpers, row builders, header/strip/rail/body/standing/footnote/dock) + 43-test suite** - `7d8256b` (feat)

_No separate RED/GREEN commit split: both plan tasks are `tdd="true"`, but per this phase's established convention (see 66-01/66-02 SUMMARYs), behavior and its pinning tests were authored from the same spec and verified together before the single commit — there was no red-to-green transition to gate since the implementation was written directly against the plan's pinned vectors and shapes._

## Files Created/Modified

- `src/browser/boardsView.js` (new) - the pure view model: `boardsView`, `runPool`, `cutTopTen`, `avatarColour`, `initialsOf`, `ordinal`, `AVATAR_PALETTE`, plus module-private row builders, the bar rule, the standing-card logic and the header/strip/rail/board/footnote/dock builders
- `test/unit/boardsView.test.js` (new) - 43 tests: helper pins, `runPool`/`cutTopTen`, every board's row content (including the LEANEST-vs-DEEPEST ordering difference and GRAVEYARD's unranked shape), value-bar edge cases, input normalization, header/strip/rail/board/footnote/dock, the standing card's five shapes and quip determinism, a full 12-run/7-board integration pass, the offline no-leak sweep, purity/deep-freeze, the empty-data view, and the comment-stripped source pins

## Decisions Made

- The bar's min-max window is computed over the rows actually listed in `body.rows` (post-`cutTopTen`), not the full unranked pool the mock's `renderVals` scales over — this is the plan's literal "min-max over the listed rows' metric" wording; the two readings are behaviorally identical today since every ranked/LINEAGE board is already capped at ten by `sanitizeBests`/`cutTopTen` before scaling.
- LINEAGE's standing card ranks the recent run's *combo group* (matched via `lineageKey`) against the sorted, uncut lineage list — not the recent run's own rank within that combo — matching the plan's "the recent run's combo rank among all combos" phrasing precisely.
- GRAVEYARD's standing "deepest" run is read from `bests.boards.deep[0]` first, falling back to the graveyard's own sorted deepest stone only when no `deep` board entry exists — per the plan's explicit precedence order, not the graveyard-only reading the mock's card implies.

## Deviations from Plan

None — plan executed exactly as written. Every `<behavior>` bullet in both tasks maps to a passing test; no Rule 1-4 auto-fixes were needed.

## Known Stubs

None — this plan is a pure view-model module with no DOM, no rendering surface and no wiring to the live adapter yet (that lands in a later plan, per 66-CONTEXT's D-15 sequencing: the renderer consuming this seam is already built in 66-03; the adapter wiring is a separate later plan).

## Threat Flags

None — this plan adds no network surface, auth path, file access pattern or schema change. It is a pure function over already-sanitized in-memory data (`sanitizeBests`, `normalizeStone`), reading no storage and making no I/O of any kind.

## Issues Encountered

One test-authoring correction during self-verification: the first draft of the "12-run fixture across all seven boards" integration test used 4 races × 3 classes over 12 runs, which (since gcd(4,3)=1) produced 12 distinct race+class combinations — coincidentally equal to `cutTopTen`'s 10-row cap plus the pinned-divider edge, making the LINEAGE row-count assertion fail (10 rows shown, not the expected 12 combos) for the wrong reason (the cap, not a grouping bug). Fixed by using 3 races × 2 classes with an index formula that revisits each of the 6 combinations twice across the 12 runs, so the test now actually proves LINEAGE's grouping (12 runs collapsing to 6 rows) rather than incidentally exercising the top-ten cut. No production code changed; this was a test-fixture-only correction caught before commit.

## User Setup Required

None - no external service configuration required.

## Human verification (deferred to end of run)

- After a few real deaths on-device, each board's order matches expectation — in particular that LEANEST visibly rewards short, efficient runs over merely-deep ones (the automated tests prove the comparator; a device read confirms the effect reads correctly in the actual UI once 66-03/66-06 wire this seam to the panel).
- The standing card's place and "of N" phrasing read sensibly immediately after a fresh in-game death (not just in synthetic multi-run fixtures).

Both are batched into the Phase 69 device UAT round per the project's deferred-UAT protocol; no device or Android build step was taken in this plan.

## Next Phase Readiness

- `src/browser/boardsView.js` exports exactly the symbols 66-03's `boardsPanel.js` expects to receive as its injected `buildView` (confirmed directly against `src/browser/boardsPanel.js`'s `render()`, which calls `buildView({ ...data, board, scope, open, entry, hasHero, signedIn: false })` and reads `view.header/.strip/.rail/.board/.body/.standing/.footnote/.dock` exactly as this module produces them — no adapter shape mismatch expected at wiring time).
- Wiring `boardsView` into `createBoardsPanel({ buildView: boardsView, readData: () => ({ bests: getBests(), graves: getGraveyard().graves, total: getGraveyard().total }), ... })` and the `showTab("dead")`/title-button integration are separate later plans per 66-CONTEXT's D-14/D-15 sequencing; no blockers surfaced here.
- `npm test`: 4416/4423 pass; the 7 failures are the pre-existing worktree CRLF doc-ledger artifacts (class-pass-ledger/flee-ledger/parley-flee-retune) named in the Phase 65 SUMMARYs and this plan's project notes — unchanged from the base commit, not caused by this plan. The failing-test set did not grow.

---
*Phase: 66-leaderboards-panel-local*
*Completed: 2026-09-23*

## Self-Check: PASSED

Both created files verified present on disk (`src/browser/boardsView.js`, `test/unit/boardsView.test.js`). Commit hash `7d8256b` verified present in `git log --oneline --all`. `node --test test/unit/boardsView.test.js` re-run clean at 43/43 pass.
