---
created: 2026-09-21T20:40:00.000Z
title: Store purchase charged then rejected as not an upgrade (Spiked Staff)
area: engine
resolves_phase: 61
files:
  - engine/economy.js:483-506 (buyFrom — gold deducted + item.sold BEFORE the effect runs)
  - engine/economy.js:233-244 (buyWeapon / buyArmor / buyPremium → takeItem)
  - engine/items.js:428-447 (takeItem weapon branch — `notBetter` rejection after payment)
  - engine/items.js:363-367 (weaponUpgradeDelta — candidate at prof 0 vs current at c.prof)
  - src/browser/viewModels.js:180-206 (store/loot row "upgrade / not an upgrade" line)
  - src/browser/narrationLines.js:318 (notBetter: "Not an upgrade.")
---

## Problem

Reported on the Pixel 7 (2026-09-21, build `dbcdd66`), user's words: "buying a spiked staff from the store says: not an upgrade. It then does not show up in my inventory. It is an upgrade if magic users can wield staffs. Make sure our store items are actually purchasable."

`buyFrom` charges the gold and marks the row sold, THEN runs the effect; `buyWeapon` calls `takeItem`, whose weapon branch rejects with `notBetter` when `weaponUpgradeDelta(c, it) <= 0` and returns without equipping or bagging. Result: gold gone, row sold, no weapon — a paid-for item vanishes. The delta compares the candidate at proficiency 0 against the current weapon WITH its accrued `c.prof`, so a strictly bigger die (Spiked Staff d8, `cls: "FTM"` — a Magic User CAN wield it) can read as "not an upgrade" against a proficient Quarter Staff d6, and the store row still offers the BUY.

Same shape for `buyArmor` (`armorUpgradeDelta <= 0`) and `buyPremium`.

## Solution

Two rules, both engine-side (rules engine stays UI-free):
1. A store purchase must never lose the item: in `buyFrom`, evaluate the outcome BEFORE charging — if `takeItem` would reject (`notBetter` or a refusal), either refuse the sale up front with a `buyFailed` reason the row can show (`reason: "notBetter"` / the refusal), or complete it and bag the item as a stowed weapon (`stowItem`) when the player buys it anyway — the user's intent ("make sure store items are actually purchasable") reads as the latter for legal-but-not-better gear: buy it, it goes in the bag / equips by choice. Decide in discuss; the greyed-row-only path leaves the Spiked Staff unbuyable, which is not what was asked.
2. `weaponUpgradeDelta` should compare like with like for the store: either compare base dice (prof-free) for the purchase decision, or show the prof-adjusted line as advice only, never as a gate. Add a unit test: MU with Quarter Staff at prof 3 buys Spiked Staff → gold charged AND weapon owned.
Fixture check: store rolls are parity fixtures (`test/parity/fixtures/action-script.economy.json`) — a changed purchase path is a declared divergence; measure with the fixture scan. Pixel 7 check: buy a Spiked Staff as an MU with a staff already equipped; confirm gold drops and the staff is in hand or bag.
