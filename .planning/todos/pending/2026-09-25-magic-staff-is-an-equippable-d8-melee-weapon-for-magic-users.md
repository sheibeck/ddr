---
created: 2026-09-25T00:00:00.000Z
title: A magic staff is an equippable d8 melee weapon for Magic Users, usable only while wielded
area: engine
resolves_phase: 75
files:
  - content/treasure-tables.js:77-83 (the 2026-09-18 staff amendment: "usable but not equipable, no staff slot" — REVERSED)
  - content/treasure-tables.js:228-248 (STAVES_ROWS: Rowan, Birch, Walnut, Oak, Crystal, Poplar — use + charges)
  - engine/items.js:148 (rollStaff → kind "staff" with charges), :531, :1258 (staff use gated to Magic Users)
  - content/weapons.js (weapon table; Quarter Staff d6 / Spiked Staff d8 are mundane weapons — unrelated to magic staves)
---

## Problem

User, 2026-09-25: "treat a staff as an equipable melee weapon for magic users. D8 base damage. Staves should no longer be usable from inventory, but only if equipped."

This REVERSES the user's 2026-09-18 staff amendment ("A magic staff is a usable item, but not equipable… Staff should not be an equipment slot"). Today a magic staff lives in the bag (one slot) and its charged power is used by bag index.

## Solution

**Rule:**
- A magic staff (the six STAVES_ROWS) is equipped in the WEAPON slot by a Magic User and fights as a melee weapon: d8 base damage, plus the hero's usual damage modifiers. It uses the normal to-hit (need 0, crit 1, like other d8 FTM weapons, unless the planner finds a canon reason otherwise).
- Its charged power (dome, freeze, weaken, stone, invis, heal) can be USED ONLY WHILE WIELDED. A staff in the bag is inert and can't be used from inventory.
- Charges and recharge are unchanged.
- Equipping swaps out the current weapon to the bag, exactly like any weapon swap.
- Non-Magic-Users can't equip a magic staff: it's already MU-only to use; the Gear tab says so.
- Combat: consistent with CMBUI-14, a staff in the bag is greyed in the combat ITEMS list ("NOT EQUIPPED"); a wielded staff's power shows as EQUIPPED and usable.
- Pilfer (RULES-09): a Pilfer is a Thief, so it can't wield a magic staff. The staff fumble applies only to an MU Pilfer, which doesn't exist, so nothing changes. The planner confirms.

**Engine gate:**
- A declared divergence from the 2026-09-18 amendment and the prototype.
- Measure fixtures where a staff was used from the bag, declare and regenerate them. Never edit the master.
- Old saves: a staff in the bag loads as a bag staff (equip it to use it). No auto-equip, since a tolerant load never changes loadout.
- Update the Gear tab (EQUIP on staves for MUs), store/loot text, item descriptions ("wield it: d8, and its power while in hand"), and `docs` item rules.

**Tests:**
- An MU equips a staff: weapon slot, d8 damage.
- Its power works only while wielded, and a bagged staff's use is refused with a reason.
- A non-MU can't equip it.
- A save round-trip keeps it.

**Pixel 7 check:** a Magic User with a Birch Staff: equip it, strike with it, freeze with it. Unequipped, it's inert.
