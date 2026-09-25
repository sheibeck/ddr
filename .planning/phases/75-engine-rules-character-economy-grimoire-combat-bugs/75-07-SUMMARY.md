---
phase: 75-engine-rules-character-economy-grimoire-combat-bugs
plan: 07
subsystem: engine-rules
tags: [combat, items, economy, saveState, staff, weapon]

requires:
  - phase: 75-engine-rules-character-economy-grimoire-combat-bugs
    provides: "75-04 (destroyed-armor swap pattern), 75-06 (Bubble one-shot mirror — read to avoid clobbering combat.js/derived.js/saveState.js edits)"
provides:
  - "RULES-13 (engine half): a magic staff (any of the eight STAVES_ROWS) equips into a Magic User's WEAPON slot and fights as a flat d8 melee weapon (need 0, crit 1, max 8) via engine/derived.js#weaponRow/wieldedStaff, routed through weaponNeedMod/weaponCrit/weaponDamage/expectedStrike/gearCompareParts and combat.js's WEAPON_MAX read"
  - "The wield state (c.staff + c.weapon naming it) is set/cleared on every weapon path: equipItem, unequipSlot, takeLoot(equip:true), takeItem (defensive); a wielded staff's power is used via useItem({slot:'weapon'}), validated by engine/actions.js"
  - "economy.js#gearUpgrades never treats a weapon purchase as an upgrade while a staff is wielded — deliverGear bags it (purchaseBagged) instead of trading the staff away"
  - "saveState.js#sanitizeStaff: a bag staff never auto-equips on load; a mismatched/tampered c.staff is dropped and a c.weapon naming a staff with no valid c.staff resets to Fists"
  - "c.staff is carved out of movementComparable/combatComparable/economyComparable (test/parity/harness/comparables.js#stripStaffField); zero parity fixtures moved (measured)"
affects: [75-09, 75-11]

tech-stack:
  added: []
  patterns:
    - "weaponRow(name) is the ONE lookup every engine site reads to resolve a weapon-slot NAME to its combat-stats row (WEAPONS[name] or STAFF_WEAPON) — mirrors the project's established single-source-of-truth pattern (expectedStrike, gearLockReason, etc.)."
    - "A wielded staff is tracked as a scalar c.weapon/c.staff pair, structurally independent of c.worn — it is NEVER a c.worn entry (SLOT_OF still excludes STAVES_ROWS), so staff-equip behavior is unaffected by whether a state carries c.worn at all (unlike the cloak/jewelry family)."
    - "wornWeaponItem(c) returns the REAL wielded staff object (not a reconstruction) so its live charges travel with every swap/unequip, exactly like takeLoot/equipItem already preserve a worn armor piece's remaining durability."

key-files:
  created:
    - test/unit/staff-wield.test.js
  modified:
    - content/treasure-tables.js
    - engine/derived.js
    - engine/combat.js
    - engine/items.js
    - engine/economy.js
    - engine/actions.js
    - engine/saveState.js
    - test/parity/harness/comparables.js
    - test/roundtrip/serialize-rehydrate.test.js
    - test/unit/inventory-actions.test.js
    - test/unit/worn-slots.test.js

key-decisions:
  - "STAFF_WEAPON is a standalone frozen row in content/treasure-tables.js (dice 1d8, lab 'd8', cls 'M', need 0, crit 1, max 8), never a content/weapons.js WEAPONS entry — WEAPONS' key order stays load-bearing and untouched (verified: git diff --quiet against the plan base for content/weapons.js)."
  - "A wielded staff is NOT a magic weapon against magic-only/dagger-only foes: equipItem's staff branch sets c.magicWpn = 0, per the plan's flagged assumption (its magic is its charged power, not an enchantment)."
  - "sanitizeStaff runs OUTERMOST in both validateSave and rehydrate's migration chains (after sanitizeWard), matching the file's own 'newest migration wraps the previous one' convention."

requirements-completed: [RULES-13]

