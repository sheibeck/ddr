---
created: 2026-09-23T18:20:00.000Z
title: Narrate a destroyed armor piece when new armor replaces it
area: engine
files:
  - engine/items.js:775-830
  - engine/items.js:975-1040
  - engine/items.js:461-520
  - engine/items.js:683-698
  - engine/items.js:883-912
  - src/browser/eventNarration.js:1051-1060
  - src/browser/narrationLines.js:1704
---

## Problem

User, on device (2026-09-23): they equipped found armor and the old armor "was dropped instead of going into the bag". It turned out the old piece had been **destroyed** in combat, so the rules were right: a destroyed piece is gone for good (rulebook p.44, Phase 28 ARMOR-03). But the game never said so. The swap reads like a lost item, and that is exactly the kind of silent outcome the "nothing happens silently" rule (v1.2 Phase 25) exists to prevent.

Mechanics:
- Combat's `armorDestroyed` event (`engine/combat.js:2189`) leaves `c.armor`/`c.ar`/`c.armorMax` in place with `c.armorWP <= 0`. The piece stays "worn" and destroyed; the Gear tab shows `AR n · destroyed`.
- On a swap, `wornArmorItem(c)` returns `null` for it (`engine/items.js:684`). Each equip path then drops it with no trace:
  - `equipItem` (the Gear sheet's EQUIP / SWAP INTO) removes the new item from the bag and pushes one plain `itemEquipped`.
  - `takeLoot(i, true)` (Victory "Equip now") skips the stow.
  - `takeItem` (store auto-equip) omits `replaced`, since `wornArmorItem` is null.
- **The precedent is already in the code:** `unequipSlot` handles the destroyed case explicitly (`engine/items.js:883-912`) with an additive `destroyed: true` flag on `itemUnequipped`, and both `eventNarration.js:1051` and `narrationLines.js:1704` narrate it. The equip paths never got the same treatment.

## Solution

- **Engine:** on each armor-replacing path (`equipItem`, `takeLoot` equip, `takeItem`), when the outgoing piece is the destroyed case (`c.armor` set, not "Nothing", `c.ar > 0`, `c.armorWP <= 0`), add an additive payload to the existing event. For example: `itemEquipped { …, discarded: { n, armor, ar, left: 0 }, destroyed: true }`, and the same on `itemTaken`. Follow the Phase 25 additive-payload pattern: no new event type, zero rng, and carve the new field out of the comparables if a fixture could carry it.
- **Narration:** a voiced line through the rail and the Oracle. For example: "Your old leather was already in pieces. You leave it where it fell." Keep it family-friendly and deadpan, and put it in the same line table as the `unequipSlot` destroyed line so the two read as a pair.
- **Optional polish:** the Gear sheet's EQUIP / SWAP INTO row for armor could say "your worn armor is destroyed — it will be discarded" in its note when the worn piece is destroyed. The sheet already shows engine-sourced notes.
- **Tests:** one test per path (sheet equip, loot equip-now, store buy) with a destroyed worn piece, asserting the flag and the line; the existing destroyed-unequip test is the template. No parity fixture should move: no fixture reaches a destroyed-armor swap. Confirm that, and declare it if one does.

This is a small engine and narration quick task that follows the Engine Gate.
