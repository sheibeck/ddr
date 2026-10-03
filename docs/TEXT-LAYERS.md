# The two text layers

Phase 95 (FLAVOR-01, FLAVOR-02, FLAVOR-05). "Players see narrative, code sees
technical." This is the model Phase 96 (races, sub-classes, abilities, chips)
reuses unchanged.

## The two layers

**The rules layer** is the exact v2.3 rules text: every content row's `txt`,
`src/browser/viewModels.js#itemStatLines` (the generated stat lines, for example
a weapon's die and to-hit shift or an armour's AR and hp), and the existing rules
copy such as `GEAR_COPY.healingDesc` and `COMBAT_MENU_COPY.potionDesc`. All of it
is unchanged and still pinned by the v2.3 truth guards. It sits one tap away
behind a RULES toggle.

**The player layer** is one short flavour line per entry: the eight `*_FLAVOR`
maps, read through `src/browser/flavorText.js`. It shows first, on every surface
that shows an item, spell or scroll description.

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
rules text exactly as it does today.

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

Total: 111 keys. Weapons and armour get one line per type, so a premium blade
("Whisper, a long sword") and a warded armour ("Warded plate") share their type's
line and must not imply a bonus. Special skills (`content/skills.js`) are not a
domain in this phase.

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
unknown or the value is empty. `everyFlavorLine()` lists every
`[domain, key, line]` for the scans.

## Guards

- `test/unit/flavor-text.test.js`: the domain shape (8 domains, 111 keys), key
  resolution for every item shape, the never-throws and `""` contracts.
- `test/unit/flavor-layer.test.js`: per domain, every content key has a
  non-empty line and there is no orphan key; no line states a digit, a percent
  sign, a die or a number word (except "one"); one sentence of at most 100
  characters; no two lines equal; no line equals its rules text; no spell line
  starts with its niche label. Table-driven over `FLAVOR_DOMAINS`. Since 95-08 a
  domain whose map is missing fails by name (all 8 domains, 111 entries).
- `test/unit/rules-layer.test.js` (95-02): the RULES component, the open set,
  Always mode, wrapRow's sibling placement and RULES_COPY's safety.
- `test/unit/rules-surfaces.test.js` (95-05 to 95-08): one rule on every surface,
  Always mode, repaint survival, tolerant load of an old save, and the 2.4.0 notes.
- `test/unit/flavor-drift.test.js`: the fail-first proof. In a temp mirror of the
  tree, Heal's "d10 hp" becomes "d12 hp" and the Ring of Power's "fifty squares"
  becomes "sixty squares"; the real guard files (`spell-skill-text-engine`,
  `item-text-engine`) must exit non-zero naming the expected failing test.
- `test/roundtrip/flavor-not-serialized.test.js`: every item shape the engine
  builds resolves to a key of its domain, and a serialized run holding them has no
  `flavor` field. A failure here means a flavour key leaked onto an item.

The 18 v2.3 truth-guard files are never edited by this phase:
`item-text-engine`, `item-text-wording`, `item-text-refresh`, `item-audit`,
`item-audit-fixes`, `spell-audit`, `spell-skill-text-engine`,
`spell-skill-text-wording`, `spell-skill-audit-fixes`, `skill-audit`,
`authored-ranges`, `value-identity`, `value-text`, `value-abilities`,
`value-ledger`, `value-cleanup`, `identity-text` and `identity-audit`, all under
`test/unit/`. Nor are the five audit docs, whose row counts are pinned: 121
(`docs/ITEM-AUDIT.md`), 112 (`docs/SPELL-AUDIT.md`), 32 (`docs/SKILL-AUDIT.md`),
168 (`docs/IDENTITY-AUDIT.md`) and 100 (`docs/VALUE-LEDGER.md`).

## Tone

One sentence, about 90 characters or fewer (the guard allows 100). The house
voice: sarcastic, deadpan, family-friendly. It hints at what the thing does in
words and never states a number. The accepted example, Heal: "Closes wounds the
polite way: quickly, and without asking how you got them."

The writer's checklist, per line:

- one sentence, at most 90 characters;
- hints at the effect in words ("closes wounds", "everything goes quiet"), never
  an amount, duration, die, percentage or count (no "twice", "half", "once",
  "fifty");
