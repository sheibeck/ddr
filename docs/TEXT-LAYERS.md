# The two text layers

Phase 95 (FLAVOR-01, FLAVOR-02, FLAVOR-05) built the model; Phase 96 (FLAVOR-03,
FLAVOR-04, FLAVOR-06) reused it unchanged for races, sub-classes, classes,
abilities, special skills and condition chips, and added the recorded review.
"Players see narrative, code sees technical."

## The two layers

**The rules layer** is the exact v2.3 rules text: every content row's `txt`,
`src/browser/viewModels.js#itemStatLines` (the generated stat lines, for example
a weapon's die and to-hit shift or an armour's AR and hp), the identity notes and
footers (`RACE_NOTE`, `SUB_NOTE`, `CLASS_NOTE` and the generated good and bad
lines), `CONDITION_EXPLAIN` and the other chip explain tables, and the existing
rules copy such as `GEAR_COPY.healingDesc` and `COMBAT_MENU_COPY.potionDesc`. All
of it is unchanged and still pinned by the v2.3 truth guards. It sits one tap away
behind a RULES toggle.

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
in the rules layer, one tap away.

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
- `test/unit/rules-layer.test.js` (95-02): the RULES component, the open set,
  Always mode, wrapRow's sibling placement and RULES_COPY's safety.
- `test/unit/rules-surfaces.test.js` (95-05 to 96-12): one rule on every surface,
  Always mode, repaint survival, tolerant load of an old save, and the 2.4.0 notes.
- `test/unit/flavor-sweep.test.js` (96-10, 96-12): paints all 20 description
  surfaces through the real shell code and proves the flavour states no number, no
  rulebook sentence is left outside a RULES body, each RULES body equals the
  unchanged rules text and the toggle contract holds, with Always off and on. A
  surface added to the Surfaces table below without a probe fails by name.
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
- do not restate a rule the toggle hides: a joke that says "doubles" or "for a
  day" is a leak the number test will miss in prose;
- a race or sub-class line conveys at least one tagged good and one tagged bad;
- agree with the rules text: never promise more than the rule delivers (a +1 to
  hit is not "far easier to aim at") and never narrow it (a fixed hp threshold is
  not "hurt already").

## Voice tooling

