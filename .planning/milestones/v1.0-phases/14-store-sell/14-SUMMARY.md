---
phase: "14"
name: Store Sells All Gear (Economy C)
status: complete
completed: 2026-09-10
tests: 653/653 (parity byte-identical)
requirements: [ECON-06, ECON-07]
---

# Phase 14: Store Sells All Gear — SUMMARY

**Complete + verified + deployed 2026-09-10.** `npm test` = **653/653** (640 + 13), parity byte-identical (no fixture/serialized-field touched).

## What landed
- **`sellItem{i}`** (pure, no rng, `engine/economy.js`/`actions.js`/`engine.js`): splice `c.items[i]`, credit `c.gold += sellPriceFor` (wilmst-cap clamped via the Phase-12 gated clamp), push `itemSold`.
- **`sellPriceFor(item, race)`** = `max(1, round(priceFor(baseValue, race) * 0.5))` (SELL_SPREAD=0.5, a Phase-16 knob). Base from WEAPONS/ARMORS cost, POTIONS price, picks 450, magic ×premium; treasure fallback = 200 (Phase 15 refines).
- **Shared `renderCarriedList(container, items, opts)`** in `mazeworld.html` — ONE row renderer now used by the **GEAR tab** (use/equip/drop), the **store "Your gear" sell** section (sell), and the **combat-bar use-list** (E2, filtered to potion/`use` items).
- **Bridges:** `mzSellItem`, `mzUseItem` (combat-aware — routes combat uses through `engineCombatAction` for victory/death handling), `__mzSellPrice`. `itemSold` narration added (coverage + VOX-02 green).
- **`test/unit/store-sell.test.js`** (13 tests).

## Requirements: ECON-06 ✅ (sell any carried item), ECON-07 ✅ (E2 combat-bar item use + shared list component).
## Next: Phase 15 — Item Audit + Inert-Effect Wiring.