coverage:
  - id: D1
    description: "A wielded magic staff reads as a d8 weapon everywhere the engine reads a weapon (need 0, crit 1, max 8), via one weaponRow(name) lookup"
    requirement: RULES-13
    verification:
      - kind: unit
        ref: "test/unit/staff-wield.test.js (weaponRow/wieldedStaff/weaponDamage/weaponCrit/weaponNeedMod/expectedStrike/gearCompareParts/carriedItems tests, 15 tests)"
        status: pass
      - kind: integration
        ref: "node --test \"test/parity/**/*.test.js\" (54/54, zero fixtures moved — measured via git diff --quiet against the plan base)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A Magic User can equip a staff into the weapon slot; a non-Magic-User is refused wrongClass; every swap/unequip/loot path preserves the staff (with its charges) and clears c.staff on leaving it; the store never trades a wielded staff away"
    requirement: RULES-13
    verification:
      - kind: unit
        ref: "test/unit/staff-wield.test.js (Task 2 tests 16-27: equipItem, unequipSlot, takeLoot, deliverGear, gear-lock)"
        status: pass
      - kind: unit
        ref: "test/unit/worn-slots.test.js, test/unit/inventory-actions.test.js (re-pinned for the deliberate wrongClass/equippable shape change)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A wielded staff's power is used via useItem({slot:'weapon'}), spends its own charges, and old saves load tolerantly (bag stays bag; a tampered/mismatched wield pair repairs to Fists)"
    requirement: RULES-13
    verification:
      - kind: unit
        ref: "test/unit/staff-wield.test.js (useItem-by-slot, validateAction, and the four save-tolerance tests)"
        status: pass
      - kind: unit
        ref: "test/roundtrip/serialize-rehydrate.test.js (new wielded-staff round-trip test)"
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-09-25
status: complete
---

# Phase 75 Plan 07: Staff wield model (RULES-13, engine half) Summary

**A magic staff equips into a Magic User's weapon slot and fights as a flat d8 melee weapon via one weaponRow(name) lookup, with wield state preserved across every equip/unequip/loot/store path and carved out of save tolerance and parity comparables**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-09-25T17:35:00-04:00 (approx.)
- **Completed:** 2026-09-25T18:03:00-04:00 (approx.)
- **Tasks:** 2
- **Files modified:** 11 (1 created, 10 modified)

## Accomplishments

- **Task 1 — the staff weapon profile and one weapon-row lookup:** `content/treasure-tables.js` exports a frozen `STAFF_WEAPON` (`{ dice: {n:1,sides:8,bonus:0}, lab: "d8", cls: "M", need: 0, crit: 1, max: 8 }`) and `STAFF_NAMES` (the eight STAVES_ROWS display names), and marks the 2026-09-18 staff amendment comment REVERSED by RULES-13. `engine/derived.js` gains `weaponRow(name)` (resolves an ordinary WEAPONS name or a STAFF_NAMES name to its row; null for "Fists"/unrecognized) and `wieldedStaff(c)` (returns `c.staff` only when `c.staff.n === c.weapon`) — `weaponNeedMod`, `weaponCrit`, `weaponDamage`, `expectedStrike`, and `gearCompareParts`'s `have` side now all route through `weaponRow` for the current weapon; `carriedItems` appends the wielded staff (once, after bag ∪ worn). `engine/combat.js`'s Ninja first-strike `WEAPON_MAX` read falls back to `weaponRow(c.weapon)?.max` for a staff name. `content/weapons.js` (WEAPONS' key order) is byte-identical to the plan base.
- **Task 2 — wield/unwield on every weapon path, use by slot, save tolerance, the comparables carve-out:** `engine/items.js`'s `wornWeaponItem(c)` returns the real wielded staff object (charges intact) ahead of the WEAPONS lookup; `equipItem` and `takeLoot(equip:true)` both gain a staff branch (MU-only, `wrongClass` otherwise; a direct swap into the weapon slot, displacing whatever was worn — weapon or a previously-wielded staff — into the freed bag slot, with an additive `replaced` on `itemEquipped`); every path that sets or clears the weapon slot (`equipItem`'s weapon branch, `takeLoot`'s weapon branch, `takeItem`'s weapon branch, `unequipSlot("weapon")`) now also clears `c.staff`. `engine/economy.js#gearUpgrades` never treats a weapon as an upgrade while `wieldedStaff(c)` holds one, so `deliverGear` bags a store weapon purchase (`purchaseBagged`) instead of trading the staff away — the store still never sells staves. `engine/items.js#useItem` resolves `{ slot: "weapon" }` to `wieldedStaff(c)` (not `c.worn.weapon`, which never exists) and `engine/actions.js`'s `useItem` validator accepts `"weapon"` as a slot value (still exclusive of `i`). `engine/saveState.js`'s new `sanitizeStaff(c)` (wired outermost in both `validateSave` and `rehydrate`, after `sanitizeWard`) keeps a bag staff bagged (no auto-equip), drops a `c.staff` whose shape/name/agreement with `c.weapon` is invalid, and resets `c.weapon` to `"Fists"` when it names a staff with no valid `c.staff` behind it. `test/parity/harness/comparables.js#stripStaffField` carves `c.staff` out of `movementComparable`/`combatComparable`/`economyComparable` (wrapped outermost in each chain).
- Full test suite green: `npm test` — 6110/6110. `node --test "test/parity/**/*.test.js"` — 54/54, with `git diff --quiet` against the plan base (`6dbdde5`) for `test/parity/fixtures` and `test/parity/prototype-master.js.txt` both exiting clean — zero fixtures moved, as the plan predicted (no replay site carries or wields a staff).
- `test/unit/staff-wield.test.js` (new, 32 tests) covers the full wield model end to end: `weaponRow`/`wieldedStaff`, weapon-stat routing, `carriedItems`, equip/unequip/loot/store swap paths, use-by-slot, `validateAction`, the gear lock, the comparables carve-out, and four save-tolerance cases.