Each `*_FLAVOR` export and `src/browser/rulesLayer.js#RULES_COPY` is a registered
bank in `tools/lib/voice-corpus.mjs`. `FLAVOR_DOMAINS` is a non-copy row. The
flavour lines are new-line ledger rows (`before` is `""`) in
`docs/narrative-pass/why/y-95-NN.json` (114 lines) and `y-96-NN.json` (122 lines:
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
(236 in all) is reviewed against five checks (voice, family, numberFree,
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

## The RULES surface

The exact rules are one tap away on every surface that shows flavour, or always
shown when the player turns on the Always show the rules setting. The component is
`src/browser/rulesLayer.js`; the surfaces below call it.

### The component

`src/browser/rulesLayer.js` exports `RULES_COPY`, `setAlwaysRules`, `alwaysRules`,
`rulesOpen`, `toggleRulesOpen`, `clearRulesOpen`, `layerText`, `mountRules` and
`wrapRow`. The classic script in `mazeworld.html` reaches it through the frozen
`window.__mzRules` (`mount`, `wrap`, `layer`, `always`, `flavorOf`, `flavorOfItem`,
`flavorOfSpell`, `flavorOfScroll`, `flavorOfChip`).

- A reveal is an inspection, not a decision: a plain `onclick` that flips the DOM in
  place. Never `guardTap`, never a render, never a dispatch.
- Which bodies are open lives in a module-level set keyed by the surface id, never on
  game state, so a repaint keeps a body open and a save never holds it.
- `RULES_COPY` holds the three words the toggle uses: `RULES ▸` (closed), `RULES ▾`
  (open) and `Rules for {name}` (the aria-label).

### The setting

`alwaysRules` is the thirteenth field of the Settings object, default `false`, with a
Settings row after Set dressing (Always show the rules). `applySettings` calls
`setAlwaysRules`, and a change repaints through `window.paint`. With it on, every body
shows open and no toggle is drawn; with it off, bodies start closed and a tapped
one stays open across a repaint.

### The rule every surface follows

- The flavour line plus the slot's functional tags shows first (the cost tag, a
  blocked reason, a live resist hint, the usable-by tag, the stock count, the compare
  line, an ability's state word).
- A RULES body holds exactly the text that slot printed before the phase that
  dressed it, so the v2.3 wording stays reachable and every guard keeps pinning it.
- A row with no flavour, such as an old save's removed item, renders as it did
  before. Nothing throws and nothing is hidden.
- `mountRules` goes under a content block (a card, a list entry). `wrapRow` goes
  beside an action row's button in a `.mw-rules-wrap` grid, never inside the button,
  so a toggle tap can never buy, drop or use.
- A row that opens a sheet (Gear WORN rows and BAG cards) shows flavour only and
  carries no toggle: its rules sit in the sheet, and statically on the row when
  Always is on.
- The Final Sheet is read-only by the HUD-03 ruling: it shows flavour only, and the
  exact text appears (a static body, no button, no handler) only when Always is on.

### Surfaces

| Surface | Renderer | Shows first | Stays visible | RULES (where and what) | Id prefix |
| --- | --- | --- | --- | --- | --- |
| Grimoire | `heroTab.js#renderGrimoire` | niche label, then the spell's flavour | level badge, locked state | `mountRules` under the italic line: the old whole line | `grim:` |
| Combat SPELLS rows | `combatMenu.js` (`withFlavor`), `renderActionArea` | niche label and flavour as `lead` | cost tag, blocked reason (first), live resist hint | `wrapRow` beside the row: the spell's `txt` | `combat:spell:` |
| Combat ITEMS rows (items, potion counter, scroll) | `combatMenu.js`, `renderActionArea` | the item, potion or scroll flavour | state, charges, recharge, reason rows | `wrapRow` beside the row: the item's `txt`, `potionDesc` or the scroll rules | `combat:item:`, `combat:worn:`, `combat:potion`, `combat:scroll` |
| Find card | `mazeworld.html#renderRail` | item name and flavour, then the usable-by tag | compare and fit lines | the rail line's `rules` property, mounted outside the typed lines | `find:` |
| Gear WORN rows | `gearTab.js#gearWornModel`, `renderGearTab` | the worn item's flavour (the weapon type's for a weapon) | the armour row's live wear note, empty rows | opener row: none; static under the flavour when Always is on; the rest in the sheet | `gear:worn:` |
| Gear BAG cards | `gearTab.js#gearBagCardsModel`, `renderGearTab` | flavour plus the usable-by tag | bag meter, state | opener card: none; static when Always is on; the rest in the sheet | `gear:bag:` |
| Gear CONSUMABLES | `gearTab.js#gearConsumablesModel` | potion or scroll flavour | the count, USE or READ button | its own toggle after the description: `healingDesc`, the potion `txt` or the scroll rules and odds | `gear:cons:` |
| Gear sheet | `gearSheet.js` | flavour in the note slot (a jewel or cloak candidate reads its flavour) | the title, the actions, the compare line of a weapon or armour candidate | `mountRules` around the stats: the old note and every stat text | `gsheet:` |
| Store stock rows | `storeScreen.js#storeRowLayer` | flavour plus the usable-by tag | price, stock count, compare line, refusal reason | `wrapRow` beside BUY: the exact old stat line | `store:` |
| Sealed scroll | `storeScreen.js#storeRowLayer` | the scroll flavour | price | `wrapRow` beside BUY: `scrollDesc` plus the reader's odds | `store:` |
| Your gear sell list | `gearTab.js#renderCarriedList` | the item's flavour | the Sell and Drop buttons | a toggle under the italic: the old sub line | `sell-list:` |
| Loot list | `gearTab.js#renderCarriedList` (`opts.adviceFor`) | flavour, then an advice line | the verdict (upgrade, can't use, bag comparison), the usable-by tag, TAKE ALL and LEAVE ALL | a toggle under the lines: the old sub line | `loot-list:` |
| Drop shelf | `mazeworld.html#renderDropShelf` | flavour inside the Drop button | the usable-by tag, the bounded scrolling list | `window.__mzRules.wrap` beside Drop: the old sub line | `drop:` |
| Roller reveal | `roller.js` (`fillRules`) | the sub-class and each non-Human race group: its name, then its flavour line | the name; Human adds no group; an identity with no flavour keeps today's visible footer lines | a RULES button and hidden body per group: exactly `footerLines(kind, key)` (the old note and the generated good and bad lines) | `roller:sub:`, `roller:race:` |
| Hero dossier and trait line | `heroTab.js#renderDossier`, the `#s-trait` line | the Race, Class and Subclass sections: heading, name, then the flavour paragraph; the trait line keeps temperament, motive and phobia | the heading and name; an identity with no flavour keeps today's markup | `mountRules` after the flavour: `[note, ...footerLines]` (class: `CLASS_NOTE`); the race's `RACES[...].note` behind a RULES toggle on the trait line | `doss:race`, `doss:class`, `doss:sub`, `hero:trait` |
| Combat ABILITIES rows and SING | `combatMenu.js` (`abilityRows`, SING row, `withFlavor`), `renderActionArea` | the ability's flavour as the row's description | the Phase 94 state word (READY, READY IN N, SPENT THIS FIGHT, the gate reasons), its colour and edge, the row's id and `data-state` | `wrapRow` beside the row: the ability's `txt` (SING: `COMBAT_MENU_COPY.singDesc`) | `combat:ability:<key>`, `combat:ability:sing` |
| Hero abilities and skills | `heroTab.js#renderAbilityRows` and the special-skills list | the ability's or skill's flavour in the italic (a bought active skill reads its own skill line) | the state span; a row with no flavour keeps today's markup | `mountRules` after the state: the exact `txt` (a skill at level two: `txt2`) | `hero:ability:`, `hero:skill:` |
| Final Sheet tricks | `finalSheet.js` (tricks, worn and bag sections) | the flavour in the note: each trick, each worn item and each bag item with a flavour line | the names; the armour row's wear note; an empty slot's empty line; an item with no flavour keeps today's note | none (read-only by the HUD-03 ruling); a static body, no button, only when Always is on | `final:trick:`, `final:worn:`, `final:bag:` |
| Chip tap cards | `rail.js` (`railLineCard`, `conditionCard`), `mazeworld.html#chipFlavorSpec`, `paintConditions`, `renderYourLot`, `heroTab.js` (the Company panel) | the chip's flavour as the card's first line (HUD strip, combat condition card, YOUR LOT hero and Joiner, Company panel) | the title and icon; a chip with no flavour keeps today's card | the rail line's `rules` property: the whole old tap text (`conditionTapText`) behind the shared RULES toggle; a tap never dismisses, acts or changes state | `chip:` |
| UP YOUR SLEEVE card | `rail.js#abilityPoolFlavor`, `mazeworld.html#surfaceAbilityPool` | "New trick: name - flavour" for the ability the pool card picks | the first-paint card itself; a Magic User, a table-only list or an unknown id keeps today's card | the rail line's `rules` property: the old whole line (`New trick: name - txt`) | `pool:` |

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

### What Phase 96 did

- `layerText` and `mountRules` for the Hero dossier blurbs and footers: the blurb is
  the flavour, the footer is the rules (96-05).
- `wrapRow` for the combat ABILITIES rows and SING, beside the button, exactly as the
  SPELLS rows do (96-06).
- The rail line's `rules` property for the chip tap card and the UP YOUR SLEEVE card
  (96-07).
- The same Always show the rules switch; no new setting was needed.
- Two surfaces the 96-10 sweep found still printing rulebook sentences, the Hero
  special-skills list for a bought active skill and the Final Sheet's worn and bag
  notes, were dressed in the 96-12 gap plan.
