# Race and sub-class audit (IDENT-11, IDENT-12)

**Phase:** 91-race-sub-class-audit (plan 91-01)
**Date:** 2026-10-01
**Status:** inventory written. Q1 to Q7 were answered by the user on 2026-09-30, before this audit ran (91-CONTEXT "Checkpoint Q1-Q7 answered early"). The audit found one more balance call, Q8, which the user answered on 2026-10-01 (A, engine to text; see Balance calls and Rulings). No row reads `balance call` now. Plans 91-02 to 91-10 build the fixes and close the table.

Every race (6) and every sub-class (24) has one section, and every trait the player is told about, every trait the engine applies without telling, and every trait a Phase 91 plan will add has one row: what the player reads, what the engine does in numbers, what canon says, and a verdict. A mismatch is never waved through: it is fixed by a named plan, or it is a recorded ruling. The spell and skill twins of this table are `docs/SPELL-AUDIT.md` and `docs/SKILL-AUDIT.md`; the item twin is `docs/ITEM-AUDIT.md`.

## How to read this table

**Trait** is the stable entry id: an `IDENTITY_TRAITS` id (`content/identity.js`), a generated footer id (`chart-never`, `chart-gate-<school>`, `chart-bonus-<school>`, `chart-healmul`, `chart-override-<spell>`, `race-<field>`; `src/browser/identityFooter.js#identityEntries` lists them in order), `unstated:<name>` for an engine rule keyed on that race or sub-class that no trait states, or the id a later plan adds (rows for those exist before the plan that builds them, marked `ruled`). **Side** is good, bad or neutral.

