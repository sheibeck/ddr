---
phase: 95-fantasy-flavour-i-the-text-layer-spells-scrolls-items
plan: 03
subsystem: content text layer (player flavour lines for spells, scrolls, potions, tools, bags)
tags: [flavour, text-layer, spells, scrolls, potions, tools, bags, narrative-ledger]
requires:
  - phase: 95-01
    provides: flavorText.js domain registry, flavor-layer guards, pre-registered voice-corpus banks
  - phase: 95-02
    provides: RULES reveal component (not read by any surface yet)
provides:
  - SPELL_FLAVOR (41 keys) and SCROLL_FLAVOR (a string) in content/spells.js
  - POTION_FLAVOR (10 keys) in content/potions.js
  - TOOL_FLAVOR (Torch, Rope, Ladder, Lockpicks) in content/tools.js
  - BAG_FLAVOR (Medium bag, Large bag, Enormous bag) in content/bags.js
  - docs/narrative-pass/why/y-95-03.json (59 new-line ledger rows) and the regenerated review page
affects: [95-04, 95-05, 95-06, 95-07, 95-08]
tech-stack:
  added: []
  patterns: [keyed frozen flavour map beside each content table, ledger generated from the live exports so every after is byte-exact]
key-files:
  created:
    - docs/narrative-pass/why/y-95-03.json
  modified:
    - content/spells.js
    - content/potions.js
    - content/tools.js
    - content/bags.js
    - docs/NARRATIVE-PASS.md
    - docs/narrative-pass/review.html
key-decisions:
  - "Every line is a fresh sentence in the house voice that points the same way as its rules text and states no number, die, percentage or number word; no existing txt, row, NICHE_LABELS or activation table changed."
  - "Lockpicks gets a TOOL_FLAVOR entry although it has no TOOLS row (its rules text lives in engine/items.js)."
  - "FLAVOR-01 and FLAVOR-02 stay Pending: the phase's final gate plan (95-08) closes them."
requirements-completed: []
status: complete
duration: ~35 min
completed: 2026-10-03
---

# Phase 95 Plan 03: Spell, scroll, potion, tool and bag flavour Summary

59 player-layer lines (41 spells, 1 scroll, 10 potions, 4 tools including the Lockpicks, 3 bags) written as frozen keyed exports beside their content tables, ledgered as new lines and listed on the regenerated narrative review page. Nothing on screen changes yet: no surface reads these maps until 95-05.

## Tasks and commits

| Task | Commit | What |
| --- | --- | --- |
| 1. Spell and scroll flavour (42 lines) | fe613679 | `SPELL_FLAVOR`, `SCROLL_FLAVOR` appended to `content/spells.js` (LF) |
| 2. Potion, tool, lockpicks and bag flavour (17 lines) | 1d57e1ec | `POTION_FLAVOR`, `TOOL_FLAVOR`, `BAG_FLAVOR` appended to `content/potions.js`, `content/tools.js` (LF) and `content/bags.js` (CRLF, kept) |
| 3. Ledger and regenerate the review page | e300e2a7 | `docs/narrative-pass/why/y-95-03.json` (59 rows, generated from the live exports by a scratchpad script, not committed), `docs/NARRATIVE-PASS.md`, `docs/narrative-pass/review.html` |

## The 59 lines (key, line, characters)

Longest line: 89 characters (Stop Time); every line is at or under 90.

