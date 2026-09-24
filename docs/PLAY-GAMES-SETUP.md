# Play Games Services setup (Play Console)

**Delve, Die, Repeat** (`com.darktierstudios.delvedierepeat`) signs players in through Google
Play Games Services (PGS) v2 so their runs can go on the global boards. The code side ships in
Phase 67; the console side below is yours, and can be done in parallel with development.

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
   (see step 5).

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
credential.

## 4. The APP_ID

1. Still in **Configuration**, the page header shows the numeric **application ID** (a 12-digit
   number, sometimes labelled *Project ID*).
2. Paste it into `android/app/src/main/res/values/games-ids.xml`, replacing the 12-zero
   placeholder `000000000000` in the string resource `game_services_project_id` (created by plan
   67-06). `android/app/src/main/AndroidManifest.xml` references that resource from its
   `com.google.android.gms.games.APP_ID` meta-data; nothing else needs to change.
3. Rebuild: `npm run android:debug` for a local test build, or `npm run play:release` for the
   next internal-testing upload.

With the placeholder still in place, sign-in fails as described in step 1 and the game plays on.

## 5. Testers

While the PGS configuration is unpublished, only Google accounts on its **Testers** list can
sign in. **Play Games Services** → **Setup and management** → **Testers** → add every account
on the internal-testing track's tester list (and your own). Anyone else simply stays signed out.

## 6. What Phase 69 completes

This runbook is finished in Phase 69, which adds:

- **The leaderboards (D-19):** five per season, created as described in step 7. LINEAGE and
  GRAVEYARD get no PGS board (LINEAGE is derived from a DEEPEST sample, GRAVEYARD is local only).
- **The cap:** PGS allows 70 leaderboards per game, for its whole lifetime. Five boards per
  season lasts 14 seasons. Old seasons' boards are never deleted.
- **The per-board, per-season leaderboard IDs**, pasted into `content/leaderboards.js` (step 8).
- **Publishing** the PGS configuration, so accounts beyond the Testers list can sign in.
- **The Data Safety answers** for Play Games sign-in and leaderboard submissions.

## 7. Leaderboards (one set of five per season)

1. **Play Games Services** → **Setup and management** → **Leaderboards** → **Create
   leaderboard**, once for each row below.
2. Name each one with its board name and season (for example *DEEPEST, Season 1*).
3. Set **Ordering** exactly as in the table. It is fixed once the leaderboard is published and
   cannot be changed afterwards; a wrong ordering means a new leaderboard and one fewer of the
   70.
4. Leave the score format **Numeric** with no decimal places, and leave the lower and upper
   limits empty.
5. Leave **tamper protection** on. It is on by default for new leaderboards and should stay
   on: it lets Google hide scores it flags as forged.

| Board | Internal key | Ordering | Submitted score |
|---|---|---|---|
| DEEPEST | `deep` | Larger is better | the floor times 1,000,000, minus the steps walked (steps capped at 999,999): deeper wins, and on the same floor fewer steps wins |
| LEANEST | `lean` | Smaller is better | the squares walked per floor descended, times 1,000, rounded (a floor-0 death counts as one floor) |
| LONGEST | `days` | Larger is better | the day times 1,000, plus the floor (capped at 999) as the tiebreak |
| BUTCHERY | `kills` | Larger is better | the kills times 1,000, plus the floor (capped at 999) as the tiebreak |
| PURSE | `gold` | Larger is better | the gold carried, as is |

The number the console shows is an ordering key, not what players see. Rows read their
displayed values (floor, steps, day, kills, gold and the rest) from the score tag (step 10).

**The LEANEST limit.** One integer cannot also break ties by depth, so two runs with the same
squares-per-floor rate rank equally whatever floor they reached. This is accepted: the local
board still breaks that tie by depth.

## 8. Where the IDs go

1. Each leaderboard's page shows its **leaderboard ID** (a string like `CgkI...`).
2. Paste each ID into `content/leaderboards.js`, under `LEADERBOARD_IDS[season]`, replacing
   that board's `PLACEHOLDER_` value (for example `PLACEHOLDER_DEEPEST_S1` becomes the DEEPEST
   leaderboard's ID).
3. Rebuild and upload as in step 4.

A board whose ID is still a placeholder is skipped silently: nothing is submitted to it (runs
stay queued for it), and its global view says the board has not opened yet. So the IDs can go
in one at a time.

## 9. Starting a new season

When a balance change moves the depth curve (D-15):

1. Create five new leaderboards in the console, as in step 7, named for the new season.
2. In `content/leaderboards.js`, add a new `LEADERBOARD_IDS` entry for the next season number
   with the five new IDs (step 8).
3. Bump `SEASON` in `content/season.js` and add a line to its season changelog.
4. Never edit or delete an older season's entry. Old boards stay readable from the panel's
   season picker and are never written again.

The unit suite fails if `SEASON` has no `LEADERBOARD_IDS` entry, so step 2 cannot be forgotten.
Remember the cap: 70 leaderboards per game, so five per season lasts 14 seasons.

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
- **LINEAGE global (D-19).** Client-side grouping of a top-N DEEPEST fetch by race + class,
  the best entry per combo, with an honest "sampled" footnote. No per-combo boards, ever.
- **Submissions.** The plugin (0.5.0) resolves a submission only after the server write, and
  PGS has no offline queue, so the game keeps its own durable submission queue.

## 11. How to check it worked

Install a Play build (internal testing) on a device signed in with a tester account. After
launch:

- the account chip shows the player's initials instead of the "nobody" glyph, and
- the Leaderboards identity strip reads **PLAY GAMES · SIGNED IN**.

If the chip stays the "nobody" glyph, re-check in order: the credential's SHA-1 is the app
signing key's (step 3), the APP_ID replaced the placeholder and the build was rebuilt (step 4),
and the account is on the Testers list (step 5).
