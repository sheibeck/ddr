---
phase: 63-action-sheet-combat-lock-accessibility
plan: 01
subsystem: ui
tags: [gear, action-sheet, combat-lock, accessibility, pure-view-model, mazeworld]

# Dependency graph
requires:
  - phase: 62-gear-tab-layout-rebuild
    provides: gearWornModel/gearBagCardsModel/gearUseCell/GEAR_COPY/GEAR_WORN_ORDER (src/browser/gearTab.js) — the rows and cards this plan reads, never re-derives
  - phase: 61-gear-rules-store-purchase-fix
    provides: gearLockReason (engine/items.js), LINE_FOR.gearRefused (narrationLines.js), lootCompare (viewModels.js) — the combat lock and its own reason text
provides:
  - "gearSheetModel(state, target): the pure header + ordered-actions view model behind every WORN-slot and BAG-card action sheet decision"
  - "GEAR_SHEET_COPY: every new sheet string, frozen and voice/hp-not-wp scanned"
affects: [63-02-render-wiring, 63-03-engine-agreement-sweep, 63-04-shell-lifecycle, 63-05-row-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sheet actions never restate a rule: legality/upgrade text from lootCompare, the combat reason from LINE_FOR.gearRefused, bag-full from gearWornModel's own row.unequip.blocked"
    - "Action shape { key, label, sub, reason, enabled, run, confirm } — reason is '' when enabled and === sub when greyed; confirm is true only for DROP"

key-files:
  created:
    - src/browser/gearSheet.js
    - test/unit/gear-sheet-model.test.js
  modified:
    - test/voice/safety-scan.test.js
    - test/unit/hp-not-wp.test.js

key-decisions:
  - "candidate()/bag-slot actions check the combat lock before legality/bag-full, mirroring the engine's own refuseGear-before-legality order (Edge GSCR-09/adjacency)"
  - "The Cloak of Armor's magic-plate armor row reads as EMPTY in the sheet header (armorD.worn false) even though gearWornModel reports it filled:true — the header label follows armorD.worn, the title still shows the plate's name"

requirements-completed: [GSCR-07, GSCR-08, GSCR-09, GRULE-02]

coverage:
  - id: D1
    description: "gearSheetModel(state, target) returns the correct header/actions for a filled or empty WORN slot (weapon/armor/cloak/jewelry1/jewelry2), including destroyed-armor DISCARD and the Cloak-of-Armor magic-plate empty-armor case"
    requirement: "GSCR-07"
    verification:
      - kind: unit
        ref: "test/unit/gear-sheet-model.test.js — Filled worn jewel / Worn weapon / Destroyed armor / Cloak-of-Armor-only armor slot / Empty weapon slot / Edge GSCR-07/*"
        status: pass
    human_judgment: false
  - id: D2
    description: "gearSheetModel(state, target) returns the correct header/actions for a BAG card — EQUIP TO/SWAP INTO per named slot (both jewelry keys), DROP with confirm:true, and the explained upgrade/why line for weapon/armor"
    requirement: "GSCR-08"
    verification:
      - kind: unit
        ref: "test/unit/gear-sheet-model.test.js — Bag weapon card / Bag armor card / Bag header / Acceptance: Spiked Staff / Edge GSCR-08/*"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every greyed action's reason is the engine's own text (lootCompare's illegal line, the bag-full rule, or the Phase 61 gearRefused line) — never invented UI copy; every enabled action's reason is ''"
    requirement: "GSCR-09"
    verification:
      - kind: unit
        ref: "test/unit/gear-sheet-model.test.js — Illegal weapon/armor / Edge GSCR-09/adjacency / Edge GSCR-09/empty"
        status: pass
    human_judgment: false
  - id: D4
    description: "In combat (gearLockReason==='combat'), EQUIP/SWAP/UNEQUIP/DISCARD are greyed with the single-sourced Phase 61 line; USE and DROP stay enabled; clearing combat re-enables the greyed actions"
    requirement: "GRULE-02"
    verification:
      - kind: unit
        ref: "test/unit/gear-sheet-model.test.js — Acceptance/combat / Combat, worn jewel sheet / USE is never greyed / DROP always carries confirm true"
        status: pass
    human_judgment: false
  - id: D5
    description: "GEAR_SHEET_COPY is frozen (nested groups too), scanned by the family-friendly voice guard and the hp-not-wp guard, and gearSheet.js is pinned to the module contract (no window/document, no-fork list, combat line never quoted as a literal)"
    verification:
      - kind: unit
        ref: "test/voice/safety-scan.test.js — Flavor banks: all remaining authored player-facing copy is family-friendly | test/unit/hp-not-wp.test.js — src/browser/gearSheet.js: no string literal contains a standalone wp/WP token | test/unit/gear-sheet-model.test.js — Module contract (a)-(d)"
        status: pass
    human_judgment: false

duration: 55min
completed: 2026-09-23
status: complete
---

# Phase 63 Plan 01: Gear Action-Sheet Model Summary

**Pure `gearSheetModel(state, target)` + frozen `GEAR_SHEET_COPY` deciding every equip/swap/unequip/use/drop action, its engine-sourced greyed reason, and its exact dispatched engine action, for both a WORN slot and a BAG card.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-09-23T13:34:00Z (approx, from worktree base commit)
- **Completed:** 2026-09-23T14:29:32Z
- **Tasks:** 2
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- `src/browser/gearSheet.js` — `gearSheetModel(state, target)`, the ONE pure view model for the GEAR tab's bottom action sheet, covering both a WORN-slot target (`{ from: "worn", slot }`) and a BAG-card target (`{ from: "bag", i, n }`).
- `GEAR_SHEET_COPY` — every new sheet string (header words, action labels/templates, sub-lines, the bag-full line, the DROP confirm), frozen and nested-frozen.
- The combat lock (`gearLockReason`), legality/upgrade text (`lootCompare`) and bag-full state (`gearWornModel`'s own `row.unequip.blocked`) are read, never re-derived — GSCR-11's no-fork rule is pinned by a dedicated module-contract test.
- Illegal weapon/armor candidates are always LISTED (never hidden) and greyed with the engine's own refusal text.
- USE and DROP are never greyed in combat (GRULE-02); EQUIP/SWAP/UNEQUIP/DISCARD are greyed with the single-sourced Phase 61 `gearRefused` line, read at call time — never quoted as a literal anywhere in the file (module-contract test (c) pins this).

## Task Commits

Each task was committed atomically:

1. **Task 1: GEAR_SHEET_COPY and gearSheetModel(state, target), test-first** - `71ec7d0` (feat) — `src/browser/gearSheet.js` + `test/unit/gear-sheet-model.test.js` (30 passing tests: behavior, acceptance, combat lock, GSCR-07/08/09 edges, purity)
2. **Task 2: Scan the new copy, pin the module contract, full suite** - `821cccf` (test) — extended `test/voice/safety-scan.test.js` and `test/unit/hp-not-wp.test.js`, appended a 4-test module-contract section to `gear-sheet-model.test.js` (34 tests total in that file), ran `npm run build:www && npm test`

_Note: this plan's `tdd="true"` Task 1 was authored test-first (the full behavior/edge/purity suite was written before/alongside the implementation and iterated to green in the same commit — no separate RED-only commit was created, since the plan's single-commit-per-task protocol groups the test file and its implementation together)._

## Files Created/Modified

- `src/browser/gearSheet.js` - `GEAR_SHEET_COPY` (frozen copy bank) + `gearSheetModel(state, target)` (the pure sheet view model)
- `test/unit/gear-sheet-model.test.js` - 34 tests: behavior, the Spiked Staff acceptance case, combat-lock greying, illegal candidates, USE-sub-by-phase, GSCR-07/08/09 edges, purity, and the module-contract section
- `test/voice/safety-scan.test.js` - walks `GEAR_SHEET_COPY`'s string leaves alongside `GEAR_COPY`
- `test/unit/hp-not-wp.test.js` - adds `GEAR_SHEET_COPY` to the walked copy-object list, plus a sibling literal scan of `src/browser/gearSheet.js`

## Exact Return Shape (for Plans 02–05)

`gearSheetModel(state, target)` returns `null` for any malformed/unresolvable target (unknown worn slot, missing/name-mismatched bag card, a bag-free item, or a state with no `c`), otherwise:

```
{
  target,                 // the target object passed in, unchanged
  label: string,           // "<SLOT> · WORN" | "<SLOT> · EMPTY" | "BAG · <FAMILY>" | "BAG · USED FROM THE BAG"
  title: string,           // the item name, "NOTHING WORN", or GEAR_COPY.magicPlate
  note: string,            // row.note (worn) or card.desc (bag)
  why: string,             // "" for worn; lootCompare(c,it).line when legal, else "" for bag
  actions: [
    {
      key: string,          // "use" | "unequip" | "discard" | "nothing" |
                             // "swap:<i>" | "equip:<i>" (worn target) |
                             // "slot:<key>" | "drop" (bag target)
      label: string,        // GEAR_SHEET_COPY.act.* with {name}/{slot} substituted
      sub: string,           // enabled sub-line, OR === reason when greyed
      reason: string,        // "" when enabled; the engine's own text when greyed
      enabled: boolean,
      run: object | null,    // the exact engine action ({type:"useItem"|"unequipSlot"|"equipItem"|"dropItem", ...}), or null only for "nothing"
      confirm: boolean,      // true only for the "drop" action
    },
    ...
  ],
}
```

Action key/order per branch (fixed, engine-verifiable by run):

- **Worn, filled:** `use` (if `row.use`) → `discard` (destroyed armor) or `unequip` → `swap:<i>` per fitting bag card (ascending `c.items` index).
- **Worn, empty:** `equip:<i>` per fitting bag card, or a single `nothing` (enabled:false, run:null) when none fit.
- **Bag card:** `use` (if `card.use`) → `slot:<key>` per named slot the family owns (JEWELRY 1 before JEWELRY 2) → `drop` (confirm:true, always last).

## GEAR_SHEET_COPY leaves (every string, for Plans 02–05's copy references)

```
head:  { worn:"WORN", empty:"EMPTY", bag:"BAG", fromBag:"USED FROM THE BAG", sep:" · ", nothingWorn:"NOTHING WORN" }
act:   { use:"USE", unequip:"UNEQUIP", discard:"DISCARD", swapFor:"SWAP FOR {name}", equip:"EQUIP {name}",
         equipTo:"EQUIP TO {slot}", swapInto:"SWAP INTO {slot}", drop:"DROP",
         dropConfirm:"DROP IT? · tap again", nothing:"NOTHING TO EQUIP" }
sub:   { unequip:"Moves to the bag and takes a slot.", bagFull:"Bag is full — free a slot first.",
         discard:"It is scrap now. Off it comes, and nothing goes in the bag.",
         fills:"Fills the slot and frees a bag slot.", comesOff:"{name} comes off and goes to the bag.",
         scrap:"{name} is scrap. It stays behind.", drop:"Gone for good. Frees a slot immediately.",
         nothing:"Nothing in the bag fits this slot. Find something, or live without." }
use:   { ready:"Ready when you are.", consumable:"One use. Then it is a memory.",
         effect:"Already running — {n} squares left.", effectOne:"Already running — 1 square left.",
         cooldown:"Cooling down — {n} more squares.", cooldownOne:"Cooling down — 1 more square.",
         charges:"Charges {state}." }
cancel: "CANCEL"
```

## Decisions Made

- `candidate()` (worn-slot swap/equip actions) and the bag-card's per-key EQUIP TO/SWAP INTO actions both check `lockLine(verb) || (illegal/bag-full check)` — the combat lock wins over any other greyed reason, matching the engine's own `refuseGear`-before-legality order (Edge GSCR-09/adjacency, proven for both an illegal-candidate collision and a bag-full collision).
- The Cloak of Armor's magic-plate-only armor row is header-EMPTY (`armorD.worn` false drives the header word) even though `gearWornModel` marks the row `filled:true` (so its plate name still shows as the title) — matches the CONTEXT ruling verbatim and is proven by a dedicated test.
- Task 1's tests were authored alongside the implementation (both landed in one `feat` commit) rather than a separate RED-only commit — the plan's task-commit protocol groups one commit per task, and 30 tests already existed and passed at commit time; there was no interim "tests exist and fail" state to commit separately without violating the single-commit-per-task rule.

## Deviations from Plan

None - plan executed exactly as written. All `<action>` pseudocode (GEAR_SHEET_COPY leaves, `gearSheetModel`'s shared locals, `equipRun`/`useAction`/`candidate` helpers, the worn/bag branches) was implemented as specified; every `<behavior>` bullet and `must_haves.truths` entry has a corresponding passing test.

## Issues Encountered

- Two Edge-case test scaffolds needed correction against real fixture data (not the model): `fixedStates().thief`'s bag ends with a slot-exempt potion, so freeing a slot required popping a slot-consuming item rather than the array's last entry; `fixedStates().mu` wears starting Cloth armor (not empty), so the "empty armor slot" edge test uses a local Magic User fixture instead of the shared harness fixture. Both are test-authoring corrections — the model itself required no change.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `gearSheetModel`/`GEAR_SHEET_COPY` are ready for Plan 02 (the DOM renderer), Plan 03 (the engine-agreement sweep proving every greyed `run` is refused by the engine with the same reason), and Plans 04–05 (shell lifecycle and row wiring) to read directly — the exact return shape and every copy leaf are recorded above.
- No blockers. `npm run build:www && npm test`: 4132 tests, 4125 pass, 7 known CRLF-checkout false-fails in `test/unit/class-pass-ledger.test.js`/`test/unit/flee-ledger.test.js` (both files byte-identical to the worktree's base commit `6395a0f`, confirmed by isolated re-run — pre-existing worktree noise, not caused by this plan). No byte changes to `engine/`, `content/`, `test/parity/`, `mazeworld.html`, `gearTab.js`, `viewModels.js`, `narrationLines.js`, or any snapshot fixture (confirmed via `git diff --stat` against those paths — empty).

---
*Phase: 63-action-sheet-combat-lock-accessibility*
*Completed: 2026-09-23*

## Self-Check: PASSED

- FOUND: src/browser/gearSheet.js
- FOUND: test/unit/gear-sheet-model.test.js
- FOUND: .planning/phases/63-action-sheet-combat-lock-accessibility/63-01-SUMMARY.md
- FOUND commit: 71ec7d0 (feat(63-01): gearSheetModel + GEAR_SHEET_COPY for the action sheet)
- FOUND commit: 821cccf (test(63-01): scan GEAR_SHEET_COPY, pin module contract, full suite green)
