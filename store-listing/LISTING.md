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
- Plays fully offline. An optional public leaderboard, if you want the whole world to see how you died. No ads, no in-app purchases.
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

Reconciled for 2.2.0 (our own leaderboard replaces the retired Google
leaderboard service): effective September 29, 2026.

darktier-studio commit 82912a923b7579db7f86c877b7116529686c1280 (short `82912a9`), pushed to `origin/main` and not yet deployed (the deploy is `docs/RELEASING.md` step 7). Source: `C:/projects/darktier-studio/src/pages/privacy/apps.astro`, `delete-data.astro`, `delve-die-repeat/terms.astro` and `delve-die-repeat/index.astro`.

Backend: "We keep one small database on Google Firebase for the public leaderboard and bug reports, nothing else."

## Data safety

Answers for 2.2.0: our own Firebase leaderboard replaces the retired Google
leaderboard service; the 2.1.0 in-app bug reports are unchanged in
substance. Play Console → Delve, Die, Repeat → Policy and programs → App
content → Data safety.

"Does your app collect or share any of the required user data types?" →
**Yes.** Since 2.2 the game posts each finished run to its own public
leaderboard while the in-game Compete setting is on (it is on by default; the
player can turn it off at any time from the account block). A bug report is
sent only when the player taps Send in ☰ REPORT A BUG.

| Data type | What it is | Collected | Shared | Optional | Purpose | Processed ephemerally |
|---|---|---|---|---|---|---|
| Personal info → **User IDs** | An anonymous game ID: a random Firebase account ID the game creates, carrying no name, email, phone number, device identifier or advertising ID | Yes | No | Yes (created only when Compete is ON and a run is sent, or when the player sends a bug report) | App functionality | No |
| App activity → **Other actions** | Per finished run while Compete is on: the rolled @handle and every field of the run document — hero name rolled by the game, race, class, sub-class, level, floor, days survived, squares walked, kills, wilmst carried, experience, cause of death, what killed you, epitaph, time of death, app version, dungeon seed, turn count, a fingerprint of the run, season, and the ranking numbers derived from them; plus, once, the runs finished on 2.1.0 since its release, sent when 2.2 first starts, only if Compete is on at that moment | Yes | No | Yes (Compete off) | App functionality | No (stored on the public board) |
| App activity → **Other user-generated content** | The bug report the player types in the ☰ REPORT A BUG sheet (up to 2,000 characters), sent only when they tap Send | Yes | No | Yes (sent only when the player taps Send) | App functionality | No (stored in Firestore and posted publicly on GitHub) |
| App info and performance → **Diagnostics** | Attached to a bug report only: the run's Oracle log, the app version and build, the device model and Android version (the WebView user agent), and the run context (floor, race, sub-class, class, level, day, steps, alive or dead) | Yes | No | Yes (sent only when the player taps Send) | App functionality | No |

"Other actions" is Play's App activity type for "any other user activity or
actions in-app not listed here such as gameplay" (answer/10787469, checked
2026-09-24), so board runs go there.

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
process (`docs/BUG-REPORTS.md` "Retention"). Sending uses the anonymous game
ID (the User IDs row above) only as the key of a small per-player limit
record (`reportLimits/{uid}`: a last-sent timestamp, a day bucket, and a
report count) enforcing a 2-minute cooldown and 5 reports a day, deleted
automatically 2 days after the last report; the report document itself
carries no id of any kind.

Every other data type: not collected, not shared. Saves, settings, personal
bests and the local run history never leave the phone; a run's details,
including its epitaph, leave it only as a Compete-ON board run; a bug report
leaves it only on Send. Android Advertising ID: not used. Data is not sold.

- **Security:** encrypted in transit. The board and identity calls go over
  HTTPS to Cloud Firestore, Identity Toolkit and Secure Token; bug reports go
  over HTTPS too, both to Firestore and from the Action to GitHub.