| Map | Key | Line | Chars |
| --- | --- | --- | --- |
| SPELL_FLAVOR | Heal | Closes wounds the polite way: quickly, and without asking how you got them. | 75 |
| SPELL_FLAVOR | Shield | A cushion of wishful thinking that soaks up blows until it gives out. | 69 |
| SPELL_FLAVOR | Strength | Lends every blow and spell a little extra conviction until the magic wears off. | 79 |
| SPELL_FLAVOR | Doze | A lullaby for several foes together, undone by the first rude interruption. | 75 |
| SPELL_FLAVOR | Freeze | A well-aimed bolt of winter: it stings, and what survives goes stiff and cross. | 79 |
| SPELL_FLAVOR | Map the Floor | Lays out the whole floor in your mind, right up until you take a step. | 70 |
| SPELL_FLAVOR | Mirror Self | A reflection that gets in the way, so most swings miss the real you. | 68 |
| SPELL_FLAVOR | Stun | Dazes a foe into standing still, however rudely you poke it. | 60 |
| SPELL_FLAVOR | Weaken | Takes the wind out of every foe, who swing sloppily and hit like damp towels. | 77 |
| SPELL_FLAVOR | Acid | Eats at a foe round after round, with a hiss that really sets the mood. | 71 |
| SPELL_FLAVOR | Stupidity | Leaves a foe too dim to resist much, and still perfectly able to hit you. | 73 |
| SPELL_FLAVOR | Blind | Blinds a foe for the fight, so it flails at the scenery and rarely finds you. | 77 |
| SPELL_FLAVOR | Shrink | Leaves a handful of foes pocket-sized, with pocket-sized hit points to match. | 77 |
| SPELL_FLAVOR | Ice | A blizzard for the whole room, whether or not anyone dressed for it. | 68 |
| SPELL_FLAVOR | Earthquake | Hurts everyone in the room, caster included, by making the ground lose its temper. | 82 |
| SPELL_FLAVOR | Noxious Vapor | A cloud of dubious intent that puts foes to sleep, or something sterner. | 72 |
| SPELL_FLAVOR | Fireballs | A volley of little fireballs, scattered among the foes with more enthusiasm than aim. | 85 |
| SPELL_FLAVOR | Petrify | Turns a foe into garden statuary: permanent, decorative and entirely without loot. | 82 |
| SPELL_FLAVOR | Insane | Loosens a foe's grip on reality, and the results are anyone's guess. | 68 |
| SPELL_FLAVOR | Summon | Calls a helper out of thin air, who fights for you until they remember their errands. | 85 |
| SPELL_FLAVOR | Fireball | A proper ball of fire with a foe's name on it, and no sense of proportion. | 74 |
| SPELL_FLAVOR | Major Heal | Knits you back together with a firm hand and a long, disapproving look. | 71 |
| SPELL_FLAVOR | Bubble | A shimmering bubble that sends the next blow home to whoever threw it, then pops. | 81 |
| SPELL_FLAVOR | Sense Danger | A prickle at the back of your neck, so the next fight never gets the first word. | 80 |
| SPELL_FLAVOR | Turn Walking Dead | Tells the Walking Dead to go back to bed, and the stubborn ones take it personally. | 83 |
| SPELL_FLAVOR | Plane Gate | Opens a door to The Planes and shoos a few Demons or Walking Dead through it. | 77 |
| SPELL_FLAVOR | Sense Presence | Your skin crawls in a helpful direction: no ambushes, and the dark stops mattering. | 83 |
| SPELL_FLAVOR | Lightning | Jumps from foe to foe in a crackle of bad news, leaving each of them singed. | 76 |
| SPELL_FLAVOR | Regeneration | Persuades your body to keep mending itself for the length of the fight. | 71 |
| SPELL_FLAVOR | Mangle | The heaviest blow in the book, saved for a foe that has really earned it. | 73 |
| SPELL_FLAVOR | Death | Ends a foe outright, and bills you in health for the privilege. | 63 |
| SPELL_FLAVOR | Open/Lock | Persuades your next chest to open itself, to the visible dismay of every lockpick. | 82 |
| SPELL_FLAVOR | Fly | Lifts you over walls and gaps as if they were rumours, though it is no help in a scrap. | 87 |
| SPELL_FLAVOR | Enchant Character | Wraps you in a shimmer that sharpens your aim and spoils everyone else's. | 73 |
| SPELL_FLAVOR | Speed of Sound | Makes you quicker than your own excuses: you swing more and always go first. | 76 |
| SPELL_FLAVOR | Stop Time | Pauses every foe mid-sneer, which makes them wonderfully easy to hit, until time resumes. | 89 |
| SPELL_FLAVOR | Senseless | Turns a foe's temper on its friends, and on thin air when it has none. | 70 |
| SPELL_FLAVOR | Duplicate Foe | Gives a foe a twin to argue with, and it is far too busy to bother you. | 71 |
| SPELL_FLAVOR | Door Illusion | Paints a door on the nearest wall and leaves through it, if the foes buy it. | 76 |
| SPELL_FLAVOR | Chameleon Tongue | Lets you talk to foes in their own tongue, which improves the odds of a polite exit. | 84 |
| SPELL_FLAVOR | Size of the Behemoth | Makes you loom enormously, so the smaller foes flee and the rest lose heart. | 76 |
| SCROLL_FLAVOR | (every scroll) | The scroll picks the spell and you do the reading, which seems about fair. | 74 |
| POTION_FLAVOR | Healing | A reassuring swig that tops you up, and tastes exactly like medicine. | 69 |
| POTION_FLAVOR | Cure Poison | Clears out poison, politely but firmly, and leaves a taste behind as a reminder. | 80 |
| POTION_FLAVOR | Speed | Drink it and everyone else seems to be wading through porridge, for a while. | 76 |
| POTION_FLAVOR | Xtra Healing | The expensive bottle: swallow it and you are restored right to the brim. | 72 |
| POTION_FLAVOR | Strength | Bottled biceps: blows and spells land harder until the effect wears off. | 72 |
| POTION_FLAVOR | Cure Disease | Shows disease the door, and reminds your insides who actually lives there. | 74 |
| POTION_FLAVOR | Enlarge | Swells you up big and heavy-handed, though it also makes you a better target. | 77 |
| POTION_FLAVOR | Acuteness | Sharpens your swing until you almost look like you know what you are doing. | 75 |
| POTION_FLAVOR | Death | Drinking this will kill you, which is a poor reason to be curious about it. | 75 |
| POTION_FLAVOR | Invisible | Fades you from sight, so foes mostly swing at where you used to be. | 67 |
| TOOL_FLAVOR | Torch | Pushes the dark back for a good stretch, then burns out without apology. | 72 |
| TOOL_FLAVOR | Rope | Gets you across a crevice with some dignity, and is used up for the favour. | 75 |
| TOOL_FLAVOR | Ladder | Turns a stubborn wall into a courteous stairway, then retires from the profession. | 82 |
| TOOL_FLAVOR | Lockpicks | Thin bits of metal and good intentions, for locks that need persuading. | 71 |
| BAG_FLAVOR | Medium bag | A step up from the starter sack, and a bigger place to keep your poor decisions. | 80 |
| BAG_FLAVOR | Large bag | Big enough to lose an afternoon in, rummaging for the thing you actually need. | 78 |
| BAG_FLAVOR | Enormous bag | A bag so large it has its own weather, and a regrettable echo. | 62 |

