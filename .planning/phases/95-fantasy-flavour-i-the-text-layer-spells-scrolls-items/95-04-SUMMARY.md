---
phase: 95-fantasy-flavour-i-the-text-layer-spells-scrolls-items
plan: 04
subsystem: content text layer (player flavour lines for magic items, weapon types, armour types)
tags: [flavour, text-layer, jewels, cloaks, staves, weapons, armour, narrative-ledger]
requires:
  - phase: 95-01
    provides: flavorText.js domain registry, flavor-layer guards, pre-registered voice-corpus banks
  - phase: 95-03
    provides: the 59 spell, scroll, potion, tool and bag lines (uniqueness and voice reference)
provides:
  - MAGIC_ITEM_FLAVOR (23 keys) in content/treasure-tables.js
  - WEAPON_FLAVOR (24 keys) in content/weapons.js
  - ARMOR_FLAVOR (5 keys) in content/armors.js
  - docs/narrative-pass/why/y-95-04.json (52 new-line ledger rows) and the regenerated review page (990 rows)
affects: [95-05, 95-06, 95-07, 95-08]
tech-stack:
  added: []
  patterns: [keyed frozen flavour map beside each content table, one line per weapon or armour type shared by its variants through base]
key-files:
  created:
    - docs/narrative-pass/why/y-95-04.json
  modified:
    - content/treasure-tables.js
    - content/weapons.js
    - content/armors.js
    - docs/NARRATIVE-PASS.md
    - docs/narrative-pass/review.html
key-decisions:
  - "Weapon and armour lines hint at heft, speed, temper and who wears the thing, never at a bonus, a name or magic, so a premium blade or warded piece reads true with its type's line."
  - "Magic-item lines never restate a duration, charge count or amount; each stays distinct from its cross-domain sibling spell or potion by using a different picture."
requirements-completed: []
status: complete
duration: ~40 min
completed: 2026-10-03
---

# Phase 95 Plan 04: Magic item, weapon and armour flavour Summary

52 player-layer lines (23 jewels, cloaks and staves, 24 weapon types, 5 armour types) written as frozen keyed exports beside their content tables, ledgered as new lines and listed on the regenerated narrative review page. The flavour layer is now complete at 111 lines across eight domains; nothing on screen changes until the UI plans, because no surface reads these maps yet.

## Tasks and commits

| Task | Commit | What |
| --- | --- | --- |
| 1. Magic-item flavour (23 lines) | 62494c20 | `MAGIC_ITEM_FLAVOR` appended to `content/treasure-tables.js` (CRLF kept); never inline on JEWELRY_ROWS, CLOAKS_ROWS or STAVES_ROWS |
| 2. Weapon and armour flavour (29 lines) | 0738a870 | `WEAPON_FLAVOR` appended to `content/weapons.js` (CRLF kept) and `ARMOR_FLAVOR` to `content/armors.js` (LF kept) |
| 3. Ledger and regenerate the review page | cfb4a32c | `docs/narrative-pass/why/y-95-04.json` (52 rows, generated from the live exports by a scratchpad script, not committed), `docs/NARRATIVE-PASS.md`, `docs/narrative-pass/review.html` |

## The 52 lines (map, key, line, characters)

Longest line: 90 characters (Morning Star); every line is at or under 90.

