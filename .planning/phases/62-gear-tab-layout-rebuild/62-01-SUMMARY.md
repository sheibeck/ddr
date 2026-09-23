---
phase: 62-gear-tab-layout-rebuild
plan: 01
subsystem: ui
tags: [gear-tab, view-models, tdd, presentation-only]

# Dependency graph
requires:
  - phase: 61-gear-rules-store-purchase-fix
    provides: itemRowState/bagUsage/armorDisplay/lootCompare/usableBy/dropShelfItems (unchanged shared rules this plan reads, never restates)
provides:
  - "GEAR_COPY extended with every string the rebuilt Gear tab needs (header, worn slots, use cell, bag, consumables, kit, act)"
  - "GEAR_WORN_ORDER — the five-key WORN display order"
  - "emptySlotRows(c) extended with a weapon empty-slot row"
  - "gearHeaderModel(state) — slim ARMOR RATING/WILMST header"
  - "gearUseCell(state, it) — USE/ACTIVE/COOLING cell derived only from itemRowState"
  - "gearWornModel(state) — the five fixed WORN rows (weapon/armor/cloak/jewelry1/jewelry2)"
  - "gearBagMeterModel(state) — bag used/cap + pips + BAG FULL line"
  - "gearBagCardsModel(state) — bag-card name/desc/slot-tag/USE"
  - "gearConsumablesModel(state) — HEALING POTION/buff groups/SCROLLS"
  - "gearKitRows(state) — the ALSO ON YOU running-effects block"
affects: [62-02-render-wiring, 62-03-agreement-suite]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure view-model layer built exclusively on existing shared reads (armorDisplay, emptySlotRows, itemRowState, bagUsage, dropShelfItems, usableBy, canRead, LINE_FOR.scrollRefused) — zero restated rules"
    - "Every new player-facing string lives in the frozen GEAR_COPY bank, walked automatically by the voice scan and hp-not-wp guard"

key-files:
  created:
    - test/unit/gear-view-models.test.js
  modified:
    - src/browser/gearTab.js
    - test/unit/gear-panels.test.js
    - test/unit/gearTab.test.js
    - test/voice/safety-scan.test.js

key-decisions:
  - "Split GSCR-01..03 (header/worn/use-cell) and GSCR-04..06 (bag/consumables/kit) into two atomic task commits per the plan's task boundaries, even though both were authored in the same session — required reconstructing/trimming the shared gearTab.js and gear-view-models.test.js files between commits so each commit's diff matches its task's declared scope"
  - "gearUseCell's cooldown sub-text intentionally differs from itemRowState's own cd-prefixed text (itemRowState.text is 'cd 12 SQ'; gearUseCell.sub is '12 SQ') — the label 'COOLING' already carries the 'cd' meaning, so the sub avoids repeating it, per the plan's exact behavior spec"

requirements-completed: [GSCR-01, GSCR-02, GSCR-03, GSCR-04, GSCR-05, GSCR-06]

coverage:
  - id: D1
    description: "gearHeaderModel(state) — slim ARMOR RATING/WILMST header, magic-Cloak-of-Armor-aware, comma-grouped gold"
    requirement: "GSCR-01"
    verification:
      - kind: unit
        ref: "test/unit/gear-view-models.test.js#gearHeaderModel and Edge GSCR-01/* (9 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "gearWornModel(state) — five fixed WORN rows with value/note/use/unequip, built on emptySlotRows/armorDisplay/gearUseCell"
    requirement: "GSCR-02"
    verification:
      - kind: unit
        ref: "test/unit/gear-view-models.test.js#gearWornModel and Edge GSCR-02/* (14 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "gearUseCell(state, it) — USE/ACTIVE/COOLING cell derived only from itemRowState"
    requirement: "GSCR-03"
    verification:
      - kind: unit
        ref: "test/unit/gear-view-models.test.js#gearUseCell and Edge GSCR-03/* (11 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "gearBagMeterModel(state) — used/cap readout + pips + BAG FULL line, read only from bagUsage"
    requirement: "GSCR-04"
    verification:
      - kind: unit
        ref: "test/unit/gear-view-models.test.js#gearBagMeterModel and Edge GSCR-04/* (7 tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "gearBagCardsModel(state) — bag cards with slot-tag family + SWAP suffix, USE cell for bag-only items"
    requirement: "GSCR-05"
    verification:
      - kind: unit
        ref: "test/unit/gear-view-models.test.js#gearBagCardsModel and Edge GSCR-05/* (11 tests)"
        status: pass
    human_judgment: false
  - id: D6
    description: "gearConsumablesModel(state)/gearKitRows(state) — CONSUMABLES block (heal never wastes a potion) and ALSO ON YOU running-effects rows"
    requirement: "GSCR-06"
    verification:
      - kind: unit
        ref: "test/unit/gear-view-models.test.js#gearConsumablesModel, #gearKitRows and Edge GSCR-06/* (14 tests)"
        status: pass
    human_judgment: false

