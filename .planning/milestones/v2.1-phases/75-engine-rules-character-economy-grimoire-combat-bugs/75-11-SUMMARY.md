---
phase: 75-engine-rules-character-economy-grimoire-combat-bugs
plan: 11
subsystem: ui
tags: [gear, combat-ui, staff, weapon, view-models]

requires:
  - phase: 75-engine-rules-character-economy-grimoire-combat-bugs
    provides: "75-07 (the staff wield model — weaponRow/wieldedStaff, c.staff, useItem({slot:'weapon'})), 75-09 (a bagged staff is inert — useRefused {reason:'notWielded'}), 75-03 (combatMenu.js's SPELLS castable filter, read for context on the ITEMS submenu shape)"
provides:
  - "RULES-13 (surface half): the Gear tab WEAPON row/BAG card, the gear sheet, the hero sheet's damage line and combat ITEMS all show and act on a wielded or bagged magic staff, reading the engine's own wieldedStaff(c)/weaponRow(name) directly — never a restated legality check"
  - "A bagged staff never offers USE anywhere (Gear tab card, its sheet, combat ITEMS), and EQUIP/SWAP to the weapon slot is Magic User only, on every surface including the older shared renderCarriedList path"
  - "docs/GEAR-SLOTS.md §9 records the RULES-13 rule end to end and marks the 2026-09-18 staff amendment (§2/§4) as reversed, kept as history"
affects: [77]

tech-stack:
  added: []
  patterns:
    - "wieldedStaff(c)/weaponRow(name) are the two engine reads every surface consults directly — the Gear tab, gear sheet, hero sheet and combat ITEMS never restate the Magic-User gate or the d8 stat row; they only turn the engine's own answer into a card/row/action."
    - "A staff's family in gearBagCardsModel is class-conditional (\"weapon\" for a Magic User, null otherwise) but its USE cell is class-independent — `it.kind === \"staff\"` always forces `use: null`, so a bagged staff never offers USE for ANY class, distinct from the family-based USE gating every other item kind uses."
    - "The combat ITEMS \"NOTHING TO USE\" collapse and its \"N USABLE\" badge count are two DIFFERENT predicates now (presence vs. enabled) — mirroring the potion row's pre-existing presence-based collapse so a disabled-but-informative row (a bagged staff, or a full-HP potion) never vanishes behind a placeholder, while the badge still counts only what a tap would actually do something with."

key-files:
  created:
    - test/unit/staff-surfaces.test.js
  modified:
    - src/browser/viewModels.js
    - src/browser/gearTab.js
    - src/browser/gearSheet.js
    - src/browser/heroTab.js
    - src/browser/combatMenu.js
    - docs/GEAR-SLOTS.md
    - test/unit/gear-sheet-model.test.js
    - test/unit/gear-tab-dom.test.js
    - test/unit/gear-view-models.test.js
    - test/unit/item-stat-lines.test.js
    - test/unit/gear-sheet-dom.test.js
    - test/unit/combatMenu.test.js
    - test/unit/shell-fight-gate.test.js
    - test/unit/shell-gear-toolbar.test.js
    - test/unit/shell-worn-slots.test.js

key-decisions:
  - "gearSheet.js needed NO functional change — gearWornModel's weapon row already reports a wielded staff as filled with its own use cell, and gearBagCardsModel already gives a Magic User's bagged staff family:\"weapon\"; both flow through the sheet's existing WORN \"SWAP FOR\" and BAG \"EQUIP TO / SWAP INTO WEAPON\" branches untouched (equipRun already omits `slot` for the weapon family). Only a documentation comment was added explaining why."
  - "usableBy(it, c) already had the full Magic-User staff gate and 'not you' text from Phase 43 (CLAR-02), predating this plan — the 'a Fighter's card text says a Magic User can wield it' requirement needed zero new code."
  - "The combat ITEMS collapse-to-placeholder check was split from the badge count: `anyItemsPresent` (presence-based, unchanged from before this plan) decides whether the row list collapses to NOTHING TO USE; `usableCount` (now enabled-based for carried/worn/staff rows) decides only the displayed number. Without this split, a Magic User whose ONLY item is a bagged staff would see the row vanish behind a placeholder instead of the explanatory NOT WIELDED line — the plan's own literal 'count by enabled' instruction, applied naively to both checks, would have hidden the exact information RULES-13 asks the row to show."

requirements-completed: [RULES-13]

