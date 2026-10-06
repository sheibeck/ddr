# Play Games setup: sign-in and achievements (live runbook)

**Delve, Die, Repeat** (`com.darktierstudios.delvedierepeat`) 2.3 signs players in with Google
Play Games Services (PGS) v2 so the board can name every player by their Google Play Games name
(Phase 91.2, D-09, D-10). 2.5 also mirrors the game's achievements to Play Games while Compete is
on and the player is signed in (Phase 101). This file is the live runbook for the console side.
It covers **sign-in and achievements**: no Play Games leaderboards, no saved games. The board
itself is our own Firebase board (`docs/LEADERBOARDS.md`).

This file replaces the retirement notice 2.2.0 left here. The 2.0/2.1 runbook, with the four
Season-1 leaderboards in it, lives in git history at commit
`a217d032b0f53fd75640e15dbefd7e0a9d8d336f` (`git show a217d032:docs/PLAY-GAMES-SETUP.md`);
nothing from its leaderboard sections applies any more. This file stays at this path so archived
`.planning/milestones` plan links still resolve.

**Do not remove the Play Games configuration.** An old cleanup step (the 2.2.0 checklist, then
`docs/LEADERBOARDS.md` section 16) said to delete it. It is in use again: sign-in needs it. Only
the Season-1 *leaderboards* inside it are optional to delete.

Console labels move over time. If a menu below has been renamed, follow its current equivalent;
the order of the steps is what matters. Every live change is your go first (D-14).

## 1. What Play Games is used for now

- With Compete on, the game starts the Play Games SDK and signs the player in. With Compete
  off, the SDK never starts and no sign-in is asked for. Turning Compete off mid-session takes
  full effect the next time the game is opened: Play Games stays signed in until the app closes,
  and nothing reaches the board.
- The player's **Google Play Games name** (the gamer name they chose in Google Play Games) is
  the name the board shows. A Cloud Function (`boardName`, `functions/board-names/`) reads it
  from Google's own sign-in record and writes the trusted `names/{uid}` record.
- The game asks for **no PROFILE or EMAIL scope**, so it never sees the Google account's real
  name or email. Never add either scope: they return exactly that.
- Until the configuration below exists and is wired in, sign-in fails gracefully: the game stays
  fully playable and finished runs wait in the queue (a SIGN IN row shows in the account block).
- **Achievements (2.5).** With Compete on and the player signed in, the game mirrors its 77
  achievements to Play Games: standard ones as unlocks, hidden ones as reveals, and the
  incremental ones as progress sent as absolute set-steps values (the count so far, never an
  add-one). Unlocks and reveals go about 1.5 seconds after they happen, so Play's popup lands
  near the in-game card. Progress is batched about every 60 seconds, and also sent when the app
  goes to the background or comes back, on a death, on coming back online, when Compete is turned
  on and on a new sign-in.
- **The backlog.** Anything earned while Compete was off, while signed out or while offline is
  sent later, the next time Compete is on and the player is signed in. Play shows its popups for
  them one after another. A different Play account gets everything resent.
- **Compete off sends nothing.** It never starts the SDK for achievements, never asks Play
  anything, and never deletes the local record of what Play already has. ERASE MY RUNS removes
  runs from the board; it does not touch achievements held in Play Games.

## 2. Path A: reuse the existing configuration (the default, D-09)

The configuration is the one 2.0/2.1 used: application ID **517177834262**, in the Google Cloud
project `delve-die-repeat` (project number 517177834262). The user deleted and changed nothing
there. The spike gate **G4** (the dev-row PLAY GAMES PROBE on the debug APK, then the live
`signInWithIdp`) proves it works with the Firebase project `delve-die-repeat-6ba5f`. If G4 fails,
use path B (section 3).

You do these, in the consoles:

1. **Confirm it exists.** Play Console -> **Delve, Die, Repeat** -> **Grow users** (or **Play
   Games Services**) -> **Setup and management** -> **Configuration**. The page header shows the
   application ID `517177834262`. Tell Claude whether it is published or has unpublished
   changes.
