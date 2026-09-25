# Play Games Services setup (Play Console)

**Delve, Die, Repeat** (`com.darktierstudios.delvedierepeat`) signs players in through Google
Play Games Services (PGS) v2 so their runs can go on the global boards. The code side ships in
Phase 67; the console side below is yours, and can be done in parallel with development.

Walk section 6 (Order of operations) top to bottom; every other section is the detail behind
one of its steps.

## 1. What this is

These are the Play Console steps only the account owner can do. Until they are done, sign-in
fails gracefully (D-15): the account chip stays the "nobody" glyph (a hollow square with a dim
?), one rail card says Play Games did not answer, and the game is fully playable. Nothing
crashes and nothing blocks boot.

Console labels move over time. If a menu below has been renamed, follow its current equivalent;
the order of the steps is what matters.

## 2. Enable Play Games Services

1. Play Console → **Delve, Die, Repeat** → **Play Games Services** → **Setup and management** →
   **Configuration**.
2. Choose **No, my game doesn't use Google APIs** to create a new PGS project, or **Yes** to link
   the existing Google Cloud project if one was already created for this app.
3. Save. The configuration starts out **unpublished**, which is what you want while testing
   (see section 5).

## 3. Credentials (the SHA-1 that matters)

1. In **Configuration** → **Credentials** → **Add credential** → type **Android**.
2. Package name: `com.darktierstudios.delvedierepeat`.
3. SHA-1: use the **Play App Signing key**'s SHA-1, from Play Console → **Test and release** →
   **Setup** → **App signing** → **App signing key certificate** → *SHA-1 certificate
   fingerprint*.

   **Not the upload key's SHA-1.** The upload key (`C:/Users/Dell/android_store_keys/delvedierepeat.jks`,
   see `docs/RELEASING.md`) only signs the bundle you upload. Play re-signs every installed
   build with the app signing key, so a credential on the upload key's SHA-1 never matches a
   Play-installed build and sign-in quietly fails.
4. Save the credential.

**Optional testing credential (local debug APK).** To try sign-in on a build installed with
`npm run android:debug` + `adb install -r`, add a second Android credential for the same package
with the debug keystore's SHA-1:

```
keytool -list -v -keystore "%USERPROFILE%\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android
```

Copy the `SHA1:` line into the second credential. A debug build and a Play build have different
signers (the phone holds only one at a time, see `docs/RELEASING.md`); each matches its own
credential. The two credentials sit side by side on the same package and never interfere:
adding the debug one does not break the Play one, and a debug build never matches the Play
credential (or the other way round).

## 4. The APP_ID

1. Still in **Configuration**, the page header shows the numeric **application ID** (a 12-digit
   number, sometimes labelled *Project ID*).
2. Paste it into `android/app/src/main/res/values/games-ids.xml`, replacing the 12-zero
   placeholder `000000000000` in the string resource `game_services_project_id` (created by plan
   67-06). `android/app/src/main/AndroidManifest.xml` references that resource from its
   `com.google.android.gms.games.APP_ID` meta-data; nothing else needs to change.
3. Rebuild: `npm run android:debug` for a local test build, or `npm run play:release` for the
   next Play testing-track upload (`docs/RELEASING.md`).

With the placeholder still in place, sign-in fails as described in section 1 and the game plays
on.

## 5. Testers

While the PGS configuration is unpublished, only Google accounts on its **Testers** list can
sign in. **Grow users** → **Play Games Services** → **Setup and management** → **Testers** →
**Add testers**, then add every account on the closed-testing track's tester list (and any
internal-testing testers), and your own. Anyone else simply stays signed out.

Instead of adding accounts one by one, the **Release tracks** tab on the same page can enable a
whole Play release track (for example the closed-testing track) for PGS testing; that works
the same as listing each of its testers. Google says new testers can use PGS within a couple of
hours.

**Add yourself.** An unpublished configuration with nobody on the Testers list lets nobody sign
in, you included.

## 6. Order of operations (Phase 69)

These are your Play Console steps. They are recorded as deferred human items in
`docs/UAT-v2.0.md` and never block a milestone close: the 2.0.0 build works without them
(sign-in fails gracefully, and each board is skipped until its ID is in). Do them in this order;
each line names the section that details it.

1. Enable Play Games Services (section 2).
2. Add the Android credential with the Play App Signing key's SHA-1, and optionally a second one
   with the debug keystore's SHA-1 for a local debug APK (section 3).
3. Copy the APP_ID (section 4).
4. Add every closed-testing tester and yourself to Testers, or enable the closed-testing track
   there (section 5).
5. Create the four Season-1 leaderboards: DEEPEST, LONGEST, BUTCHERY and PURSE
   (section 7).
6. Send Claude the APP_ID and the four leaderboard IDs, or paste them yourself into
   `games-ids.xml` and `content/leaderboards.js` `LEADERBOARD_IDS[1]` (sections 4 and 8).
