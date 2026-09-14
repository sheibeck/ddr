# Class / Sub-class / Race audit — v1.2 planning input (Fable pass, 2026-09-14)

Code-grounded "one good, one bad" audit of every sub-class and race plus a 400-seed bot baseline. Written during /gsd-new-milestone as input for the v1.2 phase planners (IDENT-*, HARN-*, PLAY-*). Not a decision record — rulings land in docs/CLASS-PASS.md (PLAY-03).

Legend: GOOD = implemented advantage; BAD = implemented disadvantage; FLAVOR-ONLY = promised in SUB_NOTE/RACE_NOTE but not in engine.

## Magic User (toHit 3 on d20 at L1 = 15% melee; 25+d10 wp; Cloth AR3; charges 2L+2 = 4/day at L1; 1 charge back per 20 steps)
| Sub | GOOD | BAD | Verdict |
|---|---|---|---|
| Wizard | +3 throw bonus, every school | refuses melee while ANY charge remains (combat.js:337) even with zero attack spells | BROKEN-FEEL: grimoire can roll no attack spell → cannot act |
| Warlock | +4 offense/+2 div; potion copied daily | boosts Walking Dead foes' wp; no special/illusion; protection gate 4, healing gate 3 | OK; attack spell not guaranteed |
| Sorcerer | Freeze+Fireball guaranteed, +2 spells/level, +4 offense | melee capped 9; 1/8 forgets a non-fire spell per level | OK (model pair) |
| Summoner | Summon doubled (+1 lvl, 2× rounds), +4 div, +2 prot | 1/8 summon backfires (lvl²+d6 self dmg); offense gated to L3 | BROKEN-FEEL: Summon is a **lvl-2 spell** → a L1 Summoner cannot summon; L1 kit = Shield/Heal/Detect Magic + 15% staff |
| Cleric | Mail armor, to-hit 4, +3 heal, Heal/Major Heal guaranteed, Turn Dead | 0 offense bonus | GOOD ok, BAD soft |
| Illusionist | Mirror Self (foes need a 1), chooses teleport exit, special +4 | strikes on **d20 until L3**; no healing | BROKEN-FEEL: no damage source at L1 (Phantom Host is lvl 3; Summon lvl 2) → stalemate fights |
| Court Mage | 1/12 foe dies of boredom; +2 off/+2 prot/+1 heal | none | NO BAD; GOOD is weak |
| Apprentice | double SP to L3, all schools | 1/8 backfire (thrown: half dmg to self, can kill) | OK (model pair) |

Systemic: **Freeze = instant kill on hit** (magic.js frozenSolid, d10 ≤ 6+bonus). An MU with Freeze is strong; without any attack spell they're a 15%-to-hit quarterstaff. Variance is the whole MU problem.

## Fighter (toHit 5; 50+d8 wp; Studded AR10; 8 vp skills)
| Sub | GOOD | BAD | Verdict |
|---|---|---|---|
| Knight | foes <5 wp flee; Awl Pike+2 | "everything over 20 comes straight at you" = FLAVOR-ONLY | NO BAD |
| Guard | Spear+2 | no crit ever; −(4−level) dmg to L4 | NO GOOD ("the profession is standing there") |
| Woodsman | Staff+3, parley beasts (+3) | starts Leather; "no mail/plate" = FLAVOR-ONLY (items.js has no Woodsman gate) | BAD unenforced |
| Soldier | 2× camp healing; knighted at L3 | crits taken on ≤2; deals none | OK |
| Barbarian | 2 attacks | half SP | OK (model pair) |
| Master of Arms | +2 dmg all weapons, patches armor nightly | "attacks without question" = FLAVOR-ONLY | NO BAD |
| Samurai | Plate, Katana+3, magic wpn 2 | never first, never flees | OK (model pair) |
| Bard | songs (L1 soothes beasts only), parley Humans | "stupid creatures come for you first" = FLAVOR-ONLY | NO BAD; L1 GOOD narrow |

## Thief (toHit 4; 40 wp flat; Leather AR6; +5 flee; opener backstab crit; 12 vp skills; a random cloak)
| Sub | GOOD | BAD | Verdict |
|---|---|---|---|
| Pickpocket | extra gold on every take | none; Dagger (d6/2 → 2-4 dmg at L1) | NO BAD (dagger is a class-wide tax, not a sub identity) |
| Pilfer | free trap disarm, free chest open | cannot read scrolls; "no magic items that don't heal" = partially FLAVOR-ONLY | OK-ish |
| Cat Burglar | first strike auto-hits; free Climbing | traps deal double | OK (model pair) |
| Cutthroat | first landed blow crits | none | NO BAD |
| Cloaker | always escapes free | "earns nothing from fled fights" (true for everyone) | BAD is not a bad |
| Ninja | opener auto-hit for MAX dmg; crit on 1-2; free Silence | "never speaks" = FLAVOR-ONLY (canParley has no Ninja gate) | NO BAD → strongest thief |
| Con Artist | L≤1 foes leave 4/6; parley anything, +4 | first landed blow = 0 dmg | OK (model pair) |
| Acrobat | foes need 3; hits at 5; +3 trap dodge | dagger only | OK (model pair) |