2. **OAuth consent screen in production.** Google Cloud Console -> project `delve-die-repeat` ->
   **APIs & Services** -> **OAuth consent screen** (now under **Google Auth platform** ->
   **Audience**). User type **External**, publishing status **In production**. Play Games sign-in
   with no profile scope asks only for the Games basic-profile scope (GAMES_LITE), which needs no
   Google verification [ASSUMED: if the console asks for verification, tell Claude what it
   says].
3. **Create a Web application OAuth client.** Same project -> **APIs & Services** ->
   **Credentials** -> **Create credentials** -> **OAuth client ID** -> application type **Web
   application**. Name it `ddr-board-names`. No redirect URIs are needed. Copy the **client ID**
   (it ends in `.apps.googleusercontent.com`) and the **client secret**.
4. **Add it as a Game server credential.** Back in the Play Games **Configuration** ->
   **Credentials** -> **Add credential** -> type **Game server** -> pick that web client ->
   save. (This is what lets the game ask Google for a server auth code that Firebase can use.)
5. **Keep the Android credentials**, one per signer, both on package
   `com.darktierstudios.delvedierepeat`:
   - the **Play App Signing key's** SHA-1: Play Console -> **Test and release** -> **Setup** ->
     **App signing** -> **App signing key certificate** -> *SHA-1 certificate fingerprint*.
     **Not the upload key's** (`C:/Users/Dell/android_store_keys/delvedierepeat.jks`, see
     `docs/RELEASING.md`): Play re-signs every installed build with the app signing key, so a
     credential on the upload key's SHA-1 never matches a Play-installed build and sign-in quietly
     fails;
   - the **debug keystore's** SHA-1, for the debug APK on the Pixel 7:

     ```
     keytool -list -v -keystore "%USERPROFILE%\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android
     ```

     Copy the `SHA1:` line. A debug build and a Play build have different signers; each matches
     its own credential, and the two sit side by side without interfering.
6. **Testers while the configuration has unpublished changes.** **Setup and management** ->
   **Testers** -> **Add testers**: your own account and every account on the testing tracks
   (or enable a release track under the **Release tracks** tab). Anyone not listed cannot sign
   in until the configuration is published. Google says new testers can use PGS within a couple
   of hours. Add yourself: an unpublished configuration with nobody on the list lets nobody in.
   The draft achievements follow the same rule: only accounts on the Testers list can earn them
   before the configuration is published.
7. **Firebase billing.** Firebase project `delve-die-repeat-6ba5f` -> **Usage and billing** ->
   attach a billing account (the **Blaze** plan; the `boardName` function is a Cloud Function and
   needs it), then Cloud Console -> **Billing** -> **Budgets and alerts** -> create a budget with
   an alert (a few dollars) so usage stays in the free tier, which is what the function is sized
   for (`docs/LEADERBOARDS.md` section 11).
