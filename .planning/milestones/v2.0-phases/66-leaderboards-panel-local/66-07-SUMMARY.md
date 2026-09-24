---
phase: 66-leaderboards-panel-local
plan: 07
subsystem: ui
tags: [dom-wiring, modular-shell, boards-panel, leaderboards, back-button, bridge-registry, persistence]

# Dependency graph
requires:
  - phase: 66-03-boardsPanel-view-model
    provides: "src/browser/boardsPanel.js's createBoardsPanel controller (openFromTitle/onDeadTab/back/isTitleOpen), already implementing the title-mode chrome this plan wires up"
  - phase: 66-06-dead-tab-wiring
    provides: "mazeworld.html's boardsPanel instance, routeFromBoards, window.__mzBoards, and refreshTitleDead() reading the adapter's getGraveyard() — everything this plan needed to point the title button and the Android back button at"
provides:
  - "mazeworld.html: the title's #mw-title-dead onclick opens the Leaderboards panel in TITLE mode (boardsPanel.openFromTitle({ hasHero: resumeIntent })) before switching the DEAD tab (D-01, D-04)"
  - "mazeworld.html: getGameContext's hasOpenModal includes boardsPanel.isTitleOpen(); closeModal's first statement mirrors the chevron (boardsPanel.back()) and returns before any ☰ escape or S mutation (D-03)"
  - "mazeworld.html: the classic graveyard loader/saver sentinel block (loadGraves/saveGraves/GRAVE_KEY/GRAVE_TOTAL_KEY/graves/gravesTotal/gravesLoadError) is deleted outright; window.__mzClassicBoot is now fit();paint(); only (D-14)"
  - "src/browser/bridge.js + docs/SHELL-MODULES.md: __mzClassicBoot's purpose text corrected to describe the slimmed fit+paint boot"
  - "src/browser/storage.js: comment-only correction naming the adapter as the one graveyard reader/writer"
  - "test/persistence/dual-write-convergence.test.js: the classic-extraction test replaced by one proving engineAdapter.js's loadGraveyard() reads back what a direct storage.setItem() wrote, through the shared window.mzStorage instance; test/persistence/harness/sandboxClassicPersistence.js (its only user) deleted"
  - "test/unit/shell-boards-entry.test.js: 12 new tests — title-entry ordering, the closeModal guard order (both evaluated and via a real controller), openFromTitle/chevron/back/onDeadTab routing against a REAL createBoardsPanel + REAL boardsView, and every classic-retirement source pin"