coverage:
  - id: D1
    description: "Gear tab WEAPON row and BAG card show and act on a wielded or bagged staff (filled/d8/USE cell/UNEQUIP when wielded; WEAPON-family EQUIP/SWAP for a Magic User's bagged staff, no family/no USE for anyone else)"
    requirement: RULES-13
    verification:
      - kind: unit
        ref: "test/unit/staff-surfaces.test.js (Gear tab WEAPON row / BAG card sections, 7 tests)"
        status: pass
      - kind: unit
        ref: "test/unit/gear-tab-dom.test.js, test/unit/gear-view-models.test.js, test/unit/gear-panels.test.js (re-pinned + new RULES-13 cases)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Gear sheet: the WORN weapon sheet for a wielded staff offers USE/UNEQUIP/SWAP FOR each bag weapon or staff; a bag staff's sheet offers EQUIP TO/SWAP INTO WEAPON (Magic User) and DROP, never USE"
    requirement: RULES-13
    verification:
      - kind: unit
        ref: "test/unit/staff-surfaces.test.js (Gear sheet section, 3 tests)"
        status: pass
      - kind: unit
        ref: "test/unit/gear-sheet-model.test.js, test/unit/gear-sheet-dom.test.js (re-pinned)"
        status: pass
    human_judgment: false
  - id: D3
    description: "itemStatLines leads a staff's stats with the wield line, then effect, then charges (bag and wielded formatted identically via wornItemFor); lootCompare's staff branch is the Magic User gate only, never a need/crit comparison, and never throws"
    requirement: RULES-13
    verification:
      - kind: unit
        ref: "test/unit/staff-surfaces.test.js (itemStatLines/wornItemFor/lootCompare section, 3 tests); test/unit/item-stat-lines.test.js (re-pinned)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The hero sheet's weapon damage line reads a wielded staff's true d8 range through weaponRow(c.weapon), never falling back to the Club"
    requirement: RULES-13
    verification:
      - kind: unit
        ref: "test/unit/staff-surfaces.test.js#Hero sheet: the weapon damage row reads the wielded staff's d8 through weaponRow"
        status: pass
    human_judgment: false
  - id: D5
    description: "Combat ITEMS: a bagged staff's row is disabled (NOT WIELDED) and not counted; a wielded staff gets its own EQUIPPED row, dispatches by slot, and is counted; a fight with no staff is unaffected"
    requirement: RULES-13
    verification:
      - kind: unit
        ref: "test/unit/staff-surfaces.test.js (Combat ITEMS section, 2 tests); test/unit/combatMenu.test.js (re-pinned + 4 new tests)"
        status: pass
      - kind: integration
        ref: "npm test 6177/6177; node --test \"test/parity/**/*.test.js\" 54/54"
        status: pass
    human_judgment: false
  - id: D6
    description: "docs/GEAR-SLOTS.md states the RULES-13 rule and marks the 2026-09-18 staff amendment as reversed; presentation only, no engine/content/parity fixture moved"
    requirement: RULES-13
    verification:
      - kind: other
        ref: "grep -c RULES-13 docs/GEAR-SLOTS.md (2); git diff --stat <plan-base> -- engine content test/parity mazeworld.html (empty)"
        status: pass
    human_judgment: false

duration: 65min
completed: 2026-09-25
status: complete
---

# Phase 75 Plan 11: The Gear tab, gear sheet, hero sheet and combat ITEMS show and act on a wielded or bagged staff Summary

**Every gear surface reads the engine's own wieldedStaff(c)/weaponRow(name) directly — a wielded magic staff fills the WEAPON row with a real USE cell and its true d8 damage on the hero sheet, a bagged one is a WEAPON-family EQUIP/SWAP card (Magic User only) that never offers USE, and combat ITEMS marks it NOT WIELDED (disabled, uncounted) or EQUIPPED (enabled, counted) accordingly**

## Performance

- **Duration:** ~65 min
- **Started:** 2026-09-25 (approx.)
- **Completed:** 2026-09-25 (approx.)
- **Tasks:** 2
- **Files modified:** 15 (1 created, 14 modified)

## Accomplishments