## Task Commits

Each task was committed atomically:

1. **Task 1: The staff weapon profile and one weapon-row lookup** — `93f8c02` (feat)
2. **Task 2: Wield and unwield on every weapon path, use by slot, save tolerance and the carve-out** — `8fa695f` (feat)

**Plan metadata:** this SUMMARY.md's own commit (pending, by the orchestrator's convention)

## Files Created/Modified

- `content/treasure-tables.js` — `STAFF_WEAPON`/`STAFF_NAMES` exports; the 2026-09-18 staff amendment comment marked REVERSED
- `engine/derived.js` — `weaponRow(name)`, `wieldedStaff(c)`; `weaponNeedMod`/`weaponCrit`/`weaponDamage`/`expectedStrike`/`gearCompareParts` routed through `weaponRow`; `carriedItems` appends the wielded staff
- `engine/combat.js` — the Ninja first-strike `WEAPON_MAX` read falls back to `weaponRow(...)?.max`
- `engine/items.js` — `wornWeaponItem` returns the wielded staff; `equipItem`/`takeLoot`(equip) gain a staff branch; every weapon-setting/clearing path also clears `c.staff`; `useItem` resolves `{slot:"weapon"}` to `wieldedStaff(c)`
- `engine/economy.js` — `gearUpgrades` never calls a weapon an upgrade while a staff is wielded
- `engine/actions.js` — the `useItem` validator accepts `"weapon"` as a slot
- `engine/saveState.js` — new `sanitizeStaff(c)`, wired outermost in `validateSave`/`rehydrate`
- `test/parity/harness/comparables.js` — new `stripStaffField`, wired into all three `*Comparable()` chains
- `test/unit/staff-wield.test.js` — new, full wield-model coverage (32 tests)
- `test/roundtrip/serialize-rehydrate.test.js` — new wielded-staff round-trip test
- `test/unit/inventory-actions.test.js`, `test/unit/worn-slots.test.js` — re-pinned (Rule 1) for the deliberate "a staff is equippable now, MU-only" shape change

## Decisions Made

