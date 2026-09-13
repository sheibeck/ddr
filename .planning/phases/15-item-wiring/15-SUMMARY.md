---
phase: "15"
name: Item Audit + Inert-Effect Wiring (Economy D)
status: complete
completed: 2026-09-10
tests: 666/666 (parity 23/23 byte-identical)
requirements: [ECON-08]
---

# Phase 15: Item Audit + Inert-Effect Wiring — SUMMARY

**Complete + verified 2026-09-10.** `npm test` = **666/666** (653 + 13), parity 23/23 byte-identical, master untouched. All 9 inert items WIRED (none retired).

## Wired
1. Helm of Knowledge `tongue`→canParley (DR15-A) — `combat.js canParley` (pure).
2. Cloak of Strength `noCrit` — `|| eff(c,"noCrit")>0` in `playerStrike` noCrit calc (pure).
3. Pendant of Fortitude `c.halfNext` — halves one incoming hit in `foeTurn`, then clears; `damageHalved` event (pure; halfNext only ever set by the item).
4. Amulet of Light `light` — clears `c.darkFor` on the per-step tick; `darknessDispelled` (pure, gated on darkFor>0).
5. Cloak of Healing `cloakHeal` — flat +10 up to maxWP on a 20-square cadence (NO rng); `cloakHealed`.
6. Cloak of Regeneration `cloakRegen` — d6 regen on the 20-square cadence, **gated behind carrying the cloak** (the one new rng; no fixture carries it, verified byte-identical); `cloakRegenerated`.
7. Amulet of Stone (DR16-G) — `stone`/`freeze` read a per-item `it.aoe ?? 2`; Amulet has `aoe:4`. (Field named `aoe` not `n` — `.n` is the display name.)
8. ether + Gauntlet `size` (both wired): ether → ethereal climb/gorge pass-through (mirrors isFlying, gated ether>0), `phasedThrough`; size → `+2*eff(c,"size")` weaponDamage.
9. Treasure base values — name-keyed `TREASURE_BASE_VALUES` (jewelry/cloaks/staves) in `economy.js` (NOT a `cost` field on item data — parity-safety); `sellPriceFor` now real (Cloak of Armor → 1250, not the 200 fallback).

New events all have `EVENT_NARRATION` entries (coverage + VOX-02 green). `test/unit/item-wiring.test.js` (13 tests). No field/event renames; `prototype-master.js.txt` untouched.

## Requirements: ECON-08 ✅ (every item works or documented; DR15-A + DR16-G folded in).
## Next: Phase 16 — Economy-Local Conservative Tuning (the last phase).