affects: ["67-play-games-integration", "68-global-boards-submission", "69-uat-milestone-close"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Extracted-region evaluation for an early-return guard: closeModalFactory() slices closeModal's exact shipped source and runs it with only (boardsPanel, S) in scope — no window/document/hudMenuEvent/gearSheetTarget threaded through — so a regression that let the guard fall through would throw a ReferenceError in the test instead of silently reaching a real DOM call. A companion test flips isTitleOpen() to false and asserts that ReferenceError actually fires, proving the guard is genuinely reachable-past, not merely present."
    - "Real-controller routing tests over createRecordingDocument(): test/unit/shell-boards-entry.test.js drives src/browser/boardsPanel.js's createBoardsPanel with the REAL boardsView (never a stubbed view), matching this plan's own bullet requirement to prove openFromTitle/chevron/back/onDeadTab end to end rather than through a hand-built view fixture."

key-files:
  created:
    - test/unit/shell-boards-entry.test.js
  modified:
    - mazeworld.html
    - src/browser/bridge.js
    - docs/SHELL-MODULES.md
    - src/browser/storage.js
    - test/persistence/dual-write-convergence.test.js
  deleted:
    - test/persistence/harness/sandboxClassicPersistence.js

key-decisions:
  - "closeModalFactory()'s extracted Function deliberately omits window/document/hudMenuEvent/gearSheetTarget/closeGearSheet/closeCampSheet/closeMarksLegend from its parameter list. A title-open boardsPanel must never reach those lines; leaving them genuinely undefined (rather than stubbing them) turns 'the guard order regressed' into a hard ReferenceError in CI instead of a silent no-op DOM call the test might miss."
  - "src/browser/bridge.js's __mzClassicBoot purpose text and its docs/SHELL-MODULES.md row are corrected to name the title screen's own init as the caller (matching the actual call site) rather than the stale 'roller screen's own init' text the plan flagged as already inaccurate before this plan touched it."
  - "The stray comment above #btn-save-quit (mazeworld.html, Phase 44's DEAD-01/DEAD-03 note) claiming 'the graves sentinel block above is untouched' was corrected in the same commit that deletes that block — an out-of-scope-adjacent but load-bearing correctness fix within a file already in this plan's files_modified list (Rule 1: a now-false comment is a bug)."

requirements-completed: [BOARD-01, BOARD-08]

coverage:
  - id: D1
    description: "The title's VIEW THE DEAD opens the Leaderboards panel in TITLE mode on GRAVEYARD: title screen hidden, tab bar/rail hidden, chevron shown, dock shows BACK TO TITLE + ROLL A NEW HERO (no live hero) or a single BACK TO THE DUNGEON (a live hero)"
    requirement: "BOARD-01"
    verification:
      - kind: unit
        ref: "test/unit/shell-boards-entry.test.js#(D1)/(D3) — real createBoardsPanel + real boardsView: openFromTitle({hasHero:false}) renders the chevron and [title, roll] dock buttons on board 'yard'; openFromTitle({hasHero:true}) renders exactly [dungeon]"
        status: pass
      - kind: unit
        ref: "test/unit/shell-boards-entry.test.js#(A1) — the #mw-title-dead onclick region: hideTitleScreen() runs before openFromTitle() runs before the tab switch, exactly once each"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every exit from a title-opened panel (chevron, dock, Android back) returns to the title, the dungeon or the roller, and the tab bar is visible again the moment title mode ends"
    requirement: "BOARD-01"
    verification:
      - kind: unit
        ref: "test/unit/shell-boards-entry.test.js#(D2)/(D3)/(D4) — chevron routes (\"title\",{hasHero:false}) and deletes the marker; back() in hasHero:true mode routes (\"dungeon\",{hasHero:true}) and returns true; after either exit, isTitleOpen() is false and a later onDeadTab() renders TAB mode (no chevron, dock hidden)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The Android back button on a title-opened panel does exactly what the chevron does and never clears a live run's combat/store/beat state; a tab-opened panel's back behaviour (nativeChrome.js) is unchanged"
    requirement: "BOARD-01"
    verification:
      - kind: unit
        ref: "test/unit/shell-boards-entry.test.js#(B1) source-order pin (the isTitleOpen guard is closeModal's FIRST statement, before the ☰ escape) + #(C1)/(C2) evaluated-closure tests (title-open: calls back() once, S.beats/S.store untouched by reference identity; tab-open: falls through and throws on the un-threaded hudMenuEvent, proving the guard is genuinely skipped)"
        status: pass
      - kind: unit
        ref: "test/unit/shell-boards-entry.test.js#(B2) — git-independent pin: nativeChrome.js's source still exports decideBackAction and contains no 'boardsPanel' reference"
        status: pass
      - kind: other
        ref: "git diff --stat -- src/browser/nativeChrome.js (empty)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The classic graveyard loader, saver and their extraction sentinel are deleted; the adapter is the only reader/writer of ddr.graveyard.v1/ddr.graveyard.total.v1; the persistence suite proves the adapter's read goes through the shared storage abstraction"
    requirement: "BOARD-01"
    verification:
      - kind: unit
        ref: "test/unit/shell-boards-entry.test.js#(E1) — no sentinel markers, no GRAVE_KEY/GRAVE_TOTAL_KEY/loadGraves/saveGraves/graves/gravesTotal/gravesLoadError bindings anywhere in mazeworld.html; window.__mzClassicBoot's body is exactly fit();paint();"
        status: pass
      - kind: unit
        ref: "test/unit/shell-boards-entry.test.js#(E2)/(E3) — the harness file is deleted; the persistence test no longer imports it and calls loadGraveyard()"
        status: pass
      - kind: unit
        ref: "test/persistence/dual-write-convergence.test.js's new third test — a direct storage.setItem() write on GRAVE_KEY/GRAVE_TOTAL_KEY is read back byte-identically by engineAdapter.js#loadGraveyard() through the same window.mzStorage instance"
        status: pass
    human_judgment: false
  - id: D5
    description: "Boot still fits and paints the map before the title shows; the title gate reads the adapter; the full suite stays green (or only the documented pre-existing worktree CRLF failures)"
    requirement: "BOARD-01"
    verification:
      - kind: unit
        ref: "npm test — 4460/4467 pass; the 7 failures are exactly class-pass-ledger.test.js/flee-ledger.test.js's pre-existing worktree CRLF doc-ledger fixtures, unchanged from the pre-execution baseline"
        status: pass
      - kind: other
        ref: "node tools/bridge-doc.mjs --check (exit 0, no output)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Zero network calls on any panel entry/exit path (BOARD-08) — carried over unchanged from 66-06, re-verified after this plan's edits"
    requirement: "BOARD-08"
    verification:
      - kind: unit
        ref: "test/unit/shell-boards-panel.test.js#(F3) (pre-existing, re-run green in the same suite)"
        status: pass
    human_judgment: false

duration: ~55min
completed: 2026-09-23
status: complete
---

# Phase 66 Plan 07: Title-Mode Entry, Back-Button Mirror, Classic Graveyard Retirement Summary

**The title's VIEW THE DEAD now opens the Leaderboards panel in title mode (chevron + BACK TO TITLE/ROLL A NEW HERO or BACK TO THE DUNGEON), the Android back button mirrors that chevron without ever touching a live run's state, and the classic graveyard loader/saver sentinel block is deleted outright — the adapter is the one graveyard reader and writer.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 2 completed
- **Files modified:** 7 (1 created, 1 deleted)

## Accomplishments

- `#mw-title-dead`'s onclick now calls `hideTitleScreen(); boardsPanel.openFromTitle({ hasHero: resumeIntent }); window.__mzShowTab?.("dead");` — title mode is set before the tab switch, so the DEAD branch only re-centres the rail. `hasHero` is the title's own resume decision (`resumeIntent`), never recomputed from `S` (boot() always leaves a throwaway fresh-run character there).
- `getGameContext`'s `hasOpenModal` now includes `boardsPanel.isTitleOpen()`, and `closeModal`'s first statement is `if (boardsPanel.isTitleOpen()) { boardsPanel.back(); return; }` — placed before the ☰ menu escape and before any `S` mutation, so the Android back button on a title-opened panel routes exactly like the chevron (dungeon with a live hero, else the title) and never clears combat/store/beats. `src/browser/nativeChrome.js` is untouched (`git diff --stat` empty).
- The classic graveyard sentinel block — `GRAVE_KEY`/`GRAVE_TOTAL_KEY`, `graves`/`gravesTotal`/`gravesLoadError`, `loadGraves()`/`saveGraves()`, and both `@gsd:dual-write-convergence-extract:graves` markers — is deleted outright. `window.__mzClassicBoot` is now `fit(); paint();` only; the comment blocks above it and above the module's `await window.__mzClassicBoot();` call are rewritten to describe the adapter (`engineAdapter.js#loadGraveyard`) as the one graveyard path.
- `src/browser/bridge.js`'s `__mzClassicBoot` purpose text is corrected to "Exposes the classic script's async boot routine (the first canvas fit and paint) so the module script can await it before running the title screen's own init." (fixing a stale "roller screen" reference), and `docs/SHELL-MODULES.md` is regenerated (`node tools/bridge-doc.mjs --write`, `--check` passes). `src/browser/storage.js` gets a comment-only correction naming the adapter as the sole graveyard reader/writer.
- `test/persistence/dual-write-convergence.test.js`'s classic-extraction test (which drove the now-deleted `test/persistence/harness/sandboxClassicPersistence.js`) is replaced by a test proving `engineAdapter.js#loadGraveyard()` reads back the exact stones and total a direct `storage.setItem()` wrote, through the same shared `window.mzStorage` instance — preserving the file's original "one shared backend, not two" proof for the graveyard key. The harness file is deleted.
- New `test/unit/shell-boards-entry.test.js` (12 tests): title-entry ordering source pins, an evaluated `closeModal` extraction proving the guard's order two ways (a title-open panel calls `back()` once and leaves `S.beats`/`S.store` reference-identical; a tab-open panel falls through to an intentionally-un-threaded `hudMenuEvent` and throws), real-`createBoardsPanel`-plus-real-`boardsView` routing tests for `openFromTitle`/chevron/`back()`/`onDeadTab()` across both `hasHero` states, and every classic-retirement source pin (sentinel markers gone, no stray bindings, the slimmed boot body, the deleted harness, the updated persistence test).

## Task Commits

Each task was committed atomically:

1. **Task 1: VIEW THE DEAD opens the panel in title mode, and the Android back button mirrors the chevron** - `7ecbdcc` (feat)
2. **Task 2: retire the classic graveyard loader, its sentinel and its persistence harness** - `d6a80ce` (feat)

**Plan metadata:** (this commit) — SUMMARY.md only (STATE.md/ROADMAP.md are owned by the orchestrator, per this plan's worktree instructions)

## Files Created/Modified

- `mazeworld.html` - Task 1: `#mw-title-dead`'s onclick rewired to `openFromTitle`, `getGameContext`'s `hasOpenModal`/`closeModal` D-03 branch. Task 2: the classic graveyard sentinel block deleted; `window.__mzClassicBoot` slimmed to `fit();paint();`; three stale comment blocks (Phase 44's `#btn-save-quit` note, `__mzClassicBoot`'s own header, the module's `await` call site) corrected
- `src/browser/bridge.js` - `__mzClassicBoot`'s purpose text corrected
- `docs/SHELL-MODULES.md` - regenerated bridge table (`tools/bridge-doc.mjs --write`)
- `src/browser/storage.js` - comment-only correction (adapter is the sole graveyard reader/writer)
- `test/persistence/dual-write-convergence.test.js` - classic-extraction test replaced with an adapter `loadGraveyard()` convergence test; header comment updated; `sandboxClassicPersistence.js` import removed
- `test/persistence/harness/sandboxClassicPersistence.js` - deleted (its only user was the replaced test)
- `test/unit/shell-boards-entry.test.js` (new) - 12 tests across Task 1 (A/B/C/D sections) and Task 2 (E section)

## Decisions Made

See `key-decisions` in the frontmatter above: the `closeModalFactory()` un-threaded-globals test design, the `__mzClassicBoot` purpose-text correction, and the in-scope stray-comment fix at `#btn-save-quit`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected a stale comment above `#btn-save-quit` that would have become false after this plan's own deletion**
- **Found during:** Task 2, while locating every reference to the sentinel block before deleting it
- **Issue:** A Phase 44 comment claimed "the graves sentinel block above is untouched and still the live graveyard persistence" — true when written, but this plan's own Task 2 deletes that exact block in the same commit, which would leave a load-bearing comment asserting something false about a file already in this plan's `files_modified` list.
- **Fix:** Rewrote the comment to state plainly that `engineAdapter.js`'s `persist()`/`boot()` is the one run-save path (dropping the now-false graves-sentinel claim entirely, since D-14's own comment block a few lines below `window.__mzClassicBoot` already carries the graveyard-retirement story).
- **Files modified:** `mazeworld.html`
- **Verification:** `npm test` full-suite re-run (4460/4467, only the documented pre-existing failures); `test/unit/shell-boards-entry.test.js#(E1)` pins the sentinel's absence.
- **Committed in:** `d6a80ce` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — stale comment correction)
**Impact on plan:** A necessary correctness fix confined to a comment in a file this plan already modifies extensively. No scope creep — no additional files touched, no behavior changed.

## Issues Encountered

- `node --test test/persistence/` (bare directory, trailing slash) failed with `MODULE_NOT_FOUND` on this Windows/Node 22 combination — a harness/shell quirk unrelated to this plan's changes, not a real test failure. Re-running with an explicit glob (`node --test "test/persistence/**/*.test.js"`) confirmed all 77 tests in that verification command pass; `npm test` (which uses the project's own default test discovery) also ran cleanly end to end.

