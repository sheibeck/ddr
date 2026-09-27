---
phase: 79-content-narrative-pass
plan: 03
subsystem: content / narrative (blurbs, identity footer)
status: complete
tags: [VOX-04, ROLL-04, VOX-05, blurbs, identity, footer, roller, hero-tab]
requires:
  - Phases 72-78 merged (MU_CHART RULES-03 healMul, 75.1 Pilfer/scroll blurbs, 75.2 size signatures)
provides:
  - content/identity.js#IDENTITY_TRAITS (authored traits, each with a proof)
  - src/browser/identityFooter.js (identityFooter, footerLines, RACE_FIELD_LINES, RACE_COSMETIC_FIELDS, unphrasedRaceFields)
  - the footer on the Hero tab dossier (Race, Subclass) and the roller reveal (#mw-roller-rules)
  - docs/narrative-pass/why/79-03.json (45 rows)
affects:
  - 79-01 corpus (pre-registered sources content/identity.js#IDENTITY_TRAITS and bank:IDENTITY_FOOTER.<kind>.<key>)
  - 79-09 (heroTab.js owner) and 79-10 (roller.js owner) see the new footer paragraphs
  - 79-13 review page (ledger rows)
tech-stack:
  added: []
  patterns:
    - generated player text read through the engine's own helpers (schoolGate/schoolBonus/healMulFor/spellLevelFor/sizeAxisStep), never copied numbers
    - authored rule text carries { file, contains } proof, checked by a standing test
key-files:
  created:
    - content/identity.js
    - src/browser/identityFooter.js
    - test/unit/identity-footer.test.js
    - docs/narrative-pass/why/79-03.json
  modified:
    - content/index.js
    - content/flavor.js
    - content/races.js
    - src/browser/heroTab.js
    - src/browser/roller.js
    - mazeworld.html
    - test/unit/heroTab.test.js
    - test/unit/roller.test.js
    - docs/CLASS-PASS.md
    - test/unit/fixtures/shell-snapshots/mu.hero.txt
    - test/unit/fixtures/shell-snapshots/thief.hero.txt
    - .planning/todos/completed/2026-09-21-sub-class-descriptions-must-state-every-advantage-and-disadvantage.md (moved from pending)
decisions:
  - "A school bonus is stated only for schools with a thrown spell (today: offense). The engine reads schoolBonus only in the thrown branches, so a +4 divination bonus changes no roll, and a footer must not claim a rule the engine does not enforce. A test pins the engine's schoolBonus readers."
  - "The footer is two lines, 'Good: a; b.' and 'Bad: c; d.'. Human gets one neutral line. Class notes get no footer."
  - "The roller shows the footer groups for the sub-class and for a race with Good/Bad lines. Human's neutral line is left off the roller. No race name is checked in code."
  - "The race's own damage and the size damage axis read as one net number ('+11 damage with every weapon (2 of it for being large)'). A masked axis adds nothing."
  - "Only the failing prose changed. That is the roll-under lines plus six accuracy failures (Dwarven upkeep, Wizard, Master of Arms, Sorcerer, Con Artist, Summoner). Every passing note is byte-identical to the base."
metrics:
  duration: ~75 min
  completed: 2026-09-27
  tasks: 3
  commits: 5
  tests: "7,281/7,281 green (base 7,242 + 39 new); parity 66/66; boot:check PASS"
---

# Phase 79 Plan 03: Identity Footer and Blurb Pass Summary

Every sub-class and race blurb now has a "Good: … / Bad: …" footer. It is generated from MU_CHART, SPELL_LEVEL_OVERRIDES and the RACES fields, plus proven authored traits in `content/identity.js`, and it shows on the Hero tab and on the roller before DESCEND. Fifteen blurbs lost roll-under phrasing or false rules, and every number they state is pinned to the engine.

**Plan base SHA:** `cd560cc8dafe63495bd80f45816c3bf30dae7ec1`

## Commits

| Task | Commit | Message |
| ---- | ------ | ------- |
| 1 (RED) | `1cbb7c4c` | test(79-03): add failing identity footer tests (VOX-04) |
| 1 (GREEN) | `3ca0f7f5` | feat(79-03): generate the sub-class and race footer from the rules tables (VOX-04) |
| 2 | `557a2e02` | feat(79-03): blurbs read roll-high and agree with the engine (ROLL-04, VOX-04, VOX-05) |
| 3 (RED) | `a20f10a4` | test(79-03): add failing dossier and roller footer tests (VOX-04) |
| 3 (GREEN) | `d99eea0b` | feat(79-03): show the identity footer on the Hero tab and the roller (VOX-04) |

## Rule audit (Task 1, step 1)

Method: I grepped `sub === "X"`, `race === "X"` and `R.<field>` in engine/*.js, then read MU_CHART, SPELL_LEVEL_OVERRIDES, RACES, KIT and SONGS. **G** = generated from a table. **A** = authored in IDENTITY_TRAITS, with the proof named.

**Magic User** (chart G: bonus on thrown schools, gates, never-learned schools, healMul, overrides)
- Wizard: G every school from level 1, +3 thrown offense. A melee refusal (combat.js#playerStrike) proven by the contract "refuses to melee…".
- Warlock: G +4 offense, protection gate 4, healing gate 3, never special/illusion. A nightly potion copy (movement.js#newDay) and the Walking Dead boost (combat.js#startCombat), both contract.
- Sorcerer: G +4 offense, healing gate 4, never illusion. A Freeze+Fireball grant (character.js#rollGrimoire, contract); two spells per level (character.test "checkLevel: a Sorcerer gains spells on level up"); arm cap 9 (derived.js#weaponDamage, contract); one-in-eight forgetting (character.js#checkLevel, **new proof** in identity-footer.test).
- Summoner: G never illusion, healMul 0.5. A Lesser Summon day one (contract); a full Summon one level up with its duration die doubled (magic.js, casters-can-act "IDENT-03…doubled formula"); one-in-eight backfire (contract). Its divination +4, protection +2 and special +1 are inert (no thrown spell) and are not stated.
- Cleric: G divination gate 3, never special/illusion. A +3 heal and a top-four-faces classNeed (contract). Its protection +3 and healing +4 bonuses are inert.
- Illusionist: G protection gate 3, never healing, Phantom Host from level 1 (override). A chosen teleport (movement.test "teleport: an Illusionist chooses…") and d20 until level 3 (contract).
- Court Mage: G +2 offense, divination gate 4, never special/illusion. A boredom kill 1 in 6, parleys Humans, foes act first in round one (all contract).
- Apprentice: G divination gate 3. A double experience until level 3 and one-in-eight backfire (contract). The level-3 re-roll is neutral and not listed.

**Fighter** (no table; every rule is authored and covers the contract good and bad, enforced by a test)
- Knight: under-5-HP foes flee; never wins initiative vs 20+ HP.
- Guard: foes land on one face fewer; −3 damage at level 1, one less each level, gone at 4; never crits.
- Woodsman: talks to Beasts and Lair Beasts; nothing heavier than Studded.
- Soldier: camp heals double; knighted at level 3 (character.test); foes crit on their top two faces; own blows never crit (afraid.test "a noCrit Soldier…").
- Barbarian: two attacks; half experience.
- Master of Arms: +2 damage; nightly armour patch d6+3 (movement.test "newDay: a Master of Arms fighter…"); no parley; no clean round-1 withdrawal.
- Samurai: plate and a +2 katana; never wins initiative, never flees.
- Bard: talks to Humans; a song every 100 squares (combat.test "songReady…"); camp wakes monsters twice as often; dim-witted foes target the Bard.

**Thief** (authored, contract-proven)
- Pickpocket: extra take; ×1.25 buy / ×0.75 sell.
- Pilfer: traps and chests; 1-in-20 fumble on a ring, amulet, cloak or staff (PILFER_FUMBLE_KINDS).
- Cat Burglar: first strike lands; double trap damage.
- Cutthroat: first landed blow crits; 1-in-20 Joiner loss per descent.
- Cloaker: free vanish until you strike; after that, the ordinary flee roll.
- Ninja: max-damage opener; top two faces crit after it; never parleys.
- Con Artist: talks to all but Magical and the Walking Dead; a level-1 foe leaves 4 faces in 6 (combat.js#startCombat); the opener deals no damage.
- Acrobat: foes land on only 3 faces; the top 5 faces hit (6 with the dagger's +1 need); dagger only.

**Races** (RACES fields G through RACE_FIELD_LINES; name-keyed rules A)
- Human: `size`/`upkeep` only. Neutral line, proven by the contract "the neutral control".
- Elven: G size (−2 damage, face axis masked), wpMul 0.6, strikeStep 1, foeToHit +1, toHit 5. A half store prices (economy.js#priceFor, economy.test) and Humans parley with the omen bonus (combat.js#canParley/parley, rollDirection-checks "[parley:elven-humans]").
- Dwarven: G size (one face harder, damage axis masked), upkeep 1, dmg 2, foeStrikeStep 1, armorWear 0.5. A half store prices.
- Wilmsry: G heal2x, spMul 0.5. A parleys all but Magical (contract); haggle ×0.7 (tools.test "openStore: a Wilmsry's haggle…"); Magic User Joiners refuse (contract).
- Fridgian: G noArmor, frenzy (the odds are pinned to combat.js's `rollCheck(rng, 8, atLeastFor(5, 8))`), slow, hide 2. No name-keyed rule (the Samurai chargen re-roll is not listed).
- Troll: G size Large (+2 folded into damage, one face easier), upkeep 15, flatWP 75, dmg 6 + wpnBonus 3, eats 2. A prices triple (contract) and weapons ×2 on top (economy.js#openStore weaponLine, **new proof** "identity-proof: a Troll's store weapon line costs six times the base price").

## Every footer as rendered

- **Wizard**: Good: every school of magic from level 1; your thrown offense spells land on three more faces. / Bad: won't swing a weapon while a castable attack spell and a charge remain.
- **Warlock**: Good: copies a potion every night it has one; your thrown offense spells land on four more faces. / Bad: every Walking Dead foe in the fight gains HP equal to your level; no protection spells until level 4; no healing spells until level 3; never learns special or illusion spells.
- **Sorcerer**: Good: starts with Freeze and Fireball in the book; learns two new spells at every level; your thrown offense spells land on four more faces. / Bad: weapon damage never goes above 9; one level-up in eight forgets a spell that isn't Freeze, Fireball or Lightning; no healing spells until level 4; never learns illusion spells.
- **Summoner**: Good: Lesser Summon in the book and castable from day one; a full Summon arrives a level stronger, and its duration die counts double. / Bad: one full Summon in eight turns on you; never learns illusion spells; healing spells you cast heal at half strength.
- **Cleric**: Good: every healing spell heals 3 more; your top four faces hit, not a Magic User's three. / Bad: no divination spells until level 3; never learns special or illusion spells.
- **Illusionist**: Good: you choose where every teleport lands; Phantom Host castable from level 1 (level 3 for everyone else). / Bad: strikes on a d20 until level 3; no protection spells until level 3; never learns healing spells.
- **Court Mage**: Good: one foe in six dies of boredom before the fight starts; can always talk to Humans; your thrown offense spells land on two more faces. / Bad: foes act first in round one; no divination spells until level 4; never learns special or illusion spells.
- **Apprentice**: Good: double experience from kills until level 3. / Bad: one spell in eight backfires; no divination spells until level 3.
- **Knight**: Good: any foe under 5 HP flees before it can act. / Bad: never wins initiative against a foe with 20 HP or more.
- **Guard**: Good: every foe lands on one face fewer against you. / Bad: your blows deal 3 less at level 1, one less each level until level 4; your blows never crit.
- **Woodsman**: Good: can always talk to Beasts and Lair Beasts. / Bad: no armor heavier than Studded.
- **Soldier**: Good: camp heals you twice as much; knighted at level 3. / Bad: foes crit you on their top two faces, not just the top one; your blows never crit.
- **Barbarian**: Good: two attacks every strike. / Bad: half the experience from every kill.
- **Master of Arms**: Good: +2 damage with every weapon; patches your own damaged armor every night in camp. / Bad: can never talk a fight down; no clean withdrawal in round one.
- **Samurai**: Good: starts in plate with a magic katana (+2). / Bad: never wins initiative and never flees.
- **Bard**: Good: can always talk to Humans; a song every 100 squares. / Bad: camp wakes wandering monsters twice as often; dim-witted foes come for you first, even with a party beside you.
- **Pickpocket**: Good: an extra take from every kill and chest. / Bad: shops charge you a quarter more and pay a quarter less.
- **Pilfer**: Good: disarms every trap and opens every chest for free. / Bad: about one use in twenty, a magic ring, amulet, cloak or staff blows up in your hands for d10 HP and is gone.
- **Cat Burglar**: Good: your first strike of every fight always lands. / Bad: every trap that catches you deals double damage.
- **Cutthroat**: Good: your first landed blow always crits, even in heavy armor. / Bad: one descent in twenty, the Joiner beside you doesn't reach the next floor.
- **Cloaker**: Good: vanishes from any fight for free until you land a blow. / Bad: once you've struck, you flee on the ordinary roll like everyone else.
- **Ninja**: Good: your opening strike always lands for maximum damage; after that, your top two faces crit. / Bad: can never talk a fight down.
- **Con Artist**: Good: can talk to anything but Magical foes and the Walking Dead; a level 1 foe leaves before the fight two times in three. / Bad: your opening blow deals no damage.
- **Acrobat**: Good: foes land only on their top three faces; your top five faces hit, like a Fighter's (six with the dagger). / Bad: a dagger and nothing else.
- **Human**: No advantages and no disadvantages: every other race is measured against this one.
- **Elven**: Good: store prices halved; can always talk to Humans, with a bonus; strikes on a die one size better (a d12 at level 1, not a d20); at least your top five faces hit, whatever the class. / Bad: being small costs 2 damage; 60% of the usual HP, at every level; foes land on one face more against you.
- **Dwarven**: Good: store prices halved; being small makes you one face harder to hit; a night without rations costs only 1 HP (a Human's costs 4); +2 damage with every weapon; armor wears at half the rate. / Bad: foes strike on a die one size better.
- **Wilmsry**: Good: can talk to anything but Magical foes and the Walking Dead; store prices 30% off; rest, potions and your own healing spells heal twice as much. / Bad: Magic User Joiners refuse to travel with you; half the experience from every kill.
- **Fridgian**: Good: five times in eight, a frenzy adds a second swing that never wastes itself on a corpse; thick hide soaks 2 from every blow. / Bad: can never wear armor; never wins initiative.
- **Troll**: Good: starts with 75 HP whatever the class; +11 damage with every weapon (2 of it for being large). / Bad: store prices triple; weapons cost double on top of that; being large makes you one face easier to hit; a night without rations costs 15 HP (a Human's costs 4); eats two rations a night.

## Every changed note (before, after)

Every other RACE_NOTE, CLASS_NOTE, SUB_NOTE and RACES note, and every JOINER line, passed the rubric and is byte-identical to the base.

- **RACE_NOTE.Elven** (roll-under, accurate): "…and hit on a 5 whatever the class." became "…and your top five faces land whatever the class." The rest of the note is unchanged.
- **RACE_NOTE.Dwarven** (accurate, fact): "Two extra damage, a wilmst a day to feed, and every creature…" became "Two extra damage, a single Hit Point a night when the rations run out, and every creature…" (upkeep is 1 HP on an unfed night; no rule charges gold).
- **CLASS_NOTE.Fighter** (roll-under, number): "…and a 5 to hit — which at skill level I still means three swings in four…" became "…and your top five faces to hit — 16–20 on the d20 at skill level I, which still means three swings in four…"
- **CLASS_NOTE.Magic User** (roll-under, number): "…and a 3 to hit — six swings in seven are decorative." became "…and only your top three faces to hit — 18–20 on the d20 at skill level I, so seventeen swings in twenty are decorative."
- **SUB_NOTE.Guard** (roll-under, accurate, number): "…three damage off the top until level four — but every creature down here needs one better than usual to land a blow on you." became "…three damage off every blow at level one, one less each level until it is gone at four — but every creature down here lands on one face fewer against you."
- **SUB_NOTE.Soldier** (roll-under): "You take criticals on a 2 and deal them never." became "Foes crit you on their top two faces instead of one, and you deal criticals never."
- **SUB_NOTE.Master of Arms** (accurate): "…plus three with anything you have repaired yourself." (no such rule) became "…and every night in camp you hammer the dents out of your own armour."
- **SUB_NOTE.Ninja** (roll-under): "…after that a 1 or a 2 opens something up." became "…after that your top two faces open something up."
- **SUB_NOTE.Con Artist** (accurate, roll-under): "…anything with wit of 6 or under simply declines to fight you." became "…any level-one foe declines to fight you two times in three."
- **SUB_NOTE.Acrobat** (roll-under): "Everything needs a 3 to lay a hand on you and…" became "Nothing lays a hand on you except on its top three faces, and…"
- **SUB_NOTE.Wizard** (accurate): "Two wizards in a party fight each other; there is only one of you, which helps." (no such rule) became "There is only one of you, which the other wizards consider a mercy."
- **SUB_NOTE.Sorcerer** (accurate): "Two dozen spells to start and two more each level, nearly all of it fire, with a one-in-eight chance per level of simply forgetting the ones that aren't." became "Freeze and Fireball in the book from day one and two more spells each level, with a one-in-eight chance per level of simply forgetting one that isn't fire, frost or lightning."
- **SUB_NOTE.Cleric** (roll-under): "A 4 to hit instead of a 3." became "Your top four faces hit instead of three."
- **SUB_NOTE.Summoner** (identity, accurate): "You can call something up from your very first day. Everything you call arrives twice as strong and twice as long-lived, and one time in eight it arrives on the wrong side. The book declines to say whose fault that is." became "You can call something small up from your very first day. Anything bigger arrives stronger and longer-lived, and one time in eight it arrives on the wrong side. Your own healing spells, meanwhile, heal at half strength. The book declines to say whose fault any of that is."
- **RACES.Elven.note** (roll-under): "Strikes a die better and hits on 5 whatever the class — …" became "Strikes a die better and lands on its top five faces whatever the class — …"

The full before and after text and the why for each note are in `docs/narrative-pass/why/79-03.json`. That file has 15 note rows plus 30 footer rows, each footer row with `before: ""` and reason `identity`. A footer row's `after` is `footerLines(kind, key).join(" ")`.

## Pins and re-pinned tests

- The new `test/unit/identity-footer.test.js` has 32 tests. It covers:
  - chart lines, both sides, neutral, empty, encoding, adjacency, field coverage with a scratch field, proofs and ordering;
  - hygiene: no `-` before a digit, no WP, no roll-under phrase;
  - the Sorcerer and Troll identity proofs;
  - prose pins for every rewritten number, each checked against the engine: `CLASSES.*.toHit` with `facesRangeText`, `RACES.Elven.toHit`, `RACES.Dwarven.upkeep`/`dmg`, Guard `weaponDamage` gaps at levels 1, 2 and 4 plus `foeToHitVs`, Acrobat `foeToHitVs`, Cleric `classNeed`, source pins for the Soldier, Ninja and Con Artist checks, Summoner `healMulFor` and the backfire d8, and source pins for the Sorcerer, Master of Arms and Pilfer;
  - a roll-under scan of every note;
  - ledger validation.
- `test/unit/roller.test.js`: the "exactly one import" pin became "exactly two imports", adding `import { footerLines } from "./identityFooter.js"`. There are 4 new VOX-04 tests.
- `test/unit/heroTab.test.js`: 3 new VOX-04 tests.
- No existing note pin needed a change. casters-can-act (Wizard `/staff/`, `/attack spell/`, Summoner `/(first day|day one)/`), cutthroat-joiner, pilfer-fumble, scroll-read-surfaces and size-voice (Elven thin-boned / easy to hit / 2 damage, Dwarven small / one face harder / fair trade) all hold on the new text.
- `test/unit/identity-contract.test.js` is unchanged. No half's `name` needed to change to act as a proof, and its Summoner row was already current.

## Snapshot regenerations (declared)

I ran `MZ_SNAPSHOT_UPDATE=1 node --test test/unit/shell-tab-snapshots.test.js`. With `git diff --ignore-cr-at-eol`, only two fixtures moved. The other six showed CRLF noise only and were restored with `git checkout --`.
- `mu.hero.txt` (Human Wizard): the Race section gains the neutral footer paragraph, the Subclass section gains its Good and Bad paragraphs, the Class section shows the rewritten Magic User note, and the Wizard note has the rewritten closing sentence.
- `thief.hero.txt` (Wilmsry Cat Burglar): the Race and Subclass sections each gain their Good and Bad paragraphs. No note text changed.

`git diff --name-only cd560cc -- test/unit/fixtures/shell-snapshots` lists exactly these two files.

## CLASS-PASS edits

In `docs/CLASS-PASS.md` "### Good / bad table" (still 30 rows, same heading, class-pass-ledger green):
- Summoner row: the RULES-03 wording (Lesser Summon on day one / half-strength own healing plus the full-Summon backfire). This replaces the removed offense gate.
- Cleric: "its top four faces hit, not three".
- Court Mage: "the top 2 faces of a d12".
- Apprentice: "until level three".
- Knight: "max HP" in place of `maxWP`.
- Guard: "lands on one face fewer", with the shrinking −3 penalty.
- Soldier: "top two faces", and its own blows never crit.
- Ninja: "top two faces crit".
- A note under the table: the player-facing source is now the generated footer (`identityFooter.js` + `content/identity.js` + the chart and RACES tables).

## ROLL-04 check (voice-inventory not in this worktree)

79-01's `tools/voice-inventory.mjs` is not merged here, so I ran the ROLL-LEDGER handoff patterns by hand over RACE_NOTE, CLASS_NOTE, SUB_NOTE, every RACES note and the three JOINER banks. The patterns were: need(s) N, natural 1, N or under/less/lower/below, a N to hit, on a N, need(s) … better, −N on to-hit, 1–N ranges, and wit-of. The result is 0 hits, and the same scan is now a standing test in identity-footer.test.js. My first Con Artist rewrite ("level one or lower") tripped the "or lower" pattern and was changed to "any level-one foe". 79-12 should rerun `node tools/voice-inventory.mjs --owner 79-03 --roll-under --hygiene --safety --count` once 79-01 lands.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 / transparency prohibition] Non-offense school bonuses are not stated**
- **Found during:** Task 1.
- **Issue:** The must-have says "every school bonus above 0 yields an advantage naming the school". The engine reads `schoolBonus` only in the thrown-spell branches (magic.js castSpell, combat.js member cast), and every thrown spell is offense school. So a Summoner's divination +4 or a Cleric's healing +4 changes no roll, and stating them would claim a rule the engine does not enforce (the plan's own transparency prohibition).
- **Fix:** Bonus lines are generated only for schools that have a thrown spell (derived from SPELLS). A standing test pins the engine's `schoolBonus(` readers (combat 1, derived 1, magic 1) and `THROWN_SCHOOLS = ["offense"]`, so a new reader fails the test and forces a revisit.
- **Files:** src/browser/identityFooter.js, test/unit/identity-footer.test.js. **Commit:** 3ca0f7f5.

**2. [Rule 1] Accuracy rewrites beyond the roll-under list**
- **Found during:** Task 2 audit.
- **Issue:** Six blurbs stated rules the engine does not have, or had wrong numbers: the Dwarven "wilmst a day", Wizard "two wizards fight", Master of Arms "+3 on repaired", Sorcerer "two dozen spells, nearly all fire", Con Artist "wit of 6", and Summoner "everything doubled" (the Lesser Summon is neither doubled nor at risk).
- **Fix:** I changed only the failing clause and kept each joke. Every changed clause is pinned. **Commit:** 557a2e02.

**3. [Rule 3] Proof tests added where no test proved an authored trait**
- The Sorcerer's one-in-eight forgetting and the Troll's ×2 weapon price had no test anywhere. Both proofs now live in identity-footer.test.js ("identity-proof: …").

**4. [Rule 3] roller.js import pin widened**
- The existing pin allowed exactly one import (content/index.js). The plan requires `footerLines(` in roller.js, so the pin now allows the pure `./identityFooter.js` as a second import. **Commit:** a20f10a4.

**5. Parity inventory not touched**
- No parity fixture moved (parity 66/66), and the plan's acceptance requires `git diff --quiet cd560cc -- engine test/parity`. So I added no `### Plan 79-03` subsection to test/parity/FIXTURE-INVENTORY.md; there is nothing to declare. The two unit shell snapshots are declared above, per shell-tab-snapshots.test.js's own rule.

### TDD Gate Compliance

- Task 1: RED `1cbb7c4c` (import fails; IDENTITY_TRAITS not exported) then GREEN `3ca0f7f5`.
- Task 3: RED `a20f10a4` (8 failing) then GREEN `d99eea0b`.
- Task 2: the prose pins were committed with the rewrites in one commit (`557a2e02`). I added them as the rewrite landed, not in a separate RED commit.
- Between `557a2e02` and `d99eea0b`, shell-tab-snapshots is red on mu.hero.txt, because the rewritten Magic User class note is regenerated in Task 3 as the plan orders. HEAD is green.

## Findings handed on (not fixed here: outside scope, or a rules question for the user)

- **The MU_CHART bonuses on protection, healing, divination and special are inert in the engine.** No thrown spell exists in those schools. The mu-chart header calls them "thrown-spell bonus", and the prototype has the same behaviour. It is worth a user ruling: either give those bonuses an effect, or accept the chart as flavour.
- Before this plan, the Elven and Dwarven half store prices (`priceFor`) and the Wilmsry ×0.7 haggle were not in any prose or table. They are now in the footer.
- The SUB_NOTE for Pilfer names a ring, amulet or cloak, but PILFER_FUMBLE_KINDS also includes staves. The footer states the full list. The prose was left as 75.1 vetted it, which the plan requires.
- The Bard's "dragons hand over gifts", the Woodsman's "no shield" and the Thief's "leather at the very best" (Heft allows heavier armour) are lore-level claims. I judged them flavour and left them unchanged, for the user's review at milestone close.
- ROADMAP Phase 79 criterion 1 still cites "no offense spell until level 3" for the Summoner. The orchestrator should update the wording to the 2026-09-25 amendment, as the plan's flagged assumptions say.
- The todo `2026-09-21-sub-class-descriptions-must-state-every-advantage-and-disadvantage.md` is closed. It moved to `.planning/todos/completed/` with a Resolution note.

## Human check (deferred UAT, Pixel 7 at milestone close)

- Roll until a Summoner comes up. The reveal should show the Summoner group with Good and Bad, including "healing spells you cast heal at half strength". The Hero tab's Subclass section should show the same lines under the blurb.
- Roll a Warlock, an Illusionist and a non-Human race. The footers should name the gates, Phantom Host at level 1, and the race's trade-off.
- At text sizes S, M and L, the dossier `.doss-rules` and the roller `.mw-roller-rules` should wrap without clipping. The roller screen scrolls (`overflow-y:auto`).

## Verification

- `node --test test/unit/identity-footer.test.js test/unit/identity-contract.test.js`: pass.
- `node --test test/unit/identity-footer.test.js test/unit/class-pass-ledger.test.js test/unit/pilfer-fumble.test.js test/voice/safety-scan.test.js test/unit/hp-not-wp.test.js`: pass.
- `node --test test/unit/heroTab.test.js test/unit/roller.test.js test/unit/shell-tab-snapshots.test.js`: pass.
- `npm test`: 7,281/7,281 pass, 0 fail.
- Parity: 66/66.
- `npm run boot:check`: PASS (no-uncaught, painted, graves, title). I built `www/` through a temporary node_modules junction and removed only the junction afterwards.
- `git diff --quiet cd560cc -- engine test/parity`: exits 0.
- `grep -c "export function identityFooter" src/browser/identityFooter.js` is 1. `footerLines(` appears in heroTab.js and roller.js.
- No bot or tuning runs (user ruling 2026-09-26).

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: content/identity.js, src/browser/identityFooter.js, test/unit/identity-footer.test.js, docs/narrative-pass/why/79-03.json
- FOUND commits: 1cbb7c4c, 3ca0f7f5, 557a2e02, a20f10a4, d99eea0b
