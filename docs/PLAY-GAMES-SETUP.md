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

- **The leaderboards (D-19):** five per season, namely DEEPEST, LEANEST, LONGEST, BUTCHERY and
  PURSE. LINEAGE and GRAVEYARD get no PGS board (LINEAGE is derived from DEEPEST, GRAVEYARD is
  local only). Each board's sort direction and score format follow the mapping in
  `.planning/phases/67-play-games-integration-account-chip/67-RESEARCH.md` ("Board →
  Leaderboard Mapping"):

  | Board | Score | Sort |
  |---|---|---|
  | DEEPEST | `floor * 1000000 - steps` | larger is better |
  | LEANEST | per Phase 66's final ranking (composite like DEEPEST, or a scaled steps-per-floor ratio) | confirm in Phase 68 |
  | LONGEST | `day * 1000 + floor` | larger is better |
  | BUTCHERY | `kills * 1000 + floor` | larger is better |
  | PURSE | `gold` | larger is better |

  Sort order is fixed when a leaderboard is created and cannot change after publishing.
- **The cap:** PGS allows 70 leaderboards per game, for its whole lifetime. Five boards per
  season lasts 14 seasons. Old seasons' boards are never deleted.
- **The per-board, per-season leaderboard IDs**, pasted into the build's ID table.
- **Publishing** the PGS configuration, so accounts beyond the Testers list can sign in.
- **The Data Safety answers** for Play Games sign-in and leaderboard submissions.

## 7. Engineering notes carried to Phase 68

Recorded here so the decisions survive between phases (D-14, D-18, D-19):

- **Score tag (D-14).** At most **64** characters, only from the unreserved set
  `A-Z a-z 0-9 - . _ ~`. A malformed tag throws on submit, so the encoder is defensive. Layout,
  versioned and dot-delimited plain text:

  ```
  v1.{race}.{sub}.{lvl}.{cause}.{floor}.{day}.{steps}.{kills}.{gold}.{sp}.{name}
  ```

  47 characters are fixed, leaving 17 for the name. Race, sub-class and cause are frozen numeric
  indexes (never reorder them). An unparseable tag decodes to "no adventurer detail" and never
  blanks a row.
- **Name truncation.** Full "First Last" if it fits; else "First L."; else the first name
  hard-truncated to the budget, no ellipsis.
- **No epitaph in the tag (D-18).** It cannot fit. Global rows expand to a short cause line
  (from the cause code) plus the stat chips; your own runs keep their full epitaphs from local
  data.
- **LINEAGE global (D-19).** Client-side grouping of a top-N DEEPEST fetch by race + class, the
  best entry per combo, with an honest "sampled" footnote. No per-combo boards, ever.
- **Submissions.** The plugin (0.5.0) resolves a submission only after the server write (it uses
  the `*Immediate` variants), and PGS has no offline queue, so Phase 68's durable submission
  queue stays required.

## 8. How to check it worked

Install a Play build (internal testing) on a device signed in with a tester account. After
launch:

- the account chip shows the player's initials instead of the "nobody" glyph, and
- the Leaderboards identity strip reads **PLAY GAMES · SIGNED IN**.

If the chip stays the "nobody" glyph, re-check in order: the credential's SHA-1 is the app
signing key's (step 3), the APP_ID replaced the placeholder and the build was rebuilt (step 4),
and the account is on the Testers list (step 5).
