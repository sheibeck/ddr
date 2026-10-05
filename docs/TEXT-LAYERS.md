# The two text layers

Phase 95 (FLAVOR-01, FLAVOR-02, FLAVOR-05) built the model; Phase 96 (FLAVOR-03,
FLAVOR-04, FLAVOR-06) reused it unchanged for races, sub-classes, classes,
abilities, special skills and condition chips, and added the recorded review.
"Players see narrative, code sees technical." Phase 97.1 (FLAVOR-07) then retired
the RULES control, so players see only the flavour line.

## The two layers

**The rules layer** is the exact v2.3 rules text: every content row's `txt`,
`src/browser/viewModels.js#itemStatLines` (the generated stat lines, for example
a weapon's die and to-hit shift or an armour's AR and hp), the identity notes and
footers (`RACE_NOTE`, `SUB_NOTE`, `CLASS_NOTE` and the generated good and bad
lines), `CONDITION_EXPLAIN` and the other chip explain tables, and the existing
rules copy such as `GEAR_COPY.healingDesc` and `COMBAT_MENU_COPY.potionDesc`. All
of it is unchanged and still pinned by the v2.3 truth guards. It is code-only: the
guards read it, the view models still carry it as `rules`, and no screen shows it.

**The player layer** is one short flavour line per entry: the fourteen `*_FLAVOR`
maps (eight from Phase 95, six from Phase 96), read through
`src/browser/flavorText.js`. It shows first, on every surface that shows an item,
spell, scroll, race, sub-class, class, ability, special skill or condition chip.

## Why keyed maps, never a field on the row

Treasure and bag rows are spread onto rolled items: `rollJewel`, `rollCloak` and
`rollStaff` in `engine/items.js`, `bagItemFor`, `engine/character.js`, and the
find and loot paths in `engine/encounters.js`. A `flavor` field on a row would be
copied onto every rolled item and serialized into every save. So the flavour is
a separate frozen map per content file, keyed by the same name the content
already uses, and the shell looks the line up by name at draw time.

Consequences: saves are untouched (no save version bump, no migration); an old
save's items get flavour the moment the maps exist, because the lookup is by
name; an item the lookup cannot resolve reads `""` and the surface shows its
rules text exactly as it does today. `test/roundtrip/flavor-lines-not-serialized.test.js`
walks a serialized run and fails if any flavour line, record or tag leaked into it.

## Domains

| id | export | module | key | count |
| --- | --- | --- | --- | --- |
| spell | SPELL_FLAVOR | content/spells.js | spell name (`SPELLS[].n`) | 41 |
| scroll | SCROLL_FLAVOR | content/spells.js | "Scroll" (one shared line) | 1 |
| potion | POTION_FLAVOR | content/potions.js | potion name (`POTIONS[].n`) | 10 |
| tool | TOOL_FLAVOR | content/tools.js | Torch, Rope, Ladder, Lockpicks | 4 |
| bag | BAG_FLAVOR | content/bags.js | bag name (`BAG_ITEMS[tier].n`) | 3 |
| magic | MAGIC_ITEM_FLAVOR | content/treasure-tables.js | jewel, cloak or staff name | 23 |
| weapon | WEAPON_FLAVOR | content/weapons.js | weapon type (`WEAPONS` key) | 24 |
| armor | ARMOR_FLAVOR | content/armors.js | armour type (`ARMORS[].name`) | 5 |
| race | RACE_FLAVOR | content/flavor.js | race name (`RACES` keys) | 6 |
| sub | SUB_FLAVOR | content/flavor.js | sub-class name (the subs of `CLASSES`) | 24 |
| class | CLASS_FLAVOR | content/flavor.js | class name (Magic User, Fighter, Thief) | 3 |
| ability | ABILITY_FLAVOR | content/abilities.js | ability name (the 20 `ABILITIES` plus Sing) | 21 |
| skill | SKILL_FLAVOR | content/skills.js | special skill name (10 passive plus 11 active, each with its own line) | 21 |
| chip | CHIP_FLAVOR | content/flavor.js | `HERO_CONDITIONS` key (42) plus 5 variant keys (`CHIP_FLAVOR_VARIANTS`) | 47 |

