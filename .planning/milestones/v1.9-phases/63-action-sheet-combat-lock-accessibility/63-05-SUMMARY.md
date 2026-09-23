---
phase: 63-action-sheet-combat-lock-accessibility
plan: 05
subsystem: ui
tags: [gear, action-sheet, accessibility, dom, mazeworld]

# Dependency graph
requires:
  - phase: 63-action-sheet-combat-lock-accessibility
    provides: "gearSheetModel + renderGearSheet (Plan 01/02) and openGearSheet/closeGearSheet/refreshGearSheet + window.__mzGearSheet shell wiring (Plan 04) — the sheet this plan's rows/cards now open"
provides:
  - "Every WORN row (all five, empty included) and BAG card is an accessible opener for the bottom action sheet — role=button, tabindex=0, aria-haspopup=dialog, an sr-only 'opens actions' hint, Enter/Space support, deps.openGearSheet(target, openerId)"
  - "The inline USE/ACTIVE/COOLING button still acts directly, stopping propagation so the same tap never also opens the sheet"
  - "The Phase 62 interim in-row Unequip/Bag-full block and the per-card harvest through renderCarriedList are deleted from renderGearTab; GEAR_COPY.act is gone, GEAR_COPY.opensHint is new"
  - "renderCarriedList stays byte-identical to the Phase 62 close (4adc5e4) — it now serves only the store sell list, the combat ITEMS list and the loot card"
  - "Migrated/added tests proving the row-to-sheet-to-dispatch path end to end (real gear-tab mount, real classic openGearSheet/closeGearSheet/dispatch), plus a greenfield guard that no interim in-row action class or call survives"
  - "thief.gear/mu.gear snapshots regenerated for the new row/card DOM; thief.gear-confirms deleted (the Plan 04 sheet snapshots replace it)"
  - "docs/SHELL-MODULES.md and docs/GEAR-SLOTS.md caught up to describe the sheet as shipped; GSCR-07/08/09/10 and GRULE-02 marked complete in REQUIREMENTS.md"
affects: [64-device-batch]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "renderGearTab's opener(main, target, openerId) closure is the ONE place a row/card becomes an accessible sheet opener — sets id/role/tabindex/aria-haspopup, appends the sr-only opens-hint, wires onkeydown for Enter/Space, and returns the open() callback the row's own onclick uses. Both WORN rows and BAG cards call it identically, so there is exactly one accessibility contract for 'this row opens something.'"
    - "The inline USE button's onclick signature changed from a bare closure to (e) => { e?.stopPropagation?.(); deps.useItem?.(ref); } — the one place a decision button sits inside a now-clickable row and must not also trigger the row's own handler."

key-files:
  created: []
  modified:
    - src/browser/gearTab.js
    - mazeworld.html
    - test/unit/gear-tab-dom.test.js
    - test/unit/gear-agreement.test.js
    - test/unit/shell-worn-slots.test.js
    - test/unit/gear-panels.test.js
    - test/unit/gear-sheet-shell.test.js
    - test/unit/shell-tab-snapshots.test.js
    - test/unit/shell-gear-toolbar.test.js
    - test/unit/fixtures/shell-snapshots/thief.gear.txt
    - test/unit/fixtures/shell-snapshots/mu.gear.txt
    - test/unit/fixtures/shell-snapshots/thief.gear-confirms.txt
    - docs/SHELL-MODULES.md
    - docs/GEAR-SLOTS.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "GRULE-02 is marked complete in REQUIREMENTS.md by this plan even though it is not in this plan's own `requirements` frontmatter list — its live combat re-render was already proven in Plan 04's gear-sheet-shell.test.js, and this plan's Task 3 explicitly instructed marking it complete now that the row-to-sheet wiring (the last piece) is done, on the same precedent 62-03 set for GSCR-11."
  - "shell-gear-toolbar.test.js's 'gearRow:true is passed at exactly the GEAR call site' pin (Rule 1) was re-pointed to assert gearRow:true's total retirement (zero occurrences anywhere), since the per-card renderCarriedList harvest it pinned is gone."

requirements-completed: [GSCR-07, GSCR-08, GSCR-09, GSCR-10, GRULE-02]

