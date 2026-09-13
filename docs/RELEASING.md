# Releasing to Google Play (internal testing)

The app lives on Play Console as **Delve, Die, Repeat** (`com.darktierstudios.delvedierepeat`), on an
**internal-testing** track with friends as testers (first upload 2026-09-10, versionCode 1).

## One-time setup (this machine)

1. `android/keystore.properties` (git-ignored) — fill in `storePassword`, `keyAlias`
   (and `keyPassword` if it differs). The file already points at the upload keystore
   `C:/Users/Dell/android_store_keys/delvedierepeat.jks`. **Back that .jks up** somewhere
   off this machine; Play App Signing lets you reset a lost upload key, but it's a support ticket.
2. Nothing else — `android/app/build.gradle` picks the file up automatically. When it is
   missing or blank, `bundleRelease` still builds but produces an **unsigned** bundle
   (Play rejects it), and `assembleDebug` is unaffected.

## Every update

```
npm test                 # must be green
npm run play:release     # = bump versionCode → build:www → cap sync → pin-jdk → bundleRelease
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`, signed with the upload key.
Then Play Console → Testing → Internal testing → **Create new release** → drop the .aab →
release notes → Save + Start rollout. Testers get it within minutes (no review on internal).

- `android/version.properties` is the single source of `versionCode` / `versionName`. Play
  rejects a re-used versionCode, so `play:release` always bumps it; use
  `node tools/bump-version.mjs --name 1.1.0` when the human-readable version should change too.
- `npm run android:release` builds WITHOUT bumping (rebuild the same version after a fix that
  never went up).
- Local review on the Pixel 7 still uses the debug APK (`npm run android:debug` + `adb install -r`).
  A Play-installed build and a locally-signed build have different signers, so one must be
  uninstalled before the other installs — the phone can't hold both.

## Uploading from the CLI (not set up yet)

Play's Developer API can do the upload so no Console drag-and-drop is needed:

1. Google Cloud Console → a project → **IAM & Admin → Service Accounts → Create**; create a JSON
   key and store it OUTSIDE the repo (e.g. `C:/Users/Dell/.play/service-account.json`).
2. Play Console → **Users and permissions → Invite new user** → the service account's email →
   app permissions: *Release to testing tracks* (+ *Edit and delete draft apps* if listing edits
   should be scripted too).
3. Then a `tools/play-upload.mjs` (using the `googleapis` **devDependency** — build tooling only,
   nothing ships in the app) does: edits.insert → edits.bundles.upload → edits.tracks.update
   (`internal`) → edits.commit. Ask Claude to add it once steps 1–2 are done.
