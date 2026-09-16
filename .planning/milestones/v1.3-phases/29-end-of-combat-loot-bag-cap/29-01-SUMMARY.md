---
phase: 29-end-of-combat-loot-bag-cap
plan: 01
subsystem: engine-inventory
tags: [bag-cap, loot, inventory, view-models, toasts]

# Dependency graph
requires:
  - phase: 28-armor-integrity-durability
    provides: "wornArmorItem left/patches, armorDisplay/bagArmorText single-source formatter"
provides:
  - "slotItems(c) — the one bag-slot capacity count, potions exempt"
  - "canStow(c)/stowItem(state, it, events, quiet) — the one bag-cap gate every stow path routes through"
  - "weaponUpgradeDelta(c, it)/armorUpgradeDelta(c, it) — takeItem's own upgrade arithmetic, extracted for reuse"
  - "bagUpgradeTier(state)/bagItemFor(tier) — LOOT-05 bigger-bag availability read + content lookup"
  - "content/bags.js BAG_ORDER/BAG_FLOORS/BAG_DROP_UNDER/BAG_ITEMS — bigger-bag treasure tiers"
  - "lootCompare(c, it)/bagUsage(c) view-models (src/browser/viewModels.js)"
  - "bagFull have/slots presentation; bagUpgraded toast + Oracle entry"
  - "store buyFrom pre-pay stow gate (STOWING_EFFECTS) — a refused stow never spends gold"
affects: [29-02-pending-loot-pile, 29-03-loot-screen]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One capacity predicate (canStow) + one gate (stowItem) — every stow path (takeFind, unequipSlot, store lockpicks) routes through it instead of a local length check"
    - "Delta-helper extraction (weaponUpgradeDelta/armorUpgradeDelta) so a presentation-layer compare view-model reads the engine's own arithmetic instead of restating it"

key-files:
  created:
    - test/unit/bag-cap-gate.test.js
    - test/unit/lootCompare.test.js
  modified:
    - content/bags.js
    - engine/derived.js
    - engine/items.js
    - engine/economy.js
    - src/browser/viewModels.js
    - src/browser/toasts.js
    - src/browser/eventNarration.js

key-decisions:
  - "slotItems(c) filters c.items to kind !== potion — the single capacity count; stowItem exempts kind:potion from the gate itself (not just the count), so a potion always stows even at a full bag"
  - "stowItem's kind:bag branch upgrades c.bag in place and is never itself stowed/counted; a same-or-lower tier is rejected as itemRejected{reason:notBetter}"
  - "Store's STOWING_EFFECTS set (giveLockpicks only) checks canStow BEFORE deducting gold or marking a stock slot sold — givePotion/buyWeapon/buyArmor/buyPremium/buyScroll/buyRations/repairArmor are all deliberately excluded (scalar-exempt or equip-or-reject, no slot consumed)"
  - "clampCarry's slot trim now filters on slotItems(c).length vs cap.slots, preserving every potion and dropping overflow gear/treasure off the end in original order (previously a raw c.items.length truncation could have dropped a trailing potion)"

patterns-established:
  - "Compare-to-equipped pattern: lootCompare imports weaponUpgradeDelta/armorUpgradeDelta/weaponRefusalReason/armorRefusalReason from engine/items.js rather than restating the upgrade/legality rule — proven by a property test that lootCompare.upgrade equals takeItem's own itemTaken outcome for every legal weapon base x bonus 0..2"

requirements-completed: [LOOT-03, LOOT-04, LOOT-05]