coverage:
  - id: D1
    description: "Every WORN row (filled and empty) is an accessible sheet opener: tapping it calls deps.openGearSheet({ from: 'worn', slot }, 'gear-open-<slot>'); the row's main block carries id/role=button/tabindex=0/aria-haspopup=dialog and an sr-only opens-hint; Enter and Space open it, an unrelated key does not"
    requirement: "GSCR-07"
    verification:
      - kind: unit
        ref: "test/unit/gear-tab-dom.test.js — 'WORN rows open the sheet: ...'"
        status: pass
      - kind: unit
        ref: "test/unit/shell-worn-slots.test.js — 'Worn rows: tapping a worn jewel's row opens the sheet on that slot'"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every BAG card is an accessible sheet opener: tapping it calls deps.openGearSheet({ from: 'bag', i, n }, 'gear-open-bag-<i>') with the same accessible-opener attributes and hint; CONSUMABLES cards get no opener and keep their own USE/READ buttons"
    requirement: "GSCR-08"
    verification:
      - kind: unit
        ref: "test/unit/gear-tab-dom.test.js — 'BAG cards open the sheet: ...' and 'greenfield: ... CONSUMABLES rows carry no mw-gear-tap and no onclick'"
        status: pass
    human_judgment: false
  - id: D3
    description: "The inline USE/ACTIVE/COOLING button still acts directly (useItem({ slot }) on a WORN row, useItem(i) on a bag card) and stops propagation, so the same tap never also opens the sheet; the Phase 62 interim in-row Unequip/Bag-full block, the per-card harvest and GEAR_COPY.act are all deleted, with renderCarriedList byte-identical to 4adc5e4"
    requirement: "GSCR-09"
    verification:
      - kind: unit
        ref: "test/unit/gear-tab-dom.test.js — 'WORN USE cell: ... its click stops propagation, dispatches useItem({ slot }) and never opens the sheet'"
        status: pass
      - kind: other
        ref: "git show 4adc5e4:src/browser/gearTab.js | node -e ... (renderCarriedList body byte-identity check)"
        status: pass
    human_judgment: false
  - id: D4
    description: "End to end in the sandbox: tapping the thief's bagged-jewel card (through the real gear-tab mount) opens the sheet with SWAP INTO JEWELRY 1/2 and DROP; after the arm window, SWAP INTO JEWELRY 1 closes the sheet and then calls window.mzEquipItem(i, 'jewelry1'); focus returns to gear-open-bag-<i> on the next tick"
    requirement: "GSCR-10"
    verification:
      - kind: unit
        ref: "test/unit/gear-sheet-shell.test.js — 'end-to-end: tapping the bagged jewel's row ... SWAP INTO JEWELRY 1 closes it before dispatching equipItem(i, \"jewelry1\"), and focus returns to the opener'"
        status: pass
    human_judgment: false
  - id: D5
    description: "In a fight, the Gear sheet's EQUIP/SWAP/UNEQUIP actions grey with the combat reason while USE stays live, and clear again once the fight ends — proven end to end via the real sheet lifecycle now that every row/card reaches it through its own tap"
    requirement: "GRULE-02"
    verification:
      - kind: unit
        ref: "test/unit/gear-sheet-shell.test.js — 'sandbox combat re-render (GRULE-02): ...' (Plan 04)"
        status: pass
    human_judgment: false
  - id: D6
    description: "thief.gear and mu.gear snapshots regenerated for the new row/card DOM (openers, no interim actions); thief.gear-confirms deleted with its test (the Plan 04 sheet snapshots replace it); the fixture guard/list/count updated to eight; hero/store fixtures untouched"
    requirement: "GSCR-08"
    verification:
      - kind: unit
        ref: "test/unit/shell-tab-snapshots.test.js — full file (11 tests)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Phase gates: npm run build:www, npm test (fail 0 beyond the documented worktree CRLF ledger), npm run boot:check (four checks, first run), engine/content/test-parity byte-identical to 4adc5e4, prototype master hash unchanged, REQUIREMENTS.md marking GSCR-07/08/09/10 + GRULE-02 complete, docs describing the sheet as shipped"
    verification:
      - kind: other
        ref: "npm run build:www && npm test && npm run boot:check; git diff --stat 4adc5e4 -- engine/ content/ test/parity/; git hash-object test/parity/prototype-master.js.txt"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-09-23
status: complete
---

# Phase 63 Plan 05: Row Integration + Interim Cleanup + Phase Close Summary

**WORN rows and BAG cards now open the bottom action sheet as accessible openers; the Phase 62 interim in-row Unequip/Bag-full block and per-card harvest are deleted; tests migrated; thief.gear/mu.gear regenerated and thief.gear-confirms retired; docs and REQUIREMENTS.md close out GSCR-07/08/09/10 and GRULE-02.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-09-23T11:36:00-04:00 (approx, worktree base commit b452b10)
- **Completed:** 2026-09-23T11:56:12-04:00
- **Tasks:** 3
- **Files modified:** 15 (0 created, 14 modified, 1 deleted)