8. **Publish at the release.** Before 2.3 reaches players who are not testers: **Setup and
   management** -> **Publishing** -> follow the page (it lists anything missing). Changes take
   up to 2 hours to reach players, so publish at least 2 hours before a production rollout.
   **Pitfall:** an unpublished configuration silently makes Compete impossible for everyone who
   is not a tester. (Source: Google's "Test and publish your game",
   https://developer.android.com/games/pgs/console/publish.)

Then hand Claude (section 4): the web client ID, and the secret through a file.

## 3. Path B: a new configuration (only if G4 fails)

Use this when the reused configuration cannot be made to work with Firebase (the dev-row probe
reports `signInWithIdp` failing for it), or if it turns out not to exist after all.

1. Play Console -> **Play Games Services** -> **Setup and management** -> **Configuration** ->
   create a configuration. When asked whether the game already uses Google APIs, answer **"Yes,
   my game already uses Google APIs"** and pick the Firebase project **`delve-die-repeat-6ba5f`**
   [CITED: firebase.google.com/docs/auth/android/play-games].
2. Add the same credentials as path A: the two Android SHA-1 credentials (section 2, step 5), a
   **Game server** credential (the Firebase project's auto-created web client, or a new Web
   application client), and the OAuth consent screen (section 2, step 2). Testers, billing and
   publishing as in section 2.
3. A new configuration means re-importing the achievements zip into it (`docs/ACHIEVEMENTS.md`)
   and fetching a fresh **Get resources** export. Hand Claude that export. Claude replaces **both**
   copies of it, which a unit test keeps equal:
   - `achievements/games-ids.xml` (the export, committed);
   - `android/app/src/main/res/values/games-ids.xml` (the same bytes; the manifest reads
     `@string/app_id` from it);

   and the export's `app_id` must equal `PLAY_GAMES_CONFIG.appId` in
   `src/browser/firebaseConfig.js` (a test checks it). The new web client ID goes in
   `PLAY_GAMES_CONFIG.webClientId`. A new configuration gives every player a new Play Games
   player ID, and the game resends every achievement to it; that is harmless, because nothing
   else stored today depends on the old one.
4. Rebuild the debug APK and re-run the dev-row probe.

## 4. What you hand Claude, and what Claude runs

**You hand over:**

- the Game server **web client ID** (public; it goes into `PLAY_GAMES_CONFIG.webClientId`);
- the **client secret**, by saving it in a text file **outside the repository** and telling
  Claude the path. **Never paste the secret into a chat that is committed, a doc, a commit
  message or a command line.** It lives only in the Firebase Play Games provider configuration
  and, if the fallback is ever needed, in Secret Manager.
- whether the configuration is published or unpublished, and the application ID if path B.

**Claude runs, each on your go (D-14):**

1. Write the web client ID into `PLAY_GAMES_CONFIG.webClientId` (`src/browser/firebaseConfig.js`)
   and commit it.
2. **Enable the Firebase Play Games provider** with the admin API (a `gcloud auth
   print-access-token` bearer and `x-goog-user-project: delve-die-repeat-6ba5f`; the secret is
   read from your file and never printed or committed):
   `POST https://identitytoolkit.googleapis.com/v2/projects/delve-die-repeat-6ba5f/defaultSupportedIdpConfigs?idpId=playgames.google.com`
   with `{ "enabled": true, "clientId": "<web client id>", "clientSecret": "<from your file>" }`,
   or a `PATCH` with `updateMask=enabled,clientId,clientSecret` on
   `.../defaultSupportedIdpConfigs/playgames.google.com` if it already exists; then a `GET`
   confirming `enabled: true` (only `enabled` and `clientId` are printed).
3. **Deploy the `boardName` function:** `node tools/board-names/deploy.mjs --setup --yes` (the
   APIs, the `board-names` service account with `roles/datastore.user`), then
   `node tools/board-names/deploy.mjs --yes`. The deployed URL must equal `BOARD_NAME_FN.url`.
   A dry run (no `--yes`) prints the commands first.
4. **Deploy the rules** (`docs/RELEASING.md` Release 2.3.0 steps 1.5 and 3; the transition
   config used at first was deleted at the 2.3 cutover, so today it is the plain command):
   `firebase deploy --only firestore:rules,firestore:indexes --project delve-die-repeat-6ba5f --non-interactive`.
5. **Run the probes:** `node tools/boards-smoke.mjs` and
   `node tools/boards-smoke.mjs --function` (exit 0, every step PASS, cleanup ok).
6. After the debug APK is installed: the **dev-row PLAY GAMES PROBE** (long-press the version
   label; debug builds only), which proves gates G1 to G4, A3, A4 and A6 on the phone
   (`docs/LEADERBOARDS.md` section 15).

If the probe shows the gamer name is not what Firebase stores (G1), or an end user can edit the
stored name (A4): redeploy the function with the fallback that asks Google directly. Store the
secret first, from a file outside the repo (`node tools/board-names/deploy.mjs --setup
--name-source games --pgs-client-id <web client id>` prints the two `gcloud secrets` commands to
run), then `node tools/board-names/deploy.mjs --name-source games --pgs-client-id <web client id>
--yes`. No client update is needed.

## 5. Pitfalls

- **Wrong SHA-1.** A credential on the upload key's SHA-1 never matches a Play-installed build;
  sign-in quietly fails. Use the Play App Signing key's SHA-1, plus the debug keystore's SHA-1
  for the debug APK.
- **Unpublished configuration.** Only testers can sign in. Publish at the release (section 2,
  step 8), at least 2 hours before a rollout.
- **No APP_ID in the manifest.** `AndroidManifest.xml` references `@string/app_id` (from
  `android/app/src/main/res/values/games-ids.xml`, the Play Console Get resources export) in its
  `com.google.android.gms.games.APP_ID` meta-data. A placeholder there breaks sign-in; the game
  plays on, runs queue.
- **PROFILE or EMAIL scopes.** Never requested. They would return the Google account's real name
  and email, which the game must never see.
- **The two APP_ID copies.** The export's `app_id` and `PLAY_GAMES_CONFIG.appId` must agree; a
  unit test checks it.
- **A re-export must replace both copies.** `achievements/games-ids.xml` and
  `android/app/src/main/res/values/games-ids.xml` are the same bytes. Replacing one leaves the
  game looking up ids the build does not have, or the tests failing; the equality test is the
  net.
- **The keep.xml wildcard.** `android/app/src/main/res/raw/keep.xml` keeps `@string/achievement_*`.
  The game looks those strings up by name at run time, so without the wildcard the release build
  shrinks them away: debug works, release silently sends nothing.
- **Draft achievements and testers.** Until the configuration is published, only accounts on the
  Testers list (section 2, step 6) can earn the draft achievements. Any other account sees
  sign-in failures or refusals for unknown achievements; the game holds and retries at the next
  launch.
- **The secret in the wrong place.** It goes in a file outside the repo, then into the provider
  configuration only. A key path inside the repository is refused by the tools.
- **Deleting the configuration.** Do not. The Season-1 leaderboards inside it may stay or go
  (`docs/LEADERBOARDS.md` section 16); the configuration itself stays.

## 6. Checking it worked

On a device signed in with a tester account, with Compete on, after the build is installed:

- the account block shows the player's Google Play Games name (not "NOT SIGNED IN"), and
- a finished run shows on the board under that name.

- an achievement earned in a run shows the in-game card and then Play's own unlock popup (with its
  XP), and VIEW IN PLAY GAMES at the top of the ACHIEVEMENTS sheet opens Play's list showing it.

