# Clarity Pass (Phase 43 ledger)

**Phase:** 43-clarity-pass
**Date:** 2026-09-18

This ledger declares Phase 43's clarity sweep (CLAR-01..05): every cost the
player pays names its cause from the event payload, every loot offer shows
who can use a class-restricted item, ration math on the Hero sheet matches
what Make Camp charges, and the Gear screen is two honest panels — ON YOU
and BAG. The Phase 41 `phobiaTriggered`/`trappedPanic` lines are the model
for CLAR-01's "cause first, cost last" line shape:

> Being trapped: four walls and one door you already used. −4 hp.

## Cost-event inventory (CLAR-01)

**Line-format rule (stated once, applies to every row below):**
`<Cause>: <plain-language why>. −N <unit>.` — cause first, cost last, the
number always stated when the engine knows it, the item named when there is
no number. Combat strike lines (`struckByFoe`, `foeBolted` in its
in-combat fold, `memberStruck`) keep the Phase 34 fight-log dice-first
convention because the foe's name IS the cause and the fight log folds
them — those rows are marked "unchanged" below, not rewritten.

| Event | Cost kind | Cause key (present / ADDED) | Line before | Line after | Owner |
|---|---|---|---|---|---|
| `trapSprung` | hp | present (`name`) | "Pit finds you first. `4 hp`." | `Trap: Pit finds you first. −4 hp.` | Plan 01 |
| `trapDoubled` | hp×2 | present (`reason`) | "Cat Burglar's luck holds — for the trap. It hits twice as hard." | unchanged (already cause-first) | unchanged |
| `trapPoisoned` | affliction | type | "The trap leaves something behind that outlasts the bruise." | `Trap: it leaves something behind that outlasts the bruise.` | Plan 01 |
| `afflictionCaught` | hp | present (`kind`) | "Poison takes hold. −3 hp." | `Poison: it takes hold. −3 hp.` | Plan 01 |
| `afflictionTick` | hp | present (`kind`) | "Poison: −2 hp." | `Poison: still in you. −2 hp.` | Plan 01 |
| `fellClimbing` | hp | type (wall) | "Gravity remembers you exist — 5 hp." | `Fall: the wall had other plans. −5 hp.` | Plan 01 |
| `fellInGorge` | hp | type (crevice) | "Short. The floor of the crevice makes its introduction — 7 hp." | `Fall: short. The floor of the crevice makes its introduction. −7 hp.` | Plan 01 |
| `trappedPanic` | hp | ADDED `phobia` | "Four walls and one door you already used. −4 hp." | `Being trapped: four walls and one door you already used. −4 hp.` | Plan 01 |
| `heightsFear` | roll penalty | ADDED `penalty` | "Your stomach reaches the ground well before your feet do." | `Heights: your stomach reaches the ground well before your feet do. +2 on a roll you wanted low.` | Plan 01 |
| `waterFear` | roll penalty | ADDED `penalty` | "Something down there may be wet. That is enough." | `Bodies of water: something down there may be wet. That is enough. +1 on a roll you wanted low.` | Plan 01 |
| `waded` | squares | present (`cost`) | "Wading. Everything takes twice as long and smells worse." | `Water: 2 squares a step, and it smells worse.` | Plan 01 |
| `summonBackfired` | hp | ADDED `spell`,`sub` | "The summoning turns on you for 9 hp." | `Summoning: Summon answered, then turned on you — a Summoner's doubled creatures come with a grudge. −9 hp.` | Plan 01 |
| `backfireSelfDamage` | hp | ADDED `spell`,`sub` | "It costs you 4 hp." | `Backfire: Fireball went wrong in your hands — the Apprentice tax, one time in eight. −4 hp.` | Plan 01 |
| `earthquakeSelfDamage` | hp | ADDED `spell` | "The shaking costs you 6 hp too." | `Earthquake: the floor does not take sides. −6 hp.` | Plan 01 |
| `deathCast` | hp | ADDED `cost` | "You spend 25 hp calling on Death itself." | `Death: the spell takes its fee first. −25 hp.` | Plan 01 |
| `deathSpellTooWeak` | refusal naming the fee | ADDED `fee` | "You are too weak yourself to cast it." | `Death: the fee is 25 hp, and you would not survive paying it.` | Plan 01 |
| `foeBolted` | hp | present (`name`,`ability`) | "It lands. 5 hp." | `Shriek: it lands. −5 hp.` (direct builder; the in-combat fold text is unchanged) | Plan 01 |
| `foeDrained` | hp | present (`name`,`stolen`) | "It looks better for it. +4 hp — yours, formerly." | `Wraith: it drinks 4 hp of yours and looks better for it.` | Plan 01 |
| `struckByFoe` | hp | present (`name`) | dice-first fight-log line | unchanged (dice-first fight-log convention) | unchanged |
| `memberStruck` | member hp | present | dice-first fight-log line | unchanged | unchanged |
| `armorSoaked` | armor durability | present (`name`,`wear`) | "Your armor takes N from it so you do not have to." | unchanged | unchanged |
| `bought` | wilmst | present (`item`,`cost`) | "Bought: Axe for 63 wilmst." | `Bought: Axe. −63 wilmst.` | Plan 01 |
| `toolUsed` | item consumed | present (`tool`,`item`) | "Up the ladder, over the wall." / "Rope across the gap. Boring, safe, gone." | `Ladder: up and over the wall. The ladder stays behind.` / `Rope: across the gap, boring and safe. The rope stays behind.` | Plan 01 |
| `itemConsumed` | item consumed | present (`item`) | "Torch is spent." | `Spent: Torch. One use, as advertised.` | Plan 01 |
| `potionDrunk` | potion | present (`remaining`) | "+N hp (M potions left)." | unchanged | unchanged |
| `scrollRead`/`scrollCast` | scroll | present (`spell`) | "You unroll a scroll: X." | unchanged | unchanged |
| `lootForfeited` | loot | present (`items`,`reason`) | "You leave A, B on the floor in your hurry not to be on the floor yourself." | `Fled: the loot stays with them — A, B.` / `Dead: A stays where it fell. So, for that matter, do you.` | Plan 01 |
| `joinerMurdered` | a Joiner | present (`name`,`depth`; the cause is the Cutthroat) | one of the JOINER_MURDER_LINES | prefixed `Cutthroat: <picked line>` | Plan 01 |
| `joinerLeft` | a Joiner | present (`replacedBy`) | one of the JOINER_EXIT_LINES | unchanged | unchanged |
| `faerieBane` | base hp | type | "−3 base hp." | `Faerie: it took against you. −3 base hp.` | Plan 01 |
| `insanitySelfHarm` | hp | ADDED `loss` | "You turn on yourself." | `Insanity: you turn on yourself. −6 hp.` | Plan 01 |
| `itemDropped` | item | player choice | "You drop it. Lighter, poorer, wiser — pick two." | unchanged (ORACLE_ONLY) | unchanged |
| spell charge spent | none (no dedicated event; the cast line names the spell, the Grimoire/HUD shows the count — the `spellChargeRecovered` ORACLE_ONLY precedent) | none | n/a | unchanged | unchanged |
| `dayBegan` | none | none | n/a | (Plan 02) | Plan 02 |
| `rationsEaten` | rations | NEW EVENT | n/a (event does not exist yet) | (Plan 02) | Plan 02 |
| `wentHungry` | hp | ADDED `need`,`have`,`heft` | existing hunger line | (Plan 02) | Plan 02 |
| `rested` | (gain; names the doubling rule) | present | existing rest line | (Plan 02 verifies) | Plan 02 |
| `campFailed` | refusal | present (`need`,`have`,`members`) | "You eat N a night, you have M." | unchanged (pinned exactly by movement.test.js:984) | unchanged |

## HP not WP sweep

(filled by Task 3)

## Requirements map

(filled by Plan 04)