- **Task 1 — Gear tab, gear sheet, item stat lines and hero sheet:** `viewModels.js` gained a wield-line stat template (`ITEM_STAT_COPY.text.wield`), a `lootCompare` branch for a staff (Magic User gate only, no need/crit comparison), and `wornItemFor(c, "weapon")` now returns the real wielded staff object when one is held. `gearTab.js`'s `emptySlotRows`/`gearWornModel` weapon branch treat a wielded staff as filled (its name, `weaponRow`'s "d8" value, its own USE cell dispatching `{slot:"weapon"}`, and UNEQUIP); `gearBagCardsModel` gives a Magic User's bagged staff `family: "weapon"` (EQUIP TO / SWAP INTO, tagged SWAP once a weapon or another staff is held) while a non-Magic-User's bagged staff gets no family at all — and NEITHER ever gets a USE cell, since `it.kind === "staff"` forces `use: null` unconditionally. Swap detection reads `weaponRow(c.weapon)` instead of a raw `WEAPONS` lookup, so a wielded staff correctly marks a bagged ordinary weapon `· SWAP` too. The older shared `renderCarriedList` action path got the identical rules (no USE for a staff; EQUIP only for a Magic User, no swap confirm — matching how an ordinary weapon already equips there). `gearSheet.js` needed no functional change at all — its existing WORN/BAG branches already read the updated models. `heroTab.js`'s two weapon-damage reads now go through `weaponRow(c.weapon)`, falling back to the Club only for Fists or an unrecognized name.
- **Task 2 — Combat ITEMS and docs:** `combatMenu.js` gained `notWielded`/`notWieldedDesc`/`equipped` copy; a bagged staff's ITEMS row is disabled with `NOT WIELDED` and a dry desc (dispatch untouched — the engine's own refusal explains a tap); a wielded staff gets its own `worn-weapon` row beside the worn rows (`EQUIPPED · ` + `itemRowState`'s own text), enabled, dispatching `{type:"useItem", slot:"weapon"}`. The usable-count badge now counts carried/worn/staff rows by `enabled` (a no-op for everything but a bagged staff), while the "NOTHING TO USE" collapse stays presence-based (see Decisions) so a lone disabled staff still explains itself. `docs/GEAR-SLOTS.md` gained a new §9 spelling out the full rule and marked the 2026-09-18 staff amendment sections as reversed history.
- Presentation only throughout: `git diff --stat <plan-base> -- engine content test/parity mazeworld.html` is empty. Full suite green: `npm test` 6177/6177; `node --test "test/parity/**/*.test.js"` 54/54, zero fixtures moved.

## Task Commits

Each task was committed atomically:

1. **Task 1: The Gear tab, the gear sheet, the stat lines and the hero sheet** — `ffd2df2` (feat)
2. **Task 2: Combat ITEMS for staves, and the docs** — `c22a073` (feat)

**Plan metadata:** this SUMMARY.md's own commit (pending, by the orchestrator's convention)

## Files Created/Modified

- `src/browser/viewModels.js` — the wield-line stat template, `itemStatLines`'s staff branch, `lootCompare`'s staff branch, `wornItemFor`'s weapon-slot staff read
- `src/browser/gearTab.js` — `emptySlotRows`/`gearWornModel`/`gearBagCardsModel`'s staff handling; the older inline card action path's staff branch
- `src/browser/gearSheet.js` — a documentation comment only (no functional change needed)
- `src/browser/heroTab.js` — both weapon-damage reads through `weaponRow`
- `src/browser/combatMenu.js` — the `notWielded`/`equipped` ITEMS row logic and the enabled-based count / presence-based collapse split
- `docs/GEAR-SLOTS.md` — new §9 (RULES-13), the 260918-w4n amendment marked reversed
- `test/unit/staff-surfaces.test.js` — new, 22 tests covering every behavior across both tasks
- `test/unit/gear-sheet-model.test.js`, `gear-tab-dom.test.js`, `gear-view-models.test.js`, `item-stat-lines.test.js`, `gear-sheet-dom.test.js`, `combatMenu.test.js` — re-pinned for the RULES-13 reversal, each with a comment
- `test/unit/shell-fight-gate.test.js`, `shell-gear-toolbar.test.js`, `shell-worn-slots.test.js` — re-pinned source-text regexes that matched the now-changed `gearTab.js`/`heroTab.js` import lines and the Use-button gate expression

## Decisions Made

