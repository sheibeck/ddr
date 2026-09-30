# Phase 90: SPELL-10 slate (DRAFT, for the user's ruling)

**Drafted:** 2026-09-30. **Status:** proposal only. Nothing below is built. The user rules on it at the SPELL-10 `checkpoint:decision`.

**Requirement:** the Special and Illusion schools get real spells: at least one Special and one Illusion spell per spell level 1–5, drawn first from the rulebook's page-50 "Spell List", each one useful in a fight or in the maze.

## The slate at a glance

| Level | Special | Illusion |
|---|---|---|
| 1 | **Open/Lock**: your next chest opens with no lock roll | **Door Illusion**: you leave the fight at once, no flee roll |
| 2 | **Fly**: 30 squares of flight over walls, crevices and water | **Senseless**: one foe swings at its own side for d4 rounds |
| 3 | **Stop Time**: every foe stops for 2 rounds | **Chameleon Tongue**: an immediate parley at +4, even with Magical foes |
| 4 | **Enchant Character**: +2 to hit, foes −2 to hit you, no crits on you, 50 squares | **Size of the Behemoth**: weaker foes flee; the rest cower for the fight |
| 5 | **Speed of Sound**: two blows a swing and you act first, 50 squares | **Duplicate Foe**: one foe fights its double and hits itself for d4+1 rounds |

The existing spells stay: **Summon** (Special 2, not on page 50) and **Mirror Self** (Illusion 1, not on page 50). Lesser Summon and Phantom Host are removed (SPELL-12). With this slate, every level 1–5 has a Special and an Illusion pick. Level 1 Illusion has two (Mirror Self and Door Illusion), and level 2 Special has two (Summon and Fly).

Split by school: the **Special** spells are buffs and travel (you get faster, sturdier, and harder to stop). The **Illusion** spells are tricks played on foes (they are fooled, misdirected, scared or talked round). That fits the rulebook's Illusionist ("specialists in the art of falsehood, forgery, and inter-planer travel", p. 17).

---

## 1. What the rulebook actually says (page 50, read from the rendered page)

Page 50 was rendered to an image and read by eye. Word coordinates from the PDF confirmed the cells that could be misread (the text extraction loses the table layout).

| Level | Special column (rows 1, 2, 3) | Illusion column (rows 1, 2, 3) |
|---|---|---|
| 1 | Open/Lock · Hover · (none) | Door Illusion · Darkness · **Light** |
| 2 | Fly · Control · (none) | Senseless · Fog · Disillusion |
| 3 | Enchant Weapon · **Creatures** · **Stop Time** | Clone · **Chameleon Tongue** (one spell) · Throw Voice |
| 4 | Breathe Foreign Environment · Enchant Character | Size of the Behemoth · **Death** |
| 5 | (row 1 blank) · Speed of Sound | Duplicate Foe · **Teleport** |

The level-one header reads "Illusionist"; the other levels read "Illusion".

**Corrections to the candidate list in `.planning/notes/v2.3-user-rulings-2026-09-30.md`:**
- "Chameleon" and "Tongue" are **one** Illusion spell, **Chameleon Tongue** (level 3, row 2). It is not a Special spell.
- **Stop Time** is **Special** level 3. **Creatures** (Special 3, row 2) was missing from the list.
- **Possess** is **Divination** level 3. It is out of scope for SPELL-10.
- **Light** (Illusion 1, row 3) and **Death** (Illusion 4, row 2) were missing. The Illusion Death shares its name with the existing Offensive level-5 Death.
- At level 5, **Speed of Sound** is Special, **Teleport** and **Duplicate Foe** are Illusion, and **Werebeast** is **Divination** (out of scope). Only one Special level-5 spell exists: row 1 of that column is blank.

**The rulebook gives no descriptions for these two schools.** The spell descriptions (pp. 27–35) cover only Offensive (pp. 27–29), Protection (pp. 29–31), Healing (pp. 32–33) and Divination (pp. 33–35). Every Special and Illusion spell is a name on the page-50 list and nothing more, so each effect below is designed here. The canon hooks used:
- p. 17: the Illusionist controls a teleport dot and "will each start with 3 illusion spells on top of the beginning roll". Only Illusionists (and Apprentices, "even Illusionist spells") learn Illusion spells.
- p. 18: the bonus table (the source of `content/mu-chart.js`).
- p. 25: "Spells will only work on creatures who are of equal or lesser level than the caster unless otherwise specified". This slate uses that rule only where a spell says so.