## Accomplishments

- `renderGearTab`'s new `opener(main, target, openerId)` closure marks every WORN row's `.mw-gear-main` and every BAG card's `.mw-gear-card-main` as an accessible sheet opener (`id`, `role="button"`, `tabindex="0"`, `aria-haspopup="dialog"`, an sr-only `GEAR_COPY.opensHint` child, Enter/Space via `onkeydown`) and wires the row/card's own `onclick` to `deps.openGearSheet(target, openerId)` — `{ from: "worn", slot }` for the five WORN rows (filled and empty), `{ from: "bag", i, n }` for BAG cards. CONSUMABLES cards are untouched — no opener, no `mw-gear-tap`, they keep their own USE/READ buttons.
- The inline USE cell's `onclick` now stops propagation before dispatching `useItem`, so a USE tap on a now-clickable row never also opens the sheet.
- Deleted the Phase 62 interim in-row actions wholesale: the `if (row.unequip) { … }` block under WORN rows, the per-card `renderCarriedList`/`tmp`/`.mw-gear-actions` harvest under BAG cards, and `GEAR_COPY.act` (`unequip`/`bagFull`). `GEAR_COPY.opensHint` is new. `renderGearTab` no longer calls `renderCarriedList` anywhere; `renderCarriedList`'s own function body stays byte-identical to the Phase 62 close (`4adc5e4`), confirmed by a direct byte comparison.
- Added `.mw-gear-tap{cursor:pointer;touch-action:manipulation}` and a focus-visible outline rule for `.mw-gear-tap [role="button"]` to `mazeworld.html`'s Gear CSS block; updated the `#screen-gear` markup comment to describe the sheet as shipped.
- Migrated every test that assumed the interim in-row actions: `gear-tab-dom.test.js` (new WORN-row and BAG-card sheet-open tests, an extended USE-cell stopPropagation test, a greenfield guard), `gear-agreement.test.js` (Edge GSCR-11/concurrency now opens two sheets in sequence through the real rows), `shell-worn-slots.test.js` (gearRow:true's full retirement, a worn-row sheet-open replacement for the old Unequip test), `gear-panels.test.js` (the `GEAR_COPY` pin), and two new end-to-end tests in `gear-sheet-shell.test.js` that drive the real gear-tab mount (`paint()`) — a bagged jewel's row opening the sheet through to `window.mzEquipItem` dispatch and focus return, and a WORN row's USE tap never opening the sheet.
- `shell-gear-toolbar.test.js`'s `gearRow:true` pin (Rule 1 — a pre-existing regression-guard test this plan's own change legitimately broke) was re-pointed from "exactly one call site" to "zero occurrences anywhere," since the only call site (the per-card harvest) is gone.
- Regenerated `thief.gear.txt`/`mu.gear.txt` for the new row/card DOM; deleted `thief.gear-confirms.txt` and its test (the Plan 04 sheet snapshots `thief.gear-sheet-bag`/`thief.gear-sheet-worn` replace it); updated the fixture guard list/title/count from nine to eight. Confirmed via `git status --short` that only these two fixtures moved and the confirms fixture was deleted; the hero and store fixtures are untouched (`git diff --stat 4adc5e4` on those four paths prints nothing).
- Caught up `docs/SHELL-MODULES.md` (the Gear tab no longer calls `renderCarriedList`; that list's `gearRow` branch is now caller-less, flagged as a cleanup candidate) and `docs/GEAR-SLOTS.md` (a dated Phase 63 update note describing the shipped sheet: every decision routes through it, mid-fight greying via `gearLockReason`, illegal candidates listed but greyed, DROP's second-tap confirm, `itemDropped`/`itemUnequipped` narrating on the rail).
- Marked `GSCR-07`, `GSCR-08`, `GSCR-09`, `GSCR-10` and `GRULE-02` complete in `.planning/REQUIREMENTS.md`, with their Traceability rows set to Complete.
- All phase gates green: `npm run build:www` (after `npm install --prefer-offline` to restore the worktree's `node_modules`), `npm test` (4190 pass / 7 fail — the documented worktree CRLF-checkout ledger in `class-pass-ledger.test.js`/`flee-ledger.test.js`, confirmed unrelated to this plan's files), `npm run boot:check` (all four checks passed on the first run, no re-run needed for the graves-timing flake), `git diff --stat 4adc5e4 -- engine/ content/ test/parity/` empty, and `git hash-object test/parity/prototype-master.js.txt` still `a1f4d0dc29782218d8e5aab65bc5989c33f917f0`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Rows and cards open the sheet; interim in-row actions removed; row CSS and the #screen-gear comment** - `0009aa7` (feat) — `src/browser/gearTab.js`, `mazeworld.html`
2. **Task 2: Migrate the interim-action tests, end-to-end row → sheet tests, declared snapshot regeneration** - `ccb28fa` (test) — `test/unit/gear-tab-dom.test.js`, `test/unit/gear-agreement.test.js`, `test/unit/shell-worn-slots.test.js`, `test/unit/gear-panels.test.js`, `test/unit/gear-sheet-shell.test.js`, `test/unit/shell-tab-snapshots.test.js`, `test/unit/shell-gear-toolbar.test.js` (Rule 1 re-point), `test/unit/fixtures/shell-snapshots/thief.gear.txt`, `test/unit/fixtures/shell-snapshots/mu.gear.txt`, `test/unit/fixtures/shell-snapshots/thief.gear-confirms.txt` (deleted)
3. **Task 3: Docs, requirements and the phase gates** - `24427c2` (docs) — `docs/SHELL-MODULES.md`, `docs/GEAR-SLOTS.md`, `.planning/REQUIREMENTS.md`

