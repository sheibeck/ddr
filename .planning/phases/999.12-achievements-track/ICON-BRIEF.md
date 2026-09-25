# Task: Generate the achievement icon set for Mazeworld

> Hand-off brief for an image-generation agent. Written 2026-09-25 from the 999.12 inventory in `.planning/ROADMAP.md`. Tier thresholds are not final; files are named by tier number so thresholds can change without new art.

You are producing the complete achievement icon set for **Mazeworld**. It's a paid, offline Android roguelike dungeon crawler with a sarcastic, deadpan, **family-friendly** voice: dark humor, but no gore, blood, profanity or adult content. The icons will be uploaded to Google Play Games Services and also shown in the game's own achievement list.

## Art style (match the existing game icons exactly)

The game's existing icons (a treasure chest, a triangular stone stairwell, a skull and crossbones, and a party of adventurers) share this style:

- **High-resolution pixel art**, like a polished 16-bit fantasy RPG. The pixels are visible but the detail is rich.
- **Dark outline** (near-black, 1–2 art-pixels thick) around the whole subject.
- **Warm, earthy palette:** aged wood browns, weathered bronze and brass, bone ivory, sandstone. Lighting is warm and comes from the upper left, with strong highlights and deep shadows.
- **One centered subject** that fills about 75% of the frame, drawn front-on or at a slight ¾ angle. No scenery, no ground plane, no text.
- **Transparent background** on the master art. Special or "big deal" subjects can have a soft golden glow behind them, like the existing party icon.
- **Readable at 64 px.** Every icon must work as a small thumbnail, so favor a strong silhouette over fine detail.
- **Humor comes from the subject, not from gore.** Think "cartoon peril": skulls are cute-spooky, and monsters look goofy-menacing.

Reference files in the repo (if you have access): `icons/chest.png`, `icons/descent.png`, `icons/party.png`, `icons/optimized/set_dungeon_skull_crossbones.png` (1254×1254 RGBA masters; 144×144 optimized copies).

Before starting, generate one test icon (use `ach_fully_dressed`) and check it against the style list above. Then keep every icon consistent with that test.

## Output spec

For every icon, produce three files:

| Folder | Size | Background | Use |
|---|---|---|---|
| `achievements/master/` | 1254×1254 (or the largest your tool gives) | transparent | source art |
| `achievements/play/` | 512×512 PNG | **opaque**: dark parchment-brown `#2a1f17` with a subtle vignette | Play Console upload |
| `achievements/ingame/` | 144×144 PNG | transparent | in-game list |

- **Circle safe zone:** Play Games may display icons cropped to a circle. Keep everything important inside a centered circle that is 85% of the canvas width.
- **Locked versions:** don't make greyscale "locked" versions. Play Games generates them automatically.
- **File names:** snake_case, `ach_<id>.png`. Tiered icons get `ach_<id>_t1.png` … `ach_<id>_t4.png`. Name tiers by **tier number, never by threshold** (use `_t2`, not `_100`), because the thresholds aren't final yet.

## Tiers: draw once, frame programmatically

Many achievements come in tiers (for example, die 50 / 100 / 200 / 500 times). **Do not redraw the art for each tier.** Instead:

1. Draw the base picture once, as a master.
2. Build **4 tier frames** once, as transparent overlays: a circular pixel-art border ring that stays inside the circle safe zone. Each ring has a small gem at the bottom and a Roman numeral plaque.
   - T1: bronze ring, numeral I
   - T2: silver ring, numeral II
   - T3: gold ring, numeral III
   - T4: "mythic" ring (iridescent violet-teal), numeral IV
3. **Composite** each tier file with a script (Pillow or ImageMagick): base art, scaled to about 80%, layered under the frame. Draw the numerals as pixel art or composite them in code. **Never let the image model render text or numerals.** The numerals are there so tiers aren't told apart by color alone.
4. Achievements that aren't tiered get **no frame**, only the base art.

## The icon list (REQUIRED: 29 base pictures → 49 icon files)

Each row gives the id, the display name, what unlocks it, and a visual concept. Treat the concept as a starting point and make it funny.

### Depth