---

## 2. Who can learn each school today (`content/mu-chart.js`)

| Sub-class | Special | Illusion | Gate level |
|---|---|---|---|
| Wizard | yes (+0) | yes (+0) | none, open at 1 |
| Warlock | **no** | **no** | n/a |
| Sorcerer | yes (+1) | **no** | none |
| Court Mage | **no** | **no** | n/a |
| Illusionist | yes (+4) | yes (+0) | none |
| Cleric | **no** | **no** | n/a |
| Summoner | yes (+1) | **no** | none (plus the SPELL-12 Summon exception) |
| Apprentice | yes (+0) | yes (+0) | none, until the level-3 reveal |

No sub-class has a `gate` on either school, so both open at level 1 wherever they are allowed. No race rule forbids a school (`content/races.js` and `content/identity.js` hold none).

**The gates hold for every new spell with no extra code,** as long as each row carries `s: "special"` or `s: "illusion"`. Every path that hands out a spell reads `canLearn` / `grantableAt` → `MU_CHART`:
- chargen `rollGrimoire`, for heroes and Joiners (`engine/character.js` ~L343, `grantableAt`);
- the Sorcerer's level-up picks (`canLearn("Sorcerer", …)`, so no Illusion spell);
- the Apprentice's level-3 reveal, which drops any book spell the new sub-class can't learn (`character.js` ~L692; for example, an Apprentice revealed as a Warlock loses Door Illusion and Stop Time);
- the grimoire find (`encounters.js#findGrimoire`) and copying a scroll into the book (`magic.js#readScroll`), both through `canLearn`;
- the combat spell menu and `castSpell`, through `canCast` (which trusts the book, and the book is already gated).

A one-shot scroll read stays under RULES-10: anyone may try to read it and cast it once, but it copies into a book only for a sub-class that can learn its school.

**Result:** the Special spells reach the Wizard, Sorcerer, Illusionist, Summoner and Apprentice. The Illusion spells reach the Wizard, Illusionist and Apprentice. **The Warlock, Court Mage and Cleric get neither, and the Sorcerer and Summoner get no Illusion spell.** The seed-sweep test and the content guard in 90-CONTEXT.md pin this.

---

## 3. Engine reuse, in one place

Most of the slate runs on existing machinery. Four small additions carry every spell:

