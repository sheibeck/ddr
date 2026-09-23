# Requirements: Delve, Die, Repeat — v1.9 The Gear Screen

**Defined:** 2026-09-23
**Core Value:** The dungeon crawl — the tension and discovery of descending into the unknown.

**Milestone goal:** Rebuild the Gear tab to the user's "Mazeworld Gear" mock (`design/Mazeworld Gear.dc.html`, imported 2026-09-23 from claude.ai/design project fed8909e…): a WORN slot list, a BAG with a capacity meter, a CONSUMABLES block, and one bottom action sheet for every equip / swap / unequip / use / drop. Close the two gear-rule holes the device rounds found: free re-arming mid-fight, and store purchases that vanish.

**Mock stance (same as the v1.4 combat and map imports):** the mock's layout, styles, copy tone and interaction model are the spec. Its toy rules are NOT: potions and scrolls ride free, staffs keep charges, and use-activation, cooldowns and bag caps come from the engine. The mock's toast is the rail (the standing ruling that the rail is the one feedback surface), player text says HP not WP, and the bottom nav stays the shipped tab set.

## v1.9 Requirements

### Gear Screen (presentation — `src/browser/`, no engine bytes)

- [ ] **GSCR-01**: The Gear tab opens on a header showing the hero's name, race · sub-class · floor, and the ARMOR RATING (the effective value from `armorDisplay`, Cloak of Armor included).
- [ ] **GSCR-02**: The player sees a WORN list of five slots in fixed order: weapon, armor, cloak, jewelry 1, jewelry 2. It has an `N / 5` count. Each row shows the slot label, item name, a one-line note and a value column (weapon die, armor rating and wear, or a jewelry or cloak bonus). An empty slot shows its in-voice empty line in italics.
- [ ] **GSCR-03**: A worn item that can be activated shows an inline button that reads USE, ACTIVE or COOLING (a staff shows its charge state), with a squares sub-label that counts down as the party walks. It is driven only by `itemRowState`, and tapping USE runs the same use path as today, which costs the turn in combat.
- [ ] **GSCR-04**: The player sees a BAG section with a `used / cap` count and a pip meter. At capacity both turn red and read "BAG FULL · DROP OR USE SOMETHING". The count comes from `bagUsage` alone, so potions and scrolls never count.
- [ ] **GSCR-05**: Each bag item is a card: name, description and a slot tag (the item's kind, plus `· SWAP` when every slot it fits is taken). Bag items that are never worn (staffs, torch, rope and the rest) carry the same USE / state button as the worn rows wherever the engine allows the use.
- [ ] **GSCR-06**: The player sees a CONSUMABLES section with a `N HELD` count. It lists potions and scrolls with `×N` quantities and a USE or READ button, and a READ the hero cannot perform says why. Rations and a Magic User's spell charges keep a readout on the tab, so nothing the old ALSO ON YOU block showed is lost.
- [ ] **GSCR-07**: Tapping a worn slot opens a bottom action sheet headed by `SLOT · WORN|EMPTY`, a title and a note. A filled slot offers USE (with its state reason), UNEQUIP (greyed with "Bag is full — free a slot first." when there is no room) and one SWAP FOR <item> per fitting bag item. An empty slot offers one EQUIP <item> per fitting bag item, or a greyed NOTHING TO EQUIP.
- [ ] **GSCR-08**: Tapping a bag card opens the same sheet with USE (for items that are never worn), one EQUIP TO / SWAP INTO action per named slot the item fits (both jewelry slots by name, so the player picks which piece comes off), and DROP. The sheet replaces the inline two-tap Drop and swap confirms.
- [ ] **GSCR-09**: Every greyed sheet action states the engine's reason, and every completed action's outcome reaches the player through the rail in voice. There are no toasts and no inline refusal text on rows.
- [ ] **GSCR-10**: The sheet closes on CANCEL, on a backdrop tap and on the Android back button. Its rise and fade have a reduced-motion path, and TalkBack reads the sheet's title and actions.
- [ ] **GSCR-11**: The ITEMS combat submenu, the loot screen and the store keep reading the same shared view models (`itemRowState`, `bagUsage`, `lootCompare`), so a state shown on the Gear tab never disagrees with another screen.
- [ ] **GSCR-12**: A Pixel 7 device batch covers the redone tab end to end: every sheet path, a full bag, staff charges, a cooldown counting down while walking, the combat lock and reduced motion. It is recorded in `docs/UAT-v1.9.md`.

### Gear Rules (engine — declared, deterministic, zero new rng draws)

- [x] **GRULE-01**: While a fight is up (`state.combat` set), the engine refuses `equipItem`, `unequipSlot`, `wearItem` and the jewelry swap with one `gearRefused { reason: "combat" }` event and a narration line in voice ("Not the moment to change outfits."), with `EVENT_NARRATION` coverage. Each verb has a unit test. Every parity fixture is byte-identical, confirmed by the fixture scan; one that moves is declared.
- [ ] **GRULE-02**: In a fight, the Gear sheet shows EQUIP / SWAP / UNEQUIP greyed with the combat reason while USE stays live. After the fight they work again. *(Settled in the Phase 61 discuss: the Shield is a spell pool and the torch is a use, so neither is a gear change and both stay live, along with potions, scrolls and Drop.)*

### Store (engine — declared fixture moves)

- [x] **STORE-02**: A store purchase never charges for an item it then fails to deliver. `buyFrom` settles the outcome before gold moves. A legal weapon, armor or premium item is bought and then equipped or bagged by choice. A real refusal (bag full, class cannot use it) happens before payment, with the reason on the row.
- [x] **STORE-03**: The store, loot and find "upgrade / not an upgrade" line keeps the one hit-math verdict (`weaponUpgradeDelta` / `expectedStrike`) and explains it: dice, to-hit, per-swing numbers, and a lost kit proficiency when there is one. It shows on store weapon and armor rows as well as the loot screen and find card, and it is advice that never disables BUY. A Magic User holding a Quarter Staff can buy a Spiked Staff: gold is charged, the staff lands in the bag, and the line says why it isn't an upgrade (d8 vs d6, −1 to hit). Unit test. Store fixtures that move are measured, declared and regenerated. *(Reworded 2026-09-23 in the Phase 61 discuss: the todo's "proficiency" diagnosis was wrong; Magic User kits carry prof 0, and the Spiked Staff's `need: -1` makes the verdict true.)*

## Future Requirements

- **Hero tab redo** — no mock yet; the Hero tab keeps its current layout.
- **Mock-only item powers** — the mock gives a thrown hatchet, rope, picks and a Cloak of Regeneration USE powers with square cooldowns. Those are content changes, so they are not taken from a UX mock.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Scrolls occupying bag slots (mock rule 06) | Shipped rule is canon: potions and scrolls ride free |
| The mock's toast strip above the nav | Standing UI ruling: the rail is the one feedback surface on every tab |
| Changing the bottom nav tabs (mock shows MAP/HERO/GEAR/ORACLE/DEAD) | The shipped tab set stays; this milestone is the Gear tab only |
| The mock's "+10 SQ / walk the dungeon" rules panel | Demo scaffolding in the mock, not part of the screen |
| Backlog 999.5 / 999.6 / 999.7 / 999.8 and the other open todos | Not gear-screen work; they stay in the backlog |
| The four open Pixel 7 UAT batches (v1.5–v1.8) | User runs them over their own play sessions |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| GSCR-01 | Phase 62 | Pending |
| GSCR-02 | Phase 62 | Pending |
| GSCR-03 | Phase 62 | Pending |
| GSCR-04 | Phase 62 | Pending |
| GSCR-05 | Phase 62 | Pending |
| GSCR-06 | Phase 62 | Pending |
| GSCR-07 | Phase 63 | Pending |
| GSCR-08 | Phase 63 | Pending |
| GSCR-09 | Phase 63 | Pending |
| GSCR-10 | Phase 63 | Pending |
| GSCR-11 | Phase 62 | Pending |
| GSCR-12 | Phase 64 | Pending |
| GRULE-01 | Phase 61 | Complete |
| GRULE-02 | Phase 63 | Pending |
| STORE-02 | Phase 61 | Complete |
| STORE-03 | Phase 61 | Complete |

**Coverage:** 16 requirements, 16 mapped (Phases 61–64) ✓

---
*Requirements defined: 2026-09-23*
