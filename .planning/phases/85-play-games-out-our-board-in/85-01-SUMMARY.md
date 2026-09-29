---
phase: 85-play-games-out-our-board-in
plan: 01
subsystem: ui
tags: [shell, hud-menu, mazeworld-html, tdd]

# Dependency graph
requires:
  - phase: 84-play-games-out-our-board-in (leaderboards panel switch)
    provides: the retired old-panel shell mazeworld.html builds on
provides:
  - "hudMenu.js's five-item HUD_MENU_ITEMS (camp, marks, settings, report, notes) and seven-row hudMenuRowStates, with no centring row"
  - "the ☰ dropdown's shipped order: account block, MAKE CAMP, MARKS, SETTINGS, REPORT A BUG, PATCH NOTES, SAVE & QUIT, ABANDON"
  - "centerMap()/window.mzCenterMap unchanged for the stairs/teleport/new-run/boot callers, with the CENTRE MAP row and glideCenterMap deleted"
affects: [85-04 (the ☰ account block rewrite lands cleanly on top of this row order)]

# Tech tracking
tech-stack:
  added: []
  patterns: ["hudMenu.js stays the pure DOM-free source of truth for ☰ row order/state; mazeworld.html's markup/CSS/classic wiring mirrors it row-for-row"]

key-files:
  created: []
  modified:
    - src/browser/hudMenu.js
    - test/unit/hudMenu.test.js
    - mazeworld.html
    - src/browser/bridge.js
    - test/unit/hud-menu-layout.test.js
    - test/unit/shell-gear-toolbar.test.js
    - test/unit/shell-map-hud.test.js
    - test/unit/dead-lockdown.test.js
    - test/unit/hud-bands-layout.test.js
    - test/unit/map-pan.test.js
    - test/unit/reduced-motion.test.js
    - test/unit/shell-account.test.js
    - test/unit/shell-map-invariants.test.js
    - test/unit/shell-map-store-polish.test.js
    - test/unit/shell-menu-quit.test.js
    - test/unit/text-scale.test.js
    - docs/narrative-pass/why/q-260928-z5-bug.json
    - docs/NARRATIVE-PASS.md
    - docs/narrative-pass/review.html
    - .planning/todos/pending/2026-09-28-menu-drop-centre-map-make-camp-first.md (moved to done/)

key-decisions:
  - "Deleted glideCenterMap and its click listener outright rather than leaving it dead code — centerMap()/window.mzCenterMap are the only surviving centring path, unchanged for stairs/teleport/new-run/boot"
  - "Re-indexed the two narrative-pass ledger entries that keyed off HUD_MENU_ITEMS' array position (REPORT A BUG/PATCH NOTES moved from indices 4/5 to 3/4) and regenerated docs/NARRATIVE-PASS.md + review.html so the live-ledger test stays green"
  - "Kept 'CENTRE MAP'/'glideCenterMap' out of even explanatory comment text (not just markup) to satisfy the plan's own zero-occurrence grep acceptance criteria"

requirements-completed: [ACCT-03]

coverage:
  - id: D1
    description: "hudMenu.js: HUD_MENU_ITEMS is five rows (camp, marks, settings, report, notes) in that order, no centre key; hudMenuRowStates returns seven rows in the same order plus saveQuit/abandon"
    requirement: ACCT-03
    verification:
      - kind: unit
        ref: "test/unit/hudMenu.test.js (30 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "mazeworld.html's ☰ markup/CSS/classic wiring: CENTRE MAP row and glideCenterMap deleted, MAKE CAMP first under the account block, centerMap()/window.mzCenterMap untouched"
    requirement: ACCT-03
    verification:
      - kind: unit
        ref: "test/unit/hud-menu-layout.test.js, shell-gear-toolbar.test.js, shell-map-hud.test.js, dead-lockdown.test.js, hud-bands-layout.test.js, shell-account.test.js, shell-map-invariants.test.js, shell-map-store-polish.test.js, shell-menu-quit.test.js, text-scale.test.js, map-pan.test.js, reduced-motion.test.js (287 tests across the plan's full verify list)"
        status: pass
      - kind: unit
        ref: "npm test (full suite, 8324 pass / 2 skipped / 0 fail)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The ☰ menu on the Pixel 7 shows the shipped row order and MAKE CAMP's disabled states correctly on-device"
    verification: []
    human_judgment: true
    rationale: "Visual/device confirmation of on-screen row order and dim states — deferred to the end-of-run Pixel 7 UAT batch per project convention (deferred UAT protocol)"

# Metrics
duration: ~55min
completed: 2026-09-29
status: complete
---

