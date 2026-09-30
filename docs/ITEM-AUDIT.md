# Item audit (ITEM-01, ITEM-06)

**Phase:** 89-item-audit-fixes (plan 89-01)
**Date:** 2026-09-30
**Status:** audit written; the balance calls below are waiting on the user's one batched ruling (Phase 89 plan 89-01, Task 2).

Every item in the game has one row: what its text promises, what the engine does, what canon says, and a verdict. A mismatch is never waved through: it is fixed by a named plan, or it is a recorded ruling, or it is a balance call waiting on the user. Nothing in this plan changes engine, content or shell code; the fix plans (89-02 to 89-10) do that.

## How to read this table

**Text** is what the player reads: the content row text, plus the stat lines `src/browser/viewModels.js#itemStatLines` prints on the Gear tab, the store, and the loot and find cards (the dice label, AR and hp, charges, the wield line), plus the Gear tab's consumable copy (`src/browser/gearTab.js#GEAR_COPY`). Where a row has no text of its own (a weapon, an armour), the Text cell holds the stat line the player actually sees.

**Engine** names the file and function that runs the item and what it does in numbers (duration, cooldown, charges, recharge, dice, who it reaches, resists, depth limits).

**Canon** cites the rulebook (`mazeworld.pdf`, printed page) and the frozen prototype (`test/parity/prototype-master.js.txt`, line, read only). The user's rulings override both, and the Canon cell names the ruling when it does.

**Default fix direction:** the engine does what the item text promises (the text is the promise to the player), unless the text is a typo or the user ruled otherwise. A wording-only fix is the text's; a fix that moves balance materially (a number that changes a lot, a reach that widens, a limit that goes away, an item that gets weaker) is a balance call and goes to the user before it is built.

**Verdict vocabulary** (the coverage test accepts exactly these):

- `match` — text, engine and canon (as overridden by rulings) agree.
- `ruled (YYYY-MM-DD)` — canon differs from text and engine, and a recorded user ruling of that date settles it; nothing to fix.
- `fix engine (89-NN)` — the engine is wrong; plan 89-NN builds the fix.
- `fix text (89-NN)` — the wording is wrong, missing or not plain language (TEXT-01); plan 89-NN rewrites it.
- `balance call (Qn)` — the fix moves balance; question Qn in the Balance calls section is waiting on the user.
- `ruled (Qn, 2026-09-30) -> 89-NN` — a balance call the user has ruled, with the plan that builds the ruling.
- `not in game` — canon has it, the game does not, and new content is out of scope.
- `fixed engine (89-NN)` and `fixed text (89-NN)` — the fix landed and is pinned (plan 89-10 turns the fix verdicts into these).

`Pinned by` names the test that holds the row today; `—` means no test pins this row's numbers yet (the owner plan adds one, finally 89-10's text-vs-engine guard).

**Plan owners** in the Verdict column: 89-02 Enlarge; 89-03 Poplar Staff party heal and the Pendant source link; 89-04 Joiner armour soak; 89-05 Joiner item use (wear-on-join, the use path, item timers on a Joiner); 89-06 Joiner combat item policy and Joiner item chips; 89-07 the Company panel USE and the bot; 89-08 every other engine fix; 89-09 TEXT-01 wording for every item row; 89-10 the text-vs-engine guard and the audit close.