| Wiring | What it is | Spells it carries |
|---|---|---|
| **A. Spell-sourced timed effects** | A SPELLS row may carry an `act` record (the potion shape: `{ kind, effect, eff }`). The cast starts a `spell:<name>` squares timer (`startEffect`). `liveItemEffects` (and so `eff`, `itemEffectActive` and the condition chips) reads `spell:` records as well as `item:` records. That makes every existing item-effect kind castable (fly, haste, glow, invis, unseen, tongue, critWard), plus the `eff` payloads (`toHit`, `foeToHit`, `critWard`, `sight`, `light`). Name collisions with potions (Strength, Death, Invisible) can't happen because of the `spell:` prefix. Check that the Phase 88 source-slot sweep ignores records with no `src`. | Fly, Enchant Character, Speed of Sound (alternates: Hover, Light, Enchant Weapon) |
| **B. Timed holds** | `combat.js#holdFoe` already takes a rolled number of rounds (Freeze's `{ rounds }`). A new hold kind `"time"` needs its own chip text. A held foe skips its turns, a hit doesn't end the hold, and it is struck as if dozing (at least 5 winning numbers). | Stop Time (alternate: Throw Voice) |
| **C. Misdirected swings (new)** | `f.misdirect = { at: "friends" \| "self", left }`, read in `foeTurn`'s swing loop. The foe rolls its normal to-hit and deals its normal damage (`foeHitFor(foeLevelBase(f) + dice…)`), aimed at another live foe or at itself, and never at your side. If it has no other foe to hit, the swing is wasted. `left` counts down once per foe turn. This is the only genuinely new combat system in the slate. | Senseless, Duplicate Foe (alternate: Control) |
| **D. Existing end-of-fight paths** | Flee's Smoke branch (`forfeitLoot` + `fled` + `endCombat`); `parley()` with fluency 2 (the unreachable fluency-2 branch in `canParley` finally gets a source); Weaken's room machinery (`roomWeakenResists`, `C.weakened`, `foeToHitPenalty`) held for the whole fight; Insane's flee outcome (`alive = false, fled = true`). | Door Illusion, Chameleon Tongue, Size of the Behemoth |
| **E. A next-chest flag** | A `spell:Open/Lock` squares record (100 squares) that `encounters.js#openChest` reads and spends. | Open/Lock |

**Resists (the user's 2026-09-27 ruling):** every spell cast on a foe is resisted on the foe's intelligence. The foe resists on half its intelligence, in numbers, on a d20 (intelligence 10 resists on 16–20; intelligence 16 resists on 13–20). Self spells (`SPELL_SELF_KINDS`) are never resisted. The control spells below also take whatever RULES-18 depth rule Phase 90 keeps for controls.

**Content invariants:** new rows are **appended** to `SPELLS`. Array position is load-bearing: `castSpell` idx, the magic fixture and `readScroll`. The new rows lengthen `rollGrimoire`'s shuffled pools for the eligible sub-classes, so fixtures move. Under the greenfield rule those moves are measured, declared and regenerated. The alternative is `roll: "derived"` on each new row, which keeps the main-rng shuffles unchanged.

---

## Level 1

### Special 1: Open/Lock (primary)
- **School / level / niche:** Special, 1, `utility` (new niche key; see Open questions).
- **Effect:** the next chest you step on within 100 squares opens with no lock roll, for any class and with or without lockpicks. The spell is spent on that chest. Recasting it restarts the 100 squares; it never stacks. Today a Magic User with no lockpicks opens a chest on 13–20 on a d20 (12–20 at intelligence 15+). A failed roll loses the chest for good, because the tile clears either way. So this spell turns a coin flip into a sure thing: the gold, the 2-in-3 scroll and the treasure offer.
- **Engine:** wiring E. `openChest` checks the record before its lock roll and draws nothing when the spell opens the chest. That means a new event, not a moved draw, for everyone else.
- **Combat:** usable anywhere. In a fight it only arms the next chest (it could instead be refused in a fight; the default is to allow it).
- **Draft `txt`:** `utility · your next chest · springs open with no lock roll, if you reach one within 100 squares; lockpicks everywhere feel threatened`
- **Cast line (narration draft):** "The next lock you meet is going to have a very confusing day."
- **Source:** page 50, Special, level 1, row 1. The "Lock" half has nothing to act on: the maze has no locked doors, so it is a name only (see Skipped).

### Illusion 1: Door Illusion (primary)
- **School / level / niche:** Illusion, 1, `defensive`.
- **Effect:** you conjure a door that isn't there and leave through it. The fight ends at once: no flee roll, no parting blow, and the spoils stay behind, as with any flee. **The cleverest foe gets one resist roll** (its intelligence, as above). If it sees through the door, the spell does nothing and your turn is spent. Against a room of beasts with intelligence 1–3 the escape works 90–95% of the time. Against an intelligence-16 foe it works 60% of the time.
- **Engine:** wiring D, the flee path Smoke already uses (`forfeitLoot(state, "fled")`, a `fled` event with `reason: "door"`, then `endCombat`). There is one `foeResistsSpell` call on the highest-intelligence live foe. Joiners leave with you, as with any flee.
- **Combat:** combat-only (`combatOnly: true`).
- **Draft `txt`:** `defensive · the fight · a door that isn't there, and you through it: no flee roll, no parting blow, spoils left behind; the cleverest foe may see through it, and then you have spent your turn admiring a wall`
- **Cast line:** "You open a door in the middle of the room, step through, and close it behind you. None of that happened, but they'll never prove it."
- **Source:** page 50, Illusionist, level 1, row 1. Canon p. 17: the Illusionist's craft is falsehood and escape.

### Level-1 alternates
- **Hover (Special 1, row 2):** `utility · you · for 20 squares you float a foot off the floor: crevices and water are no bother (no leap roll, water costs one square); a wall to climb is still a wall`. Uses wiring A with a new `hover` kind read by the gorge branch and `moveCost` (the `fly` kind would also clear walls). It overlaps Fly (level 2); if Fly ships, Hover is redundant.
- **Darkness (Illusion 1, row 2):** `control · every foe · fights in a dark only it can see: foes −2 to hit anyone on your side and land no criticals, d4+1 rounds`. This needs a new combat-wide foe to-hit term (like Battle Roar's −2) plus a no-crit term. It sits next to Weaken; see Balance.
- **Light (Illusion 1, row 3):** `sight · you · 50 squares of light: the dark hides nothing on the map and costs you nothing in a fight; it's only an illusion of light, but the dark is gullible`. Wiring A with the Amulet of Light's exact payload (`kind: "glow"`, `eff: { sight: 1, light: 1 }`), so it costs almost no code. The waiver label would need a spell name instead of "amulet". Cheap enough to add as a bonus eleventh spell if wanted.

---

## Level 2

### Special 2: Fly (primary)
- **School / level / niche:** Special, 2, `utility`.
- **Effect:** 30 squares of flight. A wall to climb or a crevice to leap is crossed with no roll, no tool and no fall. Water costs one square instead of two. This is the Cloak of Flying's effect (20 squares) for one spell charge. It does nothing in a fight.
- **Engine:** wiring A, `act: { kind: "fly", effect: 30 }`. `move`'s climb and gorge branch (`isFlying` → `flyOver`) and `moveCost` already read it, and the flight chip already renders.
- **Combat:** usable anywhere; it has no effect in a fight.
- **Draft `txt`:** `utility · you · flight for 30 squares: walls to climb and crevices to leap are just scenery, and water costs one square; useless in a fight, where everything can reach you anyway`
- **Cast line:** "Your feet leave the floor. The floor takes it personally."
- **Source:** page 50, Special, level 2, row 1.

### Illusion 2: Senseless (primary)
- **School / level / niche:** Illusion, 2, `control`.
- **Effect:** one foe (your target) loses its senses for d4 rounds. Each of its turns, it swings at another foe instead of your side, rolling its normal to-hit and dealing its normal damage. With no other foe left it swings at the air, and the turn is lost. A hit on it does **not** end the spell. It resists on its intelligence.
- **Engine:** wiring C, `f.misdirect = { at: "friends", left: d4 }`. Its target is chosen like Insane's `strike ally` (`magic.js` insane r===2), but the effect lasts for rounds.
- **Combat:** combat-only.
- **Draft `txt`:** `control · one foe · loses its senses for d4 rounds and swings at its own side; with nobody else to hit, it hits the air, which never complains`
- **Cast line:** "{Foe} can no longer tell friend from furniture. It picks a friend."
- **Source:** page 50, Illusion, level 2, row 1.

### Level-2 alternates
- **Control (Special 2, row 2):** `control · one foe of your level or lower · fights for you for d4 rounds: its blows land on its own side; alone, it just stands there sulking`. Wiring C plus the p. 25 level rule. It is nearly the same spell as Senseless in another school, so ship one or the other.
- **Fog (Illusion 2, row 2):** `defensive · your whole side · foes hit only on their die's top two numbers (7–8 on a d8, 19–20 on a d20) for d4 rounds, and a flee inside the fog needs no roll`. This reuses the party-wide `foeToHitPenalty` cap on its own timer, plus a flee check like Smoke's. See Balance for why it needs the flee clause to beat Weaken.
- **Disillusion (Illusion 2, row 3):** `answer · every foe · its tricks stop working for the fight: magic-only and dagger-only foes can be struck by anything, and a foe's mirror image or invisibility pops`. This needs a new combat flag read by `targetStrikeFaces` and `allyTurn`. It is a real answer to magic-only foes (who are untouchable today without a magic weapon), but it is narrow.

---

## Level 3

### Special 3: Stop Time (primary)
- **School / level / niche:** Special, 3, `control`.
- **Effect:** every foe that fails its resist is stopped for **2 rounds**. It takes no turns, a hit doesn't restart it, and your side hits it on at least the top five numbers of the die (16–20 on a d20, 4–8 on a d8), as with a sleeper. Time resumes after two rounds, and so do they.
- **Engine:** wiring B, `holdFoe(state, f, "time", sp.n, events, { rounds: 2 })` per foe after `foeResistsSpell`. The held skip, the 5-number floor (`targetStrikeFaces`, `allyTurn`) and the Held chip already exist; the chip needs a "time" kind.
- **Combat:** combat-only.
- **Draft `txt`:** `control · every foe · stopped for 2 rounds; hitting it doesn't start it again, and you hit it on at least the top five numbers of your die (16–20 on a d20); then time resumes, and so do they`
- **Cast line:** "The room stops. Somewhere a clock is very upset about this."
- **Source:** page 50, Special, level 3, row 3.

### Illusion 3: Chameleon Tongue (primary)
- **School / level / niche:** Illusion, 3, `answer`.
- **Effect:** you speak their language like a local and start talking at once. The spell **is** the fight's one parley attempt, made with fluency 2: **+4 on the parley roll**, and it opens every foe type except the Walking Dead, including Magical foes. Parley succeeds on the top (9 + bonus) numbers of a d20, capped at 17. For a level-3 caster against level-3 foes that is 13 numbers, a success on 8–20 (65%); the best case is 4–20 (85%). A failure insults them, as any failed parley does. It can't be cast once the fight's parley is spent. What a successful parley pays follows PARLEY-01 (Phase 91; the user wants full experience and spoils).
- **Engine:** wiring D. The cast sets a fight-scoped fluency of 2 (`fluency()` gains a second source: `C.tongue`, or a `tongue: 2` payload) and calls `parley()`. The fluency-2 branch of `canParley` (Magical opens) and `2 * fluency` in the bonus already exist.
- **Combat:** combat-only.
- **Draft `txt`:** `answer · this fight · you speak their tongue like a local and talk at once: a parley at +4 that even Magical foes will hear (the Walking Dead still won't); it spends the fight's one parley`
- **Cast line:** "Your tongue changes shape. So does your accent. They lean in."
- **Source:** page 50, Illusion, level 3, row 2 (one spell across two lines of the cell).

### Level-3 alternates
- **Enchant Weapon (Special 3, row 1):** `buff · you · for 50 squares your weapon counts as magic (it touches foes only magic can touch) and you're +2 to hit`. Wiring A (`eff: { toHit: 2, magicWpn: 1 }`) plus one new read of that flag beside `c.magicWpn` in `targetStrikeFaces`. It is weak on a Magic User who rarely swings, but it is the only way for a caster to touch a magic-only foe with a blow.
- **Clone (Illusion 3, row 1):** `defensive · you · a copy of you stands in front: the next three blows aimed at you land on it instead, then it's gone`. This is a ward variant counting blows instead of hit points (a new branch in `applyFoeDamageToPlayer`). It is deliberately **not** a summoned ally, because the user just removed Phantom Host.
- **Throw Voice (Illusion 3, row 3):** `control · every foe · turns to look at a voice that isn't there: each loses its next turn`. Wiring B with a 1-round hold. It is a smaller Stop Time.
- Creatures (Special 3, row 2) is skipped; see Skipped.

---

## Level 4

### Special 4: Enchant Character (primary)
- **School / level / niche:** Special, 4, `buff`.
- **Effect:** for 50 squares: **+2 to hit** with your weapon, **foes −2 to hit you**, and **no critical lands on you**. For example, a level-4 Magic User strikes on 6–8 on a d8, which becomes 4–8. A foe that hits on 4–8 on a d8 now needs 6–8. It covers several fights. Recasting restarts it; it never stacks.
- **Engine:** wiring A, `act: { kind: "enchant", effect: 50, eff: { toHit: 2, foeToHit: -2, critWard: 1 } }`. `toHit`, `foeToHitVs` and `critWardOf` already read those payloads (they are gear and cloak terms), and the breakdowns name them.
- **Combat:** usable anywhere. Casting it before a fight is the point.
- **Draft `txt`:** `buff · you · for 50 squares: +2 to hit, foes −2 to hit you, and no critical lands on you; the enchantment is on you, not on your personality`
- **Cast line:** "You feel more convincing. Your sword agrees. Your personality is unchanged."
- **Source:** page 50, Special, level 4, row 2.

### Illusion 4: Size of the Behemoth (primary)
- **School / level / niche:** Illusion, 4, `control`.
- **Effect:** you look enormous. Each foe rolls its resist. A foe that fails and is **below your level** flees: it is gone, and so are its spoils and experience (canon p. 25's level rule, used here on purpose). Every other foe that fails **cowers for the rest of the fight**: it hits only on its die's top three numbers (6–8 on a d8, 18–20 on a d20) and deals half damage.
- **Engine:** wiring D. The rout uses Insane's flee outcome (`alive = false, fled = true`, no `killFoe`). The cower is Weaken's machinery (`roomWeakenResists`, `C.weakened`, `C.foeToHitPenalty = 3`) with no expiry timer, so it lasts the fight. A later Weaken's own expiry must not clear a live Behemoth; that needs a separate flag or a "fight-long wins" guard.
- **Combat:** combat-only.
- **Draft `txt`:** `control · every foe · you look enormous: foes below your level flee, spoils and all; the rest cower for the fight, hitting only on their die's top three numbers (6–8 on a d8, 18–20 on a d20) for half damage`
- **Cast line:** "You are, briefly and entirely falsely, the size of a barn. Several of them remember appointments elsewhere."
- **Source:** page 50, Illusion, level 4, row 1.

### Level-4 alternates
- **Breathe Foreign Environment (Special 4, row 1):** `utility · you · for 100 squares: water costs one square and never drags on a leap, and trap poison passes you by`. This needs new reads in `moveCost`, the leap's water penalty and `springTrap`'s poison line. It is narrow: the maze has water pools and poison traps but no underwater or gas floors.
- **Death, the Illusion one (Illusion 4, row 2):** its name collides with the Offensive level-5 Death, so it needs a new one (suggested **Illusory Death**, or in the house voice **Death, Allegedly**). `control · one foe · is convinced it has died and lies still until someone hits it (the lie doesn't survive a sword) or the fight ends`. This reuses the SPELL-11 Doze behaviour (asleep, and a hit wakes it) for the whole fight, on one foe. Its value is taking one foe out of a crowd while you deal with the rest.

---

## Level 5

### Special 5: Speed of Sound (primary)
- **School / level / niche:** Special, 5, `buff`.
- **Effect:** for 50 squares: **two blows every time you swing** (the Speed potion's effect) and **you act first in every fight** it covers. Recasting restarts it.
- **Engine:** wiring A, `act: { kind: "haste", effect: 50, eff: { first: 1 } }`. `playerStrike` already reads `haste` (`attacks = max(attacks, 2)`). `first` is one new read in `resolveInitiative`, beside `foreseen` (the same branch that beats Samurai, slow races and the other forced-foe cases).
- **Combat:** usable anywhere. Cast before a fight, it wins the initiative too.
- **Draft `txt`:** `buff · you · for 50 squares: two blows every time you swing, and you act first in every fight; you arrive before the noise you make`
- **Cast line:** "You move so fast your footsteps have to catch up."
- **Source:** page 50, Special, level 5, row 2. It is the only Special level-5 spell; row 1 is blank.

### Illusion 5: Duplicate Foe (primary)
- **School / level / niche:** Illusion, 5, `control`.
- **Effect:** one foe (your target) meets its double and fights it for **d4+1 rounds**. Every swing it takes lands on itself: it rolls its normal to-hit and deals its normal damage, so the harder it hits, the worse for it. It doesn't attack your side meanwhile. It resists on its intelligence. If it dies, you get its spoils and experience.
- **Engine:** wiring C, `f.misdirect = { at: "self", left: d4 + 1 }`. This is the same system as Senseless with the self target.
- **Combat:** combat-only.
- **Draft `txt`:** `control · one foe · meets its double and fights it for d4+1 rounds: every swing it takes lands on itself, at its own damage; it leaves you alone, being busy`
- **Cast line:** "A second {Foe} appears. The first {Foe} finds this unacceptable."
- **Source:** page 50, Illusion, level 5, row 1.

### Level-5 alternates
- **Teleport (Illusion 5, row 2):** two modes, branching on `state.combat` the way Summon already does. **Out of a fight:** you jump 12 squares along the clearest line, the Illusionist's own teleport (`movement.js#teleport` with `bestTeleportDir`; a dot or trap where you land still triggers). **In a fight:** up to d4 foes of your level or lower are sent elsewhere on the floor and leave this fight, spoils and all (a Plane Gate that works on anything). `answer · up to d4 foes of your level or lower · sent somewhere else on the floor, gone from this fight with their spoils; out of a fight, it jumps you 12 squares down the clearest corridor`.
- **Special 5:** page 50 has no second Special level-5 spell. If Speed of Sound is struck, the choices are a variant of it (two actions this round and next, which needs a new extra-action system) or moving a lower Special spell up (for example, Stop Time at level 5 for d4+1 rounds).

---

## 4. Balance notes against existing spells of the same level

These are the existing rows after the SPELL-11 and SPELL-12 reworks.

- **Level 1** (Freeze d6 + level² and a d4 freeze; Weaken on every foe, top three numbers, half damage, d4+1 rounds; Doze on d4 foes; Stun on one foe; Shield 50 hp; Mirror Self; Strength):
  - **Open/Lock** has no fight power. Its value is about one more chest opened per two floors for a caster with no lockpicks. It is below Map the Floor as an emergency tool and far below Freeze in a fight.
  - **Door Illusion** deals no damage. It is an escape that pays nothing (no experience, spoils forfeited). It saves runs, not fights. The cleverest-foe resist keeps it from being automatic against Magical rooms. **Risk:** it makes Magic User runs harder to kill, so the Phase 92 fit should watch caster depth.
  - **Darkness (alternate)** must stay below Weaken: −2 to hit and no crits, with no damage halving.
- **Level 2** (Acid, Stupidity (intelligence 1), Insane, Summon, Turn Walking Dead, Sense Presence):
  - **Senseless** against a lone foe is about a Stun (d4 lost turns); against a group it adds friendly fire. It is steadier than Insane's d6 table and much stronger than the reworked Stupidity (whose value is only its lowered resist).
  - **Fly** is the Cloak of Flying (a 2,200-wilmst item) for one charge. It is a maze tool with no fight power.
  - **Fog (alternate)** as a party-wide top-two cap for d4 rounds prevents less damage than Weaken (two full-damage numbers against three half-damage numbers). That is why its draft adds a free flee; without that clause it should not be level 2.
- **Level 3** (Fireball 2d10+4+level²; Ice area d10 plus a freeze chance; Shrink on d6 foes, half hp and damage for the fight; Blind on one foe; Bubble; Sense Danger):
  - **Stop Time** is an area Stun fixed at 2 rounds, with a resist per foe. It is on par with Ice's area freeze chance and below Shrink's fight-long halving on long fights.
  - **Chameleon Tongue** is a 65% fight-ender at an even level. Its strength depends entirely on PARLEY-01: with full experience and spoils it is the strongest level-3 pick in easy fights, but a failure insults the room and one parley per fight caps it. If it proves too strong, the first dial is dropping the +4 to +2 (fluency 1 plus Magical access).
- **Level 4** (Earthquake 3d10+8+level² to all; Lightning; Fireballs; Noxious Vapor, whose 4 kills the room; Regeneration d8 a round):
  - **Enchant Character** spreads across 50 squares. Per fight it prevents less than Regeneration heals in a long brawl and deals nothing itself. It is close to the Anklet of Invisibility plus the Cloak of Strength worn together, without the cooldowns.
  - **Size of the Behemoth** is a fight-long Weaken plus a rout of chaff (no rewards from the routed foes). It is stronger than Weaken by duration alone, which is what three spell levels buy, and it never kills the room outright the way Noxious Vapor's 4 can.
- **Level 5** (Mangle 2d20+15+level²; Death, which kills one foe for 25 hp; Petrify, which kills one foe with no loot):
  - **Speed of Sound:** a level-5 caster's staff swing is about d8+25. A second swing at about 50% odds adds about 15 damage a round across every fight in 50 squares. Over a four-round fight that is about one Mangle, without Mangle's to-hit roll.
  - **Duplicate Foe:** against a big foe (multi-attack, 15–30 a swing) it is worth 30–100+ damage over d4+1 rounds, and the foe is out of the fight meanwhile. It is below Death (a sure kill) and gentler than Petrify (it keeps the loot), and against weak foes it is plainly worse than both. That is the right spread for a level-5 control.

---

## 5. Skipped from the two columns, and why

- **Creatures (Special 3, row 2):** the natural reading is several summoned creatures. The engine holds one summoned ally (`C.ally`), so this needs a multi-ally system. The level-2 Summon already covers the job, and the user is trimming summons (Lesser Summon and Phantom Host are removed).
- **The "Lock" half of Open/Lock:** the maze has no locked doors or lockable spaces, so it has nothing to do. The name stays because the rulebook prints it that way.
- **Clone as a summoned ally:** it would be Phantom Host again. It is offered only as a decoy ward (level-3 alternate).
- Every other Special and Illusion spell on page 50 is in the slate or listed as an alternate. Page-50 spells from other columns that the rulings note named (Possess, Werebeast, Call Demon) are Divination and out of scope.

---

## 6. Build notes (for the planner, once ruled)

- Each new spell gets an `EVENT_NARRATION` entry for every new event (for example `chestSpellOpened`, `doorIllusionEscaped` / `doorIllusionSeen`, `flightCast`, `foeMisdirected` / `foeHitsItself`, `timeStopped`, `tongueCast` (then the existing `parleyRolled`), `enchantCast`, `behemothCast` with rout and cower counts, `speedCast`, `duplicateCast`), plus a rail twin, a Grimoire entry, a scroll and store presence, and a foe-card chip for the new foe states ("time" hold, misdirected).
- **Joiners:** `allyCast` casts only `ATTACK_SPELL_KINDS` (through `bestAttackSpell`), so a Joiner Magic User whose book rolls one of these spells never casts it. That is harmless but dead weight. See the open questions.
- **Bot (Phase 92):** it needs a rule for Door Illusion (when a fight turns bad) and for the buffs (cast before stepping on an encounter), or it should ignore them. Any gap shows up in the milestone-end readout.
- **Text:** every line above is already in TEXT-01 roll-high form ("+2 to hit", "foes −2 to hit you", "hits only on their die's top three numbers (6–8 on a d8, 18–20 on a d20)", "at least the top five numbers (16–20 on a d20)"). None says "faces" or "squares of".

---

## 7. Open questions for the user

1. **Should Wizards keep the Illusion school?** Today the p. 18 chart gives the Wizard Illusion +0, but p. 17 says Illusion spells are the Illusionist's alone (the Apprentice's "even Illusionist spells" being the exception). If Wizards lose it, Illusion becomes Illusionist-and-Apprentice only, which makes it a real Illusionist identity.
2. **The Illusionist's starting spells.** Canon says "3 illusion spells on top of the beginning roll". Today it gets Mirror Self and Phantom Host, and Phantom Host is going. Proposed: **Mirror Self + Door Illusion** guaranteed, plus one random Illusion spell from the whole list (usable once it levels up).
3. **Is the niche key `utility` OK** for Open/Lock and Fly (a new `NICHE_LABELS` entry)? The alternative is to reuse `answer` or `sight`.
4. **Chameleon Tongue's strength depends on PARLEY-01** (Phase 91). Keep +4 (fluency 2), or ship +2?
5. **Should Joiner Magic Users cast any of these?** The default is no. The candidates would be Stop Time, Senseless and Duplicate Foe, added to the Joiner's cast list.
6. **Should the chart's school bonus apply to the new spells?** p. 18 says the bonus adds to "damage, number effected, additional healing, or additional squares". Today it only helps thrown to-hit, so the Illusionist's +4 Special does nothing for these spells. One option is +10 squares per bonus point on Fly, Enchant Character and Speed of Sound, which gives the Illusionist 70 squares of flight. The default is no.
7. **Swaps.** For each level: keep the primary, or take an alternate. The likeliest swaps are Light (almost free to build, and it could be added as an eleventh spell), Teleport instead of Duplicate Foe, and Enchant Weapon instead of Stop Time.
