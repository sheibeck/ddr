---
phase: 63-action-sheet-combat-lock-accessibility
plan: 03
subsystem: ui
tags: [gear, action-sheet, rail-narration, engine-agreement, combat-lock, mazeworld]

# Dependency graph
requires:
  - phase: 63-action-sheet-combat-lock-accessibility
    provides: "gearSheetModel(state, target) + GEAR_SHEET_COPY (src/browser/gearSheet.js, Plan 01) — the model this sweep dispatches every action's `run` from, unchanged"
  - phase: 61-gear-rules-store-purchase-fix
    provides: "gearLockReason (engine/items.js), LINE_FOR.gearRefused (narrationLines.js), lootCompare (viewModels.js) — the combat lock and legality reasons the sweep proves the sheet never disagrees with"
provides:
  - "LINE_FOR.itemDropped / LINE_FOR.itemUnequipped (both out of ORACLE_ONLY) — DROP/UNEQUIP/DISCARD outcomes now reach the rail in voice through the existing narration fold"
  - "test/unit/gear-sheet-agreement.test.js — the sheet-vs-engine refusal agreement sweep, the rail-line coverage suite, and the GRULE-02 after-the-fight proof"
affects: [63-04-shell-lifecycle, 63-05-row-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "State-sweep proof pattern: build states from engine calls + explicit field overrides only, then dispatch every gearSheetModel action's own `run` through the real applyAction, classifying each greyed reason against its engine-derived source rather than asserting a hand-picked expected string"

key-files:
  created:
    - test/unit/gear-sheet-agreement.test.js
  modified:
    - src/browser/narrationLines.js
    - test/voice/safety-scan.test.js

key-decisions:
  - "itemDropped/itemUnequipped's LINE_FOR wording ('Dropped: {n}. Gone for good.' / 'Unequipped: {n} ({slot}). Into the bag it goes.' / destroyed: '{n} comes off in pieces. Nothing worth bagging.') is item-name-first, one line, matching itemEquipped's existing shape — Claude's discretion within the plan's stated constraints (house voice, family-friendly, HP never WP)"
  - "No existing test asserted the rail stays empty on drop/unequip (checked armor-durability/armorDisplay/combat-gear-lock/inventory-actions/shell-gear-toolbar/shell-loot-screen/worn-slots.test.js — all assert on raw engine events, never on ORACLE_ONLY/LINE_FOR membership), so no test needed re-pointing"

requirements-completed: [GSCR-09, GRULE-02]

coverage:
  - id: D1
    description: "itemDropped and itemUnequipped are LINE_FOR keys (not ORACLE_ONLY); DROP/UNEQUIP/DISCARD each fold into exactly one rail/fight-log line naming the item, the destroyed branch reads its own distinct line, and railCardFor is non-null for all three event shapes"
    requirement: "GSCR-09"
    verification:
      - kind: unit
        ref: "test/unit/gear-sheet-agreement.test.js — 'rail lines: ...' (6 tests) / test/unit/narrationLinesCoverage.test.js (unchanged, still green)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Across an 8-state sweep (out-of-combat BASE, the pending Fight! preview, a LIVE fight, the full-bag thief, the empty-bag mu, a Spiked Staff Magic User, an illegal-gear Magic User, destroyed armor on a full bag), every gearSheetModel action's `run` dispatches through the real applyAction; every greyed reason is byte-equal to the engine's own refusal (combat/bagFull/illegal) for that same forced dispatch, contains no markup, and the gear snapshot is provably untouched"
    requirement: "GSCR-09"
    verification:
      - kind: unit
        ref: "test/unit/gear-sheet-agreement.test.js — 'sweep, greyed by combat/a full bag/illegality' + 'Edge GSCR-09/encoding' (117 dispatches; 28 combat-greyed, 7 bag-full-greyed, 4 illegality-greyed)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every enabled sheet action's dispatch is never refused (no gearRefused/equipRejected/bagFull), always produces a rail line (out of combat) or fight-log line (mid-fight), and the observed event type matches the action shape (EQUIP/SWAP -> itemEquipped, UNEQUIP/DISCARD -> itemUnequipped, DROP -> itemDropped)"
    requirement: "GSCR-09"
    verification:
      - kind: unit
        ref: "test/unit/gear-sheet-agreement.test.js — 'sweep, enabled: ...' (2 tests, 78 enabled dispatches)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every action greyed ONLY by the combat lock in the pending/live states is enabled again on the identical inventory once combat is cleared, and dispatching it there succeeds (itemEquipped or itemUnequipped); USE and DROP stay enabled across BASE/PENDING/LIVE throughout"
    requirement: "GRULE-02"
    verification:
      - kind: unit
        ref: "test/unit/gear-sheet-agreement.test.js — 'GRULE-02: ...' (2 tests, 28 combat-cleared actions re-checked)"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-09-23
status: complete
---

# Phase 63 Plan 03: Drop/Unequip Rail Lines + Sheet-vs-Engine Agreement Sweep Summary

**itemDropped/itemUnequipped moved from ORACLE_ONLY to LINE_FOR so DROP/UNEQUIP/DISCARD reach the rail in voice, plus a 117-dispatch sweep proving `gearSheetModel`'s every greyed reason and every enabled outcome agrees exactly with the real engine, GRULE-02's after-the-fight release included.**

## Performance

- **Duration:** 45 min
- **Started:** 2026-09-23T14:55:00Z (approx, from worktree base commit)
- **Completed:** 2026-09-23T15:11:43Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- `src/browser/narrationLines.js` — `itemDropped`/`itemUnequipped` removed from `ORACLE_ONLY`, added to `LINE_FOR` with item-name-first, one-line, family-friendly wording (the destroyed-armor DISCARD case reads its own distinct line). No shell change — the existing out-of-combat rail fold and mid-fight fight-log fold both pick these up automatically.
- `test/voice/safety-scan.test.js` — added `{ destroyed: true }` to `BRANCH_TOGGLES` so the scan renders both sides of `itemUnequipped`'s destroyed ternary.
- `test/unit/gear-sheet-agreement.test.js` (new, 19 tests, 521 lines) — rail-line coverage for Task 1's `<behavior>` bullets, then an 8-state sweep (`BASE`, `PENDING`, `LIVE`, `THIEF`, `MU`, `SPIKED`, `ILLEGAL`, `SCRAP`) built only from engine calls + explicit field overrides, dispatching every `gearSheetModel` action's exact `run` through the real `applyAction` exactly once.
- The sweep's counters: 117 total dispatches, 28 greyed by combat, 7 greyed by a full bag, 4 greyed by illegality, 78 enabled — all well past the plan's load-bearing floor (>=40/>=10/>=1/>=2).
- GRULE-02 proven directly: every action greyed only by the combat lock in `PENDING`/`LIVE` (28 actions) is re-checked on the identical inventory with combat cleared (`BASE`, or `endCombat` on a clone of `LIVE`) — every one re-enables and its dispatch succeeds.

## Task Commits

Each task was committed atomically:

1. **Task 1: itemDropped and itemUnequipped reach the rail (LINE_FOR lines, out of ORACLE_ONLY)** - `fffe2e5` (feat) — `src/browser/narrationLines.js` + `test/voice/safety-scan.test.js` + the rail-line section of `test/unit/gear-sheet-agreement.test.js` (6 tests)
2. **Task 2: The sheet-vs-engine agreement sweep and GRULE-02's after-the-fight proof** - `6c16aef` (test) — extended `test/unit/gear-sheet-agreement.test.js` with the fixture builders, the sweep, and the GRULE-02 proof (19 tests total), ran `npm install --prefer-offline` (fresh worktree, no `node_modules/`; `package.json`/`package-lock.json` confirmed unchanged), then `npm run build:www && npm test`

## Files Created/Modified

- `src/browser/narrationLines.js` — `ORACLE_ONLY` loses `itemDropped`/`itemUnequipped` (with a Phase-63 comment explaining why); `LINE_FOR` gains both builders next to `itemEquipped`
- `test/voice/safety-scan.test.js` — `BRANCH_TOGGLES` gains `{ destroyed: true }`
- `test/unit/gear-sheet-agreement.test.js` — new: 6 rail-line tests, 2 fixture-precondition tests, 9 sweep tests (target resolution, classification, combat/bagFull/illegal correctness, enabled-line coverage, enabled-event-shape coverage, load-bearing counters, GSCR-09/encoding), 2 GRULE-02 tests

## Decisions Made

- The new `LINE_FOR` lines' exact wording was left to Claude's discretion within the plan's constraints (house voice, deadpan, family-friendly, HP never WP, `?.`/`??` on every payload read, one line, item-name-first): `itemDropped` reads "Dropped: {n}. Gone for good."; `itemUnequipped` reads "Unequipped: {n} ({slotWord}). Into the bag it goes." (destroyed: "{n} comes off in pieces. Nothing worth bagging.").
- No existing test needed re-pointing. Every test file matching `itemDropped`/`itemUnequipped`/`mzDropItem`/`mzUnequip` (`armor-durability`, `armorDisplay`, `combat-gear-lock`, `inventory-actions`, `shell-gear-toolbar`, `shell-loot-screen`, `worn-slots`) asserts on the raw engine event shape or the Oracle's own `EVENT_NARRATION` text, never on `ORACLE_ONLY`/`LINE_FOR` membership or rail emptiness — so moving these two event types produced zero collateral breakage, verified by running all seven files green both before and after the change.
- The sweep classifies each greyed action's `reason` by comparing it against the engine's own derived text (`LINE_FOR.gearRefused(...).text` for combat, `GEAR_SHEET_COPY.sub.bagFull` for a full bag, `lootCompare(c, it).line` for illegality) rather than asserting a hand-picked expected string — an unclassifiable greyed reason on an action with a `run` fails its own dedicated test (`sweep: every greyed action's reason is unambiguously ...`) naming the action key and reason, per the plan's Task 2 action item 3.
- No Rule 1 model/engine disagreement surfaced — the sweep passed on first full run with zero unclassified reasons, so `src/browser/gearSheet.js` needed no change.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' `<action>`/`<behavior>` items are implemented and proven by a corresponding passing test; the plan's Task 2 item 6 (fix Plan 01's model on a real disagreement) was not triggered — none was found.

## Issues Encountered

- Fresh worktree checkout had no `node_modules/`; `npm run build:www` initially failed with "@capacitor/core is not installed" (same as Plans 01/02's worktree). Ran `npm install --prefer-offline` per the plan's project rules (confirmed `package.json`/`package-lock.json` unchanged via `git status --short` before and after), then the build and full suite ran clean.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `LINE_FOR.itemDropped`/`LINE_FOR.itemUnequipped` are live — Plan 04 (shell lifecycle) and Plan 05 (row integration) can rely on DROP/UNEQUIP/DISCARD already reaching the rail through the existing fold with no further wiring.
- `test/unit/gear-sheet-agreement.test.js` is a standing proof that `gearSheetModel`'s greyed reasons and enabled outcomes agree with the real engine — any future change to `gearSheetModel`, `gearLockReason`, `weaponRefusalReason`/`armorRefusalReason`, or `lootCompare` that breaks agreement will fail this sweep first.
- No blockers. `npm run build:www` exits 0. `npm test`: 4173 tests, 4166 pass, 7 known CRLF-checkout false-fails in `test/unit/class-pass-ledger.test.js`/`test/unit/flee-ledger.test.js` (both files confirmed byte-identical to the worktree's base commit `08e3073` via `git diff --stat` — pre-existing worktree noise, not caused by this plan). `git diff --stat -- engine/ content/ test/parity/ mazeworld.html test/unit/fixtures/ src/browser/eventNarration.js` is empty; `git hash-object test/parity/prototype-master.js.txt` still prints `a1f4d0dc29782218d8e5aab65bc5989c33f917f0`.

---
*Phase: 63-action-sheet-combat-lock-accessibility*
*Completed: 2026-09-23*

## Self-Check: PASSED

- FOUND: src/browser/gearSheet.js
- FOUND: test/unit/gear-sheet-agreement.test.js
- FOUND: .planning/phases/63-action-sheet-combat-lock-accessibility/63-03-SUMMARY.md
- FOUND commit: fffe2e5 (feat(63-03): itemDropped/itemUnequipped reach the rail in voice)
- FOUND commit: 6c16aef (test(63-03): sheet-vs-engine agreement sweep + GRULE-02 after-the-fight proof)