7. Rebuild and upload with a versionCode bump, `npm run play:release` (`docs/RELEASING.md`).
8. Check with a tester account: sign-in, then one death on all four boards (section 11).
9. Publish the Play Games configuration (section 12).
10. Enter the Data safety answers from `store-listing/LISTING.md`, with the privacy URL
    https://darktierstudios.com/privacy/apps and the delete-data URL
    https://darktierstudios.com/privacy/delete-data (Play Console → **App content**).
11. Later, once per season, create the next four boards and bump the season (section 9).

Two facts to keep in mind while doing it:

- **LINEAGE and GRAVEYARD get no PGS board.** Since v2.1, LINEAGE is ME-only (BOARD-13), and
  GRAVEYARD was folded into the ME scope (BOARD-14). Neither ever had, or will have, a Play
  Games board.
- **The cap.** PGS allows 70 leaderboards per game, for its whole lifetime. Four boards per
  season, with Season 1 counted as five spent (it briefly included the now-retired LEANEST,
  section 13), leaves 65 — 16 more seasons of four. Old seasons' boards are never deleted.

## 7. Leaderboards (one set of four per season)

1. **Play Games Services** → **Setup and management** → **Leaderboards** → **Create
   leaderboard**, once for each row below.
2. Name each one with its board name and season, typed exactly as: *DEEPEST, Season 1*,
   *LONGEST, Season 1*, *BUTCHERY, Season 1*, *PURSE, Season 1*.
3. Set **Ordering** exactly as in the table (the console may label it **Sort order**). It is
   fixed once the leaderboard is published and cannot be changed afterwards; a wrong ordering
   means a new leaderboard and one fewer of the 70.
4. Leave the score format **Numeric** with no decimal places, and leave the lower and upper
   limits empty.
5. Leave **tamper protection** on. It is on by default for new leaderboards and should stay
   on: it lets Google hide scores it flags as forged.

| Board | Internal key | Ordering | Submitted score |
|---|---|---|---|
| DEEPEST | `deep` | Larger is better | the floor times 1,000,000, minus the steps walked (steps capped at 999,999): deeper wins, and on the same floor fewer steps wins |
| LONGEST | `days` | Larger is better | the day times 1,000, plus the floor (capped at 999) as the tiebreak |
| BUTCHERY | `kills` | Larger is better | the kills times 1,000, plus the floor (capped at 999) as the tiebreak |
| PURSE | `gold` | Larger is better | the gold carried, as is |

The number the console shows is an ordering key, not what players see. Rows read their
displayed values (floor, steps, day, kills, gold and the rest) from the score tag (section 10).

See section 13 for the retired LEANEST board.

## 8. Where the IDs go

1. Each leaderboard's page shows its **leaderboard ID** (a string like `CgkI...`).
2. Paste each ID into `content/leaderboards.js`, under `LEADERBOARD_IDS[season]`, replacing
   that board's `PLACEHOLDER_` value (for example `PLACEHOLDER_DEEPEST_S1` becomes the DEEPEST
   leaderboard's ID).
3. Rebuild and upload as in section 4.

A board whose ID is still a placeholder is skipped silently: nothing is submitted to it (runs
stay queued for it), and its global view says the board has not opened yet. So the IDs can go
in one at a time.

## 9. Starting a new season

When a balance change moves the depth curve (D-15):

1. Create four new leaderboards in the console, as in section 7, named for the new season.
2. In `content/leaderboards.js`, add a new `LEADERBOARD_IDS` entry for the next season number
   with the four new IDs (section 8).
3. Bump `SEASON` in `content/season.js` and add a line to its season changelog.
4. Never edit or delete an older season's entry. Old boards stay readable from the panel's
   season picker and are never written again.

The unit suite fails if `SEASON` has no `LEADERBOARD_IDS` entry, so step 2 cannot be forgotten.
Remember the cap: 70 leaderboards per game. Season 1 spent five (it briefly included the
now-retired LEANEST, section 13), leaving 65 for four boards a season — 16 more seasons. The
sixteenth of those takes the last four of the 70; there is no seventeenth set of four.

## 10. How the score tag is built (Phase 68)

Every submission carries a score tag, which is where a global row's details come from
(`src/browser/scoreTag.js`):

- **Length and characters.** At most **64** characters, only from the unreserved set
  `A-Z a-z 0-9 - . _ ~`. The encoder always stays inside both.
- **Field order (v1).** Versioned and dot-delimited plain text:

  ```
  v1.{race}.{sub}.{lvl}.{cause}.{floor}.{day}.{steps}.{kills}.{gold}.{sp}.{name}
  ```

  Race, sub-class and cause are frozen numeric indexes (new ones are appended, never
  reordered). Each number is capped (level 99, floor 999, day 9,999, steps 99,999, kills
  9,999, gold and sp 999,999).
