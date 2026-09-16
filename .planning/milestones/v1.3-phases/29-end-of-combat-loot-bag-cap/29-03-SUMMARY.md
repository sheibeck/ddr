---
phase: 29-end-of-combat-loot-bag-cap
plan: 03
subsystem: shell
tags: [loot, shell, bag-cap, hud, store, key-decision]

# Dependency graph
requires:
  - phase: 29-end-of-combat-loot-bag-cap
    plan: "01"
    provides: "lootCompare(c, it)/bagUsage(c) view-models (src/browser/viewModels.js)"
  - phase: 29-end-of-combat-loot-bag-cap
    plan: "02"
    provides: "state.pendingLoot, takeLoot/leaveLoot/takeAllLoot/leaveAllLoot actions, lootDropped/lootTaken/lootLeft/lootForfeited/bagUpgraded events + toasts/Oracle lines"
provides:
  - "window.__mzBagUsage / window.__mzLootCompare — read-only bridges onto Plan 01's view-models; the ONE capacity readout and the ONE compare-to-equipped verdict in the shell"
  - "window.__mzLootReport — presentation-only transient set by noteCombat, read by the loot card"
  - "window.mzTakeLoot(i, equip)/mzLeaveLoot(i)/mzTakeAllLoot()/mzLeaveAllLoot() — pending-pile action bridges routed through inventoryAction"
  - "hasActiveEncounter() parks the map while S.pendingLoot is non-empty"
  - "noteCombat() hands the end-of-fight report to the loot card instead of building 'Move on' beats when drops are pending"
  - "renderCarriedList opts.subFor + lootEquip/lootTake/lootLeave row actions (fourth host: the loot screen)"
  - "renderDropShelf(shelf, items) — the ONE drop-to-make-room shelf renderer (find card + loot screen)"
  - "The loot screen branch in renderEncounter (#loot-list, #loot-drop-shelf, #a-loot-take-all, #a-loot-leave-all)"
  - "bagUsage-driven readouts in paint()/the find card/the store; store offers Drop when full"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Report hand-off transient: noteCombat stashes the combat-report shape on window.__mzLootReport (never on state) when a pile is pending, so the loot card can fold the report and the decision into ONE card instead of a dismiss-then-continue chain"
    - "Shared drop-shelf extraction: the find card's inline drop-to-make-room loop became renderDropShelf(shelf, items), reused verbatim by the loot screen — same pattern as renderCarriedList's four-host reuse"

key-files:
  created:
    - test/unit/shell-loot-screen.test.js
  modified:
    - mazeworld.html
    - test/unit/shell-armor-display.test.js

key-decisions:
  - "The store's bag-full line and the sell-list's usage read window.__mzBagUsage(S.c), computed once before the store's main innerHTML template so its ternary sits inline above the sell-head paragraph, keeping every existing element id untouched"
  - "paint()'s carried-treasure readout now excludes potions from the count (bagUsage's slotItems-based have), matching the locked LOOT-04 decision — a behavior change from the prior raw c.items.length read, verified by the existing engine-side potion-exemption tests from Plan 01"
  - "shell-armor-display.test.js's §6 assertion on bagArmorText(bi) was re-pointed at the extracted renderDropShelf region instead of the pendingFind region, per the plan's explicit instruction — intent (every bag armor row shows durability) is unchanged"

patterns-established:
  - "See tech-stack.patterns above"

requirements-completed: [LOOT-02, LOOT-03, LOOT-04, LOOT-05, LOOT-06]

