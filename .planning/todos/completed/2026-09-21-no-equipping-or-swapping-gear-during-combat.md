---
created: 2026-09-21T23:35:00.000Z
title: No equipping or swapping gear during combat
area: engine
resolves_phase: 61
files:
  - engine/items.js:714 (equipItem — no `state.combat` gate), 821 (unequipSlot — none), 406 (wearItem — none)
  - engine/actions.js:50-51, 156 (equipItem / unequipSlot dispatch — reachable while state.combat is set)
  - engine/movement.js:523 (the one existing combat gate pattern: `if (state.combat) return events`)
  - src/browser/gearTab.js:111, 186-224 (the Gear tab's worn/carried rows stay fully interactive in combat; the ITEMS submenu shares its row model)
  - mazeworld.html:5384-5390 (mzUseItem — IN combat a use costs the turn like Strike/Potion; OUT of combat it is free)
---

## Problem

Reported on the Pixel 7 (2026-09-21, build `dbcdd66`), user's words: "I didn't think we should allow changing equipped gear during combat."

Today the Gear tab is reachable mid-fight and `equipItem` / `unequipSlot` / the jewelry swap carry no `state.combat` check, so a player can switch weapon, armour, cloak or jewelry between rounds for free — no turn cost, no rules consequence — while USING a bag item in combat correctly costs the turn (`mzUseItem`). The rulebook's fight loop has no "re-arm" step; the free swap lets a player wear the anti-undead cloak only when undead show up, or trade to the crit weapon after Riposte lands, which the tuning bot never does — so it is also an untracked human advantage over the fitted curve.

## Solution

Engine rule (the gate lives in the engine, never only in the UI): `equipItem`, `unequipSlot`, `wearItem` and the jewelry swap refuse while `state.combat` is set — one `gearRefused { reason: "combat" }` event (add the narration line + `EVENT_NARRATION` coverage entry: "Not the moment to change outfits."), zero draws, so parity is unaffected for every fixture (none equip mid-fight — verify with the fixture scan; declare if one does). Shell: the Gear tab's equip/unequip/swap controls render disabled with that reason while a fight is up (the use-item buttons stay, since using costs a turn). Decide with the user whether SHIELD/torch "ready" toggles count as gear changes (recommend: same gate). Unit tests for each refused verb. Engine quick task between phases; sequence after 54-07 (it changes nothing the bot does, but keep the fit's baseline clean). Pixel 7 check: in a fight, the Gear tab's equip/swap buttons are disabled with the line; after the fight they work.