## Files Created/Modified

- `src/browser/gearTab.js` — `opener()` closure; WORN rows and BAG cards wired to `deps.openGearSheet`; the in-row Unequip/Bag-full block and per-card harvest deleted; `GEAR_COPY.act` deleted, `GEAR_COPY.opensHint` added; `renderCarriedList` untouched (byte-identical to 4adc5e4)
- `mazeworld.html` — `.mw-gear-tap`/focus-visible CSS; `#screen-gear` markup comment updated
- `test/unit/gear-tab-dom.test.js` — sheet-open tests for WORN rows and BAG cards, extended USE-cell stopPropagation test, ordering re-pin (no actions column), greenfield guard
- `test/unit/gear-agreement.test.js` — Edge GSCR-11/concurrency rewritten to open two sheets in sequence through the real rows; header comment updated
- `test/unit/shell-worn-slots.test.js` — gearRow:true retirement pin; Unequip test replaced with a worn-row sheet-open test
- `test/unit/gear-panels.test.js` — `GEAR_COPY` deep-equal pin (act group dropped, opensHint added)
- `test/unit/gear-sheet-shell.test.js` — two new end-to-end tests (real gear-tab mount → sheet → dispatch; WORN USE never opens the sheet)
- `test/unit/shell-tab-snapshots.test.js` — `thief.gear-confirms` test/fixture removed; guard list/title/count updated to eight; header comment updated
- `test/unit/shell-gear-toolbar.test.js` — Rule 1: `gearRow:true` pin re-pointed to total retirement; the now-dead `gearTabBodyRegion()` helper removed
- `test/unit/fixtures/shell-snapshots/thief.gear.txt`, `mu.gear.txt` — regenerated for the new row/card DOM
- `test/unit/fixtures/shell-snapshots/thief.gear-confirms.txt` — deleted
- `docs/SHELL-MODULES.md` — "What stays shared" paragraph updated
- `docs/GEAR-SLOTS.md` — Phase 63 update note added after the Phase 62 note
- `.planning/REQUIREMENTS.md` — GSCR-07/08/09/10 and GRULE-02 checked off; Traceability rows set to Complete

## Decisions Made

- GRULE-02 marked complete now (Task 3), even though it is not in this plan's own `requirements` frontmatter — its combat re-render was already proven in Plan 04's `gear-sheet-shell.test.js`, and this plan's action list explicitly asked for the mark once the row-to-sheet wiring landed, on the precedent 62-03 set for GSCR-11.
- `shell-gear-toolbar.test.js`'s `gearRow:true` pin re-pointed (Rule 1) from "exactly one call site" to "zero occurrences," since the per-card `renderCarriedList` harvest it pinned no longer exists.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing `gearRow:true` count pin blocked this plan's own must_have deletion**
- **Found during:** Task 2 (`npm test` full-suite run after the Task 1 commit)
- **Issue:** `shell-gear-toolbar.test.js`'s "UIF-01: gearRow:true is passed at exactly the GEAR call site" test hard-pinned `gearRow: true` to exactly one occurrence in `src/browser/gearTab.js` — this plan's own must_have (deleting the per-card harvest) legitimately drops that to zero.
- **Fix:** Re-pointed the test to assert `gearRow: true`'s total retirement (zero occurrences in both the classic script and `gearTab.js`), removed the now-dead `gearTabBodyRegion()` helper it used, and updated the test title/comment to name the Phase 63 removal.
- **Files modified:** `test/unit/shell-gear-toolbar.test.js`
- **Verification:** `node --test test/unit/shell-gear-toolbar.test.js` green (15/15); full `npm test` dropped from 8 failures to the documented 7-failure CRLF ledger
- **Committed in:** `ccb28fa` (Task 2 commit)