coverage:
  - id: D1
    description: "One bag-cap gate: stowItem/canStow enforce slotItems(c).length < bagCap(c) (potions exempt) at every stow path (takeFind, unequipSlot, store lockpicks); a refused stow spends no gold, discards nothing"
    requirement: "LOOT-04"
    verification:
      - kind: unit
        ref: "test/unit/bag-cap-gate.test.js — stowItem/canStow/takeFind/unequipSlot/buyFrom cases"
        status: pass
      - kind: integration
        ref: "test/parity/economy-parity.test.js, test/parity/combat-parity.test.js"
        status: pass
    human_judgment: false
  - id: D2
    description: "Bigger bags as depth-appropriate treasure: BAG_ORDER/BAG_FLOORS/BAG_DROP_UNDER/BAG_ITEMS content, bagUpgradeTier availability read, stowItem's bag-upgrade branch"
    requirement: "LOOT-05"
    verification:
      - kind: unit
        ref: "test/unit/bag-cap-gate.test.js — BAG_ORDER/BAG_FLOORS/BAG_ITEMS shape, bagUpgradeTier, stowItem kind:bag cases"
        status: pass
    human_judgment: false
  - id: D3
    description: "Compare-to-equipped view-model: lootCompare(c, it) reads takeItem's own delta helpers for weapon/armor/bag/misc items; illegal gear reads 'can't use (...)' via the shared refusal-reason predicates"
    requirement: "LOOT-03"
    verification:
      - kind: unit
        ref: "test/unit/lootCompare.test.js — all cases including the takeItem-parity property test"
        status: pass
    human_judgment: false
  - id: D4
    description: "On-device verification of the bagFull/bag-readout presentation (deferred to end of Phase 29 run)"
    verification: []
    human_judgment: true
    rationale: "Requires a physical device session to confirm the toast text, purse total, and stock-row state visually — see Human verification section below"

duration: 55min
completed: 2026-09-16
status: complete
---

# Phase 29 Plan 01: Bag-Cap Gate, Content Tiers & Compare-to-Equipped Summary

**Single `stowItem`/`canStow` bag-cap gate (potions exempt) now covers every stow path — find, unequip, and the store's lockpick buy — with a pre-pay refusal check that never spends gold; `weaponUpgradeDelta`/`armorUpgradeDelta` extracted from `takeItem` so the new `lootCompare` view-model can never disagree with what the engine would auto-equip.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-09-16T02:10:00Z (approx.)
- **Completed:** 2026-09-16T03:05:37Z
- **Tasks:** 3
- **Files modified:** 7 (+2 new test files)

## Accomplishments
- `slotItems(c)` is now the one bag-slot capacity count (potions excluded); `clampCarry`'s slot trim preserves potions and drops overflow gear off the end instead of truncating the raw array
- `stowItem`/`canStow` (engine/items.js) are the single bag-cap gate: `takeFind` and `unequipSlot` route through it, and it also handles `kind:"bag"` upgrade items (never counted, never itself stowed) and exempts `kind:"potion"` entirely
- `weaponUpgradeDelta`/`armorUpgradeDelta` extracted from `takeItem`'s weapon/armor branches — the exact arithmetic the new `lootCompare` view-model reads, so the loot screen (Plan 03) cannot drift from the engine's own auto-equip rule
- Store's `buyFrom` now checks `canStow` for `STOWING_EFFECTS` (`giveLockpicks`) BEFORE deducting gold or marking a stock slot sold — closing RESEARCH's Pitfall 1 (a refused stow used to still cost gold)
- `bagUpgradeTier(state)`/`bagItemFor(tier)` give Plan 02's `killFoe` the pure, guarded ("floor.depth >= tier's floor, no bag already pending") LOOT-05 availability read
- `lootCompare(c, it)`/`bagUsage(c)` (src/browser/viewModels.js) are new, pure view-models; `bagFull` toast/Oracle text now shows have/slots, and `bagUpgraded` gained both a toast and an Oracle entry (coverage guards green)
- Full suite green at 1528/1528 (1485 baseline + 43 new tests across the two new test files); parity suites (`economy-parity`, `combat-parity`) unchanged and green with zero fixture edits

## Task Commits

Each task was committed atomically:

1. **Task 1: Bag content tiers + slotItems + potion-preserving clampCarry** - `e7d8945` (feat)
2. **Task 2: stowItem — the one gate; delta helpers; bagUpgradeTier; store pay-order fix** - `3ced266` (feat)
3. **Task 3: lootCompare + bagUsage view-models, bagFull/bagUpgraded presentation, full-suite gate** - `3d2b8e6` (feat)

