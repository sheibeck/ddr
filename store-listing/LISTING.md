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
- Plays fully offline. Optional Google Play Games leaderboards, if you want the whole world to see how you died. No ads, no in-app purchases.
- Your run saves itself. Put the phone down mid-fight and the monster will wait.

Delve, Die, Repeat is a paid game with nothing else to buy. You get the whole dungeon, and the dungeon gets the whole you.
```

## Privacy policy URL

`https://darktierstudios.com/privacy/apps`

(The website's own policy, which discloses Google Analytics, is at
`https://darktierstudios.com/privacy`. The apps page is stand-alone and is
the one to enter in Play Console.)

Delete data URL (Play Console's Data safety "Delete data URL" field):
`https://darktierstudios.com/privacy/delete-data`

Reconciled for 2.0.0 (Leaderboards): effective September 24, 2026;
darktier-studio commit aaa0f4a (local, not yet deployed; the user deploys the
site). Source: `C:/projects/darktier-studio/src/pages/privacy/apps.astro` and
`delete-data.astro`; full hash `aaa0f4ad4822ebd43c58de205c0da210580c41df`.

## Data safety

Answers for 2.0.0 (Leaderboards). Play Console → Delve, Die, Repeat → Policy
and programs → App content → Data safety.

"Does your app collect or share any of the required user data types?" →
**Yes.** Since 2.0 the game posts runs to Google Play Games leaderboards while
the in-game Compete setting is on (it is on by default; the player can turn it
off at any time from the account menu).

| Data type | What it is | Collected | Shared | Optional | Purpose | Processed ephemerally |
|---|---|---|---|---|---|---|
| Personal info → **User IDs** | The Google Play Games player ID | Yes | No | Yes (Compete off) | App functionality | No |
| App activity → **Other actions** | Per run: the five leaderboard scores (DEEPEST, LEANEST, LONGEST, BUTCHERY, PURSE) plus the score tag's gameplay details: race, sub-class, level, cause of death, floor, days, steps, kills, wilmst carried, experience, and the game-rolled adventurer name (possibly shortened) | Yes | No | Yes (Compete off) | App functionality | No (Google stores the scores) |

"Other actions" is Play's App activity type for "any other user activity or
actions in-app not listed here such as gameplay" (answer/10787469, checked
2026-09-24), so game scores go there.

Every other data type: not collected, not shared. The epitaph, saves,
settings, personal bests and the local graveyard never leave the phone.
Android Advertising ID: not used. Data is not sold.

