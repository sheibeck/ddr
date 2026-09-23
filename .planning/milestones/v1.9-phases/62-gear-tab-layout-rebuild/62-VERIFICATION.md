---
phase: 62-gear-tab-layout-rebuild
verified: 2026-09-23T13:30:00Z
status: passed
score: 5/5 success criteria verified on automated evidence (orchestrator re-run at HEAD 45226aa); device checks deferred to the Phase 64 batch
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - "GSCR-01 (Pixel 7): the Gear tab opens on the slim stat header (ARMOR RATING + WILMST); AR matches the HUD/Hero value, and with a Cloak of Armor it shows the cloak's effective AR"
  - "GSCR-02 (Pixel 7): WORN shows five rows in order WEAPON, ARMOR, CLOAK, JEWELRY 1, JEWELRY 2 with an N / 5 count; bare fists read as an empty weapon slot in italics; armor wear (x/y hp or destroyed) sits in the armor note"
  - "GSCR-03 (Pixel 7): a worn activatable shows USE → ACTIVE (n SQ) → COOLING (n SQ) as you walk, and a staff shows k/max · n SQ; tapping USE works and costs the turn in a fight"
  - "GSCR-04 (Pixel 7): the bag meter shows used / cap with one pip per slot; at cap the count and pips go red with 'BAG FULL · DROP OR USE SOMETHING'; potions and scrolls never fill a pip"
  - "GSCR-05 (Pixel 7): bag cards show the slot tag (and '· SWAP' when both jewelry slots are full); a staff/torch card carries USE instead of a tag; an item name with an apostrophe renders as text"
  - "GSCR-06 (Pixel 7): CONSUMABLES lists healing potions (USE greyed at full HP or ×0), each buff potion type ×N, and SCROLLS ×N with READ (greyed with the reason when you can't read); ALSO ON YOU still shows rations, spell charges, running effects and kills"
  - "Interim actions (Pixel 7): Equip / Unequip / Drop (two-tap) / swap-confirm still work on the new rows until Phase 63's sheet replaces them; text size S/M/L resizes the new Gear text"
gaps: []
---

# Phase 62 — Verification (orchestrator-authored; gsd-verifier disabled for usage limits, standing 2026-09-14 ruling)

This is a goal-backward check of the phase goal: *the Gear tab reads like the mock, with a header, a fixed five-slot WORN list, a BAG with a capacity meter, and a CONSUMABLES block. Every number and label comes from the shared gear view models, so nothing shown here can disagree with the ITEMS submenu, the loot screen or the store.*

There were three plans, one per wave, run in order in worktrees. 62-01 built pure view models and copy test-first. 62-02 rebuilt the DOM and CSS of `#screen-gear` on those models. 62-03 added the cross-screen agreement sweep and the no-fork guard, and caught up the docs. After each merge the orchestrator reran the full suite on master. The only failure was a build-artefact test that read a stale `www/` before `build:www`; it passed once rebuilt.

## Evidence (orchestrator re-run at HEAD 45226aa)

| # | ROADMAP success criterion | Result |
|---|---------------------------|--------|
| 1 | Slim stat header: ARMOR RATING (from `armorDisplay`, Cloak of Armor included) + WILMST | `gearHeaderModel` reads `armorDisplay`; `#gear-stats` renders it. Pinned in `gear-view-models.test.js` (66 tests) and `gear-tab-dom.test.js` (28 tests). GSCR-01 was reworded in discuss, because the global HUD already names the hero. |
| 2 | WORN: five fixed slots, `N / 5`, label / name / note / value column, in-voice empty state | `GEAR_WORN_ORDER` = weapon, armor, cloak, jewelry1, jewelry2. `gearWornModel` uses the value column only where there's a clean number (weapon die + magic, `AR n`), with `—` for jewelry and cloaks. `emptySlotRows` gained the weapon row ("fists — nothing in hand. Free, always with you, and not very good."), and Fists counts as empty. |
| 3 | USE / ACTIVE / COOLING driven only by `itemRowState`, with the squares sub-label | `gearUseCell(state, it)` maps `itemRowState` kinds (ready / effect / cooldown / charges) to the button and sub-label. Tapping runs `deps.useItem`. A source guard in `gear-agreement.test.js` proves no Gear code restates the rule. |
| 4 | BAG `used / cap` + pips, red + BAG FULL line at cap, from `bagUsage` alone | `gearBagMeterModel` reads `bagUsage`. Pips = cap (4/6/8/10), with no pips for a bag-less character. Boundary edges (at cap, one under) are pinned. Potions and scrolls never count. |
| 5 | Bag cards + CONSUMABLES; the ITEMS submenu, the loot screen and the store read the same models | `gearBagCardsModel` provides the family tag and `· SWAP`, and bag-only items carry USE. `gearConsumablesModel` covers healing (`drinkPotion`, greyed at full HP or ×0), buff potions grouped by name, and SCROLLS (`readScroll`, greyed with the engine reason). `gearKitRows` keeps rations, charges, effects and kills. `gear-agreement.test.js` (14 tests) sweeps 7 real-rendered states / 17 item pairs: the Gear DOM agrees with `combatMenuViewModel` ITEMS, `dropShelfItems` and `bagUsage`, with no fork. `renderCarriedList` is byte-identical, and the store, loot and hero snapshots are untouched. |
| — | Gates | `npm test` passes **4097/4097** on master after `build:www` (4054 after Wave 1, 4083 after Wave 2). `npm run build:www` exits 0, and `boot:check` passes 4/4 (62-03). `git diff --stat b124348..HEAD -- engine/ content/ test/parity/` is **empty**, and the master blob `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` is unchanged. Only the three gear snapshots moved (`thief.gear`, `mu.gear`, `thief.gear-confirms`), and they were deliberately regenerated. |

## Notes the reader should have

- **The interim actions are deliberate.** Equip, Unequip, two-tap Drop and swap-confirm stay on the rows, reused from `renderCarriedList` rather than copied, until Phase 63's sheet replaces them.
- **Healing is greyed at full HP as well as at ×0.** This mirrors the ITEMS submenu's own rule. Mid-fight READ is greyed on Gear but stays tappable in the combat submenu, where the refusal logs; Phase 63 can revisit this.
- **Text scale:** the new Gear CSS writes `calc(<rem> * var(--mw-text-scale))` per rule, because the `:root` `--mw-font-*` tokens don't respond to the S/M/L setting. That existing bug is logged as a todo (`2026-09-23-text-size-setting-misses-every-mw-font-token.md`).