- **`gearSheet.js` required zero functional edits.** Its WORN-slot "SWAP FOR" loop already filters bag cards by `family === "weapon"`, and its BAG-target "EQUIP TO / SWAP INTO {slot}" loop already reads `rowByKey["weapon"].filled`/`.name` generically — once `gearTab.js`'s models correctly reported a wielded/bagged staff, the sheet's existing code produced the exact required UX with no changes. Verified by the full `staff-surfaces.test.js` sheet section and the re-pinned `gear-sheet-model.test.js`/`gear-sheet-dom.test.js` cases.
- **The combat ITEMS "NOTHING TO USE" collapse had to be decoupled from the "N USABLE" count.** A blind reading of "count usable rows by enabled" for the collapse check too would hide a lone bagged staff's explanatory row behind a placeholder — the opposite of what RULES-13 asks the row to do. `anyItemsPresent` (presence-based, byte-identical to the pre-plan formula) now gates the collapse; `usableCount` (enabled-based for carried/worn/staff) gates only the badge number.
- **`usableBy(it, c)` already had the full Magic-User gate and "not you" text** (Phase 43, CLAR-02) — no new code was needed for the "a Fighter's card text says a Magic User can wield it" requirement.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Three shell source-text pin tests broke on the deliberately-changed import lines and Use-button gate**
- **Found during:** Task 1, running the full `npm test` before finalizing
- **Issue:** `test/unit/shell-fight-gate.test.js` and `test/unit/shell-gear-toolbar.test.js` each pinned an exact regex for `gearTab.js`'s `st.kind !== "none") li.appendChild(mkBtn("Use"` expression, and `test/unit/shell-worn-slots.test.js` pinned exact import lines for both `heroTab.js`'s and `gearTab.js`'s `engine/derived.js` imports — all three broke the instant `weaponRow`/`wieldedStaff` joined those import lines and the Use-button gate grew its `it.kind !== "staff"` clause, exactly as the plan's own action items required.
- **Fix:** Updated each regex to match the new, deliberately-changed source text, with a RULES-13 comment on every change.
- **Files modified:** `test/unit/shell-fight-gate.test.js`, `test/unit/shell-gear-toolbar.test.js`, `test/unit/shell-worn-slots.test.js`
- **Verification:** `node --test test/unit/shell-fight-gate.test.js test/unit/shell-gear-toolbar.test.js test/unit/shell-worn-slots.test.js` — pass; full `npm test` — 6177/6177
- **Committed in:** `ffd2df2` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — re-pinning source-text tests for the plan's own intended import/expression changes, not scope creep)
**Impact on plan:** No functional change beyond what the plan specified; the fix is pure test-shape correction, caught by running the full suite (not just the plan's own declared test files) before finalizing.

## Issues Encountered

None beyond the deviation above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- RULES-13 is now fully landed end to end: the engine (75-07, 75-09) and every player-facing surface (this plan) agree — a bagged staff is inert and says so everywhere, a wielded one is a real d8 weapon everywhere.
- Handoff for Phase 77 (CMBUI-14): the `notWielded`/`notWieldedDesc`/`equipped` copy keys in `combatMenu.js` and the enabled-based counting rule are explicitly reusable for jewelry and cloaks; CMBUI-14 should extend the same pattern rather than inventing new copy.
- No `test/parity` fixture moved; `engine/`, `content/`, `test/parity/` and `mazeworld.html` are byte-identical to the plan base (verified by `git diff --stat`).

---
*Phase: 75-engine-rules-character-economy-grimoire-combat-bugs*
*Completed: 2026-09-25*

## Self-Check: PASSED

- FOUND: src/browser/viewModels.js
- FOUND: src/browser/gearTab.js
- FOUND: src/browser/gearSheet.js
- FOUND: src/browser/heroTab.js
- FOUND: src/browser/combatMenu.js
- FOUND: docs/GEAR-SLOTS.md
- FOUND: test/unit/staff-surfaces.test.js
- FOUND: test/unit/gear-sheet-model.test.js
- FOUND: test/unit/gear-tab-dom.test.js
- FOUND: test/unit/gear-view-models.test.js
- FOUND: test/unit/item-stat-lines.test.js
- FOUND: test/unit/gear-sheet-dom.test.js
- FOUND: test/unit/combatMenu.test.js
- FOUND: test/unit/shell-fight-gate.test.js
- FOUND: test/unit/shell-gear-toolbar.test.js
- FOUND: test/unit/shell-worn-slots.test.js
- FOUND commit: ffd2df2 (feat: Task 1 — Gear tab, gear sheet, stat lines, hero sheet)
- FOUND commit: c22a073 (feat: Task 2 — combat ITEMS and docs)