Total: 233 keys over 14 domains. Weapons and armour get one line per type, so a
premium blade ("Whisper, a long sword") and a warded armour ("Warded plate") share
their type's line and must not imply a bonus. A special skill and its twin ability
(Kata the skill, Kata the ability) each read their own line, worded apart so one
sheet never repeats a sentence; the passive skills were dressed in 96-03 and the
eleven active skills in the 96-12 gap plan. The five chip variants give a chip
whose meaning differs by kind its own line: `foeEffect/dazed`, `foeEffect/weakened`,
`heroOut/stopped`, `ward/mirror` and `haste/Speed of Sound`. An ability chip reads
the ability's own line, not a chip line.

## The identity record

The race, sub and class domains hold identity records, not bare strings:

```
RACE_FLAVOR["Troll"] = { line, good: [id, ...], bad: [id, ...], neutral?: id }
```

`line` is the player-facing text. `good` and `bad` are tags: ids that name entries
of `identityEntries(domain, key)` (`src/browser/identityFooter.js`), the structured
good and bad clauses the generated footers are joined from. The record's `lines()`
adapter (`identityDomain` in `flavorText.js`) builds a fresh plain `{ key: line }`
map, so every shared scan (coverage, shape, uniqueness, safety, number) runs
unchanged over a record domain. The tags are read with `flavorTagsOf(domain, key)`.

The tag rule, guarded live by `test/unit/identity-flavor.test.js`: every tag is a
real `identityEntries` id of the right side, no id is tagged twice, and a race or
sub-class has at least one `good` and one `bad` tag. The one exception is Human,
who carries `neutral` instead (the tagged-neutral yardstick; no good, no bad). The
review's `goodBad` check reads the tags: a line must convey at least one tagged
good and one tagged bad in words a player can act on, so a blurb is a joke that
still informs.

The per-domain shape rule (`test/unit/flavor-layer.test.js`):

- race, sub and class: one or two sentences, at most 200 characters (UTF-16 code
  units), NFC-normalised, no astral characters;
- every other domain: one sentence, at most 100 characters.

Every domain is number-free by the same check, identity lines included: no digit,
percent sign, die or number word ("one" alone is allowed, so "no one" stays legal);
the identity rule relaxes only the sentence count and the length. The numbers stay
in the rules layer, which no screen shows.

## The lookup

