---
phase: 88-item-systems-effect-sources-heal-over-time-the-crit-proof-cloak
status: passed
verified: 2026-09-30
verifier: orchestrator (verification agents off per project config; deferred-UAT protocol)
score: 4/4
human_verification:
  - "Wear a Cloak of Flying, use it, take it off: the Flying chip goes, the Oracle and rail say the flying stops, and the cloak shows cooling for the squares left plus 50 (88-01)"
  - "With the Cloak of Ether live, walk into rock and take the cloak off: the hero is entombed (88-01)"
  - "Use a Ring of Power worn in the first jewelry slot, then equip another piece into the second slot: the Empowered chip stays (88-01)"
  - "A Magic User wields the Crystal Staff, uses it, then unwields it: the Invisible chip goes, the Oracle says the party is seen again, and the staff's charges are unchanged (88-01)"
  - "Use a Cloak of Flying, Save & Quit, relaunch, take the cloak off: the flying stops with its line and the cloak shows cooling (88-02)"
  - "A Magic User uses the wielded Crystal Staff, Save & Quit, relaunch, unwields it: the Oracle says the party is seen again (88-02)"
  - "A Fighter wearing a used Cloak of Strength braces in a fight: the Crit-proof and Bracing chips show side by side with different names (88-03)"
  - "Take the Cloak of Strength off after using it: the Crit-proof chip goes and the Oracle says criticals can land again (88-03)"
  - "Hurt, use the Cloak of Regeneration and walk: a heal line at 10, 20 and 30 squares, the Regenerating chip counting 3, 2, 1 ticks, then the cloak cooling for 50 (88-04)"
  - "Use the Cloak of Regeneration at full HP and walk ten squares: \"Nothing left to knit.\" and the chip drops to 2 ticks (88-04)"
  - "Use the Cloak of Regeneration, walk 15 squares, take it off: the ticks stop and the Oracle names the ticks left unspent (88-04)"
  - "Wade through water across a 10-square mark with the Cloak of Regeneration live: exactly one heal line (88-04)"
---

# Phase 88: Item Systems: Effect Sources, Heal-Over-Time & the Crit-Proof Cloak — Verification

**Goal:** An item's activated benefit lasts only while the item is worn, the Cloak of Regeneration heals over time, and the Cloak of Strength stops foe crits: the item systems the audit fixes build on.

## Success criteria

| # | Criterion | Evidence | Status |
|---|-----------|----------|--------|
| 1 | A hero who uses a worn item and then takes it off, drops it, sells it or swaps it loses the benefit at once, with a narrated line; an item destroyed while its effect runs ends it too | 88-01: `applyActivation` stamps `src { slot, n }` from a source slot (`SOURCE_SLOTS`: jewelry1, jewelry2, cloak, weapon); `engine/items.js#endSourceEffects` is the one early-end helper, called by `wearItem`, `unequipSlot`, `equipItem`, `takeItem`, `takeLoot`, `dropItem`, the Pilfer fumble and `economy.js#sellItem`; `endEffectEarly` keeps the use spent (left + cd); Ether in rock entombs through `resolveEtherEnd`; `itemEffectEnded` narrated on the Oracle and rail. `item-effect-source.test.js` (every gear path, destruction, refusals, four edges), `item-effect-ended-lines.test.js` | ✓ |
| 2 | The same holds for a Joiner's gear, and after save, quit and relaunch mid-effect the effect still knows its item and ends when the item comes off | 88-01: the helper works on any sheet (Joiner events carry `member`, never entomb). 88-02: `engine/saveState.js#reconcileItemSources` runs in `validateSave` and `rehydrate` for the hero and every party member after `reconcileWorn`/`sanitizeStaff`: a saved `src` survives, an unlinked or mismatched record is linked to the matching slotted item or ended quietly with the use spent; `src` proven carved out of all three comparables. `item-effect-source-save.test.js` (21), `item-source-comparables.test.js` (3) | ✓ |
| 3 | Once the Cloak of Regeneration is used, its wearer heals at each of the next three 10-step marks (30 steps) with a narrated line per tick, and taking it off stops the ticks left | 88-04: heal-over-time is activation data (`act { knit, effect 30, cd 50, hot { every 10, ticks 3, heal 1d6 } }`); `tickHealOverTime` runs per step in `move`, each d6 from `derivedRng(…, "healTick", …)` (the use-time main-rng d6 is gone); `healTicksDue`/`healTicksLeft` count from the record's own `left` (a 2-square water step ticks once); full-HP tick "Nothing left to knit." is spent; Regenerating chip shows ticks left; take-off stops the rest via the source link (`itemEffectEnded` carries the unspent `ticks`). `heal-over-time.test.js` (19), `heal-over-time-lines.test.js` (13) | ✓ |
| 4 | A hero or Joiner wearing the Cloak of Strength takes no foe crits and still lands their own, and its activation shows its own chip and name, not Braced | Shipped by quick 260928-cos; 88-03 closes it with pins for every clause (`cloak-crit-ward.test.js` 14 → 23): Joiner ward and a Joiner's own crits, the ward ending on take-off/swap and through the helper, Crit-proof vs Bracing chips side by side, exact-name identity. No engine change needed | ✓ |

## Requirements

ITEM-02 ✓ (88-01 + 88-02) · ITEM-03 ✓ (88-04) · ITEM-04 ✓ (88-03)

## Automated checks

- Full `npm test` re-run by the orchestrator on HEAD `6800c053` after the wave-3 merge: **8,282 tests, 8,280 pass, 0 fail, 2 skipped** (phase base 8,172 / 8,170).
- Parity `node --test "test/parity/**/*.test.js"`: 66/66. `test/parity/prototype-master.js.txt` untouched over the phase (`690c90c0..6800c053`). `node tools/narrative-review.mjs --check`: in sync.
- Declared moves (each measured and recorded in `test/parity/FIXTURE-INVENTORY.md`, Phase 88 plans 01, 02, 04): `item-activation.test.js` Crystal Staff and Cloak of Speed record pins gain `src` (88-01); zero drift (88-02); chargen seed 4 `after.worn.cloak.txt` (text only), the roll-high-guard DRAW_INVENTORY `engine/items.js` amount 8 → 7, the `deep-14` state pin (text-only, per-step trace identical to the base), and the unit pins that move with the Regeneration rule (88-04).

## Findings carried forward

- **Phase 89 (ITEM-07):** Joiners cannot use items; a Joiner's live item effects show no chip (`derived.js#memberConditionsOf`); the Pendant of Fortitude's `halfNext` survives take-off. All captured in `89-CONTEXT.md`.
- **Phase 92 (bot pass):** `tools/lib/tuning-bot.mjs` still treats a ready worn Cloak of Regeneration as an instant heal; re-read it before the milestone-end bot pass.