| id | Name | Unlock | Tiers | Visual concept |
|---|---|---|---|---|
| `depth` | Depth 5 / 10 / 15 | Reach floor 5, 10, 15 | **3** (t1–t3: bronze/silver/gold) | A triangular stone stairwell descending into warm orange darkness, with a tiny torch far below. Must feel like a sibling of the game's existing "descent" icon. |
| `unicorn` | Unicorn! | Reach floor 20 (the near-impossible ceiling) | none | A smug, radiant pixel unicorn standing at the bottom of a dungeon stairwell, rainbow mane, heavy golden glow. The rarest icon in the set, so make it look it. |

### Gear and self-restraint

| id | Name | Unlock | Tiers | Visual concept |
|---|---|---|---|---|
| `fully_dressed` | Fully Dressed | An item in every equipment slot at once | none | An overstuffed adventurer's outfit: helmet, armor, shield, weapon, boots, all slightly mismatched, ready to topple. |
| `naked_ambition` | Naked Ambition | Reach floor 5 with nothing equipped | none | An empty wooden barrel with suspenders, bravely descending the stairs. Family-friendly: only the barrel shows. |
| `teetotaler` | Teetotaler | Reach floor 5 without drinking a healing potion | none | A red healing potion with the cork firmly in, a tiny "no" ribbon tied around it, gathering cobwebs. |
| `read_the_label` | Read the Label | Drink the Death potion (its label famously reads "your dead!") | none | A black potion bottle with a cartoon skull label, knocked over and dripping, with a single "oops" sweat drop floating nearby. Cute-spooky, not grim. |

### Dying (a lot)

| id | Name | Unlock | Tiers | Visual concept |
|---|---|---|---|---|
| `frequent_flier` | Frequent Flier | Die 50 / 100 / 200 / 500 times across all runs | **4** | A tombstone wearing a winged "frequent flier" pin, or a stack of tombstones with a loyalty-card punch-card leaning on it. |
| `special_snowflake` | Special Snowflake | Die on floor 1 | none | A single ornate snowflake resting on a tiny tombstone, shimmering, very pleased with itself. |

### Body counts: kill 100 of each monster group (6 base pictures, no tiers for now)