**Two facts the rows lean on.** A duration item with a cooldown runs its effect first and then its cooldown, so "ready again" is effect plus cooldown squares after the use (`engine/effects.js#startEffect`, #isReady). And the party is the hero plus at most one Joiner (`PARTY_CAP` is 1), and a fight holds at most three foes (`engine/difficulty.js#FOE_COUNT_TABLE`).

## Rows

Families appear in a fixed order and rows follow their content table's order (WEAPONS key order, ARMORS, CLOAKS, JEWELRY, STAVES, POTIONS, TOOL_ORDER, BAG_ORDER); `test/unit/item-audit.test.js` pins that order.

### Weapons

Content: `content/weapons.js` (24 rows; `need` is the to-hit modifier, `crit` the top faces that double). Engine: `engine/derived.js#weaponDamageTerms` and `#toHit`. The Gear sheet and the store row print the dice label only (`itemStatLines`); a weapon's own to-hit and crit range are stated only by the loot and store "why" comparison line, relative to the weapon you hold (`src/browser/upgradeWhy.js`, for example "−2 to hit, worse than your Club"), never on the weapon itself. The user ruled on 2026-09-30 that the heavy-weapon "−1 to hit" (−2 for the Bardiche) and the light-weapon "+1" stay: under roll-high that is the correct reading. The rows below keep that ruling in the Canon cell and ask only that the item says it (89-09).

| Item | Text | Engine | Canon | Verdict | Pinned by |
|---|---|---|---|---|---|
| Axe | Label "d6" on the Gear sheet and the store row, price 50 | dice d6, to-hit 0, crit top 1 face, price 50, classes FTM | rulebook p.44 and prototype L74: d6, 50 | match | test/unit/gear-axes.test.js |
| Bastard Sword | Label "2d8+1" on the Gear sheet and the store row, price 650 | dice 2d8+1, to-hit −1, crit top 1 face, price 650, classes F | rulebook p.44 and prototype L75: 2d6, 675; changed by GEAR-01 (user, 2026-09-18, docs/GEAR-BALANCE.md); to-hit −1 is not stated on the item (user 2026-09-30: heavy-weapon to-hit stays, correct under roll-high) | fix text (89-09) | test/unit/gear-axes.test.js |
| Battle Axe | Label "2d6+1" on the Gear sheet and the store row, price 325 | dice 2d6+1, to-hit −1, crit top 1 face, price 325, classes F | rulebook p.44 and prototype L76: d6+1, 250; changed by GEAR-01 (user, 2026-09-18, docs/GEAR-BALANCE.md); to-hit −1 is not stated on the item (user 2026-09-30: heavy-weapon to-hit stays, correct under roll-high) | fix text (89-09) | test/unit/gear-axes.test.js |
| Broadsword | Label "d10+2" on the Gear sheet and the store row, price 550 | dice d10+2, to-hit 0, crit top 1 face, price 550, classes F | rulebook p.44 and prototype L77: d10+2, 500; changed by GEAR-01 (user, 2026-09-18, docs/GEAR-BALANCE.md) | ruled (2026-09-18) | test/unit/gear-axes.test.js |
| Claymore | Label "d12+2" on the Gear sheet and the store row, price 800 | dice d12+2, to-hit 0, crit top 1 face, price 800, classes F | rulebook p.44 and prototype L78: d12, 800; changed by GEAR-01 (user, 2026-09-18, docs/GEAR-BALANCE.md) | ruled (2026-09-18) | test/unit/gear-axes.test.js |
| Dagger | Label "d6/2" on the Gear sheet and the store row, price 75 | dice d6/2, to-hit +1, crit top 2 faces, price 75, classes FTM | rulebook p.44 and prototype L79: d6/2, 75; to-hit +1 is not stated on the item (user 2026-09-30: light-weapon to-hit stays, correct under roll-high); crit on the top two faces is not stated on the item | fix text (89-09) | test/unit/gear-axes.test.js |
| Katana | Label "d10+1" on the Gear sheet and the store row, price 650 | dice d10+1, to-hit +1, crit top 2 faces, price 650, classes FT | rulebook p.44 and prototype L80: d10, 525; changed by GEAR-01 (user, 2026-09-18, docs/GEAR-BALANCE.md); to-hit +1 is not stated on the item (user 2026-09-30: light-weapon to-hit stays, correct under roll-high); crit on the top two faces is not stated on the item | fix text (89-09) | test/unit/gear-axes.test.js |
| Kopesh Sword | Label "d12+3" on the Gear sheet and the store row, price 500 | dice d12+3, to-hit −1, crit top 1 face, price 500, classes F | rulebook p.44 and prototype L81: d10, 525; changed by GEAR-01 (user, 2026-09-18, docs/GEAR-BALANCE.md); to-hit −1 is not stated on the item (user 2026-09-30: heavy-weapon to-hit stays, correct under roll-high) | fix text (89-09) | test/unit/gear-axes.test.js |
| Long Sword | Label "d8+2" on the Gear sheet and the store row, price 400 | dice d8+2, to-hit 0, crit top 1 face, price 400, classes FT | rulebook p.44 and prototype L82: d8, 500; changed by GEAR-01 (user, 2026-09-18, docs/GEAR-BALANCE.md) | ruled (2026-09-18) | test/unit/gear-axes.test.js |
| Ninja-to | Label "d8+1" on the Gear sheet and the store row, price 475 | dice d8+1, to-hit +1, crit top 2 faces, price 475, classes FT | rulebook p.44 and prototype L83: d8+1, 450; changed by GEAR-01 (user, 2026-09-18, docs/GEAR-BALANCE.md); to-hit +1 is not stated on the item (user 2026-09-30: light-weapon to-hit stays, correct under roll-high); crit on the top two faces is not stated on the item | fix text (89-09) | test/unit/gear-axes.test.js |
| Rapier | Label "d6" on the Gear sheet and the store row, price 200 | dice d6, to-hit +1, crit top 2 faces, price 200, classes FTM | rulebook p.44 and prototype L84: d6, 200; to-hit +1 is not stated on the item (user 2026-09-30: light-weapon to-hit stays, correct under roll-high); crit on the top two faces is not stated on the item | fix text (89-09) | test/unit/gear-axes.test.js |
| Short Sword | Label "d6+2" on the Gear sheet and the store row, price 250 | dice d6+2, to-hit 0, crit top 1 face, price 250, classes FTM | rulebook p.44 and prototype L85: d6+1, 250; changed by GEAR-01 (user, 2026-09-18, docs/GEAR-BALANCE.md) | ruled (2026-09-18) | test/unit/gear-axes.test.js |
| Wakazashi | Label "d6+1" on the Gear sheet and the store row, price 350 | dice d6+1, to-hit +1, crit top 2 faces, price 350, classes FT | rulebook p.44 and prototype L86: d6+1, 300; changed by GEAR-01 (user, 2026-09-18, docs/GEAR-BALANCE.md); to-hit +1 is not stated on the item (user 2026-09-30: light-weapon to-hit stays, correct under roll-high); crit on the top two faces is not stated on the item | fix text (89-09) | test/unit/gear-axes.test.js |
| Club | Label "d6" on the Gear sheet and the store row, price 25 | dice d6, to-hit 0, crit top 1 face, price 25, classes FTM | rulebook p.44 and prototype L88: d6, 25 | match | test/unit/gear-axes.test.js |
| Flail | Label "d10+2" on the Gear sheet and the store row, price 250 | dice d10+2, to-hit −1, crit top 1 face, price 250, classes FT | rulebook p.44 and prototype L89: d8+2, 175; changed by GEAR-01 (user, 2026-09-18, docs/GEAR-BALANCE.md); to-hit −1 is not stated on the item (user 2026-09-30: heavy-weapon to-hit stays, correct under roll-high) | fix text (89-09) | test/unit/gear-axes.test.js |
| Mace | Label "d8+1" on the Gear sheet and the store row, price 125 | dice d8+1, to-hit −1, crit top 1 face, price 125, classes FT | rulebook p.44 and prototype L90: d6+2, 125; changed by GEAR-01 (user, 2026-09-18, docs/GEAR-BALANCE.md); to-hit −1 is not stated on the item (user 2026-09-30: heavy-weapon to-hit stays, correct under roll-high) | fix text (89-09) | test/unit/gear-axes.test.js |
| Morning Star | Label "d8+2" on the Gear sheet and the store row, price 175 | dice d8+2, to-hit −1, crit top 1 face, price 175, classes FT | rulebook p.44 and prototype L91: d8+1, 150; changed by GEAR-01 (user, 2026-09-18, docs/GEAR-BALANCE.md); to-hit −1 is not stated on the item (user 2026-09-30: heavy-weapon to-hit stays, correct under roll-high) | fix text (89-09) | test/unit/gear-axes.test.js |
| Quarter Staff | Label "d6" on the Gear sheet and the store row, price 25 | dice d6, to-hit 0, crit top 1 face, price 25, classes FTM | rulebook p.44 and prototype L92: d6, 25 | match | test/unit/gear-axes.test.js |
| Spiked Staff | Label "d8" on the Gear sheet and the store row, price 100 | dice d8, to-hit −1, crit top 1 face, price 100, classes FTM | rulebook p.44 and prototype L93: d8, 150; changed by GEAR-01 (user, 2026-09-18, docs/GEAR-BALANCE.md); to-hit −1 is not stated on the item (user 2026-09-30: heavy-weapon to-hit stays, correct under roll-high) | fix text (89-09) | test/unit/gear-axes.test.js |
| Whip | Label "d6/2" on the Gear sheet and the store row, price 35 | dice d6/2, to-hit +1, crit top 1 face, price 35, classes FT | rulebook p.44 and prototype L94: d6/2, 35; to-hit +1 is not stated on the item (user 2026-09-30: light-weapon to-hit stays, correct under roll-high) | fix text (89-09) | test/unit/gear-axes.test.js |
| Awl Pike | Label "2d6+2" on the Gear sheet and the store row, price 400 | dice 2d6+2, to-hit −1, crit top 1 face, price 400, classes FT | rulebook p.44 and prototype L96: d8+2, 400; changed by GEAR-01 (user, 2026-09-18, docs/GEAR-BALANCE.md); to-hit −1 is not stated on the item (user 2026-09-30: heavy-weapon to-hit stays, correct under roll-high) | fix text (89-09) | test/unit/gear-axes.test.js |
| Bardiche | Label "2d10+2" on the Gear sheet and the store row, price 900 | dice 2d10+2, to-hit −2, crit top 1 face, price 900, classes F | rulebook p.44 and prototype L97: 2d8, 900; changed by GEAR-01 (user, 2026-09-18, docs/GEAR-BALANCE.md); to-hit −2 is not stated on the item (user 2026-09-30: heavy-weapon to-hit stays, correct under roll-high) | fix text (89-09) | test/unit/gear-axes.test.js |
| Naganita | Label "2d8+2" on the Gear sheet and the store row, price 750 | dice 2d8+2, to-hit −1, crit top 1 face, price 750, classes F | rulebook p.44 and prototype L98: 2d6+1, 600; changed by GEAR-01 (user, 2026-09-18, docs/GEAR-BALANCE.md); to-hit −1 is not stated on the item (user 2026-09-30: heavy-weapon to-hit stays, correct under roll-high) | fix text (89-09) | test/unit/gear-axes.test.js |
| Spear | Label "d8" on the Gear sheet and the store row, price 150 | dice d8, to-hit 0, crit top 1 face, price 150, classes FTM | rulebook p.44 and prototype L99: d8, 150 | match | test/unit/gear-axes.test.js |

### Magic weapons

| Item | Text | Engine | Canon | Verdict | Pinned by |
|---|---|---|---|---|---|
| Magic weapon (named blade) | Name like "Whisper, a rapier"; the find, loot and store line "{label} +{n}"; the Gear sheet adds an Enchantment line; Gear copy "+{n} damage, and it hits what only magic can." | `engine/items.js#rollBlade`: a uniform pick of the 24 weapons, then the bonus table on a d6: +d6, +2, +1, +1, +4, +d10 (`content/misc-tables.js#WEAPON_BONUS_TABLE`). The bonus is `c.magicWpn`: it adds to damage (`weaponDamageTerms`) and lets the blade touch magic-only foes (`engine/combat.js` L2376); it never changes to-hit. The store's premium line re-derives the bonus by store tier (`engine/economy.js#enchantForTier`) | rulebook p.48 Magical Weapons and prototype L1461: the same table and bonus d6. The rulebook's weapon-type d6 (Thrown, Explosive) is not in the game and the prototype skips it too | match | test/unit/gear-axes.test.js |

### Armour

Content: `content/armors.js`. A landed blow rolls a d20 against the armour's AR (read roll-high); a soaked blow wears the armour down while its hp stays above `min`, and armour at 0 hp is destroyed and cannot be repaired (`engine/combat.js` soak block, `engine/derived.js#armorSoak`). `bulk` adds to the climb and leap rolls and subtracts from the flee roll (`engine/movement.js`, `engine/combat.js#flee`); it was added by GEAR-01 (user, 2026-09-18, docs/GEAR-BALANCE.md). No surface prints `bulk` (nothing under `src/` names it), so the heavier armours hide a real cost. The rulebook's sixth armour, the Shield (p.44), is in neither the prototype nor the game: not built, out of scope as new content.

| Item | Text | Engine | Canon | Verdict | Pinned by |
|---|---|---|---|---|---|
| Cloth | Store line "AR 3, 12 hp"; Gear sheet "AR 3" and "12/12 hp" | AR 3, 12 hp, min 1, bulk 0, cost 300, any class | rulebook p.44 and prototype L111: 300, 12 hp, AR 3, any class, min 1 | match | test/unit/armor-durability.test.js |
| Leather | Store line "AR 6, 15 hp"; Gear sheet "AR 6" and "15/15 hp" | AR 6, 15 hp, min 1, bulk 0, cost 500, Fighter and Thief | rulebook p.44 and prototype L112: 500, 15 hp, AR 6, F and T, min 1 | match | test/unit/armor-durability.test.js |
| Studded | Store line "AR 10, 18 hp"; Gear sheet "AR 10" and "18/18 hp"; the agility cost is not printed | AR 10, 18 hp, min 2, bulk 1 (+1 on climb and leap rolls, −1 on the flee roll), cost 750, Fighter and Thief | rulebook p.44 and prototype L113: 750, 18 hp, AR 10, F and T, min 2; bulk is GEAR-01 (user, 2026-09-18) | fix text (89-09) | test/unit/gear-axes.test.js |
| Mail | Store line "AR 12, 30 hp"; Gear sheet "AR 12" and "30/30 hp"; the agility cost is not printed | AR 12, 30 hp, min 3, bulk 1 (+1 on climb and leap rolls, −1 on the flee roll), cost 1000, Fighter only (a Thief with Heft may wear AR 12 or less) | rulebook p.44 and prototype L114: 1000, 30 hp, AR 12, F, min 3; bulk is GEAR-01 (user, 2026-09-18) | fix text (89-09) | test/unit/gear-axes.test.js |
| Plate | Store line "AR 15, 45 hp"; Gear sheet "AR 15" and "45/45 hp"; the agility cost is not printed | AR 15, 45 hp, min 4, bulk 2 (+2 on climb and leap rolls, −2 on the flee roll), cost 2000, Fighter only | rulebook p.44 and prototype L115: 2000, 45 hp, AR 15, F, min 4; bulk is GEAR-01 (user, 2026-09-18) | fix text (89-09) | test/unit/gear-axes.test.js |

### Magic armour

| Item | Text | Engine | Canon | Verdict | Pinned by |
|---|---|---|---|---|---|
| Magic armour (warded piece) | "Warded {armour}", "AR {n}, {hp} hp"; the Gear sheet adds an Enchantment line when AR or hp beat the base armour | `engine/items.js#rollMailPiece`: a uniform pick of the five armours, then the bonus table on a d6 (`content/armors.js#MAGIC_ARMOR_TABLE`): +4 AR and +30 hp, +2 and +20, +1 and +10 twice, +2 and +15, +1 and +5. Class, minimum and Fridgian gates apply when it is taken. The store's premium line re-derives the bonus by store tier | rulebook p.48 Magic Armor Table and prototype L117: the same six rows | match | test/unit/items.test.js |

### Cloaks

Content: `content/treasure-tables.js#CLOAKS` (7 rows; the rulebook's Cloak of Healing was removed by the user on 2026-09-18). Every cloak is use-activated and must be worn to work (user, 2026-09-18): the rulebook's and the prototype's always-on cloaks became an effect window plus a cooldown, and the once-a-day rule keeps `effect + cooldown` within 100 squares.

| Item | Text | Engine | Canon | Verdict | Pinned by |
|---|---|---|---|---|---|
| Cloak of Strength | "used, no critical damage lands on you for fifty squares; then fifty squares of ordinary luck" | `critWard` effect 50 squares then a 50-square cooldown (ready 100 after the use); while live `engine/derived.js#critWardOf` turns a foe's critical into an ordinary hit on the hero and on a Joiner's own sheet; the wearer's own crits are untouched | rulebook p.46 (Strength, garbled: the wearer crits on successful attacks, in self defence only) and prototype L203 (no critical damage ever lands on you, always on). Use-activated 50 and 50 (user, 2026-09-18); the payload is `critWard` not `noCrit` (user-approved fix, 2026-09-28) | ruled (2026-09-28) | test/unit/cloak-crit-ward.test.js |
| Cloak of Invisibility | "invisible for 50 squares, once every 100: foes hit only on their die's top face (the top two faces if you insulted them)" | `invis` effect 50 then cooldown 50 (ready 100 after the use); while live `derived.js#foeToHitVs` gives the foe one winning face against the wearer only (+1 face if the foes are insulted, `foeSwingChain`) | rulebook p.46: invisible once every 100 squares, as the Invisibility spell; prototype L204 | fix text (89-09) | test/unit/authored-ranges.test.js |
| Cloak of Speed | "double attacks, once every 50 squares" | `haste` effect 50 then cooldown 50: ready 100 squares after the use, not 50; while live the hero swings twice a round. The once-a-day model (user, 2026-09-18) made the window and the wait add up; the text kept the old sentence | rulebook p.46 and prototype L205: double attack rate, used once every 50 squares | fix text (89-09) | test/unit/item-activation.test.js |
| Cloak of Regeneration | "used, a d6 hp back every ten squares you walk, three times; then fifty squares before it will do it again" | `knit` effect 30 squares then cooldown 50; `engine/items.js#tickHealOverTime` heals a d6 at 10, 20 and 30 squares from a derived stream | rulebook p.46 and prototype L206: d6 back every 20 squares, always on. Replaced by the user's ruling of 2026-09-30 (ITEM-03, Phase 88): active 30 squares, d6 every 10, then 50 of cooldown | ruled (2026-09-30) | test/unit/heal-over-time.test.js |
| Cloak of Armor | "used, it soaks as plate (AR 15) for fifty squares over whatever you wear — any class, never wears out; then fifty squares of ordinary cloth" | `plate` effect 50 then cooldown 50; while live `derived.js#armorSoak` soaks as Plate (AR 15, 45 hp) taking the better of plate and the worn armour, and charges no wear (`magic: true`) | rulebook p.46 and prototype L207: a full suit of plate that weighs nothing, always on. Use-activated 50 and 50 (user, 2026-09-18) | ruled (2026-09-18) | test/unit/armor-durability.test.js |
| Cloak of Flying | "flight for 20 squares, once every 50" | `fly` effect 20 then cooldown 50: ready 70 squares after the use, not 50; `derived.js#isFlying` reads the live effect, and only a use while worn starts it | rulebook p.46: flight for up to 20 squares, used every 50 squares of movement "not counting movement used while the cloak is active", which is the engine's 20 then 50. Prototype L208 carries the looser sentence | fix text (89-09) | test/unit/item-activation.test.js |
| Cloak of Ether | "walk through walls, once every 100 squares" | `ether` effect 10 squares then cooldown 80 (ready 90 after the use); while live walls can be walked, and when the window ends inside a wall the hero dies (`engine/movement.js#resolveEtherEnd`); the text states neither the ten squares nor the entombment | rulebook p.46: ghost form for up to 20 squares, once every 100, no attacks and no damage while in it; prototype L209: 20 squares, nothing said of damage. Window cut to 10 and the death in a wall (user, 2026-09-19, quick 260919-00d) | fix text (89-09) | test/unit/ether-wallwalk.test.js |

### Jewellery

Content: `content/treasure-tables.js#JEWELRY` (8 rows, two may be worn). Like the cloaks every piece is use-activated and worn to work (user, 2026-09-18).

| Item | Text | Engine | Canon | Verdict | Pinned by |
|---|---|---|---|---|---|
| Ring of Power | "used, it adds +1 damage to every attack for fifty squares; then fifty squares of quiet" | `power` effect 50 then cooldown 50; while live `weaponDamageTerms` adds +1 (`eff(c, "dmg")`) | rulebook p.47 and prototype L192: +1 damage to all attacks, always on. Use-activated (user, 2026-09-18) | ruled (2026-09-18) | test/unit/authored-ranges.test.js |
| Gauntlet of the Giant | "used, you are one size larger for fifty squares: +2 damage, and one face easier for foes to hit; then fifty squares before it will do it again" | `giant` effect 50 then cooldown 50, one size step: +2 damage (`SIZE_DAMAGE_PER_STEP`) and foes +1 winning face (`SIZE_FACES_PER_STEP`), `engine/derived.js`. The numbers match; the "faces" wording is not plain language | rulebook p.47 and prototype L193: one size larger, always on. Use-activated (user, 2026-09-18); TEXT-01 (user, 2026-09-30) | fix text (89-09) | test/unit/size-items.test.js |
| Amulet of Light | "used, it lights fifty squares and tells the dark to leave at once; then it sulks for fifty" | `glow` effect 50 then cooldown 50; using it clears `c.darkFor` at once (`engine/items.js#useItem`), and while live `derived.js#darkWaiver` reports a light and the reveal radius is +1 | rulebook p.47 and prototype L194: a standing light spell that dispels darkness, always on. Use-activated (user, 2026-09-18) | ruled (2026-09-18) | test/unit/dark-waiver.test.js |
| Pendant of Fortitude | "half damage from one attack, once every 100 squares" | `half` sets `c.halfNext` on the character (`engine/items.js` L1792); `engine/combat.js` L2779 halves the next landed blow once (rounded up) and clears it; the 100-square cooldown starts at once. The flag belongs to the character, not the pendant: taking the pendant off leaves it armed, and Phase 88's source link does not cover it | rulebook p.47: "while activated the user will only take half damage from any form of attack", used once every 100 squares; prototype L195: half damage from one attack. User, 2026-09-30: keep the one blow, disarm it when the pendant comes off, add it to the source link, leave the use spent | fix engine (89-03) | test/unit/item-activation.test.js |
| Anklet of Invisibility | "used, for fifty squares every foe has two fewer faces that hit you; then fifty squares back in plain sight" | `unseen` effect 50 then cooldown 50; while live `derived.js#foeToHitVs` takes 2 winning faces off the foe's need against the wearer (floor 1). The numbers match; the "faces" wording is not plain language | rulebook p.47: "functions just like the cloak of invisibility"; prototype L196: foes need two better to land, which is what the engine does and the kept canon. TEXT-01 (user, 2026-09-30) | fix text (89-09) | test/unit/authored-ranges.test.js |
| Helm of Knowledge | "used, you understand them perfectly for fifty squares; then fifty squares of forgetting again" | `tongue` effect 50 then cooldown 50; while live `derived.js#fluency` is 1, which opens a parley with Humans, Demons, Beasts and Lair Beasts and adds +2 to the parley roll (`engine/combat.js#canParley`, #parley). Nothing in the game reaches fluency 2, so Magical foes stay closed | rulebook p.47 and prototype L197: perfect fluency in one language. TEXT-01 (user, 2026-09-30): say it lets you always parley, and say what a parley is | fix text (89-09) | test/unit/fluency.test.js |
| Bracelet of Flight | "used, twenty squares of flight when you ask; fifty to catch its breath" | `fly` effect 20 then cooldown 50, the same record as the Cloak of Flying but its own timer; `derived.js#isFlying` reads the live effect | rulebook p.47: as the Cloak of Flying; prototype L198: flight, always on. Use-activated (user, 2026-09-18) | ruled (2026-09-18) | test/unit/hazard-decision.test.js |
| Amulet of Stone | "turns up to 4 squares of opponents to stone, once every 100 squares; past floor 12, the stone wears off in three rounds" | `stone` with `aoe: 4`, cooldown 100 (effect 0): the first four live foes each roll an intelligence resist (`foeResistsSpell`); past floor 12 each also rolls a control resist (1 face of 20 per floor past 12, capped at 15) and a landed stone is a three-round hold, not a kill (`engine/difficulty.js#controlHoldRoundsFor`); at or below floor 12 a landed stone kills. The text omits the resist and says "squares" for foes (a fight holds at most three) | rulebook p.47: up to 4 squares of opponents, once every 200 squares; prototype L199: 200. Once every 100 (user, 2026-09-18, once-a-day); the floor-12 limit is RULES-18 (user, 2026-09-25); "squares of opponents" wording is TEXT-01 (user, 2026-09-30) | balance call (Q1) | test/unit/control-spells-depth.test.js |

### Staves

Content: `content/treasure-tables.js#STAVES` (8 rows). A staff is wielded by a Magic User as a flat d8 melee weapon and its power works only while wielded (RULES-13, user, 2026-09-25). Each has a charge pool that recharges one charge per recharge time (`engine/items.js#applyActivation`); the rulebook's single use "every 250" became charges and recharge under the once-a-day rule (user, 2026-09-18). The Gear sheet prints "n/max charges" and the wield line but no row's text states its recharge time, so every staff text is short of a number (89-09 adds it). "Squares" in a staff text means foes here: the engine takes the first live foes up to the count and ignores size (TEXT-01, user, 2026-09-30).

| Item | Text | Engine | Canon | Verdict | Pinned by |
|---|---|---|---|---|---|
| Rowan Staff | "a protective dome of 100 hp" | `dome` sets `c.ward` to a 100 hp pool: it absorbs blows on the hero before armour (`engine/combat.js` L2805), and ends when the pool is spent, after 99 rounds, or when the fight ends (L1836). Hero only; it does not stop the hero's own strikes. 2 charges, 100 squares each | rulebook p.46: dome of 100 wp, contains up to one square, no strikes from within; prototype L212: a plain 100 wp ward, which is the engine | fix text (89-09) | test/unit/staff-surfaces.test.js |
| Birch Staff | "freezes up to 2 squares of opponents for d4 rounds apiece, unless they resist; then they are just cold and angry" | `freeze`, `aoe` 2: the first two live foes go through `engine/combat.js#freezeFoe` (a d4 for the rounds, an intelligence resist, past floor 12 a control resist, then a hold for the d4's rounds). 2 charges, 100 squares each. The floor-12 resist is not in the text | rulebook p.46: freeze up to 2 squares indefinitely; prototype L213: asleep for 99. d4 rounds (user, 2026-09-28, Freeze); foes not squares (TEXT-01, user, 2026-09-30) | fix text (89-09) | test/unit/freeze-rule.test.js |
| Walnut Staff | "all hits on the weakened do double damage" | `weaken` runs a reduced Weaken on the room: every live foe rolls an intelligence resist, then one room resist; a landed weaken sets `combat.weakened`, which halves the foes' damage, for the fight (three rounds past floor 12). It doubles nothing of the hero's, and it does not set the Weaken spell's to-hit cap (`engine/magic.js` L290 sets `foeToHitPenalty` 3, the top three faces; `engine/items.js` L1867 does not) or its d4+1 rounds. 2 charges, 80 squares each | rulebook p.46: all hits do 2X on the affected; prototype L214 says the same and runs only the halving. User, 2026-09-30: text-only, the staff casts Weaken (the Weaken spell, `content/spells.js`, is half damage and foes hit only on their top three faces, d4+1 rounds) | balance call (Q6) | test/unit/control-at-depth.test.js |
| Oak Staff | "turns 2 squares of opponents to stone; past floor 12, the stone wears off in three rounds" | `stone`, default `aoe` 2: the first two live foes roll the intelligence resist; past floor 12 a control resist and a three-round hold instead of the kill; at or below floor 12 a landed stone kills. 1 charge, 100 squares. The text omits the resist | rulebook p.46: turn 2 squares of opponents to stone; prototype L215. Floor-12 limit is RULES-18 (user, 2026-09-25) | balance call (Q1) | test/unit/control-spells-depth.test.js |
| Crystal Staff | "party invisible d10+5 squares: foes hit only on their die's top face (the top two faces if you insulted them)" | `invis` with an effect of d10+5 squares rolled at use, 2 charges, 100 squares each; `derived.js#foeToHitVs` gives the hero one winning face and, through `PARTY_WIDE_ITEM_EFFECTS` (`["Crystal Staff"]`), a Joiner too; the effect ends when the staff leaves the hand (Phase 88 source link). Party reach matches the text and is pinned. The "faces" wording is not plain language | rulebook p.46: party invisible for 1d20+5 squares; prototype L216: d10+5, which the text and engine keep. TEXT-01 (user, 2026-09-30) | fix text (89-09) | test/unit/joiner-defences.test.js |
| Poplar Staff | "1d20+10 hp to up to 6" | `heal`: `engine/items.js#useItem` sends it down the Healing potion's branch, so it heals d10+2 to the hero only. 3 charges, 60 squares each | rulebook p.46: adds 1d20+10 WP to 1d6 individuals up to the maximum; prototype L217 prints the same and L1527 runs the d10+2 heal, so the gap is inherited. User, 2026-09-30: it heals every party member d20+10 each (the whole party, at most two), rolled from a derived stream | fix engine (89-03) | — |
| Pine Staff | "d6 fireballs, automatic hits, 1d10+4 each" | `fire`: a d6 fireball count spread round the live foes in turn (not chosen by the player); every live foe first rolls an intelligence resist and a resisted foe takes none (user, 2026-09-27); each fireball d10+4, halved when Afraid, and a foe's armour soaks item damage. 1 charge, 100 squares. The text says automatic and omits the resist | rulebook p.46: d6 fireballs, automatic hit, targets chosen by the magic user, 1d10+4 each; prototype L218 and L1544 run the same round-robin | fix text (89-09) | test/unit/spell-resist.test.js |
| Cedar Staff | "knocks out 3 squares of enemies for a day; past floor 12, a day is three rounds" | `gas`: every live foe (a fight holds at most three) rolls the intelligence resist, then past floor 12 a control resist; a landed gas sleeps the foe for the rest of the fight (99 rounds), and past floor 12 for three rounds (`controlCapRounds`). 1 charge, 100 squares. Reach is every foe, which is what "3 squares" comes to | rulebook p.46: gas knocks out 3 squares of enemies for 1 day; prototype L219 and L1545: every foe asleep for 99. Floor-12 limit is RULES-18 (user, 2026-09-25) | balance call (Q1) | test/unit/control-spells-depth.test.js |

### Wands

| Item | Text | Engine | Canon | Verdict | Pinned by |
|---|---|---|---|---|---|
| Wands (none in the game) | None: no content table, find card or surface names a wand | None: there is no wand kind, activation record, roll or store line | The rulebook's item tables (pp.44-48) hold no wand, the charged item there is the staff (p.46), and the prototype has none. REQUIREMENTS "Out of Scope": new content | not in game | — |

### Potions

Content: `content/potions.js#POTIONS` (10 rows, found on the Misc Magic d10 and sold in part by the store). A potion item is built field by field, found as "{name} potion ({colour})" and sold as "{name} potion"; both resolve to the same activation through `engine/derived.js#activationKeyFor` (the `eff2` key), so the store and find variants behave the same and share one row. Prices match the rulebook (p.47) on every row. The rulebook says potions cannot be bought; the prototype's store sells four (L1560) and the game sells up to nine (`content/store-stock.js#STORE_POTION_POOL`, never Death). Potions are not worn, so a bagged potion is always usable.

| Item | Text | Engine | Canon | Verdict | Pinned by |
|---|---|---|---|---|---|
| Healing potion (stock) | Gear consumables row "HEALING POTION": "Heals 7–25 hp (double for a Wilmsry). Stays corked at full health." | `engine/magic.js#drinkPotion`: the `c.potions` count, 2 × d10 + 5 hp (7 to 25), doubled for a `heal2x` race (Wilmsry). The shell disables the row at full hp (`gearTab.js`: hp below max); the engine action itself does not refuse. Not the same thing as the Healing potion item below | prototype L2225: the same formula and double; not in the rulebook tables | match | test/unit/gear-view-models.test.js |
| Healing | "+d10+2 hp"; found as "Healing potion (blue)", store line "Healing potion" at 150 | `useItem` case `heal`: d10 + 2 to the hero only; consumed | rulebook p.47 and prototype L222: +d10+2, 150 | match | test/unit/item-activation.test.js |
| Cure Poison | "cures poison"; found as "Cure Poison potion (green)", 100 | `useItem` case `poison` clears `c.affliction` whatever its kind, so it cures Disease too (afflictions are Poison or Disease, `content/afflictions.js`); drunk with nothing to cure it is spent anyway | rulebook p.47: cures poison; prototype L1529 runs one combined clear for both cures | balance call (Q5) | — |
| Speed | "double attacks, 50 squares"; found as "Speed potion (yellow)", 500 | `haste` effect 50 squares; the hero swings twice a round while it is live | rulebook p.47 and prototype L224: double attacks, 50 squares, 500 | match | test/unit/effect-expiry.test.js |
| Xtra Healing | "heal to maximum"; found as "Xtra Healing potion (blue)", 500 | `useItem` case `full`: hp to maximum | rulebook p.47 and prototype L225: heal to maximum, 500 | match | test/unit/item-activation.test.js |
| Strength | "+8 damage, 25 squares"; found as "Strength potion (red)", 100 | `might` effect 25 squares, +8 damage (`derived.js#potionMight`) | rulebook p.47 and prototype L226: +8 damage, 25 squares, 100 | match | test/unit/authored-ranges.test.js |
| Cure Disease | "cures disease"; found as "Cure Disease potion (aqua)", 100 | `useItem` case `disease` clears `c.affliction` whatever its kind, so it cures Poison too | rulebook p.47: cures disease; prototype L1530 (the one combined clear) | balance call (Q5) | — |
| Enlarge | "one size larger for fifty squares: +2 damage, and one face easier for foes to hit"; found as "Enlarge potion (brown)", price 75 | `enlarge` effect 50 squares, one size step: +2 damage and foes +1 winning face; consumed. Worth a third of a Strength potion's +8 | rulebook p.47: size 1 step and +4 damage; prototype L228: one size up, +4 damage. User, 2026-09-30 (ITEM-05, report #6): Troll-sized +11 damage total, foes +1 to hit, 50 squares, price 150 | fix engine (89-02) | test/unit/size-items.test.js |
| Acuteness | "strike on a d6 for d8 rounds"; found as "Acuteness potion (white)", 800 | `acute` effect d8 rounds rolled at use; while live `derived.js#strikeDie` is the d6 | rulebook p.47 and prototype L229: the strike roll on a d6 for d8 rounds, 800 | match | test/unit/effect-expiry.test.js |
| Death | "your dead!"; found as "Death potion (??)", 50 (never sold) | `useItem` case `death`: hp to 0 and the hero dies (`engine/death.js#die`) | rulebook p.47 and prototype L230 carry the same typo. User, 2026-09-30: "you're dead!" | fix text (89-09) | — |
| Invisible | "invisible for a day: foes hit you only on their die's top face (the top two faces if you insulted them)"; found as "Invisible potion (clear)", store line "Invisible potion", 250 | `invis` effect 100 squares (the prototype's day); while live `derived.js#foeToHitVs` gives the drinker one winning face (two if insulted); the drinker only, a Joiner is not covered. The "faces" wording is not plain language | rulebook p.47: 1 day, as the Invisibility spell; prototype L231. TEXT-01 (user, 2026-09-30) | fix text (89-09) | test/unit/item-activation.test.js |

### Scrolls and books

| Item | Text | Engine | Canon | Verdict | Pinned by |
|---|---|---|---|---|---|
| Scroll | Gear consumables row "SCROLLS": "A random spell, read aloud. No refunds." plus the reader's own odds line; the store sells a "Sealed scroll" (Magic Users, 900) | `engine/magic.js#readScroll`: a uniform spell of level up to min(5, depth + 1). A Magic User copies it into the grimoire if it is learnable and castable, else casts it free; a Runes/Signs holder casts it free; everyone else rolls a d20 against intelligence bands (read, garbled, or fumbled). Sources: a chest on d6 of 3 or more, two of the ten Misc Magic slots, the store | rulebook p.46: a scroll holds one spell, its level from a d10 table; prototype L2327: the same pool. Anyone may attempt a scroll (RULES-10, user, 2026-09-24/25), replacing the prototype's class gate | ruled (2026-09-25) | test/unit/scroll-read.test.js |
| Grimoire (find) | The find line: "A spell book. The marks mean nothing to you, but it will sell." or "Somebody else's book. You copy out {spells}." | `engine/encounters.js#findGrimoire`: a non-Magic User sells it for 150 wilmst; a Magic User copies d4 spells (at least 1) from those it can learn and be granted at its level | rulebook p.46: a grimoire holds d10 spells; prototype L1713 draws d4, which the engine keeps as canon | match | test/unit/items.test.js |

### Tools

Content: `content/tools.js` (Phase 39 GEAR-05; new to the game, user, 2026-09-18). One bag slot each, never stacks, consumed on use; the rope and ladder are spent through `engine/movement.js#useTool`, the torch through `useItem`.

| Item | Text | Engine | Canon | Verdict | Pinned by |
|---|---|---|---|---|---|
| Torch | "lights the dark once, and keeps it off for forty squares"; store 25 | `use: "light"`, activation `lit` for 40 squares: refused (and not spent) unless the hero is in the dark; clears `c.darkFor` and `derived.js#darkWaiver` reports a lit torch. Loot weight 4 | none: not in the rulebook or prototype; added by GEAR-05 (user, 2026-09-18) | ruled (2026-09-18) | test/unit/tools.test.js |
| Rope | "the honest way across a crevice. Once."; store 60 | `feat: "gorge"`: `useTool` spends it to cross a crevice tile, refused with no crevice ahead. Loot weight 3 | none: GEAR-05 (user, 2026-09-18) | ruled (2026-09-18) | test/unit/tools.test.js |
| Ladder | "one climbable wall, no climbing. Once."; store 150 from store tier 1 | `feat: "climb"`: `useTool` spends it on a climbable wall tile. Loot weight 1, only from depth 2 | none: GEAR-05 (user, 2026-09-18) | ruled (2026-09-18) | test/unit/tools.test.js |

### Lockpicks

| Item | Text | Engine | Canon | Verdict | Pinned by |
|---|---|---|---|---|---|
| Lockpicks | Find card "6–10 on d10 against any lock"; store line "Set of lockpicks": "opens boxes on 6–10", 450 | `engine/encounters.js#openChest`: a d10 lock roll; carrying picks adds one Locks tier, and the winning faces are [0, 5, 7, 8] by tier plus the Intelligence bonus, so picks alone give 5 faces (6–10) and a Thief with Locks does better. One set at a time | prototype L1475 and L1562: 1–5 on a d10 rolled under, the same five faces mirrored to roll-high (Phase 73, ROLL-05); not in the rulebook's item tables | match | test/unit/items.test.js |

### Bags

Content: `content/bags.js`. Each tier caps three things, not one: bag slots, wilmst carried and rations carried; `engine/derived.js#clampCarry` cuts carried wilmst and rations back to the cap and drops slot overflow. The item text states the slots only, so a hero carrying more wilmst than the bag holds is cut back to the cap, and no text says the cap exists. The upgrade bags are foe drops from their floor (medium 2, large 5, enormous 9) on the top three faces of a d20 (`engine/combat.js#killFoe`, `BAG_FLOORS`, `BAG_DROP_FACES`). The book's raw item column (1/2/3/4) was rescaled to 4/6/8/10 slots (Phase 12, ECON-01); no bag is in the rulebook's tables or the prototype.

| Item | Text | Engine | Canon | Verdict | Pinned by |
|---|---|---|---|---|---|
| Small bag (starting) | The Gear tab's bag meter and "BAG FULL" line state the slot count (4) | 4 slots, 2000 wilmst, 10 rations | none: Phase 12 ECON-01 design | fix text (89-09) | test/unit/bag-cap-gate.test.js |
| Medium bag | "6 slots. Room to regret more things." | 6 slots, 5000 wilmst, 20 rations | none: Phase 29 LOOT-05 design | fix text (89-09) | test/unit/bag-cap-gate.test.js |
| Large bag | "8 slots. Your spine has filed a complaint." | 8 slots, 8000 wilmst, 40 rations | none: Phase 29 LOOT-05 design | fix text (89-09) | test/unit/bag-cap-gate.test.js |
| Enormous bag | "10 slots. Technically luggage." | 10 slots, 10000 wilmst, 60 rations | none: Phase 29 LOOT-05 design | fix text (89-09) | test/unit/bag-cap-gate.test.js |

### Treasure

Every outcome of the treasure tables that gives the player something, in table order: the chest, the foe drop, the Misc Magic table (d10: Cloak, Potion, Scroll, Grimoire, Potion, Staff, Cloak, Jewelry, Potion, Scroll) and the Faerie table (d8). Item outcomes point at their family's rows above.

| Item | Text | Engine | Canon | Verdict | Pinned by |
|---|---|---|---|---|---|
| Chest: wilmst | The chest card's gold line (`goldGained`, why chest) | `engine/encounters.js#openChest`: (d10 + 6) × 100 × depth wilmst, scaled by the loot dials; a Pilfer opens any chest free | prototype L1657: the same formula; Smash-it-open (L1648) is a shell retry the engine does not carry | match | test/unit/items.test.js |
| Chest: sealed scroll | The `scrollFound` line | a d6 of 3 or more adds one scroll | prototype L1658: the same | match | test/unit/scroll-read.test.js |
| Chest: treasure roll | The find card: the item's name and its stat lines | `engine/items.js#rollTreasureItem`: lockpicks on a d12 of 1 when none are carried, a tool 1 time in 8 from a derived stream, else a d10: 1–3 magic weapon, 4–5 magic armour, 6–7 jewel, 8–9 cloak, 10 staff. A staff found by a non-Magic User is refused as a stick | prototype L1474: the same d10 table; the tool row is GEAR-05 (user, 2026-09-18) | ruled (2026-09-18) | test/unit/items.test.js |
| Foe drop: coin, treasure roll or a bigger bag | The loot pile: coin, then the item card | `engine/combat.js#killFoe`: coin d10 × level × purse; one d20 on the top (2 + level) faces offers a treasure roll, and past the bag floors the top three faces swap it for the next bag tier | prototype L2410: the coin and treasure draw; the bag swap is LOOT-05 (Phase 29) | ruled (2026-09-18) | test/unit/bag-cap-gate.test.js |
| Misc Magic: Cloak | The find card for a cloak | d7 over `CLOAKS` (`engine/encounters.js#findMisc`), offered not auto-taken (ECON-03) | rulebook p.47 and prototype L1737 (d8 before the healing cloak was dropped) | match | test/unit/items.test.js |
| Misc Magic: Potion | The find card for a potion | d10 over all ten `POTIONS`, Death included, named with its colour | rulebook p.47 and prototype L1734 | match | test/unit/items.test.js |
| Misc Magic: Scroll | The `scrollFound` line | `c.scrolls` goes up by one | prototype L1735 | match | test/unit/scroll-read.test.js |
| Misc Magic: Grimoire | The grimoire find line | `findGrimoire`, see the Grimoire row | prototype L1736 | match | test/unit/items.test.js |
| Misc Magic: Staff | The find card for a staff | `rollStaff`: d8 over `STAVES` with its charge pool | rulebook p.47 and prototype L1738 | match | test/unit/items.test.js |
| Misc Magic: Jewelry | The find card for jewellery | d8 over `JEWELRY` | rulebook p.47 and prototype L1739 | match | test/unit/items.test.js |
| Faerie: +1 Level | The faerie card: "+1 Level" | `engine/encounters.js#meetFaerie`: skill points raised to the next level threshold | rulebook p.48 and prototype L1746 | match | test/unit/items.test.js |
| Faerie: +d20 Base HP | The faerie card: "+d20 Base HP" | adds d20 to maximum and current hp | rulebook p.48 and prototype L1750 (the book's "WP" reads "HP" by the HP-not-WP ruling) | match | test/unit/items.test.js |
| Faerie: Magic Weapon | The faerie card, then the find card | a magic weapon roll, offered not auto-taken | rulebook p.48 and prototype L1752 | match | test/unit/items.test.js |
| Faerie: -d10 Base HP | The faerie card: "-d10 Base HP" | takes d10 off maximum hp (floor 5) and trims current hp to it | rulebook p.48 and prototype L1751 | match | test/unit/items.test.js |
| Faerie: Miscellaneous Magic | The faerie card, then the Misc Magic card | `findMisc`, see the Misc Magic rows | rulebook p.48 and prototype L1754 | match | test/unit/items.test.js |
| Faerie: d10 x 100 wilmst | The faerie card: "d10 x 100 wilmst" | d10 × 100 wilmst, scaled by the loot dials | rulebook p.48 and prototype L1755 | match | test/unit/items.test.js |
| Faerie: Magic Armor | The faerie card, then the find card | a magic armour roll, offered not auto-taken | rulebook p.48 and prototype L1753 | match | test/unit/items.test.js |
| Faerie: +2 Level | The faerie card: "+2 Level" | skill points raised two level thresholds | rulebook p.48 and prototype L1746 | match | test/unit/items.test.js |

## Systems (ITEM-06)

Every system the audit finds missing for an existing item to work as its text says. The Joiner systems exist because ITEM-07 (user, 2026-09-30) says "let joiners use items they have, and let their armor soak damage. Just like players." Today only the hero's `useItem` runs `applyActivation(state.c)`, a foe's hit on a Joiner subtracts the full damage (`engine/combat.js#foeTurn`'s member branch), and only the hero's `c.timers` tick on a step (`engine/movement.js#move`).

| System | Why the audit needs it | Verdict |
|---|---|---|
| Joiner item use | A Joiner carries potions, a cloak and a scroll (`engine/character.js#rollCharacter`) but no path uses them: drink at a third of its hp in combat, use a ready worn item in round 1, and a USE from the Company panel | fix engine (89-05, 89-06, 89-07) |
| Joiner armour soak | A foe's hit on a Joiner bypasses `armorSoak`, armour wear and breakage, which the hero's hits go through | fix engine (89-04) |
| Wear-on-join | A cloak in a Joiner's bag (the Thief's starting cloak) is never worn, and a worn slot is what makes an item work | fix engine (89-05) |
| Joiner item chips | `derived.js#memberConditionsOf` reports only duration abilities and Brace, so a Joiner's live item effects show no chip in YOUR LOT or the Company panel | fix engine (89-06, 89-07) |
| Joiner item timers and heal-over-time ticking | Only the hero's `c.timers` tick on a step (`engine/movement.js#move`), so a Joiner's item effect would never run down and a Joiner's Cloak of Regeneration would never heal | fix engine (89-05) |
| Joiner Cloak of Speed second swing | A Joiner using haste must swing twice; today `engine/combat.js#alliesTurn` knows no haste | fix engine (89-06) |
| Poplar party heal | The Poplar Staff must heal every party member d20+10, not the hero d10+2 | fix engine (89-03) |
| Pendant source link | The armed Pendant must end when the pendant comes off, like every other item effect (Phase 88's `endSourceEffects`) | fix engine (89-03) |
| Party-wide reach | The Crystal Staff's party invisibility already covers a Joiner (`PARTY_WIDE_ITEM_EFFECTS`, pinned by `test/unit/joiner-defences.test.js` and `test/unit/item-effect-source.test.js`); the Poplar Staff joins it, and the 89-10 guard pins that any item whose text says "party" has the reach | fix engine (89-03) |
| Joiner movement and sense items | The Cloak of Flying and Cloak of Ether (a Thief Joiner can start with either; 2 of the 7 cloaks), and by the same rule the Bracelet of Flight, Amulet of Light, Helm of Knowledge and Amulet of Stone (no Joiner can get jewellery today, GIVE is deferred), are effects of the one who leads the party | balance call (Q2) |
| Joiner scroll | A Magic User Joiner starts with `scrolls: 1` and nothing can read it | balance call (Q3) |
| Joiner armour repair | Once a Joiner's armour wears (89-04) it needs the repair a hero buys at a store | balance call (Q4) |

## Findings for other phases

- **Phase 91 (race text, IDENT-20 and friends):** the Wilmsry "heals twice as fast" applies to the stock healing potion only, not to item heals (the Healing potion, Xtra Healing, the Poplar Staff, the Cloak of Regeneration). A Joiner gets no Hardiness or Fridgian hide soak on its armour soak (IDENT-20).
- **Phase 91 (PARLEY-01):** the Helm of Knowledge's parley wording must follow the new parley rewards.
- **Phase 92 (store economy):** the Enlarge price may be retuned with the store economy. After ITEM-05 the Gauntlet of the Giant is the same one size step at +2 damage for 50 squares every 100, against the potion's +11: its balance is a tuning read, not an audit mismatch.
- **Phase 92 (bot pass):** `tools/lib/tuning-bot.mjs` reads a worn Cloak of Regeneration and a wielded staff's heal; once the Poplar Staff heals the whole party and a Joiner uses items, the bot's item reads need a check.

## Balance calls

Written for the user: each question has the rows it covers, the numbers, and a recommended answer to accept or change. No balance-moving fix is built until these are ruled.

### Q1 The "past floor 12" limits on the Amulet of Stone, Oak Staff and Cedar Staff

**Rows:** Amulet of Stone, Oak Staff, Cedar Staff. Also affected, silently: the Birch Staff's freeze (an extra resist past floor 12) and the Walnut Staff's weaken (lasts three rounds past floor 12); their texts do not say so.

**Today:** up to floor 12 a landed stone kills the foe and a landed gas sleeps it for the rest of the fight. From floor 13 each foe also rolls a control resist (1 face in 20 at floor 13, one more face per floor, up to 15 in 20 by floor 27), and a landed stone only holds the foe three rounds (it stays in the fight, skips its turns, is easier to hit) and a landed gas only sleeps it three rounds. The Phase 90 spell rulings removed the same cap from Petrify and Blind.

- **A (recommended): keep the limits and say them plainly** in every affected text (89-09). The CONTEXT "kept for now" line; fights past floor 12 are rare (the human average run ends on floor 5 to 7) and Phase 92 measures the balance once.
- **B: remove them on the three** (stone kills and gas sleeps the whole fight at any depth, no depth resist), as Petrify and Blind now do (engine change, 89-08; the Birch and Walnut limits stay and are stated).
- **B+: remove them on all five** (the Birch and Walnut too).

### Q2 What a Joiner's use does for an item whose effect belongs to the one leading the party

**Rows:** the Joiner movement and sense items system: Cloak of Flying and Cloak of Ether (a Thief Joiner starts with a random cloak, so 2 in 7 Thief Joiners carry one of them), and by the same rule the Bracelet of Flight, Amulet of Light, Helm of Knowledge and Amulet of Stone. No Joiner can get jewellery today (GIVE is deferred), so in practice Q2 decides the Thief Joiner's Cloak of Flying and Cloak of Ether.

- **A (recommended): a Joiner cannot use them, and the Company panel says why in one line.** Flight and walking through walls move the leader; a Joiner using the cloak could not carry the hero over the gorge, and a Joiner's Ether ending inside a wall would be the hero's death under B.
- **B: the Joiner's use covers the party:** the party flies, walks through stone, is lit, can always parley; the Amulet of Stone turns foes to stone on the Joiner's turn.

### Q3 The Magic User Joiner's starting scroll

**Rows:** the Joiner scroll system. `engine/character.js#rollCharacter` gives a Magic User Joiner `scrolls: 1` and no code reads it.

- **A (recommended): the Joiner reads it when it joins:** a spell it can learn at its level, rolled from a derived stream, goes into its spell book and the scroll is spent. One small extra spell, no new screen.
- **B: a Joiner's scroll is not an item it carries:** it is dropped at join and the join line says so.

### Q4 Joiner armour repair

**Rows:** the Joiner armour repair system. Once 89-04 makes a Joiner's armour soak and wear, it breaks like the hero's. The hero's repair is a tenth of the armour's cost per point at any store (for example Mail, cost 1000: 100 wilmst per point).

- **A (recommended): each store also offers a repair line for each Joiner's armour** on the same rule. The hero can already buy it, and a Joiner's armour that breaks for good would make the new soak a one-way loss.
- **B: Joiner armour is never repaired,** and the Company panel says so.

### Q5 Cure Poison and Cure Disease each cure both

**Rows:** the Cure Poison potion and the Cure Disease potion. The text says "cures poison" and "cures disease"; the engine clears whatever affliction you have, Poison or Disease (the prototype does the same). Both sell at 100 wilmst and both are in the store's potion pool from tier 0. Afflictions: four Poison, four Disease (two of them permanent phobias).

- **A (recommended): each potion cures only its own kind,** as the text says; drunk with the wrong affliction (or none) it is refused and kept, not spent (engine change, 89-08). The two potions keep one job each, and buying the right one matters.
- **B: text to engine:** both read "cures poison or disease" (two potions, one job).

### Q6 What the Walnut Staff does (you ruled its text; this checks the engine is what you meant)

**Row:** Walnut Staff. You ruled on 2026-09-30 that the change is text-only: the staff casts Weaken. The Weaken spell is "every foe, half damage, and foes hit only on their top three faces (18 to 20 on a d20), d4+1 rounds". The staff only does the half damage, for the whole fight (three rounds past floor 12); it never caps the foes' to-hit. The text today ("all hits on the weakened do double damage") is wrong either way.

- **A (recommended): text-only, as you ruled,** but the text says what the staff really does: every foe does half damage for the fight. No power change; the staff's wording stops claiming the spell's to-hit cap (89-09).
- **B: the staff casts the full Weaken:** foes also hit only on their top three faces (engine change, 89-08). The staff gets clearly stronger (2 charges, 80 squares each, lasting the fight), which Phase 92 would then have to measure.

## Rulings

(Filled after the user rules at the batched checkpoint, Task 3.)