- deadpan and family-friendly; passes `content/safety-wordlist.js`;
- house spelling "armour"; U+2013 and U+2212 only where a range or minus is needed;
- different for every entry (a test checks);
- the Death potion still reads as deadly;
- do not open with the niche label;
- keep a spell's flavour distinguishable from its same-level sibling (Doze vs
  Stun, Fireball vs Fireballs vs Lightning), so a player can still choose at a
  glance;
- do not restate a rule the toggle hides: a joke that says "doubles" or "for a
  day" is a leak the number test will miss in prose.

## Voice tooling

Each `*_FLAVOR` export and `src/browser/rulesLayer.js#RULES_COPY` is a registered
bank in `tools/lib/voice-corpus.mjs` (pre-registered by 95-01; absent until its
batch lands, never a crash). `FLAVOR_DOMAINS` is a non-copy row. The flavour
lines are new-line ledger rows (`before` is `""`) in
`docs/narrative-pass/why/y-95-NN.json`, the `y-` prefix keeping them in plan order
after `x-94-04`. The standing scans (`test/voice/safety-scan.test.js`,
`test/unit/hp-not-wp.test.js`) walk the layer through `everyFlavorLine()`. After
any ledger lands, run `node tools/narrative-review.mjs` and commit the regenerated
pages in the same commit. The user reviews every line on
`docs/narrative-pass/review.html`.

## Adding a domain (Phase 96)

1. Append a record to `FLAVOR_DOMAINS` in `src/browser/flavorText.js`: `id`,
   `module`, `exportName`, `keys()` and `lines()`.
2. Export the frozen keyed map from the content file (the name must be unique
   across content files and never redeclared in `mazeworld.html`).
3. Register the bank in `tools/lib/voice-corpus.mjs` and ledger the lines.
4. If the identity blurbs must keep a number word to convey good and bad, set a
   per-domain number rule in `test/unit/flavor-layer.test.js`; the other checks
   (coverage, no orphan, shape, uniqueness) need no new code.
5. Leave `txt`, `ABILITY_BY_ID[...].txt`, the identity footers and
   `CONDITION_EXPLAIN` untouched so their guards keep pinning them.

## The RULES surface

The exact rules are one tap away on every surface that shows flavour, or always
shown when the player turns on the Always show the rules setting. The component is
`src/browser/rulesLayer.js`; the surfaces below call it.

### The component

`src/browser/rulesLayer.js` exports `RULES_COPY`, `setAlwaysRules`, `alwaysRules`,
`rulesOpen`, `toggleRulesOpen`, `clearRulesOpen`, `layerText`, `mountRules` and
`wrapRow`. The classic script in `mazeworld.html` reaches it through the frozen
`window.__mzRules` (`mount`, `wrap`, `layer`, `always`, `flavorOf`, `flavorOfItem`,
`flavorOfSpell`, `flavorOfScroll`).

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
  line).
- A RULES body holds exactly the text that slot printed before Phase 95, so the
  v2.3 wording stays reachable and every guard keeps pinning it.
- A row with no flavour, such as an old save's removed item, renders as it did
  before. Nothing throws and nothing is hidden.
- `mountRules` goes under a content block (a card, a list entry). `wrapRow` goes
  beside an action row's button in a `.mw-rules-wrap` grid, never inside the button,
  so a toggle tap can never buy, drop or use.
- A row that opens a sheet (Gear WORN rows and BAG cards) shows flavour only and
  carries no toggle: its rules sit in the sheet, and statically on the row when
  Always is on.

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

### Deliberately plain

These keep their text with no flavour layer:

- Ability, SING, FLEE and PARLEY rows: abilities are Phase 96's (the combat
  ABILITIES rows adopt `wrapRow` then), and the others are functional.
- The not-wielded and not-equipped reason rows: a reason is a rule, not a
  description.
- Food, rations and repair store rows: they have no description to dress.
- The Gear kit rows and the armour WORN row's wear note: live state, not prose.
- All narration: the Oracle, the rail and the fight log.

### Reuse in Phase 96

- `layerText` and `mountRules` for the Hero dossier blurbs and footers: the blurb is
  the flavour, the footer is the rules.
- `wrapRow` for the combat ABILITIES rows, beside the button, exactly as the SPELLS
  rows do.
- The rail line's `rules` property for the chip tap card.
- The same Always show the rules switch; no new setting is needed.
