# Value ledger (VALUE-01 to VALUE-04)

**Phase:** 91.1-value-review-races-sub-classes-abilities (plan 91.1-01)
**Date:** 2026-10-01
**Status:** open. The rulings on the batched checkpoint are recorded (2026-10-01) and every row carries its verdict; the build plans 91.1-02, 91.1-03 and 91.1-05 have not built anything yet (91.1-04 owns nothing).

This is the value ledger the user asked for on 2026-09-29: "iterate over every sub-class and every race and every ability and once again make sure we've accounted for all systems in the text ... If a system seems like it provides little or no value ... surface these things so we can modify them, or add new systems. Also, check for very low bonuses, or effects that only last for a single round ... re-visit once per combat skills again". It builds on the four closed audits (`docs/ITEM-AUDIT.md`, `docs/SPELL-AUDIT.md`, `docs/SKILL-AUDIT.md`, `docs/IDENTITY-AUDIT.md`) and judges value, not text against engine: an `exists` below comes from the closed audits' final verdicts and their engine sites, a system the text names that the engine does not run is marked `GAP`, and everything weak, tiny, one-round or once-per-fight is flagged with a recommendation and a numbered question. Every question is put to the user in one batched checkpoint before anything is built. `test/unit/value-ledger.test.js` keeps the ledger honest: a missing, duplicate or out-of-order row, an empty cell, an unknown token, a flagged system with no question or no matching recommendation, a question no row cites, a missing known finding and (once rulings land) an ownership table that disagrees with the verdicts all fail it.

## How to read this ledger

**Columns.** Every table has the same seven columns: `Entry` (the race, sub-class, skill, ability or cross-cutting system, spelled exactly as the content spells it), `Systems named → exists`, `Value flags`, `Recommendation`, `Q`, `Verdict`, `Pinned by`. One row per entity; the systems are listed inside the Systems cell, so the doc stays readable and each flagged system stays one question.

**Systems named → exists.** A race or sub-class row names, one item per entry id of its identity footer (`src/browser/identityFooter.js#identityEntries`), the backticked id, its side, the footer line with its numbers, and `exists` with the engine site that confirms it (the closed identity audit's Engine cell), or `GAP` with what is missing. A system the engine runs for the hero only reads `exists for the hero` plus `GAP` for the Joiner. A chart bonus in a school the footer does not state is an `unstated:chart-<school>` item marked `GAP`: the number changes no roll. An ability row quotes the live `txt` (and `txt2`), lists each system the text names as an id with its number and `exists` (the SKILL-AUDIT row's engine site), then `timing` (counted in foe turns: an effect runs first, its cooldown starts after it, and the foe turn of the use round ticks a fresh timer once), then `who` can use it (the hero, and a Joiner). Human has no systems.