- **The name.** Spaces become `_` and any other character outside the set is dropped. The name
  gets whatever room the numbers leave: the full name if it fits, else "First L.", else the
  first name cut short with no ellipsis. The worst case (every number at its cap) leaves 16
  characters; the Phase 67 research counted 17, but twelve fields need eleven dots.
- **No epitaph.** It cannot fit, and it stays on the player's own device. Global rows show a
  short cause line from the cause code instead; your own runs keep their full epitaphs.
- **A tag that fails to decode** still shows the player's handle and the board's value (read
  back from the raw score), so a row is never blank.
- **LINEAGE is ME-only, since v2.1 (BOARD-13).** There is no global lineage view and no
  per-combo board: Play Games keeps one best score per player per board, so a global lineage
  view could only ever show each player's all-time deepest character, never a true per-combo
  best. Per-sub-class global boards are backlog 999.11, not this release.
- **Submissions.** The plugin (0.5.0) resolves a submission only after the server write, and
  PGS has no offline queue, so the game keeps its own durable submission queue.

## 11. How to check it worked

Install a Play build (closed or internal testing) on a device signed in with a tester account.
After launch:

- the account chip shows the player's initials instead of the "nobody" glyph, and
- the Leaderboards identity strip reads **PLAY GAMES · SIGNED IN**.

If the chip stays the "nobody" glyph, re-check in order: the credential's SHA-1 is the app
signing key's (section 3), the APP_ID replaced the placeholder and the build was rebuilt
(section 4), and the account is on the Testers list (section 5).

**The leaderboard check.** Once the four IDs are in and the build is rebuilt (section 8), one
tester death appears on all four boards. In the console, each board's score view shows the
run's v1 tag, for example `v1.2.8.3.0.7.22.431.19.4688.1180.Hilda_Ferrow` (a level 3 Dwarven
Pickpocket killed in combat on floor 7, day 22, after 431 steps, 19 kills and 4,688 gold). That
run's scores are:

| Board | Score | Why |
|---|---|---|
| DEEPEST | 6,999,569 | 7 × 1,000,000 − 431 |
| LONGEST | 22,007 | 22 × 1,000 + 7 |
| BUTCHERY | 19,007 | 19 × 1,000 + 7 |
| PURSE | 4,688 | the gold, as is |

If a board shows nothing, check that its ID replaced its placeholder (section 8); a board
still on a placeholder is skipped silently.

## 12. Publish the Play Games configuration

1. Play Console → **Delve, Die, Repeat** → **Grow users** → **Play Games Services** →
   **Setup and management** → **Publishing**.
2. The page lists anything missing or misconfigured that stops publishing. Fix each item, come
   back, and follow the instructions on the page to publish.

What publishing does:

- Every player with the game can use Play Games sign-in and the leaderboards, not only the
  accounts on the Testers list (or an enabled release track).
- It is separate from publishing the app itself. It does not release a build and does not make
  the game visible on the Play Store.
- Changes take **up to 2 hours** to reach players. Publish at least 2 hours before a production
  rollout, or sign-in and the boards may not work for the first players.
- Tester data is not deleted at publish.
- Each leaderboard's ordering cannot be changed once published (section 7), so check the table
  before pressing publish.

When: after the section 11 check passes. While the app is only on closed testing, staying
unpublished is fine as long as every closed-track tester is on the Testers list (section 5);
anyone else simply stays signed out.

Source: Google's "Test and publish your game",
https://developer.android.com/games/pgs/console/publish (page last updated 2026-06-16, read
2026-09-24). The path and wording above match the page as read that day.

## 13. Retired boards

| Season | Board | Internal key | ID | Retired in |
|---|---|---|---|---|
| 1 | LEANEST | `lean` | `CgkIlvbN0YYPEAIQAw` | v2.1 (BOARD-17) |

**Why it was retired (v2.1, BOARD-17).** Steps per floor let a 1-step death top it (a floor-0
death counts as one floor on Play Games, so a single-step death on floor 1 could sit at the
top), and "deepest floor, then fewest steps" is exactly DEEPEST's own ordering — so no honest
LEANEST board remained once that overlap was seen.

**When to delete it.** Delete it only AFTER the update that stops submitting to it is live on
the track the testers use. Deleting it earlier would orphan any runs still queued for it.
Path: Play Console → **Delve, Die, Repeat** → **Grow users** → **Play Games Services** →
**Setup and management** → **Leaderboards** → **LEANEST, Season 1** → delete.

**If the console refuses to delete it.** Some published leaderboards cannot be deleted once
live. If that happens here, leave it: nothing submits to it again, and it still counts toward
the 70-board cap either way.

The code carries no ID for it any more — `content/leaderboards.js` has no `lean` entry as of
v2.1.