# Phase 85 Plan 01: Drop CENTRE MAP, MAKE CAMP First Summary

**Removed the ☰ menu's CENTRE MAP row and its glide-to-party wiring; MAKE CAMP is now the first row under the account block, ahead of MARKS.**

## Performance

- **Duration:** ~55 min
- **Completed:** 2026-09-29
- **Tasks:** 2
- **Files modified:** 20 (17 planned + 3 collateral: docs/narrative-pass/why/q-260928-z5-bug.json, docs/NARRATIVE-PASS.md, docs/narrative-pass/review.html)

## Accomplishments
- `src/browser/hudMenu.js`'s `HUD_MENU_ITEMS` is now five frozen rows (`camp, marks, settings, report, notes`) with no `centre` key, and `hudMenuRowStates(ctx)` returns seven rows in that order plus `saveQuit`/`abandon`; the header/doc comments describing the ☰ face now speak in Compete terms (initials avatar ON, plain ☰ OFF) instead of retired Play Games sign-in language
- `mazeworld.html`'s `#mw-hud-menu` markup drops the `#mw-chip-centre` row entirely and moves `#btn-camp` to the first row under `#mw-hud-menu-acct`; the classic script's `glideCenterMap()` function and its click listener are deleted, while `centerMap()`/`window.mzCenterMap` are byte-identical and still serve the stairs, teleport, new-run and boot-paint snaps
- The `.mw-hud-menu-glyph[data-glyph="centre"]` CSS rule is gone, and every CSS/markup/classic-script comment that named the centring row, its id or `glideCenterMap` was rewritten to describe the current five-row menu
- `src/browser/bridge.js`'s `__mzCameraGlide` consumer list drops the `glideCenterMap` entry (`keepPartyInView`, `anchorCamOnParty` and the viewport's `pointerdown` handler remain)
- Thirteen test files re-pinned to the new row count/order (five `HUD_MENU_ITEMS`, seven `hudMenuRowStates` rows); `map-pan.test.js`'s and `reduced-motion.test.js`'s `glideCenterMap`-specific glide tests were deleted outright (`keepPartyInView`'s own reduced-motion coverage still proves the glide math)
- The shipped todo `.planning/todos/pending/2026-09-28-menu-drop-centre-map-make-camp-first.md` moved to `.planning/todos/done/` with a "Shipped in 85-01" note

## Task Commits

Each task was committed atomically (TDD: RED then GREEN for Task 1):

1. **Task 1 RED: pin hudMenu.js's five-item menu** - `9652161d` (test)
2. **Task 1 GREEN: hudMenu.js drops CENTRE MAP, MAKE CAMP first** - `f8d6043d` (feat)
3. **Task 2: mazeworld.html markup/CSS/classic wiring, bridge.js, shell tests, todo moved** - `80659ceb` (feat)

**Plan metadata:** (this commit, docs only)

## Files Created/Modified
- `src/browser/hudMenu.js` - Five-row `HUD_MENU_ITEMS`, seven-row `hudMenuRowStates`, rewritten header/doc comments
- `test/unit/hudMenu.test.js` - Re-pinned row order/count, disabled-row expectations
- `mazeworld.html` - ☰ markup reorder + CENTRE MAP row deletion, CSS rule removal, classic-script `glideCenterMap` deletion, comment rewrites
- `src/browser/bridge.js` - Dropped `glideCenterMap` from `__mzCameraGlide`'s consumer list
- `test/unit/hud-menu-layout.test.js` - Re-pinned rows/order/counts across tests (3), (4), (10), (12), (17), (19)
- `test/unit/shell-gear-toolbar.test.js` - Re-pinned row order, added absence check for the centring row
- `test/unit/shell-map-hud.test.js` - Re-pinned chrome test (h), dropped the centre-glyph CSS assertion
- `test/unit/dead-lockdown.test.js` - Inert-while-dead list is now `mw-chip-marks`, `btn-camp`
- `test/unit/hud-bands-layout.test.js` - Viewport-exclusion id list down to three
- `test/unit/map-pan.test.js` - Deleted test (5), the centring glide test
- `test/unit/reduced-motion.test.js` - Deleted the `glideCenterMap` reduced-motion test
- `test/unit/shell-account.test.js` - (F2) re-pinned to three legacy rows, MAKE CAMP first, absence check for the centring listener
- `test/unit/shell-map-invariants.test.js` - Replaced the centring listener/markup pins with absence checks
- `test/unit/shell-map-store-polish.test.js` - Re-anchored the `centerMap` slice's end marker on `window.mzCenterMap = centerMap;`
- `test/unit/shell-menu-quit.test.js` - Dropped the centring listener pin
- `test/unit/text-scale.test.js` - Removed the centre-glyph selector from the fixed-size exemption table
- `docs/narrative-pass/why/q-260928-z5-bug.json` - Re-indexed `HUD_MENU_ITEMS.4/.5` ledger keys to `.3/.4` (REPORT A BUG/PATCH NOTES shifted position when the centring row was removed)
- `docs/NARRATIVE-PASS.md`, `docs/narrative-pass/review.html` - Regenerated via `node tools/narrative-review.mjs` to match the re-indexed ledger
- `.planning/todos/done/2026-09-28-menu-drop-centre-map-make-camp-first.md` - Moved from `pending/`, "Shipped in 85-01" note appended

## Decisions Made
- Deleted `glideCenterMap()` and its listener outright (rather than leaving dead code) since `centerMap()`/`window.mzCenterMap` fully cover every remaining centring trigger (a floor change/teleport, a new run, boot's first paint)
- Kept the literal strings "CENTRE MAP" and "glideCenterMap" out of every comment, not just markup/code, so the plan's own zero-occurrence grep acceptance criteria (`mw-chip-cent(re)|CENTRE[ ]MAP|glideCent(er)Map`) passed cleanly
- Fixed a collateral regression in `docs/narrative-pass/why/q-260928-z5-bug.json`: its two ledger entries keyed off `HUD_MENU_ITEMS`' array index (`.4`/`.5` for REPORT A BUG/PATCH NOTES), which shifted to `.3`/`.4` once the centring row was removed and MAKE CAMP moved to the front — re-indexed both keys and regenerated the derived docs pages so `npm test`'s narrative-review live-ledger check stayed green

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Re-indexed stale HUD_MENU_ITEMS array-index keys in a narrative-pass ledger**
- **Found during:** Task 2's final `npm test` run
- **Issue:** `docs/narrative-pass/why/q-260928-z5-bug.json` pinned `bank:HUD_MENU_ITEMS.4.label` = "REPORT A BUG" and `.5.label` = "PATCH NOTES", indices that were only correct against the old six-item array (marks=0, centre=1, camp=2, settings=3, report=4, notes=5). After Task 1's reorder (camp=0, marks=1, settings=2, report=3, notes=4) those indices pointed at the wrong labels, failing `test/unit/narrative-review.test.js`'s live-ledger check.
- **Fix:** Re-indexed the two ledger keys to `.3`/`.4`, added a one-line note to each `why` explaining the re-index, then regenerated `docs/NARRATIVE-PASS.md` and `docs/narrative-pass/review.html` via `node tools/narrative-review.mjs`.
- **Files modified:** docs/narrative-pass/why/q-260928-z5-bug.json, docs/NARRATIVE-PASS.md, docs/narrative-pass/review.html
- **Verification:** `node --test test/unit/narrative-review.test.js` (11/11 pass); full `npm test` (8324 pass / 2 skipped / 0 fail)
- **Committed in:** 80659ceb (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary to keep `npm test` green after the row reorder; no scope creep beyond the plan's own file list plus the three collateral docs files it forced.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Human verification (deferred to end of run)
1. On the Pixel 7, the ☰ opens on the account block, then MAKE CAMP, MARKS, SETTINGS, REPORT A BUG, PATCH NOTES, SAVE & QUIT, ABANDON.
2. MAKE CAMP is dimmed and inert in combat and while dead, live otherwise.
3. Taking the stairs and starting a new run still centre the map on the party.

Deleted tests (by name):
- `test/unit/map-pan.test.js`: "map-pan (5): glideCenterMap() glides cam to the party centre over ~200ms ease-out"
- `test/unit/reduced-motion.test.js`: "reduced-motion/pan: with the default (reduced) sandbox, glideCenterMap() lands cam on the party centre synchronously"
- `test/unit/hudMenu.test.js`: "HUD_MENU_ITEMS: the centre row reads CENTRE MAP (USER RULING 2026-09-22)"

## Next Phase Readiness
- This plan's ☰ diff is isolated to row order/removal only — 85-04's account-block rewrite lands on top of it without touching the same lines twice, as intended by running this plan first.
- No blockers for 85-02..85-06.

---
*Phase: 85-play-games-out-our-board-in*
*Completed: 2026-09-29*

## Self-Check: PASSED

All created/modified files found on disk (src/browser/hudMenu.js, mazeworld.html, src/browser/bridge.js, docs/narrative-pass/why/q-260928-z5-bug.json, .planning/todos/done/2026-09-28-menu-drop-centre-map-make-camp-first.md); all three commits (9652161d, f8d6043d, 80659ceb) found in `git log --oneline -5`.
