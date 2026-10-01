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
The game is based on the 1994 tabletop Mazeworld rules, adapted for a phone with a few deliberate changes and none of the erasing. Twenty-plus classes and sub-classes, six races, dozens of monsters with their own abilities, a full spell list, traps, treasure tables, and a random encounter table that includes "nothing" and "something worse." The engine rolls real dice with real odds and tells you what it rolled.

Made for phones, not ported to them
- Tap or swipe to move; every decision is a large button.
- One screen for the map, one for your hero, one for gear, one for the Oracle's log, and one for the dead.
- Plays fully offline. An optional public leaderboard, if you want the whole world to see how you died, under your Google Play Games name. No ads, no in-app purchases.
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

Reconciled for 2.3.0 (the board names every player by their Google Play Games
name): effective October 1, 2026, live when the site deploys with the release.

darktier-studio commit 0f39ee3d4c43e7690478138d75c7feb8a2565c9e, committed on `main` and not yet deployed or pushed from this run (the push and the deploy are the user's go; the deploy is `docs/RELEASING.md` "Release 2.3.0" step 2). Source: `C:/projects/darktier-studio/src/pages/privacy/apps.astro`, `delete-data.astro`, `delve-die-repeat/terms.astro` and `delve-die-repeat/index.astro`.

Backend: "We keep one small database on Google Firebase for the public leaderboard and bug reports, nothing else."

## Data safety

Answers for 2.3.0: the public leaderboard now shows each player under their
Google Play Games name, so Name joins the list, User IDs is reworded, and the
Play Games SDK's own collection is declared as Google's data-collection page
describes it. The 2.1.0 in-app bug reports are unchanged in substance. Play
Console → Delve, Die, Repeat → Policy and programs → App content → Data
safety.

"Does your app collect or share any of the required user data types?" →
**Yes.** Since 2.3 the game signs in with Google Play Games and posts each
finished run to its own public leaderboard while the in-game Compete setting
is on (it is on by default; the player can turn it off at any time from the
account block). A bug report is sent only when the player taps Send in
☰ REPORT A BUG.

| Data type | What it is | Collected | Shared | Optional | Purpose | Processed ephemerally |
|---|---|---|---|---|---|---|
| Personal info → **Name** | Your Google Play Games name (a gamer name, a nickname you choose in Google Play Games), shown publicly beside your runs on the leaderboard | Yes | No | Yes (Compete) | App functionality | No (it is on the public board) |
| Personal info → **User IDs** | The game's Firebase account ID, which Firebase Authentication links to your Google Play Games player ID when you sign in with Compete on. The player ID is never shown publicly. A bug report may still create the account anonymously, with no link | Yes | No | Yes (created only when Compete is ON and a run is sent, or when the player sends a bug report) | App functionality | No |
| App activity → **Other actions** | Per finished run while Compete is on: your Google Play Games name and every field of the run document — hero name rolled by the game, race, class, sub-class, level, floor, days survived, squares walked, kills, wilmst carried, experience, cause of death, what killed you, epitaph, time of death, app version, dungeon seed, turn count, a fingerprint of the run, season, and the ranking numbers derived from them | Yes | No | Yes (Compete off) | App functionality | No (stored on the public board) |
| App activity → **Other user-generated content** | The bug report the player types in the ☰ REPORT A BUG sheet (up to 2,000 characters), sent only when they tap Send | Yes | No | Yes (sent only when the player taps Send) | App functionality | No (stored in Firestore and posted publicly on GitHub) |
| App info and performance → **Diagnostics** | Attached to a bug report only: the run's Oracle log, the app version and build, the device model and Android version (the WebView user agent), and the run context (floor, race, sub-class, class, level, day, steps, alive or dead) | Yes | No | Yes (sent only when the player taps Send) | App functionality | No |
| App info and performance → **Diagnostics** (Play Games SDK) | The Play Games Services SDK's own diagnostics and analytics data, which Google's SDK collects automatically "to improve the stability of our SDKs and make product improvements" (Google's data-collection page, below). It happens only while Compete is on and the SDK is running: the game starts the SDK only then | Yes | No | Yes (Compete off: the SDK never starts) | Analytics, App functionality | No |
| Photos and videos → **Photos** (Play Games SDK) | The avatar half of Google's "Gamer Identity (Gamertag, avatar)": the SDK collects it automatically when a Play Games account is created or updated. The game never reads, requests or shows the avatar (the board uses initials only) | Yes | No | Yes (Compete off: the SDK never starts) | App functionality | No |

Google's own Play Games data-collection page lists what its SDKs collect
automatically: "Game Service" (the Games account data a user creates and
updates: Gamer Identity (Gamertag, avatar)), "Analytics" and "Diagnostics".
The mapping used above:

- Gamertag → Personal info → **Name** (the row above; it is also what the
  board shows).
- Avatar → Photos and videos → **Photos** (the last row; a conservative
  declaration, because the game never touches the image).
- Diagnostics and Analytics → App info and performance → **Diagnostics**,
  with the purpose Analytics added because Google says the data is used "to
  improve the stability of our SDKs and make product improvements".
- The page's second table ("collected depending on your usage": game analytics,
  achievements, scores, metagame, saved games) does not apply: the game uses
  Play Games for sign-in only, with no leaderboards, achievements, saved games
  or metagame data (`docs/PLAY-GAMES-SETUP.md`).

The page was read on 2026-10-01. It describes only "the latest version" of
the SDKs, and the developer is "solely responsible" for the answer, so
re-read it at each release.

"Other actions" is Play's App activity type for "any other user activity or
actions in-app not listed here such as gameplay" (answer/10787469, checked
2026-10-01), so board runs go there. Play defines Name as "How a user refers
to themselves, such as their first or last name, or nickname" (same page), so
the gamer name is a Name.