## Lines the writer's rules made hard

- **Number words hide in idioms.** The first draft of Doze said "at once", which the guard's "once" ban caught (the only guard failure in the plan); it now reads "together". Lines for Shrink, Plane Gate and Speed of Sound say "handful", "a few" and "swing more" instead of any count; Speed (potion) says "for a while" instead of its duration.
- **Sibling control spells.** Doze (sleep, undone by a poke) and Stun (rooted and awake, unbothered by pokes) are told apart by exactly that: the line is the only thing a player sees. Stop Time, Senseless, Duplicate Foe, Weaken, Shrink and Blind each lean on their own picture (frozen mid-sneer, turns on its friends, a twin to argue with, damp towels, pocket-sized, flails at the scenery).
- **Damage siblings.** Freeze (winter bolt, a survivor goes stiff), Ice (blizzard for the whole room), Fireball (one proper ball of fire), Fireballs (a volley, scattered), Lightning (jumps from foe to foe), Mangle (the heaviest blow in the book) and Acid (round after round) are each a different image.
- **Cross-domain pairs.** Strength spell (conviction for blows and spells) versus Strength potion (bottled biceps); Death spell (bills you in health) versus Death potion (says outright that it kills you); Healing (tops you up) versus Xtra Healing (restored to the brim); Cure Poison and Cure Disease name what each clears.
- **Death potion warning.** Its line is the only warning a find card gives, so it says "Drinking this will kill you" in words and carries the `accurate` reason in the ledger.
- **Rope and Ladder** are spent on use: "is used up for the favour" and "then retires from the profession" say so with no count word.
- **Healing line** also heads the healing-potion counter, so it reads as an ordinary draught.
- **Bags** each get a fresh joke that grows with the bag and never repeats the joke already in its txt or states a capacity.
- **Heal** is the user-accepted line, verbatim.

## Verification results

- `npm test` (full): tests 10355, pass 10335, fail 0, skipped 20, duration about 449 s. (Skipped went from 40 at 95-01 to 20: the 12 flavor-layer per-domain tests for the five maps landed here are now live; the rest wait for 95-04 and the other maps.)
- Task 1 and Task 2 verify commands: exit 0, `node tools/voice-inventory.mjs --roll-under --hygiene --safety --count` prints `0`. `bank:SPELL_FLAVOR*` counts 41, `bank:SCROLL_FLAVOR` counts 1.
- `node tools/voice-inventory.mjs --check-ledgers --after`: 60 ledger files, 0 errors. `node tools/narrative-review.mjs --check`: pages in sync (938 rows on 15 surfaces). `grep -c SPELL_FLAVOR docs/NARRATIVE-PASS.md`: 41.
- `git diff cb5f77ec -- content | grep -c '^-[^-]'`: 0 (no existing content line changed). `git diff --stat cb5f77ec -- engine test/unit/fixtures/shell-snapshots` and the five audit docs: empty.
- Line endings: `content/spells.js`, `potions.js`, `tools.js` `w/lf`; `content/bags.js`, `docs/NARRATIVE-PASS.md`, `docs/narrative-pass/review.html` `w/crlf`; none `w/mixed`.

## Deviations from Plan

None - plan executed exactly as written. One draft line (Doze) failed the number-word guard on its first run and was reworded before the Task 1 commit.

## Known Stubs

None. The maps are complete; nothing renders them until 95-05, which is by design (the surfaces fall back to the rules text today).

## Threat Flags

None. Static player-facing strings only; no network, auth, file-access or schema surface.

## Self-Check: PASSED

- FOUND: content/spells.js (SPELL_FLAVOR, SCROLL_FLAVOR), content/potions.js (POTION_FLAVOR), content/tools.js (TOOL_FLAVOR), content/bags.js (BAG_FLAVOR), docs/narrative-pass/why/y-95-03.json
- FOUND commits: fe613679, 1d57e1ec, e300e2a7