**Text** is what the player reads: the footer line the Hero tab and the roller print (`identityFooter`), plus the `SUB_NOTE` / `RACE_NOTE` / `RACES.note` sentence that states it. A trait the text does not state says "not stated", never a blank. **Engine** names the file and function and the numbers it applies, and says who it reaches: the hero, and a Joiner (`engine/combat.js#memberStrike`, `#alliesTurn`, `#allyCast`, `#applyFoeDamageToMember`; `engine/derived.js#foeToHitVs` reads the Joiner's own body). **Canon** cites the rulebook (`mazeworld.pdf`, printed page) and the frozen prototype (`test/parity/prototype-master.js.txt`, line, read only); the user's rulings override both and the Canon cell names the ruling when it does. **Pinned by** is `—` until a fix plan pins its row: the owner plan writes `test/unit/<file>.test.js: <test title>` there. Read once and never edited: the prototype.

**Mismatch rule** (same as Phases 89 and 90): the engine follows the text unless the text is a typo or the user ruled otherwise; canon is the rulebook plus the prototype under the user's rulings. A fix that is wording only is `fix text`; an engine fix that does not move balance materially is `fix engine`; a fix that moves balance materially is a `balance call` and goes to the user in one batched checkpoint before any plan builds it.

**Verdict vocabulary** (the closed set `test/unit/identity-audit.test.js` accepts; a cell may join several with "; "):

- `match` — text, engine and canon (as overridden by rulings) agree.
- `fix engine (91-NN)` and `fix text (91-NN)` — a mismatch owned by plan 91-NN; the owner writes `fixed engine (91-NN)` or `fixed text (91-NN)` and fills Pinned by.
- `balance call (Qn)` — waits for the user's ruling on question Qn (see Balance calls); after the ruling it reads `ruled (Qn, date) -> 91-NN`.
- `ruled (2026-09-30) -> 91-NN` — the user ruled the row on 2026-09-30 (`.planning/notes/v2.3-user-rulings-2026-09-30.md`: IDENT-13 to IDENT-21, PARLEY-01 and the TEXT-01 wording); plan 91-NN builds it.
- `ruled (Qn, date) -> 91-NN` — a balance call the user ruled; plan 91-NN builds it; an optional ` - note` follows.
- `retire (91-NN)` — the trait goes away (the owner writes `retired (91-NN)` and the row stays as the record).

**Row-keeping rules for the fix plans.** A plan that states an `unstated:<name>` rule as a new trait renames that row's Trait cell to the new trait id. A plan that adds a trait nobody pre-registered adds its row. A plan that removes a trait writes `retired (91-NN)`. Rows inside a section follow `identityEntries` order (authored good then bad, then generated lines), then the unstated rows, then the pre-registered rows; `test/unit/identity-audit.test.js` pins that order, so adding a trait to `IDENTITY_TRAITS` fails it until the row is moved to its new place.

**Plan owners** (the phase's plan split): 91-02 the Wizard's day-one direct damage (IDENT-13), the Wizard's lost Illusion school and the Cleric's offense ban and Heal (IDENT-15); 91-03 the Illusionist's teleport pick, engine and bot, and its starting book; 91-04 its card, map highlight and map tap (IDENT-14); 91-05 the Master of Arms never leaving a fight (IDENT-16), parley rewards and the parley explanation (PARLEY-01); 91-06 the Bard's SING (IDENT-17, hero); 91-07 Joiner Bards singing (IDENT-17); 91-08 the Pickpocket's extra item (IDENT-18), the Cutthroat's d10 (IDENT-19), Troll prices and the Wilmsry wording (IDENT-21), the sell price of every race; 91-09 the Fridgian frenzy and hide (IDENT-20), the Joiner race-trait ruling and every other engine fix and Q ruling that changes the engine; 91-10 TEXT-01 wording for every identity row, every other text fix, the blurb guard and the audit close.

**Sources read** for every row: `content/identity.js`, `content/flavor.js` (`RACE_NOTE`, `CLASS_NOTE`, `SUB_NOTE`), `content/races.js`, `content/classes.js`, `content/mu-chart.js`, `content/spell-level-overrides.js`, `content/kit.js`; every engine hit of `grep -n 'sub === "\|race === "\|\.sub === \|\.race === ' engine/*.js`, each read whole; the rulebook pages 11 to 20 and 44; the prototype. The rows lean on four facts. (1) Initiative is rolled once per fight (`combat.js#fight`), so "never wins initiative" means the foes take the opening turn and then the usual cycle runs. (2) A Joiner is a full sheet that fights by class (user 2026-09-15): its defences read its own body (`foeToHitVs`), its strike reads its own class, race and sub-class numbers (`memberToHit`, `weaponDamage`, `strikeDie`), and the hero-only specials (a Barbarian's second attack, the Cat Burglar and Ninja free opener, the Cutthroat's crit, the Fridgian frenzy, the Soldier's crit exposure, the Apprentice's backfire) are not read for a Joiner. (3) A school bonus reaches the dice only through a thrown offense spell (to-hit faces) and, since Phase 90, through the stretch of the Special spells; the chart's bonuses on protection, healing, divination and illusion change nothing. (4) The store's race and Pickpocket price rules reach only the weapon, armour, premium, repair and ration lines (Q8).

## Races

Rows follow `RACES` key order (Human, Elven, Dwarven, Wilmsry, Fridgian, Troll).

### Human

| Trait | Side | Text | Engine | Canon | Verdict | Pinned by |
|---|---|---|---|---|---|---|
| human-neutral | neutral | footer "No advantages and no disadvantages: every other race is measured against this one."; `RACE_NOTE.Human` "No advantages, no penalties, no excuses ..." | `RACES.Human` is `{ size: Human, upkeep: 4 }`: no field the footer generator phrases differs from itself, so no modifier is read anywhere: class to-hit only, a level-1 foe swings a d20, store prices at the list, a night without rations costs 4 HP, one ration a night | rulebook p.11 Humans: no advantages, no penalties; prototype L279 | match | — |

### Elven

| Trait | Side | Text | Engine | Canon | Verdict | Pinned by |
|---|---|---|---|---|---|---|
| elven-prices | good | footer "store prices halved"; `RACE_NOTE.Elven` says nothing about prices | `economy.js#priceFor`: `round(base / 2)` on the weapon, armour, premium-piece, repair and ration lines of `openStore`; potions, food, lockpicks, the sealed scroll and the tools are flat for every race (Q8). `sellPriceFor` routes the same halving into what a store PAYS an Elf (half the ordinary sale price): Q5 ruled A, so after 91-08 every race is paid the ordinary price | rulebook p.44 armour-table footnote "Costs are triple for trolls, and half for elves or dwarves"; prototype L119 `priceFor` (weapon, armour, premium, repair lines only) | ruled (Q5, 2026-09-30) -> 91-08 - the halving stays a buying rule only; ruled (Q8, 2026-10-01) -> 91-08 - every stock line except the three tools takes the halving | — |
| elven-humans | good | footer "can always talk to Humans, with a bonus"; `RACE_NOTE.Elven` does not mention it | `combat.js#canParley`: an Elf may always parley a Humans foe; `parley()` adds +3 to the roll against Humans only (a good omen) | rulebook p.11 "Most humans treasure the sighting of an elf as a good omen"; prototype L2260 and L2267 | ruled (2026-09-30) -> 91-10 | — |
| race-size-dmg | bad | footer "being small costs 2 damage"; `RACE_NOTE.Elven` "Small costs you two points of damage and nothing else" | `derived.js#sizeAxisStep` and `SIZE_DAMAGE_PER_STEP`: Small is −2 damage; the face axis is masked for the Elf (`RACES.Elven.sizeAxes.face: false`) so being small does nothing else. A Joiner Elf pays it too (`weaponDamage` reads its own body) | the size rule is RULES-11 (Phase 75.2, user 2026-09-25); rulebook p.11 only says elves are Small | match | — |
| race-hp-mul | bad | footer "60% of the usual HP, at every level"; blurb "not much more than half a person's Hit Points" | `character.js#rollCharacter`: `round(maxWP × 0.6)`; `checkLevel`: each level-up gain × 0.6 | rulebook p.11 "only start with half of the allotted WP ... build up at half the rate"; prototype L280 `wpMul: 0.6` (the prototype's 0.6 is kept) | match | — |
| race-strike-step | good | footer "strikes on a die one size better (a d12 at level 1, not a d20)"; blurb "you strike a die better" | `derived.js#strikeDie`: level index + 1, capped at the d6; an Illusionist Elf still strikes a d20 below level 3 (the sub rule runs after) | rulebook p.11 "start at level one on a d12" | match | — |
| race-foe-to-hit | bad | footer "foes land on one face more against you"; blurb "thin-boned, easy to hit" | `derived.js#raceFoeToHit` through `foeToHitVs`: +1 winning face for the foe (5 to 6 of 20), the Elf's own size face axis masked; applies to a Joiner Elf | rulebook p.11 says foes need a 4 instead of a 5 (harder to hit); the game reads it as easier to hit by user decision 2026-09-16 (Phase 31 Finding 1); prototype L280 `foeToHit: -1` | fix text (91-10) | — |
| race-to-hit | good | footer "at least your top five faces hit, whatever the class"; blurb "your top five faces land whatever the class" | `derived.js#classNeed` and `memberToHit`: `max(class need, 5)`, a Joiner Elf too | rulebook p.11 "all classes need only a 5 to hit"; prototype L280 `toHit: 5` | fix text (91-10) | — |

### Dwarven

| Trait | Side | Text | Engine | Canon | Verdict | Pinned by |
|---|---|---|---|---|---|---|
| dwarven-prices | good | footer "store prices halved"; `RACE_NOTE.Dwarven` says nothing about prices | as `elven-prices`: `priceFor` halves the weapon, armour, premium, repair and ration lines only (Q8); `sellPriceFor` pays a Dwarf half the ordinary sale price today (Q5 ruled A: every race is paid the ordinary price after 91-08) | rulebook p.44 footnote; prototype L119 | ruled (Q5, 2026-09-30) -> 91-08 - the halving stays a buying rule only; ruled (Q8, 2026-10-01) -> 91-08 - every stock line except the three tools takes the halving | — |
| race-size-face | good | footer "being small makes you one face harder to hit"; blurb "being small makes you one face harder to hit besides" | `derived.js#foeToHitVs`: `SIZE_FACES_PER_STEP × sizeAxisStep(body, "face")`: Small is −1 winning face for the foe; the Dwarf's damage axis is the masked one (`RACES.Dwarven.sizeAxes.dmg: false`), so its +2 stays +2; a Joiner Dwarf too | size rule RULES-11 (user 2026-09-25); rulebook p.11 says dwarves are clumsy (the opposite); the game keeps the size rule | fix text (91-10) | — |
| race-upkeep | good | footer "a night without rations costs only 1 HP (a Human's costs 4)"; blurb "a single Hit Point a night when the rations run out" | `RACES.Dwarven.upkeep: 1`, paid on an unfed night by `movement.js#newDay` (`derived.js#upkeep`, which Heft halves) | rulebook p.11 "only lose 1WP a day instead of the normal 4WP"; prototype L282 | match | — |
| race-dmg | good | footer "+2 damage with every weapon"; blurb "two extra damage" | `derived.js#weaponDamageTerms`: `RACES.Dwarven.dmg` 2 on every blow (hero and Joiner) | rulebook p.11 +2; prototype L282 | match | — |
| race-foe-strike-step | bad | footer "foes strike on a die one size better"; blurb "every creature down here swings at you like it has been practising" | `derived.js#foeDie`: `RACES.Dwarven.foeStrikeStep: 1` makes a level-1 foe swing a d12 (never below a d8); read from the body being swung at, so a Joiner Dwarf has it and a Human Joiner beside a Dwarf hero does not | rulebook p.11 "a level 1 creature will roll d12 instead of d20"; prototype L282 | match | — |
| race-armor-wear | good | footer "armour wears at half the rate"; blurb "your armour shrugs off wear at half the rate everyone else's does" | `combat.js#applyFoeDamageToPlayer` and `#applyFoeDamageToMember`: a soaked blow charges `ceil(dmg × 0.5)` durability (`RACES.Dwarven.armorWear`) | not in the rulebook; added in the Phase 24 race pass (IDENT-09); prototype L282 has no `armorWear` | match | — |

### Wilmsry

| Trait | Side | Text | Engine | Canon | Verdict | Pinned by |
|---|---|---|---|---|---|---|
| wilmsry-talk | good | footer "can talk to anything but Magical foes and the Walking Dead" | `combat.js#canParley`: a Wilmsry may always parley any foe type except Magical (the Walking Dead are refused for everyone); `parleyBlockedReason` keeps a Wilmsry from a Magical foe even at fluency 2 (Helm of Knowledge or Chameleon Tongue) | rulebook p.11 "All good and evil creatures recognize the Wilmsry and often desire to barter with them"; prototype L2258 | fix text (91-10) | — |
| wilmsry-haggle | good | footer "store prices 30% off"; blurb does not state it | `economy.js#openStore`: every stock line, the tool lines included, `× 0.7` rounded, after the race multiplier | rulebook p.11 bargaining; prototype L1589 `haggle` 0.7 | match | — |
| wilmsry-joiners | bad | footer "Magic User Joiners refuse to travel with you"; blurb "not one of them will so much as travel with you" | `encounters.js#meetJoiner`: a Magic User Joiner is refused for a Wilmsry hero (`joinerRefused`, reason "wilmsry"); no draw moves | rulebook p.11 "Magic Users hate them"; ruling IDENT-21 (2026-09-30): the tone changes: you refuse to take Magic User Joiners on | ruled (2026-09-30) -> 91-08 | — |
| race-heal2x | good | footer "rest, potions and your own healing spells heal twice as much"; blurb "You heal twice as fast" | `movement.js#newDay` doubles a camp heal (a Wilmsry Soldier doubles once); `magic.js#castSpell` doubles the hero's heal spells; `magic.js#drinkPotion` doubles the STOCK healing potion only: a found Healing or Xtra Healing potion and a healing item do not (Phase 89 finding). A Joiner Wilmsry doubles its own heal spells (`allyCast`) and its own potions (`items.js#memberDrinkPotion`) | rulebook p.11 "Even healing magic has double effect"; prototype L1285 and L2181 | ruled (Q4, 2026-09-30) -> 91-09 - every healing potion the Wilmsry drinks heals double | — |
| race-sp-mul | bad | footer "half the experience from every kill"; blurb "learn half as quickly" | `derived.js#killSpFor`: × 0.5 (a parley's experience reads the same formula); the descent bonus is not halved | rulebook p.11 "only gain half the skill points"; prototype L284 | match | — |
| unstated:wilmsry-parley | good | not stated (the blurb says "magic users despise you", nothing about bargaining) | `combat.js#parley`: +4 on every parley roll a Wilmsry makes, whatever the foe | rulebook p.11 "noted throughout the world for their bargaining ability" (no number); prototype L2267 | fix text (91-10) | — |

### Fridgian

| Trait | Side | Text | Engine | Canon | Verdict | Pinned by |
|---|---|---|---|---|---|---|
| race-no-armor | bad | footer "can never wear armour"; blurb "You will not wear armour" | `RACES.Fridgian.noArmor`: no starting armour, `items.js#armorRefusalReason` "noArmor", the store never offers armour | rulebook p.12 "Fridges don't wear any armor"; prototype L286 | match | — |
| race-frenzy | good | footer "five times in eight, a frenzy adds a second swing that never wastes itself on a corpse"; blurb "Five times in eight you lose the plot entirely and swing twice" | `combat.js#playerStrike`: once per strike action a d8 on the top 5 faces (5 in 8) sets `attacks = max(attacks, 2)`; the second swing is rolled one face narrower than the hero's own to-hit (Phase 72 ruling) and is lost when the first swing fells the target; it never adds a third swing (a Barbarian, Ambidextrous or Speed already swing twice); a Joiner never frenzies | rulebook p.12 frenzy on 1-5 on a d8, the second attack needs a 3; prototype L1896; ruling IDENT-20 (2026-09-30): a 4 to 6 on a d6 gives a second swing, the corpse line is removed; Q6 ruled A: the second swing is lost when the first kills, and the text says so | ruled (2026-09-30) -> 91-09, 91-10 | — |
| race-slow | bad | footer "never wins initiative"; blurb "You will not strike first" | `combat.js#resolveInitiative`: `RACES.slow` forces the foes to open, unless foresight, Acute Hearing, Sense Presence or Speed of Sound is live (the two d20s are still drawn); a Joiner has no initiative of its own | rulebook p.12 "always strike last"; prototype L1831 | match | — |
| race-hide | good | footer "thick hide soaks 2 from every blow"; blurb "your hide alone soaks two points off every blow that lands" | `combat.js#applyFoeDamageToPlayer`: `max(1, dmg − 2)` after Hardiness on every landed foe blow, pursuit strike and ability bolt; `applyFoeDamageToMember` does not read it, so a Fridgian Joiner's hide does nothing (Phase 89 and Phase 90 hand-off) | not in the rulebook or the prototype; added in the Phase 24 race pass (IDENT-09) | ruled (Q7, 2026-09-30) -> 91-09 - a Fridgian Joiner's hide soaks 2 of every blow | — |
| unstated:no-samurai | bad | not stated (the blurb says nothing about the Samurai) | `character.js#rollCharacter` and `normalizeForce`: a Fridgian can never be a Samurai (the sub is rerolled; a forced pair throws) | rulebook p.12 "You cannot be a Fridgian Samurai because Fridges don't wear any armor" | fix text (91-10) | — |

### Troll

| Trait | Side | Text | Engine | Canon | Verdict | Pinned by |
|---|---|---|---|---|---|---|
| troll-prices | bad | footer "store prices triple"; blurb "Everything you own cost triple" | `economy.js#priceFor`: `base × 3` on the weapon, armour, premium-piece, repair and ration lines only (potions, food, lockpicks, the sealed scroll and the tools are flat: Q8); `sellPriceFor` pays a Troll triple the ordinary sale price (Q5 ruled A: the multiplier is a buying rule only after 91-08); `openStore` then doubles the plain weapon lines again | rulebook p.12 "Troll armor and weapons cost triple, and Troll weapons cost double"; p.44 footnote; prototype L119 and L1574; ruling IDENT-21 (2026-09-30): store prices doubled | ruled (2026-09-30) -> 91-08; ruled (Q5, 2026-09-30) -> 91-08 - the multiplier is a buying rule only; ruled (Q8, 2026-10-01) -> 91-08 - every stock line except the three tools takes the doubling | — |
| troll-weapons | bad | footer "weapons cost double on top of that" | `economy.js#openStore` `weaponLine`: `priceFor(...) × 2` for a Troll on the plain weapon lines (×6 in all); the premium weapon lines are not doubled again | rulebook p.12 "Troll weapons cost double"; ruling IDENT-21: prices doubled, the extra weapon doubling goes | retire (91-08) | — |
| race-size-face | bad | footer "being large makes you one face easier to hit"; blurb "one face easier for anything to hit" | `derived.js#foeToHitVs`: the Large size step is +1 winning face for the foe; nothing is masked for a Troll; a Joiner Troll too | size rule RULES-11 (user 2026-09-25); rulebook p.12 says Large | fix text (91-10) | — |
| race-upkeep | bad | footer "a night without rations costs 15 HP (a Human's costs 4)" | `RACES.Troll.upkeep: 15` on an unfed night (`newDay`; Heft halves it) | rulebook p.12 "15WP per day instead of the normal 4WP"; prototype L288 | match | — |
| race-flat-hp | good | footer "starts with 75 HP whatever the class"; blurb "Seventy-five Hit Points" | `character.js#rollCharacter`: `RACES.Troll.flatWP: 75`, no class dice (a Joiner Troll too); the level-up gains are the class's own, unscaled | rulebook p.12 "75 WP regardless of their class"; prototype L288; ruling IDENT-21 (2026-09-30): the text says 75 starting hit points | ruled (2026-09-30) -> 91-10 | — |
| race-dmg | good | footer "+11 damage with every weapon (2 of it for being large)"; blurb "+11 damage per swing (nine Troll, two more for being Large)" | `derived.js#weaponDamageTerms`: `dmg 6 + wpnBonus 3` plus the Large size step +2 = +11 on every blow, hero and Joiner | rulebook p.12 "+6 damage just for his size, and his weapons ... +3"; ruling IDENT-21 (2026-09-30): +11 for being big and strong, the Large +2 inside the 11 | ruled (2026-09-30) -> 91-10 | — |
| race-eats | bad | footer "eats two rations a night"; blurb "an appetite that goes through two rations a night" | `RACES.Troll.eats: 2`: `movement.js#eatsFor` and `#nightlyEats` count it; `makeCamp` refuses without both rations (a Joiner Troll eats two too) | prototype L288 `eats: 2`; rulebook p.12 food | match | — |

## Sub-classes

Rows follow the `CLASSES` subs order: the Magic User subs, then Fighter, then Thief. A Magic User section carries its school limits in the `chart-never`, `chart-gate-<school>` and `unstated:` rows; the Apprentice's section also carries the one fact that makes it special (it learns every school).

### Wizard

| Trait | Side | Text | Engine | Canon | Verdict | Pinned by |
|---|---|---|---|---|---|---|
| wizard-day-one | good | footer "always starts with a level 1 direct-damage spell it can cast on day one"; blurb "Your book always opens with something that hurts" | `character.js#topUpWizardDamage` (91-02): rollGrimoire's existing day-one top-up (walks the shuffled level-1 `spare` pool until `damageReady()`) is followed by this Wizard-only step: a Wizard whose book holds no level-1 direct-damage spell it can cast gets one drawn from the full level-1 pool (every SPELLS row the Wizard may learn at effective level 1 whose own kind deals damage, `derived.js#dealsDamage`; today that pool is Freeze alone) on the call's grimoire derived stream, never the main rng, so the main-rng draw count (36) is unchanged. Measured: the step never fires today (the top-up already found Freeze for every seed), so every Wizard book is byte-identical to the base commit's. A summon or a buff never satisfies it | ruling IDENT-13 (2026-09-30): a Wizard always starts with at least one direct-damage level-1 spell it can cast on day one, from the full level-1 pool; rulebook p.16 | fixed engine (91-02); fixed text (91-02) | test/unit/wizard-day-one.test.js: IDENT-13: every new Wizard holds a castable direct-damage level-1 spell on day one, seeds 1 to 1000; test/unit/wizard-day-one.test.js: IDENT-13: the guarantee holds for a Wizard of every race, seeds 1 to 200 each; test/unit/wizard-day-one.test.js: topUpWizardDamage: a damage-less book gains exactly one pool spell; a book that already has one is untouched and draws nothing |
| wizard-melee | bad | footer "won't swing a weapon while a castable attack spell and a charge remain"; blurb "You will not raise a hand while an attack spell is left in the book" | `combat.js#playerStrike`: while a charge remains AND `derived.js#castableAttackSpells` is non-empty the strike is refused (`strikeRefused`, reason "wizard", naming the spell); a Wizard with only utility spells, or none left, fights with the staff. A Joiner Wizard casts by its own policy and falls back to the staff | rulebook p.16 "never resort to hand to hand combat until all possible spells have been used"; prototype L1882; Phase 23 IDENT-01 narrowed it to a castable attack spell | match | — |
| chart-bonus-offense | good | footer "your thrown offense spells land on three more faces" | `derived.js#schoolBonus` (`MU_CHART.Wizard.offense` 3): `magic.js#castSpell`'s thrown branch and `combat.js#allyCast` add it to a thrown spell's winning faces (Freeze, Fireball, Lightning, Mangle); nothing else reads it | rulebook p.18 offense +3; prototype L425 | fix text (91-10) | — |
| chart-never | bad | footer "never learns illusion spells"; blurb `SUB_NOTE.Wizard` "Offense, protection, healing, divination and special, and never Illusion, which the Illusionist keeps for itself" (91-02; the "Every school of magic" claim and the "flat refusal to teach" are gone) | `MU_CHART.Wizard.illusion: null` (Phase 90 plan 06): `derived.js#schoolAllowed` false, `schoolClosed` refuses the cast and the Grimoire row, `rollGrimoire` never deals one; a scroll's free cast still fires any spell (RULES-10) without copying a closed school. The old blurb's refusal to teach had no engine rule (nothing in the game trades spells) and was removed | rulebook p.17 gives Illusion to the Illusionist; the p.18 table lists Illusion +0 for the Wizard; the user's SPELL-10 ruling (90-CONTEXT, 2026-09-30) removed it from the Wizard | fixed text (91-02) | test/unit/identity-footer.test.js: Wizard: Good names the day-one damage spell, Bad names never learning Illusion; the blurb no longer claims every school |

### Warlock

| Trait | Side | Text | Engine | Canon | Verdict | Pinned by |
|---|---|---|---|---|---|---|
| warlock-potion | good | footer "copies a potion every night it has one"; blurb "a potion copied every day" | `movement.js#newDay`: on a fed day with `c.potions > 0`, +1 potion (hero only; a Joiner Warlock does not) | rulebook p.16 once per week per skill level; prototype L1311 weekly; deliberately daily since 04-DR12 (user) | match | — |
| warlock-undead | bad | footer "every Walking Dead foe in the fight gains HP equal to your level"; blurb "a standing bonus to every walking dead thing in the room" | `combat.js#startCombat`: each foe of type Walking Dead gets `wp` and `maxWP` + the hero's level (hero only) | rulebook p.16 "+1 WP per skill level to all walking dead"; prototype L1842 | match | — |
| chart-bonus-offense | good | footer "your thrown offense spells land on four more faces" | as the Wizard's row, `MU_CHART.Warlock.offense` 4 | rulebook p.18 offense +4; prototype L426 | fix text (91-10) | — |
| chart-gate-protection | bad | footer "no protection spells until level 4" | `MU_CHART.Warlock.gate.protection: 4`: `canCast` and `rollGrimoire`'s `grantableAt` hold the school shut below level 4; the level-3 reveal of an Apprentice drops a gated spell | rulebook p.18 protection `**` (level 4); prototype L426 | match | — |
| chart-gate-healing | bad | footer "no healing spells until level 3" | `MU_CHART.Warlock.gate.healing: 3`, enforced the same way | rulebook p.18 healing `*` (level 3); prototype L426 | match | — |
| chart-never | bad | footer "never learns special or illusion spells"; the blurb names no school | `MU_CHART.Warlock.special` and `.illusion` are `null`: never dealt, never cast, a scroll still free-casts | rulebook p.18: Special n/a and Illusion n/a for the Warlock | fix text (91-10) | — |

### Sorcerer

| Trait | Side | Text | Engine | Canon | Verdict | Pinned by |
|---|---|---|---|---|---|---|
| sorcerer-book | good | footer "starts with Freeze and Fireball in the book"; blurb "Freeze and Fireball in the book from day one" | `character.js#rollGrimoire`: both are must-haves pushed after the rolled book | rulebook p.16 "d20 + 4 spells"; prototype L456 | match | — |
| sorcerer-levels | good | footer "learns two new spells at every level"; blurb "two more spells each level" | `character.js#checkLevel`: shuffles the learnable spells it lacks and takes the first two that are grantable at the new level (the healing gate 4 can leave it with fewer) | rulebook p.16 "2 new spells automatically"; prototype L2013 | match | — |
| sorcerer-arm | bad | footer "weapon damage never goes above 9"; blurb "Your arm caps out at 9 damage" | `derived.js#weaponDamageTerms`: the base is capped at 9 before a crit doubles it, a Joiner Sorcerer too | rulebook p.16; prototype L1049 | match | — |
| sorcerer-forgets | bad | footer "one level-up in eight forgets a spell that isn't Freeze, Fireball or Lightning"; blurb "a one-in-eight chance per level of simply forgetting one that isn't fire, frost or lightning" | `checkLevel`: after the two new spells a d8 of 1 drops one random spell that is not Freeze, Fireball or Lightning | rulebook p.16 1 of 8 each level | match | — |
| chart-bonus-offense | good | footer "your thrown offense spells land on four more faces" | `MU_CHART.Sorcerer.offense` 4 | rulebook p.18 offense +4 | fix text (91-10) | — |
| chart-gate-healing | bad | footer "no healing spells until level 4" | `MU_CHART.Sorcerer.gate.healing: 4` | rulebook p.18 healing `**` | match | — |
| chart-never | bad | footer "never learns illusion spells"; the blurb names no school | `MU_CHART.Sorcerer.illusion: null` | rulebook p.18 Illusion n/a | fix text (91-10) | — |
| unstated:special-stretch | good | not stated (the footer states only the thrown offense bonuses) | `derived.js#spellEffectSquares` and `#spellEffectRounds` (Phase 90 Q6 A): the Special bonus 1 adds +10 squares to Open/Lock, Fly, Enchant Character and Speed of Sound and +1 round to Stop Time; a protection bonus of 1 changes nothing (no thrown protection spell) | rulebook p.18 special +1 ("additional squares") | fix text (91-10) | — |

### Summoner

| Trait | Side | Text | Engine | Canon | Verdict | Pinned by |
|---|---|---|---|---|---|---|
| summoner-summon | good | footer "a Summon is always in the book from day one"; blurb "You can call a full Summon from your very first day" | `rollGrimoire`: Summon is a must-have, castable from level 1 through `SPELL_LEVEL_OVERRIDES.Summoner.Summon` (Phase 90 SPELL-12; Lesser Summon is gone) | rulebook p.17; prototype L455; user ruling 2026-09-30 (the Summoner may cast the level-2 Summon from level 1) | match | — |
| summoner-doubled | good | footer "a full Summon arrives a level stronger, and its duration die counts double"; blurb "a level stronger and longer-lived than anyone else's" | `magic.js#castSpell` summon branch: level `min(5, level + 1)` and rounds `2 × d4 + 2` for a Summoner | rulebook p.17 "duration of two times normal, and the WP and spells are doubled"; prototype L2067 | match | — |
| summoner-backfire | bad | footer "one full Summon in eight turns on you"; blurb "one time in eight it arrives on the wrong side" | `magic.js#castSpell`: a doubled summon draws a d8; a 1 hurts the Summoner for `level² + d6` and no ally arrives (`summonBackfired`) | rulebook p.17 1 in 8; prototype L2072 | match | — |
| chart-never | bad | footer "never learns illusion spells"; the blurb names no school | `MU_CHART.Summoner.illusion: null`. The Summoner has no offense gate: RULES-03 (Phase 75, user 2026-09-25) removed it, against the p.18 `*` | rulebook p.18 Illusion n/a | fix text (91-10) | — |
| chart-healmul | bad | footer "healing spells you cast heal at half strength"; blurb "Your own healing spells, meanwhile, heal at half strength" | `derived.js#healMulFor` (`MU_CHART.Summoner.healMul` 0.5), applied last after the Cleric and Wilmsry terms, floor 1 | not in the rulebook; RULES-03 (user 2026-09-25) | match | — |
| chart-override-Summon | good | footer "Summon castable from level 1 (level 2 for everyone else)" | `content/spell-level-overrides.js`: `Summoner: { Summon: 1 }` read by `derived.js#spellLevelFor` | user ruling 2026-09-30 (SPELL-12) | match | — |
| unstated:special-stretch | good | not stated | the Special bonus 1 adds +10 squares to Open/Lock, Fly, Enchant Character and Speed of Sound and +1 round to Stop Time (`spellEffectSquares`, `spellEffectRounds`) | rulebook p.18 special +1 | fix text (91-10) | — |

### Cleric

| Trait | Side | Text | Engine | Canon | Verdict | Pinned by |
|---|---|---|---|---|---|---|
| cleric-heal | good | footer "every healing spell heals 3 more"; blurb "Healing, turning the dead and chain mail" (the shield claim went in 91-02) | `magic.js#castSpell` and `combat.js#allyCast`: the heal's dice + 3 (a Joiner Cleric too), then a Wilmsry doubling, then the healMul | rulebook p.17 +3 WP to any healing spell; prototype L2180 | match | — |
| cleric-hit | good | footer "your top four faces hit, not a Magic User's three"; blurb "Your top four faces hit instead of three" | `derived.js#classNeed` and `memberToHit`: `max(class need, 4)` | rulebook p.17 "need only roll 4 to hit"; prototype L1011 | fix text (91-10) | — |
| cleric-heal-start | good | footer "always starts with Heal in the book"; blurb "Heal is always on the first page" | `rollGrimoire`: `Heal` and `Major Heal` are must-haves for a Cleric (pushed after the rolled walk, never a name-gated draw), so Heal (level 1, healing school open) is castable on day one and Major Heal from level 3 already; with the offense school closed the day-one top-ups find nothing to add for a Cleric and end quietly. The game grants neither Turn Walking Dead nor Cure Disease, which the rulebook also grants | rulebook p.17 "heal wound, turn walking dead, and cure disease automatically"; ruling IDENT-15 (2026-09-30): always starts with the level-1 Heal | fixed text (91-02) | test/unit/cleric-offense-ban.test.js: IDENT-15: every new Cleric holds Heal and can cast it on day one, seeds 1 to 1000 |
| chart-never | bad | footer "never learns offense, special or illusion spells"; blurb "no offense spell ever lands in your book, and Heal is always on the first page" (91-02) | `MU_CHART.Cleric.offense` is `null` (91-02, IDENT-15), like `special` and `illusion`: the whole offense school, including its buff Strength (school offense, kind might), is never learned. One gate, no Cleric name check: `canLearn` and `grantableAt` refuse it at `rollGrimoire`'s walks, `checkLevel`'s picks and `findGrimoire`; `readScroll`'s scribe gate never copies it; `canCast` and `castSpell` refuse an old book's copy (`spellSchoolLocked`, forbidden, no charge); the combat menu lists only castable spells; the tolerant save load drops an old Cleric's offense spells. `rollGrimoire`'s day-one damage top-up finds nothing to add for a Cleric and ends quietly (its main-rng draw count falls from 34 to 10: both pool shuffles lost the offense school); a Joiner Cleric's `bestAttackSpell` finds nothing and it swings its staff | rulebook p.18 gives the Cleric offense +0 (it may learn it); ruling IDENT-15 (2026-09-30): cannot cast offensive spells, because they gain more hit points (no Cleric hit-point rule is built: Q2 A) | fixed engine (91-02) | test/unit/cleric-offense-ban.test.js: IDENT-15 gate data: the Cleric's offense school is never learned, and every other school's value is unchanged; test/unit/cleric-offense-ban.test.js: IDENT-15: no new Cleric's book holds an offense spell, seeds 1 to 1000 (rolled, never dealt); test/unit/cleric-offense-ban.test.js: IDENT-15 cast gate: an old book that holds an offense spell never casts it (spellSchoolLocked, forbidden, no charge spent); test/unit/cleric-offense-ban.test.js: IDENT-15 Joiner: a Joiner Cleric (meetJoiner) holds no offense spell, and its book still holds Heal |
| chart-gate-divination | bad | footer "no divination spells until level 3" | `MU_CHART.Cleric.gate.divination: 3` | rulebook p.18 divination `*` | match | — |
| unstated:cleric-mail | good | blurb "Healing, turning the dead and chain mail" (the shield claim was dropped in 91-02, user 2026-10-01); the footer says nothing | `character.js#rollCharacter`: a Cleric starts in Mail (AR 12, 30 hp), every other Magic User in Cloth; `ARMORS.Mail` is class F, so a Cleric can never wear a different Mail later. There is no shield in `ARMORS` or anywhere else in the engine | rulebook p.17 "use a shield and wear chain mail"; the p.44 armour table has a Shield row (AR 2) the game does not carry; the Q2 ruling asked the blurb to name the shield | ruled (Q2, 2026-09-30) -> 91-10 - states the chain mail, +1 to hit and the offense ban, and drops the shield claim (the game has no shield) | — |
| unstated:cleric-scroll | neutral | not stated | `magic.js#readScroll`, magicUser path: a scroll that rolls a spell the book cannot hold (a closed school, or above the level) is still free-cast and never copied, so after the ban a Cleric's scroll can still fire an offense spell (RULES-10; pinned by `test/unit/cleric-offense-ban.test.js` in 91-02) | RULES-10 (user 2026-09-24 and 2026-09-25) | ruled (Q3, 2026-09-30) -> 91-09, 91-10 - 91-09 pins that the scroll still casts, 91-10 says so in the blurb | — |

### Illusionist

| Trait | Side | Text | Engine | Canon | Verdict | Pinned by |
|---|---|---|---|---|---|---|
| illusionist-teleport | good | footer "you choose where every teleport lands"; blurb "You choose where the teleport squares put you" | `movement.js#teleport`: an Illusionist takes `bestTeleportDir` (the longest clear run in N, S, E or W) and travels a fixed 12 squares with no input and no choice (report #3) | rulebook p.17 "pick the direction and number of squares between 1 and 20"; prototype L1342 also takes the best direction; ruling IDENT-14 (2026-09-30): the player picks, up to 12 squares in 8 directions, or LET IT CHOOSE | ruled (2026-09-30) -> 91-03, 91-04 | — |
| illusionist-d20 | bad | footer "strikes on a d20 until level 3"; blurb "a d20 to strike until level three" | `derived.js#strikeDie`: index 0 (d20) below level 3, which also cancels an Elf's better die at levels 1 and 2 | rulebook p.17; prototype L1003 | match | — |
| chart-gate-protection | bad | footer "no protection spells until level 3" | `MU_CHART.Illusionist.gate.protection: 3` | rulebook p.18 protection `*` | match | — |
| chart-never | bad | footer "never learns healing spells"; the blurb names no school | `MU_CHART.Illusionist.healing: null` | rulebook p.18 healing n/a | fix text (91-10) | — |
| unstated:special-stretch | good | not stated | the Special bonus 4 adds +40 squares to Open/Lock, Fly, Enchant Character and Speed of Sound (an Illusionist's Fly lasts 70 squares) and +4 rounds to Stop Time (6 rounds); the Illusion bonus is 0, so Senseless and Duplicate Foe get nothing | rulebook p.18 special +4 | fix text (91-10) | — |
| illusionist-book | good | blurb "Three illusions from day one (Mirror Self, Door Illusion and one more)"; no footer line (pre-registered) | `rollGrimoire` (Phase 90 plan 09): Mirror Self is a must-have, Door Illusion is appended, and one more Illusion spell it did not roll is picked on the call's derived stream (castable when it reaches that spell's level); Phantom Host is gone from the book and the blurb. Door Illusion is an escape from a fight (a Samurai is refused today; the Master of Arms joins it in 91-05) | rulebook p.17 "3 illusion spells on top of the beginning roll" | ruled (2026-09-30) -> 91-03 | — |

### Court Mage

| Trait | Side | Text | Engine | Canon | Verdict | Pinned by |
|---|---|---|---|---|---|---|
| court-mage-boredom | good | footer "one foe in six dies of boredom before the fight starts"; blurb "One creature in six dies of boredom" | `combat.js#startCombat`: each foe rolls a d12, the top two faces win (1 in 6), then `killFoe` pays its experience and spoils like any kill | rulebook p.17 1 in 12; widened to 1 in 6 on purpose (Phase 24 IDENT-06); prototype L1852 | match | — |
| court-mage-humans | good | footer "can always talk to Humans" | `combat.js#canParley`: a Court Mage may always parley a Humans foe at fluency 0, with no roll bonus (the Bard's rule too) | Phase 24 IDENT-06 (courtly manners); not in the rulebook | fix text (91-10) | — |
| court-mage-first | bad | footer "foes act first in round one"; blurb "when a fight actually starts, everyone else gets there first" | `combat.js#resolveInitiative`: a Court Mage in round 1 forces the foes to open, unless foresight, Acute Hearing, Sense Presence or Speed of Sound is live | Phase 24 IDENT-05 and IDENT-06; not in the rulebook | match | — |
| chart-bonus-offense | good | footer "your thrown offense spells land on two more faces" | `MU_CHART.Court Mage.offense` 2 | rulebook p.18 offense +2 | fix text (91-10) | — |
| chart-gate-divination | bad | footer "no divination spells until level 4" | `MU_CHART.Court Mage.gate.divination: 4` | rulebook p.18 divination `**` | match | — |
| chart-never | bad | footer "never learns special or illusion spells"; the blurb names no school | `MU_CHART.Court Mage.special` and `.illusion` are `null` | rulebook p.18 Special n/a and Illusion n/a | fix text (91-10) | — |

### Apprentice

| Trait | Side | Text | Engine | Canon | Verdict | Pinned by |
|---|---|---|---|---|---|---|
| apprentice-xp | good | footer "double experience from kills until level 3"; blurb "Double experience points until level three" | `derived.js#killSpFor`: × 2 while `level < 3` (a parley's experience too) | rulebook p.17; prototype L1969 | match | — |
| apprentice-backfire | bad | footer "one spell in eight backfires"; blurb "one spell in eight goes off in your hands" | `magic.js#castSpell`: the hero's every cast draws a d8; a 1 does nothing and a thrown spell also costs half its damage roll; a Joiner Apprentice's `allyCast` draws nothing, so it never backfires (Phase 90 hand-off) | rulebook p.17 1 in 8 on every spell; prototype L2044 | fix text (91-10) | — |
| chart-gate-divination | bad | footer "no divination spells until level 3" | `MU_CHART.Apprentice.gate.divination: 3` | rulebook p.18 divination `*` | match | — |
| unstated:illusion-school | good | not stated (no footer line, the blurb names no school) | `MU_CHART.Apprentice` has no null: every school is open, the Apprentice is the only sub-class besides the Illusionist that learns Illusion (and, with the Wizard shut out, the only Magic User that learns every school) | rulebook p.17 "may learn ANY spells (even Illusionist spells)" | fix text (91-10) | — |
| unstated:apprentice-reveal | neutral | blurb "at level three you finally roll to discover what you actually are"; no footer line | `character.js#checkLevel`: at level 3 the sub becomes a random other Magic User sub (the Apprentice is rerolled); the book keeps only the spells the new sub could be granted at that level | rulebook p.17 | match | — |

### Knight

| Trait | Side | Text | Engine | Canon | Verdict | Pinned by |
|---|---|---|---|---|---|---|
| knight-small | good | footer "any foe under 5 HP flees before it can act"; blurb "Nothing under 5 hp will come near you" | `combat.js#startCombat`: before initiative every foe with `maxWP < 5` flees (`foeFled`, reason "knight"); a Soldier knighted at level 3 has it too | rulebook p.13 "any creature with less than 5WP will never attack a Knight"; prototype L1850 | match | — |
| knight-big | bad | footer "never wins initiative against a foe with 20 HP or more"; blurb "anything with 20 hit points or more comes straight at you — and gets there first" | `combat.js#knightFacesBigFoe` and `resolveInitiative`: a live foe with `maxWP >= 20` at the Fight! roll forces the foes to open, unless foresight, Acute Hearing, Sense Presence or Speed of Sound is live | rulebook p.13 "creatures with over 20WP will always attempt to strike a Knight before any other character" (a target rule; the game reads it as initiative, Phase 24 IDENT-05) | match | — |

### Guard

| Trait | Side | Text | Engine | Canon | Verdict | Pinned by |
|---|---|---|---|---|---|---|
| guard-hard | good | footer "every foe lands on one face fewer against you"; blurb "every creature down here lands on one face fewer against you" | `derived.js#foeToHitVs`: `body.sub === "Guard"` takes one winning face off the foe, for the hero and for a Joiner Guard | not in the rulebook as a number (p.13 "keen of vision"); the prototype has no Guard defence | fix text (91-10) | — |
| guard-weak | bad | footer "your blows deal 3 less at level 1, one less each level until level 4"; blurb "three damage off every blow at level one, one less each level until it is gone at four" | `derived.js#weaponDamageTerms`: `−(4 − level)` below level 4, hero and Joiner | rulebook p.13 "-3 damage at level 1, -2 at level 2, etc."; prototype L1048 | match | — |
| guard-nocrit | bad | footer "your blows never crit"; blurb "No critical strike, ever" | `combat.js#playerStrike` and `#memberStrike`: `noCrit` for a Guard or Soldier, hero and Joiner | rulebook p.13 reads the other way (the Guard "never suffers 2x damage on critical attack"); the prototype L1924 and its blurb make it the Guard's own blows, and the game follows the prototype | match | — |

### Woodsman

| Trait | Side | Text | Engine | Canon | Verdict | Pinned by |
|---|---|---|---|---|---|---|
| woodsman-talk | good | footer "can always talk to Beasts and Lair Beasts"; blurb "You speak to every beast in here, the Drake included" | `combat.js#canParley`: a Woodsman may always parley a Beasts or Lair Beasts foe | rulebook p.13 "speak all animal languages, except dragon"; prototype L2254 | fix text (91-10) | — |
| woodsman-armor | bad | footer "no armour heavier than Studded"; blurb "No mail, no plate ... no shield" | `items.js#armorRefusalReason`: `it.ar > 10` is refused ("woodsman"), so Mail (12) and Plate (15) are out and Studded (10) is in; the store never offers them. There is no shield in the game to refuse | rulebook p.13 "never wear mail or plate armor, and cannot wield a shield" | fix text (91-10) | — |
| unstated:woodsman-parley | good | not stated | `combat.js#parley`: +3 on every parley roll a Woodsman makes, whatever the foe type, not only Beasts | prototype L2267 | fix text (91-10) | — |

### Soldier

| Trait | Side | Text | Engine | Canon | Verdict | Pinned by |
|---|---|---|---|---|---|---|
| soldier-camp | good | footer "camp heals you twice as much"; the blurb does not state it | `movement.js#newDay`: the camp heal ×2 on a fed day (once for a Wilmsry Soldier); hero only | rulebook p.13 "heal damage at 2x the normal rate when resting"; prototype L1285 | match | — |
| soldier-knighted | good | footer "knighted at level 3"; blurb "Serve to skill level III and they knight you" | `character.js#checkLevel`: at level 3 the sub becomes Knight and the weapon is swapped for the Knight's kit (Awl Pike, +2) with no choice; from then on the hero has the Knight's rules and loses the Soldier's | rulebook p.13; prototype L2005 ("a pole arm to go with it") | fix text (91-10) | — |
| soldier-crit | bad | footer "foes crit you on their top two faces, not just the top one"; blurb "Foes crit you on their top two faces instead of one" | `combat.js#foeTurn` and `#pursuitStrike`: a foe's roll in the top two numbers crits the hero when `c.sub === "Soldier"`; a Joiner Soldier is crit only on the top face | rulebook p.13 "critical damage on a 2 to strike by an enemy attack"; prototype L2411 | fix text (91-10) | — |
| soldier-nocrit | bad | footer "your blows never crit"; blurb "you deal criticals never" | `playerStrike` and `memberStrike`: `noCrit` for a Soldier (a Joiner Soldier too) | rulebook p.13 "can never deliver critical damage"; prototype L1924 | match | — |

### Barbarian

| Trait | Side | Text | Engine | Canon | Verdict | Pinned by |
|---|---|---|---|---|---|---|
| barbarian-two | good | footer "two attacks every strike"; blurb "Two attacks a round" | `combat.js#playerStrike`: `attacks = 2` for a Barbarian, the same two swings Ambidextrous, Speed and a frenzy give (they do not stack); hero only, a Joiner Barbarian swings once | rulebook p.14 "they get two attacks"; prototype L1893 | match | — |
| barbarian-xp | bad | footer "half the experience from every kill"; blurb "half the experience points" | `derived.js#killSpFor`: × 0.5 (a parley's experience too) | rulebook p.14; prototype L1968 | match | — |

### Master of Arms

| Trait | Side | Text | Engine | Canon | Verdict | Pinned by |
|---|---|---|---|---|---|---|
| moa-damage | good | footer "+2 damage with every weapon"; blurb "Plus two with every weapon ever forged" | `derived.js#weaponDamageTerms` and `expectedStrike`: +2 on every blow, a Joiner Master of Arms too | rulebook p.14 table "All Weapons +2" (its text says +3); the prototype blurb "+2 ... plus three with anything you have repaired yourself"; the game keeps +2 | match | — |
| moa-patch | good | footer "patches your own damaged armour every night in camp"; blurb "every night in camp you hammer the dents out of your own armour" | `movement.js#newDay`: a fed day with hurt armour gives back d6+3 armour hp, with no limit on the number of nights (Sewing is a Thief skill, so a Fighter never takes that path); hero only | rulebook p.14 "he can fix anything"; prototype L1300 | match | — |
| moa-parley | bad | footer "can never talk a fight down"; blurb "You cannot parley — you attack creatures without question, literally" | `combat.js#canParley` and `parleyBlockedReason`: false for a Master of Arms at any fluency (Helm of Knowledge and Chameleon Tongue cannot lift it), `parleyRefused` "masterOfArms" | rulebook p.14 "always attack a creature no questions asked"; Phase 24 IDENT-05 | match | — |
| moa-withdraw | bad | footer "no clean withdrawal in round one"; blurb "there is no clean exit in round one either" | `combat.js#flee`: the round-1 clean withdrawal other Fighters get belongs to `C.tracked`, and `startCombat` never sets `tracked` true (the Tracking skill was retired in Phase 38: "nothing sets it true anymore"), so no hero ever has the clean withdrawal and the Master of Arms' drawback costs it nothing today; its flee roll is the ordinary d20 | none (Phase 24 IDENT-05 invention); ruling IDENT-16 (2026-09-30): too small a drawback, replaced | retire (91-05) | — |
| unstated:moa-escape-routes | neutral | not stated | every way the hero can leave a live fight (`engine/combat.js`, `engine/items.js`, `engine/magic.js`): (1) `flee` ordinary d20 (`fled` "escaped"); (2) the Cloaker's free vanish (`fled` "cloaker", Cloaker only); (3) the tracked round-1 clean withdrawal (`fled` "tracked", dead code, no source sets `tracked`); (4) Smoke, a Thief ability whose live window turns a flee into a clean escape (`fled` "smoke"); (5) Door Illusion, an Illusion spell (`doorIllusionEscape`, `fled` "door"), also reachable as a scroll's free cast; (6) a successful parley (ends the fight, refused to a Master of Arms); no item, staff or scroll ends a fight by leaving. `fleeRefusal` already refuses a Samurai at (1) and (5) | ruling IDENT-16 (2026-09-30): a Master of Arms never leaves a fight once it starts; 91-05 puts the Master of Arms into `fleeRefusal` and pins every route | ruled (2026-09-30) -> 91-05 | — |
| moa-never-leaves | bad | not stated yet (pre-registered) | `combat.js#fleeRefusal`: today returns "samurai" only; `flee` reads it for the flee refusal and `magic.js#castSpell` reads it to refuse Door Illusion before a charge is spent. The ruling adds "masterOfArms" there, one predicate for both | ruling IDENT-16 (2026-09-30) and the accepted discuss answer: never leaves a fight | ruled (2026-09-30) -> 91-05 | — |

### Samurai

| Trait | Side | Text | Engine | Canon | Verdict | Pinned by |
|---|---|---|---|---|---|---|
| samurai-kit | good | footer "starts in plate with a magic katana (+2)"; blurb "A magical katana, armour like plate" | `character.js#rollCharacter`: Plate (AR 15, 45 hp), Katana with proficiency 3 and `magicWpn` 2 | rulebook p.14 "armor equivalent to plate ... a magical Katana"; prototype L129 | match | — |
| samurai-never | bad | footer "never wins initiative and never flees"; blurb "you never win the first roll of anything. You never run" | `combat.js#resolveInitiative` (foes open unless foresight, Acute Hearing, Sense Presence or Speed of Sound) and `#fleeRefusal` ("samurai"): refuses `flee` and Door Illusion (cast and scroll); the clean withdrawal is dead code, the Cloaker vanish and Smoke are Thief abilities, and a parley that ends a fight is a choice a Samurai may make. 91-05 pins that the one predicate covers every route for the Samurai and the Master of Arms | rulebook p.14 "A Samurai will never run from a combat"; prototype L2234 | match | — |

### Bard

| Trait | Side | Text | Engine | Canon | Verdict | Pinned by |
|---|---|---|---|---|---|---|
| bard-humans | good | footer "can always talk to Humans"; blurb "every Human in here will at least hear you out before swinging" | `combat.js#canParley`: a Bard may always parley a Humans foe at fluency 0, with no roll bonus | rulebook p.14 "Everyone, and everything has great respect for Bards"; prototype L2255 | fix text (91-10) | — |
| bard-song | good | footer "a song every 100 squares"; blurb "Five songs, one every hundred squares"; the combat menu SING copy and the Inspire chip (`heroConditions.js` "inspired", "one more face") still speak in faces | `combat.js#songReady` and `#sing`: once per 100 squares (`c.songAt`), always the highest of the five fixed songs at or below the Bard's level (`SONGS`); Lullaby and Cry of Thunder still roll the old floor-12 control resist (`resistControl`, `controlCapRounds`); no Joiner sings | rulebook p.14 song table and "once every 100 squares"; prototype L2284 and L2294; ruling IDENT-17 with the user's change (2026-09-30): SING is a combat action once per fight, a random offense or defense spell of the Bard's level or lower at full strength, sung titles, Joiner Bards sing on their own turn | ruled (2026-09-30) -> 91-06, 91-07, 91-10 | — |
| bard-camp | bad | footer "camp wakes wandering monsters twice as often"; blurb "creatures too stupid to know better come looking twice as often" | `difficulty.js#wanderWakeFacesFor` through `movement.js#newDay`: a Bard's quiet check needs one face more, so each of the eight hourly d20s wakes the party on 1 or 2 instead of 1 | Phase 24 IDENT-05; rulebook p.14 only says low-intellect creatures attack Bards first | match | — |
| bard-target | bad | footer "dim-witted foes come for you first, even with a party beside you"; blurb "once the fighting starts they come for you first" | `combat.js#pickFoeTarget`: a foe with `intel <= 3` always targets the Bard hero when a live Joiner is in the fight (the pick die is still drawn) | rulebook p.14 "low intellect (3 or 4) will always attack Bards first"; ruling IDENT-17 (2026-09-30): intelligence 3 or less, keep it and say so plainly | ruled (2026-09-30) -> 91-06 | — |

### Pickpocket

| Trait | Side | Text | Engine | Canon | Verdict | Pinned by |
|---|---|---|---|---|---|---|
| pickpocket-take | good | footer "an extra take from every kill and chest"; blurb "You take a percentage of everything: purses, shop stock, treasure nobody has opened yet" | `items.js#gainWilmst`: every coin gain adds `round((d10 + d10) × 10 × depth / 10) + d4` (kills' coin, chests, every `gainWilmst` caller); hero only | rulebook p.19 steals d% of a character's gold; prototype L1445 | ruled (Q1, 2026-09-30) -> 91-08, 91-10 - the gold take goes away, the extra item replaces it | — |
| pickpocket-shops | bad | footer "shops charge you a quarter more and pay a quarter less"; blurb "a quarter more to buy from them, a quarter less when you sell" | `economy.js#priceFor`: ×1.25 on the weapon, armour, premium-piece, repair and ration lines only; potions, food, lockpicks, the sealed scroll and the tools are flat (the orchestrator's note that every line is marked up was checked and is wrong); `sellPriceFor` pays ×0.75 of the ordinary sale price for everything | rulebook p.19 "steal one object of choice at any store" (a different rule); Phase 24 IDENT-05; ruling IDENT-18: the shop drawback stays | ruled (Q8, 2026-10-01) -> 91-08 - every stock line except the three tools takes the +25% | — |
| pickpocket-item | good | not stated yet (pre-registered) | no code today: `combat.js#killFoe` offers one treasure drop (`rollTreasureItem`, `offerLoot`) and `encounters.js#openChest` offers one find (`offerFind`); the ruling adds one extra item at each site, through the pending pile and the bag limit | ruling IDENT-18 (2026-09-30): whenever you gain an item from a chest or a monster, you gain one extra item as well | ruled (2026-09-30) -> 91-08 | — |

### Pilfer

| Trait | Side | Text | Engine | Canon | Verdict | Pinned by |
|---|---|---|---|---|---|---|
| pilfer-traps | good | footer "disarms every trap and opens every chest for free"; blurb "Traps disarm themselves in your presence and no sealed room has ever held you" | `encounters.js#springTrap`: after the ordinary dodge check a Pilfer's trap is disarmed (`trapDisarmed`) and never damages; `#openChest`: a Pilfer's chest opens with no lock roll | rulebook p.19 "automatically disarm any and all traps" | match | — |
| pilfer-fumble | bad | footer "about one use in twenty, a magic ring, amulet, cloak or staff blows up in your hands for d10 HP and is gone"; blurb the same | `items.js#pilferFumbles` and `rollPilferFumble`: a d20 steady-hands check on a derived stream, a 1 fails (1 in 20), then d10 damage and the item is dust; applies to a Pilfer Joiner's worn items too (`memberUseWorn`); a Thief can never wield a staff, so "staff" is never reached | rulebook p.19 "may never use any magic items except those that heal"; RULES-09 (user 2026-09-24 and 2026-09-25) | match | — |

### Cat Burglar

| Trait | Side | Text | Engine | Canon | Verdict | Pinned by |
|---|---|---|---|---|---|---|
| cat-burglar-first | good | footer "your first strike of every fight always lands"; blurb "Your first strike of any fight always lands" | `combat.js#playerStrike`: `subAuto` auto-hits the first strike of the fight (and the Thief opening blow then doubles it); a Joiner Cat Burglar has no free hit | rulebook p.19; prototype L1914 | match | — |
| cat-burglar-traps | bad | footer "every trap that catches you deals double damage"; blurb "take the full weight of whatever waits behind it" | `encounters.js#springTrap`: damage ×2 after the dodge check fails, before Hardiness; hero only | rulebook p.19 (the first into every room takes the full effects); prototype L1621 | match | — |
| unstated:free-skill | good | not stated | `character.js#rollSkills` with `content/kit.js#FREE_SKILL`: a Cat Burglar starts with Dirty Trick, which no text mentions | prototype L165 `FREE_SKILL` (Climbing there; repointed in Phase 38) | fix text (91-10) | — |

### Cutthroat

| Trait | Side | Text | Engine | Canon | Verdict | Pinned by |
|---|---|---|---|---|---|---|
| cutthroat-crit | good | footer "your first landed blow always crits, even in heavy armour"; blurb "Double damage on your first landed blow" | `combat.js#playerStrike`: `C.cut` forces a crit on the first landed blow whatever the armour (it also ignores the dark no-crit ban); hero only | rulebook p.20 "always do 2x the normal damage on his first successful to strike roll"; prototype L1949 | match | — |
| cutthroat-joiner | bad | footer "one descent in twenty, the Joiner beside you doesn't reach the next floor"; blurb "One descent in twenty, the one beside you does not reach the next floor" | `movement.js#cutthroatMurderCheck`: once per descent with a Joiner in the party, a d20 of 1 (1 in 20) removes it (`joinerMurdered`) | rulebook p.20 kills one party member per dungeon; ruling IDENT-19 (2026-09-30): a d10 on every descent with a Joiner, a 1 kills it | ruled (2026-09-30) -> 91-08 | — |

### Cloaker

| Trait | Side | Text | Engine | Canon | Verdict | Pinned by |
|---|---|---|---|---|---|---|
| cloaker-vanish | good | footer "vanishes from any fight for free until you land a blow"; blurb "You can vanish for free, right up until you land your first blow" | `combat.js#flee`: while `!C.opened2` (no landed blow yet) a Cloaker leaves with no roll, the spoils forfeited and no experience; a live pursuing foe (the Spectre) still gets its parting strike first | rulebook p.20 "never has to engage in combat ... at the expense of gaining 0 skill points"; prototype L2235 | match | — |
| cloaker-seen | bad | footer "once you've struck, you flee on the ordinary roll like everyone else"; blurb "after that you flee like everyone else" | `flee`: once `C.opened2` is set the vanish is denied (`vanishDenied` "seen") and the ordinary d20 flee runs | rulebook p.20 the first attacker gets a better die; Phase 24 IDENT-07 | match | — |

### Ninja

| Trait | Side | Text | Engine | Canon | Verdict | Pinned by |
|---|---|---|---|---|---|---|
| ninja-opener | good | footer "your opening strike always lands for maximum damage"; blurb "Your opening strike lands for maximum damage" | `combat.js#playerStrike`: the first strike auto-hits with `level² + weapon max + proficiency`, and because the opening blow of any Thief crits (backstab) outside heavy armour and the dark, that maximum is then doubled: the text omits the doubling, which the Thief class note already states ("an opening strike that lands twice as hard"); a Joiner Ninja has no free opener | rulebook p.20 "maximum possible amount of damage (this damage will never be critical)"; prototype L1914 to L1949 doubles it and the game keeps the prototype | fix text (91-10) | — |
| ninja-crit | good | footer "after that, your top two faces crit"; blurb "after that your top two faces open something up"; the combat narration line reads "A Ninja's top two faces. Critical!" | `playerStrike`: after the opener a roll in the top two numbers of the strike die is a critical (×2), ignoring the dark no-crit ban | rulebook p.20 "a 1 or 2 on his to hit roll"; prototype L1942; ruling TEXT-01 (2026-09-30): say plainly that it is the crit range, the top two numbers of the die | ruled (2026-09-30) -> 91-10 | — |
| ninja-silent | bad | footer "can never talk a fight down"; blurb "You never speak" | `combat.js#canParley` and `parleyBlockedReason`: false for a Ninja at any fluency, `parleyRefused` "ninja" | rulebook p.20 "NEVER, EVER talk"; Phase 24 IDENT-05 | match | — |
| unstated:free-skill | good | not stated | `rollSkills`: a Ninja starts with Silent Step (`FREE_SKILL`) | prototype L165 (Silence there) | fix text (91-10) | — |

### Con Artist

| Trait | Side | Text | Engine | Canon | Verdict | Pinned by |
|---|---|---|---|---|---|---|
| con-artist-talk | good | footer "can talk to anything but Magical foes and the Walking Dead"; blurb "You talk first" | `combat.js#canParley`: always true except Magical (unless full fluency) and the Walking Dead | rulebook p.20 "will always try to talk his way out of a fight first"; prototype L2253 | fix text (91-10) | — |
| con-artist-leave | good | footer "a level 1 foe leaves before the fight two times in three"; blurb "any level-one foe declines to fight you two times in three" | `combat.js#startCombat`: each foe of level 1 or less rolls a d6, the top 4 faces win (2 in 3) and it leaves (`foeFled`, reason "conArtist") | rulebook p.20 intellect 6 or lower will not attack; prototype L1851 `D(6) <= 4` | match | — |
| con-artist-opener | bad | footer "your opening blow deals no damage"; blurb "Your first landed blow does no damage at all" | `playerStrike`: the first landed blow is a warning (`conArtistOpener`), no damage and no backstab; hero only | rulebook p.20; prototype L1944 | match | — |
| unstated:parley-bonus | good | not stated | `combat.js#parley`: +4 on every parley roll a Con Artist makes (the prototype's +6 was lowered in Phase 20 D-07) | prototype L2267 | fix text (91-10) | — |

### Acrobat

| Trait | Side | Text | Engine | Canon | Verdict | Pinned by |
|---|---|---|---|---|---|---|
| acrobat-dodge | good | footer "foes land only on their top four faces"; blurb "Nothing lays a hand on you except on its top four faces" | `derived.js#foeToHitVs`: `body.sub === "Acrobat"` sets the foe's base winning faces to 4 (`ACROBAT_FOE_FACES`) before the race, size and gear terms; a Joiner Acrobat too | rulebook p.20 "roll 3 to hit"; user 2026-09-28 (quick 260928-nrf): top 4; ruling TEXT-01 (2026-09-30): say it plainly, e.g. foes hit you only on a high roll (17 to 20 on a d20) | ruled (2026-09-30) -> 91-10 | — |
| acrobat-hit | good | footer "your top five faces hit, like a Fighter's (six with the dagger)"; blurb "You strike with it like a fighter" | `derived.js#classNeed` and `memberToHit`: 5; the dagger's `need` +1 makes it six | rulebook p.20 "attack as a fighter needing a only a 5 to hit"; prototype L1010 | fix text (91-10) | — |
| acrobat-dagger | bad | footer "a dagger and nothing else"; blurb "you may carry nothing but a knife" | `items.js#canEquipWeapon`: an Acrobat may wield only a Dagger | rulebook p.20 "never use any weapon of greater size than a knife or dagger" | match | — |
| unstated:trap-dodge | good | not stated | `encounters.js#springTrap`: the dodge check needs 8 faces of the d20 instead of 5 for an Acrobat (`nimble = 5 + 3`), so a trap catches it on 12 of 20 instead of 15 | prototype L1615 (+3) | fix text (91-10) | — |
| unstated:free-skill | good | not stated | `rollSkills`: an Acrobat starts with Smoke (`FREE_SKILL`) | prototype L165 (Leaping there); rulebook p.20 acrobatics | fix text (91-10) | — |

## Findings for other phases

Every Phase 90 and Phase 89 hand-off to Phase 91 has a row or a verdict owner below; the rest is for the phase named.

- **Phase 91 itself (the hand-offs, and the row that owns each):**
  - The Bard's Sing still calls `resistControl` twice and `controlCapRounds` once (the RULES-18 helpers every spell left in Phase 90): row `bard-song`, plan 91-06 (the songs become spell echoes on the shared `foeResistsEffect`).
  - The parley insult chip and `COMBAT_MENU_COPY.parleyDesc` ("one face easier", `src/browser/combatMenu.js`), the Bard's song chip (`src/browser/heroConditions.js`, "inspired") and the Ninja's "A Ninja's top two faces. Critical!" line (`src/browser/eventNarration.js`) still speak in faces: rows `bard-song` (91-10, chip and menu copy), `ninja-crit` (91-10) and, for the parley card and chip, plan 91-05 (explains parley) with 91-10 (TEXT-01 wording).
  - The identity footer states no Special stretch: rows `unstated:special-stretch` on the Sorcerer, Summoner and Illusionist, plan 91-10.
  - `SUB_NOTE.Wizard`'s "Every school of magic" and its Illusion clause: row `chart-never` on the Wizard, plan 91-02.
  - The Illusionist's starting book and blurb: row `illusionist-book`, plan 91-03.
  - The Master of Arms joins `combat.js#fleeRefusal`, so Door Illusion is refused for it as for a Samurai: rows `moa-never-leaves` and `unstated:moa-escape-routes`, plan 91-05.
  - Chameleon Tongue's parley pays whatever `parley()` pays: plan 91-05 pins that a Tongue parley pays the new full experience and spoils (no row of its own: the spell is Phase 90's).
  - The Cleric's offense ban joins the gate data (`MU_CHART.Cleric.offense` becomes null): row `chart-never` on the Cleric, plan 91-02.
  - A Joiner Apprentice never backfires while the Apprentice footer says "one spell in eight backfires": row `apprentice-backfire`, plan 91-10 (the footer says whose spell: yours).
  - A Joiner's Fridgian hide: row `race-hide`, Q7, plan 91-09. A Joiner's Hardiness was built in Phase 90 plan 10.
  - docs/ITEM-AUDIT.md: the Wilmsry heal-twice rule reaches only the stock potion (row `race-heal2x`, Q4, plan 91-09); the Helm of Knowledge's parley wording must follow PARLEY-01 (plan 91-05 for the rewards, 91-10 for the item's words: "can always parley with anyone").
- **Phase 91.1 (value review):**
  - The chart's bonuses on protection, healing, divination and illusion change no roll (rulebook p.18 says they add to damage, number affected, additional healing or squares); the Illusion bonus is 0 for both sub-classes that learn it.
  - A Joiner's sub-class specials are the hero's only: a Barbarian's second attack, the Cat Burglar and Ninja free opener, the Ninja's and the Cutthroat's crits, the Fridgian frenzy, the Soldier's crit exposure and camp heal, the Apprentice's backfire. Q7 covers only what protects a Joiner's body.
  - The Ninja's later crit and the Cutthroat's first crit ignore the dark no-crit ban that stops every other crit (the stealth crit respects it).
  - The Cleric's offense ban also takes Strength (a buff in the offense school) from it.
  - The Master of Arms' armour patch has no limit on the number of nights.
  - A Cloaker's free vanish still lets a pursuing Spectre strike once.
  - An Elf's better strike die is cancelled at levels 1 and 2 when the Elf is an Illusionist.
- **Phase 92 (bot pass and economy):**
  - The Troll's prices fall from triple (weapons sextuple) to double, and after Q5 no race is paid more or less than the ordinary sale price: store income and costs move for Elves, Dwarves and Trolls; Q8 A moves them further (potions, food, lockpicks and the sealed scroll join the price rule).
  - The Cleric loses every offense spell, the Master of Arms never leaves a fight, the Bard's SING becomes a combat spell echo, a Pickpocket gains items instead of gold, the Illusionist picks its teleport (the bot must answer the pick) and the Cutthroat's Joiner risk falls from 1 in 20 to 1 in 10 (the bot declines Joiners, so it does not move): measure once.
- **Canon the game does not carry (backlog, no row owns it):** the Court Mage's angry-party-member risk (rulebook p.17), the Pick Pocket's steal-from-a-store, a Shield armour (p.44), the Cleric's Turn Walking Dead and Cure Disease grants.
- **Correction to the rulings note:** `.planning/notes/v2.3-user-rulings-2026-09-30.md` says the Pickpocket's buying markup reaches every stock line except the three flat-priced tools. It does not: potions, food, lockpicks and the sealed scroll are flat too (row `pickpocket-shops`, Q8).

## Balance calls

Written for the user: each question has the rows it covers, the numbers, and a recommended answer to accept or change. Q1 to Q7 were put to the user before this audit ran and are answered (see Rulings). Q8 is the one question this audit found; it was answered A on 2026-10-01. No bot runs follow (Phase 92 measures balance once) and Phase 91.1 reviews weak or tiny traits afterwards, so Q8 covers only a text-versus-engine mismatch.

### Q1 The Pickpocket's extra gold take (answered B)

**Rows:** `pickpocket-take`, `pickpocket-item`. **Today:** `gainWilmst` adds `round((d10 + d10) × 10 × depth / 10) + d4` to every find of coin; IDENT-18 adds an extra item.

- **A (the recommended default): keep both.** The ruling adds a good and removes nothing.
- **B (answered): the extra item replaces the gold take.** The Pickpocket's bonus in `gainWilmst` goes away; the blurb states the extra item and the shop drawback only.

### Q2 The Cleric's "more hit points" (answered A)

**Rows:** `unstated:cleric-mail`, `cleric-hit`, `chart-never`. **Today:** no Cleric hit-point rule exists; the Mail is armour, not hit points.

- **A (answered): no new HP rule.** The blurb states the real trade (chain mail, +1 to hit over other Magic Users) and the offense ban.
- **B: a Cleric gets more hit points** (the user names the rule, e.g. +N HP per level).

### Q3 A Cleric reading a scroll that rolls an offense spell (answered B)

**Rows:** `unstated:cleric-scroll`. **Today:** `readScroll`'s magicUser path free-casts a spell the book cannot hold.

- **A (the recommended default): nothing casts for a Cleric** (the scroll is spent and a line says so).
- **B (answered): RULES-10 stands.** A scroll pays for itself, even for a Cleric: the ban covers the Cleric's own book and learning; the blurb says so plainly.

### Q4 The Wilmsry's "potions heal twice as much" (answered A)

**Rows:** `race-heal2x`. **Today:** only the stock potion doubles; a found Healing or Xtra Healing potion and a healing item do not.

- **A (answered): every healing potion the Wilmsry drinks heals double** (engine to text).
- **B: the text says only the stock healing potion.**

### Q5 The race price multiplier on selling (answered A)

**Rows:** `elven-prices`, `dwarven-prices`, `troll-prices`. **Today:** `sellPriceFor` routes through `priceFor`: a Troll is paid triple, an Elf or Dwarf half.

- **A (answered): stores pay every race the ordinary price;** the race multiplier is a buying rule only.
- **B: keep it and state it in the race text.**

### Q6 The Fridgian frenzy when the first swing kills (answered A)

**Rows:** `race-frenzy`. **Today:** the second swing is lost when the first swing fells the target.

- **A (answered): the second swing is lost,** and the text says so.
- **B: it carries to the next live foe.**

### Q7 Body traits on a Joiner (answered A)

**Rows:** `race-hide` (and Hardiness, built in Phase 90 plan 10). **Today:** `applyFoeDamageToMember` reads no hide, so a Fridgian Joiner soaks nothing.

- **A (answered): a Joiner's own race and skill traits that protect its body apply like the hero's** (a Fridgian Joiner's hide soaks 2 of every blow; Hardiness likewise).
- **B: hero only,** stated on the Company panel.

### Q8 Which store lines the race and Pickpocket price rules reach (answered A)

**Rows:** `elven-prices`, `dwarven-prices`, `troll-prices`, `pickpocket-shops`. **Today:** the footer lines say "store prices halved", "store prices triple" and "shops charge you a quarter more", and the Troll blurb says "Everything you own cost triple", but `openStore` routes only the weapon, armour, premium-piece, repair and ration lines through `priceFor`. Potions, food, lockpicks, the sealed scroll and the three tools cost the same for everyone (the Wilmsry's 30% haggle is the one rule that does reach every line). Measured on one seed: a Healing potion costs 150 for a Human, an Elf and a Troll alike, while a Broadsword costs 550, 275 and 3,300. The rulebook says "Troll armor and weapons cost triple" and the cost footnote sits under the weapon and armour tables (p.12, p.44), and the frozen prototype routes the weapon, armour, premium and repair lines the same way (L119, L1574 to L1586; the ration line is newer), so canon matches the engine here; only the player-facing text claims more. Your Troll ruling (IDENT-21: prices doubled) and Q5 are built on whichever lines this decides.

- **A (answered, against the recommendation): engine to text.** Every stock line except the three flat-priced tools goes through the race and Pickpocket rule: an Elf or Dwarf pays 75 for a Healing potion (150 today) and half for food and lockpicks, a Troll pays double after IDENT-21 (300 for the potion), a Pickpocket pays 188. This is a large economy move that no bot pass has measured and that departs from canon (plan 91-08 builds it with the Troll prices; the footer and blurbs then stay as they read).
- **B (the recommended default): text to engine.** The footer lines and blurbs name the lines the rule reaches: "weapons, armour, repairs and rations cost half / double / a quarter more". No economy change, canon and the prototype stay as they are (plan 91-10 words it; the Troll's doubling is built by 91-08 on those lines).

## Rulings

The user answered Q1 to Q7 on 2026-09-30, before this audit ran (91-CONTEXT "Checkpoint Q1-Q7 answered early"); Q8 and the shield ruling were answered at the batched checkpoint on 2026-10-01.

- Q1 (2026-09-30): B. The extra item (IDENT-18) REPLACES the extra-gold take: `gainWilmst`'s Pickpocket bonus goes away; the blurb states the extra item and the shop drawback only.
  Built by 91-08 (engine and its pin) and 91-10 (text).
- Q2 (2026-09-30): A. No new HP rule; the blurb states the real trade (chain mail, +1 to hit over other Magic Users) and the offense ban.
  Built by 91-10 (text). The ruling's list also named "a shield": the game carries no shield (no Shield armour exists in `ARMORS` or anywhere else in the engine), so 91-10 states the chain mail and the +1 to hit and drops the shield claim, and the Woodsman's "no shield" goes with it.
- Q3 (2026-09-30): B. RULES-10 stands: a scroll that rolls an offense spell still casts for a Cleric (the scroll pays for itself). The offense ban covers the Cleric's own grimoire and learning only; the Cleric blurb says so plainly (e.g. "cannot learn or cast offensive spells, though a scroll will still fire one").
  Built by 91-09 (a pin that the scroll path still casts for a Cleric; no engine change) and 91-10 (text).
- Q4 (2026-09-30): A. Every healing potion the Wilmsry drinks heals double (found Healing and Xtra Healing too).
  Built by 91-09 (engine).
- Q5 (2026-09-30): A. Stores pay every race the ordinary price; the race multiplier is a buying rule only.
  Built by 91-08, with the Troll prices.
- Q6 (2026-09-30): A. The Fridgian's second swing is lost when the first kills; the text says so.
  Built by 91-10 (text; 91-09 builds the new frenzy odds, IDENT-20).
- Q7 (2026-09-30): A. A Joiner's own race and skill traits that protect its body apply like the hero's (a Fridgian Joiner's hide soaks 2 of every blow; Hardiness likewise, built in Phase 90 plan 10).
  Built by 91-09 (engine: `applyFoeDamageToMember` reads the hide).
- Q8 (2026-10-01): A, engine to text, against the recommended default. Every store stock line except the three flat-priced tools (Torch, Rope, Ladder) goes through the race and Pickpocket price rule: potions, food, lockpicks and the sealed scroll included (Elf and Dwarf half, Troll double after IDENT-21, Pickpocket +25%). Q5 still holds: selling pays every race the ordinary price. The footer lines and blurbs stay as they read; 91-10 checks them against the built numbers.
  Built by 91-08, with the Troll prices and the Q5 sell price (engine: route every non-tool line of `economy.js#openStore` through `priceFor`; Phase 92 measures the store economy once).
- Shield (2026-10-01): the user agreed to drop "a shield" from the Cleric blurb (the Q2 ruling's list named it) and the Woodsman's "no shield": the game has no shields.
  Built by 91-10 (text).