**Bug reports:** nothing leaves the phone until the player taps Send in
☰ REPORT A BUG. The sheet states first that the report and the run's Oracle
will be posted publicly on GitHub, and to leave out anything private. No
account id, email, avatar or personal identity is attached, though the
adventurer's generated name can appear inside the Oracle. The report goes
over HTTPS to the game's Firebase project (Cloud Firestore,
`delve-die-repeat-6ba5f`), and a GitHub Action files it as a public issue on
sheibeck/ddr (`docs/BUG-REPORTS.md`). Reports are deleted from Firestore
once filed (or within 30 days at most, if the Oracle had to be trimmed to
fit the issue); the public GitHub issue itself is not deleted by this
process (`docs/BUG-REPORTS.md` "Retention"). Sending uses the game's account
ID (the User IDs row above) only as the key of a small per-player limit
record (`reportLimits/{uid}`: a last-sent timestamp, a day bucket, and a
report count) enforcing a 2-minute cooldown and 5 reports a day, deleted
automatically 2 days after the last report; the report document itself
carries no id of any kind.

Every other data type: not collected, not shared. Saves, settings, personal
bests and the local run history never leave the phone; a run's details,
including its epitaph, leave it only as a Compete-ON board run; a bug report
leaves it only on Send. The Google account's real name and email are never
requested (the game asks for no profile or email scope). Android Advertising
ID: not used. Data is not sold.

- **Security:** encrypted in transit. The board and identity calls go over
  HTTPS to Cloud Firestore, Identity Toolkit, Secure Token and the game's
  name function; bug reports go over HTTPS too, both to Firestore and from
  the Action to GitHub. Google's page says the Play Games SDK encrypts its
  data in transit using HTTPS.
- **Deletion:** users can request that data be deleted: yes. In the game,
  ERASE MY RUNS in the ☰ account block (a two-tap confirm) deletes every one
  of the player's runs on the board, in every season, deletes the player's
  board name record, and deletes the game account with its Google Play Games
  link; local run history stays on the phone. Disconnecting the game in
  Google Play Games settings removes Google's side, and Google's page says
  players can delete their Play Games account and its data through their Play
  Games profile or Google MyAccount. Without the game (for example after an
  uninstall), `https://darktierstudios.com/privacy/delete-data` (Play
  Console's "Delete data URL") gives an email route that works from the
  player's own Google Play Games name. A bug report is deleted the same way,
  on request, through the privacy/delete-data page or by contacting the
  developer, who deletes the Firestore document and the GitHub issue
  (`docs/BUG-REPORTS.md`).
- **Why "optional":** with Compete OFF the game makes zero network calls for
  the board, never starts the Play Games SDK, asks for no Play Games sign-in,
  creates no game ID, and discards any runs still queued. The game
  never uploads runs finished while Compete was off, even once Compete is
  turned back on. Play counts an opt-out as optional collection ("all users … can
  either optionally provide information, opt-out, or opt-in",
  answer/10787469).

### Shared: the finding and its sources

**Not shared.** The board, the name record and the bug reports live in Cloud
Firestore, Cloud Functions and Firebase Authentication, in the game's own
Firebase project (`delve-die-repeat-6ba5f`), which Google operates as our
service provider on the developer's behalf — the service-provider exemption.
Google also receives Play Games data as the platform that runs the sign-in:
Google's page says "when a user logs into your game using Play Games
Services, their gamer identity is shared with your Play Games Services
enabled game", so the data flows between the player and Google as the
operator of Play Games, under the player's own Google Play Games account,
and the SDK is Google's own software. We treat that as the service-provider
and user-initiated exemptions, not a transfer to a third party. Showing the
Play Games name and runs on the public board is the player's own choice, made
by leaving Compete on and announced by the welcome card (it says the Play
Games name is now public on the board) — the user-initiated exemption. Bug
reports: unchanged finding, the same two exemptions apply (posting publicly
on GitHub is the player's own disclosure, stated plainly before Send, section
above).

Sources:

- Play Console Help, "Provide information for Google Play's Data safety
  section", `https://support.google.com/googleplay/android-developer/answer/10787469`
  (fetched 2026-10-01): the service-provider and user-initiated exemptions
  from "sharing", the optional rule, and the Name, User IDs, Photos, App
  activity and App info and performance type definitions.
- Google Play Games Services, "Prepare for Google Play's data disclosure
  requirements", `https://developer.android.com/games/pgs/data-collection`
  (fetched 2026-10-01): the automatic collection (Gamer Identity, Analytics,
  Diagnostics), HTTPS in transit, the player's deletion route, and the
  "solely responsible" wording.

### Notes for the console step (user)

- The one-time upload of runs finished on 2.1.0 (since its 2026-09-28
  release) is covered by the Other actions row above, not a separate data
  type — it carries the same fields as any other run and uploads only once,
  only if Compete is on the first time 2.2 starts (`docs/LEADERBOARDS.md`
  section 8). On 2.3 the update also re-posts, once, runs a 2.2.0 client sent
  that never reached the board; they come from the player's own local
  Compete-ON ledger, so the same row covers them.
- The developer's own balance export (`tools/boards-admin.mjs export`,
  `docs/LEADERBOARDS.md` section 12) reads board runs by hand to track game
  balance across builds. Its locked purpose is App functionality
  (86-CONTEXT); decide at console time whether Play's Analytics purpose
  should also be checked for the Other actions row.