# Metrics
duration: ~45min
completed: 2026-09-23
status: complete
---

# Phase 62 Plan 01: Gear-Tab View Models Summary

**Eight pure, DOM-free view models (header, five-row WORN, USE cell, bag meter, bag cards, CONSUMABLES, ALSO ON YOU) built entirely on the existing shared rules — no snapshot moves, `npm test` green at 4047/4054 with the 7 remaining failures reproduced as pre-existing environment noise on the untouched base commit.**

## Performance

- **Tasks:** 2 completed
- **Files modified:** 4 (1 created)

## Accomplishments
- Extended `GEAR_COPY` with every string the rebuilt Gear tab needs (header, worn-slot labels/notes, USE-cell copy, bag/consumables/kit copy) and added the weapon empty-slot line (`GEAR_COPY.empty.weapon`) to `emptySlotRows(c)`.
- Added `GEAR_WORN_ORDER` (the mock's five-row display order) and three pure models — `gearHeaderModel`, `gearUseCell`, `gearWornModel` — covering GSCR-01/02/03, built only on `armorDisplay`, `emptySlotRows` and `itemRowState`.
- Added four more pure models — `gearBagMeterModel`, `gearBagCardsModel`, `gearConsumablesModel`, `gearKitRows` — covering GSCR-04/05/06, built only on `bagUsage`, `dropShelfItems`, `usableBy`, `canRead` and `LINE_FOR.scrollRefused`. `gearConsumablesModel`'s heal row uses the exact combat-ITEMS-submenu enabled rule (`(c.potions||0) > 0 && c.wp < c.maxWP`), verified to agree with `combatMenuViewModel` on a real `newRun` state — a Gear tap can never waste a potion the combat menu would refuse.
- Authored `test/unit/gear-view-models.test.js` (119-test suite between both commits, 66 tests alone at Task 1 close) covering every behavior bullet, all 22 named `Edge GSCR-*` truths, and purity (two-call deep-equal, JSON-unchanged, legacy-`c` never-throws) for all seven models.
- Extended `test/unit/gear-panels.test.js`'s `GEAR_COPY` deep-equal pin to the full new literal shape and added a weapon-row `emptySlotRows` test; extended `test/unit/gearTab.test.js`'s exports pin with `GEAR_WORN_ORDER` and the eight new model functions; extended `test/voice/safety-scan.test.js` to walk the full `GEAR_COPY` tree (recursive, nested groups) in `collectAuthoredStrings`.

## Task Commits

Each task was committed atomically:

1. **Task 1: GEAR_COPY extension, weapon empty line, header/WORN/USE-cell models** - `ee21110` (feat)
2. **Task 2: Bag meter, bag cards, consumables and kit models, copy scans, full check** - `6ed2451` (feat)

_Note: both tasks were authored together in-session; the working tree was deliberately split back into each task's declared file scope (temporarily removing Task 2's functions/imports/tests, committing Task 1, then restoring them) so each commit's diff matches the plan's per-task boundaries exactly._