- **Deletion:** users can request that data be deleted: yes. In the game,
  ERASE MY RUNS in the ☰ account block (a two-tap confirm) deletes every one
  of the player's runs on the board, in every season, and deletes the
  anonymous game account; local run history stays on the phone. Without the
  game (for example after an uninstall),
  `https://darktierstudios.com/privacy/delete-data` (Play Console's "Delete
  data URL") gives an email route that works from the player's own @handle.
  A bug report is deleted the same way, on request, through the
  privacy/delete-data page or by contacting the developer, who deletes the
  Firestore document and the GitHub issue (`docs/BUG-REPORTS.md`).
- **Why "optional":** with Compete OFF the game makes zero network calls for
  the board, creates no game ID, and discards any runs still queued. The game
  never uploads runs finished while Compete was off, even once Compete is
  turned back on. Play counts an opt-out as optional collection ("all users …
  can either optionally provide information, opt-out, or opt-in",
  answer/10787469).

### Shared: the finding and its sources

**Not shared.** The board and the bug reports live in Cloud Firestore and
Firebase Authentication, in the game's own Firebase project
(`delve-die-repeat-6ba5f`), which Google operates as our service provider on
the developer's behalf — the service-provider exemption. Showing the handle
and runs on the public board is the player's own choice, made by leaving
Compete on and announced by the first-run welcome card ("Every death from
here goes on the board under this handle, for anyone to find") — the
user-initiated exemption. Bug reports: unchanged finding, the same two
exemptions apply (posting publicly on GitHub is the player's own disclosure,
stated plainly before Send, section above).

Sources:

- Play Console Help, "Provide information for Google Play's Data safety
  section", `https://support.google.com/googleplay/android-developer/answer/10787469`
  (fetched 2026-09-24): the service-provider and user-initiated exemptions
  from "sharing", the optional rule, the App activity and App info and
  performance type definitions.

### Notes for the console step (user)

- The one-time upload of runs finished on 2.1.0 (since its 2026-09-28
  release) is covered by the Other actions row above, not a separate data
  type — it carries the same fields as any other run and uploads only once,
  only if Compete is on the first time 2.2 starts (`docs/LEADERBOARDS.md`
  section 8).
- The developer's own balance export (`tools/boards-admin.mjs export`,
  `docs/LEADERBOARDS.md` section 12) reads board runs by hand to track game
  balance across builds. Its locked purpose is App functionality
  (86-CONTEXT); decide at console time whether Play's Analytics purpose
  should also be checked for the Other actions row.

### Source-level audit (2.2.0, September 29, 2026, commit 7a08a774)

Run in the main checkout, working tree at HEAD.

- **Runtime packages.** `package.json` dependencies (7): `@capacitor/android`,
  `@capacitor/app`, `@capacitor/core`, `@capacitor/haptics`,
  `@capacitor/preferences`, `@capacitor/screen-orientation`,
  `@capacitor/splash-screen`. One devDependency, `@capacitor/cli`. The
  lockfile's non-dev package entries are those seven plus `tslib` (8 in
  all) — down from the 2.0.0 audit's ten (the native leaderboard plugin
  package removed in Phase 85; `@capacitor/status-bar` already gone since
  Phase 80).
  A case-insensitive grep of those names for firebase, admob,
  play-services-ads, ads-identifier, analytics, measurement, crashlytics,
  appsflyer, adjust, facebook, appcenter, sentry and bugsnag: **0 hits**. No
  `firebase` package appears because Firebase is reached over plain REST,
  with no SDK (`src/browser/firebaseAuth.js`, `firestoreRest.js`) — no ads,
  analytics or crash-reporting SDK either.
- **Permissions.** `android/app/src/main/AndroidManifest.xml` declares one
  `uses-permission`: `android.permission.INTERNET`, used for our own board
  while Compete is on and for bug reports on Send. No `AD_ID`. No
  `com.google.android.gms.games.APP_ID` meta-data (removed in Phase 85).
- **Network APIs in `www/`.** The literal `grep -rlE
  "fetch\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource"` over a freshly
  built `www/` finds only `www/src/browser/sfx.js` (same-origin `fetch` of a
  bundled sound file; no network) and Capacitor's own inert `CapacitorHttp`
  web patch (unused — `capacitor.config.json` does not enable it). Because
  the board/identity/bug-report code injects `fetchFn` rather than calling
  `fetch(` directly (by design, so every module stays unit-testable with no
  network), the real traffic is found instead by a widened
  `grep -nE "fetch\.bind|XMLHttpRequest|WebSocket|sendBeacon|EventSource"`:

  | File hit | Classification |
  |---|---|
  | `www/index.html` `boardFetchFn()` | the live board read/write path against Firestore REST on a native build, gated on `window.Capacitor?.isNativePlatform?.()` |
  | `www/index.html` `sharedIdentity()` | the one anonymous-identity request (Identity Toolkit / Secure Token), shared by bug reports and the board, created lazily on first use |
  | `www/index.html` `sendBugReport(...)` | REPORT A BUG's one Firestore REST write, only on Send |

  **Defect findings: none** — every network call is either inert,
  same-origin, or an explicit board/identity/bug-report call gated on
  Compete or a player's own Send action.

### Build-level audit (2.2.0 debug build, versionCode 12)

From the debug build 86-01 produced and identified
(`android/app/build/outputs/apk/debug/app-debug.apk`, sha256
`6d8690884110b0e481a31a7389cdb47c148b409d8caa2934a309fb15a08f5e60`, build
commit `61617177`):

- **Dependency tree** (`node tools/gradle.mjs :app:dependencies
  --configuration releaseRuntimeClasspath`). A case-insensitive grep for the
  same ad/analytics/crash terms above: **0 hits**. `play-services-games`:
  **0 hits**. No `com.google.android.gms` artifact remains — the prior
  five-row Google Play services table (`play-services-games-v2`,
  `play-services-base`, `play-services-basement`, `play-services-tasks`,
  `kotlin-stdlib`) is now empty.
- **Merged debug manifest.** `versionCode="12"`, `versionName="2.2.0"`;
  three `uses-permission` entries (`INTERNET`, `VIBRATE`, the androidx
  `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`), no `AD_ID`; no
  `com.google.android.gms.games.APP_ID` meta-data.
- **`capacitor.plugins.json`.** 5 entries, Capacitor's own plugins only:
  `@capacitor/app`, `@capacitor/haptics`, `@capacitor/preferences`,
  `@capacitor/screen-orientation`, `@capacitor/splash-screen`.
- **Network APIs in the built `www/`.** Same file list and classification as
  the source-level audit above; no new file.

The release AAB re-check is `docs/RELEASING.md` checklist step 2.

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