_No separate TDD RED/GREEN commits — tests and implementation were authored together and committed once per task after both were verified green (a minor process deviation from the plan's strict write-tests-first-and-watch-them-fail ordering; every acceptance criterion and behavior in the plan was independently verified against the final code before each commit)._

## Files Created/Modified
- `content/bags.js` - BAG_ORDER/BAG_FLOORS/BAG_DROP_UNDER/BAG_ITEMS pure-data tiers (LOOT-05); BAGS itself untouched
- `engine/derived.js` - `slotItems(c)`; `clampCarry`'s potion-preserving slot trim
- `engine/items.js` - `bagCap` exported; `canStow`, `stowItem`, `weaponUpgradeDelta`, `armorUpgradeDelta`, `bagUpgradeTier`, `bagItemFor` added; `takeItem`/`takeFind`/`unequipSlot` re-routed
- `engine/economy.js` - `STOWING_EFFECTS` pre-pay stow gate in `buyFrom`; `giveLockpicks` routed through `stowItem`
- `src/browser/viewModels.js` - `lootCompare(c, it)`, `bagUsage(c)`, private `classNames`/`refusalText` helpers
- `src/browser/toasts.js` - richer `bagFull` text (have/slots); new `bagUpgraded` entry
- `src/browser/eventNarration.js` - `bagFull` appends (have/slots); new `bagUpgraded` Oracle line
- `test/unit/bag-cap-gate.test.js` - new; Task 1+2 pins (25 tests)
- `test/unit/lootCompare.test.js` - new; Task 3 pins (18 tests)

## Decisions Made
- `stowItem`'s potion exemption applies to the REFUSAL CHECK itself, not just the `have` count — a potion always stows even when the bag's gear/treasure count already sits at the cap (caught by a failing test during Task 2 authoring: `canStow` alone would have wrongly refused a potion at a gear-full bag since it only reads `slotItems(c).length`, which is exactly gear-only).
- `weaponUpgradeDelta`/`armorUpgradeDelta` return the raw signed delta (not a boolean) so both `takeItem` (`<= 0` rejects) and `lootCompare` (`> 0` = upgrade) can each apply their own threshold semantics against the identical number.
- `armorRefusalReason`'s existing `noArmor -> woodsman -> tooHeavy -> null` order (Phase 24) is reused unchanged by `lootCompare` via the same function — no new legality rule was authored.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] stowItem's potion exemption did not survive a full gear bag**
- **Found during:** Task 2 (writing the "potions are exempt — stow succeeds even at a full bag" test)
- **Issue:** The first `stowItem` draft called the generic `canStow(c)` check for every non-bag item, including potions. Since `canStow` is built on `slotItems(c)` (gear-only), a potion offered to a bag already at its gear cap was incorrectly refused with `bagFull`, even though potions are supposed to be unconditionally exempt from the gate.
- **Fix:** Added an explicit `it.kind !== "potion"` guard before the `canStow` check in `stowItem`, so a potion always proceeds straight to `giveItem` regardless of the bag's gear/treasure fill level.
- **Files modified:** engine/items.js
- **Verification:** `test/unit/bag-cap-gate.test.js` "stowItem: potions are exempt" and "takeFind: a potion find succeeds at a full bag" both pass; full suite green.
- **Committed in:** 3ced266 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary for LOOT-04 correctness (potions must be unconditionally exempt, per the locked CONTEXT.md decision). No scope creep — the fix is entirely inside `stowItem`, the plan's own designated single gate.

## Issues Encountered
- `wornWeaponItem`'s reconstructed `txt` field for a Broadsword is `"d10+2"` (the weapon's dice label), not the display name `"Broadsword"` — an early `unequipSlot` test assumed the latter and had to be corrected against the actual content table (content/weapons.js). No production code was affected; test-only fix.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 02 (pending loot pile) can now call `stowItem`/`canStow`/`bagUpgradeTier`/`bagItemFor` directly for `takeLoot`/`takeAllLoot` and the guarded bag-swap draw in `killFoe`.
- Plan 03 (loot screen shell) can bridge `lootCompare`/`bagUsage` as `window.__mzLootCompare`/`window.__mzBagUsage` without any further engine work.
- No blockers identified for Plans 02/03.

## Human verification (deferred to end of run)

Deferred to the end of the autonomous run (per the plan's `<human_verification>` block, copied verbatim):
- On device, at a store with a full small bag (4 gear items), tap "Set of lockpicks": the toast reads "Bag full (4/4) — drop something to make room.", the purse total does not change, and the lockpicks row is not marked sold.
- Carry an Acuteness potion plus 4 gear items in a small bag: the GEAR tab readout shows "4 / 4" (the potion is not counted) — visible only after Plan 03 lands the readout.

---
*Phase: 29-end-of-combat-loot-bag-cap*
*Completed: 2026-09-16*

## Self-Check: PASSED

All 9 modified/created source files and the SUMMARY.md itself exist on disk; all 3 task commit hashes (e7d8945, 3ced266, 3d2b8e6) found in git history.