**Value flags** (cell: `—`, or `flag@id` items joined by `; `; the id is a backticked id of the same row's Systems cell). Six flags, nothing else:

- `low-bonus`: a bonus that moves what it modifies by under about 10 percent (under 5 points of hit chance, or under about 1.7 damage, which is 10 percent of a level 3 swing, or a soak or a heal of 2 or less). The yardstick numbers are below.
- `no-value`: changes no roll, is unreachable, or never matters at the depths a run reaches (the average run ends on floors 5 to 7).
- `one-round`: an effect that covers one foe turn or one blow.
- `once-per-fight`: a `cd: "fight"` ability, Sing, and any skill or sub-class system that works only on the first blow or the first strike of a fight. Each carries a question that decides whether it deserves more than one use (VALUE-03).
- `gap`: the text, or a twin row, names a system the engine does not run, or the engine runs it without a rule its twins carry (a limit, a ban). The Systems item says `GAP:` and what.
- `joiner-gap`: the hero has the system and a Joiner of the same identity does not, or the reverse. The Systems item says `GAP:`.

**The yardstick in numbers** (read from the engine and the bestiary on 2026-10-01; the questions quote these):

- To-hit: the strike die is a d20, d12, d10, d8, d6 at levels 1 to 5, and a class hits on its top N faces (Fighter 5, Thief 4, Magic User 3; an Elf at least 5, a Cleric at least 4, an Acrobat 5). A Fighter therefore lands 25, 42, 50, 62 and 83 percent of swings at levels 1 to 5, and one more face is worth 5, 8, 10, 12 and 17 points of that.
- Damage per swing is level² + weapon dice + proficiency + bonuses. A Soldier with a Long Sword averages 8.5, 16.5 and 32.5 at levels 1, 3 and 5; a Knight with an Awl Pike 12, 20 and 36; a Cutthroat 6.5, 14.5 and 30.5; a Pickpocket 3.3, 11.3 and 27.3. A flat +1 is 12 percent of a level 1 Soldier swing, 6 of level 3 and 3 of level 5; a flat +2 is 24, 12 and 6.
- Foe hit points after depth scaling, by floor: floor 1 averages 6 (1 to 10), floors 2 to 5 average 16 (5 to 32), floors 6 to 9 average 23 (8 to 46), floors 10 to 14 average 33 (5 to 88), floors 15 to 19 average 70 (13 to 138), floor 20 and deeper average 93 (17 to 183, with elites). A foe blow is level² + d6: 4.5, 7.5, 12.5, 19.5 and 28.5 for foe tiers 1 to 5 (tier 1 on floor 1, tier 2 on floors 2 to 5, tier 3 on 6 to 9, tier 4 on 10 to 14, tier 5 from 15).
- Foe count: solo about half of the fights on floors 1 to 4, a quarter on floors 5 to 9, never from floor 10 (at least two foes), at least three from floor 20. A foe is dragged down one tier one time in four.
- A parley succeeds on 9 + bonuses + your level − the top foe level faces of a d20 (5 points a face, at most 17 faces).

**Recommendation** (cell: `keep`, or `cleanup@id` on a dead-code row, or one `rec@id: the proposed change in numbers` item per flagged system joined by `; `). The rec is one of: `keep`; `buff` (raise a number, or give a Joiner the system); `lengthen` (more rounds or blows); `rework` (change the shape of the effect); `allow more uses`; `cut` (remove a dead number or a system); `new system`; `engine to text` (the engine is changed to do what the text says); `text to engine` (the text is changed to say what the engine does). The recommendation shown is the recommended default of the covering question. Defaults are modest (one number, one rule) and lean to keep when the user already ruled the shape.

**Q** is `—` or the questions that cover the row's flags (`V1, V2`). **Verdict** parts are joined by `; `: `ok` (nothing flagged); `question (V1)` (waits for the ruling); `ruled keep (V1, <date>)` (the ruling builds nothing); `ruled (V1, <date>) -> 91.1-0N` with an optional ` - note` (the user ruled a change that plan 91.1-0N builds); `built (91.1-0N)`; `cleanup (91.1-05)` and `cleaned (91.1-05)` for the two dead-code rows. **Pinned by** is `—` until a build plan pins its row with `test/unit/<file>.test.js: <test title>` items joined by `; `.

**Owners** of a build: 91.1-02 Fighter and Thief skills and abilities (`content/abilities.js`, `content/skills.js`, `engine/abilities.js`); 91.1-03 hero race and sub-class systems, the Bard's Sing and songs, and engine rules that are not about a Joiner; 91.1-04 Joiner parity (a Joiner lacking what the hero has); 91.1-05 text-only rulings, the dead-code cleanup and the close. A question whose options span two owners names both.

**Questions** are numbered V1 upward in part order (Q1 to Q11 belong to the spell, skill, item and identity audits). Part A (once per fight) has 7 questions, B (one round) 1, C (low bonus or no value on a skill or ability) 6, D (races) 3, E, F and G (Magic User, Fighter and Thief sub-classes) 3, 4 and 3, H (Joiner parity and the cross-cutting rules) 10. A question never mixes parts.

**Rulings that stand and are not reopened** (a flagged entry whose current shape was ruled gets recommendation `keep`, and its question says "ruled <date>, asked only because VALUE-0N names it"): the identity rulings of 2026-09-30 and 2026-10-01 (`docs/IDENTITY-AUDIT.md` Rulings), Q10 and Q11 in `docs/SKILL-AUDIT.md`, Pommel Strike's shape (ABIL-07), the Cleric's offense ban (IDENT-15), the Master of Arms and the Samurai never leaving a fight, the Bard's once-per-fight Sing (IDENT-17), the price rules (IDENT-21, Q5, Q8), RULES-11 (size), RULES-03 (the Summoner), RULES-10 (anyone may read a scroll) and the 2026-09-27 ruling in `content/abilities.js`'s header ("Skills that can essentially one shot should be once per combat": Kata, Death Touch, Overhead Blow, Silent Step, Feint and Last Stand).

**No bot pass in this phase.** Phase 92 measures the net effect of everything built here once, so a small change in one number beats a rework.

## Races

Rows follow `RACES` key order (Human, Elven, Dwarven, Wilmsry, Fridgian, Troll).

| Entry | Systems named → exists | Value flags | Recommendation | Q | Verdict | Pinned by |
|---|---|---|---|---|---|---|
| Human | No systems: `human-neutral` (neutral): No advantages and no disadvantages: every other race is measured against this one. — exists (`RACES.Human`: no field differs from the yardstick, so it has no systems) | — | keep | — | ok | — |
| Elven | `elven-prices` (good): store prices halved (torches, rope and ladders aside) — exists (`economy.js#priceFor`, `economy.js#openStore`); `elven-humans` (good): can always parley with Humans, +3 on that parley roll — exists (`combat.js#canParley`); `race-size-dmg` (bad): being small costs 2 damage — exists (`derived.js#sizeAxisStep`, `derived.js#weaponDamage`); `race-hp-mul` (bad): 60% of the usual HP, at every level — exists (`character.js#rollCharacter`, `character.js#checkLevel`); `race-strike-step` (good): your strike die is one size smaller (a d12 at level 1, not a d20), so you hit more often — exists for the hero (`derived.js#strikeDie`) — GAP: an Elf Illusionist's better die is cancelled at levels 1 and 2, because the Illusionist's d20 rule runs after it (K16); `race-foe-to-hit` (bad): foes +1 to hit you — exists (`derived.js#raceFoeToHit`, `derived.js#foeToHitVs`); `race-to-hit` (good): you hit on at least the top five numbers of your strike die (16–20 on a d20), whatever the class — exists (`derived.js#classNeed`, `derived.js#memberToHit`) | gap@race-strike-step | engine to text@race-strike-step: the Elf's smaller die applies on top of the Illusionist's d20 (a d12 at level 1, a d10 at level 2) (ruled V15 B) | V15 | ruled (V15, 2026-10-01) -> 91.1-03 | — |
| Dwarven | `dwarven-prices` (good): store prices halved (torches, rope and ladders aside) — exists (`economy.js#priceFor`, `#openStore`); `race-size-face` (good): being small means foes −1 to hit you — exists (`derived.js#foeToHitVs`); `race-upkeep` (good): a night without rations costs only 1 HP (a Human's costs 4) — exists (`movement.js#newDay`, `derived.js#upkeep`); `race-dmg` (good): +2 damage with every weapon — exists (`derived.js#weaponDamageTerms`); `race-foe-strike-step` (bad): foes strike on a die one size smaller (a d12 for a level 1 foe, never below a d8), so they hit you more often — exists (`derived.js#foeDie`); `race-armor-wear` (good): armour wears at half the rate — exists (`combat.js#applyFoeDamageToPlayer`, `#applyFoeDamageToMember`) | low-bonus@race-dmg | buff@race-dmg: +2 -> +3 damage with every weapon (level 3: 18 percent of a swing instead of 12) | V16 | ruled (V16, 2026-10-01) -> 91.1-03 | — |
| Wilmsry | `wilmsry-talk` (good): can always parley with anything but Magical foes and the Walking Dead; +4 on every parley roll — exists (`combat.js#canParley`, `combat.js#parleyBlockedReason`); `wilmsry-haggle` (good): store prices 30% off — exists (`economy.js#openStore`); `wilmsry-joiners` (bad): you refuse to take Magic User Joiners on — exists (`encounters.js#meetJoiner`); `race-heal2x` (good): rest, potions and your own healing spells heal twice as much — exists (`movement.js#newDay`, `magic.js#castSpell`); `race-sp-mul` (bad): half the experience from every kill — exists (`derived.js#killSpFor`) | — | keep | — | ok | — |
| Fridgian | `race-no-armor` (bad): can never wear armour — exists (`items.js#armorRefusalReason`); `race-no-samurai` (bad): can never be a Samurai (the job comes with plate) — exists (`character.js#rollCharacter`, `character.js#normalizeForce`); `race-frenzy` (good): each time you strike, a 4–6 on a d6 gives you a second, wilder swing (−1 to hit) — exists for the hero (`combat.js#playerStrike`) — GAP: a Joiner Fridgian never frenzies (hero only, K12); `race-slow` (bad): never wins initiative — exists (`combat.js#resolveInitiative`); `race-hide` (good): thick hide soaks 2 from every blow — exists (`combat.js#applyFoeDamageToPlayer`, `#applyFoeDamageToMember`) | low-bonus@race-hide; joiner-gap@race-frenzy | buff@race-hide: soak 2 -> 3 from every blow (floor 1); keep@race-frenzy: stays hero only (ruled V33 A) | V17, V33 | ruled (V17, 2026-10-01) -> 91.1-03; ruled keep (V33, 2026-10-01) | — |
| Troll | `troll-prices` (bad): store prices doubled (torches, rope and ladders aside) — exists (`economy.js#priceFor`, `economy.js#openStore`); `race-size-face` (bad): being large means foes +1 to hit you — exists (`derived.js#foeToHitVs`); `race-upkeep` (bad): a night without rations costs 15 HP (a Human's costs 4) — exists (`movement.js#newDay`, `derived.js#upkeep`); `race-flat-hp` (good): starts with 75 HP whatever the class — exists (`character.js#rollCharacter`); `race-dmg` (good): +11 damage with every weapon (2 of it for being large) — exists (`derived.js#weaponDamageTerms`); `race-eats` (bad): eats two rations a night — exists (`movement.js#eatsFor`, `#nightlyEats`) | — | keep | — | ok | — |

## Sub-classes

Rows follow `CLASSES[cls].subs` order inside each class.

### Magic User

| Entry | Systems named → exists | Value flags | Recommendation | Q | Verdict | Pinned by |
|---|---|---|---|---|---|---|
| Wizard | `wizard-day-one` (good): always starts with a level 1 direct-damage spell it can cast on day one — exists (`character.js#topUpWizardDamage`, `derived.js#dealsDamage`); `wizard-melee` (bad): won't swing a weapon while a castable attack spell and a charge remain — exists (`combat.js#playerStrike`, `derived.js#castableAttackSpells`); `chart-bonus-offense` (good): +3 to hit with thrown offense spells — exists (`derived.js#schoolBonus`, `magic.js#castSpell`); `chart-never` (bad): never learns illusion spells — exists (`content/mu-chart.js`, `derived.js#schoolAllowed`) | — | keep | — | ok | — |
| Warlock | `warlock-potion` (good): copies a potion every night it has one — exists for the hero (`movement.js#newDay`) — GAP: a Joiner Warlock copies no potion (hero only, K12); `warlock-undead` (bad): every Walking Dead foe in the fight gains HP equal to your level — exists for the hero (`combat.js#startCombat`) — GAP: a Joiner Warlock does not prop up the Walking Dead (hero only, K12); `chart-bonus-offense` (good): +4 to hit with thrown offense spells — exists (`derived.js#schoolBonus`, `magic.js#castSpell`); `chart-gate-protection` (bad): no protection spells until level 4 — exists (`content/mu-chart.js`, `derived.js#schoolGate`); `chart-gate-healing` (bad): no healing spells until level 3 — exists (`content/mu-chart.js`, `derived.js#schoolGate`); `chart-never` (bad): never learns special or illusion spells — exists (`content/mu-chart.js`, `derived.js#schoolAllowed`); `unstated:chart-divination` (chart): the divination bonus of 2 changes no roll — GAP: rulebook p.18 says it adds to damage, number affected, additional healing or squares, but no divination spell reads it (K01) | no-value@unstated:chart-divination; joiner-gap@warlock-potion; joiner-gap@warlock-undead | cut@unstated:chart-divination: divination 2 -> 0 (no divination spell reads a number); keep@warlock-potion: stays hero only (ruled V35 A); keep@warlock-undead: stays hero only | V18, V35, V37 | ruled (V18, 2026-10-01) -> 91.1-03; ruled keep (V35, 2026-10-01); ruled keep (V37, 2026-10-01) | — |
| Sorcerer | `sorcerer-book` (good): starts with Freeze and Fireball in the book — exists (`character.js#rollGrimoire`); `sorcerer-levels` (good): learns two new spells at every level — exists (`character.js#checkLevel`); `sorcerer-arm` (bad): weapon damage never goes above 9 — exists (`derived.js#weaponDamageTerms`); `sorcerer-forgets` (bad): one level-up in eight forgets a spell that isn't Freeze, Fireball or Lightning — exists (`character.js#checkLevel`); `chart-bonus-offense` (good): +4 to hit with thrown offense spells — exists (`derived.js#schoolBonus`, `magic.js#castSpell`); `chart-gate-healing` (bad): no healing spells until level 4 — exists (`content/mu-chart.js`, `derived.js#schoolGate`); `chart-stretch-special` (good): your Open/Lock, Fly, Enchant Character and Speed of Sound last 10 squares longer, and Stop Time lasts 1 round longer — exists (`derived.js#spellEffectSquares`, `derived.js#spellEffectRounds`); `chart-never` (bad): never learns illusion spells — exists (`content/mu-chart.js`, `derived.js#schoolAllowed`); `unstated:chart-protection` (chart): the protection bonus of 1 changes no roll — GAP: rulebook p.18 says it adds to damage, number affected, additional healing or squares, but no protection spell reads it (K01); `unstated:chart-divination` (chart): the divination bonus of 3 changes no roll — GAP: rulebook p.18 says it adds to damage, number affected, additional healing or squares, but no divination spell reads it (K01) | no-value@unstated:chart-protection; no-value@unstated:chart-divination | buff@unstated:chart-protection: protection 1 -> Shield +5 hit points of soak and Bubble +5 hit points of film; cut@unstated:chart-divination: divination 3 -> 0 | V18 | ruled (V18, 2026-10-01) -> 91.1-03 | — |
| Summoner | `summoner-summon` (good): a Summon is always in the book from day one — exists (`character.js#rollGrimoire`); `summoner-doubled` (good): a full Summon arrives a level stronger, and its duration die counts double — exists (`magic.js#castSpell`); `summoner-backfire` (bad): one full Summon in eight turns on you — exists (`magic.js#castSpell`); `chart-stretch-special` (good): your Open/Lock, Fly, Enchant Character and Speed of Sound last 10 squares longer, and Stop Time lasts 1 round longer — exists (`derived.js#spellEffectSquares`, `derived.js#spellEffectRounds`); `chart-never` (bad): never learns illusion spells — exists (`content/mu-chart.js`, `derived.js#schoolAllowed`); `chart-healmul` (bad): healing spells you cast heal at half strength — exists (`derived.js#healMulFor`); `chart-override-Summon` (good): Summon castable from level 1 (level 2 for everyone else) — exists (`content/spell-level-overrides.js`, `derived.js#spellLevelFor`); `unstated:chart-protection` (chart): the protection bonus of 2 changes no roll — GAP: rulebook p.18 says it adds to damage, number affected, additional healing or squares, but no protection spell reads it (K01); `unstated:chart-divination` (chart): the divination bonus of 4 changes no roll — GAP: rulebook p.18 says it adds to damage, number affected, additional healing or squares, but no divination spell reads it (K01) | no-value@unstated:chart-protection; no-value@unstated:chart-divination | buff@unstated:chart-protection: protection 2 -> Shield +10 and Bubble +10; cut@unstated:chart-divination: divination 4 -> 0 | V18 | ruled (V18, 2026-10-01) -> 91.1-03 | — |
| Cleric | `cleric-heal` (good): every healing spell heals 3 more — exists (`magic.js#castSpell`, `combat.js#allyCast`); `cleric-hit` (good): +1 to hit over other Magic Users (17–20 on a d20 at level 1) — exists (`derived.js#classNeed`, `derived.js#memberToHit`); `cleric-heal-start` (good): always starts with Heal in the book — exists (`character.js#rollGrimoire`); `cleric-mail` (good): starts in chain mail, where every other Magic User starts in cloth — exists (`character.js#rollCharacter`); `chart-never` (bad): never learns offense, special or illusion spells — exists for the hero (`content/mu-chart.js`, `derived.js#schoolAllowed`) — GAP: the ban takes the offense school's buff, Strength, along with its attacks (K18); `chart-gate-divination` (bad): no divination spells until level 3 — exists (`content/mu-chart.js`, `derived.js#schoolGate`); `unstated:chart-protection` (chart): the protection bonus of 3 changes no roll — GAP: rulebook p.18 says it adds to damage, number affected, additional healing or squares, but no protection spell reads it (K01); `unstated:chart-healing` (chart): the healing bonus of 4 changes no roll (the Cleric's real heal bonus is the separate +3 rule `cleric-heal`) — GAP: rulebook p.18 says it adds to damage, number affected, additional healing or squares, but no healing spell reads it (K01); `unstated:cleric-scroll` (unstated): a scroll that rolls an offense spell still free-casts for a Cleric (RULES-10, ruled Q3) — exists (`magic.js#readScroll`) | no-value@unstated:chart-protection; no-value@unstated:chart-healing; gap@chart-never | buff@unstated:chart-protection: protection 3 -> Shield +15 and Bubble +15; buff@unstated:chart-healing: healing 4 becomes the Cleric's heal bonus (+4, replacing the separate +3 rule); rework@chart-never: a Cleric may learn Strength, one exception in the chart (ruled V20 B) | V18, V20 | ruled (V18, 2026-10-01) -> 91.1-03; ruled (V20, 2026-10-01) -> 91.1-03 | — |
| Illusionist | `illusionist-teleport` (good): you choose where every teleport lands: any explored floor square up to 12 away in the 8 directions, or let it choose — exists (`movement.js#teleport`, `movement.js#teleportTargets`); `illusionist-book` (good): starts with Mirror Self, Door Illusion and one random Illusion spell — exists (`character.js#rollGrimoire`); `illusionist-d20` (bad): strikes on a d20 until level 3 — exists (`derived.js#strikeDie`); `chart-gate-protection` (bad): no protection spells until level 3 — exists (`content/mu-chart.js`, `derived.js#schoolGate`); `chart-never` (bad): never learns healing spells — exists (`content/mu-chart.js`, `derived.js#schoolAllowed`); `chart-stretch-special` (good): your Open/Lock, Fly, Enchant Character and Speed of Sound last 40 squares longer, and Stop Time lasts 4 rounds longer — exists (`derived.js#spellEffectSquares`, `derived.js#spellEffectRounds`); `unstated:chart-divination` (chart): the divination bonus of 1 changes no roll — GAP: rulebook p.18 says it adds to damage, number affected, additional healing or squares, but no divination spell reads it (K01); `unstated:chart-illusion` (chart): the Illusion bonus is 0 — GAP: Senseless and Duplicate Foe stretch by one round per bonus point, so the stretch gives nothing (K02) | no-value@unstated:chart-divination; no-value@unstated:chart-illusion | cut@unstated:chart-divination: divination 1 -> 0; buff@unstated:chart-illusion: illusion 0 -> 1 (Senseless and Duplicate Foe last 1 round longer) | V18, V19 | ruled (V18, 2026-10-01) -> 91.1-03; ruled (V19, 2026-10-01) -> 91.1-03 | — |
| Court Mage | `court-mage-boredom` (good): one foe in six dies of boredom before the fight starts — exists (`combat.js#startCombat`, `combat.js#killFoe`); `court-mage-humans` (good): can always parley with Humans — exists (`combat.js#canParley`); `court-mage-first` (bad): foes act first in round one — exists (`combat.js#resolveInitiative`); `chart-bonus-offense` (good): +2 to hit with thrown offense spells — exists (`derived.js#schoolBonus`, `magic.js#castSpell`); `chart-gate-divination` (bad): no divination spells until level 4 — exists (`content/mu-chart.js`, `derived.js#schoolGate`); `chart-never` (bad): never learns special or illusion spells — exists (`content/mu-chart.js`, `derived.js#schoolAllowed`); `unstated:chart-protection` (chart): the protection bonus of 2 changes no roll — GAP: rulebook p.18 says it adds to damage, number affected, additional healing or squares, but no protection spell reads it (K01); `unstated:chart-healing` (chart): the healing bonus of 1 changes no roll — GAP: rulebook p.18 says it adds to damage, number affected, additional healing or squares, but no healing spell reads it (K01) | no-value@unstated:chart-protection; no-value@unstated:chart-healing | buff@unstated:chart-protection: protection 2 -> Shield +10 and Bubble +10; buff@unstated:chart-healing: healing 1 -> every heal +1 | V18 | ruled (V18, 2026-10-01) -> 91.1-03 | — |
| Apprentice | `apprentice-xp` (good): double experience from kills until level 3 — exists (`derived.js#killSpFor`); `apprentice-illusion` (good): may learn Illusion spells, which no other Magic User but the Illusionist can — exists (`content/mu-chart.js`); `apprentice-backfire` (bad): one of your own spells in eight backfires — exists for the hero (`magic.js#castSpell`, `combat.js#allyCast`) — GAP: a Joiner Apprentice never backfires (hero only, K12); `chart-gate-divination` (bad): no divination spells until level 3 — exists (`content/mu-chart.js`, `derived.js#schoolGate`); `unstated:chart-illusion` (chart): the Illusion bonus is 0 — GAP: Senseless and Duplicate Foe stretch by one round per bonus point, so the stretch gives nothing (K02); `unstated:apprentice-reveal` (unstated): at level 3 the sub becomes a random other Magic User sub, and the book keeps what that sub could be granted — exists (`character.js#checkLevel`) | no-value@unstated:chart-illusion; joiner-gap@apprentice-backfire | keep@unstated:chart-illusion: stays 0: the Apprentice is the generalist; keep@apprentice-backfire: stays, a Joiner Apprentice never backfires | V19, V37 | ruled keep (V19, 2026-10-01); ruled keep (V37, 2026-10-01) | — |

### Fighter

| Entry | Systems named → exists | Value flags | Recommendation | Q | Verdict | Pinned by |
|---|---|---|---|---|---|---|
| Knight | `knight-small` (good): any foe under 5 HP flees before it can act — exists (`combat.js#startCombat`); `knight-big` (bad): never wins initiative against a foe with 20 HP or more — exists (`combat.js#knightFacesBigFoe`, `combat.js#resolveInitiative`) | no-value@knight-small | keep@knight-small: stays under 5 hit points (ruled V21 A) | V21 | ruled keep (V21, 2026-10-01) | — |
| Guard | `guard-hard` (good): foes −1 to hit you — exists (`derived.js#foeToHitVs`); `guard-weak` (bad): your blows deal 3 less at level 1, one less each level until level 4 — exists (`derived.js#weaponDamageTerms`); `guard-nocrit` (bad): your blows never crit — exists (`combat.js#playerStrike`, `#memberStrike`) | — | keep | — | ok | — |
| Woodsman | `woodsman-talk` (good): can always parley with Beasts and Lair Beasts; +3 on every parley roll — exists (`combat.js#canParley`); `woodsman-armor` (bad): no armour heavier than Studded — exists (`items.js#armorRefusalReason`, `character.js#rollCharacter`); `unstated:woodsman-kit` (unstated): starts with a Quarter Staff at proficiency 3 (+3 damage) and Leather armour, where the other Fighters start in Studded — exists (`content/kit.js#KIT`, `character.js#rollCharacter`) | — | keep | — | ok | — |
| Soldier | `soldier-camp` (good): camp heals you twice as much — exists for the hero (`movement.js#newDay`) — GAP: nothing heals a Joiner at camp (`newDay` heals the hero's hit points only), so a Joiner Soldier has no camp heal to double (K12); `soldier-knighted` (good): knighted at level 3: you become a Knight and swap your weapon for an Awl Pike — exists (`character.js#checkLevel`); `soldier-crit` (bad): foes crit you on 19–20 on a d20, not just 20 — exists for the hero (`combat.js#foeTurn`, `#pursuitStrike`) — GAP: a Joiner Soldier is crit only on the top face of the foe's die (hero only, K12); `soldier-nocrit` (bad): your blows never crit — exists (`derived.js#noCritFor`, `combat.js#playerStrike`) | joiner-gap@soldier-camp; joiner-gap@soldier-crit | keep@soldier-camp: stays, nothing heals a Joiner at camp; keep@soldier-crit: stays, a Joiner Soldier is critted only on the top face | V36, V37 | ruled keep (V36, 2026-10-01); ruled keep (V37, 2026-10-01) | — |
| Barbarian | `barbarian-two` (good): two attacks every strike — exists for the hero (`combat.js#playerStrike`) — GAP: a Joiner Barbarian swings once (hero only, K12); `barbarian-xp` (bad): half the experience from every kill — exists (`derived.js#killSpFor`) | joiner-gap@barbarian-two | keep@barbarian-two: stays hero only (ruled V33 A) | V33 | ruled keep (V33, 2026-10-01) | — |
| Master of Arms | `moa-damage` (good): +2 damage with every weapon — exists (`derived.js#weaponDamageTerms`, `derived.js#expectedStrike`); `moa-patch` (good): patches your own damaged armour every night in camp — exists for the hero (`movement.js#newDay`) — GAP: no limit on the number of nights, where Sewing stops after 4 patches (K14); a Joiner Master of Arms patches nothing (hero only, K12); `moa-parley` (bad): can never talk a fight down — exists (`combat.js#canParley`, `combat.js#parleyBlockedReason`); `moa-never-leaves` (bad): never leaves a fight once it starts: no running, no withdrawal, no escape — exists (`derived.js#neverFlees`, `combat.js#fleeRefusal`) | low-bonus@moa-damage; gap@moa-patch; joiner-gap@moa-patch | keep@moa-damage: stays +2 (ruled V22 A); keep@moa-patch: stays unlimited: it is the sub-class's second perk; keep@moa-patch: stays hero only (ruled V35 A) | V22, V23, V35 | ruled keep (V22, 2026-10-01); ruled keep (V23, 2026-10-01); ruled keep (V35, 2026-10-01) | — |
| Samurai | `samurai-kit` (good): starts in plate with a magic katana (+2) — exists (`character.js#rollCharacter`); `samurai-never` (bad): never wins initiative and never flees — exists (`combat.js#resolveInitiative`, `#fleeRefusal`) | — | keep | — | ok | — |
| Bard | `bard-humans` (good): can always parley with Humans — exists (`combat.js#canParley`); `bard-song` (good): sings once per fight: a random offense or defense spell up to your level, at full strength, no charges spent — exists (`combat.js#songReady`, `#sing`); `bard-camp` (bad): camp wakes wandering monsters twice as often — exists (`difficulty.js#wanderWakeFacesFor`, `movement.js#newDay`); `bard-target` (bad): foes with intelligence no higher than 3 always attack you when a Joiner is in the fight — exists for the hero (`combat.js#pickFoeTarget`) — GAP: a Joiner Bard does not draw the foes with intelligence 3 or less (hero only, K10); `unstated:song-bonus` (extra): a sung offense spell reads +0 school bonus: a Bard has no chart row, where a Wizard gets +3 on a thrown spell (Freeze lands on 5–10 of a d10 plain, 60 percent, 90 for a Wizard) — GAP: the song is cast through `magic.js#castSpell`'s free mode, `derived.js#schoolBonus` reads 0 for a sub with no chart row (K03); `unstated:joiner-song` (extra): a Joiner Bard's song works through `combat.js#allyCast`, but its sung Turn Walking Dead fixates nothing (aiming it at the hero would break "a Joiner's song never touches the hero") and its Sense Presence helps only its own Stealth crit — GAP: a Joiner Bard's song is a little better than the hero's at Turn Walking Dead (K09); `unstated:joiner-death` (extra): a Joiner Bard's sung Death refuses at 26 hit points or less, as the hero's does, so it can never down its caster — GAP: the cost of a sung Death is 25 hit points and never lethal for a Joiner (K17) | gap@unstated:song-bonus; joiner-gap@bard-target; joiner-gap@unstated:joiner-song; joiner-gap@unstated:joiner-death | keep@unstated:song-bonus: stays +0: a thrown song is 1 in about 6 picks; keep@bard-target: stays hero only; keep@unstated:joiner-song: stays, the Joiner's song is a little better than the hero's; keep@unstated:joiner-death: stays, a Joiner's Death never downs its caster | V24, V31 | ruled keep (V24, 2026-10-01); ruled keep (V31, 2026-10-01) | — |

### Thief

| Entry | Systems named → exists | Value flags | Recommendation | Q | Verdict | Pinned by |
|---|---|---|---|---|---|---|
| Pickpocket | `pickpocket-item` (good): whenever you gain an item from a chest or a monster, you gain one extra item as well — exists (`items.js#pickpocketExtra`, `combat.js#foeSpoils`); `pickpocket-shops` (bad): shops charge you a quarter more (torches, rope and ladders aside) and pay a quarter less — exists (`economy.js#priceFor`, `economy.js#sellPriceFor`) | — | keep | — | ok | — |
| Pilfer | `pilfer-traps` (good): disarms every trap and opens every chest for free — exists (`encounters.js#springTrap`, `#openChest`); `pilfer-fumble` (bad): about one use in twenty, a magic ring, amulet, cloak or staff blows up in your hands for d10 HP and is gone — exists (`items.js#pilferFumbles`, `items.js#rollPilferFumble`) | — | keep | — | ok | — |
| Cat Burglar | `cat-burglar-first` (good): your first strike of every fight always lands — exists for the hero (`combat.js#playerStrike`) — GAP: a Joiner Cat Burglar has no free first strike (hero only, K12); `cat-burglar-traps` (bad): every trap that catches you deals double damage — exists (`encounters.js#springTrap`); `free-skill` (good): starts with the Dirty Trick skill for free — exists (`character.js#rollSkills`, `content/kit.js#FREE_SKILL`) | once-per-fight@cat-burglar-first; joiner-gap@cat-burglar-first | keep@cat-burglar-first: the first strike of the fight only; keep@cat-burglar-first: stays hero only (ruled V34 A) | V6, V34 | ruled keep (V6, 2026-10-01); ruled keep (V34, 2026-10-01) | — |
| Cutthroat | `cutthroat-crit` (good): your first landed blow always crits, even in heavy armour — exists for the hero (`combat.js#playerStrike`) — GAP: the first crit ignores the dark no-crit ban that stops every other crit (K13); a Joiner Cutthroat has no first-blow crit (hero only, K12); `cutthroat-joiner` (bad): whenever you descend with a Joiner, roll a d10: a 1 kills that Joiner — exists (`movement.js#cutthroatMurderCheck`, `movement.js#descend`) | once-per-fight@cutthroat-crit; gap@cutthroat-crit; joiner-gap@cutthroat-crit | keep@cutthroat-crit: the first landed blow of the fight only; text to engine@cutthroat-crit: the text says the first blow crits even in the dark; keep@cutthroat-crit: stays hero only (ruled V34 A) | V6, V26, V34 | ruled keep (V6, 2026-10-01); ruled (V26, 2026-10-01) -> 91.1-05; ruled keep (V34, 2026-10-01) | — |
| Cloaker | `cloaker-vanish` (good): vanishes from any fight for free until you land a blow — exists for the hero (`combat.js#flee`) — GAP: a pursuing Spectre still strikes once as you leave, so the vanish is not free against it (K15); `cloaker-seen` (bad): once you've struck, you flee on the ordinary roll like everyone else — exists (`combat.js#flee`) | gap@cloaker-vanish | engine to text@cloaker-vanish: the vanish also escapes a pursuing Spectre's parting blow (ruled V27 B) | V27 | ruled (V27, 2026-10-01) -> 91.1-03 | — |
| Ninja | `ninja-opener` (good): your opening strike always lands for maximum damage, doubled by the backstab unless you are in heavy armour or the dark — exists for the hero (`combat.js#playerStrike`) — GAP: a Joiner Ninja has no free opener (hero only, K12); `ninja-crit` (good): after that, you crit on the top two numbers of your strike die (19–20 on a d20) — exists for the hero (`combat.js#playerStrike`) — GAP: the later crit ignores the dark no-crit ban that stops every other crit (K13); a Joiner Ninja has no crit range (hero only, K12); `ninja-silent` (bad): can never talk a fight down — exists (`combat.js#canParley`, `combat.js#parleyBlockedReason`); `free-skill` (good): starts with the Silent Step skill for free — exists (`character.js#rollSkills`, `content/kit.js#FREE_SKILL`) | once-per-fight@ninja-opener; gap@ninja-crit; joiner-gap@ninja-opener; joiner-gap@ninja-crit | keep@ninja-opener: the opening strike of the fight only; text to engine@ninja-crit: the text says the later crit works even in the dark; keep@ninja-opener: stays hero only (ruled V34 A); keep@ninja-crit: stays hero only (ruled V34 A) | V6, V26, V34 | ruled keep (V6, 2026-10-01); ruled (V26, 2026-10-01) -> 91.1-05; ruled keep (V34, 2026-10-01) | — |
| Con Artist | `con-artist-talk` (good): can always parley with anything but Magical foes and the Walking Dead; +4 on every parley roll — exists (`combat.js#canParley`); `con-artist-leave` (good): a level 1 foe leaves before the fight two times in three — exists (`combat.js#startCombat`); `con-artist-opener` (bad): your opening blow deals no damage — exists (`combat.js#playerStrike`) | no-value@con-artist-leave | buff@con-artist-leave: level 1 foes leave 2 times in 3 (unchanged), level 2 foes leave 1 time in 3 | V25 | ruled (V25, 2026-10-01) -> 91.1-03 | — |
| Acrobat | `acrobat-dodge` (good): foes hit you only on a high roll (17–20 on a d20) — exists (`derived.js#foeToHitVs`); `acrobat-hit` (good): you hit on 16–20 on a d20 at level 1, like a Fighter (15–20 with the dagger) — exists (`derived.js#classNeed`, `derived.js#memberToHit`); `acrobat-traps` (good): dodges traps on 13–20 on a d20, not 16–20 — exists (`encounters.js#springTrap`); `acrobat-dagger` (bad): a dagger and nothing else — exists (`items.js#canEquipWeapon`); `free-skill` (good): starts with the Smoke skill for free — exists (`character.js#rollSkills`, `content/kit.js#FREE_SKILL`) | — | keep | — | ok | — |

## Abilities

Rows follow `FIGHTER_SKILLS` key order, then `THIEF_SKILLS` key order, then `ABILITY_POOL` (Fighter, then Thief), then Sing. A table skill with an `active` marker and its catalog ability are one row.

### Skills

| Entry | Systems named → exists | Value flags | Recommendation | Q | Verdict | Pinned by |
|---|---|---|---|---|---|---|
| Kata | txt "one perfect form: +3 to hit on this strike, and it adds your level in damage; once per fight"; `kata-once`: once per fight (`cd: "fight"`, spent on use hit or miss, cleared by `endCombat`) — exists (`abilities.js#useAbility` case kata); `kata-hit`: +3 to hit on the one swing (`KATA_FEINT_NEED_SHIFT`) — exists (`combat.js#playerStrike`); `kata-damage`: adds your level in damage — exists (`abilityStrike.bonusDmg`); timing: one swing this round, then spent for the fight; who: hero: `useAbility` case kata; Joiner: uses it (`resolveMemberAbility` cases kata and feint, tag damage, a target above half hp) | once-per-fight@kata-once | allow more uses@kata-once: ready again 4 rounds after the use (ruled V1 B) | V1 | ruled (V1, 2026-10-01) -> 91.1-02 | — |
| Stealth | txt "your first landed blow of a fight crits on the top two numbers of your die (19–20 on a d20), and so does a Joiner's own if it has Stealth; never in plate"; `stealth-crit`: the first landed blow of a fight crits on the top two numbers of your die (19–20 on a d20), never in plate — exists (`combat.js#playerStrike`); `stealth-dark`: never in the dark (the dark bans every crit) — exists for the hero (`combat.js#playerStrike`; a Joiner's stealth crit respects it too) — GAP: a Joiner's OTHER crits ignore the dark ban that stops every hero crit (K06); timing: the first landed blow of the fight only (passive, no use round); who: hero: `playerStrike`; Joiner: its own opening landed blow (`combat.js#memberStrike`, a transient `ally.opened` flag) | once-per-fight@stealth-crit; low-bonus@stealth-crit; joiner-gap@stealth-dark | keep@stealth-crit: the first landed blow of the fight only; buff@stealth-crit: the first landed blow crits on the top 3 numbers of your die (was 2): 18–20 on a d20; keep@stealth-dark: stays, a Joiner's other crits keep ignoring the dark | V6, V12, V29 | ruled keep (V6, 2026-10-01); ruled (V12, 2026-10-01) -> 91.1-02; ruled keep (V29, 2026-10-01) | — |
| Death Touch | txt "call it: one swing, rolled as normal; if it lands it doubles and finishes anything under 15 hp; once per fight"; `death-touch-once`: once per fight — exists (`abilities.js#useAbility` case deathTouch); `death-touch-double`: a landed blow doubles (a forced critical) — exists (`combat.js#playerStrike`); `death-touch-finish`: finishes anything under 15 hp — exists (`abilityStrike.finishUnder`); timing: one swing this round, then spent for the fight; who: hero: `useAbility` case deathTouch; Joiner: uses it (`resolveMemberAbility` case deathTouch, tag damage) | once-per-fight@death-touch-once | keep@death-touch-once: stays once per fight (ruled 2026-09-27) | V2 | ruled keep (V2, 2026-10-01) | — |
| Sidestep | txt "two rounds of not being where the blade is: foes −2 to hit you"; `sidestep-shift`: foes −2 to hit you for two rounds — exists (`derived.js#foeToHitVs`); timing: effect covers the use round's foe turn and the next two (3 foe turns), then a cooldown of 4: ready again 7 foe turns after the use; who: hero: `useAbility` case sidestep; Joiner: uses it (`resolveMemberAbility` case sidestep, tag defensive, below half hp) | — | keep | — | ok | — |
| Hardiness | txt "−3 to every blow, bolt and trap that hurts you (never below 1), and a Joiner with it takes 3 less from each blow; phobias halved"; `hardiness-soak`: −3 to every blow, bolt and trap that hurts you, never below 1 — exists (`combat.js#applyFoeDamageToPlayer`); `hardiness-phobia`: phobias halved — exists (`movement.js`, `combat.js`); timing: passive, always on; who: hero: those sites; Joiner: takes 3 less from each blow (`combat.js#applyFoeDamageToMember`, 90-10) | — | keep | — | ok | — |
| Ambidextrous | txt "two swings every time you strike, each rolling to hit and for damage, and a Joiner with it swings twice on a plain strike; it does not stack with Speed"; `ambidextrous-two`: two swings every time you strike, each rolling to hit and for damage — exists (`combat.js#playerStrike`); `ambidextrous-joiner`: a Joiner with it swings twice on a plain strike — exists for the hero (`combat.js#alliesTurn`) — GAP: a Joiner's strike ABILITIES (Kata, Feint, Overhead Blow, Pommel Strike, Death Touch, Silent Step) are one swing, while the hero's `abilityStrike` runs the same two-swing loop (K05); timing: passive, every strike action; who: hero: `playerStrike`; Joiner: plain strike only (`alliesTurn`) | joiner-gap@ambidextrous-joiner | keep@ambidextrous-joiner: stays as it is (ruled V29 A) | V29 | ruled keep (V29, 2026-10-01) | — |
| Cooking | txt "every beast you kill feeds you: you heal a quarter of its max hp (at least 1) and pocket a ration"; `cooking-heal`: every beast you kill heals a quarter of its max hp (at least 1) — exists (`combat.js#killFoe`); `cooking-ration`: and gives a ration — exists (`combat.js#killFoe`); timing: passive, on every Beasts or Lair Beasts kill; who: hero: `killFoe`; Joiner: cannot (no Joiner code reads its Cooking) | — | keep | — | ok | — |
| Pommel Strike | txt "the blunt end, to the temple: a normal strike, and a hit also costs the target its next turn"; `pommel-strike`: a normal strike (the plain strike's roll and damage) — exists (`combat.js#playerStrike`); `pommel-stun`: a landed blow also costs the target its next turn (one foe turn) — exists (`combat.js#applyPommel`, `foeTurn`); `pommel-opener`: tag opener: a Joiner uses it in round 1 only — exists for the hero (`combat.js#pickMemberAbility`) — GAP: a Joiner never reuses it after round 1, though its cooldown is 4 (K07); timing: instant strike, cooldown 4 spent on use hit or miss; the stun covers 1 foe turn; who: hero: `useAbility` case pommelStrike; Joiner: uses it in round 1 (`resolveMemberAbility` case pommelStrike, tag opener) | one-round@pommel-stun; joiner-gap@pommel-opener | keep@pommel-stun: stays one foe turn (ruled 2026-09-30, ABIL-07); keep@pommel-opener: stays a round-1 move for a Joiner (ruled V30 A) | V8, V30 | ruled keep (V8, 2026-10-01); ruled keep (V30, 2026-10-01) | — |
| Runes/Signs | txt "reads any scroll without fail; without it, a scroll is an intelligence roll that can backfire"; `runes-read`: reads any scroll without fail (no roll, no fumble) — exists (`derived.js#scrollReaderOf`, `magic.js#readScroll`); timing: passive, on every scroll read; who: hero: `readScroll`; Joiner: cannot (the hero reads the party's scrolls) | low-bonus@runes-read | new system@runes-read: a scroll read through Runes/Signs is spent only 5 times in 6 (ruled V14 B) | V14 | ruled (V14, 2026-10-01) -> 91.1-02 | — |
| Battle Roar | txt "loud enough to matter: for two rounds foes −2 to hit anyone on your side"; `battle-roar-shift`: for two rounds foes −2 to hit anyone on your side — exists (`derived.js#foeToHitVs`, `partyEffectActive`); `battle-roar-opener`: tag opener: a Joiner uses it in round 1 only — exists for the hero (`combat.js#pickMemberAbility`) — GAP: a Joiner never reuses it after round 1, though its cooldown is 5 (K07); timing: effect covers the use round's foe turn and the next two (3 foe turns), then a cooldown of 5: ready again 8 foe turns after the use; who: hero: `useAbility` case battleRoar; Joiner: uses it in round 1 (`resolveMemberAbility` case battleRoar, tag opener) | joiner-gap@battle-roar-opener | keep@battle-roar-opener: stays a round-1 move for a Joiner (ruled V30 A) | V30 | ruled keep (V30, 2026-10-01) | — |
| Second Wind | txt "remember why you came: heal d8 + level; once per fight"; `second-wind-once`: once per fight — exists (`abilities.js#useAbility` case secondWind); `second-wind-heal`: heals d8 + level, clamped to max hp — exists (`useAbility` case secondWind); timing: instant, then spent for the fight; who: hero: `useAbility` case secondWind; Joiner: uses it (`resolveMemberAbility` case secondWind, tag defensive, below half hp) | once-per-fight@second-wind-once | allow more uses@second-wind-once: ready again 5 rounds after the use (cooldown 5, like Battle Roar), the heal stays d8 + level | V3 | ruled (V3, 2026-10-01) -> 91.1-02 | — |
| Sweep | txt "one wide arc: every living foe takes half damage; needs two or more foes"; `sweep-half`: every living foe takes half of one weapon damage roll, no roll to hit — exists (`abilities.js#useAbility` case sweep); `sweep-min`: needs two or more living foes (`SWEEP_MIN_FOES`); fights are solo about half the time on floors 1 to 4 and a quarter on floors 5 to 9 — exists (`abilities.js#abilityShortfall`); timing: instant, cooldown 4 foe turns; who: hero: `useAbility` case sweep; Joiner: uses it (`resolveMemberAbility` case sweep, tag damage, skipped below two foes) | — | keep | — | ok | — |
| Feint | txt "look left, stab right: +3 to hit on this strike, and it adds your level in damage; once per fight"; `feint-once`: once per fight (`cd: "fight"`) — exists (`abilities.js#useAbility` case feint); `feint-hit`: +3 to hit on the one swing — exists (`combat.js#playerStrike`); `feint-damage`: adds your level in damage — exists (`abilityStrike.bonusDmg`); timing: one swing this round, then spent for the fight; who: hero: `useAbility` case feint; Joiner: uses it (`resolveMemberAbility` cases kata and feint, tag damage) | once-per-fight@feint-once | allow more uses@feint-once: ready again 4 rounds after the use (ruled V1 B) | V1 | ruled (V1, 2026-10-01) -> 91.1-02 | — |
| Locks | txt "6–10 on d10 to open a lock, 4–10 with lockpicks; intelligence 15 and 20 each add one more number; a failed roll loses the chest", txt2 "4–10 on d10 to open a lock, 3–10 with lockpicks; intelligence 15 and 20 each add one more number; a failed roll loses the chest"; `locks-open`: opens a chest on 6–10 on a d10 (4–10 at the second tier), plus lockpicks and intelligence — exists (`encounters.js#openChest`); timing: passive, once per chest (a failed roll loses the chest); who: hero: `openChest`; Joiner: cannot (the hero opens the chests) | — | keep | — | ok | — |
| Sewing | txt "once on each fed day's rest, patch hurt armour: d6 hp back, 4 times in all", txt2 "once on each fed day's rest, patch hurt armour: d6+3 hp back, 6 times in all"; `sewing-patch`: once per fed day, patch hurt armour d6 hp back (d6+3 at the second tier), 4 times in all (6) — exists (`movement.js#newDay`); timing: passive, once per fed day while armour is hurt, 4 patches in all (6 at the second tier); who: hero: `newDay`; Joiner: cannot (a Joiner's armour is mended at a store) | low-bonus@sewing-patch | buff@sewing-patch: first tier 4 -> 6 patches in all (d6 each), the second tier stays d6+3 six times | V13 | ruled (V13, 2026-10-01) -> 91.1-02 | — |
| Night Vision | txt "darkness costs you nothing"; `night-vision`: darkness costs you nothing (no dark cap on to-hit, no dark crit ban, no sight limit) — exists (`derived.js#darkWaiver`, `darkLimited`); timing: passive, always on; who: hero: `darkWaiver` readers; Joiner: cannot (the dark is the hero's rule) | — | keep | — | ok | — |
| Heft | txt "+2 damage, mail armour, half upkeep"; `heft-damage`: +2 damage — exists (`derived.js#weaponDamageTerms`); `heft-mail`: mail armour — exists (`items.js#armorRefusalReason`); `heft-upkeep`: half upkeep — exists (`derived.js#upkeep`); timing: passive, always on; who: hero: those three sites; Joiner: +2 damage and mail work (`weaponDamageTerms`, `armorRefusalReason`), the upkeep is the hero's own cost | — | keep | — | ok | — |
| Acute Hearing | txt "never surprised; hears an encounter up to three squares away, walls or no walls, without learning what it is"; `acute-hearing-initiative`: never surprised (you act first) — exists (`combat.js#resolveInitiative`); `acute-hearing-hear`: hears an encounter up to three squares away through walls — exists (`derived.js#heardSquares`); timing: passive, always on; who: hero: `resolveInitiative`, `heardSquares`; Joiner: cannot (initiative and exploration are the hero's) | — | keep | — | ok | — |
| Dirty Trick | txt "sand, thumb, elbow: the target is blinded for two rounds, so it hits only on its best roll (20 on a d20) and never lands a critical"; `dirty-trick-blind`: the target is blinded for two rounds: it hits only on its best roll (20 on a d20) and never crits — exists (`combat.js#applyDirtyTrick`, `tickBlindFor`); `dirty-trick-opener`: tag opener: a Joiner uses it in round 1 only — exists for the hero (`combat.js#pickMemberAbility`) — GAP: a Joiner never reuses it after round 1, though its cooldown is 4 (K07); timing: no roll, blind for 2 foe visits, cooldown 4 foe turns; who: hero: `useAbility` case dirtyTrick; Joiner: uses it in round 1 (`resolveMemberAbility` case dirtyTrick, tag opener) | joiner-gap@dirty-trick-opener | keep@dirty-trick-opener: stays a round-1 move for a Joiner (ruled V30 A) | V30 | ruled keep (V30, 2026-10-01) | — |
| Smoke | txt "gone: for two rounds foes hit you only on their best roll (20 on a d20; 19–20 if you insulted them), and a flee during it just works; once per fight"; `smoke-once`: once per fight — exists (`abilities.js#useAbility` case smoke); `smoke-shift`: for two rounds foes hit you only on their best roll (20 on a d20, 19–20 if insulted) — exists (`derived.js#foeToHitVs`); `smoke-flee`: a flee during it always works — exists (`combat.js#flee`); timing: effect covers the use round's foe turn and the next two (3 foe turns), then spent for the fight; who: hero: `useAbility` case smoke and `flee`; Joiner: the foes-hit-only-on-the-top-face clause only (`resolveMemberAbility` case smoke, tag defensive); the flee clause is the hero's | once-per-fight@smoke-once | allow more uses@smoke-once: ready again 6 rounds after the use (ruled V4 B) | V4 | ruled (V4, 2026-10-01) -> 91.1-02 | — |
| Silent Step | txt "nobody heard that: your next attack never misses and doubles its damage, any round; once per fight; heavy armour, the dark (without a light), a Guard or a Soldier keep the hit and lose the doubling"; `silent-step-once`: once per fight — exists (`abilities.js#useAbility` case silentStep); `silent-step-hit`: your next attack never misses and doubles its damage, any round (not in heavy armour, the dark, or for a Guard or a Soldier) — exists (`combat.js#playerStrike`); `silent-step-opener`: tag opener: a Joiner uses it in round 1 only — exists for the hero (`combat.js#pickMemberAbility`) — GAP: a Joiner that owns a second opener uses only the first and never this one (K07); timing: one swing, then spent for the fight; who: hero: `useAbility` case silentStep; Joiner: uses it in round 1 (`resolveMemberAbility` case silentStep, tag opener) | once-per-fight@silent-step-once; joiner-gap@silent-step-opener | keep@silent-step-once: stays once per fight (ruled 2026-09-27); keep@silent-step-opener: stays a round-1 move for a Joiner (ruled V30 A) | V2, V30 | ruled keep (V2, 2026-10-01); ruled keep (V30, 2026-10-01) | — |

### Level-up abilities

| Entry | Systems named → exists | Value flags | Recommendation | Q | Verdict | Pinned by |
|---|---|---|---|---|---|---|
| Brace | txt "halve the next blow that lands on you"; `brace-halve`: halve the next blow that lands on you (after Hardiness and the Pendant) — exists (`combat.js#applyFoeDamageToPlayer`); timing: lasts until one blow lands, cooldown 3 foe turns; who: hero: `useAbility` case brace; Joiner: uses it (`resolveMemberAbility` case brace, tag defensive) | one-round@brace-halve | lengthen@brace-halve: halves the next 2 blows that land (was the next 1) | V8 | ruled (V8, 2026-10-01) -> 91.1-02 | — |
| Riposte | txt "for one round every foe that misses you eats your weapon damage"; `riposte-counter`: for one round every foe that misses you eats your weapon damage — exists (`combat.js#foeTurn`); timing: effect timer 2 (the use round's foe turn and the next), then a cooldown of 4; who: hero: `useAbility` case riposte; Joiner: uses it (`resolveMemberAbility` case riposte, `memberRiposted`, tag defensive) | one-round@riposte-counter | keep@riposte-counter: stays one round: a miss already costs the foe a full weapon blow | V8 | ruled keep (V8, 2026-10-01) | — |
| Taunt | txt "every foe swings at you this round and your armour soaks double"; `taunt-soak`: every foe swings at you this round and your armour soaks double (capped at 20) — exists (`combat.js#pickFoeTarget`, `applyFoeDamageToPlayer`); timing: effect timer 1 (the use round's foe turn only), cooldown 4; with no Joiner nothing is redirected; who: hero: `useAbility` case taunt; Joiner: uses it (`resolveMemberAbility` case taunt, tag defensive) | one-round@taunt-soak | lengthen@taunt-soak: lasts 2 rounds (was 1), the soak stays double | V8 | ruled (V8, 2026-10-01) -> 91.1-02 | — |
| Overhead Blow | txt "everything into one swing: double damage, but −2 to hit; once per fight"; `overhead-blow-once`: once per fight — exists (`abilities.js#useAbility` case overheadBlow); `overhead-blow-hit`: −2 to hit, double damage (a crit makes it ×4) — exists (`combat.js#playerStrike`); timing: one swing, then spent for the fight; who: hero: `useAbility` case overheadBlow; Joiner: uses it (`resolveMemberAbility` case overheadBlow, tag damage) | once-per-fight@overhead-blow-once | allow more uses@overhead-blow-once: ready again 4 rounds after the use (ruled V2 B) | V2 | ruled (V2, 2026-10-01) -> 91.1-02 | — |
| Last Stand | txt "under a quarter hp: three attacks this round; once per fight"; `last-stand-once`: once per fight — exists (`abilities.js#useAbility` case lastStand); `last-stand-three`: three attacks this round, only at a quarter hp or less (`DEATH_PANIC_THRESHOLD`) — exists (`combat.js#playerStrike`); timing: three swings this round, then spent for the fight; who: hero: `useAbility` case lastStand; Joiner: uses it at or below a quarter of its hp (`resolveMemberAbility` case lastStand, tag damage) | once-per-fight@last-stand-once | allow more uses@last-stand-once: ready again 4 rounds after the use, still only at a quarter hit points or less (ruled V2 B) | V2 | ruled (V2, 2026-10-01) -> 91.1-02 | — |
| Cutpurse | txt "lift d10 × level gold off the target mid-fight; it has other problems; once per fight"; `cutpurse-once`: once per fight — exists (`abilities.js#useAbility` case cutpurse); `cutpurse-gold`: lifts d10 × level gold (level 3: 3–30) taken from nowhere, no combat effect — exists (`items.js#gainWilmst`); timing: instant, then spent for the fight; who: hero: `useAbility` case cutpurse; Joiner: uses it (`resolveMemberAbility` case cutpurse, gold to the hero's purse, tag damage, so it spends its first damage turn on it) | once-per-fight@cutpurse-once; no-value@cutpurse-gold | keep@cutpurse-once: stays once per fight (gold farming); rework@cutpurse-gold: a normal strike that also lifts d10 × level gold on a hit | V5, V11 | ruled keep (V5, 2026-10-01); ruled (V11, 2026-10-01) -> 91.1-02 | — |
| Poisoned Edge | txt "the blade weeps: d4 a round to the target for three rounds"; `poisoned-edge-dmg`: d4 a round to the target for three rounds, no roll to hit, armour does not help the foe — exists (`combat.js#applyPoison`, `foeTurn`); timing: three ticks of d4 (3–12 in all, 7.5 on average), cooldown 5 foe turns; who: hero: `useAbility` case poisonedEdge; Joiner: uses it (`resolveMemberAbility` case poisonedEdge, tag damage) | low-bonus@poisoned-edge-dmg | buff@poisoned-edge-dmg: d4 -> d4 + level a round for 3 rounds (level 3: 16.5 in all instead of 7.5) | V9 | ruled (V9, 2026-10-01) -> 91.1-02 | — |
| Hamstring | txt "cut the tendon: the target's blows do half damage for the rest of the fight; once per fight"; `hamstring-once`: once per fight — exists (`abilities.js#useAbility` case hamstring); `hamstring-half`: the target's blows do half damage for the rest of the fight — exists (`combat.js#foeTurn`); `hamstring-opener`: tag opener: a Joiner uses it in round 1 only — exists for the hero (`combat.js#pickMemberAbility`) — GAP: a Joiner that owns a second opener uses only the first and never this one (K07); timing: instant, then spent for the fight; the effect lasts until the fight ends; who: hero: `useAbility` case hamstring; Joiner: uses it in round 1 (`resolveMemberAbility` case hamstring, tag opener) | once-per-fight@hamstring-once; joiner-gap@hamstring-opener | allow more uses@hamstring-once: ready again 3 rounds after the use, never on a foe that is already hamstrung; keep@hamstring-opener: stays a round-1 move for a Joiner (ruled V30 A) | V5, V30 | ruled (V5, 2026-10-01) -> 91.1-02; ruled keep (V30, 2026-10-01) | — |
| Mark | txt "study it: every strike on the target adds +2 damage for the rest of the fight; once per fight"; `mark-once`: once per fight — exists (`abilities.js#useAbility` case mark); `mark-damage`: every strike on the target adds +2 damage for the rest of the fight (your Joiner's strikes too; spells and Sweep add nothing) — exists (`combat.js#playerStrike`, `memberStrike`); `mark-opener`: tag opener: a Joiner uses it in round 1 only — exists for the hero (`combat.js#pickMemberAbility`) — GAP: a Joiner that owns a second opener uses only the first and never this one (K07); timing: instant, then spent for the fight; the effect lasts until the fight ends; who: hero: `useAbility` case mark; Joiner: uses it in round 1 (`resolveMemberAbility` case mark, tag opener) | once-per-fight@mark-once; low-bonus@mark-damage; joiner-gap@mark-opener | allow more uses@mark-once: ready again 3 rounds after the use, never on a foe that is already marked; buff@mark-damage: +2 -> +level damage on every strike on the target (level 3: +3, level 5: +5); keep@mark-opener: stays a round-1 move for a Joiner (ruled V30 A) | V5, V10, V30 | ruled (V5, 2026-10-01) -> 91.1-02; ruled (V10, 2026-10-01) -> 91.1-02; ruled keep (V30, 2026-10-01) | — |

### Class action

| Entry | Systems named → exists | Value flags | Recommendation | Q | Verdict | Pinned by |
|---|---|---|---|---|---|---|
| Sing | txt "Once per fight: sing a random offense or defense spell of your level or lower, at full strength, no charges spent. You pick the moment, the song picks the spell."; `sing-once`: once per fight: a random offense or protection spell of your level or lower, at full strength, no charges spent — exists (`combat.js#sing`, `songReady`, `songPool`); timing: one cast this round (the spell's own effect), then spent for the fight; who: hero: `combat.js#sing`; Joiner: its first turn of every fight is its song (`alliesTurn`, `pickSong`), the Joiner's own derived stream | once-per-fight@sing-once | allow more uses@sing-once: a second song 5 rounds after the first (ruled V7 B) | V7 | ruled (V7, 2026-10-01) -> 91.1-03 | — |

## Cross-cutting systems

Findings that belong to no single race, sub-class or ability: three systems with a gap, and two dead-code cleanups that 91.1-05 builds with no question.

| Entry | Systems named → exists | Value flags | Recommendation | Q | Verdict | Pinned by |
|---|---|---|---|---|---|---|
| Joiner staff blows | `joiner-staff-blow` (system): a Joiner Magic User with an empty book or no castable attack spell swings its staff on the Magic User's own to-hit — exists (`combat.js#alliesTurn`, `memberStrike`, `derived.js#memberToHit`); `joiner-staff-enchant` (system): a live Enchant Character gives foes −2 to hit that Joiner and no critical on it — exists (`derived.js#foeToHitVs`), but its +2 to hit on the Joiner's own blows — exists for the hero (`derived.js#toHit` through `eff`) — GAP: `memberToHit` reads class, race and sub-class only, so a Joiner's staff blows never add it (K04) | joiner-gap@joiner-staff-enchant | keep@joiner-staff-enchant: stays as it is (ruled V28 A) | V28 | ruled keep (V28, 2026-10-01) | — |
| Walking Dead fixation | `wd-fixation` (system): a Walking Dead left standing by Turn Walking Dead swings only at the caster for the rest of the fight, never at a Joiner — exists (`combat.js#pickFoeTarget`); `wd-fixation-bolts` (system): its ability bolts — exists for the plain pick (`foeAbilities.js` calls `pickFoeTarget` without the foe on purpose) — GAP: a fixated foe's bolts use the plain target pick (K08; no Walking Dead has a bolt today); `wd-fixation-joiner-song` (system): a Joiner Bard's sung Turn Walking Dead — exists for the hero (`combat.js#sing`) — GAP: it fixates nothing, because fixation is a hero-only rule in `pickFoeTarget` (K09) | gap@wd-fixation-bolts; joiner-gap@wd-fixation-joiner-song | keep@wd-fixation-bolts: stays, no Walking Dead foe has a bolt today; keep@wd-fixation-joiner-song: stays, the Joiner's Turn Walking Dead fixates nothing | V31 | ruled keep (V31, 2026-10-01) | — |
| Misdirected swings | `misdirected-swing` (system): a foe hit by Senseless or Duplicate Foe swings at its own side or at itself, at its own damage, and never at yours — exists (`combat.js#misdirectFoe`); `misdirected-weaken-damage` (system): a live Weaken's half damage — exists (`combat.js#foeTurn`); `misdirected-weaken-cap` (system): Weaken's high-roll cap (18–20 on a d20) — exists for an ordinary swing (`derived.js#foeToHitVs`) — GAP: it is not applied to a misdirected swing (K11) | gap@misdirected-weaken-cap | keep@misdirected-weaken-cap: stays as it is (ruled V32 A) | V32 | ruled keep (V32, 2026-10-01) | — |
| Inspired chip | `inspired-chip` (dead code): nothing sets `combat.inspired` since the level-2 song retired (91-06), yet it is still read. Worklist for 91.1-05: readers in `engine/derived.js` (`toHit`, `toHitBreakdown`, `conditionsOf` and their comments), `engine/combat.js` (a comment in `playerStrike`), `src/browser/conditionEffects.js`, `src/browser/heroConditions.js`, `src/browser/rollOdds.js` (a comment) and `mazeworld.html` (the label `inspired: { label: "Inspired" }`, its tone entry and the tooltip "Your song is still ringing in your ears"); pins in `test/unit/rollDirection.test.js` (`[hero-strike:inspired]`, two tests), `test/unit/hero-conditions.test.js`, `test/unit/foe-conditions.test.js`, `test/unit/conditions.test.js` (CMBUI-13 inspired and the ordering tests), `test/unit/conditionEffects.test.js` (CMBUI-13 inspired), `test/unit/condition-roll-mods.test.js` (the toHitBreakdown matrix and its digest pins), `test/unit/identity-text.test.js` (the chip copy); docs `docs/ROLL-LEDGER.md` (the `[hero-strike:inspired]` row), `test/parity/FIXTURE-INVENTORY.md` and `docs/IDENTITY-AUDIT.md` (row `bard-song`) | — | cleanup@inspired-chip | — | cleanup (91.1-05) | — |
| Soothed-beasts outcome | `soothed-outcome` (dead code): no engine event emits `beastsSoothed` since the old song table retired. Worklist for 91.1-05: `mazeworld.html` (the fight-over check `events.some((e) => e.type === "beastsSoothed") ? "soothed" : "victory"` and the outcome card `soothed: { title: "THEY STAND DOWN" ... }`); stale mentions in `src/browser/eventNarration.js` and `src/browser/narrationLines.js` (comments), `test/unit/bard-song-lines.test.js` (asserts the four retired song builders stay gone, keep) and `test/parity/roll-high-invariant.test.js` (a comment); docs `docs/IDENTITY-AUDIT.md` and `docs/NARRATIVE-PASS.md` | — | cleanup@soothed-outcome | — | cleanup (91.1-05) | — |

## Known findings

Every finding the earlier audits handed to this phase (K01 to K18, K19 and K20 being the dead-code cleanups) and where it landed.

| Key | Finding | Source | Rows | Question or cleanup |
|---|---|---|---|---|
| K01 | The chart's bonuses on protection, healing, divination and illusion change no roll (rulebook p.18: they add to damage, number affected, additional healing or squares) | docs/SPELL-AUDIT.md and docs/IDENTITY-AUDIT.md, Findings for other phases (Phase 91.1) | Warlock, Sorcerer, Summoner, Cleric, Illusionist, Court Mage | V18 |
| K02 | The Illusion bonus is 0 for both sub-classes that learn it, so the Senseless and Duplicate Foe stretch gives nothing (only Stop Time stretches) | docs/SPELL-AUDIT.md, Findings for other phases (Phase 91.1) | Illusionist, Apprentice | V19 |
| K03 | Bard songs are cast at +0 school bonus (a Wizard gets +3 offense) | 91-06 and 91-07 assumption; docs/IDENTITY-AUDIT.md, row bard-song | Bard, Sing | V24 |
| K04 | A Joiner's Enchant Character staff blows do not read the +2 to hit (`memberToHit`) | docs/SPELL-AUDIT.md, Findings for other phases (Phase 91.1) | Joiner staff blows | V28 |
| K05 | A Joiner's Ambidextrous applies to a plain strike only | docs/SKILL-AUDIT.md, Findings for other phases (Phase 91.1) | Ambidextrous | V29 |
| K06 | A Joiner's Stealth dark ban applies to the Stealth crit only | docs/SKILL-AUDIT.md, Findings for other phases (Phase 91.1) | Stealth | V29 |
| K07 | A Joiner uses only its first round-1 opener and never reuses it after the cooldown | docs/SKILL-AUDIT.md, Findings for other phases (Phase 91.1) | Pommel Strike, Battle Roar, Dirty Trick, Silent Step, Hamstring, Mark | V30 |
| K08 | A fixated Walking Dead's ability bolts use the plain target pick | docs/SPELL-AUDIT.md, Findings for other phases (Phase 91.1) | Walking Dead fixation | V31 |
| K09 | A Joiner Bard's sung Turn Walking Dead fixates nothing (and a Joiner's Sense Presence helps only its Stealth crit) | docs/IDENTITY-AUDIT.md, Findings for other phases (Phase 91.1) | Walking Dead fixation, Bard | V31 |
| K10 | A Joiner Bard lacks the hero Bard's dim-witted-foes drawback | docs/IDENTITY-AUDIT.md, Findings for other phases (Phase 91.1) | Bard | V31 |
| K11 | Weaken's to-hit cap is not applied to misdirected swings (Senseless, Duplicate Foe) | docs/SPELL-AUDIT.md, Findings for other phases (Phase 91.1) | Misdirected swings | V32 |
| K12 | A Joiner's sub-class specials are the hero's only: Barbarian second attack, Cat Burglar and Ninja free opener, Ninja and Cutthroat crits, Fridgian frenzy, Soldier crit exposure and camp heal, Apprentice backfire, Warlock potion copy and undead bonus, Master of Arms armour patch | docs/IDENTITY-AUDIT.md, Findings for other phases (Phase 91.1) and the Engine cells of those rows | Barbarian, Cat Burglar, Ninja, Cutthroat, Fridgian, Soldier, Apprentice, Warlock, Master of Arms | V33, V34, V35, V36, V37 |
| K13 | The Ninja's later crit and the Cutthroat's first crit ignore the dark no-crit ban | docs/IDENTITY-AUDIT.md, Findings for other phases (Phase 91.1) | Ninja, Cutthroat | V26 |
| K14 | The Master of Arms' armour patch has no night limit | docs/IDENTITY-AUDIT.md, Findings for other phases (Phase 91.1) | Master of Arms | V23 |
| K15 | A Cloaker's vanish still lets a pursuing Spectre strike once | docs/IDENTITY-AUDIT.md, Findings for other phases (Phase 91.1) | Cloaker | V27 |
| K16 | An Elf Illusionist's better strike die is cancelled at levels 1 and 2 | docs/IDENTITY-AUDIT.md, Findings for other phases (Phase 91.1) | Elven, Illusionist | V15 |
| K17 | A Joiner's Death never downs its caster (it refuses at 26 hp or less) | docs/IDENTITY-AUDIT.md, Findings for other phases (Phase 91.1) | Bard | V31 |
| K18 | The Cleric's offense ban also takes Strength (a buff in the offense school) from it | docs/IDENTITY-AUDIT.md, Findings for other phases (Phase 91.1) | Cleric | V20 |
| K19 | Dead code: the Inspire chip, `combat.inspired` readers in `engine/derived.js`, `src/browser/conditionEffects.js`, `src/browser/heroConditions.js` and `mazeworld.html`, with their pins and the `[hero-strike:inspired]` ROLL-LEDGER row | docs/IDENTITY-AUDIT.md, row bard-song; 91-06 deferred-items.md | Inspired chip | cleanup (91.1-05) |
| K20 | Dead code: the "THEY STAND DOWN" soothed-beasts fight-over check in `mazeworld.html` (no engine event emits it) | 91-06 deferred-items.md | Soothed-beasts outcome | cleanup (91.1-05) |

## Value calls

One batched checkpoint: 37 questions, grouped by part. Each lists its rows, today's numbers, and options; the recommended default is marked. A default that is keep builds nothing.

### Part A Once per fight: which abilities deserve more than one use a fight

Every `cd: "fight"` ability and every first-blow system, then Sing. A default that is keep builds nothing.

#### V1 Kata and Feint: more than one use a fight? (answered B)

**Rows:** Kata (once-per-fight@kata-once); Feint (once-per-fight@feint-once)

**Today:** Kata (Fighter) and Feint (Thief) are the same strike: +3 to hit and your level in extra damage on one swing, once per fight. At level 3 on a d10 that moves a Fighter's chance to land from 50 percent to 80 percent and adds 3 damage to a swing of about 16, so it is a good swing, not a kill: it doubles nothing. You ruled on 2026-09-27 that skills that can essentially one-shot stay once per fight, and both were on that list; they are asked again only because VALUE-03 names every once-per-fight ability.

- **A (recommended default): Keep both once per fight, as ruled.** -> nothing built
- **B: Both are ready again 4 rounds after the use (a fight that runs past round 4 gets a second one). Fights on floors 1 to 5 mostly end before that, so the change shows from the middle floors on.** -> 91.1-02

#### V2 Death Touch, Overhead Blow, Silent Step and Last Stand: more than one use a fight? (answered B)

**Rows:** Death Touch (once-per-fight@death-touch-once); Silent Step (once-per-fight@silent-step-once); Overhead Blow (once-per-fight@overhead-blow-once); Last Stand (once-per-fight@last-stand-once)

**Today:** These four are the strikes your 2026-09-27 ruling meant: Death Touch doubles a landed blow and finishes anything under 15 hit points, Silent Step never misses and doubles, Overhead Blow doubles at −2 to hit (about 33 damage on a landed level 3 swing against foes of about 16 on floors 2 to 5), and Last Stand swings three times but only at a quarter hit points or less. Each can end a fight in one use, which is why you wanted them once per fight.

- **A (recommended default): Keep all four once per fight, as ruled.** -> nothing built
- **B: Overhead Blow and Last Stand come back after 4 rounds (Overhead Blow needs a lucky roll anyway at −2 to hit, and Last Stand only fires at a quarter hit points). Death Touch and Silent Step stay once per fight.** -> 91.1-02

#### V3 Second Wind: more than one use a fight? (answered B)

**Rows:** Second Wind (once-per-fight@second-wind-once)

**Today:** Second Wind heals d8 + your level once per fight: 7.5 hit points at level 3 (about 12 percent of a level 3 Fighter's roughly 60), for the cost of your whole turn. It cannot kill anything, so it is the safest ability to hand more uses. A second use costs another turn that would have been a swing of about 8 expected damage, so it only pays when you are losing.

- **A: Keep it once per fight.** -> nothing built
- **B (recommended default): Ready again 5 rounds after the use; the heal does not change.** -> 91.1-02

#### V4 Smoke: more than one use a fight? (answered B)

**Rows:** Smoke (once-per-fight@smoke-once)

**Today:** Smoke makes foes hit you only on their best roll (a 20 on a d20, 19–20 if you insulted them) for two rounds and makes a flee during it always work, once per fight. It is already the strongest defence in the game: a second use would cover two of every six rounds.

- **A (recommended default): Keep it once per fight.** -> nothing built
- **B: Ready again 6 rounds after the use.** -> 91.1-02

#### V5 Hamstring, Mark and Cutpurse: more than one use a fight? (answered B)

**Rows:** Cutpurse (once-per-fight@cutpurse-once); Hamstring (once-per-fight@hamstring-once); Mark (once-per-fight@mark-once)

**Today:** Hamstring (the target's blows do half damage) and Mark (+2 damage on every strike on the target) each put one lasting effect on one foe, once per fight. A fight with two or three foes (never solo from floor 10, at least three from floor 20) can only carry the effect on one of them. Cutpurse lifts d10 × level gold (16 at level 3); a second use would only farm gold.

- **A: Keep all three once per fight.** -> nothing built
- **B (recommended default): Hamstring and Mark come back 3 rounds after the use, but only on a foe that does not carry the effect yet, so a second foe can be worked. Cutpurse stays once per fight.** -> 91.1-02

#### V6 First-blow systems (Stealth, Cat Burglar, Ninja, Cutthroat): should the first blow come back? (answered A)

**Rows:** Stealth (once-per-fight@stealth-crit); Cat Burglar (once-per-fight@cat-burglar-first); Cutthroat (once-per-fight@cutthroat-crit); Ninja (once-per-fight@ninja-opener)

**Today:** Four systems work only on the first strike of a fight: the Fighter skill Stealth (first landed blow crits on the top two numbers), the Cat Burglar's first strike that always lands, the Cutthroat's first landed blow that always crits and the Ninja's opening strike that lands for maximum damage, doubled by the backstab. In a fight with several foes the first blow on every later foe gets nothing. These are passive, not abilities you choose.

- **A (recommended default): Keep them first-blow-of-the-fight only.** -> nothing built
- **B: Each one re-arms on the first blow against every new foe (the first blow on each foe, not only on the first foe). Much stronger against groups, and the Ninja's maximum-damage opener would happen once per foe.** -> 91.1-03

#### V7 Sing: more than one song a fight? (answered B)

**Rows:** Sing (once-per-fight@sing-once)

**Today:** The Bard sings once per fight: one random offense or protection spell of your level or lower, at full strength, no charge spent. You ruled that on 2026-09-30 (IDENT-17: "once per fight as a combat action"); it is asked again only because VALUE-03 names every once-per-fight ability. A second song is another free spell that costs only a turn.

- **A (recommended default): Keep it once per fight, as ruled.** -> nothing built
- **B: A second song 5 rounds after the first (a long fight gets two spells).** -> 91.1-03

### Part B One round: effects that last a single round or a single blow

Effects that last one foe turn or one blow.

#### V8 One-round effects: Pommel Strike, Brace, Riposte and Taunt (answered B)

**Rows:** Pommel Strike (one-round@pommel-stun); Brace (one-round@brace-halve); Riposte (one-round@riposte-counter); Taunt (one-round@taunt-soak)

**Today:** Four effects cover a single round or a single blow. Pommel Strike's stun costs the target one turn (its shape was ruled 2026-09-30, ABIL-07, and it is already a real strike). Brace halves the next one blow that lands on you: about 4 hit points saved against a floor 2 to 5 foe (7.5 a blow), for a whole turn and a cooldown of 3. Riposte makes every foe that misses you eat your weapon damage for one round, which is the best of the four (a miss costs the foe about 16 at level 3). Taunt makes every foe swing at you and doubles what your armour soaks for one round; with no Joiner in the party nothing is redirected, so it is only the soak.

- **A: Keep all four as they are.** -> nothing built
- **B (recommended default): Brace halves the next two blows, Taunt lasts two rounds. Pommel Strike and Riposte stay (one is ruled, the other is already strong).** -> 91.1-02

### Part C Low bonus or no value on a skill or an ability

Skills and abilities whose bonus is small or whose effect is worth nothing in a fight.

#### V9 Poisoned Edge: too small? (answered B)

**Rows:** Poisoned Edge (low-bonus@poisoned-edge-dmg)

**Today:** Poisoned Edge deals d4 a round for three rounds (7.5 in all, no roll to hit, armour does not help the foe), cooldown 5, for the cost of your turn. A level 3 swing is about 16.5 and lands half the time, so the poison is worth about one plain swing spread over three rounds and does less and less as you level (about 32 per swing at level 5).

- **A: Keep it.** -> nothing built
- **B (recommended default): d4 + your level a round for three rounds: 16.5 in all at level 3, 22.5 at level 5, still no roll.** -> 91.1-02

#### V10 Mark: +2 damage is tiny (answered B)

**Rows:** Mark (low-bonus@mark-damage)

**Today:** Mark adds +2 damage to every strike on one foe for the rest of the fight, once per fight, and it costs your turn. Against a level 3 swing of about 16.5 that is 12 percent, and 6 percent at level 5; over a 3-swing fight you gain 6 damage for a swing you did not make (about 8 expected), so Mark loses on most fights. (Whether it should also come back is V5.)

- **A: Keep +2.** -> nothing built
- **B (recommended default): + your level instead of +2 per strike (3 at level 3, 5 at level 5; a Joiner's strikes too).** -> 91.1-02

#### V11 Cutpurse: gold only, for a whole turn (answered B)

**Rows:** Cutpurse (no-value@cutpurse-gold)

**Today:** Cutpurse lifts d10 × your level gold (16 at level 3, a tenth of a Healing potion) and does nothing else, so using it costs a swing of about 8 expected damage. A Joiner Thief also picks it as its first damage ability against a healthy foe, so the Joiner spends that turn pickpocketing.

- **A: Keep it as it is.** -> nothing built
- **B (recommended default): Make it a normal strike (the plain strike's roll and damage) that also lifts the gold when it lands, the way Pommel Strike also stuns, still once per fight.** -> 91.1-02

#### V12 Stealth: a crit range of two numbers on one blow (answered B)

**Rows:** Stealth (low-bonus@stealth-crit)

**Today:** Stealth makes your first landed blow of a fight a critical (double damage) when it rolls in the top two numbers of your strike die: 19–20 on a d20. Your weapon already crits on its top face (or two), so Stealth adds one extra critical number on one blow a fight: about 5 percent of one swing, under half a hit point of expected damage at level 1. (Whether the first blow should come back is V6.)

- **A: Keep the top two numbers.** -> nothing built
- **B (recommended default): The top three numbers (18–20 on a d20, 8–10 on a d10 and so on); still the first landed blow only, still never in plate or in the dark.** -> 91.1-02

#### V13 Sewing: 4 patches of d6 in a whole run (answered B)

**Rows:** Sewing (low-bonus@sewing-patch)

**Today:** Sewing patches hurt armour once per fed day, d6 armour hit points back, 4 times in all (14 in a whole run; Mail has 30, Plate 45); the second tier gives d6+3, 6 times (39). A Master of Arms patches d6+3 every night with no limit.

- **A: Keep it.** -> nothing built
- **B (recommended default): The first tier patches 6 times in all instead of 4 (21 armour hit points in a run).** -> 91.1-02

#### V14 Runes/Signs: only a guarantee now? (answered B)

**Rows:** Runes/Signs (low-bonus@runes-read)

**Today:** Since RULES-10 anyone may try a scroll, so Runes/Signs only removes the fumble chance (about 15 percent at intelligence 14: a roll of 1–3 on a d20 burns the scroll) and the roll. It costs the cheapest 2 points of the Fighter table. Ruled shape; asked because VALUE-02 names very low bonuses.

- **A (recommended default): Keep it as the guarantee it is.** -> nothing built
- **B: Also keep a read scroll one time in six (a scroll read through Runes/Signs is spent only 5 times in 6).** -> 91.1-02

### Part D Races

Race systems.

#### V15 Elf Illusionist: the better die is cancelled at levels 1 and 2 (answered B)

**Rows:** Elven (gap@race-strike-step)

**Today:** An Elf strikes on a die one size smaller (a d12 at level 1) and the footer says so; an Illusionist strikes on a d20 until level 3, and the footer says that too. For an Elf Illusionist the Illusionist rule wins, so the Elf's good die is dead at levels 1 and 2 (the Elf's other perks still count). The pairing is rare (an Elf is one hero in eight and an Illusionist is one of the 24 sub-classes).

- **A (recommended default): Keep it: the Illusionist's d20 is the drawback of the class, and the Elf's die returns at level 3.** -> nothing built
- **B: The Elf's smaller die applies on top of the Illusionist's d20 (a d12 at level 1, a d10 at level 2).** -> 91.1-03

#### V16 Dwarven: +2 damage (answered B)

**Rows:** Dwarven (low-bonus@race-dmg)

**Today:** A Dwarf deals +2 damage with every weapon: 12 percent of a level 3 swing (16.5) and 6 percent at level 5. The Dwarf also pays for being small and for foes striking on a smaller die, but gets half-price shops and armour that wears at half rate. The Troll's +11 is the other end of the scale.

- **A: Keep +2.** -> nothing built
- **B (recommended default): +3 damage.** -> 91.1-03

#### V17 Fridgian: the hide soaks only 2 (answered B)

**Rows:** Fridgian (low-bonus@race-hide)

**Today:** A Fridgian can never wear armour, so the thick hide that soaks 2 from every blow is its whole defence: a quarter of a floor 2 to 5 blow (7.5) but a tenth of a floor 10 blow (19.5), and about 7 percent of a late one. Hardiness, a 6-point skill, soaks 3. (The Joiner side of the Fridgian is V33.)

- **A: Keep 2.** -> nothing built
- **B (recommended default): The hide soaks 3.** -> 91.1-03

### Part E Magic User sub-classes

The Magic User chart and the Cleric's ban.

#### V18 Chart bonuses that change no roll (protection, healing, divination) (answered B)

**Rows:** Warlock (no-value@unstated:chart-divination); Sorcerer (no-value@unstated:chart-protection, no-value@unstated:chart-divination); Summoner (no-value@unstated:chart-protection, no-value@unstated:chart-divination); Cleric (no-value@unstated:chart-protection, no-value@unstated:chart-healing); Illusionist (no-value@unstated:chart-divination); Court Mage (no-value@unstated:chart-protection, no-value@unstated:chart-healing)

**Today:** The Magic User chart gives six sub-classes a bonus in schools where it changes no roll: the rulebook (p.18) says those bonuses add to damage, to the number affected, to extra healing or to squares, but a bonus reaches the dice only through a thrown offense spell and, since Phase 90, through the Special stretch. Protection: Sorcerer 1, Summoner 2, Cleric 3, Court Mage 2. Healing: Cleric 4 (the Cleric's real heal bonus is a separate +3 rule), Court Mage 1. Divination: Warlock 2, Sorcerer 3, Summoner 4, Illusionist 1. The footers do not state them, so the player is never told a number that does nothing.

- **A: Leave the dead numbers in the chart (nothing is built, nothing is stated).** -> nothing built
- **B (recommended default): Make the two schools that map to a number real: a healing bonus is added to every heal the caster casts (Cleric +4 replacing its separate +3, Court Mage +1), a protection bonus adds 5 hit points per point to Shield's soak and to Bubble's film (Cleric +15, Summoner and Court Mage +10, Sorcerer +5); the divination numbers are set to 0 because no divination spell has a number to stretch. The footers state what is real.** -> 91.1-03
- **C: Set every dead number to 0 and build nothing (the chart then says only what does something).** -> 91.1-03

#### V19 The Illusion bonus is 0 for both sub-classes that learn Illusion (answered B)

**Rows:** Illusionist (no-value@unstated:chart-illusion); Apprentice (no-value@unstated:chart-illusion)

**Today:** Senseless and Duplicate Foe stretch by one round per point of the caster's Illusion bonus (a Phase 90 ruling), but the Illusionist and the Apprentice both have 0, so the stretch gives them nothing. Only Stop Time (a Special spell) stretches, and the Illusionist's Special bonus of 4 makes it last 6 rounds. Senseless lasts d4 rounds (2.5), Duplicate Foe d4+1.

- **A: Keep both at 0.** -> nothing built
- **B (recommended default): The Illusionist's Illusion bonus becomes 1 (Senseless d4+1 rounds, Duplicate Foe d4+2); the Apprentice stays 0.** -> 91.1-03

#### V20 The Cleric's offense ban also takes Strength (answered B)

**Rows:** Cleric (gap@chart-never)

**Today:** You ruled on 2026-09-30 that the Cleric cannot learn offense spells because they gain more hit points. The ban is the whole offense school, which includes Strength, the +d10 damage buff for 100 squares. Strength is a buff, not an attack, so a Cleric loses it as a side effect. A scroll of Strength still works for a Cleric (RULES-10).

- **A (recommended default): Keep the whole school closed, as ruled.** -> nothing built
- **B: One exception: a Cleric may learn Strength (a single chart entry).** -> 91.1-03

### Part F Fighter sub-classes

Fighter sub-class systems and the Bard's song bonus.

#### V21 Knight: foes under 5 hit points flee, but only on floor 1 (answered A)

**Rows:** Knight (no-value@knight-small)

**Today:** A Knight makes every foe with fewer than 5 maximum hit points flee before it can act. On floor 1, 4 of the 12 creatures qualify; from floor 2 the smallest creature has 5 (a Zit's 4 is scaled up), so on floors 2 to 5 it fires on about one foe in twelve (the one foe in four that is dragged down a tier, a third of which are tiny) and never from floor 6. Average runs end on floors 5 to 7. A fled foe gives no experience.

- **A: Keep under 5.** -> nothing built
- **B (recommended default): Under 10 hit points: 10 of 12 creatures on floor 1, 3 of 11 on floors 2 to 5, 2 of 12 on floors 6 to 9.** -> 91.1-03

#### V22 Master of Arms: +2 damage is the only offence (answered A)

**Rows:** Master of Arms (low-bonus@moa-damage)

**Today:** The Master of Arms gives up parleying and ever leaving a fight (you ruled the second on 2026-09-30) for +2 damage with every weapon (12 percent of a level 3 swing, 6 percent at level 5) and the nightly armour patch. A Barbarian swings twice, a Samurai starts with a +2 katana.

- **A: Keep +2.** -> nothing built
- **B (recommended default): +3 damage.** -> 91.1-03

#### V23 Master of Arms: the armour patch has no limit (answered A)

**Rows:** Master of Arms (gap@moa-patch)

**Today:** A Master of Arms patches d6+3 armour hit points every fed night with no limit; the Thief's Sewing stops after 4 patches (6 at the second tier). The text says "every night", so the engine matches the words; it is the one repair rule with no cap.

- **A (recommended default): Keep it unlimited.** -> nothing built
- **B: Cap it at 6 patches in all, like the second tier of Sewing.** -> 91.1-03

#### V24 Bard: the song is cast with no school bonus (answered A)

**Rows:** Bard (gap@unstated:song-bonus)

**Today:** A Bard's song is cast as a Magic User of the Bard's level would cast it, but a Bard has no chart row, so it gets +0 where a Wizard gets +3 on a thrown spell (Freeze lands on 5–10 of d10 plain: 60 percent; a Wizard 90). Only the thrown offense songs read the bonus, one pick in about six at level 1.

- **A (recommended default): Keep +0.** -> nothing built
- **B: Songs get +2 to hit on thrown offense spells (a chart row for the Bard).** -> 91.1-03

### Part G Thief sub-classes

Thief sub-class systems.

#### V25 Con Artist: "a level 1 foe leaves" only works on floor 1 (answered B)

**Rows:** Con Artist (no-value@con-artist-leave)

**Today:** A level 1 foe leaves before the fight two times in three. Every foe on floor 1 is level 1, on floors 2 to 5 only the one foe in four dragged down a tier, and from floor 6 none. So the rule is a floor-1 perk, and floors 2 to 5 are where most runs live.

- **A: Keep it level 1 only.** -> nothing built
- **B (recommended default): Level 1 foes still leave 2 times in 3, and level 2 foes leave 1 time in 3 (covers floors 2 to 5).** -> 91.1-03
- **C: Level 1 and level 2 foes both leave 2 times in 3 (a Con Artist avoids two fights in three through floor 5).** -> 91.1-03

#### V26 Ninja and Cutthroat crits ignore the dark (answered A)

**Rows:** Cutthroat (gap@cutthroat-crit); Ninja (gap@ninja-crit)

**Today:** In the dark nobody crits (a Night Vision hero or a lit room excepted), except that the Ninja's later crit (top two numbers of its die) and the Cutthroat's first landed blow ignore that ban. The Ninja's opener text already says the backstab is denied in the dark, so the other two read as if they were denied too.

- **A (recommended default): Keep the engine (they are the shadow classes) and say so in the text: "even in the dark".** -> 91.1-05
- **B: The engine follows the ban: no crit in the dark without a light or Night Vision, for both.** -> 91.1-03

#### V27 Cloaker: a pursuing Spectre still gets a parting strike (answered B)

**Rows:** Cloaker (gap@cloaker-vanish)

**Today:** The Cloaker vanishes from any fight for free until it has landed a blow. A foe that pursues (the Spectre) still strikes once as the hero leaves, so the vanish is not free against it.

- **A (recommended default): Keep the engine and state the exception in the text.** -> 91.1-05
- **B: The vanish also escapes a pursuing Spectre's parting blow.** -> 91.1-03

### Part H Joiner parity and the cross-cutting rules

A Joiner lacking what the hero has, and the rules that belong to no single entry.

#### V28 A Joiner's staff blows ignore Enchant Character's +2 to hit (answered A)

**Rows:** Joiner staff blows (joiner-gap@joiner-staff-enchant)

**Today:** A Joiner Magic User with Enchant Character gets foes −2 to hit it and no critical on it, but its staff swings do not add the +2 to hit that the same spell gives the hero (a Joiner's to-hit reads only class, race and sub-class). Magic User Joiners swing the staff only when the book is empty.

- **A: Leave it.** -> nothing built
- **B (recommended default): A Joiner's staff blows add the +2 to hit while its Enchant Character lasts.** -> 91.1-04

#### V29 A Joiner's Ambidextrous and Stealth (answered A)

**Rows:** Ambidextrous (joiner-gap@ambidextrous-joiner); Stealth (joiner-gap@stealth-dark)

**Today:** A Joiner with Ambidextrous swings twice on a plain strike, but the hero's Ambidextrous also doubles every strike ability (the hero's Kata is two swings), while a Joiner's ability use is one swing. Separately, a Joiner's Stealth crit respects the dark ban but every other Joiner crit ignores it, which favours Joiners.

- **A: Leave both as they are.** -> nothing built
- **B (recommended default): A Joiner's strike abilities swing twice when it has Ambidextrous or a live Speed. The dark rule for Joiner crits stays as it is.** -> 91.1-04

#### V30 A Joiner uses only its first opener, in round 1 (answered A)

**Rows:** Pommel Strike (joiner-gap@pommel-opener); Battle Roar (joiner-gap@battle-roar-opener); Dirty Trick (joiner-gap@dirty-trick-opener); Silent Step (joiner-gap@silent-step-opener); Hamstring (joiner-gap@hamstring-opener); Mark (joiner-gap@mark-opener)

**Today:** A Joiner picks an opener-tagged ability (Pommel Strike, Battle Roar, Dirty Trick, Silent Step, Hamstring, Mark) only in round 1. A Joiner that owns two openers uses the first and never the second; a Joiner never reuses Pommel Strike (cooldown 4), Battle Roar (5) or Dirty Trick (4) after round 1, though the hero does.

- **A: Leave it: openers are round-1 moves for Joiners (the ruled shape of Pommel Strike).** -> nothing built
- **B (recommended default): A Joiner uses a ready opener on its first free turn, not only in round 1, so a second opener is used in round 2 and a cooldown opener again once it is ready.** -> 91.1-04

#### V31 Four small Bard and Walking Dead gaps (answered A)

**Rows:** Walking Dead fixation (gap@wd-fixation-bolts, joiner-gap@wd-fixation-joiner-song); Bard (joiner-gap@bard-target, joiner-gap@unstated:joiner-song, joiner-gap@unstated:joiner-death)

**Today:** Four small gaps. (1) A Walking Dead that a turn leaves fixated swings only at the caster, but its ability bolts use the plain target pick; no Walking Dead has a bolt today. (2) A Joiner Bard's sung Turn Walking Dead fixates nothing (aiming it at the hero would break "a Joiner's song never touches the hero"). (3) A Joiner Bard does not draw the foes with intelligence 3 or less that the hero Bard does. (4) A Joiner's Death refuses at 26 hit points or less, as the hero's does, so it can never down its caster.

- **A (recommended default): Leave all four: none changes a fight today and each fix has a downside.** -> nothing built
- **B: A Joiner Bard also draws every foe of intelligence 3 or less, and the bolts use the fixation pick.** -> 91.1-04

#### V32 Weaken's to-hit cap is not applied to misdirected swings (answered A)

**Rows:** Misdirected swings (gap@misdirected-weaken-cap)

**Today:** Weaken says foes hit only on a high roll (18–20 on a d20) and do half damage. A foe made to swing at its own side by Senseless or Duplicate Foe still takes the half damage but ignores the high-roll cap, so a weakened foe's misdirected swing lands more often than the text says.

- **A: Leave it.** -> nothing built
- **B (recommended default): The cap applies to misdirected swings too, so the text is true.** -> 91.1-03

#### V33 Joiner Barbarians and Fridgians: the extra swings (answered A)

**Rows:** Barbarian (joiner-gap@barbarian-two); Fridgian (joiner-gap@race-frenzy)

**Today:** A Barbarian's two attacks and a Fridgian's frenzy (a 4–6 on a d6 gives a second, wilder swing) are the hero's only: a Joiner Barbarian swings once and a Joiner Fridgian never frenzies. You ruled on 2026-09-30 (Q7 A) that a Joiner's body traits apply like the hero's.

- **A: Keep them hero only.** -> nothing built
- **B (recommended default): Give a Joiner the same extra swings.** -> 91.1-04

#### V34 Joiner Cat Burglars, Ninjas and Cutthroats: the first-blow specials (answered A)

**Rows:** Cat Burglar (joiner-gap@cat-burglar-first); Ninja (joiner-gap@ninja-opener, joiner-gap@ninja-crit); Cutthroat (joiner-gap@cutthroat-crit)

**Today:** The Cat Burglar's free first strike, the Ninja's maximum-damage opener and later crit and the Cutthroat's first crit are the hero's only. A Joiner of those sub-classes strikes like any other Joiner Thief (the ordinary backstab on its opening blow).

- **A: Keep them hero only.** -> nothing built
- **B (recommended default): Give a Joiner the same first-blow specials (one blow a fight each, as the hero's).** -> 91.1-04

#### V35 Joiner Warlocks and Masters of Arms: the night perks (answered A)

**Rows:** Warlock (joiner-gap@warlock-potion); Master of Arms (joiner-gap@moa-patch)

**Today:** The Warlock's nightly potion copy and the Master of Arms' nightly armour patch work on the hero only. A Joiner's armour is mended at a store; a Joiner Warlock's potions never multiply.

- **A: Keep them hero only.** -> nothing built
- **B (recommended default): A Joiner with the sub-class gets the same night perk.** -> 91.1-04

#### V36 Joiner Soldiers: no camp heal at all (answered A)

**Rows:** Soldier (joiner-gap@soldier-camp)

**Today:** Camp heals only the hero (a fifth of its maximum plus a d10, doubled for a Soldier or a Wilmsry); nothing heals a Joiner at camp, so a Soldier Joiner has no heal to double. A Joiner gets back hit points from potions and from healing spells.

- **A (recommended default): Keep it: Joiners are not healed at camp.** -> nothing built
- **B: New rule: every fed night heals each Joiner a fifth of its maximum plus a d10 (doubled for a Soldier or a Wilmsry), as the hero is.** -> 91.1-04

#### V37 Hero-only drawbacks: should a Joiner carry them? (answered A)

**Rows:** Soldier (joiner-gap@soldier-crit); Warlock (joiner-gap@warlock-undead); Apprentice (joiner-gap@apprentice-backfire)

**Today:** Three drawbacks are the hero's only: foes crit a Soldier on 19–20 (a Joiner Soldier on the top face only), every Walking Dead in the fight gains hit points equal to a Warlock's level, and a hero Apprentice's spells backfire one in eight (a Joiner Apprentice never backfires). Each would make a Joiner weaker or riskier than it is today.

- **A (recommended default): Keep them hero only: you hired a helper, not a punishment.** -> nothing built
- **B: A Joiner carries them as the hero does.** -> 91.1-04

## Build ownership

Recorded after the rulings of 2026-10-01: the rows each build plan owns, from the verdicts. 91.1-04 (Joiner parity) owns nothing: every Joiner question was ruled A (keep), so the plan can be skipped. 91.1-05's rows are the two dead-code cleanups and the one text-only ruling (V26).

| Plan | Rows (question) |
|---|---|
| 91.1-02 | Kata (V1); Stealth (V12); Runes/Signs (V14); Second Wind (V3); Feint (V1); Sewing (V13); Smoke (V4); Brace (V8); Taunt (V8); Overhead Blow (V2); Last Stand (V2); Cutpurse (V11); Poisoned Edge (V9); Hamstring (V5); Mark (V5, V10) |
| 91.1-03 | Elven (V15); Dwarven (V16); Fridgian (V17); Warlock (V18); Sorcerer (V18); Summoner (V18); Cleric (V18, V20); Illusionist (V18, V19); Court Mage (V18); Cloaker (V27); Con Artist (V25); Sing (V7) |
| 91.1-04 | none |
| 91.1-05 | Cutthroat (V26); Ninja (V26); Inspired chip; Soothed-beasts outcome |

## Rulings

The user ruled all 37 questions at the batched checkpoint on 2026-10-01, in one reply: "A. Choose options B for everything but V6 / B - E. All option B / F. Option A / G. V25 option B. Option A for the others / H. Option A for all". Parsed: V1 to V5 B, V6 A, V7 B, V8 to V20 B, V21 to V24 A, V25 B, V26 A (the text-only "say so" option), V27 B (changed afterwards by the user: "Cloaker ability should work on specter, too"), V28 to V37 A. No question gave its own numbers, so each option is built as written.

- V1 (2026-10-01): B (a departure from the recommended default: it builds). User: Part A: "A. Choose options B for everything but V6".
  Built by 91.1-02: Both are ready again 4 rounds after the use (a fight that runs past round 4 gets a second one). Fights on floors 1 to 5 mostly end before that, so the change shows from the middle floors on.
- V2 (2026-10-01): B (a departure from the recommended default: it builds). User: Part A: "A. Choose options B for everything but V6".
  Built by 91.1-02: Overhead Blow and Last Stand come back after 4 rounds (Overhead Blow needs a lucky roll anyway at −2 to hit, and Last Stand only fires at a quarter hit points). Death Touch and Silent Step stay once per fight.
- V3 (2026-10-01): B. User: Part A: "A. Choose options B for everything but V6".
  Built by 91.1-02: Ready again 5 rounds after the use; the heal does not change.
- V4 (2026-10-01): B (a departure from the recommended default: it builds). User: Part A: "A. Choose options B for everything but V6".
  Built by 91.1-02: Ready again 6 rounds after the use.
- V5 (2026-10-01): B. User: Part A: "A. Choose options B for everything but V6".
  Built by 91.1-02: Hamstring and Mark come back 3 rounds after the use, but only on a foe that does not carry the effect yet, so a second foe can be worked. Cutpurse stays once per fight.
- V6 (2026-10-01): A. User: Part A: "A. Choose options B for everything but V6".
  Nothing is built: Keep them first-blow-of-the-fight only.
- V7 (2026-10-01): B (a departure from the recommended default: it builds). User: Part A: "A. Choose options B for everything but V6".
  Built by 91.1-03: A second song 5 rounds after the first (a long fight gets two spells).
- V8 (2026-10-01): B. User: Parts B to E: "B - E. All option B".
  Built by 91.1-02: Brace halves the next two blows, Taunt lasts two rounds. Pommel Strike and Riposte stay (one is ruled, the other is already strong).
- V9 (2026-10-01): B. User: Parts B to E: "B - E. All option B".
  Built by 91.1-02: d4 + your level a round for three rounds: 16.5 in all at level 3, 22.5 at level 5, still no roll.
- V10 (2026-10-01): B. User: Parts B to E: "B - E. All option B".
  Built by 91.1-02: + your level instead of +2 per strike (3 at level 3, 5 at level 5; a Joiner's strikes too).
- V11 (2026-10-01): B. User: Parts B to E: "B - E. All option B".
  Built by 91.1-02: Make it a normal strike (the plain strike's roll and damage) that also lifts the gold when it lands, the way Pommel Strike also stuns, still once per fight.
- V12 (2026-10-01): B. User: Parts B to E: "B - E. All option B".
  Built by 91.1-02: The top three numbers (18–20 on a d20, 8–10 on a d10 and so on); still the first landed blow only, still never in plate or in the dark.
- V13 (2026-10-01): B. User: Parts B to E: "B - E. All option B".
  Built by 91.1-02: The first tier patches 6 times in all instead of 4 (21 armour hit points in a run).
- V14 (2026-10-01): B (a departure from the recommended default: it builds). User: Parts B to E: "B - E. All option B".
  Built by 91.1-02: Also keep a read scroll one time in six (a scroll read through Runes/Signs is spent only 5 times in 6).
- V15 (2026-10-01): B (a departure from the recommended default: it builds). User: Parts B to E: "B - E. All option B".
  Built by 91.1-03: The Elf's smaller die applies on top of the Illusionist's d20 (a d12 at level 1, a d10 at level 2).
- V16 (2026-10-01): B. User: Parts B to E: "B - E. All option B".
  Built by 91.1-03: +3 damage.
- V17 (2026-10-01): B. User: Parts B to E: "B - E. All option B".
  Built by 91.1-03: The hide soaks 3.
- V18 (2026-10-01): B. User: Parts B to E: "B - E. All option B".
  Built by 91.1-03: Make the two schools that map to a number real: a healing bonus is added to every heal the caster casts (Cleric +4 replacing its separate +3, Court Mage +1), a protection bonus adds 5 hit points per point to Shield's soak and to Bubble's film (Cleric +15, Summoner and Court Mage +10, Sorcerer +5); the divination numbers are set to 0 because no divination spell has a number to stretch. The footers state what is real.
- V19 (2026-10-01): B. User: Parts B to E: "B - E. All option B".
  Built by 91.1-03: The Illusionist's Illusion bonus becomes 1 (Senseless d4+1 rounds, Duplicate Foe d4+2); the Apprentice stays 0.
- V20 (2026-10-01): B (a departure from the recommended default: it builds). User: Parts B to E: "B - E. All option B".
  Built by 91.1-03: One exception: a Cleric may learn Strength (a single chart entry).
- V21 (2026-10-01): A (a departure from the recommended default: it keeps). User: Part F: "F. Option A".
  Nothing is built: Keep under 5.
- V22 (2026-10-01): A (a departure from the recommended default: it keeps). User: Part F: "F. Option A".
  Nothing is built: Keep +2.
- V23 (2026-10-01): A. User: Part F: "F. Option A".
  Nothing is built: Keep it unlimited.
- V24 (2026-10-01): A. User: Part F: "F. Option A".
  Nothing is built: Keep +0.
- V25 (2026-10-01): B. User: Part G: "G. V25 option B. Option A for the others".
  Built by 91.1-03: Level 1 foes still leave 2 times in 3, and level 2 foes leave 1 time in 3 (covers floors 2 to 5).
- V26 (2026-10-01): A. User: Part G: "G. V25 option B. Option A for the others".
  Text only, built by 91.1-05: Keep the engine (they are the shadow classes) and say so in the text: "even in the dark".
- V27 (2026-10-01): B (a departure from the recommended default: it builds). User: Part G: "G. V25 option B. Option A for the others", then changed by the user to: "Cloaker ability should work on specter, too".
  Built by 91.1-03: The vanish also escapes a pursuing Spectre's parting blow.
- V28 (2026-10-01): A (a departure from the recommended default: it keeps). User: Part H: "H. Option A for all".
  Nothing is built: Leave it.
- V29 (2026-10-01): A (a departure from the recommended default: it keeps). User: Part H: "H. Option A for all".
  Nothing is built: Leave both as they are.
- V30 (2026-10-01): A (a departure from the recommended default: it keeps). User: Part H: "H. Option A for all".
  Nothing is built: Leave it: openers are round-1 moves for Joiners (the ruled shape of Pommel Strike).
- V31 (2026-10-01): A. User: Part H: "H. Option A for all".
  Nothing is built: Leave all four: none changes a fight today and each fix has a downside.
- V32 (2026-10-01): A (a departure from the recommended default: it keeps). User: Part H: "H. Option A for all".
  Nothing is built: Leave it.
- V33 (2026-10-01): A (a departure from the recommended default: it keeps). User: Part H: "H. Option A for all".
  Nothing is built: Keep them hero only.
- V34 (2026-10-01): A (a departure from the recommended default: it keeps). User: Part H: "H. Option A for all".
  Nothing is built: Keep them hero only.
- V35 (2026-10-01): A (a departure from the recommended default: it keeps). User: Part H: "H. Option A for all".
  Nothing is built: Keep them hero only.
- V36 (2026-10-01): A. User: Part H: "H. Option A for all".
  Nothing is built: Keep it: Joiners are not healed at camp.
- V37 (2026-10-01): A. User: Part H: "H. Option A for all".
  Nothing is built: Keep them hero only: you hired a helper, not a punishment.

## Findings for other phases

- **Declined or deferred by the rulings (2026-10-01):** every Joiner parity change (V28 to V37: the staff blows' +2 to hit, a Joiner's strike abilities swinging twice, openers after round 1, the Bard and Walking Dead gaps, the extra swings, the first-blow specials, the night perks, a camp heal for Joiners, Joiner drawbacks), the Knight's threshold (V21), the Master of Arms' +2 and patch (V22, V23), the Bard's song bonus (V24), the Weaken cap on misdirected swings (V32), the first-blow re-arming (V6) and the first-blow re-arming (V6). The Joiner rows stay `ruled keep` and read as the standing shape.
- **Phase 92 (bot pass):** every change the build plans make is measured once there. The things the bot does not know: `tools/lib/tuning-bot.mjs#chooseAbility` has no rule for a second use of Second Wind, Hamstring, Mark, Overhead Blow or Last Stand, for a longer Brace or Taunt, or for a reworked Cutpurse; a stronger Joiner (parity, a second swing on an ability, an opener used after round 1) moves the party-fight pins; the Knight and Con Artist thresholds and the Dwarf, Fridgian and Master of Arms numbers move early-floor survival.
- **Canon the game does not carry (backlog, no question adopted it):** the Court Mage's angry-party-member risk (rulebook p.17), the Pickpocket's steal-from-a-store, a Shield armour (p.44), the Cleric's Turn Walking Dead and Cure Disease grants.
- **Evaluated and kept without a question (the numbers did not flag them):** the Woodsman's Leather start (its Quarter Staff at proficiency 3 pays for it), the Cleric's chain mail that no other Mail replaces, the Illusionist's large Special stretch (Fly 70 squares, Stop Time 6 rounds), the Guard's foes −1 to hit (about 20 percent fewer blows land), Sidestep and Battle Roar (foes −2 to hit for two rounds), Sweep, Dirty Trick, Hardiness, Heft, Cooking, Locks, Night Vision and Acute Hearing; Human, Wilmsry, Troll, Samurai, Pickpocket, Pilfer, Acrobat and Wizard carry no flag.
- **Doc drift found while writing (for 91.1-05, not a value call):** the Sing row of `docs/SKILL-AUDIT.md` and `SING_TEXT` in `test/unit/skill-audit.test.js` still quote the retired once-per-100-squares text; the live text is `COMBAT_MENU_COPY.singDesc` in `src/browser/combatMenu.js`.
- **No camp heal for a Joiner:** `movement.js#newDay` heals the hero's hit points only. The ledger asks it as V36 (Joiner Soldiers) because the Soldier's camp heal is the one place the text promises it; a rule that heals every Joiner at camp is a new system the user must name.
