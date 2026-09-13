---
phase: "13"
name: Inventory Actions + UI (Economy B)
status: complete
completed: 2026-09-09
tests: 640/640 (parity 25/25)
requirements: [ECON-03, ECON-04, ECON-05]
---

# Phase 13: Inventory Actions + UI — SUMMARY

**Complete + verified + deployed 2026-09-09.** `npm test` = **640/640** (617 + 23), parity 25/25, master untouched. Replaces auto-take-best with player choice.

## What landed
- **New pure actions** (`engine/actions.js`/`engine.js`/`items.js`): `takeFind`/`leaveFind`/`dropItem{i}`/`equipItem{i}`/`unequipSlot{slot}` — all no rng, bag-slot cap enforced ONLY in these gated handlers.
- **Find callers → stash:** `offerFind` replaces auto-`takeItem`/`giveItem` in `openChest`/`findGear`/`findMisc`/`meetFaerie` (deliberate rules change); a find now sets `state.pendingFind` + `findOffered`.
- **`equipItem`** equips regardless of better/worse (deliberate) but rejects illegal via extracted `canEquipWeapon`/`canEquipArmor` (shared with the store buy path); direct swap. `unequipSlot` → bag.
- **New events + narration** (`findOffered`/`findTaken`/`findLeft`/`bagFull`/`itemDropped`/`itemEquipped`/`itemUnequipped`/`equipRejected`), coverage + VOX-02 green.
- **UI (`mazeworld.html`):** find Take/Leave prompt + full-bag keep/drop chooser (`S.pendingFind` in `hasActiveEncounter`); GEAR-tab per-item Equip/Drop + Unequip + `used/slots` readout; bridges `mzTakeFind`/`mzLeaveFind`/`mzEquipItem`/`mzDropItem`/`mzUnequip`.
- **`test/unit/inventory-actions.test.js`** (23 tests).

## Parity divergence (documented, master untouched)
Two fixtures drive finds (chest seed 2, faerie seed 38). Handled via `reconcilePendingFind` in `comparables.js`: when a find is pending, it applies the SAME legacy auto-take onto a `structuredClone` of `c` and compares — asserting the engine offers byte-identically what the prototype auto-took (rng identical; only the take→offer indirection differs). No master edit, no comparison weakened, no-op when nothing pending.

## Requirements: ECON-03 ✅ (choose to take), ECON-04 ✅ (keep/drop when full), ECON-05 ✅ (equip incl. inferior, restrictions enforced).
## Next: Phase 14 — Store Sells All Gear (+ E2 combat-item use).