| Map | Key | Line | Chars |
| --- | --- | --- | --- |
| MAGIC_ITEM_FLAVOR | Ring of Power | Puts a little extra spite into every swing for a while, then needs a lie-down. | 78 |
| MAGIC_ITEM_FLAVOR | Gauntlet of the Giant | A glove with ambitions: you grow, hit harder, and become far easier to aim at. | 78 |
| MAGIC_ITEM_FLAVOR | Amulet of Light | A pocket sunrise: the dark backs off for a good while, then the amulet holds a grudge. | 86 |
| MAGIC_ITEM_FLAVOR | Pendant of Fortitude | Softens a blow into a mere insult, though it wants a long rest between favours. | 79 |
| MAGIC_ITEM_FLAVOR | Anklet of Invisibility | Makes you a little easy to overlook, so foes aim badly until the effect lapses. | 79 |
| MAGIC_ITEM_FLAVOR | Helm of Knowledge | Lends you the gift of the gab, so Humans, Demons and Beasts may let you finish talking. | 87 |
| MAGIC_ITEM_FLAVOR | Bracelet of Flight | A bangle that waives gravity for a short flight, then reinstates it without warning. | 84 |
| MAGIC_ITEM_FLAVOR | Amulet of Stone | Gives several foes a look so cold they set solid, unless they have the nerve to resist. | 87 |
| MAGIC_ITEM_FLAVOR | Cloak of Strength | Strength in name only: it keeps a foe's luckiest strike from hurting you any extra. | 83 |
| MAGIC_ITEM_FLAVOR | Cloak of Invisibility | A proper vanishing act that leaves foes hitting you purely by accident, now and then. | 85 |
| MAGIC_ITEM_FLAVOR | Cloak of Speed | Stitched by a tailor in a hurry: you get swings in while the foe is clearing its throat. | 88 |
| MAGIC_ITEM_FLAVOR | Cloak of Regeneration | Tucks you in with a quick patch-up, then fusses over you every few steps until it tires. | 88 |
| MAGIC_ITEM_FLAVOR | Cloak of Armor | Wears like silk and turns blows like plate, whatever you do for a living. | 73 |
| MAGIC_ITEM_FLAVOR | Cloak of Flying | Billows dramatically and lifts you over obstacles for a while, then drops the subject. | 86 |
| MAGIC_ITEM_FLAVOR | Cloak of Ether | Makes walls a polite suggestion for a short while, so mind where you are when it ends. | 86 |
| MAGIC_ITEM_FLAVOR | Rowan Staff | Raises a dome around you that swallows blows until it has had quite enough. | 75 |
| MAGIC_ITEM_FLAVOR | Birch Staff | Breathes frost on the nearest foes, who stand around stiff and cross until they thaw. | 85 |
| MAGIC_ITEM_FLAVOR | Walnut Staff | Drains the fight from every foe in the room, who then swing feebly and mostly miss. | 83 |
| MAGIC_ITEM_FLAVOR | Oak Staff | Sends a rumble of bad geology at the foes it picks, who set solid unless they dodge it. | 87 |
| MAGIC_ITEM_FLAVOR | Crystal Staff | Sweeps a veil over the whole party, so everyone becomes a rumour and foes mostly flail. | 87 |
| MAGIC_ITEM_FLAVOR | Poplar Staff | Hands out first aid to you and every Joiner, like a very small and very kind hospital. | 86 |
| MAGIC_ITEM_FLAVOR | Pine Staff | Hands each foe in turn a fireball that needs no aiming and comes with no apology. | 81 |
| MAGIC_ITEM_FLAVOR | Cedar Staff | Puffs out a drowsy fog that packs foes off to bed for the fight, if they let it. | 80 |
| WEAPON_FLAVOR | Axe | A woodcutter's tool pressed into service, with all the subtlety that implies. | 77 |
| WEAPON_FLAVOR | Bastard Sword | Too big for polite company and too clumsy for a duel, but it hits hard when it lands. | 85 |
| WEAPON_FLAVOR | Battle Axe | An axe that has taken up weightlifting: slow to bring round, and ruinous when it arrives. | 89 |
| WEAPON_FLAVOR | Broadsword | A broad, dependable blade that settles most arguments without any fancy footwork. | 81 |
| WEAPON_FLAVOR | Claymore | A big sword from the highlands, long on reach and just as long on opinions. | 75 |
| WEAPON_FLAVOR | Dagger | A small, quick blade: more sting than damage, but it has a gift for finding gaps. | 81 |
| WEAPON_FLAVOR | Katana | A slim, quick blade with an edge so keen it makes its point before the argument starts. | 87 |
| WEAPON_FLAVOR | Kopesh Sword | An ancient sickle-shaped blade, awkward to swing but dreadfully rude when it connects. | 86 |
| WEAPON_FLAVOR | Long Sword | The sword everyone pictures first: balanced, dependable and far too polite to boast. | 84 |
| WEAPON_FLAVOR | Ninja-to | Straight, swift and quiet, favoured by people who would rather not be introduced. | 81 |
| WEAPON_FLAVOR | Rapier | A slender duelling blade, quick to find its mark and fond of an elegant insult. | 79 |
| WEAPON_FLAVOR | Short Sword | A handy blade for tight corridors, simple enough that even wizards hold it correctly. | 85 |
| WEAPON_FLAVOR | Wakazashi | The katana's little sibling, quick and keen, and happy to share a cramped corridor. | 83 |
| WEAPON_FLAVOR | Club | A lump of wood with strong opinions and absolutely no finesse. | 62 |
| WEAPON_FLAVOR | Flail | A weighty ball on a chain: hard to aim, impossible to ignore, and rude on arrival. | 82 |
| WEAPON_FLAVOR | Mace | A heavy, flanged cudgel that makes dents in armour and arguments alike. | 71 |
| WEAPON_FLAVOR | Morning Star | A cheerful name for a spiked ball on a stick, which is neither cheerful nor easy to swing. | 90 |
| WEAPON_FLAVOR | Quarter Staff | A plain, long stick: reliable, cheap, and good for walking, poking and the odd argument. | 88 |
| WEAPON_FLAVOR | Spiked Staff | Take a staff, add spikes, regret the balance: it hits hard but is awkward to bring round. | 89 |
| WEAPON_FLAVOR | Whip | More crack than punch: it hits easily, hurts a little and mostly makes a point. | 79 |
| WEAPON_FLAVOR | Awl Pike | A pole with a sharp end and plenty of heft, so it wants room, patience and a clear aisle. | 89 |
| WEAPON_FLAVOR | Bardiche | A pole axe so big and slow that hitting anything is the hard part, and the rest is easy. | 88 |
| WEAPON_FLAVOR | Naganita | A curved blade on a long pole: elegant for the practised, and a menace to everyone else. | 88 |
| WEAPON_FLAVOR | Spear | The original point-first argument: long reach, simple manners and few moving parts. | 83 |
| ARMOR_FLAVOR | Cloth | Soft and light enough for any adventurer, and it stops about as much as a stern look. | 85 |
| ARMOR_FLAVOR | Leather | Supple hide that creaks, smells faintly of cow and turns the odd glancing blow. | 79 |
| ARMOR_FLAVOR | Studded | Leather with metal studs added for confidence, and a little extra weight to go with it. | 87 |
| ARMOR_FLAVOR | Mail | A jingling shirt of linked rings: sturdy, heavy and best left to fighters. | 74 |
| ARMOR_FLAVOR | Plate | Gleaming metal head to toe: superb protection and all the grace of a falling wardrobe. | 86 |