| id | Name | Visual concept (the group's real monsters, for flavor) |
|---|---|---|
| `kills_beasts` | Body Count: Beasts | A cave-bear skull trophy on a plaque (Bat/Rat, Cave Bear, Drake) |
| `kills_demons` | Body Count: Demons | A little horned gremlin's pitchfork snapped in two (Gremlin, Poltergeist, Djinni) |
| `kills_humans` | Body Count: Humans | A pile of dropped bandit hoods and dented helmets (the humans are named things like Ned, Frank and Craig) |
| `kills_lair_beasts` | Body Count: Lair Beasts | A lumpy, many-toothed lair-monster's trophy head, goofy rather than scary (Dog Face, Blumble, Drarl) |
| `kills_magical` | Body Count: Magical | A cracked crystal orb leaking a puff of shadow (Shadow, Werebeast, Drudge) |
| `kills_walking_dead` | Body Count: Walking Dead | A cartoon zombie hand poking from a grave, now waving a tiny white flag (Ghoul, Bones, Vampire) |

### Every race: reach floor 5 with each race (6 base pictures)

Draw a **portrait bust** of each race wearing the same bronze "floor 5" medallion, so the six read as a set.

| id | Race | Concept |
|---|---|---|
| `race_human` | Human | Ordinary, slightly overconfident adventurer. |
| `race_elven` | Elven | Pointed ears, serene, faintly condescending. |
| `race_dwarven` | Dwarven | Magnificent braided beard, iron helm. |
| `race_wilmsry` | Wilmsry | *Invented race.* Heals twice as fast, learns half as fast: covered in bandages and grinning, cheerfully dim. Wizards despise them on sight, and they're proud of it. |
| `race_fridgian` | Fridgian | *Invented race.* Icy, Norse-flavored berserker. Frost-rimed thick hide instead of armor, wild eyes, icicles in the beard. |
| `race_troll` | Troll | Big tusked grin, mossy skin, a club over the shoulder. |

### Every class: reach floor 5 with each parent class (3 base pictures)

| id | Class | Concept |
|---|---|---|
| `class_magic_user` | Magic User | Pointy wizard hat with a staff crossed behind it, sparkles. |
| `class_fighter` | Fighter | Dented shield with a notched sword crossed behind it. |
| `class_thief` | Thief | Hooded mask with a coin purse and lockpicks. |

### Everything else

| id | Name | Unlock | Tiers | Visual concept |
|---|---|---|---|---|
| `tourist` | Tourist | Start a run with every one of the 24 sub-classes | none | A camera-and-sun-hat tourist silhouette holding a map covered in 24 little stamps. |
| `survivor` | Survivor | Live X days in a single run | **4** | A tally-marked dungeon wall with a half-burned candle. |
| `hoarder` | Hoarder | Gain X coin | **4** | An overflowing coin pile with a dragon-style "mine" sign stuck in it. |
| `party_animal` | Party Animal | Accept X Joiners across all delves | **4** | A party hat perched on a helmet, confetti, a tankard. |
| `human_shields` | Human Shields | X of your Joiners have died in your service | **4** | A row of dented shields with little name tags, the front one visibly worried. |
| `disposable_help` | Disposable Help | X of your summons have died | **4** | A summoning circle with a tiny "out to lunch, permanently" puff of smoke. |

**Required count check:** 29 base pictures + 4 tier frames → **49** files in each output folder (depth ×3, unicorn, fully_dressed, naked_ambition, teetotaler, read_the_label, frequent_flier ×4, special_snowflake, kills ×6, races ×6, classes ×3, tourist, survivor ×4, hoarder ×4, party_animal ×4, human_shields ×4, disposable_help ×4).

## OPTIONAL set (skip unless told "include optional")

These are proposed but not approved. If included, use the same rules (tiered = 4 frames):

- **Not tiered:** `well_rounded` (die of every cause) · `just_one_more_bite` (died from overeating) · `friendly_fire` (your own spell backfired) · `read_the_fine_print` (killed by your own summon) · `buried_talent` (entombed) · `poor_aim` (teleported into trouble) · `cant_take_it_with_you` (died rich) · `saving_it_for_later` (died holding an unused healing potion) · `speedrun` (died in the first few steps) · `diplomatic_incident` (insulted a foe mid-negotiation) · `riveting_company` (a foe got bored and left) · `its_not_you_its_me` (dismissed a Joiner) · `fairy_godmother` (faerie blessing) · `fairy_godmugger` (faerie curse) · `just_a_flesh_wound` (won a fight on 1 HP)
- **Tiered ×4:** `tactical_retreat` (fled X times) · `tripwire_connoisseur` (sprang X traps) · `bomb_squad` (disarmed X traps) · `get_off_my_lawn` (turned X undead) · `cartographer` (fully mapped X floors) · `collected_neuroses` (gained X phobias) · `fashion_victim` (X armor pieces destroyed) · `retail_therapy` (spent X coin at the store)

## Deliverables

1. The `achievements/master/`, `play/` and `ingame/` folders, **49 files each**, named exactly as above.
2. `achievements/frames/`: the 4 tier-frame overlays (transparent, 1254 px).
3. The compositing/export script you used, so tiers can be regenerated when thresholds change.
4. `achievements/contact_sheet.png`: every icon from `ingame/` in a labeled grid, with the tiers of each achievement side by side.
5. `achievements/manifest.json`: an array of `{ id, name, tier, file_play, file_ingame }`.

## Self-check before you finish

- [ ] 49 files in each output folder, and the names match the list exactly.
- [ ] The whole set looks like one family: same outline weight, light direction and palette as the test icon.
- [ ] Each icon is recognizable at 64 px, and nothing important sits outside the 85% circle.
- [ ] Tiers are told apart by frame **and** numeral, and all tiers of one achievement use identical base art.
- [ ] No image-model text anywhere, no gore or blood, nothing a parent would flinch at.
- [ ] `play/` files are opaque 512×512, and `ingame/` files are transparent 144×144.
- [ ] Unicorn clearly reads as the rarest, most glorious icon in the set.