## Human verification (deferred to end of run)

Per project convention (verification agents off; UAT batched at the Phase 69 milestone close), these device/visual checks are recorded here for that batch (docs/UAT-v2.0.md) rather than gating this plan:

1. With no live hero, View the Dead opens on GRAVEYARD with the chevron, BACK TO TITLE and ROLL A NEW HERO, and no tab bar.
2. BACK TO TITLE returns to the title, and ENTER there still rolls a new hero.
3. ROLL A NEW HERO opens the roller and lands on the map after commit.
4. After Save & quit, View the Dead shows a single BACK TO THE DUNGEON that resumes the same run on the map.
5. The Android back button on the title-opened panel does what the chevron does, and on the DEAD tab it behaves as before.
6. Airplane mode changes nothing.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- BOARD-01 is now fully complete (both the DEAD-tab half from 66-06 and this plan's title-mode half); BOARD-08's zero-network guarantee holds across every entry/exit path.
- D-14 (greenfield graveyard ownership) is fully closed: the adapter (`engineAdapter.js#loadGraveyard`/`persistGrave`) is the ONE reader and writer of `ddr.graveyard.v1`/`ddr.graveyard.total.v1`; no classic dual path remains anywhere in `mazeworld.html`.
- No blockers for Phase 67 (Play Games integration) or Phase 68 (global boards) — both build behind the same `boardsView`/adapter seam this plan finished wiring end to end.
- The Human verification list above is ready to fold into the Phase 69 batched UAT round (docs/UAT-v2.0.md) alongside 66-06's own deferred items.

---
*Phase: 66-leaderboards-panel-local*
*Completed: 2026-09-23*

## Self-Check: PASSED

- FOUND: mazeworld.html
- FOUND: src/browser/bridge.js
- FOUND: docs/SHELL-MODULES.md
- FOUND: src/browser/storage.js
- FOUND: test/persistence/dual-write-convergence.test.js
- FOUND: test/unit/shell-boards-entry.test.js
- FOUND: .planning/phases/66-leaderboards-panel-local/66-07-SUMMARY.md
- CONFIRMED DELETED: test/persistence/harness/sandboxClassicPersistence.js
- FOUND commit: 7ecbdcc (Task 1)
- FOUND commit: d6a80ce (Task 2)
- `npm test`: 4467 tests, 4460 pass, 7 fail — the 7 failures are exactly the pre-existing worktree CRLF doc-ledger fixtures (`class-pass-ledger.test.js`, `flee-ledger.test.js`), unchanged from the pre-execution baseline. No regressions.
- `node tools/bridge-doc.mjs --check`: exit 0.