## Lines the writer's rules made hard

- **Number words hide in idioms.** "At once" (Crystal Staff, Cloak of Regeneration's own rules text) and "double-edged" are both banned by the guard's `once` and `double` entries, so the lines say "so everyone becomes a rumour" and "every few steps" instead; Cloak of Speed says "get swings in" rather than a count; Oak and Amulet of Stone say "the foes it picks" and "several foes" rather than a number.
- **Cross-domain siblings.** Fly (a rumour of walls and gaps) versus Bracelet of Flight (gravity waived and reinstated) versus Cloak of Flying (billows, then drops the subject); the Invisible potion (swing at where you used to be) versus Anklet (easy to overlook), Cloak (hit only by accident) and Crystal Staff (the whole party becomes a rumour); Petrify (garden statuary) versus Amulet of Stone (a look so cold foes set solid) versus Oak Staff (bad geology); Doze (lullaby) versus Cedar Staff (a drowsy fog and bed); Fireballs (scattered volley) versus Pine Staff (a fireball for each foe in turn).
- **Cloak of Strength is not about strength.** Its rules text is a critical-hit ward, so the line says so ("Strength in name only") instead of misleading a player who reads the name.
- **Weapon variants.** No weapon or armour line says "plain", "ordinary" or "enchanted", so "Whisper, a long sword" and "Warded plate" read true with their type's line. The Bastard Sword line avoids the allowlisted word.
- **Clumsy versus keen.** Heavy types (Battle Axe, Kopesh Sword, Flail, Mace, Morning Star, Spiked Staff, Awl Pike, Naganita, Bardiche) say awkward or slow; keen types (Dagger, Katana, Ninja-to, Rapier, Wakazashi) say quick; the Whip says it hits easily but little. Bardiche is the hardest to land and says so.
- **Hint, not leak.** Pendant, Ring, Gauntlet and the cloaks hint at the use-then-rest rhythm ("needs a lie-down", "wants a long rest") without a duration; no staff line mentions charges.

## Verification results

- `npm test` (full): tests 10355, pass 10347, fail 0, skipped 8, duration about 309 s. (Skipped went from 20 at 95-03 to 8: the flavour-layer per-domain tests for the three new maps are now live.)
- Task 1 verify (13 test files): pass, fail 0; Task 2 verify (13 test files): tests 210, pass 210, fail 0. `node tools/voice-inventory.mjs --roll-under --hygiene --safety --count` prints `0` after each task.
- `everyFlavorLine().length` is 111; `MAGIC_ITEM_FLAVOR` keys match JEWELRY, CLOAKS then STAVES in order, are frozen, and no JEWELRY row has a `flavor` field.
- `node tools/voice-inventory.mjs --check-ledgers --after`: 61 ledger files, 0 errors. `node tools/narrative-review.mjs --check`: pages in sync (990 rows on 15 surfaces). `y-95-04.json` has 52 rows, all `before` empty and surface `items`. `grep -c WEAPON_FLAVOR docs/NARRATIVE-PASS.md`: 24.
- `git diff cb5f77ec -- content/treasure-tables.js content/weapons.js content/armors.js | grep -c '^-[^-]'`: 0 (no existing content line changed). `git diff --stat cb5f77ec -- engine`, the five audit docs and `test/unit/fixtures/shell-snapshots`: empty.
- Line endings: `content/treasure-tables.js`, `content/weapons.js`, `docs/NARRATIVE-PASS.md` and `docs/narrative-pass/review.html` `w/crlf`; `content/armors.js` `w/lf`; none `w/mixed`. The new ledger was written LF; git warns it will normalise to CRLF on touch (the repository's autocrlf setting, as for the earlier ledgers).

## Deviations from Plan

**1. [Rule 3 - Tooling] Appended the three export blocks with a scratchpad node script instead of the Edit tool.**
- **Why:** an Edit of a CRLF file inserts LF lines (mixed endings); the script appends with the file's own line ending so `treasure-tables.js` and `weapons.js` stay `w/crlf` and `armors.js` stays `w/lf`. Content is identical to what an Edit would have produced; the script is not committed.

Otherwise none; the plan executed as written. Four first drafts (Plate, Cloak of Flying, Cedar Staff, Awl Pike) were over 90 characters and were trimmed before the Task 1 and Task 2 commits.

## Known Stubs

None. The maps are complete; nothing renders them until 95-05, by design (surfaces fall back to the rules text today).

## Threat Flags

None. Static player-facing strings only; no network, auth, file-access or schema surface.

## Self-Check: PASSED

- FOUND: content/treasure-tables.js (MAGIC_ITEM_FLAVOR), content/weapons.js (WEAPON_FLAVOR), content/armors.js (ARMOR_FLAVOR), docs/narrative-pass/why/y-95-04.json
- FOUND commits: 62494c20, 0738a870, cfb4a32c