`flavorKeyOf(item)` returns `{ domain, key }` or `null`. It mirrors
`engine/derived.js#canonItemText`: a potion by its `eff2` (the store's "X potion"
and a find's "X potion (colour)" share one row), a jewel, cloak or staff by name,
a tool by its tool key (else its name), lockpicks as "Lockpicks", a bag by tier
(else name), a weapon by `base` (else name), an armour by `armor` (else name).
Anything else (a food line, an unknown kind, an array, a string) is `null`. It
never throws and never mutates its argument.

`flavorOf(domain, key)`, `flavorOfItem(item)`, `flavorOfSpell(name)` and
`flavorOfScroll()` return the line, or `""` when the map is absent, the key is
unknown or the value is empty. Phase 96 added `flavorOfIdentity(domain, key)` (the
record's `line`), `flavorTagsOf(domain, key)`, `flavorOfAbility(name)`,
`flavorOfSkill(name)` and `flavorOfChip(descriptor)`, which takes a condition
descriptor (`key`, and where it matters `kind`, `ability`, `source`, `mirror`),
picks the variant key when one applies and reads `""` for a malformed or hostile
descriptor. `everyFlavorLine()` lists every `[domain, key, line]` for the scans.

## Guards

- `test/unit/flavor-text.test.js`: the domain shape (14 domains, 233 keys), key
  resolution for every item shape, the identity adapters and the never-throws and
  `""` contracts.
- `test/unit/flavor-layer.test.js`: per domain, every content key has a
  non-empty line and there is no orphan key; no line states a digit, a percent
  sign, a die or a number word (bar "one"); the shape rule above; no two lines equal; no line
  equals its rules text; no spell line starts with its niche label. Table-driven
  over `FLAVOR_DOMAINS`. A domain whose map is missing fails by name (all 14
  domains, 233 entries).
- `test/unit/identity-flavor.test.js` (96-01, 96-02): the tag guard with teeth, over
  every race and sub-class.
- `test/unit/chip-flavor.test.js` (96-04): every `HERO_CONDITIONS` key and every
  variant key has a line, and each variant reads where it should.
- `test/unit/rules-surfaces.test.js` (95-05 to 97.1-03): flavour on every surface,
  no rules control or body, the exact text still on the model, a row with no
  flavour keeps today's text, and the 2.4.0 notes.
- `test/unit/flavor-sweep.test.js` (96-10 to 97.1-03): paints all 20 description
  surfaces through the real shell code and proves the flavour states no number, no
  rules sentence is visible, and no rules body or control exists (S1 to S4). A
  surface added to the Surfaces table below without a probe fails by name.
- `test/unit/flavour-only.test.js` (97.1-04): the retired machinery and the Always
  setting stay out of the shipped source, the docs make no promise of either, and
  the exact rules data stays in code.
- `test/unit/flavor-drift.test.js`: the fail-first proof. In a temp mirror of the
  tree one number is drifted and the real guard file must exit non-zero naming the
  expected failing test. Five mutations: Heal's "d10 hp" to "d12 hp"
  (`spell-skill-text-engine`), the Ring of Power's "fifty squares" to "sixty"
  (`item-text-engine`), the Gauntlet of the Giant's chip sentence "+6 damage" to
  "+7" in `CONDITION_EXPLAIN` (`authored-ranges`), Kata's "+3 to hit on this
  strike" to "+4" (`spell-skill-text-engine`) and the Troll's "+11 damage per
  swing" to "+12" in `RACE_NOTE` (`identity-text`).
- `test/roundtrip/flavor-not-serialized.test.js` (95): every item shape the engine
  builds resolves to a key of its domain, and a serialized run holding them has no
  `flavor` field.
- `test/roundtrip/flavor-lines-not-serialized.test.js` (96-01): the domain-agnostic
  version: no flavour line or record from any of the 14 domains is in a serialized run.
- `test/unit/flavor-review.test.js` (96-08, 96-11) and
  `test/unit/flavor-review-closed.test.js` (96-11): the review mechanism and the
  standing proof that the review is closed. See "The review" below.

The 18 v2.3 truth-guard files are never edited by Phases 95 and 96:
`item-text-engine`, `item-text-wording`, `item-text-refresh`, `item-audit`,
`item-audit-fixes`, `spell-audit`, `spell-skill-text-engine`,
`spell-skill-text-wording`, `spell-skill-audit-fixes`, `skill-audit`,
`authored-ranges`, `value-identity`, `value-text`, `value-abilities`,
`value-ledger`, `value-cleanup`, `identity-text` and `identity-audit`, all under
`test/unit/`; nor are the identity and ability pins (`identity-footer`,
`identity-contract`, `ability-state-copy`, `abilities-catalog`). Nor are the five
audit docs, whose row counts are pinned: 121 (`docs/ITEM-AUDIT.md`), 112
(`docs/SPELL-AUDIT.md`), 32 (`docs/SKILL-AUDIT.md`), 168 (`docs/IDENTITY-AUDIT.md`)
and 100 (`docs/VALUE-LEDGER.md`).

## Tone

One sentence, about 90 characters or fewer (the guard allows 100); an identity
blurb may run to two sentences and 200 characters because it has to say what the
race or sub-class is good and bad at. The house voice: sarcastic, deadpan,
family-friendly. It hints at what the thing does in words and never states a
number. The accepted example, Heal: "Closes wounds the polite way: quickly, and
without asking how you got them."

The writer's checklist, per line:

- one sentence, at most 90 characters (an identity blurb: two sentences, at most 200);
- hints at the effect in words ("closes wounds", "everything goes quiet"), never
  an amount, duration, die, percentage or count (no "twice", "half", "once",
  "fifty", and no "a few rounds" either: a unit with a vague count is a duration in
  disguise);
- deadpan and family-friendly; passes `content/safety-wordlist.js`;
- house spelling "armour"; U+2013 and U+2212 only where a range or minus is needed;
- different for every entry (a test checks);
- the Death potion still reads as deadly;
- do not open with the niche label;
- keep a spell's flavour distinguishable from its same-level sibling (Doze vs
  Stun, Fireball vs Fireballs vs Lightning), so a player can still choose at a
  glance;
- do not restate a rule the line leaves out: a joke that says "doubles" or "for a
  day" is a leak the number test will miss in prose;
- a race or sub-class line conveys at least one tagged good and one tagged bad;
- agree with the rules text: never promise more than the rule delivers (a +1 to
  hit is not "far easier to aim at") and never narrow it (a fixed hp threshold is
  not "hurt already").

## Voice tooling

Each `*_FLAVOR` export is a registered bank in `tools/lib/voice-corpus.mjs`. The
three toggle words Phase 95 registered were retired with the control and erased
from the ledger and the verdicts in Phase 97.1. `FLAVOR_DOMAINS` is a non-copy row. The
flavour lines are new-line ledger rows (`before` is `""`) in
`docs/narrative-pass/why/y-95-NN.json` (111 lines) and `y-96-NN.json` (122 lines:
`y-96-01` to `y-96-04` hold 111, `y-96-12` holds the 11 active-skill lines), the
`y-` prefix keeping them in plan order after `x-94-04`. A line the review sent
back is a chained rewrite row (`before` is the previous `after`) in `y-96-09`
(fourteen, after round 1) and `y-96-12b` (three, after round 2). The standing
scans (`test/voice/safety-scan.test.js`, `test/unit/hp-not-wp.test.js`) walk the
layer through `everyFlavorLine()`. After any ledger lands, run
`node tools/narrative-review.mjs` and commit the regenerated pages in the same
commit. The user reviews every line on `docs/narrative-pass/review.html`, which
shows each text with its recorded verdict.

## The review (FLAVOR-06)

Phase 79 judged lines once and kept no record. Every Phase 95 and 96 flavour line
(233 in all) is reviewed against five checks (voice, family, numberFree,
consistent, goodBad), in verdict files under `docs/narrative-pass/verdicts/` tied to
the exact wording each verdict judged. The method, the file format, the round rules,
the commands and the independence boundary are in `docs/narrative-pass/README.md`
(section "The Phase 96 review (FLAVOR-06)"). The review is closed when every line's
latest verdict is a pass at its current wording; `node tools/flavor-review.mjs
--closed` and `test/unit/flavor-review-closed.test.js` keep that true, so a line
reworded after its verdict fails by key.

## Adding a domain

1. Append a record to `FLAVOR_DOMAINS` in `src/browser/flavorText.js`: `id`,
   `module`, `exportName`, `keys()` and `lines()` (an identity domain is built with
   `identityDomain`, which adds `tags()`).
2. Export the frozen keyed map from the content file (the name must be unique
   across content files and never redeclared in `mazeworld.html`).
3. Register the bank in `tools/lib/voice-corpus.mjs` and ledger the lines.
4. Choose the shape rule: one sentence and 100 characters, or the identity rule
   (two sentences, 200 characters). Phase 96 kept every domain number-free, so no
   per-domain number allowance was needed; the other checks (coverage, no orphan,
   shape, uniqueness) need no new code.
5. Leave `txt`, `ABILITY_BY_ID[...].txt`, the identity footers and
   `CONDITION_EXPLAIN` untouched so their guards keep pinning them.
6. Add the surface to the Surfaces table below and a probe to
   `test/unit/flavor-sweep.test.js`; the coverage test fails until both exist.
7. Review the new lines: a verdict file (or, for a line added after the last
   recorded round-1 file, a first verdict in a later round declared through
   `POST_ROUND1_PLANS` in `tools/lib/flavor-review.mjs`).

## Flavour only (Phase 97.1)

The RULES control and the always-show-the-rules setting were retired (user ruling
2026-10-04, "Remove rules entirely"). Every surface shows the flavour line, a row
with no flavour line keeps today's text, and the exact rules text stays in code
(the content tables, `RACE_NOTE`, `SUB_NOTE`, `CLASS_NOTE`, the identity footers,
`CONDITION_EXPLAIN`, the view models' `rules` fields) for the guards.

### The rule every surface follows

- The flavour line plus the slot's functional tags shows first (the cost tag, a
  blocked reason, a live resist hint, the usable-by tag, the stock count, the compare
  line, an ability's state word).
- A row with no flavour, such as an old save's removed item, renders as it did
  before. Nothing throws and nothing is hidden.
- A worn row or a bag card opens the Gear sheet; it shows flavour only.
- The Final Sheet is read-only by the HUD-03 ruling: it shows flavour only.
- The Gear sheet shows the flavour line in its note slot and then the item's numeric
  stat rows (AR, wear, damage, to-hit, crit, charges, usable-by: every
  `itemStatLines` row except the effect row) as plain rows, with no control. The old
  note sentence that used to head the hidden body, such as a weapon's voice line, and
  the effect row, which is the item's own `txt` sentence, are not drawn, so a
  jewel's sheet is its flavour line and its actions.

### Surfaces

| Surface | Renderer | Shows | Stays visible | Not shown (the rules text kept in code) |
| --- | --- | --- | --- | --- |
| Grimoire | `heroTab.js#renderGrimoire` | niche label, then the spell's flavour | level badge, locked state | the old whole line |
| Combat SPELLS rows | `combatMenu.js` (`withFlavor`), `renderActionArea` | niche label and flavour as `lead` | cost tag, blocked reason (first), live resist hint | the spell's `txt` |
| Combat ITEMS rows (items, potion counter, scroll) | `combatMenu.js`, `renderActionArea` | the item, potion or scroll flavour | state, charges, recharge, reason rows | the item's `txt`, `potionDesc` or the scroll rules |
| Find card | `mazeworld.html#renderRail` | item name and flavour, then the usable-by tag | compare and fit lines | the rail line's `rules` property |
| Gear WORN rows | `gearTab.js#gearWornModel`, `renderGearTab` | the worn item's flavour (the weapon type's for a weapon) | the armour row's live wear note, empty rows | the rest of the old text; the numeric stat rows are on the Gear sheet the row opens |
| Gear BAG cards | `gearTab.js#gearBagCardsModel`, `renderGearTab` | flavour plus the usable-by tag | bag meter, state | the rest of the old text; the numeric stat rows are on the Gear sheet the card opens |
| Gear CONSUMABLES | `gearTab.js#gearConsumablesModel` | potion or scroll flavour | the count, USE or READ button | `healingDesc`, the potion `txt` or the scroll rules and odds |
| Gear sheet | `gearSheet.js` | flavour in the note slot (a jewel or cloak candidate reads its flavour), then the item's numeric stat rows as plain rows | the title, the actions, the compare line of a weapon or armour candidate | the old note sentence that headed the stats, such as a weapon's voice line, and the effect row, which is the item's own `txt` sentence |
| Store stock rows | `storeScreen.js#storeRowLayer` | flavour plus the usable-by tag | price, stock count, compare line, refusal reason | the exact old stat line |
| Sealed scroll | `storeScreen.js#storeRowLayer` | the scroll flavour | price | `scrollDesc` plus the reader's odds |
| Your gear sell list | `gearTab.js#renderCarriedList` | the item's flavour | the Sell and Drop buttons | the old sub line |
| Loot list | `gearTab.js#renderCarriedList` (`opts.adviceFor`) | flavour, then an advice line | the verdict (upgrade, can't use, bag comparison), the usable-by tag, TAKE ALL and LEAVE ALL | the old sub line |
| Drop shelf | `mazeworld.html#renderDropShelf` | flavour inside the Drop button | the usable-by tag, the bounded scrolling list | the old sub line |
| Roller reveal | `roller.js` | the sub-class and each non-Human race group: its name, then its flavour line | the name; Human adds no group; an identity with no flavour keeps today's visible footer lines | exactly `footerLines(kind, key)` (the old note and the generated good and bad lines) |
| Hero dossier and trait line | `heroTab.js#renderDossier`, the `#s-trait` line | the Race, Class and Subclass sections: heading, name, then the flavour paragraph; the trait line keeps temperament, motive and phobia | the heading and name; an identity with no flavour keeps today's markup | `[note, ...footerLines]` (class: `CLASS_NOTE`) and the race's `RACES[...].note` |
| Combat ABILITIES rows and SING | `combatMenu.js` (`abilityRows`, SING row, `withFlavor`), `renderActionArea` | the ability's flavour as the row's description | the Phase 94 state word (READY, READY IN N, SPENT THIS FIGHT, the gate reasons), its colour and edge, the row's id and `data-state` | the ability's `txt` (SING: `COMBAT_MENU_COPY.singDesc`) |
| Hero abilities and skills | `heroTab.js#renderAbilityRows` and the special-skills list | the ability's or skill's flavour in the italic (a bought active skill reads its own skill line) | the state span; a row with no flavour keeps today's markup | the exact `txt` (a skill at level two: `txt2`) |
| Final Sheet tricks | `finalSheet.js` (tricks, worn and bag sections) | the flavour in the note: each trick, each worn item and each bag item with a flavour line | the names; the armour row's wear note; an empty slot's empty line; an item with no flavour keeps today's note | the exact text (read-only by the HUD-03 ruling) |
| Chip tap cards | `rail.js` (`railLineCard`, `conditionCard`), `mazeworld.html#chipFlavorSpec`, `paintConditions`, `renderYourLot`, `heroTab.js` (the Company panel) | the chip's flavour as the card's first line (HUD strip, combat condition card, YOUR LOT hero and Joiner, Company panel) | the title and icon; a chip with no flavour keeps today's card | the rail line's `rules` property: the whole old tap text (`conditionTapText`) |
| UP YOUR SLEEVE card | `rail.js#abilityPoolFlavor`, `mazeworld.html#surfaceAbilityPool` | "New trick: name - flavour" for the ability the pool card picks | the first-paint card itself; a Magic User, a table-only list or an unknown id keeps today's card | the rail line's `rules` property: the old whole line (`New trick: name - txt`) |

### Deliberately plain

These keep their text with no flavour layer:

- The Phase 94 ability state labels and gate reasons (READY, READY IN N, SPENT THIS
  FIGHT and the four reasons), and the FLEE and PARLEY rows: they are functional.
  Ability rows themselves are dressed now; only their state words stay plain.
- The not-wielded and not-equipped reason rows: a reason is a rule, not a
  description.
- Food, rations and repair store rows: they have no description to dress.
- The Gear kit rows and the armour WORN row's wear note: live state, not prose.
- All narration: the Oracle, the rail and the fight log.

### What Phases 95 to 97.1 did

Phase 95 built the layer: the flavour maps and a shared reveal component that put the
exact rules text one tap behind every flavour line, with a Settings switch to show it
always. Phase 96 reused that component for races, sub-classes, classes, abilities,
special skills and condition chips, and closed the recorded review. Phase 97.1 retired
the control and the switch and kept the data: the rules text lives on in the content
tables, the view models' `rules` fields and the guards, and no screen draws it.