- **Security:** encrypted in transit. Play Games Services sends it over HTTPS
  (Google's PGS disclosure page, below).
- **Deletion:** users can request that data be deleted: yes. Through their
  Play Games profile (the Play Store's Play Games Profile settings or
  `https://play.google.com/games/profile`), with step-by-step instructions at
  `https://darktierstudios.com/privacy/delete-data` (Play Console's "Delete
  data URL").
- **Why "optional":** every user, on every device and in every region, can turn
  Compete off from the account menu (STOP COMPETING, or COMPETE → OFF). With it
  off the game makes no sign-in, submit or fetch call and discards any runs
  still queued. Play counts an opt-out as optional collection ("all users …
  can either optionally provide information, opt-out, or opt-in",
  answer/10787469).

### Shared: the finding and its sources

**Not shared.** The data goes to Google Play Games Services, which processes it
to run this game's leaderboards. That is a transfer to a service provider
processing data on the developer's behalf, which Play excludes from "sharing".
Posting a run to a public leaderboard is also the player's own choice, made by
leaving Compete on and announced by the first-sign-in card ("Every death goes
on the public record"), which is the user-initiated exemption. Google's PGS page
adds that a PGS game "can only read/write the authenticated player's data" for
that game.

Sources:

- Play Console Help, "Provide information for Google Play's Data safety
  section", `https://support.google.com/googleplay/android-developer/answer/10787469`
  (fetched 2026-09-24): the service-provider and user-initiated exemptions
  from "sharing", the optional rule, the App activity and App info and
  performance type definitions.
- Android Developers, "Prepare for Google Play's data disclosure
  requirements" for Play Games Services,
  `https://developer.android.com/games/pgs/data-collection` (page last
  updated 2026-06-16; fetched 2026-09-24; the old
  `developers.google.com/games/services/data-collection` URL redirects
  here): encrypted in transit over HTTPS; the authenticated-player rule; users
  delete through their Play Games profile; "as the app developer, you are
  solely responsible for deciding how to respond".

### Open decision for the console step (user)

Google's PGS page lists data its SDK collects **automatically**: Gamer
Identity, plus Analytics and Diagnostics "to improve the stability of our
SDKs". Per 67 D-20 the SDK initializes at every app start, even with Compete
off (the game itself makes no Play Games call then, but Google's software
starts). The answers above stay as locked in 69-CONTEXT D-04. **The user
decides at console time:** if the release-blocking Compete-off network capture
in `docs/UAT-v2.0.md` shows the SDK sending anything at launch, the
conservative answer is to also declare **App info and performance →
Diagnostics** (collected, not optional, purpose App functionality, not shared).
If the capture shows nothing, the table above stands as is.

### Source-level audit (2026-09-24, commit ebe4b05)

Run in the 69-01 worktree after `npm ci` (lockfile only) and
`npm run build:www`; raw outputs kept outside the repo.

- **Runtime packages.** `package.json` dependencies: `@capacitor/android`,
  `@capacitor/app`, `@capacitor/core`, `@capacitor/haptics`,
  `@capacitor/preferences`, `@capacitor/screen-orientation`,
  `@capacitor/splash-screen`, `@capacitor/status-bar`, and
  `@modbender/capacitor-play-games` pinned at exactly `0.5.0`. One
  devDependency, `@capacitor/cli`. The lockfile's non-dev package entries are
  those nine plus `tslib` (10 in all). A case-insensitive grep of those names
  for firebase, admob, play-services-ads, ads-identifier, analytics,
  measurement, crashlytics, appsflyer, adjust, facebook, appcenter, sentry and
  bugsnag: **0 hits**. No ads, analytics or crash-reporting SDK.
- **Permissions.** `android/app/src/main/AndroidManifest.xml` declares one
  `uses-permission`: `android.permission.INTERNET`, used by Google Play
  services for Play Games while Compete is on (and by Google's own SDK start-up,
  67 D-20). No `AD_ID`. The only other Play Games entry is the
  `com.google.android.gms.games.APP_ID` meta-data.
- **Network APIs in `www/`.** `grep -rlE` for `fetch(`, `XMLHttpRequest`,
  `WebSocket`, `sendBeacon` and `EventSource` over the freshly built `www/`:

  | File hit | Classification |
  |---|---|
  | `www/src/browser/sfx.js` | Same-origin `fetch` of a bundled `./sfx/<clip>.mp3` file inside the app; no network |
  | `www/vendor/@capacitor/core/capacitor.js`, `index.js`, `index.cjs.js` (and their `.map` files) | Capacitor's own `CapacitorHttp` web patch; inert, because `capacitor.config.json` does not enable `CapacitorHttp` |

  No hit in the vendored Play Games plugin's web code, and none in
  `src/browser/playGames.js` (it calls the native plugin, which loads lazily
  and only with Compete on). **Defect findings: none.**

The build-level half (Gradle `releaseRuntimeClasspath` and the merged release
manifest) is recorded by 69-04 on the actual 2.0.0 build, below.

### Build-level audit (2.0.0, versionCode 9, 2026-09-24)

Run in the main checkout on the signed release build made by
`npm run android:release` (AGP 8.13.0 / Gradle 8.14.3 / JDK 21, toolchain
files unchanged). The AAB it was run against:
`android/app/build/outputs/bundle/release/app-release.aab`, 10,352,033 bytes,
sha256 `bcaaa1b30fcf0b4683c2c78236880bb03becafbd9239edcf1ff6366664813f97`.
Raw outputs kept outside the repo.

- **Dependency tree.** `node tools/gradle.mjs :app:dependencies --configuration releaseRuntimeClasspath`.
  A case-insensitive grep of the report for firebase, admob,
  play-services-ads, ads-identifier, analytics, measurement, crashlytics,
  appsflyer, adjust, facebook, appcenter, sentry and bugsnag: **0 hits**.
  The Google Play services artifacts, unchanged from 67-06's audit:

  | Artifact | Resolved version |
  |---|---|
  | `com.google.android.gms:play-services-games-v2` | 22.0.0 |
  | `com.google.android.gms:play-services-base` | 18.5.0 |
  | `com.google.android.gms:play-services-basement` | 18.9.0 (18.4.0 requested) |
  | `com.google.android.gms:play-services-tasks` | 18.2.0 |
  | `org.jetbrains.kotlin:kotlin-stdlib` | 2.4.10 |

- **google-services not applied.** `android/app/google-services.json` does not
  exist, so the google-services plugin (on the buildscript classpath) is never
  applied. No Firebase.
- **Merged release manifest**
  (`android/app/build/intermediates/merged_manifests/release/processReleaseManifest/AndroidManifest.xml`):
  `android:versionCode="9"`, `android:versionName="2.0.0"`, the
  `com.google.android.gms.games.APP_ID` meta-data, and exactly three
  `uses-permission` entries: `android.permission.INTERNET`,
  `android.permission.VIBRATE` and the androidx
  `com.darktierstudios.delvedierepeat.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`.
  No `AD_ID`.
- **Network APIs in the bundled `www/`.** The same `grep -rlE` as the
  source-level audit, over the `www/` this build produced: 7 files,
  `www/src/browser/sfx.js` and the six `www/vendor/@capacitor/core/` files
  (`capacitor.js`, `index.js`, `index.cjs.js` and their `.map` files).
  Identical to the source-level list above; no new file.
- **Bundle contents.** 30 `.mp3` entries under `base/assets/public/sfx/`, the
  delivered clips only. **Defect findings: none.**

## Screenshots

`screenshots/phone` (1080×1920), `screenshots/tablet-7in` (1350×2400),
`screenshots/tablet-10in` (1620×2880). All 9:16 PNG, under 8 MB. Eight per
size, in the upload order: title, combat, map, death, loot, hero, find,
graveyard.

Regenerate after UI changes with `node tools/store-screenshots/capture.js`
(see `tools/store-screenshots/README.md`).

**Owed (deferred human item):** `08-dead.png` (all three sizes) shows the
pre-2.0 graveyard and must be regenerated showing the Leaderboards panel on
DEEPEST at 1080×1920, 1350×2400 and 1620×2880. On 2026-09-24 the capture tool
could not run: `playwright-core` is not installed anywhere in the repo, and
installing a package was out of scope for 69-01. Either install
`playwright-core` per the README and run `capture.js` (its bot predates later
UI changes and may need label updates), or capture by hand in Chrome device
mode at 432×768 @2.5, 675×1200 @2 and 810×1440 @2 from the served `www/`.