## Files Created/Modified
- `src/browser/gearTab.js` - extended `GEAR_COPY`, `emptySlotRows` (weapon row), and 8 new exports: `GEAR_WORN_ORDER`, `gearHeaderModel`, `gearUseCell`, `gearWornModel`, `gearBagMeterModel`, `gearBagCardsModel`, `gearConsumablesModel`, `gearKitRows` — all placed between `itemRowState` and the `DROP_CONFIRM_MS` block, per the plan's placement pin
- `test/unit/gear-view-models.test.js` - new 119-test suite (behavior, 22 named edge truths, purity) for every Task 1 + Task 2 model
- `test/unit/gear-panels.test.js` - `GEAR_COPY` pin updated to the full extended shape; new weapon-row `emptySlotRows` test
- `test/unit/gearTab.test.js` - exports pin extended with `GEAR_WORN_ORDER` and the eight new model functions
- `test/voice/safety-scan.test.js` - `GEAR_COPY` imported and walked recursively in `collectAuthoredStrings`

## Return Shapes (for Plan 02's renderer)

- `gearHeaderModel(state)` → `{ stats: [{key,label,value,text}, {key,label,value,text}] }` (`ar` then `gold`, always this order/length)
- `gearUseCell(state, it)` → `null` or `{ phase, label, sub, remaining }` (`phase` === `itemRowState(state,it).kind`)
- `gearWornModel(state)` → `{ filled, max: 5, countText, rows: [{key,label,filled,name,note,value,use,useRef,unequip}, ×5] }` (keys always `GEAR_WORN_ORDER` order)
- `gearBagMeterModel(state)` → `{ have, slots, full, countText, pips: bool[], fullLine, freeRide }`
- `gearBagCardsModel(state)` → `[{i,name,desc,family,tag,use,useRef}, ...]` (one per `dropShelfItems(c)` entry, true `c.items` index)
- `gearConsumablesModel(state)` → `{ held, heldText, rows: [{key,name,qty,qtyText,desc,verb,enabled,reason,dispatch}, ...] }` (heal always first)
- `gearKitRows(state)` → `[{label,value}, ...]` (Rations first, Kills last, fixed order in between)

## Decisions Made
- Split the two tasks into their own atomic commits by temporarily removing Task 2's code/tests before the Task 1 commit, then restoring them for the Task 2 commit — preserves the plan's per-task commit contract even though both were authored together.
- `gearUseCell`'s cooldown `sub` reads `12 SQ` (not `itemRowState`'s own `cd 12 SQ` text) — matches the plan's exact behavior spec; `label: COOLING` already carries the "cooling down" meaning so the sub isn't redundant.

## Deviations from Plan

None - plan executed exactly as written. Every GEAR_COPY leaf, model return shape and edge case matches the plan's `<action>`/`<behavior>` blocks verbatim.

## Issues Encountered
- One authored test (`Edge GSCR-03/encoding`) initially used a synthetic item name with no matching `ACTIVATION_OF` entry, so `gearUseCell` correctly returned `null` and the test threw on `cell.label`. Fixed by using the real "Cloak of Speed" activation (Rule 1 - test bug, fixed inline before any commit).
- Full-suite run showed 7 pre-existing failures in `test/unit/class-pass-ledger.test.js` and `test/unit/flee-ledger.test.js` (fit-tuning-doc/flee-table pins, unrelated to gearTab.js). Verified via a temporary `git worktree add --detach` at the wave's base commit (`b124348`) that the identical 7 failures reproduce with zero changes applied — confirmed pre-existing CRLF checkout noise on this Windows host per the project's standing ruling, not caused by this plan. The temporary worktree was removed after verification.

## Next Phase Readiness
- Plan 02 (renderer/DOM wiring) can consume all eight model functions' documented return shapes directly — no further reads into `armorDisplay`/`itemRowState`/`bagUsage`/`dropShelfItems` are needed at the render layer.
- No blockers. `engine/`, `content/`, `test/parity/`, `mazeworld.html` and every snapshot fixture are byte-identical to the wave's base commit.

---
*Phase: 62-gear-tab-layout-rebuild*
*Completed: 2026-09-23*

## Self-Check: PASSED

- FOUND: src/browser/gearTab.js
- FOUND: test/unit/gear-view-models.test.js
- FOUND: .planning/phases/62-gear-tab-layout-rebuild/62-01-SUMMARY.md
- FOUND: commit ee21110 (Task 1)
- FOUND: commit 6ed2451 (Task 2)