coverage:
  - id: D1
    description: "A non-empty pending pile at end of combat replaces the encounter-cleared report with ONE loot card (title/lines folded in from window.__mzLootReport), per-row Take/Stow + Leave, Take all/Leave all; the map stays parked (hasActiveEncounter); the card re-appears on resume"
    requirement: "LOOT-02"
    verification:
      - kind: unit
        ref: "test/unit/shell-loot-screen.test.js — bridge/guard/noteCombat/loot-branch/position source assertions"
        status: pass
    human_judgment: false
  - id: D2
    description: "Weapon/armor rows show lootCompare's line/sub compare readout and offer Equip now (only when equipNow) vs Stow; Equip now dispatches takeLoot {i, equip:true}, Stow/Take dispatches takeLoot {i}"
    requirement: "LOOT-03"
    verification:
      - kind: unit
        ref: "test/unit/shell-loot-screen.test.js — renderCarriedList subFor/lootEquip/lootTake/lootLeave assertions"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every capacity readout and full-bag gate in the shell (gear panel, find card, loot screen, store) reads window.__mzBagUsage — no raw array-length count survives; the shared drop-to-make-room shelf renders on the find card, the loot screen, and (as Drop buttons) the store's sell list"
    requirement: "LOOT-04"
    verification:
      - kind: unit
        ref: "test/unit/shell-loot-screen.test.js — the four negative greps + per-site window.__mzBagUsage assertions"
        status: pass
      - kind: integration
        ref: "grep -c \"window.__mzBagUsage(\" mazeworld.html == 4; grep -c \"items.length >= bagSlots\" / \"(c.items || []).length >= slots\" / the two raw-length templates == 0 each"
        status: pass
    human_judgment: false
  - id: D4
    description: "A kind:bag row reads its lootCompare tier line; no shell-specific bag-upgrade handling beyond the shared row/toast/Oracle wiring already landed in Plan 01"
    requirement: "LOOT-05"
    verification:
      - kind: unit
        ref: "src/browser/viewModels.js lootCompare's kind:\"bag\" branch (Plan 01) — rendered through the same renderCarriedList row this plan wires; no new shell code needed"
        status: pass
    human_judgment: false
  - id: D5
    description: "hasActiveEncounter() includes a non-empty S.pendingLoot, so window.move refuses input and the map stays parked; on resume from a save with a pile the loot branch is reachable with no combat and no beats"
    requirement: "LOOT-06"
    verification:
      - kind: unit
        ref: "test/unit/shell-loot-screen.test.js — hasActiveEncounter region assertion"
        status: pass
    human_judgment: false
  - id: D6
    description: "npm run build:www exits 0; full npm test green (1593/1593); parity untouched"
    verification:
      - kind: integration
        ref: "npm run build:www (exit 0, www/index.html written); npm test (1593/1593, 0 failures); git status --porcelain test/parity (clean)"
        status: pass
    human_judgment: false
  - id: D7
    description: "On-device verification of the loot screen end to end (deferred to end of Phase 29 run)"
    verification: []
    human_judgment: true
    rationale: "Requires a physical device session to confirm the folded report card, the compare readout, the full-bag shelf, and resume behaviour visually — see Human verification section below"

duration: ~50min
completed: 2026-09-16
status: complete
---

# Phase 29 Plan 03: Loot Screen, Bag-Cap Readouts & Store Drop Option Summary

**The classic shell's `renderEncounter` now folds the end-of-fight report and the pending-pile decision into ONE loot card — per-drop Take/Stow/Leave with the `lootCompare` readout, Take all/Leave all, the map parked via `hasActiveEncounter` — and every capacity readout in the shell (gear panel, find card, loot screen, store) reads the single `window.__mzBagUsage` view-model, with the store now offering Drop when full.**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-09-16
- **Tasks:** 3 (all `type="auto"`)
- **Files modified:** 3 (1 new test file, 2 modified)

## Accomplishments

- Bridged `lootCompare`/`bagUsage` (Plan 01's view-models) onto `window.__mzLootCompare`/`window.__mzBagUsage` — read-only, no rng, safe every `paint()` — and the four pending-pile action bridges (`window.mzTakeLoot`/`mzLeaveLoot`/`mzTakeAllLoot`/`mzLeaveAllLoot`) routed through the existing `inventoryAction()` seam.
- `hasActiveEncounter()` now parks the map while `S.pendingLoot` is non-empty, exactly like `pendingFind` — `window.move` refuses input and the overlay stays up until the pile is resolved.
- `noteCombat()` hands the end-of-fight report to `window.__mzLootReport` instead of building a "Move on" beat whenever drops are pending (RESEARCH Pitfall 4) — the player sees ONE card with the report AND the decision, never a dismiss-then-continue chain. A fresh combat start clears any stale report.
- `renderCarriedList` gained `opts.subFor` (a per-row sub-line override) and three new row actions (`lootEquip`/`lootTake`/`lootLeave`) — a fourth host alongside the GEAR tab, the store sell list, and the combat use list.
- Extracted the find card's inline drop-to-make-room loop into a shared `renderDropShelf(shelf, items)` function, reused by both the find card and the new loot screen.
- The new loot screen branch in `renderEncounter` sits after the beats/won branches and before the joiner branch: the folded report, one row per pile entry (Equip now when `lootCompare(c, it).equipNow`, Stow/Take otherwise, Leave), the shared drop shelf when the bag is full and a non-potion/non-bag item is pending, and Take all/Leave all.
- Every capacity readout in the shell (the gear panel's `#s-carry-n` + `bagFull` gate, the find card's readout + full-bag chooser, the loot screen, and the store) now reads `window.__mzBagUsage(c)` — no raw `c.items.length` comparison against a bag/slot count survives anywhere in `mazeworld.html` (four negative greps pin this). The store's "Your gear" sell list gains Drop buttons and a rust "Bag full" line when full.
- `test/unit/shell-loot-screen.test.js` (new, 14 tests): source-assertion pins for the bridges, the movement guard, the report hand-off, the shared list/shelf renderer changes, the loot card's markup/wiring and its position relative to won/beats/joiner, and the LOOT-04 negative-grep gates.
- `test/unit/shell-armor-display.test.js` (updated): the import-line assertion now expects `lootCompare, bagUsage`; the §6 `bagArmorText(bi)` assertion follows the shelf into the extracted `renderDropShelf` region (intent unchanged — every bag armor row still shows durability).
- Full suite green at 1593/1593 (1578 baseline + 15 new tests); `npm run build:www` exits 0; `git status --porcelain test/parity` clean (parity master untouched — no engine files were touched by this plan).

## Task Commits

Each task was committed atomically:

1. **Task 1: Bridges, helpers, movement guard, and the report hand-off** - `b1494d5` (feat)
2. **Task 2: The loot screen card** - `46a7a7a` (feat)
3. **Task 3: Route every readout through bagUsage, store drop option, Phase 28 test adjust, build + full-suite gate** - `e2a0ac2` (feat)

_All three tasks are `type="auto"` (not tdd) per the plan._

## Files Created/Modified

- `mazeworld.html` - module bridges (`window.__mzBagUsage`, `window.__mzLootCompare`), the four `window.mzTakeLoot`/`mzLeaveLoot`/`mzTakeAllLoot`/`mzLeaveAllLoot` action bridges, `hasActiveEncounter()`'s pending-pile guard, `noteCombat()`'s report hand-off, `renderCarriedList`'s `opts.subFor`/loot actions, the extracted `renderDropShelf(shelf, items)`, the new loot screen branch in `renderEncounter`, and `bagUsage`-driven readouts in `paint()`/the find card/the store (with the store's Drop-when-full option)
- `test/unit/shell-loot-screen.test.js` (new) - 14 source-assertion tests pinning every artifact above, including the four LOOT-04 negative greps
- `test/unit/shell-armor-display.test.js` - import-line assertion updated for the new `lootCompare, bagUsage` viewModels import; §6's `bagArmorText(bi)` assertion re-pointed at the extracted `renderDropShelf` region