- **STAFF_WEAPON lives in content/treasure-tables.js, not content/weapons.js.** WEAPONS' key order and cls strings are explicitly load-bearing (the store shuffle, `rollBlade`) — adding a 25th key would have moved every downstream roll. A staff has no WEAPONS key at all; `weaponRow` is the one lookup that resolves either.
- **A wielded staff never carries `c.magicWpn`** (set to 0 on every equip path) — per the plan's flagged assumption, its magic is its charged power (freeze/heal/etc.), not a weapon enchantment, so it is not a "magic weapon" for magic-only or dagger-only foes.
- **The weapon slot's staff branch has no `c.worn` dependency**, unlike the cloak/jewelry family — this surfaced as a real, deliberate behavior difference in `test/unit/worn-slots.test.js`'s legacy-identity sweep (a legacy state with no `c.worn` key can still wield a staff, since `c.weapon`/`c.staff` predate `c.worn` entirely); documented in that test's own comment rather than treated as a bug.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Three pre-existing tests pinned the RETIRED "a staff is never equippable" rule**
- **Found during:** Task 2 (running the full unit suite before finalizing)
- **Issue:** `test/unit/inventory-actions.test.js` and `test/unit/worn-slots.test.js` had tests asserting `equipItem` on any staff, for any class, always returns `equipRejected {reason:"notEquippable"}` — the exact rule RULES-13 reverses. With the new staff branch landed, these assertions were simply wrong (a Fighter now gets `wrongClass`; a Magic User now succeeds).
- **Fix:** Re-pinned to the new deliberate shape: a non-Magic-User still gets `equipRejected`, now with `wrongClass`; a Magic User's equip now asserts the actual wield state (`c.weapon`/`c.staff`, the freed-slot swap, the `itemEquipped {slot:"weapon"}` event). The legacy-identity test split into two — ring/cloak still get `notEquippable` without `c.worn` (unchanged), while a staff now succeeds even in a legacy state (the weapon slot never depended on `c.worn`).
- **Files modified:** `test/unit/inventory-actions.test.js`, `test/unit/worn-slots.test.js`
- **Verification:** `node --test test/unit/inventory-actions.test.js test/unit/worn-slots.test.js` — pass; full `npm test` — 6110/6110
- **Committed in:** `8fa695f`

---

**Total deviations:** 1 auto-fixed (Rule 1 — re-pinning tests for the plan's own intended behavior change, not scope creep)
**Impact on plan:** No functional change beyond what the plan specified; the fix is pure test-shape correction.

## Issues Encountered

None beyond the deviation above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The wield MODEL is fully landed, tested, and measured with zero fixture drift. Bag use of a staff still works in this plan (transitional, per the plan's own scope note) — plan 75-09 makes a bagged staff's power inert and teaches the bot to wield.
- Handoff for 75-09: `useItem`'s existing bag-index path (a staff addressed by `i`, not `{slot:"weapon"}`) is UNCHANGED here and still resolves/spends charges normally — 75-09's "bag refusal" needs to add a new refusal branch there, gated on whether the staff is the wielded one (`wieldedStaff(c) !== it`), rather than routing through this plan's `{slot:"weapon"}` resolution.
- Handoff for 75-11 (surfaces): the Gear tab / gear sheet / hero sheet / combat ITEMS list all still read the PRE-Phase-75 staff-in-bag shape — none of this plan's files touch shell/UI code, so a staff will currently show as a plain bag item with no "EQUIP" affordance until 75-11 lands.
- No new event type was introduced (equip/unequip staff paths reuse `itemEquipped`/`itemUnequipped`/`equipRejected`), so no `EVENT_NARRATION` entry was needed for this plan.

---
*Phase: 75-engine-rules-character-economy-grimoire-combat-bugs*
*Completed: 2026-09-25*

## Self-Check: PASSED

- FOUND: test/unit/staff-wield.test.js
- FOUND: content/treasure-tables.js
- FOUND: engine/derived.js
- FOUND: engine/combat.js
- FOUND: engine/items.js
- FOUND: engine/economy.js
- FOUND: engine/actions.js
- FOUND: engine/saveState.js
- FOUND: test/parity/harness/comparables.js
- FOUND: test/roundtrip/serialize-rehydrate.test.js
- FOUND: test/unit/inventory-actions.test.js
- FOUND: test/unit/worn-slots.test.js
- FOUND commit: 93f8c02 (feat: Task 1 — staff weapon profile and one weapon-row lookup)
- FOUND commit: 8fa695f (feat: Task 2 — wield/unwield on every weapon path, use by slot, save tolerance)