## Races
| Race | GOOD | BAD | Verdict |
|---|---|---|---|
| Human | — | — | canon "no excuses" (decision: keep as control?) |
| Elven | strike die +1, hit on 5, half prices | 0.6× wp, foes need 4 | OK |
| Dwarven | +2 dmg, upkeep 1, half prices | foes strike a die better | OK |
| Wilmsry | 2× heal, parley all but Magical +4, 30% haggle | half SP | OK |
| Fridgian | frenzy: 2 swings 5/8 (2nd needs 3) | no armor, always last, 50% wasted swing on a corpse | OK |
| Troll | 75 wp flat, +9 dmg | eats 2 rations, triple prices | OK |

## Level-1 melee reality check (dmg = L² + weapon + prof + race)
- Thief w/ Dagger: 1 + (1..3) + 0 = 2–4 (backstab opener ×2). vs Cave Bear 25 wp.
- MU w/ Staff: 1 + d6 = 2–7 at 15% to hit.
- Fighter Knight: 1 + d8+2 + 2 = 6–13 at 25% to hit.

## Baseline — 400-seed v1.1 tuning bot (pre-milestone, commit 1b4daed engine unchanged since v1.1 close)

Bot caveat: v1.1 policy casts only thrown spells and never summons/sings/parleys by sub-class, so caster subs are UNDER-measured. Direction is unambiguous; magnitudes will move once HARN-02 lands.

```
BY CLASS
key              n    mean   p50 p90 max reach5% lvl kills
Thief            161  3.2    3 5 12 19.9 2.08 6.8
Fighter          127  3.06   3 5 9 11.8 1.95 6.4
Magic User       112  2.13   2 4 5 3.6 1.3 1.5

BY SUBCLASS
key              n    mean   p50 p90 max reach5% lvl kills
Barbarian        15   4.13   4 8 9 46.7 2.53 11.5
Ninja            19   4.11   4 6 10 42.1 2.79 11.3
Cat Burglar      12   3.75   3 7 12 33.3 2.33 11.8
Acrobat          21   3.62   3 5 9 23.8 2.38 9.1
Knight           23   3.35   3 5 7 17.4 2 5.2
Con Artist       22   3.32   3 5 6 18.2 2 2.9
Soldier          19   3.26   3 5 6 15.8 2.21 7
Pilfer           17   3      3 6 6 17.6 1.82 6
Cloaker          24   3      3 5 5 16.7 1.96 5.2
Master of Arms   12   2.92   3 4 4 0 2.08 8.2
Court Mage       17   2.76   3 4 5 5.9 1.47 2.1
Woodsman         17   2.76   2 4 6 5.9 1.76 5.8
Cutthroat        21   2.71   3 5 7 14.3 1.86 5.9
Samurai          14   2.71   3 4 4 0 1.79 5.2
Cleric           18   2.67   3 4 5 5.6 1.61 2.8
Bard             11   2.64   3 4 4 0 1.64 4.6
Pickpocket       25   2.56   2 4 6 4 1.72 5.3
Sorcerer         12   2.5    2 4 4 0 1.42 0.6
Guard            16   2.38   2 4 4 0 1.5 3.9
Illusionist      12   2.08   2 4 4 0 1.17 0.8
Warlock          18   1.78   2 3 5 5.6 1.11 1
Apprentice       14   1.71   2 3 3 0 1.21 1.8
Wizard           12   1.67   1 4 5 8.3 1.25 0.4
Summoner         9    1.33   1 2 2 0 1 2.1

BY RACE
key              n    mean   p50 p90 max reach5% lvl kills
Troll            51   3.47   3 5 10 19.6 2.16 7.1
Wilmsry          55   3.29   3 6 12 20 1.95 6.6
Elven            64   2.91   3 5 7 14.1 2.03 6.2
Human            133  2.65   2 4 9 9 1.74 4.5
Dwarven          50   2.58   2 5 7 12 1.54 3.6
Fridgian         47   2.49   2 4 6 6.4 1.55 3.6

TOP DEATH CAUSES
foe:Dante                    63
undone by a trap             34
starved in the dark          32
fell off a wall              27
foe:Poltergeist              23
foe:Gremlin                  22
maxActionsHit                19
spent by the dungeon itself  17

died on floor 1: 85 / 400
```

Reproduce: the scratch script forced nothing — it ran `playRun(seed, BOT_DEFAULTS)` over seeds `i*7919+1`, i<400, grouping by the rolled `newRun(seed).c` class/sub/race. HARN-01/03 replace it with a forced-combination matrix.
