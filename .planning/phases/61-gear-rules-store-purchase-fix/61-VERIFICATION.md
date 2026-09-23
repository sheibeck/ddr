---
phase: 61-gear-rules-store-purchase-fix
verified: 2026-09-23T07:40:00Z
status: passed
score: 5/5 success criteria verified on automated evidence (orchestrator re-run at HEAD 129ce52); device checks deferred to the Phase 64 batch
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - "GRULE-01 (Pixel 7): in a fight (and at the Fight! preview), try to equip, unequip or swap jewelry from the Gear tab: nothing changes and the rail reads 'Not the moment to change outfits.'; after the fight the same actions work"
  - "GRULE-01 (Pixel 7): mid-fight, USE on a staff/torch/jewelry power, a potion, a scroll, and Drop still work (USE costs the turn as before)"
  - "STORE-02 (Pixel 7): as a Magic User holding a Quarter Staff, buy a Spiked Staff: gold drops by its price, the staff is in the BAG, and the rail line says why it isn't an upgrade"
  - "STORE-02 (Pixel 7): a weapon/armor your class can't use shows its BUY row disabled with the reason on the row, and tapping it charges nothing"
  - "STORE-02 (Pixel 7): with a full bag, a lockpicks/tool row and a not-an-upgrade gear row are disabled with 'bag full — sell or drop something first'"
  - "STORE-02 (Pixel 7): buying a real upgrade auto-equips it and the rail says the shopkeeper kept your old piece"
  - "STORE-03 (Pixel 7): store weapon/armor rows, the loot screen and the find card all show the explained line (dice · to-hit · per-swing · upgrade / not an upgrade)"
gaps: []
---

# Phase 61 — Verification (orchestrator-authored; gsd-verifier disabled for usage limits, standing 2026-09-14 ruling)

Goal-backward check of the phase goal: *the engine refuses gear changes while a fight is up, and a store purchase never charges gold for an item it then fails to deliver. Both device-found rule holes are closed before the sheet is built on top of them.*

There were four plans across three waves, all in worktrees: Wave 1 was 61-01 and 61-02 in parallel, Wave 2 was 61-03, and Wave 3 was 61-04. After each merge the orchestrator reran the full suite on master. Waves 2 and 3 each turned up one post-merge failure caused by Windows CRLF checkout artifacts, not logic. Both were fixed in the test harness (`98d5b6b`, `ebc4fcc`).

## Evidence (orchestrator re-run at HEAD 129ce52)

| # | ROADMAP success criterion | Result |
|---|---------------------------|--------|
| 1 | Equip/unequip/wear/jewelry swap refused mid-fight with one `gearRefused { reason: "combat" }` + in-voice line, zero rng draws | `engine/items.js#gearLockReason(state)` returns `"combat"` whenever `state.combat` is set, the pending Fight! preview included. The shared `refuseGear` gate runs first in `equipItem` and `unequipSlot`, and also in `takeFind`, `takeLoot` and `takeAllLoot` (planner decision: the engine allows a mid-fight loot equip, although the shell never shows it). Narration is in both tables: *"Not the moment to change outfits."*, or *"The spoils can wait until the fight is over."* for the loot verbs. `combat-gear-lock.test.js` passes 22/22, including a property test across all 29 `ACTION_TYPES` × payload variants × pending/live combat, zero draws, and a byte-identical state on refusal. |
| 2 | After the fight the same actions work as before | Covered by `combat-gear-lock.test.js` (post-fight equip/unequip succeed). The one pre-existing test that unequipped mid-fight (`armor-durability` A1) now clears combat first (`ed82b82`); its subject, destroyed armor vanishing, is unchanged. |
| 3 | A legal store purchase always equips or bags the item it charges for; a real refusal happens before payment with the reason on the row | `engine/economy.js#storeBuyRefusal(c, line)` settles gold, then legality, then room, all before any mutation. `deliverGear` equips an upgrade via `takeItem` (whose `itemTaken` now names the `replaced` piece) or bags a legal but not-better buy with `purchaseBagged { item, why }`. `store-delivery.test.js` passes 27/27, including a property test over every `STORE_EFFECTS` effectId: it either delivers, or refuses with gold unchanged and `sold` false. Store rows read `viewModels.js#storeRowState` (built on `storeBuyRefusal`): `store-rows.test.js` passes 12/12, including a 432-pair row-vs-engine agreement sweep with zero disagreements. This also fixed a bag-full tool row that looked clickable. |
| 4 | A Magic User with a Quarter Staff buys a Spiked Staff: gold charged, staff in the bag, the row and rail say why it isn't an upgrade | This is the acceptance test in `store-delivery.test.js` (61-03) and `store-rows.test.js` (61-04). The line reads exactly `d8 vs your d6 · −1 to hit · 4.1 vs 5.0 a swing · not an upgrade` for a level-3 Human Wizard (`upgrade-why.test.js`, 17/17). The one hit-math verdict is kept: `gearCompareParts` is pinned equal to `weaponUpgradeDelta` across every weapon × bonus 0–2 × 4 heroes. |
| 5 | Every moved fixture measured, declared, regenerated; prototype master untouched | Exactly one fixture moved: `action-script.economy.json` (+11/−3; the Axe buy is now bagged instead of paid-and-lost). It is declared in `FIXTURE-INVENTORY.md` and pinned by a `STORE-02 (Phase 61)` standing guard. `GRULE-01 (Phase 61)` is a standing guard that the combat lock moves zero fixtures across all 31 replay sites. The master blob hash is `a1f4d0dc29782218d8e5aab65bc5989c33f917f0`, unchanged since `6dbf5c4`. `content/` is untouched. |
| — | Gates | `npm test` passes **3986/3986** on master (3946 after Wave 1, 3974 after Wave 2). The four new suites add 78 tests. Bot smoke (`tune-difficulty --seeds=20 --json`) is byte-identical before and after for 61-01, 61-02 and 61-03. The only `mazeworld.html` change is the one-line find card from 61-02. |

## Notes the reader should have

- **STORE-03 was reworded in discuss.** The todo's "proficiency" diagnosis was wrong, because Magic User kits carry prof 0. The Spiked Staff's `need: -1` makes "not an upgrade" true, so the line now explains the verdict instead of hiding it.
- **The lock is wider than the locked verb list** (`takeFind`/`takeLoot`/`takeAllLoot`). The shell hides those cards in combat and the bot fights first, so nothing changes for players or the bot. It can be reversed on request.
- **CRLF hygiene.** This checkout has `core.autocrlf=true` and no `.gitattributes`, so any file git rewrites on merge comes back as CRLF. Two tests now normalise on read. The repo-wide `.gitattributes eol=lf` pin is still the open deferred item in STATE.md, and worktree executors see about 12–16 false failures from it.