If it stays signed out, re-check in order: the credential's SHA-1 is the signer's (section 5),
the application ID in `games-ids.xml` matches the configuration, and the account is on the
Testers list (or the configuration is published). The dev-row probe's report names the first
step that fails.

## 7. Achievements (2.5, Phase 101)

The whole achievements side, end to end:

- **The IDs file.** The user's Play Console **Get resources** export (the Android resources XML)
  lives in two copies of the same bytes: `achievements/games-ids.xml` and
  `android/app/src/main/res/values/games-ids.xml`. It holds `app_id` and one
  `achievement_*` string per achievement; the manifest's APP_ID meta-data reads `@string/app_id`.
- **The tests.** `test/unit/play-achievements.test.js` proves all 77 catalog names resolve in the
  export, none is unused, the values are unique and `app_id` equals `PLAY_GAMES_CONFIG.appId`.
  `test/unit/play-achievements-native.test.js` proves the res copy equals the export, no string
  name is defined twice, `keep.xml` keeps `@string/achievement_*` and the plugin's source pins.
- **The plugin.** `PlayIdentityPlugin` has two achievements methods: `syncAchievements` (a batch
  of unlock, reveal and set-steps operations) and `showAchievements` (Play's own list).
- **The mirror.** `src/browser/playAchievements.js` works out what Play still lacks from the
  record and a durable ledger (`ddr.pgsAch.v1`), and sends it only with Compete on, online and
  signed in. Compete off never starts the SDK and never purges the ledger.
- **The button.** VIEW IN PLAY GAMES sits at the top of the ACHIEVEMENTS sheet (reached through
  the menu), and shows only with Compete on and the player signed in.
- **Testers for drafts.** Draft achievements work only for accounts on the Testers list
  (section 2, step 6).
- **Publishing.** Publish the configuration, achievements included, at least 2 hours before a
  production rollout (section 2, step 8, and `docs/ACHIEVEMENTS.md`).
- **The device check** for the milestone-close Pixel 7 checklist is in `docs/ACHIEVEMENTS.md`,
  "Check Play's side on a device".
- **Data safety.** Achievement progress now counts in the Play Games data the SDK collects; the
  answers are in `store-listing/LISTING.md`, "Data safety".
