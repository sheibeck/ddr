# Phase 95: Fantasy Flavour I: The Text Layer, Spells, Scrolls & Items - Research

**Researched:** 2026-10-03
**Domain:** Player-facing text layering in a vanilla-JS / Capacitor game (content tables, shell renderers, voice tooling, truth guards). No external libraries.
**Confidence:** HIGH on the code facts (read in this session, with file:line), MEDIUM on UI layout recommendations (Claude's-discretion areas, to be checked on device).

Provenance tags used below: `[VERIFIED: codebase]` = read or grepped in `C:\projects\mazeworld` this session; `[VERIFIED: prototype]` = reproduced in a throwaway `git archive` copy in the scratchpad (no source edit in the project); `[ASSUMED]` = recommendation or judgement the planner or user should confirm (collected in the Assumptions Log).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Where the exact numbers live in game (user, 2026-10-03)**
- **A tap-to-reveal RULES line under the flavour** on every surface that shows an item, spell or scroll description: the Gear sheet, store, loot and find cards, the grimoire (spell list), and the combat SPELLS and ITEMS menu rows. Flavour shows first. One tap reveals the exact rules text (the technical layer).
- **A Settings switch, "Always show the rules", default OFF.** When on, every RULES line is shown expanded. The per-card tap still works when it's off. The switch persists like the other Preferences-backed settings.
- **Combat menu rows show the flavour plus the row's existing short functional tag** (e.g. "d10 hp", charges, cooldown). The full rules line sits behind the tap. These tags are functional, like the Phase 94 labels, and stay plain.

**Data shape and guards (user, 2026-10-03)**
- **`txt` stays the exact rules text (the technical layer), and a new `flavor` field beside it carries the player line.** Every v2.3 guard (item-text-engine, authored-ranges, spell-audit, skill-audit, value-identity, identity tests) keeps pinning `txt` unchanged, so no guard is lost and the audit tables keep their row counts. Phase 96 reuses the same shape.
- **Three new tests prove it:**
  - every entry in scope with a `txt` (or a generated stat line) has a non-empty `flavor`;
  - no flavour line states a number, a die (dN) or a percentage, so rules can't creep back into the player layer;
  - a deliberately drifted number in a `txt` still fails its guard (a fail-first test, ROADMAP criterion 3).
- **Weapons and armour get one flavour line per type.** Their generated stat line ("d8 · −1 to hit" and the armour equivalent) is their technical layer and moves behind the RULES tap like everything else.
- Saved items: an old save's item carries its own `txt` copy. Flavour must reach old saves the same way item text does today (`refreshItemTexts` on load, or a lookup by name). Tolerant load only.

**Tone (user, 2026-10-03)**
- **One sentence, about 90 characters or fewer.**
- **The house voice:** sarcastic, deadpan, family-friendly (no profanity, gore or adult content). It hints at what the thing does without numbers, e.g. Heal: "Closes wounds the polite way: quickly, and without asking how you got them."
- **No sample checkpoint:** Claude writes the full batch. The user reviews everything at the end on the narrative-review page (`node tools/narrative-review.mjs`, `docs/narrative-pass/review.html`). Every line passes the family-friendly safety scan (`content/safety-wordlist.js`) and the narrative-pass ledgers (new-line rows).

### Claude's Discretion
- The exact UI of the RULES affordance (a small "RULES ▸" toggle row, its styling and its tap target), within the existing sheet and card patterns and touch-target sizes.
- Where the Settings switch sits in the existing Settings sheet, and its key name.
- Each flavour line's wording, within the tone rules.
- Whether flavour lives inline in each content row or in one keyed table per content file (inline `flavor` beside `txt` is the default).

### Deferred Ideas (OUT OF SCOPE)
- Races, sub-classes, ability descriptions and chip explanations: Phase 96 (same shape, same RULES surface).
- Rewriting narration lines: out of the milestone.

Also out of scope (CONTEXT domain): Oracle, rail and fight-log narration lines (reviewed in v2.1 Phase 79), the Phase 94 state labels (functional, they stay plain), and any rule or number change.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FLAVOR-01 | Spell and scroll descriptions shown to the player read as fantasy flavour, not rules text | 41 spells + 1 generic scroll line (Content Inventory); surfaces: Hero grimoire (`heroTab.js:572`), combat SPELLS rows (`combatMenu.js:283`), Gear SCROLLS row (`gearTab.js:540`), combat SCROLL row (`combatMenu.js:506-516`), store Sealed scroll (`engine/economy.js:550`) |
| FLAVOR-02 | Equipment, magic-item and potion descriptions shown to the player read as fantasy flavour | 111 flavour entries total (Content Inventory); lookup by name (Saves); surfaces table (Display Surfaces) |
| FLAVOR-05 | Exact rules and numbers live in a separate technical layer, reachable in game; v2.3 guards re-pin to that layer with no guard lost | `txt` untouched, flavour in new keyed maps, RULES toggle + "Always show the rules" setting; guard inventory shows 0 guard files need editing; 3 new tests designed plus a drift test prototyped |
</phase_requirements>

## Summary

Phase 95 is a presentation-and-content phase with **zero engine bytes**. The two-layer model is: the existing `txt` (and the generated weapon/armour stat lines from `viewModels.js#itemStatLines`) stays exactly as the rules layer, and a new `flavor` string per content entry is the player layer. Every v2.3 guard reads `txt`, `itemStatLines`, or view-model fields built from them, so as long as those are not changed (flavour is **additive**), none of the 18 guard test files needs an edit [VERIFIED: codebase]. The work is therefore: (1) a flavour data shape and a by-name lookup, (2) one shared RULES reveal component plus a persisted setting, (3) ~111 written lines, (4) wiring the component into eight display surfaces, (5) declared snapshot moves, (6) registering the new text in the voice tooling.

The decisive design finding is about **where flavour must NOT live**: `JEWELRY`/`CLOAKS`/`STAVES` rows are `Object.assign`-spread onto rolled items (`engine/items.js:152,160,168`, `engine/character.js:661`, `engine/encounters.js:492,499`), and `BAG_ITEMS` rows are spread by `bagItemFor` (`engine/items.js:793`). An inline `flavor` key on those rows would become a serialized field on saved items and would break the frozen economy and chargen parity fixtures. So flavour goes in **keyed maps (name to line), one per content file**, which is explicitly inside Claude's Discretion item 4. Items never carry flavour; the shell looks it up by name at draw time, so old saves get flavour for free and no `*Comparable()` carve-out is needed.

The second finding is about the UI: the surfaces that need a RULES toggle are mostly **whole-row action buttons** (combat `cb-row`, store `goods`, drop-shelf rows) or **whole-row openers** (Gear tab rows and cards open the Gear sheet). A toggle cannot be nested inside a `<button>`, so each host needs a sibling toggle, and several source-pin tests constrain `cbRow`, the store region and `renderEncounter`. Reveal toggles are inspections, not decisions, so they are plain `onclick` (the fight-log reveal row precedent at `mazeworld.html:4751-4760`), never `guardTap`.

**Primary recommendation:** Ship flavour as seven keyed maps in the existing content files plus one pure lookup (`src/browser/flavorText.js`) and one shared reveal module (`src/browser/rulesLayer.js`); keep every existing `txt`, `desc`, `line`, `sub` view-model field byte-identical (flavour is additive); write all 111 lines first (content-only plans, invisible to the UI), then wire the surfaces so each snapshot fixture is regenerated exactly once; prove "no guard lost" by showing the 18 guard test files and the five audit docs are byte-unchanged at the phase end.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Flavour line text (data) | Content (`content/*.js`) | Voice tooling (registry, ledgers) | Pure data, no functions (content-is-pure-data guard); reviewed on the narrative page |
| Rules text (`txt`, stat lines) | Content + `viewModels.js#itemStatLines` | Engine tests (truth guards) | Unchanged technical layer; guards pin it |
| Name to flavour lookup (item shapes, spells) | Shell logic (`src/browser/flavorText.js`, pure) | — | Presentation concern; keeps the engine and saves untouched |
| Layering rule (lead vs rules vs tag) | Shell logic (`src/browser/rulesLayer.js`, pure) | Renderers | One rule everywhere (Phase 93/94 pattern) |
| RULES toggle DOM + expanded state | Shell renderer modules | Classic script (`mazeworld.html`) for combat rows, find card, drop shelf | Presentation-only state, never on `S` (serializeRun spreads `S`) |
| "Always show the rules" setting | Storage (`settings.js`, Preferences blob) | Settings sheet markup in `mazeworld.html` | Same blob as all other settings |
| Safety, hygiene, review of new text | Tools (`tools/lib/voice-corpus.mjs`, `voice-inventory.mjs`, `narrative-review.mjs`) + `test/voice/*` | Ledgers `docs/narrative-pass/why/95-NN.json` | Existing pipeline; needs registration |
| Save compatibility | Engine (`saveState.js`) | — | Nothing to change: flavour is never stored |

## Content Inventory (Question 1)

All counts and texts are from the live tables [VERIFIED: codebase, `node` dump of `content/index.js`]. "Current player text" is what the player reads today, which becomes the **RULES layer** unchanged. Flavour entries to write: **111** (41 + 1 + 10 + 4 + 3 + 23 + 24 + 5).

### Spells (41) `content/spells.js:105-190`, scrolls reuse them

Every spell `txt` starts with `NICHE_LABELS[niche] + " · "` (contract pinned by `spell-table.test.js`). Lengths run 22 to 279 characters. Key = `SPELLS[].n`. Current text shown (truncated):

| # | Spell | Lvl | Niche | Current `txt` (truncated) |
|---|-------|-----|-------|----------------------------|
| 0 | Heal | 1 | healing | healing · you · d10 hp |
| 1 | Shield | 1 | defensive | defensive · you · soaks 50 hp for 5 rounds |
| 2 | Strength | 1 | buff | buff · you · for 100 squares, every damage roll you make … adds an extra d10 … |
| 3 | Doze | 1 | control | control · d4 foes, your target first · asleep d4 rounds each; a hit wakes the sleeper … |
| 4 | Freeze | 1 | burst | burst · one foe · hits on 5–10 (d10) before bonuses, for d6 + your level² damage; … frozen for d4 rounds … |
| 5 | Map the Floor | 1 | sight | sight · the whole floor · shown until you take a step, then your focus breaks |
| 6 | Mirror Self | 1 | defensive | defensive · you · foes hit you only on their best roll (20 on a d20; 19–20 if you insulted them), d6 rounds |
| 7 | Stun | 1 | control | control · one foe · held for d4 rounds, and hitting it does not end it … |
| 8 | Weaken | 1 | control | control · every foe · foes hit only on a high roll (18–20 on a d20 …) and do half damage … |
| 9 | Acid | 2 | dot | damage over time · one foe · 2d6+2 a round, d6 rounds; the first round adds your level² damage |
| 10 | Stupidity | 2 | control | control · the foe you picked · its intelligence drops to 1 for the fight … |
| 11 | Blind | 3 | control | control · one foe · blind for the fight: it hits only on its best roll (20 on a d20) … |
| 12 | Shrink | 3 | control | control · up to d6 foes · half hp and half damage, the fight |
| 13 | Ice | 3 | multi | multi-target · every foe · d10 + your level² damage to each, no roll to hit; … frozen … |
| 14 | Earthquake | 4 | multi | multi-target · every foe and you · 3d10+8 + your level² damage to each foe; … |
| 15 | Noxious Vapor | 4 | chaos | chaos · every foe · a d6 decides it: on a 4 each foe dies unless its own d10 shows a 1 … |
| 16 | Fireballs | 4 | multi | multi-target · d8 bolts · d10+2 damage each, spread across the foes … |
| 17 | Petrify | 5 | control | control · one foe · turns to stone and dies; you get the experience and none of the spoils … |
| 18 | Insane | 2 | chaos | chaos · one foe · a d6 decides it: 1 it dies, 2 it hits the next foe … |
| 19 | Summon | 2 | summon | summon · one ally · fights beside you d4+2 rounds |
| 20 | Fireball | 3 | burst | burst · one foe · hits on 5–8 (d8) before bonuses, for 2d10+4 + your level² damage |
| 21 | Major Heal | 3 | healing | healing · you · 3d10 hp |
| 22 | Bubble | 3 | defensive | defensive · you · the next blow bounces back at whoever threw it, then a 25 hp film … |
| 23 | Sense Danger | 3 | sight | sight · your next fight · you act first, whatever turns up … |
| 24 | Turn Walking Dead | 2 | answer | answer · every Walking Dead of your level or lower · sent back; … |
| 25 | Plane Gate | 3 | answer | answer · d6 Demons or Walking Dead · vanquished to The Planes |
| 26 | Sense Presence | 2 | sight | sight · you · fight in the dark at full skill and nothing gets the jump on you … |
| 27 | Lightning | 4 | multi | multi-target · every foe · hits each on 5–8 (d8) before bonuses, for d10+6 + your level² damage apiece |
| 28 | Regeneration | 4 | healing | healing · you · d8 hp a round, this fight |
| 29 | Mangle | 5 | burst | burst · one foe · hits on 5–8 (d8) before bonuses, for 2d20+15 + your level² damage |
| 30 | Death | 5 | burst | burst · the foe you picked · dies outright; costs you 25 hp |
| 31 | Open/Lock | 1 | utility | utility · your next chest · springs open with no lock roll … |
| 32 | Fly | 2 | utility | utility · you · flight for 30 squares, +10 squares per school bonus point … |
| 33 | Enchant Character | 4 | buff | buff · you · for 50 squares, +10 squares per school bonus point: +2 to hit … |
| 34 | Speed of Sound | 5 | buff | buff · you · for 50 squares … two blows every time you swing, and you act first … |
| 35 | Stop Time | 3 | control | control · every foe · stopped for 2 rounds, +1 round per school bonus point … (279 chars) |
| 36 | Senseless | 2 | control | control · one foe · loses its senses for d4 rounds … |
| 37 | Duplicate Foe | 5 | control | control · one foe · meets its double and fights it for d4+1 rounds … |
| 38 | Door Illusion | 1 | defensive | defensive · the fight · a door that isn't there, and you through it … |
| 39 | Chameleon Tongue | 3 | answer | answer · this fight · you speak their tongue like a local and talk at once … |
| 40 | Size of the Behemoth | 4 | control | control · every foe · you look enormous … |

Scrolls: a scroll is a counter (`c.scrolls`) that casts a random spell when read; there is **no per-scroll description anywhere in the game**. The only scroll text is generic: `GEAR_COPY.scrollDesc` (`gearTab.js:122`) and `COMBAT_MENU_COPY.scrollDesc` (`combatMenu.js:81`), both "A random spell, read aloud. No refunds.", plus `scrollReadOdds(state)` appended on both surfaces (rules). So scrolls get **one** flavour line (`SCROLL_FLAVOR`, a plain string export), also used by the store's "Sealed scroll" line (`engine/economy.js:550`, which has `sub: null` today, i.e. no text at all). Read results are narration (out of scope) [VERIFIED: codebase].

### Magic items (23) `content/treasure-tables.js` (JEWELRY 8, CLOAKS 7, STAVES 8)

Key = row `n`. Lengths 51 to 273 characters.

| Table | Items (current `txt` begins) |
|-------|------------------------------|
| JEWELRY (8) | Ring of Power ("used, it adds +1 damage to every attack for fifty squares; …"), Gauntlet of the Giant ("used, you are one size larger for fifty squares: +6 damage, and foes +1 to hit you; …"), Amulet of Light, Pendant of Fortitude ("half damage from one attack, once every 100 squares"), Anklet of Invisibility ("used, for fifty squares foes are −2 to hit you; …"), Helm of Knowledge (273 chars, the parley text), Bracelet of Flight, Amulet of Stone |
| CLOAKS (7) | Cloak of Strength (crit ward text), Cloak of Invisibility, Cloak of Speed, Cloak of Regeneration ("used, a d6 hp back at once, and again every ten squares you walk, three more times; …"), Cloak of Armor ("soaks as plate (AR 15) for fifty squares …"), Cloak of Flying, Cloak of Ether |
| STAVES (8) | Rowan, Birch, Walnut (271 chars), Oak, Crystal, Poplar, Pine, Cedar Staff (all end with charges and recharge text) |

Phase 93 / 93.1 text (Cloak of Regeneration, Gauntlet +6) is already final in the tree [VERIFIED: codebase], so the "rewrite item text once" dependency is satisfied.

### Potions (10) `content/potions.js` (POTIONS[], key = row `n`)

Healing "+d10+2 hp"; Cure Poison "cures poison"; Speed "double attacks, 50 squares"; Xtra Healing "heal to maximum"; Strength "+8 damage to blows and spells, 25 squares"; Cure Disease "cures disease"; Enlarge "one size larger for fifty squares: +11 damage, and foes +1 to hit you"; Acuteness "your strike die becomes a d6 for d8 rounds"; Death "you're dead!"; Invisible "invisible for a day (100 squares): …".
Two things to note: (a) the **Healing potion counter** (`c.potions`, the starting and bought healing potions) has no content row: its rules text is `GEAR_COPY.healingDesc` ("Heals 7–25 hp (double for a Wilmsry). Stays corked at full health.", `gearTab.js:120`) on the Gear tab and `COMBAT_MENU_COPY.potionDesc` ("Heals 2d10+5 hp, doubled for a Wilmsry, and takes your turn…", `combatMenu.js:79`) in combat; both are pinned (`authored-ranges.test.js:768`, `gear-view-models.test.js:704`, `combatMenu.test.js:896`). They stay as the RULES text; the flavour is `POTION_FLAVOR["Healing"]`. (b) the **Death potion's** `txt` is its only warning on the find card ("Death potion (??)"), so its flavour must still say in words that it is deadly.

### Tools (3) + Lockpicks `content/tools.js`

Torch "lights the dark once, and keeps it off for forty squares"; Rope "the honest way across a crevice. Once."; Ladder "one climbable wall, no climbing. Once.". **Lockpicks** (`kind:"picks"`) is an item with `txt` "6–10 on d10 against any lock" but **no content row**: the literal lives in `engine/items.js:271` and `engine/economy.js:513` (store: "Set of lockpicks", sub "opens boxes on 6–10"). Recommended: in scope, key `"Lockpicks"` inside `TOOL_FLAVOR` (4 entries). [ASSUMED: lockpicks counted as a tool; CONTEXT lists "tool" and the ITEM-AUDIT has a Lockpicks family]

### Bags (3) `content/bags.js:41-45` (BAG_ITEMS, key = row `n`)

"Medium bag" "6 slots, 5000 wilmst and 20 rations. Room to regret more things."; "Large bag" "8 slots, 8000 wilmst and 40 rations. Your spine has filed a complaint."; "Enormous bag" "10 slots, 10000 wilmst and 60 rations. Technically luggage." These already mix numbers and a joke; the joke becomes the seed of the flavour. The starting `small` bag is not an item (no card). The Gear bag meter's caps line (`GEAR_COPY.bagCaps`) is a functional readout and stays.

### Weapons (24) `content/weapons.js:35-62`, key = `WEAPONS` object key; and armour (5) `content/armors.js:19-25`, key = `ARMORS[].name`

Weapons have **no `txt`**; the item's `txt` is just the label (`txt: WEAPONS[base].lab`, `engine/items.js:174,181`, `engine/economy.js:491`). The stat lines are generated by `viewModels.js#itemStatLines` (`viewModels.js:287-340`): weapon = damage (`lab`, plus " +N" when enchanted), "{signed} to hit" (`need`), "crits on the top {n} numbers of your strike die" (`crit>1`), "enchanted", usable-by; armour = "AR n", "left/max hp" (or "destroyed"), "enchanted", "{signed} to climb, leap and flee rolls" (`bulk`), usable-by. Bag armour uses `bagArmorText` (`viewModels.js:62`, "AR n · left/max hp"); the store's armour sub is "AR n, wp hp" from the engine (`economy.js:500`, replaced in the shell by the formatter, Phase 71).
Weapons: Axe d6, Bastard Sword 2d8+1, Battle Axe 2d6+1, Broadsword d10+2, Claymore d12+2, Dagger d6/2, Katana d10+1, Kopesh Sword d12+3, Long Sword d8+2, Ninja-to d8+1, Rapier d6, Short Sword d6+2, Wakazashi d6+1, Club d6, Flail d10+2, Mace d8+1, Morning Star d8+2, Quarter Staff d6, Spiked Staff d8, Whip d6/2, Awl Pike 2d6+2, Bardiche 2d10+2, Naganita 2d8+2, Spear d8.
Armour: Cloth (AR 3, 12 hp), Leather (6, 15), Studded (10, 18, bulk 1), Mail (12, 30, bulk 1), Plate (15, 45, bulk 2).
Variants share the type's line: premium blades are named "Whisper, a long sword" with `base` = the type (`engine/items.js:177-181`), warded armour "Warded plate" has `armor` = the type (`:191-197`), so lookup keys are `item.base` and `item.armor`. A wielded staff is `kind:"staff"` (magic map). Bare hands ("Fists") already have in-voice copy (`GEAR_COPY.empty.weapon`).

### Other item-like content, scope call

| Content | Where | Recommendation |
|---------|-------|----------------|
| Foods (Chicken, Bread, Water, Ale, Meat), Rations, repair lines | `content/foods.js`, store lines `economy.js:510-538` | **Out.** Functional labels with the number in the name ("Chicken (+12 hp)"), no description. |
| Healing potion counter, SCROLLS row | `gearTab.js:120-122`, `combatMenu.js:79-81` | **In**, covered by `POTION_FLAVOR["Healing"]` and `SCROLL_FLAVOR`. |
| FAERIE gifts, MISC_MAGIC kinds | `treasure-tables.js` | **Out** (narration, no description surface). |
| Special skills (`content/skills.js`, 24 `txt`/`txt2`; Hero tab list `heroTab.js:995`) | Hero tab | **Not in Phase 95 or 96 text.** Flag to the user: recommend adding to Phase 96. See Open Questions. |

## Standard Stack

### Core
No new dependencies. Everything is vanilla ES modules, `node:test`, and the existing tooling. [VERIFIED: codebase, `package.json`]

| Piece | Version | Purpose | Why standard here |
|-------|---------|---------|-------------------|
| Node | 22.23.2 (engines >=22) | test runner (`node --test`) and tools | already the project runner |
| `content/*.js` keyed frozen maps | n/a | flavour data | same posture as `NICHE_LABELS`, `TREASURE_ACTIVATION_OF` |
| `src/browser/*.js` pure modules | n/a | lookup + layering | docs/SHELL-MODULES.md contract: no window or document globals, `host.ownerDocument` + deps |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Keyed maps per content file | Inline `flavor` beside `txt` (CONTEXT default) | Inline is safe only on rows that are never spread onto items (SPELLS, POTIONS, TOOLS, WEAPONS, ARMORS). It is **unsafe** on JEWELRY/CLOAKS/STAVES (spread onto items, would serialize and break parity unless stripped like `slot`/`act` via `dropAuthored`) and BAG_ITEMS (spread by `bagItemFor`). Keyed maps are uniform, add no field to any row, and give a clean one-block review diff. |
| Flavour stored on the item, refreshed on load | Lookup by name at draw time | Storing needs a serialized field, three `*Comparable()` carve-outs and a `refreshItemTexts` extension; lookup needs none and reaches old saves instantly. |

**Installation:** none.

**Version verification:** no packages are installed or recommended.

## Package Legitimacy Audit

No external packages are installed by this phase. Nothing to audit. `Packages removed due to [SLOP] verdict: none`. `Packages flagged as suspicious [SUS]: none`.

## Architecture Patterns

### System Architecture Diagram

```
 content/*.js (pure data)                                   engine (UNTOUCHED, 0 bytes)
 ┌───────────────────────────────┐                          ┌───────────────────────┐
 │ rules layer: txt, lab/ar/need │──── item objects in S ──▶│ items carry txt copy  │
 │ flavour layer: *_FLAVOR maps  │      (NO flavor field)   │ refreshItemTexts(load)│
 └──────────┬────────────────────┘                          └───────────────────────┘
            │ import                                                    ▲ unchanged
            ▼
 src/browser/flavorText.js (pure)         src/browser/viewModels.js#itemStatLines (unchanged = rules layer)
   flavorOfItem(it) / flavorOfSpell(n)           │
            │                                    │
            ▼                                    ▼
 src/browser/rulesLayer.js (pure + DOM mount) ◀── layers({flavor, rules, tags})  → { lead, rules }
   expanded-id Set (module state)  ◀── setAlwaysRules(bool) ◀── applySettings(settings.alwaysRules)
            │ mountRules(doc, host, {id, rules})  →  button.mw-rules-btn + p.mw-rules-line[hidden]
            ▼
 SURFACES (each: flavour as lead, existing tag kept, RULES under it)
  Hero grimoire ─ combat SPELLS/ITEMS rows ─ Gear tab rows/cards/consumables ─ Gear sheet
  Store goods ─ sell list/loot list (renderCarriedList) ─ drop shelf ─ find card (rail)
            │
            ▼
 Tooling: voice-corpus registry ▶ voice-inventory (--safety/--hygiene/--roll-under)
          ▶ ledgers why/95-NN.json ▶ narrative-review (NARRATIVE-PASS.md + review.html)
```

### Recommended Project Structure
```
content/spells.js          + SPELL_FLAVOR (41), SCROLL_FLAVOR (string)
content/potions.js         + POTION_FLAVOR (10)
content/tools.js           + TOOL_FLAVOR (Torch, Rope, Ladder, Lockpicks)
content/bags.js            + BAG_FLAVOR (3)
content/treasure-tables.js + MAGIC_ITEM_FLAVOR (23, keyed by row n; NOT inline on the *_ROWS)
content/weapons.js         + WEAPON_FLAVOR (24)
content/armors.js          + ARMOR_FLAVOR (5)
src/browser/flavorText.js  NEW  FLAVOR_DOMAINS registry + flavorOfItem / flavorOfSpell (pure)
src/browser/rulesLayer.js  NEW  RULES_COPY bank, layers(), expanded Set, mountRules(), setAlwaysRules()
src/browser/settings.js    + alwaysRules (default false), appended 13th key
docs/TEXT-LAYERS.md        NEW  the model, for Phase 96
docs/narrative-pass/why/95-NN.json   ledgers (new-line rows)
```
`content/index.js` is a barrel of `export *`, so no index edit is needed; export names must stay unique across content files (a duplicate silently drops the name) and must not be re-declared in `mazeworld.html` (`test/unit/shell-no-content-copies.test.js` derives the name set from `Object.keys(content)`) [VERIFIED: codebase].

### Pattern 1: Additive flavour, rules fields untouched
**What:** Never change what `txt`, `desc`, `line`, `sub`, `note` hold. Add `flavor` (only when non-empty) to view-model rows, or resolve flavour in the renderer from the subject it already holds. A renderer shows `lead = flavor || rules` and puts `rules` behind the toggle only when a flavour exists.
**When to use:** every surface. It makes an unknown item (a save from an older build, for example the removed Cloak of Healing, which `slotFor` still tolerates) degrade to today's behaviour: rules text as the lead, no toggle, no throw.
**Why:** the guards read these fields. Whole-row `deepEqual` pins exist in `combatMenu.test.js` (potion, scroll, item and worn rows at lines 442-444, 498-502, 550-555, 637-700), so only rows that gain a flavour change shape, and those pins are declared re-pins.

### Pattern 2: Reveal toggle = inspection, not decision
**What:** `button.mw-rules-btn` with `aria-expanded`, `aria-controls`, `aria-label="Rules for <name>"`; tapping flips `hidden` and `aria-expanded` **in place** and records the id in a module-level Set; it never calls `renderEncounter`/`paint`. Plain `onclick`, not `guardTap`.
**Precedent:** the fight-log reveal row, "deliberately NOT wrapped in guardTap and never calls renderEncounter" (`mazeworld.html:4751-4760`); status chips use an inspection guard rather than `encArmed` (R-29, `condArmed` `:4595` and `guardInfoTap(btn, fn, armed)` `:4610`, an optional own-arm-window variant if ghost taps on a freshly built row prove a problem on device); `beatHurryTap` passes `.cb-lot-chip` through (`:6335`).
**Expanded state must live outside the DOM:** `renderEncounter`, `paint()`, `renderRail()` and `refreshGearSheet` rebuild their DOM on every state change (`mazeworld.html:5506,4204,5845,6490`), so a DOM-only flag would collapse on every repaint. Key the Set by `"<surface>:<key>"` (for example `spell:Heal`, `gear:potion:Healing`).
**"Always show the rules" ON:** render rules expanded and **omit the toggle** (nothing to tap); OFF: toggle visible, per-id state honoured.

### Pattern 3: Sibling, never nested
A toggle cannot sit inside a `<button>`. For action-row hosts wrap and add a sibling; for rows with no flavour render **byte-identically to today** (no wrapper), so ability rows and the Phase 94 fixtures do not move:
```js
// mazeworld.html renderActionArea (was: list.appendChild(lockAction(cbRow(row, i + 1))))
const L = window.__mzRules.layers(row);                 // { lead, rules }
const el = lockAction(cbRow(L.rules ? { ...row, desc: L.lead } : row, i + 1));
list.appendChild(L.rules ? window.__mzRules.wrap(el, L.rules, "combat:" + row.id) : el);
```
`cbRow` itself stays untouched, which keeps its source pins valid (`combat-submenu-fit.test.js:109-125` pins `desc.textContent = row.desc;`, `shell-input-guards.test.js:251-258` pins exactly one `guardTap(el, () => pickCombatRow(row))` inside `cbRow`, `shell-combat-actions.test.js:67,130,158-166`).

### Anti-Patterns to Avoid
- **Inline `flavor` on a row that is spread onto an item.** Leaks a serialized field (see Summary).
- **Changing `GEAR_COPY`/`COMBAT_MENU_COPY` literals.** `gear-panels.test.js:38` deep-equals the whole frozen `GEAR_COPY`; put new strings in `RULES_COPY` (new bank), not in the old ones.
- **`guardTap` on the toggle.** The store region must contain no `guardTap(` (`shell-input-guards.test.js:260-263`) and an inspection should not be swallowed by the 250 ms arm window.
- **Flavour in engine narration or event text.** Out of scope; also `EVENT_NARRATION` coverage guards.
- **Editing `engine/economy.js` store `sub` strings.** The economy parity harness compares them; the shell replaces them.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rules text for any item | A second stat formatter | `viewModels.js#itemStatLines(item, c)` entries, joined with " · ", `usable` entries filtered out (keep "(usable by …)" visible as a functional tag) | The Gear sheet, store and drop shelf already share it (Phase 71); it is guard-pinned (`item-stat-lines.test.js`) |
| Item name to content row | A new resolver | Copy the resolution of `engine/derived.js#canonItemText` (`:620`): potion by `eff2`, jewel/cloak/staff by `n`, tool by `tool` key; add weapon by `base`, armour by `armor`, bag by `tier`, picks constant | Same keys the engine already trusts |
| Number/die/percent detection in flavour | A fresh regex | The `TOKEN_RE`/`WORD_NUM` shape from `item-text-engine.test.js:100-121` (per-file copy, the repo's fixture convention) | Same definition of "states a number" as the truth guard |
| Settings persistence | A new storage key | `settings.js` blob `ddr.settings.v1` + `writeSetting` | One write-queue entry, tolerant merge, validated values |
| Reveal toggle behaviour | A new pattern | Fight-log reveal row (`mazeworld.html:4740-4765`) | a11y and no-rerender precedent |
| Review page / safety scan | A custom review page or word scan | `voice-inventory` + `narrative-review` + `content/safety-wordlist.js` | The user reviews on that page by decision |
| Proving a drifted number still fails | In-process mocks of the guards | A child `node --test` run in a temp mirror (prototyped, below) | The guards are test files with per-file fixtures; the only honest proof is to run the real file against a mutated tree |

**Key insight:** this phase adds a layer and moves nothing. Anything that edits an existing rules string, a view-model field the guards read, or an engine file is a bug in the plan.

## Display Surfaces (Question 2)

Renderer, file:line, field read today, and how flavour plus RULES slots in. "Tag" = functional text that stays plain and visible.

| # | Surface | Renderer | Reads today | Host type | Flavour slot | RULES slot |
|---|---------|----------|-------------|-----------|--------------|------------|
| 1 | Hero grimoire | `heroTab.js#renderGrimoire` L540-600; row built `:432` | `row.txt` + `row.resistNote` in `info.innerHTML` (`:572`) | `li` with `.grim-info` + Cast button (not a button itself) | `<i>` shows flavour; `L{lvl}` badge and niche label stay | toggle inside `.grim-info` after the `<i>`; rules = `row.txt` + resist note |
| 2 | Combat SPELLS rows | `combatMenu.js` L270-292 (`desc`), shell `cbRow` `mazeworld.html:5224` | `desc` = `blockedLine · txt` or `txt · resistNote · resistHint` | whole-row `button.cb-row` (guardTap) | `desc` line shows flavour; `cost` stays "LVL n" | wrapper + sibling toggle; rules = old `desc` without the blocked reason |
| 3 | Combat ITEMS rows | `combatMenu.js` L396-423 (carried), L437-451 (worn), L463 (staff), L490-516 (potion, scroll) | `desc = it.txt`, `potionDesc`, `scrollDesc + odds`; disabled variants carry reasons (`notWielded`, `notEquipped`) | same `cb-row` | flavour for rows whose desc is a rules line; **reason rows stay plain, no flavour** | same wrapper |
| 4 | Gear tab WORN rows | `gearTab.js#gearWornModel` L322 (`note` L347 staff, L386 worn item); DOM L944-945 | `row.note` | `li` that opens the Gear sheet (opener) | note slot shows flavour for jewel/cloak/staff; weapon note keeps its voice line or shows the type line; armour note stays wear text | in the **sheet** (row 7); with Always ON append a static rules line |
| 5 | Gear tab BAG cards | `gearBagCardsModel` L442 (`desc` L462-466, includes usable suffix); DOM L986-989 | `card.desc` | opener | `.mw-gear-desc` shows flavour + usable tag | in the sheet; Always ON appends rules |
| 6 | Gear CONSUMABLES | `gearConsumablesModel` L487 (potion `desc: g.firstTxt` L512, scroll L540, healing L496); DOM L1008-1011 | `row.desc` | card with a USE button, not an opener | flavour in `.mw-gear-desc` | toggle in `.mw-gear-card-main` under the desc (the card is not a button, so no nesting issue) |
| 7 | Gear sheet | `gearSheet.js#gearSheetModel` L108 (`note`, `stats`), `renderGearSheet` L495-536; markup `mazeworld.html:2425-2435` | `note` (hidden when stats exist, R-06), `stats[]` | modal sheet | `#mw-gear-sheet-note` shows flavour (add additive `flavor` to the model) | the `stats` container (`ensureStatsEl`) gets the toggle; stats are the RULES. `gear-sheet-model.test.js` pins `stats`, keep them |
| 8 | Store goods | `storeScreen.js` L100-145 (`row.innerHTML` L142) | `<i>` = stats · count · compare line · reason | whole-row `button.goods` that buys | `<i>` shows flavour; price, count, compare ("upgrade"), reason, usable stay | wrapper + sibling toggle; rules = stats |
| 9 | Store sell list, loot list | `gearTab.js#renderCarriedList` L648-860 (`sub` L763), loot `subFor` `mazeworld.html:5716` | `it.txt` / `bagArmorText` / `lootCompare` | `li` with action buttons (not a button) | `<i>` flavour; loot advice line stays | toggle in the `li` |
| 10 | Drop shelf | `mazeworld.html#renderDropShelf` L4353-4366 | `stats` (itemStatLines joined) else `bagArmorText`/`txt` | `button.goods` = Drop, in a bounded scrolling `.mw-find-drop` | flavour | **see Open Question 4** (rows are Drop buttons in a list tuned by quick 260928-fcs) |
| 11 | Find card | `renderRail` find branch `mazeworld.html:5924-5950` (`findSub` L5940); lines loop L6141-6153 | `lines[].text` = `name · findSub usable`, then `lootCompare(c,it).line` for gear | rail card, lines are typed (typewriter) | line text = `name · flavour` (+ usable) | extend a line object with `rules`; renderer appends toggle + hidden rules **outside** `typedTargets`; add `.mw-rules-btn` to the rail `onclick` exclusions (`:6303` has `.mw-rail-btn`, `:6306` has `.mw-find-drop`) |

Notes:
- **Rail info cards** for items exist only as the find card; ability, chip and joiner cards are Phase 96 or unrelated. The generic `line.roll` secondary line is always visible, not a toggle, so it is not the reuse point; add a separate `rules` property (Phase 96's chip tap card can use it).
- **Touch targets:** the app-wide rule is `button{min-height:48px}` (UX-02, `mazeworld.html:667`, `.cb-row`, `.mw-gear-use-btn`, `.mw-rail-btn` all 48px). A real `<button>` toggle gets 48px for free; style it as a quiet left-aligned "RULES ▸" strip, text via `calc(<rem> * var(--mw-text-scale))` (`text-scale.test.js` fails any unscaled `font-size`). Concern: a 48px strip per row inside the 206px-capped `.cb-sub-list` (`combat-submenu-fit.test.js:97` pins the cap) triples row height; the list scrolls, but verify on the Pixel 7 at text size L. A side-by-side compact key is the fallback. [ASSUMED]
- **Arm-window guards:** `encArmed()` is false during a beat or within 250 ms of render (`inputGuards.js`, `mazeworld.html:4505`); `guardTap` is for decisions. During a round's beats `#cb-act` is `data-locked` and `.cb-row` is `pointer-events:none` (`mazeworld.html:899`); add `.mw-rules-btn` to that selector so the toggle is inert too, and let `beatHurryTap` (`:6331`) keep swallowing taps (do not exempt it; its body is pinned to touch no `S`/`hidden`/dispatch). Rail card: add `.mw-rules-btn` to the `closest` exclusion at `:6303`, otherwise a tap on a decision-pending card pulses the rail instead of toggling.

## Combat Rows' Short Tag (Question 3)

What the rows show today and what stays as the functional tag [VERIFIED: codebase]:

| Row kind | `cost` slot (stays) | `desc` today (becomes RULES) | Flavour (new lead) |
|----------|--------------------|------------------------------|--------------------|
| Spell | `LVL {spellLevelFor}` (pinned by `combatMenu.test.js:287,297,315`); `nicheLabel` exists on the row but the shell does not print it | `sp.txt` + (foe-targeted) ` · a foe may resist this on its intelligence…` + live `Target resists on X–Y` hint | `SPELL_FLAVOR[name]` |
| Spell, blocked (Chameleon Tongue, Door Illusion) | same | `blockedLine · txt` | blocked reason stays plain and visible above the flavour |
| Potion (healing counter) | `{n} LEFT` | `COMBAT_MENU_COPY.potionDesc` | `POTION_FLAVOR.Healing` |
| Scroll | `{n} LEFT` | `scrollDesc + scrollReadOdds(state)` | `SCROLL_FLAVOR` |
| Carried/worn/staff item | `itemRowState(...).text` (READY, N SQ, cd N SQ, k/max · N SQ; worn rows `EQUIPPED · …`) | `it.txt` | `flavorOfItem(it)` |
| Item, not wielded / not equipped | `notWielded` / `notEquipped` | a reason sentence | none: stays plain |
| FLEE/PARLEY (SOCIAL), ABILITIES, SING | unchanged | unchanged | none (functional / Phase 96) |

The CONTEXT example tag "d10 hp" **does not exist today** on spell rows: the numbers live inside `txt` only. The honest reading of "existing short functional tag" is the `cost` slot (`LVL n`, counts, cooldown, charges), optionally plus the already-computed `nicheLabel` ("healing", "control"). Deriving a "d10 hp" tag would need a new authored `tag` field carrying numbers that no guard pins. Recommendation: no new numeric tag. See Open Question 2.

The live `Target resists on X–Y` hint (quick 260927-rsx, user ruling) is state, not description; recommend it stays visible beside the tag and the static resist sentence moves into RULES. [ASSUMED]

## Settings (Question 4)

[VERIFIED: codebase]
- `src/browser/settings.js`: one JSON blob under `SETTINGS_STORAGE_KEY = "ddr.settings.v1"` (`:~92`), `SETTINGS_DEFAULTS` frozen (12 keys now, in order: sound, haptics, textSize, confirmBeforeQuit, dressing, compete, nameWelcomed, volMaster, volMusic, volEffects, movement, padSide), validated by `ALLOWED_VALUES` (array or predicate), tolerant merge in `readSettings` (an old blob without the key reads the default), `writeSetting` rejects unknown or invalid values. New keys are **appended**.
- Add `alwaysRules: false` as the 13th key (camelCase like `confirmBeforeQuit`, `nameWelcomed`), `ALLOWED_VALUES.alwaysRules = [true, false]`. No migration: an old blob reads `false`.
- `test/unit/settings.test.js` must be updated, declared: the literal object at `:83-100` gains `alwaysRules: false`; the key-order list at `:169-182` gains `"alwaysRules"`; `:183` length 12 becomes 13; the "twelve fields" test titles and header comments. Other tests spread `SETTINGS_DEFAULTS` and are unaffected. `dressing-shell.test.js:305-321` only requires the dressing row between Haptics and the version row, so the new row can go **after Set dressing and before `#mw-settings-version-row`**.
- Sheet markup: copy the Set dressing block (`mazeworld.html:2348-2354`): `<div class="mw-settings-row"><span class="mw-settings-label">Always show the rules</span><div class="mw-settings-options" data-setting="alwaysRules"><button type="button" class="mw-settings-opt" data-value="true">On</button><button … data-value="false">Off</button></div></div>`. The delegated click handler (`:~8470-8515`) is generic: it parses "true"/"false", calls `writeSetting`, `applySettings`, `renderSettingsSheet`. Only two additions: in `applySettings` (`:7852`) call `window.__mzRules?.setAlways(settings.alwaysRules === true)` (the file already exposes the settings as `window.__mzSettings`), and in the click handler `if (key === "alwaysRules") { window.paint?.(); window.renderEncounter?.(); window.renderRail?.(); }` (the dressing branch at `:8509` is the pattern; all three are classic-script globals). `renderSettingsSheet` (`:7954`) needs no change (it highlights by `data-setting`).
- Any new CSS must follow `.mw-settings-row` rules (`account-layout.test.js:205` pins that rule's text; reuse it, do not edit it).

## Saves (Question 5)

[VERIFIED: codebase]
- An item's `txt` is a **copy on the item** and reaches old saves through `refreshItemTexts` (`engine/saveState.js:1004-1037`), run by both load chains, which writes only `txt` (and a potion store line's `sub`) from `derived.js#canonItemText` (`:620`); weapons, armour, bags, lockpicks and scrolls resolve to `null` there ("their text is built from live fields").
- **Flavour never touches the item.** Lookup by name at draw time: `flavorOfItem(it)` resolves `{domain, key}` using the same keys: potion via `POTIONS.find(p => p.eff === it.eff2).n`; jewel, cloak, staff via `it.n`; tool via `TOOLS[it.tool].n`; picks `"Lockpicks"`; bag via `BAG_ITEMS[it.tier].n`; weapon via `it.base` (or `it.n` when `base` is absent); armour via `it.armor`. An unresolvable item returns `""` and the surface shows its rules text (tolerant load).
- **No new serialized field**, so: `refreshItemTexts` unchanged; `*Comparable()` carve-outs in `test/parity/harness/comparables.js` unchanged (the "new serialized fields carved out" engine-gate rule is not triggered); `roll-high-save-compat`, `save-validation`, `item-text-refresh` unchanged; no engine byte changes, so parity and `forced-chargen.test.js:134` ("no new serialized field") hold.
- Add one standing guard so this stays true: build items of every shape the game makes (`rollJewel`, `rollCloak`, `rollStaff`, `toolItem`, store potion lines from `openStore`, `findMisc` potions, `bagItemFor`, `rollBlade(rng,d,true)`, `rollMailPiece`, lockpicks, a `serializeRun`/round-trip of a state holding them) and assert `JSON.stringify` contains no `"flavor"` and every item resolves to a non-empty flavour. Put it beside `test/roundtrip/`.

## Guards (Question 6)

### What each v2.3 truth guard pins, and why `txt` unchanged leaves it untouched [VERIFIED: codebase]

| Guard | Pins | Reads | Affected if `txt`/stat lines unchanged and flavour additive? |
|-------|------|-------|-----|
| `item-text-engine.test.js` (1220 lines) | every number an item `txt` states equals the engine (facts per row, completeness: a new number nobody pinned fails); also checks the surfaces: the store potion/tool lines, found potion, `itemStatLines`, weapon labels, armour lines | `JEWELRY/CLOAKS/STAVES/POTIONS/TOOLS/BAG_ITEMS/WEAPONS/ARMORS` rows, `itemStatLines`, `gearBagCardsModel` | No |
| `item-text-wording.test.js`, `item-text-refresh.test.js`, `item-audit.test.js` (611), `item-audit-fixes.test.js` | wording rules; refresh of old saves; `docs/ITEM-AUDIT.md` has exactly one row per content row, cells non-empty, verdicts closed (121 table rows today) | content rows, the doc | No: doc rows are keyed on content rows, which are unchanged |
| `spell-skill-text-engine.test.js` (1203), `spell-skill-text-wording.test.js`, `spell-skill-audit-fixes.test.js`, `spell-audit.test.js` (800), `skill-audit.test.js` | spell/skill number truth; `docs/SPELL-AUDIT.md` (112 rows) Text cell equals the live `txt`; `docs/SKILL-AUDIT.md` (32 rows) | `SPELLS`, skills | No |
| `authored-ranges.test.js` (1035) | every range or face count in authored text equals the engine's rule; section 8 names the test pinning every other stated range in the **live corpus** (`:1010` `match: "bank:GEAR_COPY.healingDesc"`) | content, banks, corpus | No, **provided flavour and `RULES_COPY` state no range or number** (the new number-free test guarantees it) |
| `value-identity.test.js`, `value-text`, `value-abilities`, `value-ledger`, `value-cleanup`, `identity-text`, `identity-audit`, `identity-contract/-race/-rulings/-world/-combat/-footer` | race/sub-class/ability text vs engine; `docs/VALUE-LEDGER.md` (100), `IDENTITY-AUDIT.md` (168) | `RACES`, `RACE_NOTE`…, abilities | No (Phase 96's domain, untouched here) |
| House-voice: `voice-corpus.test.js` (registry completeness, ledgers well-formed), `narrative-review.test.js` (committed pages equal fresh generation), `test/voice/narrative-hygiene.test.js`, `test/voice/safety-scan.test.js`, `hp-not-wp.test.js`, `stale-terms.test.js`, `roll-sign-consistency.test.js` | see "Registering ~111 lines" below | corpus | **Yes, needs registration**, not edits to their logic |

**Proof that no guard is lost** (cheap, mechanical, put in the gate plan): at phase end (a) `git diff --stat <phase-base>..HEAD` over `test/unit/{item-text-engine,item-text-wording,item-text-refresh,item-audit,item-audit-fixes,spell-audit,spell-skill-text-engine,spell-skill-text-wording,spell-skill-audit-fixes,skill-audit,authored-ranges,value-*,identity-*}.test.js` and `docs/{ITEM,SPELL,SKILL,IDENTITY}-AUDIT.md`, `docs/VALUE-LEDGER.md` is **empty**; (b) the row counts above (121 / 112 / 32 / 168 / 100, from `grep -c '^| '`) are identical before and after; (c) the three new tests below are green. Phase 94 style "one rule everywhere" test is added for the surfaces.

### The three new tests, plus two (designs)

1. **Coverage** (`test/unit/flavor-layer.test.js`): table-driven over `FLAVOR_DOMAINS` (spell, scroll, potion, tool, bag, magic, weapon, armor). For each domain: `rows()` come from the *content table*, every key has a non-empty string in the map, and the map has **no orphan keys** (every key resolves to a row). Plus item-shape resolution: every item the engine can build resolves through `flavorOfItem` (list in Saves). A "no vacuity" assertion pins the domain count (8) and total entries (111) at the gate. During waves 2-5 the test skips domains whose map is not yet exported, so the suite stays green.
2. **No numbers** (same file): for every flavour string, none of: digits, `\bd\d`, `%`, or a `WORD_NUM` word other than "one". Build the regex from the `item-text-engine` `WORD_NUM` list (`:100-111`: one…ninety, hundred, once, twice, half, double) minus `one` (idiom: GEAR_COPY already says "one more bad decision"). Include a teeth-both-ways self-test (doctored "Heals 10 hp", "twice a round", "50%", "d6" fail; "Closes wounds the polite way…" passes). Also assert: exactly one sentence-ending mark at the end, length <= 100 (target 90, so the cap is the guard and 90 is the writer's goal), no two entries share a line, flavour never equals `txt`, and (for spells) does not start with the niche label. [ASSUMED thresholds]
3. **Drift still fails** (`test/unit/flavor-drift.test.js`): a child-process mutation test. **Prototyped and working** [VERIFIED: prototype]: copy `engine/`, `content/`, `src/`, `package.json`, `test/unit/harness/{spellResistActs,identityDials}.js` and the guard file into a temp dir (`fs.cpSync`, `os.tmpdir()`), mutate one number, run `process.execPath --test <guard>` and assert non-zero exit **and** the expected failing title in the output.
   - `content/spells.js` Heal `"healing · you · d10 hp"` to `d12`: `spell-skill-text-engine.test.js` exits non-zero with `not ok 48 - Heal: every number the text states is claimed by one fact and equals the engine` (88 tests, 87 pass, 1 fail, ~15 s).
   - `content/treasure-tables.js` Ring of Power "fifty squares" to "sixty": `item-text-engine.test.js` fails `truth: every stated number equals the engine's, for every row` and `the guard fails a CHANGED number…` (21 tests, 19 pass, 2 fail, ~20 s).
   - Add `authored-ranges.test.js` if the temp mirror needs no extra files (not probed). Run the mirror at ~20 s each; keep to 2 guards (about 40 s of suite time). Also run the unmutated mirror once as a control or assert the output names the expected test (the second approach avoids doubling the time).
4. **Not serialized** (`test/roundtrip/`): see Saves.
5. **One rule everywhere** (Phase 93/94 pattern; `test/unit/rules-surfaces.test.js`): for each surface renderer under `recordingDom`/`shellSandbox`, with a state holding a spell, potion, tool, bag, magic item, weapon, armour: the flavour element is visible text without digits/dN in the **flavour element only** (tags like "LVL 1" and "3 LEFT" legitimately contain digits), a toggle exists with `aria-expanded="false"`, its rules element is hidden and equals the old text exactly; with `alwaysRules` on the rules are visible and there is no toggle; an item with no flavour renders as today.

### Registering ~111 lines in the house-voice tooling (verified end to end in a scratch copy) [VERIFIED: prototype]
1. **Registry** (`tools/lib/voice-corpus.mjs`, `BANK_REGISTRY` ~L138-215): add one `bank(module, export, surface, trigger)` row per new export: `SPELL_FLAVOR`, `SCROLL_FLAVOR`, `POTION_FLAVOR`, `TOOL_FLAVOR`, `BAG_FLAVOR`, `MAGIC_ITEM_FLAVOR`, `WEAPON_FLAVOR`, `ARMOR_FLAVOR` (surface `spells` or `items`) and `src/browser/rulesLayer.js` `RULES_COPY` (surface `panels`). Without it `auditRegistry()` reports the export as `unregistered` and `voice-corpus.test.js` fails (reproduced). Registering an export that does not exist yet is allowed (`absent`, never a crash), so **plan 95-01 can pre-register all nine** and no later plan edits the registry. Keys become `bank:SPELL_FLAVOR.Heal`, `bank:SPELL_FLAVOR.Open/Lock`; owner resolves to `79-05` for content files automatically. The file's header and `docs/narrative-pass/README.md` ("No new banks", registry not edited after 79-01) describe a Phase 79 rule; amend the README line in 95-01.
2. **Ledgers** `docs/narrative-pass/why/95-NN.json`, one row per line: `{ key, surface, trigger, before: "", after, reasons: ["joke"|"natural"|"fact"…], why }`. A new key has no base text, so `before` must be `""` (the review page prints "(new line)"). The `why` sentence should say what the old rules line now does ("rules text unchanged, behind RULES") because the page cannot show it. Validate with `node tools/voice-inventory.mjs --check-ledgers --after` (clean today: 0 errors). **Do not use `--coverage` as a gate**: it reports 327 pre-existing errors on the current tree [VERIFIED: codebase].
3. **Review pages:** after any ledger lands, `node tools/narrative-review.mjs` must be re-run in the same commit (writes `docs/NARRATIVE-PASS.md` and `docs/narrative-pass/review.html`); `narrative-review.test.js` "the committed pages equal a fresh generation" fails otherwise (reproduced, then green after regeneration). This is why flavour-writing plans are not parallel.
4. **Checks:** `node tools/voice-inventory.mjs --roll-under --hygiene --safety --count` must print `0` (it does today, 2.8 s). Hygiene rules that bite flavour writers: "armour" not "armor" outside proper nouns (house spelling), U+2212 minus and U+2013 ranges (no ASCII hyphen before a digit), no doubled spaces or space-before-punctuation, no "WP", no retired working title or "Maze Master". Safety: `content/safety-wordlist.js` is whole-word, case-insensitive (avoid "bloody", "damn", "crap", "ass", "balls", "bastard" outside the allowlisted "Bastard Sword" name).
5. **Hand-maintained lists:** `test/voice/safety-scan.test.js` `collectAuthoredStrings` (`:322-351`, push each flavour map and `RULES_COPY`) and `test/unit/hp-not-wp.test.js` (content banks import list at the top and its `banks` walk) are explicit lists and do **not** auto-cover new exports; iterate `FLAVOR_DOMAINS` instead of hard-coding names so Phase 96 only appends a domain.

## Snapshots (Question 7)

Ten fixtures in `test/unit/fixtures/shell-snapshots/`, compared byte-for-byte by `shell-tab-snapshots.test.js` (and `shell-ability-states.test.js` for the two fighter ones). Recording: `MZ_SNAPSHOT_UPDATE=1 node --test test/unit/shell-tab-snapshots.test.js` writes (never compares); a plain run only compares and fails with `missing fixture` if absent. Each past move is declared in that file's header comment and in the plan SUMMARY, confirmed with `git diff --stat` that the others re-wrote identical bytes.

Cross-check of each fixture against the live content strings [VERIFIED: codebase]:

| Fixture | Prints descriptions? | Moves in Phase 95 |
|---------|----------------------|-------------------|
| `thief.gear.txt` | Healing potion desc, Rope, Amulet of Light, Anklet of Invisibility, Bracelet of Flight, Cloak of Armor texts | **Yes** |
| `mu.gear.txt` | CONSUMABLES healing potion + scroll descs (`healingDesc`, scroll odds), worn weapon/armour rows | **Yes** (consumables) |
| `thief.gear-sheet-bag.txt`, `thief.gear-sheet-worn.txt` | Anklet/Bracelet effect text in the sheet stats | **Yes** (flavour note, RULES toggle around stats) |
| `thief-store.store.txt`, `mu-store.store.txt` | potions, tools, lockpicks, weapons, armour `<i>` rows, sell list | **Yes** |
| `mu.hero.txt` | grimoire rows (Heal, Doze, Freeze, Map the Floor, Stun, Earthquake, Summon, Fly) | **Yes** |
| `thief.hero.txt` | dossier, skills, abilities; no grimoire for a Thief | No (expected byte-identical) |
| `fighter.abilities-states.txt`, `fighter.hero-in-combat.txt` | ability rows (Phase 94, Phase 96 domain) | No |

So **seven declared text-layer moves**. They must be regenerated by the UI plans, once each, after all flavour exists (see Plan Split), each declared in the test header with its before/after and `git diff --stat` evidence. Rows without a flavour must produce the same DOM as today (no wrapper element), or the unrelated fixtures drift.

Other DOM or source-pin tests that will need declared re-pins (found by static grep of the renderers; the executor should run each surface's targeted sweep after wiring): `gear-tab-dom` (`mw-gear-desc`, `mw-gear-note`), `gear-sheet-dom`, `gear-sheet-shell`, `gear-sheet-model`/`gear-view-models` (only if a model row is widened), `store-rows`, `storeScreen`, `find-card-scroll-rows`, `find-card-full-bag`, `shell-map-rail`, `shell-loot-screen`, `shell-combat-actions`, `shell-input-guards`, `combat-submenu-fit`, `combatMenu`, `heroTab`/`grimoireViewModel`, `settings`, `bridge-registry` (new `window.__mzRules`).

## Phase 96 Reuse (Question 8)

The shape generalises without change [VERIFIED: codebase for the existing structure]:
- **Data:** `flavor` maps keyed by the same ids the content already uses: `RACE_FLAVOR` (race name, `content/races.js`/`flavor.js` `RACE_NOTE`), `SUB_FLAVOR` (sub-class, `SUB_NOTE`), `ABILITY_FLAVOR` (ability `id`, `content/abilities.js`), `CHIP_FLAVOR` (chip key). Phase 96 appends rows to `FLAVOR_DOMAINS`; the coverage, no-numbers (per-domain `numberFree` flag, because identity blurbs must still convey good and bad), no-orphan and registry checks need no new code. The tests are table-driven for exactly this reason.
- **Rules layer for 96:** races and sub-classes already have a generated mechanical footer (`identityFooter.js#footerLines`, Hero dossier `heroTab.js:1009-1011`: blurb, then footer lines) pinned by `identity-*`; abilities have `ABILITY_BY_ID[id].txt`; chips have `CONDITION_EXPLAIN` in the classic script (`mazeworld.html:3739`), whose chip tap card is a rail card. `layers({flavor, rules})` only takes strings, so none of these needs the content to move. The rail `rules` line property built for the find card (surface 11) is the chip card's reuse point.
- **Do-not-break for 96:** keep `txt`, `ABILITY_BY_ID[...].txt`, footers and `CONDITION_EXPLAIN` untouched so `identity-*`, `value-*`, `abilities-catalog` keep pinning them; the combat ABILITIES rows carry Phase 94 `state`, which `cbRow`'s wrapper must not disturb (rows without flavour render as today).

## Common Pitfalls

### Pitfall 1: A serialized `flavor` leaks via spread
**What goes wrong:** inline `flavor` on `JEWELRY`/`CLOAKS`/`STAVES`/`BAG_ITEMS` rows is copied onto items by `Object.assign`/spread and saved.
**Why:** `engine/items.js:152,160,168,793`, `engine/character.js:661`, `engine/encounters.js:492,499`; the frozen chargen and economy fixtures deep-compare items.
**How to avoid:** keyed maps; the not-serialized test.
**Warning signs:** a parity or `forced-chargen` failure, `"flavor"` in a saved JSON.

### Pitfall 2: Nested interactive controls
**What goes wrong:** a RULES button inside `button.cb-row`/`button.goods` is invalid HTML and breaks activation.
**How to avoid:** sibling in a wrapper; leave `cbRow` and `renderStoreScreen`'s button untouched; wrap only rows that have flavour.

### Pitfall 3: State lost on repaint
**What goes wrong:** the panel and rail rebuild on every state change, collapsing a revealed RULES line mid-read.
**How to avoid:** module-level Set; flip in place; on toggle do not call render.

### Pitfall 4: Source-pin and CSS-pin tests
**What goes wrong:** pinned source regions fail on any structural edit: `cbRow` (3 files), store region "no `guardTap(`", `renderEncounter` "no panel/body/card onclick", `.cb-sub-list` 206 px cap and `.cb-row` 48 px (`combat-submenu-fit`), every `font-size` scaled (`text-scale.test.js`), `GEAR_COPY` exact literal (`gear-panels.test.js:38`), settings key list.
**How to avoid:** make the smallest change in each pinned region, re-pin deliberately (declare it), run the named test file right after each edit.

### Pitfall 5: Rail card taps
**What goes wrong:** a tap on the find card's toggle is read by `#mw-rail.onclick` (`mazeworld.html:6300`) as a dismiss or a locked-card pulse, or completes the typewriter instead of toggling.
**How to avoid:** add `.mw-rules-btn` to the early-return `closest` list; append the toggle outside `typedTargets`; leave the aria-live text as flavour only.

### Pitfall 6: Registry and review plumbing
**What goes wrong:** unregistered export fails `voice-corpus.test.js`; a ledger without regenerated pages fails `narrative-review.test.js`; the standing scans do not see flavour that is not added to `collectAuthoredStrings`/`hp-not-wp`.
**How to avoid:** pre-register in 95-01; regenerate pages in every flavour plan; iterate `FLAVOR_DOMAINS` in the hand-maintained lists. Do not gate on `--coverage`.

### Pitfall 7: Snapshot churn
**What goes wrong:** moving a fixture in several plans multiplies declared moves and review noise.
**How to avoid:** all flavour content first (invisible, nothing consumes it), then UI plans, each regenerating its own fixtures once with final text.

### Pitfall 8: Content writing traps
Death potion must still warn in words; weapon/armour flavour is per type so enchanted and warded variants share it (do not imply a bonus); Bastard Sword and safety words; "armour" spelling; line length; no number words; flavour must not restate the rules it hides (a joke that says "doubles" or "for a day" is a leak the number test will miss in prose). Use the writer's checklist in Code Examples.

## Code Examples

### Lookup and domain registry (sketch, `src/browser/flavorText.js`)
```js
// Source: derived from engine/derived.js#canonItemText (keys) and content/*.js (maps)
import * as C from "../../content/index.js";

export const FLAVOR_DOMAINS = Object.freeze([
  { id: "spell",  map: C.SPELL_FLAVOR,      rows: () => C.SPELLS.map((s) => s.n),                        rules: (k) => C.SPELLS.find((s) => s.n === k)?.txt },
  { id: "potion", map: C.POTION_FLAVOR,     rows: () => C.POTIONS.map((p) => p.n),                       rules: (k) => C.POTIONS.find((p) => p.n === k)?.txt },
  { id: "tool",   map: C.TOOL_FLAVOR,       rows: () => [...Object.values(C.TOOLS).map((t) => t.n), "Lockpicks"] },
  { id: "bag",    map: C.BAG_FLAVOR,        rows: () => Object.values(C.BAG_ITEMS).map((b) => b.n) },
  { id: "magic",  map: C.MAGIC_ITEM_FLAVOR, rows: () => [...C.JEWELRY, ...C.CLOAKS, ...C.STAVES].map((r) => r.n) },
  { id: "weapon", map: C.WEAPON_FLAVOR,     rows: () => Object.keys(C.WEAPONS) },
  { id: "armor",  map: C.ARMOR_FLAVOR,      rows: () => C.ARMORS.map((a) => a.name) },
]); // map may be undefined until its batch lands; the tests skip such a domain until the gate.

export function flavorOfItem(it) {
  if (!it || typeof it !== "object") return "";
  let hit = null;
  switch (it.kind) {
    case "potion": hit = ["potion", C.POTIONS.find((p) => p.eff === it.eff2)?.n]; break;
    case "jewel": case "cloak": case "staff": hit = ["magic", it.n]; break;
    case "tool": hit = ["tool", C.TOOLS[it.tool]?.n ?? it.n]; break;
    case "picks": hit = ["tool", "Lockpicks"]; break;
    case "bag": hit = ["bag", C.BAG_ITEMS[it.tier]?.n ?? it.n]; break;
    case "weapon": hit = ["weapon", it.base ?? it.n]; break;
    case "armor": hit = ["armor", it.armor ?? it.n]; break;
  }
  const dom = hit && FLAVOR_DOMAINS.find((d) => d.id === hit[0]);
  const line = dom?.map && hit[1] != null ? dom.map[hit[1]] : "";
  return typeof line === "string" ? line : "";
}
export const flavorOfSpell = (name) => (C.SPELL_FLAVOR && C.SPELL_FLAVOR[name]) || "";
```

### Layering rule and toggle (sketch, `src/browser/rulesLayer.js`)
```js
export const RULES_COPY = Object.freeze({ toggle: "RULES", open: "RULES ▾", closed: "RULES ▸", label: "Rules for {name}" });
const open = new Set();            // presentation-only; never on S
let always = false;
export const setAlwaysRules = (on) => { always = on === true; };
export const layers = ({ flavor, rules }) =>
  flavor ? { lead: flavor, rules: rules || "" } : { lead: rules || "", rules: "" };   // no flavour: today's text, no toggle
export function mountRules(doc, host, { id, name, rules }) {
  const line = doc.createElement("p"); line.className = "mw-rules-line"; line.textContent = rules;
  if (always) { host.appendChild(line); return line; }
  const btn = doc.createElement("button"); btn.type = "button"; btn.className = "mw-rules-btn";
  const sync = () => { const on = open.has(id); line.hidden = !on; btn.setAttribute("aria-expanded", String(on)); btn.textContent = on ? RULES_COPY.open : RULES_COPY.closed; };
  btn.setAttribute("aria-label", RULES_COPY.label.replace("{name}", name));
  btn.onclick = (e) => { e?.stopPropagation?.(); open.has(id) ? open.delete(id) : open.add(id); sync(); };   // plain onclick: an inspection, like the fight-log reveal
  sync(); host.append(btn, line); return btn;
}
```

### Settings addition
```js
// src/browser/settings.js  (appended; tolerant merge gives old blobs `false`)
SETTINGS_DEFAULTS = Object.freeze({ /* …12 existing… */ padSide: "right", alwaysRules: false });
ALLOWED_VALUES.alwaysRules = [true, false];
```

### Number-free check (copy the shape per file, do not import across tests)
```js
const WORD_NUM = [/* item-text-engine.test.js:100-111 */];           // minus "one"
const NUMBERISH = new RegExp(String.raw`\d|%|\bd\d|\b(?:${WORDS_WITHOUT_ONE})\b`, "i");
for (const [domain, key, line] of everyFlavour()) assert.ok(!NUMBERISH.test(line), `${domain}/${key}: ${line}`);
```

### Ledger row
```json
{ "key": "bank:SPELL_FLAVOR.Heal", "surface": "spells", "trigger": "a spell's flavour line (Grimoire, combat SPELLS menu)",
  "before": "", "after": "Closes wounds the polite way: quickly, and without asking how you got them.",
  "reasons": ["joke"], "why": "Player line for Heal; the exact rules text is unchanged in content:SPELLS.Heal.txt, behind RULES." }
```

### Flavour writer's checklist (per line)
One sentence, <= 90 characters (guard 100); hints at what the thing does in words ("closes wounds", "everything goes quiet"), never an amount, duration, die, percentage or count (no "twice", "half", "once", "fifty"); deadpan, family-friendly; British spelling "armour"; U+2013 and U+2212 only; different for every entry (a test checks); Death potion still reads as deadly; do not name the niche label; keep a spell's flavour distinguishable from its same-level sibling (Doze vs Stun, Fireball vs Fireballs vs Lightning) so a player can still choose at a glance.

## State of the Art

| Old approach | Current approach | When changed | Impact |
|--------------|------------------|--------------|--------|
| Player text = rules text (`txt` is both) | Two layers: `txt`/stat lines rules, `*_FLAVOR` player | This phase | Guards untouched, players read flavour |
| Item text refreshed on load (Phase 89 plan 09) | Flavour looked up by name, never stored | This phase | No save change |
| Narrative pass registry frozen after 79-01 | Registry extended for the flavour maps and `RULES_COPY` | This phase | README amended |

**Deprecated/outdated:** the todo `2026-10-02-player-facing-descriptions-fantasy-flavor.md` assumed the truth tests "pin the player text and would need to move to the technical layer". With `txt` kept as the rules layer there is nothing to move.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Keyed per-file maps satisfy the locked "a `flavor` field beside `txt`" via Claude's Discretion item 4 (CONTEXT permits "one keyed table per content file") | Standard Stack, Architecture | If the user wants literal inline fields, only SPELLS/POTIONS/TOOLS/WEAPONS/ARMORS rows can take them safely; treasure rows need `dropAuthored` stripping and bags a `bagItemFor` change |
| A2 | Lockpicks are in scope as a tool and get a `TOOL_FLAVOR["Lockpicks"]` entry; the Sealed scroll store line gets `SCROLL_FLAVOR` | Content Inventory | Fewer or more than 111 entries; the gate count pin changes |
| A3 | Length guard 100 chars (writer target 90); number-word ban list = `WORD_NUM` minus "one" | Guards | Too strict blocks natural jokes; too loose lets rules creep back |
| A4 | A 48px RULES strip per row is acceptable in the 206px combat list (side-by-side key is the fallback) | Display Surfaces | Cramped combat menu on the Pixel 7 at text size L; needs device check |
| A5 | The static resist sentence moves into RULES while the live `Target resists on X–Y` hint stays visible | Combat Rows | If the user wants everything behind the tap, move the hint too |
| A6 | Compare/advice lines (`lootCompare` "upgrade", "can't use", store reason, compare line) and the "(usable by …)" suffix are functional and stay visible | Display Surfaces | If they should hide, `lootCompare` and `storeRowState` consumers change |
| A7 | Gear tab rows and cards (sheet openers) show flavour only, with RULES in the Gear sheet; Always ON appends a static rules line to rows | Display Surfaces | If the user wants a toggle on the rows themselves it conflicts with the opener tap |
| A8 | UI plans run after all flavour plans so each fixture moves once | Plan Split | More declared fixture moves if reordered |
| A9 | The drift test runs 2 guards in a temp mirror (~40 s added to the suite) | Guards | Slower suite; could drop to 1 guard |

## Open Questions

1. **Special skills (`content/skills.js`) have no owner.**
   - Known: 24 `txt`/`txt2` rules sentences render in the Hero tab Special skills list (`heroTab.js:995`); neither the Phase 95 nor the Phase 96 text names them (FLAVOR-04 says "ability rows"); ROADMAP Phase 96 criterion 4 ("no description that still reads as a rulebook sentence") would catch them.
   - Recommendation: ask the user to add skills to Phase 96's scope; the same shape applies (`SKILL_FLAVOR`, guard `skill-audit` pins `txt`).
2. **What is the combat row "short functional tag" for spells?**
   - Known: no "d10 hp" tag exists; `cost` is "LVL n" and `nicheLabel` is computed but unprinted.
   - Recommendation: keep `cost`, optionally print `nicheLabel`; add no new numeric tag. Confirm with the user at planning if the "d10 hp" example was literal.
3. **Gear tab rows: toggle on the row, or in the sheet only?** Recommended: sheet (A7). Confirm.
4. **Drop shelf rows** (bounded list of Drop buttons tuned in quick 260928-fcs): flavour plus a per-row toggle, flavour only with rules via Always ON and the Gear tab, or keep the compact stat line as a decision aid? Recommended: flavour lead, RULES via Always ON or the Gear tab, because a 48px strip per row defeats that list's fit work. Needs a user call because it relaxes "RULES on every surface".
5. **Weapon worn-row note:** keep `weaponMundane`/`weaponMagic` voice lines (they contain "+N damage") or show the type flavour? Recommended: show the type flavour and keep the enchantment fact in the sheet stats.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | tests, tools | yes | 22.23.2 | — |
| git | gate diff proofs, scratch copy | yes | present | — |
| Android toolchain / device | not needed for code; device UAT of the combat list at text size L is a human step | not probed | — | human verify at phase end (`human_verify_mode: end-of-phase`) |

No external services. Missing dependencies: none.

Baseline [VERIFIED: prototype]: a full `node --test` in a `git archive` copy gave 10,283 tests, 10,273 pass, 1 fail (`MAP-09 … unchanged from HEAD`, needs a `.git` directory, so it is an artefact of the copy), 9 skipped; on the real tree CONTEXT's baseline is 10,283 / 10,275 pass / 0 fail / 8 skipped. A full run took about 3.5 minutes historically and 20 minutes under contention.

## Test Commands (Question 9)

Nyquist validation is disabled in `.planning/config.json`, so no formal validation-architecture table; the commands:

| Purpose | Command |
|---------|---------|
| Full suite (gate) | `cd C:/projects/mazeworld && npm test` (baseline 10,283 / 10,275 pass / 0 fail / 8 skipped; expect roughly +30 to +40 tests) |
| Quick tiers | `npm run test:quick` |
| Unchanged v2.3 guards | `node --test test/unit/item-text-engine.test.js test/unit/item-text-wording.test.js test/unit/item-text-refresh.test.js test/unit/item-audit.test.js test/unit/item-audit-fixes.test.js test/unit/spell-audit.test.js test/unit/spell-skill-text-engine.test.js test/unit/spell-skill-text-wording.test.js test/unit/spell-skill-audit-fixes.test.js test/unit/skill-audit.test.js test/unit/authored-ranges.test.js test/unit/value-identity.test.js test/unit/value-text.test.js test/unit/value-abilities.test.js test/unit/value-ledger.test.js test/unit/value-cleanup.test.js test/unit/identity-text.test.js test/unit/identity-audit.test.js` |
| Voice and review | `node --test test/unit/voice-corpus.test.js test/unit/narrative-review.test.js test/voice/narrative-hygiene.test.js test/voice/safety-scan.test.js test/unit/hp-not-wp.test.js test/unit/stale-terms.test.js test/unit/roll-sign-consistency.test.js` |
| Voice CLI | `node tools/voice-inventory.mjs --roll-under --hygiene --safety --count` (must print 0); `node tools/voice-inventory.mjs --check-ledgers --after`; `node tools/voice-inventory.mjs --key 'bank:SPELL_FLAVOR*'`; regenerate pages `node tools/narrative-review.mjs` |
| Snapshots | `node --test test/unit/shell-tab-snapshots.test.js` (compare); `MZ_SNAPSHOT_UPDATE=1 node --test test/unit/shell-tab-snapshots.test.js` (write, then `git diff --stat` to confirm only declared fixtures moved) |
| Settings and bridge | `node --test test/unit/settings.test.js test/unit/dressing-shell.test.js test/unit/bridge-registry.test.js`; `node tools/bridge-doc.mjs --write` after adding `__mzRules` to `src/browser/bridge.js` |
| Surface sweeps | combat: `node --test test/unit/combatMenu.test.js test/unit/combat-submenu-fit.test.js test/unit/shell-combat-actions.test.js test/unit/shell-input-guards.test.js test/unit/ability-state-a11y.test.js`; gear: `node --test test/unit/gear-tab-dom.test.js test/unit/gear-sheet-dom.test.js test/unit/gear-sheet-shell.test.js test/unit/gear-sheet-model.test.js test/unit/gear-view-models.test.js test/unit/gear-panels.test.js test/unit/scroll-read-surfaces.test.js test/unit/staff-surfaces.test.js`; store and find: `node --test test/unit/store-rows.test.js test/unit/storeScreen.test.js test/unit/find-card-scroll-rows.test.js test/unit/find-card-full-bag.test.js test/unit/shell-loot-screen.test.js test/unit/shell-map-rail.test.js test/unit/lootCompare.test.js`; hero: `node --test test/unit/heroTab.test.js test/unit/grimoireViewModel.test.js` |
| Not-serialized and parity | `node --test test/roundtrip test/determinism test/parity` (should be untouched: zero engine bytes) |
| CSS and shell pins | `node --test test/unit/text-scale.test.js test/unit/account-layout.test.js test/unit/shell-no-content-copies.test.js` |

Windows note: `node --test <dir>` mis-reports a directory argument as one failing test (reproduced); use file globs or `npm run test:quick`. Project conventions (memory): commits carry the `Co-Authored-By` and `Claude-Session` trailers and are never amended; `gsd-tools query commit` needs the trailers inside the message; verifier, plan-check and code-review agents are off, so the orchestrator writes VERIFICATION.md.

## Plan Split (Question 10)

Executors run sequentially on the main tree; waves below have **no `files_modified` overlap within a wave**. The flavour plans are one per wave only because each regenerates the two shared generated pages (`docs/NARRATIVE-PASS.md`, `docs/narrative-pass/review.html`); the planner may merge them in pairs if it accepts one regeneration per pair. UI plans come after all flavour so each fixture moves once.

| Wave | Plan | Scope | files_modified (principal) |
|------|------|-------|----------------------------|
| 1 | 95-01 Data shape, lookup, registry and guards | `flavorText.js` + `FLAVOR_DOMAINS`; pre-register all nine banks in the voice registry; extend `safety-scan` and `hp-not-wp` lists by iterating domains; README amendment; new tests (coverage, no-numbers, no-orphan, not-serialized, drift); `docs/TEXT-LAYERS.md` | `src/browser/flavorText.js`, `tools/lib/voice-corpus.mjs`, `docs/narrative-pass/README.md`, `test/voice/safety-scan.test.js`, `test/unit/hp-not-wp.test.js`, `test/unit/flavor-layer.test.js`, `test/unit/flavor-drift.test.js`, `test/roundtrip/flavor-not-serialized.test.js`, `docs/TEXT-LAYERS.md` |
| 1 | 95-02 RULES component and the setting | `rulesLayer.js` (`RULES_COPY`, `layers`, `mountRules`, expanded Set, `setAlwaysRules`), `settings.js` + `settings.test.js`, Settings row + `.mw-rules-*` CSS + `applySettings` hook + `window.__mzRules` bridge in `mazeworld.html`, `bridge.js`, `docs/SHELL-MODULES.md`, unit tests | `src/browser/rulesLayer.js`, `src/browser/settings.js`, `src/browser/bridge.js`, `mazeworld.html`, `docs/SHELL-MODULES.md`, `test/unit/settings.test.js`, `test/unit/rules-layer.test.js` |
| 2 | 95-03 Flavour: spells and scroll (42) | `SPELL_FLAVOR`, `SCROLL_FLAVOR`; ledger; pages | `content/spells.js`, `docs/narrative-pass/why/95-03.json`, `docs/NARRATIVE-PASS.md`, `docs/narrative-pass/review.html` |
| 3 | 95-04 Flavour: potions, tools incl. lockpicks, bags (17) | `POTION_FLAVOR`, `TOOL_FLAVOR`, `BAG_FLAVOR` | `content/potions.js`, `content/tools.js`, `content/bags.js`, ledger `95-04.json`, pages |
| 4 | 95-05 Flavour: magic items (23) | `MAGIC_ITEM_FLAVOR` | `content/treasure-tables.js`, ledger `95-05.json`, pages |
| 5 | 95-06 Flavour: weapons and armour (29) | `WEAPON_FLAVOR`, `ARMOR_FLAVOR`; (Phase 96's batch shape template) | `content/weapons.js`, `content/armors.js`, ledger `95-06.json`, pages |
| 6 | 95-07 UI: Hero grimoire and combat SPELLS/ITEMS rows | `heroTab.js` flavour + toggle; `combatMenu.js` additive `flavor` on rows; `renderActionArea` wrapper (cbRow untouched); `#cb-act` lock CSS; declared re-pins; regenerate `mu.hero` | `src/browser/heroTab.js`, `src/browser/combatMenu.js`, `mazeworld.html`, `test/unit/combatMenu.test.js`, `test/unit/combat-submenu-fit.test.js`, `test/unit/shell-combat-actions.test.js`, `test/unit/shell-input-guards.test.js`, `test/unit/shell-tab-snapshots.test.js`, `test/unit/fixtures/shell-snapshots/mu.hero.txt` |
| 7 | 95-08 UI: Gear tab, Gear sheet, consumables | `gearTab.js` renderers (flavour lead, static rules when Always), `gearSheet.js` model `flavor` + toggle around `stats`; regenerate `thief.gear`, `mu.gear`, both `gear-sheet-*` | `src/browser/gearTab.js`, `src/browser/gearSheet.js`, gear tests, `shell-tab-snapshots.test.js`, four fixtures |
| 8 | 95-09 UI: store, sell/loot list, drop shelf, find card | `storeScreen.js` wrapper rows; `renderCarriedList` toggle; `renderDropShelf`; find card `rules` line + rail `onclick` exclusion; regenerate both store fixtures | `src/browser/storeScreen.js`, `src/browser/gearTab.js` (`renderCarriedList` only: the sell and loot list; 95-08 in the previous wave owns `renderGearTab` and the models), `mazeworld.html`, store/find/loot tests, two store fixtures |
| 9 | 95-10 Gate | flip the coverage test to "all 8 domains, 111 entries"; the "guard files unchanged" diff proof and audit row counts; `docs/patch-notes/2.4.0.md` bullets; `docs/TEXT-LAYERS.md` final; final page regeneration; full `npm test`; list the human UAT items (device walk of every surface at text size L, narrative page review) | `docs/patch-notes/2.4.0.md`, `docs/TEXT-LAYERS.md`, `test/unit/flavor-layer.test.js`, pages |

Within each UI plan, wire a surface, then run that surface's sweep command (Test Commands) and re-pin deliberately. If the planner prefers fewer waves it can fold 95-03..95-06 into two plans and 95-07..95-09 into two, at the cost of larger plans.

## Sources

### Primary (HIGH confidence, read this session)
- `C:\projects\mazeworld\.planning\phases\95-…\95-CONTEXT.md`, `.planning\REQUIREMENTS.md`, `.planning\ROADMAP.md` (Phases 95, 96), the pending todo, `.claude\CLAUDE.md`, `.planning\config.json`, `STATE.md` Ground Truth
- Content: `content/spells.js`, `potions.js`, `tools.js`, `bags.js`, `treasure-tables.js`, `weapons.js`, `armors.js`, `foods.js`, `flavor.js`, `identity.js`, `safety-wordlist.js`
- Engine (read only): `engine/items.js`, `economy.js`, `derived.js` (`canonItemText`), `saveState.js` (`refreshItemTexts`), `character.js`, `encounters.js`
- Shell: `src/browser/gearTab.js`, `gearSheet.js`, `viewModels.js`, `combatMenu.js`, `heroTab.js`, `storeScreen.js`, `settings.js`, `rail.js`, `bridge.js`, `uiTap.js`, `mazeworld.html` (cbRow, renderActionArea, renderDropShelf, find card, renderRail, rail onclick, beatHurryTap, guardTap, settings rows and handler, applySettings)
- Tests and tools: `item-text-engine`, `spell-skill-text-engine`, `authored-ranges`, `combatMenu`, `combat-submenu-fit`, `shell-input-guards`, `settings`, `dressing-shell`, `shell-tab-snapshots`, `voice-corpus`, `narrative-review`, `narrative-hygiene`, `safety-scan`, `hp-not-wp`, `stale-terms`, `shell-no-content-copies`; `tools/lib/voice-corpus.mjs`, `voice-checks.mjs`, `tools/voice-inventory.mjs`, `tools/narrative-review.mjs`, `docs/narrative-pass/README.md`, `docs/patch-notes/2.4.0.md`

### Secondary / experiments (MEDIUM, reproduced in `…\scratchpad\mw` and `…\scratchpad\drift`, never in the project)
- Registry completeness, ledger validation and page regeneration flow; drift-in-child-process mutation test; full-suite baseline in a `git archive` copy.

### Tertiary (LOW)
- None. No web sources were needed; the phase has no external dependency.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH (no new packages; patterns exist in-tree)
- Architecture (keyed maps, additive fields, lookup): HIGH (spread sites verified by grep)
- Display surface wiring: MEDIUM (renderer facts are exact; layout choices need device review)
- Guards and voice tooling: HIGH (flow reproduced end to end)
- Pitfalls: HIGH

**Research date:** 2026-10-03
**Valid until:** 2026-11-02 (stable code; re-check line numbers if Phase 96 or hotfixes touch `mazeworld.html` first)

Security domain: omitted, `security_enforcement` is `false` in `.planning/config.json`. Validation Architecture: omitted, `workflow.nyquist_validation` is `false`.
