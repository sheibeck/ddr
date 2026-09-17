# Google Play store listing — Delve, Die, Repeat

Copy and answers for the Play Console listing. Written against Google's
metadata policy (no emoji, no ALL CAPS beyond the brand, no ranking / promo /
price claims, no unattributed testimonials, no calls to action).

## App name (≤ 30)

`Delve, Die, Repeat` (18)

## Short description (≤ 80)

Preferred:

`Random hero. Random dungeon. Random death. Based on the 1994 tabletop Mazeworld.` (80)

Alternates:

- `A dice-driven roguelike based on Mazeworld, the 1994 tabletop dungeon crawl.` (76)
- `Roll an adventurer, descend the maze, die, read the epitaph, try again.` (71)

## Full description (≤ 4000)

```
Delve, Die, Repeat is an offline roguelike dungeon crawl based on Mazeworld, a tabletop RPG from 1994, kept as crunchy, unfair, and funny as the original.

You do not build a character. One is dealt to you. The tables roll your race, your class, your sub-class, your gear, your phobia, and the reason you walked into a maze in the first place. Then you descend. Every floor is generated fresh, every encounter is a dice roll, and every death is permanent. The graveyard remembers. So does the Oracle, who narrates your run with the warmth of a tax auditor.

What you do down there
- Explore a procedurally generated maze one square at a time, with fog, one-way doors, chasms to leap, and walls to climb. Or fall from.
- Fight monsters in round-by-round combat: strike, cast, use an item, flee, or try to talk your way out. Every roll is shown, so you know exactly which number betrayed you.
- Cast spells as a Wizard, Cleric, Illusionist, or Summoner, each with its own list and its own way of running out of charges at the worst moment.
- Loot the fallen. Take it, leave it, equip it now, or stow it, if your bag has room. It usually does not.
- Recruit a joiner: a wandering adventurer who tags along, fights by their own class, and eats your rations.
- Manage food, hit points, armor wear, poison, disease, and a phobia the dice picked for you.
- Find the stairs. Go deeper. The dungeon scales with you, up to a point, and then it simply stops being polite.

What happens when you die
You get an epitaph. It is not kind. Your adventurer joins the graveyard with their floor, their days survived, and the thing that ended them. Then you tap once, roll the next victim, and go again. Runs are built to fit in five to ten minutes, which is roughly how long most adventurers last.

The rules came from a binder
The game is based on the 1994 tabletop Mazeworld rules, adapted for a phone with a few deliberate changes and none of the erasing. Twenty-plus classes and sub-classes, five races, dozens of monsters with their own abilities, a full spell list, traps, treasure tables, and a random encounter table that includes "nothing" and "something worse." The engine rolls real dice with real odds and tells you what it rolled.

Made for phones, not ported to them
- Tap or swipe to move; every decision is a large button.
- One screen for the map, one for your hero, one for gear, one for the Oracle's log, and one for the dead.
- Plays fully offline. No account, no sign-in, no ads, no in-app purchases, no data collected.
- Your run saves itself. Put the phone down mid-fight and the monster will wait.

Delve, Die, Repeat is a paid game with nothing else to buy. You get the whole dungeon, and the dungeon gets the whole you.
```

## Privacy policy URL

`https://darktierstudios.com/privacy/apps`

(The website's own policy, which discloses Google Analytics, is at
`https://darktierstudios.com/privacy`. The apps page is stand-alone and is
the one to enter in Play Console.)

## Data safety

"Does your app collect or share any of the required user data types?" → **No.**
Every data type: not collected, not shared. Android Advertising ID: not used.
No third-party SDKs. Saves and graveyard live on-device only in
`@capacitor/preferences`; the Play purchase itself is Google's data, not the
app's. Verified 2026-09-17 against `www/`, `AndroidManifest.xml`, and
`package.json`: no `fetch`/`XMLHttpRequest`/`WebSocket`, no analytics, ads, or
crash SDKs, only the `INTERNET` permission (Capacitor default, unused).

## Screenshots

`screenshots/phone` (1080×1920), `screenshots/tablet-7in` (1350×2400),
`screenshots/tablet-10in` (1620×2880). All 9:16 PNG, under 8 MB. Eight per
size, in the upload order: title, combat, map, death, loot, hero, find,
graveyard.

Regenerate after UI changes with `node tools/store-screenshots/capture.js`
(see `tools/store-screenshots/README.md`).