## Decisions Made

- See `key-decisions` in frontmatter.
- The store's bag-full ternary line is built directly into the store's existing single `innerHTML +=` template (rather than a separate DOM append), computed from a `usage` const read before that template is built, so every pre-existing store element id (`shelf`, `sell-head`, `sell-list`, `a-leave`) stays untouched.

## Deviations from Plan

None — plan executed exactly as written. All three tasks' actions, read_first pointers, and acceptance criteria matched the live code at execution time (line numbers had drifted slightly from Phase 28's additions but every named function/branch/marker text was found and edited as specified).

## Issues Encountered

- One test-authoring bug caught and fixed before committing: `storeRegion()` in `test/unit/shell-loot-screen.test.js` first used an unscoped `CODE.indexOf("const C = S.combat;")` for its end marker, which matched an earlier unrelated occurrence of that same literal elsewhere in the file (it appears ~10 times). Fixed by scoping the search to start after the store guard's own index (`CODE.indexOf("const C = S.combat;", start)`), mirroring how the plan's own store region always pairs a unique start marker with a start-scoped end search.

## User Setup Required

None - no external service configuration required.

## Human verification (deferred to end of run)

Deferred to the end of the autonomous run (per the plan's `<human_verification>` block, copied verbatim):

1. Pixel 7: win a fight in which a foe drops something — ONE card appears titled "Victory" with the round/HP/gold lines and the drop listed below with Take/Leave (weapon/armor: Equip now when it is an upgrade, Stow otherwise); no "Move on" card precedes it; the D-pad does nothing while it is up.
2. Tap Equip now on an upgrade weapon: the toast says "Equipped: … (weapon)", the GEAR tab shows it worn and the old weapon in the bag.
3. Fill the bag (4 gear in a small bag), win a fight with a gear drop: the card shows "Bag full (4/4). Drop something to make room, or leave it." with the drop shelf; Take shows the "Bag full (4/4) — drop something to make room." toast and the row stays; Drop a bag item then Take works.
4. With a pile showing, background the app, kill it, relaunch: the same loot card is back with the same rows in the same order.
5. Start a fight at floor 2+ carrying the small bag and win several fights: eventually a "Medium bag" row appears; Take it — toast "Bigger bag: 6 slots.", GEAR readout shows "x / 6".
6. Store with a full bag: the "Your gear" list shows Drop buttons and the rust "Bag full (4/4) — sell or drop something to make room." line.

## Next Phase Readiness

- Phase 29 (End-of-Combat Loot & Bag Cap) is complete across all three plans (bag-cap gate/content tiers/compare-to-equipped, pending loot pile/forfeit rule, loot screen shell wiring). No blockers for the next phase.
- Full `npm test`: **1593/1593 passing, 0 failures**. `npm run build:www` exits 0. Parity: `git status --porcelain test/parity` empty — no engine files touched by this plan.
- The three plans' deferred human-verification blocks (Plan 01, Plan 02, Plan 03 — all copied above/in their own SUMMARYs) are ready for a single combined Pixel 7 session at the end of the Phase 29 run.

---
*Phase: 29-end-of-combat-loot-bag-cap*
*Completed: 2026-09-16*

## Self-Check: PASSED

All 3 modified/created source files and the SUMMARY.md itself exist on disk; all 3 task commit hashes (b1494d5, 46a7a7a, e2a0ac2) found in git history.