- Enter Name, User IDs, Other actions, Other user-generated content and the
  two Diagnostics rows, plus the Photos row if you accept the conservative
  declaration (it costs nothing to declare, and it matches Google's page word
  for word). The Play Games SDK rows say "Yes, optional" because Compete off
  never starts the SDK.
- Re-read the IARC questionnaire's "users interact" question at the same
  sitting. Gamer names on a public board are expected not to change the
  rating; you confirm that in the console.

### Source-level audit (2.3.0, October 1, 2026, Phase 91.2 plan 09)

Run in the 91.2-09 worktree at the 91.2-08 boundary.

- **Runtime packages.** `package.json` dependencies (7): `@capacitor/android`,
  `@capacitor/app`, `@capacitor/core`, `@capacitor/haptics`,
  `@capacitor/preferences`, `@capacitor/screen-orientation`,
  `@capacitor/splash-screen`. One devDependency, `@capacitor/cli`. No new npm
  package: the Play Games sign-in is a small in-repo Java plugin, not a
  community package. No `firebase` package either, because Firebase is
  reached over plain REST with no SDK.
- **Android dependencies.** `android/app/build.gradle` lists no ad,
  analytics, measurement or crash-reporting artifact.
  `com.google.android.gms:play-services-games-v2:22.1.0` is the only new
  dependency (Google's own Play Games Services SDK, the sign-in). The build-level
  transitive audit runs at the release build (`docs/RELEASING.md` "Release
  2.3.0" step 2): the release AAB's dependency tree and API scan are the
  record, with the Google-owned Play Games callers named.
- **Permissions.** `android/app/src/main/AndroidManifest.xml` declares one
  `uses-permission`: `android.permission.INTERNET`, used for our own board
  and sign-in while Compete is on and for bug reports on Send. No `AD_ID`.
  The `com.google.android.gms.games.APP_ID` meta-data is back (the Play Games
  sign-in needs it), pointing at the game's own configuration.
- **Network APIs in `www/`.** The board, identity and name-function code
  injects `fetchFn` rather than calling `fetch(` directly, as in 2.2.0; every
  call is either inert, same-origin, or an explicit board, sign-in or
  bug-report call gated on Compete or a player's own Send action. The widened
  grep over a freshly built `www/` is re-run at the release build.

The earlier 2.2.0 audits (source level at commit 7a08a774, build level on the
versionCode 12 debug build) found zero ad, analytics or crash-reporting
artifacts, no `AD_ID`, and no Google Play services artifact. Since 2.3 puts
the Play Games Services SDK back, that last clause no longer holds, and this
2.3.0 section replaces it.

## Screenshots

`screenshots/phone` (1080×1920), `screenshots/tablet-7in` (1350×2400),
`screenshots/tablet-10in` (1620×2880). All 9:16 PNG, under 8 MB. Eight per
size, in the upload order: title, combat, map, death, loot, hero, find,
graveyard.

Regenerate after UI changes with `node tools/store-screenshots/capture.js`
(see `tools/store-screenshots/README.md`).

**Owed (deferred human item):** `08-dead.png` (all three sizes) shows the
pre-2.0 graveyard and must be regenerated showing the v3 Leaderboards panel
(the LEADERBOARD view) at 1080×1920, 1350×2400 and 1620×2880. On 2026-09-24
the capture tool could not run: `playwright-core` is not installed anywhere
in the repo, and installing a package was out of scope for 69-01. Either
install `playwright-core` per the README and run `capture.js` (its bot
predates later UI changes and may need label updates), or capture by hand in
Chrome device mode at 432×768 @2.5, 675×1200 @2 and 810×1440 @2 from the
served `www/`.