**2. [Rule 3 - Blocking] `@capacitor/core` and friends not installed in the fresh worktree**
- **Found during:** Task 3 (`npm run build:www`)
- **Issue:** `npm run build:www` failed with `@capacitor/core is not installed` — the worktree's own `node_modules` was never populated.
- **Fix:** Ran `npm install --prefer-offline` (per this plan's own project rules; `package.json`/`package-lock.json` untouched — confirmed via `git status`).
- **Files modified:** none tracked (node_modules only)
- **Verification:** `npm run build:www` then succeeded; `git status --short` showed no `package.json`/`package-lock.json` diff
- **Committed in:** not committed (node_modules is gitignored; no tracked-file change)

---

**Total deviations:** 2 auto-fixed (1 Rule 1 — a pre-existing regression-guard test this plan's own must_have change legitimately broke; 1 Rule 3 — a blocking missing-dependency install, package manager only, no package.json/lock change).
**Impact on plan:** Both fixes were necessary to land the plan's own explicitly required changes and to run the phase gates at all. No scope creep.

## Issues Encountered

None beyond the two auto-fixed deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Every Gear-tab decision (equip, swap, unequip, use, drop) now goes through the bottom action sheet; no interim in-row path survives. GSCR-07, GSCR-08, GSCR-09, GSCR-10 and GRULE-02 are all complete, with every phase gate green.
- Carried forward for Phase 64's device batch (per this and prior plans' own flagged assumptions, never auto-backstopped here):
  - GSCR-10/D7 (Plan 04): TalkBack's actual narration of the sheet's dialog/labelledby/opens-hint semantics on a real device.
  - GSCR-10/D8 (Plan 04) and GRULE-02: the Android hardware back button's real-device feel, and the in-hand mid-fight greying check.
  - Reduced motion on an actual device (the automated reduced-motion snap paths are proven; the felt experience is not).
- `renderCarriedList`'s `gearRow` branch and its `.mw-drop-confirm`/`.mw-swap-confirm`/`.mw-gear-actions` CSS are now caller-less from the Gear tab (the store sell list, combat ITEMS list and loot card never set `gearRow: true`) — kept byte-identical by the phase's own standing ruling, flagged here as a cleanup candidate for a later quick task, not part of this milestone.

---
*Phase: 63-action-sheet-combat-lock-accessibility*
*Completed: 2026-09-23*

## Self-Check: PASSED

- FOUND: src/browser/gearTab.js
- FOUND: mazeworld.html
- FOUND: test/unit/gear-tab-dom.test.js
- FOUND: test/unit/gear-agreement.test.js
- FOUND: test/unit/shell-worn-slots.test.js
- FOUND: test/unit/gear-panels.test.js
- FOUND: test/unit/gear-sheet-shell.test.js
- FOUND: test/unit/shell-tab-snapshots.test.js
- FOUND: test/unit/shell-gear-toolbar.test.js
- FOUND: test/unit/fixtures/shell-snapshots/thief.gear.txt
- FOUND: test/unit/fixtures/shell-snapshots/mu.gear.txt
- CONFIRMED DELETED: test/unit/fixtures/shell-snapshots/thief.gear-confirms.txt
- FOUND: docs/SHELL-MODULES.md
- FOUND: docs/GEAR-SLOTS.md
- FOUND: .planning/REQUIREMENTS.md
- FOUND commit: 0009aa7 (feat(63-05): rows and cards open the sheet; interim in-row actions removed)
- FOUND commit: ccb28fa (test(63-05): migrate interim-action tests to the sheet flow; regenerate gear snapshots)
- FOUND commit: 24427c2 (docs(63-05): catch up SHELL-MODULES/GEAR-SLOTS and close the phase requirements)
